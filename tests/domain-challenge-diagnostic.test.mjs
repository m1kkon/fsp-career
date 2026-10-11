import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {domainChallengeScenarios,VERSION,AS_OF} from '../scripts/benchmarks/fixtures/domain-challenge-v1.mjs';
import {challengeDescriptor,verifyChallengeFixture,verifyChallengeSource,REQUIRED_PRODUCT_FILES} from '../scripts/benchmarks/domain-challenge-diagnostic.mjs';
import {diagnosticMetrics} from '../scripts/benchmarks/domain-stress-diagnostic.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const row=(id,relevance,truthEligibility='pass',score=100-id)=>({id:String(id),relevance,truthEligibility,score,lexical:score,stackCoverage:score,match:{score,strength:0,eligibility:{status:truthEligibility}}});
const git=(root,args)=>{
 const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return result.stdout.trim();
};
async function sourceFixture(t){
 const root=await mkdtemp(join(tmpdir(),'fsp-challenge-provenance-'));
 t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'lib'));
 const files={};
 for(const file of REQUIRED_PRODUCT_FILES){const content=`// Independent test snapshot for ${file}\nexport const marker=1;\n`;await writeFile(join(root,file),content);files[file]=hash(content);}
 git(root,['init','-q']);git(root,['add','lib']);
 git(root,['-c','user.name=Fixture','-c','user.email=fixture@example.test','-c','commit.gpgsign=false','commit','-qm','Test committed source fingerprints']);
 const freeze={productSnapshot:git(root,['rev-parse','HEAD']),files},path=join(root,'source-freeze.json');
 await writeFile(path,JSON.stringify(freeze));return {root,path,freeze};
}

test('fresh challenge preserves frozen 8 needs, 96 profiles, six roles and a new AS_OF without ranking',async()=>{
 const {freeze,fixtures}=await verifyChallengeFixture();
 assert.equal(freeze.evaluated,false);assert.equal(freeze.candidateImplementationFrozen,false);
 assert.equal(fixtures.length,8);assert.equal(fixtures.flatMap(s=>s.candidates).length,96);
 assert.equal(new Set(fixtures.map(s=>s.spec)).size,6);
 assert.deepEqual(challengeDescriptor(),{version:VERSION,asOf:AS_OF,scenarios:8,pairs:96,averaging:'Macro average over the 8 needs; each need has equal weight.'});
 const ids=fixtures.flatMap(s=>s.candidates.map(c=>c.id));assert.equal(new Set(ids).size,96);
 for(const s of fixtures){assert.equal(s.candidates.length,12);assert.deepEqual(s.need.selection.requiredStack,s.candidates[0].candidate.stack);assert.equal(s.need.selection.confirmed,true);for(const c of s.candidates){assert.ok(c.reason.length>20);assert.ok(c.candidate.work.length>50);assert.ok([0,1,2,3].includes(c.relevance));assert.ok(['pass','unknown','fail'].includes(c.eligibility));}}
});

test('tampering with expanded challenge facts is rejected before evaluation',async()=>{
 const fixtures=structuredClone(domainChallengeScenarios());fixtures[0].candidates[0].candidate.work+=' changed';
 await assert.rejects(verifyChallengeFixture({fixtures}),/Frozen challenge fixture changed/);
});

test('tampering with the frozen rubric file is rejected before evaluation',async t=>{
 const root=await mkdtemp(join(tmpdir(),'fsp-challenge-rubric-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const file of ['docs/domain-challenge-freeze.json','docs/domain-challenge-rubric.md','scripts/benchmarks/fixtures/domain-challenge-v1.mjs']){
  await mkdir(resolve(root,file,'..'),{recursive:true});await writeFile(join(root,file),await readFile(new URL('../'+file,import.meta.url)));
 }
 await writeFile(join(root,'docs/domain-challenge-rubric.md'),'Changed rubric');
 await assert.rejects(verifyChallengeFixture({root}),/Frozen challenge file changed: docs\/domain-challenge-rubric.md/);
});

test('no implicit current-product fingerprint is accepted when a source freeze is absent',async()=>{
 await assert.rejects(verifyChallengeSource(),/explicit --source-freeze/);
});

test('explicit source freeze matches both committed bytes and current bytes without running product code',async t=>{
 const {root,path,freeze}=await sourceFixture(t),verified=await verifyChallengeSource({root,sourceFreezePath:path});
 assert.equal(verified.freeze.productSnapshot,freeze.productSnapshot);assert.deepEqual(verified.implementation,freeze.files);
 assert.equal(verified.path,path);assert.match(verified.sha256,/^[a-f0-9]{64}$/);
});

test('implementation fingerprint manifests are accepted but conflicting parallel maps are refused',async t=>{
 const {root,path,freeze}=await sourceFixture(t);freeze.implementation=freeze.files;delete freeze.files;await writeFile(path,JSON.stringify(freeze));
 assert.deepEqual((await verifyChallengeSource({root,sourceFreezePath:path})).implementation,freeze.implementation);
 freeze.files={...freeze.implementation,'lib/ats.mjs':'0'.repeat(64)};await writeFile(path,JSON.stringify(freeze));
 await assert.rejects(verifyChallengeSource({root,sourceFreezePath:path}),/conflicting fingerprint maps/);
});

test('a product edit after source freeze is refused',async t=>{
 const {root,path}=await sourceFixture(t);await writeFile(join(root,'lib/resume-fit.mjs'),'// Changed after freeze');
 await assert.rejects(verifyChallengeSource({root,sourceFreezePath:path}),/Current product differs from source freeze: lib\/resume-fit.mjs/);
});

test('invented snapshot fingerprints and incomplete snapshots are refused',async t=>{
 const {root,path,freeze}=await sourceFixture(t);
 freeze.files['lib/ats.mjs']='0'.repeat(64);await writeFile(path,JSON.stringify(freeze));
 await assert.rejects(verifyChallengeSource({root,sourceFreezePath:path}),/Source freeze differs from its committed snapshot: lib\/ats.mjs/);
 delete freeze.files['lib/matching.mjs'];await writeFile(path,JSON.stringify(freeze));
 await assert.rejects(verifyChallengeSource({root,sourceFreezePath:path}),/missing a product fingerprint: lib\/matching.mjs/);
});

test('a claimed full Git snapshot must actually exist',async t=>{
 const {root,path,freeze}=await sourceFixture(t);freeze.productSnapshot='0'.repeat(40);await writeFile(path,JSON.stringify(freeze));
 await assert.rejects(verifyChallengeSource({root,sourceFreezePath:path}),/Cannot verify committed source snapshot/);
});

test('primary math excludes unknown and failed profiles without discarding their separate text evidence',()=>{
 const m=diagnosticMetrics([row(0,3,'unknown'),row(1,3,'fail'),row(2,3),row(3,2),row(4,1)]);
 assert.equal(m.precisionAtK,.4);assert.equal(m.textOnlyPrecisionAtFive,.8);assert.equal(m.invalidTopFive,2);
 assert.equal(m.recallAtK,1);assert.equal(m.precisionAtFiveCeiling,.4);assert.equal(m.fractionOfAvailableTopFiveRelevant,1);
});

test('known rank has independently calculated reciprocal rank and binary nDCG',()=>{
 const m=diagnosticMetrics([row(0,0),row(1,3),row(2,0),row(3,2),row(4,0),row(5,0)]);
 const expected=(1/Math.log2(3)+1/Math.log2(5))/(1+1/Math.log2(3));
 assert.equal(m.reciprocalRank,.5);assert.ok(Math.abs(m.ndcgAtK-expected)<1e-12);
});

test('graded gain and expected ties cannot be mistaken for binary deterministic precision',()=>{
 const strong=diagnosticMetrics([row(0,3),row(1,2),row(2,0)]),partial=diagnosticMetrics([row(1,2),row(0,3),row(2,0)]);
 assert.equal(strong.precisionAtK,partial.precisionAtK);assert.ok(strong.gradedNdcgAtFive>partial.gradedNdcgAtFive);
 const tied=diagnosticMetrics([row(0,3,'pass',1),...Array.from({length:5},(_,i)=>row(i+1,0,'pass',1))]);
 assert.equal(tied.precisionAtK,.2);assert.ok(Math.abs(tied.tieAdjustedPrecisionAtK-1/6)<1e-12);
});
