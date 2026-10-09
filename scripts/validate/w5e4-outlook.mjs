// [W5 · E4] PGlite checks for 20261009154001_kafaa_w5e4_skills_outlook.sql (F35 Skills supply-and-demand outlook, SIMULATED):
// SQL = TS parity of the base aggregates (kafaa_so_base = gatherBase) and of whole outlooks (kafaa_so_compute = computeOutlook) for
// the baseline, every staffing scenario and many assumption sets; parameter normalisation and the release text guard; the seeded
// outlooks equal what the server computes; suppression (no family under 10 measured people, no person id anywhere); resetting
// reproduces the baseline; RBAC and RLS; save (saveScenario rules), release (HR director, publicTextIsClean, ledger) and withdraw.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w5e4Checks({ db, as, one, count, ok, uid }) {
  const { BASELINE, LIMITS, MIN_GROUP, NUM_PARAMS, computeOutlook, gatherBase, inputFromTables, normalizeParams, outlookFamilies, outlookFor } = await import('../../src/modules/m07/outlook.ts');
  const { publicTextIsClean } = await import('../../src/domain/future.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const inp = inputFromTables((t) => T[t] ?? []);
  const fams = outlookFamilies(inp);
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
  for (const [persona, role] of [['k-ro', 'Reactor Operator']]) {
    if (uid[persona]) continue;
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = '00000000-0000-4000-8000-000000001541';
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }

  // ── seed sanity
  const so = T.skill_outlooks ?? [];
  ok(so.length === 5 && so.filter((o) => o.status === 'released').length === 1 && so.some((o) => o.status === 'withdrawn') && so.every((o) => /simulated/i.test(o.name) && o.simulated === true),
    `seed: ${so.length} saved outlooks (1 released, 1 withdrawn), every name marked SIMULATED`);
  ok(so.filter((o) => o.summary_en).every((o) => publicTextIsClean([o.name, o.summary_en, o.summary_ar])), 'seed: every release text passes publicTextIsClean');

  // ── parity on a pristine database (earlier checks change skill states)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q1 = async (sql, params = []) => (await fresh.query(sql, params)).rows[0];
  const scenIds = [null, ...T.scenarios.map((s) => s.id)];
  let bad = [];
  for (const sid of scenIds) {
    const a = (await q1('select kafaa_so_base($1) as b', [sid])).b, b = gatherBase(inp, sid);
    if (norm(a) !== norm(b)) bad.push(sid ?? 'current fleet');
  }
  ok(bad.length === 0, `base aggregates: SQL kafaa_so_base equals TS gatherBase for the current fleet and ${T.scenarios.length} saved scenarios${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);
  ok((await q1("select kafaa_so_base('scn-nope') is null as x")).x, 'unknown scenario: kafaa_so_base returns null (the RPC refuses not_found)');

  // assumption sets: baseline, every scenario, overrides, the corners of every slider and 30 pseudo-random mixes
  let seedN = 35;
  const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
  const pick = (k) => { const [lo, hi, step] = LIMITS[k]; const n = Math.round((hi - lo) / step); return Math.round((lo + Math.floor(rand() * (n + 1)) * step) * 1000) / 1000; };
  const sets = [{}, ...scenIds.filter(Boolean).map((s) => ({ scenario_id: s })), { reskill_overrides: { digital: 30, maintenance: 0 } }];
  for (const k of NUM_PARAMS) { sets.push({ [k]: LIMITS[k][0] }); sets.push({ [k]: LIMITS[k][1] }); }
  for (let i = 0; i < 30; i++) {
    const p = {};
    for (const k of NUM_PARAMS) if (rand() < 0.6) p[k] = pick(k);
    if (rand() < 0.4) p.scenario_id = scenIds[1 + Math.floor(rand() * (scenIds.length - 1))];
    if (rand() < 0.3) p.reskill_overrides = { [fams[Math.floor(rand() * fams.length)]]: Math.floor(rand() * 41) };
    sets.push(p);
  }
  bad = [];
  let compared = 0;
  for (const raw of sets) {
    const p = normalizeParams(raw, fams);
    const ps = (await q1('select kafaa_so_normalize($1::jsonb, kafaa_so_families()) as p', [JSON.stringify(raw)])).p;
    if (!p || norm(ps) !== norm(p)) { bad.push(`normalize ${JSON.stringify(raw)}`); continue; }
    const a = (await q1('select kafaa_so_compute(kafaa_so_base($1), $2::jsonb) as r', [p.scenario_id, JSON.stringify(p)])).r;
    const b = computeOutlook(gatherBase(inp, p.scenario_id), p);
    compared++;
    if (norm(a) !== norm(b)) bad.push(JSON.stringify(raw));
  }
  ok(bad.length === 0, `outlooks: SQL kafaa_so_compute equals TS computeOutlook for ${compared} assumption sets (projection, drivers, totals, tornado)${bad.length ? ` (${bad.length} differ, first ${bad[0]})` : ''}`);

  const invalid = [{ horizon: 2030 }, { horizon: 2035.5 }, { attrition_pct: -1 }, { attrition_pct: '4' }, { klra_weight: 2 }, { adv_factor: 0.4 }, { ossa_end: 2033 },
    { reskill_overrides: { security: 10 } }, { reskill_overrides: { digital: 41 } }, { reskill_overrides: [1] }, { scenario_id: 7 }, { annual_intake: 10.5 }];
  const invSql = [];
  for (const raw of invalid) invSql.push((await q1('select kafaa_so_normalize($1::jsonb, kafaa_so_families()) is null as x', [JSON.stringify(raw)])).x);
  ok(invalid.every((raw) => normalizeParams(raw, fams) === null) && invSql.every(Boolean), `parameter guard: ${invalid.length} out-of-range or malformed assumption sets are refused in SQL and TS alike`);

  const texts = ['Operations opens a shortfall from 2029 (SIMULATED).', 'We need 120 operators by 2032', 'Headcount rises', 'about 30 people', 'FTE plan', 'candidate site chosen', 'Ready to staff the units',
    'العمليات تظهر فجوة', 'site selection pending', '3 staff'];
  const tcSql = [];
  for (const x of texts) tcSql.push((await q1('select kafaa_so_text_clean(array[$1]) as c', [x])).c);
  ok(texts.every((x, i) => tcSql[i] === publicTextIsClean([x])), `release text guard: SQL kafaa_so_text_clean equals M11 publicTextIsClean on ${texts.length} samples`);

  // seeded outlooks = what the server computes for their stored parameters
  bad = [];
  for (const o of so) {
    const r = (await q1('select kafaa_so_for($1::jsonb) as r', [JSON.stringify(o.params)])).r;
    if (r.code !== 'ok' || norm(r.result) !== norm(o.results)) bad.push(o.id);
  }
  ok(bad.length === 0, `seeded outlooks: stored results equal kafaa_so_for on the seeded data for all ${so.length}${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);

  // suppression and payload hygiene
  const base0 = computeOutlook(gatherBase(inp, null), normalizeParams({}, fams));
  const gb = gatherBase(inp, null);
  const supOk = base0.families.every((f) => {
    const g = gb.families.find((x) => x.key === f.key);
    return f.suppressed ? (g.n_s < MIN_GROUP || g.n_d < MIN_GROUP) && f.s0 === null && f.d0 === null && f.years.length === 0 && f.drivers.length === 0
      : g.n_s >= MIN_GROUP && g.n_d >= MIN_GROUP && f.basis_n >= MIN_GROUP;
  });
  ok(supOk && base0.totals.suppressed >= 1 && base0.totals.visible >= 6, `suppression: ${base0.totals.suppressed} skill families under ${MIN_GROUP} measured people return their key only; ${base0.totals.visible} shown`);
  const people = new Set(T.people.map((p) => p.id));
  const s1 = JSON.stringify((await q1('select kafaa_so_compute(kafaa_so_base(null), kafaa_so_normalize($1::jsonb, kafaa_so_families())) as r', ['{}'])).r);
  ok([...people].every((id) => !s1.includes(`"${id}"`)) && !/security/.test(s1), 'no person id and no security skill family in the outlook payload');
  const shortSum = base0.families.filter((f) => !f.suppressed).reduce((s, f) => s + Math.max(0, f.horizon_gap), 0);
  ok(shortSum === base0.totals.shortfall && base0.totals.shortfall_by_year.reduce((a, b) => a + b, 0) === base0.totals.cumulative, 'totals add up from the visible families only (no suppressed family can be derived)');

  // reset reproduces the baseline exactly
  const r0 = (await q1('select kafaa_so_for($1::jsonb) as r', ['{}'])).r.result;
  const rX = (await q1('select kafaa_so_for($1::jsonb) as r', [JSON.stringify({ attrition_pct: 9, adv_factor: 1.5, scenario_id: 'scn-1', reskill_overrides: { digital: 40 } })])).r.result;
  const rB = (await q1('select kafaa_so_for($1::jsonb) as r', [JSON.stringify(BASELINE)])).r.result;
  ok(norm(r0) !== norm(rX) && norm(r0) === norm(rB) && norm(rB) === norm(outlookFor(inp, {}).result), 'resetting the sliders to the baseline reproduces the baseline outlook exactly (SQL and TS)');
  await fresh.close();

  // ── RPC and RLS on the shared database
  const cmp = async (persona, params = {}) => (await one(persona, 'select kafaa_compute_outlook($1::jsonb) as r', [JSON.stringify(params)])).r;
  const n0 = Number((await db.query("select count(*)::int n from kafaa_audit_events where action = 'outlook.compute'")).rows[0].n);
  const mgr = await cmp('sro'), obs = await cmp('k-observer'), emp = await cmp('k-ro');
  let anonBlocked = false;
  try { const r = await cmp(null); anonBlocked = r?.code === 'not_signed_in'; } catch { anonBlocked = true; }
  const n1 = Number((await db.query("select count(*)::int n from kafaa_audit_events where action = 'outlook.compute' and outcome = 'refused'")).rows[0].n);
  ok(mgr.code === 'forbidden' && obs.code === 'forbidden' && emp.code === 'forbidden' && anonBlocked && n1 >= n0 + 3, 'line manager, observer and employee are refused the live outlook (audited); anonymous callers cannot execute it');
  const hd = await cmp('chco'), ha = await cmp('k-hr-analyst'), au = await cmp('k-auditor');
  ok(hd.ok && ha.ok && au.ok && hd.data.simulated === true && hd.data.families.length === fams.length, 'HR director, HR analyst and auditor read the live outlook (labelled simulated)');
  ok((await cmp('chco', { horizon: 2040 })).code === 'invalid' && (await cmp('chco', { scenario_id: 'scn-nope' })).code === 'not_found', 'out-of-range assumption -> invalid; unknown staffing scenario -> not_found');
  ok((await count('chco', 'kafaa_skill_outlooks')) >= 5 && (await count('k-auditor', 'kafaa_skill_outlooks')) >= 5 && (await count('sro', 'kafaa_skill_outlooks')) === 0 && (await count('k-observer', 'kafaa_skill_outlooks')) === 0,
    'saved outlooks: HR and auditors read the table; line managers and observers read none (released outlooks via the RPC only)');
  let blocked = false;
  try { await as('chco', "insert into kafaa_skill_outlooks (id, name, created_by) values ('x', 'x (SIMULATED)', 'p-chco')"); } catch { blocked = true; }
  ok(blocked, 'no client writes to saved outlooks');

  // save (saveScenario rules)
  const sv = async (persona, input) => (await one(persona, 'select kafaa_save_outlook($1::jsonb) as r', [JSON.stringify(input)])).r;
  const s0 = await sv('sro', { name: 'Manager try', params: {} });
  const s1r = await sv('k-hr-analyst', { name: 'PGlite check outlook', params: { attrition_pct: 5, reskill_overrides: { digital: 20 } } });
  const row1 = s1r.ok ? (await db.query('select * from kafaa_skill_outlooks where id = $1', [s1r.data.id])).rows[0] : null;
  const live = (await db.query("select kafaa_so_for($1::jsonb) as r", [JSON.stringify({ attrition_pct: 5, reskill_overrides: { digital: 20 } })])).rows[0].r.result;
  ok(s0.code === 'forbidden' && s1r.ok && row1?.name === 'PGlite check outlook (SIMULATED)' && row1.status === 'draft' && norm(row1.results) === norm(live) && row1.created_by === 'p-k-hr-analyst',
    'save: HR analyst saves (name marked SIMULATED, results recomputed on the server); a line manager cannot');
  ok((await sv('k-hr-analyst', { name: 'x', params: {} })).code === 'invalid' && (await sv('k-hr-analyst', { name: 'Bad', params: { horizon: 2050 } })).code === 'invalid'
    && (await sv('chco', { id: s1r.data.id, name: 'Not mine', params: {} })).code === 'not_found', 'save: short name or bad assumption -> invalid; another person\'s outlook -> not_found');

  // release and withdraw (HR director only; text guard; ledger)
  const rl = async (persona, id, en, ar) => (await one(persona, 'select kafaa_release_outlook($1, $2, $3) as r', [id, en, ar])).r;
  const goodEn = 'Shortfalls open in operations and safety as the handover lands. SIMULATED.', goodAr = 'تظهر فجوات في العمليات والسلامة مع مرحلة التسليم. محاكاة.';
  const rA = await rl('k-hr-analyst', s1r.data.id, goodEn, goodAr);
  const rDirty = await rl('chco', s1r.data.id, 'We will need 120 operators more by 2032.', goodAr);
  const l0 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const rOk = await rl('chco', s1r.data.id, goodEn, goodAr);
  const l1 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const auRow = (await db.query("select ledger_status from kafaa_audit_events where action = 'outlook.release' and entity_id = $1 and outcome = 'ok'", [s1r.data.id])).rows[0];
  ok(rA.code === 'forbidden' && rDirty.code === 'not_clean' && rOk.ok && (l1 === l0 + 1 || auRow?.ledger_status === 'skipped') && !!auRow,
    'release: HR analyst refused; headcount wording refused (publicTextIsClean); the HR director releases (audit + ledger)');
  ok((await rl('chco', s1r.data.id, goodEn, goodAr)).code === 'already_released' && (await sv('k-hr-analyst', { id: s1r.data.id, name: 'PGlite check outlook', params: {} })).code === 'released',
    'a released outlook cannot be released again or edited until withdrawn');
  const relM = (await one('sro', 'select kafaa_released_outlooks() as r')).r, relO = (await one('k-observer', 'select kafaa_released_outlooks() as r')).r;
  ok(relM.ok && relM.data.some((o) => o.id === s1r.data.id) && relM.data.some((o) => o.id === 'so-baseline-2035') && relM.data.every((o) => o.results?.simulated === true) && relO.code === 'forbidden',
    'released outlooks: the line manager reads them (aggregate results only); observers are refused');
  const wd = async (persona, id, why) => (await one(persona, 'select kafaa_withdraw_outlook($1, $2) as r', [id, why])).r;
  const w0 = await wd('k-hr-analyst', s1r.data.id, 'Not mine to withdraw'), w1 = await wd('chco', s1r.data.id, 'no'), w2 = await wd('chco', s1r.data.id, 'Validator clean-up');
  ok(w0.code === 'forbidden' && w1.code === 'invalid' && w2.ok && (await wd('chco', s1r.data.id, 'Validator clean-up')).code === 'not_released'
    && !(await one('sro', 'select kafaa_released_outlooks() as r')).r.data.some((o) => o.id === s1r.data.id), 'withdraw: HR director only, with a reason; the outlook leaves the released list');
}
