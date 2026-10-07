import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {INITIAL_QUESTIONS} from '../lib/question-bank.mjs';
const answer=q=>q.format==='numeric'?String(q.numeric.expected):q.options[q.correct];
const family=q=>q.familyId.split(':adaptive-')[1];

test('Python answer keys agree with execution of the actual fixed statements',()=>{
 const printable=new Set(['dict-pop-default','string-strip-length','assertion-failure-flow','late-bound-closure','captured-default-closure','finally-side-effect','generator-send-result','try-else-success-only','boolean-and-value']);
 const expressions=new Set(['negative-index-access','nested-list-alias','dict-setdefault-alias','iterator-partial-read','dict-view-live','default-get-keeps-dict']);
 const cases=INITIAL_QUESTIONS.filter(q=>q.moduleId==='python'&&(printable.has(family(q))||expressions.has(family(q)))).map(q=>{
  let source=q.prompt.replace(/^Python:\s*/,'').replace(/(?:\.\s*|\n)Введите вывод\.$/,'');
  if(expressions.has(family(q))){const match=source.match(/Чему равно (.+)\?$/);if(match)source=source.replace(match[0],'\nprint('+match[1]+')');else if(family(q)==='default-get-keeps-dict')source=source.replace(/Сколько ключей в d после вызова\?$/,'\nprint(len(d))');}
  source=source.replace(/\.\s*\nprint/g,'\nprint');return {id:q.id,source,expected:answer(q)};
 });
 const program='import json,sys,io,contextlib\nresults=[]\nfor case in json.load(sys.stdin):\n    output=io.StringIO()\n    try:\n        with contextlib.redirect_stdout(output): exec(case["source"],{})\n        results.append({"id":case["id"],"output":output.getvalue().strip()})\n    except Exception as e: results.append({"id":case["id"],"error":repr(e)})\nprint(json.dumps(results))';
 const run=spawnSync('python3',['-I','-c',program],{input:JSON.stringify(cases),encoding:'utf8',timeout:10000});assert.equal(run.status,0,run.stderr);
 const results=JSON.parse(run.stdout);assert.equal(results.length,45);
 for(let i=0;i<cases.length;i++)assert.equal(results[i].output,cases[i].expected,cases[i].id+' '+JSON.stringify(results[i]));
});

test('JavaScript answer keys agree with executing expressions, closures and Promise ordering in the fixed statements',async()=>{
 const families=new Set(['const-object-mutation','reduce-initial-value','array-filter-parity','json-array-roundtrip','numeric-sort-comparator','json-undefined-omission','filter-map-order','string-number-add','promise-finally-preserves-value','promise-catch-recovery','then-flatten-promise','object-keys-count','map-overwrite-size','destructuring-default-undefined','destructuring-null-not-default','spread-array-copy','closure-lexical-let','closure-shared-var','microtask-chain-turns','async-await-resume-order','array-hole-map']);
 const cases=INITIAL_QUESTIONS.filter(q=>q.moduleId==='javascript'&&families.has(family(q)));
 for(const q of cases){
  let source=q.prompt.replace(/^JavaScript:\s*/,'');
  if(family(q)==='const-object-mutation')source=source.replace('console.log(a.n). Что выведется?','return a.n;');
  else if(family(q)==='array-hole-map')source=source.replace('. Сколько вызовов callback?','; return calls;');
  else if(['microtask-chain-turns','async-await-resume-order'].includes(family(q)))source=source.replace(/(?:После выполнения микрозадач какой out\?|Какой out после микрозадач\?)/,'await new Promise(resolve=>setTimeout(resolve,0)); return out;');
  else if(source.includes('Чему равно ')){source=source.replace(/\. Чему равно (.+)\?$/,'; return $1;');}
  else if(source.startsWith('чему равно '))source=source.replace(/^чему равно (.+)\?$/,'return $1;');
  else if(source.includes(' равен чему?')){
   if(source.includes(';'))source=source.replace(/; ([^;]+) равен чему\?$/,'; return $1;');else source='return '+source.replace(/ равен чему\?$/,'')+';';
  }else source='return '+source.replace(/\. (?:Введите результат|Какое число получится)\.$|\. Какое число получится\?$/,'')+';';
  source=source.replace(/\. await/g,'; await');
  const result=await vm.runInNewContext('(async()=>{'+source+'})()',{queueMicrotask,setTimeout},{timeout:1000});
  let key=answer(q),expected;try{expected=JSON.parse(key);}catch{expected=Number(key);}
  assert.equal(JSON.stringify(result),JSON.stringify(expected),q.id+' '+source);
 }
 assert.equal(cases.length,63);
});
