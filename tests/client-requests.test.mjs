import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
const requests=source.slice(source.indexOf('async function requestData('),source.indexOf('function go(next)'));
const pdf=source.slice(source.indexOf('let pdfExporting='),source.indexOf("document.addEventListener('click'"));
function client(fetch){
 const button={textContent:'Сохранить',disabled:false,setAttribute(){},removeAttribute(){}};
 const error={textContent:'',focus(){}};
 const context=vm.createContext({fetch,AbortController,setTimeout,clearTimeout,Date,JSON,Error,
  role:'candidate',query:'',page:'profile',busy:false,
  state:{authenticated:true,user:{id:'a',email:'a@example.test'},roles:['candidate'],profile:{name:'Original'},privacy:{fspVisible:true},invites:[]},
  overlay:{querySelector:s=>s==='[data-error]'?error:button},app:{querySelector:()=>null},
  close(){context.closed=true;},render(){},go(){},toast(message){context.toastMessage=message;}
 });
 vm.runInContext(requests+pdf,context);
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
