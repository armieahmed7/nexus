// FS wave H QA: table privileges of anon / authenticated / PUBLIC on every public.kafaa_* relation, as live Supabase has them.
//
// Why a second database: live Supabase has default privileges in schema public that give anon and authenticated ALL on every
// table the migration role creates. A migration that only revokes some privileges ("revoke insert, update on ...") therefore
// leaves the rest live (wave G: anon and authenticated kept the row-removal and table-emptying privileges on
// kafaa_prearrival_shares; the second one bypasses RLS). The shared validator database (supabase/tests/nexus_stubs.sql) has no
// such defaults, so a missing revoke is invisible there. This check loads the stubs, then the Supabase default privileges, then
// every migration, and asserts on every public.kafaa_% table / view created by a migration dated WAVE_FROM or later (since the
// audit-fixes PR #5 merged, WAVE_FROM is '' and that is every public.kafaa_* relation; before it, waves E-I only;
// generic: a later wave's table is covered with no change):
//   anon          SELECT only, except ANON_WRITE
//   authenticated SELECT only, except AUTH_WRITE (direct client writes through SupabaseBackend insert/update, RLS-gated)
//   PUBLIC        nothing
// Checked privileges: INSERT, UPDATE, the two removal privileges, REFERENCES, TRIGGER, at table level and column level.
// Every other write goes through SECURITY DEFINER kafaa_* RPCs. No client code removes rows (SupabaseBackend only inserts and
// updates), so no exception holds a removal privilege.
//
// Scope: the schema-wide fix (the pre-wave-E tables that earlier waves left partly open on live) lives in the `audit-fixes` PR
// (#5, kafaa_audit_grants), not in wave H. It has merged, so WAVE_FROM is '' and every public.kafaa_* relation is asserted (wave I
// QA, after merging main). Setting WAVE_FROM back to a migration prefix makes earlier tables audit-only again. The two
// exception-list checks (every
// explicit grant is documented; every documented exception is still granted) read the explicit grants only and stay schema-wide.
//
// Documented exceptions (the earlier-wave convention):
//   ANON_WRITE  kafaa_contact_requests INSERT: the M12 public contact form (anonInsert in src/data/schema.ts).
//   AUTH_WRITE_COLUMNS  kafaa_contact_requests UPDATE (status) to authenticated: staff mark a request routed / closed
//               (src/modules/m16/AdminPage.tsx); granted by kafaa_audit_contact_requests, RLS (kafaa_update) decides who may.
//   AUTH_WRITE  the tables some migration explicitly grants INSERT/UPDATE to authenticated: the generated RLS file
//               (scripts/gen-schema.mjs: tables with a client write rule) and the g4 / g5 / w0e1 / w1e2 / w1e3 / w1e5 / w2e3 / fs11 grants
//               (kafaa_skills, kafaa_career_targets, kafaa_roadmaps, kafaa_learning_goals, kafaa_future_interest,
//               kafaa_refresh_prefs, kafaa_benchmarks). A new table that needs direct client writes must be added here on
//               purpose; the check also fails when a migration grants INSERT/UPDATE to a table not listed here.
//
// CLI (from kafaa/):
//   node scripts/validate/fsqa8-grants.mjs --audit [--before <migration file>]  live-like grants beyond the convention, every
//                                                  relation, each row marked wave E-I (asserted) or pre-wave-E (audit only)
//   node scripts/validate/fsqa8-grants.mjs --sql   [--before <migration file>] [--all]  revoke-all + re-grant statements for
//                                                  every wave E-I table (every table with --all) whose live-like grants differ
//                                                  from the explicitly granted ones
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const read = (p) => readFileSync(p, 'utf8');
export const PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
const ROLES = ['anon', 'authenticated', 'public'];
/** '' = every migration: every public.kafaa_* relation is asserted (the audit-fixes PR #5 closed the pre-wave-E tables). Set it to
 *  the first migration of a wave (e.g. '20261010251001', FS51) to assert only the tables created from there on (see Scope above). */
export const WAVE_FROM = '';
/** In-scope label for messages. */
const SCOPE = WAVE_FROM ? 'wave E-I ' : '';

/** Names of the kafaa_* tables / views created by a migration dated WAVE_FROM or later (the generated schema file is earlier). */
export function waveTables(before) {
  const out = new Set();
  for (const f of readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql') && x >= WAVE_FROM && (!before || x < before)))
    for (const m of read(`supabase/migrations/${f}`).matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(kafaa_\w+)/gi)) out.add(m[1].toLowerCase());
  return out;
}

// What a Supabase project has in schema public for objects the migration role (postgres) creates.
export const SUPABASE_DEFAULT_PRIVILEGES = `
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;

export const ANON_WRITE = { kafaa_contact_requests: ['INSERT'] };
/** Column-level client writes: { table: { PRIV: [columns] } } for authenticated (table-level privilege not held). */
export const AUTH_WRITE_COLUMNS = { kafaa_contact_requests: { UPDATE: ['status'] } };
export const AUTH_WRITE = Object.fromEntries([
  'kafaa_adv_skills', 'kafaa_adv_technologies', 'kafaa_adv_tracks', 'kafaa_assessment_forms', 'kafaa_benchmarks',
  'kafaa_blueprints', 'kafaa_career_paths', 'kafaa_career_targets', 'kafaa_competencies', 'kafaa_consents',
  'kafaa_content_pages', 'kafaa_corpus_docs', 'kafaa_course_modules', 'kafaa_courses',
  'kafaa_critical_roles', 'kafaa_curriculum_rules', 'kafaa_data_requests', 'kafaa_dev_plans', 'kafaa_enrolments',
  'kafaa_eval_runs', 'kafaa_events', 'kafaa_exam_milestones', 'kafaa_external_requests', 'kafaa_facts', 'kafaa_faqs',
  'kafaa_feature_flags', 'kafaa_future_interest', 'kafaa_future_roles', 'kafaa_future_skills', 'kafaa_glossary', 'kafaa_hu_tools',
  'kafaa_integrations', 'kafaa_internships', 'kafaa_job_families', 'kafaa_job_roles', 'kafaa_jpms', 'kafaa_learning_goals',
  'kafaa_licence_candidates', 'kafaa_licence_programmes', 'kafaa_mentoring_requests', 'kafaa_mentors', 'kafaa_notifications',
  'kafaa_oe_lessons', 'kafaa_people', 'kafaa_plan_activities', 'kafaa_proficiency_levels', 'kafaa_programmes',
  'kafaa_refresh_prefs', 'kafaa_refusal_policies', 'kafaa_reporting_obligations', 'kafaa_requal_cycles', 'kafaa_requal_rules',
  'kafaa_roadmaps', 'kafaa_role_competencies', 'kafaa_role_responsibilities', 'kafaa_scenarios', 'kafaa_scholar_cohorts',
  'kafaa_scholars', 'kafaa_sessions', 'kafaa_skill_bridges', 'kafaa_skills', 'kafaa_sources', 'kafaa_supplier_readiness',
  'kafaa_talent_programmes', 'kafaa_task_items', 'kafaa_user_settings', 'kafaa_vacancies',
].map((t) => [t, ['INSERT', 'UPDATE']]).concat([['kafaa_contact_requests', ['INSERT']]]));

/** Privileges `role` may hold on `table` by the convention. */
export const allowed = (role, table) =>
  new Set(role === 'public' ? [] : ['SELECT', ...((role === 'anon' ? ANON_WRITE : AUTH_WRITE)[table] ?? [])]);

/** Loads the stubs (+ the Supabase default privileges when liveLike) and the migrations before `before` (all when omitted). */
export async function loadDb({ liveLike, before } = {}) {
  const db = new PGlite();
  await db.exec(read('supabase/tests/nexus_stubs.sql'));
  if (liveLike) await db.exec(SUPABASE_DEFAULT_PRIVILEGES);
  const migs = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && (!before || f < before)).sort();
  for (const m of migs) await db.exec(read(`supabase/migrations/${m}`));
  return db;
}

/** Map relation -> { kind, anon: Set, authenticated: Set, public: Set } of table-level privileges. */
export async function grantMap(db) {
  const rels = (await db.query(`select c.oid, c.relname t, c.relkind k from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'kafaa\\_%' and c.relkind in ('r', 'p', 'v', 'm', 'f') order by 2`)).rows;
  const rows = (await db.query(`select c.relname t, r.role, p.priv from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('public')) r(role) cross join unnest($1::text[]) p(priv)
    where n.nspname = 'public' and c.relname like 'kafaa\\_%' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and has_table_privilege(r.role, c.oid, p.priv)`, [PRIVS])).rows;
  const m = new Map(rels.map((r) => [r.t, { kind: r.k, anon: new Set(), authenticated: new Set(), public: new Set() }]));
  for (const r of rows) m.get(r.t)[r.role].add(r.priv);
  return m;
}

/** [{ table, role, privs }] for privileges beyond the convention, table level and column level. */
export async function violations(db) {
  const out = [];
  for (const [t, g] of await grantMap(db)) for (const role of ROLES) {
    const extra = PRIVS.filter((p) => g[role].has(p) && !allowed(role, t).has(p));
    if (extra.length) out.push({ table: t, role, privs: extra });
  }
  const cols = (await db.query(`select table_name t, grantee g, privilege_type p, count(*)::int n, array_agg(column_name::text order by column_name) c
    from information_schema.column_privileges
    where table_schema = 'public' and table_name like 'kafaa\\_%' and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type <> 'SELECT'
    group by 1, 2, 3`)).rows;
  for (const r of cols) {
    const role = r.g === 'PUBLIC' ? 'public' : r.g;
    if (allowed(role, r.t).has(r.p)) continue;
    const doc = role === 'authenticated' ? AUTH_WRITE_COLUMNS[r.t]?.[r.p] : undefined;
    if (doc && r.c.every((c) => doc.includes(c))) continue;
    out.push({ table: r.t, role, privs: [`${r.p} on ${r.n} columns`] });
  }
  return out;
}

const brief = (v) => v.slice(0, 8).map((x) => `${x.table} ${x.privs.join('/')}`).join('; ') + (v.length > 8 ? ` (+${v.length - 8} more)` : '');

export default async function fsqa8Grants({ ok }) {
  const live = await loadDb({ liveLike: true });
  const explicit = await loadDb({ liveLike: false });
  const L = await grantMap(live);
  const E = await grantMap(explicit);
  const W = waveTables();
  const inW = [...L.keys()].filter((t) => W.has(t));
  ok(L.size >= 360, `live-like grants: ${L.size} public.kafaa_* relations loaded on top of the Supabase default privileges`);
  ok(inW.length >= 60 && inW.length === W.size, `scope: ${inW.length} public.kafaa_* relations created by migrations from ${WAVE_FROM || 'the first one (every relation; audit-fixes PR #5 merged)'}${WAVE_FROM ? ' (waves E-I)' : ''}; ${L.size - inW.length} earlier ones are audit-only`);
  const v = (await violations(live)).filter((x) => W.has(x.table));
  for (const [role, label] of [['anon', `anon holds SELECT only on every ${SCOPE}public.kafaa_* relation (exception: kafaa_contact_requests INSERT)`],
    ['authenticated', `authenticated holds SELECT plus only the documented INSERT/UPDATE grants on every ${SCOPE}public.kafaa_* relation`],
    ['public', `PUBLIC holds no privilege on any ${SCOPE}public.kafaa_* relation`]]) {
    const mine = v.filter((x) => x.role === role);
    ok(mine.length === 0, `${label}${mine.length ? `; beyond: ${brief(mine)}` : ''}`);
  }
  ok(!v.some((x) => x.privs.some((p) => /^(DELETE|TRUNCATE)/.test(p))), `no API role can remove rows from or empty any ${SCOPE}public.kafaa_* table (TRUNCATE bypasses RLS)`);
  // the exceptions are exactly the explicit grants: a migration that grants a client write must be listed above on purpose
  const undocumented = [];
  for (const [t, g] of E) for (const role of ROLES) for (const p of g[role]) if (!allowed(role, t).has(p)) undocumented.push({ table: t, role, privs: [p] });
  ok(undocumented.length === 0, `every explicit grant to anon / authenticated / PUBLIC is SELECT or a documented exception${undocumented.length ? `; undocumented: ${brief(undocumented.map((x) => ({ ...x, privs: [`${x.role} ${x.privs[0]}`] })))}` : ''}`);
  const unused = Object.entries(AUTH_WRITE).flatMap(([t, ps]) => ps.filter((p) => !E.get(t)?.authenticated.has(p)).map((p) => `${t} ${p}`));
  const colGranted = new Set((await explicit.query(`select table_name || ' ' || privilege_type || ' ' || column_name k from information_schema.column_privileges
    where table_schema = 'public' and grantee = 'authenticated'`)).rows.map((r) => r.k));
  for (const [t, ps] of Object.entries(AUTH_WRITE_COLUMNS)) for (const [p, cs] of Object.entries(ps)) for (const c of cs) if (!colGranted.has(`${t} ${p} ${c}`)) unused.push(`${t} ${p} (${c})`);
  ok(unused.length === 0, `every documented authenticated exception (table and column level) is still granted by the migrations${unused.length ? `; stale: ${unused.join(', ')}` : ''}`);
  const differ = [...L].filter(([t]) => W.has(t)).filter(([t, g]) => ROLES.some((r) => [...g[r]].sort().join() !== [...(E.get(t)?.[r] ?? [])].sort().join())).map(([t]) => t);
  ok(differ.length === 0, `live-like grants equal the explicit ones on all ${inW.length} ${SCOPE}relations (nothing comes only from the Supabase defaults)${differ.length ? `; differ: ${differ.slice(0, 8).join(', ')}` : ''}`);
  await live.close();
  await explicit.close();
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--before');
  const before = i > 0 ? process.argv[i + 1] : undefined;
  const L = await grantMap(await loadDb({ liveLike: true, before }));
  const E = await grantMap(await loadDb({ liveLike: false, before }));
  const W = waveTables(before);
  const scope = (t) => (W.has(t) ? 'wave E-I' : 'pre-wave-E (audit-fixes PR)');
  if (process.argv.includes('--audit')) {
    let n = 0;
    for (const [t, g] of L) for (const role of ROLES) {
      const extra = PRIVS.filter((p) => g[role].has(p) && !allowed(role, t).has(p));
      if (extra.length) { n++; console.log(`${t}\t${role}\t${extra.join(',')}\t(intended: ${PRIVS.filter((p) => E.get(t)[role].has(p) && allowed(role, t).has(p)).join(',') || 'none'})\t${scope(t)}`); }
    }
    const open = [...L].filter(([t, g]) => ROLES.some((r) => PRIVS.some((p) => g[r].has(p) && !allowed(r, t).has(p)))).map(([t]) => t);
    console.log(`# ${n} relation x role rows beyond the convention, on ${open.length} of ${L.size} relations (wave E-I: ${open.filter((t) => W.has(t)).length} of ${W.size}, asserted; pre-wave-E: ${open.filter((t) => !W.has(t)).length}, audit only)`);
  }
  if (process.argv.includes('--sql')) {
    const lines = [];
    for (const [t, g] of L) {
      if (!process.argv.includes('--all') && !W.has(t)) continue;
      const e = E.get(t);
      if (ROLES.every((r) => [...g[r]].sort().join() === [...e[r]].sort().join() && [...g[r]].every((p) => allowed(r, t).has(p)))) continue;
      const want = (r) => PRIVS.filter((p) => e[r].has(p) && allowed(r, t).has(p)).map((p) => p.toLowerCase());
      const a = want('anon'), u = want('authenticated');
      lines.push(`revoke all on table public.${t} from anon, authenticated${g.public.size || e.public.size ? ', public' : ''};`);
      if (a.length && a.join() === u.join()) lines.push(`grant ${a.join(', ')} on table public.${t} to anon, authenticated;`);
      else { if (u.length) lines.push(`grant ${u.join(', ')} on table public.${t} to authenticated;`); if (a.length) lines.push(`grant ${a.join(', ')} on table public.${t} to anon;`); }
    }
    console.log(lines.join('\n'));
  }
  process.exit(0);
}
