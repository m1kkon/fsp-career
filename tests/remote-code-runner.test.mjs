import test from 'node:test';
import assert from 'node:assert/strict';
import {runCode,runCodeInput} from '../lib/code-runner.mjs';
import {CODING_QUESTIONS} from '../lib/coding-bank.mjs';

const question=CODING_QUESTIONS.find(q=>q.coding.language==='python');
const valid=()=>({passed:question.coding.tests.length,total:question.coding.tests.length,correct:true,results:question.coding.tests.map((_,index)=>({index:index+1,passed:true}))});
function remote(t,fetch){
 const previous=globalThis.fetch,url=process.env.CODE_SANDBOX_URL,token=process.env.CODE_SANDBOX_TOKEN;
 globalThis.fetch=fetch;process.env.CODE_SANDBOX_URL='https://sandbox.example.test';process.env.CODE_SANDBOX_TOKEN='test';
 t.after(()=>{globalThis.fetch=previous;if(url===undefined)delete process.env.CODE_SANDBOX_URL;else process.env.CODE_SANDBOX_URL=url;if(token===undefined)delete process.env.CODE_SANDBOX_TOKEN;else process.env.CODE_SANDBOX_TOKEN=token;});
}

test('remote execution shares the four-job limit and releases slots on completion',async t=>{
 const releases=[];
 remote(t,()=>new Promise(resolve=>releases.push(()=>resolve(Response.json(valid())))));
 const jobs=Array.from({length:4},()=>runCode(question,'print(1)'));
 assert.equal(releases.length,4);
 await assert.rejects(runCode(question,'print(1)'),e=>e.status===429);
 releases.forEach(release=>release());await Promise.all(jobs);
 const next=runCode(question,'print(1)');releases.at(-1)();assert.equal((await next).correct,true);
});

test('remote judgements reject inconsistent results instead of assigning a grade',async t=>{
 let response;
 remote(t,async()=>response);
 for(const data of [null,{}, {...valid(),passed:999},{...valid(),correct:false},{...valid(),results:[]}]){
  response=Response.json(data);await assert.rejects(runCode(question,'print(1)'),e=>e.status===502);
 }
 response=new Response('not json');await assert.rejects(runCode(question,'print(1)'),e=>e.status===502);
 response=Response.json(valid());assert.equal((await runCode(question,'print(1)')).correct,true);
});

test('remote custom-input execution validates its own output contract and recovers from worker errors',async t=>{
 let response;
 remote(t,async()=>response);
 response=Response.json(valid());await assert.rejects(runCodeInput(question,'print(1)',''),e=>e.status===502);
 response=Response.json({error:'busy'},{status:503});await assert.rejects(runCode(question,'print(1)'),e=>e.status===503);
 response=Response.json({stdout:'1\n',stderr:'',exitCode:0});assert.equal((await runCodeInput(question,'print(1)','')).stdout,'1\n');
});
