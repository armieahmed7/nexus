# fsEe5 DONE: FS49 Safety culture for an AI-augmented plant (FS wave E · E5, M08)

Branch `fsEe5` (off `main`), worktree `/workspace/nexus-fsEe5`, app in `kafaa/`. Not merged; nothing applied to live Supabase; Netlify not touched.

## What was built

- **`/my/safety-culture/ai`** (`my-safety-culture-ai`, internal_content R, all staff):
  - questioning attitude (trait-2) and decision-making (trait-5, conservative decisions), each with AI and automation examples (4 behaviours and 2 reflection prompts each);
  - the four AI-era HU tool cards: automation bias check, mode awareness, over-reliance and skill fade, verify against the controlled source. Each card has a trap, counter-moves, a synthetic plant example and links to FS37 drills (with the reader's own pass state) and to lessons;
  - "Which tool fits this moment?": 8 moments matched to cards by a fixed rule, each match with `<WhyThis>` reasons. It ranks content, never people, and stores nothing;
  - the 8 classic HU tools, each with its "AI in the loop" angle;
  - 7 sourced international lessons on automation and digital systems;
  - FS49 benchmark chips (IAEA-AI, IAEA-1917, AI-LIT); a plain link to `/speak-up` and one to the AI-literacy register.
- **`/admin/hu-tools`** (`admin-hu-tools`, internal_content W: editor, instructor, training manager): the HU and safety-culture lead's console:
  - content-health tiles;
  - a card table with problems by code;
  - a card editor with a live rule check, then `ConfirmDialog`, then a direct write;
  - a source check for the AI lessons.
- **Extended existing M08 pages:**
  - `/my/safety-culture`: a link to the AI page, the trait's AI behaviours and prompts, and every HU refresher with its trap or AI angle and its drill and lesson links;
  - `/safety-culture` (public): an "AI-augmented plant" HU group;
  - `/oe`: a topic filter, the extra source kinds, an AI pill and a public-source block in the drawer.
- **Speak-up:** `/speak-up` is untouched (`noTelemetry` guard and page unchanged).

## Acceptance (test per criterion)

| Criterion | Unit test (local path) | PGlite (SQL path) |
|---|---|---|
| Every lesson carries a public source and date | `fs55-ai-safety-culture.test.ts` › "every lesson carries a public source and date (the 7 international lessons …)"; also "lesson sources come only from the research packs …" and "the content rule refuses an AI lesson without an https source …" | `fs55-ai-safety-culture.mjs` › "acceptance (FS49): all 7 international lessons … carry a public https source, its year and an as-of date"; "acceptance (FS49): an AI lesson without a public https source is refused …" |
| The speak-up network check stays green | `fs55-ai-safety-culture.test.ts` › "the speak-up network check stays green: /speak-up keeps noTelemetry and FS49 adds nothing to it"; `fs55-pages.test.tsx` › "the speak-up network check stays green: /speak-up renders with no fetch, no RPC and no write" | n/a (no SQL); the Playwright smoke network check was not run (engineer rule: no browsers) |
| Each HU tool card exists in EN and AR and links at least one drill or lesson | `fs55-ai-safety-culture.test.ts` › "each HU tool card exists in EN and AR and links at least one drill or lesson (published …)"; "the four AI-era cards named by the card exist …"; `fs55-pages.test.tsx` › "staff see both traits …", "the learning page … every HU refresher with its links" | "acceptance (FS49): each of the 12 HU tool cards exists in EN and AR and links at least one published drill or lesson"; guard refusals "the guard refuses a card with no drill or lesson …" |
| (What it does) questioning attitude and conservative decision-making extended with AI examples | "trait-2 (questioning attitude) and trait-5 (decision-making) carry AI behaviours …" | "seed: questioning attitude (trait-2) and decision-making (trait-5) carry AI behaviours …" |
| (What it does) HU cards link FS37 drills | "HU cards link FS37 drills by id … a draft drill never counts as a live link" | reference check `drill_unknown` in the guard |
| RBAC: existing M08 rules | "anonymous visitors read every HU card …; OE lessons stay staff-only", "the training manager (internal_content W) edits … staff with read only cannot", "routes: …" | "anonymous visitors read all 12 HU cards", "OE lessons stay staff-only", "staff without internal_content W and anonymous visitors cannot change HU cards (RLS)" |

All tests: `tests/unit/fs55-ai-safety-culture.test.ts` (19), `tests/unit/fs55-pages.test.tsx` (8), PGlite `scripts/validate/fs55-ai-safety-culture.mjs` (23 checks).

## Routes (+2, 288 -> 290; pins NOT updated, integration lead)

- `my-safety-culture-ai`: `/my/safety-culture/ai`, `{ signedIn, grant internal_content R }`, nav my/safety 20.5, parent `my-safety-culture`.
- `admin-hu-tools`: `/admin/hu-tools`, `{ signedIn, grant internal_content W }`, nav admin 9.5, parent `admin`.

No param routes, so no `smoke.json` is needed.

## Data (M08 block of `src/data/schema.ts`, additive)

- `sc_traits`: `ai_behaviours` json, `ai_prompts` json, `ai_hu_ids` text[].
- `hu_tools`: `topic` (`classic|ai_automation`, idx), `sort`, `ai_en|ai_ar`, `trap_en|ar`, `practice` json, `example_en|ar`, `cues` text[], `trait_ids`, `drill_ids`, `lesson_ids`.
- `oe_lessons`: `topic` (`general|ai_automation`, idx), `sources` json `[{label,url,year,as_of}]`, `hu_ids`, `drill_ids`.
- No new table and no RPC. Read and write rules are unchanged.

## Migration `supabase/migrations/20261010255001_kafaa_fs55_ai_safety_culture.sql`

- `alter table ... add column if not exists` for the columns above, plus 2 indexes.
- Guarded updates of the existing live rows `hu-1`..`hu-8`, `trait-2` and `trait-5` (only while they are still at the defaults).
- Internal functions `kafaa_fs49_cue_ids`, `kafaa_fs49_blank`, `kafaa_fs49_bi_ok`, `kafaa_fs49_hu_problems`, `kafaa_fs49_lesson_problems`.
- SECURITY DEFINER trigger function `kafaa_fs49_content_guard`, with triggers `kafaa_fs49_hu_tools_guard` and `kafaa_fs49_oe_lessons_guard` (BEFORE INSERT OR UPDATE).
- All six functions are revoked from public, anon and authenticated.
- No removal words, no NEXUS object, no policy change, idempotent (applied twice in PGlite).
- Suggested live parts: `kafaa_fs55_ai_safety_culture_p1` (columns + guarded updates) and `_p2` (functions, revokes, triggers), or the file in one part.
- **Seed load (live):** load the new rows with `insert ... on conflict (id) do nothing`: 7 `oe_lessons` `oe-ai-01..07`, then 4 `hu_tools` `hu-ai-*`. Lessons go first because the HU guard checks that linked lessons exist; alternatively, set `set local kafaa.seeding = 'on'` for the load.

### Local md5 of every new function body (PGlite, `md5(prosrc)`)

| Function | md5 |
|---|---|
| kafaa_fs49_bi_ok | 785bbf3cbeb5dee3935b3861cbe78eb4 |
| kafaa_fs49_blank | c22235ab86c37cf4feeb80653bbcb6bc |
| kafaa_fs49_content_guard | 9aae38a552608db36a582d113adc3463 |
| kafaa_fs49_cue_ids | cadaf4c4e0e41bf24f9341764a9a5111 |
| kafaa_fs49_hu_problems | 2b6dd788dbb8f3ed37201c4390472582 |
| kafaa_fs49_lesson_problems | 6d82cbedb26030e9e9bed9d7e83f73e8 |

### Table digests (local, `count(*)`, `left(md5(string_agg(to_jsonb(t)::text,'|' order by t.id)),8)`, after migrations + seed)

| Table | Count:digest |
|---|---|
| kafaa_hu_tools | 12:d60cb195 |
| kafaa_oe_lessons | 13:944a5269 |
| kafaa_sc_traits | 10:b17e349f |

Live `oe_lessons` may hold extra E2E rows; compare `where topic = 'ai_automation'` or by id.

## Seed (`scripts/seed/ext/fs49-ai-safety-culture.mjs`, FINALIZE_LAST)

- 4 new HU cards and the AI angle, cues and links on `hu-1`..`hu-8`.
- trait-2 and trait-5 extended.
- 7 lessons, every one sourced from the research packs (IAEA Bulletin; NEI Magazine report of the IAEA symposium; IAEA-TECDOC-1917; the EC AI-literacy repository (AI Act Article 4) twice; UNESCO AI competency frameworks; OECD AI Capability Indicators). Each carries source year and as-of 2026-10-10, and has no figures and no ENEC events.
- The seed diff is limited to `hu_tools` (8 -> 12), `oe_lessons` (6 -> 13) and `sc_traits` (columns). Every other table of `seed.json` is byte-identical to `main`. The builder runs last, so the F07/F20 builds that read OE lessons see the old rows.

## Settled decisions applied (logged in the CONTRACT changelog)

- FS49 OE lessons use only research-pack material, each with source and date. The EU AI Act lesson says it does not bind ENEC (a voluntary reference); no regulatory claims.
- The matcher ranks content only, so there is no engine card or fairness snapshot (same as the FS17/FS18 content rankers).

## Gates (from `kafaa/`)

- `npm run gen`: OK; a second run leaves `seed.json`, `seed.sql`, `types.gen.ts`, the generated schema SQL and `RBAC.md` byte-identical (291 SQL tables, 33,542 seed rows / 289 tables).
- `npm run check:i18n`: OK (40 namespaces, en/ar in parity).
- `npm run typecheck`: clean.
- Unit tests, one file at a time:
  - own files: `fs55-ai-safety-culture` 19/19 and `fs55-pages` 8/8;
  - affected files: `m13-dalil` 12, `w3e2-knowledge` 24, `g5-components` 4, `w1e3-coach` 22, `m14-rbac` 291, `w2e5-leadership` 32, `fs35-core-skills` 22, `w5e5-career` 20, `w5e5-pages` 8, `m05-assessments` 7. All green.
  - The route-count pin tests (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa1..4-integration`) will read 290 instead of 288; they are left to the integration lead.
- `npm run migrations:validate`: "All migration checks passed" (full run, includes the 23 `fs55` checks).
- `npm run check:public`: OK.
- `npx vite build`: OK (only the known chunk-size warnings).
- Not run: Playwright smoke and E2E (engineer rule).

## Gaps and hand-offs for the integration lead

1. **Route-count pins 288 -> 290** in all pin files (handover 3.11).
2. **Contract request:** mirror `huCardProblems` / `lessonProblems` (with references) in `src/data/local/guards.ts` for direct `hu_tools` / `oe_lessons` writes on the local backend. Live is enforced by the trigger; locally only the console checks before saving.
3. **FS49 -> FS37** is already wired: HU cards link `/my/ai-fluency/drills/:id` in data and UI. Speak-up is untouched, but the Playwright smoke check (`npm run test:smoke`) and the E2E sweep were not run here (no browsers); please run them in wave QA.
4. **Runtime effects on other modules (read-only):**
   - the Dalil corpus indexes the 4 new HU cards;
   - the Learning Coach lists the 7 published lessons as general readings.
   - `m13-dalil`, `w5e5-*`, `w1e3-coach` and `w3e2-knowledge` tests pass.
5. **No recorded-evidence ref table** is added (FS49 writes no `skill_evidence`), so nothing goes into the 3.9 union from this branch.
6. **Live apply:** compare the six function md5s and the three digests above; anon/authenticated must execute none of the `kafaa_fs49_*` functions.
