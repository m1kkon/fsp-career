import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoCandidates} from '../lib/demo-candidates.mjs';
import {seed} from '../lib/seed.mjs';
import {publicCandidate} from '../lib/domain.mjs';
import {candidateSemanticText} from '../lib/ats.mjs';
import {matching,selectedNeed,recommendCategories,rankCandidates} from '../lib/matching.mjs';
import {mockFspProfile} from '../lib/fsp.mjs';

const NOW=Date.parse('2026-10-09T12:00:00Z');
const people=seed.candidates.map(account=>publicCandidate(account));
const corpus=people.map(candidateSemanticText);
const rowsFor=need=>people.map(candidate=>({...candidate,match:matching(candidate,need,NOW,corpus)}));
const backendNeed=overrides=>selectedNeed('Middle Backend Python PostgreSQL',{
 confirmed:true,requiredStack:['Python','PostgreSQL'],preferredStack:['SQL','Docker','Pytest'],
 englishLevel:'B2',minExperience:3,format:'Удалённо',city:'Москва',budgetMax:250000,
 formatRequired:true,locationRequired:true,salaryRequired:true,
 team:'Платежи и интеграции с банками для малого бизнеса',...overrides,
});
const part=(row,key)=>row.match.parts.find(item=>item.key===key);

test('demo bank covers six directions, all grades and varied test and questionnaire results',()=>{
 assert.equal(seed.candidates.length,64);assert.equal(demoCandidates.length,48);
 assert.equal(new Set(people.map(row=>row.id)).size,people.length);
 assert.equal(new Set(people.map(row=>row.name)).size,people.length);
 assert.equal(Math.min(...people.map(row=>row.score)),60);assert.equal(Math.max(...people.map(row=>row.score)),99);
 for(const spec of ['Backend','Frontend','Data Science','ML Engineering','DevOps','QA']){
  const group=demoCandidates.filter(account=>account.profile.spec===spec);
  assert.equal(group.length,8);assert.deepEqual([...new Set(group.map(account=>account.profile.grade))],['Junior','Middle','Senior']);
  assert.ok(group.some(account=>account.profile.ats.experienceYears===null));
  assert.ok(group.some(account=>account.profile.ats.languages.length===0));
  assert.ok(group.some(account=>account.profile.format==='Офис'));
  assert.ok(group.some(account=>account.profile.ats.relocation==='Готов к переезду'));
 }
 for(const account of demoCandidates){
  const projected=publicCandidate(account);
  assert.equal(projected.synthetic,true);assert.equal(projected.verified,true);
  assert.ok(projected.about.length>100&&projected.work.length>100);
  assert.equal(projected.email,undefined);
  assert.ok(projected.ats.languages.every(language=>language.source==='candidate'));
 }
});

test('additional FSP histories have distinct canonical IDs and preserve original adapter fixtures',()=>{
 const linked=demoCandidates.map(account=>account.profile.fsp).filter(Boolean);
 assert.equal(new Set(linked.map(profile=>profile.id)).size,linked.length);
 for(const profile of linked)assert.deepEqual(profile,mockFspProfile(profile.id));
 assert.ok(linked.some(profile=>profile.achievements.length===0));
 assert.ok(linked.some(profile=>profile.achievements.some(result=>result.year===2022)));
 assert.equal(mockFspProfile('DEMO-FSP-001').achievements[0].result,'Финалист');
 assert.equal(mockFspProfile('DEMO-FSP-014').achievements[0].result,'Участник финала');
});

test('hard conditions outrank stronger tests; missing answers and relocation are distinguishable',()=>{
 const need=backendNeed(),rows=rowsFor(need),by=Object.fromEntries(rows.map(row=>[row.id,row]));
 const fit=by['search-demo-3'],wrongStack=by['search-demo-5'],expensive=by['search-demo-6'],incomplete=by['search-demo-8'];
 assert.equal(fit.match.eligibility.status,'pass');
 assert.equal(wrongStack.match.eligibility.status,'fail');
 assert.ok(wrongStack.match.eligibility.failed.some(check=>check.label==='Навык: Python'));
 assert.ok(wrongStack.match.eligibility.failed.some(check=>check.id==='format'));
 assert.deepEqual(expensive.match.eligibility.failed.map(check=>check.id),['salary']);
 assert.equal(incomplete.match.eligibility.status,'unknown');
 assert.deepEqual(incomplete.match.eligibility.unknown.map(check=>check.id),['english','experience']);
 assert.equal(incomplete.match.eligibility.checks.find(check=>check.id==='city').status,'pass');
 assert.ok(expensive.score>fit.score&&wrongStack.score>fit.score);
 const ranked=rankCandidates(rows,need,recommendCategories(rows,need));
 assert.ok(ranked.indexOf(fit)<ranked.indexOf(expensive));
 assert.ok(ranked.indexOf(fit)<ranked.indexOf(wrongStack));
 assert.ok(ranked.indexOf(incomplete)<ranked.indexOf(expensive));
});

test('same-score Python profiles isolate the FSP bonus without changing other score parts',()=>{
 const need=backendNeed(),rows=rowsFor(need);
 const plain=rows.find(row=>row.id==='search-demo-3'),winner=rows.find(row=>row.id==='search-demo-4');
 assert.equal(plain.score,winner.score);assert.equal(plain.match.eligibility.status,'pass');assert.equal(winner.match.eligibility.status,'pass');
 assert.equal(part(plain,'fsp').points,0);assert.equal(part(winner,'fsp').points,6);
 assert.deepEqual(plain.match.parts.filter(item=>item.key!=='fsp'),winner.match.parts.filter(item=>item.key!=='fsp'));
 assert.equal(winner.match.score,plain.match.score+6);
});

test('text similarity diagnostics cannot override the displayed candidate score',()=>{
 const settings={requiredStack:['Python','PostgreSQL'],preferredStack:[],englishLevel:null,minExperience:0,formatRequired:false,locationRequired:false,salaryRequired:false};
 const payment=backendNeed({...settings,team:'Платежи и интеграции с банками для малого бизнеса'});
 const education=backendNeed({...settings,team:'Образовательная платформа: расписание, импорт курсов, кабинет преподавателя'});
 const compare=need=>{
  const rows=rowsFor(need).filter(row=>['search-demo-3','search-demo-8'].includes(row.id));
  assert.ok(rows.every(row=>row.match.eligibility.status==='pass'));
  return rankCandidates(rows,need,recommendCategories(rows,need));
 };
 assert.equal(compare(payment)[0].id,'search-demo-3');
 assert.equal(compare(education)[0].id,'search-demo-8');
 const educationRows=compare(education);
 const inverted=educationRows.map((row,i)=>({...row,match:{...row.match,semantic:{score:i===0?0:100}}}));
 assert.deepEqual(rankCandidates(inverted,education).map(row=>row.id),educationRows.map(row=>row.id));
 assert.ok(educationRows[0].match.score>educationRows[1].match.score);
});

test('every direction has a complete matching profile and a higher-test stack mismatch',()=>{
 const stacks=[['Python','PostgreSQL'],['React','TypeScript'],['Python','Pandas'],['Docker','Kubernetes'],['Kubernetes','Terraform'],['Python','Pytest']];
 const specs=['Backend','Frontend','Data Science','ML Engineering','DevOps','QA'];
 for(const [index,spec] of specs.entries()){
  const need=selectedNeed(`Middle ${spec}`,{confirmed:true,spec,grade:'Middle',requiredStack:stacks[index],preferredStack:[],englishLevel:'B2',minExperience:3});
  const rows=rowsFor(need),fit=rows.find(row=>row.id===`search-demo-${index*8+3}`),other=rows.find(row=>row.id===`search-demo-${index*8+5}`);
  assert.equal(fit.match.eligibility.status,'pass',spec);
  assert.ok(other.score>fit.score,spec);assert.notEqual(other.match.eligibility.status,'pass',spec);
  assert.ok(rows.indexOf(fit)<rows.indexOf(other),spec);
 }
});
