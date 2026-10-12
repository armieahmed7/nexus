# fsIe1 DONE · FS78 Learning balance and protected study time + FS79 Verified import of external certificates (FS wave I · E1, M34)

Branch `fsIe1`, stacked on `fsH-integration-qa` (not merged anywhere; never pushed to `main` or `fsH-integration-qa`). Live Supabase was not available: nothing was applied live.

## Acceptance (cards FS78 + FS79) with the test that proves each

Unit tests in `kafaa/tests/unit/fs91-balance-external-certs.test.ts` (rules + local backend) and `kafaa/tests/unit/fs91-pages.test.tsx` (pages); SQL proof in the PGlite validator `kafaa/scripts/validate/fs91-balance-external-certs.mjs` (27 checks).

FS78 · Learning balance and protected study time

- [x] **The balance equals grants minus approved use.** Test "FS78 acceptance: the balance equals grants minus approved use (TS rule = stored balance = rpc.learningBalance), before and after an approval". PGlite "acceptance (FS78): the balance equals grants minus approved use (TS = SQL) for all 106 balances". DB check `kafaa_learning_balances_sum_ck`.
- [x] **Ungated items cannot be charged to the balance.** Test "FS78 acceptance: ungated items cannot be charged to the balance (draft, retired and non-catalogue items are refused)". PGlite "the outcome gate: kafaa_sb_gated = published + listed + catalogueCheck" and "acceptance (FS78): ungated items cannot be charged".
- [x] **Study-time decisions need a second person and write an audit row.** Test "FS78 acceptance: study-time decisions need a second person and write an audit row (maker-checker; approval also writes a ledger row)". PGlite "acceptance (FS78): study-time decisions need a second person", "every call wrote exactly one audit row (30 calls)". DB check `kafaa_study_time_requests_checker_ck`.
- [x] Grant rule (60 h base, a 40 h mid-career top-up from 8 years of service on 1 January, never from age, gender or nationality). Test "the grant: 60 hours for staff, a 40-hour mid-career top-up …". PGlite "kafaa_lb_grant = grantFor for 368 people x 4 years".
- [x] HR fallback, withdrawal, over-balance refusal. Test "the HR authority decides when the line manager cannot; the requester withdraws; over-balance requests are refused".
- [x] RBAC. Test "RBAC (FS78): own balance; the line manager in scope; HR reads all; RPL assessors and other staff read none; anonymous nothing". PGlite "RLS (FS78) …", "learningBalance: self, the line manager in scope and HR read it".
- [x] Seed covers every state. Test "the seed covers every request state, with both line-manager and HR decisions, inside every balance".
- [x] Pages: "my learning balance (k-ro): tiles with the top-up, why, the gated catalogue …", "asking for study time end to end …", "the line manager (sro) approves k-ro's waiting request …", "HR (chco): the published rule, a suppressed breakdown, and HR decisions …", "HR analysts read the HR page without decision buttons", "renders in Arabic (RTL wording, Arabic digits through useFormat)".

FS79 · Verified import of external certificates

- [x] **Unverified certificates never become evidence above "claimed".** Test "FS79 acceptance: unverified certificates never become evidence above \"claimed\" (seed, submit, reject, revoke)". PGlite "acceptance (FS79): no unverified … certificate has active evidence" and the revoke flow. DB check `kafaa_external_certs_tier_ck` (evidence and tier only when verified or revoked). Unverified certificates write no evidence at all.
- [x] **Verified imports map to skills only through reviewed crosswalk rows.** Test "FS79 acceptance: verified imports map to skills only through reviewed crosswalk rows (basis and level by tier)". PGlite "acceptance (FS79): kafaa_xc_map = certMapping on 93 crosswalk sets x 3 tiers; only reviewed crosswalk rows map" and the verify flow.
- [x] **The tier is visible wherever the credential appears.** Test "FS79 acceptance: the tier is visible wherever the credential appears (trustTier on every row and every RPC result; exported for M17)". Pages "my external certificates (k-ro): the tier legend, both certificates with their trust tier …" and the queue (`TrustTierBadge`, `data-testid="m34-tier"`).
- [x] Maker-checker and refusals. Test "maker-checker and refusals: the holder never verifies; staff cannot verify; https links only; security-area skills refused; duplicates refused". Page "maker-checker on the queue: the HR director opening their own certificate sees the refusal and no verify button". DB check `kafaa_external_certs_checker_ck`.
- [x] RBAC. Test "RBAC (FS79): holders read their own certificates; verifiers and auditors read all; other staff none". PGlite "RLS (FS79) …".
- [x] Pages: "adding a certificate: the live check, the mapping preview (reviewed rows only), the confirm dialog, \"claimed\"", "the verifier queue (training manager) verifies k-ro's waiting certificate through the dialog; evidence is written", "the public recognition page explains the balance and the trust tiers (FS78 and FS79 chips)".

Both features: "five routes with guards, EN and AR titles, the FS78/FS79 benchmarks, Arabic is Arabic". Every screen has loading, empty and error states (`Async`, `EmptyState`), EN and AR are complete, and the layout uses logical classes and `useFormat`. Benchmarks appear only through `<BenchmarkChips feature="FS78|FS79" />`, which reads the non-secondary `kafaa_benchmarks` entries. No figure is typed into the copy. The SIMULATED rule notice appears on every FS78 page.

## Routes (+5; 380 -> 385, pins left to the integration lead)

| id | path | guard | nav |
|---|---|---|---|
| `my-learning-balance` | `/my/learning-balance` | signed in, own | my / skills 18.95 |
| `team-study-time` | `/team/study-time` | `recognition` Scope | my / team 33.8 |
| `workforce-learning-balances` | `/workforce/learning-balances` | `workforce_strategy` R/W/A | my / workforce 68.6 |
| `my-external-certs` | `/my/recognition/certificates` | signed in, own (parent `my-recognition`) | my / skills 18.85 |
| `external-certs-queue` | `/recognition/certificates` | `recognition` A or R (parent `rpl-queue`) | admin 6.855 |

`/recognition` also gets a third public tab ("Learning balance and certificates", `BalanceCertsTab`). `/my/recognition` and `/my/credits` each get one link.

## Tables and RPCs

Migration `kafaa/supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql`. It is additive and idempotent, touches only `kafaa_*` objects, and contains no removal keyword.

- `kafaa_learning_balances` stores one row per staff member and year (`lb:<person>:<year>`). It holds base, top-up and granted hours, used, pending and remaining hours, plus name, entity and job-family snapshots. Read: own where `open_read`, or `workforce_strategy` R/W/A. Write: RPC only. Check `kafaa_learning_balances_sum_ck`.
- `kafaa_study_time_requests` covers 2 to 40 hours inside one year. Pattern is `release_days|shift_blocks|non_shift_week` and the item must be outcome-gated. Status is `requested|approved|declined|withdrawn`, with history. Read: the person, the named line manager, or `workforce_strategy`. Checks `_shape_ck` and `_checker_ck`.
- `kafaa_external_certs` holds issuer, issuer kind, accreditation and credential refs, an https link, 1 to 6 crosswalk rows with levels, and status `submitted|verified|rejected|withdrawn|revoked`. Tier and method are set only when verified or revoked. Read: the holder, or `recognition` A/R. Checks `_tier_ck` and `_checker_ck`.
- RPCs (SECURITY DEFINER; `authenticated` only; anon none):
  - `kafaa_request_study_time(jsonb)`
  - `kafaa_decide_study_time(jsonb)`: ledger `kafaa.study_time.approve`
  - `kafaa_learning_balance(text, integer)`
  - `kafaa_submit_external_cert(jsonb)`
  - `kafaa_verify_external_cert(jsonb)`: ledger `kafaa.xcert.verify` / `kafaa.xcert.revoke`
- Each RPC is mapped in `src/modules/m34/backend/supabase.ts` and mirrored in `backend/local.fs91.ts`.
- The 27 internal helpers (`kafaa_fs91_*`, `kafaa_lb_*`, `kafaa_sb_*`, `kafaa_xc_*`) can be executed by nobody.
- Shared writes:
  - F01 `kafaa_skill_evidence`: kind `credential` (an existing recorded kind), id `se:xc:<cert>:<skill>`, new `ref_table` `external_certs`. Rows are written only on verify. Revoke sets them inactive. After each write the existing `kafaa_skills_apply` runs; no shared function is redefined and no check constraint is widened.
  - M14 `kafaa_notifications`: kind `recognition`.

## Local md5 of every new function body (PGlite, `md5(prosrc)`, after all migrations + seed applied twice)

| function | md5 |
|---|---|
| kafaa_decide_study_time | 2df572f834db2c9cc343499672f6b6b6 |
| kafaa_fs91_hist | ce772d508adaa2e0ab38b1c6d6724960 |
| kafaa_fs91_is_date | 2ff36383ebaa2dc4b3d7404a35e33976 |
| kafaa_fs91_notify | dcb59b99768b1bc028428c30f262d0fb |
| kafaa_fs91_s | 6f86db886c02773b5b1e1fe5d8255971 |
| kafaa_fs91_trim | cc91988372f0fa663ff9325b2878670a |
| kafaa_lb_compute | 2a014ddbd4c3b9223b102ba3b3dcf7e9 |
| kafaa_lb_grant | 9a5eda5658b77a3b74b64011857ec21a |
| kafaa_lb_refresh | 93364772d4a5466381218e933848446a |
| kafaa_learning_balance | efe9a95277aefb09a67bc877aa44a959 |
| kafaa_request_study_time | a7720b3a0d3c7df281efe1ddee22f830 |
| kafaa_sb_cap | c45b5d522980f59dc441d2d2f467f261 |
| kafaa_sb_check_decide | 430270ebdec93ee6e4e776ed0d04c654 |
| kafaa_sb_check_request | a6d953d04282224544a62f823355f889 |
| kafaa_sb_gated | d7ae4467a1417ad18224d58ea0626ca6 |
| kafaa_sb_message | dd5c1cd4d54afdf1be3af78708689d18 |
| kafaa_sb_result_code | fbde28c4480e0bcd1c8d9d2960b385aa |
| kafaa_sb_visible | 6519eca0355459b17305bd750d430d5c |
| kafaa_submit_external_cert | ce3da34ce1461106f3a0331c0736543b |
| kafaa_verify_external_cert | 203eef04dc448be6361b3232c7ac59ed |
| kafaa_xc_basis | b68a8abc35604b568078238a5bf8a9a8 |
| kafaa_xc_cap | 00db0fe9bade6f75401748bb99d27d33 |
| kafaa_xc_check_submit | 5aa45a34c029575c939159f3ec7935cb |
| kafaa_xc_check_verify | 5dec9394bfa8e6ed95e1585cf440734b |
| kafaa_xc_issuer_tier | d497fc46a6117d01f48f210f3546bf64 |
| kafaa_xc_len | b192b948bc606f1bce52cd9a9262567f |
| kafaa_xc_map | 7558764416f00b4e94263f4341c11c0d |
| kafaa_xc_message | 7d075a2977926d0f9c817c1051d992ae |
| kafaa_xc_note_message | d176ad6165cb6cf8db8214089212404e |
| kafaa_xc_optlen | 32d398f74193b931e86564d72ed1750a |
| kafaa_xc_result_code | c0dc8a8700ec50e752e2998a67e7519b |
| kafaa_xc_trust_tier | 8d0450f450646fc806f104274274ef88 |

## Table digests (`count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`, PGlite over the generated seed)

| table | rows | digest |
|---|---|---|
| kafaa_learning_balances | 106 | e2534cef |
| kafaa_study_time_requests | 23 | e2bf3a58 |
| kafaa_external_certs | 13 | 77fda4eb |
| kafaa_skill_evidence where ref_table = 'external_certs' | 9 | 7e982fcd |

**Seed:** `kafaa/scripts/seed/ext/fs78-learning-balance.mjs` (FINALIZE_LAST, after f01; synthetic people only).

- **Learning balances:** 106 for 2026, 66 of them with the top-up.
- **Study-time requests:** 23 in all: 14 approved, 7 waiting, 1 declined and 1 withdrawn. One was decided by the HR director.
- **Certificates:** 13 in all: 6 verified, 1 revoked, 1 rejected, 1 withdrawn and 4 waiting. Links use `https://certificates.example.org/verify/<ref>`.
- **Evidence:** 9 rows (8 active) for 7 people.
- **Notices:** 16.
- **Seed diff vs the base, table by table:** only my 3 tables changed, plus `notifications` +16, `skill_evidence` +9, and `person_skills` with 4 rows added and 4 changed. The 4 changed rows are the derived states of those 7 people. The builder fails if any other state changes.
- **Loading:** rows load with `insert ... on conflict (id) do nothing`.

## Tests and gates (run from `kafaa/`, one vitest process at a time, TMPDIR=/dev/shm/fsIe1)

@@GATES@@

## Decisions applied and logged (CONTRACT.md changelog entry "FS wave I · E1")

- **Top-up rule:** the mid-career top-up uses years of service (8 or more on 1 January). It never uses age, gender or nationality.
- **Who decides:** the line manager decides (`lineManagerOf`, FS27 pattern). The HR director decides when there is no line manager or the line manager is the requester. Nobody decides their own request.
- **Reads:**
  - recognition own and Scope.
  - HR reads through `workforce_strategy` R/W/A.
  - The always-false `open_read` keeps the wide `recognition` A/R read (RPL assessors) off balances and requests.
  - Name and entity snapshots are stored on the rows because HR cannot read `people`.
  - Groups under 10 are suppressed (`MIN_GROUP_SIZE`).
- **Contractors:** they hold no recognition grant, so they get no balance and are refused `not_eligible` (FS29 precedent).
- **Credit unit:** 1 credit = 10 hours (FS30). Only FS18-gated catalogue items can be charged.
- **Certificate evidence:** unverified certificates write no evidence. Each trust tier sets the basis and caps the level: ENEC-assessed gives evidenced L3, accredited gives validated L2, vendor or self-serve gives validated L1. Only reviewed FS08 crosswalk rows count (published + `reviewed_by` + `reviewed_on`). Security-area skills are refused.
- **Verification links:** they use `example.org`. No real issuer registry is claimed, and nothing claims regulatory authority.
- **No engine card:** nothing is ranked, so `RANKED_SURFACES` is unchanged. Decisions show `<WhyThis>` reasons instead.

## Gaps and hand-offs for the integration lead

1. **Route-count pins 380 -> 385** (+5 M34; ids above) in the pin files (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..8-integration`, `tests/e2e/sweep.spec.ts`). Those tests fail until updated. `tests/unit/fs42-rpl-credits.test.ts` already leaves the 5 ids out of its M34 pin of 7.
2. **Recorded-evidence invariant token:** `external_certs` was added after `skill_suggestions` in `tests/unit/fs11-catalogue.test.ts`, `tests/unit/fsqa1-integration.test.tsx`, `scripts/validate/fs11-foundation.mjs` and `scripts/validate/fsqa1-integration.mjs`. Take the union of tokens when merging wave I.
3. **Live-apply bundle part:** apply the migration, then load the seed rows of the 3 tables, then `kafaa_skill_evidence` (9) and `kafaa_notifications` (16). The expected md5s and digests are above. Because `on conflict do nothing` will not update the 4 changed `person_skills` rows for p-buyer, p-k-instructor, p-k-ro, p-nse, p-sro, w-ro-01 and w-sro-01, run the existing F01 recompute (`kafaa_skills_apply`) for those 7 people after the evidence load, as the RPC itself does.
4. **M17 wiring (not done, outside my folder):** show `trustTier()` / `<TrustTierBadge>` (exported from `src/modules/m34/extcerts.ts` / `fs91ui.tsx`) wherever M17 lists credentials.
5. **M19 hook not written:** a verified certificate whose `resource_id` matches an `external_completions` row could mark that completion verified.
6. **Expiry gap:** a verified certificate that later expires keeps its evidence. There is no expiry sweep; verify refuses `expired` certificates.
7. **Optional:** an FS75 digest nudge for waiting study-time decisions and waiting certificates.
