# fsIe2 DONE: FS80 Automation and agent gallery with builder credit (wave I, engineer 2, M29)

Branch `fsIe2`, stacked on `fsH-integration-qa` (not merged to `main`). Live Supabase was not available: nothing was applied live.
CONTRACT changelog entry: "2026-10-12 · FS wave I · E2".

## Files

Owned:
- `kafaa/src/modules/m29/automations.ts` (FS80 rules, import-free), `fs80ui.tsx`, `GalleryPage.tsx`, `AutomationPage.tsx`, `MyBuildsPage.tsx`, `GalleryAdminPage.tsx`, `backend/local.fs80.ts`
- additions to `kafaa/src/modules/m29/{routes.ts, smoke.json, backend/schema.ts, backend/rpc.ts, backend/local.ts, backend/supabase.ts}`; one marked link in `MyFluencyPage.tsx`; an "automations on this system" section in `SystemPage.tsx` (both M29)
- `kafaa/src/i18n/m29.{en,ar}.json` (`atm.*`, 4 route titles and purposes)
- `kafaa/supabase/migrations/20261010292001_kafaa_fs92_automation_gallery.sql`
- `kafaa/scripts/seed/ext/fs80-automation-gallery.mjs` (FINALIZE_LAST)
- `kafaa/scripts/validate/fs92-automation-gallery.mjs` (37 checks)
- `kafaa/tests/unit/fs92-automation-gallery.test.ts` (19 tests), `kafaa/tests/unit/fs92-pages.test.tsx` (7 tests)
- generated: `types.gen.ts`, `20261008120100_kafaa_schema.sql`, `20261008120300_kafaa_rls.sql`, `seed.json`, `seed.sql` (2 new tables, 9 new `skill_evidence` rows, 9 changed `person_skills` rows; nothing else changes)

Shared one-token edits (marked `FS80 (fsIe2)`, logged in CONTRACT): the recorded-evidence invariant lists gain `'automations'` in
`kafaa/tests/unit/fs11-catalogue.test.ts`, `kafaa/tests/unit/fsqa1-integration.test.tsx`, `kafaa/scripts/validate/fs11-foundation.mjs`,
`kafaa/scripts/validate/fsqa1-integration.mjs`; the M29 module route pin in `kafaa/tests/unit/fs22-ai-fluency.test.ts` 12 -> 16.

## Acceptance tick list

- [x] **Nothing executes inside Kafa'a (no code storage, metadata only).**
  Unit (`fs92-automation-gallery`, describe "FS80 · nothing executes inside Kafa'a"): "the gallery tables have no code, script, file, link or command column, and every seeded entry is metadata only"; "automationProblem refuses code, scripts, links, file names and credentials in any text (EN and AR)"; "submitAutomation (local) refuses a link or code with the "metadata only" message and stores no code anywhere"; "the pages render entry text as plain text: no HTML injection, no links built from entry text, no network call".
  Pages (`fs92-pages`): "my builds: ... the editor refuses a link before sending (metadata only)"; the gallery shows the metadata-only notice ("staff see the approved entries only ...").
  PGlite: "acceptance (FS80): nothing executes inside Kafa'a: metadata only, no code, script, file or link column"; "SQL kafaa_atm_problem equals automationProblem() on 36 valid and malformed entries (code, links, scripts, credentials, plant security, certification)"; "acceptance (FS80): links and code are refused ("metadata only") ..."; "table checks (a valid control row inserts): metadata_only is always true, no link in any text ...".
- [x] **Evidence is written only after approval and first adoption.**
  Unit (describe "FS80 · evidence is written only after approval and the first adoption"): "builderLevel: 0 until approved and adopted once, 2 from the first adopter, 3 from 5 ..."; "the seed: every builder credit belongs to an approved (or retired) entry with an adopter ..."; "local flow: submit -> approve writes no evidence; the first adoption writes level 2; the fifth raises it to level 3 in place"; "an entry that is not approved cannot be adopted (and so writes nothing), and builder credit never moves the FS09 rung".
  Pages: "adopting an approved entry with no adopter yet: ConfirmDialog, counter 1 and the builder's first credit (level 2)".
  PGlite: "acceptance (FS80): 9 builder credits, each written only after approval and the first adoption ..."; "decideAutomation: ... approval alone writes no evidence ..."; "acceptance (FS80): the first adoption of an approved entry writes the builder's recorded evidence (ojt, validated, level 2) ..."; "builder credit rises in place from level 2 to level 3 at the 5th adopter"; "F01 recompute keeps builder evidence"; "table checks: ... builder credit only when approved and adopted".
- [x] **Each entry links to its AI-system register row.**
  Unit (describe "FS80 · each entry links to its AI-system register row"): "every seeded entry names an existing kafaa_ai_systems row (schema reference too)"; "an entry must run on a published register row: unknown, draft or retired systems are refused".
  Pages: every gallery card carries `m29-atm-system` with its register id; "the FS36 system page lists the approved automations that run on it".
  PGlite: "acceptance (FS80): each entry links to its AI-system register row (kafaa_ai_systems)"; FK `kafaa_automations_system_id_fk`.
- [x] **RBAC (ai_literacy W/Own submit, A decides, R reads).** Unit (describe "FS80 · RBAC"): route guards; local reads (staff approved only, builder own, auditor all, adoption rows only by the adopter, anonymous none); partners cannot submit, staff and training manager cannot decide; maker-checker; adoption never by the builder, once, rung gate; builder edits only draft or returned entries. PGlite: the RLS and RBAC checks, "acceptance (maker-checker) ...". Pages: "a builder opening their own entry cannot adopt it"; "AI governance reviews the queue with the checklist and approves an entry (ConfirmDialog)".
- [x] Suppression: "galleryStats suppresses people counts under 10 and never breaks out security, safeguards or cyber; HR and governance only" (unit); "statistics: every people count is 10 or more, or suppressed ..." (PGlite).
- [x] EN + AR: "EN and AR keys are in parity for the gallery ..." (unit), "the gallery in Arabic" (pages), `npm run check:i18n`.

## Routes (+4; route-count pins left to the integration lead: 380 -> 384)

| id | path | guard |
|---|---|---|
| `workforce-ai-automations` | `/workforce/ai-automations` | `ai_literacy` R |
| `workforce-ai-automation` | `/workforce/ai-automations/:id` (smoke `atm-procedure-revision-digest`) | `ai_literacy` R |
| `my-ai-builds` | `/my/ai-fluency/builds` | `ai_literacy` Own |
| `admin-ai-automations` | `/admin/ai-automations` | `ai_literacy` A |

## Tables and RPCs

- `kafaa_automations` (16 seed rows), `kafaa_automation_adoptions` (59 seed rows; unique (automation_id, person_id)). RLS in the per-statement (perf) form, `revoke all` + `grant select`.
- RPCs (authenticated only): `kafaa_submit_automation(jsonb)`, `kafaa_decide_automation(jsonb)`, `kafaa_adopt_automation(jsonb)`, `kafaa_automation_stats()`. Helpers (no API role): `kafaa_atm_terms`, `kafaa_atm_hit`, `kafaa_atm_texts`, `kafaa_atm_problem`, `kafaa_atm_problem_text`, `kafaa_atm_decision_problem`, `kafaa_atm_adopt_problem`, `kafaa_atm_level`, `kafaa_atm_stats_core`.
- Ledger: `kafaa.ai.automation` (approve, retire), `kafaa.ai.builder_credit` (when credit is written). Audit: `ai.automation.submit|decide|adopt` (refusals too).
- No shared SQL redefinition: `kafaa_skill_states_v2`, `kafaa_skills_apply`, `kafaa_ai_rung` unchanged (builder credit is kind `ojt`, a recorded kind).

## Local md5 (function bodies, PGlite after all migrations + seed)

| function | md5(prosrc) |
|---|---|
| kafaa_submit_automation | 02d31b8517438f88684a86cd80428eea |
| kafaa_decide_automation | 0ed951c9b3fa6b97a4984be12f8f0428 |
| kafaa_adopt_automation | dbf2df123204a451d362be9ddce6bb75 |
| kafaa_automation_stats | 446b6d79a3542b8c91bd0fe2050ba647 |
| kafaa_atm_terms | 6289042388f517ae4dec561e8e2b5711 |
| kafaa_atm_hit | 8740f0b5d9ee49119a57af7e7928ae36 |
| kafaa_atm_texts | 2c5dea97ab4840b9ae3cfa39bf478511 |
| kafaa_atm_problem | 8f0c226a701f7047416fd0d0087906c0 |
| kafaa_atm_problem_text | 73bf525726039b4ffd6399cd64264f56 |
| kafaa_atm_decision_problem | e9d44369d2f8805140b17038a776c9cd |
| kafaa_atm_adopt_problem | a7c23f00939a78d410625d1126ca6554 |
| kafaa_atm_level | 52d8b7ff196bd4ab860c0990cf34116e |
| kafaa_atm_stats_core | dac8aff58dc97ccf9911fd8699ef7ace |
| (unchanged, for the pre-apply check) kafaa_skill_states_v2 | 6beb9870b28196ae60892c7a2a932a19 |
| (unchanged) kafaa_skills_apply | aef7f55da8c445b49e3290b1e74367cb |
| (unchanged) kafaa_ai_rung | 68188d2c55d48b462765816157cc82b4 |

## Local digests (count + `left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`)

| table / slice | rows | digest |
|---|---|---|
| kafaa_automations | 16 | e0b78513 |
| kafaa_automation_adoptions | 59 | 4306fea0 |
| kafaa_skill_evidence where ref_table = 'automations' | 9 | 4217ac82 |
| kafaa_person_skills where skill_id = 'sk-fs-ai-automation' and person is a credited builder | 9 | a78476a1 |

Grants: anon executes nothing new; authenticated executes only the 4 RPCs.

## Live apply notes (for the session that applies the wave-I bundle)

1. Migration first (`kafaa_fs92_automation_gallery_p1`; one part, about 38 KB; split at the "Rules" banner if the apply tool needs smaller parts). It contains no removal word and alters only `kafaa_*` tables (guarded `add constraint`).
2. Seed rows with `insert ... on conflict (id) do nothing` and `kafaa.seeding` on: `kafaa_automations` (16) before `kafaa_automation_adoptions` (59), then the 9 `kafaa_skill_evidence` rows with `ref_table = 'automations'`.
3. **Then replay `kafaa_skills_apply(p, '2026-10-08')`** for the 9 credited builders (`p-cap-coord`, `p-outage-planner`, `w-chem-01`, `w-corp-01`, `w-eng-01`, `w-instr-01`, `w-qa-01`, `w-ro-01`, `w-rp-01`). This derives the 9 existing `person_skills` rows `ps:<builder>:sk-fs-ai-automation` (level and confidence rise); no other skill state changes (the seed builder fails otherwise). No guarded UPDATE of a live row is needed beyond that recompute. Compare the person_skills slice digest above (live holds extra journey rows for some personas; compare these 9 ids only).
4. Compare the md5s and digests above.

## Gates

Run by the integration lead on `fsI-integration-qa` (2026-10-12), because the hand-off had no gate results after fsIe2's rebase:

- `npm run gen`: OK, no diff after the merge of all five slots.
- `check:i18n`: OK (40 namespaces, EN/AR in parity). `typecheck`: clean. `check:public`: OK.
- `migrations:validate`: all checks passed (98 migrations plus the seed applied twice, 2,584 checks), incl. `scripts/validate/fs92-automation-gallery.mjs`.
- Unit: `fs92-automation-gallery` 19/19 and `fs92-pages` 7/7, within the full suite (190 files, 3,360 tests, all green; `docs/kafaa/ref/qa_logs_I/unit_summary.txt`). Route pins are at 401 after the wave-I merge.
- E2E (local backend): journey I3 in `tests/e2e/fswaveI.spec.ts` green; the M29 pages appear in `visual.spec.ts -g fsi` and in the local route sweep (0 mismatches).
- Live-apply dry run of the wave-I bundle: `kafaa_fs92_automation_gallery_p1` applied twice, md5s and digests equal (`docs/kafaa/ref/live_apply/waveI/EXPECTED.md`).

## Gaps and hand-offs for the integration lead

1. **Route-count pins** 380 -> 384 (+4 M29: `workforce-ai-automations`, `workforce-ai-automation`, `my-ai-builds`, `admin-ai-automations`) in the 11 pin files.
2. **Recorded-evidence union (3.9):** my token is `'automations'` in the four invariant lists only. Builder credit is kind `ojt` (recorded by kind), so `RECORDED_REF_TABLES` and the SQL lists of `kafaa_skill_states_v2` / `kafaa_skills_apply` need no change for FS80 (FS39/FS66/FS72 precedent). If the QA migration writes a final redefinition for other slots, it does not need `automations`.
3. **FS72/FS70 stored outputs:** any wave-I builder that adds states can change the stored FS72 suggestions (co-occurrence) and the FS70 published lists. FS80 avoids it (credited builders already held the skill; credits dated after their first evidence); `fs81-skill-signals` stays green on this branch. If another slot moves them, the lead has to decide (re-derive or re-date), not FS80.
4. **Passport label (M17, other slot):** `src/modules/m17/PassportView.tsx` could label `ref_table automations` evidence (key suggestion: `m29.atm.credit.level`); not done (M17 is owned by fsIe5 in this wave).
5. **Digest (optional):** an F36 "approvals I owe" item for AI governance on submitted entries (`approval:automations:<id>`) is a natural follow-up; not on the FS80 card, not wired.
6. **Logged choices:** submit uses `ai_literacy` Own or W (the card's W is held only by the training manager and admins, so staff who build could not submit otherwise; no grant change); the per-entry adoption counter is shown unsuppressed (it counts reuse of a tool, not a people aggregate), while adopters by family, builders and credited builders are suppressed under 10; builder and owner names are copied onto the entry (staff cannot read other people's rows; FS36 pattern).
7. Live Supabase not available: nothing applied live; supabase-mode E2E not run (engineers do not run Playwright).
