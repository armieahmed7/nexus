# fsCe3 DONE: FS21 adaptive future-skills assessments + FS22 performance tasks and integrity reports

Branch `fsCe3` (worktree /workspace/kafaa-fsCe3). Not pushed.

## Acceptance

FS21 (adaptive assessments)
- [x] Same answers give the same item sequence and result, and TS matches SQL. Tests: fs33-assessment "same answers..." (fresh backend + pure-rule replay) and "every seeded attempt replays". The live load recomputed all 256 seeded attempts with the SQL engine (kafaa_ad_stop/kafaa_ad_score/kafaa_ad_norm), and the digest equals the TS-built seed (38d06a38...).
- [x] Safety-related skills never show a percentile. Safety banks run in criterion mode (meets / not yet), and the percentile is null in the seed, live attempts and the overview. Tested in the unit and page tests (data-percentile '' and m05-take-no-pct).
- [x] No item exposes secure-bank or security content. Items are future-skills only, separate from the secure item bank. The taker view never carries the key (kafaa_ad_item_view), and the test scans every item for security terms.
- [x] Extras:
  - Percentiles are suppressed when fewer than 10 colleagues are in the norm group.
  - Stop rule: the estimate is stable over the window after the minimum, or the test stops at the 20-item cap.
  - Forms rotate first items between people.
  - The retake rule, resume and refusals are enforced.
  - F01 evidence is written, capped at level 3.
  - BenchmarkChips (OECD/WEF reference lines from kafaa_benchmarks) and <WhyThis> are shown on results.

FS22 (performance tasks and integrity)
- [x] Every rubric line is visible before the attempt. The task page shows the rubric first. Start is disabled until "I have read the rubric" is ticked, and the RPC refuses to start without rubric_seen.
- [x] Gating attempts always carry an integrity report:
  - A table check requires integrity_id when gating.
  - Submitting builds the report.
  - Scoring refuses `integrity_missing` if the report is absent, in both local and SQL.
  - Seed: 105 reports, 11 flagged.
- [x] All data is synthetic, with no plant/OT connection. Tasks are flagged SIMULATED and contain numbers and labels only, with no URLs or tags. Tested.
- [x] Extras:
  - Assessors score attempts but never their own.
  - An unsafe decision fails whatever the total.
  - A pass writes evidence.
  - Integrity review: auditors read only, assessors accept or void with a reason, and voiding withdraws the evidence and sets counts=false.

## Routes (+7, route-count pins left to the integration lead)
- /my/assessments/adaptive
- /my/assessments/adaptive/:bank
- /my/assessments/tasks
- /my/assessments/tasks/:task
- /training/adaptive (secure_items W/A; the training manager writes)
- /training/perf-tasks (signoff A)
- /training/integrity (instructor, training_manager or auditor; the auditor is read-only)

All routes have EN and AR (RTL) titles and purposes.

## Data
- Migration: supabase/migrations/20261010233001_kafaa_fs33_assessment.sql.
- Tables (7): kafaa_adaptive_banks, kafaa_adaptive_items, kafaa_adaptive_attempts, kafaa_performance_tasks, kafaa_perf_task_keys, kafaa_task_attempts, kafaa_integrity_reports. All have RLS and check constraints.
- RPCs (9): each exists as a TS signature, a local implementation and an SQL SECURITY DEFINER function with the supabase mapping. Execute is revoked from public/anon and granted to authenticated.
  - kafaa_adaptive_overview, kafaa_start_adaptive, kafaa_answer_adaptive, kafaa_adaptive_stats, kafaa_save_adaptive_item
  - kafaa_start_performance_task, kafaa_submit_performance_task, kafaa_score_performance_task, kafaa_review_integrity
- Rule helpers: kafaa_ad_*, kafaa_pt_*, kafaa_ir_*.
- Shared redefinition: kafaa_skill_states_v2 and kafaa_skills_apply, with the ref_table lists widened to adaptive_attempts and task_attempts. This is logged in the CONTRACT.md Changelog.
- Seed: scripts/seed/ext/fs21-assessment.mjs
  - 6 banks and 100 items
  - 4 tasks with keys
  - 256 adaptive attempts and 39 task attempts
  - 105 integrity reports
  - 816 evidence rows
  - synthetic people only
- Validator: scripts/validate/fs33-assessment.mjs (PGlite).

## Live (Supabase hlirqxoddysxtdezwcgv; additive kafaa_* only, no DROP/DELETE)
- The migration was applied in 5 parts (part1 tables/rls/checks, part2 recorded evidence, part3a FS21 rules, part3b FS22 rules, part4 rpcs/grants).
- Seed rows were loaded with `on conflict do nothing`. Derived fields were recomputed by the SQL engine.
- Row digests, live compared with local, are all equal:

  | Table | Rows | md5 |
  |---|---|---|
  | adaptive_banks | 6 | 28cc03d3 |
  | adaptive_items | 100 | a3218311 |
  | performance_tasks | 4 | 0e140371 |
  | perf_task_keys | 4 | 116d20b7 |
  | adaptive_attempts | 256 | 38d06a38 |
  | task_attempts | 39 | 14333e9d |
  | integrity_reports | 105 | 8c99dd42 |
  | skill_evidence (my ref_tables) | 816 | e2370039 |

- Function bodies: 38 functions, md5 e4aaea624e133213f8b40f81ce627549, identical on live and PGlite. On the 9 RPCs, anon has execute on 0 and authenticated on 9.
- kafaa_skills_apply was run live for the 102 seeded people at 2026-10-08. Live person_skills for them is now 2327:4568ba07..., while local is 2270:8d3eec48.... This is expected: the live baseline before the load was 1834 rows, not the local 2270, because other waves' evidence is not live yet. On PGlite, the same chunked path reproduces 8d3eec48 exactly.

## Tests
- tests/unit/fs33-assessment.test.ts: 20 tests (FS21/FS22 acceptance, rules, RBAC, routes, i18n). All pass.
- tests/unit/fs33-pages.test.tsx: 11 page tests (EN + AR, personas k-ro, buyer, k-instructor, k-auditor, training-mgr). All 11 pass.
- Shared tests updated for the widened evidence: fs11-catalogue, fs12-decay, w0-skills, fsqa1-integration.

## Gates
Commit `ccc4eb3` on fsCe3 (not pushed). Gate results:

- **Pass:**
  - gen: no diff, generated files are stable.
  - check:i18n: 40 namespaces, en/ar in parity.
  - typecheck: clean.
  - migrations:validate: all 1371 checks pass, including fs33.
  - check:public: clean.
  - build: OK.
- **Unit suite (114 files, run in memory-safe chunks):** everything passes except 5 route-count pins, which now see 234 routes instead of 227 because of the 7 new routes. Updating them is left to the integration lead:
  - fs11-foundation
  - fsqa1-integration
  - fsqa2-integration
  - w4-integration
  - w5-integration
- **Shared checks adjusted for the new evidence** (logged in CONTRACT):
  - fs24-future-readiness validator and fs24-readiness AC1: families that are already fully evidenced are excluded.
  - w1e3-coach: the "Not relevant" check now covers ld-01 suggestions of any kind.

## Gaps / hand-offs
- FS31: count only attempts with counts=true and an integrity report that is not voided. Skills: MC-AI-LIT, MC-TWINS, MC-DIGITAL-PLANT (CONTRACT changelog).
- The integration lead owns the route-count pins, and the shared SQL redefinition of kafaa_skill_states_v2/kafaa_skills_apply must be kept in the merge order.
- Playwright/E2E was not run (by instruction).
