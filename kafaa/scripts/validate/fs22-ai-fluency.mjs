// [FS wave B · E2 · FS09 + FS10] PGlite checks for 20261010222001_kafaa_fs22_ai_fluency.sql (AI fluency ladder, AI and digital fitness check).
// Seed sanity (ladder, targets, bank, attempts replayed with the adaptive rules); SQL = TS parity on a pristine database: kafaa_ai_rung =
// aiRung for every person, kafaa_fit_next / kafaa_fit_pick / kafaa_fit_score = nextStep / pickItem / scoreAttempt for every seeded attempt
// and 300 generated answer patterns, kafaa_fit_item_problem = itemProblem, kafaa_fit_stats_core = fitnessStats, kafaa_ai_fluency_stats =
// rungStats; RLS (own attempts only, the item bank for training staff only, public ladder); RPC flows (start, answer, stop rule within 20
// items, server-side key, evidence capped at level 2, latest check replaces earlier evidence, recompute keeps it, one check per quarter,
// item bank RBAC and guards); aggregates suppressed under 10.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { aiRung, rungStats, targetGap } from '../../src/modules/m29/fluency.ts';
import { MAX_ITEMS, fitnessStats, itemProblem, nextStep, pickItem, scoreAttempt } from '../../src/modules/m29/fitness.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const TODAY = '2026-10-10';

export default async function fs22Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave B · E2 · FS09 AI fluency ladder + FS10 AI and digital fitness check');
  const areas = T.fitness_areas.map((a) => ({ ...a, weight: Number(a.weight) }));
  const items = T.fitness_items;

  // ── seed sanity
  ok(T.ai_rungs.length === 16 && T.ai_rungs.every((c) => c.skill_ids.every((s) => T.ai_skill_tracks.find((t) => t.skill_id === s)?.track === 'literacy')), 'seed: 16 ladder cells (4 rungs x 4 UNESCO dimensions), literacy skills only');
  ok(T.job_families.every((f) => T.ai_role_targets.some((t) => t.family_id === f.id)) && T.ai_role_targets.length === 20, 'seed: all 20 job families have an AI fluency target');
  ok(items.length >= 54 && items.every((i) => itemProblem(i, areas.map((a) => a.id)) === null), `seed: ${items.length} bilingual items pass the item check (no plant-security wording)`);
  const cells = new Map(); for (const i of items) cells.set(`${i.area_id}:${i.difficulty}`, (cells.get(`${i.area_id}:${i.difficulty}`) ?? 0) + 1);
  ok(areas.every((a) => [1, 2, 3].every((d) => (cells.get(`${a.id}:${d}`) ?? 0) >= 2)), 'seed: at least two active items per area and difficulty');
  const fev = T.skill_evidence.filter((e) => e.ref_table === 'fitness_attempts');
  ok(fev.length > 0 && fev.every((e) => e.kind === 'assessment' && e.level >= 1 && e.level <= 2), `seed: ${fev.length} fitness evidence rows, all kind assessment, level 1-2`);
  let replay = 0;
  for (const a of T.fitness_attempts) {
    const rs = [];
    let same = true;
    for (const r of a.responses) {
      const st = nextStep(areas, rs);
      const it = st && pickItem(items, st, new Set(rs.map((x) => x.item_id)), a.attempt_no);
      if (!it || it.id !== r.item_id || (r.choice === it.correct) !== r.correct) { same = false; break; }
      rs.push(r);
    }
    const sc = scoreAttempt(areas, a.responses);
    if (same && nextStep(areas, rs) === null && sc.score === a.score && sc.band === a.band && canon(sc.evidence) === canon(a.evidence) && a.item_count <= MAX_ITEMS) replay++;
  }
  ok(replay === T.fitness_attempts.length, `seed: all ${T.fitness_attempts.length} seeded attempts replay exactly with the adaptive rules (routing, items, stop rule <= 20, score, evidence)`);

  // ── parity on a pristine database
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const states = (await fq(`select id, person_id, skill_id, level, basis, active, reasons from kafaa_person_skills where active`));
  const by = new Map(); for (const s of states) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const diffR = [];
  for (const p of T.people) {
    const s = (await fq('select kafaa_ai_rung($1) j', [p.id]))[0].j;
    if (canon(s) !== canon(aiRung(p.id, T.ai_rungs, T.ai_skill_tracks, by.get(p.id) ?? []))) diffR.push(p.id);
  }
  ok(diffR.length === 0, `SQL kafaa_ai_rung equals aiRung() for all ${T.people.length} people${diffR.length ? ` (first diff ${diffR[0]})` : ''}`);
  const tsAll = new Map(T.people.map((p) => [p.id, aiRung(p.id, T.ai_rungs, T.ai_skill_tracks, by.get(p.id) ?? [])]));
  ok(T.people.filter((p) => p.kind === 'staff' && p.persona_id && T.fitness_attempts.some((a) => a.person_id === p.id)).every((p) => tsAll.get(p.id).reasons.some((r) => r.ref?.table === 'skill_evidence')),
    'acceptance: every tested staff persona sees a rung with at least one reason linking to an evidence row');
  const diffG = [];
  for (const p of T.people.filter((x) => x.kind === 'staff')) {
    const s = (await fq('select kafaa_ai_target_gap(kafaa_ai_rung($1), $2) j', [p.id, p.job_family_id]))[0].j;
    const t = T.ai_role_targets.find((x) => x.family_id === p.job_family_id);
    if (canon(s) !== canon(targetGap(tsAll.get(p.id), t ? { rung: t.rung, plus_cells: t.plus_cells } : null))) diffG.push(p.id);
  }
  ok(diffG.length === 0, `SQL kafaa_ai_target_gap equals targetGap() for every staff member${diffG.length ? ` (${diffG[0]})` : ''}`);

  const diffS = [];
  const diffN = [];
  for (const a of T.fitness_attempts) {
    const s = (await fq('select kafaa_fit_score($1::jsonb) j', [JSON.stringify(a.responses)]))[0].j;
    if (canon(s) !== canon(scoreAttempt(areas, a.responses))) diffS.push(a.id);
  }
  for (const a of T.fitness_attempts.slice(0, 40)) {
    for (let k = 0; k <= a.responses.length; k++) {
      const pre = a.responses.slice(0, k);
      const s = (await fq('select kafaa_fit_next($1::jsonb) j', [JSON.stringify(pre)]))[0].j;
      const t = nextStep(areas, pre);
      if (canon(s) !== canon(t)) { diffN.push(`${a.id}@${k}`); break; }
      if (t) {
        const sp = (await fq('select kafaa_fit_pick($1, $2, $3::text[], $4) id', [t.area_id, t.difficulty, pre.map((r) => r.item_id), a.attempt_no]))[0].id;
        if (sp !== (pickItem(items, t, new Set(pre.map((r) => r.item_id)), a.attempt_no)?.id ?? null)) { diffN.push(`${a.id}@${k} pick`); break; }
      }
    }
  }
  ok(diffS.length === 0, `SQL kafaa_fit_score equals scoreAttempt() for all ${T.fitness_attempts.length} seeded attempts${diffS.length ? ` (${diffS[0]})` : ''}`);
  ok(diffN.length === 0, `SQL kafaa_fit_next / kafaa_fit_pick equal nextStep() / pickItem() at every step of 40 seeded attempts${diffN.length ? ` (${diffN[0]})` : ''}`);
  let seedN = 97;
  const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
  const diffG2 = [];
  let maxLen = 0;
  for (let g = 0; g < 300; g++) {
    const rs = [];
    const no = 1 + Math.floor(rand() * 6);
    const pr = rand();
    for (;;) {
      const t = nextStep(areas, rs);
      const s = (await fq('select kafaa_fit_next($1::jsonb) j', [JSON.stringify(rs)]))[0].j;
      if (canon(s) !== canon(t)) { diffG2.push(`gen ${g} step ${rs.length}`); break; }
      if (!t) break;
      const it = pickItem(items, t, new Set(rs.map((r) => r.item_id)), no);
      const c = rand() < pr;
      rs.push({ item_id: it.id, area_id: it.area_id, difficulty: it.difficulty, choice: c ? it.correct : (it.correct + 1) % it.options_en.length, correct: c });
    }
    maxLen = Math.max(maxLen, rs.length);
    const s = (await fq('select kafaa_fit_score($1::jsonb) j', [JSON.stringify(rs)]))[0].j;
    if (canon(s) !== canon(scoreAttempt(areas, rs))) diffG2.push(`gen ${g} score`);
    if (s.evidence.some((e) => e.level > 2)) diffG2.push(`gen ${g} evidence above 2`);
  }
  ok(diffG2.length === 0, `300 generated answer patterns: SQL routing and scoring equal TS; evidence never above level 2${diffG2.length ? ` (${diffG2[0]})` : ''}`);
  ok(maxLen <= 20, `acceptance: a result is reached in 20 items or fewer (longest generated attempt ${maxLen})`);
  const itemCases = [items[0], { ...items[0], difficulty: 4 }, { ...items[0], difficulty: '2' }, { ...items[0], stem_ar: ' ' }, { ...items[0], options_ar: items[0].options_ar.slice(0, 2) },
    { ...items[0], correct: 3 }, { ...items[0], correct: -1 }, { ...items[0], area_id: 'fa-x' }, { ...items[0], stem_en: 'Where is the vital area boundary?' }, { ...items[0], options_en: ['a', 'b', ''] },
    { ...items[0], options_en: ['Vital', 'area', 'c'] }, { ...items[0], explain_en: 'See the security plan' }];
  const diffI = [];
  for (const c of itemCases) { const s = (await fq('select kafaa_fit_item_problem($1::jsonb) p', [JSON.stringify(c)]))[0].p; if ((s ?? null) !== itemProblem(c, areas.map((a) => a.id))) diffI.push(JSON.stringify(c).slice(0, 60)); }
  ok(diffI.length === 0, `item checks: SQL kafaa_fit_item_problem equals itemProblem() on ${itemCases.length} valid and malformed items${diffI.length ? ` (${diffI[0]})` : ''}`);
  const sStats = (await fq('select kafaa_fit_stats_core($1::date) j', [TODAY]))[0].j;
  const tStats = fitnessStats(T.fitness_attempts, T.people, areas, TODAY, 10);
  ok(canon(sStats) === canon(tStats), `SQL kafaa_fit_stats_core equals fitnessStats() on the seed (${tStats.tested} tested, ${tStats.pct_above_basic}% above basic)`);
  ok(tStats.trend.every((x) => x.n == null || x.n >= 10) && tStats.by_family.every((x) => x.n == null || x.n >= 10) && tStats.bands.every((x) => x.n == null || x.n >= 10)
    && tStats.by_family.every((x) => !['security', 'safeguards', 'cyber'].includes(x.family_id)), 'acceptance: every indicator cell names 10 people or more, or is suppressed; security families never broken out');
  const small = fitnessStats(T.fitness_attempts.slice(0, 5), T.people, areas, TODAY, 10);
  ok(small.pct_above_basic === null && small.avg_score === null, 'acceptance: the organisation indicator is suppressed under 10 tested people');

  // ── RLS and RPC flows on the shared database
  let n = 2201;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  const anonDenied = async (sql) => { try { await one(null, sql); return false; } catch { return true; } };
  await addProfile('buyer', 'Buyer');
  await addProfile('qc-inspector', 'QC Inspector');
  ok(Number((await one(null, 'select count(*)::int n from kafaa_ai_rungs')).n) === 16 && Number((await one(null, 'select count(*)::int n from kafaa_ai_role_targets')).n) === 20, 'RLS: the ladder and role targets are public');
  ok(Number((await one(null, 'select count(*)::int n from kafaa_fitness_attempts')).n) === 0 && Number((await one(null, 'select count(*)::int n from kafaa_fitness_items')).n) === 0, 'RLS: anonymous visitors read no attempts and no items');
  const mine = T.fitness_attempts.filter((a) => a.person_id === 'p-buyer').length;
  ok(Number((await one('buyer', 'select count(*)::int n from kafaa_fitness_attempts')).n) === mine, `RLS: staff read only their own attempts (${mine})`);
  ok(Number((await one('buyer', 'select count(*)::int n from kafaa_fitness_items')).n) === 0 && Number((await one('training-mgr', 'select count(*)::int n from kafaa_fitness_items')).n) === items.length,
    'RLS: the item bank (with its key) is readable by training staff only');
  ok((await one('chco', 'select count(*)::int n from kafaa_fitness_attempts')).n === T.fitness_attempts.filter((a) => a.person_id === 'p-chco').length, 'RLS: HR reads no other person\'s attempts (aggregates only through the RPC)');

  const fl = (await one('buyer', 'select kafaa_ai_fluency() v')).v;
  ok(fl && fl.person_id === 'p-buyer' && fl.result.reasons.length > 0 && fl.target && typeof fl.target_met === 'boolean', `aiFluency (Own): rung ${fl?.result?.rung}, target rung ${fl?.target?.rung}, ${fl?.result?.reasons?.length} reasons`);
  ok((await one('alnoor-gm', 'select kafaa_ai_fluency() v')).v === null && await anonDenied('select kafaa_ai_fluency() v'), 'aiFluency: partners get nothing; anonymous visitors cannot execute it');
  ok((await one('buyer', 'select kafaa_ai_fluency_stats() v')).v === null && (await one('buyer', 'select kafaa_fitness_stats() v')).v === null, 'RBAC: staff without ai_literacy Agg get no aggregates');
  const hs = (await one('chco', 'select kafaa_ai_fluency_stats() v')).v;
  ok(hs && hs.staff > 10 && hs.distribution.every((d) => d.n == null || d.n >= 10) && hs.org_target?.pct === 60, `aiFluencyStats (HR Agg): ${hs?.practitioner?.pct}% at Practitioner or above vs the ${hs?.org_target?.pct}% leadership parameter; cells under 10 suppressed`);
  const fs = (await one('k-hr-analyst', 'select kafaa_fitness_stats() v')).v;
  ok(fs && fs.tested >= 10 && typeof fs.pct_above_basic === 'number', `fitnessStats (HR Agg): ${fs?.pct_above_basic}% of tested staff above basic`);

  const st = (await one('buyer', 'select kafaa_start_fitness() r')).r;
  ok(st.ok && st.data.item && st.data.item.correct === undefined && st.data.answered === 0, 'startFitness: an attempt opens with the first item, served without the answer key');
  const aid = st.data.attempt_id;
  const again = (await one('buyer', 'select kafaa_start_fitness() r')).r;
  ok(again.ok && again.data.resumed && again.data.attempt_id === aid, 'startFitness again: the open attempt resumes');
  const wrongItem = (await one('buyer', 'select kafaa_submit_fitness($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: 'fi-x', choice: 0 })])).r;
  const badChoice = (await one('buyer', 'select kafaa_submit_fitness($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: st.data.item.id, choice: 9 })])).r;
  const other = (await one('qc-inspector', 'select kafaa_submit_fitness($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: st.data.item.id, choice: 0 })])).r;
  ok(wrongItem.code === 'invalid' && badChoice.code === 'invalid' && other.code === 'not_found', 'submitFitness refuses another item, an out-of-range choice and another person\'s attempt');
  let step = st.data;
  let k = 0;
  const key = new Map(items.map((i) => [i.id, i.correct]));
  while (!step.done && k < 25) {
    const right = k % 3 !== 2;
    const choice = right ? key.get(step.item.id) : (key.get(step.item.id) + 1) % step.item.options_en.length;
    const r = (await one('buyer', 'select kafaa_submit_fitness($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: step.item.id, choice })])).r;
    if (!r.ok) break;
    step = r.data;
    k++;
  }
  ok(step.done && step.answered <= 20 && step.answered >= 18, `acceptance: the live check stops by its rule after ${step.answered} items (<= 20)`);
  const own = (await one('buyer', 'select responses, score, band from kafaa_fitness_attempts where id = $1', [aid]));
  const ts = scoreAttempt(areas, own.responses);
  ok(own.score === ts.score && own.band === ts.band && step.result.score === ts.score, `acceptance: server-side score ${own.score} (${own.band}) equals the TS rule`);
  await db.exec('reset role');
  const evRows = (await db.query(`select level, active, ref_id from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'fitness_attempts'`)).rows;
  ok(evRows.filter((e) => e.ref_id === aid).length === ts.evidence.length && evRows.every((e) => e.level <= 2), `acceptance: the check wrote ${ts.evidence.length} assessment evidence rows, none above level 2`);
  ok(evRows.filter((e) => e.active).every((e) => e.ref_id === aid), 'the latest check replaces earlier checks\' evidence (kept, inactive)');
  await db.query(`select kafaa_skills_apply('p-buyer', current_date)`);
  ok((await db.query(`select count(*)::int n from kafaa_skill_evidence where person_id = 'p-buyer' and ref_table = 'fitness_attempts' and ref_id = $1 and active`, [aid])).rows[0].n === ts.evidence.length,
    'F01 recompute keeps fitness evidence (recorded, not derived)');
  const ps = (await db.query(`select skill_id, level from kafaa_person_skills where person_id = 'p-buyer' and active and skill_id = any($1::text[])`, [ts.evidence.map((e) => e.skill_id)])).rows;
  ok(ps.length === ts.evidence.length, 'the evidence reaches the person\'s skill states');
  const soon = (await one('buyer', 'select kafaa_start_fitness() r')).r;
  const ctx = (await one('buyer', 'select kafaa_fitness_context() v')).v;
  ok(soon.code === 'too_soon' && /opens on \d{4}-\d{2}-01/.test(soon.message) && ctx.can_start === false && ctx.next_on, `one check per quarter: refused until ${ctx?.next_on}`);
  ok((await one('alnoor-gm', 'select kafaa_start_fitness() r')).r.code === 'forbidden' && await anonDenied('select kafaa_start_fitness() r'), 'startFitness: partners are refused; anonymous visitors cannot execute it');

  const base = { area_id: 'fa-ai-ethics', difficulty: 2, stem_en: 'Test stem', stem_ar: 'سؤال اختبار', options_en: ['a', 'b', 'c'], options_ar: ['أ', 'ب', 'ج'], correct: 1 };
  ok((await one('buyer', 'select kafaa_save_fitness_item($1::jsonb) r', [JSON.stringify(base)])).r.code === 'forbidden', 'saveFitnessItem: staff are refused (training manager writes items)');
  const add = (await one('training-mgr', 'select kafaa_save_fitness_item($1::jsonb) r', [JSON.stringify(base)])).r;
  ok(add.ok && add.data.version === 1, 'saveFitnessItem: the training manager adds an item');
  const bad = (await one('training-mgr', 'select kafaa_save_fitness_item($1::jsonb) r', [JSON.stringify({ ...base, stem_en: 'Describe the security plan' })])).r;
  ok(bad.code === 'invalid' && /plant security/.test(bad.message), 'saveFitnessItem: items touching plant security are refused');
  const it1 = items.find((i) => i.area_id === 'fa-ai-tech' && i.difficulty === 1);
  const ret = (await one('training-mgr', 'select kafaa_save_fitness_item($1::jsonb) r', [JSON.stringify({ ...it1, status: 'retired' })])).r;
  ok(ret.code === 'conflict', 'saveFitnessItem: retiring an item that would leave fewer than two in its area and difficulty is refused');
  const ed = (await one('training-mgr', 'select kafaa_save_fitness_item($1::jsonb) r', [JSON.stringify({ ...it1, explain_en: 'Edited explanation' })])).r;
  ok(ed.ok && ed.data.version === 2, 'saveFitnessItem: an edit increments the version');
  const audits = Number((await db.query(`select count(*)::int n from kafaa_audit_events where action like 'ai.fitness.%'`)).rows[0].n);
  ok(audits >= k + 6, `every fitness RPC writes an audit row (${audits})`);
  const fns = (await db.query(`select p.proname from pg_proc p where p.proname like 'kafaa\\_fit\\_%' or p.proname in ('kafaa_ai_rung', 'kafaa_ai_target_gap')`)).rows.map((r) => r.proname);
  const exec = [];
  for (const f of fns) if ((await db.query(`select has_function_privilege('authenticated', oid, 'execute') e from pg_proc where proname = $1 limit 1`, [f])).rows[0].e) exec.push(f);
  ok(exec.length === 0, `internal helpers are not executable by API roles (${fns.length} checked)`);
  ok(rungStats([], 10).practitioner.pct === null, 'rungStats: an empty group is suppressed');
}
