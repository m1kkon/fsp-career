import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {templates} from './templates.mjs';
// Metadata is intentionally independent of the running application's bank.
const moduleCompetencies={
 python:['Семантика Python','Коллекции и итераторы','Надёжность кода'],javascript:['Язык и типы','Асинхронность','Управление данными'],sql:['Выборки','Соединения и агрегация','Транзакции'],browser:['Разметка и доступность','Компоновка','Браузер и безопасность'],react:['Компоненты','Состояние и эффекты','Архитектура интерфейса'],backend:['HTTP и API','Согласованность','Надёжность сервисов'],statistics:['Описательная статистика','Эксперименты','Выводы по данным'],ml:['Обучение и валидация','Метрики','Обобщение'],'ml-engineering':['Пайплайны','Serving','Эксплуатация моделей'],infrastructure:['Linux и контейнеры','Развёртывание','Надёжность инфраструктуры'],'test-design':['Техники проектирования','Проверка требований','Стратегия и риски'],automation:['Автотесты','Изоляция и данные','Контракты и CI'],
};
const questions=[];
assert.equal(Object.keys(templates).length,18);
for(const [moduleId,rows] of Object.entries(templates)){
 assert.equal(rows.length,28,moduleId);
 assert.equal(new Set(rows.map(r=>r.family)).size,28,moduleId);
 for(const [i,row] of rows.entries())for(const [instance,n] of [2,3,4].entries()){
  const body=row.make(n),numeric=!body.options&&i%2===0;
  if(!body.options){assert.ok(Number.isFinite(body.expected),row.family);if(numeric)body.numeric={expected:body.expected,tolerance:0,equivalents:[],decimals:null};else{body.options=[body.expected,body.expected+1,body.expected-1,body.expected+2].map(x=>String(Number(x.toFixed(8))));body.correct=0;}delete body.expected;}
  assert.ok(body.prompt.length>=10);if(body.options)assert.equal(new Set(body.options).size,4,row.family);
  const integration=moduleId.startsWith('integration-'),skills=integration?row.competence:[moduleId];
  questions.push({id:`bank-${moduleId}-adaptive-${row.family}-${instance+1}-v1`,moduleId,familyId:`${moduleId}:adaptive-${row.family}`,templateVersion:1,version:1,competencies:integration?skills:[moduleCompetencies[moduleId][row.competence]],skills,difficulty:row.difficulty,format:numeric?'numeric':'choice',...body,status:'working',exposure:0,created:0,seedOrigin:'adaptive-bank-100-v1',history:[{status:'working',reason:'Принятый банк MVP: 100 вопросов на модуль',at:0}]});
 }
}
assert.equal(questions.length,1512);
assert.equal(new Set(questions.map(q=>q.id)).size,1512);
assert.equal(new Set(questions.map(q=>q.prompt)).size,1512,'Every instance must have its own fixed statement');
await writeFile(new URL('../../lib/question-bank-100.mjs',import.meta.url),'// Generated offline by scripts/question-bank/generate-bank.mjs; fixed instances, never generated during an exam.\nexport const BANK_100_QUESTIONS='+JSON.stringify(questions,null,1)+';\n');
console.log(`Materialized ${questions.length} fixed questions across 18 modules.`);
