import {hashPassword, normaliseEmail} from '../lib/auth.mjs';
import {getPool, transaction} from '../lib/postgres.mjs';
const email = normaliseEmail(process.argv[2]);
// Supply the password on stdin so it is never present in shell history/ps.
let input = '';
for await (const chunk of process.stdin) {
 input += chunk.toString('utf8');
 if (input.length > 1024) throw new Error('Password input too long');
}
const password = input.replace(/\r?\n$/, '');
if (!email || password.length < 12 || password.length > 128) throw new Error('Usage: provide email argument and 12–128 character password on stdin');
const hash = await hashPassword(password);
try {
 await transaction(async (_repo, db) => {
  const row = (await db.query('UPDATE auth_users SET password_hash=$1 WHERE email=$2 RETURNING id', [hash, email])).rows[0];
  if (!row) throw new Error('Account not found');
  await db.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.id]);
 });
 console.log('Password changed; all sessions revoked.');
} finally { await getPool().end(); }
