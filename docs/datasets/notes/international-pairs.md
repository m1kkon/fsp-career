# Real candidate <-> vacancy datasets with real interactions (international + Russian open data), IT priority

Scope checked on 2026-10-08: Hugging Face API, the Kaggle CLI, GitHub, Zenodo/Dataverse/Mendeley, arXiv/ACL, and the trudvsem.ru open-data portal. "Both sides" means candidate text AND vacancy text. "Real interaction" means a logged platform event (application, invitation, rejection, award, hire), not an annotation or LLM label. I measured IT share on samples I downloaded (all under 200 MB, or partial streams of larger files). Personal data is never reproduced; examples are paraphrased.

Compared with our fields. Candidate: specialization, grade, stack, years, about, work history, education, soft skills, format, city, salary. Vacancy: title, stack, description, team, responsibilities, requirements, nice-to-have, experience, format, city, salary.

## Q0. Shortlist: which real datasets actually have both sides + real interactions, and are obtainable in 2026?

### Takeaway
Only five sources pass all three tests (real data, text on both sides, logged interactions) and can be downloaded today:
1. **Zhaopin/Tianchi 2019**, through a GitHub mirror. Chinese; about 3–5% IT.
2. **CareerBuilder 2012**, through a Kaggle competition or a Kaggle mirror. English (US); about 10% IT jobs, 2–4% IT users. Candidate text is thin.
3. **"Работа России" (trudvsem.ru) open data**: CVs, vacancies, candidate responses and employer invitations/rejections, updated daily. Its curated Kaggle derivative is the "hse-hackathon" set. Russian; about 3% IT.
4. **WUZZUF 2014–2016** (Egypt). About 26–32% IT jobs, but there is no candidate text, so it does not fully pass.
5. **Freelancer.com (Hungarian Dataverse)**. Project–applicant–winner rows, but no raw text, and access is by request.

No source combines high IT share, rich text on both sides and outcome labels. The IT-focused corpus (Djinni) has no interactions. The interaction-rich corpora are mostly non-IT.

### Cited Findings
- Zhaopin/Tianchi 2019 (智联招聘人岗智能匹配): the original training files survive in the public GitHub repo `tenchat/4c` at `dataset/train_data/`:
  - `table1_user.csv` (2.6 MB, 4,500 users)
  - `table2_jd_part1..3.csv` (about 286 MB in total)
  - `table3_action.csv` (50 MB, 700,938 user×job rows)
  - round-1 test exposure files

  I downloaded and parsed these files myself. — [GitHub tenchat/4c](https://github.com/tenchat/4c/tree/main/dataset/train_data)
- trudvsem.ru publishes, as open data, "Отклики соискателей" (candidate responses) and "Приглашения работодателей" (employer invitations), alongside full CV and vacancy datasets. All are updated daily. The latest response dump is 1.33 GB and the latest invitation dump is 4.77 GB (both dated 2026-10-08). — [trudvsem open data index](https://opendata.trudvsem.ru/); [response set meta](https://opendata.trudvsem.ru/7710538364-response); [invitation set meta](https://opendata.trudvsem.ru/7710538364-invitation)
- CareerBuilder files are mirrored on Kaggle as `jsrshivam/job-recommendation-case-study`: users.tsv, user_history.tsv, apps.tsv, and jobs.tsv (3.4 GB). — [Kaggle mirror](https://www.kaggle.com/datasets/jsrshivam/job-recommendation-case-study)

### Inferences
- For our use (Russian production, multilingual encoder, IT focus), the most practical real-interaction training source is trudvsem.ru. It is Russian, has both sides with structured text, and has employer invitation/rejection signals that mirror our "employer invites" flow. Filter it to the "Информационные технологии, телекоммуникации, связь" sphere. IT is about 3% of rows, but the dump is large, so the absolute count of IT pairs may still be tens of thousands. This is an estimate, not a measurement.
- CareerBuilder plus Zhaopin can serve as foreign pretraining or eval pairs. Djinni can be used for unsupervised or contrastive pretraining on IT text, but not for learning interaction labels.

### Gaps
- I did not count the absolute number of IT rows in the full trudvsem response/invitation dumps (1.3–4.8 GB XML, above the download budget).

## Q1. Djinni Recruitment Dataset (lang-uk): is there any interaction data, released or obtainable?

### Takeaway
No. The released corpus is explicitly unlabeled: no applications, contacts or hires. The lang-uk Hugging Face org has published no follow-up release with interactions as of October 2026. The only Djinni-derived extra signal is a third-party scrape with per-vacancy aggregate "Views/Applications" counts, which has no candidate linkage.

### Cited Findings
- Hugging Face org `lang-uk` lists only the four recruitment sets (last modified 2024-06-02); there is no interactions set. — [HF API lang-uk](https://huggingface.co/api/datasets?author=lang-uk)
- Sizes and fields (from the HF datasets-server):
  - candidate-profiles-english: 210,250 rows
  - candidate-profiles-ukrainian: 24,230 rows
  - Candidate fields: Position, Moreinfo, Looking For, Highlights, Primary Keyword, English Level, Experience Years, CV
  - job-descriptions-english: 141,897 rows
  - job-descriptions-ukrainian: 27,461 rows
  - Job fields: Position, Long Description, Company Name, Exp Years, Primary Keyword, English Level, Published

  — [HF lang-uk candidate profiles EN](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english); [HF lang-uk job descriptions EN](https://huggingface.co/datasets/lang-uk/recruitment-dataset-job-descriptions-english)
- The paper lists "Unlabelled data: the lack of labeled data makes it challenging to determine who was hired" as a limitation. Data covers 2020–2023. Raw counts were 294,678 CVs and 443,458 jobs before filtering. Licensed MIT. Future work is mentioned only as "expand languages and industries". — [ACL Anthology UNLP 2024](https://aclanthology.org/2024.unlp-1.2.pdf)
- A third-party scrape `IvanLukianets/Job-Description-Dataset-Djinni` has 8,270 Djinni vacancies with Category, Skills_Tags, Experience_Months, Work_Format, Location, Domain, Company_Type, plus **aggregate** `Views` and `Applications` counts. License is "unknown" and there is no candidate side. — [HF IvanLukianets Djinni](https://huggingface.co/datasets/IvanLukianets/Job-Description-Dataset-Djinni)
- The `Stereotypes-in-LLMs/hiring-*` sets on Hugging Face pair Djinni profiles with LLM decisions (already rejected). — [HF search hiring](https://huggingface.co/api/datasets?search=hiring)

### Inferences
- Djinni gives the best domain match to our fields: specialization via Primary Keyword, years, English level, a free-text CV/"Looking For"/"Highlights" close to our "about", and vacancy long descriptions. It can only supply weak pairs, for example a heuristic positive when Primary Keyword and experience match. Those are not interactions.
- Obtaining interactions would require a direct request to Djinni or the authors. The paper invites contact only about deletion requests, not data access.

### Gaps
- I found no public statement from Djinni about releasing contact or application logs ("hiring signals"). I did not contact the authors.

## Q2. CareerBuilder Kaggle "Job Recommendation Challenge" (2012)

### Takeaway
Real US job-board data from CareerBuilder:
- 389,708 users
- 1,603,111 applications (321,235 users × 365,668 jobs)
- about 1.1M job postings with full Description/Requirements text

The candidate side has no free text, only degree, major, years of experience, a list of past job titles and location. IT share is low: about 10% of jobs by a broad title regex, and about 2–4% of users. The official competition files return 403 until the competition rules are accepted. A full mirror on Kaggle is downloadable.

### Cited Findings
- Competition file list via the CLI: apps.tsv 75 MB, users.tsv 35 MB, user_history.tsv 72 MB, jobs.zip 703 MB, splitjobs.zip, popular_jobs.csv, window_dates.tsv. Downloading returned HTTP 403 for this account (rules not accepted). I did not accept the rules, because that requires the user's consent. — [Kaggle competition job-recommendation](https://www.kaggle.com/competitions/job-recommendation/data)
- Mirror `jsrshivam/job-recommendation-case-study` contains the same files (jobs.tsv 3,403,585,644 bytes uncompressed). It has no license metadata. I downloaded users, history and apps, and stream-sampled the first 132 MB of jobs.tsv. — [Kaggle mirror](https://www.kaggle.com/datasets/jsrshivam/job-recommendation-case-study)
- Measured schema:
  - users.tsv: UserID, WindowID, Split, City, State, Country, ZipCode, DegreeType, Major, GraduationDate, WorkHistoryCount, TotalYearsExperience, CurrentlyEmployed, ManagedOthers, ManagedHowMany (389,708 rows)
  - user_history.tsv: UserID, WindowID, Split, Sequence, JobTitle (1,753,901 rows)
  - apps.tsv: UserID, WindowID, Split, ApplicationDate, JobID (1,603,111 rows)
  - jobs.tsv: JobID, WindowID, Title, Description, Requirements, City, State, Country, Zip5, StartDate, EndDate

  — [Kaggle mirror](https://www.kaggle.com/datasets/jsrshivam/job-recommendation-case-study)
- IT share (my measurement):
  - Jobs: 11.7% of a 43,004-job sample match a broad IT title regex (software/developer/programmer/web/database/network/QA/IT/data/BA…). This includes some "data entry" and "business analyst" titles, so the true share is probably about 8–11%.
  - Users: 4.4% have an IT-ish Major; 2.0% of work-history titles are IT-ish.

  — [Kaggle mirror](https://www.kaggle.com/datasets/jsrshivam/job-recommendation-case-study)
- RecBole-PJF uses this data as its "kaggle" person–job-fit dataset. — [RecBole-PJF](https://github.com/RUCAIBox/RecBole-PJF)
- Interaction type: application (implicit positive). There are no negatives or outcomes; negatives must be sampled.
- Mapping to our fields:
  - Candidate: specialization only through history job titles or Major; years = TotalYearsExperience; education = DegreeType + Major; city/state; work history = titles only (no descriptions); no about, stack, salary or format.
  - Vacancy: title, description, requirements, city. Stack and salary must be extracted from text.
- Example (paraphrased): a user with a Master's degree, 8 years of experience, 10 prior positions and currently employed applies in window 1 to a posting titled "Software Engineer" whose description lists Java/.NET duties.

### Inferences
- Useful only as a large English application log with rich vacancy text and weak candidate features. Candidate-side text would have to be the concatenated history titles.
- License risk: the competition rules govern use, and the mirror's redistribution status is unclear. Treat it as research or prototyping data, not as production training data.

### Gaps
- I could not open the competition Rules text (Kaggle pages are JS-rendered), so the exact permitted-use terms are unverified.
- The total job count was not measured (3.4 GB file). The roughly 1.1M figure is an estimate from file size and is unverified.

## Q3. Zhaopin/Tianchi 2019 person–job fit, and other Chinese competition datasets

### Takeaway
The Tianchi 2019 Zhaopin data is still obtainable from a public GitHub mirror, `tenchat/4c`. It has:
- 4,500 users
- 700,938 user×job rows with browsed, delivered (applied) and satisfied (employer positive) flags
- about 265k jobs with full Chinese descriptions

IT share is about 3–5%. The candidate side is structured, with experience given as keywords rather than prose.

Two other Chinese competitions with both sides and labels were found:
- **SODIC 2021 "人岗精准匹配"** (Shenzhen public employment data, resume-screening pass label). Its competition page now returns 404, and I found no data mirror.
- **iFLYTEK 2023 "人岗匹配挑战赛"**. Data is on GitHub, but the text is encoded as integer token IDs and the job side is only a job ID.

PJB (2026) uses LLM labels and is not downloadable, so it is rejected.

### Cited Findings
- ConFit (2024) calls the 2019 Alibaba job–resume matching competition (tianchi.aliyun.com/competition/entrance/231728) "the only publicly available person-job fit dataset". In its processed form it has 19,542 jobs, 2,718 resumes and 22,124 labels (10,185 accept / 11,939 reject). It is in Chinese, with 20 industries. — [ConFit arXiv 2401.16349](https://arxiv.org/pdf/2401.16349)
- RecBole-PJF points to the Tianchi dataset page `dataDetail?dataId=31623` and ships a `prepare_zhilian.py` script. — [RecBole-PJF](https://github.com/RUCAIBox/RecBole-PJF)
- Mirror contents (my parse):
  - Users: user_id, live_city_id, desire_jd_city_id, desire_jd_industry_id, desire_jd_type_id, desire_jd_salary_id, cur_industry_id, cur_jd_type, cur_salary_id, cur_degree_id, birthday, start_work_date, experience (pipe-separated keywords).
  - Jobs: jd_no, jd_title, company_name, city, jd_sub_type, require_nums, max_salary, min_salary, start_date, end_date, is_travel, min_years, key, min_edu_level, max_edu_level, is_mangerial, resume_language_required, job_description (full text).
  - Actions: 700,938 rows, 4,500 users, 265,825 distinct jobs. Browsed 21.5%, delivered 9.5% (66,285 applications), satisfied 4.5% (31,889 employer-positive).

  — [GitHub tenchat/4c](https://github.com/tenchat/4c/tree/main/dataset/train_data)
- IT share (mine): 4.8% of users want an IT-type job (by desire_jd_type_id keywords). 3.0% of a 7,527-job sample have IT jd_sub_type. Top categories are construction, finance/audit, admin and education. — [GitHub tenchat/4c](https://github.com/tenchat/4c/tree/main/dataset/train_data)
- ConFit v3 (2026) still uses AliYun as its only public dataset. Its own 49k-resume "Recruiting Dataset" is proprietary; only dummy files are released. — [ConFit v3 arXiv 2605.09760](https://arxiv.org/html/2605.09760v1)
- SODIC 2021 全球开放数据应用创新大赛 "人岗精准匹配模型" ("given user and applied-job features, predict whether the resume passes"):
  - Tables (from a participant notebook): person (gender, work years, highest education, major, age, last position, last industry, current location), person_cv (SELF_COMMENT free text, location), person_job_hist (position, industry, ACHIEVEMENT free text), person_project, recruit (JOB_TITLE, major, lower education, location, WORK_YEARS_RANGE, DETAIL text), recruit_folder (PERSON_ID, RECRUIT_ID, LABEL).
  - Locations are Shenzhen districts.
  - The competition URL sodic.com.cn/competitions/900008 now returns 404.

  — [GitHub Actor12/sodic-resumematch](https://github.com/Actor12/sodic-resumematch); [competition URL (404)](https://www.sodic.com.cn/competitions/900008)
- iFLYTEK 2023 人岗匹配挑战赛: the repo holds labeled_train.csv and raw.csv. Columns are job ID, work-experience count, job titles, company names, majors, schools, projects, skills count, honors count and desired position, all as integer token sequences. The target is the 岗位ID (job id). — [GitHub Dang1ing/Xunfei_Personnel-matching2023](https://github.com/Dang1ing/Xunfei_Personnel-matching2023)
- PJB (2026): about 300 Chinese JD queries and 197,674 resumes from a company's search logs. Labels come from an LLM-as-judge pipeline (doubao-1.5 + kimi-2.5) with about 20% manual spot-checks. It is "offline evaluation and internal research only", with no download link. — [PJB arXiv 2603.17386](https://arxiv.org/html/2603.17386)

### Inferences
- The Zhaopin mirror is the richest real two-sided interaction log available. It even has a two-stage funnel (apply → employer satisfied), which resembles "invite → accept". However, the IT share is small (about 3–5%) and the candidate side lacks prose. Its legal status is doubtful: Tianchi competition data republished in a third-party MIT-licensed repo.
- SODIC would be a good fit (prose on both sides plus a screening label), but it appears unavailable. The iFLYTEK data is unusable for a text encoder.

### Gaps
- I could not confirm whether Tianchi still serves dataId=31623 (JS-only page, no API response). The claim that it was withdrawn in 2023 is unverified here.
- No GitHub mirror of the SODIC 2021 files was found. GitHub code search hit the rate limit before `recruit_folder.csv` could be searched.
- I did not search DataFountain/CCF BDCI or BOSS Zhipin releases in depth, and found no public BOSS Zhipin release. My unverified recollection is that BOSS Zhipin-based papers (e.g. SHPJF/DPGNN) used private data.

## Q4. XING RecSys Challenge 2016/2017: is there a legal mirror?

### Takeaway
I found no legal public mirror. The data went only to registered challenge participants. Neither the ACM challenge pages nor the challenge paper repository expose the data.

### Cited Findings
- RecSys 2016 task: predict which XING job postings a user will click. Uses "anonymized user profiles, job postings, and interactions". 366 registered teams. The paper PDF is restricted on SZTAKI. — [SZTAKI eprint 8867](https://eprints.sztaki.hu/8867/); [RecSys 2016 challenge](https://recsys.acm.org/recsys16/challenge/)
- RecSys 2017: cold-start push recommendation of new XING postings. The details were on 2017.recsyschallenge.com, not on the ACM page. — [RecSys 2017 challenge](https://recsys.acm.org/recsys17/challenge/)

### Inferences
- Even if obtained, it would not suit a text encoder. From my recollection of the challenge descriptions, which I did not re-verify here, titles, tags and job roles were released as numeric token IDs rather than raw text.

### Gaps
- I could not access the 2016/2017 challenge sites or the papers' data-availability statements, so the exact terms and the token-ID detail remain unverified.

## Q5. Freelance platforms (Freelancer.com, Upwork, Guru, PeoplePerHour, Fiverr): profiles + projects + bids/awards

### Takeaway
There is real Freelancer.com project–applicant–winner data, but none of it is fully usable:
- The **Hungarian Dataverse** set (2026; 6,776 projects, 113,309 applications, 27,495 applicants, winner flag) **excludes raw texts** because of GDPR and is restricted on request.
- **HF `andrewatef/FreelancerBid001`** has real project descriptions plus the first bid's cover-letter text (5,000 projects), but no outcome and no profile.
- **Mendeley z8z4w5m528** (2019, CC BY 4.0) is about 1k completed-job histories.
- The large 2010 Freelancer message corpus (2.03M messages, 56k projects) was obtained privately.

Software/web work is a major category on these platforms, but no Upwork or Freelancer dataset with profile text, project text and award labels is publicly downloadable.

### Cited Findings
- Hungarian Dataverse, "Replication Data … online impression management" (Ilyés, O'Szabo, Császár et al.):
  - Coverage: Freelancer.com, English-language fixed/hourly projects, collected May–September 2021. Final sample 6,776 projects, 113,309 applications, 27,495 unique applicants, top-20 bidders per project.
  - Variables: winner (0/1), bid_in_euro, bid_fulfill_days, project_req (comma-separated skills), employer budget, rating and location; freelancer ratings, earnings, hourly rate, country, education/experience/certification counts, top skills; and skill-domain counts per project (Software Development, Web Development, Mobile App Development, Blockchain, Data Analytics, etc.).
  - It states "The original text data are not part of the dataset due to GDPR constraints". Only derived text features are included (sentiment, readability, politeness, …).
  - data_full.csv (102 MB) is restricted. Research and non-commercial use only; access on request (ilyes.virag@krtk.elte.hu).

  — [Dataverse hdl:21.15109/ARP/0XAKYA](https://repo.researchdata.hu/dataverse/freelancer-labour) (codebook and documentation downloaded via the [Dataverse API](https://repo.researchdata.hu/api/datasets/:persistentId/?persistentId=hdl:21.15109/ARP/0XAKYA))
- HF `andrewatef/FreelancerBid001`: 5,000 rows with Project ID, Title, SEO URL, Description, First Bid Description, First Bid Score. The score has no documented meaning and there is no license. Sample projects are mixed: FEA simulation, a Unity 2D game, voice recording. — [HF FreelancerBid001](https://huggingface.co/datasets/andrewatef/FreelancerBid001)
- Mendeley "Freelancer's Work History and Client's Review Data set" (CUET, 2019, CC BY 4.0), an 81 KB xlsx with three sheets:
  - 998 client reviews
  - about 1,005 work-history rows (freelancer username, job title, description, Skills_Required, rate, rating, completed, feedback, marketplace)
  - about 996 posted jobs

  Software and web skills (PHP, MySQL, HTML, ASP.NET, JavaScript) dominate the sampled rows. — [Mendeley z8z4w5m528](https://data.mendeley.com/datasets/z8z4w5m528)
- Hsieh et al. (CHI'22) used 2,031,068 messages from 56,222 projects (January–March 2010), including project descriptions, bid text and award dates. The data was "obtained from a corporate partner", so it is not public. — [arXiv 2204.04339](https://arxiv.org/pdf/2204.04339)
- Kaggle `asaniczka/freelance-contracts-dataset-1-3-million-entries` (ODC-By) has 1.3M contracts with job ID, title, dates, freelancer ID, hours, amount and rate. Freelancer and job text are minimal. — [Kaggle](https://www.kaggle.com/datasets/asaniczka/freelance-contracts-dataset-1-3-million-entries)
- An HSE study of a Russian-language freelance exchange (contests 2009–2018; 6,169 contests, 335,613 entries, 45,174 participants) used scraped "open data". It published no dataset link and does not name the platform. — [Ekonomicheskaya Sotsiologiya, HSE](https://ecsoc.hse.ru/article/view/10374)
- Kaggle Upwork sets (`asaniczka/upwork-job-postings-dataset-2024-50k-records`, `all-jobs-on-upwork-200k-plus`, `ahmedmyalo/upwork-freelance-jobs-60k`) and `kirilspiridonov/freelancers-offers-on-fiverr` each cover one side only. — [Kaggle search results via CLI](https://www.kaggle.com/datasets?search=upwork)
- The TIB "Upwork Labor Market Platform" entry (Yiu, Seamans, Raj, Liu 2025, DOI 10.57702/4lnha7wg) appears in search snippets as covering postings, profiles and hiring outcomes. The page was behind an anti-bot wall and I could not verify that the data is downloadable. — [TIB LDM entry](https://service.tib.eu/ldmservice/dataset/upwork-labor-market-platform)

### Inferences
- The Hungarian set is the only rigorous real award-outcome dataset, but without text it can train only a structured-feature reranker (skills overlap, bid, rating), not the text encoder.
- FreelancerBid001 gives real project→proposal pairs (a bid is a real application). These could serve as weak positives for "task text ↔ self-description text", but the cover letters are noisy and sometimes signed with names.

### Gaps
- The share of IT projects in the Hungarian set could not be computed (restricted file).
- The DOI 10.57702/4lnha7wg content is unverified.

## Q6. Other real recruitment datasets with outcomes (2015–2026): Russian open data, job boards, papers

### Takeaway
The strongest new lead is Russia's federal job portal **"Работа России" (trudvsem.ru) open data**. Since February 2021 it has published daily dumps of:
- candidate **responses** (with employer decision, e.g. "Отказ")
- **employer invitations** of CVs to vacancies

Both are linked by idCv and idVacancy to the full **CV** and **vacancy** open datasets. A ready-joined Kaggle extract, `darysha/hse-hackathon` (about 1 GB, 91 columns, label "Приглашение"/"Отказ"), exists. IT is only about 3% of rows.

Other confirmed real sources cover one side or lack candidate text:
- WUZZUF (Egypt): 21,850 jobs with text, plus applications, no candidate profiles. IT about 26–32%.
- HrFlow.ai × ENS Challenge Data (2026): job texts plus view/apply sessions, no profiles.
- kandij (US hourly jobs): candidate experience plus job views.

IntelliPro, Eightfold, ConFit v3, Jobindex, Saramin and Kariyer.net data is private.

### Cited Findings
- trudvsem open-data catalogue items:
  - 7710538364-invitation ("Приглашения работодателей"; invitations are created from employers' accounts)
  - 7710538364-response ("Отклики соискателей")
  - 7710538364-cv ("Резюме")
  - 7710538364-vacancy, plus regional splits
  - organizations, professions and industries reference sets

  Data versions date from 2021-02-10 to 2026-10-08. The meta states that contact and personal fields are blanked. — [opendata.trudvsem.ru](https://opendata.trudvsem.ru/); [invitation meta](https://opendata.trudvsem.ru/7710538364-invitation)
- Record schema (from the latest dumps):
  - Fields: id, idCompany, **idCv**, **idVacancy**, candidateId, creationDate, dateModify, candidate/manager status, isNew, **responseType** (sample values "Отклик", "Отказ"), regionCode, deleted.
  - The XSD also defines candidateStatus, employerStatus, recruitmentDate and employment.
  - Latest dump sizes: responses 1,330,937,651 bytes; invitations 4,766,346,538 bytes.

  — [response XSD](https://opendata.trudvsem.ru/7710538364-response/structure-20161130T143000.xsd); [latest response dump](https://opendata.trudvsem.ru/7710538364-response/data-20261008T100844-structure-20161130T143000.xml)
- Kaggle `darysha/hse-hackathon`: "Authentic Russian job market data: resumes and vacancies for matching". It covers job applicants (resumes) and vacancies with response status "Invitation" or "Rejection". It is one train.csv of 1,020,325,717 bytes, pipe-separated, with no license metadata. — [Kaggle hse-hackathon](https://www.kaggle.com/datasets/darysha/hse-hackathon)
  - My 6.3 MB stream sample (895 rows) contained 91 columns:
    - CV side: positionName, skills_cv, hardSkills_cv, softSkills_cv, workExperienceList (JSON with jobTitle, companyName, dates, "demands" duty text), educationList, experience (years), salary_cv, scheduleType_cv, relocation, businessTrip, languageKnowledge_cv, localityName.
    - Vacancy side: vacancyName, professionalSphereName, positionRequirements, responsibilities, additionalRequirements, hardSkills/softSkills_vacancy, experienceRequirements, educationRequirements, scheduleType_vacancy, busyType, salaryMin/Max_vacancy, regionName, company, companyBusinessSize, conditions, benefits.
    - Label distribution: 731 Отказ / 164 Приглашение (82/18).
    - Dates run 2022–2025.
    - IT ("Информационные технологии, телекоммуникации, связь") is 30/895 = 3.4%. Top spheres are manufacturing, healthcare and education.

    The field names (codeProfessionalSphere, isQuoted, idPriorityCategory, isMobilityProgram …) match the trudvsem vacancy schema. — [Kaggle hse-hackathon](https://www.kaggle.com/datasets/darysha/hse-hackathon)
- WUZZUF (Kaggle, CC BY-NC-SA 4.0):
  - Wuzzuf_Job_Posts_Sample: 21,850 jobs from 2014–2016, mainly in Egypt. Fields: job_title, job_category1-3, job_industry1-3, salary min/max, career_level, experience_years, job_description, job_requirements, city.
  - Wuzzuf_Applications_Sample (103 MB): id, user_id, job_id, app_date. No candidate attributes.
  - IT/Software Development is the top primary category: 5,762 of 21,850 jobs (26.4%), or 32.2% when any of the three categories is counted.

  — [Kaggle WUZZUF](https://www.kaggle.com/datasets/WUZZUF/wuzzuf-job-posts)
- HrFlow.ai challenge on ENS Challenge Data (#164, started 2026-01-13): about 22,000 job listings with text and 18,000 browsing sessions (10,000 profiles) recording view and apply sequences. "No personal profile data (education, skills)" is included. Registration is required. — [Challenge Data 164](https://challengedata.ens.fr/challenges/164)
- Kaggle `kandij/job-recommendation-datasets` (license unknown), US 2013–2015, mostly hourly and service jobs:
  - Combined_Jobs_Final.csv (159 MB; title, position, company, industry, Job.Description, Requirements, salary, employment type)
  - Experience.csv (8,653 rows: applicant position, employer, dates, sparse descriptions)
  - Positions_Of_Interest.csv (6,560)
  - Job_Views.csv (12,370 views by 3,448 applicants over 7,047 jobs)
  - job_data.csv

  — [Kaggle kandij](https://www.kaggle.com/datasets/kandij/job-recommendation-datasets)
- IntelliPro (ConFit) has 6,435 resumes, 1,794 jobs and 6,751 interview accept/reject labels in English and Chinese. It is private, with a "contact us" note in the repo. — [ConFit arXiv 2401.16349](https://arxiv.org/pdf/2401.16349); [GitHub jasonyux/ConFit](https://github.com/jasonyux/ConFit)
- Eightfold.ai bias-audit pairs: about 10k masked resume + JD pairs (2023–2024) labelled "successful" (on-site interview, offer or hire). Proprietary. — [arXiv 2507.02087](https://arxiv.org/html/2507.02087)
- The Adecco candidate-screening fairness project uses the outputs of an AI recommender (scores, top-10), not human decisions. — [fair-candidate-screening-system docs](https://fair-candidate-screening-system.readthedocs.io/en/main/dataset_usecase.html)
- Hacker News "Who is hiring" sets on HF (`dansbecker/hackernews_hiring_posts`, `brusic/hacker-news-who-is-hiring-posts`) contain postings only. I found no dataset linking "Who wants to be hired" posts to postings or hires. — [HF search hiring](https://huggingface.co/api/datasets?search=hiring)
- Kariyer.net, Saramin and Jobindex: no public resume + application datasets found. Most person–job papers do not share data, for privacy reasons. — [search summary incl. KARRIEREWEGE arXiv 2412.14612](https://arxiv.org/pdf/2412.14612)

### Inferences
- trudvsem is the only large, legally published (government open data), regularly updated source with both sides plus employer decisions. For IT, filter vacancies by professionalSphere/codeProfession, and CVs by positionName or skills. The invitation stream (employer → CV) is semantically closest to our reverse-recruiting "employer invites anonymous profile".
- WUZZUF is the most IT-heavy real application log, but it gives only job-side text. It could train job-to-job co-application signals, or a "user = bag of applied jobs" model.

### Gaps
- The trudvsem dumps state no license in their meta files. The open-data license terms (typically "Открытая лицензия"/CC-BY for Russian government open data) were not verified.
- The full set of responseType values and the fraction carrying recruitmentDate (hire) were not measured. The files are too large to stream fully within budget.
- The HSE hackathon's organizer and its exact join logic were not found by search. That it derives from trudvsem is my inference from the field names.
- The "Human, Algorithm, or Both?" recruiting-fairness paper (1.35M recruiter contacts) does not name its platform in the abstract and shows no data release. — [arXiv 2603.06240](https://arxiv.org/abs/2603.06240)

## Q7. Kaggle/HF datasets claiming real hiring decisions on real resumes: provenance check and rejected list

### Takeaway
Every "resume screening / hiring decision / candidate selected" dataset I checked is synthetic, scored by formula or LLM, or both. None qualifies.

Rejected list (short):
- **mindweave/job-postings-applications** and its copy Arivalagan2025/job-postings-applications: card says "Job Postings & Applications (Synthetic)", generated by Mindweave. — [HF](https://huggingface.co/datasets/mindweave/job-postings-applications)
- **nonameee12233/job-resume-matching**: 122,560 "compatibility records with ranking labels and scoring components", i.e. computed scores, not interactions. — [HF](https://huggingface.co/datasets/nonameee12233/job-resume-matching)
- **PJB (2026)**: LLM-as-judge labels; not downloadable. — [arXiv 2603.17386](https://arxiv.org/html/2603.17386)
- **TalentCLEF 2026 Task A** (re-confirmed): resumes and jobs "synthetically generated from structured data"; labels from human experts; Spanish version LLM-translated. — [TalentCLEF 2026 corpus](https://talentclef.github.io/talentclef/docs/talentclef-2026/data/description_corpus/)
- **kylehffu/upwork-proposal-benchmarks-2026**: 52 marketing "proposal hooks"; annotations "machine-generated". — [HF](https://huggingface.co/datasets/kylehffu/upwork-proposal-benchmarks-2026)
- **yangjiu/enterprise-recruitment-prediction-dataset**: about 3k rows of numeric scores (skill_score, interview_score, is_hired). No resume or job text, unclear provenance. — [Kaggle](https://www.kaggle.com/datasets/yangjiu/enterprise-recruitment-prediction-dataset)
- **Stereotypes-in-LLMs/hiring-*** (already rejected): LLM decisions. — [HF](https://huggingface.co/api/datasets?search=hiring)
- **Adecco fairness dataset**: labels are AI-system scores. — [docs](https://fair-candidate-screening-system.readthedocs.io/en/main/dataset_usecase.html)
- **TipDM 2023 (泰迪杯) "泰迪内推平台"**: the winning solution computed match scores by cosine similarity; there are no real outcome labels. — [TipDM PDF](https://www.tipdm.org:443/u/cms/www/202309/011629005ler.pdf)
- **iFLYTEK 2023 人岗匹配**: real-looking, but the text is integer-encoded and the job side is an ID only (not synthetic, but unusable). — [GitHub](https://github.com/Dang1ing/Xunfei_Personnel-matching2023)

### Cited Findings
- The sources are the links in the list above.

### Inferences
- Kaggle titles such as "Resume Screening Dataset (200K)", "ATS Hiring Dataset (100k)" and "Predicting Hiring Decisions" match the synthetic pattern the user already rejected (round sizes, no source attribution). I did not open each one.

### Gaps
- The Kaggle CLI returned empty metadata for `rhythmghai/resume-screening-dataset-200k-candidates`, `mobeenfatimah/resume-screening-and-ats-hiring-dataset100k-record`, `surendra365/recruitement-dataset`, `jainishkumar/resume-job-description-matching-dataset` and `ayushtankha/70k-job-applicants-data-human-resource`. Their provenance is unverified, though presumed synthetic or unattributed.
