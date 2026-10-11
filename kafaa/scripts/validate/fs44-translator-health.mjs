// [FS wave D · E4] PGlite checks for 20261010244001_kafaa_fs44_translator_health.sql (FS34 transferable-skills translator, FS35
// Career Health check): seed digests; SQL = TS for the translator (every occupation template, every staff passport) and the health
// check (every staff member, several dates); RLS (templates public, snapshots own only: no manager, HR, auditor or anonymous
// reader); the three RPCs (RBAC, refusals, audit, never the ledger; Execute links only my own shared conversation); internal
// rules not executable by API roles.
import { readFileSync } from 'node:fs';
import { translate, templateProblems, MAX_RESULTS } from '../../src/modules/m18/translate.ts';
import { careerHealth, HEALTH_KEYS } from '../../src/modules/m18/careerHealth.ts';
import { transformRole } from '../../src/modules/m30/transform.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v));
const same = (a, b) => canon(a) === canon(b);
const DATES = ['2026-10-11', '2025-09-22', '2027-06-30'];

export default async function fs44Checks({ db, as, one, count, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/_at$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v]));
  const rows = async (t) => (await q(`select * from ${t} order by id`)).map(fix);

  // ── seed
  const tpl = await rows('kafaa_occupation_templates');
  const skillIds = new Set(S.skills.map((s) => s.id));
  ok(tpl.length === S.occupation_templates.length && tpl.length >= 8 && same(tpl.map((t) => [t.id, t.esco_uri, t.skills, t.sources]), [...S.occupation_templates].sort((a, b) => (a.id < b.id ? -1 : 1)).map((t) => [t.id, t.esco_uri, t.skills, t.sources])),
    `the ${tpl.length} occupation templates load unchanged (at least 8 source occupations)`);
  ok(tpl.every((t) => templateProblems(t, skillIds).length === 0 && t.sources.every((s) => /^https:\/\/esco\.ec\.europa\.eu\//.test(s.url) && s.as_of)) && new Set(tpl.map((t) => t.industry)).size >= 5,
    `every template is an ESCO occupation concept with an ESCO-aligned skill set (each skill tied to an ESCO skill URI and label in EN and AR) and a cited https source with an as-of date; ${new Set(tpl.map((t) => t.industry)).size} industries`);
  const snaps = await rows('kafaa_health_snapshots');
  ok(snaps.length === S.health_snapshots.length && same(snaps.map((s) => [s.id, s.person_id, s.components, s.plan, s.step, s.conversation_id]), S.health_snapshots.map((s) => [s.id, s.person_id, s.components, s.plan, s.step, s.conversation_id])),
    `the ${snaps.length} seeded health snapshots load unchanged`);

  // ── TS inputs from the database as it stands now
  const D = {};
  for (const t of ['people', 'job_roles', 'role_competencies', 'competencies', 'skills', 'courses', 'course_skill_links', 'course_pack_items', 'career_paths', 'engine_settings', 'person_skills',
    'training_records', 'external_completions', 'pathway_enrolments', 'role_transformations', 'role_profile_versions', 'jta_tasks', 'jta_task_skills', 'ai_capability_levels']) D[t] = await rows(`kafaa_${t}`);
  const weights = Object.fromEntries(Object.entries(D.engine_settings.find((s) => s.id === 'recommend')?.weights ?? {}).filter(([, v]) => typeof v === 'number'));
  const TR = { roles: D.job_roles, roleComps: D.role_competencies, competencies: D.competencies, skills: D.skills, courses: D.courses, links: D.course_skill_links, packs: D.course_pack_items, edges: D.career_paths, weights };
  const held = (pid) => D.person_skills.filter((s) => s.person_id === pid && s.active !== false).map((s) => ({ skill_id: s.skill_id, level: Number(s.level) }));

  // ── FS34: translator SQL = TS
  const tDiffs = [];
  const tAll = [];
  for (const t of tpl) {
    const h = t.skills.map((s) => ({ skill_id: s.skill_id, level: s.level }));
    const ts = translate(TR, h, t.industry);
    const sql = (await q('select kafaa_fs34_translate($1::jsonb, $2, null) v', [JSON.stringify(h), t.industry]))[0].v;
    tAll.push([t, ts]);
    if (!same(ts, sql)) tDiffs.push(t.id);
  }
  const staff = D.people.filter((p) => p.kind === 'staff' && p.job_role_id && D.person_skills.some((s) => s.person_id === p.id)).map((p) => p.id);
  for (const pid of staff) {
    const role = D.people.find((p) => p.id === pid).job_role_id;
    const ts = translate(TR, held(pid), null, role);
    const sql = (await q('select kafaa_fs34_translate($1::jsonb, null, $2) v', [JSON.stringify(held(pid)), role]))[0].v;
    if (!same(ts, sql)) tDiffs.push(pid);
  }
  ok(tDiffs.length === 0, `kafaa_fs34_translate = translate() for ${tpl.length} templates and ${staff.length} staff passports${tDiffs.length ? ` (differs: ${tDiffs.slice(0, 3).join(', ')})` : ''}`);
  const results = tAll.flatMap(([, r]) => r.results);
  ok(tAll.every(([, r]) => r.results.length === MAX_RESULTS) && results.every((x) => x.reasons.length >= 4 && x.reasons.every((y) => /^m18\.fs34\.reason\./.test(y.key)) && x.bridge.every((b) => b.reasons.length >= 1 && b.weeks > 0)),
    'each result lists its delta skills and bridging items, every item with reasons');
  const secIds = new Set(D.job_roles.filter((r) => r.security_sensitive || r.lifecycle === 'concept').map((r) => r.id));
  ok(!results.some((x) => secIds.has(x.role_id)) && tAll.filter(([t]) => ['oil_gas', 'power', 'process', 'aviation', 'defence'].includes(t.industry)).every(([, r]) => r.results.every((x) => x.bridge[0]?.kind === 'crossover')),
    'never security, safeguards, cyber or concept roles; career-changers from industries with a cross-over course start their route with it (FS19)');
  // every gap is closed by the route: each gap competency appears in a course or practice item, and practice covers the levels left
  const closed = results.every((x) => x.gaps.every((g) => x.bridge.some((b) => b.competency_ids.includes(g.competency_id))));
  ok(closed, 'every delta skill is covered by a bridging course or supervised practice item');

  // ── FS35: health SQL = TS (every staff member, three dates)
  const mapOf = (person) => {
    const p = D.people.find((x) => x.id === person);
    const role = D.job_roles.find((r) => r.id === p?.job_role_id);
    if (!role || (role.lifecycle ?? 'current') !== 'current') return null;
    return transformRole({ role, map: D.role_transformations.find((m) => m.role_id === role.id) ?? null, versions: D.role_profile_versions, tasks: D.jta_tasks, taskSkills: D.jta_task_skills, levels: D.ai_capability_levels,
      skills: D.skills, courses: D.courses, mine: D.person_skills.filter((s) => s.person_id === person), horizon: '2030' });
  };
  const hd = (person) => ({ person: { id: person, job_role_id: D.people.find((x) => x.id === person)?.job_role_id ?? null }, roles: D.job_roles, roleComps: D.role_competencies, skills: D.skills,
    states: D.person_skills.filter((s) => s.person_id === person), training: D.training_records.filter((s) => s.person_id === person), external: D.external_completions.filter((s) => s.person_id === person),
    pathways: D.pathway_enrolments.filter((s) => s.person_id === person), weights, map: mapOf(person) });
  const hDiffs = [];
  const hAll = [];
  const everyone = D.people.filter((p) => p.kind === 'staff').map((p) => p.id);
  for (const pid of everyone) {
    const data = hd(pid);
    for (const d of DATES) {
      const ts = careerHealth(data, d);
      const sql = (await q('select kafaa_fs35_health($1, $2::date) v', [pid, d]))[0].v;
      if (d === DATES[0]) hAll.push(ts);
      if (!same(ts, sql)) hDiffs.push(`${pid}@${d}`);
    }
  }
  ok(hDiffs.length === 0, `kafaa_fs35_health = careerHealth() for ${everyone.length} staff x ${DATES.length} dates${hDiffs.length ? ` (differs: ${hDiffs.slice(0, 3).join(', ')})` : ''}`);
  ok(hAll.every((r) => r.components.length === 5 && same(r.components.map((c) => c.key), [...HEALTH_KEYS]) && r.components.every((c) => c.reasons.length >= 1 && c.inputs && typeof c.inputs === 'object' && Object.keys(c.inputs).length >= 3))
    && hAll.every((r) => r.good === r.components.filter((c) => c.status === 'good').length && !('score' in r)),
    'all five components are returned with their inputs and reasons; the only summary is the visible count of components in good shape (no hidden score)');
  const statuses = new Set(hAll.flatMap((r) => r.components.map((c) => `${c.key}:${c.status}`)));
  ok(['mobility:good', 'mobility:act', 'change:good', 'change:act', 'recency:good', 'recency:act'].every((k) => statuses.has(k)), `the seed exercises good and act states (${statuses.size} key x status pairs seen)`);

  // ── RLS: templates public, snapshots own only
  uid['k-ro'] ??= '00000000-0000-4000-8000-000000004401';
  uid['k-lo-trainee'] ??= '00000000-0000-4000-8000-000000004402';
  await q(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1, 'k-ro@test', 'k-ro', 'enec-ops', 'employee', $2), ($3, 'k-lo-trainee@test', 'k-lo-trainee', 'enec-ops', 'employee', $4) on conflict do nothing`,
    [uid['k-ro'], ['Reactor Operator'], uid['k-lo-trainee'], ['Trainee']]);
  const me = async (p) => (await one(p, 'select kafaa_me() m')).m;
  const kro = await me('k-ro');
  const own = S.health_snapshots.filter((s) => s.person_id === kro).length;
  const seen = {};
  for (const p of [null, 'k-ro', 'sro', 'chco', 'k-hr-analyst', 'k-auditor', 'k-admin', 'training-mgr']) seen[p ?? 'anon'] = [await count(p, 'kafaa_occupation_templates'), await count(p, 'kafaa_health_snapshots', `person_id = '${kro}'`), await count(p, 'kafaa_health_snapshots')];
  const ownOf = async (p) => { const id = await me(p); return S.health_snapshots.filter((s) => s.person_id === id).length; };
  ok(seen.anon[0] === tpl.length && Object.values(seen).every((v) => v[0] === tpl.length) && seen['k-ro'][1] === own && own === 3 && seen['k-ro'][2] === own
    && ['anon', 'sro', 'chco', 'k-hr-analyst', 'k-auditor', 'k-admin', 'training-mgr'].every((p) => seen[p][1] === 0)
    && seen.sro[2] === await ownOf('sro') && seen.chco[2] === await ownOf('chco') && seen.anon[2] === 0,
    `templates are public; a health snapshot is read by its owner only: no manager (sro), HR (chco, analyst), auditor, admin or anonymous reader sees k-ro's (${JSON.stringify(seen)})`);

  // ── RPCs
  const tm = (await one('k-ro', 'select kafaa_translate_mine() r')).r;
  ok(tm.ok && tm.data.held === held(kro).length && same({ industry: tm.data.industry, profile: tm.data.profile, results: tm.data.results }, (await q('select kafaa_fs34_translate($1::jsonb, null, $2) v', [JSON.stringify(held(kro)), 'reactor-operator']))[0].v)
    && !tm.data.results.some((x) => x.role_id === 'reactor-operator'), 'kafaa_translate_mine: k-ro translates their own passport (own role excluded)');
  const ch = (await one('k-ro', 'select kafaa_career_health() r')).r;
  ok(ch.ok && same(ch.data, (await q('select kafaa_fs35_health($1, current_date) v', [kro]))[0].v), 'kafaa_career_health: my health check now');
  const refused = [(await one('alnoor-gm', 'select kafaa_translate_mine() r')).r.code, (await one('alnoor-gm', 'select kafaa_career_health() r')).r.code, (await one('k-observer', "select kafaa_save_health_snapshot('{}'::jsonb) r")).r.code];
  let anon = 0;
  for (const f of ['kafaa_translate_mine()', 'kafaa_career_health()', "kafaa_save_health_snapshot('{}'::jsonb)"]) { try { await as(null, `select ${f}`); } catch { anon++; } }
  ok(same(refused, ['forbidden', 'forbidden', 'forbidden']) && anon === 3, `partners and observers are refused (${refused.join(', ')}); anonymous callers cannot execute the RPCs`);
  const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const led0 = await led();
  const created = (await one('k-ro', `select kafaa_save_health_snapshot($1::jsonb) r`, [JSON.stringify({ plan: { actions: ['learn', 'bridge'], note: ' Start digital I&C ', review_on: '2027-04-01' } })])).r;
  const row = (await q('select * from kafaa_health_snapshots where id = $1', [created.data?.id]))[0];
  ok(created.ok && created.data.step === 'charted' && row?.person_id === kro && same(row.plan, { actions: ['learn', 'bridge'], note: 'Start digital I&C', review_on: '2027-04-01', focus_role_id: null }) && row.components.length === 5,
    'Chart: k-ro saves a snapshot with a plan (components computed on the server, plan normalised)');
  const sroSnap = S.health_snapshots.find((s) => s.person_id === 'p-sro');
  const bad = [
    (await one('k-ro', `select kafaa_save_health_snapshot($1::jsonb) r`, [JSON.stringify({ plan: { actions: ['promote_me'] } })])).r.code,
    (await one('k-ro', `select kafaa_save_health_snapshot($1::jsonb) r`, [JSON.stringify({ snapshot_id: sroSnap.id, plan: { actions: [] } })])).r.code,
    (await one('k-ro', `select kafaa_save_health_snapshot($1::jsonb) r`, [JSON.stringify({ snapshot_id: created.data.id, conversation_id: 'cc-p-k-ro-2026-h2-2' })])).r.code,
    (await one('sro', `select kafaa_save_health_snapshot($1::jsonb) r`, [JSON.stringify({ snapshot_id: created.data.id, plan: { actions: [] } })])).r.code,
  ];
  ok(same(bad, ['invalid', 'not_found', 'invalid', 'not_found']), `refusals: unknown action, another person's snapshot, an unshared conversation, a manager writing to a report's snapshot (${bad.join(', ')})`);
  const exec = (await one('k-ro', `select kafaa_save_health_snapshot($1::jsonb) r`, [JSON.stringify({ snapshot_id: created.data.id, conversation_id: 'cc-p-k-ro-2026-h1-1' })])).r;
  const row2 = (await q('select step, conversation_id, plan from kafaa_health_snapshots where id = $1', [created.data.id]))[0];
  const aud = await q(`select outcome, ledger_status from kafaa_audit_events where action = 'career_health.save' order by seq`);
  ok(exec.ok && exec.data.step === 'executed' && !exec.data.created && row2.conversation_id === 'cc-p-k-ro-2026-h1-1' && row2.plan.actions.join() === 'learn,bridge'
    && aud.filter((a) => a.outcome === 'ok').length === 2 && aud.filter((a) => a.outcome === 'refused').length >= 5 && aud.every((a) => a.ledger_status === 'not_applicable') && (await led()) === led0,
    'Execute: my own shared conversation is linked (step executed); saves and refusals are audited and never reach the ledger');
  let direct = false;
  try { await as('k-ro', `insert into kafaa_health_snapshots (id, person_id, as_of) values ('x', '${kro}', current_date)`); } catch { direct = true; }
  let internal = 0;
  for (const f of ["kafaa_fs34_translate('[]'::jsonb, null, null)", "kafaa_fs35_health('p-k-ro', current_date)", "kafaa_fs35_plan('{}'::jsonb)"]) { try { await as('k-ro', `select ${f}`); } catch { internal++; } }
  ok(direct && internal === 3, 'snapshots cannot be written directly; the internal rules are not executable by API roles');
}
