export const httpError = (message, status = 400) => Object.assign(new Error(message), {status});
export function checkOrigin(request) {
 const expected = new URL(process.env.APP_URL || request.url).origin;
 const origin = request.headers.get('origin');
 if (origin !== expected && (origin || process.env.NODE_ENV === 'production')) throw httpError('Недопустимый источник запроса.', 403);
}
export async function jsonBody(request, maxBytes = 30000) {
 if (!request.headers.get('content-type')?.startsWith('application/json')) throw httpError('Ожидается JSON.', 415);
 if (Number(request.headers.get('content-length')) > maxBytes) throw httpError('Слишком большой запрос.', 413);
 const reader = request.body?.getReader();
 if (!reader) throw httpError('Пустой запрос.');
 const chunks = []; let size = 0;
 try {
  for (;;) {
   const {value, done} = await reader.read(); if (done) break;
   size += value.byteLength;
   if (size > maxBytes) { await reader.cancel(); throw httpError('Слишком большой запрос.', 413); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 let body;
 try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw httpError('Некорректный JSON.'); }
 if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError('Некорректный запрос.');
 return body;
}
export function errorResponse(error, fallback = 'Не удалось выполнить запрос.') {
 const status = error.status || 500;
 if (status >= 500) console.error('Request failed:', error.code || error.name || 'Error');
 return Response.json({error: status >= 500 ? fallback : error.message}, {status, headers: {'Cache-Control': 'no-store'}});
}
