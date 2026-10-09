import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseFragment} from 'parse5';
import {technologyNames} from '../lib/technology-catalog.mjs';
import {parseNeed,selectedNeed} from '../lib/matching.mjs';
import {hiringTemplates,templateSkills,suggestedTemplate,initialSkillSelection,skillDisplayOrder} from '../public/hiring-templates.mjs';

const source=readFileSync(new URL('../public/mvp.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function confirmNeed(){'),source.indexOf('function locationLabel(){'));
function dialog(need,needRules={},needConfirmed=false){
 let html;
 const context=vm.createContext({state:{need},needContext:{},contextDraft:null,formatMoneyInput:value=>String(value??''),needRules,needConfirmed,needSpec:'',needGrade:'',query:need.text,
  specs:['Backend','Frontend','Data Science','ML Engineering','DevOps','QA'],grades:['Junior','Middle','Senior'],
  technologyOptions:vm.runInNewContext(source.match(/const technologyOptions=(.*?);/)[1]),
  hiringTemplates,templateSkills,suggestedTemplate,initialSkillSelection,skillDisplayOrder,esc:value=>String(value??''),options:()=>'',select:()=>'',field:()=>'',button:()=>'',formEnd:()=>'',modal:(_title,_hint,body)=>{html=body;},
 });
 vm.runInContext(functions+'\nconfirmNeed();',context);
 const rows=[];
 const walk=node=>{if(node.tagName==='div'&&node.attrs.some(a=>a.name==='class'&&a.value==='technology-rule'))rows.push(node);for(const child of node.childNodes||[])walk(child);};
 walk(parseFragment(html));
 const selected=[];
 const buttons=node=>{if(node.tagName==='button'&&node.attrs.some(a=>a.name==='aria-pressed'&&a.value==='true'))selected.push(Object.fromEntries(node.attrs.map(a=>[a.name,a.value])));for(const child of node.childNodes||[])buttons(child);};
 rows.forEach(buttons);
 return {html,context,selected};
}

test('Middle Python suggests preferences without changing extraction or search requirements',()=>{
 const need=parseNeed('Middle Python developer'),snapshot=structuredClone(need);
 const selection=initialSkillSelection(need,need);
 assert.equal(selection.template.id,'python-backend');
 assert.deepEqual([...selection.preferred],['Python','SQL','PostgreSQL','Docker','Pytest']);
 assert.equal(selection.required.size,0);assert.deepEqual(need,snapshot);
 assert.deepEqual(need.stack,['Python']);
});

test('explicit requirements retain their priority; removing all skills survives reopening',()=>{
 const need=parseNeed('Middle Backend Python PostgreSQL');
 const picked=initialSkillSelection(need,{requiredStack:['PostgreSQL'],preferredStack:['Python']});
 assert.deepEqual([...picked.required],['PostgreSQL']);assert.equal(picked.preferred.has('PostgreSQL'),false);
 const edited=initialSkillSelection(need,{requiredStack:'',preferredStack:''},true);
 assert.equal(edited.template,null);assert.equal(edited.required.size,0);assert.equal(edited.preferred.size,0);
 const confirmed=selectedNeed(need.text,{spec:need.spec,grade:need.grade,requiredStack:[],preferredStack:[],stack:[],confirmed:true});
 assert.deepEqual(confirmed.stack,[]);assert.equal(confirmed.confirmed,true);
});

test('ambiguous roles and multiple backend languages do not invent a template',()=>{
 assert.equal(suggestedTemplate(parseNeed('Middle Backend Frontend Python React')),null);
 assert.equal(suggestedTemplate(parseNeed('Middle Backend Python Java')),null);
 assert.equal(suggestedTemplate(parseNeed('Middle developer')),null);
 assert.equal(suggestedTemplate(parseNeed('Middle Data Science Python')).id,'data-science');
 assert.equal(suggestedTemplate(parseNeed('Middle Frontend React')).id,'react-frontend');
});

test('level changes suggestions; templates use supported technology names',()=>{
 const python=hiringTemplates[0];
 assert.deepEqual(templateSkills(python,'Junior'),['Python','SQL']);
 assert.ok(templateSkills(python,'Middle').includes('Pytest'));
 assert.ok(templateSkills(python,'Senior').includes('Kafka'));
 const allowed=vm.runInNewContext(source.match(/const technologyOptions=(.*?);/)[1]);
 for(const template of hiringTemplates)for(const skill of templateSkills(template,'Senior'))assert.ok(allowed.includes(skill),skill);
});

test('confirmation shows template source separately and respects saved empty selections',()=>{
 const need=parseNeed('Middle Python developer'),fresh=dialog(need);
 assert.ok(fresh.html.includes('Из шаблона'));
 assert.ok(fresh.html.includes('data-grade-hint>Middle и Senior'));
 assert.ok(!fresh.html.includes('Кандидаты с расхождениями'));
 assert.ok(!fresh.html.includes('понижает позицию'));
 assert.equal(fresh.selected.length,5);
 assert.ok(fresh.selected.every(button=>button['data-tech-mode']==='preferred'));
 assert.equal(dialog(need,{requiredStack:'',preferredStack:''},true).selected.length,0);
});

test('only five skills are visible initially and all other skills remain in the disclosure',()=>{
 const {html}=dialog(parseNeed('Senior Python developer'));
 const grids=[];
 const walk=node=>{if(node.tagName==='div'&&node.attrs.some(a=>a.name==='class'&&a.value==='technology-picker'))grids.push(node);for(const child of node.childNodes||[])walk(child);};
 walk(parseFragment(html));
 const cards=grid=>grid.childNodes.filter(node=>node.tagName==='div');
 assert.equal(cards(grids[0]).length,5);assert.equal(cards(grids[1]).length,technologyNames.length-5);
 assert.ok(html.includes(`Показать ещё ${technologyNames.length-5}`));
 const order=skillDisplayOrder(['JavaScript','Python','CSS','HTML','TypeScript','PostgreSQL'],['PostgreSQL'],['Python'],hiringTemplates.find(item=>item.id==='web-frontend'));
 assert.deepEqual(order.slice(0,5),['PostgreSQL','Python','JavaScript','HTML','CSS']);
});

test('template changes move the right skills into five visible cards without losing hidden selections',()=>{
 const {context}=dialog(parseNeed('Middle Python'));
 const names=vm.runInNewContext(source.match(/const technologyOptions=(.*?);/)[1]);
 const rows=names.map(name=>{
  const control=mode=>({dataset:{techName:name},getAttribute:()=>mode==='preferred'&&['Python','React','JavaScript','HTML','CSS','TypeScript','Playwright'].includes(name)?'true':'false'});
  const required=control('required'),preferred=control('preferred');
  return {name,querySelector:selector=>selector.includes('preferred')?preferred:required};
 });
 const main={append(...items){this.items=items;}},extra={append(...items){this.items=items;}},summary={textContent:''};
 const details={querySelector:selector=>selector==='summary'?summary:extra};
 context.form={querySelectorAll:()=>rows,querySelector:selector=>selector==='.technology-picker'?main:details};
 context.template=hiringTemplates.find(item=>item.id==='react-frontend');
 vm.runInContext('arrangeNeedSkills(form,template)',context);
 assert.equal(main.items.length,5);assert.equal(extra.items.length,names.length-5);assert.equal(summary.textContent,`Показать ещё ${names.length-5}`);
 assert.deepEqual(main.items.map(row=>row.name),['Python','React','JavaScript','HTML','CSS']);
 assert.ok(extra.items.some(row=>row.name==='Playwright'),'selected skills beyond five are retained');
 assert.equal(new Set([...main.items,...extra.items]).size,names.length);
});

test('changing templates replaces untouched suggestions but keeps explicit and edited choices',()=>{
 const makeRow=(name,mode,automatic=false)=>{
  const control=kind=>({dataset:{techName:name},pressed:mode===kind?'true':'false',getAttribute(){return this.pressed;},setAttribute(_key,value){this.pressed=value;}});
  const required=control('required'),preferred=control('preferred'),label={textContent:''};
  return {dataset:{templateSkill:String(automatic)},required,preferred,querySelector:selector=>selector.includes('required')?required:selector.includes('preferred')?preferred:label};
 };
 const rows=[makeRow('Python','preferred'),makeRow('PostgreSQL','required'),makeRow('Docker','preferred',true),makeRow('Pytest','preferred'),makeRow('React',null),makeRow('JavaScript',null),makeRow('HTML',null),makeRow('CSS',null),makeRow('TypeScript',null),makeRow('Playwright',null)];
 const selector={value:'react-frontend'},note={textContent:''},details={querySelectorAll:()=>rows,querySelector:()=>null};
 const form={elements:{grade:{value:'Middle'},spec:{value:'Backend'}},querySelectorAll:()=>rows,querySelector:key=>key==='#skill-template'?selector:key==='.technology-more'?details:note};
 const {context}=dialog(parseNeed('Middle Python'));context.form=form;
 vm.runInContext('applyNeedTemplate(form)',context);
 assert.equal(rows[2].preferred.pressed,'false','untouched Python template skill removed');
 assert.equal(rows[0].preferred.pressed,'true','explicit Python retained');
 assert.equal(rows[1].required.pressed,'true','required PostgreSQL retained');
 assert.equal(rows[3].preferred.pressed,'true','manually edited Pytest retained');
 assert.equal(rows[4].preferred.pressed,'true');assert.equal(form.elements.spec.value,'Frontend');
 selector.value='';vm.runInContext('applyNeedTemplate(form)',context);
 assert.equal(rows[4].preferred.pressed,'false');assert.equal(rows[3].preferred.pressed,'true');
});

test('specialization and grade changes synchronize suggestions and never restore a manually removed skill',()=>{
 const {context}=dialog(parseNeed('Middle Python developer'));
 const makeRow=(name,mode,automatic=false,edited=false)=>{
  const control=kind=>({dataset:{techName:name},pressed:mode===kind?'true':'false',getAttribute(){return this.pressed;},setAttribute(_key,value){this.pressed=value;}});
  const required=control('required'),preferred=control('preferred'),label={textContent:''};
  return {dataset:{templateSkill:String(automatic),skillEdited:String(edited)},required,preferred,querySelector:selector=>selector.includes('required')?required:selector.includes('preferred')?preferred:label};
 };
 const rows=[makeRow('Python','required',false,true),makeRow('Docker','preferred',true),makeRow('Pytest','preferred',false,true),makeRow('JavaScript',null),makeRow('HTML',null),makeRow('CSS',null),makeRow('TypeScript',null,false,true),makeRow('Playwright',null),makeRow('CI/CD',null)];
 const selector={value:'python-backend'},note={textContent:''},hint={textContent:''},details={querySelectorAll:()=>rows,querySelector:()=>null};
 const form={elements:{grade:{value:'Junior'},spec:{value:'Frontend'}},querySelectorAll:()=>rows,querySelector:key=>key==='#skill-template'?selector:key==='.technology-more'?details:key==='[data-grade-hint]'?hint:note};
 context.form=form;
 vm.runInContext("syncNeedTemplate(form,'confirmed-spec')",context);
 assert.equal(selector.value,'web-frontend');assert.ok(!selector.innerHTML.includes('Python · Backend'));
 assert.equal(rows[1].preferred.pressed,'false');assert.equal(rows[3].preferred.pressed,'true');
 assert.equal(rows[0].required.pressed,'true');assert.equal(rows[2].preferred.pressed,'true');
 assert.match(note.textContent,/Frontend.*Junior/);assert.equal(hint.textContent,'Junior, Middle и Senior');
 form.elements.grade.value='Senior';vm.runInContext("syncNeedTemplate(form,'confirmed-grade')",context);
 assert.equal(rows[6].preferred.pressed,'false','manually removed TypeScript is not restored');
 assert.equal(rows[7].preferred.pressed,'true');assert.equal(rows[8].preferred.pressed,'true');
 assert.match(note.textContent,/Frontend.*Senior/);assert.equal(hint.textContent,'Senior');
 form.elements.grade.value='Junior';vm.runInContext("syncNeedTemplate(form,'confirmed-grade')",context);
 assert.equal(rows[7].preferred.pressed,'false');assert.equal(rows[8].preferred.pressed,'false');
 assert.equal(rows[0].required.pressed,'true');assert.equal(rows[2].preferred.pressed,'true');
});

test('browser and server share the same canonical technology vocabulary',()=>{
 const names=vm.runInNewContext(source.match(/const technologyOptions=(.*?);/)[1]);
 assert.deepEqual(Array.from(names),technologyNames);
});


test('confirmation has salary range fields with distinct IDs and carries the current bounds',()=>{
 const {html}=dialog(parseNeed('Middle Backend Python',{budgetMin:100000,budgetMax:200000}));
 assert.match(html,/id="confirmed-budgetMin" name="budgetMin" value="100000"/);
 assert.match(html,/id="confirmed-budgetMax" name="budgetMax" value="200000"/);
 assert.ok(html.indexOf('confirmed-budgetMin')<html.indexOf('skill-template'));
 assert.doesNotMatch(html,/name="salaryRequired"/);
});
