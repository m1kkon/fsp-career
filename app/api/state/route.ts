import {getAppUser} from '../../app-auth';
import {repository} from '../../../lib/postgres.mjs';
import {getState, publicJobs, demoCandidatePreview} from '../../../lib/service.mjs';
import {errorResponse} from '../../../lib/http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try {
  const user = await getAppUser(), repo = repository();
  if (!user) return Response.json({authenticated:false, candidatePreview:demoCandidatePreview(), jobs:await publicJobs(repo)}, {headers:{'Cache-Control':'no-store'}});
  const account = await repo.account(user.userId), url = new URL(request.url);
  return Response.json({authenticated:true, ...await getState(repo, account, url.searchParams.get('role') || 'candidate', url.searchParams.get('query') || '', Object.fromEntries(url.searchParams))}, {headers:{'Cache-Control':'no-store'}});
 } catch (error) { return errorResponse(error, 'Не удалось загрузить данные сервиса.'); }
}

