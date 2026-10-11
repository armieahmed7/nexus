# fsCe2 DONE: FS19 Future-skills course pack + FS20 Future-skills academies and cohorts (M04)

Branch `fsCe2` (worktree `/workspace/kafaa-fsCe2`), commit `1ffd124`. Not pushed. Netlify not touched.

## Acceptance

### FS19 Future-skills course pack
- [x] About 18 modular courses (all 60 h or less): 18 core courses across data and AI, digital plant, advanced reactor, green, human and cyber themes, plus 2 cross-over versions for adjacent industries (`c-fs-smr-x`, `c-fs-plantlit-x`, audience public). Every course has 5 modules, sources with as-of dates, a weeks x hours envelope and the SIMULATED label. Advanced-reactor and transition courses say no deployment decision is implied.
- [x] Each of the 6 skills held by nobody gains at least one course. The seed builder fails otherwise, and the unit test and PGlite validator both check it.
- [x] Every course links at least one skill at a stated level (1-3) through `course_skill_links`. 49 links in all.
  - A link is also the course's F01 evidence key (`skills.evidence_keys`).
  - The link is mirrored into `courses.objectives` `{skill_id, level, en, ar}`, which is the shape FS17 pathways read.
- [x] The cyber hygiene course contains no security-restricted content.
  - The copy and link check (`copyProblems` = `kafaa_fsc_copy_problems`) covers 25 restricted terms, https only and no advisory or exploit paths.
  - Cyber links are limited to an awareness-level host allow-list.
  - The result is stored per course, and the training manager can re-run it.
  - The test injects bad wording and bad links and the check refuses them.
- [x] "Picked for me" ranks pack courses against today's and 2030 role-profile gaps, with `<WhyThis>` reasons and enrol.
- [x] Studio for training staff: coverage by future skill, the copy and link check, and a link editor (training W).
- [x] BenchmarkChips `FS19` (SMR-WF, UAE-PEERS, ENTITLE) on every FS19 page.

### FS20 Future-skills academies and cohorts
- [x] Four academies (AI Academy, Digital Twin Bootcamp, SMR Fundamentals cohort, Energy Transition cohort). Each lists modules, a project, a deliverable, a mentor role and a reviewer role (the module + project + mentor triad of the Nordic NNTP model).
- [x] A signed-off capstone writes evidence and recomputes skills.
  - Only the named reviewer signs off, and never the member.
  - `merit` gives level+1 (capped at 3); `pass` gives the stated level.
  - The evidence is F01 `ojt` with `ref_table = 'cohort_capstones'`, followed by `kafaa_skills_apply`, the member becoming an alumnus, a notification and a ledger entry.
  - `not_yet` needs feedback and records nothing.
- [x] Cohort statistics under 10 are suppressed, in TS `academyStats` and SQL `kafaa_acad_stats_core`. This covers participants, nominations, alumni, review counts and pass and merit rates. Small seeded cohorts (SMR, Energy, Twin 2) show as suppressed.
- [x] Nominations work three ways:
  - staff can nominate themselves
  - a line manager can nominate their team
  - the programme owner can nominate anyone
- [x] The programme owner decides each nomination by naming a mentor and a reviewer. Acceptance enrols the person in the module courses and creates a draft capstone. RBAC: owner = `training` W and A; instructors get a read-only console.
- [x] Views: progress (stepper), capstone editor (EN/AR), reviews, mentees, cohort roster, alumni.
- [x] BenchmarkChips `FS20` (NUC-NET, UAE-PEERS) on every FS20 page.

## Routes (+6, EN + AR/RTL)
- `/learn/future-skills` (public)
- `/learn/academies` (public)
- `/learn/academies/:academyId` (public)
- `/my/academies` (employee)
- `/training/future-skills` (instructor, training manager)
- `/training/academies` (instructor, training manager)

Also: an FS19 panel on `/learn/course/:id` for pack courses.

## Tables / RPCs / migration
- Tables (M04):
  - `kafaa_course_pack_items`, `kafaa_course_skill_links`, `kafaa_academies`, `kafaa_academy_cohorts`: public read.
  - `kafaa_academy_members`, `kafaa_cohort_capstones`: `training` person rule, plus the named mentor and reviewer through `own_profile`.
  - Writes only through RPCs.
- RPCs (authenticated): `kafaa_save_course_skills`, `kafaa_check_course_pack`, `kafaa_nominate_academy`, `kafaa_decide_academy_nomination`, `kafaa_save_capstone`, `kafaa_signoff_capstone`, `kafaa_academy_stats` (also anon; aggregates only), `kafaa_academy_nominees`.
- Helpers `kafaa_fsc_*` and `kafaa_acad_*` cannot be executed by API roles.
- Migration: `supabase/migrations/20261010232001_kafaa_fs32_course_pack_academies.sql`.
- Shared writes, data only and inside my SECURITY DEFINER RPCs: `skills.evidence_keys`, `courses.objectives` (pack courses only), `enrolments`, `skill_evidence` (ojt), `notifications`. Logged in the CONTRACT changelog.

## Seed (`scripts/seed/ext/fs19-course-pack.mjs`, FINALIZE_LAST)
- Content: 5 programmes, 20 courses, 100 modules, 20 pack items and 49 links.
- Academies: 4 academies and 7 cohorts.
- Simulated activity: 61 members, 50 capstones, 186 module enrolments and 60 capstone evidence rows, all on FS02 skills.
- F01_DIGEST_71 and the F36 digests are unchanged.
- Demo cast:
  - `p-k-ro`: AI cohort 2, draft capstone.
  - `p-buyer`: submitted capstone, reviewed by `p-ai-governance`.
  - `p-outage-planner`: merit alumnus.
  - `p-training-mgr`: 11 nominations to decide.
  - Reviewers: `p-sme-reviewer`, `p-head-sq`, `p-head-sustainability`.

## Live (Supabase hlirqxoddysxtdezwcgv)
- Applied as 3 migrations:
  - `kafaa_fs32_course_pack_academies_part1_tables_rls`
  - `_part2_helpers_pack_rpcs`
  - `_part3_academy_rpcs_grants`
- Rows were loaded with `on conflict do nothing`, followed by `kafaa_fsc_sync_keys` for the 20 courses and `kafaa_skills_apply(.., 2026-10-08)` for the 20 capstone people.
- Digests equal local:

  | Check | Count | md5 |
  |---|---|---|
  | Pack items | 20 | 12b9dec8… |
  | Links | 49 | 4166f9ec… |
  | Members | 61 | 7ce366be… |
  | Capstones | 50 | fa28d2a0… |
  | Evidence keys | 43 skills | 49f77159… |
  | Objectives | 20 | a3e8ea59… |
  | Enrolments (full row) | 186 | af58db02… |
  | Capstone evidence (full row) | 60 | 05ccb202… |
  | Capstone-skill states | 83 | a79f38c4… |
  | Function bodies (`prosrc`) | 21 | f70ef5f1… |

- anon can execute only `kafaa_academy_stats`.
- No DROP or DELETE was run, and no NEXUS object or row was touched.

## Tests / gates
- `tests/unit/fs32-course-pack-academies.test.ts`: 17 pass. Every acceptance criterion has its own test, alongside RPC refusals, RLS, SQL/TS parity of the rules, and the seed invariants.
- `tests/unit/fs32-pages.test.tsx`: 13 pass. All six pages, the course panel, Arabic renders, benchmark chips, picks with "Why this?", nominate, reviewer sign-off and the read-only instructor console.
- `scripts/validate/fs32-course-pack-academies.mjs` (PGlite): all checks pass. Covers seed acceptance, SQL = TS parity (copy check, evidence level, ids, stats), RLS and RPC flows.
- gen (no unexpected diff), check:i18n (40 namespaces, parity), typecheck, check:public, build: green. `migrations:validate`: "All migration checks passed", including the fs32 validator.
- Affected suites re-run, all green: fs11-catalogue (13), m04-learning (12), m04-paths (9), w0-scaffold (5), w0-skills (14), fs13-keyspace (11), fs12-decay (22), w3e5-no-protected-inputs (48), w5e5-digest (20).
- `fs11-foundation`, `fsqa1-integration` and `fsqa2-integration` fail only on the pinned route count (227 -> 233). That pin is left to the integration lead.

## Gaps / notes for the integration lead
- Route-count pins need 233 (more after the other wave-C branches): `fs11-foundation`, `fsqa1-integration`, `fsqa2-integration`, and the `w4`/`w5` integration tests plus `tests/e2e/sweep.spec.ts`, if they pin it.
- Four shared invariant checks now also accept states backed by capstone evidence (`ref_table cohort_capstones`), as they already did for fitness evidence. These are `tests/unit/fs11-catalogue.test.ts`, `scripts/validate/fs11-foundation.mjs`, `scripts/validate/fsqa1-integration.mjs` and `tests/unit/fsqa1-integration.test.tsx`, each marked FS20.
- Seed-only side effect: the knowledge-capture builder now suggests some pack courses as tags on 5 knowledge assets (`kas-*`, with decision `rejected`), together with their `asset_reviews`. These rows were not changed live.
- Playwright was not run.
