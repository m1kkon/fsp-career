import {transaction} from './postgres.mjs';
import {ensureDailyPool,dailyPoolWindow} from './assessments.mjs';

// A process-local timer; the database's insert-only daily key keeps all servers in sync.
export function startDailyPoolScheduler(){
 if(globalThis.__fspDailyPoolScheduler)return;
 globalThis.__fspDailyPoolScheduler=true;
 const refresh=async()=>{
  let retry=false;
  try{await transaction(repo=>ensureDailyPool(repo));}
  catch(error){retry=true;console.error('Daily question pool generation failed:',error.code||error.name);}
  const delay=retry?60000:Math.max(1000,dailyPoolWindow().closesAt-Date.now());
  setTimeout(()=>void refresh(),delay).unref();
 };
 void refresh();
}
