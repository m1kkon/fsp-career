import postcss from 'postcss';

// Keep shared rules in source order; defer only rules scoped to a feature.
// Mixed/shared selectors stay in core so profile summaries and modal primitives work everywhere.
function featureFor(rule, filename) {
 if (filename==='resume-editor.css') return 'resume';
 const selectors=postcss.list.comma(rule.selector);
 if (selectors.every(s=>/\.(?:assessment-|exam-|coding-|qualification-)/.test(s)&&!s.includes('.assessment-profile-result'))) return 'assessment';
 if (selectors.every(s=>/\.(?:resume-editor|resume-edit-modal)/.test(s))) return 'resume';
 return 'core';
}
export function splitClientStyles(sources) {
 const output={core:postcss.root(),assessment:postcss.root(),resume:postcss.root()};
 function select(node, feature, filename) {
  if(node.type==='comment') return null;
  if(node.type==='rule') return featureFor(node,filename)===feature?node.clone():null;
  if(node.type==='atrule'&&node.nodes&&!/keyframes$/.test(node.name)) {
   const children=node.nodes.map(child=>select(child,feature,filename)).filter(Boolean);
   return children.length?node.clone({nodes:children}):null;
  }
  return feature==='core'?node.clone():null;
 }
 for(const [filename,source] of sources) {
  const parsed=postcss.parse(source,{from:filename});
  for(const feature of Object.keys(output)) for(const node of parsed.nodes) {
   const selected=select(node,feature,filename);if(selected)output[feature].append(selected);
  }
 }
 // Imports must precede ordinary rules in the combined stylesheet.
 const imports=[];output.core.walkAtRules('import',rule=>{imports.push(rule.clone());rule.remove();});
 output.core.prepend(imports);
 return Object.fromEntries(Object.entries(output).map(([name,root])=>[name+'.css',root.toString()]));
}
