# Sources for legally collecting a Russian IT vacancy and resume corpus (official APIs and open data), with legal and terms-of-use constraints

Research date: 2026-10-08. Live probes (curl) were run on that date from a non-Russian IP (geo lookup: CY). Where geo-blocking may have affected a result, this is noted. "VERIFIED" means I saw it in a live response or on the primary page. "UNVERIFIED" means it comes only from secondary sources or memory.

---

## 1. Работа России / trudvsem.ru open data (opendata.trudvsem.ru): vacancies and CV datasets and API

### Takeaway
Работа России is the only large source checked that publishes both vacancies and resumes (CVs) as free bulk open data with no authentication and daily updates. Its IT coverage is thin and low-quality (mostly regional, 1C, and support roles). The CV dump is not truly anonymized: it contains full birth dates, gender, locality down to village level, a stable candidate ID, employer names with dates, and free text. The vacancy dump includes contact person full names. Both need further depersonalization before training, and especially before redistribution.

### Cited Findings
**Catalogue.** The open-data index lists these datasets, all in gosmonitor standard 3.0 format, VERIFIED: `7710538364-vacancy` (all regions), `7710538364-vacancy_1..10` (by federal district), `7710538364-cv` ("Резюме из ЕЦП «Работа в России»"), `-response` (applicant responses), `-invitation` (employer invitations), `-organizations`, `-professions` (a specialty directory based on ОКПДТР), `-industries`, `-regions`, `-districts`, `-stat-citizens`, and `-stat-company`. — [opendata.trudvsem.ru](https://opendata.trudvsem.ru/)

**CV dataset metadata.** VERIFIED:
- The description says it has "аналитические сведения по размещенным резюме… Данные обновляются ежедневно… поля с контактными данными соискателей, а так же другая персональная информация в наборе не заполняются".
- Formats: XML, JSON (`https://opendata.trudvsem.ru/json/cv.json`), and CSV (`https://opendata.trudvsem.ru/csv/cv.csv`).
- The meta.csv carries no license field (fields: standardversion, identifier, title, description, creator, created, modified, subject, format, provenance, valid, data/structure links).

Sources: [cv meta page](https://opendata.trudvsem.ru/7710538364-cv), [cv meta.csv](https://opendata.trudvsem.ru/7710538364-cv/meta.csv)

**Dump sizes (HTTP HEAD, 2026-10-08).** VERIFIED:
- cv.json: 43,877,791,420 bytes (~43.9 GB). cv.csv: ~31.9 GB. Last-Modified 2026-10-08.
- vacancy.json: ~2.68 GB. vacancy.csv: ~1.97 GB. Last-Modified 2026-10-07.

Sources: [cv.json](https://opendata.trudvsem.ru/json/cv.json), [vacancy.json](https://opendata.trudvsem.ru/json/vacancy.json)

**CV record fields.** I read the first 200 MB of cv.json (59,016 records). VERIFIED:
- Top-level fields: id, candidateId, gender, birthday, age, salaryMin/salaryMax/salary, positionName, professionList[{codeProfessionalSphere, codeProfession}], experience (years), educationList[{instituteName, faculty, qualification, speciality, graduateYear}], additionalEducationList, hardSkills, softSkills, skills, workExperienceList[{companyName, jobTitle, dateFrom, dateTo, demands (free text), relevant}], languageKnowledge, scheduleType, relocation, desirableRelocationRegions, stateRegionCode, locality, localityName, otherCertificates, additionalInformation, innerInfo{rfCitizen, visibility, deleted}, and dateCreate/dateModify/publishedDate.
- Real examples contain a full `birthday` ("1981-06-01T16:00:00+0400"), `localityName` down to the village ("Астраханская область, Приволжский район, Атал село"), named employers ("ПАО \"МТС\"", "Ростелеком"), and free-text `otherCertificates` with personal awards.

Source: [cv.json](https://opendata.trudvsem.ru/json/cv.json) (my own probe)

**IT share in the CV sample.** VERIFIED for the sample; the extrapolation is my estimate:
- In the first 59,016 CVs, 1,372 (2.3%) had `codeProfessionalSphere = InformationTechnology`. Only 472 of those had any non-empty hardSkills or skills.
- Only 418 (0.71%) had a developer-like positionName (regex: программист, разработчик, developer, devops, тестировщик, аналитик данных, python, java, frontend, backend…). The top titles were "программист" (137), "программист 1с" (20), "аналитик данных" (19), and "тестировщик" (19).
- Many IT-tagged CVs are support, operator, or technician roles, for example positionName "Специалист" with call-center work history.

Source: own probe of [cv.json](https://opendata.trudvsem.ru/json/cv.json)

**Vacancy record fields (vacancy.json dump).** VERIFIED:
- Fields: id, vacancyName, codeProfession, codeProfessionalSphere, professionalSphereName, salary, salaryMin, salaryMax, requirements, responsibilities, qualifications, positionRequirements, hardSkills, softSkills, skills, experienceRequirements, educationRequirements, scheduleType, busyType, regionName, vacancyAddress, fullCompanyName, companyBusinessSize, datePublished, dateModify, vacancyUrl, status.
- It also has **`contactPerson`**, which in the sample was a full name ("Татьяна Викторовна Можарчук"). This contradicts the meta description that contact and personal data are not filled.

Sources: [vacancy.json](https://opendata.trudvsem.ru/json/vacancy.json), [vacancy meta.csv](https://opendata.trudvsem.ru/7710538364-vacancy/meta.csv)

**REST API (no authentication).** VERIFIED:
- `GET http://opendata.trudvsem.ru/api/v1/vacancies?text=…&limit=…&offset=…&modifiedFrom=…`
- `GET /api/v1/vacancies/region/{region_code}`
- `limit` is capped at 100. A request with limit=101 returned meta.limit=100.
- Response fields per vacancy: id, source, region, company{name, inn, ogrn, kpp, email, site, url, hr-agency}, creation-date, date_modify, salary, salary_min, salary_max, job-name, vac_url, schedule, qualification, requirements (free text), duty (free text), category.specialisation, requirement{education, experience}, addresses.
- The company `email` is returned.
- There is no CV endpoint: `/api/v1/cvs` returned 404.

Source: [API probe](http://opendata.trudvsem.ru/api/v1/vacancies?limit=1&text=python)

**IT vacancy volume via the API (2026-10-08).** VERIFIED:
- Total active vacancies: 496,419. Modified since 2026-10-01: 216,659.
- Full-text hits: "python" 417 (Moscow region only: 138), "разработчик" 682, "программист" 1,988, "devops" 76, "тестировщик" 75. These hits overlap.
- Sample vacancy: "Разработчик Python", Тольятти, 90–100k RUB, with a detailed requirements text (FastAPI, PostgreSQL, Kafka, Docker).

Source: [API](http://opendata.trudvsem.ru/api/v1/vacancies)

**API documentation page.** `trudvsem.ru/opendata/api` returned HTTP 460 to both WebFetch and curl from my IP, so I could not read the official parameter docs or license text. — [trudvsem.ru/opendata/api](https://trudvsem.ru/opendata/api)

### Inferences
- **Volume estimate (rough).** Extrapolating 59,016 records per 200 MB to a 43.9 GB file gives about 12.9M CVs. That means roughly 300k IT-sphere CVs and roughly 90k developer-titled CVs. The head of a file is not a random sample, so treat these as order-of-magnitude figures only.
- **IT vacancy volume.** Probably low single-digit thousands of real IT vacancies at any time. That is far fewer than the hh.ru market, and skewed toward state-sector, regional, and 1C roles. Still, the free-text requirements and duty fields are useful for training employer-need parsing.
- **Fit for grade labels.** Skills fields are sparse, and there are no explicit Junior/Middle/Senior labels. Grade would have to come from `experience` (years), salary, and job title. This is weak supervision for the project's grade classifier.
- **De-identification.** The dumps are "official open data", but the CV records are not de-identified to the 152-ФЗ art. 3 p.9 standard. That standard requires that data cannot be attributed to a person without additional information, and here birthday + locality + employer history + graduation year can re-identify people. Before storing, and certainly before putting anything in a public repo, the team should at minimum:
  - drop or replace `id` and `candidateId`;
  - replace `birthday` with an age bucket;
  - generalize `locality` to region;
  - drop `companyName`, `instituteName`, and `graduateYear`;
  - scrub free text (`demands`, `otherCertificates`, `additionalInformation`) for names, phones, and emails;
  - drop `contactPerson`, company `email`, and phones from vacancies.
- **Licensing posture.** Russian state open data is generally intended to be reused freely. However, no explicit license was found in the dataset metadata. Cite the source ("Портал «Работа в России», opendata.trudvsem.ru") in any redistribution.

### Gaps
- License or terms text for opendata.trudvsem.ru could not be retrieved: the trudvsem.ru/opendata pages returned HTTP 460, and meta.csv has no license field. Whether a CC-BY-like or "free use" clause applies is UNVERIFIED.
- The API rate limit is not documented anywhere I could reach.
- The exact semantics of `offset` (page number vs. record offset) are UNVERIFIED.
- The exact count of IT CVs across the full 43.9 GB dump was not computed, since that needs a full download.
- Whether `-response` and `-invitation` (CV↔vacancy interaction datasets) contain usable IDs for building match pairs was not inspected. This could be valuable ground truth for ranking and is worth checking.

---

## 2. hh.ru API (api.hh.ru / dev.hh.ru): vacancy search, resume access, rate limits, terms

### Takeaway
As of 2026, hh.ru's public anonymous vacancy search is closed. `GET /vacancies` and `GET /resumes` return 403 without a token. Access needs a registered, moderated application, mainly for verified employer accounts. The applicant API was closed in December 2025. Even with access, the developer agreement forbids:
- using data outside employment purposes;
- building another database from it;
- passing data to third parties.

The site user agreement separately bans scripts and robots. hh.ru is therefore not a lawful source for an open-source training corpus. Only the public reference dictionaries (professional roles, experience levels, etc.) remain usable as a taxonomy.

### Cited Findings
**Live probe (2026-10-08).** VERIFIED:
- `GET https://api.hh.ru/vacancies?text=python` returned `HTTP 403 {"errors":[{"type":"forbidden"}]}`, both with and without the `HH-User-Agent` header (server header: ddos-guard).
- `GET /resumes` also returned 403.
- `GET /dictionaries` and `GET /professional_roles` returned 200 with data from the same IP.

This suggests the 403 is endpoint-specific, not a geo block. Source: [api.hh.ru/vacancies](https://api.hh.ru/vacancies), [api.hh.ru/professional_roles](https://api.hh.ru/professional_roles)

**IT taxonomy in `/professional_roles` (public).** VERIFIED:
- Category id 11, "Информационные технологии", has 25 roles, including:
  - 96 Программист, разработчик; 160 DevOps-инженер; 165 Дата-сайентист; 124 Тестировщик;
  - 156 BI-аналитик/аналитик данных; 148 Системный аналитик; 104 Руководитель группы разработки;
  - 113 Системный администратор; 116 Специалист по ИБ; 125 CTO; 126 Технический писатель; and others.
- `/dictionaries` includes enumerations such as resume_access_type.

Source: [api.hh.ru/professional_roles](https://api.hh.ru/professional_roles), [api.hh.ru/dictionaries](https://api.hh.ru/dictionaries)

**Vacancy endpoint closure.**
- "С апреля 2026 года публичный метод `GET /vacancies` API HeadHunter начал возвращать `403 Forbidden` для неавторизованных запросов." API keys are available mainly to verified employer accounts and recruiting services with moderated applications.
- The author concludes there is no longer a legal public way to automatically collect vacancies for personal analytics.
- No official hh.ru statement is quoted.

Source: [Habr news, 2026-08-11](https://habr.com/ru/news/1069286/)

**Applicant API closure.** HH closed the public applicant API on 15 December 2025, citing auto-applications, fraud, and data-access risks. — [setka.ru post](https://setka.ru/posts/019b0d90-3081-7f00-9167-3b3fb4f856e9) (via search summary), [podustal.ru](https://podustal.ru/blog/avtootkliki-posle-zakrytiya-api-hh). An aggregator snippet instead dated the applicant-side removal to "December 2024" and said only `GET /me` works with an applicant token, per hh.ru support on 2026-05-08. That conflicts with the December 2025 date: [search aggregate](https://apify.com/mcpbay/hh-mcp). I treat December 2025 as more likely, since it is corroborated by Habr's 2026 article.

**Official docs on authorization.**
- Three auth modes: anonymous, application (client credentials), and user (employer or applicant).
- Apps must be registered at dev.hh.ru.
- The terms of use live at dev.hh.ru/admin/developer_agreement.
- No rate-limit numbers appear in the README.

Source: [github.com/hhru/api](https://github.com/hhru/api)

**"Условия использования сервиса API" (developer agreement).** VERIFIED, fetched 2026-10-08. Relevant clauses:
- **1.5 / 1.6.** End users may use the Service only to attract and employ workers. HH may refuse apps it suspects of other uses.
- **3.3.** "Использование любых материалов, получаемых посредством Сервиса с Сайта, недопустимо ни с какими целями, кроме соответствующих тематике Сайта (поиск работы, сотрудников, получение информации о рынке труда)".
- **3.7.** Resumes may not be provided to end users who do not hold a paid resume-database access contract with HH.
- **3.8.** Personal (own) use of the app is allowed if consistent with the terms.
- **4.3.** "Посредством Приложения не должно быть возможным скачивание (получение, извлечение) данных для формирования другой базы данных для предоставления данных из такой созданной базы данных (доступа к базе данных) другим лицам."
- **4.5.** Storing or using data for purposes other than employer↔candidate contact is forbidden.
- **4.6.** Transferring data obtained via the Service to third-party services is forbidden. Only registered hh.ru users may be users of the data.

Source: [dev.hh.ru/admin/developer_agreement](https://dev.hh.ru/admin/developer_agreement)

**hh.ru user agreement** ("Соглашение по содействию в трудоустройстве", edition effective 22.09.2026). VERIFIED:
- **8.6.** Use of resumes and vacancies is limited to job search, hiring, or "получение информации о рынке труда". "Запрещается использование на Сайте плагинов, осуществляющих автоматический сбор и анализ данных (парсинг)/копирование информации".
- **8.7.** A client storing resumes outside the site is the PD operator under 152-ФЗ.
- **8.8.** "Не допускается использование программных средств (скриптов, роботов) для считывания или сбора информации (данных) с Сайта."

Source: [hh.ru/account/agreement](https://hh.ru/account/agreement)

**Resume access.** It requires an employer account with a paid resume-database access contract, per agreement 3.7 above. In the same agreement, applicants consent to HH publishing their resumes in the "База данных HeadHunter" and monetizing access to them (cl. 3.4–3.5). — [hh.ru/account/agreement](https://hh.ru/account/agreement)

### Inferences
- **Closed for this project.** For an open-source hackathon project, hh.ru is effectively closed as a collection source in 2026. Anonymous access is gone. An employer app token would bind the team to terms that forbid building a separate DB, using data for non-hiring purposes such as ML corpus building, and redistribution. Scraping the website directly breaches cl. 8.6/8.8 of the user agreement and exposes the team to database-maker-right claims (see section 5).
- **What is still usable.** The `/professional_roles` and `/dictionaries` endpoints remain open. Their IT role IDs and experience buckets (noExperience/between1And3/between3And6/moreThan6 in historical docs; UNVERIFIED for the current version) can define label schemas compatible with hh.ru, without copying any vacancy or resume content. Using a short enumerated list of role names is very unlikely to amount to "extraction of a substantial part" of a database, but this is a legal judgment, not verified.
- **Hackathon datasets.** If the hackathon organizers (the case is "lct2026-fsp-hhru", suggesting hh.ru involvement) supply hh.ru data, that data comes under the organizers' own license, which should be checked separately. That is out of scope here.

### Gaps
- Current numeric rate limits for api.hh.ru are not published in the sources I reached. Historically there was no fixed number, with CAPTCHA/429 on overuse (UNVERIFIED).
- Whether an application-level (client_credentials) token still unlocks `GET /vacancies` for non-employer developers, and what the moderation criteria are, is unverified. Only the Habr secondary report covers it.
- No official hh.ru changelog entry for the April 2026 vacancy-search change was found.

---

## 3. Other job platforms: SuperJob, Habr Career, Zarplata.ru, getmatch, GeekJob, Avito Работа, Telegram IT job channels

### Takeaway
None of these offers open bulk resume data:
- **SuperJob** requires a registered app key for every call, including vacancy search, and has a 120 req/min per IP limit.
- **Habr Career's** official API is an OAuth integration for employer CRMs (contacts are debited from a paid limit). Its public listings come only via an undocumented frontend endpoint.
- **Zarplata.ru's** API returns the same 403 "forbidden" as hh.ru.
- **getmatch** and **GeekJob** expose undocumented JSON endpoints for vacancies only.
- **Telegram's** API terms explicitly ban using Telegram data for AI/ML training.

### Cited Findings
**SuperJob (api.superjob.ru).** VERIFIED:
- `GET /2.0/vacancies/` and `GET /2.0/resumes/` without a key return `403 "Необходимо передать ключ приложения. Зарегистрироваться можно по адресу https://api.superjob.ru/register/"`.
- Docs: every request must carry the `X-Api-App-Id` header with the app secret key. User auth is OAuth 2.0.
- "Текущее ограничение по частоте запросов к API — 120 запросов в минуту с одного IP-адреса" (exceeding it gives 503; 429 is also listed for rate overruns).
- The docs say they are current as of version 2.20.
- Vacancy fields include `work` (duties), `candidat` (requirements), `compensation`, `town`, `type_of_work`, `date_published`, and payment.

Source: [api.superjob.ru](https://api.superjob.ru/)

**Habr Career official API.** VERIFIED:
- Base URL `https://career.habr.com/api`. OAuth2 via `https://career.habr.com/integrations/oauth/authorize`. App registration at career.habr.com/profile/applications.
- The access token is permanent. Example call: `/api/v1/integrations/vacancies?access_token=…`.
- The English text states the API "is tailored for integration with external CRM systems".
- `GET /v1/integrations/users/{login}/contacts`: "каждый запрос считается открытием контактов. Он спишется с лимита контактов компании".
- Unauthenticated `GET /api/v1/vacancies` returned 401.

Source: [career.habr.com/info/api](https://career.habr.com/info/api)

**Habr Career scale.** The footer on 2026-10-08 read "Сейчас на сайте 1223 вакансий и 815775 резюме". VERIFIED. — [career.habr.com/info/api](https://career.habr.com/info/api)

**Habr Career frontend endpoint (undocumented).** `GET https://career.habr.com/api/frontend/vacancies?q=python&per_page=1` returned 200 JSON with `"meta":{"totalResults":433,...}`. VERIFIED, but this is an internal API with no documented permission for reuse. — [career.habr.com](https://career.habr.com/api/frontend/vacancies?q=python&per_page=1)

**Habr user agreement.** It says Habr's applications and content are objects of exclusive rights. Use "путем копирования (воспроизведения) размещенного в Приложении Контента, а также… баз данных… и последующее распространение… строго запрещены" unless otherwise provided. The agreement covers habr.com, qna.habr.com, and habrastorage.org. I did not find whether career.habr.com has its own agreement with the same clause: career.habr.com/info/terms returned 404. — [account.habr.com/info/agreement](https://account.habr.com/info/agreement/)

**Zarplata.ru.** `GET https://api.zarplata.ru/vacancies?text=python` returned `HTTP 403 {"errors":[{"type":"forbidden"}]}`, the same error schema as api.hh.ru. VERIFIED. — [api.zarplata.ru](https://api.zarplata.ru/vacancies)

**getmatch.ru.** `GET https://getmatch.ru/api/offers?pa=all&limit=1` returned 200 JSON with `"meta":{"total":928}`. Fields include position, salary_display_from/to, salary_currency, salary_taxes, salary_hidden, offer_description (HTML), and published_at. VERIFIED, but undocumented. — [getmatch.ru/api/offers](https://getmatch.ru/api/offers?pa=all&limit=1)

**GeekJob.ru.** `GET https://geekjob.ru/json/find/vacancy?qs=python` returned 200 JSON (`documentsCount: 42`) with position, salary, jobFormat{remote, relocate…}, and company. VERIFIED, but undocumented. — [geekjob.ru](https://geekjob.ru/json/find/vacancy?qs=python)

**Avito Работа.** `GET https://api.avito.ru/job/v1/resumes/` without a token returned `401 "Bad bearer token"`. VERIFIED. The developer docs page (developers.avito.ru/api-catalog/job/documentation) returned 429, so I could not read access conditions. — [api.avito.ru](https://api.avito.ru/job/v1/resumes/)

**Telegram API terms, clause 1.5.** "you are prohibited from using, accessing or aggregating data obtained from the Telegram platform to train, fine-tune or otherwise engage in the development, enhancement or deployment of artificial intelligence, machine learning models and similar technologies". It references the "Telegram Terms of Service for Content Licensing and AI Scraping". VERIFIED. — [core.telegram.org/api/terms](https://core.telegram.org/api/terms)

### Inferences
- **SuperJob** is the most "official" commercial option for vacancies, since registering an app is free per the docs. Its ToS on storage, ML, and redistribution was not read, and it should be checked before use. Resume search almost certainly needs a paid employer account (UNVERIFIED).
- **Habr Career, getmatch, GeekJob** are IT-specific and high quality. getmatch is notable for always-structured salaries. But access would be through undocumented internal endpoints, which amounts to scraping. For Habr this conflicts with the copying/DB clauses. Low-volume, attributed, research-only use might fall under ГК 1335.1 (see section 5), but redistributing raw texts in an open repo is risky.
- **Habr Career resumes and profiles.** These 815k resumes contain personal data. Public visibility does not create a lawful basis after 519-ФЗ (see section 5).
- **Telegram** IT job channels are explicitly off-limits for ML training under Telegram's API terms, whatever the Russian-law analysis says.
- **Zarplata.ru** appears to share hh.ru's API infrastructure, so the same closure applies. (HeadHunter's ownership of Zarplata.ru is from my background knowledge and was not verified here.)

### Gaps
- SuperJob terms of use regarding storage, ML, and redistribution were not retrieved.
- getmatch and GeekJob terms of use were not retrieved.
- Avito Работа API access conditions (developer docs returned 429) are UNVERIFIED.
- Habr Career's salary service (career.habr.com/salaries) has aggregated salary data. Whether it has an API or downloadable reports, and under what license, was not checked.
- No Russian-law analysis of Telegram channel scraping was gathered. The Telegram ToS clause alone is sufficient to exclude it for ML.

---

## 4. data.gov.ru / Росстат / Минтруд datasets, and professional standards (профстандарты) as a taxonomy

### Takeaway
Минтруд's own open-data portal has a "Реестр профессиональных стандартов" dataset, but it is stale (last data file dated 2017-05-12). The live registry at profstandart.rosmintrud.ru (with per-standard XML/CSV) was geo-blocked from my IP. Работа России's `-professions` dataset (ОКПДТР-based) is current and machine-readable. data.gov.ru could not be reached. Profstandarts are useful for a skills and labor-function taxonomy, not as training examples.

### Cited Findings
**Минтруд open data, `7710914971-reestr_profstandartov`.** VERIFIED:
- Title: "Реестр профессиональных стандартов (перечень видов профессиональной деятельности)"; format CSV.
- created 20150426, modified 20160212. The latest data file is `data-20170512-structure-20170512.csv`.
- Publisher contact listed: rosmintrud.ru.

Source: [mintrud.gov.ru/opendata/7710914971-reestr_profstandartov](https://mintrud.gov.ru/opendata/7710914971-reestr_profstandartov/meta.csv)

**Registry site.** The registry is maintained by НИИ труда и социального страхования on the specialized Минтруд site, per Order N 667н of 29.09.2014. A secondary search summary says open data there is available in CSV and XML. — [search result summary citing profstandart.rosmintrud.ru and glavkniga](https://glavkniga.ru/situations/k501710) (UNVERIFIED in detail)

**Geo-block.** `profstandart.rosmintrud.ru` registry page returned HTTP 403, and `/opendata/` timed out from my IP on 2026-10-08. — [profstandart.rosmintrud.ru](https://profstandart.rosmintrud.ru/obshchiy-informatsionnyy-blok/natsionalnyy-reestr-professionalnykh-standartov/reestr-professionalnykh-standartov/)

**Работа России `7710538364-professions`.** "Справочник специальностей… построен на основе Общероссийского классификатора ОК 016-94 (ОКПДТР)". modified 20261008. VERIFIED. Its direct JSON/CSV URLs at /json/professions.json returned 404; the actual data file link is in meta.csv. — [professions meta.csv](https://opendata.trudvsem.ru/7710538364-professions/meta.csv)

**data.gov.ru.** The connection timed out from my IP (HTTP 000) on 2026-10-08. Not verified. — [data.gov.ru](https://data.gov.ru/)

### Inferences
- Use profstandart XML from a Russian IP to build a skills and labor-function taxonomy for normalizing the employer-need parser (e.g., mapping "постгрес" → PostgreSQL → a labor function in "Программист"). Profstandarts are normative legal acts (Минтруд orders), so their text is not copyright-protected (ГК 1259 p.6 excludes official documents; not fetched in this session, background knowledge). They contain no personal data, so they are safe to redistribute in an open repo.
- Typical IT profstandart codes include 06.001 Программист, 06.004 Специалист по тестированию, 06.015, 06.022 Системный аналитик, and 06.042 big data. These are from memory and should be verified on the registry.
- Росстат publishes only aggregate labor-demand statistics, not vacancy texts. It is useful at most for salary priors by region.

### Gaps
- profstandart.rosmintrud.ru export formats, update frequency, and whether there is a bulk download or API could not be verified (geo-block).
- The data.gov.ru status in 2026 and any vacancy-related datasets on it are unverified.
- Specific Росстат datasets (e.g., "потребность в работниках" surveys) were not checked.

---

## 5. Legal: 152-ФЗ (collecting and storing resumes, depersonalization, art. 10.1, 2024–2025 amendments), court cases, database maker rights (ГК 1333–1336)

### Takeaway
- **Public is not a legal basis.** Since 1 March 2021, the mere fact that resume data is publicly visible is no longer a legal basis for processing it. Art. 6 p.1(10) was repealed by 519-ФЗ, and art. 10.1 requires a separate consent for dissemination, with the burden of proof on every subsequent disseminator.
- **The usable path.** For ML research, the workable legal basis is art. 6 p.1(9): processing "в статистических или иных исследовательских целях… при условии обязательного обезличивания".
- **Localization.** Art. 18 p.5 (as amended by 23-ФЗ of 28.02.2025) forbids collecting or storing RF citizens' personal data in databases outside Russia. That rules out pushing any non-depersonalized resume data to GitHub or Hugging Face.
- **Penalties.** They rose sharply in 2024–2025: 420-ФЗ fines and the new criminal art. 272.1 УК РФ.
- **Database rights.** Job sites are protected databases (ГК 1334). Extracting a "substantial part" without permission is infringing. ГК 1335.1 allows extraction for scientific and educational purposes "в объеме, оправданном указанными целями", with attribution if published.

### Cited Findings
**Art. 3 p.9 (definition of обезличивание).** "действия, в результате которых становится невозможным без использования дополнительной информации определить принадлежность персональных данных конкретному субъекту". — [152-ФЗ ст.3, КонсультантПлюс](https://www.consultant.ru/document/cons_doc_LAW_61801/4f41fe599ce341751e4e34dc50a4b676674c1416/)

**Art. 6 p.1(9).** Processing is lawful when "осуществляется в статистических или иных исследовательских целях, за исключением целей, указанных в статье 15 настоящего Федерального закона, при условии обязательного обезличивания персональных данных". Art. 15 covers marketing and political campaigning. Point 9.1 adds processing of depersonalized data for public administration and the AI experimental-regime purposes (123-ФЗ). The same page notes that the public-data basis was repealed "с 1 марта 2021 года. - Федеральный закон от 30.12.2020 N 519-ФЗ". — [152-ФЗ ст.6](https://www.consultant.ru/document/cons_doc_LAW_61801/315f051396c88f1e4f827ba3f2ae313d999a1873/)

**Art. 10.1** (law edition of 26.07.2026):
- **Part 1.** Consent to processing PD permitted for dissemination "оформляется отдельно от иных согласий".
- **Part 2.** If data was made public without such consent, "обязанность предоставить доказательства законности последующего распространения… лежит на каждом лице, осуществившем их распространение".
- **Part 9.** The subject may forbid transfer or processing by an unlimited circle of persons, and the operator cannot refuse.
- **Parts 12–14.** Dissemination must stop within three business days of the subject's demand.

Source: [152-ФЗ ст.10.1](https://www.consultant.ru/document/cons_doc_LAW_61801/591acc70f577873c1ee54765eda110b7a0271eaf/)

**History of 10.1.** Law 519-ФЗ (bill № 1057337-7, Gorelkin) passed in 43 days. It was signed and published on 30.12.2020 and took effect 01.03.2021. It repealed art. 6 p.1(10), so public availability is no longer an independent basis. The Habr article cites Supreme Court-confirmed practice that open social-network profiles are not automatically "publicly available PD". — [Habr, 2026-07-25](https://habr.com/ru/articles/1062896/); background: [Habr 2021 "Парсинг общедоступных данных запрещен с 1 марта"](https://habr.com/ru/articles/544788/)

**Art. 13.1 (introduced by 233-ФЗ of 08.08.2024).** The ministry for IT (Минцифры) forms "составы данных" from depersonalized PD for state-administration and other legally specified purposes. Operators must provide depersonalized data on request. Special categories (art. 10) and biometrics (art. 11) are excluded, with limited exceptions. Secondary sources say the depersonalization amendments apply from 1 September 2025, with methods such as modification/generalization, decomposition, and record shuffling. — [152-ФЗ ст.13.1](https://www.consultant.ru/document/cons_doc_LAW_61801/27d43d2bcea5c961cbcc538f0de794dc4646e0c3/); [search summary of infostart.ru](https://infostart.ru/journal/news/uchet-nalogi-pravo/kak-izmenitsya-rabota-s-personalnymi-dannymi-pravila-obezlichivaniya_2463647/) (infostart returned 429 on direct fetch, so the 1 Sep 2025 date and method list are only partially verified)

**Art. 18 p.5 (as amended by 23-ФЗ of 28.02.2025).** Collection of RF citizens' PD, "в том числе посредством… «Интернет»", and its recording, systematization, accumulation, storage, update, or extraction using databases located outside the RF "не допускаются", except for art. 6 p.1 points 2, 3, 4, and 8. Point 9 (research) is **not** among the exceptions. — [152-ФЗ ст.18](https://www.consultant.ru/document/cons_doc_LAW_61801/cbf4e15b7c330f9372e876cdf2bc928bad7950ef/)

**Fines (420-ФЗ, effective 30 May 2025).**
- Unlawful processing: organizations 150–300k RUB (repeat 300–500k).
- Leaks, scaled by the number of subjects: 3–5M RUB (1k–10k subjects), 5–10M (10k–100k), 10–15M (>100k).
- Breach notification is due within 24 hours.
- Roskomnadzor must be notified before processing begins.

Source: [Контур](https://kontur.ru/articles/55870-otvetstvennost_za_obrabotku_pers_dannyh)

**Criminal art. 272.1 УК РФ (421-ФЗ).** It covers "незаконные использование и (или) передачу, сбор и (или) хранение компьютерной информации, содержащей персональные данные", and creating resources for their illegal storage or distribution.
- Basic part: up to 4 years or a fine up to 300k RUB. Aggravated parts: up to 10 years.
- One source says it took effect 9 Dec 2024. The MVD reportedly registered 923 such crimes in 10 months of 2025.

Sources: [search summary incl. Контур, advgazeta](https://kontur.ru/articles/55870-otvetstvennost_za_obrabotku_pers_dannyh). The effective date and MVD statistic come only from the search summary and are partially UNVERIFIED; the exact date may be 11 Dec 2024 per background knowledge.

**ГК РФ ст. 1334 (database maker's exclusive right).**
- A maker whose database required "существенных… затрат" has the exclusive right to extract materials.
- A database with **≥10,000** independent elements is presumed to qualify.
- "Никто не вправе извлекать из базы данных материалы… без разрешения правообладателя". Extraction means transferring the whole content "или существенной части" to another medium.

Source: [ГК РФ ст.1334](https://www.consultant.ru/document/cons_doc_LAW_64629/c8b26358cbae2a98f328bd8cb495a08f7e11caff/)

**ГК РФ ст. 1335.1 (permitted acts).**
- A lawful user of a published database may extract and use materials without permission "в личных, научных, образовательных целях в объеме, оправданном указанными целями; в иных целях в объеме, составляющем несущественную часть базы данных".
- Use giving access to an unlimited circle of persons "должно сопровождаться указанием на базу данных".
- **P.3** forbids repeated extraction of insubstantial parts if it conflicts with normal use and unreasonably harms the maker.
- **P.4** says the maker cannot forbid use of materials lawfully obtained from other sources.

Source: [ГК РФ ст.1335.1](https://www.consultant.ru/document/cons_doc_LAW_64629/6a3a364978a1d1c94fdbf7cbf6d14b5c4bb528a1/)

**HeadHunter v. Stafori ("Робот Вера").**
- HH sued in late December 2017, claiming unlawful extraction of resumes from its DB.
- Мосгорсуд rejected the claim (reported May 2018) because HH did not prove the defendant used *its* database. Experts noted HH had to prove its rights, use of its specific DB, and misuse.
- An earlier interim-measures headline (25 Jan 2018) read "Мосгорсуд запретил использовать базу резюме и вакансий HeadHunter без разрешения правообладателя".

Sources: [Ведомости 2018-05-04](https://www.vedomosti.ru/technology/articles/2018/05/04/768503-headhunter-sude); [РАПСИ 2018-01-25](https://rapsinews.ru/moscourts_news/20180125/281748849.html) (headline only)

**FAS v. HeadHunter.** The Arbitration Court of Moscow refused to annul a FAS decision finding HH abused its dominant position by restricting third-party access to its databases. — [Право.ру](https://pravo.ru/fas15/news/230786/) (headline and search snippet only; date and details UNVERIFIED)

**VK v. Double Data (ООО «Дабл»).**
- In 2017 VK sued over scraping of open profiles (names, birth dates) used for bank credit scoring, claiming infringement of the database maker's right.
- In March 2021 the Arbitration Court denied VK's claim.
- In September 2022 the Суд по интеллектуальным правам approved a settlement (мировое соглашение).

Sources: [Право.ру](https://pravo.ru/news/243021/), [Адвокатская газета](https://www.advgazeta.ru/novosti/spor-mezhdu-vkontakte-i-double-data-o-pravakh-sotsseti-na-bazu-dannykh-polzovateley-okonchen-mirovym-soglasheniem/)

**Courts on job sites as databases.** A secondary search summary says courts have recognized recruitment sites as databases protected by the maker's right, and have distinguished a user's access to individual pages from mass automated extraction. — [national-expertise.ru](https://national-expertise.ru/blog/headhunter/) (secondary, UNVERIFIED)

### Inferences
**Practical implications for ФСП Карьера:**
1. **Vacancies are lower risk than resumes.** Vacancy texts are mostly not personal data. The exceptions are contact names, emails, and phones, which must be stripped. Their main constraints are platform ToS and database rights.
2. **Resumes, even "anonymized" official dumps, are personal data** until properly depersonalized. Lawful basis: art. 6 p.1(9) research with mandatory depersonalization. Store raw data only on servers in Russia (art. 18 p.5) and depersonalize before any export. Only an irreversibly aggregated or synthetic derivative belongs in a public GitHub repo.
3. **152-ФЗ art. 3 p.9 sets a weak legal standard** ("impossible without additional information"). A conservative reading is that pseudonymized data is still PD in the hands of anyone holding the key. For an open repo, aim for anonymization that cannot be reversed, not mere pseudonymization:
   - drop direct IDs;
   - bucket ages and dates;
   - generalize location to region;
   - remove employer and university names;
   - PII-scrub free text.
4. **The ГК 1335.1 research exception** may cover limited extraction from vacancy databases for scientific or educational ML work in a justified volume, with attribution. It does not authorize mass repeated scraping (p.3), and it does not override 152-ФЗ for personal data. Platform contracts (hh.ru developer agreement 4.3/4.5/4.6) bind those who accept them.
5. **Recommended safe stack:**
   - Работа России vacancies (API and dump) plus, after depersonalization, its CV dump, with attribution;
   - profstandarts and hh.ru `/professional_roles` as a taxonomy;
   - SuperJob vacancies only after reading their ToS;
   - synthetic or self-collected consented profiles (e.g., an opt-in form with explicit consent text) for candidate-side training and ranking labels.

   Exclude hh.ru scraping, Habr Career resumes, and Telegram channels.
6. **Operator obligations.** Collecting real candidate data in the product itself (not just for training) makes the team a PD operator. Obligations then include Roskomnadzor notification, a privacy policy, separate consent forms, and 24-hour breach reporting, under the higher 2025 penalty regime.

### Gaps
- **"HeadHunter vs Dauzhazhnye".** I found no case by this or a similar name. The HH cases found are HH v. Stafori (2017–18) and FAS v. HH. The name in the brief may be garbled.
- **Roskomnadzor guidance** on depersonalization methods and the post-1 Sep 2025 requirements (the government decree or Минцифры order setting methods) was not retrieved directly. The infostart page returned 429.
- **Status of depersonalized data.** Whether depersonalized data counts as PD under current Roskomnadzor or court practice is not settled in the sources I reached.
- **ML-training court practice.** No Russian court practice specific to training ML models on scraped job data was found.
- **Supreme Court practice.** The exact case number and holding of the Supreme Court decision on open-profile data (cited by Habr as А40-5250/2017) were not independently verified.
- **Art. 272.1 effective date.** The date (9 vs 11 Dec 2024) and the MVD statistics come only from search summaries.
