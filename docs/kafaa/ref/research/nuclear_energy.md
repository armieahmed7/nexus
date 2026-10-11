# Future Skills & Competencies — Nuclear and Energy-Sector Workforce Benchmarks
### Research pack for **Kafa'a** (ENEC employee upskilling / career / future-workforce portal)

Research date: **2026-10-10**. Every entry carries a source URL and a publication/retrieval date.
Figures marked **[verified: curl]** were read from the primary PDF/HTML in this session; figures marked
**[secondary]** come from trade press or search digests and should be re-checked against the primary source
before they appear in product copy or a board deck.

**Why this theme matters to ENEC specifically.** Barakah's four APR-1400 units are now all operating; the KHNP
operator-support arrangement tapers toward ~2030; ENEC's ADVANCE programme points at SMRs/advanced reactors;
and the IAEA projects **more than 4 million people** supporting nuclear power by 2050 with **about one-third of
today's workforce retiring by 2033** and **upwards of one million new workers** needed just to replace them
(IAEA, International Conference on Nuclear Knowledge Management and HRD, July 2024 —
https://www.iaea.org/node/175832 ; ANS coverage 2024-07-18 —
https://www.ans.org/news/article-6224/four-million-nuclear-jobs-by-2050-who-will-do-them/). Kafa'a is therefore
not an LMS; it is the instrument for a **capability-transfer deadline**.

---

## Part 1 — Global governance frameworks (IAEA, OECD-NEA, WANO/INPO)

### 1. IAEA NG-T-3.10 — *Workforce Planning for New Nuclear Power Programmes*
- **What it is:** The IAEA Nuclear Energy Series guide (STI/PUB/1477) that defines national- and
  organisational-level workforce planning for a nuclear programme. **Owner:** IAEA (international). **Year:** 2011,
  still the anchor reference; sits alongside the Milestones Approach NG-G-3.1 Rev. 2 (2024).
- **Source:** https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf **[verified: curl, 2026-10-10]**
- **Mechanism (verbatim definition, p.2):** workforce planning is *"the systematic identification and analysis of
  what an organization (and a country) is going to need in terms of the size, type and quality of workforce to
  achieve its objectives. It determines what mix of experience and competencies are expected to be needed, and
  identifies the steps that should be taken to get the right number of the right people in the right place at the
  right time."*
- **Mechanism (the loop, §1.2):** estimate human-resource needs → **assess existing level of capability** →
  **identify competence gaps** → **plan how to fill the gaps**, phase by phase, for three organisation types
  (NEPIO / regulatory body / operating organisation). The guide ships a simplified flow chart (Fig. 2) and case
  studies with **three-scenario skilled-workforce demand curves** (the US case, Fig. X.3: baseline / growth /
  high-growth) — i.e. the official shape of a workforce-forecast chart is a *scenario band*, not a point estimate.
- **Results:** No published outcome metrics (it is a guidance document), but it is the document regulators and
  the IAEA INIR missions assess national programmes against.
- **What Kafa'a could borrow:**
  1. A **"Workforce Plan" module** whose data model is literally NG-T-3.10's four stages — Demand (by role,
     by phase), Supply (current headcount + competence), **Gap**, Fill-plan (recruit / train / contract / partner) —
     so that ENEC's internal plan is already in IAEA-audit shape.
  2. **Three-scenario forecasting as a first-class UI**: every demand number shown as a band (baseline / ADVANCE
     SMR build / accelerated), with a scenario selector that re-renders the whole workforce dashboard.
  3. A **"right people, right place, right time" readiness tile** per critical role: required N, qualified N,
     in-pipeline N, months-to-ready.

### 2. IAEA Nuclear Infrastructure Competency Framework (NICF) + NIDIMS
- **What it is:** An IAEA online/MS-Access **database** that maps, for each of the Milestones Approach's 19
  infrastructure issues and 3 phases, the activities a national organisation must perform and **the competencies
  each activity requires**. **Owner:** IAEA. **Year:** framework current; the companion **NIDIMS** (Nuclear
  Infrastructure Development Information Management System) launched **May 2026**.
- **Sources:** https://www.iaea.org/sites/default/files/20/11/nicf.pdf ;
  https://www.iaea.org/node/41247 (Milestones Approach) — retrieved 2026-10-10 **[secondary]**
- **Mechanism:** Users navigate phase → infrastructure issue → activity → competency, and can download and
  **localise** the database. Paired with *E-learning for Nuclear Newcomers* and the Nuclear Infrastructure
  Bibliography so each competency links to learning content.
- **What Kafa'a could borrow:**
  1. **Competency ↔ activity ↔ phase** as the core join table (not competency ↔ course). A competency with no
     owning activity is dead weight; an activity with no qualified person is a risk item.
  2. A **"Why this competency exists"** link on every competency page, pointing to the regulatory/infrastructure
     activity that demands it — this is the single cheapest credibility feature for a nuclear audience.
  3. Make the ENEC competency dictionary **exportable** (JSON/CSV) the way the IAEA ships NICF, so supply-chain
     partners and universities can align to it.

### 3. IAEA Knowledge Loss Risk Management (NG-T-6.11) and CLP4NET
- **What it is:** IAEA methodology for managing the risk of knowledge walking out the door. **Owner:** IAEA.
  **Year:** NG-T-6.11, 2017; CLP4NET is the IAEA's Nuclear Knowledge Management e-learning platform (current).
- **Sources:** https://www.iaea.org/node/41993 ; https://www.iaea.org/node/100985 — retrieved 2026-10-10 **[secondary]**
- **Mechanism:** a three-step cycle — (1) **risk-assess** knowledge loss from employee attrition (criticality of
  knowledge × likelihood of departure), (2) **mitigate** (capture, shadowing, documentation, mentoring),
  (3) **monitor**. CLP4NET delivers the courses, gated by an IAEA **NUCLEUS single sign-on** account.
- **Results:** IAEA's own framing: experts retire *"taking with them a substantial amount of knowledge and
  corporate memory"*; one-third of the global nuclear workforce retires by 2033 (see header).
- **What Kafa'a could borrow (high value for the KHNP-exit timeline):**
  1. A **Knowledge-Loss Risk Register**: every employee × knowledge area scored on *criticality* and
     *departure likelihood* (retirement date, secondment end, contract end, flight-risk), producing a ranked
     "capture queue" visible to department heads.
  2. **Capture workflows** attached to the register: a named successor, a shadowing log, a recorded
     walk-through, a written procedure — each with a completion state, so "knowledge transfer" becomes a
     tracked artefact rather than an intention.
  3. A **KHNP/vendor-dependency heat map**: which procedures, systems and competencies still have a
     non-ENEC single point of knowledge, counted down to 2030.

### 4. IAEA TECDOC-1917 — *Assessing Behavioural Competencies of Employees in Nuclear Facilities*
- **What it is:** 128-page IAEA TECDOC giving nuclear organisations practical methods to assess **behavioural**
  (non-technical) competencies tied to safe, secure and effective performance. **Owner:** IAEA. **Year:** 2020.
- **Source:** https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf — retrieved 2026-10-10 **[secondary]**
- **Mechanism:** a toolkit of assessment approaches (structured interviews, simulation observation, 360°,
  situational judgement), with general and role-specific guidance, intended to inform **selection, promotion,
  training and development** decisions — i.e. behavioural competence is treated as assessable evidence, not a
  personality adjective. Companion: *Competency Assessments for Nuclear Industry Personnel* (STI/PUB/1236).
- **What Kafa'a could borrow:**
  1. A **behavioural-competency track** parallel to the technical one, with the same evidence model
     (observation records, simulator debriefs, supervisor attestations) and the same expiry rules.
  2. **Situational judgement items** for safety culture, conservative decision-making, questioning attitude and
     error-prevention — scored and trended, feeding the promotion/role-readiness engine.
  3. A rule that **no promotion to a safety-significant role** can be requested in Kafa'a without both the
     technical and the behavioural evidence set complete.

### 5. OECD-NEA **NEST Framework** (Nuclear Education, Skills and Technology)
- **What it is:** A multinational joint undertaking that pools member countries' education/training capacity into
  **shared international projects** that host fellows. **Owner:** OECD Nuclear Energy Agency. **Years:** in force
  **15 Feb 2019**; 5-year review Nov 2024; **UK joined 14 May 2025**; **Sweden joined May 2026 → 15 countries**.
- **Sources:** https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development ;
  https://www.oecd-nea.org/jcms/pl_105527/united-kingdom-joins-international-effort-to-advance-nuclear-education-and-training ;
  https://oecd-nea.org/jcms/pl_118880/nest-management-board-reviews-progress-welcomes-sweden — retrieved 2026-10-10 **[secondary]**
  (Note: oecd-nea.org is Cloudflare-blocked from this container; figures are from search digests.)
- **Mechanism:** Countries contribute in-kind to named projects (e.g. PANDA, ARTERD — both extended to end-2027).
  Each project **hosts "NEST Fellows"** — graduate students and early-career professionals who do their research
  inside a real multinational technical project, gaining the skill and the network simultaneously.
- **Results:** **215+ Fellows across 8 projects**; 13 countries by 2024 (Poland, Netherlands joined May 2024),
  15 by 2026.
- **What Kafa'a could borrow:**
  1. A **"Fellowship / secondment marketplace"**: internal and partner-hosted project placements listed as
     structured opportunities (duration, host, competencies gained, supervisor), applied to inside Kafa'a, with
     the resulting competencies auto-credited on completion.
  2. **Project-based learning as a credential type** — a fellowship completion is a first-class credential in the
     passport, not a line in a CV.
  3. An **international placements** surface for ENEC's existing KINGS/KHNP/IAEA ties, with seat counts and
     application deadlines visible to all staff rather than circulated by email.

### 6. OECD-NEA **Plan 2035** — *Scaling Technology, Growing Careers, Securing the Future*
- **What it is:** The NEA's workforce-building initiative to support **tripling nuclear capacity by 2050**.
  **Owner:** OECD-NEA (DG William D. Magwood IV). **Year:** launched **April 2024**; vision paper **Oct 2025**.
- **Source:** https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf
  **[verified: curl, 2026-10-10 — quotations below read directly from the PDF]**
- **Mechanism — three named pathways:**
  - **INSPIRE** — design an **"AtomExplorer"** travelling nuclear information and careers exhibit deployed
    worldwide; an **online platform for all outreach resources**; a **library of video lectures by NEA member
    experts** accessible to schools and education providers.
  - **MENTOR** — *"franchise"* the NEA's International Mentoring Workshops into a global platform; launch the
    **NEA Global Internship Programme**; expand the **Global Forum Rising Stars Programme**; scholarships for
    young professionals.
  - **NETWORK** — build a global network of role models and educators; a **networking platform for alumnae of
    the Rising Stars Programme**; engage students and educators in the Global Forum.
  - Partners named: Global Forum on Nuclear Education, **YGN**, **WiN Global**, professional societies.
  - Explicit framing: reach **from secondary school through trade school/university to young professional**, and
    "**create a workforce that reflects the economic well-being of the communities it serves**".
- **Stated problem it targets (verbatim):** *"critical gaps remain in attracting young talent in areas such as
  vocational training"*; *"Vendors, architects, engineering companies and operators in the nuclear sector often
  cite workforce availability as a top challenge."*
- **What Kafa'a could borrow:**
  1. **Three-lane IA for the whole talent pipeline — Inspire / Mentor / Network** — giving Kafa'a a public-facing
     "Inspire" surface (schools, Al Dhafra, UAE universities) feeding a logged-in "Mentor" surface (matching,
     workshops, internships) feeding a lifelong "Network" surface (alumni of each ENEC programme).
  2. A **Rising-Stars-style cohort programme object**: nomination → cohort → curriculum → alumni network, with
     the alumni network persisting as a searchable directory (ENEC's six existing talent-pipeline programmes
     each become one of these).
  3. An **expert video-lecture library** sourced from ENEC's own senior engineers — the cheapest, highest-trust
     form of knowledge capture, and it doubles as Knowledge-Loss mitigation (#3).

### 7. NEA **Global Forum on Nuclear Education, Science, Technology and Policy** + NextGen Nuclear Leaders Summer School
- **What it is:** The NEA's standing convening body for universities/industry/government on nuclear E&T, with a
  flagship **NextGen Nuclear Leaders Summer School**. **Owner:** OECD-NEA. **Year:** 2026 programme published.
- **Source:** https://oecd-nea.org/upload/docs/application/pdf/2026-07/nextgen_nuclear_leaders_summer_school_2026_final_programme.pdf — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:** a **"Future Leaders" track** distinct from technical qualification: policy,
  economics, public communication, international affairs — the competencies an ENEC leader needs when ENEC is
  the UAE's nuclear ambassador, not only its operator.

### 8. INPO / National Academy for Nuclear Training (ACAD) and WANO
- **What it is:** INPO's **National Academy for Nuclear Training** is the framework that integrates the training
  and qualification efforts of all US nuclear utilities, with an independent **accrediting board** that accredits
  utility training programmes against the **ACAD** document series (e.g. ACAD 02-001 defines the self-evaluation
  and accreditation team review basis). **Owner:** INPO (US industry-funded); WANO is the global analogue via
  peer review. **Years:** Academy framework described in NRC-filed ACAD documents from 1993; ACAD 02-001 (2002);
  INPO stated intent to treat new-reactor licensees via **initial accreditation**.
- **Sources:** https://www.nrc.gov/docs/ML0211/ML021160697.pdf ; https://publish.nrc.gov/docs/ML1014/ML101440261.pdf — retrieved 2026-10-10 **[secondary]**
- **Mechanism (the key idea):** training programmes are **accredited, periodically re-accredited, and
  self-evaluated** against a published standard — so training quality is an auditable asset, not a cost centre.
  Programmes are built on the **Systematic Approach to Training (SAT)**: analyse → design → develop → implement →
  evaluate, with job/task analysis as the root of every objective.
- **What Kafa'a could borrow:**
  1. A **SAT-native course object**: every course traces to Job/Task Analysis items → learning objectives →
     assessment items → JPM (job performance measure). Kafa'a can then answer "which task does this course
     actually qualify someone for?" — the question an INPO/WANO peer reviewer asks.
  2. A **programme accreditation workspace**: self-evaluation checklists, evidence attachments, finding/CAP
     tracking, re-accreditation calendar — so ENEC's training org can run its own INPO/WANO-style cycle in-app.
  3. **Accreditation status as a badge** on each training programme, visible to learners (signals rigour and
     drives trust in the catalogue).

---

## Part 2 — National programmes (what governments actually built)

### 9. UK — **National Nuclear Strategic Plan for Skills** ("Building Skills for the Nation's Nuclear Capability")
- **What it is:** The UK's government-backed nuclear skills roadmap, devised by the **Nuclear Skills Taskforce**
  (chair Simon Bollom), delivered by the **Nuclear Skills Delivery Group** (NSDG, formerly NSSG), covering **both
  civil and defence** nuclear. **Owner:** UK (DESNZ + MoD + industry). **Year:** launched **16 May 2024** with a
  **Nuclear Skills Charter** signing.
- **Source:** https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce (WNN,
  2024-05-16) **[verified: curl, 2026-10-10 — all figures below read from the article text]**
- **Mechanism — the specific commitments:**
  - **40,000 new jobs by 2030** — double the sector's current hiring rate; raise the available workforce by
    **almost 50%**.
  - **Double apprenticeships by 2025-26** (welding, electrical, engineering trades) and **double graduate
    entrants** in the same year, with **sponsorship and bursary schemes**; increase PhD numbers.
  - A **future leaders scheme**; **mid-career upskilling** for industry joiners; **regional hubs** tailored to
    local capacity needs; increased training capacity; diversity and inclusion targets.
  - A **national communications campaign — "Destination Nuclear"** (launched early 2024), explicitly targeted at
    **career-changers with transferable skills** as well as apprentices/graduates/PhDs. MoD awarded ~**£2.47m
    (ex VAT)** to MHP Group for an interim continuation **1 Aug 2025 – 31 Mar 2026** while a longer competitive
    tender runs (https://www.find-tender.service.gov.uk/Notice/072018-2025, 2025-07) **[secondary]**.
  - Context figure: UK civil + defence nuclear workforce forecast to **double over 20 years, ~80,000 additional
    skilled jobs** (https://www.niauk.org/securing-future-of-uk-nuclear-industry-detailed-in-new-skills-plan) **[secondary]**.
- **Quotable mechanism (NSDG Programme Director Beccy Pleasant, in WNN):** *"The skills challenge can be met only
  if the sector works together to deepen and broaden the skills base… this includes finding ways to align skills
  across the civil and nuclear defence sectors."*
- **What Kafa'a could borrow:**
  1. A **"Transferable Skills → Nuclear" translator**: a career-changer enters their current occupation (oil &
     gas technician, aviation maintenance, utilities electrician, military) and Kafa'a returns the nuclear roles
     they are nearest to, the delta competencies, and the exact bridging programme + duration. This is the single
     highest-leverage idea in the UK plan for ENEC, given the UAE's deep oil/gas and aviation talent pools.
  2. A **public "Destination" careers surface** (bilingual EN/AR) distinct from the employee portal: role films,
     day-in-the-life, salary bands, entry routes (apprentice / diploma / graduate / PhD / mid-career switch),
     with an application funnel that feeds ENEC's pipeline programmes.
  3. **Sector-level target tracking**: a dashboard holding a national/company target (e.g. "N Emirati nuclear
     professionals by 2030"), with apprenticeship/graduate/mid-career sub-targets, actuals, and a delta trend —
     the plan's doubling commitments made legible rather than aspirational.

### 10. UK — **Nuclear Skills Passport** and the Sellafield verifiable-credentials "Nuclear Passport"
- **What it is:** Two generations of the same idea. (a) The **Nuclear Skills Passport**, launched by the National
  Skills Academy for Nuclear, **2011**: a portable record of a worker's industry-specific training and accredited
  qualifications, usable across UK nuclear sites, plus a shared learner database and a skills-gap benchmarking
  tool — explicitly *not* a replacement for site SQEP systems in the short term.
  (b) The **Sellafield "Nuclear passport"** self-sovereign-identity project with **Digital Catapult** (open call
  **2020**; prototype trialled through **2022-23**; partners included **Condatis**).
- **Sources:** https://www.costain.com/news/news-releases/costain-joins-nuclear-skills-passport-scheme/ (2011) ;
  https://www.digicatapult.org.uk/wp-content/uploads/2022/07/Digital_Catapult_Sellafield_DLT_Field_Labs_Report_Final-July-22-ver-2.pdf (2022-07) ;
  https://identityweek.net/condatis-to-launch-staff-passport-solution — retrieved 2026-10-10 **[secondary]**
- **Mechanism (Sellafield):** scope covered **radiological exposure history, competencies, training and facility
  access**. Two parallel SSI stacks were built — a cloud **identity hub / encrypted data vault**, and a
  **decentralised blockchain agent** approach — both letting the worker hold credentials in a **mobile wallet**
  with **selective disclosure**.
- **Results claimed:** issuing credentials to confirm competence takes **three weeks to three months** today;
  the verifiable-credentials prototype reportedly cut **worker on-/off-boarding time by ~80%**. *Treat the 80% as
  a trial/vendor estimate, not an operational result* — no evidence of production rollout was found.
- **What Kafa'a could borrow:**
  1. A **Kafa'a Competency Passport**: one worker-held record spanning qualification, training, authorisation,
     dose/medical validity and site access, **shareable by selective disclosure** with a contractor, a regulator
     (FANR), or a partner utility — with a QR/short-link verification page that proves a credential without
     exposing the whole record.
  2. **Contractor on-boarding as the killer use case**: ENEC's outage and construction workforce is
     contractor-heavy; a passport that pre-verifies a contractor's competencies before they arrive on site turns
     a three-week process into a check.
  3. A **skills-gap benchmarking tool** at sector level (the 2011 feature nobody built well): anonymised
     comparison of ENEC's competency coverage against peer utilities / national baselines.

### 11. France — **GIFEN "MATCH"**, the **Université des Métiers du Nucléaire**, and **EDF's Plan Excell**
- **What it is:** France's answer to "how many people, in which jobs, by when".
  - **MATCH** — a study commissioned by the French government in **early 2023**, coordinated by **GIFEN** (the
    French nuclear industry association), reported to ministers **21 April 2023**, now maintained as an
    **annually updated, job-by-job** view of recruitment and training needs across the sector, built from
    operators' activity forecasts and the industry's available resources. Ministers asked GIFEN to extend it by
    summer 2023 to cover European exports, new reactors and SMRs.
  - **Université des Métiers du Nucléaire (UMN)** — created **early 2021** to steer the actions that meet those
    needs.
  - **Plan Excell** — EDF's quality/excellence recovery plan, launched **spring 2020**: **30 commitments across
    5 focus areas**, **27 achieved by end-2022**.
- **Sources:** https://www.nucleareurope.eu/blog/highlight-of-the-month/match-program-a-tool-for-nuclear-capacity-building-in-france/ ;
  https://www.edf.fr/groupe-edf/produire-une-energie-respectueuse-du-climat/lenergie-nucleaire/nous-preparons-le-nucleaire-de-demain/plan-excell ;
  https://www.edf.fr/sites/groupe/files/epresspack/3985/PR-The-excell-plan-annual-results-and-outlook-for-the-sustainability-of-its-standards.pdf — retrieved 2026-10-10 **[secondary]**
- **Results:** MATCH projects **~100,000 hires in the French nuclear sector over 2023-2033** across EDF,
  Framatome, Orano, CEA, Andra and the supply chain. EDF stated (Nov 2022) that **one in two nuclear employees
  needed by 2030 is not currently working in the industry**.
- **What Kafa'a could borrow:**
  1. **Job-by-job demand modelling, refreshed annually, across the whole ENEC ecosystem** — not just ENEC
     headcount but Nawah, Barakah One, contractors, suppliers and the ADVANCE SMR programme — with each job
     family's hires, attrition and training throughput shown on one page.
  2. The **"one in two is not in the industry yet"** framing as a product principle: build the portal for people
     who are *not yet nuclear*, with conversion pathways, not only for incumbents.
  3. A **commitments tracker** modelled on Plan Excell: N named commitments, owners, status, annual public
     results — a simple, highly legible governance artefact that executives actually read.

### 12. Canada — Darlington **BWRX-300**, GE Vernova Hitachi service centre, and the Saskatchewan build-out
- **What it is:** The West's first grid-scale SMR workforce build.
  - **GE Vernova Hitachi SMR engineering and service centre**, Durham Region, Ontario — **CAD/USD $70m**
    investment announced **June 2025**; training facilities projected to help **more than 2,000 people per year**
    build nuclear innovation/operations skills; operational by **end-2027**.
  - **Darlington New Nuclear Project** (4 × BWRX-300) expected to **create and sustain 3,700 jobs** across
    construction and long-term operation.
  - **OPG pipeline programmes**: e.g. a **six-week Introduction to Millwrighting** course for Indigenous
    candidates at Darlington; the Centre for Skilled Trades and Technology at Durham College; OPG posts a
    dedicated **"SMR Authorization Training Supervisor"** role.
  - **Saskatchewan**: SaskPower selected BWRX-300 for mid-2030s grid use; created **SaskNuclear** subsidiary;
    provincial estimate of **2,500–3,500 skilled workers** to build and run new plants; a **Safety, Licensing and
    Testing centre at the University of Regina** (CAD 1.96m federal via PrairiesCan + CAD 4m provincial);
    **Saskatchewan Polytechnic partnered with the UK's National Skills Academy for Nuclear** to deliver short,
    non-credit nuclear courses to utility/mining/manufacturing workers and engineers crossing into nuclear;
    University of Saskatchewan hosts the **Canadian National Nuclear Energy Management School** (IAEA-led).
- **Sources:** https://www.gevernova.com/news/press-releases/ge-vernova-hitachi-nuclear-energy-canada-small-modular-reactor-engineering-service-centre-ontario (2025-06) ;
  https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/ (2025-11-26) ;
  https://saskpolytech.ca/programs-and-courses/part-time-studies/nuclear-skills-training.aspx ;
  https://www.neimagazine.com/news/canada-funds-smr-test-centre/ — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow (directly relevant to ENEC ADVANCE):**
  1. An **"SMR readiness" overlay** on the competency model: for each existing Barakah role, show what changes
     for an SMR/advanced-reactor fleet (multi-unit operation, different I&C, passive safety, different
     maintenance regimes) and the delta training required — before ENEC needs it.
  2. **Short, non-credit cross-over courses** as a distinct catalogue type aimed at adjacent UAE industries
     (ADNOC, utilities, aviation MRO, construction) — the Sask Polytech + NSAN model, importable curricula.
  3. **Named authorisation-training roles and plans** as objects in the system (who owns qualifying operators
     for the next technology, and against what schedule).

### 13. Korea — **KINGS**, KHNP/KEPCO training, and the ENEC internship pipeline
- **What it is:** The channel ENEC itself used. **KINGS** (KEPCO International Nuclear Graduate School, Ulsan)
  was **established 2012**, offering a **2-year master's accredited by Korea's Ministry of Education**, closely
  tied to the KEPCO group.
- **Mechanism (ENEC × KINGS internship):** second edition from **2016** with a first batch of **10 Emirati
  students** from Khalifa University and KAIST; **four-week Nuclear Power Familiarization Course** on the KINGS
  campus, then **two weeks of on-the-job training** at institutions around Korea (later cohorts reported as an
  eight-week programme). Partners: KEPCO, KHNP, KPS, KEPCO Nuclear Fuel, KEPCO E&C, the **KHNP Global Training
  Center**, KINGS, and Korea's MOTIE.
- **Mechanism (ENEC operator pipeline):** classroom training in Abu Dhabi → on-the-job training at KEPCO
  facilities in Korea → further training at **ENEC's simulator centre at Barakah** → a **six-month plant
  commissioning assignment** at Barakah.
- **Sources:** https://www.enec.gov.ae/news/latest-news/emirati-students-participate-in-enec-internship-program-in-south-korea ;
  https://www.wam.ae/en/article/hsz46f11-future-nuclear-energy-leaders-ready-for-operations ;
  https://ncc.fuw.edu.pl/en/articles/view/kepco-international-nuclear-graduate-school — retrieved 2026-10-10 **[secondary]**
  (Operator-pipeline description predates Unit 1 startup; treat timings as historical.)
- **What Kafa'a could borrow:**
  1. Model the **multi-site, multi-employer qualification journey** natively: a single learner record that spans
     classroom (ENEC) → overseas OJT (KHNP) → simulator (Barakah) → commissioning assignment, with sign-offs from
     each host organisation and a visible progress bar to authorisation.
  2. **Partner-institution objects** (KINGS, Khalifa University, KAIST, IAEA, WNU) with seat allocations,
     nomination windows, selection criteria and alumni — making the international pipeline a managed asset.
  3. A **localisation countdown**: for each qualification currently delivered or signed off by a foreign partner,
     track the transfer of delivery capability to ENEC/UAE instructors, with a target date before ~2030.

### 14. UAE / ENEC — the existing baseline Kafa'a must build on
- **ENEC × DGE Mawaheb Talent Hub (May 2026):** a **five-year agreement** to qualify **at least 100 UAE
  nationals** holding high-school diplomas, vocational diplomas or postgraduate degrees for nuclear roles; ENEC
  leads the **development and funding** of the training programmes and trainee costs; those who meet hiring
  criteria are **integrated into the workforce** at ENEC or subsidiaries.
  Sources: https://www.mediaoffice.abudhabi/en/energy/emirates-nuclear-energy-company-partners-with-department-of-government-enablement-abu-dhabi-to-train-and-employ-uae-nationals-in-civil-nuclear-energy-sector/ ;
  https://dge.gov.ae/en/news/2026-enec-mawaheb ; https://www.wam.ae/en/article/c07irtv-enec-dge-sign-agreement-train-employ-emirati — retrieved 2026-10-10 **[secondary]**
- **Scale:** ENEC reported **3,000+ employees, 60% Emirati** (2025); **2,000+ Emirati professionals** have worked
  on Barakah's development and operation, across **six dedicated talent-pipeline programmes** (2026).
- **Outreach:** ENEC at the **Tamouh Al Dhafra Career Fair, 30 April – 1 May 2025**, Baynounah Educational Complex
  (https://enec.ae/news/latest-news/supporting-emirati-talent-enec-participates-in-al-dhafra-career-fair-to-inspire-future-energy-leaders/) **[secondary]**.
- **Caution:** the widely-cited "80% Emirati" figure is from a pre-operational Gulf Business piece and is
  historical, not current (https://gulfbusiness.com/?p=36053) **[secondary]** — do not use it in product copy.
- **What Kafa'a could borrow:** make the **six pipeline programmes first-class objects** (cohort, intake, stage,
  conversion rate to hire, time-to-authorisation, retention at 1/3/5 years), and give the **Mawaheb cohort** an
  end-to-end sponsored-trainee journey — application → selection → funded training → qualification →
  hire → first-role readiness — with the hiring criteria visible to the trainee from day one.

### 15. Russia — **Rosatom Technical Academy** (the export-training model)
- **What it is:** Rosatom's continuing-education institution, made an **IAEA Collaborating Centre in October
  2024** across five programmatic domains — the first and only one covering those areas — with **SMRs newly
  added** as a focus. **Owner:** Rosatom (Russia). **Years:** MoC with IAEA and Rosenergoatom; 2024 designation.
- **Mechanism at El Dabaa (Egypt):** the training programme for a newcomer country's plant personnel begins with
  a **six-month Russian language course** for **465 Egyptian trainees**, then academic study of the **reference
  plant**, then **internships at Leningrad NPP-2** (an operating twin). Rosatom's contract covers **~1,700
  specialists trained by 2028** plus personnel training and O&M support **for the first 10 years of operation**.
  Earlier figure: **427 participants from 43 countries** trained in nuclear infrastructure.
- **Sources:** https://atommedia.online/en/reference/rosatom-na-blizhnem-vostoke-i-v-severnoy-afrike/ ;
  https://get-sim.ru/en/news/v-tekhnicheskoy-akademii-rosatoma-startovalo-obuch/ ;
  https://conferences.iaea.org/event/181/contributions/15817/attachments/8554/12431/292_Assistance_in_the_development_of_nuclear_infrastructure_in_the....pdf — retrieved 2026-10-10 **[secondary, largely vendor-affiliated]**
- **What Kafa'a could borrow:**
  1. The **reference-plant pattern**: tie every trainee to an operating twin (for ENEC: Barakah units for any
     future UAE SMR cohort, or Shin Kori 3/4 for APR-1400 lineage) and make "hours on the reference plant" a
     tracked competency input.
  2. **Language and cultural-readiness as a tracked competency** for international assignments and for an
     Arabic-first/English-technical workforce — Kafa'a is already EN/AR, so make bilingual technical proficiency
     assessable.
  3. If ENEC ever exports capability (ADVANCE, regional partnerships), Kafa'a becomes the **delivery platform for
     a training-export product** — a structured, saleable newcomer-country curriculum.

---

## Part 3 — Market and macro evidence (numbers to put on the dashboards)

### 16. IEA **World Energy Employment 2025**
- **Owner:** International Energy Agency. **Year:** published **Dec 2025** (covering 2024 data); first edition in
  the series to include **occupation-level estimates**.
- **Sources:** https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025 ;
  https://balkangreenenergynews.com/iea-employment-in-energy-sector-grows-two-times-faster-than-in-global-economy/ ;
  https://iifiir.org/en/fridoc/world-energy-employment-2025-151287 — retrieved 2026-10-10 **[secondary]**
- **Figures:** energy sector employed **76 million people in 2024**, **+5 million since 2019**, growth ~**2.2%**
  (about double the global economy). **60% of companies** in the IEA Energy Employment Survey reported **labour
  shortages**. Shortages are worst in technical trades — **electricians, pipefitters, line workers, plant
  operators, nuclear specialists** — and could hamper **nuclear refurbishment**. IEA warns skills shortages have
  contributed to **increased outages and reduced output in several advanced nuclear fleets**, with **defence
  nuclear and fusion competing for the same people**. To avoid further skill misalignment by 2030, **graduates
  entering the energy sector must rise ~40% globally**.
- **What Kafa'a could borrow:**
  1. A **Skills Market Outlook** page that puts ENEC's internal shortage signals next to external benchmarks
     (IEA occupation-level scarcity, regional pay movement), so a line manager sees *"this is a global
     bottleneck, not a local hiring failure"*.
  2. **Shortage-weighted retention risk**: flag employees in globally scarce occupations (I&C technicians, NDT,
     welding engineers, health physicists, licensed operators) for targeted retention and succession action.
  3. An **outage/output-risk link**: connect competency coverage of a critical system to an operational risk
     indicator — IEA's finding makes this a credible, executive-grade narrative.

### 17. IRENA / ILO **Renewable Energy and Jobs: Annual Review 2025** + IRENA **Skills Pledge**
- **Owner:** IRENA with the ILO. **Year:** 2025 (12th edition, 2024 data).
- **Sources:** https://build-up.ec.europa.eu/en/resources-and-tools/publications/annual-review-2025-renewable-energy-and-jobs ;
  https://tedmag.com/irena-publishes-2025-renewable-energy-and-jobs-review/ ;
  https://hlpf.un.org/sites/default/files/vnrs/2025/Inputs%202025%20IRENA.pdf — retrieved 2026-10-10 **[secondary]**
- **Figures:** at least **16.6 million renewable-energy jobs globally** in 2024; growth slowed to **2.3%** despite
  record capacity additions (attributed partly to geoeconomic frictions and **growing automation**); the
  **top five countries hold over 85%** of these jobs; women still face hiring and advancement barriers. IRENA
  calls for scaled education and training against shortages **particularly in digital skills and manufacturing**,
  and runs an **IRENA Skills Pledge** for governments and companies.
- **What Kafa'a could borrow:**
  1. A **public Skills Pledge mechanic**: ENEC and its UAE supply-chain partners publish numeric training
     commitments in Kafa'a, with progress visible — turns a CSR statement into a tracked metric.
  2. An **automation-exposure score** per role (which tasks are likely automated/AI-assisted in 5 years, which
     are not), driving a "future-proofing" recommendation on every career page.
  3. **Gender-equity analytics** built into the workforce dashboards (hiring, promotion, attrition, pay-band
     distribution by gender) — IRENA and IAEA both make this a headline, and WiN/ENEC can act on it.

### 18. WEF **Future of Jobs Report 2025** (the cross-sector reference every exec knows)
- **Owner:** World Economic Forum. **Year:** January 2025.
- **Source:** https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/ — retrieved 2026-10-10 **[secondary]**
- **Figures:** employers expect **39% of workers' core skills to change by 2030** (down from **44%** in 2023, which
  WEF attributes partly to more continuous-learning and reskilling programmes); **50% of the workforce** has
  completed training as part of long-term learning strategies (up from **41%** in 2023); the green transition is a
  top driver of change.
- **What Kafa'a could borrow:**
  1. A **"skill half-life" indicator** on each competency (stable / evolving / volatile), shown on the employee's
     own skill profile so they can see which of their strengths are depreciating.
  2. **Learning-participation as a tracked org KPI** against the 50% benchmark — a number ENEC's HR leadership
     can report externally.
  3. A **personal "39%" view**: of your current core skills, which are projected to change — with the
     recommended learning attached to each.

### 19. Thomas Thor / recruitment-market intelligence (2025-26)
- **Owner:** Thomas Thor (nuclear-specialist recruiter) and peers. **Year:** 2025 review / 2026 predictions.
- **Sources:** https://www.thomas-thor.com/?p=26194 ; https://www.energymonitor.ai/sponsored/nuclear-energy-hiring-is-slowing-in-north-america-but-leaders-can-see-where-capacity-and-risk-are-shifting/ ;
  https://wnn.world-nuclear.org/articles/viewpoint-reframing-nuclears-talent-challenge-why-scarcity-is-a-myth-and-opportunity-abounds — retrieved 2026-10-10 **[secondary, recruiter/vendor material — verify before citing]**
- **Findings:** 2025 was the year **"People"** became the sector's primary constraint once financing made projects
  investable; **attrition through retirement across OECD countries was "really noticeable", especially among
  senior leaders and subject-matter experts**; 2026 prediction: employers face hard choices on **working location
  and flexibility**. US DOE's 2025 Energy & Employment Report counted **67,900 nuclear workers in 2024** (roughly
  flat), with employers forecasting a **9.2% increase in nuclear construction**. North American job postings rose
  June 2025 – Jan 2026 then contracted for four months.
- **What Kafa'a could borrow:**
  1. A **"senior SME and leader" retirement cliff view** — the specific cohort the market says is scarcest — with
     successor coverage per named individual.
  2. **Flexibility/location preference capture** in the employee profile, used in internal mobility matching
     (and as retention intelligence).
  3. A **"scarcity is a myth, adjacency is the answer"** feature: surface adjacent talent pools (UAE oil & gas,
     defence, aviation, heavy industry) with mapped conversion paths rather than competing only for nuclear-badged
     candidates.

---

## Part 4 — Future-facing competency domains (what "future skills" concretely means in nuclear)

### 20. AI and digital twins in nuclear operations — IAEA "Atoms for Algorithms"
- **What it is:** The IAEA's **AI for Atoms** platform tracks its AI activities, publications and events and
  co-operates with the ITU and ~40 UN organisations; the IAEA held its **first AI and nuclear energy symposium**
  at Vienna HQ, framed by DG Grossi as **"Atoms for Algorithms"** (reported **Dec 2025**, **250+ organisations**
  attending, including Google and Oracle). The IAEA is leading a **coordinated research project on AI and
  innovative technology to accelerate SMR deployment**, and is considering **IAEA Collaborating Centres focused
  on AI**.
- **Mechanism:** IAEA Bulletin describes digital twins as AI-enhanced tools that analyse plant data to improve
  operations, with **predictive maintenance** relying on digital replicas of real facilities.
- **Sources:** https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence ;
  https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/ ;
  https://aiforgood.itu.int/about-us/un-ai-actions/iaea/ — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. A **"Nuclear + AI" competency family** that is operational rather than generic: predictive-maintenance data
     interpretation, digital-twin model validation, **AI output verification and the duty to challenge it**,
     anomaly triage, prompt/agent use within a safety-classified boundary, data quality for plant data.
  2. **AI-assurance literacy as a mandatory competency** for anyone whose decisions can be informed by a model —
     explicitly covering when *not* to trust an output. This is the differentiator for a nuclear operator and
     maps cleanly onto nuclear's existing "questioning attitude" culture.
  3. A **digital-twin sandbox** learning object: trainees work a scenario against a plant model and are assessed
     on diagnosis, not on recall.

### 21. OT / ICS cybersecurity — IAEA NSS 42-G, NSS 17-T Rev.1, and the NICE Framework's first OT role
- **What it is:**
  - **IAEA NSS 42-G** (**2021**, 86pp) — the IAEA's first implementing guide comprehensively addressing
    **computer security** as a component of nuclear security; covers State roles and the elements of a computer
    security programme, and is explicitly intended as a basis for **national frameworks, regulations and
    training**. **NSS 17-T Rev.1** is the technical companion for facilities, covering **I&C systems, safety
    systems**, and **defensive computer security levels and zones**.
  - **NIST/NICE Framework v2.0.0** added its **first OT-focused work role**: **Operational Technology (OT)
    Cybersecurity Engineering (DD-WRL-009)** — *"working within the engineering department to design and create
    systems, processes, and procedures that maintain the safety, reliability, controllability, and security of
    industrial systems"* — in the Design and Development category, with tasks such as **T2049 (serve as OT
    engineering SME for cybersecurity standards, policies and procedures development)** and skills such as
    **S0950 (reviewing access control lists and firewall rules)**. NICCS lists **52 work roles, 2,200+ TKS
    statements, 11 competency areas**.
- **Sources:** https://www.iaea.org/node/97473 ; https://www-pub.iaea.org/MTCD/publications/PDF/PUB1918_web.pdf ;
  https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering ;
  https://niccs.cisa.gov/workforce-development/nice-framework — retrieved 2026-10-10 **[secondary]**
- **Note:** no direct IAEA↔IEC 62443 competency mapping was found; **IEC 62443 role certification exists
  commercially but was not corroborated by a primary source in this pass** — flag as "to verify" rather than
  asserting it.
- **What Kafa'a could borrow:**
  1. Adopt the **NICE TKS grammar** (Task / Knowledge / Skill statements with stable IDs) as the internal format
     for *all* Kafa'a competencies, not only cyber. It is public, granular, machine-readable, and instantly
     familiar to auditors — and it gives every competency a citable identifier.
  2. An **OT-cyber competency track for engineers, not just IT**: the NICE v2.0.0 move puts OT security inside
     the engineering department, which matches how a plant actually works. Target I&C engineers, maintenance
     technicians and operators with role-appropriate depth.
  3. **Zone-and-conduit literacy** (NSS 17-T's defensive levels/zones) as an assessable competency with
     scenario-based items — who may connect what, where, and under which authorisation.

### 22. Nuclear knowledge management as an engineering discipline (IAEA KM + INMA)
- **INMA** — the IAEA's **International Nuclear Management Academy**: it endorses university **master's
  programmes in nuclear technology management** against an IAEA competency model. ~**10 accredited universities**
  reported (incl. Texas A&M, University of Tokyo, Wits, MEPhI); **North-West University (South Africa)**
  recommended for endorsement; **Sofia University (Bulgaria)** endorsed **early 2025**; MEPhI graduated its first
  **15** NTM masters in 2018 and **12** in 2025 (6 from Kazatomprom).
- **IAEA School of Nuclear Energy Management** — targeted at young professionals in Member States planning or
  starting nuclear programmes; the Japan-hosted NEM programme serves as an INMA practicum component.
- **Sources:** https://www.iaea.org/node/17745 ; https://eng.mephi.ru/news/120165 ;
  https://news.nwu.ac.za/nwu%25E2%2580%2599s-nuclear-programme-gets-international-green-light ;
  https://phys.uni-sofia.bg/?p=28612 — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. A **"nuclear management competency" model** distinct from technical competency — INMA's premise is that
     managing a nuclear organisation is itself a discipline with examinable content (safety culture, regulatory
     affairs, project and cost control, stakeholder and international affairs, knowledge management).
  2. **University-programme endorsement records** inside Kafa'a: which UAE/partner degrees map to which ENEC
     competencies, so a graduate's prior learning is recognised automatically at hire.
  3. **Recognition of Prior Learning (RPL)** workflow generally: evidence submission → assessor → partial
     competency credit, which shortens the mid-career-switcher journey (ties to #9.1).

### 23. ENEN2plus — Europe's mobility-funded skills network (and ESTA for SMRs)
- **What it is:** The EU's flagship nuclear education project, coordinated by **ENEN**, started **June 2022**
  (CORDIS project **101061677**), running to **May 2026**. **ESTA** (European Small and Advanced Training Academy)
  is an ENEN initiative developed in **2023** to coordinate EU-level SMR education and training.
- **Mechanism:** a **transnational mobility fund** — lump-sum grants paid **directly to the applicant** for
  transport, subsistence and registration fees, for **internships, on-the-job training, study/research exchanges,
  conference participation and training courses**; eligible to students and **early-career professionals with up
  to 10 years' experience**; **application deadlines every 2 months**. Predecessor ENEN+ moved **500+ learners**.
  The project also builds a **centralised platform of vocational training programmes** and analyses **EU supply
  and demand of nuclear human resources**.
- **Sources:** https://cordis.europa.eu/project/id/101061677 ; https://www.nucleareurope.eu/project/enen2plus ;
  https://conferences.iaea.org/event/374/papers/30968/files/12400-Paper%2087.docx — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. A **rolling micro-grant mechanism** inside the portal: small, fast, **bi-monthly** funding rounds for
     conferences, short courses, site visits and exchanges, applied for in-app with a lightweight approval — far
     more motivating than an annual training budget cycle, and it generates a rich competency-acquisition trail.
  2. **A single UAE/GCC training catalogue** aggregating ENEC, Khalifa University, TII, ADNOC Academy, KINGS,
     IAEA and WNU offerings in one searchable place with eligibility and funding status.
  3. **Up-to-10-years-experience "early career"** as an explicit segment with its own programme shelf — most
     corporate portals segment by grade, not by career stage, and lose this cohort.

### 24. Fellowships and gender equity — IAEA **MSCFP** and **Lise Meitner Programme**
- **MSCFP** (Marie Skłodowska-Curie Fellowship Programme): launched **2020**, master's studies in nuclear
  disciplines for women; **~3,100 applications** received and **760 women from 129 countries supported** as of
  **Sept 2025**; by end-2023 there were **560 fellows, 173 having completed** their master's. 2025 cycle closed
  **31 Oct 2025**.
- **Lise Meitner Programme**: launched **2023**, a **multi-week visiting professional programme** for early- and
  mid-career women.
- Context: the IAEA states **women are only about a fifth of the nuclear workforce**.
- **Sources:** https://www.iaea.org/node/136445 ; https://www.ans.org/news/2025-09-09/article-7354/applications-open-to-women-for-2025-iaea-fellowship-program/ ;
  https://www.iaea.org/publications/reports/annual-report/2023/in-focus/together-for-more-women-in-nuclear — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. A **sponsored-study programme object** with the MSCFP's two-part design — **funding + a placement/internship**
     — because the fellowship's distinguishing feature is that study is paired with industry exposure.
  2. **Completion-rate tracking as the headline metric** (173 of 560 completed), not award counts — it forces
     honest programme management.
  3. A **WiN-UAE / women-in-nuclear surface**: mentor matching, visiting-professional placements, and a cohort
     network, with the pipeline metrics (hiring, promotion, retention) exposed to programme owners.

### 25. Simulators as the core future-skills instrument — NuScale **E2 Centers**
- **What it is:** NuScale's **Energy Exploration (E2) Centers**: simulated SMR control rooms installed on
  university campuses, where users act as **control-room operators of a 12-unit plant**. **Owner:** NuScale
  Power (US) with host universities. **Years:** first unveiled **Nov 2020** (Oregon State); **UNLV opened 2 April
  2025**, co-funded by a **DOE Nuclear Energy University Program** grant; **South Carolina State opened May 2025**
  as the **10th in the world**. Sites include Idaho State, Ohio State, Oregon State, RPI, Texas A&M, UNLV, plus
  Romania and Ghana.
- **Stated mission:** building **a pipeline of skilled graduates** for the industry.
- **Sources:** https://www.businesswire.com/news/home/20201117005266/en ;
  https://unlv.edu/announcement/howard-r-hughes-college-engineering/unlv-opens-nuscale-power-nuclear-reactor-simulator ;
  https://www.neimagazine.com/news/sc-state-unveils-nuscale-nuclear-training-hub/ ;
  https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. **Simulator sessions as structured, bookable, assessed learning objects** — booking, scenario, role,
     debrief, competency credit — linking ENEC's Barakah simulator centre into the same record as classroom
     learning (nuclear's best asset is usually invisible to its LMS).
  2. A **browser-based "lite" plant simulation** for non-operators (engineers, HR, communications, finance,
     supply chain) so the whole organisation gains plant literacy — exactly the E2 Center outreach model.
  3. **University-hosted simulator partnerships** (Khalifa University, Abu Dhabi Polytechnic) surfaced in Kafa'a
     as a public pipeline feature.

### 26. **Nordic Nuclear Trainee Programme (NNTP)** — the multi-employer cohort
- **What it is:** A trainee programme **jointly organised by four competing operators** — Fortum, TVO, Uniper and
  Vattenfall. **Owner:** Nordic nuclear industry (Finland/Sweden). **Years:** launched **2019** (first intake ~**15**
  university students/graduate engineers and technicians for 2020); the **fourth round runs Jan–Dec 2027**.
- **Mechanism:** **six in-person modules of three days each**, including **site visits to nuclear facilities
  across the Nordics**, plus a **project assignment** and **mentoring**. Roles are tied to new-build preparation.
- **Sources:** https://www.fortum.com/careers/NNTP ; https://www.fortum.com/media/2019/10/nordic-nuclear-power-companies-starting-trainee-programme-future-engineers ;
  https://fortum.com/services/nuclear/operating-nuclear-power-plants/training-services — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. A **consortium cohort model**: ENEC + ADNOC + TAQA/EWEC + Masdar + Khalifa University running a shared UAE
     energy trainee programme in Kafa'a, with cross-employer site visits — competitors co-operating on pipeline
     is the Nordic lesson.
  2. The **module + project + mentor triad** as the standard template for every ENEC development programme, so
     cohorts are comparable and measurable.
  3. **Cross-site visit logging** as a competency input (plant literacy across technologies).

### 27. US DOE — funding the training system itself
- **What it is:** Federal money aimed squarely at workforce rather than research.
  - **$100 million** announced to establish a **Nuclear Safety Training and Workforce Development Program**, open
    to private higher-education institutions, non-profits and governmental entities with a **50% cost share**.
  - **April 2026: ~$49.7m awarded to 10 university-led projects**; largest award **$19.2m** to the **Great Lakes
    Partnership to Enhance the Nuclear Workforce** (led by University of Toledo, including ANS).
  - **March 2026: $52.8m** released via **NEUP** and **NSUF** — covering nuclear technology development,
    early-career faculty research, **undergraduate scholarships** and **graduate fellowships**.
  - **NEI Nuclear Energy Workforce Summit**, Washington DC, **6–8 Oct 2026**, framed as a working summit of
    industry, government, education and labor.
  - Scale of need: an INL analysis estimates **~4,000 workers per year, 108,000 by 2050**, to sustain the existing
    US operating fleet workforce (2023/2024).
- **Sources:** https://neup.inl.gov/announcement/nuclear-safety-training-and-workforce-development-program-amendment-001/ ;
  https://www.ans.org/news/step-1772830959/ ; https://www.nei.org/conferences/nuclear-energy-workforce-summit ;
  https://lwrs.inl.gov/content/uploads/11/2024/03/FactorsAffectingHiringRetainingNuclearWorkforce.pdf — retrieved 2026-10-10 **[secondary]**
- **What Kafa'a could borrow:**
  1. A **grants/sponsorship module**: ENEC-funded university projects, scholarships and fellowships managed
     in-app — call for proposals, award, milestones, resulting graduates tracked into the hiring funnel.
  2. **Cost-share partnerships** as a structure (ENEC 50% / university 50%) made visible, which is how a national
     training system scales beyond one employer's budget.
  3. **"Workers per year to steady-state"** as a headline workforce metric (INL's framing) — a far more
     actionable number than total headcount.

---

## Part 5 — Cross-cutting design lessons for Kafa'a

1. **Competency is a graph, not a list.** Every serious framework found here (NICF, NICE TKS, SAT/ACAD) links
   competency → task → activity → regulatory/operational purpose, and only then → learning content. Kafa'a should
   store the graph; the catalogue is a view over it.
2. **Evidence beats completion.** INPO/ACAD, IAEA TECDOC-1917 and the SAT model all treat *demonstrated
   performance* (JPM, simulator observation, supervisor attestation, behavioural assessment) as the unit of
   record. Course completions should be inputs to a competency claim, never the claim itself.
3. **Forecast in scenarios.** NG-T-3.10 ships three-scenario demand curves; France's MATCH refreshes job-by-job
   annually. Kafa'a's workforce planning should default to bands and annual refresh, never a single number.
4. **The scarcest asset is departing knowledge, and it has a date.** IAEA KLRM + the IEA/Thomas Thor retirement
   findings + ENEC's own KHNP-support taper all point to the same product: a knowledge-loss register with named
   successors and capture artefacts, counted down to a deadline.
5. **Build for the people who are not nuclear yet.** France: one in two needed by 2030 is not in the industry.
   UK: Destination Nuclear targets career-changers. Canada: Sask Polytech sells short courses to mining and
   utilities workers. The transferable-skills translator may be Kafa'a's highest-ROI single feature in a country
   with a very large adjacent energy workforce.
6. **Portability is the emerging standard.** The Skills Passport idea (UK 2011 → Sellafield verifiable credentials
   2022 → Skills England 2026) keeps recurring because contractor-heavy, outage-driven industries pay a real price
   for non-portable competence records. A selectively-disclosable Kafa'a passport is both an employee benefit and
   an operational efficiency.
7. **"Future skills" in nuclear = AI assurance + OT security + digital-twin literacy + SMR delta.** These four are
   where the primary sources actually point. They are concrete, assessable, and nobody's LMS has them yet.

---

## Source verification notes
- **Read directly via curl in this session:** NEA *Plan 2035* vision paper (Oct 2025) and IAEA **NG-T-3.10**
  (Pub1477) — all quotations and the three-scenario/flow-chart details above come from the PDFs themselves;
  WNN's 2024-05-16 UK skills-plan article (all UK figures read from the page).
- **oecd-nea.org is Cloudflare-blocked** from this container; NEST figures are from search digests of NEA pages and
  should be re-read from a browser before publication.
- **Unverified / flagged:** the Sellafield **~80% on-boarding reduction** (trial/vendor estimate);
  recruiter-sourced market figures (Thomas Thor, Airswift, Rullion, Planet Group, sponsored Energy Monitor);
  the "80% Emirati" ENEC figure (pre-operational, historical); any IAEA↔**IEC 62443** competency mapping (not
  corroborated); **IAEA TECDOC-1963** (simulators for training and authorisation of personnel, 2021) was referenced
  in a publications listing but its contents were not confirmed.
