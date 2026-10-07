import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresFixture,needsPostgres} from './helpers/postgres.mjs';
import {getState} from '../lib/service.mjs';
import {assessmentAction,assessmentState,employerAssessmentProjection} from '../lib/assessments.mjs';
import {MODULES,ROLES} from '../lib/question-bank.mjs';

async function fixture(t){
 const {repo}=await postgresFixture(t),at=Date.now()-10000,role=ROLES.find(r=>r.id==='backend-developer');
 const candidate={id:'visibility-candidate',email:'candidate@example.test',roles:['candidate'],privacy:{visible:true,consent:true},profile:{name:'Candidate',spec:role.spec,grade:'Middle',score:82,verified:true,verifiedAt:at,verificationAttemptId:'role-attempt',stack:['Python'],min:100,max:200,phone:'phone',format:'Удалённо'},company:{}};
 const employer={id:'visibility-employer',email:'employer@example.test',roles:['employer'],privacy:{},profile:{name:'Employer'},company:{name:'Company'}};
 const scores=[93,88,84,82],ids=[...role.modules,role.integration];
 const attempt={id:'role-attempt',owner:candidate.id,kind:'assessment',created:at-10000,completedAt:at,status:'finished',targetKind:'role',targetId:role.id,name:role.name,dayVersion:3,moduleIndex:3,modules:ids.map((moduleId,i)=>({moduleId,status:'completed',questions:[],answers:{retained:{value:1}},views:{},result:{moduleId,name:MODULES.find(m=>m.id===moduleId).name,score:scores[i],level:'Middle',correct:26,total:32,completedAt:at-(3-i)*100,thresholds:{Junior:50,Middle:70,Senior:90}}})),finalRoleResult:{completed:true,roleId:role.id,name:role.name,level:'Middle'}};
 await repo.saveAccount(candidate);await repo.saveAccount(employer);await repo.put('assessment',attempt);
 return {repo,candidate,employer,attempt};
}
const visibility=(id,targetKind,targetId,hidden)=>({action:'assessment-result-visibility',id,targetKind,targetId,hidden});

test('visibility is saved per result, independently of history and other results, and can be restored',needsPostgres,async t=>{
 const {repo,candidate,attempt}=await fixture(t),before=await repo.record(attempt.id);
 await assessmentAction(repo,candidate,visibility(attempt.id,'skill','python',true));
 await assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',true));
 let stored=await repo.record(attempt.id);assert.deepEqual(stored.employerHiddenResults,{'skill:python':true,'role:backend-developer':true});assert.deepEqual(stored.modules,before.modules);assert.equal(stored.hiddenFromHistory,undefined);
 let state=await assessmentState(repo,candidate);assert.equal(state.history.length,1);assert.equal(state.hiddenHistory.length,0);assert.equal(state.history[0].results[0].score,93);assert.equal(state.history[0].employerHiddenResults['skill:python'],true);
 await assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',false));
 stored=await repo.record(attempt.id);assert.equal(stored.employerHiddenResults['role:backend-developer'],false);assert.equal(stored.employerHiddenResults['skill:python'],true);
 await assessmentAction(repo,candidate,visibility(attempt.id,'skill','python',false));state=await assessmentState(repo,candidate);assert.equal(state.history[0].employerHiddenResults['skill:python'],false);assert.deepEqual((await repo.record(attempt.id)).modules,before.modules);
});

test('only the owner can change closed existing skill and role results',needsPostgres,async t=>{
 const {repo,candidate,employer,attempt}=await fixture(t);
 await assert.rejects(assessmentAction(repo,{...candidate,id:'other'},visibility(attempt.id,'skill','python',true)),e=>e.status===404);
 await assert.rejects(assessmentAction(repo,employer,visibility(attempt.id,'skill','python',true)),e=>e.status===403);
 for(const body of [visibility(attempt.id,'skill','react',true),visibility(attempt.id,'skill','integration-backend',true),visibility(attempt.id,'role','frontend-developer',true)])await assert.rejects(assessmentAction(repo,candidate,body),e=>e.status===404);
 await assert.rejects(assessmentAction(repo,candidate,visibility(attempt.id,'skill','python','true')),e=>e.status===400);
 assert.equal(await repo.setAssessmentResultVisibility(attempt.id,'other','skill:python',true,Date.now()),false);
 await repo.put('assessment',{...attempt,status:'active'});await assert.rejects(assessmentAction(repo,candidate,visibility(attempt.id,'skill','python',true)),e=>e.status===409);
 assert.equal(await repo.setAssessmentResultVisibility(attempt.id,candidate.id,'skill:python',true,Date.now()),false);
});

test('hidden results and derived verification do not leak through catalog, matching, or job applications',needsPostgres,async t=>{
 const {repo,candidate,employer,attempt}=await fixture(t);
 await repo.put('job',{id:'job',owner:employer.id,created:Date.now(),title:'Backend engineer',status:'published'});
 await repo.put('application',{id:'application',owner:candidate.id,recipient:employer.id,jobId:'job',created:Date.now(),status:'sent'});
 let state=await getState(repo,employer,'employer','Middle backend Python',{confirmed:'1',spec:'Backend',grade:'Middle'});assert.equal(state.candidates.find(c=>c.id===candidate.id).confirmedResults.length,4);
 await assessmentAction(repo,candidate,visibility(attempt.id,'skill','python',true));await assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',true));
 state=await getState(repo,employer,'employer','Middle backend Python',{confirmed:'1',spec:'Backend',grade:'Middle'});
 for(const person of [state.candidates.find(c=>c.id===candidate.id),state.applications[0].candidate]){
  assert.ok(person);assert.equal(person.score,null);assert.equal(person.grade,null);assert.equal(person.verified,false);assert.equal(person.verifiedAt,null);
  assert.ok(!person.confirmedResults.some(r=>r.id==='python'||r.id==='backend-developer'));assert.equal(person.confirmedResults.length,2);
  assert.equal(person.match.parts.find(p=>p.key==='test').points,0);assert.equal(person.match.parts.find(p=>p.key==='grade').points,0);assert.ok(!person.match.reasons.some(r=>r.includes('82/100')||r.includes('Middle')));
  assert.equal(person.email,candidate.email);assert.ok(!JSON.stringify(person).includes('employerHiddenResults'));assert.ok(!JSON.stringify(person).includes(attempt.id));
 }
 const own=await getState(repo,candidate,'candidate');assert.equal(own.profile.score,82);assert.equal(own.profile.verified,true);assert.equal(own.assessment.history[0].results[0].score,93);
 await assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',false));state=await getState(repo,employer,'employer','Middle backend Python',{confirmed:'1',spec:'Backend',grade:'Middle'});const shown=state.candidates.find(c=>c.id===candidate.id);assert.equal(shown.score,82);assert.equal(shown.grade,'Middle');assert.ok(shown.confirmedResults.some(r=>r.kind==='role'));assert.ok(!shown.confirmedResults.some(r=>r.id==='python'));
});

test('a hidden latest skill never falls back to an older score; new attempts have their own visibility',needsPostgres,async t=>{
 const {repo,candidate,attempt}=await fixture(t),at=Date.now();
 const skill=(id,completedAt,score)=>({id,owner:candidate.id,kind:'assessment',created:completedAt-100,status:'finished',targetKind:'skill',targetId:'python',name:'Python',modules:[{...attempt.modules[0],result:{...attempt.modules[0].result,score,completedAt}}]});
 await repo.put('assessment',skill('old-python',at,99));await repo.put('assessment',skill('new-python',at+100,35));
 await assessmentAction(repo,candidate,visibility('new-python','skill','python',true));assert.ok(!(await employerAssessmentProjection(repo,candidate)).confirmedResults.some(r=>r.id==='python'));
 await repo.put('assessment',skill('next-python',at+200,40));assert.equal((await employerAssessmentProjection(repo,candidate)).confirmedResults.find(r=>r.id==='python').score,40);
});

test('legacy role verification and history-hidden proof are also redacted, with no changes to owner profile',needsPostgres,async t=>{
 const {repo,candidate,attempt}=await fixture(t);delete candidate.profile.verificationAttemptId;
 await assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',true));assert.equal((await employerAssessmentProjection(repo,candidate)).profile.score,null);
 await assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',false));assert.equal((await employerAssessmentProjection(repo,candidate)).profile.score,82);
 await repo.setAssessmentVisibility(attempt.id,candidate.id,true,Date.now());assert.equal((await employerAssessmentProjection(repo,candidate)).profile.score,null);assert.equal(candidate.profile.score,82);
});

test('simultaneous toggles on separate targets preserve both visibility settings in SQL',needsPostgres,async t=>{
 const {repo,candidate,attempt}=await fixture(t);await Promise.all([assessmentAction(repo,candidate,visibility(attempt.id,'skill','python',true)),assessmentAction(repo,candidate,visibility(attempt.id,'role','backend-developer',true))]);assert.deepEqual((await repo.record(attempt.id)).employerHiddenResults,{'skill:python':true,'role:backend-developer':true});
});
