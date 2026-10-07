import {getAppUser} from '../../app-auth';
import {transaction} from '../../../lib/postgres.mjs';
import {actionResponse} from '../../../lib/action-response.mjs';
import {assessmentAccount} from '../../../lib/test-maintainer.mjs';
import {checkOrigin, jsonBody, errorResponse, httpError} from '../../../lib/http.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try {
  checkOrigin(request);
  const user = await getAppUser();
  if (!user) throw httpError('Войдите в аккаунт.', 401);
  const body = await jsonBody(request, 60000);
  if (body.action !== 'company' && Buffer.byteLength(JSON.stringify(body)) > 30000) throw httpError('Слишком большой запрос.', 413);
  const result = await transaction(async repo => actionResponse(repo, assessmentAccount(await repo.account(user.userId)), body));
  return Response.json(result, {headers:{'Cache-Control':'no-store'}});
 } catch (error) { return errorResponse(error, 'Не удалось сохранить данные.'); }
}
