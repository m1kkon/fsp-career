import {MODULES,ROLES} from './question-bank.mjs';

// Choose the newest result before applying visibility: a hidden latest result
// must not silently be replaced with an older score for employers.
export function latestAssessmentResults(history){
 const latest=new Map();
 const keep=r=>{const key=r.kind+':'+r.id,old=latest.get(key);if(!old||r.completedAt>old.completedAt||(r.completedAt===old.completedAt&&r.created>old.created))latest.set(key,r);};
 for(const h of history){
  if(h.hiddenFromHistory||h.status==='active'||h.resultsAvailable===false)continue;
  for(const r of h.results||[]){const skill=MODULES.find(m=>m.id===r.moduleId);if(skill&&!skill.integration&&Number.isFinite(r.score))keep({id:skill.id,name:skill.name,kind:'skill',score:r.score,level:r.level,attemptId:h.id,completedAt:r.completedAt||h.created,created:h.created,hidden:!!h.employerHiddenResults?.['skill:'+skill.id]});}
  if(h.targetKind==='role'&&h.status==='finished'&&h.roleResult?.completed&&h.results?.length&&h.results.every(r=>Number.isFinite(r.score))){const role=ROLES.find(r=>r.id===h.targetId);if(role)keep({id:role.id,name:role.name,kind:'role',score:Math.min(...h.results.map(r=>r.score)),level:h.roleResult.level,attemptId:h.id,completedAt:Math.max(...h.results.map(r=>r.completedAt||h.created)),created:h.created,hidden:!!h.employerHiddenResults?.['role:'+role.id]});}
 }
 return [...MODULES.filter(m=>!m.integration).map(m=>latest.get('skill:'+m.id)),...ROLES.map(r=>latest.get('role:'+r.id))].filter(Boolean);
}
