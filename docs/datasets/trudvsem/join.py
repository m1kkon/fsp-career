import gzip, json, collections, sys, glob
sys.path.insert(0, ".")
from classify import classify

def rows(fn):
    try:
        with gzip.open(fn, "rt") as f:
            for line in f:
                yield line.rstrip("\n").split("\t")
    except EOFError:
        print("warn: truncated", fn, file=sys.stderr)

# ---- vacancies
V = {}
for fn in ["vac_all_part1.tsv.gz", "vac_all_part2.tsv.gz"] + sorted(glob.glob("vac_s*_all.tsv.gz")):
    for p in rows(fn):
        if len(p) < 13: continue
        V[p[0]] = p
print("distinct vacancies in dump:", len(V))
vcls = {}
vstat = collections.Counter(); sphere_c = collections.Counter(); src_c = collections.Counter()
for vid, p in V.items():
    tags, core, it_sph = classify(p[3], p[1])
    one_c = "1c" in tags
    cls = "core" if core else ("1c" if one_c else ("sysadmin" if "sysadmin" in tags else ("it_sphere_other" if it_sph else "non_it")))
    vcls[vid] = (cls, it_sph, tuple(sorted(tags)))
    vstat[cls] += 1; sphere_c[p[1]] += 1
    if core: src_c[p[4]] += 1
    for t in tags: vstat["tag_" + t] += 1
    if core and it_sph: vstat["core_and_it_sphere"] += 1
    if it_sph: vstat["it_sphere_total"] += 1
print("vacancy classes:", dict(vstat))
print("core IT vacancy sourceType:", dict(src_c))

# ---- CV sample
cvs = {}
for p in rows("cvsample_all.tsv.gz"):
    tags, core, it_sph = classify(p[2], p[1])
    cls = "core" if core else ("1c" if "1c" in tags else ("sysadmin" if "sysadmin" in tags else ("it_sphere_other" if it_sph else "non_it")))
    cvs[p[0]] = cls
st = json.load(open("cvsample_stats.json")); f = st["bytes_ok"] / st["file_size"]

out = {"n_vacancies_dump": len(V), "vac_classes": dict(vstat), "cv_sample_fraction": f}
for name in ["response", "invitation"]:
    c = collections.Counter(); dv = collections.defaultdict(set); dcv = collections.defaultdict(set)
    res_rec = 0; n = 0; by_year_res = collections.Counter(); by_year = collections.Counter()
    cvside = collections.Counter(); cvside_type = collections.Counter(); both = collections.Counter()
    month_core = collections.Counter()
    for p in rows(f"{name}_ids.tsv.gz"):
        if p[0] == "id": continue
        n += 1
        vid, cvid, rtype, cdate = p[1], p[2], p[5], p[10]
        yr = cdate[:7] if cdate else "?"
        by_year[cdate[:4]] += 1
        vc = vcls.get(vid)
        if vc:
            res_rec += 1; by_year_res[cdate[:4]] += 1
            cls = vc[0]
            c[(cls, rtype)] += 1; dv[cls].add(vid); dcv[cls].add(cvid)
            if vc[1]: c[("it_sphere_any", rtype)] += 1; dv["it_sphere_any"].add(vid); dcv["it_sphere_any"].add(cvid)
            if cls == "core": month_core[cdate[:7]] += 1
        else:
            c[("unresolved", rtype)] += 1
        if cvid in cvs:
            cc = cvs[cvid]
            cvside[cc] += 1; cvside_type[(cc, rtype)] += 1
            both[(cc, vc[0] if vc else "unresolved")] += 1
    o = {"records": n, "vacancy_resolved_records": res_rec, "vacancy_resolved_share": round(res_rec / n, 4),
         "resolved_share_by_year": {y: round(by_year_res[y] / by_year[y], 4) for y in sorted(by_year)},
         "by_class_type": {f"{k[0]}|{k[1]}": v for k, v in sorted(c.items())},
         "distinct_vacancies_by_class": {k: len(v) for k, v in dv.items()},
         "distinct_cvs_by_class": {k: len(v) for k, v in dcv.items()},
         "core_by_month": sorted(month_core.items()),
         "cv_sample_hits_records_by_cvclass": dict(cvside),
         "cv_sample_hits_by_cvclass_type": {f"{k[0]}|{k[1]}": v for k, v in cvside_type.items()},
         "cv_sample_hits_cvclass_x_vacclass": {f"{k[0]}|{k[1]}": v for k, v in both.items()},
         "cv_side_extrapolated_records_by_cvclass": {k: round(v / f) for k, v in cvside.items()},
         }
    out[name] = o
    print(name, json.dumps(o, ensure_ascii=False, indent=1))
json.dump(out, open("join_summary.json", "w"), ensure_ascii=False, indent=1)
