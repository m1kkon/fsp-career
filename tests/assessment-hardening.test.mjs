import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/assessments.js',import.meta.url),'utf8');
const rootSource=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
const admin={questions:[],modules:[],roles:[],specifications:[],days:[],analytics:[]};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function context(){
 const calls=[],renders=[],toasts=[],code={value:'print(42)'},stdin={value:''},status={innerHTML:''};
 const c={state:{user:{id:'first-owner'},assessment:{maintainer:true,modules:[],roles:[],history:[],days:[],specifications:[]}},page:'tests',location:{hash:'#tests'},setInterval:()=>{},setTimeout,clearTimeout,
  document:{activeElement:null,addEventListener:()=>{}},overlay:{firstElementChild:null},app:{querySelector:selector=>selector==='[name=assessmentCode]'?code:selector==='[name=assessmentStdin]'?stdin:selector==='.exam-save-status'?status:null},
  render:()=>renders.push(true),refresh:async()=>{},close:()=>{},toast:message=>toasts.push(message),title:String,empty:(_title,text)=>text,esc:String,button:(text,action)=>`<button data-action="${action}">${text}</button>`,badge:String,tag:String,
  api:async body=>{calls.push(body);return {admin};},mutate:async()=>({saved:true}),crypto:{randomUUID:()=> 'logical-submission-0001'}};
 runInNewContext(source,c);
 const get=expression=>runInNewContext(expression,c),set=(expression,value)=>{c.testValue=value;runInNewContext(`${expression}=testValue`,c);delete c.testValue;};
 return {c,get,set,calls,renders,toasts,code,stdin,status};
}
function attempt(id='attempt',format='choice'){
 const q={id:'question',format,...(format==='coding'?{coding:{starter:'',submission:{used:0,limit:3}}}:{})};
 return {id,status:'active',revision:0,modules:[{id:'python'}],currentModule:{id:'python',questionIndex:0,questions:[q],answers:{}}};
}

test('bank loading is single-flight and failures remain actionable until an explicit read-only retry',async()=>{
 const {c,get,calls}=context();c.page='maintainer';const request=deferred();c.api=body=>{calls.push(body);return request.promise;};
 assert.match(c.assessmentAdminPage(),/Загружаем банк/);c.assessmentAdminPage();c.assessmentAdminPage();
 assert.equal(calls.length,1);const flight=get('assessmentAdminFlight');request.reject(new Error('Соединение потеряно'));await flight;
 const failed=c.assessmentAdminPage();assert.match(failed,/Соединение потеряно/);assert.match(failed,/assessment-admin-retry/);c.assessmentAdminPage();assert.equal(calls.length,1);
 c.api=async body=>{calls.push(body);return {admin};};await c.assessmentHandleAction({dataset:{action:'assessment-admin-retry'}});
 assert.equal(calls.length,2);assert.ok(calls.every(body=>body.action==='maintainer-state'));assert.equal(get('assessmentAdmin'),admin);assert.equal(get('assessmentAdminError'),'');
});

test('a committed maintainer write with a failed reload retries the bank read, never the write',async()=>{
 const {c,get,set,calls}=context();c.page='maintainer';set('assessmentAdmin',admin);let writes=0;c.mutate=async()=>{writes++;return {saved:true};};
 c.api=async body=>{calls.push(body);throw new Error('Offline');};
 assert.deepEqual(await c.assessmentAdminMutate({action:'maintainer-question-save'}),{saved:true});
 assert.equal(writes,1);assert.equal(get('assessmentAdmin'),admin);assert.match(c.assessmentAdminPage(),/Изменения сохранены/);
 c.api=async body=>{calls.push(body);return {admin:{...admin,questions:[]}};};await c.assessmentHandleAction({dataset:{action:'assessment-admin-retry'}});
 assert.equal(writes,1);assert.ok(calls.every(body=>body.action==='maintainer-state'));assert.equal(get('assessmentAdminError'),'');
});

test('a reload started before a successful write cannot satisfy its post-write refresh',async()=>{
 const {c,calls}=context(),stale=deferred();let reads=0;
 c.api=body=>{calls.push(body);return ++reads===1?stale.promise:Promise.resolve({admin});};
 const oldRead=c.assessmentLoadAdmin(),write=c.assessmentAdminMutate({action:'maintainer-question-save'});
 stale.resolve({admin:{...admin,questions:[]}});await oldRead;await write;
 assert.equal(reads,2);
});

test('a committed maintainer save from a closed modal refreshes the bank without closing its replacement',async()=>{
 const {c,get,calls}=context(),reply=deferred(),main={querySelector:()=>null},originalSubmit={disabled:false,textContent:'Сохранить',setAttribute(){},removeAttribute(){}},originalError={textContent:'',focus(){}},originalDialog={querySelector:selector=>selector==='button[type="submit"]'?originalSubmit:selector==='[data-error]'?originalError:null};
 c.page='maintainer';c.overlay.firstElementChild=originalDialog;c.overlay.querySelector=selector=>c.overlay.firstElementChild?.querySelector(selector)||null;
 const baseQuery=c.app.querySelector;c.app.querySelector=selector=>selector==='main'?main:baseQuery(selector);
 c.invalidateResumePDF=()=>{};c.close=()=>{throw new Error('A detached save must not close the replacement dialog');};
 runInNewContext("let busy=false,role='candidate',viewRevision=0,query='',needContext={},needRules={},needSpec='',needGrade='',needStack='',needConfirmed=false;",c);
 runInNewContext(rootSource.slice(rootSource.indexOf('function stateRequestKey()'),rootSource.indexOf('async function refresh()'))+rootSource.slice(rootSource.indexOf('async function mutate('),rootSource.indexOf('function routePage(')),c);
 c.api=body=>{calls.push(body);return body.action==='maintainer-state'?Promise.resolve({admin}):reply.promise;};
 const save=c.assessmentAdminMutate({action:'maintainer-question-save'}),replacement={querySelector:()=>null,draft:'Keep this replacement draft'};
 c.overlay.firstElementChild=replacement;reply.resolve({question:{id:'new-question'},message:'Вопрос сохранён'});await save;
 assert.equal(c.overlay.firstElementChild,replacement);assert.equal(replacement.draft,'Keep this replacement draft');assert.equal(get('assessmentAdmin'),admin);
 assert.deepEqual(calls.map(body=>body.action),['maintainer-question-save','maintainer-state']);assert.equal(originalSubmit.disabled,false);
});

test('a delayed exam response cannot resurrect the previous account or unlock the new account operation',async()=>{
 const {c,get,set,calls,renders,toasts}=context(),reply=deferred();c.assessmentAccept(attempt('old'));
 c.api=body=>{calls.push(body);return reply.promise;};const running=c.assessmentRun('assessment-answer',{questionId:'question',answer:1});
 await Promise.resolve();assert.equal(calls.length,1);
 c.assessmentResetContext();c.state.user.id='second-owner';c.assessmentAccept(attempt('new'));set('assessmentSaving',true);const before=renders.length;
 reply.resolve({assessment:attempt('old')});await running;
 assert.equal(get('assessmentAttempt.id'),'new');assert.equal(get('assessmentSaving'),true);assert.equal(renders.length,before);assert.equal(toasts.length,0);assert.equal(calls.length,1);
});

test('owner comparison also ignores late responses when a caller has not reset the context yet',async()=>{
 const {c,get,renders}=context(),reply=deferred();c.assessmentAccept(attempt('old'));c.api=()=>reply.promise;
 const running=c.assessmentRun('assessment-answer',{questionId:'question',answer:1});await Promise.resolve();
 c.state.user.id='second-owner';c.assessmentAccept(attempt('new'));const before=renders.length;reply.resolve({assessment:attempt('old')});await running;
 assert.equal(get('assessmentAttempt.id'),'new');assert.equal(renders.length,before);
});

test('cleared draft flights cannot consume or detach a new account draft flight',async()=>{
 const {c,get,set}=context(),oldReply=deferred(),newReply=deferred();let requests=0;
 c.api=()=>++requests===1?oldReply.promise:newReply.promise;
 c.assessmentAccept(attempt('old'));set('assessmentDraft',0);c.assessmentQueueDraft();const oldFlight=get('assessmentDraftFlight');
 c.assessmentResetContext();c.state.user.id='second-owner';c.assessmentAccept(attempt('new'));set('assessmentDraft',2);c.assessmentQueueDraft();const newFlight=get('assessmentDraftFlight');
 oldReply.resolve({assessment:attempt('old')});await oldFlight;
 assert.equal(get('assessmentAttempt.id'),'new');assert.equal(get('assessmentDraftFlight'),newFlight);
 newReply.resolve({assessment:attempt('new')});await newFlight;assert.equal(get('assessmentDraftFlight'),null);assert.equal(get('assessmentDraft'),2);
});

test('account reset invalidates delayed test preparation and clears all question-local recovery data',async()=>{
 const {c,get,set}=context(),reply=deferred();c.api=()=>reply.promise;const loading=c.assessmentLoadPreparation({id:'python'});
 set('assessmentUncertainSubmission',{key:'old',submissionId:'old-id'});set('assessmentCodeOutput',{key:'old',text:'private output'});get('assessmentCodeInputs.set("old","private input")');
 c.assessmentResetContext();reply.resolve({preparation:{targetId:'python'}});await loading;
 for(const expression of ['assessmentAttempt','assessmentPreparation','assessmentDraftPending','assessmentDraftFlight','assessmentCodeOutput','assessmentUncertainSubmission'])assert.equal(get(expression),null,expression);
 assert.equal(get('assessmentCodeInputs.size'),0);assert.equal(get('assessmentSaving'),false);
});

test('a delayed start response from a replaced account cannot begin the old test',async()=>{
 const {c,get,renders}=context(),reply=deferred();c.api=()=>reply.promise;
 const form={id:'assessment-start-form',dataset:{targetId:'python'},elements:{accepted:{checked:true}},querySelector:()=>({})};
 const starting=c.assessmentHandleSubmit(form,{});c.assessmentResetContext();c.state.user.id='second-owner';c.page='home';const before=renders.length;
 reply.resolve({assessment:attempt('old')});await starting;
 assert.equal(get('assessmentAttempt'),null);assert.equal(c.page,'home');assert.equal(renders.length,before);
});

test('assessment starts share one logical flight across replacement forms and retain the chosen grade',async()=>{
 const {c,get,set,calls}=context(),reply=deferred();set('assessmentPreparation',{targetId:'backend',targetGrade:'Middle',accepted:true});
 const controls=[{disabled:false},{disabled:false}],submit={disabled:false,textContent:'Начать тест',setAttribute(){},removeAttribute(){}};
 const first={id:'assessment-start-form',dataset:{targetId:'backend'},elements:{accepted:{checked:true},targetGrade:{value:'Middle'}},querySelectorAll:()=>[...controls,submit],querySelector:selector=>selector==='button[type="submit"]'?submit:{}};
 const replacement={...first,elements:{accepted:{checked:true},targetGrade:{value:'Senior'}},querySelectorAll:()=>[]};
 c.api=body=>{calls.push(body);return reply.promise;};const start=c.assessmentHandleSubmit(first,{});
 assert.ok([...controls,submit].every(control=>control.disabled));assert.equal(submit.textContent,'Запускаем тест…');
 c.assessmentHandleChange({target:{name:'targetGrade',value:'Senior',form:replacement}});assert.equal(get('assessmentPreparation.targetGrade'),'Middle');
 await c.assessmentHandleSubmit(replacement,{});assert.equal(calls.length,1);assert.equal(calls[0].targetGrade,'Middle');assert.match(c.assessmentGradePicker('Middle',true),/<fieldset[^>]+disabled/);
 reply.resolve({assessment:attempt('started')});await start;assert.equal(get('assessmentStartFlight'),null);assert.ok([...controls,submit].every(control=>!control.disabled));
});

test('an old start finally cannot release the new account start lock',async()=>{
 const {c,get}=context(),oldReply=deferred(),newReply=deferred();let requests=0;
 c.api=()=>++requests===1?oldReply.promise:newReply.promise;
 const form={id:'assessment-start-form',dataset:{targetId:'python'},elements:{accepted:{checked:true}},querySelector:()=>null};
 const first=c.assessmentHandleSubmit(form,{});c.assessmentResetContext();c.state.user.id='second-owner';const second=c.assessmentHandleSubmit({...form},{}),newFlight=get('assessmentStartFlight');
 oldReply.resolve({assessment:attempt('old')});await first;assert.equal(get('assessmentStartFlight'),newFlight);assert.equal(get('assessmentAttempt'),null);
 newReply.resolve({assessment:attempt('new')});await second;assert.equal(get('assessmentStartFlight'),null);assert.equal(get('assessmentAttempt.id'),'new');
});

test('a delayed bank response cannot restore the cache cleared by an account change',async()=>{
 const {c,get}=context(),reply=deferred();c.api=()=>reply.promise;const loading=c.assessmentLoadAdmin();
 c.assessmentResetContext();c.state.user.id='second-owner';reply.resolve({admin});await loading;
 assert.equal(get('assessmentAdmin'),null);assert.equal(get('assessmentAdminError'),'');assert.equal(get('assessmentAdminFlight'),null);
});

test('ambiguous coding submission retries reuse the original ID and source without a new logical attempt',async()=>{
 const {c,get,calls,code}=context(),exam=attempt('exam','coding');c.assessmentAccept(exam);let submissions=0,ids=0;c.crypto.randomUUID=()=>`logical-submission-${++ids}`;
 c.api=async body=>{
  calls.push(body);
  if(body.action==='assessment-resume')throw new Error('Recovery offline');
  if(body.action==='assessment-submit-code'){
   if(++submissions===1)throw new Error('Response lost');
   return {assessment:{...exam,revision:2,currentModule:{...exam.currentModule,questions:[{...exam.currentModule.questions[0],coding:{...exam.currentModule.questions[0].coding,submission:{used:1,limit:3}}}]}}};
  }
  return {assessment:exam};
 };
 await assert.rejects(c.assessmentCodeSubmit(),/Response lost/);assert.equal(get('assessmentUncertainSubmission.status'),'uncertain');assert.match(c.assessmentCodingActions(exam.currentModule.questions[0],true),/Повторить отправку/);
 code.value='print(99)';await c.assessmentCodeSubmit();
 const sent=calls.filter(body=>body.action==='assessment-submit-code');assert.equal(sent.length,2);assert.equal(sent[0].submissionId,sent[1].submissionId);assert.equal(sent[1].source,'print(42)');assert.equal(ids,1);
 assert.equal(get('assessmentUncertainSubmission'),null);assert.equal(get('assessmentAttempt.currentModule.questions[0].coding.submission.used'),1);assert.equal(get('assessmentDraft'),'print(99)');
});

test('a successful recovery confirms a consumed coding submission instead of leaving a retry armed',async()=>{
 const {c,get}=context(),exam=attempt('exam','coding'),resolved={...exam,currentModule:{...exam.currentModule,questions:[{...exam.currentModule.questions[0],coding:{...exam.currentModule.questions[0].coding,submission:{used:1,limit:3}}}]}};
 c.assessmentAccept(exam);c.api=async body=>{if(body.action==='assessment-submit-code')throw new Error('Response lost');return {assessment:body.action==='assessment-resume'?resolved:exam};};
 await assert.rejects(c.assessmentCodeSubmit(),/Response lost/);assert.equal(get('assessmentUncertainSubmission'),null);assert.equal(get('assessmentAttempt.currentModule.questions[0].coding.submission.used'),1);
});
