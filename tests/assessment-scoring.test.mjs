import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SCORING,SCORING_RULE,answerCredit,difficultyAdjustedScore,evidenceScore,meetsModuleGrade} from '../lib/assessment-scoring.mjs';
import {mixedCodingSpec,adaptiveScore,LEGACY_MIXED_CODING_RULE,routingDecision} from '../lib/adaptive-testing.mjs';
import {roleGradeOutcome,LEGACY_PLUS_RULE} from '../lib/role-grade.mjs';
const thresholds={Junior:50,Middle:70,Senior:90};
const correct=(q,v)=>q.format==='coding'?v?.judged===true&&v.correct===true:v===1;
function moduleFixture({theory=28,passes=[5,5,5,5],route='advanced'}={}){
 const spec=mixedCodingSpec({thresholds:structuredClone(thresholds)});
 const questions=[...Array.from({length:28},(_,i)=>({id:'t'+i,format:'choice',scored:true,difficulty:2})),...[2,2,route==='advanced'?3:1,route==='advanced'?3:1].map((difficulty,i)=>({id:'c'+i,format:'coding',scored:true,difficulty,coding:{tests:Array(5).fill({})}}))];
 const answers=Object.fromEntries(questions.map((q,i)=>[q.id,{value:q.format==='coding'?{judged:true,source:'server snapshot',passed:passes[i-28],total:5,correct:passes[i-28]===5}:i<theory?1:null}]));
 return {spec,questions,answers,adaptive:{selectedRoute:route}};
}
const result=m=>({...evidenceScore(m,correct),thresholds});
test('the same modeled ability maps to the same theory score across easy, hard and mixed forms',()=>{
 for(const theta of [-2,-.5,0,.7,2]){
  for(const difficulties of [Array(28).fill(1),Array(28).fill(3),Array.from({length:28},(_,i)=>i%3+1)]){
   const items=difficulties.map(d=>({difficulty:d,credit:1/(1+Math.exp(-(theta-DEFAULT_SCORING.difficultyAnchors[d])))}));
   assert.ok(Math.abs(difficultyAdjustedScore(items,DEFAULT_SCORING.difficultyAnchors)-100/(1+Math.exp(-theta)))<1e-8);
  }
 }
});
test('more correct answers increase the score; harder forms require fewer correct answers for the same ability',()=>{
 const score=(d,n)=>difficultyAdjustedScore(Array.from({length:28},(_,i)=>({difficulty:d,credit:i<n?1:0})),DEFAULT_SCORING.difficultyAnchors);
 assert.equal(score(1,0),0);assert.equal(score(3,28),100);
 for(let n=1;n<28;n++)assert.ok(score(2,n)>score(2,n-1));
 assert.ok(score(3,14)>score(1,14));
});
test('route labels do not alter a fixed form score and experiments do not affect it',()=>{
 const m=moduleFixture({theory:20,passes:[5,4,3,0]});const before=result(m);
 m.adaptive.selectedRoute='foundation';assert.equal(result(m).scoreExact,before.scoreExact);
 m.questions.push({id:'exp',format:'coding',scored:false,difficulty:3,coding:{tests:Array(5).fill({})}});
 m.answers.exp={value:{judged:true,correct:true,passed:5,total:5}};
 assert.equal(result(m).scoreExact,before.scoreExact);
});
test('perfect theory with all coding skipped awards no qualification or higher potential',()=>{
 const r=result(moduleFixture({passes:[0,0,0,0]}));assert.equal(r.score,60);assert.equal(r.theoryScore,100);assert.equal(r.codingScore,0);
 for(const g of ['Junior','Middle','Senior'])assert.equal(meetsModuleGrade(r,g),false);
 assert.equal(roleGradeOutcome([r,result(moduleFixture())],'Middle').status,'unconfirmed');
});
test('coding awards partial credit per task rather than per check, using only verified judge snapshots',()=>{
 const q={format:'coding',coding:{tests:Array(5).fill({})}};
 assert.equal(answerCredit(q,{judged:true,correct:false,passed:4,total:5},correct),.8);
 for(const v of [{judged:false,passed:5,total:5},{judged:true,passed:5,total:4},{judged:true,passed:6,total:5},{judged:true,passed:-1,total:5},{judged:true,passed:2.5,total:5}])assert.equal(answerCredit(q,v,correct),0);
 const m=moduleFixture({passes:[5,4,0,0]});let r=result(m);assert.equal(r.codingScore,45);assert.equal(r.score,78);assert.equal(meetsModuleGrade(r,'Junior'),true);assert.equal(meetsModuleGrade(r,'Middle'),false);
 m.questions[29].coding.tests=Array(10).fill({});m.answers.c1.value={judged:true,passed:8,total:10,correct:false};r=result(m);assert.equal(r.codingScore,45);
});
test('a grade needs a fully solved task of sufficient difficulty even when aggregate scores are high',()=>{
 let r=result(moduleFixture({passes:[4,4,4,4]}));assert.equal(r.score,92);assert.equal(meetsModuleGrade(r,'Junior'),false);
 r=result(moduleFixture({passes:[5,5,4,4]}));assert.equal(r.score,96);assert.equal(meetsModuleGrade(r,'Middle',true),true);assert.equal(meetsModuleGrade(r,'Senior'),false);
 assert.equal(roleGradeOutcome([r],'Middle').potentialHigher,null);
 r=result(moduleFixture());assert.equal(meetsModuleGrade(r,'Senior',true),true);assert.equal(roleGradeOutcome([r],'Middle').status,'confirmed-plus-potential');
 r=result(moduleFixture({route:'foundation'}));assert.equal(meetsModuleGrade(r,'Senior'),false);
});
test('rounding for display cannot push an insufficient score over a grade boundary',()=>{
 const m=moduleFixture({theory:25,passes:[5,5,5,4]});const raw=result(m).scoreExact;
 m.spec.thresholds.Middle=raw+.01;m.spec.thresholds.Senior=100;
 const r=result(m);assert.equal(r.score,Math.round(raw*10)/10);assert.equal(meetsModuleGrade(r,'Middle'),false);
});
test('partial coding evidence participates in first-part routing',()=>{
 const m=moduleFixture();m.questions=m.questions.slice(0,14).concat(m.questions.slice(28,30));
 for(let i=0;i<14;i++)m.answers['t'+i].value=i<10?1:0;
 m.answers.c0.value={judged:true,passed:0,total:5,correct:false};m.answers.c1.value={judged:true,passed:0,total:5,correct:false};
 assert.equal(routingDecision(m,correct).route,'foundation');
 m.answers.c0.value={judged:true,passed:4,total:5,correct:false};
 assert.equal(routingDecision(m,correct).route,'advanced');
});
test('legacy mixed scoring and plus outcomes keep their frozen weighted rules',()=>{
 const m=moduleFixture();delete m.spec.scoring;m.spec.adaptive.rule=LEGACY_MIXED_CODING_RULE;
 m.questions=[...Array.from({length:32},(_,i)=>({id:String(i),scored:true,difficulty:i<5?1:i<11?2:i<16?3:i<24?1:i<30?2:3}))];
 m.answers=Object.fromEntries(m.questions.map(q=>[q.id,{value:1}]));m.adaptive.selectedRoute='foundation';
 assert.equal(adaptiveScore(m,correct).maximumPoints,70);assert.equal(adaptiveScore(m,correct).score,83);
 const old={score:86,thresholds};assert.equal(roleGradeOutcome([old],'Middle',LEGACY_PLUS_RULE).status,'confirmed-plus');
 assert.equal(roleGradeOutcome([old],'Middle',LEGACY_PLUS_RULE).outcomeRule,LEGACY_PLUS_RULE);
 assert.equal(SCORING_RULE,'rasch-theory-practice-v1');
});
