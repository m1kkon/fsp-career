import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {citySuggestions,canonicalCity,loadWorldCities,worldCitiesReady} from '../public/cities.mjs';
import {cityRows} from '../public/city-data.mjs';
import {worldCityRows} from '../public/world-city-data.mjs';

const source=readFileSync(new URL('../public/city-autocomplete.js',import.meta.url),'utf8');
await loadWorldCities();
function client(storage=new Map()){
 const handlers={},calls=[];
 const context=vm.createContext({canonicalCity,citySuggestions,loadWorldCities,worldCitiesReady,esc:value=>String(value??''),Event,role:'candidate',busy:false,locationPreference:{city:'',format:''},
  state:{authenticated:true,user:{id:'a'},roles:['candidate','employer'],profile:{city:'Самара'},company:{city:'Казань'}},
  document:{addEventListener:(type,handler)=>{handlers[type]=handler;}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},close(){},render(){vm.runInContext('syncLocationPreference()',context);},
  async mutate(body){calls.push({...body});context.state[body.action==='company'?'company':'profile'].city=body.city;return {state:context.state};}
 });
 vm.runInContext(source,context);
 return {context,storage,handlers,calls,sync:()=>vm.runInContext('syncLocationPreference()',context),apply:(city,format='Любой формат')=>vm.runInContext(`applyLocation(${JSON.stringify(city)},${JSON.stringify(format)})`,context)};
}
test('city search ranks exact and prefix matches, normalises ё and supports aliases',()=>{
 assert.equal(cityRows.length,1117);
 for(const [query,name] of [['  МОСК','Москва'],['сам','Самара'],['питер','Санкт-Петербург'],['спб','Санкт-Петербург'],['орехово зуево','Орехово-Зуево'],['щёлково','Щёлково'],['дмитров','Дмитров']])assert.equal(citySuggestions(query)[0]?.name,name,query);
 assert.ok(citySuggestions('нов').length<=8);assert.equal(citySuggestions('НесуществующийГородXYZ').length,0);
 assert.ok(citySuggestions('').some(c=>c.name==='Москва'));
 assert.equal(canonicalCity('самара'),'Самара');assert.equal(canonicalCity('спб'),'Санкт-Петербург');assert.equal(canonicalCity('  Тбилиси  '),'Тбилиси, Грузия');
});
test('international cities match Russian, English and native names, with countries distinguishing shared names',()=>{
 assert.ok(worldCityRows.length>30000);assert.ok(new Set(worldCityRows.map(row=>row[1])).size>200);
 for(const [query,name,country] of [['тбили','Тбилиси','Грузия'],['Tbilisi','Тбилиси','Грузия'],['Yerevan','Ереван','Армения'],['Belgrade','Белград','Сербия'],['Minsk','Минск','Беларусь'],['Almaty','Алматы','Казахстан'],['Astana','Астана','Казахстан'],['Dubai','Дубай','ОАЭ'],['New York','Нью-Йорк','Соединенные Штаты'],['Munchen','Мюнхен','Германия'],['München','Мюнхен','Германия'],['İstanbul','Стамбул','Турция']]){
  const first=citySuggestions(query)[0];assert.equal(first?.name,name,query);assert.ok(first.region.startsWith(country),query);
 }
 const shared=citySuggestions('Лондон');assert.ok(shared.some(city=>city.region.startsWith('Великобритания')));assert.ok(shared.some(city=>city.region.startsWith('Канада')));
 assert.equal(canonicalCity('Tbilisi'),'Тбилиси, Грузия');assert.equal(canonicalCity('Yerevan'),'Ереван, Армения');assert.equal(canonicalCity('Moscow'),'Москва');
 assert.equal(canonicalCity('London, Canada'),'Лондон, Канада');assert.equal(canonicalCity('Лондон, Великобритания'),'Лондон, Великобритания');assert.notEqual(shared[0].value,shared[1].value);
 assert.equal(citySuggestions('London, Canada')[0].value,'Лондон, Канада');assert.equal(citySuggestions('моск, Russia')[0].value,'Москва');
 assert.equal(canonicalCity('Небольшой неизвестный город'),'Небольшой неизвестный город');
});
test('world data loads only on demand and concurrent fields share the same load',async()=>{
 const fresh=await import('../public/cities.mjs?lazy-load-test');
 assert.equal(fresh.worldCitiesReady(),false);assert.deepEqual(fresh.citySuggestions('Tbilisi'),[]);
 const first=fresh.loadWorldCities();assert.equal(first,fresh.loadWorldCities());await first;
 assert.equal(fresh.worldCitiesReady(),true);assert.equal(fresh.citySuggestions('Tbilisi')[0].name,'Тбилиси');
});
test('a late world download uses the latest city query, never reopens a closed list, and supports manual input on failure',async()=>{
 function pending(){
  const {context,handlers}=client();let resolve,reject,ready=false;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  context.worldCitiesReady=()=>ready;context.loadWorldCities=()=>promise;
  context.citySuggestions=query=>ready?[{name:query,region:'Страна'}]:[];
  const attrs=new Map(),list={hidden:true,innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
  const input={id:'city-input',isConnected:true,value:'Тбилиси',matches:()=>true,parentElement:{querySelector:()=>list},getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)};
  context.document.querySelectorAll=()=>[input];context.input=input;
  return {context,handlers,input,list,resolve(){ready=true;resolve();},reject};
 }
 const latest=pending();latest.handlers.focusin({target:latest.input});assert.match(latest.list.innerHTML,/Загружаем/);
 latest.input.value='Ереван';latest.handlers.input({target:latest.input});latest.resolve();await new Promise(setImmediate);
 assert.match(latest.list.innerHTML,/Ереван/);assert.doesNotMatch(latest.list.innerHTML,/Тбилиси/);
 const closed=pending();closed.handlers.focusin({target:closed.input});vm.runInContext('closeCityOptions(input)',closed.context);closed.resolve();await new Promise(setImmediate);assert.equal(closed.list.hidden,true);
 const failed=pending();failed.handlers.focusin({target:failed.input});failed.reject(new Error('unavailable'));await new Promise(setImmediate);assert.match(failed.list.innerHTML,/Можно ввести город вручную/);assert.equal(failed.input.value,'Тбилиси');
});
test('profile cities hydrate the header per role and per account; guest choices stay separate',()=>{
 const {context,sync,storage}=client(new Map([['fsp-search-location',JSON.stringify({city:'Москва',format:'Офис'})]]));
 sync();assert.equal(context.locationPreference.city,'Самара');assert.equal(context.locationPreference.format,'');
 context.role='employer';sync();assert.equal(context.locationPreference.city,'Казань');
 context.state={authenticated:true,user:{id:'b'},roles:['employer'],company:{city:'Тюмень'}};sync();assert.equal(context.locationPreference.city,'Тюмень');
 context.state={authenticated:false,roles:[]};sync();assert.equal(context.locationPreference.city,'Москва');assert.equal(context.locationPreference.format,'Офис');assert.equal(storage.size,1);
});
test('onboarding and profile updates replace the previous header city',()=>{
 const {context,sync}=client();context.state.roles=[];sync();assert.equal(context.locationPreference.city,'');
 context.state.roles=['candidate'];context.state.profile.city='Санкт-Петербург';sync();assert.equal(context.locationPreference.city,'Санкт-Петербург');
 context.state.profile.city='Екатеринбург';sync();assert.equal(context.locationPreference.city,'Екатеринбург');
 context.state.profile.city='';sync();assert.equal(context.locationPreference.city,'');
});
test('header city changes use partial profile/company saves and survive reload',async()=>{
 const {context,sync,apply,calls,storage}=client();sync();
 await apply('тюмень','Гибрид');assert.deepEqual(calls,[{action:'profile',city:'Тюмень'}]);assert.equal(context.state.profile.city,'Тюмень');assert.equal(context.locationPreference.city,'Тюмень');
 const reloaded=client(storage);reloaded.context.state.profile.city='Тюмень';reloaded.sync();assert.equal(reloaded.context.locationPreference.city,'Тюмень');assert.equal(reloaded.context.locationPreference.format,'Гибрид');
 context.role='employer';sync();await apply('Омск');assert.deepEqual(calls[1],{action:'company',city:'Омск'});assert.equal(context.state.profile.city,'Тюмень');assert.equal(context.state.company.city,'Омск');
});
test('international header choices persist the canonical city and sync back from onboarding',async()=>{
 const {context,sync,apply,calls,storage}=client();sync();await apply('Tbilisi');
 assert.deepEqual(calls,[{action:'profile',city:'Тбилиси, Грузия'}]);
 const reloaded=client(storage);reloaded.context.state.profile.city='Тбилиси, Грузия';reloaded.sync();assert.equal(reloaded.context.locationPreference.city,'Тбилиси, Грузия');
 context.state.profile.city='Ереван, Армения';sync();assert.equal(context.locationPreference.city,'Ереван, Армения');
 context.state.profile.city='Yerevan';sync();await apply('Yerevan');assert.deepEqual(calls[1],{action:'profile',city:'Ереван, Армения'});assert.equal(context.state.profile.city,'Ереван, Армения');
 await apply('London, Canada');assert.equal(context.state.profile.city,'Лондон, Канада');await apply('London, United Kingdom');assert.equal(context.state.profile.city,'Лондон, Великобритания');
});
test('Any city and remote clear only search filters, and a failed save keeps the old choice',async()=>{
 const {context,sync,apply,calls,storage}=client();sync();await apply('','Удалённо');
 assert.equal(calls.length,0);assert.equal(context.state.profile.city,'Самара');assert.equal(context.locationPreference.city,'');
 const reloaded=client(storage);reloaded.sync();assert.equal(reloaded.context.locationPreference.city,'');assert.equal(reloaded.context.locationPreference.format,'Удалённо');
 context.state.profile.city='Казань';sync();assert.equal(context.locationPreference.city,'Казань');
 context.mutate=async()=>undefined;const before=storage.get('fsp-search-location:a:candidate');await apply('Омск');assert.equal(context.locationPreference.city,'Казань');assert.equal(storage.get('fsp-search-location:a:candidate'),before);
});
test('ArrowDown and Enter select a city without submitting the enclosing form',()=>{
 const {handlers}=client();
 const attrs=new Map([['aria-expanded','true']]);let focused=0,changed=0,prevented=0,stopped=0;
 const options=['Самара','Самарканд'].map((name,i)=>({id:'city-option-'+i,dataset:{cityValue:name},setAttribute(k,v){this[k]=v;},scrollIntoView(){},closest:()=>({querySelector:()=>input})}));
 const list={hidden:false,querySelectorAll:()=>options,querySelector:()=>options.find(o=>o['aria-selected']==='true')};
 const input={value:'сам',matches:()=>true,parentElement:{querySelector:()=>list},getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),focus(){focused++;},dispatchEvent(){changed++;}};
 const event=key=>({target:input,key,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});
 handlers.keydown(event('ArrowDown'));assert.equal(attrs.get('aria-activedescendant'),'city-option-0');
 handlers.keydown(event('Enter'));assert.equal(input.value,'Самара');assert.equal(prevented,2);assert.equal(stopped,1);assert.equal(list.hidden,true);assert.equal(focused,1);assert.equal(changed,1);
});
