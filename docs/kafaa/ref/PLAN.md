# Kafa'a future skills and competencies: feature plan (FS series)

Prepared 10 Oct 2026. Engineering source of truth for the next build programme. It extends the 38 features already built (F01 to F38, `kafaa_build/BACKLOG.md`) and does not duplicate them; where a card extends an existing feature it names it.

**Inputs.** `scratchpad/fs/audit.md` (read-only audit of master `06d23f1`), the four research packs `global_frameworks.md`, `national_systems.md`, `nuclear_energy.md`, `corporate_platforms.md`, `/workspace/kafaa/CONTRACT.md` and `kafaa_build/BACKLOG.md`.

**Size.** 84 new features in 12 themes, tied to 40 international benchmarks, delivered in 9 waves of up to 5 engineers. Priority: P1 37, P2 40, P3 7. Complexity: S 15, M 61, L 8.

## 1. Rules every card follows

- Synthetic data only: no real staff names or photos; people are `w-*`/`p-*` synthetic workers or role cards.
- No plant, OT, simulator or HR-system connection. Plant data, twin series and budgets are seeded and labelled SIMULATED (`SimChip`).
- No LLM key. Every "AI" behaviour is deterministic or retrieval-based (rules, weighted scoring, BM25, cosine, graph search, adaptive item rules), returns `reasons[]` (`lintRanked`) and sits behind the engine kernel with the existing disabled `ModelGatewayEngine` slot.
- Additive `kafaa_*` objects only. NEXUS objects are never altered or dropped. Migrations are idempotent.
- Both backends: each RPC exists as the TS `Rpc` signature, the LocalBackend implementation and a SQL `SECURITY DEFINER` function with its Supabase mapping; a PGlite validator proves SQL = TS on the seed. Domain rule files stay import-free.
- EN and AR complete (`check:i18n`), logical RTL utilities, Arabic-Indic digits via `useFormat()`; new taxonomies carry `_en`/`_ar` columns.
- Aggregates under 10 are suppressed (`suppress()`, `MIN_GROUP_SIZE`). Protected inputs (gender, nationality, age proxies) never enter scoring; nationality appears only in suppressed Emiratisation aggregates.
- Security, safeguards and cyber roles appear at career-path level only, with qualified / not-qualified status. All-staff cyber hygiene is awareness content with no security detail.
- Kafa'a is never a regulatory authority: no FANR status, no licence claims; RPL, credentials and readiness screens carry the mirror / "not an authority" copy and pass the regulatory-wording check. ADVANCE and SMR content carries "no deployment decision implied" and no headcount or site text (`publicTextIsClean`).
- Qualification work is never gamified. Every public fact links a source and an as-of date; every benchmark figure is stored as a sourced row, never typed into copy.

## 2. Conventions

**New modules M28 to M37** are registered once by FS01 (wave A, foundation). Each later engineer owns exactly one folder per wave and never edits shared routing files.

| Module | Folder | Name | Waves |
|---|---|---|---|
| M28 | `src/modules/m28` | Skills Intelligence | B, H |
| M29 | `src/modules/m29` | AI and Digital Fluency | B, D, I |
| M30 | `src/modules/m30` | Role Transformation | B, I |
| M31 | `src/modules/m31` | Next-Gen Nuclear Readiness | E |
| M32 | `src/modules/m32` | Energy Transition Skills | E |
| M33 | `src/modules/m33` | Human Skills Studio | C, F |
| M34 | `src/modules/m34` | Recognition (RPL, NQF, credits) | D, I |
| M35 | `src/modules/m35` | Workforce Strategy and Disclosure | F, G |
| M36 | `src/modules/m36` | Skills Ecosystem | G, I |
| M37 | `src/modules/m37` | National Alignment | G, H |

**Existing folders touched** (one engineer per folder per wave): `foundation`, `m17`, `m11`, `m01`, `m26`, `m21`, `m18`, `m19`, `m04`, `m05`, `m02`, `m20`, `m24`, `m22`, `m08`, `m07`, `m16`, `m25`, `m10`, `m09`, `src/shell`, `m13`, `m06`.

- **Policy resources** added by FS01: `skills_taxonomy`, `ai_literacy`, `transformation`, `recognition`, `workforce_strategy`, `ecosystem`, `national_alignment`. Existing roles are reused.
- **Migrations:** `supabase/migrations/202610102<w><e>NNN_kafaa_fs<w><e>_<topic>.sql`, with wave digit w = 1 (A) to 9 (I) and engineer e = 1 to 5; additive and idempotent. A wave QA migration `202610102<w>9001_kafaa_fs<w>qa_integration.sql` wires cross-feature hand-offs after each merge.
- **Seed:** one builder per engineer `scripts/seed/ext/fsNN-<topic>.mjs` (auto-loaded). **Validators:** `scripts/validate/fs<w><e>-<topic>.mjs` (PGlite, SQL = TS). **Tests:** `tests/unit/fs<w><e>-*.test.ts(x)`; the route sweep count is updated by the wave integration lead only.
- **Benchmarks in the product:** every feature page shows its `<BenchmarkChip>`s, reading `kafaa_benchmarks` (FS01). The IDs in the cards below are those rows.
- **Dependencies:** a card depends only on earlier waves, or on an earlier card owned by the same engineer in the same wave. "Data-only" couplings (a page reads rows another card seeds, with no code import) are allowed and marked.

## 3. Themes

| Code | Theme | Features |
|---|---|---|
| TAX | Future-skills intelligence and taxonomy | FS01, FS02, FS03, FS07, FS08, FS23, FS70, FS71, FS72 |
| AI | AI and digital literacy | FS09, FS10, FS36, FS37, FS40, FS76, FS80 |
| ADV | Advanced reactors, SMR and fusion readiness | FS04, FS13, FS14, FS38, FS39 |
| GRN | Energy transition and green skills | FS41, FS42, FS43 |
| HUM | Human and leadership skills (critical core skills) | FS25, FS26, FS46, FS47, FS48, FS58, FS59 |
| NKS | Nuclear knowledge and safety culture of the future | FS44, FS45, FS49 |
| MOB | Career mobility and role transformation | FS05, FS06, FS11, FS12, FS15, FS16, FS27, FS28, FS33, FS34, FS35, FS81 |
| LRN | Learning that closes future-skill gaps | FS17, FS18, FS19, FS20, FS21, FS22, FS56, FS57, FS75 |
| CRD | Credentials and recognition | FS24, FS29, FS30, FS31, FS32, FS78, FS79 |
| UAE | National/UAE alignment and Emiratisation quality | FS62, FS63, FS73, FS74 |
| GOV | Analytics, governance and ISO 30414 reporting | FS50, FS51, FS52, FS53, FS54, FS55, FS60, FS61, FS84 |
| ECO | Ecosystem: universities, suppliers and partners | FS64, FS65, FS66, FS67, FS68, FS69, FS77, FS82, FS83 |

## 4. Benchmarks (IDs used in the cards)

| ID | Benchmark | Owner, where | Year | What Kafa'a borrows | Source |
|---|---|---|---|---|---|
| WEF-FOJ | WEF Future of Jobs Report 2025 | World Economic Forum; International | 2025 | Core-skill change per role, a rising/stable/declining trend field on every skill, and a transversal core-skills family. | https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/ |
| OECD-PIAAC | OECD Survey of Adult Skills (PIAAC), Cycle 2 | OECD; 31 countries | 2024 | Adaptive problem solving as its own assessed scale, and a benchmark line on every score shown to a person. | https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html · https://www.cso.ie/en/releasesandpublications/ep/p-piaac/programmefortheinternationalassessmentofadultcompetenciespiaac2023/keyfindings |
| OECD-AICI | OECD AI Capability Indicators | OECD; International | 2025 | A five-level AI capability rating per task, compared with the human requirement to flag augmentable tasks. | https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report |
| ILO-RPL | ILO Skills and Lifelong Learning Strategy 2030; recognition of prior learning | International Labour Organization; International | 2023 | A structured RPL flow (request, evidence, assessor, credit) and re-assessment on each skill's own validity clock. | https://www.ilo.org/global-skills-programme · https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning |
| EU-PACT | EU Pact for Skills | European Commission; EU | 2025 | "% of workforce trained this year" as the headline KPI, and numeric commitments from suppliers and partners. | https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en |
| ESCO | ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations) | European Commission; EU, 28 languages incl. Arabic | 2025 | Reusability level on every skill, Arabic preferred and alternative labels, obsolete-not-deleted, and a published crosswalk. | https://esco.ec.europa.eu/en/about-esco/what-esco · https://esco.ec.europa.eu/en/classification/skill_main |
| DIGCOMP | DigComp 2.2 / 3.0 digital competence framework | European Commission JRC; EU | 2022 / 2025 | A digital and AI ladder with plant-specific examples, extra weight on safety and problem solving, and a "% above basic" indicator. | https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en |
| GREENCOMP | GreenComp, with EntreComp and LifeComp | European Commission JRC; EU | 2022 | The 4 x 3 authoring method for an ENEC CleanEnergyComp, LifeComp as the home for human skills, and EntreComp for intrapreneurship. | https://joint-research-centre.ec.europa.eu/greencomp |
| FORECAST | Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035 | Skills England (UK); Cedefop (EU); UK / EU | 2025 | One declared baseline with bands, "pressure now" kept apart from "demand later", a methodology-change banner, a "not yet modelled" list, and a regional demand-to-provider loop. | https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030 · https://www.cedefop.europa.eu/en/datasets/dataset-skills-forecast |
| ONET | O*NET Hot Technologies and Bright Outlook | US Department of Labor; United States | 2026 | Role and technology badges with published thresholds, past lists kept, and a three-tier consumer label. | https://onetcenter.org/bright.html · https://onetcenter.org/reports/Hot_Technologies_Demand.html |
| LIGHTCAST | Lightcast Open Skills and Skillabi | Lightcast; International | 2025 | Skill types, stable IDs and a dated changelog; a curriculum coverage score with the list of skills nothing teaches. | https://lightcast.io/blog/open-skills-taxonomy · https://lightcast.io/resources/blog/skillabi-press-release-june-3-2025 |
| LINKEDIN | LinkedIn Economic Graph: Skills on the Rise and Work Change | LinkedIn; International | 2025 | A three-signal rising-skill detector on ENEC's own data, and AI literacy separated from AI engineering. | https://economicgraph.linkedin.com/research |
| MCK-DELTA | McKinsey DELTAs (Distinct Elements of Talent) | McKinsey Global Institute; International (18,000 people, 15 countries) | 2021 | The inclusion rule as taxonomy governance, and "proficiency against needed" as the main chart. | https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work |
| ISO30414 | ISO 30414:2025 human capital reporting | ISO TC 260; International | 2025 | A Skills, Capabilities and Development disclosure pack where every metric has a definition, owner narrative, variance note and audit trail. | https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html |
| 1EDTECH | Open Badges 3.0, CLR 2.0 and CASE | 1EdTech; International | 2024 | A CLR-shaped learner record, credentials that point at a competency ID, and a CASE-shaped framework export. | https://www.1edtech.org/standards/open-badges · https://www.1edtech.org/standards/clr |
| SFIA9 | SFIA 9 (Skills Framework for the Information Age) | SFIA Foundation; International | 2024 | Generic level attributes across all skills, level essence lines, skills defined only at real levels, and a public change tracker. | https://sfia-online.org/en/sfia-9/sfia-9-release-notes |
| SSG-SF | SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks | SkillsFuture Singapore; Singapore | 2025 | A task layer between role and skill, AI exposure per task, role archetypes with ladder-rung protection, and a core-skills set. | https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf |
| SG-CAREER | Careers and Skills Passport, CareersFinder and Career Health SG | SSG, MOM, WSG; Singapore | 2024-2025 | A provenance badge on every record, curated sharing with expiry, adjacency moves backed by real transitions, and a visible career-health check. | https://www.myskillsfuture.gov.sg/csp · https://www.mom.gov.sg/newsroom/speeches/2025/0710-speech-by-min-at-career-health-summit-2025 |
| SG-JTM | Jobs Transformation Maps | Workforce Singapore; Singapore | 2025 | A per-role transformation page: technology drivers, tasks added or removed, the redesigned profile and a dated reskilling path. | https://wsg.gov.sg/for-employers/jobs-transformation-maps.html · https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2025/1104-written-answer-to-pq-on-update-on-jobs-transformation-maps |
| ENTITLE | SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK) | MOE/SSG Singapore; DfE England; Singapore / UK | 2024-2025 | A visible learning balance, an outcome-gated catalogue, protected study time, and a credit unit for every learning asset. | https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling · https://www.gov.uk/government/publications/lifelong-learning-entitlement-lle-overview/lifelong-learning-entitlement-overview |
| FSC | Future Skills Centre Impact Report 2025 | Future Skills Centre (ESDC-funded); Canada | 2025 | A pilots registry (hypothesis, comparison group, evaluator, published result including failures) and an adoption-rate KPI. | https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf |
| UPKEEP | Australia National Skills Taxonomy (ASC retired) and Korea NCS | Jobs and Skills Australia; MOEL Korea; Australia / Korea | 2024-2025 | Review dates and staleness flags, skills derived from artefacts already maintained, and an annual orphan-rate audit. | https://www.jobsandskills.gov.au/australian-skills-classification · https://moel.go.kr/english/news/moelNewsDetail.do?idx=3137 |
| JAHIZ | Jahiz federal future-skills platform | UAE Government Development and the Future Office + FAHR; UAE | 2022 | The four-group structure plus a nuclear fifth group, a wallet tied to the development plan, and a dated whole-workforce target. | https://wam.ae/en/details/1395303102696 · https://u.ae/en/information-and-services/jobs/training-and-development/Strategies-for-improving-digital-skills-and-eGovernment-literacy |
| UAE-NQF | UAE National Qualifications Framework and NQC work-experience recognition | National Qualifications Centre (MoHESR); UAE | 2024 / 2026 | An NQF level on every credential and learning asset, an RPL package NQC-recognised assessors can review, and ENEC as a pilot employer. | https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses · https://uaelegislation.gov.ae/en/legislations/2615/download |
| MOHRE | MoHRE occupational classification and skill levels | Ministry of Human Resources and Emiratisation; UAE | current (read 2026) | An occupation code and national skill level on every role, and a skill-level uplift metric. | https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme · https://gulfnews.com/uae/government/uae-workforce-jumps-124-in-2025-as-new-firms-surge-mohre-says-1.500416665 |
| NAFIS | Nafis and the Emirati Talent Competitiveness Council | ETCC + MoHRE; UAE | 2026 | Emirati readiness by competency for critical and future roles, plus retention at 12/24/36 months. | https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership · https://www.zawya.com/en/press-release/events-and-conferences/uaes-emiratisation-drive-enters-a-new-outcomes-era-eiojkgck |
| UAE-AI | UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative | UAE Government; DGE Abu Dhabi; UAE | 2025 | A dated AI-capability target, approved-use classes for AI tools, and intake-year baselines for new joiners. | https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027 · https://dge.gov.ae/en/what-we-do |
| IAEA-WFP | IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework | IAEA; International | 2011 (current reference) | Scenario bands rather than point estimates, a fill plan per gap, and a "why this competency exists" link to its activity. | https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf · https://www.iaea.org/sites/default/files/20/11/nicf.pdf |
| IAEA-1917 | IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities | IAEA; International | 2020 | A behavioural track with the same evidence model as technical skills, and situational judgement items for safety behaviours. | https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf |
| IAEA-AI | IAEA AI for nuclear energy ("Atoms for Algorithms") | IAEA; International | 2025 | An operational Nuclear + AI skill family: AI output verification and the duty to challenge it, twin validation, anomaly triage. | https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence · https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/ |
| OT-CYBER | IAEA NSS 42-G computer security and NICE Framework v2.0 OT role | IAEA; NIST/CISA; International / US | 2021 / 2025 | Stable statement IDs, and cyber hygiene for all staff while security roles stay at career-path level only. | https://www.iaea.org/node/97473 · https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering |
| NEA | OECD-NEA NEST Framework and Plan 2035 | OECD Nuclear Energy Agency; International (15 countries in NEST) | 2024-2025 | Fellowships inside real projects, an expert lecture library that doubles as knowledge capture, and a Future Leaders track. | https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf · https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development |
| UK-NUC | UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports | UK Government and industry; Sellafield with Digital Catapult; United Kingdom | 2024 (passport trial 2022) | A transferable-skills translator for career-changers, sector target tracking, and selectively disclosable passports. | https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce · https://www.digicatapult.org.uk/wp-content/uploads/2022/07/Digital_Catapult_Sellafield_DLT_Field_Labs_Report_Final-July-22-ver-2.pdf |
| SMR-WF | New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH) | OPG, GE Vernova Hitachi, Sask Polytech, NuScale, GIFEN; Canada / US / France | 2023-2025 | An SMR delta per existing role, cross-over courses, plant-literacy simulation for non-operators, and an annual job-by-job refresh. | https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/ · https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center · https://www.nucleareurope.eu/blog/highlight-of-the-month/match-program-a-tool-for-nuclear-capacity-building-in-france/ |
| NUC-NET | Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS | ENEN; Fortum/TVO/Uniper/Vattenfall; IAEA; KEPCO; EU / Nordics / International / Korea | 2019-2026 | Rolling micro-grants, multi-employer cohorts (modules + project + mentor), sponsored study with placement, and a nuclear-management competency model. | https://cordis.europa.eu/project/id/101061677 · https://www.fortum.com/careers/NNTP · https://www.iaea.org/node/136445 · https://www.iaea.org/node/17745 |
| ENERGY-JOBS | IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025 | IEA; IRENA with ILO; International | 2025 | External shortage lines beside internal numbers, an automation factor in demand, and a public skills-pledge mechanic. | https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025 · https://build-up.ec.europa.eu/en/resources-and-tools/publications/annual-review-2025-renewable-energy-and-jobs |
| AI-LIT | EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks | European Commission AI Office; UNESCO; EU / International | 2024-2026 | An AI-literacy register per AI system, provider vs deployer literacy, maturity labels, and a 4-dimension AI competency grid. | https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices · https://gcedclearinghouse.org/en/node/146447 |
| UAE-PEERS | ADNOC AI upskilling and EGA Academy | ADNOC; Emirates Global Aluminium; UAE | 2025 | AI learning whose output is a built artefact, AI-fundamentals coverage as a board KPI, and national trainee cohorts. | https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42 · https://www.wam.ae/en/article/blmzwis-ega-launches-ega-academy |
| CORP | Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials | AT&T; IBM; Schneider Electric; Unilever; Google; International | 2014-2025 | Honest role decline signals, a strategic badge tier with consequences, a time envelope for gigs, and market data separated from outcomes. | https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/ · https://workofthefuture-taskforce.mit.edu/document/2020-working-paper-qi-kochan · https://gloat.com/wp-content/uploads/Schneider-Electric-Gloat-Case-Study.pdf · https://services.google.com/fh/files/misc/new_google_career_certificates_impact_report.pdf |
| SKILLS-TECH | Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play | Vendors; International | 2024-2026 | Inferred-skill suggestions the person confirms, multi-source proficiency, adaptive assessment, and role-play practice with saved feedback. | https://www.techwolf.ai/customer-stories/workday · https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/ · https://workera.ai/skills-intelligence-platform · https://training.talent.linkedin.com/introducing-role-play-with-ai-coach |

Figures are as reported in the research packs; items the packs flag as secondary or unverified (for example WEF ranks 4-10, Deloitte multiples, vendor ROI claims) are not used anywhere in this plan.

## 5. Wave plan

| Wave | Theme of the wave | E1 | E2 | E3 | E4 | E5 |
|---|---|---|---|---|---|---|
| **A** | Enablers: one taxonomy spine | `foundation`: FS01, FS02 | `m17`: FS03 | `m11`: FS04 | `m01`: FS05 | `m26`: FS06 |
| **B** | Employee-facing future-skills core | `m28`: FS07, FS08 | `m29`: FS09, FS10 | `m30`: FS11, FS12 | `m21`: FS13, FS14 | `m18`: FS15, FS16 |
| **C** | Close the gaps: content, pathways, assessment | `m19`: FS17, FS18 | `m04`: FS19, FS20 | `m05`: FS21, FS22 | `m02`: FS23, FS24 | `m33`: FS25, FS26 |
| **D** | Mobility, credentials and governed AI use | `m20`: FS27, FS28 | `m34`: FS29, FS30 | `m17`: FS31, FS32, FS33 | `m18`: FS34, FS35 | `m29`: FS36, FS37 |
| **E** | Next-gen nuclear, energy transition, safety culture | `m31`: FS38, FS39, FS40 | `m32`: FS41, FS42, FS43 | `m24`: FS44, FS45 | `m22`: FS46, FS47, FS48 | `m08`: FS49 |
| **F** | Workforce strategy and analytics | `m35`: FS50, FS51 | `m07`: FS52, FS53 | `m16`: FS54, FS55 | `m25`: FS56, FS57 | `m33`: FS58, FS59 |
| **G** | Disclosure, national alignment, ecosystem | `m35`: FS60, FS61 | `m37`: FS62, FS63 | `m36`: FS64, FS65 | `m10`: FS66, FS67 | `m09`: FS68, FS69 |
| **H** | Signals, Emiratisation quality, reach | `m28`: FS70, FS71, FS72 | `m37`: FS73, FS74 | `src/shell`: FS75 | `m13`: FS76 | `m06`: FS77 |
| **I** | Entitlements, transitions, partnerships | `m34`: FS78, FS79 | `m29`: FS80 | `m30`: FS81 | `m36`: FS82, FS83 | `m17`: FS84 |

- **Wave A (6 features).** Everything later reads these: new modules, a sourced and attributed skills catalogue, honest skill states, one future-skill keyspace, 2030/2035 role profiles and a task layer with AI exposure.
- **Wave B (10 features).** The first things a person sees: what the skills are, how my role changes by 2030, my AI fluency, my readiness for the ADVANCE era, and future roles I can actually target.
- **Wave C (10 features).** The audit found tools that find gaps but almost nothing that closes them. This wave adds courses, pathways, academies, adaptive assessment and the core-skills framework.
- **Wave D (11 features).** Turn new skills into moves and recognition: future-skill gigs and secondments, RPL and NQF credit, new micro-credentials, a translator for career-changers, the AI-literacy register.
- **Wave E (12 features).** Domain depth: the SMR delta per role, plant literacy for everyone, CleanEnergyComp, localisation before 2030, future leadership and safety culture for an AI-augmented plant.
- **Wave F (10 features).** Leadership tools: the critical future-skills register, scenario bands per skill, automation in the outlook, taxonomy governance, and proof of which learning moves skills.
- **Wave G (10 features).** Outward-facing: the ISO 30414 pack, the national-strategy layer, the Al Dhafra regional plan, pledges, universities and suppliers.
- **Wave H (8 features).** Live signals (rising skills, hot technologies, inferred skills), Emirati readiness by competency, the future-skills wallet target, nudges, Dalil and students.
- **Wave I (7 features).** Longer-cycle mechanisms: a learning balance with protected time, verified external certificates, an automation gallery, transition plans, grants, consortium cohorts and team 2030 targets.

Each wave ends with an integration and QA step owned by the coordinator: merge the five branches (`--no-ff`, regenerate generated files with `npm run gen`), wire cross-feature hand-offs in the wave QA migration, run `npm run verify`, the PGlite validators, the route sweep and the E2E journeys, apply the SQL live, and deploy.

## 6. Feature cards (grouped by theme)

### TAX · Future-skills intelligence and taxonomy

#### FS01 · Future-skills scaffolding, benchmark registry and shared components
- **Wave / owner:** A · E1 · `foundation (src/routes, src/domain, src/auth, src/data/ext, src/ui)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco); OECD-PIAAC (OECD Survey of Adult Skills (PIAAC), Cycle 2, 2024, https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html); SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes)
- **For:** All engineers in waves B to I; admins; every reader of a future-skills page.
- **Problem:** The new work needs ten new modules, new policy resources and one consistent way to say which international benchmark a screen follows and where its source is. Without one landing first, every engineer would edit shared routing files.
- **What it does:**
  - Registers modules M28 to M37 once: ModuleId, MODULES, registry imports, empty routes.ts, i18n namespaces m28..m37 (EN and AR), schema blocks, migration slots and seed hooks under scripts/seed/ext.
  - Adds policy resources skills_taxonomy, ai_literacy, transformation, recognition, workforce_strategy, ecosystem and national_alignment, reusing existing roles; docs/RBAC.md regenerates.
  - Adds the kafaa_benchmarks reference table seeded with the 40 benchmarks in this plan (owner, year, source URLs, as-of, what we borrow, EN and AR).
  - Promotes two components to src/ui: <BenchmarkChip id> (name, year, source link, opens a drawer) and <BenchmarkLine> (a labelled comparison line on any score: OECD average, ENEC average, role target).
  - Adds src/domain/taxonomy.ts (import-free so seed builders can load it): reusability levels, skill types, lifecycle states, decay classes, levelEssence(), isPublishable().
  - Registers engine surfaces transform and assess with deterministic defaults and the existing disabled ModelGatewayEngine slot.
- **Data:** `kafaa_benchmarks` (id, name_en/ar, owner, country, year, urls[], borrow_en/ar, as_of, status); policy rows for the 7 new resources; no RPCs
- **RBAC:** kafaa_benchmarks: public R for published rows; frameworks W (admin) through the M16 frameworks page.
- **Acceptance:**
  - All 10 new modules register, every placeholder route renders in EN and AR, and the route sweep covers them without test edits.
  - All 40 benchmark rows carry at least one https source and an as-of date; check:public stays green.
  - <BenchmarkChip> and <BenchmarkLine> render correctly in RTL and follow the user's digit setting.
  - npm run verify is green and the migration validator shows no NEXUS object altered.
- **Depends on:** none

#### FS02 · Future-skills catalogue extension and taxonomy attributes
- **Wave / owner:** A · E1 · `foundation (src/data/ext F01 block, scripts/seed/ext)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco); LIGHTCAST (Lightcast Open Skills and Skillabi, 2025, https://lightcast.io/blog/open-skills-taxonomy); MCK-DELTA (McKinsey DELTAs (Distinct Elements of Talent), 2021, https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work); JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696)
- **For:** Everyone downstream; the skills council (FS54).
- **Problem:** The catalogue has 71 skills: 7 digital or AI, no transversal skills, no green skills, and none with a source, owner, version or lifecycle (audit gaps 2 to 5).
- **What it does:**
  - Adds columns to kafaa_skills: reusability (transversal, cross-sectoral, sector-specific, occupation-specific), skill_type (common, specialised, licence-like), lifecycle (emerging, growing, stable, declining, obsolete), decay_class (fast, standard, slow), owner_role, version, review_due, level_essence_en/ar, alt_labels_en/ar, future_group (Jahiz groups: digital, 10x, data_ai, new_economy, plus nuclear_excellence).
  - Seeds about 44 new skills in six areas: transversal (the WEF core skills written as nuclear behaviours: analytical thinking, systems thinking, resilience, curiosity and lifelong learning, creative thinking, technological literacy, leadership and social influence, environmental stewardship); ai_data (AI use, AI output verification, prompt and agent literacy, data engineering basics, plant-data quality, automation design, AR/VR use); green_energy (lifecycle carbon, GHG accounting basics, hydrogen and process-heat interfaces, grid integration, circularity and waste stewardship); advanced_reactor (SMR fundamentals, passive safety concepts, multi-module operations concepts, factory fabrication QA, advanced fuel-cycle awareness, fusion awareness); cyber_hygiene (all staff, career-safe: phishing, removable media, zone-and-conduit awareness only); digital_plant (digital I&C, robotics and remote inspection, digital procurement).
  - Back-fills all skills, old and new, with at least one source, an owner role, version 1, a review date, a lifecycle state and a level-essence line in EN and AR.
  - Enforces "obsolete, never delete" with a check and a test, following ESCO.
- **Data:** `kafaa_skills` additive columns; seed builder scripts/seed/ext/fs02-catalogue.mjs; F01 recomputeSkills re-run on the seed
- **RBAC:** Unchanged: skill definitions public R when published; person states keep the skills_profile rules.
- **Acceptance:**
  - The catalogue holds at least 110 skills, and 100% carry a source, owner, version, review date and lifecycle.
  - Every new skill has EN and AR names, a level-essence line and at least 2 alternative labels per language.
  - No cyber_hygiene skill references a security-restricted task or the SA-01 security area (unit test).
  - F01 recompute stays deterministic: the digest for the original 71 skills is unchanged.
- **Depends on:** FS01 (same engineer, lands first)

#### FS03 · Honest skill states: working decay, decay classes and confidence bands
- **Wave / owner:** A · E2 · `m17` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030)
- **For:** Every employee with a passport; managers; engine owners.
- **Problem:** The half-life weight shown to admins does nothing (TS and SQL hard-code 1,096 days); digital skills decay at the same rate as reactor physics; confidence is "max plus bonus" with no uncertainty; seeded micro-credential awards write no evidence.
- **What it does:**
  - Wires engine_settings.skills.weights.half_life_months into deriveSkillState and the SQL kafaa_skill_states_compute, with no hard-coded constant.
  - Adds per-class half-lives in engine settings (fast 18, standard 36, slow 60 months) and an area-to-class default map (digital and AI areas fast) that FS02's decay_class column overrides after merge.
  - Replaces "max plus bonus" with a calibrated blend: weight by basis (verified 1.0, evidenced 0.8, validated 0.6, claimed 0.3) with diminishing returns per extra independent source, returning a low/medium/high band and an interval.
  - The passport shows a multi-source record per skill (self, peer, manager, assessment, work evidence, each with date and provenance) and a "how sure are we" band; readiness in the Navigator shows the band.
  - Back-fills F01 credential evidence for the 106 seeded micro-credential awards (W5 open item).
- **Data:** `kafaa_person_skills` + confidence_band, conf_low, conf_high; engine_settings keys half_life_fast/standard/slow; recomputeSkills unchanged signature; validator scripts/validate/fs12-decay.mjs
- **RBAC:** Unchanged (skills_profile Own/Scope/Agg; setEngineWeights admin only, audited).
- **Acceptance:**
  - Changing half_life_months through setEngineWeights changes computed confidence identically in TS and SQL (PGlite proof).
  - A digital skill evidenced 30 months ago shows lower confidence than a reactor-physics skill of the same age.
  - Every person skill carries a band, and the Navigator readiness tile displays it.
  - Seeded awards now produce credential evidence rows, and recompute stays idempotent.
- **Depends on:** F01, F32

#### FS07 · Skills Catalogue Explorer
- **Wave / owner:** B · E1 · `m28 (Skills Intelligence)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes); ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf)
- **For:** Public visitors, students, employees, managers.
- **Problem:** No page lists the skills. /competencies stops at competency level, so nobody can see what "AI output verification" or "systems thinking" means at each level.
- **What it does:**
  - /skills (public): every published skill with filters for area, reusability, lifecycle, Jahiz group and "future skill"; EN and AR search over names and alternative labels.
  - /skills/:id: definition, level essence and descriptors, lifecycle chip, related roles now and in 2030, courses, pathways and credentials that build it, crosswalk tab (FS08) and sources with as-of dates.
  - Signed-in extras: "You hold this at L2 (verified)" from the passport, and "Add to my goals" (hands off to FS33 after D).
  - Obsolete skills are hidden by default and stay reachable by direct link with an "obsolete since" note.
- **Data:** reads `kafaa_skills`, role_profile_versions, courses, microcred_defs; no new tables
- **RBAC:** Public R on published skills; personal overlay skills_profile Own.
- **Acceptance:**
  - All published skills (110+) are listed with working filters, and an Arabic search such as "تحليل البيانات" finds the data-analysis skill.
  - Anonymous payloads carry no person data (check:public).
  - Every skill page shows at least one source with an as-of date.
- **Depends on:** FS01, FS02, FS05

#### FS08 · International crosswalk and machine-readable framework export
- **Wave / owner:** B · E1 · `m28 (Skills Intelligence)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco); SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes); ONET (O*NET Hot Technologies and Bright Outlook, 2026, https://onetcenter.org/bright.html); DIGCOMP (DigComp 2.2 / 3.0 digital competence framework, 2022 / 2025, https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en); 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges); OT-CYBER (IAEA NSS 42-G computer security and NICE Framework v2.0 OT role, 2021 / 2025, https://www.iaea.org/node/97473)
- **For:** Employees comparing their skills abroad, HR, universities, suppliers, auditors.
- **Problem:** No skill maps to any external framework, so ENEC data cannot be compared, exported or matched to external catalogues.
- **What it does:**
  - Adds kafaa_skill_alignments: skill, framework (ESCO, O*NET, SFIA 9, SkillsFuture TSC/CCS, DigComp, UNESCO AI, GreenComp, NICE, IAEA, UAE NQF, Lightcast), external code, external label, match type (exact, close, broad, partial), level map, source URL, as-of, reviewed_by.
  - Seeds at least one alignment per skill. External codes are stored only when copied from the source; otherwise the row is label-level with "code pending review", so no code is invented.
  - /skills/frameworks: coverage matrix (framework x area) and per-framework lists; crosswalk tab on each skill page with the match type explained.
  - Export of the published framework as CASE-shaped JSON and CSV, and admin editing at /admin/skills/alignments.
- **Data:** `kafaa_skill_alignments`; RPC saveAlignment (frameworks W; audited); export builder (pure TS)
- **RBAC:** Published alignments public R; edits frameworks W; auditor R.
- **Acceptance:**
  - At least 95% of skills have one or more alignments, and 100% of alignments cite a URL and as-of date.
  - The export validates against a CASE-shaped JSON schema in a unit test.
  - Rows not yet reviewed display "indicative" in EN and AR.
- **Depends on:** FS02

#### FS23 · Behaviourally anchored descriptors and generic level attributes
- **Wave / owner:** C · E4 · `m02` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf)
- **For:** Everyone reading a level; raters in check-ins; assessors.
- **Problem:** Level descriptors come from one sentence template, the 42 specialised skills have none, and there are no observable indicators.
- **What it does:**
  - Generic level attributes (autonomy, influence, complexity, knowledge, behaviours) applied across all skills, SFIA-style.
  - Per-skill descriptors with 2-4 observable indicators per level for every skill, defined only at the levels where the skill exists, with a published rationale.
  - Check-in raters (F10) see the indicators while rating.
- **Data:** `kafaa_level_attributes`; `kafaa_skill_descriptors` (skill, level, indicators EN/AR); RPC saveDescriptor (frameworks W; audited)
- **RBAC:** Public R when published; frameworks W.
- **Acceptance:**
  - Every skill has descriptors at each level where it exists, and none uses the old template sentence.
  - Indicators exist in EN and AR.
  - Check-in pages show indicators for the skill being rated.
- **Depends on:** FS02

#### FS70 · ENEC Skills on the Rise
- **Wave / owner:** H · E1 · `m28 (Skills Intelligence)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** LINKEDIN (LinkedIn Economic Graph: Skills on the Rise and Work Change, 2025, https://economicgraph.linkedin.com/research); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf)
- **For:** Employees; HR; L&D.
- **Problem:** Nobody can see which skills are accelerating inside ENEC.
- **What it does:**
  - Three internal signals: skills newly added to goals and profiles, skills held by recent hires, skills in new opportunities and role-profile versions; plus an annual manager pulse ("what share of your team's core skills will change by 2030").
  - A quarterly list with the method published, split into "in demand now" and "growing".
- **Data:** `kafaa_skill_signals`; `kafaa_manager_pulse`; rule risingSkills() TS = SQL
- **RBAC:** Staff R for the published list; Agg for the pulse.
- **Acceptance:**
  - Each listed skill shows which signals moved it.
  - Signals under 10 are suppressed.
  - The method page publishes how each signal is counted.
- **Depends on:** FS02, FS33

#### FS71 · Hot technologies and in-demand badges
- **Wave / owner:** H · E1 · `m28 (Skills Intelligence)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** ONET (O*NET Hot Technologies and Bright Outlook, 2026, https://onetcenter.org/bright.html)
- **For:** Employees; L&D.
- **Problem:** Tools and technologies that matter (plant historians, scripting, twin platforms, AR inspection) are not visible as a demand signal.
- **What it does:**
  - Generic technology tags (no vendor brands) counted across opportunities and role profiles; "hot across ENEC" separate from "in demand for your role", with published criteria.
- **Data:** `kafaa_technologies`; tag links
- **RBAC:** Staff R.
- **Acceptance:**
  - Criteria are published and badges reproduce from them.
  - No vendor brand name appears in a tag.
  - Past badge lists are kept per quarter.
- **Depends on:** FS05

#### FS72 · "Skills you may have" suggestions
- **Wave / owner:** H · E1 · `m28 (Skills Intelligence)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); LINKEDIN (LinkedIn Economic Graph: Skills on the Rise and Work Change, 2025, https://economicgraph.linkedin.com/research)
- **For:** Employees.
- **Problem:** Inference uses records only; adjacency, co-occurrence, xAPI, gigs and authored knowledge are ignored and the person is never asked.
- **What it does:**
  - Suggestions from skill adjacency, co-occurrence lift, xAPI statements, completed gigs and validated contributions, each with reasons.
  - Confirm, reject or "not me"; nothing becomes visible to a manager until the person confirms; confirmed suggestions become claimed evidence.
- **Data:** `kafaa_skill_suggestions`; RPC respondSuggestion
- **RBAC:** Own only until confirmed.
- **Acceptance:**
  - No suggestion is readable by a manager (RLS test).
  - An engine card and fairness snapshot exist for the surface.
  - A rejected suggestion does not return for 180 days.
- **Depends on:** FS03, F30

### AI · AI and digital literacy

#### FS09 · AI Fluency Ladder
- **Wave / owner:** B · E2 · `m29 (AI and Digital Fluency)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices); UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); LINKEDIN (LinkedIn Economic Graph: Skills on the Rise and Work Change, 2025, https://economicgraph.linkedin.com/research); DIGCOMP (DigComp 2.2 / 3.0 digital competence framework, 2022 / 2025, https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en)
- **For:** All staff; managers setting expectations; L&D.
- **Problem:** AI appears as 2 skills held by 3 people. There is no shared ladder that says what "good" looks like for an operator, an engineer or a manager in a plant where AI must be challenged, not obeyed.
- **What it does:**
  - /my/ai-fluency: four rungs, Aware, Practitioner, Builder, Assurer, across the four UNESCO dimensions (human-centred mindset, ethics and assurance, techniques and applications, system design), with plant examples such as "verifies an AI-generated procedure summary against the controlled document".
  - Shows my current rung from F01 evidence with reasons, the next step and the learning that gets me there; the same dimensions recur at deeper rungs (spiral progression).
  - Role targets per job family (for example operators: Practitioner plus the verification part of Assurer; engineers: Builder).
  - Keeps AI literacy (everyone) apart from AI engineering (specialists): engineering skills never raise the literacy rung.
- **Data:** `kafaa_ai_rungs` (rung, dimension, descriptors EN/AR, skill_ids); `kafaa_ai_role_targets` (family, rung, rationale); rule aiRung(person) TS = SQL
- **RBAC:** Own for my rung; ai_literacy Agg for HR (suppressed); rung definitions public R.
- **Acceptance:**
  - Every staff persona sees a rung with at least one reason linking to evidence.
  - All 20 job families have a role target.
  - An AI-engineering skill never changes the literacy rung (unit test).
  - No points, streaks or leaderboards.
- **Depends on:** FS02

#### FS10 · AI and Digital Fitness Check
- **Wave / owner:** B · E2 · `m29 (AI and Digital Fluency)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** DIGCOMP (DigComp 2.2 / 3.0 digital competence framework, 2022 / 2025, https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); OECD-PIAAC (OECD Survey of Adult Skills (PIAAC), Cycle 2, 2024, https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html)
- **For:** All staff; HR for the organisation indicator.
- **Problem:** There is no quick, repeatable way to know where someone stands on digital and AI skills, and no organisation number like "% above basic".
- **What it does:**
  - A 15-20 item adaptive diagnostic with a stop rule, over the DigComp areas (extra weight on safety and problem solving) and the AI dimensions; items in EN and AR, none touching plant security.
  - Result is scored server-side and written as assessment evidence capped at level 2; a benchmark line shows "ENEC average" and "role target".
  - Re-take each quarter; the trend line is the artefact.
  - Organisation indicator "% of staff above basic", suppressed under 10, on /workforce/ai-fluency.
- **Data:** `kafaa_fitness_items` (bank, difficulty, area, EN/AR); `kafaa_fitness_attempts`; RPC submitFitness (scores server-side); RPC fitnessStats (Agg)
- **RBAC:** Own attempts; ai_literacy Agg (HR); items W for training_manager.
- **Acceptance:**
  - A result is reached in 20 items or fewer, and scoring is identical in TS and SQL.
  - Evidence from the check never exceeds level 2.
  - The organisation indicator is suppressed under 10.
- **Depends on:** FS02

#### FS36 · AI-literacy register
- **Wave / owner:** D · E5 · `m29 (AI and Digital Fluency)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices); UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027)
- **For:** AI governance role; system owners; auditors.
- **Problem:** Nobody can show, per AI system, who uses it and whether they have the literacy it requires.
- **What it does:**
  - A register of AI systems (synthetic examples: document search assistant, SIMULATED predictive-maintenance advisor, Dalil) with provider or deployer role, required rung (FS09) per user group, coverage %, evidence and a maturity label: planned, partially rolled out, fully implemented.
  - An exportable compliance-style pack, labelled as voluntary alignment with the EU AI Act Article 4 practice repository.
- **Data:** `kafaa_ai_systems`; `kafaa_ai_system_users` (role group, required rung); RPC aiLiteracyCoverage (Agg)
- **RBAC:** ai_literacy W for admin/ai-governance; R auditor; coverage Agg suppressed.
- **Acceptance:**
  - Coverage is computed from FS09 rungs, not entered by hand.
  - Groups under 10 are suppressed.
  - The pack states that Kafa'a is not a regulator and the alignment is voluntary.
- **Depends on:** FS09

#### FS37 · Governed AI sandbox drills
- **Wave / owner:** D · E5 · `m29 (AI and Digital Fluency)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** All staff.
- **Problem:** People cannot practise the most important AI skill in a nuclear plant (catching a wrong output) without real systems.
- **What it does:**
  - Browser-only drills: compare an AI-styled summary against a controlled synthetic procedure and find the planted errors; follow a "challenge the output" protocol.
  - Scored with reasons; results write evidence for AI output verification at L1-L2.
  - No model call and no LLM key: drills are authored and scored deterministically.
- **Data:** `kafaa_ai_drills` (scenario, planted errors); `kafaa_ai_drill_attempts`; RPC submitDrill
- **RBAC:** Own; training_manager W.
- **Acceptance:**
  - Scoring is identical in TS and SQL.
  - All documents are synthetic and marked as such.
  - Evidence never exceeds L2.
- **Depends on:** FS09

#### FS40 · Digital-twin diagnosis drills
- **Wave / owner:** E · E1 · `m31 (Next-Gen Nuclear Readiness)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/)
- **For:** Engineers, maintenance staff, data-minded operators.
- **Problem:** Digital-twin skills are required by micro-credentials and gigs, but there is nowhere to practise diagnosis from model data.
- **What it does:**
  - Synthetic plant-model trend sets (seeded, no OT link) where the learner diagnoses a degrading component, chooses checks and justifies a conservative action.
  - Rubric scoring with reasons; results write evidence for digital-twin and plant-data skills.
- **Data:** `kafaa_twin_scenarios` (series json, faults); `kafaa_twin_attempts`; RPC submitTwinDrill
- **RBAC:** Own; training_manager W.
- **Acceptance:**
  - All series are synthetic and labelled SIMULATED.
  - Scoring is identical in TS and SQL.
  - A completed drill writes evidence for the twin and plant-data skills it names, capped at level 2.
- **Depends on:** FS02

#### FS76 · Dalil future-skills mode
- **Wave / owner:** H · E4 · `m13` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** Signed-in staff; anonymous visitors (public answers only).
- **Problem:** Dalil cannot answer "how will my role change?" or "what is the ESCO equivalent of this skill?".
- **What it does:**
  - New intents: how my role changes by 2030, which AI rung I need, what a skill means and its crosswalk, which pathway closes my gap; answers cite role maps, skill pages and sources.
  - An evaluation set added to the release gate.
- **Data:** intents and evaluation cases in m13/career
- **RBAC:** Signed-in for personal answers; anonymous gets public content.
- **Acceptance:**
  - The new evaluation set reaches at least 95% citation rate.
  - Security questions still decline.
  - Anonymous questions get public content with no personal data.
- **Depends on:** FS11, FS09, FS08

#### FS80 · Automation and agent gallery with builder credit
- **Wave / owner:** I · E2 · `m29 (AI and Digital Fluency)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** Staff who build; AI governance.
- **Problem:** Learning is credited for consuming content, never for building a useful, governed tool.
- **What it does:**
  - Staff submit a governed automation (purpose, data used, owner, AI-system register link); AI governance approves; an adoption counter tracks reuse.
  - Approved, adopted entries write builder evidence. Kafa'a never runs the automation.
- **Data:** `kafaa_automations`; RPCs submitAutomation, decideAutomation, adoptAutomation
- **RBAC:** ai_literacy W (submit), A (ai-governance), R (staff).
- **Acceptance:**
  - Nothing executes inside Kafa'a (no code storage, metadata only).
  - Evidence is written only after approval and first adoption.
  - Each entry links to its AI-system register row.
- **Depends on:** FS36

### ADV · Advanced reactors, SMR and fusion readiness

#### FS04 · One future-skill keyspace and a computed future-skills radar
- **Wave / owner:** A · E3 · `m11` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf); ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco)
- **For:** HR analysts and director; ADVANCE planners; every later future-skills feature.
- **Problem:** ADVANCE skills (as-*), radar and gap-plan keys (free strings) and the catalogue (sk-*) do not join; radar readiness is hand-entered; Scenario A and B hold identical numbers.
- **What it does:**
  - Adds kafaa_future_skill_map (key, sk_id, relation transfers/adapts/new, note) covering all 27 ADVANCE skills and every radar and gap-plan key; adv_skills gains sk_ids[].
  - Computes radar readiness from person_skills (share of staff at the target level, suppressed under 10) instead of hand-entered values; demand stays scenario-specific.
  - Corrects the seed so Scenario B carries its own sourced, SIMULATED demand assumptions.
  - Re-keys skill_gap_plans to sk-* ids and keeps the old key as a label.
  - Public /future pages keep their text; publicTextIsClean still passes.
- **Data:** `kafaa_future_skill_map`; future_skills.sk_id, skill_gap_plans.sk_id (additive); RPC futureRadar(scenario) (aggregate, suppressed)
- **RBAC:** Radar: workforce_analytics Agg (HR), R (auditor). Map: frameworks R, W for admin.
- **Acceptance:**
  - Every as-* id and every radar or gap-plan key resolves to at least one sk-* skill.
  - Scenario A and B differ for at least 6 of 8 radar skills.
  - Radar readiness equals the SQL aggregate on the seed (PGlite), and cells under 10 people are suppressed.
- **Depends on:** F01, F09

#### FS13 · Future Me readiness that learning can actually move
- **Wave / owner:** B · E4 · `m21` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Employees interested in the ADVANCE era.
- **Problem:** 18 of 27 ADVANCE skills are "new" with factor 0, so readiness tops out at about 20-30 and completing an ADVANCE track earns nothing.
- **What it does:**
  - New skills earn partial credit from learning evidence through the FS04 map: an ADVANCE track gives L1, a course L1-L2, an SMR-family skill from FS02 counts directly.
  - Shows the ceiling and "what raises it", plus a before/after preview for any planned course.
  - Keeps the SIMULATED label and the "no deployment decision" note.
- **Data:** readiness rule v2 (TS = SQL); engine card update for Future Me (F24)
- **RBAC:** skills_profile Own.
- **Acceptance:**
  - Completing c-adv-intro raises the index for every family by a deterministic amount.
  - An index of 100 is reachable through evidence alone.
  - TS and SQL agree on every seeded person (PGlite).
- **Depends on:** FS04, FS02

#### FS14 · Horizon lanes 2.0
- **Wave / owner:** B · E4 · `m21` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Employees; HR (interest as a demand signal).
- **Problem:** Five lanes miss robotics and remote inspection, AI-augmented maintenance, advanced manufacturing, hydrogen and industrial heat, nuclear-renewables integration and fusion; each cites only 1-4 sources.
- **What it does:**
  - Grows the horizon from 5 to 11 lanes, adding robotics and remote inspection, AI-augmented maintenance, advanced manufacturing and factory QA, hydrogen and industrial heat, nuclear-renewables system integration, and a fusion watch lane (awareness only).
  - Each lane lists its FS02 skills, courses and pathways, open gigs and at least 3 sources, placed now/next/later against ENEC milestones.
  - Interest toggles keep feeding training-needs forecasting (F26).
- **Data:** `kafaa_horizon_lanes` rows + sources; lane-skill links
- **RBAC:** skills_profile Own; lane interest aggregates Agg (suppressed).
- **Acceptance:**
  - 11 lanes, each with 3 or more sources and as-of dates.
  - All lane text passes publicTextIsClean.
  - Interest aggregates under 10 are suppressed.
- **Depends on:** FS02

#### FS38 · SMR delta overlay for every Barakah role
- **Wave / owner:** E · E1 · `m31 (Next-Gen Nuclear Readiness)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Operators, maintenance, engineering and support staff; ADVANCE planners.
- **Problem:** Nobody can see what would change in their own role on a small modular or advanced reactor fleet, so preparation is generic.
- **What it does:**
  - /my/next-gen: for my role, what changes on an SMR or advanced-reactor fleet (multi-module operation, passive safety, digital I&C, factory fabrication, different maintenance regimes), what stays the same, and the delta training.
  - A role-by-technology matrix for HR, built from FS05 2035 profiles and the six ADVANCE technology families.
  - Every page carries "no deployment decision implied" and shows no headcount or site.
- **Data:** `kafaa_smr_deltas` (role, tech family, changes EN/AR, skills, sources); rule deltaFor(role, tech)
- **RBAC:** Staff R; frameworks W; public summary R.
- **Acceptance:**
  - All 28 roles have a delta for at least the 3 most relevant technology families.
  - Every delta cites at least 2 sources.
  - publicTextIsClean passes on every delta.
- **Depends on:** FS05, FS04

#### FS39 · Plant literacy for everyone and a reference-plant log
- **Wave / owner:** E · E1 · `m31 (Next-Gen Nuclear Readiness)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Non-operators (engineering, HR, finance, supply chain, communications); students.
- **Problem:** Most staff never see how the plant behaves; simulator access is reserved for operators.
- **What it does:**
  - A browser "plant literacy" module: a schematic, deterministic explainer of heat, steam and safety functions with guided what-if steps (an NuScale E2-style outreach pattern), no plant data.
  - Reference-plant visits and simulator observation hours logged as evidence (validated by host).
- **Data:** static scenario definitions; `kafaa_plant_visits` (person, kind, host, date); RPC logVisit / confirmVisit
- **RBAC:** Staff R; Own logs; host A for confirmation.
- **Acceptance:**
  - The module runs offline with no network calls after load.
  - Confirmed visits write evidence; unconfirmed ones do not.
  - The module contains no real plant parameters and carries the SIMULATED chip on every screen.
- **Depends on:** FS02

### GRN · Energy transition and green skills

#### FS41 · CleanEnergyComp: ENEC's sustainability competence framework
- **Wave / owner:** E · E2 · `m32 (Energy Transition Skills)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696)
- **For:** All staff; leaders; communications and sustainability teams.
- **Problem:** Green and energy-transition skills exist only as horizon lane HZ-5; nuclear's sustainability story has no competence structure.
- **What it does:**
  - Twelve competences in four areas, authored with the GreenComp method: embodying values (public trust, stewardship), embracing complexity (systems thinking under uncertainty, lifecycle carbon), envisioning futures (net-zero pathways, the role of nuclear), acting (waste stewardship, circularity, advocacy with evidence).
  - Learning outcomes per competence, role targets, and links to Net Zero 2050 and the Jahiz New Economy group.
  - /skills/clean-energy (public) and my progress view.
- **Data:** `kafaa_cec_competences` (area, outcomes EN/AR, skill links)
- **RBAC:** Public R; Own progress.
- **Acceptance:**
  - Each competence lists learning outcomes in EN and AR and cites GreenComp.
  - Every competence links to at least one FS02 skill and one learning item.
  - Role targets exist for every job family, and public text passes publicTextIsClean.
- **Depends on:** FS02

#### FS42 · Energy-system integration pathway: hydrogen, process heat and grid
- **Wave / owner:** E · E2 · `m32 (Energy Transition Skills)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Engineers, strategy staff, interested employees.
- **Problem:** Nuclear's future roles in hydrogen, industrial heat and grid integration have no learning route.
- **What it does:**
  - An awareness-to-practitioner pathway (FS17 format) with curated sources, gigs and the matching horizon lane.
  - A short explainer per value chain with sourced facts (no ENEC project claims).
- **Data:** pathway and resource rows; `kafaa_value_chains` (facts, sources)
- **RBAC:** Staff R.
- **Acceptance:**
  - Every fact carries a source and an as-of date.
  - Copy passes publicTextIsClean (no project or site claims).
  - The pathway shows its envelope and weekly hours like every other pathway.
- **Depends on:** FS17, FS19

#### FS43 · ESG and GHG literacy for managers
- **Wave / owner:** E · E2 · `m32 (Energy Transition Skills)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** Managers; finance and reporting staff.
- **Problem:** Managers increasingly report on sustainability and human capital but have no shared baseline.
- **What it does:**
  - A short pathway on GHG accounting basics, sustainability and human-capital reporting concepts, with a micro-credential route.
- **Data:** pathway rows; credential criteria
- **RBAC:** Staff R.
- **Acceptance:**
  - The pathway is completable in under 10 hours with a stated weekly cost.
  - All content is sourced.
  - Completion counts toward the matching micro-credential criteria.
- **Depends on:** FS17

### HUM · Human and leadership skills (critical core skills)

#### FS25 · Nuclear Critical Core Skills
- **Wave / owner:** C · E5 · `m33 (Human Skills Studio)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); MCK-DELTA (McKinsey DELTAs (Distinct Elements of Talent), 2021, https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work)
- **For:** All staff; managers; leadership programmes.
- **Problem:** The only behavioural skills are safety-culture, leadership and HU ones; the future-of-work core skills have no home.
- **What it does:**
  - A 16-skill core set in three clusters (thinking critically, interacting with others, staying relevant), written for a nuclear plant: questioning attitude, conservative decision-making, procedure use and knowing when to stop, peer checking, communication under stress, learning agility, cross-cultural working, systems thinking, resilience and more.
  - Each mapped to INPO traits already in M08, the WEF core skills, LifeComp and SkillsFuture CCS; wellbeing treated as an outcome, not a skill (SSG 2025 review).
  - /my/core-skills shows my evidence per core skill and role targets.
  - The inclusion rule is applied: a core skill exists only if it needs its own development and assessment approach.
- **Data:** `kafaa_core_skills` (cluster, mappings, descriptors); links to FS02 transversal skills
- **RBAC:** Definitions public R; Own for my view; Agg for HR.
- **Acceptance:**
  - Each of the 16 skills cites at least 2 benchmark mappings.
  - Every core skill has a development route and an assessment route.
  - No wellbeing competency is added.
- **Depends on:** FS02

#### FS26 · Situational judgement practice for core skills
- **Wave / owner:** C · E5 · `m33 (Human Skills Studio)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf); MCK-DELTA (McKinsey DELTAs (Distinct Elements of Talent), 2021, https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work)
- **For:** Employees; leadership programme participants.
- **Problem:** Behavioural competence is rated, not practised or assessed.
- **What it does:**
  - A bank of at least 40 situational judgement items in EN and AR (conservative decisions, questioning, raising concerns, teamwork under pressure).
  - Scored against an expert key with explanations; for development only, never gating; trend over time.
- **Data:** `kafaa_sjt_items`; `kafaa_sjt_attempts`; RPC submitSjt
- **RBAC:** Own; training_manager W for items; Agg for HR.
- **Acceptance:**
  - Every item has an expert rationale in both languages.
  - Results never appear in talent review (RLS test).
  - No gamification.
- **Depends on:** FS25 (same engineer)

#### FS46 · Future leadership behaviours in the 360
- **Wave / owner:** E · E4 · `m22` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Leaders; HR; raters.
- **Problem:** The 8-behaviour leadership 360 covers nothing about leading digital change, AI-augmented teams, innovation or inclusion.
- **What it does:**
  - Adds four behaviours with anchors: leading digital change, leading AI-augmented teams (including when to override a tool), intrapreneurship (EntreComp), inclusion.
  - Programme content and coach cards for each; aggregate view by programme (suppressed).
- **Data:** leadership behaviour rows; 360 form version 2
- **RBAC:** Existing F16 rules.
- **Acceptance:**
  - Old 360 results stay readable under version 1.
  - Aggregates under 10 are suppressed.
  - Each new behaviour has anchors at every rating point in EN and AR.
- **Depends on:** F16

#### FS47 · Future Leaders track: nuclear management competence
- **Wave / owner:** E · E4 · `m22` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** High-potential staff; leadership academy.
- **Problem:** Leaders need policy, economics, stakeholder and international competence, not only technical depth.
- **What it does:**
  - A nuclear-management competency model (INMA pattern): safety culture leadership, regulatory affairs literacy, project and cost control, stakeholder and international affairs, knowledge management.
  - A cohort track with nomination, modules, a policy project and links to external programmes (NEA NextGen summer school, IAEA management schools).
- **Data:** competency rows; programme and cohort rows
- **RBAC:** Existing F16 rules; nomination by HR.
- **Acceptance:**
  - Each competency has descriptors and a learning route.
  - External programmes are listed with sources and dates.
  - Nomination and selection go through RPCs with an audit row; statistics under 10 are suppressed.
- **Depends on:** F16

#### FS48 · Women in future nuclear skills
- **Wave / owner:** E · E4 · `m22` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** Women in ENEC; mentors; programme owners.
- **Problem:** Women are about a fifth of the nuclear workforce internationally; mentoring, placements and sponsored study for future skills are not organised.
- **What it does:**
  - Mentor circles, visiting-professional placements (Lise Meitner pattern) and sponsored study with a placement (MSCFP pattern).
  - Pipeline metrics (participation, completion, progression) shown only as suppressed aggregates.
- **Data:** programme rows; F13 mentoring circle type
- **RBAC:** Opt-in; Agg only for HR.
- **Acceptance:**
  - Gender never enters any ranking (existing protected-input test extended).
  - Every aggregate cell under 10 is suppressed.
  - Participation is opt-in and can be withdrawn without trace in any ranking.
- **Depends on:** F13, F16

#### FS58 · Adaptive problem-solving practice
- **Wave / owner:** F · E5 · `m33 (Human Skills Studio)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** OECD-PIAAC (OECD Survey of Adult Skills (PIAAC), Cycle 2, 2024, https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf)
- **For:** All staff.
- **Problem:** Changing situations (an outage schedule slip, conflicting data, a supply delay) demand a skill nobody measures.
- **What it does:**
  - PIAAC-style scenarios where information changes mid-task and the learner must revise the plan (no plant-security content).
  - Scored on its own scale for development, with a benchmark line.
- **Data:** `kafaa_aps_scenarios`; `kafaa_aps_attempts`; RPC submitAps
- **RBAC:** Own; Agg for HR.
- **Acceptance:**
  - Every scenario has at least one mid-task change.
  - Results never gate a qualification.
  - Each result shows a benchmark line and the scale definition.
- **Depends on:** FS25

#### FS59 · Role-play practice library with saved feedback
- **Wave / owner:** F · E5 · `m33 (Human Skills Studio)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf)
- **For:** All staff; supervisors; trainees.
- **Problem:** Hard conversations are practised rarely; LinkedIn's role-play does not even keep the feedback.
- **What it does:**
  - ENEC-authored scenarios: pre-job brief, shift turnover, raising a concern to a senior, regulator-style interview practice, a knowledge-transfer session, coaching a peer on an AI output.
  - Deterministic rubric (extends F37 role-play); feedback is saved privately and can be attached as evidence after a reviewer validates it.
- **Data:** `kafaa_roleplay_scenarios`; `kafaa_roleplay_sessions` (Own); RPC attachRoleplayEvidence
- **RBAC:** Own; reviewer A for attachment.
- **Acceptance:**
  - Feedback history persists and is visible only to its owner.
  - Speak-up topics route to the existing channel and are never stored.
  - Every scenario has a published rubric in EN and AR.
- **Depends on:** FS25, F37

### NKS · Nuclear knowledge and safety culture of the future

#### FS44 · Expert lecture library and knowledge that counts as evidence
- **Wave / owner:** E · E3 · `m24` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday)
- **For:** Experts; learners; knowledge managers.
- **Problem:** Knowledge assets, community posts and expert sessions do not feed anyone's skill evidence, so experts get no recognition and gaps stay hidden.
- **What it does:**
  - A lecture library (Plan 2035 pattern) of recorded expert talks (synthetic metadata), each linked to skills and to the KLRA position it protects.
  - Authored assets and delivered sessions write "contribution" evidence once a reviewer validates them.
- **Data:** `kafaa_lectures`; skill_evidence kind "contribution" (additive); RPC validateContribution
- **RBAC:** knowledge R; reviewer A.
- **Acceptance:**
  - Validated contributions recompute skills; unvalidated ones do not.
  - No security-restricted topic can be published (refusal).
  - Each lecture links at least one skill and the KLRA position it protects, where one exists.
- **Depends on:** F21, FS02

#### FS45 · Localisation countdown to 2030
- **Wave / owner:** E · E3 · `m24` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Training managers; HR director; knowledge managers.
- **Problem:** Some qualifications and programmes are still delivered or signed off by foreign partners, and there is no view of when UAE instructors take each one over.
- **What it does:**
  - For each programme or qualification delivered by a partner: the UAE instructor readiness (from F31), target transfer date (no later than 2030), status and risk.
  - Links to the F22 handover board and the F31 instructor pipeline.
- **Data:** `kafaa_localisation_items` (programme, partner, target, status); RPC setLocalisationStatus (training_manager)
- **RBAC:** knowledge R; training_manager W; auditor R.
- **Acceptance:**
  - Every partner-delivered programme in the seed appears with a date.
  - Readiness is computed from F31, not entered.
  - Items past their target date are flagged and appear on the F22 handover board.
- **Depends on:** F22, F31

#### FS49 · Safety culture for an AI-augmented plant
- **Wave / owner:** E · E5 · `m08` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** All staff; HU and safety-culture leads.
- **Problem:** Safety-culture content does not yet address automation bias, over-reliance on tools or how a questioning attitude applies to AI outputs.
- **What it does:**
  - Extends questioning attitude and conservative decision-making with AI and automation examples.
  - HU tool cards in EN and AR: automation bias, mode confusion, over-reliance, verifying a tool against the controlled source; links to FS37 drills.
  - A sourced set of international operating-experience lessons on automation and digital systems.
  - No telemetry is added near speak-up.
- **Data:** hu_tools rows; oe_lessons rows (sourced)
- **RBAC:** Existing M08 rules.
- **Acceptance:**
  - Every lesson carries a public source and date.
  - The speak-up network check stays green.
  - Each HU tool card exists in EN and AR and links at least one drill or lesson.
- **Depends on:** FS37

### MOB · Career mobility and role transformation

#### FS05 · Future role profiles and 2030/2035 role horizons
- **Wave / owner:** A · E4 · `m01` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** SG-JTM (Jobs Transformation Maps, 2025, https://wsg.gov.sg/for-employers/jobs-transformation-maps.html); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Employees, managers, career and workforce planners; the Navigator, Roadmap, Marketplace and outlook.
- **Problem:** The 11 concept future roles have no requirements or path edges, and the 28 role profiles describe today only: digital is required by 4 roles and AI by 2.
- **What it does:**
  - Adds kafaa_role_profile_versions (role, horizon now/2030/2035, skill and competency requirements with level and importance, rationale, sources, status draft/published).
  - Seeds 2030 and 2035 versions for all 28 roles, labelled "planning assumption, no deployment decision implied" (for example operators gain plant-data literacy L2 and AI output verification L2; maintenance gains remote inspection and predictive-maintenance data interpretation).
  - Gives each of the 11 concept future roles a profile and 1 to 3 inbound career_paths edges of a new kind "future".
  - Adds a "Now, 2030, 2035" tab on /careers/:role (public shows published versions only, never headcount or sites).
- **Data:** `kafaa_role_profile_versions`; career_paths.kind + "future" (additive enum); job_roles.lifecycle (current/concept); RPC saveRoleProfileVersion (frameworks W; audited; ledger on publish)
- **RBAC:** Published versions public R; drafts frameworks W (admin, training_manager); auditor R.
- **Acceptance:**
  - 28 of 28 roles have a 2030 version; 11 of 11 future roles have at least 4 requirements and at least 1 inbound edge.
  - findPaths reaches every future role from at least one current role.
  - All public text passes publicTextIsClean (no headcount, site or deployment wording).
  - Security, safeguards and cyber roles carry path-level requirements only.
- **Depends on:** M01, F01

#### FS06 · Task layer with AI exposure and change horizon
- **Wave / owner:** A · E5 · `m26` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** OECD-AICI (OECD AI Capability Indicators, 2025, https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); ONET (O*NET Hot Technologies and Bright Outlook, 2026, https://onetcenter.org/bright.html)
- **For:** SAT analysts and training managers; feeds FS11, FS12, FS52 and FS81.
- **Problem:** The 95 JTA tasks carry no automation or AI-augmentation exposure and no change horizon, so nothing can say how a role's work will change.
- **What it does:**
  - Adds to kafaa_jta_tasks: ai_capability_needed (OECD five-level rating on the relevant dimensions), exposure (augment, automate_partly, human_core), change_horizon (now, 2030, 2035), tech_driver (digital I&C, AI assistance, robotics, SMR design, digital twin, none) and task-to-skill links for every non-restricted task.
  - Adds a pure rule exposureOf(task) that compares the AI capability level with the human requirement and returns an augmentable flag with reasons (TS and SQL).
  - Adds a Future column and filter to /training/sat; every change writes the SAT change log.
  - Security-restricted tasks are never scored, returned or shown.
- **Data:** `kafaa_jta_tasks` additive columns; `kafaa_task_skill_links` rows for JTA tasks; RPC setTaskFuture (sat W, audited); rule exposureOf TS = SQL
- **RBAC:** sat R (instructors, auditors), W (training_manager, SAT analysts).
- **Acceptance:**
  - All non-restricted JTA tasks are rated; restricted tasks have null values and are never returned.
  - exposureOf gives identical results in TS and SQL on the seed (PGlite).
  - Each edit writes one SAT change-log row and one audit row.
- **Depends on:** F27

#### FS11 · My Role in 2030: Role Transformation Maps
- **Wave / owner:** B · E3 · `m30 (Role Transformation)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** SG-JTM (Jobs Transformation Maps, 2025, https://wsg.gov.sg/for-employers/jobs-transformation-maps.html); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** Every employee; managers; HR; public visitors (summary only).
- **Problem:** Nothing shows how a current role changes by 2030 or 2035: which tasks grow, shrink or are augmented, which skills are added, and how long it takes me to get ready.
- **What it does:**
  - /my/role-2030: for my role, the technology drivers, tasks that grow, shrink or are augmented (FS06), skills added (2030 version minus today, FS05), a bridge curriculum, and my time-to-ready from my own gaps.
  - A milestone timeline (OSSA support ending around 2030, ADVANCE decision gates) with "no deployment decision implied".
  - An archetype tag per role (Mastery Builder, Analytical Specialist, Human Connector) with what it means for learning.
  - /careers/:role/transformation (public summary, no numbers) and /workforce/transformation (HR overview by family).
- **Data:** `kafaa_role_transformations` (role, drivers, archetype, summary EN/AR, status); rule transformRole() from FS05 and FS06 (TS = SQL); RPC publishTransformation (frameworks W; ledger)
- **RBAC:** transformation R for staff; published summary public R; W for training_manager and HR director.
- **Acceptance:**
  - All 28 roles have a map; my time-to-ready lists the gaps it is based on.
  - Public views pass publicTextIsClean and show no headcount.
  - Security roles show path-level content only.
- **Depends on:** FS05, FS06

#### FS12 · Task exposure view: what the tool will do, what you will still own
- **Wave / owner:** B · E3 · `m30 (Role Transformation)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); OECD-AICI (OECD AI Capability Indicators, 2025, https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** Employees; managers; HR planners.
- **Problem:** AI exposure is either ignored or presented as a threat score; neither helps a person decide what to learn.
- **What it does:**
  - For each role, tasks grouped in three bands (AI-assisted, partly automatable, human core) with the OECD capability reason for each.
  - "Skills that complement AI" for my role: the human-core skills that grow in value.
  - HR aggregate of exposure by job family, suppressed under 10.
  - A copy check refuses wording such as "replace" or "redundant" in EN and AR.
- **Data:** reads FS06 task attributes; RPC exposureAggregate (Agg, suppressed)
- **RBAC:** Staff R for role views; transformation Agg for HR.
- **Acceptance:**
  - Every task band shows a reason.
  - Aggregates under 10 people are suppressed.
  - The copy-check word list blocks the banned wording in both languages (unit test).
- **Depends on:** FS06

#### FS15 · Future roles in the Navigator and Roadmap
- **Wave / owner:** B · E5 · `m18` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** Employees; managers in career conversations.
- **Problem:** Nobody can shortlist a future role, see readiness for it or build a roadmap to it.
- **What it does:**
  - /my/career lists concept future roles next to current ones, with readiness against their FS05 profiles.
  - Roadmaps can target a concept role, under a banner: "concept role, no vacancy and no deployment decision".
  - Transition evidence on each move: how many colleagues made it and the median months (suppressed under 10).
- **Data:** reads FS05; engine context extension; F24 fairness card updated
- **RBAC:** skills_profile Own; Scope for managers.
- **Acceptance:**
  - Persona k-ro can shortlist a concept role and build a roadmap to it.
  - Readiness uses the FS05 profile and shows its reasons.
  - Transition counts under 10 are suppressed.
- **Depends on:** FS05

#### FS16 · Role outlook labels with published criteria
- **Wave / owner:** B · E5 · `m18` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** ONET (O*NET Hot Technologies and Bright Outlook, 2026, https://onetcenter.org/bright.html); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030)
- **For:** Employees, students, managers.
- **Problem:** Career pages do not say which roles are growing or changing, and any label without published criteria would not be trusted.
- **What it does:**
  - Each role gets a Growing, Stable or Changing label from the F35 outlook and the FS05 change size.
  - /careers/outlook-criteria publishes the thresholds; past labels are kept per year.
  - Public pages show the label only; staff see the components.
- **Data:** `kafaa_role_outlook_labels` (role, year, label, components); rule outlookLabel() TS = SQL
- **RBAC:** Public R for labels; components staff R.
- **Acceptance:**
  - The criteria page lists every threshold.
  - Labels reproduce exactly from the rule.
  - No headcount appears on public pages.
- **Depends on:** FS05, F35

#### FS27 · Future-skills gig channel with a time envelope
- **Wave / owner:** D · E1 · `m20` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Employees; managers; project owners.
- **Problem:** About 2 of 25 opportunities build future skills, and line-manager release per task blocks participation.
- **What it does:**
  - Five channels: ADVANCE study support, digital innovation, governed AI pilots, data clean-up, knowledge capture; at least 12 seeded future gigs.
  - A time envelope (for example up to 10% of time for a quarter) approved once by the line manager (maker-checker), instead of per task.
  - Completed gigs write evidence against the posted skills.
- **Data:** opportunities.channel (additive); `kafaa_time_envelopes` (person, pct, period, approver); RPC approveEnvelope
- **RBAC:** opportunities R/Own/W as today; envelope approval by line manager in scope.
- **Acceptance:**
  - At least 12 open future gigs across the 5 channels.
  - An approved envelope lets applications skip per-gig release while within the limit.
  - Completion writes evidence (existing F08 path).
- **Depends on:** FS02, F08

#### FS28 · Future-role rotations and external secondments
- **Wave / owner:** D · E1 · `m20` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/)
- **For:** Employees; HR; host organisations.
- **Problem:** No rotation targets future roles, and outbound secondments (vendor, university, IAEA, partner utility) are not tracked.
- **What it does:**
  - Rotation templates aimed at future roles: digital twin rotation, data office rotation, ADVANCE study team (career-level only).
  - An external secondment object: host, objectives, duration, supervisor, and a return-and-transfer obligation (a knowledge-capture task due within 60 days of return).
- **Data:** rotation_templates rows; `kafaa_secondments`; RPC planSecondment / closeSecondment
- **RBAC:** opportunities rules; HR A for secondments.
- **Acceptance:**
  - At least 3 future-role templates are published.
  - Closing a secondment creates the knowledge-capture task.
  - No security-area placements are offered.
- **Depends on:** FS05, F15

#### FS33 · Skills I want to grow
- **Wave / owner:** D · E3 · `m17` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday)
- **For:** Employees; managers (opt-in).
- **Problem:** Aspirations exist only at role level (F12) and as technology interest (F09), not per skill with a date.
- **What it does:**
  - Skill-level goals with a target level and date, set from the passport or a skill page.
  - Goals feed the Coach (weight alongside role targets) and later the digest; manager visibility is opt-in.
- **Data:** `kafaa_skill_goals`; RPC setSkillGoal
- **RBAC:** Own; Scope only when shared.
- **Acceptance:**
  - A goal changes the Coach ranking with a "your goal" reason.
  - Managers see goals only when the person shares them (RLS test).
  - Goals appear in EN and AR on the passport with their target date, and a goal can be withdrawn at any time.
- **Depends on:** FS02, F07

#### FS34 · Transferable-skills translator for career-changers
- **Wave / owner:** D · E4 · `m18` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco)
- **For:** Public career-changers (oil and gas, aviation MRO, military technicians, utilities, chemical process); staff in other functions.
- **Problem:** Kafa'a serves incumbents; it has nothing for people who are not nuclear yet, though France estimates one in two needed by 2030 is not yet in the industry.
- **What it does:**
  - /careers/translate (public, nothing stored): pick a current occupation from an ESCO-aligned list, get the nearest ENEC roles, the delta skills and a bridging route with duration (cross-over courses from FS19).
  - Staff version uses my own passport instead of the occupation template.
- **Data:** `kafaa_occupation_templates` (ESCO-aligned skill sets); rule translate() TS = SQL
- **RBAC:** Public route stores nothing; staff variant skills_profile Own.
- **Acceptance:**
  - The anonymous run performs no write and no storage (unit test spies on RPCs and Storage).
  - Each result lists its delta skills and bridging items with reasons.
  - At least 8 source occupations are available, each with an ESCO-aligned skill set and a cited source.
- **Depends on:** FS08, FS05

#### FS35 · Career Health check (Assess, Chart, Execute)
- **Wave / owner:** D · E4 · `m18` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/)
- **For:** Employees; career coaches.
- **Problem:** People cannot see whether their skills are current, broad enough or exposed to change, and nothing prompts a conversation before it is urgent.
- **What it does:**
  - /my/career/health: five visible components (skill currency, breadth, recency of learning, mobility options, change exposure from FS11).
  - Assess, Chart, Execute steps that end in a booked career conversation (F12) and a plan.
  - Own-only; never shown to managers or used in talent review.
- **Data:** rule careerHealth() TS = SQL; `kafaa_health_snapshots` (Own)
- **RBAC:** skills_profile Own only.
- **Acceptance:**
  - All five components are shown with their inputs; there is no single hidden score.
  - A manager cannot read another person's health snapshot (RLS test).
  - The Execute step books a career conversation through the existing F12 RPC.
- **Depends on:** FS03, FS11

#### FS81 · Transition plans and ladder-rung protection
- **Wave / owner:** I · E3 · `m30 (Role Transformation)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); SG-JTM (Jobs Transformation Maps, 2025, https://wsg.gov.sg/for-employers/jobs-transformation-maps.html); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** Employees in changing roles; HR; training managers.
- **Problem:** When AI takes over junior tasks, people lose the practice that builds judgement, and role changes are not managed as investments.
- **What it does:**
  - A transition plan object (SIMULATED HR): protected role, retraining plan, target role and review dates for people whose role is changing.
  - A ladder-rung alert: for Mastery Builder roles, when FS06 shows junior tasks becoming automated, the training plan must add synthetic practice (simulator, OJT repetitions).
- **Data:** `kafaa_transition_plans`; rule rungAlert() TS = SQL
- **RBAC:** transformation A (HR); Own for the person.
- **Acceptance:**
  - Every alert names the tasks and the practice added.
  - Plans are visible to the person and HR only.
  - Plans are labelled SIMULATED and carry review dates.
- **Depends on:** FS11, FS06

### LRN · Learning that closes future-skill gaps

#### FS17 · Future-skill learning pathways
- **Wave / owner:** C · E1 · `m19` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** ENTITLE (SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK), 2024-2025, https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/); LIGHTCAST (Lightcast Open Skills and Skillabi, 2025, https://lightcast.io/blog/open-skills-taxonomy)
- **For:** Employees; the Coach; managers.
- **Problem:** There are no levelled pathways per future skill; learners must assemble scattered items with no idea of the weekly time cost.
- **What it does:**
  - A pathway per future skill and level (L1 to L3): digital learning, applied practice (gig, OJT, sandbox) and an assessment in one sequence.
  - Each pathway states a 3-6 month envelope, a weekly hour cost and how long colleagues took (suppressed under 10).
  - Steps resolve content at run time from any item that teaches the skill at that level, so no code depends on FS19; a step with no content shows "requested" and feeds the FS57 gap backlog.
  - The Coach ranks pathways against my 2030 role gaps as well as today's.
- **Data:** `kafaa_pathways` (skill, level, envelope, weekly_hours); `kafaa_pathway_steps` (kind, resolver); rule resolvePathway() TS = SQL
- **RBAC:** Staff R; skills_profile Own for progress; training_manager W.
- **Acceptance:**
  - Every future skill has an L1 pathway, and every pathway shows its envelope and weekly hours.
  - Coach cards for pathways carry reasons.
  - Peer completion times under 10 are suppressed.
- **Depends on:** FS02, FS05

#### FS18 · Curated, outcome-gated external catalogue
- **Wave / owner:** C · E1 · `m19` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** ENTITLE (SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK), 2024-2025, https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling); NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Employees; L&D.
- **Problem:** There is no external content: IAEA e-learning, World Nuclear University, NEA, ENEN or reputable AI courses.
- **What it does:**
  - Source-linked external resources (title, provider, hours, cost band, language, skills taught, as-of), each admitted against published criteria (relevance, provider standing, assessment, language).
  - Shown in the Coach and in pathways with an "external" chip; completions recorded through xAPI as "experienced" with self-declared evidence until verified (FS79).
- **Data:** `kafaa_external_resources`; `kafaa_catalogue_criteria`
- **RBAC:** Staff R; training_manager W.
- **Acceptance:**
  - Every external item cites its provider URL and an as-of date.
  - Items failing the criteria cannot be published (RPC refusal).
  - Self-declared completions are labelled and never become verified evidence.
- **Depends on:** FS02, F30

#### FS19 · Future-skills course pack
- **Wave / owner:** C · E2 · `m04` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42); ENTITLE (SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK), 2024-2025, https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling)
- **For:** All staff; instructors.
- **Problem:** Micro-credentials and gigs ask for data, scripting, digital-twin and remote-operations skills that no course teaches; future-skills content is 3 courses of 2-4 h.
- **What it does:**
  - Adds about 18 modular courses (60 hours or less each), with objectives linked to skills: plant-data analysis, scripting basics, digital-twin fundamentals, remote and autonomous operations oversight, AI output verification, governed prompt and agent use, cyber hygiene for all staff, SMR fundamentals, passive safety concepts, factory fabrication QA, hydrogen and process heat, GHG basics, systems thinking, resilience through change, creative problem solving, data quality for plant records, AR/VR for maintenance, digital procurement.
  - Cross-over versions of SMR fundamentals and plant literacy for adjacent industries (used by FS34).
  - Every course lists sources and is marked SIMULATED content where it is a demo outline.
- **Data:** courses, course_modules rows (M04); objective-skill links
- **RBAC:** Existing M04 rules.
- **Acceptance:**
  - Each of the 6 skills held by nobody gains at least one course.
  - Every course links at least one skill at a stated level.
  - The cyber hygiene course contains no security-restricted content (copy and link check).
- **Depends on:** FS02

#### FS20 · Future-skills academies and cohorts
- **Wave / owner:** C · E2 · `m04` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** Selected employees; programme owners; mentors.
- **Problem:** There are no cohort programmes for AI, digital twins or SMR fundamentals, and no standard structure that makes cohorts comparable.
- **What it does:**
  - Four academy programmes: AI Academy, Digital Twin Bootcamp, SMR Fundamentals cohort, Energy Transition cohort.
  - Each uses the module + project + mentor template from the Nordic trainee programme; the capstone project writes evidence when signed off.
  - Nomination, cohort, progress and alumni views reuse M04 cohorts.
- **Data:** programmes and cohort rows; `kafaa_cohort_capstones` (person, project, reviewer, result); RPC signoffCapstone
- **RBAC:** Existing M04 cohort rules; reviewer A for capstones.
- **Acceptance:**
  - Each academy lists modules, a project and a mentor role.
  - A signed-off capstone writes evidence and recomputes skills.
  - Cohort statistics under 10 are suppressed.
- **Depends on:** FS02

#### FS21 · Adaptive future-skills assessment
- **Wave / owner:** C · E3 · `m05` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); OECD-PIAAC (OECD Survey of Adult Skills (PIAAC), Cycle 2, 2024, https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html)
- **For:** Employees; assessors; training managers.
- **Problem:** There are no diagnostic or adaptive assessments for future skills; check-ins are ratings and refreshers reuse current-plant items.
- **What it does:**
  - A deterministic adaptive engine: items calibrated by difficulty, next item chosen by rule, stop at a stable estimate or 20 items.
  - Criterion-referenced (meets the standard or not) for safety-related skills; percentile shown only for developmental skills.
  - Results write assessment evidence; each result shows a benchmark line.
  - Item banks for AI literacy, plant data, digital twins, cyber hygiene, SMR fundamentals and CleanEnergyComp.
- **Data:** `kafaa_adaptive_banks`; items extension (difficulty, skill); RPC startAdaptive / answerAdaptive (server-side selection and scoring)
- **RBAC:** Own attempts; assessor Scope; training_manager W for banks.
- **Acceptance:**
  - The same answers always produce the same item sequence and result (TS = SQL).
  - Safety-related skills never show a percentile.
  - No item exposes secure-bank or security content.
- **Depends on:** FS02

#### FS22 · Performance tasks and integrity reports
- **Wave / owner:** C · E3 · `m05` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence)
- **For:** Employees; assessors.
- **Problem:** Multiple-choice recall cannot show whether someone can actually work with plant data or challenge an AI output.
- **What it does:**
  - Scenario performance tasks: read a synthetic trend set, find the anomaly, justify a decision; scored by a published rubric.
  - An integrity report on any attempt that gates a credential (time on task, item exposure, resubmissions).
- **Data:** `kafaa_performance_tasks`; `kafaa_task_attempts` (rubric scores, reviewer); RPC scorePerformanceTask (assessor)
- **RBAC:** Own; assessor A; auditor R for integrity reports.
- **Acceptance:**
  - Every rubric line is visible to the learner before the attempt.
  - Gating attempts always carry an integrity report.
  - All data is synthetic; no plant or OT connection.
- **Depends on:** FS02

#### FS56 · Skill-change effectiveness
- **Wave / owner:** F · E4 · `m25` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** FSC (Future Skills Centre Impact Report 2025, 2025, https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf); ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday)
- **For:** Training managers; L&D; executives.
- **Problem:** Kirkpatrick records do not measure before-and-after skill levels, so nobody knows which learning actually moves future skills.
- **What it does:**
  - For each course and pathway: participants' F01 level before and 90 days after, with a matched comparison where available.
  - A "which learning moves skills" table (suppressed), linked to Kirkpatrick L3.
- **Data:** `kafaa_skill_change_measures`; RPC skillChangeReport (Agg)
- **RBAC:** learning_analytics Agg/A.
- **Acceptance:**
  - Courses with fewer than 10 completers show "suppressed".
  - TS and SQL agree on the seed.
  - Each measured course states its comparison method and window.
- **Depends on:** F25, FS19

#### FS57 · Curriculum coverage scorer and gap-filling backlog
- **Wave / owner:** F · E4 · `m25` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** LIGHTCAST (Lightcast Open Skills and Skillabi, 2025, https://lightcast.io/blog/open-skills-taxonomy); UPKEEP (Australia National Skills Taxonomy (ASC retired) and Korea NCS, 2024-2025, https://www.jobsandskills.gov.au/australian-skills-classification)
- **For:** L&D; procurement; training managers.
- **Problem:** Nobody can see which 2030 role requirements the catalogue cannot teach.
- **What it does:**
  - A 0-100 coverage score per role (now and 2030) from the catalogue, pathways and external resources, with the list of uncovered skills.
  - Uncovered skills become a gap-filling backlog (owner, date, build/partner/buy); a what-if adds a planned course and shows the score move.
- **Data:** rule coverage() TS = SQL; `kafaa_gap_backlog`
- **RBAC:** learning_analytics A; training_manager W.
- **Acceptance:**
  - Coverage reproduces from the rule.
  - Every uncovered skill appears in the backlog with an owner.
  - A what-if course raises the score by exactly the amount the rule predicts and is not saved unless confirmed.
- **Depends on:** FS05, FS19

#### FS75 · Future-skills nudges in the weekly digest
- **Wave / owner:** H · E3 · `src/shell (digest)` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** All signed-in staff.
- **Problem:** People do not notice when their role profile changes, a skill in their family rises, or a fast-decaying skill lapses.
- **What it does:**
  - New digest items: my role's 2030 profile was published or changed; a rising skill in my family (read from FS70 signals when present, a data-only coupling); a new future gig or pathway that matches me; a fast-decay skill about to lapse; an AI-literacy requirement for a system I use.
  - Respects existing preferences, quiet hours and the 7-item cap.
- **Data:** digest rules extension (TS = SQL)
- **RBAC:** Own.
- **Acceptance:**
  - Still at most 7 items, and idempotent per period.
  - No nudge on speak-up routes.
  - Each new item has a deep link and a "why" in EN and AR.
- **Depends on:** FS05, FS27, FS36, FS17

### CRD · Credentials and recognition

#### FS24 · Scale mapping and an "Authority" recognition
- **Wave / owner:** C · E4 · `m02` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes); DIGCOMP (DigComp 2.2 / 3.0 digital competence framework, 2022 / 2025, https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en); UAE-NQF (UAE National Qualifications Framework and NQC work-experience recognition, 2024 / 2026, https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses)
- **For:** HR; employees comparing levels; external partners.
- **Problem:** The 4-level scale cannot be compared with SFIA (7), SkillsFuture (6), DigComp (8) or UNESCO (3), and there is nothing above Expert.
- **What it does:**
  - A published level map from the Kafa'a scale to SFIA, SkillsFuture, DigComp, UNESCO and NQF levels, with notes where the fit is loose.
  - An "Authority" recognition flag above Expert (recognised by a panel, never a fifth level, never gamified) and a "not yet" state.
- **Data:** `kafaa_scale_maps`; `kafaa_authority_recognitions` (person, skill, panel, date); RPC recogniseAuthority (maker-checker)
- **RBAC:** Map public R; recognition A for HR director with a second approver.
- **Acceptance:**
  - Every mapping row cites its framework source.
  - Authority never changes the F01 level (unit test).
  - An Authority recognition needs two different approvers and writes a ledger row.
- **Depends on:** FS08 data-only (reads alignments if present)

#### FS29 · Recognition of prior learning (RPL)
- **Wave / owner:** D · E2 · `m34 (Recognition)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** ILO-RPL (ILO Skills and Lifelong Learning Strategy 2030; recognition of prior learning, 2023, https://www.ilo.org/global-skills-programme); UAE-NQF (UAE National Qualifications Framework and NQC work-experience recognition, 2024 / 2026, https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses); UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce)
- **For:** Experienced staff and contractors; assessors; HR.
- **Problem:** Years of Barakah experience and KHNP-trained competence exist only in internal records and count toward nothing portable.
- **What it does:**
  - A request flow: choose a skill or a credential, then assemble an evidence pack from OJT logs, simulator debriefs, qualification mirror status (qualified or not), engagements and supervisor attestations.
  - Assessor review with maker-checker; outcome is full, partial or not-yet credit, written as validated evidence plus an RPL statement.
  - An NQC-ready export of the pack and decision; every screen says Kafa'a is not a licensing or regulatory authority.
- **Data:** `kafaa_rpl_requests`; `kafaa_rpl_evidence`; RPCs submitRpl, decideRpl (maker-checker), exportRpl
- **RBAC:** recognition Own (request); A for assessors; R for auditors.
- **Acceptance:**
  - A decision needs two different people.
  - No security-restricted item can be attached (refusal code).
  - Credit is written as validated evidence and recomputes skills; the export carries no FANR wording.
- **Depends on:** FS02, F38, F33

#### FS30 · NQF levels and learning credits
- **Wave / owner:** D · E2 · `m34 (Recognition)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** UAE-NQF (UAE National Qualifications Framework and NQC work-experience recognition, 2024 / 2026, https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses); ENTITLE (SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK), 2024-2025, https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling); UPKEEP (Australia National Skills Taxonomy (ASC retired) and Korea NCS, 2024-2025, https://www.jobsandskills.gov.au/australian-skills-classification)
- **For:** Employees; L&D; partner universities.
- **Problem:** No credential or course carries a national level or credit value, so learning does not accumulate toward anything recognised.
- **What it does:**
  - Tags courses, pathways and micro-credentials with an indicative NQF level and credits (1 credit = 10 notional hours).
  - A personal credit ledger; 30-credit stacks shown toward an external award with a partner university (indicative only, sourced).
- **Data:** `kafaa_credit_tags`; `kafaa_credit_ledger`; rule creditsFor() TS = SQL
- **RBAC:** Own ledger; frameworks W for tags.
- **Acceptance:**
  - Every published micro-credential has a level and credit tag marked "indicative".
  - Ledger totals equal the sum of completed items (TS = SQL).
  - Every tag displays "indicative until agreed with the NQC and the partner" in EN and AR.
- **Depends on:** FS19 data-only

#### FS31 · Future-skills micro-credentials with a strategic tier
- **Wave / owner:** D · E3 · `m17` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/); JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696)
- **For:** Employees; managers; panels.
- **Problem:** There are no credentials for advanced-reactor fundamentals, green skills, cyber hygiene or the core skills; MC-TWINS is still a draft; badges have no consequences.
- **What it does:**
  - At least 8 new definitions: AI Assurer, Data for Plant Decisions, Digital Twin Practitioner (MC-TWINS published), SMR Foundations, Clean Energy Systems, Cyber Hygiene (all staff), Questioning in an AI-augmented Plant, Systems Thinking.
  - A strategic tier flag that grants eligibility for named future gigs and rotations, with the correlation to internal moves reported later (IBM pattern).
  - "Where this credential takes you" on each credential: roles, gigs and rotations that ask for it.
- **Data:** microcred_defs rows; microcred_defs.strategic (additive); eligibility rule extension
- **RBAC:** Existing F32 rules.
- **Acceptance:**
  - Each new definition passes the regulatory-wording copy check.
  - Strategic credentials unlock the gigs that name them.
  - Every definition is satisfiable through existing or FS19 content.
- **Depends on:** FS02, FS19, FS10

#### FS32 · Learner record (CLR-shaped) with selective disclosure
- **Wave / owner:** D · E3 · `m17` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges); SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce)
- **For:** Employees moving roles, going on secondment or applying externally.
- **Problem:** Credentials sit in a wallet one by one; there is no single verifiable record a person can curate and share.
- **What it does:**
  - A CLR-shaped bundle: credentials, qualification mirror status (qualified or not only), skills with provenance badges.
  - Three consent gates and a curated share link with an expiry; the verify page shows only the shared items.
- **Data:** `kafaa_record_shares` (items, expires_at, revoked_at); RPC createShare / revokeShare; public verifyShare (rate-limited)
- **RBAC:** Own; public verify shows initials only.
- **Acceptance:**
  - An expired or revoked link shows nothing personal.
  - No security detail or medical detail is ever included.
  - The bundle validates against a CLR-shaped schema in a unit test.
- **Depends on:** F04, F32

#### FS78 · Learning balance and protected study time
- **Wave / owner:** I · E1 · `m34 (Recognition)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** ENTITLE (SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK), 2024-2025, https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling)
- **For:** Employees; managers.
- **Problem:** Shift workers lack time more than money, and nobody can see a personal learning balance.
- **What it does:**
  - A visible annual balance (credits and hours, SIMULATED) with a mid-career top-up, spendable only on an outcome-gated catalogue with published criteria.
  - Protected study hours requested and approved (maker-checker) in the portal.
- **Data:** `kafaa_learning_balances`; `kafaa_study_time_requests`; RPCs requestStudyTime, decideStudyTime
- **RBAC:** Own; line manager in scope; HR A.
- **Acceptance:**
  - The balance equals grants minus approved use (TS = SQL).
  - Ungated items cannot be charged to the balance.
  - Study-time decisions need a second person and write an audit row.
- **Depends on:** FS30

#### FS79 · Verified import of external certificates
- **Wave / owner:** I · E1 · `m34 (Recognition)` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges)
- **For:** Employees; verifiers.
- **Problem:** External certificates (university, professional bodies, online courses) stay outside the record.
- **What it does:**
  - Enter certificate metadata and a verification URL; a verifier confirms; the crosswalk maps it to skills.
  - Trust tiers shown on the credential: ENEC-assessed, accredited third party, vendor self-serve.
- **Data:** `kafaa_external_certs`; RPC verifyExternalCert
- **RBAC:** Own; verifier A.
- **Acceptance:**
  - Unverified certificates never become evidence above "claimed".
  - The tier is visible wherever the credential appears.
  - Verified imports map to skills only through reviewed crosswalk rows.
- **Depends on:** FS08

### UAE · National/UAE alignment and Emiratisation quality

#### FS62 · National-strategy alignment layer
- **Wave / owner:** G · E2 · `m37 (National Alignment)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696); UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); NAFIS (Nafis and the Emirati Talent Competitiveness Council, 2026, https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership)
- **For:** Executives; strategy; government-relations reporting.
- **Problem:** Skills, programmes and targets are not tagged to the national strategies they serve, so every report is written by hand.
- **What it does:**
  - Tags on skills, programmes and targets: We the UAE 2031 pillar, National Employment Strategy 2031, National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071.
  - Filtered reports by strategy, each tag citing its official source.
- **Data:** `kafaa_national_tags`; `kafaa_tag_links`
- **RBAC:** national_alignment R for staff; W for admin and HR director.
- **Acceptance:**
  - Every tag cites an official source.
  - Reports are filters over data, with no typed totals.
  - Every tag exists in EN and AR.
- **Depends on:** FS02

#### FS63 · MoHRE occupation and skill-level mapping
- **Wave / owner:** G · E2 · `m37 (National Alignment)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** MOHRE (MoHRE occupational classification and skill levels, current (read 2026), https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme); ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco)
- **For:** HR; reporting.
- **Problem:** Roles are not mapped to the national occupational classification or its five skill levels.
- **What it does:**
  - Each role carries a MoHRE occupation label and code where verified (otherwise "code pending") and a national skill level.
  - A SIMULATED skill-level uplift trend for the workforce, suppressed.
- **Data:** `kafaa_role_occupations`
- **RBAC:** national_alignment R; W admin.
- **Acceptance:**
  - No code is shown unless verified from the source.
  - Kafa'a states it is not a MoHRE system.
  - The uplift trend is labelled SIMULATED and suppressed under 10.
- **Depends on:** FS05

#### FS73 · Emirati pipeline by competency
- **Wave / owner:** H · E2 · `m37 (National Alignment)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** NAFIS (Nafis and the Emirati Talent Competitiveness Council, 2026, https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** HR director; executives.
- **Problem:** Emiratisation is reported as headcount; it does not show whether critical and future roles have Emirati-ready successors, or whether people stay and progress.
- **What it does:**
  - For critical and future roles: Emirati-ready successors by readiness band and date, progression into authorised roles (mirror status), retention at 12, 24 and 36 months.
  - Aggregate only and suppressed under 10; nationality is used only for reporting, never in any score (existing protected-input test).
- **Data:** RPC emiratiPipeline (Agg)
- **RBAC:** workforce_analytics Agg/A; never public.
- **Acceptance:**
  - The protected-input test still passes for every engine.
  - Every cell under 10 is suppressed.
  - The page is never reachable by observers or partners (guard test).
- **Depends on:** FS05, F19

#### FS74 · Future Skills Wallet target
- **Wave / owner:** H · E2 · `m37 (National Alignment)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696); UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** All staff; leadership.
- **Problem:** There is no simple, dated whole-workforce goal for future skills.
- **What it does:**
  - A core-five wallet: AI fluency rung 2, cyber hygiene, plant-data basics, one core skill, CleanEnergyComp L1; an organisation counter toward a dated target set by leadership.
  - Each person's wallet links to their development plan so goals and evidence travel together.
- **Data:** `kafaa_wallet_targets`; rule walletStatus() TS = SQL
- **RBAC:** Own wallet; Agg counter (suppressed).
- **Acceptance:**
  - Wallet status is computed from evidence only.
  - The counter shows its definition and target date.
  - The target date and value are a leadership setting, shown with who set them and when.
- **Depends on:** FS09, FS31, FS41, FS25

### GOV · Analytics, governance and ISO 30414 reporting

#### FS50 · Critical Future-Skills Register
- **Wave / owner:** F · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf); ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030)
- **For:** HR director; executives; skill owners.
- **Problem:** There is no strategic list of the future skills ENEC must secure, with owners, targets and progress; gap plans hold 3 rows on free-text keys.
- **What it does:**
  - A register of critical future skills: owner, target level and people-equivalents by year, KPIs, and a build/buy/borrow/bot decision with its rationale.
  - Progress computed from person_skills (suppressed), quarterly review status and links to FS04 gap plans.
- **Data:** `kafaa_critical_skills`; `kafaa_critical_skill_reviews`; RPCs saveCriticalSkill, reviewCriticalSkill (ledger)
- **RBAC:** workforce_strategy A (HR director), Agg (HR analyst), R (auditor).
- **Acceptance:**
  - Progress is computed, never typed, and suppressed under 10.
  - Every row has an owner and a decision rationale.
  - Each quarterly review writes an audit row and a ledger row.
- **Depends on:** FS04, FS05

#### FS51 · Three-scenario skill forecasting bands
- **Wave / owner:** F · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/)
- **For:** HR director; strategy; workforce planners.
- **Problem:** The outlook runs on 12 areas with one point estimate; it has no level mix and no time-phasing against ENEC milestones.
- **What it does:**
  - Per skill and level mix: baseline, ADVANCE and accelerated bands to 2035, plus a long-horizon "generations" view of the plant's operating life.
  - Reuses the F35 model's pure functions; scenario assumptions are visible on the page; a methodology banner blocks naive year-on-year comparison; a "not yet modelled" list.
  - Annual refresh with saved versions (MATCH pattern).
- **Data:** `kafaa_skill_forecasts` (scenario, params, results); RPC computeSkillForecast (Agg, suppressed)
- **RBAC:** workforce_strategy Agg/A; never public.
- **Acceptance:**
  - Every number is labelled SIMULATED with a definitions link.
  - Resetting assumptions reproduces the baseline exactly (TS = SQL).
  - Skills with fewer than 10 holders are suppressed.
- **Depends on:** FS02, F35

#### FS52 · AI and automation exposure in the skills outlook
- **Wave / owner:** F · E2 · `m07` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** OECD-AICI (OECD AI Capability Indicators, 2025, https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** HR planners.
- **Problem:** The outlook has no automation factor, so demand ignores tasks that AI will assist or partly automate.
- **What it does:**
  - Adds an automation factor per family from FS06 task exposure, applied to demand with an adoption slider.
  - The tornado chart includes the new assumption; everything stays SIMULATED.
- **Data:** outlook.ts extension (TS = SQL); params key automation_adoption
- **RBAC:** Existing F35 rules.
- **Acceptance:**
  - With adoption at 0 the outlook equals today's results exactly.
  - TS and SQL agree for 52 assumption sets (PGlite).
  - The automation assumption appears in the tornado chart with its range.
- **Depends on:** FS06, F35

#### FS53 · External benchmark lines, kept apart from measured numbers
- **Wave / owner:** F · E2 · `m07` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025); EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** HR; executives.
- **Problem:** Every number is internal and SIMULATED; leaders cannot see whether ENEC is ahead of or behind the market.
- **What it does:**
  - Sourced reference rows (for example WEF 39% core-skill change, WEF 50% workforce in long-term learning, IEA 60% of firms reporting shortages, Pact training share) shown as labelled lines on workforce dashboards.
  - A visual rule: "market statistic" styling is always distinct from "measured at ENEC (SIMULATED)".
- **Data:** `kafaa_benchmark_values` (benchmark, metric, value, unit, as_of)
- **RBAC:** Staff R where the dashboard is visible.
- **Acceptance:**
  - Every external value links its source and date.
  - No external value is ever summed with an internal one (unit test).
  - The two stylings are distinguishable without colour (label and line pattern).
- **Depends on:** FS01

#### FS54 · Skills council and taxonomy change tracker
- **Wave / owner:** F · E3 · `m16` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes); UPKEEP (Australia National Skills Taxonomy (ASC retired) and Korea NCS, 2024-2025, https://www.jobsandskills.gov.au/australian-skills-classification); MCK-DELTA (McKinsey DELTAs (Distinct Elements of Talent), 2021, https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030)
- **For:** Skills council (operations, engineering, training, HR, employee representatives); everyone reading the catalogue.
- **Problem:** Taxonomies rot: Australia retired its national classification over timeliness. Kafa'a has no way to propose, approve or publish skill changes.
- **What it does:**
  - Change requests to add, rename, split, retire or re-level a skill, checked against the inclusion rule (distinct development and assessment).
  - Maker-checker approval by the council; a public change tracker at /skills/changes; a methodology-change banner on affected dashboards.
  - A staleness dashboard (skills past review date) and an orphan-rate audit (skills with no course, assessment or role).
- **Data:** `kafaa_skill_change_requests`; `kafaa_skill_changes` (published log); RPCs proposeSkillChange, decideSkillChange (ledger)
- **RBAC:** skills_taxonomy W (propose: staff), A (council: admin + training_manager + HR director), public R for the log.
- **Acceptance:**
  - A retire request marks the skill obsolete and never deletes it.
  - Every decision needs two approvers and writes a ledger row.
  - Staleness and orphan rate are computed, with drill-down lists.
- **Depends on:** FS02, FS07

#### FS55 · Engine cards, skills-ontology datasheet and model-risk template
- **Wave / owner:** F · E3 · `m16` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** AI governance; auditors; works-council style reviewers.
- **Problem:** The digest and Dalil career mode have no engine cards; new ranking surfaces need fairness monitoring; there is no published description of the skills data itself.
- **What it does:**
  - Engine cards for the digest, Dalil career mode and every new ranking surface (pathways, translator, fitness check, inferred skills).
  - Fairness snapshots extended to those surfaces.
  - A published skills-ontology datasheet: size, sources, update cadence, languages, how inference works, how bias is handled.
  - A model-risk template ready for when a server-side model gateway is approved.
- **Data:** engine card rows; fairness snapshot jobs; datasheet page (generated from the catalogue)
- **RBAC:** Existing F24 rules; datasheet public R.
- **Acceptance:**
  - Every ranked surface in the app has a card (lint test over engine registrations).
  - Datasheet numbers are generated from data, not typed.
  - Fairness snapshots run for each new surface and suppress groups under 10.
- **Depends on:** F24, FS02

#### FS60 · ISO 30414 skills and capability disclosure pack
- **Wave / owner:** G · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** HR director; board secretary; auditors.
- **Problem:** Skills metrics are scattered and carry no definitions, narratives or audit trail, so they cannot be disclosed.
- **What it does:**
  - A metric library mapped to ISO 30414 areas, centred on Skills, Capabilities and Development: % of workforce trained this year, quarterly active learners, learning hours per employee, AI-fundamentals coverage, critical-skill progress, participation equity (who is not using it, by site, shift and grade; suppressed).
  - Each metric has a definition, formula, source, owner narrative, variance explanation, approval and as-of; a materiality statement.
  - An export (CSV, JSON and a print view), all labelled SIMULATED in the demo.
- **Data:** `kafaa_hc_metrics`; `kafaa_hc_disclosures` (period, values, narratives, approvals); RPCs computeDisclosure, approveDisclosure (maker-checker, ledger)
- **RBAC:** workforce_strategy A; auditor R; never public.
- **Acceptance:**
  - No metric publishes without a narrative and a second approver.
  - Every value reproduces from its formula (TS = SQL).
  - All cells under 10 are suppressed.
- **Depends on:** FS50

#### FS61 · Skills pilots registry
- **Wave / owner:** G · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** FSC (Future Skills Centre Impact Report 2025, 2025, https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf)
- **For:** L&D; HR; executives.
- **Problem:** Workforce experiments are not registered, evaluated or published, so lessons, including failures, are lost.
- **What it does:**
  - Each pilot: hypothesis, comparison group, named evaluator (role card), metrics, result including failures, adoption status.
  - An adoption-rate KPI shown against the Future Skills Centre reference of 78%.
- **Data:** `kafaa_skill_pilots`; RPC closePilot (evaluator sign-off)
- **RBAC:** workforce_strategy W/A; staff R for published results.
- **Acceptance:**
  - A pilot cannot close without an evaluator sign-off.
  - Failed pilots stay visible.
  - The adoption rate is computed from pilot statuses and shows the Future Skills Centre reference with its source.
- **Depends on:** FS01

#### FS84 · Team 2030 capability targets and an organisation skills inventory
- **Wave / owner:** I · E5 · `m17` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Managers; HR.
- **Problem:** Team targets describe the present only, and HR has no skill-level inventory or data-quality view.
- **What it does:**
  - Team targets for 2028 and 2030 derived from FS05 versions, with the gap from team to future profile.
  - An organisation inventory heatmap across all skills by area and entity (suppressed) and a data-quality panel: profile coverage, staleness, share validated.
- **Data:** team_skill_targets.horizon (additive); RPC orgSkillInventory (Agg)
- **RBAC:** skills_profile Scope (managers), Agg (HR).
- **Acceptance:**
  - Cells under 10 are suppressed.
  - Data-quality figures reproduce from rules (TS = SQL).
  - Each team target shows the 2030 role-profile version it came from.
- **Depends on:** FS05, F11

### ECO · Ecosystem: universities, suppliers and partners

#### FS64 · Regional skills plan for Al Dhafra
- **Wave / owner:** G · E3 · `m36 (Skills Ecosystem)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030); EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en)
- **For:** Universities and training providers (partner roles); HR; community partners.
- **Problem:** ENEC's future skill demand is not shared with local providers, and their commitments are not tracked.
- **What it does:**
  - ENEC publishes forward skill demand as SIMULATED aggregates from FS51; providers respond in the portal with planned cohorts and course changes.
  - Commitments are tracked against delivery each term.
- **Data:** `kafaa_regional_demand` (released aggregates); `kafaa_provider_commitments`; RPC commitProvision (university/partner OwnOrg)
- **RBAC:** ecosystem R for partner roles (released aggregates only); OwnOrg W for their commitments.
- **Acceptance:**
  - Only released, suppressed aggregates reach partners.
  - Each commitment shows its delivery status.
  - Commitments are written only through the RPC and carry an audit row.
- **Depends on:** FS51

#### FS65 · Skills pledges ledger
- **Wave / owner:** G · E3 · `m36 (Skills Ecosystem)` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** ENEC departments; suppliers; universities.
- **Problem:** Upskilling commitments are statements, not tracked numbers.
- **What it does:**
  - Organisations register numeric pledges (people x skill area x date); pledged, started and completed are always shown separately.
- **Data:** `kafaa_pledges`; `kafaa_pledge_progress`; RPC registerPledge
- **RBAC:** OwnOrg W; ecosystem R aggregates.
- **Acceptance:**
  - Pledged, started and completed never merge into one number.
  - Small counts are suppressed.
  - Each pledge names its organisation, skill area and date.
- **Depends on:** FS01

#### FS66 · University programme alignment
- **Wave / owner:** G · E4 · `m10` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); UAE-NQF (UAE National Qualifications Framework and NQC work-experience recognition, 2024 / 2026, https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses); LIGHTCAST (Lightcast Open Skills and Skillabi, 2025, https://lightcast.io/blog/open-skills-taxonomy)
- **For:** Universities; graduate recruiters; applicants.
- **Problem:** Degrees and ENEC skills are not mapped, so a graduate's learning is not recognised at hire.
- **What it does:**
  - University programmes mapped to ENEC skills and levels, with a coverage score and an endorsement status (INMA-style review).
  - Graduates of aligned programmes get validated evidence at hire for the mapped skills.
- **Data:** `kafaa_programme_alignments`; RPC endorseProgramme (frameworks A)
- **RBAC:** University OwnOrg R/W for their programmes; frameworks A to endorse.
- **Acceptance:**
  - Evidence is written only for endorsed programmes.
  - Coverage reuses the FS57 rule.
  - A partner university sees only its own programmes.
- **Depends on:** FS08, FS57

#### FS67 · Fellowships and sponsored placements
- **Wave / owner:** G · E4 · `m10` · **Priority:** P3 · **Complexity:** M
- **Benchmarks:** NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677)
- **For:** Students; early-career staff; research partners.
- **Problem:** Fellows and sponsored students are not placed inside real ENEC projects, and completion is not tracked.
- **What it does:**
  - NEST-style fellowships inside ENEC research or ADVANCE study projects, and sponsored study paired with a placement (MSCFP pattern).
  - Completion rate as the headline metric, not award counts.
- **Data:** `kafaa_fellowships`; `kafaa_fellowship_milestones`
- **RBAC:** university OwnOrg; HR A.
- **Acceptance:**
  - Completion rate is computed from milestones and suppressed under 10.
  - Each fellowship names a host project and a supervisor role card.
  - Award counts are never shown without the completion rate beside them.
- **Depends on:** M10

#### FS68 · Supplier future-skills readiness
- **Wave / owner:** G · E5 · `m09` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce)
- **For:** Partner admins; ENEC supplier management.
- **Problem:** Contractor capability is checked against today's role profiles only.
- **What it does:**
  - Contractor coverage of digital, AI-literacy, cyber-hygiene and other future skills against the 2030 versions of contracted role profiles, per organisation (suppressed under 10), with academy course suggestions.
- **Data:** reads FS05 and F33; RPC supplierFutureReadiness (OwnOrg / A)
- **RBAC:** partner_org OwnOrg; ENEC equivalency A.
- **Acceptance:**
  - A partner sees only its own organisation.
  - Organisations under 10 people show suppressed values.
  - Course suggestions carry reasons from the existing F33 engine.
- **Depends on:** FS05, F33

#### FS69 · Contractor pre-arrival check with selective disclosure
- **Wave / owner:** G · E5 · `m09` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce); 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges); SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp)
- **For:** Contractors; ENEC evaluators.
- **Problem:** Contractor competence is checked on arrival, which costs outage time.
- **What it does:**
  - A contractor shares a curated subset of their passport (FS32 share) with the ENEC evaluator before mobilisation; the evaluator runs the F33 pre-check against it.
- **Data:** reads FS32 shares; RPC precheckFromShare
- **RBAC:** Contractor Own; evaluator A.
- **Acceptance:**
  - Only shared items are visible to the evaluator.
  - The link expires as set.
  - The pre-check result writes no evidence and no qualification status.
- **Depends on:** FS32, F33

#### FS77 · Student future-skills starter and intake baselines
- **Wave / owner:** H · E5 · `m06` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce)
- **For:** Students; parents; graduate programme owners.
- **Problem:** Students see no future-skills content, and induction re-teaches what AI-fluent school leavers already know.
- **What it does:**
  - An AI-literacy starter and an SMR orientation in the public journey (nothing stored for anonymous visitors).
  - Intake-year baselines so induction can skip content new joiners already hold.
- **Data:** journey content rows; `kafaa_intake_baselines`
- **RBAC:** Public R; HR W for baselines.
- **Acceptance:**
  - Anonymous use stores nothing (existing spy test).
  - All facts cite sources.
  - Induction plans read the baseline for the joiner's intake year.
- **Depends on:** FS09, F34

#### FS82 · Rolling mobility micro-grants
- **Wave / owner:** I · E4 · `m36 (Skills Ecosystem)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677)
- **For:** Early-career staff (up to 10 years); students on placements.
- **Problem:** Small, fast funding for conferences, short courses and site visits waits for the annual budget cycle.
- **What it does:**
  - Bi-monthly rounds with a light application and approval; outputs (report, presentation) logged as evidence. Budgets are SIMULATED.
- **Data:** `kafaa_grant_rounds`; `kafaa_grant_applications`; RPC decideGrant
- **RBAC:** Own; HR A.
- **Acceptance:**
  - Rounds open and close on schedule; decisions are audited.
  - Budgets are labelled SIMULATED.
  - Statistics under 10 are suppressed.
- **Depends on:** FS01

#### FS83 · UAE energy consortium trainee cohort
- **Wave / owner:** I · E4 · `m36 (Skills Ecosystem)` · **Priority:** P3 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** Graduates; partner organisations (synthetic); programme owners.
- **Problem:** Energy employers compete for the same graduates instead of growing the pool together.
- **What it does:**
  - A multi-employer cohort object (ENEC with synthetic partner organisations): shared modules, a project and a mentor (Nordic NNTP pattern), with cross-site visit logging.
- **Data:** `kafaa_consortium_cohorts`; members, visits
- **RBAC:** Partner OwnOrg; HR A.
- **Acceptance:**
  - Each partner sees only its own trainees.
  - Visits write evidence after host confirmation.
  - Partner organisations are synthetic and labelled as such.
- **Depends on:** FS20

## 7. How success is measured

| Area | Measure | Baseline (audit, seed) | Target | Benchmark | Features |
|---|---|---|---|---|---|
| Taxonomy | Skills with an international alignment and a source | 0 of 71 | 100% of 110+ skills; every alignment cites a URL and as-of date | ESCO, SFIA9 | FS02, FS08 |
| Taxonomy | Skills past their review date (staleness) and orphan rate | not measured | staleness under 5%; orphan rate (no course, assessment or role) under 10% | UPKEEP | FS54 |
| Roles | Roles with a published 2030 profile; future roles with a path | 0 of 28; 0 of 11 | 28 of 28; 11 of 11 | SG-JTM | FS05, FS11 |
| AI fluency | Staff at AI fluency rung 2 (Practitioner) or above | 3 people hold the AI skill | dated target set by leadership (demo: 60% of staff by end-2027), shown as a counter | UAE-AI, UAE-PEERS, JAHIZ | FS09, FS74 |
| AI governance | AI systems with full literacy coverage of their users | no register | 100% of registered systems at "fully implemented" | AI-LIT | FS36 |
| Learning supply | Future skills with a levelled pathway; skills held by nobody | 3 courses; 6 skills unheld | every future skill has a L1-L2 pathway; 0 skills with no learning route | LIGHTCAST, UPKEEP | FS17, FS19, FS57 |
| Learning impact | Courses with a measured skill-level change after 90 days | not measured | reported for every future-skill course with 10+ completers | FSC, ISO30414 | FS56 |
| Coverage | % of workforce trained this year; quarterly active learners | not reported | reported with definition, narrative and variance each quarter | EU-PACT, ISO30414 | FS60 |
| Mobility | Opportunities that build a future skill | 2 of 25 | 10 or more open at any time, across 5 channels | CORP, NEA | FS27, FS28 |
| Future readiness | Future Me readiness reachable through evidence | ceiling about 20-30 | every family can reach 100 through recorded learning and practice | SMR-WF | FS13 |
| Recognition | Credentials carrying an NQF level and credit; RPL decisions | 0 | every published credential tagged; RPL flow used end to end in the demo | UAE-NQF, ILO-RPL | FS29, FS30 |
| Emiratisation quality | Critical and future roles with an Emirati-ready successor by date; retention at 12/24/36 months | headcount aggregates only | reported by competency, suppressed under 10 | NAFIS | FS73 |
| Experiments | Skills pilots adopted, expanded or further funded | no registry | reported against the FSC reference of 78% | FSC | FS61 |
| Engineering gates | Every feature: TS = SQL validator, EN/AR parity, suppression, route sweep, fairness card for new rankings | in place for 38 features | 100% of the new features | — | FS01, FS55 |

All targets are demo targets on synthetic data; a dated organisation target (for example the AI-fluency counter) is a leadership decision and is shown as a parameter, not a claim.

## 8. Risks and open questions

- External codes in the crosswalk (FS08, FS62) must be copied from the source, never inferred; rows without a verified code show "code pending review".
- Several benchmark sites were blocked from the research container (weforum.org, oecd-nea.org, unesco.org). Their figures come from corroborated secondary reports; a human should re-read the primary pages before any figure appears in executive copy.
- Cyber hygiene for all staff (FS02, FS19, FS31) must stay awareness-level; any request for OT or security detail is refused by the copy check and the security-restricted flag.
- Inferred-skill suggestions (FS71) and work-evidence capture (FS43) are monitoring-adjacent: they stay Own-only until the person confirms, and ship with an engine card and fairness snapshot.
- Nationality appears only in suppressed Emiratisation aggregates (FS72); the protected-input test must keep passing for every engine.
- NQF levels and credits (FS30) and university award stacks are indicative until a partner and the NQC agree; the UI says so.
- A server-side model gateway would improve role-play, tutoring and skill extraction; until one is approved (an Edge Function holding a secret), every card works deterministically and FS54 holds the model-risk template.
