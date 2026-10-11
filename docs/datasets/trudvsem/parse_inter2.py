#!/usr/bin/env python3
"""Format-agnostic streaming parser for trudvsem response/invitation XML (old single-line and new multi-line formats)."""
import sys, re, gzip, json, collections, time
name = sys.argv[1]
endtag = re.compile(r"</(response|invitation)>")
fld = re.compile(r"<(id|identifier|idCv|idVacancy|candidateId|creationDate|dateModify|candidate|manager|isNew|responseType)\s*>([^<]*)</\1\s*>")
out = gzip.open(f"{name}_ids.tsv.gz", "wt", compresslevel=3)
out.write("id\tidVacancy\tidCv\tcandidateId\tresponseType\tisNew\tcreation\tmodify\n")
cnt = collections.Counter(); months = collections.Counter(); years_type = collections.Counter()
n = 0; mind, maxd = "9999", "0000"; buf = ""; t0 = time.time()
inp = sys.stdin
while True:
    chunk = inp.read(1 << 22)
    if not chunk and not buf: break
    buf += chunk
    parts = endtag.split(buf)
    # split returns [rec, tagname, rec, tagname, ..., rest]
    recs = parts[0:-1:2]; buf = parts[-1]
    for r in recs:
        d = {}
        for k, v in fld.findall(r):
            if k == "identifier" and "id" in d: continue
            if k == "identifier": k = "id"
            d.setdefault(k, v)
        n += 1
        cd = d.get("creationDate", "")
        if cd:
            mind = min(mind, cd); maxd = max(maxd, cd); months[cd[:7]] += 1
        cnt[d.get("responseType", "<missing>")] += 1
        years_type[(cd[:4], d.get("responseType", ""))] += 1
        out.write("\t".join([d.get("id", ""), d.get("idVacancy", ""), d.get("idCv", ""), d.get("candidateId", ""), d.get("responseType", ""), d.get("isNew", ""), cd[:19], d.get("dateModify", "")[:19]]) + "\n")
    if not chunk: break
out.close()
json.dump({"records": n, "min": mind, "max": maxd, "responseType": cnt.most_common(), "months": sorted(months.items()),
           "years_type": sorted([[k[0], k[1], v] for k, v in years_type.items()])}, open(f"{name}_stats.json", "w"), ensure_ascii=False, indent=1)
print("DONE", name, n, mind, maxd, round(time.time() - t0), file=sys.stderr)
