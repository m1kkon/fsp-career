import re
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

