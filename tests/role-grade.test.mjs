import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roleGradeOutcome,rolePlusThreshold,ROLE_OUTCOME_RULE} from '../lib/role-grade.mjs';
const results=(...scores)=>scores.map((score,i)=>({moduleId:'module-'+i,score,thresholds:{Junior:50,Middle:70,Senior:90}}));
test('all five target-grade outcomes are distinct and include a plus on the fallback when achieved',()=>{
 const cases=[
  {scores:[90,95],status:'confirmed-plus-potential',grade:'Middle',plus:true,potential:'Senior'},
  {scores:[80,89],status:'confirmed-plus',grade:'Middle',plus:true,potential:null},
  {scores:[70,79],status:'confirmed',grade:'Middle',plus:false,potential:null},
  {scores:[60,69],status:'unconfirmed-lower',grade:'Junior',plus:true,potential:null},
  {scores:[50,59],status:'unconfirmed-lower',grade:'Junior',plus:false,potential:null},
  {scores:[49,95],status:'unconfirmed',grade:null,plus:false,potential:null},
 ];
 for(const c of cases){const outcome=roleGradeOutcome(results(...c.scores),'Middle');assert.equal(outcome.status,c.status);assert.equal(outcome.confirmedGrade,c.grade);assert.equal(outcome.confirmedPlus,c.plus);assert.equal(outcome.potentialHigher,c.potential);assert.equal(outcome.outcomeRule,ROLE_OUTCOME_RULE);}
});
test('no strong module compensates for a weaker required or integration module',()=>{
 assert.equal(roleGradeOutcome(results(100,100,100,79),'Middle').status,'confirmed');
 assert.equal(roleGradeOutcome(results(100,100,100,89),'Middle').status,'confirmed-plus');
 assert.equal(roleGradeOutcome(results(100,100,100,69),'Middle').confirmedGrade,'Junior');
 assert.equal(roleGradeOutcome(results(100,100,100,49),'Middle').status,'unconfirmed');
});
test('plus boundaries use each module own thresholds and Senior midpoint to 100',()=>{
 assert.equal(rolePlusThreshold({Junior:50,Middle:70,Senior:90},'Junior'),60);
 assert.equal(rolePlusThreshold({Junior:50,Middle:70,Senior:90},'Middle'),80);
 assert.equal(rolePlusThreshold({Junior:50,Middle:70,Senior:90},'Senior'),95);
 const different=[{score:80,thresholds:{Junior:50,Middle:70,Senior:90}},{score:85,thresholds:{Junior:40,Middle:80,Senior:90}}];
 assert.equal(roleGradeOutcome(different,'Middle').confirmedPlus,true);different[1].score=84;
 assert.equal(roleGradeOutcome(different,'Middle').confirmedPlus,false);
 assert.equal(roleGradeOutcome(results(94,100),'Senior').status,'confirmed');
 assert.equal(roleGradeOutcome(results(95,100),'Senior').status,'confirmed-plus');
 assert.equal(roleGradeOutcome(results(100,100),'Senior').potentialHigher,null);
});
test('old attempts retain their rule and empty or invalid results award no grade',()=>{
 const legacy=roleGradeOutcome(results(95,95),'Middle','target-grade-next-achieved-v1');
 assert.equal(legacy.status,'confirmed-potential');assert.equal(legacy.confirmedPlus,undefined);
 assert.equal(roleGradeOutcome([],'Middle').status,'unconfirmed');
 assert.equal(roleGradeOutcome(results(Infinity,100),'Middle').status,'unconfirmed');
 assert.deepEqual(roleGradeOutcome(results(90),'Invalid'),{});
});
