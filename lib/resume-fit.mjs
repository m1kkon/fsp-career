// A bounded, explainable comparison of professional tasks, not a bag-of-words
// score. Matches are self-reported evidence, never assessment verification.
import {canonicalSkills,extractTechnologies} from './technology-catalog.mjs';
const fold=value=>String(value||'').toLowerCase().replace(/ё/g,'е');
const TASKS=[
 ['api','API и интеграции',['rest','soap','grpc','api','apis','интеграц','integration']],
 ['services','Сервисы и микросервисы',['микросервис','microservice','распределенн','distributed']],
 ['databases','Работа с данными и БД',['sql','database','баз данных','базы данных','бд','запрос','индекс','транзакц','хранилищ']],
 ['messaging','Очереди и обработка событий',['очеред','брокер','событи','queue','messag','event-driven','rabbitmq','kafka']],
 ['payments','Платежи и банковские интеграции',['платеж','биллинг','эквайринг','payment','billing','идемпотент','сверк']],
 ['performance','Производительность и нагрузка',['нагрузк','highload','performance','производительн','оптимизац','оптимизир','latency']],
 ['quality','Тестирование и качество',['тест','test','quality','регресс','selenium','playwright','pytest','junit']],
 ['delivery','Сборка и выпуск изменений',['ci/cd','deploy','разверт','депло','релиз','release','pipeline','сборк']],
 ['operations','Надёжность и наблюдаемость',['мониторинг','monitor','observab','наблюдаем','инцидент','incident','slo','sre','логирован']],
 ['architecture','Архитектура и проектирование',['архитект','architect','проектирован','design pattern','паттерн']],
 ['mentoring','Наставничество и техническое лидерство',['наставнич','ментор','mentoring','code review','код-ревью','ревью кода','руководил','руководство команд']],
 ['interfaces','Пользовательские интерфейсы',['интерфейс','interface','верстк','компонент','component','ui','дизайн-систем']],
 ['accessibility','Доступность интерфейсов',['доступност','accessibility','a11y','wcag']],
 ['analytics','Аналитика и витрины данных',['аналитик','analytics','etl','dwh','витрин','дашборд','dashboard']],
 ['models','Обучение и эксплуатация моделей',['модел','model','машинное обучение','machine learning','inference','mlops']],
].map(([id,label,terms])=>({id,label,terms}));

function contains(text,term){
 const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const end=/^[a-zа-я]{1,4}$/.test(term)?'(?![\\p{L}\\p{N}])':'';
 return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}${end}`,'u').test(text);
}
const concepts=text=>TASKS.filter(task=>task.terms.some(term=>contains(fold(text),term)));
const actionable=text=>/(разраб|развива|созда|сдела|внедр|настро|реализ|отвеч|проектир|оптимиз|постро|покры|поддерж|обеспеч|пиш|в[её]л|работ|администр|сопровожд|миграц|участвовал|develop|implement|build|built|design|maintain|responsib|deliver|optimi|manage|\b(?:worked|used|created|shipped|led|wrote|owned)\b)/i.test(text);
const limited=value=>String(value||'').trim().slice(0,5000);
const safeQuote=text=>text.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[контакт скрыт]').replace(/(?:\+?\d[\d ()-]{8,}\d)/g,'[контакт скрыт]').trim().slice(0,220);
const evidenceText=text=>text.replace(/[’‘]/g,"'").replace(/\b(did|do|does|have|has|had|could|would|should|is|are)n't\b/gi,'$1 not').replace(/\bcan't\b/gi,'cannot').replace(/\bwon't\b/gi,'will not');
const denied=text=>/не\s+(?:использ|работ|занима|примен|вход|влад|созда|разраб|реализ|настра|обуч)|не\s+(?:имею|имел|имеет|было)\s+(?:[а-я]+\s+){0,2}опыта|(?:без|нет)\s+(?:(?:коммерческого|практического|профессионального)\s+)?опыта|опыт[^.!?;]{0,80}отсутств|\bno\s+(?:(?:professional|commercial|practical|prior)\s+)?experience\b|never\s+(?:worked|used|built|implemented|developed|created|wrote)|(?:not|cannot)\s+(?:(?:yet|previously|ever|been)\s+){0,2}(?:work|use|build|built|implement|develop|creat|writ|wrote)/i.test(text);
const prospective=text=>/планиру|хочу\s+(?:разраб|созда|изуч|работ)|буд(?:у|ем|ет|ут)\s+(?:разраб|созда|работ)|собираюсь|хотел\s+бы|(?:учусь|изучаю)\s+(?:разраб|созда|работ)|(?:plan(?:ning)?|want|hope)\s+to|going\s+to|would\s+like\s+to|will\s+(?:develop|build|implement|work|create)|(?:currently\s+learning|learning\s+to)/i.test(text);
const professionalEvidence=text=>{const normal=evidenceText(text);return actionable(normal)&&!denied(normal)&&!prospective(normal);};
// Preserve affirmative clauses next to a denial/plan, without transferring their
// verbs or technologies to the other clause. Quotes retain the original wording.
// "not yet worked" is a temporal denial, not a contrast clause. "But also"
// continues affirmative evidence rather than starting an unrelated fragment.
const sentences=text=>text.split(/[\n;]|(?<=[.!?])\s+|,\s*yet\s+|(?:,\s*|\s+)(?:но|однако|but(?!\s+also\b)|however)\s+/iu).filter(Boolean);

export function candidateResumeSkills(candidate={}){
 const groups=candidate.resume?.skillGroups||[];
 return canonicalSkills([...(candidate.stack||[]),...(candidate.ats?.claimedSkills||[]),
  ...groups.map(group=>group.text),...resumeDocuments(candidate).flatMap(document=>sentences(document.text).filter(professionalEvidence).flatMap(extractTechnologies))]);
}

export function resumeDocuments(candidate={}){
 const resume=candidate.resume||{},ats=candidate.ats||{},documents=[];
 const add=(source,title,text)=>{text=limited(text);if(text)documents.push({source,title:limited(title).slice(0,160),text});};
 if(Array.isArray(resume.workEntries)&&resume.workEntries.length){
  for(const entry of resume.workEntries.slice(0,10))add('work','Опыт работы',`${limited(entry.position)}. ${limited(entry.description)}`);
 }else add('work','Опыт работы',candidate.work);
 for(const project of (resume.projects||[]).slice(0,6))add('project',project.name||'Проект',`${limited(project.name)}. ${limited(project.description)}`);
 add('project','Проекты из анкеты',ats.projectSummary);
 add('achievement','Результат из анкеты',ats.achievement);
 add('about','О себе',candidate.about);
 return documents;
}

export function resumeTaskFit(candidate,need){
 const requested=concepts(`${need.text||''} ${need.team||''}`),documents=resumeDocuments(candidate),matches=[];
 for(const task of requested){
  for(const document of documents){
   // About text alone and copied skill lists are not project evidence.
   if(document.source==='about')continue;
   const sentence=sentences(document.text).find(text=>professionalEvidence(text)&&task.terms.some(term=>contains(fold(text),term)));
   if(sentence){matches.push({id:task.id,label:task.label,source:document.title,quote:safeQuote(sentence)});break;}
  }
 }
 return {requested:requested.map(({id,label})=>({id,label})),matched:matches,missing:requested.filter(task=>!matches.some(match=>match.id===task.id)).map(({id,label})=>({id,label})),
  share:requested.length?matches.length/requested.length:null};
}

export function resumeEvidenceFit(candidate,need){
 const taskFit=resumeTaskFit(candidate,need),documents=resumeDocuments(candidate),skillMatches=[];
 for(const skill of need.stack||[]){
  const found=[];
  for(const document of documents){
   const sentence=sentences(document.text).find(text=>professionalEvidence(text)&&extractTechnologies(text).includes(skill));
   if(sentence)found.push({skill,source:document.title,quote:safeQuote(sentence),share:document.source==='about'?0.5:1});
  }
  if(found.length)skillMatches.push(found.sort((a,b)=>b.share-a.share)[0]);
 }
 const skillShare=need.stack?.length?skillMatches.reduce((sum,item)=>sum+item.share,0)/need.stack.length:null;
 const shares=[skillShare,taskFit.share].filter(share=>share!==null);
 // Both sources matter equally; a long resume or repeated terms add no points.
 const share=shares.length?shares.reduce((sum,value)=>sum+value,0)/shares.length:1;
 return {share,skills:skillMatches,tasks:taskFit.matched,missingTasks:taskFit.missing,requestedTasks:taskFit.requested,
  evaluated:shares.length>0,hasEvidence:documents.some(document=>document.source!=='about')};
}
