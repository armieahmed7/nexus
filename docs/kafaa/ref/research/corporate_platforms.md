# Kafa'a benchmark research — Corporate & vendor future-skills platforms

**Researched:** 10 October 2026. **Theme:** future skills and competencies.
**Scope:** corporate upskilling programmes, HR-tech skills platforms (vendor mechanics), and AI-literacy obligations/frameworks.
**Read-only run:** nothing in `/workspace/kafaa`, Supabase or Netlify was touched.

## How to read this file — evidence tiers

Most "results" in this market are **self-reported or vendor-reported**. I have tagged every number:

- **[P]** Primary document I retrieved and read directly (PDF or official page text pulled with curl).
- **[V]** Vendor-published (Gloat, TechWolf, Eightfold, Beamery…) — marketing claims, often computed with the vendor's own estimating formula. Usable as *design evidence* ("this feature exists and the client let it be published"), **not** as a forecast for ENEC.
- **[S]** Secondary/trade press reporting a company's own claim.
- **[?]** Could not verify; figure circulates without a traceable primary source. **Do not put these in a Kafa'a business case.**

Three sources were **unreachable from this container** and should be re-checked by someone on an unrestricted network: `help.pluralsight.com` (Cloudflare JS challenge), `unesco.org` / `unesdoc.unesco.org` (captcha), `blogs.microsoft.com` (403). Figures from those three are tagged **[S]** below.

---

# PART A — Corporate programmes

## A1. Schneider Electric — "Open Talent Market" (internal talent marketplace)

- **What it is:** A two-sided internal marketplace: managers post open positions, short projects ("gigs") and mentorships; employees get AI-matched recommendations against skills, past experience and stated aspirations.
- **Owner/country:** Schneider Electric (France), ~135,000 employees. Built on Gloat. Pilot in HR function, then a deliberate "big bang" global launch **April 2020** (they chose speed to signal that growth was alive during COVID).
- **Mechanism users actually see [P]:**
  - Profile build takes **~15–30 seconds of employee time** — the case study quotes both "30 second time investment" and "15 second time-spend to receive personalized opportunities" (inconsistent within the same PDF; treat as "under a minute").
  - Three opportunity types in one feed: **positions, projects, mentorships**. The VP explicitly names these three as the reason they picked the vendor.
  - Employees "handpick" experiences; managers receive a ranked slate of internal candidates.
  - **De-biasing claim:** matching leads with skills and experience, and draws on pre-Schneider history held in the employee inventory, so project slates are not limited to who the manager can already see or who sits nearby geographically.
- **Driver:** internal surveys found **~50% of leavers cited lack of internal growth opportunity as their primary reason for leaving** [P].
- **Published results [P/V]** (Gloat case study PDF, retrieved 10 Oct 2026):
  - **>60% adoption within two months**; >2,300 employees exploring new roles.
  - **~127,000 hours of "hidden capacity"** unlocked in the first weeks; **>200,000 hours** to date.
  - **>$15,000,000** claimed savings (productivity + reduced recruiting spend) — vendor-computed.
  - **>7,500 people found mentors** inside the business.
  - **55% of all project/gig assignments went to female applicants.**
  - **81% of employees would recommend** the platform.
- **Source:** https://gloat.com/wp-content/uploads/Schneider-Electric-Gloat-Case-Study.pdf (undated PDF; narrative covers Apr 2020 → ~2022). Secondary: https://www.sdxcentral.com/news/schneider-electric-expands-open-talent-market-for-employee-growth/
- **What Kafa'a could borrow:**
  1. **Three-lane opportunity feed** — *Positions / Projects (gigs) / Mentorship* as one ranked list, not three disconnected modules. ENEC fit: outage campaigns, ADVANCE/SMR studies and KHNP knowledge-transfer tasks are naturally "gigs".
  2. **Sub-60-second profile onboarding** with progressive enrichment — ask for 3 things, infer the rest; adoption collapses if the profile is a form.
  3. **"Unlocked hours" as the headline KPI**, surfaced to leaders on a dashboard: hours of internal capacity redeployed rather than contracted out. This is the single most borrowable metric framing in this whole file for a plant operator with contractor spend.
  4. **Equity telemetry by default**: % of gig assignments by gender / by Emirati vs expatriate / by site (Barakah vs Abu Dhabi HQ) published back to the business.

## A2. Unilever — "FLEX Experiences"

- **What it is:** Internal project/gig marketplace matching employees to short business-critical projects, plus mentoring and learning. Owner: Unilever (UK/NL). Pilot ~2019 with ~1,000 employees, scaled through 2020–21 across 90+ countries.
- **Mechanism:** employees allocate a slice of their time (the model is "a few hours a week") to projects outside their line role; AI matches skills + aspirations to project demand. Managers post projects with a required-skills list and a time envelope.
- **Published results — note the figures disagree across sources, use with care:**
  - **41% improvement in overall productivity** and **+20% internal collaboration time** [V/S].
  - Hours unlocked: **~700,000** (Gloat customer story) vs **500,000 worker-hours re-prioritised to >3,000 business-critical projects** (Gloat PDF, quoting Patrick Hull) vs **>112,000 hours** (HR Magazine) vs **60,000+ in two months** during the pilot (People Matters). The spread is because the sources cover different windows and definitions. **[V/S/?]**
  - COVID redeployment: **>700 business-critical projects staffed and >26,000 hours unlocked in the first two months of the pandemic**; an ICMR case abstract says **~8,300 employees** were redeployed from slowing to growing businesses. [V/S]
  - **62–67% of opportunities went to female employees** (two different Gloat figures). [V]
- **Sources:** https://gloat.com/wp-content/uploads/How-Unilever-Uses-AI-to-Retain-Engage-and-Develop-Employees.pdf ; https://www.hrmagazine.co.uk/article-details/international-case-study-unilevers-internal-project-platform ; https://icmrindia.org/Short%20Case%20Studies/Human%20Resource%20Management/CLHR083.htm
- **What Kafa'a could borrow:**
  1. **A formal "time envelope" contract** — e.g. "up to 10% of your time, line-manager approves once, not per task". The hard blocker for gig marketplaces in operating plants is the line manager, not the employee; Unilever's answer was to make the release pre-negotiated.
  2. **Crisis-redeployment mode**: a switch that re-ranks the marketplace around a declared surge (outage slip, regulatory response, unplanned trip) and reports hours mobilised within 48h.
  3. **Project-completion → verified-skill write-back**: a finished gig should deposit evidence against the competency record, not just a line on a CV.

## A3. Mastercard — "Unlocked"

- **What it is:** Internal talent marketplace (positions, projects, learning, mentorship) rolled out to the full global workforce in **2022**, ~35,000 employees. Built on Gloat. Origin story: a 2020 pandemic redeployment effort run on spreadsheets ("Project Possible") that they then automated.
- **Results [V/S]:** **62% of employees registered within a few months** of launch; in 2024, **3,000 project roles filled** and **>1,300 mentoring relationships formed**; Gloat computes **31,740 work-days saved** in one year (projects assigned × estimated days saved per project — an estimating formula, not measurement).
- **Sources:** https://gloat.com/wp-content/uploads/Mastercard-case-study-2024.pdf ; https://gloat.com/wp-content/uploads/2023/02/TM-22_11-Mastercard-Unlocks-the-Potential-of-Its-People-with-an-Internal-Talent-Marketplace-Case-Study-2.pdf ; https://www.charterworks.com/mastercard-learning-development-ai/
- **What Kafa'a could borrow:**
  1. **Start from the manual process you already run.** ENEC already redeploys people for outages by spreadsheet/phone. Digitise *that* flow first — it is the proven adoption path in both Mastercard and Unilever.
  2. **Publish the annual activity ledger** (projects filled, mentorships formed) as an in-product page, not a slide — it is what sustains executive sponsorship in year 2.
  3. **Be transparent about the savings formula.** Mastercard/Gloat's "days saved" is assumption-driven; Kafa'a should show the formula and let the user change the assumption.

## A4. AT&T — "Workforce 2020" / "Future Ready" + the **Career Intelligence** tool

This is the deepest and most transferable corporate case for ENEC, because AT&T faced the same structural problem: a large, unionised, technically-specialised workforce whose core skills were going obsolete on a known timeline.

- **Owner/country:** AT&T (US), ~250,000–300,000 employees, roughly half unionised. Programme ran from ~2013; **Career Intelligence launched 2014**.
- **Mechanisms users actually see [S]:**
  - **Role consolidation: 250 job titles collapsed into ~80**, deliberately, so that mobility between them became legible. *This is a prerequisite, not a feature* — you cannot run a skills marketplace on a sprawling job catalogue.
  - **Career Intelligence** shows each employee: which internal jobs are **in demand**, **where** they are located, their **potential/fit**, the **skills required**, and **how to close the gap** — plus an explicit signal of which roles are **shrinking**. The radical part was telling people their own job was declining.
  - Badges and nanodegrees (with Udacity) as the credential layer; tuition support for advanced degrees in CS, data analytics, data science and cybersecurity.
- **Published results [S]:** >2.7m "skills transformation" course completions and >100,000 badges by mid-2018; **5.2m courses completed since 2016** and **>3,000 nanodegrees** by mid-2019; >700 employees in funded advanced degrees. Executives stated that **internal applicants who completed reskilling training were ~50% more likely to win an internal role** (self-reported, not a controlled study).
- **Sources:** https://www.chieflearningofficer.com/2018/05/24/att-committed-future/ ; https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/
- **What Kafa'a could borrow:**
  1. **A "role weather report"** on every role page: demand trend (growing / stable / shrinking), headcount, typical next moves, and — critically — **honest decline signals** for roles affected by automation, digital I&C, or the end of KHNP operator support around 2030.
  2. **"Jobs you can reach" ranked by closeness**, each with the exact gap list and the training that closes it, and an estimated time-to-ready in months.
  3. **Reskilling → selection advantage, made explicit and measurable**: publish the internal-fill statistic for people who completed a gap-closing path vs those who did not. It is the single strongest motivator AT&T found.
  4. **Job-architecture consolidation as a pre-project**: Kafa'a's competency model should be the forcing function that collapses redundant ENEC role titles into a navigable lattice.

## A5. Amazon — Upskilling 2025 / Career Choice / Machine Learning University

- **Owner/country:** Amazon (US). Announced 2019 as $700m / 100,000 US employees; **expanded Sept 2021 to >$1.2bn and 300,000 employees by 2025** [S, Business Wire].
- **Mechanisms:** a **portfolio of named, tiered programmes** rather than one platform — Career Choice (pre-pays full tuition at 140+ partner colleges, plus high-school diplomas, GEDs and ESL certification for front-line staff), Machine Learning University (graduate-level ML for staff who already code), plus apprenticeships and technical academies. Career Choice deliberately funds training for **in-demand jobs including ones outside Amazon**.
- **Results [S]:** >70,000 employees had participated across nine upskilling programmes as of 2021. No audited 2024/25 outcome data surfaced in this search.
- **Sources:** https://press.aboutamazon.com/2021/9/amazon-to-pay-full-college-tuition-for-its-front-line-employees-as-part-of-1-2-billion-investment-in-education-and-skills-training-for-u-s-workforce ; https://www.businesswire.com/news/home/20220303005374/en/
- **What Kafa'a could borrow:**
  1. **A named programme catalogue with explicit eligibility and funding rules** — "you are eligible for X after N months, it pays Y% up to Z, apply here" — rendered as a personalised eligibility card, not a PDF policy.
  2. **Tiered entry points**, from literacy-level (language, numeracy, digital basics) up to graduate-level technical, so non-degreed plant and craft staff see themselves on the ladder. Directly relevant to Emiratisation pipelines at Barakah.
  3. **Fund portable skills openly.** Career Choice's willingness to fund roles outside the company is the trust mechanism that makes participation safe to admit to.

## A6. IBM — SkillsBuild (external) + Your Learning (internal) + digital credentials

- **Owner/country:** IBM (US). **Commitment: skill 30 million people globally by 2030**, with an interim **2 million in AI by 2026**; announced with >170 new academic/industry partnerships across 30+ countries. Dec 2025: a further pledge of 5 million people in India by 2030 via SkillsBuild, which carries **1,000+ courses**.
- **Mechanisms users see:** free self-paced **learning plans** (e.g. "AI Fundamentals", 10+ hours) grouped into **learning paths**; completion issues an **IBM digital credential shareable through Credly**; a job-seeker track adds mentoring and hands-on experience. Credentials are accepted as evidence toward UK apprenticeship off-the-job training requirements.
- **Internal (Your Learning) [S]:** ~**45,000 daily employee users**; **98% of IBM employees use it each quarter**; **>1 million badge certifications earned**. MIT research (Qin & Kochan working paper, 2020) found IBM employees averaged **77 learning hours in 2019**, that **>300,000 learning resources** were available (~60% internally authored), and — the important finding — that **earning badges, especially in skills the company designated strategic, was positively associated with hitting performance targets and with promotion**.
- **Sources:** https://digital-skills-jobs.europa.eu/en/inspiration/good-practices/ibm-skillsbuild ; https://www.businesstoday.in/technology/news/story/ibm-pledges-to-train-5-million-indian-youth-in-future-technologies-by-2030-507421-2025-12-19 ; https://www.shrm.org/topics-tools/news/organizational-employee-development/learning-development-ibm-qa ; https://workofthefuture-taskforce.mit.edu/document/2020-working-paper-qi-kochan ; https://cityandguildsfoundation.org/skillsbuild
- **What Kafa'a could borrow:**
  1. **"Strategic skills" badge tier.** Mark a subset of badges as ENEC-strategic (SMR/ADVANCE, digital I&C, AI-assisted operations, Arabic-language technical authoring, KHNP-handover knowledge areas) and **bind them to real consequences** — promotion panels, assignment eligibility — then report the correlation back, as the MIT study did. Badges without consequences are wallpaper.
  2. **An externally-verifiable credential wallet** (Credly-style public verification URL) so an ENEC credential is portable and therefore valued.
  3. **A quarterly-active-learner metric** (IBM's "98% each quarter") as the platform health KPI rather than registrations.

## A7. Microsoft — Elevate / Elevate Academy

- **Owner/country:** Microsoft (US), announced **9 July 2025** by Brad Smith. **>$4bn in cash, AI and cloud technology over five years** to K-12, community/technical colleges and nonprofits; absorbs Microsoft Philanthropies and Tech for Social Impact.
- **Mechanism:** **Elevate Academy** — a credential ladder "from foundational AI fluency to advanced technical training", delivered through **LinkedIn Learning and GitHub**. Goal: **20 million people earning an AI credential** (sources differ on a two-year vs five-year window).
- **Claimed progress [S, ITU/AI-for-Good]:** in the preceding year Microsoft "reached 60 million people, trained 15 million, and helped 5 million earn an AI credential."
- **Critical note worth carrying into a Kafa'a business case:** The Register observes that most of the money is AI and cloud *credits*, and that vendor-backed certification records are mixed. Treat vendor AI credentials as **one input** to a competency decision, never the decision.
- **Sources:** https://www.theregister.com/2025/07/09/microsoft_ai_training/ ; https://www.geekwire.com/2025/as-ai-reshapes-its-workforce-microsoft-commits-4-billion-to-help-others-adapt/ ; https://aiforgood.itu.int/how-microsoft-is-driving-global-change-through-ai-skills/ ; https://www.eweek.com/news/microsoft-elevate-ai-training/
- **What Kafa'a could borrow:**
  1. **An explicit AI-fluency ladder** with named rungs (Aware → Practitioner → Builder → Assurer) mapped to ENEC job families, rather than one generic "AI course".
  2. **Credential-source trust tiers** in the data model: ENEC-assessed > regulator/accredited third party > vendor self-serve. Show the tier on the badge so panels weight it correctly.

## A8. Google Career Certificates + Google AI Essentials

Retrieved and read the primary impact report PDF.

- **Owner/country:** Google / Grow with Google (US), programme launched 2018. **Impact report published 29 May 2025.** [P]
- **Mechanisms users see [P]:** 6 entry certificates (Cybersecurity, Data Analytics, Digital Marketing & E-commerce, IT Support, Project Management, UX Design) plus advanced ones; **offered in 10 languages, no degree required, 100% online and self-paced, designed for completion in 3–6 months**; **ACE-recommended for up to 15 college credits**; graduates enter an **employer consortium** that actively considers them for roles.
- **Results [P]:**
  - **>1,000,000 graduates globally; 350,000 in the US** (Google internal data, Dec 2024).
  - **>70% of US graduates report a positive career outcome** (new job, promotion, or raise) — graduate survey, US 2024. *(An older Google page said 75% within six months; different cutoff.)*
  - Learner profile: **40% were unemployed or underemployed at start; 55% worked full-time while studying; 1 in 4 are primary caregivers; 1 in 10 are service members, veterans or military spouses.**
  - Market framing (Lightcast 2024 job postings): certificates map to **1.6 million open US jobs** in fields with a **$97,000 median US salary** — *this is a market statistic, not a measured graduate wage gain. Do not quote it as an outcome.*
  - **Google AI Essentials** (under 6 hours, covering prompting and responsible use) was **the most-enrolled course on Coursera in 2024**; graduate survey: **91% feel more confident applying the AI skills at work, 86% expect productivity gains, 81% expect improved job performance** — all self-reported perception, not performance measurement.
  - Ecosystem: **150+ consortium employers**, **800+ educational institutions**, **>2,000 businesses** using the certificates for internal upskilling (Siemens, T-Mobile, Southwest, Albertsons named). Siemens' Global Head of Learning & Growth is quoted on using them at scale.
- **Source [P]:** https://services.google.com/fh/files/misc/new_google_career_certificates_impact_report.pdf ; announcement https://blog.google/outreach-initiatives/grow-with-google/google-career-certificates-impact-report-may-2025/
- **What Kafa'a could borrow:**
  1. **Design every pathway to a 3–6 month completion envelope with an explicit weekly hour cost**, and show "people like you finished in N weeks". Completion is the whole game for shift workers.
  2. **Separate "market opportunity" from "measured outcome" in the UI.** Google's own report keeps them apart with footnotes; Kafa'a should do the same so ENEC never over-claims to employees.
  3. **A learner-profile equity dashboard** (what share of completers were in operations vs engineering, Emirati vs expatriate, shift vs day, female) — Google publishes caregiver/veteran/full-time shares precisely because it proves accessibility.
  4. **A short, mandatory AI-fluency course (<6 hours) as the universal on-ramp**, with a confidence/benefit pulse survey attached, plus an ENEC AI-use policy quiz — this also discharges a literacy duty (see C1).

## A9. PwC — "New world. New skills." + Digital Fitness

- **Owner/country:** PwC (global), announced **late 2019**: **$3bn over four years**, aimed at upskilling all ~276,000 staff plus community programmes.
- **Mechanism:** a **Digital Fitness app** that scores an individual's digital capability and prescribes content, plus skills academies, gamification, incentives for staff who build digital tools/automations, and leadership tracks. A "digital accelerator" cadre was pulled out of their day jobs to go deep.
- **Results:** executives claim strong outcomes but **published no figures** in anything I could reach. **[?]** — do not cite PwC outcome numbers.
- **Sources:** https://www.pwc.com/bb/en/press-releases/2019/3bn-investment-in-digital-upskilling.pdf ; https://www.hrdive.com/news/how-pwc-keeps-its-digital-upskilling-relevant/577780/ ; https://accountingtoday.com/news/pwc-invests-3b-in-new-world-new-skills-program
- **What Kafa'a could borrow:**
  1. **A "digital/AI fitness score"** — a short, repeatable self-diagnostic producing a single score + prescribed content, re-taken quarterly so the trend line is the artifact. Cheap to build, high engagement, and a defensible AI-literacy evidence trail.
  2. **Reward building, not just consuming.** PwC incentivised employees who shipped automations/tools. Kafa'a equivalent: credit for a submitted and adopted improvement — a procedure digitisation, a validated AI prompt/agent for an ENEC workflow, a training simulation.

## A10. Siemens

- **Owner/country:** Siemens AG (Germany).
- **Mechanisms:** **MyGrowth** (employee-centred learning and growth hub for self-reflection and development planning) and **Growth Talks** (structured, frequent development conversations — manager↔employee, peer-to-peer, and within peer management teams, explicitly *not* only top-down). Recruiting runs on **Eightfold** for skills-based matching. Siemens is also a named large-scale consumer of **Google Career Certificates** [P, Google impact report] and a **Coursera** enterprise customer. Nov 2025: "Skills for Life" commitment to help train **200,000 electricians and manufacturing experts by 2030** (US).
- **Vendor-reported scale [V]:** Eightfold filters ~**3 million applications/year** and sources for ~**48,000 requisitions/year** at Siemens.
- **Note:** I could **not** verify a "My Skills Footprint" feature — that name did not appear in any source. Do not use it.
- **Sources:** https://www.siemens.com/global/en/products/services/gbs/our-insights/newsroom/my-growth-hub.html ; https://eightfold.ai/customers/customer-stories/siemens-reimagines-talent-acquisition-with-ai ; https://www.coursera.org/enterprise/resources/casestudy/siemens
- **What Kafa'a could borrow:**
  1. **"Growth Talks" as a product object, not an HR form**: a scheduled, lightweight conversation with a pre-generated agenda (gaps, recent evidence, open opportunities), that writes back decisions as commitments with dates. Include **peer-to-peer** and **team** variants, not just manager-led.
  2. **Bring external certificates into the internal record**: a verified-import flow for Coursera/Google/IBM credentials that maps them onto ENEC competencies instead of leaving them on LinkedIn.

## A11. ADNOC — AI upskilling at scale (closest regional/sector peer)

This is the most directly comparable benchmark for ENEC: an Abu Dhabi state energy operator with a heavy technical workforce and an Emiratisation mandate.

- **Owner/country:** ADNOC (UAE). Figures from the **ADNOC 2025 Sustainability Report** and 2025 announcements.
- **Mechanisms and results [S, company-reported]:**
  - **>1.7 million training hours** completed; **34.3 hours average per employee** (2025).
  - **>40,000 employees trained on AI fundamentals.**
  - **"Introduction to agentic AI" engaged >18,000 participants, resulting in >10,000 AI agents created across operations** — i.e. the course's deliverable was a *built artifact*, not a quiz.
  - **ADNOC Technical Academy:** curriculum updated Aug 2025 with **Neuron 5**, a live AI equipment-monitoring tool (with AVEVA/AIQ) — trainees learn on the actual production tool. **November 2025: 403 UAE National technicians graduated** with applied AI and robotics skills.
  - **ENERGYai** enterprise AI strategy (predictive maintenance, emissions, seismic, subsurface) gives the upskilling a concrete demand signal.
  - Learning delivery is being moved onto an "AI-enabled platform".
  - *Correction for the record:* "Panorama" at ADNOC is the **Panorama Digital Command Centre** (operations, 14 subsidiaries), **not** a training academy.
- **Sources:** https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42 ; https://www.wam.ae/en/article/bl5qbnj-adnoc-expands-training-for-future-energy-leaders ; https://www.wam.ae/en/article/bmrhdc2-adnoc-technical-academy-celebrates-graduation-403
- **What Kafa'a could borrow:**
  1. **Make the AI course's output an artifact.** ADNOC's 18,000 participants → 10,000 agents is the strongest feature idea in this file: the completion criterion is "you built a working agent/automation for your own job", captured in the platform with a usage counter and a reuse library. For ENEC: an internal **"agent/automation gallery"** per department with adoption counts, each tied to its builder's competency record.
  2. **Train on the live tool, not a simulacrum.** Bind Kafa'a learning items to the actual systems ENEC runs (monitoring, work management, document control), with sandboxed instances.
  3. **Publish hours/employee and AI-fundamentals coverage % as board-level KPIs** — ADNOC has set the regional reporting benchmark ENEC will be compared against.

## A12. Emirates Global Aluminium — EGA Academy (UAE national pipeline)

- **Owner/country:** EGA (UAE). **EGA Academy launched September 2025**, framed against UAE "Operation 300bn".
- **Mechanism:** structured development pathways, expert-led learning and real-world experience for employees at all levels, plus **a companion app** where staff explore development options, **track progress toward career goals, and receive continuous feedback**. Separately, a Sept 2025 agreement with the Department of Government Enablement to recruit **200+ UAE Nationals** (high-school certificate holders, registered with DGE) into industrial National Training programmes over five years — **12 months of combined on-the-job and theory training at the academy, with employment on completion**.
- **Track record [S]:** **>5,000 UAE Nationals** have graduated from EGA national training programmes since 1982; **45 Emirati Graduate Trainees** completed the LEAP accelerator (July 2024).
- **Sources:** https://www.wam.ae/en/article/blmzwis-ega-launches-ega-academy ; https://media.ega.ae/ega-and-department-of-government-enablement-partner-to-recruit-over-200-uae-nationals-for-ega-academys-industrial-programmes/ ; https://www.alcircle.com/blog/case-study-how-ega-is-building-the-future-aluminium-workforce-in-the-uae
- **What Kafa'a could borrow:**
  1. **A cohort/trainee track as a first-class object** — intake cohort, 12-month blended curriculum, sign-off gates, guaranteed-role-on-completion status — distinct from the general employee experience. ENEC's Emiratisation pipeline needs this shape.
  2. **A government-partner intake lane** (DGE-style registry integration) so national-talent sourcing and the training record are one system.
  3. **Continuous feedback on the mobile app**, not an annual review — the differentiator EGA chose to advertise.

## A13. Saudi Aramco (for completeness; thinner evidence)

- **Technical Services Professional Academy (TSPA)** maintains **>360 detailed technical competency maps ("CMaps")** defining the skill set for individual-contributor technical roles [S, ATD, date unclear]. **Professional Development Programme (PDP):** sponsored/direct-from-college hires go through a **3-year** structured programme. **SAPDA** onboarding academy (piloted 2010): six-week format, **>1,600 young Saudi professionals (incl. 180 women) across 22 sessions by end-2014**. **May 2025:** MoU with Accenture, Deloitte and Korn Ferry to **second leaders and high-potentials into those firms for up to three years**.
- **Sources:** https://www.aramco.com/en/sustainability/people-and-safety/human-capital-development/employee-training ; https://www.td.org/content/td-magazine/a-young-workforce-is-at-the-core-of-training ; https://www.consultancy-me.com/news/10693/saudi-aramco-sets-up-secondment-programs-with-accenture-deloitte-and-korn-ferry
- **What Kafa'a could borrow:**
  1. **CMap-style per-role competency maps as the data spine** — granular, technical, owned by the technical function (not HR), versioned. ENEC already has licensing/qualification structures; Kafa'a should render them this way.
  2. **An external-secondment object**: outbound developmental placements (vendor, regulator, KHNP, IAEA, university) tracked with objectives, duration and a return-and-transfer obligation. Highly relevant to ENEC's 2030 operator-support transition.

---

# PART B — Vendor platform mechanics (what to copy at feature level)

## B1. Gloat (talent marketplace + "Skills Foundation")

- **Architecture:** a **Talent Marketplace** layer (employee- and leader-facing apps) on a **Skills Foundation** layer (the workforce data infrastructure). 2025 additions: **Skills Planner** and **Studio** for HR-led planning, plus a **multi-ontology "Workforce Graph"** that orchestrates skills, work and technology rather than forcing one taxonomy. There is also a **Skill Validation Agent**.
- **Customers/results:** see Schneider (A1), Unilever (A2), Mastercard (A3). A Brandon Hall piece claims Mastercard saw **+80% satisfaction and +30% retention in year one** — **[?] unverified, no primary source; do not use.**
- **Sources:** https://gloat.com/newsroom/ ; https://gloat.com/use-cases-agents/skill-validation-agent/ ; https://brandonhall.com/gloat-revolutionizing-workforce-agility-with-ai-driven-talent-management
- **Borrow:** a **multi-ontology mapping layer** — ENEC must reconcile IAEA/regulatory competency language, KHNP handover taxonomies, vendor training catalogues and UAE national frameworks. Build the translation layer rather than declaring one true taxonomy.

## B2. Workday Skills Cloud

- **Mechanism:** a graph/ML **skills ontology** that extracts skills from resumes, profiles, feedback and learning history, normalises synonyms into a clean library, and distinguishes **explicit vs inferred** skills. **Match Score** compares a worker's portfolio of explicit + inferred skills to the skills on their job profile — and notably uses Skills Cloud skills, **not** tenant-local custom skills. Supports structured **skill assessments**.
- **Caveat:** TechWolf (a competitor) argues Skills Cloud normalises but does not truly infer capability without external work data. Vendor dispute; note it, don't adjudicate it.
- **Sources:** https://doc.workday.com/admin-guide/en-us/human-capital-management/skills-and-skills-cloud/skills-cloud/ilb1557158988004.html ; https://blog.workday.com/en-us/foundation-workday-skills-cloud.html ; https://doc.workday.com/user-guide/en-us/workday-people-analytics/aog1650566687563.html
- **Borrow:**
  1. **Explicit vs inferred must be visible to the user**, with a one-click "confirm / remove / this isn't me" on every inferred skill. This is both a UX and an AI-governance requirement.
  2. **A role Match Score** rendered as a gap breakdown, not a bare number.

## B3. SAP SuccessFactors — Talent Intelligence Hub

- **Mechanism:** a central **Attribute Library** + per-employee **Growth Portfolio** holding skills, competencies, **strengths, work styles, passions and aspirations** — explicitly more than skills — mapped to formal and informal learning. AI capabilities: **skill inferencing, skill extraction (including resume upload straight into the Growth Portfolio), AI-assisted standardisation of skill names** (requires an SAP AI Units licence). **Job Profile Builder** composes roles from attributes. Third-party skill data plugs in from **Beamery, Korn Ferry, TechWolf, Cobrainer and Lightcast**.
- **Market move:** **SAP agreed to acquire TechWolf (announced Oct 2026)**, folding its inference engine into SuccessFactors and the Joule assistant.
- **Sources:** https://learning.sap.com/courses/sap-successfactors-platform-administration/sap-business-ai-capabilities-in-talent-intelligence-hub ; https://www.sap.com/uk/products/hcm/partners/cobrainer-gmbh-cobrainer-skillshub.html ; https://www.beri.net/article/sap-techwolf-acquisition-skills-graph-successfactors-joule-workday-customers-continuity
- **Borrow:**
  1. **Model aspirations, work styles and interests alongside skills.** Matching on skills alone produces offers people decline. Kafa'a's profile should carry "what I want next", "what I'll relocate for", "what shift pattern I can take".
  2. **Resume/CV upload → parsed draft profile**, user-confirmed. Fastest known path past the empty-profile problem.

## B4. Eightfold AI

- **Mechanism:** deep-learning talent graph over a very large external talent dataset; **skill embeddings + RAG** for matching; modules include **Talent Design** (skills-based job architecture), **Resource Management** (skills-based project staffing), and **Workforce Exchange** (self-service talent intelligence so employees can see their own skills and build careers). Capabilities claimed: skills gap analysis, internal mobility, talent rediscovery.
- **Customer:** Siemens (A10) [V].
- **Sources:** https://eightfold.ai/products ; https://eightfold.ai/wp-content/uploads/eightfold_ai_talent_intelligence_platform_datasheet.pdf
- **Borrow:** **skills-based project staffing as a distinct module** from career mobility. Outage/project resourcing at ENEC has different constraints (dates, licences, clearances, fatigue rules) than career moves and deserves its own matcher.

## B5. Beamery

- **Mechanism:** **TalentGPT** (generative assistant, built on GPT-4 + proprietary models) that suggests career moves from current skills and names the gaps to the next promotion, gives resume/cover-letter feedback and interview prep; a skills ontology designed to **translate between other systems' taxonomies** rather than be the single system of record (Josh Bersin's reading of the Flux acquisition); internal mobility surfaced *before* external sourcing.
- **Unverified [?]:** "95% skills-label accuracy", "467% ROI" — vendor-linked review sites, no primary source.
- **Sources:** https://www.newswire.ca/news-releases/beamery-announces-talentgpt-the-world-s-first-generative-ai-for-hr-822617869.html ; https://joshbersin.com/?p=37556
- **Borrow:** **"internal candidates considered first" as an enforced workflow gate** — a requisition cannot open externally until the internal slate has been reviewed and the reasons logged. This is a governance feature with a visible, auditable artifact, which suits ENEC.

## B6. TechWolf (skills inference from work data) — strongest published outcome numbers

- **Mechanism:** infers skills and proficiency from **the work people actually do** (tickets, documents, project systems) rather than from self-report, and feeds the result into Workday/SAP. Positions itself as a "skills data provider" layered under the HRIS.
- **Results at Workday as a customer [V]:** **15% faster time-to-hire** (another TechWolf page says 32% — inconsistent), **39% reduction in new hires performing below expectations**, **14% faster time to first deal for Account Executives** (described elsewhere as faster ramp to productivity). "100k+ employees with personalised skills profiles."
- **Note:** rollouts involve **works-council/governance engagement** — inferring skills from work artifacts is employee-monitoring-adjacent.
- **Sources:** https://www.techwolf.ai/customer-stories/workday ; https://www.techwolf.ai/product/skills-intelligence ; https://techwolf.ai/product/integrations/sap
- **Borrow:**
  1. **Infer from work evidence already in ENEC systems** — completed work orders, procedure sign-offs, outage task records, simulator sessions, shift logs — to pre-populate skills, with explicit consent, an opt-out, and employee confirmation before anything becomes visible to a manager. *This is the highest-value and highest-risk feature in this file; it must ship with its governance.*
  2. **Measure "new starters performing below expectation"** as a platform outcome metric — it is the most credible of TechWolf's claims and maps cleanly to ENEC's qualification/licensing world.

## B7. Cornerstone Skills Graph

- **Mechanism:** ontology of **>53,000 skills across 250 million roles**, included in **every employee profile** regardless of which Cornerstone product the customer buys; multi-language; a published technical datasheet covers ethical-AI handling, implementation and security. (No "Galaxy" ontology found — that term did not appear; don't use it.)
- **Source:** https://www.cornerstoneondemand.com/resources/article/what-you-need-to-get-started-with-cornerstone-skills-graph
- **Borrow:** **publish Kafa'a's own skills-ontology datasheet** — size, sources, update cadence, language coverage, how inference works, how bias is handled. Regulated-industry buyers and works councils ask for exactly this.

## B8. Degreed (self + manager + peer skill ratings)

- **Mechanism, four stacked signals:**
  1. **Self Ratings** and **Manager Ratings** (proficiency scales) for quick benchmarking and development plans.
  2. **Skill Review** — an adaptive assessment, standardised criteria for everyone, which **occasionally asks for a concrete example**, a deliberate anti-inflation device.
  3. **Social validation / endorsements** from colleagues to strengthen a Skill Review result.
  4. **Peer Ratings** — the user picks a skill, picks a peer, the peer is notified and rates them; the user sees the detail. Marketed as a 360° view.
  5. Third-party assessment and accreditation data imported.
- *(No feature called "Skill Signals" found — don't use that name.)*
- **Source:** https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/
- **Borrow:**
  1. **A multi-source proficiency record per competency** — self / peer / supervisor / assessment / work-evidence — each shown with its own provenance and date, instead of one collapsed number. This maps very naturally onto nuclear qualification practice.
  2. **"Give me an example" prompts** in self-assessment to curb inflation, with the example retained as evidence.
  3. **Employee-initiated peer endorsement request** (user chooses the peer and the skill) — far better response rates than HR-pushed 360s.

## B9. Workera (adaptive skills verification; now Pearson)

- **Mechanism:** **computer-adaptive testing** plus psychometrics and agentic AI to measure **demonstrated proficiency through role-specific scenarios and simulations**; a **Sage** AI mentor assesses up to **10 domains with 30–60 skills each**; **7,000+ skills** covered. July 2026: **proctored hiring assessments integrating with ATS systems (incl. Workday), each generating an integrity report.** Pearson agreed to acquire Workera (announced Sept 2026, completion expected H2 2026), placing it in Pearson Enterprise Learning & Skills.
- **Sources:** https://workera.ai/skills-intelligence-platform ; https://vendordirectory.shrm.org/company/850285/news/3881577/pearson-acquires-workera-a-pioneer-in-ai-native-enterprise-assessment-and-skills-verification ; https://techintelpro.com/HR/AI/workera-launches-ai-hiring-assessments-for-enterprise-recruitment
- **Borrow:**
  1. **Scenario/simulation-based assessment over multiple choice** — give the user a plant scenario and score the reasoning. ENEC already thinks in simulator terms; extend it to non-licensed competencies.
  2. **Adaptive length** — reach a reliable estimate in ~20 items instead of a 60-question slog.
  3. **An integrity report** attached to any assessment that gates a qualification.

## B10. Pluralsight — Skill IQ / Role IQ (the clearest scoring model to copy)

- **Mechanism [S — pluralsight.com was Cloudflare-blocked from this container; re-verify]:**
  - **Adaptive assessment identifies proficiency in as few as ~20 questions.**
  - **Skill IQ is norm-referenced**: a 0/1–300 score **based on your percentile** against everyone else who took that assessment, banded **Novice 1–100 (1st–20th percentile), Proficient 101–200 (21st–80th), Expert 201–300 (81st–100th)**. A second help page describes five bands (Novice, Proficient Emerging/Average/Above Average, Expert). Bands differ between Pluralsight's own pages — verify before copying exact cutoffs.
  - **Role IQ** = complete all the skill assessments that compose a role, and receive a single role-level proficiency result.
- **Sources:** https://help.pluralsight.com/help/what-is-skill-iq ; https://www.pluralsight.com/product/tests
- **Borrow:**
  1. **Role IQ pattern**: define each ENEC role as a set of competencies; the role score is the composition of the component assessments, with the weakest components surfaced as the development plan. Instantly legible to employees and panels.
  2. **Be explicit that a norm-referenced score is relative.** For safety-related competencies, Kafa'a must use **criterion-referenced** standards (you meet the standard or you don't) and reserve percentile scoring for developmental/non-safety skills. Worth stating as a design principle.

## B11. Lightcast — Open Skills taxonomy + Skillabi

- **Open Skills:** an open-source taxonomy, **~32,000–34,000 skills** depending on source/date (skills.lightcast.io says "over 32,000"; the Lightcast blog, updated May 2026, says 34,000+), organised into **31 categories and 400+ subcategories**, each skill carrying a **machine-readable identifier**, **refreshed every two weeks** from job postings, profiles and resumes. Free to browse; API access now contract-based.
- **Skillabi (press release 3 June 2025):** extracts skills from **course content**, scores how well a programme's outcomes match real-world roles on a **0–100 scale**, **flags missing or underrepresented skills**, and lets institutions **model curriculum changes** before making them — on top of 18bn+ labour-market data points.
- **Sources:** https://lightcast.io/blog/open-skills-taxonomy ; https://skills.lightcast.io/ ; https://lightcast.io/resources/blog/skillabi-press-release-june-3-2025 ; https://lightcast.io/open-skills/faqs
- **Borrow:**
  1. **Stable machine-readable skill IDs** from day one, with a crosswalk to Lightcast Open Skills IDs so ENEC data is comparable to external labour-market data (and to UAE national frameworks).
  2. **A curriculum-coverage scorer**: point Kafa'a at ENEC's own training catalogue and score each course's **coverage of the target role's competencies 0–100**, listing the competencies nothing in the catalogue teaches. That gap list is a procurement and L&D roadmap, generated automatically.
  3. **A "what-if" curriculum simulator** for L&D: change the path, see the coverage score move, before buying anything.

## B12. Credly (credential infrastructure)

- **Mechanism:** badges as **Open Badge-standard images with embedded OBI-compliant metadata**, uniquely linked to data hosted on the platform so third parties can verify; **labour-market insights on the badge page** — the holder clicks "Related Jobs" or a skill tag and sees live job requisitions demanding that skill; **endorsements** from other organisations add weight.
- *(Open Badges 3.0 / W3C Verifiable Credentials / LER support: not confirmed in anything I could reach — verify directly before designing to it.)*
- **Sources:** https://info.credly.com/acclaim-product-features ; https://avixa.org/certification-section/badging-faqs
- **Borrow:**
  1. **Every Kafa'a credential gets a public verification URL** with issue date, criteria, evidence type and expiry — so a contractor, the regulator, or a future employer can verify without ENEC in the loop.
  2. **"Where this credential takes you"** on the badge page: internal roles and projects that currently require it, plus (optional) external demand. Turns a badge from a trophy into a navigation device.

## B13. Coursera — Global Skills Report 2025 (as a benchmarking instrument)

- **Mechanism:** annual index ranking ~109 countries on skills proficiency, with a newer **AI Maturity Index**. 2025 headlines: **GenAI enrolments +195% YoY globally** (APAC +132%); **UAE +344% YoY, Saudi Arabia +165%**; Latin America +425% (highest region); India +107% to ~2.6m enrolments yet ranked **89th of 109** on overall skills proficiency; Singapore ranked #1 in APAC for both proficiency and AI maturity. Related: Coursera's **Micro-Credentials Report 2025** found **92% of employers are more likely to hire a candidate holding a GenAI micro-credential** [P, cited inside the Google impact report].
- **Sources:** https://www.coursera.org/gsr ; https://www.peoplematters.in/news/ai-and-emerging-tech/indias-genai-enrolments-double-yet-skills-proficiency-lags-at-89th-place-42399 ; https://cxotoday.com/press-release/coursera-global-skills-report-2025-india-ranks-89th-globally-sees-surge-in-demand-for-ai-and-tech-skills/
- **Borrow:** an **internal benchmarking view** — "ENEC vs UAE national trend vs energy-sector peers" on AI/digital skill adoption, with the UAE's +344% GenAI enrolment growth as the external reference line. Gives leadership a defensible answer to "are we keeping up?".

## B14. Udemy Business

- **Mechanism:** **Skills Mapping** turns stated business goals into targeted learning paths "in minutes" and identifies critical skills; **AI Role Play** (launched **28 May 2025**) runs instructor-designed conversation simulations for business and communication skills — interviews, conflict resolution, delivering feedback — and **organisations can author custom scenarios around their own business challenges**; a **User Role Play Activity Report** exports learner interactions as CSV. Role Play Enhanced is an Enterprise add-on.
- **Sources:** https://about.udemy.com/press-releases/udemy-launches-ai-powered-role-play-to-coach-professionals-on-business-and-communication-skills/ ; https://business.udemy.com/
- **Borrow:** **ENEC-authored role-play scenarios** — a pre-job brief, a challenging shift-turnover, raising a safety concern to a senior, a regulator interview, a KHNP knowledge-transfer session conducted in English with Arabic follow-up. Custom authoring is the feature that makes this sector-credible.

## B15. LinkedIn Learning — AI Role Play coaching

- **Mechanism:** learner types or speaks with a **customisable AI persona**; scenarios are preset or learner-written; sessions run **5–10 minutes**; feedback afterwards covers **strengths, areas to improve, specific comments anchored in the transcript, and recommended courses**. Launched ~mid-2025. **Known limitation at launch: the feedback is not saved and past results can't be referenced** — scenarios are saved and shareable, the feedback isn't.
- **Sources:** https://training.talent.linkedin.com/introducing-role-play-with-ai-coach ; https://hr.arizona.edu/news/2025/master-difficult-workplace-conversations-linkedin-learnings-ai-coaching ; https://learning.linkedin.com/content/dam/me/learning/en-us/images/reference-cards/AI-powered-role-play-practice-guide.pdf
- **Borrow:**
  1. **5–10 minute practice sessions** that fit between shift activities, with transcript-anchored feedback.
  2. **Fix LinkedIn's gap: persist the feedback** into a private practice history so the learner sees improvement over time — and let them *choose* to attach a session as evidence to a competency. Private-by-default, employee-controlled sharing.

---

# PART C — AI literacy: the obligation and the frameworks

## C1. EU AI Act, Article 4 — the AI-literacy obligation [P, text retrieved directly]

- **What it is:** **Article 4 of the EU AI Act requires providers and deployers of AI systems to take measures to ensure a sufficient level of AI literacy among their staff and anyone using the systems on their behalf.** It **entered into application on 2 February 2025**.
- **Mechanism the Commission built around it:** the AI Office launched a **living Repository of AI Literacy Practices**, now **>40 initiatives** from companies and the public sector — e-learning platforms, in-person training, bootcamps, industry–academia collaborations. Entries were collected via two surveys (AI Pact pledgers, Dec 2024–Feb 2025; then open to any organisation, Apr–Jun 2025) and are classified by rollout stage (**planned / partially rolled out / fully implemented**) and by whether the organisation is a **provider or a deployer**. It was later revamped for searchability and multilingual use, with a report produced with the Erasmus+ **ARISA** project. Page last updated **27 July 2026**.
- **The crucial caveat, verbatim from the Commission [P]:** *"Replicating the practices collected in this living repository does not automatically grant presumption of compliance with Article 4"* — the repository exists to encourage learning and exchange. Under Art. 4(2) the Commission will, however, draw on it to publish examples of compliance.
- **Relevance to ENEC:** the EU AI Act does not bind ENEC directly, but (a) it is the emerging international benchmark that UAE regulators, lenders, insurers and EPC/vendor partners will reference, and (b) ENEC is a **deployer** of AI systems in an industry where the regulator is unforgiving about undocumented competence. Treating Art. 4 as a voluntary standard is cheap insurance.
- **Source [P]:** https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices (plus https://futurium.ec.europa.eu/de/apply-ai-alliance/news/revamped-repository-ai-literacy-practices)
- **What Kafa'a could borrow:**
  1. **An AI-literacy register**: for every AI system ENEC deploys, record who uses it, what literacy measure covers them, when they completed it, and the evidence — exportable as a compliance pack. Nobody in this benchmark set has built this well; it is a genuine differentiator for a nuclear operator.
  2. **Role-differentiated AI literacy**: provider-side (people building/configuring models or agents) vs deployer-side (people using outputs to make decisions) — the Act's own distinction, and the right one operationally.
  3. **Mirror the repository's maturity labels** (planned / partially rolled out / fully implemented) in Kafa'a's own AI-literacy programme tracker, so progress is reportable in the same language regulators will use.

## C2. UNESCO AI Competency Frameworks for Teachers and Students (2024)

- **What they are:** two companion frameworks published by UNESCO in **2024** — the first global normative guidance of their kind. *(Note: unesco.org and unesdoc were captcha-blocked from this container; details below are from secondary summaries of the UNESCO documents and should be confirmed against the originals.)* **[S]**
- **Structure:**
  - **Students:** **12 competencies across 4 dimensions** — *Human-centred mindset, Ethics of AI, AI techniques and applications, AI system design* — each at **3 progression levels: Understand → Apply → Create**, designed as a spiral across grade levels.
  - **Teachers:** **15 competencies across 5 dimensions** — the four above (with *AI foundations and applications*) plus **AI pedagogy** and **AI for professional learning** — at levels **Acquire → Deepen → Create**. (One secondary source gives teacher levels as Understand/Apply/Create; conflicting — verify.)
- **Why it matters here:** it supplies a **ready-made, internationally legitimate competency grid** for AI capability, with the ethics and human-centred dimensions already first-class rather than bolted on — exactly the shape a nuclear operator needs.
- **Sources:** https://gcedclearinghouse.org/en/node/146447 ; https://lib.scu.edu.cn/genai/static/wenjian/AI%20competency%20framework%20for%20students.pdf ; https://inee.org/es/node/13027707
- **What Kafa'a could borrow:**
  1. **Adopt the 4-dimension × 3-level grid as ENEC's AI competency model**, re-cut for an energy operator: *Human-centred mindset · Ethics & assurance of AI · AI techniques and applications · AI system design*, at Understand / Apply / Create — and cite UNESCO as the provenance. Instant international defensibility, zero invention cost.
  2. **A trainer/instructor variant** using the teacher framework's two extra dimensions (**AI pedagogy**, **AI for professional learning**) for ENEC's own instructors, SQEPs and mentors — a group every other benchmark in this file forgets.
  3. **Spiral progression**, so the same competency recurs at deeper levels across a career rather than being "done" once.

## C3. WEF Future of Jobs Report 2025 (the demand-side anchor)

- **Finding [P-ish, WEF's own chapter]:** employers expect **39% of workers' core skills to change by 2030** — down from 44% in the 2023 edition and 35% in 2016, which the WEF reads as disruption **stabilising at a high level**. Widely reported alongside **170m new roles emerging and 92m displaced by 2030 (net +78m)**. **77% of employers plan to reskill and upskill their workforce to work more effectively alongside AI** [P, cited in the Google impact report].
- **Wording caution:** many outlets render the 39% as skills becoming "obsolete". The WEF measures skills that **change**, not skills that disappear. Use the WEF's wording.
- **Sources:** https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/
- **Borrow:** a **"skill half-life" / change-horizon marker** on each competency in the Kafa'a catalogue (stable / evolving / being displaced), owned and periodically reviewed by the technical function — this is what turns the 39% headline into something an employee can act on.

---

# PART D — Consolidated candidate-feature list for Kafa'a

Grouped by theme; each traces to a benchmark above. Intended as raw input to the 50–100 feature plan.

**Opportunity & mobility**
1. Three-lane opportunity feed: positions / projects / mentorships (A1).
2. Sub-60-second profile onboarding with progressive enrichment (A1).
3. CV/credential upload → parsed draft profile, user-confirmed (B3).
4. Pre-negotiated time-envelope for gig participation, approved once by the line manager (A2).
5. Crisis/surge redeployment mode with a 48-hour mobilisation report (A2).
6. Separate matcher for project staffing vs career moves, honouring licences, clearances and fatigue rules (B4).
7. Internal-slate-first gate on every requisition, with logged reasons (B5).
8. "Unlocked hours" leadership KPI, with a visible and editable savings formula (A1, A3).
9. Equity telemetry on assignments: by gender, nationality, site, shift (A1, A2, A8).

**Career navigation**
10. Role weather report: demand trend, headcount, typical next moves, honest decline signals (A4).
11. "Jobs you can reach", ranked by closeness, with gap list and time-to-ready (A4).
12. Role IQ-style composite role score from component competency assessments (B10).
13. Match Score with gap breakdown, never a bare number (B2).
14. Model aspirations, mobility constraints and work styles, not only skills (B3).
15. Published internal-fill statistic for people who completed a gap-closing path (A4).
16. Skill change-horizon marker per competency: stable / evolving / displaced (C3).

**Assessment, evidence & credentials**
17. Multi-source proficiency per competency: self / peer / supervisor / assessment / work-evidence, each with provenance and date (B8).
18. "Give me an example" prompts in self-assessment; the example is retained as evidence (B8).
19. Employee-initiated peer endorsement requests (B8).
20. Adaptive assessment reaching a reliable estimate in ~20 items (B9, B10).
21. Scenario/simulation-based assessment scoring reasoning, not recall (B9).
22. Integrity report attached to any assessment that gates a qualification (B9).
23. Criterion-referenced standards for safety-related competencies; percentile scoring only for developmental ones (B10, design principle).
24. Public verification URL for every credential: criteria, evidence type, issue date, expiry (B12).
25. "Where this credential takes you" — roles and projects that currently require it (B12).
26. Strategic-skills badge tier bound to real consequences, with the correlation reported back (A6).
27. Credential-source trust tiers: ENEC-assessed > accredited third party > vendor self-serve (A7).
28. Verified import of external certificates (Google/IBM/Coursera) mapped onto ENEC competencies (A10).
29. Completed gigs write evidence back to the competency record (A2).

**Learning design**
30. Every pathway designed to a 3–6 month envelope with a stated weekly hour cost and peer completion times (A8).
31. Mandatory sub-6-hour AI-fluency on-ramp with an attached confidence/benefit pulse (A8).
32. AI course completion criterion = a working agent/automation built for your own job (A11).
33. Internal agent/automation gallery with adoption counts, credited to the builder (A11, A9).
34. Learning bound to the live tools ENEC actually runs, in sandboxed instances (A11).
35. ENEC-authored AI role-play scenarios: pre-job brief, shift turnover, raising a safety concern, regulator interview, KHNP knowledge transfer (B14, B15).
36. 5–10 minute practice sessions with transcript-anchored feedback, **persisted** to a private practice history, employee-controlled sharing (B15).
37. Curriculum-coverage scorer: score each ENEC course's coverage of a role's competencies 0–100 and list uncovered competencies (B11).
38. "What-if" curriculum simulator for L&D before procurement (B11).
39. Reward building and contribution, not only consumption (A9).
40. Named programme catalogue with personalised eligibility and funding cards (A5).
41. Tiered entry points from literacy level up to graduate level (A5).
42. Cohort/trainee track object: intake, 12-month blended curriculum, gates, role on completion (A12).
43. Government-partner intake lane for national talent (A12).
44. External secondment object — vendor, regulator, KHNP, IAEA, university — with objectives, duration and a return-and-transfer obligation (A13).

**Conversations & feedback**
45. Growth Talks as a product object with pre-generated agenda and written-back commitments; manager, peer and team variants (A10).
46. Continuous feedback in-app rather than an annual cycle (A12).

**Data & AI governance**
47. Multi-ontology mapping layer across IAEA/regulatory, KHNP, vendor and UAE national taxonomies (B1).
48. Stable machine-readable skill IDs with a crosswalk to Lightcast Open Skills (B11).
49. Explicit vs inferred skills visible to the user with one-click confirm/remove (B2).
50. Skill inference from existing ENEC work evidence — consented, opt-out, employee-confirmed before manager visibility (B6).
51. Published Kafa'a skills-ontology datasheet: size, sources, update cadence, languages, inference method, bias handling (B7).
52. AI-literacy register per deployed AI system: users, measure, completion, evidence, exportable compliance pack (C1).
53. Role-differentiated AI literacy: provider-side vs deployer-side (C1).
54. Programme maturity labels — planned / partially rolled out / fully implemented (C1).
55. UNESCO-derived AI competency grid: 4 dimensions × Understand/Apply/Create, re-cut for an energy operator (C2).
56. Instructor/SQEP variant adding AI pedagogy and AI for professional learning (C2).
57. Spiral progression: competencies recur at deeper levels across a career (C2).

**Measurement & benchmarking**
58. Quarterly-active-learner rate as the platform health metric, not registrations (A6).
59. Hours per employee and AI-fundamentals coverage % as board-level KPIs (A11).
60. "New starters performing below expectation" as an outcome metric (B6).
61. Internal vs UAE-national vs sector benchmarking view on digital/AI skill adoption (B13).
62. Annual activity ledger published in-product: projects filled, mentorships formed, hours unlocked (A3).
63. Learner-profile equity dashboard: operations vs engineering, Emirati vs expatriate, shift vs day, female share (A8).
64. Market-opportunity data visually separated from measured outcomes everywhere in the UI (A8, integrity principle).

---

## Figures NOT to use without re-verification

- Mastercard "+80% satisfaction / +30% retention" (Brandon Hall) — no primary source. **[?]**
- Deloitte skills-based-organisation claims circulating as "107% more likely to place talent / 98% retain high performers / 52% innovate", "2.3x internal fill rates / 31% lower attrition", "41% faster proficiency" — repeated across low-quality sites with no traceable Deloitte publication. **[?]**
- Beamery "95% skills-label accuracy" and "467% ROI" — vendor-linked review sites. **[?]**
- PwC Digital Fitness outcome claims — executives claim "phenomenal", published nothing. **[?]**
- Unilever hours-unlocked (112k / 500k / 700k) — pick one source and state the window, or omit. **[V, inconsistent]**
- TechWolf time-to-hire (15% vs 32%) — inconsistent across the vendor's own pages. **[V, inconsistent]**
- Pluralsight Skill IQ band cutoffs — two different schemes on Pluralsight's own help pages; site was unreachable here. **[S, verify]**
- "Siemens My Skills Footprint", "Cornerstone Galaxy ontology", "ADNOC Panorama digital academy", "Degreed Skill Signals" — **these product names do not exist** in any source found. Panorama is ADNOC's operations command centre.
