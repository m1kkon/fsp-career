// Included in the versioned cabinet script; secrets live only in the open dialog.
let apiAccessCache={owner:null,rows:null,loading:false,error:''};
async function loadApiAccess() {
 const owner=state.user?.id;
 if(!owner||apiAccessCache.loading)return;
 apiAccessCache={owner,rows:null,loading:true,error:''};
 try {
  const result=await requestData('/api/keys',{cache:'no-store'});
  if(state.user?.id===owner)apiAccessCache={owner,rows:result.keys,loading:false,error:''};
 }catch(error){if(state.user?.id===owner)apiAccessCache={owner,rows:null,loading:false,error:error.message};}
 if(page==='api-access'&&state.user?.id===owner)render();
}
function apiAccessPage() {
 const owner=state.user?.id;
 if(apiAccessCache.owner!==owner)apiAccessCache={owner,rows:null,loading:false,error:''};
 if(!apiAccessCache.rows&&!apiAccessCache.loading&&!apiAccessCache.error)void loadApiAccess();
 const rows=apiAccessCache.rows||[];
 return `${title('Доступ по API','Подключите поиск и работу с кабинетом к своим приложениям.')}<div class="api-access-layout"><section class="panel api-access-main"><div class="api-access-heading"><div><h2>Ваши ключи</h2><p>Ключ действует от вашего имени. Права кабинета и приватность кандидатов сохраняются.</p></div>${button('Создать ключ','api-key-new')}</div>${apiAccessCache.loading?'<p role="status">Загружаем ключи…</p>':apiAccessCache.error?`<p role="alert">${esc(apiAccessCache.error)}</p>${button('Повторить','api-key-refresh','',true)}`:rows.length?`<div class="api-key-list">${rows.map(k=>{const active=!k.revokedAt&&k.expires>Date.now();return `<article class="api-key-row"><div><strong>${esc(k.name)}</strong><code>${esc(k.prefix)}…</code><span>${k.scopes.includes('write')?'Чтение и запись':'Только чтение'} · ${k.revokedAt?'Отозван':k.expires<=Date.now()?'Истёк':'До '+date(k.expires)}</span><small>${k.lastUsed?'Использован: '+date(k.lastUsed):'Ещё не использован'}</small></div>${active?button('Отозвать','api-key-revoke',`data-id="${esc(k.id)}"`,true):''}</article>`;}).join('')}</div>`:'<div class="api-key-empty"><h3>Пока нет API-ключей</h3><p>Создайте отдельный ключ для каждой интеграции. Полный ключ покажем один раз.</p></div>'}</section><aside class="panel api-access-aside"><h2>Начните с поиска</h2><p>Поиск кандидатов доступен ключам владельца профиля компании. Можно фильтровать навыки, грейд, город и зарплату, сохранять избранное и отправлять приглашения.</p><a class="button secondary" href="/api-docs" target="_blank" rel="noopener">Документация и примеры</a><h3>Хранение ключа</h3><p>Используйте ключ на своём сервере. Не вставляйте его в браузерный код, Git или общие сообщения. При смене пароля все ключи отзываются.</p><p>До 10 действующих ключей · 120 запросов в минуту · 30 операций записи в минуту.</p></aside></div>`;
}
function newApiKeyDialog() {
 modal('Создать API-ключ','Назовите интеграцию и выберите необходимый доступ.',`<form id="api-key-form">${field('Название','name','','text','required maxlength="80" placeholder="Например, подбор для HR"')}<div class="field"><label for="api-key-scope">Права</label><select id="api-key-scope" name="scope"><option value="read">Только чтение</option><option value="write">Чтение и запись</option></select></div><div class="field"><label for="api-key-expiry">Срок действия</label><select id="api-key-expiry" name="days"><option value="90">90 дней</option><option value="30">30 дней</option></select></div><p class="subtext">Запись позволяет изменять профиль, публиковать вакансии и отправлять приглашения от вашего имени.</p>${formEnd('Создать ключ')}</form>`);
}
async function issueApiKey(form,data) {
 if(busy)return;busy=true;
 const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
 const owner=state.user?.id;
 try {
  const result=await requestData('/api/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.name,scopes:data.scope==='write'?['read','write']:['read'],expiresInDays:Number(data.days)})});
  if(state.user?.id!==owner){close();return;}
  apiAccessCache={owner,rows:[result.key,...(apiAccessCache.rows||[])],loading:false,error:''};render();
  modal('API-ключ создан','Скопируйте его сейчас. Повторно показать полный ключ нельзя.',`<pre class="api-secret" data-api-secret>${esc(result.token)}</pre><p>Храните ключ в секретах своего приложения. Действует до ${date(result.key.expires)}.</p><div class="api-key-dialog-actions">${button('Скопировать ключ','api-key-copy')}${button('Готово','close','',true)}</div><p data-error role="alert" class="form-error"></p>`);
 }catch(error){const target=form.querySelector('[data-error]');if(target)target.textContent=error.message;}
 finally{busy=false;submit.disabled=false;}
}
function revokeApiKeyDialog(id) {
 const key=apiAccessCache.rows?.find(k=>k.id===id);if(!key)return;
 modal('Отозвать ключ?',`Интеграция «${esc(key.name)}» потеряет доступ.`,`${button('Отозвать ключ','api-key-confirm-revoke',`data-id="${esc(id)}"`)}${button('Отмена','close','',true)}<p data-error role="alert" class="form-error"></p>`);
}
async function revokeApiAccess(id) {
 if(busy)return;busy=true;
 try{await requestData('/api/keys',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});close();await loadApiAccess();toast('Ключ отозван.');}
 catch(error){const target=overlay.querySelector('[data-error]');if(target)target.textContent=error.message;}
 finally{busy=false;}
}
async function copyApiSecret() {
 try{await navigator.clipboard.writeText(overlay.querySelector('[data-api-secret]').textContent);toast('Ключ скопирован.');}
 catch{const target=overlay.querySelector('[data-error]');if(target)target.textContent='Не удалось скопировать автоматически. Выделите и скопируйте ключ вручную.';}
}
