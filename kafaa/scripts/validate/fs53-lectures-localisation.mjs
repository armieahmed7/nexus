// [FS wave E · E3 · FS44 + FS45] PGlite checks for 20261010253001_kafaa_fs53_lectures_localisation.sql (lecture library, expert contributions,
// localisation countdown). Seed sanity (every lecture passes the lecture check, links a skill and its speaker's KLRA position where one exists;
// validated contributions carry their evidence, pending and rejected ones none; every partner-delivered item has a date no later than 2030 and
// no readiness column exists); SQL = TS parity on the shared database: kafaa_lc_problem = lectureProblem (seed + generated cases),
// kafaa_lc_resolve = resolvePosition, kafaa_lc_evidence_skills = evidenceSkills, kafaa_lc_decide_problem = decideProblem, kafaa_lc_validated =
// validatedContributions, kafaa_lz_tracks = M02 deriveStage/currencyView, kafaa_lz_compute = computeBoard (several dates + generated plans),
// kafaa_lz_status_problem = statusProblem; RLS; RPC flows and RBAC (inside a rolled-back transaction); grants; additivity.
import { readFileSync } from 'node:fs';
import { hasContactDetails, postGuard } from '../../src/modules/m22/domain.ts';
import { currencyView, deriveStage, initialDoneOn } from '../../src/modules/m02/instructors.ts';
import { contributorsOf, decideProblem, evidenceSkills, lectureProblem, resolvePosition, validatedContributions } from '../../src/modules/m24/lectures.ts';
import { computeBoard, statusProblem, readiness } from '../../src/modules/m24/localisation.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql';
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));

export default async function fs53Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave E · E3 · FS44 expert lecture library + FS45 localisation countdown');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const today = d10((await q('select current_date d'))[0].d);
  const skillRows = await q(`select id, area, competency_id, to_jsonb(k) ->> 'lifecycle' lifecycle, to_jsonb(k) ->> 'fs_area' fs_area from kafaa_skills k`);
  const skills = new Map(skillRows.map((s) => [s.id, s]));
  const secComps = new Set((await q(`select id from kafaa_competencies where domain = 'security'`)).map((r) => r.id));
  const policies = (await q('select category, patterns, enabled from kafaa_refusal_policies')).map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  const posRows = await q('select id, person_id, family_id, active, title_en, title_ar from kafaa_klra_positions');
  const positionsOf = (pid) => posRows.filter((p) => p.person_id === pid && p.active);
  const world = (speaker, pos, on = today) => ({ skills, secComps, position: pos, speakerPositions: positionsOf(speaker), guard: (t) => postGuard(t, policies), contact: hasContactDetails, today: on });

  // ── seed sanity (acceptance FS44 #3, FS45 #1)
  const lectures = await q('select * from kafaa_lectures order by id');
  const asInput = (l) => ({ title_en: l.title_en, title_ar: l.title_ar, abstract_en: l.abstract_en, abstract_ar: l.abstract_ar, format: l.format, lang: l.lang, delivered_on: d10(l.delivered_on),
    duration_min: l.duration_min, skill_ids: l.skill_ids, system_family: l.system_family, chapters: l.chapters, recording_code: l.recording_code });
  ok(lectures.length === T.lectures.length && lectures.length >= 12 && lectures.every((l) => l.skill_ids.length >= 1 && lectureProblem(asInput(l), world(l.speaker_id, l.position_id ? positionsOf(l.speaker_id).find((p) => p.id === l.position_id) ?? null : null)) === null),
    `seed: all ${lectures.length} lectures pass the lecture check and link at least one skill`);
  ok(lectures.every((l) => { const r = resolvePosition(null, positionsOf(l.speaker_id)); return (r ? r.id : null) === l.position_id; }),
    `acceptance (FS44): every lecture names the KLRA position its speaker holds, where one exists (${lectures.filter((l) => l.position_id).length} of ${lectures.length})`);
  const ctbs = await q('select * from kafaa_contributions order by id');
  const ev = await q(`select id, person_id, skill_id, kind, basis, ref_table, ref_id, level from kafaa_skill_evidence where id like 'se:contrib:%'`);
  const val = ctbs.filter((c) => c.status === 'validated');
  ok(val.length >= 5 && val.every((c) => c.evidence_ids.length > 0 && c.evidence_ids.every((e) => ev.some((x) => x.id === e && x.kind === 'rating' && x.basis === 'validated' && x.ref_table === c.ref_table && x.level === c.level && x.level <= 3)))
    && ctbs.filter((c) => c.status !== 'validated').every((c) => !ev.some((x) => x.id.startsWith(`se:contrib:${c.id}:`))),
    `seed: ${val.length} validated contributions carry their F01 evidence (rating, validated, level <= 3); ${ctbs.length - val.length} pending or rejected ones carry none`);
  const ps = await q(`select person_id, skill_id, level from kafaa_person_skills where active`);
  ok(ev.every((e) => ps.some((s) => s.person_id === e.person_id && s.skill_id === e.skill_id && s.level >= 1)), 'seed: every contribution evidence row is reflected in a derived skill state');
  const items = await q('select * from kafaa_localisation_items order by id');
  ok(items.length === T.localisation_items.length && items.length >= 12 && items.every((i) => i.target_on && d10(i.target_on) <= '2030-12-31' && i.partner_org_id && i.programme_id),
    `acceptance (FS45): all ${items.length} partner-delivered items carry a programme, a partner and a target date no later than 2030-12-31`);
  const cols = (await q(`select column_name from information_schema.columns where table_name = 'kafaa_localisation_items'`)).map((r) => r.column_name);
  ok(!cols.some((c) => /readiness|ready|pct/.test(c)), 'acceptance (FS45): kafaa_localisation_items has no readiness column (readiness is computed, never entered)');

  // ── parity: FS44 rules
  const people = [...new Set([...lectures.map((l) => l.speaker_id), 'p-sro', 'p-nse', 'w-eng-01', 'p-buyer', 'p-k-ro', 'w-sec-01'])];
  const diffR = [];
  for (const pid of people) for (const req of [null, '', 'pos-p-sro', positionsOf(pid)[0]?.id ?? 'pos-zz', 'pos-w-mnt-01', 42]) {
    const s = (await q('select kafaa_lc_resolve($1::jsonb, $2) j', [JSON.stringify(req), pid]))[0].j;
    const t = resolvePosition(req, positionsOf(pid));
    const tj = t === false ? { ok: false } : { ok: true, id: t ? t.id : null };
    if (canon(s) !== canon(tj)) diffR.push(`${pid}/${req}`);
  }
  ok(diffR.length === 0, `SQL kafaa_lc_resolve equals resolvePosition() for ${people.length} people x 6 requests${diffR.length ? ` (${diffR[0]})` : ''}`);
  const base = asInput(lectures.find((l) => l.id === 'lec-001'));
  const cases = lectures.map((l) => [asInput(l), l.speaker_id, l.position_id]);
  const sp = 'w-mnt-01', pp = 'pos-w-mnt-01';
  const mut = [
    { title_en: 'abc' }, { title_ar: '' }, { abstract_en: 'short' }, { abstract_ar: 7 }, { format: 'webinar' }, { lang: 'fr' }, { system_family: 'security' }, { duration_min: 5 }, { duration_min: 300 }, { duration_min: 45.5 },
    { duration_min: '45' }, { delivered_on: '2014-12-31' }, { delivered_on: '2099-01-01' }, { delivered_on: '2026-02-30' }, { delivered_on: 20260101 }, { skill_ids: [] }, { skill_ids: ['sk-zz'] },
    { skill_ids: ['sk-fs-dp-dic', 'sk-fs-dp-dic'] }, { skill_ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, { skill_ids: 'sk-fs-dp-dic' }, { skill_ids: ['sk-fs-dp-dic', 5] },
    { skill_ids: ['sk-fs-dp-paperwp'] }, { chapters: 'x' }, { chapters: [{ at: 0, en: 'Intro', ar: 'مقدمة' }, { at: 999, en: 'Late', ar: 'متأخر' }] }, { chapters: [{ at: 1.5, en: 'a', ar: 'b' }] },
    { chapters: [{ at: 1, en: '', ar: 'b' }] }, { chapters: null }, { chapters: Array.from({ length: 13 }, (_, k) => ({ at: k, en: 'c', ar: 'ج' })) }, { recording_code: 'REC-26-1' }, { recording_code: '' },
    { recording_code: null }, { recording_code: 12 }, { title_en: 'How the perimeter is watched at night' }, { abstract_en: `${base.abstract_en} Mention the firewall rules.` },
    { abstract_ar: `${base.abstract_ar} كلمة المرور` }, { abstract_en: `${base.abstract_en} Call 0501234567 for slides.` }, { chapters: [{ at: 3, en: 'Network architecture', ar: 'بنية' }] },
  ];
  for (const m of mut) cases.push([{ ...base, ...m }, sp, pp]);
  const secSkill = skillRows.find((s) => s.area === 'security' || secComps.has(s.competency_id));
  if (secSkill) cases.push([{ ...base, skill_ids: ['sk-fs-dp-dic', secSkill.id] }, sp, pp]);
  cases.push([base, sp, null], [base, sp, 'pos-p-sro'], [base, 'p-buyer', null], [base, 'p-buyer', 'pos-w-mnt-01']);
  const secPos = posRows.find((p) => ['security', 'cyber', 'safeguards'].includes(p.family_id));
  if (secPos) cases.push([base, secPos.person_id, secPos.id]);
  const diffP = [];
  for (const [inp, speaker, posId] of cases) {
    const s = (await q('select kafaa_lc_problem($1::jsonb, $2, $3, $4::date) j', [JSON.stringify(inp), speaker, posId, today]))[0].j;
    const pos = posId ? posRows.find((p) => p.id === posId) ?? { id: posId } : null;
    const t = lectureProblem(inp, world(speaker, pos));
    if (canon(s) !== canon(t)) diffP.push(`${cases.indexOf(cases.find((c) => c[0] === inp))}: ${JSON.stringify(s)} vs ${JSON.stringify(t)}`);
  }
  ok(diffP.length === 0, `SQL kafaa_lc_problem equals lectureProblem() on ${cases.length} seeded and malformed lectures (texts, enums, dates, skills, security, chapters, positions, guard)${diffP.length ? ` (${diffP[0]})` : ''}`);
  ok(cases.some(([inp, s, p]) => lectureProblem(inp, world(s, p ? posRows.find((x) => x.id === p) ?? { id: p } : null))?.code === 'security_restricted'), 'the parity cases include security-restricted refusals');
  const lists = [...lectures.map((l) => l.skill_ids), ...(await q('select skill_ids from kafaa_knowledge_assets')).map((a) => a.skill_ids), ['sk-fs-cy-phishing', 'sk-fs-dp-dic'], ['sk-fs-dp-paperwp', 'sk-zz', 'sk-fs-dp-dic', 'sk-fs-dp-dic'], [], secSkill ? [secSkill.id, 'sk-co-01'] : ['sk-co-01']];
  const diffE = [];
  for (const l of lists) { const s = (await q('select kafaa_lc_evidence_skills($1::text[]) a', [l]))[0].a; if (canon(s) !== canon(evidenceSkills(l, skills, secComps))) diffE.push(l.join('+')); }
  ok(diffE.length === 0, `SQL kafaa_lc_evidence_skills equals evidenceSkills() on ${lists.length} skill lists (no security, cyber hygiene or obsolete evidence)${diffE.length ? ` (${diffE[0]})` : ''}`);
  const diffD = [];
  const ctb0 = ctbs.find((c) => c.status === 'pending');
  for (const c of [ctb0, { ...ctb0, status: 'validated' }, { ...ctb0, id: null }]) for (const me of [ctb0.person_id, 'p-training-mgr']) for (const dec of ['validate', 'reject', 'approve', null]) for (const note of ['', 'abc', 'A clear reason', 'x'.repeat(601)]) for (const src of [true, false]) for (const n of [0, 2]) {
    const s = (await q('select kafaa_lc_decide_problem(jsonb_populate_record(null::kafaa_contributions, $1::jsonb), $2, $3, $4, $5, $6) c', [JSON.stringify({ ...c, id: c.id }), me, dec, note, src, n]))[0].c;
    const t = decideProblem(c.id ? c : null, me, dec, note, src, n);
    if (s !== t) diffD.push(`${c.status}/${me}/${dec}/${note.length}/${src}/${n}: ${s} vs ${t}`);
  }
  ok(diffD.length === 0, `SQL kafaa_lc_decide_problem equals decideProblem() on 576 combinations (self-validation, decided, missing source, reasons)${diffD.length ? ` (${diffD[0]})` : ''}`);
  const tsVal = validatedContributions(ctbs.map((c) => ({ ...c, decided_on: d10(c.decided_on) })));
  ok(canon((await q('select kafaa_lc_validated(null) j'))[0].j) === canon(tsVal) && canon((await q(`select kafaa_lc_validated('w-mnt-01') j`))[0].j) === canon(validatedContributions(ctbs.map((c) => ({ ...c, decided_on: d10(c.decided_on) })), 'w-mnt-01')),
    `SQL kafaa_lc_validated equals validatedContributions() (FS72 suggestion source, ${tsVal.length} rows)`);
  const assetsPub = await q(`select id, author_id, sme_id from kafaa_knowledge_assets where status = 'published' and published`);
  ok(assetsPub.every((a) => contributorsOf('asset', a).every((k) => ctbs.some((c) => c.id === k.id && c.person_id === k.person_id && c.level === k.level))),
    `seed: every published knowledge asset has its SME and author contributions (${assetsPub.length} assets)`);

  // ── parity: FS45 rules
  const tracksTs = async (on) => {
    const tr = await q('select * from kafaa_instructor_tracks order by id');
    const obs = await q('select track_id, observer_person_id, kind, observed_on, score, result, id from kafaa_instructor_observations');
    const hrs = await q('select person_id, kind, delivered_on, hours from kafaa_teaching_hours');
    const recs = await q('select person_id, course_id, completed_on, result from kafaa_training_records where course_id in ($1, $2)', ['c-instr', 'c-asip']);
    const recsN = recs.map((r) => ({ ...r, completed_on: d10(r.completed_on) }));
    return tr.map((t) => {
      const tt = { ...t, accepted_on: d10(t.accepted_on), qualified_on: d10(t.qualified_on), lapsed_on: d10(t.lapsed_on), currency_due: d10(t.currency_due) };
      const init = initialDoneOn(t.person_id, t.route, recsN);
      const stage = deriveStage(tt, obs.filter((o) => o.track_id === t.id).map((o) => ({ ...o, observed_on: d10(o.observed_on) })), init);
      const cur = currencyView(tt, hrs.filter((h) => h.person_id === t.person_id).map((h) => ({ ...h, delivered_on: d10(h.delivered_on), hours: Number(h.hours) })), on);
      return { id: t.id, person_id: t.person_id, status: t.status, stage, discipline: t.discipline ?? '', standard_ids: t.standard_ids, currency: cur?.status ?? null };
    });
  };
  const dates = [today, '2026-12-01', '2027-07-01', '2028-06-30', '2030-12-31', '2031-01-01'];
  const itemsJ = (await q('select kafaa_lz_items() j'))[0].j;
  const diffT = [], diffB = [];
  for (const on of dates) {
    const sT = (await q('select kafaa_lz_tracks($1::date) j', [on]))[0].j;
    const tT = await tracksTs(on);
    if (canon(sT) !== canon(tT)) diffT.push(on);
    const sB = (await q('select kafaa_lz_compute($1::jsonb, $2::jsonb, $3::date) j', [JSON.stringify(itemsJ), JSON.stringify(sT), on]))[0].j;
    const tB = computeBoard(itemsJ, tT, on);
    if (canon(sB) !== canon(tB)) diffB.push(on);
  }
  ok(diffT.length === 0, `SQL kafaa_lz_tracks equals the M02 rules (deriveStage, currencyView) for all tracks on ${dates.length} dates${diffT.length ? ` (${diffT[0]})` : ''}`);
  ok(diffB.length === 0, `acceptance (FS45): readiness is computed from F31; SQL kafaa_lz_compute equals computeBoard() on ${dates.length} dates${diffB.length ? ` (${diffB[0]})` : ''}`);
  let seed = 53;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const stdPool = ['qs-ro', 'qs-sro', 'qs-lo-turbine', 'qs-lo-aux', 'qs-mech', 'qs-elec', 'qs-ic', 'qs-rp', 'qs-chem', 'qs-eng', 'qs-ero', 'qs-fire', 'qs-instr', 'qs-qa', 'qs-get'];
  const discPool = ['Operations', 'Maintenance', 'Quality', 'Leadership', ''];
  const stPool = ['partner_led', 'co_delivery', 'uae_led_supervised', 'transferred', 'on_hold'];
  const tTr = await tracksTs(today);
  const gen = [];
  for (let g = 0; g < 160; g++) {
    const stds = stdPool.filter(() => rand() < 0.15);
    const tgt = new Date(Date.parse('2025-06-01T00:00:00Z') + Math.floor(rand() * 2400) * 86400000).toISOString().slice(0, 10);
    gen.push({ id: `g-${String(g).padStart(3, '0')}`, programme_id: 'coit', standard_ids: stds, discipline: discPool[Math.floor(rand() * discPool.length)], instructors_needed: Math.floor(rand() * 7), baseline_on: '2024-01-01', target_on: tgt, status: stPool[Math.floor(rand() * stPool.length)], sort: Math.floor(rand() * 3) });
  }
  const sG = (await q('select kafaa_lz_compute($1::jsonb, $2::jsonb, $3::date) j', [JSON.stringify(gen), JSON.stringify(tTr), today]))[0].j;
  ok(canon(sG) === canon(computeBoard(gen, tTr, today)), 'SQL kafaa_lz_compute equals computeBoard() on 160 generated plan items (standards, disciplines, needs 0-6, targets 2025-2031, every status)');
  const diffS = [];
  const inputs = [{ status: 'transferred' }, { status: 'co_delivery' }, { status: 'on_hold', note: 'short' }, { status: 'on_hold', note: 'Waiting for the pipeline to grow' }, { status: 'partner_led', target_on: '2031-01-01', note: 'Moving the date for a reason' },
    { status: 'partner_led', target_on: '2027-02-30' }, { status: 'partner_led', target_on: '2023-01-01', note: 'Before the baseline date' }, { status: 'partner_led', target_on: '2029-01-01' }, { status: 'partner_led', target_on: '2029-01-01', note: 'Agreed with the partner in review' },
    { status: 'x' }, { status: 5 }, {}, { status: 'co_delivery', target_on: 7 }, { status: 'co_delivery', note: 'n'.repeat(601) }, { status: 'co_delivery', target_on: '' }, { status: 'co_delivery', target_on: null, note: 12 }];
  for (const it of [...itemsJ, ...gen.slice(0, 30)]) for (const x of inputs) {
    const r = readiness(it, tTr);
    const s = (await q('select kafaa_lz_status_problem($1::jsonb, $2::jsonb, $3::jsonb) c', [JSON.stringify(it), JSON.stringify(x), JSON.stringify(r)]))[0].c;
    const t = statusProblem(it, x, r);
    if (s !== t) diffS.push(`${it.id} ${JSON.stringify(x)}: ${s} vs ${t}`);
  }
  ok(diffS.length === 0, `SQL kafaa_lz_status_problem equals statusProblem() on ${(itemsJ.length + 30) * inputs.length} cases (2030 cap, notes, transferred needs readiness)${diffS.length ? ` (${diffS[0]})` : ''}`);

  // ── RLS
  let n = 5301;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  await addProfile('nse', 'Nuclear Specification Engineer');
  await addProfile('sme-reviewer', 'SME Reviewer');
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  const pubN = lectures.filter((l) => l.status === 'published').length;
  ok(await cnt(null, 'select count(*)::int n from kafaa_lectures') === 0 && await cnt(null, 'select count(*)::int n from kafaa_contributions') === 0 && await cnt(null, 'select count(*)::int n from kafaa_localisation_items') === 0,
    'RLS: anonymous visitors read no lectures, contributions or localisation items');
  ok(await cnt('nse', 'select count(*)::int n from kafaa_lectures') === pubN && await cnt('sro', 'select count(*)::int n from kafaa_lectures') === pubN + lectures.filter((l) => l.speaker_id === 'p-sro' && l.status !== 'published').length,
    `RLS: staff read the ${pubN} published lectures; a speaker also reads their own draft`);
  ok(await cnt('alnoor-gm', 'select count(*)::int n from kafaa_lectures') === 0 && await cnt('alnoor-gm', 'select count(*)::int n from kafaa_localisation_items') === 0, 'RLS: partners read no lectures and no localisation items');
  ok(await cnt('nse', 'select count(*)::int n from kafaa_contributions') === ctbs.filter((c) => c.person_id === 'p-nse').length && await cnt('training-mgr', 'select count(*)::int n from kafaa_contributions') === 0
    && await cnt('chco', 'select count(*)::int n from kafaa_contributions') === 0, 'RLS: people read only their own contributions (the KM owner works the queue through the RPC)');
  ok(await cnt('nse', 'select count(*)::int n from kafaa_localisation_items') === items.length && await cnt('k-auditor', 'select count(*)::int n from kafaa_localisation_items') === items.length,
    'RLS: staff and auditors read every localisation item (knowledge R)');

  // ── RPC flows (rolled back afterwards)
  await db.exec('begin');
  try {
    const r = async (who, sql, p = []) => (await one(who, sql, p)).r;
    const draft = { title_en: 'Microreactor transport concepts for operators', title_ar: 'مفاهيم نقل المفاعلات الدقيقة للمشغلين', abstract_en: 'Notes on the published operating concepts for transportable units and what they mean for crew training.',
      abstract_ar: 'ملاحظات حول مفاهيم التشغيل المنشورة للوحدات القابلة للنقل وما تعنيه لتدريب الأطقم.', format: 'talk', lang: 'en', delivered_on: today, duration_min: 30, skill_ids: ['sk-fs-adv-micro'], system_family: 'reactor_core',
      chapters: [{ at: 0, en: 'Concepts', ar: 'المفاهيم' }], submit: false };
    const sec = await r('sro', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify({ ...draft, skill_ids: secSkill ? [secSkill.id] : ['sk-fs-adv-micro'] })]);
    const txt = await r('sro', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify({ ...draft, abstract_en: `${draft.abstract_en} Includes the perimeter layout.` })]);
    const ar = await r('sro', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify({ ...draft, title_ar: 'الحراسة في المحطة ليلاً' })]);
    ok(sec.code === 'security_restricted' && txt.code === 'security_restricted' && ar.code === 'security_restricted', 'acceptance (FS44): security-restricted skills and texts (EN and AR) are refused with security_restricted');
    const beh = await r('sro', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify({ ...draft, speaker_id: 'p-nse' })]);
    const partner = await r('alnoor-gm', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify(draft)]);
    const notMine = await r('sro', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify({ ...draft, position_id: 'pos-w-mnt-01' })]);
    ok(beh.code === 'forbidden' && partner.code === 'forbidden' && notMine.code === 'invalid', 'saveLecture: staff record only their own talks, partners none, and a position must be the speaker\'s own');
    const saved = await r('sro', 'select kafaa_save_lecture($1::jsonb) r', [JSON.stringify({ ...draft, submit: true })]);
    ok(saved.ok && saved.data.status === 'review' && saved.data.position_id === resolvePosition(null, positionsOf('p-sro')).id, 'saveLecture: a valid lecture is submitted and linked to the speaker\'s own KLRA position automatically');
    const selfPub = await r('sro', 'select kafaa_publish_lecture($1) r', [saved.data.id]);
    const led0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const pub = await r('training-mgr', 'select kafaa_publish_lecture($1) r', [saved.data.id]);
    const led1 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const c1 = (await q('select status, level, person_id from kafaa_contributions where id = $1', [`ctb-${saved.data.id}`]))[0];
    ok(selfPub.code === 'forbidden' && pub.ok && led1 === led0 + 1 && c1?.status === 'pending' && c1.level === 3 && c1.person_id === 'p-sro', 'publishLecture: KM owner only; publishing writes the ledger and opens the speaker\'s pending contribution (level 3)');
    await db.exec(`update kafaa_lectures set status = 'review', published = false, title_en = 'Night walkdowns along the perimeter fence' where id = 'lec-013'`);
    const pubSec = await r('training-mgr', `select kafaa_publish_lecture('lec-013') r`);
    ok(pubSec.code === 'security_restricted' && (await q(`select status from kafaa_lectures where id = 'lec-013'`))[0].status === 'review', 'acceptance (FS44): a security-restricted topic can never be published (re-screened at publication)');
    // acceptance FS44 #1: unvalidated contributions write nothing; validated ones recompute skills
    const before = await q(`select id, level, confidence from kafaa_person_skills where person_id = 'w-eng-01' and active order by id`);
    ok(!before.some((s) => s.id === 'ps:w-eng-01:sk-fs-gr-lifecycle') && Number((await q(`select count(*)::int n from kafaa_skill_evidence where id like 'se:contrib:ctb-lec-007:%'`))[0].n) === 0,
      'acceptance (FS44): a pending contribution has written no evidence and no skill state');
    const forb = await r('sro', `select kafaa_validate_contribution('ctb-lec-007', 'validate', '') r`);
    const v = await r('training-mgr', `select kafaa_validate_contribution('ctb-lec-007', 'validate', 'Checked against the linked skill') r`);
    const after = await q(`select id, level, basis from kafaa_person_skills where person_id = 'w-eng-01' and active and skill_id = 'sk-fs-gr-lifecycle'`);
    const evRow = (await q(`select kind, basis, ref_table, ref_id, level from kafaa_skill_evidence where id = 'se:contrib:ctb-lec-007:sk-fs-gr-lifecycle'`))[0];
    ok(forb.code === 'forbidden' && v.ok && evRow?.kind === 'rating' && evRow.basis === 'validated' && evRow.ref_table === 'lectures' && evRow.ref_id === 'lec-007' && evRow.level === 3 && after.length === 1 && after[0].level === 3,
      'acceptance (FS44): validating a contribution writes rating/validated evidence (ref_table lectures) and recomputes the person\'s skills (new state at level 3)');
    await q(`select kafaa_skills_apply('w-eng-01', current_date)`);
    ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where id = 'se:contrib:ctb-lec-007:sk-fs-gr-lifecycle' and active`))[0].n) === 1, 'F01 recompute keeps contribution evidence (recorded, not derived)');
    const b8 = await q(`select id, level, confidence from kafaa_person_skills where person_id = 'w-rp-02' and active order by id`);
    const rj0 = await r('training-mgr', `select kafaa_validate_contribution('ctb-lec-008', 'reject', 'no') r`);
    const rj = await r('training-mgr', `select kafaa_validate_contribution('ctb-lec-008', 'reject', 'Please add your own outage examples') r`);
    const a8 = await q(`select id, level, confidence from kafaa_person_skills where person_id = 'w-rp-02' and active order by id`);
    ok(rj0.code === 'invalid' && rj.ok && canon(a8) === canon(b8) && Number((await q(`select count(*)::int n from kafaa_skill_evidence where id like 'se:contrib:ctb-lec-008:%'`))[0].n) === 0,
      'acceptance (FS44): a rejected contribution needs a reason and writes no evidence; the person\'s skills are unchanged');
    const again = await r('training-mgr', `select kafaa_validate_contribution('ctb-lec-007', 'validate', '') r`);
    await db.exec(`insert into kafaa_contributions (id, person_id, kind, contributor_role, ref_table, ref_id, skill_ids, level, status, submitted_on) values ('ctb-test-self', 'p-training-mgr', 'lecture', 'speaker', 'lectures', 'lec-001', '{sk-fs-dp-dic}', 3, 'pending', current_date)`);
    const self = await r('training-mgr', `select kafaa_validate_contribution('ctb-test-self', 'validate', '') r`);
    ok(again.code === 'invalid' && self.code === 'maker_checker', 'validateContribution: a decided contribution cannot be decided again; nobody validates their own');
    const wd = await r('training-mgr', `select kafaa_withdraw_lecture('lec-009', 'Recording needs an update') r`);
    const src = await r('training-mgr', `select kafaa_validate_contribution('ctb-lec-009', 'validate', '') r`);
    const srcRej = await r('training-mgr', `select kafaa_validate_contribution('ctb-lec-009', 'reject', 'Lecture withdrawn before validation') r`);
    ok(wd.ok && src.code === 'source_unavailable' && srcRej.ok, 'validateContribution: a withdrawn lecture cannot be validated (it can still be rejected)');
    const sync = await r('training-mgr', 'select kafaa_sync_contributions() r');
    const syncSro = await r('sro', 'select kafaa_sync_contributions() r');
    ok(sync.ok && sync.data.created === 0 && syncSro.code === 'forbidden', 'syncContributions: KM owner only; nothing missing after the seed');
    const qTm = (await one('training-mgr', 'select kafaa_contribution_queue() v')).v;
    const qAu = (await one('k-auditor', 'select kafaa_contribution_queue() v')).v;
    ok(qTm?.can_decide === true && qTm.pending.length > 0 && qTm.pending.every((x) => Array.isArray(x.reasons) && x.reasons.length >= 3) && qAu?.can_decide === false && (await one('sro', 'select kafaa_contribution_queue() v')).v === null,
      `contributionQueue: KM owner decides (${qTm?.pending.length} pending, each with reasons), auditors read, staff get nothing`);
    // FS45
    const bS = (await one('nse', 'select kafaa_localisation_board() v')).v;
    const bT = (await one('training-mgr', 'select kafaa_localisation_board() v')).v;
    const bA = (await one('k-auditor', 'select kafaa_localisation_board() v')).v;
    ok(bS.items.length === items.length && bS.items.every((i) => i.instructors === null && i.target_on) && bS.can_edit === false && bT.can_edit === true && bT.items.every((i) => Array.isArray(i.instructors))
      && bA.can_see_people === true && (await one('alnoor-gm', 'select kafaa_localisation_board() v')).v === null,
      'localisationBoard: every item with its date for staff (no names); instructor detail for SAT readers; edit for the training manager only; partners get nothing');
    const od = (await one('chco', 'select kafaa_localisation_overdue() v')).v;
    const odIds = od.items.map((x) => x.id);
    ok(odIds.length >= 2 && od.items.every((x) => x.days_overdue > 0) && bS.items.filter((i) => i.risk.overdue).map((i) => i.id).sort().join() === [...odIds].sort().join()
      && (await one('sro', 'select kafaa_localisation_overdue() v')).v.items.length === odIds.length,
      `acceptance (FS45): items past their target are flagged and listed for the F22 handover board (${odIds.join(', ')})`);
    const ic0 = bS.items.find((i) => i.id === 'loc-maint-ic').readiness;
    await db.exec(`insert into kafaa_instructor_tracks (id, person_id, person_name, person_name_ar, route, discipline, standard_ids, stage, status, started_on, accepted_on, qualified_on, first_qualified_on)
      values ('it-test-ic', 'w-mnt-03', 'Test', 'اختبار', 'sme', 'Maintenance', '{qs-ic}', 'ready', 'active', '2026-01-01', '2026-01-10', null, null)`);
    const ic1 = (await one('nse', 'select kafaa_localisation_board() v')).v.items.find((i) => i.id === 'loc-maint-ic').readiness;
    ok(ic0.pct === 0 && ic1.pipeline === ic0.pipeline + 1 && ic1.tenths > ic0.tenths, `acceptance (FS45): readiness follows the F31 pipeline (I&C item ${ic0.pct}% -> ${ic1.pct}% when a track covering its standard appears)`);
    const fS = await r('sro', `select kafaa_set_localisation_status('loc-maint-ic', '{"status":"co_delivery"}'::jsonb) r`);
    const fI = await r('k-instructor', `select kafaa_set_localisation_status('loc-maint-ic', '{"status":"co_delivery"}'::jsonb) r`);
    const nr = await r('training-mgr', `select kafaa_set_localisation_status('loc-maint-ic', '{"status":"transferred"}'::jsonb) r`);
    const big = await r('training-mgr', `select kafaa_set_localisation_status('loc-maint-ic', '{"status":"partner_led","target_on":"2031-03-31","note":"Partner asked for more time"}'::jsonb) r`);
    const nn = await r('training-mgr', `select kafaa_set_localisation_status('loc-maint-ic', '{"status":"partner_led","target_on":"2030-03-31"}'::jsonb) r`);
    const led2 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const okS = await r('training-mgr', `select kafaa_set_localisation_status('loc-maint-ic', '{"status":"co_delivery","target_on":"2030-03-31","note":"Joint delivery agreed for the next intake"}'::jsonb) r`);
    const led3 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const row = (await q(`select status, target_on, jsonb_array_length(history) h from kafaa_localisation_items where id = 'loc-maint-ic'`))[0];
    ok(fS.code === 'forbidden' && fI.code === 'forbidden' && nr.code === 'not_ready' && big.code === 'invalid' && nn.code === 'note_required' && okS.ok && led3 === led2 + 1 && row.status === 'co_delivery' && d10(row.target_on) === '2030-03-31' && row.h === 2,
      'setLocalisationStatus: training manager only; transferred needs computed readiness; no target after 2030; a moved date needs a reason; the change is ledgered and kept in the history');
    const tq = bS.items.find((i) => i.id === 'loc-qa-auditor');
    const tr = await r('training-mgr', `select kafaa_set_localisation_status('loc-qa-auditor', '{"status":"transferred","note":"Partner countersignature no longer needed"}'::jsonb) r`);
    ok(tq.readiness.ready_now >= tq.readiness.needed ? tr.ok : tr.code === 'not_ready', `setLocalisationStatus: an item whose computed readiness covers it can be marked transferred (QA auditor sign-off, ${tq.readiness.ready_now} of ${tq.readiness.needed})`);
    let ckRefused = false;
    try { await db.exec(`savepoint s1; update kafaa_localisation_items set target_on = '2031-01-01' where id = 'loc-apr1400'`); } catch { ckRefused = true; }
    await db.exec('rollback to savepoint s1');
    ok(ckRefused, 'the table itself refuses a target date after 2030-12-31 (check constraint)');
  } finally { await db.exec('rollback'); }

  // ── grants and additivity
  let helperDenied = 0;
  const helpers = ['select kafaa_lc_problem(\'{}\'::jsonb, \'p-sro\', null, current_date)', 'select kafaa_lc_validated(null)', 'select kafaa_lz_tracks(current_date)', 'select kafaa_lz_compute(\'[]\'::jsonb, \'[]\'::jsonb, current_date)', 'select kafaa_lc_open(\'lecture\', \'lec-001\')'];
  for (const sql of helpers) { try { await one('nse', sql); } catch { helperDenied++; } }
  ok(helperDenied === helpers.length, 'grants: internal helpers are not executable by signed-in users');
  let anonDenied = 0;
  for (const sql of ['select kafaa_localisation_board()', 'select kafaa_contribution_queue()', 'select kafaa_save_lecture(\'{}\'::jsonb)']) { try { await one(null, sql); } catch { anonDenied++; } }
  ok(anonDenied === 3, 'grants: anonymous visitors execute none of the FS53 RPCs');
  const text = readFileSync(MIG, 'utf8');
  ok(!/\bdrop\b/i.test(text) && !/\bdelete\b/i.test(text) && !/\btruncate\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text),
    'additive: the FS53 migration drops nothing, deletes nothing (the words never appear) and alters only kafaa_* tables');
}
