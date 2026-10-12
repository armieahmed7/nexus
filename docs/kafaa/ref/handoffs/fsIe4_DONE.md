# fsIe4 DONE · FS82 Rolling mobility micro-grants + FS83 UAE energy consortium trainee cohort (FS wave I · E4, M36)

Branch `fsIe4` (stacked on `fsH-integration-qa`), worktree `/workspace/nexus-fsIe4`. Live Supabase was not used and nothing was applied live.
CONTRACT changelog entry: "2026-10-12 · FS wave I · E4" in `kafaa/CONTRACT.md`. Partner organisations are synthetic and labelled. Budgets are SIMULATED. People are synthetic workers or role cards.

## Acceptance (cards FS82 and FS83) and the test that proves each

Unit tests are `tests/unit/fs94-grants-consortium.test.ts` (R) and `tests/unit/fs94-pages.test.tsx` (P). The PGlite validator is `scripts/validate/fs94-grants-consortium.mjs` (V). The clock is fixed at 2026-10-12 (`vi.useFakeTimers({ toFake: ['Date'] })`).

| Criterion | Proved by |
|---|---|
| FS82: rounds open and close on schedule | R › "the seeded rounds are contiguous bi-monthly windows: the 10th of an even month, decisions 14 days later, the next opens the day after"<br>R › "phases come from the dates only: on 10 Oct the round to 10 Oct is open, on 11 Oct it is closed and the round to 10 Dec is open"<br>R › "on a fixed clock: applying works in the open round, is refused once it closes (no_round), and HR scheduling reopens the cycle (audit + ledger)"<br>V › "acceptance (FS82): rounds open and close on schedule" (SQL = TS for 16 fixed days × 4 rounds) |
| FS82: decisions are audited | R › "decisions wait for the deadline and are made by the HR director only; every decision and refusal is audited, with a ledger row"<br>R › "the HR director never takes a round over its SIMULATED budget (refused "budget"), and never decides their own application"<br>V › "acceptance (FS82): decisions are audited (HR director only, after the deadline, never their own; audit + ledger + notice)"<br>P › "HR console (chco): … approving goes through decideGrant after a confirmation" |
| FS82: budgets are labelled SIMULATED | R › "every round and every award is SIMULATED (simulated flag, AED, demo labels), and the refusal texts say so"<br>P › "my micro-grants (nse): … SIMULATED label …"<br>P › "HR console (chco): the closed round with its SIMULATED budget meter …"<br>V › "seed (FS82): … budgets SIMULATED" |
| FS82: statistics under 10 are suppressed | R › "grantStats: every count is 0 or 10+ or suppressed; a rate needs 10 decided; money committed needs 10 awards; no person field"<br>P › "programme figures (nse): tiles and rounds with suppressed cells; no person named"<br>V › "acceptance (FS82): statistics under 10 are suppressed (SQL kafaa_gr_stats = TS grantStats on 4 days …)" |
| FS82: for early-career staff (up to 10 years) and students on placement | R › "eligibility: early-career staff (under 10 years), placement students through HR only; experienced staff and partners are refused"<br>R › "HR files for a placement student with a consent reference (on behalf) …"<br>V › "eligibility: SQL kafaa_gr_eligibility = TS eligibility for 368 people × 3 days" |
| FS82: light application; outputs (report, presentation) logged as evidence | R › "a light application: activity after the deadline, cost lines up to the round maximum, a current non-security skill, no contact details"<br>R › "an accepted output becomes validated evidence on the named skill (rating, ref grant_applications); a returned one does not; maker-checker"<br>P › "my micro-grants (qc-inspector): an approved grant with its output due offers "Log output""<br>V › "outputs: … evidence (rating, validated, ref_table grant_applications) is written only on acceptance" |
| FS82 RBAC: Own; HR A | R › "RLS: an applicant reads only their own applications; HR and auditors read all; partners and the public read none"<br>R › "the applicant withdraws a submitted application; nobody else can (not found)"<br>P › "HR console (auditor): read only, no decision buttons"<br>V › RLS, grants and "writes only through the RPCs" |
| FS83: each partner sees only its own trainees | R › "partner administrators and users read their own organisation's trainees and visits only; an ENEC trainee reads their own; HR reads all"<br>R › "a host sees the visits it hosts through rpc.consortiumHostVisits only: trainee code and visiting organisation, never a person or member id"<br>P › "cohort workspace (alnoor-gm): only Al Noor's trainees and visits; the host queue lists visits to Al Noor"<br>V › "acceptance (FS83): each partner sees only its own trainees" (RLS with alnoor-gm, alnoor-qaqc, gulfhydro-qa) |
| FS83: visits write evidence after host confirmation | R › "a logged visit writes no evidence; only the host confirms; the confirmation writes validated ojt evidence on the host site's focus skill"<br>R › "a host without Kafa'a access: the programme office confirms on its behalf with the host's reference; never the visitor or whoever logged it"<br>R › "evidence level 2 from the second confirmed visit to the same host with 12 hours or more; confirmRoute names who may confirm"<br>P › "cohort workspace (chco): every trainee; confirming for a host without Kafa'a access needs the host's reference"<br>V › "acceptance (FS83): visits write evidence after host confirmation" |
| FS83: partner organisations are synthetic and labelled as such | R › "the three new consortium organisations and every non-ENEC partner are synthetic, labelled in EN and AR, and not publicly listed"<br>P › "public consortium page (anonymous): synthetic partners labelled, SIMULATED budget, secondary source flagged, no figures, FS83 chips"<br>V › "acceptance (FS83): partner organisations are synthetic and labelled as such" |
| FS83: shared modules, a project and a mentor (Nordic NNTP pattern), cross-site visit logging | R › "nominations: a partner nominates for its own organisation only (a code, no person); HR nominates eligible ENEC staff; the HR director decides" (the mentor comes from another organisation)<br>R › "cohort rules: phases from dates, trainee codes per partner, ENEC entities map to the ENEC partner, suppressed figures"<br>P › "my consortium place (k-lo-trainee): code, mentor from another employer, team, modules and my visits"<br>V › nominate, decide and log checks |
| FS83 RBAC: Partner OwnOrg; HR A | R › nominations test (`decideConsortiumMember` is for the HR director only; `k-hr-analyst` is refused)<br>V › "decideConsortiumMember: HR director only …" |
| Every page shows `<BenchmarkChips feature="FSnn" />` | P › chip assertions (FS82 `NUC-NET`; FS83 `NUC-NET`, `UAE-PEERS`)<br>R › "six new M36 routes with their guards; titles in EN and AR; FS82/FS83 benchmarks from the cards; no new grant" |
| EN + AR (RTL, logical classes, useFormat) | P › "renders the public consortium page in Arabic"<br>P › "renders my micro-grants in Arabic"<br>`npm run check:i18n` (parity) |
| No contact details in free text (FS39 pattern) | R › "the contact-detail pattern is the FS39 one, unchanged, in both rule files" |

## Routes (+6, 380 -> 386; the route-count pins are left to the integration lead)

| Route id | Path | Guard | Nav | Component |
|---|---|---|---|---|
| `my-grants` | `/my/grants` | ecosystem Own (staff) | my/growth 30.5 | `MyGrantsPage` |
| `ecosystem-grants` | `/ecosystem/grants` | anyRole auditor, or ecosystem Own/W/A | my/opportunities 40.5 | `GrantsProgrammePage` |
| `workforce-grants` | `/workforce/grants` | anyRole auditor, or workforce_strategy W/A | my/workforce 68.7 | `GrantsConsolePage` |
| `ecosystem-consortium` | `/ecosystem/consortium` | public | public/pathways 22 | `ConsortiumPage` |
| `ecosystem-consortium-cohort` | `/ecosystem/consortium/:id` | every ecosystem reader | — | `ConsortiumCohortPage` (smoke param `cc-2026`) |
| `my-consortium` | `/my/consortium` | ecosystem Own (staff) | my/growth 30.6 | `MyConsortiumPage` |

## Tables and RPCs

- **Tables (M36, `src/modules/m36/backend/schema.ts`):**
  - `kafaa_grant_rounds`: read `internal_content`; write through RPCs only.
  - `kafaa_grant_applications`: read own_profile Own and workforce_strategy; write through RPCs only.
  - `kafaa_consortium_cohorts`: read `talent_content` where listed, and workforce_strategy; write none.
  - `kafaa_consortium_members` and `kafaa_consortium_visits`: read own_profile Own, ecosystem OwnOrg on `org_id` behind the always-false `open_read`, and workforce_strategy; write through RPCs only.
  - Extra objects: unique index `kafaa_grant_applications_live_uq`; checks `kafaa_grant_rounds_dates_ck`, `kafaa_grant_applications_numbers_ck`, `kafaa_consortium_visits_numbers_ck` and `kafaa_consortium_cohorts_flags_ck`.
- **RPCs (authenticated only; anon and public revoked):**
  - `kafaa_schedule_grant_round`, `kafaa_apply_grant`, `kafaa_withdraw_grant`, `kafaa_decide_grant`, `kafaa_submit_grant_output`, `kafaa_review_grant_output`, `kafaa_grant_stats`
  - `kafaa_nominate_consortium_trainee`, `kafaa_decide_consortium_member`, `kafaa_log_consortium_visit`, `kafaa_confirm_consortium_visit`, `kafaa_withdraw_consortium_visit`, `kafaa_consortium_host_visits`, `kafaa_consortium_stats`
- **Internal helpers (no API role can execute them):**
  - `kafaa_gr_next_deadline`, `_slot`, `_phase`, `_schedule_problem`, `_full_years`, `_eligibility`, `_cost_total`, `_app_problem`, `_decision_problem`, `_output_problem`, `_cell`, `_rate`, `_stats`
  - `kafaa_cc_is_enec`, `_partner`, `_org`, `_phase`, `_code`, `_enec_eligible`, `_nom_problem`, `_decision_problem`, `_visit_problem`, `_level`, `_route`, `_stats`
- **Audit actions:** `grant.round.schedule`, `grant.apply`, `grant.withdraw`, `grant.decide`, `grant.output.submit`, `grant.output.review`, `grant.stats`, `consortium.nominate`, `consortium.member.decide`, `consortium.visit.log`, `consortium.visit.decide`, `consortium.visit.withdraw`, `consortium.host_visits`, `consortium.stats`.
- **Ledger actions:** `kafaa.grant.round`, `kafaa.grant.decide`, `kafaa.grant.output_accept`, `kafaa.consortium.member`, `kafaa.consortium.visit_confirm`.
- **Shared writes (3.9, logged in CONTRACT):**
  - Three synthetic organisations, as additive seed rows: `org-cx-grid`, `org-cx-solar`, `org-cx-h2`.
  - M14 notifications of kinds `grant` and `consortium`, written from the RPCs only.
  - F01 evidence: kind `rating` with `ref_table grant_applications`, and kind `ojt` with `ref_table consortium_visits`. Both are recorded kinds, basis validated, level 2 or lower, ENEC staff only. No shared function was redefined, and no evidence was seeded.
  - The four invariant lists carry `'grant_applications', 'consortium_visits'`.
  - `tests/unit/fs73-regional-pledges.test.ts` now checks only its own FS64/FS65 routes.

## Local md5 of every new function body (PGlite `md5(prosrc)` after all migrations and the seed)

| function | md5 |
|---|---|
| kafaa_apply_grant | 51f16467c863bc90ab00fe13098297ae |
| kafaa_cc_code | 96f3392b0670e3295d9861dd97600496 |
| kafaa_cc_decision_problem | fb5c436b3ea2a88c8f6e8070c26f2b3b |
| kafaa_cc_enec_eligible | a28a370029d2c5aa2e02d666bd1378cc |
| kafaa_cc_is_enec | 6a282f90665f16c450eeaf515b83ae9a |
| kafaa_cc_level | b972a2c3767a610725dff5cba3911480 |
| kafaa_cc_nom_problem | 7f101f74dc8eee30849f4865b92f4b60 |
| kafaa_cc_org | 2c5d0a84912e495b2456e3009c4d5928 |
| kafaa_cc_partner | da6e26efae33a94751262a48be102c44 |
| kafaa_cc_phase | 555f7bc522b8cb9b8af6e2047e7faa0c |
| kafaa_cc_route | 338a178664cacea1b3cb5c7ea975f9cd |
| kafaa_cc_stats | 0f22fb36ffd582808d885d46457df166 |
| kafaa_cc_visit_problem | d2cfe8864a4baf09aa144e4c46ec21f6 |
| kafaa_confirm_consortium_visit | 0f0c72fbe36a815c090087aa9364cdb0 |
| kafaa_consortium_host_visits | 315a8b93199f4c5c000d3f8abe57949c |
| kafaa_consortium_stats | 093bc196f32c44168aa49f6520a8b3b3 |
| kafaa_decide_consortium_member | 08a65b88bf75fa3d58d92a17e0717503 |
| kafaa_decide_grant | b318945128b6fc11d68231a911831e58 |
| kafaa_gr_app_problem | dcb8d8e43b8666d62d23b7ca1dd06ce9 |
| kafaa_gr_cell | 33b4a31b4f5a221fe772a4c0a1e85bd9 |
| kafaa_gr_cost_total | 9a5c6af947d9d711290f8ee6ad3876a2 |
| kafaa_gr_decision_problem | a7b0419be13b1f9d953ed3e2fbcf25b3 |
| kafaa_gr_eligibility | bbf1138a0f17d2f9f4b506511b93b418 |
| kafaa_gr_full_years | 8b71e32746fa2b2a276c41f9c5df394c |
| kafaa_gr_next_deadline | 9d2a6505e0f1c516bde966fcc41b09a2 |
| kafaa_gr_output_problem | 95ff48a896a029f00a526045127f71e6 |
| kafaa_gr_phase | a7dd5920eddc4a38246358d9271201b5 |
| kafaa_gr_rate | d446f9549eb917c25cf9e2d3cfd2c03a |
| kafaa_gr_schedule_problem | 90296af1e4ec733cce7d8e2d2f7e4795 |
| kafaa_gr_slot | ad022ddbd41e359827cad4914d4921c9 |
| kafaa_gr_stats | d33686fd9eb05795dfca2bbdc22c34fe |
| kafaa_grant_stats | 1b8c638597d063e22abd2b166a19f3ca |
| kafaa_log_consortium_visit | 624275d599fa54a2e16a6e6495ecc121 |
| kafaa_nominate_consortium_trainee | 2410af60ad70c1918233ffdc4c1bad74 |
| kafaa_review_grant_output | 29354d3474f63614bd8cb698dab9ae1a |
| kafaa_schedule_grant_round | c8c8c61e62c8ce2d5c89201d48020828 |
| kafaa_submit_grant_output | 69c047bd59eb977b824049d274631cdd |
| kafaa_withdraw_consortium_visit | 56f45c56cf1924a58f616ffcb47ee759 |
| kafaa_withdraw_grant | 75a116a265fe127b0e08216a80d6498a |

No shared or NEXUS function was redefined.

## Table digests (`count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`, PGlite over the generated seed)

| table | rows | digest |
|---|---|---|
| kafaa_grant_rounds | 4 | ca868735 |
| kafaa_grant_applications | 45 | 6e1517e7 |
| kafaa_consortium_cohorts | 2 | de4b44e1 |
| kafaa_consortium_members | 30 | c1a3a1de |
| kafaa_consortium_visits | 45 | 8b621465 |
| kafaa_organisations (the 3 new synthetic partners only) | 3 | 84b1a27f |

## Seed (`scripts/seed/ext/fs82-grants-consortium.mjs`, FINALIZE_LAST; every row passes the RPC rules, and the builder fails on any breach)

- **Rounds (4):** to 10 Jun, 10 Aug, 10 Oct and 10 Dec 2026. The 10 Oct round is closed with 14 applications waiting, which is the HR director's demo. The 10 Dec round has been open since 11 Oct. Scheduling the round to 10 Feb 2027 is the HR analyst's demo.
- **Applications (45):** decided rounds with approvals, declines and withdrawals. Outputs are submitted, returned, overdue and due. Two placement students were filed on their behalf with consent references, and their outputs were accepted by `p-chco`.
- **Persona states:**
  - `nse`: output submitted.
  - `qc-inspector`: approved, output due.
  - `buyer` and `k-ro`: waiting.
  - `outage-planner`: approved, plus a submitted application in the open round.
- **Cohorts (2):**
  - `cc-2026`: running from 2026-09-01 to 2027-06-30.
  - `cc-2027`: nominations open until 2026-12-15.
  - Both use the FS20 academy `ac-energy` and have 6 partners: ENEC, 3 new synthetic employers without Kafa'a access, Al Noor and Gulf Hydro-Valve. Each has 6 modules hosted in turn, 7 mentor role cards, a SIMULATED budget, and sources (Nordic NNTP, flagged secondary; EGA Academy).
- **Members (30):** six ENEC trainees in `cc-2026`, including `k-lo-trainee`. Partner trainees carry codes only.
- **Visits (45):** confirmed by the host, by the ENEC programme office, and on behalf (with the host reference). Also waiting, declined, withdrawn and one at level 2.
- **No F01 evidence is seeded.** Digests, the FS70/FS72 inputs and wallets are unchanged.

## Gates (run from `kafaa/`)

- `npm run gen`: no diff. Generated files were identical before and after (md5); 37419 rows across 361 tables.
- `npm run check:i18n`: 40 namespaces, en/ar in parity.
- `npm run typecheck`: clean.
- Unit tests, one file at a time (`TMPDIR=/dev/shm/... npx vitest run --maxWorkers=1 --minWorkers=1 <file>`):
  - `fs94-grants-consortium.test.ts`: 23/23 (re-run on the committed tree).
  - `fs94-pages.test.tsx`: 11/11.
  - `fs73-regional-pledges.test.ts`: 23/23.
  - `fs11-catalogue.test.ts`: 13/13.
  - `fsqa1-integration.test.tsx`: 17/18. The one failure is the route-count pin (`expected 386 to be 380`, "212 routes, and the 6 wave-A routes are registered"), the +6 M36 routes; the pin is left to the integration lead (hand-off 1).
- `scripts/validate/fs94-grants-consortium.mjs`: all 32 checks passed.
- `npm run migrations:validate`: all migration checks passed (including fs94-grants-consortium.mjs).
- `npm run check:public`: 77 public tables, no personal columns, no emails or phone numbers.
- `npx vite build`: built. The chunk-size warning was already there before this branch.
- Playwright and browsers were not run, as instructed.

## Gaps and decisions

- **Local-only flows:** flows for Kafa'a-only personas (`k-lo-trainee`, `k-hr-analyst`) are tested on the local backend and in PGlite with test profiles (uid `…94NN`). The local ledger mirror writes no row for them; SQL `kafaa_ledger` does.
- **Hosts and partners without Kafa'a access:** the synthetic grid, solar and hydrogen employers are handled by the programme office on their behalf. Confirmation needs the host's written reference and nomination happens on the partner's behalf. This follows the FS69 on-behalf precedent.
- **Mentors and partner trainees:** mentors are role cards (no person ids), and partner trainees have no person record.
- **No engine card:** nothing is ranked, so `RANKED_SURFACES` is unchanged.
- **No widening:** no new grant, no policy change, no check constraint widened.
- **HR and the people table:** HR cannot read `people`, so applications and members carry `initials` (plus `job_role_id`, `years`, `basis` on applications) for the console.
- **Arabic partner labels:** the earlier FS68 organisations (Al Noor, Gulf Hydro-Valve) keep their Arabic "(اصطناعية)" label. The three new ones use "(افتراضي)".

## Hand-offs for the integration lead

1. Move the route-count pins from 380 to 386 (+6 M36 routes) in `fs11-foundation`, `fsqa1`, `fsqa2`, `fsqa3`, `fsqa4` and `fsqa5`.
2. PassportView (M17) could label evidence with `ref_table` `grant_applications` or `consortium_visits`, using `m36.gr.evidenceLabel` and `m36.cc.evidenceLabel` (keys present EN and AR).
3. The FS20 academy page (`ac-energy`) could link to `/ecosystem/consortium`.
4. Live apply: `supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql` together with the generated schema/RLS and seed. It is additive and idempotent, and touches only `kafaa_*` objects.
