# fsFe2 DONE: FS52 AI and automation exposure in the skills outlook + FS53 external benchmark lines (wave F, M07)

Branch `fsFe2` (stacked on `fsE-integration-qa`, never on `main`). Worktree `/workspace/nexus-fsFe2`. Nothing applied live (no Supabase access in this session).

## Acceptance (card + handover section 4 adjustments)

| Criterion | Test (file > name) |
|---|---|
| FS52 · With adoption 0 the outlook equals today's results exactly (byte for byte, key absent or 0) | `tests/unit/fs62-outlook-automation.test.ts` > "A1: with adoption at 0 the outlook equals today's stored results exactly (byte for byte, key absent or 0)"; "A1: adoption 0 normalises to the F35 parameters, ..."; PGlite `fs62-outlook-automation.mjs` "acceptance (FS52): ... byte for byte (TS)" + "SQL kafaa_so_for with adoption 0 (key absent or 0) equals all 5 stored outlooks"; seed builder `fs52-outlook-automation.mjs` finalize fails the build otherwise |
| FS52 · F35 stress test still reads 10 of 10 | same A1 test; PGlite "F35 stress test still reads 10 of 10 visible families short" |
| FS52 · TS and SQL agree for 52 assumption sets (PGlite) | PGlite "acceptance (FS52): TS and SQL agree for 52 assumption sets (normalisation, outlook with the automation factor, driver and tornado, automation profile)"; unit "A2: the 52 assumption sets of the PGlite parity check are valid and deterministic, ..." |
| FS52 · The automation assumption appears in the tornado chart with its range | unit "A3: the automation assumption appears in the tornado chart with its range ..."; page `tests/unit/fs62-pages.test.tsx` > "FS52 A3: the tornado shows the AI and automation assumption with its 0-60 % range at adoption 0; ..."; PGlite "acceptance (FS52): the automation assumption appears in the tornado with its range 0-60 %" |
| FS52 · factor per family from FS06 task exposure, adoption slider, everything SIMULATED | unit "task exposure per family comes from the FS06 task layer ...", "the automation share phases in over three years ...", "demand falls with adoption ..."; page "FS52: moving the adoption slider (or a preset) narrows the outlook ..." |
| FS52 · RBAC: existing F35 rules | unit "HR director, HR analyst and auditor read the automation profile; managers, observers, staff and anonymous are refused (audited)"; PGlite "RBAC (existing F35 rules): ..." |
| FS53 · Every external value links its source and date | `tests/unit/fs62-market.test.ts` > "A1: every external value is a copy of a sourced FS01 figure and links its https source and as-of date"; page "FS53 A1 + A3: market lines carry source, as-of date ..."; PGlite "acceptance (FS53): every external value is an exact copy ..." + guard parity on 23 mutants |
| FS53 · No external value is ever summed with an internal one (unit test) | unit "A2: no external value is ever summed with an internal one"; PGlite "acceptance (FS53): no SQL function reads kafaa_benchmark_values besides its guard ..." and "summing a market value with measured values is refused (TS rule)" |
| FS53 · The two stylings are distinguishable without colour (label and line pattern) | unit "A3: the two stylings differ in label and line pattern (not only colour), in English and Arabic"; page "FS53 A1 + A3: ..." (data-pattern dashed/solid + labels) |
| FS53 · only figures not marked secondary/unverified (settled decision) | unit "only figures the research packs treat as primary are drawn; secondary ones are held with a reason (settled decision)"; PGlite "seed: 10 benchmark values, 4 drawn (all primary ...), 6 held back with a reason" |
| FS53 · RBAC: staff R where the dashboard is visible | unit "schema: seed-only reference table read wherever a workforce dashboard is visible"; PGlite "RLS (FS53 staff R where the dashboard is visible) ..."; page "FS53 on the workforce overview for a line manager ..." |
| EN + AR, RTL | page "renders in Arabic: automation card and market labels in Arabic"; `npm run check:i18n` |
| BenchmarkChips FS52 / FS53 | page tests (automation card `benchmark-chips`, market panel `benchmark-chips`) |

## Routes

No new route. Changed pages: `/workforce/skills-outlook` (`workforce-skills-outlook`: adoption slider + presets, automation bar in the tornado, automation card, market panel; line managers get the released-outlook market panel) and `/workforce` (`workforce`: market panel from the latest released outlook). Route-count pins unchanged (315).

## Tables, RPCs, SQL

- Table `kafaa_benchmark_values` (M07 `benchmark_values`, write mode none, read `workforce_analytics` Agg/R via `agg_ok`; FK to `kafaa_benchmarks`; trigger `kafaa_bv_guard_trg`). 10 seed rows (4 drawn, 6 held).
- RPC `outlookAutomation(params)` = `kafaa_outlook_automation(p_params jsonb)` (authenticated; HR analyst / HR director / auditor; refusals audited `outlook.automation`). `computeOutlook` accepts `automation_adoption`.
- Internal (no API role): `kafaa_so_auto_base`, `kafaa_so_auto_share`, `kafaa_so_auto_profile`, `kafaa_so_auto_for`, `kafaa_bv_problems`, `kafaa_bv_guard`; redefined `kafaa_so_normalize`, `kafaa_so_project`, `kafaa_so_compute`, `kafaa_so_for` (from the w5e4 bodies, the newest). **`kafaa_so_base` not redefined.**
- Migration `supabase/migrations/20261010262001_kafaa_fs62_outlook_automation.sql` (additive, idempotent, no removal words). Suggested live parts: `kafaa_fs62_outlook_automation_p1` (table, RLS, guard) and `_p2` (outlook functions + RPC), then the seed rows with `insert ... on conflict (id) do nothing`.

## Local function md5s (PGlite, after all migrations + seed twice)

```
kafaa_bv_guard            4069153a59be914b9e9597bbf4e94286
kafaa_bv_problems         f6989f67c177846a36b86b0c131b914d
kafaa_outlook_automation  7686b9e5f6670e34c5e520acb8284533
kafaa_so_auto_base        41e42bc9943b658dd3434f55339bc105
kafaa_so_auto_for         cd870851e0b139902b40f582df1a6dcb
kafaa_so_auto_profile     78e3c0c03211c99400a17d5d69e8804e
kafaa_so_auto_share       dfa795a03dd0b4e2786f4e35200b1ebf
kafaa_so_compute          6d1ae5f98265187c736cc2b7068124fc
kafaa_so_for              4e0adcf82017d21cc266201dba7ce94f
kafaa_so_normalize        05d4567f8a7c42b487fc6a21e36dff29
kafaa_so_project          539ebf78066451496fa2b09a8b590179
```

Table digest (`count, left(md5(string_agg(to_jsonb(t)::text,'|' order by t.id)),8)`): `kafaa_benchmark_values` **10:0354f3e7**. `kafaa_skill_outlooks` unchanged (no FS52 seed rows; seed.json changes only in `benchmark_values`).

## Tests and gates

- Unit (serial, one file each): `fs62-outlook-automation.test.ts` 13/13, `fs62-market.test.ts` 8/8, `fs62-pages.test.tsx` 6/6; directly affected: `w5e4-outlook` 19/19, `w5e4-pages` 8/8 (tornado count 7 -> 8, logged), `m07-workforce` 8/8, `g3-pages` 7/7, `fsqa2-integration` 13/13, `fsqa5-integration` 16/16, `w3e3-pages` 7/7, `m14-rbac` 291/291, `w3e5-no-protected-inputs` 57/57.
- PGlite `scripts/validate/fs62-outlook-automation.mjs` 30/30; `w5e4-outlook.mjs` 23/23 with the redefinitions.
- Gates (all green, 2026-10-11/12): `npm run gen` (no further diff; seed changes only in `benchmark_values`), `npm run check:i18n` (40 namespaces in parity), `npm run typecheck`, `npm run migrations:validate` (full run, "All migration checks passed", exit 0, md5s/digest below identical), `npm run check:public`, `npx vite build`. Playwright not run (engineer slot).

## Gaps and decisions

- Card examples WEF 39 %, IEA 60 % and the Pact figure are held back (research packs: WEF-secondary, IEA trade press [secondary], Pact 2025 total only on secondary sites); "WEF 50 % in long-term learning" and a Pact training share are not FS01 figures, so they are not shown. Logged in CONTRACT.
- No saved outlook with automation is seeded (the w5e4 tests pin 5 stored outlooks and several builders refresh them); the demo uses the slider presets.
- Observers hold `workforce_analytics` Agg and can read `kafaa_benchmark_values` (public figures; no observer page shows them).

## Hand-offs for the integration lead

1. FS51 (fsFe1) imports `outlook.ts` read-only: exported F35 signatures are unchanged (unit test "exported F35 signatures stay stable for FS51"). Re-run `w5e4-outlook.mjs`, `fs62-outlook-automation.mjs` and fsFe1's validator after the merge; stress test must read 10 of 10.
2. If fsFe1 also redefines `kafaa_so_normalize/_project/_compute/_for`, the fs6qa migration must carry the FS52 deltas (marked `FS52` in the fs62 migration). `kafaa_so_base` stays with its fs2qa body (FS02 + FS10 conditions).
3. FS54 methodology-change banner on `/workforce/skills-outlook` (reads `kafaa_skill_changes`): not wired here.
4. Live: apply the migration, load the 10 `kafaa_benchmark_values` rows (the guard checks them against live `kafaa_benchmarks`, so FS01 figures must match), compare the md5s and digest above; anon must execute nothing new.
