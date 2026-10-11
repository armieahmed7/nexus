// [FS wave C · E4 · FS23 + FS24] PGlite checks for 20261010234001_kafaa_fs34_descriptors_scale.sql: the seeded rows load unchanged
// (row digests = seed.json); FS23 acceptance on what anonymous visitors read (every skill has a published descriptor at each level of
// its range and none outside it, none reuses the old template sentence, indicators in EN and AR); RLS for drafts and recognitions;
// SQL = TS for checkDescriptor, checkRange, isTemplated, checkPropose, checkDecide and the refusal messages; FS24 acceptance (every
// scale-map row cites its source; an Authority recognition needs two different approvers and writes a ledger row; it never changes the
// F01 level); the RPC flows with one audit row per call; the candidates read = the TS rule; grants; additive SQL only.
import { readFileSync } from 'node:fs';
import { DESC_MSG, checkDescriptor, checkRange, descResultCode, isTemplated, TEMPLATE_PATTERNS } from '../../src/modules/m02/descriptors.ts';
import { AUTH_MSG, authResultCode, checkDecide, checkPropose, rowCitesSource } from '../../src/modules/m02/authority.ts';

const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export default async function fs34Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const pick = (cols, dates = []) => (r) => Object.fromEntries(cols.map((c) => [c, dates.includes(c) ? d10(r[c]) : r[c] ?? null]));

  // ── seed digests
  const DIGEST = {
    kafaa_level_attributes: [T.level_attributes, ['id', 'level', 'attribute', 'name_en', 'name_ar', 'text_en', 'text_ar', 'sfia_levels', 'sort'], []],
    kafaa_skill_level_ranges: [T.skill_level_ranges, ['id', 'skill_id', 'min_level', 'max_level', 'basis', 'track', 'rationale_en', 'rationale_ar', 'version'], []],
    kafaa_skill_descriptors: [T.skill_descriptors, ['id', 'skill_id', 'level', 'essence_en', 'essence_ar', 'indicators_en', 'indicators_ar', 'evidence_modes', 'status', 'listed', 'version', 'created_by', 'updated_by'], []],
    kafaa_scale_maps: [T.scale_maps, ['id', 'framework', 'row_kind', 'band', 'levels', 'level_count', 'ext_from', 'ext_to', 'fit', 'label_en', 'label_ar', 'note_en', 'note_ar', 'source_url', 'as_of', 'benchmark_id', 'sort'], ['as_of']],
    kafaa_authority_recognitions: [T.authority_recognitions, ['id', 'person_id', 'person_name', 'person_name_ar', 'skill_id', 'status', 'panel', 'citation_en', 'citation_ar', 'level_at_proposal', 'basis_at_proposal', 'proposed_by', 'proposed_role', 'proposed_on', 'decided_by', 'decided_role', 'decided_on', 'decision_note', 'recognised_on', 'review_due'], ['proposed_on', 'decided_on', 'recognised_on', 'review_due']],
  };
  const digestOk = [];
  for (const [t, [rows, cols, dates]] of Object.entries(DIGEST)) {
    const db1 = (await q(`select * from ${t} order by id`)).map(pick(cols, dates));
    const sd = [...rows].sort(byId).map(pick(cols, dates));
    digestOk.push([t, db1.length, same(db1, sd)]);
  }
  ok(digestOk.every((x) => x[2]), `the seeded rows load unchanged (row digest = seed.json): ${digestOk.map(([t, n, s]) => `${t.replace('kafaa_', '')} ${n}${s ? '' : ' DIFF'}`).join(', ')}`);

  // ── FS23 acceptance on the anonymous payload
  const skills = await as(null, `select id, area, fs_area, lifecycle, key_level from kafaa_skills`);
  const ranges = await as(null, `select * from kafaa_skill_level_ranges`);
  const pubD = await as(null, `select * from kafaa_skill_descriptors`);
  const rangeOf = new Map(ranges.map((r) => [r.skill_id, r]));
  const missing = [];
  const extra = [];
  for (const s of skills) {
    const r = rangeOf.get(s.id);
    if (!r) { missing.push(`${s.id}:range`); continue; }
    for (let l = r.min_level; l <= r.max_level; l++) if (!pubD.some((d) => d.skill_id === s.id && d.level === l)) missing.push(`${s.id}:${l}`);
    for (const d of pubD.filter((x) => x.skill_id === s.id)) if (d.level < r.min_level || d.level > r.max_level) extra.push(`${s.id}:${d.level}`);
  }
  ok(skills.length === 120 && missing.length === 0 && extra.length === 0, `every one of the ${skills.length} skills has a published descriptor at each level where it exists and none outside its range (${pubD.length} published levels)${missing.length + extra.length ? ` missing ${missing.slice(0, 5)} extra ${extra.slice(0, 5)}` : ''}`);
  const tmpl = (await q(`select count(*)::int n from kafaa_skill_descriptors d where kafaa_sd_templated(d.essence_en) or kafaa_sd_templated(d.essence_ar)
      or exists (select 1 from unnest(d.indicators_en || d.indicators_ar) x where kafaa_sd_templated(x))`))[0].n;
  const oldT = (await q(`select count(*)::int n from kafaa_competencies c, jsonb_array_elements(c.levels) l where kafaa_sd_templated(l->>'en') and kafaa_sd_templated(l->>'ar')`))[0].n;
  ok(tmpl === 0 && oldT === 116, `no descriptor uses the old template sentence (the detector flags all ${oldT} old competency level texts, EN and AR)`);
  ok(pubD.every((d) => d.indicators_en.length >= 2 && d.indicators_en.length <= 4 && d.indicators_ar.length === d.indicators_en.length && d.indicators_ar.every((x) => x.trim() && /[؀-ۿ]/.test(x)) && /[؀-ۿ]/.test(d.essence_ar)),
    'every published descriptor has 2-4 indicators, each in English and in Arabic');
  ok(pubD.every((d) => d.status === 'published' && d.listed) && (await count(null, 'kafaa_skill_descriptors')) === T.skill_descriptors.filter((d) => d.status === 'published').length, 'anonymous visitors read published descriptors only (no drafts)');
  const allD = T.skill_descriptors.length;
  const seenD = {};
  for (const p of ['training-mgr', 'k-instructor', 'k-auditor', 'k-admin', 'sro', 'chco']) seenD[p] = await count(p, 'kafaa_skill_descriptors');
  ok(['training-mgr', 'k-instructor', 'k-auditor', 'k-admin'].every((p) => seenD[p] === allD) && ['sro', 'chco'].every((p) => seenD[p] === pubD.length), `drafts are read by framework owners, admins and auditors only (${JSON.stringify(seenD)})`);
  ok((await count(null, 'kafaa_level_attributes')) === 24 && (await count(null, 'kafaa_skill_level_ranges')) === 120, 'anonymous visitors read the 24 generic level attributes and the 120 level ranges with their rationale');

  // ── SQL = TS: checkDescriptor, isTemplated, checkRange
  const sk = (id) => skills.find((s) => s.id === id);
  const ctxOf = (id) => ({ skill: sk(id) ? { id, area: sk(id).area, fs_area: sk(id).fs_area, lifecycle: sk(id).lifecycle } : null, range: rangeOf.get(id) ?? null });
  const base = { skill_id: 'sk-fs-ai-use', level: 2, essence_en: 'Uses approved AI tools for drafting and checks every claim.', essence_ar: 'يستخدم أدوات الذكاء الاصطناعي المعتمدة في الصياغة ويتحقق من كل ادعاء.',
    indicators_en: ['Checks each AI answer against the controlled document.', 'Logs the tool and version used.'], indicators_ar: ['يتحقق من كل إجابة مقابل الوثيقة المعتمدة.', 'يسجّل الأداة والإصدار المستخدمين.'], evidence_modes: ['work_product', 'records'], publish: true };
  const D = (o) => ({ ...base, ...o });
  const dCases = [base, D({ skill_id: 'sk-nope' }), D({ skill_id: 'sk-fs-dp-paperwp' }), D({ level: 0 }), D({ level: 5 }), D({ level: 2.5 }), D({ level: '2' }), D({ level: null }),
    D({ skill_id: 'sk-fs-cy-phishing', level: 3 }), D({ skill_id: 'sk-sa-01', level: 2 }), D({ essence_en: '' }), D({ essence_ar: '  ' }), D({ essence_en: 'x'.repeat(201) }),
    D({ indicators_en: ['one'] }), D({ indicators_en: 'one' }), D({ indicators_ar: ['a', 'b', 'c', 'd', 'e'] }), D({ indicators_ar: ['أ', 'ب', 'ج'] }), D({ indicators_en: ['ok', 3] }), D({ indicators_en: ['ok', ' '] }),
    D({ indicators_en: ['ok', 'y'.repeat(221)] }), D({ indicators_en: ['Same thing', ' same thing '] }), D({ indicators_ar: ['نفسه', 'نفسه'] }),
    D({ essence_en: 'Explains the purpose and basic principles of approved AI tools.' }), D({ indicators_en: ['ok', 'Applies the tool under supervision using approved procedures.'] }),
    D({ indicators_ar: ['أ', 'يطبّق الأداة تحت الإشراف باستخدام الإجراءات المعتمدة.'] }), D({ essence_en: 'Expert: sets the standard.' }), D({ essence_ar: 'خبير: يضع المعيار.' }), D({ essence_en: 'AI tools: part of DA-02 (code).' }),
    D({ evidence_modes: [] }), D({ evidence_modes: ['telepathy'] }), D({ evidence_modes: ['jpm', 'jpm'] }), D({ evidence_modes: ['jpm', 'sjt', 'peer', 'records', 'interview'] }), D({ evidence_modes: 'jpm' }),
    D({ publish: false }), D({ skill_id: 'sk-ld-01', level: 1 }), D({ skill_id: 'sk-ld-01', level: 1, publish: false }), D({ skill_id: 'sk-fs-adv-smr', level: 4, publish: false }), D({ skill_id: 'sk-fs-adv-smr', level: 3 })];
  const dd = [];
  const dCodes = new Set();
  for (const [i, c] of dCases.entries()) {
    const s = (await q(`select kafaa_sd_check($1::jsonb) c`, [JSON.stringify(c)]))[0].c;
    const t = checkDescriptor(c, ctxOf(c.skill_id));
    dCodes.add(t);
    if (s !== t) dd.push(`#${i} sql=${s} ts=${t}`);
  }
  ok(dd.length === 0 && dCodes.size >= 14, `kafaa_sd_check = checkDescriptor (TS) on ${dCases.length} inputs covering ${dCodes.size} outcomes${dd.length ? ` (${dd.join('; ')})` : ''}`);
  const texts = ['Explains the purpose and basic principles of x', 'explains the purpose and basic principles of x', 'He explains the purpose and basic principles of x', 'Applies x independently and recognises when to stop and ask.',
    'Coaches, trains and evaluates others in x.', 'Expert: sets the standard', 'An expert: sets', 'x: part of y (CO-01)', 'يشرح الغرض والمبادئ الأساسية لـس', 'يوجّه الآخرين ويدربهم ويقيّمهم في س', 'إلمام: يشرح', 'Reads the indications.', ' مستقل: ', ''];
  const td = [];
  for (const x of texts) { const s = (await q(`select kafaa_sd_templated($1) t`, [x]))[0].t; if (s !== isTemplated(x)) td.push(x); }
  ok(td.length === 0 && TEMPLATE_PATTERNS.length === 11, `kafaa_sd_templated = isTemplated (TS) on ${texts.length} texts${td.length ? ` (${td.join(' | ')})` : ''}`);
  const levelsOf = (id) => (q(`select level from kafaa_skill_descriptors where skill_id = $1`, [id]).then((r) => r.map((x) => x.level)));
  const rBase = { skill_id: 'sk-fs-tr-curiosity', min_level: 1, max_level: 4, basis: 'full', rationale_en: 'Defined at all four levels for every member of staff.', rationale_ar: 'معرَّفة في المستويات الأربعة لجميع الموظفين.' };
  const RR = (o) => ({ ...rBase, ...o });
  const rCases = [rBase, RR({ skill_id: 'sk-nope' }), RR({ skill_id: 'sk-fs-dp-paperwp' }), RR({ min_level: 0 }), RR({ max_level: 5 }), RR({ min_level: 3, max_level: 2 }), RR({ min_level: '1' }), RR({ max_level: 2.5 }),
    RR({ skill_id: 'sk-fs-cy-media', max_level: 3 }), RR({ skill_id: 'sk-fs-cy-media', max_level: 2, basis: 'awareness_only' }), RR({ basis: 'vibes' }), RR({ rationale_en: 'short' }), RR({ rationale_ar: 'ق'.repeat(401) }),
    RR({ skill_id: 'sk-fs-adv-smr', max_level: 4, basis: 'full' }), RR({ skill_id: 'sk-ld-01', min_level: 1, basis: 'full' }), RR({ skill_id: 'sk-pf-03-rcs', min_level: 1, basis: 'full' }),
    { skill_id: 'sk-fs-tr-curiosity', min_level: 1, max_level: 4, basis: 'full', rationale_en: rangeOf.get('sk-fs-tr-curiosity').rationale_en, rationale_ar: ` ${rangeOf.get('sk-fs-tr-curiosity').rationale_ar} ` }];
  const rd = [];
  const rCodes = new Set();
  for (const [i, c] of rCases.entries()) {
    const s = (await q(`select kafaa_sd_range_check($1::jsonb) c`, [JSON.stringify(c)]))[0].c;
    const t = checkRange(c, { skill: ctxOf(c.skill_id).skill, levels: await levelsOf(c.skill_id), current: rangeOf.get(c.skill_id) ?? null });
    rCodes.add(t);
    if (s !== t) rd.push(`#${i} sql=${s} ts=${t}`);
  }
  ok(rd.length === 0 && rCodes.size >= 9, `kafaa_sd_range_check = checkRange (TS) on ${rCases.length} inputs covering ${rCodes.size} outcomes${rd.length ? ` (${rd.join('; ')})` : ''}`);
  const md = [];
  for (const [k, v] of Object.entries(DESC_MSG)) {
    const m = (await q(`select kafaa_sd_message($1) m, kafaa_sd_result_code($1) c`, [k]))[0];
    if (m.m !== v || m.c !== descResultCode(k)) md.push(k);
  }
  for (const [k, v] of Object.entries(AUTH_MSG)) {
    const m = (await q(`select kafaa_ar_message($1) m, kafaa_ar_result_code($1) c`, [k]))[0];
    if (m.m !== v || m.c !== authResultCode(k)) md.push(`ar:${k}`);
  }
  ok(md.length === 0, `refusal messages and result codes = DESC_MSG / AUTH_MSG (${Object.keys(DESC_MSG).length + Object.keys(AUTH_MSG).length} codes)${md.length ? ` ${md}` : ''}`);

  // ── SQL = TS: checkPropose, checkDecide
  const people = new Map((await q(`select id, kind, status from kafaa_people`)).map((p) => [p.id, p]));
  const psRows = await q(`select person_id, skill_id, level, active from kafaa_person_skills order by id`);
  const recs0 = await q(`select * from kafaa_authority_recognitions`);
  const pCtx = (me, c) => {
    const ps = psRows.find((r) => r.person_id === c.person_id && r.skill_id === c.skill_id && r.active !== false);
    const s = sk(c.skill_id);
    return { me, person: people.get(c.person_id) ?? null, skill: s ? { id: s.id, area: s.area, fs_area: s.fs_area, lifecycle: s.lifecycle } : null, level: ps ? Number(ps.level) : 0,
      open: recs0.some((r) => r.person_id === c.person_id && r.skill_id === c.skill_id && ['proposed', 'recognised'].includes(r.status)) };
  };
  const pBase = { action: 'propose', person_id: 'w-sro-02', skill_id: 'sk-co-03', panel: ['hr_director', 'training_manager', 'external_peer'], citation_en: 'Leads the reactivity reviews for crew C.', citation_ar: 'يقود مراجعات التفاعلية للطاقم C على مستوى الوحدة.' };
  const P = (o) => ({ ...pBase, ...o });
  const pCases = [[pBase, 'p-training-mgr'], [P({ person_id: 'nobody' }), 'p-training-mgr'], [P({ person_id: 'ap-001' }), 'p-training-mgr'], [P({ person_id: 'p-training-mgr', skill_id: 'sk-co-01' }), 'p-training-mgr'],
    [P({ skill_id: 'sk-nope' }), 'p-training-mgr'], [P({ skill_id: 'sk-sa-01' }), 'p-training-mgr'], [P({ skill_id: 'sk-fs-cy-phishing' }), 'p-training-mgr'], [P({ skill_id: 'sk-fs-dp-paperwp' }), 'p-training-mgr'],
    [P({ skill_id: 'sk-fs-ai-verify' }), 'p-training-mgr'], [P({ person_id: 'w-sro-01' }), 'p-training-mgr'], [P({ panel: ['hr_director', 'training_manager'] }), 'p-training-mgr'], [P({ panel: ['hr_director', 'hr_director', 'skill_owner'] }), 'p-training-mgr'],
    [P({ panel: ['hr_director', 'cfo', 'skill_owner'] }), 'p-training-mgr'], [P({ panel: 'hr_director' }), 'p-training-mgr'], [P({ panel: [...['hr_director', 'training_manager', 'line_manager', 'skill_owner', 'senior_instructor', 'external_peer'], 'x'] }), 'p-training-mgr'],
    [P({ citation_en: 'short' }), 'p-training-mgr'], [P({ citation_ar: 'ق'.repeat(401) }), 'p-training-mgr'], [P({ person_id: 'p-sro', skill_id: 'sk-co-03' }), 'p-chco']];
  const pd = [];
  const pCodes = new Set();
  for (const [i, [c, me]] of pCases.entries()) {
    const s = (await q(`select kafaa_ar_check_propose($1::jsonb, $2) c`, [JSON.stringify(c), me]))[0].c;
    const t = checkPropose(c, pCtx(me, c));
    pCodes.add(t);
    if (s !== t) pd.push(`#${i} sql=${s} ts=${t}`);
  }
  ok(pd.length === 0 && pCodes.size >= 9, `kafaa_ar_check_propose = checkPropose (TS) on ${pCases.length} inputs covering ${pCodes.size} outcomes${pd.length ? ` (${pd.join('; ')})` : ''}`);
  const rows = { proposed: recs0.find((r) => r.status === 'proposed'), recognised: recs0.find((r) => r.status === 'recognised'), not_yet: recs0.find((r) => r.status === 'not_yet') };
  const dCasesA = [];
  for (const action of ['approve', 'not_yet', 'withdraw', 'bogus']) for (const st of ['proposed', 'recognised', 'not_yet', null]) for (const [me, dec] of [['p-chco', true], ['p-training-mgr', true], ['p-training-mgr', false], ['p-k-instructor', false]]) for (const note of [null, 'too short', 'A clear note for the panel record.', 'n'.repeat(401)]) dCasesA.push({ action, st, me, dec, note });
  const ad = [];
  const aCodes = new Set();
  for (const c of dCasesA) {
    const r = c.st ? rows[c.st] : null;
    const s = (await q(`select kafaa_ar_check_decide($1, ${r ? `(select x from kafaa_authority_recognitions x where x.id = $5)` : 'null::kafaa_authority_recognitions'}, $2, $3, $4) c`, r ? [c.action, c.me, c.dec, c.note, r.id] : [c.action, c.me, c.dec, c.note]))[0].c;
    const t = checkDecide(c.action, r ? { status: r.status, proposed_by: r.proposed_by } : null, { me: c.me, isDecider: c.dec, note: c.note });
    aCodes.add(t);
    if (s !== t) ad.push(`${JSON.stringify(c)} sql=${s} ts=${t}`);
  }
  ok(ad.length === 0 && aCodes.size === 6, `kafaa_ar_check_decide = checkDecide (TS) on ${dCasesA.length} inputs covering ${aCodes.size} outcomes${ad.length ? ` (${ad.slice(0, 3).join('; ')})` : ''}`);

  // ── FS24 acceptance: scale map rows cite their source; RLS on recognitions
  const maps = await as(null, `select * from kafaa_scale_maps`);
  ok(maps.length === T.scale_maps.length && maps.every((r) => rowCitesSource({ source_url: r.source_url, as_of: d10(r.as_of) })) && new Set(maps.map((r) => r.framework)).size === 5
    && ['sfia9', 'skillsfuture', 'digcomp', 'unesco_ai', 'uae_nqf'].every((f) => maps.filter((m) => m.framework === f && m.row_kind === 'map').length === 6),
    `every one of the ${maps.length} scale-map rows cites an https source and an as-of date; 5 frameworks x 6 bands (not yet, 1-4, Authority)`);
  const nRec = T.authority_recognitions.length;
  const seenR = {};
  for (const p of [null, 'sro', 'k-hr-analyst', 'training-mgr', 'chco', 'k-instructor', 'k-auditor', 'k-admin']) seenR[p ?? 'anon'] = await count(p, 'kafaa_authority_recognitions');
  ok(seenR.anon === 0 && seenR.sro === 1 && seenR['k-hr-analyst'] === 0 && seenR['k-admin'] === 0 && ['training-mgr', 'chco', 'k-instructor', 'k-auditor'].every((p) => seenR[p] === nRec),
    `recognitions: the person reads their own, recognition R/W/A all, nobody else (${JSON.stringify(seenR)})`);

  // ── candidates read = the TS rule
  const skillsAll = new Map((await q(`select id, area, fs_area, lifecycle from kafaa_skills`)).map((s) => [s.id, s]));
  const peopleAll = new Map((await q(`select id, kind, status, display_name, display_name_ar, job_role_id from kafaa_people`)).map((p) => [p.id, p]));
  const expect = (await q(`select * from kafaa_person_skills where level = 4`)).filter((ps) => ps.active !== false).flatMap((ps) => {
    const s = skillsAll.get(ps.skill_id);
    const p = peopleAll.get(ps.person_id);
    if (!s || !p || p.kind !== 'staff' || p.status !== 'active' || s.area === 'security' || s.fs_area === 'cyber_hygiene' || s.lifecycle === 'obsolete') return [];
    const mine = recs0.filter((r) => r.person_id === ps.person_id && r.skill_id === ps.skill_id).sort(byId);
    const pk = mine.find((r) => r.status === 'proposed' || r.status === 'recognised') ?? mine[mine.length - 1] ?? null;
    return [{ person_id: p.id, name_en: p.display_name ?? p.id, name_ar: p.display_name_ar || p.display_name || p.id, job_role_id: p.job_role_id ?? null, skill_id: s.id, basis: ps.basis ?? '', confidence: Number(ps.confidence ?? 0), recognition_id: pk?.id ?? null, recognition_status: pk?.status ?? null }];
  }).sort((a, c) => (a.skill_id < c.skill_id ? -1 : a.skill_id > c.skill_id ? 1 : a.person_id < c.person_id ? -1 : 1));
  const got = (await one('chco', `select kafaa_authority_candidates() r`)).r.map((x) => ({ ...x, confidence: Number(x.confidence) }));
  ok(got.length > 20 && same(got, expect) && (await one('sro', `select kafaa_authority_candidates() r`)).r.length === 0 && (await one(null, `select kafaa_authority_candidates() r`).then(() => 'executed', (e) => String(e.message))).includes('permission denied'),
    `kafaa_authority_candidates = the TS rule (${got.length} Expert holders for the HR director; staff get none; anonymous callers cannot execute it)`);

  // ── RPC flows (one audit row per call; ledger only for recognition and withdrawal)
  const auditN = async () => Number((await q(`select count(*)::int n from kafaa_audit_events`))[0].n);
  const ledgerN = async () => Number((await q(`select count(*)::int n from ledger_entries`).catch(() => [{ n: 0 }]))[0].n);
  const statesDigest = async () => (await q(`select md5(string_agg(id || ':' || level || ':' || basis || ':' || active, ',' order by id)) d from kafaa_person_skills`))[0].d;
  const a0 = await auditN();
  const l0 = await ledgerN();
  const states0 = await statesDigest();
  const save = (p, input) => one(p, `select kafaa_save_descriptor($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r);
  const setR = (p, input) => one(p, `select kafaa_set_level_range($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r);
  const rec = (p, input) => one(p, `select kafaa_recognise_authority($1::jsonb) r`, [JSON.stringify(input)]).then((x) => x.r);
  let calls = 0;
  const C = async (pr) => { calls++; return pr; };
  const f1 = await C(save('sro', base));
  const f2 = await C(save('k-auditor', base));
  const f3 = await save(null, base).then(() => 'executed', (e) => String(e.message));
  ok(f1.code === 'forbidden' && f2.code === 'forbidden' && f3.includes('permission denied') && f1.message === DESC_MSG.forbidden, 'staff and auditors cannot edit descriptors (forbidden); anonymous callers cannot execute it');
  const cur = T.skill_descriptors.find((d) => d.id === 'sd:sk-fs-ai-use:2');
  const e1 = await C(save('k-instructor', { ...base, essence_en: `${cur.essence_en} `, essence_ar: cur.essence_ar, indicators_en: [...cur.indicators_en.slice(0, 2), 'Names the approved use class before starting.'], indicators_ar: [...cur.indicators_ar.slice(0, 2), 'يحدد فئة الاستخدام المعتمدة قبل البدء.'], evidence_modes: ['work_product', 'records'] }));
  const row1 = (await q(`select * from kafaa_skill_descriptors where id = 'sd:sk-fs-ai-use:2'`))[0];
  ok(e1.ok && e1.data.version === 2 && row1.status === 'published' && row1.listed && row1.indicators_en.length === 3 && row1.essence_en === cur.essence_en && row1.updated_by === 'p-k-instructor', 'an instructor edits a published descriptor: version 2, still published, text trimmed');
  const e2 = await C(save('training-mgr', { ...base, publish: false }));
  const e3 = await C(save('training-mgr', { ...base, essence_en: 'Practitioner: uses the tool.' }));
  const e4 = await C(save('training-mgr', { ...base, skill_id: 'sk-fs-adv-smr', level: 4 }));
  const e5 = await C(save('training-mgr', { ...base, skill_id: 'sk-fs-cy-media', level: 3, publish: false }));
  ok(e2.code === 'invalid' && e2.message === DESC_MSG.in_range && e3.message === DESC_MSG.template && e4.message === DESC_MSG.out_of_range && e5.code === 'restricted',
    'refusals: an in-range level cannot be unpublished, template sentences are refused, out-of-range levels are drafts, security and cyber hygiene stop at level 2');
  const ld1 = (await q(`select status from kafaa_skill_descriptors where id = 'sd:sk-ld-01:1'`))[0];
  const g1 = await C(setR('k-admin', { skill_id: 'sk-ld-01', min_level: 1, max_level: 4, basis: 'full', rationale_en: 'Defined from level 1 so new joiners can see what good team leadership looks like.', rationale_ar: 'معرَّفة من المستوى الأول ليرى المنضمون الجدد ملامح القيادة الجيدة للفريق.' }));
  const ld1b = (await q(`select status, listed from kafaa_skill_descriptors where id = 'sd:sk-ld-01:1'`))[0];
  ok(ld1.status === 'draft' && g1.ok && g1.data.published === 1 && g1.data.archived === 0 && g1.data.version === 2 && ld1b.status === 'published' && ld1b.listed && (await count(null, 'kafaa_skill_descriptors', `skill_id = 'sk-ld-01'`)) === 4,
    'extending Leading effective teams to level 1 publishes the drafted level-1 descriptor (now public)');
  const g2 = await C(setR('k-admin', { skill_id: 'sk-ld-01', min_level: 2, max_level: 4, basis: 'leading', rationale_en: rangeOf.get('sk-ld-01').rationale_en, rationale_ar: rangeOf.get('sk-ld-01').rationale_ar }));
  const ld1c = (await q(`select status, listed from kafaa_skill_descriptors where id = 'sd:sk-ld-01:1'`))[0];
  const g3 = await C(setR('training-mgr', { skill_id: 'sk-fs-adv-smr', min_level: 1, max_level: 4, basis: 'full', rationale_en: 'Defined at all four levels for every member of staff.', rationale_ar: 'معرَّفة في المستويات الأربعة لجميع الموظفين.' }));
  const g4 = await C(setR('sro', { skill_id: 'sk-ld-01', min_level: 2, max_level: 4, basis: 'leading', rationale_en: 'x'.repeat(30), rationale_ar: 'ق'.repeat(30) }));
  ok(g2.ok && g2.data.archived === 1 && ld1c.status === 'archived' && !ld1c.listed && (await count('k-auditor', 'kafaa_skill_descriptors', `id = 'sd:sk-ld-01:1'`)) === 1 && g3.code === 'incomplete' && g4.code === 'forbidden',
    'shrinking the range archives (never deletes) the level-1 descriptor; a range needs a descriptor at every level; only framework owners set ranges');
  const mid = await auditN();
  ok(mid - a0 === calls && (await ledgerN()) === l0, `every descriptor and range call wrote exactly one audit row (${calls}) and no ledger row`);

  // Authority: maker-checker, ledger, never a level change
  const r1 = await C(rec('k-instructor', pBase));
  const r2 = await C(rec('training-mgr', P({ skill_id: 'sk-fs-ai-verify' })));
  const r3 = await C(rec('training-mgr', P({ person_id: 'p-training-mgr', skill_id: 'sk-co-01' })));
  const r4 = await C(rec('training-mgr', P({ action: 'promote' })));
  ok(r1.code === 'forbidden' && r2.code === 'not_eligible' && r2.message === AUTH_MSG.not_expert && r3.code === 'maker_checker' && r4.code === 'invalid', 'refusals: assessors do not propose, only Experts are eligible, nobody proposes themself, unknown actions are refused');
  const pr = await C(rec('training-mgr', pBase));
  const id = pr.data?.id;
  const row = (await q(`select * from kafaa_authority_recognitions where id = $1`, [id]))[0];
  const nt = await count('chco', 'kafaa_notifications', `id = 'nt-ar-${id}-proposed-p-chco'`);
  const dup = await C(rec('chco', pBase));
  ok(pr.ok && id === 'ar:w-sro-02:sk-co-03:1' && row.status === 'proposed' && row.proposed_role === 'training_manager' && row.basis_at_proposal && nt === 1 && dup.code === 'conflict',
    'the training manager proposes an Expert with a panel and a citation; the HR director is notified; a second open proposal is a conflict');
  const ap1 = await C(rec('training-mgr', { action: 'approve', id }));
  const ap2 = await C(rec('k-instructor', { action: 'approve', id }));
  const lBefore = await ledgerN();
  const ap3 = await C(rec('chco', { action: 'approve', id }));
  const row2 = (await q(`select * from kafaa_authority_recognitions where id = $1`, [id]))[0];
  const lAfter = await ledgerN();
  ok(ap1.code === 'forbidden' && ap1.message === AUTH_MSG.decider && ap2.code === 'forbidden' && ap3.ok && row2.status === 'recognised' && row2.decided_by === 'p-chco' && row2.decided_by !== row2.proposed_by && d10(row2.review_due) > d10(row2.recognised_on) && lAfter === lBefore + 1 && ap3.ledger_seq != null,
    'only the HR director decides, as a second approver different from the proposer; recognition writes one NEXUS ledger row and sets a 3-year review');
  const own = await C(rec('chco', { ...pBase, person_id: 'w-sro-03' }));
  const own2 = await C(rec('chco', { action: 'approve', id: own.data?.id }));
  const ny0 = await C(rec('chco', { action: 'not_yet', id: 'ar:w-qa-01:sk-qa-01:1', note: 'short' }));
  ok(own.ok && own2.code === 'maker_checker' && own2.message === AUTH_MSG.maker_checker && ny0.code === 'invalid', 'a recognition the HR director proposed cannot be decided by the same person (two different approvers); "not yet" needs a note');
  const ny = await C(rec('chco', { action: 'not_yet', id: 'ar:w-rp-01:sk-rp-01:1', note: 'The panel wants one more reviewed contribution first.' }));
  const wd0 = await C(rec('training-mgr', { action: 'withdraw', id: own.data.id, note: 'Proposed by mistake on the wrong crew member.' }));
  const lw = await ledgerN();
  const wd = await C(rec('chco', { action: 'withdraw', id, note: 'Withdrawn for the PGlite check.' }));
  const lw2 = await ledgerN();
  ok(ny.ok && ny.data.status === 'not_yet' && wd0.code === 'forbidden' && wd.ok && (await q(`select status from kafaa_authority_recognitions where id = $1`, [id]))[0].status === 'withdrawn' && lw2 === lw + 1,
    '"not yet" is recorded without a ledger row; withdrawing a current recognition writes a ledger row; a proposer withdraws only their own open proposal');
  ok((await statesDigest()) === states0 && (await count(null, 'kafaa_skill_evidence', `ref_table = 'authority_recognitions'`)) === 0, 'Authority never changes an F01 skill level (person_skills digest unchanged; no evidence written)');
  ok((await auditN()) - a0 === calls, `every call wrote exactly one audit row (${calls} calls)`);

  // ── grants and additive SQL
  const fns = ['kafaa_sd_str', 'kafaa_sd_is_int', 'kafaa_sd_templated', 'kafaa_sd_check', 'kafaa_sd_range_check', 'kafaa_sd_result_code', 'kafaa_sd_message', 'kafaa_ar_check_propose', 'kafaa_ar_check_decide', 'kafaa_ar_result_code', 'kafaa_ar_message', 'kafaa_ar_notify',
    'kafaa_save_descriptor', 'kafaa_set_level_range', 'kafaa_recognise_authority', 'kafaa_authority_candidates'];
  const exec = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth from pg_proc p where p.proname = any($1)`, [fns]);
  ok(exec.length === fns.length && exec.every((x) => !x.anon) && exec.filter((x) => x.auth).map((x) => x.proname).sort().join(',') === 'kafaa_authority_candidates,kafaa_recognise_authority,kafaa_save_descriptor,kafaa_set_level_range',
    'anon executes none of the FS23/FS24 functions; authenticated only the 4 RPCs');
  const sqlText = readFileSync('supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql', 'utf8').replace(/--.*$/gm, '');
  ok(!/\b(drop|truncate|delete\s+from)\b/i.test(sqlText) && [...sqlText.matchAll(/\b(?:alter|create)\s+(?:table|policy|function|or replace function|index if not exists|unique index if not exists|trigger)\s+(?:if not exists\s+)?(?:kafaa_read\s+on\s+)?([a-z_]+)/gi)].every((m) => m[1].startsWith('kafaa_')),
    'the migration only touches kafaa_* objects and never drops, deletes or truncates');
}
