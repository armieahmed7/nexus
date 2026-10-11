# FS wave A: integration and QA report (10 Oct 2026)

Repo `/workspace/kafaa`, branch `master` (not pushed). Netlify not touched. Live Supabase `hlirqxoddysxtdezwcgv`: additive `kafaa_*` changes only.

## Merge
- fsAe1 (FS01 benchmark registry, FS02 catalogue) `e20a1bd`, fsAe2 (FS03 decay) `2a033be`, fsAe3 (FS04 keyspace) `f44536d`, fsAe4 (FS05 role horizons) `9cfc62a`, fsAe5 (FS06 task layer) `4c2b929`.
- Conflicts: generated files (seed.json, 120100/120300 SQL, seed.sql) taken from ours and regenerated with `npm run gen`; `src/data/ext/{local,rpc,schema,supabase}.ts` hooks combined; CONTRACT.md kept both sides plus a wave A QA changelog entry.
- Integration commit `0857b21`, then `08e7e42` (typecheck) and `8821d68` (UI fixes), then `80d05dc` (final QA: chip styling, CONTRACT entry).

## Cross-feature wiring
- FS01 shared chips (`<BenchmarkChip>` from `kafaa_benchmarks`) now drive the FS03, FS04, FS05 and FS06 module chips, plus the profile editor and the FS06 task card.
- FS02 decay classes now equal the FS03 area defaults (fast 18 / standard 36 / slow 60 months).
- `FUTURE_SKILL_EQUIVALENT` remaps FS05 future profile requirements (53 versions) and FS06 future task links (48) to FS02 skills. FS04 gets 12 extra keyspace rows (future_skill_map now 70 rows).
- FS05 future edges (current role to concept role) are excluded from the Navigator reach, career moves, F24 fairness reach and the F36 digest target, in both TS and SQL.
- Wave QA migration `supabase/migrations/20261010219001_kafaa_fs1qa_integration.sql`: guarded UPDATEs, INSERT ... SELECT with on conflict do nothing, and create-or-replace of `kafaa_fairness_compute` and `kafaa_dg_gather`. It has no drop, alter, delete or truncate. It has its own PGlite validator (`scripts/validate/fsqa1-integration.mjs`), which checks the forward proof, idempotence and guards.

## Gates (final code)
| Gate | Result |
|---|---|
| gen | OK: 223 SQL tables, 24,216 seed rows |
| check:i18n | 40 namespaces in EN/AR parity |
| typecheck | OK |
| unit tests (serial) | 98/98 files, 1864/1864 tests, including the new `tests/unit/fsqa1-integration.test.tsx` (18 tests, one per wave-A integration criterion) |
| migrations:validate | all checks passed |
| check:public | 44 public tables, 40 benchmarks, 120 skills |
| build / build:deploy | OK (chunk-size warnings only) |

## Live apply and digests
- FS03 had never been applied live by its engineer. Applied as `kafaa_fs12_decay_part1_tables_rules_states` and `kafaa_fs12_decay_part2_check_backfill_rpcs_grants`. Then inserted 3 skill_decay_classes rows and ran `kafaa_skills_apply(null, current_date)`.
- QA migration applied as `kafaa_fs1qa_integration` and `kafaa_fs1qa_integration_part2_future_edges`.
- One seeded digest row was updated to match the FS03 seed: dg:w-corp-02:2026-W41 item 3 changed from 85 to 80.
- Live and local function md5s match: 39 wave-A functions, plus fairness_compute and dg_gather.
- Live and local count, id digest and row digest all match for: skills 120, benchmarks 40, skill_decay_classes 3, future_skill_map 70, adv_skills 27, future_skills 16, skill_gap_plans 7, role_profile_versions 101, jta_task_skills 246, ai_capability_levels 27, ai_exposure_refs 6, sat_analysts 2, job_roles 39, career_paths 46, fairness_snapshots 160.

## Browser E2E (one Chromium, workers=1, vite preview, supabase mode)
- **Full route sweep:** 212 routes × 17 sessions = 3,604 route checks. 0 mismatches and 0 text issues. Results: 1,679 ok, 1,758 forbidden as expected, 167 sign-in redirects as expected. Sessions: 13 supabase sessions (anon plus 12 personas) and 4 local-only Kafa'a personas.
  - The first run hit its background time limit after 17 of 18 tests. The last session, k-ecp, was rerun on its own and passed.
- **Journeys (`tests/e2e/fswaveA.spec.ts`):** 6 of 6 pass.
  - A1: FS01/FS02 registry and catalogue.
  - A2: FS03 states, bands and refusals.
  - A3: FS04 keyspace and radar.
  - A4: FS05 horizons and concept roles.
  - A5: FS06 task layer, including a live edit with change-log rows.
  - A6: chips on every wave-A page, in EN and AR.
- **Visual set (`visual.spec.ts -g fsa`):** 34 of 34 pass. Covers 12 new pages in RTL and at 390 px mobile, checked by eye on contact sheets.

## Screenshots
`scratchpad/fs/shots_A/` (10 images, from the final build):
- 01 to 08: EN (registry, catalogue, confidence bands, half-lives admin, radar, role horizons, task layer, keyspace).
- 09: careers horizons in AR.
- 10: skill confidence on mobile.

## Bugs found and fixed
1. **Concept roles in the Navigator.** FS05 future edges were traversed by pre-FS05 engines. Navigator showed concept roles (0 %, "ready in 0 months") as the only reachable roles for 6 roles. The same issue changed 10 seeded F24 fairness rows and digest targets. Fixed in TS and SQL.
2. **Decay classes disagreed.** FS02 and FS03 assigned different decay classes, which broke `gen`. They are now harmonised and the F01 digest baseline is updated.
3. **Module chips bypassed the registry.** FS03 to FS06 module chips used local lists instead of the FS01 registry. Fixed.
4. **/workforce/future scrolled sideways.** The page scrolled 249 to 382 px in EN and AR. Fixed.
5. **/careers/horizons overflowed at 390 px.** Concept chips were nowrap and overflowed by 29 px. Fixed.
6. **FS06 task skill rows overlapped on phones.** Fixed.
7. **"At the horizon" chips were unreadable.** They were white on pale teal. Fixed.
8. **Benchmark chips inherited eyebrow styling.** In EN the chips picked up eyebrow letter-spacing and uppercase. In AR the year label rendered in the mono font, so "(المرجع المعتمد حالياً)" was letter-spaced. Fixed.
9. **FS03 was missing live.** Applied (see above).
10. **One seeded digest row was stale.** Updated (see above).

## Live writes beyond migrations
- `kafaa_skills_apply` back-fill: 1,955 person skill states.
- 1 digest row update.
- Journey A5 adds 2 F06 change-log rows per run (the edit is restored).
- Earlier journeys add journey rows: digest_runs is 395 live vs 393 in the seed.

## Remaining issues
- Live person-skill states (1,955) exceed the seed (1,924) because of journey data. This is expected.
- Transform and assess engine overrides are not storable in engine_settings. This is a pre-existing design limit.
- The 49 new FS02 skills have no holders yet, so readiness credit for them comes only from FS04 transfers and adapts.
- Concept roles were filtered only in the Navigator, careerMoves, F24 and the digest. M20, M21 and M23 readers were not audited for concept roles.
- The FS03 half-life tile shows "18" twice (fast class, and the cyber-hygiene override). This is cosmetic.
- The vite build still warns about chunk sizes (seed chunk 11.6 MB, gzip 1.05 MB).

## Deploy
- `deploy_out/` was rebuilt with `npm run build:deploy` from final master.
- The Netlify badge-hiding snippet is present in `index.html` and `deploy_out/kafaa/index.html`.
- `scratchpad/kafaa_build/DEPLOY_READY.md` is updated: 50 migrations, FS wave A notes, 212 routes.
