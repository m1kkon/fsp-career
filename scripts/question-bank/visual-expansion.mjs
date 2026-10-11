import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
export function addVisualTasks(definitions){
 const html=[
  ['email-label',1,'Создайте форму: label «Почта» связан через for=email с обязательным input type=email, id=email, name=email. Добавьте button type=submit «Отправить».','<form><label for="email">Почта</label><input type="email" id="email" name="email" required><button type="submit">Отправить</button></form>'],
  ['image-caption',1,'Разметьте figure с img src=chart.png и alt="Продажи", затем figcaption «Продажи за год».','<figure><img src="chart.png" alt="Продажи"><figcaption>Продажи за год</figcaption></figure>'],
  ['ordered-navigation',1,'Создайте nav с aria-label="Разделы". Внутри ol с двумя li: ссылки href=#overview «Обзор» и href=#settings «Настройки».','<nav aria-label="Разделы"><ol><li><a href="#overview">Обзор</a></li><li><a href="#settings">Настройки</a></li></ol></nav>'],
  ['status-live-region',1,'Создайте section с h2 «Загрузка», p role=status aria-live=polite «Готово» и button type=button «Повторить».','<section><h2>Загрузка</h2><p role="status" aria-live="polite">Готово</p><button type="button">Повторить</button></section>'],
  ['table-row-headers',2,'Разметьте table с caption «Баллы», thead: th scope=col «Навык», «Балл»; tbody: th scope=row «SQL», td «80».','<table><caption>Баллы</caption><thead><tr><th scope="col">Навык</th><th scope="col">Балл</th></tr></thead><tbody><tr><th scope="row">SQL</th><td>80</td></tr></tbody></table>'],
  ['select-associated-label',2,'Форма: label for=language «Язык», select id=language name=language с option value=python «Python» и value=sql «SQL», button type=submit «Выбрать».','<form><label for="language">Язык</label><select id="language" name="language"><option value="python">Python</option><option value="sql">SQL</option></select><button type="submit">Выбрать</button></form>'],
  ['fieldset-checkboxes',2,'Создайте fieldset с legend «Навыки» и двумя label, каждый содержит checkbox name=skills: value=python «Python» и value=sql «SQL».','<fieldset><legend>Навыки</legend><label><input type="checkbox" name="skills" value="python">Python</label><label><input type="checkbox" name="skills" value="sql">SQL</label></fieldset>'],
  ['details-disclosure',2,'Создайте details: summary «Правила», затем p «Три попытки». После details разместите a href=#test «К тесту».','<details><summary>Правила</summary><p>Три попытки</p></details><a href="#test">К тесту</a>'],
  ['validation-description',3,'Форма: label for=age «Возраст»; input type=number id=age name=age min=18 max=65 required aria-describedby=age-help; p id=age-help «От 18 до 65»; button type=submit «Сохранить».','<form><label for="age">Возраст</label><input type="number" id="age" name="age" min="18" max="65" required aria-describedby="age-help"><p id="age-help">От 18 до 65</p><button type="submit">Сохранить</button></form>'],
  ['breadcrumb-current',3,'Создайте nav aria-label="Путь" с ol. Первый li содержит a href=/ «Главная», второй a href=/tests «Тесты», третий span aria-current=page «SQL».','<nav aria-label="Путь"><ol><li><a href="/">Главная</a></li><li><a href="/tests">Тесты</a></li><li><span aria-current="page">SQL</span></li></ol></nav>'],
  ['textarea-length-contract',3,'Форма: label for=message «Сообщение», textarea id=message name=message minlength=10 maxlength=200 required rows=4, button type=submit «Отправить».','<form><label for="message">Сообщение</label><textarea id="message" name="message" minlength="10" maxlength="200" required rows="4"></textarea><button type="submit">Отправить</button></form>'],
  ['progress-semantic-range',3,'В section поместите h2 «Проверка», label for=progress «Прогресс», progress id=progress value=3 max=5 с текстом «3 из 5», p «Выполнено 60%».','<section><h2>Проверка</h2><label for="progress">Прогресс</label><progress id="progress" value="3" max="5">3 из 5</progress><p>Выполнено 60%</p></section>'],
 ];
 definitions.browser??=[];
 for(const[id,difficulty,prompt,source]of html)definitions.browser.push({id,difficulty,prompt:prompt+' Сохраните указанный порядок и вложенность. Дополнительные атрибуты допустимы.',language:'html',input:'Ввод отсутствует; требования к разметке заданы в условии.',output:'HTML-фрагмент. Проверяются структура, текст и перечисленные атрибуты.',source,competence:0,tests:[{stdin:'',expected:source,markupRule:'dom-attributes',public:true}]});
 const css=[
  ['flex-wrap',1,'.chips',{display:'flex','flex-wrap':'wrap',gap:'8px','align-items':'center','justify-content':'flex-start'}],
  ['border-box-card',1,'.card',{'box-sizing':'border-box',width:'240px',padding:'16px',border:'1px solid black','min-height':'80px'}],
  ['image-fit',1,'.image',{width:'100%',height:'160px','object-fit':'cover',display:'block','border-radius':'8px'}],
  ['text-ellipsis',1,'.title',{overflow:'hidden','text-overflow':'ellipsis','white-space':'nowrap','max-width':'240px',display:'block'}],
  ['grid-minmax',2,'.gallery',{display:'grid','grid-template-columns':'repeat(2,minmax(0,1fr))',gap:'16px','align-items':'start','min-width':'0'}],
  ['sticky-heading',2,'.heading',{position:'sticky',top:'0','z-index':'10','background-color':'white',padding:'12px'}],
  ['absolute-badge',2,'.badge',{position:'absolute',top:'8px',right:'8px','z-index':'2','pointer-events':'none'}],
  ['keyboard-focus',2,'.button:focus-visible',{outline:'2px solid blue','outline-offset':'3px','border-radius':'4px','background-color':'white',color:'black'}],
  ['responsive-sidebar',3,'.shell',{display:'grid','grid-template-columns':'200px 1fr',gap:'24px','min-width':'0','align-items':'start'}, {'grid-template-columns':'1fr',gap:'12px'}],
  ['responsive-flex-direction',3,'.actions',{display:'flex','flex-direction':'row',gap:'16px','align-items':'center','justify-content':'space-between'},{'flex-direction':'column','align-items':'stretch'}],
  ['responsive-grid-count',3,'.results',{display:'grid','grid-template-columns':'repeat(4,1fr)',gap:'12px','min-width':'0','align-items':'stretch'},{'grid-template-columns':'repeat(2,1fr)',gap:'8px'}],
  ['responsive-reading-size',3,'.reading',{'font-size':'20px','line-height':'1.5','max-width':'720px',margin:'0 auto',padding:'24px'},{'font-size':'18px',padding:'12px'}],
 ];
 for(const[id,difficulty,selector,props,narrow]of css){
  const decl=p=>Object.entries(p).map(([k,v])=>k+':'+v+';').join('');
  const source=selector+'{'+decl(props)+'}'+(narrow?'@media(max-width:600px){'+selector+'{'+decl(narrow)+'}}':'');
  const cases=Object.entries(props).map(([k,v],i)=>({stdin:'',expected:JSON.stringify({selector,width:800,properties:{[k]:v}}),markupRule:'css-properties',public:i===0}));
  if(narrow)cases.push({stdin:'',expected:JSON.stringify({selector,width:600,properties:{...props,...narrow}}),markupRule:'css-properties',public:false},{stdin:'',expected:JSON.stringify({selector,width:601,properties:props}),markupRule:'css-properties',public:false});
  definitions.browser.push({id,difficulty,competence:1,prompt:'Напишите CSS. Для '+selector+' задайте '+JSON.stringify(props)+'.'+(narrow?' При ширине окна <=600px измените свойства на '+JSON.stringify(narrow)+', остальные сохраните.':'')+' Используйте указанные свойства и значения без сокращений.',language:'css',input:'Ввод отсутствует; селектор и свойства перечислены в условии.',output:'CSS-правила. Проверяется каскад и значения отдельных свойств.',source,tests:cases,example:source});
 }
 const rows=[[],[{id:1,title:'A',active:true,score:0,group:'a',selected:false}], [{id:3,title:'<x>',active:false,score:2,group:'b',selected:true},{id:1,title:'B',active:true,score:2,group:'a',selected:false},{id:2,title:'&',active:true,score:5,group:'b',selected:true}], [{id:0,title:'',active:false,score:-2,group:'a',selected:false}], [{id:4,title:'Z',active:true,score:1,group:'a',selected:true},{id:5,title:'Y',active:true,score:1,group:'a',selected:false}]];
 const ops=[
  ['title-list',1,'ul: li с title каждой строки.',a=>a.map(r=>r.title),'rows.map(r=>r.title)'],
  ['active-title-list',1,'ul: li с title только active=true.',a=>a.filter(r=>r.active).map(r=>r.title),'rows.filter(r=>r.active).map(r=>r.title)'],
  ['selected-title-list',1,'ul: li с title только selected=true.',a=>a.filter(r=>r.selected).map(r=>r.title),'rows.filter(r=>r.selected).map(r=>r.title)'],
  ['empty-state',1,'p с текстом «Нет данных» для пустого массива, иначе p с числом записей.',a=>String(a.length||'Нет данных'),'[String(rows.length||"Нет данных")]','p'],
  ['active-counter',1,'p с числом активных строк.',a=>String(a.filter(r=>r.active).length),'[String(rows.filter(r=>r.active).length)]','p'],
  ['titles-fallback',1,'ul: li с title; пустой title замените на «Без названия».',a=>a.map(r=>r.title||'Без названия'),'rows.map(r=>r.title||"Без названия")'],
  ['score-list',1,'ol: li со score каждой строки.',a=>a.map(r=>String(r.score)),'rows.map(r=>String(r.score))','ol'],
  ['reverse-view',1,'ul: title в обратном порядке. Не изменяйте входной массив.',a=>[...a].reverse().map(r=>r.title),'[...rows].reverse().map(r=>r.title)'],
  ['stable-score-sort',2,'ol: title по убыванию score, при равенстве по id.',a=>[...a].sort((a,b)=>b.score-a.score||a.id-b.id).map(r=>r.title),'[...rows].sort((a,b)=>b.score-a.score||a.id-b.id).map(r=>r.title)','ol'],
  ['distinct-group-options',2,'select aria-label="Группа": option value=group с group по алфавиту без повторов.',a=>[...new Set(a.map(r=>r.group))].sort(),'[...new Set(rows.map(r=>r.group))].sort()','select'],
  ['unique-titles',2,'ul: первые вхождения различных title, сохраняя порядок.',a=>[...new Set(a.map(r=>r.title))],'[...new Set(rows.map(r=>r.title))]'],
  ['positive-active-titles',2,'ul: title только active=true и score>0.',a=>a.filter(r=>r.active&&r.score>0).map(r=>r.title),'rows.filter(r=>r.active&&r.score>0).map(r=>r.title)'],
  ['top-two-selected',2,'ul: первые две selected=true строки, их title.',a=>a.filter(r=>r.selected).slice(0,2).map(r=>r.title),'rows.filter(r=>r.selected).slice(0,2).map(r=>r.title)'],
  ['score-summary',2,'p: сумма score активных строк.',a=>String(a.filter(r=>r.active).reduce((s,r)=>s+r.score,0)),'[String(rows.filter(r=>r.active).reduce((s,r)=>s+r.score,0))]','p'],
  ['group-a-score-sort',2,'ol: title group=a по score по возрастанию, затем id.',a=>a.filter(r=>r.group==='a').sort((a,b)=>a.score-b.score||a.id-b.id).map(r=>r.title),'rows.filter(r=>r.group==="a").sort((a,b)=>a.score-b.score||a.id-b.id).map(r=>r.title)','ol'],
  ['selection-ratio',2,'p: selected/total в виде «X/Y», для пустого «0/0».',a=>a.filter(r=>r.selected).length+'/'+a.length,'[rows.filter(r=>r.selected).length+"/"+rows.length]','p'],
  ['group-aggregate-view',3,'ul: «group:sum» для каждой группы, группы по алфавиту.',a=>[...new Set(a.map(r=>r.group))].sort().map(g=>g+':'+a.filter(r=>r.group===g).reduce((s,r)=>s+r.score,0)),'[...new Set(rows.map(r=>r.group))].sort().map(g=>g+":"+rows.filter(r=>r.group===g).reduce((s,r)=>s+r.score,0))'],
  ['dense-rank-view',3,'ol: «id:rank» во входном порядке. Rank=1 у максимального score, одинаковые score имеют один ранг без пропусков.',a=>a.map(r=>r.id+':'+([...new Set(a.map(r=>r.score))].sort((a,b)=>b-a).indexOf(r.score)+1)),'rows.map(r=>r.id+":"+([...new Set(rows.map(r=>r.score))].sort((a,b)=>b-a).indexOf(r.score)+1))','ol'],
  ['group-winner-view',3,'ul: title лучшей строки каждой группы. Максимум score, затем минимум id; группы по алфавиту.',a=>[...new Set(a.map(r=>r.group))].sort().map(g=>a.filter(r=>r.group===g).sort((a,b)=>b.score-a.score||a.id-b.id)[0].title),'[...new Set(rows.map(r=>r.group))].sort().map(g=>rows.filter(r=>r.group===g).sort((a,b)=>b.score-a.score||a.id-b.id)[0].title)'],
  ['running-score-view',3,'ol: накопительные суммы score во входном порядке.',a=>a.map((_,i)=>String(a.slice(0,i+1).reduce((s,r)=>s+r.score,0))),'rows.map((_,i)=>String(rows.slice(0,i+1).reduce((s,r)=>s+r.score,0)))','ol'],
  ['group-selection-completeness',3,'ul: «group:all» или «group:partial» или «group:none» по selected. Группы по алфавиту.',a=>[...new Set(a.map(r=>r.group))].sort().map(g=>{const r=a.filter(r=>r.group===g);return g+':'+(r.every(x=>x.selected)?'all':r.some(x=>x.selected)?'partial':'none');}),'[...new Set(rows.map(r=>r.group))].sort().map(g=>{const r=rows.filter(r=>r.group===g);return g+":"+(r.every(x=>x.selected)?"all":r.some(x=>x.selected)?"partial":"none")})'],
  ['sorted-page-two',3,'ol: вторая страница размера 2 после сортировки score по убыванию, затем id. Выведите title.',a=>[...a].sort((a,b)=>b.score-a.score||a.id-b.id).slice(2,4).map(r=>r.title),'[...rows].sort((a,b)=>b.score-a.score||a.id-b.id).slice(2,4).map(r=>r.title)','ol'],
  ['group-above-mean',3,'ul: title строк со score строго больше среднего своей группы, во входном порядке.',a=>a.filter(r=>{const group=a.filter(x=>x.group===r.group);return r.score>group.reduce((s,r)=>s+r.score,0)/group.length;}).map(r=>r.title),'rows.filter(r=>{const group=rows.filter(x=>x.group===r.group);return r.score>group.reduce((s,r)=>s+r.score,0)/group.length}).map(r=>r.title)'],
  ['adjacent-group-headings',3,'ul: group только в начале каждого непрерывного блока одинаковых group. Порядок сохраняется.',a=>a.filter((r,i)=>i===0||r.group!==a[i-1].group).map(r=>r.group),'rows.filter((r,i)=>i===0||r.group!==rows[i-1].group).map(r=>r.group)'],
 ];
 for(const[id,difficulty,prompt,oracle,expr,tag='ul']of ops){
  const render=values=>renderToStaticMarkup(React.createElement(tag,tag==='select'?{'aria-label':'Группа'}:null,...(tag==='p'?[values]:values.map(v=>React.createElement(tag==='select'?'option':'li',tag==='select'?{value:v}:null,v)))));
  const source='export default function Task({rows}){const values='+expr+'; return '+(tag==='p'?'<p>{values[0]}</p>':tag==='select'?'<select aria-label="Группа">{values.map(v=><option key={v} value={v}>{v}</option>)}</select>':'<'+tag+'>{values.map((v,i)=><li key={i}>{v}</li>)}</'+tag+'>')+';}';
  definitions.react??=[];definitions.react.push({id,difficulty,prompt:'Реализуйте экспортируемый по умолчанию React-компонент Task({rows}). '+prompt+' Не добавляйте другие элементы. Спецсимволы должны оставаться текстом.',input:'JSON-объект {rows:[{id:уникальное целое,title:строка,active:boolean,score:целое,group:ASCII-строка,selected:boolean}]}. Передаётся как props; длина 0..200.',output:'HTML React-компонента с указанной структурой и текстом. Для списка каждый элемент — отдельный li.',language:'react',source,inputs:rows.map(rows=>({rows})),oracle:x=>render(oracle(x.rows)),markupRule:'dom-attributes',competence:difficulty===1?0:2});
 }
 // Avoid duplicating the original bank's active-list filter family.
 const classes=definitions.react.find(t=>t.id==='active-title-list');
 classes.id='active-state-classes';classes.prompt='Реализуйте React-компонент Task({rows}): ul с li каждой строки во входном порядке. Текст li равен title; class равен active при active=true, иначе inactive. Не добавляйте другие элементы; title отображается как текст.';
 classes.source='export default function Task({rows}){return <ul>{rows.map(r=><li key={r.id} className={r.active?"active":"inactive"}>{r.title}</li>)}</ul>}';
 classes.oracle=x=>renderToStaticMarkup(React.createElement('ul',null,...x.rows.map(r=>React.createElement('li',{className:r.active?'active':'inactive'},r.title))));
}
