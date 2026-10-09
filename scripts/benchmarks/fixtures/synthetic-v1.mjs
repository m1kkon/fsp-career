// Frozen synthetic scenarios. No matching/scoring imports; labels are declared
// from the scenario rubric, never generated from the product's predictions.
export const VERSION='synthetic-validation-v1';
export const AS_OF='2026-10-10T12:00:00Z';
export const GRADE_PERSONAS=[
 {id:'novice',grade:'BelowJunior',theory:[.45,.20,.08],coding:[.25,.05,.01]},
 {id:'junior',grade:'Junior',theory:[.88,.60,.25],coding:[.88,.25,.04]},
 {id:'middle',grade:'Middle',theory:[.96,.85,.58],coding:[.97,.86,.35]},
 {id:'senior',grade:'Senior',theory:[.99,.97,.91],coding:[.99,.97,.90]},
];
const FAMILIES=[
 {id:'payments',spec:'Backend',split:'development',skills:['Python','PostgreSQL'],extra:'Redis',ru:'Разработал платёжный API на Python. Реализовал транзакции PostgreSQL и интеграции с банками.',en:'Built payment APIs in Python. Implemented PostgreSQL transactions and bank integrations.',request:'API, платежи и банковские интеграции',irrelevant:'Разработал скрипты на Python для каталогизации фотографий. Реализовал импорт файлов в PostgreSQL.',negation:'Платёжными API и банковскими интеграциями не занимался.'},
 {id:'regression',spec:'QA',split:'development',skills:['Python','SQL'],extra:'Playwright',ru:'Разработал регрессионные автотесты на Python. Покрыл API проверками и настроил SQL для подготовки данных.',en:'Built regression tests in Python. Implemented API checks and SQL test data preparation.',request:'Регрессионные автотесты и API',irrelevant:'Разработал скрипты на Python для аналитики продаж. Оптимизировал SQL для отчётов.',negation:'Регрессионными автотестами и API не занимался.'},
 {id:'analytics',spec:'Data Science',split:'development',skills:['Python','SQL'],extra:'PyTorch',ru:'Разработал модели прогноза спроса на Python. Реализовал ETL на SQL и проверил модели на отложенных данных.',en:'Built demand forecasting models in Python. Implemented SQL ETL and evaluated models on holdout data.',request:'Модели прогноза спроса, ETL и аналитика',irrelevant:'Разработал веб-сервис на Python. Поддерживал SQL базу для учёта пользователей.',negation:'Обучением моделей и ETL не занимался.'},
 {id:'accessibility',spec:'Frontend',split:'holdout',skills:['TypeScript','React'],extra:'CSS',ru:'Разработал интерфейс на React и TypeScript. Реализовал доступность по WCAG и компоненты дизайн-системы.',en:'Built React interfaces in TypeScript. Implemented WCAG accessibility and design system components.',request:'Доступные интерфейсы и компоненты дизайн-системы',irrelevant:'Разработал CLI на TypeScript для обработки файлов. Поддерживал внутренний скрипт сборки React.',negation:'Доступностью интерфейсов и компонентами дизайн-системы не занимался.'},
 {id:'reliability',spec:'DevOps',split:'holdout',skills:['Docker','Kubernetes'],extra:'Python',ru:'Настроил мониторинг Kubernetes. Реализовал Docker CI/CD, устранял инциденты и обеспечивал SLO.',en:'Built Kubernetes monitoring. Implemented Docker CI/CD, handled incidents and maintained SLOs.',request:'Мониторинг, инциденты и надёжность инфраструктуры',irrelevant:'Разработал учебные примеры Docker и Kubernetes для локального запуска. Поддерживал документацию.',negation:'Мониторингом и инцидентами инфраструктуры не занимался.'},
 {id:'serving',spec:'ML Engineering',split:'holdout',skills:['Python','Docker'],extra:'Kubernetes',ru:'Разработал serving моделей на Python. Настроил Docker пайплайны и мониторинг inference.',en:'Built model serving in Python. Implemented Docker pipelines and inference monitoring.',request:'Serving моделей, inference и мониторинг',irrelevant:'Разработал Python скрипты для загрузки файлов. Настроил Docker для локального запуска сайта.',negation:'Serving моделей и мониторингом inference не занимался.'},
];

export function matchingScenarios(){
 return FAMILIES.flatMap(f=>['Junior','Middle'].flatMap(grade=>['ru','en'].map(language=>{
  const id=`${f.id}-${grade}-${language}`,text=`${grade} ${f.spec}`;
  const need={text,selection:{spec:f.spec,grade,requiredStack:f.skills,preferredStack:[f.extra],team:f.request,format:'Удалённо',formatRequired:true,city:'Москва',budgetMin:100000,budgetMax:250000,englishLevel:'B2',minExperience:1,confirmed:true}};
  const base={spec:f.spec,grade,verified:true,score:86,stack:f.skills,min:150000,max:200000,format:'Удалённо',city:'Москва',about:'',work:'',ats:{languages:[{name:'Английский',level:'B2'}],experienceYears:3,acceptedFormats:['Удалённо']},fspId:null};
  const row=(suffix,label,reason,patch={})=>({candidate:{...structuredClone(base),...patch,id:`${id}-${suffix}`,name:`Синтетический ${suffix}`},label,reason,expectedEligibility:label>0?'pass':['unverified','unknown-salary','unknown-english'].includes(suffix)?'unknown':'fail'});
  const relevant=f[language];
  return {id,family:f.id,spec:f.spec,split:f.split,need,candidates:[
   row('proven',3,'Есть релевантный опыт, все условия соблюдены',{work:relevant,score:92,stack:[...f.skills,f.extra]}),
   row('project',3,'Релевантный проект, все условия соблюдены',{resume:{projects:[{name:'Рабочий проект',description:relevant}]},score:90}),
   row('higher',3,'Грейд выше минимума, релевантный опыт',{grade:grade==='Junior'?'Middle':'Senior',work:relevant,score:96}),
   row('no-fsp',3,'История ФСП не обязательна',{work:relevant,score:88}),
   row('fsp',3,'Релевантный опыт и подтверждённое демодостижение',{work:relevant,score:88,fspId:'DEMO-FSP-012'}),
   row('boundary-salary',3,'Диапазоны пересекаются в одной точке',{work:relevant,min:250000,max:300000}),
   row('tags',1,'Навыки заявлены, опыт выполнения задач не описан',{work:f.skills.join(', '),score:99,fspId:'DEMO-FSP-012'}),
   row('unrelated',1,'Стек подходит, профессиональные задачи другие',{work:f.irrelevant,score:100,fspId:'DEMO-FSP-012'}),
   row('denied',1,'Прямо отрицает релевантный опыт',{work:`Работал с ${f.skills.join(' и ')}. ${f.negation}`,score:100,fspId:'DEMO-FSP-012'}),
   row('learning',1,'Будущие планы не являются выполненным проектом',{work:`Планирую разработать ${f.request} на ${f.skills.join(' и ')}.`,score:100}),
   row('wrong-spec',0,'Другая подтверждённая специализация',{spec:f.spec==='QA'?'Backend':'QA',score:100,work:relevant,fspId:'DEMO-FSP-012'}),
   row('lower',grade==='Junior'?3:0,grade==='Junior'?'Junior соответствует минимуму':'Грейд ниже обязательного минимума',{grade:'Junior',work:relevant,score:95}),
   row('unverified',0,'Категория не подтверждена',{verified:false,work:relevant,score:100,fspId:'DEMO-FSP-012'}),
   row('missing-skill',0,'Нет обязательного навыка',{stack:[f.skills[0]],work:''}),
   row('salary',0,'Нет пересечения бюджета',{work:relevant,min:300000,max:350000,score:100,fspId:'DEMO-FSP-012'}),
   row('unknown-salary',0,'Обязательные ожидания неизвестны',{work:relevant,min:null,max:null}),
   row('english',0,'Английский ниже требования',{work:relevant,ats:{...base.ats,languages:[{name:'Английский',level:'B1'}]}}),
   row('unknown-english',0,'Обязательный английский неизвестен',{work:relevant,ats:{...base.ats,languages:[]}}),
   row('experience',0,'Опыт ниже требования',{work:relevant,ats:{...base.ats,experienceYears:0}}),
   row('format',0,'Не принимает обязательный формат',{work:relevant,format:'Офис',ats:{...base.ats,acceptedFormats:['Офис']}}),
  ]};
 })));
}
