# fsEe4 DONE: FS46 future leadership behaviours + FS47 Future Leaders track + FS48 women in future nuclear skills (M22)

Branch `fsEe4`, worktree `/workspace/nexus-fsEe4`. Netlify not touched, live Supabase not touched, no Playwright run. Synthetic people only (seeded workforce rows and persona role cards); no regulatory or accreditation authority is claimed anywhere.

## Acceptance

### FS46 · Future leadership behaviours (`/leadership/behaviours`, `/leadership/360`, `/leadership/insights`)
- [x] **Old 360 results remain readable under v1.**
  - Additive column `form_version` (default 1) on `kafaa_leadership_360_requests` and `kafaa_leadership_360`: all 266 existing responses stay form 1 and are read on their eight behaviours. New cycles are stamped form 2 (twelve behaviours); a cycle already started keeps its form.
  - The F16 HR grade view reads form 1 only, so its cycle (2026-H1) and figures are unchanged.
  - Tests: `fs54-future-leadership` "acceptance: old 360 results remain readable under version 1"; `fs54-pages` "the 360: a form-2 cycle shows twelve behaviours, the older form-1 cycle stays readable with eight"; PGlite "acceptance (FS46): old 360 results stay readable under version 1 …" and the summary parity check over 42 subjects x 3 cycle choices.
- [x] **Aggregates under 10 suppressed.**
  - `rpc.leadershipProgrammeStats` = `computeProgrammeStats()` = `kafaa_fs54_programme_stats_compute`: form-2 averages by programme; a cell naming fewer than 10 subjects returns `subjects: null, scores: null`. Future Leaders shows (11), the other programmes are suppressed. HR, the training manager and auditors only (null for line managers and staff).
  - Tests: `fs54-future-leadership` "acceptance: programme aggregates naming fewer than 10 people are suppressed"; PGlite "acceptance (FS46): the form-2 programme view = computeProgrammeStats; cells under 10 subjects suppressed".
- [x] **Anchors at every rating point in EN and AR (unit-test matrix).**
  - `leadership_behaviours` (12 rows): anchors for points 1-5 in EN and AR, distinct per point; shown as a table on `/leadership/behaviours` and under the chosen point in the 360 sheet.
  - Tests: `fs54-future-leadership` "acceptance: anchors at every rating point in EN and AR (matrix of 12 behaviours x 5 points x 2 languages)" (120 cells, Arabic checked); PGlite "acceptance (FS46): 12 behaviours in form-2 order, each with anchors at all five points in EN and AR (0 gaps)".
- [x] **Card scope.** Four behaviours added with anchors and sources: leading digital change (GreenComp, WEF), AI-augmented teams incl. when to override a tool, intrapreneurship (EntreComp), inclusion. Programme content and coach cards (tips, a practice, a watch-for, links); coach cards ordered by `coachFocus()` with `<WhyThis>`; aggregate view by programme (suppressed). `BEHAVIOURS` stays in `m22/domain.ts` (`BEHAVIOUR_IDS_V2`, `formBehaviours`). Tests: "the four future behaviours exist …", "a new cycle uses form 2 …", "coach cards are ordered by coachFocus …", `fs54-pages` "the behaviour catalogue …".

### FS47 · Future Leaders track (`/leadership/future-leaders`, `/leadership/future-leaders/manage`)
- [x] **Each competency has descriptors and a learning route.** Five INMA-pattern competencies (safety-culture leadership, regulation and licensing, project and cost, stakeholders and international, knowledge and succession), descriptors at four levels in EN and AR, skill targets (FS02 skills checked at seed time), a learning route (module, academy programme, Kafa'a route, external). Tests: "acceptance: each competency has descriptors at four levels (EN and AR) and a learning route"; `fs54-pages` "the Future Leaders track: five competencies …".
- [x] **External programmes with sources and dates.** Seven rows (NEA NextGen Nuclear Leaders Summer School 2026, IAEA nuclear energy management school, INMA endorsed master's, CNNEMS, ENEN2plus, Nordic NNTP, KINGS) with https sources, as-of 2026-10-10 and published dates, from the research only; "listing does not mean endorsement". Tests: "acceptance: external programmes are listed with their sources (https, as-of date) and dates, from research only".
- [x] **Nomination and selection via RPCs with audit.** `rpc.nominateFutureLeader` (HR analyst or HR director only; never yourself; 10-500 character reason; one open nomination per person; cohort follows the cycle); selection is the F16 `rpc.decideNomination` (maker-checker, audit row, ledger row). Every call writes exactly one audit row. Tests: "acceptance: nomination and selection go through RPCs with audit rows …"; PGlite "acceptance (FS47): nomination goes through an RPC …", "acceptance (FS47): selection goes through the F16 decision RPC with an audit row and a ledger row …", "every FS46-FS48 call wrote exactly one audit row (55 calls)".
- [x] **Stats under 10 suppressed.** `rpc.futureLeadersStats` = `computeFlStats()` = `kafaa_fl_stats_compute` (nominations by status, per cohort participants, completions, modules done, project statuses; the 2025 pilot of 8 is suppressed, the 2026 cohort of 12 shows). Tests: "acceptance: track statistics under 10 are suppressed …"; PGlite "acceptance (FS47): track statistics = computeFlStats …".
- [x] **Card scope.** Cohort track with nomination, six modules (`recordFlModule`, training manager, running cohorts only), policy project (`savePolicyProject`, participant, screened like community posts; `reviewPolicyProject`, training manager or HR authority, never their own; acceptance with every module done completes the track with ledger `kafaa.leadership.future_leaders_complete`), readiness (`flReadiness`, own or nominees, reading others audited, explained with `<WhyThis>` via `flReasons`). Reuses `leadership_programmes` (new row `prog-future-leaders`, not offered in the F16 nominate dialog) and `leadership_nominations` and the F16 RPCs.

### FS48 · Women in future nuclear skills (`/communities/women-in-nuclear`, `/communities/women-in-nuclear/programme`)
- [x] **Gender never in ranking.** `rankCircles` / `rankOffers` take the participant's own choices, circles, flags and offers; no people rows. `tests/unit/w3e5-no-protected-inputs.test.ts` extended: runners for both (they are on the mentoring engine card), plus `coachFocus`, `flReadiness`, `flReasons`, `circleMembersView` held to the same static and trapped-row checks; "the people rows the network ranks carry a gender (so the trap is armed) …". Also `fs54-future-leadership` "acceptance: gender is never an input to a ranking (metamorphic check …)".
- [x] **Aggregates under 10 suppressed.** `rpc.wfnStats` = `wfnStats()` = `kafaa_wfn_stats_compute`: network counts (active participants only), requests by status, completion and progression rates, pipeline per programme (staff, academies, future gigs, Future Leaders, leadership academy) as women/men/share, suppressed whole if either group is under 10. HR and auditors and the training manager only; no person id in the payload. Tests: "acceptance: aggregates under 10 are suppressed …"; PGlite "acceptance (FS48): network statistics = wfnStats …".
- [x] **Opt-in withdrawable without trace in rankings.** `rpc.setWfnOptin({active:false})` blanks the choices, ends circle seats (circle flags recomputed), withdraws open requests; another participant's circle and offer rankings, the circle flags and the network statistics equal the state before the opt-in. Tests: "acceptance: opt-in is withdrawable without trace in rankings …"; PGlite "acceptance (FS48): withdrawal leaves no trace in any ranking …".
- [x] **RBAC: opt-in, HR Agg only.** `wfn_participants`, `wfn_circle_members`, `wfn_requests` readable by the person only (HR, training manager, admins, auditors read 0 rows; PGlite and unit). The training manager (programme owner) gets the request desk through `rpc.wfnDesk`; HR never does. Tests: "RBAC: opt-in data is readable by the person only …"; PGlite "acceptance (FS48): opt-in rows are readable by the person only …", "acceptance (FS48): HR gets aggregates only …".
- [x] **Card scope.** Mentor circles (seats, mentor role card, mentor seat), visiting placements (Lise Meitner pattern), sponsored study with a placement (MSCFP pattern), each strand with its pattern, a sourced fact and the source link; requests (three open at most, contact details refused), decisions in order with a ledger row on placement. Circle data lives in M22 (`wfn_circles`, `wfn_circle_members`), no M04 type needed.

Every feature page shows `<BenchmarkChips feature="FS46|FS47|FS48" />` (tested in `fs54-pages`). All new strings EN + AR (RTL logical classes, `useFormat` for numbers and dates).

## Routes (+5; route-count pins left to the integration lead)

| Route | Path | Guard | Nav |
|---|---|---|---|
| `leadership-behaviours` | `/leadership/behaviours` | staff (knowledge R) | my leadership 54 |
| `leadership-future-leaders` | `/leadership/future-leaders` | staff | my leadership 54.5 |
| `leadership-future-leaders-manage` | `/leadership/future-leaders/manage` | anyRole hr_analyst, hr_director, training_manager, auditor | (child) |
| `communities-women` | `/communities/women-in-nuclear` | staff | my knowledge 58 |
| `communities-women-programme` | `/communities/women-in-nuclear/programme` | anyRole hr_analyst, hr_director, training_manager, auditor (desk tab: training manager) | (child) |

## Data, RPCs, migration `20261010254001_kafaa_fs54_future_leadership.sql`

New tables (11): `kafaa_leadership_behaviours`, `kafaa_fl_competencies`, `kafaa_fl_external`, `kafaa_wfn_programmes` (public read); `kafaa_fl_cohorts`, `kafaa_wfn_circles`, `kafaa_wfn_offers` (staff); `kafaa_fl_participants` (participant, scope, training manager, HR authority, auditors); `kafaa_wfn_participants`, `kafaa_wfn_circle_members`, `kafaa_wfn_requests` (the person only). Additive columns: `form_version` on the two F16 360 tables. Writes by RPC only (insert/update revoked from anon and authenticated).

RPCs (13 new + 2 redefined, `authenticated` only, anon none): `kafaa_leadership_programme_stats`, `kafaa_nominate_future_leader`, `kafaa_fl_readiness`, `kafaa_record_fl_module`, `kafaa_save_policy_project`, `kafaa_review_policy_project`, `kafaa_future_leaders_stats`, `kafaa_set_wfn_optin`, `kafaa_join_wfn_circle`, `kafaa_request_wfn_offer`, `kafaa_decide_wfn_request`, `kafaa_wfn_desk`, `kafaa_wfn_stats`; redefined `kafaa_request_360`, `kafaa_submit_360`. Helpers revoked from public/anon/authenticated (incl. redefined `kafaa_lead_360_summary`, `kafaa_lead_stats_compute`). Engine card `mentoring` updated to version 2 under `where version = 1`. Ledger rows only on Future Leaders completion, placement (and the reused F16 selection).

### Local md5 of every new or redefined function body (`md5(prosrc)`, from the migration text)

```
kafaa_lead_form_ids(p_version integer) 7bc21fac14319ccf59f27432eb398661
kafaa_lead_scores_v(p jsonb, p_version integer) b0ea8ff68182660df4f8ad49be99c3fe
kafaa_lead_360_summary(p_subject text, p_cycle text) 6f185fa35007e7d7096af5f522c9bbce
kafaa_lead_stats_compute() 84636636dfd05df5f4e582de6e7f4698
kafaa_request_360(p_raters jsonb) 088fa61ca91abb979e88e30873b59ef0
kafaa_submit_360(p_request_id text, p_scores jsonb) fd17cb6aa992b0d103044ffb93a5b1f2
kafaa_fs54_stats_gate() a5e106639ce2190b227032d38a9f1910
kafaa_fs54_cell(p_cycle text, p_subjects text[], p_ids text[]) 1fb3feaf959608dcef7d4404ffc73f28
kafaa_fs54_programme_stats_compute() 84fea47539801e19f0dd1a3eead72ed6
kafaa_leadership_programme_stats() 3ecaace67acd07ee0285c17e333f8954
kafaa_fl_cohort_for(p_cycle text) f506a9e9609748cda15c86b1ccb40c4f
kafaa_fs54_ts() 243a2d8ac01c3b05afad10176ad2209a
kafaa_fs54_hist(p_status text, p_note text) 1dd2e46a51d50ad73421b18c620aebfd
kafaa_fs54_notify(p_id text, p_person text, p_kind text, p_en text, p_ar text, p_link text, p_sev text) 38c7d14dac419962f0afc72bec2f5118
kafaa_fl_readiness_of(p_person text) 387a851a122b24361dd40510a0879845
kafaa_fl_readiness(p_person_ids text[]) a390cc5f33c5000d37425aa6bdc7c5e8
kafaa_fl_stats_compute() c252fe84d19ef93a674585f89fb5802c
kafaa_future_leaders_stats() 238c49535c412cd408c790596e4b62c5
kafaa_nominate_future_leader(p_person_id text, p_reason text) 8c0e95905188de28dd446eb6bfc170bb
kafaa_fs54_participant(n kafaa_leadership_nominations) 7ca5664730c7fc44c89751181158ec02
kafaa_record_fl_module(p_nomination_id text, p_module_id text, p_done boolean) 994d89f98e4669976105cfe48b4e7bea
kafaa_save_policy_project(p jsonb) d91e81a26b68c4793a047ca52da47c80
kafaa_review_policy_project(p_nomination_id text, p_decision text, p_note text) 0d7b9c23704f15da7c0afbdbf95a0888
kafaa_fs54_circle_flags(p_circle text) 4df3c642f8dd23e556ce2a0cc6436635
kafaa_set_wfn_optin(p jsonb) fdac430dc4a864ca270e3d432095c469
kafaa_join_wfn_circle(p_circle_id text, p_join boolean) 7d374e32ce09e666719cae86a4c000ec
kafaa_request_wfn_offer(p_offer_id text, p_statement text) 92f3388ac3afce45ca63e4857f6637ae
kafaa_decide_wfn_request(p_id text, p_decision text, p_note text, p_outcome text) fadf7c5102f7469ce21d4e5d247227d4
kafaa_wfn_desk() e2a429fa9519dc46c944458ac221a27d
kafaa_fs54_gender_row(p_id text, p_people text[]) 26c87fd7cd92eda15d65683f652af97e
kafaa_wfn_stats_compute() c580901488bd4162362f61651a378b29
kafaa_wfn_stats() a3d419431ef255c9204cecb2aa641637
```

### Table digests (row count, md5 of the id-sorted canonical JSON rows from `src/seed/seed.json`; the PGlite validator checks the loaded rows equal seed.json)

```
leadership_behaviours 12 8f8d96a45172a061b67a9cc2c6d80551
fl_competencies 5 37c3dd91304731f75417929403c168ea
fl_external 7 a33f0e8e724d532057e3c789332b69a6
fl_cohorts 3 2bca147cb916fb711e28c0a088e8e928
fl_participants 20 1c9dd5ebbd63979bed656fd529b696a3
wfn_programmes 3 184b4e5f215aab55ed6bf0607fd3468a
wfn_participants 21 c5bb6727bafa472ed512e4598fdb45da
wfn_circles 6 0bbb27fca3d6b27ee5cbcff1eeaad4dd
wfn_circle_members 29 383eb44b312cf8d4496fbe6b94847a44
wfn_offers 6 4ac2e4ca411946a08d047f0885d8b0ed
wfn_requests 17 10bcd583c85a5869194742568156a62f
leadership_nominations[prog-future-leaders] 25 d58a60db23e0d162a9036d279ac4d9ac
leadership_programmes[prog-future-leaders] 1 a81dce84259eb76a8035064c5367769b
leadership_360_requests[form_version=2] 120 a3a1c784a4237119b2a74e70ab1b8c98
leadership_360[form_version=2] 105 d29846baee06b693ac2167dd2a8c8a92
engine_cards[mentoring] 1 572b563487ba88d40dbf4a3891e4bb05
```

## Tests

- `tests/unit/fs54-future-leadership.test.ts`: 20 tests, all pass (one named test per acceptance criterion above, plus rules, RBAC, seed, routes, i18n).
- `tests/unit/fs54-pages.test.tsx`: 11 tests, all pass (EN and AR renders, chips, both 360 form versions, HR and owner views).
- `scripts/validate/fs54-future-leadership.mjs` (PGlite): seed digests, SQL = TS parity, RLS per persona, live flows in a rolled-back transaction, one audit row per call, ledger rows, grants, additive SQL; all pass.
- Shared tests re-run: `w3e5-no-protected-inputs` (57 pass, extended), `w3e5-transparency` 23 pass, `w2e5-pages` 13 pass, `w2-integration` 6 pass, `w0-scaffold` 5 pass, `m14-rbac` 291 pass, `w3e3-handover` 21 pass; `w2e5-leadership` 31/32 and `fs11-foundation` 18/19 (route-count pins only, see hand-offs).

## Gates

- `npm run gen`: pass, no unexpected diff (only my seed outputs, `types.gen.ts`, the generated schema SQL and seed; 33,911 rows across 300 tables).
- `npm run check:i18n`: pass (40 namespaces in parity).
- `npm run typecheck`: pass.
- Unit tests (one file at a time): `fs54-future-leadership` 20/20, `fs54-pages` 11/11, shared files as listed above; the only failures are the two route-count pins left to the integration lead.
- `npm run migrations:validate` (full, PGlite): pass, "All migration checks passed" (69 migrations + seed applied twice; 1,777 checks incl. `fs54-future-leadership.mjs`, `w2e5-leadership.mjs`, `w3e5-transparency.mjs`).
- `npm run check:public`: pass (75 public tables).
- `npx vite build`: pass.

## Gaps

- No new engine card: M16 pins `CARD_IDS`, so FS48's rankers sit on the `mentoring` card (version 2); `coachFocus` / `flReadiness` are on no card but are held to the same no-protected-input tests.
- External programme dates are as published (some say "see the source for current dates"); nothing is invented.
- Not applied live (no live Supabase in this session).

## Hand-offs for the integration lead

1. Route-count pins: +5 routes (288 -> 293) in `fs11-foundation`, `w4-integration`, `w5-integration`, `fsqa1/2/3-integration`, `tests/e2e/sweep.spec.ts`; M22 route pin in `tests/unit/w2e5-leadership.test.ts` (10 -> 15).
2. Optional: a dedicated `leadership` engine card (needs the M16 `CARD_IDS` pin) for `coachFocus` and `flReadiness`.
3. An M04 `circle` mentoring type is not needed: circles are M22 rows.
4. Live apply: additive, idempotent migration; seed rows with `on conflict (id) do nothing`; existing live 360 rows get `form_version` 1 from the column default. Run the PGlite validator first; the md5s and digests above are the local reference.
5. The reused F16 `kafaa_request_360` / `kafaa_decide_nomination` keep F16's notification audit rows; the FS46-FS48 RPCs write exactly one audit row per call.
