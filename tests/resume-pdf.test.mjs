import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {resumeData,resumeFilename,generateResumePDF,resumePDFResponse} from '../lib/resume-pdf.mjs';

const account=()=>({roles:['candidate'],email:'owner@example.test',privacy:{fspVisible:true},profile:{name:'Анна Соколова',spec:'Backend',grade:'Middle',verified:true,score:87,verifiedAt:1760000000000,city:'Москва',format:'Удалённо',experience:'4 года',min:180000,max:240000,stack:['Python','PostgreSQL'],about:'Разрабатываю API.',work:'Компания · Разработчик\n• Выпустила сервис.',education:'Университет',phone:'+7 999 123-45-67'}});
test('PDF generation rejects absent accounts and employer-only profiles',async()=>{
 for(const a of [null,{roles:['employer'],profile:{name:'Company'}}])await assert.rejects(generateResumePDF(a),e=>e.status===403);
});
test('saved own profile is projected without account secrets; hidden FSP is omitted',()=>{
 const a=account();a.token='secret-token';a.profile.fsp={id:'DEMO-FSP-003',source:'registry',achievements:[{result:'Forged winner'}]};
 let data=resumeData(a);assert.ok(data.contacts.some(x=>x.text===a.email));assert.ok(!JSON.stringify(data).includes('secret-token'));assert.ok(!JSON.stringify(data).includes('Forged winner'));
 assert.ok(data.sections.some(s=>s.title.includes('тестовые данные')));
 a.privacy.fspVisible=false;data=resumeData(a);assert.ok(!data.sections.some(s=>s.title.includes('ФСП')));
});
test('empty resume works without achievements and never claims an unverified grade',()=>{
 const a=account();Object.assign(a.profile,{about:'',work:'',education:'',stack:[],verified:false,grade:'Senior'});
 const data=resumeData(a);assert.ok(!data.sections.some(s=>s.title==='Опыт работы'));assert.ok(!data.sections.some(s=>s.title==='Навыки'));assert.equal(data.category,'Категория ещё не подтверждена');
});
test('editable skill groups, projects, languages and achievements become separate PDF sections',async()=>{
 const a=account();a.profile.resume={skillGroups:[{label:'ML & AI',text:'Python, PyTorch'},{label:'NLP & LLM',text:'RAG, Transformers'},{label:'Tools',text:'Git, Linux'}],languages:'Русский — родной',projects:[{name:'Поиск документов',description:'Разработала сервис поиска.',url:'https://example.test/project'}],achievements:'• Финалист соревнования (2025)',links:[{label:'GitHub',url:'https://github.com/example'}]};
 const data=resumeData(a);assert.equal(data.sections.find(s=>s.title==='Навыки').rows.length,4);assert.equal(data.sections.find(s=>s.title==='Проекты').entries[0].name,'Поиск документов');assert.ok(data.sections.some(s=>s.title==='Достижения'));assert.ok(data.contacts.some(c=>c.text==='GitHub'));
 const pdf=await PDFDocument.load(await generateResumePDF(a));assert.equal(pdf.getPageCount(),1);
});
test('download response contains a valid PDF, safe UTF-8 filename and private cache policy',async()=>{
 const a=account();a.profile.name='Анна\r\n"Соколова/';
 const response=await resumePDFResponse(a);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(response.headers.get('content-disposition').includes("filename*=UTF-8''resume-"));assert.ok(!resumeFilename(a.profile.name).includes('/'));
 const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.subarray(0,5)),'%PDF-');const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);assert.ok(pdf.getTitle().includes('Анна'));
});
test('long Cyrillic paragraphs and unbroken tokens flow onto multiple A4 pages',async()=>{
 const a=account();a.profile.about=('Надёжные системы, измеримые результаты и работа с командой. '.repeat(80));a.profile.work=('• Подробный опыт разработки и сопровождения сервиса.\n'.repeat(60))+'https://example.test/'+('a'.repeat(1200));
 const pdf=await PDFDocument.load(await generateResumePDF(a));assert.ok(pdf.getPageCount()>2);for(const page of pdf.getPages()){assert.equal(page.getWidth(),595.28);assert.equal(page.getHeight(),841.89);}
});
