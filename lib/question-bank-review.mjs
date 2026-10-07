import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
// Applied once to seed instances. Frozen day pools and attempts keep their own keys.
export function reviewedQuestionBank(questions){
 const positions=new Map();
 for(const moduleId of new Set(questions.map(q=>q.moduleId))){
  questions.filter(q=>q.moduleId===moduleId&&q.format==='choice').sort((a,b)=>hash(a.id).localeCompare(hash(b.id))).forEach((q,i)=>positions.set(q.id,i%4));
 }
 return questions.map(original=>{
  const q=structuredClone(original),changes=[];
  if(q.format==='choice'){
   const answer=q.options[q.correct],others=q.options.filter((_,i)=>i!==q.correct).sort((a,b)=>hash(q.id+a).localeCompare(hash(q.id+b)));
   q.correct=positions.get(q.id);others.splice(q.correct,0,answer);q.options=others;
   changes.push('Равномерное распределение правильного ответа по четырём позициям; смысл ключа сохранён.');
  }
  if(q.familyId==='integration-frontend:adaptive-react-css-border-box'){
   q.prompt=q.prompt.replace('border:2px','border:"2px solid"');changes.push('Явно задан стиль рамки: без него её используемая ширина равна нулю.');
  }
  if(['infrastructure:adaptive-rolling-max-surge','integration-devops:adaptive-python-rollout-max-surge'].includes(q.familyId)){
   q.prompt+=' Считайте только Pod, не находящиеся в состоянии завершения (terminating).';changes.push('Уточнено, какие Pod входят в лимит rolling update.');
  }
  if(q.familyId==='python:adaptive-iterator-takewhile-boundary'){
   q.prompt=q.prompt.replace('Python: list(itertools.', 'Python: import itertools; list(itertools.');changes.push('Добавлен необходимый импорт.');
  }
  if(q.familyId==='test-design:adaptive-metamorphic-permutation-sum'){q.prompt=q.prompt.replace('чисел.','целых чисел с точной арифметикой.');changes.push('Уточнена точная арифметика: для float перестановка может менять округление.');}
  if(q.familyId==='browser:adaptive-grid-fr-division'){q.prompt+=' Содержимое не ограничивает минимальную ширину колонок.';changes.push('Уточнены ограничения min-content в Grid.');}
  if(q.familyId==='browser:adaptive-input-required-validity'){q.prompt=q.prompt.replace('пустых input','пустых input type="text"');changes.push('Уточнён тип поля, для которого применяется required.');}
  if(changes.length){q.version=original.version+1;q.reviewRevision='2026-10-08';q.history=[...(q.history||[]),{at:1791417600000,status:q.status,reason:changes.join(' ')}];}
  return q;
 });
}
