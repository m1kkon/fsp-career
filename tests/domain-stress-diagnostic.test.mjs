import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {domainStressScenarios} from '../scripts/benchmarks/fixtures/domain-stress-v1.mjs';
import {diagnosticMetrics,verifyFrozenDiagnostic} from '../scripts/benchmarks/domain-stress-diagnostic.mjs';

const row=(id,relevance,truthEligibility='pass',score=100-id)=>({id:String(id),relevance,truthEligibility,score,lexical:score,stackCoverage:score,
 match:{score,strength:0,eligibility:{status:truthEligibility}}});

test('historical fixture remains intact and refuses the changed product implementation',async()=>{
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const freeze=JSON.parse(await readFile(new URL('../docs/domain-stress-freeze.json',import.meta.url))),fixtures=domainStressScenarios();
 assert.equal(freeze.evaluated,false);assert.equal(freeze.labelsAuthoredBeforeEvaluation,true);
 assert.equal(fixtures.length,12);assert.equal(fixtures.flatMap(s=>s.candidates).length,120);
 assert.equal(hash(JSON.stringify(fixtures)),freeze.expandedFixtureSha256);
 for(const [file,expected]of Object.entries(freeze.files))assert.equal(hash(await readFile(new URL('../'+file,import.meta.url))),expected);
 // A shallow CI checkout may not contain the historical source commit. Either
 // absence or a changed current implementation must prevent its reuse.
 await assert.rejects(verifyFrozenDiagnostic(),/Product changed from the frozen snapshot|Cannot verify product snapshot/);
});

test('primary binary relevance respects authored eligibility while text-only evidence is reported separately',()=>{
 const result=diagnosticMetrics([row(0,3),row(1,3,'fail'),row(2,3,'unknown'),row(3,1),row(4,0)]);
 assert.equal(result.precisionAtK,.2);assert.equal(result.textOnlyPrecisionAtFive,.6);
 assert.equal(result.invalidTopFive,2);assert.equal(result.precisionAtFiveCeiling,.2);
});

test('fewer than five relevant eligible profiles lowers the explicit precision ceiling without lowering recall',()=>{
 const ranked=[row(0,3),row(1,2),row(2,3),...Array.from({length:7},(_,i)=>row(i+3,0))];
 const result=diagnosticMetrics(ranked);
 assert.equal(result.precisionAtK,.6);assert.equal(result.precisionAtFiveCeiling,.6);
 assert.equal(result.recallAtK,1);assert.equal(result.fractionOfAvailableTopFiveRelevant,1);
});

test('graded ranking distinguishes strong and partial relevant evidence despite identical binary hits',()=>{
 const good=diagnosticMetrics([row(0,3),row(1,2),row(2,0)]);
 const swapped=diagnosticMetrics([row(1,2),row(0,3),row(2,0)]);
 assert.equal(good.precisionAtK,swapped.precisionAtK);
 assert.ok(good.gradedNdcgAtFive>swapped.gradedNdcgAtFive);
});

test('equal non-ID signals expose expected precision rather than treating deterministic IDs as quality',()=>{
 const ranked=[row(0,3,'pass',1),...Array.from({length:5},(_,i)=>row(i+1,0,'pass',1))];
 const result=diagnosticMetrics(ranked);
 assert.equal(result.precisionAtK,.2);
 assert.ok(Math.abs(result.tieAdjustedPrecisionAtK-1/6)<1e-12);
});
