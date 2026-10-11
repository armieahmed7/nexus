# fsEe2 · FS wave E · E2 — FS41 CleanEnergyComp, FS42 energy-system integration pathway, FS43 ESG and GHG literacy for managers (M32)

Branch `fsEe2` in `/workspace/nexus-fsEe2` (app in `kafaa/`), pushed to `origin/fsEe2` only (never main). Live Supabase was not available: nothing applied live, no Supabase API call. Everything below is proved locally (unit tests on the LocalBackend, PGlite validator on the SQL).

## Acceptance (PLAN.md section 4, wave E)

FS41 · CleanEnergyComp (RBAC: public R; Own progress)
- [x] Each competence lists learning outcomes in EN and AR and cites GreenComp. 12 competences (CEC-1.1 .. CEC-4.3), three per GreenComp area (embodying values, embracing complexity, envisioning futures, acting), 3 outcomes each in EN and AR, `greencomp_area`, the GREENCOMP benchmark and the JRC GreenComp page + PDF as sources. Tests (`tests/unit/fs52-energy-transition.test.ts`): "twelve competences, three per area, each with 2-4 outcomes in English and Arabic", "every competence cites GreenComp: ...", "the check refuses a competence without Arabic outcomes or without its GreenComp citation"; page test "a competence shows its outcomes in English and Arabic side by side ..."; validator check "acceptance FS41: ... outcomes ... GreenComp".
- [x] Every competence links to at least one FS02 skill and one learning item. Tests: "each competence has an FS02 future skill and only existing, non-security skills", "each competence has at least one learning item and every item exists in its own table", "the check refuses a competence with no FS02 skill or a missing learning item"; validator "acceptance FS41: every competence links to at least one FS02 future skill and at least one existing learning item".
- [x] Role targets exist for every job family, and public text passes publicTextIsClean. 20 targets (one per family; L3 environment, L2 engineering, radiation protection, chemistry, nuclear fuel, supply chain, corporate; L1 the rest) with focus competences and EN/AR rationale. Tests: "one target per job family, level 1-3, existing focus competences, rationale in both languages", "all public CleanEnergyComp text (competences, targets, i18n strings) passes publicTextIsClean", "the framework is public read and its routes are public; progress is Own and the HR view Agg"; page test "the public framework shows 12 competences ... targets for every family, a passing check ..."; validator "acceptance FS41: a role target for every one of the 20 job families; public text passes publicTextIsClean".
- Also: links to Net Zero 2050 and the Jahiz New Economy group on every competence; `/skills/clean-energy` (public) and `/my/clean-energy` (my progress with `<WhyThis>` reasons, grow next, add-a-goal through FS33 `saveSkillGoal` behind a ConfirmDialog, MC-CLEAN-ENERGY eligibility). Level rule tests: "a competence level is the best counted state; self-ratings never count", "the overall level is the lowest area ...", "grow next puts the family focus competences first ...", "my profile is my own counted states against my family target; anonymous gets null", "the HR view needs skills_profile Agg, equals cecStats() and suppresses cells under ten".

FS42 · Energy-system integration pathway (RBAC: staff R)
- [x] Every fact carries a source and an as-of date. 3 value chains (hydrogen, process heat, grid), each fact with label, https URL, as-of 2026-10-10, publication date and a secondary-source flag; facts and URLs only from the research packs. Tests: "three value chains (hydrogen, process heat, grid); every fact has an https source, a label and an as-of date", "every fact URL comes from the research packs ...", "the check refuses a fact without its as-of date or source"; page test "a value chain shows stages, sourced facts with dates ..."; validator "acceptance FS42: three value chains; every fact carries an https source and an as-of date ...".
- [x] Copy passes publicTextIsClean (no project or site claims). Tests: "chains, tracks, the two pathways and their steps pass publicTextIsClean and the project-claim check", "a project claim fails the chain check"; page test "the hub ... no ENEC project, site or deployment decision is implied".
- [x] The pathway shows its envelope and weekly hours like every other pathway. `pw-et-system-integration` is an ordinary FS17 pathway (sk-fs-gr-h2heat L2, 6 months, 2 h a week, 5 steps, 46 h; curated readings, the ADVANCE study gig `fg-adv-licensing-compare`, practice with engineering/chemistry, lanes HZ-5/HZ-9/HZ-10 on the chains). Tests: "the FS42 pathway is a published FS17 pathway that passes pathwayProblems and fits its envelope", "the pathway catalogue lists it with envelope, weekly hours and planned hours, and no requested step", "awareness to practitioner with curated readings, a gig and the matching horizon lane", "MC-H2-HEAT stays a draft ..."; page test "a value chain ... the pathway with its envelope (Arabic)"; validator "acceptance FS42/FS43: both tracks run on published FS17 pathways ...".

FS43 · ESG and GHG literacy for managers (RBAC: staff R)
- [x] Completable in under 10 hours with a stated weekly cost: `pw-et-esg-managers` 9 h planned, 1 h a week over 3 months; the quickest item in every step fits its hours. Tests: "planned hours are under the 10-hour cap and fit the envelope at the stated weekly hours", "the quickest item in every step fits the step hours ...", "the check refuses an FS43 track over the cap"; page test "the ESG track is under 10 hours with its weekly cost ..."; validator "acceptance FS43: completable in 9 h (< 10) at 1 h a week ...".
- [x] All content is sourced. Tests: "the track and pathway cite sources; every item the pathway resolves to has an https source", "the five new readings pass the FS18 catalogue criteria and carry an as-of date".
- [x] Completion counts toward the matching micro-credential criteria (MC-CLEAN-ENERGY: adaptive `ab-clean-energy`, skill `sk-fs-gr-ghg`). Tests: "every MC-CLEAN-ENERGY criterion is reached by a step of the pathway (adaptive check and GHG skill)", "a pathway without the assess step would not reach the credential"; page test (criteria all `data-covered="true"`); validator "acceptance FS43: completing the pathway's check counts toward every MC-CLEAN-ENERGY criterion".

Every page shows `<BenchmarkChips feature="FS41|FS42|FS43" />` (page tests assert the chips). Full EN + AR (287 keys each, RTL, logical classes, `useFormat`).

## Routes (+7, 288 -> 295; pins left to the integration lead)
- `/skills/clean-energy` (`skills-clean-energy`, public; nav public/careers 11.95) CleanEnergyPage: tiles, method/national/level-rule callouts, area filter, competence cards, matrix, levels, role targets, live framework check
- `/skills/clean-energy/:id` (`skills-clean-energy-competence`, public) CecCompetencePage: at a plant, outcomes EN | AR, skills (FS02 highlighted), learning items, focus families, sources
- `/my/clean-energy` (`my-clean-energy`, skills_profile Own; nav my/skills 18.8) MyCleanEnergyPage
- `/workforce/clean-energy` (`workforce-clean-energy`, skills_profile Agg; nav my/workforce 67.5) WorkforceCleanEnergyPage (suppressed under 10; security/safeguards/cyber never broken out)
- `/learn/energy-transition` (`learn-energy-transition`, internal_content R; nav my/growth 21.7) EnergyTransitionPage: chains, tracks, FS20 cohort link, framework link
- `/learn/energy-transition/esg-managers` (`learn-esg-managers`, internal_content R; nav 21.75) EsgManagersPage: cost, route with quickest items, credential route, start (ConfirmDialog)
- `/learn/energy-transition/:chainId` (`learn-energy-chain`, internal_content R) ValueChainPage: stage flow, facts, skills, CleanEnergyComp, lanes, pathway panel

## Tables / RPCs (migration `supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql`, additive kafaa_* only, idempotent)
- Tables: `kafaa_cec_competences`, `kafaa_cec_role_targets` (skills_taxonomy R: public), `kafaa_value_chains`, `kafaa_transition_tracks` (internal_content R: staff). RLS create-once + `alter policy` perf form; `revoke all` from anon/authenticated, `grant select`; no API writes.
- RPCs (`authenticated` only; read-only, never audited or ledgered): `kafaa_cec_mine()` (Own), `kafaa_cec_stats()` (Agg). Internal (not granted): `kafaa_cec_area_name`, `kafaa_cec_basis_rank`, `kafaa_cec_pct1`, `kafaa_cec_comp`, `kafaa_cec_profile`, `kafaa_cec_level` (FS74 hand-off), `kafaa_cec_stats_core`.
- Data-only rows in other modules' tables (seed, `insert ... on conflict (id) do nothing`): M19 `pathways` 2, `pathway_steps` 9, `external_resources` 5; M04 `courses` 2; FS30 `credit_tags` 4 (from fsqa4's `ensureCreditTags`).

Local function md5 (PGlite, `md5(prosrc)`):
| function | md5 |
|---|---|
| kafaa_cec_area_name | dd2a7f2960ab441feb35c74e052c6b81 |
| kafaa_cec_basis_rank | a851459f25aef799893f65be8f0ff3d6 |
| kafaa_cec_comp | d5e506ee842df5bb96756b79e4761409 |
| kafaa_cec_level | be27dc5c6a2bb93bd4e8a920471c528c |
| kafaa_cec_mine | 10679750f77cf7772cdb869466a841c5 |
| kafaa_cec_pct1 | cc860c951f0a4b8854f089570bd7d4cf |
| kafaa_cec_profile | 9cdceec6893b83f5f096ead7c2035b4b |
| kafaa_cec_stats | 5cff0771d859583d4472752dd5c019ba |
| kafaa_cec_stats_core | 3d99dcd0392fd6d466c32b4217189d0e |

Table digests (rows, md5 of ordered ids [:8], md5 of ordered rows [:8]):
| table (filter) | rows | ids | rows md5 |
|---|---|---|---|
| kafaa_cec_competences | 12 | 700a857c | 0fe4010c |
| kafaa_cec_role_targets | 20 | 8b34b745 | bce97c82 |
| kafaa_value_chains | 3 | 85fe3fb3 | 5f65bfb6 |
| kafaa_transition_tracks | 2 | e077f44c | 041078be |
| kafaa_pathways (pw-et-%) | 2 | 392ac558 | 2a1bd91f |
| kafaa_pathway_steps (pw-et-%) | 9 | 8fb84558 | 058eed46 |
| kafaa_external_resources (xr-et-%) | 5 | 36840d05 | b7346ece |
| kafaa_courses (c-et-%) | 2 | 02c27961 | 216b29e5 |
| kafaa_credit_tags (pw-et-% / c-et-%) | 4 | 8a4b7b8e | 6bc38a9a |

Seed CleanEnergyComp distribution (106 active staff, honest evidence, not tuned): L0 60, L1 14, L2 29, L3 3; 43.4 % at L1 or above; 39.4 % at their family target. k-ro L0 (no counted evidence in "acting"); head-sustainability L2, met.

## Tests / gates
- `tests/unit/fs52-energy-transition.test.ts` 36/36; `tests/unit/fs52-pages.test.tsx` 10/10.
- `scripts/validate/fs52-energy-transition.mjs`: all checks pass (SQL = TS for every person and for generated edits, RLS per role, grants, additive-only scan).
- Directly affected suites re-run one at a time: fs31-pathways 18/18, fs42-rpl-credits 11/11, fs41-future-gigs 17/17, engines-golden 11/11, w1e3-coach 22/22, fs24-pages 8/8, fs32-course-pack-academies 17/17, fs43-credentials-record-goals 20/20, m04-paths 9/9, w0-scaffold 5/5. Pins left to the lead (only these fail): route count 288 -> 295 in `fs11-foundation`, `fsqa3-integration`, `fsqa4-integration` (and the other 288 pins: `w4-integration`, `w5-integration`, `fsqa1/2-integration`, `tests/e2e/sweep.spec.ts`); `fs31-pages` "the external catalogue lists published items" expects 8 published externals, now 13 (the five FS42/FS43 readings are published and listed on purpose).
- Gates: `npm run gen` (idempotent, no diff on rerun), `npm run check:i18n` (40 namespaces in parity), `npm run typecheck`, `npm run check:public`, `npx vite build`: pass. `npm run migrations:validate`: pass (55 validators including fs52-energy-transition, exit 0).

## Gaps and decisions
- The research packs carry no hydrogen-, process-heat- or GHG-specific figures, so chain facts use the IEA / IRENA-ILO / OECD-NEA / WEF pack facts on energy jobs and skills; hydrogen and heat appear only as concept descriptions. GHG basics are taught by two new internal concept courses (`c-et-ghg-mgr`, `c-et-esg-clinic`) plus the existing FS19 `c-fs-ghg`; no figure about ENEC is stated.
- MC-H2-HEAT stays a draft (the FS42 track shows the draft note and the criteria the pathway already covers).
- The "grow next" list is a deterministic ordering (family focus first, then gap to target, then framework order), not a model or ranking engine, so no engine card was added; the lead may want one for consistency.
- No E2E run (Playwright not allowed in this wave).

## Hand-offs for the integration lead
1. Route-count pins 288 -> 295 and the FS18 catalogue pin in `fs31-pages.test.tsx` (8 -> 13).
2. Live apply when Supabase is available: the migration as parts (suggested `kafaa_fs52_energy_transition_p1_tables_rls` and `_p2_functions_grants`), then the seed rows for the 4 new tables and the M19/M04/FS30 rows with `on conflict (id) do nothing`; compare the md5s and digests above.
3. HZ-5 lane (`lane-netzero`) and the MC-CLEAN-ENERGY definition could link back to `/skills/clean-energy` (owned by other modules; not edited here).
4. FS74 can read the overall level through `kafaa_cec_level(person)` / `cecLevel()`.
5. Decide whether and when to publish MC-H2-HEAT (left as a draft per the wave rules).
