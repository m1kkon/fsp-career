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
 const context=vm.createContext({...history,document:{getElementById:()=>element,addEventListener:()=>{},body:{classList:{add:()=>{},remove:()=>{}}}},window:{addEventListener:()=>{}},localStorage:{getItem:()=>null},location:{hash:''},setInterval:()=>{}});
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
