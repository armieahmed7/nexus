# fsDe2 DONE: FS29 Recognition of prior learning + FS30 NQF levels and learning credits (module M34)

Branch `fsDe2` in worktree `/workspace/kafaa-fsDe2`. Migration `supabase/migrations/20261010242001_kafaa_fs42_rpl_credits.sql`.
Applied live to Supabase `hlirqxoddysxtdezwcgv` (additive kafaa_* only) in five parts:
`kafaa_fs42_rpl_credits_p1_tables`, `_p2_rpl_helpers`, `_p3_credit_rules`, `_p4_submit_attest`, `_p5_decide_export_tag_sync_grants`.

## Acceptance tick list
FS29 Recognition of prior learning
- [x] Request flow: choose a skill (level) or a micro-credential; the evidence pack is built from the person's own OJT logs (acknowledged), simulator debriefs, qualification mirror (qualified / not qualified only), engagements (gigs, rotations, contractor engagements) and supervisor attestations (the named supervisor confirms or declines in their own words).
- [x] Assessor maker-checker: recommend (full / partial / not-yet + level + notional hours + rationale EN/AR), then confirm or return by a different assessor; never the person. DB check constraint `kafaa_rpl_requests_mc_ck` enforces it too.
- [x] A decision needs two different people (refusal codes `forbidden`, `maker_checker`; message `self` for one's own request). Unit test + PGlite validator + page test.
- [x] No security-restricted item can be attached: refusal code `security_restricted`; such records are listed without detail ("Security-restricted record"); security/cyber skills cannot be targets. Unit test + validator; no seeded pack holds one.
- [x] Credit written as validated evidence (`skill_evidence` kind `credential`, basis `validated`, ref_table `rpl_requests`, id `se:rpl:<req>:<skill>`), skills recomputed (`applySkills` / `kafaa_skills_apply`), RPL statement stored EN/AR, credit ledger row, one NEXUS ledger row (`kafaa.rpl.decide`); every other call audited only.
- [x] NQC-ready export (`kafaa-rpl-pack/1`): initials only, roles not names, indicative level and credits, statement, frameworks, notice; FANR wording masked (acronym, full name, parentheticals, Arabic) with `maskFanr` = `kafaa_rpl_mask` (parity checked); `packIsClean` on every seeded pack.
- [x] Every screen says Kafa'a is not a licensing or regulatory authority (`NotAuthority` on all 7 pages; page tests).
- [x] RBAC: recognition Own (request), A for assessors (recommend/confirm/return, open on behalf of contractors), R for auditors (read, export); contractors read their own request via own_profile.
FS30 NQF levels and learning credits
- [x] Courses, published pathways and current micro-credentials tagged with indicative NQF level + credits (1 credit = 10 notional hours); 173 seeded tags; tag editor for frameworks W/A (versioned, retire = reverse ledger rows, never delete).
- [x] Every published micro-credential has a level and credit tag marked indicative (unit test; DB check `kafaa_credit_tags_indicative_ck` forces `indicative`).
- [x] Ledger totals equal the sum of completed items: `creditsFor()` (TS) = `kafaa_cr_compute` (SQL), checked for every person in PGlite; after tag edits and syncs; live seed subset digest equal.
- [x] Every tag displays "indicative until agreed with the NQC and the partner" in EN and AR (`IndicativeNote` on the catalogue, my credits, tag admin, request decision; unit + page tests).
- [x] 30-credit stacks (4) toward an indicative award with a partner university "to be agreed (none named)", sourced (WAM / UAE NQF resolution); RPL counted up to each stack's cap; progress with WhyThis reasons and ENTITLE benchmark line.
- [x] Benchmark chips FS29 (ILO-RPL, UAE-NQF, UK-NUC) and FS30 (UAE-NQF, ENTITLE, UPKEEP) on every page.

## Routes (7, module M34)
`recognition` /recognition (public, tabs RPL / NQF) · `my-recognition` /my/recognition (Own) · `my-rpl` /my/recognition/rpl/:id · `my-credits` /my/credits (Own) · `rpl-queue` /recognition/review (recognition A/R) · `rpl-review` /recognition/review/:id · `admin-credit-tags` /admin/credit-tags (admin, training manager, instructor, auditor). Route-count pins left to the integration lead.

## Tables and RPCs
Tables (additive): `kafaa_rpl_requests`, `kafaa_rpl_evidence`, `kafaa_credit_tags`, `kafaa_credit_stacks`, `kafaa_credit_ledger` (RLS per-statement form; writes only through RPCs).
RPCs (TS + LocalBackend + SQL SECURITY DEFINER + supabase map; `authenticated` only): `submitRpl` (open/attach/detach/submit/withdraw), `attestRpl`, `decideRpl` (recommend/confirm/return), `exportRpl`, `rplEvidenceOptions`, `tagCredit`, `syncCredits`. 20 internal helpers revoked from API roles.

## Seed (scripts/seed/ext/fs29-rpl-credits.mjs, FINALIZE_LAST)
4 stacks, 173 credit tags, 15 RPL requests in every state (7 decided: full, partial, not-yet; recommended; submitted incl. one returned; draft with a pending attestation; withdrawn; contractor opened on behalf), 50 evidence items, 5 people credited on FS02 skills only (F01 digest unchanged), 324 ledger rows, 30 notifications. `ensureCreditTags(T)` exported for FS31 hand-off.

## Live verification
Function bodies: 27/27 md5(prosrc) equal to the migration file. Row digests equal for credit_tags (173), credit_stacks (4), rpl_requests (15), rpl_evidence (50), RPL skill_evidence (5), nt-rpl notifications (30). Ledger built live with `kafaa_cr_sync`: the 324 seed rows match the seed digest exactly; 10 more rows come from live-only completions (training records created on the live site), as the rule intends. `kafaa_skills_apply` re-run for the 5 credited people: states unchanged (validated, levels 3/2/1/2/1). anon executes none; RLS on all 5 tables.

## Tests
- `tests/unit/fs42-rpl-credits.test.ts` (11): one per acceptance criterion + rules, seed, routes, i18n.
- `tests/unit/fs42-pages.test.tsx` (10): all 7 pages, EN and AR, chips, notice, maker-checker states.
- `scripts/validate/fs42-rpl-credits.mjs` (PGlite): TS = SQL for options, statement, pack, mask, creditsFor; RLS; RPC flows; audit/ledger counts; grants; additive SQL.

## Gates
- npm run gen: OK (fs29/30 digests unchanged; build-seed 32632 rows / 277 tables)
- check:i18n: OK (40 namespaces in parity, m34 EN+AR)
- typecheck: 0 errors
- check:public: OK
- migrations:validate (full): rc=0, "All migration checks passed" (fs42 block ALL OK, incl. kafaa_rpl_mask = maskFanr parity)
- build (vite): OK. First attempt failed with ENOSPC (the shared container disk was 100% full, 44 MB free, not caused by this branch); re-run with outDir on /dev/shm succeeded (built in 1m 11s; only the existing chunk-size warning). The integration lead's build should be unaffected once disk space is available.
- Unit tests (focused, serial, because the shared memory cgroup OOM-killed full-suite runs): fs42-rpl-credits 11/11, fs42-pages 10/10, fs11-catalogue 13/13, w0-skills 14/14, fs12-decay 22/22, fs24-readiness 14/14, fs32-course-pack-academies 17/17, w5e1-microcred 18/18, fsqa1-integration 17/18, fs11-foundation 18/19. The 2 failures are route-count pins only (expected 266 vs pinned 259, +7 m34 routes), left to the integration lead as instructed.
- Full unit suite: not run end to end (shared-memory OOM); the integration lead should run it.

## Gaps / hand-offs
- FS31 (fsDe3) new micro-credentials need credit tags: call `ensureCreditTags(T)` in the wave QA seed and tag them live with `tagCredit` (or the same insert); the FS30 acceptance test fails until every current micro-credential is tagged.
- Contractors have no Kafa'a grant, so they cannot self-start RPL; an assessor opens on their behalf (by design, logged in CONTRACT).
- Partner university is deliberately unnamed; all levels/credits indicative.
