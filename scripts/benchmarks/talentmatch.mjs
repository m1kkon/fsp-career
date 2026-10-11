import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseFragment} from 'parse5';
import {parseNeed,matching,rankCandidates,WEIGHTS} from '../../lib/matching.mjs';
import {candidateSemanticText,tfidfSimilarity} from '../../lib/ats.mjs';
import {rankingMetrics,meanMetrics,tiedPrecisionAtK} from './ranking-metrics.mjs';

export const SOURCE = {
 repository:'https://github.com/MALINAYAGODA/Talent-Match',
 commit:'a892ad12f2a84f92b9619ee05fbba5fbbf99fd56',
 sha256:'bfa8e4b1f1080b6decba654daf8379356145df80a8ffceeda2577195646da32a',
};
SOURCE.url=`https://raw.githubusercontent.com/MALINAYAGODA/Talent-Match/${SOURCE.commit}/case_2_data_for_members.json`;
const AS_OF = '2024-03-01', SPLIT_SEED = 'fsp-talentmatch-baseline-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const anonymousId = (kind, value) => `${kind}-${hash(`${kind}:${value}`).slice(0,16)}`;

export function plainText(value) {
 const visit = node => {
  if (['script','style'].includes(node.tagName)) return '';
  if (node.nodeName === '#text') return node.value;
  const text=(node.childNodes || []).map(visit).join(' ');
  return text;
 };
 return visit(parseFragment(String(value || ''))).replace(/\s+/g,' ').trim();
}

function technologies(text) {
 // Use the product's vocabulary. Do not silently give this benchmark a better parser.
 const names=new Set();
 for (let start=0; start<text.length; start+=1800) for (const name of parseNeed('',{team:text.slice(start,start+2000)}).stack) names.add(name);
 return [...names];
}

export function supportedRole(title) {
 const text=String(title || '').toLowerCase();
 if (/devops|\bsre\b/.test(text)) return 'DevOps';
 if (/frontend|front-end|фронтенд/.test(text)) return 'Frontend';
 if (/тестировщик|\bqa\b|\bsdet\b/.test(text)) return 'QA';
 if (/android|ios|аналитик|manager|менеджер|руководитель|лидер|\betl\b|\bdwh\b/.test(text)) return null;
 if (/\bjava\b|\bpython\b|backend|бэкенд/.test(text)) return 'Backend';
 return null;
}

// Union employment months so simultaneous jobs are not counted twice. Open-ended
// roles stop at the dataset's reference date, never today's date.
export function experienceYears(entries, asOf = AS_OF) {
 const cutoff=new Date(`${asOf}T00:00:00Z`), limit=cutoff.getUTCFullYear()*12+cutoff.getUTCMonth();
 const months=new Set(); let valid=0;
 for (const entry of entries || []) {
  const start=new Date(entry.starts), end=entry.ends ? new Date(entry.ends) : cutoff;
  if (!entry.starts || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end<start || start>cutoff) continue;
  valid++;
  const first=start.getUTCFullYear()*12+start.getUTCMonth(), last=Math.min(limit,end.getUTCFullYear()*12+end.getUTCMonth());
  // Month precision is all that this adapter needs; cap corrupt centuries-long spans.
  if (last-first>600) throw new Error('Implausible employment date span');
  for (let month=first; month<last; month++) months.add(month);
 }
 return valid ? Math.round(months.size / 12 * 100) / 100 : null;
}

export function adaptResume(raw) {
 const entries=Array.isArray(raw.experienceItem)?raw.experienceItem:[];
 const work=entries.map(entry=>`${plainText(entry.position)} ${plainText(entry.description)}`).join('\n');
 const about=plainText(raw.about), skills=plainText(raw.key_skills);
 const inferred=parseNeed(`${plainText(entries[0]?.position)} ${skills}`);
 const years=experienceYears(entries);
 return {
  id:anonymousId('resume',raw.uuid), name:'Анонимный кандидат',
  spec:inferred.spec, grade:inferred.grade, stack:technologies(`${skills} ${work} ${about}`),
  score:null, verified:false, fsp:null, min:null,max:null,format:'',city:'',
  about,work,ats:{experienceYears:years,claimedSkills:technologies(skills),languages:[]},
 };
}

export function adaptVacancy(raw) {
 const title=plainText(raw.name), description=plainText(raw.description), comment=plainText(raw.comment);
 const text=`${title}\n${description}\n${comment}`, parsed=parseNeed(title,{team:`${description} ${comment}`});
 return {...parsed,text,team:`${description} ${comment}`,spec:supportedRole(title),grade:parsed.grade,
  stack:technologies(`${text} ${plainText(raw.keywords)}`),requiredStack:[],preferredStack:[],
  confirmed:false,
  // No employer confirmation exists here. A guessed skill priority must not become
  // a mandatory requirement; the benchmark records raw parser signals separately.
 };
}

export function normalizeDataset(raw) {
 if (!Array.isArray(raw) || !raw.length) throw new Error('Expected a nonempty TalentMatch vacancy list');
 const vacancyIds=new Set();
 return raw.map(item=>{
  if (!item.vacancy?.uuid || !item.vacancy?.name || !Array.isArray(item.confirmed_resumes) || !Array.isArray(item.failed_resumes)) throw new Error('Invalid TalentMatch vacancy schema');
  const id=anonymousId('vacancy',item.vacancy.uuid);
  if (vacancyIds.has(id)) throw new Error('Duplicate vacancy UUID');
  vacancyIds.add(id);
  const seen=new Set(), candidates=[];
  // Labels are attached after adaptation. Neither the adapter nor the ranker sees them.
  for (const [key,label] of [['confirmed_resumes',1],['failed_resumes',0]]) for (const rawResume of item[key]) {
   if (!rawResume.uuid) throw new Error('Resume is missing a UUID');
   const candidate=adaptResume(rawResume);
   if (seen.has(candidate.id)) throw new Error(`Duplicate or conflicting resume label in ${id}`);
   seen.add(candidate.id); candidates.push({candidate,label});
  }
  if (!candidates.length || !candidates.some(row=>row.label===1) || !candidates.some(row=>row.label===0)) throw new Error(`Vacancy ${id} needs both label classes`);
  return {id,title:plainText(item.vacancy.name),need:adaptVacancy(item.vacancy),candidates};
 });
}

// Connected components prevent a resume appearing in both development and holdout.
// Splitting uses only identities and role scope, never labels or scores.
export function splitDataset(vacancies, fraction = 0.3) {
 if (!(fraction>0 && fraction<1)) throw new Error('Holdout fraction must be between zero and one');
 const parent=new Map(vacancies.map(v=>[v.id,v.id])), owner=new Map();
 const root=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;};
 for (const vacancy of vacancies) for (const {candidate} of vacancy.candidates) {
  if (owner.has(candidate.id)) parent.set(root(vacancy.id),root(owner.get(candidate.id)));
  owner.set(candidate.id,vacancy.id);
 }
 const components=new Map();
 for (const vacancy of vacancies) {const key=root(vacancy.id);components.set(key,[...(components.get(key)||[]),vacancy]);}
 const holdout=new Set();
 for (const scope of [true,false]) {
  const groups=[...components.values()].filter(group=>group.some(v=>Boolean(v.need.spec)===scope) && (scope || !group.some(v=>v.need.spec)))
   .sort((a,b)=>hash(`${SPLIT_SEED}:${a.map(v=>v.id).sort().join(',')}`).localeCompare(hash(`${SPLIT_SEED}:${b.map(v=>v.id).sort().join(',')}`)));
  const size=groups.reduce((sum,group)=>sum+group.length,0), target=groups.length>1?Math.max(1,Math.round(size*fraction)):0;
  let assigned=0;
  for (const group of groups.slice(0,-1)) {if(assigned>=target)break;for(const vacancy of group)holdout.add(vacancy.id);assigned+=group.length;}
 }
 return vacancies.map(v=>({...v,split:holdout.has(v.id)?'holdout':'development'}));
}

function summarize(vacancies, method) {
 const metrics=meanMetrics(vacancies.map(v=>v.methods[method].metrics));
 return metrics?{vacancies:vacancies.length,pairs:vacancies.reduce((sum,v)=>sum+v.pairs,0),...metrics}:null;
}

export function evaluateDataset(raw, {developmentOnly = false} = {}) {
 const vacancies=splitDataset(normalizeDataset(raw));
 const evaluated=vacancies.filter(v=>!developmentOnly || v.split==='development').map(v=>{
  const corpus=v.candidates.map(({candidate})=>candidateSemanticText(candidate));
  const rows=v.candidates.map(({candidate})=>({...candidate,match:matching(candidate,v.need,Date.parse(AS_OF),corpus)}));
  const relevance=new Map(v.candidates.map(row=>[row.candidate.id,row.label]));
  const scored=rankCandidates(rows,v.need);
  const lexical=rows.map(row=>({...row,lexical:tfidfSimilarity(`${v.need.text} ${v.need.team}`,candidateSemanticText(row),corpus).score}))
   .sort((a,b)=>b.lexical-a.lexical||a.id.localeCompare(b.id));
  const stack=[...rows].sort((a,b)=>b.match.matched.length-a.match.matched.length||a.id.localeCompare(b.id));
  const methods={};
  for (const [name,ranked] of [['product',scored],['lexical',lexical],['stack',stack]]) {
   const tieKey=row=>name==='product'?`${row.match.eligibility.status}:${row.match.score}`:name==='lexical'?String(row.lexical):String(row.match.matched.length);
   methods[name]={metrics:{...rankingMetrics(ranked.map(row=>relevance.get(row.id))),tieAdjustedPrecisionAtK:tiedPrecisionAtK(ranked.map(row=>({tieKey:tieKey(row),label:relevance.get(row.id)})))},
    topFive:ranked.slice(0,5).map(row=>({id:row.id,label:relevance.get(row.id),score:name==='product'?row.match.score:name==='lexical'?row.lexical:row.match.matched.length,
     eligibility:row.match.eligibility.status,matched:row.match.matched,missing:v.need.stack.filter(skill=>!row.match.matched.includes(skill))})),
    distinctScores:new Set(ranked.map(tieKey)).size};
  }
  return {id:v.id,title:v.title,split:v.split,supported:Boolean(v.need.spec),role:v.need.spec,pairs:rows.length,
   positives:v.candidates.filter(row=>row.label===1).length,requiredSkills:v.need.stack,grade:v.need.grade,methods,
   failedInTopFive:methods.product.topFive.filter(row=>row.label===0).length,
   missedConfirmed:v.candidates.filter(row=>row.label===1&&!methods.product.topFive.some(top=>top.id===row.candidate.id)).map(row=>row.candidate.id)};
 });
 const summaries={};
 for (const scope of ['supported','all']) for (const split of ['development','holdout','combined']) {
  const selected=evaluated.filter(v=>(scope==='all'||v.supported)&&(split==='combined'||v.split===split));
  summaries[`${scope}/${split}`]=Object.fromEntries(['product','lexical','stack'].map(method=>[method,summarize(selected,method)]));
 }
 const uniqueResumes=new Set(vacancies.flatMap(v=>v.candidates.map(row=>row.candidate.id))).size;
 return {version:1,mode:developmentOnly?'development-only':'frozen-baseline',referenceDate:AS_OF,splitSeed:SPLIT_SEED,weights:{...WEIGHTS},
  dataset:{vacancies:vacancies.length,pairs:vacancies.reduce((sum,v)=>sum+v.candidates.length,0),uniqueResumes,confirmed:vacancies.reduce((sum,v)=>sum+v.candidates.filter(row=>row.label===1).length,0),supportedVacancies:vacancies.filter(v=>v.need.spec).length},
  limitations:['В исходных данных нет результатов тестов, подтверждённых грейдов или истории ФСП. Они остаются неизвестными.',
   'Проверяется ранжирование по текстам и доступным полям, а не полный сценарий каталога с подтверждёнными категориями.',
   'Навыки вакансии — предложения парсера, не обязательные требования, подтверждённые работодателем. Шаблоны ролей не добавляются.',
   'Confirmed/failed — неточный сигнал соответствия после скрининга. Это не факты найма и не вероятности.',
   'К каждой вакансии заранее отобран свой пул резюме. Метрики не оценивают поиск по всему рынку.',
   'Специализация и грейд из текста резюме не подтверждены тестом: баллы за подтверждённую категорию не начисляются.',
   'Development и holdout не пересекаются по вакансиям и резюме. Ошибки отдельных вакансий анализируются только на development.',
   'TF-IDF по полному профессиональному тексту — отдельный baseline. Рабочий бленд использует ограниченное лексическое дополнение только по описаниям выполненной работы внутри компонента резюме; это не семантические embeddings.',
   'Веса в этом прогоне не подбираются. Веса ФСП и тестов нельзя калибровать по этому датасету.',
   'При равных баллах используется порядок анонимных идентификаторов. Tie P@5 показывает результат без влияния этой случайности.'],summaries,
  // Individual failures are inspected only on development vacancies.
  development:evaluated.filter(v=>v.split==='development'),
  holdoutManifest:vacancies.filter(v=>v.split==='holdout').map(v=>({id:v.id,supported:Boolean(v.need.spec),pairs:v.candidates.length})),
  unsupported:vacancies.filter(v=>!v.need.spec).map(v=>({id:v.id,title:v.title,split:v.split}))};
}

export function markdownReport(report) {
 const pct=value=>value===null?'—':`${(value*100).toFixed(1)}%`;
 const rows=[];
 for (const scope of ['supported','all']) for (const split of ['development','holdout']) for (const method of ['product','lexical','stack']) {
  const m=report.summaries[`${scope}/${split}`][method];if(!m)continue;
  rows.push(`| ${scope} | ${split} | ${method} | ${m.vacancies} | ${m.pairs} | ${pct(m.precisionAtK)} | ${pct(m.tieAdjustedPrecisionAtK)} | ${pct(m.ndcgAtK)} | ${pct(m.randomPrecisionAtK)} |`);
 }
 const failures=report.development.filter(v=>v.supported).sort((a,b)=>a.methods.product.metrics.precisionAtK-b.methods.product.metrics.precisionAtK);
 return `# TalentMatch: базовая проверка ранжирования\n\nИсточник: [Talent-Match](${report.source?.repository||SOURCE.repository}), commit \`${report.source?.commit||'custom-input'}\`. SHA-256: \`${report.source?.sha256||'not-recorded'}\`.\n\n${report.dataset.vacancies} вакансий, ${report.dataset.pairs} пар, ${report.dataset.uniqueResumes} уникальных резюме; ${report.dataset.confirmed} confirmed. ${report.dataset.supportedVacancies} вакансий соответствуют нашим направлениям. Фамилии, контакты и даты рождения в отчёт не включены.\n\n## Условия проверки\n\n${report.limitations.map(line=>`- ${line}`).join('\n')}\n\nТекущие веса: \`${JSON.stringify(report.weights)}\`. Дата для стажа: ${report.referenceDate}. Разделение ${report.splitSeed}: примерно 70% development / 30% holdout; связанные одним резюме вакансии остаются в одной группе. Разделение не использует метки.\n\n## Результаты\n\nP@5 — доля confirmed среди первых пяти; nDCG@5 учитывает позиции. Средние считаются по вакансиям. Tie P@5 — ожидаемая точность при случайном порядке внутри равных баллов. Random — ожидаемый P@5 при случайной выдаче.\n\n| Scope | Split | Метод | Вакансий | Пар | P@5 | Tie P@5 | nDCG@5 | Random P@5 |\n|---|---|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Ошибки на development\n\n${failures.map(v=>`### ${v.title}\n\nP@5 ${pct(v.methods.product.metrics.precisionAtK)}; confirmed ${v.positives}/${v.pairs}; различных групп итогового балла ${v.methods.product.distinctScores}.\n\nНавыки из парсера: ${v.requiredSkills.join(', ')||'не распознаны'}.\n\n${v.methods.product.topFive.map((row,i)=>`- ${i+1}. ${row.id}: ${row.label?'confirmed':'failed'}, ${row.score} баллов; совпали ${row.matched.join(', ')||'—'}; отсутствуют ${row.missing.join(', ')||'—'}.`).join('\n')}\n`).join('\n')}\n## Вне поддерживаемых направлений\n\n${report.unsupported.map(v=>`- ${v.title} (${v.split})`).join('\n')}\n`;
}

async function main() {
 const args=process.argv.slice(2), option=name=>{const index=args.indexOf(name);if(index<0)return null;if(!args[index+1]||args[index+1].startsWith('--'))throw new Error(`Missing ${name} value`);return args[index+1];};
 if (args.includes('--help')) {console.log('node scripts/benchmarks/talentmatch.mjs --input /local/source.json --output /local/results [--download] [--development-only]');return;}
 const output=resolve(option('--output') || 'output/benchmarks/talentmatch'), input=resolve(option('--input') || join(output,'source.json'));
 if (args.includes('--download')) {
  const response=await fetch(SOURCE.url);if(!response.ok)throw new Error(`Dataset download failed: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>10_000_000)throw new Error('Unexpected dataset size');
  if(hash(bytes)!==SOURCE.sha256)throw new Error('Pinned dataset checksum mismatch');
  await mkdir(dirname(input),{recursive:true});await writeFile(input,bytes,{mode:0o600});
 }
 const bytes=await readFile(input), digest=hash(bytes), report=evaluateDataset(JSON.parse(bytes),{developmentOnly:args.includes('--development-only')});
 report.source={...SOURCE,commit:digest===SOURCE.sha256?SOURCE.commit:null,sha256:digest,bytes:bytes.length};
 const files=['lib/matching.mjs','lib/resume-fit.mjs','lib/salary-range.mjs','lib/technology-catalog.mjs','lib/domain.mjs','lib/ats.mjs','lib/taxonomy.mjs','lib/fsp.mjs','scripts/benchmarks/talentmatch.mjs','scripts/benchmarks/ranking-metrics.mjs','package-lock.json'];
 report.implementation=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(new URL('../../'+file,import.meta.url)))])));
 await mkdir(output,{recursive:true});
 await writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(join(output,'report.md'),markdownReport(report));
 console.log(JSON.stringify({dataset:report.dataset,supported:report.summaries['supported/combined'],report:join(output,'report.md')},null,2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
