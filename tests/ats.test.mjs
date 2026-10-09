import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHardFilters,tfidfSimilarity,candidateAtsProfile} from '../lib/ats.mjs';
import {selectedNeed} from '../lib/matching.mjs';

const candidate=(overrides={})=>({
 spec:'Backend',grade:'Senior',verified:true,stack:['Python','PostgreSQL'],experience:'3–5 лет',format:'Удалённо',city:'Москва',min:200000,
 ats:{languages:[{name:'Английский',level:'C1',source:'candidate',sourceLabel:'указано кандидатом'}],acceptedFormats:['Удалённо','Гибрид'],relocation:'Готов обсудить',...overrides},
});

test('ordinal filters accept a stronger grade and language level',()=>{
 const need=selectedNeed('Middle backend, английский B2',{spec:'Backend',grade:'Middle',englishLevel:'B2',confirmed:true});
 const checked=evaluateHardFilters(candidate(),need);
 assert.equal(checked.status,'pass');
 assert.equal(checked.checks.find(x=>x.id==='grade').actual,'Senior');
 assert.equal(checked.checks.find(x=>x.id==='english').actual,'C1');
});

test('required and preferred technologies have different consequences',()=>{
 const required=selectedNeed('Backend',{spec:'Backend',grade:'Middle',requiredStack:'Kubernetes',preferredStack:'Kafka',confirmed:true});
 const checked=evaluateHardFilters(candidate(),required);
 assert.equal(checked.status,'fail');
 assert.deepEqual(checked.failed.map(x=>x.expected),['Kubernetes']);
 assert.equal(required.preferredStack.includes('Kafka'),true);
 assert.equal(checked.checks.some(x=>x.expected==='Kafka'),false);
});

test('missing values require clarification instead of becoming a false match',()=>{
 const need=selectedNeed('Backend',{spec:'Backend',grade:'Middle',englishLevel:'B2',confirmed:true});
 const checked=evaluateHardFilters(candidate({languages:[]}),need);
 assert.equal(checked.status,'unknown');
 assert.equal(checked.unknown[0].label,'Английский язык');
});

test('explicit soft salary mode remains available; confirmed mandatory conditions are checked',()=>{
 const soft=selectedNeed('Backend',{spec:'Backend',grade:'Middle',format:'Офис',city:'Казань',budgetMax:150000,salaryRequired:false,confirmed:true});
 assert.equal(evaluateHardFilters(candidate(),soft).status,'pass');
 const hard=selectedNeed('Backend',{spec:'Backend',grade:'Middle',format:'Офис',city:'Казань',budgetMax:150000,formatRequired:true,locationRequired:true,salaryRequired:true,confirmed:true});
 const checked=evaluateHardFilters(candidate({relocation:'Не рассматриваю'}),hard);
 assert.equal(checked.status,'fail');
 assert.deepEqual(new Set(checked.failed.map(x=>x.id)),new Set(['format','city','salary']));
});

test('candidate ATS profile keeps claimed and verified facts distinguishable',()=>{
 const profile=candidateAtsProfile(candidate());
 assert.equal(profile.verifiedCategory,true);
 assert.equal(profile.skills.includes('PostgreSQL'),true);
 assert.equal(profile.languages[0].source,'candidate');
});

test('TF-IDF compares tasks with projects and returns shared terms',()=>{
 const close=tfidfSimilarity('разработка платёжного API на Python и PostgreSQL','создала платёжный API на Python, оптимизировала PostgreSQL',['React интерфейсы','Kubernetes инфраструктура']);
 const far=tfidfSimilarity('разработка платёжного API на Python и PostgreSQL','верстка дизайн-системы React CSS',['аналитика данных']);
 assert.ok(close.score>far.score);
 assert.ok(close.terms.includes('python'));
});

test('self-declared secondary specializations cannot satisfy a tested category filter',()=>{
 const checked=evaluateHardFilters(candidate({specializations:['Backend','Frontend']}),{spec:'Frontend',grade:'Middle'});
 assert.equal(checked.status,'fail');
 assert.equal(checked.failed.find(check=>check.id==='spec').actual,'Backend');
});

test('unverified grades and missing experience remain unknown',()=>{
 const unverified={...candidate(),verified:false};
 assert.equal(evaluateHardFilters(unverified,{grade:'Middle'}).status,'unknown');
 const missing={...candidate({experienceYears:null}),experience:undefined};
 assert.equal(evaluateHardFilters(missing,{minExperience:2}).status,'unknown');
});
