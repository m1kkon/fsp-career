// Provisional MVP model. Difficulty anchors and grade criteria need empirical calibration.
export const LEGACY_EVIDENCE_SCORING_RULE='rasch-theory-practice-v1';
export const LINEAR_CODING_SCORING_RULE='rasch-theory-practice-v2';
export const SCORING_RULE='rasch-theory-practice-v3';
export const isEvidenceScoringRule=rule=>[LEGACY_EVIDENCE_SCORING_RULE,LINEAR_CODING_SCORING_RULE,SCORING_RULE].includes(rule);
export const DEFAULT_THRESHOLDS={Junior:40,Middle:60,Senior:85};
export const DEFAULT_SCORING={
 rule:SCORING_RULE,calibration:'synthetic-v2-provisional',routingCodingSolvedMin:1,
 // Foundation/intermediate tasks retain the completion reference. Hard tasks
 // use a provisional difficulty adjustment, with separate full-solution gates.
 codingScoreModel:'difficulty-adjusted-v1',codingDifficultyAnchors:{1:0,2:0,3:2},
 difficultyAnchors:{1:-1,2:0,3:1},theoryWeight:0.6,codingWeight:0.4,
 grades:{
  Junior:{theoryMin:35,codingMin:30,plusCodingMin:60,difficultyMin:1,solvedMin:1,plusSolvedMin:1},
  Middle:{theoryMin:55,codingMin:50,plusCodingMin:80,difficultyMin:2,solvedMin:1,plusSolvedMin:1},
  Senior:{theoryMin:75,codingMin:75,plusCodingMin:90,difficultyMin:3,solvedMin:1,plusSolvedMin:1},
 }
};
const logistic=x=>1/(1+Math.exp(-x));
export function answerCredit(q,value,isCorrect){
 if(q.format!=='coding')return isCorrect(q,value)?1:0;
 if(value?.judged!==true)return 0;
 if(value.passed===undefined&&value.total===undefined)return isCorrect(q,value)?1:0; // older trusted judge snapshots
 if(!Number.isInteger(value.total)||value.total<=0||value.total!==q.coding?.tests?.length||!Number.isInteger(value.passed)||value.passed<0||value.passed>value.total)return 0;
 return value.passed/value.total;
}
/** 1PL/Rasch estimate on a common anchor scale; the selected route is not an input. */
export function difficultyAdjustedScore(items,anchors){
 if(!items.length)return 0;
 const earned=items.reduce((s,x)=>s+x.credit,0);
 if(earned<=0)return 0;if(earned>=items.length)return 100;
 let low=-30,high=30;
 for(let i=0;i<80;i++){
  const theta=(low+high)/2,expected=items.reduce((s,x)=>s+logistic(theta-anchors[x.difficulty]),0);
  if(expected<earned)low=theta;else high=theta;
 }
 return 100*logistic((low+high)/2);
}
const display=n=>Math.round(n*10)/10;
export function evidenceScore(m,isCorrect){
 const policy=m.spec.scoring,scored=m.questions.filter(q=>q.scored);
 const theory=scored.filter(q=>q.format!=='coding'),coding=scored.filter(q=>q.format==='coding');
 const theoryExact=difficultyAdjustedScore(theory.map(q=>({difficulty:q.difficulty,credit:answerCredit(q,m.answers[q.id]?.value,isCorrect)})),policy.difficultyAnchors);
 const codingCredits=coding.map(q=>({q,credit:answerCredit(q,m.answers[q.id]?.value,isCorrect)}));
 const codingCompletionExact=coding.length?100*codingCredits.reduce((s,x)=>s+x.credit,0)/coding.length:0;
 const adjustedCoding=policy.rule===SCORING_RULE&&policy.codingScoreModel==='difficulty-adjusted-v1';
 const codingExact=adjustedCoding?difficultyAdjustedScore(codingCredits.map(x=>({difficulty:x.q.difficulty,credit:x.credit})),policy.codingDifficultyAnchors):codingCompletionExact;
 const scoreExact=theoryExact*policy.theoryWeight+codingExact*policy.codingWeight;
 const solvedByDifficulty=Object.fromEntries([1,2,3].map(d=>[d,codingCredits.filter(x=>x.q.difficulty>=d&&x.credit===1).length]));
 const requirements=Object.fromEntries(Object.entries(policy.grades).map(([grade,g])=>{
  const threshold=m.spec.thresholds[grade],next={Junior:'Middle',Middle:'Senior'}[grade];
  const plusThreshold=(threshold+(next?m.spec.thresholds[next]:100))/2;
  const solved=solvedByDifficulty[g.difficultyMin];
  const theoryMin=g.theoryMin||0,theoryMet=theoryExact+1e-9>=theoryMin;
  return [grade,{score:scoreExact,scoreMin:threshold,theoryScore:theoryExact,theoryMin,codingScore:codingExact,codingMin:g.codingMin,difficultyMin:g.difficultyMin,solved,solvedMin:g.solvedMin,
   met:scoreExact+1e-9>=threshold&&theoryMet&&codingExact+1e-9>=g.codingMin&&solved>=g.solvedMin,
   plus:{scoreMin:plusThreshold,codingMin:g.plusCodingMin,solvedMin:g.plusSolvedMin,met:scoreExact+1e-9>=plusThreshold&&theoryMet&&codingExact+1e-9>=g.plusCodingMin&&solved>=g.plusSolvedMin}}];
 }));
 return {score:display(scoreExact),scoreExact,theoryScore:display(theoryExact),codingScore:display(codingExact),
  ...(adjustedCoding?{codingCompletion:display(codingCompletionExact),codingScoreModel:policy.codingScoreModel}:{}),
  codingEvidence:{total:coding.length,fullySolved:codingCredits.filter(x=>x.credit===1).length,solvedByDifficulty},gradeRequirements:requirements,
  scoreRule:policy.rule,calibration:policy.calibration,adaptiveRule:m.spec.adaptive.rule,secondPartRoute:m.adaptive.selectedRoute};
}
export function meetsModuleGrade(result,grade,plus=false){
 if(isEvidenceScoringRule(result.scoreRule))return plus?result.gradeRequirements?.[grade]?.plus?.met===true:result.gradeRequirements?.[grade]?.met===true;
 const threshold=plus?(result.thresholds[grade]+(grade==='Senior'?100:result.thresholds[grade==='Junior'?'Middle':'Senior']))/2:result.thresholds[grade];
 return Number.isFinite(result.score)&&result.score>=threshold;
}
