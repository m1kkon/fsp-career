import sys, gzip, re, time
out=gzip.open('vacxml2025_all.tsv.gz','wt')
rx=re.compile(r'^<(id|vacancyName|codeProfessionalSphere|codeProfession|creationDate)>(.*)</\1>')
rec=None; n=0; t0=time.time()
def flush(r):
    out.write('\t'.join([r.get('id',''), r.get('codeProfessionalSphere',''), r.get('codeProfession',''), r.get('vacancyName','').replace('\t',' '), r.get('creationDate','')[:10]])+'\n')
for line in sys.stdin:
    if line.startswith('<vacancy typeof='):
        if rec: flush(rec); n+=1
        rec={}
        continue
    if rec is None: continue
    m=rx.match(line)
    if m and m.group(1) not in rec: rec[m.group(1)]=m.group(2)
    if n and n%100000==0 and rec=={}: pass
if rec: flush(rec); n+=1
out.close(); print('DONE', n, round(time.time()-t0), file=sys.stderr)
