import {MODULES} from '../../../lib/question-bank.mjs';
import {CODING_QUESTIONS} from '../../../lib/coding-bank.mjs';
import {runCodeInput} from '../../../lib/code-runner.mjs';
import {codingContract} from '../../../lib/coding-contract.mjs';
import {checkOrigin,jsonBody,errorResponse,httpError} from '../../../lib/http.mjs';
import {getAppUser} from '../../app-auth';
import {rateLimit} from '../../../lib/auth.mjs';
export const runtime='nodejs';
export async function GET(){return Response.json({tasks:CODING_QUESTIONS.map(q=>({id:q.id,name:MODULES.find(m=>m.id===q.moduleId)?.name||q.moduleId,prompt:q.prompt,coding:{...codingContract(q.coding),language:q.coding.language,starter:q.coding.starter,tests:q.coding.tests.filter((t:{public:boolean})=>t.public)}}))},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){try{checkOrigin(request);const user=await getAppUser();if(!user)throw httpError('Войдите в аккаунт.',401);if(process.env.FSP_DEMO_MODE!=='1')await rateLimit('code-sandbox:user:'+user.userId,20,60000);const body=await jsonBody(request,35000);const question=CODING_QUESTIONS.find(q=>q.id===body.questionId);if(!question)throw httpError('Задание не найдено.',404);return Response.json(await runCodeInput(question,body.source,body.stdin??question.coding.tests.find((t:{public:boolean})=>t.public)?.stdin??'',{signal:request.signal}),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e,'Не удалось запустить код.');}}
