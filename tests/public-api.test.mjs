import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createApiKey,listApiKeys,revokeApiKey,authenticateApiKey} from '../lib/api-keys.mjs';
import {handlePublicApi,searchOptions,filterCandidates,paginate} from '../lib/public-api.mjs';
import {accountFor} from '../lib/service.mjs';
import {postgresFixture,needsPostgres} from './helpers/postgres.mjs';

test('search rejects invalid filters and paginates a bounded result deterministically',()=>{
 for(const p of [{spec:'Fake'},{grade:'Lead'},{format:'Anywhere'},{salaryMin:'-1'},{salaryMin:'200',salaryMax:'100'},{budgetMin:'10',budgetMax:'1'},{limit:'101'},{offset:'1.5'},{minScore:'101'},{synthetic:'yes'},{sort:'random'},{stack:Array.from({length:21},(_,i)=>'tool'+i).join(',')}])assert.throws(()=>searchOptions(p),e=>e.status===400);
 const rows=[{id:'a',spec:'Backend',grade:'Middle',city:'Москва',format:'Удалённо',stack:['Python','Postgres'],fsp:null,synthetic:false,score:90,min:150000,max:200000,match:{strength:80}},{id:'b',spec:'QA',grade:'Junior',city:'Самара',format:'Офис',stack:['Python'],fsp:{achievements:[{}]},synthetic:true,score:75,min:null,max:null,match:{strength:70}}];
 assert.deepEqual(filterCandidates(rows,searchOptions({spec:'Backend',grade:'Middle',stack:'Python, PostgreSQL',city:'моск',format:'Удалённо',fsp:'without',synthetic:'false',salaryMin:'180000',salaryMax:'220000'})).map(c=>c.id),['a']);
 assert.deepEqual(filterCandidates(rows,searchOptions({favorites:'true'}),['b']).map(c=>c.id),['b']);
 assert.deepEqual(filterCandidates(rows,searchOptions({salaryMax:'250000'})).map(c=>c.id),['a']);
 assert.deepEqual(paginate(rows,{limit:'1',offset:'1'}),{data:[rows[1]],pagination:{total:2,limit:1,offset:1,nextOffset:null}});
});

test('personal API keys enforce authentication, scopes, consent, ownership, expiration, limits and revocation',needsPostgres,async t=>{
 const {pool,repo,write}=await postgresFixture(t);
 async function user(id,roles,profile={}) {
  const a=await accountFor(repo,{id,email:id+'@example.test',name:id});a.roles=roles;a.company.name=id;
  a.profile={...a.profile,spec:'Backend',grade:'Middle',verified:true,score:90,stack:['Python','PostgreSQL'],city:'Самара',format:'Удалённо',min:150000,max:200000,phone:'+70000000000',...profile};a.privacy={...a.privacy,consent:true};await repo.saveAccount(a);
  await pool.query('INSERT INTO auth_users(id,email,password_hash,created,verified_at) VALUES($1,$2,$3,$4,$4)',[id,a.email,'unused-test-hash',Date.now()]);return a;
 }
 const employer=await user('employer',['employer']),other=await user('other',['employer']),candidate=await user('person',['candidate']),hidden=await user('hidden',['candidate']);hidden.privacy.consent=false;await repo.saveAccount(hidden);
 const key=await write((_repo,db)=>createApiKey(employer.id,{name:'HR sync',scopes:['read','write']},db));
 const read=await write((_repo,db)=>createApiKey(employer.id,{name:'Read only'},db));
 const otherKey=await write((_repo,db)=>createApiKey(other.id,{name:'Other',scopes:['read','write']},db));
 const candidateKey=await write((_repo,db)=>createApiKey(candidate.id,{name:'Candidate',scopes:['read','write']},db));
 const request=(path,token=key.token,method='GET',body)=>new Request('https://example.test/api/v1/'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const call=async(path,token=key.token,method='GET',body)=>{const response=await handlePublicApi(request(path,token,method,body),pool);return {status:response.status,headers:response.headers,body:await response.json()};};
 await t.test('raw keys are returned once; metadata and the database only expose a prefix and a hash',async()=>{
  assert.match(key.token,/^fsp_live_[a-f0-9]{64}$/);assert.deepEqual(key.key.scopes,['read','write']);
  const stored=(await pool.query('SELECT * FROM api_keys WHERE id=$1',[key.key.id])).rows[0];assert.equal(stored.token_hash,createHash('sha256').update(key.token).digest('hex'));assert.ok(!JSON.stringify(stored).includes(key.token));
  const listed=await listApiKeys(employer.id,pool);assert.equal(listed.length,2);assert.ok(!JSON.stringify(listed).includes(key.token));assert.ok(!JSON.stringify(listed).includes(stored.token_hash));
  await assert.rejects(write((_repo,db)=>createApiKey(employer.id,{name:'',scopes:['read']},db)),e=>e.status===400);
  await assert.rejects(write((_repo,db)=>createApiKey(employer.id,{name:'Bad scope',scopes:['admin']},db)),e=>e.status===400);
  await assert.rejects(write((_repo,db)=>createApiKey(employer.id,{name:'Never expire',expiresInDays:0},db)),e=>e.status===400);
 });
 await t.test('cookies, query keys and malformed bearer tokens cannot authenticate',async()=>{
  for(const r of [request('me',null),request('me','not-a-key'),new Request('https://example.test/api/v1/me?api_key='+key.token,{headers:{cookie:'fsp_session='+key.token}})]){
   const response=await handlePublicApi(r,pool);assert.equal(response.status,401);assert.ok(response.headers.get('www-authenticate'));assert.equal((await response.json()).error.code,'UNAUTHORIZED');
  }
  const me=await call('me');assert.equal(me.status,200);assert.equal(me.body.data.id,employer.id);assert.equal(me.headers.get('cache-control'),'no-store');assert.ok(me.headers.get('x-request-id'));
  assert.equal((await call('me',read.token,'HEAD')).status,200);
  assert.equal((await listApiKeys(employer.id,pool)).find(k=>k.id===key.key.id).lastUsed!==null,true);
 });
 await t.test('search and detail preserve visibility and hide contact information until consent to contact',async()=>{
  const result=await call('candidates?spec=Backend&grade=Middle&stack=Python&synthetic=false&limit=1');assert.equal(result.status,200);assert.equal(result.body.pagination.total,1);assert.equal(result.body.data[0].id,candidate.id);assert.equal(result.body.data[0].email,undefined);assert.equal(result.body.data[0].phone,undefined);
  assert.equal((await call('candidates/'+hidden.id)).status,404);assert.equal((await call('candidates',candidateKey.token)).status,403);
  const ambiguous=await call('candidates?query='+encodeURIComponent('Разработчик'));assert.equal(ambiguous.body.need.confirmed,false);assert.deepEqual(ambiguous.body.data,[]);
  const ranked=await call('candidates?query=Middle%20backend%20Python&spec=Backend&grade=Middle&synthetic=false');assert.equal(ranked.body.need.confirmed,true);assert.equal(ranked.body.data[0].match.parts.reduce((n,p)=>n+p.points,0),ranked.body.data[0].match.score);
  for(const path of ['candidates?limti=1','candidates?limit=1&limit=2','candidates?spec=Fake','candidates?limit=1000'])assert.equal((await call(path)).status,400);
 });
 let inviteId;
 await t.test('read-only keys cannot write; favourites are idempotent; invitations respect roles and duplicates',async()=>{
  assert.equal((await call('favorites/'+candidate.id,read.token,'PUT')).status,403);
  for(let i=0;i<2;i++)assert.equal((await call('favorites/'+candidate.id,key.token,'PUT')).status,200);
  assert.equal((await repo.scoped('favorite',employer.id)).length,1);assert.equal((await call('candidates?favorites=true&synthetic=false')).body.pagination.total,1);
  assert.equal((await call('favorites/'+hidden.id,key.token,'PUT')).status,404);
  const body={candidateId:candidate.id,title:'Backend engineer',description:'Работа в нашей команде',contact:employer.email,min:160000,max:220000};
  const sent=await call('invites',key.token,'POST',body);assert.equal(sent.status,200);inviteId=sent.body.data.record.id;
  assert.equal((await call('invites',key.token,'POST',body)).status,409);
  assert.equal((await call('candidates/'+candidate.id)).body.data.email,undefined);
  assert.equal((await call('actions',candidateKey.token,'POST',{action:'invite-status',id:inviteId,status:'accepted'})).status,200);
  assert.equal((await call('candidates/'+candidate.id)).body.data.email,candidate.email);
  assert.equal((await call('candidates/'+candidate.id,otherKey.token)).body.data.email,undefined);
 });
 await t.test('API writes cannot bypass record ownership or invoke assessment administration',async()=>{
  assert.equal((await call('actions',otherKey.token,'POST',{action:'invite-status',id:inviteId,status:'accepted'})).status,403);
  for(const action of ['maintainer-state','assessment-answer','test-submit','api-key-create'])assert.equal((await call('actions',key.token,'POST',{action})).status,400);
  assert.equal((await call('actions',key.token,'POST',{action:'delete-need',id:inviteId})).status,404);assert.ok(await repo.record(inviteId));
  assert.equal((await call('invites',otherKey.token)).body.data.length,0);
  assert.equal((await call('jobs?limit=2')).body.data.length,2);
  const oversized=new Request('https://example.test/api/v1/actions',{method:'POST',headers:{Authorization:'Bearer '+key.token,'Content-Type':'application/json'},body:JSON.stringify({action:'profile',about:'x'.repeat(60001)})});assert.equal((await handlePublicApi(oversized,pool)).status,413);
  const wrongType=new Request('https://example.test/api/v1/actions',{method:'POST',headers:{Authorization:'Bearer '+key.token,'Content-Type':'text/plain'},body:'{}'});assert.equal((await handlePublicApi(wrongType,pool)).status,415);
 });
 await t.test('employers can cancel only their own open invitations through the personal API',async()=>{
  await repo.put('invite',{id:'cancel-invite',owner:employer.id,recipient:candidate.id,status:'sent',created:Date.now()});
  const body={action:'invite-cancel',id:'cancel-invite'};
  assert.equal((await call('actions',otherKey.token,'POST',body)).status,404);
  assert.equal((await call('actions',candidateKey.token,'POST',body)).status,403);
  assert.equal((await call('actions',key.token,'POST',body)).status,200);
  assert.equal((await repo.record(body.id)).status,'cancelled');
  assert.equal((await call('actions',key.token,'POST',body)).status,409);
 });
 await t.test('failed requests count toward limits and revocation is owner scoped',async()=>{
  await assert.rejects(write((_repo,db)=>revokeApiKey(other.id,key.key.id,db)),e=>e.status===404);
  await pool.query('DELETE FROM auth_rate_limits');
  for(let i=0;i<30;i++)assert.equal((await call('actions',key.token,'POST',{action:'forbidden'})).status,400);
  const limited=await call('actions',key.token,'POST',{action:'forbidden'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
  await pool.query('DELETE FROM auth_rate_limits');
  await write((_repo,db)=>revokeApiKey(employer.id,read.key.id,db));assert.equal((await call('me',read.token)).status,401);
  await write((_repo,db)=>revokeApiKey(employer.id,read.key.id,db));
  await pool.query('UPDATE api_keys SET expires=0 WHERE id=$1',[otherKey.key.id]);assert.equal((await call('me',otherKey.token)).status,401);
  await pool.query('UPDATE auth_users SET verified_at=NULL WHERE id=$1',[candidate.id]);assert.equal((await call('me',candidateKey.token)).status,401);
 });
 await t.test('concurrent issuance cannot exceed the account cap',async()=>{
  const results=await Promise.allSettled(Array.from({length:12},(_,i)=>write((_repo,db)=>createApiKey(employer.id,{name:'Integration '+i},db))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,9);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===409));
  await assert.rejects(authenticateApiKey(request('me',read.token),pool),e=>e.status===401);
 });
 await t.test('revocation wins over a request waiting for the business transaction',async()=>{
  const blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(68741942)');
  const waiting=async count=>{const deadline=Date.now()+3000;while(Date.now()<deadline){const n=Number((await pool.query("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=68741942 AND NOT granted")).rows[0].count);if(n>=count)return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected waiting transaction');};
  let revocation,queued;
  try{
   revocation=write((_repo,db)=>revokeApiKey(employer.id,key.key.id,db));await waiting(1);
   queued=call('favorites/'+candidate.id,key.token,'DELETE');await waiting(2);
  }finally{await blocker.query('COMMIT');blocker.release();}
  await revocation;assert.equal((await queued).status,401);assert.equal((await repo.scoped('favorite',employer.id)).length,1);
 });
});
