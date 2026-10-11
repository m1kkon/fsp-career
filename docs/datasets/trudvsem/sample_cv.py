#!/usr/bin/env python3
"""Random-offset chunk sampling of cv.json (43.9 GB) via HTTP Range.
For each chunk: parse whole CV records, record (id, spheres, title) for every CV, flag membership of CV id in the
interaction idCv sets (responses / invitations), and keep sanitized copies of IT-ish CVs (no PII) for field analysis.
Usage: python3 sample_cv.py N_CHUNKS CHUNK_BYTES SEED"""
import sys, json, gzip, re, random, subprocess, collections, time, concurrent.futures as cf
sys.path.insert(0, ".")
URL = "https://opendata.trudvsem.ru/json/cv.json"
SIZE = 43877791420
N, CH, SEED = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
from common import IT_RE, sanit_cv

def load_ids(fn, col):
    s = set()
    with gzip.open(fn, "rt") as f:
        next(f)
        for line in f:
            p = line.split("\t")
            if p[col]:
                s.add(p[col])
    return s
resp_cv = load_ids("response_ids.tsv.gz", 2)
inv_cv = load_ids("invitation_ids.tsv.gz", 2)
print("loaded", len(resp_cv), len(inv_cv), file=sys.stderr, flush=True)
rnd = random.Random(SEED)
offs = sorted(rnd.randrange(0, SIZE - CH) for _ in range(N))
dec = json.JSONDecoder()

def fetch(off):
    for attempt in range(3):
        r = subprocess.run(["curl", "-s", "--max-time", "300", "-r", f"{off}-{off+CH-1}", URL], capture_output=True)
        if len(r.stdout) > CH * 0.9:
            return off, r.stdout.decode("utf-8", "replace")
    return off, ""

def parse(buf):
    m = re.search(r'\},\s*\{"id": "', buf)
    if not m:
        return []
    pos = m.start() + 1
    out = []
    while True:
        while pos < len(buf) and buf[pos] in " ,\n\r\t":
            pos += 1
        try:
            o, pos = dec.raw_decode(buf, pos)
        except json.JSONDecodeError:
            break
        if "candidateId" in o:
            out.append(o)
    return out

allf = gzip.open(f"cvsample_all.tsv.gz", "wt")
itf = gzip.open(f"cvsample_it.jsonl.gz", "wt")
hitf = gzip.open(f"cvsample_hits.jsonl.gz", "wt")
n = bytes_ok = 0
t0 = time.time()
with cf.ThreadPoolExecutor(3) as ex:
    for off, buf in ex.map(fetch, offs):
        if not buf:
            continue
        bytes_ok += len(buf.encode("utf-8", "replace"))
        for o in parse(buf):
            n += 1
            sps = sorted({p.get("codeProfessionalSphere", "") for p in o.get("professionList") or []})
            title = (o.get("positionName") or "").replace("\t", " ").replace("\n", " ")
            inr, ini = o["id"] in resp_cv, o["id"] in inv_cv
            allf.write("\t".join([o["id"], ",".join(sps), title, str(int(inr)), str(int(ini)),
                                  (o.get("dateModify") or "")[:10], (o.get("dateCreate") or "")[:10]]) + "\n")
            isit = "InformationTechnology" in sps or bool(IT_RE.search(title))
            if isit:
                itf.write(json.dumps(sanit_cv(o), ensure_ascii=False) + "\n")
            if inr or ini:
                hitf.write(json.dumps(sanit_cv(o), ensure_ascii=False) + "\n")
        print(f"chunk@{off}: total cvs {n}, bytes {bytes_ok}, {time.time()-t0:.0f}s", file=sys.stderr, flush=True)
allf.close(); itf.close(); hitf.close()
json.dump({"chunks": N, "chunk_bytes": CH, "bytes_ok": bytes_ok, "cvs": n, "file_size": SIZE,
           "resp_cv_distinct": len(resp_cv), "inv_cv_distinct": len(inv_cv)}, open("cvsample_stats.json", "w"))
print("DONE", n, file=sys.stderr)
