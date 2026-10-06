import {getPool} from '../../../lib/postgres.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
 try {
  await getPool().query('SELECT 1 FROM schema_migrations LIMIT 1');
  return Response.json({status:'ok',revision:process.env.RELEASE_SHA||null}, {headers:{'Cache-Control':'no-store'}});
 } catch { return Response.json({status:'unavailable'}, {status:503}); }
}
