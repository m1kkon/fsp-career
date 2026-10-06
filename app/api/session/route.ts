import {getAppUser} from '../../app-auth';
import {authenticate, logout, sessionCookie} from '../../../lib/auth.mjs';
import {checkOrigin, jsonBody, errorResponse, httpError} from '../../../lib/http.mjs';
import {repository} from '../../../lib/postgres.mjs';
import {getState, publicJobs, demoCandidatePreview} from '../../../lib/service.mjs';
import {requestAuthEmail, completeEmailAction} from '../../../lib/email-auth.mjs';
import {rateLimit} from '../../../lib/auth.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try {
  checkOrigin(request);
  const body = await jsonBody(request), repo = repository();
  if (['request-verification','forgot-password'].includes(body.action)) {
   return Response.json(await requestAuthEmail(body, request), {headers:{'Cache-Control':'no-store'}});
  }
  if (['verify-email','reset-password'].includes(body.action)) {
   await rateLimit(`email-link:ip:${request.headers.get('x-fsp-client-ip') || 'local'}`, 30, 600000);
   return Response.json(await completeEmailAction(body), {headers:{'Cache-Control':'no-store', ...(body.action === 'reset-password' ? {'Set-Cookie':sessionCookie()} : {})}});
  }
  if (body.action === 'logout') {
   await logout(request.headers.get('cookie'));
   return Response.json({authenticated:false, candidatePreview:demoCandidatePreview(), jobs:await publicJobs(repo)}, {headers:{'Set-Cookie':sessionCookie(), 'Cache-Control':'no-store'}});
  }
  if (!['login', 'register'].includes(body.action)) throw httpError('Неизвестное действие.');
  const user = body.action === 'login' && !body.email ? await getAppUser() : null;
  if (!user && !body.email) throw httpError('Войдите по email и паролю.', 401);
  const result = user ? {account:await repo.account(user.userId), token:null} : await authenticate(body, request);
  if ('pendingVerification' in result && result.pendingVerification) {
   return Response.json({authenticated:false, pendingVerification:true, email:result.account.email, emailQueued:result.emailQueued}, {headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie()}});
  }
  const data = {authenticated:true, ...await getState(repo, result.account, body.role === 'employer' ? 'employer' : 'candidate')};
  return Response.json(data, {headers:{'Cache-Control':'no-store', ...(result.token ? {'Set-Cookie':sessionCookie(result.token)} : {})}});
 } catch (error) { return errorResponse(error, 'Не удалось войти. Попробуйте ещё раз.'); }
}
