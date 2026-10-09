import {markupMatches} from './markup-checks.mjs';
import {isDeepStrictEqual} from 'node:util';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {httpError} from './http.mjs';
export const CODE_LANGUAGES=['python','javascript','typescript','sql','bash','html','css','react'];
export const CODE_IMAGE=process.env.CODE_SANDBOX_IMAGE||'fsp-code-sandbox:local';
let active=0;
const normalize=s=>String(s).replace(/\r/g,'').trim();
export function outputMatches(test,stdout){if(test.markupRule)return markupMatches(test.markupRule,stdout,test.expected);if(test.contains)return test.contains.every(s=>stdout.includes(s));if(test.comparison==='json'){try{return isDeepStrictEqual(JSON.parse(stdout),JSON.parse(test.expected));}catch{return false;}}return normalize(stdout)===normalize(test.expected);}
export function sandboxArguments(name,language,source){
 const commands={python:['python3','-I','-c',source],javascript:['node','-e',source],typescript:['node','-e',`const ts=require('/opt/runtime/node_modules/typescript');const code=ts.transpileModule(${JSON.stringify(source)},{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;require('node:vm').runInThisContext(code);`],sql:['python3','/opt/runtime/sql.py',source],bash:['bash','--noprofile','--norc','-c',source],html:['node','-e',`process.stdout.write(${JSON.stringify(source)})`],css:['node','-e',`process.stdout.write(${JSON.stringify(source)})`],react:['node','-e',`const ts=require('/opt/runtime/node_modules/typescript');const source=${JSON.stringify(source)};const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const React=require('/opt/runtime/node_modules/react');const module={exports:{}};new Function('React','module','exports','require',code)(React,module,module.exports,require);const Component=module.exports.default||module.exports;process.stdout.write(require('/opt/runtime/node_modules/react-dom/server').renderToStaticMarkup(React.createElement(Component,JSON.parse(require('node:fs').readFileSync(0,'utf8')||'{}'))));`]};
 return ['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=256m','--memory-swap=256m','--cpus=1','--user=1000:1000','--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777','--workdir=/opt/runtime','-i',CODE_IMAGE,...commands[language]];
}
async function execute(language,source,input,signal){
 const name='fsp-code-'+randomUUID();
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',sandboxArguments(name,language,source),{stdio:['pipe','pipe','pipe'],shell:false});
  let stdout='',stderr='',size=0,limited=false,settled=false;
  const stop=()=>{if(limited)return;limited=true;child.kill('SIGKILL');const cleanup=spawn('docker',['rm','-f',name],{stdio:'ignore'});cleanup.on('error',()=>{});};
  const timer=setTimeout(stop,8000);signal?.addEventListener('abort',stop,{once:true});
  for(const [stream,key] of [[child.stdout,'out'],[child.stderr,'err']])stream.on('data',chunk=>{size+=chunk.length;if(size>32768){stop();return;}if(key==='out')stdout+=chunk;else stderr+=chunk;});
  child.stdin.on('error',()=>{});child.stdin.end(input||'');
  const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);};
  child.on('error',()=>{if(settled)return;settled=true;finish();reject(httpError('Песочница недоступна. Запустите Docker и подготовьте образ.',503));});
  child.on('close',code=>{if(settled)return;settled=true;finish();if(!limited&&(code===125||stderr.includes('Cannot connect to the Docker daemon')))reject(httpError('Песочница недоступна. Подготовьте образ fsp-code-sandbox:local.',503));else resolve({stdout,stderr:limited?'Превышен лимит времени или вывода.':stderr,exitCode:code??-1});});
 });
}
/** @param {{publicOnly?: boolean, signal?: AbortSignal, stdin?: string}} options */
export async function runCode(question,source,options={}){
 const {publicOnly=false,signal,stdin}=options;
 if(!question?.coding||!CODE_LANGUAGES.includes(question.coding.language))throw httpError('Некорректное задание на кодинг.');
 if(typeof source!=='string'||!source.trim()||Buffer.byteLength(source)>20000)throw httpError('Введите код (не более 20 КБ).');
 if(stdin!==undefined&&(typeof stdin!=='string'||Buffer.byteLength(stdin)>8000))throw httpError('Ввод должен быть текстом не более 8 КБ.');
 if(active>=4)throw httpError('Песочница занята. Попробуйте через несколько секунд.',429);
 if(process.env.CODE_SANDBOX_URL){const response=await fetch(process.env.CODE_SANDBOX_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.CODE_SANDBOX_TOKEN},body:JSON.stringify({question,source,publicOnly,...(stdin!==undefined?{stdin}:{})}),signal:signal||AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw httpError(data.error||'Песочница недоступна.',response.status);return data;}
 active++;
 try{
  if(stdin!==undefined)return await execute(question.coding.language,source,stdin,signal);
  const tests=question.coding.tests.filter(t=>!publicOnly||t.public);
  const results=[];
  for(const [index,test] of tests.entries()){
   if(signal?.aborted)throw httpError('Запуск отменён.',499);
   const output=await execute(question.coding.language,source,test.stdin,signal);
   const passed=output.exitCode===0&&outputMatches(test,output.stdout);
   results.push({index: index+1,passed,...(publicOnly?{input:test.stdin,expected:test.expected,stdout:output.stdout,stderr:output.stderr,exitCode:output.exitCode}:{})});
  }
  return {passed:results.filter(r=>r.passed).length,total:results.length,correct:results.length>0&&results.every(r=>r.passed),results};
 }finally{active--;}
}
export function runCodeInput(question,source,stdin,options={}){return runCode({coding:{language:question.coding.language,tests:[]}},source,{...options,stdin});}
