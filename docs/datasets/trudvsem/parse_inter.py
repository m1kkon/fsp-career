#!/usr/bin/env python3
"""Stream trudvsem response/invitation XML from stdin; output stats JSON + compact ID TSV (gz).
Usage: curl ... | gunzip | python3 parse_inter.py <name>
Only pseudonymous IDs, enums and dates are kept (no PII is present in these feeds anyway)."""
import sys, re, json, gzip, collections, time

name = sys.argv[1]
out = gzip.open(f"{name}_ids.tsv.gz", "wt", compresslevel=3)
out.write("id\tidVacancy\tidCv\tcandidateId\tidCompany\tresponseType\tisNew\tdeleted\tcandidate\tmanager\tcreation\tmodify\tregion\n")
fld = re.compile(r"^<(\w+)>(.*)</\1>\s*$")
selfclose = re.compile(r"^<(\w+)\s*/>\s*$")
enum_fields = ["candidate", "manager", "isNew", "responseType", "deleted"]
cnt = {f: collections.Counter() for f in enum_fields}
combo = collections.Counter()
months = collections.Counter()
months_by_type = collections.Counter()
tags = collections.Counter()
n = 0
mind, maxd = "9999", "0000"
modified_diff = 0
empty_vac = empty_cv = 0
rec = {}
rec_tag = None
t0 = time.time()
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    if 'typeof="' in line and line.startswith("<") and not line.startswith("<link"):
        rec_tag = line[1:line.index(" ")]
        rec = {}
        continue
    m = fld.match(line)
    if m:
        rec[m.group(1)] = m.group(2)
        tags[m.group(1)] += 1
        continue
    m = selfclose.match(line)
    if m:
        rec[m.group(1)] = ""
        tags[m.group(1)] += 1
        continue
    if rec_tag and line == f"</{rec_tag}>":
        n += 1
        for f in enum_fields:
            cnt[f][rec.get(f, "<missing>")] += 1
        combo[(rec.get("responseType"), rec.get("isNew"), rec.get("deleted"), rec.get("candidate"), rec.get("manager"))] += 1
        cd = rec.get("creationDate", "")
        md = rec.get("dateModify", "")
        if cd:
            mind = min(mind, cd); maxd = max(maxd, cd)
            months[cd[:7]] += 1
            months_by_type[(cd[:7], rec.get("responseType"))] += 1
        if md and md != cd:
            modified_diff += 1
        if not rec.get("idVacancy"):
            empty_vac += 1
        if not rec.get("idCv"):
            empty_cv += 1
        out.write("\t".join([rec.get("id", ""), rec.get("idVacancy", ""), rec.get("idCv", ""), rec.get("candidateId", ""),
                             rec.get("idCompany", ""), rec.get("responseType", ""), rec.get("isNew", ""), rec.get("deleted", ""),
                             rec.get("candidate", ""), rec.get("manager", ""), cd[:19], md[:19], rec.get("regionCode", "")]) + "\n")
        rec = {}
        if n % 500000 == 0:
            print(f"{name}: {n} recs, {time.time()-t0:.0f}s, last date {cd}", file=sys.stderr, flush=True)
out.close()
res = {
    "records": n, "min_creationDate": mind, "max_creationDate": maxd,
    "dateModify_differs": modified_diff, "empty_idVacancy": empty_vac, "empty_idCv": empty_cv,
    "enums": {f: cnt[f].most_common() for f in enum_fields},
    "combos": [[list(k), v] for k, v in combo.most_common()],
    "months": sorted(months.items()),
    "months_by_type": sorted([[k[0], k[1], v] for k, v in months_by_type.items()]),
    "tags": tags.most_common(), "elapsed_s": round(time.time() - t0),
}
json.dump(res, open(f"{name}_stats.json", "w"), ensure_ascii=False, indent=1)
print(f"DONE {name}: {n} records in {time.time()-t0:.0f}s", file=sys.stderr)
