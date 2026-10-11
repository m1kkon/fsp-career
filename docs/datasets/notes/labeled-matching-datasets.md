# Labeled person–job fit / resume–JD matching datasets (IT emphasis) for "ФСП Карьера"

Scope note: verification was done 2026-10-08 via the Hugging Face Hub API, the HF datasets-server API (row counts, label distributions), the Kaggle public "view" API, Zenodo API, GitHub API and the papers' PDFs. Where I computed a number myself from the published data (e.g., unique pairs, share of Russian letters), it is marked "(computed from HF data)". Items I could not open or download are marked UNVERIFIED.

## 1. Djinni Recruitment Dataset: repos, size, fields, languages, license, paper, interaction signal

### Takeaway
Djinni is the closest public data to the ФСП Карьера mechanic (Ukrainian IT platform with anonymous candidate profiles), but it is two separate corpora: 234,480 CVs and 169,358 job descriptions, in English and Ukrainian, MIT licensed. It has no candidate↔job pairs, applications or hire labels, no salary field, and Russian text was filtered out on purpose. The paper is UNLP 2024 (LREC-COLING 2024), not UNLP 2025. The only labeled Djinni pairs are small LLM-labeled hire/reject sets made for bias research: 450 unique CV–JD pairs per language.

### Cited Findings
- **Exact HF repos and sizes (all MIT, published 2024-03-30, not gated):**
  - `lang-uk/recruitment-dataset-candidate-profiles-english`: 210,250 rows, download ≈237 MB — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english)
  - `lang-uk/recruitment-dataset-candidate-profiles-ukrainian`: 24,230 rows — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-ukrainian)
  - `lang-uk/recruitment-dataset-job-descriptions-english`: 141,897 rows, download ≈146 MB — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-job-descriptions-english)
  - `lang-uk/recruitment-dataset-job-descriptions-ukrainian`: 27,461 rows — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-job-descriptions-ukrainian)
- **Candidate profile fields:** `Position`, `Moreinfo`, `Looking For`, `Highlights`, `Primary Keyword`, `English Level`, `Experience Years` (float), `CV` (= Highlights + Moreinfo + Looking For, concatenated), `CV_lang`, `id` — [HF card](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english); [paper, Appendix A](https://aclanthology.org/2024.unlp-1.2)
- **Job description fields:** `Position`, `Long Description`, `Company Name`, `Exp Years`, `Primary Keyword`, `English Level`, `Published` (month and year only), `Long Description_lang`, `id` — [HF card](https://huggingface.co/datasets/lang-uk/recruitment-dataset-job-descriptions-english); [paper](https://aclanthology.org/2024.unlp-1.2)
- **No salary-expectation field** appears in either HF schema. The fields are the ones listed above — [HF card](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english)
- **Label-like columns (useful for spec/grade weak labels):**
  - Primary Keyword: 42 profile types in CVs and 46 in JDs. English Level has 7 CV values (`intermediate`, `pre`, `upper`, `basic`, `no_english`, `fluent`, NaN). Exp Years in JDs has 5 values (`no_exp`, `1y`, `2y`, `3y`, `5y`). Experience Years in CVs has 15 unique values — [paper](https://aclanthology.org/2024.unlp-1.2)
  - Primary Keyword counts, English CVs (computed from HF data): JavaScript 33,980; QA 25,089; Design 15,068; Project Manager 12,499; Java 11,463; .NET 9,388; Python 7,588; PHP 6,947; QA Automation 5,756; Node.js 4,896; DevOps 4,120; Data Science 2,571; Data Analyst 2,271; Data Engineer 803; Golang 1,343; plus non-IT roles such as HR, Recruiter, Sales and Marketing — [HF datasets-server stats](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english)
  - Experience Years, English CVs (computed from HF data): min 0, max 11, mean 3.84, median 3 — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english)
  - JD Exp Years (computed from HF data): 3y 49,996; 2y 36,150; 5y 27,772; 1y 22,007; no_exp 5,972 — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-job-descriptions-english)
- **Pipeline and counts:**
  - Raw data was 294,678 CVs and 443,458 jobs. After basic filtering (language filter, outliers, exact duplicates): 241,561 / 358,491. After near-duplicate filtering: 234,480 / 169,358 — [paper Table 1](https://aclanthology.org/2024.unlp-1.2)
  - Near-duplicate filtering used bge-base-en-v1.5 (cosine 0.9) for English and multilingual-e5-large (0.95) for Ukrainian. Texts below the 5th length percentile were dropped — [paper](https://aclanthology.org/2024.unlp-1.2)
  - Time span is 2020–2023. Djinni has more than 50,000 monthly users — [paper](https://aclanthology.org/2024.unlp-1.2); [GitHub](https://github.com/Stereotypes-in-LLMs/recruitment-dataset)
- **Languages and Russian:**
  - The authors used langdetect to select "exclusively English and Ukrainian" samples, so other languages, including Russian, were filtered out. Ukrainian is only about 10% of CVs and 16% of jobs — [paper §3.2](https://aclanthology.org/2024.unlp-1.2)
  - In the Ukrainian CV split (computed from HF data), 99.2% of CVs contain Ukrainian-only letters (і/ї/є/ґ). 3.8% contain any Russian-only letter (ы/э/ъ/ё). Only 0.11% have Russian-only letters and no Ukrainian-only letters. In effect there is no Russian content — [HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-ukrainian)
- **Anonymization:** Djinni requires anonymized profiles. The authors also removed CVs with residual PII (phones, emails, addresses, social links, tax IDs), which was under 0.2% of CVs — [paper](https://aclanthology.org/2024.unlp-1.2)
- **License:** the data is MIT (HF cards and the paper's conclusion). The GitHub code repo is Apache-2.0. The paper PDF itself is CC BY-NC 4.0 — [paper](https://aclanthology.org/2024.unlp-1.2); [GitHub](https://github.com/Stereotypes-in-LLMs/recruitment-dataset)
- **Paper:** Drushchak & Romanyshyn, "Introducing the Djinni Recruitment Dataset: A Corpus of Anonymized CVs and Job Postings", Proc. 3rd UNLP @ LREC-COLING 2024, Torino, pp. 8–13 — [ACL Anthology](https://aclanthology.org/2024.unlp-1.2)
- **Interaction or match signal:**
  - The paper and cards describe no applications, contacts or hires.
  - The GitHub repo builds its own recommender whose outputs are "JSON files with candidate IDs as keys and a list of matched job description IDs". These are model predictions, not ground truth — [GitHub](https://github.com/Stereotypes-in-LLMs/recruitment-dataset)
  - The paper's limitations: noisy user-generated data, tech-domain focus, Ukrainian market only — [paper §6](https://aclanthology.org/2024.unlp-1.2)
- **Derived LLM-labeled Djinni pairs (bias research):**
  - `Stereotypes-in-LLMs/hiring-analyses-{baseline, optimized_parameters, ignore_personal_info, zero_shot_cot, recruiter_guidelines, reasoning, second_model_verification}-{en,uk}` (2024-04).
  - Columns: candidate_id, job_id, CV, Job Description, Job Position, lang, protected_group, protected_attr, decision (hire/reject), feedback (LLM rationale), raw_ai_decision — [HF](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-analyses-baseline-en)
  - Size (computed from HF data): baseline-en has 24,750 rows but only 450 unique (candidate, job) pairs, 150 candidates and 171 jobs. The rows are repeats with injected protected attributes (gender, age, religion, military status, etc.).
  - Decisions: EN 12,814 hire / 11,936 reject. UK 3,818 hire / 20,932 reject.
  - Jobs are mostly IT (Data Scientist, Java, Android, Front-end, .NET, Manual QA, Full Stack, Golang, etc.) — [HF en](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-analyses-baseline-en); [HF uk](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-analyses-baseline-uk); [code, Apache-2.0](https://github.com/Stereotypes-in-LLMs/AIHiringBiasAnalysis-LLMs)
- **2026 follow-up sets:**
  - `hiring-bias-mitigation-synthetic-data` uses "real inputs, synthetic labels": real Djinni CVs and JDs, with decisions and rationales written by teacher model Qwen3.5-122B-A10B-GPTQ-Int4, in EN and UK — [HF](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-bias-mitigation-synthetic-data)
  - `hiring-bias-mitigation-responses` has 64 runs and 2,782,350 responses from 5 open-weight models — [HF](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-bias-mitigation-responses)
- **Third-party Djinni vacancies scrape:**
  - `IvanLukianets/Job-Description-Dataset-Djinni` has 8,270 vacancies (created 2026-07-25), license "unknown", mainly English.
  - Fields: Title, Description, Category, Skills_Tags, Experience_Text/Experience_Months, Employment_Type, Work_Format, Location, Domain, Company_Type, **Views**, **Applications** — [HF](https://huggingface.co/datasets/IvanLukianets/Job-Description-Dataset-Djinni)

### Inferences
- Djinni is the best public in-domain corpus for **pretraining or contrastive adaptation** of encoders on IT profiles and IT vacancies. Its weak labels map well to ФСП Карьера:
  - `Primary Keyword` maps to specialization. JavaScript/Node.js/Python/Java/.NET/PHP/Golang map to Backend or Frontend; DevOps, QA/QA Automation, Data Science/Data Engineer/Data Analyst map directly.
  - `Experience Years` and position titles ("Junior/Middle/Senior/Lead") give grade.
  - `Looking For` is close to "about/expectations".
- Positive pairs can be synthesized: a CV and a JD that share Primary Keyword and a compatible experience band count as a weak positive; a different keyword counts as a negative. This is distant supervision, not ground truth.
- The 450-pair hire/reject sets are too small and too attribute-perturbed to train a ranker. They could be a tiny evaluation or sanity check, or show how an LLM-as-judge behaves on IT pairs.
- Because Russian was filtered out, use Djinni through multilingual encoders (e.g., multilingual-e5, which the authors themselves used for Ukrainian dedup) or translate it to Russian.
- `Views`/`Applications` in the IvanLukianets scrape are per-vacancy popularity counts, not candidate-level interactions.

### Gaps
- No UNLP 2025 paper introducing or benchmarking Djinni for matching was found. The citable paper is UNLP 2024.
- The paper does not say how many raw records were dropped *only* for being Russian. The 294,678→241,561 CV drop mixes language and outlier filtering.
- I did not open the Djinni raw-data access terms on djinni.co or check whether a newer Djinni release with salary or contact events exists. None was found on HF or GitHub.
- The LLM used for the original 2024 `hiring-analyses` decisions was not confirmed from the cards (the GitHub README does not name it).

## 2. Hugging Face resume–JD "fit" datasets: size, labels, synthetic vs real, quality

### Takeaway
All popular HF "resume–JD fit" sets are small, of unclear provenance or LLM-labeled. None has documented real hiring or application outcomes. `cnamuangtoun/resume-job-description-fit` (8k pairs, 3-class) is the de-facto standard but has no card or license and only 642 unique resumes × 280 unique JDs in train. Its many derivatives, including a Russian LLM translation, inherit that. Treat them as auxiliary or noisy training data, not as a trustworthy evaluation of IT matching.

### Cited Findings
- **`cnamuangtoun/resume-job-description-fit`**
  - 8,000 pairs (train 6,241 / test 1,759); columns `resume_text`, `job_description_text`, `label` — [HF](https://huggingface.co/datasets/cnamuangtoun/resume-job-description-fit)
  - Train labels: No Fit 3,143 / Potential Fit 1,556 / Good Fit 1,542. Train has only 642 unique resumes and 280 unique JDs (from datasets-server statistics) — [HF](https://huggingface.co/datasets/cnamuangtoun/resume-job-description-fit)
  - No README (HF returns "Entry not found"), no license, no label methodology. About 1,004 downloads and 81 likes. Multi-domain samples (sales associate, accountant, electrical engineer, business analyst) — [HF](https://huggingface.co/datasets/cnamuangtoun/resume-job-description-fit)
- **`niktigerbill/resume-job-description-fit-ru`**: Russian version of the above "переведено при помощи LLM" (translated with an LLM). 8,000 pairs (6,241 / 1,759), labels No Fit / Potential Fit / Good Fit, declared CC-BY-4.0, created 2026-05-10 — [HF](https://huggingface.co/datasets/niktigerbill/resume-job-description-fit-ru)
- **`kens1ang/resume-job-fit-augmented`**: train 31,205 / test 1,759. Train labels Potential 7,780 / Good 7,710 / No 15,715. Same 642 resumes and 280 JDs as the original, so these are recombinations. No card or license — [HF](https://huggingface.co/datasets/kens1ang/resume-job-fit-augmented)
- **`med2425/resume-job-fit-merged-v1`**
  - 80,017 train / 13,716 test. Merges cnamuangtoun + kens1ang plus "smart cross-domain pairs", **labeled by Qwen2.5-32B (via Ollama, temperature 0)**.
  - Fields: resume, jd, label (Good/Potential/No Fit), source, resume_domain, jd_domain. Domains include software, data, ai. No license — [HF](https://huggingface.co/datasets/med2425/resume-job-fit-merged-v1)
- **`netsol/resume-score-details`**
  - 1,031 JSON samples "generated and assessed using GPT-4o": 648 matched, 201 mismatched, 142 invalid, 40 missing additional info.
  - JDs were generated by GPT-4o from sampled resumes, then resumes were scored against random JDs. Output: macro/micro criterion scores, requirement booleans, justification, aggregated scores. License "cc".
  - The example shows extracted personal info fields (name, email) — [HF](https://huggingface.co/datasets/netsol/resume-score-details)
- **`batuhanmtl/job_resume_fit`**: 2,385 resumes from the Kaggle snehaanbhawal Resume Dataset, matched to 23 job categories. Scores: ai_match_score, string-based skill match, fuzzy match. License "other" — [HF](https://huggingface.co/datasets/batuhanmtl/job_resume_fit)
- **`jminc/resume-matching-dataset-v2`**: 74,147 samples (69,047 / 100 / 5,000), **Korean**, "Fully synthetic (GPT-4o-mini generated)", scored by GPT-4o-mini. Total/resume/self-intro scores plus grade. **IT-only roles: AI/LLM Developer, Frontend Developer, Backend Developer**. No license field — [HF](https://huggingface.co/datasets/jminc/resume-matching-dataset-v2)
- **`nonameee12233/job-resume-matching`** (MIT, 2026-06)
  - 9,544 CVs, 1,167 jobs and 122,560 candidate–job "compatibility records".
  - Labels are **heuristic composite scores** (semantic, skill, position, category, experience, education) with `label_strength` weak/medium/strong_positive. `rahulrajpu676/job-resume-matching` carries an identical card — [HF](https://huggingface.co/datasets/nonameee12233/job-resume-matching); [HF dup](https://huggingface.co/datasets/rahulrajpu676/job-resume-matching)
- **`DjallelBr/job-matching-dataset`**: 7,635 / 1,909 rows with a `prompt` and an integer score (4–97). No card or provenance — [HF](https://huggingface.co/datasets/DjallelBr/job-matching-dataset)
- **`holistic-ai/job-fair-resume`**: 300 rows, MIT. Built for gender-bias benchmarking (JobFair), not fit training — [HF](https://huggingface.co/datasets/holistic-ai/job-fair-resume)
- **`mindweave/job-postings-applications`**: explicitly synthetic ATS tables, CC-BY-NC-4.0. 2,000 jobs, 9,000 candidates, 15,000 applications, 7,196 interviews, 938 offers — [HF](https://huggingface.co/datasets/mindweave/job-postings-applications)
- **Kaggle look-alikes, also synthetic:**
  - `surendra365/recruitement-dataset` was "compiled from synthetic and publicly available job application data", with resume, JD and matching label — [Kaggle](https://www.kaggle.com/datasets/surendra365/recruitement-dataset)
  - `rhythmghai/resume-screening-dataset-200k-candidates` has "200,000 synthetically generated candidate resumes" and a hired label — [Kaggle](https://www.kaggle.com/datasets/rhythmghai/resume-screening-dataset-200k-candidates)

### Inferences
- Quality ranking for our use:
  1. The cnamuangtoun family is real-ish text with unknown labels and is mostly non-IT.
  2. med2425 and netsol have LLM labels (Qwen2.5-32B / GPT-4o) and are useful only as distillation-style supervision.
  3. jminc is the only IT-specific set (frontend/backend/AI) but is fully synthetic and Korean.
  4. nonameee is heuristic scores, effectively circular for training a ranker.
- The Russian translation `niktigerbill/...-ru` is convenient for a quick Russian cross-encoder baseline. But labels with unknown provenance, plus test resumes/JDs heavily overlapping train (same small pools), will overstate performance. Split by unique resume and JD before evaluating.
- None of these is a substitute for a small hand-labeled Russian IT eval set built from ФСП Карьера-style needs and profiles.

### Gaps
- I could not find who created the original cnamuangtoun labels or how. There is no card, paper or license. Provenance of its resumes and JDs (likely Kaggle livecareer resumes plus LinkedIn postings, judging by text style) is an inference and UNVERIFIED.
- `AzharAli05/Resume-Screening-Dataset` (10,174 rows, MIT) and `hetbhagatji09/job-resume-triplets` (1,054 rows, CC-BY-SA-4.0) have no cards describing labels — [HF](https://huggingface.co/datasets/AzharAli05/Resume-Screening-Dataset); [HF](https://huggingface.co/datasets/hetbhagatji09/job-resume-triplets)

## 3. Classic and new person–job fit / job recommendation datasets: which are downloadable in 2026?

### Takeaway
Real-label person–job fit data is almost entirely proprietary.
- **Not available:** the two classic "public" ones (Tianchi/Zhaopin 2019 and Kaggle CareerBuilder 2012) are withdrawn or gated, and XING RecSys 2016/2017 data was never public.
- **Withdrawn or restricted:** ConFit v1/v2/v3 use a proprietary interview accept/reject dataset (Intellipro) plus the now-withdrawn AliYun data. The 2026 PJB benchmark (Chinese, LLM-judged) is restricted.
- **Openly downloadable in 2026:** TalentCLEF 2026 Task A (EN/ES, synthetic but expert-annotated, CC-BY-4.0, about 50 queries × ~475 resumes per language) and WorkRB's Malt freelancer–project matching (synthetic, 5 languages, Apache-2.0), plus TechWolf work-domain sets (ESCO-based, EN).

### Cited Findings
- **Survey of public datasets:** "few public datasets are available… only two public datasets: CareerBuilder 2012 dataset on Kaggle… and Zhilian dataset" (Tianchi dataId 31623). The RecSys 2016 and 2017 XING datasets "are not publicly available" — [Mashayekhi et al., A challenge-based survey of e-recruitment recommendation systems, arXiv 2209.05112](https://arxiv.org/abs/2209.05112)
- **Tianchi / Zhaopin (智联招聘人岗智能匹配, 2019, Chinese):**
  - The dataset page still exists (title verified) — [Tianchi dataset 31623](https://tianchi.aliyun.com/dataset/31623); [competition 231728](https://tianchi.aliyun.com/competition/entrance/231728)
  - ConFit v2 states "The AliYun dataset used in this work is no longer publicly available as of 09-11-2023" — [ConFit v2](https://arxiv.org/abs/2502.12361)
  - ConFit v2 training stats for AliYun: 19,542 jobs, 2,718 resumes, 22,124 labels (10,185 accept / 11,939 reject). Test: 300 ranking samples per direction — [ConFit v2, Tables A5–A6](https://arxiv.org/abs/2502.12361)
- **Intellipro "Recruiting dataset" (ConFit series):**
  - Labels record whether a candidate was accepted (y=1) or rejected (y=0) for an interview. EN and ZH.
  - Train: 9,469 jobs, 41,279 resumes, 48,096 labels (19,042 accept / 29,054 reject). Fewer than 0.05% of possible pairs are labeled — [ConFit v2](https://arxiv.org/abs/2502.12361)
  - ConFit v3 calls it "a proprietary dataset provided by a hiring solution company" — [ConFit v3, arXiv 2605.09760](https://arxiv.org/abs/2605.09760)
- **ConFit papers:**
  - ConFit (data augmentation + contrastive learning) — [arXiv 2401.16349](https://arxiv.org/abs/2401.16349)
  - ConFit v2 (hypothetical resume embedding + runner-up hard-negative mining) is ACL Findings 2025. It reports +13.8% recall and +17.5% nDCG on average versus prior methods — [ACL Anthology](https://aclanthology.org/2025.findings-acl.661/); [code](https://github.com/jasonyux/ConFit-v2)
  - ConFit v3 (May 2026) does LLM re-ranking with Qwen3-8B/32B on the same two datasets — [arXiv 2605.09760](https://arxiv.org/abs/2605.09760)
- **CareerBuilder 2012 (Kaggle "Job Recommendation Challenge"):**
  - The task was to predict which jobs users will apply to, using their previous applications, demographics and work history. $20,000 prizes; ended 7 Oct 2012 — [KDnuggets](https://www.kdnuggets.com/2012/08/kaggle-careerbuilder-job-recommendation-competition.html)
  - The competition page is live — [Kaggle](https://www.kaggle.com/c/job-recommendation). The data-listing API returned "401 Unauthenticated", so download needs a Kaggle login and acceptance of the rules. Download is UNVERIFIED.
- **XING RecSys Challenge 2016:** job recommendations from XING data with anonymized user profiles, job postings and interactions — [RecSys 2016 challenge](https://recsys.acm.org/recsys16/challenge/). Not public, per [survey](https://arxiv.org/abs/2209.05112).
- **PJB (Person-Job Benchmark), March 2026:**
  - Chinese. About 297 JD queries, 197,674 de-identified resumes, 2,242 positive judgments. Labels come from a two-stage LLM-as-judge (Doubao-1.5, Kimi-2.5) with about 20% manual spot-check.
  - 40% of queries are "Technical R&D". Stated CC BY 4.0, but "designated for offline evaluation and internal research only". No public download link was found — [arXiv 2603.17386](https://arxiv.org/abs/2603.17386)
- **TalentCLEF 2026 Task A "Contextualized Job-Person Matching" (EN, ES):**
  - Corpus is synthetic resumes and JDs, generated from real job–skill co-occurrence statistics and "manually annotated by expert annotators".
  - Dev: 10 queries × 472 resumes per language. Test: 40 queries × 476 resumes. Metric: MAP.
  - Best system MAP 0.7140 (EN 0.7122, ES 0.7157) — [Overview arXiv 2606.31692](https://arxiv.org/abs/2606.31692)
  - Data on Zenodo under CC-BY-4.0 (v0.3.0, TaskA.zip 3.75 MB, test set released) — [Zenodo](https://zenodo.org/records/19652670); [DOI](https://doi.org/10.5281/zenodo.17625261)
  - Task B (job title → skills, core vs contextual, graded relevance 2/1) — [overview](https://arxiv.org/abs/2606.31692)
  - TalentCLEF 2025 had 76 registered teams, 15 working notes and 280 runs — [Zenodo](https://zenodo.org/records/19652670); [2025 overview](https://arxiv.org/abs/2507.13275)
- **WorkRB (March/April 2026, Apache-2.0):**
  - 13 tasks in 7 groups (job/skill recommendation, candidate recommendation, normalization, extraction), up to 28 ESCO languages — [arXiv 2604.13055](https://arxiv.org/abs/2604.13055); [GitHub](https://github.com/techwolf-ai/WorkRB)
  - Its candidate-ranking task uses a **synthetic dataset provided by Malt**: 200 project briefs and 200 queries × 4,019 freelancer profiles with skill-matching fit scores, in en/de/es/fr/nl — [WorkRB task code](https://github.com/techwolf-ai/WorkRB/blob/main/src/workrb/tasks/ranking/freelancer_project_matching.py); [HF MaltDataTeam/Freelancer-Project-Matching, Apache-2.0](https://huggingface.co/datasets/MaltDataTeam/Freelancer-Project-Matching)
- **TechWolf open work-domain data (EN):**
  - `TechWolf/anonymous-working-histories`: 2,164 career paths across 24 industries, up to 17 experiences each, ESCO v1.1.1-tagged; 1,720/217/227 split; CC-BY-4.0. Paper: Decorte et al., RecSys in HR 2023 — [HF](https://huggingface.co/datasets/TechWolf/anonymous-working-histories)
  - `TechWolf/JobBERT-evaluation-dataset`: 15,463 + 15,463 vacancy titles tagged with ESCO occupations, from a Malaysian government job board; MIT. Paper: JobBERT, FEAST@ECML-PKDD 2021 — [HF](https://huggingface.co/datasets/TechWolf/JobBERT-evaluation-dataset); [arXiv 2109.09605](https://arxiv.org/abs/2109.09605)
  - `TechWolf/vacancy-job-to-skill`: 5,644 rows, Apache-2.0. Paper: "Unified Work Embeddings" — [HF](https://huggingface.co/datasets/TechWolf/vacancy-job-to-skill); [arXiv 2511.07969](https://arxiv.org/abs/2511.07969)
  - `TechWolf/SkillMatch-1K`: 2,000 rows, MIT — [HF](https://huggingface.co/datasets/TechWolf/SkillMatch-1K); [arXiv 2410.05006](https://arxiv.org/abs/2410.05006)
- **Career-trajectory data (real, not pairs):**
  - JobHop has 355,315 trajectories (v2) from pseudonymized VDAB (Flanders) resumes, ESCO-coded. Text is about 91% Dutch, 6% English, 2% French. CC-BY-4.0, IEEE BigData 2025 — [HF](https://huggingface.co/datasets/aida-ugent/JobHop); [arXiv 2505.07653](https://arxiv.org/abs/2505.07653)
  - `ElenaSenger/Karrierewege` (~2.0M train rows) — [HF](https://huggingface.co/datasets/ElenaSenger/Karrierewege)
- **LLM job-recommendation method papers without public data:**
  - JobRecoGPT (TCS Research, 2023) compares content-based, LLM-guided, LLM-unguided and hybrid recommenders — [arXiv 2309.11805](https://arxiv.org/abs/2309.11805)
  - JobRec (2026) separates candidate preference from employer qualification under "recruitment-funnel censoring" — [arXiv 2602.03097](https://arxiv.org/abs/2602.03097)

### Inferences
- For a **real-outcome training signal** there is effectively nothing public and current. The publicly documented real-label resources (AliYun/Zhaopin, CareerBuilder, XING) are withdrawn, gated or never released. The ConFit v2 statistics remain a useful reference for how sparse real labels are (<0.05% of pairs), which argues for hard-negative mining (RUM) and LLM-augmented queries (HyRe) in our ranker.
- **TalentCLEF 2026 Task A** is the best openly licensed, human-annotated candidate-ranking evaluation set (multi-industry, EN/ES). It can be machine-translated to Russian as a cross-lingual sanity benchmark for the bi-encoder or cross-encoder. Task B can help test skill inference from job titles.
- **WorkRB** gives a ready harness (Apache-2.0) to benchmark our encoders on candidate ranking and skill tasks. The Malt set is freelancer- and project-shaped, which is close to "employer describes a need in free text".
- ConFit v2's recipe transfers directly to our task (c), using real or proxy positives from ФСП Карьера invitations once logs exist.

### Gaps
- I could not confirm whether Tianchi still serves the files to logged-in users. The API was "access denied", and ConFit v2 says it was withdrawn.
- CareerBuilder 2012 download and current file sizes are UNVERIFIED (Kaggle auth required).
- No public hh.ru / HeadHunter, SuperJob or Habr Career dataset with application or invitation pairs was found. Searches for an hh.ru RecSys challenge dataset returned nothing.
- TalentCLEF 2026 Task A per-industry breakdown (share of IT) and test qrels availability were not checked inside the zip. The 2025 Task A specifics (multilingual job-title matching) were not re-verified beyond the overview link.

## 4. Resume and job-posting corpora with category, grade or skill labels (spec/grade classification)

### Takeaway
For task (b), profile → spec/grade:
- **Djinni CVs** (Primary Keyword + Experience Years) are by far the best in-domain source.
- **LinkedIn Job Postings 2023–2024** (Kaggle arshkon) adds `formatted_experience_level`, skills, salary and per-posting **views/applies**.
- **snehaanbhawal**'s 24-category resumes are small and mostly non-IT.

Ukrainian Work.ua corpora (2025) and a few Russian IT-vacancy scrapes on HF add Cyrillic text but no match labels.

### Cited Findings
- **LinkedIn Job Postings 2023–2024 (arshkon):**
  - 124,000+ postings, CC BY-SA 4.0, about 556 MB, last updated 2024-08-19.
  - `job_postings.csv` has title, description, min/med/max salary, `formatted_experience_level` (entry, associate, executive, …), `skills_desc`, work type, remote_allowed, **`applies`** (number of applications), **`views`**, plus separate skills/industries/benefits and company files — [Kaggle](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings)
- **1.3M LinkedIn Jobs & Skills (2024, asaniczka):** 1.3M listings with job skills, ODC-By, about 6.2 GB — [Kaggle](https://www.kaggle.com/datasets/asaniczka/1-3m-linkedin-jobs-and-skills-2024)
- **Kaggle Resume Dataset (snehaanbhawal):**
  - 2,400+ livecareer.com resumes (string, HTML, PDF), 24 categories including Information-Technology, Engineering, Designer, Finance, HR, etc. CC0 — [Kaggle](https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset)
  - HF mirror `opensporks/resumes` has 2,484 rows — [HF](https://huggingface.co/datasets/opensporks/resumes)
- **Updated Resume Dataset (jillanisofttech):** CC0, about 3.1 MB; the description frames it as IT resume screening — [Kaggle](https://www.kaggle.com/datasets/jillanisofttech/updated-resume-dataset)
- **Job Dataset (ravindrasinghrana):** "synthetic job postings", CC0, about 1.7 GB, with experience, qualifications and salary range. The Djinni authors cite it as a JD corpus — [Kaggle](https://www.kaggle.com/datasets/ravindrasinghrana/job-description-dataset); [Djinni paper](https://aclanthology.org/2024.unlp-1.2)
- **`datasetmaster/resumes`:** 4,817 rows, MIT. A merged collection of real resumes and Faker-generated synthetic CVs for technical recruitment — [HF](https://huggingface.co/datasets/datasetmaster/resumes)
- **Work.ua (Ukrainian, 2025), both CC-BY-NC-4.0:**
  - `KSE-RESEARCH-Group/Work_UA_resumes`: 103,895 resumes scraped 9 Jul – 22 Aug 2025. Structured fields were partly extracted with Gemini 2.5 Flash — [HF](https://huggingface.co/datasets/KSE-RESEARCH-Group/Work_UA_resumes)
  - `KSE-RESEARCH-Group/Work_UA_vacancies`: 98,702 vacancies with salary, platform-normalized skills tags, remote flag, etc. — [HF](https://huggingface.co/datasets/KSE-RESEARCH-Group/Work_UA_vacancies)
- **Russian IT vacancy scrapes on HF (no pairs):**
  - `agoptar/russian-it-vacancy`: hh.ru + Habr Career IT vacancies with `experience`, `role`, `description`, **`grade`** and salary target — [HF](https://huggingface.co/datasets/agoptar/russian-it-vacancy)
  - `trewwxsav/IT_vacancies_from_hh.ru` (Apache-2.0) — [HF](https://huggingface.co/datasets/trewwxsav/IT_vacancies_from_hh.ru)
  - `ScoutieAutoML/it_vacancies_vectorisation`: 51,078 Telegram IT-vacancy posts, mostly Russian, with views and likes — [HF](https://huggingface.co/datasets/ScoutieAutoML/it_vacancies_vectorisation)

### Inferences
- For specialization and grade labels on Russian-like IT text:
  - Djinni `Primary Keyword` and `Experience Years` give about 210k EN + 24k UK silver labels.
  - Djinni JDs `Primary Keyword` and `Exp Years` give about 169k silver labels.
  - `agoptar/russian-it-vacancy` `grade` gives native Russian labels, useful for need-parsing grade extraction.
- LinkedIn `applies`/`views` are aggregate popularity signals. They can serve as a weak "attractiveness" prior, not as person–job fit labels.
- snehaanbhawal and jillanisofttech resumes are too small or too non-IT for our 6×3 taxonomy except as extra negatives or OOD tests.

### Gaps
- Row counts and licenses for `agoptar/russian-it-vacancy` and `trewwxsav/IT_vacancies_from_hh.ru` could not be read (datasets-server returned no size). Their license and provenance (scraped hh.ru content) need checking before any use.
- The jillanisofttech category list and row count were not confirmed from the fetched description.
- Russian-language datasets are likely covered in more depth by a parallel researcher. I did not search Russian resume corpora exhaustively.

## 5. Skill/entity extraction datasets from job postings (for need parsing, task a)

### Takeaway
Use SkillSpan-family span datasets (EN; TECH subset is IT-heavy) and TechWolf's ESCO-linked extraction and normalization sets (incl. the 2026 graded re-annotations) for training or evaluating skill extraction from employer needs. All are English or other EU languages, so they need cross-lingual transfer or translation for Russian.

### Cited Findings
- **SkillSpan** (Zhang et al., NAACL 2022): `jjzha/skillspan`, 4,800 / 3,174 / 3,569 sentences, CC-BY-4.0, EN — [HF](https://huggingface.co/datasets/jjzha/skillspan); [arXiv 2204.12811](https://arxiv.org/abs/2204.12811)
- **Other span datasets in the same HF collection:**
  - Green et al.: `jjzha/green`, 8,669 / 964 / 335, CC-BY-4.0, EN — [HF](https://huggingface.co/datasets/jjzha/green)
  - Sayfullina soft skills: 3,705 / 1,855 / 1,851, license unknown, EN — [HF](https://huggingface.co/datasets/jjzha/sayfullina)
  - Gnehm: German, 19,889 / 2,332 / 2,557, CC-BY-NC-SA-4.0 — [HF](https://huggingface.co/datasets/jjzha/gnehm)
  - Kompetencer: Danish, 778 / 346 / 262, CC-BY-4.0 — [HF](https://huggingface.co/datasets/jjzha/kompetencer)
  - FIJO: French, 399 / 50 / 50, CC-BY-NC-SA-4.0 — [HF](https://huggingface.co/datasets/jjzha/fijo)
  - SkillSkape (synthetic): 16,345 / 2,751 / 3,244 — [HF](https://huggingface.co/datasets/jjzha/skillskape)
- **TechWolf ESCO-linked extraction sets:**
  - `TechWolf/skill-extraction-tech`: SkillSpan TECH subset linked to ESCO v1.1.0; 293 val / 1,164 test; CC-BY-4.0 — [HF](https://huggingface.co/datasets/TechWolf/skill-extraction-tech); [arXiv 2209.05987](https://arxiv.org/abs/2209.05987)
  - `-house`: 231 / 891 — [HF](https://huggingface.co/datasets/TechWolf/skill-extraction-house)
  - `-techwolf`: 588 test — [HF](https://huggingface.co/datasets/TechWolf/skill-extraction-techwolf)
  - `TechWolf/Synthetic-ESCO-skill-sentences`: 138,260 (sentence, skill) pairs, 10 per skill for 99.5% of ESCO skills, LLM-generated, CC-BY-4.0 — [HF](https://huggingface.co/datasets/TechWolf/Synthetic-ESCO-skill-sentences); [arXiv 2307.10778](https://arxiv.org/abs/2307.10778)
- **2026 graded re-annotations for the RecSys-HR 2026 WorkRB challenge:** e.g., `TechWolf/Skill-extraction-Tech-graded` (BEIR layout; 75 val / 338 test queries; corpus of 13,891 ESCO skills; CC-BY-4.0). The challenge re-annotates skill extraction and normalization with five graded relevance levels — [HF](https://huggingface.co/datasets/TechWolf/Skill-extraction-Tech-graded); [challenge](https://workrb.techwolf.ai/challenges/recsys-hr-2026.html)

### Inferences
- For parsing needs like "Сеньор бэкенд на питоне, постгрес, k8s", the practical route is:
  1. A small Russian seed set of tech-stack entities, with Russian transliterations and slang.
  2. Transfer from SkillSpan TECH plus the TechWolf ESCO sets via multilingual encoders.
  3. Platform-normalized skill tags as weak labels: Djinni Skills_Tags in the IvanLukianets scrape, Work.ua skills, LinkedIn skills.
- ESCO skill granularity is coarser than tech-stack tokens (Python/Postgres/K8s). A custom stack dictionary is still needed.

### Gaps
- No Russian skill-span dataset for job ads was found in this pass.
- The domain composition of Gnehm (ICT focus) and the exact source of SkillSpan TECH were not re-verified here.

## 6. Synthesis: which datasets to use for ФСП Карьера tasks (a) need parsing, (b) profile spec/grade, (c) ranking

### Takeaway
No public dataset gives real Russian IT candidate↔need fit labels. The workable stack:
- Djinni (EN/UK, MIT) for in-domain pretraining and silver spec/grade labels.
- TalentCLEF 2026 Task A (CC-BY-4.0, expert-annotated, synthetic) and WorkRB/Malt (Apache-2.0, synthetic) for open ranking evaluation.
- cnamuangtoun-family / med2425 / the Russian translation only as noisy LLM-labeled pair supervision.
- SkillSpan/TechWolf for skill extraction.
- Real positives must come from ФСП Карьера's own invitation logs, or from LLM-as-judge labels on Djinni-style pairs, ConFit-v2 style.

### Cited Findings (dense matrix)
| Dataset | Size | Lang | Label type | Real or synthetic | IT-focused | License | Use for us |
|---|---|---|---|---|---|---|---|
| Djinni CVs + JDs ([HF](https://huggingface.co/datasets/lang-uk/recruitment-dataset-candidate-profiles-english), [paper](https://aclanthology.org/2024.unlp-1.2)) | 234,480 CVs; 169,358 JDs | EN (90/84%), UK | None for pairs; Primary Keyword, experience, English level | Real | Yes (plus some non-IT roles) | MIT | Pretraining; silver labels for (b); weak-pair mining for (c) |
| Djinni hiring-analyses ([HF](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-analyses-baseline-en)) | 450 unique pairs per language (24,750 rows each, attribute-injected) | EN, UK | Binary hire/reject + rationale | Real texts, LLM labels | Mostly IT | Not stated on card; code Apache-2.0 | Tiny eval / LLM-judge calibration |
| Djinni bias-mitigation synthetic ([HF](https://huggingface.co/datasets/Stereotypes-in-LLMs/hiring-bias-mitigation-synthetic-data)) | See card | EN, UK | Decision + rationale (Qwen3.5-122B teacher) | Real texts, LLM labels | Mostly IT | See card | Distillation data for (c) |
| IvanLukianets Djinni vacancies ([HF](https://huggingface.co/datasets/IvanLukianets/Job-Description-Dataset-Djinni)) | 8,270 | EN | Category, skills, experience; per-posting views/applications | Real | Yes | Unknown | Need parsing (a): category/skills/experience |
| cnamuangtoun fit ([HF](https://huggingface.co/datasets/cnamuangtoun/resume-job-description-fit)) | 8,000 pairs | EN | 3-class fit | Real-ish texts, unknown labels | No (mixed) | None | Noisy cross-encoder pretraining |
| …-ru translation ([HF](https://huggingface.co/datasets/niktigerbill/resume-job-description-fit-ru)) | 8,000 pairs | RU (LLM-translated) | 3-class fit | As above | No | CC-BY-4.0 (declared) | Russian cross-encoder warm-up |
| med2425 merged ([HF](https://huggingface.co/datasets/med2425/resume-job-fit-merged-v1)) | 93,733 pairs | EN | 3-class, Qwen2.5-32B labeled | LLM-labeled | Partly (software/data/ai domains) | None | Distillation-style training |
| netsol resume-score ([HF](https://huggingface.co/datasets/netsol/resume-score-details)) | 1,031 | EN | Graded criterion scores + requirement booleans (GPT-4o) | Synthetic JDs, LLM labels | Mixed | "cc" | Prompt/rubric design for LLM judge |
| jminc v2 ([HF](https://huggingface.co/datasets/jminc/resume-matching-dataset-v2)) | 74,147 | KO | 0–100 scores + grade (GPT-4o-mini) | Fully synthetic | Yes (FE/BE/AI) | None | Rubric ideas only (language mismatch) |
| AliYun/Zhaopin 2019 ([Tianchi](https://tianchi.aliyun.com/dataset/31623); [stats](https://arxiv.org/abs/2502.12361)) | 22,124 labels, 19,542 jobs, 2,718 resumes | ZH | Binary accept/reject | Real | Mixed | Withdrawn (2023) | Not available |
| Intellipro Recruiting ([ConFit v2](https://arxiv.org/abs/2502.12361)) | 48,096 labels | EN, ZH | Interview accept/reject | Real | Mixed | Proprietary | Methodology reference |
| CareerBuilder 2012 ([Kaggle](https://www.kaggle.com/c/job-recommendation)) | UNVERIFIED | EN | Applications | Real | Mixed | Kaggle rules | Interaction-model reference |
| XING RecSys 2016/17 ([survey](https://arxiv.org/abs/2209.05112)) | — | DE/EN | Clicks/bookmarks/replies | Real | Mixed | Not public | Not available |
| PJB 2026 ([arXiv](https://arxiv.org/abs/2603.17386)) | 297 queries × 197,674 resumes; 2,242 positives | ZH | LLM-judged binary relevance | Real texts, LLM labels | 40% tech R&D | Restricted | Not available |
| TalentCLEF 2026 Task A ([Zenodo](https://zenodo.org/records/19652670), [overview](https://arxiv.org/abs/2606.31692)) | 50 queries × ~475 resumes per language | EN, ES | Expert-annotated relevance (MAP) | Synthetic texts, human labels | Multi-industry | CC-BY-4.0 | Open eval for (c), translate to RU |
| WorkRB Malt matching ([HF](https://huggingface.co/datasets/MaltDataTeam/Freelancer-Project-Matching), [WorkRB](https://github.com/techwolf-ai/WorkRB)) | 200 briefs + 200 queries × 4,019 profiles | EN, DE, ES, FR, NL | Graded skill-fit scores | Synthetic | Freelance (mixed) | Apache-2.0 | Eval harness for (c) |
| TechWolf anonymous working histories ([HF](https://huggingface.co/datasets/TechWolf/anonymous-working-histories)) | 2,164 paths | EN | ESCO occupation per experience | Real | Mixed (24 industries) | CC-BY-4.0 | Work-history encoding |
| LinkedIn postings 2023–24 ([Kaggle](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings)) | 124k+ | EN | Experience level, skills; applies/views counts | Real | Mixed | CC BY-SA 4.0 | (a)/(b) silver labels, popularity prior |
| SkillSpan + TechWolf skill sets ([HF](https://huggingface.co/datasets/jjzha/skillspan), [HF](https://huggingface.co/datasets/TechWolf/skill-extraction-tech)) | ~11.5k sentences; ~1–2k linked | EN | Skill spans / ESCO links | Real | TECH subset | CC-BY-4.0 | (a) skill extraction |

### Inferences
- **Task (a), need parsing:**
  - Train spec and grade heads on Djinni JDs (`Primary Keyword`, `Exp Years`) and on Russian hh/Habr scrapes with `grade`, if the license allows.
  - Train the skill and stack extractor via SkillSpan/TechWolf transfer plus a custom RU stack lexicon.
  - Djinni lacks Russian, so translate a sample or rely on multilingual encoders.
- **Task (b), profile classification:** Djinni CVs are the best silver source. Map 41 Primary Keywords to our 6 specs and drop non-IT roles. Bucket Experience Years and title tokens (Junior/Middle/Senior) into 3 grades.
- **Task (c), ranking:**
  - Pretrain a bi-encoder contrastively on Djinni with keyword- and experience-consistent weak positives and hard negatives.
  - Warm-start the cross-encoder on cnamuangtoun-ru / med2425 (noisy).
  - Generate LLM-judge labels on Russian-translated Djinni pairs (the Djinni bias-mitigation work shows this pattern with a Qwen3.5 teacher).
  - Evaluate on TalentCLEF 2026 Task A (translated) plus a hand-labeled in-house RU IT set.
  - Adopt ConFit v2's HyRe and RUM tricks given label sparsity.
- Synthetic or LLM-labeled sets should be reported as such in any write-up. Only Intellipro, AliYun and CareerBuilder/XING carry real outcomes, and none is usable today.

### Gaps
- No public dataset with real employer→candidate invitation or contact signals in IT (the reverse-recruiting mechanic) was found in any language.
- License compatibility of LLM-translated derivatives (e.g., the RU translation re-licensing an unlicensed source as CC-BY-4.0) is legally unclear.
- I did not download TalentCLEF/Malt zips to check IT share or per-query relevance distributions.
