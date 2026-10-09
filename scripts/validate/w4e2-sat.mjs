// [W4 · E2 · F27, F29] PGlite checks for 20261009142001_kafaa_w4e2_sat.sql: SQL = TS parity of the DIF rule (all 125 triples),
// the proposals, the change impact, the role coverage, the programme evidence facts and the self-evaluation state; RLS on the M26
// tables (training staff and auditors only; an SME reads only their own ratings); restricted tasks never expose a title; and the
// RPC flows with the cards' acceptance criteria (insufficient ratings, overrides need a reason, a task change opens one review
// item per linked course and standard, a standard item closes as revised only after kafaa_revise_standard, the sole author
// cannot finalise, gaps need owners, finalised self-evaluations are frozen).
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { difDecision, proposal, changeImpact, RESTRICTED_TITLE } from '../../src/modules/m26/sat.ts';
import { selfEvalState, suggestFor } from '../../src/modules/m26/accr.ts';
import { evidenceFacts, roleCoverage } from '../../src/modules/m26/evidence.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v));
const day = (v) => (v == null ? v : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export default async function w4e2Checks({ db, as, one, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 4220;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['sme-reviewer', 'SME reviewer'], ['head-sq', 'Head of Supplier Quality'], ['qc-inspector', 'QC Inspector']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W4E2 · F27 SAT analysis workbench, F29 accreditation readiness');
  const TODAY = '2026-10-08';

  // ── parity on a pristine database
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const dd = [];
  for (let d = 1; d <= 5; d++) for (let i = 1; i <= 5; i++) for (let f = 1; f <= 5; f++) {
    const s = (await fq('select kafaa_sat_decision($1, $2, $3) j', [d, i, f]))[0].j;
    if (canon(s) !== canon(difDecision(d, i, f))) dd.push(`${d}${i}${f}`);
  }
  ok(dd.length === 0, `SQL DIF rule equals difDecision() for all 125 triples${dd.length ? ` (first diff ${dd[0]})` : ''}`);
  const pd = [];
  for (const t of T.jta_tasks) {
    const s = (await fq('select kafaa_sat_proposal($1) j', [t.id]))[0].j;
    if (canon(s) !== canon(proposal(T.dif_ratings.filter((r) => r.task_id === t.id)))) pd.push(t.id);
  }
  ok(pd.length === 0, `SQL proposal equals proposal() for ${T.jta_tasks.length} tasks${pd.length ? ` (first diff ${pd[0]})` : ''}`);
  const idf = [];
  for (const t of T.jta_tasks) {
    const s = (await fq('select kafaa_sat_impact_compute($1) j', [t.id]))[0].j;
    const ts = changeImpact({ task: t, links: T.task_objectives, objectives: T.sat_objectives, courses: T.courses, jpms: T.jpms, standards: T.qual_standards, items: T.items });
    if (canon(s) !== canon(ts)) idf.push(t.id);
  }
  ok(idf.length === 0, `SQL change impact equals changeImpact() for ${T.jta_tasks.length} tasks${idf.length ? ` (first diff ${idf[0]})` : ''}`);
  const trace = { tasks: T.jta_tasks, links: T.task_objectives, objectives: T.sat_objectives, roleComps: T.role_competencies, courses: T.courses };
  const cd = [];
  for (const a of T.jta_analyses) {
    const s = (await fq('select kafaa_sat_role_cov($1) j', [a.role_id]))[0].j;
    const c = roleCoverage(a.role_id, trace);
    if (canon(s) !== canon({ tasks: c.rows.length, selected: c.selected, covered: c.covered, gaps: c.gaps.length, orphans: c.orphans.length })) cd.push(a.role_id);
  }
  ok(cd.length === 0, `SQL role coverage equals roleCoverage() for ${T.jta_analyses.length} job analyses${cd.length ? ` (first diff ${cd[0]})` : ''}`);
  const ed = [];
  for (const p of T.accr_programmes) {
    const s = (await fq('select kafaa_accr_evidence_compute($1, $2::date) j', [p.id, TODAY]))[0].j;
    const ts = evidenceFacts({
      programme: p, analyses: T.jta_analyses, ...trace, items: T.items, forms: T.assessment_forms, attempts: T.attempts, evaluatorQuals: T.evaluator_quals, qualRecords: T.qual_records,
      evaluations: T.evaluations, trainingRecords: T.training_records, sessions: T.sessions, l3: T.l3_observations ? T.l3_observations : null, tracks: T.instructor_tracks ?? null,
    }, TODAY);
    if (canon(s) !== canon(ts)) ed.push(p.id);
    for (const c of T.accr_criteria) if (!suggestFor(c.evidence_kinds, ts).length) ed.push(`${p.id}/${c.id}`);
  }
  ok(ed.length === 0, `SQL evidence facts equal evidenceFacts() for ${T.accr_programmes.length} programmes, and every criterion has a suggestion or "no evidence found"${ed.length ? ` (first diff ${ed[0]})` : ''}`);
  const sd = [];
  for (const se of T.accr_selfevals) {
    const s = (await fq('select kafaa_accr_state($1) j', [se.id]))[0].j;
    if (canon(s) !== canon(selfEvalState(T.accr_assessments.filter((a) => a.selfeval_id === se.id), T.accr_criteria.length))) sd.push(se.id);
    if (se.readiness !== s.readiness) sd.push(`${se.id}:readiness`);
  }
  ok(sd.length === 0, `SQL self-evaluation state equals selfEvalState() for ${T.accr_selfevals.length} self-evaluations${sd.length ? ` (first diff ${sd[0]})` : ''}`);
  // restricted placeholders: the trigger forces the generic title, even for a direct (owner) write
  await fresh.exec(`insert into kafaa_jta_tasks (id, role_id, code, title_en, title_ar, restricted, created_at, changed_at) values ('jt-x-r', 'security-officer', 'X', 'Patrol route at the protected area', 'دورية', true, now(), now())`);
  const xr = (await fq(`select title_en, title_ar from kafaa_jta_tasks where id = 'jt-x-r'`))[0];
  ok(xr.title_en === RESTRICTED_TITLE.en && xr.title_ar === RESTRICTED_TITLE.ar, 'a restricted task stores only the generic "Restricted task — managed outside Kafa\'a" title (trigger)');
  await fresh.close();
  ok(T.jta_tasks.filter((t) => t.restricted).every((t) => t.title_en === RESTRICTED_TITLE.en && !T.dif_ratings.some((r) => r.task_id === t.id) && !T.task_objectives.some((l) => l.task_id === t.id)),
    'seeded restricted tasks carry no title, no DIF rating and no link');
  ok(!/\bINPO\b|\bACAD\b/i.test(JSON.stringify(T.accr_criteria.map((c) => [c.title_en, c.guidance_en]))) && T.accr_criteria.every((c) => c.sources.some((s) => /iaea|fanr/i.test(s.url))),
    'criteria text is generic (no INPO / ACAD copy) and sourced to public IAEA SAT guidance and FANR-REG-16');

  // ── RLS: training staff and auditors only; an SME reads only their own ratings
  const TABLES = ['kafaa_jta_analyses', 'kafaa_jta_tasks', 'kafaa_dif_ratings', 'kafaa_sat_objectives', 'kafaa_task_objectives', 'kafaa_sat_changes', 'kafaa_sat_change_items', 'kafaa_accr_criteria', 'kafaa_accr_programmes', 'kafaa_accr_selfevals', 'kafaa_accr_assessments'];
  for (const tb of TABLES) {
    const total = Number((await q(`select count(*)::int n from ${tb}`))[0].n);
    const own = tb === 'kafaa_dif_ratings' ? Number((await q(`select count(*)::int n from ${tb} where rater_person_id = 'p-k-ro'`))[0].n) : 0;
    ok((await count(null, tb)) === 0 && (await count('k-ro', tb)) === own && (await count('chco', tb)) === 0 && (await count('alnoor-gm', tb)) === 0 && (await count('k-observer', tb)) === 0
      && (await count('k-instructor', tb)) === total && (await count('training-mgr', tb)) === total && (await count('k-auditor', tb)) === total,
      `${tb}: training staff and auditors read all ${total} rows; anonymous visitors, employees (own DIF ratings only), HR, partners and observers none`);
  }
  for (const fn of ['kafaa_sat_decision(1,1,1)', `kafaa_sat_proposal('x')`, `kafaa_accr_state('x')`, `kafaa_accr_evidence_compute('loit', current_date)`]) {
    let refused = false;
    try { await as('training-mgr', `select ${fn}`); } catch { refused = true; }
    ok(refused, `internal helper ${fn.split('(')[0]} is not executable by API roles`);
  }

  // ── F27 flows
  const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const r1 = (await one('k-ro', `select kafaa_rate_dif('jt-qs-ro-t4', 2, 2, 2, '') r`)).r;
  ok(!r1.ok && r1.code === 'forbidden', 'an employee without SAT rights or an SME profile cannot rate (forbidden)');
  const engTask = T.jta_tasks.find((t) => t.role_id === 'systems-design-plant-engineer' && !t.restricted).id;
  const r2 = (await one('sme-reviewer', `select kafaa_rate_dif($1, 3, 4, 2, 'from the survey') r`, [engTask])).r;
  ok(r2.ok && r2.data.proposal.n >= 1, 'an SME who holds the role rates a task while the DIF survey is open');
  ok((await count('sme-reviewer', 'kafaa_dif_ratings')) === 1 && (await count('sme-reviewer', 'kafaa_jta_tasks')) === 0, 'the SME reads only their own rating and no other SAT row');
  const r3 = (await one('sme-reviewer', `select kafaa_rate_dif('jt-qs-ro-t4', 3, 3, 3, '') r`)).r;
  ok(!r3.ok && r3.code === 'forbidden', 'an SME cannot rate tasks of another role');
  const sv = (await one('sme-reviewer', 'select kafaa_dif_survey() s')).s;
  ok(sv.open && sv.tasks.length > 0 && sv.tasks.some((t) => t.mine), 'the SME sees the open survey for their role with their own rating');
  const insuff = T.jta_tasks.find((t) => !t.restricted && T.dif_ratings.filter((r) => r.task_id === t.id).length === 0);
  const r4 = (await one('training-mgr', `select kafaa_decide_training($1, 'train', '') r`, [insuff.id])).r;
  ok(!r4.ok && r4.code === 'insufficient_ratings', 'no training decision before 3 SME ratings (insufficient_ratings)');
  const prop = T.jta_tasks.find((t) => !t.restricted && t.decision === 'pending' && proposal(T.dif_ratings.filter((r) => r.task_id === t.id)).status === 'proposed' && t.role_id !== 'systems-design-plant-engineer');
  const pdx = proposal(T.dif_ratings.filter((r) => r.task_id === prop.id)).decision;
  const other = pdx === 'no_train' ? 'train' : 'no_train';
  const r5 = (await one('k-instructor', `select kafaa_decide_training($1, $2, '') r`, [prop.id, pdx])).r;
  ok(!r5.ok && r5.code === 'forbidden', 'an instructor cannot take the training decision (training manager only)');
  const r6 = (await one('training-mgr', `select kafaa_decide_training($1, $2, 'short') r`, [prop.id, other])).r;
  ok(!r6.ok && r6.code === 'note_required', 'an override of the DIF rule without a reason is refused (note_required)');
  const l0 = await led();
  const r7 = (await one('training-mgr', `select kafaa_decide_training($1, $2, 'Committee asked for a hands-on session after OE') r`, [prop.id, other])).r;
  ok(r7.ok && r7.data.override === true && (await led()) === l0 + 1, 'the training manager overrides with a reason; the decision is ledgered');
  const r8 = (await one('training-mgr', `select kafaa_rate_dif('jt-security-officer-r1', 3, 3, 3, '') r`)).r;
  const r9 = (await one('training-mgr', `select kafaa_link_objective('{"task_id":"jt-security-officer-r1","objective_ref":"obj-c-get-1"}'::jsonb) r`)).r;
  const r10 = (await one('training-mgr', `select kafaa_save_jta_task('{"role_id":"security-officer","title_en":"Patrol the protected area","title_ar":"دورية المنطقة المحمية"}'::jsonb) r`)).r;
  ok(r8.code === 'restricted' && r9.code === 'restricted' && r10.code === 'restricted', 'restricted tasks refuse ratings and links, and security roles refuse new tasks (restricted)');
  const auditorTry = (await one('k-auditor', `select kafaa_rate_dif('jt-qs-ro-t4', 2, 2, 2, '') r`)).r;
  ok(!auditorTry.ok && auditorTry.code === 'forbidden', 'auditors read but cannot write (forbidden)');
  // coverage gap closes when an objective is linked
  const gapTask = T.jta_tasks.find((t) => t.id === 'jt-local-operator-g2');
  const cov0 = (await one('training-mgr', `select kafaa_sat_role_cov('local-operator') j`).catch(() => null));
  const covBefore = (await q(`select kafaa_sat_role_cov('local-operator') j`))[0].j;
  const lk = (await one('k-instructor', `select kafaa_link_objective('{"task_id":"jt-local-operator-g2","objective_ref":"obj-c-loit-ojt-1"}'::jsonb) r`)).r;
  const covAfter = (await q(`select kafaa_sat_role_cov('local-operator') j`))[0].j;
  ok(cov0 === null && gapTask && lk.ok && covAfter.gaps === covBefore.gaps - 1, 'linking an objective closes the coverage gap of a train-selected task');
  const lk2 = (await one('k-instructor', `select kafaa_link_objective('{"task_id":"jt-local-operator-g2","objective_ref":"obj-c-loit-ojt-1"}'::jsonb) r`)).r;
  ok(!lk2.ok && lk2.code === 'conflict', 'a duplicate link is refused (conflict)');
  // change impact: one review item per linked course and standard
  const ct = 'jt-qs-ro-t1';
  const imp = (await one('k-instructor', `select kafaa_sat_impact($1) j`, [ct])).j;
  const l1 = await led();
  const ch = (await one('k-instructor', `select kafaa_open_sat_change($1::jsonb) r`, [JSON.stringify({ task_id: ct, kind: 'modified', summary: 'Start-up procedure revised: new hold point at criticality', trigger: 'regulatory' })])).r;
  const items = await q('select * from kafaa_sat_change_items where change_id = $1 order by sort', [ch.data.id]);
  ok(ch.ok && imp.courses.length + imp.standards.length === ch.data.items && items.length === ch.data.items
    && imp.courses.every((c) => items.some((x) => x.kind === 'course' && x.ref_id === c.id)) && imp.standards.every((s) => items.some((x) => x.kind === 'standard' && x.ref_id === s.id)) && (await led()) === l1 + 1,
    `a task change lists ${imp.courses.length} courses and ${imp.standards.length} standards and opens one review item each (ledgered)`);
  ok(imp.items.every((it) => Object.keys(it).sort().join() === 'bank,difficulty,id,status,topic'), 'assessment items appear as metadata only (no stem, options or key)');
  const ch2 = (await one('k-instructor', `select kafaa_open_sat_change($1::jsonb) r`, [JSON.stringify({ task_id: ct, kind: 'retired', summary: 'Second change while the first is open' })])).r;
  ok(!ch2.ok && ch2.code === 'conflict', 'a second open change on the same task is refused (conflict)');
  const stdItem = items.find((x) => x.kind === 'standard');
  const nr = (await one('k-instructor', `select kafaa_resolve_sat_change_item($1, 'revised', '') r`, [stdItem.id])).r;
  ok(!nr.ok && nr.code === 'not_revised', 'a standard item closes as revised only after the standard is revised (not_revised)');
  const rev = (await one('training-mgr', `select kafaa_revise_standard($1, 'SAT change: new hold point') r`, [stdItem.ref_id])).r;
  for (const it of items.filter((x) => x.kind === 'course')) await one('k-instructor', `select kafaa_resolve_sat_change_item($1, 'updated', 'Lesson plan updated') r`, [it.id]);
  const l2 = await led();
  const done = (await one('k-instructor', `select kafaa_resolve_sat_change_item($1, 'revised', '') r`, [stdItem.id])).r;
  ok(rev.ok && done.ok && done.data.change_status === 'closed' && done.data.revision_id === rev.data.new_id && (await led()) === l2 + 1, 'reviseStandard is reused; the last item closes the change (ledgered)');

  // ── F29 flows
  const g = (await one('k-instructor', `select kafaa_rate_criterion('{"selfeval_id":"ase-loit-2026-H2","criterion_id":"ac-qi-3","rating":2,"evidence":[]}'::jsonb) r`)).r;
  ok(!g.ok && g.code === 'invalid', 'a gap (rating 1 or 2) without an owner and a due date is refused');
  const due = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const g2 = (await one('k-instructor', `select kafaa_rate_criterion($1::jsonb) r`, [JSON.stringify({ selfeval_id: 'ase-loit-2026-H2', criterion_id: 'ac-qi-3', rating: 2, evidence: [{ kind: 'instructor_quals', ref: 'loit', route: '/training/quals/qs-instr', label_en: 'x', label_ar: 'س' }], owner_role: 'instructors', due_on: due, gap_en: 'Observation programme not yet in place' })])).r;
  ok(g2.ok && typeof g2.data.readiness === 'number', 'a gap with an owner, a due date and an evidence link is saved; readiness recomputed');
  const bad = (await one('k-instructor', `select kafaa_rate_criterion('{"selfeval_id":"ase-loit-2026-H2","criterion_id":"ac-qi-3","rating":4,"evidence":[{"kind":"secret","ref":"x","route":"/x","label_en":"","label_ar":""}]}'::jsonb) r`)).r;
  ok(!bad.ok && bad.code === 'invalid', 'evidence of an unknown kind is refused');
  const sole = (await one('training-mgr', `select kafaa_finalise_self_eval('ase-chem-init-2026-H2') r`)).r;
  ok(!sole.ok && sole.code === 'maker_checker', 'a self-evaluation cannot be finalised by its sole author (maker_checker)');
  const inc = (await one('training-mgr', `select kafaa_finalise_self_eval('ase-loit-2026-H2') r`)).r;
  ok(!inc.ok && inc.code === 'incomplete', 'a self-evaluation with unrated criteria cannot be finalised (incomplete)');
  const notTm = (await one('k-instructor', `select kafaa_finalise_self_eval('ase-coit-2026-H2') r`)).r;
  ok(!notTm.ok && notTm.code === 'forbidden', 'only the training manager finalises');
  const l3 = await led();
  const fin = (await one('training-mgr', `select kafaa_finalise_self_eval('ase-coit-2026-H2') r`)).r;
  ok(fin.ok && fin.data.status === 'finalised' && (await led()) === l3 + 1, 'the training manager finalises a self-evaluation another member of staff co-authored (ledgered)');
  const frozen = (await one('k-instructor', `select kafaa_rate_criterion('{"selfeval_id":"ase-coit-2026-H2","criterion_id":"ac-pi-1","rating":4,"evidence":[]}'::jsonb) r`)).r;
  ok(!frozen.ok && frozen.code === 'invalid', 'a finalised self-evaluation is frozen');
  const op = (await one('k-instructor', `select kafaa_open_self_eval('rp-init') r`)).r;
  const op2 = (await one('k-instructor', `select kafaa_open_self_eval('rp-init') r`)).r;
  ok(op.ok && !op2.ok && op2.code === 'conflict', 'opening a self-evaluation for the current cycle works once (conflict on the second)');
  const ev = (await one('k-auditor', `select kafaa_accr_evidence('coit') j`)).j;
  const evNo = (await one('k-ro', `select kafaa_accr_evidence('coit') j`)).j;
  ok(ev && ev.facts.length > 0 && ev.facts.every((f) => !JSON.stringify(f).match(/"(w|p)-[a-z0-9-]+"/)) && evNo === null, 'evidence facts are counts only (no person ids), for SAT readers only');
  const audits = await q(`select outcome from kafaa_audit_events where action like 'sat.%' or action like 'accr.%'`);
  ok(audits.some((a) => a.outcome === 'refused') && audits.some((a) => a.outcome === 'ok'), 'every SAT and accreditation RPC writes an audit row, refusals included');
}
