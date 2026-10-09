// Literal expected evidence, independent of the matcher. These are regression
// cases for language handling, not independently labelled human resumes.
export const RESUME_EVIDENCE_CASES=[
 {id:'en-built',split:'development',work:'Built payment APIs in Python.',skills:['Python'],api:true},
 {id:'en-negative-contraction',split:'development',work:"I didn't build APIs in Python.",skills:[],api:false},
 {id:'en-planned',split:'development',work:'I will develop an API in Python.',skills:[],api:false},
 {id:'ru-contrast',split:'development',work:'Не разрабатывал на Java, но реализовал API на Python.',skills:['Python'],api:true},
 {id:'en-contrast',split:'development',work:'Implemented an API in Python, but never used Java.',skills:['Python'],api:true},
 {id:'ru-no-experience',split:'development',work:'Нет опыта разработки API на Python.',skills:[],api:false},
 {id:'ru-absent',split:'development',work:'Опыт разработки API на Python отсутствует.',skills:[],api:false},
 {id:'ru-not-only',split:'development',work:'Не только разработал API на Python, но и настроил Redis.',skills:['Python','Redis'],api:true},
 {id:'en-has-not',split:'holdout',work:'She hasn’t implemented an API in Python.',skills:[],api:false},
 {id:'en-could-not',split:'holdout',work:"I couldn't build an API in Python.",skills:[],api:false},
 {id:'en-written',split:'holdout',work:'Wrote Python APIs for a payment service.',skills:['Python'],api:true},
 {id:'en-future-work',split:'holdout',work:'I will work on Python API integrations.',skills:[],api:false},
 {id:'en-mixed-plan',split:'holdout',work:'Implemented Redis caching, but planning to build a Python API.',skills:['Redis'],api:false},
 {id:'ru-no-commercial-experience',split:'holdout',work:'Без коммерческого опыта разработки API на Python.',skills:[],api:false},
 {id:'ru-positive-negative',split:'holdout',work:'Создал API на Python, однако Java не использовал.',skills:['Python'],api:true},
 {id:'ru-completed-future',split:'holdout',work:'Внедрил Redis, но буду разрабатывать API на Python.',skills:['Redis'],api:false},
];
