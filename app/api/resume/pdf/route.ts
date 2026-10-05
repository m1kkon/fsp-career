import {getAppUser} from '../../../app-auth';
import {repository} from '../../../../lib/postgres.mjs';
import {resumePDFResponse} from '../../../../lib/resume-pdf.mjs';
import {errorResponse, httpError} from '../../../../lib/http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
 try {
  const user = await getAppUser();
  if (!user) throw httpError('Войдите в аккаунт.', 401);
  return await resumePDFResponse(await repository().account(user.userId));
 } catch (error) { return errorResponse(error, 'Не удалось сформировать PDF.'); }
}
