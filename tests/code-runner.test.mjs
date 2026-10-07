import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sandboxArguments,runCode} from '../lib/code-runner.mjs';
import {CODING_QUESTIONS} from '../lib/coding-bank.mjs';
import {validateQuestion,correctAnswer} from '../lib/assessments.mjs';
test('coding bank validates and every module has a coding task',()=>{
 assert.equal(new Set(CODING_QUESTIONS.map(q=>q.moduleId)).size,18);
 for(const q of CODING_QUESTIONS)assert.equal(validateQuestion(q).format,'coding');
 assert.equal(correctAnswer(CODING_QUESTIONS[0],{correct:true}),false);
});
test('sandbox has network, filesystem, privileges and resource isolation and never uses a host shell',()=>{
 const args=sandboxArguments('fsp-code-test','python','print(1)');
 for(const flag of ['--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=256m','--cpus=1','--user=1000:1000'])assert.ok(args.includes(flag));
 assert.ok(!args.includes('-v'));assert.ok(args.includes('print(1)'));
});
const enabled=process.env.CODE_SANDBOX_TESTS==='1';
const solutions={python:'import json,sys\nprint(sum(x for x in json.load(sys.stdin) if x%2==0))',javascript:"const fs=require('node:fs');console.log(JSON.stringify([...new Set(JSON.parse(fs.readFileSync(0,'utf8')))]))",typescript:"const fs=require('node:fs');const x: {id:number,status:string}[]=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(x.filter(v=>v.status==='active').map(v=>v.id)))",sql:'SELECT customer_id,SUM(amount) FROM orders GROUP BY customer_id HAVING SUM(amount)>100 ORDER BY customer_id;',bash:"while IFS= read -r line; do if [[ $line == 'ERROR '* ]]; then printf '%s\\n' \"${line#ERROR }\"; fi; done",css:'.toolbar { display: flex; gap: 16px; align-items: center; }',html:'<form><label for="query">Поиск</label><input id="query" type="search" name="query"><button type="submit">Найти</button></form>',react:'export default function Skills(){return <ul><li>Python</li><li>SQL</li></ul>;}'};
for(const [language,source] of Object.entries(solutions))test('real isolated execution and grading: '+language,{skip:!enabled},async()=>{
 const q=CODING_QUESTIONS.find(q=>q.coding.language===language);const run=await runCode(q,source);assert.equal(run.correct,true,JSON.stringify(run));
});
test('real sandbox enforces timeout and never treats a crashed submission as correct',{skip:!enabled},async()=>{const q=CODING_QUESTIONS.find(q=>q.coding.language==='javascript');assert.equal((await runCode(q,'while(true){}',{publicOnly:true})).correct,false);});
