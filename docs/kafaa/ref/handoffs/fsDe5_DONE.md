# fsDe5 DONE: FS36 AI-literacy register + FS37 Governed AI sandbox drills (M29)

Branch `fsDe5` (worktree `/workspace/kafaa-fsDe5`), commit `392a8c8`. Not pushed. Netlify not touched.

## Acceptance

### FS36 AI-literacy register
- [x] **Coverage is computed from FS09 rungs, not entered by hand.**
  - No coverage, percentage or count column exists on `ai_systems` or `ai_system_users`.
  - `aiLiteracyCoverage` = `coverage()` over `aiRung` of every active staff member. TS = SQL: `kafaa_air_coverage` over `kafaa_ai_rung`, PGlite on 5 system sets.
  - Coverage drops when people's literacy states are removed (unit test).
  - "Fully implemented" must be carried by coverage: the seed label holds (drafting assistant 89.6%), and the RPC refuses a full label under 80% in TS and SQL. A label that coverage no longer supports is flagged "Label above coverage".
- [x] **Groups under 10 are suppressed.**
  - n, covered, pct and gaps are all suppressed for small groups, for example Dalil builders (5) and content editors (4). Every shown cell is 10 or more.
  - The rule is unit-tested at 9 and 10 people.
- [x] **The pack states that Kafa'a is not a regulator and that the alignment is voluntary.**
  - `buildPack` sets `not_a_regulator: true` and `voluntary_alignment: true` and carries the bilingual statement ("does not grant a presumption of compliance").
  - Every CSV row carries the statement. The page shows it with test ids.
  - Register text with compliance or certification wording is refused in EN and AR.
- [x] **RBAC.**
  - ai_literacy W/A for admin and AI governance: writes need A (the training manager is refused).
  - Auditors read the register, including drafts and retired entries, and its coverage.
  - Staff read published entries and see only their own requirement.
  - HR (Agg) sees coverage. A system owner sees coverage for their own published system.
  - Anonymous visitors and partners get nothing.

### FS37 Governed AI sandbox drills
- [x] **Scoring is identical in TS and SQL.**
  - `scoreDrill` = `kafaa_dr_score` on all 107 seeded attempts and on 400 generated submissions (duplicates, bad kinds, missing answers).
  - Normalisation, submission checks, authoring checks and stats match too.
  - Local `submitDrill` returns exactly the rule's score.
- [x] **All documents are synthetic and marked as such.**
  - Every drill has a `SYN-XX-000` code, `synthetic = true`, SYNTHETIC / اصطناعي in the document title and a SIMULATED output label.
  - The player shows a SYNTHETIC watermark and chip.
  - Authoring refuses non-synthetic codes and plant-security wording.
- [x] **Evidence never exceeds L2.**
  - 2,000 generated submissions (and a level-3 drill setting) never score above 2.
  - Authoring refuses level 3.
  - Seed evidence is L1-L2. A perfect level-2 drill writes L2 (the cap).
- [x] **No model call or LLM key.** Drills are authored and scored deterministically, with reasons (`<WhyThis>`). The assess engine badge is shown.
- [x] **The key stays server-side.**
  - Staff can never read `ai_drill_keys`.
  - Drill rows carry no answers.
  - Feedback is revealed only in the taker's own attempt.
- [x] **The latest attempt on a drill replaces earlier evidence from it.** Recompute keeps drill evidence (it is recorded evidence).
- [x] **RBAC.**
  - Own attempts only.
  - Authoring needs the training manager (ai_literacy W + secure_items W/A); admins are refused.
  - Statistics go to training staff and HR, suppressed under 10.

## Routes (7, EN + AR/RTL)
- `/workforce/ai-register`: ai_literacy R.
- `/workforce/ai-register/:id`: smoke `ais-doc-search`.
- `/workforce/ai-literacy-pack`: admin, auditor, HR.
- `/admin/ai-register`: ai_literacy A.
- `/my/ai-fluency/drills`: ai_literacy Own.
- `/my/ai-fluency/drills/:id`: smoke `ad-valve-lineup`.
- `/training/ai-drills`: secure_items W/A.

Route-count pins are left for the integration lead (+7).

## Tables / RPCs
- **Tables:** `kafaa_ai_systems`, `kafaa_ai_system_users`, `kafaa_ai_drills`, `kafaa_ai_drill_keys`, `kafaa_ai_drill_attempts`.
- **RPCs** (authenticated only):
  - `kafaa_ai_literacy_coverage`
  - `kafaa_save_ai_system`
  - `kafaa_submit_drill`
  - `kafaa_drill_stats`
  - `kafaa_save_drill`
- **Helpers** (not executable by API roles):
  - `kafaa_air_people`, `kafaa_air_coverage`, `kafaa_air_raw_pct`, `kafaa_air_str`, `kafaa_air_int`, `kafaa_air_problem`
  - `kafaa_dr_norm_flags`, `kafaa_dr_score`, `kafaa_dr_sub_problem`, `kafaa_dr_problem`, `kafaa_dr_stats_core`
- **Shared redefinition** (same signatures): `kafaa_skill_states_v2` and `kafaa_skills_apply` add `'ai_drill_attempts'` to the recorded-evidence lists.
- **Migration:** `supabase/migrations/20261010245001_kafaa_fs45_ai_register_drills.sql`.

## Seed
- **Register:** 8 entries and 12 user groups.
  - 6 published: document search, SIMULATED predictive maintenance, Dalil (provider), meeting summariser, SIMULATED outage optimiser, drafting assistant (fully implemented).
  - 1 draft and 1 retired.
- **Drills:** 7 drills with keys (6 published, 1 draft).
- **Attempts:** 107 attempts by 41 staff, 47 of them passed. They wrote 47 drill evidence rows (L1-L2) and 6 new skill states.
- **Unchanged:** the 71-skill states, digests, F23 snapshots and F35 outlooks.
- **Demo:**
  - `qc-inspector`: one pass, one not yet.
  - `k-ro`: starts fresh.
  - `chco` / `k-auditor`: coverage.
  - `outage-manager`: owner scope.
  - `ai-governance`: editor.
  - `training-mgr`: drill bank.

## Tests
- `tests/unit/fs45-ai-register.test.ts`: 21 tests, one or more per acceptance criterion.
- `tests/unit/fs45-pages.test.tsx`: 8 page tests (EN and AR, a drill end to end).
- PGlite: `scripts/validate/fs45-ai-register.mjs` (44 checks).

## Gates
- `npm run gen`: pass. The generated files are regenerated and committed.
- `npm run check:i18n`: pass (40 namespaces, EN/AR in parity).
- `npm run typecheck`: pass (after a test-only cast fix in `fs45-ai-register.test.ts`).
- `npm run check:public`: pass.
- `npm run migrations:validate`: pass ("All migration checks passed", including fs45: 44 checks).
- `npx vite build`: pass.
- **Unit tests:**
  - Passed: `fs45-ai-register` (21/21) and `fs45-pages` (8/8); `fs33-assessment` (20/20, in the first chunk).
  - Not completed: the full chunked suite and the seed-wide files I touched (`w0-skills`, `fs11-catalogue`, `fs12-decay`, `fs22-*`, `fsqa1/2-integration`).
  - Why: the container's memory cgroup was OOM-killing every vitest process (exit 137) while other engineers' suites and validators ran (about 1.5 to 3 GB free). Each file was tried 3 times, starting only when 4 GB was free.
  - What changed in those files: a one-literal `RECORDED_REF_TABLES` widening, mirrored in the validators, which passed in `migrations:validate`.
  - **Integration lead: re-run these files.**

## Live (Supabase hlirqxoddysxtdezwcgv; additive only)
- **Migrations applied in four parts:**
  - `kafaa_fs45_ai_register_drills_part1_tables_rls`
  - `..._part1b_skill_states`
  - `..._part2a_register_functions`
  - `..._part2b_drill_functions`
- **Shared redefinition check:** before the shared redefinition, the live `kafaa_skill_states_v2` and `kafaa_skills_apply` bodies equalled the local bodies minus `'ai_drill_attempts'` (md5 c075250d… and fd062b9b…).
- **Function bodies:** all 18 function bodies match local by md5 (v2 074343… and apply 550894…).
- **Grants:**
  - Helpers cannot be executed by anon or authenticated.
  - RPCs can be executed by authenticated users only.
  - Anon reads 0 rows from all 5 tables.
- **Rows loaded with `on conflict do nothing`.** Digests (md5 of `to_jsonb` rows ordered by id) are identical live and local:

  | Table | Rows | Digest |
  |---|---|---|
  | systems | 8 | 972cf947 |
  | users | 12 | 60a98ea4 |
  | drills | 7 | 9eda2c19 |
  | keys | 7 | 06550221 |
  | attempts | 107 | 2856cd6b |
  | drill evidence | 47 | 35941339, created_at b2faac75 |

  Attempts were scored server-side by `kafaa_dr_score` and are byte-identical to the seed.
- **Skill states:** `kafaa_skills_apply(p, 2026-10-08)` was run for the 41 drill people.
  - Live and local agree on the 40 `sk-fs-ai-verify` states (e185ea31).
  - Only `sk-fs-ai-verify` states changed (34 rows).

## Gaps / notes
- **Route-count pins:** +7 routes. Left to the integration lead.
- **Shared SQL redefinition:**
  - What changed: `kafaa_skill_states_v2` and `kafaa_skills_apply` add `'ai_drill_attempts'` to the recorded-evidence lists. The pattern is FS21/FS33.
  - Conflict risk: any later wave-D migration that redefines these functions must carry the full list, including `'ai_drill_attempts'`. This is logged in CONTRACT.md.
- **Shared one-line edits:** `RECORDED_REF_TABLES` is widened in `src/domain/skills.ts` and in four validators and four tests that pin the literal. `PassportView` labels drill evidence.
- **Playwright/E2E:** not run (not the integration lead).
- **Seed people:** synthetic only. Live had 11 more skill states than local for the drill people before my apply; they come from other live data and are untouched.
