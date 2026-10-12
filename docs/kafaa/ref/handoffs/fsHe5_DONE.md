# fsHe5 DONE · FS77 Student future-skills starter and intake baselines (FS wave H · E5, M06)

Branch `fsHe5` (stacked on `fsG-integration-qa`), worktree `/workspace/nexus-fsHe5`. Live Supabase was not used: nothing was applied live.
CONTRACT changelog entry: "2026-10-12 · FS wave H · E5" in `kafaa/CONTRACT.md`.

## Acceptance (card FS77 + handover adjustments) with the test that proves each

| Criterion | Proved by |
|---|---|
| Anonymous use stores nothing (existing spy test, extended) | `tests/unit/fs85-pages.test.tsx` › "FS77 acceptance: anonymous use stores nothing: answering every self-check and using the intake preview sends and stores nothing"; "the journey page shows the starter section; answering its self-check as a visitor stores nothing"; `tests/unit/w5e3-pages.test.tsx` › "A2: … answers the FS77 starter self-check: no fetch, no RPC, no write, nothing in browser storage" (extended); `tests/unit/fs85-student-starter.test.ts` › "FS77 acceptance: anonymous use stores nothing (no RPC writes for public visitors; the starter needs no RPC)" |
| All facts cite sources | `fs85-student-starter.test.ts` › "FS77 acceptance: all facts cite sources (every starter lesson has https sources with an as-of date; secondary ones flagged)" (also: every URL is in the research packs; national-curriculum baseline claims cite https); `fs85-pages.test.tsx` › "FS77 acceptance: all facts cite sources: every lesson shows https sources with an as-of date, secondary ones flagged (EN and AR)"; PGlite `fs85-student-starter.mjs` › "acceptance (FS77 all facts cite sources)" |
| Induction plans read the baseline for the joiner's intake year | `fs85-student-starter.test.ts` › "FS77 acceptance: induction plans read the baseline for the joiner's intake year (programme first, then all programmes; none = full)"; PGlite › "acceptance (FS77 induction plans read the baseline for the joiner's intake year): 2027 DNT reads ib-2027-all-v1 …, 2026 GDP reads ib-2026-gdp-v1, 2025 reads ib-2025-all-v2, 2030 has none"; `fs85-pages.test.tsx` › "the DNT graduate persona sees the plan read from the 2026 baseline …" |
| AI-literacy starter + SMR orientation in the public journey | `fs85-pages.test.tsx` (starter page, journey section `m06-journey-starter`); SMR "no deployment decision implied": `fs85-pages` "all facts cite sources … (EN and AR)" + `fs85-student-starter` › "SMR starter text carries no site, headcount or deployment claim" |
| SMR orientation reuses FS38/FS39 public content (links) | lessons link `/careers/next-gen` (FS38) and `/learn/ai-fluency` (FS09); `fs85-pages` link assertions |
| RBAC: Public R; HR W for baselines | `fs85-student-starter.test.ts` › "saveIntakeBaseline: HR only (workforce_strategy W) …", "buildInductionPlan and inductionJoiners: …", "RLS: a joiner reads only their own plan; HR, training staff and auditors read …"; PGlite RLS + RPC checks |
| Figures only from kafaa_benchmarks (settled decision) | `fs85-student-starter.test.ts` › "no benchmark figure is typed into starter copy (figures come from kafaa_benchmarks through BenchmarkChips)" |
| Mandatory nuclear modules never skipped | `fs85-student-starter.test.ts` › "mandatory nuclear modules can never be skipped or shortened by a baseline"; PGlite `kafaa_ib_problem` parity (40 drafts) + RPC refusal |
| HR flows (publish draft, stale plans, rebuild, build from joiners, read-only training staff) | `fs85-pages.test.tsx` › "HR rebuilds the stale plan, then publishes the 2027 draft …", "training staff read … cannot edit or build …", "HR builds a plan for an offered applicant from the joiners tab …" |
| Signed-in student keeps progress, journey unchanged | `fs85-pages.test.tsx` › "a signed-in student keeps their starter progress in their own journey; stage, route and checklist are unchanged" |
| EN + AR | `fs85-student-starter.test.ts` › "i18n: every FS77 key exists in English and Arabic, and the Arabic is Arabic"; Arabic renders in `fs85-pages` |

## Routes (+3; 367 -> 370, pins left to the integration lead)

- `pathways-starter` `/pathways/journey/starter` (public; nav public/pathways 21.5) — `StarterPage`
- `my-induction` `/my/induction` (signedIn; nav my/me 16.5) — `MyInductionPage`
- `workforce-intake-baselines` `/workforce/intake-baselines` (anyRole hr_analyst, hr_director, training_manager, admin, auditor; nav my/workforce 68.5) — `WorkforceIntakeBaselinesPage`
- F34 `/pathways/journey` gains a `#starter` section (`starterTeaser.tsx`). No param routes (no smoke.json needed).

## Tables and RPCs

- Tables (M06, `src/modules/m06/backend/schema.ts`): `kafaa_starter_lessons`, `kafaa_induction_modules` (public where listed, write none), `kafaa_intake_baselines` (public where listed; drafts by workforce_strategy + sat; rpc), `kafaa_induction_plans` (own_profile Own, workforce_strategy, sat; rpc).
- RPCs: `saveIntakeBaseline` (`kafaa_save_intake_baseline(jsonb)`), `buildInductionPlan` (`kafaa_build_induction_plan(jsonb)`), `inductionJoiners` (`kafaa_induction_joiners()`); authenticated only.
- Internal helpers (no API role executes them): `kafaa_ib_trim`, `kafaa_ib_len_ok`, `kafaa_ib_int_between`, `kafaa_ib_msg`, `kafaa_ib_problem`, `kafaa_ib_clean`, `kafaa_ib_for`, `kafaa_ip_compute`, `kafaa_ip_problem`, `kafaa_ip_joiners`, `kafaa_ip_notify`.
- Shared write: `kafaa_notifications` (kind `induction`, `nt-ip-<person>-r<revision>`) through `kafaa_ip_notify` only. No skill evidence, no new evidence ref_table, no shared function redefined, `RECORDED_REF_TABLES` unchanged.

## Local md5 of every new function body (PGlite, `md5(prosrc)`, after all migrations + seed applied twice)

| function | md5 |
|---|---|
| kafaa_build_induction_plan | 5eb1a93cdf1925ff90da43877470ba11 |
| kafaa_ib_clean | 4a8474b6e8c969b0d4247441b925c5a3 |
| kafaa_ib_for | 7df478755e123c94477f18fd7848a24a |
| kafaa_ib_int_between | 458d2b4511c47789c1ec2bd9f49f8431 |
| kafaa_ib_len_ok | e384e2e7308b10074318bec04f009457 |
| kafaa_ib_msg | 154c06bdb657875232ec2f2435f06565 |
| kafaa_ib_problem | 16ad97ac3e247eff95b92ad2791991e8 |
| kafaa_ib_trim | 7fb1a88fb0ef5d30b6eabb8cd416f46c |
| kafaa_induction_joiners | 8729b0c34c88955616d239f89665545a |
| kafaa_ip_compute | 74d6a7c8e4d27dd035781c5ca9797e30 |
| kafaa_ip_joiners | 2193b740489ccc3cc03dbeb097aa40ca |
| kafaa_ip_notify | 7c4241e464a0bc9366ff74e67cf41077 |
| kafaa_ip_problem | 85545b731589d2d9431d647363a0366d |
| kafaa_save_intake_baseline | a2aa47ef0c8ea7866dcba8de61bbe3f1 |

## Table digests (`count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`, PGlite over the generated seed)

| table | rows | digest |
|---|---|---|
| kafaa_starter_lessons | 8 | 25819eb6 |
| kafaa_induction_modules | 12 | 32aa9181 |
| kafaa_intake_baselines | 7 | c01ececc |
| kafaa_induction_plans | 8 | 720b3d34 |

Seed: 35 new rows, no other table changed (seed.json diff checked table by table); load with `insert ... on conflict (id) do nothing` (supabase/seed.sql rows). No guarded UPDATE of existing live rows.

## Tests and gates (run from `kafaa/`, one vitest process at a time, TMPDIR=/dev/shm)

- `npm run gen`: no diff on a second run (md5 of all generated files unchanged).
- `npm run check:i18n`: 40 namespaces, en/ar in parity.
- `npm run typecheck`: clean.
- Unit: `tests/unit/fs85-student-starter.test.ts` 18/18, `tests/unit/fs85-pages.test.tsx` 11/11, `tests/unit/w5e3-pages.test.tsx` 11/11 (extended), plus directly affected `fs63-engine-lint` 13/13, `m14-rbac` 291/291, `w0-whythis` 4/4.
- `npm run migrations:validate`: "All migration checks passed" (EXIT 0); fs85 validator 17/17.
- `npm run check:public`: 75 public tables, no personal columns.
- `npx vite build`: built (known chunk-size warning only).
- Not run (by instruction): Playwright smoke / E2E.

## Decisions applied and logged

- RBAC resource: Public R via `talent_content` R where listed; HR W via `workforce_strategy` W (not `ecosystem`, whose R is held by every staff member and partner, so drafts and plans would leak). Training staff read drafts/plans through `sat`. The `policy.ts` comment listing FS77 under `ecosystem` is now inaccurate (comment only; no grant change requested).
- External facts only from the research packs; secondary/news sources flagged on the page; no figure typed into copy (benchmark figures only via `<BenchmarkChips feature="FS77" />`).
- SMR content: "no deployment decision implied", no site/headcount/deployment wording (pattern equal to FS05 `publicTextIsClean` + deployment claims).
- Mandatory nuclear and ENEC modules (AI at ENEC, cyber hygiene, safety culture, radiation protection, site induction, company) are locked; baselines only shorten induction and never rank or select anyone.
- No engine card: FS77 ranks nothing (per-module decisions with `<WhyThis>`), `RANKED_SURFACES` unchanged.

## Gaps and hand-offs for the integration lead

1. Route-count pins 367 -> 370 (+3 M06: `pathways-starter`, `my-induction`, `workforce-intake-baselines`) in the 10 pin files and `tests/e2e/sweep.spec.ts`; `w4-integration` etc. fail until updated.
2. Live-apply bundle part for `20261010285001_kafaa_fs85_student_starter.sql` (tables + RLS + functions) and the four seed tables; expected md5s/digests above. No row updates.
3. Local-only demo personas: the joiner view `/my/induction` is demoed with `k-lo-trainee` (local backend only); on Supabase the HR demo is `chco` publishing `ib-2027-all-v1` and rebuilding the six 2027 plans, and seeded plans belong to synthetic people without a sign-in. `k-student` keeps starter progress on the local backend only.
4. Optional wiring (not done, outside my folder): F36 digest notice for HR "plans to rebuild" after a baseline publication; a link from the FS09 `/learn/ai-fluency` page to `/pathways/journey/starter`; drop FS77 from the `ecosystem` comment in `src/auth/policy.ts`; rerun `gen-rls-perf` if the lead regenerates the perf file (the migration already carries the perf form for the four tables).
5. `intake_baselines.set_by` / `published_by` hold HR role-card person ids (e.g. `p-chco`) and are publicly readable on published rows; `check:public` passes (role cards, no names). If the lead prefers, a later wave can expose published baselines through a view without those columns.
