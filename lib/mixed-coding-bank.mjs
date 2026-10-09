import {SCOPED_CODING_TASKS} from './scoped-coding-tasks.mjs';
import {reviewedCodingTask} from './coding-bank-review.mjs';
import {MODULES} from './question-bank.mjs';
import {withCodingContract} from './coding-contract.mjs';
import {mixedCodingContract} from './mixed-coding-contracts.mjs';

// Fixed instances with distinct logic families and reproducible input/output checks.
const row=(id,prompt,cases,solution)=>({id,prompt,cases,solution});
const python=[
 row('positive-count','Выведите количество строго положительных чисел в JSON-массиве.',[[[-2,0,3,5],2],[[],0],[[0,0],0]],'sum(x > 0 for x in data)'),
 row('reverse','Выведите JSON-массив в обратном порядке.',[[[1,2,3],[3,2,1]],[[],[]],[[4],[4]]],'data[::-1]'),
 row('frequencies','Для массива строк выведите JSON-объект: строка → число её появлений.',[[['a','b','a'],{a:2,b:1}],[[],{}],[['x','x','x'],{x:3}]],'{s: data.count(s) for s in dict.fromkeys(data)}'),
 row('runs','Выведите длину самой длинной серии одинаковых соседних элементов; для пустого массива — 0.',[[[1,1,2,2,2,1],3],[[],0],[[3,4,3],1]],"max((sum(1 for _ in g) for _, g in __import__('itertools').groupby(data)), default=0)"),
 row('intervals','Объедините пересекающиеся замкнутые интервалы [start,end]. Выведите интервалы по возрастанию start. Касание границ считается пересечением.',[[[[1,3],[2,5],[8,9]],[[1,5],[8,9]]],[[[5,7],[1,5]],[[1,7]]],[[],[]]],null),
 row('balanced','JSON-строка содержит скобки ()[]{}. Выведите true, если они сбалансированы, иначе false. Других символов нет.',[['([]{})',true],['([)]',false],['',true],[')',false]],null)
];
const js=[
 row('lengths','Для JSON-массива строк выведите массив их длин. Строки содержат только ASCII.',[[['ab','','xyz'],[2,0,3]],[[],[]]],'data.map(x=>x.length)'),
 row('active','Для массива объектов {id,active} выведите id только объектов с active=true, сохранив порядок.',[[[{id:1,active:false},{id:2,active:true}],[2]],[[],[]],[ [{id:3,active:true},{id:4,active:true}],[3,4]]],'data.filter(x=>x.active===true).map(x=>x.id)'),
 row('group-sum','Сгруппируйте объекты {group,value}: выведите объект с суммой value для каждой group.',[[[{group:'a',value:2},{group:'b',value:4},{group:'a',value:-1}],{a:1,b:4}],[[],{}]],'data.reduce((r,x)=>(r[x.group]=(r[x.group]||0)+x.value,r),{})'),
 row('unique','Удалите дубликаты чисел, сохранив порядок первого появления.',[[[3,1,3,2],[3,1,2]],[[],[]],[[0,-1,0,-1],[0,-1]]],'[...new Set(data)]'),
 row('flatten','Выведите плоский массив из произвольно вложенного JSON-массива чисел, сохранив порядок.',[[[1,[2,[3]],4],[1,2,3,4]],[[],[]],[[[[]],5],[5]]],'data.flat(Infinity)'),
 row('topological','Даны {nodes,edges}, где [a,b] означает: a должен быть раньше b. Выведите топологический порядок, каждый раз выбирая наименьшую доступную вершину. При цикле выведите null.',[[{nodes:[1,2,3],edges:[[1,3],[2,3]]},[1,2,3]],[{nodes:[1,2],edges:[[1,2],[2,1]]},null],[{nodes:[],edges:[]},[]]],null)
];
const statistics=[
 row('range','Для непустого массива чисел выведите размах: максимум минус минимум.',[[[2,7,4],5],[[-3,-3],0]],'max(data)-min(data)'),
 row('median','Выведите медиану непустого массива чисел. Для чётной длины — среднее двух центральных значений.',[[[9,1,5],5],[[4,1,3,2],2.5]],"__import__('statistics').median(data)"),
 row('population-variance','Выведите дисперсию непустого массива чисел с делением на N, округлённую до 4 знаков.',[[[1,2,3],0.6667],[[5,5],0]],'round(sum((x-sum(data)/len(data))**2 for x in data)/len(data),4)'),
 row('weighted-mean','Для массива {value,weight} выведите взвешенное среднее, округлённое до 4 знаков. Сумма весов положительна.',[[[{value:1,weight:1},{value:4,weight:2}],3],[[{value:5,weight:0},{value:2,weight:3}],2]],'round(sum(x["value"]*x["weight"] for x in data)/sum(x["weight"] for x in data),4)'),
 row('correlation','Даны равнодлинные массивы x и y. Выведите корреляцию Пирсона, округлённую до 4 знаков. Если дисперсия одного массива нулевая, выведите null.',[[{x:[1,2,3],y:[2,4,6]},1],[{x:[1,2,3],y:[3,2,1]},-1],[{x:[1,1],y:[2,3]},null]],null),
 row('bootstrap','Даны values и samples — массивы индексов выборок с возвращением. Выведите среднее для каждой выборки, округлённое до 4 знаков. Индексы корректны, выборки непустые.',[[{values:[2,4,8],samples:[[0,0,2],[1,2]]},[4,6]],[{values:[5],samples:[[0,0]]},[5]]],'[round(sum(data["values"][i] for i in sample)/len(sample),4) for sample in data["samples"]]')
];
const ml=[
 row('accuracy','Даны y и pred — метки 0/1 одинаковой ненулевой длины. Выведите accuracy, округлённую до 4 знаков.',[[{y:[1,0,1],pred:[1,1,1]},0.6667],[{y:[0],pred:[1]},0]],'round(sum(a==b for a,b in zip(data["y"],data["pred"]))/len(data["y"]),4)'),
 row('threshold','Даны probabilities и threshold. Выведите метки: 1 при p >= threshold, иначе 0.',[[{probabilities:[0.2,0.5,0.9],threshold:0.5},[0,1,1]],[{probabilities:[],threshold:0.7},[]]],'[int(p>=data["threshold"]) for p in data["probabilities"]]'),
 row('precision','Даны y и pred — метки 0/1. Выведите precision, округлённую до 4 знаков; если положительных предсказаний нет, выведите 0.',[[{y:[1,0,1],pred:[1,1,0]},0.5],[{y:[1,0],pred:[0,0]},0]],'round(sum(a==b==1 for a,b in zip(data["y"],data["pred"]))/sum(data["pred"]),4) if sum(data["pred"]) else 0'),
 row('mse','Даны y и pred — непустые массивы чисел. Выведите mean squared error, округлённую до 4 знаков.',[[{y:[1,2],pred:[2,4]},2.5],[{y:[2],pred:[2]},0]],'round(sum((a-b)**2 for a,b in zip(data["y"],data["pred"]))/len(data["y"]),4)'),
 row('nearest','Даны points, labels и query. Найдите ближайшую точку по евклидову расстоянию и выведите её метку. При равенстве расстояний выбирайте первый индекс.',[[{points:[[0,0],[2,2]],labels:['a','b'],query:[1.8,2]},'b'],[{points:[[0],[2]],labels:[0,1],query:[1]},0]],'data["labels"][min(range(len(data["points"])),key=lambda i:sum((a-b)**2 for a,b in zip(data["points"][i],data["query"])))]'),
 row('gradient-step','Даны x,y,w,lr для линейной модели без смещения. Сделайте один шаг градиентного спуска по MSE: w_new = w - lr * (2/N) * sum((w*x_i-y_i)*x_i). Выведите w_new с округлением до 4 знаков.',[[{x:[1,2],y:[2,4],w:0,lr:0.1},1],[{x:[1],y:[3],w:3,lr:0.2},3]],'round(data["w"]-data["lr"]*2/len(data["x"])*sum((data["w"]*x-y)*x for x,y in zip(data["x"],data["y"])),4)')
];
const testDesign=[
 row('boundaries','Поле принимает целые числа от min до max включительно. Выведите набор [min-1,min,min+1,max-1,max,max+1] без повторений, по возрастанию.',[[{min:1,max:3},[0,1,2,3,4]],[{min:5,max:5},[4,5,6]]],'sorted(set([data["min"]-1,data["min"],data["min"]+1,data["max"]-1,data["max"],data["max"]+1]))'),
 row('classes','Для каждого значения age выведите "valid", если это целое число от 18 до 65, иначе "invalid". Булевы значения не считаются целыми.',[[[17,18,65,66,20.5,true],['invalid','valid','valid','invalid','invalid','invalid']],[[],[]]],'["valid" if type(x) is int and 18<=x<=65 else "invalid" for x in data]'),
 row('decision-table','Сервис разрешает доступ только при active=true и (admin=true или paid=true). Для массива объектов выведите массив ожидаемых разрешений true/false.',[[[{active:true,admin:false,paid:true},{active:false,admin:true,paid:true}],[true,false]],[[],[]]],'[bool(x["active"] and (x["admin"] or x["paid"])) for x in data]'),
 row('coverage','Даны required и covered — списки идентификаторов требований. Выведите ещё не покрытые требования без дублей в порядке required.',[[{required:['a','b','a','c'],covered:['b']},['a','c']],[{required:[],covered:[]},[]]],'[x for x in dict.fromkeys(data["required"]) if x not in data["covered"]]'),
 row('transition-oracle','Автомат начинается в closed. open допустим только из closed; close — только из open. Для списка событий выведите {state,invalid}, где invalid — индексы недопустимых событий. Недопустимое событие не меняет состояние.',[[['open','open','close'],{state:'closed',invalid:[1]}],[[],{state:'closed',invalid:[]}],[['close','open'],{state:'open',invalid:[0]}]],null),
 row('pair-coverage','Даны cases — массивы значений для трёх булевых параметров. Выведите количество разных пар (индекс параметра, значение; индекс другого параметра, значение), покрытых cases. Полное pairwise-покрытие равно 12.',[[[[false,false,false],[true,true,true]],6],[[[false,false,false],[false,true,true],[true,false,true],[true,true,false]],12],[[],0]],'len({(i,case[i],j,case[j]) for case in data for i in range(3) for j in range(i+1,3)})')
];
const sql=[
 row('filter','Таблица items(id int, value int). Выведите id строк с value > 10 по возрастанию id.',[['CREATE TABLE items(id int,value int); INSERT INTO items VALUES(2,11),(1,10),(3,20);','2\n3'],['CREATE TABLE items(id int,value int);','']],'SELECT id FROM items WHERE value > 10 ORDER BY id;'),
 row('null-count','Таблица events(id int, user_id int). Выведите количество строк, где user_id IS NULL.',[['CREATE TABLE events(id int,user_id int); INSERT INTO events VALUES(1,NULL),(2,3),(3,NULL);','2'],['CREATE TABLE events(id int,user_id int);','0']],'SELECT COUNT(*) FROM events WHERE user_id IS NULL;'),
 row('aggregate','Таблица orders(id int, customer_id int, amount int). Выведите customer_id и SUM(amount) только для клиентов с суммой > 100, по возрастанию customer_id.',[['CREATE TABLE orders(id int,customer_id int,amount int); INSERT INTO orders VALUES(1,1,60),(2,1,50),(3,2,100);','1|110'],['CREATE TABLE orders(id int,customer_id int,amount int);','']],'SELECT customer_id,SUM(amount) FROM orders GROUP BY customer_id HAVING SUM(amount)>100 ORDER BY customer_id;'),
 row('left-join','Таблицы users(id int) и orders(id int,user_id int). Выведите id каждого пользователя и количество его заказов, включая пользователей без заказов, по id.',[['CREATE TABLE users(id int); CREATE TABLE orders(id int,user_id int); INSERT INTO users VALUES(1),(2); INSERT INTO orders VALUES(1,1),(2,1);','1|2\n2|0'],['CREATE TABLE users(id int); CREATE TABLE orders(id int,user_id int); INSERT INTO users VALUES(5);','5|0']],'SELECT u.id,COUNT(o.id) FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.id;'),
 row('rank','Таблица scores(id int,team int,score int). Выведите id лучшего участника каждой команды. При равном score выберите меньший id. Результат отсортируйте по team.',[['CREATE TABLE scores(id int,team int,score int); INSERT INTO scores VALUES(2,1,9),(1,1,9),(3,2,5);','1\n3'],['CREATE TABLE scores(id int,team int,score int);','']],'SELECT id FROM (SELECT id,team,ROW_NUMBER() OVER(PARTITION BY team ORDER BY score DESC,id) n FROM scores) s WHERE n=1 ORDER BY team;'),
 row('running-total','Таблица payments(id int,amount int). Выведите id и накопительную сумму amount в порядке id. Используйте строки, а не группы равных сумм.',[['CREATE TABLE payments(id int,amount int); INSERT INTO payments VALUES(1,5),(2,-2),(3,5);','1|5\n2|3\n3|8'],['CREATE TABLE payments(id int,amount int);','']],'SELECT id,SUM(amount) OVER(ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM payments ORDER BY id;')
];
const infra=[
 row('errors','Выведите сообщения строк, начинающихся с ERROR , без этого префикса.',[['INFO ok\nERROR disk full\nERROR fail\n','disk full\nfail'],['INFO ok\n','']],"sed -n 's/^ERROR //p'"),
 row('line-count','Выведите число непустых строк stdin. Строка с пробелами считается непустой.',[['a\n\nb\n','2'],['','0'],[' \n','1']],"awk 'length {n++} END {print n+0}'"),
 row('status-count','Каждая строка: HTTP-статус и путь через пробел. Выведите число строк со статусом от 500 до 599.',[['200 /\n500 /a\n503 /b\n404 /x\n','2'],['','0']],"awk '$1>=500 && $1<=599 {n++} END {print n+0}'"),
 row('unique-hosts','Каждая строка содержит имя хоста. Выведите уникальные непустые имена в лексикографическом порядке.',[['b\na\nb\n\n','a\nb'],['','']],"LC_ALL=C sort -u | sed '/^$/d'"),
 row('aggregate-by-service','Каждая строка: имя сервиса и целое количество запросов. Выведите сервис и суммарное количество через пробел, по имени сервиса.',[['api 2\nweb 4\napi 3\n','api 5\nweb 4'],['','']],"awk '{s[$1]+=$2} END {for(k in s) print k,s[k]}' | LC_ALL=C sort"),
 row('percent-errors','Каждая строка: сервис и статус. Выведите только сервисы, у которых 5xx составляют строго больше половины запросов. Имена отсортируйте.',[['api 500\napi 200\nweb 503\nweb 500\nweb 200\n','web'],['','']],"awk '{n[$1]++; if($2>=500&&$2<=599)e[$1]++} END {for(k in n)if(e[k]*2>n[k])print k}' | LC_ALL=C sort")
];
const layouts=[
 ['search','html','Создайте форму поиска: label for="query", input id="query" name="query" type="search" и кнопку type="submit" с текстом «Найти».',['<form','for="query"','id="query"','name="query"','type="search"','type="submit"','Найти']],
 ['flex','css','Для .toolbar задайте display: flex; gap: 16px; align-items: center.',['.toolbar','display: flex','gap: 16px','align-items: center']],
 ['fieldset','html','Создайте группу выбора тарифа: fieldset с legend «Тариф», два radio с name="plan", значениями basic/pro и отдельными связанными label.',['<fieldset','<legend>Тариф</legend>','type="radio"','name="plan"','value="basic"','value="pro"','<label','for=']],
 ['grid','css','Для .cards создайте CSS grid из трёх равных колонок: display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px.',['.cards','display: grid','grid-template-columns: repeat(3, 1fr)','gap: 12px']],
 ['responsive','css','Для .layout задайте display: grid и колонки 240px 1fr. При max-width: 600px оставьте одну колонку 1fr. Используйте grid-template-columns и @media.',['.layout','display: grid','grid-template-columns: 240px 1fr','@media','max-width: 600px','grid-template-columns: 1fr']],
 ['validation','html','Создайте форму регистрации: email c id="email", name="email", type="email", required и связанным label; пароль c name="password", type="password", minlength="8", required; submit-кнопка «Создать».',['<form','id="email"','name="email"','type="email"','for="email"','name="password"','type="password"','minlength="8"','required','type="submit"','Создать']]
];
const react=[
 ['heading','Экспортируйте компонент по умолчанию, который отображает <h1>Навыки</h1>.',['<h1>Навыки</h1>']],
 ['list','Экспортируйте компонент по умолчанию: ul с двумя li — Python, затем SQL.',['<ul>','<li>Python</li>','<li>SQL</li>']],
 ['filter','Дан массив [{name:"Python",active:true},{name:"SQL",active:false}]. Компонент по умолчанию должен отобразить в ul только активные навыки, каждый в li.',['<ul>','<li>Python</li>']],
 ['empty','Экспортируйте компонент по умолчанию, который принимает items=[] и возвращает <p>Нет данных</p> для пустого массива, иначе список.',['<p>Нет данных</p>']],
 ['group','В компоненте по умолчанию сгруппируйте [{team:"A",name:"Python"},{team:"B",name:"SQL"},{team:"A",name:"React"}]. Отобразите две section в порядке A,B, каждая с h2 команды и списком li её навыков.',['<section>','<h2>A</h2>','<li>Python</li>','<li>React</li>','<h2>B</h2>','<li>SQL</li>']],
 ['tree','В компоненте по умолчанию рекурсивно отобразите дерево {name:"Root",children:[{name:"Python",children:[]},{name:"SQL",children:[]}]}: каждый узел li с названием; дочерние узлы во вложенном ul.',['<li>Root<ul>','<li>Python</li>','<li>SQL</li>']]
];
const layoutSolutions={search:'<form><label for="query">Поиск</label><input id="query" name="query" type="search"><button type="submit">Найти</button></form>',flex:'.toolbar { display:flex; gap:16px; align-items:center; }',fieldset:'<fieldset><legend>Тариф</legend><input id="basic" type="radio" name="plan" value="basic"><label for="basic">Basic</label><input id="pro" type="radio" name="plan" value="pro"><label for="pro">Pro</label></fieldset>',grid:'.cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }',responsive:'.layout {display:grid;grid-template-columns:240px 1fr;} @media (max-width:600px) {.layout {grid-template-columns:1fr;}}',validation:'<form><label for="email">Email</label><input id="email" name="email" type="email" required><input name="password" type="password" minlength="8" required><button type="submit">Создать</button></form>'};
const groups={python,javascript:js,backend:js,statistics,ml,'ml-engineering':ml,'test-design':testDesign,automation:js,sql,infrastructure:infra};
const integrationGroups={'integration-backend':'backend','integration-frontend':'react','integration-qa':'automation','integration-devops':'infrastructure','integration-ds':'statistics','integration-mle':'ml-engineering'};
export const MIXED_CODING_SOLUTIONS=new Map();
export const MIXED_CODING_QUESTIONS=MODULES.flatMap(m=>{
 const group=integrationGroups[m.id]||m.id;
 const definitions=group==='browser'?layouts.map(([id,language,prompt,contains])=>({id,language,prompt,contains})):group==='react'?react.map(([id,prompt,contains])=>({id,prompt,contains,language:'react'})):groups[group];
 return definitions.map((original,i)=>{
  const scoped=SCOPED_CODING_TASKS[m.id]?.[i];
  const task=scoped||reviewedCodingTask(original,group);
  const difficulty=Math.floor(i/2)+1,language=task.language||(group==='sql'?'sql':group==='infrastructure'?'bash':['javascript','automation'].includes(group)?'javascript':group==='backend'?'typescript':'python');
  const prefix=language==='python'?'import json\nimport sys\ndata = json.load(sys.stdin)\n': ['javascript','typescript'].includes(language)?"const fs = require('node:fs');\nconst data = JSON.parse(fs.readFileSync(0, 'utf8'));\n":'';
  const suffix=prefix?'\nПрочитайте входные данные JSON из stdin и выведите только результат в JSON. Порядок ключей объектов несущественен.':'';
  const id='mixed-coding-'+m.id+'-'+original.id+'-v1';
  if(task.id==='classes')task.tests=task.cases.slice(0,4).map(([input,expected],j)=>({stdin:JSON.stringify(input),expected:JSON.stringify(expected),comparison:'json',public:j===0})).concat({stdin:'[18.0,65.0,18.5,true,null,"18"]',expected:'["valid","valid","invalid","invalid","invalid","invalid"]',comparison:'json',public:false});
  if(group==='browser')MIXED_CODING_SOLUTIONS.set(id,layoutSolutions[task.id]);
  else if(task.program)MIXED_CODING_SOLUTIONS.set(id,(language==='react'?'':prefix)+task.program);
  else if(task.solution)MIXED_CODING_SOLUTIONS.set(id,prefix+(language==='python'?'print(json.dumps('+task.solution+'))':prefix?'console.log(JSON.stringify('+task.solution+'));':task.solution));
  return withCodingContract({id,moduleId:m.id,familyId:m.id+(scoped?':scoped-coding-':':mixed-coding-')+task.id,version:2,reviewRevision:'2026-10-08',templateVersion:1,format:'coding',prompt:task.prompt+suffix,difficulty,competencies:m.integration?task.skills:[m.competencies[({javascript:[0,2,2,2,2,2],sql:[0,0,1,1,1,1],browser:[0,1,0,1,1,0],automation:[0,1,0,2,1,2],'ml-engineering':[0,1,0,1,1,2],'test-design':[0,0,1,1,0,0]}[group]||[0,0,1,1,2,2])[i]]],skills:m.integration?task.skills:[m.id],status:'working',created:0,questionSeconds:300,coding:{...(task.contract||mixedCodingContract(group,i,task.prompt)),language,starter:prefix|| (language==='react'?'export default function Task() {\n  return <div />;\n}':(language==='sql'?'-- Напишите запрос':language==='bash'?'# Напишите решение':'/* Напишите решение */')),tests:task.tests|| (task.contains?[{stdin:'',contains:task.contains,public:true}]:task.cases.map(([input,expected],j)=>({stdin:prefix?JSON.stringify(input):input,expected:prefix?JSON.stringify(expected):expected,public:j===0,...(prefix?{comparison:'json'}:{})})))},history:[{at:0,status:'working',reason:'Фиксированное задание для смешанных адаптивных частей.'},{at:1791417600000,status:'working',reason:scoped?'Заменена общая задача на профильную; уточнены навыки и независимые проверки.':'Проверены ключи, примеры и граничные случаи; структурная проверка разметки.'}]});
 });
});
