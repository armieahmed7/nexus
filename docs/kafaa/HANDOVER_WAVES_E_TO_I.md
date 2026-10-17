# Kafa'a future-skills programme: handover for waves E, F, G, H and I

Written 11 Oct 2026 (about 12:45 UTC) by the Claude session that built waves A to D, for a new Claude agent on a different account. You will not have that session, its scratchpad or its conversation. Everything you need is in this file, in the `ref/` folder beside it, and in the source tarball.

**Your job:** build the 47 remaining future-skills features **FS38 to FS84** in five waves (E, F, G, H, I) of up to five parallel engineers each, integrate and QA each wave, apply its SQL to the live Supabase project, and deploy each wave to the live Netlify site, using the process that worked for waves A to D (section 5).

**Ground rules in one breath:** synthetic people only; additive `kafaa_*` database objects only (no DROP, DELETE, ALTER or row changes on NEXUS objects); every feature in English and Arabic (RTL); both backends (local and Supabase) agree, proven in PGlite; aggregates under 10 suppressed; Kafa'a is never a regulator; every public fact links a source and an as-of date; never touch the `enec-nexus` Netlify site or `enecai.xyz`; never commit or paste secrets; deploy only with Armie's explicit go-ahead in your session.

---

## 0. Status at handover

| Item | State on 11 Oct 2026, about 12:45 UTC |
|---|---|
| Live site | https://enec-kafaa.netlify.app/kafaa/ (Netlify site `enec-kafaa`). Last confirmed deploy: FS wave C, deploy `6acb34f1a8d2f58a0a84915e`, 11 Oct about 07:15 UTC. |
| Wave D (FS27 to FS37) | Built by 5 engineers, applied live, merged into `master` (merge commits `4d6d854` to `de29ab3`). The wave-D integration lead was still running QA (E2E, fixes) at handover, with uncommitted edits on `master`. Armie asked for wave D to be finished and deployed, then a stop. |
| Waves E to I | Not started. This file is the plan. |
| Source | `/workspace/kafaa` in the old container, branch `master`, **no git remote**. You receive it as a tarball or bundle (section 2.1). |
| Database | Supabase project `hlirqxoddysxtdezwcgv` (shared with ENEC NEXUS). All migrations up to wave D are applied live, in parts. |

**Before you start wave E, run the Step 0 checks in section 2.9.** If wave D turns out not to be finished (no `ref/QA_D.md`, uncommitted changes in the tarball, or the live site does not show wave-D pages), finish wave D first with the integration prompt in section 5.3 (wave D, resume mode), then deploy it.

---

## 1. Mission and context

### 1.1 What ENEC NEXUS and Kafa'a are

- **ENEC NEXUS** is a concept "autonomous AI organisation" demo platform for ENEC, the Emirates Nuclear Energy Company (operator of the Barakah plant, UAE). It runs at https://enecai.xyz (Netlify site `enec-nexus`, id `69afeda6-b3fd-4de8-8173-af9fe3ba3327`) on Supabase project `hlirqxoddysxtdezwcgv`, with 43 demo role cards. It is **not affiliated with or endorsed by ENEC**. You must not change it.
- **Kafa'a (كفاءة)** is the people, skills and careers portal of NEXUS: careers, qualification mirrors, licensing support, training, assessments, talent pipeline, workforce analytics, partners, universities, safety culture and "Dalil", a governed AI guide. It is a Vite + React 18 + TypeScript + Tailwind single-page app served at `/kafaa/` (Arabic under `/kafaa/ar/...`). It reuses the NEXUS role-card session and writes material actions into the NEXUS evidence ledger. All data is synthetic or comes from public sources; every person is a role card or a synthetic worker.
- **The future-skills programme (FS01 to FS84)** adds 84 features in 12 themes, each tied to international benchmarks (WEF, OECD, ESCO, SFIA, IAEA, SkillsFuture, UAE Jahiz/NQF/MoHRE/Nafis and others, 40 in all). The full plan is `ref/PLAN.md`; every card for your waves is copied in full in section 4.

### 1.2 What is live

- **https://enec-kafaa.netlify.app/kafaa/**: the bare domain redirects to `/kafaa/` (302). Default backend: Supabase (live data). The backend chip in the header switches a browser to the offline `local` backend.
- Phase 2, mounting Kafa'a at `https://enecai.xyz/kafaa/`, has **not** been done (section 6).

### 1.3 What has been built

**Base build (8 to 10 Oct 2026):** a foundation, 5 module groups (M01 to M16), then 38 additional features F01 to F38 in waves 0 to 5 (`ref/BACKLOG.md`): skills core and engine kernel (F01, F02); skills passport, credential wallet, career navigator, roadmap, coach, opportunity marketplace, Future Me (F03 to F09); check-ins, team heatmap, career conversations, mentoring, refreshers, rotations, leadership journeys, communities (F10 to F17); talent review, succession, knowledge-loss risk, knowledge capture, handover board, alumni reserve, AI transparency and fairness (F18 to F24); training effectiveness, needs, SAT workbench, simulator scenarios, accreditation, xAPI learning record store, instructors (F25 to F31); micro-credentials, contractor passport, student journey, skills outlook, weekly digest, Dalil career mode, OJT logbook (F32 to F38).

**Future-skills waves A to D (10 to 11 Oct 2026):**

| Wave | Feature | One line |
|---|---|---|
| A | FS01 | Modules M28 to M37 registered, 7 policy resources, benchmark registry `kafaa_benchmarks` (40 benchmarks, 53 sourced figures), `<BenchmarkChips>` UI kit. |
| A | FS02 | Skills catalogue extended to 120 skills (49 future skills) with ESCO/SFIA-style taxonomy attributes, lifecycle and "obsolete, never delete" guard. |
| A | FS03 | Honest skill states: decay classes (18/36/60-month half-lives), working decay and confidence bands. |
| A | FS04 | One future-skill keyspace (`future_skill_map`, 70 rows) and a computed future-skills radar. |
| A | FS05 | 2030/2035 role profiles (`role_profile_versions`, 101) and 11 concept future roles. |
| A | FS06 | Task layer with AI exposure (OECD five-level capability) and change horizon. |
| B | FS07 | Skills Catalogue Explorer (`/skills`, `/skills/:id`). |
| B | FS08 | International crosswalk (`skill_alignments`) and CASE-shaped framework export. |
| B | FS09 | AI Fluency Ladder (rungs, role targets, dated organisation target). |
| B | FS10 | AI and Digital Fitness Check (adaptive items, evidence up to level 2). |
| B | FS11 | My Role in 2030: role transformation maps. |
| B | FS12 | Task exposure view: what the tool will do, what you still own. |
| B | FS13 | Future Me readiness that learning can move. |
| B | FS14 | Horizon lanes 2.0 (incl. green lane HZ-5). |
| B | FS15 | Future (concept) roles in the Navigator and Roadmap. |
| B | FS16 | Role outlook labels with published criteria. |
| C | FS17 | Future-skill learning pathways and a gap backlog (`pathway_gaps`). |
| C | FS18 | Curated, outcome-gated external catalogue. |
| C | FS19 | Future-skills course pack (incl. cross-over courses). |
| C | FS20 | Future-skills academies and cohorts (capstones). |
| C | FS21 | Adaptive future-skills assessment (banks, staircase). |
| C | FS22 | Performance tasks and integrity reports. |
| C | FS23 | Behaviourally anchored descriptors and generic level attributes. |
| C | FS24 | Scale mapping and an "Authority" recognition. |
| C | FS25 | Nuclear Critical Core Skills (M33 Human Skills Studio). |
| C | FS26 | Situational judgement practice. |
| D | FS27 | Future-skills gig channel (5 channels) with a quarterly time envelope. |
| D | FS28 | Future-role rotation templates and external secondments with knowledge-capture on return. |
| D | FS29 | Recognition of prior learning (maker-checker assessors, NQC-ready export). |
| D | FS30 | Indicative NQF levels and learning credits (1 credit = 10 notional hours), credit ledger. |
| D | FS31 | Future-skills micro-credentials with a strategic tier that unlocks gigs. |
| D | FS32 | CLR-shaped learner record with selective, expiring disclosure links. |
| D | FS33 | Skills I want to grow (dated goals, shareable with the manager). |
| D | FS34 | Transferable-skills translator for career-changers (12 ESCO occupations). |
| D | FS35 | Career Health check (Assess, Chart, Execute; five components, no hidden score). |
| D | FS36 | AI-literacy register per AI system, coverage computed from FS09 rungs. |
| D | FS37 | Governed AI sandbox drills (synthetic documents, evidence capped at level 2). |

### 1.4 Current numbers (master after the wave-D merges)

| Measure | Value |
|---|---|
| Routes | **288** (route-count pin in 6 places, see 3.11) |
| Modules | M01 to M37 (36 folders under `src/modules`; M15 is the bilingual foundation) |
| SQL tables (generated schema) | 292 (`kafaa_*`) |
| Seed | 33,531 rows across 289 tables, 57 personas (43 NEXUS role cards + 14 Kafa'a-only), 368 people (107 staff), 120 skills, 39 job roles (28 current + 11 concept), 40 benchmarks |
| Migrations | 69 files in `supabase/migrations/` (newest `20261010249001_kafaa_fs4qa_integration.sql`) |
| Unit tests | 134 files in `tests/unit` (about 2,300+ tests; wave C had 121 files / 2,176 tests) |
| PGlite validators | 54 files in `scripts/validate` |
| E2E specs | 13 in `tests/e2e` (sweep, journeys, visual, waves 1 to 5, FS waves A to D) |
| Route sweep | 288 routes x 17 sessions (about 4,900 checks) |
| Features built | 75 (F01 to F38, FS01 to FS37) |

---

## 2. Environment and access: checklist for Armie

Tick these before you hand the work over. The new agent cannot do them itself.

### 2.1 Package to send

- [ ] **The source with git history** (commands below), checked: the tarball has `.git`, and `git status` inside it is clean (if the wave-D integration left uncommitted work, see section 0).
- [ ] **This handover folder** (`HANDOVER_WAVES_E_TO_I.md`, `README_FIRST.md`, `ref/`). `ref/` holds `PLAN.md`, the audit, the four research packs, `BACKLOG.md`, QA reports `QA_A..C.md` (and `QA_D.md` if the wave-D lead finished), all 25 engineer hand-offs, the deploy docs, the workflow scripts and the QA helper scripts. It contains no secrets.
- [ ] Optional: copy `ref/` into the repo as `docs/fs/` in the new environment so engineer prompts can point at a path inside the repo.

Commands for the source package, run in the old environment (or ask the current session to run them):

```bash
cd /workspace
# .env.local holds the demo password: never ship it. node_modules, dist, deploy_out, test-results are rebuildable.
tar --exclude=kafaa/node_modules --exclude=kafaa/dist --exclude=kafaa/deploy_out \
    --exclude=kafaa/test-results --exclude=kafaa/.env.local -czf kafaa-src.tgz kafaa
# alternative with every branch: git -C kafaa bundle create /workspace/kafaa.bundle --all
```

### 2.2 Unpack and install

```bash
mkdir -p /workspace && cd /workspace && tar xzf kafaa-src.tgz      # or: git clone kafaa.bundle kafaa
cd /workspace/kafaa && git log --oneline -5 && git status
node -v      # the build used Node v22.22.0 (any Node 22 works); npm ci needs package-lock.json (present)
npm ci
cp .env.example .env.local   # then fill VITE_NEXUS_DEMO_PASSWORD (Armie gives it to you; never commit, never echo)
npm run gen && npm run check:i18n && npm run typecheck && npm run check:public   # quick health check
```

Main dependencies: React 18.3, React Router 6.28, Vite 5.4, TypeScript 5.6, Tailwind 3.4, Vitest 2.1, Playwright 1.56, PGlite 0.2 (`@electric-sql/pglite`, used by the migration validators), supabase-js 2.45.

### 2.3 Environment variables (`.env.example`; values that are not secret shown)

| Variable | Value / note |
|---|---|
| `VITE_KAFAA_BACKEND` | `supabase` (default) or `local`. Unit tests force `local` (vitest.config.ts). |
| `VITE_SUPABASE_URL` | `https://hlirqxoddysxtdezwcgv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | leave empty to use the built-in public anon key (already shipped in the NEXUS bundle by design) |
| `VITE_NEXUS_URL` | `https://enecai.xyz/` (target of NEXUS deep links off the NEXUS origin; the header has no "Back to NEXUS" link since 2026-10-13) |
| `VITE_NEXUS_DEMO_PASSWORD` | the shared NEXUS demo password. **`.env.local` only**, gitignored. Needed for supabase-mode E2E and for the deploy build (role cards sign in with it). Armie supplies it; it is not in the README and must not be invented or written into any file you commit, report or prompt. |
| `KAFAA_E2E_PASSWORD` | optional, for `scripts/e2e-supabase.mjs` (same password) |

### 2.4 Supabase (project `hlirqxoddysxtdezwcgv`)

- [ ] **Connect the Supabase connector** on the new account, signed in with a Supabase user who is a member of the organisation that owns `hlirqxoddysxtdezwcgv` (project name `enec-nexus`, region ap-south-1). Without it the agent can build and test locally but cannot apply migrations or verify live data.
- Tools used: `list_migrations`, `list_tables`, `execute_sql`, `apply_migration`. Nothing else is needed.
- **Rules (approved by Armie for this programme):**
  1. Additive `kafaa_*` objects and `kafaa_*` rows only. Never create, alter, drop or modify NEXUS objects or rows (anything not prefixed `kafaa_`, plus NEXUS ledger internals, which are written only through `nexus_append_ledger` called by `kafaa_ledger`).
  2. No DROP, no DELETE, no TRUNCATE. Migrations are idempotent (`create table if not exists`, `create or replace function`, guarded `update ... where`, `insert ... on conflict do nothing`).
  3. Validate every migration locally in PGlite first (`npm run migrations:validate`), then apply it live in parts with `apply_migration` (name `kafaa_fs<w><e>_<topic>_p1`, `_p2`, ...).
  4. Load seed rows with `insert ... on conflict (id) do nothing`.
  5. Verify live = local: function bodies (`md5(prosrc)`) and table digests (count + md5 of `to_jsonb` rows ordered by id). Snippets in 3.10.
- Do not pause, restore or branch the project. (Armie paused a different project earlier; leave project management to him.)

### 2.5 Netlify (site `enec-kafaa`)

- [ ] **Connect the Netlify connector** on the new account with a Netlify user in team **Mawaheb** (slug `armieahmed7`).
- Site: `enec-kafaa`, id **`24579361-38f3-42b5-87cd-6f7a6f75f046`**, URL https://enec-kafaa.netlify.app.
- **Update 2026-10-13 (final state):** the site is now **git-linked** to GitHub `armieahmed7/nexus` through the repo-root `netlify.toml` (base `kafaa`, `npm run build:deploy`, publish `deploy_out`, `NODE_OPTIONS=--max-old-space-size=4096`). A merge to `main` is a production deploy (about 2-3 minutes; Netlify posts no GitHub status, so confirm by watching the `assets/index-*.js` name on https://enec-kafaa.netlify.app/kafaa/). PRs into `main` get deploy previews. Production on 2026-10-13 serves `main` at `28d0456`, which holds waves E to I (#1 `bc02f10`, #2 `534dc4c`, #3 `5b5f348`, #4 `375b3ab`, #6 `0e7acdf`), the audit fixes (#5 `cad41fd`), persona sign-in (#7 `e61150c`) and the 390 px fix (#8 `28d0456`). The zip-upload procedure below remains only as a fallback (`make-deploy.mjs` copies the root `netlify.toml` security headers into `deploy_out/netlify.toml`, so a zip upload is served with the same headers). Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) and the one-year cache of `/kafaa/assets/*` live in the root `netlify.toml`; `make-deploy.mjs` fails the build when they are missing or when the inline scripts of `index.html` no longer match the CSP hashes. Current status of every wave, PR and live bundle: `ref/PROGRAMME_STATUS.md`.
- **Never touch** `enec-nexus` (id `69afeda6-b3fd-4de8-8173-af9fe3ba3327`, domains `enecai.xyz`, `enec-nexus.netlify.app`; published deploy `6abece0c8021c4c58397f533`). Reading it to confirm it is unchanged is fine.
- Never use the Netlify token that was pasted into a chat on 29 Sep 2026 (Armie was asked to revoke it).
- **Permission:** the Claude Code auto-mode classifier blocked deploys twice ("[Production Deploy]" on `deploy-site`, "[Data Exfiltration]" on the upload command) until Armie approved in the session. Armie's earlier standing approval was given to the old session; **ask Armie for an explicit "deploy" in your session** (or an allow rule for the `deploy-site` call and the upload command).

#### Deploy procedure (exactly as done for waves 1 to 5 and FS A to C; since 2026-10-12 a fallback only, see the update above)

**Step 1, build.** Run `npm run build:deploy` from final `master` with `.env.local` present. It runs gen, the i18n check, typecheck and `vite build`, then `scripts/make-deploy.mjs` assembles `deploy_out/`:

```
deploy_out/
  _redirects     / /kafaa/ 302
                 /kafaa /kafaa/ 301
                 /kafaa/.well-known/* /.well-known/:splat 200!     (issuer keys; must stay above the SPA rule)
                 /kafaa/assets/* /kafaa/asset-missing.txt 404     (stale chunks 404 so open tabs reload once; above the SPA rule)
                 /kafaa/* /kafaa/index.html 200
  netlify.toml   [build] publish = "."  command = ""
  .well-known/kafaa-issuer.json         (Netlify does not publish nested dot-folders such as /kafaa/.well-known/)
  kafaa/         index.html, favicon.svg, ojt-sw.js, issuer/kafaa-issuer.json, assets/*
```

**Step 2, pre-deploy checks.** `master` is clean and the build is newer than the last code commit. Both **badge-hiding lines** are present in `deploy_out/kafaa/index.html` (they come from the source `index.html`):

```html
<style>#nl-badge-frame,#nl-hud-frame{display:none!important}</style>
<div id="nl-badge-frame" hidden></div>
```

The issuer JSON is at `deploy_out/.well-known/kafaa-issuer.json` and `deploy_out/kafaa/issuer/kafaa-issuer.json`; `kafaa/ojt-sw.js` is present; `_redirects` has the four lines; `grep -rE "service_role|sb_secret_" deploy_out` finds nothing.

**Step 3, upload.** Call the Netlify MCP `netlify-deploy-services-updater` operation `deploy-site` with `siteId = 24579361-38f3-42b5-87cd-6f7a6f75f046`. It returns a one-time command `npx -y @netlify/mcp@latest --site-id <id> --proxy-path "<proxy url>"`. **Run it from `/workspace/kafaa/deploy_out`** so only that folder is zipped. The proxy URL is a 30-minute credential: never echo it into chat, reports or prompts. Netlify runs a "build" that publishes the folder as is, to production. Alternative with Armie's own auth: `npx -y netlify-cli@17.38.1 deploy --dir=/workspace/kafaa/deploy_out --site=24579361-38f3-42b5-87cd-6f7a6f75f046 --prod`.

**Step 4, verify.** `/` gives 302 to `/kafaa/`; deep links to the wave's new pages and their `/kafaa/ar/...` twins return 200; `/kafaa/issuer/kafaa-issuer.json`, `/kafaa/.well-known/kafaa-issuer.json` and `/.well-known/kafaa-issuer.json` return `application/json`; `/kafaa/ojt-sw.js` returns 200. Then headless Chromium: home with 0 console errors and the badge hidden; sign in with a role card (e.g. `nse` or `chco`) through Supabase; open 4 to 6 new pages (0 console errors, 0 4xx/5xx); the Arabic toggle gives `lang=ar`, `dir=rtl`. Confirm `enec-nexus` still publishes `6abece0c8021c4c58397f533`.

**Step 5, record.** Append a "Wave X deploy: DONE" section (deploy id, permalink, build, checks) to your copy of `ref/deploy/DEPLOY_DONE.md`.

### 2.6 Browser and Playwright

- Unit tests do not need a browser. The E2E suite (`playwright.e2e.config.ts`) and smoke suite (`playwright.config.ts`) need Chromium.
- The old container had Chromium preinstalled at `/opt/pw-browsers` (both configs set `PLAYWRIGHT_BROWSERS_PATH` to it) and forbade `playwright install`. In a new environment, use whatever Chromium is provided; if none is, `npx playwright install chromium` (for `@playwright/test` 1.56) is needed once, with Armie's approval if downloads are restricted.
- One browser, `workers=1`, against `vite preview` (port 4173) of a build made with `.env.local`. If Chromium crashes under memory pressure, add `--disable-dev-shm-usage`.

### 2.7 Memory, disk and turn limits

- The old container had about 16 GB RAM shared by all agents. Five engineers running vitest and PGlite validators at once caused OOM kills (exit 137) and cascading 1 ms test failures. **Run unit tests serially, one file per process, in chunks** (`npx vitest run --maxWorkers=1 --minWorkers=1 tests/unit/<file>`; see `ref/qa_scripts/unit.sh` and `lanes.sh`). Engineers run only their own and directly affected test files; the integration lead runs the full suite.
- Vitest leaves large SSR temp folders in `/tmp`; they filled the disk (ENOSPC) twice. Set `TMPDIR=/dev/shm` (or a scratch dir) for vitest and remove your own stale temp folders.
- `vitest.config.ts` already has `testTimeout: 90000` (the seed boot reads a 19 MB seed; 5 s defaults fail).
- Sub-agents have a turn limit: batch work into shell scripts (merge, gates, digests) instead of many one-off tool calls.

### 2.8 Demo logins

- **Supabase backend:** the 43 NEXUS role cards. Sign in at `/kafaa/sign-in` by picking a card; the app signs in to Supabase Auth as `<persona>@demo.enec-nexus.ae` with the shared demo password from `VITE_NEXUS_DEMO_PASSWORD` (Armie supplies it; do not invent or publish it).
- **Local backend:** all 57 personas sign in without a password (14 Kafa'a-only personas, marked `k-*`, exist only here: `k-ro`, `k-student`, `k-graduate`, `k-lo-trainee`, `k-instructor`, `k-licensing-coord`, `k-hr-analyst`, `k-contractor`, `k-university`, `k-observer`, `k-editor`, `k-ecp`, `k-admin`, `k-auditor`).
- Sweep sessions (17): anonymous; `nse` employee; `chem-sup` manager; `presenter` auditor; `chco` HR director/analyst; `training-mgr`; `sq-lead` instructor; `head-sustainability` editor; `ai-governance` admin; `sro` licensed operator; `rao` licensing coordinator; `alnoor-gm` partner admin; `alnoor-qaqc` partner user (all supabase); `k-student`, `k-university`, `k-observer`, `k-ecp` (local).
- Full persona table: `CONTRACT.md` section 9; grants in `src/seed/seed.json` (`personas`, `role_assignments`).

### 2.9 Step 0 for the new agent (before wave E)

1. Unpack and install (2.2). `git log --oneline -12` should show the wave-D merges (`4d6d854`..`de29ab3`) and, if the wave-D lead finished, a "FS wave D integration and QA" commit. `git status` should be clean.
2. Run the fast gates: `npm run gen` (no diff), `check:i18n`, `typecheck`, `check:public`, `migrations:validate`, `vite build`.
3. Supabase: `list_migrations` and check that the wave-D parts are present (`kafaa_fs41_p1..p5`, `kafaa_fs42_rpl_credits_p1..p5`, the `kafaa_fs43_*`, `kafaa_fs44_translator_health_part1..3`, `kafaa_fs45_ai_register_drills_part*` and the `kafaa_fs4qa_*` parts). Spot-check two digests from `ref/handoffs/fsDe*_DONE.md` (e.g. `kafaa_ai_drills` 7 rows `9eda2c19`, `kafaa_occupation_templates` 12 rows `419cdfff...`).
4. Live site: `curl -s -o /dev/null -w "%{http_code}" https://enec-kafaa.netlify.app/kafaa/opportunities/future` and check the bundle contains a wave-D string (e.g. "Career Health"). If wave D is not live, rebuild and deploy it (2.5) once Armie says go.
5. Create your notes folder (for example `/workspace/kafaa-notes/fs/`) and copy `ref/` there; prompts below call it `{{NOTES}}`.

---

## 3. Architecture and conventions

Condensed from `CONTRACT.md` (read sections 1 to 10 and the FS changelog entries in full before coding) and `ref/PLAN.md` sections 1 and 2. Where they disagree, CONTRACT's newest changelog entry wins.

### 3.1 Non-negotiables (PLAN section 1 + CONTRACT section 1)

- **Synthetic data only.** No real ENEC staff names or photos anywhere (seed, copy, screenshots, tests). People are role cards ("Training Manager (role card)") or synthetic workers (`w-*`, `p-*`).
- **No plant, OT, simulator or HR-system connection.** Plant data, twin series and budgets are seeded and labelled SIMULATED (`<SimChip>`).
- **No LLM key.** Every "AI" behaviour is deterministic or retrieval-based (rules, weighted scoring, BM25, cosine, graph search, adaptive item rules), returns `reasons[]` (checked by `lintRanked`), shows `<WhyThis>`, and sits behind the engine kernel with the disabled `ModelGatewayEngine` slot.
- **Additive `kafaa_*` objects only.** Idempotent migrations. NEXUS objects never altered or dropped.
- **Both backends agree.** Each RPC exists as (1) a TS signature in the module's `backend/rpc.ts`, (2) a LocalBackend implementation, (3) a SQL `SECURITY DEFINER` function `kafaa_<name>` with its Supabase mapping. A PGlite validator proves SQL = TS on the seed. Domain rule files stay import-free (node scripts import them directly).
- **EN and AR complete** (`npm run check:i18n` fails on a missing or empty Arabic key), logical RTL utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`; never `ml-`/`mr-`/`left`/`right`), Arabic-Indic digits and dates through `useFormat()`; new taxonomies carry `_en`/`_ar` columns rendered with `usePick()`.
- **Suppression:** any aggregate cell under `MIN_GROUP_SIZE` (10) shows "suppressed" (`suppress()` in `src/domain/rules.ts`, SQL aggregate RPCs). Protected inputs (gender, nationality, age proxies) never enter scoring; nationality appears only in suppressed Emiratisation aggregates (`tests/unit/w3e5-no-protected-inputs.test.ts`).
- **Security content stays out.** Security, safeguards and cyber roles appear at career-path level only, with qualified / not-qualified status. All-staff cyber hygiene is awareness content. Use the existing `security_restricted` / `restricted_kind` refusals.
- **Kafa'a is never a regulatory authority.** No FANR status, no licence claims; RPL, credentials and readiness screens carry the mirror / "not an authority" copy and pass the regulatory-wording check (`hasRegulatoryWording`, `maskFanr`, `NotAuthority` component in M34). ADVANCE and SMR content carries "no deployment decision implied", with no headcount or site text (`publicTextIsClean` in `src/domain/future.ts`).
- **Qualification work is never gamified.** Every public fact links a source and an as-of date (`<SourceLink>`); every benchmark figure is a sourced row in `kafaa_benchmarks`, never typed into copy.
- **Speak-up (`/speak-up`, M08) sends no analytics or audit events** (`noTelemetry: true`; the smoke test checks the network).
- **Secrets:** never commit the demo password; never paste tokens into code, tests, prompts or reports.
- **Git:** stage only files you changed (`git add <paths>`, never `git add .` / `-A`), do not push unless Armie asks, `--no-ff` merges.

### 3.2 Layout and ownership

```
src/modules/mNN/            routes.ts + one default-exported page per route; pure rules (*.ts, import-free);
                            backend/{schema,rpc,local,supabase}.ts merged through src/data/ext/*.ts hooks
src/i18n/mNN.{en,ar}.json   module strings; shared FS strings in src/i18n/fs.{en,ar}.json
src/ui/                     UI kit (Page, Section, Card, Grid, StatTile, Tabs, DataTable, charts, Benchmark.tsx, WhyThis, EngineBadge, SimChip, SourceLink, Async, ConfirmDialog...)
src/domain/                 shared pure rules: rules.ts (suppress, ...), skills.ts (F01 evidence model), taxonomy.ts (FS01/FS02),
                            benchmarks.ts, future.ts (publicTextIsClean, ...), careerGraph.ts, search.ts (BM25), engines/ (kernel)
src/data/                   repository (useRepo/useQuery/useAction), schema DSL (schema.ts), both backends, scope.ts (scopedPersonIds), ext hooks
src/auth/policy.ts          roles x resources matrix (rendered to docs/RBAC.md, loaded into kafaa_policy_matrix)
src/shell/                  layout, nav, notifications, Dalil launcher, digest (src/shell/digest/)
scripts/seed/ext/*.mjs      seed builders, auto-loaded in file-name order: default(T, ctx), then finalize(T, ctx)
scripts/validate/*.mjs      PGlite validators run by npm run migrations:validate
supabase/migrations/        SQL applied live in file order
tests/unit, tests/smoke, tests/e2e
```

- **New modules M31, M32, M35, M36, M37 are empty scaffolds** (registered by FS01 with empty `routes.ts` and `backend/` files, i18n files present). M28, M29, M30, M33, M34 already hold waves B to D work.
- **One engineer per folder per wave.** Engineers never edit shared routing files, other modules' folders, `src/ui`, `src/domain/*` (except a one-line, marked, logged widening where a pattern requires it, e.g. `RECORDED_REF_TABLES`), or `src/auth/policy.ts`. Need something shared? Put it in your module first and request promotion in your hand-off; the integration lead lands it.
- **Cross-module reads** are fine (import a pure rule read-only, or read the table). **Cross-module writes** go through the owning module's RPC; if none exists, add a `kafaa_*` `SECURITY DEFINER` RPC in your own migration and log it in the CONTRACT changelog (FS28 wrote M24 `capture_sessions` this way).
- Where things live that later cards depend on: F22 handover board = **M07** (`HandoverPage`, `handover_cohorts`); F31 instructors = **M02** (`/training/instructors`, `instructor_tracks`); F13 mentoring = **M04**; F16 leadership + F17 communities = **M22**; F19 succession = **M23**; F20/F21 knowledge = **M24**; F24 fairness and engine cards = **M16**; F25/F26 = **M25**; F30 xAPI = **M27**; F33 contractor passport = **M09**; F34 student journey = **M06**; F35 skills outlook = **M07** (`outlook.ts`); F36 digest = `src/shell/digest`; F37 Dalil career mode = **M13** (`career/`); F38 OJT = **M02**.

### 3.3 Routes

- Declared in `src/modules/mNN/routes.ts`: `{ id, path, module, zone, guard, nav?, parent?, spec, component }`. Ids are stable i18n keys (`mNN.routes.<id>.title|purpose`) and test ids. Paths are written without `/kafaa` and `/ar`; link with `<L to>`, `href('route-id', params)`, `useNav()`.
- Param routes need sample params in `src/modules/mNN/smoke.json` (`{ "<route-id>": { "<param>": "<seed id>" } }`) so the smoke suite and the sweep can visit them.
- Guards: `{}` public; `{ signedIn: true }`; `{ anyRole: [...] }`; `{ grant: { res, levels } }`; `noTelemetry` for speak-up. Deny by default; denied visits are logged through `logDenied`.
- Every page: `<Page title intro>`, loading / empty / error states (`<Async>`, `EmptyState`, `ErrorState`, `Skeleton`; note `<Async>` treats `[]` as empty, so pass a non-empty wrapper when an empty list is a valid result), `data-testid="mNN-<thing>"` on the primary list and actions, `<ConfirmDialog>` before every consequential RPC, `<BenchmarkChips feature="FSnn" />`, `<WhyThis>` on every ranked item.

### 3.4 Data access and RPCs

- Pages use only `useRepo()` / `useQuery()` / `useAction()`. Never import a backend or `@supabase/supabase-js` in a module.
- Tables are declared in the module's `backend/schema.ts` (DSL from `src/data/schema.ts`): columns, read rules, write mode (`direct`, `rpc`, `append`). `npm run gen` regenerates `src/data/types.gen.ts`, `supabase/migrations/20261008120100_kafaa_schema.sql`, `...120300_kafaa_rls.sql`, `supabase/seed.sql`, `src/seed/seed.json`, `docs/RBAC.md`. **Never hand-edit generated files**; on a merge conflict take either side and re-run `npm run gen`.
- Consequential actions are RPCs returning `Result { ok, code, message, audit_seq, ledger_seq, data }`; business refusals never throw. SQL side: `set search_path = public`, refusals via `kafaa_refuse`, audit via `kafaa_audit` (one hash-chained `kafaa_audit_events` row per call, also on refusals), ledger via `kafaa_ledger(action, reason)` for material actions, result via `kafaa_result`. Revoke from `public, anon`; grant to `authenticated`; internal helpers revoked from every API role.
- Read rules: holding R/W/A on a resource reads **every row** of a table whose rule names that resource. Personal rows need Own/Scope/OwnOrg rules or an always-false `open_read` column (see the header of `src/modules/m24/backend/schema.ts`).
- Manager-scope reads of large person-keyed tables: narrow with `scopedPersonIds` (`src/data/scope.ts`); an unscoped read took 8.2 s live and hit the statement timeout in wave C.

### 3.5 SQL = TS, PGlite validators and seed builders

- Pure rule in `src/modules/mNN/<rule>.ts` (import-free) = SQL function, proven in `scripts/validate/fs<w><e>-<topic>.mjs`: apply all migrations + seed to PGlite (twice, for idempotence), then compare rule outputs for every seeded case plus generated edge cases, check RLS per persona, refusals, audit/ledger rows, grants, and that the migration has no DROP/DELETE/ALTER of non-kafaa objects. Wave D validators (`fs41`..`fs45`) are the best templates.
- Seed builder `scripts/seed/ext/fsNN-<topic>.mjs` (NN = the lowest feature number you own): `export default function (T, ctx)` adds rows; optional `finalize(T, ctx)`; `FINALIZE_LAST` builders run after the rest. Builders load in file-name order (`f01...` < `fs01...` < `fs84...` < `fsqa1...`). Stable, readable ids; every public fact has `sources`; seed dates at or before 2026-10-11 and **after 2026-10-08 only when you deliberately want seeded digests (dated 2026-10-08) unchanged**.
- Seeds must be honest, not tuned (e.g. FS35 reports most personas as "act" on recency, and that is fine).

### 3.6 Naming for waves E to I

Wave digit w: A=1, B=2, C=3, D=4, **E=5, F=6, G=7, H=8, I=9**; engineer e = 1 to 5.

| Artefact | Pattern | Wave E, engineer 1 example |
|---|---|---|
| Migration | `supabase/migrations/202610102<w><e>NNN_kafaa_fs<w><e>_<topic>.sql` | `20261010251001_kafaa_fs51_next_gen.sql` |
| Live migration parts | `kafaa_fs<w><e>_<topic>_p1`, `_p2`, ... | `kafaa_fs51_next_gen_p1` |
| Validator | `scripts/validate/fs<w><e>-<topic>.mjs` | `fs51-next-gen.mjs` |
| Unit tests | `tests/unit/fs<w><e>-*.test.ts(x)` | `fs51-next-gen.test.ts`, `fs51-pages.test.tsx` |
| Seed builder | `scripts/seed/ext/fsNN-<topic>.mjs` (feature number) | `fs38-next-gen.mjs` |
| Wave QA migration | `202610102<w>9001_kafaa_fs<w>qa_integration.sql` | `20261010259001_kafaa_fs5qa_integration.sql` |
| Wave QA seed / validator / test | `scripts/seed/ext/fsqa<w>-integration.mjs`, `scripts/validate/fsqa<w>-integration.mjs`, `tests/unit/fsqa<w>-integration.test.tsx` | `fsqa5-...` |
| E2E journeys / visual | `tests/e2e/fswave<W>.spec.ts`; `visual.spec.ts` block `-g fs<w-letter>` with `KAFAA_SHOTS_FS<W>` | `fswaveE.spec.ts`, `-g fse` |
| Branch / worktree | `fs<W>e<e>`, `/workspace/kafaa-fs<W>e<e>` | `fsEe1` |
| Hand-off | `{{NOTES}}/fs<W>e<e>_DONE.md`; wave QA report `{{NOTES}}/QA_<W>.md`; screenshots `{{NOTES}}/shots_<W>/` | `fsEe1_DONE.md`, `QA_E.md` |

Watch the name overlap: seed builders use feature numbers while validators and tests use wave+engineer digits (`scripts/seed/ext/fs41-*` will be FS41 CleanEnergyComp; `tests/unit/fs41-future-gigs.test.ts` is wave D engineer 1). Use distinct topics.

### 3.7 RBAC and policy resources

- Levels: `R`, `Own`, `Scope`, `Agg`, `W`, `A`, `OwnOrg`, `OrgW`. Roles: public, applicant, employee/trainee, licensed_operator, manager, instructor, training_manager, licensing_coord, hr_analyst, hr_director, partner_user, partner_admin, university, observer, editor, ecp_officer, admin, auditor.
- FS resources (added by FS01, in the live matrix): `skills_taxonomy` (everyone R; staff W; training_manager / hr_director / admin A; auditor R), `ai_literacy` (staff R/Own; HR Agg; training_manager W; admin A; auditor R), `transformation` (staff R/Own; manager Scope; training_manager W; HR Agg; hr_director W/A; auditor R), `recognition` (staff Own; manager Scope; instructor and training_manager A; HR Agg; hr_director A; auditor R), `workforce_strategy` (hr_analyst Agg/W; hr_director Agg/W/A; training_manager Agg; admin R; auditor R; never public or staff), `ecosystem` (staff R/Own; partner_user R/OwnOrg; partner_admin and university R/OwnOrg/OrgW; HR Agg/W, hr_director A; admin A; auditor R), `national_alignment` (staff R; hr_analyst Agg; hr_director W; admin W/A).
- Existing resources used by these waves include `skills_profile`, `opportunities`, `knowledge`, `learning_analytics`, `workforce_analytics` (**note: grants observer Agg and manager Agg**), `frameworks`, `sat`, `lrs`, `talent_review`, `public_content`, `internal_content`.
- M31 and M32 have no resource of their own: use `skills_taxonomy` R for public/staff reads and `frameworks` W/A for edits unless a card says otherwise, and log the choice.
- A new grant or resource is a foundation change: request it in the hand-off; the integration lead edits `src/auth/policy.ts`, runs `npm run gen`, and inserts the new `kafaa_policy_matrix` rows live (additive).

### 3.8 Benchmarks, engines and explanations

- `kafaa_benchmarks` (FS01, 40 rows, public where `listed`) holds each benchmark's EN/AR name, owner, years, https URLs, as-of, fact, "what we borrow", 53 sourced `figures`, and `feature_ids`. `FEATURE_BENCHMARKS` (`src/domain/taxonomy.ts`) maps FS01 to FS84 to their ids. UI: `<BenchmarkChips feature="FSnn" />`, `<BenchmarkChip id>` (drawer with sources), `<BenchmarkLine value max label benchmark={{ id, figure }}>`; data through `useBenchmarks`.
- Engine kernel `src/domain/engines/`: `byGapClosure`, `byCoOccurrence`, `byCosine`, `careerMoves`, `coursesForGaps`, `readiness`, `lintRanked`, `SkillsEngine`, `ModelGatewayEngine` (disabled slot), `resolveEngine`/`makeEngine`; FS surfaces `transform`, `assess` (`future.ts`: `taskExposure`, `nextItem`). `useEngine(surface)` from `src/data`; `<WhyThis>`, `<EngineBadge>` from `src/ui`. Engine settings table `engine_settings` keeps a four-value `surface` check (widening needs a drop), so new surfaces are defaults-only (`FS_SURFACES`).
- Every new ranking surface needs an engine card (`kafaa_engine_cards`, M16) and fairness snapshots (FS55 adds a lint test in wave F).

### 3.9 Skill evidence: the recorded-evidence rule (read this before any feature that writes evidence)

- F01 evidence model (`src/domain/skills.ts`): `kafaa_skill_evidence.kind` is a fixed enum **`qual|course|assessment|jpm|rating|ojt|credential`**, basis `verified|evidenced|validated|claimed`. The check cannot be widened (it would need a DROP). New evidence sources use an existing kind plus their own `ref_table` (FS10 `fitness_attempts`, FS21 `adaptive_attempts`, FS22 `task_attempts`, FS20 `cohort_capstones`, FS29 `rpl_requests`, FS31 `microcred_awards`, FS37 `ai_drill_attempts`).
- Recomputes rebuild derived evidence and keep recorded evidence. A new `ref_table` whose rows must survive recomputes is added to:
  1. `RECORDED_REF_TABLES` in `src/domain/skills.ts` (and the literal in `scripts/seed/ext/f01-skills.mjs`),
  2. the SQL lists inside `kafaa_skill_states_v2` and `kafaa_skills_apply` (redefined with `create or replace`; **the newest redefinition must carry the full list**, currently ending with `'ai_drill_attempts'` from FS37),
  3. the shared "no derived future-skill state" invariants: `tests/unit/fs11-catalogue.test.ts`, `tests/unit/fsqa1-integration.test.tsx`, `scripts/validate/fs11-foundation.mjs`, `scripts/validate/fsqa1-integration.mjs` (and literals in `fs12-decay`, `w0-skills` tests/validators).
- When several engineers in one wave add ref tables, each adds its own token on its branch; the integration lead **unions** the lists during the merge (`ref/qa_scripts/merge.sh` shows the token substitution) and writes the one final redefinition in the wave QA migration. Before applying a redefinition live, compare the live body md5 with the previous local body (FS37 did this).
- After writing evidence live, run `kafaa_skills_apply(person, date)` for the affected people and compare states with local.

### 3.10 Live verification snippets

```sql
-- function bodies (compare with the same query in PGlite after migrations:validate's setup)
select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'kafaa\_%' and p.proname in ('kafaa_x','kafaa_y') order by 1;
-- table digest
select count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) from public.kafaa_x t;
-- grants: anon must execute nothing new; authenticated only the public RPCs
select routine_name, grantee from information_schema.routine_privileges
 where routine_name like 'kafaa\_fs5%' and grantee in ('anon','authenticated') order by 1, 2;
```

Compute the same digest locally in PGlite over the generated seed (the validators' setup does this). Known benign differences: `kafaa_dalil_turn`, `kafaa_signoff_evaluation`, `kafaa_log_denied` differ live only by stripped comments; `engine_cards` rows for experts / marketplace / mentoring / rotations differ (pre-existing); tables touched by E2E journeys hold extra live rows (section 6).

### 3.11 Gates and exact commands

| Gate | Command | Notes |
|---|---|---|
| Generate | `npm run gen` | must leave no diff after commit |
| i18n parity | `npm run check:i18n` | EN/AR keys in parity, no empty Arabic |
| Types | `npm run typecheck` | `tsc --noEmit` |
| Unit tests | `npx vitest run --maxWorkers=1 --minWorkers=1 tests/unit/<file>` per file (integration lead: all files, in chunks) | `npm run test:unit` runs everything at once; avoid it in a shared container |
| Migrations | `npm run migrations:validate` | all PGlite validators; can take 20+ minutes; a full run hit a 1,500 s timeout under load once; rerun the failing validator alone |
| Public payloads | `npm run check:public` | no names, emails or photos in public payloads; benchmarks and skills cite https sources |
| Build | `npx vite build` (or `npm run build`) | chunk-size warnings are known |
| Smoke | `npm run test:smoke` | Playwright, every route as anon, `k-ro`, `training-mgr`, `alnoor-gm`, and in Arabic; includes the accessibility gate |
| Accessibility | `npx playwright test tests/smoke/a11y.spec.ts` (after a build) | axe-core WCAG 2.0/2.1 A + AA on every public route (EN 1280 px, AR 390 px) and one signed-in page per module per persona (ten local-backend personas); serious/critical fail, the rest are annotations; `KAFAA_A11Y_FULL=1` checks every signed-in route EN + AR (about 660 page views); `KAFAA_A11Y_OUT=<dir>` writes JSON per page |
| Deploy build | `npm run build:deploy` | integration lead / deployer only |
| Everything | `npm run verify` | gen, i18n, typecheck, unit, migrations, public, build, smoke |
| E2E sweep | `npm run build && E2E_ONLY=<personas> E2E_MODULES=<M31,...> npx playwright test -c playwright.e2e.config.ts tests/e2e/sweep.spec.ts` | `E2E_ONLY` filters sessions (comma list), `E2E_MODULES` filters modules; output in `KAFAA_QA_OUT` |
| Journeys | `npx playwright test -c playwright.e2e.config.ts tests/e2e/fswave<W>.spec.ts` | |
| Visual | `npx playwright test -c playwright.e2e.config.ts tests/e2e/visual.spec.ts -g fs<w>` | RTL and 390 px shots; check contact sheets by eye |

**Route-count pins** (integration lead only; currently 288): `tests/unit/w4-integration.test.tsx`, `tests/unit/w5-integration.test.ts`, `tests/unit/fs11-foundation.test.tsx`, `tests/unit/fsqa1-integration.test.tsx`, `tests/unit/fsqa2-integration.test.tsx`, `tests/unit/fsqa3-integration.test.tsx`, `tests/unit/fsqa4-integration.test.tsx`, `tests/e2e/sweep.spec.ts` (`expect(ROUTES.length).toBe(288)` with a comment listing each wave's additions). `grep -rn "288" tests/` finds them.

Known pre-existing test quirks: `g1-pages` "a shift supervisor sees crew availability" is date-dependent (M03 licence source sync stale from 2026-10-11) and fails on the base commit too; `w5qa-integration` validator fails only when run alone.

---

## 4. Wave-by-wave build plan (waves E to I)

Each wave below has: the five engineer slots (folder ownership and file names), the cross-feature hand-offs the integration lead must wire, the wave QA checklist, and then **every feature card copied in full from `ref/PLAN.md`**, followed by **Adjustments learned from waves A to D** (tables that now exist, names that changed, pitfalls, and known gaps the card should close). Where an adjustment contradicts the card, the adjustment wins. "Depends on" lists only earlier waves or an earlier card of the same engineer; F-numbers are the base features (`ref/BACKLOG.md`), FS-numbers the future-skills features.

Totals: wave E 12 features, F 10, G 10, H 8, I 7 = **47 features**. Priority mix across E to I: P1 12, P2 28, P3 7 (from the cards).


### Wave E (digit 5): Next-gen nuclear, energy transition, safety culture (12 features)

Domain depth: the SMR delta per role, plant literacy for everyone, digital-twin drills, CleanEnergyComp, the energy-system pathway, ESG literacy, expert lectures as evidence, the localisation countdown, future leadership, women in future nuclear skills and safety culture for an AI-augmented plant.


#### Wave E engineer slots

| Slot | Folder (owned) | Features | Migration | Seed builder | Validator / tests | Note |
|---|---|---|---|---|---|---|
| fsEe1 | `src/modules/m31` | FS38, FS39, FS40 | `20261010251001_kafaa_fs51_next_gen.sql` | `scripts/seed/ext/fs38-next-gen.mjs` | `scripts/validate/fs51-*.mjs`, `tests/unit/fs51-*` | Next-Gen Nuclear Readiness: new module, empty scaffold |
| fsEe2 | `src/modules/m32` | FS41, FS42, FS43 | `20261010252001_kafaa_fs52_energy_transition.sql` | `scripts/seed/ext/fs41-clean-energy.mjs` | `scripts/validate/fs52-*.mjs`, `tests/unit/fs52-*` | Energy Transition Skills: new module, empty scaffold; pathway rows go into M19 tables as seed rows |
| fsEe3 | `src/modules/m24` | FS44, FS45 | `20261010253001_kafaa_fs53_lectures_localisation.sql` | `scripts/seed/ext/fs44-lectures-localisation.mjs` | `scripts/validate/fs53-*.mjs`, `tests/unit/fs53-*` | Knowledge continuity (F20/F21 live here) |
| fsEe4 | `src/modules/m22` | FS46, FS47, FS48 | `20261010254001_kafaa_fs54_future_leadership.sql` | `scripts/seed/ext/fs46-future-leadership.mjs` | `scripts/validate/fs54-*.mjs`, `tests/unit/fs54-*` | Leadership and communities (F16/F17) |
| fsEe5 | `src/modules/m08 (+ M08 block of src/data/schema.ts)` | FS49 | `20261010255001_kafaa_fs55_ai_safety_culture.sql` | `scripts/seed/ext/fs49-ai-safety-culture.mjs` | `scripts/validate/fs55-*.mjs`, `tests/unit/fs55-*` | Safety culture; no backend folder; speak-up must stay telemetry-free |

Wave QA: `supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql`, `scripts/seed/ext/fsqa5-integration.mjs`, `scripts/validate/fsqa5-integration.mjs`, `tests/unit/fsqa5-integration.test.tsx`, `tests/e2e/fswaveE.spec.ts`, visual block `fse`.


#### Wave E cross-feature hand-offs to wire (integration lead)

- **Recorded evidence union (3.9):** FS39 (`plant_visits`), FS40 (`twin_attempts`) and FS44 (`lectures` / `knowledge_assets`) each add a ref table. Union the tokens during the merge and write the single final redefinition of `kafaa_skill_states_v2` / `kafaa_skills_apply` in `20261010259001_kafaa_fs5qa_integration.sql`.
- **FS38 -> FS13/FS14 (M21) and FS19/FS31:** link Future Me lanes and the ADVANCE pages to `/my/next-gen`; delta training points at `MC-SMR-FOUND`, FS19 cross-over courses and FS17 pathways.
- **FS40 -> FS31/FS27/FS17:** list twin drills as a route for `MC-TWINS` (`satisfiability()`), on gig `fg-dig-twin-validation`, and (optional) in pathway step discovery (`kafaa_pw_discover`, wave-C pattern).
- **FS41 -> FS14 / FS31 / FS74:** green lane HZ-5 links to CleanEnergyComp; `MC-CLEAN-ENERGY` criteria cite the competences; export the CEC level rule for FS74 (wave H).
- **FS42/FS43 -> FS17/FS30/FS31:** new pathways validate with `pathwayProblems()`; any new or newly published micro-credential (e.g. `MC-H2-HEAT`) gets an FS30 credit tag (`ensureCreditTags`) and the credit ledger is rebuilt (`kafaa_cr_sync` live), as wave D did.
- **FS17 gap backlog:** if new content fills pathway steps, replay `refreshPathwayGaps` live with guarded updates (wave C/D pattern; no DELETE) and update the `fsqa3`/`fsqa4` expectations.
- **FS45 -> F22 (M07):** overdue localisation items appear on `/workforce/handover`. M07 has no owner in wave E, so the integration lead adds the panel (read through FS45's RPC) and a unit test.
- **FS48 -> F13 (M04):** if mentor circles need a `circle` type on M04 mentoring tables, the integration lead adds it (additive column) in the QA migration.
- **FS49 -> FS37:** HU tool cards link to `/my/ai-fluency/drills/:id`; speak-up smoke stays green.

#### Wave E QA and integration checklist

- [ ] Five DONE files present; each lists its acceptance tests, live migration parts and digests.
- [ ] Branches `fsEe1`..`fsEe5` merged `--no-ff` in order; `npm run gen` leaves no diff; no conflict markers.
- [ ] Every hand-off above wired in TS and SQL, in the wave QA migration, with a unit test per wiring item.
- [ ] Recorded-evidence lists unioned (3.9) and the final `kafaa_skill_states_v2` / `kafaa_skills_apply` body applied live (md5 equal).
- [ ] Route-count pins updated in all pin files (3.11), with the per-module additions in the comment.
- [ ] Gates green: gen, check:i18n, typecheck, full unit suite (serial chunks), migrations:validate (incl. `fsqa5`), check:public, build.
- [ ] Live: QA migration parts applied; all wave tables count + digest equal; function md5s equal; anon executes nothing new.
- [ ] Route sweep (all routes x 17 sessions) 0 mismatches, 0 text issues; journeys `fswaveE.spec.ts` green; visual RTL + 390 px checked by eye.
- [ ] FS38/FS41/FS42 public text passes `publicTextIsClean` (unit test over every row); SMR pages carry "no deployment decision implied".
- [ ] FS39 offline test (no network after load) and SIMULATED chip on every screen; FS40 TS = SQL scoring and level-2 cap.
- [ ] FS48/FS46: protected-input test extended and green; v1 360 results still render.
- [ ] FS49: speak-up network smoke check green; every HU card in EN and AR links a drill or lesson.
- [ ] `deploy_out` rebuilt and checked; ~10 screenshots in `shots_E/`; `QA_E.md` written; `DEPLOY_READY.md` updated; committed on master.
- [ ] Deployed after Armie's explicit go-ahead; verified; `DEPLOY_DONE.md` appended; Armie told.

#### Wave E feature cards

##### FS38 · SMR delta overlay for every Barakah role
- **Wave / owner:** E · E1 · `m31 (Next-Gen Nuclear Readiness)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Operators, maintenance, engineering and support staff; ADVANCE planners.
- **Problem:** Nobody can see what would change in their own role on a small modular or advanced reactor fleet, so preparation is generic.
- **What it does:**
  - /my/next-gen: for my role, what changes on an SMR or advanced-reactor fleet (multi-module operation, passive safety, digital I&C, factory fabrication, different maintenance regimes), what stays the same, and the delta training.
  - A role-by-technology matrix for HR, built from FS05 2035 profiles and the six ADVANCE technology families.
  - Every page carries "no deployment decision implied" and shows no headcount or site.
- **Data:** `kafaa_smr_deltas` (role, tech family, changes EN/AR, skills, sources); rule deltaFor(role, tech)
- **RBAC:** Staff R; frameworks W; public summary R.
- **Acceptance:**
  - All 28 roles have a delta for at least the 3 most relevant technology families.
  - Every delta cites at least 2 sources.
  - publicTextIsClean passes on every delta.
- **Depends on:** FS05, FS04
- **Adjustments learned from waves A to D:**
  - Role source: `kafaa_job_roles` has 39 rows = **28 current roles + 11 concept roles** (`lifecycle = 'concept'`, added by FS05). "All 28 roles" means the current ones; never offer concept roles as "my role".
  - Six ADVANCE technology families already exist in `kafaa_adv_technologies` (M11, public, sourced). FS05 2035 profiles are in `kafaa_role_profile_versions` (M01, 101 rows, horizons 2030/2035).
  - `publicTextIsClean` lives in `src/domain/future.ts` (also used by `m01/roleProfiles.ts`, `m17/microcred.ts`). Reuse it; do not write a second copy check.
  - Delta training should point at existing content: FS31 micro-credential `MC-SMR-FOUND` (M17), the FS19 course pack (M04), FS17 pathways (M19) and FS14 horizon lanes (M21). Links only; no writes into those tables.
  - M31 has no dedicated policy resource. Use `skills_taxonomy` (every role incl. public has R) for the public summary and staff pages, and `frameworks` W for editing deltas. Log the choice in the CONTRACT changelog.

##### FS39 · Plant literacy for everyone and a reference-plant log
- **Wave / owner:** E · E1 · `m31 (Next-Gen Nuclear Readiness)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Non-operators (engineering, HR, finance, supply chain, communications); students.
- **Problem:** Most staff never see how the plant behaves; simulator access is reserved for operators.
- **What it does:**
  - A browser "plant literacy" module: a schematic, deterministic explainer of heat, steam and safety functions with guided what-if steps (an NuScale E2-style outreach pattern), no plant data.
  - Reference-plant visits and simulator observation hours logged as evidence (validated by host).
- **Data:** static scenario definitions; `kafaa_plant_visits` (person, kind, host, date); RPC logVisit / confirmVisit
- **RBAC:** Staff R; Own logs; host A for confirmation.
- **Acceptance:**
  - The module runs offline with no network calls after load.
  - Confirmed visits write evidence; unconfirmed ones do not.
  - The module contains no real plant parameters and carries the SIMULATED chip on every screen.
- **Depends on:** FS02
- **Adjustments learned from waves A to D:**
  - The "offline after load" criterion: keep scenario definitions static in the bundle (a TS module), and add a unit test that spies on `fetch`/`b.rpc` during the what-if steps (FS34's anonymous spy test in `tests/unit/fs44-pages.test.tsx` is the pattern).
  - Evidence: `kafaa_skill_evidence.kind` is a fixed enum (`qual|course|assessment|jpm|rating|ojt|credential`); widening a check needs a DROP, which is forbidden. Write confirmed visits as an existing kind (e.g. `ojt`, basis `validated`) with `ref_table = 'plant_visits'`, and add `'plant_visits'` to `RECORDED_REF_TABLES` (`src/domain/skills.ts`) **and** to the SQL lists in `kafaa_skill_states_v2` / `kafaa_skills_apply` (see section 3.9).
  - Host confirmation is maker-checker: the host can never be the visitor. Unconfirmed visits must not appear in `skill_evidence` at all.

##### FS40 · Digital-twin diagnosis drills
- **Wave / owner:** E · E1 · `m31 (Next-Gen Nuclear Readiness)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/)
- **For:** Engineers, maintenance staff, data-minded operators.
- **Problem:** Digital-twin skills are required by micro-credentials and gigs, but there is nowhere to practise diagnosis from model data.
- **What it does:**
  - Synthetic plant-model trend sets (seeded, no OT link) where the learner diagnoses a degrading component, chooses checks and justifies a conservative action.
  - Rubric scoring with reasons; results write evidence for digital-twin and plant-data skills.
- **Data:** `kafaa_twin_scenarios` (series json, faults); `kafaa_twin_attempts`; RPC submitTwinDrill
- **RBAC:** Own; training_manager W.
- **Acceptance:**
  - All series are synthetic and labelled SIMULATED.
  - Scoring is identical in TS and SQL.
  - A completed drill writes evidence for the twin and plant-data skills it names, capped at level 2.
- **Depends on:** FS02
- **Adjustments learned from waves A to D:**
  - Copy the FS37 pattern exactly (M29 `drills.ts`, `kafaa_dr_score`): scenarios table without answers, a separate keys table staff can never read, attempts Own only, a pure `scoreTwinDrill()` = SQL `kafaa_tw_score` proven on every seeded attempt plus a few hundred generated submissions in PGlite.
  - Evidence: kind `assessment`, `ref_table = 'twin_attempts'`, level capped at 2; latest attempt replaces earlier evidence from the same drill; add `'twin_attempts'` to the recorded-evidence lists (section 3.9).
  - Skills to evidence: the FS02 digital-plant skills (twin and plant-data skills, e.g. the `sk-fs-*` digital entries) — read ids from `scripts/seed/ext/fs02-catalogue.mjs`; do not invent new skills.
  - Hand-off for the integration lead: FS31 `MC-TWINS` (strategic tier) and FS27 gig `fg-dig-twin-validation` should list twin drills as a route (`satisfiability()` in M17 / a data row), and FS17 pathway step discovery could include twin drills as it does FS21 banks (wave C pattern, `kafaa_pw_discover`).

##### FS41 · CleanEnergyComp: ENEC's sustainability competence framework
- **Wave / owner:** E · E2 · `m32 (Energy Transition Skills)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696)
- **For:** All staff; leaders; communications and sustainability teams.
- **Problem:** Green and energy-transition skills exist only as horizon lane HZ-5; nuclear's sustainability story has no competence structure.
- **What it does:**
  - Twelve competences in four areas, authored with the GreenComp method: embodying values (public trust, stewardship), embracing complexity (systems thinking under uncertainty, lifecycle carbon), envisioning futures (net-zero pathways, the role of nuclear), acting (waste stewardship, circularity, advocacy with evidence).
  - Learning outcomes per competence, role targets, and links to Net Zero 2050 and the Jahiz New Economy group.
  - /skills/clean-energy (public) and my progress view.
- **Data:** `kafaa_cec_competences` (area, outcomes EN/AR, skill links)
- **RBAC:** Public R; Own progress.
- **Acceptance:**
  - Each competence lists learning outcomes in EN and AR and cites GreenComp.
  - Every competence links to at least one FS02 skill and one learning item.
  - Role targets exist for every job family, and public text passes publicTextIsClean.
- **Depends on:** FS02
- **Adjustments learned from waves A to D:**
  - FS02 already added 7 green skills (`fs_area` green) and FS31 published `MC-CLEAN-ENERGY` (and drafted `MC-H2-HEAT`). Link competences to those skills and credentials rather than creating parallel ones.
  - "CleanEnergyComp L1" is consumed later by FS74 (wave H, core-five wallet). Export a pure `cecLevel(personId)` (or equivalent) rule so FS74 can reuse it TS = SQL.
  - Role targets per job family: `kafaa_job_families` (M01). The Jahiz "New Economy" group is FS02's `future_group` column on skills.
  - Public page: use `skills_taxonomy` R (public) for `/skills/clean-energy`; progress view Own via `skills_profile` Own.

##### FS42 · Energy-system integration pathway: hydrogen, process heat and grid
- **Wave / owner:** E · E2 · `m32 (Energy Transition Skills)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Engineers, strategy staff, interested employees.
- **Problem:** Nuclear's future roles in hydrogen, industrial heat and grid integration have no learning route.
- **What it does:**
  - An awareness-to-practitioner pathway (FS17 format) with curated sources, gigs and the matching horizon lane.
  - A short explainer per value chain with sourced facts (no ENEC project claims).
- **Data:** pathway and resource rows; `kafaa_value_chains` (facts, sources)
- **RBAC:** Staff R.
- **Acceptance:**
  - Every fact carries a source and an as-of date.
  - Copy passes publicTextIsClean (no project or site claims).
  - The pathway shows its envelope and weekly hours like every other pathway.
- **Depends on:** FS17, FS19
- **Adjustments learned from waves A to D:**
  - Pathway rows live in M19 tables (`kafaa_pathways`, `kafaa_pathway_steps`). Add the new pathway as seed rows from your own builder (data-only coupling, logged in CONTRACT) and validate it with M19's `pathwayProblems()`; never edit `src/modules/m19`.
  - "Envelope and weekly hours like every other pathway" = the FS17 pathway envelope fields; the page should reuse M19's display through a link to `/learn/pathways/:id` rather than a copy.
  - Consider publishing FS31's draft `MC-H2-HEAT` as the pathway's credential if `satisfiability()` passes once the pathway exists (integration lead decision; credit tag via FS30 `ensureCreditTags`).
  - Gap backlog: new content may fill FS17 `pathway_gaps` steps; the wave QA must replay `refreshPathwayGaps` live (wave C/D pattern, guarded, no DELETE).

##### FS43 · ESG and GHG literacy for managers
- **Wave / owner:** E · E2 · `m32 (Energy Transition Skills)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** Managers; finance and reporting staff.
- **Problem:** Managers increasingly report on sustainability and human capital but have no shared baseline.
- **What it does:**
  - A short pathway on GHG accounting basics, sustainability and human-capital reporting concepts, with a micro-credential route.
- **Data:** pathway rows; credential criteria
- **RBAC:** Staff R.
- **Acceptance:**
  - The pathway is completable in under 10 hours with a stated weekly cost.
  - All content is sourced.
  - Completion counts toward the matching micro-credential criteria.
- **Depends on:** FS17
- **Adjustments learned from waves A to D:**
  - Same M19 seed-row pattern as FS42. Credential criteria: either extend an FS31 definition through M17's `validateDef` / `kafaa_mc_validate_def`, or add a new `microcred_defs` row from the QA seed; any new micro-credential needs an FS30 credit tag (`ensureCreditTags(T)`), as wave D did for FS31.
  - "Under 10 hours with a stated weekly cost": compute from step hours, unit-test the total.

##### FS44 · Expert lecture library and knowledge that counts as evidence
- **Wave / owner:** E · E3 · `m24` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday)
- **For:** Experts; learners; knowledge managers.
- **Problem:** Knowledge assets, community posts and expert sessions do not feed anyone's skill evidence, so experts get no recognition and gaps stay hidden.
- **What it does:**
  - A lecture library (Plan 2035 pattern) of recorded expert talks (synthetic metadata), each linked to skills and to the KLRA position it protects.
  - Authored assets and delivered sessions write "contribution" evidence once a reviewer validates them.
- **Data:** `kafaa_lectures`; skill_evidence kind "contribution" (additive); RPC validateContribution
- **RBAC:** knowledge R; reviewer A.
- **Acceptance:**
  - Validated contributions recompute skills; unvalidated ones do not.
  - No security-restricted topic can be published (refusal).
  - Each lecture links at least one skill and the KLRA position it protects, where one exists.
- **Depends on:** F21, FS02
- **Adjustments learned from waves A to D:**
  - Existing M24 tables: `knowledge_assets` (11), `asset_reviews`, `asset_uses`, `capture_sessions` (21, incl. FS28 `cs-sec-*` rows), `klra_positions` (119), `sme_profiles`. `knowledge` is staff-readable: personal rows need Scope/Own rules or the always-false `open_read` column (see the header of `m24/backend/schema.ts`).
  - There is no `contribution` evidence kind and the kind check cannot be widened (needs a DROP). Write validated contributions as kind `rating` or `credential` with basis `validated` and `ref_table = 'lectures'` / `'knowledge_assets'`, and add the ref tables to the recorded-evidence lists (section 3.9). Unvalidated contributions write nothing.
  - "No security-restricted topic": reuse the security-restricted refusal pattern (`restricted_kind` / `security_restricted` codes used by FS28/FS29).
  - FS72 (wave H) reads validated contributions as a suggestion source; keep a clean query for it.

##### FS45 · Localisation countdown to 2030
- **Wave / owner:** E · E3 · `m24` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Training managers; HR director; knowledge managers.
- **Problem:** Some qualifications and programmes are still delivered or signed off by foreign partners, and there is no view of when UAE instructors take each one over.
- **What it does:**
  - For each programme or qualification delivered by a partner: the UAE instructor readiness (from F31), target transfer date (no later than 2030), status and risk.
  - Links to the F22 handover board and the F31 instructor pipeline.
- **Data:** `kafaa_localisation_items` (programme, partner, target, status); RPC setLocalisationStatus (training_manager)
- **RBAC:** knowledge R; training_manager W; auditor R.
- **Acceptance:**
  - Every partner-delivered programme in the seed appears with a date.
  - Readiness is computed from F31, not entered.
  - Items past their target date are flagged and appear on the F22 handover board.
- **Depends on:** F22, F31
- **Adjustments learned from waves A to D:**
  - UAE instructor readiness comes from F31 instructor tables in **M02** (`kafaa_instructor_tracks` 28 rows, `instructor_observations`, `teaching_hours`; route `/training/instructors`), not M25. Compute readiness from them (TS = SQL); never store it.
  - The F22 Handover 2030 board is in **M07** (`HandoverPage.tsx`, `handover.ts`, table `handover_cohorts`), which nobody owns in wave E. Expose overdue items through an M24 RPC or table; the integration lead adds the M07 panel in the wave QA step (or FS52/FS53's owner in wave F if it slips).
  - `kafaa_programmes` has no "delivered by partner" column. Model partner delivery in `kafaa_localisation_items` (programme_id, partner org from `kafaa_organisations`, target date <= 2030-12-31).
  - Large person-keyed reads: use `scopedPersonIds` (`src/data/scope.ts`) for manager-scope reads; an unscoped read hit the 8 s statement timeout in wave C.

##### FS46 · Future leadership behaviours in the 360
- **Wave / owner:** E · E4 · `m22` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** GREENCOMP (GreenComp, with EntreComp and LifeComp, 2022, https://joint-research-centre.ec.europa.eu/greencomp); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** Leaders; HR; raters.
- **Problem:** The 8-behaviour leadership 360 covers nothing about leading digital change, AI-augmented teams, innovation or inclusion.
- **What it does:**
  - Adds four behaviours with anchors: leading digital change, leading AI-augmented teams (including when to override a tool), intrapreneurship (EntreComp), inclusion.
  - Programme content and coach cards for each; aggregate view by programme (suppressed).
- **Data:** leadership behaviour rows; 360 form version 2
- **RBAC:** Existing F16 rules.
- **Acceptance:**
  - Old 360 results stay readable under version 1.
  - Aggregates under 10 are suppressed.
  - Each new behaviour has anchors at every rating point in EN and AR.
- **Depends on:** F16
- **Adjustments learned from waves A to D:**
  - The 8 F16 behaviours are a TS constant `BEHAVIOURS` in `src/modules/m22/domain.ts`, rated in `kafaa_leadership_360` / `leadership_360_requests`. Add a form version (additive column with default 1) and a v2 behaviour list; v1 results must render unchanged.
  - Anchors at every rating point in EN and AR: unit-test the matrix (behaviours x points x languages) is complete.

##### FS47 · Future Leaders track: nuclear management competence
- **Wave / owner:** E · E4 · `m22` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf)
- **For:** High-potential staff; leadership academy.
- **Problem:** Leaders need policy, economics, stakeholder and international competence, not only technical depth.
- **What it does:**
  - A nuclear-management competency model (INMA pattern): safety culture leadership, regulatory affairs literacy, project and cost control, stakeholder and international affairs, knowledge management.
  - A cohort track with nomination, modules, a policy project and links to external programmes (NEA NextGen summer school, IAEA management schools).
- **Data:** competency rows; programme and cohort rows
- **RBAC:** Existing F16 rules; nomination by HR.
- **Acceptance:**
  - Each competency has descriptors and a learning route.
  - External programmes are listed with sources and dates.
  - Nomination and selection go through RPCs with an audit row; statistics under 10 are suppressed.
- **Depends on:** F16
- **Adjustments learned from waves A to D:**
  - Reuse `kafaa_leadership_programmes` (11 rows) and `kafaa_leadership_nominations` + their RPCs where possible; add the INMA-pattern competency rows in your own table. External programmes (NEA NextGen, IAEA management schools) need source URL + as-of date from `ref/research/nuclear_energy.md`; do not invent dates.

##### FS48 · Women in future nuclear skills
- **Wave / owner:** E · E4 · `m22` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** Women in ENEC; mentors; programme owners.
- **Problem:** Women are about a fifth of the nuclear workforce internationally; mentoring, placements and sponsored study for future skills are not organised.
- **What it does:**
  - Mentor circles, visiting-professional placements (Lise Meitner pattern) and sponsored study with a placement (MSCFP pattern).
  - Pipeline metrics (participation, completion, progression) shown only as suppressed aggregates.
- **Data:** programme rows; F13 mentoring circle type
- **RBAC:** Opt-in; Agg only for HR.
- **Acceptance:**
  - Gender never enters any ranking (existing protected-input test extended).
  - Every aggregate cell under 10 is suppressed.
  - Participation is opt-in and can be withdrawn without trace in any ranking.
- **Depends on:** F13, F16
- **Adjustments learned from waves A to D:**
  - Mentoring tables are in **M04** (`mentoring_agreements`, `mentoring_sessions`, `mentors` in `src/data/schema.ts`), which nobody owns in wave E. Keep circle data in an M22-owned table; if a `circle` type on mentoring is really needed, request it in the hand-off for the integration lead.
  - Extend `tests/unit/w3e5-no-protected-inputs.test.ts` (the protected-input test) to cover the new surfaces; gender must never reach any engine input. Opt-in withdrawal must leave no trace in rankings (test).
  - Gender appears only as a suppressed aggregate (MIN_GROUP_SIZE 10).

##### FS49 · Safety culture for an AI-augmented plant
- **Wave / owner:** E · E5 · `m08` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** IAEA-AI (IAEA AI for nuclear energy ("Atoms for Algorithms"), 2025, https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** All staff; HU and safety-culture leads.
- **Problem:** Safety-culture content does not yet address automation bias, over-reliance on tools or how a questioning attitude applies to AI outputs.
- **What it does:**
  - Extends questioning attitude and conservative decision-making with AI and automation examples.
  - HU tool cards in EN and AR: automation bias, mode confusion, over-reliance, verifying a tool against the controlled source; links to FS37 drills.
  - A sourced set of international operating-experience lessons on automation and digital systems.
  - No telemetry is added near speak-up.
- **Data:** hu_tools rows; oe_lessons rows (sourced)
- **RBAC:** Existing M08 rules.
- **Acceptance:**
  - Every lesson carries a public source and date.
  - The speak-up network check stays green.
  - Each HU tool card exists in EN and AR and links at least one drill or lesson.
- **Depends on:** FS37
- **Adjustments learned from waves A to D:**
  - `hu_tools` (8 rows) and `oe_lessons` (6 rows) are defined in the shared `src/data/schema.ts` (M08 block); M08 has no `backend/` folder. Add rows from your own seed builder (`scripts/seed/ext/fs49-*.mjs`) and columns only inside the M08 block.
  - FS37 drills to link: `/my/ai-fluency/drills/:id` (e.g. `ad-valve-lineup`). The speak-up network smoke check (`noTelemetry`) must stay green: add nothing to `/speak-up`.
  - OE lessons: international, public, sourced (dated) only; no ENEC events.


### Wave F (digit 6): Workforce strategy and analytics (10 features)

Leadership tools: the critical future-skills register, scenario bands per skill, automation in the outlook, external benchmark lines, taxonomy governance, engine cards and the ontology datasheet, proof of which learning moves skills, curriculum coverage, adaptive problem solving and role-play practice.


#### Wave F engineer slots

| Slot | Folder (owned) | Features | Migration | Seed builder | Validator / tests | Note |
|---|---|---|---|---|---|---|
| fsFe1 | `src/modules/m35` | FS50, FS51 | `20261010261001_kafaa_fs61_strategy_forecasts.sql` | `scripts/seed/ext/fs50-critical-skills.mjs` | `scripts/validate/fs61-*.mjs`, `tests/unit/fs61-*` | Workforce Strategy and Disclosure: new module; imports M07 outlook pure functions read-only |
| fsFe2 | `src/modules/m07` | FS52, FS53 | `20261010262001_kafaa_fs62_outlook_automation.sql` | `scripts/seed/ext/fs52-outlook-automation.mjs` | `scripts/validate/fs62-*.mjs`, `tests/unit/fs62-*` | Workforce analytics (F35 outlook, F22 handover) |
| fsFe3 | `src/modules/m16` | FS54, FS55 | `20261010263001_kafaa_fs63_taxonomy_governance.sql` | `scripts/seed/ext/fs54-taxonomy-governance.mjs` | `scripts/validate/fs63-*.mjs`, `tests/unit/fs63-*` | Admin, audit, AI transparency (engine cards, fairness) |
| fsFe4 | `src/modules/m25` | FS56, FS57 | `20261010264001_kafaa_fs64_skill_change_coverage.sql` | `scripts/seed/ext/fs56-skill-change.mjs` | `scripts/validate/fs64-*.mjs`, `tests/unit/fs64-*` | Training effectiveness and needs |
| fsFe5 | `src/modules/m33` | FS58, FS59 | `20261010265001_kafaa_fs65_aps_roleplay.sql` | `scripts/seed/ext/fs58-aps-roleplay.mjs` | `scripts/validate/fs65-*.mjs`, `tests/unit/fs65-*` | Human Skills Studio (FS25/FS26 already here) |

Wave QA: `supabase/migrations/20261010269001_kafaa_fs6qa_integration.sql`, `scripts/seed/ext/fsqa6-integration.mjs`, `scripts/validate/fsqa6-integration.mjs`, `tests/unit/fsqa6-integration.test.tsx`, `tests/e2e/fswaveF.spec.ts`, visual block `fsf`.


#### Wave F cross-feature hand-offs to wire (integration lead)

- **FS51 <-> FS52 (same wave, M35 and M07):** E1 imports `m07/outlook.ts` pure functions read-only; E2 changes `outlook.ts` for the automation factor with adoption 0 = today's results. The integration lead re-runs both validators after the merge and checks the F35 stress test still reads 10 of 10.
- **`kafaa_so_base` redefinitions:** if both E1 and E2 touch the outlook SQL, the QA migration holds the final body carrying FS02 (`fs_area is null`), FS10 (fitness evidence excluded) and the FS52 automation factor.
- **FS54 -> F35/FS51 pages:** methodology-change banner on `/workforce/skills-outlook` (M07) and the FS51 pages (M35), read from `kafaa_skill_changes`.
- **FS54 <-> FS57:** the orphan-rate audit and the coverage rule should share one definition of "taught by" (courses, pathways, assessments); reconcile in the QA step if they diverge.
- **FS55 lint test:** every ranked surface needs a card: digest, Dalil career, pathways, externals, translator, fitness, future gigs, plus wave-E surfaces. Reconcile the live `engine_cards` rows that already differ.
- **FS57 -> FS17:** the gap-filling backlog is built on M19 `pathway_gaps` (do not duplicate); export `coverage()` for FS66 (wave G).
- **FS59 -> recorded evidence:** `roleplay_sessions` joins the recorded-evidence union if attached feedback becomes evidence.

#### Wave F QA and integration checklist

- [ ] Five DONE files present; each lists its acceptance tests, live migration parts and digests.
- [ ] Branches `fsFe1`..`fsFe5` merged `--no-ff` in order; `npm run gen` leaves no diff; no conflict markers.
- [ ] Every hand-off above wired in TS and SQL, in the wave QA migration, with a unit test per wiring item.
- [ ] Recorded-evidence lists unioned (3.9) and the final `kafaa_skill_states_v2` / `kafaa_skills_apply` body applied live (md5 equal).
- [ ] Route-count pins updated in all pin files (3.11), with the per-module additions in the comment.
- [ ] Gates green: gen, check:i18n, typecheck, full unit suite (serial chunks), migrations:validate (incl. `fsqa6`), check:public, build.
- [ ] Live: QA migration parts applied; all wave tables count + digest equal; function md5s equal; anon executes nothing new.
- [ ] Route sweep (all routes x 17 sessions) 0 mismatches, 0 text issues; journeys `fswaveF.spec.ts` green; visual RTL + 390 px checked by eye.
- [ ] Outlook with automation adoption 0 equals the stored outlooks exactly; F35 stress test 10 of 10.
- [ ] FS53: no external value is summed with an internal one (unit test); market vs measured styling differs without colour.
- [ ] FS55: engine-card lint test over every registered ranked surface is green; fairness snapshots suppress groups under 10.
- [ ] FS54: retire never deletes (`kafaa_fs_skill_guard`); two approvers + ledger per decision.
- [ ] `deploy_out` rebuilt and checked; ~10 screenshots in `shots_F/`; `QA_F.md` written; `DEPLOY_READY.md` updated; committed on master.
- [ ] Deployed after Armie's explicit go-ahead; verified; `DEPLOY_DONE.md` appended; Armie told.

#### Wave F feature cards

##### FS50 · Critical Future-Skills Register
- **Wave / owner:** F · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf); ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030)
- **For:** HR director; executives; skill owners.
- **Problem:** There is no strategic list of the future skills ENEC must secure, with owners, targets and progress; gap plans hold 3 rows on free-text keys.
- **What it does:**
  - A register of critical future skills: owner, target level and people-equivalents by year, KPIs, and a build/buy/borrow/bot decision with its rationale.
  - Progress computed from person_skills (suppressed), quarterly review status and links to FS04 gap plans.
- **Data:** `kafaa_critical_skills`; `kafaa_critical_skill_reviews`; RPCs saveCriticalSkill, reviewCriticalSkill (ledger)
- **RBAC:** workforce_strategy A (HR director), Agg (HR analyst), R (auditor).
- **Acceptance:**
  - Progress is computed, never typed, and suppressed under 10.
  - Every row has an owner and a decision rationale.
  - Each quarterly review writes an audit row and a ledger row.
- **Depends on:** FS04, FS05
- **Adjustments learned from waves A to D:**
  - The card's "gap plans hold 3 rows" is out of date: `kafaa_skill_gap_plans` (FS04) holds 7 rows on FS02 skill ids. Link to them; do not create a parallel plan table.
  - `workforce_strategy` grants: hr_analyst Agg/W, hr_director Agg/W/A, training_manager Agg, admin R, auditor R; never public, no staff grant. The demo persona for HR director and analyst on supabase is `chco`.
  - Ledger rows through `kafaa_ledger`; Kafa'a-only personas get ledger status `skipped` (expected).

##### FS51 · Three-scenario skill forecasting bands
- **Wave / owner:** F · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/)
- **For:** HR director; strategy; workforce planners.
- **Problem:** The outlook runs on 12 areas with one point estimate; it has no level mix and no time-phasing against ENEC milestones.
- **What it does:**
  - Per skill and level mix: baseline, ADVANCE and accelerated bands to 2035, plus a long-horizon "generations" view of the plant's operating life.
  - Reuses the F35 model's pure functions; scenario assumptions are visible on the page; a methodology banner blocks naive year-on-year comparison; a "not yet modelled" list.
  - Annual refresh with saved versions (MATCH pattern).
- **Data:** `kafaa_skill_forecasts` (scenario, params, results); RPC computeSkillForecast (Agg, suppressed)
- **RBAC:** workforce_strategy Agg/A; never public.
- **Acceptance:**
  - Every number is labelled SIMULATED with a definitions link.
  - Resetting assumptions reproduces the baseline exactly (TS = SQL).
  - Skills with fewer than 10 holders are suppressed.
- **Depends on:** FS02, F35
- **Adjustments learned from waves A to D:**
  - F35 lives in **M07** (`outlook.ts`, `outlookUi.tsx`, table `skill_outlooks`, SQL `kafaa_so_base` and friends). In wave F, M07 is owned by E2 (FS52), who changes `outlook.ts`. E1 imports the pure functions read-only; E2 must keep exported signatures stable. If E1 needs a new pure helper, put it in `m35`.
  - `kafaa_so_base` has been redefined twice (FS02 in wave A, wave-B QA). Any further redefinition must carry every earlier condition (FS02 `fs_area is null`, FS10 fitness-evidence exclusion).
  - "Resetting assumptions reproduces the baseline exactly": PGlite TS = SQL over all seeded scenarios, like F35's stress test.

##### FS52 · AI and automation exposure in the skills outlook
- **Wave / owner:** F · E2 · `m07` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** OECD-AICI (OECD AI Capability Indicators, 2025, https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** HR planners.
- **Problem:** The outlook has no automation factor, so demand ignores tasks that AI will assist or partly automate.
- **What it does:**
  - Adds an automation factor per family from FS06 task exposure, applied to demand with an adoption slider.
  - The tornado chart includes the new assumption; everything stays SIMULATED.
- **Data:** outlook.ts extension (TS = SQL); params key automation_adoption
- **RBAC:** Existing F35 rules.
- **Acceptance:**
  - With adoption at 0 the outlook equals today's results exactly.
  - TS and SQL agree for 52 assumption sets (PGlite).
  - The automation assumption appears in the tornado chart with its range.
- **Depends on:** FS06, F35
- **Adjustments learned from waves A to D:**
  - Task exposure comes from FS06 (M26: `jta_tasks`, `jta_task_skills`, `ai_capability_levels`, `ai_exposure_refs`; engine `taskExposure` in `src/domain/engines/future.ts`).
  - With adoption 0 the outlook must equal today's stored outlooks byte for byte (QA_B restored them to the released ones; the stress test reads 10 of 10).
  - 52 assumption sets in PGlite: generate them deterministically in the validator.

##### FS53 · External benchmark lines, kept apart from measured numbers
- **Wave / owner:** F · E2 · `m07` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025); EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** HR; executives.
- **Problem:** Every number is internal and SIMULATED; leaders cannot see whether ENEC is ahead of or behind the market.
- **What it does:**
  - Sourced reference rows (for example WEF 39% core-skill change, WEF 50% workforce in long-term learning, IEA 60% of firms reporting shortages, Pact training share) shown as labelled lines on workforce dashboards.
  - A visual rule: "market statistic" styling is always distinct from "measured at ENEC (SIMULATED)".
- **Data:** `kafaa_benchmark_values` (benchmark, metric, value, unit, as_of)
- **RBAC:** Staff R where the dashboard is visible.
- **Acceptance:**
  - Every external value links its source and date.
  - No external value is ever summed with an internal one (unit test).
  - The two stylings are distinguishable without colour (label and line pattern).
- **Depends on:** FS01
- **Adjustments learned from waves A to D:**
  - FS01 already stores **53 sourced figures** in `kafaa_benchmarks.figures` (each with a quote from the fact text) and ships `<BenchmarkLine>` in `src/ui/Benchmark.tsx`. Build `kafaa_benchmark_values` from those figures (or reference them) instead of re-typing numbers; every value needs its URL and as-of.
  - Do not use figures the research packs flag as secondary or unverified (PLAN section 4 note).
  - "Distinguishable without colour": label text plus a dashed line pattern; unit-test the label.

##### FS54 · Skills council and taxonomy change tracker
- **Wave / owner:** F · E3 · `m16` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SFIA9 (SFIA 9 (Skills Framework for the Information Age), 2024, https://sfia-online.org/en/sfia-9/sfia-9-release-notes); UPKEEP (Australia National Skills Taxonomy (ASC retired) and Korea NCS, 2024-2025, https://www.jobsandskills.gov.au/australian-skills-classification); MCK-DELTA (McKinsey DELTAs (Distinct Elements of Talent), 2021, https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work); FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030)
- **For:** Skills council (operations, engineering, training, HR, employee representatives); everyone reading the catalogue.
- **Problem:** Taxonomies rot: Australia retired its national classification over timeliness. Kafa'a has no way to propose, approve or publish skill changes.
- **What it does:**
  - Change requests to add, rename, split, retire or re-level a skill, checked against the inclusion rule (distinct development and assessment).
  - Maker-checker approval by the council; a public change tracker at /skills/changes; a methodology-change banner on affected dashboards.
  - A staleness dashboard (skills past review date) and an orphan-rate audit (skills with no course, assessment or role).
- **Data:** `kafaa_skill_change_requests`; `kafaa_skill_changes` (published log); RPCs proposeSkillChange, decideSkillChange (ledger)
- **RBAC:** skills_taxonomy W (propose: staff), A (council: admin + training_manager + HR director), public R for the log.
- **Acceptance:**
  - A retire request marks the skill obsolete and never deletes it.
  - Every decision needs two approvers and writes a ledger row.
  - Staleness and orphan rate are computed, with drill-down lists.
- **Depends on:** FS02, FS07
- **Adjustments learned from waves A to D:**
  - FS02 gave every skill `version`, `review_due`, `lifecycle`, `obsolete_on`, `replaced_by`, and a guard trigger `kafaa_fs_skill_guard` (refuses delete, un-obsolete and lower versions) mirrored by `skillGuard` in `src/data/local/guards.ts`. Retire = set obsolete through those paths.
  - `skills_taxonomy` is already in the policy matrix (public R, staff W to propose, training_manager/hr_director/admin A). Two different approvers = maker-checker (the RPL check-constraint pattern from FS29 is a good model).
  - Orphan rate needs courses, assessments and roles per skill: coordinate the rule with FS57 (same wave, M25) as a data-only coupling.
  - Methodology-change banner: show it on F35 (`/workforce/skills-outlook`) and FS51 pages through a shared read of `kafaa_skill_changes`; the integration lead wires the banners into M07/M35 pages.

##### FS55 · Engine cards, skills-ontology datasheet and model-risk template
- **Wave / owner:** F · E3 · `m16` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** AI governance; auditors; works-council style reviewers.
- **Problem:** The digest and Dalil career mode have no engine cards; new ranking surfaces need fairness monitoring; there is no published description of the skills data itself.
- **What it does:**
  - Engine cards for the digest, Dalil career mode and every new ranking surface (pathways, translator, fitness check, inferred skills).
  - Fairness snapshots extended to those surfaces.
  - A published skills-ontology datasheet: size, sources, update cadence, languages, how inference works, how bias is handled.
  - A model-risk template ready for when a server-side model gateway is approved.
- **Data:** engine card rows; fairness snapshot jobs; datasheet page (generated from the catalogue)
- **RBAC:** Existing F24 rules; datasheet public R.
- **Acceptance:**
  - Every ranked surface in the app has a card (lint test over engine registrations).
  - Datasheet numbers are generated from data, not typed.
  - Fairness snapshots run for each new surface and suppress groups under 10.
- **Depends on:** F24, FS02
- **Adjustments learned from waves A to D:**
  - M16 already has `engine_cards` (8 rows), `fairness_snapshots`, `reco_optouts`, `engine_changes`, `EngineCardView.tsx`, `fairness.ts`. Live `engine_cards` rows for experts, marketplace, mentoring and rotations differ from local (pre-existing); reconcile them in this feature.
  - Surfaces that rank today and need a card: digest (shell), Dalil career (M13), pathways (FS17 `rankPathways`), external catalogue (FS18 `rankExternals`), translator (FS34), fitness check (FS10), future gigs (FS27 `rankFutureGigs`), plus anything wave E adds. FS72 (wave H) must add its own card when it lands; the lint test will catch it.
  - `kafaa_engine_settings.surface` keeps its four-value check (widening needs a drop): new surfaces are defaults-only (`FS_SURFACES`).

##### FS56 · Skill-change effectiveness
- **Wave / owner:** F · E4 · `m25` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** FSC (Future Skills Centre Impact Report 2025, 2025, https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf); ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday)
- **For:** Training managers; L&D; executives.
- **Problem:** Kirkpatrick records do not measure before-and-after skill levels, so nobody knows which learning actually moves future skills.
- **What it does:**
  - For each course and pathway: participants' F01 level before and 90 days after, with a matched comparison where available.
  - A "which learning moves skills" table (suppressed), linked to Kirkpatrick L3.
- **Data:** `kafaa_skill_change_measures`; RPC skillChangeReport (Agg)
- **RBAC:** learning_analytics Agg/A.
- **Acceptance:**
  - Courses with fewer than 10 completers show "suppressed".
  - TS and SQL agree on the seed.
  - Each measured course states its comparison method and window.
- **Depends on:** F25, FS19
- **Adjustments learned from waves A to D:**
  - Kirkpatrick data is in M25 (`eval_surveys`, `eval_responses`, `l3_observations`, `course_kpi_links`). Course pack is FS19 (M04). Before/after levels come from F01 `person_skills` history; state the window (90 days) and comparison method on the page.

##### FS57 · Curriculum coverage scorer and gap-filling backlog
- **Wave / owner:** F · E4 · `m25` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** LIGHTCAST (Lightcast Open Skills and Skillabi, 2025, https://lightcast.io/blog/open-skills-taxonomy); UPKEEP (Australia National Skills Taxonomy (ASC retired) and Korea NCS, 2024-2025, https://www.jobsandskills.gov.au/australian-skills-classification)
- **For:** L&D; procurement; training managers.
- **Problem:** Nobody can see which 2030 role requirements the catalogue cannot teach.
- **What it does:**
  - A 0-100 coverage score per role (now and 2030) from the catalogue, pathways and external resources, with the list of uncovered skills.
  - Uncovered skills become a gap-filling backlog (owner, date, build/partner/buy); a what-if adds a planned course and shows the score move.
- **Data:** rule coverage() TS = SQL; `kafaa_gap_backlog`
- **RBAC:** learning_analytics A; training_manager W.
- **Acceptance:**
  - Coverage reproduces from the rule.
  - Every uncovered skill appears in the backlog with an owner.
  - A what-if course raises the score by exactly the amount the rule predicts and is not saved unless confirmed.
- **Depends on:** FS05, FS19
- **Adjustments learned from waves A to D:**
  - **Do not build a second backlog.** FS17 already maintains a gap backlog in M19 `kafaa_pathway_gaps` (215 live rows: 145 open, 70 filled after the wave-D replay; the wave-D changelog calls it the "FS57 feed"). Build `kafaa_gap_backlog` as the owned, decision-carrying layer over those rows (owner, date, build/partner/buy) or reuse them by id.
  - Export `coverage()` import-free: FS66 (wave G, M10) reuses it.
  - What-if: compute in memory; saving requires a ConfirmDialog + RPC.

##### FS58 · Adaptive problem-solving practice
- **Wave / owner:** F · E5 · `m33 (Human Skills Studio)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** OECD-PIAAC (OECD Survey of Adult Skills (PIAAC), Cycle 2, 2024, https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf)
- **For:** All staff.
- **Problem:** Changing situations (an outage schedule slip, conflicting data, a supply delay) demand a skill nobody measures.
- **What it does:**
  - PIAAC-style scenarios where information changes mid-task and the learner must revise the plan (no plant-security content).
  - Scored on its own scale for development, with a benchmark line.
- **Data:** `kafaa_aps_scenarios`; `kafaa_aps_attempts`; RPC submitAps
- **RBAC:** Own; Agg for HR.
- **Acceptance:**
  - Every scenario has at least one mid-task change.
  - Results never gate a qualification.
  - Each result shows a benchmark line and the scale definition.
- **Depends on:** FS25
- **Adjustments learned from waves A to D:**
  - M33 already has FS25 core skills (`core_skills` 16, targets, candidates) and FS26 SJT (`sjt_items`, `sjt_attempts`, pure `sjt.ts` with `scoreSjt`). Mirror the SJT structure; results never gate a qualification (no write to qualification tables).
  - Benchmark line: `<BenchmarkLine benchmark={{ id: 'OECD-PIAAC', figure }}>` from FS01.

##### FS59 · Role-play practice library with saved feedback
- **Wave / owner:** F · E5 · `m33 (Human Skills Studio)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); IAEA-1917 (IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities, 2020, https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf)
- **For:** All staff; supervisors; trainees.
- **Problem:** Hard conversations are practised rarely; LinkedIn's role-play does not even keep the feedback.
- **What it does:**
  - ENEC-authored scenarios: pre-job brief, shift turnover, raising a concern to a senior, regulator-style interview practice, a knowledge-transfer session, coaching a peer on an AI output.
  - Deterministic rubric (extends F37 role-play); feedback is saved privately and can be attached as evidence after a reviewer validates it.
- **Data:** `kafaa_roleplay_scenarios`; `kafaa_roleplay_sessions` (Own); RPC attachRoleplayEvidence
- **RBAC:** Own; reviewer A for attachment.
- **Acceptance:**
  - Feedback history persists and is visible only to its owner.
  - Speak-up topics route to the existing channel and are never stored.
  - Every scenario has a published rubric in EN and AR.
- **Depends on:** FS25, F37
- **Adjustments learned from waves A to D:**
  - F37 role-play lives in **M13** (`src/modules/m13/career/roleplay.ts`, `RolePlay.tsx`, `evalset.ts`). M13 is owned in wave H by FS76. Import the rubric helpers read-only or re-implement the deterministic rubric in M33; do not edit M13.
  - Attached feedback after reviewer validation becomes evidence (kind `rating`, basis `validated`, `ref_table = 'roleplay_sessions'`, added to the recorded-evidence lists).
  - Speak-up topics: detect and route to `/speak-up` with no storage and no telemetry (test).


### Wave G (digit 7): Disclosure, national alignment, ecosystem (10 features)

Outward-facing: the ISO 30414 skills disclosure pack, the pilots registry, the national-strategy layer, MoHRE mapping, the Al Dhafra regional plan, pledges, university alignment, fellowships, supplier readiness and the contractor pre-arrival check.


#### Wave G engineer slots

| Slot | Folder (owned) | Features | Migration | Seed builder | Validator / tests | Note |
|---|---|---|---|---|---|---|
| fsGe1 | `src/modules/m35` | FS60, FS61 | `20261010271001_kafaa_fs71_disclosure_pilots.sql` | `scripts/seed/ext/fs60-iso30414.mjs` | `scripts/validate/fs71-*.mjs`, `tests/unit/fs71-*` | Workforce Strategy and Disclosure (FS50/FS51 from wave F) |
| fsGe2 | `src/modules/m37` | FS62, FS63 | `20261010272001_kafaa_fs72_national_alignment.sql` | `scripts/seed/ext/fs62-national-tags.mjs` | `scripts/validate/fs72-*.mjs`, `tests/unit/fs72-*` | National Alignment: new module, empty scaffold |
| fsGe3 | `src/modules/m36` | FS64, FS65 | `20261010273001_kafaa_fs73_regional_pledges.sql` | `scripts/seed/ext/fs64-regional-plan.mjs` | `scripts/validate/fs73-*.mjs`, `tests/unit/fs73-*` | Skills Ecosystem: new module, empty scaffold |
| fsGe4 | `src/modules/m10 (+ M10 block / new backend hooks)` | FS66, FS67 | `20261010274001_kafaa_fs74_university_alignment.sql` | `scripts/seed/ext/fs66-university-alignment.mjs` | `scripts/validate/fs74-*.mjs`, `tests/unit/fs74-*` | Universities and research; no backend folder yet |
| fsGe5 | `src/modules/m09` | FS68, FS69 | `20261010275001_kafaa_fs75_supplier_readiness.sql` | `scripts/seed/ext/fs68-supplier-readiness.mjs` | `scripts/validate/fs75-*.mjs`, `tests/unit/fs75-*` | Partners, suppliers, contractor passport (F33) |

Wave QA: `supabase/migrations/20261010279001_kafaa_fs7qa_integration.sql`, `scripts/seed/ext/fsqa7-integration.mjs`, `scripts/validate/fsqa7-integration.mjs`, `tests/unit/fsqa7-integration.test.tsx`, `tests/e2e/fswaveG.spec.ts`, visual block `fsg`.


#### Wave G cross-feature hand-offs to wire (integration lead)

- **FS60 inputs:** FS50 progress, FS09/FS36 AI-fundamentals coverage, training records and xAPI learning hours, FS30 credits. Each metric reproduces from its formula in PGlite.
- **FS61:** the 78% FSC reference comes from `kafaa_benchmarks`, not copy.
- **FS62 tags:** link FS41 (Net Zero 2050), FS09 (National AI Strategy 2031), FS02 `future_group` (Jahiz groups) and FS74's future target (wave H) as data.
- **FS64 <- FS51:** only released, suppressed forecast aggregates reach partners. Partner flows on supabase: `alnoor-gm`, `gulfhydro-qa`; university flows only on local (`k-university`).
- **FS66 <- FS57/FS08:** reuse `coverage()` and `skill_alignments`; evidence at hire joins the recorded-evidence union (`programme_alignments`).
- **FS69 <- FS32:** decide how a contractor creates a share on supabase (contractors have no Kafa'a grant there); assessor-on-behalf is the FS29 precedent.

#### Wave G QA and integration checklist

- [ ] Five DONE files present; each lists its acceptance tests, live migration parts and digests.
- [ ] Branches `fsGe1`..`fsGe5` merged `--no-ff` in order; `npm run gen` leaves no diff; no conflict markers.
- [ ] Every hand-off above wired in TS and SQL, in the wave QA migration, with a unit test per wiring item.
- [ ] Recorded-evidence lists unioned (3.9) and the final `kafaa_skill_states_v2` / `kafaa_skills_apply` body applied live (md5 equal).
- [ ] Route-count pins updated in all pin files (3.11), with the per-module additions in the comment.
- [ ] Gates green: gen, check:i18n, typecheck, full unit suite (serial chunks), migrations:validate (incl. `fsqa7`), check:public, build.
- [ ] Live: QA migration parts applied; all wave tables count + digest equal; function md5s equal; anon executes nothing new.
- [ ] Route sweep (all routes x 17 sessions) 0 mismatches, 0 text issues; journeys `fswaveG.spec.ts` green; visual RTL + 390 px checked by eye.
- [ ] Partner isolation: `alnoor-gm` never sees `gulfhydro-qa` rows (and vice versa) in FS64, FS65, FS68 (RLS tests + sweep).
- [ ] FS60: no metric publishes without a narrative and a second approver; every value reproduces from its formula (TS = SQL).
- [ ] FS63: no MoHRE code shown unless verified; "not a MoHRE system" statement present.
- [ ] FS69: the pre-check writes no evidence and no qualification status.
- [ ] `deploy_out` rebuilt and checked; ~10 screenshots in `shots_G/`; `QA_G.md` written; `DEPLOY_READY.md` updated; committed on master.
- [ ] Deployed after Armie's explicit go-ahead; verified; `DEPLOY_DONE.md` appended; Armie told.

#### Wave G feature cards

##### FS60 · ISO 30414 skills and capability disclosure pack
- **Wave / owner:** G · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P1 · **Complexity:** L
- **Benchmarks:** ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** HR director; board secretary; auditors.
- **Problem:** Skills metrics are scattered and carry no definitions, narratives or audit trail, so they cannot be disclosed.
- **What it does:**
  - A metric library mapped to ISO 30414 areas, centred on Skills, Capabilities and Development: % of workforce trained this year, quarterly active learners, learning hours per employee, AI-fundamentals coverage, critical-skill progress, participation equity (who is not using it, by site, shift and grade; suppressed).
  - Each metric has a definition, formula, source, owner narrative, variance explanation, approval and as-of; a materiality statement.
  - An export (CSV, JSON and a print view), all labelled SIMULATED in the demo.
- **Data:** `kafaa_hc_metrics`; `kafaa_hc_disclosures` (period, values, narratives, approvals); RPCs computeDisclosure, approveDisclosure (maker-checker, ledger)
- **RBAC:** workforce_strategy A; auditor R; never public.
- **Acceptance:**
  - No metric publishes without a narrative and a second approver.
  - Every value reproduces from its formula (TS = SQL).
  - All cells under 10 are suppressed.
- **Depends on:** FS50
- **Adjustments learned from waves A to D:**
  - Inputs already exist: FS50 progress, FS09 rungs / FS36 coverage for AI fundamentals, training records and xAPI (M27, 2,031 statements) for learning hours, FS30 credits. Each metric = definition + formula (TS = SQL) + owner narrative + variance note + approval + as-of.
  - Participation equity by site, shift and grade: suppressed under 10; never nationality or gender outside the suppressed Emiratisation aggregate rule.
  - Export CSV/JSON/print view all labelled SIMULATED; FS36's `buildPack` CSV statement-per-row pattern is a good model.

##### FS61 · Skills pilots registry
- **Wave / owner:** G · E1 · `m35 (Workforce Strategy and Disclosure)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** FSC (Future Skills Centre Impact Report 2025, 2025, https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf)
- **For:** L&D; HR; executives.
- **Problem:** Workforce experiments are not registered, evaluated or published, so lessons, including failures, are lost.
- **What it does:**
  - Each pilot: hypothesis, comparison group, named evaluator (role card), metrics, result including failures, adoption status.
  - An adoption-rate KPI shown against the Future Skills Centre reference of 78%.
- **Data:** `kafaa_skill_pilots`; RPC closePilot (evaluator sign-off)
- **RBAC:** workforce_strategy W/A; staff R for published results.
- **Acceptance:**
  - A pilot cannot close without an evaluator sign-off.
  - Failed pilots stay visible.
  - The adoption rate is computed from pilot statuses and shows the Future Skills Centre reference with its source.
- **Depends on:** FS01
- **Adjustments learned from waves A to D:**
  - The FSC 78% reference must be read from `kafaa_benchmarks` (FSC figures), never typed into copy.

##### FS62 · National-strategy alignment layer
- **Wave / owner:** G · E2 · `m37 (National Alignment)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696); UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); NAFIS (Nafis and the Emirati Talent Competitiveness Council, 2026, https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership)
- **For:** Executives; strategy; government-relations reporting.
- **Problem:** Skills, programmes and targets are not tagged to the national strategies they serve, so every report is written by hand.
- **What it does:**
  - Tags on skills, programmes and targets: We the UAE 2031 pillar, National Employment Strategy 2031, National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071.
  - Filtered reports by strategy, each tag citing its official source.
- **Data:** `kafaa_national_tags`; `kafaa_tag_links`
- **RBAC:** national_alignment R for staff; W for admin and HR director.
- **Acceptance:**
  - Every tag cites an official source.
  - Reports are filters over data, with no typed totals.
  - Every tag exists in EN and AR.
- **Depends on:** FS02
- **Adjustments learned from waves A to D:**
  - Tags must cite official sources: use `ref/research/national_systems.md` (Jahiz, NAFIS, UAE AI strategy, Net Zero 2050). Jahiz groups are already a column (`future_group`) on skills from FS02; reuse it.
  - `national_alignment` grants: all staff R, hr_analyst Agg, hr_director W, admin W/A.

##### FS63 · MoHRE occupation and skill-level mapping
- **Wave / owner:** G · E2 · `m37 (National Alignment)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** MOHRE (MoHRE occupational classification and skill levels, current (read 2026), https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme); ESCO (ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations), 2025, https://esco.ec.europa.eu/en/about-esco/what-esco)
- **For:** HR; reporting.
- **Problem:** Roles are not mapped to the national occupational classification or its five skill levels.
- **What it does:**
  - Each role carries a MoHRE occupation label and code where verified (otherwise "code pending") and a national skill level.
  - A SIMULATED skill-level uplift trend for the workforce, suppressed.
- **Data:** `kafaa_role_occupations`
- **RBAC:** national_alignment R; W admin.
- **Acceptance:**
  - No code is shown unless verified from the source.
  - Kafa'a states it is not a MoHRE system.
  - The uplift trend is labelled SIMULATED and suppressed under 10.
- **Depends on:** FS05
- **Adjustments learned from waves A to D:**
  - Verified codes only (PLAN section 8): rows without a verified MoHRE code show "code pending review". The research pack lists what was verified.
  - Map current roles only (28); concept roles get no code.

##### FS64 · Regional skills plan for Al Dhafra
- **Wave / owner:** G · E3 · `m36 (Skills Ecosystem)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** FORECAST (Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035, 2025, https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030); EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en)
- **For:** Universities and training providers (partner roles); HR; community partners.
- **Problem:** ENEC's future skill demand is not shared with local providers, and their commitments are not tracked.
- **What it does:**
  - ENEC publishes forward skill demand as SIMULATED aggregates from FS51; providers respond in the portal with planned cohorts and course changes.
  - Commitments are tracked against delivery each term.
- **Data:** `kafaa_regional_demand` (released aggregates); `kafaa_provider_commitments`; RPC commitProvision (university/partner OwnOrg)
- **RBAC:** ecosystem R for partner roles (released aggregates only); OwnOrg W for their commitments.
- **Acceptance:**
  - Only released, suppressed aggregates reach partners.
  - Each commitment shows its delivery status.
  - Commitments are written only through the RPC and carry an audit row.
- **Depends on:** FS51
- **Adjustments learned from waves A to D:**
  - Released aggregates come from FS51 forecasts (wave F). `ecosystem` gives partner roles R: any table whose read rule names `ecosystem` is readable in full by partners, so use OwnOrg rules for commitments and a released/suppressed view for demand (see the caveat in `src/auth/policy.ts`).
  - Persona coverage: `alnoor-gm` and `gulfhydro-qa` (partner_admin) work on supabase; `k-university` exists only on the local backend (no NEXUS account), so university flows are tested on local.

##### FS65 · Skills pledges ledger
- **Wave / owner:** G · E3 · `m36 (Skills Ecosystem)` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); ENERGY-JOBS (IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025, 2025, https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025)
- **For:** ENEC departments; suppliers; universities.
- **Problem:** Upskilling commitments are statements, not tracked numbers.
- **What it does:**
  - Organisations register numeric pledges (people x skill area x date); pledged, started and completed are always shown separately.
- **Data:** `kafaa_pledges`; `kafaa_pledge_progress`; RPC registerPledge
- **RBAC:** OwnOrg W; ecosystem R aggregates.
- **Acceptance:**
  - Pledged, started and completed never merge into one number.
  - Small counts are suppressed.
  - Each pledge names its organisation, skill area and date.
- **Depends on:** FS01
- **Adjustments learned from waves A to D:**
  - Pledged, started and completed are three separate columns and three separate tiles; add a unit test that no code path sums them.

##### FS66 · University programme alignment
- **Wave / owner:** G · E4 · `m10` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); UAE-NQF (UAE National Qualifications Framework and NQC work-experience recognition, 2024 / 2026, https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses); LIGHTCAST (Lightcast Open Skills and Skillabi, 2025, https://lightcast.io/blog/open-skills-taxonomy)
- **For:** Universities; graduate recruiters; applicants.
- **Problem:** Degrees and ENEC skills are not mapped, so a graduate's learning is not recognised at hire.
- **What it does:**
  - University programmes mapped to ENEC skills and levels, with a coverage score and an endorsement status (INMA-style review).
  - Graduates of aligned programmes get validated evidence at hire for the mapped skills.
- **Data:** `kafaa_programme_alignments`; RPC endorseProgramme (frameworks A)
- **RBAC:** University OwnOrg R/W for their programmes; frameworks A to endorse.
- **Acceptance:**
  - Evidence is written only for endorsed programmes.
  - Coverage reuses the FS57 rule.
  - A partner university sees only its own programmes.
- **Depends on:** FS08, FS57
- **Adjustments learned from waves A to D:**
  - Reuse FS57's `coverage()` (wave F) and FS08 `skill_alignments` (M28). University rows: `kafaa_organisations` kind `university`; M10 data in `src/data/schema.ts` (`scholar_cohorts` etc.); M10 has no `backend/` folder and no hook in `src/data/ext/*.ts` yet: either add `src/modules/m10/backend/{schema,rpc,local,supabase}.ts` plus one-line hooks in `src/data/ext/{schema,rpc,local,supabase}.ts` (marked FS66, as F34 did for M06 and F33 for M09) or add tables inside the M10 block of `src/data/schema.ts`; log the shared edit in CONTRACT.
  - Evidence at hire only for endorsed programmes: basis `validated`, `ref_table = 'programme_alignments'`, recorded-evidence lists updated.

##### FS67 · Fellowships and sponsored placements
- **Wave / owner:** G · E4 · `m10` · **Priority:** P3 · **Complexity:** M
- **Benchmarks:** NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677)
- **For:** Students; early-career staff; research partners.
- **Problem:** Fellows and sponsored students are not placed inside real ENEC projects, and completion is not tracked.
- **What it does:**
  - NEST-style fellowships inside ENEC research or ADVANCE study projects, and sponsored study paired with a placement (MSCFP pattern).
  - Completion rate as the headline metric, not award counts.
- **Data:** `kafaa_fellowships`; `kafaa_fellowship_milestones`
- **RBAC:** university OwnOrg; HR A.
- **Acceptance:**
  - Completion rate is computed from milestones and suppressed under 10.
  - Each fellowship names a host project and a supervisor role card.
  - Award counts are never shown without the completion rate beside them.
- **Depends on:** M10
- **Adjustments learned from waves A to D:**
  - Completion rate is the headline; award counts never appear without it (unit test). Supervisor = role card, host project = an ADVANCE study or research challenge row (synthetic).

##### FS68 · Supplier future-skills readiness
- **Wave / owner:** G · E5 · `m09` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** EU-PACT (EU Pact for Skills, 2025, https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en); SMR-WF (New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH), 2023-2025, https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/); UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce)
- **For:** Partner admins; ENEC supplier management.
- **Problem:** Contractor capability is checked against today's role profiles only.
- **What it does:**
  - Contractor coverage of digital, AI-literacy, cyber-hygiene and other future skills against the 2030 versions of contracted role profiles, per organisation (suppressed under 10), with academy course suggestions.
- **Data:** reads FS05 and F33; RPC supplierFutureReadiness (OwnOrg / A)
- **RBAC:** partner_org OwnOrg; ENEC equivalency A.
- **Acceptance:**
  - A partner sees only its own organisation.
  - Organisations under 10 people show suppressed values.
  - Course suggestions carry reasons from the existing F33 engine.
- **Depends on:** FS05, F33
- **Adjustments learned from waves A to D:**
  - F33 contractor passport is M09 (`contractor.ts`, `teamMatrix.ts`, tables `contract_role_targets`, `task_skill_links`, `contractor_engagements` 73 rows). Use its existing engine for course reasons; compare against FS05 2030 profiles.
  - Partners see only their organisation (OwnOrg); organisations under 10 people show suppressed values.

##### FS69 · Contractor pre-arrival check with selective disclosure
- **Wave / owner:** G · E5 · `m09` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce); 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges); SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp)
- **For:** Contractors; ENEC evaluators.
- **Problem:** Contractor competence is checked on arrival, which costs outage time.
- **What it does:**
  - A contractor shares a curated subset of their passport (FS32 share) with the ENEC evaluator before mobilisation; the evaluator runs the F33 pre-check against it.
- **Data:** reads FS32 shares; RPC precheckFromShare
- **RBAC:** Contractor Own; evaluator A.
- **Acceptance:**
  - Only shared items are visible to the evaluator.
  - The link expires as set.
  - The pre-check result writes no evidence and no qualification status.
- **Depends on:** FS32, F33
- **Adjustments learned from waves A to D:**
  - FS32 shares (`kafaa_record_shares`, RPCs `kafaa_create_record_share` / `kafaa_verify_record_share`) were built for staff learner records. Contractors on supabase have no Kafa'a grant (only local `k-contractor`), so decide how a contractor creates a share (an assessor opens on their behalf, as FS29 RPL does) and log it.
  - The pre-check writes no evidence and no qualification status (test that both tables are unchanged).


### Wave H (digit 8): Signals, Emiratisation quality, reach (8 features)

Live signals (rising skills, hot technologies, inferred skills), Emirati readiness by competency, the future-skills wallet target, digest nudges, Dalil future-skills mode and the student starter.


#### Wave H engineer slots

| Slot | Folder (owned) | Features | Migration | Seed builder | Validator / tests | Note |
|---|---|---|---|---|---|---|
| fsHe1 | `src/modules/m28` | FS70, FS71, FS72 | `20261010281001_kafaa_fs81_skill_signals.sql` | `scripts/seed/ext/fs70-skill-signals.mjs` | `scripts/validate/fs81-*.mjs`, `tests/unit/fs81-*` | Skills Intelligence (FS07/FS08 already here) |
| fsHe2 | `src/modules/m37` | FS73, FS74 | `20261010282001_kafaa_fs82_emirati_wallet.sql` | `scripts/seed/ext/fs73-emirati-wallet.mjs` | `scripts/validate/fs82-*.mjs`, `tests/unit/fs82-*` | National Alignment (FS62/FS63 from wave G) |
| fsHe3 | `src/shell (digest: src/shell/digest/)` | FS75 | `20261010283001_kafaa_fs83_digest_nudges.sql` | `scripts/seed/ext/fs75-digest-nudges.mjs` | `scripts/validate/fs83-*.mjs`, `tests/unit/fs83-*` | Weekly digest; FINALIZE ordering matters for digests |
| fsHe4 | `src/modules/m13` | FS76 | `20261010284001_kafaa_fs84_dalil_future.sql` | `scripts/seed/ext/fs76-dalil-future.mjs` | `scripts/validate/fs84-*.mjs`, `tests/unit/fs84-*` | Dalil (career mode in m13/career/) |
| fsHe5 | `src/modules/m06` | FS77 | `20261010285001_kafaa_fs85_student_starter.sql` | `scripts/seed/ext/fs77-student-starter.mjs` | `scripts/validate/fs85-*.mjs`, `tests/unit/fs85-*` | Talent pipeline and student journey (F34) |

Wave QA: `supabase/migrations/20261010289001_kafaa_fs8qa_integration.sql`, `scripts/seed/ext/fsqa8-integration.mjs`, `scripts/validate/fsqa8-integration.mjs`, `tests/unit/fsqa8-integration.test.tsx`, `tests/e2e/fswaveH.spec.ts`, visual block `fsh`.


#### Wave H cross-feature hand-offs to wire (integration lead)

- **FS70 -> FS75:** the digest reads rising-skill signals as a data-only coupling; agree the table shape early (E1 writes it in its hand-off).
- **FS72 -> FS55:** engine card and fairness snapshot for inferred skills (the FS55 lint test fails otherwise).
- **FS73:** guard excludes observers and partners (note `workforce_analytics` grants observer Agg); protected-input test passes for every engine.
- **FS74 <- FS09/FS31/FS25/FS41:** wallet status from evidence only; FS62 can tag the wallet target to the national strategies.
- **FS75:** `kafaa_dg_gather` final body carries every earlier rule (concept-role exclusion from wave B); include FS33 goals (open gap from wave D) and FS36 AI-literacy requirements; still 7 items max, idempotent per period.
- **FS76:** close QA_B's item (concept-role `careerReadiness` uses FS15); add the evaluation set to the release gate.

#### Wave H QA and integration checklist

- [ ] Five DONE files present; each lists its acceptance tests, live migration parts and digests.
- [ ] Branches `fsHe1`..`fsHe5` merged `--no-ff` in order; `npm run gen` leaves no diff; no conflict markers.
- [ ] Every hand-off above wired in TS and SQL, in the wave QA migration, with a unit test per wiring item.
- [ ] Recorded-evidence lists unioned (3.9) and the final `kafaa_skill_states_v2` / `kafaa_skills_apply` body applied live (md5 equal).
- [ ] Route-count pins updated in all pin files (3.11), with the per-module additions in the comment.
- [ ] Gates green: gen, check:i18n, typecheck, full unit suite (serial chunks), migrations:validate (incl. `fsqa8`), check:public, build.
- [ ] Live: QA migration parts applied; all wave tables count + digest equal; function md5s equal; anon executes nothing new.
- [ ] Route sweep (all routes x 17 sessions) 0 mismatches, 0 text issues; journeys `fswaveH.spec.ts` green; visual RTL + 390 px checked by eye.
- [ ] Protected-input test passes for every engine; FS73 page refused for observers and partners (guard test + sweep).
- [ ] Digest: at most 7 items, idempotent per period, nothing on speak-up routes, every new item has a deep link and a "why" in EN/AR.
- [ ] Dalil: new evaluation set at 95%+ citation; security questions still decline; anonymous answers carry no personal data.
- [ ] FS72: suggestions unreadable by managers (RLS test); rejected suggestions suppressed for 180 days.
- [ ] `deploy_out` rebuilt and checked; ~10 screenshots in `shots_H/`; `QA_H.md` written; `DEPLOY_READY.md` updated; committed on master.
- [ ] Deployed after Armie's explicit go-ahead; verified; `DEPLOY_DONE.md` appended; Armie told.

#### Wave H feature cards

##### FS70 · ENEC Skills on the Rise
- **Wave / owner:** H · E1 · `m28 (Skills Intelligence)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** LINKEDIN (LinkedIn Economic Graph: Skills on the Rise and Work Change, 2025, https://economicgraph.linkedin.com/research); WEF-FOJ (WEF Future of Jobs Report 2025, 2025, https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/); SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf)
- **For:** Employees; HR; L&D.
- **Problem:** Nobody can see which skills are accelerating inside ENEC.
- **What it does:**
  - Three internal signals: skills newly added to goals and profiles, skills held by recent hires, skills in new opportunities and role-profile versions; plus an annual manager pulse ("what share of your team's core skills will change by 2030").
  - A quarterly list with the method published, split into "in demand now" and "growing".
- **Data:** `kafaa_skill_signals`; `kafaa_manager_pulse`; rule risingSkills() TS = SQL
- **RBAC:** Staff R for the published list; Agg for the pulse.
- **Acceptance:**
  - Each listed skill shows which signals moved it.
  - Signals under 10 are suppressed.
  - The method page publishes how each signal is counted.
- **Depends on:** FS02, FS33
- **Adjustments learned from waves A to D:**
  - Signals already in data: FS07/FS33 `skill_goals` + `skill_goal_plans`, recent hires (`kafaa_people.hire_date`), opportunity skills (M20, incl. 15 FS27 channel gigs), `role_profile_versions` (FS05).
  - FS75 (same wave, shell) reads these signals as a data-only coupling: publish a stable table/RPC shape early in the hand-off.

##### FS71 · Hot technologies and in-demand badges
- **Wave / owner:** H · E1 · `m28 (Skills Intelligence)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** ONET (O*NET Hot Technologies and Bright Outlook, 2026, https://onetcenter.org/bright.html)
- **For:** Employees; L&D.
- **Problem:** Tools and technologies that matter (plant historians, scripting, twin platforms, AR inspection) are not visible as a demand signal.
- **What it does:**
  - Generic technology tags (no vendor brands) counted across opportunities and role profiles; "hot across ENEC" separate from "in demand for your role", with published criteria.
- **Data:** `kafaa_technologies`; tag links
- **RBAC:** Staff R.
- **Acceptance:**
  - Criteria are published and badges reproduce from them.
  - No vendor brand name appears in a tag.
  - Past badge lists are kept per quarter.
- **Depends on:** FS05
- **Adjustments learned from waves A to D:**
  - No vendor brand names: add a unit test with a deny-list; keep past quarters (never overwrite).

##### FS72 · "Skills you may have" suggestions
- **Wave / owner:** H · E1 · `m28 (Skills Intelligence)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); LINKEDIN (LinkedIn Economic Graph: Skills on the Rise and Work Change, 2025, https://economicgraph.linkedin.com/research)
- **For:** Employees.
- **Problem:** Inference uses records only; adjacency, co-occurrence, xAPI, gigs and authored knowledge are ignored and the person is never asked.
- **What it does:**
  - Suggestions from skill adjacency, co-occurrence lift, xAPI statements, completed gigs and validated contributions, each with reasons.
  - Confirm, reject or "not me"; nothing becomes visible to a manager until the person confirms; confirmed suggestions become claimed evidence.
- **Data:** `kafaa_skill_suggestions`; RPC respondSuggestion
- **RBAC:** Own only until confirmed.
- **Acceptance:**
  - No suggestion is readable by a manager (RLS test).
  - An engine card and fairness snapshot exist for the surface.
  - A rejected suggestion does not return for 180 days.
- **Depends on:** FS03, F30
- **Adjustments learned from waves A to D:**
  - Own-only until confirmed (RLS test like FS35's health snapshots). Confirmed suggestions become evidence basis `claimed` (never higher).
  - Must add its own engine card and fairness snapshot (FS55 lint test from wave F will fail otherwise). Sources: adjacency (`careerGraph`), co-occurrence (`byCoOccurrence`), xAPI (M27), completed gigs (M20), validated contributions (FS44).
  - Rejected suggestions are suppressed for 180 days (store the rejection date; test with a fixed clock).

##### FS73 · Emirati pipeline by competency
- **Wave / owner:** H · E2 · `m37 (National Alignment)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** NAFIS (Nafis and the Emirati Talent Competitiveness Council, 2026, https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** HR director; executives.
- **Problem:** Emiratisation is reported as headcount; it does not show whether critical and future roles have Emirati-ready successors, or whether people stay and progress.
- **What it does:**
  - For critical and future roles: Emirati-ready successors by readiness band and date, progression into authorised roles (mirror status), retention at 12, 24 and 36 months.
  - Aggregate only and suppressed under 10; nationality is used only for reporting, never in any score (existing protected-input test).
- **Data:** RPC emiratiPipeline (Agg)
- **RBAC:** workforce_analytics Agg/A; never public.
- **Acceptance:**
  - The protected-input test still passes for every engine.
  - Every cell under 10 is suppressed.
  - The page is never reachable by observers or partners (guard test).
- **Depends on:** FS05, F19
- **Adjustments learned from waves A to D:**
  - Succession is F19 in **M23** (`/talent/succession`). Careful: the existing `workforce_analytics` resource grants **observer Agg** and manager Agg, so a plain `{ grant: { res: 'workforce_analytics', levels: ['Agg'] } }` guard would let observers in. Use an `anyRole` guard (hr_analyst, hr_director, auditor) or a new grant, and add a guard test proving observers and partners are refused.
  - `tests/unit/w3e5-no-protected-inputs.test.ts` must keep passing for every engine; nationality is used only inside the suppressed aggregate RPC.

##### FS74 · Future Skills Wallet target
- **Wave / owner:** H · E2 · `m37 (National Alignment)` · **Priority:** P1 · **Complexity:** M
- **Benchmarks:** JAHIZ (Jahiz federal future-skills platform, 2022, https://wam.ae/en/details/1395303102696); UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** All staff; leadership.
- **Problem:** There is no simple, dated whole-workforce goal for future skills.
- **What it does:**
  - A core-five wallet: AI fluency rung 2, cyber hygiene, plant-data basics, one core skill, CleanEnergyComp L1; an organisation counter toward a dated target set by leadership.
  - Each person's wallet links to their development plan so goals and evidence travel together.
- **Data:** `kafaa_wallet_targets`; rule walletStatus() TS = SQL
- **RBAC:** Own wallet; Agg counter (suppressed).
- **Acceptance:**
  - Wallet status is computed from evidence only.
  - The counter shows its definition and target date.
  - The target date and value are a leadership setting, shown with who set them and when.
- **Depends on:** FS09, FS31, FS41, FS25
- **Adjustments learned from waves A to D:**
  - Inputs: FS09 rung (`ai_rungs`, M29), cyber hygiene (`MC-CYBER-HYGIENE`, FS31), plant-data basics (an FS02 skill), one FS25 core skill (M33), CleanEnergyComp L1 (FS41, wave E). Compute from evidence only (TS = SQL).
  - Target date/value is a leadership setting with who/when (like FS09's dated AI-fluency target in `ai_org_targets`); show it as a parameter, not a claim. Link to the person's development plan (`dev_plans`, M04).
  - `national_alignment` has no Own level; read the personal wallet through `skills_profile` Own.

##### FS75 · Future-skills nudges in the weekly digest
- **Wave / owner:** H · E3 · `src/shell (digest)` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** All signed-in staff.
- **Problem:** People do not notice when their role profile changes, a skill in their family rises, or a fast-decaying skill lapses.
- **What it does:**
  - New digest items: my role's 2030 profile was published or changed; a rising skill in my family (read from FS70 signals when present, a data-only coupling); a new future gig or pathway that matches me; a fast-decay skill about to lapse; an AI-literacy requirement for a system I use.
  - Respects existing preferences, quiet hours and the 7-item cap.
- **Data:** digest rules extension (TS = SQL)
- **RBAC:** Own.
- **Acceptance:**
  - Still at most 7 items, and idempotent per period.
  - No nudge on speak-up routes.
  - Each new item has a deep link and a "why" in EN and AR.
- **Depends on:** FS05, FS27, FS36, FS17
- **Adjustments learned from waves A to D:**
  - Digest code: `src/shell/digest/` (`rules.ts`, `useDigest.ts`, `backend/*`, tables `digest_runs`, `digest_prefs`); SQL `kafaa_dg_gather` was last redefined in the wave-B QA (concept-role exclusion; md5 183dc72d). A new redefinition must carry every earlier rule.
  - Close the open gap from wave D: FS33 goals are not yet mentioned in the digest.
  - Seeded digest date is 2026-10-08; FS27 seeded gigs were dated 2026-10-09 on purpose so seeded digests stay unchanged. Keep seeded digests stable or update digests consciously in the QA seed.

##### FS76 · Dalil future-skills mode
- **Wave / owner:** H · E4 · `m13` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SG-CAREER (Careers and Skills Passport, CareersFinder and Career Health SG, 2024-2025, https://www.myskillsfuture.gov.sg/csp); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** Signed-in staff; anonymous visitors (public answers only).
- **Problem:** Dalil cannot answer "how will my role change?" or "what is the ESCO equivalent of this skill?".
- **What it does:**
  - New intents: how my role changes by 2030, which AI rung I need, what a skill means and its crosswalk, which pathway closes my gap; answers cite role maps, skill pages and sources.
  - An evaluation set added to the release gate.
- **Data:** intents and evaluation cases in m13/career
- **RBAC:** Signed-in for personal answers; anonymous gets public content.
- **Acceptance:**
  - The new evaluation set reaches at least 95% citation rate.
  - Security questions still decline.
  - Anonymous questions get public content with no personal data.
- **Depends on:** FS11, FS09, FS08
- **Adjustments learned from waves A to D:**
  - Dalil career mode: `src/modules/m13/career/` (`engine.ts`, `evalset.ts`, `roleplay.ts`). Close QA_B's open item: `careerReadiness` for a concept role asked about directly still uses F05 readiness instead of FS15.
  - Release gate: the evaluation set must reach 95% citation; security questions still decline (existing refusal policies).

##### FS77 · Student future-skills starter and intake baselines
- **Wave / owner:** H · E5 · `m06` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** UAE-AI (UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative, 2025, https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027); NEA (OECD-NEA NEST Framework and Plan 2035, 2024-2025, https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf); UK-NUC (UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports, 2024 (passport trial 2022), https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce)
- **For:** Students; parents; graduate programme owners.
- **Problem:** Students see no future-skills content, and induction re-teaches what AI-fluent school leavers already know.
- **What it does:**
  - An AI-literacy starter and an SMR orientation in the public journey (nothing stored for anonymous visitors).
  - Intake-year baselines so induction can skip content new joiners already hold.
- **Data:** journey content rows; `kafaa_intake_baselines`
- **RBAC:** Public R; HR W for baselines.
- **Acceptance:**
  - Anonymous use stores nothing (existing spy test).
  - All facts cite sources.
  - Induction plans read the baseline for the joiner's intake year.
- **Depends on:** FS09, F34
- **Adjustments learned from waves A to D:**
  - F34 journey is M06 (`journey.ts`, `JourneyPage.tsx`, tables `journey_questions`, `journey_facts`, `student_journeys`, `student_portfolio`). The anonymous-stores-nothing spy test exists; extend it.
  - SMR orientation can reuse FS38/FS39 public content (links), with "no deployment decision implied".


### Wave I (digit 9): Entitlements, transitions, partnerships (7 features)

Longer-cycle mechanisms: a learning balance with protected study time, verified external certificates, an automation gallery with builder credit, transition plans with ladder-rung protection, mobility micro-grants, a consortium trainee cohort and team 2030 targets with an organisation skills inventory. This is the last wave: it ends with the programme close-out (section 7).


#### Wave I engineer slots

| Slot | Folder (owned) | Features | Migration | Seed builder | Validator / tests | Note |
|---|---|---|---|---|---|---|
| fsIe1 | `src/modules/m34` | FS78, FS79 | `20261010291001_kafaa_fs91_balance_external_certs.sql` | `scripts/seed/ext/fs78-learning-balance.mjs` | `scripts/validate/fs91-*.mjs`, `tests/unit/fs91-*` | Recognition (FS29/FS30 already here) |
| fsIe2 | `src/modules/m29` | FS80 | `20261010292001_kafaa_fs92_automation_gallery.sql` | `scripts/seed/ext/fs80-automation-gallery.mjs` | `scripts/validate/fs92-*.mjs`, `tests/unit/fs92-*` | AI and Digital Fluency (FS09/FS10/FS36/FS37 already here) |
| fsIe3 | `src/modules/m30` | FS81 | `20261010293001_kafaa_fs93_transition_plans.sql` | `scripts/seed/ext/fs81-transition-plans.mjs` | `scripts/validate/fs93-*.mjs`, `tests/unit/fs93-*` | Role Transformation (FS11/FS12 already here) |
| fsIe4 | `src/modules/m36` | FS82, FS83 | `20261010294001_kafaa_fs94_grants_consortium.sql` | `scripts/seed/ext/fs82-grants-consortium.mjs` | `scripts/validate/fs94-*.mjs`, `tests/unit/fs94-*` | Skills Ecosystem (FS64/FS65 from wave G) |
| fsIe5 | `src/modules/m17` | FS84 | `20261010295001_kafaa_fs95_team_targets_inventory.sql` | `scripts/seed/ext/fs84-team-targets.mjs` | `scripts/validate/fs95-*.mjs`, `tests/unit/fs95-*` | Skills Passport (team targets F11, credentials, record) |

Wave QA: `supabase/migrations/20261010299001_kafaa_fs9qa_integration.sql`, `scripts/seed/ext/fsqa9-integration.mjs`, `scripts/validate/fsqa9-integration.mjs`, `tests/unit/fsqa9-integration.test.tsx`, `tests/e2e/fswaveI.spec.ts`, visual block `fsi`.


#### Wave I cross-feature hand-offs to wire (integration lead)

- **FS79 -> M17 (E5, same wave):** trust tier shown on the wallet, the learner record (FS32) and credential pages; E1 exports `trustTier()`, the integration lead wires M17 views if E5 has not.
- **FS78 <- FS30/FS18:** balance in credits (1 credit = 10 hours) from the FS30 ledger; spend only on FS18 outcome-gated items.
- **FS80 <- FS36:** each automation links its `ai_systems` row; builder evidence joins the recorded-evidence union.
- **FS81 <- FS11/FS06:** rung alerts name tasks and the simulator/OJT practice added (F28 in M04, F38 in M02).
- **FS82/FS83:** budgets SIMULATED; visits evidence after host confirmation (recorded-evidence union).
- **FS84 <- FS05/F11:** `team_skill_targets.horizon`; data-quality panel TS = SQL; suppressed heatmap.
- **Programme close-out:** after wave I's QA, run the final full sweep and all journeys (A to I), update `DEPLOY_READY.md`, deploy, and write the final report (section 7).

#### Wave I QA and integration checklist

- [ ] Five DONE files present; each lists its acceptance tests, live migration parts and digests.
- [ ] Branches `fsIe1`..`fsIe5` merged `--no-ff` in order; `npm run gen` leaves no diff; no conflict markers.
- [ ] Every hand-off above wired in TS and SQL, in the wave QA migration, with a unit test per wiring item.
- [ ] Recorded-evidence lists unioned (3.9) and the final `kafaa_skill_states_v2` / `kafaa_skills_apply` body applied live (md5 equal).
- [ ] Route-count pins updated in all pin files (3.11), with the per-module additions in the comment.
- [ ] Gates green: gen, check:i18n, typecheck, full unit suite (serial chunks), migrations:validate (incl. `fsqa9`), check:public, build.
- [ ] Live: QA migration parts applied; all wave tables count + digest equal; function md5s equal; anon executes nothing new.
- [ ] Route sweep (all routes x 17 sessions) 0 mismatches, 0 text issues; journeys `fswaveI.spec.ts` green; visual RTL + 390 px checked by eye.
- [ ] FS78: balance = grants minus approved use (TS = SQL); ungated items cannot be charged.
- [ ] FS79: unverified certificates never above "claimed"; trust tier visible on wallet, record and credential pages.
- [ ] FS80: metadata only, nothing executes; evidence only after approval and first adoption.
- [ ] Programme close-out: final full sweep + every FS journey spec (A to I) on the deployed commit; final report (section 7.4).
- [ ] `deploy_out` rebuilt and checked; ~10 screenshots in `shots_I/`; `QA_I.md` written; `DEPLOY_READY.md` updated; committed on master.
- [ ] Deployed after Armie's explicit go-ahead; verified; `DEPLOY_DONE.md` appended; Armie told.

#### Wave I feature cards

##### FS78 · Learning balance and protected study time
- **Wave / owner:** I · E1 · `m34 (Recognition)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** ENTITLE (SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK), 2024-2025, https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling)
- **For:** Employees; managers.
- **Problem:** Shift workers lack time more than money, and nobody can see a personal learning balance.
- **What it does:**
  - A visible annual balance (credits and hours, SIMULATED) with a mid-career top-up, spendable only on an outcome-gated catalogue with published criteria.
  - Protected study hours requested and approved (maker-checker) in the portal.
- **Data:** `kafaa_learning_balances`; `kafaa_study_time_requests`; RPCs requestStudyTime, decideStudyTime
- **RBAC:** Own; line manager in scope; HR A.
- **Acceptance:**
  - The balance equals grants minus approved use (TS = SQL).
  - Ungated items cannot be charged to the balance.
  - Study-time decisions need a second person and write an audit row.
- **Depends on:** FS30
- **Adjustments learned from waves A to D:**
  - FS30 credit unit: 1 credit = 10 notional hours; `kafaa_credit_ledger` and `creditsFor()` = `kafaa_cr_compute`. The outcome-gated catalogue is FS18 (`catalogue_criteria`, `external_resources`, M19).
  - Study-time decisions: maker-checker (line manager in scope, never the requester); FS27's time-envelope approval is the closest pattern.

##### FS79 · Verified import of external certificates
- **Wave / owner:** I · E1 · `m34 (Recognition)` · **Priority:** P2 · **Complexity:** S
- **Benchmarks:** CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/); SKILLS-TECH (Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play, 2024-2026, https://www.techwolf.ai/customer-stories/workday); 1EDTECH (Open Badges 3.0, CLR 2.0 and CASE, 2024, https://www.1edtech.org/standards/open-badges)
- **For:** Employees; verifiers.
- **Problem:** External certificates (university, professional bodies, online courses) stay outside the record.
- **What it does:**
  - Enter certificate metadata and a verification URL; a verifier confirms; the crosswalk maps it to skills.
  - Trust tiers shown on the credential: ENEC-assessed, accredited third party, vendor self-serve.
- **Data:** `kafaa_external_certs`; RPC verifyExternalCert
- **RBAC:** Own; verifier A.
- **Acceptance:**
  - Unverified certificates never become evidence above "claimed".
  - The tier is visible wherever the credential appears.
  - Verified imports map to skills only through reviewed crosswalk rows.
- **Depends on:** FS08
- **Adjustments learned from waves A to D:**
  - Crosswalk = FS08 `skill_alignments` (M28); only reviewed rows map. Trust tier must show wherever the credential appears (wallet and learner record in M17, owned by E5 in the same wave): expose a pure `trustTier()` and let the integration lead wire M17 views.

##### FS80 · Automation and agent gallery with builder credit
- **Wave / owner:** I · E2 · `m29 (AI and Digital Fluency)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42); AI-LIT (EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks, 2024-2026, https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices)
- **For:** Staff who build; AI governance.
- **Problem:** Learning is credited for consuming content, never for building a useful, governed tool.
- **What it does:**
  - Staff submit a governed automation (purpose, data used, owner, AI-system register link); AI governance approves; an adoption counter tracks reuse.
  - Approved, adopted entries write builder evidence. Kafa'a never runs the automation.
- **Data:** `kafaa_automations`; RPCs submitAutomation, decideAutomation, adoptAutomation
- **RBAC:** ai_literacy W (submit), A (ai-governance), R (staff).
- **Acceptance:**
  - Nothing executes inside Kafa'a (no code storage, metadata only).
  - Evidence is written only after approval and first adoption.
  - Each entry links to its AI-system register row.
- **Depends on:** FS36
- **Adjustments learned from waves A to D:**
  - Link each entry to `kafaa_ai_systems` (FS36). Metadata only: no code, no URLs that execute. Builder evidence after approval **and** first adoption (recorded-evidence list update).

##### FS81 · Transition plans and ladder-rung protection
- **Wave / owner:** I · E3 · `m30 (Role Transformation)` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** SSG-SF (SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks, 2025, https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf); SG-JTM (Jobs Transformation Maps, 2025, https://wsg.gov.sg/for-employers/jobs-transformation-maps.html); CORP (Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials, 2014-2025, https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/)
- **For:** Employees in changing roles; HR; training managers.
- **Problem:** When AI takes over junior tasks, people lose the practice that builds judgement, and role changes are not managed as investments.
- **What it does:**
  - A transition plan object (SIMULATED HR): protected role, retraining plan, target role and review dates for people whose role is changing.
  - A ladder-rung alert: for Mastery Builder roles, when FS06 shows junior tasks becoming automated, the training plan must add synthetic practice (simulator, OJT repetitions).
- **Data:** `kafaa_transition_plans`; rule rungAlert() TS = SQL
- **RBAC:** transformation A (HR); Own for the person.
- **Acceptance:**
  - Every alert names the tasks and the practice added.
  - Plans are visible to the person and HR only.
  - Plans are labelled SIMULATED and carry review dates.
- **Depends on:** FS11, FS06
- **Adjustments learned from waves A to D:**
  - Inputs: FS11 `role_transformations`, `transformation_archetypes` (M30), FS06 task exposure (M26). Practice added = simulator scenarios (F28, M04 `sim_scenarios`) or OJT repetitions (F38, M02 `ojt_logs`).
  - Plans visible to the person and HR only (`transformation` A for HR, Own for the person); managers get nothing unless the card is changed. Label SIMULATED with review dates.

##### FS82 · Rolling mobility micro-grants
- **Wave / owner:** I · E4 · `m36 (Skills Ecosystem)` · **Priority:** P3 · **Complexity:** S
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677)
- **For:** Early-career staff (up to 10 years); students on placements.
- **Problem:** Small, fast funding for conferences, short courses and site visits waits for the annual budget cycle.
- **What it does:**
  - Bi-monthly rounds with a light application and approval; outputs (report, presentation) logged as evidence. Budgets are SIMULATED.
- **Data:** `kafaa_grant_rounds`; `kafaa_grant_applications`; RPC decideGrant
- **RBAC:** Own; HR A.
- **Acceptance:**
  - Rounds open and close on schedule; decisions are audited.
  - Budgets are labelled SIMULATED.
  - Statistics under 10 are suppressed.
- **Depends on:** FS01
- **Adjustments learned from waves A to D:**
  - Budgets SIMULATED; statistics suppressed under 10; rounds open/close by date (test with a fixed clock).

##### FS83 · UAE energy consortium trainee cohort
- **Wave / owner:** I · E4 · `m36 (Skills Ecosystem)` · **Priority:** P3 · **Complexity:** M
- **Benchmarks:** NUC-NET (Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS, 2019-2026, https://cordis.europa.eu/project/id/101061677); UAE-PEERS (ADNOC AI upskilling and EGA Academy, 2025, https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42)
- **For:** Graduates; partner organisations (synthetic); programme owners.
- **Problem:** Energy employers compete for the same graduates instead of growing the pool together.
- **What it does:**
  - A multi-employer cohort object (ENEC with synthetic partner organisations): shared modules, a project and a mentor (Nordic NNTP pattern), with cross-site visit logging.
- **Data:** `kafaa_consortium_cohorts`; members, visits
- **RBAC:** Partner OwnOrg; HR A.
- **Acceptance:**
  - Each partner sees only its own trainees.
  - Visits write evidence after host confirmation.
  - Partner organisations are synthetic and labelled as such.
- **Depends on:** FS20
- **Adjustments learned from waves A to D:**
  - Builds on FS20 academies and cohorts (M04). Partner organisations are synthetic and labelled. Visits write evidence only after host confirmation (same pattern as FS39).

##### FS84 · Team 2030 capability targets and an organisation skills inventory
- **Wave / owner:** I · E5 · `m17` · **Priority:** P2 · **Complexity:** M
- **Benchmarks:** ISO30414 (ISO 30414:2025 human capital reporting, 2025, https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html); IAEA-WFP (IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework, 2011 (current reference), https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf)
- **For:** Managers; HR.
- **Problem:** Team targets describe the present only, and HR has no skill-level inventory or data-quality view.
- **What it does:**
  - Team targets for 2028 and 2030 derived from FS05 versions, with the gap from team to future profile.
  - An organisation inventory heatmap across all skills by area and entity (suppressed) and a data-quality panel: profile coverage, staleness, share validated.
- **Data:** team_skill_targets.horizon (additive); RPC orgSkillInventory (Agg)
- **RBAC:** skills_profile Scope (managers), Agg (HR).
- **Acceptance:**
  - Cells under 10 are suppressed.
  - Data-quality figures reproduce from rules (TS = SQL).
  - Each team target shows the 2030 role-profile version it came from.
- **Depends on:** FS05, F11
- **Adjustments learned from waves A to D:**
  - `kafaa_team_skill_targets` (M17, 24 rows) gets an additive `horizon` column (default current). Show the FS05 `role_profile_versions` version each 2030 target came from.
  - Data-quality panel: profile coverage, staleness (FS03 decay / FS54 review dates), share validated; TS = SQL. Heatmap cells under 10 suppressed. Use `scopedPersonIds` for manager reads.


---

## 5. The process that worked

### 5.1 Shape of one wave

1. **Build (parallel).** Five engineers, one per slot, each in its own git worktree and branch off `master` (`git -C /workspace/kafaa worktree add /workspace/kafaa-fs<W>e<n> -b fs<W>e<n> master`, then symlink `node_modules`). Each implements its cards completely (pages, rules, RPCs in both backends, SQL, seed, validator, unit tests, EN/AR), runs the gates on its own files, **applies its own migration live in parts and verifies digests**, commits on its branch and writes `fs<W>e<n>_DONE.md`. Engineers do not touch route-count pins or run browsers. Wall time per engineer in waves A to D: about 2 to 4 hours.
2. **Integrate and QA (one lead).**
   1. Merge the five branches into `master` in slot order with `--no-ff` (`ref/qa_scripts/merge.sh`): generated files take "ours" and are regenerated with `npm run gen`; the CONTRACT changelog keeps both sides; shared invariant lists (recorded-evidence tables) are unioned; any other conflict stops the script for a manual fix. Check for leftover conflict markers.
   2. Wire the cross-feature hand-offs listed for the wave (section 4) and in the five DONE files, in TS and SQL, in the wave QA migration `202610102<w>9001_kafaa_fs<w>qa_integration.sql`, with its own seed (`fsqa<w>-integration.mjs`, `FINALIZE_LAST`), PGlite validator and unit test (one test per integration criterion).
   3. Update the route-count pins (3.11) with a comment listing the new routes per module.
   4. Gates: gen (no diff), check:i18n, typecheck, check:public, migrations:validate, vite build, then the **full unit suite serially in chunks** (`ref/qa_scripts/unit.sh` + `lanes.sh`; 3 lanes in parallel was the most the container tolerated). Fix every failure; most post-merge failures were fixtures that assumed the pre-merge seed, seed-boot timeouts and route pins.
   5. Apply the QA migration live in parts; load QA seed rows (`on conflict do nothing`); replay guarded refreshes (gap backlog, credit ledger, `kafaa_skills_apply` for affected people); verify function md5s and table digests for every wave table (3.10). Record the digest table in the QA report.
   6. Browser E2E (one Chromium, `workers=1`, `vite preview`, supabase mode, build made with `.env.local`):
      - **Full route sweep:** all routes x 17 sessions (about 4,900 checks at 288 routes; plan for **about 2 hours**, split into two runs with `E2E_ONLY` if a background time limit applies). Expect 0 mismatches and 0 text issues (no raw i18n keys, "undefined", "NaN" or placeholder text).
      - **Journeys** `tests/e2e/fswave<W>.spec.ts`: one or more per feature, covering every acceptance criterion. Live writes are limited to audited refusals and undoable steps; flows that leave evidence run on the local backend (`toLocal` helper). Undo any live write the journey makes.
      - **Visual** `visual.spec.ts -g fs<w>`: every new page in Arabic RTL and at 390 px, contact sheets checked **by eye** (horizontal scroll, overflowing chips, unreadable colours and mono-font Arabic were the usual bugs).
   7. Fix every bug, rerun until green, commit on `master`.
   8. Rebuild `deploy_out` (`npm run build:deploy`), check the badge lines, issuer JSON, `ojt-sw.js`, `_redirects`, secrets grep; save about 10 screenshots (8 EN, 1 AR, 1 mobile) to `{{NOTES}}/shots_<W>/`; update `DEPLOY_READY.md`; write `QA_<W>.md` (merge, wiring, live digests, gates, sweep counts, journeys, visual, bugs fixed, remaining issues).
3. **Deploy** (2.5), only with Armie's go-ahead in your session, then append to `DEPLOY_DONE.md` and tell Armie (one paragraph: what is new, the link, anything open).

### 5.2 Engineer prompt (paste once per slot)

```text
Context: "Kafa'a" is the employee upskilling / career / future-workforce portal that is part of ENEC NEXUS (a demo
platform for ENEC, the Emirates Nuclear Energy Company; not affiliated with ENEC). Code: {{REPO}} (branch master; read
CONTRACT.md in full incl. the changelog, README.md, and the latest {{NOTES}}/QA_*.md). We are building the FUTURE SKILLS &
COMPETENCIES programme: the plan with every feature card (benchmarks, data, RBAC, acceptance criteria), conventions
(section 2), rules (section 1) and wave table (section 5) is {{NOTES}}/PLAN.md; the handover {{NOTES}}/HANDOVER_WAVES_E_TO_I.md
section 3 (conventions) and section 4 (your cards with "Adjustments learned") override the plan where they differ. Follow
them exactly. Research: {{NOTES}}/research/*.md (real benchmark facts only from there, with source URLs). Every feature
page shows its <BenchmarkChips feature="FSnn" /> from kafaa_benchmarks.
Boundaries: never git push; never touch Netlify; Supabase project hlirqxoddysxtdezwcgv: Armie approved additive kafaa_*
objects/data only (never alter/drop/modify NEXUS objects or rows; no DROP/DELETE/TRUNCATE, and avoid those words even in
comments or strings because the Supabase tool cancels such SQL). Validate migrations locally first (npm run
migrations:validate), then apply with the Supabase apply_migration tool in parts (kafaa_fs<w><e>_<topic>_p1, _p2...);
load seed rows with insert ... on conflict (id) do nothing; verify live function bodies (md5 of prosrc) and row digests
match local, and list them in your hand-off. Synthetic people only. Full EN + AR (RTL). Both backends (local + supabase).
You have a turn limit: batch work into scripts and avoid one-off tool calls. The container has limited memory: run unit
tests one file at a time (npx vitest run --maxWorkers=1 --minWorkers=1 tests/unit/<file>, TMPDIR=/dev/shm), never
several heavy processes at once, and only your own plus directly affected test files.
Gates before you finish: npm run gen, check:i18n, typecheck, unit tests (a named test per acceptance criterion),
migrations:validate, check:public, npx vite build. Do NOT run Playwright/browsers.

You are FS wave {{W}} engineer fs{{W}}e{{N}}. Implement {{FEATURES}} from the handover section 4 completely: every
screen, behaviour, RBAC rule and acceptance criterion; polished, demo-impressive, native look using the UI kit, engines
and <WhyThis>; rich synthetic seed via scripts/seed/ext/. You own ONLY: {{FOLDER}}, plus your i18n namespace files, your
migration file(s) {{MIGRATION}}, seed builder {{SEED}}, validator scripts/validate/fs{{w}}{{N}}-*.mjs and tests
tests/unit/fs{{w}}{{N}}-*. If you must write into a table owned by another module, add a kafaa_* SECURITY DEFINER RPC in
your own migration; if you add an evidence ref_table, follow handover 3.9; log anything shared in the CONTRACT.md
changelog. Leave route-count pins for the integration lead. Work in a git worktree:
`git -C {{REPO}} worktree add {{REPO}}-fs{{W}}e{{N}} -b fs{{W}}e{{N}} master` (symlink node_modules). Commit on your branch
(stage only your files). Write {{NOTES}}/fs{{W}}e{{N}}_DONE.md (acceptance tick list with the test name for each
criterion, routes, tables/RPCs, live parts applied and digests, tests, gates, gaps and hand-offs for the integration lead)
and return a ~100-word summary.
```

Placeholders: `{{REPO}}` = `/workspace/kafaa`; `{{NOTES}}` = your notes folder holding `PLAN.md`, `research/`, the QA reports and this handover; `{{W}}` = wave letter, `{{w}}` = wave digit, `{{N}}` = slot 1 to 5; `{{FEATURES}}`, `{{FOLDER}}`, `{{MIGRATION}}`, `{{SEED}}` from the wave's slot table.

### 5.3 Integration lead prompt (one per wave)

```text
{{RULES block from 5.2, unchanged, except: "Do NOT run Playwright" does not apply to you}}

You are the FS wave {{W}} integration + QA lead.{{RESUME_NOTE}} Merge fs{{W}}e1..fs{{W}}e5 into master in {{REPO}}
(hand-offs in {{NOTES}}/fs{{W}}e<n>_DONE.md) with --no-ff, using a merge script like {{NOTES}}/qa_scripts/merge.sh
(generated files: ours + npm run gen; CONTRACT changelog: keep both; recorded-evidence invariant lists: union; anything
else: stop and resolve by hand; fail on leftover conflict markers). Wire the cross-feature hand-offs listed for wave {{W}}
in handover section 4 and in the DONE files, in TS and SQL, in the wave QA migration
supabase/migrations/202610102{{w}}9001_kafaa_fs{{w}}qa_integration.sql with seed scripts/seed/ext/fsqa{{w}}-integration.mjs,
validator scripts/validate/fsqa{{w}}-integration.mjs and tests/unit/fsqa{{w}}-integration.test.tsx (one test per wiring
criterion). Update the route-count pins (handover 3.11) and add a CONTRACT changelog entry "FS wave {{W}} integration and
QA". Keep the Netlify badge-hiding lines in index.html and the issuer-keys files/redirects. Run all gates; run the full
unit suite serially in chunks (qa_scripts/unit.sh, at most 3 lanes). Ensure every wave migration is applied live and seed
rows loaded (counts + id/row digests + function md5s match; list them). Then browser E2E (one Chromium, workers=1)
against vite preview of a build made with .env.local, in supabase mode: the full route sweep (all routes x all 17
sessions; split in two runs with E2E_ONLY if needed) and new journeys tests/e2e/fswave{{W}}.spec.ts covering every
wave-{{W}} acceptance criterion (live writes only as audited refusals or undone steps; evidence-writing flows on the
local backend), plus visual.spec.ts -g fs{{w-letter}}: Arabic RTL and 390 px shots of every new page, checked by eye on
contact sheets. Fix every bug; rerun until green. Then rebuild {{REPO}}/deploy_out with npm run build:deploy and check
it as in handover 2.5 step 2; save ~10 screenshots (8 EN, 1 AR, 1 mobile) to {{NOTES}}/shots_{{W}}/; update
{{NOTES}}/deploy/DEPLOY_READY.md. Commit on master. Write {{NOTES}}/QA_{{W}}.md (merge, wiring, live apply and digests,
gates, sweep counts, journeys, visual, bugs fixed, remaining issues) and return a ~150-word summary.
```

`{{RESUME_NOTE}}` (only when restarting an interrupted integration): " IMPORTANT: a previous integration attempt was interrupted. First inspect the repo state (git status, git log, any in-progress merge, which branches are merged, which migrations are already applied live via list_migrations) and continue from where it stopped rather than redoing completed steps."

### 5.4 Deployer prompt

```text
You are the deploy step for Kafa'a FS wave {{W}}. Armie approved this deploy in this session ("{{APPROVAL TEXT}}",
{{TIME}} UTC). Site: Netlify enec-kafaa, id 24579361-38f3-42b5-87cd-6f7a6f75f046 (team Mawaheb). NEVER touch the
enec-nexus site (69afeda6-b3fd-4de8-8173-af9fe3ba3327) or enecai.xyz; only read it to confirm it still publishes
6abece0c8021c4c58397f533.
1. Check {{REPO}}/deploy_out was built from the final master: git status clean; build time newer than the last
   source commit (or the later commits touch only tests/docs; prove it by grepping a string from them in the bundle);
   both badge-hiding lines in deploy_out/kafaa/index.html; issuer JSON at deploy_out/.well-known/kafaa-issuer.json and
   deploy_out/kafaa/issuer/kafaa-issuer.json; deploy_out/kafaa/ojt-sw.js; the four _redirects lines with the
   /kafaa/.well-known/* rule above the SPA rule; grep -rE "service_role|sb_secret_" deploy_out finds nothing.
   If anything fails, rebuild with npm run build:deploy and check again.
2. Netlify tool netlify-deploy-services-updater, operation deploy-site, siteId 24579361-38f3-42b5-87cd-6f7a6f75f046.
   Run the returned npx command from {{REPO}}/deploy_out (cd there first). Never print the proxy URL in output,
   notes or reports. Poll until the deploy state is ready; record the deploy id and permalink.
3. Verify with curl: / -> 302 /kafaa/; {{NEW_PATHS}} and their /kafaa/ar/ twins -> 200; the three issuer JSON paths ->
   200 application/json; /kafaa/ojt-sw.js -> 200. Then headless Chromium (one browser): home with 0 console errors and
   the Netlify badge hidden; sign in as {{PERSONA}} through the role-card screen; open {{NEW_PAGES}} (expect their
   headings, 0 console errors, 0 4xx/5xx); Arabic toggle gives lang=ar, dir=rtl. Save screenshots to {{NOTES}}/verify/.
4. Append "FS wave {{W}} deploy: DONE" (deploy id, permalink, build entry files, checks, verification, enec-nexus
   untouched) to {{NOTES}}/deploy/DEPLOY_DONE.md and return a ~80-word summary.
If the deploy call or the upload is denied by a permission check, stop, record "BLOCKED" with the exact denial text in
DEPLOY_DONE.md, and report back: Armie must approve it in the session or add an allow rule.
```

### 5.5 Running it

- With a workflow/orchestration tool (as the old session did): `ref/workflows/kafaa-fs-wave-wf_35ab6118-397.js` (one wave: `parallel()` of five `agent()` engineer calls, then one integration `agent()`), and `kafaa-fs-waves-c-to-i-wf_2b89c991-7cc.js` (several waves in sequence). Change the `SP` path to `{{NOTES}}`, the `RULES` text to the 5.2 block, and the `WAVES` table to section 4's slots.
- Without one: start five sub-agents with the engineer prompt (one per slot), wait for all five DONE files, then one sub-agent with the integration prompt, then the deployer prompt once Armie says go. The coordinating agent reads each DONE file and QA report and relays a short status to Armie.
- Do not start wave N+1 engineers before wave N is merged into `master`: cards depend on earlier waves' tables and rules.
- Armie checks in with "how is it going?" at intervals; answer with what is done, what is running, what is next, and anything blocked on him.

### 5.6 Lessons learned (waves A to D)

1. **Turn limits:** sub-agents ran out of turns when doing many small tool calls. Write scripts (merge, gates, unit lanes, live SQL apply, digest compare) and run them in one call; write logs to `{{NOTES}}`.
2. **Deploy permission** needs the user's explicit go-ahead in the session that deploys (the classifier blocked `deploy-site` as "Production Deploy" and the upload as "Data Exfiltration" even with a standing approval given elsewhere).
3. **Supabase MCP cancels SQL containing "delete" or "drop"** (and some rows whose text contains guarded keywords: `consents`, the `applications` / `application_events` history and one `content_pages` row were held back and are still not loaded live). Avoid those words in migrations (comments and strings too), apply in parts (parts of about 60 KB worked), and send large seed inserts as compact SQL that rebuilds rows server-side when possible (FS31 rebuilt signed awards with `kafaa_badge_sign(kafaa_mc_credential(...))` and proved it in PGlite).
4. **Flaky 5 s vitest timeouts:** the seed boot reads a 19 MB seed; `testTimeout` is 90 s and `hookTimeout` 60 s. Use `findBy*` for async renders.
5. **The full route sweep takes about 2 hours** (1.4 h + 49 min in wave B at 227 routes; it grows with routes). Split it in two runs; rerun a single failing session with `E2E_ONLY`; rerun modules with `E2E_MODULES`.
6. **Container memory and disk:** OOM kills (exit 137) and ENOSPC happened when five engineers ran tests at once. Engineers run focused tests only; the lead runs the full suite in at most 3 lanes; clean your own stale vitest temp folders; `TMPDIR=/dev/shm`.
7. **Engineers must apply their own SQL live.** One wave-A engineer forgot (FS03), and the QA lead had to apply it. The DONE file must list the live part names and digests.
8. **Generated files always conflict.** Take ours and run `npm run gen`; never hand-merge `seed.json`, `seed.sql`, `types.gen.ts` or the generated SQL.
9. **Shared invariants drift.** Lists of recorded-evidence tables live in several tests and validators; union them on merge and keep the final SQL redefinition complete (3.9).
10. **Concept roles leak.** FS05 concept roles were picked up by pre-existing engines (Navigator, career moves, fairness, digest, agenda). Every new engine over roles must exclude `lifecycle = 'concept'` unless the card is about future roles.
11. **Post-merge data effects:** new seed content changes other features' numbers (FS10 evidence changed F35 outlook supply; FS31 credentials took an assessment slot in FS17; FS27 gigs filled gap-backlog steps). The QA step restores released outputs or updates expectations deliberately and logs why.
12. **Mobile and RTL bugs are found only by eye:** horizontal scroll at 390 px, nowrap chips, white-on-teal text, eyebrow styles leaking into chips, Arabic set in the mono font. Always look at the contact sheets.
13. **RLS performance:** manager reads over person-keyed tables can hit the 8 s statement timeout; use `scopedPersonIds`.
14. **Seeds dated after the demo digest date (2026-10-08)** keep seeded digests and fairness snapshots unchanged; seeds dated earlier change them, which then needs a deliberate QA update.
15. **Check-constraint widening needs a DROP** (evidence `kind`, `engine_settings.surface`): design around it with `ref_table` and defaults-only surfaces.
16. **Netlify does not publish nested dot-folders** (`/kafaa/.well-known/`); `make-deploy.mjs` already places the issuer JSON at the root and adds the rewrite. Keep it.
17. **Never echo credentials:** the Netlify proxy URL, the demo password, any token. Grep the bundle for `service_role` and `sb_secret_` before every deploy.

---

## 6. Known open issues and leftovers

**At handover**
- Wave D integration was in progress (uncommitted edits on `master` in M20/M28 pages, i18n and `fsqa3` files; E2E running). Check section 0 / Step 0.
- The source has **no git remote**. Suggest Armie creates a private GitHub repository for Kafa'a and asks you to push once; do not push without being asked.

**Live data residue from E2E journeys (all synthetic, harmless, documented)**
- `kafaa_digest_runs` holds extra journey rows (395 live vs 393 seed after wave A, more since); F06 change-log rows added by journey A5 (the edit itself is restored each run); `ct:p-sro:fr-owners-engineer` and `ct:p-buyer:fr-owners-engineer` career targets (inactive); `ftp:p-nse:trk-orientation` steps reset to `[]`; audited refusals in `kafaa_audit_events`.
- Live `kafaa_person_skills` has more rows than the seed (journey and live-site activity, e.g. p-nse 16 vs 14, p-rao 22 vs 19), so FS35 health snapshots for p-nse and p-rao were computed on live data; the credit ledger has 10 live-only rows from training records created on the live site. These are expected; never "fix" them with deletes.
- Seed rows held back by the Supabase guard (never loaded live): `consents`, `applications` / `application_events` demo history, one `content_pages` row. Loading them needs Armie's explicit approval; the SQL was in the old scratchpad (`qa/load_deferred/`) and can be regenerated with `scripts/seed-chunks.mjs`.

**Known gaps a later card should close**
- Dalil F37 `careerReadiness` for a concept role asked about directly still uses F05 readiness, not FS15 (QA_B) -> **FS76**.
- The digest does not mention FS33 goals (fsDe3) -> **FS75**.
- FS07 "Add to my goals" (`setSkillGoal`, M28) creates a goal with no date; `/my/skills/goals` asks for one and sharing is refused until a plan exists (fsDe3). Optional fix in **FS70** (M28 owner, wave H).
- F15 rotation enrolment is HR-driven and not gated by strategic credentials (wave-D integration decision; the unlock note is advisory).
- Contractors have no Kafa'a grant on supabase, so they cannot self-start RPL (by design; an assessor opens on their behalf) -> relevant to **FS69**.
- Concept roles were filtered in the Navigator, career moves, F24 and the digest only; readers in M20, M21 and M23 were not audited (QA_A) -> check in **FS73** (M23 reads) and any wave touching M20/M21.
- Transform and assess engine overrides cannot be stored in `engine_settings` (four-value surface check) -> **FS55** documents it in the engine cards.
- Other large person-keyed reads by Scope-only readers may approach the 8 s timeout as live data grows (QA_C).
- `engine_cards` rows for experts, marketplace, mentoring and rotations differ live from local -> **FS55**.
- Three foundation functions (`kafaa_dalil_turn`, `kafaa_signoff_evaluation`, `kafaa_log_denied`) differ live only by stripped comments (benign).
- The FS03 half-life tile shows "18" twice (fast class and the cyber-hygiene override; cosmetic).
- Vite chunk-size warnings (seed chunk about 16.8 MB, 1.5 MB gzip); consider code-splitting the seed only for the local backend.
- Pre-existing test quirks: `g1-pages` crew availability is date-dependent; `w5qa-integration` validator fails only when run alone.

**Platform-level items for Armie**
- **`enecai.xyz/kafaa/` mount (Phase 2)** is not done. It needs one `enec-nexus` deploy that keeps NEXUS's four Netlify functions (`adsb`, `celestrak`, `hls`, `news`); the NEXUS source zip with those function sources is required, and the Netlify API cannot download it. Then add `/kafaa /kafaa/ 301` and `/kafaa/* https://enec-kafaa.netlify.app/kafaa/:splat 200` above the NEXUS SPA rule (details: `ref/deploy/DEPLOY_PLAN.md`, `DEPLOY_READY.md` Phase 2). Out of scope unless Armie asks.
- **Demo signing key:** the F04 credential wallet's server key `key-1` has its private seed inside the migration (function `kafaa_badge_issuer_seed()`, not executable by API roles). It is a demo key; **rotate it before any real use.** The local backend signs with a separate labelled `key-offline`.
- The NEXUS demo password is baked into the public bundle by design (NEXUS ships the same); it is not a secret in the usual sense but must still never be committed or written into reports.
- Benchmark figures from sites the research container could not reach (weforum.org, oecd-nea.org, unesco.org) come from corroborated secondary reports; a human should re-read the primary pages before any figure goes into executive copy (PLAN section 8).
- NQF levels and credits (FS30) and university award stacks are indicative until a partner and the NQC agree; the UI says so.

---

## 7. Definition of done and final report

### 7.1 Per feature

- Every acceptance criterion in its card is met and has a **named unit test** (and a journey step in `fswave<W>.spec.ts`).
- Pages: EN + AR complete, RTL correct, usable at 390 px, loading/empty/error states, `<BenchmarkChips>`, `<WhyThis>` on ranked items, SIMULATED / not-an-authority / no-deployment-decision copy where the rules require it, sources with as-of dates.
- Data: tables and RPCs in both backends, SQL = TS proven in PGlite, RLS per persona tested, suppression under 10, audit (and ledger where material) rows, grants (anon nothing new; authenticated only RPCs), additive migration applied live, digests equal.

### 7.2 Per wave

- Five branches merged, wiring done, QA migration applied live and digests equal; route pins updated; CONTRACT changelog entries (five engineer entries + the integration entry).
- Gates green: gen (no diff), check:i18n, typecheck, full unit suite, migrations:validate, check:public, build, build:deploy.
- Full route sweep 0 mismatches; all wave journeys green; visual RTL + 390 px checked by eye; about 10 screenshots.
- `QA_<W>.md` written; `deploy_out` rebuilt; deployed with Armie's go-ahead and verified; `DEPLOY_DONE.md` appended; Armie told.

### 7.3 Whole programme (after wave I)

- All 84 FS features (FS01 to FS84) are live on https://enec-kafaa.netlify.app/kafaa/; every PLAN section 7 measure that has a feature behind it is visible somewhere in the product (as SIMULATED demo data where applicable).
- A final full sweep and every FS journey spec (A to I) pass on the deployed build's commit.
- No NEXUS object or row was changed; `enec-nexus` still publishes `6abece0c8021c4c58397f533` unless Armie changed it himself.
- `README.md` and `CONTRACT.md` describe the final state; `DEPLOY_READY.md` lists every migration; the final report below is delivered to Armie (and, if he wants, published as a page).

### 7.4 Final report template

```markdown
# Kafa'a future-skills programme: final report (waves E to I)

**Live:** https://enec-kafaa.netlify.app/kafaa/ · deploy <id> (<date>) · master <commit>

## Summary
<3-5 sentences: what was built, how it was checked, what is open>

## Delivered
| Wave | Features | New routes | Tables / RPCs | Migrations (live parts) | Deploy id |
|---|---|---|---|---|---|
| E | FS38-FS49 | ... | ... | ... | ... |
| F | FS50-FS59 | ... | | | |
| G | FS60-FS69 | ... | | | |
| H | FS70-FS77 | ... | | | |
| I | FS78-FS84 | ... | | | |

## Numbers
Routes <n> (from 288) · tables <n> · seed rows <n> · migrations <n> · unit test files <n> / tests <n> · validators <n> · sweep <routes> x 17 = <checks>, 0 mismatches

## Quality evidence
- Gates: gen / i18n / typecheck / unit / migrations / public / build (all green, <date>)
- Live = local: <n> functions md5-equal; <n> tables digest-equal (list or link to QA reports)
- Journeys: fswaveE..I <n>/<n>; visual RTL + 390 px: <n> pages checked
- QA reports: QA_E.md ... QA_I.md

## Feature-by-feature acceptance
<one line per FS38..FS84: done / partial (why) + test file>

## Open issues and recommendations
<carry-overs from section 6 that remain, new ones, suggested next steps>

## Things Armie needs to do
<e.g. rotate the demo signing key, decide on the enecai.xyz mount, approve deferred seed rows, create a git remote>
```

---

## Appendix A. Benchmarks (the 40 ids used in the cards, copied from PLAN.md section 4)

| ID | Benchmark | Owner, where | Year | What Kafa'a borrows | Source |
|---|---|---|---|---|---|
| WEF-FOJ | WEF Future of Jobs Report 2025 | World Economic Forum; International | 2025 | Core-skill change per role, a rising/stable/declining trend field on every skill, and a transversal core-skills family. | https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/ |
| OECD-PIAAC | OECD Survey of Adult Skills (PIAAC), Cycle 2 | OECD; 31 countries | 2024 | Adaptive problem solving as its own assessed scale, and a benchmark line on every score shown to a person. | https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html · https://www.cso.ie/en/releasesandpublications/ep/p-piaac/programmefortheinternationalassessmentofadultcompetenciespiaac2023/keyfindings |
| OECD-AICI | OECD AI Capability Indicators | OECD; International | 2025 | A five-level AI capability rating per task, compared with the human requirement to flag augmentable tasks. | https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report |
| ILO-RPL | ILO Skills and Lifelong Learning Strategy 2030; recognition of prior learning | International Labour Organization; International | 2023 | A structured RPL flow (request, evidence, assessor, credit) and re-assessment on each skill's own validity clock. | https://www.ilo.org/global-skills-programme · https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning |
| EU-PACT | EU Pact for Skills | European Commission; EU | 2025 | "% of workforce trained this year" as the headline KPI, and numeric commitments from suppliers and partners. | https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en |
| ESCO | ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations) | European Commission; EU, 28 languages incl. Arabic | 2025 | Reusability level on every skill, Arabic preferred and alternative labels, obsolete-not-deleted, and a published crosswalk. | https://esco.ec.europa.eu/en/about-esco/what-esco · https://esco.ec.europa.eu/en/classification/skill_main |
| DIGCOMP | DigComp 2.2 / 3.0 digital competence framework | European Commission JRC; EU | 2022 / 2025 | A digital and AI ladder with plant-specific examples, extra weight on safety and problem solving, and a "% above basic" indicator. | https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en |
| GREENCOMP | GreenComp, with EntreComp and LifeComp | European Commission JRC; EU | 2022 | The 4 x 3 authoring method for an ENEC CleanEnergyComp, LifeComp as the home for human skills, and EntreComp for intrapreneurship. | https://joint-research-centre.ec.europa.eu/greencomp |
| FORECAST | Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035 | Skills England (UK); Cedefop (EU); UK / EU | 2025 | One declared baseline with bands, "pressure now" kept apart from "demand later", a methodology-change banner, a "not yet modelled" list, and a regional demand-to-provider loop. | https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030 · https://www.cedefop.europa.eu/en/datasets/dataset-skills-forecast |
| ONET | O*NET Hot Technologies and Bright Outlook | US Department of Labor; United States | 2026 | Role and technology badges with published thresholds, past lists kept, and a three-tier consumer label. | https://onetcenter.org/bright.html · https://onetcenter.org/reports/Hot_Technologies_Demand.html |
| LIGHTCAST | Lightcast Open Skills and Skillabi | Lightcast; International | 2025 | Skill types, stable IDs and a dated changelog; a curriculum coverage score with the list of skills nothing teaches. | https://lightcast.io/blog/open-skills-taxonomy · https://lightcast.io/resources/blog/skillabi-press-release-june-3-2025 |
| LINKEDIN | LinkedIn Economic Graph: Skills on the Rise and Work Change | LinkedIn; International | 2025 | A three-signal rising-skill detector on ENEC's own data, and AI literacy separated from AI engineering. | https://economicgraph.linkedin.com/research |
| MCK-DELTA | McKinsey DELTAs (Distinct Elements of Talent) | McKinsey Global Institute; International (18,000 people, 15 countries) | 2021 | The inclusion rule as taxonomy governance, and "proficiency against needed" as the main chart. | https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work |
| ISO30414 | ISO 30414:2025 human capital reporting | ISO TC 260; International | 2025 | A Skills, Capabilities and Development disclosure pack where every metric has a definition, owner narrative, variance note and audit trail. | https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html |
| 1EDTECH | Open Badges 3.0, CLR 2.0 and CASE | 1EdTech; International | 2024 | A CLR-shaped learner record, credentials that point at a competency ID, and a CASE-shaped framework export. | https://www.1edtech.org/standards/open-badges · https://www.1edtech.org/standards/clr |
| SFIA9 | SFIA 9 (Skills Framework for the Information Age) | SFIA Foundation; International | 2024 | Generic level attributes across all skills, level essence lines, skills defined only at real levels, and a public change tracker. | https://sfia-online.org/en/sfia-9/sfia-9-release-notes |
| SSG-SF | SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks | SkillsFuture Singapore; Singapore | 2025 | A task layer between role and skill, AI exposure per task, role archetypes with ladder-rung protection, and a core-skills set. | https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf |
| SG-CAREER | Careers and Skills Passport, CareersFinder and Career Health SG | SSG, MOM, WSG; Singapore | 2024-2025 | A provenance badge on every record, curated sharing with expiry, adjacency moves backed by real transitions, and a visible career-health check. | https://www.myskillsfuture.gov.sg/csp · https://www.mom.gov.sg/newsroom/speeches/2025/0710-speech-by-min-at-career-health-summit-2025 |
| SG-JTM | Jobs Transformation Maps | Workforce Singapore; Singapore | 2025 | A per-role transformation page: technology drivers, tasks added or removed, the redesigned profile and a dated reskilling path. | https://wsg.gov.sg/for-employers/jobs-transformation-maps.html · https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2025/1104-written-answer-to-pq-on-update-on-jobs-transformation-maps |
| ENTITLE | SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK) | MOE/SSG Singapore; DfE England; Singapore / UK | 2024-2025 | A visible learning balance, an outcome-gated catalogue, protected study time, and a credit unit for every learning asset. | https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling · https://www.gov.uk/government/publications/lifelong-learning-entitlement-lle-overview/lifelong-learning-entitlement-overview |
| FSC | Future Skills Centre Impact Report 2025 | Future Skills Centre (ESDC-funded); Canada | 2025 | A pilots registry (hypothesis, comparison group, evaluator, published result including failures) and an adoption-rate KPI. | https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf |
| UPKEEP | Australia National Skills Taxonomy (ASC retired) and Korea NCS | Jobs and Skills Australia; MOEL Korea; Australia / Korea | 2024-2025 | Review dates and staleness flags, skills derived from artefacts already maintained, and an annual orphan-rate audit. | https://www.jobsandskills.gov.au/australian-skills-classification · https://moel.go.kr/english/news/moelNewsDetail.do?idx=3137 |
| JAHIZ | Jahiz federal future-skills platform | UAE Government Development and the Future Office + FAHR; UAE | 2022 | The four-group structure plus a nuclear fifth group, a wallet tied to the development plan, and a dated whole-workforce target. | https://wam.ae/en/details/1395303102696 · https://u.ae/en/information-and-services/jobs/training-and-development/Strategies-for-improving-digital-skills-and-eGovernment-literacy |
| UAE-NQF | UAE National Qualifications Framework and NQC work-experience recognition | National Qualifications Centre (MoHESR); UAE | 2024 / 2026 | An NQF level on every credential and learning asset, an RPL package NQC-recognised assessors can review, and ENEC as a pilot employer. | https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses · https://uaelegislation.gov.ae/en/legislations/2615/download |
| MOHRE | MoHRE occupational classification and skill levels | Ministry of Human Resources and Emiratisation; UAE | current (read 2026) | An occupation code and national skill level on every role, and a skill-level uplift metric. | https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme · https://gulfnews.com/uae/government/uae-workforce-jumps-124-in-2025-as-new-firms-surge-mohre-says-1.500416665 |
| NAFIS | Nafis and the Emirati Talent Competitiveness Council | ETCC + MoHRE; UAE | 2026 | Emirati readiness by competency for critical and future roles, plus retention at 12/24/36 months. | https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership · https://www.zawya.com/en/press-release/events-and-conferences/uaes-emiratisation-drive-enters-a-new-outcomes-era-eiojkgck |
| UAE-AI | UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative | UAE Government; DGE Abu Dhabi; UAE | 2025 | A dated AI-capability target, approved-use classes for AI tools, and intake-year baselines for new joiners. | https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027 · https://dge.gov.ae/en/what-we-do |
| IAEA-WFP | IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework | IAEA; International | 2011 (current reference) | Scenario bands rather than point estimates, a fill plan per gap, and a "why this competency exists" link to its activity. | https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf · https://www.iaea.org/sites/default/files/20/11/nicf.pdf |
| IAEA-1917 | IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities | IAEA; International | 2020 | A behavioural track with the same evidence model as technical skills, and situational judgement items for safety behaviours. | https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf |
| IAEA-AI | IAEA AI for nuclear energy ("Atoms for Algorithms") | IAEA; International | 2025 | An operational Nuclear + AI skill family: AI output verification and the duty to challenge it, twin validation, anomaly triage. | https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence · https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/ |
| OT-CYBER | IAEA NSS 42-G computer security and NICE Framework v2.0 OT role | IAEA; NIST/CISA; International / US | 2021 / 2025 | Stable statement IDs, and cyber hygiene for all staff while security roles stay at career-path level only. | https://www.iaea.org/node/97473 · https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering |
| NEA | OECD-NEA NEST Framework and Plan 2035 | OECD Nuclear Energy Agency; International (15 countries in NEST) | 2024-2025 | Fellowships inside real projects, an expert lecture library that doubles as knowledge capture, and a Future Leaders track. | https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf · https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development |
| UK-NUC | UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports | UK Government and industry; Sellafield with Digital Catapult; United Kingdom | 2024 (passport trial 2022) | A transferable-skills translator for career-changers, sector target tracking, and selectively disclosable passports. | https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce · https://www.digicatapult.org.uk/wp-content/uploads/2022/07/Digital_Catapult_Sellafield_DLT_Field_Labs_Report_Final-July-22-ver-2.pdf |
| SMR-WF | New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH) | OPG, GE Vernova Hitachi, Sask Polytech, NuScale, GIFEN; Canada / US / France | 2023-2025 | An SMR delta per existing role, cross-over courses, plant-literacy simulation for non-operators, and an annual job-by-job refresh. | https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/ · https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center · https://www.nucleareurope.eu/blog/highlight-of-the-month/match-program-a-tool-for-nuclear-capacity-building-in-france/ |
| NUC-NET | Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS | ENEN; Fortum/TVO/Uniper/Vattenfall; IAEA; KEPCO; EU / Nordics / International / Korea | 2019-2026 | Rolling micro-grants, multi-employer cohorts (modules + project + mentor), sponsored study with placement, and a nuclear-management competency model. | https://cordis.europa.eu/project/id/101061677 · https://www.fortum.com/careers/NNTP · https://www.iaea.org/node/136445 · https://www.iaea.org/node/17745 |
| ENERGY-JOBS | IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025 | IEA; IRENA with ILO; International | 2025 | External shortage lines beside internal numbers, an automation factor in demand, and a public skills-pledge mechanic. | https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025 · https://build-up.ec.europa.eu/en/resources-and-tools/publications/annual-review-2025-renewable-energy-and-jobs |
| AI-LIT | EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks | European Commission AI Office; UNESCO; EU / International | 2024-2026 | An AI-literacy register per AI system, provider vs deployer literacy, maturity labels, and a 4-dimension AI competency grid. | https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices · https://gcedclearinghouse.org/en/node/146447 |
| UAE-PEERS | ADNOC AI upskilling and EGA Academy | ADNOC; Emirates Global Aluminium; UAE | 2025 | AI learning whose output is a built artefact, AI-fundamentals coverage as a board KPI, and national trainee cohorts. | https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42 · https://www.wam.ae/en/article/blmzwis-ega-launches-ega-academy |
| CORP | Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials | AT&T; IBM; Schneider Electric; Unilever; Google; International | 2014-2025 | Honest role decline signals, a strategic badge tier with consequences, a time envelope for gigs, and market data separated from outcomes. | https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/ · https://workofthefuture-taskforce.mit.edu/document/2020-working-paper-qi-kochan · https://gloat.com/wp-content/uploads/Schneider-Electric-Gloat-Case-Study.pdf · https://services.google.com/fh/files/misc/new_google_career_certificates_impact_report.pdf |
| SKILLS-TECH | Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play | Vendors; International | 2024-2026 | Inferred-skill suggestions the person confirms, multi-source proficiency, adaptive assessment, and role-play practice with saved feedback. | https://www.techwolf.ai/customer-stories/workday · https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/ · https://workera.ai/skills-intelligence-platform · https://training.talent.linkedin.com/introducing-role-play-with-ai-coach |

Figures are as reported in the research packs; items the packs flag as secondary or unverified (for example WEF ranks 4-10, Deloitte multiples, vendor ROI claims) are not used anywhere in this plan.

## Appendix B. How success is measured (PLAN.md section 7)

| Area | Measure | Baseline (audit, seed) | Target | Benchmark | Features |
|---|---|---|---|---|---|
| Taxonomy | Skills with an international alignment and a source | 0 of 71 | 100% of 110+ skills; every alignment cites a URL and as-of date | ESCO, SFIA9 | FS02, FS08 |
| Taxonomy | Skills past their review date (staleness) and orphan rate | not measured | staleness under 5%; orphan rate (no course, assessment or role) under 10% | UPKEEP | FS54 |
| Roles | Roles with a published 2030 profile; future roles with a path | 0 of 28; 0 of 11 | 28 of 28; 11 of 11 | SG-JTM | FS05, FS11 |
| AI fluency | Staff at AI fluency rung 2 (Practitioner) or above | 3 people hold the AI skill | dated target set by leadership (demo: 60% of staff by end-2027), shown as a counter | UAE-AI, UAE-PEERS, JAHIZ | FS09, FS74 |
| AI governance | AI systems with full literacy coverage of their users | no register | 100% of registered systems at "fully implemented" | AI-LIT | FS36 |
| Learning supply | Future skills with a levelled pathway; skills held by nobody | 3 courses; 6 skills unheld | every future skill has a L1-L2 pathway; 0 skills with no learning route | LIGHTCAST, UPKEEP | FS17, FS19, FS57 |
| Learning impact | Courses with a measured skill-level change after 90 days | not measured | reported for every future-skill course with 10+ completers | FSC, ISO30414 | FS56 |
| Coverage | % of workforce trained this year; quarterly active learners | not reported | reported with definition, narrative and variance each quarter | EU-PACT, ISO30414 | FS60 |
| Mobility | Opportunities that build a future skill | 2 of 25 | 10 or more open at any time, across 5 channels | CORP, NEA | FS27, FS28 |
| Future readiness | Future Me readiness reachable through evidence | ceiling about 20-30 | every family can reach 100 through recorded learning and practice | SMR-WF | FS13 |
| Recognition | Credentials carrying an NQF level and credit; RPL decisions | 0 | every published credential tagged; RPL flow used end to end in the demo | UAE-NQF, ILO-RPL | FS29, FS30 |
| Emiratisation quality | Critical and future roles with an Emirati-ready successor by date; retention at 12/24/36 months | headcount aggregates only | reported by competency, suppressed under 10 | NAFIS | FS73 |
| Experiments | Skills pilots adopted, expanded or further funded | no registry | reported against the FSC reference of 78% | FSC | FS61 |
| Engineering gates | Every feature: TS = SQL validator, EN/AR parity, suppression, route sweep, fairness card for new rankings | in place for 38 features | 100% of the new features | — | FS01, FS55 |

All targets are demo targets on synthetic data; a dated organisation target (for example the AI-fluency counter) is a leadership decision and is shown as a parameter, not a claim.

## Appendix C. What is in `ref/`

| Path | What it is |
|---|---|
| `PLAN.md` | The full FS plan: rules, conventions, themes, 40 benchmarks, wave table, all 84 cards, success measures, risks. |
| `audit.md` | Read-only audit of master before the FS programme (40 gaps). |
| `research/*.md` | The four benchmark research packs (global frameworks, national systems, nuclear and energy, corporate platforms). Only facts from these, with their URLs. |
| `BACKLOG.md` | The base features F01 to F38. |
| `QA_A.md`, `QA_B.md`, `QA_C.md` (`QA_D.md` if present) | Wave integration and QA reports. |
| `handoffs/fs<W>e<n>_DONE.md` | All 25 engineer hand-offs from waves A to D (best templates: wave D). |
| `deploy/DEPLOY_READY.md`, `DEPLOY_DONE.md`, `DEPLOY_PLAN.md` | Deploy procedure, every past deploy with its checks, and the enecai.xyz mount analysis. |
| `workflows/*.js` | The workflow scripts that ran the waves (one-wave and multi-wave). |
| `qa_scripts/*.sh` | Merge, gates and serial unit-test lane scripts from the wave-D integration (paths inside point at the old scratchpad; change them). |
