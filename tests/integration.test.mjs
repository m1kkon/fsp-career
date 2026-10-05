import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as history from '../public/resume-history.mjs';
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
 const context=vm.createContext({...history,document:{getElementById:()=>element,querySelector:()=>null,addEventListener:()=>{},body:{classList:{add:()=>{},remove:()=>{}}}},window:{addEventListener:()=>{},scrollTo:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{}},location:{hash:''},setInterval:()=>{}});
 const source=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8').replace(/^import .*;\n/,'').replace(/^boot\(\);$/m,'');
 vm.runInContext(source,context);
 vm.runInContext('modal=()=>{};matchBreakdown=(match,heading)=>{globalThis.display={match,heading};return "";}',context);
 return context;
}
const profile={id:'candidate',name:'Candidate',city:'Москва',experience:'3 года',spec:'Backend',grade:'Middle',stack:['Python'],score:90,min:180000,max:220000,format:'Удалённо',verified:true};

test('opening an application selects its vacancy score even when the candidate is in the catalogue or has several applications',()=>{
 const context=client();
 context.payload={candidates:[{...profile,match:matching(profile,null)}],applications:[{id:'first',owner:profile.id,job:{title:'First'},candidate:{...profile,match:matching(profile,parseNeed('Senior Frontend React'))}},{id:'second',owner:profile.id,job:{title:'Backend API'},candidate:{...profile,match:matching(profile,parseNeed('Middle Backend Python'))}}]};
 const display=vm.runInContext('state=payload;candidateDetail("candidate","second");display',context);
 assert.equal(display.match.score,86);
 assert.match(display.heading,/86\/100.*Backend API/);
 vm.runInContext('candidateDetail("candidate")',context);
 assert.equal(context.display.match.score,null);
 assert.match(context.display.heading,/16\/30/);
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
