# fsGe1 DONE: FS60 ISO 30414 skills and capability disclosure pack and FS61 skills pilots registry (FS wave G · E1, M35)

Branch `fsGe1`, cut from `fsF-integration-qa` (stacked; not merged anywhere). Nothing was applied to live Supabase.

ENEC NEXUS / Kafa'a is a demo and is not affiliated with ENEC. Every person is synthetic (role cards), every number is labelled SIMULATED, and the disclosure pack states that Kafa'a is not an auditor or a certification body.

## Acceptance (one named test per criterion)

Logic tests: `kafaa/tests/unit/fs71-disclosure-pilots.test.ts`. Page tests: `kafaa/tests/unit/fs71-pages.test.tsx`. SQL side: `kafaa/scripts/validate/fs71-disclosure-pilots.mjs` (PGlite).

- [x] **FS60-1: no metric publishes without a narrative and a second approver.**
  - "approveDisclosure refuses a line without a narrative, a line the approver wrote (maker-checker) and anyone but the HR director; a complete line approved by a second person publishes"
  - "the seeded quarters keep the rule: every approval sits on a complete EN/AR narrative written by someone else; the pack carries no value for an unapproved line"
  - "saveDisclosure: HR analysts and the HR director only; an open quarter, an approved line and an incomplete narrative are refused (local = SQL messages)"
  - Pages: "HR director: the 2026-Q3 disclosure with computed values, line states, the maker-checker block on his own line, the missing narrative block, and FS60 chips"; "HR director approves a ready line after the confirmation: one audit row and one ledger row; the line publishes"; "HR analyst writes the missing narrative (EN and AR) through the editor ..."; "the print pack shows values only for approved lines and says SIMULATED".
  - Validator: "acceptance (FS60): no metric publishes without a narrative (no_narrative) and a second approver (maker_checker) ...", "approveDisclosure: the analyst rewrites ... with every line approved by a second person the disclosure publishes and freezes", "export pack: SIMULATED ... a line without approval carries no value".
- [x] **FS60-2: every value reproduces from its formula (TS = SQL).**
  - "computeDisclosure (RPC) equals the formula on the raw tables for every quarter, and the stored seed values equal a recompute"
  - "the formula by hand: trained share, learning hours (training records counted once) and credits for 2026-Q3 match an independent count"
  - "approveDisclosure refuses stale values: new learning after the save must be recomputed (saved again) before approval"
  - "rules: quarter bounds, closed and computable periods, ISO 8601 durations (= M27 durationMinutes), variance on the unit scale"
  - Validator: "SQL kafaa_hcd_compute = TS computeDisclosure for 8 quarters", stale check with an inserted training record (SQL recompute = TS), "kafaa_hcd_minutes = minutesOf", "kafaa_hcd_bounds = periodBounds", "kafaa_hcd_line_problem = lineProblem", "seed: every stored disclosure value equals computeDisclosure on the seed".
- [x] **FS60-3: all cells under 10 are suppressed.**
  - "a group of 9 is suppressed and a group of 10 is shown; people counts under 10 never appear; a headcount under 10 suppresses everything"
  - "the seeded disclosure suppresses every small group and reads site, shift crew and grade only (never nationality or gender)"
  - Validator: "acceptance (FS60): all cells under 10 are suppressed (people counts, group sizes and their shares); no result names a person", "participation equity reads site, shift crew and grade only".
- [x] **FS61-1: a pilot cannot close without an evaluator sign-off.**
  - "closing a running pilot is refused; only the named evaluator signs off (ledger); then HR closes it (ledger); the evaluator never closes their own evaluation"
  - "the evaluator is independent: never the owner or the person registering the pilot (TS check = SQL messages)"
  - Page: "a running pilot cannot close before the evaluator signs off; a signed-off pilot closes after the confirmation (ledger)"; "the named evaluator signs off a running pilot on the staff page (audit + ledger)".
  - Validator: "acceptance (FS61): a pilot cannot close without the evaluator's sign-off ..."; check constraint `kafaa_skill_pilots_signoff_ck` ("check constraints: a pilot cannot close without the named evaluator's sign-off ...").
- [x] **FS61-2: failed pilots stay visible.**
  - "both seeded failures are closed, published and read by staff; a failure closed now is published too; a closed pilot can no longer be edited"
  - Page: "staff: published results only, both failures visible with their badge ..."
  - Validator: RLS (staff read the 8 published results incl. both failures), check constraint `kafaa_skill_pilots_published_ck` (closed => published), "closing publishes it and the failure stays visible to staff".
- [x] **FS61-3: the adoption rate is computed from pilot statuses and shows the Future Skills Centre reference with its source.**
  - "pilotStats = adoptionRate over the rows; the reference is the FSC figure from kafaa_benchmarks with its https source; the 78 is never typed into copy"
  - "adoptionRate: adopted, expanded and further funded count; failures stay in the denominator; no closed pilot gives no rate"
  - Page: "registry: the adoption rate computed from statuses (75%) against the FSC reference read from the benchmark registry, failures in the counts, FS61 chips"
  - Validator: "acceptance (FS61): the adoption rate is computed from pilot statuses (SQL = TS: 75 %) and the reference (78 %) is read from kafaa_benchmarks with its https source".
- Also covered: RBAC (who reads the pack and the registry; staff published-only; evaluator rows), routes and guards, benchmarks, EN/AR route titles, Arabic rendering, the metric library with the ISO 30414 registry fact.

## Routes (+6)

| id | path | guard | nav |
|---|---|---|---|
| workforce-disclosure | /workforce/disclosure | workforce_strategy R/W/A | 68.3 under workforce |
| workforce-disclosure-metrics | /workforce/disclosure/metrics | workforce_strategy R/W/A | |
| workforce-disclosure-pack | /workforce/disclosure/:period/pack | workforce_strategy R/W/A | (smoke `2026-Q2`) |
| workforce-pilots | /workforce/pilots | workforce_strategy Agg/R/W/A | 68.4 under workforce |
| workforce-pilot | /workforce/pilots/:id | workforce_strategy Agg/R/W/A | (smoke `sp-vr-outage-brief`) |
| skills-pilots | /skills/pilots | internal_content R (staff) | my / growth 27.9 |

Route-count pins are left to the integration lead: 338 -> 344 (M35 +6).

## Tables and RPCs

Migration `kafaa/supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql` (additive, idempotent, no removal words, ALTER only on its own new kafaa tables, RLS in the perf form, no shared function redefined: `kafaa_air_people`, `kafaa_crs_board_core`, `kafaa_crs_quarter` are only called). Live part suggestion: one part `kafaa_fs71_disclosure_pilots_p1` (the file is ~60 KB; split after the FS60 RPCs if the tool needs smaller parts).

**Tables:** `kafaa_hc_metrics` (7, write mode none), `kafaa_hc_disclosures` (2, rpc), `kafaa_skill_pilots` (11, rpc). Checks: `kafaa_hc_disclosures_simulated_ck`, `kafaa_skill_pilots_independent_ck`, `kafaa_skill_pilots_signoff_ck`, `kafaa_skill_pilots_published_ck`.

**RPCs** (SECURITY DEFINER, `authenticated` only): `kafaa_compute_disclosure(p_period)`, `kafaa_save_disclosure(p)`, `kafaa_approve_disclosure(p_id, p_metric_ids jsonb)`, `kafaa_pilot_stats()`, `kafaa_save_pilot(p)`, `kafaa_signoff_pilot(p_id, p)`, `kafaa_close_pilot(p_id, p_adoption)`.

**Helpers** (executable by no API role): `kafaa_hcd_bounds`, `kafaa_hcd_computable`, `kafaa_hcd_closed`, `kafaa_hcd_minutes`, `kafaa_hcd_len`, `kafaa_hcd_bi`, `kafaa_hcd_line_problem`, `kafaa_hcd_materiality_ok`, `kafaa_hcd_compute`, `kafaa_spl_num`, `kafaa_spl_date_ok`, `kafaa_spl_group_ok`, `kafaa_spl_problem`, `kafaa_spl_signoff_problem`, `kafaa_spl_close_problem`, `kafaa_spl_adoption`, `kafaa_spl_reference`.

**Ledger actions:** `kafaa.workforce.hc_disclosure_approve`, `kafaa.workforce.pilot_signoff`, `kafaa.workforce.pilot_close`. **Audit actions:** `disclosure.compute` (refusals), `disclosure.save`, `disclosure.approve`, `pilot.stats` (refusals), `pilot.save`, `pilot.signoff`, `pilot.close`.

### Function md5 (first 8 hex of md5(prosrc), local PGlite)

```
kafaa_approve_disclosure=79fb45b0 kafaa_close_pilot=f9ce3a45 kafaa_compute_disclosure=9c443206
kafaa_hcd_bi=d40e5f85 kafaa_hcd_bounds=f2644e7a kafaa_hcd_closed=3fcaf040 kafaa_hcd_computable=c65c3db7
kafaa_hcd_compute=393bd380 kafaa_hcd_len=9ba4c161 kafaa_hcd_line_problem=151597b3 kafaa_hcd_materiality_ok=6ceda4f6
kafaa_hcd_minutes=bd6fa7a6 kafaa_pilot_stats=ae05da5a kafaa_save_disclosure=deed545b kafaa_save_pilot=f327d37d
kafaa_signoff_pilot=55a7678c kafaa_spl_adoption=831ac6b4 kafaa_spl_close_problem=76bb0db3 kafaa_spl_date_ok=8f3b2e06
kafaa_spl_group_ok=9b412526 kafaa_spl_num=7420cec9 kafaa_spl_problem=48b9f8fa kafaa_spl_reference=273d2fb5
kafaa_spl_signoff_problem=fac6276a
```

### Table digests (row count, first 8 hex of md5 of the ordered rows)

```
kafaa_hc_metrics 7 174d2ee9
kafaa_hc_disclosures 2 74a1adb8
kafaa_skill_pilots 11 e095feb7
```

Live load after the migration: `insert ... on conflict (id) do nothing` for the three tables (hc_metrics before hc_disclosures; skill_pilots needs `kafaa_people` rows `p-*` that are already live). No guarded UPDATE of an existing live row is needed. The values in `hcd-2026-Q2` / `hcd-2026-Q3` are computed on the full local seed; on live they reproduce only if the live input tables (training records, LRS statements, credit ledger, skill states, register) equal the local seed: the approve RPC refuses `stale` otherwise, and the HR analyst's "Recompute values" (saveDisclosure) refreshes the unapproved lines.

## Seed (`kafaa/scripts/seed/ext/fs60-iso30414.mjs`, FINALIZE_LAST)

- 7 metrics mapped to the ISO 30414 area "Skills, Capabilities and Development" (trained this year, quarterly active learners, learning hours per employee, AI-fundamentals coverage, critical future skills on track, learning credits per employee, participation gap by site / shift crew / grade), each with definition, formula, source, owner (role card) in EN and AR.
- `hcd-2026-Q2` published (HR analyst prepared, HR director approved all 7 lines); `hcd-2026-Q3` in review: 2 approved, 3 ready, `hcm-critical` written by the HR director himself (he cannot approve it; the analyst rewrites it in the demo), `hcm-participation` without a narrative. 2026-Q3 values: trained this year 64.2 %, quarterly active 60.4 %, learning hours 10 h per employee, AI fundamentals 89.6 %, critical skills on track 62.5 %, learning credits 2.91 per employee, participation gap 72.7 points.
- 11 pilots: 8 closed (3 adopted, 1 expanded, 2 further funded, 2 failed and not adopted), `sp-ai-literacy-nudges` signed off waiting for HR, `sp-adaptive-requal` running with the independent approver (a NEXUS role card) as evaluator, `sp-rotation-buddies` draft. Adoption 6 of 8 = 75.0 % against the FSC reference figure read from `kafaa_benchmarks` (never written into copy).
- Supabase demo path (only `chco` holds workforce_strategy W/A there): `chco` approves the seeded analyst lines; `independent-approver` signs off `sp-adaptive-requal` on `/skills/pilots`; `chco` closes it and `sp-ai-literacy-nudges`.

## Tests and gates

All run from `kafaa/` on branch `fsGe1`:

- `npm run gen`: stable (outputs identical before and after a second run)
- `npm run check:i18n`: pass
- `npm run typecheck`: pass
- `npm run migrations:validate`: "All migration checks passed" (includes `fs71-disclosure-pilots.mjs`: TS = SQL for 8 quarters, RLS per role, save/approve/sign-off/close flows, check constraints, grants)
- `npm run check:public`: pass
- `npx vite build`: built (exit 0)
- Unit tests, one file at a time:
  - `tests/unit/fs71-disclosure-pilots.test.ts`: 16/16 (a named test per FS60/FS61 acceptance criterion)
  - `tests/unit/fs71-pages.test.tsx`: 10/10 (EN + AR rendering, approve, narrative editor, pack, registry, sign-off, close)
  - `tests/unit/fs61-strategy-forecasts.test.ts`: 26/26 (shared edit, see below)
  - `tests/unit/m14-rbac.test.ts`: 291/291
  - `tests/unit/g3-routes.test.ts`: 271/271
- No Playwright (as instructed).

## Decisions, deviations and gaps (for the integration lead)

1. **RBAC deviation (logged):** the FS60 pack reads with workforce_strategy R/W/A, not the M35 `agg_ok` rule, because the card says "workforce_strategy A; auditor R; never public": the training manager (Agg only) does not open the pack. FS61 registry keeps Agg/R/W/A; staff read published pilots through `internal_content` R; the evaluator reads own rows through `own_profile`. No new resource or grant.
2. **Figures:** the FSC 78 % is read from `kafaa_benchmarks` (RPC + `<BenchmarkLine>`); the ISO 30414 fact from its registry row; EU-PACT / UAE-PEERS figures (held back as secondary by FS53) appear only in the shared benchmark chips, never as KPI lines.
3. **Point-in-time metrics:** AI-fundamentals coverage and critical skills on track are measured on the computation day (no historical skill states), so a past quarter recomputed later gives today's value; approved lines are frozen at approval and the stale check runs at approval time. Documented in the metric definitions.
4. **Seed order:** values are computed in my finalize on a read-only view that applies fsqa4's credit-ledger rebuild. If a wave-G builder sorting after `fs60` (fs62..fs68) or fsqa7 changes training records, LRS statements, the credit ledger, skill states or the FS50 register, call `recomputeDisclosures(T)` (exported) in fsqa7 and re-check `fs71` (the validator's "seed: every stored disclosure value equals computeDisclosure on the seed" will flag it).
5. **Shared test edit (logged):** `tests/unit/fs61-strategy-forecasts.test.ts` now checks the seven FS50/FS51 routes by id prefix instead of the whole M35 route list (M35 gained the FS60/FS61 routes).
6. **Route-count pins** (338 -> 344) in the pin files listed in handover 3.11 are left for the integration lead.
7. **No ranked surface** was added (the disclosure lines and pilots are not ranked), so no engine card / FS55 lint entry is needed; `<WhyThis>` explains each metric value.
8. Seeded narratives are templated from the computed values (EN/AR), so they always match the numbers.
