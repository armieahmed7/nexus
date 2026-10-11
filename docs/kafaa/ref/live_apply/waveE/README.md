# Wave E live-apply bundle (FS38 to FS49)

Built from branch `fsE-integration` (fsEe1..fsEe5 merged `--no-ff` + `20261010259001_kafaa_fs5qa_integration.sql`) for the live
Supabase project `hlirqxoddysxtdezwcgv`. Apply each file with the Supabase `apply_migration` tool, **migration name = file name
without `.sql`**, in the order of `ORDER.txt` (also listed below). Every part is at most 60 KB and contains no DROP, TRUNCATE or
DELETE (not even in comments or strings).

## What is in it

| Part | Source | Contents |
|---|---|---|
| `kafaa_fs51_next_gen_p1`, `_p2` | `20261010251001_kafaa_fs51_next_gen.sql` | FS38-FS40 tables, RLS, functions, grants. **Shared `kafaa_skill_states_v2` / `kafaa_skills_apply` block (lines 178-277) stripped.** |
| `kafaa_fs52_energy_transition_p1` | `20261010252001_kafaa_fs52_energy_transition.sql` | FS41-FS43 tables, RLS, functions, grants (whole file). |
| `kafaa_fs53_lectures_localisation_p1`, `_p2` | `20261010253001_kafaa_fs53_lectures_localisation.sql` | FS44-FS45 tables, constraints, RLS, functions, grants. **Shared block (lines 139-240) stripped.** |
| `kafaa_fs54_future_leadership_p1`, `_p2` | `20261010254001_kafaa_fs54_future_leadership.sql` | `form_version` columns on the F16 360 tables (default 1), 11 tables, RLS, 4 F16 function redefinitions (same signatures), FS46-FS48 functions, the `mentoring` card update guarded by `version = 1` (a no-op live, see fs5qa), grants. |
| `kafaa_fs55_ai_safety_culture_p1` | `20261010255001_kafaa_fs55_ai_safety_culture.sql` (columns + backfill) | New columns on `kafaa_sc_traits`, `kafaa_hu_tools`, `kafaa_oe_lessons`; guarded backfill of hu-1..hu-8, trait-2, trait-5 (only rows still at the defaults). |
| `kafaa_fs55_ai_safety_culture_p2` | same file (content rules) | `kafaa_fs49_*` rule functions and the guard function, revoked from public/anon/authenticated. |
| `kafaa_fs5qa_integration_p1` | `20261010259001_kafaa_fs5qa_integration.sql` | The single final `kafaa_skill_states_v2` / `kafaa_skills_apply` body (recorded list = FS45 list + `plant_visits`, `twin_attempts`, `lectures`, `knowledge_assets`) and the additive FS48 update of the live `mentoring` engine card (see below). |
| `kafaa_fs5qa_seed_01` .. `_21` | `supabase/seed.sql` of the branch, restricted to rows whose id is not in `main`'s seed (827 rows) | `insert ... on conflict (id) do nothing`, FK order, `kafaa.seeding` on (built with `scripts/seed-chunks.mjs`). `person_skills` is left out on purpose: it comes from `kafaa_skills_apply` (step 5). |
| `kafaa_fs55_ai_safety_culture_p3` | same file as p1 (triggers) | `kafaa_fs49_hu_tools_guard` / `kafaa_fs49_oe_lessons_guard` BEFORE INSERT OR UPDATE triggers, created only if missing. Applied **after the seed**, once every existing HU card and lesson passes the content rule with references (the backfilled hu-1/3/4/5/7 point at lessons `oe-ai-*` that arrive with the seed). |

Seed rows per table: courses 2, hu_tools 4, oe_lessons 7, skill_evidence 113, pathways 2, pathway_steps 9, external_resources 5,
leadership_programmes 1, leadership_nominations 25, leadership_360_requests 120, leadership_360 105, leadership_behaviours 12,
fl_competencies 5, fl_external 7, fl_cohorts 3, fl_participants 20, wfn_programmes 3, wfn_participants 21, wfn_circles 6,
wfn_circle_members 29, wfn_offers 6, wfn_requests 17, lectures 17, contributions 27, localisation_items 16, smr_deltas 90,
plant_visits 27, twin_scenarios 5, twin_keys 5, twin_attempts 77, cec_competences 12, cec_role_targets 20, value_chains 3,
transition_tracks 2, credit_tags 4. Existing seed rows that changed on the branch change live only through the migrations
(new-column defaults, the fs55 backfill, the fs5qa card update) or through `kafaa_skills_apply` (person_skills).

## Order

1. Before anything: `md5(prosrc)` of `kafaa_skill_states_v2` = `074343638b13efe855f6f129473c1759` and `kafaa_skills_apply` =
   `55089400ce5b10d8c96481fdcc9c634f` (the FS45 bodies), and the four F16 functions = main's w2e5 bodies
   (`kafaa_lead_360_summary` 5ebb91ec..., `kafaa_lead_stats_compute` 1771d981..., `kafaa_request_360` 9c3f73ff..., `kafaa_submit_360` c7e732da...).
2. `kafaa_fs51_next_gen_p1`, `kafaa_fs51_next_gen_p2`, `kafaa_fs52_energy_transition_p1`, `kafaa_fs53_lectures_localisation_p1`,
   `kafaa_fs53_lectures_localisation_p2`, `kafaa_fs54_future_leadership_p1`, `kafaa_fs54_future_leadership_p2`,
   `kafaa_fs55_ai_safety_culture_p1`, `kafaa_fs55_ai_safety_culture_p2`.
3. Re-check step 1's two md5s, then `kafaa_fs5qa_integration_p1`.
4. `kafaa_fs5qa_seed_01` .. `kafaa_fs5qa_seed_21`.
5. `select kafaa_skills_apply(p, '2026-10-08')` for every person with evidence from `plant_visits`, `twin_attempts`, `lectures` or
   `knowledge_assets` (26 people in the seed).
6. Check that every row of `kafaa_hu_tools` and `kafaa_oe_lessons` passes
   `kafaa_fs49_hu_problems(to_jsonb(t), true)` / `kafaa_fs49_lesson_problems(to_jsonb(t), true)` (empty arrays); then
   `kafaa_fs55_ai_safety_culture_p3`.
7. Verify: function md5s against a PGlite build of the branch, table digests (handover 3.10), RLS on the 23 new tables, grants
   (anon executes nothing new; `kafaa_fs49_*` and the internal helpers not executable by API roles), security and performance advisors.

No credit-ledger replay (`kafaa_cr_sync`) and no gap-backlog refresh are needed: the branch's seed leaves the ledger and the
FS17 gap backlog unchanged (the 4 new credit tags have no completions yet).

## The mentoring engine card

The live `mentoring` card is at version 13 (weight changes since the seed bump it), so fsEe4's update (`where version = 1`) does
nothing live. `kafaa_fs5qa_integration_p1` adds the FS48 parts on top of the live card instead, only where
`src/modules/m22/future.ts#rankCircles` is not yet listed: it appends `rankCircles` and `rankOffers` to `scoring_functions`, appends
the `wfn_participants` input to `inputs_used`, appends the FS48 sentence to `limitations_en` / `limitations_ar`, and bumps
`version` by one (13 -> 14). Nothing already on the card is changed or removed; `last_change_id` (the last weight change) is kept.
The resulting functions, inputs and limitations are identical to the local seed's card; only `version` / `last_changed_at` differ
(the known live/local drift).

## Proven locally

A PGlite run of `main`'s 68 migrations + `main`'s seed (with the mentoring card set to version 13 as live), then this bundle in this
order, twice, then step 5, gives the same `md5(prosrc)` for all 1,107 `kafaa_*` functions, the same policies and triggers, and the
same table digests (count + md5 of `to_jsonb` rows ordered by id) as a PGlite build of the branch for every wave-E table and every
existing table the wave writes to; `person_skills` is equal on every column except `updated_at`.
