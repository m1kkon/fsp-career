import {randomUUID} from 'node:crypto';
import {getPool,transaction} from './postgres.mjs';
import {authenticateApiKey} from './api-keys.mjs';
import {candidateCatalog,publicJobs,getState,action} from './service.mjs';
import {selectedNeed,stackNames} from './matching.mjs';
import {SPECS,GRADES,FORMATS} from './taxonomy.mjs';
import {httpError,jsonBody} from './http.mjs';

export const API_ACTIONS=['onboard','profile','resume-details','survey','settings','company','fsp-link','fsp-unlink','favorite','need','delete-need','invite','invite-status','job','job-status','apply','application-status','task','task-answer','task-review','message'];
const fold=v=>String(v??'').toLocaleLowerCase('ru').replaceAll('ё','е');
const candidateParams=['query','spec','grade','stack','city','format','fsp','synthetic','favorites','salaryMin','salaryMax','minScore','sort','limit','offset','team','budgetMin','budgetMax','confirmed'];
function parameters(url,allowed) {
 const p=Object.fromEntries(url.searchParams);
 for(const key of url.searchParams.keys())if(!allowed.includes(key)||url.searchParams.getAll(key).length!==1)throw httpError('Неизвестный или повторяющийся параметр: '+key);
 return p;
}
function integer(p,key,min,max,fallback) {
 if(p[key]===undefined)return fallback;
 if(!/^\d+$/.test(p[key])||Number(p[key])<min||Number(p[key])>max)throw httpError(`Параметр ${key}: целое число от ${min} до ${max}.`);
 return Number(p[key]);
}
function enumValue(p,key,values,fallback='') {
 if(p[key]===undefined)return fallback;
 if(!values.includes(p[key]))throw httpError('Недопустимый параметр '+key+'. Допустимо: '+values.join(', '));
 return p[key];
}
function boundedText(p,key,max) {
 if(p[key]!==undefined&&p[key].length>max)throw httpError('Слишком длинный параметр '+key+'.');
 return (p[key]||'').trim();
}
export function paginate(rows,p) {
 const limit=integer(p,'limit',1,100,20),offset=integer(p,'offset',0,100000,0);
 return {data:rows.slice(offset,offset+limit),pagination:{total:rows.length,limit,offset,nextOffset:offset+limit<rows.length?offset+limit:null}};
}
export function searchOptions(p) {
 const spec=enumValue(p,'spec',SPECS),grade=enumValue(p,'grade',GRADES),format=enumValue(p,'format',FORMATS);
 const options={spec,grade,format,query:boundedText(p,'query',2000),team:boundedText(p,'team',2000),city:boundedText(p,'city',80),stack:stackNames(boundedText(p,'stack',800).split(',').map(s=>s.trim()).filter(Boolean)),fsp:enumValue(p,'fsp',['all','with','without'],'all'),synthetic:enumValue(p,'synthetic',['true','false']),favorites:enumValue(p,'favorites',['true','false']),sort:enumValue(p,'sort',['match','strength','score','salary','name'],'match'),minScore:integer(p,'minScore',0,100,0)};
 if(options.stack.length>20)throw httpError('Можно указать до 20 технологий.');
 for(const key of ['salaryMin','salaryMax','budgetMin','budgetMax'])options[key]=integer(p,key,1,10000000,null);
 for(const [min,max] of [['salaryMin','salaryMax'],['budgetMin','budgetMax']])if(options[min]&&options[max]&&options[min]>options[max])throw httpError(max+' должен быть не меньше '+min+'.');
 options.confirmed=enumValue(p,'confirmed',['true','false'])==='true'||!!(spec&&grade);
 // Validate pagination even if a need is ambiguous or no rows are available.
 paginate([],p);
 return options;
}
export function filterCandidates(rows,o,favorites=[]) {
 const result=rows.filter(c=>(!o.spec||c.spec===o.spec)&&(!o.grade||c.grade===o.grade)&&(!o.format||c.format===o.format)&&(!o.city||fold(c.city).includes(fold(o.city)))&&o.stack.every(s=>stackNames(c.stack).some(t=>fold(t).includes(fold(s))))&&(o.fsp==='all'||(o.fsp==='with'?!!c.fsp?.achievements?.length:!c.fsp?.achievements?.length))&&(!o.synthetic||c.synthetic===(o.synthetic==='true'))&&(!o.favorites||favorites.includes(c.id)===(o.favorites==='true'))&&c.score>=o.minScore&&(!o.salaryMin||(Number.isFinite(c.max??c.min)&&(c.max??c.min)>=o.salaryMin))&&(!o.salaryMax||(Number.isFinite(c.min??c.max)&&(c.min??c.max)<=o.salaryMax)));
 const compare={strength:(a,b)=>b.match.strength-a.match.strength||b.score-a.score,score:(a,b)=>b.score-a.score,salary:(a,b)=>(a.min??a.max??Infinity)-(b.min??b.max??Infinity),name:(a,b)=>String(a.name).localeCompare(String(b.name),'ru')};
 if(compare[o.sort])result.sort((a,b)=>compare[o.sort](a,b)||String(a.id).localeCompare(String(b.id)));
 return result;
}
function hasRole(a,role) {if(!a.roles.includes(role))throw httpError('Сначала создайте профиль '+(role==='employer'?'компании.':'кандидата.'),403);}
async function runAction(repo,a,body) {
 if(!API_ACTIONS.includes(body.action))throw httpError('Операция недоступна в публичном API. Список: GET /api/v1/taxonomy.');
 if(body.action==='delete-need'){const record=await repo.record(body.id);if(!record||record.kind!=='need'||record.owner!==a.id)throw httpError('Подборка не найдена.',404);}
 if(body.action==='favorite'){const current=(await repo.scoped('favorite',a.id)).some(f=>f.owner===a.id&&f.candidateId===body.candidateId);if(!current&&!(await candidateCatalog(repo,a,null)).candidates.some(c=>c.id===body.candidateId))throw httpError('Кандидат не найден или скрыт.',404);}
 let record;
 const result=await action({...repo,put:async(kind,row)=>{await repo.put(kind,row);record={...row,kind};}},a,body);
 return {data:{...result,...(record?{record}:{})}};
}
export async function dispatchPublicApi(repo,a,request) {
 const url=new URL(request.url),method=request.method==='HEAD'?'GET':request.method;
 let path;try{path=url.pathname.slice('/api/v1/'.length).split('/').map(decodeURIComponent);}catch{throw httpError('Некорректный адрес API.');}
 const resource=path[0];if(path.some(part=>part.length>100))throw httpError('Слишком длинный адрес API.');
 if(method==='GET'&&resource==='me'&&path.length===1){parameters(url,[]);return {data:{id:a.id,email:a.email,roles:a.roles,profile:a.profile,privacy:a.privacy,company:a.company}};}
 if(method==='GET'&&resource==='taxonomy'&&path.length===1){parameters(url,[]);return {data:{specializations:SPECS,grades:GRADES,formats:FORMATS,actions:API_ACTIONS,limits:{requestsPerMinute:120,writesPerMinute:30,maxPageSize:100}}};}
 if(method==='GET'&&resource==='candidates'&&path.length<=2){
  hasRole(a,'employer');
  if(path.length===2){parameters(url,[]);const item=(await candidateCatalog(repo,a,null)).candidates.find(c=>c.id===path[1]);if(!item)throw httpError('Кандидат не найден или скрыт.',404);return {data:item};}
  const p=parameters(url,candidateParams),o=searchOptions(p),need=o.query?selectedNeed(o.query,o):null;
  const bank=need&&!need.confirmed?{candidates:[],categories:[]}:await candidateCatalog(repo,a,need);
  const favorites=o.favorites?(await repo.scoped('favorite',a.id)).filter(f=>f.owner===a.id).map(f=>f.candidateId):[];
  return {...paginate(filterCandidates(bank.candidates,o,favorites),p),need,categories:bank.categories};
 }
 if(method==='GET'&&resource==='jobs'&&path.length<=2){
  if(path.length===2){parameters(url,[]);const item=(await publicJobs(repo)).find(j=>j.id===path[1]);if(!item)throw httpError('Вакансия не найдена.',404);return {data:item};}
  const p=parameters(url,['query','spec','grade','city','format','stack','salaryMin','salaryMax','synthetic','limit','offset']);
  const o=searchOptions(p),rows=(await publicJobs(repo)).filter(j=>(!o.query||fold([j.title,j.description,j.company,...j.stack].join(' ')).includes(fold(o.query)))&&(!o.spec||j.spec===o.spec)&&(!o.grade||j.grade===o.grade)&&(!o.city||fold(j.city).includes(fold(o.city)))&&(!o.format||j.format.startsWith(o.format))&&o.stack.every(s=>stackNames(j.stack).some(t=>fold(t).includes(fold(s))))&&(!o.synthetic||!!j.synthetic===(o.synthetic==='true'))&&(!o.salaryMin||Number.isFinite(j.max??j.min)&&(j.max??j.min)>=o.salaryMin)&&(!o.salaryMax||Number.isFinite(j.min??j.max)&&(j.min??j.max)<=o.salaryMax));
  rows.sort((x,y)=>(y.created||0)-(x.created||0)||String(x.id).localeCompare(String(y.id)));
  return paginate(rows,p);
 }
 if(method==='GET'&&['state','needs','invites','applications','messages','tasks','submissions','favorites'].includes(resource)&&path.length===1){
  const p=parameters(url,resource==='state'?['role']:['role','limit','offset','status','contextId']);
  const role=enumValue(p,'role',['candidate','employer'],a.roles.includes('employer')?'employer':'candidate');hasRole(a,role);
  if(['needs','favorites'].includes(resource))hasRole(a,'employer');
  const state=await getState(repo,a,role);
  if(resource==='state')return {data:state};
  let rows=state[resource];
  if(p.status)rows=rows.filter(r=>r.status===p.status);
  if(p.contextId)rows=rows.filter(r=>r.contextId===p.contextId);
  return paginate(rows,p);
 }
 if(method==='POST'&&resource==='actions'&&path.length===1){parameters(url,[]);const body=await jsonBody(request,60000);if(body.action!=='company'&&Buffer.byteLength(JSON.stringify(body))>30000)throw httpError('Слишком большой запрос.',413);return runAction(repo,a,body);}
 if(method==='POST'&&resource==='invites'&&path.length===1){parameters(url,[]);return runAction(repo,a,{...await jsonBody(request),action:'invite'});}
 if(['PUT','DELETE'].includes(method)&&resource==='favorites'&&path.length===2){
  parameters(url,[]);hasRole(a,'employer');const id=path[1];
  // Do not save a hidden or guessed candidate. Deletion remains possible after hiding.
  if(method==='PUT'&&!(await candidateCatalog(repo,a,null)).candidates.some(c=>c.id===id))throw httpError('Кандидат не найден или скрыт.',404);
  const current=(await repo.scoped('favorite',a.id)).find(f=>f.owner===a.id&&f.candidateId===id);
  if((method==='PUT'&&!current)||(method==='DELETE'&&current))await action(repo,a,{action:'favorite',candidateId:id});
  return {data:{candidateId:id,saved:method==='PUT'}};
 }
 throw httpError('Метод или адрес API не найден.',404);
}
export async function handlePublicApi(request,pool=getPool()) {
 const requestId=randomUUID(),headers={'Cache-Control':'no-store','X-Request-ID':requestId,'X-Content-Type-Options':'nosniff'};
 try {
  // Limits commit independently: a rejected business transaction still counts.
  await authenticateApiKey(request,pool);
  const result=await transaction(async(repo,db)=>{
   // Recheck under the same lock used by revocation, before admitting an action.
   const user=await authenticateApiKey(request,db,false),a=await repo.account(user.userId);
   if(!a)throw httpError('Аккаунт не найден.',401);
   return dispatchPublicApi(repo,a,request);
  },pool);
  return Response.json(result,{headers});
 }catch(error){
  const status=error.status||500;
  if(status>=500)console.error('Public API failed:',requestId,error.code||error.name);
  const codes={400:'BAD_REQUEST',401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',415:'UNSUPPORTED_MEDIA_TYPE',429:'RATE_LIMITED'};
  return Response.json({error:{code:codes[status]||'INTERNAL_ERROR',message:status>=500?'Не удалось выполнить запрос.':error.message},requestId},{status,headers:{...headers,...(status===401?{'WWW-Authenticate':'Bearer realm="fsp-career"'}:{}),...(status===429?{'Retry-After':'60'}:{})}});
 }
}
