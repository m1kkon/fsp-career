import gzip, json, collections, sys, statistics, glob
sys.path.insert(0,'.')
from classify import classify
def filled(v):
    if v is None: return False
    if isinstance(v,(list,dict,str)): return len(v)>0 and v not in ('', 'Не указано', 'Ничего не выбрано')
    return True
seen=set(); recs=[]
for fn in sorted(glob.glob("vac_it*.jsonl.gz")) + sorted(glob.glob("vac_s*_it.jsonl.gz")):
    try:
        for l in gzip.open(fn,'rt'):
            o=json.loads(l)
            if o['id'] in seen: continue
            seen.add(o['id']); recs.append(o)
    except Exception as e: print('warn', fn, type(e).__name__)
core=[o for o in recs if classify(o.get('vacancyName',''), o.get('codeProfessionalSphere',''))[1]]
print('IT-candidate vacancies', len(recs), 'core', len(core))
keys=collections.Counter(); fill=collections.Counter()
for o in core:
    for k,v in o.items():
        keys[k]+=1
        if filled(v): fill[k]+=1
for k,_ in keys.most_common():
    if fill[k]/len(core)>=0.01: print(f"{k:32s} present={keys[k]/len(core):.2f} filled={fill[k]/len(core):.2f}")
def L(k): return [len(o.get(k) or '') for o in core]
for k in ['requirements','responsibilities','qualifications','positionRequirements','additionalRequirements','otherVacancyBenefit']:
    v=L(k); print(k, 'median len', statistics.median(v), 'share>200', round(sum(1 for x in v if x>200)/len(v),2))
print('hardSkills nonempty', sum(1 for o in core if o.get('hardSkills'))/len(core), 'skills', sum(1 for o in core if o.get('skills'))/len(core), 'softSkills', sum(1 for o in core if o.get('softSkills'))/len(core))
print('busyType', collections.Counter(o.get('busyType') for o in core).most_common())
print('scheduleType', collections.Counter(o.get('scheduleType') for o in core).most_common())
print('experienceRequirements', collections.Counter(o.get('experienceRequirements') for o in core).most_common())
print('sourceType', collections.Counter(o.get('sourceType') for o in core).most_common())
print('codeExternalSystem', collections.Counter(str(o.get('codeExternalSystem'))[:30] for o in core).most_common(6))
print('salaryMin>0', sum(1 for o in core if (o.get('salaryMin') or 0)>0)/len(core), 'salaryMax>salaryMin', sum(1 for o in core if (o.get('salaryMax') or 0)>(o.get('salaryMin') or 0))/len(core), 'median min', statistics.median([o.get('salaryMin') or 0 for o in core]))
print('education', collections.Counter((o.get('educationRequirements') or {}).get('educationType') for o in core).most_common(6))
print('typicalPosition', collections.Counter(o.get('typicalPosition') for o in core).most_common(12))
print('hardSkills top', collections.Counter(s.lower() for o in core for s in (o.get('hardSkills') or [])).most_common(30))
print('regions top', collections.Counter(o.get('regionName') for o in core).most_common(8))
print('titles top', collections.Counter((o.get('vacancyName') or '').lower()[:50] for o in core).most_common(40))
eq=sum(1 for o in core if o.get('requirements') and o.get('requirements')==o.get('qualifications')==o.get('positionRequirements'))
print('requirements==qualifications==positionRequirements share', round(eq/len(core),3))
print('benefit filled', round(sum(1 for o in core if o.get('benefit'))/len(core),3), 'conditions', collections.Counter(str(o.get('conditions'))[:30] for o in core).most_common(5))
print('skills dup-pairs share (list = 2x same half)', round(sum(1 for o in core if o.get('skills') and len(o['skills'])%2==0 and o['skills'][:len(o['skills'])//2]==o['skills'][len(o['skills'])//2:])/max(1,sum(1 for o in core if o.get('skills'))),3))
print('top skills', collections.Counter(s.lower() for o in core for s in set(o.get('skills') or [])).most_common(25))
print('creation year', collections.Counter((o.get('creationDate') or '')[:4] for o in core).most_common())
print('companyBusinessSize', collections.Counter(o.get('companyBusinessSize') for o in core).most_common())
