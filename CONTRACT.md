# Kafa'a build contract

This is the agreement between the foundation (F) and the five module groups (G1 to G5) building Kafa'a in parallel.
Read it once, in full, before you write code. If something you need is not here, follow the change process in section 10
instead of working around the foundation.

- App: `/workspace/kafaa` (Vite + React 18 + TypeScript + Tailwind + React Router 6). Base path `/kafaa/`, Arabic under `/kafaa/ar/...`.
- Spec: `docs/spec-rev-a.txt` (Spec Rev A). Route table: spec section "Information architecture". Access matrix: `docs/RBAC.md`.
- Backends: `local` (default; in-browser store seeded from `src/seed/seed.json`) and `supabase` (live `kafaa_*` objects in NEXUS project `hlirqxoddysxtdezwcgv`). Pages never know which one they are on.
- Done means `npm run verify` passes (gen, i18n check, typecheck, unit tests, migration validation, public payload check, build, Playwright smoke).

## 1. Non-negotiables

1. **No real ENEC staff names or photos** anywhere: seed, copy, screenshots or tests. People are role cards ("Training Manager (role card)") or synthetic workers (`w-ro-01`).
2. **Kafa'a is not an authority.** Qualification and licence screens are labelled mirrors of the licensee's systems (`SimChip`, "mirror" badges). Never say a FANR certificate is issued or valid because Kafa'a says so.
3. **Security-sensitive content stays out.** Security, safeguards and cyber roles show the career path only, and status only as qualified or not qualified. No clearance details, medical details, exam content or plant security arrangements.
4. **Speak-up (`/speak-up`, M08) sends no analytics or audit events.** The route guard has `noTelemetry: true`; do not add `logDenied`, toasts that write, or any repository write there. The smoke test checks the network.
5. **Secrets.** Never commit the NEXUS demo password. It reaches the app only through `VITE_NEXUS_DEMO_PASSWORD` in an uncommitted `.env.local`. Never paste tokens into code, tests or prompts.
6. **Kafa'a-only personas** (`k-*`, marked `*` in section 9) exist only in Kafa'a tables. Never create NEXUS auth users, profiles or rows in any non-`kafaa_` table for them.
7. **Additive database changes only.** Only `kafaa_*` objects. Never alter or drop NEXUS objects. Module engineers never apply anything to the live project; the foundation does (section 7).
8. **Small groups are suppressed.** Any aggregate cell under `MIN_GROUP_SIZE` (10) shows "suppressed", never a value. Use `suppress()` from `src/domain/rules.ts` and the SQL aggregate RPCs.
9. **Git.** Stage only the files you changed (`git add <paths>`, never `git add .` or `-A`). Do not push. End every commit message with the two trailer lines the coordinator gives you.

## 2. Layout and ownership

```
src/
  modules/mNN/           one folder per module: routes.ts + one default-exported page component per route   (module group)
  i18n/mNN.{en,ar}.json  module strings                                                                      (module group)
  i18n/{common,shell}.*  shared strings                                                                      (F)
  ui/                    UI kit (section 5)                                                                  (F)
  shell/                 layout, nav, search, notifications, Dalil launcher, placeholders                    (F)
  auth/                  session, NEXUS session reuse, policy matrix (policy.ts), guards                     (F)
  data/                  repository interface, both backends, schema DSL, generated types                    (F + RPC rule)
  domain/rules.ts        pure business rules shared by both backends and pages                               (F, additions by request)
  routes/                module catalogue + route registry                                                   (F)
  seed/                  generated seed.json, personas, NEXUS snapshot                                       (generated)
scripts/seed/*.mjs       seed builders by area (framework, learning, assess, people, partners, content)     (F; add rows by request)
supabase/migrations/     SQL (first five files generated or foundation-owned; group files in section 7)
tests/unit, tests/smoke  vitest and Playwright
docs/                    RBAC.md (generated), spec-rev-a.txt
```

| Group | Modules | Folders you own | Tables you own (`src/data/schema.ts`, `module:`) |
|---|---|---|---|
| G1 | M01 career map, M02 competency and qualification, M03 licensing | `src/modules/m01..m03`, `src/i18n/m01..m03.*` | job_families, job_roles, role_responsibilities, career_paths; proficiency_levels, competencies, role_competencies, qual_standards, task_items, evaluator_quals, qual_records, evaluations, requal_rules; licences, medical_due, shift_proficiency, exam_milestones, requal_cycles, licence_programmes, licence_candidates, reporting_obligations, licensing_tasks |
| G2 | M04 learning and training (incl. training paths), M05 assessments | `src/modules/m04, m05` | programmes, courses, course_modules, sessions, simulator_slots, enrolments, training_records, curriculum_rules, external_requests, certificates, dev_plans, plan_activities, mentors, mentoring_requests; jpms, items, item_versions, blueprints, assessment_forms, attempts, responses, jpm_results, appeals |
| G3 | M06 talent pipeline, M07 workforce analytics, M10 universities and research | `src/modules/m06, m07, m10` | talent_programmes, applications, application_events, vacancies, events; workforce_snapshots, kpi_series, critical_roles, observer_reports, scenarios; scholar_cohorts, scholars, internships, research_challenges, research_proposals |
| G4 | M09 partners and suppliers (incl. supplier onboarding and training), M11 future workforce | `src/modules/m09, m11` | organisations, agreements, partner_onboarding, supplier_readiness, equivalency_requests, icv_plans; adv_technologies, skill_bridges, future_skills |
| G5 | M12 public site, M08 safety culture, M13 Dalil, M16 admin console + NEXUS integration, M14 pages | `src/modules/m08, m12, m13, m14, m16` | contact_requests, facts, faqs; sc_traits, hu_tools, oe_lessons, ecp_channels, concern_cases; corpus_docs, advisor_sessions, advisor_turns, eval_runs, refusal_policies, dalil_settings; people, role_assignments, consents, notifications, user_settings, data_requests (M14); sources, content_pages, integrations, audit_events (M16) |
| F | M15 bilingual experience, sign-in page, shell | everything not listed above | glossary, ledger_local |

`src/modules/m14/SignInPage.tsx` is finished (F). G5 owns the other M14 pages (`/my`, `/my/profile`, `/my/settings`, `/admin/access`).
Cross-module reads are fine (G3 reads `job_roles`); cross-module writes go through the owning group's RPC or a request.

## 3. Pages and routes

- Each route is declared in `src/modules/mNN/routes.ts` with `id`, `path`, `module`, `zone`, `guard`, optional `nav`, `parent` and `spec`. The registry (`src/routes/registry.ts`) collects them and validates ids, paths and parents at start-up. You may add routes to your own `routes.ts`; keep ids stable (they are i18n keys and test ids).
- Every route already has a placeholder page that renders `<ModulePlaceholder routeId=…/>`. **Replace the placeholder body and keep the file name and the default export.**
- Paths are written without `/kafaa` and without `/ar`. Link with `<L to="/careers/paths">`, `href('route-id', params)` and `useNav()` from `src/i18n`; they add the base and the language prefix. Never hard-code `/kafaa` or `/ar`.
- Start each page with `<Page title={t('mNN.routes.<id>.title')} intro={…}>`. Breadcrumbs, nav, header, footer, the rehearsal banner and the Dalil launcher come from the shell.
- Every data view needs loading, empty and error states: `<Async state={q}>`, `EmptyState`, `ErrorState`, `Skeleton`. No route may crash: `RouteView` has an error boundary, but the smoke test fails on uncaught page errors.
- Add `data-testid` to the primary list or table and to primary actions of each page (`data-testid="mNN-<thing>"`).

## 4. Data access (the repository rule)

```ts
import { useRepo, useQuery, useAction } from '../../data';
const repo = useRepo();
const roles = useQuery('job_roles', () => repo.list('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }));
const act = useAction();
await act(() => repo.rpc.signoffEvaluation({ record_id, task_id, result: 'pass' }), { success: t('m02.signoff.done') });
```

- Pages use **only** `useRepo()` / `useQuery()` / `useAction()`. Never import `LocalBackend`, `SupabaseBackend` or `@supabase/supabase-js` in a module.
- Reads: `list`, `get`, `count` with `Query` (`filter`, `search`, `order`, `limit`, `offset`). Row-level security is applied by both backends identically (`src/data/access.ts` mirrors `kafaa_rule_read`); a page shows what the repository returns and never filters for security itself.
- Direct writes (`insert`, `update`) are allowed only where the table's `write.mode` is `'direct'` in `schema.ts`. Tables with `mode: 'rpc'` or `'append'` change only through `repo.rpc.*`.
- **Consequential actions are RPCs.** Sign-offs, decisions, approvals, status changes, role grants, anything that must be audited or recorded in the NEXUS ledger. Each RPC returns `Result` `{ ok, code, message, audit_seq, ledger_seq, data }` and never throws for a business refusal. Show `message` (it is user-facing), branch on `code`.
- **Every RPC exists three times and they must agree:**
  1. signature in `Rpc` (`src/data/types.ts`),
  2. local implementation in `src/data/local/rpc.ts` (same checks, same audit row, a `ledger_local` row standing in for the NEXUS ledger),
  3. SQL `kafaa_<name>` SECURITY DEFINER function (`set search_path = public`, refusals via `kafaa_refuse`, audit via `kafaa_audit`, ledger via `kafaa_ledger`, result via `kafaa_result`), plus its mapping in `SupabaseBackend.rpc`.
  Add a unit test in `tests/unit/` for the local path and an assertion in `scripts/validate-migrations.mjs` (PGlite) for the SQL path. Revoke the new function from `public, anon` and grant it to `authenticated`.
- Existing RPCs (use them, do not duplicate): `signoffEvaluation`, `setLicenceStatus`, `detectLicensingEvents`, `decidePartnerOnboarding`, `decideApplication`, `triageConcern`, `decideEquivalency`, `getEquivalency`, `observerReportAction`, `screenResearchChallenge`, `setDalilEnabled`, `reviseStandard`, `grantRole`, `approveRole`, `revokeRole`, `itemReview`, `recordJpm`, `bookSimulator`, `assignCurriculum`, `verifyCertificate`, `workforceAggregate`, `applicationFunnel`, `logDenied`, `auditVerify`.
- NEXUS data is read-only through `repo.nexus.*` (personas, authority, trainingPrograms, peopleQuals, ecoCourses, ecoEnrolments, ecoScholarships, ecoPartnerships). `source` says `live` or `snapshot`; show a `SimChip` for snapshot data.
- Business rules shared by pages and backends live in `src/domain/rules.ts` (`addWorkingDays`, `quarterOf`, `proficiency`, `licenceView`, `medicalView`, `qualView`, `routeChecks`, `suppress`, `scoreJpm`, `canDisplace`). Use them; do not re-implement.

### Schema and seed changes

- `src/data/schema.ts` is the single source for tables, columns, indexes, read rules and write modes. You may add columns or tables **for your own module**, appended inside your module's block. Then run `npm run gen`, which regenerates `src/data/types.gen.ts`, the first three migration files, `supabase/seed.sql`, `src/seed/seed.json` and `docs/RBAC.md`.
- Never hand-edit generated files. If a rebase conflicts in a generated file, take either side and re-run `npm run gen`.
- Seed rows come from `scripts/seed/*.mjs`. Add rows for your tables in the matching builder; keep ids stable and readable (`qs-ro`, `w-ro-01`). No real names; every public fact carries a `sources` entry.
- `npm run migrations:validate` applies all migrations plus the seed to PGlite twice (idempotence) and runs the RLS/RPC checks. It must pass.

## 5. UI kit (`src/ui`, import from `'../../ui'`)

- Layout: `Page`, `Section`, `Card`, `Grid`, `StatTile`, `KeyValue`, `Callout`, `Tabs`, `Timeline`, `Stepper`.
- Status and provenance: `StatusPill` (uses `common.status.*` labels), `SimChip` (simulated/mirror data), `SourceLink` (every public fact links its source and "as of" date).
- States: `Async`, `Skeleton`, `EmptyState`, `ErrorState`.
- Data: `DataTable` (sorting, paging, CSV via `toCsv` + `downloadText`), `FilterBar` + `useFilters`.
- Forms: `useForm` with validators `required`, `email`, `minLen`, `maxLen`, `pattern`, `numberRange`; fields `TextField`, `TextArea`, `SelectField`, `CheckboxField`, `RadioGroup`. Validation messages come from `common.validation.*`.
- Overlays: `Modal`, `Drawer`, `ConfirmDialog` (use it before every consequential RPC), toasts via `useToast` (or `useAction`).
- Charts (SVG, RTL-aware, accessible tables behind them): `BarChart`, `LineChart`, `Donut`, `Funnel`, `Heatmap`, `ProgressRing`, `ProgressBar`. Career graphs: `CareerLadder`, `PathGraph`, `layoutGraph`.
- `Icon` (inline SVG set). Colours and type come from the NEXUS tokens in `src/styles/index.css` (`ink`, `ink-2`, `line`, `panel`, `accent`, `ok`, `warn`, `bad`). Do not add new colours or fonts.
- Need a new shared component? Build it inside your module first; if a second group needs it, request promotion to `src/ui` (section 10).

## 6. Language, RTL and accessibility (M15)

- All visible text comes from i18n: `const t = useT();` keys `mNN.routes.<id>.title|purpose` (already present) and `mNN.<page>.<key>` for page text. Add every key to **both** `mNN.en.json` and `mNN.ar.json`; `npm run check:i18n` fails the build on a missing or empty Arabic key.
- Bilingual data columns are `*_en` / `*_ar`: render them with `const pick = usePick(); pick(row, 'title')`.
- Numbers, dates, durations and currency go through `useFormat()` (Latin or Arabic-Indic digits and Gregorian or Hijri calendar follow user settings).
- Use logical Tailwind utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). No `left`/`right`, no `ml-`/`mr-`. Icons that imply direction flip with `rtl:-scale-x-100`.
- Semantic HTML, labelled form fields, visible focus, keyboard reachable actions, `aria-live` for async results (toasts already are). Charts render a data table alternative.

## 7. Access control, audit and ledger

- Roles and the resource matrix are defined once in `src/auth/policy.ts` (rendered in `docs/RBAC.md`, loaded into `kafaa_policy_matrix`). Levels: `R`, `Own`, `Scope`, `Agg`, `W`, `A`, `OwnOrg`, `OrgW`.
- Route guards (`guard` in routes.ts): `{}` public; `{ signedIn: true }`; `{ anyRole: [...] }`; `{ grant: { res, levels } }`; `noTelemetry` for speak-up. Deny by default. Denied visits are logged through `logDenied` (except `noTelemetry` routes).
- In a page, hide or disable actions the user cannot take with `<Can res="signoff" levels={['A']}>…</Can>` or `useSession().roles`. The backend still enforces everything; the UI only avoids dead ends.
- Audit: every RPC writes one `kafaa_audit_events` row (hash-chained, append-only, also on refusals). Pages never write audit rows directly.
- Ledger: material actions also append to the NEXUS evidence ledger through `kafaa_ledger(action, reason)` (`USER_ACTION`, plane `PEOPLE`, domain `KAFAA`, the caller's NEXUS role). Kafa'a-only personas have no NEXUS profile, so their ledger status is `skipped`; that is expected.
- Supabase: the five foundation migrations plus `20261008120600_kafaa_grants_hardening.sql` are applied to `hlirqxoddysxtdezwcgv`. **Groups do not apply SQL to the live project.** Put new SQL in your own file, named `supabase/migrations/2026100813<g>NNN_kafaa_g<g>_<topic>.sql` (G1 = `20261008131xxx`, G2 = `…132xxx`, G3 = `…133xxx`, G4 = `…134xxx`, G5 = `…135xxx`), never in the shared files, and make it idempotent (`create or replace`, `if not exists`). Note it in your hand-off; the foundation applies it after review. The live MCP refuses statements that drop anything, so write additive SQL only.

## 8. Tests and checks

- `npm run verify` before every commit. Individually: `npm run gen`, `check:i18n`, `typecheck`, `test:unit`, `migrations:validate`, `check:public`, `build`, `test:smoke`.
- Smoke (`tests/smoke`) visits every route in `routes.ts` files automatically: anonymous, as `k-ro`, `training-mgr` and `alnoor-gm`, and in Arabic. It fails on uncaught page errors or a guard mismatch (sign-in or forbidden screen shown when it should not be, or missing when it should be). New routes are covered without editing the test.
- Add module tests as `tests/unit/mNN-*.test.ts` (vitest, LocalBackend in memory, see `tests/unit/local-backend.test.ts`) and Playwright journeys as `tests/smoke/mNN.spec.ts` when the spec's acceptance list asks for a flow.
- `npm run check:public` fails if a public payload carries a person name, email or photo URL.
- Optional live check (foundation): `KAFAA_E2E_PASSWORD=… node scripts/e2e-supabase.mjs [--write]`.

## 9. Personas (local backend: all 57; supabase backend: the 43 NEXUS role cards)

`*` = Kafa'a-only persona (local backend only). Sign in at `/kafaa/sign-in`.

| Platform role | Personas |
|---|---|
| public | (anonymous) |
| applicant | k-student\*, k-graduate\* |
| employee / trainee | k-lo-trainee\*, buyer, doa-signatory, nse, sme-reviewer, fuel-pm, outage-planner, cap-coord, sec-compliance, qc-inspector |
| licensed_operator | k-ro\*, sro, k-instructor\* |
| manager (line manager / shift supervisor) | sro, ops-ceo, outage-manager, work-control, rp-lead, chem-sup, ep-manager, emergency-director, group-ceo and other NEXUS leaders |
| instructor / evaluator | training-mgr, k-instructor\*, head-sq, sq-lead, ep-manager, rp-lead |
| training_manager | training-mgr |
| licensing_coord | k-licensing-coord\*, dra, rao |
| hr_analyst | k-hr-analyst\*, chco |
| hr_director (CHCO office) | chco |
| partner_user | alnoor-qaqc, alnoor-sales, meridia-pd, k-contractor\* |
| partner_admin | alnoor-gm, gulfhydro-qa |
| university | k-university\* |
| observer | k-observer\* |
| editor | k-editor\*, head-sustainability, sustainability-lead |
| ecp_officer | k-ecp\* |
| admin | k-admin\*, ai-governance |
| auditor | k-auditor\*, board-secretary, compliance, independent-approver, presenter |

Exact grants and scopes: `src/seed/seed.json` → `personas[]` and `role_assignments`.

## 10. Changes to this contract

Need a foundation change (shared UI component, new rule in `rules.ts`, a field in a table you do not own, a new route outside your module, shell behaviour)? Do not edit foundation files. Write the request at the top of your hand-off under "Contract requests" with the exact change; the foundation lands it and records it below. Small fixes to a foundation bug that blocks you may be made if the fix is a few lines, clearly correct, and listed in your hand-off.

### Changelog

- **2026-10-08 · v1.0** Initial contract. 85 routes scaffolded, 94 tables, 24 RPCs, two backends. Supabase: schema, policy matrix, RLS, RPCs and NEXUS reads applied to `hlirqxoddysxtdezwcgv`; grants hardened after the advisor run; SupabaseBackend verified end to end (NEXUS role-card sign-in → RLS read → `kafaa_signoff_evaluation` → audit row + NEXUS ledger entry). Live seed is partial (organisations, job families, job roles and an E2E subset), so `local` stays the default backend.
- **2026-10-08 · G1 (branch g1)** Additive shared edits, each marked `[G1]` in code: `schema.ts` new M02 table `evaluation_acks` (append-only supervisor acknowledgements); `types.ts` seven RPCs (`ackEvaluation`, `qualExpirySweep`, `reviewQualRecord`, `licensingAlerts`, `closeLicensingTask`, `recordMedicalDate`, `crewAvailability`) implemented in `src/data/local/rpc.g1.ts` (wired from `rpc.ts`), `SupabaseBackend.rpc` and `supabase/migrations/20261008131000_kafaa_g1_quals_licensing.sql` (also adds a `job_roles` check: a published role needs a source). Foundation fix: `detectLicensingEvents` now treats any past medical due date as overdue whatever the last flag (M03 acceptance), in `rpc.ts` and redefined in the G1 SQL. `scripts/validate-migrations.mjs` calls `validate-migrations.g1.mjs` (one line). `vitest.config.ts` also collects `*.test.tsx`; devDependencies `@testing-library/react`, `@testing-library/dom`, `jsdom` for component tests. New public routes `careers-plan` (`/careers/plan`) and `careers-compare` (`/careers/compare`). G1 SQL applied to `hlirqxoddysxtdezwcgv` with `apply_migration` (`kafaa_g1_quals_licensing`).

- **2026-10-08 · G2 (branch g2, pending foundation merge)** Shared-file edits made by the G2 module engineer. All are additive and commented `G2` in place:
  - `src/data/schema.ts`: new columns on sessions, enrolments, training_records, external_requests, certificates, item_versions, assessment_forms, attempts, appeals, dev_plans and mentoring_requests. `items`, `item_versions` and `appeals` moved to write mode `rpc`. Mentors and mentoring_requests get person-scoped read rules. Run `npm run gen` after merging; it regenerates the RLS migration.
  - `src/data/types.ts`: `Rpc extends G2Rpc` (the interface lives in `src/data/rpc_g2.ts`).
  - `src/data/local/rpc.ts`: G2 methods are mixed in through `makeG2LocalRpc`. `itemReview` now checks status and refuses a writer approving their own item (`maker_checker`).
  - `src/data/local/LocalBackend.ts`: one-line hook to `directWriteGuard` (`src/data/local/guards.ts`) on insert and update.
  - `src/data/supabase/SupabaseBackend.ts`: spreads `makeG2SupabaseRpc`.
  - `scripts/validate-migrations.mjs`: loads `scripts/validate/*.mjs` hooks.
  - `scripts/build-seed.mjs`, `scripts/seed/assess.mjs`, `scripts/seed/people.mjs`: G2 sessions, enrolments, attempts, item workflow and course evaluation forms.
  - `src/domain/learning.ts` (new): seat, waitlist, evaluation-gate, retake, appeal-window and item-analysis rules.
  - `src/modules/m04/routes.ts`: new routes `learn-paths` (`/learn/paths`) and `learn-path` (`/learn/paths/:track`).
  - Migration `20261008132001_kafaa_g2_learning.sql`: 21 RPCs, direct-write guard triggers, policy alters. Additive only, with no DROP statements.

- **2026-10-08 · G3 (branch g3)** Additive shared edits, all marked `[G3]`:
  - `src/data/schema.ts`: `applications` and `research_proposals` move to write mode `'rpc'` (an applicant can no longer move their own application to "offer", a partner can no longer accept its own proposal by direct update); `scholar_cohorts` gains read rule `{ res: 'partner_org', org: 'university_org_id' }` (a university reads cohort totals hosted at its own university). Regenerated files follow.
  - `src/data/types.ts`, `src/data/local/rpc.ts`, `src/data/supabase/SupabaseBackend.ts`: 8 RPCs `submitApplication`, `withdrawApplication`, `draftObserverReport`, `saveScenario`, `setBenchTarget`, `saveResearchChallenge`, `saveResearchProposal`, `decideResearchProposal` (SQL in `20261008133001_kafaa_g3_rpcs.sql`, which also revokes direct writes on the two tables, disables their now-redundant row-audit triggers and adds the cohort policy without any drop).
  - `scripts/seed/people.mjs` and `content.mjs`: synthetic applicant pool (`ap-001`..`ap-208`, first names only, no personas) so funnel cells reach 10; earlier quarters, hires/leavers, organisation totals, women by level and age bands in `workforce_snapshots`; previous-quarter `critical_roles` rows; the "accepted" seed application now has its history.
  - `scripts/validate-migrations.mjs` calls `scripts/validate-g3.mjs` (28 PGlite checks). New routes in G3's own `routes.ts`: `workforce-talent`, `workforce-definitions`, `admin-research`.
  - Dev dependencies `@testing-library/react`, `@testing-library/dom`, `jsdom` for component tests (`// @vitest-environment jsdom` per file; vitest config unchanged).

- **2026-10-08 · G4 (branch `g4`, M09/M11)** Shared edits, all additive and marked `[G4]`: `src/data/schema.ts` (new tables `supplier_documents`, `academy_checks`, `academy_check_keys`, `adv_skills`, `future_roles`, `adv_tracks`, `skill_gap_plans`; new columns on `partner_onboarding`, `equivalency_requests`, `icv_plans`, `future_skills`; `partner_onboarding`, `equivalency_requests`, `icv_plans` writes moved to `rpc`; `organisations` read adds `{ res: 'equivalency' }` so evaluators see contractor names). `src/data/types.ts` (`G4Rpc`, extended by `Rpc`: invitePartner, partnerOnboardingAction, uploadSupplierDocument, reviewSupplierDocument, saveIcvPlan, reviewIcvPlan, submitEquivalency, mapEquivalency, enrolSupplierCourse, completeSupplierCourse, saveSkillGapPlan). `src/data/local/rpc.ts` (delegates to new `rpc.g4.ts`; `decidePartnerOnboarding` now needs accepted required documents for suppliers and a note to return; `decideEquivalency` decisions are final and `equivalent` needs full task coverage; both append history). `SupabaseBackend.ts` mappings. New `src/domain/partners.ts`, `src/domain/future.ts`, `scripts/seed/g4.mjs` (hooked in `build-seed.mjs`), `scripts/validate/g4.mjs` (hooked in `validate-migrations.mjs`). Supplier-course enrolments and certificates are written only through the G4 RPCs, for `audience = supplier` courses. Test tooling: `vitest.config.ts`, `@testing-library/*` and `jsdom` dev dependencies (same as G1). SQL: `20261008134001_kafaa_g4_partners.sql` (kafaa_* only, idempotent, revokes direct table writes on the three RPC-only tables); applied to `hlirqxoddysxtdezwcgv` on 2026-10-08 as `kafaa_g4_partners_part1_tables` + `kafaa_g4_partners_part2_rpcs` (same SQL, split in two). Live seed rows for the new tables are not loaded.

- **2026-10-08 · G5 (branch g5)** Shared edits, all additive and commented `G5`:
  - `src/data/schema.ts`: new columns on `role_assignments` (reviewed_at/by, review_note), `contact_requests` (lang, consent_contact, retention_until), `concern_cases` (closed_on, outcome), `content_pages` (kind page|news, published_on, summary_en/ar, topic, updated_by/at, no_factual_claims), `advisor_sessions` (client_key, page_context, handoff_status, handoff_note, last_turn_at), `advisor_turns` (intent, confidence, redacted, mode), `eval_runs` (details, engine, run_by, security_total/correct), `dalil_settings` (signed_in_rate_limit_per_hour, engine); `advisor_sessions`/`advisor_turns` write mode changed to `rpc` (server-side rate limit); new table `feature_flags` (read PUB, write `integrations`). Generated files re-run (`npm run gen`); the live delta is `supabase/migrations/20261008135001_kafaa_g5_core.sql` (add column if not exists, guarded policy blocks, no DROP).
  - RPCs (types.ts + LocalRpc + SQL + SupabaseBackend): `dalilTurn`, `dalilHandoff`, `resolveDalilHandoff`, `logConcernReferral`, `triageConcernV2`, `reviewRoleAccess`; NEXUS read `repo.nexus.ledger()` (`kafaa_nexus_ledger`, domain KAFAA, admin/auditor). New types `DalilMode`, `DalilCitation`, `DalilTurnInput`, `DalilTurnResult`, `ConcernReferralInput`, `LedgerEntry`.
  - `LocalBackend.ts`: locked feature flags refuse updates (mirror of the SQL policy); `nexus.ledger` reads `ledger_local`.
  - `src/domain/g5rules.ts` (new, G5-owned): Dalil mode rules, ECP transitions and triage clock, access-review cadence (92 days), publish blockers, sync state, contact routing.
  - `src/shell/DalilLauncher.tsx`: re-reads `dalil_settings` every 30 s (kill switch reaches open pages within a minute) and passes `?from=<page>` to `/ask`.
  - Seed: `scripts/seed/g5.mjs` hooked from `build-seed.mjs` (news items, flags, FAQs, facts, corpus extras, refusal pattern overrides, ECP/access/Dalil samples). `validate-migrations.mjs`: 16 "G5 checks". `tests/smoke/routes.ts`: param for `news-item`.
  - Routes: `news` (/news) and `news-item` (/news/:slug) in M12.
  - Dev dependencies: `@testing-library/react`, `@testing-library/dom`, `jsdom` (component tests use `// @vitest-environment jsdom` in `.test.ts`, so `vitest.config.ts` is unchanged).
  - Tests: `tests/unit/m14-rbac.test.ts` (every persona x every table, consequential RPC and route guard against the policy matrix), `g5-workflows.test.ts`, `g5-components.test.ts`, `m13-dalil.test.ts`.
- **2026-10-08 · Integration (main, QA lead)** G1–G5 merged into `master`; shared-file conflicts resolved keeping both sides (`rpc.ts` constructor delegates to G1/G2/G4 helpers, `types.ts` `Rpc extends G2Rpc, G4Rpc`, `build-seed.mjs` runs `applyG4` then `extendG5`). PGlite validator: test uids are now disjoint per group (G2 901+, G3 951+, G4 981+) and `scripts/validate/*.mjs` modules may export `default` or `g4Checks`.
  - **Default backend is now `supabase`** (`VITE_KAFAA_BACKEND=local` keeps the in-browser tenant as a fallback). The sign-in screen signs NEXUS role cards in to Supabase Auth with the shared demo password from `VITE_NEXUS_DEMO_PASSWORD` (build-time, `.env.local` only, never committed) and stores the session in NEXUS's format. `config.nexusHome`/`nexusSignIn` and `nexusHref()` are root-relative on the NEXUS origin and `https://enecai.xyz/…` (`VITE_NEXUS_URL`) elsewhere.
  - Deploy layout: `public/_redirects` (`/ → /kafaa/ 302`, `/kafaa → /kafaa/ 301`, `/kafaa/* → /kafaa/index.html 200`) and `npm run build:deploy` → `deploy_out/{_redirects,netlify.toml,kafaa/}` (gitignored).
  - **RLS performance** (`20261008140000_kafaa_rls_perf.sql`, generated by `scripts/gen-rls-perf.mjs`, applied live): every `kafaa_*` policy keeps its rule but evaluates the caller-only helpers once per statement (`(SELECT kafaa_has_grant(...))`, `(SELECT kafaa_me())`); the per-row scope test stays a gated `kafaa_rule_read(res, person, NULL, false)` call because `kafaa_in_scope` is not executable by API roles. The generator proves equivalence (25 identities × 105 tables, identical visible rows before/after). Anonymous `kafaa_people` reads were hitting the 3 s statement timeout (HTTP 500). **Policy rule for groups:** new policies should wrap caller-only helpers in `(SELECT …)` the same way; rerun `node scripts/gen-rls-perf.mjs` after adding policies.
  - `daysBetween` counts calendar days (UTC dates, like SQL `date - date`); it used to round the millisecond difference, so after midday an expiry two days ago read as three.
  - E2E QA suite: `playwright.e2e.config.ts` + `tests/e2e/` (route × role sweep, key journeys, RTL and mobile checks) against `vite preview` in supabase mode; one worker. Unit tests pin `VITE_KAFAA_BACKEND=local` in `vitest.config.ts`.

## 11. Acceptance checklists per module

Each group's hand-off lists every box below as done, or explains why not. These are the spec's acceptance criteria plus the contract's own items.

**Every module:** placeholders replaced on every route you own · loading, empty and error states · EN and AR complete, RTL checked by eye in `/ar` · every public fact has a `SourceLink` and as-of date · consequential actions go through an RPC behind a `ConfirmDialog` · no real names · `npm run verify` green · hand-off lists files changed, new RPCs/SQL files, contract requests and screenshots of key screens in both languages.

### M01 (G1)
- [ ] All 28 seed roles render in English and Arabic with a basis badge and at least one source link.
- [ ] The RO page shows all three FANR-REG-17 Art. 4 entry routes and the SRO page shows all three SRO routes, each with an article reference.
- [ ] An automated check fails the build if any public role payload contains a person-name field, email address or photo URL (`check:public`, keep it passing).
- [ ] The ladder view shows Local Operator → RO → SRO → Shift Supervisor with the condition on each step (`CareerLadder`).
- [ ] Each screen has a loading, empty and error state; no route returns a crash page.
### M02 (G1)
- [ ] A qualification card shows each task's status, evaluator role, date and expiry in both languages.
- [ ] An attempt to self-sign returns a clear error and writes an audit event (`rpc.signoffEvaluation` → `self_sign`).
- [ ] Thirty days before expiry, the person and their manager receive a notice; the matrix shows the item as "due".
- [ ] Revising a qualification standard creates a new version and lists every record that needs review (`rpc.reviseStandard`).
### M03 (G1)
- [ ] Given an SRO with 6 eight-hour shifts in the quarter, 1 of them in the SRO role, and 2 scheduled shifts left, the tracker warns that the SRO-role minimum is at risk (`proficiency()`).
- [ ] Given a medical due date in the past and no new date, the operator view shows "medical overdue" and the coordinator receives a task.
- [ ] Given a lapse detected on a Thursday, the lapse task shows a deadline three UAE working days later (`addWorkingDays`, `rpc.detectLicensingEvents`).
- [ ] If the source sync is stale, no certificate shows as "valid" (`licenceView()`).
- [ ] No screen exposes clearance details, medical details or exam content.
### M04 (G2)
- [ ] Changing a person's role assigns the mandatory curriculum for the new role within one sync cycle (`rpc.assignCurriculum`).
- [ ] A COCT booking cannot be displaced by an elective booking (`canDisplace`, `rpc.bookSimulator`).
- [ ] Every catalogue entry with a published duration shows its source.
- [ ] Training paths (spec "Training and qualification paths") render for the licensed operator, technical, emergency preparedness, security (career only) and supplier tracks.
### M05 (G2)
- [ ] A user with the item-writer role cannot approve their own item (`rpc.itemReview` → `maker_checker`).
- [ ] Secure item text never appears in logs, exports or AI prompts (add a unit test over audit rows, CSV export and Dalil corpus).
- [ ] A failed critical step in a JPM fails the JPM regardless of total score (`scoreJpm`, `rpc.recordJpm`).
### M06 (G3)
- [ ] A school leaver reaches the DNT page in two steps from the home page in either language.
- [ ] Every programme card states eligibility (nationality, education) and duration with a source.
- [ ] The HR funnel shows counts only and suppresses any cell below the minimum group size (`rpc.applicationFunnel`).
### M07 (G3)
- [ ] Filtering to a group of 7 people shows "suppressed" rather than values (`rpc.workforceAggregate`).
- [ ] Each tile links to its definition and source table.
- [ ] An observer account sees only reports explicitly released to its organisation (`rpc.observerReportAction`).
### M08 (G5)
- [ ] The speak-up route sends no analytics or audit events (verified by network inspection in test; keep the smoke check green).
- [ ] Typing "I want to report" into Dalil on any page returns the channel list and no further conversation on the topic.
- [ ] Each OE lesson shows its review date and reviewing body.
### M09 (G4)
- [ ] Every directory entry links to at least one public source.
- [ ] A partner user requesting another organisation's equivalency record gets a not-found response, and an audit event is written (`rpc.getEquivalency`).
- [ ] Completing the readiness path produces a summary the supplier can take to ENEC's registration process.
- [ ] Supplier onboarding (`/partner/onboarding`) and the supplier academy (`/partner/academy`) work end to end for `alnoor-gm` and `k-contractor`.
### M10 (G3)
- [ ] A university user sees no student who has not consented to share with that university.
- [ ] A research challenge cannot publish without a screening sign-off recorded in the audit log (`rpc.screenResearchChallenge`).
### M11 (G4)
- [ ] Each technology entry cites its MoU source and date.
- [ ] The public page contains no projected headcount or site information.
### M12 (G5)
- [ ] Every statistic has a source link and an "as of" date.
- [ ] The emergency section contains only links to official pages and the "Go In, Stay In, Listen In" headline.
### M13 (G5)
- [ ] Asked "What are the RO entry requirements?", Dalil answers with the three REG-17 routes and cites REG-17.
- [ ] Asked about plant security arrangements, Dalil declines and suggests public sources about careers in security instead.
- [ ] Unauthenticated use is rate-limited and cannot reach staff-mode content.
- [ ] Disabling Dalil from the admin console removes it from every page within one minute (`rpc.setDalilEnabled`; the launcher already reads `dalil_settings`).
### M14 (G5 pages, F foundation)
- [ ] An automated suite calls every route and API as every role and compares results with the RBAC matrix; any mismatch fails the build (extend `tests/smoke` + `migrations:validate`).
- [ ] A leaver loses access within one sync cycle (`kafaa_my_roles` ignores leavers; show it in `/admin/access`).
- [ ] Role grants of elevated roles need a second admin (`rpc.grantRole` / `approveRole`).
### M15 (F)
- [x] A CI check fails if any route lacks approved Arabic content (`check:i18n`).
- [ ] Automated accessibility checks pass on every route in both directions, and a manual screen-reader test passes on the top ten journeys.
### M16 (G5)
- [ ] No production build contains a route under /api/debug or similar.
- [ ] Audit entries cannot be edited or deleted through any interface, including the admin console (append-only trigger; `rpc.auditVerify` shows the chain).
- [ ] `/admin/nexus` shows the integration status and the NEXUS ledger entries written by Kafa'a.
