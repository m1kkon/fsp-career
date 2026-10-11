import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessmentAction,assessmentState,assessmentView,maintainerState,assemble,correctAnswer,parseNumeric,validateQuestion,bank,assembleVariant,assembleAdaptiveVariant,specifications,ensureDailyPool,dailyPoolWindow,DAILY_POOL_REVISION} from '../lib/assessments.mjs';
import {MODULES,ROLES,INITIAL_QUESTIONS,DEFAULT_SPECS as ADAPTIVE_SPECS} from '../lib/question-bank.mjs';
const DEFAULT_SPECS=MODULES.map(m=>({id:`spec-${m.id}-v2`,moduleId:m.id,version:2,scoredCount:6,difficultyCounts:{1:2,2:2,3:2},competencies:m.competencies,numericMin:1,numericMax:3,questionSeconds:20,seconds:120,experimentalSeconds:20,thresholds:{Junior:50,Middle:70,Senior:90},created:0}));
import {MIXED_CODING_QUESTIONS,MIXED_CODING_SOLUTIONS} from '../lib/mixed-coding-bank.mjs';
import {SCORING_RULE} from '../lib/assessment-scoring.mjs';
import {ROLE_OUTCOME_RULE} from '../lib/role-grade.mjs';
import {BANK_EXPANSION} from '../lib/question-bank-expansion.mjs';
function memory(){const records=new Map(),accounts=new Map(),copy=x=>x?structuredClone(x):null;return{records:async k=>[...records.values()].filter(x=>x.kind===k).map(copy),scoped:async(k,o)=>[...records.values()].filter(x=>x.kind===k&&(x.owner===o||x.recipient===o)).map(copy),record:async id=>copy(records.get(id)),saveDay:async(r,v,status)=>{const old=records.get(r.id);if(old?.kind!=='test-day'||old.version!==v||old.status!==status)return false;records.set(r.id,{...copy(r),kind:'test-day'});return true;},cancelRegistration:async(id,owner,at)=>{const r=records.get(id);if(r?.kind!=='assessment-registration'||r.owner!==owner||r.status!=='registered')return false;records.set(id,{...copy(r),status:'cancelled',cancelledAt:at});return true;},setAssessmentVisibility:async(id,owner,hidden,at)=>{const r=records.get(id);if(r?.kind!=='assessment'||r.owner!==owner||!['finished','incomplete'].includes(r.status))return false;records.set(id,{...copy(r),hiddenFromHistory:hidden,hiddenAt:hidden?at:null});return true;},startAssessment:async(t,r)=>{if((r&&records.get(r.id)?.status!=='registered')||[...records.values()].some(x=>x.kind==='assessment'&&x.owner===t.owner&&x.status==='active'))return false;records.set(t.id,{...copy(t),kind:'assessment'});if(r)records.set(r.id,{...copy(r),status:'started',attemptId:t.id});return true;},put:async(k,r)=>records.set(r.id,{...copy(r),kind:k}),putIfAbsent:async(k,r)=>{if(!records.has(r.id))records.set(r.id,{...copy(r),kind:k});return copy(records.get(r.id));},saveAssessment:async(r,v)=>{const old=records.get(r.id);if(!old||old.status!=='active'||old.owner!==r.owner||old.revision!==v)return false;records.set(r.id,{...copy(r),kind:'assessment'});return true;},saveAccount:async a=>accounts.set(a.id,copy(a)),account:async id=>copy(accounts.get(id))};}
const candidate=()=>({id:'candidate',roles:['candidate'],profile:{name:'Candidate',verified:false},maintainer:false});
const admin={id:'maintainer',roles:['candidate'],maintainer:true};
// Historical sessions keep their six-question snapshots; adaptive sessions use current specifications.
async function day(repo,experimentalCounts={},moduleIds=MODULES.map(m=>m.id),adaptive=false){
 let dayId;
 if(adaptive||(await repo.records('module-spec')).length){
  ({dayId}=await assessmentAction(repo,admin,{action:'maintainer-day-save',name:'Сессия',opensAt:Date.now()+10000,closesAt:Date.now()+86400000,experimentalCounts,moduleIds,tools:'Без внешних инструментов'}));
 }else{
  dayId=crypto.randomUUID();const specs=DEFAULT_SPECS.filter(s=>moduleIds.includes(s.moduleId));
  const all=(await bank(repo)).filter(q=>!q.seedOrigin&&['working','experimental'].includes(q.status)).map(q=>({...q,scored:q.status==='working'}));
  const pool=specs.flatMap(spec=>{const available=all.filter(q=>q.moduleId===spec.moduleId),assigned=assembleVariant(available,spec,experimentalCounts[spec.moduleId]||0),ids=new Set(assigned.map(q=>q.id));return [...assigned,...available.filter(q=>q.scored&&!ids.has(q.id)).slice(0,2)];});
  await repo.put('test-day',{id:dayId,owner:admin.id,name:'Историческая сессия',opensAt:Date.now()+10000,closesAt:Date.now()+86400000,created:Date.now(),status:'draft',version:1,breakSeconds:0,experimentalCounts:Object.fromEntries(moduleIds.map(id=>[id,experimentalCounts[id]||0])),moduleIds,specs,pool,tools:'Без внешних инструментов'});
 }
 await assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId});const d=await repo.record(dayId);d.opensAt=Date.now()-1000;await repo.put('test-day',d);return d;
}
async function start(repo,a,d,targetId){const {registration}=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId});return(await assessmentAction(repo,a,{action:'assessment-start',registrationId:registration.id,rulesAccepted:true})).assessment;}
const correctTestAnswer=q=>q.format==='coding'?'correct-code-fixture':q.format==='choice'?q.correct:String(q.numeric.expected);
async function answer(repo,a,id,q,value){const t=await repo.record(id);
 // Assembly/routing tests seed the result of the separately tested Docker judge.
 if(q.format==='coding'&&value==='correct-code-fixture'){const m=t.modules[t.moduleIndex];m.answers[q.id]={value:{source:'judge fixture',judged:true,correct:true,passed:q.coding.tests.length,total:q.coding.tests.length},savedAt:Date.now()};m.expiresAt=Date.now()-1;await repo.put('assessment',t);return(await assessmentAction(repo,a,{action:'assessment-resume',id})).assessment;}
 return(await assessmentAction(repo,a,{action:'assessment-answer',id,revision:t.revision,questionId:q.id,answer:value,activeMs:3000})).assessment;}
async function complete(repo,a,id,allCorrect=true){const t=await repo.record(id),m=t.modules[t.moduleIndex],index=m.questions.findIndex(q=>q.id===m.activeQuestionId);let view;for(const q of m.questions.slice(index))view=await answer(repo,a,id,q,allCorrect?(correctTestAnswer(q)):null);return view;}

test('initial bank has 1800 unique fixed questions, 12 skills and 6 integration modules',()=>{assert.equal(INITIAL_QUESTIONS.length,1800);assert.equal(MODULES.filter(m=>!m.integration).length,12);assert.equal(MODULES.filter(m=>m.integration).length,6);assert.equal(ROLES.length,6);assert.equal(new Set(INITIAL_QUESTIONS.map(q=>q.id)).size,1800);assert.ok(INITIAL_QUESTIONS.every(q=>q.status==='working'));for(const q of INITIAL_QUESTIONS){assert.ok(validateQuestion(q));assert.ok(correctAnswer(q,q.format==='choice'?q.correct:q.numeric.expected));}});
test('each module has exactly 100 working questions covering all competencies, difficulties and formats',()=>{
 for(const m of MODULES){
  const qs=INITIAL_QUESTIONS.filter(q=>q.moduleId===m.id);
  assert.equal(qs.length,100,m.id);
  assert.ok(qs.every(q=>q.status==='working'));
  for(const c of m.competencies)assert.ok(qs.some(q=>q.competencies.includes(c)),`${m.id}: ${c}`);
  for(const d of [1,2,3])assert.ok(qs.some(q=>q.difficulty===d),`${m.id}: difficulty ${d}`);
  for(const format of ['choice','numeric'])assert.ok(qs.some(q=>q.format===format));
 }
 assert.equal(INITIAL_QUESTIONS.filter(q=>!q.seedOrigin&&q.format==='numeric').length,76);
});
test('the 96 added instances introduce distinct families and declare the skills they integrate',()=>{
 const added=Object.entries(BANK_EXPANSION).flatMap(([moduleId,rows])=>rows.map(([family])=>INITIAL_QUESTIONS.find(q=>q.id===`bank-${moduleId}-${family}-v1`)));
 assert.equal(added.length,96);
 assert.equal(new Set(added.map(q=>q.familyId)).size,96);
 for(const q of added){
  assert.equal(INITIAL_QUESTIONS.filter(other=>other.familyId===q.familyId).length,1,q.id);
  const m=MODULES.find(m=>m.id===q.moduleId);
  if(m.integration){assert.ok(q.skills.length>=2,q.id);assert.deepEqual(q.competencies,q.skills);assert.ok(q.skills.every(s=>m.skills.includes(s)));}
 }
});
test('new numeric keys match independent calculations, including negative division and fractional answers',()=>{
 const calculations={
  'python:negative-floor-division':Math.floor(-7/3),
  'javascript:optional-call-short-circuit':(()=>{let calls=0;const service=null;service?.send(++calls);return calls;})(),
  'sql:sum-ignores-null':[10,null,20,null].filter(x=>x!==null).reduce((a,b)=>a+b,0),
  'browser:em-parent-font-size':20*1.5,
  'statistics:conditional-probability':10/40*100,
  'statistics:pooled-conversion-rate':(10+90)/(100+300)*100,
  'ml:accuracy-confusion':(30+50)/(30+50+10+10)*100,
  'ml-engineering:padding-token-overhead':[3,5,8].reduce((sum,length)=>sum+8-length,0),
  'test-design:transition-edge-coverage':new Set(['created-paid','paid-shipped','paid-cancelled']).size,
  'automation:ci-shard-work-count':24/4,
  'integration-backend:sql-python-line-total':[[2,30],[1,40]].reduce((sum,[quantity,price])=>sum+quantity*price,0),
  'integration-backend:api-limit-extra-row':Math.min(6,5),
  'integration-frontend:js-react-page-slice':Array.from({length:10},(_,i)=>i+1).slice(3,6).length,
  'integration-frontend:react-css-two-columns':(420-20)/2,
  'integration-qa:qa-filtered-fixture-count':[true,true,true,true,true,false,false,false].filter(Boolean).length,
  'integration-qa:qa-boundary-param-count':[17,18,19,59,60,61].filter(age=>age>=18&&age<=60).length,
  'integration-devops:python-ci-check-count':[0,1,0,2,0].filter(code=>code!==0).length,
  'integration-devops:python-backoff-total-delay':[1,2,4].reduce((a,b)=>a+b,0),
  'integration-ds:python-sql-mse':[[2,1],[4,3]].reduce((sum,[actual,predicted])=>sum+(actual-predicted)**2,0)/2,
  'integration-ds:sql-python-weighted-baseline':(0*3+10*1)/(3+1),
  'integration-mle:python-serving-threshold-count':[0.2,0.6,0.9,0.4].filter(p=>p>=0.6).length,
  'integration-mle:python-serving-cache-hits':10-4,
 };
 const addedNumeric=Object.entries(BANK_EXPANSION).flatMap(([id,rows])=>rows.filter(row=>row.length===5).map(row=>`${id}:${row[0]}`));
 assert.deepEqual(Object.keys(calculations).sort(),addedNumeric.sort());
 for(const [familyId,expected] of Object.entries(calculations)){
  const q=INITIAL_QUESTIONS.find(q=>q.familyId===familyId);
  assert.equal(q.numeric.expected,expected,familyId);
  assert.ok(correctAnswer(q,String(expected).replace('.',',')),familyId);
  assert.equal(correctAnswer(q,String(expected+1)),false,familyId);
 }
});
test('every module assembles the full common specification, without duplicate families',()=>{for(const spec of DEFAULT_SPECS){for(let i=0;i<8;i++){const qs=assemble(INITIAL_QUESTIONS.filter(q=>q.moduleId===spec.moduleId),spec);assert.equal(qs.length,spec.scoredCount);assert.equal(new Set(qs.map(q=>q.familyId)).size,qs.length);for(const d of [1,2,3])assert.equal(qs.filter(q=>q.difficulty===d).length,spec.difficultyCounts[d]);for(const c of spec.competencies)assert.ok(qs.some(q=>q.competencies.includes(c)));assert.ok(qs.filter(q=>q.format==='numeric').length>=spec.numericMin);}}});
test('numeric grading supports comma, scientific notation, rounding and tolerance; rejects expressions',()=>{assert.equal(parseNumeric('1,5'),1.5);assert.equal(parseNumeric('2e2'),200);for(const bad of ['','Infinity','NaN','1/2','1 + 1','0x10','1,2,3'])assert.equal(parseNumeric(bad),null);const q={format:'numeric',numeric:{expected:1.23,tolerance:0,decimals:2,equivalents:[]}};assert.equal(correctAnswer(q,'1.234'),true);assert.equal(correctAnswer(q,'1.236'),false);assert.equal(correctAnswer({...q,numeric:{...q.numeric,tolerance:.01,decimals:null}},'1,24'),true);});
test('maintainer authorization cannot be forged by body or candidate role',async()=>{const repo=memory(),a=candidate();for(const action of ['maintainer-state','maintainer-day-save','maintainer-question-save'])await assert.rejects(assessmentAction(repo,a,{action,maintainer:true,role:'maintainer'}),e=>e.status===403);});
test('new questions start as drafts and content review is required before experimentation',async()=>{const repo=memory();const input=INITIAL_QUESTIONS.find(q=>q.moduleId==='python');const {question}=await assessmentAction(repo,admin,{action:'maintainer-question-save',question:input});assert.equal(question.status,'draft');await assert.rejects(assessmentAction(repo,admin,{action:'maintainer-question-decision',id:question.id,decision:'experiment',reason:'Проверен корректный ключ'}));await assessmentAction(repo,admin,{action:'maintainer-question-decision',id:question.id,decision:'experiment',reviewed:true,reason:'Проверены условие и корректный ключ'});assert.equal((await repo.record(question.id)).status,'experimental');await assert.rejects(assessmentAction(repo,admin,{action:'maintainer-question-decision',id:question.id,decision:'admit',difficulty:0,reason:'Достаточные измерительные свойства'}));});
test('day requires a complete blueprint and is immutable after publication',async()=>{const repo=memory();const {dayId}=await assessmentAction(repo,admin,{action:'maintainer-day-save',name:'Неполный пул',opensAt:Date.now()+10000,closesAt:Date.now()+86400000,moduleIds:['python'],questionIds:[INITIAL_QUESTIONS[0].id]});await assert.rejects(assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId}));const d=await day(repo);await assert.rejects(assessmentAction(repo,admin,{action:'maintainer-day-publish',id:d.id}));});
test('candidate must register and accept rules, can start only during session',async()=>{const repo=memory(),a=candidate(),d=await day(repo);const {registration}=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId:'python'});await assert.rejects(assessmentAction(repo,a,{action:'assessment-start',registrationId:registration.id}));d.opensAt=Date.now()+100000;await repo.put('test-day',d);await assert.rejects(assessmentAction(repo,a,{action:'assessment-start',registrationId:registration.id,rulesAccepted:true}));});
test('all assigned modules are fixed before start; resume preserves questions, deadline and revision',async()=>{const repo=memory(),a=candidate(),d=await day(repo);const attempt=await start(repo,a,d,'backend-developer');assert.equal(attempt.modules.length,4);assert.ok(attempt.currentModule.questions.slice(1).every(q=>q.prompt===undefined&&q.options===undefined));const raw=await repo.record(attempt.id);assert.ok(raw.modules.every(m=>m.questions.length===6));const resumed=(await assessmentAction(repo,a,{action:'assessment-resume',id:attempt.id})).assessment;const expected=assessmentView(raw);assert.deepEqual({...resumed,serverTime:0},{...expected,serverTime:0});assert.ok(resumed.serverTime>=attempt.serverTime);assert.equal(resumed.currentModule.expiresAt,attempt.currentModule.expiresAt);const serialized=JSON.stringify(attempt);assert.ok(!serialized.includes('"correct":'));assert.ok(!serialized.includes('"numeric":'));assert.ok(!serialized.includes('"scored":'));assert.ok(!serialized.includes('"familyId":'));assert.ok(!serialized.includes('"status":"experimental"'));});
test('confirmation closes only the current question; previous and future questions cannot be reopened',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'python');const raw=await repo.record(view.id),q=raw.modules[0].questions[0],future=raw.modules[0].questions[2];assert.equal(view.currentModule.questionSeconds,20);assert.equal(view.currentModule.expiresAt-view.currentModule.questionStartedAt,20000);await assert.rejects(answer(repo,a,view.id,future,null),e=>e.status===409);let r=await answer(repo,a,view.id,q,correctTestAnswer(q));assert.equal(r.currentModule.questionIndex,1);assert.equal(r.currentModule.expiresAt-r.currentModule.questionStartedAt,20000);await assert.rejects(answer(repo,a,view.id,q,null),e=>e.status===409);const current=await repo.record(view.id);await assert.rejects(assessmentAction(repo,a,{action:'assessment-view',id:view.id,revision:current.revision,questionId:q.id}),e=>e.status===409);await assert.rejects(assessmentAction(repo,a,{action:'assessment-submit-module',id:view.id,revision:current.revision}),e=>e.status===409);r=await complete(repo,a,view.id);assert.equal(r.results[0].score,100);assert.equal(r.currentModule,null);assert.equal(a.profile.verified,false);});

test('foreign candidates and invalid choices cannot write to an attempt',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'sql');let t=await repo.record(view.id);while(t.modules[0].questions.find(q=>q.id===t.modules[0].activeQuestionId).format!=='choice'){await answer(repo,a,view.id,t.modules[0].questions.find(q=>q.id===t.modules[0].activeQuestionId),null);t=await repo.record(view.id);}const q=t.modules[0].questions.find(q=>q.id===t.modules[0].activeQuestionId);await assert.rejects(assessmentAction(repo,{...candidate(),id:'other'},{action:'assessment-resume',id:view.id}));await assert.rejects(answer(repo,a,view.id,q,4));await assert.rejects(answer(repo,a,view.id,q,-1));});
test('concurrent saves use compare-and-swap revision; only one wins',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'sql'),q=view.currentModule.questions[0];const results=await Promise.allSettled([0,1].map(answer=>assessmentAction(repo,a,{action:'assessment-answer',id:view.id,revision:view.revision,questionId:q.id,answer})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await repo.record(view.id)).revision,1);});
test('expiry skips one question, gives the next its own timer and rejects a late answer',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'python');const raw=await repo.record(view.id),q=raw.modules[0].questions[0];raw.modules[0].expiresAt=Date.now()-10000;await repo.put('assessment',raw);await assert.rejects(answer(repo,a,view.id,q,correctTestAnswer(q)),e=>e.status===409);const resumed=(await assessmentAction(repo,a,{action:'assessment-resume',id:view.id})).assessment;assert.equal(resumed.status,'active');assert.equal(resumed.currentModule.questionIndex,1);assert.equal(resumed.currentModule.answers[q.id],null);assert.equal(resumed.currentModule.expiresAt-resumed.currentModule.questionStartedAt,20000);assert.equal((await repo.record(view.id)).modules[0].answers[q.id].timedOut,true);const deadline=resumed.currentModule.expiresAt;const again=(await assessmentAction(repo,a,{action:'assessment-resume',id:view.id})).assessment;assert.equal(again.currentModule.expiresAt,deadline);const finished=await complete(repo,a,view.id,false);assert.equal(finished.status,'finished');assert.equal(finished.results[0].score,0);});

test('role progresses after failure; required module thresholds cannot be compensated',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'devops-engineer');let r=await complete(repo,a,view.id,false);assert.equal(r.status,'active');for(let i=1;i<3;i++){const t=await repo.record(view.id);r=(await assessmentAction(repo,a,{action:'assessment-next-module',id:t.id,revision:t.revision})).assessment;r=await complete(repo,a,view.id,true);}assert.equal(r.status,'finished');assert.equal(r.roleResult.level,'Ниже Junior');assert.equal(r.results.length,3);assert.equal(r.roleResult.integration.score,100);assert.equal(a.profile.verified,false);});
test('full role retains full module results and separate integration score',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'backend-developer');let r;for(let i=0;i<4;i++){if(i){const t=await repo.record(view.id);await assessmentAction(repo,a,{action:'assessment-next-module',id:t.id,revision:t.revision});}r=await complete(repo,a,view.id);}assert.equal(r.roleResult.level,'Senior');assert.equal(r.results.length,4);assert.equal(a.profile.grade,'Senior');assert.ok(r.results.every(r=>r.total===6));const s=await assessmentState(repo,a);assert.equal(s.history[0].results.length,4);});
test('abandoned roles are incomplete, keep finished skills and do not lower qualification',async()=>{const repo=memory(),a=candidate();a.profile={verified:true,grade:'Middle',spec:'Backend',score:80};const d=await day(repo),v=await start(repo,a,d,'backend-developer');await complete(repo,a,v.id);const t=await repo.record(v.id);const r=(await assessmentAction(repo,a,{action:'assessment-abandon',id:t.id,revision:t.revision})).assessment;assert.equal(r.status,'incomplete');assert.equal(r.roleResult.level,null);assert.equal(r.results.length,1);assert.equal(a.profile.grade,'Middle');});
test('experimental items are additive, hidden, excluded and never become scored retroactively',async()=>{const repo=memory(),a=candidate();const q={...INITIAL_QUESTIONS.find(q=>q.moduleId==='python'),familyId:'python:experimental-additive',prompt:'Какой объект возвращает iter([1, 2])?',options:['Итератор','Число','Словарь','Строка']};const {question}=await assessmentAction(repo,admin,{action:'maintainer-question-save',question:q});await assessmentAction(repo,admin,{action:'maintainer-question-decision',id:question.id,decision:'experiment',reviewed:true,reason:'Проверена однозначность и ключ'});const d=await day(repo,{python:1}),v=await start(repo,a,d,'python');assert.equal(v.currentModule.questions.length,7);assert.equal(v.currentModule.seconds,140);assert.equal(v.currentModule.questionSeconds,20);const raw=await repo.record(v.id),experimental=raw.modules[0].questions.find(q=>!q.scored);assert.equal(experimental.id,question.id);for(const item of raw.modules[0].questions)await answer(repo,a,v.id,item,item.scored?(item.format==='choice'?item.correct:String(item.numeric.expected)):null);let r=(await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment;assert.equal(r.results[0].score,100);assert.equal(r.results[0].total,6);await assessmentAction(repo,admin,{action:'maintainer-question-decision',id:question.id,decision:'admit',difficulty:2,reason:'Команда рассмотрела статистику и допустила задание'});r=(await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment;assert.equal(r.results[0].total,6);assert.equal((await repo.record(v.id)).modules[0].questions.find(q=>q.id===question.id).scored,false);assert.equal(d.pool.find(q=>q.id===question.id).scored,false);});
test('editing creates a separate version and specification changes affect only future pools',async()=>{const repo=memory(),d=await day(repo);const old=INITIAL_QUESTIONS[0];const {question}=await assessmentAction(repo,admin,{action:'maintainer-question-save',id:old.id,question:{...old,prompt:'Новое проверенное условие для следующей версии вопроса'}});assert.notEqual(question.id,old.id);assert.equal(question.version,old.version+1);assert.equal((await bank(repo)).find(q=>q.id===old.id).prompt,old.prompt);await assessmentAction(repo,admin,{action:'maintainer-spec-save',spec:{...DEFAULT_SPECS[0],questionSeconds:40}});const frozen=await repo.record(d.id);assert.equal(frozen.specs.find(s=>s.moduleId==='python').questionSeconds,20);});
test('quality analytics records distractors, skips and score strata without automatic promotion',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'sql');const raw=await repo.record(v.id),q=raw.modules[0].questions[0];await assessmentAction(repo,a,{action:'assessment-view',id:v.id,revision:raw.revision,questionId:q.id});await answer(repo,a,v.id,q,correctTestAnswer(q));await complete(repo,a,v.id,false);const adminState=await maintainerState(repo,admin),stat=adminState.analytics.find(x=>x.id===q.id);assert.equal(stat.shown,1);assert.equal(stat.correct,1);assert.equal(stat.groups.low.n,1);assert.equal((await bank(repo)).find(x=>x.id===q.id).status,'working');});

test('concurrent starts atomically claim registration and allow only one active attempt',async()=>{const repo=memory(),a=candidate(),d=await day(repo);const {registration}=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId:'python'});await Promise.allSettled([1,2].map(()=>assessmentAction(repo,a,{action:'assessment-start',registrationId:registration.id,rulesAccepted:true})));assert.equal((await repo.records('assessment')).length,1);assert.equal((await repo.record(registration.id)).status,'started');});
test('numeric key cannot be silently converted from empty input to zero',()=>{const q=INITIAL_QUESTIONS.find(q=>q.format==='numeric');for(const expected of ['',null,undefined])assert.throws(()=>validateQuestion({...q,numeric:{...q.numeric,expected}}));assert.ok(validateQuestion({...q,numeric:{...q.numeric,expected:0}}));});

test('draft day editing increments its version, and published pools reject edits',async()=>{const repo=memory();const input={action:'maintainer-day-save',name:'Первая версия',opensAt:Date.now()+10000,closesAt:Date.now()+86400000,moduleIds:['python']};const {dayId}=await assessmentAction(repo,admin,input);await assessmentAction(repo,admin,{...input,id:dayId,name:'Вторая версия'});assert.equal((await repo.record(dayId)).version,2);await assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId});await assert.rejects(assessmentAction(repo,admin,{...input,id:dayId}));assert.equal((await repo.record(dayId)).status,'published');});
test('two concurrent publications cannot overwrite a locked day',async()=>{const repo=memory();const {dayId}=await assessmentAction(repo,admin,{action:'maintainer-day-save',name:'Сессия',opensAt:Date.now()+10000,closesAt:Date.now()+86400000,moduleIds:['python']});const r=await Promise.allSettled([1,2].map(()=>assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId})));assert.equal(r.filter(x=>x.status==='fulfilled').length,1);});
test('breaks cannot be bypassed and a new role never skips a previously completed skill',async()=>{const repo=memory(),a=candidate(),d=await day(repo);await complete(repo,a,(await start(repo,a,d,'python')).id);d.breakSeconds=60;await repo.put('test-day',d);const role=await start(repo,a,d,'backend-developer');assert.equal(role.modules[0].id,'python');assert.equal(role.modules[0].status,'active');await complete(repo,a,role.id);const raw=await repo.record(role.id);await assert.rejects(assessmentAction(repo,a,{action:'assessment-next-module',id:raw.id,revision:raw.revision}));raw.nextModuleAt=Date.now()-1;raw.sessionClosesAt=Date.now()-1;await repo.put('assessment',raw);await assert.rejects(assessmentAction(repo,a,{action:'assessment-next-module',id:raw.id,revision:raw.revision}));});

test('distractor analytics maps shuffled candidate options back to bank labels',async()=>{const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'python');await complete(repo,a,view.id);const raw=await repo.record(view.id),stats=await maintainerState(repo,admin);for(const q of raw.modules[0].questions.filter(q=>q.format==='choice')){const source=INITIAL_QUESTIONS.find(x=>x.id===q.id),row=stats.analytics.find(x=>x.id===q.id);assert.equal(row.distractors[source.correct],1);assert.equal(row.distractors.reduce((a,b)=>a+b),1);}});

test('experimental items sharing a working family never cause duplicate families or start failures',async()=>{const repo=memory(),a=candidate();const original=INITIAL_QUESTIONS.find(q=>q.moduleId==='python');const {question}=await assessmentAction(repo,admin,{action:'maintainer-question-save',question:original});await assessmentAction(repo,admin,{action:'maintainer-question-decision',id:question.id,decision:'experiment',reviewed:true,reason:'Проверены условие и ключ; новый экземпляр узкого семейства'});const d=await day(repo,{python:1},['python']);for(let i=0;i<8;i++){const v=await start(repo,a,d,'python'),raw=await repo.record(v.id),qs=raw.modules[0].questions;assert.equal(qs.length,7);assert.equal(new Set(qs.map(q=>q.familyId)).size,7);assert.equal(qs.filter(q=>q.scored).length,6);assert.equal(qs.find(q=>!q.scored).id,question.id);await complete(repo,a,v.id);}});

test('concurrent expiry reads persist only one skip and return the same next question',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'python'),raw=await repo.record(v.id);raw.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',raw);const views=await Promise.all([1,2].map(()=>assessmentAction(repo,a,{action:'assessment-resume',id:v.id})));assert.ok(views.every(r=>r.assessment.status==='active'&&r.assessment.currentModule.questionIndex===1));assert.equal((await repo.record(v.id)).revision,1);assert.equal(views[0].assessment.currentModule.expiresAt,views[1].assessment.currentModule.expiresAt);assert.equal(Object.keys((await repo.record(v.id)).modules[0].answers).length,1);});

test('automatic daily pool selects a blueprint and reserve instead of copying the entire bank',async()=>{const repo=memory(),d=await day(repo,{},['python']);assert.equal(d.pool.length,8);assert.equal(new Set(d.pool.map(q=>q.familyId)).size,8);assert.ok(d.pool.length<INITIAL_QUESTIONS.filter(q=>q.moduleId==='python').length);assert.ok(d.pool.every(q=>q.scored));assert.equal(assemble(d.pool,d.specs[0]).length,6);});

test('per-question deadlines apply equally to standalone, role and integration modules',async()=>{const repo=memory(),a=candidate(),d=await day(repo);const single=await start(repo,a,d,'python');assert.equal(single.currentModule.questionSeconds,20);await complete(repo,a,single.id);const role=await start(repo,a,d,'backend-developer');for(let i=0;i<4;i++){let view=role;if(i){const raw=await repo.record(role.id);view=(await assessmentAction(repo,a,{action:'assessment-next-module',id:role.id,revision:raw.revision})).assessment;}assert.equal(view.currentModule.questionSeconds,single.currentModule.questionSeconds);assert.equal(view.currentModule.expiresAt-view.currentModule.questionStartedAt,20000);await complete(repo,a,role.id);}assert.equal((await repo.record(role.id)).modules[3].moduleId,'integration-backend');});
test('last question timeout completes the module and preserves previously confirmed answers',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'python');let raw=await repo.record(v.id);for(const q of raw.modules[0].questions.slice(0,-1))await answer(repo,a,v.id,q,correctTestAnswer(q));raw=await repo.record(v.id);raw.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',raw);const r=(await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment;assert.equal(r.status,'finished');assert.equal(r.results[0].correct,5);assert.equal(r.results[0].skipped,1);assert.equal(r.currentModule,null);});
test('old published pools receive per-question timing without rewriting the pool or finished history',async()=>{const repo=memory(),a=candidate(),d=await day(repo);for(const spec of d.specs){delete spec.questionSeconds;spec.seconds=600;spec.experimentalSeconds=90;}for(const config of Object.values(d.moduleConfigs)){delete config.questionSeconds;config.seconds=600;}await repo.put('test-day',d);const v=await start(repo,a,d,'python');assert.equal(v.currentModule.seconds,120);assert.equal(v.currentModule.questionSeconds,20);assert.equal((await repo.record(d.id)).moduleConfigs.python.seconds,600);const state=await assessmentState(repo,a);assert.equal(state.days[0].moduleConfigs.python.seconds,120);await complete(repo,a,v.id);const before=await repo.record(v.id);await assessmentAction(repo,a,{action:'assessment-resume',id:v.id});assert.deepEqual(await repo.record(v.id),before);});
test('a new timing specification affects future pools and freezes the per-question deadline',async()=>{const repo=memory(),a=candidate(),old=await day(repo,{},['python']);await assessmentAction(repo,admin,{action:'maintainer-spec-save',spec:{...DEFAULT_SPECS[0],questionSeconds:35}});const next=await day(repo,{},['python']);assert.equal(old.moduleConfigs.python.questionSeconds,20);assert.equal(next.moduleConfigs.python.questionSeconds,35);const v=await start(repo,a,next,'python');assert.equal(v.currentModule.expiresAt-v.currentModule.questionStartedAt,35000);assert.equal(v.currentModule.seconds,2180);});

test('unfinished attempts upgrade once from a module timer and retain their answers and assigned variant',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'backend-developer');const raw=await repo.record(v.id);delete raw.timingRule;const m=raw.modules[0];delete m.questionSeconds;delete m.spec.questionSeconds;m.seconds=600;m.expiresAt=Date.now()+600000;m.answers[m.questions[0].id]={value:null,savedAt:Date.now()};const assigned=raw.modules.map(m=>m.questions.map(q=>q.id));await repo.put('assessment',raw);const first=(await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment;assert.equal(first.currentModule.questionSeconds,20);assert.equal(first.currentModule.expiresAt-first.currentModule.questionStartedAt,20000);const updated=await repo.record(v.id);assert.equal(updated.timingRule,'per-question-v1');assert.deepEqual(updated.modules.map(m=>m.questions.map(q=>q.id)),assigned);assert.deepEqual(updated.modules[0].answers,m.answers);const again=(await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment;assert.equal(again.currentModule.expiresAt,first.currentModule.expiresAt);assert.equal(again.revision,first.revision);});

test('skill and role bookings can be cancelled and rebooked without creating an attempt',async()=>{for(const targetId of ['python','backend-developer']){const repo=memory(),a=candidate(),d=await day(repo),{registration}=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId});await assessmentAction(repo,a,{action:'assessment-cancel-registration',id:registration.id});const cancelled=await repo.record(registration.id);assert.equal(cancelled.status,'cancelled');assert.ok(cancelled.cancelledAt);assert.equal((await repo.records('assessment')).length,0);await assert.rejects(assessmentAction(repo,a,{action:'assessment-start',registrationId:registration.id,rulesAccepted:true}),e=>e.status===404);await assessmentAction(repo,a,{action:'assessment-cancel-registration',id:registration.id});const rebooked=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId});assert.notEqual(rebooked.registration.id,registration.id);assert.equal(rebooked.registration.status,'registered');}});
test('cancellation rejects foreign bookings and started attempts without changing their records',async()=>{const repo=memory(),a=candidate(),d=await day(repo),{registration}=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId:'sql'});await assert.rejects(assessmentAction(repo,{...a,id:'other'},{action:'assessment-cancel-registration',id:registration.id}),e=>e.status===404);assert.equal((await repo.record(registration.id)).status,'registered');const attempt=(await assessmentAction(repo,a,{action:'assessment-start',registrationId:registration.id,rulesAccepted:true})).assessment;await assert.rejects(assessmentAction(repo,a,{action:'assessment-cancel-registration',id:registration.id}),e=>e.status===409);assert.equal((await repo.record(registration.id)).status,'started');assert.equal((await repo.record(attempt.id)).status,'active');await assert.rejects(assessmentAction(repo,a,{action:'assessment-cancel-registration',id:d.id}),e=>e.status===404);});
test('concurrent cancellation and start cannot both claim the same booking',async()=>{for(const cancelFirst of [false,true]){const repo=memory(),a=candidate(),d=await day(repo),{registration}=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId:'python'}),cancel={action:'assessment-cancel-registration',id:registration.id},start={action:'assessment-start',registrationId:registration.id,rulesAccepted:true};const results=await Promise.allSettled((cancelFirst?[cancel,start]:[start,cancel]).map(body=>assessmentAction(repo,a,body)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const stored=await repo.record(registration.id),attempts=await repo.records('assessment');assert.ok(['cancelled','started'].includes(stored.status));assert.equal(attempts.length,stored.status==='started'?1:0);}});

test('hiding a skill removes it from candidate history while retaining answers, results and analytics',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'python');await complete(repo,a,v.id);const before=await repo.record(v.id),analyticsBefore=(await maintainerState(repo,admin)).analytics;await assessmentAction(repo,a,{action:'assessment-history-hide',id:v.id});const after=await repo.record(v.id);const {hiddenFromHistory,hiddenAt,...unchanged}=after;assert.equal(hiddenFromHistory,true);assert.ok(hiddenAt);assert.deepEqual(unchanged,before);const state=await assessmentState(repo,a);assert.equal(state.history.length,0);assert.equal(state.hiddenHistory.length,1);assert.equal(state.hiddenHistory[0].id,v.id);assert.equal(state.hiddenHistory[0].results,undefined);assert.deepEqual((await maintainerState(repo,admin)).analytics,analyticsBefore);await assessmentAction(repo,a,{action:'assessment-history-restore',id:v.id});const restored=await assessmentState(repo,a);assert.equal(restored.history.length,1);assert.equal(restored.hiddenHistory.length,0);assert.deepEqual(restored.history[0].results,before.modules.map(m=>m.result));});
test('hiding a complete role removes its role and all skill results together, leaving other attempts visible',async()=>{const repo=memory(),a=candidate(),d=await day(repo),skill=await start(repo,a,d,'sql');await complete(repo,a,skill.id);const v=await start(repo,a,d,'backend-developer');for(let i=0;i<4;i++){if(i){const t=await repo.record(v.id);await assessmentAction(repo,a,{action:'assessment-next-module',id:v.id,revision:t.revision});}await complete(repo,a,v.id);}const before=await repo.record(v.id);await assessmentAction(repo,a,{action:'assessment-history-hide',id:v.id});const state=await assessmentState(repo,a);assert.deepEqual(state.history.map(h=>h.id),[skill.id]);assert.ok(!state.history.flatMap(h=>h.results).some(r=>r.moduleId==='python'));assert.deepEqual((await repo.record(v.id)).modules,before.modules);await assessmentAction(repo,a,{action:'assessment-history-restore',id:v.id});assert.equal((await assessmentState(repo,a)).history.find(h=>h.id===v.id).results.length,4);});
test('only the owner may hide closed attempts; unfinished roles can be hidden after abandonment',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'backend-developer');for(const action of ['assessment-history-hide','assessment-history-restore']){await assert.rejects(assessmentAction(repo,{...a,id:'other'},{action,id:v.id}),e=>e.status===404);await assert.rejects(assessmentAction(repo,a,{action,id:v.id}),e=>e.status===409);await assert.rejects(assessmentAction(repo,a,{action,id:d.id}),e=>e.status===404);}await complete(repo,a,v.id);const raw=await repo.record(v.id);await assessmentAction(repo,a,{action:'assessment-abandon',id:v.id,revision:raw.revision});await assessmentAction(repo,a,{action:'assessment-history-hide',id:v.id});assert.equal((await assessmentState(repo,a)).history.length,0);assert.equal((await repo.record(v.id)).status,'incomplete');assert.equal((await repo.record(v.id)).modules[0].result.score,100);});

test('ongoing roles disclose no module scores through actions, resume, history or profile state',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'backend-developer');const closed=await complete(repo,a,v.id);const assertWithheld=view=>{assert.equal(view.resultsAvailable,false);assert.deepEqual(view.results,[]);assert.deepEqual(view.roleResult.requirements,[]);assert.equal(view.roleResult.integration,null);assert.equal(view.roleResult.level,null);if(view.modules)assert.ok(view.modules.every(m=>m.result===undefined));const payload=JSON.stringify(view);for(const key of ['score','correct','thresholds'])assert.ok(!payload.includes('"'+key+'":'));};assertWithheld(closed);const raw=await repo.record(v.id);assert.equal(raw.modules[0].result.score,100);assert.equal(closed.modules[0].status,'completed');assertWithheld((await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment);let state=await assessmentState(repo,a);assertWithheld(state.active);assertWithheld(state.history.find(h=>h.id===v.id));const second=(await assessmentAction(repo,a,{action:'assessment-next-module',id:v.id,revision:raw.revision})).assessment;assertWithheld(second);state=await assessmentState(repo,a);assertWithheld(state.history.find(h=>h.id===v.id));assert.ok((await maintainerState(repo,admin)).analytics.some(q=>q.correct>0));});
test('all role scores become available together after the final integration module',async()=>{const repo=memory(),a=candidate(),d=await day(repo),v=await start(repo,a,d,'backend-developer');let view=v;for(let i=0;i<4;i++){if(i){const raw=await repo.record(v.id);view=(await assessmentAction(repo,a,{action:'assessment-next-module',id:v.id,revision:raw.revision})).assessment;}assert.equal(view.resultsAvailable,false);view=await complete(repo,a,v.id);if(i<3){assert.deepEqual(view.results,[]);assert.equal(view.resultsAvailable,false);}}assert.equal(view.status,'finished');assert.equal(view.resultsAvailable,true);assert.equal(view.results.length,4);assert.equal(view.roleResult.level,'Senior');assert.equal(view.roleResult.requirements.length,4);assert.equal(view.roleResult.integration.score,100);assert.ok(view.modules.every(m=>m.result.score===100));const state=await assessmentState(repo,a);assert.equal(state.active,null);assert.equal(state.history.find(h=>h.id===v.id).results.length,4);assert.equal((await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment.results.length,4);});
test('standalone scores remain immediate and abandoned roles retain completed module results',async()=>{const repo=memory(),a=candidate(),d=await day(repo),skill=await start(repo,a,d,'python');const done=await complete(repo,a,skill.id);assert.equal(done.resultsAvailable,true);assert.equal(done.results[0].score,100);const role=await start(repo,a,d,'backend-developer');await complete(repo,a,role.id);const raw=await repo.record(role.id);const abandoned=(await assessmentAction(repo,a,{action:'assessment-abandon',id:role.id,revision:raw.revision})).assessment;assert.equal(abandoned.resultsAvailable,true);assert.equal(abandoned.results.length,1);assert.equal(abandoned.roleResult.level,null);assert.equal(abandoned.roleResult.completed,false);});

async function completeAdaptivePart(repo,a,id,correct=true,experimentalCorrect=correct){
 const t=await repo.record(id),m=t.modules[t.moduleIndex],startIndex=m.questions.findIndex(q=>q.id===m.activeQuestionId);
 const qs=m.questions.slice(startIndex);let view;
 for(const q of qs)view=await answer(repo,a,id,q,(q.scored?correct:experimentalCorrect)?(correctTestAnswer(q)):null);
 return view;
}
test('all 18 adaptive blueprints assemble both 16-question routes without repeated families',()=>{
 for(const spec of ADAPTIVE_SPECS)for(let i=0;i<10;i++){
  const pool=[...INITIAL_QUESTIONS,...MIXED_CODING_QUESTIONS].filter(q=>q.moduleId===spec.moduleId).map(q=>({...q,scored:true}));
  const tree=assembleAdaptiveVariant(pool,spec);
  assert.equal(tree.first.length,16);
  for(const [route,qs] of Object.entries(tree.routes)){
   assert.equal(qs.length,16);const path=[...tree.first,...qs];
   assert.equal(new Set(path.map(q=>q.id)).size,32);
   assert.equal(new Set(path.map(q=>q.familyId)).size,32);
   for(const d of [1,2,3])assert.equal(qs.filter(q=>q.difficulty===d).length,spec.adaptive.routes[route][d]);
   for(const part of [tree.first,qs])for(const c of spec.competencies)assert.ok(part.some(q=>q.competencies.includes(c)));
  }
 }
});
test('automatic adaptive pools include both possible routes and are validated before publishing',async()=>{
 const repo=memory(),d=await day(repo,{},MODULES.map(m=>m.id),true);
 for(const s of d.specs){assert.equal(s.scoredCount,32);assert.equal(d.moduleConfigs[s.moduleId].seconds,1760);assert.equal(d.moduleConfigs[s.moduleId].partCount,2);const pool=d.pool.filter(q=>q.moduleId===s.moduleId);assert.ok(pool.length>=32&&pool.length<=100);for(let i=0;i<5;i++)assert.ok(assembleAdaptiveVariant(pool,s));}
 const {dayId}=await assessmentAction(repo,admin,{action:'maintainer-day-save',name:'Неполное дерево',opensAt:Date.now()+10000,closesAt:Date.now()+86400000,moduleIds:['python'],questionIds:INITIAL_QUESTIONS.filter(q=>q.moduleId==='python'&&!q.seedOrigin).map(q=>q.id)});
 await assert.rejects(assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId}),e=>e.status===409);
});
test('the diagnostic part opens the fixed advanced or foundation route only after its final answer',async()=>{
 for(const correct of [true,false]){
  const repo=memory(),a=candidate(),d=await day(repo,{},['python'],true),v=await start(repo,a,d,'python');
  assert.equal(v.currentModule.partIndex,0);assert.equal(v.currentModule.partQuestionCount,16);assert.equal(v.currentModule.totalQuestionCount,32);assert.equal(v.currentModule.seconds,1760);
  assert.equal(v.currentModule.questions.length,16);assert.deepEqual(v.results,[]);
  const before=await repo.record(v.id);assert.equal(before.modules[0].adaptive.selectedRoute,null);
  const second=await completeAdaptivePart(repo,a,v.id,correct),raw=await repo.record(v.id),m=raw.modules[0],route=correct?'advanced':'foundation';
  assert.equal(m.adaptive.selectedRoute,route);assert.equal(m.questions.length,32);assert.equal(m.status,'active');assert.equal(m.result,undefined);
  assert.equal(second.currentModule.partIndex,1);assert.equal(second.currentModule.partQuestionIndex,0);assert.equal(second.currentModule.partQuestionCount,16);assert.deepEqual(second.results,[]);
  assert.deepEqual(m.questions.slice(16),before.modules[0].adaptive.routes[route]);
  assert.equal(second.currentModule.expiresAt-second.currentModule.questionStartedAt,20000);
  const serial=JSON.stringify(second);for(const key of ['correct','numeric','difficulty','routes','selectedRoute','decision'])assert.ok(!serial.includes('"'+key+'":'));
  const finished=await completeAdaptivePart(repo,a,v.id,true);assert.equal(finished.status,'finished');assert.equal(finished.results[0].total,32);
  if(correct)assert.equal(finished.results[0].score,100);else assert.ok(finished.results[0].score<50);assert.equal(finished.results[0].level,correct?'Senior':'Junior');assert.equal(finished.results[0].scoreRule,SCORING_RULE);assert.equal(finished.results[0].secondPartRoute,route);
 }
});
test('route snapshots survive resume, bank edits and stale answer replay',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo,{},['sql'],true),v=await start(repo,a,d,'sql');const before=await repo.record(v.id),first=before.modules[0].questions[0];
 await completeAdaptivePart(repo,a,v.id,true);const chosen=await repo.record(v.id),m=chosen.modules[0];
 await repo.put('question',{...m.questions[16],prompt:'Изменение банка после назначения не подменяет сохранённый вариант',status:'retired'});
 const resumed=(await assessmentAction(repo,a,{action:'assessment-resume',id:v.id})).assessment;
 assert.equal(resumed.currentModule.partIndex,1);assert.equal(resumed.currentModule.questions[16].prompt,m.questions[16].prompt);
 assert.equal(resumed.currentModule.expiresAt,m.expiresAt);assert.deepEqual((await repo.record(v.id)).modules[0].adaptive,m.adaptive);
 await assert.rejects(answer(repo,a,v.id,first,first.correct),e=>e.status===409);
 const raw=await repo.record(v.id);const state=(await assessmentAction(repo,a,{action:'assessment-view',id:v.id,revision:raw.revision,questionId:m.activeQuestionId,route:'foundation'})).assessment;
 assert.equal(state.currentModule.partIndex,1);assert.equal((await repo.record(v.id)).modules[0].adaptive.selectedRoute,'advanced');
});
test('concurrent final diagnostic confirmations commit one route decision',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo,{},['python'],true),v=await start(repo,a,d,'python');
 let raw=await repo.record(v.id);for(const q of raw.modules[0].questions.slice(0,15))await answer(repo,a,v.id,q,correctTestAnswer(q));
 raw=await repo.record(v.id);const q=raw.modules[0].questions[15];
 const body={action:'assessment-answer',id:v.id,revision:raw.revision,questionId:q.id,answer:correctTestAnswer(q)};
 const r=await Promise.allSettled([assessmentAction(repo,a,body),assessmentAction(repo,a,body)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
 const stored=await repo.record(v.id);assert.equal(stored.modules[0].questions.length,32);assert.equal(stored.modules[0].adaptive.selectedRoute,'advanced');assert.equal(stored.revision,16);
});
test('timeout on the last diagnostic question selects once and starts a fresh per-question timer',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo,{},['python'],true),v=await start(repo,a,d,'python');
 const first=(await repo.record(v.id)).modules[0].questions;for(const q of first.slice(0,15))await answer(repo,a,v.id,q,null);
 const raw=await repo.record(v.id);raw.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',raw);
 const r=await Promise.all([assessmentAction(repo,a,{action:'assessment-resume',id:v.id}),assessmentAction(repo,a,{action:'assessment-resume',id:v.id})]);
 const stored=await repo.record(v.id);assert.equal(stored.modules[0].adaptive.selectedRoute,'foundation');assert.equal(stored.modules[0].questions.length,32);assert.equal(stored.modules[0].answers[first[15].id].timedOut,true);
 for(const {assessment} of r){assert.equal(assessment.currentModule.partIndex,1);assert.equal(assessment.currentModule.expiresAt-assessment.currentModule.questionStartedAt,20000);assert.equal(assessment.currentModule.questionIndex,16);}
});
test('experimental answers cannot alter the adaptive route or the 32-question scored result',async()=>{
 const repo=memory(),a=candidate();const source=INITIAL_QUESTIONS.find(q=>q.moduleId==='python');
 await repo.put('question',{...source,id:'experimental-routing',familyId:'python:experimental-routing',status:'experimental'});
 const d=await day(repo,{python:1},['python'],true),v=await start(repo,a,d,'python');assert.equal(v.currentModule.questions.length,17);assert.equal(v.currentModule.seconds,1780);
 await completeAdaptivePart(repo,a,v.id,true,false);let raw=await repo.record(v.id);assert.equal(raw.modules[0].adaptive.selectedRoute,'advanced');assert.equal(raw.modules[0].questions.length,33);
 const finished=await completeAdaptivePart(repo,a,v.id,true);assert.equal(finished.results[0].total,32);assert.equal(finished.results[0].score,100);
 await assessmentAction(repo,admin,{action:'maintainer-question-decision',id:'experimental-routing',decision:'admit',difficulty:1,reason:'Содержательная проверка и собранные данные рассмотрены'});
 raw=await repo.record(v.id);assert.equal(raw.modules[0].questions.find(q=>q.id==='experimental-routing').scored,false);assert.equal(raw.modules[0].result.score,100);
});
test('a complete adaptive role uses two parts for every base and integration module, withholding all scores until the end',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo,{},undefined,true),v=await start(repo,a,d,'devops-engineer');let view=v;
 for(let i=0;i<3;i++){
  if(i){const raw=await repo.record(v.id);view=(await assessmentAction(repo,a,{action:'assessment-next-module',id:v.id,revision:raw.revision})).assessment;}
  assert.equal(view.currentModule.partIndex,0);assert.equal(view.currentModule.seconds,1760);assert.deepEqual(view.results,[]);
  view=await completeAdaptivePart(repo,a,v.id,true);assert.equal(view.currentModule.partIndex,1);assert.deepEqual(view.results,[]);
  view=await completeAdaptivePart(repo,a,v.id,true);if(i<2){assert.deepEqual(view.results,[]);assert.equal(view.resultsAvailable,false);}
 }
 assert.equal(view.status,'finished');assert.equal(view.roleResult.level,'Senior');assert.equal(view.results.length,3);assert.ok(view.results.every(r=>r.total===32&&r.score===100));assert.equal(view.roleResult.integration.total,32);assert.equal(view.roleResult.targetGrade,'Middle');assert.equal(view.roleResult.status,'confirmed-plus-potential');assert.equal(view.roleResult.confirmedGrade,'Middle');assert.equal(view.roleResult.confirmedPlus,true);assert.equal(view.roleResult.outcomeRule,ROLE_OUTCOME_RULE);assert.ok(view.roleResult.plusThresholds.every(r=>r.threshold===72.5));assert.equal(view.roleResult.potentialHigher,'Senior');
});
test('legacy saved specifications upgrade for future days without mutating old published snapshots',async()=>{
 const repo=memory(),old=await day(repo,{},['python']);
 await repo.put('module-spec',{...DEFAULT_SPECS[0],id:'old-custom',version:4,created:Date.now(),questionSeconds:35});
 const all=await specifications(repo),newest=all.filter(s=>s.moduleId==='python').sort((a,b)=>b.version-a.version)[0];assert.ok(newest.adaptive);assert.equal(newest.questionSeconds,35);assert.equal(newest.version,9);
 const next=await day(repo,{},['python'],true);assert.equal(next.specs[0].scoredCount,32);assert.equal(next.moduleConfigs.python.seconds,2180);assert.equal((await repo.record(old.id)).specs[0].scoredCount,6);
});
test('the common Rasch scale gives equal routing scores for equal credits on the same first-part difficulty mix',async()=>{
 for(const hardEvidence of [false,true]){
  const repo=memory(),a=candidate(),d=await day(repo,{},['python'],true),v=await start(repo,a,d,'python');
  const first=(await repo.record(v.id)).modules[0].questions;
  const selected=[...first].sort((a,b)=>hardEvidence?b.difficulty-a.difficulty:a.difficulty-b.difficulty).slice(0,9);
  assert.equal(selected.length,9);const ids=new Set(selected.map(q=>q.id));
  for(const q of first)await answer(repo,a,v.id,q,ids.has(q.id)?(correctTestAnswer(q)):null);
  const raw=await repo.record(v.id);assert.equal(raw.modules[0].adaptive.selectedRoute,'foundation');assert.equal(raw.modules[0].adaptive.decision.earned,9);assert.equal(raw.modules[0].adaptive.decision.possible,16);
 }
});

test('new role results obey category cooldown and successful repetition does not reset its interval',async()=>{
 for(const locked of [true,false]){
  const repo=memory(),a=candidate(),at=Date.now()-1000;
  a.profile={...a.profile,spec:locked?'Frontend':'Backend',grade:'Senior',score:90,verified:true,gradeChangedAt:at};
  const d=await day(repo,{},['python','sql','backend','integration-backend']),v=await start(repo,a,d,'backend-developer');
  let view;
  for(let i=0;i<4;i++){view=await complete(repo,a,v.id);if(i<3){const t=await repo.record(v.id);view=(await assessmentAction(repo,a,{action:'assessment-next-module',id:v.id,revision:t.revision})).assessment;}}
  assert.equal(view.roleResult.locked,locked);assert.equal(view.roleResult.applied,!locked);
  assert.equal(a.profile.spec,locked?'Frontend':'Backend');assert.equal(a.profile.gradeChangedAt,at);
 }
});

test('a completed role below an existing grade retains the saved qualification and proof',async()=>{
 const repo=memory(),a=candidate();a.profile={...a.profile,spec:'Backend',grade:'Senior',score:95,verified:true,verificationAttemptId:'prior-proof',gradeChangedAt:Date.now()-100*86400000};
 const d=await day(repo,{},['python','sql','backend','integration-backend']),v=await start(repo,a,d,'backend-developer');
 let view;
 for(let moduleIndex=0;moduleIndex<4;moduleIndex++){
  const t=await repo.record(v.id),m=t.modules[t.moduleIndex];
  for(const [index,q] of m.questions.entries())view=await answer(repo,a,v.id,q,index<4?(correctTestAnswer(q)):null);
  if(moduleIndex<3){const stored=await repo.record(v.id);await assessmentAction(repo,a,{action:'assessment-next-module',id:v.id,revision:stored.revision});}
 }
 assert.equal(view.roleResult.level,'Junior');assert.equal(view.roleResult.lower,true);assert.equal(view.roleResult.applied,false);
 assert.equal(a.profile.grade,'Senior');assert.equal(a.profile.score,95);assert.equal(a.profile.verificationAttemptId,'prior-proof');
});


test('autosaved choices survive resume, can be changed without extending the deadline and count on expiry',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'python');
 let raw=await repo.record(view.id),q=raw.modules[0].questions[0];
 while(q.format!=='choice'){await answer(repo,a,view.id,q,null);raw=await repo.record(view.id);q=raw.modules[0].questions.find(q=>q.id===raw.modules[0].activeQuestionId);}
 const deadline=raw.modules[0].expiresAt,index=raw.modules[0].questions.findIndex(x=>x.id===q.id);
 for(const value of [(q.correct+1)%4,q.correct]){
  const {assessment}=await assessmentAction(repo,a,{action:'assessment-draft',id:raw.id,revision:raw.revision,questionId:q.id,answer:value});
  assert.equal(assessment.currentModule.questionIndex,index);assert.equal(assessment.currentModule.expiresAt,deadline);
  raw=await repo.record(raw.id);assert.equal(raw.modules[0].answers[q.id].draft,true);
 }
 const resumed=(await assessmentAction(repo,a,{action:'assessment-resume',id:raw.id})).assessment;
 assert.equal(resumed.currentModule.answers[q.id],q.correct);
 raw.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',raw);
 const replies=await Promise.all([1,2].map(()=>assessmentAction(repo,a,{action:'assessment-resume',id:raw.id})));
 for(const {assessment} of replies){assert.equal(assessment.currentModule.questionIndex,index+1);assert.equal(assessment.currentModule.answers[q.id],q.correct);}
 raw=await repo.record(raw.id);assert.equal(raw.modules[0].answers[q.id].draft,false);assert.equal(raw.modules[0].answers[q.id].timedOut,true);
 const finished=(await repo.record(raw.id)).status==='finished'?(await assessmentAction(repo,a,{action:'assessment-resume',id:raw.id})).assessment:await complete(repo,a,raw.id,false);assert.equal(finished.results[0].correct,1);
});

test('clearing a selection and numeric validation prevent stale or invalid autosaved answers',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'sql');
 let raw=await repo.record(view.id),q=raw.modules[0].questions[0];
 while(q.format!=='numeric'){await answer(repo,a,view.id,q,null);raw=await repo.record(view.id);q=raw.modules[0].questions.find(q=>q.id===raw.modules[0].activeQuestionId);}
 const save=value=>assessmentAction(repo,a,{action:'assessment-draft',id:raw.id,revision:raw.revision,questionId:q.id,answer:value});
 await assert.rejects(save('1 + 2'));await assert.rejects(save('Infinity'));
 await save('0');raw=await repo.record(raw.id);assert.equal(raw.modules[0].answers[q.id].value,'0');
 await save(null);raw=await repo.record(raw.id);raw.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',raw);
 await assert.rejects(save(String(q.numeric.expected)),e=>e.status===409);
 await assessmentAction(repo,a,{action:'assessment-resume',id:raw.id});assert.equal((await repo.record(raw.id)).modules[0].answers[q.id].value,null);
});

test('autosaved numeric answers are graded on timeout and late drafts cannot change a closed question',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'sql');
 let raw=await repo.record(view.id),q=raw.modules[0].questions[0];
 while(q.format!=='numeric'){await answer(repo,a,view.id,q,null);raw=await repo.record(view.id);q=raw.modules[0].questions.find(q=>q.id===raw.modules[0].activeQuestionId);}
 const value=String(q.numeric.expected).replace('.',',');
 await assessmentAction(repo,a,{action:'assessment-draft',id:raw.id,revision:raw.revision,questionId:q.id,answer:value});
 raw=await repo.record(raw.id);raw.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',raw);
 const {assessment}=await assessmentAction(repo,a,{action:'assessment-resume',id:raw.id});assert.equal((await repo.record(raw.id)).modules[0].answers[q.id].value,value);
 await assert.rejects(assessmentAction(repo,a,{action:'assessment-draft',id:raw.id,revision:assessment.revision,questionId:q.id,answer:'999'}),e=>e.status===409);
 const finished=(await repo.record(raw.id)).status==='finished'?(await assessmentAction(repo,a,{action:'assessment-resume',id:raw.id})).assessment:await complete(repo,a,raw.id,false);assert.equal(finished.results[0].correct,1);
});

test('selected grade is validated at start, frozen with attempt and resolved against role thresholds',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo);
 const r=await assessmentAction(repo,a,{action:'assessment-register',dayId:d.id,targetId:'backend-developer',targetGrade:'Senior'});
 assert.equal(r.registration.targetGrade,'Senior');
 await assert.rejects(assessmentAction(repo,a,{action:'assessment-start',registrationId:r.registration.id,rulesAccepted:true,targetGrade:'Lead'}));
 const started=await assessmentAction(repo,a,{action:'assessment-start',registrationId:r.registration.id,rulesAccepted:true,targetGrade:'Junior'});
 assert.equal(started.assessment.targetGrade,'Junior');assert.equal((await repo.record(started.assessment.id)).targetGrade,'Junior');assert.equal((await repo.record(started.assessment.id)).roleOutcomeRule,ROLE_OUTCOME_RULE);
});

test('active role answers expose saved source without hidden coding judgement',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo),view=await start(repo,a,d,'backend-developer');
 const stored=await repo.record(view.id),m=stored.modules[0];
 m.answers['closed-code']={value:{source:'print(6)',judged:true,correct:false,passed:1,total:3},savedAt:Date.now()};
 const candidateView=assessmentView(stored);
 assert.equal(candidateView.currentModule.answers['closed-code'],'print(6)');
 assert.equal(candidateView.resultsAvailable,false);
 assert.deepEqual(candidateView.results,[]);
 assert.ok(!JSON.stringify(candidateView.currentModule.answers).includes('passed'));
});

test('mixed daily coding appears twice in each part, uses five minutes and keeps hidden checks private',{skip:process.env.CODE_SANDBOX_TESTS!=='1'},async()=>{
 const repo=memory(),a=candidate();
 let {assessment:view}=await assessmentAction(repo,a,{action:'assessment-start',targetId:'python',rulesAccepted:true});
 assert.equal((await repo.record(view.id)).dayId,dailyPoolWindow().id+'-'+DAILY_POOL_REVISION);
 const positions=[];
 for(let i=0;i<32;i++){
  const stored=await repo.record(view.id),m=stored.modules[0],q=m.questions.find(q=>q.id===m.activeQuestionId);
  if(q.format==='coding'){
   positions.push(i);assert.equal(view.currentModule.questionSeconds,300);assert.equal(view.currentModule.partQuestionCount,16);
   const shown=view.currentModule.questions[view.currentModule.questionIndex];assert.equal(shown.coding.tests.length,1);
   await assert.rejects(assessmentAction(repo,a,{action:'assessment-answer',id:view.id,revision:view.revision,questionId:q.id,answer:{correct:true,judged:true}}));
   if(i===4){const source=MIXED_CODING_SOLUTIONS.get(q.id)||'import json,sys\nprint(sum(x for x in json.load(sys.stdin) if x%2==0))';view=(await assessmentAction(repo,a,{action:'assessment-submit-code',id:view.id,revision:view.revision,questionId:q.id,source,submissionId:crypto.randomUUID()})).assessment;view=await answer(repo,a,view.id,q,null);continue;}
  }else assert.equal(view.currentModule.questionSeconds,20);
  view=await answer(repo,a,view.id,q,correctTestAnswer(q));
 }
 assert.deepEqual(positions,[4,11,20,27]);assert.equal(view.status,'finished');assert.equal(view.results[0].total,32);assert.equal(view.results[0].score,100);assert.equal(view.results[0].theoryScore,100);assert.equal(view.results[0].codingScore,100);
});

test('daily pools span exactly 24 hours and rotate at Moscow midnight',()=>{
 const before=dailyPoolWindow(Date.parse('2026-12-31T20:59:59.999Z')),after=dailyPoolWindow(Date.parse('2026-12-31T21:00:00Z'));
 assert.equal(before.date,'2026-12-31');assert.equal(after.date,'2027-01-01');
 assert.equal(before.closesAt-before.opensAt,86400000);assert.equal(before.closesAt,after.opensAt);
});

test('one daily pool is shared, snapshots every module and freezes bank and spec changes until the next day',async()=>{
 const repo=memory(),at=Date.parse('2026-10-07T09:00:00Z');
 const [day,again]=await Promise.all([ensureDailyPool(repo,at),ensureDailyPool(repo,at)]);
 assert.deepEqual(day,again);assert.equal(day.moduleIds.length,18);
 for(const spec of day.specs){assert.equal(spec.adaptive.firstCount,16);assert.ok(assembleAdaptiveVariant(day.pool.filter(q=>q.moduleId===spec.moduleId),spec));}
 const first=day.pool.find(q=>q.moduleId==='python'&&q.format!=='coding');
 await repo.put('question',{...first,status:'retired'});
 await assessmentAction(repo,admin,{action:'maintainer-spec-save',spec:{...day.specs.find(s=>s.moduleId==='python'),questionSeconds:25}});
 assert.deepEqual(await ensureDailyPool(repo,at+1000),day);
 const next=await ensureDailyPool(repo,at+86400000);
 assert.notEqual(next.id,day.id);assert.equal(next.specs.find(s=>s.moduleId==='python').questionSeconds,25);assert.ok(!next.pool.some(q=>q.id===first.id));
 assert.equal((await repo.record(day.id)).pool.find(q=>q.id===first.id).status,'working');
});

test('immediate start requires no booking, uses only today pool and resumes the same frozen variant',async()=>{
 const repo=memory(),a=candidate();
 const {preparation}=await assessmentAction(repo,a,{action:'assessment-prepare',targetId:'python'});
 assert.equal(preparation.day.schedule,'daily');assert.ok(!JSON.stringify(preparation).includes('"correct"'));
 await assert.rejects(assessmentAction(repo,a,{action:'assessment-prepare',targetId:'integration-backend'}));
 await assert.rejects(assessmentAction(repo,a,{action:'assessment-start',targetId:'python',rulesAccepted:false}));
 const {assessment}=await assessmentAction(repo,a,{action:'assessment-start',targetId:'python',rulesAccepted:true});
 assert.equal((await repo.records('assessment-registration')).length,0);
 const raw=await repo.record(assessment.id),day=await repo.record(raw.dayId),poolIds=new Set(day.pool.map(q=>q.id));
 assert.equal(raw.dayId,preparation.day.id);assert.equal(raw.poolSchedule,'daily');assert.equal(raw.sessionClosesAt,null);
 for(const part of raw.modules)for(const q of [...part.questions,...Object.values(part.adaptive.routes).flat()])assert.ok(poolIds.has(q.id));
 const resumed=await assessmentAction(repo,a,{action:'assessment-start',targetId:'sql',rulesAccepted:true});
 assert.equal(resumed.assessment.id,assessment.id);assert.deepEqual((await repo.record(assessment.id)).modules,raw.modules);
 const other=await assessmentAction(repo,{...candidate(),id:'other'},{action:'assessment-start',targetId:'python',rulesAccepted:true});
 assert.equal((await repo.record(other.assessment.id)).dayId,raw.dayId);
});

test('a role begun just before midnight keeps the old pool and can open its next module after rollover',async()=>{
 const repo=memory(),a=candidate(),clock=Date.now;let at=dailyPoolWindow().closesAt-500;
 Date.now=()=>at;
 try{
  let {assessment}=await assessmentAction(repo,a,{action:'assessment-start',targetId:'backend-developer',targetGrade:'Senior',rulesAccepted:true});
  const started=await repo.record(assessment.id);assert.equal(started.targetGrade,'Senior');
  for(let i=0;i<32;i++){const stored=await repo.record(assessment.id),m=stored.modules[0],q=m.questions.find(q=>q.id===m.activeQuestionId);assessment=await answer(repo,a,assessment.id,q,null);}
  assert.equal(assessment.currentModule,null);assert.equal(assessment.resultsAvailable,false);
  at+=61000;const tomorrow=await ensureDailyPool(repo);assert.notEqual(tomorrow.id,started.dayId);
  assessment=(await assessmentAction(repo,a,{action:'assessment-next-module',id:assessment.id,revision:assessment.revision})).assessment;
  assert.equal(assessment.moduleIndex,1);assert.equal(assessment.currentModule.id,'sql');
  const continued=await repo.record(assessment.id);assert.equal(continued.dayId,started.dayId);assert.deepEqual(continued.modules[1].questions,started.modules[1].questions);
 }finally{Date.now=clock;}
});

test('mixed coding bank and all module parts have distinct families, fixed counts and exact difficulty quotas',async()=>{
 const repo=memory(),day=await ensureDailyPool(repo);
 assert.equal(MIXED_CODING_QUESTIONS.length,540);
 for(const spec of day.specs){
  const tasks=MIXED_CODING_QUESTIONS.filter(q=>q.moduleId===spec.moduleId);assert.equal(tasks.length,30);
  for(const q of tasks){assert.equal(validateQuestion(q).format,'coding');assert.equal(q.questionSeconds,300);}
  const tree=assembleAdaptiveVariant(day.pool.filter(q=>q.moduleId===spec.moduleId),spec);
  assert.equal(spec.codingPerPart,2);assert.equal(spec.seconds,1760);
  for(const [name,part] of [['first',tree.first],...Object.entries(tree.routes)]){
   assert.equal(part.length,16);assert.equal(part.filter(q=>q.format==='coding').length,2);
   assert.equal(part.filter(q=>q.format!=='coding').length,14);
   const counts=name==='first'?spec.adaptive.firstDifficultyCounts:spec.adaptive.routes[name];
   for(const d of [1,2,3])assert.equal(part.filter(q=>q.difficulty===d).length,counts[d]);
   if(name!=='first')assert.equal(new Set([...tree.first,...part].map(q=>q.familyId)).size,32);
  }
 }
});
test('a correct coding response can change the second-part route without affecting the deadline rules',async()=>{
 for(const codeCorrect of [false,true]){
  const repo=memory(),a=candidate(),{assessment:view}=await assessmentAction(repo,a,{action:'assessment-start',targetId:'python',rulesAccepted:true});
  const first=(await repo.record(view.id)).modules[0].questions;
  const ordinary=new Set(first.filter(q=>q.format!=='coding').slice(0,10).map(q=>q.id));
  let codeSeen=false;
  for(const q of first){const right=q.format==='coding'?codeCorrect&&!codeSeen:ordinary.has(q.id);if(q.format==='coding')codeSeen=true;await answer(repo,a,view.id,q,right?correctTestAnswer(q):null);}
  const m=(await repo.record(view.id)).modules[0];assert.equal(m.adaptive.decision.earned,codeCorrect?11:10);assert.equal(m.adaptive.selectedRoute,codeCorrect?'advanced':'foundation');
 }
});

async function codingAttempt(){const repo=memory(),a=candidate();let {assessment:view}=await assessmentAction(repo,a,{action:'assessment-start',targetId:'python',rulesAccepted:true});for(let i=0;i<4;i++){const t=await repo.record(view.id),q=t.modules[0].questions.find(q=>q.id===t.modules[0].activeQuestionId);view=await answer(repo,a,view.id,q,correctTestAnswer(q));}const t=await repo.record(view.id),q=t.modules[0].questions.find(q=>q.id===t.modules[0].activeQuestionId);return {repo,a,view,q};}
test('candidate coding feedback separates best graded credit from the last submission and an unsent draft',async()=>{
 const {repo,view,q}=await codingAttempt(),stored=await repo.record(view.id),m=stored.modules[0],total=q.coding.tests.length;
 m.answers[q.id]={value:{source:'checked best source',judged:true,correct:true,passed:total,total},savedAt:Date.now()};
 m.codingDrafts={[q.id]:'edited unsent draft'};
 m.codingSubmissions={[q.id]:[{id:'best',source:'checked best source',passed:total,total,results:Array(total).fill(true)},{id:'last',source:'last checked source',passed:1,total,results:Array.from({length:total},(_,i)=>i===0)}]};
 const publicView=assessmentView(stored),feedback=publicView.currentModule.questions[publicView.currentModule.questionIndex].coding.submission;
 assert.equal(feedback.used,2);assert.equal(feedback.lastSource,'last checked source');assert.equal(feedback.passed,1);assert.deepEqual(feedback.best,{passed:total,total});
 assert.equal(publicView.currentModule.answers[q.id],'edited unsent draft');assert.ok(!('source' in feedback.best));
 assert.ok(!('correct' in feedback));assert.equal(m.answers[q.id].value.source,'checked best source');
});
test('retrying an accepted coding submission after its response was lost returns feedback with the original revision',async()=>{
 const {repo,a,view,q}=await codingAttempt(),stored=await repo.record(view.id),m=stored.modules[0];
 const source='recorded judge source',submissionId='lost-response-submit',total=q.coding.tests.length,results=q.coding.tests.map((_,i)=>i===0);
 // This is the persisted judge outcome whose API response never reached the client.
 m.codingSubmissions={[q.id]:[{id:submissionId,source,at:Date.now(),passed:1,total,results}]};
 m.answers[q.id]={value:{source,judged:true,correct:false,passed:1,total},savedAt:Date.now()};
 m.codingDrafts={[q.id]:source};stored.revision++;await repo.put('assessment',stored);
 const accepted=await repo.record(view.id),body={action:'assessment-submit-code',id:view.id,revision:view.revision,questionId:q.id,source,submissionId};
 const replay=(await assessmentAction(repo,a,body)).assessment,feedback=replay.currentModule.questions[replay.currentModule.questionIndex].coding.submission;
 assert.equal(replay.revision,accepted.revision);assert.equal(feedback.used,1);assert.equal(feedback.lastSource,source);assert.equal(feedback.passed,1);assert.equal(feedback.total,total);assert.deepEqual(feedback.results,results);
 assert.deepEqual(await repo.record(view.id),accepted,'replay neither spends another retry nor changes stored answers');
 await assert.rejects(assessmentAction(repo,{...a,id:'another-candidate'},body),e=>e.status===404);
 await assert.rejects(assessmentAction(repo,a,{...body,submissionId:'different-submit'}),e=>e.status===409);
 const future=m.questions.find(other=>other.format==='coding'&&other.id!==q.id);
 await assert.rejects(assessmentAction(repo,a,{...body,revision:accepted.revision,questionId:future.id}),e=>e.status===409);
 const next=(await assessmentAction(repo,a,{action:'assessment-answer',id:view.id,revision:accepted.revision,questionId:q.id,answer:null})).assessment;
 await assert.rejects(assessmentAction(repo,a,{...body,revision:next.revision}),e=>e.status===409);
});
test('coding run uses editable stdin without grading; submission limit, idempotency and best result survive drafts and Next',{skip:process.env.CODE_SANDBOX_TESTS!=='1'},async()=>{
 const {repo,a,q,view:initial}=await codingAttempt();let view=initial;
 const request=(action,extra={})=>assessmentAction(repo,a,{action,id:view.id,revision:view.revision,questionId:q.id,...extra});
 assert.equal(view.currentModule.questions[4].coding.input,q.coding.tests[0].stdin);
 const echo='import sys\nprint(sys.stdin.read(),end="")',stdin='custom input\n';
 view=(await request('assessment-draft',{answer:echo,stdin})).assessment;
 assert.equal(view.currentModule.questions[4].coding.input,stdin);
 const run=await request('assessment-run-code',{source:echo,stdin});assert.equal(run.run.stdout,stdin);assert.ok(!('results' in run.run));assert.ok(!('correct' in run.run));
 assert.deepEqual(view.currentModule.questions[4].coding.submission,{used:0,limit:3});assert.ok(!(await repo.record(view.id)).modules[0].answers[q.id]);
 const partial='import sys\nprint('+JSON.stringify(q.coding.tests[0].expected)+' if sys.stdin.read()=='+JSON.stringify(q.coding.tests[0].stdin)+' else "wrong")';
 await request('assessment-submit-code',{source:partial,submissionId:'first-submit'}); // Discard the response as if the connection dropped after saving.
 view=(await request('assessment-submit-code',{source:partial,submissionId:'first-submit'})).assessment;
 let feedback=view.currentModule.questions[4].coding.submission;
 assert.equal(feedback.used,1);assert.equal(feedback.passed,1);assert.deepEqual(feedback.results,q.coding.tests.map((_,i)=>i===0));
 view=(await request('assessment-submit-code',{source:partial,submissionId:'first-submit'})).assessment;assert.equal(view.currentModule.questions[4].coding.submission.used,1);
 view=(await request('assessment-submit-code',{source:MIXED_CODING_SOLUTIONS.get(q.id),submissionId:'second-submit'})).assessment;
 assert.equal(view.currentModule.questions[4].coding.submission.passed,q.coding.tests.length);
 const concurrent=await Promise.allSettled(['third-submit','competing-submit'].map(submissionId=>request('assessment-submit-code',{source:'print("wrong")',submissionId})));assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.find(r=>r.status==='rejected').reason.status,409);view=(await assessmentAction(repo,a,{action:'assessment-resume',id:view.id})).assessment;
 assert.equal(view.currentModule.questions[4].coding.submission.used,3);assert.equal(view.currentModule.questions[4].coding.submission.passed,0);
 assert.deepEqual(view.currentModule.questions[4].coding.submission.best,{passed:q.coding.tests.length,total:q.coding.tests.length},'credit retains the best checked solution even after a worse submission');
 await assert.rejects(request('assessment-submit-code',{source:'print(1)',submissionId:'fourth-submit'}),/3 попытки/);
 await assert.rejects(request('assessment-answer',{answer:MIXED_CODING_SOLUTIONS.get(q.id)}),/Отправить/);
 view=(await request('assessment-draft',{answer:'print("draft")',stdin:'changed input'})).assessment;
 view=(await assessmentAction(repo,a,{action:'assessment-resume',id:view.id})).assessment;
 assert.equal(view.currentModule.questions[4].coding.submission.used,3);assert.equal(view.currentModule.answers[q.id],'print("draft")');assert.equal(view.currentModule.questions[4].coding.input,'changed input');
 let stored=await repo.record(view.id);assert.equal(stored.modules[0].answers[q.id].value.correct,true);
 view=(await request('assessment-answer',{answer:null})).assessment;
 assert.equal(view.currentModule.questionIndex,5);stored=await repo.record(view.id);assert.equal(stored.modules[0].answers[q.id].value.correct,true);assert.equal(stored.modules[0].codingSubmissions[q.id].length,3);
});
test('coding timeout and Next do not grade an unsent draft or consume a submission',async()=>{
 for(const expired of [false,true]){const {repo,a,view:initial,q}=await codingAttempt();const {assessment:view}=await assessmentAction(repo,a,{action:'assessment-draft',id:initial.id,revision:initial.revision,questionId:q.id,answer:'print(1)',stdin:'editable'});if(expired){const t=await repo.record(view.id);t.modules[0].expiresAt=Date.now()-1;await repo.put('assessment',t);}
 const next=(await assessmentAction(repo,a,{action:expired?'assessment-resume':'assessment-answer',id:view.id,revision:view.revision,questionId:q.id,answer:null})).assessment;
 assert.equal(next.currentModule.questionIndex,5);const t=await repo.record(view.id);assert.equal(t.modules[0].answers[q.id].value,null);assert.ok(!t.modules[0].codingSubmissions?.[q.id]);}
});

test('reviewed daily bank revision creates a new pool without rewriting previous pools or their question versions',async()=>{
 const repo=memory(),at=Date.parse('2026-10-08T09:00:00Z'),oldId=dailyPoolWindow(at).id+'-mixed-v2';
 const old={id:oldId,kind:'test-day',owner:'platform',created:at,status:'published',version:1,pool:[{...INITIAL_QUESTIONS[0],version:1,options:['old','a','b','c'],correct:0}]};
 await repo.put('test-day',old);
 const reviewed=await ensureDailyPool(repo,at);assert.notEqual(reviewed.id,old.id);assert.equal(reviewed.bankRevision,'2026-10-10');
 assert.deepEqual(await repo.record(oldId),old);assert.ok(reviewed.pool.every(q=>q.status==='working'||q.status==='experimental'));
 assert.ok(!reviewed.pool.some(q=>q.id==='coding-integration-backend-v1'));
 assert.ok(reviewed.pool.filter(q=>q.format==='choice').every(q=>[2,3].includes(q.version)));
 assert.deepEqual(await ensureDailyPool(repo,at+1000),reviewed);
});

test('daily pools retain coding alternatives and unseen tasks outrank global exposure in every module',async()=>{
 const day=await ensureDailyPool(memory());
 for(const spec of day.specs){
  const pool=day.pool.filter(q=>q.moduleId===spec.moduleId);
  for(const d of [1,2,3])assert.equal(pool.filter(q=>q.format==='coding'&&q.difficulty===d).length,10,spec.moduleId);
  const first=assembleAdaptiveVariant(pool,spec).first.filter(q=>q.format==='coding'),seen=new Set(first.map(q=>q.id));
  const exposure=new Map(pool.filter(q=>!seen.has(q.id)).flatMap(q=>[[q.familyId,10000],['question:'+q.id,10000]]));
  const next=assembleAdaptiveVariant(pool,spec,0,seen,exposure);
  assert.ok(next.first.filter(q=>q.format==='coding').every(q=>!seen.has(q.id)),spec.moduleId+' repeated a seen coding task while alternatives existed');
 }
});


test('skipping all coding cannot confirm a role or verify the candidate despite perfect theory',async()=>{
 const repo=memory(),a=candidate();let {assessment:view}=await assessmentAction(repo,a,{action:'assessment-start',targetId:'devops-engineer',targetGrade:'Middle',rulesAccepted:true});
 for(let moduleIndex=0;moduleIndex<3;moduleIndex++){
  if(moduleIndex){const raw=await repo.record(view.id);raw.nextModuleAt=Date.now()-1;await repo.put('assessment',raw);view=(await assessmentAction(repo,a,{action:'assessment-next-module',id:view.id,revision:raw.revision})).assessment;}
  for(let part=0;part<2;part++){
   const raw=await repo.record(view.id),m=raw.modules[raw.moduleIndex];
   for(const q of m.questions.slice(part*16,(part+1)*16))view=await answer(repo,a,view.id,q,q.format==='coding'?null:correctTestAnswer(q));
  }
 }
 assert.equal(view.status,'finished');assert.equal(view.roleResult.status,'unconfirmed');assert.equal(view.roleResult.level,'Ниже Junior');assert.equal(view.roleResult.potentialHigher,null);
 assert.ok(view.results.every(r=>r.score===60&&r.theoryScore===100&&r.codingScore===0&&r.level==='Ниже Junior'));
 assert.notEqual((await repo.account(a.id))?.profile?.verified,true);
});

test('a frozen legacy mixed attempt keeps its scoring after the new daily pool is created',async()=>{
 const repo=memory(),a=candidate(),d=await day(repo,{},['python'],true),v=await start(repo,a,d,'python');
 const raw=await repo.record(v.id),m=raw.modules[0];delete m.spec.scoring;m.spec.adaptive.rule='two-stage-16-mixed-coding-v2';raw.roleOutcomeRule='target-grade-five-outcomes-midpoint-v2';raw.scoreRule='difficulty-weighted-fixed-scale-v1';await repo.put('assessment',raw);
 await ensureDailyPool(repo);
 await completeAdaptivePart(repo,a,v.id,false);const finished=await completeAdaptivePart(repo,a,v.id,true);
 assert.equal(finished.results[0].score,37);assert.equal(finished.results[0].maximumPoints,70);assert.equal(finished.results[0].scoreRule,'difficulty-weighted-fixed-scale-v1');
 assert.equal((await repo.record(v.id)).roleOutcomeRule,'target-grade-five-outcomes-midpoint-v2');
});
