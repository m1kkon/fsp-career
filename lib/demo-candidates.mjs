import {demoCandidateData} from './demo-candidate-data.mjs';
import {mockFspProfile,FSP_DEMO_IDS} from './fsp.mjs';

let fspIndex=14; // The existing adapter fixtures keep their original IDs.
export const demoCandidates=demoCandidateData.map((row,index)=>{
 const fsp=row.fspEvents===undefined?null:mockFspProfile(FSP_DEMO_IDS[fspIndex++]);
 const years=row.years,about=`${row.focus}. ${row.outcome}`;
 return {id:row.id,email:'',synthetic:true,profile:{
  id:100+index,name:row.name,spec:row.spec,grade:row.grade,score:row.score,stack:row.stack,
  city:row.city,format:row.format,min:row.min,max:row.max,experience:years===null?'Не указан':years===0.5?'6 месяцев':years<5?`${String(years).replace('.',',')} года`:`${years} лет`,
  about,work:`Проект: ${row.focus}. ${row.outcome}`,education:row.grade==='Junior'?'Профильные курсы и учебные проекты':'Высшее техническое образование',
  roles:[row.spec==='QA'?'Тестировщик':row.spec==='DevOps'?'Инженер инфраструктуры':row.spec==='Data Science'?'Аналитик':'Разработчик'],
  softSkills:row.grade==='Senior'?['Наставничество','Системное мышление']:['Коммуникация','Командная работа'],
  skills:row.stack.slice(0,3).map((name,i)=>[name,Math.max(50,Math.min(99,row.score+[2,-4,-8][i]))]),
  verified:true,verifiedAt:row.verifiedAt,updated:row.verifiedAt,fsp,
  ats:{claimedSkills:row.stack,experienceYears:years,
   languages:row.english?[{name:'Английский',level:row.english,source:'candidate',sourceLabel:'указано кандидатом'}]:[],
   acceptedFormats:[row.format],employmentTypes:['Полная занятость'],relocation:row.relocation||'Не готов к переезду',businessTrips:'Редкие командировки',
   availableFrom:row.grade==='Junior'?'Сразу':'В течение месяца',achievement:row.outcome,projectSummary:about,
   taskType:row.grade==='Senior'?'Архитектура и развитие платформы':'Развитие работающего продукта',
   motivation:`Хочу развивать ${row.focus.toLocaleLowerCase('ru')} и оценивать результат по метрикам продукта.`,
  },
 }};
});
