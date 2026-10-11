import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {matching,selectedNeed,rankCandidates,WEIGHTS} from '../../lib/matching.mjs';
import {mockFspProfile} from '../../lib/fsp.mjs';
import {candidateResumeSkills,resumeDocuments} from '../../lib/resume-fit.mjs';
import {tfidfSimilarity} from '../../lib/ats.mjs';
import {rankingMetrics,meanMetrics,tiedPrecisionAtK} from './ranking-metrics.mjs';
import {gradedNdcg} from './validation-metrics.mjs';
import {domainStressScenarios,VERSION,AS_OF} from './fixtures/domain-stress-v1.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const eligibility={pass:0,unknown:1,fail:2};
const METHODS=['full','tfidf','stack','hard_filters_tfidf','hard_filters_stack'];
const relevant=row=>Number(row.relevance>=2&&row.truthEligibility==='pass');
const text=c=>[c.spec,c.grade,...candidateResumeSkills(c),...resumeDocuments(c).map(d=>d.text)].filter(Boolean).join(' ');
const scoreKey=(row,method)=>method==='full'?`${row.match.eligibility.status}:${row.match.score}:${row.match.strength}:${row.score}`:
 `${method.startsWith('hard_filters_')?row.match.eligibility.status:''}:${method.endsWith('tfidf')?row.lexical:row.stackCoverage}`;

export function diagnosticMetrics(ranked,method='full'){
 const binary=ranked.map(relevant),metrics=rankingMetrics(binary),positives=binary.reduce((sum,label)=>sum+label,0);
 return {...metrics,tieAdjustedPrecisionAtK:tiedPrecisionAtK(ranked.map(row=>({tieKey:scoreKey(row,method),label:relevant(row)}))),
  gradedNdcgAtFive:gradedNdcg(ranked.map(row=>row.truthEligibility==='pass'?row.relevance:0)),
  textOnlyPrecisionAtFive:ranked.slice(0,5).filter(row=>row.relevance>=2).length/Math.min(5,ranked.length),
  precisionAtFiveCeiling:Math.min(5,positives)/Math.min(5,ranked.length),
  fractionOfAvailableTopFiveRelevant:positives?binary.slice(0,5).reduce((sum,label)=>sum+label,0)/Math.min(5,positives):null,
  invalidTopFive:ranked.slice(0,5).filter(row=>row.truthEligibility!=='pass').length};
}

export async function verifyFrozenDiagnostic(){
 const freeze=JSON.parse(await readFile(new URL('../../docs/domain-stress-freeze.json',import.meta.url))),fixtures=domainStressScenarios();
 if(freeze.version!==VERSION||freeze.expandedFixtureSha256!==hash(JSON.stringify(fixtures)))throw new Error('Frozen stress fixture changed');
 for(const [file,expected]of Object.entries(freeze.files))if(hash(await readFile(new URL('../../'+file,import.meta.url)))!==expected)throw new Error(`Frozen file changed: ${file}`);
 const core=['lib/matching.mjs','lib/resume-fit.mjs','lib/ats.mjs','lib/domain.mjs','lib/fsp.mjs','lib/technology-catalog.mjs','lib/salary-range.mjs'];
 const implementation={};
 for(const file of core){
  const result=spawnSync('git',['show',`${freeze.productSnapshot}:${file}`],{cwd:fileURLToPath(new URL('../../',import.meta.url))});
  if(result.status!==0)throw new Error(`Cannot verify product snapshot: ${file}`);
  const actual=hash(await readFile(new URL('../../'+file,import.meta.url)));
  if(actual!==hash(result.stdout))throw new Error(`Product changed from the frozen snapshot: ${file}`);
  implementation[file]=actual;
 }
 return {freeze,implementation,fixtures};
}

export function evaluateStressDiagnostic(fixtures=domainStressScenarios(),{asOf=AS_OF,version=VERSION}={}){
 const cases=fixtures.map(scenario=>{
  const need=selectedNeed(scenario.need.text,scenario.need.selection);
  const texts=scenario.candidates.map(row=>text(row.candidate)),query=[need.text,need.team,...need.stack].filter(Boolean).join(' ');
  const rows=scenario.candidates.map((row,index)=>{
   const candidate={...row.candidate,fsp:row.candidate.fspId?mockFspProfile(row.candidate.fspId):null},skills=new Set(candidateResumeSkills(candidate));
   return {...candidate,relevance:row.relevance,truthEligibility:row.eligibility,
    match:matching(candidate,need,Date.parse(asOf),texts),lexical:tfidfSimilarity(query,texts[index],texts).score,
    stackCoverage:need.stack.length?need.stack.filter(skill=>skills.has(skill)).length/need.stack.length:0};
  });
  const order=method=>method==='full'?rankCandidates(rows,need):[...rows].sort((a,b)=>(method.startsWith('hard_filters_')?eligibility[a.match.eligibility.status]-eligibility[b.match.eligibility.status]:0)
   ||(method.endsWith('tfidf')?b.lexical-a.lexical:b.stackCoverage-a.stackCoverage)||a.id.localeCompare(b.id));
  const full=order('full'),top=full.slice(0,5),metrics=Object.fromEntries(METHODS.map(method=>[method,diagnosticMetrics(order(method),method)]));
  return {id:scenario.id,spec:scenario.spec,pairs:rows.length,relevantEligible:rows.filter(relevant).length,metrics,
   eligibilityCorrect:rows.filter(row=>row.truthEligibility===row.match.eligibility.status).length,
   explanationsCorrect:rows.filter(row=>row.match.score===row.match.parts.reduce((sum,part)=>sum+part.points,0)).length,
   topFive:top.map(row=>({id:row.id,professionalRelevance:row.relevance,truthEligibility:row.truthEligibility,productEligibility:row.match.eligibility.status,score:row.match.score,parts:Object.fromEntries(row.match.parts.map(p=>[p.key,p.points]))})),
   missedRelevant:rows.filter(row=>relevant(row)&&!top.some(item=>item.id===row.id)).map(row=>row.id),
   nonRelevantTopFive:top.filter(row=>!relevant(row)).map(row=>row.id),
   eligibilityErrors:rows.filter(row=>row.truthEligibility!==row.match.eligibility.status).map(row=>({id:row.id,expected:row.truthEligibility,actual:row.match.eligibility.status,checks:row.match.eligibility.checks}))};
 });
 const summarize=rows=>Object.fromEntries(METHODS.map(method=>[method,meanMetrics(rows.map(row=>row.metrics[method]))]));
 return {version,asOf,weights:WEIGHTS,dataset:{scenarios:cases.length,pairs:cases.reduce((sum,row)=>sum+row.pairs,0),type:'new authored difficult diagnostic; not independently collected users or external holdout'},
  metricDefinitions:{primary:'Binary relevant iff authored professional relevance>=2 and authored eligibility=pass. P@5, Recall@5, binary nDCG@5 and full-pool MRR use this label.',
   gradedNdcgAtFive:'Linear graded gains 0–3, with unknown/fail eligibility set to zero; ideal order is computed over the same pool.',
   textOnlyPrecisionAtFive:'Professional relevance>=2 without eligibility; separate diagnostic, not the primary ranking metric.',
   precisionAtFiveCeiling:'Maximum possible P@5 in each pool given its relevant eligible count; fewer than five positives lowers the ceiling.',
   fractionOfAvailableTopFiveRelevant:'Hits in top five divided by min(5,relevant eligible count). This is not market accuracy.',
   ties:'Expected binary P@5 under random ID order within identical actual non-ID sorting signals.',
   averaging:`Macro average over the ${cases.length} needs. Baselines have the same complete professional text/technologies; filtered baselines use product eligibility, never authored truth.`},
  summary:summarize(cases),bySpecialization:Object.fromEntries([...new Set(cases.map(row=>row.spec))].map(spec=>[spec,summarize(cases.filter(row=>row.spec===spec))])),
  checks:{eligibilityCorrect:cases.reduce((sum,row)=>sum+row.eligibilityCorrect,0),explanationsCorrect:cases.reduce((sum,row)=>sum+row.explanationsCorrect,0),pairs:cases.reduce((sum,row)=>sum+row.pairs,0)},cases,
  limitations:[
   'Authored labels are independent of the scoring formula but are not human participant/external expert ground truth. Ambiguous labels must be identified in the independent review.',
   'The fixture and rubric were committed before any ranking evaluation. No labels, algorithm or weights were changed after observing this diagnostic.',
   'This deliberately challenging authored sample is not a prevalence estimate of real market profiles, a training target, a 90-point objective, or a new external holdout.',
   'Primary eligibility truth explicitly treats unspecified skills, contradictory experience and relocation without current city as described in the frozen rubric; disagreements may be policy mismatches rather than algorithmic ranking faults.',
   'Five returned profiles can include non-relevant people when fewer than five relevant eligible people exist. Ceiling and Recall@5 prevent hiding that denominator.',
   'Live employer need-to-selection and end-to-end testing with jury/users remain separate criterion 6.1 evidence.'
  ]};
}

async function main(){
 const {freeze,implementation,fixtures}=await verifyFrozenDiagnostic();
 const reviewFile='docs/domain-stress-independent-label-review.json',reviewBytes=await readFile(new URL('../../'+reviewFile,import.meta.url)),review=JSON.parse(reviewBytes);
 if(!review.reviewedBeforeEvaluation||review.algorithmCalled||review.metricsRead||review.expandedFixtureSha256!==freeze.expandedFixtureSha256)throw new Error('A pre-evaluation review of the frozen labels is required');
 const report=evaluateStressDiagnostic(fixtures);
 report.freezeCommit='e9086835f4263929163b51f9fc237c78d03aea42';report.freeze=freeze;report.implementation=implementation;
 report.independentLabelReview={file:reviewFile,commit:'aa589ec9af6555516cfe3d550f52d4230baa0edf',sha256:hash(reviewBytes),summary:review.summary,authorLabelsVisible:review.authorLabelsVisible,externalHumanReview:false};
 const ambiguous=review.rows.filter(row=>row.reviewer.plausibleEligibilityLabels.length>1).map(row=>row.id);
 const clearErrors=report.cases.flatMap(row=>row.eligibilityErrors).filter(row=>!ambiguous.includes(row.id));
 report.checks.preEvaluationAmbiguousEligibilityIds=ambiguous;
 report.checks.clearEligibilityPairs=report.checks.pairs-ambiguous.length;
 report.checks.clearEligibilityCorrect=report.checks.clearEligibilityPairs-clearErrors.length;
 report.limitations.push('Pre-evaluation agent review saw the authored labels: 95/120 exact professional agreements, 105/120 within the plausible range, and one eligibility ambiguity. It is not blind adjudication or external expert validation. The ambiguity is retained in raw results, with a separate explicitly non-ambiguous eligibility count.');
 const output=resolve(process.argv[2]||'docs/domain-stress-diagnostic.json');
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,dataset:report.dataset,summary:report.summary,checks:report.checks},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
