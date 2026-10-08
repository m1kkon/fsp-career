import {handlePublicApi} from '../../../../lib/public-api.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handlePublicApi(request);}
export const POST=GET;
export const PUT=GET;
export const DELETE=GET;
export const PATCH=GET;
