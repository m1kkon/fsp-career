import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import {repository,transaction} from '../../lib/postgres.mjs';
export const needsPostgres={skip:!process.env.TEST_DATABASE_URL};
export async function postgresFixture(t) {
 const url=new URL(process.env.TEST_DATABASE_URL);
 assert.ok(url.pathname.endsWith('_test'),'Use a dedicated database ending in _test');
 const admin=new pg.Pool({connectionString:url.href}),schema='assessment_'+randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA "${schema}"`);
 const pool=new pg.Pool({connectionString:url.href,options:`-c search_path=${schema}`,max:8});
 t.after(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();});
 for (const name of (await readdir(new URL('../../db/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pool.query(await readFile(new URL('../../db/migrations/'+name,import.meta.url),'utf8'));
 return {pool,repo:repository(pool),write:fn=>transaction(fn,pool)};
}
