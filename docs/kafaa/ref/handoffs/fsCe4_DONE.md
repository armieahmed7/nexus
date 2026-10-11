# fsCe4 DONE: FS23 Behaviourally anchored descriptors and generic level attributes + FS24 Scale mapping and an "Authority" recognition (M02)

Worktree `/workspace/kafaa-fsCe4`, branch `fsCe4`, commits 306048b and edba66e (not pushed). Live: Supabase `hlirqxoddysxtdezwcgv` (additive kafaa_* only).

## Acceptance

### FS23 (SFIA9, SSG-SF, IAEA-1917)
- [x] Every skill has descriptors at each level where it exists, and none uses the old template sentence. 120/120 skills complete (427 published levels), no published row outside its range, `descriptorCoverage().templated` is empty. The detector catches all 116 old F01 competency level texts (EN and AR) and the FS02 `LEVEL_ESSENCE` sentence. SQL `kafaa_save_descriptor` refuses template text with code `invalid` (template). Tests: `fs34-descriptors` "acceptance: every skill ..." and the PGlite validator.
- [x] Indicators exist in EN and AR. Each level has 2-4 indicators with the same count in AR and EN, in Arabic script with no tatweel. There is a DB check (`kafaa_skill_descriptors_shape_ck`), test "acceptance: indicators exist in English and Arabic", and Arabic page rendering in `fs34-pages`.
- [x] Check-in pages show indicators for the skill being rated. The M17 `LevelPicker` (self rating, peer rating and manager validation) renders `<LevelIndicators>`, which shows the indicators at the level picked, or "not defined at this level" with the rationale. Tests: `fs34-pages` "acceptance (check-in)" and `fs34-descriptors` "check-in raters see the indicators".
- [x] Generic level attributes cover essence, autonomy, influence, complexity, knowledge and behaviours at 4 levels (24 rows), each with its SFIA 9 level (1-2, 3, 4, 5).
- [x] Each skill is defined only at the levels where it exists, with a published EN/AR rationale (`skill_level_ranges`). The DB check is `kafaa_skill_level_ranges_bounds_ck`.
- [x] `saveDescriptor` gives frameworks W, is audited and writes no ledger. Writes are refused for non-owners and for the auditor. RBAC: published rows are public R, while drafts and archived rows are visible to sat and audit_log only.

### FS24 (SFIA9, DIGCOMP, UAE-NQF)
- [x] Every mapping row cites its framework source. There are 35 rows (5 frameworks x (1 scale + 6 bands)), each with an https source and an as-of date of 2026-10-10. The DB check is `kafaa_scale_maps_source_ck`. Loose fits carry EN/AR notes. The NQF column is marked indicative and states that Kafa'a is not a recognition authority. Tests and the validator cover this.
- [x] Authority never changes the F01 level (unit test). The test recognises w-sro-02, then runs `applySkills` recompute: the person_skills digest is unchanged and no `skill_evidence` row is written. The RPC never touches person_skills or skill_evidence. `level_at_proposal` is checked `= 4`. In the UI, Authority is a recognition shown with "not a level", never a fifth level, with no points or badges. The PGlite validator also checks the person_skills digest after SQL flows.
- [x] An Authority recognition needs two different approvers and writes a ledger row. The proposer (training manager or HR director) can never decide (`maker_checker`, plus the DB check `decided_by <> proposed_by`). Only the HR director approves. Approve writes ledger `kafaa.authority.recognise`. "Not yet" needs a note and writes no ledger row. Withdrawing a current recognition writes `kafaa.authority.withdraw`. Covered by unit and page tests, and by the SQL flows in the validator.
- [x] A "not yet" state exists, seeded with p-ep-manager.
- [x] The map is public R. Recognition is A for the HR director with a second approver. Recognitions are read by the person themselves and by recognition R/W/A. Candidates are listed for recognition holders only, never security skills.
- [x] FS08 is used data-only: `skill_alignments.level_map` is shown as follows/differs on the descriptor page and the scale map. All SFIA 9 and DigComp alignments follow the published map.

## Routes (7, M02; route-count pins left to the integration lead)
- `/competencies/levels` (public; nav careers 13.1)
- `/competencies/descriptors` (public)
- `/competencies/descriptors/:skillId` (public; signed-in overlay)
- `/competencies/scale` (public; nav 13.2)
- `/my/levels` (skills_profile Own; nav my skills 18.6)
- `/admin/descriptors` (admin, training manager, instructor, auditor read-only; nav admin 6.7)
- `/admin/authority` (recognition A or R; nav 6.8)

`/competencies` now links to Levels and to the Scale map, and shows the FS23 core-skill essence instead of the old template sentence.

## Tables and RPCs
- Tables: `kafaa_level_attributes`, `kafaa_skill_level_ranges` (a deviation: the card's "levels where the skill exists" plus its published rationale), `kafaa_skill_descriptors`, `kafaa_scale_maps`, `kafaa_authority_recognitions`.
- RPCs, each with TS, local, SQL SECURITY DEFINER and a supabase map, granted to authenticated only:
  - `saveDescriptor` / `kafaa_save_descriptor`
  - `setLevelRange` / `kafaa_set_level_range`
  - `recogniseAuthority` / `kafaa_recognise_authority`
  - `authorityCandidates` / `kafaa_authority_candidates`
- 12 internal helpers (`kafaa_sd_*`, `kafaa_ar_*`) are revoked from API roles.
- Migration: `supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql`.
- Notifications are inserted with the row audit quiet. Proposals go to HR directors; decisions go to the person.

## Seed (`scripts/seed/ext/fs23-descriptors{,.data}.mjs`, FINALIZE_LAST)
- 24 level attributes and 120 ranges.
- 428 descriptors: 427 published, 1 draft (`sd:sk-ld-01:1`), and 1 v2 edit (`sd:sk-fs-ai-verify:3`).
- 35 scale rows.
- 5 recognitions: w-sro-01 and p-sro recognised, w-rp-01 and w-qa-01 proposed, p-ep-manager not yet.
- 2 notifications.
- 28,296 rows across 248 tables. Synthetic people only.

## Gates
- gen: pass (28,296 rows).
- check:i18n: pass (40 namespaces, parity).
- typecheck: pass.
- Unit tests, run serially:
  - `tests/unit/fs34-descriptors.test.ts`: 18/18, one test per acceptance criterion plus rules, RPCs, RBAC and the Supabase mapping.
  - `tests/unit/fs34-pages.test.tsx`: 10/10 (jsdom, EN and AR).
  - Related suites re-run single-fork: w1e1-pages 6/6, w2e1-checkins 18/18, w2e5-leadership 32/32, w4e2-sat 24/24, w5e1-ojt 20/20.
  - w4e5-instructors passes after its M02 mapping pin was widened for the 3 new calls (a test edit).
  - w2e1-pages 6/7: the first test times out at 30 s under container load. It times out the same way with the original ciUi.tsx, so the failure is pre-existing.
- migrations:validate: "All migration checks passed" (1,337 checks, of which 31 are in `scripts/validate/fs34-descriptors-scale.mjs`). These include SQL = TS on rule batteries, RLS, RPC flows, grants and additive-only SQL.
- check:public: pass.
- build: gen, i18n and tsc pass. The first full `npm run build` was OOM-killed in vite under container memory pressure; `vite build` alone was re-run and passed.

## Live (hlirqxoddysxtdezwcgv)
- Applied as `kafaa_fs34_descriptors_scale_part1_tables_rls`, `_part2_helpers` and `_part3_rpcs`.
- Seed was loaded with `insert ... on conflict do nothing`. Descriptors were rebuilt server-side from family templates plus per-skill anchors in 5 calls, a loader first proven equal in PGlite.
- Verified live = local:
  - level_attributes 24 `813cf8a4…`
  - skill_level_ranges 120 `45aa56b1…`
  - skill_descriptors 428 `53200f49…`
  - scale_maps 35 `0f2e3d80…`
  - authority_recognitions 5 `f91f83e9…`
  - notifications 2 `07f58495…`
  - 16 function bodies `6079e416…`
- Anon sees 427 descriptors, 35 maps and 0 recognitions. Anon cannot execute the RPCs, and helpers are not executable.

## Shared edits (logged in CONTRACT.md changelog)
- `src/modules/m17/ciUi.tsx`: an import plus a one-line `<LevelIndicators>` in LevelPicker.
- Generated files (`types.gen.ts`, `seed.json`, `seed.sql`, generated schema/RLS SQL) come from `npm run gen`.

## Gaps / hand-offs
- The M28 skill page ladder (`/skills/:id`) still uses `LEVEL_ESSENCE`. It could read `skill_descriptors` (owner: M28 / integration).
- FS29 can reuse `scale_maps` (NQF column).
- Route-count pins (e.g. in w4e2-sat and m14 rbac tests) are for the integration lead.
- No Playwright was run, per instructions.
