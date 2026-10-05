import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {appSessionCookie} from '../../../lib/app-session.mjs';
import {repository,accountFor,getState,publicJobs} from '../../../lib/service.mjs';
import {seed} from '../../../lib/seed.mjs';

export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Недопустимый источник запроса.'},{status:403});
  const input=await request.json();
  if(!input||typeof input!=='object')return Response.json({error:'Некорректный запрос.'},{status:400});
  const body=input as {action?:unknown;role?:unknown};
  if(body.action==='logout'){
   let jobs=seed.jobs;
   try{if(env.DB)jobs=await publicJobs(repository(env.DB));}catch{}
   return Response.json({authenticated:false,jobs},{headers:{'Set-Cookie':appSessionCookie(true,request.url),'Cache-Control':'no-store'}});
  }
  if(body.action!=='login')return Response.json({error:'Неизвестное действие.'},{status:400});
  // Temporary identity bridge for Sites hosting. Email authentication will
  // replace this bridge; logout never calls the hosting signout endpoint.
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Сначала откройте сайт через вход хостинга.'},{status:401});
  if(!env.DB)throw new Error('Database binding unavailable');
  const repo=repository(env.DB),account=await accountFor(repo,{id:user.userId,email:user.email,name:user.displayName});
  return Response.json({authenticated:true,...await getState(repo,account,body.role==='employer'?'employer':'candidate')},{headers:{'Set-Cookie':appSessionCookie(false,request.url),'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Не удалось изменить состояние входа. Попробуйте ещё раз.'},{status:500,headers:{'Cache-Control':'no-store'}});}
}
