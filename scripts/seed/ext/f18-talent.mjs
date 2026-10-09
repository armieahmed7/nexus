// [W3 · E1] F18 Talent review and F19 Succession seed (module M23). Synthetic people only; every row is confidential (talent_review).
// Built in finalize after F01 has derived skill states (FINALIZE_LAST), with the same pure rules the RPCs use:
//  - perf_ratings: a synthetic performance field (1-5) for 2025 and 2026-H1 for every staff member with a job role (SIMULATED).
//  - three review cycles: operations 2026-H2 (open, partly placed: the crew B shift supervisor still has people to place),
//    maintenance + engineering + outage 2026-H2 (all placed, calibrated by the HR business partner, awaiting the HR director's lock),
//    technical services 2026-H1 (locked: development priorities published to employees, HiPo pool, notifications).
//    Anchors follow the evidence tercile with deterministic noise plus deliberate outliers, so calibration has something to discuss.
//  - eleven succession slates (8 critical roles + shift technical advisor, outage manager, nuclear oversight) for 2026-H2 with
//    successors chosen by the F05 readiness and the role's hard gates, gap actions, external emergency cover (KHNP / contractor role cards),
//    and the bench roll-up of the confirmed critical slates into M07 critical_roles (period 2026-H2) with its history rows.
import { careerReadiness } from '../../../src/modules/m18/career.ts';
import { lineManagerOf } from '../../../src/modules/m20/domain.ts';
import {
  ANCHORS, benchCounts, boxOf, critId, cutsOf, evidenceOf, feederRoles, hardGatesOf, isHipo, membersOf, perfFromRating, readinessOf, flagsOf,
} from '../../../src/modules/m23/domain.ts';

export const FINALIZE_LAST = true;

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const TABLES = ['review_cycles', 'perf_ratings', 'review_placements', 'talent_priorities', 'talent_pool', 'succession_slates', 'successors', 'bench_rollups'];

export default function build(T) {
  for (const t of TABLES) T[t] = [];
}

const CYCLES = [
  { id: 'trc-2026h2-ops', code: 'TR-2026H2-OPS', title_en: 'Operations talent review 2026 H2', title_ar: 'مراجعة المواهب لقطاع العمليات - النصف الثاني 2026', period: '2026-H2', family_ids: ['operations'], status: 'open', opened_on: '2026-09-21', due_on: '2026-11-15', placed_on: '2026-10-0' },
  { id: 'trc-2026h2-mne', code: 'TR-2026H2-MNE', title_en: 'Maintenance, engineering and outage talent review 2026 H2', title_ar: 'مراجعة المواهب للصيانة والهندسة وفترات الصيانة - النصف الثاني 2026', period: '2026-H2', family_ids: ['maintenance', 'engineering', 'outage'], status: 'calibration', opened_on: '2026-09-07', due_on: '2026-10-31', placed_on: '2026-09-2' },
  { id: 'trc-2026h1-tsv', code: 'TR-2026H1-TSV', title_en: 'Technical services talent review 2026 H1', title_ar: 'مراجعة المواهب للخدمات الفنية - النصف الأول 2026', period: '2026-H1', family_ids: ['radiation-protection', 'chemistry', 'emergency-preparedness', 'quality', 'fire-protection'], status: 'locked', opened_on: '2026-04-12', due_on: '2026-06-15', placed_on: '2026-05-1' },
];
/** Crew B people the shift supervisor still has to place in the open operations cycle (demo). */
const LEAVE_OPEN = new Set(['p-k-ro', 'w-ro-02', 'w-lo-07', 'w-sro-04', 'w-ro-05', 'w-lo-09', 'w-ss-02', 'w-lo-04']);

const T2 = (en, ar) => ({ en, ar });
const ACT = {
  estadad: { kind: 'training', ...T2('ESTADAD leadership programme (nomination via the Leadership Academy)', 'برنامج استعداد القيادي (الترشيح عبر أكاديمية القيادة)'), ref_table: 'courses', ref_id: 'c-estadad' },
  hipoRot: { kind: 'rotation', ...T2('High-potential leadership rotation (12 months)', 'تدوير قيادي لأصحاب الإمكانات العالية (12 شهراً)'), ref_table: 'rotation_templates', ref_id: 'rt-hipo-leadership' },
  leadMentor: { kind: 'mentoring', ...T2('Leadership mentoring with a senior leader', 'إرشاد قيادي مع قائد أول'), ref_table: 'leadership_programmes', ref_id: 'prog-mentoring' },
  stretch: { kind: 'stretch', ...T2('Lead a cross-crew improvement task this half', 'قيادة مهمة تحسين مشتركة بين الأطقم في هذا النصف'), ref_table: null, ref_id: null },
  coachDelivery: { kind: 'coaching', ...T2('Monthly coaching on delivery and priorities', 'تدريب شهري على الإنجاز وترتيب الأولويات'), ref_table: null, ref_id: null },
  support: { kind: 'coaching', ...T2('Agreed support plan with fortnightly check-ins', 'خطة دعم متفق عليها مع متابعة كل أسبوعين'), ref_table: null, ref_id: null },
  crossEng: { kind: 'rotation', ...T2('Cross-functional move to plant engineering (6 months)', 'انتقال متعدد الوظائف إلى هندسة المحطة (6 أشهر)'), ref_table: 'rotation_templates', ref_id: 'rt-cross-ops-eng' },
  share: { kind: 'stretch', ...T2('Present a knowledge-sharing session to the community of practice', 'تقديم جلسة لتبادل المعرفة في مجتمع الممارسة'), ref_table: null, ref_id: null },
};

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const byId = new Map(T.people.map((p) => [p.id, p]));
  const courses = T.courses.filter((c) => c.audience !== 'supplier');
  const compName = new Map(T.competencies.map((c) => [c.id, c]));
  const roleById = new Map(T.job_roles.map((r) => [r.id, r]));
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_role_id);
  const evIn = (pid) => ({ states: T.person_skills.filter((s) => s.person_id === pid), evidence: T.skill_evidence.filter((e) => e.person_id === pid), skills: T.skills });
  const careerData = (pid) => ({
    people: T.people.filter((p) => p.id === pid), roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills,
    states: T.person_skills.filter((s) => s.person_id === pid), licences: T.licences.filter((l) => l.person_id === pid), standards: T.qual_standards,
    qualRecords: T.qual_records.filter((q) => q.person_id === pid), programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records.filter((t) => t.person_id === pid),
    enrolments: T.enrolments.filter((e) => e.person_id === pid), weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
  });
  const courseFor = (compId) => courses.find((c) => (c.competency_ids ?? []).includes(compId));
  const gapAction = (pid, roleId) => {
    const cr = careerReadiness(careerData(pid), pid, [roleId], today)[0];
    const g = cr?.gaps?.[0];
    const c = g ? courseFor(g.competency_id) : null;
    if (!c) return null;
    const comp = compName.get(g.competency_id);
    return { kind: 'training', title_en: `${c.title_en} (closes ${comp?.name_en ?? g.competency_id} ${g.have}→${g.need})`, title_ar: `${c.title_ar} (يسد فجوة ${comp?.name_ar ?? g.competency_id} ${g.have}←${g.need})`, ref_table: 'courses', ref_id: c.id };
  };
  const act = (a) => ({ kind: a.kind, title_en: a.en ?? a.title_en, title_ar: a.ar ?? a.title_ar, ref_table: a.ref_table ?? null, ref_id: a.ref_id ?? null });

  // ── perf_ratings (synthetic field, SIMULATED)
  const evNow = new Map(staff.map((p) => [p.id, evidenceOf(evIn(p.id), today)]));
  for (const p of staff.sort((a, b) => cmp(a.id, b.id))) {
    const e = evNow.get(p.id).index;
    for (const [period, salt] of [['2025', 'a'], ['2026-H1', 'b']]) {
      const h = hash(`${p.id}:${salt}`);
      const base = e >= 70 ? 4 : e >= 45 ? 3 : 3;
      const r = clamp(base + ((h % 7) === 0 ? -1 : (h % 5) === 0 ? 1 : 0) + ((h % 11) === 0 ? 1 : 0), 1, 5);
      T.perf_ratings.push({ id: `pr:${p.id}:${period}`, person_id: p.id, period, rating: r, source: 'HR performance system mirror (SIMULATED)', listed: true });
    }
  }
  const rating = (pid) => T.perf_ratings.filter((r) => r.person_id === pid).sort((a, b) => cmp(b.period, a.period))[0]?.rating ?? null;

  // ── cycles and placements
  const people = T.people;
  const assignments = T.role_assignments;
  for (const cy of CYCLES) {
    const ids = membersOf(cy.family_ids, people, assignments, today);
    const placedOn = (pid) => `${cy.placed_on}${(hash(pid) % 9) + 1}`;

    const evAt = new Map(ids.map((pid) => [pid, evidenceOf(evIn(pid), placedOn(pid))]));
    const cuts = cutsOf(ids.map((pid) => evAt.get(pid).index));
    const outliers = new Set(ids.filter((pid) => hash(`${cy.id}:${pid}:o`) % 9 === 0));
    const rows = [];
    for (const pid of ids) {
      if (cy.status === 'open' && LEAVE_OPEN.has(pid)) continue;
      const placer = lineManagerOf(pid, people, assignments, today);
      if (!placer || placer === pid) continue;
      const ev = evAt.get(pid);
      const tier = !cuts ? 2 : ev.index <= cuts.low ? 1 : ev.index >= cuts.high ? 3 : 2;
      const h = hash(`${cy.id}:${pid}`);
      let anchors = Object.fromEntries(ANCHORS.map((k, i) => [k, clamp(tier + (((h >> (i * 3)) % 5) === 0 ? 1 : ((h >> (i * 3)) % 7) === 0 ? -1 : 0), 1, 3)]));
      if (outliers.has(pid)) anchors = tier === 1 ? { agility: 3, influence: 3, drive: 2 + (h % 2) } : tier === 3 ? { agility: 1, influence: 1, drive: 2 } : anchors;
      const potential = [anchors.agility, anchors.influence, anchors.drive].sort((a, b) => a - b)[1];
      const rec = rating(pid);
      const suggested = perfFromRating(rec) ?? 2;
      const deviate = h % 13 === 0;
      const perf = deviate ? clamp(suggested + (suggested === 3 ? -1 : 1), 1, 3) : suggested;
      const box = boxOf(perf, potential);
      const hipo = isHipo(perf, potential);
      const roleId = byId.get(pid).job_role_id;
      const gap = gapAction(pid, roleId);
      const actions = (hipo ? [ACT.estadad, ACT.hipoRot, ACT.leadMentor] : box === 7 ? [ACT.coachDelivery, ACT.stretch] : box >= 5 ? [ACT.stretch, ...(gap ? [gap] : [ACT.share])] : box === 4 || box === 2 ? [...(gap ? [gap] : []), ACT.coachDelivery] : [ACT.support, ...(gap ? [gap] : [])])
        .map(act).slice(0, 3);
      const ts = `${placedOn(pid)}T08:${String(10 + (h % 40)).padStart(2, '0')}:00Z`;
      const note = deviate ? 'Recent outage performance differs from the last HR rating; evidence attached in the review notes.' : outliers.has(pid) && tier !== 2 ? 'Strong view from the line; to be discussed at calibration.' : null;
      rows.push({
        id: `tp:${cy.id}:${pid}`, cycle_id: cy.id, person_id: pid, perf, potential, anchors, box, hipo, perf_record: rec, evidence_snapshot: ev, evidence_index: ev.index,
        placed_by: placer, placed_at: ts, calibrated: false, calibrated_by: null, calibrated_at: null, note, actions, status: 'placed',
        history: [{ at: ts, by: placer, action: 'placed', perf, potential, note }], listed: true, updated_at: ts,
      });
    }
    const cycle = {
      id: cy.id, code: cy.code, title_en: cy.title_en, title_ar: cy.title_ar, period: cy.period, family_ids: cy.family_ids, status: cy.status, opened_by: 'p-k-hr-analyst', opened_on: cy.opened_on, due_on: cy.due_on,
      calibration_started_at: null, calibration_started_by: null, calibrated_by: null, calibrated_at: null, locked_by: null, locked_at: null, lock_note: null, listed: true,
      created_at: `${cy.opened_on}T07:00:00Z`, updated_at: `${cy.opened_on}T07:00:00Z`,
    };
    if (cy.status !== 'open') {
      const cal = cy.status === 'locked' ? '2026-06-18T10:00:00Z' : '2026-10-06T11:30:00Z';
      Object.assign(cycle, { calibration_started_at: cy.status === 'locked' ? '2026-06-16T09:00:00Z' : '2026-10-05T09:00:00Z', calibration_started_by: 'p-k-hr-analyst', calibrated_by: 'p-k-hr-analyst', calibrated_at: cal, updated_at: cal });
      // calibration: the facilitator moves outliers whose evidence does not support the placement (with a reason)
      const flagged = rows.filter((r) => flagsOf(r.potential, r.evidence_index, cuts).length).slice(0, cy.status === 'locked' ? 3 : 2);
      for (const r of flagged) {
        const potential = r.potential === 3 ? 2 : 2;
        const note = r.potential === 3 ? 'Calibrated: evidence index is in the bottom third; potential held at 2 until growth evidence appears.' : 'Calibrated: strong evidence of growth and validated skills supports moderate potential.';
        Object.assign(r, { potential, box: boxOf(r.perf, potential), hipo: isHipo(r.perf, potential) });
        r.history.push({ at: cal, by: 'p-k-hr-analyst', action: 'calibrated', perf: r.perf, potential, note });
      }
      for (const r of rows) Object.assign(r, { calibrated: true, calibrated_by: 'p-k-hr-analyst', calibrated_at: cal, updated_at: cal });
      if (cy.status === 'locked') {
        const lockAt = '2026-06-30T12:00:00Z';
        Object.assign(cycle, { locked_by: 'p-chco', locked_at: lockAt, lock_note: 'Calibrated outcomes agreed with function heads; priorities shared with employees.', updated_at: lockAt });
        for (const r of rows) {
          r.status = 'locked';
          r.history.push({ at: lockAt, by: 'p-chco', action: 'locked' });
          r.updated_at = lockAt;
          T.talent_priorities.push({ id: `tpr:${cy.id}:${r.person_id}`, person_id: r.person_id, cycle_id: cy.id, period: cy.period, priorities: r.actions, agreed_on: '2026-06-30', status: 'agreed', listed: true, created_at: lockAt });
          if (r.hipo) T.talent_pool.push({ id: `pool:${cy.id}:${r.person_id}`, cycle_id: cy.id, person_id: r.person_id, pool: 'hipo', since: '2026-06-30', programme_id: 'prog-estadad', status: 'active', listed: true });
          T.notifications.push({ id: `nt-tpr-${cy.id}-${r.person_id}`, person_id: r.person_id, kind: 'talent', title_en: 'Development priorities agreed', title_ar: 'تم الاتفاق على أولويات التطوير', body_en: null, body_ar: null, link: '/my/development-priorities', severity: 'ok', created_at: lockAt, read_at: null });
        }
      }
    }
    T.review_cycles.push(cycle);
    T.review_placements.push(...rows);
  }

  // ── succession slates (2026-H2)
  const PERIOD = '2026-H2';
  const SLATES = [
    ['senior-reactor-operator', true, false, 'confirmed', 'khnp'],
    ['reactor-operator', true, false, 'confirmed', 'khnp'],
    ['local-operator', true, false, 'confirmed', null],
    ['shift-supervisor', true, true, 'proposed', 'khnp'],
    ['nuclear-training-instructor', true, false, 'proposed', null],
    ['radiation-protection-technician', true, false, 'confirmed', null],
    ['chemistry-technician', true, false, 'confirmed', 'contractor'],
    ['emergency-preparedness-coordinator', true, false, 'confirmed', null],
    ['shift-technical-advisor', false, true, 'proposed', null],
    ['outage-manager-planner', false, true, 'proposed', null],
    ['nuclear-oversight-npi', false, true, 'draft', null],
  ];
  const hrd = new Set(assignments.filter((a) => a.role === 'hr_director' && a.status === 'active').map((a) => a.person_id));
  const COVER = {
    khnp: ['KHNP secondee (role card), interim cover until 2030', 'معار من كيبكو للطاقة النووية (بطاقة دور)، تغطية مؤقتة حتى 2030'],
    contractor: ['Contracted chemistry technician (role card)', 'فني كيمياء متعاقد (بطاقة دور)'],
  };
  SLATES.forEach(([roleId, critical, leadership, status, cover], i) => {
    const role = roleById.get(roleId);
    const sid = `ss-${roleId}-2026h2`;
    const confirmedAt = `2026-10-0${2 + (i % 4)}T10:00:00Z`;
    T.succession_slates.push({
      id: sid, role_id: roleId, period: PERIOD, status, entity_id: 'enec-ops', family_id: role.family_id, critical, leadership,
      incumbent_en: `${role.title_en.split(' (')[0]}, Unit 1 (incumbent role card)`, incumbent_ar: `${role.title_ar.split(' (')[0]}، الوحدة 1 (بطاقة دور لشاغل المنصب)`,
      target_bench: roleId === 'local-operator' || roleId === 'reactor-operator' ? 4 : 3,
      confirmed_by: status === 'confirmed' ? 'p-chco' : null, confirmed_at: status === 'confirmed' ? confirmedAt : null,
      confirm_note: status === 'confirmed' ? 'Readiness confirmed with the function head.' : null, listed: true, sort: i + 1, updated_at: status === 'confirmed' ? confirmedAt : '2026-09-30T10:00:00Z',
    });
    if (status === 'draft') return;
    const feeders = feederRoles(roleId, T.career_paths);
    const cand = staff
      .filter((p) => !hrd.has(p.id) && (p.job_role_id === roleId || feeders.includes(p.job_role_id)))
      .map((p) => {
        const cr = careerReadiness(careerData(p.id), p.id, [roleId], today)[0] ?? null;
        const gates = hardGatesOf(roleId, { person: p, licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records }, cr, today);
        return { p, cr, gates, readiness: readinessOf(cr, gates), peer: p.job_role_id === roleId };
      })
      .sort((a, b) => ({ ready_now: 0, '1_2y': 1, '3_5y': 2 })[a.readiness] - ({ ready_now: 0, '1_2y': 1, '3_5y': 2 })[b.readiness] || (b.cr?.pct ?? 0) - (a.cr?.pct ?? 0) || cmp(a.p.id, b.p.id));
    const peers = cand.filter((c) => c.peer).slice(0, 2);
    const feeds = cand.filter((c) => !c.peer).slice(0, roleId === 'nuclear-oversight-npi' || roleId === 'outage-manager-planner' || roleId === 'shift-supervisor' ? 3 : 2);
    let picked = [...peers, ...feeds];
    if (roleId === 'shift-supervisor' || roleId === 'outage-manager-planner' || roleId === 'shift-technical-advisor') picked = feeds.length ? feeds : peers; // succession from the feeder roles
    if (['shift-supervisor', 'outage-manager-planner'].includes(roleId) && !picked.some((c) => c.p.id === 'w-sro-02')) {
      const c = cand.find((x) => x.p.id === 'w-sro-02');
      if (c) picked.push(c);
    }
    const sorted = picked.sort((a, b) => ({ ready_now: 0, '1_2y': 1, '3_5y': 2 })[a.readiness] - ({ ready_now: 0, '1_2y': 1, '3_5y': 2 })[b.readiness] || cmp(a.p.id, b.p.id));
    const emergencyId = !cover ? sorted.find((c) => c.readiness === 'ready_now')?.p.id ?? null : null;
    sorted.forEach((c, j) => {
      const ts = `2026-09-${String(22 + (j % 6)).padStart(2, '0')}T09:00:00Z`;
      const g = c.cr?.gaps?.[0];
      const course = g ? courseFor(g.competency_id) : null;
      const actions = [
        ...(course ? [{ kind: 'training', title_en: course.title_en, title_ar: course.title_ar, ref_table: 'courses', ref_id: course.id }] : []),
        ...(c.readiness !== 'ready_now' ? [{ kind: 'rotation', title_en: `Rotation into ${role.title_en.split(' (')[0]} duties (3 months)`, title_ar: `تدوير في مهام ${role.title_ar.split(' (')[0]} (3 أشهر)`, ref_table: null, ref_id: null }] : []),
        { kind: 'mentoring', title_en: 'Knowledge-transfer mentoring with the incumbent', title_ar: 'إرشاد لنقل المعرفة مع شاغل المنصب', ref_table: null, ref_id: null },
      ];
      T.successors.push({
        id: `sx:${sid}:${c.p.id}`, slate_id: sid, person_id: c.p.id, cover_source: 'internal', cover_label_en: '', cover_label_ar: '', readiness: c.readiness, computed_readiness: c.readiness,
        readiness_pct: c.cr?.pct ?? null, months: c.cr?.months ?? null, gates: c.gates, gaps: (c.cr?.gaps ?? []).slice(0, 5), emergency: c.p.id === emergencyId, actions, note: null,
        status: status === 'confirmed' ? 'confirmed' : 'proposed', proposed_by: 'p-chco', proposed_at: ts, confirmed_by: status === 'confirmed' ? 'p-chco' : null, confirmed_at: status === 'confirmed' ? confirmedAt : null,
        person_name: c.p.display_name, person_name_ar: c.p.display_name_ar || c.p.display_name, person_role_id: c.p.job_role_id, listed: true, sort: j + 1, updated_at: status === 'confirmed' ? confirmedAt : ts,
      });
    });
    if (cover) {
      T.successors.push({
        id: `sx:${sid}:ext-${cover}`, slate_id: sid, person_id: null, cover_source: cover, cover_label_en: COVER[cover][0], cover_label_ar: COVER[cover][1], readiness: null, computed_readiness: null,
        readiness_pct: null, months: null, gates: [], gaps: [], emergency: true, actions: [], note: 'Emergency cover only; internal bench to be built.', status: status === 'confirmed' ? 'confirmed' : 'proposed',
        proposed_by: 'p-chco', proposed_at: '2026-09-28T09:00:00Z', confirmed_by: status === 'confirmed' ? 'p-chco' : null, confirmed_at: status === 'confirmed' ? confirmedAt : null,
        person_name: '', person_name_ar: '', person_role_id: null, listed: true, sort: 99, updated_at: status === 'confirmed' ? confirmedAt : '2026-09-28T09:00:00Z',
      });
    }
  });

  // ── bench roll-up of the confirmed critical slates into M07 critical_roles (period 2026-H2)
  const rolledAt = '2026-10-06T14:00:00Z';
  for (const s of T.succession_slates.filter((x) => x.critical && x.status === 'confirmed').sort((a, b) => cmp(a.role_id, b.role_id))) {
    const k = benchCounts(s.id, T.successors);
    const cid = critId(s.role_id, PERIOD);
    const after = { target_bench: s.target_bench, ...k };
    T.critical_roles.push({ id: cid, role_id: s.role_id, period: PERIOD, ...after, source: 'Succession slates (F19 roll-up)', sample: true });
    T.bench_rollups.push({ id: `br:${PERIOD}:${s.role_id}`, period: PERIOD, role_id: s.role_id, slate_id: s.id, critical_role_id: cid, before: {}, after, rolled_by: 'p-chco', rolled_at: rolledAt, listed: true });
  }
}
