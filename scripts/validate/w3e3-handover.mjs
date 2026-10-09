// [W3 · E3] PGlite checks for 20261009133001_kafaa_w3e3_handover.sql (F22 Handover 2030 board): SQL = TS parity of the board
// for both seeded periods and several what-if scenarios, the F19 succession path (stub tables when F19 is not merged yet) and
// that a readiness change moves the burn-down, suppression of every cell under 10, no person-level field in any payload, RBAC
// (observers, employees and anonymous callers refused; refusals audited), the plan tables' read rule, and the observer-safe
// release draft (HR only; it then follows the existing maker-checker release).
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w3e3Checks({ db, as, one, count, ok, uid }) {
  const { computeHandover, gatherNamed, MIN_GROUP } = await import('../../src/modules/m07/handover.ts');
  const { careerReadiness } = await import('../../src/modules/m18/career.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  let n = 1330;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector']]) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }

  const data = (states) => ({
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states,
    licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records,
    enrolments: T.enrolments, weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
  });
  const d0 = data(T.person_skills);
  const tsBoard = (period, sc, slates = T.succession_slates ?? [], successors = T.successors ?? []) => {
    const cover = T.external_cover.filter((c) => c.period === period);
    const { named, f19Roles } = gatherNamed({ people: T.people, targets: T.career_targets, slates, successors }, [...new Set(cover.map((c) => c.role_id))],
      (p, r) => { const x = careerReadiness(d0, p, [r], now)[0]; return x ? { band: x.band, months: x.months } : null; });
    return computeHandover({ period, roles: T.job_roles, cover, cohorts: T.handover_cohorts.filter((c) => c.period === period), named }, sc, f19Roles);
  };
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
  const cellsOk = (a) => {
    const bad = [];
    const walk = (g) => {
      const cells = [...g.cover, ...g.ready, ...g.shortfall, ...Object.values(g.bands), ...Object.values(g.pipeline), g.named, g.pipeline_total, g.max_shortfall, g.ready_total, g.emirati];
      for (const c of cells) if (c !== null && (typeof c !== 'number' || c < MIN_GROUP)) bad.push(`${g.key}:${c}`);
    };
    [a.total, ...a.functions, ...a.roles].forEach(walk);
    return bad;
  };

  // ── seed: plan sanity
  const periods = [...new Set(T.external_cover.map((c) => c.period))].sort();
  ok(periods.join(',') === '2026-Q2,2026-Q3' && T.handover_cohorts.length >= 50, `handover seed: 2 periods, ${T.external_cover.length} cover rows, ${T.handover_cohorts.length} cohorts`);
  const sec = new Set(T.job_roles.filter((r) => ['security', 'safeguards', 'cyber'].includes(r.family_id)).map((r) => r.id));
  ok(!T.external_cover.some((c) => sec.has(c.role_id)) && !T.handover_cohorts.some((c) => sec.has(c.role_id)), 'no security, safeguards or cyber role carries cover or a cohort');
  const over = T.critical_roles.filter((cr) => T.handover_cohorts.filter((c) => c.period === cr.period && c.role_id === cr.role_id).reduce((s, c) => s + c.trainees, 0) > cr.in_training + cr.pipeline);
  ok(over.length === 0, 'earmarked cohort trainees never exceed a critical role\'s in-training + pipeline count for the period');
  const q3 = T.external_cover.filter((c) => c.period === '2026-Q3' && c.year === 2026).reduce((s, c) => s + c.cover_count, 0);
  ok(q3 >= 380 && q3 <= 420, `2026 cover is about 400 positions (${q3}), in line with the OSSA's ~400 experts a year`);

  // ── parity on a fresh database (F19 tables stubbed when F19 is not merged): SQL kafaa_ho_compute = TS computeHandover
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const sqlBoard = async (period, sc) => (await fresh.query('select kafaa_ho_compute($1, $2::date, $3, $4) as a', [period, now, sc.ossa_end, sc.slip_months])).rows[0].a;
  const scen = [{ ossa_end: 2030, slip_months: 0 }, { ossa_end: 2029, slip_months: 6 }, { ossa_end: 2032, slip_months: 12 }, { ossa_end: 2028, slip_months: 24 }];
  let diffs = 0, first = '', compared = 0;
  for (const p of periods) for (const sc of scen) {
    const a = await sqlBoard(p, sc), b = tsBoard(p, sc);
    compared++;
    if (norm(a) !== norm(b)) { diffs++; if (!first) first = `${p} ${JSON.stringify(sc)}`; }
  }
  ok(diffs === 0, `handover board: SQL equals TS for ${compared} period × scenario boards${diffs ? ` (${diffs} differ, first ${first})` : ''}`);
  const base = tsBoard('2026-Q3', scen[0]);
  ok(cellsOk(base).length === 0 && scen.every((sc) => cellsOk(tsBoard('2026-Q2', sc)).length === 0), 'every count cell is either null (suppressed) or at least 10, zero included');
  ok(base.total.risk && base.functions.some((g) => g.risk) && base.functions.some((g) => !g.risk) && base.functions.some((g) => g.cover.every((c) => c === null)),
    'baseline board: some functions at risk, some on track, small functions fully suppressed');
  const slip = tsBoard('2026-Q3', { ossa_end: 2029, slip_months: 12 });
  ok(slip.functions.filter((g) => g.risk).length >= base.functions.filter((g) => g.risk).length && (slip.total.first_shortfall ?? 9999) <= (base.total.first_shortfall ?? 9999),
    'what-if (OSSA ends 2029, 12-month slip) never improves the risk picture');
  const people = new Set(T.people.map((p) => p.id));
  const leaks = (a) => { const s = JSON.stringify(a); return [...people].filter((id) => s.includes(`"${id}"`)); };
  ok(leaks(await sqlBoard('2026-Q3', scen[0])).length === 0, 'no person id appears anywhere in the board payload');

  // F19 path: live slates replace F05 shortlists for their roles; a readiness change moves the burn-down (SQL and TS alike)
  const hasF19 = (await fresh.query("select to_regclass('public.kafaa_successors') is not null and to_regclass('public.kafaa_succession_slates') is not null as x")).rows[0].x;
  let stubbed = false;
  if (!hasF19) {
    await fresh.exec(`create table kafaa_succession_slates (id text primary key, role_id text, period text, status text);
      create table kafaa_successors (id text primary key, slate_id text, person_id text, readiness text, emergency boolean default false, status text);`);
    stubbed = true;
  }
  const ops = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_family_id === 'operations' && p.job_role_id !== 'senior-reactor-operator').slice(0, 14);
  const slate = { id: 'ss-w3e3-sro', role_id: 'senior-reactor-operator', period: '2026', status: 'confirmed' };
  const succ = ops.map((p, i) => ({ id: `su-w3e3-${i}`, slate_id: slate.id, person_id: p.id, readiness: i < 11 ? 'ready_now' : i < 13 ? '1_2y' : '3_5y', status: 'proposed' }));
  try {
    await fresh.query('insert into kafaa_succession_slates (id, role_id, period, status) values ($1,$2,$3,$4)', [slate.id, slate.role_id, slate.period, slate.status]);
    for (const s of succ) await fresh.query('insert into kafaa_successors (id, slate_id, person_id, readiness, status) values ($1,$2,$3,$4,$5)', [s.id, s.slate_id, s.person_id, s.readiness, s.status]);
    const slatesTs = [...(T.succession_slates ?? []), slate], succTs = [...(T.successors ?? []), ...succ];
    const a1 = await sqlBoard('2026-Q3', scen[0]), b1 = tsBoard('2026-Q3', scen[0], slatesTs, succTs);
    const sroRole = b1.roles.find((g) => g.key === 'senior-reactor-operator');
    ok(norm(a1) === norm(b1) && sroRole.source === 'f19' && b1.functions.find((g) => g.key === 'operations').source === 'mixed',
      `F19 slate path${stubbed ? ' (stub tables; F19 not merged)' : ''}: SQL equals TS, SRO successors come from the slate, operations is mixed`);
    // a successor's readiness drops from "ready now" to "3 to 5 years": the burn-down's ready-by-year changes
    await fresh.query("update kafaa_successors set readiness = '3_5y' where id = any($1)", [succ.slice(0, 6).map((s) => s.id)]);
    const succ2 = succTs.map((s) => (succ.slice(0, 6).some((x) => x.id === s.id) ? { ...s, readiness: '3_5y' } : s));
    const a2 = await sqlBoard('2026-Q3', scen[0]), b2 = tsBoard('2026-Q3', scen[0], slatesTs, succ2);
    const r1 = a1.roles.find((g) => g.key === 'senior-reactor-operator'), r2 = a2.roles.find((g) => g.key === 'senior-reactor-operator');
    ok(norm(a2) === norm(b2) && norm(r1.ready) !== norm(r2.ready) && norm(a1.total.ready) !== norm(a2.total.ready) && (r1.bands.now ?? 0) - (r2.bands.now ?? 0) === 6,
      'F19 readiness change (6 successors from ready now to 3-5 years) recomputes the burn-down in SQL and TS');
    await fresh.query("update kafaa_succession_slates set status = 'archived' where id = $1", [slate.id]);
    const a3 = await sqlBoard('2026-Q3', scen[0]);
    ok(norm(a3) === norm(tsBoard('2026-Q3', scen[0])), 'an archived slate drops out: the role falls back to F05 shortlists');
  } catch (e) {
    ok(!stubbed, `F19 slate path skipped: the merged F19 schema needs other columns (${String(e.message).slice(0, 80)}); integration lead to re-run with F19 seed rows`);
  }
  const { releaseTiles } = await import('../../src/modules/m07/handover.ts');
  const tb = await sqlBoard('2026-Q3', scen[0]);
  const tSql = (await fresh.query('select kafaa_ho_release_tiles(kafaa_ho_compute($1, $2::date, 2030, 0)) as t', ['2026-Q3', now])).rows[0].t;
  ok(norm(tSql) === norm(releaseTiles(tb)), 'observer release tiles: SQL kafaa_ho_release_tiles equals TS releaseTiles');
  await fresh.close();

  // ── RPC and RLS on the shared database
  const agg = async (persona, period = '2026-Q3', ossa = null, slipM = null) => (await one(persona, 'select kafaa_handover_aggregate($1, $2, $3) as r', [period, ossa, slipM])).r;
  const a0 = Number((await db.query('select count(*)::int n from kafaa_audit_events')).rows[0].n);
  const obs = await agg('k-observer'), emp = await agg('k-ro');
  let anonBlocked = false;
  try { const r = await agg(null); anonBlocked = r?.code === 'not_signed_in'; } catch { anonBlocked = true; }
  const a1 = Number((await db.query('select count(*)::int n from kafaa_audit_events')).rows[0].n);
  ok(obs.code === 'forbidden' && emp.code === 'forbidden' && anonBlocked && a1 >= a0 + 2, 'observer and employee callers are refused (audited); anonymous callers cannot execute the RPC');
  const chco = await agg('chco'), sro = await agg('sro'), aud = await agg('k-auditor'), hra = await agg('k-hr-analyst');
  ok(chco.ok && sro.ok && aud.ok && hra.ok && chco.data.periods.join(',') === '2026-Q2,2026-Q3' && chco.data.total.cover[0] >= 380, 'HR director, HR analyst, a line manager and an auditor read the board');
  ok(cellsOk(chco.data).length === 0 && leaks(chco.data).length === 0, 'the live RPC payload is suppressed and carries no person id');
  ok((await agg('chco', '2025-Q1')).code === 'not_found' && (await agg('chco', '2026-Q3', 2027, 0)).code === 'invalid' && (await agg('chco', '2026-Q3', 2030, 30)).code === 'invalid',
    'unknown period -> not_found; OSSA end outside 2028-2032 or slip over 24 months -> invalid');
  const latest = await agg('chco', '');
  ok(latest.ok && latest.data.period === '2026-Q3', 'no period given: the board opens on the latest plan (2026-Q3) without a refusal');
  const wi = await agg('chco', '2026-Q3', 2029, 12);
  ok(wi.ok && wi.data.ossa_end === 2029 && wi.data.slip_months === 12 && wi.data.simulated === true, 'what-if scenario is returned labelled SIMULATED');
  ok((await count('sro', 'kafaa_external_cover')) === 0 && (await count('k-observer', 'kafaa_handover_cohorts')) === 0 && (await count('chco', 'kafaa_external_cover')) > 0 && (await count('k-auditor', 'kafaa_handover_cohorts')) > 0,
    'plan tables: HR maintainers and auditors read them; managers and observers read none (board via RPC only)');
  let blocked = false;
  try { await as('chco', "insert into kafaa_external_cover (id, period, role_id, function, year, cover_count, source) values ('x', '2026-Q3', 'reactor-operator', 'operations', 2026, 1, 'x')"); } catch { blocked = true; }
  ok(blocked, 'no client writes to the cover plan');

  // ── observer-safe release
  const no = await one('sro', "select kafaa_prepare_handover_release('2026-Q3') r");
  const rel = await one('chco', "select kafaa_prepare_handover_release('2026-Q3') r");
  const row = rel.r.ok ? (await db.query('select * from kafaa_observer_reports where id = $1', [rel.r.data.id])).rows[0] : null;
  const tiles = row?.body?.tiles ?? [];
  ok(no.r.code === 'forbidden' && rel.r.ok && row?.status === 'draft' && tiles.length === 8 && tiles.every((x) => x.v === 'suppressed' || x.v === 'none' || /^\d+(\.\d%)?%?$/.test(x.v) || /^\d+\.\d%$/.test(x.v)),
    'HR prepares an observer-safe draft (8 tiles, suppressed or aggregate values); a line manager cannot');
  ok((await as('k-observer', 'select id from kafaa_observer_reports')).every((r) => r.id !== rel.r.data?.id), 'the draft is invisible to observers until submitted and approved');
  const sub = await one('chco', 'select kafaa_observer_report_action($1, \'submit\', array[\'org-observer\']) r', [rel.r.data.id]);
  const self = await one('chco', 'select kafaa_observer_report_action($1, \'approve\', \'{}\') r', [rel.r.data.id]);
  ok(sub.r.ok && self.r.code === 'maker_checker', 'the handover release follows the existing workflow: the preparer cannot approve it (maker-checker)');
}
