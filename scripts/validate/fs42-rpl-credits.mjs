// [FS wave D · E2 · FS29 + FS30] PGlite checks for 20261010242001_kafaa_fs42_rpl_credits.sql: the seeded rows load unchanged (row
// digests = seed.json); SQL = TS for rplOptions (every person with records), creditsFor (every person with credit), the RPL statement and
// the NQC-ready pack; RLS (anonymous visitors read tags and stacks only; requests and ledgers are the person's own; the named supervisor
// reads only the attestation addressed to them); FS29 acceptance (a decision needs two different people; no security-restricted item can
// be attached; credit is written as validated evidence and recomputes skills; the export carries no FANR wording); FS30 acceptance (every
// current micro-credential carries an indicative level and credit tag; ledger totals = the sum of completed items, TS = SQL); one audit row
// per call and a ledger row only on an RPL decision; grants; additive SQL only.
import { readFileSync } from 'node:fs';
import { RPL_MSG, buildRplPack, maskFanr, packIsClean, rplOptions, rplStatement, PACK_FORMAT } from '../../src/modules/m34/rpl.ts';
import { CR_MSG, creditsFor, ledgerTotal } from '../../src/modules/m34/credits.ts';

const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const MINE = '20261010242001_kafaa_fs42_rpl_credits.sql';

export default async function fs42Checks({ db, as, one, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const pick = (cols, dates = [], nums = []) => (r) => Object.fromEntries(cols.map((c) => [c, dates.includes(c) ? d10(r[c]) : nums.includes(c) ? (r[c] == null ? null : Number(r[c])) : r[c] ?? null]));
  let n = 4201;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  for (const [p, r] of [['sq-lead', 'Simulator Lead'], ['head-sq', 'Head of Quality'], ['outage-manager', 'Outage Manager'], ['nuc-security', 'Nuclear Security'], ['qc-inspector', 'QC Inspector'], ['nse', 'Engineer'], ['k-ro', 'Reactor Operator']]) await addProfile(p, r);

  // ── seed digests
  const REQ = ['id', 'person_id', 'person_name', 'person_kind', 'target_kind', 'skill_id', 'microcred_def_id', 'level', 'target_title_en', 'target_title_ar', 'target_skill_ids', 'narrative_en', 'narrative_ar', 'status',
    'opened_by', 'opened_role', 'submitted_on', 'outcome', 'credited_level', 'hours', 'nqf_level', 'rationale_en', 'rationale_ar', 'recommended_by', 'recommended_role', 'recommended_on', 'return_note', 'return_count',
    'decided_by', 'decided_role', 'decided_on', 'rpl_statement_en', 'rpl_statement_ar', 'evidence_ids', 'export_count', 'withdrawn_on'];
  const DIGEST = {
    kafaa_rpl_requests: [T.rpl_requests, REQ, ['submitted_on', 'recommended_on', 'decided_on', 'withdrawn_on'], []],
    kafaa_rpl_evidence: [T.rpl_evidence, ['id', 'request_id', 'person_id', 'kind', 'ref_table', 'ref_id', 'title_en', 'title_ar', 'detail_en', 'detail_ar', 'observed_on', 'mirror', 'mirror_status', 'skill_ids', 'attester_id',
      'attester_role_en', 'request_note', 'attestation_status', 'attestation_en', 'attestation_ar', 'attested_on', 'active', 'added_by'], ['observed_on', 'attested_on'], []],
    kafaa_credit_tags: [T.credit_tags, ['id', 'item_kind', 'item_id', 'title_en', 'title_ar', 'nqf_level', 'notional_hours', 'credits', 'indicative', 'basis_en', 'basis_ar', 'stack_ids', 'status', 'listed', 'source_url', 'as_of', 'version'], ['as_of'], ['credits']],
    kafaa_credit_stacks: [T.credit_stacks, ['id', 'title_en', 'title_ar', 'award_en', 'award_ar', 'partner_en', 'partner_ar', 'credits_required', 'nqf_level', 'min_item_nqf', 'rpl_max', 'skill_ids', 'status', 'source_url', 'as_of', 'benchmark_ids'], ['as_of'], []],
    kafaa_credit_ledger: [T.credit_ledger, ['id', 'person_id', 'item_kind', 'item_id', 'tag_id', 'title_en', 'title_ar', 'completed_on', 'source_table', 'source_id', 'notional_hours', 'credits', 'nqf_level', 'stack_ids', 'status'], ['completed_on'], ['credits']],
  };
  const dig = [];
  for (const [t, [rows, cols, dates, nums]] of Object.entries(DIGEST)) {
    const a = (await q(`select * from ${t} order by id`)).map(pick(cols, dates, nums));
    dig.push([t, a.length, same(a, [...rows].sort(byId).map(pick(cols, dates, nums)))]);
  }
  const rplEv = T.skill_evidence.filter((e) => e.ref_table === 'rpl_requests');
  const dbEv = (await q(`select id, person_id, skill_id, kind, level, basis, observed_on, active from kafaa_skill_evidence where ref_table = 'rpl_requests' order by id`)).map(pick(['id', 'person_id', 'skill_id', 'kind', 'level', 'basis', 'observed_on', 'active'], ['observed_on']));
  ok(dig.every((x) => x[2]) && same(dbEv, rplEv.sort(byId).map(pick(['id', 'person_id', 'skill_id', 'kind', 'level', 'basis', 'observed_on', 'active'], ['observed_on']))),
    `the seeded rows load unchanged (row digest = seed.json): ${dig.map(([t, k, s]) => `${t.replace('kafaa_', '')} ${k}${s ? '' : ' DIFF'}`).join(', ')}, RPL evidence ${dbEv.length}`);

  // ── SQL = TS: evidence options, statements, packs, ledger
  // TS runs on the database rows (earlier validators' flows may have changed them), normalised like the LocalBackend store
  const norm = (v) => (v instanceof Date ? v.toISOString() : v);
  const dbWorld = async (tables) => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, (await q(`select * from kafaa_${t} order by id`)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, norm(v)])))])));
  const W = await dbWorld(['ojt_logs', 'task_items', 'qual_standards', 'crew_debrief_members', 'sim_scenarios', 'competencies', 'qual_records', 'skill_evidence', 'opportunity_applications', 'opportunities',
    'rotation_placements', 'contractor_engagements', 'job_roles', 'skills']);
  const CW = await dbWorld(['training_records', 'pathway_enrolments', 'microcred_awards', 'rpl_requests', 'credit_tags', 'credit_stacks']);
  const optPeople = [...new Set([...T.ojt_logs, ...T.crew_debrief_members, ...T.qual_records, ...T.opportunity_applications, ...T.rotation_placements, ...T.contractor_engagements].map((r) => r.person_id))].sort();
  const optDiff = [];
  let optN = 0;
  let restricted = 0;
  for (const p of optPeople) {
    const sql = (await q(`select kafaa_rpl_options($1) r`, [p]))[0].r;
    const ts = rplOptions(p, W);
    optN += ts.length;
    restricted += ts.filter((o) => o.restricted).length;
    if (!same(sql, ts)) optDiff.push(p);
  }
  ok(optDiff.length === 0 && optN > 500 && restricted > 0, `kafaa_rpl_options = rplOptions for ${optPeople.length} people (${optN} records, ${restricted} security-restricted listed without detail)${optDiff.length ? ` DIFF ${optDiff.slice(0, 5)}` : ''}`);
  const decided = T.rpl_requests.filter((r) => r.status === 'decided');
  const stDiff = [];
  for (const r of decided) {
    const s = (await q(`select kafaa_rpl_statement(x, $2::date) s from kafaa_rpl_requests x where x.id = $1`, [r.id, r.decided_on]))[0].s;
    const t = rplStatement(r, T.rpl_evidence.filter((e) => e.request_id === r.id));
    if (!same(s, t) || s.en !== r.rpl_statement_en || s.ar !== r.rpl_statement_ar) stDiff.push(r.id);
  }
  ok(decided.length >= 5 && stDiff.length === 0, `kafaa_rpl_statement = rplStatement and equals the stored statement for the ${decided.length} decided requests${stDiff.length ? ` DIFF ${stDiff}` : ''}`);
  const packDiff = [];
  const people = new Map(T.people.map((p) => [p.id, p]));
  for (const r of decided) {
    const s = (await q(`select kafaa_rpl_pack(x) p from kafaa_rpl_requests x where x.id = $1`, [r.id]))[0].p;
    const p = people.get(r.person_id);
    const t = buildRplPack(r, T.rpl_evidence.filter((e) => e.request_id === r.id), { initials: p.initials, kind: r.person_kind, job_role_id: p.job_role_id ?? null });
    if (!same(s, t) || !packIsClean(s) || s.format !== PACK_FORMAT) packDiff.push(r.id);
  }
  ok(packDiff.length === 0, `kafaa_rpl_pack = buildRplPack for every decided request, and no pack carries FANR wording${packDiff.length ? ` DIFF ${packDiff}` : ''}`);
  const maskIn = ['Passed the FANR (Federal Authority for Nuclear Regulation) inspection walkdown', 'Briefed the Federal Authority for Nuclear Regulation team', 'The FANR inspector signed it (ref FANR-REG-11)', 'اجتاز تفتيش الهيئة الاتحادية للرقابة النووية', 'No regulator named here'];
  const maskDiff = [];
  for (const m of maskIn) { const sq = (await q(`select kafaa_rpl_mask($1) r`, [m]))[0].r; if (sq !== maskFanr(m) || !packIsClean(sq)) maskDiff.push(`${m} -> ${sq} / ${maskFanr(m)}`); }
  ok(maskDiff.length === 0, `kafaa_rpl_mask = maskFanr (acronym, full name, parentheses, Arabic)${maskDiff.length ? ` DIFF ${maskDiff}` : ''}`);
  const credPeople = [...new Set([...T.credit_ledger.map((r) => r.person_id), ...CW.training_records.map((r) => r.person_id)])].sort();
  const crDiff = [];
  let total = 0;
  for (const p of credPeople) {
    const s = (await q(`select kafaa_cr_compute($1) r`, [p]))[0].r.map((x) => ({ ...x, credits: Number(x.credits) }));
    const t = creditsFor(p, { ...CW, credit_tags: CW.credit_tags.map((x) => ({ ...x, notional_hours: Number(x.notional_hours) })) });
    if (!same(s, t)) crDiff.push(p);
  }
  for (const p of [...new Set(T.credit_ledger.map((r) => r.person_id))]) total += ledgerTotal(creditsFor(p, T));
  const sqlTotal = Number((await q(`select coalesce(sum(notional_hours), 0) / 10.0 t from kafaa_credit_ledger where status = 'counted'`))[0].t);
  ok(crDiff.length === 0 && Math.abs(sqlTotal - total) < 1e-9 && credPeople.length > 50, `acceptance (FS30): kafaa_cr_compute = creditsFor for ${credPeople.length} people; the stored ledger total (${sqlTotal} credits) = the sum of completed items${crDiff.length ? ` DIFF ${crDiff.slice(0, 5)}` : ''}`);
  const cur = await q(`select d.id, t.nqf_level, t.indicative, t.credits from kafaa_microcred_defs d left join kafaa_credit_tags t on t.item_kind = 'microcred' and t.item_id = d.id and t.status = 'published' where d.status = 'current'`);
  ok(cur.length > 0 && cur.every((x) => x.nqf_level >= 1 && x.indicative === true && Number(x.credits) > 0), `acceptance (FS30): every current micro-credential (${cur.length}) has an indicative NQF level and credit tag`);
  const badTag = /check/i.test(await db.query(`insert into kafaa_credit_tags (id, item_kind, item_id, title_en, title_ar, nqf_level, notional_hours, credits, indicative, basis_en, basis_ar, source_url, as_of) values ('ct:x', 'course', 'c-hu', 'x', 'x', 4, 20, 2, false, 'x', 'x', 'https://x.org', '2026-10-10')`).then(() => '', (e) => e.message));
  ok(badTag, 'a tag cannot be stored without the indicative flag (DB check)');

  // ── RLS
  ok(await count(null, 'kafaa_credit_tags') === T.credit_tags.filter((t) => t.listed).length && await count(null, 'kafaa_credit_stacks') === 4 && await count(null, 'kafaa_rpl_requests') === 0
    && await count(null, 'kafaa_rpl_evidence') === 0 && await count(null, 'kafaa_credit_ledger') === 0, 'RLS: anonymous visitors read published tags and stacks, never requests, evidence or ledgers');
  const sroReq = T.rpl_requests.filter((r) => r.person_id === 'p-sro').length;
  const sroLed = T.credit_ledger.filter((r) => r.person_id === 'p-sro').length;
  ok(await count('sro', 'kafaa_rpl_requests') === sroReq && await count('sro', 'kafaa_credit_ledger') === sroLed && await count('sro', 'kafaa_credit_ledger', `person_id <> kafaa_me()`) === 0,
    `RLS: staff read only their own requests (${sroReq}) and ledger (${sroLed}); a manager's scope does not open other people's RPL`);
  ok(await count('chco', 'kafaa_rpl_requests') === T.rpl_requests.length && await count('k-auditor', 'kafaa_rpl_requests') === T.rpl_requests.length && await count('k-instructor', 'kafaa_rpl_evidence') === T.rpl_evidence.length
    && await count('k-auditor', 'kafaa_credit_ledger') === T.credit_ledger.length && await count('chco', 'kafaa_credit_ledger', `person_id <> kafaa_me()`) === 0,
    'RLS: assessors and the HR director (recognition A) and auditors (R) read every request and evidence item; ledgers stay personal (auditors read them through audit_log R)');
  const att = T.rpl_evidence.filter((e) => e.attester_id === 'p-outage-manager');
  ok(att.length === 1 && await count('outage-manager', 'kafaa_rpl_evidence') === 1 && await count('outage-manager', 'kafaa_rpl_requests') === 0, 'RLS: the named supervisor reads only the attestation addressed to them');

  // ── RPC flows (one audit row per call; ledger only on a confirmed decision)
  const auditN = async () => Number((await q(`select count(*)::int n from kafaa_audit_events`))[0].n);
  const ledgerN = async () => Number((await q(`select count(*)::int n from ledger_entries`).catch(() => [{ n: 0 }]))[0].n);
  const a0 = await auditN();
  const l0 = await ledgerN();
  let calls = 0;
  const sub = (p, input) => { calls++; return one(p, `select kafaa_submit_rpl($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r); };
  const dec = (p, input) => { calls++; return one(p, `select kafaa_decide_rpl($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r); };
  const att2 = (p, input) => { calls++; return one(p, `select kafaa_attest_rpl($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r); };
  const exp = (p, id) => { calls++; return one(p, `select kafaa_export_rpl($1) r`, [id]).then((x) => x.r); };
  const tag = (p, input) => { calls++; return one(p, `select kafaa_tag_credit($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r); };
  const syn = (p, id) => { calls++; return one(p, `select kafaa_sync_credits($1) r`, [id]).then((x) => x.r); };
  const anon = await one(null, `select kafaa_submit_rpl('{}'::jsonb) r`).then(() => 'executed', (e) => String(e.message));
  ok(anon.includes('permission denied'), 'anonymous callers cannot execute the RPL RPCs');
  const NARR = { narrative_en: 'Six years leading primary system walkdowns and post-maintenance testing.', narrative_ar: 'ست سنوات في قيادة جولات النظام الأولي واختبارات ما بعد الصيانة.' };
  // open refusals
  const o2 = await sub('sro', { action: 'open', target_kind: 'skill', skill_id: 'sk-sa-01', level: 2, ...NARR });
  const o3 = await sub('sro', { action: 'open', target_kind: 'skill', skill_id: 'sk-pf-01', level: 4, ...NARR });
  const o4 = await sub('sro', { action: 'open', target_kind: 'skill', skill_id: 'sk-fs-ai-verify', level: 3, ...NARR });
  const o5 = await sub('sro', { action: 'open', person_id: 'p-k-contractor', target_kind: 'skill', skill_id: 'sk-mp-01', level: 3, ...NARR });
  const o6 = await sub('training-mgr', { action: 'open', person_id: 'p-sro', target_kind: 'skill', skill_id: 'sk-pf-02', level: 4, ...NARR });
  const o7 = await sub('sro', { action: 'open', target_kind: 'skill', skill_id: 'sk-fs-dp-paperwp', level: 1, ...NARR });
  ok(o2.code === 'security_restricted' && o2.message === RPL_MSG.restricted && o3.code === 'not_eligible' && o4.code === 'conflict' && o5.code === 'forbidden' && o6.code === 'forbidden' && o6.message === RPL_MSG.behalf && o7.code === 'obsolete',
    'open refusals: security skills (security_restricted), already held, an open request already exists, staff cannot open for others, assessors open on behalf of contractors only, obsolete skills');
  // the full flow on an original skill: open, attach, refuse a restricted item, attest, submit, maker-checker, confirm
  const op = await sub('sro', { action: 'open', target_kind: 'skill', skill_id: 'sk-pf-02', level: 4, ...NARR });
  const id = op.data?.id;
  const opts = rplOptions('p-sro', W);
  const sim = opts.filter((o) => o.kind === 'simulator').slice(0, 2);
  const at1 = await sub('sro', { action: 'attach', id, kind: 'simulator', ref_table: sim[0].ref_table, ref_id: sim[0].ref_id });
  const at2 = await sub('sro', { action: 'attach', id, kind: 'simulator', ref_table: sim[1].ref_table, ref_id: sim[1].ref_id });
  const dup = await sub('sro', { action: 'attach', id, kind: 'simulator', ref_table: sim[1].ref_table, ref_id: sim[1].ref_id });
  const other = await sub('sro', { action: 'attach', id, kind: 'qualification', ref_table: 'qual_records', ref_id: 'qr-p-nuc-security-qs-sec' });
  const early = await sub('sro', { action: 'submit', id: 'rpl-p-nse-01' });
  ok(op.ok && id === 'rpl-p-sro-03' && at1.ok && at2.ok && dup.code === 'conflict' && other.code === 'not_found' && other.message === RPL_MSG.item && early.code === 'forbidden',
    'the person opens a request and attaches their own simulator debriefs; duplicates and other people\'s records are refused; only the opener changes a request');
  // security-restricted item (FS29 acceptance)
  const ns = await sub('nuc-security', { action: 'open', target_kind: 'skill', skill_id: 'sk-hu-01', level: 3, ...NARR });
  const nsr = await sub('nuc-security', { action: 'attach', id: ns.data?.id, kind: 'qualification', ref_table: 'qual_records', ref_id: 'qr-p-nuc-security-qs-sec' });
  const nsOpt = (await one('nuc-security', `select kafaa_rpl_evidence_options(null) r`)).r.find((o) => o.ref_id === 'qr-p-nuc-security-qs-sec');
  ok(ns.ok && nsr.code === 'security_restricted' && nsr.message === RPL_MSG.security_restricted && nsOpt.restricted && nsOpt.title_en === 'Security-restricted record' && nsOpt.skill_ids.length === 0
    && await count('chco', 'kafaa_rpl_evidence', `ref_id = 'qr-p-nuc-security-qs-sec'`) === 0,
    'acceptance (FS29): no security-restricted item can be attached (refusal code security_restricted); it is listed without detail');
  const ar1 = await sub('sro', { action: 'attach', id, kind: 'attestation', attester_id: 'p-sro', note: 'Please confirm my plant knowledge.' });
  const ar2 = await sub('sro', { action: 'attach', id, kind: 'attestation', attester_id: 'p-outage-manager', note: 'Please confirm my primary system walkdowns.' });
  const eid = ar2.data?.evidence_id;
  const ta0 = await att2('qc-inspector', { evidence_id: eid, confirm: true, text_en: 'x'.repeat(30) });
  const ta1 = await att2('outage-manager', { evidence_id: eid, confirm: true, text_en: 'short' });
  const ta2 = await att2('outage-manager', { evidence_id: eid, confirm: true, text_en: 'They led the primary system walkdowns for three outages and trained new operators on them.' });
  ok(ar1.code === 'invalid' && ar1.message === RPL_MSG.attester && ar2.ok && ta0.code === 'forbidden' && ta1.code === 'invalid' && ta2.ok && ta2.data.status === 'confirmed',
    'attestations: the person cannot attest for themselves; only the named supervisor answers, with a statement of 20+ characters');
  const sb = await sub('sro', { action: 'submit', id });
  const re1 = await dec('sro', { action: 'recommend', id, outcome: 'full', credited_level: 4, hours: 40, rationale_en: 'x'.repeat(30), rationale_ar: 'ق'.repeat(30) });
  const re2 = await dec('sq-lead', { action: 'recommend', id, outcome: 'full', credited_level: 3, hours: 40, rationale_en: 'x'.repeat(30), rationale_ar: 'ق'.repeat(30) });
  const re3 = await dec('sq-lead', { action: 'recommend', id, outcome: 'partial', credited_level: 3, hours: 30, rationale_en: 'Two debriefs and a confirmed attestation support independent practice.', rationale_ar: 'جلستا استخلاص وإفادة مؤكدة تدعم الممارسة المستقلة.' });
  const mc = await dec('sq-lead', { action: 'confirm', id });
  ok(sb.ok && re1.code === 'forbidden' && re1.message === RPL_MSG.forbidden_assessor && re2.code === 'invalid' && re2.message === RPL_MSG.level_decide && re3.ok && mc.code === 'maker_checker' && mc.message === RPL_MSG.maker_checker,
    'acceptance (FS29): a decision needs two different people: staff cannot decide, the recommender cannot confirm (maker_checker); full credit is at the requested level');
  const states0 = (await q(`select level, basis from kafaa_person_skills where id = 'ps:p-sro:sk-pf-02'`))[0];
  const lb = await ledgerN();
  const cf = await dec('training-mgr', { action: 'confirm', id });
  const row = (await q(`select * from kafaa_rpl_requests where id = $1`, [id]))[0];
  const ev = (await q(`select * from kafaa_skill_evidence where id = 'se:rpl:${id}:sk-pf-02'`))[0];
  const states1 = (await q(`select level, basis, evidence_count from kafaa_person_skills where id = 'ps:p-sro:sk-pf-02'`))[0];
  const led = (await q(`select * from kafaa_credit_ledger where id = 'cl:p-sro:rpl:${id}'`))[0];
  ok(cf.ok && row.status === 'decided' && row.decided_by === 'p-training-mgr' && row.recommended_by === 'p-sq-lead' && ev && ev.kind === 'credential' && ev.basis === 'validated' && ev.level === 3
    && states1 && states1.level >= 3 && (!states0 || states1.evidence_count >= 1) && led && Number(led.credits) === 3 && led.status === 'counted' && (await ledgerN()) === lb + 1 && cf.ledger_seq != null,
    `acceptance (FS29): credit is written as validated evidence (level 3) and recomputes skills (sk-pf-02 now level ${states1?.level}); the credit ledger gains the RPL row; one NEXUS ledger row`);
  const st = rplStatement({ ...row, decided_on: d10(row.decided_on) }, (await q(`select * from kafaa_rpl_evidence where request_id = $1`, [id])).map((e) => ({ ...e, observed_on: d10(e.observed_on) })));
  ok(row.rpl_statement_en === st.en && row.rpl_statement_ar === st.ar && /partial credit/.test(st.en) && /اعتراف جزئي/.test(st.ar), 'the stored RPL statement (EN, AR) = rplStatement');
  const ex0 = await exp('qc-inspector', id);
  const ex1 = await exp('sro', id);
  const ex2 = await exp('k-auditor', id);
  const exNo = await exp('sro', 'rpl-p-sro-02');
  ok(ex0.code === 'forbidden' && ex1.ok && ex2.ok && packIsClean(ex1.data) && same(ex1.data, ex2.data) && ex1.data.subject.initials === 'SR' && !JSON.stringify(ex1.data).includes('Shift Manager ·') && exNo.code === 'invalid',
    'acceptance (FS29): the NQC-ready export carries no FANR wording, initials only and roles not names; the person and auditors export, other staff cannot; only decided requests export');
  const evRows = (await q(`select * from kafaa_rpl_evidence where request_id = $1`, [id])).map((e) => ({ ...e, observed_on: d10(e.observed_on), attested_on: d10(e.attested_on) }));
  const rowTs = { ...row, decided_on: d10(row.decided_on), submitted_on: d10(row.submitted_on), recommended_on: d10(row.recommended_on), withdrawn_on: d10(row.withdrawn_on) };
  ok(same(ex1.data, buildRplPack(rowTs, evRows, { initials: 'SR', kind: 'staff', job_role_id: 'shift-supervisor' })), 'the exported pack = buildRplPack on the stored rows');
  // return path and self-decision
  const ret = await dec('training-mgr', { action: 'return', id: 'rpl-p-k-lo-trainee-01', note: 'short' });
  const ret2 = await dec('training-mgr', { action: 'return', id: 'rpl-p-k-ro-01', note: 'Please link the simulator debriefs to each criterion before recommending.' });
  const rr = (await q(`select status, return_count, recommended_by, outcome from kafaa_rpl_requests where id = 'rpl-p-k-ro-01'`))[0];
  ok(ret.code === 'invalid' && ret2.ok && rr.status === 'submitted' && rr.return_count === 1 && rr.recommended_by === null && rr.outcome === null, 'a second assessor can return a recommendation with a note (back to submitted, recommendation cleared)');
  const tmo = await sub('training-mgr', { action: 'open', target_kind: 'skill', skill_id: 'sk-fs-ai-twin', level: 1, ...NARR });
  await db.query(`update kafaa_rpl_requests set status = 'submitted' where id = $1`, [tmo.data?.id]);
  const self = await dec('training-mgr', { action: 'recommend', id: tmo.data?.id, outcome: 'full', credited_level: 1, hours: 10, rationale_en: 'x'.repeat(30), rationale_ar: 'ق'.repeat(30) });
  ok(tmo.ok && self.code === 'maker_checker' && self.message === RPL_MSG.self, 'nobody decides their own RPL request');
  const wd = await sub('nuc-security', { action: 'withdraw', id: ns.data?.id });
  ok(wd.ok && (await q(`select status from kafaa_rpl_requests where id = $1`, [ns.data?.id]))[0].status === 'withdrawn', 'a request is withdrawn, never deleted');

  // ── FS30 tag editing and ledger sync
  const tg0 = await tag('sro', { item_kind: 'course', item_id: 'c-hu', nqf_level: 4, notional_hours: 30, basis_en: 'x'.repeat(30), basis_ar: 'ق'.repeat(30) });
  const tg1 = await tag('k-instructor', { item_kind: 'course', item_id: 'c-hu', nqf_level: 11, notional_hours: 30, basis_en: 'x'.repeat(30), basis_ar: 'ق'.repeat(30) });
  const tg2 = await tag('k-instructor', { item_kind: 'pathway', item_id: 'nope', nqf_level: 4, notional_hours: 30, basis_en: 'x'.repeat(30), basis_ar: 'ق'.repeat(30) });
  const tg3 = await tag('k-instructor', { item_kind: 'course', item_id: 'c-hu', nqf_level: 4, notional_hours: 30, basis_en: 'x'.repeat(30), basis_ar: 'ق'.repeat(30), stack_ids: ['st-nope'] });
  const before = (await q(`select * from kafaa_credit_tags where id = 'ct:course:c-hu'`))[0];
  const tg4 = await tag('k-instructor', { item_kind: 'course', item_id: 'c-hu', nqf_level: 4, notional_hours: 37, basis_en: 'Twelve contact hours with practice on real work packages and a briefing log.', basis_ar: 'اثنتا عشرة ساعة تواصل مع ممارسة على حزم عمل فعلية وسجل إحاطات.', stack_ids: ['st-safe-performance'] });
  const after = (await q(`select * from kafaa_credit_tags where id = 'ct:course:c-hu'`))[0];
  ok(tg0.code === 'forbidden' && tg0.message === CR_MSG.forbidden && tg1.message === CR_MSG.nqf && tg2.code === 'not_found' && tg3.message === CR_MSG.stack && tg4.ok && after.version === before.version + 1 && Number(after.credits) === 3.7 && after.indicative,
    `framework owners tag items (credits = hours / 10, always indicative, version up); staff cannot; invalid levels, items and stacks are refused (${tg4.data?.synced} ledgers re-synced)`);
  const hold = (await q(`select count(*)::int n from kafaa_credit_ledger where tag_id = 'ct:course:c-hu' and status = 'counted' and notional_hours = 37`))[0].n;
  const rt = await tag('k-instructor', { item_kind: 'course', item_id: 'c-hu', retire: true });
  const rev = (await q(`select count(*)::int n from kafaa_credit_ledger where tag_id = 'ct:course:c-hu' and status = 'reversed'`))[0].n;
  ok(hold > 0 && rt.ok && rev === hold && await count(null, 'kafaa_credit_tags', `id = 'ct:course:c-hu'`) === 0, `retiring a tag reverses (never deletes) the ${hold} ledger rows that used it and unlists it`);
  const sy0 = await syn('sro', 'p-chco');
  const sy1 = await syn('sro', null);
  const sy2 = await syn('training-mgr', null);
  const mismatch = [];
  for (const p of (await q(`select distinct person_id from kafaa_credit_ledger order by 1`)).map((r) => r.person_id)) {
    const want = (await q(`select kafaa_cr_compute($1) r`, [p]))[0].r;
    const got = (await q(`select coalesce(sum(notional_hours), 0)::int h from kafaa_credit_ledger where person_id = $1 and status = 'counted'`, [p]))[0].h;
    if (want.reduce((a, r) => a + r.notional_hours, 0) !== got) mismatch.push(p);
  }
  ok(sy0.code === 'forbidden' && sy1.ok && sy1.data.people === 1 && sy2.ok && sy2.data.people > 50 && mismatch.length === 0,
    'acceptance (FS30): after edits and a sync every ledger total equals the sum of completed items; staff refresh only their own ledger');
  ok((await auditN()) - a0 === calls && (await ledgerN()) === l0 + 1, `every call wrote exactly one audit row (${calls} calls) and only the confirmed decision wrote a NEXUS ledger row`);

  // ── grants and additive SQL
  const fns = ['kafaa_rpl_str', 'kafaa_rpl_is_int', 'kafaa_rpl_isnull', 'kafaa_rpl_options', 'kafaa_rpl_check_open', 'kafaa_rpl_check_attach', 'kafaa_rpl_check_decide', 'kafaa_rpl_result_code', 'kafaa_rpl_message',
    'kafaa_rpl_statement', 'kafaa_rpl_mask', 'kafaa_rpl_pack', 'kafaa_rpl_notify', 'kafaa_cr_nqf', 'kafaa_rpl_max_align', 'kafaa_cr_compute', 'kafaa_cr_sync', 'kafaa_cr_check_tag', 'kafaa_cr_message', 'kafaa_cr_people',
    'kafaa_submit_rpl', 'kafaa_attest_rpl', 'kafaa_decide_rpl', 'kafaa_export_rpl', 'kafaa_rpl_evidence_options', 'kafaa_tag_credit', 'kafaa_sync_credits'];
  const exec = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth from pg_proc p where p.proname = any($1)`, [fns]);
  ok(exec.length === fns.length && exec.every((x) => !x.anon) && exec.filter((x) => x.auth).map((x) => x.proname).sort().join(',') === 'kafaa_attest_rpl,kafaa_decide_rpl,kafaa_export_rpl,kafaa_rpl_evidence_options,kafaa_submit_rpl,kafaa_sync_credits,kafaa_tag_credit',
    'anon executes none of the FS29/FS30 functions; authenticated only the 7 RPCs');
  const sqlText = readFileSync(`supabase/migrations/${MINE}`, 'utf8').replace(/--.*$/gm, '');
  ok(!/\b(drop|truncate|delete\s+from)\b/i.test(sqlText) && [...sqlText.matchAll(/\b(?:alter|create)\s+(?:table|policy|function|or replace function|index if not exists|unique index if not exists|trigger)\s+(?:if not exists\s+)?(?:kafaa_read\s+on\s+)?([a-z_]+)/gi)].every((m) => m[1].startsWith('kafaa_')),
    'the migration only touches kafaa_* objects and never drops, deletes or truncates');
}
