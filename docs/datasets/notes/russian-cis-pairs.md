# Russian and CIS datasets with candidates, vacancies and the interactions between them

Scope: real (not synthetic, not machine-translated, not LLM-labelled) datasets in Russian or from CIS platforms that contain BOTH candidate profiles/resumes AND vacancies AND candidate↔vacancy interactions (response, invitation, rejection, hire). Out of scope here because another researcher covers them: «Работа России»/trudvsem open data, RCSI №186, Kaggle `darysha/hse-hackathon`.

Research date: 2026-10-08. All row counts and shares marked "measured" were computed by me from the downloaded files or from row samples, as described in each bullet.

## 1. hh.ru: does `hh_recsys` have any user/resume features, and is the HSE×hh.ru 2023 slice (500k interactions, 190k resumes, 320k vacancies) obtainable?

### Takeaway
**The HSE×hh.ru slice is publicly downloadable.** It is dataset №10 of the HSE school data-analysis olympiad DANO 2023–2024: 500,000 resume×vacancy "topics" with `initial_state`/`final_state` ∈ {response, invitation, discard}, 189,402 resumes and 319,481 vacancies. The zip is 52 MB, needs no registration and has no stated licence. It is the best hh.ru two-sided dataset with real interactions found so far. Its limits: structured fields only (no free text, no vacancy titles) and about 5–8% IT. `hh_recsys` (Boosters, Dec 2023) has **no user or resume features at all**: users are bare ids with session event lists. It is still mirrored on Kaggle.

### Cited Findings
**DANO 2023–2024, dataset №10 "hh.ru: характеристики вакансий и резюме"**
- The DANO data page lists it among partner datasets, with three links: a full description PDF, the dataset, and a short version. hh.ru's analysts built it from resumes and vacancies posted on hh.ru, with their characteristics, for June–August 2023 — [dano.hse.ru/data2023](https://dano.hse.ru/data2023)
- DANO is the «Национальная олимпиада по анализу данных для школьников 9–11 классов» run by HSE. In the final round, teams pick one of the partner datasets — [dano.hse.ru](https://dano.hse.ru/)
- File sizes from HTTP headers on 2026-10-08:
  - Description PDF: 55.5 KB.
  - `hh_ru_dataset.csv.zip`: 52,223,627 bytes; unzips to a 427,593,532-byte CSV.
  - `hh_ru_dataset_mini.rar`: 5.9 MB.
  - Downloaded without login — [description](https://dano.hse.ru/mirror/pubs/share/872842041); [dataset zip](https://dano.hse.ru/mirror/pubs/share/872855918); [mini](https://dano.hse.ru/mirror/pubs/share/872856033)
- **Schema** (26 columns, from the official description; matches the CSV header) — [description PDF](https://dano.hse.ru/mirror/pubs/share/872842041):
  - Interaction: `topic_id` (one employer–applicant interaction), `topic_creation_date`, `initial_state`, `final_state` (отклик / приглашение / отказ).
  - Resume: `resume_id`, `resume_creation_date`, `profession`, `gender`, `year_of_birth`, `resume_region`, `education_level`, `expected_salary` (RUB), `relocation_status`, `business_trip_readiness`, `work_schedule`, `resume_employment_type`, `work_experience_months`, `resume_skills_list`.
  - Vacancy: `vacancy_id`, `vacancy_creation_date`, `vacancy_region`, `work_schedule` (the CSV repeats this column name for the vacancy side), `vacancy_employment_type`, `compensation_from`, `compensation_to`, `vacancy_skills_list`.
- **Measured from the full CSV:**
  - 500,000 rows; 189,402 unique `resume_id`; 319,481 unique `vacancy_id`; topic dates 2023-06-01 to 2023-08-31.
  - `initial_state`: response 417,721; invitation 81,369; discard 76; empty 834.
  - `final_state`: response 242,739; invitation 183,499; discard 72,928; empty 834.
  - Transitions: response→response 242,739; response→invitation 102,976; invitation→invitation 80,523; response→discard 72,006; invitation→discard 846; discard→discard 76.
  - Interpretation: initial_state = invitation means the employer invited first. response→invitation and response→discard are employer decisions on a candidate's application. response→response means no decision was recorded.
  — [dataset](https://dano.hse.ru/mirror/pubs/share/872855918)
- **IT share (measured), from 68 `profession` values:**
  - Тестировщик 13,987; Специалист технической поддержки 11,409; Системный администратор 4,723; Программист, разработчик 4,690; Аналитик 4,094.
  - Developers + QA + sysadmins = 23,400 rows (4.7%). Adding support and analysts gives 38,903 rows (7.8%).
  - There is no DS/ML or DevOps category. The largest professions are mass-market: Официант/бармен 34,188; Менеджер по продажам 34,050; Юрисконсульт 28,658.
  - Geography: Москва 149,446 rows; Санкт-Петербург 60,685; Московская обл. 33,783.
  — [dataset](https://dano.hse.ru/mirror/pubs/share/872855918)
- **IT subset labels (measured, by final_state):**

  | Profession | invitation | discard | response (no decision) | Unique resumes / vacancies |
  |---|---|---|---|---|
  | Программист, разработчик | 1,047 | 1,249 | 2,387 | 2,270 / 3,734 |
  | Тестировщик | 2,803 | 4,357 | 6,823 | 3,475 / 5,066 |
  | Системный администратор | 1,419 | 710 | 2,590 | — |
  | Специалист техподдержки | 4,730 | 1,735 | 4,921 | — |
  | Аналитик | 1,178 | 818 | 2,094 | — |

  - For developers, the top resume skills are git, javascript, html5, sql, css, ООП, mysql, python, linux, postgresql, docker, php, typescript, react.
  - Median `expected_salary` for developers is 70,000 RUB.
  — [dataset](https://dano.hse.ru/mirror/pubs/share/872855918)
- **Student project on the same data:** an HSE student deck (team ANOD, "Команда ANOD и hh.ru") describes it as 500,000 interactions, 190,000 resumes and 320,000 vacancies, June–August 2023. It uses `expected_salary`, `compensation_to` and `initial_state`/`final_state` (приглашение, отклик, отказ). Its research question: which traits of a candidate who asks for more than the salary range lead to an interview invitation — [ANOD deck](https://dano.hse.ru/mirror/pubs/share/886155014.pdf)
- **DANO 2024–2025, dataset №7 "hh.ru: аналитика рынка труда"** is a different hh.ru release:
  - One row per vacancy. Vacancies were created in 2023 and stayed online at least 30 days, in the Ural, Siberian and Far East federal districts.
  - It has aggregate `response_count` and `invitation_count`, split by gender and by age 14–18, counted over the first 30 days.
  - Specializations are mass roles only (courier, cashier, waiter, …). No resumes and no pairs.
  - CSV is 76.6 MB.
  — [dano.hse.ru/data2024](https://dano.hse.ru/data2024); [description](https://dano.hse.ru/mirror/pubs/share/987938910.pdf); [CSV](https://dano.hse.ru/mirror/pubs/share/987939206.csv)
- The DANO 2025–2026 dataset list has no hh.ru dataset (ЭкоНива, X5, Т-Банк, …) — [dano.hse.ru/data2025](https://dano.hse.ru/data2025)

**hh_recsys (Boosters, «Новогодний ML-чемпионат», Dec 2023 – Jan 2024)**
- **Schema measured from the downloaded files.** `hh_recsys_test_hh.pq` (83,189 sessions) has exactly these columns:
  - `user_id` (e.g. `u_482520`), `session_id`.
  - `vacancy_id` (list), `action_type` (list of int), `action_dt` (list of timestamps).
  - The `hh_recsys_sample.pq` submission file has `user_id`, `session_id`, `predictions`.
  - No user, resume or demographic columns.
  — [Kaggle mirror sokolovaleks](https://www.kaggle.com/datasets/sokolovaleks/recsys-competition-23-24-hh)
- **Train file**, per a participant's EDA notebook: 3,463,064 sessions with the same 5 columns; 882,409 unique users; dates 1–14 Nov 2023 — [GitHub fedorovplaton/hh_recsys eda_train.ipynb](https://github.com/fedorovplaton/hh_recsys)
- **Vacancies file:** 2,734,129 rows × 13 columns:
  - `vacancy_id`, `name`, `company.id`, `description` (HTML), `keySkills.keySkill`.
  - `compensation.from`, `compensation.to`, `compensation.currencyCode`.
  - `area.id`, `area.regionId`, `employment`, `workSchedule`, `workExperience`.
  - In a 50k sample, `keySkills` is null in 22,693 rows and `compensation.from` in 12,125.
  - The most frequent titles are Менеджер по продажам (383) and Кладовщик (305), so the mix is mass-market.
  — [fedorovplaton eda_vacamcies.ipynb and hh_recsys_solution_example.ipynb](https://github.com/fedorovplaton/hh_recsys)
- **action_type semantics are undocumented in public sources:**
  - The baseline notebook (`hh_recsys_solution_example.ipynb`, the same file appears in at least two participants' repos) weights `action_weights = {1: 4.0, 2: 1.0, 3: 2.0}`.
  - Participants use type 1 as the response (отклик) target.
  — [fedorovplaton](https://github.com/fedorovplaton/hh_recsys); [roma1n/hh-recsys-competition](https://github.com/roma1n/hh-recsys-competition)
- **Still downloadable via Kaggle mirrors (no licence stated):**
  - `sokolovaleks/recsys-competition-23-24-hh`: train 291.9 MB, test 7.3 MB, sample 2.7 MB. I downloaded test and sample successfully on 2026-10-08.
  - `sokolovaleks/recsys-competition-23-24-hh-vac`: vacancies, 1.95 GB.
  - `nikolasoption/boosters-hh-recsys`: all 4 files, 2.22 GB.
  — [Kaggle hh](https://www.kaggle.com/datasets/sokolovaleks/recsys-competition-23-24-hh); [Kaggle vac](https://www.kaggle.com/datasets/sokolovaleks/recsys-competition-23-24-hh-vac); [Kaggle nikolasoption](https://www.kaggle.com/datasets/nikolasoption/boosters-hh-recsys)

**Other hh.ru items**
- hh.ru's earlier Boosters championship, "HeadHunter" (employer reviews), is mirrored on Kaggle as `HeadHunter_train.csv` (24.7 MB) and `HeadHunter_test.csv` (21.3 MB). It is about employer reviews, not matching — [Boosters HeadHunter](https://boosters.pro/championship/HeadHunter/overview/description); [Kaggle mirror](https://www.kaggle.com/datasets/aleron751/headhunter-employer-review-competition)
- **Legal path for real pairs from a partner employer:** the hh.ru API lets an employer list its own responses/invitations ("переписка (отклики/приглашения) для работодателя").
  - It exposes the job-seeker-visible `state`, employer collections/states, and actions that change state (invite, discard).
  - So an employer partner can export its own resume+vacancy+state history.
  — [hhru/api employer_negotiations.md](https://github.com/hhru/api/blob/master/docs/employer_negotiations.md)

### Inferences
- **The DANO hh.ru file is the strongest Russian candidate for a real-label resume↔vacancy model on hh.ru data:**
  - Labels: response→invitation as positive; response→discard as explicit negative; invitation-first rows as employer-initiated positives.
  - It maps well to our structured fields: skills↔stack, expected_salary↔salary range, schedule/employment↔format, region↔city, experience months, education.
  - It has **no free text** (no "about me", no work-history descriptions, no vacancy title/description), so it cannot train a text cross-encoder by itself.
  - The IT subset is roughly 23k–39k pairs. It lacks DS/ML/DevOps categories, and "Программист, разработчик" mixes backend, frontend and 1C.
- The DANO and `darysha/hse-hackathon` datasets look different. DANO uses English state values and hh-style names; darysha has `cv_status` = Приглашение/Отказ and trudvsem-like field names. So DANO is a distinct, additional source.
- **hh_recsys is behaviour-only:**
  - It suits vacancy-side representation learning and click/response sequence models.
  - It cannot be used to learn resume↔vacancy fit, because there are no resume features.
  - Its vacancy texts can be joined to DANO only if the ids match. DANO ids look obfuscated (e.g. `85t0f82`) and hh_recsys ids are `v_…`, so a join is very unlikely.

### Gaps
- No licence or terms of use are stated for the DANO hh.ru files, on the page or in the description PDF. The data is published for an olympiad; reuse terms would need confirmation from HSE/hh.ru.
- The exact semantics of `discard`, and whether "response→response" means "no decision" or "viewed but not answered", are not documented.
- The official meaning of hh_recsys `action_type` 2 and 3 (view? favourite?) was not found. The hh_recsys IT share was not measured, because the 1.95 GB vacancies file was not downloaded.
- No evidence was found of an hh.ru research-grant or data-request programme, or of «Школа программиста» datasets. A 2025 hh.ru talk on its recsys ([IML 2025](https://imlconf.com/talks/20007653/)) could not be parsed (PDF truncated).

## 2. Did SuperJob, Rabota.ru, Avito Работа, Habr Career, getmatch, Zarplata.ru, Huntflow, Potok, Talantix, Sber/SberJobs, VK or Yandex release resume+vacancy+interaction data?

### Takeaway
None of them published an official dataset. The one real Russian non-hh pair dataset found is a **Rabota.ru test-assignment dataset**: 298,072 resume×vacancy pairs with response and invitation targets. A candidate's GitHub repo still links it on Google Drive (574 MB CSV). It is mass-market, has no licence and contains PII artifacts. SuperJob documents internal training data (about 10M pairs) but has not released it.

### Cited Findings
- **Rabota.ru "Бинарная классификация откликов" test task:**
  - The data comes as vacancy/resume pairs.
  - Target 1: will the applicant respond (1/0).
  - Target 2: will the employer invite the responding applicant to an interview (1/0).
  - The candidate's EDA says the dataset seems deliberately stratified: target 1 is about 50/50 and target 2 about 90/10.
  — [GitHub DEli-26/test_task_rabota_ru](https://github.com/DEli-26/test_task_rabota_ru)
- **Measured from the notebook outputs:**
  - 298,072 rows × 28 columns; 240,107 unique resumes; 158,374 unique vacancies.
  - `target_task_1` mean 0.503. `target_task_2` mean 0.844 overall and 0.89 when target_task_1 = 1.
  - **Resume columns:** `resume_id`, `birth_date`, `resume_position`, `resume_salary_from`, `resume_city_id`, `resume_city_search_job`, `resume_is_leaving`, `resume_offer_education_id`, `resume_is_foreign_language`, `resume_is_upload_photo`, `percentage_of_resume_completion`, `resume_offer_experience_year_count`, `resume_region_id`.
  - **Vacancy columns:** `vacancy_id`, `vacancy_custom_position`, `vacancy_operating_schedule_id`, `vacancy_salary_from`, `vacancy_salary_to`, `vacancy_description`, `vacancy_offer_education_id`, `vacancy_offer_experience_year_count`, `vacany_company_id`, `vacancy_is_agency`, `vacancy_city_id`, `vacancy_operating_schedule_comment`, `vacancy_offer_experience_year_id`.
  - Targets: `target_task_1`, `target_task_2`.
  - The top resume positions are Водитель, Менеджер по продажам, Администратор, Продавец, Охранник. Some position strings contain e-mail addresses (PII).
  — [2212_test_rabotaru_01_eda.ipynb](https://github.com/DEli-26/test_task_rabota_ru/blob/main/2212_test_rabotaru_01_eda.ipynb)
- **Availability:** the notebook loads `vacancy_resume_data.csv` via gdown id `11TxYKx58dwbJv57xX2EY5mSecZFz4oX3`. On 2026-10-08 that Google Drive id still returned the virus-scan page for "vacancy_resume_data.csv (574M)" — [Google Drive](https://drive.google.com/uc?export=download&id=11TxYKx58dwbJv57xX2EY5mSecZFz4oX3)
- **SuperJob (tproger, 14 Jul 2021):**
  - Its vacancy recommender trains on search logs, with views and responses as positives and their absence as negatives.
  - The data was about 10M resume–vacancy pairs, a quarter positive, from about one month of logs.
  - It later tested response-only targets.
  - No public release is mentioned.
  — [tproger](https://tproger.ru/articles/kak-mashinnoe-obuchenie-pomogaet-iskat-podhodjashhie-vakansii-na-superjob)
- **Searches with no results:**
  - Kaggle and HF Hub searches for "huntflow", "potok", "talantix", "sberjobs", "avito job", "zarplata", "getmatch", "habr career", "superjob" and "отклики" returned no relevant datasets.
  - "headhunter" on HF returned only vacancy scrapes: `evilfreelancer/headhunter`, 319 rows; `chagatai-htr/headhunter-kazakhstan-all-regions`; `doublecringe123/parsed-vacancies-from-headhunter-tashkent`.
  — [HF datasets API](https://huggingface.co/api/datasets?search=headhunter); [Kaggle search](https://www.kaggle.com/datasets?search=superjob)
- `doronin99/CVxVacancyMatcher` (NLP course project) built resume and vacancy sets from hh.ru data with Google Drive links, but they are unlabeled. The team evaluated by eye — [GitHub](https://github.com/doronin99/CVxVacancyMatcher)

### Inferences
- **Rabota.ru data is real and two-sided, with two real interaction targets, but it fits poorly:**
  - Mass-market roles; one region (per the candidate's analysis).
  - Resumes have only a title plus structured fields: no "about" text and no work history.
  - Targets look re-sampled to balance classes, so base rates are not real.
  - Some invitation labels exist on non-response rows, which is logically inconsistent.
  - It is useful mainly for pretraining structured-feature models on response and invitation behaviour, after filtering the few IT rows.
  - Redistribution rights are unclear: it was given privately as a hiring test.
- Huntflow, Potok and Talantix (ATS vendors) hold exactly the funnel data we need (stages: response→screen→interview→offer), but nothing has been published. Getting it would mean a data partnership.

### Gaps
- The IT share of the Rabota.ru set was not measured (the 574 MB file was not downloaded). The rows look overwhelmingly non-IT.
- The collection period and region of the Rabota.ru data, and whether Rabota.ru allows reuse, are unknown.
- No information was found on VK, Yandex or SberJobs research releases with candidate interactions.

## 3. Hackathons (Цифровой прорыв, ЛЦТ, AI Journey, ML TalentMatch, university events) with resumes + vacancies + outcomes

### Takeaway
**ML TalentMatch 2024 (MSU Lomonosov cluster, Sense Group + «Акселератор возможностей»)** is the only hackathon found with an IT-only, real-text Russian dataset of vacancies plus "confirmed"/"failed" resumes. It is tiny (29 vacancies, 656 labeled resumes) and public in participants' GitHub repos, but it contains names and birth dates. The Цифровой прорыв and ЛЦТ HR cases found are resume-only (salary prediction) or product tasks with no data. No AI Journey HR dataset exists.

### Cited Findings
- **ML TalentMatch event:** held 28 Feb – 1 Mar 2024 at the Lomonosov cluster, supported by «Акселератор Возможностей». Two cases: structuring resume information, and matching resumes to vacancies. 86 teams / 480 participants; 32 teams in the final — [connections.ru](https://connections.ru/events/hakaton-ml-talentmatch-2024/)
- The organizers were Sense Group and «Акселератор Возможностей». MISIS teams won both tracks — [MISIS news](https://misis.ru/news/9013/)
- **Data description from a prize-winning team:** two JSON files.
  - The first pairs each vacancy with N candidates labeled `failed_resumes` / `confirmed_resumes`.
  - The second has vacancies with unlabeled candidates.
  - The most predictive columns are text: vacancy name, keywords, description, comment; resume about, key skills, position, experience description.
  — [GitHub gblssroman/MSU-ML-Talent-Match](https://github.com/gblssroman/MSU-ML-Talent-Match)
- **Measured from `case_2_data_for_members.json`** (4.5 MB; also in `avo-milas/job_mathicng`):
  - 29 vacancies, 193 confirmed + 463 failed = 656 unique resumes. Confirmed per vacancy: 3–23 (median 4). Failed: 5–60 (median 11).
  - Titles are all IT, in a bank context: Java developer (investments team; brokerage; core banking), системный аналитик (fintech, collateral team), DWH/Hadoop/ETL, DevOps, QA, Android, Python, Frontend, Product manager, IT-лидер.
  - **Resume fields:** `uuid`, `first_name`, `last_name`, `birth_date`, `country`, `city`, `about` (277/656 non-null), `key_skills`, `experienceItem` (`starts`, `ends`, `employer`, `city`, `position`, `description`; 2,536 items, median description 441 chars), `educationItem` (`year`, `organization`, `faculty`, `specialty`, `result`, `education_type`, `education_level`).
  - **Vacancy fields:** `uuid`, `name`, `keywords` (all null), `description` (median 2,636 chars), `comment` (4/29 non-null, salary notes).
  - **Held-out file:** one Java vacancy with 113 unlabeled resumes, which also have `languageItems`.
  — [GitHub MALINAYAGODA/Talent-Match](https://github.com/MALINAYAGODA/Talent-Match); [avo-milas/job_mathicng](https://github.com/avo-milas/job_mathicng)
- `leffff/ml-talent-match` (case 1, MISIS) pretrained LaBSE on about 135,000 resumes "collected from the internet", for NER only. No matching labels — [GitHub](https://github.com/leffff/ml-talent-match)
- **Цифровой прорыв. Сезон: ИИ, СФО (6–8 Sep 2024)** had a track "Определение зарплатных ожиданий по резюме": vacancy classification, salary prediction, profession unification. No interaction labels — [GitHub vassert32/resume_salary_hackaton](https://github.com/vassert32/resume_salary_hackaton)
- **ЛЦТ 2023:**
  - Task #16 was an interactive platform for interns and youth career projects: product/backend, no dataset — [GitHub pavbatol/talentium](https://github.com/pavbatol/talentium); [Vaynbaum/erbium-solution-16-task](https://github.com/Vaynbaum/erbium-solution-16-task)
  - ЛЦТ Krasnodar 2023 had an HR onboarding service, also with no dataset — [GitHub lct23/krasnodar](https://github.com/lct23/krasnodar)
- **AI Journey:** searches found only the 2019 contest repo (exam essays) and contest rules, no HR task — [aij.ru contest](https://aij.ru/en/contest); [sberbank-ai/ai-journey-2019](https://github.com/sberbank-ai/ai-journey-2019)
- **Kaggle:** searches for "лцт" returned only image datasets (`lct-hackaton`, 35.9 GB of JPGs of tools). "цифровой прорыв" returned a car-number segmentation set — [Kaggle dashitsybikzhapov/lct-hackaton](https://www.kaggle.com/datasets/dashitsybikzhapov/lct-hackaton)

### Inferences
- **ML TalentMatch case 2 is closest to our task in content:**
  - Russian IT vacancies with long descriptions and recruiter salary comments.
  - Full IT resumes with work-history text and education, and a human screening outcome per vacancy.
  - Too small to train on (656 pairs). Better as a **real-label evaluation set**, or for few-shot calibration of a matcher.
  - The labels are probably the staffing company's screening decisions (Sense Group). The case text does not document this.
  - PII: real-looking first and last names and birth dates (182/656 masked to Jan-01). Drop these fields before any use.
- I found no evidence that ЛЦТ (2021–2025) or Цифровой прорыв released a resume×vacancy×interaction dataset. Their HR cases are product builds or resume-only ML.

### Gaps
- The ML TalentMatch case document (definition of "confirmed"/"failed", data owner, licence) was not found. The berza.ru page is now a parked domain, and ml-talentmatch.ru returned no content.
- Цифровой прорыв cases from 2019–2023 (e.g. Минтруд/Роструд tasks) could not be enumerated: hacks-ai.ru/leadersofdigital pages were not reachable through search. Some may have used trudvsem data (covered by the other researcher).
- Changellenge, MTS, Tinkoff/T-Bank, Alfa, ITMO and MIPT events: no HR matching dataset surfaced in the GitHub, Kaggle or HF searches. Not exhaustively verified.

## 4. CIS platforms (Kazakhstan, Belarus, Uzbekistan, Ukraine incl. Work.ua and Djinni): any interactions, and how much Russian?

### Takeaway
No CIS dataset with candidate↔vacancy interactions was found.
- **Work.ua (KSE):** separate resume and vacancy corpora, no applications. About 7% of sampled resumes are predominantly Russian and about 4% are IT.
- **Djinni:** filtered to English and Ukrainian with `langdetect`; the authors list "no labels for who was hired".
- **Kazakhstan and Uzbekistan:** vacancy feeds or scrapes only. Enbek's resume XML feed returns 404.

### Cited Findings
- **Work.ua resumes** (`KSE-RESEARCH-Group/Work_UA_resumes`):
  - 103,895 resumes scraped 9 Jul – 22 Aug 2025; CC-BY-NC-4.0.
  - 18 columns: title, age, city, desired_salary (UAH), employment_type, work_location_preference, work_experiences (position, dates, company, city, industry, responsibilities), languages, skills, educations, additional_educations, additional_info, etc.
  - About 19% of structured fields were extracted by Gemini 2.5 Flash, from file resumes and the additional-info blob. The card says "No language filtering has been applied".
  - There is no application or contact field.
  — [HF card](https://huggingface.co/datasets/KSE-RESEARCH-Group/Work_UA_resumes)
- **Work.ua vacancies** (`KSE-RESEARCH-Group/Work_UA_vacancies`): 98,702 vacancies, July–August 2025, 15 columns. "No candidate or applicant data is present" — [HF card](https://huggingface.co/datasets/KSE-RESEARCH-Group/Work_UA_vacancies)
- **Measured Russian and IT share of Work.ua resumes:**
  - Sample: 1,200 rows from 12 random offsets via the datasets-server rows API.
  - Language heuristic on title + work history + additional_info, counting letters unique to each language (ы/э/ъ/ё vs і/ї/є/ґ): 782 Ukrainian, 79 Russian (6.6%), 339 undetermined.
  - IT titles by regex (розробник/разработчик/developer/QA/DevOps/python/java/…): 47/1,200 (3.9%); of these, 3 Russian.
  — [HF datasets-server](https://datasets-server.huggingface.co/rows?dataset=KSE-RESEARCH-Group/Work_UA_resumes&config=default&split=train&offset=0&length=100)
- **Djinni Recruitment Dataset:**
  - Djinni shared 2020–2023 data with the authors. Raw: 294,678 CVs and 443,458 job posts.
  - "Basic filtering" included language filtering: `langdetect` was used "to detect and select data samples exclusively in English and Ukrainian". After it: 241,561 CVs and 358,491 jobs. After near-duplicate removal: 234,480 CVs and 169,358 jobs.
  - Limitations section: "Unlabelled data: The lack of labeled data makes it challenging to determine who was hired". Contributors can ask the authors to delete their data.
  — [UNLP 2024 paper](https://aclanthology.org/2024.unlp-1.2.pdf); [GitHub](https://github.com/Stereotypes-in-LLMs/recruitment-dataset)
- **Kazakhstan, Enbek.kz:** the "Открытые данные" page lists vacancy feeds (Jooble, Yandex formats), a resume XML feed (`/ru/xml/resume`) and two skills-bank files (2020). On 2026-10-08, `/ru/xml/resume` returned HTTP 404 — [enbek.kz/ru/web-services](https://enbek.kz/ru/web-services)
- **Kazakhstan, hh.kz:** `chagatai-htr/headhunter-kazakhstan-all-regions` has 226,680 vacancies with 20 fields (salary, requirement, responsibility, experience, schedule, professional_roles, description, key_skills). No resumes or interactions; no licence — [HF](https://huggingface.co/datasets/chagatai-htr/headhunter-kazakhstan-all-regions)
- **Uzbekistan:** the national vacancy database (ish.mehnat.uz) lets citizens send resumes to vacancies and track status, and employers send requests to candidates. It offers public access to vacancy information only — [dgov.uz](https://dgov.uz/en/solution/detail/87/). Public data found are vacancy scrapes only — [Kaggle Tashkent_Job_Market_Analysis](https://www.kaggle.com/datasets/javohireshonov/tashkent-job-market-analysis); [HF parsed-vacancies-from-headhunter-tashkent](https://huggingface.co/datasets/doublecringe123/parsed-vacancies-from-headhunter-tashkent)

### Inferences
- **Work.ua adds about 7k Russian-language resumes, but they are mostly non-IT** (about 4% IT overall), with no interaction labels. It can only serve as Cyrillic pretraining text, and only under the NC licence.
- **Djinni's raw data** probably contained Russian-language profiles (about 53k CVs were dropped in "basic filtering", which also removed outliers and exact duplicates). The paper does not give a Russian count.
  - Getting Russian profiles or application logs would need a direct request to Djinni or the authors (Drushchak, Romanyshyn).
  - Nothing public suggests they would share applications.

### Gaps
- Belarus (rabota.by, gsz.gov.by): no dataset of any kind was found in Kaggle, HF or GitHub searches. GitHub code search was rate-limited (HTTP 403), so code-level searches for gsz.gov.by, enbek.kz and ish.mehnat.uz did not run.
- data.egov.kz and data.egov.uz catalogues were not browsed directly. Whether they contain aggregate response statistics is unknown.
- robota.ua: nothing found. Whether ResJobFit (Bocharova & Malakhov) used robota.ua or Russian-language data could not be checked: the journal page returned 404 — [aait.op.edu.ua](https://aait.op.edu.ua/index.php/journal/article/view/165)

## 5. Academic Russian papers with published or obtainable matching data; freelance platforms with bids/hires

### Takeaway
No Russian academic paper was found that publishes resume↔vacancy data with real interaction labels. Russian freelance platforms (FL.ru, Kwork, Habr Freelance, Weblancer, Workzilla, YouDo) have only scrapers and bots on GitHub, with no published task+freelancer+bid/hire datasets.

### Cited Findings
- **arXiv API:** queries for "HeadHunter"+job, "hh.ru", resume+vacancy+Russian, and "job recommendation"+Russian returned only one unrelated person-job-fit paper (2604.21264). It uses no Russian data — [arXiv 2604.21264](http://arxiv.org/abs/2604.21264v1)
- **Russian literature found** describes analytics or skills extraction on vacancy and resume text, without interaction data:
  - Skills-extraction model comparison — [SITITO](http://sitito.cs.msu.ru/index.php/SITITO/article/view/1078)
  - Low relevance of hh.ru/SuperJob recommenders (theses) — [scholar.sfu.ru](https://scholar.sfu.ru/publication/89147100)
  - HR-specialist supply and demand from HeadHunter data — [vestnik.susu.ru](https://vestnik.susu.ru/em/article/view/8625)
- **Freelance:** GitHub has only scrapers and Telegram bots, e.g. `ArtemDaemon/Habr-Freelance-Scraper`, `StarayYaga/Bot_parser_tasks_in_habr_and_kwork`, FL.ru parsers. `Wifelly/kwork_dataset` actually contains unrelated CSVs (victim counts). Kaggle and HF searches for kwork, fl.ru and "freelance russia" found nothing — [GitHub ArtemDaemon/Habr-Freelance-Scraper](https://github.com/ArtemDaemon/Habr-Freelance-Scraper); [GitHub Wifelly/kwork_dataset](https://github.com/Wifelly/kwork_dataset)

### Inferences
- Freelance marketplaces publicly show only tasks and the bid count. Freelancer profiles and the chosen executor are partly public on FL.ru and Habr Freelance, so a pair dataset would have to be scraped. That conflicts with these sites' terms.

### Gaps
- eLibrary and Dialogue proceedings were not searched in full text (eLibrary needs login). Russian HR-matching papers with private hh.ru/SuperJob data may exist but are not obtainable.

## 6. Dataset catalogue: per-dataset records and field mapping (plus rejected list)

### Takeaway
Only three real Russian two-sided datasets with interaction labels were found in this scope:
1. DANO hh.ru 2023: 500k pairs, structured, about 5–8% IT.
2. Rabota.ru test task: 298k pairs, structured plus vacancy text, mostly non-IT.
3. ML TalentMatch: 656 pairs, IT-only, full text.

hh_recsys adds real behavioural interactions with vacancy texts, but no candidate side.

### Cited Findings

| # | Name / URL | Size | Both sides? | Interaction & labels | Lang | IT share | License | Status 2026-10-08 |
|---|---|---|---|---|---|---|---|---|
| 1 | DANO 2023–24 №10 "hh.ru: характеристики вакансий и резюме" — [page](https://dano.hse.ru/data2023), [zip](https://dano.hse.ru/mirror/pubs/share/872855918) | 500,000 topics; 189,402 resumes; 319,481 vacancies; 52 MB zip / 428 MB CSV | Y (structured only) | `initial_state`, `final_state` ∈ {response, invitation, discard}; employer- or candidate-initiated | RU | 4.7% (dev+QA+sysadmin); 7.8% incl. support+analyst (measured) | Not stated | Downloadable, no login |
| 2 | Rabota.ru test task "vacancy_resume_data.csv" — [repo](https://github.com/DEli-26/test_task_rabota_ru), [Drive](https://drive.google.com/uc?export=download&id=11TxYKx58dwbJv57xX2EY5mSecZFz4oX3) | 298,072 pairs; 240,107 resumes; 158,374 vacancies; 574 MB | Y (resume structured + title; vacancy has description) | `target_task_1` response 1/0 (50.3% pos); `target_task_2` invitation 1/0 (84.4% pos) | RU | Low, not measured (top roles: driver, sales, cashier) | None (private test task) | Drive link live |
| 3 | ML TalentMatch 2024 case 2 — [repo](https://github.com/MALINAYAGODA/Talent-Match) | 29 vacancies; 656 labeled resumes (193 confirmed / 463 failed); +1 vacancy × 113 unlabeled; 4.5 MB | Y (full text) | confirmed_resumes / failed_resumes per vacancy (screening outcome, inferred) | RU | 100% IT (measured) | None stated | Public on GitHub (≥3 repos) |
| 4 | hh_recsys (Boosters) — [Kaggle](https://www.kaggle.com/datasets/sokolovaleks/recsys-competition-23-24-hh), [Kaggle vac](https://www.kaggle.com/datasets/sokolovaleks/recsys-competition-23-24-hh-vac) | 3.46M train sessions, 882k users; 83k test sessions; 2.73M vacancies (1.95 GB) | **N** (users = ids only) | `action_type` 1/2/3 per event (1 = response per participants; baseline weights 4/1/2) | RU | Not measured; mass-market top titles | None stated (mirror) | Kaggle mirrors live |
| 5 | DANO 2024–25 №7 "hh.ru: аналитика рынка труда" — [page](https://dano.hse.ru/data2024) | Vacancy rows, 76.6 MB | **N** (vacancy only) | Aggregate response/invitation counts per vacancy | RU | ~0 (mass roles only) | Not stated | Downloadable |
| 6 | Work.ua resumes / vacancies (KSE) — [HF](https://huggingface.co/datasets/KSE-RESEARCH-Group/Work_UA_resumes) | 103,895 / 98,702 | Both corpora, **no links** | None | UK (~6.6% RU measured) | ~3.9% (measured) | CC-BY-NC-4.0 | Live |
| 7 | Djinni Recruitment Dataset — [paper](https://aclanthology.org/2024.unlp-1.2.pdf) | 234,480 CVs; 169,358 JDs | Both corpora, **no links** | None ("who was hired" unknown) | EN/UK (RU filtered out) | ~100% IT | MIT | Live |

**Field mapping to our schema**
- **DANO hh.ru (#1):**
  - specialization ← `profession` (only "Программист, разработчик", "Тестировщик", "Системный администратор", "Специалист техподдержки", "Аналитик"; no DS/ML/DevOps)
  - grade ← derivable only from `work_experience_months`
  - stack ← `resume_skills_list` / `vacancy_skills_list`
  - years exp ← `work_experience_months`
  - education ← `education_level`
  - format ← `work_schedule` (full_day/remote/flexible/shift) + employment type, both sides
  - city ← `resume_region` / `vacancy_region`
  - salary ← `expected_salary` / `compensation_from`/`to` (RUB)
  - missing: about-me, work history, vacancy title, description, responsibilities, team context
  - interactions ← `initial_state`→`final_state`
- **Rabota.ru (#2):**
  - specialization ← `resume_position` / `vacancy_custom_position` (free text)
  - years exp ← `resume_offer_experience_year_count` / `vacancy_offer_experience_year_count`
  - salary ← `resume_salary_from` / `vacancy_salary_from`/`to`
  - city ← city ids (codes undocumented)
  - format ← `vacancy_operating_schedule_id`
  - vacancy description ← `vacancy_description`
  - missing: stack, about-me, work history, soft skills
- **ML TalentMatch (#3):**
  - specialization/stack ← `key_skills`, experience `position`
  - about ← `about`
  - work history ← `experienceItem.description`
  - education ← `educationItem`
  - city ← `city`
  - vacancy title/description/requirements ← `name`/`description`
  - salary ← occasional `comment`
  - missing: candidate salary expectation, format, grade label
- **hh_recsys (#4):**
  - vacancy side ← `name`, `description` (HTML: responsibilities, requirements), `keySkills`, compensation, `area`, `workSchedule`, `employment`, `workExperience`
  - candidate side: none

**Short paraphrased examples (no personal data)**
- **#1 DANO:**
  - Candidate: junior "Программист, разработчик" from Tatarstan with 2 months' experience. Wants remote/project work at 40k RUB. Skills: Python, SQL, git, OOP, backend.
  - Responded to a Moscow full-time vacancy at 25–50k RUB requiring Python, aiohttp, async, PostgreSQL, git.
  - final_state = invitation.
  — [dataset](https://dano.hse.ru/mirror/pubs/share/872855918)
- **#2 Rabota.ru:** a pair of a "Дизайнер" resume (salary from 35k, city id 1) with a vacancy of given schedule/salary/description, plus response and invitation flags — [notebook](https://github.com/DEli-26/test_task_rabota_ru/blob/main/2212_test_rabotaru_01_eda.ipynb)
- **#3 TalentMatch:**
  - Vacancy: "Java-разработчик, команда Инвестиции" in a bank, with a long service description and recruiter note "≈450k net".
  - Confirmed candidate: Java/Spring/Hibernate/PostgreSQL/Kafka/Camunda profile.
  - A failed candidate also lists Java, Spring Boot, Hibernate, PostgreSQL, Docker, so keyword overlap alone does not separate the labels.
  — [repo](https://github.com/MALINAYAGODA/Talent-Match)
- **#4 hh_recsys:** user session = viewed v_2597196, viewed v_1223061, then responded (type 1) to v_1223061 within 2 minutes on 19 Nov 2023 — [Kaggle](https://www.kaggle.com/datasets/sokolovaleks/recsys-competition-23-24-hh)

**Rejected (synthetic, LLM-labelled or out of scope)**
- `mindweave/job-postings-applications`: English; the card is titled "Job Postings & Applications (Synthetic)" and tagged synthetic-data — [HF](https://huggingface.co/datasets/mindweave/job-postings-applications)
- `samoilovmikhail/partly-synthetic-dataset-oj-job-applications`: "Partly Synthetic" per its title — [Kaggle](https://www.kaggle.com/datasets/samoilovmikhail/partly-synthetic-dataset-oj-job-applications)
- Stereotypes-in-LLMs Djinni hiring-analyses / bias-mitigation sets: real Djinni texts with LLM-assigned hire/reject labels — [GitHub](https://github.com/Stereotypes-in-LLMs/recruitment-dataset)
- Kaggle `ds-final-competition` (2019): CareerBuilder-style `apps.tsv`/`jobs.tsv`/`users.tsv` files, English/US, out of scope — [Kaggle](https://www.kaggle.com/competitions/ds-final-competition)

### Inferences
- **Practical plan:**
  1. Use DANO #1 (IT subset, about 23–39k pairs) to train or calibrate a structured matcher. Signals: skills overlap, salary fit, format and region; target: invitation vs discard.
  2. Use ML TalentMatch #3 as a small real-text IT evaluation set.
  3. Use hh_recsys vacancy texts for vacancy-encoder pretraining.
  4. Keep Rabota.ru #2 only as an auxiliary behavioural signal, given its licence and PII issues.
- All three label sources reflect employer decisions on candidate-initiated responses, plus some employer-initiated invitations in DANO. That is close to our "employer invitation → candidate" and "candidate response → shortlist/reject" mechanics. None records the candidate accepting or declining an invitation.

### Gaps
- Licences and redistribution rights for #1–#4 are unresolved. Contacting HSE DANO (olympiad organizers) and hh.ru for #1 would be the cleanest route.
- The IT share of #2 and #4 was not measured because the files exceed 200 MB.
