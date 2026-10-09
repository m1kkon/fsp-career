import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WEIGHTS,parseNeed,needContext,needFromJob,matching,fspSignal,recommendCategories,rankCandidates,stackNames} from '../lib/matching.mjs';
import {publicCandidate} from '../lib/domain.mjs';
import {mockFspProfile} from '../lib/fsp.mjs';
import {seed} from '../lib/seed.mjs';
import {accountFor,action,getState} from '../lib/service.mjs';

const NOW=Date.parse('2026-10-05T12:00:00Z');
const QUERY='Middle backend Python PostgreSQL';
const TEAM={team:'Платёжный сервис для малого бизнеса: высокая нагрузка, интеграции с банками',format:'Удалённо',budgetMin:180000,budgetMax:250000};
const person=(id,profile,privacy={})=>({id,privacy,profile:{name:id,city:'Москва',spec:'Backend',grade:'Middle',stack:['Python','PostgreSQL'],score:90,min:180000,max:220000,format:'Удалённо',about:'',work:'',verified:true,fsp:null,...profile}});
const view=account=>publicCandidate(account);
const scored=(accounts,need)=>accounts.map(account=>{const c=view(account);return {...c,match:matching(c,need,NOW)};});
const part=(match,key)=>match.parts.find(p=>p.key===key);
const seedRows=need=>scored(seed.candidates,need);

test('every score is the sum of named parts and the weights add up to 100',()=>{
 assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
 for(const need of [parseNeed(QUERY),parseNeed(QUERY,TEAM),parseNeed('Senior QA pytest, офис, до 150 тыс',{city:'Казань'}),parseNeed('разработчик')])for(const row of seedRows(need)){
  const {score,parts}=row.match;
  assert.equal(score,parts.reduce((sum,p)=>sum+p.points,0));
  assert.equal(parts.reduce((sum,p)=>sum+p.max,0),100);
  assert.ok(parts.every(p=>Number.isInteger(p.points)&&p.points>=0&&p.points<=p.max&&p.note));
 }
});

test('need parser reads role words, synonyms, word boundaries and grade evidence',()=>{
 let need=parseNeed(QUERY);
 assert.equal(need.spec,'Backend');assert.equal(need.grade,'Middle');assert.deepEqual(need.stack,['Python','PostgreSQL']);
 assert.deepEqual(need.evidence.spec,['backend','Python','PostgreSQL']);assert.ok(need.adjacent.includes('Data Science'));assert.deepEqual(need.defaulted,{spec:false,grade:false});
 need=parseNeed('Сеньор бэкенд на питоне, постгрес, k8s');
 assert.equal(need.spec,'Backend');assert.equal(need.grade,'Senior');assert.deepEqual(need.stack,['Python','PostgreSQL','Kubernetes']);
 assert.equal(parseNeed('ML engineer: Python, PyTorch, рекомендации').spec,'ML Engineering');
 assert.equal(parseNeed('ML engineer или data scientist').spec,null);
 assert.equal(parseNeed('Senior mlops Python Docker').spec,'ML Engineering');
 need=parseNeed('Нужен разработчик React, опыт от 5 лет');
 assert.equal(need.spec,'Frontend');assert.equal(need.grade,'Senior');assert.equal(need.evidence.grade,'5 лет');
 assert.deepEqual(parseNeed('JavaScript и Java').stack,['JavaScript','Java']);
 assert.deepEqual(parseNeed('Django developer').stack,['Django']);
 assert.equal(parseNeed('Senior платёжная инфраструктура, backend').spec,'Backend');
 assert.deepEqual(parseNeed('разработчик').defaulted,{spec:true,grade:true});
 assert.equal(parseNeed('Backend, запуск проекта 2025 года').defaulted.grade,true);
 assert.equal(parseNeed('Senior разработчик',{team:'Пишем платёжный backend на Go'}).evidence.specSource,'team');
 assert.deepEqual(stackNames(['Postgres','k8s','JavaScript/TypeScript','RabbitMQ']),['PostgreSQL','Kubernetes','JavaScript','TypeScript','RabbitMQ']);
 assert.deepEqual(stackNames(['HFT','high-frequency trading']),['HFT']);
});

test('budget and format come from money-like phrases or explicit context only',()=>{
 let need=parseNeed('Middle backend, до 250 тыс., удалённо, опыт 3 года');
 assert.equal(need.budgetMin,null);assert.equal(need.budgetMax,250000);assert.equal(need.format,'Удалённо');assert.equal(need.evidence.budget,'text');
 need=parseNeed('QA автотесты от 180 до 220 тыс');assert.deepEqual([need.budgetMin,need.budgetMax],[180000,220000]);
 need=parseNeed('Backend 180 000–250 000 ₽');assert.deepEqual([need.budgetMin,need.budgetMax],[180000,250000]);
 for(const text of ['Backend с опытом 3–5 лет','До 2 лет опыта, Go','Kubernetes от 20 команд'])assert.deepEqual([parseNeed(text).budgetMin,parseNeed(text).budgetMax],[null,null],text);
 need=parseNeed('до 250 тыс, удалённо',{budgetMin:100000,budgetMax:150000,format:'Офис'});
 assert.deepEqual([need.budgetMin,need.budgetMax,need.format,need.evidence.budget,need.evidence.format],[100000,150000,'Офис','context','context']);
 assert.deepEqual(needContext({budgetMin:'300000',budgetMax:'200000',format:'Луна',team:' x '}),{team:'x',format:'',city:'',budgetMin:null,budgetMax:null});
 assert.equal(needContext({budgetMin:'180.000'}).budgetMin,180000);
});

test('FSP history lifts a candidate inside the category without excluding anyone',()=>{
 const need=parseNeed(QUERY);
 const rows=scored([person('with-fsp',{fsp:mockFspProfile('DEMO-FSP-001')}),person('no-history'),person('empty-history',{fsp:mockFspProfile('DEMO-FSP-004')})],need);
 const categories=recommendCategories(rows,need),ranked=rankCandidates(rows,need,categories);
 assert.deepEqual(ranked.map(r=>r.id),['with-fsp','empty-history','no-history']);
 assert.equal(categories[0].count,3);assert.equal(categories[0].withFsp,1);
 const [withFsp,...others]=ranked;
 assert.equal(part(withFsp.match,'fsp').points,4);
 for(const other of others){
  assert.equal(part(other.match,'fsp').points,0);assert.equal(other.match.relation,'exact');
  assert.deepEqual(other.match.parts.filter(p=>p.key!=='fsp'),withFsp.match.parts.filter(p=>p.key!=='fsp'));
 }
 assert.deepEqual(fspSignal(mockFspProfile('DEMO-FSP-004'),'Backend',NOW).items,[]);
 assert.equal(fspSignal(null,'Backend',NOW),null);
});

test('displayed score outranks lexical overlap and category position, but mandatory conditions come first',()=>{
 const need=parseNeed(QUERY);
 const row=(id,score,semantic,status='pass',grade='Middle')=>({id,spec:'Backend',grade,score:90,match:{score,strength:16,semantic:{score:semantic},eligibility:{status}}});
 const rows=[row('keyword-stuffed',76,99),row('stronger-senior',97,1,'pass','Senior'),row('fsp-winner',94,5),row('unknown',99,100,'unknown'),row('failed',100,100,'fail')];
 const categories=[{key:'Backend|Middle'},{key:'Backend|Senior'}];
 assert.deepEqual(rankCandidates(rows,need,categories).map(candidate=>candidate.id),['stronger-senior','fsp-winner','keyword-stuffed','unknown','failed']);
 // Text wording cannot break an otherwise equal candidate score and strength.
 const tied=[row('z',90,99),row('a',90,0)];
 assert.deepEqual(rankCandidates(tied,need,categories).map(candidate=>candidate.id),['a','z']);
});

test('FSP is a bounded bonus alongside test strength inside the same category',()=>{
 const need=parseNeed(QUERY);
 const rows=scored([person('test-100',{score:100}),person('participant',{score:83,fsp:mockFspProfile('DEMO-FSP-010')}),person('finalist',{score:83,fsp:mockFspProfile('DEMO-FSP-001')}),person('winner',{score:83,fsp:mockFspProfile('DEMO-FSP-012')})],need);
 assert.deepEqual(rankCandidates(rows,need,recommendCategories(rows,need)).map(r=>r.id),['winner','finalist','test-100','participant']);
 assert.deepEqual(rows.map(r=>part(r.match,'test').points),[12,9,9,9]);
 assert.deepEqual(rows.map(r=>part(r.match,'fsp').points),[0,2,4,6]);
});

test('FSP points use canonical adapter data, discipline fit, recency and the hidden-history setting',()=>{
 const forged={...mockFspProfile('DEMO-FSP-004'),achievements:[{event:'Forged',discipline:'Программирование ИИ',result:'1 место',level:'winner',year:2026}]};
 assert.equal(fspSignal(forged,'Backend',NOW).points,0);
 assert.equal(fspSignal({...mockFspProfile('DEMO-FSP-001'),source:'registry',status:'verified'},'Backend',NOW),null);
 assert.equal(fspSignal(mockFspProfile('DEMO-FSP-006'),'Data Science',NOW).points,6);
 assert.equal(fspSignal(mockFspProfile('DEMO-FSP-006'),'Backend',NOW).points,5);
 const older=fspSignal(mockFspProfile('DEMO-FSP-011'),'Backend',NOW);
 assert.equal(older.items.length,2);assert.equal(older.items[0].recency,0.75);assert.equal(older.points,4);
 assert.ok(fspSignal(mockFspProfile('DEMO-FSP-011'),'Backend',Date.parse('2024-06-01')).points>older.points);
 const hidden=view(person('hidden',{fsp:mockFspProfile('DEMO-FSP-001')},{fspVisible:false}));
 assert.equal(hidden.fsp,null);assert.equal(part(matching(hidden,parseNeed(QUERY),NOW),'fsp').points,0);
});

test('team context refines the order inside a category and explains each signal',()=>{
 const need=parseNeed(QUERY,{...TEAM,budgetMax:200000,format:'Офис',city:'Москва'});
 const rows=scored([
  person('fit',{min:150000,format:'Офис',about:'Пишу биллинг и интеграции с банками для малого бизнеса'}),
  person('remote',{min:150000,format:'Удалённо'}),
  person('hybrid-elsewhere',{min:150000,format:'Гибрид',city:'Казань'}),
  person('expensive',{min:240000,max:300000,format:'Офис'}),
  person('senior',{grade:'Senior',min:150000,format:'Офис',about:'Финтех, платежи, высокая нагрузка, интеграции, B2B',score:100,fsp:mockFspProfile('DEMO-FSP-006')}),
 ],need);
 const by=Object.fromEntries(rows.map(r=>[r.id,r.match]));
 assert.equal(part(by.fit,'format').points,4);assert.equal(part(by.remote,'format').points,0);assert.equal(part(by['hybrid-elsewhere'],'format').points,1);
 assert.match(part(by['hybrid-elsewhere'],'format').note,/город Казань/);
 assert.equal(part(by.fit,'salary').points,4);assert.equal(part(by.expensive,'salary').points,1);assert.match(part(by.expensive,'salary').note,/выше бюджета на 20%/);
 assert.equal(part(by.fit,'domain').points,2);assert.equal(part(by.remote,'domain').points,0);assert.match(part(by.fit,'domain').note,/финтех/);
 assert.ok(by.expensive.reasons.some(r=>/выше бюджета/.test(r)));
 // A stronger eligible neighbour can outrank an exact category by overall score.
 const ranked=rankCandidates(rows,need,recommendCategories(rows,need));
 assert.ok(by.senior.score>by.remote.score);assert.ok(ranked.indexOf(rows.find(row=>row.id==='senior'))<ranked.indexOf(rows.find(row=>row.id==='remote')));assert.equal(ranked[0].id,'senior');
});

test('category recommendations put the requested category first and explain neighbours',()=>{
 // Keep this focused fixture independent of additions to the full demo bank.
 const originalRows=need=>scored(seed.candidates.filter(account=>account.id.startsWith('demo-')),need);
 let need=parseNeed(QUERY,TEAM),categories=recommendCategories(originalRows(need),need);
 assert.deepEqual(categories.map(c=>`${c.spec}|${c.grade}|${c.relation}`),['Backend|Middle|exact','Backend|Senior|higher','Backend|Junior|lower','Data Science|Middle|adjacent']);
 assert.equal(categories[0].count,4);assert.equal(categories[0].withFsp,3);assert.equal(categories[0].inBudget,4);
 assert.deepEqual(categories[0].salary,{min:150000,max:250000});
 assert.match(categories[1].reason,/выше бюджета/);assert.match(categories.find(c=>c.spec==='Data Science').reason,/Python/);
 const ranked=rankCandidates(originalRows(need),need,categories);
 const eligible=ranked.filter(row=>row.match.eligibility.status==='pass');
 assert.deepEqual(ranked.slice(0,eligible.length),eligible);
 for(let i=1;i<eligible.length;i++)assert.ok(eligible[i-1].match.score>=eligible[i].match.score);
 need=parseNeed('Senior QA, pytest');categories=recommendCategories(originalRows(need),need);
 assert.equal(categories[0].relation,'exact');assert.equal(categories[0].count,0);assert.match(categories[0].reason,/Пока нет/);
 assert.ok(categories.some(c=>c.spec==='QA'&&c.grade==='Middle'&&c.relation==='lower'));
 const overview=recommendCategories(seedRows(null),null);
 assert.equal(overview.reduce((sum,c)=>sum+c.count,0),seed.candidates.length);assert.ok(overview.every(c=>c.relation==='all'&&c.count>0));
});

test('a vacancy acts as a structured need for its applicants',()=>{
 const need=needFromJob(seed.jobs[2]);
 assert.deepEqual([need.spec,need.grade,need.format,need.city,need.budgetMin,need.budgetMax],['Data Science','Middle','Гибрид','Москва',220000,300000]);
 assert.deepEqual(need.stack,['Python','SQL','PyTorch']);
 const ds=matching(view(seed.candidates.find(c=>c.id==='demo-6')),need,NOW);
 assert.equal(ds.relation,'exact');assert.equal(part(ds,'stack').points,12);
 const unverified=matching(view(person('draft',{verified:false,score:0})),need,NOW);
 assert.equal(unverified.relation,'other');assert.equal(part(unverified,'spec').points+part(unverified,'grade').points+part(unverified,'test').points,0);
});

function memory(){const accounts=new Map(),records=new Map();const clone=x=>x?structuredClone(x):null;return {account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),record:async id=>clone(records.get(id)),put:async(kind,r)=>records.set(r.id,{...clone(r),kind}),remove:async(id,owner)=>{if(records.get(id)?.owner===owner)records.delete(id);}};}
async function workspace(){
 const repo=memory();
 const candidate=await accountFor(repo,{id:'candidate-a',email:'a@example.test',name:'Candidate'});
 await action(repo,candidate,{action:'onboard',role:'candidate',name:'Candidate',city:'Москва',spec:'Backend',grade:'Middle',consent:true});
 candidate.profile={...candidate.profile,min:180000,max:220000,verified:true,spec:'Backend',grade:'Middle',score:90,stack:['Python','PostgreSQL'],verifiedAt:Date.now(),gradeChangedAt:Date.now()};await repo.saveAccount(candidate);
 const employer=await accountFor(repo,{id:'employer-a',email:'hr@example.test',name:'HR'});
 await action(repo,employer,{action:'onboard',role:'employer',name:'Company',description:'Product engineering team',contact:'hr@example.test',consent:true});
 return {repo,candidate,employer};
}

test('employer state carries the parsed need, team context and category recommendations',async()=>{
 const {repo,candidate,employer}=await workspace();
 const state=await getState(repo,employer,'employer',QUERY,{team:TEAM.team,format:'Удалённо',budgetMin:'180000',budgetMax:'250000',role:'employer',confirmed:true});
 assert.deepEqual([state.need.format,state.need.budgetMin,state.need.budgetMax],['Удалённо',180000,250000]);
 assert.equal(state.categories[0].key,'Backend|Middle');assert.equal(state.categories[0].count,seed.candidates.filter(account=>account.profile.spec==='Backend'&&account.profile.grade==='Middle'&&account.profile.min<=250000&&account.profile.max>=180000).length+1);
 const own=state.candidates.find(c=>c.id===candidate.id);
 assert.equal(own.match.relation,'exact');assert.equal(own.email,undefined);assert.ok(own.match.parts.some(p=>p.key==='salary'));
 const browse=await getState(repo,employer,'employer');
 assert.equal(browse.need,null);assert.ok(browse.categories.every(c=>c.relation==='all'));assert.ok(browse.candidates.every(c=>c.match.score===null&&Number.isInteger(c.match.strength)));
 const candidateView=await getState(repo,candidate,'candidate',QUERY);
 assert.deepEqual([candidateView.candidates,candidateView.categories,candidateView.need],[[],[],null]);
});

test('saved need keeps team context and a snapshot of the shortlist; invalid budgets are rejected',async()=>{
 const {repo,candidate,employer}=await workspace();
 await action(repo,employer,{action:'need',text:QUERY,confirmed:true,...TEAM,budgetMin:'180 000',city:'Москва'});
 const [saved]=await repo.scoped('need',employer.id);
 assert.deepEqual(saved.context,{team:TEAM.team,format:'Удалённо',city:'Москва',budgetMin:180000,budgetMax:250000});
 assert.equal(saved.spec,'Backend');assert.equal(saved.snapshot.total,seed.candidates.filter(account=>account.profile.spec==='Backend'&&account.profile.grade==='Middle'&&account.profile.min<=250000&&account.profile.max>=180000).length+1);
 const current=await getState(repo,employer,'employer',QUERY,{...saved.context,confirmed:true});
 assert.deepEqual(saved.snapshot.items,current.candidates.filter(row=>row.match.relation==='exact').map(row=>({id:row.id,score:row.match.score})));
 assert.ok(saved.snapshot.items.some(i=>i.id===candidate.id));assert.ok(saved.snapshot.items.every(i=>Number.isInteger(i.score)));
 assert.ok(!JSON.stringify(saved).includes(candidate.email));
 for(const budget of [{budgetMin:300000,budgetMax:200000},{budgetMin:'abc'},{budgetMax:-5}])await assert.rejects(action(repo,employer,{action:'need',text:QUERY,...budget}));
 await assert.rejects(action(repo,candidate,{action:'need',text:QUERY}));
 assert.equal((await repo.scoped('need',employer.id)).length,1);
});

test('hidden or missing FSP history neither moves nor hides a real candidate in employer search',async()=>{
 const {repo,candidate,employer}=await workspace();
 const find=async()=>(await getState(repo,employer,'employer',QUERY,{confirmed:true})).candidates.find(c=>c.id===candidate.id);
 const before=await find();
 assert.equal(part(before.match,'fsp').points,0);
 await action(repo,candidate,{action:'fsp-link',fspId:'DEMO-FSP-001'});
 const linked=await find();
 assert.equal(part(linked.match,'fsp').points,4);assert.equal(linked.match.score,before.match.score+4);
 await action(repo,candidate,{action:'settings',visible:true,consent:true,notifications:true,fspVisible:false});
 const hidden=await find();
 assert.equal(hidden.fsp,null);assert.equal(hidden.match.score,before.match.score);assert.equal(hidden.match.fsp,null);
 await action(repo,employer,{action:'invite',candidateId:candidate.id,title:'Backend',description:'API development in product team',min:180000,max:240000,contact:'hr@example.test'});
 assert.equal((await repo.records('invite')).length,1);
});
