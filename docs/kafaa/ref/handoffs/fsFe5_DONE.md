# fsFe5 DONE: FS58 Adaptive problem-solving practice + FS59 Role-play practice library with saved feedback (M33)

Branch `fsFe5` (worktree `/workspace/nexus-fsFe5`, off `fsE-integration-qa`). Code commit `ed3af63`, then this file. Live Supabase was not touched (not available). Netlify was not touched. Nothing was pushed to `main` or `fsE-integration-qa`.

## Acceptance

### FS58 · Adaptive problem-solving practice
- [x] **Every scenario has at least one mid-task change.** 7 scenarios (6 published, 1 draft), each with a plan stage and 1-3 change stages. The rule (`apsScenarioProblem` = SQL `kafaa_aps_problem`) refuses `no_change`; the DB check `kafaa_aps_scenarios_change_ck` refuses it too. The change is revealed only after the previous answer.
  - Test: `fs65-aps-roleplay.test.ts` › "every scenario has at least one mid-task change (seed, the rule, the save RPC)".
  - Test: `fs65-aps-roleplay.test.ts` › "the change is revealed only after the previous answer, and the key only after each answer".
  - Page test: `fs65-pages.test.tsx` › "problem-solving practice end to end: ..." (each stage's `data-kind`; the change text is not in the DOM before the plan is answered); "the scenario bank: ..." (the editor shows the no-change problem before saving).
  - PGlite: `fs65-aps-roleplay.mjs` › "acceptance FS58: the database refuses a scenario without a mid-task change"; "RPC kafaa_save_aps_scenario: ... one without a mid-task change is refused".
- [x] **Results never gate a qualification.** A full run changes only `aps_attempts` and `audit_events`: no skill evidence, no qualification or authorisation table, no ledger. No qualification, talent-review or authorisation function reads the practice tables.
  - Test: "results never gate a qualification: a full run writes only the practice row and an audit row (no evidence, no qualification, no ledger)".
  - PGlite: "acceptance FS58: results never gate a qualification: no skill evidence, no qualification record, no ledger entry"; "only FS58/FS59 functions read the practice tables (13); no talent-review or qualification function does".
- [x] **Each result shows a benchmark line and the scale definition.** The result card shows the score on `BenchmarkLine` with the ENEC average (suppressed under 10), the four-band scale with fixed cut points and how points are earned, and `<BenchmarkLine benchmark={{ id: 'OECD-PIAAC', figure: 'aps_oecd_average' }}>` (251 on 0-500) as context only, with the note that it is a different scale and is never converted.
  - Test: "each result shows a benchmark line and the scale definition: bands cover 0-100, the PIAAC figure is in the registry".
  - Page test: "problem-solving practice end to end: ..." (`m33-aps-line` holds a `benchmark-line`, `m33-aps-result-piaac`, `m33-aps-scale` marks the band); "renders in Arabic with the scale definition and the PIAAC context note".
- [x] **RBAC: Own; Agg for HR; the bank is secure_items (instructors read, the training manager writes).** Other people's runs are invisible and cannot be submitted to. HR gets the suppressed aggregate. A line manager gets nothing.
  - Test: "Own only: nobody else reads my runs or submits to them; HR gets the aggregate, a line manager nothing; only the training manager edits".
  - PGlite: RLS checks; "RPC kafaa_aps_stats: HR aggregate only; a line manager gets nothing"; "RPC kafaa_submit_aps: refuses ... another person's run".
- [x] **Mirrors FS26 SJT with `<WhyThis>`.** The result has reasons (score and band, strongest dimension and the one to develop, changes handled, held or overreacted, private). The suggestion has reasons too and ranks content, never people.
  - Tests: "scoring: half-up percentage, three dimensions, overreacting and holding are both scored"; "the suggestion ranks content, never people ...".

### FS59 · Role-play practice library with saved feedback
- [x] **Feedback history persists and is visible only to its owner.** Sessions keep per-turn ticks and word counts in `roleplay_sessions` (RLS `own_profile`). Line managers, HR, the training manager (even as reviewer), instructors, auditors and admins read none of them. A named reviewer sees only a session sent to them, through `roleplayReviewQueue`: the ticks, the rubric and the person's context, never the answers.
  - Test: "feedback history persists and is visible only to its owner" (the LocalBackend snapshot reads back in a new backend; six other personas see none of it).
  - Page test: "my feedback history (k-ro): two sessions, ticks without words, ask a named reviewer, then withdraw".
  - PGlite: "acceptance FS59: feedback history is visible only to its owner: ...".
- [x] **Speak-up topics route to the existing channel and are never stored.** `speakUpTopic()` (= SQL `kafaa_rp_speak_up`) runs in the browser before any request: the page shows the speak-up callout with a link to M08's `/speak-up` and sends nothing. The RPC runs the same check first and returns `speak_up` (route `/speak-up`) with no session change, no audit row, no ledger and no notification. The same applies to the review context. No telemetry.
  - Test: "speak-up topics route to the existing channel and are never stored: no row, no audit, no ledger, no text anywhere (no telemetry)" (every table snapshot is identical before and after).
  - Page test: "a session: ticks per answer and the box clears; a speak-up topic routes to /speak-up and sends nothing" (spy on `rpc.roleplayTurn`: not called).
  - PGlite: "acceptance FS59: a speak-up topic routes to the existing channel and is never stored: no session change, no audit row, no text anywhere".
- [x] **Every scenario has a published rubric in EN and AR.** 7 scenarios, 3-8 criteria each, with label, what it looks for and a tip in both languages. The library shows each rubric in English and in Arabic (RTL) side by side. The example answers meet every criterion in both languages.
  - Test: "every scenario has a published rubric in EN and AR"; "the example answers meet every criterion in both languages; ...".
  - Page test: "the library: six published scenarios; each rubric in English and Arabic".
- [x] **Attachable as evidence after the reviewer validates (reviewer A).** Only the reviewer the person named (recognition A: instructor, training manager, HR authority) can decide, and never on their own session. A decline needs a reason. Validation writes `se:roleplay:<session>:<skill>` (kind `rating`, basis `validated`, level 1-2, `ref_table 'roleplay_sessions'`, handover 3.9) and re-derives the skills (`kafaa_skills_apply`). It writes one ledger row and notifies the person.
  - Tests: "review: a named eligible reviewer only (never myself); only that reviewer decides; maker-checker; a decline needs a reason"; "attach after validation: rating evidence, basis validated, ref_table roleplay_sessions (handover 3.9), skills recomputed, one ledger row".
  - Page test: "the reviewer (training manager): the session sent by name with ticks, rubric and context; validate writes the evidence".
  - PGlite: "RPC kafaa_attach_roleplay_evidence: ..."; "attach as evidence after validation: ..."; "handover 3.9: the final kafaa_skill_states_v2 / kafaa_skills_apply keep roleplay_sessions with every earlier recorded ref_table".
- [x] **The answer text is never stored.** Only ticks and word counts are kept.
  - Test: "the example answers meet every criterion ...; text is never stored"; page test (no example text in `roleplay_sessions`).
  - PGlite: "RPC kafaa_roleplay_turn: ticks equal evaluateTurn(); ... the answer text is never stored".

### Both
- [x] Every page shows `<BenchmarkChips feature="FS58|FS59" />` (OECD-PIAAC and IAEA-1917; SKILLS-TECH and IAEA-1917). Full EN and AR (logical classes, `useFormat`). Both backends (LocalBackend and the Supabase mappings for the 15 RPCs). No points-as-reward, streaks, badges or leaderboards. No regulatory claims.
  - Test: "seven routes with the right guards and chips; EN/AR parity; no gamification wording; no regulatory claims"; the HR page test ("... with both features chips").

## Routes (+7)
| id | path | guard |
|---|---|---|
| `my-problem-solving` | `/my/core-skills/problem-solving` | skills_profile Own |
| `training-aps-scenarios` | `/training/aps/scenarios` | secure_items W/A |
| `learn-role-play` | `/learn/role-play` | internal_content R |
| `my-role-play` | `/my/role-play` (`?tab=history`, `&review=<session>`) | skills_profile Own |
| `my-role-play-scenario` | `/my/role-play/:id` (smoke `rp-st-01`) | skills_profile Own |
| `training-role-play` | `/training/role-play` (`?tab=reviews|library`) | recognition A |
| `workforce-core-practice` | `/workforce/core-skills/practice` | skills_profile Agg |

## Tables and RPCs
- Tables: `kafaa_aps_scenarios`, `kafaa_aps_attempts`, `kafaa_roleplay_scenarios`, `kafaa_roleplay_sessions` (DDL generated plus check constraints, RLS perf form, grants).
- RPCs: `kafaa_start_aps`, `kafaa_submit_aps`, `kafaa_aps_context`, `kafaa_aps_stats`, `kafaa_save_aps_scenario`, `kafaa_start_roleplay`, `kafaa_roleplay_turn`, `kafaa_roleplay_context`, `kafaa_roleplay_reviewers`, `kafaa_request_roleplay_review`, `kafaa_withdraw_roleplay_review`, `kafaa_roleplay_review_queue`, `kafaa_attach_roleplay_evidence`, `kafaa_roleplay_stats`, `kafaa_save_roleplay_scenario` (authenticated only). Helpers `kafaa_aps_*` and `kafaa_rp_*` are not executable by API roles.
- Shared redefinition: `kafaa_skill_states_v2`, `kafaa_skills_apply` (newest bodies from `20261010259001_kafaa_fs5qa_integration.sql`; only the two `ref_table` lists gain `'roleplay_sessions'`).

## Local function md5s (md5(prosrc), PGlite after every migration and seed.sql)
Migration `supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql` (55 functions created or redefined; no overloads).
```
kafaa_aps_band f89d54d1a26df76e1838e4b5e2029e1f
kafaa_aps_band_name 55c0d907fde66dbd97ee8e848afbf624
kafaa_aps_changes 21dc95d4dd3156a9139d857567580959
kafaa_aps_context 2fe063d62f3275902eab314095b823cb
kafaa_aps_dim_name ce253ae99b973b4a02238dee2dd63082
kafaa_aps_header 73d8600d1d1298cdb3376819333debc9
kafaa_aps_int 514b7844fae3de761499c25fa534fecc
kafaa_aps_judge 446a1530ef7e8f492b6b7cfae7e6f7e3
kafaa_aps_next_reasons 88a3404ef03cd44e957b2ba2af3b9954
kafaa_aps_pct 77d95a4d9c0df7e929a06653734735b7
kafaa_aps_pick 171f658ea6d97146f265ddd56d7debcb
kafaa_aps_problem b75a1cc3a207b9b88a0541e94b8508fa
kafaa_aps_response 9b11f5a0c4805bd617fe5464c44c49dc
kafaa_aps_result 62a0d6e2ea3b35a275db7c395a6886aa
kafaa_aps_score f31d08f9a7e2e1dd92e97b3cc1fc545a
kafaa_aps_stage 2ecdc1569278404dc689c4a70abf7b1c
kafaa_aps_stage_view 6f13ec07eb9e665c5890357ae219eedf
kafaa_aps_stats 166ad63bbcb05bbba4750616db1f479f
kafaa_aps_stats_core 84b114735e1c75082ebccd780ff1b026
kafaa_aps_theme_name d74c9ee61499c5139c8d5b1f1882e365
kafaa_aps_txt 05e3a65c6a05d255a8856f0a1e9a6abf
kafaa_attach_roleplay_evidence 282620ae776f1bfabdf32536218632da
kafaa_request_roleplay_review dca95d6846f338b50e8908ed4eaa6af5
kafaa_roleplay_context 8528e048dc905def78011d33071dba94
kafaa_roleplay_review_queue 6dd4189c557dd18ae7c834383fd747c0
kafaa_roleplay_reviewers 5954c8c3bdacdada4bfbbdaee33487ae
kafaa_roleplay_stats 89e5001aa7988c6cd30b8952040bc942
kafaa_roleplay_turn a9c1d9788702660938a6ec52d8a84f59
kafaa_rp_check c77c95df22a3d124ad6ae68e3a600480
kafaa_rp_check_problem bfb4f786fdeaae0f6249c0ad5f07017b
kafaa_rp_cue_hit 01710e9c876fcb960578ee735dfd4819
kafaa_rp_cue_key cad4e0df5a53fb640258a1eca4678f6f
kafaa_rp_eval 2edde5d45d0e5a3602d6a618ba2401d9
kafaa_rp_evidence_skills 569b779e1c25e90d7a5b83ac13b35603
kafaa_rp_norm 6d528bfb27d148aeb55f6606ce67d706
kafaa_rp_notify e9b057844fd6747686e4ce9263250034
kafaa_rp_pct 229e85b5d645ddee92fe4b396c1c9fba
kafaa_rp_problem 516e3d6d64965bc16de525248609f5b0
kafaa_rp_queue_item b0dbb766c1925007e4508384175d1c77
kafaa_rp_result 18b60ddbb29fb8822ea0b7734b449a85
kafaa_rp_reviewers 80eb8c6b99c29ebafd86e418c2fc49f0
kafaa_rp_role_of 5988aeb664a2f99c666f5a516541e460
kafaa_rp_speak_up 0bb1fefe7ea6d6cc7e939e74d96df829
kafaa_rp_stats_core 5c2108dfd2236e0c25ba66ded913dcec
kafaa_rp_summary 795ff5791d77c5dfd4548f9ad92f60c6
kafaa_rp_txt 05e3a65c6a05d255a8856f0a1e9a6abf
kafaa_rp_words 8bb75ce153b9d05eb3b400bf75ee16c9
kafaa_save_aps_scenario 0bf873f39ca7bd4b68481a5c417f6eba
kafaa_save_roleplay_scenario 7455666a1a7156cd4b449b41ecfa20ee
kafaa_skill_states_v2 6beb9870b28196ae60892c7a2a932a19
kafaa_skills_apply aef7f55da8c445b49e3290b1e74367cb
kafaa_start_aps 0293eaaf2b004fea61b021c5a73a04c5
kafaa_start_roleplay 561735eda50aca773b720d0085bb6b44
kafaa_submit_aps b98007cd8bc7b0f322ebe41ee62a4082
kafaa_withdraw_roleplay_review 1aeb5690332293eed00330130b5500c3
```
`kafaa_aps_txt` and `kafaa_rp_txt` share a body (same text helper), so their md5s are equal.

## Table digests (count, left(md5(string_agg(to_jsonb(t)::text, '|' order by id)), 8))
```
TABLE kafaa_aps_scenarios 7 5cfbeede
TABLE kafaa_aps_attempts 154 6ff303f1
TABLE kafaa_roleplay_scenarios 7 09e5ad7f
TABLE kafaa_roleplay_sessions 94 57efb889
ROWS evidence roleplay_sessions 26 be756eff
ROWS notifications nt-rp-* 23 c0115161
ROWS person_skills all 3105 f23c8251
```
- `notifications nt-rp-*` holds 23 rows: the 19 FS59 rows (kind `roleplay`) and 4 earlier rows whose ids happen to start with `nt-rp-`.
- `person_skills all` is the whole table after the FS59 evidence was re-derived (versus `fsE-integration-qa`: 18 new person-skill states and 8 existing states re-derived with the new role-play evidence; the original 71-skill states are unchanged).
- Seed: `build-seed: 34731 rows across 316 tables`. The seed builder changes only `aps_scenarios` (7), `aps_attempts` (154), `roleplay_scenarios` (7), `roleplay_sessions` (94), `skill_evidence` (+26), `person_skills` (+18 new, 8 re-derived) and `notifications` (+19).

## Tests
- `tests/unit/fs65-aps-roleplay.test.ts`: 16 tests, all pass (jsdom; the acceptance tests are named above).
- `tests/unit/fs65-pages.test.tsx`: 8 tests, all pass.
- Directly affected suites, run one file at a time: `w0-skills` 14/14, `fs11-catalogue` 13/13, `fs12-decay` 22/22, `fs35-pages` 9/9, `g3-routes` 271/271. Route pins only (see hand-offs): `fs35-core-skills` 21/22 (the M33 route-id list), `fsqa1-integration` 17/18 and `fsqa5-integration` 15/16 (315 -> 322).
- PGlite: `scripts/validate/fs65-aps-roleplay.mjs` all passed. The shared validators `fsqa5-integration`, `fs11-foundation`, `fs12-decay`, `w0-skills` and `fsqa1-integration` all passed with the widened list and the new seed.

## Gates
Run from `kafaa/` on 2026-10-12:
- `npm run gen`: no unexpected diff (`build-seed: 34731 rows across 316 tables; 57 personas`). Only `seed.json` `meta.generated_at` moves with the date.
- `npm run check:i18n`: 40 namespaces, en/ar in parity.
- `npm run typecheck`: clean.
- Unit: own files 16/16 and 8/8; affected files as listed above (failures are route pins only).
- `npm run migrations:validate`: "All migration checks passed" (includes `fs65-aps-roleplay.mjs`).
- `npm run check:public`: 75 public tables, no personal columns.
- `npx vite build`: built.
- Playwright and browsers were not run (not allowed).

## Gaps
- No Playwright or browser run (not allowed in this task). Pages are covered by jsdom tests only.
- Live Supabase was not available. Nothing was applied live.
- The scenario editors (FS58 bank, FS59 library) edit the scenario as checked JSON. Every field is validated by the same rule as the server, and the server re-checks and audits every save. There is no field-by-field form builder.
- A role-play answer is checked by the deterministic rubric only. There is no model scoring and no free-text feedback beyond the published tips and example answers.

## Hand-offs for the integration lead
1. **Route-count pins 315 -> 322** (+7 M33 routes): `fs11-foundation`, `fsqa1/2/3/4/5-integration`, `w4-integration`, `w5-integration`, `tests/e2e/sweep.spec.ts`. The M33 route-id list in `tests/unit/fs35-core-skills.test.ts` › "six routes with the right guards ..." also needs the 7 new ids appended (in `routes.ts` order).
2. **Handover 3.9 union:** the FS65 migration redefines `kafaa_skill_states_v2` / `kafaa_skills_apply` from the fs5qa bodies, with `'roleplay_sessions'` appended to both `ref_table` lists. If other wave-F engineers redefine them too, union the lists in the wave QA migration and keep `'roleplay_sessions'`.
3. **Passport and evidence labels:** `ref_table 'roleplay_sessions'` (kind `rating`, basis `validated`) may need a label in the passport or evidence views (for example "Validated role-play feedback"). Without one, the generic rating label shows.
4. **Digest:** notifications use kind `roleplay`. The F36 digest can list "role-play reviews I owe" (`review_status = 'requested'` and `reviewer_id = me`); this is not wired.
5. **FS55 engine card:** the FS58 suggestion ("Suggested next") ranks content only (least-practised scenario, rotated per person) with `<WhyThis>`. It never ranks people. Register it on the engine card if FS55 lists every ranked list.
6. **RLS perf form:** the four new tables already have the `alter policy` perf form in the FS65 migration. Rerunning `gen-rls-perf.mjs` in QA is optional.
7. **Live apply order:** the FS65 migration (tables, then functions), then the seed rows `aps_scenarios` and `roleplay_scenarios` before `aps_attempts` and `roleplay_sessions`, then the 26 `skill_evidence` rows and 19 notifications (insert ... on conflict (id) do nothing), then `kafaa_skills_apply` for the affected people. Expected md5s and digests are above.
