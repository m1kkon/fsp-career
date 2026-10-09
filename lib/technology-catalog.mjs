// Shared server vocabulary: extraction, resume evidence and hard skill checks.
export const TECHNOLOGIES = [
  ['Python', ['python', 'питон'], {Backend: 2, 'Data Science': 2, QA: 1}],
  ['Go', ['golang', 'go'], {Backend: 2, DevOps: 1}],
  ['Java', ['java'], {Backend: 2}],
  ['Kotlin', ['kotlin'], {Backend: 2}],
  ['C#', ['c#', '.net', 'dotnet'], {Backend: 2}],
  ['PHP', ['php'], {Backend: 2}],
  ['Node.js', ['node.js', 'nodejs', 'node'], {Backend: 2, Frontend: 1}],
  ['FastAPI', ['fastapi'], {Backend: 2}],
  ['Django', ['django'], {Backend: 2}],
  ['PostgreSQL', ['postgresql', 'postgres', 'постгрес'], {Backend: 2, 'Data Science': 1}],
  ['SQL', ['sql'], {'Data Science': 2, Backend: 1, QA: 1}],
  ['Redis', ['redis'], {Backend: 1}],
  ['Kafka', ['kafka'], {Backend: 2, 'Data Science': 1}],
  ['ClickHouse', ['clickhouse'], {'Data Science': 1, Backend: 1}],
  ['HFT', ['hft', 'high-frequency trading', 'high frequency trading', 'высокочастотн'], {Backend: 2, 'Data Science': 2}],
  ['Docker', ['docker'], {DevOps: 2, Backend: 1}],
  ['Kubernetes', ['kubernetes', 'k8s'], {DevOps: 2}],
  ['Terraform', ['terraform'], {DevOps: 2}],
  ['Ansible', ['ansible'], {DevOps: 2}],
  ['Linux', ['linux'], {DevOps: 2, Backend: 1}],
  ['Prometheus', ['prometheus'], {DevOps: 2}],
  ['Grafana', ['grafana'], {DevOps: 1}],
  ['CI/CD', ['ci/cd', 'gitlab ci', 'github actions', 'jenkins'], {DevOps: 2}],
  ['React', ['react'], {Frontend: 2}],
  ['Vue', ['vue'], {Frontend: 2}],
  ['Next.js', ['next.js', 'nextjs'], {Frontend: 2}],
  ['TypeScript', ['typescript', 'ts'], {Frontend: 2, Backend: 1}],
  ['JavaScript', ['javascript', 'js'], {Frontend: 2}],
  ['CSS', ['css', 'scss'], {Frontend: 2}],
  ['HTML', ['html'], {Frontend: 1}],
  ['PyTorch', ['pytorch', 'torch'], {'Data Science': 2}],
  ['scikit-learn', ['scikit-learn', 'sklearn'], {'Data Science': 2}],
  ['Pandas', ['pandas'], {'Data Science': 2}],
  ['Spark', ['spark', 'pyspark'], {'Data Science': 2}],
  ['Airflow', ['airflow'], {'Data Science': 1, DevOps: 1}],
  ['Pytest', ['pytest'], {QA: 2}],
  ['Selenium', ['selenium'], {QA: 2}],
  ['Playwright', ['playwright'], {QA: 2, Frontend: 1}],
  ['Postman', ['postman'], {QA: 2}],

  ['Spring', ['spring', 'spring boot', 'springboot', 'spring framework'], {Backend: 2}],
  ['Hibernate', ['hibernate'], {Backend: 2}],
  ['Maven', ['maven'], {Backend: 1}],
  ['Gradle', ['gradle'], {Backend: 1}],
  ['Oracle', ['oracle'], {Backend: 1, 'Data Science': 1}],
  ['MySQL', ['mysql'], {Backend: 1, 'Data Science': 1}],
  ['MongoDB', ['mongodb', 'mongo'], {Backend: 1}],
  ['Elasticsearch', ['elasticsearch', 'elastic search'], {Backend: 1}],
  ['RabbitMQ', ['rabbitmq', 'rabbit mq'], {Backend: 1}],
  ['REST', ['rest', 'restful'], {}],
  ['SOAP', ['soap'], {Backend: 1}],
  ['gRPC', ['grpc'], {Backend: 1}],
  ['JUnit', ['junit'], {Backend: 1, QA: 1}],
  ['TestNG', ['testng'], {QA: 1}],
  ['Hadoop', ['hadoop'], {'Data Science': 1}],
  ['Less', ['less'], {Frontend: 1}],
  ['Sass', ['sass'], {Frontend: 1}],
  ['jQuery', ['jquery'], {Frontend: 1}],
  ['Git', ['git'], {}],
  ['Jira', ['jira'], {}],
  ['Allure', ['allure'], {QA: 1}],
  ['JMeter', ['jmeter'], {QA: 1}],
  ['GitLab', ['gitlab'], {}],
].map(([name,aliases,affinity])=>({name,aliases,affinity}));

export const technologyNames = TECHNOLOGIES.map(tech=>tech.name);
const fold=value=>String(value??'').toLowerCase().replace(/ё/g,'е');
export function aliasPattern(alias){
 const body=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(/^[a-z0-9]/.test(alias)?`(?<![a-z0-9#+.])${body}(?![a-z0-9#+])`:`(?<![а-яa-z])${body}`,'g');
}
const indexed=TECHNOLOGIES.map(tech=>({...tech,patterns:tech.aliases.map(aliasPattern)}));
function negated(text,index,length){
 const before=text.slice(Math.max(0,index-55),index),after=text.slice(index+length,index+length+65);
 return /(?:без|не (?:нужен|нужна|нужны|нужно|требуется|требуются|использовал[аи]?|работал[аи]?|применял[аи]?))\s*(?:с|на|опыта (?:с|в))?\s*$/.test(before)
  || /^\s*(?:пока\s+|в коммерческих проектах\s+)?не\s+(?:нуж|треб|использ|примен|зна|влад|входит|входят)/.test(after);
}
export function technologyHits(value,{includeNegated=false}={}){
 const text=fold(value),found=[];
 for(const tech of indexed){
  const hits=tech.patterns.flatMap(pattern=>[...text.matchAll(pattern)]).filter(match=>includeNegated||!negated(text,match.index,match[0].length));
  if(hits.length){const first=hits.sort((a,b)=>a.index-b.index)[0];found.push({...tech,at:{index:first.index,word:first[0]}});}
 }
 return found.sort((a,b)=>a.at.index-b.at.index);
}
export function extractTechnologies(text){return technologyHits(text).map(tech=>tech.name);}
export function canonicalSkills(list){
 const names=(Array.isArray(list)?list:[]).flatMap(item=>{
  const found=extractTechnologies(item);return found.length?found:[String(item??'').trim().slice(0,40)].filter(Boolean);
 });
 return [...new Map(names.map(name=>[fold(name),name])).values()];
}
