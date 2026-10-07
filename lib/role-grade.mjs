import {meetsModuleGrade} from './assessment-scoring.mjs';
export const ROLE_GRADES=['Junior','Middle','Senior'];
export const LEGACY_PLUS_RULE='target-grade-five-outcomes-midpoint-v2';
export const ROLE_OUTCOME_RULE='target-grade-five-outcomes-evidence-v3';
const LEGACY_RULE='target-grade-next-achieved-v1';
const meets=(results,grade,rule)=>results.length>0&&results.every(r=>rule===ROLE_OUTCOME_RULE?meetsModuleGrade(r,grade):Number.isFinite(r.score)&&r.score>=r.thresholds[grade]);
export function rolePlusThreshold(thresholds,grade){
 const next=ROLE_GRADES[ROLE_GRADES.indexOf(grade)+1];
 return (thresholds[grade]+(next?thresholds[next]:100))/2;
}
export function roleGradeOutcome(results,targetGrade,rule=ROLE_OUTCOME_RULE){
 if(!ROLE_GRADES.includes(targetGrade))return {};
 const achieved=ROLE_GRADES.findLast(g=>meets(results,g,rule))||null;
 const confirmed=meets(results,targetGrade,rule),confirmedGrade=confirmed?targetGrade:achieved;
 const next=ROLE_GRADES[ROLE_GRADES.indexOf(targetGrade)+1];
 const potentialHigher=confirmed&&next&&meets(results,next,rule)?next:null;
 // Previously started attempts retain their original interpretation.
 if(rule===LEGACY_RULE)return {targetGrade,confirmedGrade,potentialHigher,status:confirmed?(potentialHigher?'confirmed-potential':'confirmed'):'unconfirmed-lower',outcomeRule:LEGACY_RULE};
 const confirmedPlus=!!confirmedGrade&&results.every(r=>rule===ROLE_OUTCOME_RULE?meetsModuleGrade(r,confirmedGrade,true):r.score>=rolePlusThreshold(r.thresholds,confirmedGrade));
 const status=confirmed?(potentialHigher?'confirmed-plus-potential':confirmedPlus?'confirmed-plus':'confirmed'):confirmedGrade?'unconfirmed-lower':'unconfirmed';
 return {targetGrade,confirmedGrade,confirmedPlus,potentialHigher,status,outcomeRule:rule,
  plusThresholds:confirmedGrade?results.map(r=>({moduleId:r.moduleId,grade:confirmedGrade,threshold:rolePlusThreshold(r.thresholds,confirmedGrade)})):[]};
}
