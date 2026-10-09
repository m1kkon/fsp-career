// Metrics operate only on labels/outcomes, independently of product scoring.
export const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
export function confusionMetrics(rows, labels) {
 const matrix=labels.map(()=>labels.map(()=>0));
 for(const row of rows){const a=labels.indexOf(row.expected),b=labels.indexOf(row.actual);if(a<0||b<0)throw new Error('Unknown grade');matrix[a][b]++;}
 const n=rows.length, supports=matrix.map(row=>row.reduce((a,b)=>a+b,0));
 const predicted=labels.map((_,i)=>matrix.reduce((s,row)=>s+row[i],0));
 const recall=labels.map((_,i)=>supports[i]?matrix[i][i]/supports[i]:null);
 const agreement=n?matrix.reduce((s,row,i)=>s+row[i],0)/n:null;
 const chance=n?supports.reduce((s,v,i)=>s+v*predicted[i],0)/(n*n):null;
 return {n,labels,matrix,accuracy:agreement,balancedAccuracy:mean(recall.filter(x=>x!==null)),
  kappa:chance!==null&&chance<1?(agreement-chance)/(1-chance):null,
  overgraded:n?rows.filter(row=>labels.indexOf(row.actual)>labels.indexOf(row.expected)).length/n:null,
  undergraded:n?rows.filter(row=>labels.indexOf(row.actual)<labels.indexOf(row.expected)).length/n:null,
  byGrade:labels.map((label,i)=>({label,n:supports[i],recall:recall[i]}))};
}
export function wilson(successes,n){
 if(!n)return null;const z=1.959963984540054,p=successes/n,denom=1+z*z/n;
 const centre=(p+z*z/(2*n))/denom,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom;
 return {low:Math.max(0,centre-half),high:Math.min(1,centre+half)};
}
export function gradedNdcg(labels,k=5){
 const dcg=xs=>xs.slice(0,k).reduce((s,x,i)=>s+x/Math.log2(i+2),0);
 const ideal=dcg([...labels].sort((a,b)=>b-a));return ideal?dcg(labels)/ideal:null;
}
export function seededRandom(seed){
 let state=2166136261;for(const char of String(seed)){state^=char.charCodeAt(0);state=Math.imul(state,16777619);}
 return ()=>{state+=0x6d2b79f5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
