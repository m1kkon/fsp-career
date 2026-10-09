// Salary bounds are inclusive. A single bound describes an open range.
const amount=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
export function salaryRangeFit(candidate={},budget={}){
 const min=amount(candidate.min),max=amount(candidate.max),from=amount(budget.budgetMin),to=amount(budget.budgetMax);
 const active=from!==null||to!==null;
 if(!active)return {status:'pass',active,min,max,from,to,distance:0};
 if((min===null&&max===null)||(min!==null&&max!==null&&min>max))return {status:'unknown',active,min,max,from,to,distance:null};
 const above=to!==null&&min!==null&&min>to,below=from!==null&&max!==null&&max<from;
 const distance=above?(min-to)/to:below?(from-max)/from:0;
 return {status:above||below?'fail':'pass',active,min,max,from,to,distance};
}
export function salaryRangeLabel(min,max){
 const money=value=>Number(value).toLocaleString('ru-RU');
 return min!==null&&min!==undefined&&max!==null&&max!==undefined?`${money(min)}–${money(max)} ₽`:min!==null&&min!==undefined?`от ${money(min)} ₽`:max!==null&&max!==undefined?`до ${money(max)} ₽`:'Не указаны';
}
