import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../app-auth';
import {repository} from '../../../../lib/service.mjs';
import {resumePDFResponse} from '../../../../lib/resume-pdf.mjs';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const user=await getAppUser();
  if(!user)return Response.json({error:'Войдите в аккаунт.'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(!env.DB)throw new Error('Database binding unavailable');
  const account=await repository(env.DB).account(user.userId);
  return await resumePDFResponse(account);
 }catch(error){
  const status=(error as {status?:number}).status||500;
  return Response.json({error:status===500?'Не удалось сформировать PDF. Попробуйте ещё раз.':(error as Error).message},{status,headers:{'Cache-Control':'no-store'}});
 }
}
