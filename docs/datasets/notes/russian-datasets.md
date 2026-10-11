# Russian-language datasets of resumes/profiles and vacancies for candidate↔employer matching (status as of Oct 2026)

Verification method: every Hugging Face (HF) entry below was checked through the HF Hub API (`/api/datasets/<id>`), the datasets-server `/size` endpoint (row counts) and the README. Small byte-range reads of the data files were used to see column headers. Every Kaggle entry was checked with the authenticated Kaggle CLI (`kaggle datasets list/metadata/files`), which gives title, licence, description and file sizes. Kaggle does not expose row counts or columns through the API, so those come from the dataset description or from public notebooks that use the dataset. Nothing was downloaded in full. "Unverified" means I could not confirm the item directly.

## 1. Which Kaggle and Hugging Face datasets contain hh.ru (HeadHunter) resumes and/or vacancies in Russian?

### Takeaway
There are many hh.ru **vacancy** dumps (IT-only and all-industry; 2021, 2023, 2024 and 2026 snapshots; from about 100 rows to 560k+ rows). Openly downloadable hh.ru **resume** data is rare. The main one is the 44,744-row "SkillFactory" hh.ru resume export from about 2018–2019, which has 12 raw text columns, includes many non-IT resumes and has no vacancy link. Better candidate-side Russian sources are the anonymized resume titles and descriptions in `daswer123/job_classification_dataset_ru` and the resume tables of the Rostrud/trudvsem dump (see Q3). The best IT vacancy corpora for parsing employer needs are `vyacheslavpanteleev1` (47k IT, 2021), `ilyazawilsiv` (IT, all Russia, 2023), `agoptar/russian-it-vacancy` (hh + Habr Career, has a **grade** column) and `skeethook` (IT, Sept 2026, has a response count).

### Cited Findings

**A. Kaggle: hh.ru vacancies**
- **HH.ru IT vacancies (IT вакансии Москва + Питер)**, `vyacheslavpanteleev1/hhru-it-vacancies-from-20211025-to-20211202`. "47330 unique IT vacancies", Moscow and Saint Petersburg, published 2021-10-25 to 2021-12-02. 15 columns: company, position name, salary-present flag, salary min/max, experience, schedule, key skills, full job description, city, professional job title, specialization, professional area, publication date. One file, `IT_vacancies_full.csv` (188 MB). Licence "other". Side: vacancies only; 100% IT. — [Kaggle](https://www.kaggle.com/datasets/vyacheslavpanteleev1/hhru-it-vacancies-from-20211025-to-20211202)
- **IT Vacancies from HeadHunter Website**, `ilyazawilsiv/it-vacancies-from-headhunter-website`. Collected through the hh.ru API between 18 Sep and 17 Oct 2023 across all of Russia. Includes workplace coordinates, professional role, employment type, experience and key skills. `IT_vacancies.csv` is 294 MB. Licence Apache-2.0. 100% IT. — [Kaggle](https://www.kaggle.com/datasets/ilyazawilsiv/it-vacancies-from-headhunter-website)
- **Raw Jobs Data from Head Hunters Russia**, `etietopabraham/jobs-raw-data`. "over 560,000 job listings" from the hh.ru API covering all industries: titles, salaries, job types, descriptions, key skills. `Raw_Jobs.csv` is 1.56 GB. Licence CC BY 4.0. The author's stated aim was a graph-based job recommender. — [Kaggle](https://www.kaggle.com/datasets/etietopabraham/jobs-raw-data). Its collection period is given as 04–05.2023 by a derived HF dataset — [HF MrAlexGov card](https://huggingface.co/datasets/MrAlexGov/it-job-title-skills-ru)
- **Russian Job Market Vacancies from hh.ru (2026)**, `anastasiavdovina/russian-job-market-vacancies-from-hh-ru-2026`. About 129,000 vacancies in 9 cities and 27 professional fields (built from 304 professional roles), collected 12–13 July and 30 July 2026 "after the API closure". Already processed: deduplicated by vacancy id, salaries converted to RUB, work formats expanded into boolean columns, a salary_period column (per month / shift / hour / rotation). Files: `hh_vacancies_2026_07.csv` (66 MB) and a data dictionary. Licence "other". IT is one field among 27. — [Kaggle](https://www.kaggle.com/datasets/anastasiavdovina/russian-job-market-vacancies-from-hh-ru-2026)
- **HH.ru IT Vacancies Russia 2026**, `skeethook/hh-ru-it-vacancies-russia-2026`. 6,968 unique IT vacancies scraped on 26.09.2026 from hh.ru search pages for 10 queries (python, java, data analyst, data scientist, frontend, devops, tester, golang, 1C, C++). 42 features: employer and its rating, city/metro, salary range and currency, experience, schedule and **work format**, publication date, **number of responses (число откликов)**. Not cleaned; salary is present in about 37%. Licence CC BY-NC-SA 4.0. Scraper at github.com/skeethook/hh-vacancies-dataset. — [Kaggle](https://www.kaggle.com/datasets/skeethook/hh-ru-it-vacancies-russia-2026)
- **HH.RU Вакансии Москва Питер**, `iinott/hh-ru`. `HH_IT_VACANTIONS.csv` is 188 MB. Licence MIT. Uploaded June 2026 with no description. — [Kaggle](https://www.kaggle.com/datasets/iinott/hh-ru)
- **Data analyst vacancies on HeadHunter for 2023-2024**, `lludop/...`. All vacancies with "аналитик" in the title, collected daily through the hh.ru API from Aug 2023 to Aug 2024 (ETL project TTuPoJILoK/analytics_hh). `vacs.csv` is 840 MB. Licence Apache-2.0. — [Kaggle](https://www.kaggle.com/datasets/lludop/data-nalyst-vacancies-on-headhunter-for-2023-2024)
- **Open Vacancies Dataset (Moscow) May 2024**, `tanelid/...`. hh.ru API data with job titles, location, skills, experience and salary. 10.8 MB. Licence GPL-3.0. — [Kaggle](https://www.kaggle.com/datasets/tanelid/open-vacancies-datasetmoscow-may-2024)
- **HeadHunter_Vacancies**, `pavfedotov/heaadhunter-vacancies`. Per-query CSVs: Java, Kotlin, Python (2021-08-04), plus data, df and ds files from 2021-07. Licence CC0. 1,308 downloads. — [Kaggle](https://www.kaggle.com/datasets/pavfedotov/heaadhunter-vacancies)
- Small hh.ru IT and data snapshots:
  - `antonbelyaevd/headhunter-vacancies-for-data-search`: "data" query, Moscow, 2023-08-28, 235 KB, Apache-2.0 — [Kaggle](https://www.kaggle.com/datasets/antonbelyaevd/headhunter-vacancies-for-data-search)
  - `gennadiimanzhos/data-analyst-vacancies`: 1,000 rows × 36 columns, Oct 2023, raw, Apache-2.0 — [Kaggle](https://www.kaggle.com/datasets/gennadiimanzhos/data-analyst-vacancies)
  - `olkhovaya/hh-ru-data-engineer-jobs-june-2026`: 119 Data Engineer postings, June 2026. Includes a heuristic `seniority_level` (Junior/Middle/Senior/Lead) and a `tech_stack` column. MIT — [Kaggle](https://www.kaggle.com/datasets/olkhovaya/hh-ru-data-engineer-jobs-june-2026)
- **Yandex Jobs**, `kirili4ik/yandex-jobs`. "More than 600 IT vacancies in Russian" parsed from the Telegram channel t.me/ya_jobs. Structured fields: Header, Emoji, Description, **Requirements**, **Tasks**, plus pluses/hashtags; the author says there are no missing values. `vacancies.csv` is 2.3 MB. Licence unknown. Useful for parsing a vacancy into requirements vs responsibilities. — [Kaggle](https://www.kaggle.com/datasets/kirili4ik/yandex-jobs)
- **Partly Synthetic dataset of job applications**, `samoilovmikhail/...`. Russian job vacancy records: `title`, `salary` (JSON min/max/currency), `experience` (JSON), description, an LLM-assigned `label` (job category), geocoded address. The `meta` timestamps/views "may be partially synthetic". `jobs.csv` is 35 MB. Licence Apache-2.0. The source site is not stated. — [Kaggle](https://www.kaggle.com/datasets/samoilovmikhail/partly-synthetic-dataset-oj-job-applications)

**B. Kaggle: hh.ru resumes**
- **Resume HH**, `sameelie/resume-hh`. A single `hh_ru.csv` of 455,491,667 bytes. No description; licence "unknown". Uploaded 2023-05-25. — [Kaggle](https://www.kaggle.com/datasets/sameelie/resume-hh). The only public notebook reads it with `delimiter=';'` and joins all columns into one "resume" text — [Kaggle notebook grafys/project-dl](https://www.kaggle.com/code/grafys/project-dl)
- The well-known SkillFactory course file `dst-3.0_16_1_hh_database.csv` is described as "~455 МБ", a "Экспорт резюме HeadHunter (hh.ru)", separator `;`, **44,744 rows**, 12 raw columns:
  - `Пол, возраст`, `ЗП`, `Ищет работу на должность:`, `Город, переезд, командировки`
  - `Занятость`, `График`, `Опыт работы` (free text), `Последнее/нынешнее место работы`
  - `Последняя/нынешняя должность`, `Образование и ВУЗ`, `Обновление резюме`, `Авто`
  
  It is distributed by Google Drive link. The accompanying exchange-rate file covers 29.12.2017–05.12.2019. — [GitHub ALyukmanov/SF_projects data README](https://github.com/ALyukmanov/SF_projects/blob/main/projects/hh-resume-salary-eda/data/README.md); [GitHub postvlone/hh_project](https://github.com/postvlone/hh_project)

**C. Hugging Face: hh.ru vacancies or resumes**
- **trewwxsav/IT_vacancies_from_hh.ru**. Apache-2.0, created 2024-06-20, one `all_vacancies.csv` of 47.3 MB, `;`-separated. Columns: `название_вакансии; название_компании; опыт работы; местоположение; требования_обязанности; зарплата_число; зарплата_текст`. The text is lower-cased and the requirements field is a truncated search-snippet ("...") rather than the full description. The datasets-server cannot parse it (0 rows reported), so the row count is unknown. — [HF](https://huggingface.co/datasets/trewwxsav/IT_vacancies_from_hh.ru)
- **agoptar/russian-it-vacancy**. Language ru. Described as parsed IT vacancies "с hh и хабр-карьеры". Fields: id, name, city, **salary**, employer, type (open/closed), experience, employment, role, description (HTML), **grade**. The stated purpose is salary prediction. `IT_vac.csv` is 209 MB. No licence declared. Row count not computed (datasets-server reports 0). — [HF](https://huggingface.co/datasets/agoptar/russian-it-vacancy)
- **Textovic/hh_vacancy**. 9,752 rows × 38 columns, Apache-2.0, Aug 2025. Columns:
  - Raw hh fields: id, name, area, salary, salary_range, experience, schedule, employment, description, key_skills, professional_roles, employer, published_at, alternate_url, raw_data, …
  - Derived DS/ML skill groups: `has_языки`, `библиотеки_ML_skills`, `NLP_skills`, `CV_skills`, `MLOps_skills`, `базы_данных_skills`, `skills_count`, …
  
  Appears focused on Data Science and ML vacancies (the first row is "Data Scientist", remote). — [HF](https://huggingface.co/datasets/Textovic/hh_vacancy)
- **MrAlexGov/it-job-title-skills-ru**. **51,029 IT vacancies** from hh.ru (2023). Records are `{"title","skills":[...],"experience","source"}` with a 1,119-skill vocabulary. Built from the Kaggle datasets `etietopabraham/jobs-raw-data` (04–05.2023) and `ilyazawilsiv` (09–10.2023). Synonyms merged, 71 soft skills removed, deduplicated. "Полных текстов вакансий и названий компаний нет". Licence CC BY 4.0. Published 2026-09-29. — [HF](https://huggingface.co/datasets/MrAlexGov/it-job-title-skills-ru)
- **russian-oracle/vacancy-section-classifier-ru**. 18,145 hh.ru vacancy text chunks (2024–2025), split 13,973 / 2,082 / 2,090. Five classes: responsibilities, requirements, terms (salary/benefits), notes (company intro), junk. Labels come from rule-based pre-labelling plus an Opus-4 relabelling pass. Employer names are replaced with industry tokens (БАНК, IT-КОМПАНИЯ, …). Licence CC BY 4.0. — [HF](https://huggingface.co/datasets/russian-oracle/vacancy-section-classifier-ru)
- **evilfreelancer/headhunter**. 319 rows: id, name, description, technologies (list). MIT, Dec 2023. — [HF](https://huggingface.co/datasets/evilfreelancer/headhunter)
- **AlekseyScorpi/vacancies_prompts**. 48,564 (prompt, description) pairs generated from the Kaggle `vyacheslavpanteleev1` hh.ru IT 2021 dataset; the prompt is built from employer, name, experience, schedule and keys. MIT. `Psydrunk/vacancies_prompts` (2026-05) is an identical copy with the same byte size and row count. — [HF AlekseyScorpi](https://huggingface.co/datasets/AlekseyScorpi/vacancies_prompts); [HF Psydrunk](https://huggingface.co/datasets/Psydrunk/vacancies_prompts)
- **daswer123/job_classification_dataset_ru** (47,535 rows) and **_v2_ru** (18,232 rows). Built from "Реальные резюме из hh.ru с дополнительной анонимизацией". Instruction format: input = "Название профессии: … / Описание профессии: …" from the resume; output = a generalized profession name produced by Claude 3 Sonnet. MIT. `art403/job_classification_dataset_v2_ru` is a re-upload of v2. **This is the most usable openly licensed Russian resume-side text (title plus experience description) I found.** — [HF v1](https://huggingface.co/datasets/daswer123/job_classification_dataset_ru); [HF v2](https://huggingface.co/datasets/daswer123/job_classification_dataset_v2_ru)
- **liovina/vacancyradar-data**. 7,453,262 rows of aggregated hh.ru employer and market events (`week_start, employer_id "hh:…", employer_name, new_vacancies, closed_vacancies, disclosure_rate, median_time_to_close_days`), plus weekly role-salary and skill-velocity aggregates, Apr–May 2026. No README and no licence. Market statistics only, no texts. — [HF](https://huggingface.co/datasets/liovina/vacancyradar-data)
- **chagatai-htr/headhunter-kazakhstan-all-regions** (hh.kz, not Russia). 226,680 rows, 20 columns: name, salary_from/to, currency (KZT), requirement, responsibility, experience, employment, schedule, professional_roles, address/lat/lon, description (HTML), key_skills, period (e.g. "July 2024"). Languages ru/kk/en. CC BY 4.0. Created 2026-10-04. — [HF](https://huggingface.co/datasets/chagatai-htr/headhunter-kazakhstan-all-regions)
- **doublecringe123/parsed-vacancies-from-headhunter-tashkent** (hh.uz). Gated (auto-approval), en/ru, 1K–10K rows. Not inspected because of the gate. — [HF](https://huggingface.co/datasets/doublecringe123/parsed-vacancies-from-headhunter-tashkent)

**D. Russian IT vacancies from Telegram channels**
- **ScoutieAutoML/it_vacancies_vectorisation**. 51,078 posts from Russian-language Telegram IT-vacancy channels (ML, DS, frontend, backend, …). Fields: text, url, channel, **views**, createTime, clusterId, embedding vector, NER spans, sentiment, language (RUS/ENG), spam flag, length. Languages ru+en. No licence declared. CSV is 972 MB. — [HF](https://huggingface.co/datasets/ScoutieAutoML/it_vacancies_vectorisation)
- **exeyarikus/ru-tech-jobs**. 1,092 IT job posts from one Telegram channel: id, date, raw markdown text, **views**, tags. MIT. Aug 2026. — [HF](https://huggingface.co/datasets/exeyarikus/ru-tech-jobs)

**E. Context: why fresh hh.ru data is hard to get in 2026**
- Since April 2026, unauthenticated requests to hh.ru's public `GET /vacancies` return 403. API access now needs a verified employer or recruitment-service application. The source says that "researchers, enthusiasts and authors of personal non-commercial projects" no longer have a legitimate automated route. — [anti-malware.ru, 2026-08-12](https://www.anti-malware.ru/news/2026-08-12-111332/51002)
- A search-engine summary says the applicant-side API was closed earlier (the dates quoted were "15 Dec 2025", and in the same snippet "since December 2024"). I did not fetch a primary source for this. — (unverified)

### Inferences
- `sameelie/resume-hh` is almost certainly the same SkillFactory export (44,744 resumes, about 2018–2019). The byte size matches (~455 MB) and so do the `;` delimiter and the "hh_ru.csv" naming. Its licence is unknown, and it contains PII-like fields (sex, age/birth date, city, employer names, education institution). No resume↔vacancy links exist in it.
- `iinott/hh-ru` (188,231,590 B, "Москва Питер", IT) is very likely a re-upload of `vyacheslavpanteleev1` (188,375,012 B, Moscow + SPb IT, 2021). Do not count it as an independent 2026 snapshot.
- Overlap and duplicates across datasets are common:
  - `AlekseyScorpi`, `Psydrunk` and `iinott` all derive from `vyacheslavpanteleev1`.
  - `MrAlexGov` derives from `etietopabraham` and `ilyazawilsiv`.
  - `art403` is a copy of `daswer123` v2.
  
  When pooling data, deduplicate by hh vacancy id or URL (most raw dumps keep `id` or `alternate_url`).
- For FSP Career task (a), parsing an employer need into spec/grade/stack/salary, the most useful sources are:
  - `agoptar` (explicit grade + salary + role)
  - `vyacheslavpanteleev1` / `ilyazawilsiv` (key_skills + salary + experience)
  - `russian-oracle` (sectioning requirements vs terms)
  - `kirili4ik/yandex-jobs` (Requirements / Tasks split)
  - `MrAlexGov` (title→skills multilabel)
  
  hh.ru's "experience" buckets (noExperience / 1–3 / 3–6 / 6+) can serve as a weak grade proxy.
- For task (b), classifying candidate text into spec/grade, open Russian resume text is scarce. `daswer123` (resume title + description → profession) is the main open option; SkillFactory/`sameelie` and trudvsem CVs add volume but are mostly non-IT.

### Gaps
- Exact row counts for `agoptar/russian-it-vacancy`, `trewwxsav`, `ilyazawilsiv`, `iinott`, `lludop`, `sameelie` and `etietopabraham` beyond the "560k+" in its description. The files are not parseable by datasets-server, Kaggle gives no row counts, and I did not download full files.
- The IT share in `etietopabraham` and `anastasiavdovina` was not computed.
- I found no openly licensed, large, recent (2024–2026) Russian **IT resume** dataset on Kaggle or HF.
- The terms of the hh.ru user agreement for redistributing scraped vacancies were not reviewed here; most Kaggle licences are uploader-declared.

## 2. Did hh.ru or partners release datasets through competitions (ODS, AI Journey, Цифровой прорыв, ЛЦТ, Sber/Yandex), and are they downloadable?

### Takeaway
Yes, the clearest case is **hh.ru's second ML championship "hh_recsys"** (announced 29 Dec 2023, prize fund 500,000 RUB) on the **Boosters** platform. It had about 3.46M training sessions (Nov 2023) with vacancy views and **responses (action_type = 1 used as the target)**, plus a vacancy content file with names, descriptions, key skills, region, schedule, employment, experience and compensation. Official public download status in 2026 is unverified: the Boosters page renders only a JS shell, and no Kaggle or HF mirror exists. Unofficial Google Drive mirrors are linked from participants' GitHub repos. I found no public hh-provided dataset from ЛЦТ, Цифровой прорыв, AI Journey or Sber/Yandex contests.

### Cited Findings
- hh.ru announced the "Новогодний ML-чемпионат от hh.ru" on 29 Dec 2023, described as its **second** ML championship. Prize fund 500,000 RUB. Task: "по последовательности событий внутри пользовательских сессий предсказать следующую вакансию, на которую пользователь откликнется в своей следующей сессии". Platform: boosters.pro/championship/hh_recsys. — [Habr hh.ru news](https://habr.com/ru/companies/hh/news)
- A participant lists it as "RecSys Competition/2024 — ML-чемпионат от hh.ru на boosters — Предсказание вакансии, на которую пользователь откликнется по последовательности событий внутри сессий" (8th place, bronze). — [GitHub alex-sokolov2011/pet-projects](https://github.com/alex-sokolov2011/pet-projects)
- Data files and structure, from a participant's EDA notebook:
  - Files: `hh_recsys_train_hh.pq`, `hh_recsys_test_hh.pq`, `hh_recsys_vacancies.pq`, `hh_recsys_sample.pq`.
  - Train rows are sessions: `user_id`, `session_id`, `vacancy_id` (list), `action_type` (list of codes 1/2/3), `action_dt` (list of timestamps).
  - Train has 3,463,064 sessions from 882,409 users covering 1,458,353 distinct vacancies, dated 2023-11-01 to 2023-11-14.
  - Test has 83,189 users (one session each), dated 2023-11-15 to 2023-11-21.
  
  — [GitHub Dmitri00/hh_ru_recsys_2024](https://github.com/Dmitri00/hh_ru_recsys_2024)
- Another participant's loader filters `action_type == 1` as the target. It reads vacancy columns `name`, `description`, `keySkills.keySkill`, `area.regionId`, `area.id`, `workSchedule`, `employment`, `workExperience` (values like `noExperience`, `between1And3`) and `compensation.currencyCode`. — [GitHub roma1n/hh-recsys-competition, hh/data.py](https://github.com/roma1n/hh-recsys-competition)
- A third-party project links Google Drive copies of "Vacancies data", "Train data", "Test data" and others for its hh job-recommendation bot. — [GitHub kuchina-anastasia11/project_ResSys, data/data.txt](https://github.com/kuchina-anastasia11/project_ResSys)
- `https://boosters.pro/championship/hh_recsys/overview` and `/data` return HTTP 200 but only a "Boosters" JS shell (3.6 KB). The content was not readable through fetch. `boosters.world` did not resolve. — [Boosters](https://boosters.pro/championship/hh_recsys/overview)
- An earlier hh-related Kaggle upload, **HeadHunter Employer Review Competition** (`aleron751`), has the subtitle "Данные для классификации запросов на русском". Files: `HeadHunter_train.csv` (24.7 MB), `HeadHunter_test.csv` (21.3 MB), sample submission. Uploaded 2021-12-30; licence unknown. It concerns employer reviews, not candidate↔vacancy matching. — [Kaggle](https://www.kaggle.com/datasets/aleron751/headhunter-employer-review-competition)
- A 2017 hh.ru-blog-hosted analysis of 566,178 IT resumes mentions a "датасет резюме hh.ru, который участвовал в каком-то хакатоне". No download link is given. — [Habr hh blog 344724](https://habr.com/ru/company/hh/blog/344724/)
- ЛЦТ 2025 had HR-Tech tasks: employee adaptation (Proscom), "painless hiring" with training offers to rejected candidates (Reksoft), and an employee-motivation platform (Alabuga). The article says nothing about hh.ru involvement or public datasets. — [Habr 959808](https://habr.com/ru/articles/959808/)
- "ML TalentMatch" (a student hackathon, applications until 25 Feb 2024) had a resume↔vacancy matching case, according to a search snippet. The page could not be fetched (TLS error), so the data source is unknown. — [berza.ru](https://berza.ru/hackathon-ml-talent-match/) (unverified)

### Inferences
- hh_recsys is the only verified **hh.ru-official** release of real interaction data: views and responses tied to vacancy texts. It has **no resume or candidate texts** (users are anonymous ids), so it suits behavior-based ranking/recsys and vacancy-text pretraining, not resume↔vacancy cross-encoders. Licence and redistribution terms are unknown (competition rules), and the Google Drive mirrors are unofficial.
- The action_type semantics are not verified. Using code 1 as the target suggests 1 = response (отклик); 2 is the most frequent and is probably a view; 3 is possibly a favourite.
- The `darysha/hse-hackathon` Kaggle dataset (Q4) is "authentic Russian job market data" from an HSE hackathon, but I could not confirm which organizer supplied it.

### Gaps
- The first hh.ru ML championship (task, data) was not identified.
- Official current downloadability and licence of the hh_recsys data are unverified, as is the exact vacancy row count of `hh_recsys_vacancies.pq`.
- I found no ODS.ai, AI Journey, Цифровой прорыв, Sber or Yandex competition that published Russian resume or vacancy matching data. Searches returned only VK/Sber/Avito recsys contests in unrelated domains. I also found no ЛЦТ task with a public HR matching dataset, including any 2026 ФСП/hh task data.

## 3. Are there datasets from Superjob, Habr Career, Работа России (trudvsem), Avito Работа, getmatch or Zarplata.ru on Kaggle/HF/GitHub?

### Takeaway
**Работа России (trudvsem.ru) is by far the richest open source.** The research data infrastructure of ЦНИИ (RCSI, data.rcsi.science) publishes a processed 2018–2021 dump of trudvsem.ru under CC BY-SA 4.0. It has **10.58M resumes, 13.28M vacancies, 1.82M responses and 7.89M invitations** with linking IDs. Habr Career appears only in tiny scrapes and in the mixed `agoptar` set. I found nothing for Superjob, getmatch or Zarplata.ru on Kaggle or HF, and Avito appears only in a 91-row non-IT sample.

### Cited Findings
- **RCSI dataset 186**, "Обработанные и объединенные сведения портала trudvsem.ru". Publisher/source: Rostrud. 13 linked CSV tables: CVs, vacancies, responses (отклики), invitations (приглашения), organizations, work experience, education, additional education, professions reference, industries reference, regions, citizen analytics, company analytics. Covers 01.01.2018–30.10.2021, about 20M observations with 100+ attributes. CSV in UTF-8 with `;` separator. Licence CC BY-SA 4.0. Access: the catalog page says "open to all registered users". Last updated 2 Dec 2021. — [data.rcsi.science](https://data.rcsi.science/data-catalog/datasets/186/)
- RCSI wiki row counts: curricula_vitae 10,580,887; workexp 12,166,888; edu 4,540,219; addedu 1,304,805; vacancies 13,282,732; responses 1,820,667; invitations 7,889,720. Linking keys are `id_candidate`, `id_cv`, `id_vacancy` and `id_hiring_organization`; the responses table has 16 attributes and invitations 15. Known issues: manual-entry errors (end dates before start dates, anomalous birth years and experience), HTML tags and misspellings in text. The wiki page itself states no registration requirement, which conflicts with the catalog's "registered users" wording. — [RCSI wiki](https://wiki-data.rcsi.science/index.php/%D0%92%D0%B0%D0%BA%D0%B0%D0%BD%D1%81%D0%B8%D0%B8,_%D1%80%D0%B5%D0%B7%D1%8E%D0%BC%D0%B5,_%D0%BE%D1%82%D0%BA%D0%BB%D0%B8%D0%BA%D0%B8_%D0%B8_%D0%BF%D1%80%D0%B8%D0%B3%D0%BB%D0%B0%D1%88%D0%B5%D0%BD%D0%B8%D1%8F_%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D0%BB%D0%B0_%C2%AB%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B8%C2%BB_%D0%B7%D0%B0_2018%E2%80%942021_%D0%B3%D0%BE%D0%B4%D1%8B)
- Kaggle **Moscow vacancies from trudvsem.ru 2018-2021**, `emilte/vacs-trudvsem`. The RCSI 186 vacancies table filtered to Moscow (region 77): `filtered_vacancies_region_77.csv`, 596 MB. CC BY-SA 4.0. Vacancies only. — [Kaggle](https://www.kaggle.com/datasets/emilte/vacs-trudvsem)
- trudvsem.ru's own open-data page, `trudvsem.ru/opendata/datasets`, returned HTTP 460 to my requests (blocked), so I could not inspect it directly. Search snippets say it publishes vacancies, depersonalized resumes, responses, invitations and analytics in XML/CSV/JSON. — [trudvsem opendata](https://trudvsem.ru/opendata/datasets) (current availability unverified)
- **Habr Career**:
  - `einsam225/habr-jobs`: "40 страниц вакансий взятых с Хабра", scraped 8 July 2025, `habr_job.csv` 157 KB, licence unknown — [Kaggle](https://www.kaggle.com/datasets/einsam225/habr-jobs)
  - `agoptar/russian-it-vacancy`: hh + Habr Career IT vacancies with grade (see Q1) — [HF](https://huggingface.co/datasets/agoptar/russian-it-vacancy)
- **Avito**: `browther/russian-simple-vacancies-filtered` has 91 rows (49 avito.ru, 30 hh.ru, 12 trudvsem.ru), filtered from 16,242 records to gig and logistics vacancies. It explicitly drops engineers and corporate roles, so it has no IT relevance. — [HF](https://huggingface.co/datasets/browther/russian-simple-vacancies-filtered)
- HF Hub searches for "superjob", "habr-career", "career.habr", "zarplata", "getmatch", "rabota" and "trudvsem" returned no relevant datasets. Kaggle searches for "superjob", "zarplata.ru", "rabota.ru", "getmatch" and "habr career" returned only `einsam225/habr-jobs`. GitHub repo searches returned only code (e.g. a trudvsem JSON-to-Excel converter), no datasets. — [HF datasets search](https://huggingface.co/datasets?search=superjob); [Kaggle datasets search](https://www.kaggle.com/datasets?search=superjob)
- `medvedevlev/vacancies2020` (`vacancies_2020.csv`, 2.73 GB, licence unknown, no description) is used in a "Skills Extraction" notebook. Its source (possibly trudvsem) is unverified. — [Kaggle](https://www.kaggle.com/datasets/medvedevlev/vacancies2020)
- `techsalerator/job-posting-data-in-russia` is a commercial vendor's sample of 39 MB, Apache-2.0, aggregated "from company websites, job boards, and recruitment agencies". The language mix of its texts is unverified. — [Kaggle](https://www.kaggle.com/datasets/techsalerator/job-posting-data-in-russia)
- Adjacent, not Russian: the **Djinni Recruitment Dataset** (Ukrainian IT job board), 2020–2023, MIT. It has 210,250 English-CV rows, 24,230 Ukrainian-CV rows and 141,897 English job-description rows. CV fields include Position, Moreinfo, Looking For, Highlights, Experience Years, CV, CV_lang. Published at UNLP @ LREC-COLING 2024. — [HF lang-uk English CVs](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english)

### Inferences
- The trudvsem/RCSI dump is the only **open, large, Russian, two-sided dataset with real interaction labels** (responses and invitations linking `id_cv` to `id_vacancy`). It is dominated by blue-collar and public-sector jobs, so the IT share is likely small but still large in absolute terms; it would need filtering by profession or industry. Its PII risk is moderate: birth years, region, work history and organization names, with depersonalized identities.
- For a 2026 IT reverse-recruiting product, the trudvsem data is best used for pretraining or weak supervision (response = weak positive, invitation = stronger positive), followed by fine-tuning on IT-specific or synthetic pairs.

### Gaps
- The IT share in the trudvsem dump was not computed. Whether data.rcsi.science still serves downloads in 2026 (and whether registration is required) was not tested. Whether trudvsem.ru/opendata still publishes the CV, response and invitation feeds in 2026 was not verified because of the HTTP 460 block.
- I found no Superjob, getmatch, Zarplata.ru or Avito Работа dataset of meaningful size.

## 4. Any Russian datasets with resume–vacancy pairs or labels (match/no match, response/invite)?

### Takeaway
There are three verified options, plus one heavily-derived option:
1. **Real labels, large:** the trudvsem/RCSI dump (1.82M responses and 7.89M invitations linking CVs to vacancies; Q3).
2. **Real labels, ready-made pairs:** Kaggle **`darysha/hse-hackathon` "Resume-Job Matching Dataset"**, with resume and vacancy features per row and `cv_status` = Приглашение/Отказ. It is 1.02 GB uncompressed; licence unknown.
3. **Translated from English:** `niktigerbill/resume-job-description-fit-ru`, 8,000 resume–JD pairs labelled No/Potential/Good Fit, CC BY 4.0, not real Russian data.
4. **Behavioral, no resumes:** hh_recsys sessions (views and responses; Q2).

### Cited Findings
- **Resume-Job Matching Dataset**, `darysha/hse-hackathon`. Subtitle: "Authentic Russian job market data: resumes and vacancies for matching". It contains job applicants (resumes) and job vacancies "along with the response status ('Invitation' or 'Rejection')". Features include demographics, education, work experience, skills, desired salary, required skills, conditions and offered salary. One file, `train.csv` (1,020,325,717 bytes; Kaggle compressed size 215.7 MB). Licence "unknown". Uploaded 2025-06-04; 844 downloads. — [Kaggle](https://www.kaggle.com/datasets/darysha/hse-hackathon)
- The author's notebook reads it with `sep='|'`, keeps `cv_status ∈ {'Отказ','Приглашение'}` as the binary target, and uses columns `idCv`, `skills_cv`, `skills_vacancy`, `salary_cv`, `salary_vacancy`, `experience`, `experienceRequirements`, `locality`, `localityName`. Model: CatBoost on skill TF-IDF similarity, salary difference, experience difference and location match. — [Kaggle notebook darysha/automated-resume-job-matching-model](https://www.kaggle.com/code/darysha/automated-resume-job-matching-model)
- **niktigerbill/resume-job-description-fit-ru**. A Russian translation of the English `cnamuangtoun/resume-job-description-fit`. 8,000 pairs (train 6,241 / test 1,759) with columns `id, resume_text, job_description_text, label ∈ {No Fit, Potential Fit, Good Fit}`. CC BY 4.0. Published 2026-05-10. — [HF](https://huggingface.co/datasets/niktigerbill/resume-job-description-fit-ru)
- **trudvsem/RCSI**: the responses (1,820,667) and invitations (7,889,720) tables link `id_cv` ↔ `id_vacancy`, alongside 10.58M CVs and 13.28M vacancies. — [RCSI wiki](https://wiki-data.rcsi.science/index.php/%D0%92%D0%B0%D0%BA%D0%B0%D0%BD%D1%81%D0%B8%D0%B8,_%D1%80%D0%B5%D0%B7%D1%8E%D0%BC%D0%B5,_%D0%BE%D1%82%D0%BA%D0%BB%D0%B8%D0%BA%D0%B8_%D0%B8_%D0%BF%D1%80%D0%B8%D0%B3%D0%BB%D0%B0%D1%88%D0%B5%D0%BD%D0%B8%D1%8F_%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D0%BB%D0%B0_%C2%AB%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0_%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D0%B8%C2%BB_%D0%B7%D0%B0_2018%E2%80%942021_%D0%B3%D0%BE%D0%B4%D1%8B)
- **hh_recsys**: user sessions with `action_type` (1 used as the response target) over vacancies with full texts; no resume texts. — [GitHub Dmitri00/hh_ru_recsys_2024](https://github.com/Dmitri00/hh_ru_recsys_2024); [GitHub roma1n/hh-recsys-competition](https://github.com/roma1n/hh-recsys-competition)
- Weak popularity signals without candidate side:
  - `skeethook` has a per-vacancy response count — [Kaggle](https://www.kaggle.com/datasets/skeethook/hh-ru-it-vacancies-russia-2026)
  - Telegram IT posts carry view counts (`ScoutieAutoML`, `exeyarikus`) — [HF Scoutie](https://huggingface.co/datasets/ScoutieAutoML/it_vacancies_vectorisation); [HF exeyarikus](https://huggingface.co/datasets/exeyarikus/ru-tech-jobs)
- A Kaggle notebook built resume–job pairs ad hoc by concatenating hh.ru resume rows with Yandex Jobs vacancies, i.e. unlabelled pseudo-pairs, and used `sberbank-ai/sbert_large_nlu_ru`. This illustrates the lack of labelled Russian IT pairs. — [Kaggle notebook grafys/project-dl](https://www.kaggle.com/code/grafys/project-dl)

### Inferences
- The field names in `darysha/hse-hackathon` (`idCv`, `experienceRequirements`, `localityName`, the Invitation/Rejection status) look like the trudvsem/"Работа России" schema rather than hh.ru's (hh uses `workExperience`, `area`, `keySkills`). This is likely, but not verified, which would make it a pre-joined resume×vacancy×outcome extract of state-portal data with a mostly non-IT occupational mix. Treat the "Отказ" rows as **hard negatives** only with care: rejections often reflect employer-side factors.
- For FSP Career task (c), ranking candidates for a need, a practical recipe:
  - Pretrain or weakly supervise a bi-encoder on trudvsem responses and invitations or on `darysha` pairs: positives = invitations; negatives = rejections plus in-batch or random negatives.
  - Optionally add `niktigerbill` 3-class pairs, noting that it is translationese.
  - Then calibrate on IT-only synthetic or LLM-labelled pairs built from the IT vacancy corpora (Q1) and IT candidate profiles.
  
  No verified open dataset gives Russian **IT** resume↔vacancy pairs with real hiring labels.

### Gaps
- Row count, IT share, collection period and provenance of `darysha/hse-hackathon` were not verified (file not downloaded; description silent).
- Yandex Crowd Solutions reportedly labelled ">100,000" resume–vacancy pairs for HeadHunter (DSSM training) per a search snippet. The page returned 404, and such data would be internal, not public. — (unverified)
- RJDB (arXiv 2311.06383, 50k+ JD / matching-resume / non-matching-resume triples) surfaced in search. Its language (believed English) and licence were not verified in this session. — [alphaXiv](https://www.alphaxiv.org/ru/abs/2311.06383) (unverified)

## 5. Any Russian datasets of IT task/test-assignment descriptions from employers (тестовые задания)?

### Takeaway
I found none. No Kaggle, HF or GitHub dataset of employer test assignments (тестовые задания) in Russian turned up. The closest proxies are vacancy "Tasks/Responsibilities" sections (`kirili4ik/yandex-jobs` Tasks field; `russian-oracle` "responsibilities" class) and Telegram IT posts.

### Cited Findings
- HF Hub searches for "тестовое", "test assignment", "take-home", "interview ru" and "собеседован" returned only unrelated English course or eval artifacts, with no Russian employer test-assignment corpus. — [HF datasets search](https://huggingface.co/datasets?search=take-home)
- `kirili4ik/yandex-jobs` has a structured `Tasks` field ("• раз…") alongside `Requirements` for 600+ Yandex IT vacancies. — [Kaggle](https://www.kaggle.com/datasets/kirili4ik/yandex-jobs)
- `russian-oracle/vacancy-section-classifier-ru` labels hh.ru vacancy chunks as "responsibilities", which can serve to extract task-like text at scale (18,145 labelled chunks). — [HF](https://huggingface.co/datasets/russian-oracle/vacancy-section-classifier-ru)

### Inferences
- Test-assignment data would have to be collected: public GitHub repos named "тестовое задание", Habr articles, Telegram channels. Alternatively it can be generated synthetically from vacancy responsibilities and stack.

### Gaps
- I did not systematically scan GitHub for repos titled "тестовое задание", which number in the thousands but are not a curated dataset. Its viability as a corpus, along with licensing, is unassessed.
