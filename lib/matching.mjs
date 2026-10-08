import {SPECS, GRADES, FORMATS} from './taxonomy.mjs';
import {publicFspProfile} from './fsp.mjs';
import {evaluateHardFilters,tfidfSimilarity,candidateSemanticText} from './ats.mjs';

// Rule-based, deterministic matching. Every point of a score belongs to one named
// part, so an explanation always adds up to the total. The weights are MVP
// hypotheses: they still need calibration on labelled need–candidate pairs.
export const WEIGHTS = {spec: 25, grade: 15, stack: 20, test: 20, fsp: 10, format: 4, salary: 4, domain: 2};
const ADJACENT_SPEC = 0.3, ADJACENT_GRADE = 0.4;

const fold = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е');
const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Map(values.map(value => [fold(value), value])).values()];
const LATE = 1e9;

// Latin aliases must stand alone ("java" is not "javascript"); Cyrillic entries
// are stems that match the start of a word ("бэкенд" covers "бэкенда").
function term(alias) {
  const body = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(/^[a-z0-9]/.test(alias) ? `(?<![a-z0-9#+.])${body}(?![a-z0-9#+])` : `(?<![а-яa-z])${body}`);
}
function hit(terms, value) {
  let best = null;
  for (const re of terms) {
    const m = re.exec(value);
    if (m && (!best || m.index < best.index)) best = {index: m.index, word: m[0] + value.slice(m.index + m[0].length).match(/^[\p{L}\p{N}]*/u)[0]};
  }
  return best;
}

// Canonical technology, aliases and how strongly it points to a specialization.
const TECH = [
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
].map(([name, aliases, affinity]) => ({name, terms: aliases.map(term), affinity}));

// An explicit role word outweighs any single technology (3 against 1–2).
const ROLE_TERMS = Object.fromEntries(Object.entries({
  Backend: ['backend', 'back-end', 'бэкенд', 'бекенд', 'серверн'],
  Frontend: ['frontend', 'front-end', 'фронтенд', 'фронт', 'верстальщик', 'верстк'],
  'Data Science': ['data science', 'data scientist', 'ml', 'machine learning', 'машинн', 'нейросет', 'рекомендательн', 'data'],
  'ML Engineering': ['ml engineer', 'ml engineering', 'ml-инженер', 'mlops', 'млопс', 'мл инженер'],
  DevOps: ['devops', 'девопс', 'sre', 'сисадмин', 'системный администратор'],
  QA: ['qa', 'тестировщик', 'тестирован', 'автотест', 'sdet'],
}).map(([spec, words]) => [spec, words.map(term)]));
// A general ML alias inside 'ML Engineer' must not also imply Data Science.
function roleHit(spec,value){
 if(spec==='Data Science'){
  const engineering=hit(ROLE_TERMS['ML Engineering'],value);
  if(engineering)value=value.slice(0,engineering.index)+' '.repeat(engineering.word.length)+value.slice(engineering.index+engineering.word.length);
 }
 return hit(ROLE_TERMS[spec],value);
}
const GRADE_TERMS = Object.fromEntries(Object.entries({
  Junior: ['junior', 'джун', 'джуниор', 'начинающ', 'стажер', 'intern', 'выпускник', 'без опыта'],
  Middle: ['middle', 'мидл', 'миддл'],
  Senior: ['senior', 'сеньор', 'синьор', 'старш', 'ведущ', 'lead', 'тимлид', 'архитектор'],
}).map(([grade, words]) => [grade, words.map(term)]));
const FORMAT_TERMS = [['Удалённо', ['удален', 'remote', 'дистанц']], ['Гибрид', ['гибрид', 'hybrid']], ['Офис', ['офис', 'office']]]
  .map(([format, words]) => [format, words.map(term)]);
// Subject areas shared by the team description and resume text. Resume text is
// self-described, so this part carries the smallest weight.
const DOMAINS = [
  ['fintech', 'Финтех, платежи и HFT', ['финтех', 'fintech', 'платеж', 'банк', 'эквайринг', 'биллинг', 'hft', 'high-frequency trading', 'high frequency trading', 'высокочастотн']],
  ['highload', 'Высокая нагрузка', ['нагрузк', 'highload', 'высоконагруж']],
  ['ecommerce', 'E-commerce и ритейл', ['e-commerce', 'ecommerce', 'маркетплейс', 'интернет-магазин', 'ритейл', 'retail']],
  ['recsys', 'Рекомендации и ранжирование', ['рекоменд', 'ранжир', 'персонализ']],
  ['infra', 'Инфраструктура и надёжность', ['инфраструктур', 'ci/cd', 'наблюдаем', 'observability', 'мониторинг', 'sre']],
  ['interfaces', 'Интерфейсы и дизайн-системы', ['дизайн-систем', 'интерфейс', 'доступност', 'accessibility']],
  ['integrations', 'API и интеграции', ['api', 'интеграц', 'микросервис']],
  ['quality', 'Автоматизация тестирования', ['автотест', 'автоматизирую', 'автоматизация тест', 'регресс']],
  ['b2b', 'Сервисы для бизнеса', ['b2b', 'для бизнеса', 'малого бизнеса', 'малому бизнесу', 'корпоратив']],
  ['ml', 'Машинное обучение', ['машинн', 'ml', 'нейросет']],
  ['data', 'Данные и аналитика', ['аналитик', 'etl', 'dwh', 'big data', 'хранилищ']],
].map(([key, label, words]) => ({key, label, terms: words.map(term)}));

const techsIn = value => TECH.map(tech => ({...tech, at: hit(tech.terms, value)})).filter(x => x.at).sort((a, b) => a.at.index - b.at.index);
const domainsIn = value => DOMAINS.filter(domain => hit(domain.terms, value)).map(({key, label}) => ({key, label}));

// Free-form stack entries map to canonical names ("Postgres" → PostgreSQL);
// unknown entries stay as typed and are compared case-insensitively.
export function stackNames(list) {
  return unique((Array.isArray(list) ? list : []).flatMap(item => {
    const names = techsIn(fold(item)).map(tech => tech.name);
    return names.length ? names : [clean(item, 40)].filter(Boolean);
  }));
}

function specEvidence(value) {
  const result = Object.fromEntries(SPECS.map(spec => [spec, {score: 0, words: [], at: LATE}]));
  for (const spec of SPECS) {
    const role = roleHit(spec,value);
    if (role) Object.assign(result[spec], {score: 3, words: [role.word], at: role.index});
  }
  for (const tech of techsIn(value)) for (const [spec, weight] of Object.entries(tech.affinity)) {
    const entry = result[spec];
    entry.score += weight;
    entry.words.push(tech.name);
    entry.at = Math.min(entry.at, tech.at.index);
  }
  return result;
}

function experienceGrade(value) {
  if (/(?:до|меньше|менее)\s+года/.test(value)) return {grade: 'Junior', word: 'до года'};
  const m = value.match(/(\d+(?:[.,]\d+)?)\s*\+?\s*(?:год[а-я]*|лет)/);
  if (!m) return null;
  const years = Number(m[1].replace(',', '.'));
  // "проект 2025 года" is a date, not experience.
  if (years > 40) return null;
  return {grade: years >= 5 ? 'Senior' : years >= 2 ? 'Middle' : 'Junior', word: m[0]};
}

function minimumExperience(value) {
  const match=value.match(/(?:от|не менее|минимум)\s*(\d+(?:[.,]\d+)?)\s*(?:год[а-я]*|лет)/);
  return match ? Number(match[1].replace(',','.')) : null;
}

function englishLevel(value) {
  const match=value.match(/(?:английск[а-я]*|english)[^a-zа-я0-9]{0,20}(?:от\s*)?(a1|a2|b1|b2|c1|c2)/i)
    || value.match(/\b(a1|a2|b1|b2|c1|c2)\b[^а-яa-z]{0,10}(?:английск[а-я]*|english)/i);
  return match?.[1]?.toUpperCase() || null;
}

function splitStackByPriority(value,names) {
  const required=[],preferred=[];
  for(const name of names){
    const index=value.indexOf(fold(name)),context=value.slice(Math.max(0,index-55),index+fold(name).length+55);
    if(/обязател|требуется|необходим|must have|must-have/.test(context))required.push(name);
    else preferred.push(name);
  }
  return {required,preferred};
}

// Only money-like amounts count: "до 250 тыс." or "180 000–250 000", never "3–5 лет".
const NUMBER = '(\\d{1,3}(?:[ \\u00a0.]\\d{3})+|\\d+)', UNIT = '\\s*(тыс[а-я.]*|т\\.?\\s?р\\.?(?![а-я])|к(?![а-я])|k(?![a-z]))?';
const RANGE = new RegExp(`${NUMBER}${UNIT}\\s*(?:-|–|—|до)\\s*${NUMBER}${UNIT}`, 'g');
const UP_TO = new RegExp(`до\\s*${NUMBER}${UNIT}`, 'g'), FROM = new RegExp(`от\\s*${NUMBER}${UNIT}`, 'g');
function rubles(digits, unit) {
  const value = Number(digits.replace(/[\s.]/g, '')) * (unit ? 1000 : 1);
  return value >= 10000 && value <= 10000000 ? value : null;
}
function firstMatch(re, value, read) {
  for (const m of value.matchAll(re)) {
    const result = read(m);
    if (result) return result;
  }
  return null;
}
function budgetIn(value) {
  const range = firstMatch(RANGE, value, m => {
    // "180–250 тыс." applies the unit of the upper bound to the lower one.
    const min = rubles(m[1], m[2] || (Number(m[1]) < 1000 ? m[4] : '')), max = rubles(m[3], m[4]);
    return min && max && max >= min ? {budgetMin: min, budgetMax: max} : null;
  });
  if (range) return range;
  const budgetMax = firstMatch(UP_TO, value, m => rubles(m[1], m[2])), budgetMin = firstMatch(FROM, value, m => rubles(m[1], m[2]));
  if (budgetMin && budgetMax && budgetMax < budgetMin) return null;
  return budgetMin || budgetMax ? {budgetMin, budgetMax} : null;
}

// Team context arrives from query parameters, so invalid values are dropped
// instead of failing the whole search. Saving a need validates them strictly.
export function needContext(input = {}) {
  const money = value => {
    const n = Number(String(value ?? '').replace(/[\s.]/g, ''));
    return Number.isInteger(n) && n > 0 && n <= 10000000 ? n : null;
  };
  let budgetMin = money(input.budgetMin), budgetMax = money(input.budgetMax);
  if (budgetMin && budgetMax && budgetMax < budgetMin) budgetMin = budgetMax = null;
  return {team: clean(input.team, 2000), format: FORMATS.includes(input.format) ? input.format : '', city: clean(input.city, 80), budgetMin, budgetMax};
}

// The request text sets the category; team context only refines the order.
export function parseNeed(input, context = {}) {
  const text = clean(input, 2000), query = fold(text), ctx = needContext(context), team = fold(ctx.team);
  let evidence = specEvidence(query), source = 'query';
  if (team && SPECS.every(spec => !evidence[spec].score)) [evidence, source] = [specEvidence(team), 'team'];
  const ranked = [...SPECS].sort((a, b) => evidence[b].score - evidence[a].score || evidence[a].at - evidence[b].at);
  const explicitSpecs = SPECS.filter(spec => roleHit(spec,query));
  const found = evidence[ranked[0]].score > 0, spec = found && explicitSpecs.length <= 1 ? explicitSpecs[0]||ranked[0] : null;
  const gradeHits = GRADES.map(grade => ({grade, at: hit(GRADE_TERMS[grade], query)})).filter(x => x.at).sort((a, b) => a.at.index - b.at.index);
  const gradeHit = gradeHits.length === 1 ? gradeHits[0] : null;
  const years = gradeHit ? null : experienceGrade(query);
  const formatHit = FORMAT_TERMS.map(([format, terms]) => ({format, at: hit(terms, query)})).filter(x => x.at).sort((a, b) => a.at.index - b.at.index)[0];
  const queryStack = techsIn(query).map(tech => tech.name), teamStack = techsIn(team).map(tech => tech.name);
  const priorities=splitStackByPriority(query,queryStack),teamPriorities=splitStackByPriority(team,teamStack);
  const budget = ctx.budgetMin || ctx.budgetMax ? {budgetMin: ctx.budgetMin, budgetMax: ctx.budgetMax} : budgetIn(query) || budgetIn(team);
  return {
    text, spec, grade: gradeHits.length > 1 ? null : gradeHit?.grade || years?.grade || null,
    stack: unique([...queryStack, ...teamStack]),
    requiredStack: unique([...priorities.required,...teamPriorities.required]),
    preferredStack: unique([...priorities.preferred,...teamPriorities.preferred]),
    englishLevel: englishLevel(query)||englishLevel(team),
    minExperience: minimumExperience(query)||minimumExperience(team),
    format: ctx.format || formatHit?.format || '', city: ctx.city, team: ctx.team,
    budgetMin: budget?.budgetMin || null, budgetMax: budget?.budgetMax || null,
    domains: domainsIn(`${query} ${team}`),
    adjacent: ranked.filter(other => other !== spec && evidence[other].score >= 2),
    scores: Object.fromEntries(SPECS.map(other => [other, evidence[other].score])),
    evidence: {
      spec: spec ? evidence[spec].words : [], specSource: spec ? source : null,
      grade: gradeHit?.at.word || years?.word || null,
      teamStack: teamStack.filter(name => !queryStack.includes(name)),
      format: ctx.format ? 'context' : formatHit ? 'text' : null,
      budget: ctx.budgetMin || ctx.budgetMax ? 'context' : budget ? 'text' : null,
    },
    signals: [...explicitSpecs.map(value => ({field:'Специализация',value,quote:roleHit(value,query).word})), ...gradeHits.map(({grade,at}) => ({field:'Уровень',value:grade,quote:at.word})), ...queryStack.map(value=>({field:'Технология',value,quote:techsIn(query).find(t=>t.name===value).at.word}))],
    ambiguous: {spec: explicitSpecs.length > 1, grade: gradeHits.length > 1},
    defaulted: {spec: !spec, grade: !gradeHit && !years},
  };
}


// Employer decisions override suggestions; an incomplete request never starts a search.
export function selectedNeed(input, selection = {}) {
  const parsed = parseNeed(input, selection);
  const spec = SPECS.includes(selection.spec) ? selection.spec : parsed.spec;
  const grade = GRADES.includes(selection.grade) ? selection.grade : parsed.grade;
  const explicitStack = Array.isArray(selection.stack) ? selection.stack : typeof selection.stack === 'string' ? selection.stack.split(',') : null;
  const requiredStack=selection.requiredStack!==undefined?stackNames(Array.isArray(selection.requiredStack)?selection.requiredStack:String(selection.requiredStack).split(',')).slice(0,20):parsed.requiredStack;
  const preferredStack=selection.preferredStack!==undefined?stackNames(Array.isArray(selection.preferredStack)?selection.preferredStack:String(selection.preferredStack).split(',')).slice(0,20):parsed.preferredStack;
  const stack=explicitStack?stackNames(explicitStack).slice(0,20):unique([...requiredStack,...preferredStack]);
  return {...parsed, spec, grade, stack,requiredStack,preferredStack,
    englishLevel:/^(A1|A2|B1|B2|C1|C2)$/.test(selection.englishLevel)?selection.englishLevel:parsed.englishLevel,
    minExperience:Number(selection.minExperience)>=0&&selection.minExperience!==''?Number(selection.minExperience):parsed.minExperience,
    formatRequired:selection.formatRequired===true||selection.formatRequired==='1',locationRequired:selection.locationRequired===true||selection.locationRequired==='1',salaryRequired:selection.salaryRequired===true||selection.salaryRequired==='1',
    adjacent: parsed.adjacent.filter(other=>other!==spec),
    confirmed: (selection.confirmed===true || selection.confirmed==='1') && SPECS.includes(spec) && GRADES.includes(grade),
    missing: [!spec?'spec':null,!grade?'grade':null].filter(Boolean)};
}

// A vacancy is an already structured need: its own fields replace the guesses.
export function needFromJob(job) {
  const format = FORMATS.find(value => fold(job.format).startsWith(fold(value))) || '';
  const city = job.city || String(job.format || '').split('·')[1];
  const need = parseNeed(`${job.title || ''} ${(job.stack || []).join(', ')}`, {team: job.description, format, city, budgetMin: job.min, budgetMax: job.max});
  return {
    ...need, spec: job.spec, grade: job.grade, stack: stackNames(job.stack), requiredStack:[], preferredStack:stackNames(job.stack),
    adjacent: SPECS.filter(spec => spec !== job.spec && need.scores[spec] >= 2).sort((a, b) => need.scores[b] - need.scores[a]),
    evidence: {...need.evidence, spec: [], specSource: 'job', grade: null},
    defaulted: {spec: false, grade: false},
  };
}

export function categoryRelation(spec, grade, need) {
  const step = GRADES.indexOf(grade) - GRADES.indexOf(need.grade);
  if (spec === need.spec) return step === 0 ? 'exact' : step === 1 ? 'higher' : step === -1 ? 'lower' : 'other';
  return step === 0 && need.adjacent.includes(spec) ? 'adjacent' : 'other';
}

const LEVELS = {winner: 1, prize: 0.85, final: 0.6, participant: 0.35};
// Any FSP result is evidence of practical programming; the discipline closest
// to the requested work counts in full.
const DISCIPLINE_FIT = {
  'Продуктовое программирование': {Backend: 1, Frontend: 1, DevOps: 1, QA: 1, 'Data Science': 0.8},
  'Спортивное программирование': {Backend: 1, 'Data Science': 1, Frontend: 0.8, DevOps: 0.8, QA: 0.8},
  'Алгоритмическое программирование': {Backend: 1, 'Data Science': 1, Frontend: 0.8, DevOps: 0.8, QA: 0.8},
  'Программирование ИИ': {'Data Science': 1, Backend: 0.8, Frontend: 0.7, DevOps: 0.7, QA: 0.7},
  'Информационная безопасность': {DevOps: 1, Backend: 0.9, QA: 0.8, Frontend: 0.7, 'Data Science': 0.7},
};

// FSP history lifts a candidate inside a category but never filters anyone out:
// without history the bonus is zero and the remaining 90 points stay available.
// Only the canonical projection counts, so profile edits cannot forge a result.
export function fspSignal(fsp, spec, now = Date.now()) {
  const profile = publicFspProfile(fsp);
  if (!profile) return null;
  const year = new Date(now).getUTCFullYear();
  const items = profile.achievements.map(a => {
    const relevance = DISCIPLINE_FIT[a.discipline]?.[spec] ?? 0.7, age = Math.max(0, year - a.year);
    const recency = age <= 2 ? 1 : age <= 4 ? 0.75 : 0.5;
    return {id: a.id, event: a.event, discipline: a.discipline, result: a.result, level: a.level, year: a.year, relevance, recency,
      value: Math.round((LEVELS[a.level] ?? LEVELS.participant) * relevance * recency * 100) / 100};
  }).sort((a, b) => b.value - a.value);
  // The best result counts in full; each further one adds 10%.
  const strength = items.length ? Math.min(1, items[0].value + 0.1 * (items.length - 1)) : 0;
  return {id: profile.id, source: profile.source, points: Math.round(strength * WEIGHTS.fsp), items};
}

const part = (key, label, group, source, points, max, note) => ({key, label, group, source, points, max, note});
const money = n => `${Number(n).toLocaleString('ru-RU')} ₽`;
// Every candidate in the catalogue has passed the 67-point threshold, so a linear
// 0–100 scale would hide differences: 67 → 7, 83 → 13, 100 → 20 points.
const testShare = score => Math.min(1, Math.max(0, ((Number(score) || 0) - 50) / 50));

function profileParts(c, verified, fsp) {
  const best = fsp?.items[0];
  return [
    part('test', 'Результат теста', 'test', 'test', verified ? Math.round(WEIGHTS.test * testShare(c.score)) : 0, WEIGHTS.test,
      verified ? `${c.score}/100; шкала отсчитывается от 50 баллов` : 'Категория не подтверждена тестом'),
    part('fsp', 'Достижения ФСП', 'fsp', 'fsp', fsp?.points || 0, WEIGHTS.fsp,
      !fsp ? 'Нет данных ФСП — остальные баллы не снижаются' : best ? `${best.result} · ${best.event} · ${best.year}${fsp.items.length > 1 ? ` и ещё ${fsp.items.length - 1}` : ''}` : 'ФСП ID привязан, достижений пока нет'),
  ];
}
function contextParts(c, need) {
  const parts = [];
  if (!need.format) parts.push(part('format', 'Формат работы', 'context', 'resume', WEIGHTS.format, WEIGHTS.format, 'Не указан в потребности'));
  else {
    const own = FORMATS.includes(c.format) ? c.format : 'Удалённо';
    let share = own === need.format ? 1 : own === 'Гибрид' || need.format === 'Гибрид' ? 0.5 : 0;
    let note = own === need.format ? `${own} — совпадает` : `Кандидат предпочитает: ${own.toLowerCase()}`;
    // Office and hybrid work also need the same city.
    if (need.format !== 'Удалённо' && need.city && c.city && fold(c.city) !== fold(need.city)) {
      share /= 2;
      note += `; город ${c.city}`;
    }
    parts.push(part('format', 'Формат работы', 'context', 'resume', Math.round(WEIGHTS.format * share), WEIGHTS.format, note));
  }
  const ask = Number(c.min) > 0 ? Number(c.min) : Number(c.max) > 0 ? Number(c.max) : null;
  if (!need.budgetMin && !need.budgetMax) parts.push(part('salary', 'Зарплатные ожидания', 'context', 'resume', WEIGHTS.salary, WEIGHTS.salary, 'Бюджет не указан'));
  else if (ask === null) parts.push(part('salary', 'Зарплатные ожидания', 'context', 'resume', WEIGHTS.salary / 2, WEIGHTS.salary, 'Кандидат не указал ожидания'));
  else if (need.budgetMax && ask > need.budgetMax) {
    // Points fade out linearly and reach zero 30% above the budget.
    const over = (ask - need.budgetMax) / need.budgetMax;
    parts.push(part('salary', 'Зарплатные ожидания', 'context', 'resume', Math.round(WEIGHTS.salary * Math.max(0, 1 - over / 0.3)), WEIGHTS.salary,
      `От ${money(ask)} — выше бюджета на ${Math.max(1, Math.round(over * 100))}%`));
  } else parts.push(part('salary', 'Зарплатные ожидания', 'context', 'resume', WEIGHTS.salary, WEIGHTS.salary, `От ${money(ask)} — в пределах бюджета`));
  if (!need.domains.length) parts.push(part('domain', 'Предметная область', 'context', 'resume', WEIGHTS.domain, WEIGHTS.domain, 'Не указана в потребности'));
  else {
    const own = new Set(domainsIn(fold(`${c.about || ''} ${c.work || ''}`)).map(domain => domain.key));
    const shared = need.domains.filter(domain => own.has(domain.key));
    parts.push(part('domain', 'Предметная область', 'context', 'resume', Math.round(WEIGHTS.domain * Math.min(1, shared.length / Math.min(2, need.domains.length))), WEIGHTS.domain,
      shared.length ? `В резюме: ${shared.map(domain => /^\p{Lu}{2}/u.test(domain.label) ? domain.label : domain.label[0].toLowerCase() + domain.label.slice(1)).join(', ')}` : 'В резюме нет упоминаний'));
  }
  return parts;
}

// `c` must be the employer-facing projection (publicCandidate): an FSP history
// the candidate hid is already null there and cannot move the ranking.
export function matching(c, need, now = Date.now(), semanticCorpus = []) {
  const verified = c.verified !== false, fsp = fspSignal(c.fsp, need?.spec || c.spec, now);
  const profile = profileParts(c, verified, fsp), strength = profile[0].points + profile[1].points;
  const best = fsp?.items[0], fspReason = fsp?.points ? `ФСП +${fsp.points}: ${best.result}, ${best.year}` : null;
  if (!need) return {score: null, strength, relation: null, parts: profile, matched: [], fsp,eligibility:null,semantic:null,
    reasons: [verified?`Тест ${c.score}/100`:'Категория не подтверждена тестом', fspReason].filter(Boolean)};
  need = {stack: [],requiredStack:[],preferredStack:[], adjacent: [], domains: [], ...need};
  const eligibility=evaluateHardFilters(c,need);
  const semantic=tfidfSimilarity(`${need.text||''} ${need.team||''}`,candidateSemanticText(c),semanticCorpus);
  const relation = verified ? categoryRelation(c.spec, c.grade, need) : 'other';
  const own = new Set(stackNames(c.stack).map(fold)), matched = need.stack.filter(name => own.has(fold(name)));
  const missing = need.stack.filter(name => !matched.includes(name));
  const step = Math.abs(GRADES.indexOf(c.grade) - GRADES.indexOf(need.grade)), sameSpec = c.spec === need.spec, nearSpec = need.adjacent.includes(c.spec);
  const parts = [
    part('spec', 'Специализация', 'category', 'test', !verified ? 0 : sameSpec ? WEIGHTS.spec : nearSpec ? Math.round(WEIGHTS.spec * ADJACENT_SPEC) : 0, WEIGHTS.spec,
      !verified ? 'Не подтверждена тестом' : sameSpec ? `${c.spec} — подтверждено тестом` : nearSpec ? `${c.spec} — смежное с ${need.spec}` : `${c.spec} вместо ${need.spec}`),
    part('grade', 'Грейд', 'category', 'test', !verified ? 0 : step === 0 ? WEIGHTS.grade : step === 1 ? Math.round(WEIGHTS.grade * ADJACENT_GRADE) : 0, WEIGHTS.grade,
      !verified ? 'Не подтверждён тестом' : step === 0 ? `${c.grade} — подтверждено тестом` : `${c.grade} вместо ${need.grade}`),
    part('stack', 'Технологии', 'stack', 'resume', need.stack.length ? Math.round(WEIGHTS.stack * matched.length / need.stack.length) : WEIGHTS.stack, WEIGHTS.stack,
      need.stack.length ? `${matched.length} из ${need.stack.length}${matched.length ? `: ${matched.join(', ')}` : ''}${missing.length ? `; нет ${missing.join(', ')}` : ''}` : 'Не указаны в потребности'),
    ...profile,
    ...contextParts(c, need),
  ];
  const context = parts.filter(p => ['format', 'salary'].includes(p.key) && p.points < p.max).map(p => p.note);
  const domain = parts.find(p => p.key === 'domain');
  return {
    score: parts.reduce((sum, p) => sum + p.points, 0), strength, relation, parts, matched, fsp,eligibility,
    semantic:{score:Math.round(semantic.score*100),terms:semantic.terms},
    reasons: [
      {exact: `Подтверждён ${c.spec} · ${c.grade}`, higher: `Грейд выше запроса: ${c.grade}`, lower: `Грейд ниже запроса: ${c.grade}`, adjacent: `Смежное направление: ${c.spec}`}[relation]
        || (verified ? `Другая категория: ${c.spec} · ${c.grade}` : 'Категория не подтверждена тестом'),
      need.stack.length ? matched.length ? `Совпадают ${matched.join(', ')}` : 'Нет совпадений по стеку' : null,
      `Тест ${c.score}/100`, fspReason,
      ...context,
      semantic.terms.length?`По смыслу совпадают: ${semantic.terms.join(', ')}`:'Смысловых совпадений в описании не найдено',
      need.domains.length && domain.points ? domain.note : null,
    ].filter(Boolean),
  };
}

export const categoryKey = (spec, grade) => `${spec}|${grade}`;

function relationReason(relation, count, coverage, need, asks) {
  if (relation === 'exact') return count ? 'Точное совпадение с потребностью' : 'Пока нет подтверждённых кандидатов — посмотрите смежные категории';
  if (relation === 'higher') return need.budgetMax && asks.length && Math.min(...asks) > need.budgetMax ? 'Опытнее запрошенного уровня; ожидания выше бюджета' : 'Опытнее запрошенного уровня';
  if (relation === 'lower') return 'Меньше опыта, ниже ожидания — можно вырастить в команде';
  return coverage.length ? `Смежное направление: общие ${coverage.join(', ')}` : 'Смежное направление по описанию задачи';
}

// Without a need the employer browses every non-empty category. With a need the
// requested category always comes first, even when it is still empty, followed
// by the strongest neighbours: one grade up or down, or a related specialization.
export function recommendCategories(rows, need, limit = 4) {
  const groups = new Map();
  for (const row of rows) groups.set(categoryKey(row.spec, row.grade), [...(groups.get(categoryKey(row.spec, row.grade)) || []), row]);
  const items = [];
  for (const spec of SPECS) for (const grade of GRADES) {
    const people = groups.get(categoryKey(spec, grade)) || [];
    const relation = need ? categoryRelation(spec, grade, {adjacent: [], ...need}) : 'all';
    if (relation === 'other' || (relation !== 'exact' && !people.length)) continue;
    const asks = people.map(p => Number(p.min)).filter(n => n > 0), caps = people.map(p => Number(p.max)).filter(n => n > 0);
    const coverage = need ? (need.stack || []).filter(name => people.some(p => p.match?.matched?.includes(name))) : [];
    items.push({
      key: categoryKey(spec, grade), spec, grade, relation, count: people.length,
      withFsp: people.filter(p => p.fsp?.achievements?.length).length,
      best: people.reduce((best, p) => Math.max(best, (need ? p.match?.score : p.match?.strength) || 0), 0),
      averageTest: people.length ? Math.round(people.reduce((sum, p) => sum + Number(p.score || 0), 0) / people.length) : null,
      salary: asks.length ? {min: Math.min(...asks), max: Math.max(...(caps.length ? caps : asks))} : null,
      inBudget: need?.budgetMax ? people.filter(p => !(Number(p.min) > need.budgetMax)).length : null,
      coverage, reason: need ? relationReason(relation, people.length, coverage, need, asks) : null,
    });
  }
  if (!need) return items;
  const order = {exact: 0, higher: 1, adjacent: 2, lower: 3};
  return items.sort((a, b) => (b.relation === 'exact') - (a.relation === 'exact') || b.best - a.best || order[a.relation] - order[b.relation] || b.count - a.count).slice(0, limit);
}

// Category first, then the match score; profile strength (test + FSP) breaks ties.
export function rankCandidates(rows, need, categories = []) {
  const position = new Map(categories.map((category, i) => [category.key, i]));
  const at = row => position.get(categoryKey(row.spec, row.grade)) ?? categories.length;
  const eligibility={pass:0,unknown:1,fail:2};
  return [...rows].sort((a, b) => (need ? (eligibility[a.match.eligibility?.status]??1)-(eligibility[b.match.eligibility?.status]??1) || (b.match.semantic?.score||0)-(a.match.semantic?.score||0) || at(a) - at(b) || b.match.score - a.match.score : 0)
    || b.match.strength - a.match.strength || b.score - a.score || String(a.id).localeCompare(String(b.id)));
}
