import {getAppUser} from '../../app-auth';
import {repository,transaction} from '../../../lib/postgres.mjs';
import {assessmentAction,maintainerState} from '../../../lib/assessments.mjs';
import {requireTestMaintainer} from '../../../lib/test-maintainer.mjs';
import {checkOrigin,jsonBody,errorResponse,httpError} from '../../../lib/http.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET() {
 try {
  const user=await getAppUser();
  if (!user) throw httpError('Войдите в аккаунт.',401);
  const repo=repository(),account=requireTestMaintainer(await repo.account(user.userId));
  return Response.json({admin:await maintainerState(repo,account)},{headers});
 } catch (error) { return errorResponse(error,'Не удалось загрузить банк вопросов.'); }
}
export async function POST(request:Request) {
 try {
  checkOrigin(request);
  const user=await getAppUser();
  if (!user) throw httpError('Войдите в аккаунт.',401);
  requireTestMaintainer(await repository().account(user.userId));
  const body=await jsonBody(request,30000);
  const allowed=['maintainer-state','maintainer-question-save','maintainer-question-decision','maintainer-spec-save','maintainer-day-save','maintainer-day-publish'];
  if (!allowed.includes(body.action)) throw httpError('Неизвестная операция управления тестами.',400);
  const result=await transaction(async repo=>assessmentAction(repo,requireTestMaintainer(await repo.account(user.userId)),body));
  return Response.json(result,{headers});
 } catch (error) { return errorResponse(error,'Не удалось сохранить данные тестирования.'); }
}
