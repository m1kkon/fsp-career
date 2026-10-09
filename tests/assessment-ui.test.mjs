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
function render(config){const context={location:{hash:''},state:{assessment:config},page:'tests',setInterval:()=>{},document:{addEventListener:()=>{}},esc:String,button:()=>'',date:String,icon:()=>'<svg></svg>'};runInNewContext(source,context);return {latest:context.assessmentLatestResults(config),html:context.assessmentTestsPage(),context};}

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
 const html=context.assessmentTestsPage();assert.ok(html.includes('value="Senior" checked'));assert.ok(html.includes('name="accepted" required checked'));
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
