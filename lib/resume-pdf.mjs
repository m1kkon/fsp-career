import {PDFDocument, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {serif, serifBold} from '../vendor/resume-fonts.mjs';
import {mockFspProfile} from './fsp.mjs';

const TITLES={Backend:'Backend Developer',Frontend:'Frontend Developer','Data Science':'Data Scientist',DevOps:'DevOps Engineer',QA:'QA Engineer'};
const WIDTH=595.28, HEIGHT=841.89, MARGIN=42, BOTTOM=52;
const BLACK=rgb(.08,.08,.09), GRAY=rgb(.38,.38,.4);
const clean=value=>String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
const date=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow'}).format(new Date(value));
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

// Only the authenticated candidate's saved account is accepted. No client-supplied
// profile, target account ID, or confirmed category is used to generate the file.
export function resumeData(account){
 if(!account?.roles?.includes('candidate'))throw Object.assign(new Error('Сначала создайте профиль кандидата.'),{status:403});
 const p=account.profile;
 const category=p.verified?`${p.spec} / ${p.grade} · ${p.score}/100${p.verifiedAt?' · '+date(p.verifiedAt):''}`:'Категория ещё не подтверждена';
 const fsp=account.privacy?.fspVisible===false?null:mockFspProfile(p.fsp?.id);
 const money=n=>new Intl.NumberFormat('ru-RU').format(n);
 const salary=Number.isFinite(p.min)&&Number.isFinite(p.max)?`${money(p.min)}–${money(p.max)} ₽ в месяц`:'';
 return {
  name:clean(p.name)||'Резюме кандидата',
  contacts:[account.email,p.phone].map(clean).filter(Boolean),
  subtitle:[TITLES[p.spec]||p.spec,p.city].map(clean).filter(Boolean).join(' · '),
  sections:[
   {title:'Желаемая работа',text:[salary,p.format,p.experience&&'Опыт: '+p.experience].filter(Boolean).join(' · ')},
   {title:'О себе',text:p.about},
   {title:'Навыки',text:Array.isArray(p.stack)?p.stack.join(', '):''},
   {title:'Опыт работы',text:p.work},
   {title:'Образование и курсы',text:p.education},
   {title:'Подтверждённая категория',text:category,note:p.verified?'Категория присвоена по тесту платформы. Экспертная валидация методики ещё не проведена.':'Для подтверждения специализации и уровня пройдите тест в кабинете кандидата.'},
   ...(fsp?[{title:'Достижения ФСП — тестовые данные',text:`ФСП ID: ${fsp.id}\n`+(fsp.achievements.length?fsp.achievements.map(a=>`• ${a.event} — ${a.result} (${a.year}), ${a.format} зачёт`).join('\n'):'История достижений отсутствует.'),note:'Синтетические данные для демонстрации. Реальный реестр ФСП не подключён.'}]:[])
  ].map(s=>({...s,text:clean(s.text)})).filter(s=>s.text)
 };
}

export function resumeFilename(name){return 'resume-'+(clean(name).replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s+/g,'-').slice(0,80)||'candidate')+'.pdf';}

export async function generateResumePDF(account,{now=Date.now()}={}){
 const data=resumeData(account);
 const doc=await PDFDocument.create();
 doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(decode(serif),{subset:true});
 const bold=await doc.embedFont(decode(serifBold),{subset:true});
 const charset=new Set(regular.getCharacterSet());
 const printable=value=>Array.from(clean(value),c=>c==='\n'||charset.has(c.codePointAt(0))?c:'?').join('');
 doc.setTitle('Резюме — '+data.name);doc.setAuthor(data.name);doc.setCreator('ФСП Карьера');
 doc.setCreationDate(new Date(now));doc.setModificationDate(new Date(now));
 let page,y;
 const measure=(s,font,size)=>font.widthOfTextAtSize(s,size);
 // Wrap at word boundaries, but also break a single long URL/token rather than
 // shrinking the entire document or allowing text to cross the page margin.
 function wrap(value,size=10.5,font=regular,max=WIDTH-MARGIN*2){
  const rows=[];
  for(const paragraph of printable(value).split('\n')){
   if(!paragraph.trim()){rows.push('');continue;}
   let line='';
   for(const word of paragraph.trim().split(/\s+/)){
    if(measure(line?line+' '+word:word,font,size)<=max){line=line?line+' '+word:word;continue;}
    if(line){rows.push(line);line='';}
    if(measure(word,font,size)<=max){line=word;continue;}
    for(const char of word){if(line&&measure(line+char,font,size)>max){rows.push(line);line='';}line+=char;}
   }
   if(line)rows.push(line);
  }
  return rows;
 }
 function line(text,{size=10.5,font=regular,center=false,color=BLACK,indent=0}={}){
  const x=center?(WIDTH-measure(text,font,size))/2:MARGIN+indent;
  page.drawText(text,{x,y,size,font,color});
 }
 function newPage(){
  page=doc.addPage([WIDTH,HEIGHT]);y=HEIGHT-MARGIN;
  if(doc.getPageCount()>1){
   const label=wrap(data.name+' · Резюме',9,regular)[0];line(label,{size:9,color:GRAY});
   y-=10;page.drawLine({start:{x:MARGIN,y},end:{x:WIDTH-MARGIN,y},thickness:.4,color:GRAY});y-=24;
  }
 }
 function ensure(space){if(y-space<BOTTOM)newPage();}
 function textBlock(value,{size=10.5,font=regular,color=BLACK,structured=false}={}){
  const paragraphs=printable(value).split('\n');
  for(let n=0;n<paragraphs.length;n++){
   const paragraph=paragraphs[n];
   if(!paragraph.trim()){y-=5;continue;}
   const bullet=/^[•*\-]\s+/.test(paragraph.trim());
   const content=bullet?paragraph.trim().replace(/^[•*\-]\s+/,''):paragraph;
   const isHeading=structured&&!bullet&&(n===0||!paragraphs[n-1].trim())&&paragraph.length<=110&&!!paragraphs[n+1]?.trim();
   const rowFont=isHeading?bold:font;
   const rows=wrap(content,size,rowFont,WIDTH-MARGIN*2-(bullet?14:0));
   if(isHeading)ensure(size*2.8);
   for(let i=0;i<rows.length;i++){
    ensure(size*1.4);if(bullet&&i===0)line('•',{size,font,color});
    line(rows[i],{size,font:rowFont,color,indent:bullet?14:0});y-=size*1.4;
   }
  }
 }
 newPage();
 for(const row of wrap(data.name,26,regular)){ensure(35);line(row,{size:26,center:true});y-=32;}
 y-=2;
 for(const row of wrap(data.subtitle,11,bold)){ensure(17);line(row,{size:11,font:bold,center:true});y-=16;}
 if(data.contacts.length){y-=4;for(const row of wrap(data.contacts.join(' · '),9.5,regular)){ensure(15);line(row,{size:9.5,center:true});y-=14;}}
 y-=12;
 for(const section of data.sections){
  const heading=wrap(section.title.toUpperCase(),12.5,regular);
  // Keep each section heading with at least two body lines on the same page.
  ensure(heading.length*17+42);
  for(const row of heading){line(row,{size:12.5});y-=17;}
  page.drawLine({start:{x:MARGIN,y:y+4},end:{x:WIDTH-MARGIN,y:y+4},thickness:.45,color:GRAY});y-=7;
  textBlock(section.text,{structured:['Опыт работы','Образование и курсы'].includes(section.title)});
  if(section.note){y-=5;textBlock(section.note,{size:8,color:GRAY});}
  y-=16;
 }
 const pages=doc.getPages();
 for(let i=0;i<pages.length;i++){
  const footer=`ФСП Карьера · ${date(now)}  /  ${i+1} из ${pages.length}`;
  pages[i].drawText(footer,{x:MARGIN,y:28,size:7.5,font:regular,color:GRAY});
 }
 return doc.save();
}

export async function resumePDFResponse(account){
 const bytes=await generateResumePDF(account);
 return new Response(bytes,{headers:{
  'Content-Type':'application/pdf',
  'Content-Disposition':`attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(resumeFilename(account.profile.name))}`,
  'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff'
 }});
}
