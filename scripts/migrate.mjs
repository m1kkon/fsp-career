import {readdir, readFile} from 'node:fs/promises';
import {getPool} from '../lib/postgres.mjs';
const pool = getPool(), client = await pool.connect();
try {
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(68741942)');
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 for (const name of (await readdir(new URL('../db/migrations/', import.meta.url))).filter(x => x.endsWith('.sql')).sort()) {
  if ((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
  await client.query(await readFile(new URL('../db/migrations/' + name, import.meta.url), 'utf8'));
  await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
  console.log('Applied migration:', name);
 }
 await client.query('DELETE FROM auth_sessions WHERE expires<$1', [Date.now()]);
 await client.query('DELETE FROM auth_rate_limits WHERE expires<$1', [Date.now()]);
 await client.query('COMMIT');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
