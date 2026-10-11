# fsDe1 · FS wave D · E1 — FS27 future-skills gig channel + time envelope, FS28 future-role rotations + external secondments (M20)

Branch `fsDe1` in `/workspace/kafaa-fsDe1` (not pushed). Live: Supabase `hlirqxoddysxtdezwcgv` (additive kafaa_* only, verified).

## Acceptance (PLAN.md)

FS27
- [x] At least 12 open future gigs across the 5 channels: 15 seeded (3 each: advance_study, digital_innovation, ai_pilot, data_cleanup, knowledge_capture). Posting a channelled gig requires a known channel and at least one non-obsolete FS02 future skill gained (TS `channelProblem` = SQL `kafaa_fs27_channel_problem`). Test: `fs41-future-gigs` "AC1", validator.
- [x] An approved envelope lets applications skip per-gig release while within the limit: `envelopeFit` (approved, not expired, channel in envelope, dates overlap, used + hours <= cap, poster is not the approver) → application inserted `released` by the envelope approver with `envelope_id`; over the limit / no envelope / poster-is-approver falls back to F08 release. Envelope asked once per quarter (5/10/15/20 % of 40 h), approved once by the line manager of record (maker-checker, ledger `kafaa.envelope.approve`), decline needs a reason, withdraw by the person. Tests "AC2" x2, validator flows (345 fit pairs SQL = TS).
- [x] Completion writes evidence (existing F08 path): select + complete through the unchanged `kafaa_complete_opportunity` / local `completeOpportunity` writes ojt evidence against the posted skills. Test "AC3", validator flow.

FS28
- [x] At least 3 future-role templates are published: `rt-fs-digital-twin`, `rt-fs-data-office`, `rt-fs-advance-study` (career-level only, clean public text), plus draft `rt-fs-energy-transition`. Owners tag templates via `tagFutureRotation`. Test "AC1".
- [x] Closing a secondment creates the knowledge-capture task: `closeSecondment(return)` inserts M24 `capture_sessions` row `cs-sec-<id>` (critical_decisions, interviewer = line manager, planned within the 60-day transfer window), ledger `kafaa.secondment.return`; transfer state none/due/overdue/done shown on the pages. Test "AC2", page test (desk close flow), validator.
- [x] No security-area placements are offered: security/cyber/safeguards persons, roles or security-area objective skills refused `restricted_kind` and audited (plan and tag); the desk people list excludes those families. Test "AC3", validator.

RBAC: opportunities R/Own/W as before; envelope approval by the line manager in scope; `time_envelopes`/`secondments` RPC-write only, read by the person, their line manager, auditors; HR (`kafaa_res_hr_role`) plans/closes secondments; desk HR + auditor; HR stats suppressed below 10.

## Routes (+6, 259 -> 265; pins left to the integration lead)
- `/opportunities/future` (opportunities-future, R) FutureGigsPage: ranked gigs with WhyThis, channel filter, my envelope meter, HR stats (BarChart + measured baseline), FS27 BenchmarkChips, sources
- `/opportunities/envelope` (opportunities-envelope, Own) EnvelopePage: request (ConfirmDialog), history, withdraw
- `/opportunities/envelopes` (opportunities-envelopes, A) TeamEnvelopesPage: approve / decline (reason), team usage
- `/opportunities/rotations/future` (rotations-future, R) FutureRotationsPage: template cards, tag card for owners
- `/opportunities/secondments` (secondments, R) SecondmentsPage: overview, mine, my team, transfer obligation
- `/opportunities/secondments/hr` (secondments-desk, hr_analyst/hr_director/auditor) SecondmentDeskPage: desk, plan modal, close modal
- Edited: MarketplacePage (links, channel chip), OpportunityPage (channel chip, envelope-fit note on the apply card), PostOpportunityPage (channel select + rule), RotationsPage (link). Full EN + AR (359 keys each, RTL).

## Tables / RPCs (migration `supabase/migrations/20261010241001_kafaa_fs41_future_gigs_secondments.sql`)
- Columns: `opportunities.channel`, `opportunity_applications.envelope_id`, `rotation_templates.{future_track, future_role_ids, career_level_only}`
- Tables: `kafaa_time_envelopes`, `kafaa_secondments` (RLS, RPC writes only)
- RPCs (TS + local + SQL SECURITY DEFINER + supabase map): requestEnvelope, approveEnvelope, futureGigStats, tagFutureRotation, planSecondment, closeSecondment, secondmentDesk, secondmentOverview; F08 `kafaa_post_opportunity` / `kafaa_apply_opportunity` redefined (same signatures)
- Shared write: M24 `capture_sessions` through `kafaa_close_secondment` (logged in CONTRACT.md changelog)
- Live: applied as `kafaa_fs41_p1..p5`; seed rows inserted on conflict do nothing; 27 function md5 + 6 row digests equal PGlite; grants verified.

## Tests / gates
- `tests/unit/fs41-future-gigs.test.ts` 17/17 (one+ test per acceptance criterion, rules, RBAC, routes, i18n)
- `tests/unit/fs41-pages.test.tsx` 7/7 (hub EN/AR + filter, envelope request, line-manager approve, templates, my secondments, desk close)
- `scripts/validate/fs41-future-gigs.mjs` 43 checks (flows inside a rolled-back transaction)
- gen, check:i18n, typecheck, check:public, vite build: pass. migrations:validate: all validators pass (full run 0 failures through w5e4 before it hit the 1500 s timeout under load; w5e4, w5e5 and fs41 re-run and pass; `w5qa-integration` fails only when run alone, same on the base commit)
- Related suites re-run (serially): w2e4-rotations 20/20, w3e2-knowledge 24/24, w3e5-no-protected-inputs 48/48 pass. w1e4-opportunities failed only on the F08 count pins (25 opps, 24 cards); fixed to count non-channel opportunities (+15 gigs) but NOT re-run: the container disk filled up (ENOSPC, about 40 MB free, mostly orphaned vitest temp dirs in /tmp from OOM-killed runs). Also not run for the same reason (OOM 137 or ENOSPC): fs31-pathways, w3e5-transparency, w5e5-digest/career, w4e4-lrs, fsqa3-integration and the page suites w1e4/w2e4/w3e2/fs31 (w1e4-pages and w2e4-pages failed with cascading 1 ms failures after a 35 s first-test timeout under memory pressure, not with assertions). Integration lead: re-run these on master.
- Commit: `71622d5` on branch `fsDe1` (not pushed).

## Gaps / hand-offs
- Route-count pins 259 -> 265 (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1-integration`, `fsqa2-integration`, `tests/e2e/sweep.spec.ts`) left to the integration lead.
- FS17 gap backlog: new open gigs fill practice steps, so a fresh seed has 188 backlog rows (145 open) vs 215 live; wave D QA should replay `refreshPathwayGaps` live (no DELETE was run).
- Seeded gigs are dated 2026-10-09 (after the 2026-10-08 demo digest date) so seeded digests and F24 snapshots stay unchanged.
- Playwright/E2E not run (per instructions).
