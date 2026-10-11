import sys, re, gzip, time
name=sys.argv[1]
end=re.compile(r"</vacancy>")
fld=re.compile(r"<(id|identifier|vacancyName|title|codeProfessionalSphere|codeProfession|creationDate)\s*>([^<]*)</\1\s*>")
out=gzip.open(f"{name}_vac.tsv.gz","wt"); n=0; buf=""; t0=time.time()
while True:
    ch=sys.stdin.read(1<<22)
    if not ch and not buf: break
    buf+=ch; parts=end.split(buf); recs=parts[:-1]; buf=parts[-1]
    for r in recs:
        d={}
        for k,v in fld.findall(r):
            if k=='identifier': k='id'
            if k=='title': k='vacancyName'
            d.setdefault(k,v)
        n+=1
        out.write("\t".join([d.get('id',''),d.get('codeProfessionalSphere',''),d.get('codeProfession',''),d.get('vacancyName','').replace('\t',' '),d.get('creationDate','')[:10]])+"\n")
    if not ch: break
out.close(); print("DONE",name,n,round(time.time()-t0),file=sys.stderr)
