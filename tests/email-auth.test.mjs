import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {authMail,encryptMail,decryptMail,sendMail} from '../lib/mail.mjs';
import {authenticate,currentUser} from '../lib/auth.mjs';
import {createApiKey,authenticateApiKey} from '../lib/api-keys.mjs';
import {requestAuthEmail,completeEmailAction,EMAIL_REQUEST_MESSAGE} from '../lib/email-auth.mjs';
import {deliverQueuedMail} from '../lib/mail-worker.mjs';
const mailEnv={RESEND_API_KEY:'test-only',EMAIL_FROM:'ФСП Карьера <test@example.test>',MAIL_TOKEN_KEY:'b'.repeat(64),APP_URL:'https://example.test'};
function env(){const old={};for(const [k,v] of Object.entries(mailEnv)){old[k]=process.env[k];process.env[k]=v;}return()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}};}
test('outbox encryption authenticates ciphertext and mail links keep tokens in the fragment',async()=>{
 const restore=env();try{
  const token='a'.repeat(64),message=authMail('recipient@example.test','reset',token),payload=encryptMail(message);
  assert.equal(payload.includes(token),false);assert.equal(payload.includes('recipient'),false);assert.deepEqual(decryptMail(payload),message);
  const bytes=Buffer.from(payload,'base64');bytes[30]^=1;assert.throws(()=>decryptMail(bytes.toString('base64')));
  const link=message.text.match(/https:\/\/\S+/)[0];const url=new URL(link);assert.equal(url.search,'');assert.match(url.hash,/^#reset-password\?token=/);
  let captured;
  await sendMail(message,'test-id',async(url,options)=>{captured={url,options};return Response.json({id:'test'});});
  assert.equal(captured.url,'https://api.resend.com/emails');assert.equal(captured.options.headers['Idempotency-Key'],'auth-mail/test-id');
  await assert.rejects(sendMail(message,'id',async()=>new Response('private provider data',{status:429})),e=>e.code==='MAIL_HTTP_429'&&!e.message.includes('private'));
 }finally{restore();}
});
test('PostgreSQL email auth: ownership, expiry, single-use, recovery and mail retries',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(url.pathname.endsWith('_test'));
 const admin=new pg.Pool({connectionString:url.href}),schema='mail_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA "${schema}"`);
 const pool=new pg.Pool({connectionString:url.href,options:`-c search_path=${schema}`,max:8}),restore=env();globalThis.__fspPool=pool;const previousDatabase=process.env.DATABASE_URL;process.env.DATABASE_URL=url.href;
 const request=new Request('https://example.test',{headers:{'x-fsp-client-ip':'mail-test'}}),body={action:'register',terms:true,email:'owner@example.test',password:'a sufficiently long password'};
 const tokenFrom=async purpose=>{
  const row=(await pool.query('SELECT o.payload,t.token_hash FROM auth_mail_outbox o JOIN auth_email_tokens t USING(token_hash) WHERE t.purpose=$1 ORDER BY t.created DESC LIMIT 1',[purpose])).rows[0];
  assert.ok(row);const text=decryptMail(row.payload).text,token=text.match(/token=([a-f0-9]{64})/)[1];assert.equal(createHash('sha256').update(token).digest('hex'),row.token_hash);assert.equal(row.payload.includes(token),false);return token;
 };
 try{
  for(const name of ['001_initial.sql','002_email_auth.sql','004_api_keys.sql'])await pool.query(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
  let user,first,session;
  await t.test('registration queues email, exposes no token/session and unverified users cannot sign in',async()=>{
   const pending=await authenticate(body,request);user=pending.account;assert.equal(pending.pendingVerification,true);assert.equal(pending.token,null);first=await tokenFrom('verify');
   assert.equal((await pool.query('SELECT count(*) FROM auth_sessions')).rows[0].count,'0');
   assert.equal((await authenticate({...body,action:'login'},request)).pendingVerification,true);
   await assert.rejects(authenticate({...body,action:'login',password:'wrong'},request),e=>e.status===401);
   await assert.rejects(completeEmailAction({action:'reset-password',token:first,password:body.password},pool),e=>e.status===400);
  });
  await t.test('resending retires old links, unknown addresses have the same public response',async()=>{
   const before=(await pool.query('SELECT count(*) FROM auth_mail_outbox')).rows[0].count;
   const missing=await requestAuthEmail({action:'request-verification',email:'absent@example.test'},request,pool);
   assert.equal((await pool.query('SELECT count(*) FROM auth_mail_outbox')).rows[0].count,before);
   const known=await requestAuthEmail({action:'request-verification',email:body.email},request,pool);assert.deepEqual(missing,known);assert.equal(known.message,EMAIL_REQUEST_MESSAGE);
   await assert.rejects(completeEmailAction({action:'verify-email',token:first},pool),e=>e.status===400);
   first=await tokenFrom('verify');
  });
  await t.test('verification link expires and can be consumed only once, including simultaneous requests',async()=>{
   await pool.query('UPDATE auth_email_tokens SET expires=$1',[Date.now()-1]);await assert.rejects(completeEmailAction({action:'verify-email',token:first},pool),e=>e.status===400);
   await requestAuthEmail({action:'request-verification',email:body.email},request,pool);first=await tokenFrom('verify');
   const results=await Promise.allSettled([completeEmailAction({action:'verify-email',token:first},pool),completeEmailAction({action:'verify-email',token:first},pool)]);
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
   session=(await authenticate({...body,action:'login'},request)).token;assert.equal((await currentUser('fsp_session='+session,pool)).userId,user.id);
  });
  await t.test('recovery is generic and valid reset revokes all sessions and sibling links',async()=>{
   const apiKey=await createApiKey(user.id,{name:'Recovery integration'},pool);
   const known=await requestAuthEmail({action:'forgot-password',email:body.email},request,pool),unknown=await requestAuthEmail({action:'forgot-password',email:'unknown@example.test'},request,pool);assert.deepEqual(known,unknown);
   const reset=await tokenFrom('reset');await assert.rejects(completeEmailAction({action:'verify-email',token:reset},pool),e=>e.status===400);
   await assert.rejects(completeEmailAction({action:'reset-password',token:reset,password:'weak'},pool),e=>e.status===400);
   const password='a different sufficiently long password';await completeEmailAction({action:'reset-password',token:reset,password},pool);
   assert.equal(await currentUser('fsp_session='+session,pool),null);assert.equal((await pool.query('SELECT count(*) FROM auth_email_tokens WHERE user_id=$1',[user.id])).rows[0].count,'0');
   await assert.rejects(authenticateApiKey(new Request('https://example.test/api/v1/me',{headers:{Authorization:'Bearer '+apiKey.token}}),pool),e=>e.status===401);
   await assert.rejects(completeEmailAction({action:'reset-password',token:reset,password},pool),e=>e.status===400);
   await assert.rejects(authenticate({...body,action:'login'},request),e=>e.status===401);assert.ok((await authenticate({...body,action:'login',password},request)).token);
  });
  await t.test('mail failures retain encrypted jobs, retry idempotently and competing workers send once',async()=>{
   await requestAuthEmail({action:'forgot-password',email:body.email},request,pool);
   const failed=await deliverQueuedMail(pool,async()=>{throw Object.assign(new Error('secret provider content'),{code:'MAIL_HTTP_503'});});assert.equal(failed.failed,1);
   const job=(await pool.query('SELECT * FROM auth_mail_outbox')).rows[0];assert.equal(job.attempts,1);assert.equal(job.last_error,'MAIL_HTTP_503');assert.ok(job.next_attempt>Date.now());
   await pool.query('UPDATE auth_mail_outbox SET next_attempt=0');let sent=0;
   await Promise.all([deliverQueuedMail(pool,async(_message,id)=>{assert.equal(id,job.id);sent++;await new Promise(resolve=>setTimeout(resolve,20));}),deliverQueuedMail(pool,async()=>{sent++;})]);
   assert.equal(sent,1);assert.equal((await pool.query('SELECT count(*) FROM auth_mail_outbox')).rows[0].count,'0');
  });
 }finally{delete globalThis.__fspPool;restore();if(previousDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousDatabase;await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});
