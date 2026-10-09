import {createHash} from 'node:crypto';
import {candidateResumeSkills,resumeTaskFit} from '../../lib/resume-fit.mjs';
import {RESUME_EVIDENCE_CASES} from './fixtures/resume-evidence-v2.mjs';
export function evaluateResumeEvidence(split='all'){
 const cases=RESUME_EVIDENCE_CASES.filter(row=>split==='all'||row.split===split).map(row=>{
  const candidate={work:row.work},skills=candidateResumeSkills(candidate),api=resumeTaskFit(candidate,{text:'API',team:''}).matched.some(task=>task.id==='api');
  const pass=api===row.api&&JSON.stringify([...skills].sort())===JSON.stringify([...row.skills].sort());
  return {...row,actual:{skills,api},pass};
 });
 return {fixtureHash:createHash('sha256').update(JSON.stringify(RESUME_EVIDENCE_CASES)).digest('hex'),n:cases.length,passed:cases.filter(row=>row.pass).length,cases};
}
