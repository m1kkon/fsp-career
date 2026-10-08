import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/api-access.js',import.meta.url),'utf8');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function client(requestData){
 const context=vm.createContext({state:{user:{id:'owner'}},page:'api-access',busy:false,Date,JSON,Number,requestData,esc,title:(h,p)=>h+p,button:(label,action,extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`,date:()=> 'date',render(){},modal(h,p,body){context.dialog={h,p,body};},close(){context.dialog=null;},toast(){},overlay:{querySelector:()=>null}});vm.runInContext(source,context);return context;
}
test('issuing an API key shows it only in the dialog and never caches it with key metadata',async()=>{
 const token='fsp_live_'+'a'.repeat(64),key={id:'key',name:'<script>bad</script>',prefix:token.slice(0,17),scopes:['read'],expires:Date.now()+10000,lastUsed:null};let captured;
 const c=client(async(path,options)=>{captured={path,body:JSON.parse(options.body)};return{key,token};});
 const submit={disabled:false},form={querySelector:()=>submit};await c.issueApiKey(form,{name:'HR',scope:'read',days:'30'});
 assert.deepEqual(captured,{path:'/api/keys',body:{name:'HR',scopes:['read'],expiresInDays:30}});assert.ok(c.dialog.body.includes(token));assert.equal(c.busy,false);assert.equal(submit.disabled,false);
 assert.ok(!vm.runInContext('JSON.stringify(apiAccessCache)',c).includes(token));assert.ok(!c.apiAccessPage().includes(token));assert.ok(c.apiAccessPage().includes('&lt;script&gt;bad&lt;/script&gt;'));
});
test('a stale key response cannot show a token or metadata in another user session',async()=>{
 let resolve;const c=client(()=>new Promise(r=>{resolve=r;}));const submit={disabled:false},form={querySelector:()=>submit};
 const pending=c.issueApiKey(form,{name:'HR',scope:'write',days:'90'});c.state.user.id='other';resolve({key:{id:'secret-key'},token:'fsp_live_'+'b'.repeat(64)});await pending;
 assert.equal(c.dialog,null);assert.ok(!vm.runInContext('JSON.stringify(apiAccessCache)',c).includes('secret-key'));
 let finish;const loading=client(()=>new Promise(r=>{finish=r;}));const load=loading.loadApiAccess();loading.state.user.id='other';finish({keys:[{name:'Previous owner'}]});await load;
 assert.ok(!vm.runInContext('JSON.stringify(apiAccessCache)',loading).includes('Previous owner'));
});
test('revocation requires the chosen key and sends an owner-session DELETE, then reloads metadata',async()=>{
 const calls=[],c=client(async(path,options)=>{calls.push({path,options});return options.method==='DELETE'?{revoked:true}:{keys:[]};});
 await c.revokeApiAccess('key-id');assert.equal(calls[0].path,'/api/keys');assert.equal(calls[0].options.method,'DELETE');assert.deepEqual(JSON.parse(calls[0].options.body),{id:'key-id'});assert.equal(calls[1].options.cache,'no-store');assert.equal(c.busy,false);
});
