# Kafa'a audit: current future-skills and competency capabilities

Prepared 10 Oct 2026. This is a read-only audit of `/workspace/kafaa` at `master` `06d23f1` (9 Oct 2026, 20:52 UTC). That build is live at https://enec-kafaa.netlify.app/kafaa/ (wave-5 deploy, 10 Oct, about 03:40 UTC). No code, database or Netlify state was changed.

**Inputs read:** `CONTRACT.md` (rules, personas, acceptance lists, changelog), `README.md`, `src/routes/{modules,registry,types}.ts`, every `src/modules/mNN/routes.ts`, `src/data/schema.ts` plus `src/data/ext/schema.ts` and each module's `backend/schema.ts`, `src/domain/{skills,future,careerGraph,search,rules}.ts`, `src/domain/engines/*`, and these module rule files: m07 `outlook.ts`, m17 `checkins/microcred/passport.ts`, m18 `career/roadmap.ts`, m19 `coach/ask.ts`, m20 `match.ts`, m21 `future.ts`, m23 `domain.ts`, m24 `klra.ts`, m25 `needs.ts`, m16 `transparency.ts`, m13 `career/*`. I also read `scratchpad/kafaa_build/{BACKLOG.md, W5_QA.md, DEPLOY_DONE.md}`. Seed figures were counted directly from `src/seed/seed.json`, which has 23,484 rows in 214 tables.

---

## 0. Summary

Kafa'a already has the main parts of a skills platform:
- a skills layer under the competency framework (71 skills under 29 competencies)
- person-level skill states inferred from authoritative records, with basis, confidence and decay
- an engine kernel that explains every recommendation
- a passport, 360 check-ins, a credential wallet and micro-credentials
- a career navigator and roadmap, a learning coach, a marketplace, Future Me and a skills supply-and-demand outlook

All of it runs with no LLM, on two backends that are proven equal, in EN and AR.

**Three weaknesses stand out against a world-class future-skills platform:**

1. **The taxonomy is inward-looking and thin on future skills.**
   - There is no crosswalk to any international framework (ESCO, O\*NET, SFIA, SkillsFuture, IAEA, DigComp, UNESCO AI, QFEmirates).
   - None of the 71 skills has a source, owner, version or lifecycle status.
   - Level descriptors are generated from one template.
   - Digital and AI make up 7 skills, and only 4 of 28 role profiles ask for any digital competency.
   - There is no transversal "future of work" skill family, such as analytical thinking, resilience or systems thinking.
2. **The future layer is mostly a separate island.**
   - The 27 ADVANCE skills and 11 concept future roles are keyed to M11 ids, not the skills catalogue.
   - Future roles have no role profiles and no career-graph edges, so the Navigator, Roadmap and Marketplace cannot target them.
   - The HR radar is 8 hand-entered values. Scenario A and Scenario B hold identical numbers (a seed defect).
   - Nothing time-phases skill demand by year, models AI/automation exposure, or brings in external labour-market or sector benchmarks.
3. **Little content can actually close the gaps the tools find.**
   - There are 3 short future-skills courses (2 to 4 h), 5 ADVANCE tracks and 17 resource links.
   - Micro-credentials and gigs require data-analysis and digital-twin skills that no catalogue course teaches.
   - There are no diagnostic assessments for future skills, no sandboxes, and no external catalogue (IAEA, WNU, MOOCs).

---

## 1. Platform constraints every new feature must respect

| Constraint | What it means for new features |
|---|---|
| **No LLM key.** Every "AI" surface is deterministic: rules, weighted scoring, BM25, cosine, graph search. `ModelGatewayEngine` reads `VITE_KAFAA_MODEL_URL`, which is absent, so all 4 engine surfaces (`skills`, `recommend`, `match`, `search`) show "model unavailable" and fall back. | Skill extraction from text, semantic matching and generated coaching must be rule, keyword (EN and AR) or BM25 based, or wait for a server-side model gateway. A Supabase Edge Function holding a secret would be needed; none exists. The browser URL slot cannot hold a key. Every ranked item must carry `reasons[]` (`lintRanked`). |
| **Additive `kafaa_*` objects only.** NEXUS objects are never altered or dropped, and the live MCP refuses drops. Migrations are idempotent and named `2026...<wave><eng>NNN_kafaa_*.sql`. | New tables and columns go into module `backend/schema.ts` blocks (M17 to M27, or an owned older module), followed by `npm run gen`. Existing enums are extended additively. |
| **Both backends must agree.** Each RPC exists 3 times: the TS `Rpc` signature, the LocalBackend implementation, and the SQL `SECURITY DEFINER` function plus its Supabase map. A PGlite validator proves SQL = TS on the seed. Domain rule files stay import-free so node seed builders can load them. | Every new scoring rule needs a pure TS function, a line-for-line SQL mirror and a validator. That roughly doubles effort, so prefer read-only computations in TS when no write is needed. |
| **Bilingual.** `check:i18n` requires every key in EN and AR, RTL logical utilities and Arabic-Indic digits. | New taxonomies (skills, frameworks, descriptors) need `_en`/`_ar` columns, and Arabic must be complete. |
| **RBAC and privacy.** One policy matrix (318 rows). Aggregates under `MIN_GROUP_SIZE` 10 are suppressed. Protected inputs (gender, nationality, age proxies) are banned from scoring by a unit test. Speak-up sends no telemetry. `check:public` keeps names out of public payloads. | Skills-market or benchmark dashboards must suppress small cells. Fairness monitoring (F24) must cover any new ranking surface (add an engine card). |
| **Nuclear-specific rules.** Kafa'a is a mirror and never an authority: no FANR claims. Security, safeguards and cyber roles show the career path only, with qualified/not-qualified status. Qualification work has no gamification. ADVANCE copy carries "no deployment decision implied" and no headcount or site text (`publicTextIsClean`). | Future-skills features must not imply SMR deployment, headcounts or sites. Cyber skills for all staff need care, because the `security` area is restricted and `SA-01` is the only security competency. |
| **Synthetic data.** There are 368 people: 107 staff, 222 applicants, 32 contractors, 6 partner, 1 observer. The local backend has 57 personas; Supabase has 43 NEXUS role cards. | Population analytics run on 107 staff, so many cells are suppressed. Any "market" or "benchmark" number must come from cited public sources or be labelled SIMULATED. |
| **Size and test gates.** 206 routes, 27 modules, 215 SQL tables, 44 migrations, 1,716 unit tests, a 3,502-check route sweep and 52 E2E journeys. Rollup chunk-size warnings remain. | New routes are swept automatically. Keep pages lazy-loaded. |

---

## 2. Area-by-area audit

### 2.1 Competency framework and skills taxonomy (M02 + F01)

**What exists**
- **Tables:**
  - `kafaa_competencies`: 29 competencies across 14 domains (plant 3, conduct 3, and 2 each in maintenance, RP, chemistry, engineering, safety, HU, culture, EP, quality, leadership and digital; security 1). Each has 4 level descriptors in EN and AR.
  - `kafaa_proficiency_levels`: 4 levels.
  - `kafaa_role_competencies`: 106 links over 28 roles (2 to 11 per role), with `importance` core, important or useful.
  - `kafaa_skills` (F01): 71 skills, made of 29 core skills (`sk-<competency>`) and 42 specialised ones in 13 areas: plant_systems 12, radiation_chemistry 9, maintenance 7, digital 7, operations 6, human_performance 6, safety 5, leadership 5, engineering 4, emergency 4, quality 4, project 1, security 1. Columns include `evidence_keys[]` (34 skills), `adjacent_ids[]` (70), `adv_skill_ids[]` (15 map to ADVANCE skills), `description_*` and `sources`.
  - `kafaa_task_skill_links`: 89 rows (M09, contractor equivalency).
  - `kafaa_jta_tasks`: 95 rows, and `kafaa_sat_objectives`: 124 rows (M26 SAT).
- **Routes:**
  - `/competencies` (public): domains, levels and linked roles.
  - `/admin/frameworks`, tabs Roles (editable), Competencies (**read-only** table), Standards (versioned) and Micro-credentials.
  - `/training/sat/*` (job and task analysis).

**Strengths**
- Nuclear-specific and grounded in the SAT approach. Qualification standards are versioned, with task lists and JPMs.
- Each skill sits under exactly one competency, so the two levels of the hierarchy stay consistent.
- Fully bilingual.
- Security is isolated by design.

**Gaps against a world-class future-skills taxonomy**
- **No external crosswalk.** `kafaa_skills` has no `external_ids` or alignment column.
  - No mapping exists to ESCO, O\*NET, SFIA 9, SkillsFuture TSC/CCS, IAEA SAT/NG-T-2.8 KSAs, EU DigComp 2.2, the UNESCO AI competency framework or UAE QFEmirates.
  - A grep of `src` and the seed builders found no reference to any of these frameworks.
- **No future-of-work or transversal family.** The only behavioural skills are safety-culture and leadership ones (`SC-01/02`, `LD-01/02`, HU). The WEF Future of Jobs 2025 core skills are absent: analytical thinking, creative thinking, resilience, curiosity and lifelong learning, systems thinking, technological literacy, AI and big data, environmental stewardship.
- **Digital and AI are shallow.**
  - There are 2 competencies (`DA-01` digital tools and data literacy, `DA-02` governed use of AI) with 7 skills: analysis, scripting, twins, remote/autonomous oversight, and reviewing AI outputs, plus the 2 core skills.
  - Missing: OT/IT convergence, data engineering, cyber hygiene for every employee (only `SA-01`, which is in the restricted security area), AI tool use and prompt literacy, automation, AR/VR, advanced manufacturing and inspection, digital procurement.
- **Green and energy-transition skills** exist only as horizon lane HZ-5 ("later") and a few ADVANCE mappings. There is no hydrogen, process-heat, ESG reporting or decarbonisation skill in the catalogue.
- **No taxonomy governance.** No skill has a version, owner, review date, change log or lifecycle status (emerging, growing, stable, declining). **0 of 71 skills carry a source**, while roles and lanes do. Qualification standards are versioned, but skills are not.
- **No UI for the skills catalogue.** No page lists the 71 skills (staff or public), admins cannot edit them, and there is no way to request a new skill. `/competencies` stops at the competency level.

**Data limits**
- Specialised skill descriptions are templated: "X: part of Y (code)."
- Adjacency is generated mechanically: same competency first, then same area, at most 6.
- `evidence_keys` link only to internal records.

### 2.2 Proficiency model

**What exists**
- 4 levels: 1 Awareness, 2 Practitioner, 3 Qualified, 4 Expert.
- Each competency has 4 descriptors built from **one sentence template** ("Explains the purpose of… / Applies… under supervision… / Applies… independently and recognises when to stop and ask / Coaches, trains and evaluates others in…").
- Person level 0 to 4 with a basis (`verified` > `evidenced` > `validated` > `claimed`) and a confidence of 0 to 0.99.

**Strengths**
- The basis hierarchy separates regulated qualification ("verified") from training ("evidenced"), peer or manager validation, and self-claim. That is better than most commercial platforms.
- Level 3 ("Qualified") matches nuclear practice.

**Gaps**
- Descriptors are not behaviourally anchored: there are no indicators, observable examples or KSA breakdown per level.
- There is no mapping to 6-level (SkillsFuture) or 7-level (SFIA) scales, and no level above Expert (industry authority, thought leader). That limits benchmarking and recognition by other organisations.
- Descriptors are the same for every skill under a competency. The 42 specialised skills have no descriptors of their own.

### 2.3 Skills inference and person skill state (F01, F02)

**What exists**
- `src/domain/skills.ts`:
  - `gatherEvidence` derives evidence from four kinds of record. Qualification records give `verified` while current and `evidenced`, flagged "lapsed", once expired. Course passes give level 2 for a qualifying course, else 1. Assessment passes give level 2. JPM passes give up to level 3.
  - Other features record evidence as `rating`, `ojt` or `credential`.
  - `deriveSkillState` picks the strongest evidence. Confidence = base × 0.5^(age/1096 days) + 0.05 per extra evidence row (up to 4).
  - Evidence older than 36 months counts one level lower ("ageing").
- SQL mirror `kafaa_skill_states_compute` in `20261009101001_kafaa_w0e1_skills_core.sql`, proven equal by `scripts/validate/w0-skills.mjs`.
- RPC `recomputeSkills`.
- **Tables:**
  - `kafaa_skill_evidence`: 2,797 rows (qual 874, rating 652, course 585, ojt 391, credential 278, jpm 17; 17 lapsed).
  - `kafaa_person_skills`: 1,920 rows (verified 714, evidenced 619, claimed 521, validated 66; levels L1 428, L2 952, L3 442, L4 98).
- Engine kernel (`src/domain/engines`):
  - `byGapClosure`, `byCosine`, `readiness`, `careerMoves`, `coursesForGaps`, `byCoOccurrence`
  - BM25 `SearchIndex`
  - `engine_settings` per surface, with weights changed by an audited RPC

**Strengths**
- Inference is evidence-based from authoritative records, not keywords.
- It is deterministic and reproducible (a digest hash), and explainable: each reason links to its evidence row.
- It is security-aware: restricted standards contribute only "qualified" to security skills.
- Decay is modelled.

**Gaps and defects**
- **The half-life setting does nothing.** `engine_settings.skills.weights.half_life_months = 36` is shown to admins and on engine cards. But TS (`HALF_LIFE_DAYS = 1096`) and SQL (`power(0.5, age/1096.0)`) both hard-code the value. Changing the weight has no effect.
- **No per-skill or per-area decay.** Digital and AI skills should decay faster than reactor physics, and every skill uses the same half-life.
- **Adjacency and co-occurrence are unused.** `skills.adjacent_ids` is stored but read by no engine. `byCoOccurrence` (lift) is defined in the kernel but called by no surface.
- **Records are the only input.** Nothing infers skills from projects or work orders, OE reviews, CVs or profile text, community posts, knowledge assets authored, or xAPI statements. The 2,031 xAPI statements in `kafaa_xapi_statements` do not feed skill evidence.
- There is no "skills you may have" suggestion that a person can confirm or reject.
- Confidence is a max plus a bonus, not a calibrated blend of several sources. Readiness and gaps show no uncertainty.

**Data limits**
- Staff average 13 skill states (median; max 30). Applicants have 2 each, contractors a median of 6.5.
- 6 skills are held by nobody: `sk-pf-01-advfuel`, `sk-pf-02-advcool`, `sk-mp-01-remote`, `sk-ch-01-advchem`, `sk-ns-01-psa`, `sk-da-01-remote`.
- Digital depth is near zero:

| Skill | Holders |
|---|---|
| `sk-da-01` (core) | 253 |
| analysis | 7 |
| scripting | 3 |
| `da-02` (AI) | 3 |
| twins | 2 |
| AI-output review | 1 |

### 2.4 Skills Passport, 360 check-ins and team capability (F03, F10, F11; M17)

**What exists**
- **Routes:**
  - `/my/skills`: profile, radar by domain or competency against the current or target role, skills list with basis chips and an evidence drawer, "expiring and decaying", "strengths for my next move", add a claim.
  - `/my/skills/print`: one-page EN/AR passport.
  - `/team/passport/:personId`.
  - `/my/skills/checkins` and `/team/skills/validate`: self, manager and up to 2 peers; validation; rater calibration flagging |offset| ≥ 0.75 over at least 3 ratings.
  - `/team/skills`: heatmap, coverage against `team_skill_targets`, single points of failure, crew view, a SIMULATED "what if X leaves" toggle, watermarked CSV.
- **Tables:** `skill_claims` (37), `skill_checkins` (75), `skill_ratings` (471), `team_skill_targets` (24).

**Strengths**
- A verified passport layered on SAT records, in the style of SkillsFuture.
- Peer privacy rules.
- Raters are calibrated against independent evidence.
- Team single-point-of-failure flags tie into KLRA.

**Gaps**
- Team targets describe the present only: there are no 2028/2030 capability targets and no gap from the team to its future profile.
- There is no organisation-wide skills inventory at the level of the 71 skills. HR sees 12 areas in the outlook and per-team aggregates in the heatmap.
- There is no profile-completeness or data-quality view, for example the share of staff with at least N evidenced skills, or stale profiles.
- There is no "skills I want to grow" list per skill. Aspirations exist only at role level (F12) and as technology or lane interest (F09).

### 2.5 Credentials: wallet, badges and micro-credentials (F04, F32, F33)

**What exists**
- **Routes:**
  - `/my/skills/wallet`: Open Badges 3.0-shaped credentials, signed with an Ed25519 demo key.
  - `/verify/badge` and `/verify/badge/:id`: public check showing holder initials only.
  - `/my/skills/credentials`: a catalogue of 16 micro-credential definitions, 3 of them stacks:
    - HP Champion, Digital Plant Foundations and Outage Pro
    - MC-AI-LIT "Governed AI literacy"
    - MC-DATA-FOUND and MC-DATA-ANALYSIS
    - MC-TWINS (draft)
  - Eligibility runs over F01 evidence. Awards are signed, and expired components flag the stack "renewal due".
  - `/partner/workforce/passport` (contractor passport and equivalency pre-check).
- **Tables:** `badges` (73), `microcred_defs` (16), `microcred_awards` (106), `contract_role_targets`, `task_skill_links`, `contractor_engagements`.

**Strengths**
- Standards-shaped (OB 3.0, W3C VC).
- Verification is tamper-evident.
- Definitions are versioned like qualification standards.
- Copy checks block regulatory wording.

**Gaps**
- No alignment to external recognition: no QFEmirates level or credit value, no CLR 2.0 transcript, no export to external wallets or LinkedIn, no published issuer registry. The key is a demo key.
- Known open items from W5 QA:
  - Seeded awards write no F01 evidence; only live awards do.
  - The F34 student starter credential is not wired to F32: `mc-student-mustaqbali` has no definition.
  - F33 has no RPC to record new ENEC engagements and no flow to withdraw a contractor badge.
- No micro-credential exists for advanced-reactor fundamentals, green skills, cyber hygiene or the transversal skills.

### 2.6 Careers: catalogue, Navigator, Roadmap and conversations (M01, F05, F06, F12; M18)

**What exists**
- **Routes:**
  - `/careers*` (public): 28 roles in 20 families, 27 path edges (lateral 10, cross_functional 8, entry 5, vertical 4), a ladder, a path graph, an anonymous planner, compare, and a jobs list.
  - `/my/career`: personal readiness for each reachable role. Score = weighted coverage; gates are kept separate (REG-17 routes, experience); "ready now / in N months / stretch"; "roles like mine" by cosine; a shortlist of 3.
  - `/my/career/roadmap`: quarter-by-quarter plan up to 10 years with what-if sliders. It uses published COIT/LOIT durations and REG-17 milestones, and can send to the development plan.
  - `/my/career/conversations`, `/team/conversations`, `/workforce/career-conversations` (aggregated aspirations).
- **Tables:** `career_targets` (72), `roadmaps` (19), `career_conversations`.

**Strengths**
- Gates never inflate readiness.
- Regulated routes are cited.
- Security roles show the path only.
- Aspirations are captured with consent for talent review.

**Gaps**
- **Future roles are not in the career graph.** The 11 concept roles in `future_roles` have no `role_competencies` and no `career_paths` edges, so nobody can shortlist one, see readiness for it or build a roadmap to it.
- **No role-transformation view** in the style of a Jobs Transformation Map. Nothing shows how each current role changes by 2030/2035: which tasks grow, shrink or are augmented, which skills are added, and the bridge curriculum.
- **Role profiles are thin and present-day.** Digital is required by 4 roles:

| Role | Requirement |
|---|---|
| Cyber engineer | DA-01 level 4, core |
| Corporate | DA-01 level 2, important |
| Systems engineer | useful |
| Procurement | useful |

  `DA-02` (governed AI) appears on 2 roles. Operators, maintenance, RP and chemistry have no digital requirement.
- The public "jobs" list is not tied to personal readiness, and there is no internal mobility posting with skill-based matching.

### 2.7 Learning: Coach, catalogue, refreshers and Dalil career mode (M04, M05, F07, F14, F37)

**What exists**
- **`/my/coach`:** a feed of 5 to 8 cards.
  - Ranked by gap closure against the current role (weight 1.0) and targets (0.6).
  - Pins expiring qualifications first.
  - Fills the rest with a Sainte-Laguë mix over courses, practice, OJT, opportunities, mentors and readings.
  - **Future Me goals are coach targets**, wired through `futureGoals`.
  - "Why this?" on every card. Dismissals last 90 days.
- **"Ask the coach":** BM25 over the catalogue.
- **`/my/coach/refresh`:** Leitner spaced practice from the open practice bank, with no gamification.
- **`/ask?mode=career`:** Dalil intents for next roles, gap to role, courses, opportunities and roadmap date, plus deterministic role-play with a STAR keyword rubric.
- **Catalogue:**
  - 48 courses, mostly current-plant training (LOIT, COIT, maintenance, RP, chemistry, leadership, supplier academy).
  - Future-skills content is `c-adv-intro` (3 h, public), `c-adv-smr` (4 h) and `c-ai-gov` (2 h).
  - Plus 5 `adv_tracks` (1.7 to 4 h) and 17 `future_resources`: courses, KU MSc, NITSS, SRC/GIEMS MoU, readings.
  - Practice bank: 97 items.

**Strengths**
- Explainable recommendations.
- Secure items are kept out of every feed.
- Bilingual retrieval.
- Career mode is grounded in the person's own data and governed (kill switch, refusals, evaluation gate).

**Gaps**
- **The content to close future-skill gaps is missing.**
  - No catalogue course covers data analysis, scripting, digital twins, remote operations, cyber hygiene or green skills.
  - MC-DATA-ANALYSIS, MC-TWINS and digital opportunities require these skills, but the coach has nothing to rank for them.
- There are no skill-based learning pathways per future skill (levels 1 to 3, curated sequences) and no academy-style cohort programmes (AI academy, digital twin bootcamp).
- There is no external content integration: IAEA CLP4NET/e-learning, the World Nuclear University, the NEA/NEST, MOOCs.
- There are no diagnostic or adaptive assessments for future skills and no performance-based digital tasks. Refreshers reuse current-topic practice items.
- There are no sandboxes for practising AI tools or digital twins safely.
- No LLM is available, so the coach cannot generate study plans or tutor, and role-play scoring is by keywords.

### 2.8 Mobility: marketplace, rotations and reserve (F08, F15, F23; M20)

**What exists**
- **Routes:** `/opportunities*` (17 routes):
  - post and apply, line-manager release (maker-checker), selection, and completion that writes `ojt` evidence
  - match = 0.7 skills + 0.2 development + 0.1 target, with reasons; nationality is never an input
  - rotations with templates, cohorts and host sign-off; shadowing; alumni and expert reserve
- **Tables:** `opportunities` (25), `opportunity_applications`, `rotation_*`, `shadow_*`, `alumni`, `reserve_*`.

**Strengths**
- Stretch work leaves evidence behind.
- Fairness guards.
- Protected-area work is excluded.

**Gaps**
- Only about 2 of the 25 opportunities build future skills ("Governed AI pilot", "digital twin feasibility"), plus 3 analytics-flavoured projects.
- There is no channel for ADVANCE or digital-innovation gigs (ENEC IQ-style AI projects, SMR evaluation support, owner's-engineer work on international projects).
- No rotation template targets future roles: there is no "digital twin rotation" or "advanced reactor licensing secondment".

### 2.9 Future workforce: ADVANCE (M11) and Future Me (F09; M21)

**What exists**
- **M11 public pages `/future` and `/future/:tech`:**
  - 6 technology families: small BWR, HTGR, fast liquid-metal, micro, molten salt, international projects. Each has MoU dates and sources.
  - 27 `adv_skills`: 18 `new`, 5 `adapts`, 4 `transfers`.
  - 8 `skill_bridges` from 5 source roles, 5 `adv_tracks` and 11 concept `future_roles` (watch, explore or prepare).
- **`/workforce/future` (HR):** a future-skills radar (`future_skills`, 16 rows = 8 skills × 2 scenarios), a gap band, an adoption-factor slider and `skill_gap_plans` (3 rows).
- **`/my/future` and `/my/future/:tech` (F09):**
  - A SIMULATED readiness index per family = 100 × Σ factor(relation) × min(level, 3)/3 ÷ n, with a "ceiling".
  - A bridge plan ranked by role fit × uplift.
  - A horizon roadmap of 5 lanes: HZ-1 Digital I&C and plant data (now), HZ-2 Cyber hygiene (now), HZ-3 Governed AI-assisted ops (next), HZ-4 Advanced reactor fundamentals (next), HZ-5 Net zero and hydrogen (later). Each lane has public sources, including WEF FoJ 2025, NEA NEST and ENEC/Presight ENEC IQ.
  - Closest concept roles, interest toggles, and "add to my learning goals", which hands off to the Coach.
- **`/workforce/future/interest`:** aggregated interest, suppressed under 10.
- **Tables:** `horizon_lanes` (5), `future_resources` (17), `future_interest` (192), `future_goals` (42).

**Strengths**
- Honest framing: SIMULATED, no deployment decision, no headcount or site.
- Personal readiness ties to evidence.
- Interest becomes a demand signal for training-needs forecasting (F26 counts the "future" source).

**Gaps and defects**
- **The readiness ceiling is structural.** 18 of 27 ADVANCE skills are `new` (factor 0), so the index cannot rise above roughly 20 to 30 for most families, even after learning. Completing `c-adv-intro` or an ADVANCE track gives no credit on `new` skills.
- **Three parallel skill keyspaces:**
  - `adv_skills` ids (`as-*`)
  - `future_skills.skill_key` and `skill_gap_plans.skill_key`, which are free strings ("liquid-metal", "remote-ops")
  - `kafaa_skills` (`sk-*`)

  Future roles reference `as-*` ids, and the HR radar does not link to the 71-skill catalogue or to person skill states. The radar's "readiness" is a hand-entered number, not computed from `person_skills`.
- **Seed defect:** the Scenario A and Scenario B radar rows carry identical demand and readiness values, so the scenario switch changes nothing.
- There is no time-phased demand (skill X at level Y needed by year Z for ADVANCE or the 2030 handover) and no milestone link to ENEC strategy.
- Only 5 horizon lanes. There are no lanes for AI-augmented maintenance, robotics and remote inspection, advanced manufacturing, the hydrogen and industrial-heat value chain, or nuclear-plus-renewables system integration.
- There are no international role exemplars: how comparable operators staff and train for SMR fleets (OPG/BWRX-300 Darlington, TVA Clinch River, Ontario Tech/NWMO), and how the IAEA describes SMR workforce needs.

### 2.10 Workforce planning: skills outlook, handover, KLRA and needs (F35, F22, F20, F26)

**What exists**
- **`/workforce/skills-outlook` (F35, M07 `outlook.ts`).**
  - The demand and supply model runs per **skill family = F01 area** (12; security excluded) and per year to 2035.
  - Demand = (role-profile demand + handover of KHNP OSSA cover) × staffing growth × ADVANCE ramp.
  - Supply = holders at level 2 or above, minus attrition, minus KLRA departures, plus pipeline and DNT intake, plus reskilling conversion.
  - Sliders, a tornado chart, and saved, released or withdrawn outlooks (5 seeded). It is SIMULATED, scaled to organisation people-equivalents, and suppressed under 10.
- **`/workforce/handover` (F22):** KHNP/OSSA dependency up to 2030.
- **`/knowledge/klra*` (F20):** IAEA NG-T-6.11 attrition × position risk over 119 positions.
- **`/training/needs` (F26):** demand per course per quarter from 6 sources: expiry, mandatory, klra, roadmap, coach, future.

**Strengths**
- A real model with an SQL twin.
- It combines attrition, knowledge loss, handover, pipeline and ADVANCE.
- Definitions and suppression are built in.

**Gaps**
- The model works on 12 areas, not 71 skills, and has no proficiency mix (it counts holders at level 2 or above only).
- There is no **AI/automation exposure** factor: no augmentation share by task (from JTA tasks) feeding demand.
- There are no external benchmarks or market data, such as NEA/IAEA nuclear workforce studies, the UAE labour market, or Lightcast or LinkedIn trends.
- There is no **build/buy/borrow/bot** decision support per skill: the `skill_gap_plans` actions train, reskill, hire, partner and research exist only on the M11 radar keys.
- There is no critical future-skills register with an owner, target level, target year, KPIs and progress.

### 2.11 Talent, leadership, mentoring, communities and knowledge (F13, F16 to F21; M04, M22 to M24)

**What exists**
- **Talent review (`/talent/review*`):** an evidence index from F01 (breadth, depth, 12-month growth, validated skills, opportunities, learning agility) and potential anchors.
- **Succession (`/talent/succession*`):** readiness plus hard gates.
- **Leadership (`/leadership*`):** 11 programmes and a 360 on 8 behaviours (safety values, accountability, questioning, communication, decisions, respect, learning, concerns).
- **Mentoring 2.0:** types including **reverse (digital/AI)** and knowledge transfer.
- **Communities and experts (`/communities*`):** 7 communities including Digital and AI, an opt-in expert finder and 16 knowledge-sharing sessions.
- **Knowledge capture (`/knowledge*`):** 11 assets.

**Strengths**
- Learning agility is measured from evidence.
- Reverse mentoring exists.
- Knowledge-loss management follows IAEA guidance.

**Gaps**
- The leadership framework has no future-leadership behaviours: leading digital change, leading AI-augmented teams, inclusion, innovation.
- Learning agility is not shown to employees as a personal "future-readiness" signal.
- Communities, posts, knowledge assets and expert opt-ins do not feed skill evidence.
- There is no future-skills community content pipeline or "skill champions" network.

### 2.12 Training system: SAT, effectiveness, LRS and OJT (F25, F27 to F31, F38)

**What exists**
- `/training/sat*`: JTA with difficulty, importance and frequency (DIF) surveys, task-to-objective links, and a change log.
- `/training/accreditation*`: self-evaluation.
- `/training/effectiveness*`: Kirkpatrick levels 1 to 4.
- `/training/lrs*` and `/my/learning-record`: xAPI, 2,031 statements.
- `/my/ojt`: offline PWA logbook.
- `/training/simulator/scenarios`: 24 scenarios.
- `/training/instructors`: instructor and SME pipeline.

**Strengths**
- Strong SAT and accreditation discipline, plus an LRS.

**Gaps**
- JTA tasks carry no future attributes: change horizon, automation or AI-augmentation exposure, or new-technology relevance.
- There is no "future task" analysis that would let SAT design training for ADVANCE or digital tasks before they exist.
- xAPI statements do not feed F01 skill evidence.
- Effectiveness at Kirkpatrick level 3/4 is not linked to skill-level change, so nobody can see whether a course moved skill levels.

### 2.13 Governance of recommendations (F02, F24; M16)

**What exists**
- `/admin/ai-transparency`: 8 engine cards (navigator, coach, marketplace, talent evidence, mentoring, rotations, experts, Future Me).
- 160 fairness snapshots (rate ratios by group, suppressed).
- Opt-out (unranked lists).
- A change log of engine weights.
- A unit test that protected inputs are never read.

**Gaps**
- There are no engine cards for the digest or Dalil career mode (W5 remaining issue).
- The half-life weight is cosmetic (see 2.3).
- There is no taxonomy-change governance, such as a skills council review or a published change log.
- There is no model-risk documentation template ready for when a model gateway arrives.

### 2.14 Students and early careers (F34; M06)

**What exists**
- `/pathways/journey` and `/pathways/journey/parents`: a 10-question interest explorer (no scoring), a journey board (Mustaqbali to DNT/GDP to first role), and 20 sourced facts.
- Applicants hold 2 skill states each.

**Gaps**
- There is no future-skills exposure for students: no AI or digital literacy starter, no SMR orientation badge, even though `c-adv-intro` is public.
- There is no link to school or university skills frameworks.
- The student credential is not wired (see 2.5).

---

## 3. Data limits at a glance

| Item | Count | Note |
|---|---|---|
| Competencies / domains / levels | 29 / 14 / 4 | Descriptors templated |
| Skills (core + specialised) | 71 (29 + 42) | 0 sources; 15 mapped to ADVANCE; 6 never held |
| Role-competency links / roles | 106 / 28 | Digital in 4 roles, AI in 2 |
| People (staff / applicants / contractors) | 368 (107 / 222 / 32) | 47 staff linked to personas |
| Person skill states / evidence | 1,920 / 2,797 | Staff median 13 skills; validated basis only 66 |
| ADVANCE: techs / adv_skills / bridges / future roles / lanes | 6 / 27 / 8 / 11 / 5 | 18 of 27 skills "new" |
| HR future radar | 16 rows | Scenario A = B (identical values) |
| Future-skill learning items | 3 courses + 5 tracks + 17 resources | All under 4 h except the external programmes |
| Micro-credentials / awards / badges | 16 / 106 / 73 | Demo signing key |
| Opportunities | 25 | About 2 future-skill gigs |
| Skill outlooks / gap plans | 5 / 3 | Gap plans keyed to free strings |
| xAPI statements | 2,031 | Not used as skill evidence |

---

## 4. Gap list (40 specific gaps)

Tags: **[T]** taxonomy, **[I]** inference, **[F]** future layer, **[L]** learning supply, **[C]** credentials, **[M]** mobility, **[W]** workforce planning, **[G]** governance, **[X]** experience. Priority: H (high), M (medium), L (low).

1. **[T][H] No crosswalk to international frameworks.** Add `kafaa_skill_alignments` (skill_id, framework: ESCO | O\*NET | SFIA | SkillsFuture | IAEA | DigComp | UNESCO-AI | QFEmirates, external code, level map, source, as-of), shown on skill and role pages.
2. **[T][H] No transversal future-of-work family.** Add a `transversal` area covering the WEF FoJ 2025 core skills (analytical thinking, resilience, curiosity and lifelong learning, systems thinking, technological literacy, creative thinking, leadership and social influence, environmental stewardship), each mapped to nuclear behaviours.
3. **[T][H] Digital and AI coverage is thin.** There are 7 digital skills and 2 competencies. Add AI literacy levels (use, evaluate, govern), OT/IT convergence, data engineering, cyber hygiene for all (career-safe, not security detail), automation and robotics, AR/VR, and digital procurement.
4. **[T][M] No green or energy-transition skills.** Hydrogen and industrial heat interfaces, ESG and GHG accounting, and grid integration exist only as lane HZ-5.
5. **[T][H] No taxonomy governance.** Skills have no owner, version, review date, change log, lifecycle (emerging, growing, stable, declining) or sources: 0 of 71 are sourced.
6. **[T][M] Level descriptors are templated.** They need behavioural indicators per level, KSA decomposition (as IAEA SAT does) and descriptors for the 42 specialised skills.
7. **[T][M] No mapping of the 4-level scale** to SkillsFuture's 6 levels or SFIA's 7. There is no level above Expert and no "not yet" state.
8. **[T][M] No skills catalogue UI.** Staff and the public have no page listing the 71 skills. The admin Competencies tab is read-only, there is no Skills tab, and there is no "suggest a skill" workflow.
9. **[T][M] The skill graph is mechanical and unused.** `adjacent_ids` (same competency, then same area) feeds no engine. There are no typed relations (prerequisite, related, transfers-to) and no skill clusters.
10. **[T][H] Role profiles describe today only.** 106 links, digital in 4 of 28 roles, AI in 2. There are no "2030/2035 role profiles" with future requirement levels for current roles.
11. **[I][H] Inference uses records only.** Adjacency, co-occurrence (`byCoOccurrence` unused), xAPI (2,031 statements), opportunity text, knowledge assets authored, community expertise and CV or profile text are all ignored. There is no confirm-or-reject "skills you may have" flow.
12. **[I][M] The half-life weight is cosmetic.** `engine_settings.skills.half_life_months` is displayed, but TS and SQL hard-code 1,096 days. There is also no per-area decay; digital skills should decay faster.
13. **[I][M] Confidence is uncalibrated** (max plus bonus). Readiness, gaps and the outlook show no uncertainty.
14. **[I][H] No diagnostic assessments for future skills.** There is no adaptive check for AI literacy, data or digital, and no performance tasks. Check-ins are ratings, and refreshers reuse current-topic items.
15. **[F][H] The three skill keyspaces are disconnected.** `adv_skills` (`as-*`), the free-string `future_skills.skill_key` and `skill_gap_plans.skill_key`, and `kafaa_skills` (`sk-*`) do not join. The HR radar readiness is hand-entered, not computed from `person_skills`.
16. **[F][H] Future roles are not first-class.** The 11 concept roles have no role profile, no career-path edges and no readiness, so they cannot be shortlisted, put on a roadmap or matched to gigs.
17. **[F][H] The ADVANCE readiness ceiling is structural.** 18 of 27 skills are "new" (factor 0) and 6 catalogue skills are held by nobody. Completing ADVANCE tracks or courses earns no partial credit on "new" skills.
18. **[F][M] Seed defect: Scenario A = Scenario B.** The radar's demand and readiness values are identical in both scenarios, so the scenario switch shows no difference.
19. **[F][H] No role-transformation map.** Nothing shows, per current role, the tasks that grow, shrink or are augmented by 2030/2035, the added skills, a bridge curriculum and time-to-ready, in the style of IBF Jobs Transformation Maps.
20. **[F][M] Only 5 horizon lanes.** There are none for robotics and remote inspection, advanced manufacturing, AI-augmented maintenance, industrial heat and hydrogen value chains, or nuclear-renewable integration. Each lane cites only 1 to 4 sources.
21. **[F][M] No international SMR workforce exemplars.** Nothing shows how others staff and train for new builds and SMRs (OPG Darlington BWRX-300, TVA Clinch River, the IAEA SMR workforce guidance).
22. **[W][H] No time-phased skill demand.** Nothing says "skill X at level Y for N people-equivalents by year Z" against ENEC milestones (2030 OSSA end, ADVANCE decision gates). The outlook runs on 12 areas, not 71 skills, and has no level mix.
23. **[W][H] No AI/automation exposure modelling.** JTA tasks (95) have no augmentation or automation exposure attribute, and the outlook has no automation factor.
24. **[W][M] No external benchmarks or market data.** There are no NEA, IAEA or NEI workforce figures, no UAE labour-market data and no skill-trend signals. Everything is internal and SIMULATED.
25. **[W][H] No critical future-skills register.** There is no strategic skills list with an owner, target level and year, KPIs, progress and build/buy/borrow/bot choice. `skill_gap_plans` holds 3 rows on the radar keys.
26. **[W][M] No organisation skills inventory at skill level.** HR sees 12 areas and per-team views, with no 71-skill heatmap by family or entity (suppressed). There are no data-quality metrics (profile coverage, staleness, share validated).
27. **[L][H] No content to close future-skill gaps.** No catalogue course covers data analysis, scripting, digital twins, remote operations, cyber hygiene or green skills, yet micro-credentials and gigs require them. Future content totals 3 courses of 2 to 4 h.
28. **[L][M] No future-skill learning pathways or academies.** There are no levelled pathways per skill, no cohort academies (AI, digital twin, SMR fundamentals) and no capstones.
29. **[L][M] No external catalogue integration** (IAEA e-learning/CLP4NET, WNU, NEA NEST, MOOCs), whether as source-linked resources or tracked as xAPI.
30. **[L][L] No safe practice sandboxes** for AI tools or digital twins, and no simulator scenarios for digital I&C failure modes.
31. **[C][M] Credentials are not externally recognised.** There is no QFEmirates level or credit, no CLR 2.0 transcript, no external wallet or LinkedIn export, and no published issuer registry. The key is a demo key.
32. **[C][M] Open W5 issues.** Seeded micro-credential awards write no F01 evidence. The F34 student credential is not wired. F33 has no engagement-recording RPC and no contractor badge withdrawal.
33. **[C][M] No micro-credentials** for advanced-reactor fundamentals, cyber hygiene, green skills or the transversal skills. MC-TWINS is still a draft.
34. **[M][M] Few future-skill gigs.** About 2 of 25 opportunities build future skills. There is no ADVANCE or digital-innovation gig channel and no rotation template aimed at future roles.
35. **[X][M] No "skills I want to grow" goals at skill level** with target dates outside Future Me goals. There are no personal future-readiness signals, such as learning agility or a skill-currency index.
36. **[X][M] No future-skills nudges.** The weekly digest has no item for a changed role profile, a new emerging skill in my family, a new future-skill gig or course, or a lapsing digital skill.
37. **[X][L] Thin applicant and student skill profiles** (2 states each) and no future-skills starter for students.
38. **[G][M] Engine-card gaps.** The digest and Dalil career mode have no cards. There is no skills-council approval of taxonomy changes and no model-risk template for a future gateway.
39. **[G][M] Future leadership behaviours are missing.** The 8-behaviour leadership 360 does not cover leading digital change, AI-augmented teams, innovation or inclusion.
40. **[I][M] Training effectiveness is not linked to skill change.** Kirkpatrick L3/L4 records (F25) do not measure before-and-after skill levels, so nobody can tell which learning actually moves future skills.

## 5. Implications for the new feature list

- **Build the foundations first:**
  - an alignment and crosswalk table (gaps 1 and 7)
  - taxonomy governance with sources and lifecycle (5, 8)
  - one shared skill keyspace that joins `adv_skills`, the radar and gap plans to `kafaa_skills` (15)
  - future role profiles (10, 16)

  Most future-skill features depend on these.
- **Fix the low-cost defects early:** the half-life wiring (12), the Scenario A = B seed (18), the W5 open items (32), and the missing engine cards (38).
- **Keep the rules.** All new scoring stays deterministic with reasons, unless a server-side model gateway is approved. It must ship as TS plus SQL plus a PGlite validator, use additive `kafaa_*` tables, be complete in EN and AR, suppress groups under 10, and carry SIMULATED labels on every forecast.
- **Back numbers with sources.** Benchmark figures (WEF, NEA, IAEA, OECD, SkillsFuture, ESCO, UAE) should be stored as sourced rows (`sources` json with an as-of date). That matches how horizon lanes and roles already work, and keeps `publicTextIsClean` passing on public pages.
