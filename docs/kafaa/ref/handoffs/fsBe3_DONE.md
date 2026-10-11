# fsBe3 · FS11 My Role in 2030 (role transformation maps) + FS12 Task exposure view (M30) — DONE

Branch `fsBe3` (worktree `/workspace/kafaa-fsBe3`, from master `80d05dc`). Not pushed. Live SQL applied to `hlirqxoddysxtdezwcgv` (additive kafaa_* only).

## Acceptance (PLAN.md FS11)
- [x] **All 28 roles have a map.** 28/28 `role_transformations` rows (25 with archetype + drivers + EN/AR staff and public summaries + https sources with as-of; 3 security/safeguards/cyber roles path-level). HR overview tile shows "28 / 28". Unit test + PGlite check.
- [x] **My time-to-ready lists the gaps it is based on.** `transformRole().me`: each gap (requirement, my level, target, months) and the total (2 months per level, same as M18 Navigator); `<WhyThis>` explains the rule; the page lists the gaps under the estimate. TS = SQL (`kafaa_rt_readiness`) over 280 role x person x horizon cases.
- [x] **Public views pass publicTextIsClean and show no headcount.** `/careers/roles/:slug/transformation` reads only `public_summary_*` + skill names; the publish check refuses unclean text (`kafaa_rpv_text_clean`), digits in public text (`public_numbers`) and banned wording. Page test asserts no digits, no %, no months, no headcount.
- [x] **Security roles show path-level content only.** `path_only` for security/safeguards/cyber families and security-sensitive roles: no tasks, skills, bridge or readiness in TS, SQL, staff and public pages; publishing task/skill text for them returns `security_restricted`.
- [x] Drivers, tasks that grow / are augmented / shrink (FS06) each with a reason, skills added (2030 minus now, 2035 minus 2030, FS05), bridge curriculum (catalogue course if staff, not initial training, <= 80 h; else practice 20 h per level), milestone timeline (ADVANCE 2026, SIM gates 2027/2031, profiles 2028, OSSA support ending ~2030, 2035 horizon) with "planning assumption, no deployment decision implied", archetype card (Mastery Builder, Analytical Specialist, Human Connector) with learning meaning.
- [x] RBAC: staff R/Own (my role); manager +Scope; training_manager W; hr_analyst Agg; hr_director R/Own/Agg/W/A; auditor R; public reads published summaries only; drafts are never public.
- [x] publishTransformation (W; audit + NEXUS ledger `kafaa.transformation.publish`; version bump with history). Benchmarks SG-JTM, SSG-SF, CORP shown as chips (FS01 `BenchmarkChips`).

## Acceptance (PLAN.md FS12)
- [x] **Every task band shows a reason.** Three bands (AI-assisted, partly automatable, human core) from `kafaa_fx_exposure`; every task row shows its OECD capability reason (`m26.reasons.*`) inline. Page test: 9/9 rows for RO have a reason.
- [x] **Aggregates under 10 people are suppressed.** `exposureAggregate` / `transformationOverview` cells by family, family group and all; under 10 -> suppressed (no numbers rendered); security/safeguards/cyber not broken out. TS = SQL in PGlite; page test checks suppressed rows have no numeric cells.
- [x] **Copy-check word list blocks banned wording in EN and AR (unit test).** `BANNED_EN` (replace*, redundant/redundancy, job loss/cuts, layoffs, eliminate jobs/roles, made surplus, headcount reduction) and `BANNED_AR` (استبدال/يستبدل, يحل/سيحل ... محل with up to 4 words between, إحلال, فائض/زائد عن الحاجة, الاستغناء عن, تسريح, إلغاء الوظائف, خفض عدد الموظفين) in TS and `kafaa_rt_banned` in SQL; parity tested on a shared corpus; the editor flags it live and disables save.
- [x] "Skills that complement AI": human-core task skills (FS06 links) or, without task data, human/transversal 2030 profile skills. SSG-SF reference line (`BenchmarkLine`, ai_aided_tasks). Benchmarks SSG-SF, OECD-AICI, ENERGY-JOBS chips.

## Routes (+5, total 217)
- `/my/role-2030` (`my-role-2030`, nav future): map for my role (?role=, ?h=2030|2035 for others / managers).
- `/my/role-2030/tasks` (`my-role-2030-tasks`): FS12 task exposure view.
- `/careers/roles/:slug/transformation` (`careers-role-transformation`, public): public summary, no numbers.
- `/workforce/transformation` (`workforce-transformation`, Agg/W/A): tabs Maps, Readiness, Exposure.
- `/workforce/transformation/:roleId` (`workforce-transformation-edit`, W/A): editor with live checks, draft, publish (confirm), history.

## Tables / RPCs
- Tables: `kafaa_role_transformations`, `kafaa_transformation_drafts`, `kafaa_transformation_milestones`, `kafaa_transformation_archetypes` (RLS per statement, resource `transformation`).
- RPCs (TS = SQL, SECURITY DEFINER): `roleTransformation` -> `kafaa_role_transformation(p_role, p_horizon)`, `publishTransformation` -> `kafaa_publish_transformation(p)`, `exposureAggregate` -> `kafaa_exposure_aggregate()`, `transformationOverview` -> `kafaa_transformation_overview(p_horizon)`; 23 internal `kafaa_rt_*` helpers revoked from public/anon/authenticated.
- Migration `supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql`. Live: `kafaa_fs23_role_transformation_part1_tables_rules` + `_part2_rpcs_grants`; rows inserted `on conflict do nothing`. Live = local: 27 function bodies md5 `673e551a…`; maps n=28 `f18a370a…`, drafts 1 `e8a6b8db…`, milestones 6 `dbcf9511…`, archetypes 3 `0eed2bd6…`.

## Seed
`scripts/seed/ext/fs11-role-transformation.mjs`: 28 maps (synthetic text, real public sources: WSG JTM, SSG, OECD AICI, ENEC/Presight, ENEC/TII, WNN ADVANCE, ANS, CLO AT&T), 2 at v2 with history, 1 open draft (reactor-operator, training manager), 6 milestones, 3 archetypes. Builder throws if any row fails `checkTransformation`. 24,254 seed rows, 227 SQL tables.

## Tests
- `tests/unit/fs23-role-transformation.test.ts` (16): rules, every acceptance criterion, RBAC, copy check EN/AR, suppression, publish codes, local RPCs.
- `tests/unit/fs23-pages.test.tsx` (8): the five pages in EN and AR (RTL), path-only, public no-numbers, suppression, editor flow.
- `scripts/validate/fs23-role-transformation.mjs` (PGlite, uids 7230-7239): seed sanity, `kafaa_rt_map` = `transformRole` (280 cases), RLS, RPC/aggregate/overview parity, copy-check parity, publish codes, draft/publish/audit/ledger, grants.

## Gates
gen ✓ (24,254 seed rows, 227 SQL tables) · check:i18n ✓ (40 namespaces, EN/AR parity) · typecheck ✓ · unit tests ✓ (fs23: 24/24) · migrations:validate ✓ ("All migration checks passed", incl. the fs23 checks) · check:public ✓ · build ✓ (vite, 3m). Full unit suite not re-run on this box (parallel runs are OOM-killed); expected failures are only the route-count pins (212 -> 217) in `w4-integration` and `w5-integration`. Commit `1cc3f25` on `fsBe3`.

## Gaps / notes for integration
- Route count 212 -> 217: pins in `tests/unit/w4-integration.test.tsx` and `tests/unit/w5-integration.test.ts` (integration lead).
- Only 13 non-security roles have FS06 tasks; the others show "no task-level analysis yet" and fall back to profile skills for complements.
- Most families have < 10 people, so family cells are mostly suppressed; family-group roll-ups (4 of 6 shown) carry the HR view.
- Hand-off: link the FS05 role page to `/careers/roles/:slug/transformation`; FS13/FS81 can reuse `transformRole` / `kafaa_rt_map`.
- No Playwright run (not integration lead).
