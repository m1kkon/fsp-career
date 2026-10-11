import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname,relative,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateStressDiagnostic} from './domain-stress-diagnostic.mjs';
import {domainChallengeScenarios,VERSION,AS_OF} from './fixtures/domain-challenge-v1.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const sha256=value=>createHash('sha256').update(value).digest('hex');
export const CHALLENGE_FREEZE_COMMIT='4d550e4';
export const REQUIRED_PRODUCT_FILES=Object.freeze(['lib/matching.mjs','lib/resume-fit.mjs','lib/ats.mjs','lib/domain.mjs','lib/fsp.mjs','lib/technology-catalog.mjs','lib/salary-range.mjs']);

export function challengeDescriptor(fixtures=domainChallengeScenarios()){
 return {version:VERSION,asOf:AS_OF,scenarios:fixtures.length,pairs:fixtures.reduce((sum,s)=>sum+s.candidates.length,0),
  averaging:`Macro average over the ${fixtures.length} needs; each need has equal weight.`};
}

export async function verifyChallengeFixture({root=ROOT,fixtures=domainChallengeScenarios()}={}){
 const freeze=JSON.parse(await readFile(resolve(root,'docs/domain-challenge-freeze.json'),'utf8'));
 const descriptor=challengeDescriptor(fixtures);
 if(freeze.version!==VERSION||freeze.asOf!==AS_OF||freeze.expandedFixtureSha256!==sha256(JSON.stringify(fixtures)))throw new Error('Frozen challenge fixture changed');
 if(freeze.scenarioCount!==descriptor.scenarios||freeze.profileCount!==descriptor.pairs||freeze.specializationCount!==new Set(fixtures.map(s=>s.spec)).size)throw new Error('Frozen challenge shape changed');
 if(freeze.evaluated!==false||freeze.labelsAuthoredBeforeEvaluation!==true||freeze.externalHoldout!==false)throw new Error('Challenge must have a pre-evaluation authored freeze');
 for(const file of ['scripts/benchmarks/fixtures/domain-challenge-v1.mjs','docs/domain-challenge-rubric.md']){
  if(!/^[a-f0-9]{64}$/.test(freeze.files?.[file]||''))throw new Error(`Missing frozen challenge file: ${file}`);
  if(sha256(await readFile(resolve(root,file)))!==freeze.files[file])throw new Error(`Frozen challenge file changed: ${file}`);
 }
 return {freeze,fixtures};
}

// The caller must supply the FINAL committed source snapshot. No current-code
// hash or placeholder is automatically accepted as a candidate freeze.
// JSON schema: {productSnapshot: '<full Git SHA>', files: {'lib/...mjs': '<sha256>'}}.
// The equivalent field name `implementation` is accepted for existing manifests.
export async function verifyChallengeSource({sourceFreezePath,root=ROOT}={}){
 if(!sourceFreezePath)throw new Error('An explicit --source-freeze JSON path is required before challenge evaluation');
 const bytes=await readFile(resolve(sourceFreezePath)),freeze=JSON.parse(bytes);
 if(!/^[a-f0-9]{40}$/.test(freeze.productSnapshot||''))throw new Error('Source freeze requires a full committed productSnapshot SHA');
 const fingerprints=freeze.files||freeze.implementation;
 if(!fingerprints||typeof fingerprints!=='object'||Array.isArray(fingerprints))throw new Error('Source freeze requires file fingerprints');
 if(freeze.files&&freeze.implementation&&JSON.stringify(Object.entries(freeze.files).sort())!==JSON.stringify(Object.entries(freeze.implementation).sort()))throw new Error('Source freeze contains conflicting fingerprint maps');
 for(const file of REQUIRED_PRODUCT_FILES)if(!/^[a-f0-9]{64}$/.test(fingerprints[file]||''))throw new Error(`Source freeze is missing a product fingerprint: ${file}`);
 const implementation={};
 for(const [file,expected] of Object.entries(fingerprints)){
  if(!/^lib\/[a-z0-9-]+\.mjs$/.test(file)||!/^[a-f0-9]{64}$/.test(expected))throw new Error(`Invalid source fingerprint entry: ${file}`);
  const committed=spawnSync('git',['show',`${freeze.productSnapshot}:${file}`],{cwd:root});
  if(committed.status!==0)throw new Error(`Cannot verify committed source snapshot: ${file}`);
  if(sha256(committed.stdout)!==expected)throw new Error(`Source freeze differs from its committed snapshot: ${file}`);
  const actual=sha256(await readFile(resolve(root,file)));
  if(actual!==expected)throw new Error(`Current product differs from source freeze: ${file}`);
  implementation[file]=actual;
 }
 return {freeze,implementation,path:resolve(sourceFreezePath),sha256:sha256(bytes)};
}

export async function runChallengeDiagnostic({sourceFreezePath,output='docs/domain-challenge-validation.json',root=ROOT}={}){
 const {freeze,fixtures}=await verifyChallengeFixture({root});
 const source=await verifyChallengeSource({sourceFreezePath,root});
 // Both dataset and final product provenance are checked BEFORE any ranking.
 const report=evaluateStressDiagnostic(fixtures,{asOf:AS_OF,version:VERSION});
 report.freezeCommit=CHALLENGE_FREEZE_COMMIT;report.freeze=freeze;
 report.productSnapshot=source.freeze.productSnapshot;report.implementation=source.implementation;
 const sourceReference=relative(root,source.path);
 report.sourceFreeze={file:sourceReference.startsWith('..')?basename(source.path):sourceReference,sha256:source.sha256,snapshot:source.freeze};
 report.dataset.type='Fresh authored semantic transfer challenge; not external holdout or real-user qualification ground truth';
 report.limitations=report.limitations.filter(line=>!line.startsWith('Primary eligibility truth explicitly treats')&&!line.startsWith('The fixture and rubric were committed'));
 report.limitations.push('The earlier 120-pair stress diagnostic was used as development evidence. This distinct 96-pair challenge was frozen before its first evaluation and is not a new market/user dataset.');
 report.limitations.push('The fresh challenge uses explicit mandatory facts and separately authored professional labels. Its six-year experience field denotes general professional experience, not an inferred commercial history for a particular language.');
 report.limitations.push('Matching changes must be selected without reading this challenge and committed before this evaluation. This report is not a training target, a jury score, or evidence of market-wide matching accuracy.');
 const path=resolve(output);await mkdir(dirname(path),{recursive:true});
 await writeFile(path,JSON.stringify(report,null,2)+'\n');
 return {path,report};
}

async function main(){
 const args=process.argv.slice(2),readFlag=flag=>{
  const i=args.indexOf(flag);if(i<0)return undefined;
  if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing value for ${flag}`);
  return args[i+1];
 };
 for(let i=0;i<args.length;i+=2)if(!['--source-freeze','--output'].includes(args[i]))throw new Error(`Unknown argument: ${args[i]}`);
 const {path,report}=await runChallengeDiagnostic({sourceFreezePath:readFlag('--source-freeze'),output:readFlag('--output')});
 console.log(JSON.stringify({output:path,productSnapshot:report.productSnapshot,dataset:report.dataset,summary:report.summary,checks:report.checks},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
