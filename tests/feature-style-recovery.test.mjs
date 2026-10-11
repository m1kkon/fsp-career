import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
const styles=source.slice(source.indexOf('const featureStyleUrls'),source.indexOf('const iconPaths')).replace('/* versioned styles */ {}',"{resume:'/resume.css',assessment:'/assessment.css'}");
function client(){
 const links=[],notices=[],timers=new Set();let renders=0;
 const app={innerHTML:'<form>Unsaved résumé</form>',querySelector:()=>null,prepend:notice=>notices.push(notice)};
 const context=vm.createContext({standaloneTestAdmin:false,page:'profile',assessmentExamActive:()=>false,app,esc:String,
  setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),render:()=>renders++,
  document:{head:{appendChild:link=>links.push(link)},createElement:tag=>({tag,dataset:{},setAttribute(){},remove(){this.removed=true;}})}
 });
 vm.runInContext(styles,context);
 return {context,links,notices,timers,app,renders:()=>renders,load:()=>vm.runInContext('ensureViewStyles()',context)};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('failed feature styling preserves the open draft and can retry without reloading the application',async()=>{
 const c=client();assert.equal(c.load(),false);assert.equal(c.load(),false);assert.equal(c.links.length,1);
 c.links[0].onerror();await settle();
 assert.equal(c.app.innerHTML,'<form>Unsaved résumé</form>');assert.equal(c.renders(),0);assert.equal(c.notices.length,1);
 assert.match(c.notices[0].innerHTML,/data-action="retry-view-styles"/);assert.doesNotMatch(c.notices[0].innerHTML,/location.reload/);assert.equal(c.timers.size,0);
 c.load();assert.equal(c.links.length,2);c.links[1].onload();await settle();assert.equal(c.renders(),1);assert.equal(c.load(),true);
});

test('a stalled stylesheet releases the loader and ignores its late success callback',async()=>{
 const c=client();c.load();const late=c.links[0].onload;[...c.timers][0]();await settle();
 assert.equal(c.links[0].removed,true);assert.equal(c.notices.length,1);late();await settle();assert.equal(c.renders(),0);
 c.load();assert.equal(c.links.length,2);c.links[1].onload();await settle();assert.equal(c.load(),true);
});

test('late styling callbacks do not replace the current route or its draft',async()=>{
 for(const success of [true,false]){
  const c=client();c.load();c.context.page='jobs';c.app.innerHTML='<form>New search draft</form>';
  c.links[0][success?'onload':'onerror']();await settle();
  assert.equal(c.renders(),0);assert.equal(c.notices.length,0);assert.equal(c.app.innerHTML,'<form>New search draft</form>');
 }
});

test('switching between feature routes starts only the current route after the old load settles',async()=>{
 const c=client();c.load();c.context.page='tests';assert.equal(c.load(),false);assert.equal(c.links.length,1);
 c.context.render=()=>c.load();c.links[0].onerror();await settle();assert.equal(c.notices.length,0);assert.equal(c.links.length,2);assert.equal(c.links[1].href,'/assessment.css');
 c.links[1].onload();await settle();assert.equal(c.load(),true);
});
