# fsGe4 DONE: FS66 University programme alignment + FS67 Fellowships and sponsored placements (M10)

Branch `fsGe4` (worktree `/workspace/nexus-fsGe4`, off `fsF-integration-qa`). Live Supabase was not touched (not available). Netlify was not touched. Nothing was pushed to `main` or `fsF-integration-qa`.

## Acceptance

### FS66 · University programme alignment
- [x] **Evidence is written only for endorsed programmes.** A graduate recorded at hire (`recordGraduateHire`, HR director = applications A) gets validated evidence for every mapped skill only when the programme is endorsed and the endorsement window (`covers_from` .. `valid_to`, three years) covers the graduation date. A graduate of a draft, submitted or returned programme waits (`awaiting_endorsement`); the evidence is written when a framework owner endorses (`endorseProgramme`, frameworks A, never the submitter, all three reviewer criteria plus the three computed ones). A lapsed endorsement or a date outside the window writes nothing (`not_covered`). Evidence: `se:programme:<graduate>:<skill>`, kind `credential`, basis `validated`, level <= 2 (the FS57 learnable ceiling), observed on the graduation date, `ref_table 'programme_alignments'`; skills are re-derived (`applySkills` / `kafaa_skills_apply`). The seed writes no programme evidence.
  - Test: `fs74-university-alignment.test.ts` › "FS66 acceptance: evidence is written only for endorsed programmes".
  - Page test: `fs74-pages.test.tsx` › "acceptance FS66 (page): the framework owner endorses after the reviewer criteria; evidence is written for the covered graduates only then"; "graduate hires: HR records a graduate of an endorsed programme (evidence written) and of a returned one (waits)".
  - PGlite: `fs74-university-alignment.mjs` › "acceptance (FS66): endorsement writes validated evidence ..."; "acceptance (FS66): evidence is written only for endorsed programmes: a returned programme waits, a lapsed endorsement writes nothing, ...".
- [x] **Coverage reuses the FS57 rule.** `programmeCoverage()` imports `requirementsOf`, `scoreReqs`, `restrictedSkills`, `HORIZONS`, `LEARN_CEILING` and `rdivC` from `src/modules/m25/coverage.ts`: the programme is the teaching source (levels capped at 2), scored against the published FS05 profile of each target role, now and 2030; the best role score must reach 40 for the computed criterion. SQL `kafaa_ua_coverage` uses the FS57 twins (`kafaa_cov_reqs`, `kafaa_cov_score`, `kafaa_cov_restricted`). The page explains each score with `<WhyThis>` reasons (`reasons.ua_role`, `reasons.ua_rule`) and a `BenchmarkLine` with the 40 threshold.
  - Test: "FS66 acceptance: coverage reuses the FS57 rule" (every role score of every seed programme equals a direct `scoreReqs(requirementsOf(...))`; endorsed snapshots equal the rule; the save RPC returns the same coverage).
  - PGlite: "acceptance (FS66): coverage reuses the FS57 rule: SQL kafaa_ua_coverage / kafaa_ua_auto equal programmeCoverage() / autoCriteria() ..."; "seed: every endorsed programme meets the computed criteria (coverage >= 40), keeps the coverage the FS57 rule gives on the final profiles, ...".
- [x] **A partner university sees only its own programmes.** Read rule `partner_org` OwnOrg on `university_org_id` or `recognition`; save needs `partner_org A` or `ecosystem` OrgW on the same organisation. Graduate rows are HR's only.
  - Test: "FS66 acceptance: a partner university sees only its own programmes" (k-university lists only `ku`; saving or editing a KINGS programme is refused; a supplier and anon see none; training and framework owners see all).
  - Page test: "university workspace: only its own programmes, live coverage in the editor, chips"; "renders in Arabic" (no graduates panel for the university).
  - PGlite: "acceptance (FS66): a partner university sees only its own programmes (and only fellowships it hosts)"; "RLS: anonymous visitors, supplier partners and staff without a recognition grant read no programme ..."; "RLS: recognition reviewers read every programme; ...".
- [x] **RBAC: university OwnOrg R/W for their programmes; frameworks A to endorse.** Maker-checker: the submitter never decides (page shows the own-submission notice).
  - Tests: "saveProgramme: draft, submit locks, ..."; "decisionProblem: status, maker-checker, ..."; page "maker-checker on the page: the submitter sees no decision controls".

### FS67 · Fellowships and sponsored placements
- [x] **Completion rate is computed from milestones and suppressed under 10.** A fellowship is complete when every required milestone is signed off; "due" = complete, withdrawn or past its planned end. `fellowshipStats()` (= SQL `kafaa_fw_stats`) gives the overall rate and breakdowns by pattern, host kind and university; any cell with fewer than 10 due is suppressed (rate, due, completed and award count all null). The last sign-off completes the fellowship and moves the rate.
  - Test: "FS67 acceptance: completion rate is computed from milestones and suppressed under 10".
  - Page test: "acceptance FS67 (page): completion rate first, award counts only beside it, small groups suppressed".
  - PGlite: "acceptance (FS67): completion rate is computed from milestones (SQL kafaa_fw_stats = fellowshipStats() at 5 dates; ...)"; "acceptance (FS67): the last required sign-off completes the fellowship and the completion rate moves with the milestones (SQL = TS after the change)".
- [x] **Each fellowship names a host project and a supervisor role card.** Host = a published research challenge (`research_challenges`) or an ADVANCE technology study (`adv_technologies`, wording checked by `publicTextIsClean` = SQL `kafaa_so_text_clean`); supervisor = an active staff person with a role card (`persona_id`), never the fellow. Five milestones per fellowship from the pattern template (NEST: plan, midpoint, deliverable, final report, knowledge transfer; sponsored study: enrolment, year results and graduation by the university, placement start and review by ENEC).
  - Test: "FS67 acceptance: each fellowship names a host project and a supervisor role card".
  - Page test: "acceptance FS67 (page): the fellowship names its host project and supervisor role card; the supervisor signs off the last milestone and completes it"; "HR fellowship programme: ... the award form checks the supervisor role card first".
  - PGlite: "SQL kafaa_fw_problem equals fellowshipProblem() on ... generated fellowships ..."; "saveFellowship: HR only; the supervisor must be a role card; five milestones from the template; ledgered".
- [x] **Award counts are never shown without the completion rate beside them.** In the data, a cell carries an award count only when its rate is given (TS and SQL). In the UI the only renderer of an award count is `CompletionPair`, which renders the rate (or "suppressed") first and withholds the award count when the rate is suppressed.
  - Test: "FS67 acceptance: award counts are never shown without the completion rate beside them".
  - Page tests: the FS67 acceptance page test and the HR page test (every `m10-fw-awarded` sits in an `m10-fw-pair` after `m10-fw-rate`).
- [x] **RBAC: university OwnOrg; HR A.** Fellowship rows: fellow, supervisor, host university (OwnOrg), HR director and auditor (applications). Award and withdraw: ecosystem A. Milestones: the fellow (or the university for its own) submits; the named supervisor or HR signs off, never the submitter; a return needs a note.
  - Tests: "updateMilestone: ..."; "withdrawFellowship: ..."; "read rules: fellowship rows are personal ...".
  - Page test: "a fellow without the aggregate grant sees only their own fellowship and no stats".

### Both
- [x] `<BenchmarkChips feature="FS66" />` (NUC-NET, UAE-NQF, LIGHTCAST) and `<BenchmarkChips feature="FS67" />` (NEA, NUC-NET) on every page. Full EN and AR (logical classes, `useFormat`, `{var}` placeholders in parity). Both backends (LocalBackend and Supabase mappings for the 7 RPCs). Synthetic people only, sample rows marked, no accreditation or regulatory claim (`m10.ua.notAuthority`).
  - Test: "routes, chips, i18n parity and Arabic"; Arabic page tests for both features.

## Routes (+7)
| id | path | guard |
|---|---|---|
| `partner-university-programmes` | `/partner/university/programmes` | role university |
| `training-university-programmes` | `/training/university-programmes` | admin, training_manager, instructor, hr_director, auditor |
| `university-programme` | `/universities/programmes/:id` (smoke `ua-ku-bsc-nuc`) | signed in (RLS decides) |
| `workforce-graduate-hires` | `/workforce/graduate-hires` | applications A/R |
| `universities-fellowships` | `/universities/fellowships` | signed in (rows by RLS, stats by ecosystem grant) |
| `university-fellowship` | `/universities/fellowships/:id` (smoke `fw-2024-ap-122`) | signed in (RLS decides) |
| `workforce-fellowships` | `/workforce/fellowships` | ecosystem A/W/Agg |

## Tables and RPCs
- Tables: `kafaa_programme_alignments`, `kafaa_programme_graduates`, `kafaa_fellowships`, `kafaa_fellowship_milestones` (DDL generated plus checks, RLS perf form, revoke all then grant select).
- RPCs (authenticated only): `kafaa_save_programme`, `kafaa_endorse_programme`, `kafaa_record_graduate_hire`, `kafaa_save_fellowship`, `kafaa_update_milestone`, `kafaa_withdraw_fellowship`, `kafaa_fellowship_stats`. Helpers `kafaa_ua_*` and `kafaa_fw_*` are not executable by API roles.
- No shared SQL redefinition (FS29 precedent: kind `credential` is already recorded; `kafaa_skill_states_v2` / `kafaa_skills_apply` unchanged).
- Ledger actions: `kafaa.programme.endorse`, `kafaa.programme.return`, `kafaa.programme.graduate_hire`, `kafaa.fellowship.award`, `kafaa.fellowship.milestone`, `kafaa.fellowship.withdraw`. Notifications `nt-ua-*` / `nt-fw-*` (kind `university`) at run time only.

## Local function md5s (md5(prosrc), PGlite after every migration and seed.sql)
Migration `supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql` (24 functions created; no overloads; no shared function redefined).
```
kafaa_endorse_programme 2ab512598ea8bfb5fb8cd224305599f0
kafaa_fellowship_stats 6f9501dbea258873122de24228437350
kafaa_fw_cell d09c920170ad711158d23534edb7570f
kafaa_fw_ms_problem 8db434e440f2ff72fc1ce7df441c35bd
kafaa_fw_plan b0a28a749f1058420454c569243a21f7
kafaa_fw_problem edfea2b8a96265fe59bc04b786eb6f9a
kafaa_fw_stats 7bfbae7d21274490b2ff9f2e4d5e4b2b
kafaa_record_graduate_hire 5bc67aa8a8fdf2b5958bcc34196798f6
kafaa_save_fellowship 6c7bfca15884b4d4fa40cad72cc93326
kafaa_save_programme 5c5c04b5dd5d688c69af968fbd8768bd
kafaa_ua_auto e98406ba11e7d0b340f711860746e0e9
kafaa_ua_clean_skills b4989c9b8cd07cb85eae30eedfd13fab
kafaa_ua_coverage 5807d01603d24b354c396c711143d5a9
kafaa_ua_decision_problem 85a0550beb392c73063caa3b5149a5ee
kafaa_ua_grad_status d6d3546f4f31e47eb7024f9a5654d788
kafaa_ua_hire_problem 2a1c5fd0b648d329e389c841068b11c1
kafaa_ua_len_ok 25ca72f3e651dae53f300277435eabe9
kafaa_ua_notify 49c5fd803e7e38711d140dc5a328482e
kafaa_ua_problem eac7c2fe977ab22648429031e0f313bb
kafaa_ua_taught 790076ae164fb28e6aec2e6a860a3640
kafaa_ua_trim cc91988372f0fa663ff9325b2878670a
kafaa_ua_write_evidence e9c37543884831d11414f2fe2ddac05c
kafaa_update_milestone 7708a5bf54090ec0c6f9430a6612dda6
kafaa_withdraw_fellowship 7a761fc357df488233a94ff3aa0af05b
```

## Table digests (count, left(md5(string_agg(to_jsonb(t)::text, '|' order by id)), 8))
```
TABLE kafaa_programme_alignments 9 7439c299
TABLE kafaa_programme_graduates 6 ad4c8b5e
TABLE kafaa_fellowships 42 46cb39a5
TABLE kafaa_fellowship_milestones 210 bd4d6cf8
ROWS evidence programme_alignments 0
```
- The seed builder adds only these four tables (9 + 6 + 42 + 210 rows). It writes no `skill_evidence`, `person_skills` or `notifications` rows, so F01_DIGEST_71 and every earlier digest are unchanged.
- Seed: `build-seed: 35642 rows across 329 tables; 57 personas`.

## Tests
- `tests/unit/fs74-university-alignment.test.ts`: 16 tests, all pass (jsdom; the acceptance tests are named above, one per criterion: "FS66 acceptance: ..." x3, "FS67 acceptance: ..." x3).
- `tests/unit/fs74-pages.test.tsx`: 11 tests, all pass (personas k-university, training-mgr, k-admin, ai-governance, chco, k-graduate; two Arabic pages).
- Directly affected suites, run one file at a time: `fs11-catalogue` 13/13, `g3-routes` 349/349. Route pins only (see hand-offs): `fsqa1-integration` 17/18 and `fs11-foundation` 18/19 (expected 345 to be 338).
- PGlite: `scripts/validate/fs74-university-alignment.mjs` all 32 checks pass (seed sanity; SQL = TS parity for coverage, auto criteria, programme / decision / hire problems, milestone plan, fellowship and milestone problems, stats at 5 dates; RLS for university, anon, supplier, SRO, HR, auditor, supervisor; RPC flows in a rolled-back transaction; grants; perf policy form; additivity).
- Memory note: the shared container OOM-killed several vitest runs started by parallel engineers; every file above was re-run alone until it completed.

## Gates
Run from `kafaa/` on 2026-10-12:
- `npm run gen`: no unexpected diff (`build-seed: 35642 rows across 329 tables; 57 personas`). Generated files changed only for the four new tables (types, schema/RLS SQL, seed.sql, seed.json).
- `npm run check:i18n`: 40 namespaces, en/ar in parity.
- `npm run typecheck`: clean.
- Unit: own files 16/16 and 11/11; affected files as listed above (failures are route pins only).
- `npm run migrations:validate`: "All migration checks passed" (includes `fs74-university-alignment.mjs` and every shared validator with the widened invariant list).
- `npm run check:public`: 75 public tables, no personal columns, no emails or phone numbers.
- `npx vite build`: built in 1m 10s.
- Playwright and browsers were not run (not allowed).
- My vitest temp folders under `/dev/shm` were removed after the runs.

## Gaps
- No Playwright or browser run (not allowed in this task). Pages are covered by jsdom tests only.
- Live Supabase was not available. Nothing was applied live.
- The `k-university` persona exists only on the local backend; the university's own save / submit and milestone-submit flows are proved locally (unit tests) and in PGlite with a test profile, not on live Supabase.
- Graduates are entered by synthetic person id; there is no applicant search picker on the hire form.
- Coverage counts only the programme's own mapped skills (it does not add ENEC courses), by design: it answers "what does this degree teach for the role".

## Hand-offs for the integration lead
1. **Route-count pins 338 -> 345** (+7 M10 routes): `fs11-foundation`, `fsqa1/2/3/4/5-integration`, `w4-integration`, `w5-integration`, `tests/e2e/sweep.spec.ts`.
2. **Passport label:** evidence with `ref_table 'programme_alignments'` (kind `credential`, basis `validated`) can be labelled with `m10.ua.evidenceLabel` ("Endorsed university programme") / `m10.ua.evidenceSystem`; the M17 passport wiring is not in fsGe4's files, so the generic credential label shows until then.
3. **Recorded-evidence lists:** `'programme_alignments'` was added as one token to the four shared "no derived future-skill state" lists (`scripts/validate/{fs11-foundation,fsqa1-integration}.mjs`, `tests/unit/{fs11-catalogue.test.ts,fsqa1-integration.test.tsx}`); union with other wave-G tokens on merge.
4. **FS55 engine card:** none needed (no ranked list of people or content).
5. **Digest:** milestones waiting for my sign-off (`fellowship_milestones.status = 'submitted'` where I am the supervisor) could join the F36 "approvals I owe"; not wired.
6. **Live apply order:** the fs74 migration (tables, then functions), then seed rows `programme_alignments` (9), `programme_graduates` (6), `fellowships` (42), `fellowship_milestones` (210) with `insert ... on conflict (id) do nothing`. No evidence, notification or person-skill rows are seeded. Expected md5s and digests are above.
