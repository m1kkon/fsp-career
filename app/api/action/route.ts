import {getAppUser} from '../../app-auth';
import {executeAccountAction} from '../../../lib/action-dispatch.mjs';
import {checkOrigin, jsonBody, errorResponse, httpError} from '../../../lib/http.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try {
  checkOrigin(request);
  const user = await getAppUser();
  if (!user) throw httpError('Войдите в аккаунт.', 401);
  const body = await jsonBody(request, 60000);
  if (body.action !== 'company' && Buffer.byteLength(JSON.stringify(body)) > 30000) throw httpError('Слишком большой запрос.', 413);
  const result = await executeAccountAction(user.userId,body);
  return Response.json(result, {headers:{'Cache-Control':'no-store'}});
 } catch (error) { return errorResponse(error, 'Не удалось сохранить данные.'); }
}
