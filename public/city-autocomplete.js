let cityFieldSequence=0;
function cityInputField(label,name,value,attrs){
 const id='city-input-'+(++cityFieldSequence);
 return `<div class="field city-field"><label for="${id}">${label}</label><input id="${id}" name="${name}" value="${esc(value)}" type="text" data-city-input role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-options" autocomplete="off" maxlength="80" ${attrs.replace(/maxlength="[^"]*"/g,'')}><div id="${id}-options" class="city-options" role="listbox" aria-label="Подсказки городов" hidden></div></div>`;
}
function closeCityOptions(input){
 if(!input)return;
 const list=input.parentElement.querySelector('.city-options');if(list)list.hidden=true;
 input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
}
const citySuggestionRequests=new WeakMap();
function renderCityOptions(input,error=false,preserveSelection=false){
 const list=input.parentElement.querySelector('.city-options');if(!list)return;
 const highlighted=preserveSelection?list.querySelector('[aria-selected="true"]')?.dataset.cityValue:null;
 const rows=citySuggestions(input.value);
 const note=error?'Не удалось загрузить города мира. Можно ввести город вручную.':!worldCitiesReady()?'Загружаем города мира…':!rows.length?'Город не найден. Можно ввести его название вручную.':'';
 list.innerHTML=rows.map((city,i)=>`<button type="button" id="${input.id}-option-${i}" role="option" aria-selected="false" tabindex="-1" data-city-option data-city-value="${esc(city.value||city.name)}"><strong>${esc(city.name)}</strong><span>${esc(city.region)}</span></button>`).join('')+(note?`<p class="city-no-results" role="status">${note}</p>`:'');
 list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
 if(highlighted){const option=[...list.querySelectorAll('[data-city-option]')].find(row=>row.dataset.cityValue===highlighted);if(option){option.setAttribute('aria-selected','true');input.setAttribute('aria-activedescendant',option.id);}}
}
function showCityOptions(input){
 for(const other of document.querySelectorAll('[data-city-input]'))if(other!==input)closeCityOptions(other);
 renderCityOptions(input);
 const request={};citySuggestionRequests.set(input,request);
 if(!worldCitiesReady()){
  const update=error=>{if(input.isConnected&&input.getAttribute('aria-expanded')==='true'&&citySuggestionRequests.get(input)===request)renderCityOptions(input,error,true);};
  loadWorldCities().then(()=>update(false)).catch(()=>update(true));
 }
}
function chooseCityOption(option){
 const input=option.closest('.city-field').querySelector('[data-city-input]');
 input.value=option.dataset.cityValue;input.focus();closeCityOptions(input);
 input.dispatchEvent(new Event('change',{bubbles:true}));
}
document.addEventListener('focusin',event=>{if(event.target.matches?.('[data-city-input]'))showCityOptions(event.target);});
document.addEventListener('focusout',event=>{const input=event.target;if(input.matches?.('[data-city-input]')&&!input.parentElement.contains(event.relatedTarget))closeCityOptions(input);});
document.addEventListener('input',event=>{if(event.target.matches?.('[data-city-input]'))showCityOptions(event.target);});
document.addEventListener('pointerdown',event=>{
 const option=event.target.closest?.('[data-city-option]');
 if(option){event.preventDefault();return;}
 if(!event.target.closest?.('.city-field'))for(const input of document.querySelectorAll('[data-city-input]'))closeCityOptions(input);
});
document.addEventListener('click',event=>{const option=event.target.closest?.('[data-city-option]');if(option){event.preventDefault();chooseCityOption(option);}});
document.addEventListener('keydown',event=>{
 const input=event.target;if(!input.matches?.('[data-city-input]')||event.isComposing)return;
 if(event.key==='Escape'&&input.getAttribute('aria-expanded')==='true'){event.preventDefault();event.stopImmediatePropagation();closeCityOptions(input);return;}
 if(event.key==='Tab'){closeCityOptions(input);return;}
 const list=input.parentElement.querySelector('.city-options');
 if(['ArrowDown','ArrowUp'].includes(event.key)){
  event.preventDefault();if(list.hidden)showCityOptions(input);
  const options=[...list.querySelectorAll('[data-city-option]')];if(!options.length)return;
  const index=options.findIndex(o=>o.id===input.getAttribute('aria-activedescendant'));
  const next=index<0?(event.key==='ArrowDown'?0:options.length-1):(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  for(const [i,option] of options.entries())option.setAttribute('aria-selected',String(i===next));
  input.setAttribute('aria-activedescendant',options[next].id);options[next].scrollIntoView({block:'nearest'});return;
 }
 if(event.key==='Enter'&&!list.hidden){
  const selected=list.querySelector('[aria-selected="true"]');
  if(selected){event.preventDefault();event.stopImmediatePropagation();chooseCityOption(selected);}else closeCityOptions(input);
 }
});

let locationIdentity,locationProfileCity;
function locationStorageKey(identity){return identity==='guest'?'fsp-search-location':'fsp-search-location:'+identity;}
function readLocationPreference(key){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value.city==='string'&&['','Удалённо','Гибрид','Офис'].includes(value.format)?{...value,city:value.city.slice(0,80)}:null;}catch{return null;}}
function writeLocationPreference(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
function syncLocationPreference(){
 const member=state.authenticated&&state.user?.id&&state.roles.includes(role);
 const identity=member?state.user.id+':'+role:'guest';
 const profileCity=member?canonicalCity((role==='employer'?state.company:state.profile)?.city||''):'';
 if(identity===locationIdentity&&profileCity===locationProfileCity)return;
 const saved=readLocationPreference(locationStorageKey(identity));
 const changed=identity===locationIdentity&&profileCity!==locationProfileCity;
 locationPreference={city:member?(changed?profileCity:saved?.profileCity===profileCity?saved.city:profileCity):(saved?.city||''),format:saved?.format||''};
 locationIdentity=identity;locationProfileCity=profileCity;
}
async function applyLocation(city,format){
 if(busy)return;
 const wanted=role,owner=state.user?.id,member=state.authenticated&&owner&&state.roles.includes(wanted);
 const identity=member?owner+':'+wanted:'guest';
 const next={city:canonicalCity(city),format:['Удалённо','Гибрид','Офис'].includes(format)?format:''};
 const rawProfileCity=(wanted==='employer'?state.company:state.profile)?.city||'',profileCity=canonicalCity(rawProfileCity);
 // Clearing the search filter must not erase a person's or company's city.
 if(member&&next.city&&next.city!==rawProfileCity){
  const saved=await mutate({action:wanted==='employer'?'company':'profile',city:next.city});
  if(!saved)return;
 }
 writeLocationPreference(locationStorageKey(identity),{...next,profileCity:member?(next.city||profileCity):''});
 if(role!==wanted||state.user?.id!==owner)return;
 locationPreference=next;locationIdentity=identity;locationProfileCity=member?(next.city||profileCity):'';
 close();render();
}
