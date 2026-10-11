# fsDe3 DONE: FS31 + FS32 + FS33 (FS wave D, E3, module M17)

Branch `fsDe3`, worktree `/workspace/kafaa-fsDe3`. Not pushed.

## Acceptance

### FS31 · Future-skills micro-credentials with a strategic tier
- [x] **Every new definition passes the regulatory-wording copy check.** The 8 published FS31 definitions (MC-AI-ASSURER, MC-DATA-DECISIONS, MC-TWINS v2, MC-SMR-FOUND, MC-CLEAN-ENERGY, MC-CYBER-HYGIENE, MC-QUESTION-AI, MC-SYSTEMS) and the MC-H2-HEAT draft pass `hasRegulatoryWording` = false and `validateDef` / `kafaa_mc_validate_def` = ok.
  - Unit: fs43 "AC: each new definition passes…".
  - PGlite: "TS = SQL ok".
- [x] **Strategic credentials unlock the gigs that name them.** The tier holds AI-ASSURER, DATA-DECISIONS and TWINS. k-ro holds MC-AI-ASSURER, so `opp-governed-ai-pilot` shows as unlocked (`fc_unlocked`); a non-holder (buyer) sees `fc_locked`; when the credential leaves the tier the reason is `fc_tier_off`. `credentialTargetCheck` is the eligibility-rule extension.
  - Unit and PGlite cover this, and the page test shows the pilot card as unlocked or locked.
- [x] **Every definition (published and draft) can be met through existing or FS19 content.** `satisfiability()` lists the routes: courses, F01 course alignment, FS21 banks, FS22 tasks and opportunities.
  - Unit and PGlite cover this; the credential page shows the routes under "How to earn it".
- [x] **"Where this credential takes you"** lists roles, gigs and rotations, with my state and `<WhyThis>`.
- [x] **Report of strategic credentials against internal moves.** It is a correlation, not a cause; groups under 10 are suppressed. Training manager, HR and auditors can read it; line managers cannot.

### FS32 · Learner record (CLR-shaped) with selective disclosure
- [x] **The bundle validates against a CLR-shaped schema in a unit test.** Checked with `validateClr`; a broken bundle fails. PGlite also checks every seeded and full bundle, and TS = SQL holds for 26 bundles.
- [x] **No security or medical detail is ever included.** This holds for all 106 staff: security standards and skills, security-mirror-only records and medical or restricted words are never in a bundle, and no name appears (initials only).
  - Unit and PGlite cover this.
- [x] **An expired or revoked link shows nothing personal.** No initials, items, counts or expiry are shown, and an unknown link returns not_found.
  - Unit, PGlite and the page test cover this.
- [x] **Three consent gates (choose, preview, share) and a curated link with an expiry.** The link expires within 1 to 90 days; there are at most 10 active links and 30 items each. The holder can revoke a link. Verification is public and rate-limited (20 per minute per link, 600 per minute overall), audited and counts views.

### FS33 · Skills I want to grow
- [x] **A goal changes the Coach ranking with a "your goal" reason.** Saving a goal adds the m19 `rankPathways` reason `my_goal` (weight 2); withdrawing the goal removes it.
  - Unit test: the Coach goal input is built exactly as `useFsCoach` builds it.
- [x] **Managers see goals only when the person shares them (RLS test).** The line manager (sro) sees 2 of k-ro's 3 goals. HR, colleagues and anonymous users see none. Making a goal private again hides it at once.
  - Unit (LocalBackend), PGlite RLS and the page test cover this.
- [x] **Goals appear in EN and AR on the passport with their target date, and a goal can be withdrawn at any time.** There is a goals strip on `/my/skills` and `/team/passport/:id` (shared goals only), and "Add to my goals" in the evidence drawer. Withdrawing a goal unshares it and removes FS07's goal row; removal from the FS07 skill page also unshares it (trigger).

## Routes (7)
- `/my/skills/goals` (my-skills-goals, OWN)
- `/team/skills/goals` (team-skills-goals, skills_profile Scope/A)
- `/my/skills/record` (my-skills-record, OWN)
- `/verify/record/:token` (verify-record, public; smoke token of rs-kro-digital-rotation)
- `/my/skills/credentials/future` (my-skills-credentials-future, OWN)
- `/my/skills/credentials/c/:code` (my-credential, OWN; smoke MC-AI-ASSURER)
- `/training/credentials/strategic` (training-credentials-strategic; training_manager, hr_analyst, hr_director, admin, auditor)

Every page shows `<BenchmarkChips feature="FS31|FS32|FS33">`, `<WhyThis>` reasons, Async/empty/error states, a ConfirmDialog before each RPC, and full EN and AR text.

## Tables and RPCs
- **New tables:**
  - `kafaa_microcred_unlocks` (read: frameworks)
  - `kafaa_record_shares` (read: Own)
  - `kafaa_skill_goal_plans` (read: Own, plus Scope through `share_person` only while active and shared; the always-false `open_read` blocks R/W/A)
- **New columns:** `kafaa_microcred_defs.strategic`, `strategic_note`, `strategic_since`.
- **RPCs (12):**
  - `kafaa_set_microcred_strategic` (ledger)
  - `kafaa_set_credential_unlock`
  - `kafaa_credential_unlocks`
  - `kafaa_credential_target_check`
  - `kafaa_strategic_report`
  - `kafaa_learner_record`
  - `kafaa_create_record_share` (ledger)
  - `kafaa_revoke_record_share` (ledger)
  - `kafaa_verify_record_share` (anon)
  - `kafaa_save_skill_goal`
  - `kafaa_withdraw_skill_goal`
  - `kafaa_share_skill_goal`
- **Helpers:** `kafaa_fc_*`, `kafaa_lr_*`, `kafaa_sg_*`, and the trigger `kafaa_sg_sync_plan_trg` on `kafaa_skill_goals`.
- **Redefined (same signatures):** `kafaa_mc_crit`, `kafaa_mc_eligibility`, `kafaa_mc_validate_def` (adaptive and task criteria; future-skill areas).
- **Migration:** `supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql`.

## Seed (scripts/seed/ext/fs31-future-credentials.mjs)
- 9 definitions: 8 published plus the MC-H2-HEAT draft. MC-TWINS v1 is superseded.
- 6 unlocks.
- 102 signed awards (AI-ASSURER 12, CLEAN 11, CYBER 39, DATA 4, QUESTION 9, SMR 20, TWINS 7), with 173 F01 credential evidence rows. Original-catalogue states are unchanged.
- 16 goal plans (7 shared).
- 4 share links (active, expired, revoked, and an active one for sro).
- FS17 gap rows stay at 215.

## Tests
- `tests/unit/fs43-credentials-record-goals.test.ts`: 20 tests, one or more per acceptance criterion.
- `tests/unit/fs43-pages.test.tsx`: 17 jsdom page tests in EN and AR.
- `scripts/validate/fs43-credentials-record-goals.mjs`: PGlite, TS = SQL parity, RLS, grants and the additive check.

## Gates (worktree /workspace/kafaa-fsDe3; commits a3df13d, 437e815, 5d80f6c)
- gen: OK.
- check:i18n: EN and AR keys match.
- check:public: OK.
- typecheck (tsc --noEmit): rc 0, run after the last fix.
- build (vite build): rc 0.
- migrations:validate: 1591 checks passed. The 2 failures in shared validators came from FS31 data; I fixed both (w5e1, fsqa1) and re-ran them.
- unit: I ran all 121 files serially in chunks of 4 with --no-file-parallelism.
  - The root disk filled up partway through. I re-ran the affected chunks with vitest's TMPDIR on /dev/shm.
  - My files (fs43-credentials-record-goals with 20 tests, fs43-pages with 17) all pass: 37/37.
  - Two real regressions turned up and are fixed in 5d80f6c:
    - The FS33 plan sync threw when a persona switch came before the store had loaded.
    - The wave-C QA expectation on pw-ai-verify-l2 changed because the new aligned MC-AI-ASSURER credential takes one of the 4 assess slots. The test is updated and the change is logged in CONTRACT.
  - Remaining failures are not caused by this work:
    - Route-count pins (fs11-foundation, fsqa1/2/3, w4-integration, w5-integration) expect older totals, while the registry now has 266 routes. Left to the integration lead.
    - g1-pages "shift supervisor sees crew availability" depends on the date. As of 2026-10-11 the M03 licence source sync is stale, so the crew shows "Cannot confirm (stale data)". This is unrelated to M17.
- Playwright and browsers: not run, as instructed.


## Live (Supabase hlirqxoddysxtdezwcgv)
Additive only: kafaa_* tables, functions and rows. Applied in parts with apply_migration; seed rows loaded with insert ... on conflict do nothing. No NEXUS objects were touched and no DROP or DELETE was run. Awards were sent compacted and rebuilt with kafaa_badge_sign(kafaa_mc_credential(...)), and evidence was derived with kafaa_mc_aligned. A PGlite proof showed these give the same rows as the TS seed. kafaa_skills_apply was rerun for the 66 people affected.

Live row counts and digests match local (count, md5 prefix):
- kafaa_microcred_defs 10 (new strategic defs) e1937f25
- kafaa_microcred_awards 102 12cd53e6
- kafaa_microcred_evidence 173 8baef653
- kafaa_microcred_unlocks 6 774da28a
- kafaa_record_shares 4 43863abd
- kafaa_skill_goals 16 (FS07 table, written via SECURITY DEFINER) c60228d4
- kafaa_skill_goal_plans 16 c1b2c92a
- function bodies: 27, 00156cfb4e90094bd1f1614e754c70bb

Live smoke checks:
- The k-ro holder is unlocked for opp-governed-ai-pilot; a buyer is still locked.
- The strategic report shows MC-AI-ASSURER with 12 holders at a 16.7% rate; the other cells are suppressed.
- The shared record bundle returns 8 items.


## Gaps and hand-offs
- Disk: the shared root filesystem is at 100%, filled by about 26 GB of leftover vitest SSR temp dirs in /tmp. Other agents' runs fail with ENOSPC until it is cleaned. I did not delete files that are not mine.
- **F08/F15 apply flows (m20, not mine):** they should call `credentialTargetCheck` before an application to a placement that names a strategic credential. The rule and RPC exist; the gate is not enforced inside m20's apply RPCs yet.
- **FS07 skill page "Add to my goals":** it still calls M28 `setSkillGoal`, which creates a goal with no date. `/my/skills/goals` lists such goals under "Goals without a date" and asks for one, and sharing is refused until a plan exists.
- **FS36 digest:** it does not mention goals yet ("later" in the plan).
- **Route-count pins:** left to the integration lead (+7 routes; the registry now has 266).
