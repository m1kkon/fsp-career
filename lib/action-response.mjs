import {action,getState} from './service.mjs';

const ACCOUNT_ACTIONS=new Set(['onboard','profile','resume-details','settings','company','fsp-link','fsp-unlink']);

// Return the committed account in the write response. Profile forms do not need
// to load every list in the workspace before acknowledging a successful save.
export async function actionResponse(repo,account,body,execution={}){
 const result=await action(repo,account,body,execution);
 if(body.returnState!==true)return result;
 if(ACCOUNT_ACTIONS.has(body.action))return {...result,state:{
  user:{id:account.id,email:account.email,name:account.profile.name},
  roles:account.roles,profile:account.profile,privacy:account.privacy,company:account.company
 }};
 try{return {...result,state:await getState(repo,account,body.stateRole==='employer'?'employer':'candidate',typeof body.stateQuery==='string'?body.stateQuery.slice(0,2000):'',body.stateSelection&&typeof body.stateSelection==='object'&&!Array.isArray(body.stateSelection)?body.stateSelection:{})};}
 catch{return {...result,refreshRequired:true};}
}
