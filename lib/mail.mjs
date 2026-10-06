import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {httpError} from './http.mjs';

export function mailConfigured() {
 return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && /^[a-f0-9]{64}$/.test(process.env.MAIL_TOKEN_KEY || ''));
}
export function requireMail() {
 if (!mailConfigured()) throw httpError('Почтовый сервис временно недоступен. Попробуйте позже.', 503);
}
function encryptionKey() {
 requireMail();
 return Buffer.from(process.env.MAIL_TOKEN_KEY, 'hex');
}
export function encryptMail(message) {
 const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
 const bytes = Buffer.concat([cipher.update(JSON.stringify(message), 'utf8'), cipher.final()]);
 return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64');
}
export function decryptMail(payload) {
 const bytes = Buffer.from(payload, 'base64');
 const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
 cipher.setAuthTag(bytes.subarray(12, 28));
 return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'));
}
export function authMail(email, purpose, token) {
 const origin = new URL(process.env.APP_URL).origin;
 if (!origin.startsWith('https://') && process.env.NODE_ENV === 'production') throw new Error('Mail links require HTTPS');
 const verify = purpose === 'verify';
 const url = `${origin}/#${verify ? 'verify-email' : 'reset-password'}?token=${token}`;
 const subject = verify ? 'Подтвердите почту — ФСП Карьера' : 'Восстановление пароля — ФСП Карьера';
 const action = verify ? 'Подтвердить email' : 'Создать новый пароль';
 const detail = verify ? 'Подтвердите адрес, чтобы войти в ФСП Карьеру. Ссылка действует 24 часа.' : 'Для вашего аккаунта запросили сброс пароля. Ссылка действует 30 минут. После сброса все старые сессии завершатся.';
 return {from: process.env.EMAIL_FROM, to: [email], subject,
  text: `${subject}\n\n${detail}\n\n${action}: ${url}\n\nЕсли вы не запрашивали это письмо, проигнорируйте его.`,
  html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6;color:#202020"><h1 style="font-size:24px">${subject}</h1><p>${detail}</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#202020;color:#fff;text-decoration:none;border-radius:8px">${action}</a></p><p>Если кнопка не работает, откройте ссылку:</p><p style="word-break:break-all">${url}</p><p style="color:#666">Если вы не запрашивали это письмо, проигнорируйте его.</p></div>`};
}
export async function sendMail(message, id, fetcher = fetch) {
 requireMail();
 const response = await fetcher('https://api.resend.com/emails', {method: 'POST',
  headers: {'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'fsp-career/1.0', 'Idempotency-Key': `auth-mail/${id}`},
  body: JSON.stringify(message), signal: AbortSignal.timeout(10000)});
 if (!response.ok) throw Object.assign(new Error('Email provider rejected request'), {code: `MAIL_HTTP_${response.status}`});
}
