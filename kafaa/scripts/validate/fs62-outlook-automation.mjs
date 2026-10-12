// [FS wave F · E2 · FS52 + FS53] PGlite checks for 20261010262001_kafaa_fs62_outlook_automation.sql (M07).
// FS52: the stored outlooks are reproduced byte for byte with automation adoption 0 (TS) and equal in SQL; the F35 stress test still reads
// every visible family short; SQL = TS for the task-exposure aggregate (kafaa_so_auto_base = gatherAutomation) and for 52 deterministic
// assumption sets (normalisation, whole outlooks incl. the automation driver and tornado bar, and the automation profile); the automation
// assumption appears in the tornado with its range; parameter guard; suppression; RBAC of kafaa_outlook_automation.
// FS53: every benchmark value is an exact copy of a sourced FS01 figure, drawn only when primary in the research packs; SQL kafaa_bv_problems
// = TS benchmarkValueProblems on every row and on generated mutants; the guard trigger refuses drift; RLS (workforce dashboards only); no
// SQL function mixes market values with outlook numbers. Grants, additivity, and the function md5s / table digest for the live comparison.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIG = 'supabase/migrations/20261010262001_kafaa_fs62_outlook_automation.sql';
const FNS = ['kafaa_bv_guard', 'kafaa_bv_problems', 'kafaa_outlook_automation', 'kafaa_so_auto_base', 'kafaa_so_auto_for', 'kafaa_so_auto_profile', 'kafaa_so_auto_share',
  'kafaa_so_compute', 'kafaa_so_for', 'kafaa_so_normalize', 'kafaa_so_project'];
const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

export default async function fs62Checks({ db, as, one, count, ok, uid }) {
  const O = await import('../../src/modules/m07/outlook.ts');
  const { benchmarkValueProblems, marketValues, heldValues, sumMeasured, measuresFrom } = await import('../../src/modules/m07/market.ts');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave F · E2 · FS52 automation exposure in the skills outlook + FS53 external benchmark lines');
  const inp = O.inputFromTables((t) => T[t] ?? []);
  const fams = O.outlookFamilies(inp);
  // a line manager persona without HR roles (same id as the w5e4 checks use)
  if (!uid['k-ro']) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', ['k-ro'])).rows[0];
    uid['k-ro'] = row?.user_id ?? '00000000-0000-4000-8000-000000001541';
    if (!row) await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid['k-ro'], 'k-ro@test', 'k-ro', 'enec-ops', 'employee', ['Reactor Operator']]);
  }

  // ── FS52 seed acceptance (TS, byte for byte)
  const so = T.skill_outlooks ?? [];
  const byteBad = so.filter((o) => [o.params, { ...o.params, automation_adoption: 0 }].some((p) => { const r = O.outlookFor(inp, p); return r.code !== 'ok' || JSON.stringify(r.result) !== JSON.stringify(o.results); }));
  ok(so.length === 5 && byteBad.length === 0, `acceptance (FS52): with adoption 0 the outlook equals today's ${so.length} stored outlooks byte for byte (TS)${byteBad.length ? ` (differ: ${byteBad.map((o) => o.id)})` : ''}`);
  ok(so.every((o) => !('automation_adoption' in o.params) && !('automation' in o.results) && o.results.tornado.every((b) => b.param !== O.AUTO_PARAM)), 'stored outlooks carry no automation key, field or tornado bar');
  const stress = so.find((o) => o.id === 'so-attrition-stress');
  ok(stress && stress.results.totals.visible === 10 && stress.results.totals.families_short === 10, `F35 stress test still reads ${stress?.results.totals.families_short} of ${stress?.results.totals.visible} visible families short`);

  // ── parity on a pristine database (earlier validators change skill states and tasks)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q1 = async (sql, params = []) => (await fresh.query(sql, params)).rows[0];
  try {
    let bad = [];
    for (const o of so) for (const p of [o.params, { ...o.params, automation_adoption: 0 }]) {
      const r = (await q1('select kafaa_so_for($1::jsonb) r', [JSON.stringify(p)])).r;
      if (r.code !== 'ok' || norm(r.result) !== norm(o.results)) bad.push(o.id);
    }
    ok(bad.length === 0, `acceptance (FS52): SQL kafaa_so_for with adoption 0 (key absent or 0) equals all ${so.length} stored outlooks${bad.length ? ` (${bad})` : ''}`);
    const ab = (await q1('select kafaa_so_auto_base() b')).b, at = O.gatherAutomation(inp);
    ok(norm(ab) === norm(at) && at.rated >= 80 && at.families.filter((f) => f.tasks > 0).length >= 8,
      `task exposure: SQL kafaa_so_auto_base equals TS gatherAutomation (${at.rated} rated tasks, ${at.families.filter((f) => f.tasks > 0).length} families with tasks)`);

    // 52 deterministic assumption sets: adoption 0 / absent, the slider corners, every scenario, then pseudo-random mixes
    let seedN = 62;
    const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
    const pick = (k) => { const [lo, hi, step] = O.LIMITS[k]; const n = Math.round((hi - lo) / step); return Math.round((lo + Math.floor(rand() * (n + 1)) * step) * 1000) / 1000; };
    const scen = [null, ...T.scenarios.map((s) => s.id)];
    const sets = [{}, { automation_adoption: 0 }, { automation_adoption: 5 }, { automation_adoption: 60 }, { automation_adoption: 100 }, { automation_adoption: 35, horizon: 2031 },
      { automation_adoption: 50, horizon: 2036 }, ...scen.filter(Boolean).map((s) => ({ scenario_id: s, automation_adoption: 40 })), { automation_adoption: 25, reskill_overrides: { digital: 30, maintenance: 0 } }];
    while (sets.length < 52) {
      const p = { automation_adoption: rand() < 0.15 ? 0 : 5 * Math.floor(rand() * 21) };
      for (const k of O.NUM_PARAMS) if (rand() < 0.5) p[k] = pick(k);
      if (rand() < 0.35) p.scenario_id = scen[1 + Math.floor(rand() * (scen.length - 1))];
      if (rand() < 0.25) p.reskill_overrides = { [fams[Math.floor(rand() * fams.length)]]: Math.floor(rand() * 41) };
      sets.push(p);
    }
    bad = [];
    let compared = 0, withAuto = 0, barOk = 0, monotone = 0;
    for (const raw of sets) {
      const p = O.normalizeParams(raw, fams);
      const ps = (await q1('select kafaa_so_normalize($1::jsonb, kafaa_so_families()) p', [JSON.stringify(raw)])).p;
      if (!p || norm(ps) !== norm(p)) { bad.push(`normalize ${JSON.stringify(raw)}`); continue; }
      const a = (await q1('select kafaa_so_for($1::jsonb) r', [JSON.stringify(raw)])).r;
      const b = O.outlookFor(inp, raw);
      const pa = (await q1('select kafaa_so_auto_for($1::jsonb) r', [JSON.stringify(raw)])).r;
      const pb = O.automationFor(inp, raw);
      compared++;
      if (a.code !== 'ok' || b.code !== 'ok' || norm(a.result) !== norm(b.result)) { bad.push(`outlook ${JSON.stringify(raw)}`); continue; }
      if (pa.code !== 'ok' || pb.code !== 'ok' || norm(pa.result) !== norm(pb.result)) { bad.push(`profile ${JSON.stringify(raw)}`); continue; }
      const ad = O.adoptionOf(p);
      const bar = b.result.tornado.find((x) => x.param === O.AUTO_PARAM);
      if (ad > 0) { withAuto++; if (bar && bar.lo === 0 && bar.hi === 60 && norm(bar) === norm(pb.result.bar) && norm(b.result.automation) === norm(pb.result)) barOk++; }
      else if (!bar && !('automation' in b.result) && pb.result.bar.lo === 0 && pb.result.bar.hi === 60 && pb.result.bar.low === b.result.totals.cumulative) barOk++;
      if (pb.result.bar.high <= pb.result.bar.low && pb.result.families.every((f) => f.suppressed || (f.cut_hi >= 0 && f.cut_now >= 0))) monotone++;
    }
    ok(sets.length === 52 && compared === 52 && bad.length === 0, `acceptance (FS52): TS and SQL agree for ${compared} assumption sets (normalisation, outlook with the automation factor, driver and tornado, automation profile)${bad.length ? ` (${bad.length} differ, first ${bad[0]})` : ''}`);
    ok(barOk === compared && withAuto >= 40, `acceptance (FS52): the automation assumption appears in the tornado with its range 0-60 % (${withAuto} sets with adoption above 0 carry the bar in the result; the others get it from the profile)`);
    ok(monotone === compared, 'more adoption never raises demand: the automation bar and every family cut point the same way');

    const base0 = O.outlookFor(inp, {}).result, a60 = O.outlookFor(inp, { automation_adoption: 60 }).result;
    const drv = a60.families.filter((f) => !f.suppressed && f.drivers.some((d) => d.code === 'automation' && d.effect === 'narrows')).length;
    ok(a60.totals.cumulative < base0.totals.cumulative && drv >= 6 && O.familyReasons(a60.families.find((f) => !f.suppressed), a60.params).some((r) => r.code === 'so_automation'),
      `automation narrows the gap: cumulative shortfall ${base0.totals.cumulative} -> ${a60.totals.cumulative} at 60 %; ${drv} families list the automation driver (WhyThis reason)`);

    const invalid = [{ automation_adoption: -5 }, { automation_adoption: 101 }, { automation_adoption: 12.5 }, { automation_adoption: '30' }, { automation_adoption: true }];
    const invSql = [];
    for (const raw of invalid) invSql.push((await q1('select kafaa_so_normalize($1::jsonb, kafaa_so_families()) is null x', [JSON.stringify(raw)])).x);
    const zeroSame = norm((await q1('select kafaa_so_normalize($1::jsonb, kafaa_so_families()) p', ['{"automation_adoption":0}'])).p) === norm(O.normalizeParams({}, fams));
    ok(invalid.every((raw) => O.normalizeParams(raw, fams) === null) && invSql.every(Boolean) && zeroSame, `parameter guard: ${invalid.length} malformed adoption values refused in SQL and TS; adoption 0 normalises to the F35 parameters`);

    const prof = O.automationFor(inp, { automation_adoption: 40 }).result;
    const people = new Set(T.people.map((p) => p.id));
    const s1 = JSON.stringify((await q1('select kafaa_so_auto_for($1::jsonb) r', ['{"automation_adoption":40}'])).r);
    const supOk = prof.families.every((f) => (base0.families.find((x) => x.key === f.key).suppressed ? f.suppressed && f.tasks === null && f.share_h === null && f.cut_now === null : !f.suppressed));
    ok(supOk && [...people].every((id) => !s1.includes(`"${id}"`)) && !/security/.test(s1) && !/"jt-/.test(s1), 'automation profile: families suppressed exactly as in the outlook; no person id, task id or security family in the payload');
  } finally {
    await fresh.close();
  }

  // ── RBAC of the RPC (shared database)
  const au = async (persona, params = {}) => (await one(persona, 'select kafaa_outlook_automation($1::jsonb) r', [JSON.stringify(params)])).r;
  const n0 = Number((await db.query("select count(*)::int n from kafaa_audit_events where action = 'outlook.automation' and outcome = 'refused'")).rows[0].n);
  const mgr = await au('sro'), obs = await au('k-observer'), emp = await au('k-ro');
  let anonBlocked = false;
  try { const r = await au(null); anonBlocked = r?.code === 'not_signed_in'; } catch { anonBlocked = true; }
  const n1 = Number((await db.query("select count(*)::int n from kafaa_audit_events where action = 'outlook.automation' and outcome = 'refused'")).rows[0].n);
  ok(mgr.code === 'forbidden' && obs.code === 'forbidden' && emp.code === 'forbidden' && anonBlocked && n1 >= n0 + 3, 'RBAC (existing F35 rules): line manager, observer and employee are refused the automation profile (audited); anonymous cannot execute it');
  const hd = await au('chco', { automation_adoption: 30 }), ha = await au('k-hr-analyst'), ad = await au('k-auditor');
  ok(hd.ok && ha.ok && ad.ok && hd.data.simulated === true && hd.data.adoption === 30 && ha.data.adoption === 0 && hd.data.bar.param === 'automation_adoption', 'HR director, HR analyst and auditor read the automation profile (SIMULATED)');
  ok((await au('chco', { automation_adoption: 120 })).code === 'invalid' && (await au('chco', { scenario_id: 'scn-nope' })).code === 'not_found', 'out-of-range adoption -> invalid; unknown staffing scenario -> not_found');
  const co = (await one('chco', 'select kafaa_compute_outlook($1::jsonb) r', ['{"automation_adoption":45}'])).r;
  ok(co.ok && co.data.params.automation_adoption === 45 && co.data.automation?.adoption === 45 && co.data.tornado.some((b) => b.param === 'automation_adoption'), 'kafaa_compute_outlook accepts the automation assumption (result carries the profile and the tornado bar)');

  // ── FS53 seed acceptance
  const bv = T.benchmark_values ?? [];
  const shown = bv.filter((r) => r.shown), held = bv.filter((r) => !r.shown);
  ok(bv.length === 10 && shown.length === 4 && held.length === 6 && shown.every((r) => r.verification === 'primary') && held.every((r) => r.verification !== 'primary' && r.held_reason_en && r.held_reason_ar),
    `seed: ${bv.length} benchmark values, ${shown.length} drawn (all primary in the research packs), ${held.length} held back with a reason (secondary or unverified)`);
  const probs = bv.map((r) => [r.id, benchmarkValueProblems(r, T.benchmarks)]).filter(([, p]) => p.length);
  ok(probs.length === 0, `acceptance (FS53): every external value is an exact copy of an FS01 figure and links its https source and as-of date${probs.length ? ` (${probs[0][0]}: ${probs[0][1]})` : ''}`);
  const packs = ['nuclear_energy', 'corporate_platforms', 'global_frameworks', 'national_systems'].map((f) => { try { return readFileSync(`../docs/kafaa/ref/research/${f}.md`, 'utf8'); } catch { return null; } });
  if (packs.every(Boolean)) {
    ok(shown.every((r) => packs.some((p) => p.includes(r.source_url.replace(/^https:\/\//, '')))) && bv.every((r) => /^research\/[a-z_]+\.md /.test(r.pack_ref) && packs.some((p, i) => r.pack_ref.startsWith(`research/${['nuclear_energy', 'corporate_platforms', 'global_frameworks', 'national_systems'][i]}.md`))),
      'every drawn value\'s source URL is a research-pack source; every row names its research-pack section');
    ok(held.every((r) => /secondary|\[S|unverified|euricse/i.test(r.pack_ref)), 'every held row names the research-pack flag that holds it back');
  }
  ok(marketValues(bv, 'skills_outlook').length === 4 && marketValues(bv, 'overview').length === 3 && heldValues(bv).length === 6, 'dashboards: four market lines on the skills outlook, three on the workforce overview; held rows never become lines');
  let threw = false;
  try { sumMeasured([...Object.values(measuresFrom(null, null)), { kind: 'market', value: 24 }]); } catch (e) { threw = e.message === 'market_value_in_sum'; }
  ok(threw, 'acceptance (FS53): summing a market value with measured values is refused (TS rule)');

  // ── SQL = TS for the guard rule (rows and mutants)
  await db.exec('reset role');
  const sqlP = async (j) => (await db.query('select kafaa_bv_problems($1::jsonb) v', [JSON.stringify(j)])).rows[0].v;
  const r0 = bv.find((r) => r.id === 'bv-ssg-sf-ai-aided-tasks');
  const mut = [
    ...bv,
    { ...r0, value: 25 }, { ...r0, unit: 'count' }, { ...r0, scale_max: null }, { ...r0, label_en: 'Typed label' }, { ...r0, label_ar: ' ' }, { ...r0, source_url: 'http://isomer-user-content.by.gov.sg/x.pdf' },
    { ...r0, source_url: 'https://example.org/other' }, { ...r0, as_of: '2026-10-09' }, { ...r0, verification: 'secondary' }, { ...r0, verification: 'maybe' }, { ...r0, pack_ref: '' },
    { ...r0, shown: false }, { ...r0, compare_to: 'headcount' }, { ...bv.find((r) => r.id === 'bv-uk-nuc-new-jobs-2030'), compare_to: 'ai_task_share' }, { ...r0, dashboards: [] },
    { ...r0, dashboards: ['overview', 'home'] }, { ...r0, dashboards: null }, { ...r0, id: 'BV 1' }, { ...r0, benchmark_id: 'NOPE' }, { ...r0, figure_key: 'nope' }, { ...r0, value: '24' },
    { ...held[0], held_reason_ar: '' }, { ...held[0], shown: true },
  ];
  const diffs = [];
  for (const m of mut) { const s = await sqlP(m), t = benchmarkValueProblems(m, T.benchmarks); if (norm(s) !== norm(t)) diffs.push(`${m.id}: sql ${s} ts ${t}`); }
  ok(diffs.length === 0 && mut.slice(bv.length).every((m) => benchmarkValueProblems(m, T.benchmarks).length > 0), `SQL kafaa_bv_problems equals TS benchmarkValueProblems on ${bv.length} rows and ${mut.length - bv.length} mutants (each mutant refused)${diffs.length ? ` (${diffs[0]})` : ''}`);
  const dbRows = (await db.query('select to_jsonb(t) j from kafaa_benchmark_values t order by id')).rows.map((r) => r.j);
  ok(dbRows.length === 10 && (await Promise.all(dbRows.map((j) => sqlP(j)))).every((p) => p.length === 0), 'database: 10 benchmark values after migrations + seed (applied twice), every one passes the guard rule');

  await db.exec('begin');
  try {
    let refused = '';
    try { await db.exec("savepoint s1; update kafaa_benchmark_values set value = value + 1 where id = 'bv-forecast-priority-demand-growth-2030'"); } catch (e) { refused = e.message; await db.exec('rollback to savepoint s1'); }
    let refused2 = '';
    try { await db.exec("savepoint s2; update kafaa_benchmark_values set verification = 'secondary' where id = 'bv-digcomp-above-basic-eu-2023'"); } catch (e) { refused2 = e.message; await db.exec('rollback to savepoint s2'); }
    ok(/kafaa_fs53: figure/.test(refused) && /kafaa_fs53: verification/.test(refused2), 'guard trigger: a drifted value and a drawn secondary figure are refused on write (even for the service role)');
  } finally {
    await db.exec('rollback');
    await db.exec('reset role');
  }

  // ── RLS: wherever a workforce dashboard is visible
  const counts = {};
  for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'sro', 'k-observer', 'k-ro', 'training-mgr', null]) counts[p ?? 'anon'] = await count(p, 'kafaa_benchmark_values');
  ok(counts.chco === 10 && counts['k-hr-analyst'] === 10 && counts['k-auditor'] === 10 && counts.sro === 10 && counts['k-ro'] === 0 && counts.anon === 0 && counts['training-mgr'] === 0,
    `RLS (FS53 staff R where the dashboard is visible): HR, auditors and line managers read the values; staff without a workforce dashboard and anonymous read none (${JSON.stringify(counts)})`);
  let blocked = false;
  try { await as('chco', "insert into kafaa_benchmark_values (id, benchmark_id, figure_key, metric, label_en, label_ar, value, unit, as_of, source_url, verification, pack_ref) values ('bv-x-y', 'SSG-SF', 'tasks', 'm', 'a', 'b', 1, 'count', '2026-10-10', 'https://x.org', 'primary', 'r')"); } catch { blocked = true; }
  ok(blocked, 'no client writes to benchmark values (reference data from the seed)');

  // ── no SQL mixes market values with outlook numbers; grants; additivity
  const refs = (await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%kafaa_benchmark_values%' order by 1`)).rows.map((r) => r.proname);
  ok(refs.every((n) => n === 'kafaa_bv_guard' || n === 'kafaa_bv_problems'), `acceptance (FS53): no SQL function reads kafaa_benchmark_values besides its guard (${refs.join(', ') || 'none'}), so no outlook number is ever summed with a market value`);
  const grants = (await db.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [FNS])).rows;
  ok(grants.length === FNS.length && grants.every((g) => !g.a && (g.proname === 'kafaa_outlook_automation' ? g.u : !g.u)), `grants: of the ${FNS.length} new or redefined functions only kafaa_outlook_automation is executable, by authenticated users only; anon executes nothing new`);
  const sql = readFileSync(MIG, 'utf8');
  const forbidden = ['dr' + 'op', 'del' + 'ete', 'trun' + 'cate'];
  ok(!forbidden.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(sql)) && [...sql.matchAll(/alter table\s+(\w+)/gi)].every((m) => m[1].startsWith('kafaa_')) && [...sql.matchAll(/alter policy\s+\w+\s+on\s+(\w+)/gi)].every((m) => m[1] === 'kafaa_benchmark_values')
    && [...sql.matchAll(/create or replace function\s+(\w+)/gi)].every((m) => FNS.includes(m[1])) && !/kafaa_so_base\s*\(p_scenario/i.test(sql),
    'migration is additive: kafaa_* objects only, no removal words, kafaa_so_base untouched, policy only on the new table');

  // ── md5s and digest for the live comparison (handover 3.10)
  const md5 = (await db.query(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FNS])).rows;
  console.log(`    fs62 function md5: ${md5.map((r) => `${r.proname} ${r.m}`).join('; ')}`);
  const d = (await db.query(`select count(*)::int n, left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) d from public.kafaa_benchmark_values t`)).rows[0];
  console.log(`    digest kafaa_benchmark_values: ${d.n}:${d.d}`);
}
