import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SCORING,DEFAULT_THRESHOLDS,SCORING_RULE,LINEAR_CODING_SCORING_RULE,LEGACY_EVIDENCE_SCORING_RULE,answerCredit,difficultyAdjustedScore,evidenceScore,meetsModuleGrade} from '../lib/assessment-scoring.mjs';
import {mixedCodingSpec,adaptiveScore,LEGACY_MIXED_CODING_RULE,routingDecision} from '../lib/adaptive-testing.mjs';
import {roleGradeOutcome,LEGACY_PLUS_RULE} from '../lib/role-grade.mjs';
const thresholds={Junior:50,Middle:70,Senior:90};
const correct=(q,v)=>q.format==='coding'?v?.judged===true&&v.correct===true:v===1;
// Keep the original linear-scoring regression cases pinned to their v2 snapshot.
function moduleFixture({theory=28,passes=[5,5,5,5],route='advanced',linear=true}={}){
 const spec=mixedCodingSpec({thresholds:structuredClone(thresholds)});
 if(linear)spec.scoring.rule=LINEAR_CODING_SCORING_RULE;
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
test('advanced routing requires both a sufficient score and a fully solved first-part coding task',()=>{
 const m=moduleFixture();m.questions=m.questions.slice(0,14).concat(m.questions.slice(28,30));
 for(let i=0;i<14;i++)m.answers['t'+i].value=i<10?1:0;
 m.answers.c0.value={judged:true,passed:0,total:5,correct:false};m.answers.c1.value={judged:true,passed:0,total:5,correct:false};
 assert.equal(routingDecision(m,correct).route,'foundation');
 m.answers.c0.value={judged:true,passed:4,total:5,correct:false};
 assert.equal(routingDecision(m,correct).route,'foundation');
 m.answers.c0.value={judged:true,passed:5,total:5,correct:true};
 assert.equal(routingDecision(m,correct).route,'advanced');
});
test('legacy mixed scoring and plus outcomes keep their frozen weighted rules',()=>{
 const m=moduleFixture();delete m.spec.scoring;m.spec.adaptive.rule=LEGACY_MIXED_CODING_RULE;
 m.questions=[...Array.from({length:32},(_,i)=>({id:String(i),scored:true,difficulty:i<5?1:i<11?2:i<16?3:i<24?1:i<30?2:3}))];
 m.answers=Object.fromEntries(m.questions.map(q=>[q.id,{value:1}]));m.adaptive.selectedRoute='foundation';
 assert.equal(adaptiveScore(m,correct).maximumPoints,70);assert.equal(adaptiveScore(m,correct).score,83);
 const old={score:86,thresholds};assert.equal(roleGradeOutcome([old],'Middle',LEGACY_PLUS_RULE).status,'confirmed-plus');
 assert.equal(roleGradeOutcome([old],'Middle',LEGACY_PLUS_RULE).outcomeRule,LEGACY_PLUS_RULE);
 assert.equal(SCORING_RULE,'rasch-theory-practice-v3');
});

test('legacy evidence snapshots retain their score, routing, coding requirements and outcome',()=>{
 const m=moduleFixture({theory:20,passes:[4,4,4,4]});
 m.spec.scoring={...structuredClone(DEFAULT_SCORING),rule:LEGACY_EVIDENCE_SCORING_RULE,calibration:'provisional',routingCodingSolvedMin:0,
  grades:{Junior:{codingMin:40,plusCodingMin:60,difficultyMin:1,solvedMin:1,plusSolvedMin:1},Middle:{codingMin:60,plusCodingMin:80,difficultyMin:2,solvedMin:1,plusSolvedMin:1},Senior:{codingMin:80,plusCodingMin:90,difficultyMin:3,solvedMin:1,plusSolvedMin:1}}};
 assert.equal(routingDecision(m,correct).route,'advanced');
 const r=result(m);assert.equal(r.scoreRule,LEGACY_EVIDENCE_SCORING_RULE);
 assert.equal(r.gradeRequirements.Middle.codingMin,60);assert.equal(r.gradeRequirements.Middle.theoryMin,0);
 assert.equal(meetsModuleGrade(r,'Junior'),false);
});

test('new lower cutoffs never qualify theory-only, coding-only or all-partial answers',()=>{
 for(const linear of [true,false])for(const m of [moduleFixture({linear,passes:[0,0,0,0]}),moduleFixture({linear,theory:0}),moduleFixture({linear,passes:[4,4,4,4]})]){
  m.spec.thresholds=structuredClone(DEFAULT_THRESHOLDS);
  for(const grade of ['Junior','Middle','Senior'])assert.equal(meetsModuleGrade(result(m),grade),false);
 }
 const m=moduleFixture({theory:19,passes:[5,5,3,3]});m.spec.thresholds=structuredClone(DEFAULT_THRESHOLDS);
 assert.equal(meetsModuleGrade(result(m),'Middle'),true);assert.equal(meetsModuleGrade(result(m),'Senior'),false);
});

test('coding difficulty adjustment uses the actual tasks, exposes raw completion, and leaves foundation scoring unchanged',()=>{
 const hard=moduleFixture({linear:false,passes:[5,5,0,0]}),easy=moduleFixture({linear:false,passes:[5,5,0,0],route:'foundation'});
 const high=result(hard),low=result(easy);
 assert.equal(high.codingCompletion,50);assert.equal(low.codingCompletion,50);
 assert.equal(low.codingScore,50);assert.ok(high.codingScore>low.codingScore);
 assert.equal(high.codingScoreModel,'difficulty-adjusted-v1');
 hard.adaptive.selectedRoute='foundation';assert.equal(result(hard).scoreExact,high.scoreExact);
 hard.questions.push({id:'experimental',format:'coding',scored:false,difficulty:3,coding:{tests:Array(5).fill({})}});
 hard.answers.experimental={value:{judged:true,passed:5,total:5,correct:true}};assert.equal(result(hard).scoreExact,high.scoreExact);
});

test('an intermediate practical result is not failed solely because harder challenges were missed',()=>{
 const old=moduleFixture({theory:22,passes:[5,2,0,0]}),current=moduleFixture({linear:false,theory:22,passes:[5,2,0,0]});
 for(const m of [old,current])m.spec.thresholds=structuredClone(DEFAULT_THRESHOLDS);
 assert.equal(meetsModuleGrade(result(old),'Middle'),false);
 assert.equal(meetsModuleGrade(result(current),'Middle'),true);
 assert.equal(meetsModuleGrade(result(current),'Senior'),false);
 assert.equal(result(old).codingScore,35);assert.equal(result(old).codingCompletion,undefined);
});

test('current coding adjustment remains monotone and cannot award Senior without a fully solved hard task',()=>{
 let previous=-1;
 for(let credit=0;credit<=5;credit++){
  const r=result(moduleFixture({linear:false,passes:[credit,credit,credit,credit]}));
  assert.ok(r.scoreExact>previous);previous=r.scoreExact;
  if(credit<5)for(const grade of ['Junior','Middle','Senior'])assert.equal(meetsModuleGrade(r,grade),false);
 }
 const r=result(moduleFixture({linear:false,passes:[5,5,4,4]}));
 assert.ok(r.score>=90);assert.equal(meetsModuleGrade(r,'Senior'),false);
});
