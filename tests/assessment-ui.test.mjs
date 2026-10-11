import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/assessments.js',import.meta.url),'utf8');
const base={modules:[{id:'python',name:'Python'},{id:'sql',name:'SQL'},{id:'integration-backend',name:'Интеграция',integration:true}],roles:[{id:'backend',name:'Backend Developer',modules:['python','sql'],integration:'integration-backend'}],history:[],hiddenHistory:[],registrations:[],specifications:[],days:[]};
const result=(moduleId,score,completedAt)=>({moduleId,score,completedAt});

test('result cards distinguish difficulty-adjusted coding points from raw completion and preserve old percentage reports',()=>{
 const {context}=render(base),row={name:'Python',score:80,theoryScore:80,codingScore:80,codingCompletion:50,codingScoreModel:'difficulty-adjusted-v1',correct:20,total:32,specVersion:8,gradeRequirements:{Junior:{met:true},Middle:{met:true},Senior:{met:true}}};
 const current=context.assessmentResultRows([row]);assert.ok(current.includes('Кодинг 80/100'));assert.ok(current.includes('Средний зачёт задач: 50%'));assert.ok(!current.includes('Кодинг 80%'));
 const old={...row,codingScore:50};delete old.codingCompletion;delete old.codingScoreModel;
 const legacy=context.assessmentResultRows([old]);assert.ok(legacy.includes('Кодинг 50%'));assert.ok(!legacy.includes('Средний зачёт задач'));
});
const skill=(id,created,score,completedAt)=>({id,created,status:'finished',targetKind:'skill',targetId:'python',results:[result('python',score,completedAt)]});
function render(config){const context={location:{hash:''},state:{assessment:config},page:'tests',setInterval:()=>{},app:{querySelector:()=>null},document:{addEventListener:()=>{}},esc:String,button:()=>'',date:String,icon:()=>'<svg></svg>'};runInNewContext(source,context);return {latest:context.assessmentLatestResults(config),html:context.assessmentTestsPage(),context};}

test('confirmed skills show the latest completed score even when lower, independent of history order',()=>{
 const config={...base,history:[skill('new',200,40,300),skill('old',100,95,150)]};
 const {latest}=render(config);assert.equal(latest.length,1);assert.equal(latest[0].score,40);
 config.history.reverse();assert.equal(render(config).latest[0].score,40);
 // Completion time determines freshness, including a test started earlier.
 config.history.push(skill('completed-last',50,25,400));assert.equal(render(config).latest[0].score,25);
});

test('latest role score uses all required modules and excludes unfinished, active, hidden and integration entries',()=>{
 const role={id:'role',created:100,status:'finished',targetKind:'role',targetId:'backend',roleResult:{completed:true},results:[result('python',80,110),result('sql',65,120),result('integration-backend',70,130)]};
 const config={...base,history:[role,{...role,id:'new-role',created:200,results:[result('python',55,210),result('sql',90,220),result('integration-backend',40,230)]},{...role,id:'unfinished',created:300,status:'incomplete',roleResult:{completed:false},results:[result('python',30,310)]},{...role,id:'active',created:400,status:'active'},{...role,id:'hidden',created:500,hiddenFromHistory:true}],hiddenHistory:[skill('hidden-other',600,100,610)]};
 const {latest,html}=render(config);assert.equal(latest.length,3);
 assert.equal(latest.find(r=>r.id==='python').score,30);assert.equal(latest.find(r=>r.id==='sql').score,90);assert.equal(latest.find(r=>r.kind==='role').score,40);
 assert.ok(!latest.some(r=>r.id==='integration-backend'));assert.ok(html.includes('Подтвержденные навыки'));assert.ok(html.includes('Последний балл'));assert.ok(!html.includes('История тестирования'));assert.ok(!html.includes('Удалённые из истории'));
});

test('confirmed section has an empty state without restoring hidden history',()=>{
 const {latest,html}=render({...base,hiddenHistory:[skill('hidden',10,95,20)]});assert.equal(latest.length,0);assert.ok(html.includes('assessment-confirm-add'));assert.ok(html.includes('data-action="assessment-book"'));
});

test('the eye keeps a hidden latest result visible to its owner and toggles the exact attempt and target',async()=>{
 const recent={...skill('recent',200,40,300),employerHiddenResults:{'skill:python':true}};
 const {latest,html,context}=render({...base,history:[skill('old',100,95,150),recent]});
 assert.equal(latest[0].score,40);assert.equal(latest[0].attemptId,'recent');assert.equal(latest[0].hidden,true);
 assert.ok(html.includes('Показать работодателю: Python'));assert.ok(html.includes('Скрыто от работодателя'));assert.ok(html.includes('aria-pressed="true"'));
 const calls=[];context.mutate=async body=>calls.push(body);const el={disabled:false,dataset:{action:'assessment-result-visibility',id:'recent',targetId:'python',targetKind:'skill',hidden:'false'}};
 await context.assessmentHandleAction(el);assert.equal(el.disabled,false);assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{action:'assessment-result-visibility',id:'recent',targetId:'python',targetKind:'skill',hidden:false});
 el.dataset.hidden='true';await context.assessmentHandleAction(el);assert.equal(calls[1].hidden,true);
});

test('qualification picker contains skills and roles without calendar or booking confirmation',()=>{
 const {context}=render(base);
 const skills=context.assessmentBookingMarkup(base,{kind:'skill'});
 assert.ok(skills.includes('Python'));assert.ok(!skills.includes('Интеграция'));assert.ok(!skills.includes('Дата тестирования'));assert.ok(!skills.includes('qualification-calendar'));assert.ok(!skills.includes('type="submit"'));
 const roles=context.assessmentBookingMarkup(base,{kind:'role'});assert.ok(roles.includes('Backend Developer'));assert.ok(!roles.includes('Python'));
});

test('choosing a qualification navigates directly to its start page without registering a session',async()=>{
 const {context}=render(base),calls=[];context.go=route=>calls.push(route);context.assessmentPreparation={targetId:'old'};
 await context.assessmentHandleAction({dataset:{action:'assessment-book-target',id:'backend'}});
 assert.deepEqual(calls,['tests/start/backend']);
});

test('preparing the daily pool preserves grade and consent selected while loading',async()=>{
 const {context}=render(base);let resolve;
 context.api=()=>new Promise(done=>{resolve=done;});context.render=()=>{};
 const load=context.assessmentLoadPreparation({id:'backend'});
 context.assessmentHandleChange({target:{name:'targetGrade',value:'Senior',form:{id:'assessment-start-form'}}});
 context.assessmentHandleChange({target:{name:'accepted',checked:true,form:{id:'assessment-start-form'}}});
 resolve({preparation:{targetId:'backend'}});await load;
 context.location.hash='#tests/start/backend';context.title=(h,p)=>h+p;
 const html=context.assessmentTestsPage();assert.ok(html.includes('value="Senior" checked'));assert.match(html,/name="accepted"\s+required\s+checked/);
});

test('role start page offers a grade and submits the target directly, with no day booking',async()=>{
 const {context}=render(base);context.location.hash='#tests/start/backend';context.title=(h,p)=>h+p;
 const prep={targetId:'backend',name:'Backend Developer',day:{id:'daily-pool-today',breakSeconds:60,moduleConfigs:{python:{seconds:640},sql:{seconds:640},'integration-backend':{seconds:640}}}};
 context.api=async()=>({preparation:prep});context.render=()=>{};
 await context.assessmentLoadPreparation({id:'backend'});
 const html=context.assessmentTestsPage();assert.ok(html.includes('Целевой грейд'));assert.ok(html.includes('Начать тест'));assert.ok(!html.includes('календар'));assert.ok(!html.includes('Ваши записи'));
 const calls=[];context.api=async body=>{calls.push(body);return {assessment:{id:'attempt',status:'active',modules:[]}};};context.close=()=>{};
 await context.assessmentHandleSubmit({id:'assessment-start-form',dataset:{targetId:'backend'},elements:{accepted:{checked:true},targetGrade:{value:'Senior'}},querySelector:()=>({})},{});
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{action:'assessment-start',targetId:'backend',rulesAccepted:true,targetGrade:'Senior'});
});

 test('question form renders competencies and integration skills from the selected module',()=>{
 const {context}=render(base);const plain=context.assessmentCompetencyFields({competencies:['collections'],integration:false},null);assert.ok(plain.includes('value="collections"'));assert.ok(!plain.includes('name="skills"'));
 const integration=context.assessmentCompetencyFields({competencies:['composition'],integration:true,skills:['python','sql']},{competencies:['composition'],skills:['sql']});assert.ok(integration.includes('name="skills"'));assert.ok(integration.includes('value="sql" checked'));
 });

const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('code prompts separate React instructions and Python source without changing strings or indentation',()=>{
 const {context}=render(base);context.esc=escapeHtml;
 const react='React: const show=false; return <div>{show ? <span>4</span> : null}</div>. Сколько span отрисуется?';
 const parts=context.assessmentPromptParts(react,'react');
 assert.equal(parts.heading,'Сколько span отрисуется?');assert.equal(parts.code,'const show=false; return <div>{show ? <span>4</span> : null}</div>');
 const python='Что вернёт функция?\ndef f():\n    try:\n        return 1\n    finally:\n        return 2';
 assert.equal(context.assessmentPromptParts(python,'python').code,python.split('\n').slice(1).join('\n'));
 const quoted='Python: x="Что выведет код?"; print(x). Введите вывод.';
 assert.equal(context.assessmentPromptParts(quoted,'python').code,'x="Что выведет код?"; print(x)');
 assert.equal(context.assessmentPromptParts('Как выбрать React-компонент?','react').code,null);
 assert.equal(context.assessmentPromptParts('Python: сколько элементов в list(range(7, 1, -2))?','python').code,null);
});

test('code blocks escape HTML, preserve the original text and support explicit fenced snippets',()=>{
 const {context}=render(base);context.esc=escapeHtml;
 const code='const text = "<img src=x onerror=alert(1)>";\nreturn <span>{text}</span>;';
 const highlight=context.assessmentHighlightCode(code,'jsx');
 assert.ok(!highlight.includes('<img'));assert.ok(highlight.includes('&lt;img'));assert.match(highlight,/class="code-keyword"/);
 const decode=text=>text.replace(/<span class="code-[\w]+">|<\/span>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
 assert.equal(decode(highlight),code);
 const prompt='Что покажет компонент?\n```jsx\n'+code+'\n```';
 const parts=context.assessmentPromptParts(prompt,'react');assert.equal(parts.heading,'Что покажет компонент?');assert.equal(parts.code,code);
 const html=context.assessmentQuestionMarkup({prompt},'react');assert.match(html,/class="exam-code"/);assert.match(html,/aria-hidden="true">1\n2<\/pre>/);assert.ok(!html.includes('<img'));
});

test('inline code covers technical names and expressions across prose without changing the question text',()=>{
 const {context}=render(base);context.esc=escapeHtml;
 const text='Как преобразовать ValueError в DomainError? let и useState, props.count, userName, customer_id, count=4, a[-2] и len(A & B). React остаётся текстом.';
 const html=context.assessmentInlineCode(text,'python');
 for(const fragment of ['ValueError','DomainError','let','useState','props','userName','customer_id','len'])assert.ok(html.includes(fragment));
 assert.match(html,/<code class="exam-inline-code"><span class="code-type">ValueError<\/span><\/code>/);
 assert.match(html,/<code class="exam-inline-code"><span class="code-keyword">let<\/span><\/code>/);
 assert.match(html,/<code class="exam-inline-code"><span class="code-function">len<\/span>/);
 assert.ok(html.includes('count<span class="code-punctuation">=</span>'));assert.ok(html.includes('a<span class="code-punctuation">[-</span>'));
 assert.ok(html.includes('React остаётся текстом.'));
 const plain=html.replace(/<code class="exam-inline-code">|<\/code>|<span class="code-[\w]+">|<\/span>/g,'').replace(/&amp;/g,'&');
 assert.equal(plain,text);
 const literal='Что выведет print("<img src=x onerror=alert(1)>") и `typeof value`?';
 const escaped=context.assessmentInlineCode(literal,'python');assert.ok(!escaped.includes('<img'));assert.ok(escaped.includes('&lt;img'));assert.ok(escaped.includes('`typeof value`'));
});


test('role result labels distinguish all five outcomes and preserve legacy reports',()=>{
 const {context}=render(base);
 const cases=[
  [{targetGrade:'Middle',confirmedGrade:'Middle',confirmedPlus:true,potentialHigher:'Senior',status:'confirmed-plus-potential'},'Middle+ подтверждён · потенциал Senior'],
  [{targetGrade:'Middle',confirmedGrade:'Middle',confirmedPlus:true,status:'confirmed-plus'},'Middle+ подтверждён'],
  [{targetGrade:'Middle',confirmedGrade:'Middle',confirmedPlus:false,status:'confirmed'},'Middle подтверждён'],
  [{targetGrade:'Middle',confirmedGrade:'Junior',confirmedPlus:true,status:'unconfirmed-lower'},'Middle не подтверждён · подтверждён Junior+'],
  [{targetGrade:'Middle',confirmedGrade:'Junior',confirmedPlus:false,status:'unconfirmed-lower'},'Middle не подтверждён · подтверждён Junior'],
  [{targetGrade:'Middle',confirmedGrade:null,status:'unconfirmed'},'Middle не подтверждён'],
  [{level:'Senior'},'Senior'],
 ];
 for(const [result,label] of cases)assert.equal(context.assessmentRoleOutcome(result),label);
 const report={id:'plus-role',created:100,status:'finished',targetKind:'role',targetId:'backend',roleResult:{...cases[0][0],completed:true},results:[result('python',90,110),result('sql',95,120),result('integration-backend',90,130)]};
 assert.ok(render({...base,history:[report]}).html.includes('Middle+ подтверждён · потенциал Senior'));
});

test('large banks render one page, move across pages and reset pagination on filters',async()=>{
 const questions=Array.from({length:63},(_,i)=>({id:'q'+i,prompt:'Вопрос '+i,moduleId:i<30?'python':'sql',familyId:'family'+i,status:'working',difficulty:1,format:'choice',templateVersion:1,version:1,exposure:0,familyExposure:0}));
 const config={...base,maintainer:true};const {context}=render(config);
 context.title=()=>'';context.tag=()=>'';context.badge=()=>'';context.render=()=>{};context.app={querySelector:()=>null};
 context.api=async()=>({admin:{questions,modules:base.modules}});
 context.assessmentAdminPage();await new Promise(resolve=>setImmediate(resolve));
 const first=context.assessmentAdminPage();assert.equal((first.match(/<article /g)||[]).length,25);assert.ok(first.includes('Вопрос 0</h3>'));assert.ok(!first.includes('Вопрос 25</h3>'));assert.ok(first.includes('Страница 1 из 3'));
 await context.assessmentHandleAction({dataset:{action:'assessment-bank-page',id:'3'}});
 const last=context.assessmentAdminPage();assert.equal((last.match(/<article /g)||[]).length,13);assert.ok(last.includes('Вопрос 62</h3>'));assert.ok(last.includes('Страница 3 из 3'));
 context.assessmentHandleChange({target:{dataset:{assessmentFilter:'module'},value:'sql'}});
 const filtered=context.assessmentAdminPage();assert.ok(filtered.includes('Страница 1 из 2'));assert.ok(filtered.includes('Вопрос 30</h3>'));
 context.assessmentHandleChange({target:{dataset:{assessmentFilter:'query'},value:'нет такого вопроса'}});
 const empty=context.assessmentAdminPage();assert.ok(empty.includes('Вопросы не найдены.'));assert.equal((empty.match(/<article /g)||[]).length,0);
});

test('code indentation preserves Tab and Shift+Tab leaves the editor without changing the source',()=>{
 const handlers={},editor={name:'assessmentCode',selectionStart:0,selectionEnd:0,setRangeText:text=>{editor.value=text+editor.value;},dispatchEvent:()=>{},value:'print(1)'};
 let focused=false,prevented=0;
 const context={page:'tests',setInterval:()=>{},clearTimeout:()=>{},Event:class{},overlay:{firstElementChild:null},document:{activeElement:editor,addEventListener:(name,fn)=>handlers[name]=fn},app:{querySelector:selector=>selector==='[name=assessmentStdin]'?{focus:()=>{focused=true;}}:null}};
 runInNewContext(source,context);
 context.assessmentAccept({id:'attempt',status:'active',currentModule:{id:'python',questionIndex:0,answers:{},questions:[{id:'q',format:'coding'}]}});
 handlers.keydown({key:'Tab',preventDefault:()=>prevented++});assert.equal(editor.value,'  print(1)');assert.equal(focused,false);
 handlers.keydown({key:'Tab',shiftKey:true,preventDefault:()=>prevented++});assert.equal(editor.value,'  print(1)');assert.equal(focused,true);assert.equal(prevented,2);
});

test('coding Next requires explicit confirmation without a submission, and a stale dialog cannot advance another question',async()=>{
 const {context}=render(base),calls=[];let dialog;
 context.clearTimeout=()=>{};context.button=(label,action,attrs)=>`<button data-action="${action}" ${attrs||''}>${label}</button>`;
 context.modal=(title,description,body)=>{dialog={title,description,body};};context.close=()=>{};
 context.assessmentRun=async(action,body)=>calls.push({action,body});
 const attempt=q=>({id:'attempt',status:'active',currentModule:{id:'python',questionIndex:0,answers:{},questions:[q]}});
 context.assessmentAccept(attempt({id:'q1',format:'coding',coding:{submission:{used:0}}}));
 await context.assessmentHandleAction({dataset:{action:'assessment-code-next'}});
 assert.equal(calls.length,0);assert.match(dialog.description,/не получит баллы/);assert.match(dialog.body,/data-id="q1"/);
 context.assessmentAccept(attempt({id:'q2',format:'coding',coding:{submission:{used:0}}}));
 await context.assessmentHandleAction({dataset:{action:'assessment-code-leave',id:'q1',attemptId:'attempt'}});
 assert.equal(calls.length,0,'a dialog opened for an expired question must not skip the next one');
 await context.assessmentHandleAction({dataset:{action:'assessment-code-leave',id:'q2',attemptId:'attempt'}});
 assert.equal(calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{action:'assessment-answer',body:{questionId:'q2',answer:null}});
});

test('coding Next proceeds after a judged submission without another interruption',async()=>{
 const {context}=render(base);let advanced=0;context.clearTimeout=()=>{};
 context.modal=()=>assert.fail('judged code should not show an unsubmitted warning');context.assessmentRun=async()=>advanced++;
 context.assessmentAccept({id:'a',status:'active',currentModule:{id:'python',questionIndex:0,answers:{q:'print(1)'},questions:[{id:'q',format:'coding',coding:{starter:'',submission:{used:1,passed:4,total:4,lastSource:'print(1)'}}}]}});
 await context.assessmentHandleAction({dataset:{action:'assessment-code-next'}});assert.equal(advanced,1);
});

test('qualification search filters case-insensitively, excludes integration skills and preserves an actionable empty state',()=>{
 const {context}=render(base);
 assert.match(context.assessmentBookingResults(base,{kind:'skill',query:'PYt'}),/Python/);
 assert.ok(!context.assessmentBookingResults(base,{kind:'skill',query:'PYt'}).includes('SQL'));
 assert.match(context.assessmentBookingResults(base,{kind:'role',query:'backend'}),/Backend Developer/);
 assert.match(context.assessmentBookingResults(base,{kind:'skill',query:'Интеграция'}),/Попробуйте другое название/);
});

test('preparation displays only the selected grade requirements from the versioned configuration',()=>{
 const {context}=render(base),configs={python:{thresholds:{Junior:40,Middle:65,Senior:85},scoring:{theoryWeight:.6,codingWeight:.4,grades:{Junior:{theoryMin:35,codingMin:30,difficultyMin:1,solvedMin:1},Middle:{theoryMin:55,codingMin:50,difficultyMin:2,solvedMin:1},Senior:{theoryMin:75,codingMin:75,difficultyMin:3,solvedMin:1}}}}};
 const middle=context.assessmentScoringDetails(configs,['python'],'Middle',true);
 assert.match(middle,/итог от 65\/100/);assert.match(middle,/теория от 55\/100/);assert.ok(!middle.includes('Senior'));
 const senior=context.assessmentScoringDetails(configs,['python'],'Senior',true);assert.match(senior,/итог от 85\/100/);assert.match(senior,/сложности 3\+/);
 const all=context.assessmentScoringDetails(configs,['python']);assert.match(all,/caption/);assert.match(all,/Junior/);assert.match(all,/Middle/);assert.match(all,/Senior/);
});

test('switching mobile coding panes changes presentation without replacing editors or saving a different answer',()=>{
 const {context}=render(base);context.clearTimeout=()=>{};let pane;
 const tabs=['task','solution'].map(id=>({dataset:{id},setAttribute:(key,value)=>{if(key==='aria-selected')tabs.find(t=>t.dataset.id===id).selected=value;}}));
 context.app={querySelector:()=>({setAttribute:(_key,value)=>{pane=value;}}),querySelectorAll:()=>tabs};
 context.render=()=>assert.fail('pane changes must preserve editor DOM and scroll');
 context.assessmentAccept({id:'a',status:'active',currentModule:{id:'python',questionIndex:0,answers:{q:'print(2)'},questions:[{id:'q',format:'coding'}]}});
 context.assessmentSwitchCodingPanel('solution');assert.equal(pane,'solution');assert.equal(tabs[1].selected,'true');assert.equal(tabs[0].selected,'false');
 context.assessmentSwitchCodingPanel('invalid');assert.equal(pane,'solution');
});

test('reset keeps edited code until confirmed, and an expired reset cannot affect the next question',async()=>{
 const {context}=render(base);let dialog,saves=0,renders=0;
 context.clearTimeout=()=>{};context.render=()=>renders++;context.close=()=>{};
 context.assessmentQueueDraft=()=>saves++;
 context.button=(label,action,attrs)=>`<button data-action="${action}" ${attrs||''}>${label}</button>`;
 context.modal=(title,description,body)=>{dialog={title,description,body};};
 const attempt=(id,answer)=>({id:'a',status:'active',currentModule:{id:'python',questionIndex:Number(id.slice(1))-1,answers:{[id]:answer},questions:[...Array.from({length:Number(id.slice(1))-1},(_,i)=>({id:'closed'+i})),{id,format:'coding',coding:{starter:'print(0)'}}]}});
 context.assessmentAccept(attempt('q1','print(42)'));
 await context.assessmentHandleAction({dataset:{action:'assessment-code-reset'}});
 assert.equal(saves,0);assert.equal(renders,0);assert.equal(runInNewContext('assessmentDraft',context),'print(42)');assert.match(dialog.body,/data-id="q1"/);
 context.assessmentAccept(attempt('q2','print(7)'));
 await context.assessmentHandleAction({dataset:{action:'assessment-code-reset-confirmed',attemptId:'a',id:'q1'}});
 assert.equal(saves,0);assert.equal(runInNewContext('assessmentDraft',context),'print(7)');
 await context.assessmentHandleAction({dataset:{action:'assessment-code-reset-confirmed',attemptId:'a',id:'q2'}});
 assert.equal(saves,1);assert.equal(runInNewContext('assessmentDraft',context),'print(0)');
 context.assessmentResetCode();assert.equal(saves,1,'unchanged starter code needs neither confirmation nor a save');
});

test('skip protects a selected or numeric answer, allows empty skips, and rejects stale confirmation',async()=>{
 const {context}=render(base),calls=[];let dialog;
 context.clearTimeout=()=>{};context.close=()=>{};context.assessmentRun=async(action,body)=>calls.push({action,body});
 context.button=(label,action,attrs)=>`<button data-action="${action}" ${attrs||''}>${label}</button>`;
 context.modal=(title,description,body)=>{dialog={title,description,body};};
 const attempt=(id,format,answer)=>({id:'a',status:'active',currentModule:{id:'sql',questionIndex:Number(id.slice(1))-1,answers:{[id]:answer},questions:[...Array.from({length:Number(id.slice(1))-1},(_,i)=>({id:'closed'+i})),{id,format}]}});
 context.assessmentAccept(attempt('q1','choice',0));
 await context.assessmentHandleAction({dataset:{action:'assessment-question-next'}});
 assert.equal(calls.length,0);assert.match(dialog.description,/ответ будет удалён/);
 context.assessmentAccept(attempt('q2','numeric','0'));
 await context.assessmentHandleAction({dataset:{action:'assessment-question-skip-confirmed',id:'q1',attemptId:'a'}});
 assert.equal(calls.length,0);
 await context.assessmentSkipQuestion();assert.match(dialog.body,/data-id="q2"/);assert.equal(calls.length,0);
 await context.assessmentHandleAction({dataset:{action:'assessment-question-skip-confirmed',id:'q2',attemptId:'a'}});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'assessment-answer',body:{questionId:'q2',answer:null}}]);
 context.assessmentAccept(attempt('q3','numeric','  '));await context.assessmentSkipQuestion();assert.equal(calls.length,2);
});

test('failed coding draft can be retried without grading or spending submissions, with quiet success',async()=>{
 const {context}=render(base),calls=[];context.clearTimeout=()=>{};
 const attempt={id:'a',status:'active',revision:0,currentModule:{id:'python',questionIndex:0,answers:{q:'print(42)'},questions:[{id:'q',format:'coding',coding:{starter:'',submission:{used:1,limit:3}}}]}};
 context.assessmentAccept(attempt);let offline=true;
 context.api=async body=>{calls.push(body);if(offline)throw new Error('offline');return {assessment:{...attempt,revision:1}};};
 context.assessmentQueueDraft();await context.assessmentFlushDraft();
 assert.match(context.assessmentDraftStatus(),/черновик/);assert.match(context.assessmentDraftStatusMarkup(),/Повторить сохранение/);assert.ok(!context.assessmentDraftStatus().includes('Ответить'));
 offline=false;await context.assessmentHandleAction({dataset:{action:'assessment-draft-retry'}});
 assert.equal(calls.at(-1).action,'assessment-draft');assert.equal(calls.at(-1).answer,'print(42)');
 assert.ok(calls.every(c=>['assessment-draft','assessment-resume'].includes(c.action)));assert.equal(attempt.currentModule.questions[0].coding.submission.used,1);
 assert.equal(context.assessmentDraftStatusMarkup(),'');
});

test('coding feedback distinguishes the last submission from the best credited result',()=>{
 const {context}=render(base),html=context.assessmentCodingActions({coding:{submission:{used:3,limit:3,passed:1,total:4,results:[true,false,false,false],best:{passed:4,total:4}}}},true);
 assert.match(html,/Последняя отправка: пройдено тестов 1 из 4/);assert.match(html,/В зачёт: 4\/4/);assert.match(html,/0 из 3 попыток осталось/);
});

test('public testing explanation matches adaptive daily-pool exams and defers variable limits to preparation',()=>{
 const client=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
 const method=client.slice(client.indexOf('function methodPage()'),client.indexOf('function ',client.indexOf('function methodPage()')+9));
 assert.ok(!method.includes('Шесть вопросов'));assert.ok(!method.includes('20 минут'));assert.ok(!method.includes('67 баллов'));
 assert.match(method,/на каждые 24 часа/);assert.match(method,/задания второй подбираются по ответам первой/);assert.match(method,/Кодинг включён в обе части/);
});


test('Next protects unjudged edits after resume, preserves the best result and rejects an expired warning',async()=>{
 const {context}=render(base),calls=[];let dialog;
 context.clearTimeout=()=>{};context.close=()=>{};
 context.button=(label,action,attrs)=>`<button data-action="${action}" ${attrs||''}>${label}</button>`;
 context.modal=(title,description,body)=>{dialog={title,description,body};};
 context.assessmentRun=async(action,body)=>calls.push({action,body});
 const attempt=(index,source)=>({id:'a',status:'active',currentModule:{id:'python',questionIndex:index,answers:{['q'+index]:source},questions:[...Array.from({length:index},(_,i)=>({id:'q'+i})),{id:'q'+index,format:'coding',coding:{starter:'print(0)',submission:{used:1,limit:3,lastSource:'print(1)',best:{passed:4,total:4}}}}]}});
 context.assessmentAccept(attempt(0,'print(2)'));
 await context.assessmentHandleAction({dataset:{action:'assessment-code-next'}});
 assert.equal(calls.length,0);assert.match(dialog.description,/предыдущий лучший результат/);assert.match(dialog.body,/Перейти с предыдущим результатом/);
 await context.assessmentHandleAction({dataset:{action:'assessment-code-leave',attemptId:'a',id:'q0'}});
 assert.equal(calls.length,1);assert.equal(calls[0].body.questionId,'q0');
 context.assessmentAccept(attempt(1,'print(3)'));
 await context.assessmentHandleAction({dataset:{action:'assessment-code-leave',attemptId:'a',id:'q0'}});assert.equal(calls.length,1);
 // Latest local editor value wins over the last autosaved draft.
 context.app.querySelector=selector=>selector==='[name="assessmentCode"]'?{value:'print(1)'}:null;
 await context.assessmentCodeNext();assert.equal(calls.length,2,'unchanged judged code closes without another warning');
});

test('exam preserves timer and elimination focus, while a new question gets its heading without the old cursor',()=>{
 const {context}=render(base);let focused,selection;
 context.document.activeElement={dataset:{action:'assessment-toggle-timer'}};
 const elements=new Map();context.app.querySelector=selector=>elements.get(selector)||null;
 const target=selector=>elements.set(selector,{focus:()=>{focused=selector;},setSelectionRange:(...range)=>{selection=range;}});
 target('[data-action="assessment-toggle-timer"]');target('[data-action="assessment-eliminate"][data-index="2"]');target('[name="assessmentCode"]');target('#assessment-question-title');
 context.assessmentRestoreExamFocus(context.assessmentExamFocusSnapshot(),false);assert.equal(focused,'[data-action="assessment-toggle-timer"]');
 context.document.activeElement={dataset:{action:'assessment-eliminate',index:'2'}};
 context.assessmentRestoreExamFocus(context.assessmentExamFocusSnapshot(),false);assert.equal(focused,'[data-action="assessment-eliminate"][data-index="2"]');
 context.document.activeElement={name:'assessmentCode',selectionStart:8,selectionEnd:12};const snapshot=context.assessmentExamFocusSnapshot();
 context.assessmentRestoreExamFocus(snapshot,false);assert.deepEqual(selection,[8,12]);selection=null;
 context.assessmentRestoreExamFocus(snapshot,true);assert.equal(focused,'#assessment-question-title');assert.equal(selection,null,'cursor offsets belong only to the previous question');
 context.overlay={firstElementChild:{}};focused=null;context.assessmentRestoreExamFocus(snapshot,true);assert.equal(focused,null,'an open dialog keeps focus');
 const html=context.assessmentQuestionMarkup({prompt:'Сколько строк?'},'sql');assert.match(html,/aria-describedby="assessment-question-position"/);
});

test('submission budget and best-result policy are disclosed before accepting the test rules',async()=>{
 const {context}=render(base);context.location.hash='#tests/start/backend';context.title=()=>'';context.render=()=>{};
 context.api=async()=>({preparation:{targetId:'backend',day:{moduleConfigs:{}}}});
 await context.assessmentLoadPreparation({id:'backend'});const html=context.assessmentTestsPage();
 assert.ok(html.indexOf('3 отправки')<html.indexOf('name="accepted"'));assert.match(html,/лучший результат/);assert.match(html,/не расходуют отправки/);
});

test('coding grading announces the latest and retained best result once, without announcing saves or stale questions',async()=>{
 const {context}=render(base),announcements=[];let restored=0;
 const status={set textContent(value){announcements.push(value);}};
 const submit={dataset:{action:'assessment-code-submit'},focus(){restored++;context.document.activeElement=submit;}};
 context.document.activeElement=submit;
 context.clearTimeout=()=>{};context.render=()=>{context.document.activeElement=null;};context.toast=()=>{};
 context.app={querySelector:selector=>selector==='#assessment-submission-status'?status:selector==='[data-action="assessment-code-submit"]'?submit:null};
 const attempt=(submission,id='code')=>({id:'attempt',status:'active',revision:submission.used,currentModule:{id:'python',questionIndex:0,answers:{},questions:[{id,format:'coding',coding:{submission}}]}});
 context.assessmentAccept(attempt({used:0,limit:3}));
 context.api=async()=>({assessment:attempt({used:1,limit:3,passed:3,total:4,best:{passed:3,total:4}})});
 await context.assessmentRun('assessment-submit-code',{questionId:'code'});
 assert.equal(restored,1);assert.equal(context.document.activeElement,submit);
 assert.equal(announcements.length,1);assert.match(announcements[0],/Последняя отправка: 3 из 4\. В зачёт: 3 из 4\. Осталось отправок: 2/);
 context.api=async()=>({assessment:attempt({used:2,limit:3,passed:1,total:4,best:{passed:3,total:4}})});
 await context.assessmentRun('assessment-submit-code',{questionId:'code'});
 assert.equal(announcements.length,2);assert.match(announcements[1],/Последняя отправка: 1 из 4\. В зачёт: 3 из 4\. Осталось отправок: 1/);
 // Resume/re-render does not repeat the grading announcement, and normal autosave remains silent.
 await context.assessmentRun('assessment-resume');assert.equal(announcements.length,2);
 context.assessmentQueueDraft();await context.assessmentFlushDraft();assert.equal(announcements.length,2);
 assert.equal(context.assessmentDraftStatus(),'');
 // A late result for the closed question cannot announce feedback on its successor.
 context.api=async()=>({assessment:attempt({used:0,limit:3},'next-code')});
 const beforeRestore=restored;
 await context.assessmentRun('assessment-submit-code',{questionId:'code'});assert.equal(announcements.length,2);
 assert.equal(restored,beforeRestore);
 const html=context.assessmentCodingRing({used:2,limit:3,passed:1,total:4,results:[true,false,false,false]});
 assert.ok(html.includes('Последняя:'));assert.ok(html.includes('1/4'));
});
