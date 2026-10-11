# fsCe5 DONE: FS25 Nuclear Critical Core Skills + FS26 Situational judgement practice (m33)

Branch `fsCe5` in worktree `/workspace/kafaa-fsCe5`. Commit `027116f` (not pushed).

## Acceptance

### FS25
- [x] Each of the 16 skills cites at least 2 benchmark mappings. They draw on SSG-SF, WEF-FOJ, GREENCOMP (LifeComp/EntreComp/GreenComp), MCK-DELTA and IAEA-1917, all from kafaa_benchmarks. INPO traits (M08) are mapped as well but are not counted as benchmarks. Covered by unit test, validator and the live `inclusionProblems` check on the page.
- [x] Every core skill has its own development route and its own assessment route, beyond generic SJT practice. Approach signatures are unique (inclusion rule, McKinsey DELTA).
- [x] No wellbeing competency is added. The rule refuses one. Wellbeing and career health are recorded as candidates with decision `outcome` (merged into cs-resilience and cs-learning-agility). The UI shows a callout with the SkillsFuture 2025 review source.
- [x] There are 16 skills in 3 SkillsFuture clusters (TC 6 / IO 5 / SR 5). Each is written for a nuclear plant and has an "at the plant" example, 3 EN/AR level descriptors, INPO trait links and FS02 catalogue skill links.
- [x] `/my/core-skills` shows my evidence per core skill against the role (job-family) target: level, target, status, need bar and WhyThis reasons that point at person_skills rows. Practice is shown beside the level and never changes it.
- [x] RBAC:
  - Definitions are public R (public_content).
  - My view is Own (skills_profile Own).
  - The HR aggregate is skills_profile Agg, suppressed under 10, and never breaks out security, safeguards or cyber.

### FS26
- [x] The bank has 48 EN/AR items, 3 per core skill, across 8 themes (conservative decisions, questioning, raising concerns, teamwork under pressure, procedure use, learning and change, working across cultures, digital judgement).
- [x] Every item has an expert rationale in both languages, plus a why-note per response in both languages.
- [x] Results never appear in talent review. Attempts are RLS own_profile (Own only), anon and others read 0, and no talent-review payload carries them. Covered by unit test, validator and the live anon check.
- [x] No gamification: no points, streaks, badges, ranks or leaderboards in the tables, RPC results or copy (word-boundary regex test).
- [x] Practice is for development only and never gates. No skill evidence or ledger rows are written, and finalize checks that no sjt evidence exists.
- [x] Scoring is against the expert key (0–3, exactly one 3) as the share of the expert best. The trend over time is shown as a LineChart plus a history table, alongside the ENEC average BenchmarkLine.
- [x] RBAC:
  - Practice is Own.
  - Items: the training manager writes (secure_items A, versioned, at least 2 active items per core skill kept). Instructors and other secure_items W holders read only.
  - HR sees the practice aggregate (Agg, suppressed under 10).

## Routes (6, registered in m33)

| Route | Path | Access | Nav |
|---|---|---|---|
| learn-core-skills | `/learn/core-skills` | public | learn 46 |
| learn-core-skill | `/learn/core-skills/:id` | public | smoke id cs-questioning |
| my-core-skills | `/my/core-skills` | OWN | skills 18.6 |
| my-core-practice | `/my/core-skills/practice` | OWN, `?skill=` focus | skills 18.7 |
| workforce-core-skills | `/workforce/core-skills` | skills_profile Agg | workforce 67 |
| training-sjt-items | `/training/sjt/items` | secure_items W/A | training 71 |

## Tables

- kafaa_core_skills (16)
- kafaa_core_skill_targets (320 = 20 families x 16)
- kafaa_core_skill_candidates (8)
- kafaa_sjt_items (48)
- kafaa_sjt_attempts (194 completed sets for 70 staff, 2025-Q4..2026-Q4)

## RPCs

All are SECURITY DEFINER and granted to authenticated only; anon cannot execute them. Each has a TypeScript signature, a local implementation and SQL, with a Supabase mapping.

- kafaa_core_skills_mine
- kafaa_core_skills_stats
- kafaa_start_sjt
- kafaa_submit_sjt
- kafaa_sjt_context
- kafaa_sjt_stats
- kafaa_save_sjt_item

There are 15 internal helpers (kafaa_cs_*, kafaa_sjt_*). They are revoked from public, anon and authenticated.

## Migration

`supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql`. Generated schema and RLS migrations, seed.sql, seed.json and types.gen.ts were regenerated.

## Seed

- `scripts/seed/ext/fs25-core-skills.mjs` and `fs25-core-skills.items.mjs`.
- All people are synthetic.
- k-ro's practice trend rises from 58 to 83.
- Forced personas: k-ro, sro, k-lo-trainee, training-mgr, chco.

## Tests

Unit tests:
- `tests/unit/fs35-core-skills.test.ts`: 22 tests, one or more per acceptance criterion plus RPC flows and RBAC.
- `tests/unit/fs35-pages.test.tsx`: 9 page tests covering EN/AR framework, skill page, my core skills, practice end to end, AR practice, HR suppression, item bank read-only and editable.

Validator:
- `scripts/validate/fs35-core-skills.mjs` (PGlite).
- It covers SQL = TS parity on seeded state, RLS, talent-review isolation, the gamification scan and RPC flows.
- All checks pass, and the full migrations:validate run passes.

Gates:
- gen, check:i18n (m33 has 344 keys, EN/AR parity), typecheck, check:public and build pass.
- Full unit suite (112 files), run file by file because the shared container was under memory pressure: every test passes except the route-count pins (expected 227, now 233, +6 routes). The pins are in fs11-foundation, fsqa1-integration, fsqa2-integration, w4-integration and w5-integration. They are left to the integration lead as instructed.
- fs25-pages (FS15/FS16) timed out once under load. Re-run alone, it passes 7/7.

## Live (Supabase hlirqxoddysxtdezwcgv)

All objects are additive kafaa_* only, with no DROP or DELETE.

Applied:
- Migration `kafaa_fs35_core_skills_part1_tables_rls`.
- Migration `kafaa_fs35_core_skills_part2_functions`.
- Data loaded with `insert ... on conflict do nothing`, in chunks.

Digests match the local PGlite seed exactly:

| Object | Live digest |
|---|---|
| core_skills | 16 28333d09c0d3bcea54d76697f8aeaebd |
| core_skill_targets | 320 91e22610ecabda040dfc420d6e253503 |
| core_skill_candidates | 8 8e89985889101ea7e24380f176553512 |
| sjt_items | 48 de1aede273fcb2311d056a914b885141 |
| sjt_attempts | 194 7b32cdb4bba08f5480f44d3ff858d0e6 |
| function bodies | fn_digest 7327c1f9f6d0831255672422ddfbee6f (22 functions) |

Other live checks:
- Grants: anon executes none of the functions; authenticated executes only the 7 RPCs.
- RLS as anon reads: core 16, targets 320, items 0, attempts 0.
- Live ENEC practice average: 64 over 70 participants.
- Live k-ro summary: 6 met / 2 below / 8 no evidence.

## Gaps and notes

- No new F01 skill evidence is seeded for core skills. Skills without linked person_skills show "no evidence yet" honestly, with their development and assessment routes.
- Route-count pins (227 to 233) are left to the integration lead.
- Nav placement numbers are proposals. No Playwright or browser runs were made, as instructed.
- Data-only couplings, all read-only and logged in CONTRACT.md Changelog:
  - kafaa_benchmarks
  - M08 traits
  - FS02 catalogue skills
  - job families
  - person_skills
