import {reviewedLegacyCoding} from './coding-bank-review.mjs';
import {MODULES} from './question-bank.mjs';
import {withCodingContract} from './coding-contract.mjs';
const tasks={
 python:{language:'python',prompt:'Напишите программу Python: прочитайте JSON-массив целых чисел из stdin и выведите сумму только чётных чисел. Пустой массив даёт 0.',starter:'import json\nimport sys\n\nvalues = json.load(sys.stdin)\n# Выведите сумму чётных чисел\n',cases:[['[1,2,3,4]','6'],['[-4,3,6]','2'],['[]','0']]},
 javascript:{language:'javascript',prompt:'Прочитайте JSON-массив из stdin. Выведите JSON-массив уникальных значений, сохранив порядок первого появления.',starter:"const fs = require('node:fs');\nconst values = JSON.parse(fs.readFileSync(0, 'utf8'));\n// Выведите результат через console.log\n",cases:[['[3,1,3,2]','[3,1,2]'],['[]','[]'],['[0,0,-1,-1]','[0,-1]']]},
 sql:{language:'sql',prompt:'Таблица orders(id integer, customer_id integer, amount integer). Выведите customer_id и сумму amount по клиентам, у которых сумма строго больше 100, по возрастанию customer_id.',starter:'SELECT customer_id, SUM(amount)\nFROM orders\n-- Дополните запрос\n',cases:[['CREATE TABLE orders(id int, customer_id int, amount int); INSERT INTO orders VALUES(1,1,60),(2,1,50),(3,2,100);','1|110'],['CREATE TABLE orders(id int, customer_id int, amount int); INSERT INTO orders VALUES(1,3,200),(2,1,101),(3,3,-50);','1|101\n3|150'],['CREATE TABLE orders(id int, customer_id int, amount int);','']]},
 html:{language:'html',prompt:'Создайте HTML-форму поиска: поле type="search" с id="query" и name="query", связанный label и кнопка type="submit" с текстом «Найти». Результат можно открыть в предпросмотре.',starter:'<form>\n  <!-- Поле поиска, подпись и кнопка -->\n</form>',contains:['type="search"','name="query"','<label','type="submit"','Найти']},
 react:{language:'react',prompt:'Экспортируйте компонент по умолчанию: список <ul> с двумя элементами <li>, содержащими Python и SQL в этом порядке. Доступен React. Проверьте результат в предпросмотре.',starter:'export default function Skills() {\n  return <ul>{/* Добавьте элементы */}</ul>;\n}',contains:['<ul>','<li>Python</li>','<li>SQL</li>']},
 backend:{language:'typescript',prompt:'Прочитайте JSON-массив объектов {id, status} из stdin. Выведите JSON-массив id только записей со status="active", сохранив порядок.',starter:"const fs = require('node:fs');\ntype Item = { id: number; status: string };\nconst items: Item[] = JSON.parse(fs.readFileSync(0, 'utf8'));\n// Выведите JSON-массив id\n",cases:[['[{"id":1,"status":"active"},{"id":2,"status":"closed"}]','[1]'],['[]','[]'],['[{"id":8,"status":"closed"},{"id":3,"status":"active"},{"id":4,"status":"active"}]','[3,4]']]},
 data:{language:'python',prompt:'Прочитайте JSON-массив чисел из stdin. Выведите среднее арифметическое с двумя знаками после точки; для пустого массива выведите 0.00.',starter:'import json\nimport sys\nvalues = json.load(sys.stdin)\n# Выведите среднее с двумя знаками после точки\n',cases:[['[1,2,3]','2.00'],['[]','0.00'],['[-2,0,3]','0.33']]},
 infra:{language:'bash',prompt:'Прочитайте строки LEVEL сообщение из stdin. Выведите только сообщения строк, которые начинаются с "ERROR ", без префикса ERROR. Сохраните порядок.',starter:'#!/usr/bin/env bash\n# Читайте строки stdin и выводите сообщения ERROR\n',cases:[['INFO start\nERROR timeout\nWARN retry\nERROR disk full\n','timeout\ndisk full'],['INFO no errors\n',''],['ERROR first\nERROR second\n','first\nsecond']]}
};
const picks={python:'python',javascript:'javascript',sql:'sql',browser:'html',react:'react',backend:'backend',statistics:'data',ml:'data','ml-engineering':'python',infrastructure:'infra','test-design':'python',automation:'javascript'};
export const CODING_QUESTIONS=MODULES.map(m=>{
 const type=picks[m.id]||(m.id.includes('frontend')?'react':m.id.includes('devops')?'infra':m.id.includes('backend')?'backend':m.id.includes('qa')?'javascript':m.id.includes('data')?'data':'python');
 const task=tasks[type];
 return {id:'coding-'+m.id+'-v1',moduleId:m.id,familyId:m.id+':coding-'+type,version:1,templateVersion:1,format:'coding',prompt:task.prompt,difficulty:2,competencies:[m.competencies[0]],skills:m.integration?m.skills.slice(0,2):[m.id],status:'working',created:0,questionSeconds:600,coding:{language:task.language,starter:task.starter,tests:task.cases?task.cases.map(([stdin,expected],n)=>({stdin,expected,public:n===0})):[{stdin:'',contains:task.contains,public:true}]},history:[{at:0,status:'working',reason:'Задание на кодинг MVP, проверка по фиксированным случаям.'}]};
});

CODING_QUESTIONS.push({...CODING_QUESTIONS.find(q=>q.moduleId==='browser'),id:'coding-browser-css-v1',familyId:'browser:css-flex-toolbar',prompt:'Создайте CSS-правило .toolbar: display: flex; gap: 16px; align-items: center. Используйте эти записи свойств; результат можно открыть в предпросмотре.',coding:{language:'css',starter:'.toolbar {\n  /* Добавьте свойства */\n}',tests:[{stdin:'',contains:['.toolbar','display: flex','gap: 16px','align-items: center'],public:true}]}});

const contracts={
 python:['Одно значение JSON из stdin: массив целых чисел; может быть пустым.','Одно целое число в stdout — сумма чётных чисел; для пустого массива 0.'],
 javascript:['Одно значение JSON из stdin: массив чисел; может быть пустым.','JSON-массив уникальных чисел в порядке первого появления.'],
 typescript:['JSON-массив объектов {id: число, status: строка} из stdin; может быть пустым.','JSON-массив id записей со status=\"active\" в исходном порядке.']
};
for(let i=0;i<CODING_QUESTIONS.length;i++){
 const q=CODING_QUESTIONS[i],schema=contracts[q.coding.language];
 if(schema){q.coding.inputFormat=schema[0];q.coding.outputFormat=schema[1]+' Выведите только результат, без пояснений.';}
 if(q.coding.language==='sql')q.coding.inputFormat='Таблица orders(id integer, customer_id integer, amount integer). Песочница создаёт и заполняет таблицу перед выполнением запроса; исходные SQL-команды приведены в примере.';
 if(q.coding.language==='bash'){q.coding.inputFormat='Текст из stdin: LEVEL сообщение, одна запись на строку.';q.coding.outputFormat='Сообщения ERROR без префикса, по одному на строку в исходном порядке. При отсутствии ERROR — пустой вывод. Без пояснений.';}
 if(q.coding.language==='react')q.coding.examples=[{input:'Ввод отсутствует.',output:'<ul><li>Python</li><li>SQL</li></ul>'}];
 if(q.coding.language==='html')q.coding.examples=[{input:'Ввод отсутствует.',output:'Поле поиска с подписью и кнопкой «Найти».'}];
 if(q.coding.language==='css')q.coding.examples=[{input:'Контейнер .toolbar с двумя кнопками.',output:'Кнопки расположены в ряд, расстояние между ними 16px, выравнивание по центру поперечной оси.'}];
 if(q.prompt.includes('двумя знаками')){q.coding.inputFormat='JSON-массив чисел из stdin; может быть пустым.';q.coding.outputFormat='Одно число в stdout с ровно двумя знаками после точки; для пустого массива — 0.00. Без пояснений.';}
 CODING_QUESTIONS[i]=withCodingContract(reviewedLegacyCoding(q));
}
