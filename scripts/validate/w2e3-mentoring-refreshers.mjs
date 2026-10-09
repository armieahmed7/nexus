// [W2 · E3 · F13 + F14] PGlite checks for 20261009123001_kafaa_w2e3_mentoring_refreshers.sql:
//  F13 Mentoring 2.0: refusal messages = TS, RLS (the pair only; private notes the author only), guard triggers, own-line-manager rule
//  (request, respondMentoring, propose), the full request → match → propose → accept → sessions → close-out flow, SME-only validation of
//  claims at a knowledge-transfer close-out, SME nominations, the programme dashboard (SQL = TS, suppressed under 10 pairs).
//  F14 refreshers: practice items only (trigger + RPC), SQL pick = TS pickRefresher, no answer keys before submission, the Leitner
//  schedule, the quota, instructor item statistics (SQL = TS, suppressed under 10 people).
import { readFileSync } from 'node:fs';
import { MSG, programmeStats, reportingChain, lineManagerOf } from '../../src/modules/m04/mentoring.ts';
import { MSG as RMSG, competencyWeights, pickRefresher, itemStatsOf, BOX_DAYS, addDaysIso } from '../../src/modules/m19/refresh.ts';

export default async function w2e3Checks({ db, as, one, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 2300; // test identities, disjoint uid range 2301+
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector'], ['sq-lead', 'Supply Quality Lead'], ['head-sq', 'Head of Supply Quality'],
    ['outage-planner', 'Outage Planner'], ['sme-reviewer', 'SME Reviewer'], ['outage-manager', 'Outage Manager']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const today = (await q(`select current_date::text d`))[0].d;
  const call = async (persona, sql, params) => (await one(persona, `select ${sql} r`, params)).r;
  const lastAudit = async () => (await q(`select action, outcome, reason, ledger_status from kafaa_audit_events order by seq desc limit 1`))[0];
  console.log('W2E3 · F13 mentoring 2.0');

  // ── messages are the same text in SQL and TS
  const sqlMsg = (await q('select kafaa_mentoring_msgs() m'))[0].m;
  const sqlR = (await q('select kafaa_refresh_msgs() m'))[0].m;
  ok(Object.keys(MSG).length === Object.keys(sqlMsg).length && Object.entries(MSG).every(([k, v]) => sqlMsg[k] === v) && Object.entries(RMSG).every(([k, v]) => sqlR[k] === v) && Object.keys(RMSG).length === Object.keys(sqlR).length,
    `every refusal message is identical in SQL and TS (${Object.keys(MSG).length} mentoring, ${Object.keys(RMSG).length} refresher)`);

  // ── RLS: the pair only; private notes the author only
  ok((await count(null, 'kafaa_mentoring_agreements')) === 0 && (await count(null, 'kafaa_mentoring_sessions')) === 0 && (await count(null, 'kafaa_mentoring_private_notes')) === 0 && (await count(null, 'kafaa_refresh_state')) === 0,
    'anonymous visitors read no agreements, sessions, private notes or refresher state');
  const qcA = await as('qc-inspector', 'select id, person_id, mentor_person_id from kafaa_mentoring_agreements');
  ok(qcA.length === T.mentoring_agreements.filter((a) => a.person_id === 'p-qc-inspector' || a.mentor_person_id === 'p-qc-inspector').length && qcA.length > 0 && qcA.every((a) => [a.person_id, a.mentor_person_id].includes('p-qc-inspector')),
    'a mentee reads only agreements they are part of');
  const pairNotes = T.mentoring_private_notes.filter((x) => x.agreement_id === 'ma-mr-f13-001');
  ok(pairNotes.some((x) => x.author_person_id === 'p-qc-inspector') && (await count('sq-lead', 'kafaa_mentoring_private_notes', `agreement_id = 'ma-mr-f13-001'`)) === pairNotes.filter((x) => x.author_person_id === 'p-sq-lead').length
    && (await count('sq-lead', 'kafaa_mentoring_sessions', `agreement_id = 'ma-mr-f13-001'`)) === T.mentoring_sessions.filter((s) => s.agreement_id === 'ma-mr-f13-001').length,
    'the mentor reads the shared session log but not the mentee\'s private notes');
  ok((await count('qc-inspector', 'kafaa_mentoring_private_notes', 'author_person_id <> kafaa_me()')) === 0 && (await count('qc-inspector', 'kafaa_mentoring_private_notes')) === T.mentoring_private_notes.filter((x) => x.author_person_id === 'p-qc-inspector').length,
    'a person reads only private notes they wrote');
  const outsiders = ['head-sq', 'training-mgr', 'k-admin', 'ai-governance', 'k-auditor', 'chco', 'k-hr-analyst'];
  let leak = 0;
  for (const p of outsiders) leak += (await count(p, 'kafaa_mentoring_private_notes', 'author_person_id <> kafaa_me()')) + (await count(p, 'kafaa_mentoring_agreements', `person_id <> kafaa_me() and mentor_person_id <> kafaa_me()`)) + (await count(p, 'kafaa_refresh_state', 'person_id <> kafaa_me()'));
  ok(leak === 0, 'line managers, the training manager, HR, admins and auditors read no one else\'s agreements, private notes or refresher state');
  let direct = 0;
  for (const sql of [`insert into kafaa_mentoring_agreements (id, request_id, mentor_id, person_id, mentor_person_id, mentoring_type, cadence, starts_on, ends_on, proposed_by) values ('x','mr-1','mt-1','p-k-ro','p-k-instructor','career','weekly',current_date,current_date+60,'p-k-ro')`,
    `update kafaa_mentoring_private_notes set note = 'x'`, `insert into kafaa_refresh_state (id, person_id, item_id, box, due_on) values ('x', kafaa_me(), 'it-basics-01', 5, current_date)`, `update kafaa_mentoring_sessions set note_shared = 'x'`]) {
    try { await as('k-ro', sql); const changed = (await q(`select count(*)::int n from kafaa_mentoring_private_notes where note = 'x'`))[0].n + (await q(`select count(*)::int n from kafaa_refresh_state where id = 'x'`))[0].n + (await q(`select count(*)::int n from kafaa_mentoring_sessions where note_shared = 'x'`))[0].n; if (!changed) direct++; } catch { direct++; }
  }
  ok(direct === 4, 'agreements, sessions, private notes and refresher state are never written directly (RPC only)');
  // SME columns: only through kafaa_nominate_sme (guard trigger), not by the mentor and not by a manager's direct write
  let g1 = false, g2 = false;
  try { await as('sro', `update kafaa_mentors set sme = true where id = 'mt-6'`); } catch { g1 = true; }
  try { await as('head-sq', `update kafaa_mentors set sme = true, sme_nominated_by = 'p-head-sq' where id = 'mt-23'`); } catch { g2 = true; }
  const bio = await as('sro', `update kafaa_mentors set bio_en = bio_en || ' ' where id = 'mt-6' returning id`);
  ok(g1 && g2 && bio.length === 1 && (await q(`select sme from kafaa_mentors where id = 'mt-23'`))[0].sme === false, 'SME nomination columns cannot be changed by a direct write (mentor or manager); other offer fields still can');

  // ── own line manager: never matched
  const own1 = await call('outage-planner', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-12', mentoring_type: 'career' })]);
  const a1 = await lastAudit();
  const own2 = await call('k-ro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-6', mentoring_type: 'leadership' })]);
  ok(lineManagerOf('p-outage-planner', T.people, T.role_assignments, today) === 'p-outage-manager' && own1.code === 'own_manager' && own1.message === MSG.own_manager && a1.outcome === 'refused' && own2.code === 'own_manager',
    'asking your own line manager for mentoring is refused (own_manager) and audited');
  await as('k-ro', `insert into kafaa_mentoring_requests (id, person_id, mentor_id, mentor_person_id, interest, status) values ('mr-w2e3-direct', 'p-k-ro', 'mt-6', 'p-sro', 'career', 'requested')`);
  const acc = await call('sro', `kafaa_respond_mentoring('mr-w2e3-direct', 'matched')`);
  ok(acc.code === 'own_manager' && (await q(`select status from kafaa_mentoring_requests where id = 'mr-w2e3-direct'`))[0].status === 'requested', 'a line manager cannot accept a request from their own team member (respondMentoring own_manager), even one created directly');
  const bad = [
    [await call('sro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-6', mentoring_type: 'career' })]), 'self'],
    [await call('k-ro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-13', mentoring_type: 'gossip' })]), 'invalid_type'],
    [await call('k-ro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-13', mentoring_type: 'career', skill_ids: ['sk-sa-01'] })]), 'invalid_skills'],
    [await call('k-ro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-nope', mentoring_type: 'career' })]), 'mentor_not_found'],
  ];
  let anonDenied = false;
  try { await call(null, `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-13', mentoring_type: 'career' })]); } catch { anonDenied = true; }
  ok(anonDenied, 'anonymous callers cannot execute the mentoring RPCs');
  ok(bad.every(([r, c]) => r.code === c), `refusals: ${bad.map(([r, c]) => `${c}=${r.code}`).join(', ')}`);

  // ── full flow: request → match → propose → accept → sessions → SME close-out validates the mentee's claim → close
  const req = await call('k-ro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-13', mentoring_type: 'knowledge_transfer', skill_ids: ['sk-en-01'], message: 'Configuration management basics' })]);
  const dup = await call('k-ro', `kafaa_request_mentoring($1::jsonb)`, [JSON.stringify({ mentor_id: 'mt-13', mentoring_type: 'knowledge_transfer' })]);
  ok(req.ok && dup.code === 'already_open', 'a mentee requests mentoring (type and skills); a second open request to the same mentor is refused');
  const early = await call('k-ro', `kafaa_propose_agreement($1, $2::jsonb)`, [req.data.id, JSON.stringify({ goals: [{ skill_id: 'sk-en-01', target_level: 3 }], cadence: 'weekly', starts_on: today, ends_on: addDaysIso(today, 90) })]);
  const match = await call('sme-reviewer', `kafaa_respond_mentoring($1, 'matched')`, [req.data.id]);
  const terms = { goals: [{ skill_id: 'sk-en-01', target_level: 3, text: 'Run a design-change screening' }, { skill_id: 'sk-ns-01-psa', target_level: 2 }], cadence: 'fortnightly', starts_on: today, ends_on: addDaysIso(today, 120) };
  const badGoals = await call('k-ro', `kafaa_propose_agreement($1, $2::jsonb)`, [req.data.id, JSON.stringify({ ...terms, goals: [{ skill_id: 'sk-sa-01', target_level: 2 }] })]);
  const badDates = await call('k-ro', `kafaa_propose_agreement($1, $2::jsonb)`, [req.data.id, JSON.stringify({ ...terms, ends_on: addDaysIso(today, 10) })]);
  const prop = await call('k-ro', `kafaa_propose_agreement($1, $2::jsonb)`, [req.data.id, JSON.stringify(terms)]);
  const self = await call('k-ro', `kafaa_respond_agreement($1, 'accept', null)`, [prop.data?.id]);
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const accept = await call('sme-reviewer', `kafaa_respond_agreement($1, 'accept', null)`, [prop.data?.id]);
  const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  ok(early.code === 'not_matched' && match.ok && badGoals.code === 'invalid_goals' && badDates.code === 'invalid_dates' && prop.ok && self.code === 'own_proposal' && accept.ok && led1 === led0 + 1,
    'agreement: only after the match, goals tied to non-security skills, 4 weeks to 12 months; the other person accepts (ledger event)');
  const aid = prop.data.id;
  const s1 = await call('k-ro', `kafaa_log_session($1, $2::jsonb)`, [aid, JSON.stringify({ held_on: today, minutes: 60, skill_ids: ['sk-en-01'], topics: 'Screening walkthrough', note_shared: 'Bring a real example next time', note_private: 'I still find the screening criteria confusing' })]);
  const sFuture = await call('k-ro', `kafaa_log_session($1, $2::jsonb)`, [aid, JSON.stringify({ held_on: addDaysIso(today, 3), minutes: 60, skill_ids: ['sk-en-01'] })]);
  const sSkill = await call('k-ro', `kafaa_log_session($1, $2::jsonb)`, [aid, JSON.stringify({ held_on: today, minutes: 60, skill_ids: ['sk-co-01'] })]);
  const aud = await q(`select reason from kafaa_audit_events where action = 'mentoring.session' and outcome = 'ok' order by seq desc limit 1`);
  ok(s1.ok && sFuture.code === 'invalid_session' && sSkill.code === 'invalid_session' && !aud[0].reason.includes('confusing') && aud[0].reason.includes('+private note'),
    'sessions: either person logs on an active agreement (no future dates, goal skills only); the audit row never carries note text');
  ok((await count('sme-reviewer', 'kafaa_mentoring_sessions', `agreement_id = '${aid}'`)) === 1 && (await count('sme-reviewer', 'kafaa_mentoring_private_notes', `agreement_id = '${aid}'`)) === 0
    && (await count('k-ro', 'kafaa_mentoring_private_notes', `agreement_id = '${aid}'`)) === 1 && (await count('k-admin', 'kafaa_mentoring_private_notes', `agreement_id = '${aid}'`)) === 0,
    'private session notes: the author reads theirs; the counterpart and admins cannot (acceptance)');
  // an open claim by the mentee (inserted as the owner: earlier checks already used k-ro's 20 claims for today)
  await db.query(`insert into kafaa_skill_claims (id, person_id, skill_id, level, note, status) values ('scl-w2e3-kro', 'p-k-ro', 'sk-en-01', 2, 'Screened two design changes with my mentor', 'claimed')`);
  await db.query(`insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active) values ('se:rating:scl-w2e3-kro:sk-en-01', 'p-k-ro', 'sk-en-01', 'rating', 'skill_claims', 'scl-w2e3-kro', 2, 'claimed', 'current', current_date, 'claim', 'p-k-ro', true)`);
  const claim = { ok: true, data: { id: 'scl-w2e3-kro' } };
  const badRate = await call('sme-reviewer', `kafaa_close_agreement($1, $2::jsonb)`, [aid, JSON.stringify({ ratings: [{ skill_id: 'sk-en-01', rating: 3 }] })]);
  const closeM = await call('sme-reviewer', `kafaa_close_agreement($1, $2::jsonb)`, [aid, JSON.stringify({ ratings: [{ skill_id: 'sk-en-01', rating: 4 }, { skill_id: 'sk-ns-01-psa', rating: 2 }], note: 'Good progress', validate: true })]);
  const cl = (await q(`select status, decided_by from kafaa_skill_claims where id = $1`, [claim.data?.id]))[0];
  const ev = (await q(`select basis from kafaa_skill_evidence where id = $1`, [`se:rating:${claim.data?.id}:sk-en-01`]))[0];
  const st = (await q(`select basis from kafaa_person_skills where id = 'ps:p-k-ro:sk-en-01'`))[0];
  const again = await call('sme-reviewer', `kafaa_close_agreement($1, $2::jsonb)`, [aid, JSON.stringify({ ratings: [{ skill_id: 'sk-en-01', rating: 4 }, { skill_id: 'sk-ns-01-psa', rating: 2 }] })]);
  ok(claim.ok && badRate.code === 'invalid_ratings' && closeM.ok && closeM.data.status === 'closing' && closeM.data.validated.length === 1 && closeM.data.skipped.some((x) => x.skill_id === 'sk-ns-01-psa' && x.code === 'not_met')
    && cl.status === 'validated' && cl.decided_by === 'p-sme-reviewer' && ev.basis === 'validated' && ['validated', 'evidenced', 'verified'].includes(st?.basis) && again.code === 'already_closed',
    'an SME mentor\'s knowledge-transfer close-out validates the mentee\'s open claim on goals rated met or better (claim, evidence and skill state)');
  const closeE = await call('k-ro', `kafaa_close_agreement($1, $2::jsonb)`, [aid, JSON.stringify({ ratings: [{ skill_id: 'sk-en-01', rating: 3 }, { skill_id: 'sk-ns-01-psa', rating: 3 }], validate: true })]);
  const closeE2 = await call('k-ro', `kafaa_close_agreement($1, $2::jsonb)`, [aid, JSON.stringify({ ratings: [{ skill_id: 'sk-en-01', rating: 3 }, { skill_id: 'sk-ns-01-psa', rating: 3 }] })]);
  const fin = (await q(`select status, attainment_pct from kafaa_mentoring_agreements where id = $1`, [aid]))[0];
  ok(closeE.code === 'validate_kt_only' && closeE2.ok && closeE2.data.status === 'closed' && fin.status === 'closed' && Number(fin.attainment_pct) === 75
    && (await q(`select status from kafaa_mentoring_requests where id = $1`, [req.data.id]))[0].status === 'closed', 'the second close-out closes the agreement (attainment 3 of 4 ratings met = 75%) and frees the place');
  // non-SME mentor: sro accepts the proposed knowledge-transfer agreement, then cannot validate (acceptance)
  const sroAid = T.mentoring_agreements.find((a) => a.mentor_person_id === 'p-sro' && a.status === 'proposed').id;
  const sroAcc = await call('sro', `kafaa_respond_agreement($1, 'accept', null)`, [sroAid]);
  const sroGoals = (await q(`select goals from kafaa_mentoring_agreements where id = $1`, [sroAid]))[0].goals;
  const notSme = await call('sro', `kafaa_close_agreement($1, $2::jsonb)`, [sroAid, JSON.stringify({ ratings: sroGoals.map((g) => ({ skill_id: g.skill_id, rating: 4 })), validate: true })]);
  ok(sroAcc.ok && notSme.code === 'not_sme' && notSme.message === MSG.not_sme && (await q(`select mentor_closed_at from kafaa_mentoring_agreements where id = $1`, [sroAid]))[0].mentor_closed_at === null,
    'a knowledge-transfer close-out by a non-SME mentor cannot validate skills (not_sme, nothing recorded)');

  // ── SME nominations
  const nomBad = await call('sro', `kafaa_nominate_sme('mt-23', true, '{}'::text[])`);
  const nomSelf = await call('sq-lead', `kafaa_nominate_sme('mt-8', false, '{}'::text[])`);
  const nomSkill = await call('head-sq', `kafaa_nominate_sme('mt-23', true, array['sk-pf-01'])`);
  const led2 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const nom = await call('head-sq', `kafaa_nominate_sme('mt-23', true, array['sk-da-01-analysis'])`);
  const m23 = (await q(`select sme, sme_skill_ids, sme_nominated_by from kafaa_mentors where id = 'mt-23'`))[0];
  ok(nomBad.code === 'forbidden_nominate' && nomSelf.code === 'self_nominate' && nomSkill.code === 'invalid_skills' && nom.ok && m23.sme && m23.sme_nominated_by === 'p-head-sq'
    && JSON.stringify(m23.sme_skill_ids) === '["sk-da-01-analysis"]' && (await q('select count(*)::int n from ledger_entries'))[0].n === led2 + 1, 'only the mentor\'s line manager (or the training manager) nominates an SME, for skills the mentor offers (ledger event)');
  const nominees = await call('head-sq', 'kafaa_sme_nominees()');
  const expectN = (await q(`select id, person_id from kafaa_mentors order by id collate "C"`)).filter((m) => m.person_id !== 'p-head-sq' && lineManagerOf(m.person_id, T.people, T.role_assignments, today) === 'p-head-sq').map((m) => m.id);
  ok(JSON.stringify(nominees.map((x) => x.mentor_id)) === JSON.stringify(expectN) && expectN.includes('mt-8') && (await call('training-mgr', 'kafaa_sme_nominees()')).length === T.mentors.filter((m) => m.person_id !== 'p-training-mgr').length,
    `SME nominees: a line manager sees their own line (${expectN.join(', ')}); the training manager sees every mentor`);
  for (const p of ['k-ro', 'outage-planner', 'qc-inspector', 'sro']) {
    const line = await call(p, 'kafaa_my_reporting_line()');
    const pid = T.people.find((x) => x.persona_id === p).id;
    ok(line.line_manager === lineManagerOf(pid, T.people, T.role_assignments, today) && JSON.stringify(line.chain) === JSON.stringify(reportingChain(pid, T.people, T.role_assignments, today)), `reporting line for ${p}: SQL = TS (${line.chain.join(' > ') || 'none'})`);
  }

  // ── programme dashboard: SQL = TS on the current rows; suppressed under 10 pairs; training manager only
  const rows = async (t) => q(`select * from ${t}`);
  const ag = (await rows('kafaa_mentoring_agreements')).map((a) => ({ ...a, starts_on: iso(a.starts_on), ends_on: iso(a.ends_on) }));
  const tsStats = programmeStats(ag, await rows('kafaa_mentoring_sessions'), await rows('kafaa_mentors'), await rows('kafaa_mentoring_requests'), today);
  const prog = await call('training-mgr', 'kafaa_mentoring_programme()');
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
  ok(prog.ok && norm(prog.data.by_type) === norm(tsStats.by_type) && norm(prog.data.total) === norm(tsStats.total) && norm(prog.data.mentors) === norm(tsStats.mentors) && prog.data.kt_validated === tsStats.kt_validated,
    `programme dashboard: SQL = TS (${tsStats.by_type.map((c) => `${c.key} ${c.suppressed ? 'suppressed' : c.pairs}`).join(', ')})`);
  ok(prog.data.by_type.every((c) => (c.suppressed ? c.pairs === null && c.attainment_pct === null : c.pairs >= 10)) && prog.data.by_type.some((c) => c.suppressed) && prog.data.by_type.some((c) => !c.suppressed),
    'cells under 10 pairs show suppressed, never a value');
  const hr = await call('k-hr-analyst', 'kafaa_mentoring_programme()');
  const mgr = await call('head-sq', 'kafaa_mentoring_programme()');
  ok(hr.code === 'forbidden' && mgr.code === 'forbidden' && hr.message === MSG.programme_forbidden, 'the programme dashboard is for the training manager only (HR and managers refused, audited)');

  console.log('W2E3 · F14 knowledge refreshers');
  // ── practice items only
  let trig = false;
  try { await db.query(`insert into kafaa_refresh_state (id, person_id, item_id, box, due_on) values ('rs:test:secure', 'p-k-ro', 'it-reactor-theory-11', 1, current_date)`); } catch { trig = true; }
  const secure = (await q(`select id from kafaa_items where bank = 'secure' and status = 'approved' limit 1`))[0]?.id ?? 'it-reactor-theory-11';
  const subSecure = await call('k-ro', `kafaa_submit_refresher($1::jsonb)`, [JSON.stringify([{ item_id: secure, answer: 'a' }])]);
  const audSecure = await lastAudit();
  ok(trig && subSecure.code === 'not_practice' && audSecure.outcome === 'refused' && (await q(`select count(*)::int n from kafaa_refresh_state s join kafaa_items i on i.id = s.item_id where not (i.bank = 'practice' and i.is_practice)`))[0].n === 0,
    'refresher state can only reference practice-bank items (SQL trigger); answering a secure item is refused and audited');
  // ── SQL pick = TS pick (several people, with and without "extra")
  const items = await rows('kafaa_items');
  const skills = await rows('kafaa_skills');
  const rc = await rows('kafaa_role_competencies');
  const people = ['p-k-ro', 'p-sro', 'p-qc-inspector', 'p-outage-planner', 'w-ro-03', 'w-mnt-02', 'w-eng-02', 'p-training-mgr'];
  let same = 0;
  for (const pid of people) {
    const states = (await q(`select * from kafaa_refresh_state where person_id = $1`, [pid])).map((s) => ({ ...s, due_on: iso(s.due_on), last_at: s.last_at ? new Date(s.last_at).toISOString() : null }));
    const quals = (await q(`select * from kafaa_qual_records where person_id = $1`, [pid])).map((x) => ({ ...x, expires_on: x.expires_on ? iso(x.expires_on) : null }));
    const person = (await q(`select job_role_id from kafaa_people where id = $1`, [pid]))[0];
    const cadence = (await q(`select cadence from kafaa_refresh_prefs where person_id = $1`, [pid]))[0]?.cadence ?? 'weekly';
    const weights = competencyWeights({ comps: [...new Set(items.filter((i) => i.bank === 'practice' && i.is_practice && i.status === 'approved' && i.competency_id).map((i) => i.competency_id))], roleId: person?.job_role_id ?? null, roleComps: rc, quals, skills, today });
    for (const extra of [false, true]) {
      const t = pickRefresher({ items, states, weights, today, cadence, extra });
      const s = (await q(`select kafaa_refresh_pick($1, $2) r`, [pid, extra]))[0].r;
      const a = JSON.stringify(t.picks.map((p) => [p.item_id, p.state, p.box, p.weight, p.requal_standard_id]));
      const b = JSON.stringify(s.items.map((p) => [p.item_id, p.state, p.box, p.weight, p.requal_standard_id]));
      if (a === b && t.due_count === s.due_count && t.new_count === s.new_count && t.used === s.used && t.limit === s.limit && (t.next_due_on ?? null) === (s.next_due_on ?? null)) same++;
      else console.log('    pick mismatch', pid, extra, a, b, t.due_count, s.due_count, t.used, s.used);
    }
  }
  ok(same === people.length * 2, `refresher pick: SQL = TS for ${people.length} people, with and without extra practice (due first, weighted interleave, quota)`);
  // ── no answer keys before submission; topic weighting
  const nx = await call('k-ro', 'kafaa_next_refresher(true)');
  const txt = JSON.stringify(nx.data);
  const keys = nx.data.items.map((i) => (T.item_versions.find((v) => v.item_id === i.item_id) ?? {}).rationale_en).filter(Boolean);
  ok(nx.ok && nx.data.items.length === 5 && !/"answer"|"key"|"rationale/.test(txt) && keys.every((r) => !txt.includes(r)) && nx.data.items.every((i) => i.options.every((o) => Object.keys(o).sort().join() === 'ar,en,id')),
    'next refresher: five questions without answer keys or rationales in the payload (options carry id and text only)');
  ok(nx.data.items.every((i) => T.items.find((x) => x.id === i.item_id)?.bank === 'practice') && nx.data.items.some((i) => i.role), 'only practice items are served, weighted to the person\'s role competencies');
  // ── schedule: correct = up one box; wrong = back to box 1; due per box
  const ver = (id) => T.item_versions.find((v) => v.item_id === id && v.version === 1);
  const [x1, x2] = nx.data.items;
  const wrong = ver(x2.item_id).options.find((o) => o.id !== ver(x2.item_id).answer).id;
  const sub = await call('k-ro', `kafaa_submit_refresher($1::jsonb)`, [JSON.stringify([{ item_id: x1.item_id, answer: ver(x1.item_id).answer }, { item_id: x2.item_id, answer: wrong }])]);
  const r1 = sub.data.results.find((r) => r.item_id === x1.item_id);
  const r2 = sub.data.results.find((r) => r.item_id === x2.item_id);
  const due = (b) => addDaysIso(today, BOX_DAYS[b]);
  ok(sub.ok && r1.correct && r1.box_after === Math.min(5, x1.box + 1) && r1.due_on === due(r1.box_after) && !r2.correct && r2.box_after === 1 && r2.due_on === due(1) && r2.key === ver(x2.item_id).answer && r1.rationale_en === ver(x1.item_id).rationale_en,
    `Leitner schedule: correct ${x1.box}→${r1.box_after} (due ${r1.due_on}); wrong ${x2.box}→1 (due ${r2.due_on}); keys and explanations only after submission`);
  const inv = await call('k-ro', `kafaa_submit_refresher($1::jsonb)`, [JSON.stringify([{ item_id: x1.item_id, answer: 'z' }])]);
  const dupA = await call('k-ro', `kafaa_submit_refresher($1::jsonb)`, [JSON.stringify([{ item_id: x1.item_id, answer: 'a' }, { item_id: x1.item_id, answer: 'b' }])]);
  let anonR = false;
  try { await call(null, 'kafaa_next_refresher(false)'); } catch { anonR = true; }
  ok(inv.code === 'invalid' && dupA.code === 'invalid' && anonR, 'unknown options and duplicate answers are refused; anonymous callers cannot call refreshers');
  // quota: a daily learner who answered five today gets nothing more today unless they ask for extra practice
  await as('sro', `insert into kafaa_refresh_prefs (id, person_id, cadence) values ('rp:p-sro', 'p-sro', 'daily') on conflict (id) do update set cadence = 'daily'`).catch(() => null);
  const sroSet = await call('sro', 'kafaa_next_refresher(false)');
  const ans = sroSet.data.items.map((i) => ({ item_id: i.item_id, answer: ver(i.item_id).answer }));
  await call('sro', `kafaa_submit_refresher($1::jsonb)`, [JSON.stringify(ans)]);
  const after = await call('sro', 'kafaa_next_refresher(false)');
  const extra = await call('sro', 'kafaa_next_refresher(true)');
  ok(sroSet.data.items.length === 5 && after.data.items.length === 0 && after.data.used === 5 && after.data.limit === 0 && extra.data.items.length === 5, 'quota: five a day for a daily learner; "extra" practice still serves a set');
  // ── instructor view: SQL = TS, suppressed under 10 people; others refused
  const stats = await call('k-instructor', 'kafaa_refresher_item_stats()');
  const tsSt = itemStatsOf(await rows('kafaa_items'), await rows('kafaa_refresh_state'));
  ok(stats.ok && norm(stats.data.items) === norm(tsSt.items) && norm(stats.data.by_competency) === norm(tsSt.by_competency) && stats.data.items.some((i) => i.suppressed) && stats.data.items.every((i) => (i.suppressed ? i.people === null && i.p_value === null : i.people >= 10)),
    `instructor item difficulty: SQL = TS; ${stats.data.items.filter((i) => i.suppressed).length} of ${stats.data.items.length} items suppressed under 10 people`);
  const kroStats = await call('k-ro', 'kafaa_refresher_item_stats()');
  const hrStats = await call('k-hr-analyst', 'kafaa_refresher_item_stats()');
  ok(kroStats.code === 'forbidden' && hrStats.code === 'forbidden' && (await call('training-mgr', 'kafaa_refresher_item_stats()')).ok, 'item statistics: instructors and the training manager only');
  // ── prefs: own rows, direct, audited
  await as('k-ro', `insert into kafaa_refresh_prefs (id, person_id, cadence) values ('rp:p-k-ro', 'p-k-ro', 'daily') on conflict (id) do update set cadence = 'daily'`).catch(() => null);
  let other = false;
  try { await as('k-ro', `insert into kafaa_refresh_prefs (id, person_id, cadence) values ('rp:w-ro-01x', 'w-ro-01', 'daily')`); } catch { other = true; }
  ok(other && (await q(`select cadence from kafaa_refresh_prefs where id = 'rp:p-k-ro'`))[0]?.cadence === 'daily', 'refresher cadence: a person sets only their own');
}
function iso(d) { return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10); }
