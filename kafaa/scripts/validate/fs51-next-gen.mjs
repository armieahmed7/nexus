// [FS wave E · E1 · FS38 + FS39 + FS40] PGlite checks for 20261010251001_kafaa_fs51_next_gen.sql (M31 Next-Gen Nuclear Readiness).
// Seed sanity (every current role has three or more published deltas, each with two or more https sources and clean text; visits and
// drills pass the RPC checks; evidence only for confirmed visits and passed drills, never above level 2); SQL = TS parity on the shared
// database: kafaa_smr_needs / kafaa_smr_readiness / kafaa_smr_matrix_core = needsFor / readinessOf / matrixStats, kafaa_smr_problem =
// deltaProblem, kafaa_pv_problem / kafaa_pv_hosts / kafaa_pv_level = visitProblem / eligibleHosts / visitLevel, kafaa_tw_score =
// scoreTwinDrill (every seeded attempt + 400 generated submissions), kafaa_tw_sub_problem / kafaa_tw_problem / kafaa_tw_stats_core =
// twinSubProblem / twinProblem / twinStats; RLS; RPC flows and RBAC (maker-checker host confirmation, evidence rules, drafts, partners);
// suppression; grants; additivity. Test profile uids from 5151.
import { readFileSync } from 'node:fs';
import { publicTextIsClean } from '../../src/domain/future.ts';
import { deltaProblem, matrixStats, needsFor, readinessOf } from '../../src/modules/m31/nextgen.ts';
import { VISIT_SKILL, eligibleHosts, visitLevel, visitProblem } from '../../src/modules/m31/literacy.ts';
import { TWIN_SKILLS, scoreTwinDrill, twinProblem, twinStats, twinSubProblem } from '../../src/modules/m31/twin.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql';
const RESEARCH = readFileSync('../docs/kafaa/ref/research/nuclear_energy.md', 'utf8');

export default async function fs51Checks({ db, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const today = S.meta.demo_today;
  console.log('FS wave E · E1 · FS38 SMR delta overlay + FS39 plant literacy log + FS40 digital-twin drills');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const current = T.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
  const pub = T.smr_deltas.filter((d) => d.status === 'published');
  const skillsCtx = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  const refs = { microcred: T.microcred_defs.filter((m) => m.status === 'current').map((m) => m.code), course: T.courses.map((c) => c.id), pathway: T.pathways.filter((p) => p.status === 'published').map((p) => p.id), lane: T.horizon_lanes.map((l) => l.id) };
  const famOf = (rid) => T.job_roles.find((r) => r.id === rid)?.family_id ?? null;

  // ── FS38 seed and acceptance
  ok(current.length === 28 && current.every((r) => pub.filter((d) => d.role_id === r.id).length >= 3) && pub.every((d) => current.some((r) => r.id === d.role_id)),
    `acceptance (FS38): all 28 current roles have a published delta for at least their 3 most relevant technology families (${pub.length} published; concept roles never)`);
  ok(T.smr_deltas.every((d) => d.sources.length >= 2 && d.sources.every((s) => /^https:\/\//.test(s.url) && s.as_of && RESEARCH.includes(s.url))),
    'acceptance (FS38): every delta cites at least two https sources with as-of dates, all from the research packs');
  ok(T.smr_deltas.every((d) => publicTextIsClean([d.changes_en, d.changes_ar, d.stays_en, d.stays_ar, ...d.dims.flatMap((x) => [x.text_en, x.text_ar])]) && /no deployment decision implied/.test(d.changes_en)),
    'acceptance (FS38): publicTextIsClean passes on every delta and each says "no deployment decision implied"');
  ok(T.smr_deltas.every((d) => deltaProblem(d, { family: famOf(d.role_id), skills: skillsCtx, refs }) === null), 'seed: every delta passes the edit check (deltaProblem)');
  ok(T.smr_deltas.filter((d) => ['security', 'safeguards', 'cyber'].includes(famOf(d.role_id))).every((d) => d.path_only && d.skills.length === 0), 'seed: security, safeguards and cyber roles stay path-only (no skills)');
  ok(new Set(T.smr_deltas.map((d) => d.tech_id)).size === 6, 'seed: deltas span all six ADVANCE technology families');

  // ── FS38 parity
  const delRows = await q('select * from kafaa_smr_deltas order by id collate "C"');
  const profRows = await q(`select role_id, version, requirements from kafaa_role_profile_versions where horizon = '2035' and status = 'published'`);
  const profiles = new Map();
  for (const r of [...profRows].sort((a, b) => a.version - b.version)) profiles.set(r.role_id, r.requirements);
  const diffN = [];
  for (const d of delRows) {
    const s = (await q('select kafaa_smr_needs($1::jsonb, kafaa_smr_profile($2)) j', [JSON.stringify(d), d.role_id]))[0].j;
    if (canon(s) !== canon(needsFor(d, profiles.get(d.role_id)))) diffN.push(d.id);
  }
  ok(diffN.length === 0, `SQL kafaa_smr_needs equals needsFor() for all ${delRows.length} deltas with their FS05 2035 profiles${diffN.length ? ` (${diffN[0]})` : ''}`);
  const states = await q('select person_id, skill_id, level, active from kafaa_person_skills where active');
  const by = new Map();
  for (const s of states) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const staff = await q(`select id, job_role_id, job_family_id, kind, status from kafaa_people where kind = 'staff' and status = 'active' and job_role_id is not null`);
  const diffR = [];
  let pairs = 0;
  for (const p of staff) for (const d of delRows.filter((x) => x.role_id === p.job_role_id)) {
    pairs++;
    const needs = needsFor(d, profiles.get(d.role_id));
    const s = (await q('select kafaa_smr_readiness($1::jsonb, $2) j', [JSON.stringify(needs), p.id]))[0].j;
    const t = readinessOf(needs, by.get(p.id) ?? []);
    if (s.pct !== t.pct || s.met !== t.met || s.total !== t.total) diffR.push(`${p.id}/${d.id}`);
  }
  ok(diffR.length === 0 && pairs > 50, `SQL kafaa_smr_readiness equals readinessOf() for ${pairs} staff x delta pairs${diffR.length ? ` (${diffR[0]})` : ''}`);
  const techIds = (await q('select id from kafaa_adv_technologies')).map((r) => r.id);
  const sM = (await q('select kafaa_smr_matrix_core() j'))[0].j;
  const tM = matrixStats(delRows, staff, by, profiles, techIds, 10);
  ok(canon(sM) === canon(tM), `SQL kafaa_smr_matrix_core equals matrixStats() (${tM.techs.filter((x) => x.n !== null).length} technologies shown, ${tM.families.filter((x) => x.n === null).length} family cells suppressed)`);
  ok(tM.techs.every((x) => x.n === null || x.n >= 10) && tM.families.every((x) => x.n === null || x.n >= 10), 'FS38 HR view: every cell names 10 people or more, or is suppressed');
  const base = { ...T.smr_deltas.find((d) => d.id === 'smrd:reactor-operator:tech-bwr') };
  const po = { ...T.smr_deltas.find((d) => d.id === 'smrd:security-officer:tech-bwr') };
  const cases = [
    [base, 'operations'], [{ ...base, rank: 0 }, 'operations'], [{ ...base, rank: 2.5 }, 'operations'], [{ ...base, status: 'live' }, 'operations'], [{ ...base, path_only: true }, 'operations'],
    [{ ...base, dims: [] }, 'operations'], [{ ...base, dims: [{ ...base.dims[0], change: 'same' }] }, 'operations'], [{ ...base, dims: [base.dims[0], base.dims[0]] }, 'operations'],
    [{ ...base, dims: [{ ...base.dims[0], text_ar: '' }] }, 'operations'], [{ ...base, dims: 'x' }, 'operations'], [{ ...base, stays_ar: ' ' }, 'operations'],
    [{ ...base, skills: [{ skill_id: 'sk-nope', level: 1 }] }, 'operations'], [{ ...base, skills: [{ skill_id: 'sk-fs-adv-smr', level: 4 }] }, 'operations'],
    [{ ...base, skills: [{ skill_id: 'sk-fs-dp-paperwp', level: 1 }] }, 'operations'], [{ ...base, skills: [{ skill_id: 'sk-sa-01', level: 1 }] }, 'operations'],
    [{ ...base, skills: [{ skill_id: 'sk-fs-adv-smr', level: 1 }, { skill_id: 'sk-fs-adv-smr', level: 2 }] }, 'operations'],
    [{ ...base, training: [{ kind: 'course', ref: 'c-nope' }] }, 'operations'], [{ ...base, training: [{ kind: 'video', ref: 'c-fs-smr' }] }, 'operations'],
    [{ ...base, training: [{ kind: 'microcred', ref: 'MC-H2-HEAT' }] }, 'operations'], [{ ...base, training: [base.training[0], base.training[0]] }, 'operations'],
    [{ ...base, sources: [base.sources[0]] }, 'operations'], [{ ...base, sources: [base.sources[0]], status: 'draft' }, 'operations'], [{ ...base, sources: [{ label: 'x', url: 'http://x.org' }, base.sources[1]] }, 'operations'],
    [{ ...base, changes_en: 'This fleet will be deployed in 2031.' }, 'operations'], [{ ...base, stays_en: 'We need 40 operators.' }, 'operations'], [{ ...base, changes_ar: 'سيتم بناء الوحدات قريباً' }, 'operations'],
    [po, 'security'], [{ ...po, skills: [{ skill_id: 'sk-fs-adv-smr', level: 1 }] }, 'security'], [{ ...po, path_only: false }, 'security'], [{ ...base }, 'cyber'], [null, 'operations'],
  ];
  const diffP = [];
  for (const [c, fam] of cases) {
    const s = (await q('select kafaa_smr_problem($1::jsonb, $2) p', [c === null ? null : JSON.stringify(c), fam]))[0].p;
    const t = c === null ? 'rank' : deltaProblem(c, { family: fam, skills: skillsCtx, refs });
    if ((s ?? null) !== t) diffP.push(`case ${cases.findIndex((x) => x[0] === c)}: ${s} vs ${t}`);
  }
  ok(diffP.length === 0, `SQL kafaa_smr_problem equals deltaProblem() on ${cases.length} valid and malformed edits (path-only rule, catalogue, links, sources, clean text)${diffP.length ? ` (${diffP[0]})` : ''}`);

  // ── FS39 seed, acceptance and parity
  const pvEv = T.skill_evidence.filter((e) => e.ref_table === 'plant_visits');
  const conf = T.plant_visits.filter((v) => v.status === 'confirmed');
  ok(conf.length > 0 && pvEv.length === conf.length && conf.every((v) => pvEv.some((e) => e.ref_id === v.id && e.kind === 'ojt' && e.basis === 'validated' && e.skill_id === VISIT_SKILL))
    && T.plant_visits.filter((v) => v.status !== 'confirmed').every((v) => !pvEv.some((e) => e.ref_id === v.id) && v.evidence.length === 0),
    `acceptance (FS39): ${conf.length} confirmed visits wrote evidence (ojt, validated); the ${T.plant_visits.length - conf.length} logged, declined or withdrawn ones wrote none`);
  ok(pvEv.every((e) => e.level >= 1 && e.level <= 2) && T.plant_visits.every((v) => v.host_person_id !== v.person_id), 'FS39: visit evidence stays at level 1-2 and no visit is hosted by its visitor');
  const hostsT = eligibleHosts(T.people, T.role_assignments, null);
  const diffH = [];
  for (const v of [null, 'p-buyer', 'p-k-instructor', 'p-training-mgr', 'p-sro']) {
    const s = (await q('select kafaa_pv_hosts($1) h', [v]))[0].h;
    if (canon(s) !== canon(eligibleHosts(T.people, T.role_assignments, v))) diffH.push(String(v));
  }
  ok(diffH.length === 0 && hostsT.length >= 10, `SQL kafaa_pv_hosts equals eligibleHosts() (${hostsT.length} eligible hosts; the visitor never listed)${diffH.length ? ` (${diffH[0]})` : ''}`);
  const vb = { kind: 'simulator_observation', host_person_id: 'p-k-instructor', visit_on: '2026-09-01', hours: 3, note: 'Observed a crew scenario.' };
  const vcases = [vb, { ...vb, kind: 'tour' }, { ...vb, kind: 1 }, { ...vb, host_person_id: ' ' }, { ...vb, host_person_id: null }, { ...vb, visit_on: '2026-02-30' }, { ...vb, visit_on: '2026-9-1' },
    { ...vb, visit_on: '2026-10-09' }, { ...vb, visit_on: '2025-10-07' }, { ...vb, visit_on: '2025-10-08' }, { ...vb, hours: 0 }, { ...vb, hours: 12.5 }, { ...vb, hours: 0.75 }, { ...vb, hours: '3' },
    { ...vb, hours: 0.5 }, { ...vb, hours: 12 }, { ...vb, note: 'x'.repeat(301) }, { ...vb, note: 'Call me on +971 50 123 4567' }, { ...vb, note: 'mail a.b@enec.example' }, { ...vb, note: null }, { ...vb, note: 5 }, null];
  const diffV = [];
  for (const c of vcases) {
    const s = (await q('select kafaa_pv_problem($1::jsonb, $2::date) p', [c === null ? null : JSON.stringify(c), today]))[0].p;
    const t = c === null ? 'kind' : visitProblem(c, today);
    if ((s ?? null) !== t) diffV.push(`case ${vcases.indexOf(c)}: ${s} vs ${t}`);
  }
  ok(diffV.length === 0, `SQL kafaa_pv_problem equals visitProblem() on ${vcases.length} valid and malformed visits${diffV.length ? ` (${diffV[0]})` : ''}`);
  const confRows = await q(`select id, person_id, kind, hours::float8 as hours from kafaa_plant_visits where status = 'confirmed'`);
  const diffL = [];
  let lc = 0;
  for (const pid of [...new Set(confRows.map((r) => r.person_id)), 'p-k-ro']) for (const kind of ['reference_plant', 'simulator_observation', 'partner_facility']) for (const h of [1, 4.5, 12]) {
    lc++;
    const s = Number((await q('select kafaa_pv_level($1, $2, $3, $4) l', [pid, 'zz', kind, h]))[0].l);
    const t = visitLevel(confRows.filter((r) => r.person_id === pid).map((r) => ({ id: r.id, kind: r.kind, hours: r.hours })), { kind, hours: h });
    if (s !== t) diffL.push(`${pid} ${kind} ${h}`);
  }
  ok(diffL.length === 0, `SQL kafaa_pv_level equals visitLevel() on ${lc} people x kind x hours cases${diffL.length ? ` (${diffL[0]})` : ''}`);

  // ── FS40 seed, acceptance and parity
  const keyOf = (id) => { const k = T.twin_keys.find((x) => x.scenario_id === id); return { ...k }; };
  ok(T.twin_scenarios.every((s) => s.synthetic === true && /^SYN-TW-\d{3}$/.test(s.code) && /SIMULATED/.test(s.system_en) && /محاكاة/.test(s.system_ar)),
    `acceptance (FS40): all ${T.twin_scenarios.length} trend sets are synthetic and labelled SIMULATED (SYN-TW codes, EN and AR)`);
  ok(T.twin_scenarios.every((s) => twinProblem({ ...s, key: keyOf(s.id) }, TWIN_SKILLS) === null) && T.twin_scenarios.every((s) => !JSON.stringify(s).includes('"component_id"') && !('key' in s)),
    'seed: every drill passes the drill check; scenario rows carry no key (it lives in twin_keys)');
  const twEv = T.skill_evidence.filter((e) => e.ref_table === 'twin_attempts');
  ok(twEv.length > 0 && twEv.every((e) => e.kind === 'assessment' && e.level >= 1 && e.level <= 2 && TWIN_SKILLS.includes(e.skill_id)), `acceptance (FS40): ${twEv.length} drill evidence rows for twin and plant-data skills, kind assessment, never above level 2`);
  const rep = T.twin_attempts.filter((a) => { const s = scoreTwinDrill(keyOf(a.scenario_id), a, T.twin_scenarios.find((x) => x.id === a.scenario_id).level); return s.pct === a.pct && s.passed === a.passed && s.level === a.level && canon(s.feedback) === canon(a.feedback); });
  ok(rep.length === T.twin_attempts.length, `seed: all ${T.twin_attempts.length} seeded attempts replay exactly with scoreTwinDrill`);
  const keyRows = new Map((await q('select * from kafaa_twin_keys')).map((k) => [k.scenario_id, k]));
  const scRows = await q('select * from kafaa_twin_scenarios');
  const kj = (k) => ({ component_id: k.component_id, mode_id: k.mode_id, useful_checks: k.useful_checks, unsafe_checks: k.unsafe_checks, conservative_actions: k.conservative_actions, best_action: k.best_action, unsafe_actions: k.unsafe_actions, sound_rationales: k.sound_rationales, pass_pct: k.pass_pct });
  const diffS = [];
  for (const a of T.twin_attempts) {
    const sc = scRows.find((x) => x.id === a.scenario_id);
    const k = kj(keyRows.get(a.scenario_id));
    const s = (await q('select kafaa_tw_score($1::jsonb, $2::jsonb, $3) j', [JSON.stringify(k), JSON.stringify(a), sc.level]))[0].j;
    if (canon(s) !== canon(scoreTwinDrill(k, a, sc.level))) diffS.push(a.id);
  }
  ok(diffS.length === 0, `acceptance (FS40): SQL kafaa_tw_score equals scoreTwinDrill() for all ${T.twin_attempts.length} seeded attempts${diffS.length ? ` (${diffS[0]})` : ''}`);
  let seed = 51;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const diffG = [];
  let maxLevel = 0;
  for (let g = 0; g < 400; g++) {
    const sc = pick(scRows);
    const k = kj(keyRows.get(sc.id));
    const ids = (xs) => xs.map((x) => x.id);
    const checks = ids(sc.checks).filter(() => rand() < 0.45);
    if (rand() < 0.1) checks.push(checks[0] ?? 'zz', 7);
    const sub = { checks, component_id: rand() < 0.08 ? 3 : pick(ids(sc.components)), mode_id: rand() < 0.05 ? null : pick(ids(sc.modes)), action_id: pick(ids(sc.actions)),
      rationale_ids: ids(sc.rationales).filter(() => rand() < 0.5) };
    if (rand() < 0.3) { sub.component_id = k.component_id; sub.mode_id = k.mode_id; sub.action_id = k.best_action; sub.checks = [...k.useful_checks]; }
    if (rand() < 0.05) sub.rationale_ids = 'r1';
    const lvl = rand() < 0.1 ? 3 : sc.level;
    const s = (await q('select kafaa_tw_score($1::jsonb, $2::jsonb, $3) j', [JSON.stringify(k), JSON.stringify(sub), lvl]))[0].j;
    const t = scoreTwinDrill(k, sub, lvl);
    if (canon(s) !== canon(t)) diffG.push(`${g} ${sc.id}`);
    const sp = (await q('select kafaa_tw_sub_problem($1::jsonb, $2::jsonb) p', [JSON.stringify({ components: sc.components, modes: sc.modes, checks: sc.checks, actions: sc.actions, rationales: sc.rationales, max_checks: sc.max_checks }), JSON.stringify(sub)]))[0].p;
    const tp = twinSubProblem(sc, sub);
    if ((sp ?? null) !== tp) diffG.push(`${g} sub ${sp} vs ${tp}`);
    maxLevel = Math.max(maxLevel, t.level);
  }
  ok(diffG.length === 0 && maxLevel <= 2, `400 generated submissions: SQL scoring and submission checks equal TS; level never above 2 (max ${maxLevel})${diffG.length ? ` (${diffG[0]})` : ''}`);
  const dd = { ...T.twin_scenarios.find((s) => s.id === 'tw-hx-fouling'), key: keyOf('tw-hx-fouling') };
  const se = dd.series;
  const tcases = [dd, { ...dd, title_ar: '' }, { ...dd, code: 'TW-102' }, { ...dd, code: 'syn-tw-102' }, { ...dd, difficulty: 4 }, { ...dd, level: 3 }, { ...dd, skill_ids: [] }, { ...dd, skill_ids: ['sk-da-01-twins'] },
    { ...dd, skill_ids: ['sk-fs-ai-twin', 'sk-fs-ai-twin'] }, { ...dd, status: 'open' }, { ...dd, est_minutes: 2 }, { ...dd, series: { ...se, t: se.t.slice(0, 4) } },
    { ...dd, series: { ...se, signals: se.signals.slice(0, 1) } }, { ...dd, series: { ...se, signals: [{ ...se.signals[0], values: se.signals[0].values.slice(1) }, se.signals[1]] } },
    { ...dd, series: { ...se, signals: [{ ...se.signals[0], band: [5, 5] }, se.signals[1]] } }, { ...dd, series: { ...se, signals: [{ ...se.signals[0], band: ['a', 5] }, se.signals[1]] } },
    { ...dd, series: { ...se, signals: [se.signals[0], se.signals[0]] } }, { ...dd, series: 'none' }, { ...dd, components: dd.components.slice(0, 2) }, { ...dd, modes: [{ ...dd.modes[0], ar: '' }, dd.modes[1]] },
    { ...dd, checks: dd.checks.map((c, i) => (i ? c : { ...c, minutes: 0 })) }, { ...dd, max_checks: 9 }, { ...dd, actions: [...dd.actions, dd.actions[0]] }, { ...dd, rationales: 'x' },
    { ...dd, key: { ...dd.key, component_id: 'zz' } }, { ...dd, key: { ...dd.key, useful_checks: [] } }, { ...dd, key: { ...dd.key, useful_checks: ['valvepos', 'retune'] } },
    { ...dd, key: { ...dd.key, best_action: 'leave' } }, { ...dd, key: { ...dd.key, conservative_actions: ['clean', 'bypass'] } }, { ...dd, key: { ...dd.key, sound_rationales: 'r1' } },
    { ...dd, key: { ...dd.key, useful_checks: 'valvepos' } }, { ...dd, key: { ...dd.key, pass_pct: 40 } }, { ...dd, key: undefined }, { ...dd, scenario_en: 'Check the alarm station behind the vital area.' }, null];
  const diffT = [];
  for (const c of tcases) {
    const s = (await q('select kafaa_tw_problem($1::jsonb, $2::text[]) p', [c === null ? null : JSON.stringify(c), TWIN_SKILLS]))[0].p;
    const t = c === null ? 'texts' : twinProblem(c, TWIN_SKILLS);
    if ((s ?? null) !== t) diffT.push(`case ${tcases.indexOf(c)}: ${s} vs ${t}`);
  }
  ok(diffT.length === 0, `SQL kafaa_tw_problem equals twinProblem() on ${tcases.length} valid and malformed drills (synthetic codes, level <= 2, no plant security)${diffT.length ? ` (${diffT[0]})` : ''}`);
  const att = await q('select id, person_id, scenario_id, passed, pct, component_id, submitted_at from kafaa_twin_attempts');
  const sSt = (await q('select kafaa_tw_stats_core() j'))[0].j;
  const tSt = twinStats(att.map((a) => ({ ...a, submitted_at: new Date(a.submitted_at).toISOString() })), [...keyRows.values()].map((k) => ({ scenario_id: k.scenario_id, component_id: k.component_id })),
    scRows.filter((s) => s.status !== 'retired').map((s) => s.id), 10);
  ok(canon(sSt) === canon(tSt), `SQL kafaa_tw_stats_core equals twinStats() (${tSt.attempts} attempts)`);
  ok(tSt.scenarios.every((x) => x.people === null || x.people >= 10) && tSt.scenarios.some((x) => x.people !== null), 'drill statistics: shown cells name 10 people or more, small ones suppressed');

  // ── RLS
  let n = 5150;
  const addProfile = async (persona, role) => {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; return; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  for (const [p, r] of [['buyer', 'Buyer'], ['qc-inspector', 'QC Inspector'], ['nse', 'NSE'], ['sme-reviewer', 'SME Reviewer']]) await addProfile(p, r);
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  ok(await cnt(null, 'select count(*)::int n from kafaa_smr_deltas') === pub.length && await cnt(null, `select count(*)::int n from kafaa_smr_deltas where status <> 'published'`) === 0,
    `RLS: the public reads the ${pub.length} published deltas (public summary) and never a draft`);
  ok(await cnt('buyer', 'select count(*)::int n from kafaa_smr_deltas') === pub.length && await cnt('k-auditor', 'select count(*)::int n from kafaa_smr_deltas') === T.smr_deltas.length
    && await cnt('training-mgr', 'select count(*)::int n from kafaa_smr_deltas') === T.smr_deltas.length, 'RLS: staff read published deltas; auditors and the training manager read drafts too');
  const qcV = T.plant_visits.filter((v) => v.person_id === 'p-qc-inspector').length;
  const kiV = T.plant_visits.filter((v) => v.host_person_id === 'p-k-instructor' || v.person_id === 'p-k-instructor').length;
  ok(await cnt(null, 'select count(*)::int n from kafaa_plant_visits') === 0 && await cnt('qc-inspector', 'select count(*)::int n from kafaa_plant_visits') === qcV
    && await cnt('k-instructor', 'select count(*)::int n from kafaa_plant_visits') === kiV && await cnt('chco', 'select count(*)::int n from kafaa_plant_visits') === T.plant_visits.filter((v) => v.person_id === 'p-chco' || v.host_person_id === 'p-chco').length,
    `RLS: visits are read only by the visitor (${qcV}) and the named host (${kiV} for the instructor); anonymous visitors and HR read none of the others`);
  ok(await cnt(null, 'select count(*)::int n from kafaa_twin_scenarios') === 0 && await cnt('buyer', 'select count(*)::int n from kafaa_twin_scenarios') === 4 && await cnt('buyer', 'select count(*)::int n from kafaa_twin_keys') === 0
    && await cnt('training-mgr', 'select count(*)::int n from kafaa_twin_keys') === 5 && await cnt('k-instructor', 'select count(*)::int n from kafaa_twin_scenarios') === 5,
    'RLS: staff read the 4 published drills but never a key; instructors and the training manager read all drills, the training manager the keys');
  const qcA = T.twin_attempts.filter((a) => a.person_id === 'p-qc-inspector').length;
  ok(qcA > 0 && await cnt('qc-inspector', 'select count(*)::int n from kafaa_twin_attempts') === qcA && await cnt('chco', 'select count(*)::int n from kafaa_twin_attempts') === 0, `RLS: people read only their own drill attempts (${qcA}); HR reads none`);

  // ── RPC flows: FS38
  ok((await one('buyer', 'select kafaa_next_gen_matrix() v')).v === null && (await one('chco', 'select kafaa_next_gen_matrix() v')).v?.techs?.length === 6 && (await one('k-admin', 'select kafaa_next_gen_matrix() v')).v !== null,
    'nextGenMatrix: HR and admins (workforce_strategy) only; staff get nothing');
  const edit = { ...T.smr_deltas.find((d) => d.id === 'smrd:quality-assurance-qc:tech-micro') };
  ok((await one('buyer', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify(edit)])).r.code === 'forbidden' && (await one('chco', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify(edit)])).r.code === 'forbidden',
    'RBAC: staff and HR cannot edit deltas (frameworks W/A only)');
  const led0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const sv = (await one('training-mgr', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify({ ...edit, stays_en: 'NQA-1 discipline stays the same.' })])).r;
  const led1 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  ok(sv.ok && sv.data.version === 2 && led1 === led0 + 1 && (await q(`select stays_en from kafaa_smr_deltas where id = 'smrd:quality-assurance-qc:tech-micro'`))[0].stays_en === 'NQA-1 discipline stays the same.',
    'saveSmrDelta: the training manager publishes an edit (version + 1) and the NEXUS ledger records it');
  const nd = (await one('k-instructor', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify({ ...edit, tech_id: 'tech-fast', rank: 4, status: 'draft' })])).r;
  ok(nd.ok && nd.data.version === 1 && await cnt('buyer', `select count(*)::int n from kafaa_smr_deltas where id = 'smrd:quality-assurance-qc:tech-fast'`) === 0, 'saveSmrDelta: an instructor adds a draft delta that staff cannot read');
  const unclean = (await one('training-mgr', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify({ ...edit, changes_en: 'Construction will start in 2030 with 40 engineers.' })])).r;
  const concept = (await one('training-mgr', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify({ ...edit, role_id: 'fr-bwr-operator' })])).r;
  const secu = (await one('training-mgr', 'select kafaa_save_smr_delta($1::jsonb) r', [JSON.stringify({ ...T.smr_deltas.find((d) => d.id === 'smrd:security-officer:tech-bwr'), skills: [{ skill_id: 'sk-fs-adv-smr', level: 1 }] })])).r;
  ok(unclean.code === 'invalid' && /deployment/.test(unclean.message) && concept.code === 'not_found' && secu.code === 'invalid' && /path only/.test(secu.message),
    'saveSmrDelta refuses headcount or deployment claims, concept roles and skills on security roles');

  // ── RPC flows: FS39
  const hostsB = (await one('buyer', 'select kafaa_plant_hosts() h')).h;
  ok(Array.isArray(hostsB) && hostsB.length === eligibleHosts(T.people, T.role_assignments, 'p-buyer').length && hostsB.every((h) => h.person_id !== 'p-buyer' && h.name_en), 'plantHosts: the eligible hosts with names, never me');
  const lv = (x) => one('buyer', 'select kafaa_log_visit($1::jsonb) r', [JSON.stringify(x)]);
  const okv = (await lv({ kind: 'partner_facility', host_person_id: 'p-k-instructor', visit_on: '2026-09-15', hours: 8, note: 'Partner reference plant visit.' })).r;
  const selfh = (await one('k-instructor', 'select kafaa_log_visit($1::jsonb) r', [JSON.stringify({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: '2026-09-15', hours: 2 })])).r;
  const badh = (await lv({ kind: 'reference_plant', host_person_id: 'p-nse', visit_on: '2026-09-15', hours: 2 })).r;
  const badd = (await lv({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: '2099-01-01', hours: 2 })).r;
  const partner = (await one('alnoor-gm', 'select kafaa_log_visit($1::jsonb) r', [JSON.stringify({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: '2026-09-15', hours: 2 })])).r;
  ok(okv.ok && okv.data.status === 'logged' && selfh.code === 'maker_checker' && badh.code === 'invalid' && badd.code === 'invalid' && partner.code === 'forbidden',
    'logVisit: logged for the host; self-hosting refused (maker-checker), ineligible hosts and future dates refused, partners forbidden');
  ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_id = $1`, [okv.data.id]))[0].n) === 0, 'acceptance (FS39): an unconfirmed visit writes no evidence');
  const own = (await one('buyer', 'select kafaa_confirm_visit($1::jsonb) r', [JSON.stringify({ visit_id: okv.data.id, decision: 'confirm' })])).r;
  const other = (await one('training-mgr', 'select kafaa_confirm_visit($1::jsonb) r', [JSON.stringify({ visit_id: okv.data.id, decision: 'confirm' })])).r;
  const led2 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const cf = (await one('k-instructor', 'select kafaa_confirm_visit($1::jsonb) r', [JSON.stringify({ visit_id: okv.data.id, decision: 'confirm' })])).r;
  const led3 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const evB = await q(`select kind, basis, level, active from kafaa_skill_evidence where ref_table = 'plant_visits' and ref_id = $1`, [okv.data.id]);
  const prior = T.plant_visits.filter((v) => v.person_id === 'p-buyer' && v.status === 'confirmed');
  const expL = visitLevel(prior.map((v) => ({ id: v.id, kind: v.kind, hours: v.hours })), { kind: 'partner_facility', hours: 8 });
  ok(own.code === 'maker_checker' && other.code === 'forbidden' && cf.ok && cf.data.level === expL && evB.length === 1 && evB[0].kind === 'ojt' && evB[0].basis === 'validated' && evB[0].level === expL && led3 === led2 + 1,
    `acceptance (FS39): only the named host confirms (the visitor and others refused); the confirmation writes ojt evidence (validated, level ${expL}) and a ledger row`);
  await q(`select kafaa_skills_apply('p-buyer', current_date)`);
  ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'plant_visits' and ref_id = $1 and active`, [okv.data.id]))[0].n) === 1
    && (await q(`select level from kafaa_person_skills where id = 'ps:p-buyer:sk-fs-tr-techlit' and active`)).length === 1, 'F01 recompute keeps visit evidence (recorded) and the state exists');
  const again = (await one('k-instructor', 'select kafaa_confirm_visit($1::jsonb) r', [JSON.stringify({ visit_id: okv.data.id, decision: 'decline', reason: 'Already decided' })])).r;
  const v2 = (await lv({ kind: 'reference_plant', host_person_id: 'p-training-mgr', visit_on: '2026-09-20', hours: 2 })).r;
  const nor = (await one('training-mgr', 'select kafaa_confirm_visit($1::jsonb) r', [JSON.stringify({ visit_id: v2.data.id, decision: 'decline', reason: 'no' })])).r;
  const dec = (await one('training-mgr', 'select kafaa_confirm_visit($1::jsonb) r', [JSON.stringify({ visit_id: v2.data.id, decision: 'decline', reason: 'I did not host this visit.' })])).r;
  const v3 = (await lv({ kind: 'reference_plant', host_person_id: 'p-training-mgr', visit_on: '2026-09-21', hours: 2 })).r;
  const wd = (await one('buyer', 'select kafaa_withdraw_visit($1) r', [v3.data.id])).r;
  const wd2 = (await one('training-mgr', 'select kafaa_withdraw_visit($1) r', [v2.data.id])).r;
  ok(again.code === 'invalid' && nor.code === 'invalid' && dec.ok && dec.data.status === 'declined' && wd.ok && wd2.code === 'forbidden'
    && Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_id in ($1, $2)`, [v2.data.id, v3.data.id]))[0].n) === 0,
    'confirmVisit/withdrawVisit: decided visits stay decided, a decline needs a reason, declined and withdrawn visits write no evidence, only the visitor withdraws');
  ok(Number((await q(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-pv-${okv.data.id}-host`]))[0].n) === 1 && Number((await q(`select count(*)::int n from kafaa_notifications where id = $1`, [`nt-pv-${okv.data.id}-confirmed`]))[0].n) === 1,
    'notifications: the host is asked to confirm and the visitor hears the outcome');

  // ── RPC flows: FS40
  const sc1 = scRows.find((s) => s.id === 'tw-sensor-drift');
  const k1 = kj(keyRows.get(sc1.id));
  const perfect = { scenario_id: sc1.id, checks: k1.useful_checks, component_id: k1.component_id, mode_id: k1.mode_id, action_id: k1.best_action, rationale_ids: k1.sound_rationales };
  const s1 = (await one('buyer', 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify(perfect)])).r;
  ok(s1.ok && s1.data.passed && s1.data.level === 2 && s1.data.pct === 100 && s1.data.evidence.length === sc1.skill_ids.length && s1.data.explain?.component, 'submitTwinDrill: a perfect level-2 drill passes at level 2 (the cap) with evidence for each skill it names and the explanations');
  const ev = await q(`select skill_id, level, active from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'twin_attempts'`);
  ok(ev.length === sc1.skill_ids.length && ev.every((e) => e.level <= 2 && e.active && sc1.skill_ids.includes(e.skill_id)), 'acceptance (FS40): the pass wrote assessment evidence for the twin and plant-data skills it names, none above level 2');
  const unsafe = (await one('buyer', 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify({ ...perfect, checks: ['compare', 'retune'] })])).r;
  const ev2 = await q(`select active from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'twin_attempts' and ref_id = $1`, [s1.data.attempt_id]);
  ok(unsafe.ok && !unsafe.data.passed && !unsafe.data.critical_ok && unsafe.data.evidence.length === 0 && ev2.every((e) => e.active === false), 'submitTwinDrill: an unsafe check fails the retake whatever the score, writes no evidence and replaces the earlier pass');
  await q(`select kafaa_skills_apply('p-buyer', current_date)`);
  const s2 = (await one('buyer', 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify(perfect)])).r;
  await q(`select kafaa_skills_apply('p-buyer', current_date)`);
  ok(s2.ok && Number((await q(`select count(*)::int n from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'twin_attempts' and active`))[0].n) === sc1.skill_ids.length, 'F01 recompute keeps drill evidence (recorded, not derived)');
  const bad = (await one('buyer', 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify({ ...perfect, checks: ['compare', 'calib', 'mass', 'replaceb'] })])).r;
  const draft = (await one('buyer', 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify({ scenario_id: 'tw-fan-degradation', checks: [], component_id: 'fanmotor', mode_id: 'bearing', action_id: 'swap', rationale_ids: ['r1'] })])).r;
  const prt = (await one('alnoor-gm', 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify(perfect)])).r;
  let anonD = false; try { await one(null, 'select kafaa_submit_twin_drill($1::jsonb) r', [JSON.stringify(perfect)]); } catch { anonD = true; }
  ok(bad.code === 'invalid' && /number of checks/.test(bad.message) && draft.code === 'invalid' && prt.code === 'forbidden' && anonD, 'submitTwinDrill refuses more checks than the budget, draft drills and partners; anonymous visitors cannot execute it');
  ok((await one('buyer', 'select kafaa_twin_stats() v')).v === null && (await one('training-mgr', 'select kafaa_twin_stats() v')).v?.attempts > 0 && (await one('chco', 'select kafaa_twin_stats() v')).v !== null, 'twinStats: training staff and HR (Agg) only');
  const nt = { ...dd, id: undefined, code: 'SYN-TW-199', status: 'draft' };
  ok((await one('buyer', 'select kafaa_save_twin_scenario($1::jsonb) r', [JSON.stringify(nt)])).r.code === 'forbidden' && (await one('k-instructor', 'select kafaa_save_twin_scenario($1::jsonb) r', [JSON.stringify(nt)])).r.code === 'forbidden',
    'RBAC: staff and instructors cannot author drills (secure_items A = training manager)');
  const sd = (await one('training-mgr', 'select kafaa_save_twin_scenario($1::jsonb) r', [JSON.stringify(nt)])).r;
  const sd2 = (await one('training-mgr', 'select kafaa_save_twin_scenario($1::jsonb) r', [JSON.stringify({ ...nt, id: sd.data?.id, title_en: 'Edited' })])).r;
  const dup = (await one('training-mgr', 'select kafaa_save_twin_scenario($1::jsonb) r', [JSON.stringify({ ...nt, code: 'SYN-TW-101' })])).r;
  const real = (await one('training-mgr', 'select kafaa_save_twin_scenario($1::jsonb) r', [JSON.stringify({ ...nt, code: 'PLANT-01' })])).r;
  ok(sd.ok && sd.data.version === 1 && sd2.ok && sd2.data.version === 2 && dup.code === 'conflict' && real.code === 'invalid' && /synthetic/.test(real.message)
    && Number((await q(`select count(*)::int n from kafaa_twin_keys where scenario_id = $1`, [sd.data.id]))[0].n) === 1, 'saveTwinScenario: the training manager adds and versions a synthetic drill with its key; reused or non-synthetic codes are refused');

  // ── grants and additivity
  let helperDenied = 0;
  for (const sql of ['select kafaa_tw_score(\'{}\'::jsonb, \'{}\'::jsonb, 1)', 'select kafaa_smr_matrix_core()', 'select kafaa_pv_hosts(null)', 'select kafaa_tw_stats_core()', 'select kafaa_smr_problem(\'{}\'::jsonb, null)']) {
    try { await one('buyer', sql); } catch { helperDenied++; }
  }
  ok(helperDenied === 5, 'grants: internal helpers are not executable by signed-in users');
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text), 'additive: the FS51 migration never names a destructive statement and alters only kafaa_* tables');
}
