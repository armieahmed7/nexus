# fsBe4 · FS13 Future Me readiness that learning can move + FS14 Horizon lanes 2.0 (M21) — DONE

Branch `fsBe4`, worktree `/workspace/kafaa-fsBe4` (from master `80d05dc`), commit `a707de5`. Not pushed. Netlify not touched.
Live Supabase `hlirqxoddysxtdezwcgv`: additive kafaa_* objects and guarded kafaa_* data only. Verified live = local.

## Acceptance: FS13 (readiness rule v2, TS = SQL)
- [x] **Completing c-adv-intro raises the index for every family by a deterministic amount.** Rule: per ADVANCE skill, credit bp = round(10000·(54 − (6−c6)(3−d3)(3−l3))/54).
  - c6 is carry from today's skills via the FS04 map (transfers 2×L, adapts 1×L, capped).
  - d3 is a direct new-capability or FS02 skill.
  - l3 is recorded learning: a completed course at its level 1–2, a completed ADVANCE track at 1.
  - Zero-evidence person: family deltas [6.7, 13.3, 6.7, 8.3, 11.1, 6.7]. c-adv-intro raises every family for the 330 of 368 people who have not already learned it; the other 38 already hold it through the orientation track.
  - Covered by unit test AC1 and the PGlite validator.
- [x] **An index of 100 is reachable through evidence alone, in every family.** `fullEvidence`: 20 skills at L3 plus the learning. Unit test AC2 and PGlite.
- [x] **TS and SQL agree on every seeded person.** `kafaa_fm_readiness_of` = `readinessV2` for all 368 people (PGlite validator `fs24-future-readiness.mjs`). Live: the md5 of every person's overall score equals PGlite's.
- [x] Shows the carry ceiling and the learning ceiling, coverage, and ranked "what raises it". The +points on each card equal its preview exactly.
- [x] Before/after preview for any planned course. ADVANCE track steps move the index on screen.
- [x] SIMULATED label and "no deployment decision" note kept on every index.
- [x] Engine card F24 `future` is at version 2: inputs add the keyspace and learning; scoring functions name readiness.ts and `sql:kafaa_fm_readiness_of`.
- [x] Six FS04 keyspace rows give the ADAPTS-only skills a new-capability skill (FS02), and `adv_skills.sk_ids` are re-synced.
- [x] RBAC: skills_profile Own.
  - `kafaa_future_readiness()` raises 42501 otherwise.
  - The internal `kafaa_fm_readiness_of` is not executable by API roles.
  - Track progress uses own-row RLS and is written only by RPC. Each step is audited, with no ledger entry.

## Acceptance: FS14
- [x] **11 lanes, each with 3 or more sources and as-of dates.**
  - 5 F09 lanes reviewed (lane-netzero retitled "Net zero and low-carbon industry").
  - 6 new lanes HZ-6..HZ-11: robotics, ai-maint, manufacturing, hydrogen, grid, and fusion (a watch lane, awareness only, with no learning goal).
  - Enforced by check `kafaa_horizon_lanes_fs14_sources_ck` (via `kafaa_fs14_sources_ok`) and by TS `laneProblems`.
- [x] **All lane text passes publicTextIsClean** (lanes, milestones, links, lane resources, EN and AR).
- [x] **Interest aggregates under 10 are suppressed.** Goals follow the same rule. The grid lane (6) shows as suppressed on /workforce/future/interest.
- [x] Each lane lists FS02 skills (never security), courses, tracks, pathways, open gigs (open and listed only), and sources.
- [x] Lanes are placed now/next/later against 15 dated, sourced milestones. Board and Timeline tabs; the lane drawer deep-links via `?lane=`.
- [x] Interest in the new lanes feeds F26: resources are tagged with the new lanes, and the seeded future-demand snapshots equal the rules.
- [x] Benchmark chips: FS13 = SMR-WF, NEA, IAEA-WFP. FS14 = IAEA-AI, ENERGY-JOBS, SMR-WF, NEA.

## Routes (existing, extended)
- `/my/future`. Layout, in order:
  - Readiness hero with both ceilings
  - Families v2
  - What raises it, with preview modal
  - Planned learning
  - ADVANCE tracks, with step toggles
  - Bridge plan
  - Horizon lanes 2.0 (board/timeline, lane drawer)
  - Closest roles
  - Goals
  - Method
- `/my/future/:tech`: v2 breakdown (carry, new capability, learning, credit) and "what raises this family".
- `/workforce/future/interest`: 11 lanes with code, horizon and watch label; cells under 10 suppressed; FS14 chips.

## Tables / RPCs (migration `supabase/migrations/20261010224001_kafaa_fs24_future_readiness.sql`)
- `kafaa_horizon_lanes` gains `kind` (build|watch), `milestone_ids` and `as_of`.
- New tables:
  - `kafaa_horizon_lane_links`: public read.
  - `kafaa_horizon_milestones`: public read.
  - `kafaa_future_track_progress`: own read, RPC write.
- Functions:
  - `kafaa_fs14_sources_ok(jsonb)`
  - `kafaa_fm_readiness_of(text)` (internal)
  - `kafaa_future_readiness()`
  - `kafaa_record_track_step(text, int, bool)`
- TS: `rpc.futureReadiness()` and `rpc.recordTrackStep()`, with LocalBackend mirrors and Supabase mapping.
- Seed builder `scripts/seed/ext/fs13-future-me.mjs` adds 15 milestones, 6 lanes, 95 links, 78 track-progress rows, 78 lane interests and 14 lane goals. All people are synthetic.

## Live apply (hlirqxoddysxtdezwcgv)
- Migrations applied:
  - `kafaa_fs24_future_readiness_part1_tables_functions`
  - `..._part2_keyspace_card`
  - `..._part3a_lane_digital`
  - `..._part3b_lanes_sources`
  - `..._part3c_lane_netzero`
  - `..._part4_resources_check`
- Seed rows inserted with `on conflict do nothing`: milestones, 6 lanes, links, track progress, interest, goals.
- Verified live = PGlite (fresh branch). These digests all match:
  - md5 of the 4 function bodies (fm_readiness_of f368412f…, future_readiness 0fcddbdb…, record_track_step fff7f304…, fs14_sources_ok 67e2da2b…)
  - lanes 11:ac884ffd…
  - links 95:96a9613e…
  - milestones 15:3fa5870c…
  - track progress 78:d6a57fc5…
  - lane interest 78:ebcd060d…
  - goals 14:58371ac0…
  - keyspace 6:227d7377…
  - adv sk_ids 3ac25ef4…
  - resource lanes f8c0a384…
  - card 2:029bc2d7…
  - readiness of every person 5c217014…
- The live-apply path (master state + these parts, applied twice) was proven first on PGlite to give the same digests.
- Grants:
  - anon executes none of the functions.
  - authenticated executes only the two RPCs.
  - API roles have no table writes.
  - RLS is on all new tables.

## Tests and gates
- Unit tests:
  - `tests/unit/fs24-readiness.test.ts` (14 tests)
  - `tests/unit/fs24-lanes.test.ts` (11 tests)
  - `tests/unit/fs24-pages.test.tsx` (8 page tests, EN and AR)
- Validator `scripts/validate/fs24-future-readiness.mjs`: SQL = TS for 368 people, AC1/AC2, migration forward proof and idempotence, guards, RBAC, track flow, suppression, public text.
- Shared test updates (logged in the CONTRACT changelog):
  - m21-future (11 lanes)
  - m21-pages (11 lanes, AR title, goal inside the drawer)
  - w3e5 (fs13 tables)
  - fsqa1-integration (QA key count)
- Gate results:
  - gen: OK
  - check:i18n: OK (40 namespaces)
  - typecheck: OK
  - migrations:validate: "All migration checks passed"
  - check:public: OK (46 public tables)
  - build: OK
  - full unit suite: 1898/1899 on the first run (single worker); the one failure was a page test asserting async benchmark chips without waitFor under load. Fixed, and fs24-pages now passes 8/8

## Gaps
- The first combined apply of the lane review (titles + sources) was cancelled twice by the tool. The same guarded changes were applied in smaller parts, and the result matches local.
- Live F26 `demand_snapshots` (4 rows for 2027-Q1, "future" source) and proposal `sp-2027-q1-c-mnt-ic-1` still hold their pre-FS14 counts, because they are F26-owned derived rows. Seed and local show the new counts (for example c-ai-gov 37→51). F26's recompute (training manager) refreshes them live. Guarded SQL is ready in the scratchpad at `fsBe4_live/p4_f26.sql`.
- No Playwright run (not the integration lead).
