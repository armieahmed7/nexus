// FS81 (FS wave I · E3, M30) Transition plans and ladder-rung protection seed.
//   transition_plans  10 SIMULATED HR records for synthetic people and role cards whose role is changing (no real person, no HR system):
//                     protected role (the current role, kept while they retrain) and until when, target role, horizon, why, retraining
//                     steps from the course catalogue, dated reviews at most 183 days apart, and, for Mastery Builder roles, the synthetic
//                     practice that covers every ladder-rung alert (rungAlert(), the same rule as SQL kafaa_tp_alert): approved simulator
//                     scenarios for the role's position and OJT repetitions of qualification-card tasks.
//   Mix: 7 active (k-ro RO -> SRO; k-lo-trainee LO -> RO; sro shift supervisor -> the concept small BWR operator role, 2035, protected-
//   role alert; qc-inspector QA/QC -> procurement, no alert; w-lo-02 with an overdue review; w-chem-02; w-mnt-03 with OJT repetitions
//   already logged), 1 draft that cannot be activated yet (w-ro-01: practice missing for some alerted tasks), 1 completed (w-rp-02) and
//   1 withdrawn (w-fire-01). w-ro-01 and w-lo-02 are in crew B, the scope of the shift supervisor role card (sro): managers read none.
// Runs as a FINALIZE_LAST finalizer (after fs06, which rates the JTA tasks and adds the task-skill links). Practice is chosen from the
// options computed on the task links of kind "current" only, so the later fsqa1 re-pointing of future links (which can only add
// overlaps) keeps every seeded choice valid; tests and the PGlite validator check full coverage on the final seed.
// Dates: everything is dated on or before 2026-10-11 (reviews ahead are planned dates). Seeded rows write no notification, so the F36
// digests and every other table are unchanged.
import { OJT_REPS, SIM_REPS, nextReview, planAlert, planProblem, rungAlert } from '../../../src/modules/m30/transition.ts';

export const FINALIZE_LAST = true;
export default function build() {}

const HR = 'p-chco';
const at = (d, t = '09:00:00') => `${d}T${t}Z`;
const course = (T, id, due, hours) => {
  const c = T.courses.find((x) => x.id === id);
  if (!c) throw new Error(`fs81: course ${id} missing`);
  return { kind: 'course', ref_id: id, title_en: c.title_en, title_ar: c.title_ar, hours: hours ?? Number(c.duration_hours), due_on: due };
};
const item = (kind, en, ar, hours, due, ref = null) => ({ kind, ref_id: ref, title_en: en, title_ar: ar, hours, due_on: due });
const rev = (due, done = null, outcome = null, note = null) => ({ due_on: due, done_on: done, outcome, note, by: done ? HR : null });

const PLANS = (T) => [
  {
    id: 'tp-p-k-ro-1', person_id: 'p-k-ro', target_role_id: 'senior-reactor-operator', horizon: '2030', trigger: 'task_automation', protected_until: '2027-12-31',
    start_on: '2026-06-01', end_on: '2028-05-31', status: 'active', acknowledged_at: at('2026-06-05', '07:40:00'), activated: '2026-06-02', cover: 'all',
    reviews: [rev('2026-09-01', '2026-09-01', 'on_track', 'Simulator runs booked with the COCT cycle; rounds practice on track.'), rev('2026-12-01'), rev('2027-05-31'), rev('2027-11-30'), rev('2028-05-15')],
    retraining: [course(T, 'c-exec-sim', '2026-12-15'), course(T, 'c-fs-aiverify', '2026-11-30'), course(T, 'c-mcc', '2027-06-30'),
      item('practice', 'Guided practice: directing the crew through abnormal procedures on the simulator', 'ممارسة موجّهة: توجيه الطاقم خلال إجراءات الحالات غير الطبيعية على المحاكي', 40, '2027-11-30')],
    note_en: 'Control-room routine logging and surveillance checks move to tools by 2030; the plan keeps the judgement they built with simulator runs and supervised repetitions.',
    note_ar: 'تنتقل التسجيلات الروتينية في غرفة التحكم وفحوص المراقبة إلى الأدوات بحلول 2030؛ وتحافظ الخطة على الحكم المهني الذي بنته عبر جلسات المحاكي والتكرارات تحت الإشراف.',
  },
  {
    id: 'tp-p-k-lo-trainee-1', person_id: 'p-k-lo-trainee', target_role_id: 'reactor-operator', horizon: '2030', trigger: 'task_automation', protected_until: '2027-07-31',
    start_on: '2026-08-01', end_on: '2028-07-31', status: 'active', acknowledged_at: null, activated: '2026-08-03', cover: 'all',
    reviews: [rev('2026-11-15'), rev('2027-05-01'), rev('2027-10-15'), rev('2028-04-01')],
    retraining: [course(T, 'c-fs-plantdata', '2027-01-31'), course(T, 'c-loct', '2027-06-30', 120), course(T, 'c-ai-gov', '2026-10-31')],
    note_en: 'Operator rounds and turnover logging are being automated; repetitions on the watch station and limited-scope simulator scenarios keep the field feel that reactor operators need.',
    note_ar: 'تجري أتمتة جولات المشغّل وتسجيل التسليم؛ وتحافظ التكرارات في موقع المناوبة وسيناريوهات المحاكي محدودة النطاق على الإحساس الميداني الذي يحتاجه مشغّلو المفاعل.',
  },
  {
    id: 'tp-p-sro-1', person_id: 'p-sro', target_role_id: 'fr-bwr-operator', horizon: '2035', trigger: 'new_technology', protected_until: '2028-12-31',
    start_on: '2026-07-01', end_on: '2029-06-30', status: 'active', acknowledged_at: at('2026-07-06', '06:15:00'), activated: '2026-07-01', cover: 'all',
    reviews: [rev('2026-10-20'), rev('2027-04-15'), rev('2027-10-10'), rev('2028-04-05'), rev('2028-10-01'), rev('2029-03-30')],
    retraining: [course(T, 'c-fs-smr', '2027-03-31'), course(T, 'c-fs-passive', '2027-09-30'), course(T, 'c-adv-smr', '2026-12-31'), course(T, 'c-fs-remote', '2028-03-31')],
    note_en: 'A concept role for planning only (no deployment decision implied). While the role is explored, the shift supervisor role stays protected and surveillance-package reviews stay in hand on the simulator.',
    note_ar: 'دور مفاهيمي لأغراض التخطيط فقط (لا يعني أي قرار بالنشر). وأثناء استكشاف الدور يبقى دور مشرف الوردية محمياً وتبقى مراجعة حزم المراقبة متقنة على المحاكي.',
  },
  {
    id: 'tp-p-qc-inspector-1', person_id: 'p-qc-inspector', target_role_id: 'procurement-engineer', horizon: '2030', trigger: 'career_move', protected_until: '2027-04-30',
    start_on: '2026-05-01', end_on: '2027-10-31', status: 'active', acknowledged_at: at('2026-05-04', '10:05:00'), activated: '2026-05-01', cover: 'all',
    reviews: [rev('2026-08-01', '2026-08-03', 'on_track', 'Digital procurement course done; supplier audit shadowing booked.'), rev('2026-11-01'), rev('2027-04-30'), rev('2027-10-15')],
    retraining: [course(T, 'c-fs-procure', '2026-09-30'), course(T, 'c-fs-factoryqa', '2027-01-31'), item('rotation', 'Rotation: four weeks with the procurement team', 'تناوب: أربعة أسابيع مع فريق المشتريات', 160, '2027-04-30')],
    note_en: 'A career move into procurement engineering that builds on quality-control experience.',
    note_ar: 'انتقال مهني إلى هندسة المشتريات يبني على خبرة مراقبة الجودة.',
  },
  {
    id: 'tp-w-lo-02-1', person_id: 'w-lo-02', target_role_id: 'operations-support-work-control', horizon: '2030', trigger: 'task_automation', protected_until: '2027-03-31',
    start_on: '2026-04-01', end_on: '2027-09-30', status: 'active', acknowledged_at: at('2026-04-06', '08:20:00'), activated: '2026-04-01', cover: 'all',
    reviews: [rev('2026-07-01', '2026-07-02', 'on_track', 'Work-control shadowing started.'), rev('2026-10-01'), rev('2027-03-15'), rev('2027-09-10')],
    retraining: [course(T, 'c-fs-dataquality', '2026-09-30'), item('rotation', 'Rotation: work control centre, six weeks', 'تناوب: مركز التحكم في الأعمال، ستة أسابيع', 240, '2027-01-31'), course(T, 'c-fs-aiverify', '2026-12-31')],
    note_en: 'Routine rounds move to robotics and automated logging; the person moves towards work control and keeps field repetitions while the local operator role stays protected.',
    note_ar: 'تنتقل الجولات الروتينية إلى الروبوتات والتسجيل الآلي؛ ويتجه الموظف نحو التحكم في الأعمال مع الحفاظ على التكرارات الميدانية بينما يبقى دور المشغّل المحلي محمياً.',
  },
  {
    id: 'tp-w-chem-02-1', person_id: 'w-chem-02', target_role_id: 'environmental-monitoring-specialist', horizon: '2030', trigger: 'role_redesign', protected_until: '2027-06-30',
    start_on: '2026-07-15', end_on: '2027-12-31', status: 'active', acknowledged_at: at('2026-07-20', '09:30:00'), activated: '2026-07-15', cover: 'all',
    reviews: [rev('2026-12-15'), rev('2027-06-01'), rev('2027-12-01')],
    retraining: [course(T, 'c-chem-cont', '2026-12-31'), course(T, 'c-fs-plantdata', '2027-03-31')],
    note_en: 'Laboratory analysis and quality-control charting are partly automated; OJT repetitions keep the analyst able to challenge an instrument result.',
    note_ar: 'تجري أتمتة جزء من التحاليل المخبرية ومخططات ضبط الجودة؛ وتحافظ تكرارات التدريب أثناء العمل على قدرة المحلل على مساءلة نتيجة الجهاز.',
  },
  {
    id: 'tp-w-mnt-03-1', person_id: 'w-mnt-03', target_role_id: 'systems-design-plant-engineer', horizon: '2030', trigger: 'role_redesign', protected_until: '2027-08-31',
    start_on: '2026-03-01', end_on: '2028-02-29', status: 'active', acknowledged_at: at('2026-03-03', '11:00:00'), activated: '2026-03-02', cover: 'all',
    reviews: [rev('2026-06-01', '2026-06-01', 'on_track', 'Pump overhaul repetitions logged with the preceptor.'), rev('2026-11-30'), rev('2027-05-31'), rev('2027-11-30'), rev('2028-02-15')],
    retraining: [course(T, 'c-eng-cont', '2026-12-31'), course(T, 'c-fs-twin', '2027-06-30'), course(T, 'c-fs-xr', '2026-11-30')],
    note_en: 'Work-package documentation and tool-crib logging move to digital tools; overhaul repetitions keep hands-on judgement while the move to plant engineering builds up.',
    note_ar: 'تنتقل وثائق حزم العمل وسجل مخزن الأدوات إلى الأدوات الرقمية؛ وتحافظ تكرارات العَمرة على الحكم العملي أثناء الانتقال التدريجي إلى هندسة المحطة.',
  },
  {
    id: 'tp-w-ro-01-1', person_id: 'w-ro-01', target_role_id: 'senior-reactor-operator', horizon: '2030', trigger: 'task_automation', protected_until: '2028-03-31',
    start_on: '2026-11-01', end_on: '2028-10-31', status: 'draft', acknowledged_at: null, activated: null, cover: 3, created: '2026-10-06',
    reviews: [rev('2027-02-01'), rev('2027-08-01'), rev('2028-01-31'), rev('2028-07-31')],
    retraining: [course(T, 'c-exec-sim', '2027-03-31'), course(T, 'c-estadad', '2028-01-31')],
    note_en: 'Draft: practice is still to be chosen for some junior tasks before the plan can be activated.',
    note_ar: 'مسودة: لا يزال يتعين اختيار الممارسة لبعض المهام المبتدئة قبل تفعيل الخطة.',
  },
  {
    id: 'tp-w-rp-02-1', person_id: 'w-rp-02', target_role_id: 'environmental-monitoring-specialist', horizon: '2030', trigger: 'career_move', protected_until: '2026-08-31',
    start_on: '2025-10-01', end_on: '2026-09-30', status: 'completed', acknowledged_at: at('2025-10-03', '08:00:00'), activated: '2025-10-01', cover: 'all',
    closed: '2026-09-30', close_note: 'Completed: the person now works in environmental monitoring two days a week and keeps the RP survey repetitions.',
    reviews: [rev('2026-01-15', '2026-01-14', 'on_track', 'Dose calculation repetitions logged.'), rev('2026-06-15', '2026-06-16', 'at_risk', 'Two survey repetitions moved to July.'), rev('2026-09-15', '2026-09-17', 'on_track', 'All practice done.')],
    retraining: [course(T, 'c-rp-cont', '2026-03-31'), course(T, 'c-fs-ghg', '2026-06-30')],
    note_en: 'Completed plan kept for the record.', note_ar: 'خطة مكتملة محفوظة للسجل.',
  },
  {
    id: 'tp-w-fire-01-1', person_id: 'w-fire-01', target_role_id: 'emergency-preparedness-coordinator', horizon: '2030', trigger: 'career_move', protected_until: '2027-05-31',
    start_on: '2026-06-01', end_on: '2027-11-30', status: 'withdrawn', acknowledged_at: null, activated: null, cover: 'all',
    closed: '2026-08-20', close_note: 'Withdrawn at the person\'s request: they stay with the fire brigade for now.',
    reviews: [rev('2026-11-30'), rev('2027-05-31'), rev('2027-11-15')],
    retraining: [course(T, 'c-ero', '2026-10-31'), course(T, 'c-ero-drill', '2026-12-31')],
    note_en: 'Plan drafted after the fire-protection impairment workflow was digitised.', note_ar: 'أُعدّت الخطة بعد رقمنة سير عمل تقييم تعطّل أنظمة الحماية من الحريق.',
  },
];

export function finalize(T) {
  const world = (links) => ({ roles: T.job_roles, maps: T.role_transformations, paths: T.career_paths, tasks: T.jta_tasks, levels: T.ai_capability_levels, taskSkills: links, skills: T.skills, scenarios: T.sim_scenarios });
  const robust = world((T.jta_task_skills ?? []).filter((x) => (x.kind ?? 'current') === 'current'));
  const full = world(T.jta_task_skills ?? []);
  const rows = [];
  const counts = { alerts: 0, tasks: 0, practice: 0 };
  for (const p of PLANS(T)) {
    const person = T.people.find((x) => x.id === p.person_id);
    if (!person || person.kind !== 'staff' || person.status !== 'active') throw new Error(`fs81: ${p.person_id} is not an active staff member`);
    const prot = person.job_role_id;
    // practice: own-task OJT, the best simulator scenario, else the best sibling OJT (robust options)
    const a = planAlert({ target_role_id: p.target_role_id, protected_role_id: prot, horizon: p.horizon, practice: [] }, robust);
    const practice = [];
    a.tasks.forEach((t, i) => {
      if (p.cover !== 'all' && i >= p.cover) return;
      const ojtOwn = t.options.find((o) => o.kind === 'ojt' && o.basis === 'own_task');
      const sim = t.options.find((o) => o.kind === 'simulator');
      const sib = t.options.find((o) => o.kind === 'ojt' && o.basis === 'shared_skill');
      if (sim) practice.push({ task_id: t.task_id, kind: 'simulator', ref_id: sim.ref_id, reps: SIM_REPS.def });
      if (ojtOwn) practice.push({ task_id: t.task_id, kind: 'ojt', ref_id: ojtOwn.ref_id, reps: OJT_REPS.def });
      else if (!sim && sib) practice.push({ task_id: t.task_id, kind: 'ojt', ref_id: sib.ref_id, reps: OJT_REPS.def });
    });
    if (a.fires) counts.alerts++;
    counts.tasks += a.tasks.length;
    counts.practice += practice.length;
    const check = planProblem({
      person_id: p.person_id, protected_role_id: prot, protected_until: p.protected_until, target_role_id: p.target_role_id, horizon: p.horizon, trigger: p.trigger,
      start_on: p.start_on, end_on: p.end_on, review_dates: p.reviews.filter((r) => !r.done_on).map((r) => r.due_on), retraining: p.retraining, practice,
      note_en: p.note_en, note_ar: p.note_ar, activate: p.status === 'active' || p.status === 'completed',
    }, { id: p.id, person_id: p.person_id, reviews: p.reviews }, { me: HR, people: T.people, plans: [], courseIds: T.courses.map((c) => c.id), world: robust });
    if (check) throw new Error(`fs81: seeded plan ${p.id} fails planProblem: ${check}`);
    if (p.status === 'draft' && rungAlert(a.role_id, p.horizon, practice, full).uncovered.length === 0) throw new Error(`fs81: draft ${p.id} should show uncovered tasks`);
    const created = at(p.created ?? p.activated ?? p.start_on, '08:00:00');
    const history = [{ at: created, by: HR, action: p.activated ? 'create_activate' : 'create', status: p.activated ? 'active' : 'draft', revision: 1 }];
    let revision = 1;
    for (const r of p.reviews.filter((x) => x.done_on)) history.push({ at: at(r.done_on, '12:00:00'), by: HR, action: 'review', status: 'active', revision: ++revision, outcome: r.outcome });
    if (p.acknowledged_at) history.push({ at: p.acknowledged_at, by: p.person_id, action: 'acknowledge', status: 'active', revision });
    if (p.closed) history.push({ at: at(p.closed, '13:00:00'), by: HR, action: p.status === 'completed' ? 'complete' : 'withdraw', status: p.status, revision: ++revision });
    history.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
    rows.push({
      id: p.id, person_id: p.person_id, current_role_id: prot, protected_role_id: prot, protected_until: p.protected_until, target_role_id: p.target_role_id, horizon: p.horizon, trigger: p.trigger,
      start_on: p.start_on, end_on: p.end_on, reviews: p.reviews, next_review_on: p.closed ? null : nextReview(p.reviews), retraining: p.retraining, practice,
      note_en: p.note_en, note_ar: p.note_ar, status: p.status, simulated: true, acknowledged_at: p.acknowledged_at, revision, history,
      created_by: HR, created_at: created, updated_by: HR, updated_at: history[history.length - 1].at, activated_by: p.activated ? HR : null, activated_at: p.activated ? at(p.activated, '08:00:00') : null,
      closed_by: p.closed ? HR : null, closed_at: p.closed ? at(p.closed, '13:00:00') : null, close_note: p.close_note ?? null,
    });
  }
  T.transition_plans = rows.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  console.log(`fs81: ${rows.length} SIMULATED transition plans (${rows.filter((r) => r.status === 'active').length} active, 1 draft, 1 completed, 1 withdrawn); ${counts.alerts} ladder-rung alerts naming ${counts.tasks} junior tasks, ${counts.practice} practice items added`);
}
