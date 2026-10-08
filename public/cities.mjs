import {cityRows} from './city-data.mjs';

const normalise=value=>String(value??'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[\p{Script=Latin}\p{M}]+/gu,text=>text.normalize('NFD').replace(/\p{M}/gu,'')).replace(/[\s–—-]+/g,' ');
const aliases=new Map([['спб','Санкт-Петербург'],['питер','Санкт-Петербург'],['мск','Москва'],['екб','Екатеринбург']]);
const indexed=cityRows.map(([name,region,population])=>({name,region,population,keys:[normalise(name)],countryKeys:['россия','russia','ru']}));
const exactNames=new Map();
function indexCanonicalNames(){
 exactNames.clear();
 // Resolve shared names to the most populated city, retaining the Russian
 // catalogue's canonical spellings when an international name overlaps it.
 for(const city of [...indexed].sort((a,b)=>b.population-a.population)){
  for(const key of city.keys)if(!exactNames.has(key))exactNames.set(key,city.value||city.name);
  if(city.value)exactNames.set(normalise(city.value),city.value);
 }
 for(const [name] of cityRows)exactNames.set(normalise(name),name);
}
indexCanonicalNames();
let worldLoad,worldReady=false;
export function worldCitiesReady(){return worldReady;}
export function loadWorldCities(){
 // A single lazy, content-hashed download serves every city field. A failed
 // download leaves the local Russian catalogue and manual input available.
 if(!worldLoad)worldLoad=import('./world-city-data.mjs').then(({worldCityRows,russianCityAliases})=>{
  const countryNames=new Intl.DisplayNames(['ru'],{type:'region'});
  const englishCountryNames=new Intl.DisplayNames(['en'],{type:'region'});
  const countries=new Map();
  const world=worldCityRows.map(([name,country,region,population,names])=>{
   if(!countries.has(country)){const label=countryNames.of(country);countries.set(country,{label,keys:[label,englishCountryNames.of(country),country].map(normalise)});}
   const place=countries.get(country);
   return {name,value:name+', '+place.label,region:[place.label,region].filter(Boolean).join(' · '),population,keys:names.map(normalise),countryKeys:place.keys};
  });
  const russianNames=new Map(russianCityAliases.map(([name,names])=>[normalise(name),names]));
  for(const city of indexed)city.keys=[...new Set([city.name,...(russianNames.get(normalise(city.name))||[])].map(normalise))];
  indexed.push(...world);indexCanonicalNames();worldReady=true;
 });
 return worldLoad;
}

export function citySuggestions(value,limit=8){
 const raw=normalise(value),comma=raw.indexOf(','),name=comma<0?raw:raw.slice(0,comma).trim(),country=comma<0?'':raw.slice(comma+1).trim(),query=normalise(aliases.get(name)||name);
 const maximum=Math.max(0,Math.min(20,limit));
 if(!query&&!country)return indexed.slice(0,maximum).map(({name,region,value})=>({name,region,value:value||name}));
 const ranked=[];
 for(const city of indexed){
  if(country&&!city.countryKeys.some(key=>key.includes(country)))continue;
  let rank=3;
  for(const key of city.keys){if(key===query){rank=0;break;}if(key.startsWith(query))rank=Math.min(rank,1);else if(key.includes(query))rank=Math.min(rank,2);}
  if(rank<3)ranked.push({...city,rank});
 }
 return ranked.sort((a,b)=>a.rank-b.rank||b.population-a.population).slice(0,maximum).map(({name,region,value})=>({name,region,value:value||name}));
}
export function canonicalCity(value){
 const city=String(value??'').trim().slice(0,80),key=normalise(city);
 const known=aliases.get(key)||exactNames.get(key);if(known)return known;
 const comma=key.indexOf(',');
 if(comma>=0){const rawName=key.slice(0,comma).trim(),name=normalise(aliases.get(rawName)||rawName),country=key.slice(comma+1).trim();const found=indexed.find(row=>row.keys.includes(name)&&row.countryKeys.includes(country));if(found)return found.value||found.name;}
 return city;
}
