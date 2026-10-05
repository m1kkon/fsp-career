import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountFor,action,getState,publicJobs} from '../lib/service.mjs';
import {makeTest,testView,gradeTest,COOLDOWN,SPECS,GRADES,matching,parseNeed} from '../lib/domain.mjs';
import {seed} from '../lib/seed.mjs';
import {mockFspProfile} from '../lib/fsp.mjs';
import {publicCandidate} from '../lib/domain.mjs';
import {actionResponse} from '../lib/action-response.mjs';
function memory(){const accounts=new Map(),records=new Map();const clone=x=>x?structuredClone(x):null;return {account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),record:async id=>clone(records.get(id)),put:async(kind,r)=>records.set(r.id,{...clone(r),kind}),remove:async(id,owner)=>{if(records.get(id)?.owner===owner)records.delete(id);}};}
async function fixture(){const repo=memory();const candidate=await accountFor(repo,{id:'candidate-a',email:'a@example.test',name:'Candidate'});await action(repo,candidate,{action:'onboard',role:'candidate',name:'Candidate',city:'Москва',spec:'Backend',grade:'Middle',consent:true});candidate.profile={...candidate.profile,verified:true,score:90,stack:['Python','PostgreSQL'],verifiedAt:Date.now(),about:'Backend engineer',gradeChangedAt:Date.now()};await repo.saveAccount(candidate);const employer=await accountFor(repo,{id:'employer-a',email:'hr@example.test',name:'HR'});await action(repo,employer,{action:'onboard',role:'employer',name:'Company',description:'Product engineering team',contact:'hr@example.test',consent:true});const other=await accountFor(repo,{id:'employer-b',email:'b@example.test'});await action(repo,other,{action:'onboard',role:'employer',name:'Other',description:'Other engineering team',contact:'b@example.test',consent:true});return {repo,candidate,employer,other};}
const invitation=(candidateId)=>({action:'invite',candidateId,title:'Backend role',description:'API development in product team',min:180000,max:240000,contact:'hr@example.test'});
test('contacts stay absent in API before consent and are granted only to inviting company',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));let view=await getState(repo,employer,'employer');assert.equal(view.candidates.find(c=>c.id===candidate.id).email,undefined);assert.equal(view.invites[0].email,undefined);assert.ok(!JSON.stringify(view.candidates).includes(candidate.email));const incoming=await getState(repo,candidate,'candidate');assert.equal(incoming.candidates.length,0);await action(repo,candidate,{action:'invite-status',id:incoming.invites[0].id,status:'accepted'});view=await getState(repo,employer,'employer');assert.equal(view.candidates.find(c=>c.id===candidate.id).email,candidate.email);assert.equal((await getState(repo,other,'employer')).candidates.find(c=>c.id===candidate.id).email,undefined);assert.equal((await getState(repo,other,'employer')).invites.length,0);});
test('invitation ownership and terminal statuses are enforced',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));const id=(await repo.scoped('invite',employer.id))[0].id;await assert.rejects(action(repo,other,{action:'invite-status',id,status:'accepted'}));await action(repo,candidate,{action:'invite-status',id,status:'declined'});await assert.rejects(action(repo,candidate,{action:'invite-status',id,status:'accepted'}));assert.equal((await getState(repo,employer,'employer')).candidates.find(c=>c.id===candidate.id).email,undefined);});
test('salary is mandatory and descending/negative ranges fail on server',async()=>{const {repo,candidate,employer}=await fixture();for(const range of [{min:240000,max:180000},{min:0,max:100},{min:1.5,max:100},{min:NaN,max:100}])await assert.rejects(action(repo,employer,{...invitation(candidate.id),...range}));assert.equal((await repo.records('invite')).length,0);});
test('candidate cannot impersonate employer and edit cannot forge verification',async()=>{const {repo,candidate}=await fixture();await assert.rejects(action(repo,candidate,invitation(candidate.id)));await action(repo,candidate,{action:'profile',name:'Updated',min:100,max:200,stack:'Python',verified:false,score:1,grade:'Senior'});assert.equal(candidate.profile.verified,true);assert.equal(candidate.profile.grade,'Middle');assert.equal(candidate.profile.score,90);});
test('withdrawn consent removes profile and blocks new invitations',async()=>{const {repo,candidate,employer}=await fixture();await action(repo,candidate,{action:'settings',visible:true,consent:false,notifications:true});assert.ok(!(await getState(repo,employer,'employer')).candidates.some(c=>c.id===candidate.id));await assert.rejects(action(repo,employer,invitation(candidate.id)));});
test('application grants contact only to job owner and duplicate is rejected',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,{action:'job',title:'Backend',description:'Develop APIs',spec:'Backend',grade:'Middle',min:100,max:200,stack:'Python',format:'Удалённо'});const job=(await repo.records('job'))[0];await action(repo,candidate,{action:'apply',jobId:job.id,letter:'Hello'});await assert.rejects(action(repo,candidate,{action:'apply',jobId:job.id}));const view=await getState(repo,employer,'employer');assert.equal(view.applications[0].email,candidate.email);assert.equal(view.candidates.find(c=>c.id===candidate.id).email,candidate.email);assert.equal((await getState(repo,other,'employer')).applications.length,0);await assert.rejects(action(repo,other,{action:'job-status',id:job.id,status:'archived'}));});
test('a guessed record id cannot convert a job into an invitation or accept a task',async()=>{const {repo,candidate,employer}=await fixture();await action(repo,employer,{action:'task',title:'API',description:'Describe API approach',spec:'Backend'});const task=(await repo.records('task'))[0];await assert.rejects(action(repo,candidate,{action:'invite-status',id:task.id,status:'accepted'}));await assert.rejects(action(repo,employer,{action:'job-status',id:task.id,status:'archived'}));});
test('all specialization/grade blueprints have six valid questions and no answer keys in client view',()=>{for(const spec of SPECS)for(const grade of GRADES){const attempt=makeTest(spec,grade),view=testView(attempt);assert.equal(attempt.questions.length,6);assert.equal(new Set(attempt.questions.map(q=>q.prompt)).size,6);assert.ok(view.questions.every(q=>!('correct'in q)&&!('explanation'in q)&&!('expected'in q)));assert.ok(attempt.questions.every(q=>q.correct>=0&&q.correct<q.options.length));assert.equal(gradeTest(attempt,attempt.questions.map(q=>q.correct)).score,100);assert.equal(gradeTest(attempt,attempt.questions.map(q=>(q.correct+1)%q.options.length)).score,0);}});
test('parameterized variants differ and grades use different conceptual sets',()=>{const variants=Array.from({length:50},()=>makeTest('Backend','Middle'));assert.ok(new Set(variants.map(v=>JSON.stringify(v.questions.map(q=>({prompt:q.prompt,options:q.options}))))).size>45);const junior=makeTest('Backend','Junior'),senior=makeTest('Backend','Senior');assert.notDeepEqual(junior.questions.slice(0,4).map(q=>q.topic),senior.questions.slice(0,4).map(q=>q.topic));});
test('failed test preserves category; successful change obeys server cooldown',async()=>{const {repo,candidate}=await fixture();let start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});let stored=await repo.record(start.test.id);let r=await action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>(q.correct+1)%q.options.length)});assert.equal(r.result.passed,false);assert.equal(candidate.profile.grade,'Middle');start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});stored=await repo.record(start.test.id);r=await action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>q.correct)});assert.equal(r.result.locked,true);assert.equal(candidate.profile.grade,'Middle');candidate.profile.gradeChangedAt=Date.now()-COOLDOWN-100;await repo.saveAccount(candidate);start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});stored=await repo.record(start.test.id);r=await action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>q.correct)});assert.equal(r.result.applied,true);assert.equal(candidate.profile.grade,'Senior');await assert.rejects(action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>q.correct)}));});
test('messages require accepted invitation and remain scoped to parties',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));const id=(await repo.scoped('invite',employer.id))[0].id;await assert.rejects(action(repo,employer,{action:'message',contextId:id,text:'Hello'}));await action(repo,candidate,{action:'invite-status',id,status:'accepted'});await action(repo,employer,{action:'message',contextId:id,text:'Hello'});assert.equal((await getState(repo,candidate,'candidate')).messages.length,1);assert.equal((await getState(repo,other,'employer')).messages.length,0);await assert.rejects(action(repo,other,{action:'message',contextId:id,text:'No access'}));});
test('need query strictly scopes confirmed specialization and grade',async()=>{const {repo,employer}=await fixture();const v=await getState(repo,employer,'employer','Middle backend Python PostgreSQL');assert.ok(v.candidates.length>=2);assert.ok(v.candidates.every(c=>c.spec==='Backend'&&c.grade==='Middle'));const ranked=seed.candidates.map(c=>({id:c.id,score:matching(c.profile,parseNeed('Middle backend Python PostgreSQL')).score})).sort((a,b)=>b.score-a.score);assert.equal(ranked[0].id,'demo-1');});

test('anonymous job listing includes published vacancies but excludes archived and ownership fields',async()=>{const {repo,employer}=await fixture();await action(repo,employer,{action:'job',title:'Public API engineer',description:'Work on product API',spec:'Backend',grade:'Middle',stack:'Python',min:150000,max:220000});const job=(await repo.records('job'))[0];let rows=await publicJobs(repo);assert.ok(rows.some(j=>j.id===job.id));assert.ok(rows.every(j=>!('owner'in j)&&!('recipient'in j)));await action(repo,employer,{action:'job-status',id:job.id,status:'archived'});rows=await publicJobs(repo);assert.ok(!rows.some(j=>j.id===job.id));});
test('task solution is reviewed only by its company without changing confirmed grade',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,{action:'task',title:'Query diagnosis',description:'Explain diagnosis and verification',spec:'Backend'});const task=(await repo.records('task'))[0];await action(repo,candidate,{action:'task-answer',id:task.id,answer:'Measure slow queries using EXPLAIN ANALYZE and compare p95 under equivalent load.'});const submission=(await repo.records('submission'))[0];await assert.rejects(action(repo,other,{action:'task-review',id:submission.id,feedback:'Unauthorized review'}));await action(repo,employer,{action:'task-review',id:submission.id,feedback:'Good diagnosis; consider index write cost.'});const view=await getState(repo,candidate);assert.equal(view.submissions[0].status,'reviewed');assert.equal(view.profile.grade,'Middle');assert.equal((await getState(repo,other,'employer')).submissions.length,0);});
test('expired attempt cannot submit answers or alter category',async()=>{const {repo,candidate}=await fixture();const start=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});const attempt=await repo.record(start.test.id);attempt.expires=Date.now()-1;await repo.put('test',attempt);await assert.rejects(action(repo,candidate,{action:'test-submit',id:attempt.id,answers:attempt.questions.map(q=>q.correct)}));assert.equal(candidate.profile.score,90);});

test('FSP mock link accepts only fixture IDs and cannot forge registry verification',async()=>{
 const {repo,candidate,employer}=await fixture();
 await assert.rejects(action(repo,employer,{action:'fsp-link',fspId:'DEMO-FSP-001'}));
 for(const fspId of ['FSP-12345','DEMO-FSP-999',''])await assert.rejects(action(repo,candidate,{action:'fsp-link',fspId}));
 await action(repo,candidate,{action:'fsp-link',fspId:'demo-fsp-001',id:employer.id,source:'registry',status:'verified',achievements:[{result:'Winner'}]});
 const saved=await repo.account(candidate.id);
 assert.equal(saved.profile.fsp.source,'demo');assert.equal(saved.profile.fsp.status,'demo');
 assert.equal(saved.profile.fsp.achievements[0].result,'Финалист');
 assert.equal((await repo.account(employer.id)).profile.fsp,undefined);
 await action(repo,candidate,{action:'profile',name:'Candidate',min:100,max:200,stack:'Python',fsp:{source:'registry',status:'verified'}});
 assert.equal(candidate.profile.fsp.source,'demo');assert.equal(candidate.profile.score,90);
});
test('FSP visibility is independent of resume visibility and never grants contacts',async()=>{
 const {repo,candidate,employer}=await fixture();
 await action(repo,candidate,{action:'fsp-link',fspId:'DEMO-FSP-003'});
 let c=(await getState(repo,employer,'employer')).candidates.find(x=>x.id===candidate.id);
 assert.equal(c.fsp.achievements.length,1);assert.equal(c.email,undefined);
 await action(repo,candidate,{action:'settings',visible:true,consent:true,notifications:true,fspVisible:false});
 c=(await getState(repo,employer,'employer')).candidates.find(x=>x.id===candidate.id);
 assert.ok(c);assert.equal(c.fsp,null);assert.equal(c.email,undefined);
 assert.equal((await getState(repo,candidate)).profile.fsp.id,'DEMO-FSP-003');
 assert.ok(publicCandidate({...candidate,privacy:{fspVisible:true}},true).fsp);
 assert.equal(publicCandidate(candidate,true).fsp,null);
});
test('missing or empty FSP history does not block tests, matching, invitation or unlink',async()=>{
 const {repo,candidate,employer}=await fixture();
 const need=parseNeed('Middle backend Python');const score=matching(candidate.profile,need).score;
 await action(repo,candidate,{action:'fsp-link',fspId:'DEMO-FSP-004'});
 assert.equal(candidate.profile.fsp.achievements.length,0);
 assert.equal(matching(candidate.profile,need).score,score);
 await action(repo,employer,invitation(candidate.id));
 const attempt=await action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});assert.equal(attempt.test.questions.length,6);
 await action(repo,candidate,{action:'fsp-unlink'});
 assert.equal((await repo.account(candidate.id)).profile.fsp,null);assert.equal(candidate.profile.verified,true);
 assert.ok((await getState(repo,employer,'employer')).candidates.some(x=>x.id===candidate.id));
});
test('public FSP projection excludes adapter secrets and uses canonical synthetic achievements',()=>{
 const fsp=mockFspProfile('DEMO-FSP-001');fsp.token='secret';fsp.achievements[0].result='Forged winner';
 const c=publicCandidate({id:'candidate',profile:{fsp},privacy:{}});
 assert.equal(c.fsp.token,undefined);assert.equal(c.fsp.achievements[0].result,'Финалист');
 assert.equal(publicCandidate({profile:{fsp:{id:'FSP-123',source:'registry',status:'verified'}}}).fsp,null);
 assert.ok(seed.candidates.some(c=>c.profile.fsp.achievements.length===0));
});
test('resume blocks persist independently from the questionnaire and cannot forge category',async()=>{
 const {repo,candidate,employer}=await fixture();
 await assert.rejects(action(repo,employer,{action:'resume-details'}));
 await action(repo,candidate,{action:'resume-details',headline:'ML Researcher',skillGroups:[{label:'ML & AI',text:'Python, PyTorch'},{label:'NLP',text:'RAG'}],projects:[{name:'Search',description:'Semantic search',url:'https://example.test/project'}],links:[{label:'GitHub',url:'https://github.com/example'}],achievements:'Own achievement',grade:'Senior',verified:false});
 assert.equal(candidate.profile.grade,'Middle');assert.equal(candidate.profile.verified,true);assert.equal((await repo.account(candidate.id)).profile.resume.skillGroups.length,2);
 await action(repo,candidate,{action:'profile',name:'Updated',min:100,max:200,stack:'Python'});
 assert.equal(candidate.profile.resume.projects[0].name,'Search');
 assert.equal(publicCandidate(candidate,false).resume,undefined);
});
test('resume blocks reject unsafe links and allow deleting all optional groups',async()=>{
 const {repo,candidate}=await fixture();
 for(const url of ['javascript:alert(1)','data:text/html,hello','file:///tmp/secret','not a URL'])await assert.rejects(action(repo,candidate,{action:'resume-details',links:[{label:'Link',url}]}));
 for(const details of [{skillGroups:[{label:'Tools'}]},{skillGroups:[{text:'Git'}]},{projects:[{description:'My work'}]},{links:[{label:'Portfolio'}]}])await assert.rejects(action(repo,candidate,{action:'resume-details',...details}));
 await action(repo,candidate,{action:'resume-details',skillGroups:[{label:'Tools',text:'Git'}]});
 await action(repo,candidate,{action:'resume-details',skillGroups:[],projects:[],links:[]});
 assert.deepEqual((await repo.account(candidate.id)).profile.resume.skillGroups,[]);
});
test('account saves return committed own state without querying workspace lists',async()=>{
 const {repo,candidate,employer}=await fixture();
 const fastRepo={...repo,accounts:()=>{throw new Error('Workspace read is unnecessary');},records:()=>{throw new Error('Workspace read is unnecessary');},scoped:()=>{throw new Error('Workspace read is unnecessary');}};
 const response=await actionResponse(fastRepo,candidate,{action:'resume-details',returnState:true,headline:'Saved',id:employer.id});
 assert.equal(response.state.user.id,candidate.id);assert.equal(response.state.profile.resume.headline,'Saved');
 assert.equal((await repo.account(candidate.id)).profile.resume.headline,'Saved');assert.ok(!JSON.stringify(response).includes(employer.email));
 await assert.rejects(actionResponse(fastRepo,employer,{action:'resume-details',returnState:true}));
});
test('record saves include updated state but still acknowledge committed writes if list loading fails',async()=>{
 const {repo,candidate,employer}=await fixture();
 let response=await actionResponse(repo,employer,{action:'need',text:'Middle Backend Python',returnState:true,stateRole:'employer'});
 assert.equal(response.state.needs.length,1);assert.equal(response.state.user.id,employer.id);
 response=await actionResponse({...repo,records:()=>{throw new Error('Read unavailable');}},employer,{action:'need',text:'Junior Frontend React',returnState:true,stateRole:'employer'});
 assert.equal(response.refreshRequired,true);assert.equal((await repo.scoped('need',employer.id)).length,2);
 assert.equal((await getState(repo,candidate)).needs.length,0);
});
test('candidate drafts save empty optional fields and retain fields omitted from a partial edit',async()=>{
 const {repo,candidate}=await fixture();
 await action(repo,candidate,{action:'profile',about:'Only this changed'});
 assert.equal(candidate.profile.name,'Candidate');assert.deepEqual(candidate.profile.stack,['Python','PostgreSQL']);
 await action(repo,candidate,{action:'profile',name:'',city:'',stack:'',min:'',max:'',about:'',work:'',education:''});
 const saved=(await repo.account(candidate.id)).profile;
 assert.equal(saved.name,'Candidate');assert.equal(saved.city,'');assert.deepEqual(saved.stack,[]);assert.equal(saved.min,null);assert.equal(saved.max,null);assert.equal(saved.grade,'Middle');assert.equal(saved.verified,true);
 await action(repo,candidate,{action:'profile',min:120000});assert.equal(candidate.profile.min,120000);assert.equal(candidate.profile.max,null);
 await assert.rejects(action(repo,candidate,{action:'profile',min:200000,max:100000}));
 await assert.rejects(action(repo,candidate,{action:'profile',min:-1}));
});

test('one resume save commits basic fields and structured blocks together or rejects the entire edit',async()=>{
 const {repo,candidate}=await fixture();
 const resume={headline:'ML Engineer',skillGroups:[{label:'ML',text:'Python, PyTorch'},{label:'Tools',text:'Git, Docker'}],projects:[{name:'Search',description:'Built retrieval',url:'https://example.test'}],links:[]};
 await action(repo,candidate,{action:'profile',name:'Updated',min:100000,max:200000,resume});
 const before=structuredClone(candidate.profile);
 assert.equal((await repo.account(candidate.id)).profile.resume.skillGroups[0].label,'ML');
 assert.equal(candidate.profile.min,100000);assert.equal(candidate.profile.verified,true);
 await assert.rejects(action(repo,candidate,{action:'profile',name:'Must not save',resume:{links:[{url:'javascript:alert(1)'}]}}));
 assert.deepEqual(candidate.profile,before);assert.deepEqual((await repo.account(candidate.id)).profile,before);
 await action(repo,candidate,{action:'profile',resume:{skillGroups:[{label:'',text:''}],projects:[],links:[]}});
 assert.equal(candidate.profile.name,'Updated');assert.deepEqual(candidate.profile.resume.skillGroups,[]);
});
