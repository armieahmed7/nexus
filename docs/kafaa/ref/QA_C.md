# FS wave C integration and QA (FS17-FS26), 11 Oct 2026

Repo `/workspace/kafaa`, branch `master`. Commits: merges `1cd35f6`, `52d6e47`, `c434d82`, `0784fb0`, `e3acd6b`, then `ffbf00f` (wiring, QA migration, tests, fixes). Not pushed. Netlify was not touched.

## Merge
- `fsCe1`..`fsCe5` merged `--no-ff` in order:
  - FS17/FS18 pathways and the external catalogue;
  - FS19/FS20 course pack and academies;
  - FS21/FS22 adaptive assessment and performance tasks;
  - FS23/FS24 descriptors, scale map and Authority;
  - FS25/FS26 core skills and SJT.
- Conflicts were of three kinds:
  - generated files, regenerated with `npm run gen`;
  - the CONTRACT changelog, where both sides were kept;
  - four shared "no derived future-skill state" invariants (`fs11-catalogue`, `fsqa1-integration` test and validator, `fs11-foundation` validator), where the lists of recorded-evidence tables were unioned.
- Result: 259 routes (227 + 32), 272 seed tables, 32,026 seed rows, 57 personas and 62 migrations.

## Cross-feature wiring (CONTRACT changelog "FS wave C integration and QA")
- **FS21/FS22 -> FS17:**
  - Assessment steps now also discover active adaptive banks (up to the bank's evidence cap) and performance tasks (up to the task's evidence level) for the step's skill.
  - Progress ticks on a completed bank attempt that counts, or on a scored and passed task that counts. Voided or failed attempts never tick.
  - Implemented in TS (`m19/pathways.ts`) and in SQL (`kafaa_pw_item`, `kafaa_pw_discover`, `kafaa_pw_progress`).
- **Gap backlog (FS17):** all 215 live rows are kept. On the 2026-10-11 refresh, 43 were marked filled (by FS19 courses and FS21/FS22 assessments) and 172 stay open; the open rows equal the requested steps.
- **FS19 evidence keys:** three `kafaa_skills.evidence_keys` arrays were put in the seed's order live (guarded updates).
- **FS23 -> FS07:** the `/skills/:id` ladder shows the published indicators and links to the descriptor page. **FS17 -> FS23:** pathway pages link to "What level N looks like".
- **FS19/FS17 -> FS25/FS21:** the `LearnForSkills` card (courses and pathways) appears on core-skill pages and on adaptive results. Anonymous visitors see courses only.
- **Benchmark chips:** FS17 and FS18 chips are on the Coach. All 33 wave-C pages show their chips (unit source check, E2E C6).

## Live Supabase (hlirqxoddysxtdezwcgv; additive kafaa_* only, no DROP/DELETE)
- `20261010239001_kafaa_fs3qa_integration.sql` was validated in PGlite (`fsqa3-integration.mjs`: discover parity on 282 cases, progress parity on 1,280 pairs, backlog, idempotence, guards, additivity, grants). It was applied as:
  - `kafaa_fs3qa_integration_part1_pathway_assessment_items`
  - `_part2_pathway_gaps_refresh`
  - `_part3_evidence_key_order`
  - `_part3b_evidence_key_order`
- **Functions:** the md5 of each function body matches live and local (discover 15679469, item b6bdb02e, progress b2fe6b54). There are no anon or authenticated grants.
- **Tables:** all 30 wave-C tables match live and local by count and row digest (e.g. `pathway_gaps 215:d95d963a`, skills `120:97800a4d`). Across the whole database, 217 of 275 kafaa tables are identical; the rest differ only through journey and audit data.
- **Functions overall:** 895 of 898 are identical. The three that differ (`kafaa_dalil_turn`, `kafaa_signoff_evaluation`, `kafaa_log_denied`) differ only by stripped comments, and this was already the case before this wave.

## Gates (final, after the last edits)
- gen: OK, regeneration leaves seed.json, seed.sql and types unchanged.
- check:i18n: OK (40 namespaces).
- typecheck: clean.
- check:public: OK.
- migrations:validate: all checks pass, including fsqa3.
- vite build: OK.
- build:deploy: OK.
- Unit tests: 121 files, about 2,176 tests, all green.
  - The first pass after the merge had 10 failures, all fixed: seed-boot timeouts, the ladder `li` count, and the w3e1 outlier fixture.
  - `fsqa3-integration` has 13 tests.

## Browser E2E (one Chromium, workers=1, vite preview, supabase mode)
- **Route sweep:** 259 routes x 17 sessions = 4,403 checks.
  - Outcomes: 2,138 ok, 2,066 forbidden as expected, 199 sign-in as expected. 0 mismatches.
  - Three routes had console issues:
    - `/team/instructors` for chem-sup and sro got a live 500 (statement timeout). Fixed, see bug 2.
    - `/learn/ai-fluency` for nse had a one-off CORS preflight failure.
  - After the fix, M02 and M29 were rerun for nse, chem-sup and sro: 75 checks, 0 issues.
- **Journeys `tests/e2e/fswaveC.spec.ts`:** 6 of 6 pass (C1-C6) and cover every wave-C acceptance criterion. Live writes are limited to audited refusals; flows that leave evidence run on the local backend.
- **Visual `visual.spec.ts -g fsc`:** 76 of 76 pass. This covers 33 pages in RTL and 33 at 390 px, checked by eye on contact sheets (`qaC/sheet_rtl_*.png`, `sheet_mobile_*.png`), plus 10 shots.

## Bugs fixed during QA
1. `/my/assessments/tasks` was empty for anyone with no task attempts. `<Async>` treats `[]` as empty, and this was seen on the RTL/mobile contact sheets. The same guard was added to the academy nominee field and the SJT bank. There is a unit test.
2. On `/team/instructors`, a manager's unfiltered `kafaa_person_skills` read evaluated RLS per row: 8.2 s live, which hit the statement timeout and returned a 500. The new `src/data/scope.ts` `scopedPersonIds` narrows the read to the people in the caller's scope; it is never wider than RLS and the read now takes 0.2 s. There is a unit test.
3. The FS17 gap backlog drifted after the merge (192 vs 215 live). Fixed with the fsqa3 builder and the guarded refresh.
4. The order of `evidence_keys` differed live for 3 skills. Fixed with guarded updates.
5. Unit tests after the merge:
   - 19 MB seed-boot timeouts (raised to 90 s);
   - the fs21 ladder `li` count;
   - the w3e1 outlier fixture, now ranked on live evidence.
6. E2E selector and persona fixes, for example the envelope tile, the crossover cards, the check-in tab, the own-only SJT reads, and a `toLocal` helper.

## Screenshots
`scratchpad/fs/shots_C/` holds 10 shots:
- 01-08 EN:
  - learning pathway, external catalogue, course pack, academy;
  - adaptive result, performance-task rubric, skill descriptors, my core skills.
- 09: scale map, AR.
- 10: SJT practice, mobile.

## Remaining issues
- Other large person-keyed reads by Scope-only readers may approach the 8 s timeout as live data grows. Only `/team/instructors` failed in the sweep.
- The three foundation functions that differ only by comments, and the `engine_cards` / journey residue differences, were there before this wave.
- Vite chunk-size warnings (the seed chunk is 16.8 MB, 1.5 MB gzip).
- `deploy_out/` was rebuilt and keeps the badge-hiding snippet, the four `_redirects` lines and the issuer keys. It is gitignored and was not deployed.
