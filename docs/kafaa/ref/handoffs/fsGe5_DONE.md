# fsGe5 DONE: FS68 Supplier future-skills readiness + FS69 Contractor pre-arrival check with selective disclosure (M09)

Branch `fsGe5`, cut from `origin/fsF-integration-qa` (wave F, not on `main`) and stacked on it. Owned files only (plus generated outputs).
Live Supabase was not available: **nothing was applied live**. The migration is additive (`kafaa_*` only, no removal words) and idempotent.

## Acceptance (one named unit test per criterion; SQL path in the PGlite validator)

| Criterion | Unit test (`tests/unit/fs75-supplier-readiness.test.ts` unless noted) | PGlite check (`scripts/validate/fs75-supplier-readiness.mjs`) |
|---|---|---|
| FS68: a partner sees only its own organisation | `FS68 AC1: a partner sees only its own organisation`; page: `fs75-pages` "FS68 page: a partner admin sees only their own organisation ..." | "alnoor-gm sees only Al Noor; gulfhydro-qa sees only Gulf Hydro-Valve" |
| FS68: organisations under 10 people show suppressed values | `FS68 AC2: organisations under 10 people show suppressed values`; page: "... the organisation under 10 contractors shows no numbers" | "organisations with fewer than 10 contractors (org-gulfhydro) return no counts at all" + what-if (10+ shows values, SQL = TS) |
| FS68: course suggestions carry reasons from the existing F33 engine | `FS68 AC3: course suggestions carry reasons from the existing F33 engine` | "every course suggestion carries the F33 engine reasons" |
| FS68 RBAC (partner_org OwnOrg; ENEC equivalency A; supplier management, auditors) | `FS68 RBAC: ENEC evaluators, auditors and supplier management see every supplier; staff see nothing` | "ENEC evaluators ..., auditors and supplier management ... see every supplier organisation"; "staff get nothing; anonymous visitors cannot call it" |
| FS68 rule (2030 vs now, groups, met/foundation/new, claimed never counts) | `FS68 rules: ...`, `FS68 seed and data: ...` | "kafaa_fr_compute = supplierFutureReadiness for all 3 supplier organisations" (+ per organisation) |
| FS69: only shared items are visible to the evaluator | `FS69 AC1: only shared items are visible to the evaluator`; page: "FS69 share page: the evaluator sees the shared items only ..." | "the evaluator sees the 5 shared items only"; "evaluators cannot read the FS32 share rows"; list without items or tokens |
| FS69: the link expires as set | `FS69 AC2: the link expires as set` (fake clock: works on the expiry day, refused the day after); page: "an expired link shows nothing personal" | "an expired link shows nothing personal"; "an expired link and a revoked link are refused" |
| FS69: the pre-check writes no evidence and no qualification status | `FS69 AC3: the pre-check result writes no evidence and no qualification status` (skill_evidence, person_skills, qual_records, evaluations, equivalency_requests byte-identical) | "precheckFromShare (SQL = TS) stores only its summary: ... unchanged" (md5 digests before/after) |
| FS69 RBAC (contractor Own; evaluator A; on behalf with consent) | `FS69 RBAC: ...`, `FS69 revoke: ...`; page: "FS69 queue: ... records a share on behalf with the consent reference", "FS69 page: a contractor creates a pre-arrival share through the three consent gates" | self/on-behalf creation, refusals, revoke, auditor/partner/contractor cannot run the check |
| FS69 rule (shared skills only, no prior requests; stored summaries reproduce) | `FS69 rule: ...`, `FS69 seed: ...` | "kafaa_pa_check = precheckFromShare for 112 share x standard pairs"; "the 4 stored check summaries reproduce" |
| Every page shows `<BenchmarkChips feature="FS68|FS69" />`, `<WhyThis>` on ranked items, EN + AR | `fs75-pages` (chips text, Why this panels, two Arabic renders); `every reason code and page text exists in English and Arabic` | |

## Routes (+5: 338 -> 343; route-count pins NOT touched, `w4-integration` "every route guard ... parses for the sweep" fails 343 vs 338 until the lead updates the pins)

| id | path | guard |
|---|---|---|
| `partner-future-readiness` | `/partner/workforce/future-readiness` | anyRole partner_admin, partner_user (nav partner 7) |
| `admin-supplier-future-readiness` | `/admin/suppliers/future-readiness` | anyRole admin, auditor, training_manager, instructor (same page, all organisations) |
| `partner-prearrival` | `/partner/workforce/prearrival` | anyRole partner_user, partner_admin (nav partner 8) |
| `training-equivalency-prearrival` | `/training/equivalency/prearrival` | anyRole instructor, training_manager, auditor |
| `training-equivalency-prearrival-share` | `/training/equivalency/prearrival/:shareId` | same; smoke param `pa-calnoor01-mech` |

Entry links added: passport page (pre-arrival share; future readiness for partner admins), `/training/equivalency` (pre-arrival checks), `/admin/suppliers` (future readiness).

## Tables and RPCs

- Table `prearrival_shares` (M09, rpc writes; read own_profile `person_id`, equivalency `org_id`): FS32 `share_id`, person, org, standard, mobilisation date, created_via self|on_behalf, created_by, consent_ref, note, last check_summary (counts only).
- RPCs (TS signature `backend/rpc.ts` `Fs75Rpc`, local `backend/local.fs75.ts`, SQL, Supabase mapping):
  `supplierFutureReadiness` -> `kafaa_supplier_future_readiness()`; `prearrivalShares` -> `kafaa_prearrival_shares()`; `prearrivalContractors` -> `kafaa_prearrival_contractors()`; `prearrivalItems` -> `kafaa_prearrival_items(text)`; `createPrearrivalShare` -> `kafaa_create_prearrival_share(jsonb)` (ledger `kafaa.prearrival.share`); `revokePrearrivalShare` -> `kafaa_revoke_prearrival_share(text, text)` (ledger `kafaa.prearrival.revoke`); `prearrivalShare` -> `kafaa_prearrival_share(text)` (audited); `precheckFromShare` -> `kafaa_precheck_from_share(text, text)` (audited, no ledger).
- Internal helpers (executable by no API role): `kafaa_fr_pct`, `kafaa_fr_group`, `kafaa_fr_status`, `kafaa_fr_profile`, `kafaa_fr_reason`, `kafaa_fr_compute`, `kafaa_pa_view`, `kafaa_pa_problem`, `kafaa_pa_shared`, `kafaa_pa_precheck_compute`, `kafaa_pa_check`, `kafaa_pa_summary`, `kafaa_pa_ts`, `kafaa_pa_row`.
- Shared writes (own SECURITY DEFINER functions, logged in CONTRACT): M17 `kafaa_record_shares` (the FS32 link behind each pre-arrival share, and its revocation), M14 `kafaa_notifications` (kind `prearrival`). No evidence `ref_table` added (FS69 writes no evidence), so no recorded-evidence list changes.

## Live apply (for the session that applies wave G)

Migration `supabase/migrations/20261010275001_kafaa_fs75_supplier_readiness.sql` (~49 KB; `@@PART1@@` table + RLS, `@@PART2@@` FS68, `@@PART3@@` FS69 rules, `@@PART4@@` FS69 RPCs + grants). Suggested parts: `kafaa_fs75_supplier_readiness_p1` (PART1-2), `_p2` (PART3-4 + grants). Pre-requisites live: F33 (`kafaa_cp_*`), FS32 (`kafaa_lr_*`, `kafaa_record_shares`), FS05 (`kafaa_role_profile_versions`), W5E1 (`kafaa_w5_hex`, `kafaa_w5_is_date`). No shared function is redefined.
Seed rows (load with `insert ... on conflict (id) do nothing`, `kafaa.seeding` on; `record_shares` before `prearrival_shares`): 7 `kafaa_record_shares` `rs-pa-*`, 7 `kafaa_prearrival_shares`, 4 `kafaa_notifications` `nt-pa-*`. No guarded UPDATE of existing live rows is needed.

## Local md5s and digests (PGlite: all migrations + generated seed, one pass)

Function bodies (`md5(prosrc)`), 22 new functions, none redefined from another wave:

```
kafaa_create_prearrival_share c6d0ce281a1247c7e57b5c3858c4850f
kafaa_fr_compute 006086c647f626c8d6b8c549e40d2097
kafaa_fr_group 81d9a9545182154df968125d5e6a6644
kafaa_fr_pct 05291fcec59c65bf9188903e079bebf0
kafaa_fr_profile 48e697a3b4b5b0d434fb58782f53d2e6
kafaa_fr_reason 0c5dae317b47b9114b5bb6e2a08cd0ee
kafaa_fr_status 55cd626e7f7add01ddeb7be65fd9b8b2
kafaa_pa_check 8cb96c9c39dc5fc52b4b88379fa6c1c1
kafaa_pa_precheck_compute d9b878d1449b62a9cae1e9eb55956f77
kafaa_pa_problem 5a1d7a1b719ee48717f7a8ca104cc39b
kafaa_pa_row 6a7727d41dc264f052af10d695269672
kafaa_pa_shared 47820246229d4711f4a63529c9b65591
kafaa_pa_summary b0b35f0d7f7e94ef308ccb41b0e2436e
kafaa_pa_ts 3e1172669ee0720ad8bde864305669d9
kafaa_pa_view d2b59566dc91385e7c87ab4a79fde79c
kafaa_prearrival_contractors df4964428002e46837dbca6862f8fae7
kafaa_prearrival_items e0b39cbd3a5f41fe2f89eed99e883a47
kafaa_prearrival_share de60aee0adc20a6c98169498f7975b35
kafaa_prearrival_shares 61d655a905e708a64edc960818e20b5c
kafaa_precheck_from_share ce1e4163810dfb796e329ce3819a667d
kafaa_revoke_prearrival_share da58b494ad558a7122f9203428bba44a
kafaa_supplier_future_readiness 19605b4b8ce39459e5f4b4a775426058
FUNCTIONS combined md5 0cbfa459b012be29b4b0c970eac8e9f0
```

Row digests (`count`, `left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`):

```
TABLE kafaa_prearrival_shares 7 a216aec6
ROWS kafaa_record_shares rs-pa-* 7 61a40db4
ROWS kafaa_notifications nt-pa-* 4 8a2de9e8
READ kafaa_fr_compute(null) 3 21aeb59e
```


## Tests and gates

- `npm run gen`: OK; a second run leaves `seed.json`, `seed.sql`, `types.gen.ts` unchanged (md5 before = after). Seed diff vs base: only `prearrival_shares` +7, `record_shares` +7, `notifications` +4 (no other table changed). 35,393 rows / 326 tables.
- `npm run check:i18n`: OK (40 namespaces, EN/AR in parity).
- `npm run typecheck`: clean.
- `npm run migrations:validate`: "All migration checks passed" (2,167 checks, 0 failures; includes the new `fs75-supplier-readiness` validator, 33 checks).
- `npm run check:public`: OK (75 public tables).
- `npx vite build`: OK (known chunk-size warnings).
- Unit tests, one file per vitest process: `fs75-supplier-readiness.test.ts` 16/16, `fs75-pages.test.tsx` 8/8; directly affected files re-run green: `fs43-credentials-record-goals` 20/20, `fs43-pages` 17/17, `w5e2-contractor-passport` 19/19, `w5e2-pages` 10/10, `m14-rbac` 291/291, `fs65-aps-roleplay` 16/16. `w4-integration` 13/14: only the route-count pin (343 vs 338), left to the integration lead as instructed.
- Playwright/browsers not run (engineer slot).

## Decisions, gaps and hand-offs for the integration lead

1. **Route pins:** +5 routes (M09 now 21). Update the pins (343) in `w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..6-integration`, `tests/e2e/sweep.spec.ts`.
2. **FS69 settled decision applied:** an ENEC evaluator (equivalency A) records a share on the contractor's behalf, only with the signed-consent reference and the three consent gates as recorded; the contractor is notified. Contractors who can sign in (local `k-contractor`; on supabase any `partner`-kind passport holder such as `alnoor-qaqc`) create and revoke their own. Partner admins cannot create on behalf (not in the decision; easy to add if wanted).
3. **"Only shared items" scope:** holds for the FS69 views and check. The existing F33 RLS still lets ENEC evaluators read every contractor passport (`/training/equivalency/passport/:personId`); tightening it would break that F33 page. Product decision for the lead.
4. **FS68 population** = people of kind `contractor` (company representatives of kind `partner` are not counted), so Gulf Hydro-Valve (9 contractors + its QA manager) is the suppressed organisation in the demo.
5. **FS68 honest seed:** contractors hold no future skills today (0 % met everywhere; foundations 18-33 %), which is the card's "problem" statement. The supplier academy has no future-skills course, so every suggestion is an ENEC course (`enec_course` reason) and the page shows a "Supplier academy gap" callout listing the uncovered 2030 needs. No courses were added to the shared catalogue (supplier courses ripple into G4/M04 pins); adding supplier-academy future-skills courses later makes them rank first automatically.
6. **Cyber hygiene group** is empty for the three contracted roles (no 2030 profile of maintenance, QA/QC or RP asks for it); the page says "Not asked by the 2030 profiles of the contracted roles".
7. **Wiring candidates (optional):** FS62/FS73 could read `kafaa_fr_compute` for supplier aggregates; the F36 digest could list pre-arrival shares waiting for a check for evaluators (`approval:prearrival_shares:<id>`); the FS32 verify page could label `consents.purpose = 'prearrival'` links.
8. **Date sensitivity:** seeded active links expire between 2026-11-28 and 2026-12-31; after 2026-11-28 the FS69 unit/page tests that open `pa-cdhafra05-mech` / `pa-calnoor01-mech` would see expired links (re-date the seed then).
