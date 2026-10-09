// Development-only replay of frozen v2 attempts. Routes/answers never change.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {difficultyAdjustedScore} from '../../lib/assessment-scoring.mjs';
import {confusionMetrics} from './validation-metrics.mjs';
const input=resolve(process.argv[2]||'output/validation/grade-v2/report.json');
const report=JSON.parse(await readFile(input,'utf8'));
if(report.original.policies.some(p=>p.scoring.rule!=='rasch-theory-practice-v2'))throw new Error('Replay requires a frozen v2 baseline');
const rows=report.traces.original.attempts.filter(row=>row.split==='development'),labels=['BelowJunior','Junior','Middle','Senior'];
const policies=new Map(report.original.policies.map(policy=>[policy.moduleId,policy]));
const choices=[{id:'linear',anchors:null},{id:'symmetric',anchors:{1:-1,2:0,3:1}},...[.5,1,1.5,2].map(hard=>({id:'challenge-'+hard,anchors:{1:0,2:0,3:hard}}))];
const results=choices.map(choice=>{
 const predictions=rows.map(row=>row.repeats.map(attempt=>labels.slice(1).findLast(grade=>attempt.results.every(module=>{
  const policy=policies.get(module.moduleId),g=policy.scoring.grades[grade],a=policy.adaptive.codingDifficultyCounts;
  if(a.first[2]!==2||a.foundation[1]!==2||a.advanced[3]!==2||Object.values(a.first).reduce((s,n)=>s+n,0)!==2)throw new Error('Replay requires the original two-by-two coding layout');
  const raw=module.codingScoreExact,theory=(module.scoreExact-policy.scoring.codingWeight*raw)/policy.scoring.theoryWeight;
  // Rasch's sufficient statistic is sum(credits): individual credits are not
  // needed here. The separate full-solution gate uses the frozen actual counts.
  const difficulties=module.secondPartRoute==='advanced'?[2,2,3,3]:[2,2,1,1];
  const coding=choice.anchors?difficultyAdjustedScore(difficulties.map(difficulty=>({difficulty,credit:raw/100})),choice.anchors):raw;
  const score=theory*policy.scoring.theoryWeight+coding*policy.scoring.codingWeight;
  return score+1e-9>=policy.thresholds[grade]&&theory+1e-9>=(g.theoryMin||0)&&coding+1e-9>=g.codingMin&&module.codingEvidence.solvedByDifficulty[g.difficultyMin]>=g.solvedMin;
 }))||'BelowJunior'));
 const metrics=confusionMetrics(predictions.flatMap((xs,i)=>xs.map(actual=>({expected:rows[i].expected,actual}))),labels);
 return {...choice,...metrics,testRetestAgreement:predictions.filter(xs=>xs[0]===xs[1]).length/predictions.length};
});
const output=resolve(process.argv[3]||'output/validation/coding-anchor-diagnostic.json');await mkdir(resolve(output,'..'),{recursive:true});
await writeFile(output,JSON.stringify({sourceHash:report.sourceHash,split:'development',thresholdsUnchanged:true,selected:'challenge-2',results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({id:r.id,accuracy:r.accuracy,middleRecall:r.byGrade.find(g=>g.label==='Middle').recall,retest:r.testRetestAgreement,overgrading:r.overgraded})),null,2));
