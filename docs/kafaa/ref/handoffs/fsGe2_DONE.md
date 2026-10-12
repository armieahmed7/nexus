# fsGe2 DONE: FS62 National-strategy alignment layer + FS63 MoHRE occupation and skill-level mapping (wave G, M37)

Branch `fsGe2` (stacked on `fsF-integration-qa`, never on `main`). Worktree `/workspace/nexus-fsGe2`. Nothing applied live (no Supabase access in this session). CONTRACT changelog entry: "2026-10-12 · FS wave G · E2".

## Acceptance (card + handover section 4 adjustments + settled decisions)

| Criterion | Test (file > name) |
|---|---|
| FS62 · Every tag cites an official source (settled: the most official URL in the pack; secondary ones flagged visibly) | `tests/unit/fs72-national-alignment.test.ts` > "every tag cites one to five sources from the research pack, each https with an as-of date and a stored tier equal to sourceTier"; "the primary source is the most official one; tags whose best source is secondary or indirect are flagged and say why in EN and AR"; "sourceTier: UAE government domains are official, ..."; "a tag without a source, with a non-https link or a future as-of date is refused"; page `tests/unit/fs72-pages.test.tsx` > "a flagged tag says why it must be re-checked (We the UAE 2031), in Arabic"; PGlite `fs72-national-alignment.mjs` "acceptance FS62: every tag cites a source from the research pack ... SQL kafaa_na_tier" + "acceptance FS62 (settled decision): each tag cites the most official URL the pack gives; 5 tags ... flagged" |
| FS62 · Reports are filters over data, with no typed totals | unit "no M37 table stores a total, count or measure; tag and link text name years only (typedTotalFree)"; "the report is recomputed from the data: a skill moved to another Jahiz group, an unlinked row and a retired pillar change it at once"; "the local RPC returns exactly the rule over the live tables; counts are distinct linked items and people counts under 10 are suppressed"; "the CSV export is the filtered report row for row ..."; page "the report builder filters by strategy and kind, recomputes the counts and exports what is shown"; "the maintenance page runs the save checks live: a typed number in the summary blocks the save"; PGlite "acceptance FS62: no typed totals ... SQL kafaa_na_typed_free = typedTotalFree", "acceptance FS62: no table stores a total, count or measure", "SQL kafaa_na_links / kafaa_na_report_core = effectiveLinks / nationalReport for 32 filters x measures on/off (seed)" and "(generated edits ...)", "acceptance FS62: reports are filters over the data: changing a skill's Jahiz group, retiring a pillar or drafting a pathway changes the report at once, with no stored total to edit" |
| FS62 · Every tag exists in EN and AR | unit "every tag name and summary and every link note is present in English and Arabic"; "the save check refuses a tag missing its Arabic name or summary"; "the M37 strings are in parity in EN and AR ..."; page "a tag page: EN and AR side by side, ..."; PGlite "acceptance FS62: every tag (name and summary) and every link note exists in EN and AR"; `npm run check:i18n` |
| FS62 · Tags on skills, programmes and targets for the six strategies (We the UAE 2031, NES 2031, AI 2031, Net Zero 2050, Jahiz groups, Centennial 2071) | unit "the six strategies of the card are tagged, with pillars, goals and the four Jahiz groups"; "FS41: ... FS09/FS36: ..." (all ten target tables linked); PGlite "the six strategies of the card are tagged ..." |
| FS62 · Jahiz groups reuse FS02 `future_group` (adjustment); wiring FS41 Net Zero, FS09 AI | unit "FS02: Jahiz-group links come from skills.future_group (never stored); nuclear excellence is not a national tag"; "FS41: the twelve Net Zero competences link to UAE Net Zero 2050 from the data; FS09/FS36: the AI fluency target links to the AI strategy"; PGlite "wiring FS02/FS41: 54 Jahiz-group links ... 12 Net Zero links ... computed and never stored" and "the report: FS09/FS36 AI target tagged to the AI strategy; ..." |
| FS62 · RBAC: national_alignment R for staff; W for admin and HR director (hr_analyst Agg) | unit "the policy matrix and the routes follow the card"; "staff read the report without measures; HR gets measures; partners, observers and anonymous get nothing"; "saveNationalTag: staff refused (audited); the HR director adds a goal (ledger); ..."; "setTagLink links and unlinks (the row is deactivated and kept); derived links are refused"; page "staff see the hub without people counts and without the maintenance link (reactor operator)"; PGlite "RLS: staff, HR and auditors read ...; anonymous, partners, universities and observers read nothing", "kafaa_national_report: HR (Agg) gets measures, staff (R) ...", "kafaa_save_national_tag: ...", "kafaa_set_tag_link: ..." |
| FS63 · No code is shown unless verified from the source (settled: "code pending review" unless a verified code is in the packs; none is) | unit "the 28 current roles are mapped and every code reads \"code pending review\" (the research pack verifies none)"; "codeView shows a code only with status verified and an https source; codeProblem accepts only official UAE government pages"; "verifyOccupationCode: the HR director cannot verify; a press page never verifies; an admin verifies (ledger); the last editor cannot (maker-checker); clearing returns \"pending\""; page "the occupation mapping: 28 roles, every code pending review, ..."; PGlite "acceptance FS63 (settled decision): no code is shown unless verified ...", "DB guards: a code without a verified source is refused (kafaa_role_occupations_code_ck); a concept role cannot be mapped (kafaa_ro_guard)", "FS63 RPCs: ..." |
| FS63 · Kafa'a states it is not a MoHRE system | unit "the statement is in both languages and the mapping page and RPC docs carry it"; page "the occupation mapping: ... the not-a-MoHRE statement ..." |
| FS63 · The uplift trend is labelled SIMULATED and suppressed under 10 | unit "occupationTrend is SIMULATED, every count under 10 is suppressed and a year under 10 people shows nothing"; "the trend RPC is for HR and admins only (Agg/W/A) and equals the rule; staff get null"; page "the occupation mapping: ... the SIMULATED trend for HR ..." and "staff see the mapping without the trend; an admin sees the verify action"; PGlite "acceptance FS63: the uplift trend is SIMULATED and every cell under 10 is suppressed; SQL kafaa_ro_trend_core = occupationTrend" |
| FS63 · Current roles only (28); concept roles get no code (adjustment) | unit "concept roles get no mapping and labels carry no numbers; the indicative level follows the education rule unless reviewed with a rationale"; PGlite "FS63: the 28 current roles carry an occupation label and the indicative level from the education rule; concept roles have no row" + the guard check |
| BenchmarkChips FS62 / FS63 on every page | unit "five routes with i18n titles; the tag route has a smoke param; every page renders the feature chips"; page tests (`benchmark-chip-JAHIZ`, `-UAE-AI`, `-NAFIS`, `-MOHRE`, `-ESCO`) |
| No ranked surface (FS55 lint) | unit "no ranking function lives in M37 ..."; `tests/unit/fs63-engine-lint.test.ts` green |

## Routes (+5; route-count pins left to the integration lead: 338 -> 343)

| id | path | guard |
|---|---|---|
| `national-alignment` | `/national/alignment` | national_alignment R/Agg/W/A (nav my · workforce 69.1) |
| `national-alignment-tag` | `/national/alignment/:tagId` | same (smoke `nt-ai-2031`) |
| `national-report` | `/national/report` | same (nav 69.15) |
| `national-occupations` | `/national/occupations` | same (nav 69.2) |
| `admin-national-tags` | `/admin/national-tags` | national_alignment W/A (nav admin 9.7) |

## Tables, RPCs, SQL

- Tables (M37, write mode `rpc`, read `national_alignment` R/W/A; RLS in the per-statement form in the migration): `kafaa_national_tags` (18 rows), `kafaa_tag_links` (52 curated rows; 66 more links derived from data at read time), `kafaa_role_occupations` (28 rows). Checks `kafaa_national_tags_parent_ck`, `kafaa_role_occupations_level_ck`, `kafaa_role_occupations_code_ck`; unique index `kafaa_tag_links_target_uq`; trigger `kafaa_ro_guard_trg`.
- RPCs (authenticated only): `kafaa_national_report(jsonb)`, `kafaa_save_national_tag(jsonb)`, `kafaa_set_tag_link(jsonb)`, `kafaa_save_role_occupation(jsonb)`, `kafaa_verify_occupation_code(jsonb)`, `kafaa_clear_occupation_code(text, text)`, `kafaa_occupation_trend()`. Internal (no API role): `kafaa_ro_guard`, `kafaa_na_host`, `kafaa_na_tier`, `kafaa_na_typed_free`, `kafaa_na_len`, `kafaa_na_str`, `kafaa_na_tag_problem`, `kafaa_na_target`, `kafaa_na_link_problem`, `kafaa_na_links`, `kafaa_na_pct1`, `kafaa_na_sup`, `kafaa_na_holders`, `kafaa_na_measure`, `kafaa_na_group_name`, `kafaa_na_report_core`, `kafaa_ro_indicative`, `kafaa_ro_problem`, `kafaa_ro_code_problem`, `kafaa_ro_trend_core`.
- Ledger actions: `kafaa.national.tag_add`, `kafaa.national.tag_retire`, `kafaa.national.occupation_code_verify`, `kafaa.national.occupation_code_clear`. Audit actions: `national.tag.save`, `national.link.set`, `national.occupation.save`, `national.occupation.verify`, `national.occupation.clear`.
- Migration `supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql` (726 lines; additive, idempotent; no removal words; no shared function redefined; reads `kafaa_so_text_clean`, `kafaa_ai_rung`, `kafaa_cec_level` without redefining them). Suggested live parts: `kafaa_fs72_national_alignment_p1` (tables, constraints, guard, RLS, FS62/FS63 rules up to `kafaa_na_measure`) and `_p2` (`kafaa_na_group_name`, `kafaa_na_report_core`, FS63 rules, RPCs, grants); then the seed rows with `insert ... on conflict (id) do nothing` in the order `kafaa_national_tags` (strategy-level tags first or with `kafaa.seeding` on), `kafaa_tag_links`, `kafaa_role_occupations`. No guarded UPDATE of an existing live row is needed.

## Local function md5s (PGlite, after all migrations + seed twice; `npm run migrations:validate`)

```
kafaa_clear_occupation_code f815ce6dedcf2b111a2b2411f5e5fa30
kafaa_na_group_name 290452bd75257c0989be6cb4b08d9171
kafaa_na_holders 9cba9f4de0273d8f5bff53ecf851e2cc
kafaa_na_host 6546a7766ba0164610b54519827a47ab
kafaa_na_len d7afb4359bee5307e04c0081eb336225
kafaa_na_link_problem a6d1eec2ecd5561f75373ba8202628cd
kafaa_na_links c02bbbec2460e3984bdb5917323cf59e
kafaa_na_measure d2e898e772c06ad3dc53d879e45e60c5
kafaa_na_pct1 42d77efa78f124b5b6a8809aa014560c
kafaa_na_report_core b187f399e38ed7dff75ab3188835486d
kafaa_na_str c29592d5a3a0a47d4fd10448701d9c4b
kafaa_na_sup 7d3e01333c1cc2977abd7a1f1c6ba829
kafaa_na_tag_problem eb08dee6d9dd2c5980993cbba48971bc
kafaa_na_target 1201cd7be4f523fb27205e17772dfd41
kafaa_na_tier a14a8bdc2619c62929aba60cf68c8dc2
kafaa_na_typed_free 4d61228f9aac4cada31f83c7e9ed79b0
kafaa_national_report d3a2f9c3fae61f30394e0eec319828bf
kafaa_occupation_trend 70488dc03fb315935138c4c6b9425d3f
kafaa_ro_code_problem 7bf85166559eac42c7b8b08e85fe645f
kafaa_ro_guard fe9d0f8c63d3e90cdc9eae889978687d
kafaa_ro_indicative b96454ee359cc84816edc8a3035d652b
kafaa_ro_problem 7a7c854be110ba9032e1bb04567a2e09
kafaa_ro_trend_core df22df3885a4b870495a2e899d993abe
kafaa_save_national_tag a7e5774166673e31ff5ee1c4f34b4c6f
kafaa_save_role_occupation 8797513986bb635de1abd8d75f853910
kafaa_set_tag_link f1ecd711e48e0007ffc0fee8f534d548
kafaa_verify_occupation_code 1ad1472617c0f82f3bfff4cc8e8092af
```

## Table digests (count, md5 of ids, md5 of rows; first 8 hex)

```
kafaa_national_tags: 18 rows, ids fa0dc5a0, rows f446edea
kafaa_tag_links: 52 rows, ids 995da29d, rows e410ba23
kafaa_role_occupations: 28 rows, ids 4f2ce4fb, rows 2bf6ce23
```

## Tests

- `tests/unit/fs72-national-alignment.test.ts`: 29 tests, green.
- `tests/unit/fs72-pages.test.tsx`: 8 tests, green.
- Directly affected and re-run: `tests/unit/m14-rbac.test.ts` (every table and RPC against the matrix), `tests/unit/fs63-engine-lint.test.ts` (FS55 lint over the source tree): green. `tests/unit/w4-integration.test.tsx`: 13/14; the one failure is the route-count pin "expected 343 to be 338" (+5 M37 routes), left to the integration lead.
- PGlite: `scripts/validate/fs72-national-alignment.mjs` (28 checks), all passing inside the full `npm run migrations:validate`.

## Gates

Run from `kafaa/`:

- `npm run gen`: stable (md5 of the generated outputs identical before and after a second run); only the three M37 tables were added to `types.gen.ts`, `seed.json`, `seed.sql`, `20261008120100_kafaa_schema.sql`, `20261008120300_kafaa_rls.sql` (35473 rows across 328 tables).
- `npm run check:i18n`: OK (40 namespaces; m37 EN/AR in parity).
- `npm run typecheck`: clean.
- Unit tests (one file at a time, `--maxWorkers=1`): fs72-national-alignment 29/29, fs72-pages 8/8, m14-rbac 291/291, fs63-engine-lint 13/13, w4-integration 13/14 (route pin only, see below).
- `npm run migrations:validate`: "All migration checks passed", exit 0 (fs72: 28 checks).
- `npm run check:public`: OK (75 public tables; M37 tables never public).
- `npx vite build`: built, exit 0 (only the existing chunk-size warning).
- No Playwright or browser run (as instructed); nothing applied live.

## Gaps and hand-offs for the integration lead

1. **Route-count pins** 338 -> 343 (+5 M37) in `w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..6-integration`, `tests/e2e/sweep.spec.ts`; I did not touch them.
2. **FS74 (wave H) future target as data:** add its table to `TARGET_TABLES` (`src/modules/m37/national.ts`) and to SQL `kafaa_na_target` / `kafaa_na_measure` / the table lists in `kafaa_na_links`, `kafaa_na_link_problem` and `kafaa_na_report_core` (create or replace in the wave-H file; no check constraint to widen), then seed a `tag_links` row from `nt-ai-2031` (or the relevant strategy) to it.
3. **Sources to re-check by a human before external use** (flagged in the UI): We the UAE 2031 and its two pillars and UAE Centennial 2071 cite only the UN-ESCWA planning portal and the Al Ghurair paper; Net Zero 2050 cites the strategy only indirectly (Jahiz New Economy group, WAM); the National AI Strategy cites the Abu Dhabi DGE page (official, but not the strategy's own page) and Khaleej Times (secondary). A primary u.ae page for each would clear the flags (edit the tag on `/admin/national-tags`; the tier is computed from the URL).
4. **FS63 codes:** all 28 read "code pending review". When an admin copies a code from an official MoHRE / u.ae page, `verifyOccupationCode` records it (maker-checker, ledger). The indicative level is Kafa'a's education rule, labelled pending review.
5. **RBAC deviation (logged):** FS63 "W admin" -> the HR director (matrix W, policy comment "admin and the HR director maintain the mapping") edits labels and levels; recording or clearing a verified code needs A (admin only).
6. **Measures visibility:** people counts and the trend are for `national_alignment` Agg/W/A (HR analyst, HR director, admins); auditors (R) see the report without measures. Change in `nationalReport` / `kafaa_national_report` if auditors should see them.
7. The uplift trend models the hiring mix only (current role from the hire date; role moves and leavers are not modelled); it says so on the page.
8. Live apply: see "Tables, RPCs, SQL"; compare md5s and digests above.
