import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matching,parseNeed,selectedNeed,rankCandidates,WEIGHTS} from '../lib/matching.mjs';
import {publicCandidate} from '../lib/domain.mjs';
import {candidateResumeSkills,resumeEvidenceFit} from '../lib/resume-fit.mjs';

const candidate=overrides=>({id:'candidate',name:'Candidate',spec:'Backend',grade:'Middle',verified:true,score:90,stack:['Python'],about:'',work:'',...overrides});
const need=parseNeed('Middle Backend Python');
const points=fit=>fit.parts.find(part=>part.key==='resume').points;

test('actual project work distinguishes otherwise identical candidates and drives their displayed ranking',()=>{
 const rows=[candidate({id:'tags',work:'Python, API, payments'}),candidate({id:'project',resume:{projects:[{name:'Payments',description:'Разработал платёжный REST API на Python.'}]}})].map(c=>({...c,match:matching(c,need)}));
 assert.equal(points(rows[0].match),0);assert.equal(points(rows[1].match),WEIGHTS.resume);
 assert.ok(rows[1].match.score>rows[0].match.score);
 assert.equal(rankCandidates(rows,need,[])[0].id,'project');
 assert.equal(rows[1].match.score,rows[1].match.parts.reduce((sum,part)=>sum+part.points,0));
});

test('task concepts match work and projects across synonyms and include source evidence',()=>{
 const request=parseNeed('Middle Backend Python',{team:'API, платежи и очереди'});
 const fit=resumeEvidenceFit(candidate({resume:{projects:[{name:'Billing',description:'Built payment integrations on Python. Implemented message queues.'}]}}),request);
 assert.deepEqual(fit.tasks.map(task=>task.id),['api','messaging','payments']);
 assert.equal(fit.share,1);assert.ok(fit.tasks.every(task=>task.source==='Billing'&&task.quote));
 const irrelevant=resumeEvidenceFit(candidate({work:'Разработал интерфейс на React.'}),request);
 assert.equal(irrelevant.share,0);
});

test('positive resume evidence can satisfy canonical required skills; denied experience cannot',()=>{
 const request=selectedNeed('Middle Backend',{spec:'Backend',grade:'Middle',requiredStack:['PostgreSQL','RabbitMQ'],preferredStack:[],confirmed:true});
 const positive=candidate({stack:[],resume:{projects:[{name:'Service',description:'Разработал сервис на Postgres с RabbitMQ.'}]}});
 assert.deepEqual(candidateResumeSkills(positive),['PostgreSQL','RabbitMQ']);
 assert.equal(matching(positive,request).eligibility.status,'pass');
 const denied=candidate({stack:[],work:'С Postgres и RabbitMQ не работал. Docker, Kubernetes пока не использовал.'});
 assert.deepEqual(candidateResumeSkills(denied),[]);
 assert.equal(matching(denied,request).eligibility.status,'fail');
 const sql=candidate({stack:['SQL'],work:'Разработал SQL-запросы.'});
 assert.equal(matching(sql,request).eligibility.status,'unknown');
});

test('about text alone gets partial skill credit, repeated words and longer unrelated prose add none',()=>{
 const about=candidate({about:'Разрабатываю сервисы на Python.'});
 const work=candidate({work:'Разрабатываю сервисы на Python.'});
 assert.equal(points(matching(about,need)),10);assert.equal(points(matching(work,need)),20);
 assert.equal(points(matching(candidate({work:(work.work+' ').repeat(100)}),need)),20);
 assert.equal(points(matching(candidate({work:'Python '.repeat(100)}),need)),0);
 assert.equal(points(matching(candidate({work:'Разрабатываю интерфейсы на React. '.repeat(100)}),need)),0);
});

test('hard requirements remain above resume fit and test strength in ranking',()=>{
 const request=selectedNeed('Middle Backend Python',{spec:'Backend',grade:'Middle',requiredStack:['Python'],preferredStack:[],confirmed:true});
 const rows=[candidate({id:'eligible',score:60}),candidate({id:'wrong-grade',grade:'Junior',score:100,work:'Разрабатываю сервисы на Python.'})].map(c=>({...c,match:matching(c,request)}));
 assert.equal(rankCandidates(rows,request,[])[0].id,'eligible');
 const unknown=matching(candidate({verified:false,work:'Senior Backend. Разрабатываю сервисы на Python.'}),request);
 assert.equal(unknown.eligibility.status,'unknown');
 assert.equal(unknown.parts.find(part=>part.key==='test').points,0);
 assert.equal(unknown.parts.find(part=>part.key==='grade').points,0);
});

test('professional resume projection includes projects but excludes arbitrary contact and personal fields',()=>{
 const resume={headline:'Backend',birthDate:'1990-01-01',email:'private@example.test',links:[{url:'private'}],projects:[null,{name:'API',description:'Разработал API на Python.',url:'private',email:'private'}],workEntries:[{company:'Product',position:'Developer',description:'Built services.',secret:'private'}]};
 const row=publicCandidate({id:'candidate',email:'private@example.test',profile:{...candidate(),resume}});
 assert.equal(row.resume.projects[0].name,'API');
 assert.equal(matching(row,need).resumeEvidence.skills[0].skill,'Python');
 const projected=JSON.stringify(row.resume);
 assert.doesNotMatch(projected,/private|birthDate|secret/);
 assert.equal(row.email,undefined);
});

test('evidence quotes hide direct contact details and personal names do not affect fit',()=>{
 const first=candidate({work:'Разрабатываю на Python. Built API; write to me@example.test or +7 (999) 123-45-67. Built Python API, contact me@example.test.'});
 const fit=matching(first,parseNeed('Middle Backend Python API'));
 assert.ok(fit.resumeEvidence.skills.every(item=>item.quote.length<=220));
 assert.doesNotMatch(JSON.stringify(fit.resumeEvidence),/me@example.test|999/);
 assert.equal(fit.score,matching({...first,name:'Other Person',birthDate:'2000-01-01'},parseNeed('Middle Backend Python API')).score);
 assert.equal(matching(first,null).score,null);assert.equal(matching(first,null).parts.reduce((sum,part)=>sum+part.max,0),18);
});

test('explicit required, preferred and excluded technologies retain their priorities',()=>{
 const request=parseNeed('Middle Backend; обязательно Python, SQL; желательно Redis; Java не нужен');
 assert.deepEqual(request.requiredStack,['Python','SQL']);assert.deepEqual(request.preferredStack,['Redis']);
 assert.ok(!request.stack.includes('Java'));
});
