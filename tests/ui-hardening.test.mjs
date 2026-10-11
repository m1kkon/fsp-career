import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as history from '../public/resume-history.mjs';
import * as cities from '../public/cities.mjs';
import * as templates from '../public/hiring-templates.mjs';

const source=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^boot\(\);$/m,'');
const run=(context,code)=>vm.runInContext(code,context);
const plain=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function storage(values={}){const saved=new Map(Object.entries(values));return {getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};}
function client({fetch=async()=>Response.json({}),localStorage=storage()}={}){
 const events={},messages=[],main={querySelector:()=>null},app={innerHTML:'',querySelector:selector=>selector==='main'?main:null};
 const overlay={firstElementChild:null,querySelector:selector=>overlay.firstElementChild?.querySelector(selector)||null};
 const context=vm.createContext({...history,...cities,...templates,fetch,localStorage,sessionStorage:storage(),serverOffset:0,AbortController,URLSearchParams,setTimeout,clearTimeout,setInterval(){},
  location:{pathname:'/',hash:''},window:{addEventListener(){},scrollTo(){}},
  document:{getElementById:id=>id==='app'?app:overlay,querySelector:()=>null,addEventListener:(name,handler)=>(events[name]??=[]).push(handler),body:{dataset:{},classList:{add(){},remove(){}}}},
  assessmentHandleSubmit:async()=>false,assessmentHandleAction:async()=>false,assessmentHandleChange:()=>false,
  FormData:class {constructor(form){this.values={...form.values};}*[Symbol.iterator](){yield*Object.entries(this.values);}}
 });
 vm.runInContext(source,context);
 context.messages=messages;context.overlaySurface=overlay;
 run(context,'render=()=>{globalThis.renders=(globalThis.renders||0)+1;};toast=message=>messages.push(message);invalidateResumePDF=()=>{};close=()=>{globalThis.closes=(globalThis.closes||0)+1;overlaySurface.firstElementChild=null;};');
 function showForm(form){const dialog={querySelector:selector=>form.querySelector(selector),form};overlay.firstElementChild=dialog;return dialog;}
 async function submit(form){for(const handler of events.submit||[])await handler({target:form,preventDefault(){}});}
 return {context,events,messages,overlay,main,showForm,submit};
}
function editor(id='apply-form',values={},dataset={}){
 const attributes=new Map(),submit={textContent:'Сохранить',disabled:false,setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)},error={textContent:'',isConnected:true,focus(){this.focused=true;}};
 return {id,dataset,values,isConnected:true,submit,error,attributes,elements:{formatRequired:{checked:false},locationRequired:{checked:false}},
  querySelector:selector=>selector==='button[type="submit"]'?submit:selector==='[data-error]'?error:null,
  querySelectorAll:()=>[]};
}
function account(context,role='candidate'){context.accountRole=role;run(context,'state={...emptyState(),authenticated:true,user:{id:"owner"},roles:[accountRole],profile:{name:"Original"}};role=accountRole;page="profile";');}

test('denied browser preferences do not prevent bootstrap or preference writes',()=>{
 const denied={getItem(){throw new Error('Storage denied');},setItem(){throw new Error('Storage denied');}};
 const {context}=client({localStorage:denied});
 assert.deepEqual(plain(run(context,'({role,homeMode,locationPreference})')),{role:'candidate',homeMode:'employer',locationPreference:{city:'',format:''}});
 assert.doesNotThrow(()=>run(context,'writePreference("fsp-role","employer")'));
});
test('invalid saved audiences and locations use valid defaults while valid preferences survive',()=>{
 const invalid=client({localStorage:storage({'fsp-role':'administrator','fsp-audience':'null','fsp-search-location':'{"city":"Москва","format":"invalid"}'})});
 assert.deepEqual(plain(run(invalid.context,'({role,homeMode,locationPreference})')),{role:'candidate',homeMode:'employer',locationPreference:{city:'',format:''}});
 const valid=client({localStorage:storage({'fsp-role':'employer','fsp-audience':'candidate','fsp-search-location':JSON.stringify({city:'Я'.repeat(150),format:'Гибрид'})})});
 assert.equal(run(valid.context,'role'),'employer');assert.equal(run(valid.context,'homeMode'),'candidate');assert.equal(run(valid.context,'locationPreference.city.length'),100);assert.equal(run(valid.context,'locationPreference.format'),'Гибрид');
});
test('the latest search response wins when requests resolve in reverse order',async()=>{
 const old=deferred(),latest=deferred(),calls=[];
 const {context}=client({fetch:url=>{calls.push(url);return calls.length===1?old.promise:latest.promise;}});account(context,'employer');
 run(context,'query="Python Backend"');const first=run(context,'refresh()');
 run(context,'query="React Frontend"');const second=run(context,'refresh()');
 latest.resolve(Response.json({need:{text:'React Frontend'},candidates:[{id:'react'}]}));assert.equal(await second,true);
 old.resolve(Response.json({need:{text:'Python Backend'},candidates:[{id:'python'}]}));assert.equal(await first,false);
 assert.equal(run(context,'state.need.text'),'React Frontend');assert.deepEqual(plain(run(context,'state.candidates')),[{id:'react'}]);
 assert.equal(new URL(calls[0],'http://local.test').searchParams.get('query'),'Python Backend');
 assert.equal(new URL(calls[1],'http://local.test').searchParams.get('query'),'React Frontend');
});
test('changing search constraints invalidates an in-flight response even without another refresh',async()=>{
 const pending=deferred(),{context}=client({fetch:()=>pending.promise});account(context,'employer');
 run(context,'query="Backend";needContext.city="Москва"');const refresh=run(context,'refresh()');
 run(context,'needContext.city="Казань";needRules={locationRequired:true}');pending.resolve(Response.json({need:{text:'Old city'},candidates:[{id:'stale'}]}));
 assert.equal(await refresh,false);assert.equal(run(context,'state.need'),null);assert.deepEqual(plain(run(context,'state.candidates')),[]);
});
test('offline reads explain recovery and uncertain POST or DELETE writes ask to verify before retry',async()=>{
 const {context}=client({fetch:async()=>{throw new TypeError('Failed to fetch');}});
 await assert.rejects(run(context,'requestData("/api/state")'),error=>/Проверьте подключение/.test(error.message)&&!/подтвердить сохранение/.test(error.message));
 for(const method of ['POST','DELETE']){context.method=method;await assert.rejects(run(context,'requestData("/api/action",{method})'),/Не удалось подтвердить сохранение.*проверьте кабинет перед повтором/);}
});
test('malformed or non-object API responses retain distinct read and uncertain-write guidance',async()=>{
 for(const response of [()=>new Response('<html>proxy error</html>'),()=>Response.json(null),()=>Response.json(['unexpected'])]){
  const {context}=client({fetch:async()=>response()});
  await assert.rejects(run(context,'requestData("/api/state")'),/Не удалось прочитать ответ сервера.*обновить данные/);
  for(const method of ['POST','DELETE']){context.method=method;await assert.rejects(run(context,'requestData("/api/action",{method})'),/Не удалось подтвердить сохранение/);}
 }
});
test('DELETE timeouts release the deadline with uncertain-write guidance',async()=>{
 const {context}=client({fetch:(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
 await assert.rejects(run(context,'requestData("/api/keys",{method:"DELETE"},"json",5)'),/Сервер долго не отвечает.*Не удалось подтвердить сохранение/);
});
test('HTTP failures preserve status and use actionable fallbacks when the error body is unusable',async()=>{
 for(const [status,message] of [[401,/Войдите в аккаунт/],[403,/нет доступа/],[429,/Подождите немного/],[500,/временно недоступен/]]){
  const {context}=client({fetch:async()=>Response.json({error:{internal:'not user-facing'}},{status})});
  await assert.rejects(run(context,'requestData("/api/state")'),error=>error.status===status&&message.test(error.message)&&!error.message.includes('[object Object]'));
 }
});
test('a late save updates accepted data without closing a newly opened editor or discarding its draft',async()=>{
 const reply=deferred(),ui=client({fetch:()=>reply.promise});account(ui.context);
 const original=editor('apply-form',{letter:'Original draft'});ui.showForm(original);const save=run(ui.context,'mutate({action:"profile",name:"Saved"})');
 const replacement=editor('apply-form',{letter:'New unsent draft'}),dialog=ui.showForm(replacement);
 reply.resolve(Response.json({state:{profile:{name:'Saved'}},message:'Сохранено'}));await save;
 assert.equal(ui.overlay.firstElementChild,dialog);assert.equal(replacement.values.letter,'New unsent draft');assert.equal(replacement.error.textContent,'');assert.equal(run(ui.context,'state.profile.name'),'Saved');
 assert.equal(ui.context.closes,undefined);assert.equal(original.submit.disabled,false);
});
test('a late failure does not write or focus errors in a replacement editor',async()=>{
 const reply=deferred(),ui=client({fetch:()=>reply.promise});account(ui.context);
 const original=editor();ui.showForm(original);const save=run(ui.context,'mutate({action:"profile",name:"Saved"})');
 const replacement=editor('apply-form',{letter:'Keep this draft'}),dialog=ui.showForm(replacement);
 reply.reject(new TypeError('Offline'));await save;
 assert.equal(ui.overlay.firstElementChild,dialog);assert.equal(replacement.error.textContent,'');assert.equal(replacement.error.focused,undefined);assert.equal(original.error.textContent,'');assert.equal(replacement.values.letter,'Keep this draft');
 assert.match(ui.messages.at(-1),/Не удалось подтвердить сохранение/);assert.equal(original.submit.disabled,false);
});
test('a mutation response from the previous account cannot replace the new account state or dialog',async()=>{
 const reply=deferred(),ui=client({fetch:()=>reply.promise});account(ui.context);ui.showForm(editor());
 const save=run(ui.context,'mutate({action:"profile",name:"Old account save"})');
 run(ui.context,'viewRevision++;state={...emptyState(),authenticated:true,user:{id:"new-owner"},roles:["candidate"],profile:{name:"New owner"}}');
 const replacement=editor('apply-form',{letter:'New owner draft'}),dialog=ui.showForm(replacement);
 reply.resolve(Response.json({state:{user:{id:'owner'},profile:{name:'Old account save'}},message:'Old success'}));await save;
 assert.equal(run(ui.context,'state.user.id'),'new-owner');assert.equal(run(ui.context,'state.profile.name'),'New owner');assert.equal(ui.overlay.firstElementChild,dialog);assert.deepEqual(ui.messages,[]);assert.equal(replacement.values.letter,'New owner draft');
});

test('repeated search confirmations share the whole delayed refresh and create only one saved search',async()=>{
 let reads=0;const read=deferred(),writes=[],ui=client({fetch:(url,options)=>{if(url.startsWith('/api/state')){reads++;return read.promise;}writes.push(JSON.parse(options.body));return Promise.resolve(Response.json({state:{need:{confirmed:true}}}));}});account(ui.context,'employer');run(ui.context,'query="Backend Python";page="catalog"');
 const form=editor('need-confirm-form',{spec:'Backend',grade:'Middle',budgetMin:'100000',budgetMax:'200000'},{save:'true'});ui.showForm(form);
 const first=ui.submit(form);await Promise.resolve();await Promise.resolve();
 assert.equal(form.submit.disabled,true);form.values.grade='Senior';await ui.submit(form);assert.equal(reads,1);assert.equal(writes.length,0);
 read.resolve(Response.json({need:{confirmed:true}}));await first;
 assert.equal(writes.length,1);assert.equal(writes[0].action,'need');assert.equal(writes[0].text,'Backend Python');assert.equal(writes[0].budgetMin,'100000');assert.equal(writes[0].grade,'Middle');assert.equal(form.submit.disabled,false);
});
test('closing confirmation before the refresh returns does not save a search or close a new form',async()=>{
 const read=deferred(),writes=[],ui=client({fetch:(url,options)=>{if(url.startsWith('/api/state'))return read.promise;writes.push(options);return Promise.resolve(Response.json({}));}});account(ui.context,'employer');run(ui.context,'query="Backend Python";page="catalog"');
 const form=editor('need-confirm-form',{spec:'Backend',grade:'Middle'},{save:'true'});ui.showForm(form);const submit=ui.submit(form);await Promise.resolve();await Promise.resolve();
 form.isConnected=false;form.error.isConnected=false;const replacement=editor('apply-form',{letter:'New form'}),dialog=ui.showForm(replacement);
 read.resolve(Response.json({need:{confirmed:true}}));await submit;
 assert.equal(writes.length,0);assert.equal(ui.overlay.firstElementChild,dialog);assert.equal(replacement.values.letter,'New form');assert.equal(form.submit.disabled,false);
});
test('a failed confirmation refresh preserves fields, exposes its error and permits retry',async()=>{
 let reads=0,writes=0;const ui=client({fetch:async(url)=>{if(url.startsWith('/api/state')){if(++reads===1)throw new TypeError('Offline');return Response.json({need:{confirmed:true}});}writes++;return Response.json({state:{need:{confirmed:true}}});}});account(ui.context,'employer');run(ui.context,'query="Python Backend";page="catalog"');
 const form=editor('need-confirm-form',{spec:'Backend',grade:'Senior',budgetMin:'200000'},{save:'true'}),dialog=ui.showForm(form);
 await ui.submit(form);assert.equal(writes,0);assert.equal(form.submit.disabled,false);assert.equal(form.submit.textContent,'Сохранить');assert.match(form.error.textContent,/Проверьте подключение/);assert.equal(ui.overlay.firstElementChild,dialog);assert.equal(form.values.grade,'Senior');assert.equal(form.values.budgetMin,'200000');
 await ui.submit(form);assert.equal(reads,2);assert.equal(writes,1);assert.equal(form.submit.disabled,false);
});

test('a delayed vacancy search does not pull the user back after navigation elsewhere',async()=>{
 const pending=deferred(),{context}=client({fetch:()=>pending.promise});account(context);run(context,'page="home"');
 const search=run(context,'searchJobsFromHome("Python Backend")');run(context,'page="method"');
 pending.resolve(Response.json({jobs:[]}));await search;assert.equal(run(context,'page'),'method');
});

test('a delayed catalogue search does not open confirmation after its form was left',async()=>{
 const pending=deferred(),c=client({fetch:()=>pending.promise});account(c.context,'employer');run(c.context,'page="catalog";confirmNeed=()=>{throw new Error("stale confirmation");};');
 const form=editor('demand-form',{query:'Backend Python'});const submitted=c.submit(form);form.isConnected=false;run(c.context,'page="method"');
 pending.resolve(Response.json({candidates:[]}));await submitted;assert.equal(run(c.context,'page'),'method');assert.equal(c.messages.length,0);
});
