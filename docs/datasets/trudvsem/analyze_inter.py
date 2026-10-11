import gzip, collections, json, datetime, statistics
def load(fn):
    with gzip.open(fn,'rt') as f:
        hdr=next(f).rstrip('\n').split('\t')
        for line in f:
            yield dict(zip(hdr,line.rstrip('\n').split('\t')))
out={}
pairs={}
for name in ['response','invitation']:
    vac=set(); cv=set(); cand=set(); comp=set(); pr=collections.Counter()
    same=collections.Counter(); delay=collections.defaultdict(list); tot=collections.Counter()
    pset={}
    for i,r in enumerate(load(f'{name}_ids.tsv.gz')):
        vac.add(r['idVacancy']); cv.add(r['idCv']); cand.add(r['candidateId']); comp.add(r['idCompany'])
        t=r['responseType']; tot[t]+=1
        if r['creation']==r['modify']: same[t]+=1
        elif r['modify'] and len(delay[t])<200000:
            try:
                a=datetime.datetime.fromisoformat(r['creation']); b=datetime.datetime.fromisoformat(r['modify'])
                delay[t].append((b-a).total_seconds()/86400)
            except Exception: pass
        pset[(r['idCv'],r['idVacancy'])]=t
    pairs[name]=pset
    out[name]={'distinct_idVacancy':len(vac-{''}),'distinct_idCv':len(cv-{''}),'distinct_candidateId':len(cand-{''}),'distinct_idCompany':len(comp-{''}),
      'distinct_pairs':len(pset),
      'modify_eq_creation_by_type':{t:[same[t],tot[t]] for t in tot},
      'median_delay_days_when_modified':{t:round(statistics.median(v),2) for t,v in delay.items() if v}}
    print(name, json.dumps(out[name],ensure_ascii=False))
r,iv=pairs['response'],pairs['invitation']
both=set(r)&set(iv)
print('pairs in both feeds', len(both), collections.Counter(r[p] for p in both))
json.dump(out,open('inter_summary.json','w'),ensure_ascii=False,indent=1)
# kaggle check
ks=json.load(open('kaggle/kaggle_sample_pairs.json'))
c=collections.Counter()
for cvid,vid,st in ks:
    c[(st, r.get((cvid,vid),'NOT_IN_RESPONSES'), 'inv' if (cvid,vid) in iv else '-')]+=1
print('kaggle sample vs feeds:', c.most_common())
