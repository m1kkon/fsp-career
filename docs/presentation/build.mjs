// Renders the slide sources (the Slides artifact format) into a PDF and a preview sheet.
// Usage: node docs/presentation/build.mjs [sourceDir] [outDir]
// Needs a local Chrome and playwright-core: `npm i --no-save playwright-core` or set PLAYWRIGHT_MODULE.
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const src=resolve(args[0]||join(here,'source'));
const out=resolve(args[1]||here);
const pngDir=process.argv.find(a=>a.startsWith('--png='))?.slice(6);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');

const deck=JSON.parse(readFileSync(join(src,'deck.json'),'utf8'));
// Slides reference uploaded assets as /_blob/<id>; assets.json maps them to files beside the sources.
const assets=JSON.parse(readFileSync(join(src,'assets.json'),'utf8'));

// The slide format's custom elements, drawn with plain HTML for a browser render.
const iconPaths={
 Link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
 Verified:'<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
 Chart:'<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
 Users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 Lock:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 Check:'<path d="M20 6 9 17l-5-5"/>',
 Search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
 Code:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
 Trust:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
};
const arrows={
 'arrow-right':'polygon(0 32%,60% 32%,60% 0,100% 50%,60% 100%,60% 68%,0 68%)',
 'arrow-left':'polygon(100% 32%,40% 32%,40% 0,0 50%,40% 100%,40% 68%,100% 68%)',
};

function slide(id){
 let html=readFileSync(join(src,'slides',id+'.html'),'utf8');
 html=html.replace(/<aside>[\s\S]*?<\/aside>/g,'');
 html=html.replace(/\/_blob\/[0-9a-f]{32}/g,ref=>{
  if(!assets[ref])throw new Error(`${id}: no file for ${ref} in assets.json`);
  return pathToFileURL(resolve(src,assets[ref])).href;
 });
 html=html.replace(/<x-shape kind="([\w-]+)" style="([^"]*)"><\/x-shape>/g,(_,kind,style)=>{
  const shape=kind==='ellipse'?'border-radius:50%':arrows[kind]?`clip-path:${arrows[kind]}`:'';
  return `<div style="${style};${shape}"></div>`;
 });
 html=html.replace(/<x-icon name="(\w+)" style="([^"]*)"><\/x-icon>/g,(_,name,style)=>{
  if(!iconPaths[name])throw new Error(`${id}: icon ${name} is not drawn by build.mjs`);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${style}">${iconPaths[name]}</svg>`;
 });
 return html;
}

const fonts=Object.values(deck.faces||{}).filter(face=>face.href).map(face=>`<link rel="stylesheet" href="${face.href}">`).join('');
const base=`*{box-sizing:border-box}body{margin:0;background:#e9e9f0}h1,h2,h3,p,ul,ol,table{margin:0}
h1,h2,h3{font-weight:600}h1{line-height:1.1}h2{line-height:1.15}h3{line-height:1.2}p{line-height:1.4}
img,svg{display:block}table{border-collapse:collapse}th,td{padding:.35em .6em;text-align:left}th{font-weight:600}tr+tr td{border-top:1px solid #e3e4ef}
section{position:relative;width:1920px;height:1080px;overflow:hidden;-webkit-font-smoothing:antialiased}`;
const slides=deck.order.map(slide);
const page=(body,extra='')=>`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${deck.title}</title>${fonts}<style>${base}${extra}</style></head><body>${body}</body></html>`;

const work=mkdtempSync(join(tmpdir(),'fsp-deck-'));
writeFileSync(join(work,'deck.html'),page(slides.join('\n'),'@page{size:1920px 1080px;margin:0}section{break-after:page}'));
writeFileSync(join(work,'sheet.html'),page(`<main>${slides.map(s=>`<div class="cell">${s}</div>`).join('')}</main>`,
 'main{display:grid;grid-template-columns:repeat(3,640px);gap:24px;padding:24px;width:max-content}.cell{width:640px;height:360px;overflow:hidden;border-radius:10px;box-shadow:0 2px 8px #1c1d2a1f}.cell>section{transform:scale(.3333334);transform-origin:0 0}'));

const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'chrome'});
try{
 const ready=async p=>{await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);};
 const pdf=await browser.newPage();await pdf.goto(pathToFileURL(join(work,'deck.html')).href,{waitUntil:'networkidle'});await ready(pdf);
 mkdirSync(out,{recursive:true});
 await pdf.pdf({path:join(out,'fsp-career-presentation.pdf'),width:'1920px',height:'1080px',printBackground:true,preferCSSPageSize:true});
 if(pngDir){mkdirSync(pngDir,{recursive:true});const shots=await browser.newPage({viewport:{width:1920,height:1080}});await shots.goto(pathToFileURL(join(work,'deck.html')).href,{waitUntil:'networkidle'});await ready(shots);
  const sections=await shots.$$('section');for(const [i,el] of sections.entries())await el.screenshot({path:join(pngDir,`${String(i+1).padStart(2,'0')}-${deck.order[i]}.png`)});}
 const sheet=await browser.newPage({viewport:{width:2016,height:800}});await sheet.goto(pathToFileURL(join(work,'sheet.html')).href,{waitUntil:'networkidle'});await ready(sheet);
 await sheet.screenshot({path:join(out,'preview.jpg'),fullPage:true,type:'jpeg',quality:82});
}finally{await browser.close();}
console.log(`${deck.order.length} slides → ${join(out,'fsp-career-presentation.pdf')} and preview.jpg`);
