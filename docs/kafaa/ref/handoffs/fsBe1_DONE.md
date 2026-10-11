# fsBe1 DONE: FS07 Skills Catalogue Explorer + FS08 International crosswalk and export

Branch `fsBe1` (worktree /workspace/kafaa-fsBe1), one commit, not pushed. Module `src/modules/m28`.

## Acceptance

FS07
- [x] All published skills (120 seeded; obsolete ones hidden from the list, still reachable by direct link) are listed with working filters (area, reusability, lifecycle, group, future-skills area; URL-synced). The Arabic search "تحليل البيانات" ranks sk-da-01-analysis first and shows a reason (Arabic normalisation via normAr). Tests: fs21-pages "explorer lists every published skill", "filters narrow the list", "Arabic search"; fs21-crosswalk searchSkills tests.
- [x] Anonymous payloads carry no person data: skill_frameworks public, skill_alignments public only where `listed`, skill_goals own-profile only. `check:public` passes (46 public tables). Live: anon reads 253 alignments, 11 frameworks, 0 goals.
- [x] Every skill page shows at least one source with an as-of date: sources tab (sources.accessed or benchmark as_of). Unit test asserts this for every listed skill, and a page test renders it.

FS08
- [x] At least 95% of skills have one or more alignments: 120/120 (100%). 100% of alignments cite an https URL and an as-of date (DB check constraint `https_ck`, plus a unit test).
- [x] The export validates against a CASE-shaped JSON schema in a unit test: CFPackage (CFDocument, CFItems, CFAssociations, CFDefinitions) with deterministic UUIDs, in EN and AR. The schema is downloadable and the page shows "validates".
- [x] Rows not yet reviewed display "indicative" in EN and "إرشادي" in AR. Tests: fs21-pages crosswalk EN + AR.

Benchmark ties: `<BenchmarkChips feature="FS07">` (SFIA9, ESCO, SSG-SF) on the explorer and the skill page; `feature="FS08"` (ESCO, SFIA9, ONET, DIGCOMP, 1EDTECH, OT-CYBER) on the frameworks page and the crosswalk tab. Each framework row carries a benchmark_id. WhyThis is shown on the search hits and on the coverage/indicative explanations.

## Routes (4)
- `/skills` (public; nav public + careers 11.9): explorer, with tiles, search, filters, cards and held/goal chips when signed in.
- `/skills/:id` (public): overview (level ladder, key level), roles (2030 role profiles; security roles are never listed), learning (courses, training paths, micro-credentials), crosswalk, sources. A signed-in overlay shows "You hold this at L3 (verified)" and add/remove goal.
- `/skills/frameworks` (public): 11 framework cards, coverage heatmap (frameworks x established + 6 FS areas), gap list (UAE NQF not yet mapped), CASE JSON / CSV / schema export, filtered table.
- `/admin/skills/alignments` (admin, training_manager, instructor, auditor; nav admin 6.6): table, an editor with a live check (same rules as SQL), review, retire with a reason. The auditor gets a read-only view including drafts and retired rows.

## Tables / RPCs (migration `supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql`)
- `kafaa_skill_frameworks` (11): public read; written only by migration/seed.
- `kafaa_skill_alignments` (256 = 253 published + 2 draft + 1 retired): read is public where listed, and audit_log/sat holders read all. Writes go through RPCs only (the frameworks resource: instructor and training_manager W, admin A).
- `kafaa_skill_goals` (8): own-profile read; writes via RPC (skills_profile Own). This is a deviation and is logged in CONTRACT.md: the new table is the hand-off source for FS33.
- RPCs: `kafaa_save_alignment(p)`, `kafaa_review_alignment(p_id)` (admin, or a training_manager/instructor who is not the editor), `kafaa_retire_alignment(p_id, p_reason)`, `kafaa_set_skill_goal(p_skill, p_level, p_active)` (max 12 active). All are SECURITY DEFINER, audited, and refused with kafaa_refuse codes.
- 9 helpers: `kafaa_al_*` (check, code patterns, level map, duplicate key, messages). The SQL check is proven equal to the TS `checkAlignment` on 40 inputs in the validator.
- Local backend mirrors all of these; the Supabase map is in `src/modules/m28/backend/supabase.ts`.

## Seed
`scripts/seed/ext/fs08-crosswalk.mjs` + `fs08-crosswalk.data.json`: 253 published rows (esco 117, onet 34, sfia9 32, iaea 16, digcomp 15, skillsfuture 14, greencomp 10, lightcast 8, unesco_ai 6, nice 1), plus 2 drafts and 1 retired row, and 8 goals. Every row passes checkAlignment at build time. Codes are stored only where they were copied from the source on 2026-10-10 (ESCO URIs with ESCO's own Arabic labels, SFIA 4-letter codes, O*NET element IDs, DigComp numbers). Other frameworks are label-level, shown as "code pending review". Reviewed rows were reviewed by synthetic personas only.

## Tests
- `tests/unit/fs21-crosswalk.test.ts` (16): rules, coverage >= 95%, URL/as-of, CASE export schema-valid (EN + AR), CSV, Arabic search, sources per skill, RPC RBAC/audit on LocalBackend, goal cap.
- `tests/unit/fs21-pages.test.tsx` (12): every page in EN/AR, anon/employee/training-mgr/auditor.
- `scripts/validate/fs21-crosswalk.mjs` (PGlite): RLS as anon/staff/auditor, RPC flows and refusals, SQL = TS check parity, audit rows, no ledger writes.
- Pinned route counts 212 -> 216 in fs11-foundation, fsqa1-integration, w4-integration, w5-integration.

## Live (hlirqxoddysxtdezwcgv)
- Migration applied in 3 parts (`kafaa_fs21_skills_crosswalk_part1_tables_rls`, `_part2_helpers`, `_part3_rpcs_grants`). Additive kafaa_* objects only.
- Seed loaded with insert ... on conflict (id) do nothing: frameworks 11, alignments 256, goals 8.
- Verified: md5 of the ordered to_jsonb rows for all 3 tables, and md5(prosrc) of all 13 functions, are identical live and in local PGlite. Anon reads 253/11/0.

## Gates
All green on branch fsBe1:
- `npm run gen`: 226 SQL tables, 24,491 seed rows.
- `check:i18n`: 40 namespaces, EN/AR parity.
- `typecheck`: clean.
- Unit tests: 100 files, 1,892 tests passed (vitest --maxWorkers=2).
- `migrations:validate`: all checks passed, fs21-crosswalk included; applied twice for idempotency.
- `check:public`: 46 public tables, no person data.
- `build`: built in 2m 11s. The first attempt was OOM-killed by the shared memory cgroup; the retry passed.
- No Playwright or browser was used.

## Gaps / notes
- UAE NQF framework has 0 alignments and shows as "not yet mapped" in the gap list. The level descriptors need a reviewed source.
- GreenComp, SkillsFuture CCS, UNESCO AI, NICE, IAEA and Lightcast rows are label-level, with codes pending human review. Lightcast labels should be confirmed against the Open Skills API (licence needed).
- `skill_goals` is a new table (CONTRACT deviation, logged). FS33 should read it rather than add its own.
- No Playwright or screenshots (not the integration lead). The e2e route-sweep pin for the 4 new routes is left to the integration lead.
