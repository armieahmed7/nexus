# fsBe5 DONE: FS15 Future roles in the Navigator and Roadmap + FS16 Role outlook labels (M18)

Branch `fsBe5` at commit `c9b8cb8` (worktree `/workspace/kafaa-fsBe5`), not pushed. Netlify untouched. Live Supabase `hlirqxoddysxtdezwcgv`: additive `kafaa_*` objects and rows only (plus one guarded data update of the F24 `navigator` engine card row).

## Acceptance

### FS15 Future roles in the Navigator and Roadmap (benchmarks SG-CAREER, CORP)
- [x] **Persona k-ro can shortlist a concept role and build a roadmap to it.** `/my/career` lists all 11 concept roles in a "Future roles (concept)" section (cards ranked through the engine kernel `run()` with FS05 context; k-ro's own bridge into the small BWR operator concept role first), with a Shortlist button (three-target cap respected) and a Roadmap link. `/my/career/roadmap?role=fr-bwr-operator` offers concept roles, shows the "concept role, no vacancy and no deployment decision" banner, builds the route over the FS05 future edge, adds an indicative bridge-learning block sized by my FS05 profile gaps and ends in a "profile-ready" milestone (never a move); development blocks go to the plan through `roadmapToPlan`. Tests: `fs25-future-roles` "persona k-ro can shortlist…", `fs25-pages` (Navigator, shortlist from the card, roadmap).
- [x] **Readiness uses the FS05 profile and shows its reasons.** `futureRoleReadiness` measures each concept role against its FS05 profile (2030, else 2035; highest published version): weighted coverage with the Navigator engine weights, bridge edge, gaps with the profile's own "why" lines, bands profile_met / within / stretch; reasons cite the profile version (`ref role_profile_versions`), the bridge, top gaps, band and the concept notice (lintRanked clean). TS = SQL for 114 staff x 11 concept roles (PGlite).
- [x] **Transition counts under 10 are suppressed.** `transitionEvidence` gives count + median months in the previous role from the SIMULATED anonymised `role_moves` mirror; under 10 → no count and no median ("not shown, to protect privacy"); concept targets never carry a count and show the same-family analogue (also suppressed under 10); security roles path-only. TS = SQL for 28 x 39 pairs (PGlite); unit test checks every cell.
- [x] Concept roles in the team view (`/team/career`): shared concept targets show concept readiness (same access rule as F05, tested).
- [x] F24 card updated: `engine_cards.navigator` v2 lists the FS05 profile and move-mirror inputs, the FS15 scoring functions and the concept-role limitation (seed + guarded migration update; PGlite proves it runs once and reproduces the seeded card).

### FS16 Role outlook labels with published criteria (benchmarks ONET, CORP, FORECAST)
- [x] **The criteria page lists every threshold.** `/careers/outlook-criteria` (public): three label tiles with counts of roles, the ordered rules (changing → growing → stable), the thresholds table (profile change ≥ 30 %, demand growth ≥ 5 % = the sourced O*NET Bright Outlook figure shown on a `<BenchmarkLine>`, shortfall > 0 %), sources with as-of dates, both criteria versions (v1 2024-2025 retired, v2 from 2026), and every role's label per year (2024, 2025 archived, 2026).
- [x] **Labels reproduce exactly from the rule.** Every stored label (75) equals `outlookLabel(components, criteria)` in TS and `kafaa_fs16_label` in SQL; today's inputs (F35 released outlook + FS05 profiles) give exactly the stored 2026 labels (`computeLabels` = `kafaa_fs16_compute` = stored, PGlite and live md5). 2026: 12 changing, 10 growing, 3 stable.
- [x] **No headcount appears on public pages.** Labels table is label-only (public); components are staff-only (`transformation` R) and percentages only; anon reads 0 components and 0 moves; the public page text passes `publicTextIsClean`.
- [x] Staff see the components and "Why this label?" (Navigator role cards and the criteria page); the training manager and HR director preview this year's labels; only the HR director publishes (`publishOutlookLabels`: audited, ledgered, past years `past_year_locked`).

## Routes
- New: `careers-outlook-criteria` `/careers/outlook-criteria` (public, nav careers 11.8). Route count 212 → 213 (pins left to the integration lead).
- Extended: `/my/career` (future roles section, transition evidence and outlook labels on moves, concept shortlist rows, concept drawer), `/my/career/roadmap` (concept targets), `/team/career` (shared concept targets).

## Tables / RPCs / SQL
- Tables (M18): `role_moves`, `role_outlook_criteria`, `role_outlook_labels`, `role_outlook_components`.
- RPCs: `futureRoleReadiness`, `transitionEvidence`, `outlookLabelsPreview`, `publishOutlookLabels` (TS signature, LocalBackend, SQL SECURITY DEFINER, Supabase mapping).
- Internal SQL: `kafaa_fs15_concept_readiness_compute`, `kafaa_fs15_cell`, `kafaa_fs15_transition_compute`, `kafaa_fs16_r1|label|outlook|components|compute` (not executable by API roles).
- Migration `supabase/migrations/20261010225001_kafaa_fs25_future_roles.sql`; applied live as `kafaa_fs25_future_roles_part1_tables_rls`, `_part2_fs15_functions`, `_part3_fs16_functions_card`. Live = PGlite: 12/12 function bodies md5-identical; role_moves 156, criteria 2, labels 75, components 75 identical by count, id digest and row digest; navigator card identical; anon executes none of the new functions, authenticated only the 4 RPCs.
- Seed: `scripts/seed/ext/fs15-future-roles.mjs` (FINALIZE_LAST; applies the fsqa1 FS02 remap itself so labels match the final profiles in any order).

## Tests and gates
- `tests/unit/fs25-future-roles.test.ts` (10: one per acceptance criterion + RBAC/refusals + RPCs + wiring), `tests/unit/fs25-pages.test.tsx` (7: EN, AR, public, staff, HR).
- `scripts/validate/fs25-future-roles.mjs` (27 PGlite checks, all pass).
- Gates: see the gate table below.

| Gate | Result |
|---|---|
| `npm run gen` | pass (no diff after regeneration) |
| `npm run check:i18n` | pass (40 namespaces, EN/AR parity) |
| `npm run check:public` | pass |
| `tsc --noEmit` | pass |
| unit (vitest, 100 files / 1,885 tests) | 1,881 pass. The 3 F24 runner failures caused by the Navigator card v2 are fixed (runners added; w3e5-no-protected-inputs 46/46). 8 page tests timed out only under machine memory pressure in the full parallel run and pass when rerun serially (8 files, 79/79). The 4 remaining failures are route-count pins (212 -> 213: w4-integration "every route guard...", w5-integration, fsqa1 x2), which go to the integration lead. |
| fs25 tests | `fs25-future-roles` 10/10, `fs25-pages` 7/7 |
| `npm run migrations:validate` | pass (1,154 checks, including fs25-future-roles 27/27) |
| `vite build` | pass |

## Gaps / hand-offs
- Integration lead: bump the route-count pins 212 -> 213 in `tests/unit/w4-integration.test.tsx`, `tests/unit/w5-integration.test.tsx` and the two fsqa1 tests.
- M01 career pages (not my folder) do not show the label yet: mount `<RoleOutlookBadge roleId>` from `src/modules/m18/futureUi.tsx` on `/careers` and `/careers/roles/:slug` (public: label only; staff: with components).
- F12 conversation agendas and the F36 digest still compute shortlisted roles with `careerReadiness`; a shortlisted concept role reads 0 % there. Switch them to `futureRoleReadiness` for `lifecycle = 'concept'`.
- FS13 (fsBe4, M21) should reuse `conceptReadiness` rather than add a second concept-readiness rule.
- Security, safeguards and cyber roles and concept roles carry no outlook label (career-path level only / no vacancy); the criteria page says so.
- Nobody holds the FS02 future skills yet, so concept readiness is honest but low (bands seen: within, stretch); no one is "profile met".
- Archived 2024/2025 label components are SIMULATED archive values (criteria v1, no profile-change component).
