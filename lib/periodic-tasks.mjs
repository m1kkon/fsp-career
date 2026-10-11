import {createHash} from 'node:crypto';

export const PRACTICE_INTERVAL=7*86400000;
export function periodicTaskSuggestion(tasks,submissions,account,at=Date.now()){
 const completed=new Set(submissions.filter(s=>s.owner===account.id).map(s=>s.taskId));
 const available=tasks.filter(t=>t.status==='published'&&t.spec===account.profile.spec&&!completed.has(t.id)).sort((a,b)=>a.id.localeCompare(b.id));
 if(!available.length)return null;
 const period=Math.floor(at/PRACTICE_INTERVAL),offset=createHash('sha256').update(account.id).digest().readUInt32BE();
 const task=available[(period+offset)%available.length];
 return {taskId:task.id,title:task.title,company:task.company,spec:task.spec,opensAt:period*PRACTICE_INTERVAL,nextAt:(period+1)*PRACTICE_INTERVAL};
}
