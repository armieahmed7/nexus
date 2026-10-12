# fsHe3 DONE: FS75 Future-skills nudges in the weekly digest (shell digest, `src/shell/digest/`)

Branch `fsHe3` (worktree `/workspace/nexus-fsHe3`, stacked on `fsG-integration-qa`). Live Supabase was not touched (not available). Netlify was not touched. Nothing was pushed to `main` or `fsG-integration-qa`.

## What it does

A new digest kind **`future`** ("Future skills"), urgency 3, ranked after every other kind and capped at **2 per digest**, so the 7-item cap, the urgency order, mutes, quiet hours, nudges off and the speak-up rule all hold as before. Seven topics, at most one item each (the best one), each with an internal deep link and `digest.why.*` reasons in EN and AR:

| Topic | Trigger (TS `src/shell/digest/future.ts` = SQL `kafaa_dg_future`) | Link |
|---|---|---|
| `decay` | a fast-class FS03 skill held at level 2+ whose newest evidence at that level passes its half-life within 60 days (dated) | `/my/skills/confidence` |
| `goal` | an FS33 dated goal due within 30 days (or up to 30 days overdue) and still below target (dated); else an FS07 goal with no dated plan: "give your goal a date" (closes the wave-D gap) | `/my/skills/goals` |
| `ai_literacy` | an FS36 published, listed AI system whose active, listed user group covers all staff or my family needs an FS09 rung or cells I do not meet | `/my/ai-fluency` |
| `role_profile` | my role's FS05 2030 profile published (v1) or changed (v2+) in the last 28 days, with the number of skill gaps | `/my/role-2030` |
| `rising_skill` | FS70: a growing skill on the latest Skills on the Rise list for my family, else (rows without families) one my 2030 profile or a goal asks for; held below level 2 | `/skills/:id` |
| `future_gig` | an open FS27 gig of the last 21 days that builds one of my future skills, not already in the digest as an opportunity match; none after a marketplace opt-out (F24) | `/opportunities/:id` |
| `pathway` | an FS17 pathway updated in the last 28 days, exactly one level above mine on a future skill (never past the target), not started | `/learn/pathways/:id` |

"My future skills" = my active FS07/FS33 goals plus the skill requirements of my role's 2030 profile above my level. **Approvals** also gain FS67 fellowship milestones submitted to me as the named supervisor (`/universities/fellowships/:id`; the wave-G hand-off). FS69 pre-arrival checks name no person to act, so they stay out (see gaps).

**Release gate:** every FS75 addition applies from `FS75_FROM = 2026-10-12` (first day of ISO week 2026-W42). For any earlier day the gatherer returns exactly the wave-G items: the 393 seeded digests (W38..W41, built on or before 2026-10-08 by `f36-digest.mjs`'s FINALIZE_LAST step) and every earlier parity check are unchanged, so **no guarded replay of seeded digests is needed**. Digests built live from W42 on carry the nudges (seeded data gives 199 FS75 candidates on 2026-10-12: role profile 86, AI literacy 75, pathway 33, fellowship 3, gig 2).

UI: future items show a topic line (dated for decay and goals); the `/my#digest` panel adds a "Future-skills nudges" strip (count, the 8 published rules in a disclosure, `<BenchmarkChips feature="FS75" />` = SG-CAREER, CORP); the nudge settings list "Future skills" as a mutable kind plus the published rules and chips; `/admin/digest` adds the rule line, the rules and the `future` row in items per kind (suppressed under 10). Full EN + AR (RTL logical classes, `useFormat`).

## Acceptance (card + adjustments)

- [x] **Still at most 7 items, and idempotent per period.**
  - Unit: `fs83-digest-nudges.test.ts` › "AC1: every digest on and after the release day keeps at most 7 items and at most 2 future-skills items, after every other kind"; "AC1: buildDigest twice in a period returns one run with the same items (idempotent), future items included, at most 7" (fixed clock 2026-10-12, LocalBackend).
  - PGlite: `fs83-digest-nudges.mjs` › "every digest keeps at most 7 items and at most 2 future-skills items, ordered by urgency"; "idempotent per period: two builds in 2026-W42 give one run with the same N items".
- [x] **No nudge on speak-up routes.**
  - Page: `fs83-pages.test.tsx` › "AC2: no nudge on speak-up routes: the digest panel and the bell card render nothing on /speak-up (EN and AR)" (with a control render on `/my`). The existing guard (`useNoNudges`, `noTelemetry`) is unchanged; `w5e5-pages` "never on /speak-up" still passes.
- [x] **Each new item has a deep link and a "why" in EN and AR.**
  - Unit: "AC3: every FS75 item links inside the app and has a title and reasons in both languages"; "AC3: every reason code and line of every topic exists in EN and AR (also the ones the seed does not reach yet)".
  - Page: "AC3: /my builds the week-42 digest with future-skills items, each with a deep link and a "why" (EN), at most 7 items"; "AC3: the same items read in Arabic (titles, lines and reasons), with links under /ar".
  - PGlite: "every FS75 item has an internal deep link, a title in EN and AR and reasons with digest.why keys".
- [x] **Respects existing preferences, quiet hours and the 7-item cap.** Unit: "preferences: "future" can be muted (and is then never built), expiry still cannot; quiet hours and nudges off still refuse"; page: "settings: "Future skills" is a mutable kind saved through the RPC, and the published rules are listed"; PGlite: "'future' can be muted (and then never shows); expiry still cannot be muted; unknown kinds are refused".
- [x] **New items (card):** role 2030 profile ("role_profile: ..."), rising skill ("rising_skill (FS70 data-only coupling): ..."), future gig or pathway ("future_gig and pathway: ..."), fast-decay lapse ("decay: ..."), AI-literacy requirement ("ai_literacy: ..."), all in `fs83-digest-nudges.test.ts`, plus PGlite "synthetic edge cases" (decay, dated goal, undated goal, FS70 rows, opt-out) and the per-topic checks.
- [x] **Adjustment: `kafaa_dg_gather` final body carries every earlier rule.** Redefined from the newest body (fs6qa, `20261010269001`, live md5 `1981fb9d` per waveF EXPECTED) plus one line appending `kafaa_dg_future`. PGlite: "before the release (2026-10-08, 2026-10-11): SQL = TS for 368 people x 2 days"; "release gate: no FS75 item on any day before 2026-10-12, so the seeded digests are unchanged"; `w5e5-digest-dalil.mjs`, `fsqa5`, `fsqa6`, `fs65` validators still green (concept-role exclusion, OJT, plant visits, role-play reviews).
- [x] **Adjustment: FS33 goals (wave-D gap) and FS36 requirements included.** Unit "goal (closes the wave-D gap): ..." and "ai_literacy: ...".
- [x] **Adjustment: seeded digests stable.** Unit "nothing FS75 adds appears before 2026-10-12, so the seeded digests (2026-W38..W41) are unchanged" (every seeded current digest equals a recompute with the full FS75 data); seed diff = the 8 new `digest_nudge_rules` rows only (checked table by table against the base `seed.json`).
- [x] **SQL = TS** on every person: PGlite "release day 2026-10-12, every person: SQL = TS for 368 people", "later days, every active staff member: SQL = TS for 106 people x 3 days", "synthetic edge cases ...: SQL = TS for 8 people x 4 days".
- [x] `<BenchmarkChips feature="FS75" />` on the digest panel strip and the nudge settings (no feature page of its own: FS75 is a digest extension, no route).

## Routes, tables, RPCs

- **Routes:** none added (the digest lives on `/my#digest`, `/my/settings#digest-settings`, `/admin/digest`). Route-count pins unchanged.
- **Table (new, 1):** `kafaa_digest_nudge_rules` (M14; read `public_content`; write `none`; seeded only): the published method rows. Policy in the per-statement (perf) form inside the migration.
- **New internal SQL function:** `kafaa_dg_future(text, date, jsonb)` (closed to every API role).
- **Shared redefinitions (in `20261010283001_kafaa_fs83_digest_nudges.sql`):** `kafaa_dg_gather` (fs6qa body + 1 line), `kafaa_dg_compose` (w5e5 body + `future`: rank 8, cap 2), `kafaa_set_digest_prefs` and `kafaa_digest_stats` (w5e5 bodies + `future` in the kind lists, 8 kinds). Signatures and grants unchanged; no new RPC (`buildDigest`, `setDigestPrefs`, `digestStats` keep their TS / local / supabase code).
- **No** new policy resource or grant, no evidence written, no engine card (published rules over the person's own records, nothing ranked), no `RECORDED_REF_TABLES` change.

## Local md5 (PGlite, `md5(prosrc)`) and table digest

| Function | Before (live expected) | After (fs83) |
|---|---|---|
| `kafaa_dg_gather` | `1981fb9db45ecdeb9c7f00f005c708cb` (fs6qa) | `348c20506e3134ec9c9ec8c5f2481fde` |
| `kafaa_dg_future` | (new) | `dda5cd099c9678b90ff82d8d2482cb8a` |
| `kafaa_dg_compose` | `186f0eb000d480c5f3532e483ad6c73d` (w5e5) | `057f34bc056b6d44728a65491591a51f` |
| `kafaa_set_digest_prefs` | `73847f6cc3a6a37d8951bc89ce69f2b8` (w5e5) | `b1ba391233325ff07fcd9e162f2dd7b8` |
| `kafaa_digest_stats` | `2a4cd85cbf80ca323dc0f7c73d94e83a` (w5e5) | `b0b74c7edc6e9c448a865db2536f62eb` |

Table digest (`count`, `left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)`): `kafaa_digest_nudge_rules` **8 rows, `7ca73787`**. No other table changes (seeded `kafaa_digest_runs` 393 and digest notifications unchanged).

Live apply (for the apply session): one part `kafaa_fs83_digest_nudges_p1` (the whole file, about 51 KB; no top-level `update`, no removal words), then the 8 `digest_nudge_rules` seed rows with `insert ... on conflict (id) do nothing`. No guarded row update. The migration applies before or after FS70 (it reads `kafaa_skill_signals` only through `to_regclass` + `to_jsonb`).

## Tests and gates

- Unit (one process each, `TMPDIR=/dev/shm`): `fs83-digest-nudges.test.ts` 16/16, `fs83-pages.test.tsx` 5/5; directly affected, all green: `w5e5-digest` 20/20, `w5e5-pages` 8/8, `w5-integration` 8/8, `fsqa5-integration` 16/16, `fsqa6-integration` 12/12, `w5qa-fixes` 7/7, `fs63-protected-inputs` 74/74, `fsqa1-integration` 18/18, `fsqa2-integration` 13/13.
- PGlite: `scripts/validate/fs83-digest-nudges.mjs` (all checks green); full `npm run migrations:validate`: **All migration checks passed** (exit 0, every validator incl. `fs83`). Cross-check with fsHe1's in-progress `20261010281001_kafaa_fs81_skill_signals.sql` and its 31 seeded `skill_signals` rows loaded into the same PGlite: every fs83 check green, SQL = TS on every person, 2 rising-skill nudges on 2026-10-12.
- `npm run gen` (no diff after commit), `npm run check:i18n` (40 namespaces, parity), `npm run typecheck`, `npm run check:public` (76 public tables), `npx vite build`: green.

## Gaps and hand-offs for the integration lead

1. **FS70 -> FS75 wiring (data-only):** the digest reads fsHe1's `skill_signals` shape as found in their worktree on 2026-10-12 (`quarter`, `skill_id`, `category` now|growing, `rank`, `families text[]`; latest quarter only). If fsHe1 renames a column, change the four field names in `future.ts` (rising block) and in `kafaa_dg_future` (rising block) together; `fs83-digest-nudges.mjs` builds stand-in tables of that shape only when FS70 is absent, so after the merge it runs against the real table (the run row + 4 signal rows it inserts are rolled back). Add a wiring test in fsqa8 once the seeded FS70 list exists (seeded rows dated before 2026-10-12 still produce nothing before the release day).
2. **Validator replay note:** `scripts/validate/fs25-future-roles.mjs` and `fsqa5-integration.mjs` replay the fs6qa migration on the shared PGlite database (it holds the previous `kafaa_dg_gather` body); `fs83-digest-nudges.mjs` therefore replays its own file first. A wave-H QA validator that checks digests after `fsqa5` should replay `20261010283001` (or the fs8qa file that supersedes it) the same way.
3. **Merge order note:** `kafaa_dg_gather` is redefined only here in wave H; if another wave-H branch also redefines it, the QA migration must carry this body + its block. `kafaa_dg_compose` / `kafaa_set_digest_prefs` / `kafaa_digest_stats` are redefined here for the first time since W5.
4. **Seed:** no rows were added to other modules' tables (FS33 goals are also an FS70 signal in this wave). The demo therefore shows decay and dated-goal nudges only once the clock reaches them (the earliest seeded lapse is in 2027; goal plans `w-lo-02` 2026-11-30 and `w-ro-02` 2026-12-15 enter the 30-day window in November). If the lead wants them on the release day, add FS33 goal plans for demo personas in the fsqa8 seed (dated after 2026-10-08) and rerun the FS70 signals.
5. **Pre-arrival checks (FS69)** are not in the digest: no person is named to act (any equivalency-A evaluator checks), and the F36 rule is "things I owe someone by name". If a reviewer queue is wanted, it needs an assignee column on `prearrival_shares` (M09) first.
6. **Live:** apply `20261010283001` as `kafaa_fs83_digest_nudges_p1`, load the 8 method rows, check the md5s and digest above; anon and authenticated must not execute `kafaa_dg_future`.
6. Route-count pins: unchanged by FS75 (no route).
