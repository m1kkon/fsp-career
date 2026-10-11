import re
EXCL = re.compile(r"чпу|станк|наладчик|\bcnc\b|\bрэа\b|радиоэлектрон|конструктор|технолог-разработ|преподавател|учитель|педагог|редактор|оператор эвм|оператор пк|оператор компьютер", re.I)
ONE_C = re.compile(r"1\s?:\s?[сc]\b|(?<![0-9a-zа-я])1\s?[сc](?![a-zа-я0-9])|1[сc][:\-]|1[сc]-|\b1с\b", re.I)
DEV = re.compile(r"программист|разработчик|developer|программирован|frontend|front-end|фронтенд|фронт-енд|backend|back-end|бэкенд|бекенд|бэкэнд|full.?stack|фулстек|фуллстек|python|питон|\bjava\b|javascript|\bjs\b|golang|\bphp\b|c\+\+|c#|\.net|android|\bios\b|unity|верстальщик|kotlin|swift|ruby|react|vue|angular|node", re.I)
QA = re.compile(r"тестировщик|\bqa\b|qa-|тестированию по|тестирования по|тестированию програм|тестирования програм|инженер по тестированию|автотест|контролю качества программ", re.I)
DEVOPS = re.compile(r"devops|девопс|\bsre\b|kubernetes|site reliability|dev ops", re.I)
DATA = re.compile(r"data scien|дата.?сайент|аналитик данных|data analyst|data engineer|инженер данных|machine learning|машинн\w* обуч|\bml\b|ml-|нейросет|computer vision|компьютерн\w* зрени|big data|больш\w* данн|\bnlp\b|\bai\b|искусственн\w* интеллект", re.I)
SYSADM = re.compile(r"системн\w* администратор|сисадмин|администратор сет|сетев\w* администратор|администратор баз|\bdba\b|администратор информационн|администратор ит|администратор it", re.I)
ANALYST = re.compile(r"системн\w* аналитик|бизнес.?аналитик|business analyst|system analyst", re.I)
def classify(title, sphere=""):
    t = title or ""
    tags = set()
    if ONE_C.search(t): tags.add("1c")
    if not EXCL.search(t):
        if DEV.search(t): tags.add("dev")
        if QA.search(t): tags.add("qa")
        if DEVOPS.search(t): tags.add("devops")
        if DATA.search(t): tags.add("data_ml")
    if SYSADM.search(t): tags.add("sysadmin")
    if ANALYST.search(t): tags.add("analyst")
    core = bool(tags & {"dev", "qa", "devops", "data_ml"}) and "1c" not in tags
    return tags, core, ("InformationTechnology" in (sphere or ""))
