import {getAppUser} from '../../app-auth';
import {authenticate, logout, sessionCookie} from '../../../lib/auth.mjs';
import {checkOrigin, jsonBody, errorResponse, httpError} from '../../../lib/http.mjs';
import {repository} from '../../../lib/postgres.mjs';
import {getState, publicJobs} from '../../../lib/service.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try {
  checkOrigin(request);
  const body = await jsonBody(request), repo = repository();
  if (body.action === 'logout') {
   await logout(request.headers.get('cookie'));
   return Response.json({authenticated:false, jobs:await publicJobs(repo)}, {headers:{'Set-Cookie':sessionCookie(), 'Cache-Control':'no-store'}});
  }
  if (!['login', 'register'].includes(body.action)) throw httpError('Неизвестное действие.');
  const user = body.action === 'login' && !body.email ? await getAppUser() : null;
  if (!user && !body.email) throw httpError('Войдите по email и паролю.', 401);
  const result = user ? {account:await repo.account(user.userId), token:null} : await authenticate(body, request);
  const data = {authenticated:true, ...await getState(repo, result.account, body.role === 'employer' ? 'employer' : 'candidate')};
  return Response.json(data, {headers:{'Cache-Control':'no-store', ...(result.token ? {'Set-Cookie':sessionCookie(result.token)} : {})}});
 } catch (error) { return errorResponse(error, 'Не удалось войти. Попробуйте ещё раз.'); }
}
