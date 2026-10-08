import pg from 'pg';
import {demoRepository} from './demo-memory.mjs';

/** @returns {import('pg').Pool} */
export function getPool() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
 if (!globalThis.__fspPool) {
 const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  statement_timeout: 15000,
 });
 pool.on('error', error => console.error('PostgreSQL idle connection error:', error.code || error.name));
 globalThis.__fspPool = pool;
 }
 return globalThis.__fspPool;
}
const accountRow = row => row ? {...row.data, id: row.id, email: row.email} : null;
const recordData = r => Object.fromEntries(Object.entries(r).filter(([key])=>!['id','owner','recipient','created','kind'].includes(key)));
const recordRow = row => row ? {...row.data, id: row.id, kind: row.kind, owner: row.owner, recipient: row.recipient, created: Number(row.created)} : null;

export function repository(db = undefined) {
 if(process.env.FSP_DEMO_MODE==='1')return demoRepository();
 db ||= getPool();
 return {
  account: async id => accountRow((await db.query('SELECT * FROM accounts WHERE id=$1', [id])).rows[0]),
  accounts: async () => (await db.query('SELECT * FROM accounts')).rows.map(accountRow),
  saveAccount: async account => {
   const {id,email,...data}=account;delete data.maintainer;
   await db.query('INSERT INTO accounts(id,email,data,created) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET data=excluded.data,email=excluded.email', [id, email, data, account.created || Date.now()]);
  },
  records: async kind => (await db.query('SELECT * FROM records WHERE kind=$1 ORDER BY created DESC', [kind])).rows.map(recordRow),
  scoped: async (kind, user) => (await db.query('SELECT * FROM records WHERE kind=$1 AND (owner=$2 OR recipient=$2) ORDER BY created DESC', [kind, user])).rows.map(recordRow),
  record: async id => recordRow((await db.query('SELECT * FROM records WHERE id=$1', [id])).rows[0]),
  put: async (kind, record) => {
   const {id, owner, recipient, created, ...data} = record;
   await db.query('INSERT INTO records(id,kind,owner,recipient,data,created) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [id, kind, owner, recipient || null, data, created || Date.now()]);
  },
  saveAssessment: async (r, revision) => {
   const {id,owner}=r,data=recordData(r);
   return (await db.query("UPDATE records SET data=$1 WHERE id=$2 AND owner=$3 AND kind='assessment' AND (data->>'revision')::int=$4 AND data->>'status'='active'",[data,id,owner,revision])).rowCount===1;
  },
  saveDay: async (r, version, status) => {
   const {id}=r,data=recordData(r);
   return (await db.query("UPDATE records SET data=$1 WHERE id=$2 AND kind='test-day' AND (data->>'version')::int=$3 AND data->>'status'=$4",[data,id,version,status])).rowCount===1;
  },
  cancelRegistration: async (id,owner,at) => (await db.query("UPDATE records SET data=data || jsonb_build_object('status','cancelled','cancelledAt',$3::bigint) WHERE id=$1 AND owner=$2 AND kind='assessment-registration' AND data->>'status'='registered'",[id,owner,at])).rowCount===1,
  setAssessmentVisibility: async (id,owner,hidden,at) => (await db.query("UPDATE records SET data=data || jsonb_build_object('hiddenFromHistory',$3::boolean,'hiddenAt',$4::bigint) WHERE id=$1 AND owner=$2 AND kind='assessment' AND data->>'status' IN ('finished','incomplete')",[id,owner,hidden,hidden?at:null])).rowCount===1,
  setAssessmentResultVisibility: async (id,owner,key,hidden,at) => (await db.query("UPDATE records SET data=data || jsonb_build_object('employerHiddenResults',COALESCE(data->'employerHiddenResults','{}'::jsonb) || jsonb_build_object($3::text,$4::boolean),'employerVisibilityUpdatedAt',$5::bigint) WHERE id=$1 AND owner=$2 AND kind='assessment' AND data->>'status' IN ('finished','incomplete')",[id,owner,key,hidden,at])).rowCount===1,
  startAssessment: async (r,registration) => {
   const {id,owner,recipient,created}=r,data=recordData(r);
   // Called inside transaction(): booking and attempt must commit together.
   const result=await db.query(`WITH claimed AS (
    UPDATE records SET data=data || jsonb_build_object('status','started','attemptId',$1::text)
    WHERE id=$6 AND kind='assessment-registration' AND owner=$2 AND data->>'status'='registered'
    AND NOT EXISTS (SELECT 1 FROM records WHERE kind='assessment' AND owner=$2 AND data->>'status'='active') RETURNING id
   ) INSERT INTO records(id,kind,owner,recipient,data,created)
    SELECT $1,'assessment',$2,$3,$4,$5 FROM claimed RETURNING id`,[id,owner,recipient||null,data,created,registration.id]);
   return result.rowCount===1;
  },
  remove: async (id, owner) => db.query('DELETE FROM records WHERE id=$1 AND owner=$2', [id, owner]),
 };
}

// This MVP stores mutable documents. Serialise writes across app processes so
// a read-modify-write cannot lose changes or create duplicate invitations.
// Reads stay concurrent. The lock is held only for a business transaction.
/**
 * @template T
 * @param {(repo: ReturnType<typeof repository>, client: import('pg').PoolClient) => Promise<T>} fn
 * @param {import('pg').Pool} pool
 * @returns {Promise<T>}
 */
export async function transaction(fn, pool = undefined) {
 if(process.env.FSP_DEMO_MODE==='1')return fn(demoRepository(),null);
 pool ||= getPool();
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(68741942)');
  const result = await fn(repository(client), client);
  await client.query('COMMIT');
  return result;
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally { client.release(); }
}
