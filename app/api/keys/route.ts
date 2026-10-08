import {getAppUser} from '../../app-auth';
import {transaction} from '../../../lib/postgres.mjs';
import {listApiKeys,createApiKey,revokeApiKey} from '../../../lib/api-keys.mjs';
import {rateLimit} from '../../../lib/auth.mjs';
import {checkOrigin,jsonBody,httpError,errorResponse} from '../../../lib/http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request) {
 try {
  const reading=['GET','HEAD'].includes(request.method);
  if(!reading)checkOrigin(request);
  const user=await getAppUser();
  if(!user)throw httpError('Войдите в аккаунт.',401);
  if(reading)return Response.json({keys:await listApiKeys(user.userId)},{headers:{'Cache-Control':'no-store'}});
  const body=await jsonBody(request,2000);
  if(request.method==='POST')await rateLimit('api-key:create:'+user.userId,10,600000);
  const result=await transaction(async(_repo,db)=>request.method==='POST'?createApiKey(user.userId,body,db):revokeApiKey(user.userId,body.id,db));
  return Response.json(result,{status:request.method==='POST'?201:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){return errorResponse(error);}
}
export const GET=handle;
export const POST=handle;
export const DELETE=handle;
