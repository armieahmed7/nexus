// [FS wave A · E5 · FS06] PGlite checks for 20261010215001_kafaa_fs15_task_future.sql (task layer with AI exposure and change horizon).
// SQL = TS parity of exposureOf (every seeded task, plus 600 generated needs x horizon x critical cases) and of the needs validator;
// stored exposure equals the rule; kafaa_task_future equals the TS view built from the seed; restricted tasks are never rated,
// linked or returned (trigger, check constraint, guard); RLS (training staff and auditors only); RBAC (training manager or a
// designated SAT analyst writes; instructors and auditors read); every edit writes one SAT change-log row and one audit row.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { HORIZONS, TASK_DIMS, canonNeeds, exposureOf, validNeeds } from '../../src/modules/m26/future.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export default async function fs15Checks({ db, one, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  console.log('FS wave A · E5 · FS06 task layer with AI exposure and change horizon');
  let n = 1510;
  for (const [persona, role] of [['k-ro', 'Reactor Operator']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const live = T.jta_tasks.filter((t) => !t.restricted);
  const restricted = T.jta_tasks.filter((t) => t.restricted);
  const levels = T.ai_capability_levels;

  // ── seed sanity (acceptance: all non-restricted JTA tasks are rated; restricted tasks have null values)
  ok(live.length > 0 && live.every((t) => validNeeds(t.ai_capability_needed) && t.change_horizon && t.tech_driver && t.exposure), `seed: all ${live.length} non-restricted JTA tasks are rated (needs, horizon, driver, exposure)`);
  ok(restricted.length > 0 && restricted.every((t) => t.ai_capability_needed === null && t.exposure === null && t.change_horizon === null && t.tech_driver === null), `seed: ${restricted.length} restricted tasks carry null future values`);
  const links = T.jta_task_skills.filter((x) => x.active);
  ok(live.every((t) => links.some((x) => x.task_id === t.id)) && !links.some((x) => restricted.some((t) => t.id === x.task_id)), 'seed: every non-restricted task links at least one skill; no restricted task has a link');
  ok(!links.some((x) => T.skills.find((s) => s.id === x.skill_id)?.area === 'security'), 'seed: no security skill is linked to a SAT task');
  ok(live.every((t) => exposureOf({ needs: t.ai_capability_needed, change_horizon: t.change_horizon, critical: t.critical, restricted: false }, levels).exposure === t.exposure), 'seed: stored exposure equals exposureOf() for every task');
  ok(levels.length === TASK_DIMS.length * HORIZONS.length && levels.every((l) => l.simulated && l.level >= 1 && l.level <= 5), `seed: ${levels.length} AI capability reference levels (9 dimensions x 3 horizons), all SIMULATED, on the 1-5 scale`);
  ok(T.ai_exposure_refs.every((r) => r.sources.length && r.sources.every((s) => /^https:\/\//.test(s.url)) && r.as_of), 'seed: every benchmark figure is a sourced row with an https source and an as-of date');

  // ── parity on a pristine database
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const diff = [];
  for (const t of T.jta_tasks) {
    const s = (await fq('select kafaa_fx_exposure(ai_capability_needed, change_horizon, critical, restricted) j, exposure from kafaa_jta_tasks where id = $1', [t.id]))[0];
    const ts = exposureOf({ needs: t.ai_capability_needed, change_horizon: t.change_horizon, critical: t.critical, restricted: t.restricted }, levels);
    if (canon(s.j) !== canon(ts) || (s.exposure ?? null) !== (ts?.exposure ?? null)) diff.push(t.id);
  }
  ok(diff.length === 0, `SQL kafaa_fx_exposure equals exposureOf() for all ${T.jta_tasks.length} seeded tasks (restricted -> null)${diff.length ? ` (first diff ${diff[0]})` : ''}`);
  let seedN = 61;
  const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
  const gd = [];
  for (let i = 0; i < 600; i++) {
    const dims = [...TASK_DIMS].sort(() => rand() - 0.5).slice(0, 1 + Math.floor(rand() * 4));
    const needs = Object.fromEntries(dims.map((d) => [d, 1 + Math.floor(rand() * 5)]));
    const h = HORIZONS[Math.floor(rand() * 3)], crit = rand() < 0.3;
    const s = (await fq('select kafaa_fx_exposure($1::jsonb, $2, $3, false) j', [JSON.stringify(needs), h, crit]))[0].j;
    if (canon(s) !== canon(exposureOf({ needs, change_horizon: h, critical: crit, restricted: false }, levels))) gd.push(JSON.stringify([needs, h, crit]));
  }
  ok(gd.length === 0, `SQL kafaa_fx_exposure equals exposureOf() for 600 generated needs x horizon x critical cases${gd.length ? ` (first ${gd[0]})` : ''}`);
  const needCases = [{}, { language: 3 }, { language: 0 }, { language: 6 }, { language: 2.5 }, { consciousness: 2 }, { foo: 1 }, { language: '3' }, [1], null, 'x',
    { language: 1, social: 2, vision: 3, robotic: 4 }, { language: 1, social: 2, vision: 3, robotic: 4, creativity: 2 }, { metacognition: 5 }];
  const nd = [];
  for (const c of needCases) { const s = (await fq('select kafaa_fx_valid_needs($1::jsonb) v', [JSON.stringify(c)]))[0].v; if (s !== validNeeds(c)) nd.push(JSON.stringify(c)); }
  ok(nd.length === 0, `needs validator: SQL kafaa_fx_valid_needs equals validNeeds() on ${needCases.length} valid and malformed inputs${nd.length ? ` (${nd[0]})` : ''}`);

  // kafaa_task_future (as the training manager) equals the TS view built from the seed
  const fresh_uid = '00000000-0000-4000-8000-000000001501';
  await fresh.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [fresh_uid, 'training-mgr@test', 'training-mgr', 'enec-ops', 'employee', ['Training Manager']]);
  await fresh.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: fresh_uid })]);
  await fresh.exec('set role authenticated');
  const view = (await fq('select kafaa_task_future(null) v'))[0].v;
  await fresh.exec('reset role');
  const people = new Map(T.people.map((p) => [p.id, p]));
  const expTasks = live.filter((t) => t.status === 'active').sort((x, y) => cmp(x.role_id, y.role_id) || x.sort - y.sort || cmp(x.id, y.id)).map((t) => {
    const ex = exposureOf({ needs: t.ai_capability_needed, change_horizon: t.change_horizon, critical: t.critical, restricted: false }, levels);
    return { id: t.id, role_id: t.role_id, code: t.code, title_en: t.title_en, title_ar: t.title_ar, critical: t.critical, decision: t.decision, source: t.source, needs: t.ai_capability_needed,
      exposure: t.exposure, augmentable: ex ? ex.augmentable : null, change_horizon: t.change_horizon, tech_driver: t.tech_driver, future_on: t.future_on, reasons: ex ? ex.reasons : [],
      skills: T.jta_task_skills.filter((x) => x.task_id === t.id && x.active).sort((a, b) => a.sort - b.sort || cmp(a.skill_id, b.skill_id)).map((x) => ({ skill_id: x.skill_id, level: x.level, kind: x.kind, source: x.source })) };
  });
  const expAnalysts = [...T.sat_analysts].sort((a, b) => cmp(a.person_id, b.person_id)).map((a) => ({ person_id: a.person_id, name: a.name, name_ar: a.name_ar, active: a.active, designated_on: a.designated_on }));
  const tmPid = 'p-training-mgr';
  const expCand = [...new Set(T.role_assignments.filter((r) => r.role === 'instructor' && r.status === 'active' && r.person_id !== tmPid).map((r) => r.person_id))].sort(cmp)
    .map((pid) => ({ person_id: pid, name: people.get(pid)?.display_name ?? '', name_ar: people.get(pid)?.display_name_ar || people.get(pid)?.display_name || '' }));
  ok(view && canon(view.tasks) === canon(expTasks), `kafaa_task_future returns the same ${expTasks.length} tasks, exposures, reasons and skills as the TS view (no restricted task)`);
  ok(view && canon(view.analysts) === canon(expAnalysts) && canon(view.candidates) === canon(expCand) && view.can_write === true && view.can_designate === true, 'kafaa_task_future: analysts, candidates and rights for the training manager match the TS view');

  // ── RLS and read RPC
  for (const t of ['kafaa_jta_task_skills', 'kafaa_ai_capability_levels', 'kafaa_ai_exposure_refs', 'kafaa_sat_analysts']) {
    const anon = await count(null, t), ro = await count('k-ro', t), ins = await count('k-instructor', t), aud = await count('k-auditor', t);
    ok(anon === 0 && ro === 0 && ins > 0 && aud === ins, `${t}: anon and staff without SAT rights read nothing; instructors and auditors read (${ins} rows)`);
  }
  ok((await one('k-ro', 'select kafaa_task_future(null) v')).v === null && (await one(null, 'select 1 as x').catch(() => ({ x: 1 }))).x === 1, 'kafaa_task_future returns null without SAT rights');
  const vi = (await one('k-instructor', `select kafaa_task_future('security-officer') v`)).v;
  ok(vi && vi.tasks.length === 0 && vi.can_write === false && vi.can_designate === false && vi.candidates.length === 0, 'restricted role: kafaa_task_future returns no task; an instructor is read-only and sees no candidates');
  for (const fn of [`kafaa_fx_exposure('{}'::jsonb, 'now', false, false)`, `kafaa_fx_snapshot('x')`, 'kafaa_fx_can_write()', `kafaa_fx_valid_needs('{}'::jsonb)`]) {
    let refused = false;
    try { await one('training-mgr', `select ${fn}`); } catch { refused = true; }
    ok(refused, `internal helper ${fn.split('(')[0]} is not executable by API roles`);
  }
  let anonRefused = false;
  try { await one(null, `select kafaa_set_task_future('{}'::jsonb)`); } catch { anonRefused = true; }
  ok(anonRefused, 'anon cannot execute kafaa_set_task_future');

  // ── RBAC and the SAT change log
  const audits = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  const changes = async (task) => Number((await q(`select count(*)::int n from kafaa_sat_changes where area = 'future' and task_id = $1`, [task]))[0].n);
  const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const task = 'jt-qs-ro-t4';
  const good = { task_id: task, needs: { language: 3, social: 3, learning_memory: 3 }, change_horizon: '2030', tech_driver: 'ai_assist', skills: [{ skill_id: 'sk-co-02', level: 3 }, { skill_id: 'sk-da-02-review', level: 2, kind: 'future' }] };
  const call = (persona, input) => one(persona, 'select kafaa_set_task_future($1::jsonb) r', [JSON.stringify(input)]).then((x) => x.r);
  let a0 = await audits();
  const f1 = await call('k-instructor', good);
  ok(!f1.ok && f1.code === 'forbidden' && (await audits()) === a0 + 1, 'an instructor who is not a designated SAT analyst cannot set future attributes (forbidden, audited)');
  const f2 = await call('k-auditor', good);
  ok(!f2.ok && f2.code === 'forbidden', 'auditors read but cannot write (forbidden)');
  a0 = await audits();
  const c0 = await changes(task), l0 = await led();
  const f3 = await call('training-mgr', good);
  const row = (await q('select * from kafaa_jta_tasks where id = $1', [task]))[0];
  const ts3 = exposureOf({ needs: good.needs, change_horizon: '2030', critical: row.critical, restricted: false }, levels);
  ok(f3.ok && f3.data.exposure === ts3.exposure && canon(f3.data.reasons) === canon(ts3.reasons) && row.exposure === ts3.exposure && row.change_horizon === '2030' && row.tech_driver === 'ai_assist',
    `the training manager sets the future attributes; the stored exposure (${ts3.exposure}) and reasons equal exposureOf()`);
  ok((await changes(task)) === c0 + 1 && (await audits()) === a0 + 1 && (await led()) === l0, 'the edit writes exactly one SAT change-log row (area future) and one audit row, no ledger row');
  const lg = (await q('select * from kafaa_sat_changes where id = $1', [f3.data.change_id]))[0];
  ok(lg && lg.status === 'closed' && lg.kind === 'modified' && lg.after.exposure === ts3.exposure && Array.isArray(lg.after.skills) && lg.after.skills.includes('sk-da-02-review:2:future') && lg.before.exposure !== undefined,
    'the change-log row is closed at once and carries the before and after future attributes');
  const sk0 = await q(`select skill_id from kafaa_jta_task_skills where task_id = $1 and active order by skill_id`, [task]);
  const fr = await call('training-mgr', { ...good, skills: [{ skill_id: 'sk-co-02', level: 2 }] });
  const sk = await q(`select skill_id, active from kafaa_jta_task_skills where task_id = $1 order by skill_id`, [task]);
  ok(sk0.map((x) => x.skill_id).join() === 'sk-co-02,sk-da-02-review' && fr.ok && sk.filter((x) => x.active).map((x) => x.skill_id).join() === 'sk-co-02'
    && sk.some((x) => x.skill_id === 'sk-da-02-review' && !x.active), 'task-to-skill links are replaced: removed links are deactivated, never deleted');
  // designation: the training manager designates k-instructor, who can then write; withdrawal removes the right
  const l1 = await led();
  const d1 = (await one('training-mgr', `select kafaa_designate_sat_analyst('p-k-instructor', true) r`)).r;
  ok(d1.ok && (await led()) === l1 + 1, 'the training manager designates an instructor as SAT analyst (ledgered)');
  const f4 = await call('k-instructor', { ...good, change_horizon: '2035', note: 'Re-rated after the digital I&C upgrade review' });
  ok(f4.ok && (await changes(task)) === c0 + 3 && (await q(`select summary from kafaa_sat_changes where id = $1`, [f4.data.change_id]))[0].summary.startsWith('Re-rated'), 'a designated SAT analyst sets future attributes; the note becomes the change-log summary');
  const d2 = (await one('k-instructor', `select kafaa_designate_sat_analyst('p-head-sq', true) r`)).r;
  const d3 = (await one('training-mgr', `select kafaa_designate_sat_analyst('p-k-instructor', true) r`)).r;
  const d4 = (await one('training-mgr', `select kafaa_designate_sat_analyst('p-k-ro', true) r`)).r;
  const d5 = (await one('training-mgr', `select kafaa_designate_sat_analyst('p-training-mgr', true) r`)).r;
  const d6 = (await one('training-mgr', `select kafaa_designate_sat_analyst('p-nobody', true) r`)).r;
  ok(d2.code === 'forbidden' && d3.code === 'no_change' && d4.code === 'invalid' && d5.code === 'invalid' && d6.code === 'not_found', 'designation: only the training manager; no-op, non-instructor, self and unknown person refused');
  const d7 = (await one('training-mgr', `select kafaa_designate_sat_analyst('p-k-instructor', false) r`)).r;
  const f5 = await call('k-instructor', good);
  ok(d7.ok && !f5.ok && f5.code === 'forbidden', 'a withdrawn designation removes the right to write');
  // validation and restricted tasks
  const bad = [
    [{ ...good, needs: {} }, 'invalid'], [{ ...good, needs: { consciousness: 2 } }, 'invalid'], [{ ...good, needs: { language: 6 } }, 'invalid'],
    [{ ...good, change_horizon: '2040' }, 'invalid'], [{ ...good, tech_driver: 'quantum' }, 'invalid'], [{ ...good, skills: [] }, 'invalid'],
    [{ ...good, skills: [{ skill_id: 'sk-co-02', level: 5 }] }, 'invalid'], [{ ...good, skills: [{ skill_id: 'sk-co-02', level: 2 }, { skill_id: 'sk-co-02', level: 3 }] }, 'invalid'],
    [{ ...good, skills: [{ skill_id: 'sk-nope', level: 2 }] }, 'not_found'], [{ ...good, skills: [{ skill_id: 'sk-sa-01', level: 2 }] }, 'restricted'],
    [{ ...good, task_id: 'jt-nope' }, 'not_found'], [{ ...good, task_id: 'jt-security-officer-r1' }, 'restricted'], [{ ...good, note: 'x'.repeat(501) }, 'invalid'],
  ];
  const codes = [];
  for (const [inp, code] of bad) { const r = await call('training-mgr', inp); if (r.ok || r.code !== code) codes.push(`${JSON.stringify(inp).slice(0, 80)} -> ${r.code}`); }
  ok(codes.length === 0, `${bad.length} invalid inputs are refused with the same codes as the LocalBackend (restricted task and security skill: restricted)${codes.length ? ` (${codes[0]})` : ''}`);
  await db.exec(`update kafaa_jta_tasks set exposure = 'augment', change_horizon = '2030' where id = 'jt-security-officer-r1'`);
  ok((await q(`select exposure, change_horizon from kafaa_jta_tasks where id = 'jt-security-officer-r1'`))[0].exposure === null, 'the task guard nulls future values written to a restricted task, even by the owner');
  let guard = false;
  try { await db.exec(`insert into kafaa_jta_task_skills (id, task_id, skill_id, level) values ('jts:x', 'jt-security-officer-r1', 'sk-co-02', 2)`); } catch { guard = true; }
  ok(guard, 'the task-skill guard refuses a skill link on a restricted task');
}
