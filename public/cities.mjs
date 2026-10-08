import {cityRows} from './city-data.mjs';

const normalise=value=>String(value??'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[\s–—-]+/g,' ');
const aliases=new Map([['спб','Санкт-Петербург'],['питер','Санкт-Петербург'],['мск','Москва'],['екб','Екатеринбург']]);
const indexed=cityRows.map(([name,region])=>({name,region,key:normalise(name)}));

export function citySuggestions(value,limit=8){
 const raw=normalise(value),query=normalise(aliases.get(raw)||raw);
 const ranked=indexed.filter(c=>!query||c.key.includes(query)).map(c=>({...c,rank:c.key===query?0:c.key.startsWith(query)?1:2}));
 // Population order from the local snapshot breaks ties between matches.
 return ranked.sort((a,b)=>a.rank-b.rank).slice(0,Math.max(0,Math.min(20,limit))).map(({name,region})=>({name,region}));
}
export function canonicalCity(value){
 const city=String(value??'').trim().slice(0,80),key=normalise(city);
 return aliases.get(key)||indexed.find(c=>c.key===key)?.name||city;
}
