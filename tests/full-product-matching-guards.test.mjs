import test,{after} from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {matching,selectedNeed,rankCandidates,recommendCategories} from '../lib/matching.mjs';
import {candidateSemanticText} from '../lib/ats.mjs';
import {publicCandidate} from '../lib/domain.mjs';
import {mockFspProfile} from '../lib/fsp.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const outcomes=[];
function guard(name,fn){test(name,()=>{try{fn();outcomes.push({name,passed:true});}catch(error){outcomes.push({name,passed:false,error:error.message});throw error;}});}
const at=Date.parse('2026-10-11T12:00:00Z');
const person=(id,overrides={})=>({id,name:id,spec:'Backend',grade:'Middle',verified:true,score:80,stack:['Python'],experience:'3–5 лет',format:'Удалённо',city:'Москва',min:150000,max:200000,about:'',work:'Разрабатывал API на Python для обработки платежей.',fsp:null,ats:{languages:[{name:'Английский',level:'B2',source:'candidate'}],acceptedFormats:['Удалённо'],relocation:'Готов обсудить'},...overrides});
const need=(overrides={})=>selectedNeed('Middle backend Python API',{spec:'Backend',grade:'Middle',stack:['Python'],requiredStack:['Python'],confirmed:true,...overrides});
function ranked(people,request){const corpus=people.map(candidateSemanticText),rows=people.map(p=>({...p,match:matching(p,request,at,corpus)}));return rankCandidates(rows,request,recommendCategories(rows,request));}
const check=(row,id)=>row.match.eligibility.checks.find(c=>c.id===id);

guard('mandatory eligibility outranks an attractive but underqualified candidate',()=>{
 const rows=ranked([person('junior',{grade:'Junior',score:100}),person('middle',{score:50}),person('self-senior',{grade:'Senior',verified:false,score:100})],need());
 assert.deepEqual(rows.map(r=>r.id),['middle','self-senior','junior']);assert.equal(check(rows[0],'grade').status,'pass');assert.equal(check(rows[1],'grade').status,'unknown');assert.equal(check(rows[2],'grade').status,'fail');
});
guard('missing verification never awards a confirmed grade or confirmed-category points',()=>{
 for(const value of [undefined,null,false,'true',1]){
  const unverified=person('no-verification',{verified:value});if(value===undefined)delete unverified.verified;
  const row=ranked([unverified],need())[0];assert.equal(check(row,'grade').status,'unknown');
  for(const key of ['test','spec','grade'])assert.equal(row.match.parts.find(p=>p.key===key).points,0);
  assert.equal(publicCandidate({id:'account',profile:unverified,privacy:{}},false).verified,false);
 }
 const confirmed=ranked([person('confirmed',{verified:true})],need())[0];assert.equal(check(confirmed,'grade').status,'pass');assert.ok(confirmed.match.parts.find(p=>p.key==='test').points>0);assert.equal(publicCandidate({id:'account',profile:confirmed,privacy:{}},false).verified,true);
});
guard('required unreported technology needs clarification, optional missing technology remains eligible',()=>{
 const p=person('candidate',{stack:[],work:'Разрабатывал API на Java.'});
 assert.equal(ranked([p],need())[0].match.eligibility.status,'unknown');
 const optional=ranked([p],need({requiredStack:[],preferredStack:['Python']}))[0];assert.equal(optional.match.eligibility.status,'pass');assert.equal(optional.match.eligibility.checks.some(c=>c.id.startsWith('skill-')),false);
});
guard('employer clearing inferred language and tenure removes the hard conditions',()=>{
 const request=selectedNeed('Middle backend Python английский C1 опыт от 5 лет',{spec:'Backend',grade:'Middle',englishLevel:'',minExperience:'',requiredStack:[],confirmed:true});
 const row=ranked([person('junior-tenure',{experience:'До 1 года',ats:{languages:[]}})],request)[0];assert.equal(row.match.eligibility.status,'pass');assert.ok(!check(row,'english'));assert.ok(!check(row,'experience'));
});
guard('required tenure uses actual supplied years, language uses ordinal minimum, missing values stay unknown',()=>{
 const request=need({minExperience:3,englishLevel:'B2'}),rows=ranked([person('good',{ats:{experienceYears:4,languages:[{name:'Английский',level:'C1'}]}}),person('low',{ats:{experienceYears:1,languages:[{name:'Английский',level:'B1'}]}}),person('unknown',{experience:'',ats:{languages:[]}})],request);
 assert.deepEqual(rows.map(r=>r.id),['good','unknown','low']);assert.equal(check(rows[1],'experience').status,'unknown');assert.equal(check(rows[1],'english').status,'unknown');
});
guard('missing relocation is unknown, refusal is failure, consent is eligible',()=>{
 const request=need({city:'Москва',locationRequired:true}),rows=ranked(['Готов обсудить',null,'Не рассматриваю'].map((relocation,i)=>person(String(i),{city:'Казань',ats:{relocation}})),request);
 assert.deepEqual(rows.map(r=>check(r,'city').status),['pass','unknown','fail']);
});
guard('denial and learning do not become practical evidence or mandatory skills',()=>{
 const negative=['Не работал с Python и не разрабатывал API.','Учусь разрабатывать API на Python.','I have not yet worked on Python APIs.','I am learning to build Python APIs.','I plan to develop Python APIs.'];
 const rows=ranked([person('real',{work:'Разрабатывал API на Python и внедрил платежные интеграции.'}),...negative.map((work,i)=>person('negative-'+i,{stack:[],ats:{},work}))],need());
 const statuses=['fail','unknown','fail','unknown','unknown'];
 assert.equal(rows[0].id,'real');for(const r of rows.filter(r=>r.id!=='real')){assert.equal(r.match.eligibility.status,statuses[Number(r.id.split('-').at(-1))],r.id);assert.equal(r.match.resumeEvidence.share,0,r.id);}
});
guard('affirmative clause next to denial is kept without transferring denied skills',()=>{
 const rows=ranked([person('mixed',{stack:[],ats:{},work:'Не работал с Java, но разрабатывал API на Python.'})],need());
 assert.equal(rows[0].match.eligibility.status,'pass');assert.ok(rows[0].match.matched.includes('Python'));assert.ok(rows[0].match.resumeEvidence.skills.some(s=>s.skill==='Python'));
});
guard('repeating identical evidence does not increase relevance and irrelevant verbosity earns no extra points',()=>{
 const p=person('candidate'),one=ranked([p],need())[0],repeated=ranked([{...p,work:Array(20).fill(p.work).join('\n')}],need())[0];assert.equal(repeated.match.score,one.match.score);assert.equal(repeated.match.resumeEvidence.share,one.match.resumeEvidence.share);
 const irrelevant=ranked([{...p,work:p.work+'\n'+('Люблю прогулки и настольные игры. '.repeat(100))}],need())[0];assert.equal(irrelevant.match.score,one.match.score);
});
guard('score is explainable, finite, bounded, and uses provided evidence rather than external relevance labels',()=>{
 const p=person('candidate'),base=ranked([p],need())[0],labelled=ranked([{...p,label:1,relevance:1,confirmed_resume:true}],need())[0];assert.equal(labelled.match.score,base.match.score);
 assert.ok(Number.isFinite(base.match.score));assert.ok(base.match.score>=0&&base.match.score<=100);assert.equal(base.match.parts.reduce((sum,p)=>sum+p.points,0),base.match.score);
 for(const part of base.match.parts){assert.ok(Number.isFinite(part.points));assert.ok(part.points>=0&&part.points<=part.max);}
});
guard('input ordering never changes tied ranking; rename IDs exposes arbitrary tie resolution',()=>{
 const people=['a','b','c','d','e','f'].map(id=>person(id)),request=need(),base=ranked(people,request),shuffled=ranked([people[5],people[2],people[0],people[4],people[1],people[3]],request);
 assert.deepEqual(base.map(r=>r.id),shuffled.map(r=>r.id));assert.equal(new Set(base.map(r=>r.match.score)).size,1);
 const renamed=ranked(people.map((p,i)=>({...p,id:String(6-i)})),request);assert.equal(new Set(renamed.map(r=>r.match.score)).size,1);
});
guard('public projection and ranking explanations never reveal contact fields before consent',()=>{
 const a={id:'private',email:'private@example.test',roles:['candidate'],profile:{...person('private'),phone:'+7 999 123 45 67',work:'Разрабатывал API на Python. Контакт private@example.test +7 999 123 45 67.'},privacy:{fspVisible:false}},projection=publicCandidate(a,false),row=ranked([projection],need())[0];
 assert.equal(projection.email,undefined);assert.equal(projection.phone,undefined);assert.ok(!JSON.stringify(row.match).includes('private@example.test'));assert.ok(!JSON.stringify(row.match).includes('+7 999 123 45 67'));
});
guard('hidden FSP achievements and undisclosed contact identities cannot affect score or ranking',()=>{
 const base=person('a'),withContacts={...base,email:'a@example.test',phone:'+7 999 123 45 67'},request=need();assert.equal(ranked([base],request)[0].match.score,ranked([withContacts],request)[0].match.score);
 const account={id:'a',email:'a@example.test',profile:base,privacy:{fspVisible:false}};const projected=publicCandidate(account,false);assert.equal(projected.fsp,null);assert.equal(ranked([projected],request)[0].match.score,ranked([base],request)[0].match.score);
});

guard('confirmed test result contributes monotonically without replacing minimum grade eligibility',()=>{
 const rows=ranked([person('qualified-low',{score:50}),person('qualified-high',{score:95}),person('underqualified-perfect',{grade:'Junior',score:100})],need());assert.deepEqual(rows.map(r=>r.id),['qualified-high','qualified-low','underqualified-perfect']);
 assert.ok(rows[0].match.parts.find(p=>p.key==='test').points>rows[1].match.parts.find(p=>p.key==='test').points);
});
guard('self-declared specialization and high text fit never become a confirmed category',()=>{
 const p=person('self-declared',{verified:false,grade:'Senior',score:100,work:'Разрабатывал API на Python и PostgreSQL, оптимизировал платежные интеграции.'}),row=ranked([p],need())[0];assert.equal(row.match.eligibility.status,'unknown');
 assert.equal(row.match.parts.find(p=>p.key==='spec').points,0);assert.equal(row.match.parts.find(p=>p.key==='grade').points,0);assert.equal(row.match.parts.find(p=>p.key==='test').points,0);
});
guard('no FSP history leaves all other score components unchanged and does not exclude candidate',()=>{
 const base=person('candidate'),empty={...base,fsp:mockFspProfile('DEMO-FSP-004')},a=ranked([base],need())[0],b=ranked([empty],need())[0];assert.equal(a.match.eligibility.status,'pass');assert.equal(b.match.eligibility.status,'pass');assert.equal(a.match.score,b.match.score);
 const withoutFsp=row=>row.match.parts.filter(p=>p.key!=='fsp').map(({key,points,max})=>({key,points,max}));assert.deepEqual(withoutFsp(a),withoutFsp(b));
});
guard('relevant FSP bonus cannot compensate an unmet mandatory grade',()=>{
 const rows=ranked([person('junior-fsp',{grade:'Junior',score:100,fsp:mockFspProfile('DEMO-FSP-012')}),person('middle-no-fsp',{score:50})],need());assert.equal(rows[0].id,'middle-no-fsp');const fsp=rows[1].match.parts.find(p=>p.key==='fsp');assert.ok(fsp.points>0&&fsp.points<=fsp.max);assert.equal(check(rows[1],'grade').status,'fail');
});
guard('hidden real-looking FSP data is removed before ranking and cannot confer an achievement bonus',()=>{
 const profile=person('candidate',{fsp:mockFspProfile('DEMO-FSP-012')}),account={id:'candidate',email:'candidate@example.test',profile,privacy:{fspVisible:false}},projection=publicCandidate(account,false),row=ranked([projection],need())[0];assert.equal(projection.fsp,null);assert.equal(row.match.parts.find(p=>p.key==='fsp').points,0);
});

guard('equal profiles rank a relevant FSP achievement above a less relevant discipline within the same category',()=>{
 const request=need({spec:'Frontend'}),rows=ranked([person('ai-achievement',{spec:'Frontend',fsp:mockFspProfile('DEMO-FSP-006')}),person('product-achievement',{spec:'Frontend',fsp:mockFspProfile('DEMO-FSP-012')})],request);
 assert.equal(rows[0].id,'product-achievement');const bonus=r=>r.match.parts.find(p=>p.key==='fsp').points;assert.ok(bonus(rows[0])>bonus(rows[1]));assert.equal(rows[0].match.eligibility.status,'pass');assert.equal(rows[1].match.eligibility.status,'pass');
 const withoutBonus=r=>r.match.parts.filter(p=>p.key!=='fsp').map(p=>[p.key,p.points]);assert.deepEqual(withoutBonus(rows[0]),withoutBonus(rows[1]));
});
guard('category recommendations retain the exact requested category and count equal-profile variants',()=>{
 const request=need(),rows=ranked([person('middle-a'),person('middle-b'),person('senior',{grade:'Senior'}),person('junior',{grade:'Junior'})],request),categories=recommendCategories(rows,request);
 assert.equal(categories[0].spec,'Backend');assert.equal(categories[0].grade,'Middle');assert.equal(categories[0].count,2);assert.equal(categories[0].relation,'exact');assert.ok(categories[0].reason);
 for(const r of rows){assert.ok(r.match.reasons.length>0);assert.equal(r.match.parts.reduce((sum,p)=>sum+p.points,0),r.match.score);}
});
after(async()=>{
 const reportPath=process.env.MATCHING_GUARD_REPORT_PATH;if(!reportPath)return;
 const files=['lib/matching.mjs','lib/resume-fit.mjs','lib/ats.mjs','lib/domain.mjs','lib/fsp.mjs'],implementation={};
 for(const file of files)implementation[file]=createHash('sha256').update(await readFile(root+'/'+file)).digest('hex');
 const report={type:'author-controlled-full-product-semantic-guards',version:1,referenceTime:new Date(at).toISOString(),cases:outcomes.length,passed:outcomes.filter(o=>o.passed).length,failed:outcomes.filter(o=>!o.passed).length,outcomes,implementation,guardHash:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),limitations:['These controlled cases are authored by us, not independent recruiter labels or real hires.','No external dataset informs FSP/test/confirmed-grade expectations.','Counts measure functional invariants, not a numerical estimate of full-product matching accuracy.','Before strict verification, 19/20 cases passed: missing verified was incorrectly treated as confirmation. The explicit true contract closes that gap.']};
 report.baseline={revision:'8b87bfba1f0aae9c26d6d61df9571d5140775a10',cases:20,passed:19,failed:1,failingCase:'missing verification never awards a confirmed grade or confirmed-category points',diagnosis:'Raw missing verified was treated as confirmed; ordinary registration initializes false and catalogue visibility excludes missing verification.'};
 report.contract={verifiedOnlyWhen:'verified === true',unknownInputs:[null,false,'true',1,'missing'],publicProjection:'Always boolean',externalDatasetEffect:'TalentMatch adapter supplies verified:false, so strict verification does not change its ranking inputs or frozen result.'};
 report.reproduction='MATCHING_GUARD_REPORT_PATH=docs/full-product-matching-guards.json node --test tests/full-product-matching-guards.test.mjs';
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
});
