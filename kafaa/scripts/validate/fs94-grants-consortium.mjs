// [FS wave I · E4 · FS82 + FS83] PGlite checks for 20261010294001_kafaa_fs94_grants_consortium.sql (M36 Skills Ecosystem).
// Seed (contiguous bi-monthly rounds, every application and decision passes the rules, budgets kept, no seeded F01 evidence; consortium
// partners synthetic and labelled, members within seats with cross-employer mentors, visits confirmed by hosts only); SQL = TS parity
// on the database state and on generated cases: kafaa_gr_next_deadline / kafaa_gr_slot / kafaa_gr_phase (fixed clock, many days),
// kafaa_gr_eligibility (every person, three days), kafaa_gr_app_problem / decision / output / schedule problems, kafaa_gr_stats =
// grantStats; kafaa_cc_phase / org / code / enec_eligible, kafaa_cc_nom_problem / decision / visit problems, kafaa_cc_level =
// visitLevel, kafaa_cc_route = confirmRoute, kafaa_cc_stats = consortiumStats; RLS per persona (each partner reads only its own
// trainees and their visits); the fourteen RPCs with their RBAC, refusals, audit and ledger rows and evidence written only after host
// confirmation or HR acceptance (flows inside a rolled-back transaction); grants; additivity. Prints the md5 of every new function body
// and the row digest of every new table for the live check.
import { readFileSync } from 'node:fs';
import {
  addDays, applicationProblem, costTotal, decisionProblem, eligibility, grantStats, nextDeadline, nextRoundSlot, outputProblem, roundPhase, scheduleProblem, fullYears,
} from '../../src/modules/m36/grants.ts';
import {
  cohortPhase, confirmRoute, consortiumOrg, consortiumStats, enecTraineeEligible, memberDecisionProblem, nominationProblem, partnerOf, traineeCode, visitLevel, visitProblem,
} from '../../src/modules/m36/consortium.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const MIG = 'supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql';
const TABLES = ['grant_rounds', 'grant_applications', 'consortium_cohorts', 'consortium_members', 'consortium_visits'];
const FUNCS = ['kafaa_gr_next_deadline', 'kafaa_gr_slot', 'kafaa_gr_phase', 'kafaa_gr_schedule_problem', 'kafaa_gr_full_years', 'kafaa_gr_eligibility', 'kafaa_gr_cost_total', 'kafaa_gr_app_problem',
  'kafaa_gr_decision_problem', 'kafaa_gr_output_problem', 'kafaa_gr_cell', 'kafaa_gr_rate', 'kafaa_gr_stats', 'kafaa_schedule_grant_round', 'kafaa_apply_grant', 'kafaa_withdraw_grant', 'kafaa_decide_grant',
  'kafaa_submit_grant_output', 'kafaa_review_grant_output', 'kafaa_grant_stats', 'kafaa_cc_is_enec', 'kafaa_cc_partner', 'kafaa_cc_org', 'kafaa_cc_phase', 'kafaa_cc_code', 'kafaa_cc_enec_eligible',
  'kafaa_cc_nom_problem', 'kafaa_cc_decision_problem', 'kafaa_cc_visit_problem', 'kafaa_cc_level', 'kafaa_cc_route', 'kafaa_cc_stats', 'kafaa_nominate_consortium_trainee',
  'kafaa_decide_consortium_member', 'kafaa_log_consortium_visit', 'kafaa_confirm_consortium_visit', 'kafaa_withdraw_consortium_visit', 'kafaa_consortium_host_visits', 'kafaa_consortium_stats'];
const RPCS = ["kafaa_schedule_grant_round('{}'::jsonb)", "kafaa_apply_grant('{}'::jsonb)", "kafaa_withdraw_grant('x')", "kafaa_decide_grant('{}'::jsonb)", "kafaa_submit_grant_output('{}'::jsonb)",
  "kafaa_review_grant_output('{}'::jsonb)", 'kafaa_grant_stats()', "kafaa_nominate_consortium_trainee('{}'::jsonb)", "kafaa_decide_consortium_member('{}'::jsonb)", "kafaa_log_consortium_visit('{}'::jsonb)",
  "kafaa_confirm_consortium_visit('{}'::jsonb)", "kafaa_withdraw_consortium_visit('x')", 'kafaa_consortium_host_visits()', 'kafaa_consortium_stats()'];

export default async function fs94Checks({ db, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  console.log('FS wave I · E4 · FS82 Rolling mobility micro-grants + FS83 UAE energy consortium trainee cohort (M36)');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/(_at|^ts)$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : k === 'hours' && v != null ? Number(v) : v]));
  const rows = async (t) => (await q(`select * from kafaa_${t} order by id`)).map(fix);
  // test identities beyond the shared set (fixed uids 9401..; the persona's person row decides the roles)
  const extra = [['alnoor-qaqc', 'org-alnoor', 'partner', ['Al Noor QA/QC Lead']], ['buyer', 'enec-ops', 'employee', ['Buyer']], ['nse', 'enec-ops', 'employee', ['NSE']],
    ['qc-inspector', 'enec-ops', 'employee', ['QC Inspector']], ['k-lo-trainee', 'enec-ops', 'employee', ['Local Operator trainee']], ['outage-planner', 'enec-ops', 'employee', ['Outage Planner']]];
  for (const [i, [persona, org, lens, roles]] of extra.entries()) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-00000000940${i + 1}`;
    await q('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, org, lens, roles]);
  }
  const today = (await q('select current_date::text d'))[0].d;
  const skills = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  const D = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await rows(t)])));
  const cohortOf = Object.fromEntries(D.consortium_cohorts.map((c) => [c.id, c]));
  const roundOf = Object.fromEntries(D.grant_rounds.map((r) => [r.id, r]));

  // ── seed sanity and acceptance on the seed
  const rs = D.grant_rounds.slice().sort((a, b) => (a.closes_on < b.closes_on ? -1 : 1));
  ok(rs.length === 4 && rs.every((r, i) => i === 0 || same(nextRoundSlot(rs[i - 1].closes_on, rs[i - 1].closes_on), { id: r.id, opens_on: r.opens_on, closes_on: r.closes_on, decide_by: r.decide_by }))
    && rs.every((r) => r.simulated && r.decide_by === addDays(r.closes_on, 14)),
  'seed (FS82): four bi-monthly rounds, each the next contiguous slot after the previous deadline (10th of an even month, decisions 14 days later), budgets SIMULATED');
  const apps = D.grant_applications;
  ok(apps.every((a) => applicationProblem(a, { closes_on: roundOf[a.round_id].closes_on, max_award: roundOf[a.round_id].max_award, skills }) === null && a.amount === costTotal(a.costs))
    && rs.every((r) => apps.filter((a) => a.round_id === r.id && a.status === 'approved').reduce((m, a) => m + a.awarded, 0) <= r.budget)
    && apps.filter((a) => a.decided_at).every((a) => roundPhase(roundOf[a.round_id], a.decided_at.slice(0, 10)) === 'closed' && a.decided_by !== a.person_id),
  `seed (FS82): ${apps.length} applications pass the application check; every decision came after its deadline, never by the applicant, within the SIMULATED budget`);
  const seededEvidence = (await q("select count(*)::int n from kafaa_skill_evidence where ref_table in ('grant_applications', 'consortium_visits')"))[0].n;
  ok(seededEvidence === 0 && apps.every((a) => a.output_status !== 'accepted' || !a.profile_evidence) && D.consortium_visits.every((v) => v.status !== 'confirmed' || (!v.profile_evidence && !v.person_id)),
    'seed: no F01 evidence is seeded (accepted outputs and confirmed visits belong to placement students and partner trainees only; staff evidence appears when HR or a host confirms)');
  const synthOrgs = T.organisations.filter((o) => ['org-cx-grid', 'org-cx-solar', 'org-cx-h2'].includes(o.id));
  ok(synthOrgs.length === 3 && synthOrgs.every((o) => o.synthetic && o.category === 'synthetic' && !o.public_listed && /\(synthetic\)/.test(o.name_en))
    && D.consortium_cohorts.every((c) => c.synthetic && c.simulated && c.partners.filter((p) => p.org_id !== 'enec-ops').every((p) => p.synthetic && /\((synthetic)\)/.test(p.name_en))),
  'acceptance (FS83): partner organisations are synthetic and labelled as such (three new synthetic employers plus the synthetic suppliers), cohorts SIMULATED');
  const mem = D.consortium_members;
  ok(D.consortium_cohorts.every((c) => c.partners.every((p) => mem.filter((m) => m.cohort_id === c.id && consortiumOrg(c, m.org_id) === p.org_id && ['nominated', 'accepted'].includes(m.status)).length <= p.seats))
    && mem.filter((m) => m.status === 'accepted').every((m) => memberDecisionProblem({ decision: 'accept', mentor_id: m.mentor_id, team: m.team }, m, cohortOf[m.cohort_id]) === null)
    && mem.every((m) => (m.org_id === 'enec-ops') === !!m.person_id),
  `seed (FS83): ${mem.length} members within seats; every accepted trainee has a mentor from another organisation and a team; only ENEC trainees carry a person id`);
  const vis = D.consortium_visits;
  ok(vis.filter((v) => v.status === 'confirmed').every((v) => v.decided_by && v.decided_by !== v.logged_by && v.decided_by !== v.person_id && (v.confirmed_via !== 'on_behalf' || v.host_ref))
    && vis.every((v) => v.host_org_id !== v.org_id && v.skill_id === partnerOf(cohortOf[v.cohort_id], v.host_org_id).visit_skill),
  'seed (FS83): every visit is cross-site; every confirmation is by the host side, never the logger or the visitor, on-behalf ones carry the host reference');

  // ── parity: rounds and the fixed clock
  const days = ['2026-01-01', '2026-02-09', '2026-02-10', '2026-02-11', '2026-06-10', '2026-06-11', '2026-08-10', '2026-08-11', '2026-10-10', '2026-10-11', '2026-10-12', '2026-12-10', '2026-12-11', '2026-12-31', '2027-02-28', today];
  let bad = [];
  for (const d of days) {
    const r = (await q('select kafaa_gr_next_deadline($1::date)::text n, kafaa_gr_slot($1::date, $1::date) s, kafaa_gr_slot(null, $1::date) s0', [d]))[0];
    if (r.n !== nextDeadline(d) || !same(r.s, nextRoundSlot(d, d)) || !same(r.s0, nextRoundSlot(null, d))) bad.push(`slot ${d}`);
    for (const x of D.grant_rounds) if ((await q('select kafaa_gr_phase($1::date, $2::date, $3::date) p', [x.opens_on, x.closes_on, d]))[0].p !== roundPhase(x, d)) bad.push(`${x.id}@${d}`);
  }
  const gapSlot = (await q("select kafaa_gr_slot('2026-06-10'::date, '2026-10-12'::date) s"))[0].s;
  ok(bad.length === 0 && same(gapSlot, nextRoundSlot('2026-06-10', '2026-10-12')) && roundPhase(roundOf['gr-2026-12'], '2026-10-10') === 'scheduled' && roundPhase(roundOf['gr-2026-12'], '2026-10-11') === 'open'
    && roundPhase(roundOf['gr-2026-12'], '2026-12-10') === 'open' && roundPhase(roundOf['gr-2026-12'], '2026-12-11') === 'closed',
  `acceptance (FS82): rounds open and close on schedule: SQL kafaa_gr_phase / kafaa_gr_slot / kafaa_gr_next_deadline = TS for ${days.length} fixed days x ${D.grant_rounds.length} rounds (opens 11 Oct, open on the 10 Dec deadline, closed on 11 Dec)${bad.length ? ` (${bad.slice(0, 5).join(', ')})` : ''}`);
  // eligibility
  bad = [];
  const placement = new Set(T.scholars.filter((s) => s.status === 'in_study').map((s) => s.person_id));
  for (const d of ['2026-10-12', '2027-01-01', '2028-06-30']) for (const p of T.people) {
    const pl = placement.has(p.id);
    const s = (await q('select kafaa_gr_eligibility($1, $2::date, $3) e', [p.id, d, pl]))[0].e;
    const t = eligibility(p, d, pl);
    if (s.eligible !== t.eligible || s.basis !== t.basis || (s.years ?? null) !== (t.years ?? null)) bad.push(`${p.id}@${d}`);
  }
  const fy = (await q("select kafaa_gr_full_years('2016-10-12'::date, '2026-10-11'::date) a, kafaa_gr_full_years('2016-10-12'::date, '2026-10-12'::date) b"))[0];
  ok(bad.length === 0 && fy.a === fullYears('2016-10-12', '2026-10-11') && fy.b === 10, `eligibility: SQL kafaa_gr_eligibility = TS eligibility for ${T.people.length} people x 3 days (early career under 10 years since hire; placement students)${bad.length ? ` (${bad.slice(0, 5).join(', ')})` : ''}`);
  // application checks
  const base = { kind: 'conference', title: 'Grid flexibility conference', purpose: 'Learn how flexible operation changes plant duties for operators.', destination: 'Regional conference (sample)',
    starts_on: '2027-01-12', ends_on: '2027-01-14', costs: [{ item: 'transport', amount: 3000 }, { item: 'registration', amount: 2000 }], skill_id: 'sk-fs-gr-grid', output_kind: 'presentation' };
  const probes = [base, { ...base, kind: 'degree' }, { ...base, kind: 5 }, { ...base, title: 'abc' }, { ...base, title: 'Call me on +971 50 123 4567' }, { ...base, purpose: 'too short' },
    { ...base, purpose: 'write to someone@example.com for the details please' }, { ...base, destination: 'x' }, { ...base, starts_on: '2026-12-10' }, { ...base, starts_on: '2027-06-09', ends_on: '2027-06-10' },
    { ...base, ends_on: '2027-01-11' }, { ...base, ends_on: '2027-02-14' }, { ...base, starts_on: '2027-02-30' }, { ...base, starts_on: 20270112 }, { ...base, costs: [] },
    { ...base, costs: [{ item: 'transport', amount: 100 }] }, { ...base, costs: [{ item: 'transport', amount: 9000 }, { item: 'subsistence', amount: 7000 }] },
    { ...base, costs: [{ item: 'transport', amount: 1000 }, { item: 'transport', amount: 1000 }] }, { ...base, costs: [{ item: 'visa', amount: 1000 }] }, { ...base, costs: [{ item: 'transport', amount: 1000.5 }] },
    { ...base, costs: [{ item: 'transport', amount: -5 }, { item: 'registration', amount: 900 }] }, { ...base, costs: 'x' }, { ...base, costs: [1, 2] }, { ...base, skill_id: 'sk-sa-01' }, { ...base, skill_id: 'nope' },
    { ...base, skill_id: T.skills.find((s) => s.lifecycle === 'obsolete')?.id ?? 'nope' }, { ...base, output_kind: 'video' }, null, {}];
  const r12 = roundOf['gr-2026-12'];
  bad = [];
  for (const [i, p] of probes.entries()) {
    const s = (await q('select kafaa_gr_app_problem($1::jsonb, $2::date, $3) c', [JSON.stringify(p), r12.closes_on, r12.max_award]))[0].c;
    if ((applicationProblem(p, { closes_on: r12.closes_on, max_award: r12.max_award, skills }) ?? null) !== s) bad.push(`${i}:${s}`);
  }
  for (const a of apps) if ((await q('select kafaa_gr_app_problem($1::jsonb, $2::date, $3) c', [JSON.stringify(a), roundOf[a.round_id].closes_on, roundOf[a.round_id].max_award]))[0].c !== null) bad.push(a.id);
  ok(bad.length === 0, `application check: SQL kafaa_gr_app_problem = TS applicationProblem for ${probes.length} probes and ${apps.length} seeded applications${bad.length ? ` (${bad.slice(0, 6).join(', ')})` : ''}`);
  // decision, output, schedule checks
  const app = { amount: 9000, ends_on: '2026-11-03' };
  const dprobes = [[{ decision: 'approve' }, '2026-10-12'], [{ decision: 'approve' }, '2026-10-01'], [{ decision: 'maybe' }, '2026-10-12'], [{ decision: 'decline' }, '2026-10-12'], [{ decision: 'decline', note: 'Not linked to the role yet.' }, '2026-10-12'],
    [{ decision: 'approve', award: 400 }, '2026-10-12'], [{ decision: 'approve', award: 9500 }, '2026-10-12'], [{ decision: 'approve', award: 8000.5 }, '2026-10-12'], [{ decision: 'approve', award: '8000' }, '2026-10-12'],
    [{ decision: 'approve', award: 8000 }, '2026-10-12'], [{ decision: 'approve', note: 'x'.repeat(301) }, '2026-10-12'], [null, '2026-10-12']];
  const r10 = roundOf['gr-2026-10'];
  bad = [];
  for (const [committed, set] of [[0, dprobes], [113000, [[{ decision: 'approve' }, '2026-10-12'], [{ decision: 'approve', award: 7000 }, '2026-10-12']]]]) for (const [p, d] of set) {
    const s = (await q('select kafaa_gr_decision_problem($1::jsonb, $2, $3::date, $4::date, $5, $6, $7, $8::date) c', [JSON.stringify(p), app.amount, r10.opens_on, r10.closes_on, r10.max_award, r10.budget, committed, d]))[0].c;
    if ((decisionProblem(p, app, r10, committed, d) ?? null) !== s) bad.push(`${JSON.stringify(p)}@${d}/${committed}:${s}`);
  }
  const oprobes = [[{ kind: 'report', title: 'What I learned at the course', summary: 'Main points and one change I will propose to my section.' }, '2026-11-03'],
    [{ kind: 'report', title: 'What I learned at the course', summary: 'Main points and one change I will propose to my section.' }, '2026-11-02'], [{ kind: 'video' }, '2026-11-10'],
    [{ kind: 'presentation', title: 'abc', summary: 'x'.repeat(30) }, '2026-11-10'], [{ kind: 'presentation', title: 'Briefing deck', summary: 'short' }, '2026-11-10'],
    [{ kind: 'presentation', title: 'Briefing deck', summary: 'Contact me at a.b@example.com for the slides please' }, '2026-11-10'], [null, '2026-11-10']];
  for (const [p, d] of oprobes) {
    const s = (await q('select kafaa_gr_output_problem($1::jsonb, $2::date, $3::date) c', [JSON.stringify(p), app.ends_on, d]))[0].c;
    if ((outputProblem(p, app, d) ?? null) !== s) bad.push(`out ${JSON.stringify(p)}@${d}:${s}`);
  }
  const sprobes = [[{ budget: 100000, max_award: 15000 }, today], [{ budget: 100000, max_award: 15000 }, '2026-10-05'], [{ budget: 9000, max_award: 5000 }, today], [{ budget: 100000.5, max_award: 5000 }, today],
    [{ budget: 20000, max_award: 25000 }, today], [{ budget: 600000, max_award: 5000 }, today], [{ budget: 100000, max_award: 500 }, today], [{ budget: 100000, max_award: 15000, note: 'x'.repeat(301) }, today],
    [{ budget: 100000, max_award: 15000, note: 7 }, today], [{ budget: 100000, max_award: 15000, note: 'Winter round' }, today], [{}, today]];
  for (const [p, d] of sprobes) {
    const s = (await q('select kafaa_gr_schedule_problem($1::jsonb, $2::date) c', [JSON.stringify(p), d]))[0].c;
    if ((scheduleProblem(p, D.grant_rounds, d) ?? null) !== s) bad.push(`sched ${JSON.stringify(p)}@${d}:${s}`);
  }
  ok(bad.length === 0, `decision / output / schedule checks: SQL = TS for ${dprobes.length + 2} + ${oprobes.length} + ${sprobes.length} probes (after the deadline only; award within request, maximum and budget; output after the activity; one round waiting at most)${bad.length ? ` (${bad.slice(0, 4).join(' | ')})` : ''}`);
  // statistics
  bad = [];
  const sdays = [today, '2026-06-01', '2026-10-10', '2026-12-31'];
  for (const d of sdays) if (!same((await q('select kafaa_gr_stats($1::date) s', [d]))[0].s, grantStats(D.grant_rounds, apps, d))) bad.push(d);
  const G = grantStats(D.grant_rounds, apps, today);
  const cells = [G.totals.applications, G.totals.approved, G.totals.outputs_accepted, ...G.rounds.flatMap((r) => [r.applications, r.approved, r.declined, r.outputs_submitted, r.outputs_accepted]),
    ...G.by_kind.flatMap((k) => [k.applications, k.approved]), ...G.by_output.map((k) => k.promised)];
  ok(bad.length === 0 && cells.every((c) => c.suppressed || c.value === 0 || c.value >= 10) && cells.some((c) => c.suppressed)
    && G.rounds.every((r) => (r.committed === null) === !(r.approved.value >= 10)) && G.rounds.every((r) => r.approval_rate === null || !r.approved.suppressed),
  `acceptance (FS82): statistics under 10 are suppressed (SQL kafaa_gr_stats = TS grantStats on ${sdays.length} days; rates and money only behind 10 or more)${bad.length ? ` (${bad.join(', ')})` : ''}`);

  // ── parity: consortium rules
  bad = [];
  for (const c of D.consortium_cohorts) {
    for (const d of ['2026-07-15', '2026-07-16', '2026-08-31', '2026-09-01', today, '2026-12-15', '2026-12-16', '2027-06-30', '2027-07-01', '2027-12-01']) {
      if ((await q('select kafaa_cc_phase($1::date, $2::date, $3::date, $4::date) p', [c.nominations_close_on, c.starts_on, c.ends_on, d]))[0].p !== cohortPhase(c, d)) bad.push(`${c.id}@${d}`);
    }
    for (const org of ['enec', 'enec-ops', 'org-alnoor', 'org-cx-grid', 'ku', null]) {
      const r = (await q('select kafaa_cc_org($1::jsonb, $2) o, kafaa_cc_code($1::jsonb, $2, $3, 7) c', [JSON.stringify(c.partners), org, c.intake_year]))[0];
      if (r.o !== consortiumOrg(c, org)) bad.push(`org ${c.id}/${org}`);
      if (org && partnerOf(c, org) && r.c !== traineeCode(c, org, 7)) bad.push(`code ${c.id}/${org}`);
    }
  }
  for (const p of T.people) for (const d of [today, '2028-01-01']) if ((await q('select kafaa_cc_enec_eligible($1, $2::date) e', [p.id, d]))[0].e !== enecTraineeEligible(p, d)) bad.push(`eligible ${p.id}@${d}`);
  ok(bad.length === 0, `consortium basics: SQL kafaa_cc_phase / kafaa_cc_org / kafaa_cc_code / kafaa_cc_enec_eligible = TS on both cohorts, fixed days and every person${bad.length ? ` (${bad.slice(0, 5).join(', ')})` : ''}`);
  const c26 = cohortOf['cc-2026'], c27 = cohortOf['cc-2027'];
  const nprobes = [
    [{ discipline: 'mechanical' }, c27, 'org-alnoor', false, 0, false, today], [{ discipline: 'mechanical' }, c26, 'org-alnoor', false, 0, false, today], [{ discipline: 'mechanical' }, c27, 'ku', false, 0, false, today],
    [{ discipline: 'mechanical' }, c27, 'org-alnoor', true, 0, false, today], [{ discipline: 'mechanical' }, c27, 'org-cx-grid', true, 0, false, today], [{ discipline: 'mechanical' }, c27, 'enec-ops', false, 0, false, today],
    [{ discipline: 'law' }, c27, 'org-alnoor', false, 0, false, today], [{ discipline: 'mechanical', person_id: 'w-lo-05' }, c27, 'org-alnoor', false, 0, false, today],
    [{ discipline: 'operations', person_id: 'w-lo-05' }, c27, 'enec-ops', true, 0, false, today], [{ discipline: 'operations' }, c27, 'enec-ops', true, 0, false, today],
    [{ discipline: 'operations', person_id: 'p-sro' }, c27, 'enec-ops', true, 0, false, today], [{ discipline: 'operations', person_id: 'w-lo-05' }, c27, 'enec-ops', true, 0, true, today],
    [{ discipline: 'mechanical' }, c27, 'org-alnoor', false, 3, false, today], [null, c27, 'org-alnoor', false, 0, false, today], [{ discipline: 'mechanical' }, c27, null, false, 0, false, today],
  ];
  bad = [];
  for (const [p, c, org, byHr, active, dup, d] of nprobes) {
    const s = (await q('select kafaa_cc_nom_problem($1::jsonb, (select x from kafaa_consortium_cohorts x where x.id = $2), $3, $4, $5, $6, $7::date) c', [JSON.stringify(p), c.id, org, byHr, active, dup, d]))[0].c;
    const person = p && p.person_id ? T.people.find((x) => x.id === p.person_id) ?? null : null;
    if ((nominationProblem(p, { cohort: c, org, byHr, person, activeForOrg: active, duplicate: dup, today: d }) ?? null) !== s) bad.push(`nom ${JSON.stringify(p)}/${org}/${byHr}:${s}`);
  }
  const m27 = mem.find((m) => m.id === 'cm-cc-2027-an-27-01');
  const mprobes = [{ decision: 'accept', mentor_id: 'mt-sg-1', team: 'B' }, { decision: 'accept', mentor_id: 'mt-an-1', team: 'B' }, { decision: 'accept', mentor_id: 'nope', team: 'B' }, { decision: 'accept', mentor_id: 'mt-sg-1', team: 'E' },
    { decision: 'accept', mentor_id: 'mt-sg-1', team: 'B', note: 'x'.repeat(301) }, { decision: 'decline' }, { decision: 'decline', note: 'Seats are taken this year.' }, { decision: 'maybe' }, null];
  for (const p of mprobes) for (const m of [m27, mem.find((x) => x.id === 'cm-cc-2027-en-27-01')]) {
    const s = (await q('select kafaa_cc_decision_problem($1::jsonb, $2, (select x from kafaa_consortium_cohorts x where x.id = $3)) c', [JSON.stringify(p), m.org_id, m.cohort_id]))[0].c;
    if ((memberDecisionProblem(p, m, cohortOf[m.cohort_id]) ?? null) !== s) bad.push(`dec ${JSON.stringify(p)}/${m.id}:${s}`);
  }
  const en1 = mem.find((m) => m.id === 'cm-cc-2026-en-26-01');
  const vbase = { member_id: en1.id, host_org_id: 'org-alnoor', visit_on: addDays(today, -3), hours: 6 };
  const vprobes = [vbase, { ...vbase, host_org_id: 'ku' }, { ...vbase, host_org_id: 'enec-ops' }, { ...vbase, host_org_id: 7 }, { ...vbase, visit_on: addDays(today, 1) }, { ...vbase, visit_on: '2026-08-31' },
    { ...vbase, visit_on: '2026-02-30' }, { ...vbase, hours: 0.5 }, { ...vbase, hours: 41 }, { ...vbase, hours: 6.25 }, { ...vbase, hours: '6' }, { ...vbase, module_id: 'm5' }, { ...vbase, module_id: 'm2' },
    { ...vbase, module_id: 'm9' }, { ...vbase, module_id: '' }, { ...vbase, note: 'Ring 050 123 4567' }, { ...vbase, note: 5 }, { ...vbase, note: 'Toured the machining bay.' }, null];
  for (const p of vprobes) for (const m of [en1, mem.find((x) => x.status === 'declined'), mem.find((x) => x.id === 'cm-cc-2026-an-26-01')]) {
    const s = (await q('select kafaa_cc_visit_problem($1::jsonb, (select x from kafaa_consortium_cohorts x where x.id = $2), (select x from kafaa_consortium_members x where x.id = $3), $4::date) c', [JSON.stringify(p), m.cohort_id, m.id, today]))[0].c;
    if ((visitProblem(p, cohortOf[m.cohort_id], m, today) ?? null) !== s) bad.push(`visit ${JSON.stringify(p)}/${m.id}:${s}`);
  }
  for (const v of vis) {
    const s = (await q('select kafaa_cc_level($1, $2, $3, $4) l', [v.member_id, v.id, v.host_org_id, v.hours]))[0].l;
    const before = vis.filter((x) => x.member_id === v.member_id && x.status === 'confirmed' && x.id !== v.id).map((x) => ({ host_org_id: x.host_org_id, hours: x.hours }));
    if (s !== visitLevel(before, v)) bad.push(`level ${v.id}`);
    for (const caller of [{ org: 'org-alnoor', orgw: true, hr: false }, { org: 'org-gulfhydro', orgw: true, hr: false }, { org: 'enec', orgw: false, hr: true }, { org: 'org-alnoor', orgw: false, hr: false }]) {
      const r = (await q('select kafaa_cc_route($1::jsonb, $2, $3, $4, $5) r', [JSON.stringify(cohortOf[v.cohort_id].partners), v.host_org_id, caller.org, caller.orgw, caller.hr]))[0].r;
      if (r !== confirmRoute(v, cohortOf[v.cohort_id], caller)) bad.push(`route ${v.id}/${caller.org}`);
    }
  }
  ok(bad.length === 0, `consortium checks: SQL = TS for ${nprobes.length} nominations, ${mprobes.length * 2} decisions, ${vprobes.length * 3} visits, ${vis.length} visit levels and ${vis.length * 4} confirmation routes${bad.length ? ` (${bad.slice(0, 4).join(' | ')})` : ''}`);
  bad = [];
  for (const d of [today, '2026-09-15', '2027-03-01']) if (!same((await q('select kafaa_cc_stats($1::date) s', [d]))[0].s, consortiumStats(D.consortium_cohorts, mem, vis, d))) bad.push(d);
  const CS = consortiumStats(D.consortium_cohorts, mem, vis, today);
  const ccells = CS.cohorts.flatMap((c) => [c.trainees, c.nominated, c.visits_confirmed, c.visits_waiting, c.evidence_rows, ...c.by_org.map((x) => x.trainees), ...c.by_host.map((x) => x.confirmed)]);
  ok(bad.length === 0 && ccells.every((c) => c.suppressed || c.value === 0 || c.value >= 10) && ccells.some((c) => c.suppressed), `consortium figures: SQL kafaa_cc_stats = TS consortiumStats on 3 days; every count of 1-9 suppressed${bad.length ? ` (${bad.join(', ')})` : ''}`);

  // ── RLS
  const cnt = async (p, t, w = 'true') => Number((await one(p, `select count(*)::int n from kafaa_${t} where ${w}`)).n);
  const fails = [];
  for (const p of ['sro', 'buyer', 'training-mgr', 'chco', 'k-auditor', 'k-hr-analyst']) if ((await cnt(p, 'grant_rounds')) !== D.grant_rounds.length) fails.push(`rounds:${p}`);
  for (const p of [null, 'alnoor-gm', 'gulfhydro-qa', 'k-university', 'k-observer']) if ((await cnt(p, 'grant_rounds')) !== 0) fails.push(`rounds:${p}`);
  for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'k-admin']) if ((await cnt(p, 'grant_applications')) !== apps.length) fails.push(`apps:${p}`);
  for (const [p, pid] of [['buyer', 'p-buyer'], ['nse', 'p-nse'], ['qc-inspector', 'p-qc-inspector'], ['outage-planner', 'p-outage-planner'], ['sro', 'p-sro'], ['training-mgr', 'p-training-mgr']]) {
    if ((await cnt(p, 'grant_applications')) !== apps.filter((a) => a.person_id === pid).length || (await cnt(p, 'grant_applications', `person_id <> '${pid}'`)) !== 0) fails.push(`apps:${p}`);
  }
  for (const p of [null, 'alnoor-gm', 'k-university']) if ((await cnt(p, 'grant_applications')) !== 0) fails.push(`apps:${p}`);
  for (const p of [null, 'buyer', 'alnoor-gm', 'k-university', 'chco']) if ((await cnt(p, 'consortium_cohorts')) !== D.consortium_cohorts.length) fails.push(`cohorts:${p}`);
  for (const t of ['consortium_members', 'consortium_visits']) {
    for (const [p, org] of [['alnoor-gm', 'org-alnoor'], ['alnoor-qaqc', 'org-alnoor'], ['gulfhydro-qa', 'org-gulfhydro']]) {
      const mine = D[t].filter((r) => r.org_id === org).length;
      if (mine === 0 || (await cnt(p, t)) !== mine || (await cnt(p, t, `org_id <> '${org}'`)) !== 0) fails.push(`${t}:${p}`);
    }
    if ((await cnt('k-lo-trainee', t)) !== D[t].filter((r) => r.person_id === 'p-k-lo-trainee').length || (await cnt('k-lo-trainee', t, "person_id is distinct from 'p-k-lo-trainee'")) !== 0) fails.push(`${t}:k-lo-trainee`);
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'k-admin']) if ((await cnt(p, t)) !== D[t].length) fails.push(`${t}:${p}`);
    for (const p of [null, 'sro', 'buyer', 'training-mgr', 'k-observer', 'k-university']) if ((await cnt(p, t)) !== 0) fails.push(`${t}:${p}`);
  }
  ok(fails.length === 0, `acceptance (FS83): each partner sees only its own trainees: RLS gives alnoor-gm / alnoor-qaqc only Al Noor rows and gulfhydro-qa only Gulf Hydro-Valve rows, the ENEC trainee only their own, HR/admin/auditors all, staff and others none; applications own rows + HR; rounds staff only${fails.length ? ` (${fails.join(', ')})` : ''}`);
  let direct = 0;
  for (const sql of ["update kafaa_consortium_visits set status = 'confirmed' where org_id = 'org-alnoor'", "insert into kafaa_grant_applications (id, round_id, person_id, basis, kind, title, purpose, destination, starts_on, ends_on, amount, skill_id, output_kind, created_by) values ('ga-x', 'gr-2026-12', 'p-buyer', 'early_career', 'conference', 'x', 'x', 'x', '2027-01-01', '2027-01-02', 900, 'sk-fs-gr-grid', 'report', 'p-buyer')"]) {
    try { await one(sql.includes('consortium') ? 'alnoor-gm' : 'buyer', sql); } catch { direct++; }
  }
  const stillLogged = Number((await q("select count(*)::int n from kafaa_consortium_visits where org_id = 'org-alnoor' and status = 'logged'"))[0].n);
  ok(direct === 2 && stillLogged === D.consortium_visits.filter((v) => v.org_id === 'org-alnoor' && v.status === 'logged').length, 'writes only through the RPCs (no direct visit update, no direct application insert)');

  // ── grants
  let anonDenied = 0;
  for (const f of RPCS) { try { await one(null, `select ${f}`); } catch { anonDenied++; } }
  let helperDenied = 0;
  for (const sql of ["select kafaa_gr_stats(current_date)", "select kafaa_gr_eligibility('p-buyer', current_date, false)", "select kafaa_cc_stats(current_date)", "select kafaa_cc_level('x', 'y', 'z', 1)", "select kafaa_gr_app_problem('{}'::jsonb, current_date, 1000)", "select kafaa_cc_enec_eligible('p-buyer', current_date)"]) {
    try { await one('chco', sql); } catch { helperDenied++; }
  }
  ok(anonDenied === RPCS.length && helperDenied === 6, `grants: anonymous visitors execute none of the ${RPCS.length} RPCs; internal helpers are not executable by signed-in users`);

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const lastAudit = async (action) => (await q('select outcome, ledger_status, ledger_seq, reason, actor_role from kafaa_audit_events where action = $1 order by seq desc limit 1', [action]))[0];
    const audits = async (action) => Number((await q('select count(*)::int n from kafaa_audit_events where action = $1', [action]))[0].n);
    const call = async (p, fn, x) => (await one(p, `select ${fn}($1::jsonb) r`, [JSON.stringify(x)])).r;
    const call1 = async (p, fn, x) => (await one(p, `select ${fn}($1) r`, [x])).r;
    // schedule
    const s1 = await call('sro', 'kafaa_schedule_grant_round', { budget: 100000, max_award: 12000 });
    const s2 = await call('k-hr-analyst', 'kafaa_schedule_grant_round', { budget: 5000, max_award: 12000 });
    const s3 = await call('k-hr-analyst', 'kafaa_schedule_grant_round', { budget: 160000, max_award: 12000, note: 'Spring conference season.' });
    const s3a = await lastAudit('grant.round.schedule');
    const s4 = await call('chco', 'kafaa_schedule_grant_round', { budget: 160000, max_award: 12000 });
    const exp = nextRoundSlot('2026-12-10', today);
    ok(s1.code === 'forbidden' && s2.code === 'invalid' && s3.ok && same(s3.data, exp) && s3a.ledger_status !== 'not_applicable' && s4.code === 'exists'
      && (await q('select kafaa_gr_phase(opens_on, closes_on, current_date) p from kafaa_grant_rounds where id = $1', [exp.id]))[0].p === 'scheduled',
    `scheduleGrantRound: HR only; the next slot is computed (${exp.id}: ${exp.opens_on}..${exp.closes_on}); one round waiting at most; audit + ledger`);
    // apply
    const ain = { kind: 'site_visit', title: 'Factory QA visit for modular builds', purpose: 'See factory fabrication quality controls and compare them with our receipt inspection.', destination: 'Module fabrication yard (sample)',
      starts_on: '2027-01-11', ends_on: '2027-01-13', costs: [{ item: 'transport', amount: 4200 }, { item: 'subsistence', amount: 2100 }], skill_id: 'sk-fs-adv-factoryqa', output_kind: 'report' };
    const a1 = await call('buyer', 'kafaa_apply_grant', ain);
    const a2 = await call('buyer', 'kafaa_apply_grant', ain);
    const a3 = await call('alnoor-gm', 'kafaa_apply_grant', ain);
    const a4 = await call('nse', 'kafaa_apply_grant', { ...ain, starts_on: '2026-12-01', ends_on: '2026-12-02' });
    await q("update kafaa_people set hire_date = '2012-03-01' where id = 'p-sro'");
    const a5 = await call('sro', 'kafaa_apply_grant', ain);
    const a6 = await call('chco', 'kafaa_apply_grant', { ...ain, person_id: 'a-06' });
    const a7 = await call('chco', 'kafaa_apply_grant', { ...ain, person_id: 'a-06', consent_ref: 'EP-CONSENT-2026-021' });
    const a8 = await call('chco', 'kafaa_apply_grant', { ...ain, person_id: 'a-01', consent_ref: 'EP-CONSENT-2026-022' });
    const a9 = await call('buyer', 'kafaa_apply_grant', { ...ain, person_id: 'a-06', consent_ref: 'EP-CONSENT-2026-023' });
    const row1 = a1.ok ? fix((await q('select * from kafaa_grant_applications where id = $1', [a1.data.id]))[0]) : null;
    const row7 = a7.ok ? fix((await q('select * from kafaa_grant_applications where id = $1', [a7.data.id]))[0]) : null;
    ok(a1.ok && a1.data.round_id === 'gr-2026-12' && a1.data.amount === 6300 && row1.basis === 'early_career' && row1.status === 'submitted' && a2.code === 'duplicate' && a3.code === 'forbidden'
      && a4.code === 'invalid' && /deadline/.test(a4.message) && a5.code === 'not_eligible' && a6.code === 'invalid' && /consent/.test(a6.message) && a7.ok && row7.basis === 'placement' && row7.on_behalf
      && row7.consent_ref === 'EP-CONSENT-2026-021' && a8.code === 'invalid' && a9.code === 'forbidden',
    'applyGrant: early-career staff in the open round, one application per round; partners refused; activity after the deadline; 10+ years refused; HR files for a placement student only with a consent reference');
    // decide
    const d1 = await call('k-hr-analyst', 'kafaa_decide_grant', { application_id: 'ga-2026-10-01', decision: 'approve' });
    const d2 = await call('chco', 'kafaa_decide_grant', { application_id: a1.data.id, decision: 'approve' });
    const d3 = await call('chco', 'kafaa_decide_grant', { application_id: 'ga-2026-10-01', decision: 'approve' });
    const d3a = await lastAudit('grant.decide');
    const d4 = await call('chco', 'kafaa_decide_grant', { application_id: 'ga-2026-10-01', decision: 'decline', note: 'Twice' });
    const d5 = await call('chco', 'kafaa_decide_grant', { application_id: 'ga-2026-10-02', decision: 'decline' });
    const d6 = await call('chco', 'kafaa_decide_grant', { application_id: 'ga-2026-10-02', decision: 'approve', award: 99999 });
    const waiting = apps.filter((a) => a.round_id === 'gr-2026-10' && a.status === 'submitted' && a.id !== 'ga-2026-10-01').map((a) => a.id);
    let budgetHit = null;
    for (const id of waiting) { const r = await call('chco', 'kafaa_decide_grant', { application_id: id, decision: 'approve' }); if (!r.ok) { budgetHit = r; break; } }
    const committed = Number((await q("select coalesce(sum(awarded), 0)::int n from kafaa_grant_applications where round_id = 'gr-2026-10' and status = 'approved'"))[0].n);
    const nt = Number((await q("select count(*)::int n from kafaa_notifications where id = 'nt-gr-ga-2026-10-01-decided' and person_id = 'p-buyer' and kind = 'grant'"))[0].n);
    await q("insert into kafaa_grant_applications (id, round_id, person_id, basis, kind, title, purpose, destination, starts_on, ends_on, costs, amount, skill_id, output_kind, created_by) values ('ga-test-chco', 'gr-2026-10', 'p-chco', 'early_career', 'conference', 'Test conference', 'A test application for the maker-checker rule.', 'Test (sample)', '2026-12-01', '2026-12-02', '[]', 900, 'sk-fs-gr-grid', 'report', 'p-chco')");
    const d7 = await call('chco', 'kafaa_decide_grant', { application_id: 'ga-test-chco', decision: 'approve' });
    ok(d1.code === 'forbidden' && d2.code === 'round_open' && d3.ok && d3.data.awarded === 7400 && d3a.ledger_status !== 'not_applicable' && d4.code === 'decided' && d5.code === 'invalid' && d6.code === 'invalid'
      && budgetHit && budgetHit.code === 'budget' && committed <= roundOf['gr-2026-10'].budget && nt === 1 && d7.code === 'maker_checker',
    `acceptance (FS82): decisions are audited (HR director only, after the deadline, never their own; audit + ledger + notice); the SIMULATED budget stops approvals (${committed} of ${roundOf['gr-2026-10'].budget} AED committed)`);
    // outputs
    const o1 = await call('qc-inspector', 'kafaa_submit_grant_output', { application_id: 'ga-2026-08-01', kind: 'presentation', title: 'SMR conference briefing', summary: 'What changes for operations in multi-module plants, and three questions for our team.' });
    const o2 = await call('buyer', 'kafaa_submit_grant_output', { application_id: 'ga-2026-10-01', kind: 'report', title: 'Factory visit report', summary: 'What I saw at the fabrication yard and what I will change.' });
    const o3 = await call('buyer', 'kafaa_submit_grant_output', { application_id: 'ga-2026-08-01', kind: 'report', title: 'Factory visit report', summary: 'What I saw at the fabrication yard and what I will change.' });
    const o4 = await call('nse', 'kafaa_submit_grant_output', { application_id: 'ga-2026-06-01', kind: 'report', title: 'Digital I&C course report', summary: 'The second version of my course report with examples.' });
    const nseState0 = Number((await q("select count(*)::int n from kafaa_skill_evidence where person_id = 'p-nse' and ref_table = 'grant_applications'"))[0].n);
    const v1 = await call('nse', 'kafaa_review_grant_output', { application_id: 'ga-2026-06-01', decision: 'accept' });
    const v2 = await call('k-hr-analyst', 'kafaa_review_grant_output', { application_id: 'ga-2026-06-03', decision: 'return' });
    const v3 = await call('k-hr-analyst', 'kafaa_review_grant_output', { application_id: 'ga-2026-06-03', decision: 'return', note: 'Please add one change you will propose.' });
    const v4 = await call('chco', 'kafaa_review_grant_output', { application_id: 'ga-2026-06-01', decision: 'accept' });
    const v4a = await lastAudit('grant.output.review');
    const ev = (await q("select * from kafaa_skill_evidence where id = 'se:rating:ga-2026-06-01:sk-fs-dp-dic'"))[0];
    const st = (await q("select level from kafaa_person_skills where person_id = 'p-nse' and skill_id = 'sk-fs-dp-dic'"))[0];
    const v5 = await call('chco', 'kafaa_review_grant_output', { application_id: 'ga-2026-06-01', decision: 'accept' });
    const v6 = await call('k-hr-analyst', 'kafaa_review_grant_output', { application_id: 'ga-2026-06-08', decision: 'accept' });
    ok(o1.ok && o2.code === 'too_early' && o3.code === 'not_found' && o4.code === 'invalid' && nseState0 === 0 && v1.code === 'forbidden' && v2.code === 'invalid' && v3.ok && v3.data.output_status === 'returned'
      && v4.ok && v4.data.level === 1 && v4.data.profile_evidence && v4a.ledger_status !== 'not_applicable' && ev && ev.kind === 'rating' && ev.basis === 'validated' && ev.level === 1 && ev.recorded_by === 'p-chco'
      && st && st.level >= 1 && v5.code === 'invalid' && v6.code === 'maker_checker',
    'outputs: the grantee logs the output after the activity; only HR (never the grantee or whoever submitted it) accepts it; evidence (rating, validated, ref_table grant_applications) is written only on acceptance and the skill state follows (kafaa_skills_apply)');
    const g1 = (await one('buyer', 'select kafaa_grant_stats() r')).r;
    const g2 = (await one('alnoor-gm', 'select kafaa_grant_stats() r')).r;
    const g3 = (await one('k-auditor', 'select kafaa_grant_stats() r')).r;
    const Dn = { rounds: await rows('grant_rounds'), apps: await rows('grant_applications') };
    ok(g1.ok && same(g1.data, grantStats(Dn.rounds, Dn.apps, today)) && g2.code === 'forbidden' && g3.ok && !/p-[a-z]|w-[a-z]/.test(JSON.stringify(g1.data)),
      'grantStats: staff and auditors read the suppressed statistics (TS = SQL after the flows), which name no person; partners are refused');
    // withdraw
    const w1 = await call1('nse', 'kafaa_withdraw_grant', a1.data.id);
    const w2 = await call1('buyer', 'kafaa_withdraw_grant', a1.data.id);
    const w3 = await call1('buyer', 'kafaa_withdraw_grant', 'ga-2026-10-01');
    ok(w1.code === 'not_found' && w2.ok && w2.data.status === 'withdrawn' && w3.code === 'invalid', 'withdrawGrant: the applicant only, while submitted');

    // ── FS83 flows
    const n1 = await call('alnoor-gm', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'electrical' });
    const n2 = await call('alnoor-gm', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2026', discipline: 'electrical' });
    const n3 = await call('alnoor-qaqc', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'electrical' });
    const n4 = await call('gulfhydro-qa', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'electrical', org_id: 'org-alnoor' });
    const n5 = await call('chco', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'operations', person_id: 'w-lo-05' });
    const n6 = await call('chco', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'mechanical', org_id: 'org-alnoor' });
    const n7 = await call('chco', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'environmental', org_id: 'org-cx-solar' });
    const n8 = await call('chco', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'operations', person_id: 'p-sro' });
    const n9 = await call('chco', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'operations', person_id: 'w-lo-10' });
    const n10 = await call('alnoor-gm', 'kafaa_nominate_consortium_trainee', { cohort_id: 'cc-2027', discipline: 'electrical', person_id: 'w-lo-04' });
    const n5row = n5.ok ? (await q('select org_id, person_id, trainee_code from kafaa_consortium_members where id = $1', [n5.data.id]))[0] : null;
    ok(n1.ok && n1.data.trainee_code === 'AN-27-02' && n2.code === 'invalid' && /closed/.test(n2.message) && n3.code === 'forbidden' && n4.code === 'invalid' && n5.ok && n5row.person_id === 'w-lo-05' && n5row.org_id === 'enec-ops'
      && n6.code === 'invalid' && n7.ok && /^QS-27-/.test(n7.data.trainee_code) && n8.code === 'invalid' && n9.code === 'invalid' && /already/.test(n9.message) && n10.code === 'invalid',
    'nominateConsortiumTrainee: partner admins for their own organisation (pseudonymous code, no person), HR for ENEC early-career staff and for partners without Kafa\'a access; closed cohorts, partner users, other organisations, ineligible and duplicate people refused');
    const c1 = await call('k-hr-analyst', 'kafaa_decide_consortium_member', { member_id: 'cm-cc-2027-an-27-01', decision: 'accept', mentor_id: 'mt-sg-1', team: 'B' });
    const c2 = await call('chco', 'kafaa_decide_consortium_member', { member_id: 'cm-cc-2027-an-27-01', decision: 'accept', mentor_id: 'mt-an-1', team: 'B' });
    const c3 = await call('chco', 'kafaa_decide_consortium_member', { member_id: 'cm-cc-2027-an-27-01', decision: 'accept', mentor_id: 'mt-sg-1', team: 'B' });
    const c3a = await lastAudit('consortium.member.decide');
    const c4 = await call('chco', 'kafaa_decide_consortium_member', { member_id: 'cm-cc-2027-an-27-01', decision: 'decline', note: 'Changed my mind.' });
    ok(c1.code === 'forbidden' && c2.code === 'invalid' && /another/.test(c2.message) && c3.ok && c3.data.status === 'accepted' && c3a.ledger_status !== 'not_applicable' && c4.code === 'decided',
      'decideConsortiumMember: HR director only; the mentor comes from another consortium organisation; audit + ledger; decided once');
    // log
    const an2 = mem.find((m) => m.trainee_code === 'AN-26-02');
    const gh1 = mem.find((m) => m.trainee_code === 'GH-26-01');
    const l1 = await call('alnoor-gm', 'kafaa_log_consortium_visit', { member_id: an2.id, host_org_id: 'org-gulfhydro', visit_on: addDays(today, -2), hours: 6, note: 'Valve test bay walk-through.' });
    const l2 = await call('alnoor-gm', 'kafaa_log_consortium_visit', { member_id: gh1.id, host_org_id: 'org-alnoor', visit_on: addDays(today, -2), hours: 6 });
    const l3 = await call('alnoor-gm', 'kafaa_log_consortium_visit', { member_id: an2.id, host_org_id: 'org-alnoor', visit_on: addDays(today, -2), hours: 6 });
    const l4 = await call('buyer', 'kafaa_log_consortium_visit', { member_id: an2.id, host_org_id: 'org-gulfhydro', visit_on: addDays(today, -2), hours: 6 });
    const l5 = await call('chco', 'kafaa_log_consortium_visit', { member_id: 'cm-cc-2026-en-26-01', host_org_id: 'org-cx-solar', visit_on: addDays(today, -1), hours: 6 });
    const l6 = await call('k-lo-trainee', 'kafaa_log_consortium_visit', { member_id: 'cm-cc-2026-en-26-01', host_org_id: 'org-alnoor', visit_on: addDays(today, -1), hours: 8 });
    const l1row = l1.ok ? (await q('select logged_via, skill_id, org_id from kafaa_consortium_visits where id = $1', [l1.data.id]))[0] : null;
    const l6row = l6.ok ? (await q('select logged_via, person_id from kafaa_consortium_visits where id = $1', [l6.data.id]))[0] : null;
    ok(l1.ok && l1row.logged_via === 'employer' && l1row.skill_id === 'sk-fs-dp-robotics' && l2.code === 'not_found' && l3.code === 'invalid' && /own/.test(l3.message) && l4.code === 'not_found'
      && l5.ok && l6.ok && l6row.logged_via === 'self' && l6row.person_id === 'p-k-lo-trainee',
    'logConsortiumVisit: the trainee, their own employer\'s administrator or the programme office; another organisation\'s trainee reads as not found; a visit is to another consortium organisation');
    // confirm
    const enLogged = vis.find((v) => v.trainee_code === 'EN-26-02' && v.host_org_id === 'org-alnoor' && v.status === 'logged');
    const ghLogged = vis.find((v) => v.trainee_code === 'GH-26-02' && v.status === 'logged');
    const kloGrid = vis.find((v) => v.person_id === 'p-k-lo-trainee' && v.host_org_id === 'org-cx-grid' && v.status === 'logged');
    const ev0 = Number((await q("select count(*)::int n from kafaa_skill_evidence where ref_table = 'consortium_visits'"))[0].n);
    const f1 = await call('gulfhydro-qa', 'kafaa_confirm_consortium_visit', { visit_id: enLogged.id, decision: 'confirm' });
    const f2 = await call('alnoor-qaqc', 'kafaa_confirm_consortium_visit', { visit_id: enLogged.id, decision: 'confirm' });
    const f3 = await call('buyer', 'kafaa_confirm_consortium_visit', { visit_id: enLogged.id, decision: 'confirm' });
    const ev1 = Number((await q("select count(*)::int n from kafaa_skill_evidence where ref_table = 'consortium_visits'"))[0].n);
    const f4 = await call('alnoor-gm', 'kafaa_confirm_consortium_visit', { visit_id: enLogged.id, decision: 'confirm' });
    const f4a = await lastAudit('consortium.visit.decide');
    const e4 = (await q("select * from kafaa_skill_evidence where id = $1", [`se:ojt:${enLogged.id}:sk-fs-adv-factoryqa`]))[0];
    const s4b = (await q("select level from kafaa_person_skills where person_id = 'w-lo-02' and skill_id = 'sk-fs-adv-factoryqa'"))[0];
    const f5 = await call('alnoor-gm', 'kafaa_confirm_consortium_visit', { visit_id: ghLogged.id, decision: 'confirm' });
    const f6 = await call('chco', 'kafaa_confirm_consortium_visit', { visit_id: kloGrid.id, decision: 'confirm' });
    const f7 = await call('chco', 'kafaa_confirm_consortium_visit', { visit_id: kloGrid.id, decision: 'confirm', host_ref: 'SGS-HOST-CONF-2026-10-07' });
    const f8 = await call('chco', 'kafaa_confirm_consortium_visit', { visit_id: l5.data.id, decision: 'confirm', host_ref: 'QSO-REF-1' });
    const f9 = await call('gulfhydro-qa', 'kafaa_confirm_consortium_visit', { visit_id: l1.data.id, decision: 'decline' });
    const f10 = await call('gulfhydro-qa', 'kafaa_confirm_consortium_visit', { visit_id: l1.data.id, decision: 'decline', reason: 'No visit was recorded at the test bay.' });
    const f11 = await call('alnoor-gm', 'kafaa_confirm_consortium_visit', { visit_id: enLogged.id, decision: 'confirm' });
    const eklo = (await q("select level, kind, basis from kafaa_skill_evidence where id = $1", [`se:ojt:${kloGrid.id}:sk-fs-gr-grid`]))[0];
    ok(f1.code === 'forbidden' && f2.code === 'forbidden' && f3.code === 'forbidden' && ev1 === ev0 && f4.ok && f4.data.profile_evidence && f4.data.level === 1 && f4a.ledger_status !== 'not_applicable'
      && e4 && e4.kind === 'ojt' && e4.basis === 'validated' && e4.recorded_by === 'p-alnoor-gm' && s4b && s4b.level >= 1
      && f5.ok && !f5.data.profile_evidence && f6.code === 'invalid' && /reference/.test(f6.message) && f7.ok && f7.data.profile_evidence && eklo && eklo.kind === 'ojt'
      && f8.code === 'maker_checker' && f9.code === 'invalid' && f10.ok && f10.data.status === 'declined' && f11.code === 'invalid',
    'acceptance (FS83): visits write evidence after host confirmation: nothing before; only the host (its administrator, the ENEC programme office, or on behalf of a host without access with its reference) confirms, never the logger; F01 evidence (ojt, validated) for ENEC staff, a visit record for partner trainees');
    const lv = await call('k-lo-trainee', 'kafaa_log_consortium_visit', { member_id: 'cm-cc-2026-en-26-01', host_org_id: 'org-cx-grid', visit_on: addDays(today, -1), hours: 6 });
    const fl = await call('chco', 'kafaa_confirm_consortium_visit', { visit_id: lv.data.id, decision: 'confirm', host_ref: 'SGS-HOST-CONF-2' });
    ok(lv.ok && fl.ok && fl.data.level === 2 && (await q('select level from kafaa_skill_evidence where id = $1', [`se:ojt:${lv.data.id}:sk-fs-gr-grid`]))[0]?.level === 2,
      'visit level: the second confirmed visit to the same host with 12+ hours there is level 2 (kafaa_cc_level = visitLevel)');
    // withdraw + host list + stats
    const x1 = await call1('gulfhydro-qa', 'kafaa_withdraw_consortium_visit', l6.data.id);
    const x2 = await call1('k-lo-trainee', 'kafaa_withdraw_consortium_visit', l6.data.id);
    const h1 = (await one('alnoor-gm', 'select kafaa_consortium_host_visits() r')).r;
    const h2 = (await one('chco', 'select kafaa_consortium_host_visits() r')).r;
    const h3 = (await one('buyer', 'select kafaa_consortium_host_visits() r')).r;
    const Vn = await rows('consortium_visits');
    const orgName = Object.fromEntries(T.organisations.map((o) => [o.id, o]));
    const expHost = (caller) => Vn.map((v) => ({ v, route: confirmRoute(v, cohortOf[v.cohort_id], caller) })).filter((x) => x.route).sort((a, c) => (a.v.visit_on === c.v.visit_on ? (a.v.id < c.v.id ? -1 : 1) : a.v.visit_on < c.v.visit_on ? 1 : -1))
      .map(({ v, route }) => ({ id: v.id, cohort_id: v.cohort_id, trainee_code: v.trainee_code, org_id: v.org_id, org_name_en: orgName[v.org_id]?.name_en ?? v.org_id, org_name_ar: orgName[v.org_id]?.name_ar ?? v.org_id,
        host_org_id: v.host_org_id, module_id: v.module_id, visit_on: v.visit_on, hours: v.hours, note: v.note, skill_id: v.skill_id, status: v.status, level: v.level, confirmed_via: v.confirmed_via, route }));
    ok(x1.code === 'forbidden' && x2.ok && h1.ok && h1.data.length > 0 && h1.data.every((v) => v.host_org_id === 'org-alnoor' && !('person_id' in v) && !('member_id' in v)) && same(h1.data, expHost({ org: 'org-alnoor', orgw: true, hr: false }))
      && h2.ok && same(h2.data, expHost({ org: 'enec', orgw: false, hr: true })) && h3.code === 'forbidden',
    'consortiumHostVisits: a host sees the visits it hosts as trainee codes and visiting organisations (no person, no member row; TS = SQL); the programme office sees ENEC sites and hosts without access; staff are refused');
    const t1 = (await one('alnoor-qaqc', 'select kafaa_consortium_stats() r')).r;
    const t2 = (await one('k-observer', 'select kafaa_consortium_stats() r')).r;
    const Mn = await rows('consortium_members');
    ok(t1.ok && same(t1.data, consortiumStats(D.consortium_cohorts, Mn, Vn, today)) && t2.code === 'forbidden' && (await audits('consortium.stats')) >= 1,
      'consortiumStats: every ecosystem reader (here a partner user) reads the suppressed figures (TS = SQL after the flows); observers are refused and the refusal is audited');
  } finally {
    await db.exec('rollback');
  }

  // ── additivity, function bodies and table digests (for the live comparison)
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/create or replace function kafaa_(skill_states_v2|skills_apply|dg_gather|so_base)\b/.test(text),
    'additive: the FS94 migration never names a destructive statement, alters only kafaa_* tables and redefines no shared function');
  const md5s = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  ok(md5s.length === FUNCS.length, `functions: ${md5s.length} new function bodies present`);
  console.log(`    md5 ${md5s.map((r) => `${r.proname}=${r.m}`).join(' ')}`);
  for (const t of [...TABLES, 'organisations']) {
    const w = t === 'organisations' ? "where x.id in ('org-cx-grid', 'org-cx-solar', 'org-cx-h2')" : '';
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_${t} x ${w}`))[0];
    console.log(`    digest kafaa_${t}${w ? ' (3 new synthetic partners)' : ''} ${d.n} ${d.dg}`);
  }
}
