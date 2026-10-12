// [FS wave I · E5 · FS84] PGlite checks for 20261010295001_kafaa_fs95_team_targets_inventory.sql (Skills Passport, M17).
// Seed (24 F11 targets stay 'current'; 35 adopted 2028/2030 targets reproduce futureTargets() on the profiles of their adoption date);
// SQL = TS parity on the database state (kafaa_tt_pct, kafaa_tt_l2028, kafaa_tt_reqs for every version, kafaa_tt_need for every role and
// horizon, kafaa_tt_derive for every team and family x both horizons x people / aggregate, kafaa_tt_inventory and kafaa_tt_quality for
// both dimensions and two dates), also after generated edits inside a rolled-back transaction; acceptance (cells under 10 suppressed,
// data quality TS = SQL, every target names the 2030 profile version it came from); the F11 coverage unchanged by adopted targets; the
// three RPCs (scope, refusals, audit, no ledger, rows switched off and never removed); grants; the migration is additive. Prints the md5
// of every new or redefined function body and the digest of the changed table.
import { readFileSync } from 'node:fs';
import {
  FT_HORIZONS, TT_MIN, dataQuality, futureTargetId, futureTargets, level2028, orgInventory, pctOf, publishedVersion, reqsOf, roleNeed, ttCtx,
} from '../../src/modules/m17/teamTargets.ts';
import { groupsOf } from '../../src/modules/m17/checkins.ts';
import { ADOPTIONS, versionsAsOf } from '../seed/ext/fs84-team-targets.mjs';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const FUNCS = ['kafaa_tt_pct', 'kafaa_tt_l2028', 'kafaa_tt_is_restricted', 'kafaa_tt_core', 'kafaa_tt_version', 'kafaa_tt_reqs', 'kafaa_tt_need', 'kafaa_tt_derive', 'kafaa_tt_inventory',
  'kafaa_tt_qblock', 'kafaa_tt_quality', 'kafaa_team_future_targets', 'kafaa_adopt_future_targets', 'kafaa_org_skill_inventory', 'kafaa_team_coverage'];
const RPCS = ['kafaa_adopt_future_targets', 'kafaa_org_skill_inventory', 'kafaa_team_future_targets'];
const MIG = 'supabase/migrations/20261010295001_kafaa_fs95_team_targets_inventory.sql';
const obj = (m) => Object.fromEntries([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
const needJson = (r) => ({ status: r.status, v2030: r.v2030, vnow: r.vnow, needs: obj(r.needs), now: obj(r.now) });

export default async function fs95Checks({ db, as, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave I · E5 · FS84 team 2030 capability targets + organisation skills inventory (M17)');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const iso = (k, v) => (/_at$/.test(k) ? v.toISOString().replace(/\.\d{3}Z$/, 'Z') : v.toISOString().slice(0, 10));
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? iso(k, v) : typeof v === 'string' && /^-?\d+\.\d+$/.test(v) ? Number(v) : v]));
  const rows = async (t) => (await q(`select * from kafaa_${t} order by id`)).map(fix);
  const world = async () => {
    const W = {}; for (const t of ['people', 'skills', 'competencies', 'role_profile_versions', 'person_skills', 'team_skill_targets', 'job_roles']) W[t] = await rows(t);
    W.ctx = ttCtx(W); W.staff = W.people.filter((p) => p.kind === 'staff' && p.status === 'active'); return W;
  };
  const today = (await q(`select to_char(current_date, 'YYYY-MM-DD') d`))[0].d;
  const audits = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  const ledgers = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  let n = 9500;
  for (const persona of ['nse', 'ops-ceo', 'rp-lead']) {
    if (uid[persona]) continue;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,'enec-ops','employee',$4) on conflict do nothing`, [uid[persona], `${persona}@test`, persona, [persona]]);
  }
  const inG = (p, key) => key === `team:${p.team_id}` || key === `family:${p.job_family_id}`;

  // ── seed
  const W0 = await world();
  const fut = W0.team_skill_targets.filter((t) => t.horizon !== 'current');
  const cur = W0.team_skill_targets.filter((t) => t.horizon === 'current');
  ok(W0.team_skill_targets.length === S.team_skill_targets.length && cur.length === 24 && cur.every((t) => !t.profile_version_ids.length && !t.id.match(/^tst:20\d\d:/))
    && fut.length === S.team_skill_targets.length - 24 && fut.every((t) => t.id === futureTargetId(t.horizon, t.team_id, t.skill_id) && t.profile_version_ids.length && t.active),
    `seed: ${W0.team_skill_targets.length} team targets: the 24 F11 targets stay 'current' (no profile versions), ${fut.length} adopted 2028/2030 targets with their profile versions`);
  const repro = ADOPTIONS.map((a) => {
    const ctx = ttCtx({ ...W0, role_profile_versions: versionsAsOf(W0.role_profile_versions, a.asOf) });
    const ft = futureTargets({ ctx, horizon: a.horizon, group: a.group, members: W0.staff.filter((p) => inG(p, a.group)), states: [], stored: [], people: true });
    const got = fut.filter((t) => t.team_id === a.group && t.horizon === a.horizon);
    return got.length === ft.targets.length && ft.targets.every((t) => { const g = got.find((x) => x.skill_id === t.skill_id); return g && g.min_people === t.min_people && g.min_level === t.min_level && same([...g.profile_version_ids].sort(), t.versions) && g.set_by === a.by; });
  });
  ok(repro.every(Boolean), `seed: every adopted set reproduces futureTargets() on the FS05 profiles published on its adoption date (${ADOPTIONS.map((a) => `${a.group} ${a.horizon}`).join(', ')})`);

  // ── SQL = TS
  const pctCases = [[0, 0], [1, 8], [1, 3], [2, 3], [5, 10], [7, 40], [106, 106], [57, 2356], [1, 200], [3, 7]];
  const pSql = (await q('select kafaa_tt_pct(x[1], x[2]) r from (select array[a, b] x from unnest($1::int[], $2::int[]) u(a, b)) z', [pctCases.map((c) => c[0]), pctCases.map((c) => c[1])])).map((r) => r.r);
  const lCases = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 4], [2, 3], [3, 3], [3, 2], [4, 1]];
  const lSql = (await q('select kafaa_tt_l2028(a, b) r from unnest($1::int[], $2::int[]) u(a, b)', [lCases.map((c) => c[0]), lCases.map((c) => c[1])])).map((r) => r.r);
  ok(same(pSql, pctCases.map(([a, b]) => pctOf(a, b))) && same(lSql, lCases.map(([a, b]) => level2028(a, b))),
    `SQL kafaa_tt_pct / kafaa_tt_l2028 = pctOf / level2028 (${pctCases.length} + ${lCases.length} cases: round half up, half-way rounded up, lower 2030 levels kept)`);
  const parity = async (label, edits = false) => {
    const W = await world();
    const vSql = await q('select v.id, kafaa_tt_reqs(v.id) j from kafaa_role_profile_versions v order by v.id');
    const vDiff = vSql.filter((r) => !same(r.j, obj(reqsOf(W.role_profile_versions.find((v) => v.id === r.id), W.ctx)))).map((r) => r.id);
    const roles = [...W.job_roles.map((r) => r.id), null, 'no-such-role'];
    const nDiff = [];
    for (const h of FT_HORIZONS) {
      const ns = await q('select r, kafaa_tt_need(r, $2) j from unnest($1::text[]) r', [roles, h]);
      for (const x of ns) if (!same(x.j, needJson(roleNeed(x.r, h, W.ctx)))) nDiff.push(`${x.r}/${h}`);
      for (const r of W.job_roles) if ((await q('select kafaa_tt_version($1, $2) v', [r.id, h === '2028' ? 'now' : h]))[0].v !== (publishedVersion(W.role_profile_versions, r.id, h === '2028' ? 'now' : h)?.id ?? null)) nDiff.push(`version ${r.id}`);
    }
    const groups = groupsOf(W.staff);
    const dDiff = [];
    let cases = 0;
    for (const g of groups) for (const h of FT_HORIZONS) for (const people of [true, false]) {
      const mem = W.staff.filter((p) => inG(p, g.key));
      const sql = (await q('select kafaa_tt_derive($1, $2, $3, $4) j', [mem.map((p) => p.id), h, g.key, people]))[0].j;
      const ts = futureTargets({ ctx: W.ctx, horizon: h, group: g.key, members: mem, states: W.person_skills, stored: W.team_skill_targets, people });
      cases++;
      if (!same(sql, ts)) dDiff.push(`${g.key}/${h}/${people}`);
    }
    const emptySql = (await q(`select kafaa_tt_derive('{}', '2030', null, true) j`))[0].j;
    if (!same(emptySql, futureTargets({ ctx: W.ctx, horizon: '2030', group: null, members: [], states: [], stored: [], people: true }))) dDiff.push('empty');
    const iDiff = [];
    for (const dim of ['entity', 'family']) for (const d of [today, '2027-06-30']) {
      const w = { ctx: W.ctx, skills: W.skills, people: W.people, states: W.person_skills, dim, today: d };
      if (!same((await q('select kafaa_tt_inventory($1, $2::date) j', [dim, d]))[0].j, orgInventory(w))) iDiff.push(`inventory ${dim} ${d}`);
      if (!same((await q('select kafaa_tt_quality($1, $2::date) j', [dim, d]))[0].j, dataQuality(w))) iDiff.push(`quality ${dim} ${d}`);
    }
    ok(!vDiff.length && !nDiff.length && !dDiff.length && !iDiff.length,
      `SQL kafaa_tt_reqs (${vSql.length} versions), kafaa_tt_need / kafaa_tt_version (${roles.length} roles x 2 horizons), kafaa_tt_derive (${cases} group x horizon x mode cases), kafaa_tt_inventory and kafaa_tt_quality (2 dimensions x 2 dates) = the TS rules (${label})`
      + `${vDiff.length ? ` reqs diff ${vDiff[0]}` : ''}${nDiff.length ? ` need diff ${nDiff[0]}` : ''}${dDiff.length ? ` derive diff ${dDiff[0]}` : ''}${iDiff.length ? ` ${iDiff[0]}` : ''}`);
    void edits;
    return W;
  };
  const W1 = await parity('seed');

  // ── acceptance
  const invs = ['entity', 'family'].map((dim) => orgInventory({ ctx: W1.ctx, skills: W1.skills, people: W1.people, states: W1.person_skills, dim, today }));
  const cells = invs.flatMap((iv) => [...iv.areas, ...iv.skills].flatMap((r) => [r.total, ...r.cells]));
  const smallG = invs.flatMap((iv) => iv.groups.filter((g) => g.staff === null).map((g) => [iv, g.id]));
  ok(cells.every((c) => c.n === null || c.n >= TT_MIN) && cells.some((c) => c.n === null) && cells.some((c) => c.n !== null) && cells.every((c) => (c.n === null) === (c.pct === null))
    && smallG.length > 0 && smallG.every(([iv, g]) => [...iv.areas, ...iv.skills].every((r) => r.cells.find((x) => x.g === g).n === null))
    && invs[1].groups.every((g) => !['security', 'safeguards', 'cyber'].includes(g.id)) && invs[0].skills.length === W1.skills.filter((s) => !W1.ctx.restricted.has(s.id)).length,
    `acceptance FS84: cells under 10 are suppressed (${cells.filter((c) => c.n === null).length} of ${cells.length} inventory cells null, the rest 10 or more; groups under 10 staff fully suppressed; security, safeguards and cyber families never broken out; all ${invs[0].skills.length} non-security skills listed)`);
  const smallAgg = groupsOf(W1.staff).filter((g) => g.size < TT_MIN).map((g) => futureTargets({ ctx: W1.ctx, horizon: '2030', group: g.key, members: W1.staff.filter((p) => inG(p, g.key)), states: W1.person_skills, stored: W1.team_skill_targets, people: false }));
  ok(smallAgg.length > 0 && smallAgg.every((ft) => ft.suppressed && ft.summary.readiness === null && ft.targets.every((t) => t.n === null && t.min_people === null && t.status === 'suppressed' && t.roles.every((r) => r.people === null) && !t.holders) && !ft.members.length),
    `acceptance FS84: HR aggregates of a team under 10 are suppressed (${smallAgg.length} groups: no counts, no holders, no members)`);
  const dq = dataQuality({ ctx: W1.ctx, skills: W1.skills, people: W1.people, states: W1.person_skills, dim: 'entity', today });
  const sqlDq = (await one('chco', `select kafaa_org_skill_inventory('entity') r`)).r.quality;
  ok(same(sqlDq, dq) && dq.staff >= 100 && dq.profiled_pct !== null && dq.req_pct !== null && dq.stale !== null && dq.validated_pct !== null && dq.overdue_skills >= 1
    && dq.by_group.some((g) => g.staff === null) && dq.by_group.some((g) => g.staff !== null),
    `acceptance FS84: data-quality figures reproduce from rules (TS = SQL through the RPC): profile coverage ${dq.profiled_pct} %, role requirements recorded ${dq.req_pct} %, stale ${dq.stale_pct} % (FS03 ageing ${dq.ageing}, FS54 review overdue ${dq.review_overdue}), validated ${dq.validated_pct} %`);
  const pub30 = new Map(W1.role_profile_versions.filter((v) => v.horizon === '2030' && v.status === 'published').map((v) => [v.id, v]));
  const allTs = groupsOf(W1.staff).flatMap((g) => FT_HORIZONS.map((h) => futureTargets({ ctx: W1.ctx, horizon: h, group: g.key, members: W1.staff.filter((p) => inG(p, g.key)), states: W1.person_skills, stored: W1.team_skill_targets, people: true })));
  const tAll = allTs.flatMap((ft) => ft.targets);
  ok(tAll.length > 50 && tAll.every((t) => t.roles.length && t.roles.every((r) => pub30.get(r.version_id)?.role_id === r.role_id && pub30.get(r.version_id).version === r.version && t.versions.includes(r.version_id)))
    && fut.every((t) => t.profile_version_ids.some((v) => /-2030-v\d+$/.test(v))),
    `acceptance FS84: each team target shows the 2030 role-profile version it came from (${tAll.length} derived targets; every adopted row stores its versions)`);
  const crewB = allTs.find((ft) => ft.group === 'team:ops-crew-b' && ft.horizon === '2030');
  const opsF = allTs.find((ft) => ft.group === 'family:operations' && ft.horizon === '2028');
  ok(crewB.targets.some((t) => t.adopted && t.changed && t.versions.includes('rpv-reactor-operator-2030-v2') && !t.adopted.versions.includes('rpv-reactor-operator-2030-v2'))
    && crewB.targets.some((t) => !t.adopted) && opsF.targets.every((t) => t.adopted && !t.changed) && !opsF.retired.length,
    `seeded story: crew B's 2030 targets (adopted 2026-09-01) no longer match after the reactor-operator 2030 profile v2 (${crewB.targets.filter((t) => t.changed).length} changed, ${crewB.targets.filter((t) => !t.adopted).length} new); the operations family's 2028 targets are up to date`);

  // ── F11 coverage keeps to current targets
  const covB = (await one('sro', `select kafaa_team_coverage('team:ops-crew-b') r`)).r;
  const covO = (await one('training-mgr', `select kafaa_team_coverage('family:operations') r`)).r;
  ok(covB.targets.length === cur.filter((t) => t.team_id === 'team:ops-crew-b').length && covO.targets.length === cur.filter((t) => t.team_id === 'family:operations').length
    && covB.coverage.every((c) => { const x = cur.find((t) => t.team_id === 'team:ops-crew-b' && t.skill_id === c.skill_id); return c.target_set === !!x && (!x || c.min_people === x.min_people); }),
    'F11 unchanged: kafaa_team_coverage reads current targets only (adopted 2028/2030 targets never change coverage, targets or the crew profile)');

  // ── RPCs: reads
  const rB = (await one('sro', `select kafaa_team_future_targets(null, '2030') r`)).r;
  const mB = W1.staff.filter((p) => inG(p, rB.group));
  const tsB = futureTargets({ ctx: W1.ctx, horizon: '2030', group: rB.group, members: mB, states: W1.person_skills, stored: W1.team_skill_targets, people: true });
  const rAgg = (await one('chco', `select kafaa_team_future_targets('family:operations', '2028') r`)).r;
  const tsAgg = futureTargets({ ctx: W1.ctx, horizon: '2028', group: 'family:operations', members: W1.staff.filter((p) => inG(p, 'family:operations')), states: W1.person_skills, stored: W1.team_skill_targets, people: false });
  const rBad = (await one('sro', `select kafaa_team_future_targets('team:ops-crew-b', 'x') r`)).r;
  let audRefused = false; try { await one('k-auditor', `select kafaa_team_future_targets(null, '2030') r`); } catch { audRefused = true; }
  let anonRefused = false; try { await as(null, `select kafaa_team_future_targets(null, '2030')`); } catch { anonRefused = true; }
  const { mode: m1, groups: g1, people: pp1, ...coreB } = rB;
  const { mode: m2, groups: g2, people: pp2, ...coreAgg } = rAgg;
  ok(m1 === 'people' && rB.group === 'team:ops-crew-b' && g1.some((g) => g.key === rB.group) && same(coreB, tsB)
    && pp1.length === mB.length && m2 === 'aggregate' && same(coreAgg, tsAgg) && !pp2.length && !coreAgg.members.length && coreAgg.targets.every((t) => !t.holders)
    && rBad.horizon === '2030' && audRefused && anonRefused && g2.length > g1.length,
    `kafaa_team_future_targets: the crew B shift manager reads named targets for ${rB.group} (= futureTargets, people mode); the HR director reads counts only (aggregate); an unknown horizon reads 2030; auditors (no skills_profile) and anonymous visitors are refused`);
  const inv = {}; for (const p of ['chco', 'k-hr-analyst', 'training-mgr']) inv[p] = (await one(p, `select kafaa_org_skill_inventory('entity') r`)).r;
  const invNo = []; for (const p of ['sro', 'k-auditor', 'k-observer', 'nse', 'k-admin', 'alnoor-gm']) invNo.push((await one(p, `select kafaa_org_skill_inventory('entity') r`)).r);
  const invF = (await one('chco', `select kafaa_org_skill_inventory('bogus') r`)).r;
  let anonInv = false; try { await as(null, `select kafaa_org_skill_inventory('entity')`); } catch { anonInv = true; }
  const a0 = await audits();
  await one('chco', `select kafaa_org_skill_inventory('family') r`);
  ok(Object.values(inv).every((r) => r && same(r.inventory, invs[0])) && invNo.every((r) => r === null) && invF.inventory.dim === 'entity' && anonInv && (await audits()) === a0
    && !JSON.stringify(inv.chco).includes('"p-') && !JSON.stringify(inv.chco).includes('"w-'),
    'kafaa_org_skill_inventory: HR analyst, HR director (Agg) and the training manager (A) read the inventory; line managers, auditors, observers, employees, platform admins and partners get null; anonymous cannot execute; reads are not audited and carry no person ids');

  // ── RPCs: adopt (rolled back)
  await db.exec('begin');
  try {
    const A = await audits(); const L = await ledgers();
    const adopt = (p, x) => one(p, 'select kafaa_adopt_future_targets($1::jsonb) r', [JSON.stringify(x)]);
    const r1 = (await adopt('nse', { team_id: 'team:ops-crew-b', horizon: '2030' })).r;
    const r2 = (await adopt('sro', { team_id: 'team:rp', horizon: '2030' })).r;
    const r3 = (await adopt('sro', { team_id: 'crew:profile', horizon: '2030' })).r;
    const r4 = (await adopt('sro', { team_id: 'team:ops-crew-b', horizon: '2035' })).r;
    const r5 = (await adopt('sro', { team_id: 'team:nobody', horizon: '2030' })).r;
    const r6 = (await adopt('chco', { team_id: 'team:ops-crew-b', horizon: '2030' })).r;
    const before = (await one('sro', `select kafaa_team_future_targets('team:ops-crew-b', '2030') r`)).r;
    const want = before.targets.filter((t) => !t.adopted || t.changed).length;
    const r7 = (await adopt('sro', { team_id: 'team:ops-crew-b', horizon: '2030', note: '  Re-adopted after the v2 profiles.  ' })).r;
    const r8 = (await adopt('sro', { team_id: 'team:ops-crew-b', horizon: '2030' })).r;
    const after = (await one('sro', `select kafaa_team_future_targets('team:ops-crew-b', '2030') r`)).r;
    const rowB = (await q(`select * from kafaa_team_skill_targets where team_id = 'team:ops-crew-b' and horizon = '2030' order by id`)).map(fix);
    const r9 = (await adopt('training-mgr', { team_id: 'team:eng', horizon: '2028' })).r;
    const r10 = (await adopt('rp-lead', { team_id: 'team:rp', horizon: '2030' })).r;
    ok(!r1.ok && r1.code === 'forbidden' && !r2.ok && r2.code === 'forbidden' && !r3.ok && r3.code === 'invalid' && !r4.ok && r4.code === 'invalid' && !r5.ok && r5.code === 'not_found'
      && !r6.ok && r6.code === 'forbidden' && r7.ok && r7.data.written === want && want > 0 && r7.data.kept === before.targets.length - want && !r8.ok && r8.code === 'unchanged'
      && after.targets.every((t) => t.adopted && !t.changed) && rowB.every((t) => t.set_by === 'p-sro' || !t.active) && rowB.filter((t) => t.active && t.note === 'Re-adopted after the v2 profiles.').length === want
      && r9.ok && r9.data.written > 0 && !r10.ok && r10.code === 'unchanged'
      && (await audits()) === A + 10 && (await ledgers()) === L,
      `acceptance (kafaa_adopt_future_targets): employees, managers outside the group and HR (Agg) refused; crew:profile and unknown horizons invalid; the shift manager re-adopts crew B's 2030 targets (${want} rows written, the rest kept), a second call is unchanged; the training manager adopts the engineering 2028 targets; every call audited, no ledger`);
    // a profile drops a requirement: the stored target is switched off (kept, inactive), never removed
    const drop = after.targets.find((t) => t.roles.length === 1 && t.roles[0].role_id === 'shift-supervisor');
    if (drop) {
      const vid = drop.roles[0].version_id;
      await db.exec(`select set_config('kafaa.seeding', 'on', true);
        update kafaa_role_profile_versions set requirements = (select coalesce(jsonb_agg(r), '[]'::jsonb) from jsonb_array_elements(requirements) r
          where not (coalesce(kafaa_tt_core(r ->> 'ref_id'), r ->> 'ref_id') = '${drop.skill_id}')) where id = '${vid}';`);
      const nBefore = (await q(`select count(*)::int n from kafaa_team_skill_targets`))[0].n;
      const r11 = (await adopt('sro', { team_id: 'team:ops-crew-b', horizon: '2030' })).r;
      const gone = (await q(`select active from kafaa_team_skill_targets where id = $1`, [futureTargetId('2030', 'team:ops-crew-b', drop.skill_id)]))[0];
      ok(r11.ok && r11.data.retired === 1 && gone && gone.active === false && (await q(`select count(*)::int n from kafaa_team_skill_targets`))[0].n === nBefore,
        `a target that no longer derives (${drop.skill_id} left the shift-supervisor 2030 profile) is switched off on the next adoption, never removed`);
    } else ok(false, 'a single-role target exists for the retire check');
  } finally { await db.exec('rollback'); }

  // ── generated edits (rolled back)
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true);
      update kafaa_role_profile_versions set status = 'superseded' where id = 'rpv-systems-design-plant-engineer-2030-v1';
      update kafaa_role_profile_versions set status = 'published', is_public = true where id = 'rpv-systems-design-plant-engineer-2030-v2';
      update kafaa_role_profile_versions set requirements = requirements || '[{"kind":"skill","ref_id":"sk-da-01","level":2.5,"importance":"core"},{"kind":"skill","ref_id":"sk-da-02","level":"3","importance":"core"},{"kind":"competency","ref_id":"sec-01","level":2,"importance":"core"},{"kind":"skill","ref_id":"sk-nope","level":2,"importance":"core"}]'::jsonb
        where id = 'rpv-local-operator-2030-v1';
      update kafaa_role_profile_versions set path_only = true where id in (select id from kafaa_role_profile_versions where role_id = 'chemistry-technician' and horizon = '2030' and status = 'published');
      update kafaa_people set job_role_id = null where id in (select id from kafaa_people where kind = 'staff' and status = 'active' and team_id = 'ops-crew-c' order by id limit 2);
      update kafaa_person_skills set basis = 'claimed' where id in (select id from kafaa_person_skills where active and basis = 'evidenced' order by id limit 120);
      update kafaa_person_skills set level = 4 where id in (select id from kafaa_person_skills where active and level = 2 order by id desc limit 60);
      update kafaa_person_skills set active = false where id in (select id from kafaa_person_skills where active and level = 3 order by id limit 40);
      update kafaa_person_skills set reasons = '[{"ageing": true}]'::jsonb where id in (select id from kafaa_person_skills where active order by id desc limit 30);
      update kafaa_skills set review_due = date '2026-01-01' where id in (select id from kafaa_skills where area = 'digital' order by id limit 4);
      update kafaa_people set entity_id = 'enec-con' where id in (select id from kafaa_people where kind = 'staff' and status = 'active' and entity_id = 'enec' order by id limit 9);
      update kafaa_team_skill_targets set active = false where id in (select id from kafaa_team_skill_targets where horizon = '2028' order by id limit 2);`);
    await parity('generated edits: a republished 2030 profile, odd requirement levels, a security and an unknown requirement, a path-only profile, people without a role, claimed and inactive states, ageing evidence, overdue reviews, a group crossing 10, switched-off adopted targets', true);
  } finally { await db.exec('rollback'); }

  // ── grants
  const grants = await q(`select routine_name, grantee from information_schema.routine_privileges where routine_name = any($1) and grantee in ('anon', 'authenticated') order by 1, 2`, [FUNCS]);
  let internal = 0;
  for (const f of [`kafaa_tt_derive('{}', '2030', null, true)`, `kafaa_tt_inventory('entity', current_date)`, `kafaa_tt_quality('entity', current_date)`, `kafaa_tt_need('reactor-operator', '2030')`, `kafaa_tt_reqs('x')`, `kafaa_tt_pct(1, 2)`]) {
    try { await as('chco', `select ${f}`); } catch { internal++; }
  }
  ok(internal === 6 && same(grants.map((g) => `${g.routine_name}:${g.grantee}`), [...RPCS, 'kafaa_team_coverage'].sort().map((r) => `${r}:authenticated`)),
    `internal rules are not executable by API roles; authenticated executes only the three FS84 RPCs and the redefined kafaa_team_coverage, anon none (${grants.map((g) => g.routine_name).join(', ')})`);

  // ── additive migration
  const sql = readFileSync(MIG, 'utf8');
  const created = [...sql.matchAll(/create (?:table if not exists|or replace function|(?:unique )?index if not exists|trigger) (\w+)/g)].map((m) => m[1]);
  const altered = [...sql.matchAll(/alter (?:table|policy \w+ on) (\w+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && created.every((x) => x.startsWith('kafaa_')) && altered.every((x) => x === 'kafaa_team_skill_targets') && !/\binsert into (?!kafaa_)|\bupdate (?!kafaa_)\w+ set\b/i.test(sql)
    && (await q(`select column_name, column_default from information_schema.columns where table_name = 'kafaa_team_skill_targets' and column_name in ('horizon', 'profile_version_ids') order by 1`)).length === 2,
    `the migration is additive: ${created.length} kafaa_* objects created or redefined, ALTER only on kafaa_team_skill_targets (two columns with defaults), no removal words, writes only kafaa_* rows (inside the RPC)`);

  // ── digests for the live comparison
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  console.log(`    fs95 function md5: ${md5.map((r) => `${r.proname}=${r.m}`).join(' ')}`);
  for (const w of ['true', `horizon = 'current'`, `horizon <> 'current'`]) {
    const d = (await q(`select count(*)::int n, left(md5(coalesce(string_agg(t.id, '|' order by t.id), '')), 8) ids, left(md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')), 8) rws from kafaa_team_skill_targets t where ${w}`))[0];
    console.log(`    fs95 digest kafaa_team_skill_targets (${w}): ${d.n} rows, ids ${d.ids}, rows ${d.rws}`);
  }
}
