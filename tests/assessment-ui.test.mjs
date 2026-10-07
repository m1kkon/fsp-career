import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/assessments.js',import.meta.url),'utf8');
const base={modules:[{id:'python',name:'Python'},{id:'sql',name:'SQL'},{id:'integration-backend',name:'Интеграция',integration:true}],roles:[{id:'backend',name:'Backend Developer',modules:['python','sql'],integration:'integration-backend'}],history:[],hiddenHistory:[],registrations:[],specifications:[],days:[]};
const result=(moduleId,score,completedAt)=>({moduleId,score,completedAt});
const skill=(id,created,score,completedAt)=>({id,created,status:'finished',targetKind:'skill',targetId:'python',results:[result('python',score,completedAt)]});
function render(config){const context={state:{assessment:config},page:'tests',setInterval:()=>{},document:{addEventListener:()=>{}},esc:String,button:()=>'',date:String,icon:()=>'<svg></svg>'};runInNewContext(source,context);return {latest:context.assessmentLatestResults(config),html:context.assessmentTestsPage(),context};}

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

const bookingTime=Date.parse('2026-10-06T10:00:00Z');
function session(id,ids,date='2026-10-06T16:00:00Z'){
 const opensAt=Date.parse(date);return {id,name:id,opensAt,closesAt:opensAt+7200000,breakSeconds:60,moduleConfigs:Object.fromEntries(ids.map(id=>[id,{seconds:640,adaptive:true}]))};
}
function bookingContext(config){const {context}=render(config);context.Date=class extends Date{constructor(...args){super(...(args.length?args:[bookingTime]));}static now(){return bookingTime;}};return context;}

test('calendar shows fourteen Monday-aligned Moscow dates across month and year boundaries',()=>{
 const context=bookingContext(base);assert.equal(context.assessmentCalendarStart(Date.parse('2026-10-06T22:00:00Z')),'2026-10-05');assert.equal(context.assessmentDateKey(Date.parse('2026-10-06T22:00:00Z')),'2026-10-07');
 const dates=context.assessmentCalendarDates('2026-12-28');assert.equal(dates.length,14);assert.equal(dates[0],'2026-12-28');assert.equal(dates[13],'2027-01-10');assert.equal(new Set(dates).size,14);
});

test('role dates require the full adaptive module composition, enough remaining time and a future or current date',()=>{
 const full=session('full',['python','sql','integration-backend']),partial=session('partial',['python','sql']);
 const legacy=session('legacy',['python','sql','integration-backend']);legacy.moduleConfigs.sql.adaptive=false;
 const short=session('short',['python','sql','integration-backend']);short.closesAt=short.opensAt+1800000;
 const yesterday=session('yesterday',['python','sql','integration-backend'],'2026-10-05T16:00:00Z');yesterday.closesAt=bookingTime+86400000;
 const config={...base,days:[full,partial,legacy,short,yesterday]},context=bookingContext(config);
 const model=context.assessmentBookingModel(config,{kind:'role',targetId:'backend',start:'2026-10-05',date:'2026-10-06',dayId:'full'},bookingTime);
 assert.equal(model.days.length,14);assert.equal(model.days[0].past,true);assert.equal(model.days[0].sessions.length,0);assert.deepEqual(JSON.parse(JSON.stringify(model.days[1].sessions.map(s=>s.id))),['full']);assert.equal(model.selected.id,'full');
 assert.equal(context.assessmentBookingModel(config,{kind:'role',targetId:'backend',start:'2026-10-05',date:'2026-10-06',dayId:'partial'},bookingTime).selected,null);
 assert.equal(context.assessmentBookingModel(config,{kind:'skill',targetId:'integration-backend',start:'2026-10-05'},bookingTime).sessions.length,0);
});

test('booking submit uses the selected real session and updates or clears it after role and calendar changes',async()=>{
 const config={...base,days:[session('python-slot',['python']),session('role-slot',['python','sql','integration-backend'],'2026-10-06T17:00:00Z')]},context=bookingContext(config),calls=[];
 context.overlay={querySelector:()=>({classList:{add:()=>{}},scrollTop:0})};context.modal=()=>{};context.assessmentBookingRender=()=>{};context.mutate=async body=>calls.push(body);
 const error={textContent:''},form={id:'assessment-book-form',querySelector:()=>error};
 context.assessmentBook();await context.assessmentHandleSubmit(form,{});assert.equal(calls.length,0);assert.ok(error.textContent.includes('Выберите доступную дату'));
 await context.assessmentHandleAction({dataset:{action:'assessment-book-date',date:'2026-10-06'}});await context.assessmentHandleSubmit(form,{});
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{action:'assessment-register',targetId:'python',dayId:'python-slot'});
 await context.assessmentHandleAction({dataset:{action:'assessment-book-kind',kind:'role'}});await context.assessmentHandleSubmit(form,{});
 assert.deepEqual(JSON.parse(JSON.stringify(calls[1])),{action:'assessment-register',targetId:'backend',dayId:'role-slot'});
 await context.assessmentHandleAction({dataset:{action:'assessment-book-weeks',shift:'14'}});await context.assessmentHandleSubmit(form,{});assert.equal(calls.length,2);
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
