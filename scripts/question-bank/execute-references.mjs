import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {CODING_QUESTIONS} from '../../lib/coding-bank.mjs';
import {MIXED_CODING_QUESTIONS,MIXED_CODING_SOLUTIONS} from '../../lib/mixed-coding-bank.mjs';
import {sandboxArguments,CODE_IMAGE,outputMatches} from '../../lib/code-runner.mjs';
// Only trusted, repository-owned reference solutions enter this offline batch.
// Each program receives a fresh process. SQL fixtures are isolated by rollback.
// Candidate execution continues to use a separate disposable container per run.
const driver=String.raw`import json,sys,subprocess,os
cases=json.load(sys.stdin)
if any(c['language']=='sql' for c in cases):
    pg='/usr/lib/postgresql/15/bin/'
    subprocess.run([pg+'initdb','-D','/tmp/pg','-A','trust','--no-locale'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
    subprocess.run([pg+'pg_ctl','-D','/tmp/pg','-l','/tmp/pg.log','-o',"-h '' -k /tmp",'start'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
results=[]
for c in cases:
    cmd=c['command']; inp=c['stdin']
    if c['language']=='sql':
        cmd=[pg+'psql','-h','/tmp','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
        inp='BEGIN;\n'+inp+'\n'+c['source']+'\n;ROLLBACK;'
    try:
        r=subprocess.run(cmd,input=inp,text=True,capture_output=True,timeout=6)
        results.append({'id':c['id'],'index':c['index'],'stdout':r.stdout,'stderr':r.stderr,'code':r.returncode})
    except Exception as e: results.append({'id':c['id'],'index':c['index'],'code':-1,'stdout':'','stderr':str(e)})
print(json.dumps(results))`;
const legacy={python:'import json,sys\nprint(sum(x for x in json.load(sys.stdin) if x%2==0))',javascript:"const fs=require('node:fs');console.log(JSON.stringify([...new Set(JSON.parse(fs.readFileSync(0,'utf8')))]))",typescript:"const fs=require('node:fs');console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).filter(x=>x.status==='active').map(x=>x.id)))",sql:'SELECT customer_id,SUM(amount) FROM orders GROUP BY customer_id HAVING SUM(amount)>100 ORDER BY customer_id;',bash:"sed -n 's/^ERROR //p'",css:'.toolbar{display:flex;gap:16px;align-items:center;}',html:'<form><label for="query">Поиск</label><input id="query" name="query" type="search"><button type="submit">Найти</button></form>',react:'export default function Task(){return <ul><li>Python</li><li>SQL</li></ul>}'};
function batch(cases){
 const name='fsp-bank-audit-'+randomUUID(),args=sandboxArguments(name,'python',driver);
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>{child.kill('SIGKILL');const cleanup=spawn('docker',['rm','-f',name],{stdio:'ignore'});cleanup.on('error',()=>{});reject(new Error('Reference audit timeout'));},120000);
  child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.stdin.on('error',()=>{});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error(err||out));try{resolve(JSON.parse(out));}catch(e){reject(e);}});child.stdin.end(JSON.stringify(cases));
 });
}
export async function executeReferences(){
 const questions=[...CODING_QUESTIONS,...MIXED_CODING_QUESTIONS],byId=new Map(questions.map(q=>[q.id,q]));
 const cases=questions.flatMap(q=>{
  const source=MIXED_CODING_SOLUTIONS.get(q.id)||(q.prompt.includes('двумя знаками')?'import json,sys\nx=json.load(sys.stdin)\nprint(f"{sum(x)/len(x) if x else 0:.2f}")':legacy[q.coding.language]);
  const args=sandboxArguments('unused',q.coding.language,source),command=args.slice(args.indexOf(CODE_IMAGE)+1);
  return q.coding.tests.map((test,index)=>({id:q.id,index,language:q.coding.language,command,source,stdin:test.stdin}));
 });
 const chunks=[];
 // SQL is grouped separately so only its batches pay database initialization cost.
 for(const language of [...new Set(cases.map(c=>c.language))]){const group=cases.filter(c=>c.language===language);for(let i=0;i<group.length;i+=40)chunks.push(group.slice(i,i+40));}
 let cursor=0,checked=0;const failures=[];
 await Promise.all(Array.from({length:3},async()=>{while(cursor<chunks.length){const chunk=chunks[cursor++],results=await batch(chunk);assert.equal(results.length,chunk.length);for(const r of results){const test=byId.get(r.id).coding.tests[r.index];if(r.code!==0||!outputMatches(test,r.stdout))failures.push({...r,expected:test.expected});}checked+=results.length;console.log(`Reference checks ${checked}/${cases.length}`);}}));
 if(failures.length)console.error(JSON.stringify(failures,null,2));
 assert.equal(failures.length,0,'Reference solution/key mismatches');
 return {questions:questions.length,checks:checked,languages:8};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await executeReferences()));
