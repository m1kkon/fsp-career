export const ROLE_GRADES=['Junior','Middle','Senior'];
export const ROLE_OUTCOME_RULE='target-grade-five-outcomes-midpoint-v2';
const LEGACY_RULE='target-grade-next-achieved-v1';
const meets=(results,grade)=>results.length>0&&results.every(r=>Number.isFinite(r.score)&&r.score>=r.thresholds[grade]);
export function rolePlusThreshold(thresholds,grade){
 const next=ROLE_GRADES[ROLE_GRADES.indexOf(grade)+1];
 return (thresholds[grade]+(next?thresholds[next]:100))/2;
}
export function roleGradeOutcome(results,targetGrade,rule=ROLE_OUTCOME_RULE){
 if(!ROLE_GRADES.includes(targetGrade))return {};
 const achieved=ROLE_GRADES.findLast(g=>meets(results,g))||null;
 const confirmed=meets(results,targetGrade),confirmedGrade=confirmed?targetGrade:achieved;
 const next=ROLE_GRADES[ROLE_GRADES.indexOf(targetGrade)+1];
 const potentialHigher=confirmed&&next&&meets(results,next)?next:null;
 // Previously started attempts retain their original interpretation.
 if(rule===LEGACY_RULE)return {targetGrade,confirmedGrade,potentialHigher,status:confirmed?(potentialHigher?'confirmed-potential':'confirmed'):'unconfirmed-lower',outcomeRule:LEGACY_RULE};
 const confirmedPlus=!!confirmedGrade&&results.every(r=>r.score>=rolePlusThreshold(r.thresholds,confirmedGrade));
 const status=confirmed?(potentialHigher?'confirmed-plus-potential':confirmedPlus?'confirmed-plus':'confirmed'):confirmedGrade?'unconfirmed-lower':'unconfirmed';
 return {targetGrade,confirmedGrade,confirmedPlus,potentialHigher,status,outcomeRule:ROLE_OUTCOME_RULE,
  plusThresholds:confirmedGrade?results.map(r=>({moduleId:r.moduleId,grade:confirmedGrade,threshold:rolePlusThreshold(r.thresholds,confirmedGrade)})):[]};
}
