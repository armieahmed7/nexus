// [FS · wave A · E2 · FS03] PGlite checks for 20261010212001_kafaa_fs12_decay.sql: SQL = TS for every skill state (decay classes,
// half-lives, calibrated blend, Wilson band and interval), the half-life setting wired through setEngineWeights, the four acceptance
// criteria, the aggregate RPC (parity, RBAC, suppression), setSkillHalfLives (RBAC, checks, change log, ledger, recompute), the
// micro-credential evidence back-fill and RLS. Mutating checks run on a fresh database so later validators see the seeded state.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { decayModelFrom, deriveStates, gatherEvidence, makeDecayModel, RECORDED_KINDS } from '../../src/domain/skills.ts';
import { confidenceStats, FS03_MSG } from '../../src/modules/m17/decay.ts';

const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const num = (x) => (x == null ? x : Number(x));

export default async function fs12Checks({ count, ok }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const P = { 'k-admin': ['Admin'], 'training-mgr': ['Training Manager'], 'k-hr-analyst': ['HR analyst'], 'k-auditor': ['Auditor'], sro: ['Shift Manager · licensed SRO'], 'k-observer': ['Observer'] };
  const uid = {};
  let i = 700;
  for (const [persona, roles] of Object.entries(P)) {
    uid[persona] = `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
    await fresh.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing`, [uid[persona], `${persona}@fs12.test`, persona, persona === 'k-observer' ? 'org-observer' : 'enec-ops', persona === 'k-observer' ? 'partner' : 'employee', roles]);
  }
  const q = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const as = async (persona, sql, params = []) => {
    await fresh.exec('reset role');
    await fresh.query(`select set_config('request.jwt.claims', $1, false)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
    await fresh.exec(persona ? 'set role authenticated' : 'set role anon');
    try { return (await fresh.query(sql, params)).rows; } finally { await fresh.exec('reset role'); }
  };
  const one = async (persona, sql, params) => (await as(persona, sql, params))[0];
  const fails = async (persona, sql) => { try { await as(persona, sql); return false; } catch { return true; } };

  // TS inputs from the seeded database (so TS and SQL see exactly the same rows)
  const tables = {};
  for (const t of ['skills', 'competencies', 'role_competencies', 'qual_standards', 'qual_records', 'training_records', 'courses', 'attempts', 'assessment_forms', 'jpm_results', 'jpms', 'engine_settings']) {
    tables[t] = (await q(`select to_jsonb(x) j from kafaa_${t} x`)).map((r) => r.j);
  }
  for (const r of tables.qual_records) for (const k of ['qualified_on', 'expires_on', 'last_synced']) if (r[k]) r[k] = String(r[k]);
  const recorded = async () => (await q(`select id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on::text observed_on, active from kafaa_skill_evidence where active and (kind = any($1) or ref_table in ('fitness_attempts', 'adaptive_attempts', 'task_attempts'))` /* FS21/FS22 too */, [RECORDED_KINDS]) /* FS10: fitness-check rows are recorded */).map((r) => ({ ...r }));
  const tsStates = async (on, weights) => {
    const settings = (await q(`select id, weights from kafaa_engine_settings`)).map((r) => ({ id: r.id, weights: r.weights }));
    const model = weights ? makeDecayModel(weights, tables.skills) : decayModelFrom(settings, tables.skills);
    const derived = gatherEvidence(tables, { person: null, now: on });
    return deriveStates([...derived, ...(await recorded())], on, model);
  };
  const sqlStates = async (on, hl = null) => (await q(`select id, person_id, skill_id, level, confidence::float8 confidence, basis, reasons, evidence_count, confidence_band, conf_low::float8 conf_low, conf_high::float8 conf_high
    from kafaa_skill_states_v2(null, $1::date, $2::jsonb) order by id collate "C"`, [on, hl ? JSON.stringify(hl) : null]));
  const diffOf = (a, b) => {
    if (a.length !== b.length) return `count ${a.length} vs ${b.length}`;
    for (let k = 0; k < a.length; k++) {
      const x = a[k], y = b[k];
      for (const f of ['id', 'level', 'confidence', 'basis', 'evidence_count', 'confidence_band', 'conf_low', 'conf_high']) if (x[f] !== y[f]) return `${x.id} ${f}: ${x[f]} vs ${y[f]}`;
      if (!same(x.reasons, y.reasons)) return `${x.id} reasons`;
    }
    return null;
  };

  // ── parity: SQL v2 = TS deriveStates = the seeded rows (every person, every field, reasons with source/weight/half-life)
  const sql0 = await sqlStates(now);
  const ts0 = (await tsStates(now)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const d1 = diffOf(sql0, ts0);
  ok(d1 === null, `SQL kafaa_skill_states_v2 equals TS deriveStates for all ${sql0.length} states (bands, intervals, reasons)${d1 ? `; first diff ${d1}` : ''}`);
  const seedStates = T.person_skills.filter((s) => s.active).sort((a, b) => (a.id < b.id ? -1 : 1)).map((s) => ({ ...s, confidence: Number(s.confidence), conf_low: Number(s.conf_low), conf_high: Number(s.conf_high) }));
  const d2 = diffOf(sql0, seedStates);
  ok(d2 === null, `the seeded person_skills rows equal the SQL derivation (${seedStates.length} active states)${d2 ? `; first diff ${d2}` : ''}`);
  const legacy = await q(`select id, confidence::float8 c from kafaa_skill_states_compute(null, $1::date) order by id collate "C"`, [now]);
  ok(legacy.length === sql0.length && legacy.every((r, k) => r.id === sql0[k].id && r.c === sql0[k].confidence), 'the wave-0 kafaa_skill_states_compute (same signature) now returns the v2 states');

  // ── AC1: half_life_months changed through setEngineWeights changes confidence identically in TS and SQL
  const base = (await q(`select weights from kafaa_engine_settings where id = 'skills'`))[0].weights;
  const w24 = { ...base, half_life_months: 24 };
  const set24 = await one('k-admin', `select kafaa_set_engine_weights('skills', 'deterministic', $1::jsonb) r`, [JSON.stringify(w24)]);
  const sql24 = await sqlStates(now);
  const ts24 = (await tsStates(now)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const d3 = diffOf(sql24, ts24);
  const moved = sql24.filter((s, k) => s.confidence !== sql0[k]?.confidence).length;
  ok(set24.r.ok && d3 === null && moved > 50, `setEngineWeights half_life_months 36 -> 24: ${moved} confidences change, identically in TS and SQL${d3 ? `; first diff ${d3}` : ''}`);
  const hlStd = sql24.find((s) => s.reasons.some((r) => r.hl === 24));
  ok(!!hlStd, 'reasons carry the half-life that applied (24 months for standard-class evidence)');
  const bad = [
    await one('k-admin', `select kafaa_set_engine_weights('skills', 'deterministic', '{"half_life_months": 200}'::jsonb) r`),
    await one('k-admin', `select kafaa_set_engine_weights('skills', 'deterministic', '{"half_life_months": 24.5}'::jsonb) r`),
    await one('k-admin', `select kafaa_set_engine_weights('skills', 'deterministic', '{"half_life_fast": 40, "half_life_months": 36, "half_life_slow": 60}'::jsonb) r`),
    await one('k-admin', `select kafaa_set_engine_weights('recommend', 'deterministic', '{"half_life_fast": 18}'::jsonb) r`),
    await one('k-admin', `select kafaa_set_engine_weights('recommend', 'deterministic', '{"core": 99}'::jsonb) r`),
  ];
  ok(bad.every((b) => b.r.code === 'invalid') && bad[0].r.message === FS03_MSG.invalid_hl && bad[3].r.message === 'Weights must be numbers between 0 and 10',
    'half-lives must be whole months 6-120 with fast <= standard <= slow (skills surface only); other weights keep the 0-10 rule');
  const restore = await one('k-admin', `select kafaa_set_engine_weights('skills', 'deterministic', $1::jsonb) r`, [JSON.stringify(base)]);
  ok(restore.r.ok && diffOf(await sqlStates(now), sql0) === null, 'restoring 36 months restores every state');

  // ── AC2: a digital skill evidenced 30 months ago is less certain than a reactor-physics skill of the same age
  const ago = (await q(`select ($1::date - interval '30 months')::date::text d`, [now]))[0].d;
  await q(`insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active) values
    ('se:ojt:fs12-ac2:sk-da-01-analysis', 'p-k-observer', 'sk-da-01-analysis', 'ojt', 'fs12', 'fs12-ac2', 2, 'evidenced', 'current', $1::date, null, null, true),
    ('se:ojt:fs12-ac2:sk-pf-01-core', 'p-k-observer', 'sk-pf-01-core', 'ojt', 'fs12', 'fs12-ac2', 2, 'evidenced', 'current', $1::date, null, null, true)`, [ago]);
  const ac2 = Object.fromEntries((await q(`select skill_id, confidence::float8 c, confidence_band b, reasons from kafaa_skill_states_v2('p-k-observer', $1::date, null) where skill_id in ('sk-da-01-analysis', 'sk-pf-01-core')`, [now])).map((r) => [r.skill_id, r]));
  const cls = (await q(`select id, kafaa_skill_decay_class(area, null) c from kafaa_skills where id in ('sk-da-01-analysis', 'sk-pf-01-core')`)).map((r) => `${r.id}:${r.c}`).sort().join(' ');
  ok(ac2['sk-da-01-analysis'].c < ac2['sk-pf-01-core'].c && ac2['sk-da-01-analysis'].reasons[0].hl === 18 && ac2['sk-pf-01-core'].reasons[0].hl === 60,
    `same 30-month-old evidence: digital ${ac2['sk-da-01-analysis'].c} (${ac2['sk-da-01-analysis'].b}, fast 18 months) < reactor physics ${ac2['sk-pf-01-core'].c} (${ac2['sk-pf-01-core'].b}, slow 60 months) [${cls}]`);
  await q(`update kafaa_skill_evidence set active = false where ref_id = 'fs12-ac2'`);

  // ── AC3: every person skill carries a band, and the interval contains the confidence
  const bands = await q(`select count(*)::int n, count(*) filter (where confidence_band in ('low', 'medium', 'high') and conf_low <= confidence and confidence <= conf_high and conf_high <= 0.99)::int good,
    count(distinct confidence_band)::int kinds from kafaa_person_skills where active`);
  ok(bands[0].n > 1500 && bands[0].good === bands[0].n && bands[0].kinds === 3, `every active person skill carries a band (low, medium and high all present) and conf_low <= confidence <= conf_high (${bands[0].n} states)`);
  let check = false;
  try { await q(`update kafaa_person_skills set confidence_band = 'certain' where id = (select id from kafaa_person_skills limit 1)`); } catch { check = true; }
  ok(check, 'the band column only takes low, medium or high');

  // ── AC4: seeded awards produce credential evidence rows; the back-fill is idempotent and recompute leaves the seed unchanged
  const aw = await q(`select a.id, a.status, (select count(*)::int from kafaa_mc_aligned(d.alignment)) n,
      (select count(*)::int from kafaa_skill_evidence e where e.ref_table = 'microcred_awards' and e.ref_id = a.id) ev,
      (select count(*)::int from kafaa_skill_evidence e where e.ref_table = 'microcred_awards' and e.ref_id = a.id and e.active) act
    from kafaa_microcred_awards a join kafaa_microcred_defs d on d.id = a.def_id where a.status in ('awarded', 'superseded', 'revoked') and a.issued_on is not null`);
  ok(aw.length > 90 && aw.every((a) => a.ev === a.n && a.act === (a.status === 'awarded' ? a.n : 0)),
    `every seeded micro-credential award (${aw.length}) has one credential evidence row per aligned skill; active only while awarded`);
  ok((await q(`select kafaa_fs03_backfill_award_evidence() n`))[0].n === 0, 'the back-fill finds nothing left to add on the seed (idempotent)');
  const snap = async () => (await q(`select md5(string_agg(id || level || confidence || basis || reasons::text || evidence_count || active || confidence_band || conf_low || conf_high, ',' order by id collate "C")) h from kafaa_person_skills`))[0].h;
  const s0 = await snap();
  const ap1 = (await q(`select kafaa_skills_apply(null, $1::date) r`, [now]))[0].r;
  const s1 = await snap();
  const ap2 = (await q(`select kafaa_skills_apply(null, $1::date) r`, [now]))[0].r;
  const s2 = await snap();
  ok(s0 === s1 && s1 === s2 && ap1.digest === ap2.digest, `recompute on the seed changes no row and is idempotent (digest ${String(ap1.digest).slice(0, 12)}…)`);

  // ── aggregate RPC: RBAC and SQL = TS (with a what-if preview)
  const okStats = [];
  for (const p of ['k-admin', 'training-mgr', 'k-hr-analyst', 'k-auditor']) okStats.push(!(await fails(p, `select kafaa_skill_confidence_stats(null) r`)));
  ok(okStats.every(Boolean) && (await fails('sro', `select kafaa_skill_confidence_stats(null)`)) && (await fails(null, `select kafaa_skill_confidence_stats(null)`)) && (await fails('k-observer', `select kafaa_skill_confidence_stats(null)`)),
    'confidence statistics: admins, auditors, the training manager and HR read them; managers, observers and anonymous visitors are refused');
  const pw = { half_life_fast: 12 };
  const sqlStats = (await q(`select kafaa_fs03_stats($1::jsonb, $2::date) r`, [JSON.stringify(pw), now]))[0].r;
  const st = await q(`select id, person_id, skill_id, level, confidence_band, reasons, active from kafaa_person_skills`);
  const awards = await q(`select id, status, issued_on::text issued_on from kafaa_microcred_awards`);
  const evid = await q(`select ref_table, ref_id from kafaa_skill_evidence where ref_table = 'microcred_awards'`);
  const changes = await q(`select id, surface, changed_at::text changed_at, weights_before, weights_after, rationale from kafaa_engine_changes`);
  const curW = (await q(`select weights from kafaa_engine_settings where id = 'skills'`))[0].weights;
  const tsStats = confidenceStats({
    states: st, skills: tables.skills, awards, evidence: evid, changes, weights: curW, today: now,
    preview: { weights: pw, now: await tsStates(now), next: await tsStates(now, { ...curW, ...pw }) },
  });
  const strip = (x) => ({ ...x, last_change: x.last_change ? x.last_change.id : null });
  ok(same(strip(sqlStats), strip(tsStats)), `SQL kafaa_fs03_stats equals TS confidenceStats, preview included (${sqlStats.preview?.changed ?? 'suppressed'} states change band with a 12-month fast half-life)`);
  const cells = [...sqlStats.by_class, ...sqlStats.by_area, ...sqlStats.preview.transitions];
  ok(cells.some((c) => c.suppressed && c.states === null) && cells.every((c) => (c.suppressed ? c.states === null : c.states >= 1)), 'cells naming fewer than 10 people are null and flagged suppressed');
  ok(sqlStats.backfill.awards === sqlStats.backfill.with_evidence && sqlStats.backfill.evidence_rows > 100, `back-fill status: ${sqlStats.backfill.with_evidence} of ${sqlStats.backfill.awards} awards carry evidence (${sqlStats.backfill.evidence_rows} rows)`);

  // ── setSkillHalfLives: RBAC, checks, no-change, change log, cards, ledger, recompute
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const ch0 = (await q(`select count(*)::int n from kafaa_engine_changes where surface = 'skills'`))[0].n;
  const card0 = (await q(`select coalesce(sum(version), 0)::int v from kafaa_engine_cards where engine_surface = 'skills'`))[0].v;
  const hlr = (p, body) => one(p, `select kafaa_set_skill_half_lives($1::jsonb) r`, [JSON.stringify(body)]);
  const why = 'Digital tools at the plant now change within a year';
  const tm = await hlr('training-mgr', { fast: 12, standard: 36, slow: 60, rationale: why });
  const anon = await fails(null, `select kafaa_set_skill_half_lives('{}'::jsonb)`);
  const inv = [await hlr('k-admin', { fast: 5, standard: 36, slow: 60, rationale: why }), await hlr('k-admin', { fast: 12.5, standard: 36, slow: 60, rationale: why }),
    await hlr('k-admin', { fast: 40, standard: 36, slow: 60, rationale: why }), await hlr('k-admin', { fast: 12, standard: 36, slow: 121, rationale: why }), await hlr('k-admin', { fast: 12, standard: 36, slow: 60, rationale: 'short' })];
  const same0 = await hlr('k-admin', { fast: 18, standard: 36, slow: 60, rationale: why });
  ok(tm.r.code === 'forbidden' && anon && inv.slice(0, 4).every((x) => x.r.code === 'invalid' && x.r.message === FS03_MSG.invalid_hl) && inv[4].r.message === FS03_MSG.invalid_why && same0.r.code === 'no_change',
    'setSkillHalfLives: platform admins only; whole months 6-120, fast <= standard <= slow, a 10-500 character rationale; no change refused');
  const done = await hlr('k-admin', { fast: 12, standard: 36, slow: 60, rationale: why });
  const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const ch1 = await q(`select id, weights_after, rationale from kafaa_engine_changes where surface = 'skills' order by changed_at desc, id desc limit 1`);
  const card1 = (await q(`select coalesce(sum(version), 0)::int v from kafaa_engine_cards where engine_surface = 'skills'`))[0].v;
  const cardsN = (await q(`select count(*)::int n from kafaa_engine_cards where engine_surface = 'skills'`))[0].n;
  const after = await q(`select id, confidence::float8 confidence, level, confidence_band from kafaa_person_skills where active order by id collate "C"`);
  const want = (await tsStates(new Date().toISOString().slice(0, 10))).sort((a, b) => (a.id < b.id ? -1 : 1));
  ok(done.r.ok && done.r.message === FS03_MSG.saved && done.r.data.moved > 0 && ch1[0]?.weights_after?.half_life_fast === 12 && ch1[0].weights_after.half_life_months === 36 && ch1[0].rationale === why
    && (await q(`select count(*)::int n from kafaa_engine_changes where surface = 'skills'`))[0].n === ch0 + 1 && card1 === card0 + cardsN && led1 === led0 + 1,
    `setSkillHalfLives: logged as ${ch1[0]?.id} (cards versioned, ledger row), every state recomputed (${done.r.data.moved} moved, ${done.r.data.level_down} lost a level)`);
  ok(after.length === want.length && after.every((r, k) => r.id === want[k].id && r.confidence === want[k].confidence && r.confidence_band === want[k].confidence_band && r.level === want[k].level),
    'after the change the stored states equal TS deriveStates with the new fast half-life');
  const aud = await q(`select action, outcome, ledger_status from kafaa_audit_events where action in ('engine.settings', 'skills.half_lives') order by seq desc limit 1`);
  ok(aud[0]?.action === 'engine.settings' && aud[0].outcome === 'ok' && aud[0].ledger_status !== 'not_applicable', 'the change is audited (engine.settings) with its ledger status');

  // ── RLS and grants
  ok((await count(null, 'kafaa_skill_decay_classes')) === 3, 'the three decay classes are public reference rows');
  ok(await fails('k-admin', `insert into kafaa_skill_decay_classes (id, name_en, name_ar, summary_en, summary_ar, default_months, as_of) values ('x', 'x', 'x', 'x', 'x', 1, current_date)`), 'decay classes cannot be written through the API');
  const internal = await Promise.all(['kafaa_skill_states_v2(null, current_date, null)', 'kafaa_fs03_stats(null, current_date)', 'kafaa_fs03_backfill_award_evidence()', 'kafaa_skill_hl_months(null)']
    .map((f) => fails('k-admin', `select * from ${f}`)));
  ok(internal.every(Boolean), 'the internal FS03 functions are not executable by API roles');
  await fresh.close();
}
