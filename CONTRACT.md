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

- **2026-10-09 · W0 (wave 0 foundation: F01 skills core + M17-M27 scaffolding, F02 engine kernel)** On `master`. Wave engineers: read `scratchpad/kafaa_build/W0_DONE.md`; the rules below replace section 2-4 details for M17-M27 only.
  - **Modules M17-M27** are registered once (`ModuleId`, `MODULES` with groups `W1`..`W5`, registry imports). Each owner edits only `src/modules/mNN/` (`routes.ts`, pages, `backend/{schema,rpc,local,supabase}.ts`, optional `smoke.json` for param routes), `src/i18n/mNN.{en,ar}.json`, their own `scripts/seed/ext/fNN.mjs`, `scripts/validate/wNeM-*.mjs`, `tests/unit/*` and their own migration `supabase/migrations/20261009<W><E>NNN_kafaa_w<W>e<E>_<topic>.sql` (`1<W><E>NNN` in the time part, for example `20261009112001_kafaa_w1e2_career.sql`). Tables go in `backend/schema.ts` (merged into `SCHEMA` via `src/data/ext/schema.ts`); RPCs in `backend/rpc.ts` (merged into `Rpc` via `src/data/ext/rpc.ts`) with `makeLocalMNN(b, h)` and `makeSupabaseMNN(x)`; no shared routing, schema or backend file needs editing.
  - **Policy resources** `skills_profile`, `opportunities`, `talent_review`, `knowledge`, `learning_analytics`, `sat`, `lrs` added to `src/auth/policy.ts` (matrix rows also inserted live). `knowledge` is staff-readable: KLRA tables must use Scope/Agg/A-only rules. Holding A or R on a resource reads every row of a table whose rule names it (e.g. training_manager reads all skill states).
  - **Skills core (F01):** tables `skills` (71: one core skill per competency + 42 specialised, `adv_skills` mapped via `adv_skill_ids`), `skill_evidence` (rpc), `person_skills` (rpc). Rules in `src/domain/skills.ts` (pure, import-free), SQL mirror `kafaa_skill_evidence_derive` / `kafaa_skill_states_compute` / `kafaa_skills_apply` (internal), RPC `recomputeSkills(personId?)` (`kafaa_recompute_skills`; self, Scope, or training_manager A; audited, no ledger). Recorded evidence kinds (`rating`, `ojt`, `credential`) written by later features survive recomputes; derived kinds are rebuilt; rows are never removed (inactive instead). PGlite proves SQL = TS for all 345 people.
  - **Engine kernel (F02):** `src/domain/engines/` (`byGapClosure`, `byCoOccurrence`, `byCosine`, `careerMoves`, `coursesForGaps`, `readiness`, `lintRanked`, `SkillsEngine`, `ModelGatewayEngine`, `resolveEngine`/`makeEngine`), `useEngine(surface)` from `src/data`, `<WhyThis>` and `<EngineBadge>` in `src/ui`, table `engine_settings` + RPC `setEngineWeights` (admin, audited), card on `/admin/integrations`. `careerGraph` promoted to `src/domain/careerGraph.ts` (m01 re-exports); BM25 `SearchIndex` and text utilities promoted to `src/domain/{search,text}.ts` (m13 re-exports).
  - **Seed loader:** `build-seed.mjs` auto-loads `scripts/seed/ext/*.mjs` (`default(T, ctx)` in name order, then `finalize(T, ctx)`; F01's finalize derives all skill states last). Shell nav section keys added: skills, career, growth, opportunities, future, leadership, talent, knowledge, quality.
  - Live: `kafaa_w0e1_skills_core_part1_tables` + `_part2_functions` (same SQL as `20261009101001_kafaa_w0e1_skills_core.sql`), catalogue and recorded self-ratings loaded with `on conflict do nothing`, states derived with `kafaa_skills_apply` (345 people).

- **2026-10-09 · W1 · E1 (branch w1e1, F03 Skills Passport, F04 Credential Wallet)** Owned files only (`src/modules/m17/**`, `src/i18n/m17.*`, `scripts/seed/ext/f03-passport.mjs`, `scripts/validate/w1e1-passport.mjs`, `tests/unit/w1e1-*`, `supabase/migrations/20261009111001_kafaa_w1e1_passport.sql`) plus one new shared file: `public/.well-known/kafaa-issuer.json` (published issuer keys, generated from `issuerDocument()` in `src/modules/m17/issuer.ts`; a unit test keeps them equal). Regenerated: `types.gen.ts`, the 120100/120300 generated SQL, `seed.json`, `seed.sql`.
  - Tables (M17): `skill_claims` (rpc), `badges` (rpc; read rule `skills_profile` + `person_id`, public verification only through the RPC). No new policy resource.
  - RPCs: `claimSkill` (own; 20 a day; `security_restricted` for security competencies; writes a recorded `rating` evidence row and recomputes), `issueBadge` (own; valid Kafa'a certificate or passed course completion only; `not_eligible` for licences, qualification mirrors, expired/revoked certificates; `security_restricted`; `already_issued`; ledger `kafaa.badge.issue`; writes `credential` evidence), `revokeBadge` (holder or skills_profile A; ledger `kafaa.badge.revoke`), `verifyBadge` (anon + authenticated; 20/min per badge, 600/min overall; audited; initials only).
  - Signing: Ed25519 over canonical JSON (`kafaa-jcs-eddsa-2026`). Server key `key-1` lives only in `kafaa_badge_issuer_seed()` (not executable by API roles; DEMO key in the migration). The in-browser LocalBackend signs with a separate, labelled `key-offline`. SQL signer/canonicaliser = TS (PGlite: RFC 8032 vector and byte-identical seeded credentials).
  - Routes: `my-skills` (/my/skills), `my-skills-wallet` (/my/skills/wallet), `my-skills-print` (/my/skills/print), `team-passport` (/team/passport/:personId), `verify-badge-check` (/verify/badge), `verify-badge` (/verify/badge/:id).
  - Contract requests: (1) `check:public` could import `src/modules/m17/publicPayload.ts` to cover RPC payloads (today the PGlite validator and unit tests run it on every seeded verify payload); (2) a link from `/verify` (M02) to `/verify/badge`; (3) later waves writing claims validation (F10) should set `skill_claims.status` and flip the matching `se:rating:<claim>:<skill>` evidence basis to `validated`.
  - Live (`hlirqxoddysxtdezwcgv`): `kafaa_w1e1_passport_part1_tables` + `_part2_functions` (same SQL; function bodies md5-identical to local). Seed loaded with `on conflict do nothing`: 32 claims, 73 badges (credentials signed on live; proofValues md5-identical to `seed.json`), 200 evidence rows (md5-identical), then `kafaa_skills_apply(null, current_date)`.

- **2026-10-09 · W1 · E2 (branch w1e2: F05 Career Navigator, F06 Career Roadmap, module M18)** Only M18-owned files plus this entry. Routes `my-career` (`/my/career`), `my-career-roadmap` (`/my/career/roadmap`), `team-career` (`/team/career`, skills_profile Scope). Tables `career_targets` and `roadmaps` (direct writes on own rows via `own_profile` Own; a second read rule `{ res: 'skills_profile', person: 'shared_person_id', where: 'shared' }` lets a line manager or instructor in scope read a row only while the person shares it; the SQL trigger `kafaa_career_share_sync` keeps `shared_person_id` = `person_id` while shared and caps a shortlist at three active targets; rows are archived with `active = false`, never removed). RPCs `careerReadiness(personId, roleIds)` (read-only; same rules in `src/modules/m18/career.ts` and `kafaa_career_readiness_compute`, PGlite proves SQL = TS for 107 staff × 28 roles) and `roadmapToPlan(roadmapId)`.
  - **Shared write (contract request in the F06 card, resolved without touching M04 code):** `kafaa_roadmap_to_plan` / the LocalBackend mirror write M04's `dev_plans` (a `draft` plan `dp-rm-<roadmap>` when the person has no open plan for that target) and `plan_activities` (`pa-rm-<roadmap>-<block>`, status `planned`; idempotent). One audit row `roadmap.to_plan` plus a ledger row; the row-audit triggers are quiet inside the RPC (transaction-local `kafaa.seeding`).
  - **Tip for wave engineers:** import `useEngine` from `../../data/useEngine` in lazily loaded pages; importing it through `../../data` makes Rollup warn about a circular chunk.
  - Live (`hlirqxoddysxtdezwcgv`): `kafaa_w1e2_career_part1_tables` + `kafaa_w1e2_career_part2_functions` (same SQL as `20261009112001_kafaa_w1e2_career.sql`; function bodies verified by md5). Seed with `on conflict do nothing`: all 72 `career_targets`, and 7 of 19 `roadmaps` (the shared ones plus qc-inspector's; unshared synthetic roadmaps are visible to nobody on the live backend), verified by md5 against `seed.json`.

- **2026-10-09 · W1 · E3 (branch `w1e3`, F07 Learning Coach, M19)** No shared source file edited; only regenerated outputs (`npm run gen`). M19 owns tables `coach_feedback` (rpc; own_profile Own only) and `learning_goals` (direct own; own_profile Own only, SQL check 0-40 h and at most 3 focus roles), RPCs `coachFeedback` / `coachInsights` (`kafaa_coach_feedback`, `kafaa_coach_insights`, internal `kafaa_coach_cell`), migration `20261009113001_kafaa_w1e3_coach.sql` (applied live as `kafaa_w1e3_coach`; seed rows loaded with `on conflict do nothing`), routes `my-coach` (`/my/coach`) and `coach-insights` (`/my/coach/insights`). Cross-module reads only: M04 `TRAINING_PATHS` (`src/modules/m04/paths.ts`) for "Ask the coach", and the F05 `career_targets` / F08 `opportunities` tables, read only when they exist in `SCHEMA` (columns as in BACKLOG F05/F08: `person_id, role_id, rank`; `kind, title_en/ar, status, skills_gained[], hours_week`). Enrolment uses the existing `rpc.enrolCourse`.

- **2026-10-09 · W1 · E4 (branch `w1e4`, F08 Opportunity Marketplace, M20)** Own files only: `src/modules/m20/` (routes `opportunities`, `opportunities-my`, `opportunities-manage`, `opportunities-post`, `opportunities-insights`, `opportunity`; `domain.ts` rules, `match.ts` engine, `backend/*`), `src/i18n/m20.*`, `scripts/seed/ext/f08-opportunities.mjs`, `scripts/validate/w1e4-opportunities.mjs`, `tests/unit/w1e4-*`, migration `20261009114001_kafaa_w1e4_opportunities.sql`. Tables `opportunities`, `opportunity_applications`, `opportunity_saves` (all write mode `rpc`). RPCs `postOpportunity`, `setOpportunityStatus`, `applyOpportunity`, `releaseDecision`, `selectApplicant`, `completeOpportunity`, `withdrawOpportunityApplication`, `saveOpportunity` (audited; ledger on selection and completion) and the read `opportunityStats` (`kafaa_opportunity_stats`, suppressed below 10). Shared effects, all through M20's own SECURITY DEFINER functions: `completeOpportunity` writes `skill_evidence` rows (kind `ojt`, basis `evidenced`, id `se:ojt:<application>:<skill>`, ref_table `opportunity_applications`) and runs `kafaa_skills_apply` / `applySkills` for the applicant (F01 contract); the RPCs insert `notifications` rows (kind `opportunity`, ids `nt-<application>-<status>`, `on conflict do nothing`). Line manager = `people.manager_id`, else the narrowest-scope active `manager` assignment covering the person (`kafaa_opp_line_manager`, TS `lineManagerOf`); when the line manager posted the opportunity, the release goes to their own line manager (maker-checker). RLS: staff R on `opportunities` reads listed rows only (drafts via `listed`); applications and saves are readable only by the people named on the row (always-false `open_read` column blocks the staff R grant), plus admins and auditors (R on `audit_log`). No shared file edited.

- **2026-10-09 · W1 · E5 · F09 Future Me (branch `w1e5`, module M21)** Only M21-owned files plus generated output; no shared source file edited.
  - Tables (`src/modules/m21/backend/schema.ts`): `horizon_lanes` and `future_resources` (public reference data, write mode `none`), `future_interest` (own rows only via `own_profile`, direct own writes, row-trigger audited), `future_goals` (own rows only, RPC writes).
  - **Shared hand-off for F07 (M19 Learning Coach):** `future_goals` rows with `status = 'active'` are coach targets: `skill_ids` (Kafa'a skills to grow, never security-area skills), `target_level` (2), `kind` (`adv_skill|bridge|lane|future_role`), `ref_id`, `title_en/ar`, `source = 'future_me'`. The coach runs as the person, so the Own read rule is enough; it should read, not write, this table.
  - **Shared hand-off for F26 (training needs):** `rpc.futureDemand()` (`kafaa_future_demand()`, `skills_profile` Agg/R/A) returns distinct-people counts per technology family or horizon lane for interest and goals, `n = null` and `suppressed = true` below `MIN_GROUP_SIZE`.
  - RPCs: `setFutureGoal(kind, refId, active?)` (`kafaa_set_future_goal`, audited, no ledger; refusals `not_signed_in`, `forbidden`, `invalid`, `not_found`, `limit` at 12 active goals) and `futureDemand()`.
  - Routes: `my-future` (`/my/future`), `my-future-tech` (`/my/future/:tech`), `workforce-future-interest` (`/workforce/future/interest`, parent `workforce-future`).
  - SQL `supabase/migrations/20261009115001_kafaa_w1e5_future.sql`; PGlite checks `scripts/validate/w1e5-future.mjs`; seed `scripts/seed/ext/f09-future.mjs`. Applied live to `hlirqxoddysxtdezwcgv` as `kafaa_w1e5_future`, seed rows loaded with `on conflict do nothing` (5 lanes, 17 resources, 192 interest rows, 42 goals; goal rows md5-identical to `seed.json`).

- **2026-10-09 · W1 integration and QA (master)** Merged `w1e1`..`w1e5` (generated files regenerated with `npm run gen` after each merge). Cross-feature hand-offs wired on master:
  - F05 → F07: the coach plans for the *active* shortlist only (`career_targets.active`).
  - F09 → F07: active `future_goals` rows are coach targets: their non-security skills become needs at the target-role weight, labelled with the goal title; the "Planning for" card lists them.
  - F08 → F07: opportunity cards use listed, open rows with seats left and open `/opportunities/:id`.
  - F05 → F08: the marketplace's default target role is the top shortlisted role (a "My Career Navigator shortlist" group in the selector).
  - F05 → F07: navigator role cards link to `/my/coach`.
  - Shared fixes: screen-reader tables (`src/ui/charts.tsx`, M11 radar, M18 map) sit inside a `div.sr-only` (a `table.sr-only` widened the page at 390 px); the M11 radar viewBox leaves room for axis labels.
  - Smoke loader: guards given by a named constant (`guard: OWN`) are inlined, so all 118 routes are swept.
  - F06 fix: `kafaa_roadmap_to_plan` (and the local mirror) treat a development block already in the target plan (same kind, title and course, from any saved scenario) as existing, so sending a second scenario for the same target never duplicates plan activities. Migration `20261009119001_kafaa_w1qa_roadmap_plan_dedupe.sql`, applied live as `kafaa_w1qa_roadmap_plan_dedupe` (function body md5-identical).
  - Live: the 12 unshared synthetic `roadmaps` rows were loaded (`on conflict do nothing`), so every wave-1 table matches `seed.json` by id digest.

- **2026-10-09 · W2 · E1 (branch `w2e1`, F10 Skill check-ins, F11 Team capability heatmap, M17)** Own files only: `src/modules/m17/{checkins.ts,ciUi.tsx,CheckinsPage.tsx,ValidatePage.tsx,TeamSkillsPage.tsx,backend/local.w2.ts}` plus additions to `m17/{routes.ts,backend/schema.ts,backend/rpc.ts,backend/local.ts,backend/supabase.ts,MySkillsPage.tsx}`, `src/i18n/m17.*`, `scripts/seed/ext/f10-checkins.mjs`, `scripts/validate/w2e1-checkins.mjs`, `tests/unit/w2e1-*`, migration `20261009121001_kafaa_w2e1_checkins.sql`. No shared source file edited; generated outputs regenerated.
  - Routes: `my-skills-checkins` (`/my/skills/checkins`, skills_profile Own), `team-skills` (`/team/skills`, Scope/A/Agg), `team-skills-validate` (`/team/skills/validate`, Scope/A).
  - Tables (rpc writes only): `skill_checkins` (read: the person, Scope over the person, the addressed manager), `skill_ratings` (read: the subject, the rater, Scope over either; peers read only rows addressed to them), `team_skill_targets` (read: R/W/A only; managers get targets through `teamCoverage`). HR (Agg) reads none of them.
  - RPCs: `requestCheckin`, `submitRating`, `validateCheckin` (ledger `kafaa.skills.checkin.validate`), `withdrawCheckin`, `setTeamTarget` (audited), reads `checkinPeers`, `checkinInbox`, `checkinCalibration`, `teamCoverage`. Line manager = the F08 rule (`people.manager_id`, else narrowest manager assignment; own mirror `kafaa_sc_line_manager`).
  - Group keys: `team:<people.team_id>`, `family:<job_family_id>`, and `crew:profile` (the crew profile). Coverage counts verified, evidenced and validated levels only; default target 2 people at the skill's key level; single point of failure = exactly one holder.
  - **Shared writes (own SECURITY DEFINER functions):** `validateCheckin` writes `skill_evidence` rows (kind `rating`, basis `validated`, id `se:rating:<checkin>:<skill>`, ref_table `skill_checkins`) and runs `kafaa_skills_apply`; when the person has a pending F03 claim on the skill it sets `skill_claims.status` (`validated`, or `rejected` when adjusted below the claim) and flips that claim's `se:rating:<claim>:<skill>` row to basis `validated` (W1E1 contract request 3). RPCs insert `notifications` (kind `skills`, ids `nt-<checkin>-…`, `on conflict do nothing`) with the row-audit trigger quiet (transaction-local `kafaa.seeding`), like the LocalBackend.
  - Qualification-standard skills (any `qual_standards` id in `evidence_keys`) and skills the person holds by a current qualification record are "verified by qualification only" (`qualification_only`); security competencies are `security_restricted`. A crafted check-in on such a skill is decided as `qualification_only` and writes no evidence.
  - Live (`hlirqxoddysxtdezwcgv`): `kafaa_w2e1_checkins_part1_tables`, `_part2_rpcs`, `_part3_reads` (same SQL as the file; the 21 function bodies md5-identical to local). Seed loaded with `on conflict do nothing` and the seeding flag on (no audit noise): 75 check-ins, 471 ratings, 24 targets, 96 validated `rating` evidence rows, 36 notifications, all digest-identical to `seed.json`; then `kafaa_skills_apply` for the 42 people concerned (40 identical to the seed; `outage-planner` and `qc-inspector` carry the known live-only QA states). Seeded decided check-ins never touch a pending F03 claim, so the seed only adds rows.
- **2026-10-09 · W2 · E2 (branch `w2e2`, F12 Career conversations, module M18)** Own files only: `src/modules/m18/` (`conversations.ts` rules, `ccShared.tsx`, `MyConversationsPage.tsx`, `TeamConversationsPage.tsx`, `ConversationInsightsPage.tsx`, `AspirationSignal.tsx`, `backend/*`, links from `MyCareerPage`/`TeamCareerPage`), `src/i18n/m18.*`, `scripts/seed/ext/f12-conversations.mjs`, `scripts/validate/w2e2-conversations.mjs`, `tests/unit/w2e2-*`, migration `20261009122001_kafaa_w2e2_conversations.sql`. No shared source file edited.
  - Table `career_conversations` (rpc only). Read: the person (`own_profile` Own) and the line manager of record through `manager_read_id`, which the RPCs set only when the preparation is shared or the conversation recorded (a private draft is invisible to the manager). Nobody holds R/Scope/Agg on `own_profile`, so HR, auditors and skip-level managers read no row.
  - RPCs: `conversationAgenda(personId)` (self: full agenda; line manager of record: passport, expiring quals, last conversation and only the *shared* shortlist/roadmap, never coach data), `submitPrep(prep, submit)`, `recordConversation(input)` (ledger `kafaa.career.conversation_held`), `acknowledgeConversation(id, agree, comment, addToCoach)` (employee only, `not_person` otherwise; ledger `kafaa.career.conversation_acknowledged`), `setAspirationSharing(id, on)` (ledger `kafaa.career.aspiration_sharing`), `talentAspirations(personIds)` (talent_review R/A, or Scope in scope; audited), `conversationInsights()` (skills_profile Agg/A; families under 10 suppressed, aspiration/mobility counts under 10 suppressed cell by cell), `teamConversations()`, `conversationReminders()` (line manager: own reports; skills_profile A: everyone; ids `nt-cc-due-<person>-<yyyy-mm>[-m]`, idempotent per month).
  - Line manager of record = F08's rule (`lineManagerOf` / `kafaa_opp_line_manager`). The agenda is built on the server by `kafaa_cc_agenda` = `buildAgenda` (uses F05's `careerReadiness` compute); PGlite proves SQL = TS for all 107 staff × both views, plus the preparation/action checks, cadence and the HR aggregates.
  - **Shared writes (inside M18's SECURITY DEFINER functions only):** M04 `dev_plans` / `plan_activities` (agreed actions → a *draft* plan `dp-cc-<conversation>` for the focus role, else the current role, or an existing draft plan for that role; activities `pa-cc-<conversation>-<action>`, status `planned`; amending updates `planned` ones, never duplicates); M19 `learning_goals` (on the employee's acknowledgement, with their consent: focus role added when fewer than 3, weekly hours set); M14 `notifications` (kind `career_conversation`). Seed: the builder also adds the M04 plans/activities of seeded conversations (old ones `closed`, the latest `active`, held ones `draft`) and this month's reminders; it sets `FINALIZE_LAST` so agendas are built after F01 derives skill states.
  - **F18 hand-off:** read aspirations only through `rpc.talentAspirations(ids)` and render `AspirationSignalCard` (`src/modules/m18/AspirationSignal.tsx`, hook `useTalentAspirations`): consent off → `{shared: false, reason: 'not_shared'}` and the card reads "Aspiration not shared"; no conversation → `reason: 'none'`. **F36 hand-off:** cadence reminders are `notifications` rows with kind `career_conversation`.
  - Routes: `my-career-conversations` (`/my/career/conversations`, skills_profile Own), `team-conversations` (`/team/conversations`, Scope; `?person=<id>` opens the workspace), `workforce-career-conversations` (`/workforce/career-conversations`, Agg/A).
- **2026-10-09 · W2 · E3 (branch `w2e3`, F13 Mentoring 2.0 in M04, F14 Knowledge refreshers in M19)** Owned files: `src/modules/m04/{mentoring,match}.ts`, `src/modules/m04/backend/*` (new), `useMentoring.ts`, `mentoringUi.tsx`, `MyMentoringPage.tsx`, `MentoringAgreementPage.tsx`, `MentoringProgrammePage.tsx`, `src/modules/m19/{refresh.ts,RefreshPage.tsx,RefresherInsightsPage.tsx}` plus M19 backend additions, i18n `m04.*`/`m19.*`, `scripts/seed/ext/f13-mentoring.mjs`, `f14-refreshers.mjs`, `scripts/validate/w2e3-mentoring-refreshers.mjs`, migration `20261009123001_kafaa_w2e3_mentoring_refreshers.sql`. Shared edits, each marked `W2E3` in code:
  - `src/data/ext/{schema,rpc,local,supabase}.ts`: M04 now has a module backend (`TABLES_M04`, `M04Rpc`, `makeLocalM04`, `makeSupabaseM04`), spread first.
  - `src/data/schema.ts` (M04 block): `mentors` gains `types[]`, `skill_ids[]`, `khnp_paired`, `sme`, `sme_skill_ids[]`, `sme_nominated_by`, `sme_nominated_on`; `mentoring_requests` gains `mentoring_type` (career|knowledge_transfer|leadership|reverse|peer_onboarding) and `skill_ids[]`. SQL adds the columns with `alter table ... add column if not exists`.
  - `src/data/local/guards.ts`: `mentors` direct writes cannot change the SME columns (SQL trigger `kafaa_w2e3_mentor_guard`); SME nomination goes through `nominateSme` (the mentor's line manager per the F08 rule, or the training manager).
  - `src/data/local/rpc_g2.ts` + SQL `kafaa_respond_mentoring` (redefined, same signature): a line manager cannot accept a request from their own team member (`own_manager`). Line manager = `lineManagerOf` / `kafaa_opp_line_manager` (F08).
  - M19 coach (`coach.ts`, `inputs.ts`, `useCoachData.ts`): mentor cards exclude my line manager (`excludeMentorPersons`) and link to `/my/mentoring?mentor=<id>`; `/my/coach` shows a refresher teaser.
  - Tables (rpc writes only): `mentoring_agreements`, `mentoring_sessions` (read by the pair), `mentoring_private_notes` (read by the author only, `own_profile`), `refresh_state` (own; trigger allows approved practice-bank items only); `refresh_prefs` (direct own).
  - RPCs: `requestMentoring`, `proposeAgreement`, `respondAgreement`, `logSession`, `closeAgreement` (an SME mentor's knowledge-transfer close-out validates the mentee's open `skill_claims` on goals rated met, via `kafaa_skills_apply`), `nominateSme`, `smeNominees`, `myReportingLine`, `mentoringProgramme` (training manager; cells under 10 pairs suppressed), `nextRefresher` (no keys in the payload), `submitRefresher` (checked server-side; Leitner boxes 1-5 due after 1/3/7/14/30 days), `refresherItemStats` (instructor/training manager; items under 10 people suppressed).
  - Seed writes into other modules' tables via my builders: 20 practice items `it-rf-*` (+ versions, EN/AR) in M05's bank, `skill_claims`/`skill_evidence` rows for the knowledge-transfer validations, `notifications`, and mentors `mt-6`..`mt-25` (`mt-1`..`mt-5` gain the new columns).
  - Routes: `my-mentoring-agreement` (/my/mentoring/:agreementId), `my-mentoring-programme` (/my/mentoring/programme), `my-coach-refresh` (/my/coach/refresh), `training-refreshers` (/training/refreshers).
  - Live (`hlirqxoddysxtdezwcgv`): `kafaa_w2e3_mentoring_refreshers_part1_tables`, `_part2_mentoring_functions`, `_part3_refresher_functions` (same SQL as the migration; all 30 function bodies md5-identical to local PGlite). Seed loaded with `on conflict do nothing` (20 practice items + versions, 20 mentors, 74 requests, 5 claims + evidence, 69 agreements, 532 sessions, 84 private notes, 700 refresher states, 53 prefs, 3 notifications); `mt-1`..`mt-5` and `mr-1`/`mr-2` got the new columns only where still default; `kafaa_skills_apply` re-run for the 5 claim owners. Row digests of all 13 touched sets match `seed.json`.
- **2026-10-09 · W2 · E4 (branch `w2e4`, F15 Rotations and job shadowing, M20)** Own files only: `src/modules/m20/` (new routes `rotations` `/opportunities/rotations`, `rotations-my`, `rotations-shadow`, `rotations-host`, `rotations-board` (Agg/A or auditor), `rotations-design` (anyRole hr_analyst, hr_director, training_manager), `rotation-programme` `/opportunities/rotations/programmes/:id`; rules `rotation.ts`, recommenders `rotationMatch.ts`, `backend/rotation.local.ts`; the marketplace header links to rotations), `src/i18n/m20.*` (`m20.rot.*`), `scripts/seed/ext/f15-rotations.mjs`, `scripts/validate/w2e4-rotations.mjs`, `tests/unit/w2e4-*`, migration `20261009124001_kafaa_w2e4_rotations.sql`. Tables (all write mode `rpc`): `rotation_templates` and `rotation_cohorts` (staff R via `listed`; drafts to the owner), `rotation_placements` (Own for the person, host manager, signer, line manager and enrolling owner via an always-false `open_read`; admins/auditors all), `shadow_hosts` (opt-in directory, staff R), `shadow_requests` (requester, host, line manager). RPCs `saveRotationTemplate`, `saveRotationCohort`, `enrolRotation` (ledger), `placementCheckin`, `signoffPlacement` (ledger), `setShadowHost`, `requestShadow`, `decideShadow` (complete = ledger), reads `rotationBoard` (suppressed below 10) and `rotationCandidates` (names to programme owners only).
  - **Programme owners without a policy change:** template, cohort and enrolment writes accept the caller's `hr_analyst`/`hr_director` role (Agg on `opportunities`) or `training_manager` (W) (`kafaa_rot_owner_role`, TS `ownerRoleOf`). The card's "HR W for templates" would be cleaner as a `W` grant for HR on `opportunities` (contract request; not needed to work).
  - **Maker-checker:** a placement is signed off by its host manager unless the host is the person or the person's line manager (F08 `kafaa_opp_line_manager` / `lineManagerOf`); then by the host's own line manager (`kafaa_rot_signer`, TS `signerFor`). Sign-off needs the mid-point check-in.
  - **Shared effects (through M20's own SECURITY DEFINER functions):** sign-off writes `skill_evidence` (kind `ojt`, basis `evidenced`, level ≤ 3, id `se:ojt:<placement>:<skill>`, ref_table `rotation_placements`); confirmed shadowing writes level-1 `ojt` evidence (ref_table `shadow_requests`); both run `kafaa_skills_apply` / `applySkills` (F01). Notifications kind `rotation`. Security, cyber and safeguards families and skills are refused everywhere (`restricted_kind`); plant placements carry only `site_induction` ("site induction required").
- **2026-10-09 · W2 · E5 (branch `w2e5`, F16 Leadership journeys, F17 Communities of practice, module M22)** Only M22-owned files plus generated output; no shared source file edited. No new policy resource (M22 uses `skills_profile`, `talent_review`, `own_profile`, `knowledge`, `public_content`, `audit_log`).
  - Tables: `leadership_programmes` (public CNS facts with sources and as-of dates), `leadership_nominations` (nominee/nominator Own, managers Scope, training manager and HR authority read all; RPC only), `leadership_360_requests` (rater-only rows), `leadership_360` (responses carry no rater id and are unreadable through the API: `open_read` always false; aggregates only through RPCs), `communities`, `community_members`, `ks_sessions` (staff via `knowledge` R), `threads` and `posts` (staff read `visible` rows, authors their own, admins/auditors all), `expert_optin` (staff read `visible` rows; owner reads own), `expert_requests` (requester and expert only).
  - RPCs (`src/modules/m22/backend/rpc.ts`; SQL `20261009125001_kafaa_w2e5_leadership.sql`): `nominateLeader` (`self_nominate`, `not_in_scope`, managers only), `decideNomination` (HR authority via `talent_review` A, or training manager; `maker_checker` for nominator and nominee; ledger `kafaa.leadership.nomination`), `request360` (5-12 colleagues, self request added), `submit360`, `my360` (aggregates only with >= 5 responses, self excluded), `leadershipStats` (HR/auditor; grades and statuses < 10 suppressed), `joinCommunity`, `postThread` (members only; security/safeguards/cyber content refused by the G5 Dalil refusal floor patterns plus enabled `refusal_policies` rows, audit row stores the category only; email/phone refused; a member's first post in a community is held for a steward), `moderatePost` (stewards of that community or `knowledge` A; never own post), `moderationQueue`, `setExpertOptin` (level >= 3, never security skills), `findExperts` (visible opt-ins only, current level >= 3), `requestExpert`, `answerExpertRequest`. Internal helpers `kafaa_lead_*` / `kafaa_cop_*` are not executable by API roles.
  - Cross-module reads only: F01 `person_skills`/`skills`, F03 `rpc.claimSkill` for the leadership self check-in, M08 `sc_traits` (each 360 behaviour maps to an INPO 12-012 trait), M04 `training_records`/courses (`c-intilaqa`, `c-estadad`), M20 `lineManagerOf` in the seed builder, G5 refusal floor (copied into `POST_FLOOR`, with a unit test that every pattern is also refused by `detectGuard`). Notifications rows are inserted by the RPCs (kinds `leadership`, `community`; `on conflict do nothing`).
  - Routes: `leadership`, `leadership-programme` (`/leadership/programmes/:id`), `leadership-360`, `leadership-nominations`, `leadership-insights`, `communities`, `communities-detail` (`/communities/:id`), `community-thread` (`/communities/thread/:threadId`), `communities-experts`, `communities-sessions`. Seed `scripts/seed/ext/f16-leadership-communities.mjs`; PGlite checks `scripts/validate/w2e5-leadership.mjs`; tests `tests/unit/w2e5-*`.
  - Live (Supabase `hlirqxoddysxtdezwcgv`, 2026-10-09): applied as `kafaa_w2e5_leadership_part1_tables`, `_part2_functions`, `_part3_communities` and `_part4_norm_ascii` (the same SQL as the single local migration file); 11 tables seeded with `on conflict do nothing`; all 28 function bodies and the 11 table row digests match the local PGlite build.

- **2026-10-09 · W2 integration and QA (master)** Merged `w2e1`..`w2e5` (`--no-ff`; only generated files and this changelog conflicted; generated files regenerated with `npm run gen` after each merge). 145 routes (27 new), 145 SQL tables. Cross-feature hand-offs wired on master:
  - F12 → F07: employee-owned course actions of a held or acknowledged career conversation (not disagreed) rank first among the coach's courses with the reason `m19.reasons.agreed` ("Agreed in your career conversation on {date}", ref `career_conversations`); an agreed course that closes no gap still appears (`coachInputFrom` → `agreedCourses`, `useCoachData` reads `career_conversations`). The acknowledgement's "add to my Learning Coach" (focus role and hours → `learning_goals`) was already built by W2E2.
  - F11 → F08 / F13: the heatmap's suggested actions link to `/opportunities/post?skill=<id>` (pre-fills the skill the gig develops; restricted areas never pre-filled) and `/my/mentoring?skill=<id>` (pre-selects the focus skill; security skills ignored; a linked focus skill stays visible so it can be cleared).
  - F16 → F10: leadership readiness has "Ask my manager to validate these (skill check-in)" → `/my/skills/checkins?skills=a,b` (unmet leadership skills, at most 5); the check-in page opens "New check-in" with the requestable ones pre-selected (blocked or already-open skills are dropped).
  - Source `index.html` now carries the Netlify badge-hiding snippet (`<style>#nl-badge-frame,#nl-hud-frame{display:none!important}</style>` and `<div id="nl-badge-frame" hidden></div>`), so every build keeps it.
  - QA fixes: no sideways scroll at 390 px on `/my/skills/checkins` (the level-dot screen-reader label escaped its scroll container: `LevelDots` is now `relative`), `/my/mentoring/programme` and `/training/refreshers` (grid columns `minmax(0, …)` / `grid-cols-1`), and the Arabic validate queue (`PersonName` truncates). Tests: `tests/unit/w2-integration.test.tsx`, `tests/e2e/wave2.spec.ts` (8 journeys), wave-2 RTL/mobile/screenshot sets in `tests/e2e/visual.spec.ts`.
  - Live: all five wave-2 migrations were already applied by their engineers (15 `apply_migration` parts). Verified on master: all 295 `kafaa_*` function bodies md5-identical to a PGlite build of the repo (three foundation functions differ only by SQL comments stripped at the original apply); all 25 wave-2 tables match `seed.json` by row count and by md5 of the sorted ids; shared-table rows written by wave 2 (`dp-cc`/`pa-cc` plans, `nt-cc`/`nt-chk` notifications, `se:ojt`/`se:rating` evidence, mentors, requests, practice items) match by group digest.

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

- **2026-10-09 · W3 · E4 (branch `w3e4`, F23 Alumni and expert reserve, M20)** Own files only: `src/modules/m20/` new alumni parts (`reserve.ts` rules, `reserveMatch.ts`, `reserveUi.tsx`, `ReservePage.tsx`, `ReserveMePage.tsx`, `ReserveRequestPage.tsx`, `ReserveDeskPage.tsx`, `backend/reserve.local.ts`; additions to `routes.ts` and `backend/{schema,rpc,local,supabase}.ts`), `src/i18n/m20.*` (`m20.res.*`, four routes, `m20.reasons.res_*`), `scripts/seed/ext/f23-reserve.mjs`, `scripts/validate/w3e4-reserve.mjs`, `tests/unit/w3e4-*`, migration `20261009134001_kafaa_w3e4_reserve.sql`. No shared source file edited; generated outputs regenerated.
  - **New person kind `alumni`** lives in `kafaa_alumni.kind` (`alumni` departed ENEC staff, `partner_alumni` ended KHNP/KEPCO/Doosan secondments, `pre_departure` staff who consent early). Departed members have no `people` row (the 345-person F01 population is unchanged); the one seeded leaver `w-mnt-08` is linked by `person_id`. Departed alumni cannot sign in to the demo; the member side is demoed by `sme-reviewer` (live) and `k-instructor` (local).
  - Tables (rpc writes only): `alumni` (staff R reads a row only while `finder_visible`; own row via Own), `reserve_requests` (poster; admins/auditors), `reserve_engagements` (alumnus; poster only after HR hand-over via `poster_read_id`; admins/auditors), `alumni_stories` (staff R on `listed`). No contact column anywhere; free text with email/phone is refused (`contact_data`, pattern `CONTACT_PATTERN` = `kafaa_res_contact`).
  - RPCs: `joinReserve` (consent with withdrawal; ledger `kafaa.reserve.consent` / `kafaa.reserve.withdraw`; withdrawal hides the member at once, ends open engagements, blanks their name on engagements, unlists stories, sets `erase_after` = +6 months), `requestReserve` (managers W; `pending_hr`), `decideReserveRequest` (HR = `hr_analyst`/`hr_director` role; `maker_checker`; ledger on approval), `reserveInterest`, `inviteReserve` (HR), `decideReserveEngagement` (approve = "handed to HR", ledger; complete, ledger), reads `reserveBoard` (members: HR-approved requests only, never the poster identity) and `reserveDesk` (HR: registry, erasure schedule, stats suppressed below 10). Notifications kind `reserve`.
  - F17 hand-off (contract request, optional): the F17 expert finder could union `kafaa_alumni` rows with `finder_visible = true` (staff already read them by RLS); today the reserve hub shows them.
  - Live (`hlirqxoddysxtdezwcgv`): `kafaa_w3e4_reserve_part1_tables`, `_part2_helpers`, `_part3_rpcs` (same SQL as the file); seed loaded with `on conflict do nothing` (25 members, 11 requests, 14 engagements, 5 stories). The 28 function bodies and the 4 table row digests are md5-identical to a PGlite build.
