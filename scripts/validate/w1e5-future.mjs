// [W1 · E5 · F09] PGlite checks for 20261009115001_kafaa_w1e5_future.sql: public horizon lanes (sources, as-of dates, no
// headcount or site text), own-only interest and goals, the aggregate-only demand signal (suppressed below 10), and
// kafaa_set_future_goal: RBAC, refusals, audit without ledger, the 12-goal limit and SQL = TS parity of every goal target.
import { readFileSync } from 'node:fs';
import { publicTextIsClean } from '../../src/domain/future.ts';
import { goalTarget } from '../../src/modules/m21/goals.ts';

export default async function w1e5Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;

  // ── public reference data
  const lanes = await as(null, `select * from kafaa_horizon_lanes order by sort`);
  ok(lanes.length === T.horizon_lanes.length && (await count(null, 'kafaa_future_resources')) === T.future_resources.length, `anonymous visitors read the ${lanes.length} horizon lanes and ${T.future_resources.length} learning suggestions`);
  ok(lanes.every((l) => Array.isArray(l.sources) && l.sources.length > 0 && l.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of ?? ''))), 'every horizon lane cites at least one public source with an as-of date');
  const pubRows = [...lanes, ...(await as(null, `select * from kafaa_future_resources`))];
  ok(publicTextIsClean(pubRows), 'public Future Me rows pass publicTextIsClean (no headcount, no site information)');
  ok(T.horizon_lanes.every((l) => ['now', 'next', 'later'].includes(l.horizon)) && new Set(T.horizon_lanes.map((l) => l.horizon)).size === 3, 'lanes cover the now, next and later horizons');

  // ── own rows only
  ok((await count(null, 'kafaa_future_interest')) === 0 && (await count(null, 'kafaa_future_goals')) === 0, 'anonymous visitors read no interest or goals');
  ok((await count('training-mgr', 'kafaa_future_interest', `person_id <> kafaa_me()`)) === 0 && (await count('k-hr-analyst', 'kafaa_future_interest', `person_id <> kafaa_me()`)) === 0 && (await count('chco', 'kafaa_future_goals', `person_id <> kafaa_me()`)) === 0,
    'nobody reads another person\'s interest or goals (not managers, training or HR: they see the aggregate)');
  await as('sro', `insert into kafaa_future_interest (id, person_id, target_kind, tech_id) values ('fi:p-sro:tech-bwr', 'p-sro', 'tech', 'tech-bwr') on conflict do nothing`);
  let foreign = false;
  try { await as('sro', `insert into kafaa_future_interest (id, person_id, target_kind, tech_id) values ('fi:w-ro-01:tech-msr', 'w-ro-01', 'tech', 'tech-msr')`); } catch { foreign = true; }
  const upd = await as('sro', `update kafaa_future_interest set active = false where person_id <> kafaa_me() returning id`);
  const mine = await as('sro', `select id, active from kafaa_future_interest`);
  ok(foreign && upd.length === 0 && mine.length === 1 && mine[0].id === 'fi:p-sro:tech-bwr', 'a person records and reads only their own interest rows');
  const toggled = await as('sro', `update kafaa_future_interest set active = false, updated_at = now() where id = 'fi:p-sro:tech-bwr' returning active`);
  ok(toggled.length === 1 && toggled[0].active === false && (await q(`select count(*)::int n from kafaa_audit_events where entity_table = 'kafaa_future_interest' and entity_id = 'fi:p-sro:tech-bwr'`))[0].n >= 2, 'interest toggles are direct own writes and are audited by the row trigger');
  let directGoal = false;
  try { await as('sro', `insert into kafaa_future_goals (id, person_id, kind, ref_id, title_en, title_ar) values ('x', 'p-sro', 'lane', 'lane-ai', 'x', 'x')`); } catch { directGoal = true; }
  ok(directGoal, 'goals cannot be written directly (RPC only)');

  // ── demand signal: aggregate only, suppressed below the minimum group size
  const dem = await as('k-hr-analyst', `select * from kafaa_future_demand()`);
  const cell = (src, id) => dem.find((r) => r.source === src && r.target_id === id);
  const seedN = (id) => new Set(T.future_interest.filter((i) => i.active && (i.tech_id ?? i.lane_id) === id).map((i) => i.person_id)).size;
  ok(cell('interest', 'tech-bwr')?.n === seedN('tech-bwr') && cell('interest', 'tech-msr')?.suppressed === true && cell('interest', 'tech-msr')?.n === null && cell('interest', 'lane-cyber')?.n === null,
    `HR sees interest counts per technology and lane; cells under 10 are suppressed (tech-bwr ${cell('interest', 'tech-bwr')?.n}, tech-msr suppressed)`);
  ok(dem.every((r) => r.suppressed ? r.n === null : r.n >= 10) && cell('goal', 'lane-digital')?.n === 12 && cell('goal', 'lane-ai')?.suppressed === true, 'goal demand follows the same suppression rule');
  ok((await as('training-mgr', `select count(*)::int n from kafaa_future_demand()`))[0].n === dem.length, 'the training manager (F26 needs analysis) also reads the aggregate');
  let mgrDenied = false, anonDenied = false;
  try { await as('sro', `select * from kafaa_future_demand()`); } catch { mgrDenied = true; }
  try { await as(null, `select * from kafaa_future_demand()`); } catch { anonDenied = true; }
  ok(mgrDenied && anonDenied, 'people without an aggregate grant and anonymous callers cannot read the demand signal');

  // ── setFutureGoal
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const add = (await one('sro', `select kafaa_set_future_goal('lane', 'lane-digital', true) r`)).r;
  const row = (await q(`select * from kafaa_future_goals where id = 'fg:p-sro:lane:lane-digital'`))[0];
  const aud = (await q(`select outcome, ledger_status, actor_role from kafaa_audit_events where action = 'future.goal' order by seq desc limit 1`))[0];
  const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  ok(add.ok && row?.status === 'active' && row.skill_ids.length > 0 && !row.skill_ids.includes('sk-sa-01') && aud.outcome === 'ok' && aud.ledger_status === 'not_applicable' && led1 === led0, 'adding a goal stores a coach target (no security skills), audited without a ledger write');
  const rem = (await one('sro', `select kafaa_set_future_goal('lane', 'lane-digital', false) r`)).r;
  const rem2 = (await one('sro', `select kafaa_set_future_goal('lane', 'lane-digital', false) r`)).r;
  const bad = (await one('sro', `select kafaa_set_future_goal('salary', 'x', true) r`)).r;
  const nf = (await one('sro', `select kafaa_set_future_goal('adv_skill', 'as-nope', true) r`)).r;
  const obs = (await one('k-observer', `select kafaa_set_future_goal('lane', 'lane-ai', true) r`)).r;
  const partner = (await one('gulfhydro-qa', `select kafaa_set_future_goal('lane', 'lane-ai', true) r`)).r;
  ok(rem.ok && rem.data.status === 'removed' && rem2.code === 'not_found' && bad.code === 'invalid' && nf.code === 'not_found' && obs.code === 'forbidden' && partner.code === 'forbidden', 'goal refusals: removed twice, unknown kind, unknown target, non-staff and partners');
  let anonGoal = false;
  try { await as(null, `select kafaa_set_future_goal('lane', 'lane-ai', true)`); } catch { anonGoal = true; }
  ok(anonGoal, 'anonymous callers cannot execute kafaa_set_future_goal');

  // parity: every target gives the same coach target in SQL as goalTarget() in TypeScript
  const data = { advSkills: T.adv_skills, skills: T.skills, bridges: T.skill_bridges, roles: T.future_roles, lanes: T.horizon_lanes, jobRoles: T.job_roles, techs: T.adv_technologies };
  const targets = [...T.adv_skills.map((x) => ['adv_skill', x.id]), ...T.skill_bridges.map((x) => ['bridge', x.id]), ...T.horizon_lanes.map((x) => ['lane', x.id]), ...T.future_roles.map((x) => ['future_role', x.id])];
  const diffs = [];
  for (const [kind, ref] of targets) {
    const r = (await one('k-instructor', `select kafaa_set_future_goal($1, $2, true) r`, [kind, ref])).r;
    const g = (await q(`select tech_id, lane_id, skill_ids, adv_skill_ids, title_en, title_ar from kafaa_future_goals where id = $1`, [r.data?.id]))[0];
    const ts = goalTarget(kind, ref, data);
    if (!r.ok || !g || JSON.stringify([g.tech_id, g.lane_id, g.skill_ids, g.adv_skill_ids, g.title_en, g.title_ar]) !== JSON.stringify([ts.tech_id, ts.lane_id, ts.skill_ids, ts.adv_skill_ids, ts.title_en, ts.title_ar])) diffs.push(`${kind}:${ref}`);
    await one('k-instructor', `select kafaa_set_future_goal($1, $2, false) r`, [kind, ref]);
  }
  ok(diffs.length === 0, `SQL goal targets equal goalTarget() for all ${targets.length} targets${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
  for (const [kind, ref] of targets.slice(0, 12)) await one('k-instructor', `select kafaa_set_future_goal($1, $2, true) r`, [kind, ref]);
  const over = (await one('k-instructor', `select kafaa_set_future_goal('lane', 'lane-netzero', true) r`)).r;
  const again = (await one('k-instructor', `select kafaa_set_future_goal($1, $2, true) r`, targets[0])).r;
  ok(over.code === 'limit' && again.ok, 'at most 12 active goals; re-adding an active goal is allowed');
}
