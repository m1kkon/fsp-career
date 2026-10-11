import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {action,getState} from '../lib/service.mjs';
import {selectedNeed} from '../lib/matching.mjs';
import {evaluateHardFilters} from '../lib/ats.mjs';
import {executeAccountAction} from '../lib/action-dispatch.mjs';
import {periodicTaskSuggestion,PRACTICE_INTERVAL} from '../lib/periodic-tasks.mjs';
import {memoryRepository,serializedWriter,survey,candidateAccount,employerAccount,successfulJudge} from './helpers/tz-memory.mjs';

test('partial resume edits preserve omitted sections; explicit clearing removes search skills',async()=>{
 const repo=memoryRepository(),a=await candidateAccount(repo);
 const resume={headline:'Engineer',languages:'English C1',links:[{label:'Portfolio',url:'https://example.test'}],projects:[{name:'Payments',description:'API project'}],skillGroups:[{label:'Backend',text:'Python, PostgreSQL'}]};
 await action(repo,a,{action:'resume-details',...resume});await action(repo,a,{action:'resume-details',headline:'Senior engineer'});
 assert.deepEqual(a.profile.resume,{...resume,headline:'Senior engineer',links:[{label:'Portfolio',url:'https://example.test/'}],projects:[{name:'Payments',description:'API project',url:''}],skillGroups:[{label:'Backend',text:'Python, PostgreSQL',description:''}],achievements:''});
 await action(repo,a,{action:'profile',resume:{headline:'Updated again'}});assert.equal(a.profile.resume.projects[0].name,'Payments');assert.deepEqual(a.profile.stack,['Python','PostgreSQL']);
 await action(repo,a,{action:'resume-details',skillGroups:[],projects:[],links:[],languages:''});assert.deepEqual(a.profile.stack,[]);assert.deepEqual(a.profile.resume.projects,[]);assert.equal(a.profile.resume.languages,'');
});
test('saved-search deletion rejects own records of another type and foreign searches',async()=>{
 const repo=memoryRepository(),a=await employerAccount(repo),other=await employerAccount(repo,'other');
 await action(repo,a,{action:'task',title:'SQL analysis',description:'Explain a query plan',spec:'Backend'});const task=(await repo.records('task'))[0];
 await action(repo,a,{action:'need',text:'Middle backend Python',spec:'Backend',grade:'Middle',confirmed:true});const need=(await repo.records('need'))[0];
 await assert.rejects(action(repo,a,{action:'delete-need',id:task.id}),e=>e.status===404);await assert.rejects(action(repo,other,{action:'delete-need',id:need.id}),e=>e.status===404);
 assert.ok(await repo.record(task.id));await action(repo,a,{action:'delete-need',id:need.id});assert.equal(await repo.record(need.id),null);
});
test('clearing inferred requirements remains cleared after saving a search',async()=>{
 const query='Middle Backend Python английский B2 опыт от 5 лет',cleared={spec:'Backend',grade:'Middle',englishLevel:'',minExperience:'',confirmed:true};
 const inferred=selectedNeed(query,{spec:'Backend',grade:'Middle',confirmed:true});assert.equal(inferred.englishLevel,'B2');assert.equal(inferred.minExperience,5);
 const need=selectedNeed(query,cleared);assert.equal(need.englishLevel,null);assert.equal(need.minExperience,null);
 const repo=memoryRepository(),a=await employerAccount(repo);await action(repo,a,{action:'need',text:query,...cleared});const saved=(await repo.records('need'))[0];assert.equal(saved.englishLevel,null);assert.equal(saved.minExperience,null);
});
test('unknown relocation is unknown, explicit refusal fails, agreed relocation passes',()=>{
 const need=selectedNeed('Backend',{spec:'Backend',grade:'Middle',city:'Москва',locationRequired:true,confirmed:true});
 const base={spec:'Backend',grade:'Middle',verified:true,city:'Казань',stack:['Python'],ats:{relocation:null}};
 const checked=relocation=>evaluateHardFilters({...base,ats:{relocation}},need).checks.find(x=>x.id==='city').status;
 assert.equal(checked(null),'unknown');assert.equal(checked('Не рассматриваю'),'fail');assert.equal(checked('Готов обсудить'),'pass');
});
test('survey clears salary, rejects reversed range and ambiguous decimals without persisting a new version',async()=>{
 const repo=memoryRepository(),a=await candidateAccount(repo);await action(repo,a,{action:'profile',min:180000,max:220000});
 await action(repo,a,survey({salaryMin:''}));assert.equal(a.profile.min,null);assert.equal((await repo.records('survey')).length,2);
 for(const salaryMin of ['250000','180.50','180,50','-1','0'])await assert.rejects(action(repo,a,survey({salaryMin})));
 assert.equal((await repo.records('survey')).length,2);assert.equal(a.profile.min,null);
 await action(repo,a,survey({salaryMin:'180.000'}));assert.equal(a.profile.min,180000);
 const employer=await employerAccount(repo);await assert.rejects(action(repo,employer,{action:'need',text:'Middle Backend',spec:'Backend',grade:'Middle',confirmed:true,budgetMin:'180.50'}));await assert.rejects(getState(repo,employer,'employer','Middle Backend',{confirmed:true,budgetMin:'180,50'}));assert.equal((await repo.records('need')).length,0);
});
test('answered task keeps original instructions after edit and deletion; review records practice activity',async()=>{
 const repo=memoryRepository(),a=await candidateAccount(repo),e=await employerAccount(repo);
 await action(repo,e,{action:'task',title:'Original title',description:'Original instructions for query analysis',spec:'Backend'});const task=(await repo.records('task'))[0];
 await action(repo,a,{action:'task-answer',id:task.id,answer:'Measure query execution and verify the improvement under equivalent load.'});
 await action(repo,e,{action:'task',id:task.id,title:'Rewritten',description:'Different instructions',spec:'QA'});await action(repo,e,{action:'task-delete',id:task.id});
 const submission=(await repo.records('submission'))[0];assert.equal(submission.taskSnapshot.description,task.description);assert.equal(submission.taskSnapshot.spec,'Backend');assert.equal((await getState(repo,a)).submissions[0].taskSnapshot.description,task.description);
 await action(repo,e,{action:'task-review',id:submission.id,feedback:'Good measurement plan and comparison.'});assert.ok((await repo.account(a.id)).profile.lastPracticeAt);assert.equal((await getState(repo,a)).submissions[0].status,'reviewed');
});
test('editing legacy answered tasks backfills once and never snapshots unrelated submissions',async()=>{
 const repo=memoryRepository(),a=await candidateAccount(repo),e=await employerAccount(repo);
 await action(repo,e,{action:'task',title:'Historical task',description:'Historical instructions',spec:'Backend'});const task=(await repo.records('task'))[0];
 await repo.put('submission',{id:'legacy-answer',owner:a.id,recipient:e.id,created:Date.now(),taskId:task.id,title:task.title,answer:'Historical candidate answer',status:'submitted'});
 await repo.put('submission',{id:'unrelated-answer',owner:'other',recipient:'other-company',created:Date.now(),taskId:task.id,title:'Unrelated',answer:'Unrelated answer',status:'submitted'});
 await action(repo,e,{action:'task',id:task.id,title:'First edit',description:'First updated instructions',spec:'QA'});const first=(await repo.record('legacy-answer')).taskSnapshot;
 assert.equal(first.description,'Historical instructions');assert.equal(first.spec,'Backend');assert.equal((await repo.record('unrelated-answer')).taskSnapshot,undefined);
 await action(repo,e,{action:'task',id:task.id,title:'Second edit',description:'Second updated instructions',spec:'Frontend'});assert.deepEqual((await repo.record('legacy-answer')).taskSnapshot,first);
});
test('proxy accepts the largest permitted company JSON payload below the application limit',async()=>{
 const repo=memoryRepository(),e=await employerAccount(repo);const limits={description:4000,product:2400,teamDescription:2400,hiringProcess:1800,officeAddress:300,workingHours:300,tagline:160};const body={action:'company',...Object.fromEntries(Object.entries(limits).map(([key,max])=>[key,'界'.repeat(max)])),benefits:Array.from({length:12},(_,i)=>String(i)+'界'.repeat(150))};await action(repo,e,body);assert.equal(e.company.description.length,4000);
 const bytes=Buffer.byteLength(JSON.stringify(body));const caddy=await readFile(new URL('../deploy/Caddyfile',import.meta.url),'utf8'),limit=Number(caddy.match(/max_size\s+(\d+)KB/)[1])*1024;assert.ok(bytes>32768);assert.ok(bytes<60000);assert.ok(bytes<limit);
});
test('weekly practice suggestions stay stable within the period and exclude answered or unrelated tasks',()=>{
 const a={id:'candidate',profile:{spec:'Backend'}},tasks=[{id:'a',title:'API',status:'published',spec:'Backend'},{id:'b',title:'SQL',status:'published',spec:'Backend'},{id:'c',status:'deleted',spec:'Backend'},{id:'d',status:'published',spec:'QA'}],at=10*PRACTICE_INTERVAL+1;
 const first=periodicTaskSuggestion(tasks,[],a,at);assert.deepEqual(periodicTaskSuggestion(tasks,[],a,at+1000),first);assert.equal(first.nextAt,11*PRACTICE_INTERVAL);
 assert.notEqual(periodicTaskSuggestion(tasks,[],a,at+PRACTICE_INTERVAL).taskId,first.taskId);
 const answered=[{owner:a.id,taskId:first.taskId}];assert.notEqual(periodicTaskSuggestion(tasks,answered,a,at).taskId,first.taskId);
 assert.equal(periodicTaskSuggestion(tasks,[{owner:a.id,taskId:'a'},{owner:a.id,taskId:'b'}],a,at),null);
});
test('candidate completes survey, adaptive role, explained search, invitation and company-specific contact consent',async()=>{
 const repo=memoryRepository(),candidate=await candidateAccount(repo),employer=await employerAccount(repo),other=await employerAccount(repo,'other'),write=serializedWriter(repo);
 const dispatch=body=>executeAccountAction(candidate.id,body,{write,judge:successfulJudge});
 const {assessment}=await dispatch({action:'assessment-start',targetId:'backend-developer',targetGrade:'Middle',rulesAccepted:true});
 for(let guard=0;guard<220;guard++){
  const raw=await repo.record(assessment.id);if(raw.status==='finished')break;const m=raw.modules[raw.moduleIndex];
  if(m.status==='completed'){raw.nextModuleAt=Date.now()-1;await repo.put('assessment',raw);await dispatch({action:'assessment-next-module',id:raw.id,revision:raw.revision});continue;}
  const q=m.questions.find(q=>q.id===m.activeQuestionId);
  if(q.format==='coding'){await dispatch({action:'assessment-submit-code',id:raw.id,revision:raw.revision,questionId:q.id,source:'trusted judge fixture',submissionId:'correct-'+guard.toString().padStart(8,'0')});const current=await repo.record(raw.id);await dispatch({action:'assessment-answer',id:raw.id,revision:current.revision,questionId:q.id,answer:null});}
  else await dispatch({action:'assessment-answer',id:raw.id,revision:raw.revision,questionId:q.id,answer:q.format==='choice'?q.correct:String(q.numeric.expected)});
 }
 const attempt=await repo.record(assessment.id),confirmed=await repo.account(candidate.id);assert.equal(attempt.status,'finished');assert.equal(attempt.finalRoleResult.confirmedGrade,'Middle');assert.equal(attempt.finalRoleResult.potentialHigher,'Senior');assert.equal(confirmed.profile.grade,'Middle');assert.equal(confirmed.profile.verified,true);assert.equal(confirmed.profile.verificationAttemptId,assessment.id);
 await action(repo,employer,{action:'need',text:'Middle backend Python PostgreSQL',spec:'Backend',grade:'Middle',requiredStack:'Python',confirmed:true});
 let state=await getState(repo,employer,'employer','Middle backend Python PostgreSQL',{spec:'Backend',grade:'Middle',requiredStack:'Python',confirmed:true});const person=state.candidates.find(c=>c.id===candidate.id);assert.ok(person);assert.equal(person.match.eligibility.status,'pass');assert.ok(person.match.parts.length);assert.equal(person.email,undefined);
 await action(repo,employer,{action:'invite',candidateId:candidate.id,title:'Backend engineer',description:'Develop product APIs',min:180000,max:240000,contact:employer.email});const incoming=(await repo.scoped('invite',candidate.id))[0];
 await action(repo,confirmed,{action:'invite-status',id:incoming.id,status:'accepted'});state=await getState(repo,employer,'employer');assert.equal(state.candidates.find(c=>c.id===candidate.id).email,candidate.email);assert.equal((await getState(repo,other,'employer')).candidates.find(c=>c.id===candidate.id).email,undefined);
});
