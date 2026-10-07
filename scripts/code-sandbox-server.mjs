// Run on a dedicated Docker host, never expose its Docker socket to the web app.
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {runCode} from '../lib/code-runner.mjs';
const token=process.env.CODE_SANDBOX_TOKEN;if(!token||token.length<32)throw new Error('CODE_SANDBOX_TOKEN must contain at least 32 characters');
delete process.env.CODE_SANDBOX_URL;
createServer(async(req,res)=>{
 const respond=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 const auth=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
 if(req.method!=='POST'||auth.length!==expected.length||!timingSafeEqual(auth,expected)){respond(403,{error:'Доступ запрещён.'});return;}
 try{let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>60000)throw Object.assign(new Error('Слишком большой запрос.'),{status:413});chunks.push(chunk);}const {question,source,publicOnly,stdin}=JSON.parse(Buffer.concat(chunks));respond(200,await runCode(question,source,{publicOnly:publicOnly===true,...(stdin!==undefined?{stdin}:{})}));}catch(e){respond(e.status||500,{error:e.status?e.message:'Не удалось запустить код.'});}
}).listen(Number(process.env.CODE_SANDBOX_PORT||4180),process.env.CODE_SANDBOX_HOST||'127.0.0.1',()=>console.log('Code sandbox service ready'));
