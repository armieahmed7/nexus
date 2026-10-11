# fsAe2 · FS03 Honest skill states (M17) — DONE (live apply pending)

Branch `fsAe2`, worktree `/workspace/kafaa-fsAe2`, commit `7885338`. Benchmarks: WEF-FOJ, SKILLS-TECH, FORECAST (Fs03Benchmarks reads `benchmarks` when FS01 lands; fallback chips meanwhile).

## Acceptance
- [x] AC1 half_life_months via setEngineWeights / setSkillHalfLives changes confidence identically in TS and SQL (PGlite: 1924 states SQL v2 = TS = seed; with standard 24 months, 622 confidences change identically) — validator fs12-decay + unit tests
- [x] AC2 digital skill evidenced 30 months ago (0.25, low) < reactor physics same age (0.57, medium)
- [x] AC3 every person skill carries band + interval (conf_low/conf_high); Navigator readiness tile shows the band (`m18-readiness-sure`, `data-band`)
- [x] AC4 seeded awards produce credential evidence (+143 rows, 104 awards in PGlite); back-fill and recompute idempotent
- [x] RBAC unchanged: half-life change admin-only (integrations A), audited (engine_changes, ledger, cards bumped); stats aggregate-only (<10 people suppressed)
- [ ] Live Supabase apply — NOT DONE: `apply_migration` was denied by the permission classifier (see Gaps)

## Routes
- `/my/skills/confidence` (my-skills-confidence, Own): bands, filter, source record drawer, projection chart, "what would raise it", WhyThis, decay classes, method, benchmarks
- `/admin/skills-confidence` (admin, training_manager, auditor, hr_analyst, hr_director): tiles, curves, half-life editor (preview; admin save with rationale + confirm), band tables by class/area (suppressed cells), back-fill status, recompute (training manager), last change
- Passport (`/my/skills`) band column + sources in drawer; Navigator (`/my/career`) readiness band

## Tables / columns / RPCs
- `kafaa_person_skills` + `confidence_band`, `conf_low`, `conf_high`; new `kafaa_skill_decay_classes` (3 rows, public_content read)
- `engine_settings.skills` + `half_life_fast` 18, `half_life_slow` 60 (and F24 baseline `ec:skills:001` same keys)
- RPCs: `kafaa_skill_confidence_stats(p_hl)`, `kafaa_set_skill_half_lives(p)`; helpers `kafaa_skill_states_v2`, `kafaa_skill_hl_resolve/_months`, `kafaa_skill_decay_class`, `kafaa_skill_blend/_interval/_band`, `kafaa_fs03_stats`, `kafaa_fs03_backfill_award_evidence`; redefined (same signatures) `kafaa_skill_states_compute`, `kafaa_skills_apply`, `kafaa_engine_check`
- Migration `supabase/migrations/20261010212001_kafaa_fs12_decay.sql` (additive, no drop/delete)

## Tests and gates
- gen ok; check:i18n 29 namespaces parity; typecheck ok; check:public ok; build ok
- migrations:validate: all 1006 checks pass (fs12-decay 24 checks)
- vitest: fs12-decay 22 + fs12-pages 8 pass; full suite 1713 pass; the 3 real failures it found (F24 weight labels, F24 baseline, F36 digests) are fixed and those files pass; 5 page tests timed out at 30 s only under shared-machine load and pass when re-run

## Gaps
- LIVE APPLY PENDING: apply_migration to hlirqxoddysxtdezwcgv was denied by the permission classifier. Live pre-check: target function bodies match the local baseline md5 (`kafaa_skill_states_compute` 1b88641f…, `kafaa_skills_apply` 7610951f…, `kafaa_engine_check` cd29ca33…), so the migration applies cleanly once approved. Then: insert the 3 decay-class rows with on conflict do nothing, run `select kafaa_skills_apply(null, current_date)`, and check md5 of the functions against local (e.g. v2 5fabd4f6…, apply 0ddee11b…, check a50af931…)
- Live `kafaa_skills.decay_class` (FS02) overrides the area map, so live bands will differ from the local seed (as designed)
- e2e sweep / route count left to the integration lead; swap Fs03Benchmarks to BenchmarkChip after FS01; FS02 area names in i18n; career_conversations agenda drift (81 snapshots) on live
- `.runone.local.mjs` (untracked validator runner) is not committed
