import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountFor,action,getState,publicJobs} from '../lib/service.mjs';
import {makeTest,testView,gradeTest,COOLDOWN,SPECS,GRADES,matching,parseNeed} from '../lib/domain.mjs';
import {seed} from '../lib/seed.mjs';
import {mockFspProfile} from '../lib/fsp.mjs';
import {publicCandidate} from '../lib/domain.mjs';
import {actionResponse} from '../lib/action-response.mjs';
function memory(){const accounts=new Map(),records=new Map();const clone=x=>x?structuredClone(x):null;return {account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),record:async id=>clone(records.get(id)),put:async(kind,r)=>records.set(r.id,{...clone(r),kind}),remove:async(id,owner)=>{if(records.get(id)?.owner===owner)records.delete(id);}};}

async function legacyAttempt(repo,candidate,body){const test={...makeTest(body.spec,body.grade),owner:candidate.id,status:'active'};await repo.put('test',test);return {test:testView(test)};}
const survey=(overrides={})=>({action:'survey',careerGoal:'Сменить компанию',employmentStatus:'Работаю, открыт к предложениям',experienceYears:'1–3 года',industry:'Финтех',spec:'Backend',secondarySpecs:['DevOps'],grade:'Middle',primaryRole:'Разработчик',roles:['Разработчик'],technicalSkills:'Python, PostgreSQL',achievement:'Сократил время ответа сервиса на 40 процентов после анализа узких мест.',projectSummary:'Разрабатывал платёжный API и оптимизировал PostgreSQL для высокой нагрузки.',softSkills:['Коммуникация','Системное мышление'],softSkillExample:'Согласовал спорные требования с продуктом и командой, после чего мы выпустили задачу без повторной разработки.',uncertaintyResponse:'Предлагаю несколько вариантов и сверяю направление',feedbackPreference:'Формат не важен, важна конкретика',workStyle:'Смешанный формат',preferredFormat:'Удалённо',acceptedFormats:['Удалённо','Гибрид'],employmentTypes:['Полная занятость'],availableFrom:'В течение месяца',englishLevel:'C1',salaryMin:'180000',city:'Москва',teamSize:'6–10 человек',taskType:'Развитие работающего продукта',businessTrips:'Редкие командировки',relocation:'Готов обсудить',motivation:'Хочу развивать продукт и брать ответственность за измеримый результат.',avoidTasks:'',...overrides});
async function fixture(){const repo=memory();const candidate=await accountFor(repo,{id:'candidate-a',email:'a@example.test',name:'Candidate'});await action(repo,candidate,{action:'onboard',role:'candidate',name:'Candidate',city:'Москва',consent:true});await action(repo,candidate,survey());candidate.profile={...candidate.profile,verified:true,score:90,stack:['Python','PostgreSQL'],verifiedAt:Date.now(),about:'Backend engineer',gradeChangedAt:Date.now()};await repo.saveAccount(candidate);const employer=await accountFor(repo,{id:'employer-a',email:'hr@example.test',name:'HR'});await action(repo,employer,{action:'onboard',role:'employer',name:'Company',description:'Product engineering team',industry:'IT',size:'1–50',contact:'hr@example.test',consent:true});const other=await accountFor(repo,{id:'employer-b',email:'b@example.test'});await action(repo,other,{action:'onboard',role:'employer',name:'Other',description:'Other engineering team',contact:'b@example.test',consent:true});return {repo,candidate,employer,other};}

test('candidate must complete a valid questionnaire before assessment',async()=>{const repo=memory();const candidate=await accountFor(repo,{id:'new-candidate',email:'new@example.test'});await action(repo,candidate,{action:'onboard',role:'candidate',name:'Новый кандидат',city:'Казань',consent:true});assert.equal(candidate.profile.spec,null);await assert.rejects(action(repo,candidate,{action:'assessment-register'}),/Сначала заполните анкету/);await assert.rejects(action(repo,candidate,survey({softSkills:['Коммуникация']})),/хотя бы два мягких навыка/);});

test('questionnaire keeps versions and declared roles without replacing a confirmed category',async()=>{const {repo,candidate}=await fixture();await action(repo,candidate,survey({industry:'Образование',spec:'QA',grade:'Senior',primaryRole:'Тестировщик',roles:['Тестировщик','Наставник'],softSkills:['Коммуникация','Наставничество','Работа с неопределённостью']}));const state=await getState(repo,candidate,'candidate');assert.equal(state.surveys.length,2);assert.deepEqual(state.surveys.map(x=>x.version),[2,1]);assert.deepEqual(candidate.profile.roles,['Тестировщик','Наставник']);assert.deepEqual(candidate.profile.softSkills,['Коммуникация','Наставничество','Работа с неопределённостью']);assert.equal(candidate.profile.grade,'Middle','анкета не должна подменять уже подтверждённый грейд');await assert.rejects(action(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'}),/Запишитесь на сессию/);const started=await legacyAttempt(repo,candidate,{action:'test-start',spec:'QA',grade:'Senior'});assert.ok(started.test.id);});

test('public candidate carries structured ATS answers with their source',async()=>{const {candidate}=await fixture();const view=publicCandidate(candidate,false);assert.deepEqual(view.roles,['Разработчик']);assert.deepEqual(view.softSkills,['Коммуникация','Системное мышление']);assert.deepEqual(view.ats.acceptedFormats,['Удалённо','Гибрид']);assert.equal(view.ats.languages[0].level,'C1');assert.equal(view.ats.languages[0].source,'candidate');assert.equal(view.ats.projectSummary.includes('платёжный API'),true);});
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
test('failed test preserves category; successful change obeys server cooldown',async()=>{const {repo,candidate}=await fixture();await action(repo,candidate,survey({grade:'Senior'}));let start=await legacyAttempt(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});let stored=await repo.record(start.test.id);let r=await action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>(q.correct+1)%q.options.length)});assert.equal(r.result.passed,false);assert.equal(candidate.profile.grade,'Middle');start=await legacyAttempt(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});stored=await repo.record(start.test.id);r=await action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>q.correct)});assert.equal(r.result.locked,true);assert.equal(candidate.profile.grade,'Middle');candidate.profile.gradeChangedAt=Date.now()-COOLDOWN-100;await repo.saveAccount(candidate);start=await legacyAttempt(repo,candidate,{action:'test-start',spec:'Backend',grade:'Senior'});stored=await repo.record(start.test.id);r=await action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>q.correct)});assert.equal(r.result.applied,true);assert.equal(candidate.profile.grade,'Senior');await assert.rejects(action(repo,candidate,{action:'test-submit',id:stored.id,answers:stored.questions.map(q=>q.correct)}));});
test('messages require accepted invitation and remain scoped to parties',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,invitation(candidate.id));const id=(await repo.scoped('invite',employer.id))[0].id;await assert.rejects(action(repo,employer,{action:'message',contextId:id,text:'Hello'}));await action(repo,candidate,{action:'invite-status',id,status:'accepted'});await action(repo,employer,{action:'message',contextId:id,text:'Hello'});assert.equal((await getState(repo,candidate,'candidate')).messages.length,1);assert.equal((await getState(repo,other,'employer')).messages.length,0);await assert.rejects(action(repo,other,{action:'message',contextId:id,text:'No access'}));});
test('need query prioritizes eligible profiles and displayed score, with the exact category recommended first',async()=>{
 const {repo,employer}=await fixture();
 const v=await getState(repo,employer,'employer','Middle backend Python PostgreSQL',{confirmed:true});
 const exact=v.candidates.filter(c=>c.match.relation==='exact');
 assert.ok(exact.length>=2);assert.ok(exact.every(c=>c.spec==='Backend'&&c.grade==='Middle'));
 assert.equal(v.need.spec,'Backend');assert.equal(v.need.grade,'Middle');
 assert.equal(v.categories[0].relation,'exact');assert.equal(v.categories[0].count,exact.length);
 const eligible=v.candidates.filter(c=>c.match.eligibility.status==='pass');
 assert.ok(eligible.length>0);assert.ok(eligible.every(c=>c.spec==='Backend'&&['Middle','Senior'].includes(c.grade)));
 assert.deepEqual(v.candidates.slice(0,eligible.length).map(c=>c.id),eligible.map(c=>c.id));
 for(let i=1;i<eligible.length;i++)assert.ok(eligible[i-1].match.score>=eligible[i].match.score);
 assert.equal((await getState(repo,employer,'candidate','Middle backend')).need,null);
});

test('anonymous job listing includes published vacancies but excludes archived and ownership fields',async()=>{const {repo,employer}=await fixture();await action(repo,employer,{action:'job',title:'Public API engineer',description:'Work on product API',spec:'Backend',grade:'Middle',stack:'Python',min:150000,max:220000});const job=(await repo.records('job'))[0];let rows=await publicJobs(repo);assert.ok(rows.some(j=>j.id===job.id));assert.ok(rows.every(j=>!('owner'in j)&&!('recipient'in j)));await action(repo,employer,{action:'job-status',id:job.id,status:'archived'});rows=await publicJobs(repo);assert.ok(!rows.some(j=>j.id===job.id));});
test('only the owner edits or deletes a task; an answered task is hidden but keeps the answer',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,{action:'task',title:'Query diagnosis',description:'Explain diagnosis and verification',spec:'Backend'});const task=(await repo.records('task'))[0];await assert.rejects(action(repo,other,{action:'task',id:task.id,title:'Hijack',description:'Changed by another company',spec:'QA'}));await assert.rejects(action(repo,other,{action:'task-delete',id:task.id}));await action(repo,employer,{action:'task',id:task.id,title:'Slow report',description:'Find the slow query and verify the fix',spec:'DevOps'});let tasks=await repo.records('task');assert.equal(tasks.length,1);assert.deepEqual([tasks[0].title,tasks[0].spec,tasks[0].status,tasks[0].owner],['Slow report','DevOps','published',employer.id]);await action(repo,candidate,{action:'task-answer',id:task.id,answer:'Measure slow queries using EXPLAIN ANALYZE and compare p95 under equivalent load.'});await action(repo,employer,{action:'task-delete',id:task.id});assert.equal((await repo.record(task.id)).status,'deleted');assert.equal((await getState(repo,employer,'employer')).tasks.length,0);const view=await getState(repo,candidate);assert.equal(view.tasks.length,1);assert.equal(view.submissions.length,1);assert.equal((await getState(repo,other,'candidate')).tasks.length,0);await assert.rejects(action(repo,other,{action:'task-answer',id:task.id,answer:'Another answer that is long enough to pass validation.'}));await assert.rejects(action(repo,employer,{action:'task',id:task.id,title:'Again',description:'Editing a deleted task',spec:'Backend'}));await action(repo,employer,{action:'task',title:'Fresh task',description:'Nobody has answered this one yet',spec:'QA'});const fresh=(await repo.records('task')).find(x=>x.title==='Fresh task');await action(repo,employer,{action:'task-delete',id:fresh.id});assert.equal(await repo.record(fresh.id),null);});
test('grouped salary digits from browser money fields keep their value',async()=>{const {repo,candidate,employer}=await fixture();await action(repo,employer,{action:'job',title:'Backend',description:'Develop APIs',spec:'Backend',grade:'Middle',min:'120.000',max:'180 000',stack:'Python',format:'Удалённо'});const job=(await repo.records('job'))[0];assert.deepEqual([job.min,job.max],[120000,180000]);await action(repo,employer,{...invitation(candidate.id),min:'200.000',max:'250.000'});assert.deepEqual([(await repo.records('invite'))[0].min,(await repo.records('invite'))[0].max],[200000,250000]);await assert.rejects(action(repo,employer,{action:'job',title:'Backend',description:'Develop APIs',spec:'Backend',grade:'Middle',min:'1.5',max:'2',stack:'Python',format:'Удалённо'}));});
test('a new company has no invented industry or size',async()=>{const repo=memory();const account=await accountFor(repo,{id:'new-company',email:'new@company.test'});await action(repo,account,{action:'onboard',role:'employer',name:'New company',contact:'new@company.test',consent:true});assert.equal(account.company.industry,'');assert.equal(account.company.size,'');});
test('questionnaire stores unanswered conditions as unknown and requires a work format',async()=>{const {repo,candidate}=await fixture();await assert.rejects(action(repo,candidate,survey({acceptedFormats:[]})),/формат работы/);await action(repo,candidate,survey({relocation:'',businessTrips:'',availableFrom:'',englishLevel:'',teamSize:'',taskType:''}));const latest=(await repo.records('survey')).sort((x,y)=>y.version-x.version)[0];assert.deepEqual([latest.relocation,latest.businessTrips,latest.availableFrom,latest.englishLevel,latest.teamSize,latest.taskType],[null,null,null,null,null,null]);assert.equal(candidate.profile.ats.relocation,null);assert.deepEqual(candidate.profile.ats.languages,[]);});
test('task solution is reviewed only by its company without changing confirmed grade',async()=>{const {repo,candidate,employer,other}=await fixture();await action(repo,employer,{action:'task',title:'Query diagnosis',description:'Explain diagnosis and verification',spec:'Backend'});const task=(await repo.records('task'))[0];await action(repo,candidate,{action:'task-answer',id:task.id,answer:'Measure slow queries using EXPLAIN ANALYZE and compare p95 under equivalent load.'});const submission=(await repo.records('submission'))[0];await assert.rejects(action(repo,other,{action:'task-review',id:submission.id,feedback:'Unauthorized review'}));await action(repo,employer,{action:'task-review',id:submission.id,feedback:'Good diagnosis; consider index write cost.'});const view=await getState(repo,candidate);assert.equal(view.submissions[0].status,'reviewed');assert.equal(view.profile.grade,'Middle');assert.equal((await getState(repo,other,'employer')).submissions.length,0);});
test('expired attempt cannot submit answers or alter category',async()=>{const {repo,candidate}=await fixture();const start=await legacyAttempt(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});const attempt=await repo.record(start.test.id);attempt.expires=Date.now()-1;await repo.put('test',attempt);await assert.rejects(action(repo,candidate,{action:'test-submit',id:attempt.id,answers:attempt.questions.map(q=>q.correct)}));assert.equal(candidate.profile.score,90);});

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
 const attempt=await legacyAttempt(repo,candidate,{action:'test-start',spec:'Backend',grade:'Middle'});assert.equal(attempt.test.questions.length,6);
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
 const published=publicCandidate(candidate,false).resume;
 assert.deepEqual(published.projects,[{name:'Search',description:'Semantic search'}]);
 assert.equal(published.links,undefined);assert.equal(published.achievements,undefined);
 assert.equal(publicCandidate(candidate,false).email,undefined);
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
 let response=await actionResponse(repo,employer,{action:'need',confirmed:true,text:'Middle Backend Python',returnState:true,stateRole:'employer'});
 assert.equal(response.state.needs.length,1);assert.equal(response.state.user.id,employer.id);
 response=await actionResponse({...repo,records:()=>{throw new Error('Read unavailable');}},employer,{action:'need',confirmed:true,text:'Junior Frontend React',returnState:true,stateRole:'employer'});
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

test('work and education cards round-trip with text mirrors and clearing removes stale text',async()=>{
 const {repo,candidate}=await fixture();
 await action(repo,candidate,{action:'profile',resume:{workEntries:[{company:'Vector',position:'ML Engineer',start:'Март 2023',end:'2025',current:true,description:'Built search'},{company:'',position:'',start:'',end:'',current:false,description:''}],educationEntries:[{institution:'University',program:'Mathematics',level:'Бакалавриат',start:'2018',end:'2022',description:'Diploma'}]}});
 assert.equal(candidate.profile.resume.workEntries.length,1);assert.match(candidate.profile.work,/Vector \| ML Engineer/);assert.match(candidate.profile.work,/настоящее время/);assert.match(candidate.profile.education,/University/);
 await action(repo,candidate,{action:'profile',about:'Updated without replacing cards'});
 assert.equal(candidate.profile.resume.workEntries[0].company,'Vector');
 await action(repo,candidate,{action:'resume-details',headline:'Engineer'});
 assert.equal(candidate.profile.resume.educationEntries[0].program,'Mathematics');
 await action(repo,candidate,{action:'profile',resume:{workEntries:[],educationEntries:[]}});
 assert.equal(candidate.profile.work,'');assert.equal(candidate.profile.education,'');
 assert.deepEqual((await repo.account(candidate.id)).profile.resume.workEntries,[]);
});
test('history cards accept partial drafts and reject invalid collections without saving other edits',async()=>{
 const {repo,candidate}=await fixture();
 await action(repo,candidate,{action:'profile',resume:{workEntries:[{description:'Internship draft'}],educationEntries:[{program:'Course draft'}]}});
 assert.equal(candidate.profile.resume.workEntries[0].company,'');
 const before=structuredClone(candidate.profile);
 for(const workEntries of [{company:'Wrong shape'},[null],Array.from({length:11},()=>({company:'Company'}))]){
  await assert.rejects(action(repo,candidate,{action:'profile',name:'Must not save',resume:{workEntries}}));assert.deepEqual(candidate.profile,before);
 }
});
test('skill groups provide search technologies without duplicating profile fields',async()=>{
 const {repo,candidate}=await fixture();
 await action(repo,candidate,{action:'profile',resume:{skillGroups:[{label:'ML',text:'Python, PyTorch, python',description:'Model development'},{label:'Tools',text:'Docker, SQL'}]}});
 assert.deepEqual(candidate.profile.stack,['Python','PyTorch','Docker','SQL']);assert.equal(candidate.profile.resume.skillGroups[0].description,'Model development');
 await action(repo,candidate,{action:'profile',about:'Only description changed'});assert.deepEqual(candidate.profile.stack,['Python','PyTorch','Docker','SQL']);
 await action(repo,candidate,{action:'profile',resume:{skillGroups:[]}});assert.deepEqual(candidate.profile.stack,[]);
});

test('company profile round-trips blocks, preserves omitted fields and clears optional data',async()=>{
 const {repo,employer}=await fixture();
 const details={action:'company',tagline:'Product for engineering teams',product:'Cloud platform for collaborative development',foundedYear:'2018',teamSize:'24',teamDescription:'Three cross-functional teams with shared review and mentoring',techStack:'Go, React, PostgreSQL, Go',workFormats:['Удалённо','Гибрид'],officeAddress:'Москва, центр',workingHours:'Flexible start; shared hours 12–16 MSK',benefits:'Equipment\nLearning budget',hiringProcess:'Recruiter call, technical discussion, decision in three days',website:'https://example.test',careersUrl:'https://example.test/careers',contactName:'Recruiter Name',contactRole:'IT recruiter'};
 await action(repo,employer,details);
 const saved=await repo.account(employer.id);
 assert.equal(saved.company.name,'Company');assert.equal(saved.company.industry,'IT');assert.equal(saved.company.size,'1–50');
 assert.deepEqual(saved.company.techStack,['Go','React','PostgreSQL']);assert.deepEqual(saved.company.benefits,['Equipment','Learning budget']);
 assert.deepEqual((await getState(repo,saved,'employer')).company,saved.company);
 await action(repo,saved,{action:'company',tagline:'Updated tagline'});
 assert.equal((await repo.account(saved.id)).company.product,details.product);
 await action(repo,saved,{action:'company',product:'',website:'',workFormats:[],benefits:[],techStack:[],foundedYear:'',teamSize:''});
 const cleared=(await repo.account(saved.id)).company;
 assert.equal(cleared.product,'');assert.equal(cleared.website,'');assert.deepEqual(cleared.workFormats,[]);assert.deepEqual(cleared.techStack,[]);
});

test('company validation rejects unsafe links and malformed blocks without a partial save',async()=>{
 const {repo,employer,candidate}=await fixture();
 await assert.rejects(action(repo,candidate,{action:'company',name:'Impersonated company'}),/профиль компании/);
 const original=(await repo.account(employer.id)).company;
 for(const update of [{website:'javascript:alert(1)'},{careersUrl:'https://user:password@example.test'},{foundedYear:'2099'},{teamSize:'-4'},{workFormats:['Invalid']},{benefits:Array(13).fill('Benefit')},{size:'Fake size'}]){
  await assert.rejects(action(repo,employer,{action:'company',name:'Should not save',...update}));
  assert.deepEqual((await repo.account(employer.id)).company,original);
 }
});

test('candidates see current company information in jobs and invitations without recruiting or account contacts',async()=>{
 const {repo,employer,candidate}=await fixture();
 await action(repo,employer,{action:'company',name:'Studio',product:'Developer platform',teamDescription:'A distributed engineering team',techStack:['Go'],contactName:'Private recruiter',contactRole:'Private role',contact:'private@example.test',website:'https://example.test'});
 await action(repo,employer,{action:'job',title:'Backend engineer',description:'Develop APIs',spec:'Backend',grade:'Middle',stack:'Go',min:100,max:200});
 await action(repo,employer,invitation(candidate.id));
 await action(repo,employer,{action:'company',name:'Studio Updated',product:'Updated product'});
 const publicJob=(await publicJobs(repo)).find(j=>!j.synthetic);
 assert.equal(publicJob.company,'Studio Updated');assert.equal(publicJob.companyProfile.product,'Updated product');
 const incoming=await getState(repo,candidate,'candidate');
 assert.equal(incoming.invites[0].companyProfile.name,'Studio Updated');
 assert.equal(incoming.jobs.find(j=>j.id===publicJob.id).companyProfile.product,'Updated product');
 for(const profile of [publicJob.companyProfile,incoming.invites[0].companyProfile]){
  for(const key of ['contact','contactName','contactRole','email','id','privacy'])assert.ok(!(key in profile));
  assert.ok(!JSON.stringify(profile).includes('private@example.test'));
 }
});
