import { env } from 'cloudflare:workers';
import { getAppUser } from '../../app-auth';
import {repository,accountFor,getState,publicJobs} from '../../../lib/service.mjs';
import {seed} from '../../../lib/seed.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await getAppUser();if(!user)return Response.json({authenticated:false,jobs:env.DB?await publicJobs(repository(env.DB)):seed.jobs},{headers:{'Cache-Control':'no-store'}});if(!env.DB)throw new Error('Database binding unavailable');const repo=repository(env.DB);const account=await accountFor(repo,{id:user.userId,email:user.email,name:user.displayName});const url=new URL(request.url);return Response.json({authenticated:true,...await getState(repo,account,url.searchParams.get('role')||'candidate',url.searchParams.get('query')||'',Object.fromEntries(url.searchParams))},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:'Не удалось загрузить данные сервиса.'},{status:500});}}
