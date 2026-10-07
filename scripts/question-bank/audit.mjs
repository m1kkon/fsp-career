import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {INITIAL_QUESTIONS,MODULES} from '../../lib/question-bank.mjs';
import {CODING_QUESTIONS} from '../../lib/coding-bank.mjs';
import {MIXED_CODING_QUESTIONS,MIXED_CODING_SOLUTIONS} from '../../lib/mixed-coding-bank.mjs';
import {validateQuestion,correctAnswer} from '../../lib/assessments.mjs';
import {runCode,outputMatches} from '../../lib/code-runner.mjs';
export function auditBank(){
 const questions=[...INITIAL_QUESTIONS,...CODING_QUESTIONS,...MIXED_CODING_QUESTIONS];
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 for(const q of questions){validateQuestion(q);if(q.format!=='coding')assert.ok(correctAnswer(q,q.format==='choice'?q.correct:q.numeric.expected),q.id);}
 for(const m of MODULES){
  const ordinary=INITIAL_QUESTIONS.filter(q=>q.moduleId===m.id);assert.equal(ordinary.length,100,m.id);
  const counts=[0,0,0,0];for(const q of ordinary.filter(q=>q.format==='choice'))counts[q.correct]++;
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,m.id+' answer positions');
  const coding=MIXED_CODING_QUESTIONS.filter(q=>q.moduleId===m.id);
  assert.equal(coding.length,6,m.id);assert.equal(new Set(coding.map(q=>q.familyId)).size,6,m.id+' coding families');
  assert.equal(new Set(coding.map(q=>q.difficulty)).size,3,m.id+' coding difficulty coverage');
  if(m.integration)assert.deepEqual([...new Set(coding.flatMap(q=>q.skills))].sort(),[...m.skills].sort(),m.id+' integrated skill coverage');
 }
 for(const q of MIXED_CODING_QUESTIONS){
  assert.ok(MIXED_CODING_SOLUTIONS.has(q.id),q.id+' missing reference solution');
  assert.equal(q.coding.tests.filter(t=>t.public).length,1,q.id);
  if(!['html','css','react'].includes(q.coding.language))assert.ok(q.coding.tests.some(t=>!t.public),q.id+' missing hidden cases');
  const first=q.coding.tests.find(t=>t.public);
  if(!first.markupRule)assert.ok(outputMatches(first,q.coding.examples[0].output),q.id+' example/key mismatch');
 }
 return {questions:questions.length,ordinary:INITIAL_QUESTIONS.length,choice:INITIAL_QUESTIONS.filter(q=>q.format==='choice').length,numeric:INITIAL_QUESTIONS.filter(q=>q.format==='numeric').length,coding:questions.filter(q=>q.format==='coding').length,retired:questions.filter(q=>q.status==='retired').length,checks:questions.filter(q=>q.format==='coding').reduce((s,q)=>s+q.coding.tests.length,0)};
}
const legacy={python:'import json,sys\nprint(sum(x for x in json.load(sys.stdin) if x%2==0))',javascript:"const fs=require('node:fs');console.log(JSON.stringify([...new Set(JSON.parse(fs.readFileSync(0,'utf8')))]))",typescript:"const fs=require('node:fs');console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).filter(x=>x.status==='active').map(x=>x.id)))",sql:'SELECT customer_id,SUM(amount) FROM orders GROUP BY customer_id HAVING SUM(amount)>100 ORDER BY customer_id;',bash:"sed -n 's/^ERROR //p'",css:'.toolbar{display:flex;gap:16px;align-items:center;}',html:'<form><label for="query">Поиск</label><input id="query" name="query" type="search"><button type="submit">Найти</button></form>',react:'export default function Task(){return <ul><li>Python</li><li>SQL</li></ul>}'};
export async function executeBankAudit(){
 const questions=[...CODING_QUESTIONS,...MIXED_CODING_QUESTIONS];let index=0,checked=0;const failures=[];
 await Promise.all(Array.from({length:3},async()=>{
  while(index<questions.length){
   const q=questions[index++];
   const source=MIXED_CODING_SOLUTIONS.get(q.id)||(q.prompt.includes('двумя знаками')?'import json,sys\nx=json.load(sys.stdin)\nprint(f"{sum(x)/len(x) if x else 0:.2f}")':legacy[q.coding.language]);
   const result=await runCode(q,source);if(!result.correct)failures.push({id:q.id,result});checked++;
   if(checked%20===0)console.log(`Executed ${checked}/${questions.length} coding tasks.`);
  }
 }));assert.deepEqual(failures,[],JSON.stringify(failures));return {executed:checked};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){console.log(JSON.stringify(auditBank(),null,2));if(process.env.CODE_SANDBOX_TESTS==='1')console.log(JSON.stringify(await executeBankAudit()));}
