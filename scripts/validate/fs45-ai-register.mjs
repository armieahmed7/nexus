// [FS wave D · E5 · FS36 + FS37] PGlite checks for 20261010245001_kafaa_fs45_ai_register_drills.sql (AI-literacy register, sandbox drills).
// Seed sanity (register entries and drills pass the RPC checks, documents synthetic, seeded attempts replay with scoreDrill, evidence
// <= L2, "fully implemented" carried by coverage); SQL = TS parity on the shared database: kafaa_air_people = aiRung per staff member,
// kafaa_air_coverage = coverage(), kafaa_air_raw_pct = rawSystemPct() (generated group sets), kafaa_air_problem = systemProblem(),
// kafaa_dr_norm_flags / kafaa_dr_score = normFlags / scoreDrill (every seeded attempt + 400 generated submissions),
// kafaa_dr_sub_problem = submissionProblem(), kafaa_dr_problem = drillProblem(), kafaa_dr_stats_core = drillStats(); RLS (register for
// staff when published, drafts for admin/auditors, keys for training staff only, own attempts only); RPC flows and RBAC; suppression;
// grants; additivity.
import { readFileSync } from 'node:fs';
import { aiRung } from '../../src/modules/m29/fluency.ts';
import { coverage, rawSystemPct, systemProblem } from '../../src/modules/m29/register.ts';
import { ERROR_KINDS, drillProblem, drillStats, normFlags, scoreDrill, submissionProblem } from '../../src/modules/m29/drills.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010245001_kafaa_fs45_ai_register_drills.sql';

export default async function fs45Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave D · E5 · FS36 AI-literacy register + FS37 governed AI sandbox drills');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const staffIds = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id);
  const cellsT = T.ai_rungs.map((c) => ({ id: c.id, rung: c.rung, dimension: c.dimension }));
  const lit = T.ai_skill_tracks.filter((t) => t.track === 'literacy').map((t) => t.skill_id);
  const keyOf = (id) => { const k = T.ai_drill_keys.find((x) => x.drill_id === id); return { errors: k.errors, protocol: k.protocol, pass_pct: k.pass_pct }; };

  // ── seed sanity
  ok(T.ai_systems.length === 8 && T.ai_systems.filter((s) => s.status === 'published').length === 6 && T.ai_systems.every((s) => T.ai_system_users.some((g) => g.system_id === s.id)),
    'seed: 8 register entries (6 published, 1 draft, 1 retired), each with user groups');
  const sysInput = (s) => ({ ...s, groups: T.ai_system_users.filter((g) => g.system_id === s.id) });
  ok(T.ai_systems.every((s) => systemProblem(sysInput(s), { families: T.job_families.map((f) => f.id), cells: cellsT, staff: staffIds }) === null), 'seed: every register entry passes the register check (no compliance or certification wording)');
  ok(T.ai_systems.some((s) => s.ai_role === 'provider') && T.ai_systems.some((s) => s.ai_role === 'deployer') && new Set(T.ai_systems.map((s) => s.maturity)).size === 3
    && T.ai_system_users.some((g) => g.side === 'provider'), 'seed: provider and deployer systems, provider-side and deployer-side groups, all three maturity labels');
  ok(T.ai_drills.length === 7 && T.ai_drills.every((d) => d.synthetic === true && /^SYN-[A-Z]{2}-\d{3}$/.test(d.doc.code) && /SYNTHETIC/.test(d.doc.title_en) && /اصطناعي/.test(d.doc.title_ar)),
    'acceptance (FS37): all 7 drill documents are synthetic and marked as such (SYN- code, SYNTHETIC in both languages)');
  ok(T.ai_drills.every((d) => drillProblem({ ...d, key: keyOf(d.id) }, lit) === null) && T.ai_drills.every((d) => !('errors' in d) && !JSON.stringify(d.protocol).includes('"correct":') && !JSON.stringify(d.protocol).includes('"critical":')),
    'seed: every drill passes the drill check; the drill rows carry no key (errors and answers live in ai_drill_keys)');
  const dev = T.skill_evidence.filter((e) => e.ref_table === 'ai_drill_attempts');
  ok(dev.length > 0 && dev.every((e) => e.kind === 'assessment' && e.level >= 1 && e.level <= 2), `acceptance (FS37): ${dev.length} drill evidence rows, kind assessment, never above level 2`);
  const rep = T.ai_drill_attempts.filter((a) => { const d = T.ai_drills.find((x) => x.id === a.drill_id); const s = scoreDrill(keyOf(a.drill_id), a.flags, a.answers, d.level); return s.pct === a.pct && s.passed === a.passed && s.level === a.level && canon(s.feedback) === canon(a.feedback); });
  ok(rep.length === T.ai_drill_attempts.length, `seed: all ${T.ai_drill_attempts.length} seeded attempts replay exactly with scoreDrill`);

  // ── parity on the shared database (current rows)
  const people = (await q('select kafaa_air_people() j'))[0].j;
  const states = await q('select id, person_id, skill_id, level, basis, active, reasons from kafaa_person_skills where active');
  const by = new Map(); for (const s of states) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const rungs = await q('select id, rung, dimension, skill_ids, min_level from kafaa_ai_rungs');
  const tracks = await q('select skill_id, track from kafaa_ai_skill_tracks');
  const ppl = await q(`select id, job_family_id from kafaa_people where kind = 'staff' and status = 'active' order by id collate "C"`);
  const tsPeople = ppl.map((p) => { const r = aiRung(p.id, rungs, tracks, by.get(p.id) ?? []); return { person_id: p.id, family_id: p.job_family_id ?? null, rung: r.rung, met: r.cells.filter((c) => c.met).map((c) => c.id) }; });
  ok(canon(people) === canon(tsPeople), `SQL kafaa_air_people equals aiRung() for all ${tsPeople.length} active staff`);
  const sysRows = await q('select id, status, maturity, owner_person_id, sort, listed from kafaa_ai_systems');
  const grpRows = await q('select id, system_id, family_ids, all_staff, side, required_rung, required_cells, active, sort from kafaa_ai_system_users');
  const cellRows = rungs.map((c) => ({ id: c.id, rung: c.rung, dimension: c.dimension }));
  const subsets = [sysRows.map((s) => s.id), sysRows.filter((s) => s.listed).map((s) => s.id), ['ais-dalil'], ['ais-chem-triage', 'ais-drafting'], []];
  const diffC = [];
  for (const ids of subsets) {
    const s = (await q('select kafaa_air_coverage($1::text[], kafaa_air_people()) j', [ids]))[0].j;
    const t = coverage(sysRows.filter((x) => ids.includes(x.id)), grpRows, tsPeople, cellRows, 10, 80);
    if (canon(s) !== canon(t)) diffC.push(ids.join('+') || 'none');
  }
  ok(diffC.length === 0, `acceptance (FS36): SQL kafaa_air_coverage equals coverage() from FS09 rungs on ${subsets.length} system sets${diffC.length ? ` (${diffC[0]})` : ''}`);
  const full = coverage(sysRows, grpRows, tsPeople, cellRows, 10, 80);
  ok(full.systems.every((s) => s.groups.every((g) => g.n === null || g.n >= 10) && (s.n === null || s.n >= 10) && s.groups.every((g) => g.gaps.every((x) => x.n === null || x.n >= 10)))
    && full.systems.find((s) => s.system_id === 'ais-dalil').groups.some((g) => g.n === null && g.pct === null && g.gaps.length === 0),
    'acceptance (FS36): every group under 10 is suppressed (n, covered, pct and gaps), e.g. the Dalil builders');
  let seed = 41;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const fams = T.job_families.map((f) => f.id);
  const diffR = [];
  for (let g = 0; g < 60; g++) {
    const gs = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({ family_ids: fams.filter(() => rand() < 0.3), all_staff: rand() < 0.2, required_rung: 1 + Math.floor(rand() * 3),
      required_cells: cellRows.filter((c) => c.rung === 3 && rand() < 0.3).map((c) => c.id), active: rand() < 0.9 }));
    const s = Number((await q('select kafaa_air_raw_pct($1::jsonb, kafaa_air_people()) v', [JSON.stringify(gs)]))[0].v);
    if (s !== rawSystemPct(gs, tsPeople)) diffR.push(g);
  }
  ok(diffR.length === 0, `SQL kafaa_air_raw_pct equals rawSystemPct() on 60 generated group sets${diffR.length ? ` (${diffR[0]})` : ''}`);
  const base = sysInput(T.ai_systems.find((s) => s.id === 'ais-pdm-advisor'));
  const sysCases = [base, { ...base, name_ar: ' ' }, { ...base, ai_role: 'vendor' }, { ...base, use_class: 'x' }, { ...base, maturity: 'done' }, { ...base, status: 'live' }, { ...base, simulated: 'yes' },
    { ...base, owner_person_id: 'p-nobody' }, { ...base, owner_person_id: 'p-alnoor-gm' }, { ...base, oversight_en: '' }, { ...base, measures: [] }, { ...base, measures: [{ kind: 'video', title_en: 'a', title_ar: 'ب' }] },
    { ...base, status: 'draft', measures: [] }, { ...base, groups: [] }, { ...base, groups: [{ ...base.groups[0], side: 'both' }] }, { ...base, groups: [{ ...base.groups[0], required_rung: 5 }] },
    { ...base, groups: [{ ...base.groups[0], required_rung: 1.5 }] }, { ...base, groups: [{ ...base.groups[0], family_ids: ['nope'] }] }, { ...base, groups: [{ ...base.groups[0], family_ids: [], all_staff: false }] },
    { ...base, groups: [{ ...base.groups[0], required_cells: ['air:2:ethics'] }] }, { ...base, groups: [{ ...base.groups[0], required_cells: ['air:9:x'] }] },
    { ...base, purpose_en: 'This tool is certified for plant use.' }, { ...base, oversight_ar: 'النظام ممتثل للقانون' }, { ...base, groups: [{ ...base.groups[0], rationale_en: 'It complies with Article 4.' }] },
    null, { ...base, measures: 'none' }];
  const diffP = [];
  for (const c of sysCases) { const s = (await q('select kafaa_air_problem($1::jsonb) p', [c === null ? null : JSON.stringify(c)]))[0].p; const t = c === null ? 'name' : systemProblem(c, { families: fams, cells: cellRows, staff: staffIds }); if ((s ?? null) !== t) diffP.push(`${JSON.stringify(c)?.slice(0, 40)} ${s} vs ${t}`); }
  ok(diffP.length === 0, `SQL kafaa_air_problem equals systemProblem() on ${sysCases.length} valid and malformed entries${diffP.length ? ` (${diffP[0]})` : ''}`);

  const diffS = [];
  for (const a of T.ai_drill_attempts) {
    const d = T.ai_drills.find((x) => x.id === a.drill_id);
    const s = (await q('select kafaa_dr_score($1::jsonb, $2::jsonb, $3::jsonb, $4) j', [JSON.stringify(keyOf(a.drill_id)), JSON.stringify(a.flags), JSON.stringify(a.answers), d.level]))[0].j;
    if (canon(s) !== canon(scoreDrill(keyOf(a.drill_id), a.flags, a.answers, d.level))) diffS.push(a.id);
  }
  ok(diffS.length === 0, `acceptance (FS37): SQL kafaa_dr_score equals scoreDrill() for all ${T.ai_drill_attempts.length} seeded attempts${diffS.length ? ` (${diffS[0]})` : ''}`);
  const diffG = [];
  let maxLevel = 0;
  for (let g = 0; g < 400; g++) {
    const d = T.ai_drills[Math.floor(rand() * T.ai_drills.length)];
    const k = keyOf(d.id);
    const flags = [];
    for (const sg of d.output.segments) if (rand() < 0.5) flags.push({ segment_id: sg.id, kind: rand() < 0.1 ? 7 : ERROR_KINDS[Math.floor(rand() * ERROR_KINDS.length)] });
    if (rand() < 0.2 && flags.length) flags.push({ ...flags[0], kind: 'invented' });
    if (rand() < 0.1) flags.push({ segment_id: 'zz', kind: 'invented' }, null, 5);
    const ek = new Map(k.errors.map((e) => [e.segment_id, e.kind]));
    if (rand() < 0.3) for (const f of flags) if (f && ek.has(f.segment_id)) f.kind = ek.get(f.segment_id);
    const answers = d.protocol.filter(() => rand() < 0.95).map((p) => { const ks = k.protocol.find((x) => x.id === p.id); return { id: p.id, choice: rand() < 0.6 ? ks.correct : rand() < 0.1 ? 1.5 : Math.floor(rand() * p.options.length) }; });
    if (rand() < 0.1) answers.push({ id: 'p-use', choice: 0 });
    const lvl = rand() < 0.1 ? 3 : d.level;
    const s = (await q('select kafaa_dr_score($1::jsonb, $2::jsonb, $3::jsonb, $4) j', [JSON.stringify(k), JSON.stringify(flags), JSON.stringify(answers), lvl]))[0].j;
    const t = scoreDrill(k, flags, answers, lvl);
    if (canon(s) !== canon(t)) diffG.push(`${g} ${d.id}`);
    const nf = (await q('select kafaa_dr_norm_flags($1::jsonb) j', [JSON.stringify(flags)]))[0].j;
    if (canon(nf) !== canon(normFlags(flags))) diffG.push(`${g} norm`);
    const sp = (await q('select kafaa_dr_sub_problem($1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb) p', [JSON.stringify(d.output), JSON.stringify(d.protocol), JSON.stringify(flags), JSON.stringify(answers)]))[0].p;
    if ((sp ?? null) !== submissionProblem(d, flags, answers)) diffG.push(`${g} sub ${sp} vs ${submissionProblem(d, flags, answers)}`);
    maxLevel = Math.max(maxLevel, t.level);
  }
  ok(diffG.length === 0 && maxLevel <= 2, `400 generated submissions: SQL normalisation, scoring and submission checks equal TS; level never above 2 (max ${maxLevel})${diffG.length ? ` (${diffG[0]})` : ''}`);
  const dd = { ...T.ai_drills[1], key: keyOf(T.ai_drills[1].id) };
  const drillCases = [dd, { ...dd, title_ar: '' }, { ...dd, difficulty: 4 }, { ...dd, level: 3 }, { ...dd, level: 0 }, { ...dd, skill_id: 'sk-fs-ai-dataeng' }, { ...dd, status: 'open' }, { ...dd, est_minutes: 60 },
    { ...dd, doc: { ...dd.doc, code: 'OP-114' } }, { ...dd, doc: { ...dd.doc, code: 'syn-op-114' } }, { ...dd, doc: { ...dd.doc, steps: dd.doc.steps.slice(0, 2) } }, { ...dd, doc: { ...dd.doc, steps: dd.doc.steps.map((x, i) => ({ ...x, n: i })) } },
    { ...dd, output: { ...dd.output, segments: [...dd.output.segments, dd.output.segments[0]] } }, { ...dd, output: { ...dd.output, tool_ar: '' } }, { ...dd, protocol: dd.protocol.slice(0, 2) },
    { ...dd, protocol: dd.protocol.map((p, i) => (i ? p : { ...p, options: [p.options[0]] })) }, { ...dd, key: { ...dd.key, errors: dd.key.errors.slice(0, 1) } },
    { ...dd, key: { ...dd.key, errors: [...dd.key.errors.slice(1), { ...dd.key.errors[0], segment_id: 'zz' }] } }, { ...dd, key: { ...dd.key, errors: dd.key.errors.map((e) => ({ ...e, kind: 'typo' })) } },
    { ...dd, key: { ...dd.key, protocol: dd.key.protocol.map((x) => ({ ...x, critical: false })) } }, { ...dd, key: { ...dd.key, protocol: dd.key.protocol.map((x) => ({ ...x, correct: 9 })) } },
    { ...dd, key: { ...dd.key, pass_pct: 99 } }, { ...dd, scenario_en: 'Walk to the vital area and check the alarm station.' }, { ...dd, key: undefined }, null];
  const diffD = [];
  for (const c of drillCases) { const s = (await q('select kafaa_dr_problem($1::jsonb, $2::text[]) p', [c === null ? null : JSON.stringify(c), lit]))[0].p; const t = c === null ? 'texts' : drillProblem(c, lit); if ((s ?? null) !== t) diffD.push(`case ${drillCases.indexOf(c)}: ${s} vs ${t}`); }
  ok(diffD.length === 0, `SQL kafaa_dr_problem equals drillProblem() on ${drillCases.length} valid and malformed drills (synthetic documents only, level <= 2, no plant security)${diffD.length ? ` (${diffD[0]})` : ''}`);
  const att = await q('select id, person_id, drill_id, passed, pct, feedback, submitted_at from kafaa_ai_drill_attempts');
  const sStats = (await q('select kafaa_dr_stats_core() j'))[0].j;
  const tStats = drillStats(att.map((a) => ({ ...a, submitted_at: new Date(a.submitted_at).toISOString() })), (await q(`select id from kafaa_ai_drills where status <> 'retired'`)).map((r) => r.id), 10);
  ok(canon(sStats) === canon(tStats), `SQL kafaa_dr_stats_core equals drillStats() (${tStats.attempts} attempts)`);
  ok(tStats.drills.every((d) => d.people === null || d.people >= 10) && tStats.missed_kinds.every((k) => k.planted === null || k.planted >= 10), 'drill statistics: every cell names 10 people or more, or is suppressed');

  // ── RLS
  let n = 4501;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  await addProfile('buyer', 'Buyer');
  await addProfile('outage-manager', 'Outage Manager');
  await addProfile('qc-inspector', 'QC Inspector');
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  ok(await cnt(null, 'select count(*)::int n from kafaa_ai_systems') === 0 && await cnt(null, 'select count(*)::int n from kafaa_ai_drills') === 0 && await cnt(null, 'select count(*)::int n from kafaa_ai_drill_attempts') === 0,
    'RLS: anonymous visitors read no register entries, drills or attempts');
  ok(await cnt('buyer', 'select count(*)::int n from kafaa_ai_systems') === 6 && await cnt('buyer', `select count(*)::int n from kafaa_ai_system_users where not listed`) === 0,
    'RLS: staff read the 6 published register entries and their groups, never drafts or retired entries');
  ok(await cnt('k-auditor', 'select count(*)::int n from kafaa_ai_systems') === 8 && await cnt('ai-governance', 'select count(*)::int n from kafaa_ai_systems') === 8, 'RLS: auditors and AI governance (admin) read drafts and retired entries too');
  ok(await cnt('buyer', 'select count(*)::int n from kafaa_ai_drills') === 6 && await cnt('buyer', 'select count(*)::int n from kafaa_ai_drill_keys') === 0
    && await cnt('training-mgr', 'select count(*)::int n from kafaa_ai_drill_keys') === 7 && await cnt('training-mgr', 'select count(*)::int n from kafaa_ai_drills') === 7,
    'RLS: staff read published drills but never the keys; the training manager reads all drills and keys');
  const mineQc = T.ai_drill_attempts.filter((a) => a.person_id === 'p-qc-inspector').length;
  ok(mineQc > 0 && await cnt('qc-inspector', 'select count(*)::int n from kafaa_ai_drill_attempts') === mineQc && await cnt('chco', 'select count(*)::int n from kafaa_ai_drill_attempts') === 0,
    `RLS: people read only their own drill attempts (${mineQc}); HR reads none`);

  // ── RPC flows: coverage
  ok((await one('buyer', 'select kafaa_ai_literacy_coverage() v')).v === null, 'aiLiteracyCoverage: staff without Agg, A or audit rights (and owning no system) get nothing');
  const ch = (await one('chco', 'select kafaa_ai_literacy_coverage() v')).v;
  const au = (await one('k-auditor', 'select kafaa_ai_literacy_coverage() v')).v;
  const om = (await one('outage-manager', 'select kafaa_ai_literacy_coverage() v')).v;
  ok(ch?.scope === 'all' && ch.systems.length === 6 && au?.scope === 'all' && au.systems.length === 7, `aiLiteracyCoverage: HR sees the 6 published systems, auditors 7 (draft included, retired left out); overall ${ch?.overall?.pct}%`);
  ok(om?.scope === 'owner' && om.systems.length === 1 && om.systems[0].system_id === 'ais-outage-optimiser', 'aiLiteracyCoverage: a system owner sees only their own published system');
  let anonDenied = false; try { await one(null, 'select kafaa_ai_literacy_coverage() v'); } catch { anonDenied = true; }
  ok(anonDenied, 'aiLiteracyCoverage: anonymous visitors cannot execute it');

  // ── RPC flows: register writes
  const newSys = { name_en: 'Test assistant', name_ar: 'مساعد اختبار', purpose_en: 'A test entry.', purpose_ar: 'إدخال اختبار.', ai_role: 'deployer', use_class: 'information', maturity: 'planned', simulated: true,
    owner_person_id: 'p-ai-governance', oversight_en: 'People check every output.', oversight_ar: 'يتحقق الأشخاص من كل مخرج.', measures: [{ kind: 'ladder', title_en: 'Ladder', title_ar: 'السلّم' }],
    groups: [{ label_en: 'All staff', label_ar: 'جميع الموظفين', family_ids: [], all_staff: true, side: 'deployer', required_rung: 1, required_cells: [] }, { label_en: 'Ops', label_ar: 'التشغيل', family_ids: ['operations'], all_staff: false, side: 'deployer', required_rung: 2, required_cells: [] }], status: 'draft' };
  ok((await one('buyer', 'select kafaa_save_ai_system($1::jsonb) r', [JSON.stringify(newSys)])).r.code === 'forbidden'
    && (await one('training-mgr', 'select kafaa_save_ai_system($1::jsonb) r', [JSON.stringify(newSys)])).r.code === 'forbidden', 'RBAC: staff and the training manager cannot write the register (ai_literacy A only)');
  const add = (await one('ai-governance', 'select kafaa_save_ai_system($1::jsonb) r', [JSON.stringify(newSys)])).r;
  ok(add.ok && add.data.version === 1 && await cnt('ai-governance', `select count(*)::int n from kafaa_ai_system_users where system_id = '${add.data.id}'`) === 2, 'saveAiSystem: AI governance adds a draft entry with its two user groups');
  const led0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const ed = (await one('ai-governance', 'select kafaa_save_ai_system($1::jsonb) r', [JSON.stringify({ ...newSys, id: add.data.id, status: 'published', groups: [{ ...newSys.groups[0], id: `${add.data.id}-g1` }] })])).r;
  const led1 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const gr = await q('select id, active, listed from kafaa_ai_system_users where system_id = $1 order by id', [add.data.id]);
  ok(ed.ok && ed.data.version === 2 && gr.length === 2 && gr.filter((g) => g.active).length === 1 && gr.filter((g) => !g.active).every((g) => !g.listed) && led1 === led0 + 1,
    'saveAiSystem: an edit versions the entry, a removed group is deactivated (never deleted) and publishing writes the NEXUS ledger');
  const claim = (await one('ai-governance', 'select kafaa_save_ai_system($1::jsonb) r', [JSON.stringify({ ...newSys, purpose_en: 'Certified compliant with Article 4.' })])).r;
  ok(claim.code === 'invalid' && /does not certify/.test(claim.message), 'saveAiSystem: compliance or certification wording is refused (Kafa\'a is not a regulator)');
  const mn = sysInput(T.ai_systems.find((s) => s.id === 'ais-meeting-notes'));
  const fullLow = (await one('ai-governance', 'select kafaa_save_ai_system($1::jsonb) r', [JSON.stringify({ ...mn, owner_person_id: mn.owner_person_id, maturity: 'full' })])).r;
  ok(fullLow.code === 'invalid' && /80%/.test(fullLow.message), 'saveAiSystem: "fully implemented" is refused while coverage is under 80% (labels follow the computed coverage)');

  // ── RPC flows: drills
  const dl = T.ai_drills.find((d) => d.id === 'ad-valve-lineup');
  const kl = keyOf(dl.id);
  const perfect = (d, k) => ({ drill_id: d.id, flags: k.errors.map((e) => ({ segment_id: e.segment_id, kind: e.kind })), answers: k.protocol.map((x) => ({ id: x.id, choice: x.correct })) });
  const s1 = (await one('buyer', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify(perfect(dl, kl))])).r;
  ok(s1.ok && s1.data.passed && s1.data.level === 1 && s1.data.pct === 100, `submitDrill: a perfect level-1 drill passes at level 1 (${s1.data?.pct}%)`);
  const d2 = T.ai_drills.find((d) => d.id === 'ad-shift-turnover');
  const s2 = (await one('buyer', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify(perfect(d2, keyOf(d2.id)))])).r;
  ok(s2.ok && s2.data.level === 2, 'submitDrill: a perfect level-2 drill passes at level 2 (the cap)');
  const ev = await q(`select level, active, ref_id from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'ai_drill_attempts'`);
  ok(ev.length === 2 && ev.every((e) => e.level <= 2 && e.active), 'acceptance (FS37): the passes wrote assessment evidence, none above level 2');
  const fail = (await one('buyer', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify({ drill_id: dl.id, flags: [], answers: kl.protocol.map((x) => ({ id: x.id, choice: (x.correct + 1) % 3 })) })])).r;
  const ev2 = await q(`select active from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'ai_drill_attempts' and ref_id = $1`, [s1.data.attempt_id]);
  ok(fail.ok && !fail.data.passed && !fail.data.critical_ok && fail.data.evidence.length === 0 && ev2[0].active === false, 'submitDrill: a failed retake (critical protocol step wrong) writes no evidence and replaces the earlier pass on that drill');
  await q(`select kafaa_skills_apply('p-buyer', current_date)`);
  ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'ai_drill_attempts' and active`))[0].n) === 1, 'F01 recompute keeps drill evidence (recorded, not derived)');
  const own = await one('buyer', `select feedback from kafaa_ai_drill_attempts where id = $1`, [s1.data.attempt_id]);
  ok(own && own.feedback.errors.length === kl.errors.length, 'after submitting, the taker reads their own feedback with the explanations');
  const bad = (await one('buyer', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify({ ...perfect(dl, kl), flags: [{ segment_id: 'zz', kind: 'invented' }] })])).r;
  const miss = (await one('buyer', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify({ ...perfect(dl, kl), answers: [] })])).r;
  const draft = (await one('buyer', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify({ drill_id: 'ad-outage-scope', flags: [], answers: [] })])).r;
  const partner = (await one('alnoor-gm', 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify(perfect(dl, kl))])).r;
  let anonD = false; try { await one(null, 'select kafaa_submit_drill($1::jsonb) r', [JSON.stringify(perfect(dl, kl))]); } catch { anonD = true; }
  ok(bad.code === 'invalid' && miss.code === 'invalid' && draft.code === 'invalid' && partner.code === 'forbidden' && anonD, 'submitDrill refuses unknown segments, unanswered protocol steps, draft drills and partners; anonymous visitors cannot execute it');
  ok((await one('buyer', 'select kafaa_drill_stats() v')).v === null && (await one('training-mgr', 'select kafaa_drill_stats() v')).v?.attempts > 0 && (await one('chco', 'select kafaa_drill_stats() v')).v !== null,
    'drillStats: training manager and HR (Agg) only');
  const nd = { ...dd, id: undefined, status: 'draft' };
  ok((await one('buyer', 'select kafaa_save_drill($1::jsonb) r', [JSON.stringify(nd)])).r.code === 'forbidden' && (await one('ai-governance', 'select kafaa_save_drill($1::jsonb) r', [JSON.stringify(nd)])).r.code === 'forbidden',
    'RBAC: staff and admins without the item bank cannot author drills');
  const sd = (await one('training-mgr', 'select kafaa_save_drill($1::jsonb) r', [JSON.stringify(nd)])).r;
  const sd2 = (await one('training-mgr', 'select kafaa_save_drill($1::jsonb) r', [JSON.stringify({ ...nd, id: sd.data?.id, title_en: 'Edited' })])).r;
  ok(sd.ok && sd.data.version === 1 && sd2.ok && sd2.data.version === 2 && await cnt('training-mgr', `select count(*)::int n from kafaa_ai_drill_keys where drill_id = '${sd.data.id}'`) === 1, 'saveDrill: the training manager adds and versions a drill with its key');
  const ns = (await one('training-mgr', 'select kafaa_save_drill($1::jsonb) r', [JSON.stringify({ ...nd, doc: { ...nd.doc, code: 'OP-114' } })])).r;
  const l3 = (await one('training-mgr', 'select kafaa_save_drill($1::jsonb) r', [JSON.stringify({ ...nd, level: 3 })])).r;
  ok(ns.code === 'invalid' && /synthetic/.test(ns.message) && l3.code === 'invalid' && /1 or 2/.test(l3.message), 'saveDrill: non-synthetic documents and evidence levels above 2 are refused');

  // ── grants and additivity
  let helperDenied = 0;
  for (const sql of ['select kafaa_dr_score(\'{}\'::jsonb, \'[]\'::jsonb, \'[]\'::jsonb, 1)', 'select kafaa_air_people()', 'select kafaa_air_coverage(\'{}\'::text[], \'[]\'::jsonb)', 'select kafaa_dr_stats_core()']) {
    try { await one('buyer', sql); } catch { helperDenied++; }
  }
  ok(helperDenied === 4, 'grants: internal helpers are not executable by signed-in users');
  const text = readFileSync(MIG, 'utf8');
  ok(!/\bdrop\s+(table|policy|function|column|index|trigger|view)\b/i.test(text) && !/\bdelete\s+from\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\btruncate\b/i.test(text),
    'additive: the FS45 migration drops nothing, deletes nothing and alters only kafaa_* tables');
}
