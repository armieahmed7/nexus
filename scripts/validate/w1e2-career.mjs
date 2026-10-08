// [W1 · E2] PGlite checks for 20261009112001_kafaa_w1e2_career.sql: SQL = TS parity of careerReadiness for every seeded staff
// member against every role, the F05/F06 acceptance cases, share-gated RLS on the shortlist and roadmaps, RPC RBAC and idempotence.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w1e2Checks({ db, as, one, count, ok, uid }) {
  const { careerReadiness } = await import('../../src/modules/m18/career.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  // test identities (disjoint uid range 1121+)
  let n = 1120;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['k-lo-trainee', 'Local Operator'], ['qc-inspector', 'QC Inspector'], ['nse', 'Specification Engineer'], ['sro', 'Shift Manager · licensed SRO']]) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }

  // ── parity on a fresh database: SQL kafaa_career_readiness_compute = TS careerReadiness (every staff member × every role)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const data = {
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: T.person_skills,
    licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records,
    enrolments: T.enrolments, weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
  };
  const roleIds = T.job_roles.map((r) => r.id);
  const staff = T.people.filter((p) => p.kind === 'staff');
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
  let diffs = 0, first = '';
  let compared = 0;
  for (const p of staff) {
    const sql = (await fresh.query('select kafaa_career_readiness_compute($1, $2::text[], $3::date) as r', [p.id, roleIds, now])).rows[0].r;
    const ts = careerReadiness(data, p.id, roleIds, now);
    compared += ts.length;
    for (let i = 0; i < Math.max(sql.length, ts.length); i++) {
      const a = sql[i], b = ts[i];
      const same = a && b && Math.abs((a.score ?? 0) - (b.score ?? 0)) < 1e-4 && norm({ ...a, score: null }) === norm({ ...b, score: null });
      if (!same) { diffs++; if (!first) first = `${p.id}/${b?.role_id ?? a?.role_id}`; }
    }
  }
  ok(diffs === 0 && compared === staff.length * roleIds.length, `careerReadiness: SQL equals TS for ${staff.length} staff × ${roleIds.length} roles (${compared} results${diffs ? `; ${diffs} differ, first ${first}` : ''})`);
  const kro = (await fresh.query('select kafaa_career_readiness_compute($1, $2::text[], $3::date) as r', ['p-k-ro', ['senior-reactor-operator', 'security-officer'], now])).rows[0].r;
  await fresh.close();
  const sro = kro[0];
  const sroRoutes = sro.routes.filter((r) => ['sro_ro24', 'sro_bsc', 'sro_other_plant'].includes(r.route_code));
  ok(sroRoutes.length === 3 && sroRoutes.every((r) => /FANR-REG-17 Art\. 4/.test(r.rule_ref)) && sro.pct > 0 && sro.reasons.length >= 2 && kro[1].band === 'path_only' && kro[1].pct === null,
    'k-ro → SRO: gate list holds the three SRO routes with FANR-REG-17 Art. 4 references, a readiness % with reasons; security roles show no %');
  // gates never inflate readiness: no result anywhere is "ready now" with a not-met gate
  const all = staff.flatMap((p) => careerReadiness(data, p.id, roleIds, now));
  ok(all.every((r) => !(r.band === 'ready_now' && r.gate_status === 'not_met')) && all.some((r) => r.band === 'ready_now'), 'no role shows "ready now" while a gate is not met (and some roles are ready now)');

  // ── RLS: shortlist and roadmaps are the person's own; a line manager in scope reads them only when shared
  ok((await count(null, 'kafaa_career_targets')) === 0 && (await count(null, 'kafaa_roadmaps')) === 0, 'anonymous visitors read no shortlist or roadmap');
  const sroSees = await as('sro', `select t.id, t.shared, p.crew from kafaa_career_targets t join kafaa_people p on p.id = t.person_id where t.person_id <> kafaa_me()`);
  ok(sroSees.length > 0 && sroSees.every((r) => r.shared && r.crew === 'B') && sroSees.some((r) => r.id === 'ct:p-k-ro:senior-reactor-operator') && !sroSees.some((r) => r.id === 'ct:p-k-ro:human-performance-specialist'),
    'a shift supervisor reads only shared shortlists of crew B (k-ro\'s unshared target stays private)');
  ok((await count('sro', 'kafaa_roadmaps', `person_id <> kafaa_me() and not shared`)) === 0 && (await count('sro', 'kafaa_roadmaps', `id = 'rm-k-ro-sro'`)) === 1, 'unshared roadmaps stay private; k-ro\'s shared roadmap is visible to the crew B supervisor');
  ok((await count('k-hr-analyst', 'kafaa_career_targets', 'person_id <> kafaa_me()')) === 0 && (await count('gulfhydro-qa', 'kafaa_career_targets')) === 0 && (await count('k-auditor', 'kafaa_roadmaps')) === 0,
    'HR analysts, partners and auditors read no individual shortlist or roadmap');
  ok((await count('training-mgr', 'kafaa_career_targets', 'person_id <> kafaa_me() and not shared')) === 0, 'Nuclear Training reads shared shortlists only');
  ok((await count('k-ro', 'kafaa_career_targets')) === T.career_targets.filter((t) => t.person_id === 'p-k-ro').length, 'k-ro reads its own shortlist');
  // writes
  await as('k-ro', `update kafaa_career_targets set active = false where id = 'ct:p-k-ro:human-performance-specialist'`);
  const ins = await as('k-ro', `insert into kafaa_career_targets (id, person_id, role_id, rank, shared, shared_person_id) values ('ct:p-k-ro:nuclear-oversight-npi', 'p-k-ro', 'nuclear-oversight-npi', 3, false, 'p-k-ro') returning shared_person_id`);
  ok(ins.length === 1 && ins[0].shared_person_id === null, 'k-ro adds a target; the share column follows the shared flag (no forged sharing)');
  let four = false;
  try { await as('k-ro', `insert into kafaa_career_targets (id, person_id, role_id) values ('ct:p-k-ro:procurement-engineer', 'p-k-ro', 'procurement-engineer')`); } catch { four = true; }
  let other = false;
  try { await as('k-ro', `insert into kafaa_career_targets (id, person_id, role_id) values ('ct:p-nse:x', 'p-nse', 'procurement-engineer')`); } catch { other = true; }
  ok(four && other, 'a fourth active target is refused, and nobody writes another person\'s shortlist');
  const shareUp = await as('k-ro', `update kafaa_career_targets set shared = true where id = 'ct:p-k-ro:nuclear-oversight-npi' returning shared_person_id`);
  ok(shareUp[0]?.shared_person_id === 'p-k-ro' && (await count('sro', 'kafaa_career_targets', `id = 'ct:p-k-ro:nuclear-oversight-npi'`)) === 1, 'sharing a target makes it visible to the line manager');

  // ── careerReadiness RPC
  const self = (await one('k-ro', `select kafaa_career_readiness('p-k-ro', array['senior-reactor-operator']) as r`)).r;
  const mgr = (await one('sro', `select kafaa_career_readiness('p-k-ro', array['senior-reactor-operator']) as r`)).r;
  const unsharedPerson = T.people.find((p) => p.crew === 'B' && p.kind === 'staff' && p.id !== 'p-k-ro' && p.id !== 'p-sro' && !T.career_targets.some((t) => t.person_id === p.id && t.shared) && !T.roadmaps.some((r) => r.person_id === p.id && r.shared));
  const mgrNo = (await one('sro', `select kafaa_career_readiness($1, array['senior-reactor-operator']) as r`, [unsharedPerson.id])).r;
  const hr = (await one('k-hr-analyst', `select kafaa_career_readiness('p-k-ro', array['senior-reactor-operator']) as r`)).r;
  let anon = { code: 'not_signed_in' };
  try { anon = (await one(null, `select kafaa_career_readiness('p-k-ro', array['senior-reactor-operator']) as r`)).r; } catch { /* anon has no execute grant */ }
  ok(self.ok && self.data[0].routes.length >= 3 && mgr.ok && !mgrNo.ok && mgrNo.code === 'forbidden' && hr.code === 'forbidden' && anon.code === 'not_signed_in',
    'careerReadiness: self, or the line manager in scope when shared; unshared, out-of-scope and anonymous callers are refused');

  // ── roadmapToPlan: extends an open plan for the same target, or creates a draft; re-sending does not duplicate; audited
  const before = await count(null, 'kafaa_audit_events', `action = 'roadmap.to_plan' and outcome = 'ok'`).catch(() => 0);
  const r1 = (await one('k-ro', `select kafaa_roadmap_to_plan('rm-k-ro-sro') as r`)).r;
  const r2 = (await one('k-ro', `select kafaa_roadmap_to_plan('rm-k-ro-sro') as r`)).r;
  const dev = T.roadmaps.find((r) => r.id === 'rm-k-ro-sro').plan.filter((b) => b.lane === 'development').length;
  ok(r1.ok && r1.data.plan_id === 'dp-k-ro' && r1.data.created === dev && r2.ok && r2.data.created === 0 && r2.data.existing === dev, `roadmapToPlan extends k-ro's open SRO plan with ${dev} activities; re-sending adds none`);
  const q1 = (await one('qc-inspector', `select kafaa_roadmap_to_plan('rm-qc-procurement') as r`)).r;
  const planRow = await db.query(`select status from kafaa_dev_plans where id = $1`, [q1.data?.plan_id]);
  const acts = await db.query(`select count(*)::int n from kafaa_plan_activities where plan_id = $1`, [q1.data?.plan_id]);
  const audits = await db.query(`select count(*)::int n from kafaa_audit_events where action = 'roadmap.to_plan' and outcome = 'ok'`);
  ok(q1.ok && q1.data.plan_created && planRow.rows[0]?.status === 'draft' && acts.rows[0].n === q1.data.created && audits.rows[0].n >= 3,
    'with no open plan for the target, roadmapToPlan creates a draft plan with one activity per development block, and each call writes an audit row');
  const steal = (await one('sro', `select kafaa_roadmap_to_plan('rm-k-ro-sro') as r`)).r;
  ok(!steal.ok && steal.code === 'not_found', 'another person (even the line manager) cannot send someone else\'s roadmap');
  void before;
}
