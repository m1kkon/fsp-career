import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankingMetrics,meanMetrics,tiedPrecisionAtK} from '../scripts/benchmarks/ranking-metrics.mjs';
import {adaptResume,adaptVacancy,normalizeDataset,splitDataset,evaluateDataset,markdownReport,experienceYears,supportedRole,plainText} from '../scripts/benchmarks/talentmatch.mjs';

const resume=(uuid,skills='Python, PostgreSQL')=>({uuid,first_name:'PrivateFirstName',last_name:'PrivateLastName',birth_date:'1991-04-25',city:'PrivateCity',key_skills:skills,about:'Разработка API',experienceItem:[]});
const vacancy=(id,positive=`positive-${id}`,negative=`negative-${id}`)=>({vacancy:{uuid:id,name:'Python Developer',description:'Python PostgreSQL API',comment:null},confirmed_resumes:[resume(positive)],failed_resumes:[resume(negative,'Java')]});

test('ranking metrics reward earlier relevant candidates and use exact random expectations',()=>{
 const perfect=rankingMetrics([1,1,1,0,0],3), late=rankingMetrics([0,0,1,1,1],3);
 assert.equal(perfect.precisionAtK,1);assert.equal(perfect.ndcgAtK,1);assert.equal(perfect.recallAtK,1);
 assert.equal(late.precisionAtK,1/3);assert.equal(late.reciprocalRank,1/3);
 assert.ok(late.ndcgAtK<perfect.ndcgAtK);assert.equal(perfect.randomPrecisionAtK,3/5);
 assert.equal(rankingMetrics([1,0],5).precisionAtK,0.5);
 assert.equal(rankingMetrics([0,0]).ndcgAtK,null);
 assert.throws(()=>rankingMetrics([],5));assert.throws(()=>rankingMetrics([2]));assert.throws(()=>rankingMetrics([1],0));
 assert.equal(meanMetrics([perfect,late]).precisionAtK,2/3);
});

test('ties at the cutoff use the whole tied group rather than fortunate candidate IDs',()=>{
 const rows=[{tieKey:'best',label:1},...Array.from({length:4},(_,i)=>({tieKey:'tied',label:i<2?1:0}))];
 assert.equal(tiedPrecisionAtK(rows,3),2/3);
 assert.equal(tiedPrecisionAtK(rows,5),3/5);
});

test('dataset adapter does not fabricate assessment/FSP evidence or copy identifying fields',()=>{
 const candidate=adaptResume(resume('person'));
 assert.equal(candidate.verified,false);assert.equal(candidate.score,null);assert.equal(candidate.fsp,null);
 assert.equal(candidate.name,'Анонимный кандидат');assert.equal(candidate.city,'');
 assert.ok(!JSON.stringify(candidate).includes('Private'));assert.ok(!JSON.stringify(candidate).includes('1991-04-25'));
 assert.deepEqual(candidate.stack,['Python','PostgreSQL']);assert.equal(candidate.ats.experienceYears,null);
 const need=adaptVacancy(vacancy('job').vacancy);
 assert.equal(need.grade,null);assert.equal(need.confirmed,false);assert.equal(need.spec,'Backend');
 assert.deepEqual(need.requiredStack,[]);
 assert.equal(supportedRole('Android разработчик'),null);assert.equal(supportedRole('Product manager'),null);
 assert.equal(supportedRole('Системный аналитик Python'),null);assert.equal(supportedRole('JavaScript developer'),null);
 assert.equal(plainText('<p>Python &amp; SQL</p><script>bad()</script>'),'Python & SQL');
});

test('experience uses a frozen reference date, merges overlapping jobs and preserves missing values',()=>{
 assert.equal(experienceYears([{starts:'2022-03-01',ends:null},{starts:'2023-03-01',ends:null}]),2);
 assert.equal(experienceYears([{starts:'2025-01-01',ends:null}]),null);
 assert.equal(experienceYears([{starts:'bad',ends:null}]),null);
 assert.equal(experienceYears([{starts:'2024-03-01',ends:null}]),0);
 assert.equal(experienceYears([{starts:'2022-03-01',ends:'2023-03-01'}]),1);
});

test('development/holdout splits keep shared candidates together and are independent of source order and labels',()=>{
 const raw=[vacancy('a','shared'),vacancy('b','shared'),vacancy('c'),vacancy('d'),vacancy('e'),vacancy('f')];
 const split=splitDataset(normalizeDataset(raw)), reversed=splitDataset(normalizeDataset([...raw].reverse()));
 const assignments=rows=>Object.fromEntries([...rows].sort((a,b)=>a.id.localeCompare(b.id)).map(v=>[v.id,v.split]));
 assert.deepEqual(assignments(split),assignments(reversed));
 assert.equal(split[0].split,split[1].split);
 assert.ok(split.some(v=>v.split==='development'));assert.ok(split.some(v=>v.split==='holdout'));
 const developmentIds=new Set(split.filter(v=>v.split==='development').flatMap(v=>v.candidates.map(r=>r.candidate.id)));
 assert.ok(split.filter(v=>v.split==='holdout').every(v=>v.candidates.every(r=>!developmentIds.has(r.candidate.id))));
 const changed=raw.map(v=>({...v,confirmed_resumes:v.failed_resumes,failed_resumes:v.confirmed_resumes}));
 assert.deepEqual(assignments(split),assignments(splitDataset(normalizeDataset(changed))));
});

test('changing relevance labels cannot change candidate scores or ranking; reports omit personal identifiers',()=>{
 const raw=Array.from({length:6},(_,i)=>vacancy(`job-${i}`));
 const first=evaluateDataset(raw), flipped=evaluateDataset(raw.map(v=>({...v,confirmed_resumes:v.failed_resumes,failed_resumes:v.confirmed_resumes})));
 const rankings=report=>report.development.map(v=>({id:v.id,methods:Object.fromEntries(Object.entries(v.methods).map(([key,value])=>[key,value.topFive.map(({id,score})=>({id,score}))]))}));
 assert.deepEqual(rankings(first),rankings(flipped));
 assert.equal(first.dataset.pairs,12);assert.equal(first.dataset.confirmed,6);
 const report=markdownReport(first);
 assert.ok(!report.includes('PrivateFirstName'));assert.ok(!report.includes('PrivateLastName'));assert.ok(!report.includes('1991-04-25'));
 assert.ok(first.holdoutManifest.every(v=>!('title' in v)&&!('methods' in v)));
 for(const v of first.development)for(const row of v.methods.product.topFive)assert.ok(row.score<=30,'unverified category, test and FSP points must remain zero');
});

test('duplicate or conflicting source labels fail rather than silently improving the benchmark',()=>{
 assert.throws(()=>normalizeDataset([vacancy('same','same-person','same-person')]),/conflicting/);
 assert.throws(()=>normalizeDataset([vacancy('same'),vacancy('same')]),/Duplicate vacancy/);
 assert.throws(()=>normalizeDataset([{...vacancy('none'),confirmed_resumes:[]}]),/both label classes/);
});

test('development-only experiments preserve the holdout manifest but do not score its vacancies',()=>{
 const raw=Array.from({length:6},(_,i)=>vacancy(`job-${i}`));
 const full=evaluateDataset(raw), development=evaluateDataset(raw,{developmentOnly:true});
 assert.equal(development.mode,'development-only');assert.deepEqual(development.dataset,full.dataset);
 assert.deepEqual(development.development,full.development);assert.deepEqual(development.holdoutManifest,full.holdoutManifest);
 assert.equal(development.summaries['supported/holdout'].product,null);
 assert.equal(development.summaries['all/holdout'].lexical,null);
});
