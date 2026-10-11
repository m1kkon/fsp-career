import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {matching,selectedNeed,rankCandidates,WEIGHTS} from '../../lib/matching.mjs';
import {mockFspProfile} from '../../lib/fsp.mjs';
import {candidateResumeSkills,resumeDocuments} from '../../lib/resume-fit.mjs';
import {tfidfSimilarity} from '../../lib/ats.mjs';
import {rankingMetrics,meanMetrics,tiedPrecisionAtK} from './ranking-metrics.mjs';
import {VERSION,AS_OF,matchingScenarios} from './fixtures/synthetic-v1.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const statusOrder={pass:0,unknown:1,fail:2};
const METHODS=['full','tfidf','stack','hard_filters_tfidf','hard_filters_stack','hard_filters_only','without_fsp','without_test','without_resume'];
const percentRelevant=row=>Number(row.label>=2);
// Give lexical baselines the same professional text, including projects, and
// all explicitly selected technologies. Personal/contact fields are excluded.
const professionalText=candidate=>[candidate.spec,candidate.grade,...candidateResumeSkills(candidate),...resumeDocuments(candidate).map(d=>d.text)].filter(Boolean).join(' ');

function ablated(row,key){
 const match={...row.match,parts:row.match.parts.map(part=>part.key===key?{...part,points:0}:part)};
 match.score=match.parts.reduce((sum,part)=>sum+part.points,0);
 if(['test','fsp'].includes(key))match.strength=match.parts.filter(part=>['test','fsp'].includes(part.key)).reduce((sum,part)=>sum+part.points,0);
 return {...row,score:key==='test'?0:row.score,match};
}

function order(rows,need,method){
 if(method==='full')return rankCandidates(rows,need);
 if(method.startsWith('without_'))return rankCandidates(rows.map(row=>ablated(row,method.slice(8))),need);
 const hard=method.startsWith('hard_filters_');
 const value=row=>method.endsWith('tfidf')?row.lexical:method.endsWith('stack')?row.stackCoverage:0;
 return [...rows].sort((a,b)=>(hard?statusOrder[a.match.eligibility.status]-statusOrder[b.match.eligibility.status]:0)||value(b)-value(a)||a.id.localeCompare(b.id));
}

function tieKey(row,method){
 if(method==='full'||method.startsWith('without_'))return `${row.match.eligibility.status}:${row.match.score}:${row.match.strength}:${row.score}`;
 const score=method.endsWith('tfidf')?row.lexical:method.endsWith('stack')?row.stackCoverage:0;
 return `${method.startsWith('hard_filters_')?row.match.eligibility.status:''}:${score}`;
}

export function evaluateDomainMatching(){
 const fixtures=matchingScenarios();
 const cases=fixtures.map(scenario=>{
  const need=selectedNeed(scenario.need.text,scenario.need.selection);
  const candidates=scenario.candidates.map(row=>({...row,candidate:{...row.candidate,fsp:row.candidate.fspId?mockFspProfile(row.candidate.fspId):null}}));
  const texts=candidates.map(row=>professionalText(row.candidate));
  const query=[need.text,need.team,...need.stack].filter(Boolean).join(' ');
  const rows=candidates.map((row,index)=>{
   const candidate=row.candidate,skills=new Set(candidateResumeSkills(candidate));
   return {...candidate,label:row.label,expectedEligibility:row.expectedEligibility,
    match:matching(candidate,need,Date.parse(AS_OF),texts),
    lexical:tfidfSimilarity(query,texts[index],texts).score,
    stackCoverage:need.stack.length?need.stack.filter(skill=>skills.has(skill)).length/need.stack.length:0};
  });
  const methods=Object.fromEntries(METHODS.map(method=>{
   const ranked=order(rows,need,method),labels=ranked.map(percentRelevant);
   return [method,{...rankingMetrics(labels),tieAdjustedPrecisionAtK:tiedPrecisionAtK(ranked.map(row=>({tieKey:tieKey(row,method),label:percentRelevant(row)}))),
    invalidTopFive:ranked.slice(0,5).filter(row=>row.expectedEligibility!=='pass').length}];
  }));
  const full=order(rows,need,'full');
  return {id:scenario.id,spec:scenario.spec,language:scenario.id.split('-').at(-1),split:scenario.split,pairs:rows.length,methods,
   checks:{eligibilityCorrect:rows.filter(row=>row.match.eligibility.status===row.expectedEligibility).length,
    explanationCorrect:rows.filter(row=>row.match.score===row.match.parts.reduce((sum,p)=>sum+p.points,0)).length,
    noHistoryRelevantEligible:rows.filter(row=>row.id.endsWith('-no-fsp')&&row.match.eligibility.status==='pass').length,
    noHistoryRelevantTopFive:full.slice(0,5).filter(row=>row.id.endsWith('-no-fsp')).length,
    fspBonusOutsideCategory:rows.filter(row=>row.expectedEligibility!=='pass'&&full.slice(0,5).some(top=>top.id===row.id)&&row.fsp).length}};
 });
 const summarize=rows=>Object.fromEntries(METHODS.map(method=>[method,meanMetrics(rows.map(row=>row.methods[method]))]));
 const totals=key=>cases.reduce((sum,row)=>sum+row.checks[key],0);
 return {version:1,fixtureVersion:VERSION,fixtureHash:hash(JSON.stringify(fixtures)),asOf:AS_OF,weights:WEIGHTS,
  dataset:{scenarios:cases.length,pairs:cases.reduce((sum,row)=>sum+row.pairs,0),specializations:[...new Set(cases.map(row=>row.spec))],type:'controlled authored synthetic cases; existing frozen fixture, not newly collected data'},
  methodDefinitions:{full:'Current complete product ranking: eligibility, explained score, confirmed test/FSP strength, deterministic ID ties.',
   tfidf:'TF-IDF cosine over all professional text, including projects; no category or mandatory filters.',
   stack:'Canonical technology coverage; no category or mandatory filters.',
   hard_filters_tfidf:'Same eligibility statuses as the product, then the TF-IDF baseline. No test/FSP bonus.',
   hard_filters_stack:'Same eligibility statuses as the product, then technology coverage. No test/FSP bonus.',
   hard_filters_only:'Same eligibility statuses only; equal scores use deterministic IDs. Tie P@5 reports expected random order within eligibility.',
   without_fsp:'Offline ablation: zero only the FSP component and its strength tie-break. No weight redistribution.',
   without_test:'Offline ablation: zero only test points, test strength and raw-score tie-break. Confirmed category remains unchanged.',
   without_resume:'Offline ablation: zero only professional task/technology evidence points. No weight redistribution.'},
  relevance:'A candidate is relevant when authored label >=2. Labels come from the frozen scenario rubric, not product predictions. IDs are synthetic.',
  summary:summarize(cases),bySplit:Object.fromEntries(['development','holdout'].map(split=>[split,summarize(cases.filter(row=>row.split===split))])),
  byLanguage:Object.fromEntries(['ru','en'].map(language=>[language,summarize(cases.filter(row=>row.language===language))])),
  bySpecialization:Object.fromEntries([...new Set(cases.map(row=>row.spec))].map(spec=>[spec,summarize(cases.filter(row=>row.spec===spec))])),
  invariants:{pairs:cases.reduce((sum,row)=>sum+row.pairs,0),eligibilityCorrect:totals('eligibilityCorrect'),explanationCorrect:totals('explanationCorrect'),
   noHistoryRelevantEligible:totals('noHistoryRelevantEligible'),noHistoryRelevantTopFive:totals('noHistoryRelevantTopFive'),fspBonusOutsideCategory:totals('fspBonusOutsideCategory')},
  limitations:[
   'The same 24 authored scenarios and 480 pairs were used in earlier development. This measures controlled behavior, not generalization to unseen people.',
   'Scenario labels deliberately encode the intended product rubric. High synthetic precision does not imply market hiring precision.',
   'Reported values are macro averages by scenario. Random expected P@5 appears in each method result; it is not an executed random user trial.',
   'Both unfiltered and equally filtered text/stack baselines are shown, separating eligibility gains from ordering gains.',
   'Ablations remove only one signal in an offline copy. The product algorithm, weights, fixtures and grades are not changed or fitted.',
   'Removing FSP or test may not change binary top-five precision in a fixture with many equally relevant candidates. This does not establish that the signal has no real value.',
   'The synthetic split is a historical fixture partition, not a newly sealed or independent holdout.',
   'Criterion 6.1 also requires a real employer need-to-selection scenario and end-to-end testing with jury/users; this offline report does not replace them.'
  ]};
}

async function main(){
 const report=evaluateDomainMatching();
 const files=['lib/matching.mjs','lib/resume-fit.mjs','lib/ats.mjs','lib/domain.mjs','lib/fsp.mjs','lib/technology-catalog.mjs','scripts/benchmarks/fixtures/synthetic-v1.mjs','scripts/benchmarks/ranking-metrics.mjs','scripts/benchmarks/domain-matching-comparison.mjs'];
 report.productSnapshot=spawnSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'}).stdout.trim();
 report.legacyEligibilityPolicy='The frozen v1 rubric labels unreported required skills as fail. The current product asks for clarification (unknown). The 24 legacy labels are retained; label agreement is reported without relabelling them.';
 report.implementation=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(new URL('../../'+file,import.meta.url)))])));
 const output=resolve(process.argv[2]||'docs/domain-matching-comparison.json');
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,dataset:report.dataset,summary:report.summary,invariants:report.invariants},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
