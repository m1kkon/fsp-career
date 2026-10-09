import {test} from 'node:test';
import assert from 'node:assert/strict';
import {salaryRangeFit} from '../lib/salary-range.mjs';
import {selectedNeed,matching} from '../lib/matching.mjs';
import {evaluateHardFilters} from '../lib/ats.mjs';
import {accountFor,action,getState} from '../lib/service.mjs';
const budget={budgetMin:100000,budgetMax:200000};

test('salary overlap uses both inclusive bounds and supports open ranges',()=>{
 for(const [min,max,status] of [[140000,180000,'pass'],[160000,240000,'pass'],[200000,200000,'pass'],[80000,100000,'pass'],[80000,99999,'fail'],[200001,300000,'fail'],[null,null,'unknown'],[210000,180000,'unknown'],[110000,null,'pass'],[null,150000,'pass']])assert.equal(salaryRangeFit({min,max},budget).status,status,`${min}–${max}`);
 assert.equal(salaryRangeFit({min:120000,max:180000},{budgetMin:200000}).status,'fail');
 assert.equal(salaryRangeFit({min:210000,max:250000},{budgetMax:200000}).status,'fail');
 assert.equal(salaryRangeFit({},{}).status,'pass');
});

test('entering a budget enables salary requirements, including a lower bound alone',()=>{
 const candidate={id:'person',spec:'Backend',grade:'Middle',verified:true,score:90,stack:[],min:80000,max:90000};
 const need=selectedNeed('Middle Backend',{...budget,confirmed:true});
 assert.equal(need.salaryRequired,true);
 const salary=evaluateHardFilters(candidate,need).checks.find(check=>check.id==='salary');
 assert.equal(salary.status,'fail');assert.match(salary.expected,/100.*200/);assert.match(salary.actual,/80.*90/);
 assert.equal(matching(candidate,need).parts.find(part=>part.key==='salary').points,3);
 assert.equal(evaluateHardFilters(candidate,selectedNeed('Middle Backend',{budgetMin:100000,confirmed:true})).status,'fail');
 assert.equal(selectedNeed('Middle Backend',{confirmed:true}).salaryRequired,false);
});

function memory(){
 const accounts=new Map(),records=new Map(),clone=x=>x?structuredClone(x):null;
 return {account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),record:async id=>clone(records.get(id)),put:async(kind,r)=>records.set(r.id,{...clone(r),kind})};
}
async function workspace(){
 const repo=memory(),employer=await accountFor(repo,{id:'hr',email:'hr@example.test'});
 await action(repo,employer,{action:'onboard',role:'employer',name:'Company',consent:true});
 for(const [id,min,max] of [['below',80000,90000],['fits',140000,180000],['overlap',160000,240000],['edge',200000,200000],['above',200001,250000],['unknown',null,null]])await repo.saveAccount({id:`salary-${id}`,roles:['candidate'],privacy:{visible:true,consent:true},profile:{name:id,spec:'Backend',grade:'Middle',score:90,verified:true,stack:['Python'],min,max}});
 return {repo,employer};
}
const ids=state=>state.candidates.filter(c=>c.id.startsWith('salary-')).map(c=>c.id).sort();
const expected=['salary-edge','salary-fits','salary-overlap'];

test('range removes out-of-budget and unknown salaries server-side; clearing it restores them',async()=>{
 const {repo,employer}=await workspace();
 const state=await getState(repo,employer,'employer','Middle Backend Python',{...budget,confirmed:true});
 assert.deepEqual(ids(state),expected);
 assert.ok(state.candidates.every(c=>c.match.eligibility.checks.find(check=>check.id==='salary').status==='pass'));
 const refreshed=await getState(repo,employer,'employer','Middle Backend Python',{...budget,confirmed:true});
 assert.deepEqual(ids(refreshed),expected);
 const browse=await getState(repo,employer,'employer','',budget);
 assert.equal(browse.need,null);assert.deepEqual(ids(browse),expected);assert.ok(browse.candidates.every(c=>c.match.score===null));
 const cleared=await getState(repo,employer,'employer','Middle Backend Python',{budgetMin:'',budgetMax:'',confirmed:true});
 assert.equal(ids(cleared).length,6);
});

test('saved salary range and shortlist survive reopening with identical results',async()=>{
 const {repo,employer}=await workspace();
 await action(repo,employer,{action:'need',text:'Middle Backend Python',budgetMin:'100.000',budgetMax:'200 000',confirmed:true});
 const [saved]=await repo.scoped('need',employer.id);
 assert.equal(saved.salaryRequired,true);assert.equal(saved.context.budgetMin,100000);assert.equal(saved.context.budgetMax,200000);
 assert.deepEqual(saved.snapshot.items.filter(c=>c.id.startsWith('salary-')).map(c=>c.id).sort(),expected);
 const reopened=await getState(repo,employer,'employer',saved.text,{...saved.context,spec:saved.spec,grade:saved.grade,salaryRequired:saved.salaryRequired,confirmed:true});
 assert.deepEqual(ids(reopened),expected);
});

test('invalid salary ranges fail before returning misleading search results',async()=>{
 const {repo,employer}=await workspace();
 for(const range of [{budgetMin:300000,budgetMax:200000},{budgetMin:'abc'},{budgetMax:-1}])await assert.rejects(getState(repo,employer,'employer','Middle Backend',{...range,confirmed:true}),error=>error.status===400);
});
