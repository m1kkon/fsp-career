import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confusionMetrics,gradedNdcg,seededRandom,wilson} from '../scripts/benchmarks/validation-metrics.mjs';
import {matchingScenarios} from '../scripts/benchmarks/fixtures/synthetic-v1.mjs';
import {evaluateMatching,evaluateGrades} from '../scripts/benchmarks/synthetic-validation.mjs';
import {DEFAULT_SPECS} from '../lib/question-bank.mjs';
import {specifications} from '../lib/assessments.mjs';
import {SCORING_RULE,LINEAR_CODING_SCORING_RULE,LEGACY_EVIDENCE_SCORING_RULE,DEFAULT_THRESHOLDS} from '../lib/assessment-scoring.mjs';
import {FRESH_SEED,SAFETY_SEED,PERSONAS,SAFETY_PERSONAS} from '../scripts/benchmarks/fixtures/synthetic-hardening-v2.mjs';
import {evaluateResumeEvidence} from '../scripts/benchmarks/resume-evidence-validation.mjs';

test('independent metric fixtures cover confusion, chance agreement, ordering and intervals',()=>{
 const rows=[{expected:'low',actual:'low'},{expected:'low',actual:'high'},{expected:'high',actual:'high'},{expected:'high',actual:'high'}];
 const m=confusionMetrics(rows,['low','high']);assert.deepEqual(m.matrix,[[1,1],[0,2]]);assert.equal(m.accuracy,.75);assert.equal(m.balancedAccuracy,.75);assert.equal(m.kappa,.5);assert.equal(m.overgraded,.25);
 assert.equal(gradedNdcg([3,2,1,0],3),1);assert.ok(gradedNdcg([0,1,2,3],3)<1);assert.equal(gradedNdcg([0,0]),null);
 const interval=wilson(50,100);assert.ok(interval.low<.5&&interval.high>.5);assert.equal(wilson(0,0),null);
 const a=seededRandom('a'),b=seededRandom('a'),c=seededRandom('b');assert.deepEqual(Array.from({length:10},a),Array.from({length:10},b));assert.notEqual(seededRandom('a')(),c());
});

test('development/holdout cases have disjoint scenario families and candidate IDs',()=>{
 const data=matchingScenarios(),dev=data.filter(s=>s.split==='development'),held=data.filter(s=>s.split==='holdout');
 assert.equal(data.length,24);assert.equal(data.reduce((s,row)=>s+row.candidates.length,0),480);
 const families=new Set(dev.map(s=>s.family)),ids=new Set(dev.flatMap(s=>s.candidates.map(row=>row.candidate.id)));
 assert.ok(held.every(s=>!families.has(s.family)&&s.candidates.every(row=>!ids.has(row.candidate.id))));
 assert.ok(data.every(s=>s.candidates.filter(row=>row.label>=2).length>=5));
});

test('development search meets the frozen relevance rubric without invalid top-five candidates',()=>{
 const m=evaluateMatching();assert.ok(m.summary.precisionAtK>=.9);assert.equal(m.summary.eligibilityAccuracy,1);assert.equal(m.summary.invalidTop5,0);assert.equal(m.summary.scoreExplanationAccuracy,1);
 assert.equal(m.pairwise.higherVsIrrelevant,1);
 assert.ok(m.summary.tiedPrecisionAt5>=.9);
});

test('synthetic grade validation is repeatable and retains low overgrading with stable retests',async()=>{
 const report=await evaluateGrades();assert.ok(report.summary.accuracy>=.9);assert.ok(report.summary.overgraded<=.01);assert.ok(report.summary.testRetestAgreement>=.8);
 assert.ok(report.summary.byGrade.find(row=>row.label==='Middle').recall>=.8);
 assert.equal(report.summary.byGrade[0].recall,1);
 assert.ok(report.discrimination.coveredItems>500);assert.equal(report.discrimination.negativeItems.length,0);
 const first=await evaluateGrades({peoplePerGrade:2,formsPerModule:2}),second=await evaluateGrades({peoplePerGrade:2,formsPerModule:2});
 assert.equal(first.formHash,second.formHash);assert.deepEqual(first.summary,second.summary);
});

test('fresh grade seeds retain the frozen acceptance criteria and one-sided answers cannot qualify',async()=>{
 const fresh=await evaluateGrades({split:'holdout',peoplePerGrade:50,seedNamespace:FRESH_SEED,personas:PERSONAS});
 assert.ok(fresh.summary.accuracy>=.85);assert.ok(fresh.summary.testRetestAgreement>=.8);assert.ok(fresh.summary.byGrade.find(row=>row.label==='Middle').recall>=.8);assert.ok(fresh.summary.overgraded<=.01);
 const safety=await evaluateGrades({split:'holdout',peoplePerGrade:20,seedNamespace:SAFETY_SEED,personas:SAFETY_PERSONAS.filter(row=>row.id!=='weak-practice')});
 assert.ok(safety.attempts.every(row=>row.repeats.every(result=>result.actual==='BelowJunior')));
 assert.notEqual(fresh.seedNamespace,(await evaluateGrades({peoplePerGrade:1,formsPerModule:2})).seedNamespace);
});

test('resume evidence handles denials, contractions, future plans, and mixed affirmative clauses',()=>{
 const report=evaluateResumeEvidence();assert.equal(report.n,16);assert.equal(report.passed,report.n,JSON.stringify(report.cases.filter(row=>!row.pass)));
});

test('upgrading saved specs creates a new revision and never changes the frozen v1 spec',async()=>{
 const legacy=structuredClone(DEFAULT_SPECS.find(s=>s.moduleId==='python'));
 legacy.id='saved-python-v6';legacy.version=6;legacy.scoring.rule=LEGACY_EVIDENCE_SCORING_RULE;legacy.scoring.routingCodingSolvedMin=0;legacy.thresholds={Junior:50,Middle:70,Senior:90};
 const snapshot=structuredClone(legacy),all=await specifications({records:async()=>[legacy]});
 const latest=all.filter(s=>s.moduleId==='python').sort((a,b)=>b.version-a.version)[0];
 assert.equal(latest.scoring.rule,SCORING_RULE);assert.deepEqual(latest.thresholds,DEFAULT_THRESHOLDS);assert.ok(latest.version>legacy.version);assert.deepEqual(legacy,snapshot);
 legacy.thresholds={Junior:44,Middle:67,Senior:88};
 const custom=await specifications({records:async()=>[legacy]});
 assert.deepEqual(custom.filter(s=>s.moduleId==='python').sort((a,b)=>b.version-a.version)[0].thresholds,legacy.thresholds);
 legacy.scoring.rule=LINEAR_CODING_SCORING_RULE;legacy.version=7;
 const previous=structuredClone(legacy),upgraded=await specifications({records:async()=>[legacy]});
 assert.equal(upgraded.filter(s=>s.moduleId==='python').sort((a,b)=>b.version-a.version)[0].scoring.rule,SCORING_RULE);
 assert.deepEqual(legacy,previous);
});
