import {salaryRangeFit,salaryRangeLabel} from './salary-range.mjs';
import {GRADES} from './taxonomy.mjs';
import {candidateResumeSkills} from './resume-fit.mjs';

export const LANGUAGE_LEVELS = ['A1','A2','B1','B2','C1','C2'];
export const EXPERIENCE_LEVELS = {
  'Без коммерческого опыта': 0,
  'До 1 года': 0.5,
  '1–3 года': 1,
  '3–5 лет': 3,
  'Более 5 лет': 5,
};

const fold = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g,'е');
const unique = values => [...new Map(values.filter(Boolean).map(value => [fold(value), value])).values()];
const rank = (values,value) => values.indexOf(value);
const result = (id,label,status,expected,actual,source) => ({id,label,status,expected,actual,source});

export function candidateAtsProfile(candidate = {}) {
  const ats = candidate.ats || {};
  const languages = Array.isArray(ats.languages) ? ats.languages : [];
  const acceptedFormats = Array.isArray(ats.acceptedFormats) && ats.acceptedFormats.length ? ats.acceptedFormats : [candidate.format].filter(Boolean);
  return {
    specializations: unique([candidate.spec,...(ats.specializations || [])]),
    verifiedSpecialization: candidate.spec || null,
    grade: candidate.grade || null,
    skills: candidateResumeSkills(candidate),
    languages,
    experienceYears: ats.experienceYears !== null && ats.experienceYears !== undefined && ats.experienceYears !== '' && Number.isFinite(Number(ats.experienceYears)) ? Number(ats.experienceYears) : EXPERIENCE_LEVELS[candidate.experience] ?? null,
    acceptedFormats,
    employmentTypes: ats.employmentTypes || [],
    relocation: ats.relocation || null,
    businessTrips: ats.businessTrips || null,
    availableFrom: ats.availableFrom || null,
    city: candidate.city || '',
    salaryMin: Number(candidate.min) || null,
    verifiedCategory: candidate.verified !== false,
  };
}

export function requirementsFromNeed(need = {}) {
  if (Array.isArray(need.requirements)) return need.requirements;
  const requiredStack = need.requiredStack || [];
  return [
    need.spec && {id:'spec',field:'spec',kind:'category',operator:'oneOf',value:[need.spec],label:'Специализация',required:true},
    need.grade && {id:'grade',field:'grade',kind:'ordinal',operator:'atLeast',value:need.grade,label:'Подтверждённый уровень',required:true},
    ...requiredStack.map((value,index)=>({id:`skill-${index}`,field:'skill',kind:'category',operator:'contains',value,label:`Навык: ${value}`,required:true,acceptedSources:['test','resume','candidate']})),
    need.englishLevel && {id:'english',field:'language',kind:'ordinal',operator:'atLeast',language:'Английский',value:need.englishLevel,label:'Английский язык',required:true},
    Number(need.minExperience) > 0 && {id:'experience',field:'experience',kind:'number',operator:'atLeast',value:Number(need.minExperience),label:'Коммерческий опыт',required:true},
    need.formatRequired && need.format && {id:'format',field:'format',kind:'category',operator:'contains',value:need.format,label:'Формат работы',required:true},
    need.locationRequired && need.city && {id:'city',field:'city',kind:'category',operator:'location',value:need.city,label:'Локация',required:true},
    need.salaryRequired && (need.budgetMin||need.budgetMax) && {id:'salary',field:'salary',kind:'range',operator:'overlaps',value:{budgetMin:need.budgetMin,budgetMax:need.budgetMax},label:'Зарплатные ожидания',required:true},
  ].filter(Boolean);
}

export function evaluateHardFilters(candidate,need) {
  const profile = candidateAtsProfile(candidate), checks = [];
  for (const requirement of requirementsFromNeed(need)) {
    if (requirement.field === 'spec') {
      const actual = profile.verifiedSpecialization;
      checks.push(!profile.verifiedCategory || !actual
        ? result(requirement.id,requirement.label,'unknown',requirement.value.join(', '),'Не подтверждено','анкета')
        : result(requirement.id,requirement.label,requirement.value.includes(actual)?'pass':'fail',requirement.value.join(', '),actual,'подтверждено тестом'));
    } else if (requirement.field === 'grade') {
      const actualRank=rank(GRADES,profile.grade), expectedRank=rank(GRADES,requirement.value);
      checks.push(!profile.verifiedCategory || actualRank<0?result(requirement.id,requirement.label,'unknown',`не ниже ${requirement.value}`,'Не подтверждён','тест')
        : result(requirement.id,requirement.label,actualRank>=expectedRank?'pass':'fail',`не ниже ${requirement.value}`,profile.grade,'подтверждено тестом'));
    } else if (requirement.field === 'skill') {
      const found=profile.skills.find(value=>fold(value)===fold(requirement.value));
      checks.push(result(requirement.id,requirement.label,found?'pass':'fail',requirement.value,found||'Не указан','резюме или анкета'));
    } else if (requirement.field === 'language') {
      const language=profile.languages.find(item=>fold(item.name)===fold(requirement.language));
      const actualRank=rank(LANGUAGE_LEVELS,language?.level), expectedRank=rank(LANGUAGE_LEVELS,requirement.value);
      checks.push(!language?result(requirement.id,requirement.label,'unknown',`не ниже ${requirement.value}`,'Не указан','анкета')
        : result(requirement.id,requirement.label,actualRank>=expectedRank?'pass':'fail',`не ниже ${requirement.value}`,language.level,language.sourceLabel||'указано кандидатом'));
    } else if (requirement.field === 'experience') {
      checks.push(profile.experienceYears===null?result(requirement.id,requirement.label,'unknown',`от ${requirement.value} лет`,'Не указан','анкета')
        : result(requirement.id,requirement.label,profile.experienceYears>=requirement.value?'pass':'fail',`от ${requirement.value} лет`,`${profile.experienceYears} лет`,'анкета'));
    } else if (requirement.field === 'format') {
      checks.push(profile.acceptedFormats.length?result(requirement.id,requirement.label,profile.acceptedFormats.includes(requirement.value)?'pass':'fail',requirement.value,profile.acceptedFormats.join(', '),'анкета')
        : result(requirement.id,requirement.label,'unknown',requirement.value,'Не указан','анкета'));
    } else if (requirement.field === 'city') {
      const same=fold(profile.city)===fold(requirement.value), canMove=['Готов обсудить','Готов к переезду'].includes(profile.relocation);
      checks.push(!profile.city?result(requirement.id,requirement.label,'unknown',requirement.value,'Не указан','анкета')
        : result(requirement.id,requirement.label,same||canMove?'pass':'fail',requirement.value,canMove?`${profile.city}; готовность к переезду` : profile.city,'анкета'));
    } else if (requirement.field === 'salary') {
      const fit=salaryRangeFit(candidate,requirement.value);
      checks.push(result(requirement.id,requirement.label,fit.status,salaryRangeLabel(fit.from,fit.to),salaryRangeLabel(fit.min,fit.max),'резюме'));
    }
  }
  const status=checks.some(check=>check.status==='fail')?'fail':checks.some(check=>check.status==='unknown')?'unknown':'pass';
  return {status,checks,failed:checks.filter(check=>check.status==='fail'),unknown:checks.filter(check=>check.status==='unknown'),passed:checks.filter(check=>check.status==='pass')};
}

const STOP=new Set('и в во на с со по для к ко из от до не но а или это как что при над под мы вы они он она нужен нужна нужны ищем требуется желательно обязательно опыт работа задачи команда проект разработка знание умение'.split(' '));
export function tokens(value) {
  return fold(value).replace(/[^a-zа-я0-9+#.]+/g,' ').split(/\s+/).filter(word=>word.length>1&&!STOP.has(word));
}

export function tfidfSimilarity(left,right,corpus=[]) {
  const a=tokens(left),b=tokens(right),documents=[a,b,...corpus.map(tokens)],total=documents.length;
  if(!a.length||!b.length)return {score:0,terms:[]};
  const df=new Map();for(const document of documents)for(const word of new Set(document))df.set(word,(df.get(word)||0)+1);
  const vector=words=>{const counts=new Map();for(const word of words)counts.set(word,(counts.get(word)||0)+1);const values=new Map();for(const [word,count] of counts)values.set(word,(count/words.length)*(Math.log((total+1)/((df.get(word)||0)+1))+1));return values;};
  const av=vector(a),bv=vector(b),shared=[...av.keys()].filter(word=>bv.has(word));
  const dot=shared.reduce((sum,word)=>sum+av.get(word)*bv.get(word),0),an=Math.sqrt([...av.values()].reduce((sum,value)=>sum+value*value,0)),bn=Math.sqrt([...bv.values()].reduce((sum,value)=>sum+value*value,0));
  return {score:an&&bn?dot/(an*bn):0,terms:shared.sort((x,y)=>av.get(y)*bv.get(y)-av.get(x)*bv.get(x)).slice(0,8)};
}

export function candidateSemanticText(candidate={}) {
  const ats=candidate.ats||{};
  return [candidate.spec,candidate.grade,...(candidate.stack||[]),candidate.about,candidate.work,...(candidate.roles||[]),ats.achievement,ats.taskType,ats.motivation,ats.projectSummary,ats.ambiguityApproach].filter(Boolean).join(' ');
}
