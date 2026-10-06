import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountFor,action,getState,publicJobs} from '../lib/service.mjs';
import {makeTest,testView,gradeTest,COOLDOWN,SPECS,GRADES,matching,parseNeed} from '../lib/domain.mjs';
import {seed} from '../lib/seed.mjs';
import {mockFspProfile} from '../lib/fsp.mjs';
import {publicCandidate} from '../lib/domain.mjs';
function memory(){const accounts=new Map(),records=new Map();const clone=x=>x?structuredClone(x):null;return {account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),record:async id=>clone(records.get(id)),put:async(kind,r)=>records.set(r.id,{...clone(r),kind}),saveTestStep:async(r,index)=>{const old=records.get(r.id);if(!old||old.owner!==r.owner||old.status!=='active'||old.questionIndex!==index)return false;records.set(r.id,{...clone(r),kind:'test'});return true;},remove:async(id,owner)=>{if(records.get(id)?.owner===owner)records.delete(id);}};}
async function fixture(){const repo=memory();const candidate=await accountFor(repo,{id:'candidate-a',email:'a@example.test',name:'Candidate'});await action(repo,candidate,{action:'onboard',role:'candidate',name:'Candidate',city:'Москва',spec:'Backend',grade:'Middle',consent:true});candidate.profile={...candidate.profile,verified:true,score:90,stack:['Python','PostgreSQL'],verifiedAt:Date.now(),about:'Backend engineer',gradeChangedAt:Date.now()};await repo.saveAccount(candidate);const employer=await accountFor(repo,{id:'employer-a',email:'hr@example.test',name:'HR'});await action(repo,employer,{action:'onboard',role:'employer',name:'Company',description:'Product engineering team',contact:'hr@example.test',consent:true});const other=await accountFor(repo,{id:'employer-b',email:'b@example.test'});await action(repo,other,{action:'onboard',role:'employer',name:'Other',description:'Other engineering team',contact:'b@example.test',consent:true});return {repo,candidate,employer,other};}
async function finishTimed(repo,candidate,id,correct){let response;for(let i=0;i<6;i++){const stored=await repo.record(id);response=await action(repo,candidate,{action:'test-answer',id,questionIndex:i,answer:correct?stored.questions[i].correct:(stored.questions[i].correct+1)%stored.questions[i].options.length});}return response;}
const invitation=(candidateId)=>({action:'invite',candidateId,title:'Backend role',description:'API development in product team',min:180000,max:240000,contact:'hr@example.test'});
test('contacts stay absent in API before consent and are granted only to inviting company',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));let view=await getState(repo,employer,'employer');assert.equal(view.candidates.find(c=>c.id===candidate.id).email,undefined);assert.equal(view.invites[0].email,undefined);assert.ok(!JSON.stringify(view.candidates).includes(candidate.email));const incoming=await getState(repo,candidate,'candidate');assert.equal(incoming.candidates.length,0);await action(repo,candidate,{action:'invite-status',id:incoming.invites[0].id,status:'accepted'});view=await getState(repo,employer,'employer');assert.equal(view.candidates.find(c=>c.id===candidate.id).email,candidate.email);assert.equal((await getState(repo,other,'employer')).candidates.find(c=>c.id===candidate.id).email,undefined);assert.equal((await getState(repo,other,'employer')).invites.length,0);});
test('invitation ownership and terminal statuses are enforced',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));const id=(await repo.scoped('invite',employer.id))[0].id;await assert.rejects(action(repo,other,{action:'invite-status',id,status:'accepted'}));await action(repo,candidate,{action:'invite-status',id,status:'declined'});await assert.rejects(action(repo,candidate,{action:'invite-status',id,status:'accepted'}));assert.equal((await getState(repo,employer,'employer')).candidates.find(c=>c.id===candidate.id).email,undefined);});
test('salary is mandatory and descending/negative ranges fail on server',async()=>{const {repo,candidate,employer}=await fixture();for(const range of [{min:240000,max:180000},{min:0,max:100},{min:1.5,max:100},{min:NaN,max:100}])await assert.rejects(action(repo,employer,{...invitation(candidate.id),...range}));assert.equal((await repo.records('invite')).length,0);});
test('candidate cannot impersonate employer and edit cannot forge verification',async()=>{const {repo,candidate}=await fixture();await assert.rejects(action(repo,candidate,invitation(candidate.id)));await action(repo,candidate,{action:'profile',name:'Updated',min:100,max:200,stack:'Python',verified:false,score:1,grade:'Senior'});assert.equal(candidate.profile.verified,true);assert.equal(candidate.profile.grade,'Middle');assert.equal(candidate.profile.score,90);});
test('withdrawn consent removes profile and blocks new invitations',async()=>{const {repo,candidate,employer}=await fixture();await action(repo,candidate,{action:'settings',visible:true,consent:false,notifications:true});assert.ok(!(await getState(repo,employer,'employer')).candidates.some(c=>c.id===candidate.id));await assert.rejects(action(repo,employer,invitation(candidate.id)));});
test('application grants contact only to job owner and duplicate is rejected',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,{action:'job',title:'Backend',description:'Develop APIs',spec:'Backend',grade:'Middle',min:100,max:200,stack:'Python',format:'Удалённо'});const job=(await repo.records('job'))[0];await action(repo,candidate,{action:'apply',jobId:job.id,letter:'Hello'});await assert.rejects(action(repo,candidate,{action:'apply',jobId:job.id}));const view=await getState(repo,employer,'employer');assert.equal(view.applications[0].email,candidate.email);assert.equal(view.candidates.find(c=>c.id===candidate.id).email,candidate.email);assert.equal((await getState(repo,other,'employer')).applications.length,0);await assert.rejects(action(repo,other,{action:'job-status',id:job.id,status:'archived'}));});
test('a guessed record id cannot convert a job into an invitation or accept a task',async()=>{const {repo,candidate,employer}=await fixture();await action(repo,employer,{action:'task',title:'API',description:'Describe API approach',spec:'Backend'});const task=(await repo.records('task'))[0];await assert.rejects(action(repo,candidate,{action:'invite-status',id:task.id,status:'accepted'}));await assert.rejects(action(repo,employer,{action:'job-status',id:task.id,status:'archived'}));});
test('all specialization/grade blueprints have six valid questions and no answer keys in client view',()=>{for(const spec of SPECS)for(const grade of GRADES){const attempt=makeTest(spec,grade),view=testView(attempt);assert.equal(attempt.questions.length,6);assert.equal(new Set(attempt.questions.map(q=>q.prompt)).size,6);assert.ok(view.questions.every(q=>!('correct'in q)&&!('explanation'in q)&&!('expected'in q)));assert.ok(attempt.questions.every(q=>q.correct>=0&&q.correct<q.options.length));assert.equal(gradeTest(attempt,attempt.questions.map(q=>q.correct)).score,100);assert.equal(gradeTest(attempt,attempt.questions.map(q=>(q.correct+1)%q.options.length)).score,0);}});
test('parameterized variants differ and grades use different conceptual sets',()=>{const variants=Array.from({length:50},()=>makeTest('Backend','Middle'));assert.ok(new Set(variants.map(v=>JSON.stringify(v.questions.map(q=>({prompt:q.prompt,options:q.options}))))).size>45);const junior=makeTest('Backend','Junior'),senior=makeTest('Backend','Senior');assert.notDeepEqual(junior.questions.slice(0,4).map(q=>q.topic),senior.questions.slice(0,4).map(q=>q.topic));});
test('failed test preserves category; successful change obeys server cooldown',async()=>{const {repo,candidate}=await fixture();let start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});let stored=await repo.record(start.test.id);let r=await finishTimed(repo,candidate,stored.id,false);assert.equal(r.result.passed,false);assert.equal(candidate.profile.grade,'Middle');start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});stored=await repo.record(start.test.id);r=await finishTimed(repo,candidate,stored.id,true);assert.equal(r.result.locked,true);assert.equal(candidate.profile.grade,'Middle');candidate.profile.gradeChangedAt=Date.now()-COOLDOWN-100;await repo.saveAccount(candidate);start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});stored=await repo.record(start.test.id);r=await finishTimed(repo,candidate,stored.id,true);assert.equal(r.result.applied,true);assert.equal(candidate.profile.grade,'Senior');await assert.rejects(action(repo,candidate,{action:'test-answer',id:stored.id,questionIndex:5,answer:0}));});
test('messages require accepted invitation and remain scoped to parties',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));const id=(await repo.scoped('invite',employer.id))[0].id;await assert.rejects(action(repo,employer,{action:'message',contextId:id,text:'Hello'}));await action(repo,candidate,{action:'invite-status',id,status:'accepted'});await action(repo,employer,{action:'message',contextId:id,text:'Hello'});assert.equal((await getState(repo,candidate,'candidate')).messages.length,1);assert.equal((await getState(repo,other,'employer')).messages.length,0);await assert.rejects(action(repo,other,{action:'message',contextId:id,text:'No access'}));});
test('need query strictly scopes confirmed specialization and grade',async()=>{const {repo,employer}=await fixture();const v=await getState(repo,employer,'employer','Middle backend Python PostgreSQL');assert.ok(v.candidates.length>=2);assert.ok(v.candidates.every(c=>c.spec==='Backend'&&c.grade==='Middle'));const ranked=seed.candidates.map(c=>({id:c.id,score:matching(c.profile,parseNeed('Middle backend Python PostgreSQL')).score})).sort((a,b)=>b.score-a.score);assert.equal(ranked[0].id,'demo-1');});

test('anonymous job listing includes published vacancies but excludes archived and ownership fields',async()=>{const {repo,employer}=await fixture();await action(repo,employer,{action:'job',title:'Public API engineer',description:'Work on product API',spec:'Backend',grade:'Middle',stack:'Python',min:150000,max:220000});const job=(await repo.records('job'))[0];let rows=await publicJobs(repo);assert.ok(rows.some(j=>j.id===job.id));assert.ok(rows.every(j=>!('owner'in j)&&!('recipient'in j)));await action(repo,employer,{action:'job-status',id:job.id,status:'archived'});rows=await publicJobs(repo);assert.ok(!rows.some(j=>j.id===job.id));});
test('task solution is reviewed only by its company without changing confirmed grade',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,{action:'task',title:'Query diagnosis',description:'Explain diagnosis and verification',spec:'Backend'});const task=(await repo.records('task'))[0];await action(repo,candidate,{action:'task-answer',id:task.id,answer:'Measure slow queries using EXPLAIN ANALYZE and compare p95 under equivalent load.'});const submission=(await repo.records('submission'))[0];await assert.rejects(action(repo,other,{action:'task-review',id:submission.id,feedback:'Unauthorized review'}));await action(repo,employer,{action:'task-review',id:submission.id,feedback:'Good diagnosis; consider index write cost.'});const view=await getState(repo,candidate);assert.equal(view.submissions[0].status,'reviewed');assert.equal(view.profile.grade,'Middle');assert.equal((await getState(repo,other,'employer')).submissions.length,0);});
test('expired attempt cannot submit answers or alter category',async()=>{const {repo,candidate}=await fixture();const start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});const attempt=await repo.record(start.test.id);attempt.expires=Date.now()-1;await repo.put('test',attempt);await assert.rejects(action(repo,candidate,{action:'test-submit',id:attempt.id,answers:attempt.questions.map(q=>q.correct)}));assert.equal(candidate.profile.score,90);});

test('FSP mock link accepts only fixture IDs and cannot forge registry verification',async()=>{
 const {repo,candidate,employer}=await fixture();
 await assert.rejects(action(repo,employer,{action:'fsp-link',fspId:'DEMO-FSP-001'}));
 for(const fspId of ['FSP-12345','DEMO-FSP-999',''])await assert.rejects(action(repo,candidate,{action:'fsp-link',fspId}));
 await action(repo,candidate,{action:'fsp-link',fspId:'demo-fsp-001',id:employer.id,source:'registry',status:'verified',achievements:[{result:'Winner'}]});
 const saved=await repo.account(candidate.id);
 assert.equal(saved.profile.fsp.source,'demo');assert.equal(saved.profile.fsp.status,'demo');
 assert.equal(saved.profile.fsp.achievements[0].result,'Финалист');
 assert.equal((await repo.account(employer.id)).profile.fsp,undefined);
 await action(repo,candidate,{action:'profile',name:'Candidate',min:100,max:200,stack:'Python',fsp:{source:'registry',status:'verified'}});
 assert.equal(candidate.profile.fsp.source,'demo');assert.equal(candidate.profile.score,90);
});
test('FSP visibility is independent of resume visibility and never grants contacts',async()=>{
 const {repo,candidate,employer}=await fixture();
 await action(repo,candidate,{action:'fsp-link',fspId:'DEMO-FSP-003'});
 let c=(await getState(repo,employer,'employer')).candidates.find(x=>x.id===candidate.id);
 assert.equal(c.fsp.achievements.length,1);assert.equal(c.email,undefined);
 await action(repo,candidate,{action:'settings',visible:true,consent:true,notifications:true,fspVisible:false});
 c=(await getState(repo,employer,'employer')).candidates.find(x=>x.id===candidate.id);
 assert.ok(c);assert.equal(c.fsp,null);assert.equal(c.email,undefined);
 assert.equal((await getState(repo,candidate)).profile.fsp.id,'DEMO-FSP-003');
 assert.ok(publicCandidate({...candidate,privacy:{fspVisible:true}},true).fsp);
 assert.equal(publicCandidate(candidate,true).fsp,null);
});
test('missing or empty FSP history does not block tests, matching, invitation or unlink',async()=>{
 const {repo,candidate,employer}=await fixture();
 const need=parseNeed('Middle backend Python');const score=matching(candidate.profile,need).score;
 await action(repo,candidate,{action:'fsp-link',fspId:'DEMO-FSP-004'});
 assert.equal(candidate.profile.fsp.achievements.length,0);
 assert.equal(matching(candidate.profile,need).score,score);
 await action(repo,employer,invitation(candidate.id));
 const attempt=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});assert.equal(attempt.test.questions.length,1);assert.equal(attempt.test.questionCount,6);
 await action(repo,candidate,{action:'fsp-unlink'});
 assert.equal((await repo.account(candidate.id)).profile.fsp,null);assert.equal(candidate.profile.verified,true);
 assert.ok((await getState(repo,employer,'employer')).candidates.some(x=>x.id===candidate.id));
});
test('public FSP projection excludes adapter secrets and uses canonical synthetic achievements',()=>{
 const fsp=mockFspProfile('DEMO-FSP-001');fsp.token='secret';fsp.achievements[0].result='Forged winner';
 const c=publicCandidate({id:'candidate',profile:{fsp},privacy:{}});
 assert.equal(c.fsp.token,undefined);assert.equal(c.fsp.achievements[0].result,'Финалист');
 assert.equal(publicCandidate({profile:{fsp:{id:'FSP-123',source:'registry',status:'verified'}}}).fsp,null);
 assert.ok(seed.candidates.some(c=>c.profile.fsp.achievements.length===0));
});


test('timed tests reveal only the current question and preserve the deadline on resume or restart',async()=>{
 const {repo,candidate,employer}=await fixture();
 const {test:attempt}=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});
 assert.equal(attempt.questionSeconds,20);assert.equal(attempt.questionCount,6);assert.equal(attempt.questions.length,1);
 assert.ok(attempt.questionExpires-attempt.serverTime<=20000);assert.ok(attempt.questionExpires-attempt.serverTime>19000);
 assert.equal(attempt.answers,undefined);assert.equal(attempt.questions[0].correct,undefined);assert.equal(attempt.questions[0].explanation,undefined);
 const restarted=await action(repo,candidate,{action:'test-start',spec:'QA',grade:'Senior'});
 assert.equal(restarted.test.id,attempt.id);assert.equal(restarted.test.questionExpires,attempt.questionExpires);
 const resumed=await action(repo,candidate,{action:'test-resume',id:attempt.id});assert.equal(resumed.test.questionExpires,attempt.questionExpires);
 assert.equal((await getState(repo,candidate)).activeTest.id,attempt.id);
 await assert.rejects(action(repo,employer,{action:'test-answer',id:attempt.id,questionIndex:0,answer:0}));
 await assert.rejects(action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:1,answer:0}));
 await assert.rejects(action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:0,answer:4}));
 await assert.rejects(action(repo,candidate,{action:'test-submit',id:attempt.id,answers:[0,0,0,0,0,0]}));
});
test('late answers are skipped and replay cannot change an answer or reset the next timer',async()=>{
 const {repo,candidate}=await fixture();const {test:attempt}=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});
 const stored=await repo.record(attempt.id);stored.questionExpires=Date.now()-1;await repo.put('test',stored);
 const next=await action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:0,answer:stored.questions[0].correct});
 assert.equal(next.timedOut,true);assert.equal(next.test.questionIndex,1);assert.equal((await repo.record(attempt.id)).answers[0],null);
 const replay=await action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:0,answer:0});
 assert.equal(replay.test.questionIndex,1);assert.equal(replay.test.questionExpires,next.test.questionExpires);
 for(let i=1;i<6;i++)await action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:i,answer:null});
 const finished=await repo.record(attempt.id);assert.equal(finished.status,'finished');assert.equal(finished.result.score,0);assert.equal(finished.result.skipped,6);
 assert.ok(finished.result.feedback.every(f=>f.skipped));assert.equal(candidate.profile.score,90);assert.equal((await getState(repo,candidate)).activeTest,null);
 assert.equal((await action(repo,candidate,{action:'test-resume',id:attempt.id})).result.skipped,6);
});
test('concurrent submissions commit only once and abandoned attempts cannot be resumed',async()=>{
 const {repo,candidate}=await fixture();const {test:attempt}=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});
 const submissions=await Promise.allSettled([0,1].map(answer=>action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:0,answer})));
 assert.equal(submissions.filter(r=>r.status==='fulfilled').length,1);assert.equal((await repo.record(attempt.id)).questionIndex,1);
 await action(repo,candidate,{action:'test-abandon',id:attempt.id});assert.equal((await getState(repo,candidate)).activeTest,null);
 await assert.rejects(action(repo,candidate,{action:'test-answer',id:attempt.id,questionIndex:1,answer:0}));
 await assert.rejects(action(repo,candidate,{action:'test-resume',id:attempt.id}));
});
