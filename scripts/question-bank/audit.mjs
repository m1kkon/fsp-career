import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {INITIAL_QUESTIONS,MODULES} from '../../lib/question-bank.mjs';
import {DISTRACTOR_REVISIONS} from '../../lib/question-bank-quality.mjs';
import {CODING_QUESTIONS} from '../../lib/coding-bank.mjs';
import {MIXED_CODING_QUESTIONS,MIXED_CODING_SOLUTIONS} from '../../lib/mixed-coding-bank.mjs';
import {validateQuestion,correctAnswer} from '../../lib/assessments.mjs';
import {outputMatches} from '../../lib/code-runner.mjs';
import {executeReferences} from './execute-references.mjs';
export function auditBank(){
 const questions=[...INITIAL_QUESTIONS,...CODING_QUESTIONS,...MIXED_CODING_QUESTIONS];
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 const families=new Map(),prompts=new Map();
 for(const q of questions){
  validateQuestion(q);assert.ok(q.history?.length&&Number.isInteger(q.version)&&q.version>0,q.id+' missing version/history');
  const family=families.get(q.familyId);if(family)assert.equal(family,q.moduleId,q.id+' cross-module family');else families.set(q.familyId,q.moduleId);
  const prompt=q.moduleId+':'+q.prompt.trim(),old=prompts.get(prompt);if(old)assert.equal(old.familyId,q.familyId,q.id+' duplicate statement under a different family');else prompts.set(prompt,q);
  if(q.format!=='coding')assert.ok(correctAnswer(q,q.format==='choice'?q.correct:q.numeric.expected),q.id);
 }
 for(const family of Object.keys(DISTRACTOR_REVISIONS))assert.ok(questions.some(q=>q.familyId===family),family+' stale quality rule');
 for(const m of MODULES){
  const ordinary=INITIAL_QUESTIONS.filter(q=>q.moduleId===m.id);assert.equal(ordinary.length,100,m.id);
  const counts=[0,0,0,0];for(const q of ordinary.filter(q=>q.format==='choice'))counts[q.correct]++;
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,m.id+' answer positions');
  const coding=MIXED_CODING_QUESTIONS.filter(q=>q.moduleId===m.id);
  assert.equal(coding.length,30,m.id);assert.equal(new Set(coding.map(q=>q.familyId)).size,30,m.id+' coding families');
  for(const d of [1,2,3])assert.equal(coding.filter(q=>q.difficulty===d).length,10,m.id+' balanced coding difficulty');
  assert.equal(new Set(coding.map(q=>q.difficulty)).size,3,m.id+' coding difficulty coverage');
  if(m.integration)assert.deepEqual([...new Set(coding.flatMap(q=>q.skills))].sort(),[...m.skills].sort(),m.id+' integrated skill coverage');
 }
 for(const q of MIXED_CODING_QUESTIONS){
  assert.ok(MIXED_CODING_SOLUTIONS.has(q.id),q.id+' missing reference solution');
  assert.equal(q.coding.tests.filter(t=>t.public).length,1,q.id);
  if(!['html','css','react'].includes(q.coding.language))assert.ok(q.coding.tests.some(t=>!t.public),q.id+' missing hidden cases');
  const first=q.coding.tests.find(t=>t.public);
  if(!first.markupRule)assert.ok(outputMatches(first,q.coding.examples[0].output),q.id+' example/key mismatch');
  if(q.id.startsWith('expanded-')){
   assert.equal(q.questionSeconds,300,q.id+' coding timer');
   assert.equal(new Set(q.coding.tests.map(t=>JSON.stringify(t))).size,q.coding.tests.length,q.id+' duplicate checks');
   if(!['html','css'].includes(q.coding.language)){
    assert.ok(q.coding.tests.length>=5,q.id+' insufficient cases');
    assert.equal(new Set(q.coding.tests.map(t=>t.stdin)).size,q.coding.tests.length,q.id+' duplicate fixtures');
    assert.ok(q.coding.tests.some(t=>!t.public&&!outputMatches(t,first.expected)),q.id+' public-output constant passes hidden checks');
   }
  }
 }
 return {questions:questions.length,ordinary:INITIAL_QUESTIONS.length,choice:INITIAL_QUESTIONS.filter(q=>q.format==='choice').length,numeric:INITIAL_QUESTIONS.filter(q=>q.format==='numeric').length,coding:questions.filter(q=>q.format==='coding').length,retired:questions.filter(q=>q.status==='retired').length,checks:questions.filter(q=>q.format==='coding').reduce((s,q)=>s+q.coding.tests.length,0)};
}
export async function executeBankAudit(){
 return executeReferences();
}
if(process.argv[1]===fileURLToPath(import.meta.url)){console.log(JSON.stringify(auditBank(),null,2));if(process.env.CODE_SANDBOX_TESTS==='1')console.log(JSON.stringify(await executeBankAudit()));}
