import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {matching,selectedNeed,rankCandidates,WEIGHTS} from '../../lib/matching.mjs';
import {mockFspProfile} from '../../lib/fsp.mjs';
import {assembleAdaptiveVariant,bank,correctAnswer} from '../../lib/assessments.mjs';
import {DEFAULT_SPECS,ROLES} from '../../lib/question-bank.mjs';
import {routingDecision,adaptiveScore} from '../../lib/adaptive-testing.mjs';
import {meetsModuleGrade} from '../../lib/assessment-scoring.mjs';
import {roleGradeOutcome} from '../../lib/role-grade.mjs';
import {rankingMetrics,meanMetrics,tiedPrecisionAtK} from './ranking-metrics.mjs';
import {mean,confusionMetrics,gradedNdcg,seededRandom,wilson} from './validation-metrics.mjs';
import {VERSION,AS_OF,GRADE_PERSONAS,matchingScenarios} from './fixtures/synthetic-v1.mjs';

const LABELS=['BelowJunior','Junior','Middle','Senior'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const DEVELOPMENT_SPECS=new Set(['Backend','QA','Data Science']);
// Only the offline synchronous assembler is seeded. Restore immediately; no
// seeded randomness or synthetic answers enter the deployed application.
function seededAssembly(seed,fn){
 const random=seededRandom(seed),original=Math.random,originalCrypto=crypto.getRandomValues;
 Math.random=random;crypto.getRandomValues=array=>{for(let i=0;i<array.length;i++)array[i]=Math.floor(random()*2**32);return array;};
 try{return fn();}finally{Math.random=original;crypto.getRandomValues=originalCrypto;}
}
const selected=(split,value)=>split==='all'||split===value;

export function evaluateMatching(split='development'){
 const reports=matchingScenarios().filter(s=>selected(split,s.split)).map(scenario=>{
  const need=selectedNeed(scenario.need.text,scenario.need.selection);
  const rows=scenario.candidates.map(row=>{const candidate={...row.candidate,fsp:row.candidate.fspId?mockFspProfile(row.candidate.fspId):null};return {...candidate,label:row.label,reason:row.reason,expectedEligibility:row.expectedEligibility,match:matching(candidate,need,Date.parse(AS_OF))};});
  const ranked=rankCandidates(rows,need),binary=ranked.map(row=>Number(row.label>=2));
  const metrics=rankingMetrics(binary);
  const top=ranked.slice(0,5), eligible=ranked.filter(row=>row.match.eligibility.status==='pass');
  return {id:scenario.id,spec:scenario.spec,split:scenario.split,n:rows.length,metrics:{...metrics,gradedNdcgAt5:gradedNdcg(ranked.map(row=>row.label)),
   tiedPrecisionAt5:tiedPrecisionAtK(ranked.map(row=>({tieKey:`${row.match.eligibility.status}:${row.match.score}:${row.match.strength}:${row.score}`,label:Number(row.label>=2)}))),
   eligibilityAccuracy:rows.filter(row=>row.match.eligibility.status===row.expectedEligibility).length/rows.length,
   invalidTop5:top.filter(row=>row.expectedEligibility!=='pass').length,
   scoreExplanationAccuracy:rows.filter(row=>row.match.score===row.match.parts.reduce((sum,part)=>sum+part.points,0)).length/rows.length},
   top5:top.map(row=>({id:row.id,score:row.match.score,label:row.label,status:row.match.eligibility.status,reason:row.reason})),
   failures:rows.filter(row=>row.match.eligibility.status!==row.expectedEligibility).map(row=>({id:row.id,expected:row.expectedEligibility,actual:row.match.eligibility.status,checks:row.match.eligibility.checks})),
   pairwise:{higherVsIrrelevant:eligible.findIndex(row=>row.id.endsWith('-higher'))<eligible.findIndex(row=>row.id.endsWith('-unrelated')),
    relevantVsDenied:eligible.findIndex(row=>row.id.endsWith('-no-fsp'))<eligible.findIndex(row=>row.id.endsWith('-denied')),
    relevantVsTags:eligible.findIndex(row=>row.id.endsWith('-no-fsp'))<eligible.findIndex(row=>row.id.endsWith('-tags'))}};
 });
 return {scenarios:reports.length,pairs:reports.reduce((s,row)=>s+row.n,0),weights:WEIGHTS,summary:meanMetrics(reports.map(row=>row.metrics)),
  bySplit:Object.fromEntries(['development','holdout'].map(key=>[key,meanMetrics(reports.filter(row=>row.split===key).map(row=>row.metrics))])),
  pairwise:Object.fromEntries(['higherVsIrrelevant','relevantVsDenied','relevantVsTags'].map(key=>[key,mean(reports.map(row=>Number(row.pairwise[key])))])),cases:reports};
}

function answerValue(q,persona,seed){
 const random=seededRandom(seed),variation=(seededRandom(q.familyId)()-.5)*.12;
 const probability=base=>base===0||base===1?base:Math.max(0,Math.min(1,base+variation));
 if(q.format==='coding'){
  const full=random()<probability(persona.coding[q.difficulty-1]),total=q.coding.tests.length;
  // A failed task is skipped or partially solved, not independent test-case
  // coin flips. Coding checks of one program are correlated.
  const passed=full?total:random()<.35?0:Math.floor(total*(.2+random()*.5));
  return {judged:true,passed,total,correct:passed===total,source:'offline synthetic judge snapshot'};
 }
 const correct=random()<probability(persona.theory[q.difficulty-1]);
 return q.format==='choice'?(correct?q.correct:(q.correct+1+Math.floor(random()*3))%4):(correct?String(q.numeric.expected):String(q.numeric.expected+1000));
}
function moduleAttempt(form,spec,persona,seed,observations){
 const m={spec,questions:form.first,answers:{},adaptive:{selectedRoute:null}};
 const answer=q=>{const value=answerValue(q,persona,`${seed}:${q.id}`);m.answers[q.id]={value};observations.push({id:q.id,moduleId:q.moduleId,difficulty:q.difficulty,format:q.format,grade:persona.grade,correct:correctAnswer(q,value)});};
 m.questions.forEach(answer);m.adaptive.selectedRoute=routingDecision(m,correctAnswer).route;
 m.questions=[...m.questions,...form.routes[m.adaptive.selectedRoute]];m.questions.slice(16).forEach(answer);
 return {...adaptiveScore(m,correctAnswer),moduleId:spec.moduleId,thresholds:spec.thresholds};
}
export async function evaluateGrades({split='development',peoplePerGrade=100,formsPerModule=20,policyOverride=null,seedNamespace=VERSION,personas=GRADE_PERSONAS}={}){
 if(!['development','holdout','all'].includes(split)||!Number.isInteger(peoplePerGrade)||peoplePerGrade<1||peoplePerGrade>1000||!Number.isInteger(formsPerModule)||formsPerModule<2||formsPerModule>100)throw new Error('Use 1–1000 simulations per grade and 2–100 forms per module');
 const questions=(await bank({records:async()=>[]})).filter(q=>q.status==='working').map(q=>({...q,scored:true}));
 const roles=ROLES.filter(role=>selected(split,DEVELOPMENT_SPECS.has(role.spec)?'development':'holdout'));
 const moduleIds=new Set(roles.flatMap(role=>[...role.modules,role.integration]));
 const forms=new Map(),formManifest=[];
 const specFor=moduleId=>{const spec=structuredClone(DEFAULT_SPECS.find(s=>s.moduleId===moduleId));if(policyOverride){spec.thresholds=policyOverride.thresholds;spec.scoring.rule=policyOverride.rule||'rasch-theory-practice-v2';spec.scoring.routingCodingSolvedMin=policyOverride.routingCodingSolvedMin;for(const [grade,value] of Object.entries(policyOverride.codingMin)){spec.scoring.grades[grade].codingMin=value;spec.scoring.grades[grade].theoryMin=policyOverride.theoryMin?.[grade]||0;}}return spec;};
 for(const moduleId of moduleIds){
  const spec=specFor(moduleId),pool=questions.filter(q=>q.moduleId===moduleId);
  const variants=Array.from({length:formsPerModule},(_,i)=>seededAssembly(`${seedNamespace}:form:${moduleId}:${i}`,()=>assembleAdaptiveVariant(pool,spec)));
  forms.set(moduleId,variants);
  const reference=q=>({id:q.id,version:q.version,familyId:q.familyId,difficulty:q.difficulty,format:q.format});
  formManifest.push({moduleId,forms:variants.map((form,i)=>({index:i,first:form.first.map(reference),routes:Object.fromEntries(Object.entries(form.routes).map(([key,qs])=>[key,qs.map(reference)]))}))});
 }
 const observations=[],attempts=[];
 for(const role of roles)for(const persona of personas)for(let i=0;i<peoplePerGrade;i++){
  const personId=`${role.id}:${persona.id}:${i}`,repeats=[];
  for(let repeat=0;repeat<2;repeat++){
   const results=[...role.modules,role.integration].map(moduleId=>{
    const variants=forms.get(moduleId),form=variants[(i*2+repeat)%variants.length],spec=specFor(moduleId);
    return moduleAttempt(form,spec,persona,`${seedNamespace}:answer:${personId}:${repeat}:${moduleId}`,observations);
   });
   const actual=['Senior','Middle','Junior'].find(grade=>results.every(result=>meetsModuleGrade(result,grade)))||'BelowJunior';
   const outcome=roleGradeOutcome(results,persona.grade==='BelowJunior'?'Junior':persona.grade);
   repeats.push({actual,score:Math.min(...results.map(r=>r.score)),outcome,results:results.map(result=>{const {moduleId,score,scoreExact,theoryScore,codingScore,secondPartRoute,codingEvidence}=result;return {moduleId,score,scoreExact,theoryScore,codingScore,codingScoreExact:result.gradeRequirements.Junior.codingScore,secondPartRoute,codingEvidence};})});
  }
  attempts.push({id:personId,roleId:role.id,spec:role.spec,split:DEVELOPMENT_SPECS.has(role.spec)?'development':'holdout',expected:persona.grade,repeats});
 }
 const summary=rows=>{
  const labelled=rows.flatMap(row=>row.repeats.map(result=>({expected:row.expected,actual:result.actual})));
  const same=rows.filter(row=>row.repeats[0].actual===row.repeats[1].actual).length;
  const metrics=confusionMetrics(labelled,LABELS);
  return {...metrics,people:rows.length,testRetestAgreement:same/rows.length,testRetestInterval:wilson(same,rows.length),
   testRetestKappa:confusionMetrics(rows.map(row=>({expected:row.repeats[0].actual,actual:row.repeats[1].actual})),LABELS).kappa,
   meanAbsoluteScoreDifference:mean(rows.map(row=>Math.abs(row.repeats[0].score-row.repeats[1].score))),
   scoreByGrade:Object.fromEntries(LABELS.map(grade=>[grade,mean(rows.filter(row=>row.expected===grade).flatMap(row=>row.repeats.map(r=>r.score)))]))};
 };
 const byItem=new Map();for(const row of observations){const key=`${row.moduleId}:${row.id}`;if(!byItem.has(key))byItem.set(key,{id:row.id,moduleId:row.moduleId,difficulty:row.difficulty,format:row.format,low:[],high:[]});const item=byItem.get(key);if(['BelowJunior','Junior'].includes(row.grade))item.low.push(Number(row.correct));else item.high.push(Number(row.correct));}
 const discrimination=[...byItem.values()].map(({low,high,...item})=>({...item,lowN:low.length,highN:high.length,lowCorrect:mean(low),highCorrect:mean(high),difference:low.length&&high.length?mean(high)-mean(low):null}));
 const covered=discrimination.filter(row=>row.lowN>=10&&row.highN>=10);
 return {personas,seedNamespace,peoplePerGrade,formsPerModule,policies:[...moduleIds].map(moduleId=>{const spec=specFor(moduleId);return {moduleId,specVersion:spec.version,thresholds:spec.thresholds,scoring:spec.scoring,adaptive:spec.adaptive};}),formHash:hash(JSON.stringify(formManifest)),summary:summary(attempts),
  bySplit:Object.fromEntries(['development','holdout'].map(key=>[key,attempts.some(row=>row.split===key)?summary(attempts.filter(row=>row.split===key)):null])),
  byRole:Object.fromEntries(roles.map(role=>[role.id,summary(attempts.filter(row=>row.roleId===role.id))])),
  discrimination:{items:discrimination.length,coveredItems:covered.length,meanDifference:mean(covered.map(row=>row.difference)),negativeItems:covered.filter(row=>row.difference<0),byDifficulty:Object.fromEntries([1,2,3].map(d=>[d,mean(covered.filter(row=>row.difficulty===d).map(row=>row.difference))]))},
  itemResults:discrimination,attempts,formManifest};
}

export async function runValidation({split='development',peoplePerGrade=100,formsPerModule=20,label='current'}={}){
 const data={version:VERSION,asOf:AS_OF,personas:GRADE_PERSONAS,matching:matchingScenarios()};
 const library=new URL('../../lib/',import.meta.url),sourceFiles=[];
 for(const name of (await readdir(library)).filter(name=>name.endsWith('.mjs')).sort())sourceFiles.push({path:'lib/'+name,sha256:hash(await readFile(new URL(name,library)))});
 return {version:VERSION,label,asOf:AS_OF,split,runtime:process.version,fixtureHash:hash(JSON.stringify(data)),sourceHash:hash(JSON.stringify(sourceFiles)),sourceFiles,
  limitations:['Synthetic rubric and response probabilities are authored hypotheses, not real candidate/expert labels.','Virtual profiles are repeated seeds of four ability prototypes across six roles, not independent expert assessments.','Answer generation uses independent probability tables, not the product Rasch model.','Retests use independent answer draws and different variants; variants can overlap in question families across attempts.','Holdout separates specialization/scenario families and forms; it shares the same authored response model and is not an independent human population.','No source code is executed; coding responses simulate trusted judge snapshots.','Item discrimination here measures the simulator, not empirical question-bank validity.'],
  matching:evaluateMatching(split),grades:await evaluateGrades({split,peoplePerGrade,formsPerModule})};
}
const pct=n=>n===null||n===undefined?'—':`${(100*n).toFixed(1)}%`;
export function validationMarkdown(report){
 const g=report.grades.summary,m=report.matching.summary;
 return `# Синтетическая валидация — ${report.label}\n\nВерсия: ${report.version}; дата: ${report.asOf}; split: ${report.split}.\n\nSHA-256 сценариев: \`${report.fixtureHash}\`.\n\n## Подбор\n\n${report.matching.scenarios} потребностей, ${report.matching.pairs} пар.\n\n| Метрика | Результат |\n|---|---:|\n| P@5 | ${pct(m.precisionAtK)} |\n| P@5 с усреднением ничьих | ${pct(m.tiedPrecisionAt5)} |\n| nDCG@5 (бинарный) | ${pct(m.ndcgAtK)} |\n| nDCG@5 (уровни 0–3) | ${pct(m.gradedNdcgAt5)} |\n| MRR | ${pct(m.reciprocalRank)} |\n| Recall@5 | ${pct(m.recallAtK)} |\n| Правильность обязательных фильтров | ${pct(m.eligibilityAccuracy)} |\n| Совпадение суммы объяснения и балла | ${pct(m.scoreExplanationAccuracy)} |\n\n## Грейды\n\n${g.people} синтетических профилей, ${g.n} полных прохождений ролей.\n\n| Метрика | Результат |\n|---|---:|\n| Совпадение с заданным грейдом | ${pct(g.accuracy)} |\n| Balanced accuracy | ${pct(g.balancedAccuracy)} |\n| Cohen κ с заданным грейдом | ${g.kappa.toFixed(3)} |\n| Test–retest: одинаковый грейд | ${pct(g.testRetestAgreement)} |\n| Cohen κ между повторами | ${g.testRetestKappa.toFixed(3)} |\n| Завышение грейда | ${pct(g.overgraded)} |\n| Занижение грейда | ${pct(g.undergraded)} |\n| Средняя разница баллов повторов | ${g.meanAbsoluteScoreDifference.toFixed(2)} |\n\nМатрица: строки — эталон, столбцы — результат (${g.labels.join(', ')}).\n\n\`\`\`json\n${JSON.stringify(g.matrix,null,2)}\n\`\`\`\n\n## Ограничения\n\nЭто проверка синтетических сценариев и устойчивости правил. Она не доказывает точность грейда реальных людей, реальную сложность вопросов или качество найма. Параметры генератора и метки не подгоняются по результату. Кодовая песочница не проверяется этим экспериментом. Параметры, промежуточные результаты, ID и версии форм сохранены в JSON; ответы воспроизводятся по фиксированным seed.\n`;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
 const split=value('--split','development');if(!['development','holdout','all'].includes(split))throw new Error('Invalid split');
 const output=resolve(value('--output','output/validation/synthetic-current'));
 const report=await runValidation({split,label:value('--label','current'),peoplePerGrade:Number(value('--people','100')),formsPerModule:Number(value('--forms','20'))});
 await mkdir(output,{recursive:true});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(output,'report.md'),validationMarkdown(report));
 console.log(JSON.stringify({output,fixtureHash:report.fixtureHash,matching:report.matching.summary,grades:report.grades.summary,discrimination:report.grades.discrimination},null,2));
}
