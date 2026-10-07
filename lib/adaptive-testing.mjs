// Product-specific MVP rules, versioned independently of the SAT's calibrated scoring.
export const ADAPTIVE_RULE='two-stage-16-v1';
export const ADAPTIVE_DEFAULT={
 rule:ADAPTIVE_RULE,firstCount:16,secondCount:16,
 firstDifficultyCounts:{1:5,2:6,3:5},
 routes:{foundation:{1:8,2:6,3:2},advanced:{1:2,2:6,3:8}},
 routingThreshold:65,difficultyWeights:{1:1,2:2,3:3},
};
export const adaptiveSpec=s=>({...s,scoredCount:32,difficultyCounts:{1:7,2:12,3:13},adaptive:structuredClone(ADAPTIVE_DEFAULT),numericMin:2,numericMax:8});
export function partSpec(spec,counts){return {...spec,scoredCount:16,difficultyCounts:counts};}
export function routingDecision(m,isCorrect){
 const first=m.questions.filter(q=>q.scored).slice(0,m.spec.adaptive.firstCount);
 const weights=m.spec.adaptive.difficultyWeights;
 const earned=first.reduce((n,q)=>n+(isCorrect(q,m.answers[q.id]?.value)?weights[q.difficulty]:0),0);
 const possible=first.reduce((n,q)=>n+weights[q.difficulty],0);
 return {route:earned*100>=possible*m.spec.adaptive.routingThreshold?'advanced':'foundation',earned,possible,threshold:m.spec.adaptive.routingThreshold,rule:m.spec.adaptive.rule};
}
export function adaptiveScore(m,isCorrect){
 const config=m.spec.adaptive,weights=config.difficultyWeights;
 const earned=m.questions.filter(q=>q.scored).reduce((n,q)=>n+(isCorrect(q,m.answers[q.id]?.value)?weights[q.difficulty]:0),0);
 const points=counts=>Object.entries(counts).reduce((n,[d,count])=>n+weights[d]*count,0);
 const maximum=points(config.firstDifficultyCounts)+Math.max(...Object.values(config.routes).map(points))+m.questions.filter(q=>q.scored&&q.format==='coding').reduce((n,q)=>n+weights[q.difficulty],0);
 return {score:Math.round(earned/maximum*100),earnedPoints:earned,maximumPoints:maximum,scoreRule:'difficulty-weighted-fixed-scale-v1',adaptiveRule:config.rule,secondPartRoute:m.adaptive.selectedRoute};
}
