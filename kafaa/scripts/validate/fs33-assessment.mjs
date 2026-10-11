// [FS wave C · E3 · FS21 + FS22] PGlite checks for 20261010233001_kafaa_fs33_assessment.sql (adaptive future-skills assessment, performance
// tasks, integrity reports). Seed sanity (banks, items, tasks, attempts replayed with the adaptive rules); SQL = TS parity: kafaa_ad_next /
// kafaa_ad_score = adaptiveNext / scoreAdaptive at every step of the seeded attempts and on 300 generated answer patterns (same answers ->
// same items and result), kafaa_ad_percentile, kafaa_ad_item_problem, kafaa_ad_stats_core = bankStats/itemUsage, kafaa_ad_overview_for =
// overviewFor, kafaa_ir_adaptive / kafaa_ir_task = adaptiveIntegrity / taskIntegrity (and the stored reports), kafaa_pt_* = perf.ts;
// acceptance (safety-related banks never carry a percentile, no item exposes secure-bank or security content, every rubric line visible
// before an attempt, gating attempts always carry an integrity report, synthetic data only); RLS; RPC flows and refusals; grants.
import { readFileSync } from 'node:fs';
import {
  adItemProblem, adaptiveNext, bankIsSafety, bankStats, formOf, itemUsage, normGroup, normText, overviewFor, percentileOf, scoreAdaptive, RESTRICTED_TERMS,
} from '../../src/modules/m05/adaptive.ts';
import { adaptiveIntegrity, answerProblem, autoScores, dataIsSynthetic, scoreTask, scoresProblem, taskIntegrity } from '../../src/modules/m05/perf.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fs33Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave C · E3 · FS21 adaptive future-skills assessment + FS22 performance tasks and integrity reports');
  const q = async (sql, p = []) => { await db.exec('reset role'); return (await db.query(sql, p)).rows; };
  const banks = T.adaptive_banks;
  const bankById = new Map(banks.map((b) => [b.id, b]));
  const items = T.adaptive_items.map((i) => ({ ...i, level: Number(i.level), difficulty: Number(i.difficulty) }));
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const secureIds = new Set(T.items.filter((i) => i.bank === 'secure').map((i) => i.id));
  const stems = new Set();
  for (const v of T.item_versions) if (secureIds.has(v.item_id)) { stems.add(normText(v.stem_en)); stems.add(normText(v.stem_ar)); }

  // ── seed sanity
  ok(banks.length === 6 && ['ab-ai-literacy', 'ab-plant-data', 'ab-digital-twins', 'ab-cyber-hygiene', 'ab-smr', 'ab-clean-energy'].every((id) => bankById.has(id)),
    'seed: the six item banks (AI literacy, plant data, digital twins, cyber hygiene, SMR fundamentals, CleanEnergyComp)');
  ok(items.length >= 96 && items.every((i) => adItemProblem(i, banks, stems) === null), `seed: ${items.length} bilingual items pass the item check (no security wording, no secure-bank copy)`);
  ok(banks.every((b) => [1, 2, 3, 4].every((l) => items.filter((i) => i.bank_id === b.id && i.level === l && i.status === 'active').length >= 2)), 'seed: every bank has at least two active items per level');
  ok(banks.filter((b) => bankIsSafety(b, skills)).every((b) => b.mode === 'criterion') && banks.filter((b) => bankIsSafety(b, skills)).length >= 2,
    `seed: safety-related banks are criterion-referenced (${banks.filter((b) => bankIsSafety(b, skills)).map((b) => b.id).join(', ')})`);
  ok(T.performance_tasks.length >= 4 && T.performance_tasks.every((t) => t.simulated && dataIsSynthetic(t.data) && T.perf_task_keys.some((k) => k.task_id === t.id) && t.rubric.length === 4),
    `seed: ${T.performance_tasks.length} performance tasks on SIMULATED synthetic data, each with a key and a four-line rubric`);
  // replay every seeded attempt with the server rules (percentile norm group = attempts completed before it, before any later void)
  const all = T.adaptive_attempts;
  const counting = all.map((a) => ({ ...a, counts: true }));
  let replay = 0;
  const bad = [];
  for (const a of all) {
    const b = bankById.get(a.bank_id);
    const rs = [];
    let same = a.form === formOf(a.person_id, a.attempt_no);
    for (const r of a.responses) {
      const st = adaptiveNext(b, items, rs, a.form);
      const it = items.find((i) => i.id === st.item_id);
      if (st.done || !it || it.id !== r.item_id || (r.choice === it.correct) !== r.correct || r.level !== it.level) { same = false; break; }
      rs.push(r);
    }
    const end = adaptiveNext(b, items, rs, a.form);
    const sc = scoreAdaptive({ ...b, mode: a.mode }, bankIsSafety(b, skills), a.responses, end.stop, normGroup(counting, b.id, a.person_id, a.completed_at));
    if (same && end.done && end.stop === a.stop && sc.estimate === a.estimate && (sc.meets ?? null) === (a.meets ?? null) && (sc.percentile ?? null) === (a.percentile ?? null)
      && canon(sc.evidence) === canon(a.evidence) && canon(sc.reasons) === canon(a.reasons) && a.item_count <= 20) replay++;
    else bad.push(a.id);
  }
  ok(replay === all.length, `seed: all ${all.length} adaptive attempts replay exactly (form, items, stop <= 20, estimate, standard/percentile, evidence, reasons)${bad.length ? ` (first ${bad[0]})` : ''}`);
  ok(all.filter((a) => a.mode === 'criterion').every((a) => a.percentile == null) && all.some((a) => a.mode === 'criterion'), 'acceptance: no seeded criterion (safety-related) attempt carries a percentile');

  // ── SQL = TS: routing and scoring
  const diffN = [];
  for (const a of all.slice(0, 80)) {
    for (let k = 0; k <= a.responses.length; k++) {
      const pre = a.responses.slice(0, k);
      const s = (await q('select kafaa_ad_next($1, $2::jsonb, $3) j', [a.bank_id, JSON.stringify(pre), a.form]))[0].j;
      const t = adaptiveNext(bankById.get(a.bank_id), items, pre, a.form);
      if (canon(s) !== canon(t)) { diffN.push(`${a.id}@${k}`); break; }
    }
  }
  ok(diffN.length === 0, `SQL kafaa_ad_next equals adaptiveNext() at every step of 80 seeded attempts${diffN.length ? ` (${diffN[0]})` : ''}`);
  const diffS = [];
  for (const a of all) {
    const b = bankById.get(a.bank_id);
    const norm = normGroup(counting, b.id, a.person_id, a.completed_at);
    const s = (await q('select kafaa_ad_score($1, $2, $3, $4::jsonb, $5, $6::int[]) j', [b.id, a.mode, bankIsSafety(b, skills), JSON.stringify(a.responses), a.stop, norm]))[0].j;
    if (canon(s) !== canon(scoreAdaptive({ ...b, mode: a.mode }, bankIsSafety(b, skills), a.responses, a.stop, norm))) diffS.push(a.id);
  }
  ok(diffS.length === 0, `SQL kafaa_ad_score equals scoreAdaptive() for all ${all.length} seeded attempts${diffS.length ? ` (${diffS[0]})` : ''}`);
  const sNorm = (await q(`select kafaa_ad_norm('ab-ai-literacy', 'p-k-ro') a`))[0].a;
  ok(canon([...sNorm].sort()) === canon(normGroup(all, 'ab-ai-literacy', 'p-k-ro').sort()), `SQL kafaa_ad_norm equals normGroup() (${sNorm.length} people)`);
  let seedN = 331;
  const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
  const diffG = [];
  let maxLen = 0;
  for (let g = 0; g < 300; g++) {
    const b = banks[g % banks.length];
    const form = Math.floor(rand() * 900);
    const pr = rand();
    const answer = [];
    for (let k = 0; k < 20; k++) answer.push(rand() < pr);
    const run = (src) => {
      const rs = [];
      for (;;) {
        const st = adaptiveNext(b, items, rs, form);
        if (st.done) return { rs, st };
        const it = items.find((i) => i.id === st.item_id);
        const c = src[rs.length];
        rs.push({ item_id: it.id, level: it.level, facet: it.facet, choice: c ? it.correct : (it.correct + 1) % it.options_en.length, correct: c });
      }
    };
    const r1 = run(answer);
    const r2 = run(answer);
    if (canon(r1.rs.map((x) => x.item_id)) !== canon(r2.rs.map((x) => x.item_id))) diffG.push(`gen ${g} not deterministic`);
    maxLen = Math.max(maxLen, r1.rs.length);
    for (let k = 0; k <= r1.rs.length; k += 3) {
      const pre = r1.rs.slice(0, k);
      const s = (await q('select kafaa_ad_next($1, $2::jsonb, $3) j', [b.id, JSON.stringify(pre), form]))[0].j;
      if (canon(s) !== canon(adaptiveNext(b, items, pre, form))) { diffG.push(`gen ${g} step ${k}`); break; }
    }
    const safety = bankIsSafety(b, skills);
    const norm = Array.from({ length: Math.floor(rand() * 16) }, () => Math.floor(rand() * 5));
    const mode = safety ? 'criterion' : b.mode;
    const s = (await q('select kafaa_ad_score($1, $2, $3, $4::jsonb, $5, $6::int[]) j', [b.id, mode, safety, JSON.stringify(r1.rs), r1.st.stop, norm]))[0].j;
    const t = scoreAdaptive({ ...b, mode }, safety, r1.rs, r1.st.stop, norm);
    if (canon(s) !== canon(t)) diffG.push(`gen ${g} score`);
    if (safety && t.percentile != null) diffG.push(`gen ${g} safety percentile`);
  }
  ok(diffG.length === 0, `300 generated answer patterns: the same answers give the same items and result; SQL routing and scoring equal TS${diffG.length ? ` (${diffG[0]})` : ''}`);
  ok(maxLen <= 20, `acceptance: a result in 20 items or fewer (longest generated attempt ${maxLen})`);
  const diffP = [];
  for (let g = 0; g < 60; g++) {
    const others = Array.from({ length: Math.floor(rand() * 25) }, () => Math.floor(rand() * 5));
    const e = Math.floor(rand() * 5);
    const s = (await q('select kafaa_ad_percentile($1, $2::int[]) p', [e, others]))[0].p;
    if ((s ?? null) !== percentileOf(e, others)) diffP.push(g);
  }
  ok(diffP.length === 0, 'SQL kafaa_ad_percentile equals percentileOf() on 60 groups (suppressed under 10)');

  // ── item checks
  const it0 = { ...T.adaptive_items[0] };
  const secureStem = T.item_versions.find((v) => secureIds.has(v.item_id))?.stem_en;
  const cases = [it0, { ...it0, difficulty: 5 }, { ...it0, difficulty: 2.345 }, { ...it0, difficulty: '2' }, { ...it0, facet: 'Bad Facet' }, { ...it0, skill_id: 'sk-fs-gr-ghg' }, { ...it0, bank_id: 'ab-x' },
    { ...it0, stem_ar: ' ' }, { ...it0, options_ar: it0.options_ar.slice(0, 2) }, { ...it0, correct: 7 }, { ...it0, stem_en: 'Where is the vital area boundary?' },
    { ...it0, explain_en: 'See the security plan' }, { ...it0, stem_en: secureStem }, { ...it0, stem_en: `  ${String(secureStem).toUpperCase()}  ` }];
  const diffI = [];
  for (const c of cases) { const s = (await q('select kafaa_ad_item_problem($1::jsonb) p', [JSON.stringify(c)]))[0].p; if ((s ?? null) !== adItemProblem(c, banks, stems)) diffI.push(JSON.stringify(c).slice(0, 70)); }
  ok(diffI.length === 0, `item checks: SQL kafaa_ad_item_problem equals adItemProblem() on ${cases.length} valid, malformed, restricted and secure-copy items${diffI.length ? ` (${diffI[0]})` : ''}`);
  ok(adItemProblem(cases[12], banks, stems) === 'secure_copy' && adItemProblem(cases[10], banks, stems) === 'restricted', 'acceptance: an item copying a secure-bank stem or naming security content is refused');
  const exposed = (await q(`select count(*)::int n from kafaa_adaptive_items a where exists (select 1 from kafaa_item_versions v join kafaa_items i on i.id = v.item_id where i.bank = 'secure'
    and kafaa_ad_norm_text(v.stem_en) in (kafaa_ad_norm_text(a.stem_en), kafaa_ad_norm_text(a.stem_ar)))`))[0].n;
  const restricted = items.filter((i) => RESTRICTED_TERMS.some((w) => [i.stem_en, i.stem_ar, ...i.options_en, ...i.options_ar, i.explain_en, i.explain_ar].join(' ').toLowerCase().includes(w))).length;
  ok(exposed === 0 && restricted === 0, 'acceptance: no adaptive item exposes secure-bank or security content');

  // ── statistics and overview
  const sStats = (await q('select kafaa_ad_stats_core() j'))[0].j;
  const tStats = { banks: [...banks].sort((a, b) => a.sort - b.sort).map((b) => bankStats(b, bankIsSafety(b, skills), all, 10)), items: itemUsage([...items].sort((a, b) => (a.id < b.id ? -1 : 1)), all) };
  ok(canon(sStats) === canon(tStats), `SQL kafaa_ad_stats_core equals bankStats()/itemUsage() on the seed (${tStats.banks.map((b) => b.tested).join('/')} tested)`);
  ok(tStats.banks.every((b) => b.dist.every((d) => d.n == null || d.n >= 10)) && tStats.banks.filter((b) => b.criterion).every((b) => b.avg_estimate != null || b.n == null), 'aggregates: every distribution cell names 10 people or more, or is suppressed');
  const today = (await q('select current_date::text d'))[0].d;
  const diffO = [];
  for (const pid of ['p-k-ro', 'p-sro', 'p-buyer', 'p-nse', 'p-qc-inspector', 'p-training-mgr', 'p-chco']) {
    const s = (await q('select kafaa_ad_overview_for($1, $2::date) j', [pid, today]))[0].j;
    const t = { banks: overviewFor(pid, banks, skills, all, today, 10) };
    if (canon(s) !== canon(t)) diffO.push(pid);
  }
  ok(diffO.length === 0, `SQL kafaa_ad_overview_for equals overviewFor() for 7 people${diffO.length ? ` (${diffO[0]})` : ''}`);
  ok(overviewFor('p-k-ro', banks, skills, all, today, 10).filter((c) => c.criterion).every((c) => c.enec_avg == null && (c.latest?.percentile ?? null) == null), 'acceptance: safety-related bank cards never show a percentile or an average rank');

  // ── integrity parity (stored reports and the SQL rule)
  const tasks = new Map(T.performance_tasks.map((t) => [t.id, t]));
  const diffR = [];
  for (const r of T.integrity_reports) {
    const keys = ['time_on_task_s', 'items', 'fast_items', 'median_item_s', 'retakes', 'resubmissions', 'repeat_items', 'exposure_max', 'exposure_mean', 'exposure_n', 'flags', 'status'];
    const pick = (o) => Object.fromEntries(keys.map((k) => [k, o[k]]));
    if (r.kind === 'adaptive') {
      const a = all.find((x) => x.id === r.attempt_id);
      const t = adaptiveIntegrity(a, all);
      const s = (await q('select kafaa_ir_adaptive($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::jsonb) j', [a.id, a.person_id, a.bank_id, a.started_at, a.completed_at, JSON.stringify(a.responses)]))[0].j;
      if (canon(pick(s)) !== canon(pick(t)) || canon(pick(r)) !== canon(pick(t))) diffR.push(r.id);
    } else {
      const a = T.task_attempts.find((x) => x.id === r.attempt_id);
      const t = taskIntegrity(a, tasks.get(a.task_id), T.task_attempts);
      const s = (await q('select kafaa_ir_task($1, $2, $3, $4::timestamptz, $5::timestamptz, $6) j', [a.id, a.person_id, a.task_id, a.started_at, a.submitted_at, a.resubmissions]))[0].j;
      if (canon(pick(s)) !== canon(pick(t)) || canon(pick(r)) !== canon(pick(t))) diffR.push(r.id);
    }
  }
  ok(diffR.length === 0, `integrity: stored reports = adaptiveIntegrity()/taskIntegrity() = SQL kafaa_ir_* for all ${T.integrity_reports.length} reports${diffR.length ? ` (${diffR[0]})` : ''}`);
  const gating = [...all.filter((a) => a.gating && a.status === 'completed'), ...T.task_attempts.filter((a) => a.gating && a.status !== 'in_progress')];
  ok(gating.length > 0 && gating.every((a) => T.integrity_reports.some((r) => r.attempt_id === a.id && r.id === a.integrity_id)), `acceptance: all ${gating.length} gating attempts carry an integrity report`);
  let ck = false;
  try { await db.exec(`update kafaa_adaptive_attempts set integrity_id = null where id = '${gating.find((a) => a.bank_id).id}'`); } catch { ck = true; }
  let ck2 = false;
  try { await db.exec(`update kafaa_adaptive_attempts set percentile = 50 where mode = 'criterion' and id = '${all.find((a) => a.mode === 'criterion').id}'`); } catch { ck2 = true; }
  let ck3 = false;
  try { await db.exec(`update kafaa_performance_tasks set simulated = false where id = 'pt-feedwater-drift'`); } catch { ck3 = true; }
  ok(ck && ck2 && ck3, 'database checks refuse a gating attempt without a report, a percentile on a criterion attempt and non-simulated task data');

  // ── performance-task rules
  const diffT = [];
  let gn = 0;
  for (const t of T.performance_tasks) {
    const key = T.perf_task_keys.find((k) => k.task_id === t.id);
    for (let g = 0; g < 25; g++) {
      const s0 = t.data.series[Math.floor(rand() * t.data.series.length)];
      const ans = { series: rand() < 0.1 ? 'nope' : s0.key, index: Math.floor(rand() * (s0.values.length + 2)) - 1, decision: Math.floor(rand() * (t.decisions.length + 1)), checks: rand() < 0.1 ? ['x'] : ['redundant'],
        justification: rand() < 0.1 ? 'short' : 'The marked reading departs from the agreeing channels; I would get it checked.' };
      const sp = (await q('select kafaa_pt_answer_problem($1, $2::jsonb) p', [t.id, JSON.stringify(ans)]))[0].p;
      if ((sp ?? null) !== answerProblem(t, ans)) diffT.push(`${t.id} answer ${g}`);
      if (answerProblem(t, ans)) continue;
      const sa = (await q('select kafaa_pt_auto($1, $2::jsonb) j', [t.id, JSON.stringify(ans)]))[0].j;
      const ta = autoScores(key, ans);
      if (canon(sa) !== canon(ta)) diffT.push(`${t.id} auto ${g}`);
      const manual = { quality: Math.floor(rand() * 4), justify: Math.floor(rand() * 4) };
      const ss = (await q('select kafaa_pt_score($1::jsonb, $2, $3::jsonb, $4::jsonb) j', [JSON.stringify(t.rubric), t.pass_pct, JSON.stringify(ta), JSON.stringify(manual)]))[0].j;
      if (canon(ss) !== canon(scoreTask(t, ta, manual))) diffT.push(`${t.id} score ${g}`);
      gn++;
    }
    for (const sc of [{ quality: 3, justify: 2 }, { quality: 4, justify: 1 }, { quality: 1 }, { quality: 1.5, justify: 1 }, null, []]) {
      const s = (await q('select kafaa_pt_scores_problem($1::jsonb, $2::jsonb) p', [JSON.stringify(t.rubric), JSON.stringify(sc)]))[0].p;
      if ((s ?? null) !== scoresProblem(t.rubric, sc)) diffT.push(`${t.id} scores ${JSON.stringify(sc)}`);
    }
  }
  ok(diffT.length === 0, `SQL kafaa_pt_* equal answerProblem/autoScores/scoreTask/scoresProblem on ${gn} generated answers${diffT.length ? ` (${diffT[0]})` : ''}`);
  const crit = scoreTask(T.performance_tasks[0], { anomaly: 3, decision: 0 }, { quality: 3, justify: 3 });
  ok(!crit.passed && crit.critical_failed && crit.total === 9, 'an unsafe decision fails the task whatever the total (critical rubric line)');

  // ── RLS
  let n = 3301;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  await addProfile('buyer', 'Buyer');
  await addProfile('qc-inspector', 'QC Inspector');
  const anonDenied = async (sql) => { try { await one(null, sql); return false; } catch { return true; } };
  const cnt = async (who, table) => Number((await one(who, `select count(*)::int n from ${table}`)).n);
  ok(await cnt(null, 'kafaa_adaptive_banks') === 0 && await cnt(null, 'kafaa_adaptive_attempts') === 0 && await cnt(null, 'kafaa_performance_tasks') === 0, 'RLS: anonymous visitors read no banks, tasks or attempts');
  ok(await cnt('buyer', 'kafaa_adaptive_banks') === 6 && await cnt('buyer', 'kafaa_performance_tasks') === T.performance_tasks.length, 'RLS: staff read the banks and the tasks with their published rubric (every line before an attempt)');
  ok(await cnt('buyer', 'kafaa_adaptive_items') === 0 && await cnt('buyer', 'kafaa_perf_task_keys') === 0 && await cnt('training-mgr', 'kafaa_adaptive_items') >= items.length,
    'RLS: items (with their key) and task keys are training-staff only');
  const mineA = Number((await one('buyer', `select count(*)::int n from kafaa_adaptive_attempts where person_id <> 'p-buyer'`)).n);
  ok(mineA === 0 && await cnt('training-mgr', 'kafaa_adaptive_attempts') >= all.length, 'RLS: staff read only their own adaptive attempts; the training manager reads all');
  ok(Number((await one('buyer', `select count(*)::int n from kafaa_integrity_reports where person_id <> 'p-buyer'`)).n) === 0 && await cnt('k-auditor', 'kafaa_integrity_reports') === T.integrity_reports.length
    && await cnt('k-instructor', 'kafaa_integrity_reports') === T.integrity_reports.length, 'RLS: integrity reports: own; assessors and auditors read all');
  ok(Number((await one('buyer', `select count(*)::int n from kafaa_task_attempts where person_id <> 'p-buyer'`)).n) === 0 && await cnt('k-instructor', 'kafaa_task_attempts') >= T.task_attempts.length,
    'RLS: task attempts: own; assessors (signoff A) all');
  ok(await cnt('k-auditor', 'kafaa_task_attempts') === 0, 'RLS: auditors read integrity reports, not answers');

  // ── RPC flows: adaptive
  const ov = (await one('buyer', 'select kafaa_adaptive_overview() v')).v;
  ok(ov && ov.banks.length === 6 && ov.banks.filter((b) => b.criterion).every((b) => b.enec_avg == null), 'adaptiveOverview (Own): six banks; criterion banks carry the meets-standard share, never an average rank');
  ok((await one('alnoor-gm', 'select kafaa_adaptive_overview() v')).v === null && await anonDenied('select kafaa_adaptive_overview() v'), 'adaptiveOverview: partners get nothing; anonymous visitors cannot execute it');
  const key = new Map(items.map((i) => [i.id, i]));
  const runBank = async (who, bank, rightEvery = 3) => {
    const st = (await one(who, 'select kafaa_start_adaptive($1::jsonb) r', [JSON.stringify({ bank_id: bank })])).r;
    if (!st.ok) return { st };
    let step = st.data;
    let k = 0;
    while (!step.done && k < 25) {
      const it = key.get(step.item.id);
      const choice = k % rightEvery !== rightEvery - 1 ? it.correct : (it.correct + 1) % it.options_en.length;
      const r = (await one(who, 'select kafaa_answer_adaptive($1::jsonb) r', [JSON.stringify({ attempt_id: step.attempt_id, item_id: step.item.id, choice })])).r;
      if (!r.ok) return { st, fail: r };
      step = r.data; k++;
    }
    return { st, step, k };
  };
  const s1 = (await one('buyer', 'select kafaa_start_adaptive($1::jsonb) r', [JSON.stringify({ bank_id: 'ab-smr' })])).r;
  ok(s1.ok && s1.data.item && s1.data.item.correct === undefined && s1.data.answered === 0 && s1.data.level === 2, 'startAdaptive: an attempt opens at level 2 with the first item, served without its key');
  const again = (await one('buyer', 'select kafaa_start_adaptive($1::jsonb) r', [JSON.stringify({ bank_id: 'ab-smr' })])).r;
  ok(again.ok && again.data.resumed && again.data.attempt_id === s1.data.attempt_id, 'startAdaptive again: the open attempt resumes');
  const wrongItem = (await one('buyer', 'select kafaa_answer_adaptive($1::jsonb) r', [JSON.stringify({ attempt_id: s1.data.attempt_id, item_id: 'ai-x', choice: 0 })])).r;
  const badChoice = (await one('buyer', 'select kafaa_answer_adaptive($1::jsonb) r', [JSON.stringify({ attempt_id: s1.data.attempt_id, item_id: s1.data.item.id, choice: 9 })])).r;
  const other = (await one('qc-inspector', 'select kafaa_answer_adaptive($1::jsonb) r', [JSON.stringify({ attempt_id: s1.data.attempt_id, item_id: s1.data.item.id, choice: 0 })])).r;
  ok(wrongItem.code === 'invalid' && badChoice.code === 'invalid' && other.code === 'not_found', 'answerAdaptive refuses another item, an out-of-range choice and another person\'s attempt');
  const run1 = await runBank('buyer', 'ab-smr');
  ok(run1.step?.done && run1.k <= 20 && run1.step.result.criterion && run1.step.result.percentile === null && typeof run1.step.result.meets === 'boolean',
    `acceptance: SMR (safety-related) stops after ${run1.k} items with "meets the standard: ${run1.step?.result?.meets}" and no percentile`);
  const row1 = await one('buyer', 'select * from kafaa_adaptive_attempts where id = $1', [s1.data.attempt_id]);
  const t1 = scoreAdaptive({ ...bankById.get('ab-smr'), mode: row1.mode }, true, row1.responses, row1.stop, []);
  const replay1 = (() => { const rs = []; for (const r of row1.responses) { const st = adaptiveNext(bankById.get('ab-smr'), items, rs, row1.form); if (st.item_id !== r.item_id) return false; rs.push(r); } return adaptiveNext(bankById.get('ab-smr'), items, rs, row1.form).stop === row1.stop; })();
  ok(replay1 && row1.estimate === t1.estimate && row1.meets === t1.meets && canon(row1.evidence) === canon(t1.evidence), `the live attempt replays with the TS rules: same items, stop (${row1.stop}) and estimate ${row1.estimate}`);
  const ev1 = await q(`select level, active from kafaa_skill_evidence where ref_table = 'adaptive_attempts' and ref_id = $1`, [s1.data.attempt_id]);
  ok(ev1.length === t1.evidence.length && ev1.every((e) => e.active && e.level <= 3), `acceptance: the result wrote ${ev1.length} F01 assessment evidence rows (level <= 3)`);
  await q(`select kafaa_skills_apply('p-buyer', current_date)`);
  ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_id = $1 and active`, [s1.data.attempt_id]))[0].n) === ev1.length, 'F01 recompute keeps adaptive evidence (recorded, not derived)');
  const soon = (await one('buyer', 'select kafaa_start_adaptive($1::jsonb) r', [JSON.stringify({ bank_id: 'ab-smr' })])).r;
  ok(soon.code === 'too_soon' && /from \d{4}-\d{2}-\d{2}/.test(soon.message), `retake rule: ${soon.message}`);
  const run2 = await runBank('buyer', 'ab-ai-literacy', 2);
  const r2 = run2.step?.result;
  const ir2 = r2 ? await q('select * from kafaa_integrity_reports where attempt_id = $1', [r2.attempt_id]) : [];
  ok(r2 && !r2.criterion && ir2.length === 1 && r2.integrity_id === ir2[0].id && (r2.percentile === null || typeof r2.percentile === 'number'),
    `a gating developmental bank (AI literacy): percentile ${r2?.percentile} vs ${r2?.norm_n} people, integrity report ${ir2[0]?.status} (${(ir2[0]?.flags ?? []).join(', ') || 'no flags'})`);
  ok((await one('alnoor-gm', 'select kafaa_start_adaptive($1::jsonb) r', [JSON.stringify({ bank_id: 'ab-smr' })])).r.code === 'forbidden' && await anonDenied(`select kafaa_start_adaptive('{}'::jsonb) r`), 'startAdaptive: partners refused; anonymous cannot execute');
  ok((await one('buyer', 'select kafaa_adaptive_stats() v')).v === null && (await one('k-instructor', 'select kafaa_adaptive_stats() v')).v?.banks?.length === 6, 'adaptiveStats: training staff only');

  // item bank
  const base = { bank_id: 'ab-plant-data', skill_id: 'sk-fs-ai-plantdata', facet: 'quality', difficulty: 2.4, stem_en: 'Test stem for a new plant data item', stem_ar: 'سؤال اختبار لبند بيانات جديد', options_en: ['a', 'b', 'c'], options_ar: ['أ', 'ب', 'ج'], correct: 1 };
  ok((await one('buyer', 'select kafaa_save_adaptive_item($1::jsonb) r', [JSON.stringify(base)])).r.code === 'forbidden' && (await one('k-instructor', 'select kafaa_save_adaptive_item($1::jsonb) r', [JSON.stringify(base)])).r.code === 'forbidden',
    'saveAdaptiveItem: staff and instructors are refused (training manager writes banks)');
  const add = (await one('training-mgr', 'select kafaa_save_adaptive_item($1::jsonb) r', [JSON.stringify(base)])).r;
  ok(add.ok && add.data.version === 1 && add.data.level === 2, 'saveAdaptiveItem: the training manager adds an item; its level follows the calibrated difficulty');
  const sec = (await one('training-mgr', 'select kafaa_save_adaptive_item($1::jsonb) r', [JSON.stringify({ ...base, stem_en: secureStem })])).r;
  const rst = (await one('training-mgr', 'select kafaa_save_adaptive_item($1::jsonb) r', [JSON.stringify({ ...base, stem_en: 'Describe the patrol route at night' })])).r;
  ok(sec.code === 'invalid' && /secure-bank/.test(sec.message) && rst.code === 'invalid' && /security/.test(rst.message), 'saveAdaptiveItem: secure-bank copies and security content are refused');
  const lv1 = items.filter((i) => i.bank_id === 'ab-smr' && i.level === 1);
  let conflict = null;
  for (const it of lv1) { const r = (await one('training-mgr', 'select kafaa_save_adaptive_item($1::jsonb) r', [JSON.stringify({ ...it, status: 'retired' })])).r; if (!r.ok) { conflict = r; break; } }
  ok(conflict?.code === 'conflict', 'saveAdaptiveItem: a bank level keeps at least two active items');

  // ── RPC flows: performance tasks
  const tk = 'pt-twin-divergence';
  const noRubric = (await one('buyer', 'select kafaa_start_performance_task($1::jsonb) r', [JSON.stringify({ task_id: tk })])).r;
  ok(noRubric.code === 'rubric_not_seen', 'acceptance: a task cannot start until the learner confirms the published rubric');
  const ts1 = (await one('buyer', 'select kafaa_start_performance_task($1::jsonb) r', [JSON.stringify({ task_id: tk, rubric_seen: true })])).r;
  ok(ts1.ok && ts1.data.rubric_version === 1, 'startPerformanceTask: starts once the rubric is confirmed');
  const kk = T.perf_task_keys.find((k) => k.task_id === tk);
  const badAns = (await one('buyer', 'select kafaa_submit_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: ts1.data.attempt_id, answer: { series: 'cv_meas', index: 40, decision: 1, checks: [], justification: 'short' } })])).r;
  ok(badAns.code === 'invalid' && /20 to 1,500/.test(badAns.message), 'submitPerformanceTask: an answer without a real justification is refused');
  const ans = { series: kk.series, index: kk.from_idx + 1, decision: kk.decision_points.indexOf(3), checks: ['redundant', 'status'], justification: 'Measured pressure leaves the twin while cooling water is steady; I report it and ask for checks.' };
  const sub = (await one('buyer', 'select kafaa_submit_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: ts1.data.attempt_id, answer: ans })])).r;
  ok(sub.ok && sub.data.integrity_id && sub.data.integrity.flags.includes('short_time'), `acceptance: the gating task submission carries an integrity report (${sub.data?.integrity?.flags?.join(', ')})`);
  const resub = (await one('buyer', 'select kafaa_submit_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: ts1.data.attempt_id, answer: { ...ans, checks: ['redundant', 'status', 'history'] } })])).r;
  ok(resub.ok && resub.data.resubmissions === 1, 'resubmission before scoring is counted');
  const self = await (async () => {
    const st = (await one('training-mgr', 'select kafaa_start_performance_task($1::jsonb) r', [JSON.stringify({ task_id: 'pt-ghg-log', rubric_seen: true })])).r;
    const k2 = T.perf_task_keys.find((k) => k.task_id === 'pt-ghg-log');
    await one('training-mgr', 'select kafaa_submit_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: st.data.attempt_id, answer: { series: k2.series, index: k2.from_idx, decision: 1, checks: [], justification: 'The May entry is ten times the others; query it with the owner.' } })]);
    return (await one('training-mgr', 'select kafaa_score_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: st.data.attempt_id, scores: { quality: 2, justify: 2 } })])).r;
  })();
  ok(self.code === 'self_score', 'maker-checker: an assessor cannot score their own attempt');
  ok((await one('buyer', 'select kafaa_score_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: ts1.data.attempt_id, scores: { quality: 3, justify: 3 } })])).r.code === 'forbidden', 'scorePerformanceTask: learners are refused (assessor: signoff A)');
  ok((await one('k-instructor', 'select kafaa_score_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: ts1.data.attempt_id, scores: { quality: 5 } })])).r.code === 'invalid', 'scorePerformanceTask: every assessor line must be scored within its maximum');
  const scd = (await one('k-instructor', 'select kafaa_score_performance_task($1::jsonb) r', [JSON.stringify({ attempt_id: ts1.data.attempt_id, scores: { quality: 3, justify: 2 }, comment: 'Clear challenge of the model.' })])).r;
  ok(scd.ok && scd.data.passed && scd.data.total === 11 && scd.data.evidence.length === 2, `an assessor scores it: ${scd.data?.total}/${scd.data?.max}, pass, ${scd.data?.evidence?.length} evidence rows`);
  ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'task_attempts' and ref_id = $1 and active`, [ts1.data.attempt_id]))[0].n) === 2, 'a passed task writes F01 assessment evidence');

  // ── integrity review
  const flagged = T.integrity_reports.find((r) => r.status === 'review' && !r.decision && r.person_id !== 'p-k-instructor' && r.kind === 'adaptive');
  ok((await one('k-auditor', 'select kafaa_review_integrity($1::jsonb) r', [JSON.stringify({ report_id: flagged.id, decision: 'voided', note: 'Auditors only read' })])).r.code === 'forbidden', 'reviewIntegrity: auditors read, they do not decide');
  ok((await one('k-instructor', 'select kafaa_review_integrity($1::jsonb) r', [JSON.stringify({ report_id: flagged.id, decision: 'voided', note: 'short' })])).r.code === 'invalid', 'reviewIntegrity: a reason is required');
  const vd = (await one('k-instructor', 'select kafaa_review_integrity($1::jsonb) r', [JSON.stringify({ report_id: flagged.id, decision: 'voided', note: 'Answers too fast to be read; please retake.' })])).r;
  const va = await q('select counts from kafaa_adaptive_attempts where id = $1', [flagged.attempt_id]);
  const vev = Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_id = $1 and active`, [flagged.attempt_id]))[0].n);
  ok(vd.ok && va[0].counts === false && vev === 0, 'voiding a flagged report withdraws the attempt and its evidence');
  ok((await one('k-instructor', 'select kafaa_review_integrity($1::jsonb) r', [JSON.stringify({ report_id: flagged.id, decision: 'accepted', note: 'Changed my mind later' })])).r.code === 'invalid', 'a decided report cannot be decided again');

  const audits = Number((await q(`select count(*)::int n from kafaa_audit_events where action like 'assess.%'`))[0].n);
  ok(audits >= 20, `every FS21/FS22 RPC writes an audit row (${audits})`);
  const fns = (await q(`select p.proname from pg_proc p where p.proname like 'kafaa\\_ad\\_%' or p.proname like 'kafaa\\_pt\\_%' or p.proname like 'kafaa\\_ir\\_%'`)).map((r) => r.proname);
  const exec = [];
  for (const f of fns) if ((await q(`select has_function_privilege('authenticated', oid, 'execute') e from pg_proc where proname = $1 limit 1`, [f]))[0].e) exec.push(f);
  ok(exec.length === 0 && fns.length >= 20, `internal helpers are not executable by API roles (${fns.length} checked)`);
}
