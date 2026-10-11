#!/usr/bin/env python3
"""Stream a trudvsem JSON dump ({"vacancies":[...]} or {"cvs":[...]}) from stdin.
mode=vac : write compact table for ALL vacancies (id, sphere, profession code, title, source, dates)
           + sanitized full records (no contacts / company identifiers / address) for IT-candidate vacancies.
mode=cv  : write compact table (id, candidateId, spheres, positionName) for all CVs
           + sanitized IT-candidate CVs (no birthday/locality/companyName/institute/contacts).
Works on a full stream or on a byte-range chunk (skips to first record boundary)."""
import sys, json, gzip, re, time, collections

mode, outprefix = sys.argv[1], sys.argv[2]
chunked = len(sys.argv) > 3 and sys.argv[3] == "chunk"
IT_RE = re.compile(r"программист|разработчик|developer|программирован|python|java|frontend|front-end|фронтенд|backend|back-end|"
                   r"бэкенд|бекенд|devops|девопс|тестировщик|\bqa\b|тестированию по|data scien|data engineer|machine learning|"
                   r"\bml\b|машинн\w* обуч|\b1[сc]\b|1[сc]:|1[сc]-|системный администратор|сисадмин|администратор баз|\bdba\b|"
                   r"\bweb\b|\bвеб|full.?stack|\bphp\b|golang|\bgo\b|c\+\+|c#|\.net|android|\bios\b|\bsre\b|kubernetes|"
                   r"системный аналитик|бизнес.аналитик|аналитик данных|архитектор по|архитектор ит|архитектор информ|"
                   r"тимлид|team ?lead|\bit\b|\bит\b|it-|ит-|информационн\w* технолог|информационн\w* безопас|"
                   r"инженер.программист|техник.программист|программн\w* обеспеч|\bsql\b|битрикс|bitrix|верстальщик|"
                   r"ux|ui|дизайнер интерфейс|product manager|продакт|scrum|аналитик", re.I)

def sanit_vac(o):
    drop = {"contactPerson", "contactList", "company", "fullCompanyName", "vacancyAddress", "vacancyAddressHouse",
            "vacancyAddressAdditionalInfo", "geo", "vacancyUrl", "addressCode", "companyCode", "inn", "ogrn", "kpp", "email"}
    return {k: v for k, v in o.items() if k not in drop}

def sanit_cv(o):
    drop = {"birthday", "locality", "localityName", "certifyingDocuments", "innerInfo", "otherCertificates"}
    r = {k: v for k, v in o.items() if k not in drop}
    r["workExperienceList"] = [{k: v for k, v in w.items() if k != "companyName"} for w in o.get("workExperienceList") or []]
    r["educationList"] = [{k: v for k, v in e.items() if k != "instituteName"} for e in o.get("educationList") or []]
    r["additionalEducationList"] = [{k: v for k, v in e.items() if k not in ("instituteName", "courseName")}
                                    for e in o.get("additionalEducationList") or []]
    return r

dec = json.JSONDecoder()
inp = sys.stdin
buf = inp.read(1 << 22)
if chunked:
    # skip to first record boundary (start of an object with "id" at top level)
    m = re.search(r'\},\s*\{"id": "', buf)
    pos = m.start() + 1
else:
    pos = buf.index("[") + 1
tab = gzip.open(f"{outprefix}_all.tsv.gz", "wt", compresslevel=3)
itf = gzip.open(f"{outprefix}_it.jsonl.gz", "wt", compresslevel=3)
n = nit = 0
spheres = collections.Counter()
keyfill = collections.Counter()
t0 = time.time()
eof = False
while True:
    while pos < len(buf) and buf[pos] in " ,\n\r\t":
        pos += 1
    if pos < len(buf) and buf[pos] == "]":
        break
    try:
        o, end = dec.raw_decode(buf, pos)
    except json.JSONDecodeError:
        if eof:
            break
        more = inp.read(1 << 22)
        if not more:
            eof = True
        buf = buf[pos:] + more
        pos = 0
        continue
    pos = end
    if pos > (1 << 24):
        buf = buf[pos:]; pos = 0
    n += 1
    if mode == "vac":
        sp = o.get("codeProfessionalSphere", "")
        title = (o.get("vacancyName") or "").replace("\t", " ").replace("\n", " ")
        spheres[sp] += 1
        tab.write("\t".join([o.get("id", ""), sp, str(o.get("codeProfession", "")), title, o.get("sourceType", ""),
                             str(o.get("codeExternalSystem", "")), (o.get("creationDate") or "")[:10],
                             (o.get("datePublished") or "")[:10], str(o.get("deleted", "")), o.get("status", ""),
                             o.get("regionName", ""), str(o.get("salaryMin", "")), str(o.get("salaryMax", ""))]) + "\n")
        if sp == "InformationTechnology" or IT_RE.search(title):
            nit += 1
            itf.write(json.dumps(sanit_vac(o), ensure_ascii=False) + "\n")
    else:
        sps = sorted({p.get("codeProfessionalSphere", "") for p in o.get("professionList") or []})
        for s in sps:
            spheres[s] += 1
        title = (o.get("positionName") or "").replace("\t", " ").replace("\n", " ")
        tab.write("\t".join([o.get("id", ""), o.get("candidateId", ""), ",".join(sps), title,
                             (o.get("dateCreate") or "")[:10], (o.get("dateModify") or "")[:10]]) + "\n")
        if "InformationTechnology" in sps or IT_RE.search(title):
            nit += 1
            itf.write(json.dumps(sanit_cv(o), ensure_ascii=False) + "\n")
    if n % 100000 == 0:
        print(f"{outprefix}: {n} recs, {nit} it-cand, {time.time()-t0:.0f}s", file=sys.stderr, flush=True)
tab.close(); itf.close()
json.dump({"records": n, "it_candidates": nit, "spheres": spheres.most_common(), "elapsed": round(time.time() - t0)},
          open(f"{outprefix}_stats.json", "w"), ensure_ascii=False, indent=1)
print(f"DONE {outprefix}: {n} records, {nit} it-cand", file=sys.stderr)
