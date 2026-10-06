import {decryptMail, sendMail} from './mail.mjs';
export async function deliverQueuedMail(pool, sender = sendMail, max = 20) {
 await pool.query('DELETE FROM auth_email_tokens WHERE expires<$1', [Date.now()]);
 let sent = 0, failed = 0;
 for (let i=0;i<max;i++) {
  // Space delivery attempts to reduce provider throttling.
  if (i) await new Promise(resolve=>setTimeout(resolve,600));
  const lease = Date.now()+60000;
  // A lease lets another worker recover a job after a process/VM restart.
  const job = (await pool.query(`UPDATE auth_mail_outbox SET next_attempt=$1, attempts=attempts+1
   WHERE id=(SELECT id FROM auth_mail_outbox WHERE next_attempt<=$2 AND attempts<5 ORDER BY next_attempt,id FOR UPDATE SKIP LOCKED LIMIT 1)
   RETURNING id,payload,attempts`, [lease,Date.now()])).rows[0];
  if (!job) break;
  try {
   await sender(decryptMail(job.payload), job.id);
   await pool.query('DELETE FROM auth_mail_outbox WHERE id=$1', [job.id]);
   sent++;
  } catch (error) {
   const code = /^MAIL_HTTP_\d{3}$/.test(error.code || '') ? error.code : 'MAIL_SEND_FAILED';
   await pool.query('UPDATE auth_mail_outbox SET next_attempt=$1,last_error=$2 WHERE id=$3', [Date.now()+Math.min(3600000,60000*5**(job.attempts-1)),code,job.id]);
   failed++;
  }
 }
 return {sent,failed};
}
