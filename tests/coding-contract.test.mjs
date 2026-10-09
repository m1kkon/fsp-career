import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CODING_QUESTIONS} from '../lib/coding-bank.mjs';
import {MIXED_CODING_QUESTIONS} from '../lib/mixed-coding-bank.mjs';
import {codingContract} from '../lib/coding-contract.mjs';
import {validateQuestion,assessmentView} from '../lib/assessments.mjs';
import {outputMatches} from '../lib/code-runner.mjs';

test('all skill and role coding tasks provide input/output schemas and public examples matching their judge',()=>{
 for(const q of [...CODING_QUESTIONS,...MIXED_CODING_QUESTIONS]){
  const c=validateQuestion(q).coding;
  assert.ok(c.inputFormat.trim(),q.id);assert.ok(c.outputFormat.trim(),q.id);assert.ok(c.examples.length,q.id);
  const check=c.tests.find(t=>t.public);
  if(!check.contains&&!check.markupRule){
   assert.ok(outputMatches(check,c.examples[0].output),q.id+' example output must pass the actual comparator');
   if(check.comparison==='json')assert.deepEqual(JSON.parse(c.examples[0].input),JSON.parse(check.stdin));
   else if(c.language==='sql'||c.language==='bash')assert.equal(c.examples[0].input,check.stdin);
  }
 }
 const mean=CODING_QUESTIONS.find(q=>q.moduleId==='statistics');assert.equal(mean.coding.examples[0].output,'2.00');
 const topology=MIXED_CODING_QUESTIONS.find(q=>q.id==='mixed-coding-javascript-topological-v1');assert.match(topology.coding.inputFormat,/nodes.*edges/);assert.match(topology.coding.outputFormat,/null/);
});

test('maintainers must supply schemas and examples; whitespace and optional explanations survive saving',()=>{
 const q=structuredClone(MIXED_CODING_QUESTIONS[0]);
 for(const key of ['inputFormat','outputFormat','examples']){const broken=structuredClone(q);delete broken.coding[key];assert.throws(()=>validateQuestion(broken));}
 for(const examples of [[],[{}],[{input:1,output:'1'}],[{input:'[]',output:'0',explanation:1}]])assert.throws(()=>validateQuestion({...q,coding:{...q.coding,examples}}));
 q.coding.examples=[{input:' []\n',output:'0\n',explanation:'Пустой массив даёт 0.'}];
 assert.deepEqual(validateQuestion(q).coding.examples,q.coding.examples);
});

test('old frozen attempts derive public examples without revealing hidden checks or changing the snapshot',()=>{
 const q=structuredClone(MIXED_CODING_QUESTIONS[0]);
 delete q.coding.inputFormat;delete q.coding.outputFormat;delete q.coding.examples;
 q.coding.tests=[{stdin:'[1,2]',expected:'2',public:true,comparison:'json'},{stdin:'HIDDEN_INPUT',expected:'HIDDEN_KEY',public:false}];
 const snapshot=structuredClone(q),m={moduleId:'python',status:'active',spec:{scoredCount:1},questions:[q],activeQuestionId:q.id,answers:{},seconds:300};
 const shown=assessmentView({id:'old',targetKind:'skill',status:'active',modules:[m],moduleIndex:0}).currentModule.questions[0];
 assert.deepEqual(q,snapshot);
 assert.equal(shown.coding.examples.length,1);assert.equal(shown.coding.tests.length,1);
 assert.ok(shown.coding.inputFormat);assert.ok(shown.coding.outputFormat);
 assert.doesNotMatch(JSON.stringify(shown),/HIDDEN_INPUT|HIDDEN_KEY/);
 assert.equal(codingContract(q.coding).examples[0].output,'2');
});
