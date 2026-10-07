import {reviewedQuestionBank} from './question-bank-review.mjs';
import {BANK} from './domain.mjs';
import {BANK_EXPANSION} from './question-bank-expansion.mjs';
import {mixedCodingSpec} from './adaptive-testing.mjs';
import {BANK_100_QUESTIONS} from './question-bank-100.mjs';
export const MODULES=[
 ['python','Python',['Семантика Python','Коллекции и итераторы','Надёжность кода']],
 ['javascript','JavaScript/TypeScript',['Язык и типы','Асинхронность','Управление данными']],
 ['sql','SQL',['Выборки','Соединения и агрегация','Транзакции']],
 ['browser','HTML/CSS и браузер',['Разметка и доступность','Компоновка','Браузер и безопасность']],
 ['react','React',['Компоненты','Состояние и эффекты','Архитектура интерфейса']],
 ['backend','Backend/API',['HTTP и API','Согласованность','Надёжность сервисов']],
 ['statistics','Статистика и анализ данных',['Описательная статистика','Эксперименты','Выводы по данным']],
 ['ml','Машинное обучение',['Обучение и валидация','Метрики','Обобщение']],
 ['ml-engineering','ML Engineering',['Пайплайны','Serving','Эксплуатация моделей']],
 ['infrastructure','Инфраструктура',['Linux и контейнеры','Развёртывание','Надёжность инфраструктуры']],
 ['test-design','Тест-дизайн',['Техники проектирования','Проверка требований','Стратегия и риски']],
 ['automation','Автоматизация тестирования',['Автотесты','Изоляция и данные','Контракты и CI']],
].map(([id,name,competencies])=>({id,name,competencies,integration:false}));
export const ROLES=[
 {id:'backend-developer',name:'Backend Developer',spec:'Backend',modules:['python','sql','backend'],integration:'integration-backend'},
 {id:'frontend-developer',name:'Frontend Developer',spec:'Frontend',modules:['javascript','browser','react'],integration:'integration-frontend'},
 {id:'qa-engineer',name:'QA Engineer',spec:'QA',modules:['test-design','sql','automation'],integration:'integration-qa'},
 {id:'devops-engineer',name:'DevOps Engineer',spec:'DevOps',modules:['infrastructure','python'],integration:'integration-devops'},
 {id:'data-scientist',name:'Data Scientist',spec:'Data Science',modules:['python','sql','statistics','ml'],integration:'integration-ds'},
 {id:'ml-engineer',name:'ML Engineer',spec:'ML Engineering',modules:['python','ml','ml-engineering'],integration:'integration-mle'},
];
for(const role of ROLES)MODULES.push({id:role.integration,name:'Интеграционный '+role.name,competencies:role.modules,integration:true,skills:role.modules});
// Concrete initial instances: values and keys are fixed before any candidate starts.
// Rows: narrow family, difficulty, competence index, prompt, correct option, distractors.
const rows={
 python:[
 ['slice-copy',1,0,'Что выведет код Python?\na = [1, 2]\nb = a[:]\nb.append(3)\nprint(len(a))','2','3','1','Возникнет ошибка'],
 ['mutable-alias',1,1,'Что выведет код?\na = [1]\nb = a\nb.append(2)\nprint(a)','[1, 2]','[1]','[2]','None'],
 ['mutable-default',2,0,'Почему изменяемый список в аргументе по умолчанию может сохранять значения между вызовами?','Объект значения по умолчанию создаётся при определении функции','Python копирует предыдущий результат','Все списки глобальные','Аргументы не поддерживают списки'],
 ['generator-consumption',2,1,'Генератор g = (x for x in [1, 2]) уже полностью прочитан через list(g). Что вернёт повторный list(g)?','[]','[1, 2]','[2]','Ошибка типов'],
 ['finally-return',3,2,'Что вернёт функция?\ndef f():\n    try:\n        return 1\n    finally:\n        return 2','2','1','None','Исключение'],
 ['context-manager',3,2,'Сервис открывает файл и может получить исключение при чтении. Как обеспечить закрытие файла на обоих путях?','Открыть файл через with','Закрыть только после успешного чтения','Положиться на глобальную переменную','Добавить задержку перед чтением'],
 ],
 javascript:[
 ['strict-equality',1,0,'Чему равно выражение 0 === "0" в JavaScript?','false','true','undefined','Ошибка'],
 ['async-return',1,1,'Что возвращает вызов async-функции, даже если она возвращает число?','Promise','Число без оболочки','Iterator','Поток ОС'],
 ['microtask-order',2,1,'В каком порядке появятся сообщения?\nconsole.log("A");\nPromise.resolve().then(() => console.log("B"));\nconsole.log("C");','A, C, B','A, B, C','B, A, C','C, B, A'],
 ['type-narrowing',2,0,'Значение имеет тип string | number. Как безопасно вызвать toUpperCase()?','Сначала проверить typeof value === "string"','Всегда привести через as string','Отключить strict','Вызвать метод и проигнорировать ошибку'],
 ['stale-search',3,2,'Старый запрос поиска завершился после нового. Как предотвратить замену актуальной выдачи устаревшей?','Проверять идентификатор запроса перед применением ответа','Применять любой пришедший ответ','Отключить индикатор загрузки','Увеличить timeout'],
 ['union-exhaustiveness',3,0,'Как проверять, что switch обрабатывает все варианты discriminated union при расширении типа?','Проверкой never в ветке default','Любым приведением к any','Удалением default','Сравнением числа строк файла'],
 ],
 sql:[
 ['where-before-group',1,0,'Что отбирает WHERE в запросе с GROUP BY?','Исходные строки до группировки','Группы после агрегации','Только значения COUNT','Порядок итоговых строк'],
 ['null-comparison',1,0,'Как выбрать строки, в которых поле deleted_at не заполнено?','WHERE deleted_at IS NULL','WHERE deleted_at = NULL','WHERE deleted_at = 0','WHERE deleted_at <> NULL'],
 ['left-join-filter',2,1,'LEFT JOIN сохраняет все строки users. Какой фильтр в WHERE удалит строки без совпадения с orders?','orders.id IS NOT NULL','orders.id IS NULL','users.id IS NOT NULL','TRUE'],
 ['having-aggregate',2,1,'Как выбрать только группы с COUNT(*) > 5?','HAVING COUNT(*) > 5','WHERE COUNT(*) > 5','ORDER BY COUNT(*) > 5','LIMIT COUNT(*) > 5'],
 ['lost-update',3,2,'Два клиента читают balance=100 и записывают balance=90. Как корректно списать по 10 с каждого?','Атомарным UPDATE balance = balance - 10 для каждого списания','Записать 90 дважды','Повторить SELECT без транзакции','Кешировать balance на клиенте'],
 ['not-in-null',3,0,'Подзапрос в NOT IN вернул числа и NULL. Почему ожидаемые несовпадающие строки могут исчезнуть?','Сравнение с NULL даёт UNKNOWN; WHERE пропускает только TRUE','NULL автоматически равен нулю','NOT IN сортирует строки','SQL удаляет дубликаты из таблицы'],
 ],
 browser:[
 ['native-action',1,0,'Какой элемент лучше подходит для действия, доступного с клавиатуры?','button','div с onclick без tabindex','span без обработчика','img без alt'],
 ['box-sizing',1,1,'Что включает width при box-sizing: border-box?','Контент, padding и border','Только контент','Только margin','Контент и margin'],
 ['flex-shrink',2,1,'Почему flex-элемент может стать уже заданного width при нехватке места?','По умолчанию flex-shrink допускает сжатие','width всегда игнорируется','Браузер удаляет padding','Из-за alt у изображения'],
 ['label-control',2,0,'Как явно связать label с полем ввода?','Указать for, равный id поля','Указать одинаковый class','Поставить label после footer','Задать aria-hidden=true'],
 ['cors-not-auth',3,2,'Почему проверка CORS не заменяет авторизацию API?','Небраузерный клиент может отправить запрос независимо от CORS','CORS шифрует пароль','CORS проверяет права в БД','CORS запрещает все POST'],
 ['cookie-csrf',3,2,'API использует cookie для авторизации изменяющих запросов. Что снижает риск CSRF?','Проверка Origin и CSRF-токена по принятой схеме','Только скрытие кнопки','Только min-height','Хранение секрета в HTML'],
 ],
 react:[
 ['stable-key',1,0,'Для чего нужен стабильный key у элемента списка?','Связать экземпляр компонента с записью','Установить CSS-цвет','Задать сортировку','Ускорить сеть'],
 ['immutable-state',1,1,'Как добавить элемент в массив состояния React?','setItems(prev => [...prev, item])','items.push(item) без setItems','Изменить DOM вручную','Удалить useState'],
 ['state-updater',2,1,'В обработчике дважды вызывается setCount(count + 1). Как надёжно увеличить значение на два?','Дважды вызвать setCount(c => c + 1)','Дважды присвоить count += 1','Поставить key на body','Заменить число строкой'],
 ['effect-cleanup',2,1,'Эффект добавляет обработчик события. Что необходимо при его очистке?','Удалить тот же обработчик','Добавить ещё один обработчик','Очистить весь DOM','Отключить StrictMode'],
 ['effect-race',3,2,'Эффект загружает данные для userId. Как исключить применение ответа от старого userId?','Отменить запрос или проверять актуальность перед обновлением','Всегда обновлять состояние','Использовать индекс списка как key','Запретить смену props'],
 ['server-cache',3,2,'Что нужно кешу серверных данных после успешной мутации?','Явная инвалидация или обновление соответствующих записей','Копирование в localStorage навсегда','Перезагрузка каждого компонента по таймеру','Удаление обработчиков событий'],
 ],
 backend:[
 ['safe-get',1,0,'Какой HTTP-метод обычно используется для чтения ресурса без изменения состояния?','GET','POST','DELETE','PATCH'],
 ['status-conflict',1,0,'Создание ресурса нарушает уникальный бизнес-идентификатор. Какой статус отражает конфликт?','409','200','301','101'],
 ['idempotency-key',2,2,'Платёжный POST повторился после таймаута. Что предотвращает повторное списание?','Ключ идемпотентности с атомарным сохранением результата','Увеличение timeout','Случайный ключ при каждом повторе','Удаление журналов'],
 ['cursor-pagination',2,0,'Лента активно пополняется. Что уменьшает пропуски и дубли по сравнению с OFFSET?','Курсор по стабильному порядку и уникальному идентификатору','Случайная сортировка','Отказ от ORDER BY','Перезагрузка первой страницы'],
 ['outbox-atomicity',3,1,'БД должна сохранить заказ и намерение отправить событие. Как избежать окна между commit и отправкой?','Сохранить outbox в транзакции с заказом','Всегда отправлять до записи заказа','Использовать два независимых запроса','Считать сеть безотказной'],
 ['at-least-once',3,2,'Брокер может повторно доставить уже обработанное событие. Что требуется обработчику?','Дедупликация и идемпотентный бизнес-эффект','Предположение об единственной доставке','Отказ от подтверждений','Случайный sleep'],
 ],
 statistics:[
 ['median-outlier',1,0,'Какая мера центра обычно устойчивее к одному очень большому выбросу?','Медиана','Среднее','Максимум','Сумма'],
 ['correlation-causality',1,2,'Две величины коррелируют. Что можно заключить без дополнительных предпосылок?','Наблюдается связь, но причинность не установлена','Первая обязательно вызывает вторую','Вторая обязательно вызывает первую','Случайное назначение уже выполнено'],
 ['randomization',2,1,'Зачем случайно назначать пользователей в группы A/B-теста?','Уменьшить систематические различия групп','Гарантировать значимость','Увеличить эффект','Исключить необходимость метрики'],
 ['p-value',2,2,'Что описывает p-value в тесте с заданной нулевой гипотезой?','Вероятность получить не менее экстремальные данные при нулевой гипотезе','Вероятность истинности нулевой гипотезы','Размер эффекта','Вероятность успеха продукта'],
 ['multiple-testing',3,1,'Проверяются десятки метрик, а успех объявляется по любой значимой. Что необходимо учитывать?','Рост вероятности ложноположительного вывода при множественных проверках','Все проверки независимы по определению','Чем больше метрик, тем надёжнее вывод без коррекции','Размер выборки больше не важен'],
 ['unit-of-analysis',3,1,'В A/B-тесте рандомизация по пользователю, но у каждого пользователя много событий. Почему нельзя считать события независимыми наблюдениями?','События одного пользователя зависимы; нужно учитывать единицу рандомизации','Все события имеют одинаковый timestamp','Метрики нельзя агрегировать','Рандомизация всегда по событию'],
 ],
 ml:[
 ['holdout-evaluation',1,0,'На каких данных оценивают способность модели обобщать?','На отложенных данных, не использованных для обучения','Только на train','На случайных прогнозах','На размере модели'],
 ['classification-recall',1,1,'Какую ошибку отражает низкий recall положительного класса?','Модель пропускает много реальных положительных объектов','Все положительные прогнозы неверны','Модель всегда переобучена','Train loss равен нулю'],
 ['fold-preprocessing',2,0,'Где обучать scaler при cross-validation?','На train-части каждого fold','Один раз на всём наборе','На тестовом наборе','На целевой переменной'],
 ['time-validation',2,0,'Как оценивать прогноз будущего спроса?','Разбиением по времени с исключением информации из будущего','Случайным перемешиванием всех дат','Добавлением будущего target в признаки','Только по train loss'],
 ['regularization',3,2,'При увеличении регуляризации train error вырос, а validation error снизился. Как это объяснить?','Снижение переобучения ценой менее точного fit на train','Утечка гарантирована','Модель стала точнее на train','Validation больше не нужен'],
 ['threshold-tradeoff',3,1,'Для фиксированных вероятностей бинарного классификатора снижен порог положительного класса. Как обычно меняются recall и precision?','Recall не уменьшается, precision может снизиться','Recall обязательно падает','Precision всегда становится 100%','Оба значения всегда растут'],
 ],
 'ml-engineering':[
 ['artifact-version',1,0,'Что нужно сохранять вместе с моделью для воспроизводимого inference?','Версии преобразований признаков и схемы входа','Только имя файла','Только ноутбук без зависимостей','Только число эпох'],
 ['serving-latency',1,1,'Какая метрика отражает задержку inference для большинства медленных запросов?','p95 latency','Размер README','Train accuracy','Число разработчиков'],
 ['train-serving-skew',2,0,'На train и в serving признак нормализуется по разным правилам. Как называется этот риск?','Train-serving skew','Gradient clipping','Stratification','Label smoothing'],
 ['model-canary',2,1,'Как уменьшить риск при запуске новой версии модели?','Canary на части трафика с метриками и возможностью отката','Мгновенно удалить старую модель','Отключить мониторинг','Проверять только имя артефакта'],
 ['drift-monitoring',3,2,'Разметка поступает с задержкой в неделю. Что можно контролировать сразу?','Распределения признаков, прогнозов и эксплуатационные метрики','Точное качество по ещё не полученной разметке','Только train loss','Только число эпох'],
 ['point-in-time-feature',3,0,'Исторический train использует последнее состояние feature store. Как избежать попадания будущего в признаки?','Point-in-time join с доступностью признака на момент события','Подставить текущие признаки для всех дат','Удалить timestamps','Перемешать даты'],
 ],
 infrastructure:[
 ['file-permissions',1,0,'Как ограничить чтение секретного файла?','Минимально необходимыми правами','chmod 777','Переименованием','Публичной папкой'],
 ['image-digest',1,0,'Зачем фиксировать digest контейнерного образа?','Воспроизводить одну и ту же версию','Автоматически получать latest','Отключить сеть','Уменьшить число пользователей'],
 ['readiness',2,1,'Что определяет readiness probe?','Готовность pod обслуживать трафик','Наличие образа в registry','Размер журнала','Версию Git'],
 ['rollback-artifacts',2,1,'Что нужно для воспроизводимого отката релиза?','Версионированный артефакт и проверенная процедура rollback','Ручное редактирование сервера','Удаление логов','Только повторная сборка latest'],
 ['slo-alert',3,2,'Какой alert лучше отражает угрозу надёжности для пользователей?','Быстрый расход error budget по SLI/SLO','Любое изменение CPU на 1%','Изменение числа строк логов','Любая запись INFO'],
 ['terraform-lock',3,1,'Два инженера меняют один Terraform state. Что защищает от конкурентной записи?','Блокировка state и согласованная процедура apply','Параллельный apply без lock','Удаление state','Переименование каталога'],
 ],
 'test-design':[
 ['boundary-values',1,0,'Для целого диапазона [10, 20] какой набор проверяет обе границы и ближайшие внешние значения?','9, 10, 20, 21','12, 14, 16, 18','10, 10, 20, 20','0, 100, 200, 300'],
 ['equivalence-partition',1,0,'Зачем использовать классы эквивалентности?','Выбирать представителей групп с одинаковым ожидаемым поведением','Перебирать все возможные значения','Заменить требования числом тестов','Проверять только happy path'],
 ['decision-table',2,1,'Правила скидки зависят от членства, суммы и купона. Какая техника помогает проверить комбинации условий?','Таблица решений','Только случайный ввод','Только проверка цвета','Только сортировка тестов'],
 ['state-transition',2,1,'Что необходимо для проверки разрешённых и запрещённых переходов заказа между статусами?','Модель состояний и переходов','Только список экранов','Только число запросов','Только проверка первой страницы'],
 ['risk-priority',3,2,'Время регрессии ограничено. По какому основанию приоритизировать проверки?','По риску отказа, ущербу и затронутым изменениям','По алфавиту','Только по скорости','По числу символов названия'],
 ['coverage-risks',3,2,'Что лучше отражает полноту тестовой стратегии?','Покрытие требований, рисков и уровней проверок','Только число автотестов','Только passed%','Только строки тестового кода'],
 ],
 automation:[
 ['condition-wait',1,0,'Что устойчивее фиксированного sleep в UI-тесте?','Ожидание конкретного наблюдаемого состояния','Случайная задержка','Игнорирование всех ошибок','Ожидание времени суток'],
 ['independent-tests',1,1,'Почему тесты должны самостоятельно создавать нужные данные?','Чтобы результат не зависел от порядка запуска','Чтобы всегда запускаться медленнее','Чтобы скрыть ошибки','Чтобы обходить API'],
 ['fixture-cleanup',2,1,'Тест создал запись и упал на assert. Где обеспечить удаление тестовой записи?','В гарантированном teardown/finally','Только после успешного assert','В следующем случайном тесте','Нигде'],
 ['contract-schema',2,2,'Что нужно проверять в API-автотесте помимо статуса?','Схему ответа и ожидаемый бизнес-эффект','Только длину URL','Только имя endpoint','Только цвет кнопки'],
 ['contract-consumer',3,2,'Зачем consumer-driven contract tests?','Выявлять несовместимость ожиданий клиента и API','Заменить все end-to-end проверки','Проверять CSS','Измерять длину токена'],
 ['parallel-isolation',3,1,'Параллельные тесты используют одного пользователя и меняют его настройки. Как уменьшить взаимное влияние?','Раздельные пользователи/данные для каждого теста','Добавить sleep каждому','Игнорировать падения','Запускать повтор до первого успеха'],
 ],
 'integration-backend':[
 ['api-python-sql-param',1,0,'Python API получает имя "O’Neil" и выполняет SQL-поиск. Какой подход корректно сохраняет строку и отделяет её от SQL?','Передать имя параметром запроса','Вставить имя конкатенацией','Удалить все кавычки из имени','Преобразовать имя в число'],
 ['api-count-json',1,1,'SQL COUNT(*) вернул 3. Python-обработчик возвращает {"count": count}. Какое JSON-тело ожидает клиент?','{"count": 3}','{"count": "COUNT(*)"}','[3, 3, 3]','null'],
 ['atomic-idempotency',2,2,'Python API повторно получает один payment_key. В БД UNIQUE(payment_key). Где фиксировать ключ и изменение баланса?','В одной транзакции с возвратом сохранённого результата при повторе','В двух независимых commit','Только в Python-словаре процесса','В cookie клиента'],
 ['pagination-query',2,1,'Python API отдаёт SQL-ленту с курсором (created_at, id). Зачем использовать обе колонки в ORDER BY и условии следующей страницы?','Чтобы одинаковые даты имели стабильный уникальный порядок','Чтобы отключить индекс','Чтобы запретить JOIN','Чтобы перемешать записи'],
 ['outbox-worker-crash',3,2,'Python worker отправил событие из SQL outbox и упал до отметки published. Брокер доставил повтор. Что сохраняет один бизнес-эффект у API-потребителя?','Дедупликация event_id с атомарным изменением данных','Предположение об единственной доставке','Удаление outbox до отправки','Случайный sleep'],
 ['rollback-side-effect',3,0,'Python обработчик отправляет email внутри SQL-транзакции, затем транзакция откатывается. Что произошло?','Email мог уйти, хотя запись в БД не сохранилась','Email автоматически отозван','SQL откатил сеть','Python не может отправлять email'],
 ],
 'integration-frontend':[
 ['semantic-react-button',1,0,'React-компонент выполняет JS-действие по клику. Какой HTML-элемент обеспечит клавиатурную активацию?','button с onClick','div без tabindex','span с aria-hidden','img без alt'],
 ['css-state-render',1,1,'React условно добавляет класс active, а CSS задаёт .active { color: red }. Что должно измениться при добавлении класса?','Цвет соответствующего элемента','Порядок Promise','Тип props','URL API'],
 ['key-input-reorder',2,2,'Список React содержит редактируемые input и сортируется JS-функцией. Почему индекс массива как key опасен?','Состояние input может перейти к другой записи','CSS перестанет работать','Сортировка всегда станет случайной','Все input удалятся'],
 ['fetch-render-race',2,0,'React effect запускает fetch по строке поиска. Ответ старого запроса приходит последним. Что должно предшествовать обновлению DOM?','Проверка актуальности запроса или его отмена','Применение любого ответа','Удаление aria-label','Смена box-sizing'],
 ['focus-on-rerender',3,1,'React при каждом вводе меняет key поля поиска, а JS снова ставит фокус. Почему это может нарушать ввод?','Поле пересоздаётся; теряется состояние DOM и положение курсора','CSS запрещает ввод','Promise меняет раскладку','key влияет только на цвет'],
 ['untrusted-markup',3,2,'API прислал пользовательский текст. React-компонент вставляет его через dangerouslySetInnerHTML. Что требуется для предотвращения XSS?','Санитизация допустимого HTML либо вывод как обычного текста','Только TypeScript as string','Только overflow:hidden','Только смена key'],
 ],
 'integration-qa':[
 ['range-api-db',1,0,'API принимает age от 18 до 65 и сохраняет его в SQL. Какую проверку важно добавить к статусу для age=17?','Запись не появилась в БД','Только длину URL','Только время суток','Только имя таблицы'],
 ['fixture-sql-count',1,1,'Автотест создал две записи в пустой тестовой SQL-таблице. Какая проверка подтверждает количество?','SELECT COUNT(*) должен вернуть 2','Проверить только статус последнего INSERT','Проверить название таблицы','Прочитать один случайный id'],
 ['duplicate-api-effect',2,2,'Требование: повтор с одним idempotency key не создаёт второй заказ. Что должен проверить API-автотест через SQL?','После двух запросов существует один заказ','Два ответа обязательно различаются','Время второго запроса больше первого','Каждый запрос создал новую запись'],
 ['boundary-generated-tests',2,0,'SQL-ограничение допускает integer amount от 1 до 100. Какой параметризованный набор покрывает соседние границы?','0, 1, 100, 101','20, 30, 40, 50','1, 1, 100, 100','10, 90'],
 ['parallel-db-isolation',3,1,'Регрессионные API-тесты параллельно удаляют данные одной SQL-таблицы. Как устранить зависимость результатов?','Изолировать данные/схемы и очистку каждого теста','Добавить одинаковый sleep','Повторять до passed','Удалить проверки состояния БД'],
 ['race-business-oracle',3,2,'Два автоматизированных запроса одновременно покупают последний товар. Какой бизнес-инвариант проверять в ответах и SQL?','Не более одной успешной покупки, остаток неотрицательный','Оба ответа обязаны быть 200','Только среднюю задержку','Только отсутствие exception в тесте'],
 ],
 'integration-devops':[
 ['python-exit-ci',1,0,'Python health-check завершился exit code 1. CI считает ненулевой exit ошибкой. Что должно произойти?','Шаг CI должен завершиться ошибкой','CI обязан считать успехом','Python автоматически повторит deployment','Контейнер обязательно удалится'],
 ['secret-env-script',1,1,'Python скрипт в контейнере требует секрет из окружения. Какой способ корректен?','Передать секрет через защищённый механизм runtime','Вшить секрет в публичный образ','Вывести секрет в CI-лог','Сохранить в README'],
 ['retry-probe-budget',2,2,'Python readiness-check повторяет запросы с timeout. Почему его суммарное время нужно согласовать с probe timeout?','Иначе инфраструктура прервёт проверку до её завершения','Чтобы изменить digest образа','Чтобы исключить все ошибки сети','Чтобы увеличить train accuracy'],
 ['signal-shutdown',2,0,'Python worker в контейнере получает SIGTERM при rollout. Что помогает безопасно завершить обработку?','Обработать сигнал, прекратить брать новые задания и завершить текущие в grace period','Игнорировать сигнал навсегда','Удалить логи','Выполнить chmod 777'],
 ['deployment-artifact-check',3,1,'Python скрипт выбирает образ по тегу latest для отката. Почему это невоспроизводимо?','Тег может указывать на новый образ; нужен сохранённый digest','Python не умеет читать строки','Rollback не использует образы','Теги всегда неизменяемы'],
 ['bounded-concurrency',3,2,'Python скрипт одновременно запускает 1000 сетевых проверок и исчерпывает лимит сокетов контейнера. Что исправляет проблему?','Ограничение конкурентности и времени ожидания','Удаление resource limits без анализа','Случайное имя pod','Отключение всех проверок навсегда'],
 ],
 'integration-ds':[
 ['sql-python-mean',1,0,'SQL вернул продажи [10, 20, 30]. Python вычисляет среднее. Какое значение получится?','20','60','30','10'],
 ['precision-from-confusion',1,1,'Python-классификатор даёт TP=8 и FP=2 по SQL-выборке. Какова precision?','0.8','0.2','0.5','8'],
 ['ab-pipeline-leak',2,2,'SQL-выборка содержит данные A/B-теста. Python обучает ML-модель с признаком, вычисленным после результата. Что угрожает анализу?','Утечка будущего/целевой информации','Недостаточное число колонок по определению','Обязательное улучшение причинного вывода','Отсутствие индекса всегда меняет метрику'],
 ['fold-sql-features',2,0,'SQL собирает признаки, Python выполняет CV. Где обучать статистические преобразования для ML?','На train-части каждого fold с последующим применением к validation','На полном наборе перед CV','На test для всех fold','На будущей разметке'],
 ['temporal-selection',3,1,'SQL отбирает события, Python валидирует ML-прогноз на будущую неделю. Какие данные допустимы в признаках?','Доступные на момент прогноза, включая соответствующие по времени агрегации','Фактические продажи будущей недели','Последнее состояние всех пользователей без дат','Среднее target по всей истории включая test'],
 ['experiment-user-cluster',3,2,'SQL содержит много кликов одного пользователя. Python оценивает эффект ML-рекомендаций в A/B по пользователям. Как считать неопределённость?','Учитывая зависимость внутри пользователя и единицу рандомизации','Считая каждый клик независимым пользователем','Используя только train loss','Выбирая метрику после просмотра всех p-value'],
 ],
 'integration-mle':[
 ['python-model-shape',1,0,'Python serving ожидает два признака модели. Клиент прислал один. Что должен сделать сервис до inference?','Проверить схему и вернуть контролируемую ошибку','Подставить случайный второй признак','Всегда вернуть 200','Переобучить модель синхронно'],
 ['artifact-transform',1,1,'ML-модель обучена на нормализованных данных. Python serving получает исходные значения. Что нужно применить?','Сохранённое преобразование из train-пайплайна','Новую нормализацию на каждом запросе','Случайную перестановку признаков','Ничего'],
 ['batch-mean-skew',2,2,'Python serving каждый запрос нормализует по статистике его batch, а ML train использовал фиксированные значения. В чём риск?','Прогноз зависит от состава batch и расходится с train-преобразованием','Ключ модели становится уникальным','Задержка всегда нулевая','Метрики больше не нужны'],
 ['canary-metrics',2,0,'Новая ML-модель развёрнута через Python API на 5% трафика. Что нужно сравнить перед расширением?','Качество при доступной разметке, ошибки и задержки по версиям','Только размер имени модели','Только число эпох','Только цвет dashboard'],
 ['feature-time-join',3,1,'Python training использует feature store; serving рассчитывает признаки на текущий момент. Как воспроизвести исторические входы?','Использовать point-in-time доступность признаков в train','Подставить сегодняшние признаки в прошлые строки','Удалить время события','Вычислить target до feature join'],
 ['model-retry-side-effect',3,2,'Python ML API выполняет inference и списывает квоту; запрос повторяется после сетевого таймаута. Как сохранить однократное списание?','Идемпотентный ключ и атомарный учёт квоты независимо от повторного inference','Всегда списывать дважды','Увеличить число признаков','Удалить timeout'],
 ],
};
const numeric={
 python:[['iter-sum','Сколько элементов в результате list(range(2, 8, 2))?',3],['dict-unique','Сколько ключей в словаре после d={"a": 1}; d.update({"a": 2, "b": 3})?',2],['generator-count','Генератор выдаёт числа 0..9. После next(g) два раза сколько элементов осталось?',8]],
 javascript:[['array-length','Какова длина [...new Set([1, 1, 2, 3, 3])]?',3],['reduce-sum','Чему равно [2, 3, 4].reduce((a, b) => a + b, 0)?',9],['promise-map','Promise.all обрабатывает массив из 5 Promise. Все разрешены. Сколько элементов в результате?',5]],
 sql:[['count-non-null','В колонке значения [1, NULL, 2, NULL]. Чему равен COUNT(column)?',2],['join-multiplicity','В A три строки с key=1; в B две строки с key=1. Сколько строк даст INNER JOIN по key?',6],['group-count','Таблица имеет ключи [1, 1, 2, 3, 3]. Сколько групп даст GROUP BY key?',3]],
 browser:[['content-box-width','width=100px, padding=10px с каждой стороны, border=2px с каждой стороны, content-box. Какова ширина border box в px?',124],['grid-gap-width','Три колонки по 100px и два gap по 10px. Какова общая ширина в px?',320],['rem-conversion','Размер корневого шрифта 16px. Сколько px составляет 1.5rem?',24]],
 react:[['render-list-count','Массив из 5 записей фильтруется до 3 и отображается через map в li. Сколько li получится?',3],['functional-update-count','count=0. Три последовательных setCount(c => c + 1). Каково итоговое значение?',3],['filter-pagination-count','В состоянии 12 записей. Сначала filter оставляет 7, затем slice(0, 5). Сколько записей отображается?',5]],
 backend:[['page-offset','Размер страницы 10. Какой OFFSET для третьей страницы при нумерации с 1?',20],['load-rate','30 пользователей делают по 4 запроса в секунду. Сколько запросов в секунду всего?',120],['idempotency-effects','Один idempotency key поступил 5 раз. Каждый повтор корректно дедуплицирован. Сколько списаний?',1]],
 statistics:[['mean-fixed','Каково среднее чисел 2, 4, 6, 8?',5],['median-fixed','Какова медиана чисел 1, 2, 3, 4, 100?',3],['weighted-average','В группе A 10 наблюдений со средним 2; в B 30 со средним 6. Каково общее среднее?',5]],
 ml:[['precision-fixed','TP=30, FP=10. Введите precision в процентах.',75],['recall-fixed','TP=40, FN=10. Введите recall в процентах.',80],['f1-fixed','Precision=0.5, recall=0.5. Введите F1.',0.5]],
 'ml-engineering':[['batch-capacity','Один batch из 20 объектов обрабатывается за 0.1 секунды, без накладных расходов. Сколько объектов в секунду?',200],['replica-throughput','Три serving-реплики выдерживают по 40 запросов/с. Одна отключена. Какова общая ёмкость?',80],['drift-share','Из 200 входов 30 не прошли проверку схемы. Каков процент таких входов?',15]],
 infrastructure:[['replica-capacity','Четыре реплики выдерживают по 50 запросов/с. Какова общая ёмкость без накладных расходов?',200],['availability-percent','Из 1000 запросов 10 завершились ошибкой. Каков процент успешных?',99],['error-budget-count','SLO=99.9% на 100000 запросов. Сколько ошибок допустимо в этом бюджете?',100]],
 'test-design':[['upper-bound','Поле принимает целые числа [10, 20]. Первое недопустимое целое выше верхней границы?',21],['binary-decisions','Два независимых булевых условия. Сколько комбинаций в полной таблице решений?',4],['pairwise-full-small','Три бинарных параметра. Сколько вариантов в полном переборе, без сокращения?',8]],
 automation:[['param-test-count','У теста 4 набора параметров. Сколько запусков при одном проходе?',4],['retry-max-count','Тест сначала запускается один раз, затем допускает 2 повторных запуска. Каков максимум запусков?',3],['parallel-duration','Шесть независимых тестов по 10 секунд запускаются на трёх worker, без накладных расходов. Каково минимальное время в секундах?',20]],
 'integration-backend':[['sql-python-count','Python API выполняет SELECT COUNT(*) после трёх успешных INSERT в пустую таблицу. Какое число вернётся?',3],['duplicate-payment-total','Баланс в SQL равен 100. Python API списывает 20 по одному ключу, запрос повторён три раза с корректной дедупликацией. Итоговый баланс?',80],['join-api-count','API возвращает число строк SQL INNER JOIN. В A два key=7, в B три key=7. Какой count?',6]],
 'integration-frontend':[['react-css-grid','React отображает три карточки по 80px, CSS задаёт gap=10px. Какова ширина ряда в px?',260],['js-react-filter','React отображает JS-массив [1,2,3,4,5] после filter(x => x > 2). Сколько элементов в DOM?',3],['react-state-batch','React count=5. JS-обработчик дважды вызывает setCount(c => c * 2). Каков результат?',20]],
 'integration-qa':[['sql-effect-count','API-тест отправил один запрос создания и проверил SQL COUNT(*) в пустой таблице. При корректном создании сколько записей?',1],['boundary-case-count','Автотест параметризован значениями 9,10,20,21 для диапазона [10,20]. Сколько значений должно отклоняться?',2],['duplicate-test-invariant','API автотест отправил 4 повтора с одним ключом, SQL подтверждает идемпотентность. Сколько заказов должно быть?',1]],
 'integration-devops':[['python-ci-exit','Python скрипт запускает 3 проверки; каждая проходит. Скрипт возвращает число проваленных проверок как exit code. Какой код?',0],['probe-total-time','Python health-check делает 3 последовательные попытки с timeout=2 секунды и без пауз. Каков максимум времени в секундах?',6],['python-concurrency-capacity','Python скрипт проверяет 12 pod группами по 3; каждая группа занимает 2 секунды. Без накладных расходов сколько секунд?',8]],
 'integration-ds':[['sql-python-average','SQL вернул target=[10,20,30,40]. Python вычисляет среднее для baseline ML. Каков прогноз baseline?',25],['sql-confusion-precision','SQL-агрегация дала TP=18, FP=2 для Python ML-модели. Precision в процентах?',90],['ab-rate-difference','SQL дал 20 конверсий из 100 в A и 30 из 100 в B. Python считает разницу долей B−A в процентных пунктах. Сколько?',10]],
 'integration-mle':[['python-serving-batch','Python serving делает 2 batch по 16 объектов для ML-модели. Сколько объектов обработано?',32],['ml-replica-failover','Python ML API имеет 3 реплики по 20 запросов/с. Одна недоступна. Сколько запросов/с выдерживают оставшиеся?',40],['idempotent-quota','Python ML API получил 5 повторов с одним ключом. Квота=10, один inference стоит 1, списание идемпотентно. Какая квота осталась?',9]],
};
const integrationSkills={
 'integration-frontend:css-state-render':['browser','react'],
 'integration-frontend:react-css-grid':['browser','react'],
 'integration-frontend:react-state-batch':['javascript','react'],
 'integration-qa:range-api-db':['test-design','sql'],
 'integration-qa:fixture-sql-count':['sql','automation'],
 'integration-qa:boundary-case-count':['test-design','automation'],
 'integration-ds:sql-python-mean':['python','sql','statistics'],
 'integration-ds:precision-from-confusion':['python','sql','ml'],
 'integration-ds:sql-confusion-precision':['python','sql','ml'],
 'integration-ds:ab-rate-difference':['python','sql','statistics'],
};
export const INITIAL_QUESTIONS=[];
for(const skillModule of MODULES){
 for(const row of rows[skillModule.id]){
  const [family,difficulty,competence,prompt,...options]=row;
  INITIAL_QUESTIONS.push({id:`bank-${skillModule.id}-${family}-v1`,moduleId:skillModule.id,familyId:`${skillModule.id}:${family}`,templateVersion:1,version:1,competencies:skillModule.integration?(integrationSkills[skillModule.id+':'+family]||skillModule.skills):[skillModule.competencies[competence]],skills:integrationSkills[skillModule.id+':'+family]||skillModule.skills||[skillModule.id],difficulty,format:'choice',prompt,options,correct:0,status:'working',exposure:0,created:0,history:[{status:'working',reason:'Исходный принятый банк MVP',at:0}]});
 }
 for(const [i,[family,prompt,expected]] of numeric[skillModule.id].entries())INITIAL_QUESTIONS.push({id:`bank-${skillModule.id}-${family}-v1`,moduleId:skillModule.id,familyId:`${skillModule.id}:${family}`,templateVersion:1,version:1,competencies:skillModule.integration?(integrationSkills[skillModule.id+':'+family]||skillModule.skills):[skillModule.competencies[i]],skills:integrationSkills[skillModule.id+':'+family]||skillModule.skills||[skillModule.id],difficulty:i+1,format:'numeric',prompt,numeric:{expected,tolerance:0,equivalents:[],decimals:null},status:'working',exposure:0,created:0,history:[{status:'working',reason:'Исходный принятый банк MVP',at:0}]});
}
// Preserve all thirty original prompts and keys; put them into the new modular bank.
const legacyModules={Backend:['backend','sql','sql','backend','backend','backend'],Frontend:['browser','javascript','react','javascript','browser','react'],'Data Science':['ml','ml','ml','statistics','ml','ml-engineering'],DevOps:Array(6).fill('infrastructure'),QA:['test-design','automation','automation','test-design','automation','test-design']};
const legacyFamilies={Backend:['safe-get','sql-parameters','lost-update','idempotency-key','outbox-atomicity','at-least-once'],Frontend:['native-action','async-return','stable-key','stale-search','code-splitting','server-cache'],'Data Science':['holdout-evaluation','imbalanced-pr','fold-preprocessing','randomization','time-validation','drift-monitoring'],DevOps:['file-permissions','image-digest','readiness','rollback-artifacts','slo-alert','terraform-lock'],QA:['boundary-values','contract-schema','condition-wait','risk-priority','contract-consumer','coverage-risks']};
for(const [spec,questions] of Object.entries(BANK))questions.forEach((q,i)=>{const moduleId=legacyModules[spec][i],skillModule=MODULES.find(m=>m.id===moduleId);const familyId=moduleId+':'+legacyFamilies[spec][i],canonical=INITIAL_QUESTIONS.find(x=>x.familyId===familyId);INITIAL_QUESTIONS.push({id:`legacy-${moduleId}-${spec.replace(/ /g,'-')}-${i+1}`,moduleId,familyId,templateVersion:1,version:1,competencies:canonical?.competencies||[skillModule.competencies[spec==='Data Science'&&i===1?1:Math.min(2,Math.floor(i/2))]],skills:[moduleId],difficulty:canonical?.difficulty||Math.min(3,Math.floor(i/2)+1),format:'choice',prompt:q[1],options:q[2],correct:q[3],status:'working',created:0,exposure:0,history:[{status:'working',reason:'Исходный банк; условие и ключ сохранены',at:0}]});});
// Append new fixed instances so existing IDs, keys, versions and day pools stay reproducible.
for(const skillModule of MODULES){
 for(const [family,difficulty,competence,prompt,...answers] of BANK_EXPANSION[skillModule.id]){
  const numeric=answers.length===1;
  const skills=skillModule.integration?competence:[skillModule.id];
  INITIAL_QUESTIONS.push({
   id:`bank-${skillModule.id}-${family}-v1`,moduleId:skillModule.id,
   familyId:`${skillModule.id}:${family}`,templateVersion:1,version:1,
   competencies:skillModule.integration?skills:[skillModule.competencies[competence]],skills,
   difficulty,format:numeric?'numeric':'choice',prompt,
   ...(numeric?{numeric:{expected:answers[0],tolerance:0,equivalents:[],decimals:null}}:{options:answers,correct:0}),
   status:'working',exposure:0,created:0,
   history:[{status:'working',reason:'Расширение принятого банка MVP до 16 вопросов на модуль',at:0}],
  });
 }
}
INITIAL_QUESTIONS.push(...BANK_100_QUESTIONS);
INITIAL_QUESTIONS.splice(0,INITIAL_QUESTIONS.length,...reviewedQuestionBank(INITIAL_QUESTIONS));
export const DEFAULT_SPECS=MODULES.map(m=>({...mixedCodingSpec({moduleId:m.id,version:6,competencies:m.competencies,thresholds:{Junior:50,Middle:70,Senior:90}}),id:`spec-${m.id}-v6`,questionSeconds:20,seconds:1760,experimentalSeconds:20,created:0}));
