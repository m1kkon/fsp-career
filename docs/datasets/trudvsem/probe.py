import sys, re, subprocess, concurrent.futures as cf
URL="https://opendata.trudvsem.ru/json/cv.json"; SIZE=int(sys.argv[1]); N=int(sys.argv[2])
rx=re.compile(r'\{"id": "([0-9a-f-]{36})", "candidateId"')
def get(off):
    d=subprocess.run(["curl","-s","-r",f"{off}-{off+16000}",URL],capture_output=True).stdout.decode('utf-8','replace')
    ids=rx.findall(d)
    return off, ids[:3]
offs=[int(SIZE*i/N) for i in range(N)]
with cf.ThreadPoolExecutor(8) as ex:
    res=sorted(ex.map(get,offs))
for off,ids in res: print(off, " ".join(ids))
