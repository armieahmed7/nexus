# Kafa'a: additional-features backlog (Rev 1)

Prepared 8 Oct 2026. This is a read-only analysis of `/workspace/kafaa` at the integrated `master` (G1 to G5 merged, 98 routes, about 105 `kafaa_*` tables, about 90 RPCs). Nothing in the code, the database or Netlify was changed.

**Inputs.** I read `CONTRACT.md` (including the changelog), `src/routes/*`, every `src/modules/mNN/routes.ts`, `src/data/schema.ts`, `src/domain/*`, `scratchpad/kafaa_build/{FOUNDATION_DONE,g1..g5_DONE,DEPLOY_READY,QA_REPORT}.md`, the spec (`kafaa_build/spec.txt` = `kafaa/kafaa.html`) and `research/enec_workforce_training.md`. I also checked the primary text of the UAE 10th CNS national report held in `research/enec_raw/iaea/`. External research was done with web search. Sources appear in brackets as [S#] and are listed at the end.

**Rules every feature below follows.** These are the contract non-negotiables plus the brief:
- Synthetic data only, with no real staff names or photos. People are `w-*` and `p-*` synthetic workers or role cards.
- Kafa'a is a mirror, never an authority. It issues no FANR status.
- Security, safeguards and cyber roles appear as a career path only, with "qualified / not qualified" status and nothing more.
- No plant or OT connection. Simulator, roster and HR feeds are seeded and carry a `SimChip`.
- Small groups are suppressed (`suppress()`, `MIN_GROUP_SIZE` = 10).
- Consequential actions go through RPCs: TS signature, local implementation, SQL `kafaa_*` SECURITY DEFINER function, audit row and ledger row.
- Qualification is not a game: no points, streaks or leaderboards on qualification work.
- **No LLM key exists.** Every "AI" feature runs on deterministic or retrieval methods (rules, weighted scoring, BM25, co-occurrence, graph search), shows its reasons, and sits behind a pluggable engine interface (F02) with a disabled `ModelGatewayEngine` slot, as Dalil already has.

---

## 1. What Kafa'a already has (baseline)

| Area | Present today | Notable gaps |
|---|---|---|
| Career (M01) | 28 roles, 27 path edges, ladder, path graph, a path-to-role planner (`/careers/plan`, `findPaths` and `competencyGap` in `m01/careerGraph.ts`), role compare, jobs list | Planning is anonymous and role-to-role. Nothing knows what *this person* can already do, there is no readiness score, no multi-year personal roadmap, and plans export only as `.txt` |
| Competency and qualification (M02) | 29 competencies × 4 levels, 106 role-competency links, 17 versioned qualification standards, task sign-off, expiry sweep, team matrix | No **person-level skills profile**. Proficiency is inferred nowhere. No self, manager or peer skill ratings. No skills outside the qualification standards |
| Licensing (M03) | REG-17 mirror: shifts, medical flag, requalification, candidates, calendar | (complete for its scope) |
| Learning (M04/M05) | 48 courses, 10 training-path tracks, enrolment and waitlist, simulator booking, certificates `KAF-…`, development plans (3 seeded), human-matched mentoring (5 mentors), practice quizzes, secure item bank, JPMs, appeals | No recommendations. No measurement of training effectiveness beyond completion. No learning-record store (courses already carry `packaging: scorm|xapi|none` with nothing consuming it). No refresher or spaced practice. No job and task analysis or SAT design tooling |
| Talent and workforce (M06/M07/M10) | Programme pages and applications, suppressed analytics, critical-role bench **counts**, SIMULATED staffing scenarios, observer releases | No succession or readiness at the person level. No knowledge-loss view. No view of the 2030 KHNP handover |
| Future (M11) | 6 ADVANCE technologies, 27 `adv_skills` (transfers/adapts/new), 8 skill bridges, 11 concept future roles, HR gap plans (SIMULATED) | Nothing is personal. An employee cannot see "how ready am I for SMR-era roles" |
| Culture, Dalil, admin (M08/M13/M16) | INPO traits, HU tools, OE; Dalil = BM25 + intents + `ModelGatewayEngine` stub, with an evaluation gate | Dalil has no career or learning mode grounded in the person's own data. No transparency or fairness view for recommendations |

## 2. What best-in-class platforms and nuclear practice offer that Kafa'a lacks

| Capability | Who does it (evidence) | Kafa'a today | Backlog |
|---|---|---|---|
| Skills ontology plus **skills inference** from work, learning and assessments | Workday Skills Cloud (graph of related skills, inference, verification) [S13]; Cornerstone Skills Engine (detects skills from profiles, training and jobs; role fit scoring) [S17] | Competencies exist, but no person-level skill state | F01, F03 |
| Self, manager and peer skill ratings (a 360 view of skills) | Degreed Peer Ratings plus Self and Manager Ratings [S14] | None | F10 |
| Personal skills passport with **verified** records and consent-based sharing | Singapore MySkillsFuture Careers & Skills Passport (government-verified records, ticks, gap analysis, consented sharing) [S11b] | Certificates only, verified by number | F03, F04, F32, F33 |
| Portable, signed micro-credentials | 1EdTech Open Badges 3.0 on W3C Verifiable Credentials, aligned to skills frameworks; CLR 2.0 bundles [S10] | `KAF-` certificate number lookup | F04, F32 |
| Sector skills framework with proficiency levels, career pathways and **transition maps** | SkillsFuture Skills Frameworks (6 TSC levels, pathways within and across tracks) [S11]; IBF Skills Framework for Financial Services and Jobs Transformation Maps (redeploy staff whose roles change) [S12] | Static role catalogue | F05, F06, F09 |
| Career hub: next-role explorer, readiness, lateral and non-traditional moves | Eightfold Career Hub (pathing from inferred and adjacent skills, mentors, projects, courses) [S15]; LinkedIn Learning Career Hub (Next Role Explorer, role guides) [S18] | Anonymous path finder | F05, F06 |
| AI learning coach and role-play practice | LinkedIn Learning AI Coaching (paths from goals) and AI role-play scenarios built from the organisation's own frameworks [S18] | None | F07, F37 |
| Internal talent marketplace (gigs, projects, stretch work, mentoring) | Gloat (matches people to gigs, projects, mentorships and roles from skills and interests) [S16]; Gartner internal talent marketplace category [S16b] | None | F08, F15, F23 |
| Mentoring and coaching **for knowledge transfer** | IAEA-TECDOC-1999 (2022) Mentoring and Coaching for KM in Nuclear Organizations [S2]; ENEC's leadership mentoring and HiPo coaching from the 9-box review [S22] | Basic opt-in mentor offers | F13 |
| **Knowledge loss risk management** (attrition × position criticality × codification) | IAEA NG-T-6.11 (2017) KLRM [S1]; FANR runs a KLRA and transfer plans [S22] | None | F20, F21, F22 |
| Capturing tacit knowledge from departing experts (structured interviews, recorded deep-dives, searchable transcripts) | IAEA structured-interview capture; IAEA/WANO capture at Krško [S6]; Sandia recorded interviews with searchable transcripts [S6b] | None | F21 |
| Succession planning and talent review | IAEA lists succession planning as a key HRM component [S5]; 9-box with separate readiness (ready now / ready soon) [S26]; ENEC already runs 9-box reviews for HiPo coaching [S22] | Bench **counts** only | F18, F19 |
| Systematic Approach to Training (ADDIE): job and task analysis, design, evaluation | IAEA TRS-380, superseded by NG-T-2.8 (2021) [S3]; INPO ACAD objectives and criteria and self-evaluation reports [S7]; FANR-REG-16 Art. 9 [S24] | Catalogue and qualification cards only | F27, F29 |
| Simulator scenario management | IAEA-TECDOC-1963 (2021) on use of simulators for training and authorisation [S4] | Simulator slot booking only | F28 |
| Training effectiveness (Kirkpatrick L1 to L4) | IAEA Safeguards Training Section adopted Kirkpatrick [S8]; WINS Academy [S8b] | Completion counts | F25, F26 |
| xAPI statements and a learning record store (LRS) | ADL xAPI, now IEEE 9274.1.1-2023 (xAPI 2.0): tracks simulations and on-the-job learning, not only e-learning [S9] | Packaging flag unused | F30 |
| National and sector talent programmes | UAE Nafis 2026: from counting Emiratis to the quality and impact of Emiratisation [S20]; NEA calls to widen the talent pool, including women [S25] | Emiratisation aggregates | F22, F34 |

## 3. Conventions for the new work

- **New modules M17 to M27.** `ModuleId` in `src/routes/types.ts`, `MODULES` in `src/routes/modules.ts` and the static imports in `src/routes/registry.ts` only know M01 to M16. **F01 (wave 0, foundation) registers M17 to M27 once**, with an empty `routes.ts`, i18n namespaces `m17..m27.{en,ar}.json`, a schema block and a migration slot. Each later engineer then owns exactly one folder per wave and never touches shared routing files.

| Module | Folder | Name | Owner wave(s) |
|---|---|---|---|
| M17 | `src/modules/m17` | Skills Passport | W1, W2, W5 |
| M18 | `src/modules/m18` | Career Navigator | W1, W2 |
| M19 | `src/modules/m19` | Learning Coach | W1, W2 |
| M20 | `src/modules/m20` | Opportunities (marketplace, rotations, alumni) | W1, W2, W3 |
| M21 | `src/modules/m21` | Future Me (personal ADVANCE readiness and horizon) | W1 |
| M22 | `src/modules/m22` | Leadership and communities | W2 |
| M23 | `src/modules/m23` | Talent review and succession | W3 |
| M24 | `src/modules/m24` | Knowledge continuity | W3 |
| M25 | `src/modules/m25` | Training effectiveness and needs | W4 |
| M26 | `src/modules/m26` | SAT and accreditation workbench | W4 |
| M27 | `src/modules/m27` | Learning record store | W4 |

- **Existing folders touched by a later wave** (one engineer each, never two in a wave): `m04` (W2 mentoring, W4 simulator scenarios), `m02` (W4 instructors, W5 OJT logbook), `m07` (W3 handover board, W5 skills forecast), `m16` (W3 AI transparency), `m09` (W5), `m06` (W5), `m13` and `src/shell` (W5).
- **New policy resources** (F01 adds them to `src/auth/policy.ts` and `docs/RBAC.md` regenerates): `skills_profile`, `opportunities`, `talent_review` (confidential), `knowledge`, `learning_analytics`, `sat`, `lrs`. Existing roles are reused (employee, licensed_operator, manager, instructor, training_manager, hr_analyst, hr_director, admin, auditor, partner_*). One opt-in capability, `sme` (subject-matter expert), is a row in `kafaa_sme_profiles` (F21), not a platform role.
- **Engines (F02).** Pages call `useEngine('skills'|'recommend'|'match'|'search')`. The default implementation is `Deterministic*Engine`. `ModelGatewayEngine` reads `VITE_KAFAA_MODEL_URL`; it is absent today, so the slot shows "disabled". Every ranked result carries `reasons[]`, rendered by a shared `<WhyThis>` popover.
- **Migrations:** `supabase/migrations/20261009<W><E>NNN_kafaa_w<W>e<E>_<topic>.sql`, for example wave 1 engineer 2 = `20261009112001_kafaa_w1e2_career.sql`. They are additive and idempotent, as today.
- **Seed:** each engineer adds a builder `scripts/seed/fNN.mjs`, hooked in `build-seed.mjs` by F01's loader (`scripts/seed/ext/*.mjs` auto-loaded), so wave engineers never edit `build-seed.mjs`.

## 4. Wave plan

Each wave has 4 to 5 engineers (E1 to E5) and one owned folder per engineer. Waves run in order. Inside a wave, features depend only on earlier waves or wave 0.

| Wave | Theme | E1 | E2 | E3 | E4 | E5 |
|---|---|---|---|---|---|---|
| **0** (foundation, 1 engineer, lands first) | Enablers | F01 Skills core + M17 to M27 scaffolding · F02 Engine kernel | | | | |
| **1** | Employee-facing: career pathway, upskilling, future roadmap | `m17`: **F03** Skills Passport, **F04** Credential Wallet | `m18`: **F05** Career Navigator, **F06** Career Roadmap and what-if | `m19`: **F07** Learning Coach | `m20`: **F08** Opportunity Marketplace | `m21`: **F09** Future Me |
| **2** | Development depth and managers | `m17`: F10 Skill check-ins (360), F11 Team capability heatmap | `m18`: F12 Career conversations | `m04`: F13 Mentoring 2.0 · `m19`: F14 Refreshers | `m20`: F15 Rotations and shadowing | `m22`: F16 Leadership journeys, F17 Communities of practice |
| **3** | Talent continuity and governance | `m23`: F18 Talent review, F19 Succession | `m24`: F20 KLRA, F21 Knowledge capture studio | `m07`: F22 Handover 2030 board | `m20`: F23 Alumni and expert reserve | `m16`: F24 Recommendation transparency and fairness |
| **4** | Training system (SAT) | `m25`: F25 Kirkpatrick effectiveness, F26 Training needs forecast | `m26`: F27 JTA workbench, F29 Accreditation readiness | `m04`: F28 Simulator scenario library | `m27`: F30 Learning record store (xAPI) | `m02`: F31 Instructor and SME pipeline |
| **5** | Ecosystem and reach | `m17`: F32 Micro-credentials · `m02`: F38 OJT practice logbook | `m09`: F33 Contractor skills passport | `m06`: F34 Student-to-career journey | `m07`: F35 Skills supply-and-demand outlook | `src/shell`: F36 Weekly digest · `m13`: F37 Dalil career mode |

Totals: 38 features (2 enablers and 36 product features). Complexity: S = 3, M = 26, L = 9.

---

## 5. Feature cards

### Wave 0: enablers (foundation)

#### F01 · Skills core: person skill state, evidence and the M17 to M27 scaffolding
- **For:** all later features (platform).
- **Problem:** Kafa'a knows roles, competencies and records, but not "what this person can do at what level, and how we know". Every career, coach and marketplace feature needs that.
- **What it does:**
  - **Registers** modules M17 to M27: `ModuleId`, `MODULES`, registry imports, empty `routes.ts`, i18n namespaces, schema blocks and policy resources.
  - **Adds a skills layer.** `kafaa_skills` is a finer layer under the 29 competencies. It reuses the competency codes, adds about 60 skills (APR-1400 systems families, human performance tools, digital I&C, data, project, leadership) and maps `adv_skills` into it.
  - **Derives each person's skill state** from evidence:
    - passed qualification records map to the competencies on that standard's roles, giving level `verified`
    - qualifying course passes and assessment passes give level `evidenced`
    - JPM passes
    - self or manager ratings (`claimed` or `validated`)
  - **Applies a recency decay** with a configurable half-life (default 36 months for non-qualified evidence; qualification evidence holds while the record is current).
  - **Pure functions** in `src/domain/skills.ts`: `deriveSkillState(evidence[], now)` → `{level 0-4, confidence 0-1, basis: verified|evidenced|validated|claimed, reasons[]}`. Security-restricted standards contribute only "qualified" to their security competency and never their tasks.
  - **Seeds** skill states for all 345 synthetic people from their existing seeded records, so wave 1 has rich data on day one.
- **Data:**
  - `kafaa_skills` (id, competency_id, name_en/ar, area, adjacent_ids[], sources)
  - `kafaa_person_skills` (person_id, skill_id, level, confidence, basis, updated_at; RPC-only)
  - `kafaa_skill_evidence` (person_id, skill_id, kind qual|course|assessment|jpm|rating|ojt|credential, ref_id, level, observed_on)
  - RPC `recomputeSkills(personId?)`. Self, or manager in scope, or training_manager for all. Idempotent and audited without a ledger write.
- **RBAC:** `skills_profile` Own (employee), Scope (manager, instructor in scope), Agg (hr_analyst), A (training_manager for recompute-all). Partners are excluded until F33.
- **Acceptance:**
  - All 345 synthetic people have a skill state, and each state lists at least one reason that links to its evidence row.
  - A qualification record that passes `qualView` = current yields `verified`. The same record expired yields at most `evidenced`, with a "lapsed" reason.
  - No security-restricted task id or title appears in any `kafaa_skill_evidence` row (unit test plus PGlite check).
  - `recomputeSkills` is deterministic: two runs give byte-identical output.
  - Every new route id exists in both EN and AR, `npm run verify` is green, and the smoke suite visits new routes automatically.
- **Complexity:** L. **Depends on:** none. **Touches:** foundation files (`src/routes/*`, `src/auth/policy.ts`, `src/data/schema.ts`, new `src/domain/skills.ts`, `scripts/seed/ext/`).
- **Why ENEC:** skills inference over a skills graph is the foundation of Workday, Cornerstone and Eightfold [S13][S17][S15]. ENEC already runs every training programme on SAT with job-task-derived qualification cards [S22], so Kafa'a can infer skills from authoritative evidence rather than keywords.

#### F02 · Engine kernel: deterministic recommenders, explanations and the model slot
- **For:** all AI-flavoured features; admins.
- **Problem:** without a shared kernel, each team would build its own scoring with no explanations and no common way to plug in a model later.
- **What it does:** `src/domain/engines/` defines:
  - `SkillsEngine`: wraps F01.
  - `RankEngine.rank(candidates, ctx)` → `{id, score, reasons[]}`, with these strategies:
    - weighted gap closure: Σ(level gain × importance weight) / effort hours
    - co-occurrence lift ("people who moved RO→SRO completed…", computed on synthetic histories)
    - cosine skill-vector match
    - path search (promotes `findPaths`/`reachable` from `m01/careerGraph.ts` into `src/domain/careerGraph.ts`, with m01 re-exporting)
  - `SearchEngine`: promotes Dalil's BM25 (`m13/dalil/search.ts`) to `src/domain/search.ts`, with m13 re-exporting.
  - `ModelGatewayEngine`: the disabled slot.
  - UI: `<WhyThis reasons>`, `<EngineBadge kind="deterministic|model">`.
  - Golden-case evaluation harness `tests/unit/engines-golden.test.ts`.
  - Admin card on `/admin/integrations`: which engine is active per surface.
- **Data:** none persistent. Optional `kafaa_engine_settings` (surface, engine, weights json, updated_by) has write mode `rpc` (`setEngineWeights`, admin only, audited).
- **RBAC:** settings are admin W and auditor R.
- **Acceptance:**
  - Every ranked list in waves 1 to 5 returns at least one human-readable reason per item (lint test over the engine outputs).
  - Switching the engine to `model` without a URL falls back to deterministic and shows "model unavailable"; there is no runtime error.
  - Golden cases: for persona `k-ro`, the top career suggestion is SRO, and the top course gap closes an SRO-required competency.
  - m01 and m13 behaviour is unchanged (their existing tests stay green after the promotion).
- **Complexity:** M. **Depends on:** F01. **Touches:** `src/domain/*`, `src/ui/WhyThis.tsx` (promotion), `m16/AdminIntegrationsPage.tsx` (one card).
- **Why ENEC:** the spec commits Kafa'a to explainable, governed AI. Dalil already proves the retrieval-plus-model-slot pattern (M13). Explanations also matter because ENEC's own HiPo selection is evidence-led [S22].

---

### Wave 1: employee-facing career pathway, upskilling and future roadmap

#### F03 · My Skills Passport (`/my/skills`)
- **Wave/owner:** W1 · E1 · `src/modules/m17` (new).
- **For:** every employee and trainee, licensed operators and contractors in a later wave (F33).
- **Problem:** staff cannot see in one place what they are qualified and skilled in, how it was evidenced, or what is about to lapse. Managers rebuild this picture from spreadsheets.
- **What it does:**
  - **Profile header:** role, family, years in role, current qualifications (mirror chips) and licence status (mirror; links to `/my/licence`).
  - **Skills radar** by competency domain: current level vs. the current role's required level (`role_competencies`), plus an optional overlay of the target role.
  - **Skills list:** each skill shows level, basis (Verified, Evidenced, Validated or Claimed, each a distinct chip) and confidence. The evidence drawer shows the records, dates and source system ("as recorded in … on …").
  - **"Add a claim":** self-rating with a short note and optional evidence link. It stays `claimed` until validated (F10).
  - **"Expiring and decaying":** quals within 90/60/30 days (`qualView`) and skills whose evidence is ageing.
  - **"Strengths for my next move":** top three transferable skills, computed by F02 cosine similarity against reachable roles.
  - **Export:**
    - printable one-page passport (EN/AR), with a footer "Kafa'a is not an authority…"
    - JSON in the Open Badges-style envelope from F04
- **Data:**
  - Reads `kafaa_person_skills` and `kafaa_skill_evidence`.
  - New `kafaa_skill_claims` (person_id, skill_id, level, note, evidence_url?, status claimed|validated|rejected, created_at).
  - RPC `claimSkill`: own only, rate-limited to 20 per day, and refused for security competencies.
- **RBAC:** Own read and write. Managers see their scope (read). HR sees aggregates only. Auditors read audit only.
- **Acceptance:**
  - `k-ro` sees all RO-required competencies with a level and basis, and every Verified chip opens a drawer naming its qualification record.
  - A claim on a security competency is refused with code `security_restricted` and an audit row.
  - Arabic `/ar/my/skills` renders the radar mirrored, with Arabic labels and digits per settings.
  - The radar has an accessible table alternative.
  - The printed passport contains no email, no photo and no security task detail.
- **Complexity:** M. **Depends on:** F01, F02.
- **Why ENEC:**
  - It gives staff a SkillsFuture-style verified passport [S11b] that sits on top of ENEC's real SAT records, rather than self-reported skills.
  - ENEC delivered 581,090 training hours and 76,079 e-learning completions in 2024 [S23]; the passport turns that volume into a visible personal asset.

#### F04 · Credential Wallet and public badge verification (`/my/skills/wallet`, `/verify/badge/:id`)
- **Wave/owner:** W1 · E1 · `m17`.
- **For:** employees, the public and partners verifying a credential, and HR.
- **Problem:** `KAF-` certificates can be looked up by number, but cannot be shared as a portable, tamper-evident credential with criteria and skills attached.
- **What it does:**
  - Wraps each Kafa'a-issued certificate and course completion in an **Open Badges 3.0-shaped** JSON-LD credential: `OpenBadgeCredential`, achievement criteria, `alignment` to Kafa'a skills, issuer "Kafa'a demo tenant", `evidence`.
  - Signs it with an Ed25519 demo key: the private key sits server-side in an SQL function, and the public key is published at `/kafaa/.well-known/kafaa-issuer.json`.
  - Wallet screen: cards, share link (public verify page shows holder initials only), download JSON, revoke-on-expiry status.
  - Public verify page checks the signature and status and shows the criteria. A banner says "Internal Kafa'a credential; not a FANR certificate or licence".
  - FANR licences and qualification mirrors are **never** issued as badges.
- **Data:**
  - `kafaa_badges` (id, person_id, certificate_id?, achievement json, issued_on, status, signature, public_slug)
  - RPC `issueBadge(certificateId)` (own, from a valid certificate only)
  - RPC `verifyBadge(slug)` (public, rate-limited, audited)
- **RBAC:** Own; public verify only via the RPC, returning initials only.
- **Acceptance:**
  - A badge cannot be issued from an expired or revoked certificate (`not_eligible`).
  - Tampering with any field of the downloaded JSON makes `/verify/badge` show "signature invalid".
  - The verify payload passes `check:public`: no names, emails or photos.
  - Nothing in the licence or qualification tables can be issued as a badge (unit test).
- **Complexity:** M. **Depends on:** F03.
- **Why ENEC:**
  - Open Badges 3.0 is now the standard for verifiable, skills-aligned credentials [S10].
  - Portable credentials support ENEC's contractor equivalency route, where contractors "meet identical qualifications" or go through equivalency [S22], and support supplier academies (M09).

#### F05 · Career Navigator: "Where can I go from here?" (`/my/career`)
- **Wave/owner:** W1 · E2 · `src/modules/m18` (new).
- **For:** employees and trainees (most impressive with `k-lo-trainee`, `k-ro`, `nse`, `qc-inspector`).
- **Problem:** `/careers/plan` is anonymous and treats everyone in a role as identical. Staff need *personal* readiness for each possible move, including lateral and cross-functional ones.
- **What it does:**
  - **Opportunity map:** a personal path graph centred on my role. Reachable roles within two steps (`reachable`) are coloured by readiness %, and edge type (vertical, lateral, cross-functional) is shown by line style.
  - **Readiness score per role:** weighted coverage = Σ min(my level, required) / required × weight (core 3, important 2, useful 1). Gates are shown separately as pass, pending or not-met from `career_paths.conditions` (REG-17 routes via `routeChecks`, experience months, required qualifications). A gate is never folded into the %.
  - **Role cards:** "ready now / ready in about N months / stretch", the top three gaps with closing actions from F07, and typical time from the edge conditions.
  - **"Roles like mine":** cosine similarity of role skill vectors finds non-obvious lateral moves, for example chemistry technician → RP technician, with reasons.
  - **Shortlist** up to three target roles. The shortlist is stored and drives F06, F07 and F08.
  - Security, safeguards and cyber roles show "career path only; readiness not computed".
- **Data:**
  - `kafaa_career_targets` (person_id, role_id, rank, created_at; write `direct` own)
  - RPC `careerReadiness(personId, roleIds[])`, which returns per-role score, gates and reasons. It is a read-only computation in SQL and TS for parity.
- **RBAC:** Own. A manager in scope sees a team member's shortlist only if the member shares it (`shared bool`).
- **Acceptance:**
  - `k-ro` sees SRO with a gate list containing the three SRO routes and article references, plus a readiness % with reasons.
  - Gates never inflate readiness: if a gate is not met, the role cannot show "ready now" (unit test).
  - At least one lateral suggestion carries a "similar skills" reason.
  - Security roles show no %.
  - The page works anonymously-off (`signedIn` guard) and in Arabic RTL with flipped arrows.
- **Complexity:** L. **Depends on:** F01, F02.
- **Why ENEC:**
  - Eightfold, LinkedIn and SkillsFuture all lead with personal next-role exploration [S15][S18][S11].
  - At ENEC the ladder LO → RO → SRO → Shift Supervisor is long and regulated (COIT is 91 weeks / 2,912 h [S23]), so seeing gates and gaps early is high value.

#### F06 · Career Roadmap and what-if simulator (`/my/career/roadmap`)
- **Wave/owner:** W1 · E2 · `m18`.
- **For:** employees; managers in career conversations (F12).
- **Problem:** people plan careers in years, but Kafa'a has no multi-year personal timeline that combines training pipelines, licensing gates and development.
- **What it does:**
  - Pick a target from the shortlist. The roadmap lays out a **quarter-by-quarter timeline** (up to 10 years):
    - programme blocks with published lengths, e.g. COIT 91 weeks, LOIT 60 weeks, discipline initial training from the training paths (`/learn/paths/:track`)
    - REG-17 milestones (exam, 60-day notice, certification)
    - experience-month conditions
    - development blocks (mentoring, rotation, leadership course)
  - **What-if sliders:** "start COIT next intake vs. in a year", "add a rotation", "take the Graduate Plant Operator route". The timeline recomputes and shows the earliest feasible date and the critical path.
  - **Compare two scenarios** side by side.
  - **"Send to my development plan":** writes plan activities through a new RPC.
  - Every duration shows its source chip (SR2024 or the training-path source) or a SAMPLE tag.
- **Data:**
  - `kafaa_roadmaps` (id, person_id, target_role_id, scenario json, created_at; direct own)
  - RPC `roadmapToPlan(roadmapId)`, which creates or extends `dev_plans`/`plan_activities` as `draft`. **Contract request:** the M04 owner agrees to an M18-owned RPC writing M04 tables (or exposes `rpc.addPlanActivities`).
- **RBAC:** Own; manager Scope read when shared.
- **Acceptance:**
  - For `k-lo-trainee` → RO, the timeline includes COIT with its published duration and source, and the FANR exam milestone with the 60-day notice.
  - Moving the COIT start slider moves every dependent milestone; the earliest date is never before the gate conditions allow.
  - "Send to plan" creates a draft plan with one activity per development block and an audit row; re-sending does not duplicate.
  - Printed and exported roadmaps label durations from generic sources as "indicative".
- **Complexity:** L. **Depends on:** F05; G2 training paths data.
- **Why ENEC:** ENEC's operator and technician pipelines are multi-year (LOIT 60 weeks, COIT 91 weeks, GPO "three-year training phase before advancing to SRO" [S23][S21b]). A personal roadmap makes those commitments visible to Emirati entrants and their managers.

#### F07 · Learning Coach: next-best learning with reasons (`/my/coach`)
- **Wave/owner:** W1 · E3 · `src/modules/m19` (new).
- **For:** employees and trainees.
- **Problem:** the catalogue (48 courses, 40 programmes, practice forms) is browsable but not personal. Nobody tells a person what to do next to close the gap to their current or target role.
- **What it does:**
  - **"This month for you" feed** of 5 to 8 ranked actions:
    - courses and sessions with seats (`sessionAvailability`)
    - practice quizzes (practice bank only)
    - OJT tasks from qualification standards
    - a mentor match (M04 mentors)
    - an opportunity (F08)
    - readings (OE lessons the person can read)
  - Ranking uses F02 weighted gap closure across current role (weight 1.0, with must-keep items first) and shortlisted targets (0.6). Expiring qualification refreshers are always pinned on top.
  - Each card has **"Why this?"** (for example: closes *Reactor theory* gap 2 → 3 for SRO; 12 h; 3 seats on 4 Nov), plus Enrol, Save and Not relevant (the feedback adjusts future weights per person).
  - **Weekly learning goal** in hours: optional, private, and with no streaks.
  - **"Ask the coach":** retrieval Q&A over the course catalogue, training paths and FAQ using `SearchEngine` and templates, for example "which courses cover chemistry for RO?". It answers with citations and never uses secure items.
- **Data:**
  - `kafaa_coach_feedback` (person_id, item_kind, item_id, signal saved|dismissed|enrolled, at)
  - `kafaa_learning_goals` (person_id, hours_per_week, updated_at; direct own)
  - Enrolment uses the existing `rpc.enrolCourse`.
- **RBAC:** Own; HR sees aggregated acceptance rates (≥10).
- **Acceptance:**
  - For `k-ro` with an RO qualification within 60 days of expiry, the first card is the related refresher or requalification, with the reason "expires in N days".
  - Every card has at least one reason. Dismissed items do not return for 90 days.
  - No item from `items.bank = 'secure'` is ever referenced in the feed or the coach answers (unit test).
  - The coach answers "Which course covers radiation protection basics?" with at least one catalogue citation.
  - No points, streak or leaderboard UI exists on the page (component test).
- **Complexity:** M. **Depends on:** F01, F02; F05 optional (targets).
- **Why ENEC:**
  - LinkedIn Learning's AI coaching recommends paths from goals [S18], and SkillsFuture's portal gives personalised course and career recommendations [S11b].
  - ENEC's training load (218 hours per employee in 2024 [S23]) means relevance matters more than volume. The spec's success metric says training hours should be "tracked, not maximised".

#### F08 · Opportunity Marketplace: gigs, projects, outage support, shadowing (`/opportunities`)
- **Wave/owner:** W1 · E4 · `src/modules/m20` (new).
- **For:** employees (apply), managers (post and approve release), HR (oversight).
- **Problem:** development at ENEC depends on who you know. There is no transparent way to find short stretch assignments, such as outage support, project tasks, OE reviews, knowledge-capture interviews or STEM outreach, or to get credit for them.
- **What it does:**
  - **Post an opportunity** (manager): title, kind (project, outage support, shadowing, OE review, knowledge capture, outreach, research), skills needed and skills gained, hours per week, dates, location type (office, site non-protected area, remote), eligible families, and an "Emirati development priority" flag.
  - **Marketplace** for staff: match score (F02 cosine on skills needed vs. mine, plus a development bonus for skills gained that are in my gaps, plus a target-role bonus) with reasons, filters and save.
  - **Apply:** short note → **line manager release approval** (maker-checker; the poster cannot approve their own release) → poster selection → completion → **outcome sign-off**. The sign-off writes `kafaa_skill_evidence` (kind `ojt`, level `evidenced`).
  - Protected-area, security and cyber opportunities are never listed. Posting such a kind is refused.
- **Data:**
  - `kafaa_opportunities` (id, posted_by, org_id, kind, title_en/ar, summary_en/ar, skills_needed[], skills_gained[], hours_week, start_on, end_on, seats, status draft|open|closed|filled, priority_flags[])
  - `kafaa_opportunity_applications` (id, opportunity_id, person_id, note, status applied|released|declined_release|selected|not_selected|completed|withdrawn, history json)
  - RPCs `postOpportunity`, `applyOpportunity`, `releaseDecision`, `selectApplicant`, `completeOpportunity`, each audited, with ledger rows for selection and completion.
  - Seed: 25 synthetic opportunities.
- **RBAC:** `opportunities` R for staff. W for managers and training_manager. A for the line manager of the applicant (release) and the poster (selection). HR Agg; auditor R.
- **Acceptance:**
  - An applicant's own manager must release before the poster can select; selecting without release is refused (`release_required`).
  - A poster cannot release their own direct report onto their own opportunity (`maker_checker`).
  - Completion sign-off adds an `ojt` evidence row, and the applicant's F03 passport shows it.
  - An opportunity with kind `security` or `protected_area` cannot be created (refused and audited).
  - Match reasons are present on every card, and HR aggregates (applications by family) are suppressed below 10.
- **Complexity:** L. **Depends on:** F01, F02.
- **Why ENEC:**
  - Internal talent marketplaces match people to gigs, projects and mentoring from skills [S16][S16b].
  - At Barakah, outages and project work are natural stretch assignments. Opportunities also give the roughly 400 KHNP experts' successors structured exposure before 2030 [S21].
  - Evidence that rotation alone reduces turnover is mixed [S30], so Kafa'a measures skills gained, not retention claims.

#### F09 · Future Me: my readiness for the ADVANCE era, plus a horizon roadmap (`/my/future`)
- **Wave/owner:** W1 · E5 · `src/modules/m21` (new).
- **For:** employees and engineers curious about SMRs and advanced reactors; HR as a talking point.
- **Problem:** M11 shows technologies and skill bridges for HR and the public, but no employee can see *their own* position relative to future skills, or a personal "skills to watch" list.
- **What it does:**
  - **Personal readiness by technology family** (from `adv_skills` mapped to `kafaa_skills` in F01):
    - **transfers:** my verified level counts fully
    - **adapts:** counts at half
    - **new:** counts zero
  - The result is an index from 0 to 100 marked **SIMULATED**, with the line "ENEC is evaluating these technologies; no deployment decision is implied" (`m11.common.noDecision`).
  - **Bridge plan:** the 3 to 5 skill bridges (`skill_bridges`) that move me most, with courses and readings from the catalogue and partner programmes (KU MSc, NITSS, SRC/GIEMS MoU) as source-linked suggestions.
  - **Horizon roadmap 2026 to 2035:** sourced trend lanes:
    - digital I&C and data
    - AI-assisted operations (governed)
    - cyber hygiene (career-path-only for cyber roles)
    - advanced reactor fundamentals
    - net-zero and hydrogen interfaces
  - Each lane shows "why it matters", a public source, and "my current level". Concept future roles (`future_roles`) I am closest to are shown by `from_role_ids` and skill overlap.
  - **"Add to my learning goals"** hands off to F07 and is stored as a coach target.
- **Data:**
  - Reads M11 tables, `kafaa_person_skills` and `career_paths`.
  - New `kafaa_horizon_lanes` (id, title_en/ar, summary_en/ar, skill_ids[], horizon now|next|later, sources json). It is public-readable and passes the `publicTextIsClean` guard.
  - New `kafaa_future_interest` (person_id, tech_id|lane_id, created_at; direct own).
- **RBAC:** Own. The horizon lanes are public read. HR sees the interest aggregate (≥10) as a demand signal for F26.
- **Acceptance:**
  - Every index on the page carries the SIMULATED chip and the no-decision line. Public payloads pass `publicTextIsClean` (no headcount or site).
  - Changing one verified skill changes the index deterministically (unit test on the formula).
  - Each horizon lane cites at least one public source with an as-of date.
  - Interest aggregates show "suppressed" below 10.
- **Complexity:** M. **Depends on:** F01, F02; M11 data.
- **Why ENEC:**
  - ENEC's ADVANCE programme (Nov 2023) evaluates SMRs and microreactors with multiple MoUs (spec §2).
  - The NEA notes that SMRs need new skills across the value chain [S25].
  - The WEF expects nearly 40% of core job skills to change by 2030 [S19].
  - Showing staff their personal bridge plan turns the future-workforce story from HR-only into an employee benefit.

---

### Wave 2: development depth and managers

#### F10 · Skill check-ins: self, manager and peer validation with calibration (`/my/skills/checkins`, `/team/skills/validate`)
- **Wave/owner:** W2 · E1 · `m17`.
- **For:** employees, line managers, peers.
- **Problem:** claimed skills (F03) stay unvalidated, and there is no light way for managers and peers to confirm proficiency outside formal qualification.
- **What it does:**
  - The employee asks for a check-in on up to five skills, with a self level and evidence note, from their manager and optionally up to two peers. Peers are chosen from the same team, see only the named skills, and give a level plus a one-line example.
  - The manager validates (setting `validated`) or adjusts with a reason.
  - A **calibration view** for the manager shows the team distribution per skill, and flags raters who are systematically higher or lower than the qualification evidence (deterministic offset).
  - Qualified-task skills cannot be validated this way; they show "Verified by qualification only".
- **Data:**
  - `kafaa_skill_checkins` (id, person_id, skills json, status, requested_at)
  - `kafaa_skill_ratings` (checkin_id, rater_person_id, rater_kind self|manager|peer, skill_id, level, example, at)
  - RPCs `requestCheckin`, `submitRating`, `validateCheckin`. Validation writes evidence `rating`.
- **RBAC:** Own for requests. Manager Scope, A for validation. Peers W only on rating rows addressed to them. No HR access to individual ratings.
- **Acceptance:**
  - A peer cannot see the requester's other skills or other raters' answers.
  - The person cannot validate their own check-in (`self_validate`).
  - A qualification-standard skill cannot be raised by a check-in.
  - The calibration view suppresses distributions for teams under 10.
- **Complexity:** M. **Depends on:** F03.
- **Why ENEC:** Degreed combines self, manager and peer ratings for a 360 view of skills [S14]. Validation turns claims into trustworthy data for F05, F08 and F18.

#### F11 · Team capability heatmap and crew composition view (`/team/skills`)
- **Wave/owner:** W2 · E1 · `m17`.
- **For:** line managers, shift supervisors, training managers.
- **Problem:** `/team/quals` shows qualification status. Managers also need **skill depth and single points of failure** across the team, for example "only one person at level 4 in chemistry sampling", plus a view of how each crew's mix compares with the crew profile.
- **What it does:**
  - People × skills heatmap (levels and basis).
  - **Coverage per skill** against a manager-set minimum ("at least 3 people at level ≥3"), with single-point-of-failure flags.
  - **Crew view** for shift supervisors: counts per skill per crew, **counts and availability only**, re-using the `crewAvailability` approach. No medical or licence detail.
  - "What if X leaves or rotates?" toggle (SIMULATED).
  - Suggested actions: nominate for a course (hands off to F07), post an opportunity (F08), request mentoring (F13).
  - CSV export watermarked with role and date.
- **Data:**
  - `kafaa_team_skill_targets` (team_id, skill_id, min_people, min_level, set_by)
  - RPC `teamCoverage(teamId)`.
- **RBAC:** `skills_profile` Scope (managers), training_manager Scope over their programmes, HR Agg only.
- **Acceptance:**
  - The heatmap shows only people in the manager's scope (RLS test with a manager from another team).
  - A skill with exactly one qualified person at the target level shows a single-point-of-failure flag.
  - The crew view exposes no medical or licence fields (payload test).
  - The what-if toggle is labelled SIMULATED and persists nothing.
- **Complexity:** M. **Depends on:** F01, F03.
- **Why ENEC:** knowledge and skill concentration is exactly what IAEA knowledge-loss guidance asks organisations to find [S1]. Attrition was 7.3% in 2024 [S23, uncertain year mapping].

#### F12 · Career conversations and aspirations (`/my/career/conversations`, `/team/conversations`)
- **Wave/owner:** W2 · E2 · `m18`.
- **For:** employees and line managers.
- **Problem:** development plans exist (M04), but there is no structured, recorded career conversation feeding them, and aspirations (mobility, relocation, leadership interest) are never captured.
- **What it does:**
  - **Pre-filled agenda:** passport highlights, shortlisted targets and readiness (F05), roadmap (F06), expiring quals, coach progress.
  - The **employee preparation form** covers aspirations (stay and deepen, grow vertically, move laterally, lead, specialise), mobility, a 12-month and a 3-year goal, and support needed.
  - The manager adds notes and agreed actions. Actions become plan activities (via `roadmapToPlan`-style RPC) and coach goals.
  - The employee acknowledges, and can add a comment if they disagree.
  - Cadence reminder every 6 months (feeds F36).
  - The **"Aspiration" signal** is visible to HR only as aggregates (≥10) by family. Individual aspiration is visible in talent review (F18) only with the employee's consent toggle.
- **Data:**
  - `kafaa_career_conversations` (id, person_id, manager_person_id, held_on, prep json, notes, actions json, status draft|held|acknowledged, employee_comment, share_with_talent_review bool)
  - RPCs `submitPrep`, `recordConversation`, `acknowledgeConversation`.
- **RBAC:** Own plus the manager of record. HR Agg. The talent-review read requires the consent flag.
- **Acceptance:**
  - A manager cannot mark a conversation acknowledged on the employee's behalf.
  - Agreed actions appear in the employee's development plan as draft activities.
  - With consent off, F18 shows "aspiration not shared".
  - The 6-monthly reminder appears in notifications for overdue pairs.
- **Complexity:** M. **Depends on:** F05, F06.
- **Why ENEC:** ENEC's leadership academy and HiPo coaching depend on good line-manager development conversations [S22]. Eightfold and LinkedIn put the employee's stated aspiration at the centre of matching [S15][S18].

#### F13 · Mentoring 2.0: skills-based matching, agreements, knowledge-transfer mentoring (`/my/mentoring` extended)
- **Wave/owner:** W2 · E3 · **existing `src/modules/m04`** (`MyMentoringPage.tsx` plus new `MentoringProgrammePage.tsx`; schema block M04 mentors and mentoring_requests).
- **For:** mentees, mentors (including senior experts and KHNP-paired staff), and the training manager (programme owner).
- **Problem:** today's mentoring is a list of 5 opt-in offers with request and accept. There is no matching on skills or goals, no agreement, no session log, no outcome, and no **knowledge-transfer** type.
- **What it does:**
  - Mentoring types: career, technical knowledge transfer, leadership, reverse (digital/AI), peer onboarding.
  - Matching is ranked by F02, with reasons: mentor skills ≥ mentee gap, target-role alignment, capacity, and different line (avoids own manager).
  - **Mentoring agreement:** goals tied to skills, cadence and duration.
  - **Session log:** date, topics and skills touched; private notes stay private.
  - **Close-out:** both parties rate goal attainment. A knowledge-transfer close-out can raise a mentee claim to "validated" if the mentor is the manager-nominated SME.
  - **Programme dashboard** for the training manager: active pairs by type, completion and attainment (≥10 suppression).
- **Data:**
  - New columns on `mentors` (types[], skill_ids[], sme bool).
  - New `kafaa_mentoring_agreements` (request_id, goals json, cadence, ends_on, status)
  - New `kafaa_mentoring_sessions` (agreement_id, held_on, skill_ids[], note_shared, note_private_owner)
  - RPCs `proposeAgreement`, `logSession`, `closeAgreement`.
- **RBAC:** Mentee and mentor Own. Training manager Agg. Private notes are readable only by their author (RLS).
- **Acceptance:**
  - A mentee is never matched to their own line manager.
  - Private session notes are unreadable by the counterpart, managers and admins (RLS test).
  - A knowledge-transfer close-out by a non-SME mentor cannot validate skills.
  - Existing M04 mentoring tests stay green.
- **Complexity:** M. **Depends on:** F01, F02.
- **Why ENEC:**
  - IAEA-TECDOC-1999 sets out mentoring and coaching as the main channel for transferring tacit knowledge across generations [S2].
  - ENEC runs a leadership mentoring programme that pairs senior leaders with emerging talent [S22].
  - Pairing successors with KHNP operators before 2030 is the most time-critical use [S21].

#### F14 · Knowledge refreshers: spaced practice without gamification (`/my/coach/refresh`)
- **Wave/owner:** W2 · E3 · `m19`.
- **For:** employees and licensed operators between continuing-training cycles.
- **Problem:** knowledge decays between COCT/LOCT cycles and annual requalification. Practice quizzes exist but are one-off.
- **What it does:**
  - A 5-question refresher every day or week from the **practice bank only** (`items.bank = 'practice'`, approved).
  - Selection uses a Leitner-box spaced-repetition schedule per item per person.
  - Topics are weighted to my role's competencies and upcoming requalification.
  - Immediate explanation with a reference link.
  - **Private** progress: competency confidence bars only. No streaks, points or rankings, per spec commitment 5.
  - Instructor view: aggregate item difficulty from refreshers (≥10), feeding item analysis.
- **Data:**
  - `kafaa_refresh_state` (person_id, item_id, box 1-5, due_on, last_result)
  - RPCs `nextRefresher` (server picks; answers checked server-side, so keys never reach the client) and `submitRefresher`.
- **RBAC:** Own; instructors Agg.
- **Acceptance:**
  - Only `practice` items are ever served (SQL check and unit test).
  - A correct answer moves an item up one box and a wrong one back to box 1, with due dates per schedule.
  - Answer keys never appear in a client payload before submission.
  - The UI has no streak, points or leaderboard elements.
- **Complexity:** S. **Depends on:** F07 (shell page); M05 practice bank.
- **Why ENEC:** FANR-REG-16 Art. 9 requires continuing training and periodic confirmation of competence [S24]. Spaced refreshers are a cheap complement to COCT (6 weeks per crew per year [S23]).

#### F15 · Rotations and job shadowing programme (`/opportunities/rotations`)
- **Wave/owner:** W2 · E4 · `m20`.
- **For:** graduates (GDP), high potentials, cross-functional movers, and HR programme owners.
- **Problem:** structured rotations (for example GDP's 18 to 36 months of position-targeted development [S23]) are run offline. There is no template with learning objectives, host sign-off or evidence capture.
- **What it does:**
  - **Rotation templates:** sequence of placements (family, duration, learning objectives tied to skills, host role card).
  - **Cohort enrolment** (GDP, GPO and DNT cohorts, all synthetic).
  - **Placement plan per person**, a mid-point check-in, and host sign-off of objectives, which writes `ojt` evidence.
  - **Shadowing requests:** 1 to 5 days, with consent of host and line manager.
  - **Programme board** for HR: cohort progress (≥10 suppression), objectives met.
  - Rotations through protected areas show only "site induction required"; no access detail.
- **Data:**
  - `kafaa_rotation_templates`, `kafaa_rotation_placements` (person_id, template_id, seq, host_team, starts_on, ends_on, objectives json, status), `kafaa_shadow_requests`
  - RPCs `enrolRotation`, `signoffPlacement`, `requestShadow`, `decideShadow`.
- **RBAC:** Own. Host manager A for sign-off. HR W for templates and Agg for the board.
- **Acceptance:**
  - Host sign-off writes evidence and updates the passport.
  - A placement cannot be signed off by the rotating person or their own line manager when that manager is also host (`maker_checker`).
  - Cohort tiles are suppressed below 10.
  - The GDP template seeds with sourced duration (18 to 36 months).
- **Complexity:** M. **Depends on:** F08.
- **Why ENEC:** ENEC's GDP and GPO programmes are rotation-based [S23][S21b]. IBF's Jobs Transformation Map and redeployment show how a structured template plus objectives makes moves deliberate [S12].

#### F16 · Leadership journeys: Enterprise Nuclear Leadership Academy pathway (`/leadership`)
- **Wave/owner:** W2 · E5 · `src/modules/m22` (new).
- **For:** aspiring and current leaders, leadership development team, HR.
- **Problem:** ENEC's leadership programmes are listed in reports but are not visible as a **pathway** with eligibility, sequence and behaviours, and leadership readiness is not linked to the career map.
- **What it does:**
  - **Leadership ladder:** individual contributor → first-line leader → manager → director → executive. Each step lists its programmes with published facts and sources:
    - INTILAQA: 4-day mandatory first-line course (ROs and SROs take Leading Effective Teams)
    - ESTADAD: 8 days for high potentials
    - FAS and CLD
    - ONE: 3 weeks
    - executive master classes
    - INPO courses in Atlanta
    - executive coaching
  - **"My leadership readiness":** leadership competencies from the framework, with a self check-in (F10 mechanics) and nomination status. Nomination is a manager action.
  - **Leadership behaviours 360** (deterministic aggregation, ≥5 raters, anonymous).
  - Links to the safety-culture traits (M08, INPO 12-012).
- **Data:**
  - `kafaa_leadership_programmes` (seeded from CNS facts with sources)
  - `kafaa_leadership_nominations` (person_id, programme_id, nominated_by, status)
  - `kafaa_leadership_360` (cycle, subject, rater_kind, scores json)
  - RPCs `nominateLeader` and `decideNomination` (maker-checker).
- **RBAC:** Own; manager W (nominate); HR A; 360 results Own only, and aggregates ≥10 for HR.
- **Acceptance:**
  - Every programme fact (duration, 2024 completions) links to the CNS report with an as-of date.
  - 360 results appear only when there are at least 5 raters; otherwise "not enough responses".
  - A nominee cannot nominate themselves.
  - Shift-supervisor-track people see INTILAQA/LET as required.
- **Complexity:** M. **Depends on:** F10 (rating mechanics).
- **Why ENEC:** 2024 completions were INTILAQA 285, ESTADAD 62, ONE 52 and INPO courses 19 [S22]. Making the academy navigable is a direct employee-facing win.

#### F17 · Communities of practice and expert finder (`/communities`)
- **Wave/owner:** W2 · E5 · `m22`.
- **For:** all staff; SMEs.
- **Problem:** staff cannot find "who knows X" except by asking around. Knowledge-sharing sessions (proficiency, outage lessons, AI, MCR overview [S22]) are not discoverable or reusable.
- **What it does:**
  - **Communities** by discipline and theme (Ops, Maintenance, Chemistry, RP, Engineering, Digital and AI, Human Performance), each with charter, steward role card, events, and Q&A threads (moderated).
  - **Expert finder:** search by skill. It returns synthetic people with level ≥3 who **opted in** to be findable (role, team, verified skills; no contact details beyond an in-app request).
  - **Knowledge-sharing session catalogue** with recordings as links (synthetic) and BM25 search over titles and summaries.
  - Posting rules: no security, safeguards or plant-security content. A blocker regex (re-use G5 refusal patterns) refuses a post and shows guidance.
- **Data:**
  - `kafaa_communities`, `kafaa_community_members`, `kafaa_threads`, `kafaa_posts` (moderation status), `kafaa_expert_optin` (person_id, skill_ids[], visible bool), `kafaa_ks_sessions`
  - RPCs `postThread` and `moderatePost`.
- **RBAC:** staff R and W in joined communities; stewards A (moderate); admins and auditors R.
- **Acceptance:**
  - People who did not opt in never appear in the expert finder (RLS test).
  - A post matching the security refusal patterns is refused with guidance, and the audit row stores the category, not the text.
  - Search returns sessions by keyword in EN and AR.
  - No email or phone appears in any payload.
- **Complexity:** M. **Depends on:** F01.
- **Why ENEC:** ENEC's knowledge management programme is ISO 30401:2018-certified and runs knowledge-sharing sessions [S22]. Communities and expert finding are standard KM tools in IAEA practice [S1][S2].

---

### Wave 3: talent continuity and governance

#### F18 · Talent review: evidence-based performance and potential calibration (`/talent/review`)
- **Wave/owner:** W3 · E1 · `src/modules/m23` (new).
- **For:** line managers, HR business partners, HR director (CHCO office).
- **Problem:** ENEC already identifies high potentials through a 9-box review [S22]. Today this happens outside Kafa'a, with no link to skills evidence, aspirations or readiness. 9-box "potential" is also notoriously opinion-based [S26].
- **What it does:**
  - **Review cycles** per organisation unit.
  - Managers place their people on a 3×3 grid (performance from a synthetic field; potential from three behavioural anchors). The **evidence panel** shows skills breadth and growth (F01), validated check-ins, opportunities completed, learning agility (gaps closed per year), and aspiration if shared (F12).
  - **Calibration session:** HR facilitator view across managers with distribution and outlier flags (deterministic: placement vs. evidence index mismatch).
  - Decisions are locked by the HR director (maker-checker).
  - Outputs: HiPo pool (feeds ESTADAD nominations, F16), development actions.
  - Employees **do not** see their box. They see "development priorities agreed".
- **Data:**
  - `kafaa_review_cycles`
  - `kafaa_review_placements` (cycle_id, person_id, perf 1-3, potential 1-3, evidence_snapshot json, placed_by, calibrated bool, note)
  - RPCs `placeTalent`, `calibrateCycle`, `lockCycle`.
  - All rows are confidential (`talent_review`). Synthetic only.
- **RBAC:** `talent_review` Scope (manager, own team), A (hr_director lock), R (HR BP in scope). Auditor sees the audit only, not placements. Employees have no access.
- **Acceptance:**
  - A manager cannot read placements outside their scope, and an employee cannot read their own placement (RLS tests).
  - A locked cycle refuses changes (`cycle_locked`); every change is audited.
  - Outlier flags appear when placement potential is 3 but the evidence index is in the bottom third.
  - Aggregate exports suppress cells under 10, including women and Emirati splits.
- **Complexity:** L. **Depends on:** F01, F10, F12.
- **Why ENEC:**
  - ENEC's coaching for HiPo individual contributors is driven by the 9-box review [S22].
  - Evidence panels address the known weakness of opinion-based potential ratings [S26].
  - Readiness must be assessed separately from grid placement [S26], which is F19.

#### F19 · Succession planning for critical roles (`/talent/succession`)
- **Wave/owner:** W3 · E1 · `m23`.
- **For:** HR director, executives, HR analysts (aggregates).
- **Problem:** M07 shows bench **counts** per critical role, but no person-level slate, readiness horizon or development gap. Without them, bench numbers cannot be acted on.
- **What it does:**
  - For each critical role (the 16 `critical_roles` plus leadership roles), a **succession slate**: incumbent role card (synthetic), successors with readiness *ready now / 1 to 2 years / 3 to 5 years*, plus emergency cover.
  - Readiness is computed from F05 (skills and gates) and confirmed by HR.
  - **Gap actions** per successor: training, rotation, mentoring.
  - **Bench strength** rolls up into `critical_roles` counts automatically. This replaces manual entry and keeps M07 unchanged by writing through `setBenchTarget`-style RPC agreement.
  - **Risk flags:** no ready-now successor; one successor on several slates; a slate dependent on KHNP or contractor cover.
  - Emirati and women successor share is shown as aggregates only (≥10).
- **Data:**
  - `kafaa_succession_slates` (role_id, period, status)
  - `kafaa_successors` (slate_id, person_id, readiness, emergency bool, gaps json, confirmed_by)
  - RPCs `proposeSuccessor` and `confirmSlate`, plus `rollupBench`. The roll-up is a contract request to G3 for M07 `critical_roles` writes.
- **RBAC:** `talent_review` A (HR director), R (HR BP); executives R for their own function; HR analyst Agg.
- **Acceptance:**
  - A person cannot appear as ready-now if any hard gate of the role (licence route, qualification) is not met.
  - The roll-up updates `critical_roles.qualified/in_training/pipeline` counts for the period, with an audit and ledger row.
  - The flags "no ready-now" and "successor on more than 2 slates" display.
  - Observer and partner personas get 403 on the route.
- **Complexity:** L. **Depends on:** F05, F18.
- **Why ENEC:** the IAEA lists succession planning as a key HRM component so that turnover is anticipated [S5]. ENEC's bench for SRO/RO, shift supervisors and engineering leads must be visible before the KHNP support ends in 2030 [S21].

#### F20 · Knowledge Loss Risk Assessment (KLRA) (`/knowledge/klra`)
- **Wave/owner:** W3 · E2 · `src/modules/m24` (new).
- **For:** knowledge management owner (training_manager or HR in the demo), department heads.
- **Problem:** ENEC's ISO 30401 KM programme and FANR's KLRA practice exist [S22], but nothing shows **where critical knowledge is about to walk out**: retirements, contract ends, KHNP OSSA roles, single experts.
- **What it does:**
  - Per position (synthetic people), two factors on 1 to 5 scales:
    - an **attrition risk factor**: retirement window from the synthetic age band, contract or secondment end, OSSA cover until 2030
    - a **position or knowledge risk factor**: criticality from `critical_roles`, uniqueness from F11 single points of failure, codification (documented in qualification standards or OE vs. tacit), and difficulty to replace
  - **Total = attrition × position**, following the IAEA KLRM approach of weighing attrition, position importance and how transferable and codified the knowledge is [S1]. Thresholds are configurable, with high ≥ 16 by default.
  - Heatmap by department (≥10 suppression for aggregates).
  - Drill-down for the KM owner: positions with risk band and reasons.
  - **Mitigation plan** per high-risk position: capture (F21), mentoring (F13), successor (F19), documentation, cross-training (F15), with owner and due date.
  - Quarterly re-assessment.
- **Data:**
  - `kafaa_klra_assessments` (id, period, position_ref, person_id?, attrition_factor, position_factor, total, reasons json, assessed_by)
  - `kafaa_klra_actions` (assessment_id, kind, owner_role, due_on, status)
  - RPCs `assessPosition`, `planMitigation`, `closeAction`.
- **RBAC:** `knowledge` A (KM owner), Scope (department head), HR Agg. Never public. No retirement dates shown, only bands.
- **Acceptance:**
  - Totals equal attrition × position for every row (unit test), and the threshold is configurable by the KM owner and audited.
  - No birth date or age appears in any payload, only a band ("within 2 years / 2 to 5 / 5+").
  - Every high-risk row has at least one mitigation action before the quarter closes, or shows "overdue".
  - The department heatmap suppresses cells below 10.
- **Complexity:** M. **Depends on:** F11; F13, F19, F21 for mitigation links (links degrade gracefully).
- **Why ENEC:**
  - IAEA NG-T-6.11 KLRM [S1] and FANR's KLRA [S22] are the recognised practice.
  - About 20% of ENEC's 2024 workforce was aged 51 or over (594 of 2,979) [S23, chart reading uncertain].
  - About 400 KHNP experts a year support operations until 2030 [S21].

#### F21 · Knowledge capture studio for departing and visiting experts (`/knowledge/capture`, `/knowledge`)
- **Wave/owner:** W3 · E2 · `m24`.
- **For:** SMEs (retiring, rotating out, KHNP or partner experts), interviewers, KM owner, all staff (consume).
- **Problem:** tacit know-how ("why we do it this way", outage tricks, system quirks) leaves with experts. Capture today is ad hoc and not searchable.
- **What it does:**
  - **Structured capture interviews** from templates: critical decisions, rules of thumb, war stories, who-to-ask, documents I rely on. Each is tied to skills and qualification standards.
  - Interview session workflow: plan → hold → transcribe. Upload a transcript text; there is no audio processing in the demo.
  - **Deterministic enrichment:** keyword extraction (TF-IDF and RAKE) suggests skill tags and related OE lessons and courses via BM25, and the reviewer accepts or rejects each.
  - **Two-person review:** a technical reviewer plus a security and content check that reuses the OE de-identification and no-security checks.
  - Publish as a **knowledge asset** with summary, key points and links.
  - **Knowledge base:** BM25 search across assets, OE and courses, with filters by skill and system family, and "used by N" counts (≥10 to show).
  - Assets can be attached to qualification standards as "read before requal".
- **Data:**
  - `kafaa_sme_profiles` (person_id, skill_ids[], availability, departing_band)
  - `kafaa_capture_sessions`
  - `kafaa_knowledge_assets` (id, title_en/ar, summary_en/ar, body, skill_ids[], status draft|review|published|withdrawn, reviewers[], source_session_id)
  - `kafaa_asset_reviews`
  - RPCs `planCapture`, `submitAsset`, `reviewAsset`, `publishAsset`.
- **RBAC:** `knowledge` W (SME, interviewer), A (KM owner and a second reviewer; maker-checker), R (staff). Public none.
- **Acceptance:**
  - An asset cannot publish without two reviews by people other than the author, including a security check pass.
  - Text that matches security refusal patterns blocks submission and shows guidance.
  - Search for a seeded topic returns the asset and the related OE lesson, with citations.
  - Withdrawn assets disappear from search within one refresh.
- **Complexity:** L. **Depends on:** F02 (search), F20 (who to capture).
- **Why ENEC:**
  - Structured interviews and IAEA/WANO retiree capture (Krško) [S6], and recorded deep-dives with searchable transcripts (Sandia) [S6b], are proven methods.
  - ENEC's KM programme is certified to ISO 30401 [S22].
  - The KHNP handover gives a once-only capture window [S21].

#### F22 · Handover 2030 readiness board (`/workforce/handover`)
- **Wave/owner:** W3 · E3 · **existing `src/modules/m07`** (new route in its `routes.ts`; G3 module).
- **For:** HR director, operations leadership, HR analysts.
- **Problem:** the OSSA brings about 400 KHNP experts a year until 2030 [S21]. Leadership needs one view of which functions depend on that support and how fast Emirati and ENEC successors become ready. This is also central to the "quality of Emiratisation" agenda [S20].
- **What it does:**
  - By function and role family, **counts only**: positions with external or partner cover (synthetic), ENEC successors by readiness band (from F19 and F05), pipeline in training (COIT, LOIT, GPO, DNT cohorts from M04 and M07), and the projected ready-date distribution (SIMULATED from F06 roadmap logic).
  - A **burn-down chart** to 2030 of cover vs. ready successors.
  - Risk list of functions where ready successors fall short of cover in any year.
  - Emirati share of ready successors (≥10).
  - Links to the KLRA (F20) and capture (F21) plans.
  - Exportable observer-safe version through the existing observer release workflow.
- **Data:**
  - `kafaa_external_cover` (role_id, function, period, cover_count, source sample)
  - RPC `handoverAggregate(period)`, a suppressed aggregate like `workforceAggregate`.
- **RBAC:** `workforce_analytics` Agg (HR), A (HR director release); observers only via approved release.
- **Acceptance:**
  - All cells below 10 show "suppressed".
  - Every number carries SAMPLE or SIMULATED with a definition link (`/workforce/definitions`).
  - The burn-down recomputes when F19 readiness changes.
  - No person-level row reaches the client.
- **Complexity:** M. **Depends on:** F06, F19.
- **Why ENEC:**
  - The OSSA end date [S21].
  - The 2025 SRO/RO workforce of 190 includes 70+ Emirati (spec §2).
  - Nafis 2026 shifts the national focus toward quality and impact [S20].

#### F23 · Alumni and expert reserve (`/opportunities/reserve`)
- **Wave/owner:** W3 · E4 · `m20`.
- **For:** HR, KM owner, retired or departed experts (synthetic external persona kind `alumni`), managers needing short SME help.
- **Problem:** when experts retire or partner secondments end, the link is lost. Short advisory, mentoring or capture engagements require a full re-hire.
- **What it does:**
  - **Opt-in alumni registry:** skills (frozen at departure from F01), availability and preferred engagement (mentor, capture interview, instructor, reviewer).
  - Managers post **reserve requests** that reuse the F08 opportunity engine, visible to alumni only.
  - Engagement record with HR approval.
  - **Alumni stories:** consented, synthetic, labelled.
  - No contract, payment or personal data; just a "handed to HR" status.
- **Data:**
  - `kafaa_alumni` (person_id, departed_band, skill_snapshot json, availability, consent_on)
  - `kafaa_reserve_engagements`
  - RPCs `joinReserve` (a consent RPC with withdrawal) and `requestReserve`.
- **RBAC:** alumni Own. HR A. Managers W (request). Staff R only when an alumnus has opted into the expert finder (F17).
- **Acceptance:**
  - Withdrawing consent hides the alumnus everywhere within one refresh and schedules deletion (+6 months, as in M06).
  - A request needs HR approval before an alumnus sees the poster's team.
  - No contact data is stored.
  - The new person kind `alumni` passes `check:public`.
- **Complexity:** S. **Depends on:** F08, F01.
- **Why ENEC:** retired-expert reserves are a standard knowledge-loss mitigation in IAEA KLRM [S1]. ENEC's 51+ cohort [S23] makes this relevant within 5 to 10 years.

#### F24 · Recommendation transparency, opt-out and fairness monitor (`/admin/ai-transparency`, `/my/settings` card)
- **Wave/owner:** W3 · E5 · **existing `src/modules/m16`** (new route; one card added through M14's settings extension point).
- **For:** employees (control), admin and AI governance (`ai-governance` persona), auditors.
- **Problem:** Waves 1 to 3 introduce ranking and readiness scores. Without transparency, opt-out and fairness checks they create HR-ethics and data-protection risk. The governance story is also a big part of what makes NEXUS demos land.
- **What it does:**
  - **Model and engine cards** for each surface (Navigator, Coach, Marketplace, Talent review evidence): inputs used, inputs never used (gender, nationality, age are **excluded** from every scoring function; tested), weights, last change, owner.
  - **Employee controls:** opt out of recommendations per surface, download "what Kafa'a infers about me" (JSON), and request a correction (reuses `data_requests`).
  - **Fairness monitor:** compares outcome rates (suggested-ready, selected for opportunity, HiPo pool) across gender and nationality groups, with ≥10 suppression and a four-fifths-rule flag. Weekly snapshot.
  - **Change log** of weight changes from F02 settings, audited and ledgered.
- **Data:**
  - `kafaa_engine_cards`
  - `kafaa_reco_optouts` (person_id, surface)
  - `kafaa_fairness_snapshots` (period, surface, metric, group, rate, n, suppressed)
  - RPCs `setRecoOptout` and `runFairnessSnapshot`.
- **RBAC:** Own (opt-out, export). Admin and ai-governance A. Auditor R. HR Agg.
- **Acceptance:**
  - A unit test proves no scoring function reads `gender`, `nationality_flag` or `age` fields.
  - Opting out of Coach removes ranked cards; the page shows the unranked catalogue instead.
  - The fairness snapshot suppresses groups below 10 and flags a ratio below 0.8.
  - Every weight change has audit and ledger rows and appears in the change log.
- **Complexity:** M. **Depends on:** F02 and the Wave 1 surfaces.
- **Why ENEC:** ENEC NEXUS is an AI-governance concept (spec §12). The `ai-governance` persona already exists. Gartner and vendors stress skills and AI transparency [S16b]. This keeps Kafa'a's AI claims defensible.

---

### Wave 4: the training system (SAT, effectiveness, records)

#### F25 · Training effectiveness, Kirkpatrick levels 1 to 4 (`/training/effectiveness`)
- **Wave/owner:** W4 · E1 · `src/modules/m25` (new).
- **For:** training managers, instructors, discipline training committees, line managers (L3 input).
- **Problem:** Kafa'a counts completions and hours. ENEC's per-discipline training committees review plant data and OE [S23], but nothing connects a course to reaction, learning gain, on-the-job behaviour and results.
- **What it does:**
  - **Per course or programme:**
    - **L1 reaction:** short post-course form, which reuses `assessment_forms` kind practice for survey use, or a new survey table.
    - **L2 learning:** pre/post scores from M05 attempts, as a gain.
    - **L3 behaviour:** a 60/90-day supervisor observation checklist tied to the course objectives, scheduled automatically.
    - **L4 results:** linked synthetic KPIs (rework rate, HU-event rate, qualification first-time pass) with an "association, not causation" caveat.
  - **Effectiveness scorecard** with suppression.
  - **Committee pack export** (PDF/CSV) per discipline.
  - Courses flagged for redesign feed F27.
- **Data:**
  - `kafaa_eval_surveys`, `kafaa_eval_responses` (anonymous to instructors; person id kept only for scheduling)
  - `kafaa_l3_observations` (person_id, course_id, observer_person_id, due_on, items json, status)
  - `kafaa_course_kpi_links`
  - RPCs `scheduleL3`, `recordL3`, `effectivenessReport`.
- **RBAC:** `learning_analytics` Agg (training manager, committees). Line manager W on L3 for own team. Learners Own (L1).
- **Acceptance:**
  - Instructors never see an individual L1 response (RLS test); course results show only at n ≥ 10.
  - L3 observations are scheduled 90 days after completion for qualifying courses.
  - L2 gain uses only released attempts.
  - The L4 panel always shows the caveat and SAMPLE tags.
- **Complexity:** M. **Depends on:** M04/M05 data.
- **Why ENEC:**
  - The IAEA Safeguards Training Section uses Kirkpatrick for course effectiveness [S8], and WINS too [S8b].
  - The evaluation phase of SAT [S3] and FANR-REG-16's performance-based training [S24] call for it.
  - ENEC delivered 581,090 hours in 2024 [S23].

#### F26 · Training needs analysis and demand forecast (`/training/needs`)
- **Wave/owner:** W4 · E1 · `m25`.
- **For:** training managers, HR, scheduling.
- **Problem:** session capacity is planned from history, not from the actual gaps, expiries, roadmaps and future interest now available in Kafa'a.
- **What it does:**
  - **Aggregates demand per course per quarter** from:
    - mandatory curriculum (M04)
    - qualification expiries (M02)
    - F06 roadmap blocks
    - F07 accepted recommendations
    - F09 future interest
    - F20 mitigation actions
  - Compares demand with **capacity**: scheduled sessions × seats, instructors (F31) and simulator slots.
  - Shortfall flags and a "propose sessions" draft list for the scheduler. Sessions are created through the existing M04 path.
  - Scenario toggle (SIMULATED) for intake changes (DNT, GPO cohorts).
- **Data:**
  - `kafaa_demand_snapshots` (period, course_id, source, count, suppressed)
  - RPCs `computeDemand(period)` and `proposeSessions` (drafts only).
- **RBAC:** `learning_analytics` Agg; training_manager A (propose).
- **Acceptance:**
  - Each demand number decomposes into its sources (drill-down sums match).
  - Cells below 10 are suppressed in exports but used in totals.
  - Proposed sessions appear as drafts in `/training/schedule` and are not published.
  - Changing a roadmap in F06 changes next quarter's demand after recompute.
- **Complexity:** M. **Depends on:** F06, F07, F09; F20 and F31 optional.
- **Why ENEC:** simulator and instructor capacity is finite (full-scope simulators, COCT 6 weeks per crew per year [S23][S28]). Demand-led planning is SkillsFuture and IBF practice at sector level [S11][S12].

#### F27 · SAT analysis workbench: job and task analysis to training matrix (`/training/sat`)
- **Wave/owner:** W4 · E2 · `src/modules/m26` (new).
- **For:** training developers, training managers, curriculum review committee.
- **Problem:** qualification standards and courses exist, but the **analysis** behind them (task list, difficulty, importance and frequency ratings, train/no-train decisions, objective coverage) is invisible. SAT changes are hard to trace.
- **What it does:**
  - **Job analysis per role:** a task inventory, seeded from `task_items` plus generic synthetic tasks.
  - **DIF survey** (difficulty, importance, frequency on 1 to 5 from SMEs) with deterministic train/no-train/overtrain decision rules.
  - **Task-to-training matrix:** task → learning objectives → courses, modules and JPMs, with **coverage gaps** (task selected for training with no objective) and **orphan objectives**.
  - **Change impact:** when a task changes, list the affected courses, items (metadata only) and qualification standards, and open a review (re-uses `reviseStandard` for standards).
  - **Traceability report** export.
  - Security tasks show as "restricted – managed outside Kafa'a".
- **Data:**
  - `kafaa_jta_tasks` (role_id, code, title_en/ar, source, restricted bool)
  - `kafaa_dif_ratings` (task_id, rater_person_id, d, i, f)
  - `kafaa_task_objectives` (task_id, objective_ref, course_id?, jpm_id?)
  - `kafaa_sat_changes`
  - RPCs `rateDif`, `decideTraining`, `linkObjective`, `openSatChange`.
- **RBAC:** `sat` W (instructors, developers), A (training_manager for train decisions), R (auditor).
- **Acceptance:**
  - The decision rule maps any (D, I, F) triple to exactly one outcome (exhaustive unit test).
  - The matrix highlights every train-selected task without an objective.
  - A task change lists all linked courses and standards and creates one review item each.
  - Restricted tasks never expose titles beyond "restricted".
- **Complexity:** L. **Depends on:** M02/M04/M05 data.
- **Why ENEC:**
  - ENEC adopted INPO's SAT, and FANR requires it [S22][S24].
  - IAEA NG-T-2.8 describes the full SAT process [S3].
  - JQCs at Barakah are derived from job and task analysis [S22 Art. 11.2(c)].

#### F28 · Simulator scenario library and coverage (training scenarios only) (`/training/simulator/scenarios`)
- **Wave/owner:** W4 · E3 · **existing `src/modules/m04`** (`TrainingSimulatorPage.tsx` gains a tab plus new `TrainingScenariosPage.tsx`).
- **For:** simulator instructors, operations training, crews (debrief view).
- **Problem:** simulator time is booked in Kafa'a, but there is no catalogue of **training** scenarios, no coverage of objectives and competencies across the COCT cycle, and no structured crew debrief.
- **What it does:**
  - **Scenario catalogue (metadata only):**
    - generic category (normal evolution, abnormal, emergency, severe accident)
    - training objectives, competencies, crew positions, duration, simulator fidelity requirement
    - last run, revision status
  - **No exam scenarios.** `purpose = exam` cannot be created, and malfunction specifics are free text kept generic by a content check.
  - **Cycle planner:** pick scenarios for a COCT/LOCT cycle; a coverage matrix shows objectives and competencies hit vs. required across the 2-year cycle.
  - **Crew debrief form:** team competencies (communication, procedure use, diagnosis, leadership) rated by the instructor, plus crew self-critique. Feeds F01 evidence at crew-member level as `evidenced`, never `verified`.
  - xAPI statements are emitted to F30 when available.
- **Data:**
  - `kafaa_sim_scenarios` (id, title_en/ar, category, objectives json, competency_ids[], positions[], duration_min, status, purpose training only)
  - `kafaa_sim_cycles`
  - `kafaa_crew_debriefs`
  - RPCs `saveScenario` (instructor), `planCycle`, `recordDebrief`.
- **RBAC:** instructors W; training_manager A; crews Own on their own debrief; managers Scope.
- **Acceptance:**
  - Creating a scenario with `purpose = exam` is refused (`exam_content`).
  - The coverage matrix flags required objectives not covered in the cycle.
  - A debrief writes evidence only for crew members present in the booked slot.
  - The page exposes no plant security or exam content (content check plus test).
- **Complexity:** M. **Depends on:** M04 simulator slots; F30 optional.
- **Why ENEC:**
  - Barakah trains on full-scope APR-1400 simulators (ANSI/ANS-3.5-2018) with combined LOCT/COCT scenarios [S23][S28].
  - IAEA-TECDOC-1963 covers simulator use for training and authorisation [S4].

#### F29 · Accreditation-readiness self-evaluation (`/training/accreditation`)
- **Wave/owner:** W4 · E2 · `m26`.
- **For:** training managers, training quality, auditors.
- **Problem:** WANO and FANR evaluate training externally [S23], and INPO-style accreditation uses objectives-and-criteria self-evaluation reports [S7]. Preparing the evidence is manual.
- **What it does:**
  - **Criteria library:** synthetic, paraphrased, generic SAT-based objectives grouped as
    - Training for performance improvement
    - Training environment and resources
    - Training process (analysis, design, development, implementation, evaluation)
    - Qualified instructors
    - Trainee examinations
  - No copyrighted ACAD text.
  - Per programme: a self-rating per criterion with **evidence links auto-suggested** from Kafa'a: F27 traceability, F25 effectiveness, M05 item analysis, F31 instructor qualifications, M02 sign-off timeliness.
  - Gap list with owners.
  - **Self-evaluation report** generator (EN/AR PDF).
  - Readiness trend per programme.
- **Data:**
  - `kafaa_accr_criteria`
  - `kafaa_accr_assessments` (programme_id, criterion_id, rating, evidence json, owner_role, due_on)
  - RPCs `rateCriterion` and `finaliseSelfEval` (maker-checker).
- **RBAC:** `sat` W (training staff), A (training_manager finalise), R (auditor).
- **Acceptance:**
  - Each criterion shows at least one auto-suggested evidence link when data exists, or "no evidence found".
  - A self-evaluation cannot be finalised by its sole author.
  - Exported reports carry "demo / not an accreditation decision".
  - The criteria text contains no verbatim INPO or ACAD copy; it is generic and sourced to public IAEA SAT.
- **Complexity:** M. **Depends on:** F25, F27; F31 optional.
- **Why ENEC:** ENEC Operations accesses INPO services through WANO-AC [S22], and its programmes are externally evaluated [S23]. Accreditation processes rest on self-evaluation against objectives and criteria [S7].

#### F30 · Learning record store: xAPI statements (`/training/lrs`)
- **Wave/owner:** W4 · E4 · `src/modules/m27` (new).
- **For:** training technologists, instructors, analytics (F25, F26), auditors.
- **Problem:** courses declare `packaging: scorm|xapi|none`, but nothing captures experience data from e-learning, simulator sessions, OJT or refreshers in a standard way.
- **What it does:**
  - **Minimal xAPI 2.0-shaped statement store:** actor (Kafa'a person id, mbox omitted), verb, object (course, module, scenario, task), result, context, timestamp.
  - Stored through an RPC that validates the statement against a JSON schema; there is no public endpoint in the demo.
  - **Emitters inside Kafa'a:** course completion (M04), refresher answer (F14), simulator debrief (F28), OJT log (F38), opportunity completion (F08).
  - **Statement explorer:** filters by actor in scope, verb or object; timeline per person.
  - **Profile export** (JSON lines) for a person (own data right).
  - **Adapters page** describing how an external LRS would connect, as a SIMULATED integration card in `/admin/integrations`.
- **Data:**
  - `kafaa_xapi_statements` (id uuid, actor_person_id, verb, object_type, object_id, result json, context json, stored_at; append-only)
  - RPC `storeStatement` (internal callers and admin test console) and `queryStatements`.
- **RBAC:** `lrs` Own (my statements), Scope (instructors and managers), Agg (analytics), W (system, via RPC only), auditor R.
- **Acceptance:**
  - Invalid statements are refused with a schema error, and statements are immutable (append-only trigger).
  - Completing a course in M04 emits exactly one `completed` statement.
  - A manager cannot query statements of people outside scope.
  - No secure item id or text appears in any statement (unit test over emitters).
- **Complexity:** M. **Depends on:** F01; emitters added progressively.
- **Why ENEC:** xAPI (IEEE 9274.1.1-2023) is designed to track simulations and on-the-job experiences, not only e-learning [S9]. ENEC's training mixes classroom, OJT, simulators and 76,079 e-learning completions a year [S23].

#### F31 · Internal instructor and SME qualification pipeline (`/training/instructors`)
- **Wave/owner:** W4 · E5 · **existing `src/modules/m02`** (new route; `evaluator_quals` already lives in M02).
- **For:** SMEs who teach, instructors, training managers.
- **Problem:** FANR-REG-16 requires qualified instructors [S24]. FANR itself certifies 65 SMEs as internal trainers [S22]. Kafa'a holds evaluator qualifications as read-only rows, with no pipeline from "SME volunteers" to "qualified instructor with currency".
- **What it does:**
  - **Instructor track:** stages are SME nomination → instructor initial training (synthetic course in the catalogue) → co-teach observations (2) → solo observed delivery → qualified → annual currency (minimum teaching hours, continuing development).
  - **Observation forms** use F25 L3 mechanics.
  - **Instructor pool board:** currency status and expiring currency, using the 90/60/30 notices from `qualView`.
  - **Teaching hours log** (fed by session attendance in M04).
  - Links to the ASIP (Accelerated SRO Instructor Program) as a sourced programme fact.
- **Data:**
  - `kafaa_instructor_tracks` (person_id, stage, started_on, status)
  - `kafaa_instructor_observations`
  - `kafaa_teaching_hours`
  - RPCs `nominateInstructor`, `recordObservation`, `qualifyInstructor` (maker-checker, training_manager). This writes or extends `evaluator_quals` through a G1-owned RPC (contract request).
- **RBAC:** Own; training_manager A; instructors W for observations; auditor R.
- **Acceptance:**
  - Qualification requires two co-teach and one solo observation by different observers.
  - Currency lapses when hours fall below the minimum for 12 months, and a notice is sent at 30 days.
  - An observer cannot observe themselves.
  - The ASIP fact links to its source.
- **Complexity:** M. **Depends on:** F25 (observation form).
- **Why ENEC:** FANR-REG-16 Art. 9 [S24]; ENEC's instructor initial and continuing qualification and ASIP [S23]; FANR's 65 certified SME trainers [S22].

---

### Wave 5: ecosystem and reach

#### F32 · Stackable micro-credentials (`/my/skills/credentials`, `/admin/frameworks` tab)
- **Wave/owner:** W5 · E1 · `m17`.
- **For:** employees, contractors (via F33), students (via F34), training managers.
- **Problem:** learning that does not lead to a formal qualification (data analytics, project management, AI literacy, HU tools mastery) has no recognised, stackable recognition.
- **What it does:**
  - **Micro-credential definitions:** criteria = set of courses, assessments, opportunities and validated skills, with a validity period. Definitions **stack** into larger credentials, e.g. "Digital Plant Foundations" = 3 micro-credentials.
  - The auto-eligibility check runs over F01 evidence. Issuance happens via F04 (Open Badges 3.0), and expiry and renewal follow.
  - Catalogue page with "what it unlocks" (roles in F05 that list it as useful).
  - Admins manage definitions with versioning, as for qualification standards.
- **Data:**
  - `kafaa_microcred_defs` (id, title_en/ar, criteria json, stacks_into?, validity_months, version, status)
  - `kafaa_microcred_awards`
  - RPCs `checkEligibility` and `awardMicrocred` (auto for eligible; training_manager approval for any manual criterion).
- **RBAC:** Own; training_manager A; frameworks W for definitions.
- **Acceptance:**
  - Eligibility is reproducible from the listed evidence (unit test).
  - Stacked credentials issue only when every component is valid.
  - Micro-credentials never imply FANR certification (copy check).
  - Expired components flag the stacked credential "renewal due".
- **Complexity:** M. **Depends on:** F04.
- **Why ENEC:** Open Badges 3.0 and CLR 2.0 support stacking and skills alignment [S10]. ENEC already runs knowledge-sharing workshops on data analytics, project management and AI [S22].

#### F33 · Contractor and supplier skills passport (`/partner/workforce/passport`)
- **Wave/owner:** W5 · E2 · **existing `src/modules/m09`** (G4 module).
- **For:** partner admins and contractor staff (synthetic `k-contractor`), ENEC evaluators (equivalency).
- **Problem:** contractors must meet identical qualifications or pass equivalency [S22]. Their evidence arrives as documents, case by case, and is not portable between ENEC engagements.
- **What it does:**
  - Extends F03 to contractor personnel, scoped to their organisation (`OwnOrg`).
  - Supplier academy certificates (M09) and equivalency outcomes become evidence.
  - Partner admins see the team matrix against the **target ENEC role profiles** they are contracted for.
  - **Equivalency pre-check:** compares the passport with the role's tasks and shows likely coverage before submitting `submitEquivalency`.
  - Credentials are exportable via F04.
- **Data:**
  - Extends the `kafaa_person_skills` read rules with `org` scope.
  - `kafaa_contract_role_targets` (org_id, role_id, headcount_band).
  - RPC `equivalencyPrecheck` (read-only).
- **RBAC:** partner_user Own; partner_admin OwnOrg; ENEC evaluators `equivalency` R; no cross-org reads.
- **Acceptance:**
  - A partner admin from organisation A cannot see organisation B's passports (RLS test with `alnoor-gm` vs `gulfhydro-qa`).
  - The pre-check never changes the equivalency record.
  - Security standards are excluded, as in `submitEquivalency`.
  - Existing M09 tests stay green.
- **Complexity:** M. **Depends on:** F03, F04.
- **Why ENEC:** more than 2,000 UAE companies hold Barakah contracts (spec §2), and FANR-REG-16 training requirements cover contractors [S24]. Portable verified skills speed up In-Country Value growth.

#### F34 · Student-to-career journey: Mustaqbali to DNT to Local Operator (`/pathways/journey`)
- **Wave/owner:** W5 · E3 · **existing `src/modules/m06`** (G3 module).
- **For:** school students and parents, applicants (Kafa'a-only personas `k-student`, `k-graduate`), university users (consenting scholars only).
- **Problem:** the talent pipeline pages explain programmes, but a student has no continuous journey: interests → STEM experiences → readiness → application → first role, in Arabic first and with parents involved.
- **What it does:**
  - **Interest explorer:** a 10-question, deterministic, non-scoring quiz that maps interests to job families with "roles like this" links to M01.
  - **Personal journey board:** Mustaqbali (2 weeks), Energy Pioneers or DNT (24 months) or GDP, then the first role, each with sourced facts.
  - **Readiness checklist:** education and nationality eligibility from programme cards. It is non-binding and stores nothing unless the student is signed in.
  - **Practice quizzes** (public practice bank).
  - **Parent view** in Arabic first.
  - **Starter portfolio:** a student micro-credential from Mustaqbali (via F32, synthetic).
  - **No ranking of students and no automated rejection** (M06 rules).
- **Data:**
  - `kafaa_student_journeys` (person_id, interests json, milestones json; Own, applicant role)
  - Reuses `talent_programmes` and `applications`.
- **RBAC:** public read for the explorer; applicant Own; HR Agg (≥10); university sees only consenting scholars (existing rule).
- **Acceptance:**
  - A school leaver reaches the DNT step from the journey in two clicks in either language.
  - The quiz stores nothing for anonymous users (network test).
  - Every programme fact on the board has a source and as-of date (DNT 24 months; first cohort of 20 graduated in June 2026 [S29]).
  - No score or rank is shown to the student.
- **Complexity:** M. **Depends on:** F32 (optional badge).
- **Why ENEC:** ENEC's six talent pipeline programmes have brought in more than 2,000 UAE nationals [S29]. The DNT's first cohort graduated on 17 Jun 2026, and the Mawaheb agreement targets at least 100 nationals over 5 years [S29].

#### F35 · Skills supply-and-demand outlook, SIMULATED (`/workforce/skills-outlook`)
- **Wave/owner:** W5 · E4 · **existing `src/modules/m07`** (G3 module; a new route alongside `/workforce/scenarios`).
- **For:** HR director, strategy, workforce planners.
- **Problem:** M07 scenarios project **headcount**. Leadership also needs **skills** supply and demand over 5 to 10 years combining attrition, KHNP handover, ADVANCE adoption, pipeline intakes and the reskilling effect of training.
- **What it does:**
  - **Demand side** per skill and year:
    - role profiles × staffing scenario (existing `scenarios`)
    - plus ADVANCE adoption factor (`adjustDemand` from `domain/future.ts`)
  - **Supply side:**
    - current F01 levels
    - minus attrition and KLRA bands (F20)
    - plus pipeline intakes (M06/M07)
    - plus reskilling conversion rates (SIMULATED, editable)
  - Gap chart by skill family.
  - Sensitivity sliders and a "what changes the gap most" tornado chart.
  - Saved outlooks reuse `saveScenario` with "(SIMULATED)".
- **Data:**
  - `kafaa_skill_outlooks` (id, params json, results json, created_by)
  - RPC `computeOutlook` (aggregate only, suppressed).
- **RBAC:** `workforce_analytics` Agg (HR), A (HR director save and release). Never public. No headcount on public pages (M11 rule).
- **Acceptance:**
  - Every chart and number carries SIMULATED and a definitions link.
  - Outputs are aggregates only; skill families with supply below 10 people are suppressed.
  - Resetting the sliders reproduces the baseline exactly.
  - The page passes the M11 `publicTextIsClean` guard on any text that could be released.
- **Complexity:** L. **Depends on:** F01, F20; M07 scenarios.
- **Why ENEC:**
  - The WEF expects nearly 40% skills change by 2030 [S19].
  - The IAEA HRM guidance covers workforce planning tools such as the NPHR model [S5].
  - ENEC must weigh Barakah operations, the KHNP handover and ADVANCE together [S21].

#### F36 · Personal weekly digest and nudges (shell)
- **Wave/owner:** W5 · E5 · **`src/shell`** (foundation-owned; a one-engineer wave slot with foundation review) plus `m14` settings card.
- **For:** all signed-in staff.
- **Problem:** value is spread across 20+ personal pages. People miss expiring qualifications, new matched opportunities, approval requests and conversation reminders.
- **What it does:**
  - An **in-app weekly digest** (notification centre card plus `/my` panel) of up to 7 items: expiring quals, top coach action, new matched opportunities (≥70% match), pending approvals I owe, mentoring session due, conversation due, refreshers due.
  - Each item has a deep link and "why".
  - Quiet hours and frequency settings.
  - Email is out of scope (demo).
  - Speak-up routes never generate or show nudges.
- **Data:**
  - `kafaa_digest_runs` (person_id, period, items json)
  - RPC `buildDigest(person)`: deterministic, idempotent per period, written to `notifications`.
- **RBAC:** Own; admin Agg (open rates ≥10).
- **Acceptance:**
  - A digest has at most 7 items, sorted by urgency rule (expiry < approvals < others).
  - Running the RPC twice in a period creates one digest.
  - Turning nudges off stops new digests.
  - No nudge appears on `/speak-up`, and the smoke network check stays green.
- **Complexity:** S. **Depends on:** Waves 1 and 2 surfaces.
- **Why ENEC:** LinkedIn reports that coached learners spend more time learning [S18, vendor claim]. More importantly, the spec target "Qualifications renewed before expiry: 100%" depends on timely, aggregated reminders.

#### F37 · Dalil career and learning mode, grounded and governed (`/ask?mode=career`)
- **Wave/owner:** W5 · E5 · **existing `src/modules/m13`**.
- **For:** signed-in staff.
- **Problem:** Dalil answers public and staff questions from the corpus, but cannot answer "what should I do to become an SRO?" or "which opportunity fits me?" using *my* data.
- **What it does:**
  - A new `career` mode.
  - Intents: next roles, gap to role X, courses for skill Y, opportunities for me, roadmap date. Each intent calls the F05, F06, F07 and F08 engines and renders answers with citations: role page, REG-17 article, course, passport evidence.
  - **Role-play practice** (deterministic): scripted career-conversation and interview-practice dialogues from templates, with a rubric checklist. Inspired by LinkedIn's role-play, but rule-based.
  - All existing Dalil guards apply: concern stop, security refusal, kill switch, rate limit.
  - Evaluation cases are added to the Dalil release gate.
- **Data:**
  - New intents in `m13/dalil`.
  - `advisor_turns.mode = 'career'` (enum addition via M13 block).
  - Evaluation cases in `evalset.ts`.
- **RBAC:** signed-in only; reads via the engines (RLS applies); anonymous users get the public mode.
- **Acceptance:**
  - "What do I need for SRO?" as `k-ro` returns the gates and top three gaps, citing REG-17 and passport evidence.
  - The same question anonymously returns the public answer with no personal data.
  - Security questions still decline (existing test).
  - The career-mode evaluation set reaches ≥95% citation rate before release.
- **Complexity:** M. **Depends on:** F05, F06, F07, F08.
- **Why ENEC:** it keeps the AI coach inside ENEC's governed Dalil pattern, with retrieval, refusals and a kill switch (spec M13), and matches the AI-coaching capability of leading platforms [S18] without an LLM.

#### F38 · OJT practice logbook, mobile-first PWA (`/my/ojt`)
- **Wave/owner:** W5 · E1 · **existing `src/modules/m02`**.
- **For:** trainees (LOIT, COIT, maintenance, RP and chemistry initial training), preceptors and qualified workers.
- **Problem:** trainees practise qualification tasks many times before formal evaluation. That practice and preceptor feedback is on paper, and Kafa'a only sees the final sign-off.
- **What it does:**
  - A **practice log** per qualification task (not security-restricted): date, conditions (walkthrough, simulate, perform), preceptor role card, feedback, confidence.
  - Preceptor **acknowledges** on their own device. It is clearly labelled "practice, not a qualification sign-off".
  - **Readiness indicator** per task: ≥N supervised performances plus preceptor "ready".
  - **"Request evaluation"** hands off to M02 `signoffEvaluation` with an evaluator.
  - **Offline-capable PWA:** service worker scoped to `/kafaa/my/ojt`; it queues entries and syncs, and it never caches other pages.
  - Emits xAPI to F30.
- **Data:**
  - `kafaa_ojt_logs` (person_id, task_id, on_date, mode, preceptor_person_id, feedback, ack_at)
  - RPCs `logPractice`, `ackPractice`, `requestEvaluation`.
- **RBAC:** Own; preceptor W (ack) when addressed; instructor and evaluator Scope; managers Scope.
- **Acceptance:**
  - Restricted tasks cannot be logged (`security_restricted`).
  - A practice entry never changes qualification status (test).
  - Entries made offline sync exactly once (idempotent client keys).
  - The service worker scope is limited to `/kafaa/my/ojt` and passes the speak-up no-telemetry check.
- **Complexity:** M. **Depends on:** F30 optional; M02.
- **Why ENEC:** Barakah's initial training uses OJT with task performance evaluation from job qualification cards [S22]. Maintenance alone had 907 trainees in initial and continuing training in 2024 [S23].

---

## 6. Risks and open questions

1. **Shared-file pressure.** F01 removes most of it by registering M17 to M27 once. Each wave still appends to `src/data/schema.ts`, `types.ts`, the local RPC file and `SupabaseBackend.ts`. Keep the existing pattern: each engineer gets a `rpc.<wave><eng>.ts` delegate file and a one-line hook, and conflicts in generated files are resolved by re-running `npm run gen`.
2. **Contract requests already known:**
   - F06 writes M04 `dev_plans`
   - F19 writes M07 `critical_roles` counts
   - F31 extends M02 `evaluator_quals`
   - F02 promotes `careerGraph` and Dalil search into `src/domain`
3. **Sensitive HR data (F18, F19, F20).** These are the most sensitive screens in the product, even with synthetic data. Keep them behind `talent_review`/`knowledge` with RLS tests, out of the public payload check, and never in observer releases except as suppressed aggregates.
4. **No regulator claims.** Badges, micro-credentials, OJT logs and readiness % must never be read as FANR certification or qualification. Every such screen carries the mirror and "not an authority" copy.
5. **Uncertain facts used in "why" text:**
   - SR2024 attrition and age charts are marked uncertain in research.
   - ISO 30401 certification of ENEC's KM programme is stated in the CNS national report (p.73) but is absent from ENEC's ISO list page.
   - The current INPO accreditation objective count is unconfirmed [S7].
   - These items carry "per source" wording in the UI.
6. **Nafis applicability.** Nafis targets private-sector Emiratisation. ENEC is ADQ-owned, so present Nafis as the national direction (quality of Emiratisation), not as a quota on ENEC.

## 7. Sources

- [S1] IAEA NG-T-6.11, *Knowledge Loss Risk Management in Nuclear Organizations* (2017): https://www.iaea.org/node/41993 ; PDF https://www-pub.iaea.org/MTCD/Publications/PDF/17-35661_PUB1734_web.pdf
- [S2] IAEA-TECDOC-1999, *Mentoring and Coaching for Knowledge Management in Nuclear Organizations* (2022): https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1999web.pdf
- [S3] IAEA TRS-380, *Nuclear Power Plant Personnel Training and its Evaluation* (SAT; superseded by NG-T-2.8, 2021): https://www-pub.iaea.org/MTCD/Publications/PDF/trs380_web.pdf
- [S4] IAEA-TECDOC-1963, *Development, Use and Maintenance of NPP Simulators for Training and Authorization* (2021): https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1963web.pdf
- [S5] IAEA Bulletin 54-1 on HRM and succession planning: https://iaea.org/sites/default/files/publications/magazines/bulletin/bull54-1/54104711313.pdf ; NG-T-3.10 Rev.1 HRM (2022): https://www.iaea.org/node/104858
- [S6] IAEA structured-interview knowledge capture (INMM): https://resources.inmm.org/node/11616 ; IAEA KM overview with Krško retiree capture: https://www.iaea.org/node/40917
- [S6b] Sandia, "Retaining knowledge of nuclear waste management" (recorded interviews, searchable transcripts): https://newsreleases.sandia.gov/?p=18997
- [S7] INPO/NANT accreditation (ACAD 02-001 objectives and criteria; self-evaluation, team visit, NNAB), from NRC meeting summaries [secondary]: https://www.nrc.gov/docs/ML0211/ML021160697.pdf ; https://publish.nrc.gov/docs/ML2317/ML23172A282.pdf
- [S8] IAEA Safeguards Training Section use of the Kirkpatrick model: https://conferences.iaea.org/event/47/contributions/8738
- [S8b] WINS Academy, Kirkpatrick for nuclear security training: https://resources.inmm.org/node/54588
- [S9] ADL xAPI (IEEE 9274.1.1-2023, xAPI 2.0): https://adlnet.gov/projects/xapi
- [S10] 1EdTech Open Badges 3.0: https://www.1edtech.org/1edtech-article/new-open-badges-30-standard-provides-enhanced-security-and-mobility/411060
- [S11] SkillsFuture Skills Framework (sector frameworks, TSC levels, pathways): https://www.skillsfuture.gov.sg/skills-framework/ict ; MOM TSC levels: https://www.mom.gov.sg/-/media/mom/documents/employment-practices/pwm/list-of-suggested-technical-skills-and-competencies-for-occupational-progressive-wages-opw.pdf
- [S11b] Enhanced MySkillsFuture portal (personalised recommendations; Skills Passport): https://www.skillsfuture.gov.sg/newsroom/enhanced-myskillsfuture-portal-to-provide-personalised-recommendations-to-guide-singaporeans-towards-achieving-career-and-skills-goals
- [S12] IBF Skills Framework for Financial Services: https://ibf.org.sg/home/for-financial-institutions/resource-tools/skills-framework-for-financial-services ; Jobs Transformation Map: https://ibf.org.sg/home/for-financial-institutions/resource-tools/sustainable-finance-jobs-transformation-map
- [S13] Workday Skills Cloud foundation: https://blog.workday.com/en-us/2020/foundation-workday-skills-cloud.html
- [S14] Degreed Peer Ratings (self, manager, peer; 360 view of skills): https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/
- [S15] Eightfold Talent Management datasheet (Career Hub): https://eightfold.ai/wp-content/uploads/eightfold_talent_management_datasheet.pdf
- [S16] Gloat Talent Marketplace: https://gloat.com/platform/the-talent-marketplace/
- [S16b] Gartner, internal talent marketplaces: https://www.gartner.com/reviews/market/internal-talent-marketplaces
- [S17] Cornerstone Skills Engine: https://www.cornerstoneondemand.com/solutions/skills-graph/
- [S18] LinkedIn Learning product updates (AI coaching, role play): https://learning.linkedin.com/customer-success-center/product-updates/all-updates/q1-26 ; product overview: https://business.linkedin.com/learn/product-overview
- [S19] WEF Future of Jobs Report 2025: https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/
- [S20] Nafis 2026 priorities (quality of Emiratisation): https://gulfnews.com/uae/nafis-2026-introduces-5-ai-enabled-priorities-to-measure-the-quality-of-emiratisation-in-the-private-sector-1.500427621 ; The National, 20 Jul 2026: https://www.thenationalnews.com/news/uae/2026/07/20/emiratisation-on-track-with-190000-employed-in-private-sector/
- [S21] WNN, KHNP OSSA (~400 experts a year until 2030): https://world-nuclear-news.org/articles/agreement-assures-korean-expert-support-for-uae-pl ; ENEC global operating experience page: https://www.enec.ae/discover/how-nuclear-energy-works/who-operates-the-plant-/global-operating-experience/
- [S21b] ENEC Graduate Plant Operator / DNT coverage (WNN): https://world-nuclear-news.org/articles/uae-launches-nuclear-educational-courses
- [S22] UAE National Report, 10th CNS Review Meeting (Mar 2026), Arts. 9 and 11 (SAT, leadership academy, 9-box HiPo coaching, mentoring, ISO 30401 KM, knowledge-sharing sessions, FANR KLRA, 65 SME trainers, contractor equivalency): https://www.iaea.org/sites/default/files/cns-10th-review-meeing-uae-national-report_ae1.pdf (local copy `research/enec_raw/iaea/cns10_clean.txt`)
- [S23] ENEC Sustainability Report 2024 (workforce, attrition, age bands, training hours, COIT/LOIT/COCT, discipline training): https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf (summarised in `research/enec_workforce_training.md`)
- [S24] FANR-REG-16, Art. 9 (systematic, performance-based training, including contractors; qualified instructors): https://www.fanr.gov.ae/en/Documents/REG-16-English.pdf
- [S25] NEA NEST framework: https://www.oecd-nea.org/jcms/pl_56329/building-the-vital-skills-for-the-future-of-nuclear-energy ; NEA gender-balance recommendation (ANS): https://ans.org/news/author-nnstaff/step-1686839425
- [S26] 9-box and readiness (UNMC talent pool guide): https://phtc.unmc.edu/m/mod/page/view.php?id=1320 ; Gallup on succession methods: https://www.gallup.com/workplace/647864/avoid-getting-boxed-conventional-succession-methods.aspx
- [S28] ENEC training facilities (full-scope simulators, OTC, 3D model): https://www.enec.ae/discover/how-nuclear-energy-works/who-operates-the-plant-/training-facilities/
- [S29] ENEC talent pipeline programmes: https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/ ; DNT first-cohort graduation (Jun 2026): https://www.enec.ae/news/latest-news/enec-celebrates-graduation-of-first-national-cohort-from-diploma-in-nuclear-technology-program/ ; ENEC–DGE agreement: https://www.enec.ae/news/latest-news/enec-and-department-of-government-enablement-abu-dhabi-sign-agreement/
- [S30] Evidence on rotation and retention is mixed (survey and correlational; Indonesian studies point in opposite directions). This is a research note used as a design caution: no retention claims in the UI.
