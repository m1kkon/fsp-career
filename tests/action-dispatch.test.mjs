import test from 'node:test';
import assert from 'node:assert/strict';
import {executeAccountAction} from '../lib/action-dispatch.mjs';
import {memoryRepository,serializedWriter,candidateAccount,codingAttempt,successfulJudge,deferred} from './helpers/tz-memory.mjs';

async function fixture(){const repo=memoryRepository(),a=await candidateAccount(repo),coding=await codingAttempt(repo,a);return {repo,a,...coding,write:serializedWriter(repo)};}
test('external judge never holds the write lock: another account saves while execution is pending',async()=>{
 const f=await fixture(),other=await candidateAccount(f.repo,'other'),entered=deferred(),release=deferred();let held=false;
 const serialized=f.write,write=fn=>serialized(async repo=>{held=true;try{return await fn(repo);}finally{held=false;}});
 const pending=executeAccountAction(f.a.id,f.body,{write,judge:async q=>{assert.equal(held,false);entered.resolve();await release.promise;return successfulJudge(q);}});
 await entered.promise;try{await executeAccountAction(other.id,{action:'profile',about:'Unrelated save completed'},{write});assert.equal((await f.repo.account(other.id)).profile.about,'Unrelated save completed');assert.equal((await f.repo.record(f.attempt.id)).revision,0);}finally{release.resolve();}
 await pending;assert.equal((await f.repo.record(f.attempt.id)).revision,1);
});
test('stale revisions and foreign ownership are rejected before invoking the worker',async()=>{
 const f=await fixture();await candidateAccount(f.repo,'foreign');let calls=0;const judge=async q=>{calls++;return successfulJudge(q);};
 await assert.rejects(executeAccountAction(f.a.id,{...f.body,revision:9},{write:f.write,judge}),e=>e.status===409);
 await assert.rejects(executeAccountAction('foreign',f.body,{write:f.write,judge}),e=>e.status===404);
 assert.equal(calls,0);assert.equal((await f.repo.record(f.attempt.id)).revision,0);
});
test('worker failure leaves submissions and revision untouched and permits a retry',async()=>{
 const f=await fixture();await assert.rejects(executeAccountAction(f.a.id,f.body,{write:f.write,judge:async()=>{throw Object.assign(new Error('worker unavailable'),{status:503});}}),e=>e.status===503);
 assert.equal((await f.repo.record(f.attempt.id)).revision,0);assert.equal((await f.repo.record(f.attempt.id)).modules[0].codingSubmissions,undefined);
 await executeAccountAction(f.a.id,f.body,{write:f.write,judge:successfulJudge});assert.equal((await f.repo.record(f.attempt.id)).revision,1);
});
test('concurrent judgments based on one revision cannot both commit',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred();let calls=0;
 const judge=async q=>{if(++calls===2)entered.resolve();await release.promise;return successfulJudge(q);};
 const pending=[1,2].map(n=>executeAccountAction(f.a.id,{...f.body,submissionId:'concurrent-000'+n},{write:f.write,judge}));
 await entered.promise;release.resolve();const replies=await Promise.allSettled(pending);
 assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.equal(replies.find(r=>r.status==='rejected').reason.status,409);assert.equal((await f.repo.record(f.attempt.id)).modules[0].codingSubmissions[f.question.id].length,1);
});
test('a draft saved during judging invalidates the old result without losing the new draft',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred();const pending=executeAccountAction(f.a.id,f.body,{write:f.write,judge:async q=>{entered.resolve();await release.promise;return successfulJudge(q);}});
 await entered.promise;await executeAccountAction(f.a.id,{action:'assessment-draft',id:f.attempt.id,revision:0,questionId:f.question.id,answer:'print(2)'},{write:f.write});release.resolve();await assert.rejects(pending,e=>e.status===409);
 const saved=await f.repo.record(f.attempt.id);assert.equal(saved.modules[0].codingDrafts[f.question.id],'print(2)');assert.equal(saved.modules[0].codingSubmissions,undefined);
});
test('timely submission remains valid when judge finishes after deadline; late submission is refused',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred();const originalNow=Date.now;let at=originalNow();Date.now=()=>at;
 try{const saved=await f.repo.record(f.attempt.id);saved.modules[0].expiresAt=at+100;await f.repo.put('assessment',saved);
 const pending=executeAccountAction(f.a.id,f.body,{write:f.write,judge:async q=>{entered.resolve();await release.promise;return successfulJudge(q);}});await entered.promise;at+=101;release.resolve();await pending;
 assert.equal((await f.repo.record(f.attempt.id)).modules[0].answers[f.question.id].value.correct,true);
 const late=await candidateAccount(f.repo,'late');const l=await codingAttempt(f.repo,late,{expiresAt:at-1});let calls=0;await assert.rejects(executeAccountAction(late.id,l.body,{write:f.write,judge:async q=>{calls++;return successfulJudge(q);}}),e=>e.status===409);assert.equal(calls,0);
 }finally{Date.now=originalNow;release.resolve();}
});
test('three-send limit and idempotent retry do not run the judge again',async()=>{
 const f=await fixture();let calls=0;const judge=async q=>{calls++;return successfulJudge(q);};
 for(let i=0;i<3;i++)await executeAccountAction(f.a.id,{...f.body,revision:i,submissionId:'submission-000'+i},{write:f.write,judge});
 await executeAccountAction(f.a.id,{...f.body,revision:3,submissionId:'submission-0002'},{write:f.write,judge});
 await assert.rejects(executeAccountAction(f.a.id,{...f.body,revision:3,submissionId:'submission-0003'},{write:f.write,judge}),e=>e.status===409);assert.equal(calls,3);assert.equal((await f.repo.record(f.attempt.id)).revision,3);
});
test('custom input run executes outside writes and does not change assessment',async()=>{
 const f=await fixture();let writes=0;const write=fn=>{writes++;return f.write(fn);};
 const reply=await executeAccountAction(f.a.id,{...f.body,action:'assessment-run-code',stdin:'42\n'},{write,runInput:async(q,source,stdin)=>{assert.equal(writes,1);assert.equal(stdin,'42\n');return {stdout:'42\n',exitCode:0};}});
 assert.equal(reply.run.stdout,'42\n');assert.equal(writes,1);assert.equal((await f.repo.record(f.attempt.id)).revision,0);
});
test('exact submission retry survives stale revision and question closure, while changed source conflicts',async()=>{
 const f=await fixture();let calls=0;const judge=async q=>{calls++;return successfulJudge(q);};
 await executeAccountAction(f.a.id,f.body,{write:f.write,judge});
 await executeAccountAction(f.a.id,f.body,{write:f.write,judge});
 await executeAccountAction(f.a.id,{action:'assessment-answer',id:f.attempt.id,revision:1,questionId:f.question.id,answer:null},{write:f.write});
 const finished=await f.repo.record(f.attempt.id);assert.equal(finished.status,'finished');
 const retried=await executeAccountAction(f.a.id,f.body,{write:f.write,judge});assert.equal(retried.assessment.status,'finished');assert.equal(calls,1);assert.equal((await f.repo.record(f.attempt.id)).revision,finished.revision);
 await assert.rejects(executeAccountAction(f.a.id,{...f.body,source:'print(2)'},{write:f.write,judge}),e=>e.status===409);
 assert.equal(calls,1);
});
