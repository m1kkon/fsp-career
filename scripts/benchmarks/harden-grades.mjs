// Reproducible evaluation of the frozen v3 policy; never tunes against holdout.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateGrades,runValidation} from './synthetic-validation.mjs';
import {HARDENING_VERSION,FRESH_SEED,SAFETY_SEED,PERSONAS,SAFETY_PERSONAS,ACCEPTANCE} from './fixtures/synthetic-hardening-v2.mjs';
import {evaluateResumeEvidence} from './resume-evidence-validation.mjs';
const compact=report=>{const {attempts,formManifest,itemResults,...result}=report;void attempts;void formManifest;void itemResults;return result;};
export async function hardenGrades({peoplePerGrade=100,formsPerModule=20}={}){
 const fixed={version:HARDENING_VERSION,FRESH_SEED,SAFETY_SEED,PERSONAS,SAFETY_PERSONAS,ACCEPTANCE,peoplePerGrade,formsPerModule};
 const current=await runValidation({split:'all',peoplePerGrade,formsPerModule,label:HARDENING_VERSION});
 const fresh=await evaluateGrades({split:'all',seedNamespace:FRESH_SEED,personas:PERSONAS,peoplePerGrade,formsPerModule});
 const safety=await evaluateGrades({split:'all',seedNamespace:SAFETY_SEED,personas:SAFETY_PERSONAS,peoplePerGrade,formsPerModule});
 const byPersona=Object.fromEntries(SAFETY_PERSONAS.map(persona=>{const attempts=safety.attempts.filter(row=>row.id.includes(':'+persona.id+':')),results=attempts.flatMap(a=>a.repeats);return [persona.id,{n:results.length,qualified:results.filter(row=>row.actual!=='BelowJunior').length}];}));
 const accept=(summary,limits)=>summary.accuracy>=(limits.accuracyMin||0)&&summary.byGrade.find(g=>g.label==='Middle').recall>=limits.middleRecallMin&&summary.testRetestAgreement>=limits.retestMin&&summary.overgraded<=limits.overgradingMax;
 const checks={development:accept(current.grades.bySplit.development,ACCEPTANCE.development),freshHoldout:accept(fresh.bySplit.holdout,ACCEPTANCE.freshHoldout),theoryOnly:byPersona['theory-only'].qualified===0,codingOnly:byPersona['coding-only'].qualified===0,randomChoice:byPersona['random-choice'].qualified===0};
 return {version:HARDENING_VERSION,fixtureHash:createHash('sha256').update(JSON.stringify(fixed)).digest('hex'),fixed,sourceHash:current.sourceHash,sourceFiles:current.sourceFiles,runtime:current.runtime,checks,
  original:compact(current.grades),matching:current.matching,resumeEvidence:evaluateResumeEvidence(),fresh:compact(fresh),safety:{...compact(safety),byPersona},limitations:current.limitations,
  traces:{original:current.grades,fresh,safety}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
 if(args.includes('--compare')){
  const before=JSON.parse(await readFile(value('--before','output/validation/grade-v2/report.json'),'utf8')),after=JSON.parse(await readFile(value('--after','output/validation/grade-v3/report.json'),'utf8'));
  if(before.fixtureHash!==after.fixtureHash)throw new Error('Frozen dataset must match');
  const clean=({traces,...report})=>{void traces;return report;};
  const path=resolve(value('--output','docs/grade-hardening-results.json'));await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,JSON.stringify({before:clean(before),after:clean(after)},null,2)+'\n');console.log(path);
 }else{
  const report=await hardenGrades(),dir=resolve(value('--output','output/validation/grade-v3'));await mkdir(dir,{recursive:true});await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({fixtureHash:report.fixtureHash,checks:report.checks,original:report.original.summary,fresh:report.fresh.summary,holdout:report.fresh.bySplit.holdout,safety:report.safety.byPersona},null,2));
  if(args.includes('--assert')&&!Object.values(report.checks).every(Boolean))process.exitCode=1;
 }
}
