// Creates a fresh session; previously published pools and attempts stay immutable.
import {transaction,getPool} from '../lib/postgres.mjs';
import {assessmentAction,specifications} from '../lib/assessments.mjs';
import {MODULES} from '../lib/question-bank.mjs';
const admin={id:'platform-coding-setup',roles:[],maintainer:true};
try{
 const result=await transaction(async repo=>{
  const specs=await specifications(repo);
  for(const m of MODULES){const current=specs.filter(s=>s.moduleId===m.id).sort((a,b)=>b.version-a.version)[0];if(current.codingPerPart!==2||current.codingSeconds!==300)await assessmentAction(repo,admin,{action:'maintainer-spec-save',spec:{...current,codingCount:0,codingPerPart:2,codingSeconds:300}});}
  const opensAt=Date.now()+10000;
  const {dayId}=await assessmentAction(repo,admin,{action:'maintainer-day-save',name:'Тестирование с практическими заданиями',opensAt,closesAt:opensAt+48*3600000,breakSeconds:60,expectedCandidates:100,moduleIds:MODULES.map(m=>m.id),tools:'Встроенная песочница, стандартная библиотека выбранного языка.'});
  await assessmentAction(repo,admin,{action:'maintainer-day-publish',id:dayId});return dayId;
 });console.log('Published coding session:',result);
}finally{await getPool().end();}
