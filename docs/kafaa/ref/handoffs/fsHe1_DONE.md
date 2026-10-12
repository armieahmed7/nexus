# fsHe1 DONE: FS70 ENEC Skills on the Rise + manager pulse, FS71 Hot technologies and in-demand badges, FS72 "Skills you may have" (M28)

Branch `fsHe1`, cut from `origin/fsG-integration-qa` (wave G, not on `main`) and stacked on it. Owned files only, plus the logged shared edits
and the generated outputs. Live Supabase was not available: **nothing was applied live**. The migration is additive (`kafaa_*` only, no
removal words), idempotent (applied twice in PGlite), and redefines no function of another wave.

## Acceptance (one named unit test per criterion; SQL path in the PGlite validator)

| Criterion | Unit test (`tests/unit/fs81-skill-signals.test.ts` unless noted) | PGlite check (`scripts/validate/fs81-skill-signals.mjs`) |
|---|---|---|
| FS70: each listed skill shows which signals moved it | `FS70 AC1: each listed skill shows which signals moved it` (moved_by = moved cells, reasons, stored = rule); page: `fs81-pages` "FS70 page: staff see the latest list with each skill's signals, what moved it and why; past quarters stay" | "acceptance (FS70): each listed skill shows which signals moved it (moved_by, each with its reason)"; "FS70: every published list equals what the rule computes on the seeded data"; "FS70: SQL kafaa_rs_compute = TS risingSkills for 8 quarters and 3 malformed ones" |
| FS70: signals under 10 are suppressed | `FS70 AC2: signals under 10 are suppressed (never shown, compared or used to move a skill)` (seed cells + 9 vs 10 sources) | "acceptance (FS70): every signal under 10 is suppressed (no stored value or previous value under 10)"; "acceptance (FS70): the pulse is an aggregate only: 10 responses show a median, 9 show nothing ..." |
| FS70: the method page publishes how each signal is counted | `FS70 AC3: the method page publishes how each signal is counted (from the rule constants, EN and AR)`; page: "FS70 method page: publishes how each signal is counted, the thresholds and the pulse question (public)" | "refusal messages: SQL kafaa_fs81_msg = TS RS_MSG / HT_MSG / SSG_MSG" |
| FS70 publish (HR W/A, ended quarter, kept) + compute (Agg/R/W/A) | `FS70 compute and publish: ...`; page: "FS70 workbench: HR computes an ended quarter, publishes it after confirming, and reads the pulse as an aggregate" | "computeSkillSignals: ..."; "acceptance (FS70): publishSkillSignals: ..." |
| FS70 RBAC: staff R for the list; Agg for the pulse | `FS70 RBAC: staff read the published list; partners, observers and visitors do not`; `FS70 pulse: ... HR reads only the aggregate` | "RLS (FS70/FS71): staff read the published lists, technologies, tags and badges (internal_content R) ..."; "RLS (FS70): pulse answers are read by the manager who gave them only ..."; "managerPulseSummary: HR reads the aggregate (TS = SQL) ..." |
| FS70 manager pulse (line managers, 15 Sep to 15 Dec, again updates) | `FS70 pulse: ...` (fixed clock 2026-10-12 and 2026-12-20); `FS70 rule: pulse aggregates under 10 answers are suppressed ...`; page: "FS70 manager pulse: a line manager answers this year's question after confirming ..." | "submitManagerPulse: ..."; "SQL kafaa_mp_summary = TS pulseSummary for 2024-2026" |
| FS71: criteria are published and badges reproduce from them | `FS71 AC1: criteria are published and the badges reproduce from them`; page: "FS71 page: hot across ENEC is separate from in demand for my role, each with its counts and criteria; no brands" | "acceptance (FS71): the badges reproduce from the published criteria: SQL kafaa_ht_compute = TS technologyBadges for 8 quarters"; "FS71: every stored badge list equals what the criteria give on the seeded data" |
| FS71: no vendor brand name appears in a tag | `FS71 AC2: no vendor brand name appears in a tag (catalogue clean; a brand is refused by the rule and the RPC)`; page: "FS71 admin: a vendor brand is flagged in the form and never sent; a generic technology saves after confirming" | "acceptance (FS71): no vendor brand name in any of the 18 technology tags (deny-list of 76 names, EN/AR)"; "FS71: kafaa_ht_brand_hits = brandHits for 25 probes"; "FS71: kafaa_ht_problem = techProblem for 18 probes"; "acceptance (FS71): saveTechnology refuses a vendor brand name ..." |
| FS71: past badge lists are kept per quarter | `FS71 AC3: past badge lists are kept per quarter (a published quarter is never overwritten)` | "acceptance (FS71): past badge lists are kept per quarter ..." |
| FS71 tags + RBAC (staff R; frameworks W/A) | `FS71 tags: ...`, `FS71 RBAC: ...` | "tagTechnology: a tag takes its family and date from the source server-side ..." |
| FS72: no suggestion is readable by a manager (RLS test) | `FS72 AC1: no suggestion is readable by a manager (own rows only, RLS)`; page: "FS72 page: a manager sees only their own suggestions, never a team member's" | "acceptance (FS72): no suggestion is readable by a manager (sro reads 0 of k-ro's 7), HR, the training manager, admins or auditors; each person reads only their own" |
| FS72: an engine card and fairness snapshot exist for the surface | `FS72 AC2: an engine card and a fairness snapshot exist for the surface`; FS55 lint `fs63-engine-lint` green; `w3e5-no-protected-inputs` runner | "acceptance (FS72): the surface has an engine card (protected inputs excluded) and a fairness snapshot"; "acceptance (FS72): the fairness snapshot follows the F24 rules (SQL kafaa_ssg_fairness_compute = TS suggestionFairness = the stored rows ...)"; "runSuggestionFairness: ..." |
| FS72: a rejected suggestion does not return for 180 days | `FS72 AC3: a rejected suggestion does not return for 180 days (fixed clock)` (seed: hidden 2027-02-15, back 2027-02-16; local: day 179 hidden, day 180 back); page: "FS72 page: my suggestions with reasons; confirm adds claimed evidence; reject hides it for 180 days" | "acceptance (FS72): a rejected suggestion does not return for 180 days ..."; "FS72: SQL kafaa_ssg_candidates = TS inferSuggestions for all 106 active staff" on 2026-10-11, 2027-02-15 and 2027-02-16; check constraint (suppressed_until = responded_on + 180) |
| FS72 confirm -> claimed evidence; Own only until confirmed | `FS72 confirm: writes my claimed evidence (kind rating, ref_table skill_suggestions) and updates my skill state; answered once` | "acceptance (FS72): confirm writes k-ro's own claimed evidence ...; the manager sees the confirmed claim, never the suggestions" |
| FS72 sources, reasons, no protected input | `FS72 rule and seed: reasons per source, at most 6 open each, threshold 30, stored = rule, no protected input`; `w3e5-no-protected-inputs` (trapped rows) | "FS72: every stored open suggestion equals the rule on 2026-10-11 ..."; "FS72: every suggestion carries one reason per source ..." |
| FS72 aggregates (HR, never a person) | `FS72 stats: HR reads counts by status as an aggregate with every count under 10 suppressed` | "suggestionStats: ..." |
| Every page: `<BenchmarkChips feature="FS70/71/72" />`, `<WhyThis>` on listed/ranked items, EN + AR | `fs81-pages` (chips text, three Why this panels, Arabic render of three pages); `every reason, status and page text exists in English and Arabic; no secondary figure, no regulatory claim` | |
| Wiring: routes and Supabase mapping | `routes and guards`; `the Supabase backend maps every RPC to its kafaa_* function` | "grants: anonymous visitors cannot execute the 12 RPCs"; "internal helpers are not executable" |

## Routes (+7: 367 -> 374; route-count pins NOT touched)

| id | path | guard | nav |
|---|---|---|---|
| `skills-rising` | `/skills/rising` | signedIn, internal_content R (staff) | my / skills 18.92 |
| `skills-rising-method` | `/skills/rising/method` | public (`{}`) | child of skills-rising |
| `workforce-skill-signals` | `/workforce/skill-signals` | workforce_strategy Agg/R/W/A | my / workforce 68.9 |
| `my-manager-pulse` | `/my/manager-pulse` | transformation Scope (line managers) | my / team 40.9 |
| `skills-technologies` | `/skills/technologies` | signedIn, internal_content R (staff) | my / skills 18.93 |
| `admin-skills-technologies` | `/admin/skills/technologies` | anyRole admin, training_manager, instructor (writes need frameworks W/A) | admin 6.7 |
| `my-skills-suggestions` | `/my/skills/suggestions` | skills_profile Own | my / skills 18.06, parent my-skills |

## Tables and RPCs

- Tables (M28, RPC writes only): `skill_signal_runs`, `skill_signals`, `manager_pulse`, `technologies`, `technology_links`, `technology_badges`,
  `skill_suggestions`, `skill_suggestion_fairness` (RBAC in the CONTRACT changelog entry and `backend/schema.ts` header).
- RPCs (TS `backend/rpc.ts`, local `backend/local.fs70.ts`, SQL, Supabase `backend/supabase.ts`): `computeSkillSignals` -> `kafaa_compute_skill_signals(p_quarter)`,
  `publishSkillSignals` -> `kafaa_publish_skill_signals(p_quarter, p_summary_en, p_summary_ar)`, `submitManagerPulse` -> `kafaa_submit_manager_pulse(p)`,
  `managerPulseSummary` -> `kafaa_manager_pulse_summary(p_year)`, `saveTechnology` -> `kafaa_save_technology(p)`, `tagTechnology` -> `kafaa_tag_technology(p)`,
  `computeTechnologyBadges` / `publishTechnologyBadges` -> `kafaa_compute_technology_badges(p_quarter)` / `kafaa_publish_technology_badges(p_quarter)`,
  `refreshSkillSuggestions` -> `kafaa_refresh_skill_suggestions()`, `respondSuggestion` -> `kafaa_respond_suggestion(p_id, p_response)`,
  `runSuggestionFairness` -> `kafaa_run_suggestion_fairness(p_as_of)`, `suggestionStats` -> `kafaa_suggestion_stats()`. Authenticated only.
- Internal helpers (no API role may execute): `kafaa_fs81_msg`, `kafaa_rs_bounds`, `kafaa_rs_prev`, `kafaa_rs_computable`, `kafaa_rs_closed`, `kafaa_rs_counts`,
  `kafaa_rs_compute`, `kafaa_mp_median`, `kafaa_mp_summary`, `kafaa_ht_brand_hits`, `kafaa_ht_len`, `kafaa_ht_text`, `kafaa_ht_problem`, `kafaa_ht_window`,
  `kafaa_ht_compute`, `kafaa_ssg_candidates`, `kafaa_ssg_fairness_compute`.
- Cross-module writes, all inside my own SECURITY DEFINER RPCs: `kafaa_skill_evidence` (a confirmed suggestion: the person's own evidence kind `rating`,
  basis `claimed`, level <= 2, `ref_table skill_suggestions`) and the person's skill state through the existing recompute (not redefined), audit and
  ledger through `kafaa_audit` / `kafaa_ledger`. Engine card `skill_suggestions` inserted `on conflict (id) do nothing`.

## Live apply (for the session that applies wave H)

Migration `supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql` (DDL + checks + RLS, 29 functions, engine card insert, grants), after the
wave E, F and G bundles. Seed rows (load with `insert ... on conflict (id) do nothing`, `kafaa.seeding` on; `technologies` before `technology_links` and
`technology_badges`, `skill_signal_runs` before `skill_signals`): see the digests below. No guarded UPDATE of a live row.

## Local md5s and digests (PGlite: all migrations + generated seed, two passes; `md5(prosrc)` first 8 hex)

```
kafaa_compute_skill_signals=1e8e61a7 kafaa_compute_technology_badges=50f97367 kafaa_fs81_msg=f36cc436 kafaa_ht_brand_hits=717b733e
kafaa_ht_compute=7517f9aa kafaa_ht_len=97dc70f0 kafaa_ht_problem=bf2abbcb kafaa_ht_text=256d10d1 kafaa_ht_window=0a19af01
kafaa_manager_pulse_summary=ed040894 kafaa_mp_median=3dc34696 kafaa_mp_summary=da5c9752 kafaa_publish_skill_signals=2b6f5898
kafaa_publish_technology_badges=ff1bc2a1 kafaa_refresh_skill_suggestions=6e8933d2 kafaa_respond_suggestion=d3ced3e3 kafaa_rs_bounds=49c91f46
kafaa_rs_closed=49f20871 kafaa_rs_computable=2c185858 kafaa_rs_compute=b45304b8 kafaa_rs_counts=5534cc0f kafaa_rs_prev=2e1f6a68
kafaa_run_suggestion_fairness=363d195f kafaa_save_technology=ace61342 kafaa_ssg_candidates=db577fdd kafaa_ssg_fairness_compute=f7e78095
kafaa_submit_manager_pulse=989003aa kafaa_suggestion_stats=c8f3de55 kafaa_tag_technology=aee13dd1
```

Row digests (`count`, first 8 hex of `md5(string_agg(to_jsonb(t)::text, '|' order by t.id))`):

```
kafaa_skill_signal_runs 4 e00c7ec4
kafaa_skill_signals 31 a9bfb9c9
kafaa_manager_pulse 24 63d13152
kafaa_technologies 18 563849b4
kafaa_technology_links 188 dc091f76
kafaa_technology_badges 82 50c110d1
kafaa_skill_suggestions 442 d10a209b
kafaa_skill_suggestion_fairness 4 65f93e38
kafaa_engine_cards[skill_suggestions] 1 2fca6a8c
```

## Tests and gates

- `npm run gen`: OK ("fs70: 4 Skills on the Rise lists (31 rows), 24 pulse answers; 18 technologies, 188 tags, 82 badges over 2 quarters; 440 open
  suggestions for 88 people, 2 answered; 4 fairness rows; engine card skill_suggestions"; build-seed 36,668 rows across 348 tables); a second run leaves
  `seed.json`, `seed.sql`, `types.gen.ts` unchanged (md5 before = after).
- `npm run check:i18n`: OK (40 namespaces, EN/AR in parity).
- `npm run typecheck`: clean.
- `npm run migrations:validate`: "All migration checks passed" (2,343 checks; includes `fs81-skill-signals`, 45 checks). The two "stored = rule"
  checks compute on `seed.json` (in the full run earlier validators commit rows of their own, which made a DB-based comparison fail on the first try).
- `npm run check:public`: OK (75 public tables).
- `npx vite build`: OK (known chunk-size warnings).
- Unit tests, one file per vitest process (`TMPDIR=/dev/shm`, one worker): `fs81-skill-signals.test.ts` 21/21, `fs81-pages.test.tsx` 9/9. Directly
  affected files re-run: green `w3e5-no-protected-inputs` 71/71, `fs63-engine-lint` 13/13, `fs63-protected-inputs` 74/74, `fs63-taxonomy-governance`
  14/14, `fs63-pages` 11/11, `w3e5-transparency` 23/23, `w3e5-pages` 12/12, `fs21-crosswalk` 16/16, `fs21-pages` 12/12, `fs11-catalogue` 13/13, `fs12-decay`
  22/22, `fs24-readiness` 14/14, `fs25-future-roles` 10/10, `fs54-future-leadership` 20/20, `w3-integration` 12/12. Failing only on route/card-count
  pins left to the lead (expected 374 vs 367 routes; 35 vs 34 cards): `fs11-foundation` (1 of 19), `fsqa1-integration` (1 of 18), `fsqa2-integration`
  (1 of 13), `fsqa3-integration` (1 of 13), `fsqa4-integration` (1 of 10), `fsqa6-integration` (2 of 12), `fsqa7-integration` (1 of 13).
- Playwright/browsers not run (engineer slot).

## Decisions, gaps and hand-offs for the integration lead

1. **Pins:** route count 367 -> 374 (+7 M28) in `fs11-foundation`, `fsqa1..4-integration`, `fsqa6-integration`, `fsqa7-integration` (and the
   sweep / `w4`/`w5` pins if they count routes) and the engine-card count 34 -> 35 (`skill_suggestions`) in `fsqa6-integration` are left to the lead
   (they fail on this branch by design; the other wave-H slots add routes too). The M28-local route pin in `fs21-crosswalk` now excludes the seven
   FS70-FS72 paths (shared edit, marked).
2. **No engine card for FS70/FS71:** published rule outputs against published thresholds, kept per quarter; no per-person ranking. The FS72 world
   builder is named `ssgWorldFromTables` so the FS55 lint does not mistake it for a ranker.
3. **`suggestion_offered` and FS55:** the surface stores its own weekly snapshot (`kafaa_skill_suggestion_fairness`, F24 group rules, ids `ssf:*`);
   optionally fold the metric into `SURFACE_METRICS` so the FS55 job computes it with the others.
4. **FS75 coupling (data only):** latest `kafaa_skill_signal_runs` quarter, its `kafaa_skill_signals` rows whose `families` contain the reader's job family.
5. **Recorded evidence:** confirmed suggestions use the existing recorded kind `rating`; no kind or check widened, no shared recompute redefined; the four
   recorded-evidence invariant lists gain the token `skill_suggestions` (no seeded row uses it). No confirmed suggestion is seeded, so no F01 digest moves.
6. **Seed ordering:** `fs70-skill-signals.mjs` finalizes after fs68 and before fsqa*; it computes lists and tag links on the FS02-remapped role profiles
   (`remapRequirements` from fsqa1), because fsqa1 rewrites them later. If a later builder adds dated evidence, goals or opportunities, rerun gen: the
   validator fails when a stored list no longer equals the rule.
7. **Date sensitivity:** the pulse is open 15 Sep to 15 Dec; unit and page tests fix the clock (2026-10-12). The seeded suggestions are computed for
   2026-10-11; the k-ro rejection unhides on 2027-02-16.
8. **Not fixed here:** FS07 goals count by `created_at` (a goal without a target date still counts as "set").
9. **Benchmarks and figures:** chips only (FS70 LinkedIn, WEF, SkillsFuture; FS71 O*NET; FS72 skills-platform mechanics, LinkedIn); the WEF 39 % figure
   is secondary and appears nowhere. No regulatory authority is claimed.
