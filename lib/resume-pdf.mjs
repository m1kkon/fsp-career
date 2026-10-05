import {PDFDocument, PDFString, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {serif, serifBold, serifItalic} from '../vendor/resume-fonts.mjs';
import {mockFspProfile} from './fsp.mjs';

const TITLES={Backend:'Backend Developer',Frontend:'Frontend Developer','Data Science':'Data Scientist',DevOps:'DevOps Engineer',QA:'QA Engineer'};
const WIDTH=595.28, HEIGHT=841.89, MARGIN=40, BOTTOM=44;
const BLACK=rgb(.08,.08,.09), GRAY=rgb(.38,.38,.4);
const clean=value=>String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
const date=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow'}).format(new Date(value));
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

// Only the authenticated candidate's saved account is accepted. No client-supplied
// profile, target account ID, or confirmed category is used to generate the file.
export function resumeData(account){
 if(!account?.roles?.includes('candidate'))throw Object.assign(new Error('Сначала создайте профиль кандидата.'),{status:403});
 const p=account.profile;
 const details=p.resume||{};
 const category=p.verified?`${p.spec} / ${p.grade} · ${p.score}/100${p.verifiedAt?' · '+date(p.verifiedAt):''}`:'Категория ещё не подтверждена';
 const fsp=account.privacy?.fspVisible===false?null:mockFspProfile(p.fsp?.id);
 const money=n=>new Intl.NumberFormat('ru-RU').format(n);
 const salary=Number.isFinite(p.min)&&Number.isFinite(p.max)?`${money(p.min)}–${money(p.max)} ₽ в месяц`:Number.isFinite(p.min)?`от ${money(p.min)} ₽ в месяц`:Number.isFinite(p.max)?`до ${money(p.max)} ₽ в месяц`:'';
 return {
  name:clean(p.name)||'Резюме кандидата',
  contacts:[{text:account.email,url:'mailto:'+account.email},...(p.phone?[{text:p.phone,url:'tel:'+p.phone.replace(/[^+\d]/g,'')}]:[]),...(details.links||[]).map(x=>({text:x.label||x.url.replace(/^https?:\/\//,''),url:x.url}))].filter(x=>x.text),
  subtitle:[details.headline||TITLES[p.spec]||p.spec,p.city,p.format,salary].map(clean).filter(Boolean).join(' · '),
  category,
  sections:[
   {title:'О себе',text:p.about},
   {title:'Навыки',rows:[...(details.skillGroups?.length?details.skillGroups:(p.stack?.length?[{label:'Технологии',text:p.stack.join(', ')}]:[])),...(details.languages?[{label:'Языки',text:details.languages}]:[])]},
   {title:'Достижения',text:details.achievements},
   {title:'Проекты',entries:details.projects},
   {title:'Опыт работы',text:p.work},
   {title:'Образование и курсы',text:p.education},
   ...(fsp?[{title:'Достижения ФСП — тестовые данные',text:`ФСП ID: ${fsp.id}\n`+(fsp.achievements.length?fsp.achievements.map(a=>`• ${a.event} — ${a.result} (${a.year}), ${a.format} зачёт`).join('\n'):'История достижений отсутствует.'),note:'Синтетические данные для демонстрации. Реальный реестр ФСП не подключён.'}]:[])
  ].map(s=>({...s,text:clean(s.text)})).filter(s=>s.text||s.rows?.length||s.entries?.length)
 };
}

export function resumeFilename(name){return 'resume-'+(clean(name).replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s+/g,'-').slice(0,80)||'candidate')+'.pdf';}

export async function generateResumePDF(account,{now=Date.now()}={}){
 const data=resumeData(account);
 const doc=await PDFDocument.create();
 doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(decode(serif),{subset:true});
 const bold=await doc.embedFont(decode(serifBold),{subset:true});
 const italic=await doc.embedFont(decode(serifItalic),{subset:true});
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
 function linkAnnotation(text,url,x,baseline,size=9.5,font=regular){
  if(!/^(https?:|mailto:|tel:)/i.test(url||''))return;
  const annotation=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,baseline-2,x+measure(text,font,size),baseline+size],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}});
  page.node.addAnnot(doc.context.register(annotation));
 }
 function newPage(){
  page=doc.addPage([WIDTH,HEIGHT]);y=HEIGHT-MARGIN;
  if(doc.getPageCount()>1){
   const label=wrap(data.name+' · Резюме',9,regular)[0];line(label,{size:9,color:GRAY});
   y-=9;page.drawLine({start:{x:MARGIN,y},end:{x:WIDTH-MARGIN,y},thickness:.35,color:GRAY});y-=19;
  }
 }
 function ensure(space){if(y-space<BOTTOM)newPage();}
 function textBlock(value,{size=10.5,font=regular,color=BLACK,structured=false}={}){
  const paragraphs=printable(value).split('\n');
  for(let n=0;n<paragraphs.length;n++){
   const paragraph=paragraphs[n];
   if(!paragraph.trim()){y-=4;continue;}
   const bullet=/^[•*\-]\s+/.test(paragraph.trim());
   const content=bullet?paragraph.trim().replace(/^[•*\-]\s+/,''):paragraph;
   const isHeading=structured&&!bullet&&(n===0||!paragraphs[n-1].trim())&&paragraph.length<=110&&!!paragraphs[n+1]?.trim();
   const rowFont=isHeading?bold:font;
   const rows=wrap(content,size,rowFont,WIDTH-MARGIN*2-(bullet?14:0));
   if(isHeading)ensure(size*2.8);
   for(let i=0;i<rows.length;i++){
    ensure(size*1.4);if(bullet&&i===0)line('•',{size,font,color});
    line(rows[i],{size,font:rowFont,color,indent:bullet?14:0});y-=size*1.22;
   }
  }
 }
 newPage();
 for(const row of wrap(data.name,28,regular)){ensure(34);line(row,{size:28,center:true});y-=33;}
 y-=3;
 for(let i=0;i<data.contacts.length;i+=3){
  const items=data.contacts.slice(i,i+3),column=(WIDTH-MARGIN*2)/items.length;
  const rows=items.map(c=>wrap(c.text,9.5,regular,column-14));
  const count=Math.max(...rows.map(r=>r.length));ensure(count*12);
  for(let n=0;n<count;n++){
   items.forEach((c,j)=>{const row=rows[j][n];if(!row)return;const x=MARGIN+column*j+(column-measure(row,regular,9.5))/2;page.drawText(row,{x,y,size:9.5,font:regular,color:BLACK});linkAnnotation(row,c.url,x,y);});y-=12;
  }
 }
 y-=3;
 for(const row of wrap(data.subtitle,9,italic)){ensure(13);line(row,{size:9,font:italic,center:true,color:GRAY});y-=12;}
 y-=10;
 for(const section of data.sections){
  const heading=wrap(section.title.toUpperCase(),12.5,regular);
  // Keep each section heading with at least two body lines on the same page.
  ensure(heading.length*15+38);
  for(const row of heading){line(row,{size:12.5});y-=15;}
  page.drawLine({start:{x:MARGIN,y:y+5},end:{x:WIDTH-MARGIN,y:y+5},thickness:.35,color:GRAY});y-=9;
  if(section.rows){
   for(const row of section.rows){
    const labels=wrap(row.label,10.5,bold,95),values=wrap(row.text,10.5,regular,WIDTH-MARGIN*2-108),count=Math.max(labels.length,values.length);
    ensure(count*13);
    for(let n=0;n<count;n++){if(labels[n])line(labels[n],{font:bold});if(values[n])line(values[n],{indent:108});y-=13;}
   }
  }else if(section.entries){
   for(const entry of section.entries){
    const titles=wrap(entry.name,10.5,bold);ensure(titles.length*13+28);
    for(const row of titles){line(row,{font:bold});y-=13;}
    if(entry.description)textBlock('• '+entry.description);
    if(entry.url){for(const row of wrap(entry.url.replace(/^https?:\/\//,''),9,regular,WIDTH-MARGIN*2-14)){ensure(12);line(row,{size:9,color:GRAY,indent:14});linkAnnotation(row,entry.url,MARGIN+14,y,9);y-=12;}}
    y-=5;
   }
  }else textBlock(section.text,{structured:['Опыт работы','Образование и курсы'].includes(section.title)});
  if(section.note){y-=5;textBlock(section.note,{size:8,color:GRAY});}
  y-=9;
 }
 ensure(22);textBlock('Категория: '+data.category,{size:8,color:GRAY});
 const pages=doc.getPages();
 for(let i=0;i<pages.length;i++){
  const footer=`ФСП Карьера · ${date(now)}  /  ${i+1} из ${pages.length}`;
  pages[i].drawText(footer,{x:MARGIN,y:23,size:7,font:regular,color:GRAY});
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
