// [W0 · F01/F02] PGlite checks for 20261009101001_kafaa_w0e1_skills_core.sql: SQL/TS parity of the derived skill states
// for every seeded person, security restriction, RLS on the skill tables, recompute RBAC and determinism, engine settings.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w0Checks({ db, as, one, count, ok }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  // Parity runs on a fresh database (earlier checks in this run have already signed off, recorded JPMs and so on).
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;

  // ── parity: SQL derive/compute over the seeded tables gives exactly the seeded (TS-derived) evidence and states
  const ev = await fq(`select id, level, basis, status, observed_on::text as observed_on from kafaa_skill_evidence_derive(null, $1::date) order by id collate "C"`, [now]);
  const seedDerived = T.skill_evidence.filter((e) => ['qual', 'course', 'assessment', 'jpm'].includes(e.kind) && !['fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts'].includes(e.ref_table) /* FS10, FS21/FS22 */).sort((a, b) => (a.id < b.id ? -1 : 1));
  const evSame = ev.length === seedDerived.length && ev.every((r, i) => r.id === seedDerived[i].id && r.level === seedDerived[i].level && r.basis === seedDerived[i].basis && r.status === seedDerived[i].status && r.observed_on === seedDerived[i].observed_on);
  ok(evSame, `SQL derived evidence equals the TS seed (${ev.length} rows)`);
  const st = await fq(`select id, level, confidence::float8 as confidence, basis, reasons, evidence_count from kafaa_skill_states_compute(null, $1::date) order by id collate "C"`, [now]);
  const seedStates = [...T.person_skills].sort((a, b) => (a.id < b.id ? -1 : 1));
  const norm = (r) => JSON.stringify(r.map((x) => ({ code: x.code, evidence_id: x.evidence_id, level: x.level, basis: x.basis, observed_on: x.observed_on, ageing: x.ageing })));
  const diff = st.filter((r, i) => { const s = seedStates[i]; return !s || r.id !== s.id || r.level !== s.level || r.confidence !== s.confidence || r.basis !== s.basis || r.evidence_count !== s.evidence_count || norm(r.reasons) !== norm(s.reasons); });
  ok(st.length === seedStates.length && diff.length === 0, `SQL skill states equal the TS seed for every person (${st.length} states${diff.length ? `; first diff ${diff[0].id}` : ''})`);
  ok(new Set(st.map((r) => r.id.split(':')[1])).size === T.people.length, `every one of the ${T.people.length} synthetic people has a skill state`);
  const orphan = await fq(`select p.id from kafaa_person_skills p cross join lateral jsonb_array_elements(p.reasons) r where not exists (select 1 from kafaa_skill_evidence e where e.id = r->>'evidence_id') limit 1`);
  ok(orphan.length === 0 && (await fq(`select count(*)::int n from kafaa_person_skills where jsonb_array_length(reasons) = 0`))[0].n === 0, 'every state lists at least one reason and every reason links to an evidence row');

  // ── qualification current -> verified; the same record after expiry -> evidenced with a lapsed reason
  const cur = await fq(`select basis, level, status from kafaa_skill_evidence_derive('p-k-ro', $1::date) where ref_id = 'qr-p-k-ro-qs-ro' and skill_id = 'sk-pf-01'`, [now]);
  const lap = await fq(`select basis, level, status from kafaa_skill_evidence_derive('p-k-ro', '2027-09-01'::date) where ref_id = 'qr-p-k-ro-qs-ro' and skill_id = 'sk-pf-01'`);
  const lapState = await fq(`select basis, reasons from kafaa_skill_states_compute('p-k-ro', '2027-09-01'::date) where skill_id = 'sk-pf-01'`);
  await fresh.close();
  ok(cur[0]?.basis === 'verified' && lap[0]?.basis === 'evidenced' && lap[0]?.status === 'lapsed' && lap[0].level < cur[0].level && lapState[0].basis !== 'verified' && lapState[0].reasons.some((r) => r.code === 'qual_lapsed'),
    'a current qualification yields verified; the same record expired yields at most evidenced with a lapsed reason');

  // ── security: restricted standards contribute only security-domain skills and never task detail
  const restricted = T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id);
  const secTasks = T.task_items.filter((t) => restricted.includes(t.standard_id));
  const secRows = await q(`select e.* from kafaa_skill_evidence e join kafaa_qual_records r on r.id = e.ref_id join kafaa_qual_standards s on s.id = r.standard_id where s.security_restricted`);
  const allEv = await q(`select id, ref_table, ref_id, coalesce(note, '') note from kafaa_skill_evidence`);
  const leaks = allEv.filter((e) => e.ref_table === 'task_items' || e.ref_table === 'evaluations' || secTasks.some((t) => `${e.id} ${e.ref_id} ${e.note}`.includes(t.id) || e.note.includes(t.statement_en)));
  const secComp = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
  const secSkills = new Set(T.skills.filter((s) => secComp.has(s.competency_id)).map((s) => s.id));
  ok(secRows.length > 0 && secRows.every((e) => secSkills.has(e.skill_id)) && leaks.length === 0, 'security-restricted standards add only security-domain skills; no task id or title appears in any evidence row');

  // ── RLS
  ok((await count(null, 'kafaa_person_skills')) === 0 && (await count(null, 'kafaa_skill_evidence')) === 0, 'anonymous visitors read no skill state or evidence');
  ok((await count(null, 'kafaa_skills')) === T.skills.length && (await count(null, 'kafaa_engine_settings')) === 4, 'the skill catalogue and engine settings are public');
  const sroOthers = await as('sro', `select distinct p.crew from kafaa_person_skills s join kafaa_people p on p.id = s.person_id where p.id <> kafaa_me()`);
  ok(sroOthers.length > 0 && sroOthers.every((r) => r.crew === 'B'), 'a shift supervisor reads skill states of crew B only (Scope)');
  ok((await count('k-hr-analyst', 'kafaa_person_skills', 'person_id <> kafaa_me()')) === 0, 'HR analysts read no individual skill states (aggregate only)');
  // W5E2 (F33): partners read only their own organisation's contractor passports; auditors (equivalency R) contractor rows and their own row only.
  ok((await count('gulfhydro-qa', 'kafaa_person_skills', `org_id is distinct from 'org-gulfhydro'`)) === 0 && (await count('gulfhydro-qa', 'kafaa_person_skills')) > 0
    && (await count('k-auditor', 'kafaa_person_skills', 'not contractor and person_id <> kafaa_me()')) === 0, 'partners read only their organisation\'s contractor skill states; auditors read no staff skill states (F33)');
  let direct = false;
  try { await as('training-mgr', `insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis) values ('x', 'p-k-ro', 'sk-pf-01', 4, 1, 'verified')`); } catch { direct = true; }
  ok(direct, 'skill states cannot be written directly (RPC only)');

  // ── recompute: RBAC, audit without ledger, determinism
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const a1 = await one('training-mgr', `select kafaa_recompute_skills(null) r`);
  const snap1 = (await q(`select md5(string_agg(id || level || confidence || basis || reasons::text || active, ',' order by id collate "C")) h from kafaa_person_skills`))[0].h;
  const a2 = await one('training-mgr', `select kafaa_recompute_skills(null) r`);
  const snap2 = (await q(`select md5(string_agg(id || level || confidence || basis || reasons::text || active || updated_at, ',' order by id collate "C")) h from kafaa_person_skills`))[0].h;
  const snap2b = (await q(`select md5(string_agg(id || level || confidence || basis || reasons::text || active, ',' order by id collate "C")) h from kafaa_person_skills`))[0].h;
  const a3 = await one('training-mgr', `select kafaa_recompute_skills(null) r`);
  const snap3 = (await q(`select md5(string_agg(id || level || confidence || basis || reasons::text || active || updated_at, ',' order by id collate "C")) h from kafaa_person_skills`))[0].h;
  ok(a1.r.ok && a2.r.ok && JSON.stringify(a1.r.data) === JSON.stringify(a2.r.data) && snap1 === snap2b && snap2 === snap3 && a1.r.data.people === T.people.length, `recomputeSkills is deterministic: identical output and rows on repeated runs (digest ${String(a1.r.data.digest).slice(0, 12)}…)`);
  const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const aud = await q(`select outcome, ledger_status from kafaa_audit_events where action = 'skills.recompute' order by seq desc limit 1`);
  ok(led1 === led0 && aud[0]?.outcome === 'ok' && aud[0].ledger_status === 'not_applicable', 'recompute is audited without a ledger write');
  const self = await one('sro', `select kafaa_recompute_skills('p-sro') r`);
  const inScope = await one('sro', `select kafaa_recompute_skills('w-ro-01') r`);
  const outScope = await one('sro', `select kafaa_recompute_skills('p-k-hr-analyst') r`);
  const all = await one('sro', `select kafaa_recompute_skills(null) r`);
  const obs = await one('k-observer', `select kafaa_recompute_skills('p-k-observer') r`);
  ok(self.r.ok && inScope.r.ok && outScope.r.code === 'forbidden' && all.r.code === 'forbidden' && obs.r.code === 'forbidden', 'recompute: self and in-scope allowed; out of scope, everyone (non training manager) and non-staff refused');
  let anonDenied = false;
  try { await as(null, `select kafaa_recompute_skills('p-k-ro')`); } catch { anonDenied = true; }
  ok(anonDenied, 'anonymous callers cannot execute recompute');
  let internal = false;
  try { await as('training-mgr', `select * from kafaa_skills_apply(null, current_date)`); } catch { internal = true; }
  ok(internal, 'the internal apply/derive functions are not executable by API roles');

  // ── engine settings (F02)
  const e1 = await one('k-admin', `select kafaa_set_engine_weights('recommend', 'model', null) r`);
  const e2 = await one('training-mgr', `select kafaa_set_engine_weights('recommend', 'deterministic', null) r`);
  const e3 = await one('k-admin', `select kafaa_set_engine_weights('recommend', 'deterministic', '{"core": 99}'::jsonb) r`);
  const e4 = await one('k-admin', `select kafaa_set_engine_weights('recommend', 'deterministic', null) r`);
  const row = (await q(`select engine, weights from kafaa_engine_settings where id = 'recommend'`))[0];
  ok(e1.r.ok && e2.r.code === 'forbidden' && e3.r.code === 'invalid' && e4.r.ok && row.engine === 'deterministic' && row.weights.core === 3, 'engine settings: admin only, weights validated, existing weights kept');
  ok((await q(`select count(*)::int n from kafaa_policy_matrix where resource in ('skills_profile','opportunities','talent_review','knowledge','learning_analytics','sat','lrs')`))[0].n > 50, 'policy matrix carries the seven F01 resources');
}
