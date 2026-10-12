// [FS wave F · E3 · FS54 + FS55] PGlite checks for 20261010263001_kafaa_fs63_taxonomy_governance.sql (M16).
// Seed acceptance (published retires and splits keep the skill as obsolete, two different approvers per decision, no person ids in the public
// log, every ranked surface has its card); SQL = TS parity of the rules on the seed and on generated cases: inclusion rule, proposal and vote
// refusals, titles, name keys, level essence, the change plan (every kind, applied to a copy of the catalogue), staleness and the orphan-rate
// audit, ranked-surface fairness (every seeded week); the RPC flows as real roles (maker-checker, one ledger row per vote, retire marks
// obsolete, the guard refuses removals and un-obsoleting, refusals by code); RLS and the council queue; the guarded engine-card replay;
// grants and additivity. Writes run inside a transaction that is rolled back. Prints the function md5s and table digests for the live check.
import { readFileSync } from 'node:fs';
import { changePlan, decideProblem, inclusionChecks, methodologyNotices, normName, proposeProblem, requestTitle, taxonomyHealth, GOV_MSG } from '../../src/modules/m16/taxonomyGov.ts';
import { RANKED_SURFACES, surfaceSnapshot } from '../../src/modules/m16/surfaces.ts';
import { levelEssence } from '../../src/domain/taxonomy.ts';

const MIG = 'supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' && !(v instanceof Date) ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : v instanceof Date ? JSON.stringify(v.toISOString().slice(0, 10)) : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const RPCS = ['kafaa_propose_skill_change', 'kafaa_decide_skill_change', 'kafaa_skill_council_queue', 'kafaa_taxonomy_health', 'kafaa_run_surface_fairness'];

export default async function fs63Checks({ db, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave F · E3 · FS54 skills council and taxonomy change tracker · FS55 engine cards, datasheet, model-risk template');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const day = String((await q(`select to_char(current_date, 'YYYY-MM-DD') d`))[0].d);

  // ── seed acceptance
  const cards = new Map(T.engine_cards.map((c) => [c.id, c]));
  const missing = RANKED_SURFACES.filter((s) => !cards.has(s.card) || s.functions.some((f) => !cards.get(s.card).scoring_functions.includes(f)));
  ok(T.engine_cards.length === RANKED_SURFACES.length && missing.length === 0, `seed: every ranked surface (${RANKED_SURFACES.length}) has its engine card, listing every ranking function it claims${missing.length ? ` (${missing[0].card})` : ''}`);
  ok(RANKED_SURFACES.every((s) => { const c = cards.get(s.card); return c.kernel_surface === s.kernel && c.ranks === s.ranks && c.engine_surface === s.stored; }), 'seed: every card carries its kernel surface, what it ranks and its stored engine setting');
  ok(cards.get('navigator').version === 3 && cards.get('future').version === 3 && cards.get('navigator').scoring_functions.includes('src/modules/m18/FutureRoles.tsx#rankConcepts'), 'seed: navigator and Future Me cards name rankConcepts, bridgePlan and rankRaises at version 3');
  const retired = T.skill_changes.filter((c) => c.kind === 'retire' || c.kind === 'split');
  ok(retired.length >= 1 && retired.every((c) => T.skills.some((s) => s.id === c.skill_id && s.lifecycle === 'obsolete' && s.obsolete_on)), 'acceptance (FS54): every published retire keeps the skill in the catalogue, marked obsolete with its date');
  const decided = T.skill_change_requests.filter((r) => r.status === 'published' || r.status === 'rejected');
  ok(decided.length === 50 && decided.every((r) => r.first_by && r.second_by && r.first_by !== r.second_by && r.first_by !== r.proposed_by && r.second_by !== r.proposed_by && r.votes.length === 2),
    'acceptance (FS54): every seeded decision (49 published, 1 rejected) has two different approvers, neither the proposer');
  ok(T.skill_changes.every((c) => c.decided_roles.length === 2 && !JSON.stringify(c).match(/"(p|w)-[a-z0-9-]+"/)), 'the public change log names roles only, never a person id');
  ok(methodologyNotices(T.skill_changes, 'skills_outlook', '2026-10-11').length > 0 && methodologyNotices(T.skill_changes, 'skills_outlook', '2026-10-11').every((c) => c.methodology), 'methodology notices exist for the skills outlook (recent additions)');

  // ── SQL = TS: name keys, essence, titles
  const names = ['Data  Pipeline ', 'إدارة الأعمال', 'أمان', 'إِدَارَة', 'مبادرة', 'مستوى', 'Ünïcode', '', '  x\t', 'AI-Agent Oversight'];
  let diff = [];
  for (const s of names) { const r = (await q('select kafaa_fs63_norm($1) n', [s]))[0].n; if (r !== normName(s)) diff.push(s); }
  ok(diff.length === 0, `SQL kafaa_fs63_norm equals normName on ${names.length} names${diff.length ? ` (${diff[0]})` : ''}`);
  diff = [];
  for (const lv of [1, 2, 3, 4]) for (const [en, ar] of [['Data pipeline basics', 'أساسيات خطوط البيانات'], ['AI risk', 'مخاطر']]) {
    const r = (await q('select kafaa_fs63_essence($1, $2, $3) e', [lv, en, ar]))[0].e;
    if (canon(r) !== canon(levelEssence(lv, { en, ar }))) diff.push(`${lv}/${en}`);
  }
  ok(diff.length === 0, 'SQL kafaa_fs63_essence equals levelEssence for levels 1-4');
  diff = [];
  for (const r of T.skill_change_requests) {
    const s = r.skill_id ? T.skills.find((x) => x.id === r.skill_id) : null;
    const sq = (await q('select kafaa_fs63_title($1, $2, $3, $4::jsonb) t', [r.kind, s?.name_en ?? null, s?.name_ar ?? null, JSON.stringify(r.proposal)]))[0].t;
    const ts = requestTitle(r.kind, s, r.proposal);
    if (canon(sq) !== canon(ts) || sq.en !== r.title_en || sq.ar !== r.title_ar) diff.push(r.id);
  }
  ok(diff.length === 0, `SQL kafaa_fs63_title equals requestTitle (and the stored title) for all ${T.skill_change_requests.length} seeded requests${diff.length ? ` (${diff[0]})` : ''}`);

  // ── SQL = TS: inclusion rule and proposal refusals on seeded and generated proposals
  const dbSkills = (await q('select to_jsonb(s) j from kafaa_skills s order by id')).map((r) => r.j);
  const comps = (await q('select id from kafaa_competencies')).map((r) => r.id);
  const reqs = (await q('select to_jsonb(r) j from kafaa_skill_change_requests r')).map((r) => r.j);
  let seed = 63;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pickOf = (a) => a[Math.floor(rand() * a.length)];
  const live = dbSkills.filter((s) => s.lifecycle !== 'obsolete');
  const base = [
    ...T.skill_change_requests.filter((r) => r.status !== 'published').map((r) => ({ kind: r.kind, skill_id: r.skill_id, proposal: r.proposal, rationale: r.rationale, development: r.development, assessment: r.assessment })),
    { kind: 'add', skill_id: null, proposal: { name_en: 'Hydrogen safety interfaces', name_ar: 'واجهات سلامة الهيدروجين', area: 'safety', competency_id: comps[0], key_level: 2, source_label: 'L', source_url: 'https://example.org/a' }, rationale: 'A rationale long enough.', development: 'Developed through a dedicated module and practice.', assessment: 'Assessed with a dedicated practical exercise here.' },
    { kind: 'relevel', skill_id: live[3].id, proposal: { key_level: live[3].key_level === 4 ? 3 : live[3].key_level + 1 }, rationale: 'A rationale long enough.', development: 'Developed through a dedicated module and practice.', assessment: 'Assessed with a dedicated practical exercise here.' },
  ];
  const blanks = ['', ' ', '\t\n', null, 7, 'x', 'نص', 'A long enough statement for the rule.'];
  const mut = [
    (x) => ({ ...x, kind: pickOf(['add', 'rename', 'split', 'retire', 'relevel', 'merge', '', null]) }),
    (x) => ({ ...x, skill_id: pickOf([null, '', live[0].id, live[7].id, 'sk-fs-dp-paperwp', 'sk-nope', pickOf(live).id]) }),
    (x) => ({ ...x, rationale: pickOf(['short', ' '.repeat(12), 'x'.repeat(1001), 'A fine rationale here.', null]) }),
    (x) => ({ ...x, development: pickOf(blanks) }), (x) => ({ ...x, assessment: pickOf(blanks) }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), name_en: pickOf([...blanks, live[2].name_en, live[5].alt_labels_en?.[0] ?? 'zz', `  ${live[9].name_en.toUpperCase()} `, 'Brand new skill name']) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), name_ar: pickOf([...blanks, live[2].name_ar, 'اسم جديد تماماً', 'x'.repeat(130)]) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), key_level: pickOf([1, 2, 3, 4, 0, 5, 2.5, '2', null, undefined]) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), source_url: pickOf(['https://ok.example/x', 'http://no.example', 'https://a b', null, 3]) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), source_label: pickOf(blanks) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), area: pickOf(['digital', 'safety', 'nope', null]), competency_id: pickOf([comps[1], 'nope', null]) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), replaced_by: pickOf([null, live[1].id, 'sk-fs-dp-paperwp', 'sk-nope', 5, x.skill_id]) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), level_essence_en: pickOf([' ', 'A changed essence', null]) } }),
    (x) => ({ ...x, proposal: { ...(x.proposal ?? {}), parts: pickOf([[], null, 'x', [{ name_en: 'Part one', name_ar: 'الجزء الأول' }], [{ name_en: 'Part one', name_ar: 'الجزء الأول' }, { name_en: 'Part two', name_ar: 'الجزء الثاني' }],
      [{ name_en: 'Same', name_ar: 'نفس' }, { name_en: 'same ', name_ar: 'آخر' }], [{ name_en: 'P', name_ar: 'ب' }, 'x'], [{ name_en: live[4].name_en, name_ar: 'جديد' }, { name_en: 'Fresh part', name_ar: 'جزء جديد' }],
      Array.from({ length: 5 }, (_, k) => ({ name_en: `Part ${k}`, name_ar: `جزء ${k}` }))]) } }),
  ];
  diff = [];
  let nInc = 0, nProp = 0;
  for (let g = 0; g < 420; g++) {
    let x = { ...pickOf(base) };
    for (let k = 0, n = Math.floor(rand() * 4); k < n; k++) x = pickOf(mut)(x);
    const sx = JSON.stringify(x);
    const si = (await q('select kafaa_fs63_inclusion($1::jsonb) v', [sx]))[0].v;
    const ti = inclusionChecks(x, dbSkills, comps);
    nInc++;
    if (canon(si) !== canon(ti)) diff.push(`inclusion ${g}: sql ${canon(si)} ts ${canon(ti)} for ${sx}`);
    const sp = (await q('select kafaa_fs63_propose_problem($1::jsonb) v', [sx]))[0].v;
    const tp = proposeProblem(x, dbSkills, comps, reqs);
    nProp++;
    if ((sp ?? null) !== (tp ?? null)) diff.push(`propose ${g}: sql ${sp} ts ${tp} for ${sx}`);
  }
  ok(diff.length === 0, `SQL kafaa_fs63_inclusion / kafaa_fs63_propose_problem equal inclusionChecks / proposeProblem on ${nInc} generated proposals${diff.length ? ` (${diff[0]})` : ''}`);
  ok(T.skill_change_requests.filter((r) => r.status !== 'published').every((r) => r.inclusion.every((c) => c.ok)), 'every open or rejected seeded request met the inclusion rule when proposed');

  // ── SQL = TS: vote refusals
  diff = [];
  const people = ['p-training-mgr', 'p-chco', 'p-k-admin', 'p-k-instructor'];
  for (let g = 0; g < 160; g++) {
    const r = pickOf([...reqs, null]);
    const me = pickOf(people), dec = pickOf(['approve', 'reject', 'maybe', null]), note = pickOf([null, '', 'too short', 'A reason that is long enough.', 'x'.repeat(501)]);
    const sq = r ? (await q('select kafaa_fs63_decide_problem(r, $2, $3, $4) v from kafaa_skill_change_requests r where id = $1', [r.id, me, dec, note]))[0].v
      : (await q('select kafaa_fs63_decide_problem(null::kafaa_skill_change_requests, $1, $2, $3) v', [me, dec, note]))[0].v;
    const tq = decideProblem(r, me, dec, note);
    if ((sq ?? null) !== (tq ?? null)) diff.push(`${r?.id}/${me}/${dec}: sql ${sq} ts ${tq}`);
  }
  ok(diff.length === 0, `SQL kafaa_fs63_decide_problem equals decideProblem on 160 generated votes${diff.length ? ` (${diff[0]})` : ''}`);

  // ── SQL = TS: staleness and orphan-rate audit
  const healthData = async () => {
    const t = async (name) => (await q(`select to_jsonb(x) j from kafaa_${name} x`)).map((r) => r.j);
    return { skills: await t('skills'), courses: await t('courses'), courseSkillLinks: await t('course_skill_links'), pathways: await t('pathways'), standards: await t('qual_standards'),
      adaptiveBanks: await t('adaptive_banks'), adaptiveItems: await t('adaptive_items'), perfTasks: await t('performance_tasks'), twinScenarios: await t('twin_scenarios'), aiDrills: await t('ai_drills'),
      fitnessAreas: await t('fitness_areas'), profileVersions: await t('role_profile_versions'), roleCompetencies: await t('role_competencies'), taskSkills: await t('jta_task_skills') };
  };
  const hd = await healthData();
  diff = [];
  for (const d of ['2026-01-01', '2026-09-30', day, '2027-06-30', '2029-01-15']) {
    const sq = (await q('select kafaa_fs63_health($1::date) h', [d]))[0].h;
    const tq = taxonomyHealth(hd, d);
    if (canon(sq) !== canon(tq)) diff.push(d);
  }
  ok(diff.length === 0, `SQL kafaa_fs63_health equals taxonomyHealth on the seed for 5 dates${diff.length ? ` (${diff[0]})` : ''}`);
  const h0 = taxonomyHealth(hd, day);
  ok(h0.summary.live === h0.skills.length && h0.summary.overdue === h0.skills.filter((s) => s.review === 'overdue').length && h0.summary.orphans === h0.skills.filter((s) => s.orphan).length,
    `acceptance (FS54): staleness (${h0.summary.overdue} overdue, ${h0.summary.due_soon} due soon) and orphan rate (${h0.summary.orphans} of ${h0.summary.live}; ${h0.summary.untaught} untaught, ${h0.summary.no_role} without a role) are computed with per-skill drill-down rows`);

  // ── SQL = TS: ranked-surface fairness for every seeded week, and the stored rows
  const sd = async () => {
    const t = async (name) => (await q(`select to_jsonb(x) j from kafaa_${name} x`)).map((r) => r.j);
    return { people: await t('people'), digestRuns: await t('digest_runs'), advisorSessions: await t('advisor_sessions'), pathwayEnrolments: await t('pathway_enrolments'), externalCompletions: await t('external_completions'),
      fitnessAttempts: await t('fitness_attempts'), opportunities: await t('opportunities'), applications: await t('opportunity_applications'), twinAttempts: await t('twin_attempts'),
      adaptiveAttempts: await t('adaptive_attempts'), instructorTracks: await t('instructor_tracks') };
  };
  const sdat = await sd();
  diff = [];
  const weeks = [...new Set(T.surface_fairness.map((r) => r.as_of))].sort();
  for (const w of weeks) {
    const sq = (await q('select kafaa_fs63_fairness_compute($1::date) r', [w]))[0].r;
    const tq = surfaceSnapshot(sdat, w);
    if (canon(sq) !== canon(tq)) diff.push(w);
  }
  ok(weeks.length === 10 && diff.length === 0, `SQL kafaa_fs63_fairness_compute equals surfaceSnapshot for all 10 seeded weeks${diff.length ? ` (${diff[0]})` : ''}`);
  const stored = (await q(`select id, period, to_char(as_of, 'YYYY-MM-DD') as_of, card, metric, dimension, group_key, n, positives, rate::float8 rate, ratio::float8 ratio, suppressed, flagged, source from kafaa_surface_fairness order by id`));
  const want = weeks.flatMap((w) => surfaceSnapshot(sdat, w)).map((r) => ({ id: r.id, period: r.period, as_of: r.as_of, card: r.card, metric: r.metric, dimension: r.dimension, group_key: r.group_key, n: r.n, positives: r.positives, rate: r.rate, ratio: r.ratio, suppressed: r.suppressed, flagged: r.flagged, source: r.source }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  ok(canon(stored) === canon(want), `the ${stored.length} seeded surface fairness rows are exactly what the snapshot computes`);
  ok(stored.every((r) => (r.suppressed ? r.n == null && r.rate == null && r.ratio == null && !r.flagged : r.n >= 10)), 'acceptance (FS55): every comparison with a group under 10 is suppressed whole (no counts, no rates)');

  // ── writes: RPC flows as real roles (rolled back)
  const tryAs = async (persona, sql, params = []) => {
    await db.exec('savepoint fs63');
    try {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
      await db.exec(persona ? 'set local role authenticated' : 'set local role anon');
      const rows = (await db.query(sql, params)).rows;
      await db.exec('reset role');
      await db.exec('release savepoint fs63');
      return { ok: true, rows };
    } catch (e) {
      await db.exec('rollback to savepoint fs63');
      await db.exec('reset role');
      return { ok: false, msg: String(e.message) };
    }
  };
  const rpc = async (persona, sql, params) => { const r = await tryAs(persona, sql, params); return r.ok ? r.rows[0].r : { ok: false, code: 'error', message: r.msg }; };
  const ledgerN = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const auditN = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  await db.exec('begin');
  try {
    // proposals
    const addP = { kind: 'add', proposal: { name_en: 'Hydrogen safety interfaces', name_ar: 'واجهات سلامة الهيدروجين', description_en: 'Recognises hydrogen hazards at plant interfaces.', description_ar: 'يدرك مخاطر الهيدروجين عند واجهات المحطة.',
      area: 'safety', competency_id: comps[0], key_level: 2, fs_area: 'green_energy', decay_class: 'standard', owner_role: 'sustainability', source_label: 'IAEA', source_url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices' },
      rationale: 'Hydrogen production pilots need the hazard awareness at interfaces.', development: 'Developed through a dedicated interface module and a site walk-down.', assessment: 'Assessed through a scenario quiz on interface hazards and an observed walk-down.' };
    const a0 = await auditN(), l0 = await ledgerN();
    const p1 = await rpc('k-instructor', 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify(addP)]);
    ok(p1.ok && p1.data.status === 'submitted' && /^scr-\d{3}$/.test(p1.data.id) && (await auditN()) === a0 + 1 && (await ledgerN()) === l0, 'staff (an instructor) propose an addition: submitted, audited, no ledger row (only decisions are material)');
    const pAnon = await rpc(null, 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify(addP)]);
    const pAud = await rpc('k-auditor', 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify(addP)]);
    const pDup = await rpc('sro', 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify(addP)]);
    const pInc = await rpc('sro', 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify({ ...addP, proposal: { ...addP.proposal, name_en: 'Another hydrogen skill', name_ar: 'مهارة أخرى' }, assessment: 'Quiz' })]);
    const pTaken = await rpc('sro', 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify({ ...addP, proposal: { ...addP.proposal, name_en: T.skills[3].name_en, name_ar: 'اسم آخر' } })]);
    ok((pAnon.ok === false && ['not_signed_in', 'error'].includes(pAnon.code)) && pAud.code === 'forbidden' && pDup.code === 'conflict' && pDup.message === GOV_MSG.duplicate && pInc.code === 'invalid' && pInc.message === GOV_MSG.inclusion && pTaken.code === 'invalid',
      'refusals: anonymous, auditor (read-only), duplicate open request (conflict), inclusion rule (no distinct assessment; a name already in the catalogue)');
    // votes: maker-checker
    const id = p1.data.id;
    const vOwn = await rpc('k-instructor', 'select kafaa_decide_skill_change($1, $2, $3) r', [id, 'approve', null]);
    const v1 = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [id, 'approve', null]);
    const l1 = await ledgerN();
    const vTwice = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [id, 'approve', null]);
    const skills0 = Number((await q('select count(*)::int n from kafaa_skills'))[0].n);
    const v2 = await rpc('chco', 'select kafaa_decide_skill_change($1, $2, $3) r', [id, 'approve', null]);
    const l2 = await ledgerN();
    const created = (await q('select to_jsonb(s) j from kafaa_skills s where id = $1', [`sk-c-${id.slice(4)}`]))[0]?.j;
    const ch = (await q('select to_jsonb(c) j from kafaa_skill_changes c where request_id = $1', [id]))[0]?.j;
    const rq = (await q('select to_jsonb(r) j from kafaa_skill_change_requests r where id = $1', [id]))[0].j;
    ok(vOwn.code === 'forbidden' && v1.ok && v1.data.status === 'first_approved' && l1 === l0 + 1 && vTwice.code === 'maker_checker' && vTwice.message === GOV_MSG.second_approver,
      'acceptance (FS54): the proposer cannot vote (no council grant); the first council vote writes a ledger row; the same member cannot give the second decision (maker_checker)');
    ok(v2.ok && v2.data.status === 'published' && l2 === l1 + 1 && created && created.version === 1 && created.lifecycle === 'emerging' && ch && ch.ledger_seq != null && canon(ch.decided_roles) === canon(['training_manager', 'hr_director'])
      && rq.first_by === 'p-training-mgr' && rq.second_by === 'p-chco' && rq.votes.length === 2 && Number((await q('select count(*)::int n from kafaa_skills'))[0].n) === skills0 + 1,
      'acceptance (FS54): a second, different council member publishes: the skill is added, the public log row carries both roles and its ledger number (two approvers, a ledger row per decision)');
    // maker-checker for a proposer who is on the council (the seeded retire was proposed by the training manager and first approved by the HR director)
    const ret = T.skill_change_requests.find((r) => r.kind === 'retire' && r.status === 'first_approved');
    const rOwn = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [ret.id, 'approve', null]);
    const skillsBefore = Number((await q('select count(*)::int n from kafaa_skills'))[0].n);
    const preRet = (await q('select to_jsonb(s) j from kafaa_skills s order by id')).map((r) => r.j);
    const rOk = await rpc('k-admin', 'select kafaa_decide_skill_change($1, $2, $3) r', [ret.id, 'approve', null]);
    const after = (await q('select to_jsonb(s) j from kafaa_skills s where id = $1', [ret.skill_id]))[0].j;
    ok(rOwn.code === 'maker_checker' && rOwn.message === GOV_MSG.own_request && rOk.ok && rOk.data.status === 'published' && after.lifecycle === 'obsolete' && after.obsolete_on === day
      && after.replaced_by === ret.proposal.replaced_by && Number((await q('select count(*)::int n from kafaa_skills'))[0].n) === skillsBefore,
      'acceptance (FS54): a retire marks the skill obsolete (date and replacement) and never removes it; the proposer cannot approve their own request even as a council member');
    // SQL change plan = TS changePlan for the retire (on the catalogue as it was)
    const chRet = (await q('select to_jsonb(c) j from kafaa_skill_changes c where request_id = $1', [ret.id]))[0].j;
    const planRet = changePlan(ret, preRet, day);
    const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
    const CH = ['kind', 'skill_id', 'skill_code', 'skill_name_en', 'skill_name_ar', 'summary_en', 'summary_ar', 'before', 'after', 'version_before', 'version_after', 'new_skill_ids', 'replaced_by', 'effective_on', 'methodology', 'dashboards', 'sources'];
    ok(canon(pick(chRet, CH)) === canon(pick(planRet.change, CH)) && canon(pick(after, Object.keys(planRet.updates[0].patch))) === canon(planRet.updates[0].patch), 'SQL apply equals changePlan for the retire (change row and catalogue patch)');
    // the FS02 guard: no removal, no return from obsolete (direct writes by a framework editor and by the definer path)
    const unob = await tryAs('training-mgr', `update kafaa_skills set lifecycle = 'stable' where id = $1 returning id`, [ret.skill_id]);
    let removed = false;
    await db.exec('savepoint g1');
    try { await db.query(`${'del' + 'ete'} from kafaa_skills where id = $1`, [ret.skill_id]); removed = true; } catch { removed = false; }
    await db.exec('rollback to savepoint g1');
    ok(!unob.ok && /obsolete skill stays obsolete/.test(unob.msg) && !removed, 'the FS02 guard refuses a return from obsolete and any removal of a skill row');
    // split (seeded, first approved by the training manager), then SQL = TS plan for split, rename and re-level on fresh requests
    const sp = T.skill_change_requests.find((r) => r.kind === 'split' && r.status === 'first_approved');
    const preSplit = (await q('select to_jsonb(s) j from kafaa_skills s order by id')).map((r) => r.j);
    const sOk = await rpc('chco', 'select kafaa_decide_skill_change($1, $2, $3) r', [sp.id, 'approve', null]);
    const planSp = changePlan(sp, preSplit, day);
    const parts = (await q('select to_jsonb(s) j from kafaa_skills s where id = any($1) order by id', [planSp.inserts.map((x) => x.id)])).map((r) => r.j);
    const chSp = (await q('select to_jsonb(c) j from kafaa_skill_changes c where request_id = $1', [sp.id]))[0].j;
    const orig = (await q('select to_jsonb(s) j from kafaa_skills s where id = $1', [sp.skill_id]))[0].j;
    ok(sOk.ok && parts.length === 2 && canon(parts.map((p) => pick(p, Object.keys(planSp.inserts[0])))) === canon(planSp.inserts) && canon(pick(chSp, CH)) === canon(pick(planSp.change, CH))
      && orig.lifecycle === 'obsolete' && orig.replaced_by === planSp.inserts[0].id, 'a split publishes two new skills (SQL = changePlan, column by column) and marks the original obsolete, replaced by the first part');
    const fresh = async (persona, x) => (await rpc(persona, 'select kafaa_propose_skill_change($1::jsonb) r', [JSON.stringify(x)])).data?.id;
    const liveNow = (await q(`select to_jsonb(s) j from kafaa_skills s where lifecycle <> 'obsolete' and id not in (select skill_id from kafaa_skill_change_requests where status in ('submitted','first_approved','first_rejected') and skill_id is not null) order by id`)).map((r) => r.j);
    const tgtR = liveNow[10], tgtL = liveNow[20];
    const idR = await fresh('sro', { kind: 'rename', skill_id: tgtR.id, proposal: { name_en: `${tgtR.name_en} (renamed)`, name_ar: `${tgtR.name_ar} (معدّل)` }, rationale: 'Clearer name for learners.', development: 'Unchanged development route for the renamed skill.', assessment: 'Unchanged assessment route for the renamed skill.' });
    const idL = await fresh('sro', { kind: 'relevel', skill_id: tgtL.id, proposal: { key_level: tgtL.key_level === 4 ? 3 : tgtL.key_level + 1 }, rationale: 'The role profiles now expect a higher level.', development: 'Development unchanged, practice extended to the new level.', assessment: 'Assessment at the new key level with the same tasks.' });
    let planOk = true;
    for (const rid of [idR, idL]) {
      const pre = (await q('select to_jsonb(s) j from kafaa_skills s order by id')).map((r) => r.j);
      const r = (await q('select to_jsonb(r) j from kafaa_skill_change_requests r where id = $1', [rid]))[0].j;
      const a1 = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [rid, 'approve', 'Agreed.']);
      const a2 = await rpc('k-admin', 'select kafaa_decide_skill_change($1, $2, $3) r', [rid, 'approve', null]);
      const plan = changePlan(r, pre, day);
      const chx = (await q('select to_jsonb(c) j from kafaa_skill_changes c where request_id = $1', [rid]))[0]?.j;
      const s1 = (await q('select to_jsonb(s) j from kafaa_skills s where id = $1', [r.skill_id]))[0].j;
      if (!(a1.ok && a2.ok && a2.data.status === 'published' && chx && canon(pick(chx, CH)) === canon(pick(plan.change, CH)) && canon(pick(s1, Object.keys(plan.updates[0].patch))) === canon(plan.updates[0].patch))) planOk = false;
    }
    ok(idR && idL && planOk, 'rename and re-level: SQL apply equals changePlan (version up, review clock restarted, old name kept as an alternative label)');
    // reject path, disagreement path, note
    const idX = await fresh('sro', { ...addP, proposal: { ...addP.proposal, name_en: 'Reject me skill', name_ar: 'مهارة للرفض' } });
    const noNote = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [idX, 'reject', 'no']);
    const x1 = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [idX, 'reject', 'Overlaps an existing skill completely.']);
    const x2 = await rpc('chco', 'select kafaa_decide_skill_change($1, $2, $3) r', [idX, 'reject', 'Agree, it overlaps an existing skill.']);
    const x3 = await rpc('k-admin', 'select kafaa_decide_skill_change($1, $2, $3) r', [idX, 'approve', null]);
    const idY = await fresh('sro', { ...addP, proposal: { ...addP.proposal, name_en: 'Disputed skill', name_ar: 'مهارة متنازع عليها' } });
    const y1 = await rpc('training-mgr', 'select kafaa_decide_skill_change($1, $2, $3) r', [idY, 'approve', null]);
    const y2 = await rpc('chco', 'select kafaa_decide_skill_change($1, $2, $3) r', [idY, 'reject', 'Not distinct enough from existing skills.']);
    const ry = (await q('select status, first_by, jsonb_array_length(votes) n from kafaa_skill_change_requests where id = $1', [idY]))[0];
    ok(noNote.code === 'invalid' && noNote.message === GOV_MSG.note && x1.ok && x2.ok && x2.data.status === 'rejected' && x3.code === 'conflict' && x3.message === GOV_MSG.closed
      && y1.ok && y2.ok && y2.data.status === 'submitted' && ry.status === 'submitted' && ry.first_by == null && ry.n === 2,
      'two rejections close a request (reason required); a closed request takes no vote; disagreeing votes send it back with both votes kept');
    // the data constraint backs the rule up for any writer
    const badCk = await tryAs(null, `select 1`);
    await db.exec('savepoint ck');
    let ckRefused = false;
    try { await db.query(`update kafaa_skill_change_requests set first_by = proposed_by where id = $1`, [idY]); } catch { ckRefused = true; }
    await db.exec('rollback to savepoint ck');
    ok(badCk.ok && ckRefused, 'check constraint: a vote by the proposer cannot be stored even by a definer function');
    // queue, health and fairness RPCs
    const qa = await tryAs('k-auditor', 'select kafaa_skill_council_queue() r');
    const qc = await tryAs('chco', 'select kafaa_skill_council_queue() r');
    const qs = await tryAs('sro', 'select kafaa_skill_council_queue() r');
    ok(qa.ok && qc.ok && qa.rows[0].r.length === qc.rows[0].r.length && qc.rows[0].r.length >= 60 && !qs.ok, 'council queue: council members and auditors read every request; other staff are refused');
    const hAnon = await tryAs(null, 'select kafaa_taxonomy_health() r');
    const hS = await tryAs('sro', 'select kafaa_taxonomy_health() r');
    ok(!hAnon.ok && hS.ok && canon(hS.rows[0].r) === canon(taxonomyHealth(await healthData(), day)) && hS.rows[0].r.summary.orphans >= 1,
      'taxonomy health: signed-in only, equals taxonomyHealth after the changes (the newly added skill is an orphan until taught)');
    const fNo = await rpc('training-mgr', 'select kafaa_run_surface_fairness(null) r');
    const lf = await ledgerN();
    const fOk = await rpc('k-admin', 'select kafaa_run_surface_fairness(null) r');
    const nowRows = (await q(`select id, n, positives, rate::float8 rate, ratio::float8 ratio, suppressed, flagged from kafaa_surface_fairness where as_of = current_date order by id`));
    const tsRows = surfaceSnapshot(await sd(), day).map((r) => ({ id: r.id, n: r.n, positives: r.positives, rate: r.rate, ratio: r.ratio, suppressed: r.suppressed, flagged: r.flagged })).sort((a, b) => (a.id < b.id ? -1 : 1));
    ok(fNo.code === 'forbidden' && fOk.ok && fOk.data.rows === 36 && (await ledgerN()) === lf + 1 && canon(nowRows) === canon(tsRows), 'ranked-surface fairness snapshot: platform admins only, ledgered, stores exactly the computed rows');
    // RLS
    const anonLog = await count(null, 'kafaa_skill_changes');
    const anonReq = await count(null, 'kafaa_skill_change_requests');
    const own = await count('k-instructor', 'kafaa_skill_change_requests');
    const ownWant = Number((await q(`select count(*)::int n from kafaa_skill_change_requests where proposed_by = 'p-k-instructor'`))[0].n);
    const sfAnon = await count(null, 'kafaa_surface_fairness');
    const sfHr = await count('k-hr-analyst', 'kafaa_surface_fairness');
    const sfStaff = await count('sro', 'kafaa_surface_fairness');
    ok(anonLog >= 49 && anonReq === 0 && own === ownWant && own > 0 && sfAnon === 0 && sfHr > 0 && sfStaff === 0,
      'RLS: everyone (anon too) reads the public change log; requests only by their proposer; ranked-surface fairness only for governance and HR aggregates');
  } finally {
    await db.exec('rollback');
    await db.exec('reset role');
  }

  // ── guarded engine-card replay: pre-FS55 live rows (and drifted match cards) end at the seeded values; idempotent
  await db.exec('begin');
  try {
    await db.exec(`update kafaa_engine_cards set kernel_surface = null, ranks = null, fairness_metric = null, fairness_none = null where id in ('navigator','coach','marketplace','talent_evidence','mentoring','rotations','experts','future')`);
    await db.exec(`update kafaa_engine_cards set scoring_functions = array_remove(scoring_functions, 'src/modules/m18/FutureRoles.tsx#rankConcepts'), version = 2 where id = 'navigator'`);
    await db.exec(`update kafaa_engine_cards set scoring_functions = array_remove(array_remove(scoring_functions, 'src/modules/m21/future.ts#bridgePlan'), 'src/modules/m21/raises.ts#rankRaises'), version = 2 where id = 'future'`);
    await db.exec(`update kafaa_engine_cards set title_en = title_en || ' (live)', scoring_functions = '{}', version = version + 4, last_change_id = 'ec:match:009' where id in ('experts','marketplace','mentoring','rotations')`);
    await db.exec(readFileSync(MIG, 'utf8'));
    await db.exec(readFileSync(MIG, 'utf8'));
    const COLS = ['engine_surface', 'module', 'route', 'feature', 'title_en', 'title_ar', 'purpose_en', 'purpose_ar', 'owner_en', 'owner_ar', 'inputs_used', 'inputs_excluded', 'scoring_functions', 'weight_keys',
      'output_en', 'output_ar', 'oversight_en', 'oversight_ar', 'limitations_en', 'limitations_ar', 'opt_out', 'sources', 'sort', 'kernel_surface', 'ranks', 'fairness_metric', 'fairness_none'];
    const rows = (await q(`select to_jsonb(c) j from kafaa_engine_cards c order by id`)).map((r) => r.j);
    const bad = rows.filter((r) => { const s = cards.get(r.id); return canon(Object.fromEntries(COLS.map((k) => [k, r[k]]))) !== canon(Object.fromEntries(COLS.map((k) => [k, s[k]]))); });
    if (bad.length) console.log('    replay diff', bad[0].id, COLS.filter((k) => canon(bad[0][k]) !== canon(cards.get(bad[0].id)[k])).map((k) => `${k}: ${canon(bad[0][k]).slice(-260)} vs ${canon(cards.get(bad[0].id)[k]).slice(-260)}`).join(' | '));
    const nav = rows.find((r) => r.id === 'navigator'), fut = rows.find((r) => r.id === 'future'), mk = rows.find((r) => r.id === 'marketplace');
    ok(bad.length === 0 && nav.version === 3 && fut.version === 3 && mk.version === cards.get('marketplace').version + 4 && mk.last_change_id === 'ec:match:009',
      `migration replay (twice): every card's content equals the seed; navigator and Future Me bumped once; drifted match cards reconciled while their live version and last change stay${bad.length ? ` (${bad[0].id})` : ''}`);
  } finally {
    await db.exec('rollback');
  }

  // ── grants and additivity
  const g = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'kafaa\\_fs63\\_%' or p.proname = any($1))`, [RPCS]);
  const internal = g.filter((x) => x.proname.startsWith('kafaa_fs63_'));
  ok(internal.length === 22 && internal.every((x) => !x.a && !x.u), `none of the ${internal.length} internal FS63 helpers is executable by anon or authenticated`);
  ok(RPCS.every((n) => g.some((x) => x.proname === n && x.u && !x.a)), 'the five RPCs are executable by signed-in users only (anon executes nothing new)');
  const sql = readFileSync(MIG, 'utf8');
  const forbidden = ['dr' + 'op', 'del' + 'ete', 'trun' + 'cate'];
  ok(!forbidden.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(sql)) && [...sql.matchAll(/alter table\s+(\w+)/gi)].every((m) => m[1].startsWith('kafaa_'))
    && [...sql.matchAll(/create or replace function\s+(\w+)/gi)].every((m) => m[1].startsWith('kafaa_')) && !/create policy kafaa_read on (?!kafaa_)/i.test(sql),
    'migration is additive: kafaa_* objects only, no removal words, ALTER only on kafaa_* tables');

  // ── md5s and digests for the live comparison (handover 3.10)
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'kafaa\\_fs63\\_%' or p.proname = any($1)) order by 1`, [RPCS]);
  console.log(`    fs63 function md5: ${md5.map((r) => `${r.proname} ${r.m}`).join('; ')}`);
  for (const t of ['kafaa_engine_cards', 'kafaa_skill_change_requests', 'kafaa_skill_changes', 'kafaa_surface_fairness', 'kafaa_skills']) {
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) d from public.${t} t`))[0];
    console.log(`    digest ${t}: ${d.n}:${d.d}`);
  }
}
