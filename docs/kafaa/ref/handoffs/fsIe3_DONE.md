# fsIe3 DONE · FS81 Transition plans and ladder-rung protection (FS wave I · E3, M30)

Branch `fsIe3` (stacked on `fsH-integration-qa`), worktree `/workspace/nexus-fsIe3`. Live Supabase was not used: nothing was applied live.
CONTRACT changelog entry: "2026-10-12 · FS wave I · E3" in `kafaa/CONTRACT.md`.

## Acceptance (card FS81 + handover adjustments) with the test that proves each

| Criterion | Proved by |
|---|---|
| Every alert names the tasks and the practice added | `tests/unit/fs93-transition-plans.test.ts` › "FS81 acceptance: every alert names the tasks and the practice added"; `tests/unit/fs93-pages.test.tsx` › "FS81 acceptance: my plan is labelled SIMULATED, carries review dates and names every alerted task with the practice added" and "FS81 acceptance (ladder-rung alert): HR activates the draft only after adding practice for every alerted task"; PGlite `fs93-transition-plans.mjs` › "acceptance (FS81 every alert names the tasks and the practice added)" and "acceptance (FS81 ladder-rung alert): activating a plan without practice for every rung task is refused" |
| Plans are visible to the person and HR only | `fs93-transition-plans.test.ts` › "FS81 acceptance: plans are visible to the person and HR only (managers in scope, training manager, HR analysts, auditors and admins get nothing)"; `fs93-pages.test.tsx` › "FS81 acceptance: plans are visible to HR only: the HR director sees the board; a manager, the training manager and an HR analyst get nothing"; PGlite › "acceptance (FS81 plans are visible to the person and HR only), RLS: …", "RPC reads: …", "RLS: the per-statement policy form, and no rule names transformation" |
| Plans are labelled SIMULATED and carry review dates | `fs93-transition-plans.test.ts` › "FS81 acceptance: plans are labelled SIMULATED and carry review dates"; `fs93-pages.test.tsx` (SIMULATED HR record chip, review timeline); PGlite › "acceptance (FS81 plans are labelled SIMULATED and carry review dates)" and "database checks: a plan is always SIMULATED, carries review dates and an active plan has a next review" (check constraints) |
| rungAlert() TS = SQL | PGlite › "SQL kafaa_tp_rungs = rungsBelow() and kafaa_tp_alert = rungAlert() for all 39 roles x 2 horizons", "kafaa_tp_options = practiceOptions() … kafaa_tp_plan_alert = planAlert() …", "kafaa_tp_problem = planProblem() on 61 generated inputs", "kafaa_tp_progress / kafaa_tp_date / kafaa_tp_reviews_ok", "HR editor reads: candidates / preview"; unit › "FS81 rules (TS = SQL in PGlite)" (3 tests) |
| Inputs: FS11 maps + archetypes, FS06 exposure; practice = F28 `sim_scenarios` or F38 `ojt_logs` | unit › "rungAlert: junior tasks are the rungs below plus own routine tasks …" and "practiceProgress counts OJT repetitions acknowledged by a preceptor since the plan started" |
| RBAC: transformation A (HR), Own for the person; managers get nothing (settled decision) | unit "plans are visible …" (schema read rule, grants, route guards); "saveTransitionPlan: HR only, never on their own plan …"; PGlite "saveTransitionPlan: HR (transformation A) only …" |
| Maker rules: one open plan per person, HR never decides their own plan, reviews, closing, acknowledgement | unit "saveTransitionPlan: …", "reviewTransitionPlan, closeTransitionPlan and acknowledgeTransitionPlan follow the same rules as SQL"; pages "the person acknowledges their active plan once …", "HR records the overdue review …"; PGlite flows (review, close, acknowledge) |
| EN + AR, RTL | unit "i18n: every FS81 key exists in English and Arabic, and the Arabic is Arabic"; pages "Arabic: my plan renders in Arabic" |

## Routes (+4; 380 -> 384, pins left to the integration lead)

- `my-transition-plan` `/my/transition-plan` (staff guard `transformation` R/Own; nav my/future 24) — `MyTransitionPlanPage`
- `workforce-transition-plans` `/workforce/transition-plans` (`grant: transformation A`; nav my/workforce 69.5) — `WorkforceTransitionPlansPage` (board + `PlanEditor`)
- `workforce-transition-plan` `/workforce/transition-plans/:planId` (`grant: transformation A`; smoke param `tp-p-k-ro-1`) — `TransitionPlanPage`
- `workforce-rung-alerts` `/workforce/rung-alerts` (`transformation` Agg/W/A; names no person; nav my/workforce 69.6) — `RungAlertsPage`
- Entry links (M30, own folder): `/my/role-2030` -> my plan; `/workforce/transformation` -> rung alerts (and plans for HR A).

## Tables and RPCs

- Table `kafaa_transition_plans` (M30; read rule `own_profile` Own on `person_id` only; write rpc). Check constraints `kafaa_transition_plans_{simulated,reviews,active_review,dates}_ck`.
- RPCs (authenticated only): `kafaa_transition_plan_view(text)`, `kafaa_transition_plans()`, `kafaa_rung_alerts(text)`, `kafaa_transition_candidates()`, `kafaa_preview_transition_plan(jsonb)`, `kafaa_save_transition_plan(jsonb)`, `kafaa_review_transition_plan(jsonb)`, `kafaa_close_transition_plan(jsonb)`, `kafaa_acknowledge_transition_plan(text)`.
- Internal helpers (no API role executes them): `kafaa_tp_date, _position, _hrank, _mastery, _rungs, _options, _junior, _alert, _plan_alert, _reviews_ok, _int, _text_ok, _done, _next, _problem, _msg, _clean_retraining, _clean_practice, _progress, _review_state, _view, _notify, _hist`.
- Reused, not redefined: `kafaa_rt_tasks`, `kafaa_rt_reason`, `kafaa_rt_str`, `kafaa_rt_banned`, `kafaa_rt_path_only` (FS11), `kafaa_fx_exposure` (FS06 via `kafaa_rt_tasks`).
- Shared write: `kafaa_notifications` (kind `transition`, id `nt-tp-<plan>-r<revision>`, link `/my/transition-plan`) through `kafaa_tp_notify` only. No skill evidence, no evidence ref_table, no shared function redefined, `RECORDED_REF_TABLES` unchanged, no policy change, no engine card (no ranked surface).

## Local md5 of every new function body (PGlite, `md5(prosrc)`, after all migrations + seed applied twice)

| function | md5 |
|---|---|
| kafaa_acknowledge_transition_plan | 3bc841af6d2b91049ad024ecfdc47b1c |
| kafaa_close_transition_plan | d8b04cf5a11394d4277df9a6c90d4463 |
| kafaa_preview_transition_plan | ea569cc05b04e46aa1f29073fe961e03 |
| kafaa_review_transition_plan | c25811cb7981f1cea9164ac78059b034 |
| kafaa_rung_alerts | d9fb2963310015119166a2de64a4d0fc |
| kafaa_save_transition_plan | 42256e869560377239b8106ec60acb37 |
| kafaa_tp_alert | c4f02e16aa00729411276fea7b1c28d1 |
| kafaa_tp_clean_practice | 63bbc6d060f98c8937c1076ada733dee |
| kafaa_tp_clean_retraining | 121aa7c592d6eed10fe80ec8dd44474d |
| kafaa_tp_date | 152f771a5764ad954f91edd76c89fc12 |
| kafaa_tp_done | c2a92763acc28730f24ab3e133e7465c |
| kafaa_tp_hist | 07cd610c2e46d47590936c17861490c3 |
| kafaa_tp_hrank | 195d02a755cc56f94d292928adb83249 |
| kafaa_tp_int | 61427e8623a9a06b603cce636ec9d5a1 |
| kafaa_tp_junior | e3dd9599f4813cf03a1a41c7bec7698c |
| kafaa_tp_mastery | 67c7def2b8551820b5cfa905e45330ca |
| kafaa_tp_msg | 3d99b158b3966ec1bee6954cdf5b5164 |
| kafaa_tp_next | eae9ee5a688f599fb0170fef170a9d88 |
| kafaa_tp_notify | 0158250f8906f92e70e248f5fd5b038c |
| kafaa_tp_options | 714931d70279a278ad6eed6c813c8a07 |
| kafaa_tp_plan_alert | f562d82ae8117e086f3d7fad95afc7de |
| kafaa_tp_position | f1b74b93ee494901f3402b30d7efd570 |
| kafaa_tp_problem | 44d8bb09064228ef1e9f0194f3f202d7 |
| kafaa_tp_progress | 654cd4ccbf5a2724ea5d5572c2c9f658 |
| kafaa_tp_review_state | d8a9bc7803985a2029c3544e5c4c6dee |
| kafaa_tp_reviews_ok | 0bff76a60d6ff4f8d2cf676cda4426d2 |
| kafaa_tp_rungs | 84c97c7e600a158a6f8e5290b9d21d3e |
| kafaa_tp_text_ok | 28a5e1e231755b2895517c098584e070 |
| kafaa_tp_view | 8c9e1bbfc877e32377256f8c28afeb32 |
| kafaa_transition_candidates | e205bf64273748bdab96a5e7f11c7107 |
| kafaa_transition_plan_view | ad0c7b221fb13bc989596918add0e8e7 |
| kafaa_transition_plans | b4ca08d7f5b305c4bd80b961b01fe7d7 |

## Table digest (`count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`, PGlite over the generated seed)

| table | rows | digest |
|---|---|---|
| kafaa_transition_plans | 10 | f9b81835 |

Seed: 10 new rows, no other table changed (37,290 -> 37,300 rows, 356 -> 357 tables); load with `insert ... on conflict (id) do nothing` (supabase/seed.sql rows). **No guarded UPDATE of existing live rows.** Live-apply part names (suggested): `kafaa_fs93_transition_plans_p1` (the whole migration, about 53 KB) + one seed part for the 10 rows.

## Tests and gates (run from `kafaa/`, one vitest process at a time, TMPDIR=/dev/shm)

All passed on the final tree (2026-10-12):

| gate | result |
|---|---|
| `npm run gen` | rc 0, no diff (generated seed.json, seed.sql, types.gen.ts unchanged) |
| `npm run check:i18n` | 40 namespaces, en/ar in parity |
| `npm run typecheck` | rc 0 |
| `npm run check:public` | 77 public tables, no personal columns; 40 benchmarks and 120 skills cite https sources |
| `npm run migrations:validate` | "All migration checks passed"; the FS93 block (`scripts/validate/fs93-transition-plans.mjs`) runs 62 checks, all passing |
| `npx vite build` | built (NODE_OPTIONS=--max-old-space-size=6144; the default heap OOMs in this shared container) |

Unit tests (each file alone, `--maxWorkers=1 --minWorkers=1`):

| file | result |
|---|---|
| `tests/unit/fs93-transition-plans.test.ts` (new) | 12/12 |
| `tests/unit/fs93-pages.test.tsx` (new) | 8/8 |
| `tests/unit/fs23-role-transformation.test.ts` (affected: M30 i18n copy check, shared M30 backend) | 16/16 |
| `tests/unit/fs23-pages.test.tsx` (affected: `/workforce/transformation`, `/my/role-2030` entry links) | 8/8 |
| `tests/unit/m14-rbac.test.ts` (affected: new table in the read-rule matrix) | 291/291 |
| `tests/unit/fs63-engine-lint.test.ts` (no ranked surface added) | 13/13 |
| `tests/unit/w3e5-no-protected-inputs.test.ts` (no protected inputs in the rules) | 71/71 |

Note: the FS81 error copy for `banned_wording` in `m30.{en,ar}.json` is phrased without the banned words themselves, so the FS12 copy check over the M30 namespace (`fs23-role-transformation` "flat EN and AR files" / copy-check tests) stays clean. Route-count pins were not touched (left to the integration lead), so `tests/unit/*route*` pin tests are expected to read 384 after the lead updates them.

## Decisions applied and logged

- **FS81 visibility (settled):** person and HR only. The table's only read rule is `own_profile` Own; HR (`transformation` A = the HR director) reads through the RPCs; managers in scope, the training manager, HR analysts (Agg), auditors and admins read nothing. Deviation from the `src/auth/policy.ts` comment ("managers their team's transition plans") logged in CONTRACT; no grant change.
- HR = `transformation` A as the card says (the HR director / CHCO office). HR analysts are not decision-makers here. The HR director cannot decide their own plan (`self_plan`).
- "Training managers" (card "For") get the role-level ladder-rung alerts page, which names no person.
- The alert of a plan is computed for the target role when it is a Mastery Builder role, else for the protected role (the person still works in it). "Junior tasks" = rated tasks of the rungs below (vertical career moves into the role) + the role's own non-critical tasks that FS06 moves to tools (`automate_partly`) by the plan horizon.
- No figure or external fact typed into copy; benchmarks only through `<BenchmarkChips feature="FS81" />` (SSG-SF, SG-JTM, CORP). Concept target roles carry "no deployment decision implied". Synthetic people only (role cards and `w-*` workers).
- No engine card: practice options are an eligibility rule (coverage order) shown with `<WhyThis>`, not a ranking of people; no `rank*`/`match*`/`suggest*` export, no `Ranked` type (FS55 lint unchanged).

## Gaps and hand-offs for the integration lead

1. Route-count pins 380 -> 384 (+4 M30: `my-transition-plan`, `workforce-transition-plans`, `workforce-transition-plan`, `workforce-rung-alerts`) in the 11 pin files incl. `tests/e2e/sweep.spec.ts`.
2. Live-apply bundle part for `20261010293001_kafaa_fs93_transition_plans.sql` and the 10 `kafaa_transition_plans` seed rows; expected md5s/digest above; no row updates. The seed rows reference `p-chco` and synthetic people only.
3. Wave I wiring "FS81 <- FS11/FS06: rung alerts name tasks and the simulator/OJT practice added (F28 in M04, F38 in M02)": done inside FS81 (reads only); nothing to wire unless the lead wants a link from `/training/simulator` (M04) or the OJT logbook (M02) to `/workforce/rung-alerts`.
4. Optional: update the `transformation` comment in `src/auth/policy.ts` (managers do not see transition plans); optional F36 digest item for HR when a plan review is due (not on the card).
5. Demo personas: on Supabase the person view is demoable with `sro` (shift supervisor, protected-role alert) and `qc-inspector` (no alert); `k-ro` and `k-lo-trainee` are local-only personas. HR demo: `chco`. The overdue review (w-lo-02, 2026-10-01) and the due-soon review (sro, 2026-10-20) depend on the run date.
6. Plans keep `person_id`; the HR board shows synthetic display names (HR only).
