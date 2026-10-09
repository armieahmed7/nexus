// F27 SAT analysis workbench + F29 Accreditation readiness (wave 4 · E2, module M26) seed.
// F27: job analyses for 14 roles (approved, DIF survey open, draft; three security, safeguards and cyber roles held as restricted
// placeholders), a task inventory built from the M02 qualification-card task items plus synthetic job-analysis tasks, SME DIF
// ratings (3-6 raters per task, with two deliberate disagreements), training decisions taken by the training manager (two
// overrides with reasons), learning objectives (from the M04 course objectives plus SAT-written terminal objectives),
// task-to-training links (with a few coverage gaps and orphan objectives left on purpose), and three SAT changes (one closed,
// two with open review items).
// F29: 22 generic, paraphrased SAT criteria (sourced to public IAEA SAT guidance and FANR-REG-16; no INPO/ACAD text), 8
// programmes in scope, three finalised half-year self-evaluations per programme (2025-H1..2026-H1, readiness rising) and the
// current 2026-H2 drafts (one ready to finalise, one rated only by the training manager so maker-checker refuses it, two not
// yet opened). Synthetic people and role cards only.
import { proposal, changeImpact, RESTRICTED_TITLE } from '../../../src/modules/m26/sat.ts';
import { selfEvalState, toLink, suggestFor, OWNER_ROLES, isGap } from '../../../src/modules/m26/accr.ts';
import { evidenceFacts } from '../../../src/modules/m26/evidence.ts';

function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}
const ts = (d, hm = '09:00') => `${d}T${hm}:00Z`;
const clamp = (v) => Math.max(1, Math.min(5, v));
const abbr = (roleId) => roleId.split('-').map((x) => x.charAt(0)).join('').toUpperCase();

// ───────────── F27 inputs
const TM = 'p-training-mgr';
const ANALYSES = {
  'local-operator': { status: 'approved', courses: ['c-loit-ojt', 'c-loit-sys'], refresher: 'c-loct', approved_on: '2026-03-12' },
  'reactor-operator': { status: 'approved', courses: ['c-coit-sim', 'c-coit-exam'], refresher: 'c-coct', approved_on: '2026-04-02' },
  'senior-reactor-operator': { status: 'approved', courses: ['c-coit-sim'], refresher: 'c-coct', approved_on: '2026-04-02' },
  'shift-supervisor': { status: 'draft', courses: ['c-coct', 'c-mcc'], refresher: 'c-coct' },
  'maintenance-technician-engineer': { status: 'approved', courses: ['c-mnt-ojt', 'c-mnt-mech', 'c-mnt-elec', 'c-mnt-ic'], refresher: 'c-mnt-cont', approved_on: '2026-05-20' },
  'radiation-protection-technician': { status: 'approved', courses: ['c-rp-init'], refresher: 'c-rp-cont', approved_on: '2026-05-28' },
  'chemistry-technician': { status: 'draft', courses: ['c-chem-init'], refresher: 'c-chem-cont' },
  'systems-design-plant-engineer': { status: 'survey', courses: ['c-eng-init'], refresher: 'c-eng-cont', survey_opened_on: '2026-09-21' },
  'emergency-preparedness-coordinator': { status: 'approved', courses: ['c-ero'], refresher: 'c-ero-drill', approved_on: '2026-02-18' },
  'fire-protection': { status: 'survey', courses: ['c-fire'], refresher: 'c-fire', survey_opened_on: '2026-09-28' },
  'nuclear-training-instructor': { status: 'approved', courses: ['c-instr', 'c-asip'], refresher: 'c-asip', approved_on: '2026-01-29' },
  'quality-assurance-qc': { status: 'draft', courses: ['c-hu'], refresher: 'c-hu-ref' },
  'operations-support-work-control': { status: 'approved', courses: ['c-loit-ojt', 'c-hu'], refresher: 'c-hu-ref', approved_on: '2026-06-15' },
};
const RESTRICTED_ROLES = ['security-officer', 'safeguards-specialist', 'cyber-security-engineer'];
// qual-card standards per role (security standard never)
const ROLE_STANDARDS = {
  'local-operator': ['qs-lo-turbine', 'qs-lo-aux'], 'reactor-operator': ['qs-ro'], 'senior-reactor-operator': ['qs-sro'],
  'maintenance-technician-engineer': ['qs-mech', 'qs-elec', 'qs-ic'], 'radiation-protection-technician': ['qs-rp'], 'chemistry-technician': ['qs-chem'],
  'systems-design-plant-engineer': ['qs-eng'], 'emergency-preparedness-coordinator': ['qs-ero'], 'fire-protection': ['qs-fire'],
  'nuclear-training-instructor': ['qs-instr'], 'quality-assurance-qc': ['qs-qa'], 'operations-support-work-control': ['qs-wc'],
};
// synthetic job-analysis tasks: [title_en, title_ar, duty_en, duty_ar, d, i, f, critical?]
const GENERIC = {
  'local-operator': [
    ['Perform a fire watch and housekeeping inspection on the watch station', 'إجراء مراقبة الحريق وتفتيش النظافة في محطة المراقبة', 'Rounds', 'الجولات', 1, 2, 5],
    ['Isolate a leaking component under direction of the control room', 'عزل مكوّن به تسرّب بتوجيه من غرفة التحكم', 'Abnormal conditions', 'الحالات غير الاعتيادية', 3, 4, 3],
    ['Perform a local start of an emergency diesel generator', 'إجراء تشغيل محلي لمولّد الديزل في حالات الطوارئ', 'Abnormal conditions', 'الحالات غير الاعتيادية', 4, 5, 1, true],
    ['Record chemistry grab-sample requests in the turnover log', 'تسجيل طلبات أخذ عينات الكيمياء في سجل التسليم', 'Communication', 'التواصل', 1, 2, 5],
  ],
  'reactor-operator': [
    ['Respond to a dropped control rod (simulator)', 'الاستجابة لسقوط قضيب تحكّم (المحاكي)', 'Abnormal operation', 'التشغيل غير الاعتيادي', 4, 5, 1, true],
    ['Perform a surveillance test of a safety injection pump', 'إجراء اختبار مراقبة لمضخة الحقن الآمن', 'Surveillance', 'اختبارات المراقبة', 3, 4, 3],
    ['Log routine control-room readings', 'تسجيل قراءات غرفة التحكم الروتينية', 'Monitoring', 'المراقبة', 1, 2, 5],
    ['Respond to a loss of off-site power (simulator)', 'الاستجابة لفقدان الطاقة الخارجية (المحاكي)', 'Emergency operation', 'تشغيل الطوارئ', 5, 5, 1, true],
  ],
  'senior-reactor-operator': [
    ['Approve a clearance and tagging boundary', 'اعتماد حدود العزل ووضع البطاقات', 'Work control', 'التحكم في الأعمال', 3, 5, 4, true],
    ['Classify an emergency event and direct notifications', 'تصنيف حدث طارئ وتوجيه الإبلاغات', 'Emergency operation', 'تشغيل الطوارئ', 4, 5, 1, true],
    ['Review a completed surveillance package', 'مراجعة حزمة اختبار مراقبة مكتملة', 'Surveillance', 'اختبارات المراقبة', 2, 4, 4],
  ],
  'shift-supervisor': [
    ['Conduct a shift turnover meeting', 'إدارة اجتماع تسليم الوردية', 'Shift leadership', 'قيادة الوردية', 2, 4, 5],
    ['Authorise entry into a limiting condition for operation', 'اعتماد الدخول في شرط تشغيل محدِّد', 'Technical specifications', 'المواصفات الفنية', 4, 5, 2, true],
    ['Lead the crew during a plant transient', 'قيادة الطاقم خلال حالة عابرة في المحطة', 'Shift leadership', 'قيادة الوردية', 4, 5, 1, true],
    ['Approve overtime and fatigue-rule deviations', 'اعتماد العمل الإضافي وانحرافات قواعد الإرهاق', 'Administration', 'الإدارة', 2, 3, 3],
  ],
  'maintenance-technician-engineer': [
    ['Replace a reactor coolant pump seal', 'استبدال مانع تسرّب مضخة مبرّد المفاعل', 'Major maintenance', 'الصيانة الكبرى', 4, 4, 1, true],
    ['Clean and inspect a heat exchanger', 'تنظيف مبادل حراري وفحصه', 'Preventive maintenance', 'الصيانة الوقائية', 2, 2, 4],
    ['Apply torque values from a work package', 'تطبيق قيم عزم الدوران من حزمة العمل', 'Preventive maintenance', 'الصيانة الوقائية', 2, 4, 4],
    ['Return tools to the tool crib and update the log', 'إعادة الأدوات إلى مخزن الأدوات وتحديث السجل', 'Administration', 'الإدارة', 1, 1, 5],
  ],
  'radiation-protection-technician': [
    ['Set up a high radiation area boundary', 'إعداد حدود منطقة إشعاع عالٍ', 'Radiological controls', 'الضوابط الإشعاعية', 3, 5, 3, true],
    ['Calculate dose for a planned job and set ALARA controls', 'حساب الجرعة لعمل مخطط ووضع ضوابط ALARA', 'Dose planning', 'تخطيط الجرعات', 3, 4, 3],
    ['Respond to a personnel contamination event', 'الاستجابة لحدث تلوّث أفراد', 'Radiological events', 'الأحداث الإشعاعية', 3, 4, 2],
  ],
  'chemistry-technician': [
    ['Calibrate an online chemistry analyser', 'معايرة محلل كيمياء متصل', 'Instruments', 'الأجهزة', 3, 3, 3],
    ['Prepare reagents and standards', 'تحضير الكواشف والمحاليل المعيارية', 'Laboratory', 'المختبر', 2, 2, 4],
    ['Trend secondary water chemistry and report action levels', 'متابعة اتجاهات كيمياء المياه الثانوية والإبلاغ عن مستويات الإجراء', 'Monitoring', 'المراقبة', 3, 4, 4],
  ],
  'systems-design-plant-engineer': [
    ['Evaluate a system for ageing management', 'تقييم نظام لإدارة التقادم', 'System health', 'سلامة الأنظمة', 4, 4, 2],
    ['Write a system walk-down report', 'كتابة تقرير جولة تفقدية للنظام', 'System health', 'سلامة الأنظمة', 2, 3, 4],
    ['Prepare an in-service test plan input', 'إعداد مدخلات خطة الاختبار أثناء الخدمة', 'Programmes', 'البرامج', 3, 3, 2],
    ['Respond to an emergent equipment failure with a technical evaluation', 'الاستجابة لعطل طارئ في المعدات بتقييم فني', 'Plant support', 'دعم المحطة', 4, 5, 2],
  ],
  'emergency-preparedness-coordinator': [
    ['Maintain emergency facility readiness checklists', 'الحفاظ على قوائم جاهزية مرافق الطوارئ', 'Readiness', 'الجاهزية', 1, 2, 4],
    ['Plan and evaluate an emergency drill', 'تخطيط تمرين طوارئ وتقييمه', 'Drills', 'التمارين', 3, 4, 2],
  ],
  'fire-protection': [
    ['Inspect fire extinguishers and hose stations', 'فحص طفايات الحريق ومحطات الخراطيم', 'Inspection', 'الفحص', 1, 2, 5],
    ['Lead a fire brigade response to an industrial fire', 'قيادة استجابة فرقة الإطفاء لحريق صناعي', 'Response', 'الاستجابة', 4, 5, 1, true],
    ['Perform a fire protection impairment assessment', 'إجراء تقييم تعطّل أنظمة الحماية من الحريق', 'Programmes', 'البرامج', 3, 3, 3],
  ],
  'nuclear-training-instructor': [
    ['Conduct a simulator scenario debrief', 'إدارة جلسة استخلاص الدروس بعد سيناريو المحاكي', 'Delivery', 'التنفيذ', 3, 4, 4],
    ['Develop a JPM from a task analysis', 'تطوير مقياس أداء وظيفي من تحليل المهمة', 'Development', 'التطوير', 3, 4, 2],
    ['Analyse exam item statistics', 'تحليل إحصاءات أسئلة الاختبار', 'Evaluation', 'التقييم', 3, 3, 2],
  ],
  'quality-assurance-qc': [
    ['Perform a receipt inspection', 'إجراء فحص الاستلام', 'Inspection', 'الفحص', 2, 4, 4],
    ['Write a nonconformance report', 'كتابة تقرير عدم مطابقة', 'Reporting', 'التقارير', 2, 2, 3],
    ['Perform a visual and penetrant NDE examination', 'إجراء فحص غير إتلافي بصري وبالسائل النافذ', 'NDE', 'الفحص غير الإتلافي', 4, 4, 3],
  ],
  'operations-support-work-control': [
    ['Schedule work orders for the work week', 'جدولة أوامر العمل لأسبوع العمل', 'Scheduling', 'الجدولة', 2, 2, 5],
    ['Perform a risk screening of planned work', 'إجراء فحص المخاطر للعمل المخطط', 'Risk', 'المخاطر', 3, 4, 4],
  ],
};
// true DIF triple of a qualification-card task from its method and criticality
function cardTriple(t) {
  const crit = !!t.critical;
  const i = crit ? 5 : 2 + (h32(t.id) % 3);
  const base = { simulator: [4, 2], jpm: [3, 3], ojt: [2, 4], classroom: [2, 3], written: [3, 2], equivalency: [2, 2] }[t.method] ?? [2, 3];
  return [base[0] + (crit && t.method !== 'simulator' ? 1 : 0), i, base[1]];
}
const DISAGREE = new Set(['jt-qs-rp-t3', 'jt-reactor-operator-g3']);

export const FINALIZE_LAST = true; // the DIF survey invitations need the F21 SME profiles (built in f20's finalize)

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const nm = (id) => { const p = people.get(id); if (!p) throw new Error(`f27: unknown person ${id}`); return { en: p.display_name, ar: p.display_name_ar || p.display_name }; };
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  const courses = new Map(T.courses.map((c) => [c.id, c]));
  const modulesOf = (cid) => T.course_modules.filter((m) => m.course_id === cid).sort((a, b) => a.n - b.n);
  const incumbents = (roleId) => T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_role_id === roleId).map((p) => p.id).sort();
  const instructors = ['p-k-instructor', 'w-instr-01', 'w-instr-02', TM];

  // ── analyses
  T.jta_analyses = [];
  for (const [roleId, a] of Object.entries(ANALYSES)) {
    if (!roles.has(roleId)) throw new Error(`f27: unknown role ${roleId}`);
    const hist = [{ at: ts('2026-01-12'), by: TM, from: null, to: 'draft' }];
    if (a.status !== 'draft') hist.push({ at: ts(a.survey_opened_on ?? '2026-01-20'), by: TM, from: 'draft', to: 'survey' });
    if (a.status === 'approved') hist.push({ at: ts(a.approved_on), by: TM, from: 'survey', to: 'approved' });
    T.jta_analyses.push({
      id: `jta-${roleId}`, role_id: roleId, status: a.status, version: 1, owner_id: TM, survey_opened_on: a.status === 'draft' ? null : (a.survey_opened_on ?? '2026-01-20'),
      approved_by: a.status === 'approved' ? TM : null, approved_on: a.status === 'approved' ? a.approved_on : null, restricted: false,
      notes_en: '', notes_ar: '', history: hist, updated_at: ts(a.approved_on ?? a.survey_opened_on ?? '2026-01-12'),
    });
  }
  for (const roleId of RESTRICTED_ROLES) {
    T.jta_analyses.push({ id: `jta-${roleId}`, role_id: roleId, status: 'draft', version: 1, owner_id: null, survey_opened_on: null, approved_by: null, approved_on: null, restricted: true,
      notes_en: "Managed outside Kafa'a", notes_ar: 'تُدار خارج كفاءة', history: [], updated_at: ts('2026-01-12') });
  }

  // ── tasks
  T.jta_tasks = [];
  const truth = new Map();
  for (const roleId of Object.keys(ANALYSES)) {
    let sort = 0;
    for (const std of ROLE_STANDARDS[roleId] ?? []) {
      for (const ti of T.task_items.filter((x) => x.standard_id === std).sort((a, b) => a.sort - b.sort)) {
        const id = `jt-${ti.id}`;
        truth.set(id, cardTriple(ti));
        T.jta_tasks.push({
          id, role_id: roleId, code: ti.code, title_en: ti.statement_en, title_ar: ti.statement_ar, duty_en: '', duty_ar: '', source: 'qual_card', task_item_id: ti.id, standard_id: std,
          critical: !!ti.critical, restricted: false, status: 'active', decision: 'pending', decision_by: null, decision_on: null, decision_note: null, override: false, version: 1,
          created_by: TM, created_at: ts('2026-01-12'), changed_at: ts('2026-01-12'), sort: ++sort,
        });
      }
    }
    (GENERIC[roleId] ?? []).forEach(([en, ar, den, dar, d, i, f, crit], k) => {
      const id = `jt-${roleId}-g${k + 1}`;
      truth.set(id, [d, i, f]);
      T.jta_tasks.push({
        id, role_id: roleId, code: `${abbr(roleId)}-J${String(k + 1).padStart(2, '0')}`, title_en: en, title_ar: ar, duty_en: den, duty_ar: dar, source: 'jta_survey', task_item_id: null, standard_id: null,
        critical: !!crit, restricted: false, status: 'active', decision: 'pending', decision_by: null, decision_on: null, decision_note: null, override: false, version: 1,
        created_by: TM, created_at: ts('2026-01-14'), changed_at: ts('2026-01-14'), sort: ++sort,
      });
    });
  }
  for (let k = 1; k <= 4; k++) {
    T.jta_tasks.push({
      id: `jt-security-officer-r${k}`, role_id: 'security-officer', code: `SO-R${String(k).padStart(2, '0')}`, title_en: RESTRICTED_TITLE.en, title_ar: RESTRICTED_TITLE.ar, duty_en: '', duty_ar: '',
      source: 'qual_card', task_item_id: null, standard_id: null, critical: false, restricted: true, status: 'active', decision: 'pending', decision_by: null, decision_on: null, decision_note: null,
      override: false, version: 1, created_by: null, created_at: ts('2026-01-12'), changed_at: ts('2026-01-12'), sort: k,
    });
  }

  // ── DIF ratings
  T.dif_ratings = [];
  for (const t of T.jta_tasks.filter((x) => !x.restricted)) {
    const a = ANALYSES[t.role_id];
    const hx = h32(t.id);
    const pool = [...incumbents(t.role_id), ...instructors].filter((v, i, xs) => xs.indexOf(v) === i);
    let n = 3 + (hx % 4); // 3..6
    if (a.status === 'draft') n = hx % 3 === 0 ? 0 : hx % 3 === 1 ? 2 : 3;
    if (a.status === 'survey') n = 2 + (hx % 3); // 2..4, the survey is still collecting
    if (t.role_id === 'systems-design-plant-engineer') pool.splice(pool.indexOf('p-sme-reviewer'), 1); // sme-reviewer has not answered yet (demo)
    const raters = [...pool].sort((x, y) => h32(`${t.id}:${x}`) - h32(`${t.id}:${y}`)).slice(0, Math.min(n, pool.length));
    const [d0, i0, f0] = truth.get(t.id);
    raters.forEach((r, k) => {
      const j = h32(`${t.id}:${r}:j`);
      const dv = [0, 0, 0, 1, -1][j % 5], iv = [0, 0, 0, 0, -1][(j >>> 3) % 5], fv = [0, 0, 1, -1, 0][(j >>> 6) % 5];
      let d = clamp(d0 + dv), i = clamp(i0 + iv), f = clamp(f0 + fv);
      if (DISAGREE.has(t.id) && k === 0) { d = d0 >= 3 ? 1 : 5; i = i0 >= 3 ? 1 : 5; }
      const kind = r === TM ? 'developer' : instructors.includes(r) ? 'instructor' : 'sme';
      const month = 1 + (h32(`${t.id}:${r}:m`) % 6);
      const dd = a.status === 'survey' ? (a.survey_opened_on < '2026-09-25' ? '2026-09-29' : '2026-10-04') : `2026-0${Math.min(month + 1, 9)}-${String(5 + (j % 20)).padStart(2, '0')}`;
      T.dif_ratings.push({ id: `dif:${t.id}:${r}`, task_id: t.id, rater_person_id: r, d, i, f, note: DISAGREE.has(t.id) && k === 0 ? 'I see this done rarely and only by the senior technician' : '', rater_kind: kind, rated_on: dd, active: true });
    });
  }

  // ── decisions: approved analyses decided by the training manager (two overrides with reasons); drafts partly decided
  const OVERRIDES = {
    'jt-qs-lo-turbine-t5': ['overtrain', 'Three-way communication errors featured in two OE lessons this year; keep it in continuing training even though it is frequent'],
    'jt-maintenance-technician-engineer-g4': ['train', 'Tool control is a foreign-material-exclusion barrier; a short briefing is required for new technicians'],
  };
  for (const t of T.jta_tasks.filter((x) => !x.restricted)) {
    const a = ANALYSES[t.role_id];
    const p = proposal(T.dif_ratings.filter((r) => r.task_id === t.id));
    const decide = a.status === 'approved' || (a.status === 'draft' && p.status === 'proposed' && h32(t.id) % 2 === 0);
    if (!decide || p.status !== 'proposed') continue;
    const ov = OVERRIDES[t.id];
    t.decision = ov ? ov[0] : p.decision;
    t.override = !!ov && ov[0] !== p.decision;
    t.decision_note = t.override ? ov[1] : null;
    t.decision_by = TM;
    t.decision_on = a.approved_on ?? '2026-08-20';
  }

  // ── learning objectives: every M04 course objective, plus a SAT-written terminal objective per selected task
  T.sat_objectives = [];
  for (const c of T.courses.filter((x) => x.audience === 'staff')) {
    (c.objectives ?? []).forEach((o, k) => {
      T.sat_objectives.push({ id: `obj-${c.id}-${k + 1}`, code: `${c.code}-O${k + 1}`, kind: 'terminal', text_en: o.en, text_ar: o.ar, course_id: c.id, module_id: null, competency_id: o.competency_id ?? null,
        role_id: null, source: 'course', status: 'active', created_by: null, updated_at: ts('2026-01-05') });
    });
  }
  T.task_objectives = [];
  const link = (task, objId, courseId, moduleId, jpmId, at) => T.task_objectives.some((l) => l.id === `to:${task.id}:${objId}`) || T.task_objectives.push({ id: `to:${task.id}:${objId}`, task_id: task.id, objective_ref: objId, course_id: courseId, module_id: moduleId, jpm_id: jpmId, active: true, linked_by: TM, linked_at: ts(at) });
  // deliberate coverage gaps (selected for training, no objective yet) and SAT objectives left orphaned
  const GAPS = new Set(['jt-local-operator-g2', 'jt-qs-rp-t4', 'jt-radiation-protection-technician-g3', 'jt-qs-ero-t2', 'jt-reactor-operator-g2']);
  let satN = 0;
  for (const t of T.jta_tasks.filter((x) => !x.restricted)) {
    const a = ANALYSES[t.role_id];
    const selected = t.decision === 'train' || t.decision === 'overtrain';
    if (!selected && !(a.status !== 'approved' && h32(t.id) % 3 === 0)) continue;
    if (GAPS.has(t.id)) continue;
    const [main] = a.courses.filter((c) => courses.has(c)).sort((x, y) => h32(`${t.id}${x}`) - h32(`${t.id}${y}`));
    if (!main) continue;
    const mods = modulesOf(main);
    const mod = mods.length ? mods[h32(t.id) % mods.length] : null;
    const ti = t.task_item_id ? T.task_items.find((x) => x.id === t.task_item_id) : null;
    const jpm = ti ? T.jpms.find((j) => j.task_id === ti.id) : null;
    const comp = (courses.get(main).competency_ids ?? [])[0] ?? null;
    const id = `obj-sat-${String(++satN).padStart(3, '0')}`;
    T.sat_objectives.push({
      id, code: `SAT-${String(satN).padStart(3, '0')}`, kind: 'terminal',
      text_en: `Given the approved procedure and plant conditions, ${t.title_en.charAt(0).toLowerCase()}${t.title_en.slice(1)} without error on critical steps`,
      text_ar: `بالاعتماد على الإجراء المعتمد وظروف المحطة: ${t.title_ar}، دون أخطاء في الخطوات الحرجة`,
      course_id: main, module_id: mod?.id ?? null, competency_id: comp, role_id: t.role_id, source: 'sat', status: 'active', created_by: TM, updated_at: ts('2026-02-10'),
    });
    link(t, id, main, mod?.id ?? null, jpm?.id ?? null, a.approved_on ?? '2026-08-25');
    // the course-level competency objective of the main course too
    const cobj = T.sat_objectives.find((o) => o.course_id === main && o.source === 'course');
    if (cobj && h32(`${t.id}:c`) % 2 === 0) link(t, cobj.id, main, null, null, a.approved_on ?? '2026-08-25');
    // overtrain tasks get their continuing-training refresher objective (except one, left as a "no refresher" finding)
    if (t.decision === 'overtrain' && t.id !== 'jt-local-operator-g3') {
      const robj = T.sat_objectives.find((o) => o.course_id === a.refresher && o.source === 'course');
      if (robj) link(t, robj.id, a.refresher, null, null, a.approved_on ?? '2026-08-25');
    }
  }
  // two SAT objectives written for tasks that were later merged: now orphaned
  for (const [roleId, en, ar, course] of [
    ['local-operator', 'Given a watch-station round sheet, identify out-of-band readings and report them', 'بالاعتماد على ورقة جولة محطة المراقبة، تحديد القراءات الخارجة عن النطاق والإبلاغ عنها', 'c-loit-ojt'],
    ['maintenance-technician-engineer', 'Given a pump work package, record as-found and as-left data', 'بالاعتماد على حزمة عمل المضخة، تسجيل بيانات الحالة قبل العمل وبعده', 'c-mnt-ojt'],
  ]) {
    const id = `obj-sat-${String(++satN).padStart(3, '0')}`;
    T.sat_objectives.push({ id, code: `SAT-${String(satN).padStart(3, '0')}`, kind: 'enabling', text_en: en, text_ar: ar, course_id: course, module_id: null, competency_id: (courses.get(course).competency_ids ?? [])[0] ?? null,
      role_id: roleId, source: 'sat', status: 'active', created_by: TM, updated_at: ts('2026-03-02') });
  }

  // ── SAT changes (impact computed by the shared rule)
  T.sat_changes = [];
  T.sat_change_items = [];
  const CHANGES = [
    { id: 'sc-001', task: 'jt-qs-ro-t2', kind: 'modified', trigger: 'regulatory', by: 'p-k-instructor', at: '2026-06-10', closedAt: '2026-07-02',
      summary: 'Emergency operating procedure revision 4: the reactor trip response now starts with a standard post-trip actions check', outcomes: { course: ['updated', 'Lesson plan and simulator guide updated to revision 4'], standard: ['no_change', 'Task statement unchanged; the card already refers to the current EOP'] } },
    { id: 'sc-002', task: 'jt-qs-lo-turbine-t3', kind: 'modified', trigger: 'oe', by: 'p-k-instructor', at: '2026-09-22',
      summary: 'OE lesson on a clearance boundary error: add independent verification of the boundary before hanging tags', title_en: 'Hang and remove a clearance with independent verification of the boundary', title_ar: 'وضع العزل وإزالته مع التحقق المستقل من الحدود',
      outcomes: { course: ['updated', 'OJT guide and JPM briefing updated with the verification step'] } },
    { id: 'sc-003', task: 'jt-qs-mech-t3', kind: 'modified', trigger: 'effectiveness', by: 'p-head-sq', at: '2026-10-01',
      summary: 'Effectiveness review: foreign-material events after training; strengthen the FME control step and the close-out inspection', outcomes: {} },
  ];
  for (const c of CHANGES) {
    const t = T.jta_tasks.find((x) => x.id === c.task);
    if (!t) throw new Error(`f27: change task ${c.task}`);
    const impact = changeImpact({ task: t, links: T.task_objectives, objectives: T.sat_objectives, courses: T.courses, jpms: T.jpms, standards: T.qual_standards, items: T.items });
    const items = [...impact.courses.map((x) => ({ kind: 'course', ...x })), ...impact.standards.map((x) => ({ kind: 'standard', ...x }))];
    const before = { title_en: t.title_en, title_ar: t.title_ar, version: t.version, status: t.status };
    const after = { title_en: c.title_en ?? t.title_en, title_ar: c.title_ar ?? t.title_ar, version: t.version + 1, status: 'active' };
    const res = items.map((x, k) => {
      const o = c.outcomes[x.kind];
      const closed = !!o && (c.closedAt || x.kind === 'course');
      return { id: `${c.id}-${k + 1}`, change_id: c.id, kind: x.kind, ref_id: x.id, title_en: `${x.code} · ${x.title_en}`, title_ar: `${x.code} · ${x.title_ar}`,
        status: closed ? o[0] : 'open', note: closed ? o[1] : '', revision_id: null, closed_by: closed ? c.by : null, closed_at: closed ? ts(c.closedAt ?? c.at, '14:00') : null, sort: k + 1 };
    });
    const open = res.some((x) => x.status === 'open');
    const n = nm(c.by);
    T.sat_changes.push({ id: c.id, task_id: t.id, role_id: t.role_id, kind: c.kind, trigger: c.trigger, summary: c.summary, before, after, impact, status: open ? 'open' : 'closed',
      opened_by: c.by, opened_by_name: n.en, opened_by_name_ar: n.ar, opened_at: ts(c.at), closed_at: open ? null : ts(c.closedAt ?? c.at, '14:00') });
    T.sat_change_items.push(...res);
    Object.assign(t, { title_en: after.title_en, title_ar: after.title_ar, version: after.version, changed_at: ts(c.at) });
  }

  // ───────────── F29
  const SRC = [
    { id: 'trs380', label: 'IAEA TRS-380, Nuclear Power Plant Personnel Training and its Evaluation (SAT; superseded by NG-T-2.8, 2021)', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/trs380_web.pdf' },
    { id: 'reg16', label: 'FANR-REG-16, Art. 9 (systematic, performance-based training; qualified instructors)', url: 'https://www.fanr.gov.ae/en/Documents/REG-16-English.pdf' },
  ];
  const C = (code, area, phase, en, ar, gen, gar, kinds) => ({ code, area, phase, en, ar, gen, gar, kinds });
  const CRITERIA = [
    C('PI-1', 'performance', null, 'Training needs from plant performance, operating experience and events are identified and acted on promptly', 'تُحدَّد احتياجات التدريب الناشئة عن أداء المحطة والخبرة التشغيلية والأحداث ويُتصرَّف بشأنها دون تأخير', 'Look for a working route from performance data and OE into training requests, with dates.', 'ابحث عن مسار فعّال ينقل بيانات الأداء والخبرة التشغيلية إلى طلبات تدريب مؤرخة.', ['effectiveness', 'programme_records']),
    C('PI-2', 'performance', null, 'Line managers help decide training content and confirm that trained staff perform as expected on the job', 'يشارك المديرون المباشرون في تحديد محتوى التدريب ويؤكدون أن المتدربين يؤدون كما هو متوقع في العمل', 'Manager input to content reviews and on-the-job confirmation after training.', 'مدخلات المديرين في مراجعة المحتوى والتأكيد في موقع العمل بعد التدريب.', ['signoff_timeliness', 'effectiveness']),
    C('PI-3', 'performance', null, 'Training results and on-the-job performance are reviewed together before programme changes are decided', 'تُراجَع نتائج التدريب والأداء في العمل معًا قبل اتخاذ قرارات تغيير البرنامج', 'Committee minutes or reviews that use both kinds of data.', 'محاضر اللجان أو المراجعات التي تستخدم كلا النوعين من البيانات.', ['effectiveness']),
    C('ER-1', 'environment', null, 'Facilities, simulators and equipment represent job conditions closely enough for the training objectives', 'تمثّل المرافق وأجهزة المحاكاة والمعدات ظروف العمل بما يكفي لتحقيق أهداف التدريب', 'Fidelity of settings against the objectives they serve.', 'مدى مطابقة بيئات التدريب للأهداف التي تخدمها.', ['programme_records']),
    C('ER-2', 'environment', null, 'Training materials are kept current with plant procedures and design changes', 'تُحدَّث المواد التدريبية بما يتوافق مع إجراءات المحطة وتغييرات التصميم', 'Changes traced to materials, and materials updated on time.', 'تتبّع التغييرات إلى المواد وتحديث المواد في الوقت المناسب.', ['traceability']),
    C('ER-3', 'environment', null, 'Enough instructors, time and budget are planned to deliver the training schedule', 'يُخطَّط لعدد كافٍ من المدربين والوقت والميزانية لتنفيذ جدول التدريب', 'Capacity plans against the scheduled sessions.', 'خطط القدرة مقارنةً بالجلسات المجدولة.', ['programme_records', 'instructor_quals']),
    C('TP-A1', 'process', 'analysis', 'A job and task analysis identifies the tasks of each role and the knowledge and skills they need', 'يحدّد تحليل الوظيفة والمهام مهام كل دور والمعارف والمهارات اللازمة لها', 'A current task inventory per role, with its source.', 'قائمة مهام حالية لكل دور مع مصدرها.', ['traceability']),
    C('TP-A2', 'process', 'analysis', 'Train / no-train decisions rest on documented difficulty, importance and frequency ratings', 'تستند قرارات التدريب أو عدمه إلى تقديرات موثّقة للصعوبة والأهمية والتكرار', 'DIF ratings from several experts and a recorded decision rule.', 'تقديرات الصعوبة والأهمية والتكرار من عدة خبراء وقاعدة قرار مسجّلة.', ['traceability']),
    C('TP-D1', 'process', 'design', 'Learning objectives exist for every task selected for training, with conditions and standards', 'توجد أهداف تعلّم لكل مهمة مختارة للتدريب، مع الظروف والمعايير', 'No selected task without an objective (coverage gaps).', 'لا توجد مهمة مختارة دون هدف (فجوات التغطية).', ['traceability']),
    C('TP-D2', 'process', 'design', 'The training setting (classroom, simulator, on the job) is chosen to fit each objective', 'يُختار مكان التدريب (قاعة، محاكي، موقع العمل) بما يناسب كل هدف', 'Objectives mapped to courses, modules and JPMs.', 'ربط الأهداف بالدورات والوحدات ومقاييس الأداء الوظيفي.', ['traceability']),
    C('TP-V1', 'process', 'development', 'Lesson plans, JPMs and other materials are developed from the objectives and approved before use', 'تُطوَّر خطط الدروس ومقاييس الأداء الوظيفي والمواد الأخرى من الأهداف وتُعتمد قبل الاستخدام', 'Materials linked to objectives; review and approval records.', 'مواد مرتبطة بالأهداف وسجلات المراجعة والاعتماد.', ['traceability', 'item_analysis']),
    C('TP-V2', 'process', 'development', 'Task and procedure changes are traced to the affected materials and standards', 'تُتتبّع تغييرات المهام والإجراءات إلى المواد والمعايير المتأثرة', 'SAT change records with their review items closed.', 'سجلات تغييرات النهج المنهجي مع إغلاق بنود المراجعة.', ['traceability']),
    C('TP-I1', 'process', 'implementation', 'Training is delivered as designed and trainee progress and qualification are recorded', 'يُنفَّذ التدريب كما صُمّم وتُسجَّل تقدّم المتدربين وتأهيلهم', 'Completion and qualification records for the programme.', 'سجلات الإتمام والتأهيل للبرنامج.', ['programme_records']),
    C('TP-I2', 'process', 'implementation', 'On-the-job training and task evaluations are signed off on time by qualified evaluators', 'يعتمد مقيّمون مؤهلون التدريب في موقع العمل وتقييمات المهام في الوقت المحدد', 'Sign-off dates and supervisor acknowledgements.', 'تواريخ الاعتماد وإقرارات المشرفين.', ['signoff_timeliness']),
    C('TP-E1', 'process', 'evaluation', 'Trainee reaction, learning gain and on-the-job behaviour are evaluated after training', 'يُقيَّم رد فعل المتدربين ومكسب التعلّم والسلوك في العمل بعد التدريب', 'Evaluation forms and follow-up observations.', 'نماذج التقييم وملاحظات المتابعة.', ['effectiveness']),
    C('TP-E2', 'process', 'evaluation', 'Evaluation results feed back into analysis, design and delivery', 'تعود نتائج التقييم لتغذية التحليل والتصميم والتنفيذ', 'Changes opened because of evaluation findings.', 'تغييرات فُتحت بسبب نتائج التقييم.', ['effectiveness', 'traceability']),
    C('QI-1', 'instructors', null, 'Instructors are technically qualified for what they teach and hold instructional skills', 'المدربون مؤهلون فنيًا لما يدرّسونه ويمتلكون مهارات التدريس', 'Instructor and evaluator qualifications for the programme standards.', 'مؤهلات المدربين والمقيّمين لمعايير البرنامج.', ['instructor_quals']),
    C('QI-2', 'instructors', null, 'Instructor qualification is kept current through teaching practice and continuing development', 'يُحافظ على تأهيل المدربين من خلال ممارسة التدريس والتطوير المستمر', 'Currency records: teaching hours and continuing development.', 'سجلات السريان: ساعات التدريس والتطوير المستمر.', ['instructor_quals']),
    C('QI-3', 'instructors', null, 'Instructor performance is observed and coached', 'يُلاحَظ أداء المدربين ويُدرَّبون عليه', 'Observation records and follow-up.', 'سجلات الملاحظة والمتابعة.', ['instructor_quals']),
    C('TE-1', 'examinations', null, 'Examinations measure the learning objectives and the standards of the job', 'تقيس الاختبارات أهداف التعلّم ومعايير الوظيفة', 'Blueprints that map items to objectives.', 'مخططات تربط الأسئلة بالأهداف.', ['item_analysis']),
    C('TE-2', 'examinations', null, 'Exam items are reviewed, kept secure and analysed for difficulty and discrimination', 'تُراجَع أسئلة الاختبار وتُحفظ بأمان وتُحلَّل من حيث الصعوبة والتمييز', 'Item review records and item statistics.', 'سجلات مراجعة الأسئلة وإحصاءاتها.', ['item_analysis']),
    C('TE-3', 'examinations', null, 'Pass criteria, retakes and remediation are defined and applied consistently', 'تُحدَّد معايير النجاح وإعادة الاختبار والمعالجة وتُطبَّق باتساق', 'Rules on the forms and released attempts.', 'القواعد على النماذج والمحاولات المنشورة.', ['item_analysis', 'programme_records']),
  ];
  T.accr_criteria = CRITERIA.map((c, k) => ({ id: `ac-${c.code.toLowerCase()}`, code: c.code, area: c.area, phase: c.phase, title_en: c.en, title_ar: c.ar, guidance_en: c.gen, guidance_ar: c.gar, evidence_kinds: c.kinds, sources: SRC, sort: k + 1 }));

  const PROGS = [
    ['loit', ['local-operator'], ['qs-lo-turbine', 'qs-lo-aux'], []],
    ['coit', ['reactor-operator', 'senior-reactor-operator'], ['qs-ro', 'qs-sro'], []],
    ['coct', ['reactor-operator', 'senior-reactor-operator', 'shift-supervisor'], ['qs-ro', 'qs-sro'], ['c-sam']],
    ['maint-init', ['maintenance-technician-engineer'], ['qs-mech', 'qs-elec', 'qs-ic'], []],
    ['rp-init', ['radiation-protection-technician'], ['qs-rp'], []],
    ['chem-init', ['chemistry-technician'], ['qs-chem'], []],
    ['eng-init', ['systems-design-plant-engineer'], ['qs-eng'], []],
    ['instr-qual', ['nuclear-training-instructor'], ['qs-instr'], ['c-asip']],
  ];
  T.accr_programmes = PROGS.map(([id, role_ids, standard_ids, course_ids], k) => ({ id, role_ids, standard_ids, course_ids, owner_role: 'training', active: true, sort: k + 1 }));

  const AUTHORS = {
    loit: ['p-k-instructor', 'p-training-mgr'], coit: ['p-k-instructor', 'p-training-mgr'], coct: ['p-k-instructor', 'p-training-mgr'], 'maint-init': ['p-head-sq', 'p-sq-lead'],
    'rp-init': ['p-rp-lead', 'p-training-mgr'], 'chem-init': ['p-sq-lead', 'p-rp-lead'], 'eng-init': ['p-sq-lead', 'p-head-sq'], 'instr-qual': ['p-training-mgr', 'p-k-instructor'],
  };
  const CYCLES = [['2025-H1', '2025-06-26'], ['2025-H2', '2025-12-18'], ['2026-H1', '2026-06-24']];
  const CURRENT = { loit: 14, coit: 22, coct: 8, 'chem-init': 22, 'instr-qual': 5, 'maint-init': 11 }; // rated criteria in the 2026-H2 draft
  const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  T.accr_selfevals = [];
  T.accr_assessments = [];
  for (const p of T.accr_programmes) {
    const facts = evidenceFacts({
      programme: p, analyses: T.jta_analyses, tasks: T.jta_tasks, links: T.task_objectives, objectives: T.sat_objectives, roleComps: T.role_competencies, courses: T.courses,
      items: T.items, forms: T.assessment_forms, attempts: T.attempts, evaluatorQuals: T.evaluator_quals, qualRecords: T.qual_records, evaluations: T.evaluations,
      trainingRecords: T.training_records, sessions: T.sessions, l3: null, tracks: null,
    }, today);
    const rateAll = (seId, cycleIdx, closeDate, count, authorsFor) => {
      T.accr_criteria.slice(0, count).forEach((c, k) => {
        const hx = h32(`${p.id}:${c.id}`);
        let r = 1 + (hx % 3);
        for (let s = 1; s <= cycleIdx; s++) r = Math.min(4, r + ((hx >> (2 + s)) & 1));
        const by = authorsFor(k);
        const ev = suggestFor(c.evidence_kinds, facts).filter((f) => f.kind !== 'none').slice(0, 3).map(toLink);
        const gap = isGap(r);
        const n = nm(by);
        const ratedAt = ts(addDays(closeDate, -(12 - (k % 10))), '10:30');
        T.accr_assessments.push({
          id: `aa:${seId}:${c.id}`, selfeval_id: seId, programme_id: p.id, criterion_id: c.id, rating: r, evidence: ev,
          gap_en: gap ? `${c.code}: ${r === 1 ? 'no working arrangement yet' : 'partly in place; evidence incomplete'}` : '', owner_role: gap ? OWNER_ROLES[hx % OWNER_ROLES.length] : null,
          due_on: gap ? addDays(closeDate, 90 + (hx % 90)) : null, note: '', rated_by: by, rated_by_name: n.en, rated_by_name_ar: n.ar, rated_at: ratedAt, history: [{ at: ratedAt, by, rating: r }],
        });
      });
    };
    CYCLES.forEach(([cycle, closeDate], idx) => {
      const seId = `ase-${p.id}-${cycle}`;
      const authors = AUTHORS[p.id];
      rateAll(seId, idx, closeDate, T.accr_criteria.length, (k) => authors[k % authors.length]);
      const s = selfEvalState(T.accr_assessments.filter((a) => a.selfeval_id === seId), T.accr_criteria.length);
      const fin = nm(TM);
      T.accr_selfevals.push({ id: seId, programme_id: p.id, cycle, status: 'finalised', opened_by: authors[0], opened_on: addDays(closeDate, -60), finalised_by: TM, finalised_by_name: fin.en, finalised_by_name_ar: fin.ar,
        finalised_at: ts(closeDate, '15:00'), readiness: s.readiness, rated: s.rated, gaps: s.gaps, authors: s.authors, summary_en: '', summary_ar: '', updated_at: ts(closeDate, '15:00') });
    });
    if (CURRENT[p.id] != null) {
      const seId = `ase-${p.id}-2026-H2`;
      const authors = p.id === 'chem-init' ? [TM] : p.id === 'coit' ? ['p-k-instructor', TM] : AUTHORS[p.id];
      rateAll(seId, 3, '2026-10-06', CURRENT[p.id], (k) => authors[k % authors.length]);
      const s = selfEvalState(T.accr_assessments.filter((a) => a.selfeval_id === seId), T.accr_criteria.length);
      T.accr_selfevals.push({ id: seId, programme_id: p.id, cycle: '2026-H2', status: 'draft', opened_by: authors[0], opened_on: '2026-09-07', finalised_by: null, finalised_by_name: '', finalised_by_name_ar: '',
        finalised_at: null, readiness: s.readiness, rated: s.rated, gaps: s.gaps, authors: s.authors, summary_en: '', summary_ar: '', updated_at: ts('2026-10-06', '16:00') });
    }
  }
}

export function finalize(T) {
  const people = new Map(T.people.map((p) => [p.id, p]));
  const roles = new Map(T.job_roles.map((r) => [r.id, r]));
  // DIF survey invitations for SMEs (F21 profile) who hold a role whose survey is open
  for (const [roleId, a] of Object.entries(ANALYSES).filter(([, x]) => x.status === 'survey')) {
    const r = roles.get(roleId);
    for (const sp of (T.sme_profiles ?? []).filter((s) => people.get(s.person_id)?.job_role_id === roleId)) {
      T.notifications.push({ id: `nt-dif-${roleId}-${a.survey_opened_on}-${sp.person_id}`, person_id: sp.person_id, kind: 'sat', title_en: `DIF survey open: ${r.title_en}`, title_ar: `استبيان الصعوبة والأهمية والتكرار مفتوح: ${r.title_ar}`,
        body_en: null, body_ar: null, link: '/training/sat/survey', severity: 'info', created_at: ts(a.survey_opened_on), read_at: null });
    }
  }

}
