import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {evaluateDomainMatching} from '../scripts/benchmarks/domain-matching-comparison.mjs';
import {evaluateMatching} from '../scripts/benchmarks/synthetic-validation.mjs';
import {matchingScenarios} from '../scripts/benchmarks/fixtures/synthetic-v1.mjs';

const digest=()=>createHash('sha256').update(JSON.stringify(matchingScenarios())).digest('hex');
const before=digest(),report=evaluateDomainMatching();

test('comparison reuses all frozen domain cases without changing their labels or candidate profiles',()=>{
 assert.equal(report.fixtureHash,before);assert.equal(digest(),before);
 assert.equal(report.dataset.scenarios,24);assert.equal(report.dataset.pairs,480);
 assert.deepEqual(report.dataset.specializations,['Backend','QA','Data Science','Frontend','DevOps','ML Engineering']);
});

test('the full comparison agrees with the existing product evaluation on identical domain inputs',()=>{
 const existing=evaluateMatching('all').summary;
 for(const key of ['precisionAtK','recallAtK','ndcgAtK','reciprocalRank'])assert.equal(report.summary.full[key],existing[key]);
 // The unchanged v1 fixture has 24 legacy fail labels for unreported skills;
 // the current product correctly asks for clarification instead.
 assert.equal(report.invariants.eligibilityCorrect,456);
 const disagreements=evaluateMatching('all').cases.flatMap(row=>row.failures);
 assert.equal(disagreements.length,24);
 assert.ok(disagreements.every(row=>row.id.endsWith('-missing-skill')&&row.expected==='fail'&&row.actual==='unknown'));
 assert.equal(report.invariants.explanationCorrect,480);
 assert.equal(report.summary.full.invalidTopFive,0);
});

test('fair lexical and stack baselines use the product hard filters and report their residual ranking quality',()=>{
 assert.equal(report.summary.hard_filters_tfidf.invalidTopFive,0);
 assert.equal(report.summary.hard_filters_stack.invalidTopFive,0);
 assert.ok(report.summary.tfidf.invalidTopFive>0);
 assert.ok(report.summary.stack.invalidTopFive>0);
 assert.ok(report.summary.full.precisionAtK>report.summary.hard_filters_tfidf.precisionAtK);
 assert.ok(report.summary.full.precisionAtK>report.summary.hard_filters_stack.precisionAtK);
});

test('removing only professional evidence exposes its value without pretending FSP/test effects are identified',()=>{
 assert.ok(report.summary.without_resume.precisionAtK<report.summary.full.precisionAtK);
 assert.equal(report.summary.without_resume.invalidTopFive,0);
 assert.equal(report.summary.without_fsp.precisionAtK,report.summary.full.precisionAtK);
 assert.equal(report.summary.without_test.precisionAtK,report.summary.full.precisionAtK);
 assert.equal(report.invariants.noHistoryRelevantEligible,24);
 assert.equal(report.invariants.fspBonusOutsideCategory,0);
});

test('chance expectation and tied-score uncertainty remain visible rather than counting arbitrary ID order as evidence',()=>{
 assert.ok(Math.abs(report.summary.full.randomPrecisionAtK-.325)<1e-12);
 assert.ok(report.summary.hard_filters_stack.tieAdjustedPrecisionAtK<report.summary.hard_filters_stack.precisionAtK);
 assert.ok(report.summary.hard_filters_only.tieAdjustedPrecisionAtK>.6);
 assert.ok(report.limitations.some(text=>text.includes('end-to-end testing with jury/users')));
 assert.ok(report.limitations.some(text=>text.includes('not generalization')));
});
