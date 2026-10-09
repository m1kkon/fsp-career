import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const [beforePath,afterPath,outputPath]=process.argv.slice(2);
if(!beforePath||!afterPath||!outputPath)throw new Error('Usage: compare-validation.mjs before.json after.json output.json');
const before=JSON.parse(await readFile(resolve(beforePath),'utf8')),after=JSON.parse(await readFile(resolve(afterPath),'utf8'));
if(before.fixtureHash!==after.fixtureHash||before.split!==after.split||before.grades.summary.n!==after.grades.summary.n||before.matching.pairs!==after.matching.pairs)throw new Error('Compare the same frozen dataset, split and cohort size');
const compact=report=>{
 const {attempts,formManifest,itemResults,...grades}=report.grades;
 // These large reproducible traces remain in output/validation, not Git.
 void attempts;void formManifest;void itemResults;
 return {...report,grades};
};
const result={version:1,baselineCommit:'f4e6a1e7e56602ffec1cac1233fad3d758d9d8f0',fixtureHash:after.fixtureHash,before:compact(before),after:compact(after)};
const output=resolve(outputPath);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(output);
