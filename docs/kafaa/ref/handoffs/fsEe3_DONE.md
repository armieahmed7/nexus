# fsEe3 DONE: FS44 Expert lecture library + FS45 Localisation countdown to 2030 (M24)

Branch `fsEe3` (off `main`), worktree `/workspace/nexus-fsEe3`, app in `kafaa/`. Not merged, not deployed, nothing applied live (no Supabase in this session).
Contract changelog: `kafaa/CONTRACT.md`, entry "2026-10-11 · FS wave E · E3".

## Acceptance (one named test per criterion)

| | Criterion | Local test (`tests/unit/fs53-lectures-localisation.test.ts` unless noted) | SQL proof (`scripts/validate/fs53-lectures-localisation.mjs`) |
|---|---|---|---|
| [x] | FS44-1 Validated contributions recompute skills; unvalidated ones do not | `acceptance FS44-1: a pending contribution writes nothing; validating it writes rating/validated evidence and recomputes the person's skills; a rejection writes nothing` (+ `validated contribution evidence is recorded evidence: an F01 recompute keeps it`; page: `the review page: the KM owner publishes a submitted lecture and validates a contribution, which writes evidence` in `fs53-pages.test.tsx`) | "acceptance (FS44): a pending contribution has written no evidence and no skill state", "validating a contribution writes rating/validated evidence ... recomputes ...", "a rejected contribution needs a reason and writes no evidence", "F01 recompute keeps contribution evidence" |
| [x] | FS44-2 No security-restricted topic can be published (refusal) | `acceptance FS44-2: security skills, security texts in English and Arabic and restricted positions are refused; publication re-screens the lecture` (page: `recording a lecture: a security topic is refused in the form ...`) | "security-restricted skills and texts (EN and AR) are refused with security_restricted", "a security-restricted topic can never be published (re-screened at publication)", `kafaa_lc_problem` = `lectureProblem` on 58 cases |
| [x] | FS44-3 Each lecture links at least one skill and the KLRA position it protects, where one exists | `acceptance FS44-3: every seeded lecture links at least one skill and its speaker's KLRA position when the speaker holds one; saving links it automatically` | "every lecture names the KLRA position its speaker holds, where one exists (16 of 17)", "saveLecture: ... linked to the speaker's own KLRA position automatically" |
| [x] | FS45-1 Every partner-delivered programme in the seed appears with a date | `acceptance FS45-1: the board lists every seeded item with a target date no later than 2030-12-31, its programme and partner` | "all 16 partner-delivered items carry a programme, a partner and a target date no later than 2030-12-31", check constraint test |
| [x] | FS45-2 Readiness is computed from F31, not entered | `acceptance FS45-2: the table has no readiness column; the board equals computeBoard over the F31 tracks; a new track changes readiness` (+ `readiness never reads nationality, gender or age`) | "kafaa_localisation_items has no readiness column", `kafaa_lz_tracks` = M02 rules on 6 dates, `kafaa_lz_compute` = `computeBoard()` on 6 dates + 160 generated items, "readiness follows the F31 pipeline" |
| [x] | FS45-3 Items past their target date are flagged and appear on the F22 handover board | `acceptance FS45-3: overdue items are flagged on the board and returned by localisationOverdue to F22 viewers (HR, managers, auditors)` (page: `the F22 handover board panel lists the overdue localisation items for HR`) | "items past their target are flagged and listed for the F22 handover board (loc-loit-watch, loc-rp-initial)" |

The panel component exists and is tested (`LocalisationOverduePanel`, `src/modules/m24/links.tsx`); mounting it on `/workforce/handover` (M07, unowned in wave E) is the integration lead's one-line wiring (below).

## What was built

- **FS44 lecture library** `/knowledge/lectures` (staff, knowledge R): tiles, synthetic label, search and skill / family / format filters, cards with skills and the protected KLRA position (role title only; the band stays in the KLRA), Plan 2035 and IAEA NG-T-6.11 source links with as-of dates, `<BenchmarkChips feature="FS44" />`; "My lectures and contributions" tab with statuses and `<WhyThis>` reasons; "Record a lecture" form (EN/AR texts, format, language, date, minutes, family, skills, chapters, synthetic REC- code) behind a `<ConfirmDialog>`.
- **Lecture page** `/knowledge/lectures/:lectureId` (smoke param `lec-001`): abstract, chapter timeline, skills (linked to `/skills/:id`), facts, protected position (KLRA link only for knowledge A/Scope), related lectures and assets, the speaker's own contribution with reasons, withdraw with a reason.
- **Review** `/knowledge/contributions` (knowledge A): tiles, the rule, "Find new contributions", tabs "Lectures to publish" (publish / return with reason), "Contributions to validate" (skills that carry evidence vs those that cannot, reasons, validate / reject with reason), "Decided" table with CSV.
- **FS45 localisation countdown** `/knowledge/localisation` (staff, knowledge R): days-to-2030 countdown, tiles, SAMPLE callout, overdue callout (link to `/workforce/handover` for its audience), items-by-year chart, the method (computed readiness, weights, risk, transfer rule, no protected inputs), NG-T-3.10 source, risk filter chips, table with readiness bars and risk pill + `<WhyThis>`, instructor drawer (SAT readers only), status editor for the training manager with a confirm dialog, `<BenchmarkChips feature="FS45" />`.
- EN + AR complete (`m24.lc.*`, `m24.ctb.*`, `m24.lz.*`, 4 route titles), logical RTL classes, numbers and dates through `useFormat()`.

## Routes (+4; route-count pins left to the integration lead: 288 -> 292)

`knowledge-lectures` `/knowledge/lectures` (knowledge R) · `knowledge-lecture` `/knowledge/lectures/:lectureId` (knowledge R) · `knowledge-contributions` `/knowledge/contributions` (knowledge A) · `knowledge-localisation` `/knowledge/localisation` (knowledge R). The M24 route-list test `tests/unit/w3e2-knowledge.test.ts` was updated (it lists M24's own routes).

## Tables and RPCs

- Tables (M24, write mode rpc): `kafaa_lectures`, `kafaa_contributions`, `kafaa_localisation_items` (check `kafaa_localisation_items_target_ck`: target <= 2030-12-31 and >= baseline; `kafaa_contributions_level_ck`: level 1-3).
- RPCs (authenticated only): `kafaa_save_lecture(jsonb)`, `kafaa_publish_lecture(text)`, `kafaa_withdraw_lecture(text, text)`, `kafaa_sync_contributions()`, `kafaa_contribution_queue()`, `kafaa_validate_contribution(text, text, text)`, `kafaa_localisation_board()`, `kafaa_localisation_overdue()`, `kafaa_set_localisation_status(text, jsonb)`.
- Internal helpers (executable by no API role): `kafaa_lc_len/str/list/level/evidence_skills/resolve/text/problem/decide_problem/reason/reasons/source_published/view/open/validated`, `kafaa_lz_tracks/items/reason/readiness/risk/compute/status_problem`.
- Shared redefinition (same signatures): `kafaa_skill_states_v2`, `kafaa_skills_apply` (ref_table lists + `'lectures', 'knowledge_assets'`).
- RBAC choices (no new grant or resource): lectures `knowledge` R (staff) / A (KM owner, the training manager in the demo) per the card; contributions read Own only; localisation status = `kafaa_role_grant('training_manager', 'knowledge', 'W')` ("training_manager W"); auditors read the board (knowledge R) and the contribution queue (audit_log R); instructor names on the board only for `sat` R/W/A.

## Local md5s and digests (PGlite, all migrations + seed applied twice), for comparison after the live apply

Function bodies `md5(prosrc)`:

```
kafaa_contribution_queue        e4520e8cbf946eafa41707a43172f303
kafaa_lc_decide_problem         0b8393d591bc47730b13888604cfc3c9
kafaa_lc_evidence_skills        096f0a977be171a6e70e9defe6d24009
kafaa_lc_len                    86ef27c6edb0141aae7affe54e6f86e6
kafaa_lc_level                  472b7a392114f5c126098b6742ffb6f0
kafaa_lc_list                   9766aadd75734b15661bf7034b5f6d49
kafaa_lc_open                   84d23b4193817ed53a7943e393f3c15f
kafaa_lc_problem                3c9e965128df805bcd74a26839af0330
kafaa_lc_reason                 00b9e6feeadbbc1849b3e4135c0d6497
kafaa_lc_reasons                f9a1e3cfd6f942ed07ca8609a5107911
kafaa_lc_resolve                791001c411fd64525ac97d8cbeee60de
kafaa_lc_source_published       355eb18276878231b7ce9ee65089bf4e
kafaa_lc_str                    671a9c0faca4a8c80b25ed6b823844f6
kafaa_lc_text                   5199b6c03928ed47c7a653b61e0a90f4
kafaa_lc_validated              e0bdebb7111555d340e941f19061aca5
kafaa_lc_view                   69544b0516e6986596ef7b6cdfba09ce
kafaa_localisation_board        0be77ef57fafce698119893503f9aa54
kafaa_localisation_overdue      d7772cf26ffdd754370af770a7e30102
kafaa_lz_compute                e26087f4797ca858212f944706cba7fd
kafaa_lz_items                  57a33f3f3fcebb2b5318722fc5c48fca
kafaa_lz_readiness              8938268260120aa2fc74e48b126890e4
kafaa_lz_reason                 b07a93bb1ea68ec33a51e85487bda2fd
kafaa_lz_risk                   d61b15e5848cd60208221ac725dc3392
kafaa_lz_status_problem         304c6983ec386df0cf1741d411e0e38c
kafaa_lz_tracks                 7d6c6199baa9a9c963d53246e0ec7f86
kafaa_publish_lecture           00cc125c43ca4c8a3f2806b8e13d1d7e
kafaa_save_lecture              29d37b9c3fe10237f2e02f9d2375e63a
kafaa_set_localisation_status   5a3df32ed14bc569af420500d104a3ee
kafaa_sync_contributions        614f9715326856bf7c282cf123268392
kafaa_validate_contribution     541f8034ab50748c35fbc0f75ae64367
kafaa_withdraw_lecture          2d80320ae8b8fcfd885939ec23d432f4
kafaa_skill_states_v2           3c0f5098711b19c99e981a4585e7bd94   (before FS53, i.e. the FS45 body: 074343638b13efe855f6f129473c1759)
kafaa_skills_apply              6cdf46671b05c55fbd478a5e5197f052   (before FS53, i.e. the FS45 body: 55089400ce5b10d8c96481fdcc9c634f)
```

Table digests (`count`, `left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`):

```
kafaa_lectures                          17   1b81e757
kafaa_contributions                     27   624c2f79
kafaa_localisation_items                16   8ba74667
kafaa_skill_evidence where id like 'se:contrib:%'                                        8    31ed70c9
kafaa_person_skills of the 6 contributors (w-mnt-01, w-ss-01, w-qa-01, w-chem-01, w-mnt-02, p-sme-reviewer)   160  92c87f54
```

Suggested live parts (integration lead, additive, no DROP/DELETE): `kafaa_fs53_lectures_localisation_p1` tables + constraints + RLS + grants; `_p2` the shared redefinition (compare the live bodies with the "before" md5s first; better: apply the unioned fs5qa redefinition instead); `_p3` FS44 helpers + RPCs; `_p4` FS45 helpers + RPCs + grants. Seed: insert the `lectures`, `contributions`, `localisation_items` rows, the 8 `se:contrib:*` evidence rows and the 8 new `person_skills` rows (`ps:<contributor>:<sk-fs-*>`) from `supabase/seed.sql` with `on conflict (id) do nothing`; no other seeded state changes (F36 digests, F23 snapshots and F35 outlooks were recomputed and are unchanged).

## Tests (run one file at a time, `TMPDIR=/dev/shm npx vitest run --maxWorkers=1 --minWorkers=1`)

- New: `tests/unit/fs53-lectures-localisation.test.ts` 16/16, `tests/unit/fs53-pages.test.tsx` 8/8.
- Directly affected, green: `fs11-catalogue` 13/13, `w0-skills` 14/14, `fs12-decay` 22/22, `m14-rbac` 291/291, `w3e2-knowledge` 24/24 (route list updated), `w3e2-pages` 12/12, `fs45-ai-register` 21/21, `w5e5-digest` 20/20, `w4e5-instructors` 22/22.
- `fsqa1-integration` 17/18: the only failure is the route-count pin (`expected 292 to be 288`), left to the integration lead as instructed. The other pin files (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa2/3/4-integration`, `tests/e2e/sweep.spec.ts`) will show the same 288 -> 292 difference.

## Gates

All run from `kafaa/` on the final tree:

- `npm run gen`: pass; regeneration is deterministic (a second run leaves `seed.json`, `seed.sql`, `types.gen.ts` and the generated schema byte-identical); build-seed 33,607 rows, 292 tables, 57 personas.
- `npm run check:i18n`: pass (40 namespaces, EN/AR in parity).
- `npm run typecheck`: pass.
- Unit tests: pass for the new files and every directly affected file (list above); the only red test is the route-count pin in `fsqa1-integration` (288 -> 292), which is the integration lead's.
- `npm run migrations:validate`: pass (69 migrations + seed applied twice; "All migration checks passed"; 1,785 checks incl. the 44 FS53 checks).
- `npm run check:public`: pass (71 public tables; my three tables are not public).
- `npx vite build`: pass (chunk-size warnings only, as before).
- Playwright: not run (not the integration lead).

## Gaps and notes

- Lecture recordings are metadata only (REC- codes); there is no media player by design (synthetic, no real recordings).
- Every non-security staff member holds a KLRA position in the seed, so "where one exists" is shown by one lecture from a speaker without a position (`lec-017`); security and cyber people have no KLRA positions and cannot be lecture subjects anyway.
- Seeded validated contributions evidence FS02 future skills only (the builder fails otherwise) so the original 71-skill states stay unchanged; validations made in the demo can evidence any non-security skill.
- `contributionQueue` returns the lectures awaiting publication too (reviewers cannot read unpublished lectures through the table).
- The readiness weights and risk thresholds are SAMPLE demo rules, stated on the page.

## Hand-offs for the integration lead

1. **FS45 -> F22 (M07):** add `<LocalisationOverduePanel />` (import from `src/modules/m24/links.tsx`) to `src/modules/m07/HandoverPage.tsx` and a unit test (render as `chco`; expect `loc-loit-watch` and `loc-rp-initial`). The panel reads `localisationOverdue()` and renders nothing when nothing is overdue.
2. **Recorded-evidence union (3.9):** my branch adds `'lectures', 'knowledge_assets'` to `RECORDED_REF_TABLES`, the f01 literal, the four "no derived future-skill state" invariants, the fs12/w0 literals, and to the SQL lists in my redefinition of `kafaa_skill_states_v2` / `kafaa_skills_apply`. Union with FS39 `plant_visits` and FS40 `twin_attempts` and write the single final redefinition in `20261010259001_kafaa_fs5qa_integration.sql`.
3. **Route-count pins** 288 -> 292 for my four routes (plus the other wave-E routes).
4. **FS72 (wave H):** validated contributions are available as `kafaa_lc_validated(p_person)` (internal SQL helper) and `validatedContributions()` (TS).
5. Done on this branch (M24): `/knowledge` links the lecture library and the localisation countdown; `/knowledge/review` links `/knowledge/contributions` for the KM owner. Not yet done: links from M02 `/training/instructors` to the countdown (M02 is not mine).
