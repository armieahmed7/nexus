// [W2 · E2] F12 Career conversations seed (kafaa_career_conversations), built in finalize after F01 has derived every skill state, so
// the agenda snapshots come from the same pure builder the RPCs use (src/modules/m18/conversations.ts). Synthetic people only.
// For each pair of an active staff member and their line manager of record (F08's rule): a history of conversations with
// preparation, agenda, notes, agreed actions (from the deterministic suggestions) and the acknowledgement; open conversations in
// every state (private draft, shared preparation, held and awaiting acknowledgement); overdue pairs with this month's reminder.
// Agreed actions of held conversations are mirrored in M04 development plans as the RPC would write them (dp-cc-*, pa-cc-*).
import { buildAgenda, suggestActions, pairsOf, cadenceState, cycleOf, addDaysIso, lastHeldOf, planIdFor, activityId } from '../../../src/modules/m18/conversations.ts';

export const FINALIZE_LAST = true; // after f01-skills.mjs finalize (name order inside the "last" group), so person_skills exist

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const pick = (arr, h) => arr[h % arr.length];
const ts = (d, hh = '09') => `${d}T${hh}:30:00Z`;

const GOALS = {
  stay_deepen: [['Become the go-to person on our main systems and coach new joiners on them', 'أن أصبح المرجع في أنظمتنا الرئيسية وأن أدرّب المنضمين الجدد عليها'], ['Master the procedures I use most and help revise two of them', 'إتقان الإجراءات التي أستخدمها أكثر والمساعدة في مراجعة اثنين منها']],
  grow_vertical: [['Be ready for the next role on my ladder within 18 months', 'أن أكون جاهزاً للدور التالي في مساري خلال 18 شهراً'], ['Close my competency gaps for the next step and meet its entry conditions', 'سد فجوات الكفاءة للخطوة التالية واستيفاء شروط الدخول إليها']],
  move_lateral: [['Try a neighbouring discipline through a rotation before choosing my next step', 'تجربة تخصص مجاور عبر تدوير وظيفي قبل اختيار خطوتي التالية'], ['Move into a role that uses my experience in a new way', 'الانتقال إلى دور يستفيد من خبرتي بطريقة جديدة']],
  lead: [['Lead a small team or a crew task and get feedback on it', 'قيادة فريق صغير أو مهمة للطاقم والحصول على ملاحظات'], ['Prepare for a supervisory role with leadership training', 'الاستعداد لدور إشرافي من خلال تدريب قيادي']],
  specialise: [['Specialise in one technical area and become a recognised expert', 'التخصص في مجال تقني واحد وأن أصبح خبيراً معترفاً به'], ['Build deep expertise in digital systems for the plant', 'بناء خبرة عميقة في الأنظمة الرقمية للمحطة']],
};
const LONG = [['Hold a senior position where I help shape how we train the next generation', 'أن أشغل منصباً أعلى أساهم فيه في تشكيل طريقة تدريب الجيل القادم'], ['Be trusted with more responsibility on site and in outages', 'أن أُكلَّف بمسؤوليات أكبر في الموقع وخلال فترات الصيانة'], ['Lead a team in my area of expertise', 'قيادة فريق في مجال خبرتي']];
const NOTES = [
  ['We agreed the next step and what evidence will show readiness. Progress is good; the gaps are clear and realistic.', 'اتفقنا على الخطوة التالية وعلى الأدلة التي تُظهر الجاهزية. التقدم جيد والفجوات واضحة وواقعية.'],
  ['Strong performance this half. We discussed the aspiration openly and matched it with two concrete actions.', 'أداء قوي في هذا النصف. ناقشنا التطلعات بصراحة وربطناها بإجراءين محددين.'],
  ['Good conversation. Workload in the next outage limits time for courses, so we spread the actions over the year.', 'حوار جيد. عبء العمل في فترة الصيانة القادمة يحدّ من وقت الدورات، لذا وزعنا الإجراءات على مدار السنة.'],
];
const DISAGREE = [['I see the timeline as shorter: my licence months already count towards the gate.', 'أرى أن الجدول الزمني أقصر: أشهر الترخيص لديّ تُحتسب بالفعل ضمن الشرط.'], ['I would like the rotation earlier than planned.', 'أرغب في أن يكون التدوير الوظيفي أبكر مما هو مخطط.']];

/** [kind, held/prep dates...] per persona: deterministic, demo-friendly states. */
const PERSONAS = {
  'p-k-ro': { hist: [['2025-10-20', true], ['2026-04-14', true]], open: { kind: 'draft_private', on: '2026-10-06' }, asp: ['grow_vertical', 'lead'], mob: 'current_site', share: true },
  'p-qc-inspector': { hist: [['2026-03-10', true]], open: { kind: 'shared', on: '2026-10-02' }, asp: ['move_lateral', 'specialise'], mob: 'other_sites', share: false },
  'p-sq-lead': { hist: [['2026-03-18', true]], open: { kind: 'held', on: '2026-09-29' }, asp: ['lead', 'grow_vertical'], mob: 'current_site', share: true },
  'p-outage-planner': { hist: [['2026-02-16', true]], open: { kind: 'shared', on: '2026-10-05' }, asp: ['grow_vertical'], mob: 'any', share: true },
  'p-nse': { hist: [], open: null, asp: ['specialise'], mob: 'current_site', share: false },
  'p-k-lo-trainee': { hist: [['2026-06-02', false]], open: null, asp: ['grow_vertical'], mob: 'current_site', share: false },
  'p-sro': { hist: [['2026-01-25', true], ['2026-07-20', true]], open: null, asp: ['lead', 'stay_deepen'], mob: 'current_site', share: true },
  'p-buyer': { hist: [['2026-05-11', true]], open: null, asp: ['grow_vertical', 'specialise'], mob: 'other_sites', share: true },
};
const ASP_W = [['grow_vertical', 35], ['stay_deepen', 22], ['move_lateral', 15], ['lead', 15], ['specialise', 13]];
const weighted = (h) => { let x = h % 100; for (const [k, w] of ASP_W) { if (x < w) return k; x -= w; } return 'grow_vertical'; };
const dateIn = (from, days, h) => addDaysIso(from, h % days);

export default function build(T) {
  T.career_conversations = [];
}

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const byId = new Map(T.people.map((p) => [p.id, p]));
  const roleById = new Map(T.job_roles.map((r) => [r.id, r]));
  const compById = new Map(T.competencies.map((c) => [c.id, c]));
  const stdById = new Map(T.qual_standards.map((s) => [s.id, s]));
  const data = (personId) => ({
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills,
    states: T.person_skills.filter((s) => s.person_id === personId), licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes,
    courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments, weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
    skillRows: T.skills, competencyRows: T.competencies, personSkills: T.person_skills.filter((s) => s.person_id === personId), targets: T.career_targets ?? [], roadmaps: T.roadmaps ?? [],
    qualRows: T.qual_records, standardRows: T.qual_standards, goals: T.learning_goals ?? [], feedback: T.coach_feedback ?? [], training: T.training_records,
    conversations: T.career_conversations.filter((c) => c.person_id === personId),
  });
  const title = (m, id, en = 'title_en', ar = 'title_ar') => { const r = m.get(id); return { en: r?.[en] ?? id, ar: r?.[ar] ?? id }; };
  const roleTitle = (id) => title(roleById, id);
  const compName = (id) => title(compById, id, 'name_en', 'name_ar');
  const stdTitle = (id) => title(stdById, id);
  const staffCourses = T.courses.filter((c) => c.audience === 'staff');
  const plans = [], acts = [], notes = [];
  const reach = (p) => (T.career_paths.find((e) => e.from_role_id === p.job_role_id && !roleById.get(e.to_role_id)?.security_sensitive)?.to_role_id) ?? null;

  const prepOf = (p, h, asp, mob, include = { targets: true, roadmap: true, coach: true }) => {
    const ar = p.language === 'ar' ? 1 : 0;
    const g = pick(GOALS[asp[0]], h)[ar];
    const sup = ['course', 'mentoring', 'rotation', 'stretch', 'coaching', 'time'].filter((_, i) => ((h >>> (i + 2)) & 3) === 0).slice(0, 3);
    if (asp[0] === 'lead' && !sup.includes('coaching')) sup.push('coaching');
    return {
      aspirations: asp, mobility: mob, shift_ok: (h & 1) === 0, rotation_ok: asp.includes('move_lateral') || (h & 6) === 0, leadership: asp.includes('lead') ? 'ready' : (h % 3 === 0 ? 'curious' : 'not_now'),
      goal_12m: g, goal_3y: pick(LONG, h >>> 4)[ar], support: ['course', 'mentoring', 'rotation', 'stretch', 'coaching', 'time', 'other'].filter((s) => sup.includes(s)),
      support_note: '', topics: '', include,
    };
  };

  for (const { person_id, manager_id } of pairsOf(T.people, T.role_assignments, today)) {
    const p = byId.get(person_id);
    const m = byId.get(manager_id);
    const h = hash(person_id);
    const persona = PERSONAS[person_id];
    // history: [held_on, agrees][], open state
    let hist, open, asp, mob, share;
    if (persona) ({ hist, open, asp, mob, share } = persona);
    else {
      const k = h % 20;
      const recent = dateIn('2026-04-15', 168, h >>> 3);
      const older = dateIn('2025-09-01', 200, h >>> 5);
      const prior = addDaysIso(recent, -175 - ((h >>> 7) % 20));
      asp = [weighted(h >>> 2)];
      if ((h >>> 9) % 3 === 0) { const s = weighted(h >>> 11); if (s !== asp[0]) asp.push(s); }
      mob = ['current_site', 'current_site', 'other_sites', 'any', 'current_site', 'other_sites'][(h >>> 13) % 6];
      share = (h >>> 15) % 5 < 2;
      const agrees = (h >>> 17) % 9 !== 0;
      if (k <= 10) { hist = (h >>> 6) % 2 ? [[prior, true], [recent, agrees]] : [[recent, agrees]]; open = null; }
      else if (k <= 12) { hist = [[prior, true]]; open = { kind: 'held', on: dateIn('2026-09-10', 26, h >>> 4), prep: null }; }
      else if (k <= 14) { hist = [[older, true]]; open = { kind: 'shared', on: dateIn('2026-09-15', 20, h >>> 4) }; }
      else if (k === 15) { hist = [[older, true]]; open = { kind: 'draft_private', on: dateIn('2026-09-20', 15, h >>> 4) }; }
      else if (k <= 18) { hist = [[older, agrees]]; open = null; }
      else { hist = []; open = null; }
    }
    const target = (T.career_targets ?? []).filter((t) => t.person_id === person_id && t.active && !roleById.get(t.role_id)?.security_sensitive).sort((a, b) => a.rank - b.rank)[0]?.role_id ?? reach(p);
    const done = new Set(T.training_records.filter((r) => r.person_id === person_id && ['passed', 'completed'].includes(r.result)).map((r) => r.course_id));
    const mk = (n, on) => ({
      id: `cc-${person_id}-${cycleOf(on).toLowerCase()}${n ? `-${n}` : ''}`, person_id, manager_person_id: manager_id, manager_read_id: null, cycle: cycleOf(on), status: 'draft',
      person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, manager_name: m.display_name, manager_name_ar: m.display_name_ar || m.display_name,
      prep: {}, prep_submitted_at: null, agenda: {}, held_on: null, notes: null, actions: [], focus_role_id: null, coach_hours: null, plan_id: null, recorded_at: null,
      employee_agrees: null, employee_comment: null, acknowledged_at: null, share_with_talent_review: false, created_at: ts(on, '07'), updated_at: ts(on, '07'),
    });
    const record = (row, heldOn, hh, withPrep, stage) => {
      const prepOn = addDaysIso(heldOn, -5);
      const prep = withPrep ? prepOf(p, hh, asp, mob) : {};
      const agenda = buildAgenda(data(person_id), person_id, withPrep ? { targets: true, roadmap: true, coach: true, sharedOnly: false } : { targets: true, roadmap: true, coach: false, sharedOnly: true }, withPrep ? prepOn : heldOn);
      const sugg = suggestActions(agenda, prep, staffCourses, roleTitle, compName, stdTitle, done, heldOn).slice(0, 2 + (hh % 2));
      const actions = sugg.map((s, i) => ({ id: `a${i + 1}`, ...s.item }));
      const focus = target && !roleById.get(target)?.security_sensitive ? target : null;
      const planTarget = focus ?? p.job_role_id;
      Object.assign(row, {
        status: 'held', prep, prep_submitted_at: withPrep ? ts(prepOn, '15') : null, agenda, held_on: heldOn, notes: pick(NOTES, hh)[m.language === 'ar' ? 1 : 0], actions,
        focus_role_id: focus, coach_hours: (hh >>> 3) % 3 === 0 ? null : [2, 3, 4][(hh >>> 5) % 3], manager_read_id: manager_id, recorded_at: ts(heldOn, '13'), updated_at: ts(heldOn, '13'), created_at: ts(withPrep ? prepOn : heldOn, '07'),
      });
      if (actions.length && planTarget) {
        const pid = planIdFor(row.id);
        row.plan_id = pid;
        // held (awaiting acknowledgement): draft plan, planned activities; latest acknowledged: approved plan under way; older: progressed
        const status = stage === 'held' ? 'draft' : stage === 'latest' ? 'active' : 'closed';
        plans.push({ id: pid, person_id, target_role_id: planTarget, status, created_at: ts(heldOn, '13'), note: 'Created from a career conversation', approved_by: status === 'draft' ? null : manager_id });
        actions.forEach((a, i) => acts.push({ id: activityId(row.id, a.id), plan_id: pid, person_id, kind: a.kind, title_en: a.title.en, title_ar: a.title.ar, due_on: a.due_on,
          status: stage === 'held' ? 'planned' : stage === 'latest' ? (i === 0 ? 'in_progress' : 'planned') : (i === 0 ? 'done' : 'in_progress'), course_id: a.course_id }));
      }
    };
    hist.forEach(([on, agrees], i) => {
      const row = mk(i, on);
      const hh = hash(row.id);
      const latest = i === hist.length - 1;
      record(row, on, hh, hh % 7 !== 0, latest && !open ? 'latest' : 'old');
      const ar = p.language === 'ar' ? 1 : 0;
      Object.assign(row, { status: 'acknowledged', employee_agrees: agrees, employee_comment: agrees ? null : pick(DISAGREE, hh)[ar], acknowledged_at: ts(addDaysIso(on, 2), '10'), updated_at: ts(addDaysIso(on, 2), '10'),
        share_with_talent_review: latest && !open ? share : false });
      T.career_conversations.push(row);
    });
    if (open) {
      const row = mk(hist.length, open.on);
      const hh = hash(row.id);
      if (open.kind === 'held') {
        record(row, open.on, hh, true, 'held');
        row.share_with_talent_review = share;
        notes.push({ id: `nt-cc-${row.id}-held`, person_id, kind: 'career_conversation', title_en: `Your career conversation with ${m.display_name} is recorded: please acknowledge it`,
          title_ar: `سُجِّل حوارك المهني مع ${m.display_name_ar || m.display_name}: يُرجى الإقرار به`, body_en: null, body_ar: null, link: '/my/career/conversations', severity: 'info', created_at: ts(open.on, '13'), read_at: null });
      } else {
        const prep = prepOf(p, hh, asp, mob, { targets: true, roadmap: (hh & 8) === 0, coach: true });
        const shared = open.kind === 'shared';
        Object.assign(row, { prep, agenda: buildAgenda(data(person_id), person_id, { ...prep.include, sharedOnly: false }, open.on), share_with_talent_review: share,
          prep_submitted_at: shared ? ts(open.on, '15') : null, manager_read_id: shared ? manager_id : null, updated_at: ts(open.on, '15') });
        if (shared) notes.push({ id: `nt-cc-${row.id}-prep`, person_id: manager_id, kind: 'career_conversation', title_en: `${p.display_name} shared their career conversation preparation`,
          title_ar: `شارك ${p.display_name_ar || p.display_name} تحضيره للحوار المهني`, body_en: null, body_ar: null, link: `/team/conversations?person=${person_id}`, severity: 'info', created_at: ts(open.on, '15'), read_at: null });
      }
      T.career_conversations.push(row);
    }
    // this month's reminder for overdue pairs (what rpc.conversationReminders writes)
    const l = lastHeldOf(T.career_conversations, person_id);
    if (cadenceState(l ? l.held_on : null, p.hire_date ?? null, today) === 'overdue') {
      const month = today.slice(0, 7);
      notes.push({ id: `nt-cc-due-${person_id}-${month}`, person_id, kind: 'career_conversation', title_en: 'Your six-monthly career conversation is due', title_ar: 'حان موعد حوارك المهني نصف السنوي',
        body_en: 'Prepare your aspirations and goals, then share them with your line manager.', body_ar: 'حضّر تطلعاتك وأهدافك ثم شاركها مع مديرك المباشر.', link: '/my/career/conversations', severity: 'warn', created_at: `${month}-01T06:00:00Z`, read_at: null });
      notes.push({ id: `nt-cc-due-${person_id}-${month}-m`, person_id: manager_id, kind: 'career_conversation', title_en: `Career conversation overdue: ${p.display_name}`, title_ar: `حوار مهني متأخر: ${p.display_name_ar || p.display_name}`,
        body_en: null, body_ar: null, link: `/team/conversations?person=${person_id}`, severity: 'warn', created_at: `${month}-01T06:00:00Z`, read_at: null });
    }
  }
  T.dev_plans.push(...plans);
  T.plan_activities.push(...acts);
  T.notifications.push(...notes);
}
