# FS wave F integration and QA (FS50-FS59), 12 Oct 2026

Repo `/workspace/nexus` (app in `kafaa/`), branch `fsF-integration-qa`, cut from `origin/fsE-integration-qa` (wave E, not on `main` yet) and **stacked on it**: the draft PR targets `fsE-integration-qa` and must be retargeted to `main` after wave E merges. Commits: merges `957dded` (fsFe1), `2711270` (fsFe2), `380f376` (fsFe3), `291842e` (fsFe4), `c35f067` (fsFe5), then one QA commit (wiring, QA migration, tests, fixes, live-apply bundle, this report). Pushed to `origin/fsF-integration-qa` only; `main`, `fsE-integration-qa` and Netlify were not touched. **Live Supabase was not available in this session: nothing was applied live.** Apply the wave-E bundle, then the wave-F bundle, before either branch reaches `main`, because merging to `main` deploys production.

## Merge
- `fsFe1`..`fsFe5` merged `--no-ff` in slot order:
  - fsFe1: FS50 Critical Future-Skills Register, FS51 three-scenario skill forecasting bands (M35);
  - fsFe2: FS52 AI and automation exposure in the skills outlook, FS53 external benchmark lines (M07);
  - fsFe3: FS54 skills council and taxonomy change tracker, FS55 engine cards, ontology datasheet and model-risk template (M16);
  - fsFe4: FS56 skill-change effectiveness, FS57 curriculum coverage scorer and gap backlog (M25);
  - fsFe5: FS58 adaptive problem-solving practice, FS59 role-play library with saved feedback (M33).
- Conflicts only in generated files (taken from ours, regenerated with `npm run gen`) and the CONTRACT changelog (both sides kept). No recorded-evidence list conflicted: only fsFe5 added a token (`roleplay_sessions`). No conflict markers left.
- Result: 338 routes (315 + M35 7, M16 6, M25 3, M33 7; FS52/FS53 add none), 325 seed tables, 35,375 seed rows, 6 new migrations (5 feature files + the QA file). All five engineer slots were complete; nothing had to be finished by the lead.

## Cross-feature wiring (CONTRACT changelog "FS wave F integration and QA")
Migration `20261010269001_kafaa_fs6qa_integration.sql`, seed `scripts/seed/ext/fsqa6-integration.mjs` (FINALIZE_LAST; fails `npm run gen` if an invariant breaks), PGlite validator `scripts/validate/fsqa6-integration.mjs` (15 checks), unit test `tests/unit/fsqa6-integration.test.tsx` (12 tests, one per wiring criterion), E2E `tests/e2e/fswaveF.spec.ts`.
- **FS51 <-> FS52 (shared F35 outlook):** FS51 imports `m07/outlook.ts` read-only and runs on its own `kafaa_sf_*` SQL; FS52 kept every F35 export. Adoption 0 reproduces the five stored outlooks byte for byte; the stress test reads 10 of 10 (re-proved after the merge by `w5e4-outlook`, `fs62`, `fs61` and fsqa6). **`kafaa_so_base` is not redefined in wave F** (neither engineer touched it): the newest body stays fs2qa (FS02 `fs_area is null`, which also carries the FS10 exclusion); the FS52 factor lives in `kafaa_so_for` / `kafaa_so_compute` (fs62).
- **FS54 -> F35 / FS51:** the methodology-change banner (`MethodologyBanner`, reads the public `kafaa_skill_changes`) is mounted on `/workforce/skills-outlook` (key `skills_outlook`) and on every FS51 page through the shared `SimLabels` row plus the method page (key `skill_forecasts`), next to FS51's own method banner. SQL selection = `methodologyNotices` (fsqa6).
- **FS54 <-> FS57, one "taught by" rule:** the orphan audit now takes course / pathway / a new external flag from FS57's `taughtBy()` (SQL `kafaa_cov_taught`); assessments and roles stay audit-only. TS `taxonomyHealth`, local data, SQL `kafaa_fs63_health` (redefined in the QA migration), the health page column and definitions (EN/AR). Seed effect: 11 untaught and 4 orphans instead of 3 and 0 (four FS02 skills whose only pathway has an empty learning step; four skills taught only by supplier-academy or security courses).
- **FS55 lint -> wave-F ranked lists:** three `RANKED_SURFACES` entries (wave `FSQA6`) and cards (EN/AR): `critical_attention` (FS50), `outlook_automation` (FS52), `aps_next` (FS58). None ranks people. 34 cards for 34 surfaces; the lint test is green; the six functions pass the protected-input checks (static and Proxy).
- **FS57 -> FS17:** the backlog is the decision layer over M19 `pathway_gaps`; a sync on the final seed adds nothing (91 rows, each with an owner); `coverage()` stays import-free for FS66.
- **FS59 -> recorded evidence (3.9):** fs65 is the newest `kafaa_skill_states_v2` / `kafaa_skills_apply` and carries the full list ending with `'roleplay_sessions'` (md5 `6beb9870` / `aef7f55d`); the QA migration does not restate them. `RECORDED_REF_TABLES` matches.
- **FS59 -> M17 passport:** validated role-play evidence is labelled "Validated role-play feedback" (EN/AR).
- **FS59 -> F36 digest:** "approvals I owe" lists role-play sessions sent to me by name (`approval:roleplay_sessions:<id>`, link `/training/role-play?tab=reviews`); TS `gatherDigest` = SQL `kafaa_dg_gather` (md5 `1981fb9d`, parity on 30 reviewer/staff x day cases). Seven seeded digests and their notices change; the QA migration replays them with updates guarded on the exact wave-E values (forward proof in fsqa6, and in fsqa5 after its own replay).
- **FS56 after FS59:** fs56 measured before fs58 added the role-play evidence (file order), so one stored measure no longer reproduced from the rule; fsqa6 recomputes the measures on the final seed (the table is new, so live gets the final rows).
- **RLS performance:** the 13 new tables already use the perf form (fsqa6).
- **Route pins:** 338 in 9 files (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..5-integration`, `tests/e2e/sweep.spec.ts`), each with the per-module additions; M33 route-id list in `fs35-core-skills`.
- **Settled decisions applied and logged:** FS53 primary figures only; FS55 guarded engine-card reconciliation (no removals); research-pack facts only; MC-H2-HEAT stays a draft; the later-wave decisions (FS63, FS66, FS69, FS73, FS74, FS77, FS81) recorded in the CONTRACT entry.

## Live-apply bundle (`docs/kafaa/ref/live_apply/waveF/`)
- Generated by `kafaa/scripts/live-apply-bundle.mjs` from `docs/kafaa/ref/live_apply/waveF.config.json`; checked by `kafaa/scripts/verify-live-bundle.mjs`.
- **Pre-wave state = the state after the wave-E bundle** (`waveE/EXPECTED.md`); `EXPECTED.md` says so at the top of section 0 (for example `kafaa_dg_gather` `b5852630`, `kafaa_skill_states_v2` `b1634eba`, `kafaa_skills_apply` `9da9fe27` must be live first).
- 33 parts in apply order, each at most ~60 KB (`kafaa_fs6<e>_<topic>_pN.sql`):
  - 1-8: the five feature migrations (fs61 p1-p2, fs62 p1, fs63 p1-p2, fs64 p1, fs65 p1-p2);
  - 9-10: the QA migration (taught-by health, digest gatherer, three engine cards on conflict do nothing, guarded digest replay);
  - 11-32: seed rows (`insert ... on conflict (id) do nothing`, `kafaa.seeding` on; forecasts before register rows before reviews, scenarios before attempts and sessions; 969 rows in 17 tables);
  - 33: `kafaa_skills_apply` replay for the 13 people with role-play evidence (demo day 2026-10-08).
- `EXPECTED.md` lists the pre-wave md5s of the 7 shared functions the wave redefines, the md5 of all 139 new or redefined function bodies, 22 table digests, the grants and what to do afterwards.
- Dry run: `origin/fsE-integration-qa`'s migrations and seed loaded into PGlite (the post-wave-E state), all 33 parts applied twice: **139/139 md5s and 22/22 digests equal.**
- Checks (generator): no removal words anywhere (comments and strings included); every target is a `kafaa_*` object; ALTER only on `kafaa_*` tables.

## Gates (final, after the last edits)
- gen: OK; regenerating leaves `seed.json`, `seed.sql` and `types.gen.ts` unchanged (md5 before = after). fsqa6 prints its invariants (FS56 recompute, 34 cards for 34 surfaces, roleplay evidence recorded, backlog complete, 4 reviews owed in 7 digests, methodology notices).
- check:i18n: OK (40 namespaces, EN/AR in parity). typecheck: clean. check:public: OK (75 public tables, no personal columns).
- migrations:validate: "All migration checks passed" (full chain, 13.7 min, all validators including the new `fsqa6-integration` (15 checks) and the updated `fs25`, `fs63`, `fs65`, `fsqa5`, `w5e5-digest-dalil`).
- vite build: OK. build:deploy: OK. `deploy_out/kafaa/index.html` keeps both badge-hiding lines; the issuer JSON is at `/.well-known/kafaa-issuer.json`, `/kafaa/.well-known/kafaa-issuer.json` and `/kafaa/issuer/kafaa-issuer.json`; `kafaa/ojt-sw.js` is there; `_redirects` keeps its order (`/` 302, `/kafaa` 301, `/kafaa/.well-known/*` 200!, `/kafaa/*` 200); `grep -rE "service_role|sb_secret_" deploy_out` finds nothing (the build warns that the demo password was not set, as expected). `deploy_out/` is gitignored and was not committed or deployed.
- **Unit tests: 157 files, 2,750 tests, all green**, one file per vitest process (`docs/kafaa/ref/qa_logs_F/unit_lanes.sh`; per-file results in `qa_logs_F/unit_summary.txt`). The first pass ran 2 lanes; files killed by the container's memory limit (two seed-loading vitest processes at ~5 GB each, rc=137) and the files fixed in QA were rerun in one lane. Real failures found and fixed: `fs52-energy-transition` / `fs52-pages` (persona), `w3e5-no-protected-inputs` (runners for the wave-F card functions), `w5-integration` (digest data), plus `fs63-engine-lint` and `fs64-skill-change-coverage` right after the merge (fixed by the wiring).

## Browser E2E (one Chromium, workers=1, vite preview, local mode)
- **Journeys `tests/e2e/fswaveF.spec.ts`: 6 of 6 pass** and cover every wave-F acceptance criterion:
  - F1 FS50/FS51: computed progress with suppression, owner and rationale, the quarterly review recorded once (HR director), SIMULATED labels and definitions link, what-if and exact reset, suppressed skills without numbers, versions blocked by the methodology change, generations to 2084, method page; no staff access;
  - F2 FS52/FS53: the automation bar in the tornado with its 0-60 % range, adoption 0 = the outlook before the slider, market statistics dashed with source and as-of date, measured values solid and SIMULATED, held figures without values, the line-manager overview;
  - F3 FS54/FS55: a staff retire proposal through the inclusion rule, two different council members, the skill obsolete but still in the catalogue, the public log, staleness / orphan / untaught drill-downs, 34 engine cards with no ranked surface missing, surface fairness, datasheet from data, model-risk template with the gateway off;
  - F4 FS56/FS57: suppressed items show only "suppressed", method chip and 90-day window, backlog owners and planned decisions, a what-if with exactly the predicted rise that is recorded only after the confirmation;
  - F5 FS58/FS59: the mid-task change hidden until the plan is answered, score 100 with the benchmark line and the scale, "never a qualification"; rubrics in EN and AR; a speak-up topic routed to `/speak-up` and not kept; private history; the named reviewer validates a session; HR aggregates;
  - F6 wiring: banners on the outlook and FS51 pages, the external column and shared definition on the health page, the three wave-F cards, the passport label, the role-play review owed in the training manager's digest, Arabic RTL on wave-F pages.
- **Visual `visual.spec.ts -g fsf`: 70 of 70 pass** (30 pages in RTL and 30 at 390 px, checked by eye on contact sheets, plus 10 shots in `docs/kafaa/ref/shots_F/`).
- **Route sweep (local mode, `E2E_BACKEND=local`):** live Supabase was not reachable, so the sweep ran on the local backend for the wave-F modules and every module the wiring touched (M35, M07, M16, M25, M33, M17, M14, M28): 79 routes x 17 sessions = 1,343 checks; 592 ok, 683 forbidden as expected, 68 sign-in as expected; **0 mismatches, 0 console or text issues** (18/18 tests, 22.6 min; `qa_logs_F/sweep_summary.txt`). The full sweep in supabase mode must run after the live apply.

## Bugs fixed during QA
1. `fs63-engine-lint` failed after the merge: FS52's `rankAutomation` had no engine card. The three wave-F ranked lists now have cards and registry entries.
2. `fs64` "stored measures reproduce from the rule" failed after the merge: FS59's role-play evidence moved one FS56 measure. fsqa6 recomputes the measures on the final seed.
3. The `fs65` validator flagged the new digest gatherer as a reader of the practice tables; the digest is now allowed (it lists reviews owed, never scores or qualifies).
4. `fsqa5` and `fs25` validators replay older migrations that the QA migration supersedes; they now replay the QA migration too.
5. At 390 px `/workforce/skill-forecasts/versions` scrolled sideways by 72 px (version pickers): fixed with `min-w-0 max-w-full`.
6. The methodology banner read "Changes in the last 90 days: Add."; it now names the kinds of change (EN/AR).
7. Four unit tests followed the wave-F data (see Gates).

## Screenshots
`docs/kafaa/ref/shots_F/` holds 10 shots:
- 01-08 EN: critical skills register, skill forecast bands, outlook automation card, market lines, skills council, ontology datasheet, coverage what-if, problem-solving practice;
- 09: role-play library, AR;
- 10: skill-change table, mobile.

## Remaining issues
- **The live apply has not been done** (no Supabase access in this session). Apply `docs/kafaa/ref/live_apply/waveE/` and then `docs/kafaa/ref/live_apply/waveF/` in order and compare with each `EXPECTED.md` before merging; then run the full route sweep in supabase mode (handover 3.11).
- Seeded skills-council requests and FS47-style free text (inclusion statements, rationales) are English and show as entered in Arabic.
- `k-ro`, the usual "beginner" persona, now has validated role-play evidence on two transversal skills (FS59 seed), so pages that read transversal skills show level 2 for k-ro.
- The unit suite no longer fits two parallel lanes in this container (memory limit); run it in one lane or with more memory.
- Vite chunk-size warnings (the seed chunk). `deploy_out/` is gitignored and was not deployed.
