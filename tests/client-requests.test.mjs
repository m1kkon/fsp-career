import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {historyDefaults} from '../public/resume-history.mjs';

const source=fs.readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
const requests=source.slice(source.indexOf('async function requestData('),source.indexOf('function go(next)'));
const pdf=source.slice(source.indexOf('let pdfExporting='),source.indexOf("document.addEventListener('click'"));
const auth=source.slice(source.indexOf('async function loginApp('),source.indexOf('function onboarding('));
const empty=source.slice(source.indexOf('const emptyState='),source.indexOf('let role='));
function client(fetch){
 const button={textContent:'Сохранить',disabled:false,setAttribute(){},removeAttribute(){}};
 const error={textContent:'',focus(){}};
 const context=vm.createContext({fetch,AbortController,setTimeout,clearTimeout,Date,JSON,Error,
  role:'candidate',query:'',page:'profile',busy:false,
  state:{authenticated:true,user:{id:'a',email:'a@example.test'},roles:['candidate'],profile:{name:'Original'},privacy:{fspVisible:true},invites:[]},
  overlay:{querySelector:s=>s==='[data-error]'?error:button},app:{querySelector:()=>null},
  test:{id:'old-attempt'},result:{score:90},answers:[1],jobQuery:'old',localStorage:{setItem(){}},
  close(){context.closed=true;},render(){},go(page){context.page=page;},onboarding(){context.onboarded=true;},toast(message){context.toastMessage=message;}
 });
 vm.runInContext(empty+requests+pdf+auth,context);
 return {context,button,error};
}
test('a confirmed profile save updates the UI with one request and keeps workspace lists',async()=>{
 const calls=[];
 const {context,button}=client(async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({message:'Saved',state:{profile:{name:'Updated'}}});});
 await vm.runInContext("mutate({action:'profile',name:'Updated'})",context);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/action');assert.equal(calls[0].body.returnState,true);
 assert.equal(context.state.profile.name,'Updated');assert.deepEqual(context.state.invites,[]);assert.equal(context.closed,true);assert.equal(button.disabled,false);
});
test('request deadlines release the form, preserve its draft and distinguish an unconfirmed write',async()=>{
 const {context,button,error}=client((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))));
 vm.runInContext('const realRequest=requestData; requestData=(url,options,read)=>realRequest(url,options,read,10);',context);
 await vm.runInContext("mutate({action:'profile',name:'Draft'})",context);
 assert.equal(button.disabled,false);assert.equal(button.textContent,'Сохранить');assert.match(error.textContent,/Не удалось подтвердить сохранение/);assert.equal(context.closed,undefined);assert.equal(context.state.profile.name,'Original');
});
test('PDF preparation shares one request, reuses the file and regenerates after profile or identity changes',async()=>{
 let calls=0;
 const {context}=client(async()=>{calls++;return new Response('%PDF-sample',{headers:{'content-type':'application/pdf'}});});
 await vm.runInContext('Promise.all([preparedResumePDF(),preparedResumePDF()])',context);
 await vm.runInContext('preparedResumePDF()',context);assert.equal(calls,1);
 context.state.profile.name='Updated';await vm.runInContext('preparedResumePDF()',context);assert.equal(calls,2);
 context.state.privacy.fspVisible=false;await vm.runInContext('preparedResumePDF()',context);assert.equal(calls,3);
 context.state.user.id='another';await vm.runInContext('preparedResumePDF()',context);assert.equal(calls,4);
});
test('a failed PDF preparation can be retried',async()=>{
 let calls=0;
 const {context}=client(async()=>{if(++calls===1)throw new Error('offline');return new Response('%PDF-sample',{headers:{'content-type':'application/pdf'}});});
 await assert.rejects(vm.runInContext('preparedResumePDF()',context),/offline/);
 await vm.runInContext('preparedResumePDF()',context);assert.equal(calls,2);
});
test('workspace logout stays on the site and clears private data; login restores the saved account',async()=>{
 const calls=[];
 let staleRead;
 const {context}=client(async(url,options)=>{if(url.startsWith('/api/state'))return new Promise(resolve=>{staleRead=resolve;});const body=JSON.parse(options.body);calls.push({url,body});return Response.json(body.action==='logout'?{authenticated:false,jobs:[]}:{authenticated:true,user:{id:'a'},roles:['candidate'],profile:{name:'Saved account'},jobs:[]});});
 context.state.invites=[{email:'private@example.test'}];
 const pending=vm.runInContext('refresh()',context);
 await vm.runInContext('logoutApp()',context);
 staleRead(Response.json({authenticated:true,profile:{name:'Stale private data'}}));await pending;
 assert.equal(context.page,'home');assert.equal(context.state.authenticated,false);assert.equal(context.state.user,undefined);assert.equal(context.state.profile,undefined);assert.equal(context.state.invites.length,0);assert.equal(context.test,null);
 await vm.runInContext('loginApp()',context);
 assert.equal(context.page,'dashboard');assert.equal(context.state.profile.name,'Saved account');assert.ok(calls.every(c=>c.url==='/api/session'));
});

test('adding or removing resume groups keeps basic fields and unsaved block values',()=>{
 const form={values:{name:'Unsaved name',min:'100.000','skill-label-0':'ML','skill-text-0':'Python, PyTorch',headline:'ML Engineer'},querySelectorAll(){return [];}};
 const blocks={innerHTML:''},panel={scrollTop:321};
 const context=vm.createContext({historyDefaults,structuredClone,state:{profile:{resume:{}}},FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key];}},document:{getElementById:id=>id==='profile-form'?form:blocks},overlay:{querySelector:()=>panel},resumeEditorFields:()=>'<new groups>'});
 const draft=source.slice(source.indexOf('let resumeDraft='),source.indexOf('function resumeEditorFields'));
 const update=source.slice(source.indexOf('function updateResumeEditor'),source.indexOf('function resumeExtraSections'));
 vm.runInContext(draft+update+"resumeDraft={skillGroups:[{label:'',text:''}],projects:[],links:[]};updateResumeEditor('skillGroups');",context);
 assert.equal(form.values.name,'Unsaved name');assert.equal(form.values.min,'100.000');assert.equal(panel.scrollTop,321);
 assert.equal(vm.runInContext('resumeDraft.skillGroups[0].text',context),'Python, PyTorch');
 assert.equal(vm.runInContext('resumeDraft.skillGroups.length',context),2);
 vm.runInContext("updateResumeEditor('skillGroups',1)",context);
 assert.equal(vm.runInContext('resumeDraft.skillGroups.length',context),1);assert.equal(form.values.name,'Unsaved name');
});
test('salary typing and paste format thousands while editing preserves the digit cursor',()=>{
 const listeners={};
 const context=vm.createContext({document:{addEventListener:(type,handler)=>listeners[type]=handler}});
 const formatter=source.slice(source.indexOf('const formatMoneyInput='),source.indexOf('const field='));
 const handlers=source.slice(source.indexOf('// Keep digit positions'),source.indexOf("document.addEventListener('change'"));
 vm.runInContext(formatter+handlers,context);
 const input={value:'100000',selectionStart:6,selectionEnd:6,matches:()=>true,setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}};
 listeners.input({target:input});assert.equal(input.value,'100.000');assert.equal(input.selectionStart,7);
 input.value='1.234.567';input.selectionStart=2;input.selectionEnd=2;listeners.beforeinput({target:input,inputType:'deleteContentBackward'});assert.equal(input.selectionStart,0);assert.equal(input.selectionEnd,2);
 input.value='250 000 ₽';input.selectionStart=input.value.length;listeners.input({target:input});assert.equal(input.value,'250.000');
 input.value='';input.selectionStart=0;listeners.input({target:input});assert.equal(input.value,'');
});

test('adding history cards preserves unsaved history, project and contact fields',()=>{
 const form={values:{phone:'Draft contact','workEntries-company-0':'Vector','workEntries-position-0':'ML Engineer','workEntries-start-0':'2023','workEntries-current-0':'on','workEntries-description-0':'Built search','project-name-0':'Unsaved project'},querySelectorAll(){return [];}};
 const panel={scrollTop:500},blocks={innerHTML:''};
 const context=vm.createContext({historyDefaults,structuredClone,FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k];}},document:{getElementById:id=>id==='profile-form'?form:blocks},overlay:{querySelector:()=>panel},resumeEditorFields:()=>'<cards>'});
 const draft=source.slice(source.indexOf('let resumeDraft='),source.indexOf('function historyEditor'));
 const update=source.slice(source.indexOf('function updateResumeEditor'),source.indexOf('function resumeExtraSections'));
 vm.runInContext(draft+update+"resumeDraft={workEntries:[{...historyDefaults.workEntries}],educationEntries:[],skillGroups:[],projects:[{name:'',description:'',url:''}],links:[]};updateResumeEditor('workEntries')",context);
 assert.equal(vm.runInContext('resumeDraft.workEntries[0].company',context),'Vector');assert.equal(vm.runInContext('resumeDraft.workEntries[0].current',context),true);assert.equal(vm.runInContext('resumeDraft.workEntries.length',context),2);assert.equal(vm.runInContext('resumeDraft.projects[0].name',context),'Unsaved project');assert.equal(form.values.phone,'Draft contact');assert.equal(panel.scrollTop,500);
 vm.runInContext("updateResumeEditor('workEntries',1)",context);assert.equal(vm.runInContext('resumeDraft.workEntries.length',context),1);
});
