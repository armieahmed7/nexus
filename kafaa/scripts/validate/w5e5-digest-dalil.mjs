// [W5 · E5 · F36 + F37] PGlite checks for 20261009155001_kafaa_w5e5_digest_dalil.sql: the digest rules equal the TypeScript rules
// (every seeded person on a fresh database, with and without a coach hint, plus period, quiet-hours, hint, match and notice helpers),
// RLS on the two digest tables, kafaa_build_digest (idempotent per period, nudges off, quiet hours, refusals, one notification),
// kafaa_set_digest_prefs (validation, expiry cannot be muted), kafaa_digest_stats (admins and auditors only, suppression) and
// kafaa_dalil_career_turn (signed-in staff only, kill switch, submode 'career', concern redaction), and the grants.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sortKeys = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

export default async function w5e5Checks({ db, as, one, count, ok, uid }) {
  const R = await import('../../src/shell/digest/rules.ts');
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const today = S.meta.demo_today;
  const data = Object.fromEntries(['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'opportunities',
    'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
    'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits' /* FS wave E integration (FS39 host confirmations) */, 'role_assignments' /* readiness 2026-10-13 */, 'roleplay_sessions' /* FS wave F integration (FS59 reviews owed) */].map((t) => [t, T[t] ?? []]));

  // ── SQL = TS on a fresh database (earlier checks mutate data)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q1 = async (sql, p = []) => (await fresh.query(sql, p)).rows[0];
  const prefsBy = new Map(T.digest_prefs.map((p) => [p.person_id, p]));
  const diffs = [];
  let nItems = 0;
  for (const p of T.people) {
    const sql = (await q1('select kafaa_dg_compute($1, $2::date, $3::jsonb) r', [p.id, today, '{}'])).r;
    const ts = R.buildDigestItems(data, p.id, today, R.prefsOf(prefsBy.get(p.id)));
    nItems += ts.length;
    if (sortKeys(sql) !== sortKeys(ts)) diffs.push(`${p.id}: ${sortKeys(sql).slice(0, 300)} != ${sortKeys(ts).slice(0, 300)}`);
  }
  ok(diffs.length === 0, `kafaa_dg_compute equals buildDigestItems() for all ${T.people.length} people on ${today} (${nItems} items)${diffs.length ? `; first diff ${diffs[0]}` : ''}`);
  // another day (two weeks earlier) and a coach hint
  const hint = { coach: { id: 'course:HU-101', item_id: 'hu-101', title_en: 'HU-101 · Human performance core tools', title_ar: 'HU-101 · أدوات الأداء البشري', link: '/learn/course/hu-101',
    reasons: [{ code: 'gap_role', key: 'common.engines.reason.gap_role', vars: { skill: { en: 'Human performance', ar: 'الأداء البشري' }, role: { en: 'SRO', ar: 'مشغل أول' } } }, { code: 'effort', key: 'common.engines.reason.effort', vars: { hours: 8 } }] } };
  const d2 = R.addDays(today, -14);
  const diffs2 = [];
  for (const p of T.people.filter((x) => x.kind === 'staff')) {
    for (const [d, h] of [[d2, {}], [today, hint]]) {
      const sql = (await q1('select kafaa_dg_compute($1, $2::date, $3::jsonb) r', [p.id, d, JSON.stringify(h)])).r;
      const ts = R.buildDigestItems(data, p.id, d, R.prefsOf(prefsBy.get(p.id)), h);
      if (sortKeys(sql) !== sortKeys(ts)) diffs2.push(`${p.id}@${d}`);
    }
  }
  ok(diffs2.length === 0, `SQL = TS also two weeks earlier and with a coach hint (every staff member)${diffs2.length ? `; diffs ${diffs2.slice(0, 5).join(', ')}` : ''}`);
  const all = (await q1(`select jsonb_agg(kafaa_dg_compute(p.id, $1::date, '{}'::jsonb)) r from kafaa_people p`, [today])).r;
  ok(all.every((xs) => xs.length <= R.DIGEST_MAX) && all.every((xs) => xs.every((x, i) => i === 0 || x.urgency >= xs[i - 1].urgency)),
    'every digest has at most 7 items, ordered by urgency (expiry before approvals before the rest)');
  // match helper equals the F08 formula for every open opportunity and staff member
  let mDiff = 0, mN = 0;
  const lvOf = (pid) => { const m = new Map(); for (const s of T.person_skills) if (s.person_id === pid && s.active !== false && s.level > 0) m.set(s.skill_id, Math.max(m.get(s.skill_id) ?? 0, s.level)); return m; };
  const sk = new Map(T.skills.map((s) => [s.id, s]));
  const w = T.engine_settings.find((s) => s.id === 'match')?.weights ?? {};
  for (const p of T.people.filter((x) => x.kind === 'staff').slice(0, 40)) {
    const lv = lvOf(p.id);
    const short = T.career_targets.filter((t) => t.person_id === p.id && t.active !== false).sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1)).map((t) => t.role_id);
    const tgt = R.defaultTargetRole(T.career_paths, p.job_role_id ?? null, short);
    for (const o of T.opportunities) {
      mN++;
      const sql = Number((await q1('select kafaa_dg_match($1::text[], $2::text[], $3::jsonb, $4, $5, $6::jsonb) s', [o.skills_needed, o.skills_gained, JSON.stringify(Object.fromEntries(lv)), p.job_role_id ?? null, tgt, JSON.stringify(w)])).s);
      if (sql !== R.matchScore(o, lv, sk, T.role_competencies, p.job_role_id ?? null, tgt, w)) mDiff++;
    }
  }
  ok(mDiff === 0, `kafaa_dg_match equals the F08 match formula (${mN} person × opportunity pairs)`);
  // helpers
  const dates = ['2026-01-01', '2026-01-04', '2026-01-05', '2026-10-08', '2026-12-28', '2026-12-31', '2027-01-03', '2027-01-04', '2024-12-30', '2026-02-28'];
  let pDiff = 0;
  for (const d of dates) for (const f of R.FREQUENCIES) if ((await q1('select kafaa_dg_period($1::date, $2) p', [d, f])).p !== R.periodOf(d, f)) pDiff++;
  ok(pDiff === 0, `period keys equal (${dates.length} dates incl. ISO year edges × 3 frequencies)`);
  let qDiff = 0;
  for (const [s, e] of [[null, null], [22, 6], [6, 22], [9, 9], [0, 1], [23, 0]]) for (let h = 0; h < 24; h++) if ((await q1('select kafaa_dg_in_quiet($1, $2, $3) q', [h, s, e])).q !== R.inQuietHours(h, s, e)) qDiff++;
  ok(qDiff === 0, 'quiet-hours window equals (wrapping midnight, empty and equal ends)');
  const hints = [hint.coach, { ...hint.coach, link: '//evil.example' }, { ...hint.coach, link: 'https://x' }, { ...hint.coach, title_en: '' }, { ...hint.coach, reasons: [{ code: 'x', key: 'no key' }] },
    { ...hint.coach, reasons: Array(7).fill({ code: 'a', key: 'm19.reasons.a' }) }, { ...hint.coach, reasons: [{ code: 'a', key: 'm19.reasons.a', vars: [1] }] }, [], 'x', null, { ...hint.coach, id: 5 }];
  let hDiff = 0;
  for (const h of hints) if ((await q1('select kafaa_dg_hint_ok($1::jsonb) k', [JSON.stringify(h)])).k !== R.hintOk(h)) hDiff++;
  ok(hDiff === 0 && R.hintOk(hint.coach) && !R.hintOk(hints[1]), 'coach hint check equals (internal links only, keyed reasons, at most 6)');
  const sample = (await q1('select kafaa_dg_compute($1, $2::date, $3::jsonb) r', ['p-sro', today, '{}'])).r;
  ok(sortKeys((await q1('select kafaa_dg_notice($1::jsonb, $2) n', [JSON.stringify(sample), 'weekly'])).n) === sortKeys(R.digestNotice(sample, 'weekly')), 'the digest notification text equals');
  // seeded runs: the stored items of the current period equal a recompute
  const cur = T.digest_runs.filter((r) => r.as_of === today);
  let sDiff = 0;
  for (const r of cur) if (sortKeys((await q1('select kafaa_dg_compute($1, $2::date, $3::jsonb) r', [r.person_id, today, '{}'])).r) !== sortKeys(r.items)) sDiff++;
  ok(sDiff === 0 && cur.length > 50, `the ${cur.length} seeded current digests equal a recompute`);
  await fresh.close();

  // ── RLS (shared database)
  ok((await count(null, 'kafaa_digest_runs')) === 0 && (await count(null, 'kafaa_digest_prefs')) === 0, 'anonymous visitors read no digests or nudge settings');
  ok((await count('sro', 'kafaa_digest_runs', 'person_id <> kafaa_me()')) === 0 && (await count('sro', 'kafaa_digest_runs')) > 0, 'a person reads only their own digests');
  ok((await count('k-admin', 'kafaa_digest_runs', 'person_id <> kafaa_me()')) === 0 && (await count('k-hr-analyst', 'kafaa_digest_prefs', 'person_id <> kafaa_me()')) === 0 && (await count('k-auditor', 'kafaa_digest_runs', 'person_id <> kafaa_me()')) === 0,
    'admins, HR and auditors read no one else\'s digest or settings (aggregates only)');

  // ── kafaa_build_digest
  const runsOf = async (p) => Number((await db.query(`select count(*)::int n from kafaa_digest_runs r join kafaa_people pe on pe.id = r.person_id where pe.persona_id = $1`, [p])).rows[0].n);
  const anon = await one(null, `select kafaa_build_digest('{}'::jsonb) r`).catch((e) => ({ err: e.message }));
  ok(!!anon.err, 'anonymous callers cannot execute kafaa_build_digest');
  const b1 = (await one('k-university', `select kafaa_build_digest('{}'::jsonb) r`)).r;
  const b2 = (await one('k-university', `select kafaa_build_digest('{}'::jsonb) r`)).r;
  ok(b1.ok && b1.data.created === true && b2.ok && b2.data.created === false && b2.data.run_id === b1.data.run_id && (await runsOf('k-university')) === 1,
    `running the RPC twice in a period creates one digest (${b1.data.period}, ${b1.data.items.length} items)`);
  const tm = (await one('training-mgr', `select kafaa_build_digest('{}'::jsonb) r`)).r;
  const tmN = Number((await db.query(`select count(*)::int n from kafaa_notifications where id = $1`, [tm.data.notification_id ?? '-'])).rows[0].n);
  ok(tm.ok && tm.data.items.length <= 7 && (tm.data.items.length === 0 || (tmN === 1 && tm.data.notification_id.startsWith('nt-dg-'))), 'a digest with items writes exactly one notification (kind digest, link /my#digest)');
  const badHint = (await one('training-mgr', `select kafaa_build_digest('{"coach":{"id":"x","item_id":"y","title_en":"t","title_ar":"t","link":"https://evil.example","reasons":[]}}'::jsonb) r`)).r;
  ok(!badHint.ok && badHint.code === 'invalid', 'an external link in the coach hint is refused (invalid)');
  const offRuns = await runsOf('k-licensing-coord');
  const off = (await one('k-licensing-coord', `select kafaa_set_digest_prefs('{"enabled":false,"frequency":"weekly","quiet_start":null,"quiet_end":null,"muted_kinds":[]}'::jsonb) r`)).r;
  const offB = (await one('k-licensing-coord', `select kafaa_build_digest('{}'::jsonb) r`)).r;
  ok(off.ok && !offB.ok && offB.code === 'nudges_off' && (await runsOf('k-licensing-coord')) === offRuns, 'turning nudges off stops new digests (nudges_off, no run, no notification)');
  const h = (new Date().getUTCHours() + 4) % 24;
  const obsRuns = await runsOf('k-observer');
  const qp = (await one('k-observer', `select kafaa_set_digest_prefs($1::jsonb) r`, [JSON.stringify({ enabled: true, frequency: 'weekly', quiet_start: h, quiet_end: (h + 1) % 24, muted_kinds: [] })])).r;
  const qb = (await one('k-observer', `select kafaa_build_digest('{}'::jsonb) r`)).r;
  ok(qp.ok && !qb.ok && qb.code === 'quiet_hours' && (await runsOf('k-observer')) === obsRuns, `quiet hours defer the digest (${qb.message})`);
  const mutedExpiry = (await one('k-instructor', `select kafaa_set_digest_prefs('{"enabled":true,"frequency":"weekly","quiet_start":null,"quiet_end":null,"muted_kinds":["expiry"]}'::jsonb) r`)).r;
  const badFreq = (await one('k-instructor', `select kafaa_set_digest_prefs('{"enabled":true,"frequency":"daily","quiet_start":null,"quiet_end":null,"muted_kinds":[]}'::jsonb) r`)).r;
  const badQuiet = (await one('k-instructor', `select kafaa_set_digest_prefs('{"enabled":true,"frequency":"weekly","quiet_start":22,"quiet_end":null,"muted_kinds":[]}'::jsonb) r`)).r;
  const good = (await one('k-instructor', `select kafaa_set_digest_prefs('{"enabled":true,"frequency":"monthly","quiet_start":21,"quiet_end":7,"muted_kinds":["refresher","opportunity","refresher"]}'::jsonb) r`)).r;
  const saved = (await one('k-instructor', `select muted_kinds, frequency from kafaa_digest_prefs where person_id = kafaa_me()`));
  ok(!mutedExpiry.ok && mutedExpiry.message === R.PREFS_MSG.expiry && !badFreq.ok && badFreq.message === R.PREFS_MSG.frequency && !badQuiet.ok && badQuiet.message === R.PREFS_MSG.quiet
    && good.ok && saved.frequency === 'monthly' && JSON.stringify(saved.muted_kinds) === '["opportunity","refresher"]', 'settings: expiry cannot be muted, frequency and quiet hours checked, mutes stored once and sorted');
  const audits = Number((await db.query(`select count(*)::int n from kafaa_audit_events where action in ('digest.build', 'digest.prefs')`)).rows[0].n);
  ok(audits >= 10, `every digest call is audited, refusals included (${audits} audit rows)`);

  // ── kafaa_digest_stats
  const st = (await one('k-admin', 'select kafaa_digest_stats() s')).s;
  ok(st.periods.length >= 4 && st.periods.every((p) => p.suppressed ? p.delivered === null && p.rate === null : p.delivered >= 10 && p.rate >= 0 && p.rate <= 1) && st.periods.some((p) => !p.suppressed && p.rate > 0)
    && st.kinds.every((k) => k.suppressed ? k.n === null : k.n >= 10) && st.off === null, `admin aggregate: open rate per period (${st.periods.map((p) => `${p.period} ${p.rate}`).join(', ')}), counts under 10 suppressed`);
  ok(!!(await one('k-auditor', 'select kafaa_digest_stats() s')).s && !!(await one('sro', 'select kafaa_digest_stats() s').catch((e) => ({ err: e.message }))).err, 'auditors read the aggregate; a staff member gets an error');

  // ── kafaa_dalil_career_turn
  const turn = (q, extra = {}) => JSON.stringify({ question: q, answer: 'Indicative answer', citations: [{ label: 'FANR-REG-17 Art. 4', url: 'https://www.fanr.gov.ae/x/REG17' }], refused: false, intent: 'career.gap_to_role', confidence: 1, ...extra });
  const c1 = (await one('sro', `select kafaa_dalil_career_turn($1::jsonb) r`, [turn('What do I need for SRO?')])).r;
  const sess = await db.query(`select s.mode, s.submode, s.turns, (select array_agg(t.submode || ':' || t.mode order by t.id) from kafaa_advisor_turns t where t.session_id = s.id) ts from kafaa_advisor_sessions s where s.id = $1`, [c1.data?.session_id ?? '-']);
  ok(c1.ok && sess.rows[0]?.mode === 'staff' && sess.rows[0]?.submode === 'career' && sess.rows[0].turns === 2 && sess.rows[0].ts.every((x) => x === 'career:staff'), 'a career turn is logged with mode staff and submode career');
  const c2 = (await one('sro', `select kafaa_dalil_career_turn($1::jsonb) r`, [turn('I want to report my supervisor', { session_id: c1.data.session_id, refused: true, refusal_category: 'concern', redact_question: true, intent: 'concern' })])).r;
  const red = (await db.query(`select text, redacted from kafaa_advisor_turns where session_id = $1 and speaker = 'user' order by id desc limit 1`, [c1.data.session_id])).rows[0];
  ok(c2.ok && c2.data.session_id === c1.data.session_id && red.redacted && !red.text.includes('supervisor'), 'a concern in career mode is never stored (the question is withheld)');
  const ca = await one(null, `select kafaa_dalil_career_turn($1::jsonb) r`, [turn('x')]).catch((e) => ({ err: e.message }));
  const cp = (await one('alnoor-gm', `select kafaa_dalil_career_turn($1::jsonb) r`, [turn('What do I need for SRO?')])).r;
  ok(!!ca.err && !cp.ok && cp.code === 'forbidden', 'career mode: anonymous callers cannot execute it; partners are refused (forbidden)');
  await db.exec(`update kafaa_dalil_settings set enabled = false where id = 'global'`);
  const ck = (await one('sro', `select kafaa_dalil_career_turn($1::jsonb) r`, [turn('Where can I go next?')])).r;
  await db.exec(`update kafaa_dalil_settings set enabled = true where id = 'global'`);
  ok(!ck.ok && ck.code === 'disabled', 'the Dalil kill switch also stops career mode');

  // ── grants
  const ex = async (role, fn) => (await db.query(`select has_function_privilege($1, $2, 'execute') x`, [role, fn])).rows[0].x;
  ok(!(await ex('authenticated', 'kafaa_dg_gather(text, date, jsonb)')) && !(await ex('anon', 'kafaa_dg_compute(text, date, jsonb)')) && (await ex('authenticated', 'kafaa_build_digest(jsonb)'))
    && !(await ex('anon', 'kafaa_build_digest(jsonb)')) && (await ex('authenticated', 'kafaa_dalil_career_turn(jsonb)')), 'grants: internal digest helpers are not callable by API roles; the RPCs are for signed-in users');
  void uid;
}
