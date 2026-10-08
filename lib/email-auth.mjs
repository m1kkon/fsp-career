import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {getPool, transaction} from './postgres.mjs';
import {normaliseEmail, rateLimit, hashPassword} from './auth.mjs';
import {authMail, encryptMail, requireMail} from './mail.mjs';
import {httpError} from './http.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const invalidLink = () => httpError('Ссылка недействительна или срок её действия истёк. Запросите новое письмо.');
export const EMAIL_REQUEST_MESSAGE = 'Если для этого адреса нужна ссылка, письмо придёт в течение нескольких минут. Проверьте также папку «Спам».';

// Called within the same transaction as account creation. Raw tokens are encrypted
// in the outbox with a key held outside PostgreSQL; only hashes authenticate links.
export async function queueAuthMail(db, user, purpose) {
 requireMail();
 await rateLimit('mail:daily-budget', 95, 86400000, db);
 const now = Date.now(), token = randomBytes(32).toString('hex'), hash = digest(token), id = randomUUID();
 const expires = now + (purpose === 'verify' ? 86400000 : 1800000);
 await db.query('DELETE FROM auth_email_tokens WHERE user_id=$1 AND purpose=$2', [user.id, purpose]);
 await db.query('INSERT INTO auth_email_tokens(token_hash,user_id,purpose,expires,created) VALUES($1,$2,$3,$4,$5)', [hash,user.id,purpose,expires,now]);
 await db.query('INSERT INTO auth_mail_outbox(id,token_hash,payload,next_attempt) VALUES($1,$2,$3,$4)', [id,hash,encryptMail(authMail(user.email,purpose,token)),now]);
}
export async function requestAuthEmail(body, request, pool = getPool()) {
 requireMail();
 const email = normaliseEmail(body.email), purpose = body.action === 'forgot-password' ? 'reset' : 'verify';
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw httpError('Укажите корректный email.');
 const ip = request.headers.get('x-fsp-client-ip') || 'local';
 await rateLimit(`mail:ip:${ip}`, 20, 3600000, pool);
 // The same limits and response apply to unknown and existing email addresses.
 await rateLimit(`mail:${purpose}:email:${email}`, 3, 3600000, pool);
 await transaction(async (_repo, db) => {
  const user = (await db.query('SELECT id,email,verified_at FROM auth_users WHERE email=$1 FOR UPDATE', [email])).rows[0];
  if (user && (purpose === 'reset' || !user.verified_at)) {
   // A global mail quota must not expose whether an account exists.
   try { await queueAuthMail(db,user,purpose); }
   catch (error) { if (error.status !== 429) throw error; }
  }
 }, pool);
 return {message: EMAIL_REQUEST_MESSAGE};
}
export async function completeEmailAction(body, pool = getPool()) {
 const purpose = body.action === 'verify-email' ? 'verify' : 'reset', token = String(body.token || '');
 if (!/^[a-f0-9]{64}$/.test(token)) throw invalidLink();
 const password = body.password;
 if (purpose === 'reset' && (typeof password !== 'string' || password.length < 12 || password.length > 128)) throw httpError('Пароль должен содержать от 12 до 128 символов.');
 // Look up first so invalid tokens cannot force expensive password hashing.
 const hash = digest(token);
 const valid = (await pool.query('SELECT 1 FROM auth_email_tokens WHERE token_hash=$1 AND purpose=$2 AND expires>$3', [hash,purpose,Date.now()])).rowCount;
 if (!valid) throw invalidLink();
 const passwordHash = purpose === 'reset' ? await hashPassword(password) : null;
 await transaction(async (_repo, db) => {
  const row = (await db.query('DELETE FROM auth_email_tokens WHERE token_hash=$1 AND purpose=$2 AND expires>$3 RETURNING user_id', [hash,purpose,Date.now()])).rows[0];
  if (!row) throw invalidLink();
  if (purpose === 'reset') {
   await db.query('UPDATE auth_users SET password_hash=$1,verified_at=COALESCE(verified_at,$2) WHERE id=$3', [passwordHash,Date.now(),row.user_id]);
   await db.query('DELETE FROM auth_sessions WHERE user_id=$1', [row.user_id]);
   await db.query('UPDATE api_keys SET revoked_at=$2 WHERE user_id=$1 AND revoked_at IS NULL', [row.user_id,Date.now()]);
   await db.query('DELETE FROM auth_email_tokens WHERE user_id=$1', [row.user_id]);
  } else {
   await db.query('UPDATE auth_users SET verified_at=$1 WHERE id=$2', [Date.now(),row.user_id]);
   await db.query('DELETE FROM auth_email_tokens WHERE user_id=$1 AND purpose=$2', [row.user_id,purpose]);
  }
 }, pool);
 return {message: purpose === 'verify' ? 'Email подтверждён. Теперь войдите в аккаунт.' : 'Пароль изменён. Войдите с новым паролем.'};
}
