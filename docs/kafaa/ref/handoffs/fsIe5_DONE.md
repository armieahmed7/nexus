# fsIe5 DONE: FS84 Team 2030 capability targets and an organisation skills inventory (wave I, engineer 5, M17)

Branch `fsIe5`, stacked on `fsH-integration-qa` (not merged to `main`). Live Supabase was not available: nothing was applied live.
CONTRACT changelog entry: "2026-10-12 · FS wave I · E5".

## Files

- Owned: `kafaa/src/modules/m17/teamTargets.ts` (rules, import-free), `TeamFutureTargetsPage.tsx`, `SkillsInventoryPage.tsx`, `backend/local.fs9.ts`
- Additions in M17: `routes.ts` (2 routes), `backend/schema.ts` (2 columns on `team_skill_targets`), `backend/rpc.ts` (`Fs9Rpc`), `backend/local.ts` (one hook line), `backend/supabase.ts` (3 mappings), `backend/local.w2.ts` (F11 reads `horizon = 'current'` only, one line), `TeamSkillsPage.tsx` (one link to the new page)
- `kafaa/src/i18n/m17.{en,ar}.json`: `tt.*`, `inv.*`, route titles `team-skills-future`, `workforce-skills-inventory`
- `kafaa/supabase/migrations/20261010295001_kafaa_fs95_team_targets_inventory.sql`
- `kafaa/scripts/seed/ext/fs84-team-targets.mjs` (FINALIZE_LAST)
- `kafaa/scripts/validate/fs95-team-targets-inventory.mjs`
- `kafaa/tests/unit/fs95-team-targets-inventory.test.ts` (25 tests), `kafaa/tests/unit/fs95-pages.test.tsx` (7 tests)
- Shared one-line edit (marked `[FS84 · fsIe5]`, logged): `kafaa/scripts/validate/w2e1-checkins.mjs` compares only `horizon = 'current'` targets (the F11 parity check would otherwise mix in FS84 rows)
- Generated: `types.gen.ts`, `20261008120100_kafaa_schema.sql` (2 columns + 1 index), `seed.json`, `seed.sql` (the `team_skill_targets` rows only)

## Acceptance tick list

- [x] **Cells under 10 are suppressed.** Unit `fs95-team-targets-inventory` > "FS84 · acceptance 1: cells under 10 are suppressed" (4 tests: every inventory cell for both dimensions, a generated group of 9 vs 10, HR aggregates of teams under 10 with no counts/holders/members, the local RPC). Page `fs95-pages` > "HR sees the data-quality tiles ... heatmap with suppressed cells", "the job-family view suppresses small families", "the HR director sees counts only ... small teams suppressed". PGlite: "acceptance FS84: cells under 10 are suppressed (2388 of 2620 inventory cells null ...)" and "acceptance FS84: HR aggregates of a team under 10 are suppressed (35 groups ...)".
- [x] **Data-quality figures reproduce from rules (TS = SQL).** Unit > "FS84 · acceptance 2: data-quality figures reproduce from rules (TS = SQL)" (local RPC = `dataQuality()`/`orgInventory()` for both dimensions; the headline figures recomputed by hand from the page's definitions; FS03 ageing / FS54 review-date staleness and claimed-never-validated on generated rows). PGlite: "acceptance FS84: data-quality figures reproduce from rules (TS = SQL through the RPC) ..." and the parity check `kafaa_tt_inventory` / `kafaa_tt_quality` = rules for 2 dimensions x 2 dates, on the seed and after generated edits.
- [x] **Each team target shows the 2030 role-profile version it came from.** Unit > "FS84 · acceptance 3: each team target shows the 2030 role-profile version it came from" (every derived target in every group x horizon names per role the published 2030 version id and number; Why this names the version; crew B's stored targets keep v1 and are flagged after v2). Page > "the shift manager sees crew B's 2030 targets, each with the 2030 role-profile version it came from, Why this, and the stale adoption flag". PGlite: "acceptance FS84: each team target shows the 2030 role-profile version it came from (536 derived targets; every adopted row stores its versions)".
- [x] Adjustment `team_skill_targets.horizon` additive (default current): unit > "FS84 · additive horizon column and the F11 coverage" (2 tests); PGlite "F11 unchanged: kafaa_team_coverage reads current targets only" and "the migration is additive ... ALTER only on kafaa_team_skill_targets"; `w2e1-checkins` (unit 18/18, PGlite all pass).
- [x] Team targets for 2028 and 2030 from FS05 versions with the gap: unit "FS84 rules" (5 tests: profiles as needs, 2028 half-way rule, target rule, ordering, adoptPlan); page "the 2028 switch shows the half-way targets; adopting them is confirmed first ...".
- [x] RBAC skills_profile Scope (managers) / Agg (HR): unit "FS84 RPCs (local)" (4 tests incl. adopt refusals, audit, no ledger, switched off never removed) and "two routes ..."; page "line managers and auditors never reach the inventory"; PGlite RPC checks (reads, refusals, audit counts, retire).
- [x] Benchmark chips `FS84` (ISO30414, IAEA-WFP) on both pages: unit "the pages show the FS84 benchmark chips"; page tests find `benchmark-chip-ISO30414` and `benchmark-chip-IAEA-WFP`.
- [x] EN + AR complete, logical classes: unit "EN and AR keys are in parity ..."; page "in Arabic the targets page renders with Arabic labels"; `check:i18n`.

## Routes (+2; route-count pins left to the integration lead: 380 -> 382)

| id | path | guard |
|---|---|---|
| `team-skills-future` | `/team/skills/future` | `{ signedIn, grant: skills_profile [Scope, A, Agg] }` (parent `team-skills`, nav team 32.5) |
| `workforce-skills-inventory` | `/workforce/skills-inventory` | `{ signedIn, grant: skills_profile [Agg, A] }` (parent `workforce`, nav workforce 67.5) |

No param routes (no `smoke.json` change). Expected pin failures: `fs11-foundation` and `fsqa8-integration` ("expected 382 to be 380"); the other pin files (`w4-integration`, `w5-integration`, `fsqa1..7-integration`, `tests/e2e/sweep.spec.ts`) fail the same way.

## Tables and RPCs

- `kafaa_team_skill_targets` (M17, F11): additive `horizon text not null default 'current' check (current|2028|2030)`, `profile_version_ids text[] not null default '{}'`, index on `horizon`. No new table, no RLS change (the table stays R/W/A-only; managers read through the RPCs).
- RPCs (authenticated only): `kafaa_team_future_targets(p_group text, p_horizon text)` (read), `kafaa_adopt_future_targets(p jsonb)` (audited `skills.future_target.adopt`, no ledger), `kafaa_org_skill_inventory(p_dim text)` (read, null for non-Agg/A).
- Internal helpers (no API role): `kafaa_tt_pct`, `kafaa_tt_l2028`, `kafaa_tt_is_restricted`, `kafaa_tt_core`, `kafaa_tt_version`, `kafaa_tt_reqs`, `kafaa_tt_need`, `kafaa_tt_derive`, `kafaa_tt_inventory`, `kafaa_tt_qblock`, `kafaa_tt_quality`.
- **Redefined shared function:** `kafaa_team_coverage` (from its only body, `20261009121001_kafaa_w2e1_checkins.sql`; no later migration redefines it), with `t.horizon = 'current'` on its five target reads. Before applying live, compare the live md5 with the w2e1 local body. Not redefined: `kafaa_set_team_target`, `kafaa_skill_states_v2`, `kafaa_skills_apply`, `kafaa_so_base`, `kafaa_dg_gather`, `kafaa_fs63_health` (no evidence written, no ref_table added).

## Local md5 (PGlite, `md5(prosrc)`)

```
kafaa_adopt_future_targets=21c66e0f0c6fe4aae647284cc34a3557
kafaa_org_skill_inventory=446cbe4486cc2d1c4e557ed824810760
kafaa_team_coverage=990d1de901ed061e36f30a7bb254ebb1        (redefined)
kafaa_team_future_targets=a8a9052d5d8d8aba73b2120d9c7139ad
kafaa_tt_core=b7b9979e04bb64eeaf7c8a5028eb9d5c
kafaa_tt_derive=15d6f11d0a58e4967d7b033cdab9684c
kafaa_tt_inventory=16c459972658d3040c2129a91fc47a31
kafaa_tt_is_restricted=07b13af8e5fd1575c13e97393a9839fb
kafaa_tt_l2028=1a395dbf37cce69b2bf33e2a1e6e185a
kafaa_tt_need=7b64cd11c9331f347db3af66b14a86c2
kafaa_tt_pct=2a7447b83769946a140f1d0564d88223
kafaa_tt_qblock=63d1c2d1962a2a5cc880716a7ad45c14
kafaa_tt_quality=a53eb1adc1a7d5195628b516eeebb5c2
kafaa_tt_reqs=1514b49f46fc1128ec8ec4869ecad09b
kafaa_tt_version=8f0e69ca037a046f06755758f152a7cc
```

## Table digests (count, `left(md5(string_agg(... order by id)), 8)`; ids digest over `t.id`, rows digest over `to_jsonb(t)::text`)

| `kafaa_team_skill_targets` | rows | ids | rows digest |
|---|---|---|---|
| whole table | 59 | 243cafe8 | 1d6492dd |
| `horizon = 'current'` (the 24 F11 rows, after the ALTER defaults) | 24 | 57d3e529 | e1349542 |
| `horizon <> 'current'` (new FS84 rows) | 35 | 3ee8187b | 7c6ad029 |

Live seed load after the migration: the 35 rows with `horizon <> 'current'` (`insert ... on conflict (id) do nothing`). **No guarded UPDATE of an existing live row is needed:** the 24 existing rows take `horizon = 'current'` and `profile_version_ids = '{}'` from the column defaults. Note: the live 24 F11 rows may differ from the seed if journeys changed targets (`updated_at`, `set_by`); compare the F11 rows by id first.

## Tests and gates

- Unit (one file per vitest process, `TMPDIR=/dev/shm --maxWorkers=1`): `fs95-team-targets-inventory` 25/25, `fs95-pages` 7/7; directly affected: `w2e1-checkins` 18/18, `w2-integration` 6/6, `m14-rbac` 291/291, `w0-scaffold` 5/5, `fs63-engine-lint` 13/13, `w3e5-no-protected-inputs` 71/71. Expected route-pin failures left to the lead: `fs11-foundation` and `fsqa8-integration` (1 test each, "expected 382 to be 380"; everything else in those files green).
- PGlite: `scripts/validate/fs95-team-targets-inventory.mjs` 18/18 checks (alone and in the full run); `w2e1-checkins` passes with the one-line filter.
- `npm run migrations:validate`: "All migration checks passed" (93 migrations + seed applied twice, 2,447 checks, exit 0); the fs95 md5s and digests in the full run equal the ones above.
- `npm run gen` (no diff after the commit; 37,325 rows across 356 tables), `npm run check:i18n` (40 namespaces in parity), `npm run typecheck` (clean), `npm run check:public` (77 public tables, no personal columns), `npx vite build` (built in 2 min 7 s; only the known chunk-size warnings).
- No Playwright or browser run (engineer slot).

## Settled decisions and choices (logged in CONTRACT)

- External facts only through the benchmark chips (`kafaa_benchmarks` ISO30414, IAEA-WFP); no figure typed into copy; MC-H2-HEAT untouched.
- Planning assumptions only ("no deployment decision implied" on the page); no headcount claims: targets are development targets for existing teams.
- 2028 targets: no FS05 2028 horizon exists, so 2028 = half-way from today's published profile to the 2030 profile, rounded up (documented on the page and in Why this).
- Target rule: per skill, the mode of the members' levels (ties to the higher), for everyone who needs at least that level; holders count verified, evidenced and validated levels only.
- Inventory dimension: entity (the card) plus a job-family view (security, safeguards and cyber families never broken out); most families are under 10 and suppressed (honest).
- Data quality: profile coverage (staff with a state; plus role requirements recorded), staleness = FS03 ageing on the newest evidence or FS54 `review_due` passed, share validated = verified or validated (evidenced is shown separately in the basis chart).
- Adoption: skills_profile A or Scope over a member (as F11 `setTeamTarget`); audited, no ledger (as F11). Rows are switched off, never removed.
- No engine card: nobody is ranked (targets by gap, members by id).

## Gaps and hand-offs for the integration lead

1. Route-count pins 380 -> 382 (+2 M17: `team-skills-future`, `workforce-skills-inventory`).
2. Live apply: the migration (2 columns, helpers, 3 RPCs, the `kafaa_team_coverage` redefinition, grants) in one part (~39 KB), then the 35 new seed rows. Compare the live `kafaa_team_coverage` md5 with the w2e1 local body before applying.
3. FS79 (fsIe1, same wave) -> M17: the trust tier on the wallet, learner record and credential pages was not wired here (handover: E1 exports `trustTier()`, the lead wires M17 views). My files do not touch those pages, so there is no conflict.
4. Optional entry link: `/workforce` (M07) or `/workforce/skills-outlook` -> `/workforce/skills-inventory` (not in my files).
5. Seeded story: crew B's 2030 targets (adopted 2026-09-01) show 9 targets changed by the reactor-operator 2030 v2 profile and 8 new ones; the operations family's 2028 targets and the RP team's 2030 targets are up to date. The live demo personas: `sro` (crew B, people mode, can adopt), `chco` / `k-hr-analyst` (aggregate targets, inventory), `training-mgr` (A: both pages, adopts for any group).
6. Live `person_skills` hold extra journey rows for some personas, so live inventory and quality numbers can differ slightly from local; the rules are proved equal on the same data.
