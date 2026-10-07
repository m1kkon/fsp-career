import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditBank} from '../scripts/question-bank/audit.mjs';
import {INITIAL_QUESTIONS} from '../lib/question-bank.mjs';
import {BANK_100_QUESTIONS} from '../lib/question-bank-100.mjs';
import {MIXED_CODING_QUESTIONS,MIXED_CODING_SOLUTIONS} from '../lib/mixed-coding-bank.mjs';
import {markupMatches} from '../lib/markup-checks.mjs';
import {validateQuestion} from '../lib/assessments.mjs';
import {outputMatches,runCode} from '../lib/code-runner.mjs';

test('complete question bank satisfies counts, keys, module coverage, answer balance and independent coding cases',()=>{
 const result=auditBank();assert.equal(result.questions,1927);assert.equal(result.ordinary,1800);assert.equal(result.retired,10);
});
test('reordered options preserve every generated answer, and old seed instances are never mutated',()=>{
 for(const old of BANK_100_QUESTIONS){const q=INITIAL_QUESTIONS.find(q=>q.id===old.id);assert.ok(q);if(old.format==='choice'){assert.equal(q.options[q.correct],old.options[old.correct],q.id);assert.equal(old.correct,0);assert.equal(q.version,2);}else assert.equal(q.numeric.expected,old.numeric.expected);}
});
test('CSS border and rollout statements specify the assumptions required by their keys',()=>{
 for(const q of INITIAL_QUESTIONS.filter(q=>q.familyId==='integration-frontend:adaptive-react-css-border-box'))assert.match(q.prompt,/border:"2px solid"/);
 for(const q of INITIAL_QUESTIONS.filter(q=>q.familyId.endsWith('rolling-max-surge')||q.familyId.endsWith('python-rollout-max-surge')))assert.match(q.prompt,/terminating/);
});
test('HTML grading accepts equivalent syntax and rejects comment bait, disabled controls, broken labels and external controls',()=>{
 const valid="<form><label for='query'>Поиск</label><input id='query' name='query' type='search'><button type='submit'>Найти</button></form>";
 for(const rule of ['search-field','search-label','search-submit'])assert.ok(markupMatches(rule,valid),rule);
 for(const source of ['<!--'+valid+'-->',valid.replace("type='search'","type='search' disabled"),valid.replace("for='query'","for='wrong'"),valid.replace("<form>",'').replace('</form>','')])assert.equal(markupMatches('search-label',source),false,source);
 assert.equal(markupMatches('search-submit',valid.replace("type='submit'","type='submit' disabled")),false);
 assert.equal(markupMatches('search-field',valid.replace('<form>','<form hidden>')),false);
});
test('CSS grading uses declarations, selectors, media boundaries and importance rather than substrings',()=>{
 const css='.toolbar{ display:flex; gap:16px; align-items:center }';
 for(const rule of ['toolbar-display','toolbar-gap','toolbar-align'])assert.ok(markupMatches(rule,css));
 for(const source of ['/*'+css+'*/',css.replace('.toolbar','.wrong'),'.toolbar{content:"display: flex; gap: 16px; align-items: center"}',css+' .toolbar {display:block}',css.replace('display:flex','display:block!important;display:flex')])assert.equal(markupMatches('toolbar-display',source),false,source);
 const responsive='.layout{display:grid;grid-template-columns:240px 1fr}@media (max-width:600px){.layout{grid-template-columns:1fr}}';
 assert.ok(markupMatches('layout-wide',responsive));assert.ok(markupMatches('layout-narrow',responsive));
 assert.equal(markupMatches('layout-narrow',responsive.replace('max-width','min-width')),false);
 assert.equal(markupMatches('layout-wide',responsive.replace('@media (max-width:600px)','@media (max-width:1000px)')),false);
});
test('React checks enforce hierarchy, list order and absence of extra items while accepting attributes and formatting',()=>{
 const expected='<ul><li>Python</li><li>SQL</li></ul>';
 assert.ok(markupMatches('dom','<ul class="skills">\n<li>Python</li>\n<li>SQL</li>\n</ul>',expected));
 for(const bad of ['<ul></ul><li>Python</li><li>SQL</li>','<ul><li>SQL</li><li>Python</li></ul>','<ul><li>Python</li><li>SQL</li><li>React</li></ul>','<!--'+expected+'-->','<ul style="display:none"><li>Python</li><li>SQL</li></ul>'])assert.equal(markupMatches('dom',bad,expected),false);
});
test('maintainer validation rejects malformed keys and checks instead of silently creating permissive rules',()=>{
 const coding=structuredClone(MIXED_CODING_QUESTIONS[0]);
 for(const t of [{stdin:'[]',public:true,contains:[]},{stdin:'[]',public:true,expected:'1',comparison:'unknown'},{stdin:'[]',public:true,expected:'{',comparison:'json'},{stdin:5,public:true,expected:'1'},{stdin:'[]',public:true,markupRule:'unknown'},{stdin:'[]',public:true,markupRule:'dom',expected:'<p/>'}])assert.throws(()=>validateQuestion({...coding,coding:{...coding.coding,tests:[t]}}));
 const choice=INITIAL_QUESTIONS.find(q=>q.format==='choice');for(const correct of ['',null,true])assert.throws(()=>validateQuestion({...choice,correct}));
 const number=INITIAL_QUESTIONS.find(q=>q.format==='numeric');for(const expected of [true,'0x10','Infinity'])assert.throws(()=>validateQuestion({...number,numeric:{...number.numeric,expected}}));
});
test('prototype-named JSON keys have ordinary frequencies and sums',()=>{
 for(const name of ['mixed-coding-python-frequencies-v1','mixed-coding-javascript-group-sum-v1']){
  const q=MIXED_CODING_QUESTIONS.find(q=>q.id===name),t=q.coding.tests.find(t=>t.stdin.includes('__proto__'));assert.ok(t);assert.ok(Object.hasOwn(JSON.parse(t.expected),'__proto__'));assert.ok(outputMatches(t,t.expected));
 }
});
test('real React grading checks different props and rejects static example solutions',{skip:process.env.CODE_SANDBOX_TESTS!=='1'},async()=>{
 const q=MIXED_CODING_QUESTIONS.find(q=>q.id==='mixed-coding-react-filter-v1');assert.ok((await runCode(q,MIXED_CODING_SOLUTIONS.get(q.id))).correct);
 const run=await runCode(q,'export default function Task(){return <ul><li>Python</li></ul>}');assert.equal(run.correct,false);assert.equal(run.passed,1);
});
