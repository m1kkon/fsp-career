import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {API_ACTIONS} from '../lib/public-api.mjs';
import {SPECS,GRADES,FORMATS} from '../lib/taxonomy.mjs';

export function publicApiSchema(){
 const cabinet=JSON.parse(readFileSync(new URL('../public/openapi.json',import.meta.url),'utf8'));
 // Keep the shared action schemas in sync with the live specialization dictionary.
 function categories(node){if(!node||typeof node!=='object')return;if(Array.isArray(node.enum)&&node.enum.includes('Backend')&&node.enum.includes('Data Science'))node.enum=[...SPECS,...(node.enum.includes(null)?[null]:[])];for(const value of Object.values(node))categories(value);}
 categories(cabinet.components.schemas);
 for(const key of ['grade','score','verifiedAt'])cabinet.components.schemas.Candidate.properties[key].type=[key==='grade'?'string':key==='score'?'number':'integer','null'];
 const ref=name=>({$ref:'#/components/schemas/'+name});
 const json=schema=>({content:{'application/json':{schema}}});
 const parameter=(name,schema,description)=>({name,in:'query',required:false,schema,description});
 const str=(maxLength)=>({type:'string',...(maxLength?{maxLength}:{})});
 const enumerated=values=>({type:'string',enum:values});
 const integer=(minimum,maximum,defaultValue)=>({type:'integer',minimum,maximum,...(defaultValue!==undefined?{default:defaultValue}:{})});
 const page=[parameter('limit',integer(1,100,20),'Размер страницы.'),parameter('offset',integer(0,100000,0),'Смещение. nextOffset=null завершает обход.')];
 const common=[parameter('query',str(2000),'Потребность; без подтверждения категории выдача пуста.'),parameter('spec',enumerated(SPECS),'Точный фильтр специализации.'),parameter('grade',enumerated(GRADES),'Точный фильтр публичной выдачи; внутри match это минимальный уровень потребности. Для сохранения более высоких грейдов задайте уровень только в confirmed query.'),parameter('stack',str(800),'До 20 технологий через запятую, нужны все; известные алиасы нормализуются.'),parameter('city',str(80),'Подстрока города, регистр не важен.'),parameter('format',enumerated(FORMATS),'Формат работы.'),parameter('salaryMin',integer(1,10000000),'Нижняя граница пересечения зарплатных ожиданий.'),parameter('salaryMax',integer(1,10000000),'Верхняя граница; неизвестная зарплата исключается.'),parameter('synthetic',enumerated(['true','false']),'Только демонстрационные / только реальные записи.')];
 const candidates=[...common,parameter('team',str(2000),'Контекст команды для ранжирования.'),parameter('budgetMin',integer(1,10000000),'С query: обязательное пересечение ожиданий и бюджета, границы включены; неизвестная зарплата исключается. Без query не фильтрует публичный каталог; используйте salaryMin/salaryMax.'),parameter('budgetMax',integer(1,10000000),'С query: обязательная верхняя граница пересечения бюджета и ожиданий. Без query используйте salaryMax.'),parameter('confirmed',enumerated(['true','false']),'Подтвердить разобранную потребность. Оба spec/grade подтверждают её автоматически.'),parameter('fsp',enumerated(['all','with','without']),'Видимые достижения ФСП.'),parameter('favorites',enumerated(['true','false']),'Фильтр вашего избранного.'),parameter('minScore',integer(0,100,0),'Минимальный результат теста; не match.score.'),parameter('sort',{...enumerated(['match','strength','score','salary','name']),default:'match'},'match: обязательные условия pass/unknown/fail, затем общий балл кандидата; strength: только тесты и ФСП (до 18); score: результат теста; salary: дешевле; name: по имени.'),...page];
 const errors=Object.fromEntries([400,401,403,404,409,413,415,429,500].map(status=>[status,{description:({400:'Неверный запрос',401:'Ключ недействителен',403:'Нет роли или права записи',404:'Метод/адрес/запись недоступны',409:'Конфликт состояния',413:'Слишком большой запрос',415:'Ожидается JSON',429:'Лимит; повторить через Retry-After',500:'Ошибка сервера'})[status],...json(ref('PublicError')),...(status===429?{headers:{'Retry-After':{schema:{type:'integer'},description:'60 секунд'}}}:{})}]));
 const operation=(id,summary,schema,parameters=[],body)=>({operationId:id,summary,parameters,responses:{200:{description:'Успех. Cache-Control: no-store; X-Request-ID содержит ID запроса.',...json(schema)},...errors},...(body?{requestBody:{required:true,...json(body)}}:{})});
 const data=schema=>({type:'object',required:['data'],properties:{data:schema}});
 const list=schema=>({type:'object',required:['data','pagination'],properties:{data:{type:'array',items:schema},pagination:ref('Pagination')}});
 const id=name=>({name,in:'path',required:true,schema:{type:'string',maxLength:100}});
 const role=parameter('role',enumerated(['candidate','employer']),'По умолчанию employer, если у аккаунта есть эта роль, иначе candidate.');
 const paths={
  '/me':{get:operation('getMe','Свои профили и роли',ref('PublicResponse'))},
  '/taxonomy':{get:operation('getTaxonomy','Специализации, уровни, форматы, действия и лимиты',ref('PublicResponse'))},
  '/candidates':{get:operation('searchCandidates','Поиск работодателя с приватностью и объяснением ранжирования',{...list(ref('Candidate')),properties:{...list(ref('Candidate')).properties,need:{anyOf:[ref('Need'),{type:'null'}]},categories:{type:'array',items:ref('CategoryRecommendation')}}},candidates)},
  '/candidates/{id}':{get:operation('getCandidate','Профиль видимого кандидата; контакт только после принятия приглашения или отклика',data(ref('Candidate')),[id('id')])},
  '/jobs':{get:operation('searchJobs','Опубликованные вакансии, новые сначала',list({type:'object',additionalProperties:true}),[...common.map(p=>p.name==='query'?{...p,description:'Подстрока названия/описания/компании/стека.'}:p),...page])},
  '/jobs/{id}':{get:operation('getJob','Опубликованная вакансия',ref('PublicResponse'),[id('id')])},
  '/state':{get:operation('getCabinetState','Полное собственное представление; без пагинации',data(ref('State')),[role])},
  '/actions':{post:operation('performAction','Операция кабинета; нужен write; тесты и администрирование исключены',ref('PublicResponse'),[],{oneOf:API_ACTIONS.map(ref)})},
  '/favorites/{candidateId}':Object.fromEntries(['put','delete'].map(method=>[method,operation(method==='put'?'saveFavorite':'removeFavorite',method==='put'?'Добавить в избранное (идемпотентно)':'Удалить из избранного (идемпотентно)',ref('PublicResponse'),[id('candidateId')])])),
 };
 for(const resource of ['needs','favorites','invites','applications','messages','tasks','submissions'])paths['/'+resource]={get:operation('list'+resource[0].toUpperCase()+resource.slice(1),'Список своего кабинета: '+resource,list(resource==='favorites'?{type:'string'}:{type:'object',additionalProperties:true}),[role,...page,parameter('status',str(),'Фильтр поля status, если оно есть.'),parameter('contextId',str(),'ID диалога; фильтрует записи с этим полем.')])};
 const invite=structuredClone(cabinet.components.schemas.invite);delete invite.properties.action;invite.required=invite.required.filter(x=>x!=='action');
 paths['/invites'].post=operation('sendInvite','Предложение видимому кандидату; дубликат открытого предложения — 409',ref('PublicResponse'),[],invite);
 return {openapi:'3.1.0',info:{title:'ФСП Карьера — Personal API',version:'1.0.0',description:'Bearer API-ключ из личного кабинета, 30/90 дней. Сохраняет роли и приватность аккаунта. Чтение 120 запросов/мин на аккаунт, запись до 30/мин. При смене пароля ключи отзываются. POST автоматически не повторять: сначала проверить состояние. Для записи нужен scope write.'},externalDocs:{description:'Руководство и примеры',url:'https://fspcareer.space/api-docs'},servers:[{url:'https://fspcareer.space/api/v1'}],security:[{ApiKey:[]}],paths,components:{securitySchemes:{ApiKey:{type:'http',scheme:'bearer',bearerFormat:'fsp_live_<64 hex>',description:'Создаётся/отзывается в ЛК → API-ключи. Использовать на сервере.'}},schemas:{...cabinet.components.schemas,PublicResponse:data({type:'object',additionalProperties:true}),Pagination:{type:'object',required:['total','limit','offset','nextOffset'],properties:{total:{type:'integer',minimum:0},limit:integer(1,100),offset:integer(0,100000),nextOffset:{type:['integer','null']}}},PublicError:{type:'object',required:['error','requestId'],properties:{error:{type:'object',required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}}},requestId:{type:'string',format:'uuid'}}}}}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 writeFileSync(new URL('../public/api-v1.openapi.json',import.meta.url),JSON.stringify(publicApiSchema(),null,2)+'\n');
 writeFileSync(new URL('../public/api-guide.md',import.meta.url),readFileSync(new URL('../docs/api.md',import.meta.url)));
}
