import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {definitions} from './coding-expansion.mjs';
import {addVisualTasks} from './visual-expansion.mjs';
import {addIntegrationTasks} from './integration-expansion.mjs';
import {MODULES} from '../../lib/question-bank.mjs';
addVisualTasks(definitions);
addIntegrationTasks(definitions);
const questions=[],solutions=[];
for(const moduleDefinition of MODULES){
 const tasks=definitions[moduleDefinition.id];
 assert.equal(tasks?.length,24,moduleDefinition.id+' expansion size');
 for(const difficulty of [1,2,3])assert.equal(tasks.filter(t=>t.difficulty===difficulty).length,8,moduleDefinition.id+' difficulty');
 for(const task of tasks){
  const id='expanded-coding-'+moduleDefinition.id+'-'+task.id+'-v1';
  const textual=['sql','bash'].includes(task.language);
  const inputs=task.inputs&&[...new Map(task.inputs.map(input=>[JSON.stringify(input),input])).values()];
  // Prefer a substantive public example; keep empty and negative cases hidden.
  if(inputs?.length>2)inputs.unshift(...inputs.splice(2,1));
  const tests=task.tests||inputs.map((input,i)=>({stdin:textual?input:JSON.stringify(input),expected:task.markupRule||textual?task.oracle(input):JSON.stringify(task.oracle(input)),...(task.markupRule?{markupRule:task.markupRule}:textual?{}:{comparison:'json'}),public:i===0}));
  assert.ok(tests.length>=1&&tests.length<=12,id+' checks');
  if(!task.tests){assert.equal(new Set(tests.map(t=>t.stdin)).size,tests.length,id+' duplicated input');assert.ok(new Set(tests.map(t=>t.expected)).size>=2,id+' constant-output checks');}
  const starter=task.language==='python'?'import json, sys\ndata = json.load(sys.stdin)\n# Ваше решение\n':task.language==='javascript'||task.language==='typescript'?'const data = JSON.parse(require("node:fs").readFileSync(0, "utf8"));\n// Ваше решение\n':task.language==='react'?'export default function Task(props) {\n  return <div />;\n}':task.language==='sql'?'-- Напишите SELECT\n':task.language==='bash'?'# Прочитайте stdin и выведите результат\n':task.language==='html'?'<!-- Ваша разметка -->':'/* Ваши CSS-правила */';
  questions.push({id,moduleId:moduleDefinition.id,familyId:moduleDefinition.id+':expanded-coding-'+task.id,version:1,templateVersion:1,reviewRevision:'2026-10-10',format:'coding',difficulty:task.difficulty,prompt:task.prompt+(!['html','css','react','sql','bash'].includes(task.language)?' Прочитайте одно JSON-значение из stdin и выведите результат в JSON без пояснений.':''),competencies:moduleDefinition.integration?task.skills:[moduleDefinition.competencies[task.competence||0]],skills:moduleDefinition.integration?task.skills:[moduleDefinition.id],status:'working',created:1791586800000,questionSeconds:300,coding:{language:task.language,inputFormat:task.input,outputFormat:task.output,examples:[{input:tests[0].stdin,output:task.example||tests[0].expected}],starter,tests},history:[{at:1791586800000,status:'working',reason:'Расширение принятого банка: самостоятельное семейство, фиксированные данные, эталонное решение и проверка граничных случаев.'}]});
  solutions.push([id,task.source]);
 }
}
await writeFile(new URL('../../lib/extended-coding-bank.mjs',import.meta.url),'// Generated offline by scripts/question-bank/generate-coding-bank.mjs.\n// Concrete immutable instances; no questions are generated during an assessment.\nexport const EXTENDED_CODING_QUESTIONS='+JSON.stringify(questions,null,2)+';\nexport const EXTENDED_CODING_SOLUTIONS=new Map('+JSON.stringify(solutions,null,2)+');\n');
console.log(`Materialized ${questions.length} tasks in ${MODULES.length} modules.`);
