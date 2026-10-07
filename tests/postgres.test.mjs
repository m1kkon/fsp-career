import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {repository,transaction} from '../lib/postgres.mjs';
import {accountFor,action,getState} from '../lib/service.mjs';
import {authenticate,currentUser,logout,rateLimit} from '../lib/auth.mjs';
import {completeEmailAction} from '../lib/email-auth.mjs';
import {decryptMail} from '../lib/mail.mjs';

test('PostgreSQL integration: persistence, rollback, concurrent writes, roles and sessions', {skip:!process.env.TEST_DATABASE_URL}, async t => {
 const url=new URL(process.env.TEST_DATABASE_URL);
 assert.ok(url.pathname.endsWith('_test'),'Use a dedicated database ending in _test');
 const admin=new pg.Pool({connectionString:url.href}), schema='test_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA "${schema}"`);
 const pool=new pg.Pool({connectionString:url.href,options:`-c search_path=${schema}`,max:8});
 globalThis.__fspPool=pool;process.env.DATABASE_URL=url.href;
 const previousEnv={...process.env};Object.assign(process.env,{RESEND_API_KEY:'test-only',EMAIL_FROM:'test@example.test',MAIL_TOKEN_KEY:'a'.repeat(64),APP_URL:'https://example.test'});
 try {
  await pool.query(await readFile(new URL('../db/migrations/001_initial.sql',import.meta.url),'utf8'));
  await pool.query(await readFile(new URL('../db/migrations/002_email_auth.sql',import.meta.url),'utf8'));
  const repo=repository(pool);
  await t.test('account and JSONB records round-trip through new queries and failed transactions roll back',async()=>{
   const a=await accountFor(repo,{id:'candidate',email:'candidate@example.test',name:'Кандидат'});
   await transaction(async repo=>{const current=await repo.account(a.id);current.profile.about='Сохранено';await repo.saveAccount(current);await repo.put('favorite',{id:'favorite',owner:a.id,candidateId:'target',created:123});},pool);
   assert.equal((await repository(pool).account(a.id)).profile.about,'Сохранено');
   assert.equal((await repo.scoped('favorite',a.id))[0].created,123);
   await assert.rejects(transaction(async repo=>{const current=await repo.account(a.id);current.profile.about='Откат';await repo.saveAccount(current);throw new Error('abort');},pool));
   assert.equal((await repo.account(a.id)).profile.about,'Сохранено');
  });
  await t.test('simultaneous read-modify-writes preserve every change',async()=>{
   await Promise.all(Array.from({length:8},()=>transaction(async repo=>{const a=await repo.account('candidate');a.counter=(a.counter||0)+1;await new Promise(r=>setTimeout(r,5));await repo.saveAccount(a);},pool)));
   assert.equal((await repo.account('candidate')).counter,8);
  });
  await t.test('both workspaces work with PostgreSQL and concurrent invitations cannot duplicate',async()=>{
   await transaction(async repo=>action(repo,await repo.account('candidate'),{action:'onboard',role:'candidate',name:'Кандидат',city:'Самара',consent:true}),pool);
   await accountFor(repo,{id:'employer',email:'employer@example.test',name:'Компания'});
   await transaction(async repo=>action(repo,await repo.account('employer'),{action:'onboard',role:'employer',name:'Компания',city:'Самара',contact:'employer@example.test',description:'Компания для проверки реальной базы данных',consent:true}),pool);
   assert.ok((await getState(repo,await repo.account('employer'),'employer')).candidates.length>0);
   await assert.rejects(transaction(async repo=>action(repo,await repo.account('candidate'),{action:'job',title:'Illegal'}),pool),e=>e.status===403);
   const target=(await getState(repo,await repo.account('employer'),'employer')).candidates[0];
   const results=await Promise.allSettled(Array.from({length:4},()=>transaction(async repo=>action(repo,await repo.account('employer'),{action:'invite',candidateId:target.id,title:'Разработчик',description:'Работа над продуктом и поддержкой сервиса',contact:'employer@example.test',min:100000,max:150000}),pool)));
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
   assert.equal((await repo.scoped('invite','employer')).length,1);
  });
  await t.test('email/password auth persists sessions as hashes and revokes them at logout',async()=>{
   const request=new Request('https://example.test',{headers:{'x-fsp-client-ip':'test'}}), body={action:'register',terms:true,email:'  User@Example.Test ',password:'a long test password',name:'Пользователь'};
   const pending=await authenticate(body,request);
   assert.equal(pending.pendingVerification,true);assert.equal(pending.token,null);
   const queued=decryptMail((await pool.query('SELECT payload FROM auth_mail_outbox')).rows[0].payload);
   const token=queued.text.match(/token=([a-f0-9]{64})/)[1];
   await completeEmailAction({action:'verify-email',token},pool);
   const result=await authenticate({...body,action:'login'},request);
   assert.equal(result.account.email,'user@example.test');
   assert.equal((await currentUser('fsp_session='+result.token,pool)).userId,result.account.id);
   const stored=(await pool.query('SELECT * FROM auth_sessions')).rows[0];assert.notEqual(stored.token_hash,result.token);
   await logout('fsp_session='+result.token,pool);assert.equal(await currentUser('fsp_session='+result.token,pool),null);
   await assert.rejects(authenticate({...body,action:'login',password:'wrong'},request),e=>e.status===401);
   const login=await authenticate({...body,action:'login'},request);assert.ok(login.token);
   await assert.rejects(authenticate(body,request),e=>e.status===409);
   assert.equal((await pool.query('SELECT * FROM accounts WHERE email=$1',['user@example.test'])).rowCount,1);
   assert.equal(await currentUser('oai-authenticated-user-id=employer',pool),null);
  });
  await t.test('rate limiting is shared across concurrent requests',async()=>{
   const results=await Promise.allSettled(Array.from({length:5},()=>rateLimit('test-limit',2,60000,pool)));
   assert.equal(results.filter(x=>x.status==='fulfilled').length,2);
   assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===429).length,3);
  });
 }finally{for(const key of ['RESEND_API_KEY','EMAIL_FROM','MAIL_TOKEN_KEY','APP_URL']){if(previousEnv[key]===undefined)delete process.env[key];else process.env[key]=previousEnv[key];}delete globalThis.__fspPool;await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});
