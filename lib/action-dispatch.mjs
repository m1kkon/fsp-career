import {transaction} from './postgres.mjs';
import {actionResponse} from './action-response.mjs';
import {assessmentAction} from './assessments.mjs';
import {assessmentAccount} from './test-maintainer.mjs';
import {runCode,runCodeInput} from './code-runner.mjs';

// Keep external execution outside a database transaction. Only preparation
// and the optimistic result commit hold the shared document-write lock.
export async function executeAccountAction(userId,requestBody,options={}){
 const body=structuredClone(requestBody),write=options.write||((fn)=>transaction(fn,options.pool));
 const coding=['assessment-run-code','assessment-submit-code'].includes(body.action);
 const prepared=await write(async repo=>{
  const account=assessmentAccount(await repo.account(userId));
  return coding?assessmentAction(repo,account,body,{prepareOnly:true}):actionResponse(repo,account,body);
 });
 if(!coding||!prepared.preparedCode)return prepared;
 const snapshot=prepared.preparedCode;
 if(body.action==='assessment-run-code')return {run:await (options.runInput||runCodeInput)(snapshot.question,body.source,snapshot.stdin)};
 const checked=await (options.judge||runCode)(snapshot.question,body.source);
 return write(async repo=>actionResponse(repo,assessmentAccount(await repo.account(userId)),body,{checked,prepared:snapshot}));
}
