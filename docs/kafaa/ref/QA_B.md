# FS wave B integration and QA (FS07-FS16), 10 Oct 2026

Repo `/workspace/kafaa`, branch `master`, commits `e650437`..`32b7eaa` (merges), `4cd28cd` (wiring, QA migration, tests), `cacc25a` (mobile fixes). Not pushed. Netlify not touched.

## Merge
- `fsBe1`..`fsBe5` merged `--no-ff` in order (FS07/FS08, FS09/FS10, FS11/FS12, FS13/FS14, FS15/FS16).
- Conflicts were limited to three kinds:
  - generated files (seed.json, seed.sql, types, schema/RLS SQL), which were regenerated with `npm run gen`;
  - the CONTRACT changelog, where both sides were kept;
  - the imports of `tests/unit/w3e5-no-protected-inputs.test.ts`, where both import sets were kept.
- Result: 227 routes (212 + 15), 243 seed tables, 27,682 seed rows, 56 migrations.

## Cross-feature wiring (TS + SQL; see CONTRACT changelog "FS wave B integration and QA")
- **FS10 -> F35:** FS02 future-skill states (`fs_area` set) are no longer counted as skills-outlook supply (`outlook.ts`, `kafaa_so_base`).
  - Fitness evidence had made 99 staff "digital" holders. The stored outlooks are back to the released ones, and the stress test reads 10 of 10 again.
- **FS10 -> F23:** reserve snapshots leave FS02 skills out (`snapshotFrom`, `kafaa_res_snapshot`).
- **FS15 -> F36/F37:** a shortlisted concept role is never picked as the digest's or Dalil's target (`defaultTargetRole`, `kafaa_dg_gather`).
- **FS15 -> F12:** a concept target in the career-conversation agenda shows its FS05-profile readiness (`concept: true`) instead of 0 % (`buildAgenda`, `kafaa_cc_agenda`).
- **FS16 labels:**
  - role page outlook line plus criteria link;
  - label chips on `/careers` cards;
  - FS16 chips on `/my/career`;
  - FS15 chips on `/team/career`.
- **Links between pages:**
  - horizons tab -> transformation page; concept role -> roadmap;
  - Future Me closest roles show concept readiness;
  - skill links from the FS09/FS11/FS12/FS14 pages to `/skills/:id`;
  - AI-track box on skill pages -> FS09 ladder.
- **FS14 -> F26:** four 2027-Q1 future demand snapshots and one session proposal take the lane interest (guarded updates).
- Every wave-B page shows its BenchmarkChips (unit source check of 21 page files, plus E2E B6).

## Live Supabase (hlirqxoddysxtdezwcgv; additive kafaa_* only, no DROP/DELETE)
- `20261010229001_kafaa_fs2qa_integration.sql` was validated in PGlite, then applied as four migrations:
  - `kafaa_fs2qa_integration_part1_so_base_dg_gather`
  - `_part1b_so_base`
  - `_part2_agenda_snapshot`
  - `_part3_f26_rows`
- The four function bodies have the same md5 live and local (so_base 6cfe01cc, dg_gather 183dc72d, cc_agenda 9511ddc4, res_snapshot 79035780).
- The F26 rows match local.
- Every wave-B table matches live and local by count and row digest.
- Across the whole database, 191 of 245 tables are identical. The others differ only through journey/audit data.

## Gates (final)
- gen OK (0 diff)
- check:i18n OK (40 namespaces)
- typecheck clean
- unit tests: 110 files / 2,016 tests pass
- migrations:validate: 1,306 checks, 0 fails (includes `fsqa2-integration.mjs`, 11 checks)
- check:public OK (57 public tables)
- vite build OK
- build:deploy OK; the badge-hiding snippet is present in `deploy_out/kafaa/index.html`

## Browser E2E (one Chromium, workers=1, vite preview, supabase mode)
- **Route sweep:** 227 routes x 17 sessions = 3,859 checks.
  - Outcomes: 1,834 ok, 1,849 forbidden as expected, 176 sign-in as expected.
  - 0 mismatches, 0 text issues.
  - Run in two parts: 9 sessions in 1.4 h, then 8 sessions in 49 min.
- **Journeys `tests/e2e/fswaveB.spec.ts`:** 8 of 8 pass, covering every wave-B acceptance criterion.
  - B1: FS07/FS08.
  - B2: FS09/FS10. B2b: full adaptive check, local k-ro.
  - B3: FS11/FS12.
  - B4: FS13/FS14, with an ADVANCE step that is undone.
  - B5: FS15/FS16, concept shortlist plus roadmap, removed afterwards. B5b: local k-ro.
  - B6: integration, plus 10 AR pages with Arabic-Indic digits.
- **Visual `visual.spec.ts -g fsb`:** 58 of 58 pass. This covers 24 pages in RTL and at 390 px, checked by eye on contact sheets (`qaB/sheet_*.png`), plus 10 shots.

## Bugs fixed during QA
1. F35 supply counted fitness-check evidence.
2. F23 snapshots included FS02 skills.
3. The digest/Dalil target could be a concept role.
4. The agenda showed concept targets at 0 %.
5. A resolver script committed a conflict marker (fixed and amended; the script now stops on an unresolved conflict).
6. Typecheck errors in `suggestActions` and the band pill.
7. Three FS11 unit fixtures broke after the merge:
   - FS10 evidence now meets k-ro's 2030 profile, so the fixtures moved to 2035 and now assert 2030 = ready;
   - a public skills race was fixed with findBy.
8. Mobile overflow:
   - `/my/ai-fluency` stat tile ("Practitioner");
   - `/careers` FS05 "from" chips.
9. Seven E2E selector/data fixes, for example the "points" false positive, the Arabic digits preference, and the persona with a concept bridge.

## Screenshots
`scratchpad/fs/shots_B/` holds 10 shots:
- 01-08 EN:
  - skills explorer, skill crosswalk, AI fluency ladder, AI fitness workforce;
  - my role 2030, task exposure, Future Me lanes, future roles navigator.
- 09: outlook criteria, AR.
- 10: my role 2030, mobile.

## Remaining issues
- Three foundation functions (`kafaa_signoff_evaluation`, `kafaa_log_denied`, `kafaa_dalil_turn`) differ live only by stripped SQL comments. This was there before wave B.
- `engine_cards` rows for experts, marketplace, mentoring and rotations differ live. This was there before wave B.
- Dalil F37 `careerReadiness` for a concept role asked about directly (m13 engine.ts) still uses F05 readiness, not FS15.
- Journey residue live, all inactive or reset:
  - `ct:p-sro:fr-owners-engineer` and `ct:p-buyer:fr-owners-engineer` (active=false);
  - `ftp:p-nse:trk-orientation` steps reset to [].
- Vite chunk-size warnings.
