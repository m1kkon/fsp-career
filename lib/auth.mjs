import {randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {getPool, transaction} from './postgres.mjs';
import {accountFor} from './service.mjs';
import {httpError} from './http.mjs';
const scrypt = promisify(scryptCallback);
// OWASP's 32 MiB scrypt configuration balances memory and CPU for this VM.
const OPTIONS = {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024};
const SESSION_MS = 30 * 86400000;
const COOKIE = 'fsp_session';
const digest = value => createHash('sha256').update(value).digest('hex');
async function deriveKey(password, salt, options = OPTIONS) {
 globalThis.__fspKdfActive ??= 0;
 if (globalThis.__fspKdfActive >= 4) throw httpError('Сервис входа занят. Повторите через несколько секунд.', 429);
 globalThis.__fspKdfActive++;
 try { return await scrypt(password, salt, 64, options); }
 finally { globalThis.__fspKdfActive--; }
}
export const normaliseEmail = value => String(value || '').trim().toLowerCase();
export async function hashPassword(password) {
 const salt = randomBytes(16).toString('hex');
 const key = await deriveKey(password, salt);
 return `scrypt-v2:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
 const [algorithm, salt, encoded] = stored.split(':');
 if (!['scrypt','scrypt-v2'].includes(algorithm) || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(encoded || '')) return false;
 const key = await deriveKey(password, salt, algorithm === 'scrypt' ? {...OPTIONS,p:1} : OPTIONS);
 return timingSafeEqual(key, Buffer.from(encoded, 'hex'));
}
export function sessionToken(cookie) {
 const value = String(cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
 return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
export function sessionCookie(token = '') {
 return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_MS / 1000 : 0}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
export async function currentUser(cookie, pool = getPool()) {
 const token = sessionToken(cookie); if (!token) return null;
 const row = (await pool.query('SELECT u.id,u.email FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires>$2', [digest(token), Date.now()])).rows[0];
 return row ? {userId: row.id, email: row.email} : null;
}
export async function logout(cookie, pool = getPool()) {
 const token = sessionToken(cookie);
 if (token) await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1', [digest(token)]);
}
export async function rateLimit(key, limit = 10, duration = 600000, pool = getPool()) {
 const now = Date.now();
 const row = (await pool.query(`INSERT INTO auth_rate_limits(key,attempts,expires) VALUES($1,1,$2)
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.expires<=$3 THEN 1 ELSE auth_rate_limits.attempts+1 END,
 expires=CASE WHEN auth_rate_limits.expires<=$3 THEN excluded.expires ELSE auth_rate_limits.expires END RETURNING attempts`, [digest(key), now + duration, now])).rows[0];
 if (row.attempts > limit) throw httpError('Слишком много попыток. Попробуйте позже.', 429);
}
export async function authenticate(body, request) {
 const pool = getPool(), email = normaliseEmail(body.email), password = body.password;
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length > 128) throw httpError('Укажите корректный email и пароль.');
 const registering = body.action === 'register';
 await rateLimit(`${registering ? 'register' : 'login'}:ip:${request.headers.get('x-fsp-client-ip') || 'local'}`, registering ? 10 : 30, registering ? 3600000 : 600000);
 await rateLimit(`auth:email:${email}`, 10);
 const token = randomBytes(32).toString('hex');
 if (registering) {
  if (body.terms !== true) throw httpError('Подтвердите согласие на обработку данных аккаунта.');
  if (password.length < 12) throw httpError('Пароль должен содержать от 12 до 128 символов.');
  const passwordHash = await hashPassword(password);
  try {
   return await transaction(async (repo, db) => {
    const id = randomUUID();
    const account = await accountFor(repo, {id, email, name: String(body.name || '').trim().slice(0, 100)});
    await db.query('INSERT INTO auth_users(id,email,password_hash,created) VALUES($1,$2,$3,$4)', [id, email, passwordHash, Date.now()]);
    await db.query('INSERT INTO auth_sessions(token_hash,user_id,expires) VALUES($1,$2,$3)', [digest(token), id, Date.now() + SESSION_MS]);
    return {account, token};
   });
  } catch (error) { if (error.code === '23505') throw httpError('Этот email уже зарегистрирован. Войдите в аккаунт.', 409); throw error; }
 }
 const row = (await pool.query('SELECT * FROM auth_users WHERE email=$1', [email])).rows[0];
 // Always spend the password KDF cost, including unknown email addresses.
 const dummy = 'scrypt-v2:00000000000000000000000000000000:' + '0'.repeat(128);
 if (!await verifyPassword(password, row?.password_hash || dummy) || !row) throw httpError('Неверный email или пароль.', 401);
 const upgradedHash = row.password_hash.startsWith('scrypt:') ? await hashPassword(password) : null;
 return await transaction(async (repo, db) => {
  // A concurrently changed password invalidates this login too.
  const current = (await db.query('SELECT password_hash FROM auth_users WHERE id=$1', [row.id])).rows[0];
  if (current?.password_hash !== row.password_hash) throw httpError('Повторите вход.', 401);
  if (upgradedHash) await db.query('UPDATE auth_users SET password_hash=$1 WHERE id=$2', [upgradedHash,row.id]);
  await db.query('INSERT INTO auth_sessions(token_hash,user_id,expires) VALUES($1,$2,$3)', [digest(token), row.id, Date.now() + SESSION_MS]);
  return {account: await repo.account(row.id), token};
 });
}
