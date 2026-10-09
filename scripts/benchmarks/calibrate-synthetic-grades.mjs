// Development-only diagnostic. Never edits policies, labels, or deployed data.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {evaluateGrades} from './synthetic-validation.mjs';
export const POLICIES=[
 {id:'baseline-policy',thresholds:{Junior:50,Middle:70,Senior:90},codingMin:{Junior:40,Middle:60,Senior:80},routingCodingSolvedMin:0},
 {id:'score-only',thresholds:{Junior:45,Middle:65,Senior:85},codingMin:{Junior:40,Middle:60,Senior:80},routingCodingSolvedMin:0},
 {id:'balanced-evidence',thresholds:{Junior:45,Middle:65,Senior:85},codingMin:{Junior:40,Middle:50,Senior:75},routingCodingSolvedMin:0},
 {id:'lower-cutoffs',thresholds:{Junior:40,Middle:60,Senior:85},codingMin:{Junior:30,Middle:50,Senior:75},routingCodingSolvedMin:0},
 {id:'readiness-only',thresholds:{Junior:50,Middle:70,Senior:90},codingMin:{Junior:40,Middle:60,Senior:80},routingCodingSolvedMin:1},
 {id:'readiness-balanced',thresholds:{Junior:45,Middle:65,Senior:85},codingMin:{Junior:40,Middle:50,Senior:75},routingCodingSolvedMin:1},
 {id:'readiness-lower',thresholds:{Junior:40,Middle:60,Senior:85},codingMin:{Junior:30,Middle:50,Senior:75},routingCodingSolvedMin:1},
 {id:'readiness-with-theory-guard',thresholds:{Junior:40,Middle:60,Senior:85},codingMin:{Junior:30,Middle:50,Senior:75},theoryMin:{Junior:35,Middle:55,Senior:75},routingCodingSolvedMin:1},
];
const results=[];
for(const policy of POLICIES){
 const report=await evaluateGrades({split:'development',policyOverride:policy});
 results.push({policy,summary:report.summary,byRole:report.byRole,formHash:report.formHash});
}
const output=resolve('output/validation/calibration');await mkdir(output,{recursive:true});await writeFile(output+'/policies.json',JSON.stringify({split:'development',selection:'readiness-with-theory-guard',reason:'Best tested guarded policy with overgrading below 1%; neither theory-only nor coding-only answers can qualify.',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({policy,summary})=>({policy:policy.id,accuracy:summary.accuracy,retestAgreement:summary.testRetestAgreement,overgraded:summary.overgraded})),null,2));
