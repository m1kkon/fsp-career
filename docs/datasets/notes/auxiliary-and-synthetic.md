# Auxiliary data resources and synthetic-data methods for Russian IT candidate↔employer matching (ФСП Карьера)

Scope: what a small hackathon team can download/use within days to (a) parse employer needs → spec/grade/stack/salary, (b) classify candidate spec/grade, (c) rank candidates for a need (bi-/cross-encoder), when real labeled pairs are scarce. State checked on 2026-10-08. Items not verified by visiting a page in this session are marked **(UNVERIFIED)**.

---

## 1. Developer surveys with respondent-level data (role, experience, stack, salary) for modeling realistic candidate distributions

### Takeaway
Stack Overflow (ODbL, ~49k respondents in 2025; 2026 CSV not yet released) and JetBrains DevEco (24.5k respondents in 2025, raw data downloadable) are the only large surveys with downloadable respondent-level rows; both are global, so Russia-specific calibration must come from Habr Career salary aggregates (median, by grade/spec/city), which are not available as raw rows. Use SO/JetBrains for joint distributions (role × years × stack co-occurrence) and Habr Career for Russian salary/grade marginals.

### Cited Findings
- **Stack Overflow Developer Survey** — surveys from 2011 to 2026 are listed; "Survey data licensed under ODbL 1.0, contents under DbCL 1.0" — [survey.stackoverflow.co](https://survey.stackoverflow.co/)
- SO 2025: "over 49,000+ responses from 177 countries across 62 questions focused on 314 different technologies"; roles: full-stack 27%, back-end 14.2%, students 11.3%, new "Architect" role 6.1%; years coding: 21.1% have 6–10 years, 35% have 11+; languages: JavaScript 66%, HTML/CSS 61.9%, SQL 58.6%, Python 57.9% — [SO Survey 2025](https://survey.stackoverflow.co/2025/)
- SO 2026 results published 2026-10-06: >30,000 responses (16th survey); the full anonymized dataset is **not yet downloadable** — "In a few weeks, we'll have the full data set available for download" — [Stack Overflow blog, 2026-10-06](https://stackoverflow.blog/2026/10/06/the-results-of-the-2026-developer-survey-are-here/); 169 countries per [IT Brief](https://itbrief.co.uk/story/stack-overflow-survey-shows-developers-trust-ai-with-caveats)
- SO public CSV column names (DevType, YearsCodePro, LanguageHaveWorkedWith, WebframeHaveWorkedWith, PlatformHaveWorkedWith, ConvertedCompYearly, Country, RemoteWork) — these come from earlier-year schemas; check them against the 2025 CSV **(UNVERIFIED this session)**.
- **JetBrains State of Developer Ecosystem 2025**: 24,534 developers after cleaning, from 194 countries, surveyed April–June 2025; "Download the anonymized survey responses" (raw data available); topics include languages, years of professional coding, and pay ("Life and work" section). The page mentions possible bias toward JetBrains users. License for 2025 raw data not stated on the page — [devecosystem-2025.jetbrains.com](https://devecosystem-2025.jetbrains.com/); [JetBrains Research blog](https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/)
- Earlier JetBrains raw dumps: 2022 had 29,269 developers (CSV + Jupyter notebook, wide/narrow formats, questions, logic, license); contents "may be used as long as the source is appropriately credited" — [JetBrains blog 2023-03-13](https://blog.jetbrains.com/blog/2023/03/13/developer-ecosystem-survey-2022-discover-raw-data/)
- **Habr Career salary report H2 2025**: median IT salary 183k RUB (H1: 182k); Moscow 230k (+2%), St. Petersburg 200k (+4%), regions 159.2k (−1%); based on data from more than 52k IT workers — [T—Ж news](https://t-j.ru/news/habr-zp-it/)
- **Habr Career salary calculator** (career.habr.com/salaries): filters by qualification (Intern/Junior/Middle/Senior/Lead) and specialization. Shows base pay plus bonus (e.g., 183,356 ₽ + 20,833 ₽) with min–max ranges (63k–439k), "Рассчитано на основании 41 195 анкет". There is a footer link to a service API (/info/api), but no respondent-level download was found — [career.habr.com/salaries](https://career.habr.com/salaries)
- **hh.ru data**: a 3-month slice (June–August 2023) with 500,000 employer↔applicant interactions, 190,000 resumes and 320,000 vacancies (fields: creation date, city, profession, salary, employment type, etc.). It appears in a HSE (ФКН/ANOD) student project deck co-branded with hh.ru. Public availability and license are not stated — [HSE DANO deck](https://dano.hse.ru/mirror/pubs/share/886155014.pdf). hh.ru also launched an open labor-market analytics service in 2023 — [ComNews](https://www.comnews.ru/content/226670/2023-06-08/2023-w23/hhru-zapustil-servis-otkrytoy-analitiki-rynka-truda)

### Inferences
- Practical use: fit a joint sampler P(spec, grade | years), P(stack | spec) from SO 2025 rows (DevType → map to Backend/Frontend/DS/ML/DevOps/QA, YearsCodePro → Junior <2–3y, Middle 3–6y, Senior 6+y as a heuristic), then rescale salaries to Russian levels with Habr Career medians by grade/city. This gives realistic synthetic profile "skeletons" that an LLM can then turn into Russian prose.
- The SO/JetBrains Russian respondent counts are probably small, and the stack mix differs from Russia (for example, 1C, Yandex/VK ecosystems, Russian clouds). Treat global data as a structure prior, not a Russian market model.
- The 2023 hh.ru interaction dataset would be the most valuable real supervision (interaction = weak positive label), but its access route is unclear. Ask the organizers/hh.ru whether it is available for ЛЦТ.

### Gaps
- Exact Russia respondent count in SO 2025 / JetBrains 2025 not checked.
- License text of JetBrains 2025 raw data not checked.
- Not checked whether Habr Career's /info/api exposes salary aggregates programmatically.
- Whether the hh.ru 2023 interaction dataset is publicly downloadable is unknown.

---

## 2. Skill/occupation taxonomies and tech-synonym sources that can replace or extend the hand-written synonym dictionary

### Takeaway
No major open taxonomy has Russian labels. ESCO v1.2.1 ships in 28 languages, including Ukrainian but not Russian. O*NET (CC BY 4.0) and Lightcast (restrictive license) are English-only. For the tech-synonym problem the most practical sources are developer-native: GitHub Linguist language aliases, Stack Overflow tag synonyms, and hh.ru `key_skills`/`professional_roles` dictionaries. These can be combined with LLM-generated Russian transliteration/slang variants ("питон", "постгрес", "кубер/к8с"). Russian профстандарты give grade-level competency text but are not a skill dictionary.

### Cited Findings
- **ESCO**: latest version v1.2.1 (updated 10/12/2025), downloadable "in all 28 ESCO languages" as RDF, TTL, ODS, CSV, XML, JSON-LD. Ukrainian (uk) is included; Russian is **not** among the languages — [ESCO download](https://esco.ec.europa.eu/en/use-esco/download). ESCO v1.1.0 contains >3k occupations and ~14k skills in 28 languages, with ~7 English synonyms per skill on average. TechWolf authors found the synonyms "not always entirely accurate" — [Decorte et al. 2023, arXiv:2307.10778](https://arxiv.org/abs/2307.10778)
- ESCO license terms were not shown on the download page — [ESCO download](https://esco.ec.europa.eu/en/use-esco/download) **(license UNVERIFIED)**
- **O*NET 31.0**: released under CC BY 4.0, page updated 2026-10-06 — [O*NET license](https://www.onetcenter.org/license_db.html). The Technology Skills / Hot Technologies files (software product names with commodity codes) are part of the O*NET database **(UNVERIFIED this session)**.
- **Lightcast Open Skills**: 33,000+ skills and 75,000+ job titles with IDs, types and categories. Free API access is limited to nonprofits/public-good initiatives (subject to approval), including up to 50 skill-extraction requests per month. For-profit or production use needs a commercial license — [Lightcast docs](https://docs.lightcast.io/lightcast-api/docs/free-api-features); [Access options](https://docs.lightcast.io/lightcast-api/docs/api-access)
- **Stack Exchange data (tag synonyms)**: since July 2024 the dumps are no longer on archive.org. They are downloaded after login and require agreeing to use the data for projects that "do not include training a large language model". Critics argue this conflicts with CC BY-SA 4.0 — [DevClass 2024-07-30](https://devclass.com/2024/07/30/stack-exchange-restricts-access-to-dump-of-user-contributed-data-as-critics-complain-license-permits-reuse-for-any-purpose). An unofficial community mirror up to 2026-03-31 is on HF — [flymin/stackexchange_20260331](https://huggingface.co/datasets/flymin/stackexchange_20260331)
- **GitHub Linguist** `languages.yml` (language names, `aliases`, extensions; MIT license) — [github-linguist/linguist](https://github.com/github-linguist/linguist) **(UNVERIFIED this session)**
- **hh.ru API**: OAuth 2.0. Public endpoints such as vacancy search use an app token, and user-specific operations need an OAuth access token. Full vacancy details include description and **key skills**. Reference dictionaries cover experience, employment, work_format, currency, a **professional roles taxonomy**, and industries. Docs: api.hh.ru/openapi/redoc, github.com/hhru/api — [third-party client README summarizing the API](https://glama.ai/mcp/servers/@gmen1057/headhunter-mcp-server/blob/877434539a0e9eb9ee1b322ac3cab854fad19826/README.md); [hhru/api](https://github.com/hhru/api)
- **Работа России (trudvsem.ru) open data**: public open-data API and CSV of vacancies. Fields include job title, company with INN/OGRN, region, salary min/max, employment type, schedule, requirements, education and URL — [search result summary of trudvsem.ru/opendata](https://apify.com/bovi/trudvsem-vacancies.md) (secondary source). The open-data license is not stated **(UNVERIFIED)**.
- **Профессиональные стандарты (Минтруд)**: the registry is maintained by ФГБУ «НИИ труда и социального страхования» on profstandart.rosmintrud.ru and is downloadable as .xlsx — [spmag.ru](https://spmag.ru/articles/reestr-professionalnyh-standartov). There are 966 standards in force — [ppt.ru](https://ppt.ru/news/138603). The IT-relevant standards include 06.001 «Программист», 06.004 «Специалист по тестированию в области ИТ» and 06.042 (big data) — [garant](https://base.garant.ru/74472745/); [MIPT program doc](https://new.mipt.ru/sveden/files/riz/06_PPP_Data_Engineer_347.pdf). The site refused connection from our network (ECONNREFUSED), so the XML/open-data availability was **not verified**.
- Atlas of New Professions (atlas100.ru): not researched — no machine-readable release found **(UNVERIFIED)**.

### Inferences
- Recommended synonym stack for ФСП Карьера: (1) canonical tech IDs from GitHub Linguist (languages) plus a curated list of frameworks/tools seeded from SO 2025 technology names (314 technologies). (2) English aliases from SO tag synonyms (e.g., `postgres`→`postgresql`, `k8s`→`kubernetes`). (3) Russian colloquial variants generated by an LLM and checked by hand ("питон", "пайтон", "джава", "постгря", "кубер", "реакт", "вью", "докер"). (4) Validate coverage against the hh.ru `key_skills` frequency list from a few thousand IT vacancies fetched via API. The result is a ~500–1,500-entry dictionary that is also a gazetteer for the NER task (a).
- ESCO's Ukrainian labels are of little use for Russian IT slang. ESCO and O*NET are better used as an English canonical layer, e.g., as "skill → description" pairs for contrastive pretraining as in TechWolf.
- профстандарты map qualification levels to labor functions (e.g., 06.001 levels for junior/senior programmer). They could support "grade" descriptors in prompts but are bureaucratic text, far from how candidates write.

### Gaps
- The профстандарты open-data format (XML/API) could not be confirmed (site unreachable).
- Licenses for ESCO, trudvsem open data, and the hh.ru API terms of use for dataset building were not checked.
- No Russian-language IT skill taxonomy with synonyms (like ESCO) was found.

---

## 3. Skill-extraction / NER datasets for job postings and resumes (English, multilingual, Russian)

### Takeaway
English has solid span-level datasets (SkillSpan, CC BY 4.0; Green et al. 2022, 18.6k entities in 5 types) and large LLM-synthetic skill datasets (TechWolf 138k ESCO sentences, SkillSkape, both CC BY 4.0). No open, human-annotated Russian NER dataset for vacancies or resumes was found. The closest Russian resource is an auto-annotated Telegram IT-vacancy dataset (51k rows, generic NER, no stated license). For need parsing (task a), the practical route is synthetic Russian need texts with labels known by construction, plus weak supervision from the hh.ru `key_skills` and salary/experience fields.

### Cited Findings
- **SkillSpan** (Zhang et al., NAACL 2022): 14.5K sentences and over 12.5K spans annotated for hard skills and knowledge — [ACL Anthology](https://aclanthology.org/2022.naacl-main.366). The HF release has 11,543 sentences (train 4,800 / val 3,174 / test 3,569), BIO tags `tags_skill` and `tags_knowledge`, English, CC BY 4.0. Sources are Stack Overflow (tech) and STAR (house) postings — [jjzha/skillspan](https://huggingface.co/datasets/jjzha/skillspan). A related model is [jjzha/jobbert_skill_extraction](https://huggingface.co/jjzha/jobbert_skill_extraction).
- **Green, Maynard, Lin (LREC 2022)**: an annotation schema, corpus and baseline for entity recognition in job descriptions, with 18.6k entities of five types (Skill, Qualification, Experience, Occupation, Domain). CRF baseline F1 = 0.59; Creative Commons licensed paper — [ACL Anthology 2022.lrec-1.128](https://aclanthology.org/2022.lrec-1.128)
- **TechWolf Synthetic-ESCO-skill-sentences**: 138,260 (sentence, skill) pairs, 10 synthetic job-ad sentences for 99.5% of ESCO v1.1.0 skills, English, CC BY 4.0 — [HF dataset](https://huggingface.co/datasets/TechWolf/Synthetic-ESCO-skill-sentences)
- **JobSkape / SkillSkape** (2024): a framework for synthetic job postings with multiple skills per sentence and longer, more realistic sentences. SkillSkape is open-source under CC BY 4.0, and its downstream results on real data beat baselines — [arXiv:2402.03242](https://arxiv.org/abs/2402.03242)
- **ScoutieAutoML/it_vacancies_vectorisation**: 51,078 rows (972 MB) of Russian-language IT vacancies from Telegram channels (ML, DS, front-end, back-end). It includes text, embeddings, automatic NER (ORG, LOC, MONEY/CARDINAL salary, job titles), sentiment and spam labels. The annotation is automatic, and **no license is specified** — [HF dataset](https://huggingface.co/datasets/ScoutieAutoML/it_vacancies_vectorisation)
- Russian academic work extracts key skills from «Работа России» vacancies with skill-category labeling, but no public dataset release was found — [ETU conference paper](https://scm.etu.ru/assets/files/2024/sbornik-novyj/300-303.pdf). A Habr article describes NER in HR (place of work, position, experience duration) — [habr 857338](https://habr.com/ru/articles/857338/)
- **MELO benchmark** (Avature): 48 datasets in 21 languages for linking occupation mentions to ESCO occupations; code and data at github.com/Avature/melo-benchmark — [arXiv:2410.08319](https://arxiv.org/pdf/2410.08319). Whether Russian is among the 21 languages was **not verified**.
- **TalentCLEF 2025**: Task A multilingual job-title matching (EN, ES, DE, ZH), Task B job-title → skill prediction (EN). The data were built from real, anonymized job applications. 76 teams and 280+ submissions; most systems used contrastively fine-tuned multilingual encoders, and several used LLMs for augmentation or re-ranking — [overview arXiv:2507.13275](https://arxiv.org/pdf/2507.13275)

### Inferences
- For task (a) "need → spec/grade/stack/salary/format/city", sequence labeling plus classification can be trained on synthetic data where labels are exact by construction. Sample a structured need (spec=Backend, grade=Senior, stack={Python, PostgreSQL, Kubernetes}, format=office, salary_max=150k), then ask an LLM for 5–10 Russian free-text variants in different registers ("Сеньор бэкенд на питоне, постгрес, k8s"). Spans are recovered by string/gazetteer matching against the synonym dictionary, and samples where a slot cannot be located are dropped. This mirrors TechWolf's "start from the label, generate the text" design, which avoids aligning LLM outputs to a label set.
- Given the short inputs, a lighter alternative to token NER is gazetteer extraction for stack, regex for salary ("до 150 тыс", "150к", "от 200 000 ₽"), and a small classifier (fine-tuned rubert-tiny2 / USER-bge-m3 + logistic regression) for spec, grade and format. Synthetic data then mainly serves the classifier and stress-tests the regexes.
- The SkillSpan/Green taxonomies (Skill vs Knowledge vs Experience vs Qualification) suggest useful slot types for Russian annotation guidelines if the team hand-labels a small test set (~100–200 needs).

### Gaps
- No human-annotated Russian vacancy/resume NER dataset with an open license was found. Absence is not proof, but searches in Russian and English returned none.
- The language list of MELO (Russian included?) was not checked.

---

## 4. Russian/multilingual embedding models, benchmarks, and job-domain encoders / fine-tuning papers

### Takeaway
For Russian text, the strongest practical open encoders are deepvk/USER-bge-m3 (0.4B, Apache-2.0), ai-forever/FRIDA (0.8B, MIT), BAAI/bge-m3 and intfloat/multilingual-e5-large-instruct, with GigaEmbeddings (3B) top of ruMTEB (69.1) as of Dec 2024. Neither encodechka nor ruMTEB contains a job/resume task, so in-domain evaluation must be built by the team. Job-domain encoders (JobBERT-v3) do not cover Russian. Several papers show domain adaptation matters a lot: on a Chinese benchmark a domain-trained 0.6B embedder got 3.5× the nDCG@10 of a general one, and ConFit v2 got +13.8 recall / +17.5 nDCG from LLM augmentation plus hard negatives.

### Cited Findings
- **encodechka** (Russian sentence-encoder benchmark): STS, paraphrase, NLI, sentiment, toxicity, inappropriateness, intent (mono/cross-lingual) and two NER tasks — **no job/resume/vacancy task**. Top models: deepvk/USER-bge-m3 0.799, BAAI/bge-m3 0.787, intfloat/multilingual-e5-large-instruct 0.784 (Mean S) — [github.com/avidale/encodechka](https://github.com/avidale/encodechka)
- **ruMTEB** (Snegirev et al. 2024): 23 tasks in 7 categories (classification 9, clustering 3, multilabel 2, pair classification 1, reranking 2, retrieval 3, STS 3), with open code and a public leaderboard — [arXiv:2408.12503](https://arxiv.org/abs/2408.12503). The task list appears to contain no HR/job tasks (inference from the task categories; individual task names not re-verified).
- **deepvk/USER-bge-m3**: 0.4B parameters, 1024-dim, Apache 2.0, a shrunk BAAI/bge-m3 (base TatonkaHF/bge-m3_en_ru). Fine-tuned on 2.24M positive and 792K negative pairs; MTEB avg 0.706 vs 0.689 for the base model; encodechka 0.799 — [HF model card](https://huggingface.co/deepvk/USER-bge-m3)
- **ai-forever/FRIDA**: 0.8B, encoder of FRED-T5, max 512 tokens, MIT license. Uses task prefixes (search_query / search_document / paraphrase / categorize_*), is claimed top-1 among models ≤3B on MTEB/rusBEIR at its release date, and English quality is "unknown" — [HF model card](https://huggingface.co/ai-forever/FRIDA)
- **GigaEmbeddings** (Slavic NLP 2025): hierarchical instruction tuning of the decoder-only GigaChat-3B; ruMTEB avg 69.1, top position as of Dec 2024 — [arXiv:2510.22369](https://arxiv.org/pdf/2510.22369). License and weights availability **not verified**.
- **JobBERT-v3** (TechWolf, 2025): cross-lingual job-title matching for EN/DE/ES/ZH, fine-tuned from paraphrase-multilingual-mpnet-base-v2 on 21M+ job titles, 1024-dim. It outperforms multilingual baselines on TalentCLEF 2025. **No Russian** — [arXiv:2507.21609](https://arxiv.org/pdf/2507.21609); [HF TechWolf/JobBERT-v3](https://huggingface.co/TechWolf/JobBERT-v3)
- JobBERT-family models were used by several TalentCLEF 2026 Task A teams (qwerity, classum, HR_NLP) — [TalentCLEF 2026 overview, arXiv:2606.31692](https://arxiv.org/pdf/2606.31692)
- **conSultantBERT** (Lavi, Medentsiy, Graus 2021) fine-tuned a Siamese Sentence-BERT for matching jobs and job seekers. **ConFit** (Yu, Zhang, Yu, RecSys 2024) used LLM paraphrase augmentation plus contrastive learning — both cited in [Malt, arXiv:2601.10321](https://arxiv.org/abs/2601.10321)
- **ConFit v2** (Columbia/IntelliPro, 2025):
  - Resumes and jobs are encoded as single text sequences with E5-base or Jina-v2-base and mean pooling, trained with a contrastive InfoNCE loss in both directions.
  - It adds HyRE (an LLM-generated hypothetical resume appended to the job) and RUM (runner-up hard negatives).
  - Average absolute gain over ConFit: +13.8% recall and +17.5% nDCG. It outperforms BM25 and OpenAI text-embedding-3-large.
  - The AliYun 2019 dataset is "no longer publicly available as of 09-11-2023". The authors state no standardized public person-job fit dataset exists.
  - [arXiv:2502.12361](https://arxiv.org/abs/2502.12361)
- **ConFit v3** (2026): LLM-based re-ranking with Qwen3-8B/32B trained on real person-job fit data. Reported to outperform prior systems and strong LLMs (GPT-5, Claude Opus 4.5) — [arXiv:2605.09760](https://arxiv.org/html/2605.09760v1) (search summary only).
- **PJB benchmark** (2026, Chinese, internal): 297 JD queries, 197,674 resumes, 2,242 positives. The in-house domain-adapted CRE-T1-0.6B reached nDCG@10 0.207 vs 0.059 for general Qwen3-Embedding-0.6B (~3.5×). A general Qwen3-Reranker-8B gave +8.9% on the domain model but −26.1% on the general one, and LLM query rewriting hurt both. Released for internal use only — [arXiv:2603.17386](https://arxiv.org/abs/2603.17386)
- **Malt (2026)**:
  - Setup: a long-context re-ranker for multilingual freelancer profiles and project briefs.
  - Student model: a frozen snowflake-arctic-embed-xs encoder plus an 8-head cross-attention comparison block and MLP. 45M parameters total, of which only 135K are trainable.
  - Results: ranking mAP 0.631 (CMMD loss) vs 0.572 for fine-tuned Qwen3-Reranker-0.6B. Speed is 287 ms per 1k pairs with precomputed profiles vs ~7 min for Qwen3.
  - Training cost: 10 h on an RTX A1000.
  - [arXiv:2601.10321](https://arxiv.org/abs/2601.10321)
- **Alibaba (2026)** uses fine-tuned BGE-M3 embeddings (1024-dim) as the text backbone of a production person-job fit model — [arXiv:2604.21264](https://arxiv.org/abs/2604.21264)

### Inferences
- Default for the hackathon: USER-bge-m3 (Apache-2.0, 0.4B, Russian-tuned, strong on encodechka) as the bi-encoder. Fine-tune it with sentence-transformers MultipleNegativesRankingLoss on synthetic (need, profile) pairs with hard negatives. Use multilingual-e5-large-instruct or FRIDA as a comparison. A small cross-encoder re-ranker on top-50 (fine-tuned from the same backbone or a multilingual MiniLM cross-encoder) is the pattern that worked in TalentCLEF 2026.
- Keep the existing 8-component rule score as features/fusion (RRF or a learned linear fusion). TalentCLEF 2026 winners fused lexical, dense, structured-entity and graph views rather than relying on a single model, and PJB shows generic rerankers can hurt.
- Because no public Russian job-matching benchmark exists, build a small gold test set (e.g., 30 needs × 20 candidates, labeled 0–3 by two team members). Report nDCG@10 and MRR on it, plus synthetic-holdout metrics.

### Gaps
- GigaEmbeddings license/availability and FRIDA vs USER-bge-m3 on any job-like retrieval task were not checked.
- No Russian person-job embedding model or benchmark was found.
- The ConFit v3 details were read only from a search snippet.

---

## 5. Evidence on LLM-synthetic data for person-job fit (2023–2026): what works, pitfalls, recommended recipe

### Takeaway
Evidence is consistently positive when LLMs are used either to (i) generate text from a known label (skill→sentence, structured spec→resume/JD) or (ii) act as teachers whose labels are filtered or calibrated and then distilled into small encoders. Gains are large: +15–25 pts RP@5 for skill extraction, +13.8 recall / +17.5 nDCG for ConFit v2, and production gains at LinkedIn, Alibaba and Malt. The main pitfalls:
- LLM judges are weak on fine-grained differences (one qualification apart).
- Synthetic resumes are easier than real ones.
- Top-ranked "unlabeled" pairs are often false negatives.
- Generator-specific artifacts and homogeneity call for multiple prompts and models.
- Hallucination in rewritten texts.
- Demographic leakage and bias.

TalentCLEF 2026 itself used a synthetic resume–vacancy corpus guided by real job-skill co-occurrence statistics, plus expert annotation, as its official benchmark.

### Cited Findings
**Generation from labels (skills / resumes / JDs)**
- TechWolf (Decorte et al. 2023):
  - Setup: gpt-3.5-turbo was prompted per ESCO skill to write 10 hypothetical job-ad sentences, giving 138k pairs.
  - Prompt effect: adding the ESCO skill description and saying the ads are "hypothetical" raised coverage from 73% to 99.5% of skills. Manually checked accuracy rose from ~88% to ~94%.
  - Augmentation: concatenating a random unrelated sentence before or after each sentence, because "real sentences can mention more skills".
  - Training: all-mpnet-base-v2 with in-batch MNRL, 1 epoch, batch 64, lr 2e-5, on a T4 GPU.
  - Results: RP@5 rose from 29–32 (distant supervision) to 45.7–54.6. Even 1 synthetic sentence per skill beat description-only training.
  - [arXiv:2307.10778](https://arxiv.org/abs/2307.10778)
- JobSkape: earlier synthetic datasets were limited by short sentences with one skill each. Multi-skill, longer synthetic postings (SkillSkape, CC BY 4.0) beat baselines on real data — [arXiv:2402.03242](https://arxiv.org/abs/2402.03242)
- TalentCLEF 2026 Task A (EN/ES, job vacancy → ranked resumes):
  - Data: both dev and test sets were **synthetically generated**. Generation was "guided by statistical evidence on job-skill co-occurrence patterns extracted from real-world resumes and job descriptions" and covered diverse industries, occupations, gender and ethnicity. Expert annotators then reviewed and labeled the pairs. A manual review of the statistics guarded against leakage of real data. The corpus is on Zenodo (doi:10.5281/zenodo.17625261).
  - Winning systems: classum, MAP 0.714 vs baseline 0.383, used LLM-structured views (skills, tasks, seniority, domain), multiple dense encoders, LLM listwise/rubric scoring and fusion. QTPride (0.663) did LLM parsing into JSON, multi-view retrieval and ESCO-graph features with RRF. bipboopbipboop (0.653) combined bi-encoders, neural rerankers and LLM-as-judge with geometric-mean fusion and a listwise LLM tournament.
  - [arXiv:2606.31692](https://arxiv.org/pdf/2606.31692)
- Diversity measurement: one RANLP 2025 study used seven distinct prompts to diversify LLM-generated CVs. BERTScore to anchor resumes stayed >0.7 while ROUGE was low — [ACL Anthology 2025.ranlp-1.3](https://aclanthology.org/2025.ranlp-1.3.pdf) (from search snippet, not read in full).

**LLM augmentation of real data**
- ConFit v2 HyRE:
  - Method: GPT-4o-mini is prompted few-shot with N accepted (job, resume) pairs to write an "ideal resume" for each job. The generated text is concatenated to the job for both training and test.
  - Direction: job→resume beat resume→job (Recall@10 85.0 vs 77.75), because JDs are short.
  - Fine-tuning a local Qwen-2.5-32B with SFT+DPO to generate HyRE resumes was worse than few-shot GPT-4o-mini (nDCG@10 63.5 vs 65.1), attributed to subjective acceptance labels.
  - [arXiv:2502.12361](https://arxiv.org/abs/2502.12361)
- ConFit v2 RUM (hard negatives):
  - Method: rank all pairs with a first-pass encoder and sample negatives from the **top 3–4% percentile**, not the top-1%.
  - Rationale: "many of these top-k results are positive pairs that are unlabeled".
  - Results: nDCG@10 for rank-job was 66.2 for 0–1%, 71.3 for 3–4%, and 64.4 for BM25 top-10.
  - Training: batch 4, 2 hard negatives, lr 1e-5, one A100.
  - [arXiv:2502.12361](https://arxiv.org/abs/2502.12361)
- Alibaba (2026):
  - Method: rewrite short, low-quality JDs (<200 chars, ~25% of training samples) with Qwen1.5-72B-Chat and a chain-of-thought HR-expert prompt. The prompt uses historically matched resumes and must keep ≥70% of the original keywords.
  - Results: +3.4% AUC / +7.0% GAUC on the low-quality-JD slice.
  - Hallucination: 1 of 50 manually checked rewrites (2%), rated minor.
  - The category-aware MoE mattered more than augmentation for telling similar pairs apart (e.g., data analyst vs algorithm engineer).
  - [arXiv:2604.21264](https://arxiv.org/abs/2604.21264)

**LLM-as-teacher / judge labeling and distillation**
- LinkedIn LANTERN:
  - Pipeline: a black-box GPT-4o teacher produces fit level (Low/Medium/High) plus explanation. Expert human-in-the-loop filtering yields a seed set, used to fine-tune an in-house Qwen2.5 teacher.
  - Distillation: the teacher labels a corpus "several orders of magnitude larger" of synthetic job–person pairs, which trains a gte-Qwen 1.5B classifier, then a 0.4B encoder.
  - Prompting: splitting the long prompt into subtasks (extract qualifications → evaluate) improved consistency. Decoding used temperature 0.
  - Sampling: stratified to balance fit classes, with extra negatives from interaction signals for borderline cases.
  - Online: +0.24% apply rate, +0.28% qualified applications.
  - [arXiv:2510.05490](https://arxiv.org/abs/2510.05490)
- Malt:
  - Labeling: Gemini-2.0-flash scored with a 6-level rubric written into the prompt (0.0 "no relevant skills" … 1.0 "perfect match"), with reasoning before the score. Each prompt held 12 profiles per project, with at least one unsuitable and one perfect, which "encourages the model to improve the score quality".
  - Negatives: average-match negatives were added by keeping LLM scores 0.4–0.6 (265K extra pairs). Unsuitable negatives were sampled from profiles sharing no job category.
  - Remaining weakness: synthetic average-match cases. Recall difference between genders was 0.010 with LLM labels.
  - [arXiv:2601.10321](https://arxiv.org/abs/2601.10321)
- PJB: relevance labels came from a two-stage LLM-as-judge (doubao-1.5 filter, then kimi-2.5 binary judgments) on BM25 + dense candidate pools, with manual spot-checks on ~20% of queries. The released qrels contain positives only, so missing pairs may be unjudged — [arXiv:2603.17386](https://arxiv.org/abs/2603.17386)

**Validity limits of LLM judges / synthetic resumes**
- Castleman et al. 2026 (Princeton):
  - Setup: pairs of synthetic resumes for 186 real job descriptions, k required qualifications removed or preferred ones added, generated by both Gemini-2.5-pro and Claude-Sonnet-4. Many LLMs fail to pick the more-qualified candidate when they differ by one qualification.
  - Criterion validity at k=1: GPT-4o-mini 0.50–0.59, Llama-3.3-70B 0.44–0.50, Claude Sonnet 4 0.87–0.93, GPT-5 0.83–0.90. Most errors were unjustified abstentions.
  - Generator effect: validity differed by generator model, up to −16% for GPT-4o-mini.
  - Synthetic vs real: on real Reddit SWE resumes, criterion validity fell by 0.09 on average compared with LLM-generated ones.
  - Hard cases: changes only in soft skills or the summary section were hardest (0.67 vs 0.83).
  - Recommendations: filter trivial edits (<120-char difference) and use multiple generator models.
  - [arXiv:2602.18550](https://arxiv.org/abs/2602.18550)
- Fairness/leakage: TalentCLEF 2026 evaluated gender-variant consistency of rankings with Rank-Biased Overlap; the top system's RBO was 0.9904 — [arXiv:2606.31692](https://arxiv.org/pdf/2606.31692). Separate 2026 papers report demographic leakage in German LLM-generated resumes ([arXiv:2609.22188](https://www.alphaxiv.org/abs/2609.22188)) and fabrication in multi-stage LLM hiring pipelines ([arXiv:2608.26171](https://www.alphaxiv.org/abs/2608.26171)) — titles/abstract snippets only.

### Inferences
Recommended recipe for ФСП Карьера (synthesized from the evidence above; not itself validated):
1. **Structured-first generation (labels by construction).**
   - Sample candidate skeletons {spec ∈ 6, grade ∈ 3, years, stack (3–10 items from P(stack|spec) built from SO 2025 + hh.ru key_skills), format, city, salary drawn from Habr Career median × grade/city multipliers}.
   - Have an LLM write Russian "о себе", work history, roles and soft skills from the skeleton. Spec, grade and stack labels then need no LLM labeling, which covers task (b).
   - Do the same for employer needs at several verbosity levels: telegraphic slang, formal JD, team-context paragraph. This covers task (a) with exact slots.
2. **Diversity controls.**
   - Use ≥5 prompt templates or personas, ≥2 generator LLMs (e.g., one Russian-native such as GigaChat/YandexGPT and one open model such as Qwen), varied temperature and length.
   - Inject noise: typos, mixed Latin/Cyrillic tech names, missing fields.
   - Near-duplicate filtering by embedding cosine (e.g., >0.95).
   - Keep a held-out generator/template for testing. The Castleman et al. result (validity depends on the generator) argues against train/test from the same generator.
3. **Pair construction with graded relevance and hard negatives.**
   - Relevance is a rule-computed score from the skeletons (spec match, grade distance, stack Jaccard with synonym normalization, format/city/salary constraints), optionally refined by an LLM judge with a Malt-style 0–1 rubric.
   - Explicit hard negatives:
     - adjacent grade (Middle vs Senior, same stack);
     - adjacent spec (Backend↔DevOps, DS↔ML Engineering, Frontend↔Fullstack);
     - same spec/grade with a key stack item missing (k=1 edits à la Castleman), wrong format, or over budget.
   - After the first model, mine runner-up negatives from the 3–4% percentile band rather than the very top (ConFit v2).
4. **LLM-judge hygiene.** Use the rubric in the prompt, several candidates per prompt including anchors, reasoning before the score, temperature 0, a two-model agreement filter, and ~5–10% human spot-check. The decomposed prompt (extract requirements, then evaluate) follows LANTERN. Do not trust judges on one-qualification differences; the constructed labels are more reliable there.
5. **Leakage and evaluation.**
   - Split by need-template, company and generator, not by random pair.
   - Measure on a small hand-labeled set of realistic needs (from the platform demo data or real hh.ru vacancies).
   - Report gender/name-swap ranking stability (RBO) as TalentCLEF does.
   - Expect synthetic-test metrics to overestimate real performance (Castleman: real resumes harder by ~0.09).
6. **Model side.** Fine-tune USER-bge-m3 with MNRL plus hard negatives. Optionally augment the need side with a HyRE-style "ideal candidate profile" generated by an LLM, since needs are short. Fuse with the existing rule score, and add a cross-encoder or LLM listwise re-rank only on the top-K.

### Gaps
- No study specifically on **Russian-language** synthetic resume–vacancy generation, or on IT grade (Junior/Middle/Senior) discrimination, was found.
- Quantitative evidence on how much synthetic-only training transfers to real person-job pairs (vs synthetic augmentation of real pairs) is thin. Most strong results (ConFit v2, Alibaba, LinkedIn, Malt) start from real interaction data.
- The RANLP 2025 diversity study, ConFit v3 and the 2026 fairness/fabrication papers were seen only via abstracts or search snippets.
