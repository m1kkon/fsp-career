export const ADDITIONAL_CASES={
 'positive-count':[[[-1,-2,-3],0],[[1,-1,2,0,3,4],4]],
 reverse:[[[1,1,2,-3],[-3,2,1,1]]],
 frequencies:[],
 runs:[[[2,2,2,3,3],3],[[1,2,2,2],3]],
 intervals:[[[[1,10],[2,3],[10,12],[-5,-2]], [[-5,-2],[1,12]]],[[[4,4],[2,2],[4,4]],[[2,2],[4,4]]]],
 balanced:[['(((',false],['{}[()]',true]],
 lengths:[[[' ','a\n','12345'],[1,2,5]]],
 active:[[[{id:9,active:false},{id:8,active:false}],[]]],
 'group-sum':[[[{group:'__proto__',value:2},{group:'constructor',value:3},{group:'__proto__',value:-1}],JSON.parse('{"__proto__":1,"constructor":3}')],[[{group:'a',value:0},{group:'b',value:-2}],{a:0,b:-2}]],
 unique:[[[5,-2,5,0,-2], [5,-2,0]]],
 flatten:[[[1,[],[2,[],[3,4]],5],[1,2,3,4,5]]],
 topological:[[{nodes:[8,2,5,1],edges:[[1,2],[1,2],[2,5]]},[1,2,5,8]],[{nodes:[1,2],edges:[[1,1]]},null]],
 range:[[[-10,-2,0,7],17]],median:[[[7],7],[[9,-1,-1,5],2]],
 'population-variance':[[[-2,0,2],2.6667],[[7],0]],
 'weighted-mean':[[[{value:-2,weight:2},{value:8,weight:1}],1.3333]],
 correlation:[[{x:[1,2,3],y:[1,0,1]},0],[{x:[1,2],y:[4,4]},null]],
 bootstrap:[[{values:[-1,2,8],samples:[[2,2],[0,1,2],[1]]},[8,3,2]]],
 accuracy:[[{y:[0,1,0,1],pred:[0,0,1,1]},0.5],[{y:[1],pred:[1]},1]],
 threshold:[[{probabilities:[0,0.4,1],threshold:0.4},[0,1,1]],[{probabilities:[0,1],threshold:0},[1,1]]],
 precision:[[{y:[0,0],pred:[1,1]},0],[{y:[1,1,0],pred:[1,1,0]},1]],
 mse:[[{y:[-1,0,1],pred:[1,0,-1]},2.6667]],
 nearest:[[{points:[[1,1],[-1,-1],[0,3]],labels:['first','second','third'],query:[0,0]},'first']],
 'gradient-step':[[{x:[-1,2],y:[2,1],w:1,lr:0.25},-0.25]],
 boundaries:[[{min:-2,max:1},[-3,-2,-1,0,1,2]]],
 classes:[[[false,18.0,65.0,-1,30.1],['invalid','valid','valid','invalid','invalid']]],
 'decision-table':[[[{active:true,admin:false,paid:false},{active:true,admin:true,paid:false},{active:true,admin:false,paid:true},{active:false,admin:false,paid:false}], [false,true,true,false]]],
 coverage:[[{required:['x','x','y','z'],covered:['x','z','extra']},['y']]],
 'transition-oracle':[[['bad','open','close','close'],{state:'closed',invalid:[0,3]}]],
 'pair-coverage':[[[[true,false,true],[true,false,true]],3]],
 errors:[['XERROR wrong\nERROR one\nERROR \nERROR last','one\n\nlast']],
 'line-count':[['first\n \n\nlast','3']],
 'status-count':[['499 /\n500 /a\n599 /b\n600 /c\n','2']],
 'unique-hosts':[['z\na\nZ\na','Z\na\nz']],
 'aggregate-by-service':[['z 0\na -1\na 2\nz 4','a 1\nz 4']],
 'percent-errors':[['a 500\na 200\nb 599\nb 599\nb 400\nc 600\n','b']],
 filter:[['CREATE TABLE items(id int,value int); INSERT INTO items VALUES(9,10),(8,11),(2,-1),(1,99);','1\n8']],
 'null-count':[['CREATE TABLE events(id int,user_id int); INSERT INTO events VALUES(1,0),(2,-1);','0']],
 aggregate:[['CREATE TABLE orders(id int,customer_id int,amount int); INSERT INTO orders VALUES(1,3,100),(2,2,101),(3,1,200),(4,1,-100),(5,2,0);','2|101']],
 'left-join':[['CREATE TABLE users(id int); CREATE TABLE orders(id int,user_id int); INSERT INTO users VALUES(3),(1); INSERT INTO orders VALUES(1,3),(2,3),(3,99);','1|0\n3|2']],
 rank:[['CREATE TABLE scores(id int,team int,score int); INSERT INTO scores VALUES(9,2,0),(8,2,1),(3,1,-2),(1,1,-2);','1\n8']],
 'running-total':[['CREATE TABLE payments(id int,amount int); INSERT INTO payments VALUES(4,3),(1,0),(2,3),(3,-6);','1|0\n2|3\n3|-3\n4|0']]
};
// Own-property JSON key, not the special object-literal __proto__ setter.
ADDITIONAL_CASES.frequencies=[[['__proto__','constructor','__proto__',''],JSON.parse('{"__proto__":2,"constructor":1,"":1}')]];
export const REFERENCE_PROGRAMS={
 intervals:'result=[]\nfor start,end in sorted(data):\n    if result and start<=result[-1][1]:\n        result[-1][1]=max(result[-1][1],end)\n    else:\n        result.append([start,end])\nprint(json.dumps(result))',
 balanced:'stack=[]\nok=True\nfor c in data:\n    if c in "([{": stack.append(c)\n    elif not stack or "([{\".index(stack.pop())!=")]}\".index(c):\n        ok=False\n        break\nprint(json.dumps(ok and not stack))',
 topological:'const incoming=new Map(data.nodes.map(n=>[n,0]));const edges=new Map(data.nodes.map(n=>[n,new Set()]));for(const [a,b] of data.edges)edges.get(a).add(b);for(const next of edges.values())for(const b of next)incoming.set(b,incoming.get(b)+1);const result=[];while(result.length<data.nodes.length){const ready=data.nodes.filter(n=>incoming.get(n)===0&&!result.includes(n)).sort((a,b)=>a-b);if(!ready.length)break;const n=ready[0];result.push(n);for(const b of edges.get(n))incoming.set(b,incoming.get(b)-1);}console.log(JSON.stringify(result.length===data.nodes.length?result:null));',
 correlation:'x,y=data["x"],data["y"]\na=[v-sum(x)/len(x) for v in x]\nb=[v-sum(y)/len(y) for v in y]\nd=(sum(v*v for v in a)*sum(v*v for v in b))**0.5\nprint(json.dumps(round(sum(u*v for u,v in zip(a,b))/d,4) if d else None))',
 'transition-oracle':'state="closed"\ninvalid=[]\nfor i,event in enumerate(data):\n    if event=="open" and state=="closed": state="open"\n    elif event=="close" and state=="open": state="closed"\n    else: invalid.append(i)\nprint(json.dumps({"state":state,"invalid":invalid}))'
};
const rules={search:['search-field','search-label','search-submit'],fieldset:['plan-title','plan-basic','plan-pro'],validation:['registration-email','registration-password','registration-submit'],flex:['toolbar-display','toolbar-gap','toolbar-align'],grid:['cards-display','cards-columns','cards-gap'],responsive:['layout-wide','layout-narrow']};
const dom=(props,expected,i)=>({stdin:props?JSON.stringify(props):'',expected,markupRule:'dom',public:i===0});
export function reviewedCodingTask(task,group){
 const t=structuredClone(task);
 if(t.id==='unique-hosts')t.prompt+=' Имена содержат ASCII; порядок определяется LC_ALL=C.';
 if(t.id==='aggregate-by-service'||t.id==='percent-errors')t.prompt+=' Имена сервисов содержат ASCII, сортировка LC_ALL=C.';
 if(t.cases){t.cases.push(...(ADDITIONAL_CASES[t.id]||[]));t.cases=t.cases.slice(0,5);}
 if(t.id==='group-sum')t.solution='data.reduce((r,x)=>(r[x.group]=(r[x.group]||0)+x.value,r),Object.create(null))';
 if(t.id==='classes'){t.prompt+=' Число 18.0 считается целым; null и строки недопустимы.';}
 if(t.id==='classes')t.solution='["valid" if type(x) in (int,float) and x==int(x) and 18<=x<=65 else "invalid" for x in data]';
 if(REFERENCE_PROGRAMS[t.id])t.program=REFERENCE_PROGRAMS[t.id];
 if(group==='browser'){t.tests=rules[t.id].map((markupRule,i)=>({stdin:'',markupRule,public:i===0}));delete t.contains;}
 if(group==='react'){
  if(t.id==='heading'){t.tests=[dom(null,'<h1>Навыки</h1>',0)];t.program='export default function Task(){return <h1>Навыки</h1>}';}
  if(t.id==='list'){t.tests=[dom(null,'<ul><li>Python</li><li>SQL</li></ul>',0)];t.program='export default function Task(){return <ul><li>Python</li><li>SQL</li></ul>}';}
  if(t.id==='filter'){
   t.prompt='Компонент по умолчанию принимает props.items — массив {name,active}. Отобразите в ul только активные навыки, каждый в li, сохранив порядок.';
   t.tests=[[{items:[{name:'Python',active:true},{name:'SQL',active:false}]},'<ul><li>Python</li></ul>'],[{items:[]},'<ul></ul>'],[{items:[{name:'React',active:false},{name:'HTML',active:true},{name:'CSS',active:true}]},'<ul><li>HTML</li><li>CSS</li></ul>']].map(([p,e],i)=>dom(p,e,i));
   t.program='export default function Task({items}){return <ul>{items.filter(x=>x.active).map((x,i)=><li key={i}>{x.name}</li>)}</ul>}';
  }
  if(t.id==='empty'){
   t.prompt='Компонент по умолчанию принимает props.items — массив строк (по умолчанию []). Для пустого массива верните <p>Нет данных</p>, иначе ul с каждой строкой в li в исходном порядке.';
   t.tests=[[{},'<p>Нет данных</p>'],[{items:['Python','SQL']},'<ul><li>Python</li><li>SQL</li></ul>'],[{items:[]},'<p>Нет данных</p>']].map(([p,e],i)=>dom(p,e,i));
   t.program='export default function Task({items=[]}){return items.length?<ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>Нет данных</p>}';
  }
  if(t.id==='group'){
   t.prompt='Компонент по умолчанию принимает props.items — массив {team,name}. Сгруппируйте навыки: section с h2 команды и ul/li названий. Команды и навыки идут в порядке первого появления. Для пустого массива верните пустой фрагмент.';
   t.tests=[[{items:[{team:'A',name:'Python'},{team:'B',name:'SQL'},{team:'A',name:'React'}]},'<section><h2>A</h2><ul><li>Python</li><li>React</li></ul></section><section><h2>B</h2><ul><li>SQL</li></ul></section>'],[{items:[]},''],[{items:[{team:'Z',name:'CSS'},{team:'A',name:'HTML'}]},'<section><h2>Z</h2><ul><li>CSS</li></ul></section><section><h2>A</h2><ul><li>HTML</li></ul></section>']].map(([p,e],i)=>dom(p,e,i));
   t.program='export default function Task({items}){const groups=new Map();for(const x of items){if(!groups.has(x.team))groups.set(x.team,[]);groups.get(x.team).push(x.name)}return <>{[...groups].map(([team,names])=><section key={team}><h2>{team}</h2><ul>{names.map((n,i)=><li key={i}>{n}</li>)}</ul></section>)}</>}';
  }
  if(t.id==='tree'){
   t.prompt='Компонент по умолчанию принимает props.tree — узел {name,children}. Отобразите корень в ul/li, название узла перед вложенным ul детей. Каждый ребёнок — li; у листа вложенного ul нет. Дети сохраняют порядок.';
   t.tests=[[{tree:{name:'Root',children:[{name:'Python',children:[]},{name:'SQL',children:[]}]}},'<ul><li>Root<ul><li>Python</li><li>SQL</li></ul></li></ul>'],[{tree:{name:'Leaf',children:[]}},'<ul><li>Leaf</li></ul>'],[{tree:{name:'A',children:[{name:'B',children:[{name:'C',children:[]}]}]}},'<ul><li>A<ul><li>B<ul><li>C</li></ul></li></ul></li></ul>']].map(([p,e],i)=>dom(p,e,i));
   t.program='function Node({node}){return <li>{node.name}{node.children.length>0&&<ul>{node.children.map((n,i)=><Node key={i} node={n}/>)}</ul>}</li>}export default function Task({tree}){return <ul><Node node={tree}/></ul>}';
  }
  t.contract={inputFormat:'Для динамического компонента stdin содержит JSON-объект props. Песочница передаёт его компоненту при рендеринге; данные для примера приведены ниже. Для статического компонента stdin пустой.',outputFormat:'Экспортируйте React-компонент по умолчанию. Проверяется структура HTML, порядок элементов и текст после рендеринга. Пробелы в разметке и дополнительные атрибуты несущественны.',examples:[{input:t.tests[0].stdin||'Ввод отсутствует.',output:t.tests[0].expected}]};delete t.contains;
 }
 return t;
}
export function reviewedLegacyCoding(q){
 if(q.moduleId.startsWith('integration-')||['ml','ml-engineering','test-design','automation'].includes(q.moduleId)){
  q=structuredClone(q);q.status='retired';q.version++;q.history.push({at:1791417600000,status:'retired',reason:'Общая практика не проверяла заявленные навыки; заменена профильными заданиями в смешанных частях.'});
 }
 if(!['html','css','react'].includes(q.coding.language)){
  q=structuredClone(q);if(q.status!=='retired')q.version++;
  if(['javascript','typescript'].includes(q.coding.language)||q.coding.language==='python'&&!q.prompt.includes('двумя знаками'))for(const t of q.coding.tests)t.comparison='json';
  if(q.prompt.includes('двумя знаками'))q.coding.tests.push({stdin:'[1,4]',expected:'2.50',public:false},{stdin:'[-1,-2]',expected:'-1.50',public:false});
  if(q.coding.language==='bash')q.coding.tests.push({stdin:'XERROR wrong\nERROR last',expected:'last',public:false});
  if(q.coding.language==='javascript'){q.prompt=q.prompt.replace('JSON-массив из stdin','JSON-массив чисел из stdin');q.coding.tests.push({stdin:'[4,4,0,3,0]',expected:'[4,0,3]',comparison:'json',public:false});}
  q.history.push({at:1791417600000,status:q.status,reason:'Проверены форматы ответа и граничные случаи; JSON сравнивается по значению.'});return q;
 }
 q=structuredClone(q);q.version++;q.reviewRevision='2026-10-08';
 const rule=q.coding.language==='html'?'search':q.coding.language==='css'?'flex':null;
 q.coding.tests=rule?rules[rule].map((markupRule,i)=>({stdin:'',markupRule,public:i===0})):[dom(null,'<ul><li>Python</li><li>SQL</li></ul>',0)];
 q.history.push({at:1791417600000,status:q.status,reason:'Структурная проверка HTML/CSS/React вместо поиска строк.'});return q;
}
