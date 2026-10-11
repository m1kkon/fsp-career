import {accountFor,action} from '../../lib/service.mjs';
import {bank} from '../../lib/assessments.mjs';

export function memoryRepository(){
 const accounts=new Map(),records=new Map(),clone=x=>x===undefined?null:structuredClone(x);
 const repo={account:async id=>clone(accounts.get(id)),accounts:async()=>[...accounts.values()].map(clone),saveAccount:async a=>accounts.set(a.id,clone(a)),record:async id=>clone(records.get(id)),records:async kind=>[...records.values()].filter(r=>r.kind===kind).map(clone),scoped:async(kind,id)=>[...records.values()].filter(r=>r.kind===kind&&(r.owner===id||r.recipient===id)).map(clone),put:async(kind,r)=>records.set(r.id,{...clone(r),kind}),remove:async(id,owner)=>{if(records.get(id)?.owner===owner)records.delete(id);},putIfAbsent:async(kind,r)=>{if(!records.has(r.id))await repo.put(kind,r);return repo.record(r.id);},saveAssessment:async(r,revision)=>{const old=records.get(r.id);if(old?.kind!=='assessment'||old.status!=='active'||old.owner!==r.owner||old.revision!==revision)return false;await repo.put('assessment',r);return true;},startAssessment:async(r,registration)=>{if([...records.values()].some(x=>x.kind==='assessment'&&x.owner===r.owner&&x.status==='active'))return false;if(registration){const old=records.get(registration.id);if(old?.status!=='registered')return false;await repo.put('assessment-registration',{...old,status:'started',attemptId:r.id});}await repo.put('assessment',r);return true;}};
 return repo;
}
export function serializedWriter(repo){let tail=Promise.resolve();return fn=>{const result=tail.then(()=>fn(repo));tail=result.catch(()=>{});return result;};}
export const survey=(overrides={})=>({action:'survey',careerGoal:'Сменить компанию',employmentStatus:'Работаю, открыт к предложениям',experienceYears:'3–5 лет',industry:'Финтех',spec:'Backend',grade:'Middle',primaryRole:'Разработчик',roles:['Разработчик'],technicalSkills:'Python, PostgreSQL',achievement:'Уменьшил время ответа API и подтвердил результат нагрузочными проверками.',projectSummary:'Разработка API и оптимизация PostgreSQL.',softSkills:['Коммуникация','Системное мышление'],softSkillExample:'Согласовал требования с командой и продуктом, затем проверил результат перед выпуском.',uncertaintyResponse:'Предлагаю варианты и уточняю критерий результата',feedbackPreference:'Формат не важен, важна конкретика',acceptedFormats:['Удалённо'],employmentTypes:['Полная занятость'],englishLevel:'C1',salaryMin:'180000',city:'Москва',relocation:'Готов обсудить',motivation:'Хочу развивать продукт и отвечать за измеримый результат работы команды.',...overrides});
export async function candidateAccount(repo,id='candidate'){
 const a=await accountFor(repo,{id,email:id+'@example.test',name:id});await action(repo,a,{action:'onboard',role:'candidate',name:id,consent:true});await action(repo,a,survey());return a;
}
export async function employerAccount(repo,id='employer'){
 const a=await accountFor(repo,{id,email:id+'@example.test',name:id});await action(repo,a,{action:'onboard',role:'employer',name:id,description:'Product engineering team',contact:a.email,consent:true});return a;
}
// A historical snapshot keeps a coding question open without requiring dozens
// of theory answers. The production dispatcher still validates ownership,
// deadline, revision and the actual coding contract on this stored attempt.
export async function codingAttempt(repo,a,{expiresAt=Date.now()+60000}={}){
 const q=(await bank(repo)).find(q=>q.moduleId==='python'&&q.format==='coding'&&q.status==='working');
 const at=Date.now(),t={id:'coding-'+a.id,owner:a.id,created:at,targetId:'python',targetKind:'skill',name:'Python',timingRule:'per-question-v1',revision:0,status:'active',moduleIndex:0,modules:[{moduleId:'python',spec:{version:1,scoredCount:1,codingCount:0,questionSeconds:60,thresholds:{Junior:50,Middle:70,Senior:90}},seconds:60,questionSeconds:60,experimentalCount:0,questions:[{...q,scored:true}],answers:{},views:{},status:'active',activeQuestionId:q.id,startedAt:at,questionStartedAt:at,expiresAt}],breakSeconds:0};await repo.put('assessment',t);return {attempt:t,question:q,body:{action:'assessment-submit-code',id:t.id,revision:0,questionId:q.id,source:'print(1)',submissionId:'submission-0001'}};
}
export const successfulJudge=q=>({correct:true,passed:q.coding.tests.length,total:q.coding.tests.length,results:q.coding.tests.map((_,i)=>({index:i+1,passed:true}))});
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
