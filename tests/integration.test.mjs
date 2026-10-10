import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as history from '../public/resume-history.mjs';
import {citySuggestions,canonicalCity,loadWorldCities,worldCitiesReady} from '../public/cities.mjs';
import {selectedNeed,parseNeed,matching} from '../lib/matching.mjs';
import {accountFor,action,getState} from '../lib/service.mjs';
import {actionResponse} from '../lib/action-response.mjs';

function memory(){
 const accounts=new Map(),records=new Map(),clone=x=>x?structuredClone(x):null;
 return {account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),record:async id=>clone(records.get(id)),put:async(kind,r)=>records.set(r.id,{...clone(r),kind})};
}
async function employerWorkspace(){
 const repo=memory(),employer=await accountFor(repo,{id:'hr',email:'hr@example.test'});
 await action(repo,employer,{action:'onboard',role:'employer',name:'Company',consent:true});
 return {repo,employer};
}
function client(){
 const element={innerHTML:'',querySelector:()=>null};
 const documentEvents={};
 const context=vm.createContext({...history,citySuggestions,canonicalCity,loadWorldCities,worldCitiesReady,documentEvents,document:{getElementById:()=>element,querySelector:()=>null,addEventListener:(type,handler)=>(documentEvents[type]??=[]).push(handler),body:{classList:{add:()=>{},remove:()=>{}}}},window:{addEventListener:()=>{},scrollTo:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{}},location:{hash:''},setTimeout,clearTimeout,setInterval:()=>{}});
 const source=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^boot\(\);$/m,'');
 const assessment=readFileSync(new URL('../public/assessments.js',import.meta.url),'utf8');
 const cities=readFileSync(new URL('../public/city-autocomplete.js',import.meta.url),'utf8');
 vm.runInContext(assessment+'\n'+cities+'\n'+source,context);
 vm.runInContext('modal=()=>{};matchBreakdown=(match,heading)=>{globalThis.display={match,heading};return "";}',context);
 return context;
}
const profile={id:'candidate',name:'Candidate',work:'Разрабатываю сервисы на Python.',city:'Москва',experience:'3 года',spec:'Backend',grade:'Middle',stack:['Python'],score:90,min:180000,max:220000,format:'Удалённо',verified:true};

test('opening an application selects its vacancy score even when the candidate is in the catalogue or has several applications',()=>{
 const context=client();
 context.payload={candidates:[{...profile,match:matching(profile,null)}],applications:[{id:'first',owner:profile.id,job:{title:'First'},candidate:{...profile,match:matching(profile,parseNeed('Senior Frontend React'))}},{id:'second',owner:profile.id,job:{title:'Backend API'},candidate:{...profile,match:matching(profile,parseNeed('Middle Backend Python'))}}]};
 const display=vm.runInContext('state=payload;candidateDetail("candidate","second");display',context);
 assert.equal(display.match.score,92);
 assert.match(display.heading,/92\/100.*Backend API/);
 vm.runInContext('candidateDetail("candidate")',context);
 assert.equal(context.display.match.score,null);
 assert.match(context.display.heading,/10\/18/);
});

test('optional card explanation opens the current catalogue score and also handles browsing without a need',()=>{
 const context=client();
 context.payload={favorites:[],candidates:[{...profile,match:matching(profile,parseNeed('Middle Backend Python'))}]};
 const html=vm.runInContext('state=payload;candidateCard(state.candidates[0])',context);
 assert.match(html,/data-action="candidate-score" data-id="candidate"/);
 assert.match(html,/aria-label="Как рассчитана оценка Candidate"/);
 assert.match(html,/Соответствие: 92\/100/);
 assert.doesNotMatch(html,/по запросу|сила профиля/i);
 const display=vm.runInContext('candidateScore("candidate");display',context);
 assert.equal(display.match.score,context.payload.candidates[0].match.score);
 assert.equal(display.heading,'Соответствие профиля: 92/100');
 context.payload.candidates[0].match=matching(profile,null);
 vm.runInContext('candidateScore("candidate")',context);
 assert.equal(context.display.match.score,null);assert.equal(context.display.heading,'Тесты и ФСП: 10/18');
 assert.match(vm.runInContext('candidateCard(state.candidates[0])',context),/Тесты и ФСП: 10\/18/);
});

test('a saved strength sort cannot override profile fit ordering after confirming a request',()=>{
 const context=client(),need={...parseNeed('Middle Backend Python'),confirmed:true};
 const fit=matching(profile,need);
 context.payload={need,favorites:[],candidates:[
  {...profile,id:'better-fit',match:{...fit,score:97,strength:15}},
  {...profile,id:'stronger-tests',match:{...fit,score:76,strength:30}}
 ]};
 const ids=vm.runInContext('state={...emptyState(),...payload};filter.sort="strength";filteredCandidates().map(c=>c.id)',context);
 assert.deepEqual(Array.from(ids),['better-fit','stronger-tests']);
 const html=vm.runInContext('catalogPage()',context);
 assert.match(html,/По соответствию профиля/);
 assert.doesNotMatch(html,/value="strength"|по силе профиля/i);
 vm.runInContext('state.need=null',context);
 assert.deepEqual(Array.from(vm.runInContext('filteredCandidates().map(c=>c.id)',context)),['stronger-tests','better-fit']);
 assert.match(vm.runInContext('catalogPage()',context),/По тестам и ФСП/);
});

test('saved searches retain every candidate ID above 50 and reopening an unchanged snapshot does not invent new candidates',async()=>{
 const {repo,employer}=await employerWorkspace();
 for(let i=0;i<60;i++)await repo.saveAccount({id:`person-${i}`,roles:['candidate'],privacy:{visible:true,consent:true},profile:{...profile}});
 await action(repo,employer,{action:'need',text:'Middle Backend Python',confirmed:true});
 const [saved]=await repo.scoped('need',employer.id);
 assert.ok(saved.snapshot.total>50);
 assert.equal(saved.snapshot.items.length,saved.snapshot.total);
 const context=client();
 context.payload=await getState(repo,employer,'employer',saved.text,{...saved.context,spec:saved.spec,grade:saved.grade,stack:saved.stack,confirmed:true});context.saved=saved;
 assert.equal(vm.runInContext('state=payload;activeNeed=saved;state.candidates.filter(isFresh).length',context),0);
 context.saved={...saved,snapshot:{...saved.snapshot,items:saved.snapshot.items.slice(0,50)}};
 assert.equal(vm.runInContext('activeNeed=saved;state.candidates.filter(isFresh).length',context),0);
 assert.match(vm.runInContext('snapshotNote()',context),/неполный исторический снимок/);
});

test('employer confirms missing categories and can override suggestions without losing team context',async()=>{
 const {repo,employer}=await employerWorkspace();
 const query='Нужен сильный инженер в продуктовую команду';
 const unconfirmed=await getState(repo,employer,'employer',query);
 assert.deepEqual(unconfirmed.need.missing,['spec','grade']);
 assert.equal(unconfirmed.need.confirmed,false);assert.equal(unconfirmed.candidates.length,0);
 const selection={spec:'Backend',grade:'Middle',stack:'Python, Postgres',team:'Платёжный сервис',budgetMax:220000,format:'Удалённо',confirmed:true};
 const confirmed=await getState(repo,employer,'employer',query,selection);
 assert.equal(confirmed.need.confirmed,true);assert.deepEqual(confirmed.need.stack,['Python','PostgreSQL']);assert.equal(confirmed.need.budgetMax,220000);assert.ok(confirmed.candidates.length);
 assert.equal(selectedNeed(query,{...selection,grade:''}).confirmed,false);
 await assert.rejects(action(repo,employer,{action:'need',text:query,...selection,confirmed:false}));
 const result=await actionResponse(repo,employer,{action:'favorite',candidateId:confirmed.candidates[0].id,returnState:true,stateRole:'employer',stateQuery:query,stateSelection:selection});
 assert.equal(result.state.need.confirmed,true);assert.equal(result.state.need.budgetMax,220000);assert.deepEqual(result.state.need.stack,confirmed.need.stack);
});

test('parser leaves unknown and conflicting categories for employer confirmation and keeps evidence for recognised words',()=>{
 const unknown=parseNeed('Нужен сильный инженер в продуктовую команду');
 assert.equal(unknown.spec,null);assert.equal(unknown.grade,null);
 const ambiguous=parseNeed('Junior или Senior Backend или Frontend');
 assert.equal(ambiguous.spec,null);assert.equal(ambiguous.grade,null);
 assert.deepEqual(ambiguous.ambiguous,{spec:true,grade:true});
 const explicit=parseNeed('Middle backend: Python и PostgreSQL');
 assert.deepEqual([explicit.spec,explicit.grade],['Backend','Middle']);
 assert.ok(explicit.signals.some(s=>s.field==='Специализация'&&s.quote==='backend'));
 assert.ok(explicit.signals.some(s=>s.field==='Уровень'&&s.quote==='middle'));
});


test('home candidate search switches workspace and requests explicit confirmation without retaining an old need',async()=>{
 const context=client();
 vm.runInContext("render=()=>{};state={authenticated:true,roles:['candidate','employer']};role='candidate';needConfirmed=true;needSpec='QA';needGrade='Senior';needContext={team:'Old team'};activeNeed={id:'old'};refresh=async()=>{state.need={spec:'Backend',grade:'Middle'};};confirmNeed=()=>{globalThis.confirmation={query,role,page};};searchFromHome('Middle Backend Python');",context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(JSON.parse(JSON.stringify(context.confirmation)),{query:'Middle Backend Python',role:'employer',page:'catalog'});
 assert.equal(vm.runInContext('needConfirmed',context),false);
 assert.equal(vm.runInContext('needSpec',context),'');
 assert.equal(vm.runInContext('activeNeed',context),null);
 assert.equal(vm.runInContext('needContext.team',context),'');
});

test('home search preserves its request and catalogue destination while a company profile is created',()=>{
 const context=client();
 vm.runInContext("render=()=>{};state={authenticated:true,roles:['candidate'],profile:{},user:{email:'test@example.test'}};modal=(title,description,body)=>{globalThis.onboardingForm=body;};searchFromHome('Junior Frontend React');",context);
 assert.match(context.onboardingForm,/data-next="catalog"/);
 assert.equal(vm.runInContext('query',context),'Junior Frontend React');
 assert.equal(vm.runInContext('pendingHomeSearch',context),true);
 vm.runInContext("state.roles.push('employer');confirmNeed=()=>{globalThis.confirmedQuery=query;};go('catalog');",context);
 assert.equal(context.confirmedQuery,'Junior Frontend React');
 assert.equal(vm.runInContext('pendingHomeSearch',context),false);
});

test('vacancy URLs render a full public page and survive a fresh deep link',async()=>{
 const {seed}=await import('../lib/seed.mjs');
 const context=client();context.jobs=seed.jobs;
 const html=vm.runInContext("state={...emptyState(),jobs};location.hash='#job/demo-job-1';page=routePage(location.hash.slice(1));jobPage()",context);
 assert.equal(vm.runInContext('page',context),'job');
 for(const heading of ['Чем предстоит заниматься','Что ждём от вас','Что предлагаем','Как проходит знакомство'])assert.ok(html.includes(heading));
 assert.ok(html.includes('/companies/kontur.svg'));
 assert.ok(html.includes('Описание и условия синтетические'));
 assert.match(vm.runInContext('jobCard(jobs[0])',context),/href="#job\/demo-job-1"/);
 vm.runInContext("location.hash='#job/unknown'",context);
 assert.match(vm.runInContext('jobPage()',context),/Вакансия недоступна/);
 vm.runInContext("location.hash='#job/%E0%A4%A'",context);
 assert.match(vm.runInContext('jobPage()',context),/Вакансия недоступна/);
});

test('demonstration vacancies cover every direction with complete original content',async()=>{
 const {seed}=await import('../lib/seed.mjs');
 assert.equal(seed.jobs.length,120);
 assert.deepEqual(new Set(seed.jobs.map(j=>j.spec)),new Set(['Backend','Frontend','Data Science','DevOps','QA']));
 assert.equal(new Set(seed.jobs.map(j=>j.id)).size,120);
 for(const job of seed.jobs){
  assert.equal(job.synthetic,true);assert.equal(job.own,false);
  assert.ok(job.city&&['Удалённо','Гибрид','Офис'].includes(job.format));
  assert.ok(job.min>0&&job.max>=job.min);
  for(const key of ['responsibilities','requirements','benefits','hiringSteps'])assert.ok(job[key].length>=3,`${job.id}: ${key}`);
 }
});

test('city and remote preferences filter both job and candidate discovery',()=>{
 const context=client();
 vm.runInContext("locationPreference={city:'Москва',format:'Удалённо'}",context);
 assert.equal(vm.runInContext("matchesLocation({city:'Москва',format:'Удалённо'})",context),true);
 assert.equal(vm.runInContext("matchesLocation({city:'Санкт-Петербург',format:'Удалённо'})",context),false);
 assert.equal(vm.runInContext("matchesLocation({city:'Москва',format:'Офис'})",context),false);
 vm.runInContext("locationPreference={city:'',format:'Удалённо'}",context);
 assert.equal(vm.runInContext("matchesLocation({city:'Екатеринбург',format:'Удалённо'})",context),true);
});

test('vacancy search accepts several terms across the title, company and technologies',async()=>{
 const {seed}=await import('../lib/seed.mjs');const context=client();context.job=seed.jobs[0];
 assert.equal(vm.runInContext("jobQuery='python docker';jobMatchesQuery(job)",context),true);
 assert.equal(vm.runInContext("jobQuery='контур middle';jobMatchesQuery(job)",context),true);
 assert.equal(vm.runInContext("jobQuery='python react';jobMatchesQuery(job)",context),false);
});

test('large vacancy feeds paginate, clamp the current page after filtering and keep shareable links',async()=>{
 const {seed}=await import('../lib/seed.mjs');const context=client();context.jobs=seed.jobs;
 const html=vm.runInContext("state={...emptyState(),jobs};page='jobs';jobPageIndex=8;jobsPage()",context);
 assert.equal((html.match(/class="job-card"/g)||[]).length,15);
 assert.ok(html.includes('120 вакансий'));assert.ok(html.includes('aria-current="page"'));
 assert.ok(html.includes('#job/'+seed.jobs[105].id));
 vm.runInContext("jobQuery='python docker';jobsPage()",context);
 assert.equal(vm.runInContext('jobPageIndex',context),1);
});

test('the employer journey is primary and audience tabs replace the duplicate workspace chooser',async()=>{
 const context=client();
 assert.equal(vm.runInContext('homeMode',context),'employer');
 const header=vm.runInContext('header()',context);
 assert.ok(header.indexOf('Ищу сотрудника')<header.indexOf('Ищу работу'));
 assert.ok(!header.includes('switch-workspace'));
 vm.runInContext("render=()=>{};refresh=async()=>{}",context);
 await vm.runInContext("selectAudience('candidate')",context);
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify({homeMode,role,page})',context)),{homeMode:'candidate',role:'candidate',page:'home'});
 await vm.runInContext("selectAudience('employer')",context);
 assert.equal(vm.runInContext('role',context),'employer');
 assert.match(vm.runInContext('home()',context),/Найдите человека<br>под задачу команды/);
});

test('landing preview contains only synthetic public summaries with no contacts or private accounts',async()=>{
 const {demoCandidatePreview}=await import('../lib/service.mjs');const previews=demoCandidatePreview();
 assert.equal(previews.length,3);
 assert.deepEqual(previews.map(c=>c.spec),['Backend','Frontend','DevOps']);
 for(const c of previews){assert.equal(c.synthetic,true);assert.equal(c.verified,true);assert.ok(!('email' in c));assert.ok(!('phone' in c));assert.ok(!('resume' in c));assert.ok(!('privacy' in c));}
});


test('mouse-selected assessment answers reach the draft through the installed change listener and submit the chosen option',async()=>{
 const context=client();
 context.exam={id:'click-test',status:'active',modules:['react'],moduleIndex:0,currentModule:{id:'react',name:'React',questions:[{id:'q1',format:'choice',prompt:'Как изменить состояние?',options:['Первый','Второй','Третий','Четвёртый']}],questionSeconds:20}};
 vm.runInContext('assessmentAttempt=exam;assessmentQuestion=0;assessmentDraft=null;page="tests";render=()=>{};globalThis.submissions=[];assessmentRun=async(action,payload)=>submissions.push({action,...payload});',context);
 assert.doesNotMatch(vm.runInContext('assessmentExamMarkup()',context),/type="submit"/);
 for(const handler of context.documentEvents.change)handler({target:{name:'assessmentAnswer',value:'2',dataset:{}}});
 assert.equal(vm.runInContext('assessmentDraft',context),2);
 const markup=vm.runInContext('assessmentExamMarkup()',context);
 assert.match(markup,/value="2" checked/);
 assert.doesNotMatch(markup,/class="exam-check" type="submit" disabled/);
 assert.equal((markup.match(/type="submit"/g)||[]).length,1);
 assert.equal(context.submissions.length,0,'selection must not advance the question');
 await vm.runInContext('assessmentConfirm()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.submissions)),[{action:'assessment-answer',questionId:'q1',answer:2}]);
 // Option zero must also enable confirmation; saving must reject further changes.
 for(const handler of context.documentEvents.change)handler({target:{name:'assessmentAnswer',value:'0',dataset:{}}});
 assert.equal(vm.runInContext('assessmentDraft',context),0);
 assert.doesNotMatch(vm.runInContext('assessmentExamMarkup()',context),/class="exam-check" type="submit" disabled/);
 vm.runInContext('assessmentSaving=true',context);
 for(const handler of context.documentEvents.change)handler({target:{name:'assessmentAnswer',value:'3',dataset:{}}});
 assert.equal(vm.runInContext('assessmentDraft',context),0);
});


test('autosave serializes rapid choices and confirmation uses the saved revision without waiting for the timer',async()=>{
 const context=client();
 context.exam={id:'autosave-test',revision:0,status:'active',modules:['react'],moduleIndex:0,currentModule:{id:'react',name:'React',questionIndex:0,answers:{},questions:[{id:'q1',format:'choice',prompt:'Вопрос',options:['A','B','C','D']}],questionSeconds:20,expiresAt:Date.now()+20000}};
 context.calls=[];let release;const delayed=new Promise(resolve=>{release=resolve;});
 context.api=async body=>{
  context.calls.push({...body});
  if(context.calls.length===1)await delayed;
  assert.equal(body.revision,context.exam.revision);
  context.exam={...context.exam,revision:context.exam.revision+1,currentModule:{...context.exam.currentModule,answers:{q1:body.answer}}};
  return {assessment:context.exam};
 };
 vm.runInContext('assessmentAccept(exam);page="tests";render=()=>{};',context);
 for(const value of ['0','1','3'])for(const handler of context.documentEvents.change)handler({target:{name:'assessmentAnswer',value,dataset:{}}});
 assert.equal(context.calls.length,1,'only one draft request may be in flight');
 const confirm=vm.runInContext('assessmentConfirm()',context);
 assert.equal(context.calls.length,1,'confirmation waits for queued selections');
 release();await confirm;
 assert.deepEqual(context.calls.map(c=>[c.action,c.answer,c.revision]),[['assessment-draft',0,0],['assessment-draft',3,1],['assessment-answer',3,2]]);
});

test('numeric autosave accepts zero, clears partial expressions and restores saved answers on reload',async()=>{
 const context=client();
 context.exam={id:'numeric-autosave',revision:0,status:'active',modules:['sql'],moduleIndex:0,currentModule:{id:'sql',name:'SQL',questionIndex:0,answers:{},questions:[{id:'n1',format:'numeric',prompt:'Число'}],questionSeconds:20}};
 context.calls=[];
 context.api=async body=>{context.calls.push({...body});context.exam={...context.exam,revision:context.exam.revision+1,currentModule:{...context.exam.currentModule,answers:{n1:body.answer}}};return {assessment:context.exam};};
 vm.runInContext('assessmentAccept(exam);page="tests";render=()=>{};',context);
 for(const value of ['0','12,5','1e','']){
  for(const handler of context.documentEvents.input)handler({target:{name:'assessmentNumeric',value,dataset:{}}});
  await vm.runInContext('assessmentFlushDraft()',context);
 }
 assert.deepEqual(context.calls.map(c=>c.answer),['0','12,5',null,null]);
 context.exam.currentModule.answers.n1='0';
 vm.runInContext('assessmentAttempt=null;assessmentAccept(exam)',context);
 assert.equal(vm.runInContext('assessmentDraft',context),'0');
});

test('a timeout during autosave recovery clears the old draft and cannot submit it for the next question',async()=>{
 const context=client();
 context.exam={id:'expiry-during-save',revision:0,status:'active',modules:['react'],moduleIndex:0,currentModule:{id:'react',name:'React',questionIndex:0,answers:{},questions:[{id:'q1',format:'choice',prompt:'Первый',options:['A','B','C','D']},{id:'q2',format:'choice',prompt:'Второй',options:['A','B','C','D']}],questionSeconds:20}};
 context.calls=[];
 context.api=async body=>{context.calls.push({...body});if(body.action==='assessment-draft')throw new Error('Expired');context.exam={...context.exam,revision:1,currentModule:{...context.exam.currentModule,questionIndex:1,answers:{q1:0}}};return {assessment:context.exam};};
 vm.runInContext('assessmentAccept(exam);page="tests";render=()=>{};',context);
 vm.runInContext('assessmentSaveAnswer(0)',context);
 await vm.runInContext('assessmentConfirm()',context);
 assert.deepEqual(context.calls.map(c=>c.action),['assessment-draft','assessment-resume']);
 assert.equal(vm.runInContext('assessmentQuestion',context),1);assert.equal(vm.runInContext('assessmentDraft',context),null);
});

test('coding task formats and examples render beside the editor and escape authored HTML',()=>{
 const context=client();
 context.codingQuestion={id:'code-docs',format:'coding',coding:{language:'python',starter:'print(0)',inputFormat:'Массив из stdin',outputFormat:'Число в stdout',examples:[{input:'[1, 2]',output:'2',explanation:'Два положительных числа.'},{input:'<script>bad()</script>',output:'0'}]}};
 vm.runInContext('assessmentDraftKey=()=>"code-docs";',context);
 context.exam={id:'code-docs',status:'active',modules:['python'],moduleIndex:0,currentModule:{id:'python',name:'Python',questionIndex:0,answers:{},questions:[context.codingQuestion],questionSeconds:300}};
 vm.runInContext('assessmentAccept(exam);',context);
 const markup=vm.runInContext('assessmentExamMarkup()',context);
 for(const label of ['Формат ввода','Формат вывода','Примеры','Пример 1','Пример 2','Два положительных числа.'])assert.ok(markup.includes(label));
 assert.ok(markup.indexOf('coding-task')<markup.indexOf('Формат ввода'));
 assert.ok(markup.indexOf('Пример 2')<markup.indexOf('coding-solution'));
 assert.ok(markup.includes('&lt;script&gt;'));assert.ok(!markup.includes('<script>'));
});

test('coding editor has editable example input, separate output and bounded submission controls with segmented feedback',()=>{
 const context=client();context.q={id:'code-ui',format:'coding',coding:{language:'python',starter:'print(0)',input:'[1,2]',inputFormat:'JSON',outputFormat:'JSON',examples:[],submission:{used:2,limit:3,passed:2,total:4,results:[true,true,false,false]}}};
 vm.runInContext('assessmentDraftKey=()=>"code-ui";',context);
 const editor=vm.runInContext('assessmentCodingMarkup(q,null)',context),actions=vm.runInContext('assessmentCodingActions(q,true)',context);
 assert.match(editor,/name="assessmentStdin"/);assert.match(editor,/>\[1,2\]<\/textarea>/);assert.ok(editor.indexOf('coding-editor-wrap')<editor.indexOf('coding-io'));
 assert.match(actions,/Отправить/);assert.match(actions,/Далее/);assert.match(actions,/1 из 3/);assert.equal((actions.match(/<circle /g)||[]).length,4);assert.equal((actions.match(/stroke="#60c84c"/g)||[]).length,2);assert.match(actions,/Пройдено тестов: 2 из 4/);
 vm.runInContext('q.coding.submission.used=3;',context);assert.match(vm.runInContext('assessmentCodingActions(q,true)',context),/data-action="assessment-code-submit" disabled/);
});
