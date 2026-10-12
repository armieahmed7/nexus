# fsHe4 DONE: FS76 Dalil future-skills mode (M13)

Branch `fsHe4` (worktree `/workspace/nexus-fsHe4`, off `fsG-integration-qa`, stacked: waves E to G are not on `main` yet). Live Supabase was not touched (not available in this session): nothing was applied live. Netlify was not touched. Nothing was pushed to `main` or `fsG-integration-qa`.

## What FS76 adds

Dalil can now answer the four future-skills questions, deterministically and with citations (no LLM), from the features that hold the data:

| Intent | Example | Built on | Personal (staff with a skills profile) | Public (anonymous and everyone else) |
|---|---|---|---|---|
| `future.role_2030` | "How will my role change by 2030?" | FS11 `transformRole` (M30), FS05 profiles | my role's map from `rpc.roleTransformation` (drivers, tasks that grow / become AI-assisted / shrink, what the 2030 profile adds, my time-to-ready), cards with `<WhyThis>` | the map's public summary, archetype, drivers and the names of what 2030 adds, **no numbers**; concept roles show their FS05 profile |
| `future.ai_rung` | "Which AI rung do I need?" | FS09 `aiRung` + `targetGap` (M29) | my rung from evidence (self-ratings never count) against my family's target, one card per missing cell with its learning | the target of a named role's family, or the ladder overview |
| `future.skill_crosswalk` | "What is the ESCO equivalent of digital twin validation?" | FS07 skill page, FS08 published `skill_alignments` (M28) | same as public | plain-words meaning, published rows per framework (code, match type, reviewed or indicative), "code pending review" for label rows, a framework name narrows the rows; security skills path-level only |
| `future.pathway_gap` | "Which pathway closes my gap?" | FS17 `rankPathways` (M19, the Learning Coach's ranking) | top three pathways for my 2030 gaps and goals, with the Coach's reasons; the F24 coach opt-out gives an unranked list | a sign-in answer that points to the public skills catalogue |

Where it runs: career mode (`/ask?mode=career`) answers these questions personally; the new UI mode **Future skills** (`/ask?mode=future`) is open to everyone (personal for staff with a skills profile, public for everyone else); every other mode (public, applicant, staff, partner) answers them with public content. Answers never imply an eligibility or deployment decision ("planning assumption, no deployment decision implied"; "indicative only").

The **intents are governed**: `kafaa_dalil_intents` holds one public catalogue row per intent (EN/AR title, summary, examples, cited routes, https sources, benchmarks), shown on `/ask` in future mode and on the new **Future skills** tab of `/admin/dalil`, where the AI owner (admin) switches an intent off or on with a reason (`GatedConfirm`; audited and NEXUS-ledgered). A switched-off intent answers "switched off by the AI owner" and its turns are refused by the log.

**QA_B closed:** a concept role asked about directly ("What do I need to become a digital twin engineer?", "When could I be ...?") now reads FS15 `conceptReadiness` against its FS05 profile (`career.concept_gap`, `career.concept_roadmap`, same pct as `rpc.futureRoleReadiness`), never F05 readiness (which read 0 %).

**Release gate:** `/admin/dalil` → Evaluation runs the public (F14), career (F37) and the new future-skills (FS76) sets; the gate needs all three.

## Acceptance

- [x] **The new evaluation set reaches at least 95% citation rate.** `FUTURE_EVAL_SET` (34 cases: 17 personal on the F37 evaluation persona, 8 anonymous, 9 refusals incl. 5 security red-team; EN and AR; every intent at least 3 times) passes on the seed with 25/25 cited (100 %), 5/5 security, 11/11 public answers clean. Release thresholds: >= 95 % (`CITATION_FLOOR`), 100 % security, every anonymous answer clean. The gate needs F14 + F37 + FS76; the seeded run r1.1 (`eval-2026-10-fs76`, 68/68 cited, 19/19 security) equals a fresh run.
  - Test: `tests/unit/fs84-dalil-future.test.ts` › "FS76 acceptance: the new evaluation set reaches at least 95% citation rate (release gate)" › "the future-skills set passes: >= 95% cited, every security case declined, every public answer clean"; › "the release gate needs all three sets, and the seeded r1.1 run equals a fresh run on the seed"; › "adding the future intents changes nothing in the public (F14) and career (F37) sets".
  - Page test: `tests/unit/fs84-pages.test.tsx` › "FS76 on /admin/dalil" › "the evaluation run includes the future-skills set and the gate passes".
  - PGlite: `scripts/validate/fs84-dalil-future.mjs` › "seed: release gate r1.1 runs the public, career and future-skills sets (68/68 cited, security 19/19)".
- [x] **Security questions still decline.** The guards sit in front of the future intents (`GuardedEngine`), for staff (career engine) and anonymous visitors (public engine): security, cyber, safeguards, eligibility decision, injection and the concern stop; the F14 red-team set keeps 100 % with the future intents attached; security skills and roles stay career-path level (no crosswalk, no task or skill change).
  - Test: `fs84-dalil-future.test.ts` › "FS76 acceptance: security questions still decline" › "in future-skills mode for staff (career engine) and for anonymous visitors (public engine)"; › "the F14 red-team set keeps 100% with the future intents attached"; › "security skills and roles stay career-path level (no crosswalk, no task or skill change)".
  - Existing suites re-run green: `m13-dalil.test.ts` (12), `w5e5-career.test.ts` (20), `w5e5-pages.test.tsx` (8), `g5-workflows.test.ts` (17).
- [x] **Anonymous questions get public content with no personal data.** Through the repository an anonymous visitor reads only public catalogues (no pathways, published maps only); every future answer for them is never personal, cites no `/my/` page, carries no person id, and the 2030 role answer has no numbers; the pathway question gets a sign-in answer. Anonymous visitors cannot log a future turn (`not_signed_in`; SQL: not granted) and their future turns go to the public log (`kafaa_dalil_turn`, no person). A signed-in person's future context holds only their own rows.
  - Test: `fs84-dalil-future.test.ts` › "FS76 acceptance: anonymous questions get public content with no personal data" (4 tests: "through the repository an anonymous visitor reads only public catalogues ...", "every future intent answers with public content: never personal, no /my/ citation, no numbers in the 2030 role answer", "anonymous visitors cannot log a future turn or read anyone's rows; their public turns go to the public log", "a signed-in person's future context holds only their own rows").
  - Page test: `fs84-pages.test.tsx` › "anonymous: a 2030 role question answers from the public map, cited, with no personal data"; "anonymous: ?mode=future opens the public future mode ...".
  - PGlite: "grants: anonymous visitors execute nothing new (they keep kafaa_dalil_turn); the intent rule is internal"; "dalilFutureTurn: personal answers (flag or .personal intent) only for staff with a skills profile; ...".
- [x] **What it does: the four intents, answers cite role maps, skill pages and sources.**
  - Tests: `fs84-dalil-future.test.ts` › "FS76 intents call the future-skills rules unchanged" › "detection: the four intents in both languages; everything else is left to the existing engines"; "role in 2030 (FS11): my role's map from rpc.roleTransformation with task counts, time-to-ready, cards with reasons, cited"; "AI rung (FS09): the rung and the missing cells equal aiRung() / targetGap() on my own states; self-ratings never count"; "skill crosswalk (FS07/FS08): published rows only, framework filter, codes or "code pending review", the source cited"; "pathway for my gap (FS17): the Coach's rankPathways on my 2030 profile and goals, with its reasons; the coach opt-out gives an unranked list"; "every future answer is fully translated in both languages"; › "FS76 seed and catalogue" › "each catalogue example is answered by its own intent (staff and, where public, anonymous)".
  - Page tests: "staff: future mode answers from my own records (personal banner, AI rung cards with WhyThis)"; "staff: the catalogue example button asks it; the turn is logged as a career turn through rpc.dalilFutureTurn"; "Arabic: future mode renders right to left with Arabic answers".
- [x] **Adjustment: close QA_B (concept-role `careerReadiness` uses FS15).**
  - Test: `fs84-dalil-future.test.ts` › "FS76 closes QA_B: a concept role asked about directly reads FS15 readiness, not F05" › ""What do I need to become a digital twin engineer?" returns conceptReadiness against its FS05 profile, never "ready now""; › "the same answer through the LocalBackend equals rpc.futureRoleReadiness (one rule)". Eval cases `fs76-en-concept-gap`, `fs76-en-concept-when`, `fs76-ar-concept`.
- [x] **Adjustment: the evaluation set is in the release gate** (see the first criterion; `gatePass` = F14 && F37 && FS76; saved runs use engine `retrieval-v1+career-v1+future-v1`).
- [x] **RBAC: signed-in for personal answers; anonymous gets public content.** Personal answers only in career mode and in future mode for staff with a skills profile (`skills_profile` Own, staff mode); the turn log refuses `personal_not_allowed` for anyone else; the intent switch is the AI owner's only (`dalil_config` A), with a reason.
  - Tests: `fs84-dalil-future.test.ts` › "FS76 governance: the intent switch and the turn log ..." › "setDalilIntent: the AI owner only, with a reason; audited and ledgered; the switched-off intent answers ".off" and its turns are refused"; › "dalilFutureTurn: staff turns are career turns; partners keep their own mode and never log a personal answer; the kill switch still applies".
  - Page tests: "the AI owner switches an intent off with a reason (confirm dialog); the catalogue shows it off"; "an auditor reads the intents but cannot switch them".
  - PGlite: the five setDalilIntent / dalilFutureTurn checks (forbidden, invalid, not_found, unchanged; audit + ledger; intent_disabled with nothing logged; staff -> career turn; partner -> partner mode; kill switch).
- [x] `<BenchmarkChips feature="FS76" />` (SG-CAREER, AI-LIT) on the future-mode banner of `/ask`, on the Future skills tab and on the FS76 block of the evaluation; external sources only from the research packs (`https://www.myskillsfuture.gov.sg/csp`, `https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices`, `https://wsg.gov.sg/for-employers/jobs-transformation-maps.html`, `https://esco.ec.europa.eu/en/classification/skill_main`); no benchmark figure typed into copy. Full EN + AR (logical classes only, `useFormat`, `usePick`), both backends.

## Routes

No new route (route pins unchanged at 367). New UI mode `/ask?mode=future` on the existing public route `ask`; new tab "Future skills" on `/admin/dalil` (admin, editor, auditor; only admin switches).

## Tables and RPCs

- `kafaa_dalil_intents` (M13, new `src/modules/m13/backend/schema.ts` + one marked line in `src/data/ext/schema.ts`): 4 rows; public read (`public_content`, per-statement policy form); write rpc via `dalil_config`; keeps `changed_role`, `changed_at`, `change_note` (no person id in a public table; the person is in the audit trail).
- `setDalilIntent(id, enabled, note)` -> `kafaa_set_dalil_intent(text, boolean, text)`; authenticated only.
- `dalilFutureTurn(p)` -> `kafaa_dalil_future_turn(jsonb)`; authenticated only; hands the turn to `kafaa_dalil_career_turn` (staff) or `kafaa_dalil_turn` (everyone else, own mode).
- `kafaa_dl_intent_base(text)` internal rule (= `intentBase`), not executable by API roles.
- No shared function redefined (`kafaa_dalil_turn`, `kafaa_dalil_career_turn` called as they are); no evidence written, no ref_table, no policy resource or grant change.

## Live apply (for the session that applies wave H)

One migration file, `supabase/migrations/20261010284001_kafaa_fs84_dalil_future.sql` (12.7 KB, one part `kafaa_fs84_dalil_future_p1`): table + RLS + the 4 intent rows (`on conflict (id) do nothing`) + 3 functions + grants. **No UPDATE of existing live rows.** Seed rows to load afterwards (`insert ... on conflict (id) do nothing`): `kafaa_advisor_sessions` `as-future-1..4`, their 12 `kafaa_advisor_turns`, `kafaa_eval_runs` `eval-2026-10-fs76`.

Local md5 of the new function bodies (PGlite, after `migrations:validate` setup):

| Function | md5(prosrc) |
|---|---|
| `kafaa_dalil_future_turn` (new) | `26341ff1398c0040ed6032b248298b7b` |
| `kafaa_set_dalil_intent` (new) | `7c920607cf9a4ef3421db42f0d58afeb` |
| `kafaa_dl_intent_base` (new) | `dc41031590e016881e8814d44d843fae` |
| `kafaa_dalil_career_turn` (unchanged, called) | `57386fe61e761c0060f06a2e268a709d` |
| `kafaa_dalil_turn` (unchanged, called; live differs only by stripped comments, handover 3.10) | `7d1279e5b88d4a9004eed64621b04a24` |

Row counts and digests (`count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`):

| Rows | Count | Digest |
|---|---|---|
| `kafaa_dalil_intents` (new table) | 4 | `69e50c66` |
| `kafaa_advisor_sessions` where `id like 'as-future-%'` | 4 | `51a63819` |
| `kafaa_advisor_turns` where `session_id like 'as-future-%'` | 12 | `b9f28af4` |
| `kafaa_eval_runs` where `id = 'eval-2026-10-fs76'` | 1 | `e02f0084` |

## Tests and gates

- Unit tests (new): `tests/unit/fs84-dalil-future.test.ts` 24/24, `tests/unit/fs84-pages.test.tsx` 8/8 (one file per vitest process, `TMPDIR=/dev/shm`).
- Directly affected existing files re-run green: `m13-dalil` 12, `w5e5-career` 20, `w5e5-pages` 8, `g5-workflows` 17, `fs63-engine-lint` 13 (no new AnswerEngine class, no new rank*/match* export), `fs63-protected-inputs` 74, `w3e5-no-protected-inputs` 69, `m14-rbac` 291, `fsqa2-integration` 13, `w5-integration` 8, `engines-golden` 11.
- Gates: `npm run gen` OK and stable (35,895 rows across 341 tables, 57 personas; regenerating leaves `seed.json` unchanged; only the new table and the new rows change); `npm run check:i18n` OK (40 namespaces, EN/AR parity); `npm run typecheck` clean; `npm run migrations:validate` **All migration checks passed** (87 migrations + seed applied twice, 2,313 checks, 0 failures, incl. the 15 `fs84-dalil-future` checks); `npm run check:public` OK (76 public tables, no personal columns); `npx vite build` OK (chunk-size warnings are the known ones). Playwright not run (engineer slot).

## Decisions and deviations (logged in the CONTRACT changelog)

1. **No new AnswerEngine class.** The future intents are plain functions (`answerFuture`) called from `CareerEngine` (personal) and `RetrievalEngine` (public), so the FS55 lint and the `dalil_career` / `dalil_answers` engine cards stay valid without a card or seed change.
2. **Anonymous future turns go through the existing `kafaa_dalil_turn`** (anon executes nothing new, wave-H checklist). For them the intent switch is enforced in the browser (the engine reads `kafaa_dalil_intents`); for signed-in callers it is enforced server-side by `kafaa_dalil_future_turn`.
3. **Career sessions keep `submode = 'career'`** (the check constraint cannot be widened); future turns are told apart by their `future.*` intent; `/admin/dalil` logs show those sessions as "Future skills".
4. **Seeded conversations dated 2026-10-10** (after the demo digest date and the FS55 fairness cut of 2026-10-08), so seeded digests and `career_mode_used` fairness rows are unchanged.
5. `findRole` / `ROLE_TOKENS` moved from `career/engine.ts` to `career/roles.ts` (re-exported from `engine.ts`, imports unchanged).

## Gaps and hand-offs for the integration lead

1. Optional: the FS55 `dalil_career` engine card could name the four future intents and `answerFuture` among its inputs (a guarded `engine_cards` update; not done here to avoid touching a live row).
2. Entry points owned by other modules: link `/ask?mode=future&q=...` from `/my/role-2030` (M30), `/my/ai-fluency` (M29), `/skills/:id` (M28) and `/my/pathways` (M19); the shell Dalil launcher could open future mode there.
3. FS75 (same wave) may add a digest nudge pointing to future-skills mode; no coupling is required.
4. Live: apply the one part above, load the seed rows, compare the md5s and digests, then the route sweep in supabase mode should show the new Future skills chip on `/ask` for every session (public answers for anon and partners, personal for staff).
