import {meetsModuleGrade,SCORING_RULE,isEvidenceScoringRule,DEFAULT_THRESHOLDS} from './assessment-scoring.mjs';
import {validatedCodingChecks} from './coding-check-validation.mjs';
import {ApiError,requireValue,text,COOLDOWN,GRADES} from './domain.mjs';
import {MODULES,ROLES,INITIAL_QUESTIONS,DEFAULT_SPECS} from './question-bank.mjs';
import {latestAssessmentResults} from './assessment-results.mjs';
import {partSpec,routingDecision,adaptiveScore,ADAPTIVE_RULE,MIXED_CODING_RULE,LEGACY_MIXED_CODING_RULE,isMixedCodingRule,mixedCodingSpec} from './adaptive-testing.mjs';
import {roleGradeOutcome,ROLE_GRADES,ROLE_OUTCOME_RULE} from './role-grade.mjs';
import {CODING_QUESTIONS} from './coding-bank.mjs';
import {MIXED_CODING_QUESTIONS} from './mixed-coding-bank.mjs';
import {CODE_LANGUAGES,runCode,runCodeInput} from './code-runner.mjs';
import {codingContract,withCodingContract} from './coding-contract.mjs';
const legacyCodingIds=new Set(CODING_QUESTIONS.map(q=>q.id));
const now=()=>Date.now();
const id=()=>crypto.randomUUID();
const record=(kind,data,owner='platform')=>({id:id(),owner,created:now(),...data,kind});
const clone=value=>structuredClone(value);
const moduleFor=id=>MODULES.find(m=>m.id===id);
const roleFor=id=>ROLES.find(r=>r.id===id);
const assertAdmin=a=>requireValue(a.maintainer===true,'Доступ только для мейнтейнеров тестов.',403);
const assertCandidate=a=>requireValue(a.roles.includes('candidate'),'Создайте профиль кандидата.',403);
export async function bank(repo){const overrides=await repo.records('question');return [...new Map([...INITIAL_QUESTIONS,...CODING_QUESTIONS,...MIXED_CODING_QUESTIONS,...overrides].map(q=>[q.id,q])).values()].map(withCodingContract);}
const timedSpec=s=>({...s,questionSeconds:s.questionSeconds||20,seconds:(s.scoredCount-(s.codingPerPart||0)*2)*(s.questionSeconds||20)+((s.codingPerPart||0)*2+(s.codingCount||0))*(s.codingSeconds||600),experimentalSeconds:s.questionSeconds||20});
const dayConfigs=d=>Object.fromEntries(d.specs.map(s=>{const spec=timedSpec(s),experimentalCount=d.experimentalCounts[s.moduleId]||0;return [s.moduleId,{seconds:spec.seconds+spec.questionSeconds*experimentalCount,questionSeconds:spec.questionSeconds,scoredCount:spec.scoredCount,codingCount:spec.codingCount||0,codingPerPart:spec.codingPerPart||0,codingSeconds:spec.codingSeconds||600,experimentalCount,specVersion:s.version,adaptive:!!spec.adaptive,partCount:spec.adaptive?2:1,questionsPerPart:spec.adaptive?.firstCount||spec.scoredCount,...(spec.scoring?{scoring:clone(spec.scoring),thresholds:clone(spec.thresholds)}:{})}];}));
export async function specifications(repo){
 const saved=await repo.records('module-spec'),all=[...DEFAULT_SPECS,...saved];
 for(const m of MODULES){const latest=(saved.some(s=>s.moduleId===m.id)?saved:all).filter(s=>s.moduleId===m.id).sort((a,b)=>b.version-a.version||(b.created||0)-(a.created||0))[0];
  if((latest.adaptive?.rule!==MIXED_CODING_RULE||latest.scoring?.rule!==SCORING_RULE)&&saved.some(s=>s.id===latest.id)){
   const standardLegacy=latest.thresholds?.Junior===50&&latest.thresholds?.Middle===70&&latest.thresholds?.Senior===90;
   all.push({...mixedCodingSpec({...latest,thresholds:standardLegacy?clone(DEFAULT_THRESHOLDS):latest.thresholds}),id:latest.id+'-scoring-v5',version:Math.max(latest.version+1,9)});
  }
 }
 return all.map(timedSpec);
}
const latestSpecs=all=>MODULES.map(m=>all.filter(s=>s.moduleId===m.id).sort((a,b)=>b.version-a.version||(b.created||0)-(a.created||0))[0]);
export function validateQuestion(input){
 const q={moduleId:text(input.moduleId,100),familyId:text(input.familyId,150),templateVersion:Number(input.templateVersion||1),format:input.format,prompt:text(input.prompt,12000),difficulty:Number(input.difficulty),competencies:Array.isArray(input.competencies)?input.competencies.map(c=>text(c,100)):[],skills:Array.isArray(input.skills)?input.skills.map(c=>text(c,100)):[]};
 const skillModule=moduleFor(q.moduleId);requireValue(skillModule,'Неизвестный модуль.');
 requireValue(q.familyId&&q.prompt.length>=10,'Укажите узкое семейство и условие вопроса.');
 requireValue([1,2,3].includes(q.difficulty)&&Number.isInteger(q.templateVersion)&&q.templateVersion>0,'Укажите сложность 1–3 и версию шаблона.');
 requireValue(q.competencies.length>0&&q.competencies.every(c=>skillModule.competencies.includes(c)),'Выберите компетенции модуля.');
 if(skillModule.integration){requireValue(q.skills.length>=2&&q.skills.every(s=>skillModule.skills.includes(s)),'Интеграционный вопрос должен связывать хотя бы два навыка роли.');}else q.skills=[skillModule.id];
 requireValue(['choice','numeric','coding'].includes(q.format),'Неверный формат вопроса.');
 if(q.format==='choice'){q.options=(input.options||[]).map(x=>text(x,4000));requireValue(input.correct!==null&&input.correct!==undefined&&typeof input.correct!=='boolean'&&String(input.correct).trim()!=='','Укажите правильный вариант.');q.correct=Number(input.correct);requireValue(q.options.length===4&&q.options.every(Boolean)&&new Set(q.options).size===4&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4,'Нужны четыре разных варианта и один правильный.');}
 else if(q.format==='coding'){const c=input.coding||{};requireValue(CODE_LANGUAGES.includes(c.language),'Выберите язык песочницы.');requireValue(Array.isArray(c.tests)&&c.tests.length>=1&&c.tests.length<=12&&c.tests.some(t=>t?.public===true),'Добавьте 1–12 проверок и хотя бы один открытый пример.');requireValue(typeof c.inputFormat==='string'&&c.inputFormat.trim()&&typeof c.outputFormat==='string'&&c.outputFormat.trim(),'Укажите формат ввода и формат вывода.');requireValue(Array.isArray(c.examples)&&c.examples.length>=1&&c.examples.length<=5&&c.examples.every(e=>e&&typeof e.input==='string'&&typeof e.output==='string'&&e.input.length<=4000&&e.output.length<=4000&&(e.explanation===undefined||typeof e.explanation==='string'&&e.explanation.length<=1000)),'Добавьте 1–5 примеров с текстовыми полями input и output (до 4000 символов), explanation — необязательное пояснение.');q.coding={inputFormat:text(c.inputFormat,4000),outputFormat:text(c.outputFormat,4000),examples:c.examples.map(e=>({input:e.input,output:e.output,...(e.explanation?{explanation:e.explanation}:{})})),language:c.language,starter:text(c.starter||'',20000),tests:validatedCodingChecks(c)};q.questionSeconds=Number(input.questionSeconds||600);requireValue(Number.isInteger(q.questionSeconds)&&q.questionSeconds>=60&&q.questionSeconds<=3600,'Время кодинга: 60–3600 секунд.');}
 else{const rule=input.numeric||{};requireValue(typeof rule.expected!=='boolean'&&parseNumeric(rule.expected)!==null,'Укажите правильное число.');q.numeric={expected:Number(rule.expected),tolerance:Number(rule.tolerance||0),decimals:rule.decimals===null||rule.decimals===''||rule.decimals===undefined?null:Number(rule.decimals),equivalents:(rule.equivalents||[]).map(x=>text(x,100))};requireValue(Number.isFinite(q.numeric.expected)&&Number.isFinite(q.numeric.tolerance)&&q.numeric.tolerance>=0&&(q.numeric.decimals===null||(Number.isInteger(q.numeric.decimals)&&q.numeric.decimals>=0&&q.numeric.decimals<=10)),'Некорректное правило числового ответа.');requireValue(q.numeric.equivalents.every(v=>parseNumeric(v)!==null&&correctAnswer({...q,numeric:{...q.numeric,equivalents:[]}},v)),'Эквивалентные записи должны соответствовать ключу, округлению и погрешности.');}
 return q;
}
export function parseNumeric(value){const s=String(value??'').trim().replace(/\u2212/g,'-').replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
export function correctAnswer(q,answer){if(answer===null||answer===undefined||answer==='')return false;if(q.format==='choice')return answer===q.correct;if(q.format==='coding')return answer?.judged===true&&answer.correct===true;const n=parseNumeric(answer);if(n===null)return false;const rule=q.numeric;let values=[rule.expected,...rule.equivalents.map(parseNumeric).filter(v=>v!==null)];const round=x=>rule.decimals===null?x:Number(x.toFixed(rule.decimals));return values.some(v=>Math.abs(round(n)-round(v))<=rule.tolerance+Number.EPSILON*Math.max(1,Math.abs(v))*4);}
function validateSpec(b){
 const skillModule=moduleFor(b.moduleId);requireValue(skillModule,'Неизвестный модуль.');const s={moduleId:skillModule.id,scoredCount:Number(b.scoredCount),questionSeconds:Number(b.questionSeconds),numericMin:Number(b.numericMin),numericMax:Number(b.numericMax),difficultyCounts:Object.fromEntries([1,2,3].map(k=>[k,Number(b.difficultyCounts?.[k])])),competencies:skillModule.competencies,thresholds:Object.fromEntries(['Junior','Middle','Senior'].map(k=>[k,Number(b.thresholds?.[k])]))};
 requireValue(Number.isInteger(s.scoredCount)&&s.scoredCount>=3&&s.scoredCount<=60,'Количество вопросов: от 3 до 60.');
 s.codingCount=Number(b.codingCount||0);s.codingSeconds=Number(b.codingSeconds||600);requireValue(Number.isInteger(s.codingCount)&&s.codingCount>=0&&s.codingCount<=3&&Number.isInteger(s.codingSeconds)&&s.codingSeconds>=60&&s.codingSeconds<=3600,'Кодинг: 0–3 задания по 60–3600 секунд.');const fixed=mixedCodingSpec(s);Object.assign(s,{scoredCount:fixed.scoredCount,difficultyCounts:fixed.difficultyCounts,adaptive:fixed.adaptive,codingCount:0,codingPerPart:2,codingSeconds:300,scoring:fixed.scoring});
 if(!b.adaptive){s.numericMin=fixed.numericMin;s.numericMax=fixed.numericMax;}
 requireValue(Object.values(s.difficultyCounts).every(n=>Number.isInteger(n)&&n>=1)&&Object.values(s.difficultyCounts).reduce((a,b)=>a+b,0)===s.scoredCount,'Распределение сложности должно совпадать с числом вопросов и включать все три уровня.');
 requireValue(Number.isInteger(s.questionSeconds)&&s.questionSeconds>=1&&s.questionSeconds<=3600,'Время на вопрос: от 1 до 3600 секунд.');s.seconds=s.scoredCount*s.questionSeconds;s.experimentalSeconds=s.questionSeconds;
 requireValue(Number.isInteger(s.numericMin)&&Number.isInteger(s.numericMax)&&s.numericMin>=0&&s.numericMax>=s.numericMin&&s.numericMax<=s.scoredCount,'Неверные ограничения числовых вопросов.');
 const t=s.thresholds;requireValue(t.Junior>0&&t.Junior<t.Middle&&t.Middle<t.Senior&&t.Senior<=100,'Пороги должны возрастать: Junior < Middle < Senior ≤ 100.');return s;
}
// Backtracking enforces difficulty, answer formats, competencies and one instance per family.
export function assemble(available,spec,seen=new Set(),exposure=new Map()){
 const weighted=available.filter(q=>q.format!=='coding').map(q=>({q,seen:seen.has(q.id),rank:(exposure.get(q.familyId)||0)*10+(exposure.get('question:'+q.id)||0)*4+crypto.getRandomValues(new Uint32Array(1))[0]/2**32})).sort((a,b)=>Number(a.seen)-Number(b.seen)||a.rank-b.rank).map(x=>x.q);
 let visits=0;
 function search(start,chosen,families,counts,numerics,covered){
  if(++visits>250000)return null;
  if(chosen.length===spec.scoredCount)return numerics>=spec.numericMin&&spec.competencies.every(c=>covered.has(c))?chosen:null;
  if(weighted.length-start<spec.scoredCount-chosen.length)return null;
  for(let i=start;i<weighted.length;i++){const q=weighted[i];if(families.has(q.familyId)||counts[q.difficulty]>=spec.difficultyCounts[q.difficulty]||(q.format==='numeric'&&numerics>=spec.numericMax))continue;
   const result=search(i+1,[...chosen,q],new Set([...families,q.familyId]),{...counts,[q.difficulty]:counts[q.difficulty]+1},numerics+(q.format==='numeric'?1:0),new Set([...covered,...q.competencies]));if(result)return result;
  }return null;
 }
 const result=search(0,[],new Set(),{1:0,2:0,3:0},0,new Set());requireValue(result,'Пул не позволяет собрать вариант по спецификации. Добавьте семейства, компетенции и нужные форматы.',409);return result;
}
// Reserve experimental families first; they never compensate the scored blueprint.
export function assembleVariant(pool,spec,experimentalCount,seen=new Set(),exposure=new Map()){
 const working=pool.filter(q=>q.scored);
 if(!experimentalCount)return assemble(working,spec,seen,exposure);
 const experimental=pool.filter(q=>!q.scored).map(q=>({q,seen:seen.has(q.id),rank:(exposure.get(q.familyId)||0)*10+(exposure.get('question:'+q.id)||0)*4+crypto.getRandomValues(new Uint32Array(1))[0]/2**32})).sort((a,b)=>Number(a.seen)-Number(b.seen)||a.rank-b.rank).map(x=>x.q);
 let visits=0;
 function search(start,extra,families){
  if(++visits>5000)return null;
  if(extra.length===experimentalCount){try{return [...assemble(working.filter(q=>!families.has(q.familyId)),spec,seen,exposure),...extra];}catch(e){if(e.status!==409)throw e;return null;}}
  for(let i=start;i<experimental.length;i++){const q=experimental[i];if(families.has(q.familyId))continue;const result=search(i+1,[...extra,q],new Set([...families,q.familyId]));if(result)return result;}
  return null;
 }
 const result=search(0,[],new Set());requireValue(result,'Пул не позволяет собрать зачётный вариант и отдельные экспериментальные семейства.',409);return result;
}
function assembleAdaptivePart(pool,spec,counts,route,experimentalCount,seen,exposure){
 if(!isMixedCodingRule(spec.adaptive.rule))return assembleVariant(pool,partSpec(spec,counts),experimentalCount,seen,exposure);
 const codingCounts=spec.adaptive.codingDifficultyCounts[route],coding=[];
 const candidates=pool.filter(q=>q.scored&&q.format==='coding'&&!legacyCodingIds.has(q.id)).map(q=>({q,seen:seen.has(q.id),rank:(exposure.get(q.familyId)||0)*10+(exposure.get('question:'+q.id)||0)*4+Math.random()})).sort((a,b)=>Number(a.seen)-Number(b.seen)||a.rank-b.rank);
 for(const difficulty of [1,2,3])for(let n=0;n<codingCounts[difficulty];n++){
  const picked=candidates.find(({q})=>q.difficulty===difficulty&&!coding.some(c=>c.familyId===q.familyId));
  requireValue(picked,'Недостаточно разных семейств кодинга нужной сложности.',409);coding.push(picked.q);
 }
 const ordinarySpec={...partSpec(spec,counts),scoredCount:16-coding.length,difficultyCounts:Object.fromEntries([1,2,3].map(d=>[d,counts[d]-codingCounts[d]]))};
 const families=new Set(coding.map(q=>q.familyId));
 return [...assembleVariant(pool.filter(q=>!families.has(q.familyId)),ordinarySpec,experimentalCount,seen,exposure),...coding];
}
// Spread the two coding tasks through each scored part, never into a separate tail.
function orderPart(questions,spec){
 if(!isMixedCodingRule(spec.adaptive?.rule))return [...shuffleQuestions(questions.filter(q=>q.format!=='coding')),...questions.filter(q=>q.format==='coding')];
 const coding=shuffleQuestions(questions.filter(q=>q.scored&&q.format==='coding'));
 const ordinary=shuffleQuestions(questions.filter(q=>q.scored&&q.format!=='coding'));
 const mixed=Array.from({length:16},(_,i)=>i===4||i===11?coding.shift():ordinary.shift());
 return [...mixed,...shuffleQuestions(questions.filter(q=>!q.scored))];
}
// Both routes are frozen before start; only the route decision depends on answers.
export function assembleAdaptiveVariant(pool,spec,experimentalCount=0,seen=new Set(),exposure=new Map()){
 requireValue([ADAPTIVE_RULE,LEGACY_MIXED_CODING_RULE,MIXED_CODING_RULE].includes(spec.adaptive?.rule),'Неизвестная адаптивная спецификация.',409);
 for(let attempt=0;attempt<8;attempt++){
  try{
   const first=assembleAdaptivePart(pool,spec,spec.adaptive.firstDifficultyCounts,'first',experimentalCount,seen,exposure);
   const families=new Set(first.map(q=>q.familyId));
   const available=pool.filter(q=>q.scored&&!families.has(q.familyId));
   const routes=Object.fromEntries(Object.entries(spec.adaptive.routes).map(([route,counts])=>[route,assembleAdaptivePart(available,spec,counts,route,0,seen,exposure)]));
   return {first,routes};
  }catch(e){if(e.status!==409)throw e;}
 }
 throw new ApiError(409,'Пул должен покрывать первую часть и обе ветки второй части без повторов семейств.');
}
function shuffleQuestions(assigned){return assigned.map(q=>{
 const saved=clone(q);
 if(saved.format==='choice'){
  const options=saved.options.map((value,index)=>({value,index,rank:crypto.getRandomValues(new Uint32Array(1))[0]})).sort((a,b)=>a.rank-b.rank);
  saved.options=options.map(o=>o.value);saved.correct=options.findIndex(o=>o.index===q.correct);
 }
 return {q:saved,order:crypto.getRandomValues(new Uint32Array(1))[0]};
}).sort((a,b)=>a.order-b.order).map(x=>x.q);}
const level=(score,t)=>['Senior','Middle','Junior'].find(g=>score>=t[g])||'Ниже Junior';
function moduleResult(m){
 const scored=m.questions.filter(q=>q.scored),correct=scored.filter(q=>correctAnswer(q,m.answers[q.id]?.value)).length;
 const scoring=m.spec.adaptive?adaptiveScore(m,correctAnswer):{score:Math.round(correct/scored.length*100)},score=scoring.score;
 return {moduleId:m.moduleId,name:moduleFor(m.moduleId).name,specVersion:m.spec.version,...scoring,correct,total:scored.length,skipped:scored.filter(q=>!m.answers[q.id]||m.answers[q.id].value===null||m.answers[q.id].value===''||(q.format==='coding'&&!m.answers[q.id]?.value?.source?.trim())).length,level:isEvidenceScoringRule(scoring.scoreRule)?['Senior','Middle','Junior'].find(g=>meetsModuleGrade({...scoring,thresholds:m.spec.thresholds},g))||'Ниже Junior':level(score,m.spec.thresholds),thresholds:m.spec.thresholds,completedAt:m.completedAt};
}
function roleResult(t){const role=roleFor(t.targetId);if(!role)return null;const results=t.modules.map(m=>m.result).filter(Boolean);const completed=results.length===t.modules.length;const grade=completed?['Senior','Middle','Junior'].find(g=>results.every(r=>meetsModuleGrade(r,g)))||'Ниже Junior':null;return {roleId:role.id,name:role.name,completed,level:grade,...(completed?roleGradeOutcome(results,t.targetGrade,t.roleOutcomeRule||'target-grade-next-achieved-v1'):{}),requirements:results.map(r=>({moduleId:r.moduleId,score:r.score,thresholds:r.thresholds,...(r.gradeRequirements?{theoryScore:r.theoryScore,codingScore:r.codingScore,gradeRequirements:clone(r.gradeRequirements)}:{})})),integration:results.find(r=>r.moduleId===role.integration)||null};}
const resultsAvailable=t=>t.targetKind!=='role'||t.status!=='active';
const candidateResults=t=>resultsAvailable(t)?t.modules.map(m=>m.result).filter(Boolean):[];
const candidateRoleResult=t=>resultsAvailable(t)?t.finalRoleResult||roleResult(t):{roleId:t.targetId,name:t.name,completed:false,level:null,requirements:[],integration:null};
export function assessmentView(t){const m=t.modules[t.moduleIndex];const hide=q=>({id:q.id,prompt:q.prompt,format:q.format,options:q.options,...(q.format==='coding'?{coding:{...codingContract(q.coding),submission:codingSubmissionView(m,q.id),input:m.codingInputs?.[q.id]??q.coding.tests.find(t=>t.public)?.stdin??'',language:q.coding.language,starter:q.coding.starter,tests:q.coding.tests.filter(t=>t.public)}}:{})});return {id:t.id,targetId:t.targetId,targetKind:t.targetKind,targetGrade:t.targetGrade||null,name:t.name,status:t.status,created:t.created,dayId:t.dayId,dayVersion:t.dayVersion,sessionName:t.sessionName,revision:t.revision,moduleIndex:t.moduleIndex,modules:t.modules.map((m,i)=>({id:m.moduleId,name:moduleFor(m.moduleId).name,status:m.status,result:resultsAvailable(t)?m.result:undefined,questionCount:m.spec.scoredCount+(m.experimentalCount||0)+(m.spec.codingCount||0),partCount:m.spec.adaptive?2:1,seconds:m.seconds,integration:moduleFor(m.moduleId).integration,available:i===t.moduleIndex})),currentModule:m?.status==='active'?{id:m.moduleId,name:moduleFor(m.moduleId).name,expiresAt:m.expiresAt,startedAt:m.startedAt,questionStartedAt:m.questionStartedAt,questionSeconds:m.questionSeconds,seconds:m.seconds,partIndex:m.adaptive?.selectedRoute?1:0,partCount:m.spec.adaptive?2:1,partQuestionIndex:m.adaptive?.selectedRoute?Math.max(0,m.questions.findIndex(q=>q.id===m.activeQuestionId)-(m.adaptive.firstLength)):Math.max(0,m.questions.findIndex(q=>q.id===m.activeQuestionId)),partQuestionCount:m.spec.adaptive?(m.adaptive?.selectedRoute?16:m.adaptive.firstLength):m.questions.length,totalQuestionCount:m.spec.scoredCount+(m.experimentalCount||0)+(m.spec.codingCount||0),questionIndex:Math.max(0,m.questions.findIndex(q=>q.id===m.activeQuestionId)),questions:m.questions.map(q=>q.id===m.activeQuestionId?hide(q):{id:q.id}),answers:{...Object.fromEntries(Object.entries(m.answers).map(([id,a])=>[id,a.value&&typeof a.value==='object'?a.value.source:a.value])),...m.codingDrafts}}:null,nextModuleAt:t.nextModuleAt||null,resultsAvailable:resultsAvailable(t),results:candidateResults(t),roleResult:candidateRoleResult(t),serverTime:now()};}
async function saveAttempt(repo,t,revision){t.revision=revision+1;requireValue(await repo.saveAssessment(t,revision),'Попытка уже обновилась. Перезагрузите состояние и повторите действие.',409);}
function recordQuestionTime(m){if(!m.activeQuestionId||!m.activeSince)return;const view=m.views[m.activeQuestionId];if(view)view.activeMs=(view.activeMs||0)+Math.max(0,Math.min(now(),m.expiresAt)-m.activeSince);m.activeSince=Math.min(now(),m.expiresAt);}
async function closeModule(repo,a,t){const m=t.modules[t.moduleIndex];recordQuestionTime(m);m.status='completed';m.completedAt=now();m.result=moduleResult(m);const role=roleFor(t.targetId);if(t.moduleIndex===t.modules.length-1){t.status='finished';t.completedAt=now();t.nextModuleAt=null;}else t.nextModuleAt=now()+t.breakSeconds*1000;
 // Profile verification is only awarded by a completed role; skill results remain independent.
 if(t.status==='finished'&&role){
  t.finalRoleResult=roleResult(t);const r=t.finalRoleResult,p=a.profile;
  const passed=GRADES.includes(r.level),changed=p.spec!==role.spec||p.grade!==r.level;
  r.locked=!!(passed&&p.verified&&changed&&p.gradeChangedAt&&now()<p.gradeChangedAt+COOLDOWN);
  r.lower=!!(passed&&p.verified&&p.spec===role.spec&&GRADES.indexOf(r.level)<GRADES.indexOf(p.grade));
  r.applied=passed&&!r.locked&&!r.lower;
  if(r.applied){const at=now();a.profile={...p,spec:role.spec,grade:r.level,score:Math.min(...t.modules.map(m=>m.result.score)),competencies:t.modules.filter(m=>!moduleFor(m.moduleId).integration).map(m=>({name:moduleFor(m.moduleId).name,status:'confirmed',score:m.result.score,source:'Тест роли',verifiedAt:at})),verificationAttemptId:t.id,verified:true,verifiedAt:at,gradeChangedAt:changed||!p.verified?at:p.gradeChangedAt,updated:at};}
 }
}
function openQuestion(m,index){const q=m.questions[index],at=now();m.activeQuestionId=q.id;m.questionStartedAt=at;m.questionSeconds=q.format==='coding'?(m.spec.codingSeconds||q.questionSeconds||600):(m.spec.questionSeconds||20);m.expiresAt=at+m.questionSeconds*1000;m.activeSince=at;m.views[q.id]={firstAt:at,lastAt:at};}
function openModule(m){m.status='active';m.startedAt=now();openQuestion(m,0);}
async function advanceQuestion(repo,a,t){
 const codingModule=t.modules[t.moduleIndex],codingQuestion=codingModule.questions.find(q=>q.id===codingModule.activeQuestionId);if(codingQuestion?.format==='coding'&&!codingModule.answers[codingQuestion.id]?.value?.judged)codingModule.answers[codingQuestion.id]={value:null,savedAt:now()};
 const m=t.modules[t.moduleIndex],index=m.questions.findIndex(q=>q.id===m.activeQuestionId);
 if(m.adaptive&&!m.adaptive.selectedRoute&&index===m.adaptive.firstLength-1){
  const decision=routingDecision(m,correctAnswer);m.adaptive.selectedRoute=decision.route;m.adaptive.decision={...decision,at:now()};
  m.questions.push(...clone(m.adaptive.routes[decision.route]));openQuestion(m,index+1);
 }else if(index===m.questions.length-1)await closeModule(repo,a,t);else openQuestion(m,index+1);
}
async function advanceExpiry(repo,a,t){
 const m=t.modules[t.moduleIndex];if(t.status!=='active')return t;
 // Upgrade unfinished attempts from the former module timer; finished records stay untouched.
 if(t.timingRule!=='per-question-v1'){const revision=t.revision;t.timingRule='per-question-v1';for(const part of t.modules)if(part.status!=='completed'){part.spec=timedSpec(part.spec);part.questionSeconds=part.spec.questionSeconds;part.seconds=part.questions.length*part.questionSeconds;}if(m.status==='active')openQuestion(m,Math.max(0,m.questions.findIndex(q=>q.id===m.activeQuestionId)));try{await saveAttempt(repo,t,revision);}catch(e){if(e.status!==409)throw e;return await repo.record(t.id);}}
 if(m.status==='active'&&now()>=m.expiresAt){const revision=t.revision;recordQuestionTime(m);m.answers[m.activeQuestionId]={...m.answers[m.activeQuestionId],value:m.answers[m.activeQuestionId]?.value??null,savedAt:m.answers[m.activeQuestionId]?.savedAt??m.expiresAt,confirmedAt:m.expiresAt,draft:false,timedOut:true};await advanceQuestion(repo,a,t);try{await saveAttempt(repo,t,revision);}catch(e){if(e.status!==409)throw e;return await repo.record(t.id);}if(t.status==='finished')await repo.saveAccount(a);}return t;
}
function summary(t){return {id:t.id,name:t.name,targetKind:t.targetKind,targetId:t.targetId,created:t.created,status:t.status,dayVersion:t.dayVersion,employerHiddenResults:t.employerHiddenResults||{},resultsAvailable:resultsAvailable(t),results:candidateResults(t),roleResult:candidateRoleResult(t)};}
export async function assessmentState(repo,a){
 const all=(await repo.scoped('assessment',a.id)).filter(t=>t.owner===a.id);let active=all.find(t=>t.status==='active');if(active){active=await advanceExpiry(repo,a,active);all[all.findIndex(row=>row.id===active.id)]=active;}
 const registrations=(await repo.scoped('assessment-registration',a.id)).filter(r=>r.owner===a.id);const days=(await repo.records('test-day')).filter(d=>d.status==='published'&&d.closesAt>now());
 return {modules:MODULES,roles:ROLES,specifications:latestSpecs(await specifications(repo)).map(s=>({...s})),days:days.map(d=>({id:d.id,name:d.name,opensAt:d.opensAt,closesAt:d.closesAt,version:d.version,breakSeconds:d.breakSeconds,tools:d.tools,experimentalCounts:d.experimentalCounts,moduleConfigs:dayConfigs(d)})),registrations,active:active?.status==='active'?assessmentView(active):null,history:all.filter(t=>!t.hiddenFromHistory).map(summary),hiddenHistory:all.filter(t=>t.hiddenFromHistory).map(t=>({id:t.id,name:t.name,created:t.created,status:t.status,hiddenAt:t.hiddenAt})),maintainer:!!a.maintainer};
}
export async function employerAssessmentProjection(repo,account){
 const attempts=(await repo.scoped('assessment',account.id)).filter(t=>t.owner===account.id);
 const latest=latestAssessmentResults(attempts.map(t=>({...summary(t),hiddenFromHistory:t.hiddenFromHistory})));
 const role=ROLES.find(r=>r.spec===account.profile.spec),current=latest.find(r=>r.kind==='role'&&r.id===role?.id);
 const proof=account.profile.verificationAttemptId?attempts.find(t=>t.id===account.profile.verificationAttemptId):attempts.find(t=>t.targetId===role?.id&&t.status==='finished'&&t.modules.every(m=>m.result)&&Math.abs(t.completedAt-account.profile.verifiedAt)<1000&&Math.min(...t.modules.map(m=>m.result.score))===account.profile.score);
 const hiddenProof=current?.hidden||proof?.hiddenFromHistory||proof?.employerHiddenResults?.['role:'+proof?.targetId]||(account.profile.verificationAttemptId&&!proof);
 const profile=hiddenProof?{...account.profile,verified:false,score:null,grade:null,verifiedAt:null,verificationAttemptId:undefined,competencies:(account.profile.competencies||[]).filter(c=>c.source!=='Тест роли')}:account.profile;
 return {profile,confirmedResults:latest.filter(r=>!r.hidden).map(({id,name,kind,score,level,completedAt,targetGrade,confirmedGrade,confirmedPlus,potentialHigher,outcomeStatus})=>({id,name,kind,score,level,completedAt,...(kind==='role'?{targetGrade,confirmedGrade,confirmedPlus,potentialHigher,status:outcomeStatus}:{})}))};
}
function exposureStats(attempts){const questions=new Map(),families=new Map();for(const t of attempts)for(const m of t.modules)for(const q of m.questions){if(!m.views?.[q.id])continue;questions.set(q.id,(questions.get(q.id)||0)+1);families.set(q.familyId,(families.get(q.familyId)||0)+1);}return{questions,families};}
function combinedExposure(stats){return new Map([...stats.families,...[...stats.questions].map(([id,count])=>['question:'+id,count])]);}
export async function maintainerState(repo,a){assertAdmin(a);const [questions,specs,days,attempts]=await Promise.all([bank(repo),specifications(repo),repo.records('test-day'),repo.records('assessment')]);const exposure=exposureStats(attempts);const analytics=questions.map(q=>{let shown=0,answered=0,correct=0,skipped=0,totalMs=0;const distractors=[0,0,0,0],groups={low:{n:0,correct:0},medium:{n:0,correct:0},high:{n:0,correct:0}};
 for(const t of attempts)for(const m of t.modules){const instance=m.questions.find(x=>x.id===q.id&&x.version===q.version);if(!instance||!m.views?.[q.id])continue;shown++;const answer=m.answers[q.id];if(m.status!=='completed')continue;const isCorrect=correctAnswer(instance,answer?.value);if(answer?.value===null||answer?.value===undefined||answer?.value==='')skipped++;else answered++;if(isCorrect)correct++;if(instance.format==='choice'&&Number.isInteger(answer?.value))distractors[q.options.indexOf(instance.options[answer.value])]++;totalMs+=m.views[q.id]?.activeMs||answer?.activeMs||0;const bucket=m.result.score<50?'low':m.result.score<80?'medium':'high';groups[bucket].n++;groups[bucket].correct+=isCorrect?1:0;}
 return{id:q.id,shown,answered,correct,skipped,correctRate:answered+skipped?correct/(answered+skipped):null,averageMs:answered?Math.round(totalMs/answered):null,distractors,groups};});
 return {questions:questions.map(q=>({...q,exposure:exposure.questions.get(q.id)||0,familyExposure:exposure.families.get(q.familyId)||0})),specifications:specs,days:days.map(({pool,...d})=>({...d,questionIds:pool?.map(q=>q.id)||[],poolCounts:pool?Object.fromEntries(MODULES.map(m=>[m.id,pool.filter(q=>q.moduleId===m.id).length])):{}})),analytics,modules:MODULES,roles:ROLES};
}
// Each published bank revision gets its own immutable daily pool. Existing attempts keep theirs.
export const DAILY_POOL_REVISION='mixed-v7-expanded-bank';
export function dailyPoolWindow(at=now()){
 const offset=3*3600000,opensAt=Math.floor((at+offset)/86400000)*86400000-offset;
 const date=new Date(opensAt+offset).toISOString().slice(0,10);
 return {id:'daily-pool-'+date,date,opensAt,closesAt:opensAt+86400000};
}
function buildDayPool(pool,selected,experimentalCounts,expectedCandidates,exposures){
 return selected.flatMap(spec=>{
     const available=pool.filter(q=>q.moduleId===spec.moduleId);
     if(spec.adaptive){const tree=assembleAdaptiveVariant(available,spec,experimentalCounts[spec.moduleId],new Set(),exposures);const ids=new Set([...tree.first,...Object.values(tree.routes).flat()].map(q=>q.id));const reserve=available.filter(q=>q.scored&&q.format!=='coding'&&!ids.has(q.id)).sort((a,b)=>(exposures.get(a.familyId)||0)-(exposures.get(b.familyId)||0)).slice(0,Math.max(6,Math.ceil(Math.log10(expectedCandidates))*3));
     // Keep alternatives at every coding difficulty in the daily pool; a single
     // preassembled tree would otherwise give everyone the same first-part pair.
     const coding=isMixedCodingRule(spec.adaptive.rule)?[1,2,3].flatMap(d=>{
      const candidates=available.filter(q=>q.scored&&q.format==='coding'&&!legacyCodingIds.has(q.id)&&q.difficulty===d).sort((a,b)=>(exposures.get(a.familyId)||0)-(exposures.get(b.familyId)||0)||(exposures.get('question:'+a.id)||0)-(exposures.get('question:'+b.id)||0));
      const families=new Set();return candidates.filter(q=>{if(families.has(q.familyId))return false;families.add(q.familyId);return true;}).slice(0,10);
     }):available.filter(q=>q.scored&&q.format==='coding').slice(0,spec.codingCount||0);requireValue(isMixedCodingRule(spec.adaptive.rule)?[1,2,3].every(d=>coding.filter(q=>q.difficulty===d).length>=2):coding.length===(spec.codingCount||0),'Недостаточно заданий на кодинг.',409);return [...new Map([...tree.first,...Object.values(tree.routes).flat(),...reserve,...coding].map(q=>[q.id,q])).values()];}
     const assigned=assembleVariant(available,spec,experimentalCounts[spec.moduleId],new Set(),exposures),chosen=new Set(assigned.map(q=>q.id));const reserve=Math.max(1,Math.min(3,Math.ceil(Math.log10(expectedCandidates))));const extra=[],families=new Set(assigned.map(q=>q.familyId));for(let i=0;i<reserve;i++){const remaining=available.filter(q=>q.scored&&!chosen.has(q.id)).sort((a,b)=>Number(families.has(a.familyId))-Number(families.has(b.familyId))||(exposures.get(a.familyId)||0)-(exposures.get(b.familyId)||0)||(exposures.get('question:'+a.id)||0)-(exposures.get('question:'+b.id)||0));if(!remaining.length)break;extra.push(remaining[0]);chosen.add(remaining[0].id);families.add(remaining[0].familyId);}return [...assigned,...extra];
    });
}
export async function ensureDailyPool(repo,at=now()){
 const window={...dailyPoolWindow(at),id:dailyPoolWindow(at).id+'-'+DAILY_POOL_REVISION},existing=await repo.record(window.id);
 if(existing){requireValue(existing.kind==='test-day'&&existing.status==='published','Суточный пул недоступен.',409);return existing;}
 const questions=(await bank(repo)).filter(q=>['working','experimental'].includes(q.status)).map(q=>({...clone(q),scored:q.status==='working'}));
 const specs=latestSpecs(await specifications(repo));
 const experimentalCounts=Object.fromEntries(MODULES.map(m=>[m.id,questions.some(q=>q.moduleId===m.id&&!q.scored&&q.format!=='coding')?1:0]));
 const exposure=combinedExposure(exposureStats(await repo.records('assessment')));
 const pool=buildDayPool(questions,specs,experimentalCounts,100,exposure);
 const day=record('test-day',{...window,name:'Пул вопросов · '+window.date,schedule:'daily',bankRevision:'2026-10-10',scoringRevision:SCORING_RULE,timezone:'Europe/Moscow',status:'published',version:1,publishedAt:at,moduleIds:MODULES.map(m=>m.id),specs:clone(specs),experimentalCounts,pool,expectedCandidates:100,breakSeconds:60,tools:'Встроенная песочница, стандартная библиотека выбранного языка.'});
 // The API and scheduler use transaction(); insert-only also protects callers in different processes.
 return await repo.putIfAbsent('test-day',day);
}
function candidateDay(day){return {id:day.id,name:day.name,opensAt:day.opensAt,closesAt:day.closesAt,version:day.version,schedule:day.schedule||'scheduled',breakSeconds:day.breakSeconds,tools:day.tools,experimentalCounts:day.experimentalCounts,moduleConfigs:dayConfigs(day)};}
export async function assessmentAction(repo,a,b){const act=b.action;
 if(act.startsWith('maintainer-')){
  assertAdmin(a);
  if(act==='maintainer-state')return {admin:await maintainerState(repo,a)};
  if(act==='maintainer-question-save'){
   const data=validateQuestion(b.question),old=b.id?(await bank(repo)).find(q=>q.id===b.id):null;if(b.id)requireValue(old,'Вопрос не найден.',404);
   const q=record('question',{...data,version:(old?.version||0)+1,previousId:old?.id||null,status:'draft',history:[{at:now(),by:a.id,status:'draft',reason:old?'Новая версия вопроса':'Новый вопрос'}]},a.id);await repo.put('question',q);return {message:'Черновик сохранён. Для показа подтвердите содержательную проверку.',question:q};
  }
  if(act==='maintainer-question-decision'){
   const q=(await bank(repo)).find(q=>q.id===b.id);requireValue(q,'Вопрос не найден.',404);const decision=b.decision;requireValue(['experiment','admit','collect','reject','retire'].includes(decision),'Неизвестное решение.');requireValue(text(b.reason,3000).length>=10,'Укажите обоснование решения (от 10 символов).');
   if(decision==='experiment'){requireValue(q.status==='draft'&&b.reviewed===true,'Подтвердите проверку условия, ключа и компетенций.');validateQuestion(q);}
   if(['admit','collect'].includes(decision))requireValue(q.status==='experimental','Решение относится к экспериментальному вопросу.');
   if(decision==='admit')requireValue([1,2,3].includes(Number(b.difficulty)),'Назначьте сложность.');
   if(decision==='retire')requireValue(q.status==='working','В архив можно убрать только рабочий вопрос.');
   const status={experiment:'experimental',admit:'working',collect:'experimental',reject:'rejected',retire:'retired'}[decision];const updated={...q,owner:q.owner||'platform',status,difficulty:decision==='admit'?Number(b.difficulty):q.difficulty,history:[...q.history,{at:now(),by:a.id,decision,status,reason:text(b.reason,3000)}]};await repo.put('question',updated);return {message:'Решение сохранено. Действующие пулы и оценки не меняются.'};
  }
  if(act==='maintainer-spec-save'){const s=validateSpec(b.spec),all=await specifications(repo);const version=Math.max(...all.filter(x=>x.moduleId===s.moduleId).map(x=>x.version))+1;const row=record('module-spec',{...s,version},a.id);await repo.put('module-spec',row);return {message:'Новая версия спецификации сохранена. Действующие дни используют прежнюю.'};}
  if(act==='maintainer-day-save'){
   const previous=b.id?await repo.record(b.id):null;if(b.id)requireValue(previous?.kind==='test-day'&&previous.status==='draft','Изменять можно только черновик пула.',409);const opensAt=Number(b.opensAt),closesAt=Number(b.closesAt),breakSeconds=Number(b.breakSeconds||0),expectedCandidates=Number(b.expectedCandidates||100);requireValue(Number.isInteger(expectedCandidates)&&expectedCandidates>0&&expectedCandidates<=100000,'Укажите ожидаемое число участников (1–100000).');requireValue(Number.isFinite(opensAt)&&closesAt>opensAt&&closesAt>now(),'Укажите будущую сессию с корректным временем.');requireValue(Number.isInteger(breakSeconds)&&breakSeconds>=0&&breakSeconds<=3600,'Перерыв: от 0 до 3600 секунд.');requireValue(text(b.name,100),'Укажите название сессии.');
   const experimentalCounts=Object.fromEntries(MODULES.map(m=>[m.id,Number(b.experimentalCounts?.[m.id]||0)]));requireValue(Object.values(experimentalCounts).every(n=>Number.isInteger(n)&&n>=0&&n<=10),'Экспериментальных позиций: от 0 до 10 на модуль.');
   const moduleIds=Array.isArray(b.moduleIds)?b.moduleIds:MODULES.map(m=>m.id);requireValue(moduleIds.length>0&&moduleIds.every(x=>moduleFor(x)),'Выберите модули.');
   const all=await specifications(repo),selected=latestSpecs(all).filter(s=>moduleIds.includes(s.moduleId));const questions=await bank(repo);const selectedIds=Array.isArray(b.questionIds)?b.questionIds:null;const pool=questions.filter(q=>moduleIds.includes(q.moduleId)&&['working','experimental'].includes(q.status)&&(!selectedIds||selectedIds.includes(q.id))).map(q=>({...clone(q),scored:q.status==='working'}));
   let finalPool=pool;
   if(!selectedIds){
    const exposures=combinedExposure(exposureStats(await repo.records('assessment')));
    finalPool=buildDayPool(pool,selected,experimentalCounts,expectedCandidates,exposures);
   }
   const row=record('test-day',{name:text(b.name,100),opensAt,closesAt,breakSeconds,tools:text(b.tools||'Без внешних инструментов',1000),experimentalCounts,moduleIds,specs:selected,pool:finalPool,status:'draft',expectedCandidates,version:(previous?.version||0)+1,...(previous?{id:previous.id,created:previous.created,updatedAt:now()}: {})},a.id);if(previous)requireValue(await repo.saveDay(row,previous.version,'draft'),'Пул уже изменён или зафиксирован. Загрузите актуальное состояние.',409);else await repo.put('test-day',row);return {message:'Черновик пула сохранён. Проверьте его и зафиксируйте перед сессией.',dayId:row.id};
  }
  if(act==='maintainer-day-publish'){
   const day=await repo.record(b.id);requireValue(day&&day.kind==='test-day'&&day.status==='draft','Пул недоступен для публикации.',409);requireValue(day.opensAt>now(),'Пул фиксируется до начала сессии.');
   for(const spec of day.specs){const pool=day.pool.filter(q=>q.moduleId===spec.moduleId);(spec.adaptive?assembleAdaptiveVariant:assembleVariant)(pool,spec,day.experimentalCounts[spec.moduleId]);requireValue(pool.filter(q=>q.scored&&q.format==='coding').length>=(spec.codingCount||0),'Недостаточно заданий на кодинг.',409);}
   day.status='published';day.publishedAt=now();day.moduleConfigs=dayConfigs(day);requireValue(await repo.saveDay(day,day.version,'draft'),'Пул уже изменён или зафиксирован.',409);return{message:'Пул дня зафиксирован. Кандидаты могут записываться.'};
  }
  throw new ApiError(400,'Неизвестная операция мейнтейнера.');
 }
 assertCandidate(a);
 if(act==='assessment-result-visibility'){
  const attempt=await repo.record(b.id);requireValue(attempt&&attempt.kind==='assessment'&&attempt.owner===a.id,'Попытка недоступна.',404);
  requireValue(['finished','incomplete'].includes(attempt.status),'Сначала завершите текущую попытку.',409);
  requireValue(typeof b.hidden==='boolean'&&['skill','role'].includes(b.targetKind),'Укажите результат и его видимость.');
  const valid=b.targetKind==='skill'?attempt.modules.some(m=>m.moduleId===b.targetId&&m.status==='completed'&&m.result&&!moduleFor(m.moduleId)?.integration):attempt.targetKind==='role'&&attempt.targetId===b.targetId&&attempt.status==='finished'&&roleResult(attempt)?.completed;
  requireValue(valid,'Результат не относится к этой попытке.',404);
  requireValue(await repo.setAssessmentResultVisibility(attempt.id,a.id,b.targetKind+':'+b.targetId,b.hidden,now()),'Попытка уже изменилась. Обновите страницу.',409);
  return {message:b.hidden?'Результат скрыт от работодателей.':'Результат виден работодателям.'};
 }
 if(['assessment-history-hide','assessment-history-restore'].includes(act)){
  const attempt=await repo.record(b.id);requireValue(attempt&&attempt.kind==='assessment'&&attempt.owner===a.id,'Попытка недоступна.',404);
  requireValue(['finished','incomplete'].includes(attempt.status),'Сначала завершите текущую попытку.',409);
  const hidden=act==='assessment-history-hide';requireValue(await repo.setAssessmentVisibility(attempt.id,a.id,hidden,now()),'Попытка уже изменилась. Обновите страницу.',409);
  return {message:hidden?'Тест удалён из истории и резюме. Его можно вернуть в разделе «Удалённые из истории».':'Тест возвращён в историю и резюме.'};
 }
 if(act==='assessment-cancel-registration'){
  const registration=await repo.record(b.id);requireValue(registration&&registration.kind==='assessment-registration'&&registration.owner===a.id,'Запись недоступна.',404);
  if(registration.status==='cancelled')return {message:'Запись уже отменена.'};
  requireValue(registration.status==='registered','Тест уже начат. Завершите попытку в интерфейсе теста.',409);
  requireValue(await repo.cancelRegistration(registration.id,a.id,now()),'Запись уже изменилась. Обновите страницу.',409);return {message:'Запись на тест отменена.'};
 }
 if(act==='assessment-prepare'){
  const role=roleFor(b.targetId),skill=moduleFor(b.targetId);requireValue(role||(skill&&!skill.integration),'Выберите навык или роль.');
  const day=await ensureDailyPool(repo);
  return {preparation:{targetId:b.targetId,targetKind:role?'role':'skill',name:role?.name||skill.name,day:candidateDay(day)}};
 }
 if(act==='assessment-register'){
  const day=await repo.record(b.dayId),role=roleFor(b.targetId),skillModule=moduleFor(b.targetId);requireValue(day&&day.kind==='test-day'&&day.status==='published'&&day.closesAt>now(),'Сессия недоступна.',404);requireValue(role||(skillModule&&!skillModule.integration),'Выберите навык или роль.');const ids=role?[...role.modules,role.integration]:[skillModule.id];requireValue(ids.every(x=>day.moduleIds.includes(x)),'Этот тест не доступен в выбранную дату.');
  const existing=(await repo.scoped('assessment-registration',a.id)).find(r=>r.dayId===day.id&&r.targetId===b.targetId&&r.status==='registered');if(existing)return {registration:existing,message:'Вы уже записаны.'};
  requireValue(!role||b.targetGrade===undefined||ROLE_GRADES.includes(b.targetGrade),'Выберите Junior, Middle или Senior.');const registration=record('assessment-registration',{dayId:day.id,targetGrade:role?(b.targetGrade||'Middle'):null,targetId:b.targetId,targetKind:role?'role':'skill',name:role?.name||skillModule.name,dayName:day.name,opensAt:day.opensAt,closesAt:day.closesAt,status:'registered'},a.id);await repo.put('assessment-registration',registration);return {registration,message:'Запись на тестирование сохранена.'};
 }
 if(act==='assessment-start'){
  requireValue(b.rulesAccepted===true,'Подтвердите правила сессии и возможное присутствие незачётных вопросов.');const attempts=(await repo.scoped('assessment',a.id)).filter(t=>t.owner===a.id);const active=attempts.find(t=>t.status==='active');if(active){const refreshed=await advanceExpiry(repo,a,active);if(refreshed.status==='active')return{assessment:assessmentView(refreshed)};}
  let registration,day;
  if(b.targetId){const role=roleFor(b.targetId),skill=moduleFor(b.targetId);requireValue(role||(skill&&!skill.integration),'Выберите навык или роль.');day=await ensureDailyPool(repo);registration={targetId:b.targetId,targetKind:role?'role':'skill',name:role?.name||skill.name};}
  else{registration=await repo.record(b.registrationId);requireValue(registration&&registration.kind==='assessment-registration'&&registration.owner===a.id&&registration.status==='registered','Запись недоступна.',404);day=await repo.record(registration.dayId);requireValue(day?.status==='published'&&now()>=day.opensAt&&now()<day.closesAt,'Сессия ещё не началась или уже закрыта.',409);}
  const role=roleFor(registration.targetId);const targetGrade=role?(b.targetGrade||registration.targetGrade||'Middle'):null;requireValue(!role||ROLE_GRADES.includes(targetGrade),'Выберите Junior, Middle или Senior.');const ids=role?[...role.modules,role.integration]:[registration.targetId];const configs=dayConfigs(day),totalSeconds=ids.reduce((n,moduleId)=>n+configs[moduleId].seconds,0)+(ids.length-1)*day.breakSeconds;requireValue(day.schedule==='daily'||now()+totalSeconds*1000<=day.closesAt,'До конца сессии недостаточно времени для полного теста.',409);
  const seen=new Set(),familyExposure=combinedExposure(exposureStats(await repo.records('assessment')));for(const t of attempts)for(const m of t.modules)for(const q of m.questions)if(m.views?.[q.id])seen.add(q.id);
  const modules=ids.map(moduleId=>{
   const spec=timedSpec(day.specs.find(s=>s.moduleId===moduleId)),pool=day.pool.filter(q=>q.moduleId===moduleId),experimentalCount=day.experimentalCounts[moduleId]||0;
   const tree=spec.adaptive?assembleAdaptiveVariant(pool,spec,experimentalCount,seen,familyExposure):null;
   const questions=tree?orderPart(tree.first,spec):shuffleQuestions(assembleVariant(pool,spec,experimentalCount,seen,familyExposure));
   const coding=pool.filter(q=>q.scored&&q.format==='coding').sort((x,y)=>Number(seen.has(x.id))-Number(seen.has(y.id))).slice(0,spec.codingCount||0);requireValue(coding.length===(spec.codingCount||0),'Недостаточно заданий на кодинг.',409);if(tree)for(const qs of Object.values(tree.routes))qs.push(...coding);else questions.push(...coding);
   return {moduleId,spec:clone(spec),seconds:configs[moduleId].seconds,questionSeconds:spec.questionSeconds,experimentalCount,questions,answers:{},views:{},status:'pending',...(tree?{adaptive:{rule:spec.adaptive.rule,firstLength:questions.length,selectedRoute:null,routes:Object.fromEntries(Object.entries(tree.routes).map(([route,qs])=>[route,orderPart(qs,spec)]))}}:{})};
  });
  const t=record('assessment',{name:registration.name,targetId:registration.targetId,targetKind:registration.targetKind,targetGrade,dayId:day.id,dayVersion:day.version,sessionName:day.name,sessionClosesAt:day.schedule==='daily'?null:day.closesAt,poolSchedule:day.schedule||'scheduled',tools:day.tools,timingRule:'per-question-v1',scoreRule:modules.find(m=>isEvidenceScoringRule(m.spec.scoring?.rule))?.spec.scoring.rule||(modules.some(m=>m.spec.adaptive)?'difficulty-weighted-fixed-scale-v1':'binary-percentage-v1'),roleRule:'all-required-thresholds-v1',roleOutcomeRule:ROLE_OUTCOME_RULE,registrationId:registration.id,modules,moduleIndex:0,revision:0,status:'active',breakSeconds:day.breakSeconds},a.id);const m=t.modules[0];openModule(m);requireValue(await repo.startAssessment(t,registration.id?registration:null),'Попытка уже запущена в другой вкладке. Загрузите актуальное состояние.',409);return {assessment:assessmentView(t)};
 }
 let t=await repo.record(b.id);requireValue(t&&t.kind==='assessment'&&t.owner===a.id,'Попытка недоступна.',404);const current=t.modules[t.moduleIndex];const abandoningCode=act==='assessment-abandon'&&current?.questions.some(q=>q.id===current.activeQuestionId&&q.format==='coding');if(!abandoningCode)t=await advanceExpiry(repo,a,t);
 if(act==='assessment-resume')return {assessment:assessmentView(t)};
 requireValue(t.status==='active','Попытка завершена.',409);requireValue(Number.isInteger(b.revision)&&b.revision===t.revision,'Состояние изменилось. Загрузите актуальную попытку.',409);const revision=t.revision,m=t.modules[t.moduleIndex];
 if(act==='assessment-abandon'){t.status='incomplete';t.completedAt=now();t.finalRoleResult=roleResult(t);await saveAttempt(repo,t,revision);return {assessment:assessmentView(t),message:'Незавершённый тест сохранён. Результаты закрытых модулей остаются.'};}
 if(act==='assessment-next-module'){requireValue(m.status==='completed'&&now()>=t.nextModuleAt,'Дождитесь окончания перерыва.',409);const remaining=t.modules.slice(t.moduleIndex+1).reduce((n,m)=>n+m.seconds,0)+Math.max(0,t.modules.length-t.moduleIndex-2)*t.breakSeconds;requireValue(t.poolSchedule==='daily'||now()+remaining*1000<=t.sessionClosesAt,'Сессия завершилась или оставшегося времени недостаточно. Сохраните попытку как незавершённую.',409);t.moduleIndex++;const next=t.modules[t.moduleIndex];openModule(next);t.nextModuleAt=null;await saveAttempt(repo,t,revision);return {assessment:assessmentView(t)};}
 requireValue(m.status==='active','Модуль уже закрыт.',409);
 if(act==='assessment-answer'||act==='assessment-draft'||act==='assessment-run-code'||act==='assessment-submit-code'||act==='assessment-code-input'){
  const q=m.questions.find(q=>q.id===b.questionId);requireValue(q,'Вопрос не относится к открытому модулю.');requireValue(q.id===m.activeQuestionId,'Вопрос уже закрыт или ещё не открыт.',409);
  if(act==='assessment-run-code'){requireValue(q.format==='coding','Это не задание на кодинг.');return {run:await runCodeInput(q,b.source,b.stdin??q.coding.tests.find(t=>t.public)?.stdin??'')};}
  if(act==='assessment-code-input'){requireValue(q.format==='coding','Это не задание на кодинг.');requireValue(typeof b.stdin==='string'&&Buffer.byteLength(b.stdin)<=8000,'Ввод должен быть текстом не более 8 КБ.');(m.codingInputs??={})[q.id]=b.stdin;await saveAttempt(repo,t,revision);return {assessment:assessmentView(t)};}
  if(act==='assessment-submit-code'){
   requireValue(q.format==='coding','Это не задание на кодинг.');requireValue(typeof b.submissionId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(b.submissionId),'Некорректный идентификатор отправки.');
   const submissions=(m.codingSubmissions??={})[q.id]??=[];
   if(submissions.some(s=>s.id===b.submissionId))return {assessment:assessmentView(t)};
   requireValue(submissions.length<3,'Все 3 попытки отправки использованы.',409);
   const checked=await runCode(q,b.source),value={source:b.source,judged:true,correct:checked.correct,passed:checked.passed,total:checked.total};
   submissions.push({id:b.submissionId,at:now(),source:b.source,passed:checked.passed,total:checked.total,results:checked.results.map(r=>r.passed)});
   (m.codingDrafts??={})[q.id]=b.source;
   if(!m.answers[q.id]?.value?.judged||checked.passed>=m.answers[q.id].value.passed)m.answers[q.id]={value,savedAt:now()};
   recordQuestionTime(m);await saveAttempt(repo,t,revision);return {assessment:assessmentView(t)};
  }
  if(q.format==='coding'){
   requireValue(act==='assessment-draft'||b.answer===null,'Используйте «Отправить» для проверки кода.');
   if(act==='assessment-draft'){requireValue(typeof b.answer==='string'&&Buffer.byteLength(b.answer)<=20000,'Введите код до 20 КБ.');(m.codingDrafts??={})[q.id]=b.answer;if(b.stdin!==undefined){requireValue(typeof b.stdin==='string'&&Buffer.byteLength(b.stdin)<=8000,'Ввод должен быть текстом не более 8 КБ.');(m.codingInputs??={})[q.id]=b.stdin;}await saveAttempt(repo,t,revision);return {assessment:assessmentView(t)};}
   recordQuestionTime(m);await advanceQuestion(repo,a,t);await saveAttempt(repo,t,revision);if(t.status==='finished')await repo.saveAccount(a);return {assessment:assessmentView(t)};
  }
  if(b.answer!==null){if(q.format==='coding')requireValue(typeof b.answer==='string'&&b.answer.length<=20000,'Введите код до 20 КБ.');else if(q.format==='choice')requireValue(Number.isInteger(b.answer)&&b.answer>=0&&b.answer<4,'Выберите один из четырёх вариантов.');else requireValue(parseNumeric(b.answer)!==null,'Введите число, например 12,5.');}
  recordQuestionTime(m);m.answers[q.id]={value:q.format==='coding'&&b.answer!==null?{source:b.answer,judged:false}:q.format==='numeric'&&b.answer!==null?text(b.answer,100):b.answer,savedAt:now(),draft:act==='assessment-draft'};if(act==='assessment-draft'){await saveAttempt(repo,t,revision);return{assessment:assessmentView(t),message:'Выбор сохранён.'};}await advanceQuestion(repo,a,t);await saveAttempt(repo,t,revision);if(t.status==='finished')await repo.saveAccount(a);return{assessment:assessmentView(t),message:'Ответ сохранён.'};
 }
 if(act==='assessment-view'){requireValue(b.questionId===m.activeQuestionId,'Вопрос уже закрыт или ещё не открыт.',409);return{assessment:assessmentView(t)};}
 if(act==='assessment-submit-module')throw new ApiError(409,'Отвечайте на вопросы по очереди. Модуль завершится после последнего вопроса.');
 throw new ApiError(400,'Неизвестная операция тестирования.');
}

function codingSubmissionView(m,id){const attempts=m.codingSubmissions?.[id]||[],last=attempts.at(-1);return {used:attempts.length,limit:3,...(last?{passed:last.passed,total:last.total,results:last.results}:{})};}
