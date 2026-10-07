import {getAppUser} from '../../app-auth';
import {repository,transaction} from '../../../lib/postgres.mjs';
import {assessmentAccount} from '../../../lib/test-maintainer.mjs';
import {getState, publicJobs, demoCandidatePreview} from '../../../lib/service.mjs';
import {errorResponse} from '../../../lib/http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try {
  const user = await getAppUser(), repo = repository();
  if (!user) return Response.json({authenticated:false, candidatePreview:demoCandidatePreview(), jobs:await publicJobs(repo)}, {headers:{'Cache-Control':'no-store'}});
  const url = new URL(request.url);
  // Expiry can finish an assessment and update its profile proof during a read.
  const state = await transaction(async current => getState(current, assessmentAccount(await current.account(user.userId)), url.searchParams.get('role') || 'candidate', url.searchParams.get('query') || '', Object.fromEntries(url.searchParams)));
  return Response.json({authenticated:true, ...state}, {headers:{'Cache-Control':'no-store'}});
 } catch (error) { return errorResponse(error, 'Не удалось загрузить данные сервиса.'); }
}
