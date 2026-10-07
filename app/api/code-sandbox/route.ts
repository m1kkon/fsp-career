import {MODULES} from '../../../lib/question-bank.mjs';
import {CODING_QUESTIONS} from '../../../lib/coding-bank.mjs';
import {runCode} from '../../../lib/code-runner.mjs';
import {checkOrigin,jsonBody,errorResponse,httpError} from '../../../lib/http.mjs';
export const runtime='nodejs';
export async function GET(){return Response.json({tasks:CODING_QUESTIONS.map(q=>({id:q.id,name:MODULES.find(m=>m.id===q.moduleId)?.name||q.moduleId,prompt:q.prompt,coding:{language:q.coding.language,starter:q.coding.starter,tests:q.coding.tests.filter((t:{public:boolean})=>t.public)}}))},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){try{checkOrigin(request);const body=await jsonBody(request,25000);const question=CODING_QUESTIONS.find(q=>q.id===body.questionId);if(!question)throw httpError('Задание не найдено.',404);return Response.json(await runCode(question,body.source,{publicOnly:true,signal:request.signal}),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e,'Не удалось запустить код.');}}
