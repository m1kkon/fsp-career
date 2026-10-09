import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRepository} from '../lib/demo-memory.mjs';
import {ensureDailyPool} from '../lib/assessments.mjs';

test('demo assessments use the immutable daily pool and allow a direct start only once',async()=>{
 delete globalThis.__fspDemoStore;
 const repo=demoRepository(),at=Date.UTC(2026,9,9,12);
 const day=await ensureDailyPool(repo,at);
 assert.equal(day.status,'published');
 assert.deepEqual(await ensureDailyPool(repo,at),day);
 assert.equal(await repo.startAssessment({id:'direct-demo',owner:'local-demo-user',status:'active',revision:1},null),true);
 assert.equal(await repo.startAssessment({id:'duplicate-demo',owner:'local-demo-user',status:'active'},null),false);
 assert.equal(await repo.record('duplicate-demo'),undefined);
});

test('demo bookings keep ownership and claim the existing registration atomically',async()=>{
 delete globalThis.__fspDemoStore;
 const repo=demoRepository();
 await repo.put('assessment-registration',{id:'booking',owner:'candidate-a',status:'registered'});
 assert.equal(await repo.startAssessment({id:'wrong-owner',owner:'candidate-b',status:'active'},{id:'booking'}),false);
 assert.equal((await repo.record('booking')).status,'registered');
 assert.equal(await repo.startAssessment({id:'booked',owner:'candidate-a',status:'active'},{id:'booking'}),true);
 assert.equal((await repo.record('booking')).attemptId,'booked');
 assert.equal(await repo.startAssessment({id:'repeat',owner:'candidate-a',status:'active'},{id:'booking'}),false);
});
