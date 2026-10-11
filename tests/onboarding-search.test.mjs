import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as history from '../public/resume-history.mjs';
import {citySuggestions,canonicalCity,loadWorldCities,worldCitiesReady} from '../public/cities.mjs';

const source=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^boot\(\);$/m,'');
const assessment=readFileSync(new URL('../public/assessments.js',import.meta.url),'utf8');
const cities=readFileSync(new URL('../public/city-autocomplete.js',import.meta.url),'utf8');
const key='fsp-home-search-draft-v1';
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function client(sessionStorage=storage()){
 const element={innerHTML:'',firstElementChild:null,querySelector:()=>null};
 const events={};
 const context=vm.createContext({...history,citySuggestions,canonicalCity,loadWorldCities,worldCitiesReady,sessionStorage,element,events,
  document:{getElementById:()=>element,querySelector:()=>null,addEventListener:(name,handler)=>(events[name]??=[]).push(handler),body:{classList:{add(){},remove(){}}}},
  window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:()=>null,setItem(){}},location:{hash:''},setTimeout,clearTimeout,setInterval(){},
  FormData:class {constructor(form){this.values=form.values||{};}*[Symbol.iterator](){yield*Object.entries(this.values);}}
 });
 vm.runInContext(assessment+'\n'+cities+'\n'+source,context);
 vm.runInContext('render=()=>{};modal=(title,description,body)=>{globalThis.dialog={title,description,body};element.firstElementChild={};};close=()=>{element.firstElementChild=null;};toast=()=>{};',context);
 return context;
}
const run=(context,code)=>vm.runInContext(code,context);
const plain=value=>JSON.parse(JSON.stringify(value));
function form(id,dataset={},values={}){return {id,dataset,values,elements:{consent:{checked:true},formatRequired:{checked:false},locationRequired:{checked:false}},querySelector:selector=>selector==='[data-error]'?{textContent:'',focus(){}}:{textContent:'Продолжить',setAttribute(){},removeAttribute(){}},querySelectorAll:()=>[]};}
async function submit(context,target){await context.events.submit[0]({target,preventDefault(){}});}

test('employer search explains the actual next step and leaves returning employers without setup instructions',()=>{
 const context=client();
 for(const [authenticated,roles,label] of [[false,[],'Войти и подобрать'],[true,['candidate'],'Создать кабинет'],[true,['employer'],'Подобрать']]){
  context.payload={authenticated,roles};run(context,'state={...emptyState(),...payload};homeMode="employer"');
  const html=run(context,'home()');assert.ok(html.includes(`type="submit">${label}</button>`));
  assert.equal(html.includes('id="home-search-note"'),!roles.includes('employer'));
 }
 const candidate=run(context,'homeMode="candidate";home()');assert.ok(candidate.includes('Найти работу'));assert.ok(!candidate.includes('home-search-note'));
});

test('a submitted query survives reload with location, excludes account form data, and expires after a day',()=>{
 const saved=storage(),first=client(saved);
 run(first,'state={...emptyState(),authenticated:true,user:{id:"owner"},roles:["candidate"]};locationPreference={city:"Москва",format:"Удалённо"};searchFromHome("Middle Backend Python");');
 const draft=JSON.parse(saved.getItem(key));assert.deepEqual(Object.keys(draft).sort(),['accountId','active','city','format','query','savedAt','version']);assert.equal(draft.accountId,'owner');
 const reloaded=client(saved);run(reloaded,'state={...emptyState(),authenticated:true,user:{id:"owner"}}');assert.equal(run(reloaded,'restoreHomeSearchDraft()'),true);
 assert.deepEqual(plain(run(reloaded,'({query,city:needContext.city,format:needContext.format,pendingHomeSearch})')),{query:'Middle Backend Python',city:'Москва',format:'Удалённо',pendingHomeSearch:true});
 saved.setItem(key,JSON.stringify({...draft,savedAt:Date.now()-86400001}));assert.equal(run(reloaded,'restoreHomeSearchDraft()'),false);assert.equal(saved.getItem(key),null);
});

test('corrupt, wrong-account and unavailable storage cannot break onboarding or restore another account request',()=>{
 const saved=storage(),context=client(saved);
 run(context,'state={...emptyState(),authenticated:true,user:{id:"owner"},roles:["candidate"]};searchFromHome("Python Backend");');
 const draft=JSON.parse(saved.getItem(key));
 for(const invalid of [{...draft,accountId:'someone-else'},{...draft,query:'x'.repeat(1001)},{...draft,format:'invalid'},'broken-json']){
  saved.setItem(key,typeof invalid==='string'?invalid:JSON.stringify(invalid));assert.equal(run(context,'restoreHomeSearchDraft()'),false);assert.equal(saved.getItem(key),null);
 }
 const unavailable=client({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
 assert.doesNotThrow(()=>run(unavailable,'state={...emptyState(),authenticated:true,roles:["candidate"]};searchFromHome("SQL Backend");'));
 assert.equal(run(unavailable,'restoreHomeSearchDraft()'),false);assert.match(unavailable.dialog.body,/SQL Backend/);
});

test('auth, registration, verification and company forms keep the same escaped request and catalogue destination',async()=>{
 const context=client();run(context,'query="Python <script>bad()</script>";pendingHomeSearch=true;role="employer";authModal("employer");');
 assert.match(context.dialog.body,/data-next="catalog"/);assert.match(context.dialog.body,/Python &lt;script&gt;bad\(\)&lt;\/script&gt;/);assert.doesNotMatch(context.dialog.body,/<script>/);
 run(context,'authModal("employer","catalog",true)');assert.match(context.dialog.body,/data-next="catalog"/);
 context.requestData=async()=>({pendingVerification:true,email:'user@example.test',emailQueued:true});
 context.form=form('auth-form',{role:'employer',next:'catalog',register:'true'});
 await run(context,'submitAuth(form,{email:"user@example.test",password:"long-password",passwordConfirmation:"long-password",terms:"on"})');
 assert.match(context.dialog.body,/data-action="login" data-role="employer" data-next="catalog"/);
 context.requestData=async()=>({message:'Email подтверждён.'});context.form=form('email-link-form',{action:'verify-email'});
 await run(context,'submitEmailForm(form,{})');assert.match(context.dialog.body,/data-next="catalog"/);assert.match(context.dialog.body,/Ваш запрос/);
 run(context,'state={...emptyState(),authenticated:true,user:{email:"user@example.test"},roles:["candidate"]};onboarding("employer","catalog")');
 assert.match(context.dialog.body,/data-next="catalog"/);assert.match(context.dialog.body,/Создать кабинет и продолжить/);
});

test('successful login binds the search draft to the account, and creating its company continues the search exactly once',async()=>{
 const saved=storage(),context=client(saved);run(context,'query="Middle Backend Python";pendingHomeSearch=true;saveHomeSearchDraft();');
 context.payload={authenticated:true,user:{id:'owner',email:'user@example.test'},roles:['candidate']};
 await run(context,'completeLogin(payload,"employer","catalog")');assert.equal(JSON.parse(saved.getItem(key)).accountId,'owner');assert.match(context.dialog.body,/Ваш запрос/);
 context.api=async body=>{assert.equal(body.action,'onboard');assert.equal(body.role,'employer');return {state:{roles:['candidate','employer'],company:{name:body.name}}};};
 run(context,'globalThis.confirmations=0;confirmNeed=()=>{confirmations++;globalThis.confirmedQuery=query;}');
 await submit(context,form('onboard',{role:'employer',next:'catalog'},{name:'New Company',city:'Москва',contact:'user@example.test',description:'Описание продуктовой компании'}));
 assert.equal(context.confirmations,1);assert.equal(context.confirmedQuery,'Middle Backend Python');assert.equal(run(context,'page'),'catalog');assert.equal(run(context,'pendingHomeSearch'),false);
});

test('dismissing mail instructions keeps the input but cancels automatic handoff; unrelated workspace entry stays unrelated',async()=>{
 const saved=storage(),context=client(saved);run(context,'query="SQL Backend";pendingHomeSearch=true;saveHomeSearchDraft();modal("Проверьте почту","Письмо отправлено","<p>Проверьте почту</p>");dismissDialog();');
 assert.equal(JSON.parse(saved.getItem(key)).active,false);
 const reloaded=client(saved);assert.equal(run(reloaded,'restoreHomeSearchDraft()'),true);assert.equal(run(reloaded,'query'),'SQL Backend');assert.equal(run(reloaded,'pendingHomeSearch'),false);
 run(reloaded,'state={...emptyState(),authenticated:true,roles:["candidate","employer"]};refresh=async()=>{};confirmNeed=()=>{throw Error("unexpected handoff");};ensureRole("candidate","profile");');await new Promise(resolve=>setImmediate(resolve));assert.equal(run(reloaded,'page'),'profile');
});

test('successful confirmation clears the draft while a failed saved search keeps it for retry',async()=>{
 for(const save of [false,true]){
  const saved=storage(),context=client(saved);run(context,'state={...emptyState(),authenticated:true,roles:["employer"]};role="employer";query="Backend Python";saveHomeSearchDraft();refresh=async()=>{};');
  context.api=async()=>{throw Error('offline');};
  if(save){await submit(context,form('need-confirm-form',{save:'true'},{spec:'Backend',grade:'Middle'}));assert.ok(saved.getItem(key),'failed save must retain the request');}
  context.api=async()=>({state:{need:{confirmed:true}}});
  await submit(context,form('need-confirm-form',{save:String(save)},{spec:'Backend',grade:'Middle'}));assert.equal(saved.getItem(key),null);
 }
});

test('catalogue reload resumes the restored search once, and logout removes its draft',async()=>{
 const saved=storage(),context=client(saved);run(context,'query="Frontend React";saveHomeSearchDraft();query="";page="catalog";role="employer";globalThis.refreshed=[];refresh=async()=>{refreshed.push(query);state={...emptyState(),authenticated:true,user:{id:"owner"},roles:["employer"]};};globalThis.confirmations=0;confirmNeed=()=>{confirmations++;};');
 await run(context,'boot()');assert.deepEqual(Array.from(context.refreshed),['','Frontend React']);assert.equal(context.confirmations,1);
 context.requestData=async()=>({authenticated:false});await run(context,'logoutApp()');assert.equal(saved.getItem(key),null);assert.equal(run(context,'query'),'');assert.equal(run(context,'pendingHomeSearch'),false);
});

test('a dismissed catalogue draft refreshes results for its restored query without reopening confirmation',async()=>{
 const saved=storage(),context=client(saved);run(context,'query="Middle Backend Python";saveHomeSearchDraft(false);query="";page="catalog";role="employer";globalThis.refreshed=[];refresh=async()=>{refreshed.push(query);state={...emptyState(),authenticated:true,user:{id:"owner"},roles:["employer"],need:query?{text:query}:null};};confirmNeed=()=>{throw Error("dismissed search must stay dismissed");};');
 await run(context,'boot()');assert.deepEqual(Array.from(context.refreshed),['','Middle Backend Python']);assert.equal(run(context,'state.need.text'),'Middle Backend Python');assert.equal(run(context,'pendingHomeSearch'),false);
});
