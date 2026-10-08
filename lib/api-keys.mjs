import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {getPool} from './postgres.mjs';
import {httpError} from './http.mjs';
import {rateLimit} from './auth.mjs';

const digest=token=>createHash('sha256').update(token).digest('hex');
const metadata=row=>({id:row.id,name:row.name,prefix:row.prefix,scopes:row.scopes,created:Number(row.created),expires:Number(row.expires),lastUsed:row.last_used===null?null:Number(row.last_used),revokedAt:row.revoked_at===null?null:Number(row.revoked_at)});
/** @param {import('pg').Pool | import('pg').PoolClient} db */
export async function listApiKeys(userId,db=getPool()) {
 return (await db.query('SELECT id,name,prefix,scopes,created,expires,last_used,revoked_at FROM api_keys WHERE user_id=$1 ORDER BY (revoked_at IS NULL AND expires>$2) DESC, created DESC LIMIT 100',[userId,Date.now()])).rows.map(metadata);
}
// Creation and revocation run inside transaction(), sharing the business lock.
/** @param {import('pg').Pool | import('pg').PoolClient} db */
export async function createApiKey(userId,body,db=getPool()) {
 const name=typeof body.name==='string'?body.name.trim():'';
 if(!name||name.length>80)throw httpError('Название ключа должно содержать от 1 до 80 символов.');
 const scopes=body.scopes??['read'];
 if(!Array.isArray(scopes)||scopes.length<1||scopes.length>2||!scopes.includes('read')||new Set(scopes).size!==scopes.length||scopes.some(s=>!['read','write'].includes(s)))throw httpError('Выберите чтение или чтение и запись.');
 const days=body.expiresInDays??90;
 if(![30,90].includes(days))throw httpError('Срок действия ключа: 30 или 90 дней.');
 const now=Date.now();
 if(!(await db.query('SELECT 1 FROM auth_users WHERE id=$1 AND verified_at IS NOT NULL',[userId])).rowCount)throw httpError('Подтвердите email.',403);
 if(Number((await db.query('SELECT count(*) FROM api_keys WHERE user_id=$1 AND revoked_at IS NULL AND expires>$2',[userId,now])).rows[0].count)>=10)throw httpError('Можно иметь до 10 действующих ключей. Отзовите ненужный.',409);
 const token='fsp_live_'+randomBytes(32).toString('hex');
 const row=(await db.query('INSERT INTO api_keys(id,user_id,name,token_hash,prefix,scopes,created,expires) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[randomUUID(),userId,name,digest(token),token.slice(0,17),scopes,now,now+days*86400000])).rows[0];
 return {key:metadata(row),token};
}
/** @param {import('pg').Pool | import('pg').PoolClient} db */
export async function revokeApiKey(userId,id,db=getPool()) {
 if(typeof id!=='string'||id.length>100)throw httpError('Укажите ID ключа.');
 const result=await db.query('UPDATE api_keys SET revoked_at=COALESCE(revoked_at,$3) WHERE id=$1 AND user_id=$2 RETURNING id',[id,userId,Date.now()]);
 if(!result.rowCount)throw httpError('Ключ не найден.',404);
 return {revoked:true};
}
/** @param {import('pg').Pool | import('pg').PoolClient} db */
export async function authenticateApiKey(request,db=getPool(),countRequest=true) {
 const token=request.headers.get('authorization')?.match(/^Bearer (fsp_live_[a-f0-9]{64})$/i)?.[1];
 if(!token)throw httpError('Передайте API-ключ в Authorization: Bearer.',401);
 const row=(await db.query(`SELECT k.id,k.user_id,k.scopes FROM api_keys k JOIN auth_users u ON u.id=k.user_id
 WHERE k.token_hash=$1 AND k.revoked_at IS NULL AND k.expires>$2 AND u.verified_at IS NOT NULL`,[digest(token),Date.now()])).rows[0];
 if(!row){if(countRequest)await rateLimit('api:invalid:'+ (request.headers.get('x-fsp-client-ip')||'local'),60,60000,db);throw httpError('Ключ недействителен, отозван или истёк.',401);}
 const writing=!['GET','HEAD'].includes(request.method);
 if(!countRequest){if(writing&&!row.scopes.includes('write'))throw httpError('У ключа нет права записи.',403);return {userId:row.user_id,scopes:row.scopes};}
 await rateLimit('api:user:'+row.user_id,120,60000,db);
 if(writing){
  if(!row.scopes.includes('write'))throw httpError('У ключа нет права записи.',403);
  await rateLimit('api:write:'+row.user_id,30,60000,db);
 }
 await db.query('UPDATE api_keys SET last_used=$2 WHERE id=$1 AND (last_used IS NULL OR last_used<$3)',[row.id,Date.now(),Date.now()-60000]);
 return {userId:row.user_id,scopes:row.scopes};
}
