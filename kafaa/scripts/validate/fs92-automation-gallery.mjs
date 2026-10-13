// [FS wave I · E2 · FS80] PGlite checks for 20261010292001_kafaa_fs92_automation_gallery.sql (automation and agent gallery, builder credit).
// Seed sanity (16 entries in every status pass the gallery check, every entry on an AI-system register row, metadata only, counters =
// adoptions, never the builder, evidence only after approval and the first adoption); SQL = TS parity: kafaa_atm_problem =
// automationProblem (valid and malformed entries, code, links, credentials, plant security, certification wording), kafaa_atm_decision_problem
// = decisionProblem, kafaa_atm_adopt_problem = adoptProblem, kafaa_atm_level = builderLevel, kafaa_atm_stats_core = galleryStats;
// RLS (staff read approved entries only, builders their own, admins and auditors all; adoption rows only by the adopter); RPC flows and
// RBAC (submit, maker-checker decisions, adoption, rung gate, builder credit written once approved and adopted, raised at 5 adopters,
// kept by the F01 recompute, FS09 rung unchanged); table checks; grants; additivity.
import { readFileSync } from 'node:fs';
import { aiRung } from '../../src/modules/m29/fluency.ts';
import { AUTOMATION_STATUSES, BUILDER_SKILL, REUSE_AT, adoptProblem, automationProblem, builderEvidenceId, builderLevel, decisionProblem, galleryStats } from '../../src/modules/m29/automations.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010292001_kafaa_fs92_automation_gallery.sql';
const d10 = (x) => (x == null ? null : x instanceof Date ? x.toISOString().slice(0, 10) : String(x).slice(0, 10));

/** The input an entry row would be submitted with. */
export const inputOf = (a, action = 'submit') => ({
  id: a.id, title_en: a.title_en, title_ar: a.title_ar, kind: a.kind, purpose_en: a.purpose_en, purpose_ar: a.purpose_ar, data_used_en: a.data_used_en, data_used_ar: a.data_used_ar,
  data_classes: [...a.data_classes], system_id: a.system_id, owner_person_id: a.owner_person_id, oversight_en: a.oversight_en, oversight_ar: a.oversight_ar, benefit_en: a.benefit_en,
  benefit_ar: a.benefit_ar, how_en: a.how_en, how_ar: a.how_ar, min_rung: a.min_rung, action,
});

export default async function fs92Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave I · E2 · FS80 automation and agent gallery with builder credit');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const staffIds = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id);
  const A = T.automations;
  const AD = T.automation_adoptions;

  // ── seed sanity
  const st = Object.fromEntries(AUTOMATION_STATUSES.map((s) => [s, A.filter((a) => a.status === s).length]));
  ok(A.length === 16 && st.approved === 10 && st.submitted === 2 && st.returned === 1 && st.draft === 1 && st.rejected === 1 && st.retired === 1,
    `seed: 16 gallery entries in every status (${Object.entries(st).map(([k, v]) => `${v} ${k}`).join(', ')})`);
  const sysIds = new Set(T.ai_systems.map((s) => s.id));
  ok(A.every((a) => sysIds.has(a.system_id)), 'acceptance (FS80): each entry links to its AI-system register row (kafaa_ai_systems)');
  const sysAt = (a) => T.ai_systems.map((s) => ({ id: s.id, status: a.status === 'retired' && s.id === a.system_id ? 'published' : s.status }));
  ok(A.every((a) => automationProblem(inputOf(a, a.status === 'draft' ? 'draft' : 'submit'), { systems: sysAt(a), staff: staffIds }) === null), 'seed: every entry passes the gallery check (no code, links, credentials, plant security or certification wording)');
  const cols = (await q(`select column_name from information_schema.columns where table_name = 'kafaa_automations'`)).map((r) => r.column_name);
  ok(A.every((a) => a.metadata_only === true) && !cols.some((c) => /code|script|url|link|file|command|payload|source_text|endpoint/.test(c)),
    `acceptance (FS80): nothing executes inside Kafa'a: metadata only, no code, script, file or link column among ${cols.length} columns`);
  ok(A.every((a) => a.adoption_count === AD.filter((x) => x.automation_id === a.id).length) && new Set(AD.map((x) => `${x.automation_id}|${x.person_id}`)).size === AD.length
    && AD.every((x) => { const a = A.find((y) => y.id === x.automation_id); return a.builder_person_id !== x.person_id && ['approved', 'retired'].includes(a.status) && x.adopted_on >= d10(a.history.find((h) => h.action === 'approve').at); }),
    `seed: ${AD.length} adoptions; every counter equals its adoption rows; one per person; never the builder; only after approval`);
  const ev = T.skill_evidence.filter((e) => e.ref_table === 'automations');
  ok(ev.length === A.filter((a) => builderLevel(a.status, a.adoption_count) > 0).length && ev.every((e) => {
    const a = A.find((y) => y.id === e.ref_id);
    return e.id === builderEvidenceId(a.id) && e.person_id === a.builder_person_id && e.kind === 'ojt' && e.basis === 'validated' && e.skill_id === BUILDER_SKILL && ['approved', 'retired'].includes(a.status)
      && a.adoption_count >= 1 && e.observed_on >= a.first_adopted_on && e.level === builderLevel(a.status, a.adoption_count) && a.builder_level === e.level;
  }) && A.filter((a) => a.status === 'approved' && a.adoption_count === 0).every((a) => !ev.some((e) => e.ref_id === a.id)),
    `acceptance (FS80): ${ev.length} builder credits, each written only after approval and the first adoption (an approved entry with no adopter has none), level 2 or 3 at ${REUSE_AT} adopters`);

  // ── parity: entry check
  const base = inputOf(A.find((a) => a.id === 'atm-procedure-revision-digest'));
  const cases = [base, { ...base, action: 'draft' }, { ...base, title_ar: ' ' }, { ...base, title_en: 'x'.repeat(121) }, { ...base, kind: 'macro' }, { ...base, purpose_en: '' }, { ...base, data_used_ar: 5 },
    { ...base, data_classes: [] }, { ...base, data_classes: ['public', 'public'] }, { ...base, data_classes: ['secret'] }, { ...base, data_classes: 'public' }, { ...base, system_id: 'ais-nope' },
    { ...base, system_id: 'ais-chem-triage' }, { ...base, system_id: 'ais-chat-pilot' }, { ...base, owner_person_id: 'p-alnoor-gm' }, { ...base, owner_person_id: 'p-nobody' }, { ...base, oversight_en: '' },
    { ...base, benefit_ar: '' }, { ...base, how_en: 'y'.repeat(601) }, { ...base, min_rung: 4 }, { ...base, min_rung: 1.5 }, { ...base, min_rung: '2' }, { ...base, action: 'publish' },
    { ...base, how_en: 'Open https://tools.example/run and press start.' }, { ...base, purpose_en: 'Runs <script>alert(1)</script> on load.' }, { ...base, how_ar: 'شغّل الملف run.ps1 كل يوم' },
    { ...base, purpose_en: 'Uses function(x) => x * 2 to rank work orders.' }, { ...base, how_en: 'Paste ```code``` into the console.' }, { ...base, data_used_en: 'Shared drive WWW.example folder' },
    { ...base, how_en: 'Log in with the password on the sticky note.' }, { ...base, how_ar: 'أدخل كلمة المرور ثم ابدأ' }, { ...base, purpose_en: 'Maps the vital area doors.' },
    { ...base, oversight_en: 'Output is certified correct.' }, { ...base, benefit_ar: 'النظام ممتثل' }, { ...base, how_en: 'curl the export and wget the result' }, null];
  const diffP = [];
  const sys = T.ai_systems.map((s) => ({ id: s.id, status: s.status }));
  for (const c of cases) { const s = (await q('select kafaa_atm_problem($1::jsonb) p', [c === null ? null : JSON.stringify(c)]))[0].p; const t = c === null ? 'title' : automationProblem(c, { systems: sys, staff: staffIds }); if ((s ?? null) !== t) diffP.push(`case ${cases.indexOf(c)}: ${s} vs ${t}`); }
  const codes = new Set(cases.filter(Boolean).map((c) => automationProblem(c, { systems: sys, staff: staffIds })));
  ok(diffP.length === 0 && ['code', 'secret', 'restricted', 'claim', 'system_closed'].every((x) => codes.has(x)),
    `SQL kafaa_atm_problem equals automationProblem() on ${cases.length} valid and malformed entries (code, links, scripts, credentials, plant security, certification)${diffP.length ? ` (${diffP[0]})` : ''}`);
  // decisions
  const diffD = [];
  const notes = [null, '', 'ok', 'Name the reviewer first.', 'x'.repeat(401), 'See https://x.example', 7];
  for (const status of AUTOMATION_STATUSES) for (const dec of ['approve', 'return', 'reject', 'retire', 'publish', '']) for (const note of notes) for (const decider of ['p-b', 'p-o', 'p-g']) {
    const s = (await q('select kafaa_atm_decision_problem($1, $2, $3, $4, $5::jsonb, $6) p', [status, 'p-b', 'p-o', dec, note === null ? null : JSON.stringify(note), decider]))[0].p;
    const t = decisionProblem({ status, builder_person_id: 'p-b', owner_person_id: 'p-o' }, dec, note, decider);
    if ((s ?? null) !== t) diffD.push(`${status}/${dec}/${note}/${decider}: ${s} vs ${t}`);
  }
  ok(diffD.length === 0, `SQL kafaa_atm_decision_problem equals decisionProblem() on ${AUTOMATION_STATUSES.length * 6 * notes.length * 3} cases (maker-checker, state, reason)${diffD.length ? ` (${diffD[0]})` : ''}`);
  const diffA = [];
  for (const status of AUTOMATION_STATUSES) for (const me of ['p-b', 'p-x']) for (const already of [false, true]) for (const [rung, min] of [[0, 1], [1, 1], [1, 2], [3, 3], [2, 3]]) for (const note of [null, '', 'Using it daily', 'z'.repeat(201), 'see www.x']) {
    const s = (await q('select kafaa_atm_adopt_problem($1, $2, $3, $4, $5, $6, $7::jsonb) p', [status, 'p-b', min, me, rung, already, note === null ? null : JSON.stringify(note)]))[0].p;
    const t = adoptProblem({ status, builder_person_id: 'p-b', min_rung: min }, { person_id: me, rung }, already, note);
    if ((s ?? null) !== t) diffA.push(`${status}/${me}/${already}/${rung}-${min}/${note}: ${s} vs ${t}`);
  }
  ok(diffA.length === 0, `SQL kafaa_atm_adopt_problem equals adoptProblem() on ${AUTOMATION_STATUSES.length * 2 * 2 * 5 * 5} cases (approved only, never the builder, once, rung gate)${diffA.length ? ` (${diffA[0]})` : ''}`);
  const diffL = [];
  for (const status of AUTOMATION_STATUSES) for (let n = 0; n <= 8; n++) if (Number((await q('select kafaa_atm_level($1, $2) v', [status, n]))[0].v) !== builderLevel(status, n)) diffL.push(`${status}/${n}`);
  ok(diffL.length === 0, `SQL kafaa_atm_level equals builderLevel() (0 before approval and adoption, 2 from the first adopter, 3 from ${REUSE_AT})${diffL.length ? ` (${diffL[0]})` : ''}`);
  const statsNow = async () => {
    const rows = await q('select id, status, builder_person_id, owner_person_id, system_id, min_rung, adoption_count, kind from kafaa_automations');
    const ads = await q('select id, automation_id, person_id, family_id, adopted_on from kafaa_automation_adoptions');
    return { s: (await q('select kafaa_atm_stats_core() j'))[0].j, t: galleryStats(rows.map((r) => ({ ...r, adoption_count: Number(r.adoption_count), min_rung: Number(r.min_rung) })), ads, 10) };
  };
  const s0 = await statsNow();
  ok(canon(s0.s) === canon(s0.t), `SQL kafaa_atm_stats_core equals galleryStats() (${s0.t.adoptions} adoptions, adopters ${s0.t.adopters ?? 'suppressed'})`);
  ok(s0.t.families.every((f) => f.adopters === null || f.adopters >= 10) && !s0.t.families.some((f) => ['security', 'safeguards', 'cyber'].includes(f.family_id)) && (s0.t.builders === null || s0.t.builders >= 10),
    'statistics: every people count is 10 or more, or suppressed; security, safeguards and cyber are never broken out');

  // ── RLS
  let n = 9201;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  await addProfile('buyer', 'Buyer');
  await addProfile('nse', 'Nuclear Specification Engineer');
  await addProfile('qc-inspector', 'QC Inspector');
  const cnt = async (who, sql, p) => Number((await one(who, sql, p)).n);
  ok(await cnt(null, 'select count(*)::int n from kafaa_automations') === 0 && await cnt(null, 'select count(*)::int n from kafaa_automation_adoptions') === 0, 'RLS: anonymous visitors read no gallery entry and no adoption');
  ok(await cnt('buyer', 'select count(*)::int n from kafaa_automations') === 10 && await cnt('buyer', `select count(*)::int n from kafaa_automations where status <> 'approved'`) === 0,
    'RLS: staff read the 10 approved entries only (never drafts, submissions, returned, rejected or retired entries)');
  const nseOwn = A.filter((a) => a.builder_person_id === 'p-nse' && a.status !== 'approved').length;
  ok(nseOwn === 1 && await cnt('nse', 'select count(*)::int n from kafaa_automations') === 10 + nseOwn && await cnt('nse', `select count(*)::int n from kafaa_automations where status = 'returned'`) === 1,
    'RLS: a builder also reads their own entries in every status (nse: the returned entry with its note)');
  ok(await cnt('k-auditor', 'select count(*)::int n from kafaa_automations') === 16 && await cnt('ai-governance', 'select count(*)::int n from kafaa_automations') === 16, 'RLS: AI governance (admin) and auditors read every entry');
  await addProfile('outage-planner', 'Outage Planner');
  const opAd = AD.filter((x) => x.person_id === 'p-outage-planner').length;
  const opBuilt = A.filter((a) => a.builder_person_id === 'p-outage-planner').reduce((m, a) => m + a.adoption_count, 0);
  ok(opAd >= 1 && opBuilt >= 5 && await cnt('outage-planner', 'select count(*)::int n from kafaa_automation_adoptions') === opAd && await cnt('chco', 'select count(*)::int n from kafaa_automation_adoptions') === 0
    && await cnt('k-auditor', 'select count(*)::int n from kafaa_automation_adoptions') === AD.length,
    `RLS: adoption rows are read by the adopter and auditors only; a builder (outage-planner, ${opBuilt} adopters of their look-ahead) sees only their own ${opAd} adoption, HR none`);

  // ── RPC flows: submit
  const mk = (over = {}) => ({ ...base, id: undefined, title_en: 'Permit lookup helper', title_ar: 'مساعد البحث عن التصاريح', owner_person_id: 'p-buyer', ...over });
  let anonS = false; try { await one(null, 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(mk())]); } catch { anonS = true; }
  ok(anonS && (await one('alnoor-gm', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(mk())])).r.code === 'forbidden', 'RBAC: anonymous visitors cannot execute submitAutomation; partners are refused (staff only)');
  const dr = (await one('buyer', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(mk({ action: 'draft' }))])).r;
  const sb = (await one('buyer', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(mk({ id: dr.data?.id, min_rung: 3 }))])).r;
  const rowB = (await q('select status, version, listed, metadata_only, family_id, history, builder_en from kafaa_automations where id = $1', [dr.data?.id]))[0];
  ok(dr.ok && dr.data.status === 'draft' && sb.ok && sb.data.status === 'submitted' && rowB.version === 2 && !rowB.listed && rowB.metadata_only && rowB.family_id === 'supply-chain' && rowB.history.length === 2 && rowB.builder_en === T.people.find((p) => p.id === 'p-buyer').display_name,
    'submitAutomation: any staff member saves a draft and submits it (versioned, history kept, not listed until approved)');
  const refusals = await Promise.all([
    mk({ how_en: 'Open https://tools.example/run' }), mk({ purpose_en: 'Calls eval(input) for each row.' }), mk({ how_en: 'Use the api key in the header.' }), mk({ system_id: 'ais-chem-triage' }),
  ].map(async (c) => (await one('buyer', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(c)])).r));
  ok(refusals.every((r) => r.code === 'invalid') && /metadata only/.test(refusals[0].message) && /metadata only/.test(refusals[1].message) && /credentials/.test(refusals[2].message) && /published in the register/.test(refusals[3].message),
    'acceptance (FS80): links and code are refused ("metadata only"), credentials are refused, and an entry must run on a published register row');
  const other = (await one('buyer', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(inputOf(A.find((a) => a.id === 'atm-supplier-followup-agent')))])).r;
  const locked = (await one('nse', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(inputOf(A.find((a) => a.id === 'atm-requisition-spec-check')))])).r;
  const fixed = (await one('nse', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify({ ...inputOf(A.find((a) => a.id === 'atm-supplier-followup-agent')), classes: undefined, data_classes: ['internal'],
    data_used_en: 'The meeting action list (internal); supplier contact details stay in the supplier record.', oversight_en: 'The specification engineer reads and sends each email herself.' })])).r;
  ok(other.code === 'not_found' && locked.code === 'locked' && fixed.ok && fixed.data.status === 'submitted' && fixed.data.version === 2,
    'submitAutomation: someone else\'s entry reads as not found, an approved entry is locked, and the builder resubmits a returned entry (version 2)');

  // ── RPC flows: decide
  ok((await one('buyer', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: dr.data.id, decision: 'approve' })])).r.code === 'forbidden'
    && (await one('training-mgr', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: dr.data.id, decision: 'approve' })])).r.code === 'forbidden', 'RBAC: staff and the training manager cannot decide (ai_literacy A only)');
  const gov = (await one('ai-governance', 'select kafaa_submit_automation($1::jsonb) r', [JSON.stringify(mk({ owner_person_id: 'p-ai-governance', title_en: 'Register review reminder', title_ar: 'تذكير مراجعة السجل' }))])).r;
  const mc = (await one('ai-governance', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: gov.data?.id, decision: 'approve' })])).r;
  const mc2 = (await one('k-admin', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: gov.data?.id, decision: 'approve' })])).r;
  ok(gov.ok && mc.code === 'maker_checker' && mc2.ok, 'acceptance (maker-checker): AI governance never decides an entry it built or owns; a second admin does');
  const noNote = (await one('ai-governance', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: dr.data.id, decision: 'return' })])).r;
  const led0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const ap = (await one('ai-governance', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: dr.data.id, decision: 'approve', note: 'Approved for the supply chain team.' })])).r;
  const led1 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const again = (await one('ai-governance', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: dr.data.id, decision: 'reject', note: 'Too late now.' })])).r;
  const evB = Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'automations' and ref_id = $1`, [dr.data.id]))[0].n);
  const audits = Number((await q(`select count(*)::int n from kafaa_audit_events where action = 'ai.automation.decide' and entity_id = $1`, [dr.data.id]))[0].n);
  ok(noNote.code === 'invalid' && ap.ok && ap.data.listed && led1 === led0 + 1 && again.code === 'invalid' && evB === 0 && audits >= 3,
    'decideAutomation: a return needs a reason; approval lists the entry and writes the NEXUS ledger; a decided entry cannot be decided again; approval alone writes no evidence; every call is audited');

  // ── RPC flows: adopt and builder credit
  const adopt = async (who, id, note) => (await one(who, 'select kafaa_adopt_automation($1::jsonb) r', [JSON.stringify({ id, note })])).r;
  const rungSql = async (pid) => Number((await q('select (kafaa_ai_rung($1) ->> \'rung\')::int r', [pid]))[0].r);
  ok((await adopt('buyer', dr.data.id)).code === 'own_build' && (await adopt('sro', 'atm-eng-change-impact')).code === 'not_found', 'adoptAutomation: a builder cannot adopt their own entry; an entry still under review reads as not found');
  const sroRung = await rungSql('p-sro');
  const low = await adopt('sro', dr.data.id);
  ok(sroRung < 3 && low.code === 'rung_low', `adoptAutomation: an adopter below the entry's minimum FS09 rung is refused (sro rung ${sroRung}, entry needs 3)`);
  const builder = 'p-sustainability-lead';
  const r0 = await rungSql(builder);
  const evBefore = Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'automations' and ref_id = 'atm-bilingual-notice'`))[0].n);
  const l0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const first = await adopt('sro', 'atm-bilingual-notice', 'Used for the parking notice');
  const l1 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const evRow = (await q(`select person_id, kind, basis, level, active, ref_table from kafaa_skill_evidence where id = $1`, [builderEvidenceId('atm-bilingual-notice')]))[0];
  const stRow = (await q(`select level, active from kafaa_person_skills where person_id = $1 and skill_id = $2`, [builder, BUILDER_SKILL]))[0];
  ok(evBefore === 0 && first.ok && first.data.first_adoption && first.data.evidence_written && first.data.builder_level === 2 && evRow?.person_id === builder && evRow.kind === 'ojt' && evRow.basis === 'validated'
    && evRow.level === 2 && evRow.active && stRow?.active && stRow.level >= 2 && l1 === l0 + 1,
    'acceptance (FS80): the first adoption of an approved entry writes the builder\'s recorded evidence (ojt, validated, level 2), recomputes their skill state and writes the ledger');
  ok(await rungSql(builder) === r0, `builder credit is AI-engineering evidence: the builder's FS09 rung is unchanged (${r0})`);
  ok((await adopt('sro', 'atm-bilingual-notice')).code === 'already' && Number((await q(`select adoption_count from kafaa_automations where id = 'atm-bilingual-notice'`))[0].adoption_count) === 1,
    'adoptAutomation: once per person; the counter counts adopters');
  await q(`select kafaa_skills_apply($1, current_date)`, [builder]);
  ok((await q(`select active from kafaa_skill_evidence where id = $1`, [builderEvidenceId('atm-bilingual-notice')]))[0].active === true, 'F01 recompute keeps builder evidence (kind ojt is recorded, not derived)');
  const capRow = (await q(`select adoption_count, builder_level, builder_person_id from kafaa_automations where id = 'atm-cap-action-digest'`))[0];
  const capAdopted = new Set((await q(`select person_id from kafaa_automation_adoptions where automation_id = 'atm-cap-action-digest'`)).map((r) => r.person_id));
  const cand = ['chco', 'training-mgr', 'k-hr-analyst', 'k-instructor', 'k-licensing-coord', 'nse', 'sro'].filter((p) => uid[p]);
  let fifth = null;
  for (const p of cand) {
    const pid = (await q('select id from kafaa_people where persona_id = $1', [p]))[0]?.id;
    if (!pid || capAdopted.has(pid) || pid === capRow.builder_person_id || await rungSql(pid) < 1) continue;
    fifth = await adopt(p, 'atm-cap-action-digest');
    break;
  }
  const capEv = (await q(`select level, observed_on from kafaa_skill_evidence where id = $1`, [builderEvidenceId('atm-cap-action-digest')]))[0];
  ok(Number(capRow.adoption_count) === REUSE_AT - 1 && capRow.builder_level === 2 && fifth?.ok && fifth.data.adoption_count === REUSE_AT && fifth.data.evidence_written && fifth.data.builder_level === 3 && capEv.level === 3,
    `builder credit rises in place from level 2 to level 3 at the ${REUSE_AT}th adopter (one evidence row per entry)`);
  const retire = (await one('ai-governance', 'select kafaa_decide_automation($1::jsonb) r', [JSON.stringify({ id: 'atm-cap-action-digest', decision: 'retire', note: 'Replaced by the register report.' })])).r;
  ok(retire.ok && (await q(`select active from kafaa_skill_evidence where id = $1`, [builderEvidenceId('atm-cap-action-digest')]))[0].active === true && (await adopt('nse', 'atm-cap-action-digest')).code === 'not_found',
    'retiring an entry keeps the builder\'s evidence and closes it to new adopters');

  // ── stats RPC
  let anonSt = false; try { await one(null, 'select kafaa_automation_stats() v'); } catch { anonSt = true; }
  ok(anonSt && (await one('buyer', 'select kafaa_automation_stats() v')).v === null && (await one('chco', 'select kafaa_automation_stats() v')).v?.approved >= 10
    && (await one('k-auditor', 'select kafaa_automation_stats() v')).v !== null, 'automationStats: HR (Agg), AI governance and auditors only; anonymous visitors cannot execute it');
  const s1 = await statsNow();
  ok(canon(s1.s) === canon(s1.t), 'SQL kafaa_atm_stats_core still equals galleryStats() after the flows');

  // ── table checks, grants and additivity
  const tryIns = async (patch) => {
    const row = { ...A[0], id: `atm-ck-${Object.keys(patch)[0]}`, ...patch };
    await db.exec('begin'); // every probe is rolled back: the shared database keeps the seed's entries
    try {
      await db.query(`insert into kafaa_automations (id, title_en, title_ar, kind, purpose_en, purpose_ar, data_used_en, data_used_ar, data_classes, system_id, builder_person_id, owner_person_id, builder_en, builder_ar, owner_en, owner_ar,
        oversight_en, oversight_ar, benefit_en, benefit_ar, how_en, how_ar, min_rung, status, listed, metadata_only, adoption_count, builder_level, decided_by, decided_at, first_adopted_on)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$27,$28,$29,$30,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$31)`,
      [row.id, row.title_en, row.title_ar, row.kind, row.purpose_en, row.purpose_ar, row.data_used_en, row.data_used_ar, row.data_classes, row.system_id, row.builder_person_id, row.owner_person_id,
        row.oversight_en, row.oversight_ar, row.benefit_en, row.benefit_ar, row.how_en, row.how_ar, row.min_rung, row.status, row.listed, row.metadata_only, row.adoption_count, row.builder_level, row.decided_by, row.decided_at, row.builder_en, row.builder_ar, row.owner_en, row.owner_ar, row.first_adopted_on]);
      return false;
    } catch { return true; } finally { await db.exec('rollback'); }
  };
  const control = !(await tryIns({ id: 'atm-ck-control' }));
  ok(control && await tryIns({ metadata_only: false }) && await tryIns({ how_en: 'see https://run.example' }) && await tryIns({ status: 'submitted', listed: false, adoption_count: 0, builder_level: 2, first_adopted_on: null })
    && await tryIns({ decided_by: A[0].builder_person_id }),
    'table checks (a valid control row inserts): metadata_only is always true, no link in any text, builder credit only when approved and adopted, a decision never by the builder');
  let helperDenied = 0;
  for (const sql of ['select kafaa_atm_problem(\'{}\'::jsonb)', 'select kafaa_atm_stats_core()', 'select kafaa_atm_level(\'approved\', 1)', 'select kafaa_atm_hit(\'x\', \'code\')']) {
    try { await one('buyer', sql); } catch { helperDenied++; }
  }
  ok(helperDenied === 4, 'grants: internal helpers are not executable by signed-in users');
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\balter\s+policy\s+\w+\s+on\s+(?!kafaa_)/i.test(text),
    'additive: the FS92 migration never uses a removal word (not even in comments) and alters only kafaa_* objects');
  // tidy: leave the shared database as the seed had it for later validators where it matters (counters stay consistent either way)
  void aiRung;
}
