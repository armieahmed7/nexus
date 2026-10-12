# fsGe3 DONE: FS64 Regional skills plan for Al Dhafra + FS65 Skills pledges ledger (M36 Skills Ecosystem)

Branch `fsGe3` (worktree `/workspace/nexus-fsGe3`), stacked on `fsF-integration-qa`. Wave G, engineer 3. Live Supabase was not touched (no SQL applied, no API calls). Nothing was pushed to `main` or `fsF-integration-qa`.

## Files (owned only)

| Area | Files |
|---|---|
| Rules (import-free) | `kafaa/src/modules/m36/regional.ts`, `kafaa/src/modules/m36/pledges.ts` |
| Pages | `RegionalPlanPage.tsx`, `CommitmentsPage.tsx`, `CommitmentPage.tsx`, `DemandReleasePage.tsx`, `PledgesPage.tsx`, `PledgeRegisterPage.tsx`, shared `ui.tsx`, `CommitForm.tsx` (all in `kafaa/src/modules/m36/`) |
| Backend | `kafaa/src/modules/m36/backend/{schema,rpc,local,supabase}.ts`, `routes.ts`, `smoke.json` |
| i18n | `kafaa/src/i18n/m36.{en,ar}.json` (full EN + AR, parity checked) |
| SQL | `kafaa/supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql` |
| Seed | `kafaa/scripts/seed/ext/fs64-regional-plan.mjs` (FINALIZE_LAST) |
| Validator | `kafaa/scripts/validate/fs73-regional-pledges.mjs` |
| Tests | `kafaa/tests/unit/fs73-regional-pledges.test.ts` (23 tests), `kafaa/tests/unit/fs73-pages.test.tsx` (10 tests) |
| Docs | `kafaa/CONTRACT.md` changelog entry "FS wave G · E3", this file |
| Generated (by `npm run gen`) | `src/data/types.gen.ts`, `src/seed/seed.json`, `supabase/seed.sql`, `supabase/migrations/20261008120100_kafaa_schema.sql`, `supabase/migrations/20261008120300_kafaa_rls.sql` |

No shared source file was edited (no `src/ui`, `src/domain`, `src/auth/policy.ts`, routing or other module folders). No route-count pin was touched.

## Acceptance tick list (card + adjustments)

### FS64 Regional skills plan for Al Dhafra
- [x] **Only released, suppressed aggregates reach partners.**
  - local: `fs73-regional-pledges` › "a partner reads released rows only: every cell null, 0 or 10+, no withheld or security skill, and never the FS51 forecast itself"; "demandRows suppresses cells of 1-9 and areas measured on fewer than 10 holders, and never releases a security skill"; "the stored release equals demandRows() of its released FS51 forecast"; "releaseRegionalDemand: only the HR director, only a released forecast, a clean note; the previous release is superseded (audit + ledger)".
  - SQL: validator checks "acceptance (FS64): only released, suppressed aggregates are stored…", "demand rows: SQL kafaa_rg_rows = TS demandRows for 23 cases…", "releaseRegionalDemand: HR director only…", RLS check; DB constraint `kafaa_regional_demand_cells_ck` (every cell null, 0 or >= 10).
  - pages: `fs73-pages` › "partner admin: released demand per area and year…", "staff: the released demand only…", "HR director: the newer released forecast is pending; preview rows; the release goes through the RPC".
- [x] **Each commitment shows its delivery status.**
  - local: "every seeded commitment has a computed status with reasons; the statuses on track, at risk, behind, not started and withdrawn all occur"; "term rule: 90% filled is on track / delivered, 60% at risk / partly, below that behind / missed…"; "coverage: planned seats of active commitments against each area's released 2030 gap".
  - SQL: "acceptance (FS64): each commitment shows its delivery status", "delivery status: SQL kafaa_rg_status = TS commitmentView().status for 13 commitments x 5 days".
  - pages: "partner isolation on the commitments page…each with a delivery status", "HR: every provider…", "a commitment: delivery status with Why this?, terms, and a delivery report through the RPC (audited)".
- [x] **Commitments are written only through the RPC and carry an audit row.**
  - local: "the table is RPC-only; a direct insert is refused; commitProvision writes the row with an audit row and a ledger row"; "refusals are audited: partner users and HR cannot commit…"; "revise keeps started terms locked…; HR acknowledges or queries".
  - SQL: "acceptance (FS64): commitments are written only through commitProvision… with an audit row and a ledger row", "writes only through the RPCs (no direct update…, no direct pledge insert)".
- [x] **Adjustment: OwnOrg rules for commitments; released/suppressed rows for demand (policy.ts caveat).** local "partner isolation: alnoor-gm never sees gulfhydro-qa rows and vice versa…"; SQL "RLS: released aggregates for every ecosystem reader… organisation rows OwnOrg only…", "partner isolation: another organisation's commitment reads as not found (revise and delivery), and the refusal is audited"; pages "another organisation's commitment reads as not found".
- [x] **Adjustment: persona coverage.** `alnoor-gm`, `gulfhydro-qa` (supabase partner admins) in local + PGlite; `k-university` university flows tested on local ("university flows (local backend)…") and its SQL path in PGlite (test profile).
- [x] **FS64 <- FS51:** demand rows come only from a `released` FS51 forecast's stored results (`kafaa_skill_forecasts`); the partner never reads `skill_forecasts` (RLS test).

### FS65 Skills pledges ledger
- [x] **Pledged, started and completed never merge into one number.** local "three separate columns and three separate ledger cells; no total anywhere"; **"no code path sums them: no expression in M36 (TS and SQL) adds pledged, started or completed to one another"** (the adjustment's unit test; scans M36 TS, the migration and the seed builder); pages "staff: three separate tiles (pledged, started, completed)…".
- [x] **Small counts are suppressed.** local "a cell is suppressed under 10 people or under two organisations…", "the seeded ledger suppresses single-organisation and small cells and shows nothing below 10", "the ledger RPC is open to ecosystem readers only and names no organisation or pledge"; SQL "acceptance (FS65): ledger SQL kafaa_pl_ledger = TS pledgeLedger on 5 days…", "pledgeLedger: staff and partner users read the aggregate ledger (TS = SQL)…".
- [x] **Each pledge names its organisation, skill area and date.** local "every seeded pledge names its organisation (EN/AR), a skill area and a target date…", "registerPledge: partner admins for their own organisation, HR for ENEC entities only; a pledge without area or date is refused (audit + ledger)"; SQL "acceptance (FS65): each pledge names its organisation…", "registerPledge: …", "recordPledgeProgress: own organisation only…"; pages "partner admin: our pledges only, each with organisation, area and date; the drawer records progress through the RPC".
- [x] **RBAC: OwnOrg W; ecosystem R aggregates.** Rows OwnOrg only (RLS + local), aggregates for every ecosystem reader (staff, partner users, university, HR), observers and applicants refused.

### Every module
- [x] Placeholders replaced (6 new routes, real pages); loading / empty / error via `<Async>`; `data-testid="m36-*"` on lists and actions; `<ConfirmDialog>` before every consequential RPC; `<BenchmarkChips feature="FS64" />` / `"FS65"` on every page (chips test); `<WhyThis>` on demand rows, commitment statuses and pledge statuses; SIMULATED + SAMPLE labels on every page; EN + AR complete, logical RTL classes only (the gap bar uses `insetInlineStart`), numbers and dates through `useFormat()`; "renders in Arabic" test.
- [x] Synthetic only: commitments and pledges are `sample: true`; two new synthetic providers; no real person; no regulatory claim; no external fact typed into copy (test "synthetic only…").

## Routes (+6; pins left to the integration lead: 338 -> 344 with M36 alone)
| id | path | guard | nav |
|---|---|---|---|
| `ecosystem-regional-plan` | `/ecosystem/regional-plan` | ecosystem R/Agg/W/A/OwnOrg/OrgW | partner · partner 8 |
| `ecosystem-commitments` | `/ecosystem/regional-plan/commitments` | ecosystem OwnOrg/OrgW/Agg/A or auditor | my · workforce 68.6 |
| `ecosystem-commitment` | `/ecosystem/regional-plan/commitments/:id` (smoke `pc-org-alnoor-1`) | as above | — |
| `ecosystem-demand-release` | `/ecosystem/regional-plan/release` | workforce_strategy Agg/W/A | — |
| `ecosystem-pledges` | `/ecosystem/pledges` | ecosystem R/Agg/W/A/OwnOrg/OrgW | my · future 24.5 |
| `ecosystem-pledges-register` | `/ecosystem/pledges/register` | ecosystem OwnOrg/OrgW/Agg/A or auditor | — |

## Tables and RPCs
- Tables (M36, RPC writes only): `kafaa_regional_demand`, `kafaa_provider_commitments`, `kafaa_pledges`, `kafaa_pledge_progress`. RLS in the per-statement form (see CONTRACT entry for the rules).
- RPCs (authenticated only): `kafaa_release_regional_demand(p)`, `kafaa_commit_provision(p)`, `kafaa_report_commitment_delivery(p)`, `kafaa_review_commitment(p)`, `kafaa_register_pledge(p)`, `kafaa_record_pledge_progress(p)`, `kafaa_pledge_ledger()`. Internal (no API role): `kafaa_rg_rows`, `kafaa_rg_term_ord`, `kafaa_rg_term_of_ord`, `kafaa_rg_term_start`, `kafaa_rg_term_end`, `kafaa_rg_term_state`, `kafaa_rg_first_open`, `kafaa_rg_locked`, `kafaa_rg_is_int`, `kafaa_rg_txt`, `kafaa_rg_commit_problem`, `kafaa_rg_delivery_problem`, `kafaa_rg_status`, `kafaa_pl_date`, `kafaa_pl_problem`, `kafaa_pl_progress_problem`, `kafaa_pl_status`, `kafaa_pl_cell`, `kafaa_pl_count`, `kafaa_pl_ledger`.
- No shared function is redefined (FS51 forecast results and `kafaa_so_text_clean` are read only). No evidence is written (no new recorded-evidence `ref_table`).

## Local function md5s (PGlite, `md5(prosrc)`, first 8)
27 new function bodies (no shared function redefined):

| function | md5 |
|---|---|
| `kafaa_commit_provision` | `f271aa57` |
| `kafaa_pl_cell` | `15e308d3` |
| `kafaa_pl_count` | `56557d0b` |
| `kafaa_pl_date` | `180547dd` |
| `kafaa_pl_ledger` | `656fa3e5` |
| `kafaa_pl_problem` | `9a4234d1` |
| `kafaa_pl_progress_problem` | `e05535af` |
| `kafaa_pl_status` | `5a3fb9e6` |
| `kafaa_pledge_ledger` | `1254cd32` |
| `kafaa_record_pledge_progress` | `de91157d` |
| `kafaa_register_pledge` | `14e7c1b4` |
| `kafaa_release_regional_demand` | `8e7ce8ee` |
| `kafaa_report_commitment_delivery` | `adb7f39e` |
| `kafaa_review_commitment` | `d9964ba3` |
| `kafaa_rg_commit_problem` | `6a5b4584` |
| `kafaa_rg_delivery_problem` | `47506f20` |
| `kafaa_rg_first_open` | `63b341a3` |
| `kafaa_rg_is_int` | `8277ab18` |
| `kafaa_rg_locked` | `4720d501` |
| `kafaa_rg_rows` | `43987af6` |
| `kafaa_rg_status` | `b5f017e8` |
| `kafaa_rg_term_end` | `d1df08fc` |
| `kafaa_rg_term_of_ord` | `6294d02c` |
| `kafaa_rg_term_ord` | `1ae0d2bb` |
| `kafaa_rg_term_start` | `39bfb59c` |
| `kafaa_rg_term_state` | `dec569d4` |
| `kafaa_rg_txt` | `70e4d66c` |

## Table digests (count, `left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`)
| table | rows | digest |
|---|---|---|
| `kafaa_regional_demand` | 30 | `6c4b3202` |
| `kafaa_provider_commitments` | 13 | `6f3bd353` |
| `kafaa_pledges` | 16 | `2d80ed55` |
| `kafaa_pledge_progress` | 35 | `c978eac9` |
| `kafaa_organisations` where id in (`org-dhafra-tech`, `org-ruwais-vti`) | 2 | `932c09ad` |

Seed: 35,471 rows across 329 tables (+96: 2 organisations, 30 demand rows, 13 commitments, 16 pledges, 35 snapshots).

## Live apply (for the session that applies wave G)
1. Apply `20261010273001_kafaa_fs73_regional_pledges.sql` (suggested parts: `kafaa_fs73_regional_pledges_p1` = tables, constraints, indexes, RLS and grants on tables; `_p2` = the `kafaa_rg_*` / `kafaa_pl_*` helpers; `_p3` = the seven RPCs and the function grants). Prerequisite: wave F live (`kafaa_skill_forecasts` exists, FK target) and `kafaa_so_text_clean` (F35).
2. Seed, `insert … on conflict (id) do nothing`, in this order: the 2 `kafaa_organisations` rows `org-dhafra-tech`, `org-ruwais-vti` (shared M09 table, new rows only); `kafaa_regional_demand` (30); `kafaa_provider_commitments` (13); `kafaa_pledges` (16); `kafaa_pledge_progress` (35). No guarded UPDATE of existing live rows is needed.
3. Compare the md5s and digests above; check grants (`anon` executes nothing new).

## Gates (from `kafaa/`)
- `npm run gen`: OK; regenerating leaves the generated files byte-identical (md5 before = after). Seed line: `fs64/65: regional release rdr-2025-1 (30 rows, 10 areas, from sf-2025-v1); 13 provider commitments by 7 providers; 16 pledges by 11 organisations, 35 progress snapshots; 2 synthetic providers added`.
- `npm run check:i18n`: OK (40 namespaces, EN/AR parity). `npm run typecheck`: clean. `npm run check:public`: OK (75 public tables, no personal columns).
- `npm run migrations:validate`: **All migration checks passed** (81 migrations + seed applied twice; the new `fs73-regional-pledges` validator: 26 checks green, plus every existing validator).
- `npx vite build`: OK (known chunk-size warning only).
- Unit tests, one file per process (`TMPDIR=/dev/shm/... npx vitest run --maxWorkers=1 --minWorkers=1`): `fs73-regional-pledges.test.ts` 23/23, `fs73-pages.test.tsx` 10/10, directly affected `m14-rbac.test.ts` 291/291 (every persona x every table incl. the four new ones), `fs63-engine-lint.test.ts` 13/13 (no new ranked surface).
- **Not run here:** `m09-partners.test.ts` (the only other file near the shared seed change: two non-public synthetic organisations; its organisation assertion counts anonymous, publicly listed rows, which do not change). It was killed three times by the container's memory limit while other agents ran vitest beside it; please run it in the wave-G suite. The route-count pin files fail by design until the integration lead moves the pins (+6).
- Playwright / browsers: not run (engineer slot).

## Gaps and hand-offs for the integration lead
1. **Route-count pins:** M36 adds 6 routes (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..6-integration`, `tests/e2e/sweep.spec.ts`).
2. **Partner isolation (wave G QA checklist):** RLS tests and local tests prove `alnoor-gm` never sees `gulfhydro-qa` rows in FS64/FS65 (and vice versa); add M36 to the sweep (`E2E_MODULES=M36`).
3. **Shared seed rows:** two synthetic providers added to M09 `organisations` (kind university, category synthetic, not publicly listed). If a wave-G test or the sweep counts university organisations, update it; `check:public` is green.
4. **Optional wiring:** the M09 partner home (`/partner`) and the M10 university page could link `/ecosystem/regional-plan` and `/ecosystem/pledges/register`; FS82/FS83 (wave I, M36) can build on `provider_commitments` and `pledges` (the rules files are import-free).
5. **Engine card:** none needed (M36 ranks no list; demand rows are a sorted table). If QA decides the "gap" sort is a ranked surface, add a `RANKED_SURFACES` entry in the QA migration.
6. **Live:** the 2026 FS51 annual refresh is intentionally not shared with providers in the seed (the HR director's demo action). After a live demo release, `kafaa_regional_demand` holds extra live rows (expected digest drift, like other journey tables).
7. Seed free text of commitments and pledges is bilingual (EN/AR columns); commitment HR notes are entered in English only.
