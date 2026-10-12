# fsFe3 DONE: FS54 Skills council and taxonomy change tracker + FS55 Engine cards, skills-ontology datasheet and model-risk template (FS wave F · E3, M16)

Branch `fsFe3` (off `fsE-integration-qa`), worktree `/workspace/nexus-fsFe3`, app in `kafaa/`. Not merged; nothing applied to live Supabase; Netlify not touched.

## What was built

- **FS54 change requests** (`/skills/changes/propose`, skills_taxonomy W, staff): add, rename, split (two to four parts), retire (optional replacement) or re-level a skill. The inclusion rule (distinct development, distinct assessment, distinct names after Arabic and English normalisation, a public https source for new skills, a valid replacement, a level and placement) is checked live in the form with the same rule both backends use; a preview shows the request title and what publishing would change; "My requests" lists each request with the council's votes.
- **FS54 skills council** (`/admin/skills-council`, training manager, HR director, platform admin vote; auditors read): open and decided tabs, each request with the inclusion rule against today's catalogue, a publish preview (`changePlan`), the votes by role and the three-step maker-checker progress. Two different members decide, neither the proposer; the first vote approves or rejects, an agreeing second vote closes it, a disagreeing one sends it back. A rejection needs a reason. Every vote is confirmed (`GatedConfirm`), audited and ledgered. Publishing applies the change through the FS02 guard: retire and split mark the skill obsolete with its date and replacement, nothing is removed.
- **FS54 public change log** (`/skills/changes`, public): tiles (changes in 12 months, added, retired or split, methodology changes, last change), changes per month, filters by kind and text, each change with before/after fields, the deciding roles (never names), the dashboards it affects and its sources. "How the catalogue stays current" explains the inclusion rule, maker-checker, obsolete-never-removed and the banner.
- **FS54 methodology banner** (`MethodologyBanner`, keyed by dashboard): shown for 90 days after a methodology change on the catalogue health and datasheet pages; ready for M07 F35 and M35 FS51 (hand-off below).
- **FS54 catalogue health** (`/admin/skills-health`, council, auditor, HR analyst): staleness (past review date, due in 90 days, by owner) and the orphan-rate audit (no course, pathway, assessment or role), coverage donut, the shared "taught by" definition, and eight drill-down filters (each chip opens its list of skills, CSV export, a "propose a change" link per skill).
- **FS55 engine cards for every ranked surface:** 23 new cards (digest, Dalil career mode, Dalil answers, pathways, externals, translator, fitness check, future gigs, SMR delta, twin drills, role 2030, adaptive, instructors, reserve, simulator, knowledge search, KLRA, leadership, HU situations, student journey, conversations, passport, accreditation), bilingual, with inputs used, inputs never used, scoring functions, oversight, limitations and sources (TechWolf and AI-LIT research packs). The navigator card gains `rankConcepts`, the future card `bridgePlan` and `rankRaises` (version + 1). Cards show their kernel surface (transform and assess are defaults only) and fairness basis.
- **FS55 AI transparency tabs** (`/admin/ai-transparency`): "Ranked surfaces" (the `RANKED_SURFACES` registry next to its cards: kernel, what it ranks, fairness, functions, carded status; zero missing) and "Surface fairness" (weekly comparisons by gender and nationality for the nine new outcome metrics, groups under 10 suppress the whole comparison, four-fifths flag; admins run this week's snapshot).
- **FS55 skills-ontology datasheet** (`/skills/datasheet`, public): size and scope, sources, update cadence, languages, how inference works, how bias is handled, limits; every figure computed by `datasheet()` from the catalogue, the change log and the code registries; downloadable JSON.
- **FS55 model-risk template** (`/admin/ai-transparency/model-risk`, admin, auditor, HR): seven sections, 27 fields, 15 gate items; pre-filled from the chosen engine card, the rest prompted; the model gateway is shown off; downloadable Markdown.

## Acceptance (test per criterion)

| Criterion | Unit test (local path) | PGlite (SQL path, `scripts/validate/fs63-taxonomy-governance.mjs`) |
|---|---|---|
| FS54: A retire request marks the skill obsolete and never deletes it | `fs63-taxonomy-governance.test.ts` › "A retire request marks the skill obsolete and never deletes it"; `fs63-pages.test.tsx` › "the proposer of a request cannot vote on it; a different member publishes it and the skill becomes obsolete" | "acceptance (FS54): a retire marks the skill obsolete (date and replacement) and never removes it …"; "the FS02 guard refuses a return from obsolete and any removal of a skill row"; "acceptance (FS54): every published retire keeps the skill in the catalogue …" |
| FS54: Every decision needs two approvers and writes a ledger row | `fs63-taxonomy-governance.test.ts` › "Every decision needs two approvers and writes a ledger row" | "acceptance (FS54): the proposer cannot vote …; the first council vote writes a ledger row; the same member cannot give the second decision"; "acceptance (FS54): a second, different council member publishes …"; "check constraint: a vote by the proposer cannot be stored even by a definer function" |
| FS54: Staleness and orphan rate are computed, with drill-down lists | `fs63-taxonomy-governance.test.ts` › "Staleness and orphan rate are computed, with drill-down lists"; `fs63-pages.test.tsx` › "tiles and drill-down filters: each chip opens the list of its skills" | "acceptance (FS54): staleness (2 overdue, 2 due soon) and orphan rate (0 of 119; 3 untaught, 50 without a role) are computed with per-skill drill-down rows"; "SQL kafaa_fs63_health equals taxonomyHealth on the seed for 5 dates" |
| FS55: Every ranked surface in the app has a card (lint test over engine registrations) | `fs63-engine-lint.test.ts` › "every exported ranking function (returns Ranked, or named rank*, match*, suggest*, recommend*) is claimed by a ranked surface", "every Dalil answer engine …", "every file that calls useEngine() belongs to a ranked surface", "every ranked surface has a card in the seed, and every card is a ranked surface (31 = 8 F24 + 23 FS55)" | "seed: every ranked surface (31) has its engine card, listing every ranking function it claims" |
| FS55: Datasheet numbers are generated from data, not typed | `fs63-taxonomy-governance.test.ts` › "Datasheet numbers are generated from data, not typed"; `fs63-pages.test.tsx` › "shows the catalogue size computed from the data and all six sections" | n/a (computed in the page from public rows) |
| FS55: Fairness snapshots run for each new surface and suppress groups under 10 | `fs63-taxonomy-governance.test.ts` › "Fairness snapshots run for each new surface and suppress groups under 10" | "SQL kafaa_fs63_fairness_compute equals surfaceSnapshot for all 10 seeded weeks"; "acceptance (FS55): every comparison with a group under 10 is suppressed whole (no counts, no rates)"; "ranked-surface fairness snapshot: platform admins only, ledgered, stores exactly the computed rows" |
| FS55 (F24 rule extended): no new scoring function reads gender, nationality or age | `fs63-protected-inputs.test.ts` (static scan of all 48 FS55 functions, runtime Proxy traps for the 23 that take person rows) | SQL scoring functions named on cards exist (seed check) |

Tests: `tests/unit/fs63-taxonomy-governance.test.ts` (14), `tests/unit/fs63-engine-lint.test.ts` (13), `tests/unit/fs63-protected-inputs.test.ts` (74), `tests/unit/fs63-pages.test.tsx` (11); PGlite `scripts/validate/fs63-taxonomy-governance.mjs` (37 checks).

## Routes (+6; pins NOT updated, integration lead)

- `skills-changes`: `/skills/changes`, public, parent `skills`.
- `skills-change-propose`: `/skills/changes/propose`, grant skills_taxonomy W.
- `admin-skills-council`: `/admin/skills-council`, anyRole admin, training_manager, hr_director, auditor.
- `admin-skills-health`: `/admin/skills-health`, anyRole admin, training_manager, hr_director, hr_analyst, auditor.
- `skills-datasheet`: `/skills/datasheet`, public.
- `admin-model-risk`: `/admin/ai-transparency/model-risk`, anyRole admin, auditor, hr_analyst, hr_director.

## Tables and RPCs (migration `20261010263001_kafaa_fs63_taxonomy_governance.sql`)

- `kafaa_engine_cards`: + `kernel_surface`, `ranks`, `fairness_metric`, `fairness_none` (ALTER ADD COLUMN); 23 cards inserted `on conflict (id) do nothing`; guarded updates set the FS55 columns where null, append the navigator/future rankers once, and reconcile the content columns of the live experts, marketplace, mentoring and rotations cards where they are distinct from the seed (version and last change untouched; nothing removed).
- `kafaa_skill_change_requests` (proposer reads own; check constraints `kafaa_scr_maker_checker_ck`, `kafaa_scr_published_ck`), `kafaa_skill_changes` (public), `kafaa_surface_fairness` (governance and HR aggregates). No table is writable through the API.
- RPCs (`authenticated` only): `kafaa_propose_skill_change(jsonb)`, `kafaa_decide_skill_change(text, text, text)`, `kafaa_skill_council_queue()`, `kafaa_taxonomy_health()`, `kafaa_run_surface_fairness(date)`. Ledger actions `kafaa.skills.council_vote`, `kafaa.skills.change_published`, `kafaa.skills.change_rejected`, `kafaa.ai.surface_fairness`. 22 internal `kafaa_fs63_*` helpers executable by no API role.

### Local function md5s (md5(pg_proc.prosrc), PGlite)

- `kafaa_decide_skill_change` 46f7a2f3150c2ef991c988695f842bef
- `kafaa_fs63_apply` 4b64c6a470fa980ca9b6bd8c65350576
- `kafaa_fs63_blank` b8b2bf4472876e5cebc2ea4c0170bccd
- `kafaa_fs63_clean` 363a8c69607a4a2785550c65d29e3de4
- `kafaa_fs63_code` 7dc72c8df47f5e18982cee9ee03d294c
- `kafaa_fs63_decide_problem` 855c17e7d0bf8387f42bdfa4b7371eeb
- `kafaa_fs63_essence` a66eac0e530a95c6c8eeb098e9a83688
- `kafaa_fs63_fairness_compute` 9ebe645e1d190f6991541e00d4471bc3
- `kafaa_fs63_health` 7a34b948bd16f466216e936ebc4174bd
- `kafaa_fs63_https` 38232696b6c785f250d648c792867ae4
- `kafaa_fs63_inclusion` 93bc959c01551e02bcea8814e546c36d
- `kafaa_fs63_level_ok` e1c1e23d2e041bd425b9a233f0d9c13e
- `kafaa_fs63_msg` 14abb98d25532b81bd29be5ecd9ff97a
- `kafaa_fs63_name_ok` 0cb40d0a07c95307a088328631415a3b
- `kafaa_fs63_next_id` 2497f1c44c0c2e0d68374140a91a7e1e
- `kafaa_fs63_norm` 08d3db46afdc70397f60d815d20602f8
- `kafaa_fs63_parts` 5383f49e53270a9ee9a0b63d91719c29
- `kafaa_fs63_propose_problem` 2da3a95d92aec9455906146b6cfd1686
- `kafaa_fs63_review_due` d4b6e4a69d182b4e56b1f2ec66f3c6d1
- `kafaa_fs63_snapshot` eeaf9555e595da2cb683328df2b8c12b
- `kafaa_fs63_sources` 682a57ec63aa3673f65901193a59218f
- `kafaa_fs63_str` ff09c9992cfb1bbb5eb7f83e78591147
- `kafaa_fs63_title` b1a73c8c6c47035e057d54aea648f982
- `kafaa_propose_skill_change` 9d8eebe3b55be5a920d4f878e33c7eec
- `kafaa_run_surface_fairness` 755cefcdc3c8d6e1a32be371803d3b49
- `kafaa_skill_council_queue` cd2c078ee674e5be15effff5e1156d33
- `kafaa_taxonomy_health` bcdcfe113b426e78e4afb42dd51ef5b7

### Table digests (count:left(md5(string_agg(to_jsonb(t)::text, '|' order by id)), 8), after migrations + seed, PGlite)

- `kafaa_engine_cards` 31:d2dfb480
- `kafaa_skill_change_requests` 56:f6408eb6
- `kafaa_skill_changes` 49:90f34f09
- `kafaa_surface_fairness` 360:64bc0d3e
- `kafaa_skills` 120:06cac54d

## Seed (`scripts/seed/ext/fs54-taxonomy-governance.mjs`, FINALIZE_LAST)

31 engine cards, 56 skill change requests (6 open: a rename and a re-level submitted, a split and a retire with one approval, an addition submitted, an addition with one rejection), 49 published changes (48 FS02 future-skill additions June to September 2026 and the retirement of `sk-fs-dp-paperwp`), 1 rejected request, 360 surface fairness rows (10 weeks). Synthetic people only; deciders shown by role.

## Gates (run from `kafaa/`)

- `npm run gen`: regenerated; the only diffs are FS54/FS55 schema, RLS, seed and types (plus `meta.generated_at`).
- `npm run check:i18n`: 40 namespaces, en/ar in parity.
- `npm run typecheck`: clean.
- Unit tests, one file at a time: fs63-taxonomy-governance 14/14, fs63-engine-lint 13/13, fs63-protected-inputs 74/74, fs63-pages 11/11; directly affected: w3e5-transparency 23/23, w3e5-no-protected-inputs 57/57, w3e5-pages 12/12, w3-integration 12/12, fs12-decay 22/22, fs12-pages 8/8, fs24-lanes 11/11, fs24-pages 8/8, fs24-readiness 14/14, fs25-future-roles 10/10, fs25-pages 7/7, fs54-future-leadership 20/20, engines-golden 11/11.
- `npm run migrations:validate`: all migration checks passed (0 failures).
- `npm run check:public`: 75 public tables, no personal columns.
- `npx vite build`: built.
- No Playwright or browsers (engineer rule).

## Shared edits (logged in CONTRACT.md)

- `tests/unit/w3e5-transparency.test.ts`, `tests/unit/w3e5-pages.test.tsx`, `tests/unit/w3e5-no-protected-inputs.test.ts`, `tests/unit/fs24-readiness.test.ts`: card counts and versions follow the 31 cards; FS55 functions checked in `fs63-protected-inputs`.
- `scripts/validate/fs24-future-readiness.mjs`, `scripts/validate/fs25-future-roles.mjs`: their forward proofs replay the FS55 migration after their own (it appends to the same cards).

## Gaps and hand-offs for the integration lead

1. **Route-count pins:** +6 routes (`w4-integration`, `w5-integration`, `fs11-foundation`, `fsqa*-integration`, `tests/e2e/sweep.spec.ts`); M16 route pins if any.
2. **Methodology banner on M07/M35:** mount `<MethodologyBanner dashboard="skills_outlook" />` on `/workforce/skills-outlook` (F35) and `dashboard="skill_forecasts"` on the FS51 pages (export `src/modules/m16/MethodologyBanner.tsx`).
3. **FS57 "taught by":** `TAUGHT_BY` in `src/modules/m16/taxonomyGov.ts` (= SQL `kafaa_fs63_health`) is the shared definition; reconcile if FS57's coverage rule differs.
4. **FS72 (wave H):** add a `RANKED_SURFACES` entry and an engine card for inferred skills; `fs63-engine-lint` fails otherwise.
5. **Live apply:** the migration is additive and idempotent; expected md5s and digests above. The match-card reconciliation updates only content columns that differ from the seed.
6. **Known benign difference:** on SQL the skills row-audit trigger writes audit rows when a change is published; the local backend writes one audit row per RPC.
7. **Seed fairness:** with the full staff population no FS55 comparison is suppressed in the seeded weeks; suppression is proven on synthetic populations (TS and SQL).
