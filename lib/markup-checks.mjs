import {parseFragment} from 'parse5';
import postcss from 'postcss';
export const MARKUP_RULES=['search-field','search-label','search-submit','plan-title','plan-basic','plan-pro','registration-email','registration-password','registration-submit','toolbar-display','toolbar-gap','toolbar-align','cards-display','cards-columns','cards-gap','layout-wide','layout-narrow','dom','dom-attributes','css-properties'];
const children=n=>n.childNodes||[];
const elements=n=>children(n).filter(c=>c.tagName);
const all=n=>[n,...children(n).flatMap(all)];
const attr=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;
const has=(n,k)=>attr(n,k)!==undefined;
const text=n=>n.nodeName==='#text'?n.value:children(n).map(text).join('');
const clean=s=>s.trim().replace(/\s+/g,' ');
const inlineHidden=n=>{const style=attr(n,'style');if(!style)return false;try{const declarations=cssProperties(':root{'+style+'}',':root');return declarations.display==='none'||['hidden','collapse'].includes(declarations.visibility);}catch{return true;}};
const usable=n=>!inlineHidden(n)&&!has(n,'disabled')&&!has(n,'hidden')&&attr(n,'aria-hidden')!=='true'&&!has(n,'inert');
const usableTree=n=>{for(let p=n;p;p=p.parentNode)if(!usable(p))return false;return true;};
const descendants=(n,tag)=>all(n).filter(c=>c.tagName===tag&&usableTree(c));
const labelFor=(form,input)=>attr(input,'id')&&descendants(form,'label').some(l=>attr(l,'for')===attr(input,'id')&&clean(text(l)));
function canonical(node){
 if(node.nodeName==='#text')return clean(node.value)||null;
 if(node.nodeName==='#comment')return null;
 return [node.tagName||'fragment',...children(node).map(canonical).filter(Boolean)];
}
// A new rule preserves the semantics of historical `dom` snapshots while checking
// attribute contracts in new tasks. Extra benign attributes are allowed.
function matchesNode(actual,expected){
 if(actual.nodeName!==expected.nodeName)return false;
 if(expected.nodeName==='#text')return clean(actual.value)===clean(expected.value);
 if((expected.attrs||[]).some(a=>attr(actual,a.name)!==a.value))return false;
 const significant=n=>children(n).filter(c=>c.nodeName!=='#comment'&&(c.nodeName!=='#text'||clean(c.value)));
 const a=significant(actual),e=significant(expected);
 return a.length===e.length&&e.every((node,i)=>matchesNode(a[i],node));
}
export function validCssExpectation(raw){
 try{const e=JSON.parse(raw);return e&&typeof e.selector==='string'&&e.selector.trim()&&e.selector.length<=200&&(e.width===undefined||Number.isFinite(e.width)&&e.width>=0)&&e.properties&&typeof e.properties==='object'&&!Array.isArray(e.properties)&&Object.keys(e.properties).length>0&&Object.entries(e.properties).every(([k,v])=>/^[a-z-]+$/.test(k)&&typeof v==='string'&&v.trim());}catch{return false;}
}
const value=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').trim().replace(/\s+/g,' ').replace(/\s*([(),])\s*/g,'$1').toLowerCase();
function cssProperties(source,selector,width){
 const root=postcss.parse(source),result={},important={};
 root.walkRules(rule=>{
  if(!rule.selectors?.includes(selector))return;
  for(let p=rule.parent;p&&p!==root;p=p.parent){
   if(p.type!=='atrule'||p.name!=='media')return;
   const match=p.params.match(/^\(\s*(max|min)-width\s*:\s*(\d+)px\s*\)$/i);
   if(!match||width===undefined||(match[1]==='max'?width>+match[2]:width<+match[2]))return;
  }
  for(const d of rule.nodes||[])if(d.type==='decl'){const prop=d.prop.toLowerCase();if(!important[prop]||d.important){result[prop]=value(d.value);important[prop]=!!d.important;}}
 });
 return result;
}
export function markupMatches(rule,source,expected){
 if(!MARKUP_RULES.includes(rule)||typeof source!=='string')return false;
 try{
  if(rule==='dom-attributes'){const dom=parseFragment(source);return all(dom).filter(n=>n.tagName).every(usableTree)&&matchesNode(dom,parseFragment(expected));}
  if(rule==='css-properties'){if(!validCssExpectation(expected))return false;const e=JSON.parse(expected),actual=cssProperties(source,e.selector,e.width);return Object.entries(e.properties).every(([k,v])=>actual[k]===value(v));}
  if(rule==='dom'){const dom=parseFragment(source);return all(dom).filter(n=>n.tagName).every(usableTree)&&JSON.stringify(canonical(dom))===JSON.stringify(canonical(parseFragment(expected)));}
  if(rule.startsWith('toolbar-')){const c=cssProperties(source,'.toolbar');return c[{ 'toolbar-display':'display','toolbar-gap':'gap','toolbar-align':'align-items'}[rule]]===({'toolbar-display':'flex','toolbar-gap':'16px','toolbar-align':'center'}[rule]);}
  if(rule.startsWith('cards-')){const c=cssProperties(source,'.cards');return rule==='cards-display'?c.display==='grid':rule==='cards-gap'?c.gap==='12px':['repeat(3,1fr)','1fr 1fr 1fr'].includes(c['grid-template-columns']);}
  if(rule.startsWith('layout-')){const c=cssProperties(source,'.layout',rule==='layout-wide'?800:500);return c.display==='grid'&&c['grid-template-columns']===(rule==='layout-wide'?'240px 1fr':'1fr');}
  const dom=parseFragment(source);
  if(rule.startsWith('plan-'))return descendants(dom,'fieldset').some(f=>{
   if(rule==='plan-title')return elements(f).some(n=>n.tagName==='legend'&&clean(text(n))==='Тариф');
   const plan=rule.slice(5),radios=descendants(f,'input').filter(n=>attr(n,'type')==='radio'&&attr(n,'name')==='plan');
   return radios.length===2&&radios.some(n=>attr(n,'value')===plan&&labelFor(f,n))&&new Set(radios.map(n=>attr(n,'id'))).size===2;
  });
  return descendants(dom,'form').some(f=>{
   const inputs=descendants(f,'input');
   if(rule==='search-field')return inputs.some(n=>attr(n,'type')==='search'&&attr(n,'name')==='query'&&attr(n,'id')==='query');
   if(rule==='search-label')return inputs.some(n=>attr(n,'type')==='search'&&attr(n,'name')==='query'&&labelFor(f,n));
   if(rule==='registration-email')return inputs.some(n=>attr(n,'type')==='email'&&attr(n,'name')==='email'&&attr(n,'id')==='email'&&has(n,'required')&&labelFor(f,n));
   if(rule==='registration-password')return inputs.some(n=>attr(n,'type')==='password'&&attr(n,'name')==='password'&&attr(n,'minlength')==='8'&&has(n,'required'));
   const title=rule==='search-submit'?'Найти':'Создать';
   return descendants(f,'button').some(n=>attr(n,'type')==='submit'&&clean(text(n))===title);
  });
 }catch{return false;}
}
