import {getPool} from '../lib/postgres.mjs';
import {mailConfigured} from '../lib/mail.mjs';
import {deliverQueuedMail} from '../lib/mail-worker.mjs';
if (mailConfigured()) {
 const pool=getPool();
 try { console.log('Auth mail queue:',JSON.stringify(await deliverQueuedMail(pool))); }
 finally { await pool.end(); }
}
