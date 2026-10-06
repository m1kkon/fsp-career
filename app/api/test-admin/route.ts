import { env } from 'cloudflare:workers';
import { repository } from '../../../lib/service.mjs';
import { assessmentAction, maintainerState } from '../../../lib/assessments.mjs';
const maintainer = {id:'public-test-maintainer',maintainer:true};
export async function GET(){
 try{
  if(!env.DB)throw new Error('Database binding unavailable');
  return Response.json({admin:await maintainerState(repository(env.DB),maintainer)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Не удалось загрузить банк вопросов.'},{status:500});}
}
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Недопустимый источник запроса.'},{status:403});
  if(Number(request.headers.get('content-length')||0)>30000)return Response.json({error:'Слишком большой запрос.'},{status:413});
  const body=await request.json() as Record<string, unknown>;
  const allowed=['maintainer-state','maintainer-question-save','maintainer-question-decision','maintainer-spec-save','maintainer-day-save','maintainer-day-publish'];
  if(!body||typeof body.action!=='string'||!allowed.includes(body.action))return Response.json({error:'Неизвестная операция управления тестами.'},{status:400});
  if(!env.DB)throw new Error('Database binding unavailable');
  return Response.json(await assessmentAction(repository(env.DB),maintainer,body),{headers:{'Cache-Control':'no-store'}});
 }catch(e){const status=(e as {status?:number}).status||500;return Response.json({error:status===500?'Не удалось сохранить данные.':e instanceof Error?e.message:'Ошибка запроса'},{status});}
}
