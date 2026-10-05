import pg from 'pg';

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
const recordRow = row => row ? {...row.data, id: row.id, kind: row.kind, owner: row.owner, recipient: row.recipient, created: Number(row.created)} : null;

export function repository(db = getPool()) {
 return {
  account: async id => accountRow((await db.query('SELECT * FROM accounts WHERE id=$1', [id])).rows[0]),
  accounts: async () => (await db.query('SELECT * FROM accounts')).rows.map(accountRow),
  saveAccount: async account => {
   const {id, email, ...data} = account;
   await db.query('INSERT INTO accounts(id,email,data,created) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET data=excluded.data,email=excluded.email', [id, email, data, account.created || Date.now()]);
  },
  records: async kind => (await db.query('SELECT * FROM records WHERE kind=$1 ORDER BY created DESC', [kind])).rows.map(recordRow),
  scoped: async (kind, user) => (await db.query('SELECT * FROM records WHERE kind=$1 AND (owner=$2 OR recipient=$2) ORDER BY created DESC', [kind, user])).rows.map(recordRow),
  record: async id => recordRow((await db.query('SELECT * FROM records WHERE id=$1', [id])).rows[0]),
  put: async (kind, record) => {
   const {id, owner, recipient, created, ...data} = record;
   await db.query('INSERT INTO records(id,kind,owner,recipient,data,created) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [id, kind, owner, recipient || null, data, created || Date.now()]);
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
export async function transaction(fn, pool = getPool()) {
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
