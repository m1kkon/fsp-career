// Assessment workspace. Bundled with mvp.js in one module; shared helpers resolve on use.
let eliminatedAnswers=new Set(),timerHidden=false,serverOffset=0;
let assessmentDraftPending=null,assessmentDraftFlight=null,assessmentDraftTimer=null,assessmentDraftSaveState='';
let assessmentAttempt=null,assessmentQuestion=0,assessmentAdmin=null,assessmentAdminTab='bank',assessmentModuleFilter='all',assessmentStatusFilter='all',assessmentQuestionQuery='',assessmentSaving=false,assessmentDraft=null,assessmentRenderKey=null,assessmentRetryAt=0,assessmentBooking=null,assessmentPreparation=null;
const assessmentModuleName=id=>state.assessment?.modules.find(m=>m.id===id)?.name||id;
const assessmentStatusLabels={draft:'Черновик',experimental:'Экспериментальный',working:'Рабочий',rejected:'Отклонён',retired:'Архив',published:'Зафиксирован',active:'В процессе',finished:'Завершён',incomplete:'Не завершён',registered:'Записан',started:'Начат',cancelled:'Отменён'};
function assessmentConfig(){return state.assessment||{modules:[],roles:[],days:[],history:[],hiddenHistory:[],registrations:[],specifications:[]};}
function assessmentExamActive(){return page==='tests'&&assessmentAttempt?.status==='active'&&!!assessmentAttempt.currentModule;}
function assessmentAccept(t){const previous=assessmentAttempt,key=x=>x?.id+':'+x?.currentModule?.id+':'+x?.currentModule?.questionIndex;assessmentAttempt=t;if(t.serverTime)serverOffset=t.serverTime-Date.now();assessmentQuestion=t.currentModule?.questionIndex||0;if(key(previous)!==key(t)){assessmentDraft=t.currentModule?.answers[t.currentModule.questions[assessmentQuestion].id]??null;if(assessmentDraft&&typeof assessmentDraft==='object')assessmentDraft=assessmentDraft.source;eliminatedAnswers=new Set();assessmentDraftPending=null;clearTimeout(assessmentDraftTimer);assessmentDraftSaveState='';}}

function assessmentDateTime(t){return new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});}
function assessmentMinutes(s){return Math.floor(s/60)+' мин'+(s%60?' '+s%60+' с':'');}
function assessmentDuration(target,day){const config=assessmentConfig(),role=config.roles.find(r=>r.id===target.id),ids=role?[...role.modules,role.integration]:[target.id];return ids.reduce((n,id)=>n+(day?.moduleConfigs?.[id]?.seconds||config.specifications.find(s=>s.moduleId===id)?.seconds||0),0)+(ids.length-1)*(day?.breakSeconds||0);}
function assessmentResultRows(rows){if(!rows.length)return '';return `<div class="assessment-result-grid">${rows.map(r=>`<article class="assessment-result-card"><div class="eyebrow">${esc(r.name)}</div><strong>${r.score}<small>/100</small></strong><p>${esc(r.level)}</p><small>${r.correct} из ${r.total} зачётных · спецификация v${r.specVersion}</small></article>`).join('')}</div>`;}
// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assessmentProfileResults(){const histories=assessmentConfig().history,skills=histories.flatMap(h=>h.results.filter(r=>!assessmentConfig().modules.find(m=>m.id===r.moduleId)?.integration).map(r=>({...r,date:h.created,attempt:h.name}))),roles=histories.filter(h=>h.targetKind==='role');return `<article class="panel resume-section"><h2>Результаты навыков</h2>${skills.length?skills.map(r=>`<div class="assessment-profile-result"><div><strong>${esc(r.name)}</strong><small>${date(r.date)} · v${r.specVersion} · ${esc(r.attempt)}</small></div><span>${r.score}/100 · ${esc(r.level)}</span></div>`).join(''):'<p>Результаты отдельных навыков и модулей ролевых тестов появятся здесь.</p>'}<h2>Ролевые тесты</h2>${roles.length?roles.map(h=>`<div class="assessment-profile-result"><div><strong>${esc(h.name)}</strong><small>${date(h.created)} · пул v${h.dayVersion}</small></div><span>${h.status==='active'?'В процессе':h.roleResult?.completed?assessmentRoleOutcome(h.roleResult):'Не завершён'}</span></div>`).join(''):'<p>Комплексные тесты ещё не проходились.</p>'}</article>`;}
function assessmentLatestResults(config){
 const latest=new Map(),modules=new Map(config.modules.map(m=>[m.id,m]));
 const keep=result=>{const key=result.kind+':'+result.id,previous=latest.get(key);if(!previous||result.completedAt>previous.completedAt||(result.completedAt===previous.completedAt&&result.created>previous.created))latest.set(key,result);};
 for(const h of config.history){
  if(h.hiddenFromHistory||h.status==='active'||h.resultsAvailable===false)continue;
  for(const r of h.results||[]){const skill=modules.get(r.moduleId);if(skill&&!skill.integration&&Number.isFinite(r.score))keep({id:skill.id,name:skill.name,kind:'skill',score:r.score,attemptId:h.id,hidden:!!h.employerHiddenResults?.['skill:'+skill.id],completedAt:r.completedAt||h.created,created:h.created});}
  if(h.targetKind==='role'&&h.status==='finished'&&h.roleResult?.completed&&h.results?.length&&h.results.every(r=>Number.isFinite(r.score))){const role=config.roles.find(r=>r.id===h.targetId);if(role)keep({id:role.id,name:role.name,kind:'role',roleResult:h.roleResult,score:Math.min(...h.results.map(r=>r.score)),attemptId:h.id,hidden:!!h.employerHiddenResults?.['role:'+role.id],completedAt:Math.max(...h.results.map(r=>r.completedAt||h.created)),created:h.created});}
 }
 return [...config.modules.filter(m=>!m.integration).map(m=>latest.get('skill:'+m.id)),...config.roles.map(r=>latest.get('role:'+r.id))].filter(Boolean);
}
function assessmentConfirmedSkills(config){const results=assessmentLatestResults(config);return `<section class="assessment-catalog assessment-confirmed" aria-label="Подтвержденные навыки">${results.length?`<div class="assessment-cards">${results.map(r=>`<article class="panel assessment-test-card assessment-confirmed-card ${r.hidden?'is-private':''}"><div class="assessment-confirmed-top"><div class="eyebrow">${r.kind==='role'?'Комплексная специальность':'Навык'}</div><button type="button" class="icon-button assessment-visibility-toggle" data-action="assessment-result-visibility" data-id="${esc(r.attemptId)}" data-target-id="${esc(r.id)}" data-target-kind="${r.kind}" data-hidden="${!r.hidden}" aria-pressed="${r.hidden}" aria-label="${r.hidden?'Показать работодателю':'Скрыть от работодателя'}: ${esc(r.name)}" title="${r.hidden?'Показать работодателю':'Скрыть от работодателя'}">${icon(r.hidden?'eyeOff':'eye','small-icon')}</button></div><h3>${esc(r.name)}</h3>${r.kind==='role'&&r.roleResult?.targetGrade?`<p class="assessment-role-outcome">${assessmentRoleOutcome(r.roleResult)}</p>`:''}<div class="assessment-confirmed-score"><span>Последний балл</span><strong>${r.score}<small>/100</small></strong></div>${r.hidden?'<p class="assessment-visibility-note">Скрыто от работодателя</p>':''}</article>`).join('')}<button type="button" class="assessment-confirm-add" data-action="assessment-book"><span aria-hidden="true">+</span><strong>Подтвердить<br>квалификацию</strong></button></div>`:'<button type="button" class="assessment-confirm-add" data-action="assessment-book"><span aria-hidden="true">+</span><strong>Подтвердить<br>квалификацию</strong></button>'}</section>`;}
// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assessmentTestsPage(){
 const config=assessmentConfig();
 if(!assessmentAttempt&&config.active)assessmentAccept(config.active);
 if(assessmentAttempt){
  const t=assessmentAttempt;
  if(t.status==='active'&&t.currentModule)return assessmentExamMarkup();
  if(t.status==='active')return `${title('Модуль завершён',t.name)}<section class="panel assessment-break"><div class="eyebrow">Перерыв между модулями</div><h2>Далее: ${esc(t.modules[t.moduleIndex+1]?.name)}</h2><p>Можно продолжить с ${assessmentDateTime(t.nextModuleAt)}. Завершённые модули сохранены. Результаты всех модулей появятся после завершения всего теста.</p>${button('Начать следующий модуль','assessment-next-module')}${button('Завершить попытку','assessment-exit','',true)}<p class="form-error" data-error></p></section>`;
  return `${title(t.status==='incomplete'?'Тест не завершён':'Результаты тестирования',t.name)}${t.targetKind==='role'?`<section class="panel assessment-role-result"><h2>${t.roleResult?.completed?assessmentRoleOutcome(t.roleResult):'Незавершённый тест роли'}</h2><p>${t.roleResult?.completed?'Итог определён по обязательным порогам каждого модуля и интеграционного блока.':'Результаты закрытых модулей сохранены. Незавершённая попытка не означает низкую квалификацию.'}</p></section>`:''}${t.roleResult?.locked?'<div class="inline-note">Результат сохранён. Подтверждённая категория резюме сохранена: интервал её смены — 90 дней.</div>':t.roleResult?.lower?'<div class="inline-note">Результат сохранён. Более низкий результат не понижает подтверждённую категорию резюме.</div>':''}${assessmentResultRows(t.results)}<div class="assessment-actions">${button('Выбрать другой тест','assessment-finish')}${button('Моё резюме','nav','data-page="profile"',true)}</div>`;
 }
 const selected=assessmentSelectedTarget(config);if(selected)return assessmentStartPage(selected);
 return `<div class="page-heading"><div><h1>Подтверждение навыков</h1></div></div>${assessmentConfirmedSkills(config)}`;
}

function assessmentSelectedTarget(config=assessmentConfig()){
 const route=location.hash.slice(1);if(!route.startsWith('tests/start/'))return null;
 let id;try{id=decodeURIComponent(route.slice('tests/start/'.length));}catch{return null;}
 const role=config.roles.find(r=>r.id===id),skill=config.modules.find(m=>m.id===id&&!m.integration);
 return role?{...role,kind:'role'}:skill?{...skill,kind:'skill'}:null;
}
function assessmentBookingMarkup(config,booking){
 const targets=booking.kind==='role'?config.roles:config.modules.filter(m=>!m.integration);
 return `<div class="qualification-kind" role="tablist" aria-label="Тип квалификации">${[['skill','Навык'],['role','Роль']].map(([kind,label])=>`<button type="button" role="tab" aria-selected="${booking.kind===kind}" data-action="assessment-book-kind" data-kind="${kind}" id="qualification-${kind}-tab" aria-controls="qualification-targets">${label}</button>`).join('')}</div><div class="qualification-targets" id="qualification-targets" role="tabpanel" aria-labelledby="qualification-${booking.kind}-tab">${targets.map(target=>`<button type="button" class="qualification-option" data-action="assessment-book-target" data-id="${esc(target.id)}"><span>${esc(target.name)}</span>${icon('arrow','small-icon')}</button>`).join('')}</div>`;
}
function assessmentBookingRender(){const container=overlay.querySelector('.qualification-choice');if(container&&assessmentBooking)container.innerHTML=assessmentBookingMarkup(assessmentConfig(),assessmentBooking);}
function assessmentBook(targetId){
 if(targetId){go('tests/start/'+encodeURIComponent(targetId));return;}
 assessmentBooking={kind:'skill'};
 modal('Подтвердить квалификацию','',`<div class="qualification-choice">${assessmentBookingMarkup(assessmentConfig(),assessmentBooking)}</div>`);
 overlay.querySelector('.modal').classList.add('qualification-choice-modal');
}
async function assessmentLoadPreparation(target){
 const current={targetId:target.id,loading:true,error:'',targetGrade:'Middle',accepted:false};assessmentPreparation=current;
 try{const response=await api({action:'assessment-prepare',targetId:target.id});if(assessmentPreparation!==current)return;assessmentPreparation={...response.preparation,loading:false,targetGrade:current.targetGrade,accepted:current.accepted};}
 catch(error){if(assessmentPreparation!==current)return;current.loading=false;current.error=error.message;}
 if(page==='tests'&&assessmentSelectedTarget()?.id===target.id)render();
}
function assessmentStartPage(target){
 if(assessmentPreparation?.targetId!==target.id)void assessmentLoadPreparation(target);
 const prep=assessmentPreparation,day=prep.day,config=assessmentConfig(),ids=target.kind==='role'?[...target.modules,target.integration]:[target.id];
 const configs=day?.moduleConfigs||Object.fromEntries(config.specifications.map(s=>[s.moduleId,s]));
 return `${title(target.name,target.kind==='role'?'Тест на роль':'Тест навыка')}<section class="panel assessment-start-panel"><form id="assessment-start-form" data-target-id="${esc(target.id)}">${target.kind==='role'?assessmentGradePicker(prep.targetGrade||'Middle'):''}<div class="assessment-rules-list">${ids.map(id=>`<div><strong>${esc(assessmentModuleName(id))}</strong><span>${assessmentMinutes(configs[id]?.seconds||0)}</span></div>`).join('')}</div><p>Всего: ${assessmentMinutes(assessmentDuration(target,day))}.</p><p>Две части по 16 вопросов. Вторая часть адаптируется по ответам первой. У каждого вопроса свой таймер; ответ сохраняется автоматически. Вернуться к закрытому вопросу нельзя.</p>${ids.some(id=>configs[id]?.codingCount)?'<p>После второй части — задания на кодинг с отдельным таймером и встроенной песочницей.</p>':''}${target.kind==='role'?'<p>Результаты всех модулей появятся после завершения теста на роль.</p>':''}<p>Возможны незачётные вопросы: они не влияют на результат.</p><label class="check-row"><input type="checkbox" name="accepted" required ${prep.accepted?'checked':''}>Понимаю правила и согласен начать тестирование</label><div class="assessment-actions"><button type="submit" class="button" ${prep.loading||prep.error?'disabled':''}>${prep.loading?'Подготовка теста…':'Начать тест'}</button>${button('Назад','assessment-selection-back','',true)}</div><p class="form-error" data-error role="alert">${esc(prep.error||'')}</p>${prep.error?button('Повторить','assessment-prepare-retry','',true):''}</form></section>`;
}

// Presentation only: extract explicit code fragments without rewriting their source.
const assessmentCodeStrings=/"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g;
function assessmentPromptParts(prompt,moduleId){
 const languageNames={python:'Python',javascript:'JavaScript',js:'JavaScript',typescript:'TypeScript',ts:'TypeScript',jsx:'React · JSX',tsx:'React · TSX',react:'React · JSX',sql:'SQL',css:'CSS',bash:'Bash',sh:'Bash',html:'HTML'};
 const source=String(prompt),prefixed=source.match(/^(Python|JavaScript|TypeScript|React|SQL|CSS|Bash|HTML):\s*/i);
 let language=moduleId==='react'?'jsx':moduleId==='javascript'?'javascript':moduleId==='python'?'python':moduleId==='sql'?'sql':'text';
 if(prefixed)language=prefixed[1].toLowerCase();
 const result=(heading,code,lang=language)=>({heading:heading.trim()||'Проанализируйте код.',code,language:lang,label:languageNames[lang]||'Код'});
 const fenced=source.match(/```([\w+-]*)[^\S\n]*\n([\s\S]*?)\n?```/);
 if(fenced&&source.match(/```/g)?.length===2)return result(source.slice(0,fenced.index)+source.slice(fenced.index+fenced[0].length),fenced[2],fenced[1].toLowerCase()||language);
 const questionStart='(?:Что|Сколько|Каково|Каков|Какое|Какой|Какова|Чему|Введите|Как|Где|В каком|Вычислите|Определите)';
 const splitTail=code=>{
  const masked=code.replace(assessmentCodeStrings,s=>' '.repeat(s.length));
  const tail=masked.match(new RegExp('([.;}]\\s+|\\n)('+questionStart+'[^\\n]*)$'));
  if(!tail)return {code,question:''};
  const punctuation=tail[1][0],end=tail.index+(punctuation===';'||punctuation==='}'?1:0);
  return {code:code.slice(0,end).trimEnd(),question:code.slice(tail.index+tail[1].length).trim()};
 };
 const startsCode=code=>/^(?:const\b|let\b|var\b|return\b|try\s*:|def\s|class\s|import\s|from\s|SELECT\b|WITH\b|UPDATE\b|INSERT\b|DELETE\b|[A-Za-z_$][\w$]*\s*(?:=|\(|\[|\.))/.test(code);
 if(prefixed){
  const body=source.slice(prefixed[0].length);
  if(startsCode(body)){const tail=splitTail(body);if(tail.question)return result(tail.question,tail.code);}
 }else if(source.includes('\n')){
  const newline=source.indexOf('\n'),heading=source.slice(0,newline),body=source.slice(newline+1);
  if(new RegExp('^'+questionStart).test(heading)&&startsCode(body)){
   const tail=splitTail(body);return result(heading+(tail.question?'\n'+tail.question:''),tail.code);
  }
 }
 return {heading:source,code:null,language,label:languageNames[language]||'Код'};
}
const assessmentCodeKeywords=new Set('const let var typeof instanceof return function async await if else true false null undefined import from class new this throw try catch finally for while of in export default def lambda with as raise except pass nonlocal global yield assert del break continue switch case extends implements interface enum type void None True False and or not is print SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET JOIN LEFT RIGHT INNER OUTER ON AS DISTINCT COUNT SUM AVG INSERT INTO VALUES UPDATE SET DELETE WITH UNION ALL OVER PARTITION NULL CASE WHEN THEN END BEGIN COMMIT ROLLBACK'.split(' '));
function assessmentHighlightCode(source,language){
 const keywords=assessmentCodeKeywords;
 const tokens=/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*|#[^\n]*|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[{}()[\];.,:?<>!=+*/%-]+)/g;
 let html='',offset=0;
 for(const match of source.matchAll(tokens)){
  html+=esc(source.slice(offset,match.index));const token=match[0];let kind='';
  if(/^['"`]/.test(token))kind='string';
  else if(token.startsWith('//')||token.startsWith('/*')||(language==='sql'&&token.startsWith('--'))||(['python','bash','sh'].includes(language)&&token.startsWith('#')))kind='comment';
  else if(keywords.has(token))kind='keyword';
  else if(/(?:Error|Exception|Warning)$/.test(token)||['Promise','Map','Set','Array','Object','Number','String','Boolean'].includes(token))kind='type';
  else if(/^\d/.test(token))kind='number';
  else if(/^[A-Za-z_$]/.test(token)&&/^\s*\(/.test(source.slice(match.index+token.length)))kind='function';
  else if(/^[{}()[\];.,:?<>!=+*/%-]+$/.test(token))kind='punctuation';
  html+=kind?`<span class="code-${kind}">${esc(token)}</span>`:esc(token);offset=match.index+token.length;
 }
 return html+esc(source.slice(offset));
}
function assessmentInlineCode(text,language){
 const source=String(text),keywords=assessmentCodeKeywords;
 const types=new Set('Promise Map Set Array Object Symbol Number String Boolean Date ValueError TypeError RuntimeError Exception'.split(' '));
 const brands=new Set('Python JavaScript TypeScript React SQL CSS HTML API HTTP PostgreSQL MongoDB GitHub Docker'.split(' '));
 const tokens=/`[^`\n]+`|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g;
 let html='',offset=0;
 for(let match;(match=tokens.exec(source));){
  const token=match[0];let end=tokens.lastIndex,code=null;
  if(token.startsWith('`'))code=token;
  else if(!brands.has(token)){
   const call=source.slice(end).match(/^\s*[([]/);
   if(call){
    const opening=call[0].at(-1),closing=opening==='('?')':']';let depth=0,quote=null,escaped=false;
    for(let i=end+call[0].length-1;i<source.length;i++){
     const char=source[i];if(char==='\n')break;
     if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
     if(char==='"'||char==="'"||char==='`'){quote=char;continue;}
     if(char===opening)depth++;else if(char===closing&&--depth===0){
      const fragment=source.slice(match.index,i+1);
      if(!/[\u0400-\u04ff]/.test(fragment.replace(assessmentCodeStrings,''))){code=fragment;end=i+1;}
      break;
     }
    }
   }
   if(code===null){
    const assignment=source.slice(end).match(/^\s*(?:===|!==|==|!=|<=|>=|\+=|-=|\*=|\/=|=)\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[+-]?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*)/);
    if(assignment){end+=assignment[0].length;code=source.slice(match.index,end);}
   }
   if(code===null&&(keywords.has(token)||types.has(token)||/(?:Error|Exception|Warning)$/.test(token)||/^[A-Z][\w$]*[A-Z][\w$]*$/.test(token)||/^[a-z][\w$]*[A-Z][\w$]*$/.test(token)||/^[A-Za-z_$][\w$]*_[\w$]+$/.test(token)||token.includes('.')))code=token;
  }
  html+=esc(source.slice(offset,match.index));
  html+=code===null?esc(token):`<code class="exam-inline-code">${assessmentHighlightCode(code,language)}</code>`;
  offset=end;tokens.lastIndex=end;
 }
 return html+esc(source.slice(offset));
}

function assessmentQuestionMarkup(q,moduleId){
 const parts=assessmentPromptParts(q.prompt,moduleId);
 const heading=`<h1 id="assessment-question-title" tabindex="-1">${assessmentInlineCode(parts.heading,parts.language)}</h1>`;
 if(parts.code===null)return heading;
 const numbers=Array.from({length:parts.code.split('\n').length},(_,i)=>i+1).join('\n');
 return heading+`<section class="exam-code" aria-label="Фрагмент кода"><div class="exam-code-toolbar"><span>${esc(parts.label)}</span><span>Фрагмент кода</span></div><div class="exam-code-body" tabindex="0" role="region" aria-label="Код: ${esc(parts.label)}"><pre class="exam-code-lines" aria-hidden="true">${numbers}</pre><pre class="exam-code-source"><code>${assessmentHighlightCode(parts.code,parts.language)}</code></pre></div></section>`;
}

function assessmentExamMarkup(){
 const t=assessmentAttempt,m=t.currentModule,q=m.questions[assessmentQuestion],answer=assessmentDraft;
 const canAnswer=q.format==='choice'?Number.isInteger(answer):String(answer??'').trim().length>0;
 const submit=`<button class="exam-check" type="submit" ${assessmentSaving||!canAnswer?'disabled':''}>${assessmentSaving?'Сохраняем…':'Ответить'}</button>`;
 const position=q.format==='coding'?'Практическое задание':m.partCount===2?`Часть ${m.partIndex+1} из 2 · Вопрос ${m.partQuestionIndex+1} из ${m.partQuestionCount}`:`Вопрос ${assessmentQuestion+1} из ${m.questions.length}`;
 return `<section class="exam-shell assessment-exam" aria-label="Тестирование ${esc(m.name)}">
  <header class="exam-header">
   <button class="exam-back" data-action="assessment-exit" aria-label="Выйти из теста"><span aria-hidden="true">‹</span> Выйти из теста</button>
   <div class="exam-timer" id="assessment-countdown">${icon('clock','small-icon')}<strong role="timer" aria-label="Осталось времени">--:--</strong><button class="exam-timer-toggle" data-action="assessment-toggle-timer" aria-label="${timerHidden?'Показать':'Скрыть'} таймер">${icon(timerHidden?'eye':'eyeOff','small-icon')}</button></div>
  </header>
  <div class="exam-progress" role="progressbar" aria-label="Осталось времени на вопрос" aria-valuemin="0" aria-valuemax="${m.questionSeconds}" aria-valuenow="${m.questionSeconds}"><span></span></div>
  <main class="exam-content">
   <div class="exam-meta"><div class="exam-course"><strong>${esc(m.name)}</strong>${t.modules.length>1?`<span>Модуль ${t.moduleIndex+1} из ${t.modules.length}</span>`:''}</div><span class="exam-position">${position}</span></div>
   <form id="assessment-answer-form" class="exam-question">
    ${assessmentQuestionMarkup(q,m.id)}
    ${q.format==='coding'?assessmentCodingMarkup(q,answer):q.format==='choice'?`<fieldset class="exam-answers" aria-labelledby="assessment-question-title"><legend class="sr-only">Выберите один ответ</legend>${q.options.map((label,i)=>{
     const eliminated=eliminatedAnswers.has(i),letter=String.fromCharCode(65+i);
     return `<div class="exam-answer-row ${answer===i?'has-selection':''} ${eliminated?'is-eliminated':''}"><label class="exam-answer ${answer===i?'is-selected':''}"><input type="radio" name="assessmentAnswer" value="${i}" ${answer===i?'checked':''} ${eliminated||assessmentSaving?'disabled':''}><span class="exam-letter" aria-hidden="true">${letter}</span><span class="exam-answer-text">${assessmentInlineCode(label,m.id)}</span></label>${answer===i?submit:''}<button type="button" class="exam-eliminate" data-action="assessment-eliminate" data-index="${i}" ${assessmentSaving?'disabled':''} aria-pressed="${eliminated}" aria-label="${eliminated?'Вернуть':'Исключить'} вариант ${letter}" title="${eliminated?'Вернуть':'Исключить'} вариант ${letter}"><span aria-hidden="true">${letter}</span></button></div>`;
    }).join('')}</fieldset>`:`<div class="assessment-numeric"><label for="assessment-numeric">Числовой ответ</label><div><input id="assessment-numeric" name="assessmentNumeric" inputmode="decimal" autocomplete="off" value="${esc(answer??'')}" ${assessmentSaving?'disabled':''} aria-describedby="assessment-numeric-hint" placeholder="Введите число">${submit}</div><small id="assessment-numeric-hint">Можно использовать точку или запятую для десятичной части.</small></div>`}
    <p class="form-error exam-error" data-error role="alert"></p>
    ${q.format==='coding'?submit:''}
    <div class="exam-support"><p class="exam-hint">${q.format==='choice'?'Выберите ответ клавишами <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd>, затем нажмите ':''}<kbd>Enter</kbd>${q.format==='choice'?'':' — ответить'}</p><button class="exam-skip" type="button" data-action="assessment-question-next" ${assessmentSaving?'disabled':''}>Пропустить</button></div>
   </form>
  </main>
  <div class="exam-save-status" role="status">${assessmentSaving?'Сохраняем ответ…':assessmentDraftStatus()}</div>
 </section>`;
}
// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assessmentRenderExam(){const codingFocus=document.activeElement?.name==='assessmentCode';const codeBefore=app.querySelector('[name=assessmentCode]');const codeSelection=codingFocus?[codeBefore.selectionStart,codeBefore.selectionEnd]:null;const radioFocus=document.activeElement?.name==='assessmentAnswer'?document.activeElement.value:null;const numericFocus=document.activeElement?.id==='assessment-numeric';const inputBefore=app.querySelector('#assessment-numeric');const selection=numericFocus?[inputBefore.selectionStart,inputBefore.selectionEnd]:null;const key=assessmentAttempt.id+':'+assessmentAttempt.currentModule.id+':'+assessmentQuestion;document.body.classList.add('exam-active');const markup=assessmentExamMarkup();if(assessmentRenderKey===key&&app.querySelector('.assessment-exam')){const next=document.createElement('template');next.innerHTML=markup;for(const selector of ['.exam-header','.exam-content','.exam-save-status'])app.querySelector(selector).replaceWith(next.content.querySelector(selector));}else{app.innerHTML=markup;assessmentRenderKey=key;}document.title=assessmentAttempt.currentModule.name+' — Тестирование';if(codingFocus){const input=app.querySelector('[name=assessmentCode]');input?.focus({preventScroll:true});if(input&&codeSelection)input.setSelectionRange(...codeSelection);}else if(numericFocus){const input=app.querySelector('#assessment-numeric');input?.focus({preventScroll:true});if(input&&selection)input.setSelectionRange(...selection);}else if(radioFocus!==null){app.querySelector(`[name="assessmentAnswer"][value="${radioFocus}"]`)?.focus({preventScroll:true});}assessmentClock();}
function assessmentClock(){if(!assessmentExamActive())return;const m=assessmentAttempt.currentModule,remaining=Math.max(0,m.expiresAt-Date.now()-serverOffset),seconds=Math.ceil(remaining/1000),timer=app.querySelector('#assessment-countdown');if(timer){timer.querySelector('strong').textContent=timerHidden?'--:--':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;timer.classList.toggle('time-low',!timerHidden&&seconds<=5);}const bar=app.querySelector('.exam-progress');if(bar){bar.querySelector('span').style.transform=`scaleX(${Math.min(1,remaining/(m.questionSeconds*1000))})`;bar.setAttribute('aria-valuenow',String(seconds));}if(!remaining&&!assessmentSaving&&Date.now()>=assessmentRetryAt)assessmentRun('assessment-resume').catch(()=>{});}
setInterval(assessmentClock,200);
function assessmentDraftKey(){const m=assessmentAttempt?.currentModule;return m?assessmentAttempt.id+':'+m.id+':'+m.questions[assessmentQuestion]?.id:null;}
function assessmentDraftStatus(){return assessmentDraftSaveState==='saving'?'Сохраняем ответ…':assessmentDraftSaveState==='saved'?'Ответ сохранён. Засчитается по окончании времени.':assessmentDraftSaveState==='error'?'Не удалось сохранить выбор. Нажмите «Ответить» или проверьте соединение.':'';}
function assessmentShowDraftStatus(){const status=app.querySelector('.exam-save-status');if(status)status.textContent=assessmentSaving?'Сохраняем ответ…':assessmentDraftStatus();}
function assessmentQueueDraft(delay=0){
 if(!assessmentExamActive()||assessmentSaving)return;
 const m=assessmentAttempt.currentModule,q=m.questions[assessmentQuestion];let value=assessmentDraft;
 if(q.format==='numeric'){
  const normalized=String(value??'').trim().replace(',', '.').replace(/\u2212/g,'-');
  value=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)&&Number.isFinite(Number(normalized))?String(value).trim():null;
 }
 assessmentDraftPending={key:assessmentDraftKey(),id:assessmentAttempt.id,questionId:q.id,answer:value};
 assessmentDraftSaveState='saving';assessmentShowDraftStatus();clearTimeout(assessmentDraftTimer);
 if(delay)assessmentDraftTimer=setTimeout(()=>void assessmentFlushDraft(),delay);else void assessmentFlushDraft();
}
function assessmentFlushDraft(){
 clearTimeout(assessmentDraftTimer);
 if(assessmentDraftFlight)return assessmentDraftFlight;
 if(!assessmentDraftPending)return Promise.resolve();
 assessmentDraftFlight=(async()=>{
  while(assessmentDraftPending){
   const item=assessmentDraftPending;assessmentDraftPending=null;
   if(item.key!==assessmentDraftKey())continue;
   let saved=false;
   for(let retry=0;retry<2&&!saved;retry++){
    if(item.key!==assessmentDraftKey())break;
    try{
     const response=await api({action:'assessment-draft',id:item.id,questionId:item.questionId,answer:item.answer,revision:assessmentAttempt.revision});
     if(item.key!==assessmentDraftKey())break;
     assessmentAccept(response.assessment);saved=true;
    }catch{
     // Recover the revision after a competing tab, timeout or ambiguous network response.
     try{const resumed=await api({action:'assessment-resume',id:item.id});if(item.key!==assessmentDraftKey())break;assessmentAccept(resumed.assessment);if(item.key!==assessmentDraftKey()){if(!assessmentAttempt.currentModule)await refresh();render();break;}}catch{break;}
    }
   }
   if(item.key===assessmentDraftKey()){
    assessmentDraftSaveState=assessmentDraftPending?'saving':saved?(item.answer===null?'':'saved'):'error';
    assessmentShowDraftStatus();
   }
  }
 })().finally(()=>{assessmentDraftFlight=null;});
 return assessmentDraftFlight;
}
async function assessmentRun(actionName,extra={}){
 if(!assessmentAttempt||assessmentSaving)return;
 assessmentSaving=true;render();
 try{
  // Selection and confirmation share one revision stream; a click never advances twice.
  await assessmentFlushDraft();
  const previous=assessmentAttempt;
  if(actionName==='assessment-answer'&&extra.questionId!==previous.currentModule?.questions[assessmentQuestion]?.id)return {assessment:previous};
  const response=await api({action:actionName,id:previous.id,revision:previous.revision,...extra});
  if(response.assessment)assessmentAccept(response.assessment);
  if(!assessmentAttempt.currentModule)await refresh();return response;
 }catch(e){
  assessmentRetryAt=Date.now()+3000;
  try{const r=await api({action:'assessment-resume',id:assessmentAttempt.id});assessmentAccept(r.assessment);}catch{}
  toast(e.message);throw e;
 }finally{assessmentSaving=false;render();}
}
function assessmentQueue(actionName,extra={}){return assessmentRun(actionName,extra);}
function assessmentSaveAnswer(value){if(assessmentSaving)return;assessmentDraft=value;render();assessmentQueueDraft();}
async function assessmentConfirm(skip=false){if(assessmentSaving||!assessmentExamActive())return;const m=assessmentAttempt.currentModule,q=m.questions[assessmentQuestion];if(!skip&&q.format==='coding')assessmentDraft=app.querySelector('[name=assessmentCode]').value;if(!skip&&q.format==='numeric'){const input=app.querySelector('[name="assessmentNumeric"]'),numeric=input.value.trim().replace(',','.').replace(/\u2212/g,'-');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(numeric)||!Number.isFinite(Number(numeric))){app.querySelector('[data-error]').textContent='Введите число, например 12,5.';return;}assessmentDraft=input.value.trim();}if(!skip&&assessmentDraft===null)return;await assessmentRun('assessment-answer',{questionId:q.id,answer:skip?null:assessmentDraft});app.querySelector('#assessment-question-title')?.focus({preventScroll:true});}

// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assessmentAdminPage(){if(!assessmentConfig().maintainer)return empty('Доступ ограничен','Админка доступна мейнтейнерам тестов.');if(!assessmentAdmin){api({action:'maintainer-state'}).then(r=>{assessmentAdmin=r.admin;render();}).catch(e=>toast(e.message));return '<div class="boot-screen">Загружаем банк…</div>';}
 const admin=assessmentAdmin,tabs=[['bank','Банк вопросов'],['specs','Спецификации'],['days','Суточные пулы'],['analytics','Аналитика']];
 const head=`${title('Управление тестированием','Рабочий банк, экспериментальные вопросы и фиксированные пулы сессий.')}<div class="assessment-admin-stats"><div><strong>${admin.questions.length}</strong><span>вопросов в банке</span></div><div><strong>${admin.questions.filter(q=>q.status==='working').length}</strong><span>зачётных</span></div><div><strong>${admin.questions.filter(q=>q.status==='experimental').length}</strong><span>экспериментальных</span></div><div><strong>18</strong><span>модулей</span></div></div><nav class="assessment-admin-tabs" aria-label="Разделы админки">${tabs.map(([id,label])=>`<button data-action="assessment-admin-tab" data-id="${id}" class="${assessmentAdminTab===id?'active':''}">${label}</button>`).join('')}</nav>`;
 if(assessmentAdminTab==='bank'){const questions=admin.questions.filter(q=>(assessmentModuleFilter==='all'||q.moduleId===assessmentModuleFilter)&&(assessmentStatusFilter==='all'||q.status===assessmentStatusFilter)&&(!assessmentQuestionQuery||[q.prompt,q.familyId,q.id].join(' ').toLowerCase().includes(assessmentQuestionQuery.toLowerCase())));return head+`<div class="assessment-admin-toolbar"><select aria-label="Модуль" data-assessment-filter="module"><option value="all">Все модули</option>${admin.modules.map(m=>`<option value="${m.id}" ${assessmentModuleFilter===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select><select aria-label="Статус" data-assessment-filter="status">${['all','working','experimental','draft','rejected','retired'].map(s=>`<option value="${s}" ${assessmentStatusFilter===s?'selected':''}>${s==='all'?'Все статусы':assessmentStatusLabels[s]}</option>`).join('')}</select><input aria-label="Поиск вопросов" data-assessment-filter="query" placeholder="Условие, семейство, ID" value="${esc(assessmentQuestionQuery)}">${button('Добавить вопрос','assessment-question-new')}</div><p class="subtext">${questions.length} вопросов · существующие экземпляры сохраняются при создании новой версии.</p><div class="assessment-bank-list">${questions.map(q=>`<article class="panel assessment-bank-row"><div><div class="assessment-bank-meta">${badge(assessmentStatusLabels[q.status],q.status==='working'?'green':'')}${tag([assessmentModuleName(q.moduleId),'Сложность '+q.difficulty,q.format==='choice'?'4 варианта':q.format==='coding'?'Кодинг':'Число'])}</div><h3>${esc(q.prompt)}</h3><p>${esc(q.familyId)} · шаблон v${q.templateVersion} · вопрос v${q.version}</p><small>Показов вопроса: ${q.exposure} · семейства: ${q.familyExposure}</small></div>${button('Карточка','assessment-question-detail',`data-id="${q.id}"`,true)}</article>`).join('')}</div>`;}
 if(assessmentAdminTab==='specs')return head+`<div class="assessment-cards">${admin.modules.map(m=>{const spec=admin.specifications.filter(s=>s.moduleId===m.id).sort((a,b)=>b.version-a.version||(b.created||0)-(a.created||0))[0];return `<article class="panel assessment-test-card"><div class="eyebrow">Версия ${spec.version}</div><h2>${esc(m.name)}</h2><p>${spec.adaptive?'2 части × 16 вопросов':spec.scoredCount+' зачётных'} · ${spec.questionSeconds||20} с на вопрос · до ${assessmentMinutes(spec.seconds)}<br>${spec.adaptive?`Часть 1 (сложность 1/2/3): ${Object.values(spec.adaptive.firstDifficultyCounts).join(' / ')}<br>Часть 2: базовая ${Object.values(spec.adaptive.routes.foundation).join(' / ')}; повышенная ${Object.values(spec.adaptive.routes.advanced).join(' / ')}<br>Переход: ≥${spec.adaptive.routingThreshold}% взвешенного результата части 1`:`Сложность 1/2/3: ${Object.values(spec.difficultyCounts).join(' / ')}`}<br>Числовые на часть: ${spec.numericMin}–${spec.numericMax}</p><p>Junior ≥ ${spec.thresholds.Junior} · Middle ≥ ${spec.thresholds.Middle} · Senior ≥ ${spec.thresholds.Senior}</p>${button('Новая версия','assessment-spec-edit',`data-id="${m.id}"`,true)}</article>`;}).join('')}</div>`;
 if(assessmentAdminTab==='days')return head+`<p class="subtext">Пул создаётся автоматически на каждые 24 часа, с 00:00 до 00:00 по Москве. Изменения банка и спецификаций попадут в следующий пул.</p>${admin.days.filter(d=>d.schedule==='daily').map(d=>`<article class="panel assessment-day-card"><div>${badge('Зафиксирован','green')}<h2>${esc(d.name)}</h2><p>${assessmentDateTime(d.opensAt)} — ${assessmentDateTime(d.closesAt)} · пул v${d.version}</p><p>${d.moduleIds.length} модулей · ${Object.values(d.poolCounts).reduce((a,b)=>a+b,0)} вопросов</p></div></article>`).join('')||'<p>Первый суточный пул будет создан автоматически.</p>'}`;
 return head+`<p class="subtext">Статистика собирается по показанным вопросам. Группы участников определены по результатам зачётной части того же модуля: &lt;50, 50–79, ≥80. Автоматического допуска нет.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Вопрос / семейство</th><th>Показов</th><th>Верных</th><th>Пропусков</th><th>Время</th><th>По уровню участников</th></tr></thead><tbody>${admin.analytics.filter(a=>a.shown).map(a=>{const q=admin.questions.find(q=>q.id===a.id);return `<tr><td>${esc(q.prompt)}<small>${esc(q.familyId)}</small></td><td>${a.shown}</td><td>${a.correctRate===null?'—':Math.round(a.correctRate*100)+'%'}</td><td>${a.skipped}</td><td>${a.averageMs===null?'—':Math.round(a.averageMs/1000)+' с'}</td><td>${Object.entries(a.groups).map(([g,v])=>`${{low:'Низкий',medium:'Средний',high:'Высокий'}[g]}: ${v.n?Math.round(v.correct/v.n*100)+'% ('+v.n+')':'—'}`).join('<br>')}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function assessmentQuestionForm(old){const admin=assessmentAdmin,skillModule=admin.modules.find(m=>m.id===(old?.moduleId||'python'));modal(old?'Новая версия вопроса':'Добавить вопрос','Новый экземпляр сначала сохраняется как черновик.',`<form id="assessment-question-form" data-id="${old?.id||''}"><div class="form-row"><div class="field"><label for="aq-module">Модуль</label><select id="aq-module" name="moduleId">${admin.modules.map(m=>`<option value="${m.id}" ${skillModule.id===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>${field('Узкое семейство','familyId',old?.familyId||'','text','required')}</div><div class="form-row">${field('Версия шаблона','templateVersion',old?.templateVersion||1,'number','required min="1"')}${select('Сложность','difficulty',['1','2','3'],String(old?.difficulty||1))}</div><div id="assessment-competencies">${assessmentCompetencyFields(skillModule,old)}</div>${textarea('Условие (текст, код или данные)','prompt',old?.prompt||'','required rows="6" maxlength="12000"')}<div class="field"><label for="aq-format">Формат ответа</label><select id="aq-format" name="format"><option value="choice" ${old?.format!=='numeric'?'selected':''}>Один ответ из четырёх</option><option value="coding" ${old?.format==='coding'?'selected':''}>Кодинг</option><option value="numeric" ${old?.format==='numeric'?'selected':''}>Числовой ответ</option></select></div><div class="assessment-choice-fields">${[0,1,2,3].map(i=>field('Вариант '+String.fromCharCode(65+i),'option'+i,old?.options?.[i]||'')).join('')}${'<div class="field"><label for="aq-correct">Правильный вариант</label><select id="aq-correct" name="correct">'+[0,1,2,3].map(i=>'<option value="'+i+'" '+(i===(old?.correct||0)?'selected':'')+'>'+String.fromCharCode(65+i)+'</option>').join('')+'</select></div>'}</div><div class="assessment-number-fields">${field('Правильное число','expected',old?.numeric?.expected??'','text')}${field('Допустимая погрешность','tolerance',old?.numeric?.tolerance??0,'number','min="0" step="any"')}${field('Округление, знаков после запятой (пусто — без)','decimals',old?.numeric?.decimals??'','number','min="0" max="10"')}${field('Эквивалентные записи, через ;','equivalents',old?.numeric?.equivalents?.join('; ')||'')}</div><div class="assessment-coding-fields">${select('Язык','codingLanguage',['python','javascript','typescript','sql','bash','html','css','react'],old?.coding?.language||'python')}${field('Время кодинга, секунд','codingSeconds',old?.questionSeconds||600,'number','min="60" max="3600"')}${textarea('Начальный код','codingStarter',old?.coding?.starter||'','rows="6"')}${textarea('Проверки (JSON: stdin, expected, public)','codingTests',JSON.stringify(old?.coding?.tests||[{stdin:'',expected:'',public:true}],null,2),'rows="8"')}</div>${formEnd('Сохранить черновик')}</form>`,true);assessmentQuestionFormat();}
function assessmentCompetencyFields(skillModule,old){return `<fieldset class="assessment-checkboxes"><legend>Проверяемые компетенции</legend>${skillModule.competencies.map(c=>`<label><input name="competencies" type="checkbox" value="${esc(c)}" ${old?.competencies?.includes(c)?'checked':''}>${esc(assessmentModuleName(c))}</label>`).join('')}</fieldset>${skillModule.integration?`<fieldset class="assessment-checkboxes"><legend>Связанные навыки (не менее двух)</legend>${skillModule.skills.map(c=>`<label><input name="skills" type="checkbox" value="${c}" ${old?.skills?.includes(c)?'checked':''}>${esc(assessmentModuleName(c))}</label>`).join('')}</fieldset>`:''}`;}
function assessmentQuestionFormat(){const form=overlay.querySelector('#assessment-question-form');if(!form)return;const numeric=form.elements.format.value==='numeric';form.elements.expected.required=numeric;for(let i=0;i<4;i++)form.elements['option'+i].required=form.elements.format.value==='choice';form.querySelector('.assessment-choice-fields').hidden=form.elements.format.value!=='choice';form.querySelector('.assessment-number-fields').hidden=!numeric;form.querySelector('.assessment-coding-fields').hidden=form.elements.format.value!=='coding';}
function assessmentQuestionDetail(id){const q=assessmentAdmin.questions.find(q=>q.id===id),stats=assessmentAdmin.analytics.find(x=>x.id===id);modal('Карточка вопроса',`${esc(assessmentModuleName(q.moduleId))} · ${esc(q.id)}`,`<div class="assessment-bank-meta">${badge(assessmentStatusLabels[q.status])}${tag(['Сложность '+q.difficulty,'v'+q.version])}</div><pre class="assessment-prompt">${esc(q.prompt)}</pre><p>Семейство: ${esc(q.familyId)} · шаблон v${q.templateVersion}</p><p>Компетенции: ${q.competencies.map(esc).join(', ')}</p>${q.format==='coding'?`<p>Язык: ${esc(q.coding.language)} · ${q.coding.tests.length} проверок · ${q.questionSeconds||600} секунд</p><pre class="assessment-prompt">${esc(q.coding.starter)}</pre>`:q.format==='choice'?`<ol type="A">${q.options.map((option,i)=>`<li>${esc(option)} ${i===q.correct?'<strong>✓ Ключ</strong>':''}</li>`).join('')}</ol>`:`<p>Ключ: ${q.numeric.expected} · погрешность ${q.numeric.tolerance} · округление ${q.numeric.decimals??'нет'}</p>`}<p>Показов: ${stats.shown} · верных: ${stats.correct} · пропущено: ${stats.skipped}</p>${q.format==='choice'?`<p>Выбор A / B / C / D: ${stats.distractors.join(' / ')}</p>`:''}<details><summary>История решений</summary>${q.history.map(h=>`<p>${h.at?assessmentDateTime(h.at):'Исходный банк'} · ${esc(assessmentStatusLabels[h.status])} · ${esc(h.reason)}</p>`).join('')}</details><div class="assessment-actions">${button('Новая версия','assessment-question-edit',`data-id="${q.id}"`,true)}${q.status==='draft'?button('В эксперимент','assessment-question-decision',`data-id="${q.id}" data-decision="experiment"`):''}${q.status==='experimental'?button('Допустить','assessment-question-decision',`data-id="${q.id}" data-decision="admit"`)+button('Продолжить сбор данных','assessment-question-decision',`data-id="${q.id}" data-decision="collect"`,true):''}${['draft','experimental'].includes(q.status)?button('Отклонить','assessment-question-decision',`data-id="${q.id}" data-decision="reject"`,true):''}${q.status==='working'?button('В архив','assessment-question-decision',`data-id="${q.id}" data-decision="retire"`,true):''}</div>`,true);}
function assessmentDecision(id,decision){modal('Решение по вопросу',assessmentStatusLabels[{experiment:'experimental',admit:'working',collect:'experimental',reject:'rejected',retire:'retired'}[decision]],`<form id="assessment-decision-form" data-id="${id}" data-decision="${decision}">${textarea('Обоснование решения','reason','','required minlength="10" rows="4"')}${decision==='experiment'?'<label class="check-row"><input name="reviewed" type="checkbox" required>Проверены условие, однозначность ответа, ключ и компетенции</label>':''}${decision==='admit'?select('Назначенная сложность','difficulty',['1','2','3'],'2'):''}<p class="subtext">Решение применяется к будущим пулам. Старые попытки и их зачётность не изменятся.</p>${formEnd('Сохранить решение')}</form>`);}
function assessmentSpecForm(moduleId){const spec=assessmentAdmin.specifications.filter(s=>s.moduleId===moduleId).sort((a,b)=>b.version-a.version||(b.created||0)-(a.created||0))[0];modal('Новая версия спецификации',assessmentModuleName(moduleId),`<form id="assessment-spec-form" data-id="${moduleId}"><div class="form-row"><p>Две части по 16 зачётных вопросов. Ветвление после первой части фиксируется в версии спецификации.</p><input name="scoredCount" type="hidden" value="32">${field('Время на каждый вопрос, секунд','questionSeconds',spec.questionSeconds||20,'number','required min="1" max="3600"')}</div><p class="subtext">Сложность 1/2/3: первая часть 5/6/5, вторая 8/6/2 либо 2/6/8. Порог повышенной ветки: 65% взвешенных баллов первой части. Балл модуля учитывает сложность по фиксированной шкале.</p><div class="form-row">${field('Минимум числовых на часть','numericMin',spec.numericMin,'number','required min="0"')}${field('Максимум числовых на часть','numericMax',spec.numericMax,'number','required min="0"')}</div><p class="subtext">Экспериментальные вопросы получают такой же лимит времени.</p><div class="form-row">${['Junior','Middle','Senior'].map(g=>field('Порог '+g,g,spec.thresholds[g],'number','required min="1" max="100"')).join('')}</div><p class="subtext">Обычный модуль имеет одну спецификацию для отдельных и комплексных тестов.</p><div class="form-row">${field('Заданий на кодинг после второй части','codingCount',spec.codingCount||0,'number','min="0" max="3"')}${field('Время каждого задания, секунд','codingSeconds',spec.codingSeconds||600,'number','min="60" max="3600"')}</div>${formEnd('Сохранить версию')}</form>`,true);}
function assessmentDayForm(old){const start=new Date(old?.opensAt||Date.now()+5*60000),end=new Date(old?.closesAt||Date.now()+24*3600000),local=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);modal('Создать пул тестового дня','Набор вопросов фиксируется перед началом сессии.',`<form id="assessment-day-form" data-id="${old?.id||''}">${field('Название','name',old?.name||'Тестовая сессия','text','required')}<div class="form-row">${field('Начало','opensAt',local(start),'datetime-local','required')}${field('Конец','closesAt',local(end),'datetime-local','required')}</div>${field('Ожидаемое число участников','expectedCandidates',old?.expectedCandidates||100,'number','required min="1" max="100000"')}${field('Перерыв между модулями, секунд','breakSeconds',old?.breakSeconds||0,'number','min="0" max="3600"')}${textarea('Разрешённые инструменты','tools',old?.tools||'Без внешних инструментов','required')}<fieldset class="assessment-checkboxes"><legend>Доступные модули и экспериментальные позиции</legend>${assessmentAdmin.modules.map(m=>`<label><input name="moduleIds" value="${m.id}" type="checkbox" ${!old||old.moduleIds.includes(m.id)?'checked':''}>${esc(m.name)}<input name="experimental-${m.id}" type="number" min="0" max="10" value="${old?.experimentalCounts[m.id]||0}" aria-label="Экспериментальных позиций ${esc(m.name)}"></label>`).join('')}</fieldset><label class="check-row"><input name="automaticPool" type="checkbox" ${old?'':'checked'}>Подобрать пул по спецификациям и частоте показов</label><details class="assessment-pool-picker"><summary>Выбрать конкретные вопросы пула</summary><div class="assessment-checkboxes">${assessmentAdmin.questions.filter(q=>['working','experimental'].includes(q.status)).map(q=>`<label data-pool-module="${q.moduleId}"><input name="questionIds" type="checkbox" value="${q.id}" ${!old||old.questionIds.includes(q.id)?'checked':''}>${esc(assessmentModuleName(q.moduleId))} · ${esc(q.prompt)} (${q.difficulty}, ${assessmentStatusLabels[q.status]})</label>`).join('')}</div></details><p class="subtext">Автоматический подбор включает первую часть, обе ветки второй части по каждой спецификации, резерв зачётных вопросов и нужные экспериментальные позиции. Для ручной сборки снимите переключатель и выберите конкретные вопросы. Ноль экспериментальных позиций допустим. Перед фиксацией сервер проверит возможность собрать варианты.</p>${formEnd('Создать черновик пула')}</form>`,true);}
async function assessmentAdminMutate(body){const r=await mutate(body);if(r){assessmentAdmin=(await api({action:'maintainer-state'})).admin;render();}return r;}
function assessmentHistoryDetail(id){const h=assessmentConfig().history.find(h=>h.id===id);if(!h)return;modal('Результаты тестирования',esc(h.name)+' · '+date(h.created),assessmentResultRows(h.results)+`<p>Пул v${h.dayVersion} · ${esc(assessmentStatusLabels[h.status])}</p>${h.targetKind==='role'&&h.status==='active'?'<p>Результаты модулей появятся после завершения всего комплексного теста.</p>':''}${h.roleResult?`<h3>${h.status==='active'?'Тест в процессе':h.roleResult.completed?assessmentRoleOutcome(h.roleResult):'Незавершённый тест роли'}</h3><p>Для уровня роли требуется выполнить пороги каждого обязательного модуля и интеграционного блока.</p>`:''}<ul>${h.results.map(r=>`<li>${esc(r.name)}: ${r.score}/100; Junior ≥ ${r.thresholds.Junior}, Middle ≥ ${r.thresholds.Middle}, Senior ≥ ${r.thresholds.Senior}. Спецификация v${r.specVersion}.</li>`).join('')}</ul>${h.status!=='active'?button('Удалить из истории','assessment-history-hide',`data-id="${h.id}"`,true):''}`,true);}
// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assessmentHandleAction(el){const actionName=el.dataset.action;if(!actionName?.startsWith('assessment-'))return false;const id=el.dataset.id;try{switch(actionName){
 case 'assessment-result-visibility':el.disabled=true;try{await mutate({action:actionName,id,targetId:el.dataset.targetId,targetKind:el.dataset.targetKind,hidden:el.dataset.hidden==='true'});}finally{el.disabled=false;}break;
 case 'assessment-history':assessmentHistoryDetail(id);break;
 case 'assessment-history-hide':{const response=await mutate({action:'assessment-history-hide',id});if(response&&assessmentAttempt?.id===id){assessmentAttempt=null;assessmentRenderKey=null;render();}break;}
 case 'assessment-history-restore':await mutate({action:'assessment-history-restore',id});break;
 case 'assessment-book':assessmentBook(id);break;
 case 'assessment-book-kind':if(assessmentBooking){assessmentBooking.kind=el.dataset.kind==='role'?'role':'skill';assessmentBookingRender();}break;
 case 'assessment-book-target':assessmentPreparation=null;go('tests/start/'+encodeURIComponent(id));break;
 case 'assessment-selection-back':assessmentPreparation=null;go('tests');break;
 case 'assessment-prepare-retry':assessmentPreparation=null;render();break;
 case 'assessment-cancel-registration':await mutate({action:'assessment-cancel-registration',id});break;
 case 'assessment-question-next':await assessmentConfirm(true);break;
 case 'assessment-toggle-timer':timerHidden=!timerHidden;render();break;
 case 'assessment-eliminate':{const i=Number(el.dataset.index);if(assessmentSaving)break;if(eliminatedAnswers.has(i))eliminatedAnswers.delete(i);else{eliminatedAnswers.add(i);if(assessmentDraft===i){assessmentDraft=null;assessmentQueueDraft();}}render();break;}
 case 'assessment-next-module':await assessmentQueue('assessment-next-module');break;
 case 'assessment-exit':modal('Завершить попытку?','Закрытые модули останутся в истории. Незавершённый модуль не получит результат.',`<div class="modal-actions">${button('Продолжить','close','',true)}${button('Завершить попытку','assessment-abandon')}</div>`);break;
 case 'assessment-abandon':close();await assessmentQueue('assessment-abandon');await refresh();break;
 case 'assessment-finish':assessmentAttempt=null;assessmentPreparation=null;assessmentRenderKey=null;await refresh();go('tests');break;
 case 'assessment-admin-tab':assessmentAdminTab=id;render();break;
 case 'assessment-code-run':await assessmentCodeRun();break;
 case 'assessment-code-reset':{const q=assessmentAttempt.currentModule.questions[assessmentQuestion];assessmentDraft=q.coding.starter;assessmentQueueDraft();render();break;}
 case 'assessment-code-preview':assessmentCodePreview();break;
 case 'assessment-question-new':assessmentQuestionForm();break;
 case 'assessment-question-detail':assessmentQuestionDetail(id);break;
 case 'assessment-question-edit':assessmentQuestionForm(assessmentAdmin.questions.find(q=>q.id===id));break;
 case 'assessment-question-decision':assessmentDecision(id,el.dataset.decision);break;
 case 'assessment-spec-edit':assessmentSpecForm(id);break;
 case 'assessment-day-new':assessmentDayForm();break;
 case 'assessment-day-edit':assessmentDayForm(assessmentAdmin.days.find(d=>d.id===id));break;
 case 'assessment-day-publish':await assessmentAdminMutate({action:'maintainer-day-publish',id});break;
 } }catch(e){toast(e.message);}return true;}
// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assessmentHandleSubmit(form,data){if(!form.id.startsWith('assessment-'))return false;switch(form.id){
 case 'assessment-start-form':{try{const r=await api({action:'assessment-start',targetId:form.dataset.targetId,rulesAccepted:form.elements.accepted.checked,...(form.elements.targetGrade?{targetGrade:form.elements.targetGrade.value}:{})});assessmentPreparation=null;assessmentAccept(r.assessment);close();page='tests';location.hash='tests';render();}catch(e){form.querySelector('[data-error]').textContent=e.message;}break;}
 case 'assessment-answer-form':await assessmentConfirm();break;
 case 'assessment-question-form':{let coding;try{coding=form.elements.codingTests?{language:data.codingLanguage,starter:data.codingStarter,tests:JSON.parse(data.codingTests||'[]')}:undefined;}catch{form.querySelector('[data-error]').textContent='Проверки должны быть JSON-массивом.';break;}const numeric={expected:String(data.expected).trim()===''?null:Number(String(data.expected).replace(',','.')),tolerance:Number(data.tolerance),decimals:data.decimals===''?null:Number(data.decimals),equivalents:(data.equivalents||'').split(';').map(s=>s.trim()).filter(Boolean)};await assessmentAdminMutate({action:'maintainer-question-save',id:form.dataset.id||null,question:{...data,coding,questionSeconds:Number(data.codingSeconds||600),options:[0,1,2,3].map(i=>data['option'+i]),correct:Number(data.correct),difficulty:Number(data.difficulty),competencies:[...form.querySelectorAll('[name="competencies"]:checked')].map(el=>el.value),skills:[...form.querySelectorAll('[name="skills"]:checked')].map(el=>el.value),numeric}});break;}
 case 'assessment-decision-form':await assessmentAdminMutate({action:'maintainer-question-decision',id:form.dataset.id,decision:form.dataset.decision,...data,reviewed:!!form.elements.reviewed?.checked,difficulty:Number(data.difficulty)});break;
 case 'assessment-spec-form':await assessmentAdminMutate({action:'maintainer-spec-save',spec:{...data,adaptive:true,moduleId:form.dataset.id,difficultyCounts:Object.fromEntries([1,2,3].map(k=>[k,Number(data['difficulty'+k])])),thresholds:Object.fromEntries(['Junior','Middle','Senior'].map(k=>[k,Number(data[k])]))}});break;
 case 'assessment-day-form':await assessmentAdminMutate({action:'maintainer-day-save',...data,id:form.dataset.id||null,opensAt:new Date(data.opensAt).getTime(),closesAt:new Date(data.closesAt).getTime(),moduleIds:[...form.querySelectorAll('[name="moduleIds"]:checked')].map(el=>el.value),questionIds:form.elements.automaticPool.checked?undefined:[...form.querySelectorAll('[name="questionIds"]:checked')].map(el=>el.value),experimentalCounts:Object.fromEntries(assessmentAdmin.modules.map(m=>[m.id,Number(data['experimental-'+m.id])]))});break;
 }return true;}
document.addEventListener('input',e=>{if(e.target.name==='assessmentCode'&&!assessmentSaving){assessmentDraft=e.target.value;const lines=app.querySelector('.coding-line-numbers');if(lines)lines.textContent=assessmentDraft.split('\n').map((_,i)=>i+1).join('\n');assessmentQueueDraft(600);const confirm=app.querySelector('.exam-check');if(confirm)confirm.disabled=!assessmentDraft.trim();return;}if(e.target.name==='assessmentNumeric'&&!assessmentSaving){assessmentDraft=e.target.value;assessmentQueueDraft(250);const confirm=app.querySelector('.exam-check');if(confirm)confirm.disabled=assessmentSaving||!e.target.value.trim();const error=app.querySelector('[data-error]');if(error)error.textContent='';}});
// Called by mvp.js, which shares this module in the generated client bundle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assessmentHandleChange(e){const el=e.target;if(el.name==='assessmentAnswer'){assessmentSaveAnswer(Number(el.value));return true;}if(el.form?.id==='assessment-start-form'&&assessmentPreparation){if(el.name==='targetGrade')assessmentPreparation.targetGrade=el.value;if(el.name==='accepted')assessmentPreparation.accepted=el.checked;return true;}if(el.dataset.assessmentFilter){if(el.dataset.assessmentFilter==='module')assessmentModuleFilter=el.value;if(el.dataset.assessmentFilter==='status')assessmentStatusFilter=el.value;if(el.dataset.assessmentFilter==='query')assessmentQuestionQuery=el.value;render();return true;}if(el.form?.id==='assessment-day-form'&&el.name==='questionIds'){el.form.elements.automaticPool.checked=false;return true;}if(el.form?.id==='assessment-day-form'&&el.name==='moduleIds'){for(const row of el.form.querySelectorAll('[data-pool-module]'))row.hidden=!Array.from(el.form.querySelectorAll('[name="moduleIds"]:checked')).some(c=>c.value===row.dataset.poolModule);return true;}if(el.form?.id==='assessment-question-form'){if(el.name==='moduleId'){const skillModule=assessmentAdmin.modules.find(m=>m.id===el.value);overlay.querySelector('#assessment-competencies').innerHTML=assessmentCompetencyFields(skillModule);}if(el.name==='format')assessmentQuestionFormat();return true;}return false;}
document.addEventListener('keydown',e=>{if(assessmentExamActive()&&!overlay.firstElementChild&&document.activeElement?.name==='assessmentCode'&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void assessmentCodeRun();return;}if(!assessmentExamActive()||overlay.firstElementChild||e.ctrlKey||e.metaKey||e.altKey)return;const q=assessmentAttempt.currentModule.questions[assessmentQuestion];if(q.format==='coding'){if(document.activeElement?.name==='assessmentCode'&&e.key==='Tab'){e.preventDefault();const el=document.activeElement;el.setRangeText('  ',el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}return;}if(q.format==='choice'&&/^[1-4]$/.test(e.key)&&!eliminatedAnswers.has(Number(e.key)-1)){e.preventDefault();assessmentSaveAnswer(Number(e.key)-1);}else if(e.key==='Enter'&&!e.repeat&&document.activeElement?.tagName!=='BUTTON'){e.preventDefault();app.querySelector('#assessment-answer-form')?.requestSubmit();}});

function assessmentGradePicker(grade){return `<fieldset class="assessment-grade-picker"><legend>Целевой грейд</legend>${['Junior','Middle','Senior'].map(g=>`<label><input type="radio" name="targetGrade" value="${g}" ${g===grade?'checked':''}><span>${g}</span></label>`).join('')}</fieldset>`;}
function assessmentRoleOutcome(r){
 if(!r.targetGrade)return esc(r.level);
 const grade=esc(r.confirmedGrade||r.targetGrade)+(r.confirmedPlus?'+':'');
 if(r.status==='unconfirmed-lower'||r.status==='unconfirmed')return `${esc(r.targetGrade)} не подтверждён${r.confirmedGrade?` · подтверждён ${grade}`:''}`;
 return `${grade} подтверждён${r.potentialHigher?` · потенциал ${esc(r.potentialHigher)}`:''}`;
}

let assessmentCodeOutput=null;
function assessmentCodingMarkup(q,answer){const code=typeof answer==='string'?answer:q.coding.starter;return `<div class="coding-workspace"><div class="coding-toolbar"><span>${esc(q.coding.language)}</span><div><button type="button" data-action="assessment-code-reset">Сбросить</button><button type="button" data-action="assessment-code-run">Запустить</button>${['html','css','react'].includes(q.coding.language)?'<button type="button" data-action="assessment-code-preview">Предпросмотр</button>':''}</div></div><div class="coding-editor-wrap"><pre class="coding-line-numbers" aria-hidden="true">${String(code).split('\n').map((_,i)=>i+1).join('\n')}</pre><textarea class="coding-editor" name="assessmentCode" aria-label="Редактор кода" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(code)}</textarea></div><div class="coding-console" role="status" aria-live="polite">${assessmentCodeOutput?.key===assessmentDraftKey()?esc(assessmentCodeOutput.text):'Открытые проверки и вывод программы появятся здесь.'}</div></div>`;}
async function assessmentCodeRun(){const q=assessmentAttempt.currentModule.questions[assessmentQuestion],key=assessmentDraftKey(),source=app.querySelector('[name=assessmentCode]').value;const output=app.querySelector('.coding-console'),runButton=app.querySelector('[data-action=assessment-code-run]');if(runButton.disabled)return;runButton.disabled=true;output.textContent='Запускаем…';try{await assessmentFlushDraft();const r=await api({action:'assessment-run-code',id:assessmentAttempt.id,revision:assessmentAttempt.revision,questionId:q.id,source});if(key!==assessmentDraftKey())return;const text=r.run.results.map(t=>`Проверка ${t.index}: ${t.passed?'пройдена':'не пройдена'}\n${t.stdout||''}${t.stderr?'\n'+t.stderr:''}`).join('\n\n');assessmentCodeOutput={key,text,html:r.run.results[0]?.stdout};output.textContent=text;}catch(e){output.textContent=e.message;}finally{runButton.disabled=false;}}
function assessmentCodePreview(){const q=assessmentAttempt.currentModule.questions[assessmentQuestion],source=app.querySelector('[name=assessmentCode]').value;const html=q.coding.language==='react'?assessmentCodeOutput?.key===assessmentDraftKey()?assessmentCodeOutput.html:null:q.coding.language==='css'?`<style>${source}</style><main><h1>Предпросмотр</h1><p>Текст</p><div class="toolbar"><button>Первый</button><button>Второй</button></div></main>`:source;if(!html){toast('Сначала запустите код.');return;}modal('Предпросмотр','',`<iframe class="coding-preview" sandbox="" title="Предпросмотр результата" srcdoc="${esc('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">'+html)}"></iframe>`,true);}

document.addEventListener('scroll',e=>{if(e.target?.name==='assessmentCode'){const lines=app.querySelector('.coding-line-numbers');if(lines)lines.scrollTop=e.target.scrollTop;}},true);
