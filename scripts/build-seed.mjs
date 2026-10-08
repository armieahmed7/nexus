// Builds the demo-tenant seed ONCE as JSON (src/seed/seed.json) and renders supabase/seed.sql from the same object,
// so the LocalBackend and the database never drift. Also validates the seed against src/data/schema.ts
// (types, enums, not-null, foreign keys) and writes the persona catalogue used by the sign-in screen.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SCHEMA, columnsOf, sqlName } from '../src/data/schema.ts';
import { SOURCES } from './seed/sources.mjs';
import { FAMILIES, LEVELS, buildRoles, buildCompetencies, buildRoleCompetencies, buildCareerPaths } from './seed/framework.mjs';
import { buildQualification, buildProgrammes, buildCourses, buildCurriculum } from './seed/learning.mjs';
import { buildAssessments } from './seed/assess.mjs';
import { buildOrganisations } from './seed/partners.mjs';
import { buildFacts, buildPages, buildFaqs, buildGlossary, buildSafetyCulture, buildAdvanced, buildTalent, buildKpis, buildWorkforce, buildCriticalRoles, buildDalil, buildIntegrations } from './seed/content.mjs';
import { buildPeople, PERSONAS, personPid, DEMO_TODAY } from './seed/people.mjs';
import { extendG5 } from './seed/g5.mjs'; // G5 (M08/M12/M13/M14/M16) rows; see CONTRACT.md changelog

const T = {};
T.sources = SOURCES.map(([id, label, url, publisher]) => ({ id, label, url, publisher, accessed: '2026-10-08', note: null }));
const { orgs, agreements } = buildOrganisations();
T.organisations = orgs;
T.agreements = agreements;
T.job_families = FAMILIES;
const { roles, resp } = buildRoles();
T.job_roles = roles;
T.role_responsibilities = resp;
T.proficiency_levels = LEVELS;
T.competencies = buildCompetencies();
T.role_competencies = buildRoleCompetencies();
T.career_paths = buildCareerPaths();
const q = buildQualification();
T.qual_standards = q.standards;
T.task_items = q.tasks;
T.jpms = q.jpms;
T.requal_rules = q.requal;
T.programmes = buildProgrammes();
const c = buildCourses();
T.courses = c.courses;
T.course_modules = c.modules;
T.curriculum_rules = buildCurriculum();
const a = buildAssessments();
T.items = a.items;
T.item_versions = a.versions;
T.assessment_forms = a.forms;
T.blueprints = [{ id: 'bp-coit-written', title: 'COIT internal written exam blueprint', standard_id: 'qs-ro', spec: [{ competency_id: 'pf-01', count: 10 }, { competency_id: 'pf-02', count: 10 }], status: 'approved' }];
T.facts = buildFacts();
T.content_pages = buildPages();
T.faqs = buildFaqs();
T.glossary = buildGlossary();
const sc = buildSafetyCulture();
T.sc_traits = sc.traits;
T.hu_tools = sc.hu;
T.ecp_channels = sc.ecp;
T.oe_lessons = sc.oe;
T.concern_cases = sc.cases;
const adv = buildAdvanced();
T.adv_technologies = adv.techs;
T.skill_bridges = adv.bridges;
T.future_skills = adv.future;
const tal = buildTalent();
T.talent_programmes = tal.programmes;
T.events = tal.events;
T.vacancies = tal.vacancies;
T.kpi_series = buildKpis();
T.workforce_snapshots = buildWorkforce(FAMILIES);
T.critical_roles = buildCriticalRoles();
const dal = buildDalil(T.content_pages, roles);
T.corpus_docs = dal.docs;
T.refusal_policies = dal.refusals;
T.dalil_settings = dal.settings;
T.eval_runs = dal.evals;
T.integrations = buildIntegrations();
Object.assign(T, buildPeople({ standards: T.qual_standards, tasks: T.task_items, curriculum: T.curriculum_rules, courses: T.courses }));
extendG5(T); // G5: news, feature flags, FAQs, facts, corpus, ECP/Dalil/access-review demo rows

// ───────────── Seed audit log (hash chain identical to kafaa_audit_canonical in SQL and src/data/audit.ts)
const canon = (e) => [e.seq, e.ts.replace(/\.\d{3}Z$/, 'Z'), e.actor_person_id ?? '', e.actor_role ?? '', e.action, e.entity_table ?? '', e.entity_id ?? '', e.outcome, e.reason ?? ''].join('|');
const AUD = [
  ['2026-10-01T08:00:00Z', 'p-k-admin', 'admin', 'role.grant', 'role_assignments', 'ra-1', 'ok', 'Demo tenant provisioned; elevated roles approved by a second admin'],
  ['2026-10-02T09:30:00Z', 'p-k-instructor', 'instructor', 'evaluation.signoff', 'evaluations', 'ev-1', 'ok', 'JPM signed by qualified evaluator'],
  ['2026-10-03T10:12:00Z', 'w-instr-01', 'instructor', 'evaluation.signoff', 'qual_records', 'qr-w-instr-01-qs-instr', 'refused', 'Self-sign refused: an evaluator cannot sign off their own qualification'],
  ['2026-10-05T11:00:00Z', 'p-gulfhydro-qa', 'partner_admin', 'equivalency.read', 'equivalency_requests', 'eq-1', 'refused', 'Not found: record belongs to another organisation'],
  ['2026-10-06T12:00:00Z', 'p-sq-lead', 'instructor', 'equivalency.decide', 'equivalency_requests', 'eq-1', 'ok', 'Equivalent'],
  ['2026-10-07T07:45:00Z', 'p-chco', 'hr_director', 'observer_report.approve', 'observer_reports', 'or-1', 'ok', 'Release to org-observer approved (H1 2026)'],
  ['2026-10-08T08:15:00Z', 'p-k-licensing-coord', 'licensing_coord', 'licence.status', 'licences', 'lic-w-ro-02', 'ok', 'Lapse detected from source sync; lapse task created (due 2026-10-13)'],
];
let prev = '0'.repeat(64);
T.audit_events = AUD.map(([ts, actor, role, action, table, entity, outcome, reason], i) => {
  const e = { id: `AE-${String(i + 1).padStart(7, '0')}`, seq: i + 1, ts, actor_person_id: actor, actor_role: role, action, entity_table: table, entity_id: entity, outcome, reason, before_hash: null, after_hash: null, request_id: null, prev_hash: prev, hash: '', ledger_status: action.includes('signoff') || action.includes('decide') || action.includes('approve') ? 'skipped' : 'not_applicable', ledger_seq: null };
  e.hash = createHash('sha256').update(prev + canon(e)).digest('hex');
  prev = e.hash;
  return e;
});
T.ledger_local = [];

// ───────────── Normalise and validate against the schema
const problems = [];
const ids = {};
for (const name of Object.keys(SCHEMA)) {
  T[name] ||= [];
  const cols = columnsOf(name);
  const colNames = new Set(cols.map((x) => x.name));
  ids[name] = new Set();
  T[name] = T[name].map((row, idx) => {
    const out = {};
    for (const k of Object.keys(row)) if (!colNames.has(k)) problems.push(`${name}[${idx}] unknown column ${k}`);
    for (const col of cols) {
      let v = row[col.name];
      if (v === undefined) {
        if (col.def !== undefined) {
          const d = col.def;
          v = d === 'now' ? `${DEMO_TODAY}T00:00:00Z` : d === '[]' ? [] : d === '{}' ? {} : d === 'true' ? true : d === 'false' ? false : /^-?\d+(\.\d+)?$/.test(d) ? Number(d) : d.startsWith("'") ? d.slice(1, -1) : col.type === 'json' ? JSON.parse(d) : d;
        } else v = null;
      }
      if (v === null && !col.nullable && !col.pk) problems.push(`${name}[${idx}] ${col.name} is null`);
      if (v !== null && col.enumValues && !col.enumValues.includes(v)) problems.push(`${name}[${idx}] ${col.name}=${v} not in enum`);
      if (v !== null && (col.type === 'int' || col.type === 'num') && typeof v !== 'number') problems.push(`${name}[${idx}] ${col.name} not a number: ${v}`);
      if (v !== null && col.type === 'bool' && typeof v !== 'boolean') problems.push(`${name}[${idx}] ${col.name} not boolean`);
      if (v !== null && col.type === 'text[]' && !Array.isArray(v)) problems.push(`${name}[${idx}] ${col.name} not array`);
      out[col.name] = v;
    }
    if (ids[name].has(out.id)) problems.push(`${name} duplicate id ${out.id}`);
    ids[name].add(out.id);
    return out;
  });
}
for (const name of Object.keys(SCHEMA)) {
  for (const col of columnsOf(name)) {
    if (!col.ref) continue;
    T[name].forEach((row, idx) => { if (row[col.name] != null && !ids[col.ref].has(row[col.name])) problems.push(`${name}[${idx}] ${col.name} -> ${col.ref} missing ${row[col.name]}`); });
  }
}
if (problems.length) {
  console.error(`seed validation failed (${problems.length}):\n` + problems.slice(0, 60).join('\n'));
  process.exit(1);
}

// ───────────── Persona catalogue for the sign-in screen
const personas = PERSONAS.map((p) => ({ persona: p.persona, person_id: personPid(p.persona), nexus: p.nexus, title_en: p.title_en, title_ar: p.title_ar, kind: p.kind, org_id: p.org_id ?? null, roles: p.roles.map((x) => x.role), scopes: p.roles.map((x) => `${x.role}:${x.scope_type}${x.scope_value ? '=' + x.scope_value : ''}`) }));

mkdirSync('src/seed', { recursive: true });
const seed = { meta: { generated_at: new Date().toISOString().slice(0, 10), demo_today: DEMO_TODAY, tenant: "demo (synthetic)", note: "Kafa'a demo tenant. All people are synthetic. Public facts cite sources; everything else is SAMPLE." }, personas, tables: T };
writeFileSync('src/seed/seed.json', JSON.stringify(seed));
writeFileSync('src/seed/personas.json', JSON.stringify(personas, null, 1));

// ───────────── seed.sql
const lit = (v, type) => {
  if (v === null || v === undefined) return 'null';
  if (type === 'json') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (type === 'text[]') return v.length ? `array[${v.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(',')}]::text[]` : "'{}'::text[]";
  if (type === 'bool') return v ? 'true' : 'false';
  if (type === 'int' || type === 'num') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
let sql = `-- Kafa'a demo tenant seed. GENERATED by scripts/build-seed.mjs from the same object as src/seed/seed.json.\n-- Idempotent: rows are upserted by id. All people are synthetic.\nbegin;\nset local kafaa.seeding = 'on';\nset constraints all deferred;\n`;
let rows = 0;
for (const [name, def] of Object.entries(SCHEMA)) {
  if (def.localOnly || !T[name].length) continue;
  const cols = columnsOf(name);
  const colList = cols.map((x) => x.name).join(', ');
  const upd = cols.filter((x) => !x.pk).map((x) => `${x.name} = excluded.${x.name}`).join(', ');
  sql += `\n-- ${name} (${T[name].length})\n`;
  for (let i = 0; i < T[name].length; i += 200) {
    const chunk = T[name].slice(i, i + 200);
    sql += `insert into ${sqlName(name)} (${colList}) values\n${chunk.map((row) => `(${cols.map((x) => lit(row[x.name], x.type)).join(', ')})`).join(',\n')}\non conflict (id) do ${def.write.mode === 'append' ? 'nothing' : `update set ${upd}`};\n`;
    rows += chunk.length;
  }
}
sql += '\ncommit;\n';
writeFileSync('supabase/seed.sql', sql);
console.log(`build-seed: ${rows} rows across ${Object.keys(SCHEMA).filter((n) => T[n].length).length} tables; ${personas.length} personas`);
