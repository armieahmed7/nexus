# Global Future-Skills Frameworks & Outlooks — Benchmark Research for Kafa'a (ENEC)

Research date: 2026-10-10. Theme: **future skills and competencies**.
Every entry gives: what it is · owner/country · year · the concrete mechanism or product feature (what users actually see/do) · measurable results where published · what Kafa'a could borrow.

**Source-access notes (important for the plan's credibility):**
- `weforum.org` (all locales), `web.archive.org` and `publications.jrc.ec.europa.eu` are **blocked from this container** (Akamai 403 / CloudFront 504 / egress policy). WEF figures below are therefore corroborated from multiple independent secondary reports that quote the report verbatim; the canonical WEF URL is given for each so a human can verify. These are flagged **[WEF-secondary]**.
- `oecd.org` serves a Cloudflare JS challenge to curl; OECD/PIAAC figures below come from national statistical offices and IES, which publish the same OECD-computed numbers.
- Everything **not** flagged was read directly from the owner's own site via curl on 2026-10-10.

---

## 1. WEF — Future of Jobs Report 2025

**What it is.** Biennial employer survey (over 1,000 employers) producing (a) a ranking of "skills on the rise", (b) a "core skills" ranking, (c) a quantified skill-disruption and reskilling outlook to 2030.
**Owner/country.** World Economic Forum (Switzerland), with LinkedIn, ADP, Coursera, Indeed as data partners.
**Year.** Published January 2025, horizon 2025–2030.
**Canonical source.** https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/ (Jan 2025) — blocked from container, see note above.

**Headline figures [WEF-secondary]:**
- **39% of workers' core skills are expected to change by 2030**, down from 44% in the 2023 edition; WEF attributes part of the fall to continuous-learning and reskilling programmes. (Multiple independent restatements, Jan 2025; e.g. https://www.weforum.org/stories/2025/01/future-of-jobs-report-2025-jobs-of-the-future-and-the-skills-you-need-to-get-them)
- **Share of workforce covered by long-term learning strategies rose to 50%, from 41% in 2023.**
- **Fastest-growing skills, top 3 (verbatim ordering): AI and big data → networks and cybersecurity → technological literacy.** Then creative thinking; resilience, flexibility and agility; curiosity and lifelong learning. **Environmental stewardship entered the top-10 fastest-growing list for the first time.**
- **Fastest-declining:** manual dexterity, endurance and precision — **24% of respondents foresee a decrease** in their importance.
- Disruption is **uneven by economy**: lower-middle and upper-middle income economies and conflict-affected economies expect *greater* skill disruption than high-income economies. (Relevant to ENEC's regional supply chain and KHNP-transition staffing.)
- Caveat worth carrying into the plan: secondary coverage often re-states 39% as "39% of skills become *outdated*". WEF's own wording is "core skills **change**". Kafa'a copy should use the WEF wording.

**What Kafa'a could borrow.**
1. **"Skill half-life" meter per role.** Show each employee a role-level "% of your core skills expected to change by 2030" dial, computed from ENEC's own competency model mapped to WEF skill categories, with the WEF 39% global figure as the comparison line. One number, one source of truth, refreshed when the competency model changes.
2. **Rising / stable / declining skill badges** on every competency in the catalogue (three states: `rising`, `stable`, `declining`), driven by a single `trend` field so the dashboard, the learning recommender and the career planner all read the same signal.
3. **An annual "ENEC Future of Jobs" instrument** — run the WEF employer-survey question set internally (what share of your team's core skills will change; which skills are rising) with ENEC line managers, and publish the result as an internal benchmark chart against the WEF global and energy-sector numbers.

---

## 2. WEF — Reskilling Revolution

**What it is.** A platform aggregating public and private *commitments* to reach people with skills, education and economic opportunity, with a 2030 target of 1 billion people.
**Owner/country.** World Economic Forum (Switzerland), launched Davos 2020.
**Year.** 2020–2030; status update January 2026.
**Source.** https://www.weforum.org/press/2026/01/world-economic-forum-reskilling-revolution-on-track-to-reach-over-850-million-people/ (Jan 2026) [WEF-secondary — mirrored at https://www.eco-business.com/id/press-releases/world-economic-forum-reskilling-revolution-on-track-to-reach-over-850-million-people/]

**Mechanism / what users see.** Organisations register a numeric pledge ("we will reach N workers by 2030"); national **Skills Accelerators** are country-level public-private bodies that convene employers around a shared skills agenda; the Forum publishes running totals.
**Measurable results (Jan 2026).** Commitments to reach **856 million people by 2030** (up from ~716 million at the Jan 2025 halfway mark); **79 economies, 18 industries, 350+ organisations, 35+ CEOs**; **45 national skills accelerators** supporting **14.8 million people**; **25+ technology companies pledged to support 120 million workers by 2030**. Caveat: these are *commitments and projections*, not audited completions — a point Kafa'a should not repeat uncritically.

**What Kafa'a could borrow.**
1. **A pledge ledger**: each ENEC department/contractor registers a numeric upskilling commitment (people × skill area × date), and a public-to-ENEC dashboard tracks *pledged vs. started vs. completed* — explicitly separating the three, which the WEF model conflates.
2. **"Barakah Skills Accelerator" module**: a convening space in-product where ENEC, UAE universities, KHNP, and nuclear supply-chain vendors post shared skill demands and co-fund cohorts.
3. **Entry-level-at-risk flag**: WEF's own framing prioritises entry-level roles most exposed to disruption. Kafa'a can auto-flag ENEC job families where entry-level task content is most automatable and route those people into priority cohorts.

---

## 3. OECD — Survey of Adult Skills (PIAAC) 2nd Cycle

**What it is.** The world's benchmark direct *assessment* (not self-report) of adult competence, tablet-administered to a representative sample of adults aged 16–65.
**Owner/country.** OECD, 31 participating countries.
**Year.** Fieldwork Sept 2022–Aug 2023; results published **10 December 2024**.
**Sources.** OECD PIAAC 2nd Cycle database: https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html · Irish CSO key findings (publishes the OECD averages): https://www.cso.ie/en/releasesandpublications/ep/p-piaac/programmefortheinternationalassessmentofadultcompetenciespiaac2023/keyfindings (10 Dec 2024) · US IES: https://ies.ed.gov/learn/press-release/u-s-adults-score-par-international-average-literacy-skills-below-international-average-numeracy-and · Technical report: https://digital-skills-jobs.europa.eu/en/inspiration/research/survey-adult-skills-2023-technical-report (2025)

**Mechanism / what users see.** Three measured domains: **literacy, numeracy, and — new in this cycle — adaptive problem solving**, each reported on a 500-point scale with proficiency levels. "Adaptive problem solving" is defined around solving dynamic problems whose goals or information change mid-task — i.e. precisely the "respond to a changing situation" competence an operating nuclear plant cares about.
**Measurable results.** OECD averages across 31 countries: **literacy 260, numeracy 263, adaptive problem solving 251**. Finland highest in all three (296 / 294 / 276). **26% of adults are at Level 1 or below in literacy** (OECD average); **29% at Level 1 or below in adaptive problem solving**. US low performers in literacy rose from **19% (2017) to 28% (2023)**.

**What Kafa'a could borrow.**
1. **An "adaptive problem solving" assessment track** distinct from technical knowledge tests: scenario items where the plant parameters change mid-question and the candidate must revise their answer. Score it on its own scale and show it on the competency passport alongside technical scores.
2. **Foundational-skills floor check.** Before putting someone into an advanced SMR/ADVANCE pathway, run a short literacy/numeracy screener and, where someone is below the floor, auto-insert a foundations module — rather than letting them fail the technical course.
3. **Benchmark line on every score.** Any Kafa'a competence score shown to an individual should carry a comparison line ("OECD average", "ENEC average", "role target"), the way PIAAC reports do. This is a single reusable UI component.

---

## 4. OECD — "Skills in the AI age" / AI Capability Indicators

**What it is.** OECD's current AI-and-skills analytical strand: (a) policy work on what AI does to skill demand, (b) a technical framework for measuring what AI systems can actually do.
**Owner/country.** OECD.
**Year.** 2025 (AI Capability Indicators technical report); earlier AI-skill-demand papers 2023–2024.
**Sources.** AI Capability Indicators technical report: https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report (2025) · Emerging trends in AI skill demand across 14 OECD countries: https://pact-for-skills.ec.europa.eu/community-resources/publications-and-documents/emerging-trends-ai-skill-demand-across-14-oecd-countries-0_en (2023) · coverage: https://dig.watch/?p=262173

**Mechanism.** The **AI Capability Indicators** define **ten capability dimensions** — language, social interaction, problem solving, creativity, metacognition and critical thinking, learning and memory, vision, manipulation, robotic intelligence, consciousness — each rated on a **five-level scale**. This is explicitly designed so human-skill frameworks and AI-capability frameworks can be compared on the same axes.
**Measurable results.** Workers with advanced AI capabilities are **~1% of the workforce**. **Firm AI adoption in OECD countries rose from ~7% to ~20% of businesses between 2021 and 2025.** In 2023, AI-related online vacancies were **<1% of all postings**, concentrated in ICT and professional services. A 2024 OECD vacancy study across 10 countries found **~72% of vacancies require at least one management skill and 67% require business-process skills** — i.e. non-technical skills dominate even technical postings.

**What Kafa'a could borrow.**
1. **Human-vs-AI capability overlay.** For each ENEC task cluster, plot the OECD 5-level AI capability rating against the required human proficiency level. Where AI rating ≥ human requirement, the task is flagged "augmentable" and the competency is re-weighted toward supervision/verification skills instead of execution.
2. **"Skills that survive AI" view** in the career planner, built from the OECD finding that management and business-process skills dominate vacancies: show each employee which of their competencies are *complementary* to AI rather than substitutable.
3. **AI-exposure score per role**, recomputed annually, surfaced in the workforce-planning module so HR sees drift rather than a one-off audit.

---

## 5. ILO — Strategy on Skills and Lifelong Learning 2030 / Global Skills Programme

**What it is.** The UN labour agency's standing strategy and its delivery programme, organised around five pillars.
**Owner/country.** International Labour Organization (UN, Geneva).
**Year.** Strategy published 2023; programme runs 2022–2030; high-level evaluation covering 2022–26 issued 2026.
**Sources.** https://www.ilo.org/global-skills-programme · https://www.ilo.org/topics-and-sectors/skills-and-lifelong-learning/ilo-global-skills-programme · Strategy PDF (mirrored): https://asiagarmenthub.net/resources/2024/the-ilo-strategy-on-skills-and-lifelong-learning-2030.pdf · RPL report: https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning · Evaluation: https://www.ilo.org/sites/default/files/2026-10/GB358-PFA-6-EN.pdf

**Mechanism.** One pillar is explicitly: *"robust systems for quality assurance, dynamic assessment and certification of skills and competencies, recognition of prior learning (RPL) and lifelong career development support systems."* **RPL** is the operative mechanism: a structured process that assesses and certifies competence a worker already has, however acquired, so it counts toward a formal qualification.
**Measurable results.** Programme covers **61 countries**; the 2022–2025 strategy was costed at **~US$225 million**. The African Union's Continental TVET Strategy (2025–2034) names RPL as a critical tool — evidence of uptake.

**What Kafa'a could borrow.**
1. **A formal RPL workflow.** ENEC has a large population of experienced operators and KHNP-trained staff whose competence is undocumented in any portable form. Build an RPL request → evidence upload → assessor review → credential issuance flow, with an explicit evidence taxonomy (logged hours, simulator runs, supervisor attestation, prior certificate).
2. **"Dynamic assessment" rather than one-off certification**: schedule re-assessment on a competency's own validity clock, not the calendar year.
3. **Career development support as a tracked service** — ILO treats career guidance as infrastructure, not a perk. Kafa'a should log guidance conversations as first-class records that feed the development plan.

---

## 6. UNESCO / UNEVOC — TVET and lifelong learning

**What it is.** UNESCO's standard-setting work on technical and vocational education, qualifications recognition and lifelong learning; UNEVOC is its TVET network.
**Owner/country.** UNESCO (UN, Paris) / UNEVOC (Bonn).
**Year.** Ongoing; TVET Strategy cycle and the Global Convention on the Recognition of Qualifications concerning Higher Education (entered into force 2023).
**Note:** direct UNESCO primary-source retrieval was not completed in this pass; the research above surfaced ILO-side material only. **Flag for follow-up before the plan cites UNESCO figures.** The durable, verifiable hooks are: UNESCO's Global Convention on recognition of qualifications, and UNEVOC's TVET Leadership and "Trends Mapping" products.

**What Kafa'a could borrow (framework-level, safe to state without a disputed figure).**
1. **Qualification-recognition records** designed so a credential earned at Barakah is legible to an external body (title, level, learning outcomes, assessment method, issuer, validity) — the Convention's data minimum.
2. **A TVET-pathway view** that treats vocational and academic routes as equal-status parallel ladders into the same roles, rather than vocational as a lesser branch.

---

## 7. EU — Pact for Skills

**What it is.** A Commission-run membership scheme under which employers, social partners and training providers sign public upskilling commitments, organised into sectoral **Large-Scale Skills Partnerships (LSPs)**.
**Owner/country.** European Commission, DG EMPL.
**Year.** Launched 2020; 2025 annual survey results published May 2025 and mid-2025.
**Sources.** https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en (19 May 2025) · https://euricse.eu/en/over-10-million-workers-trained-under-the-pact-for-skills/ · https://cepis.org/eu-pact-for-skills-reaches-10-million-trained-workers/

**Mechanism / what users see.** Members sign a charter, join or form an LSP for their sector, then report annually into a survey; the Commission publishes aggregate training volumes and an online members' directory plus a resource hub.
**Measurable results.** 2024 survey (released May 2025): **~6.1 million people trained since 2020**, **3,200+ member organisations**, **20 LSPs** training on average **33% of their workforce**. 2025 survey: **over 10 million trained cumulatively**, **3.9 million in 2025 alone**, **4,000+ organisations**, **>€1 billion invested**, LSP members training on average **26% of workforce**. Standing target: **25 million people upskilled/reskilled by 2030**. (The 33%→26% drop between surveys is unexplained in the sources — likely a denominator change as membership widened. Do not present it as a decline without checking.)

**What Kafa'a could borrow.**
1. **"% of workforce trained this year" as the single headline KPI** for every ENEC department and every contractor — the one number the Pact proves is both collectable and comparable. Put it on the executive dashboard with a target line.
2. **Supply-chain skills partnership**: let ENEC's vendors and contractors join Kafa'a as member organisations with their own commitments and their own training-coverage number, so nuclear-safety-relevant skills are tracked beyond ENEC's own payroll.
3. **An annual skills survey instrument** built into the product (not a separate consultancy exercise), producing a year-on-year series.

---

## 8. EU — ESCO (European Skills, Competences, Qualifications and Occupations)

**What it is.** The EU's multilingual machine-readable classification linking occupations to skills — the reference "common language" for matching, recommendation and training alignment.
**Owner/country.** European Commission, DG EMPL.
**Year.** v1 published 28 July 2017; **current version ESCO v1.2.1, last updated 10/12/2025, release v6.0.0** (read from esco.ec.europa.eu, 2026-10-10).
**Sources.** https://esco.ec.europa.eu/en/about-esco/what-esco · https://esco.ec.europa.eu/en/classification/skill_main

**Mechanism / what users see.** **3,039 occupations and 13,939 skills**, each with a preferred term, non-preferred terms (synonyms), description, scope note, and relationships to other skills and occupations — **in 28 languages including Arabic**. The skills pillar is sub-classified into *Knowledge*, *Skills*, *Language skills and knowledge*, and *Transversal skills*. Each skill carries a **reusability level**: `transversal` / `cross-sectoral` / `sector-specific` / `occupation-specific`. Skills carry labels including `DigComp`, `Green`, `Research`, `Digital`. There is a free **ESCO API**, bulk downloads, and published crosswalks/mapping tables to national classifications. Concepts can be marked `obsolete` without being deleted.

**Why this is the single most directly reusable benchmark for Kafa'a:** it already publishes **Arabic** labels, it is free, it is versioned, and it has the exact data model a bilingual competency platform needs.

**What Kafa'a could borrow.**
1. **Adopt ESCO's reusability level as a first-class field** on every ENEC competency (`transversal` / `cross-sectoral` / `sector-specific` / `occupation-specific`). This is what makes a credible "transferable skills" view and a credible internal-mobility recommender: transversal skills transfer, occupation-specific ones don't.
2. **Synonym/alt-label layer + Arabic preferred terms**, taken straight from ESCO where an ENEC competency maps to an ESCO concept. This instantly improves search, CV parsing and the EN/AR parity of the catalogue.
3. **`obsolete` status instead of deletion**, plus a version stamp on the competency framework — so historical assessments stay interpretable when the framework changes (a nuclear-regulator-friendly property).
4. **Publish a Kafa'a↔ESCO crosswalk** so an ENEC employee's profile is exportable into any EU-facing system, and so vendor training catalogues tagged with ESCO can be auto-matched to ENEC gaps.

---

## 9. EU/JRC — DigComp (now DigComp 3.0)

**What it is.** The European Digital Competence Framework for Citizens — the reference description of what it means to be digitally competent, from basic to highly advanced.
**Owner/country.** European Commission Joint Research Centre with DG EMPL.
**Year.** First published 2013; updates 2016, 2017, 2022 (**DigComp 2.2**); **DigComp 3.0 is the fifth edition, published 2025**.
**Sources.** https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en (read 2026-10-10) · DigComp 2.2 ↔ ESCO mapping dataset: https://data.jrc.ec.europa.eu/collection/id-00414 · mapping study: https://publications.jrc.ec.europa.eu/repository/handle/JRC137060

**Mechanism / what users see.** **DigComp 2.2: 21 competences across 5 competence areas** (information and data literacy; communication and collaboration; digital content creation; safety; problem solving), each described at **8 proficiency levels** with concrete "examples of knowledge, skills and attitudes" — including, in 2.2, examples specifically about AI and interacting with AI systems. Framework is **technology-neutral and non-prescriptive**, deliberately so it can be adapted. Published in PDF, editable, and **structured data formats**, with explicit guidance on adapting and re-publishing. There are DigComp-based **self-assessment tools** and the official **Digital Skills Indicator** used for EU-wide monitoring.
**Measurable results.** In 2023, **only 56% of EU adults had above-basic digital skills**, and **43% of EU secondary students did not reach a basic level**. In 2024–2025, **92% of EU workers reported needing digital skills to do their jobs and 30% used AI systems for work**. JRC's mapping study found **732 ESCO skills map to one or more DigComp competences, accounting for 54.5% of all skills mentioned in Skills-OVATE online job ads 2018–2022** — with coverage skewed toward information/data literacy, content creation and communication, and thin on safety and problem solving.

**What Kafa'a could borrow.**
1. **A DigComp-aligned digital/AI literacy ladder for ENEC**, 8 levels, with ENEC-specific "examples of knowledge, skills and attitudes" written for plant contexts (e.g. "verifies an AI-generated procedure summary against the controlled document"). Adaptation is explicitly licensed.
2. **A DigComp self-assessment widget** plus a **Digital Skills Indicator**-style organisational metric ("% of ENEC staff above basic digital skills"), trended yearly — a single number an executive can act on.
3. **Deliberately over-weight the two thin areas** the JRC found under-represented in job ads — *safety* and *problem solving* — because in a nuclear context those are the two that matter most, and the market data shows nobody else is teaching them.

---

## 10. EU/JRC — GreenComp, EntreComp, LifeComp (the competence-framework family)

**What it is.** Three sibling frameworks built with the same JRC method as DigComp, covering sustainability, entrepreneurship, and personal/social/learning-to-learn competence.
**Owner/country.** European Commission Joint Research Centre.
**Years.** EntreComp 2016 (JRC101581); LifeComp 2020 (JRC120911); **GreenComp 2022 (JRC128040, EUR 30955 EN)**.
**Sources.** https://joint-research-centre.ec.europa.eu/greencomp · GreenComp PDF: https://wikis.ec.europa.eu/download/attachments/80183613/GreenComp.pdf · https://ideas.repec.org/p/ipt/iptwpa/jrc128040.html · Cyprus funding portal summary: https://www.fundingprogrammesportal.gov.cy/en/2023/09/the-european-sustainability-competence-framework/ (Sept 2023)
*(publications.jrc.ec.europa.eu rejected container requests; GreenComp structure confirmed from the Commission wiki PDF URL and the Cyprus government summary. EntreComp's 15 competences / LifeComp's 9 competences are widely cited but were **not** verified from a primary page in this pass — verify before printing the counts.)*

**Mechanism / what users see.** **GreenComp: 12 competences in 4 areas** — *embodying sustainability values; embracing complexity in sustainability; envisioning sustainable futures; acting for sustainability* — three competences per area, each with a description and learning-outcome statements. Deliberately **non-prescriptive**: it is a reference for designing learning schemes, not a curriculum. GreenComp states it was built on the method "developed, tested and validated by the JRC" for DigComp, EntreComp and LifeComp — i.e. there is a documented, reusable framework-authoring method.

**What Kafa'a could borrow.**
1. **A "CleanEnergyComp" for ENEC**, authored with the JRC method: 4 areas × 3 competences, each with learning outcomes, covering nuclear's specific sustainability story (lifecycle carbon, waste stewardship, systems thinking under uncertainty, public trust). This is a defensible, citable structure rather than an invented list.
2. **EntreComp-style intrapreneurship track** for the ADVANCE/SMR programme — ideas, resources, into-action — so innovation competence is assessed, not just encouraged.
3. **LifeComp as the home for the "human" competencies** (self-regulation, empathy, growth mindset, critical thinking, managing learning) that WEF's rising-skills list keeps surfacing but most competency catalogues have nowhere to put.

---

## 11. Cedefop — Skills Forecast & Skills-OVATE

**What it is.** The EU agency for VET's two intelligence products: a long-horizon quantitative employment/skills forecast, and an online-job-advertisement analytics tool.
**Owner/country.** Cedefop (EU agency, Thessaloniki).
**Year.** Skills Forecast in its 20th year; **2025 release projects to 2035**.
**Sources.** https://www.cedefop.europa.eu/en/news/skills-forecast-insights-future-proof-europe · https://www.cedefop.europa.eu/en/datasets/dataset-skills-forecast · https://www.cedefop.europa.eu/en/news/cedefops-skills-forecast-going-strong-its-20th-year · https://ied.eu/project-updates/european-and-national-skill-supply-and-demand-forecasts-for-2025-now-online/

**Mechanism / what users see.** Projections of employment by **sector × occupation × education level to 2035**, built on a single "most likely" macro scenario using official economic and population projections, delivered through an **online webtool** plus downloadable datasets and **country reports for all EU-27** that include potential skill shortages and qualification mismatches. Cedefop also maintains a **labour shortage indicator** (refined at a 2025 expert workshop). Skills-OVATE analyses online job ads for skill demand — it is the data source behind the JRC's DigComp/ESCO job-ad study above.

**What Kafa'a could borrow.**
1. **A 10-year ENEC workforce forecast view** — headcount demand by role family × competency level to 2035, under one declared baseline scenario — covering the Barakah steady-state, the KHNP operator-support wind-down to ~2030, and the ADVANCE/SMR ramp. Make the scenario assumptions visible on the page.
2. **A shortage indicator**, one composite number per critical role (vacancy duration + internal pipeline depth + external supply), so "critical role at risk" is computed, not asserted.
3. **A local job-ads scanner** (Skills-OVATE analogue) over UAE/GCC energy postings, to detect skills rising in the regional market before they appear in ENEC's own framework.

---

## 12. US DOL — O*NET (Hot Technologies, Bright Outlook, Content Model)

**What it is.** The US national occupational database — the most mature public example of a structured, free, machine-readable skills-and-occupations system with consumer-grade front ends.
**Owner/country.** US Department of Labor / ETA, via the National Center for O*NET Development (North Carolina Department of Commerce).
**Year.** Continuously updated; **Bright Outlook list last revised 2026 using BLS 2025–2035 projections**; Hot Technologies methodology paper November 2022; site updated 6 Oct 2026.
**Sources.** https://www.onetcenter.org/overview.html · https://onetcenter.org/bright.html · https://onetcenter.org/reports/Hot_Technologies_Demand.html · https://www.onetonline.org/help/online/browse_hot · https://mynextmove.org/help/about (all read 2026-10-10). Licensed **CC-BY 4.0**.

**Mechanism / what users see.**
- **Scale:** **923 data-level occupations** (1,016 titles) representing **over 55,000 jobs**; Work Activities hierarchy alone has **19,000+ task statements → 2,000+ detailed work activities → 325 intermediate → 41 generalized activities**. Free, with Web Services APIs.
- **Hot Technologies:** software/technology requirements **most frequently appearing across all employer job postings**, derived from real job-ad text. **"In Demand"** = frequently appearing in postings *for one particular occupation*. Both are rendered as badges on occupation pages and are separately browsable/downloadable.
- **Bright Outlook:** a **sun icon** on an occupation meaning it meets ≥1 of three criteria — (a) projected to grow **≥5%** over 2025–2035, (b) projected **≥75,000 job openings** over 2025–2035 (threshold was 100,000 in the 2022–2032 edition), or (c) **new and emerging** (e.g. the four cybersecurity occupations added in the O*NET-SOC 2019 taxonomy). Historical lists back to 2012 are kept and published.
- **My Next Move** gives every career a **three-tier outlook label: Bright / Average / Below Average** — a deliberately simplified consumer surface over the same data.

**What Kafa'a could borrow.**
1. **"Hot Technologies" for ENEC**: compute, from ENEC's own job requisitions and from scanned GCC energy postings, which tools/technologies appear most often — then badge them in the learning catalogue. Distinguish *hot across ENEC* from *in demand for your role*, exactly as O*NET does; the two-tier distinction is what makes the badge actionable.
2. **"Bright Outlook" role badges** with **published criteria and thresholds** visible to employees (growth %, openings count, new-and-emerging). Publishing the rule is what makes the badge trusted rather than a black box — and keeping past years' lists lets people see whether the badge was right.
3. **A three-tier consumer label** (Bright / Stable / Declining) on every role in the career explorer, backed by the same underlying numbers the workforce planners see — one data source, two audiences, two levels of detail.
4. **Task-level granularity.** O*NET's 19,000 task statements are what make gap analysis concrete. Kafa'a should hold ENEC competencies down to task statements, not stop at competency titles — this is also what makes AI-exposure scoring possible (see §4).

---

## 13. Lightcast — Open Skills taxonomy

**What it is.** The large commercial open skills library used widely for skills-based HR tech, derived from labour-market job-posting data.
**Owner/country.** Lightcast (US).
**Year.** Continuously maintained; current figures as of 2025–2026.
**Sources.** https://docs.lightcast.io/data/docs/lightcast-skills-taxonomy · https://lightcast.io/our-taxonomies · https://docs.lightcast.io/lightcast-api/docs/general-taxonomies-skills · https://lightcast.io/blog/open-skills-taxonomy

**Mechanism / what users see.** Roughly **33,000–35,000 standardised skills** (Lightcast's own pages cite 32,000+, 33,000+, 34,000+ and 35,000+ on different pages — **the exact count is not consistently stated**, so cite a range). **3-tier hierarchy** (Skill → Subcategory → Category). Skills are typed as **Common Skills, Specialized Skills, and Certifications & Licenses**, with Spoken Languages and Software filterable as separate facets. Lightcast's docs say monthly refresh; its blog says fortnightly — **also inconsistent**. The Skills API is free for nonprofits pursuing a public good; commercial access on request, with no published pricing.

**What Kafa'a could borrow.**
1. **Three skill *types*, not one flat list**: `common` (transferable), `specialized` (technical), `certification/licence`. Nuclear operations live or die on the third category, and most competency platforms model licences as an afterthought. Kafa'a should model licence-type skills with issuer, expiry and renewal path as a distinct type from the start.
2. **A 3-tier hierarchy with a stable ID per skill** so skills can be renamed without breaking historical records.
3. **A dated changelog of the skills taxonomy**, published in-product — Lightcast's own inconsistency across pages is the cautionary example: version everything and show the version.

---

## 14. LinkedIn — Economic Graph, Skills on the Rise, Work Change

**What it is.** The largest real-time behavioural dataset on skills: what people add to profiles, what recruiters search, what employers list.
**Owner/country.** LinkedIn / Microsoft (US).
**Year.** *Work Change* report January 2025; *Skills on the Rise 2025* list 2025.
**Sources.** https://economicgraph.linkedin.com/research · coverage of the 2025 list: https://www.itwire.com/it-people-news/recruitment/ai-literacy-tops-linkedin's-2025-skills-on-the-rise-list · https://gulfnews.com/business/markets/linkedin-unveils-skills-on-the-rise-2025-15-must-have-skills-for-the-future-1.500067061 (primary LinkedIn report pages were not retrievable directly in this pass — verify the exact list on economicgraph.linkedin.com before printing it.)

**Mechanism / what users see.** The **"skills genome"** approach: represent any entity (a person, a job, a company, a city, a country) as a weighted vector of skills, then compute similarity, gaps and transition paths between them. The public **Skills on the Rise** list is built from three signals combined: **frequency of skill additions by members, presence of the skill in recently-hired members' profiles, and growth in employer demand for the skill in postings**.
**Measurable results.** LinkedIn projects **70% of the skills used in most jobs will change by 2030** (Work Change, Jan 2025) — notably more aggressive than WEF's 39% core-skills figure, because it counts all skills rather than core skills. **AI literacy ranked #1** on the 2025 Skills on the Rise list, defined as the ability to understand and use AI-enabled tools for business purposes — held distinct from LLM development/application as a technical skill. The share of members adding AI skills to profiles has grown **~20-fold globally since 2016**.

**What Kafa'a could borrow.**
1. **A skills-genome representation for ENEC**: every employee, every role, every course and every project represented as the *same* weighted skill vector. Once that exists, role-match, gap analysis, internal mobility, mentor matching, project staffing and course recommendation are all one cosine-similarity query rather than six separate features.
2. **A three-signal "rising skill" detector** copied directly from LinkedIn's method, using ENEC's own data: skills newly added to profiles + skills held by recent hires + skills appearing in new requisitions. Publish the resulting internal "Skills on the Rise at ENEC" list quarterly.
3. **Separate "AI literacy" from "AI engineering"** as two distinct competencies with different ladders and different target populations — LinkedIn's data shows these move independently, and conflating them is the most common design error.

---

## 15. McKinsey — DELTAs (Distinct Elements of Talent) / foundational skills

**What it is.** A research-based taxonomy of the foundational skills citizens need for the future of work, with a validated link between proficiency and employment outcomes.
**Owner/country.** McKinsey Global Institute / Public & Social Sector Practice.
**Year.** 2021 ("Defining the skills citizens will need in the future world of work").
**Sources.** https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work · PDF mirror: https://prevention.psu.edu/wp-content/uploads/2023/04/McKinsey-defining-the-skills-citizens-will-need-in-the-future-world-of-work.pdf · WEF summary: https://www.weforum.org/stories/jobs-and-the-future-of-work/defining-the-skills-citizens-will-need-in-the-future-world-of-work/

**Mechanism / what users see.** **4 skill categories** (cognitive, digital, interpersonal, self-leadership) → **13 skill groups** (e.g. communication, mental flexibility, teamwork effectiveness) → **56 DELTAs**. Called "DELTAs" rather than skills because the list deliberately mixes skills *and attitudes* ("adaptability", "coping with uncertainty"). The inclusion rule is sharp and worth copying: **an item is only a DELTA if it needs a distinct approach to its development and assessment** — which is how you stop a competency catalogue sprawling.
**Measurable results.** Survey of **18,000 people across 15 countries**, measuring current proficiency against needed proficiency. Higher DELTA proficiency was associated with **higher likelihood of employment, higher income, and higher job satisfaction**. University degree holders had higher average proficiency overall — but **not on every DELTA**, which is the empirical argument for skills-based rather than credential-based assessment.

**What Kafa'a could borrow.**
1. **Adopt the inclusion rule** as governance for ENEC's competency catalogue: a competency is only added if it requires a *distinct* development and assessment approach. Enforce it in the competency-authoring workflow.
2. **4 categories × 13 groups × N elements** as the catalogue's shape, so ENEC technical competencies sit alongside cognitive/interpersonal/self-leadership ones in a single structure rather than a separate "soft skills" ghetto.
3. **Proficiency-vs-needed gap as the primary chart** everywhere (McKinsey's core visual), not raw proficiency.

---

## 16. Deloitte — the skills-based organization

**What it is.** The most-cited quantitative case for organising work around skills rather than jobs.
**Owner/country.** Deloitte (global).
**Year.** Research fielded May–June 2022; published 2022, reused in 2023 Human Capital Trends ("The end of jobs").
**Sources.** https://www.deloitte.com/content/dam/assets-shared/legacy/docs/industry/energy-resources-industrials/2022/DI_The-skills-based-organization-report.pdf · https://www.deloitte.com/us/en/insights/topics/talent/human-capital-trends/2023/skills-based-model-end-of-jobs.html · https://www.deloitte.com/content/dam/assets-shared/legacy/docs/insights/2022/DI_HCT23_End-of-jobs.pdf

**Mechanism.** Deconstruct jobs into tasks and skills; staff work from a skills pool; use skills as the currency for hiring, deployment, development, promotion and pay.
**Measurable results.** Survey of **1,021 workers and 225 business/HR executives** plus ~12 executive interviews. Skills-based organisations are **107% more likely to place talent effectively**, **98% more likely to retain high performers**, and **98% more likely to have a reputation as a great place to grow and develop**. Critical caveat Deloitte itself reports: **fewer than 1 in 5 organisations are adopting skills-based approaches to a significant extent** — so these multiples describe early adopters, not a general effect. (A widely-quoted "52% more likely to innovate" figure circulates via third parties; **not verified in Deloitte's own text** — do not use.)

**What Kafa'a could borrow.**
1. **Skills as the deployment currency for outage and project staffing**: let a project post required skills and let the system propose internal people by skill match, with an explicit "stretch assignment" flag — this is the highest-value, most concrete manifestation of skills-based working in a plant operator.
2. **An adoption-maturity self-assessment** for ENEC HR against Deloitte's dimensions (hiring, deployment, development, pay), shown as a maturity ladder — because the research's real finding is that almost nobody has done this at scale.
3. **Instrument the two claimed outcomes**: internal-placement effectiveness and high-performer retention, tracked as named Kafa'a KPIs, so ENEC can test the 107%/98% claim on its own data instead of citing it.

---

## 17. ISO 30414:2025 — Human capital reporting and disclosure

**What it is.** The international standard for how an organisation reports workforce metrics — the compliance-grade spine for any skills dashboard.
**Owner/country.** ISO / TC 260 (Human resource management).
**Year.** First edition 2018; **second edition released 24 August 2025**.
**Source.** https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html (24 Aug 2025, read 2026-10-10). Standard itself is paywalled (~$369).

**Mechanism / what users see.** **11 Human Capital Areas** (retained from 2018), one of which is **"Skills, Capabilities and Development"**. The 2025 revision introduces: **auditable requirements** alongside recommendations (shifting from guidance to compliance-ready); **a baseline set of 14 required metrics** applicable to every organisation regardless of size, sector or geography; **new metrics on human rights, labour relations, productivity, ethics and workforce well-being**; a requirement that **every metric carry both quantitative and qualitative disclosure**, in a structured format covering **governance, strategy, metrics, and variance explanations**; explicit guidance on **data governance, digital tagging, AI, and workforce upskilling**; guidance on consolidated vs. separate reporting for multi-unit entities; and expanded annexes with SME-tailored recommendations. Materiality is deliberately not prescribed — organisations must **state which interpretation of materiality they apply**. (A commonly-cited "69 metrics across 11 areas, 6 of them in Skills" breakdown comes from consultancy PDFs, **not** the standard — flag as unverified.)

**What Kafa'a could borrow.**
1. **Make the ENEC skills dashboard ISO 30414-shaped**: group metrics under the 11 Human Capital Areas, with "Skills, Capabilities and Development" as a first-class section, and generate an **exportable ISO 30414 disclosure pack** — a genuinely differentiating feature for a state-linked operator that reports to government and lenders.
2. **Every metric gets a narrative field.** The 2025 standard's "quantitative + qualitative, with variance explanation" rule is a product requirement: each KPI tile needs an owner-written explanation of movement, stored and versioned.
3. **An audit trail on every metric** (definition, formula, data source, as-of date, who approved it), because the 2025 edition makes these metrics auditable. For a nuclear operator this is the difference between a dashboard and a regulatory artefact.

---

## 18. 1EdTech — Open Badges 3.0 & Comprehensive Learner Record (CLR) 2.0

**What it is.** The open standards for portable, verifiable digital credentials — the technical substrate for a "skills passport".
**Owner/country.** 1EdTech Consortium (formerly IMS Global, US), with W3C Verifiable Credentials.
**Year.** Open Badges 3.0 and CLR Standard 2.0 released together early 2023; **Open Badges 3.0 approved as a final specification in June 2024** after three years of open development.
**Sources.** https://www.1edtech.org/standards/open-badges · https://www.1edtech.org/standards/clr · https://www.1edtech.org/1edtech-article/new-open-badges-30-standard-provides-enhanced-security-and-mobility/411060 · https://www.1edtech.org/article/1edtech-announces-major-improvements-educational-credentials · https://www.1edtech.org/1edtech-article/latest-comprehensive-learner-record-standard-improves-security-portability-and

**Mechanism / what users see.** **Open Badges** = a single verified achievement, shareable across platforms. **CLR** = the full record of all learning experiences and achievements in verifiable digital form — a container of badges plus context. Both 3.0/2.0 are built **as W3C Verifiable Credentials**, which means cryptographic proof of issuer and tamper-evidence without phoning home to the issuer. 1EdTech also publishes **CASE (Competencies & Academic Standards Exchange)** — a standard for digitally transmitting competency and standards definitions, so that a badge can point at a machine-readable competency rather than a text string. There is a **certification programme and a public certified-products directory**; Territorium was the first US company certified for both CLR 2.0 and Open Badges 3.0 (June 2023). The CLR is AACRAO's official standard for digital learner records.
**Measurable results.** A 1EdTech/Credential Engine report cited at launch put **use of 1EdTech Open Badges at more than 74 million globally**. (Adoption figures beyond 2023 were not independently verifiable in this pass; the certified-products directory is the live check.)

**What Kafa'a could borrow.**
1. **Issue every ENEC competency achievement as an Open Badges 3.0 verifiable credential**, so an operator's qualification is cryptographically verifiable by a regulator, a vendor, or a future employer without an ENEC API call. This is the correct technical answer to "portable skills passport".
2. **Build the Kafa'a profile as a CLR**, not a list of certificates: one verifiable container holding assessments, simulator hours, courses, licences and project experience, exportable as a file the employee owns.
3. **Adopt CASE for the competency framework itself**, so ENEC's competency definitions are machine-readable and a badge references a competency *ID*, not a label — this is what lets ENEC, UAE universities and vendors mean the same thing by the same competency.
4. **Target 1EdTech certification** for the credential-issuing module; the public certified-products directory is third-party proof that the credentials are real.

---

## 19. SFIA 9 — Skills Framework for the Information Age

**What it is.** The global skills and competency framework for the digital world — the most mature example of a **skill × level** matrix used for real job architecture.
**Owner/country.** SFIA Foundation (global not-for-profit, UK-registered).
**Year.** **SFIA 9 released 30 October 2024** (beta from 1 July 2024); SFIA 10 in consultation, planned Q4 2027.
**Sources.** https://sfia-online.org/en/sfia-9/sfia-9-release-notes (read 2026-10-10) · https://sfia-online.org/en/sfia-9/responsibilities · https://sfia-online.org/en/sfia-9/sfia-9-release-notes/sfia-9-responsibilities-generic-attributes · https://sfia-online.org/en/news/sfia-9-is-coming-on-30th-october-2024 · AI skills view: "SFIA 9 - a framework for AI skills"

**Mechanism / what users see.** **7 Levels of Responsibility — Follow, Assist, Apply, Enable, Ensure, Initiate, Influence** — defined by **generic attributes** (autonomy, influence, complexity, business skills/behaviours, knowledge) that apply across *every* skill. Professional skills are then defined **only at the levels where they meaningfully exist**, not at all 7 — SFIA publishes an explicit rationale page for this ("Why SFIA skills are not defined at all 7 levels"), which is a critical design lesson. SFIA 9 added: a **"level essence" statement** per level (a one-line plain-language gist, for scannability); **new level-2 skills and guidance for levels 1–3 aimed at individuals and their managers** (entry-level support); a dedicated **AI skills view**; updated cyber, cloud/FinOps, data & analytics, digital health, testing, procurement, marketing, financial/value management and information & records management skills; a **searchable/filterable A–Z skills list and career paths**; **standard skills profiles**; **"SFIA for…" views** that slice the framework by audience; a **change tracker** so users can plan ahead; and **SFIA Assessment, Credentials and Digital Badges**. SFIA is free to view and licensed for use.

**What Kafa'a could borrow.** (SFIA is the single best structural model for Kafa'a's competency engine.)
1. **Generic level attributes applied across all competencies** — autonomy, influence, complexity, knowledge, behaviours — so a level-4 nuclear engineer and a level-4 procurement officer mean comparable things. This makes cross-function mobility and pay banding coherent.
2. **Define a competency only at the levels where it genuinely exists**, and publish the reasoning. Most competency frameworks force all skills to 5 levels and become fiction at the ends.
3. **"Level essence" one-liners** on every level of every competency — a one-sentence plain-language gist in EN and AR shown above the full descriptor. Cheap to add, transformative for comprehension.
4. **Views**: "SFIA for…" style audience slices — *Kafa'a for new graduates*, *for operators*, *for managers*, *for the ADVANCE/SMR programme* — the same framework, filtered, with its own landing page.
5. **A public change tracker** for the competency framework, so people can see what is changing before it lands — essential when assessments and licences hang off the framework.
6. **Explicit entry-level support (levels 1–3)** with guidance written *for the individual and their manager as a pair* — SFIA 9's most-copied improvement.

---

## 20. Singapore — SkillsFuture (Level-Up Programme / SkillsFuture Credit)

**What it is.** The most advanced national individual-learning-account system, and the clearest working example of putting purchasing power for skills in the individual's hands.
**Owner/country.** SkillsFuture Singapore (SSG) / Ministry of Education, Singapore.
**Year.** SkillsFuture from 2015; **Level-Up Programme announced Budget 2024**, credit disbursed from May 2024; further expanded Budget 2025 and National Day Rally 2025.
**Sources.** https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling (4 Mar 2024) · https://www.mof.gov.sg/docs/librariesprovider3/budget2024/download/pdf/annexd1.pdf · https://www.moe.gov.sg/news/parliamentary-replies/20250108-skillsfuture-credit-mid-career-utilisation (8 Jan 2025)

**Mechanism / what users see.** Three components: (a) a **S$4,000 SkillsFuture Credit (Mid-Career) top-up**, granted automatically in the year a Singaporean turns 40, **with no expiry date**; (b) subsidy for a **second publicly-funded full-time diploma**; (c) a **Mid-Career Training Allowance** to offset income loss during full-time training. Critically, the credit is usable only on **selected courses with better employability outcomes** — roughly **7,000 eligible courses** — listed on the MySkillsFuture portal. The earlier one-off S$500 mid-career top-up with a 31 Dec 2025 expiry was folded into the new non-expiring credit.
**Measurable results.** **More than 25,000 Singaporeans aged 40+ used the Credit as of 30 November 2024.** Most-used training area was **ICT**, then security & investigation, then wholesale & retail trade.

**What Kafa'a could borrow.**
1. **An individual learning account per ENEC employee** — a notional annual development budget, visible as a balance, spendable against a curated catalogue, with an explicit "what you have left this year" number. Visibility of balance is the behavioural mechanism; an invisible L&D budget is not an account.
2. **Outcome-gated catalogue**: a course is only purchasable with the account if it is on the approved list, and the approval criterion is published (employability/role-progression outcome). This is the part most corporate platforms skip, and it is where Singapore's credibility comes from.
3. **A training allowance / time-protection mechanism** for staff taking substantial reskilling — the real barrier for shift-working plant staff is time, not fees. Model and display protected training hours alongside the budget.
4. **An age/career-stage trigger** that proactively pushes a mid-career reskilling offer at a defined point, rather than waiting for the employee to ask.

---

## Cross-cutting design lessons (the pattern behind the benchmarks)

1. **Separate the skill's *definition* from its *level*** (SFIA, DigComp, ESCO all do this). One competency record, N level descriptors, generic level attributes shared across all competencies.
2. **Type your skills** — transversal / cross-sectoral / sector-specific / occupation-specific (ESCO) and common / specialized / certification-licence (Lightcast). Transferability and licence management both fall out of this one field.
3. **Version and deprecate, never delete** (ESCO `obsolete` status, SFIA change tracker, O*NET's retained historical Bright Outlook lists). A nuclear operator's assessment history must stay interpretable.
4. **Derive trend signals from three independent sources**, not one (LinkedIn: profile additions + new hires' profiles + employer demand).
5. **Publish the criteria behind every badge** (O*NET's published Bright Outlook thresholds) — this is what separates a trusted signal from a black box.
6. **Every number gets a benchmark line and a narrative** (PIAAC's comparison scores; ISO 30414:2025's quantitative + qualitative + variance-explanation rule).
7. **One headline coverage KPI** — "% of workforce trained this year" (Pact for Skills) — is the number that travels to an executive and to a regulator.
8. **Credentials must be verifiable without calling the issuer** (Open Badges 3.0 / W3C VC). Anything less is not a passport.
9. **Multilingual is a data-model property, not a translation layer** (ESCO's 28 languages including Arabic, with preferred and non-preferred terms per language). For a bilingual EN/AR product this must be designed in at the concept level.
10. **Constrain catalogue growth with an explicit inclusion rule** (McKinsey DELTAs: only if it needs a distinct development *and* assessment approach).

---

## Follow-ups needed before the plan is finalised

- **WEF Future of Jobs 2025** full ranks 4–10 of the "skills on the rise" list and the core-skills table — blocked from this container; retrieve from weforum.org on an unblocked network.
- **UNESCO** primary sources (Global Convention on Recognition of Qualifications; UNEVOC Trends Mapping) — not retrieved in this pass.
- **EntreComp (15) and LifeComp (9) competence counts** — widely cited, not primary-verified here (`publications.jrc.ec.europa.eu` rejected requests).
- **ISO 30414:2025** metric-by-metric detail for the "Skills, Capabilities and Development" area — standard is paywalled; the "69 metrics / 6 skills metrics" figure is consultancy-sourced only.
- **Lightcast exact skill count and refresh cadence** — Lightcast's own pages contradict each other; cite a range.
- **BCG skills-based-organization research** — no primary BCG material surfaced; search bcg.com directly rather than relying on the vendor blogs that cite it.
- **Cedefop Skills-OVATE** current status — the Skills Forecast webtool was noted as undergoing a scheduled update with access paused; confirm availability.
