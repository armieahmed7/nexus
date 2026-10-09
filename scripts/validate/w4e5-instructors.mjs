// [W4 · E5 · F31] PGlite checks for 20261009145001_kafaa_w4e5_instructors.sql: RLS on the instructor tables, SQL = TS parity (checklist
// scoring, input validation, observation sets, stages, annual currency, session hours, standard skills) on every seeded track, and the RPC
// flows with the card's acceptance criteria (qualification needs two co-teach and one solo observation by different observers; currency
// lapses when the 12-month hours fall short and a notice goes out at 30 days; an observer cannot observe themselves; maker-checker).
import { readFileSync } from 'node:fs';
import {
  INSMSG, OBS_KEYS, coTeachPair, currencyView, deriveStage, qualifyingSet, reinstateObservation, scoreObservation, sessionHours, standardSkills, validateHours,
  validateNomination, validateObservation, addMonths, addDays,
} from '../../src/modules/m02/instructors.ts';

export default async function w4e5Checks({ db, as, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 4500;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['sq-lead', 'Supplier Quality Lead'], ['head-sq', 'Head of Supplier Quality'], ['ep-manager', 'EP Manager'],
    ['rp-lead', 'RP Lead'], ['sme-reviewer', 'SME reviewer'], ['qc-inspector', 'QC Receiving Inspector']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W4E5 · F31 instructor and SME pipeline');
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  const today = (await q('select current_date::text as d'))[0].d;
  const rpc = async (persona, fn, args) => (await as(persona, `select ${fn} as r`, args))[0].r;
  const rows = async (table, where = 'true') => (await q(`select to_jsonb(x) j from ${table} x where ${where}`)).map((r) => r.j);
  const dstr = (v) => (typeof v === 'string' ? v.slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : v);
  const tracksNow = async () => (await rows('kafaa_instructor_tracks')).map((t) => ({ ...t, accepted_on: dstr(t.accepted_on), initial_done_on: dstr(t.initial_done_on), qualified_on: dstr(t.qualified_on), lapsed_on: dstr(t.lapsed_on), currency_due: dstr(t.currency_due) }));
  const obsNow = async () => (await rows('kafaa_instructor_observations')).map((o) => ({ ...o, observed_on: dstr(o.observed_on) }));
  const hoursNow = async () => (await rows('kafaa_teaching_hours')).map((h) => ({ ...h, delivered_on: dstr(h.delivered_on), hours: Number(h.hours) }));

  // ── RLS
  const tabs = ['kafaa_instructor_tracks', 'kafaa_instructor_observations', 'kafaa_teaching_hours'];
  ok((await Promise.all(tabs.map((t) => count(null, t)))).every((c) => c === 0), 'anonymous visitors read no instructor rows');
  ok((await count('k-ro', 'kafaa_instructor_tracks')) === 0 && (await count('k-ro', 'kafaa_teaching_hours')) === 0, 'an employee without a track reads no instructor rows');
  ok((await count('sme-reviewer', 'kafaa_instructor_tracks')) === 1 && (await count('sme-reviewer', 'kafaa_instructor_observations', `person_id <> 'p-sme-reviewer'`)) === 0
    && (await count('sme-reviewer', 'kafaa_instructor_observations')) === T.instructor_observations.filter((o) => o.person_id === 'p-sme-reviewer').length, 'a candidate reads their own track and observations only');
  ok((await count('training-mgr', 'kafaa_instructor_tracks')) === T.instructor_tracks.length && (await count('k-auditor', 'kafaa_instructor_observations')) === T.instructor_observations.length
    && (await count('sq-lead', 'kafaa_teaching_hours')) === T.teaching_hours.length, 'instructors, the training manager and auditors read the whole pool (sat R/W/A)');
  ok((await count('k-hr-analyst', 'kafaa_instructor_tracks')) === 0, 'HR analysts (qual_records Own/Agg) read no other person\'s track');
  let direct = false;
  try { await as('training-mgr', `insert into kafaa_teaching_hours (id, person_id, kind, delivered_on, hours) values ('x', 'p-k-instructor', 'cpd', current_date, 1)`); } catch { direct = true; }
  let direct2 = false;
  try { await as('training-mgr', `update kafaa_instructor_tracks set status = 'qualified' where id = 'it-w-ro-02'`); direct2 = (await q(`select status from kafaa_instructor_tracks where id = 'it-w-ro-02'`))[0].status === 'active'; } catch { direct2 = true; }
  ok(direct && direct2, 'instructor tables cannot be written directly (RPC only)');
  let appendOnly = false;
  try { await db.query(`update kafaa_instructor_observations set score = 100 where id = 'io-w-ro-02-1'`); } catch { appendOnly = true; }
  ok(appendOnly, 'observations are append-only (update refused by trigger, even for the owner)');

  // ── parity: scoring and validation
  const pat = (r) => OBS_KEYS.map((k, i) => ({ key: k, rating: r[i % r.length] }));
  const itemSets = [pat(['met']), pat(['partly']), pat(['not_met']), pat(['met', 'partly']), pat(['met', 'met', 'met', 'partly', 'not_met']), pat(['partly', 'met', 'met', 'met']),
    OBS_KEYS.map((k) => ({ key: k, rating: k === 'safety' ? 'not_met' : 'met' })), OBS_KEYS.map((k) => ({ key: k, rating: k === 'oe' ? 'not_met' : 'met' })), OBS_KEYS.map((k, i) => ({ key: k, rating: i < 6 ? 'met' : 'not_met' }))];
  let sd = 0;
  for (const it of itemSets) if (canon((await q('select kafaa_ins_score($1::jsonb) s', [JSON.stringify(it)]))[0].s) !== canon(scoreObservation(it))) sd++;
  ok(sd === 0, `checklist scoring: SQL = TS for ${itemSets.length} rating patterns (critical items fail the observation)`);
  const ob = { track_id: 'x', kind: 'co_teach', observed_on: today, items: pat(['met']), note: 'ok' };
  const obsIn = [ob, { ...ob, kind: 'mentor' }, { ...ob, kind: 3 }, { ...ob, items: pat(['met']).slice(0, 7) }, { ...ob, items: [...pat(['met']).slice(0, 7), { key: 'time', rating: 'great' }] },
    { ...ob, items: [...pat(['met']).slice(0, 7), { key: 'objectives', rating: 'met' }] }, { ...ob, items: [...pat(['met']).slice(0, 7), ['time', 'met']] }, { ...ob, observed_on: addDays(today, 1) },
    { ...ob, observed_on: addMonths(today, -25) }, { ...ob, observed_on: '2026-02-30' }, { ...ob, note: 'x'.repeat(601) }, { ...ob, note: null }, { ...ob, note: 5 }, { ...ob, items: 'all met' }];
  let vd = 0;
  for (const p of obsIn) if (canon((await q('select kafaa_ins_validate_obs($1::jsonb, current_date) v', [JSON.stringify(p)]))[0].v) !== canon(validateObservation(p, today))) vd++;
  ok(vd === 0, `observation validation: SQL = TS for ${obsIn.length} inputs`);
  const nb = { person_id: 'p-k-ro', route: 'sme', standard_ids: ['qs-ro'], skill_ids: ['sk-pf-03-rcs'], motivation: 'I like teaching' };
  const nomIn = [nb, { ...nb, route: 'guest' }, { ...nb, standard_ids: [] }, { ...nb, standard_ids: ['qs-ro', 'qs-sro', 'qs-wc', 'qs-get'] }, { ...nb, standard_ids: ['qs-ro', 'qs-ro'] },
    { ...nb, standard_ids: ['qs-sec'] }, { ...nb, standard_ids: ['nope'] }, { ...nb, skill_ids: null }, { ...nb, skill_ids: ['nope'] }, { ...nb, skill_ids: ['sk-sa-01'] },
    { ...nb, skill_ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, { ...nb, motivation: 'x'.repeat(601) }, { ...nb, motivation: 7 }, { ...nb, standard_ids: [1] }];
  const stds = await rows('kafaa_qual_standards');
  const skills = await rows('kafaa_skills');
  let nd = 0;
  for (const p of nomIn) if (canon((await q('select kafaa_ins_validate_nom($1::jsonb) v', [JSON.stringify(p)]))[0].v) !== canon(validateNomination(p, stds, skills))) nd++;
  ok(nd === 0, `nomination validation: SQL = TS for ${nomIn.length} inputs (security standards and skills refused)`);
  const hb = { person_id: 'p-k-instructor', kind: 'cpd', hours: 2.5, delivered_on: today, note: 'workshop' };
  const hrsIn = [hb, { ...hb, kind: 'teaching' }, { ...hb, hours: 0 }, { ...hb, hours: 0.3 }, { ...hb, hours: 12.5 }, { ...hb, hours: '2' }, { ...hb, delivered_on: addDays(today, 1) },
    { ...hb, delivered_on: addMonths(today, -13) }, { ...hb, note: 'x'.repeat(601) }, { ...hb, hours: 12 }];
  let hd = 0;
  for (const p of hrsIn) if (canon((await q('select kafaa_ins_validate_hours($1::jsonb, current_date) v', [JSON.stringify(p)]))[0].v) !== canon(validateHours(p, today))) hd++;
  ok(hd === 0, `hours validation: SQL = TS for ${hrsIn.length} inputs`);
  let kd = 0;
  for (const s of T.qual_standards) if (canon((await q('select kafaa_ins_std_skills($1::text[]) k', [[s.id]]))[0].k) !== canon(standardSkills([s.id], skills))) kd++;
  ok(kd === 0, `standard skills: SQL = TS for all ${T.qual_standards.length} standards (security never)`);
  const pairs = [['2026-10-01T08:00:00Z', '2026-10-01T16:00:00Z'], ['2026-10-01T08:00:00Z', '2026-10-01T09:20:00Z'], ['2026-10-01T08:00:00Z', '2026-10-02T09:00:00Z'], ['2026-10-01T08:00:00Z', '2026-10-01T07:00:00Z']];
  let shd = 0;
  for (const [a, b] of pairs) if (Number((await q('select kafaa_ins_session_hours($1::timestamptz, $2::timestamptz) h', [a, b]))[0].h) !== sessionHours(a, b)) shd++;
  ok(shd === 0, 'session teaching hours (half-hour rounding, 12 h cap): SQL = TS');

  // ── parity on every seeded track: observation sets, stages and currency at several dates
  const trs = await tracksNow();
  const allObs = await obsNow();
  const allHours = await hoursNow();
  let pd = 0;
  let stg = 0;
  for (const t of trs) {
    const o = allObs.filter((x) => x.track_id === t.id);
    const sp = (await q('select kafaa_ins_co_pair($1, null) p, kafaa_ins_qual_set($1, null) s, kafaa_ins_qual_set($1, $2) sx, kafaa_ins_reinstate_obs($1, $3::date, null) r', [t.id, 'p-training-mgr', t.lapsed_on ?? null]))[0];
    const tp = coTeachPair(o)?.map((x) => x.id) ?? null;
    const ts = qualifyingSet(o);
    const tsx = qualifyingSet(o, 'p-training-mgr');
    const tsC = ts ? { co: ts.co.map((x) => x.id), solo: ts.solo.id } : null;
    const tsxC = tsx ? { co: tsx.co.map((x) => x.id), solo: tsx.solo.id } : null;
    if (canon(sp.p) !== canon(tp) || canon(sp.s) !== canon(tsC) || canon(sp.sx) !== canon(tsxC) || (sp.r ?? null) !== (reinstateObservation(o, t.lapsed_on)?.id ?? null)) { pd++; if (pd === 1) console.log('    set diff', t.id, canon(sp), canon(tp), canon(tsC)); }
    const sqlStage = (await q('select kafaa_ins_stage($1, $2::date) s', [t.id, t.initial_done_on]))[0].s;
    if (sqlStage !== deriveStage(t, o, t.initial_done_on) || (t.status === 'active' && t.stage !== sqlStage)) { stg++; if (stg === 1) console.log('    stage diff', t.id, sqlStage, t.stage); }
  }
  ok(pd === 0, `observation sets (co-teach pair, qualifying set, with the training manager excluded, reinstatement): SQL = TS for all ${trs.length} tracks`);
  ok(stg === 0, `stages: SQL = TS and every seeded open track carries its derived stage (${trs.filter((t) => t.status === 'active').length} active)`);
  let cd = 0;
  const offsets = [0, 17, 30, 75, 200, 400, 800];
  const qual = trs.filter((t) => t.status === 'qualified' || t.status === 'lapsed');
  for (const t of qual)
    for (const off of offsets) {
      const d = addDays(today, off);
      const s = (await q('select kafaa_ins_currency($1, $2::date) c', [t.id, d]))[0].c;
      const ts = currencyView(t, allHours.filter((h) => h.person_id === t.person_id), d);
      if (canon(s) !== canon(ts)) { cd++; if (cd === 1) console.log('    currency diff', t.id, d, canon(s), canon(ts)); }
    }
  ok(cd === 0, `annual currency: SQL = TS for ${qual.length} instructors x ${offsets.length} dates`);
  ok(qual.filter((t) => t.status === 'qualified').every((t) => currencyView(t, allHours.filter((h) => h.person_id === t.person_id), today)?.status !== undefined), 'every seeded qualified instructor has a currency view');

  // ── RPC flows
  await db.query(`update kafaa_licences set expires_on = greatest(expires_on, current_date + 365) where person_id in ('p-sro', 'w-sro-03')`);
  const r1 = await rpc('k-ro', 'kafaa_nominate_instructor($1::jsonb)', [JSON.stringify({ person_id: 'w-lo-07', route: 'sme', standard_ids: ['qs-lo-aux'] })]);
  ok(!r1.ok && r1.code === 'forbidden' && r1.message === INSMSG.nominate_forbidden, 'an employee cannot nominate a colleague (forbidden, audited)');
  const r2 = await rpc('k-ro', 'kafaa_nominate_instructor($1::jsonb)', [JSON.stringify({ person_id: 'p-k-ro', route: 'sme', standard_ids: ['qs-sec'] })]);
  const r3 = await rpc('k-ro', 'kafaa_nominate_instructor($1::jsonb)', [JSON.stringify({ person_id: 'p-k-ro', route: 'asip', standard_ids: ['qs-ro'] })]);
  ok(r2.code === 'security_restricted' && r3.code === 'not_eligible', 'security standards are refused; the ASIP route needs a valid SRO licence (mirror)');
  const r4 = await rpc('k-ro', 'kafaa_nominate_instructor($1::jsonb)', [JSON.stringify({ person_id: 'p-k-ro', route: 'sme', standard_ids: ['qs-ro'], motivation: 'I explain the RCS well' })]);
  const r4b = await rpc('k-ro', 'kafaa_nominate_instructor($1::jsonb)', [JSON.stringify({ person_id: 'p-k-ro', route: 'sme', standard_ids: ['qs-ro'] })]);
  const k4 = (await q('select * from kafaa_instructor_tracks where id = $1', [r4.data?.id]))[0];
  if (!(r4.ok && r4b.code === 'already_active')) console.log('    nominate debug', JSON.stringify(r4), JSON.stringify(r4b), JSON.stringify(await q(`select id, kind, status, job_family_id from kafaa_people where id = 'p-k-ro'`)));
  ok(r4.ok && k4?.stage === 'nominated' && k4.nomination_kind === 'self' && canon(k4.skill_ids) === canon(standardSkills(['qs-ro'], skills).slice(0, 6)) && r4b.code === 'already_active',
    'a staff member volunteers (self-nomination, skills from the standard); a second open track is refused');
  const nTm = (await q(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-ins-${r4.data?.id}-tm-p-training-mgr`]))[0].n;
  ok(nTm === 1, 'the training manager is notified of the nomination');
  const r5 = await rpc('training-mgr', 'kafaa_decide_instructor_nomination($1, $2, $3)', [r4.data.id, 'decline', 'no']);
  const r6 = await rpc('training-mgr', 'kafaa_decide_instructor_nomination($1, $2, $3)', [r4.data.id, 'accept', null]);
  const enr = (await q(`select status, course_id from kafaa_enrolments where id = $1`, [`en-ins-${r4.data.id}`]))[0];
  ok(r5.code === 'invalid' && r6.ok && r6.data.stage === 'initial_training' && enr?.status === 'assigned' && enr.course_id === 'c-instr', 'accepting assigns the initial course (INSTR-101); a decline needs a reason');
  const tid = r4.data.id;
  const obsP = (kind, rating = 'met', on = today) => JSON.stringify({ track_id: tid, kind, observed_on: on, items: OBS_KEYS.map((k) => ({ key: k, rating })), note: 'Observed delivery' });
  const r7 = await rpc('k-instructor', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('co_teach')]);
  ok(r7.code === 'wrong_stage' && r7.message === INSMSG.needs_initial, 'co-teach observations wait for the initial training course');
  await db.query(`insert into kafaa_training_records (id, person_id, course_id, completed_on, hours, result) values ('tr-w4e5-kro', 'p-k-ro', 'c-instr', current_date - 2, 80, 'passed') on conflict do nothing`);
  const c1 = await rpc('k-instructor', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('co_teach')]);
  const c2 = await rpc('k-instructor', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('co_teach')]);
  const s0 = await rpc('sq-lead', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('solo')]);
  ok(c1.ok && c2.ok && c2.data.stage === 'co_teach' && s0.code === 'wrong_stage' && s0.message === INSMSG.needs_co_teach, 'two co-teach passes by the same observer do not count: the solo still waits for a second observer');
  const cf = await rpc('sq-lead', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('co_teach', 'not_met')]);
  const c3 = await rpc('sq-lead', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('co_teach', 'partly')]);
  const c4 = await rpc('sq-lead', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('co_teach')]);
  ok(cf.ok && cf.data.result === 'fail' && c3.data.result === 'fail' && c4.ok && c4.data.stage === 'solo', 'failed co-teach observations do not count; two passes by different observers open the solo');
  const s1 = await rpc('k-instructor', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('solo')]);
  const q0 = await rpc('training-mgr', 'kafaa_qualify_instructor($1, $2)', [tid, null]);
  ok(s1.ok && s1.data.stage === 'solo' && q0.code === 'not_ready' && q0.message === INSMSG.not_ready, 'a solo by one of the co-teach observers does not complete the set: qualification is refused (not_ready)');
  const s2 = await rpc('ep-manager', 'kafaa_record_instructor_observation($1::jsonb)', [obsP('solo')]);
  const qOk = await rpc('training-mgr', 'kafaa_qualify_instructor($1, $2)', [tid, 'Panel agreed']);
  const k5 = (await q('select * from kafaa_instructor_tracks where id = $1', [tid]))[0];
  const eq = await q(`select valid_to::text v from kafaa_evaluator_quals where id = 'eq-ins-p-k-ro-qs-ro'`);
  const ev = (await q(`select status, level from kafaa_skill_evidence where id = $1`, [`se:credential:${tid}:sk-ld-01-instruct`]))[0];
  const ps = (await q(`select level from kafaa_person_skills where id = 'ps:p-k-ro:sk-ld-01-instruct' and active`))[0];
  ok(s2.ok && s2.data.stage === 'ready' && qOk.ok && qOk.ledger_seq !== undefined && k5.status === 'qualified' && dstr(k5.currency_due) === addMonths(today, 12) && eq[0]?.v === addMonths(today, 12)
    && ev?.status === 'current' && ev.level === 3 && ps?.level >= 3,
    'two co-teach and one solo by three different observers: the training manager qualifies; evaluator_quals and F01 credential evidence are written');
  const self = await rpc('ep-manager', 'kafaa_record_instructor_observation($1::jsonb)', [JSON.stringify({ track_id: 'it-p-ep-manager', kind: 'currency', observed_on: today, items: OBS_KEYS.map((k) => ({ key: k, rating: 'met' })) })]);
  const audSelf = (await q(`select count(*)::int n from kafaa_audit_events where action = 'instructor.observe' and outcome = 'refused' and reason like 'self_observation:%'`))[0].n;
  ok(self.code === 'self_observation' && self.message === INSMSG.self_observation && audSelf >= 1, 'an observer cannot observe themselves (refused and audited)');
  const mc = await rpc('training-mgr', 'kafaa_qualify_instructor($1, $2)', ['it-w-rp-02', null]);
  ok(mc.code === 'maker_checker', 'the training manager cannot qualify a candidate they observed when no other qualifying set exists (maker-checker)');
  const own = await rpc('training-mgr', 'kafaa_decide_instructor_nomination($1, $2, $3)', ['it-p-training-mgr', 'accept', null]);
  const notTm = await rpc('k-instructor', 'kafaa_qualify_instructor($1, $2)', ['it-w-ro-02', null]);
  ok(own.code === 'maker_checker' && notTm.code === 'forbidden', 'nobody decides their own track; only the training manager qualifies');

  // currency: lapse after a short 12-month window, 30-day notice
  await db.query(`update kafaa_instructor_tracks set qualified_on = (current_date - interval '13 months')::date, currency_due = (current_date - interval '1 month')::date, currency_status = 'current' where id = 'it-w-instr-02'`);
  await db.query(`update kafaa_instructor_tracks set qualified_on = ((current_date + 20) - interval '12 months')::date, currency_due = current_date + 20, currency_status = 'current' where id = 'it-p-sq-lead'`);
  await db.query(`update kafaa_instructor_tracks set qualified_on = ((current_date + 20) - interval '12 months')::date, currency_due = current_date + 20, currency_status = 'current' where id = 'it-w-chem-01'`);
  await db.query(`insert into kafaa_teaching_hours (id, person_id, track_id, kind, delivered_on, hours) select 'th-w4e5-chem-' || k || '-' || g, 'w-chem-01', 'it-w-chem-01', k, current_date - g, 6 from generate_series(1, 9) g, (values ('delivery'), ('cpd')) v(k) on conflict do nothing`);
  const before = await tracksNow();
  const hrs2 = await hoursNow();
  const exp = Object.fromEntries(['it-w-instr-02', 'it-p-sq-lead', 'it-w-chem-01'].map((id) => [id, currencyView(before.find((t) => t.id === id), hrs2.filter((h) => h.person_id === before.find((t) => t.id === id).person_id), today)]));
  const sw = await rpc('training-mgr', 'kafaa_instructor_currency_sweep()', []);
  const after = await tracksNow();
  const lap = after.find((t) => t.id === 'it-w-instr-02');
  const eqLap = await q(`select valid_to::text v from kafaa_evaluator_quals where id like 'eq-ins-w-instr-02-%'`);
  const nLap = (await q(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-ins-it-w-instr-02-lapsed-${exp['it-w-instr-02'].lapsed_on}`]))[0].n;
  ok(sw.ok && exp['it-w-instr-02'].status === 'lapsed' && lap.status === 'lapsed' && lap.lapsed_on === exp['it-w-instr-02'].lapsed_on && eqLap.length > 0 && eqLap.every((r) => r.v <= lap.lapsed_on) && nLap === 1,
    'an instructor whose 12-month window ended under 40 delivery hours lapses on the window end; evaluator rows end on that date; the person is notified');
  const n30 = (await q(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-ins-it-p-sq-lead-${addDays(today, 20)}-30`]))[0].n;
  const n30ok = (await q(`select count(*)::int n from kafaa_notifications where id like 'nt-ins-it-w-chem-01-%'`))[0].n;
  if (!(exp['it-p-sq-lead'].notice === 30 && n30 === 1 && exp['it-w-chem-01'].met && n30ok === 0)) console.log('    notice debug', JSON.stringify(exp), n30, n30ok, JSON.stringify(await q(`select id from kafaa_notifications where id like 'nt-ins-it-p-sq-lead%'`)));
  ok(exp['it-p-sq-lead'].notice === 30 && n30 === 1 && after.find((t) => t.id === 'it-p-sq-lead').currency_status === 'at_risk' && exp['it-w-chem-01'].met && n30ok === 0,
    'a notice is sent 30 days before the currency date when the hours are short (none when they are met)');
  const sw2 = await rpc('training-mgr', 'kafaa_instructor_currency_sweep()', []);
  ok(sw2.ok && sw2.data.lapsed === 0 && sw2.data.notices === 0, 'the sweep is idempotent (no second lapse or notice)');
  const reinst0 = await rpc('training-mgr', 'kafaa_qualify_instructor($1, $2)', ['it-w-instr-02', null]);
  const cur = await rpc('k-instructor', 'kafaa_record_instructor_observation($1::jsonb)', [JSON.stringify({ track_id: 'it-w-instr-02', kind: 'currency', observed_on: today, items: OBS_KEYS.map((k) => ({ key: k, rating: 'met' })) })]);
  const reinst = await rpc('training-mgr', 'kafaa_qualify_instructor($1, $2)', ['it-w-instr-02', 'Currency observation passed']);
  ok(reinst0.code === 'not_ready' && cur.ok && reinst.ok && reinst.data.reinstated === true, 'a lapsed instructor is reinstated after a passed currency observation by another observer');

  // hours log and session sync
  const h1 = await rpc('k-instructor', 'kafaa_log_teaching_hours($1::jsonb)', [JSON.stringify({ person_id: 'p-k-instructor', kind: 'cpd', hours: 3.5, delivered_on: today, note: 'SAT refresher' })]);
  const h2 = await rpc('k-instructor', 'kafaa_log_teaching_hours($1::jsonb)', [JSON.stringify({ person_id: 'p-k-instructor', kind: 'delivery', hours: 3.5, delivered_on: today })]);
  const h3 = await rpc('training-mgr', 'kafaa_log_teaching_hours($1::jsonb)', [JSON.stringify({ person_id: 'w-instr-01', kind: 'delivery', hours: 0.3, delivered_on: today })]);
  const h4 = await rpc('training-mgr', 'kafaa_log_teaching_hours($1::jsonb)', [JSON.stringify({ person_id: 'p-k-lo-trainee', kind: 'delivery', hours: 2, delivered_on: today })]);
  ok(h1.ok && h2.code === 'forbidden' && h3.code === 'invalid' && h4.code === 'not_found', 'instructors log their own development; delivery hours are the training manager\'s; invalid amounts and people off the track are refused');
  await db.query(`insert into kafaa_sessions (id, course_id, starts_at, ends_at, location, instructor_person_id, capacity, kind, status) values ('s-w4e5-past', 'c-loct', now() - interval '3 days', now() - interval '3 days' + interval '7 hours 40 minutes', 'Simulator', 'w-instr-01', 6, 'class', 'completed') on conflict do nothing`);
  await db.query(`insert into kafaa_enrolments (id, person_id, course_id, session_id, status, source, attendance) values ('en-w4e5-att', 'p-k-ro', 'c-loct', 's-w4e5-past', 'completed', 'manager', 'present') on conflict do nothing`);
  const y1 = await rpc('training-mgr', 'kafaa_sync_teaching_hours($1)', [null]);
  const y2 = await rpc('training-mgr', 'kafaa_sync_teaching_hours($1)', [null]);
  const yh = (await q(`select hours::float h, person_id from kafaa_teaching_hours where id = 'th-ses-s-w4e5-past'`))[0];
  const y3 = await rpc('k-ro', 'kafaa_sync_teaching_hours($1)', ['w-instr-01']);
  if (!(y1.ok && y2.data?.added === 0 && yh?.h === 7.5)) console.log('    sync debug', JSON.stringify(y1), JSON.stringify(y2), JSON.stringify(yh), JSON.stringify(y3));
  ok(y1.ok && y1.data.added >= 1 && yh?.h === 7.5 && yh.person_id === 'w-instr-01' && y2.data.added === 0 && y3.code === 'forbidden', 'attended M04 sessions feed the teaching hours log once (7 h 40 -> 7.5 h); others cannot sync someone else');

  const w1 = await rpc('k-ro', 'kafaa_withdraw_instructor_track($1, $2)', [tid, 'Moving to shift work']);
  const w2 = await rpc('k-ro', 'kafaa_withdraw_instructor_track($1, $2)', [tid, 'Again please']);
  const eqW = await q(`select valid_to::text v from kafaa_evaluator_quals where id = 'eq-ins-p-k-ro-qs-ro'`);
  const evW = (await q(`select status from kafaa_skill_evidence where id = $1`, [`se:credential:${tid}:sk-ld-01-instruct`]))[0];
  ok(w1.ok && w2.code === 'invalid_state' && eqW[0]?.v === today && evW?.status === 'lapsed', 'closing a qualified track ends its evaluator rows today and lapses the credential evidence');
  const fns = await q(`select distinct routine_name, grantee from information_schema.routine_privileges where routine_name like 'kafaa\\_ins\\_%' and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type = 'EXECUTE'`);
  if (fns.length) console.log('    executable:', JSON.stringify(fns));
  ok(fns.length === 0, 'internal kafaa_ins_* helpers are not executable by API roles');
}
