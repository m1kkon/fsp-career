import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateResumeSkills,resumeTaskFit} from '../lib/resume-fit.mjs';
import {matching,parseNeed,selectedNeed,rankCandidates} from '../lib/matching.mjs';

// Authored language regressions; not labelled hiring data or a quality estimate.
const claims=[
 ['Не имею опыта разработки API на Python.',[],false],
 ['У меня нет практического опыта разработки API на Python.',[],false],
 ["I haven't yet developed APIs in Python.",[],false],
 ['I have not previously worked on Python API integrations.',[],false],
 ['I have no professional experience building APIs in Python.',[],false],
 ['Пока учусь разрабатывать API на Python.',[],false],
 ['Сейчас изучаю разработку API на Python.',[],false],
 ['Learning to develop Python APIs.',[],false],
 ['I developed APIs in Python, but have not yet worked with Java.',['Python'],true],
 ['Не только разработал API на Python, но и внедрил Redis.',['Python','Redis'],true],
 ['I developed not only APIs in Python but also Redis caching.',['Python','Redis'],true],
 ['Я разработал учебный API на Python.',['Python'],true],
];
for(const [work,skills,api] of claims)test(`resume evidence: ${work}`,()=>{
 assert.deepEqual(candidateResumeSkills({work}),skills);
 assert.equal(resumeTaskFit({work},{text:'API'}).matched.some(row=>row.id==='api'),api);
});

for(const [text,years] of [
 ['Middle Backend; опыт от 3-х лет',3],
 ['Middle Backend; минимум 2,5 года опыта',2.5],
 ['Middle Backend; опыт работы 3–5 лет',3],
 ['Middle Backend; at least 3 years of experience',3],
 ['Middle Backend; 2+ years of experience',2],
 ['Middle Backend; minimum 2.5 years experience',2.5],
 ['Middle Backend; проект запущен в 2025 году',null],
 ['Middle Backend; команде 5 лет',null],
 ['Middle Backend; опыт работы 3–5 лет не обязателен',null],
 ['Middle Backend; желательно от 3 лет опыта',null],
 ['Middle Backend; minimum 3 years experience preferred',null],
 ['Middle Backend; minimum 2025 years experience',null],
])test(`minimum professional experience: ${text}`,()=>assert.equal(parseNeed(text).minExperience,years));

test('explicit employer choices override NLP; unknown location stays distinguishable from refusal',()=>{
 const need=selectedNeed('Middle Backend Python; английский B2; от 3 лет',{englishLevel:'',minExperience:'',locationRequired:true,city:'Москва'});
 assert.equal(need.englishLevel,null);assert.equal(need.minExperience,null);
 const base={spec:'Backend',grade:'Middle',verified:true,score:80,stack:['Python'],city:'Казань'};
 const rows=[
  {...base,id:'unknown',ats:{relocation:null}},
  {...base,id:'refused',ats:{relocation:'Не готов'}},
  {...base,id:'ready',ats:{relocation:'Готов к переезду'}},
 ].map(c=>({...c,match:matching(c,need)}));
 assert.deepEqual(rows.map(c=>c.match.eligibility.status),['unknown','fail','pass']);
 assert.deepEqual(rankCandidates(rows,need).map(c=>c.id),['ready','unknown','refused']);
 assert.ok(rows.every(c=>c.match.score===c.match.parts.reduce((sum,part)=>sum+part.points,0)));
});
