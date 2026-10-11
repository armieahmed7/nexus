# fsDe4 DONE: FS34 Transferable-skills translator + FS35 Career Health check (M18)

Branch `fsDe4`, worktree `/workspace/kafaa-fsDe4`, commit `11b6dfc` (not pushed). Netlify not touched; no Playwright run.

## Acceptance

### FS34 · Transferable-skills translator (`/careers/translate`)
- [x] **The anonymous run writes nothing and stores nothing.**
  - `fs44-pages` "anonymous: picks an occupation…" spies every `b.rpc` function, `insert`/`update` and `Storage.prototype.setItem`/`removeItem` across the whole pick → results → reasons flow and asserts zero calls.
  - `translate()` is pure, and the public page computes it client-side from public tables.
- [x] **Each result lists its delta skills and bridging items with reasons.**
  - Results carry gaps (delta skills) and a bridge route: FS19 cross-over course first, then public courses, then supervised practice. Each item shows hours and weeks, and the route shows totals in hours, weeks and months.
  - Every result and every route item has `<WhyThis>`. Reasons use `fs34_*` codes and `m18.fs34.reason.*` keys, lint-clean.
  - Tests: `fs44-translator-health` "each result lists its delta skills…" and the page test (gaps `li`, bridge `li[data-kind=crossover]` first, one item-why per item).
- [x] **At least 8 source occupations (there are 12), each with an ESCO-aligned skill set and a cited source.**
  - Real ESCO v1.2 concept URIs, codes, and EN/AR labels from the ESCO API.
  - 33 skill ties are "exact" through the FS08 `skill_alignments`; the rest are "related".
  - Each occupation has a source link to its ESCO occupation page, dated as of 2026-10-11.
  - Industries covered: oil_gas, power, process, aviation, defence, utilities.
- [x] **Staff version runs on my own passport.**
  - A "From my skills passport" tab calls `rpc.translateMine` (skills_profile Own, staff only, read-only) and excludes my current role.
  - Anyone else gets a refusal.
- [x] **Extras.**
  - Security, safeguards, cyber, concept and corporate roles are never proposed.
  - Route data shows the "Why now" figures and BenchmarkChips UK-NUC, SMR-WF and ESCO, with figures read from `kafaa_benchmarks`.
  - The Method section is open.

### FS35 · Career Health check (`/my/career/health`)
- [x] **All five components are shown with their inputs, and there is no single hidden score.**
  - The five components are currency, breadth, recency, mobility and change (change comes from the FS11 2030 map).
  - Each card shows its value, unit, status, input key-values, the rule text, refs and `<WhyThis>`.
  - The summary is the count "n of 5 in good shape", not a score.
  - The test asserts that no "score:" text appears.
- [x] **A manager cannot read another person's health snapshot.**
  - RLS on `kafaa_health_snapshots` uses own_profile, Own only.
  - The PGlite validator and the unit test show that sro (the manager), chco, the HR analyst, the auditor, the admin, the training manager and anon all see 0 of k-ro's rows. The owner sees 3.
- [x] **The Execute step books a career conversation through the existing F12 RPC.**
  - It calls `rpc.submitPrep(prep, true)`, then `saveHealthSnapshot({snapshot_id, conversation_id})`, and the step becomes `executed`.
  - Only my own conversation can be linked, and only once its prep has been submitted.
  - The prep payload carries no health data (tested).
- [x] **Assess → Chart → Execute stepper.**
  - Chart: suggested actions plus refresh, broaden, learn, explore, bridge and conversation; a focus role; a review date; and a note of up to 600 characters.
  - History chart and table.
  - Benchmarks SG-CAREER and WEF-FOJ.
  - A visible privacy note ("never shown to managers or used in talent review").

## Routes (+2; route-count pins left to the integration lead)

| Route | Path | Guard | Nav |
|---|---|---|---|
| `careers-translate` | `/careers/translate` | public | public careers 11.9 |
| `my-career-health` | `/my/career/health` | signedIn + skills_profile Own | my career 18.3 |

## Data, RPCs, migration

**Tables**
- `kafaa_occupation_templates`: public read where `listed`; no writes.
- `kafaa_health_snapshots`: own_profile Own read; writes through RPC only.

**RPCs** (granted to authenticated only)
- `kafaa_translate_mine()`
- `kafaa_career_health()`
- `kafaa_save_health_snapshot(p_input)`: audited (`career_health.save`), no ledger.

**Internal functions** (revoked from public, anon and authenticated)
- `kafaa_fs34_{r,name,profile,coverage,course_for,translate}`
- `kafaa_fs35_{r,pct,band,currency,health,plan}`

**Migration** `supabase/migrations/20261010244001_kafaa_fs44_translator_health.sql` is additive, with no DROP.

**Live** (Supabase hlirqxoddysxtdezwcgv), applied in 3 parts:
- `kafaa_fs44_translator_health_part1_tables_rls`
- `kafaa_fs44_translator_health_part2_fs34_rules`
- `kafaa_fs44_translator_health_part3_fs35_rules_rpcs`

Seed rows were loaded with `insert … on conflict (id) do nothing`.

**Live vs local verification**

| Check | Result |
|---|---|
| Templates | 12 rows; digest `419cdfff2992cf76c216a3ee5602ad54` = local |
| Snapshots | 43 rows; metadata digest (id, person, as_of, role, plan, step, conversation) `56d2b2a9f8953621da292a4549b3fdcd` = local |
| Functions | 15; md5 over name + args + md5(prosrc) + secdef `af9ed3fb2509e302025ffed1be3946ef` = local |
| Grants | anon executes none; authenticated executes only the 3 RPCs (same as local) |
| Anon RLS | 12 templates and 0 snapshots |

**Snapshot components were computed live** by `kafaa_fs35_health` at load time. The function bodies are identical to local. The component digest differs from the seed (live `5e70df93…` vs local `8ff774c4…`) in 2 of 43 rows: p-nse and p-rao. Live `kafaa_person_skills` has more rows than the seed for these two people (16 vs 14 and 22 vs 19; last updated 2026-10-10/11, written by other features after seeding). The live rows therefore reflect live data, as intended.

## Tests and gates
- `tests/unit/fs44-translator-health.test.ts` (10) and `tests/unit/fs44-pages.test.tsx` (5): 15/15 pass. Every acceptance criterion has a named test.
- `scripts/validate/fs44-translator-health.mjs` (PGlite) passes:
  - translate SQL = TS for 12 templates and 87 staff passports;
  - health SQL = TS for 107 staff × 3 dates;
  - RLS, RPC refusals and audit;
  - no direct inserts;
  - internal functions not executable.
- gen OK, check:i18n OK (EN/AR parity, 238 new keys), typecheck clean, check:public OK, migrations:validate passes (exit 0), build OK.
- Full unit suite (125 files). Memory and disk pressure from other agents OOM-killed the parallel run, so I re-ran the remaining 59 files one at a time.
  - Everything passes except the expected route-count pins, which are +2 from my routes: w4-integration (259), w5-integration (212), fs11-foundation, fsqa1, fsqa2 and fsqa3.
  - One pre-existing failure: g1-pages "a shift supervisor sees crew availability…". It fails the same way on base commit `ffbf00f` and is date-dependent M03 data, not M18.

## Gaps and notes
- **Disk was full** (ENOSPC). To free about 6 GB, I removed 68 stale vitest temp dirs in /tmp that were more than 6 hours old and held only `ssr/`. No other files were touched.
- **Route-count pins** (`w4-integration` 259 and `w5-integration` 212, plus any other fs*/fsqa pins) fail by +2 because of my 2 new routes. I left them to the integration lead. All 261 route guards parse.
- **Seed is honest, not tuned.** Seeded evidence is recent, so currency is 100% for every persona. Most personas have no learning records in the last 12 months, so recency is "act" for them.
- **Shared couplings** are data-only reads of F12 conversations (`submitPrep`), FS11 (`transformRole` / `kafaa_rt_map`), FS19 cross-over `course_pack_items` and FS08 `skill_alignments`. They are logged in the CONTRACT.md changelog.
