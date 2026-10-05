import {publicFspProfile} from './fsp.mjs';
export const SPECS=['Backend','Frontend','Data Science','DevOps','QA'];
export const GRADES=['Junior','Middle','Senior'];
export const COOLDOWN=90*86400000;
export class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
export const requireValue=(condition,message,status=400)=>{if(!condition)throw new ApiError(status,message);};
export function text(value,max=2000){return String(value??'').trim().slice(0,max);}
export function salaryRange(body){const min=Number(body.min),max=Number(body.max);requireValue(Number.isInteger(min)&&Number.isInteger(max)&&min>0&&max>=min&&max<=10000000,'Укажите корректную зарплату от–до в рублях.');return {min,max};}
export function parseNeed(input){
 const source=text(input),t=source.toLowerCase();
 const specRules=[
  ['Frontend',/frontend|front-end|фронт|react|typescript/],
  ['DevOps',/devops|девопс|sre|kubernetes|инфраструктур/],
  ['Data Science',/data science|data scientist|\bml\b|pytorch|машинн|аналитик данных/],
  ['QA',/\bqa\b|quality assurance|тестиров|pytest/],
  ['Backend',/backend|back-end|бэкенд|бекенд|серверн|fastapi|postgresql/]
 ];
 const gradeRules=[
  ['Senior',/senior|сеньор|старш|ведущ/],
  ['Junior',/junior|джун|начинающ|стаж[её]р/],
  ['Middle',/middle|мидл|средн(?:ий|его) уровень/]
 ];
 const detectedSpecs=specRules.filter(([,pattern])=>pattern.test(t)).map(([spec])=>spec);
 const detectedGrades=gradeRules.filter(([,pattern])=>pattern.test(t)).map(([grade])=>grade);
 const tech=['Python','PostgreSQL','Docker','React','TypeScript','SQL','Go','Pytest','Kubernetes','Linux','PyTorch','JavaScript','CSS','FastAPI'];
 const stack=tech.filter(x=>new RegExp('(^|[^a-z])'+x.toLowerCase()+'([^a-z]|$)','i').test(t));
 const quote=pattern=>source.match(new RegExp(pattern.source,pattern.flags.replace('g','')+(pattern.flags.includes('i')?'':'i')))?.[0]||'';
 const evidence=[...specRules.filter(([,p])=>p.test(t)).map(([value,p])=>({field:'Специализация',value,quote:quote(p)})),...gradeRules.filter(([,p])=>p.test(t)).map(([value,p])=>({field:'Уровень',value,quote:quote(p)})),...stack.map(value=>({field:'Технология',value,quote:source.match(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'))?.[0]||value}))];
 return {spec:detectedSpecs.length===1?detectedSpecs[0]:null,grade:detectedGrades.length===1?detectedGrades[0]:null,stack,text:source,evidence,ambiguous:{spec:detectedSpecs.length>1,grade:detectedGrades.length>1}};
}
export function matching(c,need){
 const matched=c.stack.filter(x=>need.stack.some(y=>y.toLowerCase()===x.toLowerCase()));
 const achievements=c.fsp?.achievements?.length||0;
 const parts={specialization:c.spec===need.spec?30:0,grade:c.grade===need.grade?20:0,stack:need.stack.length?Math.round(matched.length/need.stack.length*20):0,test:Math.round(c.score*.2),fsp:Math.min(10,achievements*5)};
 return {score:Object.values(parts).reduce((a,b)=>a+b,0),parts,reasons:[c.spec===need.spec?'Совпадает подтверждённая специализация':'Другая специализация',c.grade===need.grade?'Совпадает подтверждённый грейд':'Подтверждён '+c.grade,need.stack.length?(matched.length?'Совпадают '+matched.join(', '):'Нет совпадений по указанным технологиям'):'Технологии не заданы',`Результат теста ${c.score}/100`,achievements?`Подтверждены достижения ФСП: ${achievements}`:'Нет подтверждённых достижений ФСП'],matched};
}
export function publicCandidate(account,contactAllowed=false){const p=account.profile,competencies=p.competencies?.length?p.competencies:(account.synthetic&&p.skills?.length?p.skills.map(([name,score])=>({name,status:score>=85?'confirmed':'development',source:'Демонстрационный тест',verifiedAt:p.verifiedAt,score})):[]);return {id:account.id,name:p.name,city:p.city,spec:p.spec,grade:p.grade,stack:p.stack,roles:p.roles||[],softSkills:p.softSkills||[],competencies,score:p.score,min:p.min,max:p.max,experience:p.experience,about:p.about,education:p.education,work:p.work,format:p.format,verified:p.verified,verifiedAt:p.verifiedAt,updated:p.updated,fsp:account.privacy?.fspVisible===false?null:publicFspProfile(p.fsp),synthetic:!!account.synthetic,email:contactAllowed?account.email:undefined,phone:contactAllowed?p.phone:undefined};}
// A fixed blueprint per specialization and grade limits uncontrolled difficulty drift.
// Templates vary scenario data and option ordering. Correct answers stay on the server.
const BANK={
 Backend:[
 ['HTTP','Какой HTTP-метод подходит для чтения ресурса без изменения состояния?',['GET','POST','PATCH','DELETE'],0,'GET — безопасный метод получения ресурса.'],
 ['SQL','Как предотвратить SQL-инъекцию при поиске по пользовательскому вводу?',['Параметризовать запрос','Удалить пробелы','Скрыть текст запроса','Использовать GET'],0,'Параметры отделяют данные от структуры SQL.'],
 ['Транзакции','Две транзакции читают остаток и записывают уменьшенное значение. Что предотвращает потерянное обновление?',['Атомарное UPDATE или блокировка строки','Кеш на клиенте','Асинхронная запись без проверки','Увеличение таймаута'],0,'Проверка и изменение должны выполняться атомарно.'],
 ['Надёжность','Платёжный запрос повторился после таймаута. Как избежать двойного списания?',['Ключ идемпотентности с атомарным сохранением результата','Повторить без изменений','Увеличить размер пула','Запретить все повторные запросы'],0,'Один ключ должен соответствовать одному логическому платежу.'],
 ['Архитектура','Изменение в БД и событие в брокер должны согласоваться. Какой подход уменьшает риск потери события?',['Transactional outbox','Сначала отправить и забыть','Два независимых запроса','Только логировать ошибки'],0,'Outbox сохраняется в той же транзакции, затем публикуется с повторными попытками.'],
 ['Распределённые системы','Сообщения доставляются как минимум один раз. Что требуется обработчику?',['Идемпотентность и дедупликация','Предположение о единственной доставке','Отсутствие подтверждений','Случайная задержка'],0,'Повторная доставка не должна повторять бизнес-эффект.']],
 Frontend:[
 ['HTML','Как сделать элемент действия доступным с клавиатуры?',['Использовать button с понятным названием','Использовать div только с onclick','Скрыть outline для всех','Поставить tabindex=-1'],0,'Нативная кнопка уже поддерживает фокус и клавиатуру.'],
 ['JavaScript','Что возвращает async-функция?',['Promise','Всегда undefined','Только строку','Поток ОС'],0,'async всегда оборачивает результат в Promise.'],
 ['React','Зачем нужен стабильный key при перестановке списка?',['Сохранить идентичность элементов','Добавить CSS-класс','Изменить сортировку','Увеличить частоту рендера'],0,'Стабильный ключ связывает компонент с записью.'],
 ['Состояние','Старый поисковый запрос завершился после нового. Как избежать устаревшей выдачи?',['Отменить старый запрос или проверить идентификатор ответа','Всегда применить последний полученный ответ','Хранить всё в DOM','Увеличить задержку'],0,'Порядок ответа не гарантирует порядок запроса.'],
 ['Производительность','Пакет интерфейса слишком велик. Как уменьшить начальную загрузку?',['Разделять код по маршрутам и загружать по требованию','Включить весь код в первый chunk','Заменить все функции классами','Отключить кеш HTTP'],0,'Code splitting уменьшает объём начального исполнения.'],
 ['Архитектура','Как безопасно разделить серверное и клиентское состояние?',['Кешировать серверные данные с явной инвалидацией','Копировать каждый ответ в глобальный store навсегда','Использовать только localStorage','Не обрабатывать повторные запросы'],0,'У серверного состояния отдельный жизненный цикл и политика актуальности.']],
 'Data Science':[
 ['Данные','На каком наборе оценивают обобщающую способность модели?',['Отложенном наборе','Только обучающем','Случайных прогнозах','Данных без целевой переменной'],0,'Оценка требует данных, не использованных для обучения.'],
 ['Метрики','При редком положительном классе какая метрика информативнее простой accuracy?',['Precision/recall и PR-AUC','Только accuracy','Размер файла','Число признаков'],0,'Accuracy может скрывать полный пропуск редкого класса.'],
 ['Утечка','Когда следует обучать преобразование признаков в cross-validation?',['Отдельно на train каждого fold','На всём датасете заранее','На test','После подсчёта метрики'],0,'Предобработка на всех данных передаёт информацию из validation.'],
 ['Эксперимент','Как сравнить две версии рекомендательной модели в продукте?',['Рандомизированным A/B-тестом с заранее выбранной метрикой','По одному удачному примеру','По train-loss','По личному впечатлению'],0,'Случайное назначение помогает оценить причинный эффект.'],
 ['Временные данные','Как валидировать прогноз будущего спроса?',['Разделением по времени без информации из будущего','Случайно перемешать строки','Взять только последние прогнозы','Использовать target как признак'],0,'Временное разбиение отражает реальный сценарий применения.'],
 ['Продакшен','Какие сигналы нужны при мониторинге модели?',['Дрейф данных, качество при доступной разметке и задержки','Только число строк','Только train-loss','Только имя модели'],0,'Рабочая модель требует мониторинга данных, качества и эксплуатации.']],
 DevOps:[
 ['Linux','Как ограничить доступ к секретному файлу?',['Минимально необходимыми правами','chmod 777','Публичным каталогом','Переименованием файла'],0,'Имя файла не заменяет контроль доступа.'],
 ['Контейнеры','Зачем фиксировать версию образа или digest?',['Для воспроизводимости развёртывания','Чтобы image всегда обновлялся сам','Чтобы отключить сеть','Чтобы скрыть исходники'],0,'latest может указывать на разные версии.'],
 ['Kubernetes','Что проверяет readiness probe?',['Готовность обслуживать трафик','Только существование образа','Размер диска','Пароль пользователя'],0,'Неготовый pod исключается из endpoint сервиса.'],
 ['CI/CD','Что помогает безопасно откатить неудачный релиз?',['Версионированные артефакты и проверенная процедура rollback','Редактирование сервера вручную','Удаление журналов','Повторный релиз без проверки'],0,'Откат должен быть воспроизводимым и проверенным.'],
 ['SRE','На что опираться при выборе alert для сервиса?',['Пользовательские SLI/SLO и расход error budget','Любое изменение CPU','Только число pod','Все сообщения логов'],0,'Сигнал должен отражать влияние на пользователей.'],
 ['Инфраструктура','Как применять изменение Terraform в общей среде?',['Проверить plan, использовать lock и ревью','Вручную менять state','Запустить apply параллельно всем','Удалить state'],0,'Состояние и конкурентные изменения требуют контроля.']],
 QA:[
 ['Тест-дизайн','Какие значения особенно полезны для проверки диапазона?',['Границы и соседние значения','Только середина','Только случайные строки','Только максимальное'],0,'Ошибки часто возникают на границах диапазона.'],
 ['API','Что нужно проверять кроме HTTP-статуса?',['Тело, схему и бизнес-эффект','Только время дня','Только имя endpoint','Ничего'],0,'Успешный статус не гарантирует правильный результат.'],
 ['Автоматизация','Как уменьшить нестабильность UI-теста?',['Ждать конкретное состояние вместо фиксированного sleep','Добавить случайный sleep','Игнорировать все ошибки','Проверять только заголовок'],0,'Ожидание наблюдаемого состояния устойчивее таймера.'],
 ['Приоритеты','Как выбрать набор регрессионных тестов при ограниченном времени?',['По риску и изменениям продукта','По алфавиту','Только самые быстрые','Случайно'],0,'Риск учитывает вероятность и ущерб ошибки.'],
 ['Контракты','Зачем consumer-driven contract tests?',['Проверять совместимость ожиданий клиента и API','Заменить все интеграционные тесты','Проверять цвета','Измерять длину URL'],0,'Контракт выявляет несовместимые изменения интерфейса.'],
 ['Стратегия','Как оценивать покрытие тестовой стратегии?',['По рискам, требованиям и уровням проверок','Только числом тестов','Только строками кода','Только процентом passed'],0,'Число тестов само по себе не показывает покрытие рисков.']]
};
function shuffle(items){return items.map(value=>({value,n:crypto.getRandomValues(new Uint32Array(1))[0]})).sort((a,b)=>a.n-b.n).map(x=>x.value);}
export function makeTest(spec,grade){
 requireValue(SPECS.includes(spec)&&GRADES.includes(grade),'Выберите специализацию и грейд.');
 const level=GRADES.indexOf(grade),rows=BANK[spec],start=level;
 const questions=[start,start+1,start+2,start+3].map(i=>{const row=rows[i],choices=shuffle(row[2].map((label,index)=>({label,index})));return {id:crypto.randomUUID(),topic:row[0],prompt:row[1],options:choices.map(x=>x.label),correct:choices.findIndex(x=>x.index===row[3]),explanation:row[4]};});
 const random=()=>10+crypto.getRandomValues(new Uint32Array(1))[0]%40;
 const numeric=(topic,prompt,expected,explanation)=>{const options=shuffle([...new Set([expected,expected+1,expected+3,Math.max(0,expected-2)])].map(String));return {id:crypto.randomUUID(),topic,prompt,options,correct:options.indexOf(String(expected)),explanation};};
 const users=random(),rate=level+2;
 questions.push(numeric('Оценка нагрузки',`${users} пользователей выполняют по ${rate} запроса в секунду. Какова общая нагрузка без учёта повторов?`,users*rate,'Число пользователей умножается на частоту запросов.'));
 const n=random();
 if(spec==='Backend')questions.push(numeric('Пагинация',`Размер страницы ${n}. Какой OFFSET нужен для страницы ${level+3}, если первая страница имеет номер 1?`,n*(level+2),'OFFSET = (номер страницы − 1) × размер страницы.'));
 if(spec==='Frontend')questions.push(numeric('Компоновка',`В строке ${level+3} карточки шириной ${n*10} px, зазор между ними 10 px. Какова общая ширина строки?`,(level+3)*n*10+(level+2)*10,'Складываем ширины карточек и зазоры, которых на один меньше.'));
 if(spec==='Data Science')questions.push(numeric('Precision',`Классификатор выдал ${n*2} положительных прогнозов, из которых ${n} верны. Какова precision в процентах?`,50,'Precision = TP / (TP + FP). Половина положительных прогнозов верна.'));
 if(spec==='DevOps')questions.push(numeric('Реплики',`Сервис имеет ${level+3} реплики. Каждая выдерживает ${n*10} запросов/с. Одну реплику отключили. Какова суммарная пропускная способность оставшихся?`,(level+2)*n*10,'Число работающих реплик умножается на их индивидуальную ёмкость.'));
 if(spec==='QA')questions.push(numeric('Границы',`Поле принимает целые числа от ${n} до ${n+20}. Каково ближайшее недопустимое значение выше верхней границы?`,n+21,'Для включённой верхней границы первое недопустимое число равно границе + 1.'));
 return {id:crypto.randomUUID(),spec,grade,version:'blueprint-1',questions,created:Date.now(),expires:Date.now()+20*60000};
}
export function testView(test){return {...test,questions:test.questions.map(({correct,explanation,expected,...q})=>q)};}
export function gradeTest(test,answers){requireValue(Date.now()<=test.expires,'Время теста закончилось. Начните новую попытку.');requireValue(Array.isArray(answers)&&answers.length===test.questions.length&&answers.every((a,i)=>Number.isInteger(a)&&a>=0&&a<test.questions[i].options.length),'Ответьте на все вопросы.');const correct=answers.filter((a,i)=>a===test.questions[i].correct).length,score=Math.round(correct/test.questions.length*100);return {score,correct,total:test.questions.length,passed:score>=67,feedback:test.questions.map((q,i)=>({topic:q.topic,correct:answers[i]===q.correct,explanation:q.explanation}))};}
