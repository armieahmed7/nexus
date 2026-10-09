// [W3 · E2 · F20, F21] PGlite checks for 20261009132001_kafaa_w3e2_knowledge.sql: RLS on the M24 tables (KLRA rows never staff-wide),
// SQL = TS parity of the KLRA proposal and the department heatmap, and the RPC flows with the cards' acceptance criteria
// (total = attrition x position, thresholds set by the KM owner and audited, no birth date or age in any payload, high rows need a
// mitigation action before the quarter closes or read overdue, heatmap cells under 10 suppressed; an asset cannot publish without a
// technical pass and a security pass by two people other than the author, restricted text blocks submission with guidance,
// withdrawn assets leave the staff read).
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { proposeFactors, computeHeatmap, bandOf, mitigationState, quarterOfIso } from '../../src/modules/m24/klra.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v));

export default async function w3e2Checks({ db, as, one, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 3200;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['head-sq', 'Head of Supplier Quality'], ['rp-lead', 'RP Team Leader'], ['ops-ceo', 'Operations CEO'], ['sme-reviewer', 'SME reviewer'], ['qc-inspector', 'QC Inspector'], ['outage-manager', 'Outage Manager']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W3E2 · F20 knowledge loss risk assessment, F21 knowledge capture studio');
  const today = new Date().toISOString().slice(0, 10);
  const Q = quarterOfIso(today);
  const t = { high: 16, medium: 8 };

  // ── parity on a pristine database
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const diffs = [];
  for (const pos of T.klra_positions) {
    for (const assets of [0, 1, 3]) {
      const sql = (await fq('select kafaa_kc_propose(p, $2) j from kafaa_klra_positions p where p.id = $1', [pos.id, assets]))[0].j;
      if (canon(sql) !== canon(proposeFactors(pos, assets))) diffs.push(`${pos.id}/${assets}`);
    }
  }
  ok(diffs.length === 0, `SQL KLRA proposal equals proposeFactors() for ${T.klra_positions.length} positions x 3 asset counts${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
  for (const period of ['2026-Q3', '2026-Q4']) {
    const sql = (await fq('select kafaa_kc_heatmap_compute($1::jsonb, $2) j', [JSON.stringify(t), period]))[0].j;
    ok(canon(sql) === canon(computeHeatmap(T.klra_assessments, T.klra_actions, t, period)), `SQL department heatmap equals computeHeatmap() for ${period}`);
  }
  const mit = await fq(`select a.id, kafaa_kc_mitigation(kafaa_kc_band(a.total, '{"high":16,"medium":8}'::jsonb), a.period, a.id) m from kafaa_klra_assessments a`);
  const mitTs = new Map(T.klra_assessments.map((a) => [a.id, mitigationState(bandOf(a.total, t), a.period, T.klra_actions.filter((x) => x.assessment_id === a.id), today)]));
  ok(mit.length === T.klra_assessments.length && mit.every((r) => mitTs.get(r.id) === r.m), `SQL mitigation state equals mitigationState() for ${mit.length} assessments`);
  ok(T.klra_assessments.every((a) => a.total === a.attrition_factor * a.position_factor) && (await fq('select count(*)::int n from kafaa_klra_assessments where total <> attrition_factor * position_factor'))[0].n === 0,
    'every seeded assessment total equals attrition x position');
  await fresh.close();

  // ── RLS: KLRA rows are never staff-wide
  for (const tb of ['kafaa_klra_settings', 'kafaa_klra_positions', 'kafaa_klra_assessments', 'kafaa_klra_actions']) {
    ok((await count(null, tb)) === 0 && (await count('k-ro', tb)) === 0 && (await count('qc-inspector', tb)) === 0 && (await count('chco', tb)) === 0 && (await count('k-hr-analyst', tb)) === 0 && (await count('k-auditor', tb)) === 0,
      `${tb}: no rows for anonymous visitors, employees, HR (aggregates only) or auditors`);
  }
  const sroPos = await as('sro', 'select person_id from kafaa_klra_positions');
  const crewB = new Set(T.people.filter((p) => p.crew === 'B').map((p) => p.id));
  ok(sroPos.length > 0 && sroPos.every((r) => crewB.has(r.person_id)), `a department head (shift manager, crew B scope) reads only positions in scope (${sroPos.length})`);
  const rpPos = await as('rp-lead', 'select person_id from kafaa_klra_positions');
  const rpFam = new Set(T.people.filter((p) => p.job_family_id === 'radiation-protection').map((p) => p.id));
  ok(rpPos.length > 0 && rpPos.every((r) => rpFam.has(r.person_id)), 'the RP lead reads only radiation-protection positions');

  // ── RPC reads
  const reg = async (persona, period = null) => (await one(persona, 'select kafaa_klra_register($1) r', [period])).r;
  const tm = await reg('training-mgr');
  const q4 = T.klra_assessments.filter((a) => a.period === Q);
  ok(tm.mode === 'all' && tm.rows.length === q4.length && tm.pending.length === T.klra_positions.length - q4.length && tm.periods.includes('2026-Q3'), `the KM owner reads the whole register (${tm.rows.length} rows, ${tm.pending.length} still to assess)`);
  ok(tm.rows.every((r) => r.total === r.attrition_factor * r.position_factor && r.band === bandOf(r.total, t)), 'every register row: total = attrition x position, band from the thresholds');
  const q3 = await reg('training-mgr', '2026-Q3');
  ok(q3.rows.filter((r) => r.band === 'high').every((r) => r.actions.some((a) => a.status !== 'cancelled') || r.mitigation === 'overdue') && q3.rows.some((r) => r.mitigation === 'overdue'),
    'every high-risk row of the closed quarter has a mitigation action or reads "overdue"');
  ok(tm.rows.filter((r) => r.band === 'high').every((r) => ['planned', 'done', 'needed'].includes(r.mitigation)) && tm.rows.some((r) => r.mitigation === 'needed'), 'high-risk rows of the open quarter read planned, done or needed (before the quarter closes)');
  const payload = JSON.stringify([tm, q3, await one('training-mgr', `select kafaa_klra_position('pos-w-sro-02') r`)]);
  ok(!/birth|"age"|_age"|\bdob\b|date_of_birth|retire_on|retirement_date|"age_band"/i.test(payload) && !/"retirement_band":"(?!within_2|2_5|5_plus|na)/.test(payload), 'no birth date or age appears in any KLRA payload (bands only)');
  const sroReg = await reg('sro');
  ok(sroReg.mode === 'scope' && sroReg.rows.length > 0 && sroReg.rows.every((r) => crewB.has(r.position.person_id)), 'a department head gets the register for their scope only');
  const opsReg = await reg('ops-ceo');
  ok(opsReg.rows.some((r) => r.position.kind === 'ossa'), 'the operations CEO (entity scope) also sees KHNP OSSA cover positions');
  ok((await reg('chco')).mode === 'agg' && (await reg('chco')).rows.length === 0 && (await reg('k-ro')).mode === 'none', 'HR gets no register rows (aggregates only); employees get none');
  const hm = (await one('chco', 'select kafaa_klra_heatmap(null) r')).r;
  const cells = hm ? hm.departments.flatMap((d) => [d.n, d.high, d.medium, d.low, d.mitigated]) : [];
  ok(!!hm && cells.every((c) => (c.suppressed && c.n === null) || (!c.suppressed && c.n >= 10)) && cells.some((c) => c.suppressed) && cells.some((c) => !c.suppressed), 'HR heatmap: every department cell under 10 is suppressed (others shown)');
  ok((await one('k-ro', 'select kafaa_klra_heatmap(null) r')).r === null, 'employees get no heatmap');
  ok((await one('k-ro', `select kafaa_klra_position('pos-w-sro-02') r`)).r === null && (await one('sro', `select kafaa_klra_position('pos-w-sro-02') r`)).r === null && (await one('training-mgr', `select kafaa_klra_position('pos-w-sro-02') r`)).r?.history?.length >= 1,
    'position detail: KM owner yes; out-of-scope manager and employees get nothing');

  // ── RPC writes
  const r = async (persona, sql, p) => (await one(persona, `select ${sql} r`, p)).r;
  const aud = async () => (await q(`select action, outcome, reason, ledger_status, actor_role from kafaa_audit_events order by seq desc limit 1`))[0];
  const pend = tm.pending[0];
  const prop = proposeFactors(T.klra_positions.find((p) => p.id === pend.id), 0);
  const adj = (prop.attrition % 5) + 1;
  const nr = await r('training-mgr', 'kafaa_assess_position($1::jsonb)', [JSON.stringify({ position_id: pend.id, attrition_factor: adj, position_factor: prop.position })]);
  const ok1 = await r('training-mgr', 'kafaa_assess_position($1::jsonb)', [JSON.stringify({ position_id: pend.id, attrition_factor: adj, position_factor: prop.position, note: 'Contract renewal is not yet confirmed' })]);
  const saved = (await q('select * from kafaa_klra_assessments where id = $1', [ok1.data?.id]))[0];
  ok(nr.code === 'note_required' && ok1.ok && saved.total === adj * prop.position && saved.adjusted === true && saved.reasons.at(-1).code === 'adjusted', 'assessPosition: a changed factor needs a note; the stored total is attrition x position with an "adjusted" reason');
  const bad = await r('training-mgr', 'kafaa_assess_position($1::jsonb)', [JSON.stringify({ position_id: pend.id, attrition_factor: 6, position_factor: 2 })]);
  const emp = await r('k-ro', 'kafaa_assess_position($1::jsonb)', [JSON.stringify({ position_id: pend.id, attrition_factor: 1, position_factor: 1 })]);
  const hr = await r('chco', 'kafaa_assess_position($1::jsonb)', [JSON.stringify({ position_id: pend.id, attrition_factor: 1, position_factor: 1 })]);
  const oos = await r('sro', 'kafaa_assess_position($1::jsonb)', [JSON.stringify({ position_id: 'pos-w-rp-01', attrition_factor: 1, position_factor: 1 })]);
  ok(bad.code === 'invalid' && emp.code === 'forbidden' && hr.code === 'forbidden' && oos.code === 'not_found', 'factors outside 1-5 refused; employees and HR cannot assess; a department head cannot assess outside scope');
  const th0 = await r('k-ro', 'kafaa_set_klra_thresholds(20, 10)');
  const thb = await r('training-mgr', 'kafaa_set_klra_thresholds(10, 12)');
  const th = await r('training-mgr', 'kafaa_set_klra_thresholds(15, 8)');
  const thA = await aud();
  const after = await reg('training-mgr');
  ok(th0.code === 'forbidden' && thb.code === 'invalid' && th.ok && thA.action === 'klra.thresholds' && thA.outcome === 'ok' && thA.actor_role === 'training_manager' && after.thresholds.high === 15 && after.rows.every((x) => x.band === bandOf(x.total, { high: 15, medium: 8 })),
    'thresholds: only the KM owner sets them (audited, ledger attempted), and bands follow at once');
  await r('training-mgr', 'kafaa_set_klra_thresholds(16, 8)');
  const re = await r('training-mgr', 'kafaa_reassess_quarter(null)');
  const re2 = await r('training-mgr', `kafaa_reassess_quarter('2026-Q3')`);
  ok(re.ok && re.data.created === tm.pending.length - 1 && re2.code === 'closed_period' && (await reg('training-mgr')).pending.length === 0, `reassessQuarter assesses the remaining ${re.data?.created} positions; closed quarters are refused`);
  const hi = (await reg('training-mgr')).rows.find((x) => x.band === 'high' && x.mitigation === 'needed');
  const pm = await r('ops-ceo', 'kafaa_plan_mitigation($1::jsonb)', [JSON.stringify({ assessment_id: hi?.id, kind: 'mentoring', owner_role: 'line_manager', due_on: today })]);
  const pmD = await r('training-mgr', 'kafaa_plan_mitigation($1::jsonb)', [JSON.stringify({ assessment_id: hi?.id, kind: 'capture', owner_role: 'km_owner', due_on: today })]);
  const pmDup = await r('training-mgr', 'kafaa_plan_mitigation($1::jsonb)', [JSON.stringify({ assessment_id: hi?.id, kind: 'capture', owner_role: 'km_owner', due_on: today })]);
  const pmPast = await r('training-mgr', 'kafaa_plan_mitigation($1::jsonb)', [JSON.stringify({ assessment_id: hi?.id, kind: 'successor', owner_role: 'hr', due_on: '2020-01-01' })]);
  const nowMit = (await reg('training-mgr')).rows.find((x) => x.id === hi?.id)?.mitigation;
  ok(!!hi && (pm.ok || pm.code === 'not_found') && pmD.ok && pmDup.code === 'conflict' && pmPast.code === 'invalid' && nowMit === 'planned', 'planMitigation: a high row reading "needed" turns "planned"; duplicates and past due dates refused');
  const ca = await r('training-mgr', `kafaa_close_action($1, 'cancelled', '')`, [pmD.data.id]);
  const cb = await r('training-mgr', `kafaa_close_action($1, 'done', 'Interview held and published')`, [pmD.data.id]);
  ok(ca.code === 'invalid' && cb.ok && (await q('select status from kafaa_klra_actions where id = $1', [pmD.data.id]))[0].status === 'done', 'closeAction: cancelling needs a reason; done closes it');

  // ── F21
  const pub = T.knowledge_assets.filter((a) => a.status === 'published').length;
  ok((await count('k-ro', 'kafaa_knowledge_assets')) === pub && (await count('k-ro', 'kafaa_knowledge_assets', 'not published')) === 0 && (await count(null, 'kafaa_knowledge_assets')) === 0 && (await count('gulfhydro-qa', 'kafaa_knowledge_assets')) === 0,
    'staff read published assets only; anonymous visitors and partners none');
  ok((await count('k-ro', 'kafaa_capture_sessions')) === 0 && (await count('head-sq', 'kafaa_capture_sessions')) === T.capture_sessions.filter((s) => [s.sme_id, s.interviewer_id, s.created_by].includes('p-head-sq')).length,
    'capture sessions (and transcripts) are readable only by their SME, interviewer and planner');
  const board = await r('training-mgr', 'kafaa_capture_board()');
  ok(board.mode === 'all' && board.sessions.length === T.capture_sessions.length && (await r('k-ro', 'kafaa_capture_board()')).sessions.length === 0, 'the KM owner sees every capture session on the board; others only theirs');
  const draft = (extra = {}) => JSON.stringify({ title_en: 'Valve stroke timing tips', title_ar: 'نصائح توقيت شوط الصمام', summary_en: 'How to read stroke times and when a slow valve needs attention.', summary_ar: 'كيف تقرأ أزمنة الشوط ومتى يحتاج الصمام البطيء إلى اهتمام.',
    body: 'Stroke timing trends matter more than a single result; compare against the last three tests and the acceptance band before raising a work order.', key_points: [{ en: 'Trend the last three tests', ar: 'تتبع آخر ثلاثة اختبارات' }], skill_ids: ['sk-mp-01-mech'], standard_ids: ['qs-mech'], system_family: 'maintenance', submit: true, ...extra });
  const before = Number((await q('select count(*)::int n from kafaa_knowledge_assets'))[0].n);
  const secr = await r('sme-reviewer', 'kafaa_submit_asset($1::jsonb)', [draft({ body: 'Stroke timing trends matter; the guard posts near the valve gallery and the CCTV camera layout are also worth noting for newcomers.' })]);
  const secA = await aud();
  const cont = await r('sme-reviewer', 'kafaa_submit_asset($1::jsonb)', [draft({ body: 'Stroke timing trends matter more than a single result; call me on +971 50 123 4567 if you need the details of the acceptance band.' })]);
  ok(secr.code === 'restricted_content' && /security content is not allowed/.test(secr.message) && /leave out plant security/.test(secr.message) && secA.outcome === 'refused' && !/guard posts|cctv/i.test(secA.reason) && cont.code === 'contact_details'
    && Number((await q('select count(*)::int n from kafaa_knowledge_assets'))[0].n) === before, 'restricted text blocks submission with guidance (category audited, never the text); contact details refused');
  const kro = await r('k-ro', 'kafaa_submit_asset($1::jsonb)', [draft()]);
  const sub = await r('sme-reviewer', 'kafaa_submit_asset($1::jsonb)', [draft()]);
  ok(kro.code === 'forbidden' && sub.ok && sub.data.status === 'review', 'an SME (opt-in profile) submits an asset for review; a staff member without an SME profile or interviewer role cannot');
  const aid = sub.data.id;
  const pub0 = await r('training-mgr', 'kafaa_publish_asset($1)', [aid]);
  const self = await r('training-mgr', 'kafaa_review_asset($1::jsonb)', [JSON.stringify({ asset_id: aid, kind: 'security', outcome: 'pass', checks: { deidentified: true, no_security: false } })]);
  const sec = await r('training-mgr', 'kafaa_review_asset($1::jsonb)', [JSON.stringify({ asset_id: aid, kind: 'security', outcome: 'pass', checks: { deidentified: true, no_security: true } })]);
  const pub1 = await r('training-mgr', 'kafaa_publish_asset($1)', [aid]);
  const tech2 = await r('training-mgr', 'kafaa_review_asset($1::jsonb)', [JSON.stringify({ asset_id: aid, kind: 'technical', outcome: 'pass', checks: { accurate: true } })]);
  const emp2 = await r('k-ro', 'kafaa_review_asset($1::jsonb)', [JSON.stringify({ asset_id: aid, kind: 'technical', outcome: 'pass', checks: { accurate: true } })]);
  const tech = await r('head-sq', 'kafaa_review_asset($1::jsonb)', [JSON.stringify({ asset_id: aid, kind: 'technical', outcome: 'pass', checks: { accurate: true }, decisions: {} })]);
  const notOwner = await r('head-sq', 'kafaa_publish_asset($1)', [aid]);
  const pub2 = await r('training-mgr', 'kafaa_publish_asset($1)', [aid]);
  ok(pub0.code === 'reviews_missing' && self.code === 'invalid' && sec.ok && pub1.code === 'reviews_missing' && tech2.code === 'conflict' && emp2.code === 'forbidden' && tech.ok && notOwner.code === 'forbidden' && pub2.ok,
    'publishing needs a technical pass and a security pass by two different people (one person cannot do both); only the KM owner publishes');
  const own = await r('sme-reviewer', 'kafaa_submit_asset($1::jsonb)', [draft({ title_en: 'Valve stroke timing tips (second)' })]);
  const ownRev = await r('sme-reviewer', 'kafaa_review_asset($1::jsonb)', [JSON.stringify({ asset_id: own.data.id, kind: 'technical', outcome: 'pass', checks: { accurate: true } })]);
  ok(ownRev.code === 'forbidden' || ownRev.code === 'maker_checker', 'an author cannot review their own asset');
  ok((await count('k-ro', 'kafaa_knowledge_assets', `id = '${aid}'`)) === 1, 'the published asset is readable by staff');
  const use = await r('k-ro', 'kafaa_mark_asset_used($1)', [aid]);
  const use2 = await r('k-ro', 'kafaa_mark_asset_used($1)', [aid]);
  ok(use.ok && use2.ok && use2.data.used_by === 1, 'markAssetUsed counts each person once');
  const wd0 = await r('k-ro', 'kafaa_withdraw_asset($1, $2)', [aid, 'Out of date now']);
  const wd = await r('training-mgr', 'kafaa_withdraw_asset($1, $2)', [aid, 'Superseded by the revised procedure']);
  ok(wd0.code === 'forbidden' && wd.ok && (await count('k-ro', 'kafaa_knowledge_assets', `id = '${aid}'`)) === 0, 'withdrawn assets leave the staff read at once (search rebuilds from it); only the KM owner or author withdraws');
  const sess = await r('head-sq', 'kafaa_plan_capture($1::jsonb)', [JSON.stringify({ sme_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits', skill_ids: ['sk-mp-01-mech'] })]);
  const sessE = await r('k-ro', 'kafaa_plan_capture($1::jsonb)', [JSON.stringify({ sme_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits' })]);
  const sessS = await r('head-sq', 'kafaa_plan_capture($1::jsonb)', [JSON.stringify({ sme_id: 'w-mnt-03', template: 'rules_of_thumb', planned_on: today, title: 'Pump alignment habits', skill_ids: ['sk-sa-01'] })]);
  const shortTr = await r('head-sq', 'kafaa_record_capture($1, $2::jsonb)', [sess.data?.id, JSON.stringify({ status: 'transcribed', transcript: 'too short' })]);
  const trOk = await r('head-sq', 'kafaa_record_capture($1, $2::jsonb)', [sess.data?.id, JSON.stringify({ status: 'transcribed', transcript: 'Alignment is where most pump problems start. '.repeat(8) })]);
  ok(sess.ok && sessE.code === 'forbidden' && sessS.code === 'invalid' && shortTr.code === 'invalid' && trOk.ok && trOk.data.words > 30, 'planCapture by an interviewer (never security skills); transcripts are 200 to 60,000 characters of text');
  let direct = 0;
  for (const sql of [`insert into kafaa_klra_assessments (id, period, position_id, department, attrition_factor, position_factor, total, proposed_attrition, proposed_position, assessed_by) values ('x', '2026-Q4', 'pos-w-ro-01', 'operations', 1, 1, 1, 1, 1, 'p-k-ro')`,
    `update kafaa_knowledge_assets set status = 'published', published = true where author_id = 'p-sme-reviewer'`, `insert into kafaa_asset_reviews (id, asset_id, asset_author_id, reviewer_id, kind, outcome) values ('x', 'kas-008', 'p-k-instructor', 'p-k-ro', 'security', 'pass')`]) {
    try { const x = await as('sme-reviewer', `${sql} returning 1`); if (!x.length) direct++; } catch { direct++; }
  }
  ok(direct === 3, 'M24 tables cannot be written directly (RPC only)');
}
