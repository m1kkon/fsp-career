import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {splitClientStyles} from '../scripts/client-styles.mjs';

test('feature splitting preserves conditions and rule order while shared selectors and imports remain global',()=>{
 const styles=splitClientStyles([
  ['styles.css','.button{color:black}.exam-question{color:blue}@media(max-width:700px){.exam-question{color:red}.header{height:44px}}'],
  ['enterprise.css','@import url("fonts.css");.exam-question{font-size:18px}.assessment-profile-result{color:green}.assessment-card,.shared-card{padding:12px}'],
  ['resume-editor.css','.resume-editor-nav{display:flex}'],
 ]);
 assert.ok(styles['core.css'].startsWith('@import'));assert.ok(styles['core.css'].includes('.assessment-profile-result'));assert.ok(styles['core.css'].includes('.shared-card'));
 assert.ok(!styles['core.css'].includes('.exam-question'));assert.ok(!styles['core.css'].includes('.resume-editor-nav'));
 assert.ok(styles['assessment.css'].includes('@media(max-width:700px)'));assert.ok(styles['assessment.css'].indexOf('color:blue')<styles['assessment.css'].indexOf('color:red'));assert.ok(styles['assessment.css'].indexOf('color:red')<styles['assessment.css'].indexOf('font-size:18px'));
 assert.ok(styles['resume.css'].includes('.resume-editor-nav'));assert.ok(!styles['resume.css'].includes('.button'));
});

test('published styles keep semantic tokens available and defer the exam and resume workspace',()=>{
 const names=['tokens.css','styles.css','enterprise.css','marketplace.css','mvp.css','resume-editor.css','product.css'];
 const styles=splitClientStyles(names.map(name=>[name,readFileSync(new URL('../public/'+name,import.meta.url),'utf8')]));
 const original=names.reduce((n,name)=>n+readFileSync(new URL('../public/'+name,import.meta.url)).length,0);
 assert.ok(Buffer.byteLength(styles['core.css'])<original*.85);
 assert.ok(styles['core.css'].includes('--exam-focus:'));assert.ok(styles['assessment.css'].includes('.assessment-numeric input:focus-visible'));assert.ok(styles['resume.css'].includes('.resume-editor-nav'));
 const declared=new Set();postcss.parse(styles['core.css']).walkDecls(d=>{if(d.prop.startsWith('--'))declared.add(d.prop);});
 const product=readFileSync(new URL('../public/product.css',import.meta.url),'utf8');
 postcss.parse(product).walkDecls(d=>{assert.ok(!/#[0-9a-f]{3,8}\b/i.test(d.value));for(const match of d.value.matchAll(/var\((--[\w-]+)/g))assert.ok(declared.has(match[1])||match[1].startsWith('--exam-')||['--coding-text-size','--motion-delay'].includes(match[1]),match[1]);});
});

test('navigation waits for feature CSS, reuses it and loads no workspace styles on the homepage',async()=>{
 const {runInNewContext}=await import('node:vm');
 const code=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
 const setup=code.slice(code.indexOf('const featureStyleUrls'),code.indexOf('const iconPaths')).replace('/* versioned styles */ {}','{assessment:"/exam.css",resume:"/resume.css"}');
 const links=[];let renders=0;
 const context={page:'home',standaloneTestAdmin:false,assessmentExamActive:()=>false,document:{createElement:()=>({dataset:{}}),head:{appendChild:link=>links.push(link)}},render:()=>renders++,app:{},esc:String};
 runInNewContext(setup,context);
 assert.equal(context.ensureViewStyles(),true);assert.equal(links.length,0);
 context.page='tests';assert.equal(context.ensureViewStyles(),false);assert.equal(context.ensureViewStyles(),false);assert.equal(links.length,1);assert.equal(renders,0);
 links[0].onload();await new Promise(resolve=>setImmediate(resolve));assert.equal(renders,1);assert.equal(context.ensureViewStyles(),true);
 context.page='home';assert.equal(context.ensureViewStyles(),true);context.page='tests';assert.equal(context.ensureViewStyles(),true);assert.equal(links.length,1);
 context.page='profile';assert.equal(context.ensureViewStyles(),false);assert.equal(links.length,2);assert.equal(links[1].href,'/resume.css');links[1].onload();await new Promise(resolve=>setImmediate(resolve));assert.equal(context.ensureViewStyles(),true);
});
