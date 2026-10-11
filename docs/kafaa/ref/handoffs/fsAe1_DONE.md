# fsAe1 · FS wave A · E1 · FS01 + FS02 (foundation)

Branch `fsAe1` (worktree `/workspace/kafaa-fsAe1`), not pushed. Netlify not touched.

## Acceptance

### FS01 · scaffolding, benchmark registry, shared components
- [x] Modules M28 to M37 registered once: ModuleId, MODULES (EN/AR names, groups FSA..FSI), registry imports, empty `routes.ts`, i18n namespaces `m28..m37` (EN + AR), schema/rpc/local/supabase blocks in `src/data/ext`. The route sweep is unchanged (no placeholder routes yet; 206 routes, as pinned). Test: `fs11-foundation` "modules".
- [x] 7 policy resources (skills_taxonomy, ai_literacy, transformation, recognition, workforce_strategy, ecosystem, national_alignment): 168 matrix rows using existing roles. `docs/RBAC.md` regenerated. Tests: "policy" (TS) and validator "policy matrix equals TS".
- [x] `kafaa_benchmarks` holds 40 rows and 53 figures in EN + AR. Each row has 1 or more https sources and an as-of date of 2026-10-10. There is a DB check for https and listed=published. `check:public` passes and covers 42 public tables, 40 benchmarks and 120 skills.
- [x] `<BenchmarkChip>`, `<BenchmarkChips>`, `<BenchmarkDrawer>` and `<BenchmarkLine>` are in `src/ui`. They render in RTL with Arabic digits and in LTR with Latin digits (tests). An unknown id gives an inert chip.
- [x] `src/domain/taxonomy.ts` has no imports. It defines reusability, skill types, lifecycle, decay classes, owner roles, future groups, `levelEssence()`, `isPublishable()`, `publishProblems()`, `reviewState()` and `skillGuard()`.
- [x] Engine surfaces `transform` and `assess` have deterministic defaults in `src/domain/engines/future.ts`: task exposure (safety-critical tasks always human-led) and an adaptive staircase. They use the existing disabled ModelGatewayEngine slot.
- [x] Gates pass: gen, check:i18n, typecheck, migrations:validate (31 FS checks, including a NEXUS catalog snapshot before/after and a kafaa_-only static scan), check:public and build.

### FS02 · catalogue extension and taxonomy attributes
- [x] `kafaa_skills` gets these additive columns: reusability, skill_type, lifecycle, decay_class, owner_role, version, review_due, level_essence_en/ar, alt_labels_en/ar, future_group, plus fs_area, benchmark_ids, obsolete_on and replaced_by.
- [x] 120 skills (71 + 49 new): 12 transversal, 10 ai_data, 7 green_energy, 8 advanced_reactor (awareness only), 5 cyber_hygiene and 7 digital_plant. Of the digital_plant skills, 1 is declining and 1 is obsolete, replaced by `sk-fs-dp-ework`.
- [x] All 120 skills have a source, owner, version, review date and lifecycle. Every new skill has EN + AR names, a level-essence line, and at least 2 alternative labels per language (test).
- [x] No cyber_hygiene skill sits in the security area or references SA-01 or a security task (unit test and validator).
- [x] The F01 recompute is deterministic. The digest for the original 71 skills is unchanged (`68427633...0bd0d`), checked by the unit test and by PGlite.
- [x] "Obsolete, never delete" is enforced as follows:
  - The DB trigger `kafaa_fs_skill_guard` blocks delete, un-obsolete and version decrease.
  - Checks require obsolete_on and forbid a skill replacing itself.
  - The local guard mirrors these rules.
  - The repo has no delete path for skills (tests).

## Routes / screens
- No new routes.
- `/admin/frameworks?tab=skills`: skill catalogue with tiles, group donut, lifecycle and area bars, filters, table, a skill drawer (essence, labels, sources, benchmark chips, review state) and a lifecycle modal (version+1, obsolete with replacement).
- `/admin/frameworks?tab=benchmarks`: benchmark registry with tiles, category bars, a BenchmarkLine demo, filters, table, and an edit modal with validation.
- Both tabs are EN/AR and gated by frameworks W/A.

## Tables / RPCs
- New table `kafaa_benchmarks`:
  - Read: public for listed rows; integrations/sat roles see drafts.
  - Write: direct for frameworks W.
  - Audited.
- `kafaa_skills`: new columns, checks, FK replaced_by, indexes, trigger `kafaa_fs_skill_guard`.
- RPCs: none. Writes are direct and guarded.
- Shared hand-off to F35 (logged in CONTRACT.md): `kafaa_so_base` is redefined. The only change is `and sk.fs_area is null`, mirrored in `src/modules/m07/outlook.ts`, so seeded outlooks keep their stored results.
- Migration: `supabase/migrations/20261010211001_kafaa_fs11_foundation_catalogue.sql`. It is additive and idempotent, and validated twice in PGlite.

## Live (hlirqxoddysxtdezwcgv)
- Applied migrations `kafaa_fs11_foundation_catalogue_part1` and `kafaa_fs11_foundation_catalogue_part2_outlook`.
- Seed loaded in 11 chunks:
  - benchmarks and new skills with `on conflict do nothing`;
  - old skills got column-only updates, guarded by `where level_essence_en = '' and review_due is null`.
- Verified live = local (PGlite on the same migrations + seed):
  - 120 skills, 49 fs skills, 40 benchmarks, 168 FS policy rows;
  - md5 of `kafaa_so_base` (8414f791...) and `kafaa_fs_skill_guard` (cfa333d2...) match;
  - benchmark row digest d7e984b7... matches;
  - skill row digest c6c5dec8... matches.
- No NEXUS object or row was touched. No drop, delete or truncate was run.

## Tests
- `tests/unit/fs11-foundation.test.tsx`: 19 tests.
- `tests/unit/fs11-catalogue.test.ts`: 13 tests.
- `scripts/validate/fs11-foundation.mjs`: 31 PGlite checks.
- Full unit suite, single worker: all 89 files pass. Two files were OOM-killed by the shared memory cgroup (w1e3-coach, w2e1-checkins) and passed on rerun (40/40).
- Commit `23ca72a` on `fsAe1`.

## Gaps
- The transform/assess engine settings are kernel defaults only. The `kafaa_engine_settings.surface` check cannot be widened without a drop, so admins cannot store overrides for these two surfaces yet.
- New skills have no holders or evidence yet. That is by design, to keep F01 derived states and other modules' seeded data byte-identical. Later waves (FS03/FS04/FS10) attach evidence.
- No placeholder routes for M28 to M37. Wave B to I owners add routes in their own `routes.ts`.
- Live old-skill back-fill only fills empty columns. A row an admin has already edited live keeps its values.
