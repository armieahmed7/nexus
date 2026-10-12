// [FS wave I · E1 · FS78 + FS79] PGlite checks for 20261010291001_kafaa_fs91_balance_external_certs.sql: the seeded rows load
// unchanged (row digests = seed.json); SQL = TS for grantFor, balanceOf (every balance; the stored columns too), the outcome gate, checkRequest,
// checkDecide, issuerTier / trustTier, certMapping, checkSubmit, checkVerify and the messages; RLS (anonymous visitors read nothing; a balance
// is read by its person, the line manager in scope and HR, never by RPL assessors; requests also by the named line manager; certificates by
// the holder, verifiers and auditors); FS78 acceptance (the balance equals grants minus approved use; ungated items cannot be charged;
// decisions need a second person and write an audit row); FS79 acceptance (unverified certificates never become evidence above "claimed";
// verified imports map to skills only through reviewed crosswalk rows; the tier is returned wherever the credential is read); one audit
// row per call, a ledger row only on an approval, a verification or a revocation; DB checks; grants; additive SQL only. RPC flows run inside
// a rolled-back transaction. Prints the md5 of every new function body and every new table's digest (for the live comparison).
import { readFileSync } from 'node:fs';
import { SB_MSG, balanceOf, checkDecide, checkRequest, grantFor, sbResultCode } from '../../src/modules/m34/balance.ts';
import { XC_MSG, certMapping, checkSubmit, checkVerify, issuerTier, trustTier, xcResultCode, ISSUER_KINDS, TIERS } from '../../src/modules/m34/extcerts.ts';
import { catalogueCheck } from '../../src/modules/m19/pathways.ts';

const MINE = '20261010291001_kafaa_fs91_balance_external_certs.sql';
const TABLES = ['learning_balances', 'study_time_requests', 'external_certs'];
export const FS91_FUNCS = ['kafaa_fs91_trim', 'kafaa_fs91_s', 'kafaa_fs91_is_date', 'kafaa_fs91_hist', 'kafaa_fs91_notify', 'kafaa_lb_grant', 'kafaa_lb_compute', 'kafaa_lb_refresh',
  'kafaa_sb_gated', 'kafaa_sb_cap', 'kafaa_sb_check_request', 'kafaa_sb_check_decide', 'kafaa_sb_message', 'kafaa_sb_result_code', 'kafaa_sb_visible', 'kafaa_request_study_time',
  'kafaa_decide_study_time', 'kafaa_learning_balance', 'kafaa_xc_issuer_tier', 'kafaa_xc_trust_tier', 'kafaa_xc_cap', 'kafaa_xc_basis', 'kafaa_xc_map', 'kafaa_xc_len', 'kafaa_xc_optlen',
  'kafaa_xc_check_submit', 'kafaa_xc_check_verify', 'kafaa_xc_message', 'kafaa_xc_note_message', 'kafaa_xc_result_code', 'kafaa_submit_external_cert', 'kafaa_verify_external_cert'];
const RPCS = ['kafaa_decide_study_time', 'kafaa_learning_balance', 'kafaa_request_study_time', 'kafaa_submit_external_cert', 'kafaa_verify_external_cert'];
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : typeof x === 'number' ? Number(x) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
let seedR = 91;
const rnd = () => { seedR = (seedR * 1103515245 + 12345) % 2147483648; return seedR / 2147483648; };
const pickR = (a) => a[Math.floor(rnd() * a.length)];

export default async function fs91Checks({ db, as, one, count, ok, uid }) {
  console.log('FS wave I · E1 · FS78 learning balance and protected study time + FS79 verified external certificates (M34)');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const q1 = async (sql, p = []) => (await q(sql, p))[0];
  let n = 9101;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  for (const [p, r] of [['k-ro', 'Reactor Operator'], ['outage-manager', 'Outage Manager'], ['outage-planner', 'Outage Planner'], ['qc-inspector', 'QC Inspector'], ['nse', 'Engineer'],
    ['sq-lead', 'Simulator Lead'], ['head-sq', 'Head of Quality'], ['k-contractor', 'Contractor'], ['buyer', 'Buyer'], ['k-lo-trainee', 'Trainee']]) await addProfile(p, r);
  const today = d10((await q1('select current_date d')).d);

  // ── seed digests (my tables only; the seed row literals are the live load)
  const pick = (cols, dates = [], nums = []) => (r) => Object.fromEntries(cols.map((c) => [c, dates.includes(c) ? d10(r[c]) : nums.includes(c) ? (r[c] == null ? null : Number(r[c])) : r[c] ?? null]));
  const DIG = {
    learning_balances: [['id', 'person_id', 'year', 'base_hours', 'topup_hours', 'topup_basis', 'service_years', 'granted_hours', 'used_hours', 'pending_hours', 'remaining_hours', 'simulated', 'open_read'], [], []],
    study_time_requests: [['id', 'person_id', 'person_name', 'line_manager_id', 'year', 'resource_id', 'resource_title_en', 'hours', 'credits', 'starts_on', 'ends_on', 'pattern', 'reason', 'status',
      'decided_by', 'decided_role', 'decided_on', 'decision_note', 'history', 'open_read'], ['starts_on', 'ends_on', 'decided_on'], ['credits']],
    external_certs: [['id', 'person_id', 'title', 'issuer', 'issuer_kind', 'accreditation_ref', 'credential_ref', 'issued_on', 'expires_on', 'verification_url', 'resource_id', 'alignment_ids', 'levels',
      'status', 'tier', 'method', 'verified_by', 'verified_role', 'verified_on', 'decision_note', 'mapped', 'evidence_ids', 'history'], ['issued_on', 'expires_on', 'verified_on'], []],
  };
  const dig = [];
  for (const [t, [cols, dates, nums]] of Object.entries(DIG)) {
    const a = (await q(`select * from kafaa_${t} order by id`)).map(pick(cols, dates, nums));
    dig.push([t, a.length, same(a, [...T[t]].sort(byId).map(pick(cols, dates, nums)))]);
  }
  const EVC = ['id', 'person_id', 'skill_id', 'kind', 'ref_id', 'level', 'basis', 'observed_on', 'active'];
  const dbEv = (await q(`select * from kafaa_skill_evidence where ref_table = 'external_certs' order by id`)).map(pick(EVC, ['observed_on']));
  const seedEv = T.skill_evidence.filter((e) => e.ref_table === 'external_certs').sort(byId).map(pick(EVC, ['observed_on']));
  ok(dig.every((x) => x[2]) && same(dbEv, seedEv) && dbEv.length === 9, `the seeded rows load unchanged (row digest = seed.json): ${dig.map(([t, k, s]) => `${t} ${k}${s ? '' : ' DIFF'}`).join(', ')}, certificate evidence ${dbEv.length}`);
  const md5s = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1) order by 1`, [FS91_FUNCS]);
  console.log(`    md5 ${md5s.map((r) => `${r.proname}=${r.m}`).join(' ')}`);
  for (const t of TABLES) {
    const d = await q1(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_${t} x`);
    console.log(`    digest kafaa_${t} ${d.n} ${d.dg}`);
  }
  const ed = await q1(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_skill_evidence x where ref_table = 'external_certs'`);
  console.log(`    digest kafaa_skill_evidence[external_certs] ${ed.n} ${ed.dg}`);

  // ── SQL = TS (FS78)
  const norm = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
  const rowsOf = async (t, where = 'true') => (await q(`select * from kafaa_${t} where ${where} order by id`)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, norm(v)])));
  const people = await rowsOf('people');
  let gDiff = [];
  for (const p of people) for (const y of [2018, 2025, 2026, 2030]) {
    const s = (await q1('select kafaa_lb_grant($1, $2) r', [p.id, y])).r;
    if (!same(s, grantFor(p, y))) gDiff.push(`${p.id}/${y}`);
  }
  ok(gDiff.length === 0 && people.length > 300, `kafaa_lb_grant = grantFor for ${people.length} people x 4 years (top-up from years of service only)${gDiff.length ? ` DIFF ${gDiff.slice(0, 5)}` : ''}`);
  const balances = await rowsOf('learning_balances');
  const reqs = await rowsOf('study_time_requests');
  const bDiff = [];
  for (const b of balances) {
    const s = (await q1('select kafaa_lb_compute($1, $2) r', [b.person_id, b.year])).r;
    const t = balanceOf(b, reqs);
    if (!same(s, t) || b.used_hours !== t.used_hours || b.pending_hours !== t.pending_hours || b.remaining_hours !== t.remaining_hours || b.granted_hours !== t.granted_hours) bDiff.push(b.id);
  }
  const usedSql = Number((await q1(`select coalesce(sum(hours), 0)::int h from kafaa_study_time_requests where status = 'approved'`)).h);
  const usedRows = balances.reduce((a, b) => a + b.used_hours, 0);
  ok(bDiff.length === 0 && balances.length === 106 && usedSql === usedRows && usedSql > 0,
    `acceptance (FS78): the balance equals grants minus approved use (TS = SQL) for all ${balances.length} balances; stored used / pending / remaining = balanceOf; ${usedSql} approved hours${bDiff.length ? ` DIFF ${bDiff.slice(0, 5)}` : ''}`);
  const crit = await rowsOf('catalogue_criteria');
  const skillsW = await rowsOf('skills');
  const resW = (await q('select to_jsonb(x) j from kafaa_external_resources x order by id')).map((r) => r.j);
  const gateTs = (x) => x.status === 'published' && x.listed === true && catalogueCheck(x, crit, skillsW, today).ok;
  const gtDiff = [];
  for (const x of resW) if ((await q1('select kafaa_sb_gated($1, current_date) g', [x.id])).g !== gateTs(x)) gtDiff.push(x.id);
  const ungated = resW.filter((x) => !gateTs(x)).map((x) => x.id);
  ok(gtDiff.length === 0 && ungated.length >= 3, `the outcome gate: kafaa_sb_gated = published + listed + catalogueCheck for ${resW.length} catalogue items (${ungated.length} ungated: ${ungated.join(', ')})${gtDiff.length ? ` DIFF ${gtDiff}` : ''}`);
  // checkRequest on generated cases
  const pById = new Map(people.map((p) => [p.id, p]));
  const leaver = people.find((p) => p.status === 'leaver');
  const contractor = people.find((p) => p.kind === 'contractor');
  const base = { resource_id: 'xr-ai-for-everyone', hours: 4, starts_on: `${today.slice(0, 4)}-12-01`, ends_on: `${today.slice(0, 4)}-12-20`, pattern: 'release_days', reason: 'AI literacy course for my plant role' };
  const variants = [{}, { hours: 1 }, { hours: 7 }, { hours: 2.5 }, { hours: '4' }, { hours: null }, { pattern: 'weekends' }, { pattern: 3 }, { starts_on: '2020-01-01' }, { ends_on: '2027-01-02' },
    { starts_on: `${today.slice(0, 4)}-12-21` }, { starts_on: '2026-02-30' }, { ends_on: 5 }, { reason: 'short' }, { reason: 'x'.repeat(301) }, { reason: 42 }, { reason: '   ten chars ok   ' }];
  const items = [['xr-ai-for-everyone', true], ['xr-nea-nest', true], ['xr-enen2plus', false], [null, false]];
  const cases = [];
  for (const v of variants) cases.push({ input: { ...base, ...v }, person: 'p-k-ro', item: items[0], available: 50, open: false, lm: 'p-sro' });
  for (let i = 0; i < 160; i++) {
    const inp = { ...base };
    for (const v of [pickR(variants), pickR(variants)]) Object.assign(inp, v);
    if (rnd() < 0.3) inp.hours = pickR([2, 6, 20, 40, 41]);
    cases.push({ input: inp, person: pickR(['p-k-ro', 'p-k-ro', contractor?.id, leaver?.id, null]), item: pickR(items), available: pickR([0, 3, 30, 100]), open: rnd() < 0.15, lm: rnd() < 0.15 ? null : 'p-sro' });
  }
  const rqDiff = [];
  const codes = new Set();
  for (const c of cases) {
    const it = c.item[0] ? resW.find((x) => x.id === c.item[0]) : null;
    const s = (await q1(`select kafaa_sb_check_request($1::jsonb, (select p from kafaa_people p where id = $2), (select x from kafaa_external_resources x where id = $3), $4, $5, $6, $7, $8::date) r`,
      [JSON.stringify(c.input), c.person, c.item[0], c.item[1], c.available, c.open, c.lm, today])).r;
    const t = checkRequest(c.input, { today, person: c.person ? pById.get(c.person) : null, item: it ? { id: it.id, hours: it.hours == null ? null : Number(it.hours), gated: c.item[1] } : null, available: c.available, openSame: c.open, lineManager: c.lm });
    codes.add(t);
    if (s !== t) rqDiff.push(`${JSON.stringify(c.input)} ${s}/${t}`);
  }
  ok(rqDiff.length === 0 && codes.size >= 9, `kafaa_sb_check_request = checkRequest on ${cases.length} generated requests (${[...codes].sort().join(', ')})${rqDiff.length ? ` DIFF ${rqDiff.slice(0, 3)}` : ''}`);
  const dcDiff = [];
  const dcodes = new Set();
  for (const r of reqs) for (const me of [r.person_id, r.line_manager_id, 'p-chco', 'p-qc-inspector']) for (const hr of [false, true]) for (const d of ['approve', 'decline', 'cancel']) for (const note of ['', 'Please move it to January']) for (const rem of [0, 100]) {
    const inp = { id: r.id, decision: d, note };
    const s = (await q1(`select kafaa_sb_check_decide($1::jsonb, (select x from kafaa_study_time_requests x where id = $2), $3, $4, $5, $6::date) r`, [JSON.stringify(inp), r.id, me, hr, rem, today])).r;
    const t = checkDecide(inp, r, me, { today, hr, remaining: rem });
    dcodes.add(t);
    if (s !== t) dcDiff.push(`${r.id} ${me} ${d} ${s}/${t}`);
    if (dcDiff.length > 5) break;
  }
  ok(dcDiff.length === 0 && dcodes.size >= 6, `kafaa_sb_check_decide = checkDecide on every seeded request x deciders x decisions (${[...dcodes].sort().join(', ')})${dcDiff.length ? ` DIFF ${dcDiff.slice(0, 3)}` : ''}`);
  const msgDiff = Object.keys(SB_MSG).filter(() => false);
  for (const k of Object.keys(SB_MSG)) { if ((await q1('select kafaa_sb_message($1) m', [k])).m !== SB_MSG[k]) msgDiff.push(k); if ((await q1('select kafaa_sb_result_code($1) c', [k])).c !== sbResultCode(k)) msgDiff.push(`code:${k}`); }
  for (const k of Object.keys(XC_MSG)) {
    const want = k === 'note' ? XC_MSG.note : k === 'reason' ? XC_MSG.reason : XC_MSG[k];
    const got = k === 'note' ? (await q1('select kafaa_xc_note_message($1) m', [k])).m : k === 'reason' ? (await q1(`select kafaa_xc_message('note') m`)).m : (await q1('select kafaa_xc_message($1) m', [k])).m;
    if (got !== want) msgDiff.push(`xc:${k}`);
    if ((await q1('select kafaa_xc_result_code($1) c', [k])).c !== xcResultCode(k)) msgDiff.push(`xccode:${k}`);
  }
  ok(msgDiff.length === 0, `kafaa_sb_message / kafaa_xc_message and the result codes = SB_MSG / XC_MSG (${Object.keys(SB_MSG).length + Object.keys(XC_MSG).length} messages)${msgDiff.length ? ` DIFF ${msgDiff}` : ''}`);

  // ── SQL = TS (FS79)
  const certs = await rowsOf('external_certs');
  const alRows = await rowsOf('skill_alignments');
  const alMap = new Map(alRows.map((a) => [a.id, a]));
  const skMap = new Map(skillsW.map((k) => [k.id, k]));
  const tDiff = [];
  for (const k of ISSUER_KINDS) for (const acc of [null, '', '  ', 'ACC-1']) if ((await q1('select kafaa_xc_issuer_tier($1, $2) t', [k, acc])).t !== issuerTier({ issuer_kind: k, accreditation_ref: acc })) tDiff.push(`${k}/${acc}`);
  for (const c of certs) if ((await q1('select kafaa_xc_trust_tier(x) t from kafaa_external_certs x where id = $1', [c.id])).t !== trustTier(c)) tDiff.push(c.id);
  const tiers = new Set(certs.map((c) => trustTier(c)));
  ok(tDiff.length === 0 && tiers.size === 4, `kafaa_xc_issuer_tier / kafaa_xc_trust_tier = issuerTier / trustTier (${[...tiers].sort().join(', ')} on the seed)${tDiff.length ? ` DIFF ${tDiff}` : ''}`);
  const sets = certs.map((c) => [c.alignment_ids, c.levels]);
  const alIds = alRows.map((a) => a.id);
  const secAl = alRows.find((a) => skMap.get(a.skill_id)?.area === 'security');
  for (let i = 0; i < 80; i++) {
    const ids = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => (rnd() < 0.08 ? `al:missing:${i}` : pickR(alIds)));
    if (secAl && rnd() < 0.1) ids.push(secAl.id);
    sets.push([ids, Object.fromEntries(ids.filter(() => rnd() < 0.6).map((x) => [x, pickR([1, 2, 3, 4, 0, 2.5])]))]);
  }
  const mDiff = [];
  const states = new Set();
  for (const [ids, lv] of sets) for (const tier of TIERS) {
    const s = (await q1('select kafaa_xc_map($1::text[], $2::jsonb, $3) m', [ids, JSON.stringify(lv), tier])).m;
    const t = certMapping({ alignment_ids: ids, levels: lv }, tier, alMap, skMap);
    for (const r of t.rows) states.add(r.state);
    if (!same(s, t)) mDiff.push(`${ids}/${tier}`);
  }
  const mapsOnlyReviewed = sets.every(([ids, lv]) => TIERS.every((tier) => certMapping({ alignment_ids: ids, levels: lv }, tier, alMap, skMap).skills
    .every((k) => k.alignment_ids.every((a) => { const x = alMap.get(a); return x.status === 'published' && x.reviewed_by && x.reviewed_on; }))));
  ok(mDiff.length === 0 && states.size >= 4 && mapsOnlyReviewed, `acceptance (FS79): kafaa_xc_map = certMapping on ${sets.length} crosswalk sets x 3 tiers; only reviewed crosswalk rows map (${[...states].sort().join(', ')})${mDiff.length ? ` DIFF ${mDiff.slice(0, 3)}` : ''}`);
  const sbase = { title: 'Certificate in data practice', issuer: 'Sample professional body', issuer_kind: 'professional_body', accreditation_ref: 'ACC-9', credential_ref: 'SAMPLE-1', issued_on: '2026-05-01',
    expires_on: null, verification_url: 'https://certificates.example.org/verify/sample-1', alignment_ids: ['al:sk-fs-tr-systems:esco:0f9958d2'], levels: { 'al:sk-fs-tr-systems:esco:0f9958d2': 2 } };
  const retired = alRows.find((a) => a.status === 'retired');
  const svars = [{}, { title: 'ab' }, { title: 7 }, { issuer: 'x' }, { issuer_kind: 'agency' }, { accreditation_ref: 'x'.repeat(81) }, { accreditation_ref: '' }, { credential_ref: '' }, { issued_on: '2099-01-01' },
    { issued_on: '2026-13-01' }, { expires_on: '2026-04-01' }, { expires_on: '' }, { expires_on: '2030-01-01' }, { verification_url: 'http://x.org/a' }, { verification_url: 'https://x.org/a b' },
    { verification_url: 'javascript:alert(1)' }, { alignment_ids: [] }, { alignment_ids: ['al:none'] }, { alignment_ids: ['al:sk-fs-tr-systems:esco:0f9958d2', 'al:sk-fs-tr-systems:esco:0f9958d2'] },
    { alignment_ids: retired ? [retired.id] : ['al:none'] }, { alignment_ids: alIds.slice(0, 7) }, { levels: { 'al:other': 1 } }, { levels: { 'al:sk-fs-tr-systems:esco:0f9958d2': 4 } }, { levels: [] }, { levels: null },
    { note: 'x'.repeat(301) }, secAl ? { alignment_ids: [secAl.id], levels: {} } : {}];
  const sDiff = [];
  const scodes = new Set();
  for (const v of svars) for (const dup of [false, true]) {
    const inp = { ...sbase, ...v };
    const s = (await q1('select kafaa_xc_check_submit($1::jsonb, $2::date, $3) r', [JSON.stringify(inp), today, dup])).r;
    const t = checkSubmit(inp, { today, alignments: alMap, skills: skMap, duplicate: dup });
    scodes.add(t);
    if (s !== t) sDiff.push(`${JSON.stringify(v)} ${s}/${t}`);
  }
  ok(sDiff.length === 0 && scodes.has('security_restricted') && scodes.size >= 11, `kafaa_xc_check_submit = checkSubmit on ${svars.length * 2} generated certificates (${[...scodes].sort().join(', ')})${sDiff.length ? ` DIFF ${sDiff.slice(0, 3)}` : ''}`);
  const vDiff = [];
  const vcodes = new Set();
  for (const c of certs) for (const me of [c.person_id, 'p-training-mgr']) for (const d of ['verify', 'reject', 'revoke', 'approve']) for (const m of ['issuer_url', 'enec_assessment', 'fax']) for (const note of ['', 'Link does not resolve']) for (const day of [today, '2031-01-01']) {
    const inp = { id: c.id, decision: d, method: m, note };
    const s = (await q1('select kafaa_xc_check_verify($1::jsonb, (select x from kafaa_external_certs x where id = $2), $3, $4::date) r', [JSON.stringify(inp), c.id, me, day])).r;
    const t = checkVerify(inp, c, me, day);
    vcodes.add(t);
    if (s !== t) vDiff.push(`${c.id} ${d} ${m} ${s}/${t}`);
  }
  ok(vDiff.length === 0 && vcodes.size >= 7, `kafaa_xc_check_verify = checkVerify on every seeded certificate x verifiers x decisions x methods x days (${[...vcodes].sort().join(', ')})${vDiff.length ? ` DIFF ${vDiff.slice(0, 3)}` : ''}`);

  // ── FS79 acceptance on the seed: unverified never above "claimed"; evidence only through reviewed rows; basis and level by tier
  const evAll = await rowsOf('skill_evidence', `ref_table = 'external_certs'`);
  const bad = evAll.filter((e) => { const c = certs.find((x) => x.id === e.ref_id); return e.active && (!c || c.status !== 'verified'); });
  const badTier = evAll.filter((e) => { const c = certs.find((x) => x.id === e.ref_id); const t = trustTier(c); return t !== 'claimed' && (e.basis !== { enec_assessed: 'evidenced', accredited: 'validated', vendor_self_serve: 'validated' }[t] || e.level > { enec_assessed: 3, accredited: 2, vendor_self_serve: 1 }[t]); });
  const badMap = evAll.filter((e) => { const c = certs.find((x) => x.id === e.ref_id); return !(c.alignment_ids ?? []).some((a) => { const x = alMap.get(a); return x && x.skill_id === e.skill_id && x.status === 'published' && x.reviewed_by && x.reviewed_on; }); });
  ok(bad.length === 0 && badTier.length === 0 && badMap.length === 0 && evAll.every((e) => e.kind === 'credential'),
    `acceptance (FS79): no unverified (submitted, rejected, withdrawn, revoked) certificate has active evidence; ${evAll.length} evidence rows, basis and level by tier, each through a reviewed crosswalk row`);

  // ── RLS
  const kroReq = T.study_time_requests.filter((r) => r.person_id === 'p-k-ro').length;
  const sroTeam = T.study_time_requests.filter((r) => r.line_manager_id === 'p-sro' || r.person_id === 'p-sro').length;
  const rl = {
    anon: [await count(null, 'kafaa_learning_balances'), await count(null, 'kafaa_study_time_requests'), await count(null, 'kafaa_external_certs')],
    kroB: await count('k-ro', 'kafaa_learning_balances'), kroOther: await count('k-ro', 'kafaa_learning_balances', `person_id <> 'p-k-ro'`), kroR: await count('k-ro', 'kafaa_study_time_requests'),
    sroOfKro: await count('sro', 'kafaa_study_time_requests', `person_id = 'p-k-ro'`), sroOwn: await count('sro', 'kafaa_study_time_requests', `line_manager_id = 'p-sro' or person_id = 'p-sro'`),
    tmB: await count('training-mgr', 'kafaa_learning_balances', `person_id <> 'p-training-mgr'`), tmR: await count('training-mgr', 'kafaa_study_time_requests', `person_id <> 'p-training-mgr'`),
    insB: await count('k-instructor', 'kafaa_learning_balances', `person_id <> 'p-k-instructor'`),
    hrB: await count('k-hr-analyst', 'kafaa_learning_balances'), chcoR: await count('chco', 'kafaa_study_time_requests'), audB: await count('k-auditor', 'kafaa_learning_balances'),
    qcOfKro: await count('qc-inspector', 'kafaa_study_time_requests', `person_id = 'p-k-ro'`),
    kroC: await count('k-ro', 'kafaa_external_certs'), kroCo: await count('k-ro', 'kafaa_external_certs', `person_id <> 'p-k-ro'`), tmC: await count('training-mgr', 'kafaa_external_certs'),
    audC: await count('k-auditor', 'kafaa_external_certs'), qcC: await count('qc-inspector', 'kafaa_external_certs', `person_id <> 'p-qc-inspector'`),
  };
  ok(rl.anon.every((x) => x === 0) && rl.kroB === 1 && rl.kroOther === 0 && rl.kroR === kroReq && rl.sroOfKro === kroReq && rl.sroOwn >= sroTeam && rl.tmB === 0 && rl.tmR === 0 && rl.insB === 0
    && rl.hrB === 106 && rl.chcoR === T.study_time_requests.length && rl.audB === 106 && rl.qcOfKro === 0,
    `RLS (FS78): anonymous visitors read nothing; a balance and its requests are read by the person (k-ro ${rl.kroB}/${rl.kroR}), the line manager (sro reads k-ro's ${rl.sroOfKro}) and HR / auditors (${rl.hrB}); RPL assessors (training manager, instructor) and other staff read none`);
  ok(rl.kroC === T.external_certs.filter((c) => c.person_id === 'p-k-ro').length && rl.kroCo === 0 && rl.tmC === T.external_certs.length && rl.audC === T.external_certs.length && rl.qcC === 0,
    `RLS (FS79): the holder reads their own certificates (k-ro ${rl.kroC}); verifiers and auditors read all ${rl.tmC}; other staff none`);

  // ── refusals that raise (outside the transaction): anonymous callers, direct writes, internal helpers
  const anon = await one(null, `select kafaa_request_study_time('{}'::jsonb) r`).then(() => 'executed', (e) => String(e.message));
  const tierRead = await one('k-ro', `select kafaa_xc_trust_tier(x) t from kafaa_external_certs x where id = 'xc-p-k-ro-01'`).then(() => 'executed', (e) => String(e.message));
  const direct = [];
  for (const sql of [`update kafaa_learning_balances set base_hours = 999`, `insert into kafaa_external_certs (id, person_id, title, issuer, issuer_kind, credential_ref, issued_on, verification_url) values ('x', 'p-k-ro', 'x', 'x', 'enec', 'x', '2026-01-01', 'https://x')`,
    `update kafaa_study_time_requests set status = 'approved'`]) direct.push(await one('k-ro', sql).then(() => 'executed', (e) => String(e.message)));
  ok(anon.includes('permission denied') && tierRead.includes('permission denied') && direct.every((x) => x.includes('permission denied')),
    'anonymous callers cannot execute the FS78/FS79 RPCs; internal helpers are not callable; writes only through the RPCs (no direct insert or update by API roles)');

  // ── RPC flows (rolled back): one audit row per call, ledger only on approve / verify / revoke
  await db.exec('begin');
  try {
    const auditN = async () => Number((await q1('select count(*)::int n from kafaa_audit_events')).n);
    const ledgerN = async () => Number((await q('select count(*)::int n from ledger_entries').catch(() => [{ n: 0 }]))[0].n);
    const a0 = await auditN();
    const l0 = await ledgerN();
    let calls = 0;
    let ledgers = 0;
    const call = (p, fn, input) => { calls++; return one(p, `select ${fn}($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r); };
    const req = (p, input) => call(p, 'kafaa_request_study_time', { action: 'request', ...input });
    const dec = (p, input) => call(p, 'kafaa_decide_study_time', input);
    const sub = (p, input) => call(p, 'kafaa_submit_external_cert', { action: 'submit', ...input });
    const ver = (p, input) => call(p, 'kafaa_verify_external_cert', input);
    const yr = Number(today.slice(0, 4));
    const D = (m, d) => `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const late = today > D(12, 1) ? null : true;
    if (late) {
      const R0 = { hours: 6, starts_on: D(12, 2), ends_on: D(12, 20), pattern: 'release_days', reason: 'Systems thinking before the outage season' };
      const u1 = await req('k-ro', { ...R0, resource_id: 'xr-enen2plus' });
      const u2 = await req('k-ro', { ...R0, resource_id: 'xr-nea-nextgen-2026' });
      const u3 = await req('k-ro', { ...R0, resource_id: 'c-hu' });
      const ct = await req('k-contractor', { ...R0, resource_id: 'xr-openlearn-systems' });
      const cf = await req('k-ro', { ...R0, resource_id: 'xr-elements-of-ai', hours: 4 });
      ok(u1.code === 'ungated' && u1.message === SB_MSG.ungated && u2.code === 'ungated' && u3.code === 'not_found' && (ct.code === 'forbidden' || ct.code === 'not_eligible') && cf.code === 'conflict',
        'acceptance (FS78): ungated items cannot be charged (a draft and a retired catalogue item are refused `ungated`; a course outside the catalogue is not found); contractors have no balance; one open request per item');
      const before = (await q1(`select kafaa_lb_compute('p-k-ro', $1) r`, [yr])).r;
      const r1 = await req('k-ro', { ...R0, resource_id: 'xr-nea-nest', hours: 40 });
      const r2 = await req('k-ro', { ...R0, resource_id: 'xr-wnu-summer-institute', hours: Math.min(40, before.available_hours - 40 + 1) });
      const mid = (await q1(`select * from kafaa_learning_balances where id = $1`, [`lb:p-k-ro:${yr}`]));
      ok(r1.ok && r1.data.line_manager_id === 'p-sro' && r1.data.balance.pending_hours === before.pending_hours + 40 && mid.pending_hours === before.pending_hours + 40 && r2.code === 'insufficient_balance' && r2.message === SB_MSG.balance,
        `a request reserves hours (k-ro pending ${before.pending_hours} -> ${mid.pending_hours}) and goes to the line manager (p-sro); a request beyond the balance is refused (insufficient_balance)`);
      const id = r1.data.id;
      const s1 = await dec('k-ro', { id, decision: 'approve' });
      const s2 = await dec('qc-inspector', { id, decision: 'approve' });
      const s3 = await dec('training-mgr', { id, decision: 'approve' });
      const s4 = await dec('sro', { id, decision: 'decline', note: 'no' });
      const lb = await ledgerN();
      const s5 = await dec('sro', { id, decision: 'approve' });
      ledgers++;
      const row = await q1('select * from kafaa_study_time_requests where id = $1', [id]);
      const ae = await q1(`select * from kafaa_audit_events where entity_id = $1 and action = 'study.decide' and outcome = 'ok'`, [id]);
      const after = (await q1(`select kafaa_lb_compute('p-k-ro', $1) r`, [yr])).r;
      const stored = await q1(`select * from kafaa_learning_balances where id = $1`, [`lb:p-k-ro:${yr}`]);
      ok(s1.code === 'maker_checker' && s1.message === SB_MSG.self && s2.code === 'not_found' && s3.code === 'not_found' && s4.code === 'invalid' && s4.message === SB_MSG.note && s5.ok
        && row.status === 'approved' && row.decided_by === 'p-sro' && row.decided_by !== row.person_id && ae && ae.actor_person_id === 'p-sro' && (await ledgerN()) === lb + 1 && s5.ledger_seq != null
        && after.used_hours === before.used_hours + 40 && stored.used_hours === after.used_hours && stored.remaining_hours === after.remaining_hours,
        `acceptance (FS78): study-time decisions need a second person (the requester is refused maker_checker; people outside the line read nothing) and write an audit row (+ one ledger row on approval); used ${before.used_hours} -> ${after.used_hours} h`);
      const op = (await q1(`select id from kafaa_study_time_requests where person_id = 'p-outage-planner' and status = 'requested' order by id limit 1`));
      const h1 = await dec('chco', { id: op.id, decision: 'decline', note: 'Outage season: please send it for January' });
      const hrow = await q1('select status, decided_role, decided_by from kafaa_study_time_requests where id = $1', [op.id]);
      const pending = (await q1(`select id from kafaa_study_time_requests where person_id = 'p-k-ro' and status = 'requested' order by id limit 1`));
      const w0 = await call('sro', 'kafaa_request_study_time', { action: 'withdraw', id: pending.id });
      const w1 = await call('k-ro', 'kafaa_request_study_time', { action: 'withdraw', id: pending.id });
      const w2 = await call('k-ro', 'kafaa_request_study_time', { action: 'withdraw', id: pending.id });
      ok(h1.ok && hrow.status === 'declined' && hrow.decided_role === 'hr_director' && hrow.decided_by === 'p-chco' && w0.code === 'forbidden' && w0.message === SB_MSG.w_forbidden && w1.ok && w2.code === 'invalid',
        'the HR authority decides when the line manager cannot (decided_role hr_director); only the requester withdraws, once');
      const v1 = (await one('k-ro', `select kafaa_learning_balance(null, null) r`)).r;
      const v2 = (await one('sro', `select kafaa_learning_balance('p-k-ro', null) r`)).r;
      const v3 = (await one('qc-inspector', `select kafaa_learning_balance('p-k-ro', null) r`)).r;
      const v4 = (await one('training-mgr', `select kafaa_learning_balance('p-k-ro', null) r`)).r;
      const v5 = (await one('k-hr-analyst', `select kafaa_learning_balance('p-k-ro', null) r`)).r;
      ok(v1 && v1.person_id === 'p-k-ro' && same(v1.balance, (await q1(`select kafaa_lb_compute('p-k-ro', $1) r`, [yr])).r) && v1.grant.topup_hours === 40 && v2 && v3 === null && v4 === null && v5 && v5.stored,
        'learningBalance: self, the line manager in scope and HR read it; other staff and RPL assessors get null');
    } else ok(true, 'study-time flows skipped (the calendar year has ended for new requests)');
    // FS79 flows
    const C0 = { title: 'Certificate in systems practice', issuer: 'Sample professional body (synthetic)', issuer_kind: 'professional_body', accreditation_ref: 'ACC-SAMPLE-1', credential_ref: 'VAL-SAMPLE-1',
      issued_on: '2026-05-01', verification_url: 'https://certificates.example.org/verify/val-sample-1',
      alignment_ids: ['al:sk-fs-tr-creative:esco:c624c6a3', 'al:sk-fs-ai-automation:esco:f4a6e9f7'], levels: { 'al:sk-fs-tr-creative:esco:c624c6a3': 3, 'al:sk-fs-ai-automation:esco:f4a6e9f7': 2 } };
    const e1 = await sub('k-ro', { ...C0, verification_url: 'http://certificates.example.org/x' });
    const e2 = secAl ? await sub('k-ro', { ...C0, alignment_ids: [secAl.id], levels: {} }) : { code: 'security_restricted' };
    const e3 = await sub('k-ro', C0);
    const e4 = await sub('k-ro', C0);
    const cid = e3.data?.id;
    const evBefore = Number((await q1(`select count(*)::int n from kafaa_skill_evidence where ref_id = $1`, [cid])).n);
    ok(e1.code === 'invalid' && e1.message === XC_MSG.url && e2.code === 'security_restricted' && e3.ok && e3.data.tier === 'claimed' && e3.data.mapping.skills.length === 1 && e4.code === 'conflict' && evBefore === 0,
      'the holder adds a certificate (https link only; security-area skills refused; same link twice refused); it reads as "claimed" and writes no evidence until verified');
    const f1 = await ver('k-ro', { id: cid, decision: 'verify', method: 'issuer_url' });
    const f2 = await ver('chco', { id: 'xc-p-chco-01', decision: 'verify', method: 'issuer_url' });
    const f3 = await ver('training-mgr', { id: cid, decision: 'verify', method: 'enec_assessment' });
    const f4 = await ver('training-mgr', { id: cid, decision: 'reject', note: '' });
    const ps0 = await q1(`select level, basis from kafaa_person_skills where id = 'ps:p-k-ro:sk-fs-tr-creative'`);
    const lv0 = await ledgerN();
    const f5 = await ver('training-mgr', { id: cid, decision: 'verify', method: 'issuer_registry' });
    ledgers++;
    const ev = await q(`select * from kafaa_skill_evidence where ref_table = 'external_certs' and ref_id = $1 order by id`, [cid]);
    const ps1 = await q1(`select level, basis, evidence_count from kafaa_person_skills where id = 'ps:p-k-ro:sk-fs-tr-creative'`);
    const crow = await q1('select * from kafaa_external_certs where id = $1', [cid]);
    ok(f1.code === 'forbidden' && f1.message === XC_MSG.forbidden_verify && f2.code === 'maker_checker' && f2.message === XC_MSG.self && f3.code === 'invalid' && f3.message === XC_MSG.method_tier
      && f4.code === 'invalid' && f5.ok && f5.data.tier === 'accredited' && ev.length === 1 && ev[0].skill_id === 'sk-fs-tr-creative' && ev[0].basis === 'validated' && ev[0].level === 2 && ev[0].kind === 'credential'
      && crow.tier === 'accredited' && crow.verified_by === 'p-training-mgr' && same(crow.mapped, f5.data.mapping.rows) && ps1 && ps1.level >= 2 && (await ledgerN()) === lv0 + 1,
      `acceptance (FS79): a verifier who is not the holder verifies; only the reviewed crosswalk row maps (sk-fs-tr-creative L2, accredited cap; the unreviewed automation row does not); validated evidence and a skills recompute (${ps0 ? `L${ps0.level}` : 'none'} -> L${ps1?.level}); one ledger row`);
    const g1 = await ver('head-sq', { id: cid, decision: 'revoke', note: 'Issuer withdrew it' });
    ledgers++;
    const ev2 = await q(`select active from kafaa_skill_evidence where ref_id = $1`, [cid]);
    const g2 = await ver('head-sq', { id: cid, decision: 'verify', method: 'issuer_url' });
    const g3 = await ver('training-mgr', { id: 'xc-p-k-ro-02', decision: 'reject', note: 'The issuer registry has no record of this number.' });
    const rj = await q1(`select status, tier, evidence_ids from kafaa_external_certs where id = 'xc-p-k-ro-02'`);
    const wd = await call('k-lo-trainee', 'kafaa_submit_external_cert', { action: 'withdraw', id: 'xc-p-k-lo-trainee-01' });
    const wd2 = await call('k-ro', 'kafaa_submit_external_cert', { action: 'withdraw', id: 'xc-p-k-lo-trainee-01' });
    const after = await rowsOf('external_certs');
    const leak = (await rowsOf('skill_evidence', `ref_table = 'external_certs' and active`)).filter((e) => after.find((c) => c.id === e.ref_id)?.status !== 'verified');
    ok(g1.ok && g1.data.tier === 'claimed' && ev2.every((e) => e.active === false) && g2.code === 'invalid' && g3.ok && rj.status === 'rejected' && rj.tier === null && rj.evidence_ids.length === 0
      && wd.ok && wd2.code === 'not_found' && leak.length === 0 && after.every((c) => (c.status === 'verified') === (trustTier(c) !== 'claimed')),
      'acceptance (FS79): revoking makes the evidence inactive and the tier reads "claimed" again; rejected and withdrawn certificates have no tier and no evidence; after every flow no unverified certificate has active evidence');
    const chk = [];
    for (const sql of [`update kafaa_external_certs set evidence_ids = '{x}' where id = 'xc-p-k-ro-02'`, `update kafaa_external_certs set tier = 'accredited' where id = 'xc-p-chco-01'`,
      `update kafaa_study_time_requests set decided_by = person_id where id = 'str-p-k-ro-01'`, `update kafaa_learning_balances set used_hours = used_hours + 1000 where id = 'lb:p-k-ro:2026'`,
      `update kafaa_external_certs set verified_by = person_id where id = 'xc-p-sro-01'`]) {
      await db.exec('savepoint c');
      chk.push(await db.exec(sql).then(() => 'ok', (e) => (/check/i.test(e.message) ? 'check' : e.message)));
      await db.exec('rollback to savepoint c');
    }
    ok(chk.every((x) => x === 'check'), `DB checks: evidence or a tier without verification, a self-decided request, a balance below zero and a self-verification are refused (${chk.join(', ')})`);
    ok((await auditN()) - a0 === calls && (await ledgerN()) - l0 === ledgers, `every call wrote exactly one audit row (${calls} calls) and only approvals, verifications and revocations wrote NEXUS ledger rows (${ledgers})`);
  } finally { await db.exec('rollback'); }

  // ── grants and additive SQL
  const exec = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1)`, [FS91_FUNCS]);
  ok(exec.length === FS91_FUNCS.length && exec.every((x) => !x.anon) && exec.filter((x) => x.auth).map((x) => x.proname).sort().join(',') === RPCS.join(','),
    `anon executes none of the ${FS91_FUNCS.length} FS78/FS79 functions; authenticated only the ${RPCS.length} RPCs`);
  const sqlText = readFileSync(`supabase/migrations/${MINE}`, 'utf8');
  const code = sqlText.replace(/--.*$/gm, '');
  ok(!/\b(drop|truncate|delete)\b/i.test(sqlText) && [...code.matchAll(/\b(?:alter|create)\s+(?:table|policy|function|or replace function|index if not exists|unique index if not exists|trigger)\s+(?:if not exists\s+)?(?:kafaa_read\s+on\s+)?([a-z_]+)/gi)].every((m) => m[1].startsWith('kafaa_')),
    'the migration only touches kafaa_* objects and never removes anything (no removal keyword even in comments)');
}
