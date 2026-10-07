import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture,needsPostgres} from './helpers/postgres.mjs';
import {accountFor,action,getState} from '../lib/service.mjs';
import {assessmentAction,ensureDailyPool} from '../lib/assessments.mjs';
import {ROLES} from '../lib/question-bank.mjs';
import {assessmentAccount,isTestMaintainer,requireTestMaintainer} from '../lib/test-maintainer.mjs';

const admin={id:'test-admin',maintainer:true};
test('PostgreSQL daily pools are insert-only and concurrent immediate starts reuse one attempt',needsPostgres,async t=>{
 const {repo,write}=await postgresFixture(t);
 const candidate=await accountFor(repo,{id:'daily-candidate',email:'daily@example.test',name:'Daily Candidate'});
 candidate.roles=['candidate'];candidate.profile.surveyCompletedAt=Date.now();await repo.saveAccount(candidate);
 const [first,second]=await Promise.all([ensureDailyPool(repo),ensureDailyPool(repo)]);
 assert.deepEqual(first,second);assert.equal((await repo.records('test-day')).length,1);
 const unchanged=await repo.putIfAbsent('test-day',{...first,name:'Must not replace published pool',pool:[]});assert.deepEqual(unchanged,first);
 const run=()=>write(async current=>action(current,await current.account(candidate.id),{action:'assessment-start',targetId:'backend-developer',targetGrade:'Middle',rulesAccepted:true}));
 const [a,b]=await Promise.all([run(),run()]);assert.equal(a.assessment.id,b.assessment.id);
 assert.equal((await repo.scoped('assessment',candidate.id)).length,1);assert.equal((await repo.records('assessment-registration')).length,0);
 assert.equal((await repo.record(a.assessment.id)).dayId,first.id);
});
test('test administration grants privileges only from the server allowlist',()=>{
 assert.equal(isTestMaintainer('local_seedy',{}),false);
 assert.equal(isTestMaintainer('candidate',{TEST_MAINTAINER_IDS:' admin,other '}),false);
 assert.equal(isTestMaintainer('admin',{TEST_MAINTAINER_IDS:' admin,other '}),true);
 assert.equal(assessmentAccount({id:'candidate',maintainer:true},{}).maintainer,false);
 assert.throws(()=>requireTestMaintainer(null,{}),e=>e.status===401);
 assert.throws(()=>requireTestMaintainer({id:'candidate',maintainer:true},{}),e=>e.status===403);
});

test('PostgreSQL qualification flow keeps attempts, profile proof, permissions and concurrent updates consistent',needsPostgres,async t=>{
 const {repo,write,pool}=await postgresFixture(t);
 const candidate=await accountFor(repo,{id:'qualification-candidate',email:'candidate@example.test',name:'Candidate'});
 await action(repo,candidate,{action:'onboard',role:'candidate',name:'Candidate',consent:true});
 await assert.rejects(action(repo,candidate,{action:'assessment-register'}),/Сначала заполните анкету/);
 candidate.profile={...candidate.profile,surveyCompletedAt:Date.now()};await repo.saveAccount(candidate);
 const role=ROLES.find(r=>r.id==='backend-developer'),moduleIds=[...role.modules,role.integration];
 const {dayId}=await assessmentAction(repo,admin,{action:'maintainer-day-save',name:'Integration session',opensAt:Date.now()+10000,closesAt:Date.now()+8*3600000,moduleIds,breakSeconds:0,tools:'Без внешних инструментов'});
 await assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId});
 const day=await repo.record(dayId);await repo.put('test-day',{...day,opensAt:Date.now()-1000});
 const run=body=>write(async current=>action(current,await current.account(candidate.id),body));
 await t.test('client flags cannot forge maintainer rights and derived permission is never persisted',async()=>{
  await assert.rejects(run({action:'maintainer-state',maintainer:true}),e=>e.status===403);
  await repo.saveAccount({...await repo.account(candidate.id),maintainer:true});
  assert.equal((await repo.account(candidate.id)).maintainer,undefined);
 });
 const {registration}=await run({action:'assessment-register',dayId,targetId:role.id});
 let attemptId;
 await t.test('simultaneous starts reuse one attempt and claim the booking once',async()=>{
  const starts=await Promise.all([run({action:'assessment-start',registrationId:registration.id,rulesAccepted:true}),run({action:'assessment-start',registrationId:registration.id,rulesAccepted:true})]);
  attemptId=starts[0].assessment.id;assert.equal(starts[1].assessment.id,attemptId);
  assert.equal((await repo.scoped('assessment',candidate.id)).length,1);
  assert.equal((await repo.record(registration.id)).attemptId,attemptId);
 });
 await t.test('two answers with the same revision cannot both modify the attempt',async()=>{
  const raw=await repo.record(attemptId),m=raw.modules[0],q=m.questions[0];
  const body={action:'assessment-answer',id:attemptId,revision:raw.revision,questionId:q.id,answer:q.format==='choice'?q.correct:String(q.numeric.expected)};
  const replies=await Promise.allSettled([run(body),run(body)]);
  assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(replies.find(r=>r.status==='rejected').reason.status,409);
  assert.equal((await repo.record(attemptId)).revision,raw.revision+1);
 });
 await t.test('autosaved draft persists in PostgreSQL and timeout counts it exactly once',async()=>{
  const raw=await repo.record(attemptId),m=raw.modules[raw.moduleIndex],q=m.questions.find(q=>q.id===m.activeQuestionId),value=q.format==='choice'?q.correct:String(q.numeric.expected);
  const saved=await run({action:'assessment-draft',id:attemptId,revision:raw.revision,questionId:q.id,answer:value});
  assert.equal(saved.assessment.currentModule.expiresAt,m.expiresAt);assert.equal(saved.assessment.currentModule.answers[q.id],value);
  const resumed=await run({action:'assessment-resume',id:attemptId});assert.equal(resumed.assessment.currentModule.answers[q.id],value);
  const persisted=await repo.record(attemptId);persisted.modules[persisted.moduleIndex].expiresAt=Date.now()-1;await repo.put('assessment',persisted);
  await Promise.all([run({action:'assessment-resume',id:attemptId}),run({action:'assessment-resume',id:attemptId})]);
  const closed=await repo.record(attemptId);assert.equal(closed.modules[closed.moduleIndex].answers[q.id].value,value);assert.equal(closed.modules[closed.moduleIndex].answers[q.id].draft,false);assert.equal(closed.revision,raw.revision+2);
 });
 await t.test('a full adaptive role writes its proof and skills into the saved resume without leaking keys',async()=>{
  for(let guard=0;guard<150;guard++){
   const raw=await repo.record(attemptId);if(raw.status==='finished')break;
   const m=raw.modules[raw.moduleIndex];
   if(m.status==='completed'){await run({action:'assessment-next-module',id:attemptId,revision:raw.revision});continue;}
   const q=m.questions.find(q=>q.id===m.activeQuestionId);
   const result=await run({action:'assessment-answer',id:attemptId,revision:raw.revision,questionId:q.id,answer:q.format==='choice'?q.correct:String(q.numeric.expected)});
   assert.ok(!JSON.stringify(result).includes('"correct":')||!result.assessment.currentModule);
   assert.ok(!JSON.stringify(result.assessment.currentModule||{}).includes('"numeric":'));
  }
  const raw=await repo.record(attemptId),saved=await repo.account(candidate.id);
  assert.equal(raw.status,'finished');assert.equal(raw.modules.length,4);
  assert.ok(raw.modules.every(m=>m.questions.filter(q=>q.scored).length===32));
  assert.equal(saved.profile.grade,'Senior');assert.equal(saved.profile.verified,true);assert.equal(saved.profile.verificationAttemptId,attemptId);
  assert.equal(saved.profile.competencies.length,3);assert.equal(saved.profile.name,'Candidate');
  const state=await getState(repo,saved,'candidate');assert.equal(state.assessment.history[0].results.length,4);
 });
 await t.test('visibility updates on two distinct result keys preserve both changes in JSONB',async()=>{
  await Promise.all([run({action:'assessment-result-visibility',id:attemptId,targetKind:'skill',targetId:'python',hidden:true}),run({action:'assessment-result-visibility',id:attemptId,targetKind:'role',targetId:role.id,hidden:true})]);
  assert.deepEqual((await repo.record(attemptId)).employerHiddenResults,{'skill:python':true,'role:backend-developer':true});
 });
 await t.test('answer writes and account proof roll back together if the transaction fails',async()=>{
  const saved=await repo.account(candidate.id);
  await assert.rejects(write(async current=>{const changed=await current.account(candidate.id);changed.profile.score=1;await current.saveAccount(changed);await current.setAssessmentVisibility(attemptId,candidate.id,true,Date.now());throw new Error('abort');}),/abort/);
  assert.equal((await repo.account(candidate.id)).profile.score,saved.profile.score);assert.equal((await repo.record(attemptId)).hiddenFromHistory,undefined);
 });
 await t.test('database rejects a second active attempt even from a direct caller',async()=>{
  await repo.put('assessment',{id:'active-one',owner:candidate.id,created:Date.now(),status:'active',revision:0});
  await assert.rejects(repo.put('assessment',{id:'active-two',owner:candidate.id,created:Date.now(),status:'active',revision:0}),e=>e.code==='23505');
  assert.equal((await pool.query("SELECT count(*) FROM records WHERE kind='assessment' AND data->>'status'='active'")).rows[0].count,'1');
 });
});
