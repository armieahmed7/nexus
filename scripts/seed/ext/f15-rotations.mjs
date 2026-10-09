// F15 (wave 2 · w2e4) seed: rotation programme templates (GDP with its sourced 18 to 36 month duration, GPO, DNT work-based
// placements, a cross-functional operations-to-engineering move, a high-potential leadership rotation and one draft), five
// synthetic cohorts (two at or above the suppression threshold of 10 people, three below), each person's placement plan with
// mid-point check-ins and host sign-offs (ojt evidence, basis evidenced, that f01-skills finalize() folds into the F03 passport),
// the shadowing host directory and shadowing requests in every state. Templates are normalised by the same validator both
// backends use (src/modules/m20/rotation.ts); sign-off routing uses the same maker-checker rule (signerFor).
// Synthetic people only (w-* workers and role cards). No security, cyber or safeguards placement, host or skill.
// k-ro gets no signed-off rotation evidence on purpose (the F08 tests pin k-ro's ojt states).
import { lineManagerOf } from '../../../src/modules/m20/domain.ts';
import { addDays, midpoint, planPlacements, rotationEvidence, signerFor, skillLevels, validateTemplate, SITE_FAMILIES } from '../../../src/modules/m20/rotation.ts';

function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}
const O = (skill_id, level, text_en, text_ar) => ({ skill_id, level, text_en, text_ar });

const TEMPLATES = [
  {
    id: 'rt-gdp-engineering', owner: 'p-chco', programme: 'gdp', min: 18, max: 36, sources: ['enec-careers', 'sr2024'], eligible: [], status: 'active',
    title_en: 'Graduate Development Programme: engineering and plant support rotation', title_ar: 'برنامج تطوير الخريجين: تناوب الهندسة ودعم المحطة',
    summary_en: 'Position-targeted, workplace-based development for graduate engineers: four six-month placements across plant engineering, outage and work management, supplier quality and licensing, each with skill objectives signed off by the host. ENEC describes the GDP as 18 to 36 months.',
    summary_ar: 'تطوير موجّه نحو الوظيفة وقائم على بيئة العمل للمهندسين الخريجين: أربعة تناوبات مدة كل منها ستة أشهر في هندسة المحطة، وإدارة الانقطاعات والأعمال، وجودة الموردين، والترخيص، ولكل تناوب أهداف مهارية يعتمدها المضيف. تصف المؤسسة البرنامج بأنه يمتد من 18 إلى 36 شهراً.',
    steps: [
      { family_id: 'engineering', host_team_en: 'Plant engineering: systems and modifications', host_team_ar: 'هندسة المحطة: الأنظمة والتعديلات', host_role_id: 'systems-design-plant-engineer', host_manager_id: 'p-ops-ceo', months: 6, site_induction: true, objectives: [
        O('sk-en-01-mods', 2, 'Prepare a minor design-change package with a reviewer', 'إعداد حزمة تعديل تصميمي بسيط مع مراجِع'),
        O('sk-en-02', 2, 'Trend one system health indicator and present it', 'متابعة اتجاه مؤشر واحد لصحة نظام وعرضه'),
        O('sk-pf-03', 1, 'Walk down the main primary and secondary systems', 'القيام بجولة على الأنظمة الرئيسية في الدائرتين الأولية والثانوية')] },
      { family_id: 'outage', host_team_en: 'Outage and work management', host_team_ar: 'إدارة الانقطاعات والأعمال', host_role_id: 'outage-manager-planner', months: 6, site_induction: true, objectives: [
        O('sk-mp-01-outage', 2, 'Track work packages through one outage window', 'متابعة حزم العمل خلال نافذة انقطاع واحدة'),
        O('sk-hu-02-brief', 2, 'Run pre-job briefs with a supervisor present', 'إدارة إحاطات ما قبل العمل بحضور مشرف'),
        O('sk-en-01-project', 1, 'Keep the schedule-variance log for a project', 'إدارة سجل انحراف الجدول لمشروع')] },
      { family_id: 'quality', host_team_en: 'Supplier quality and inspection', host_team_ar: 'جودة الموردين والفحص', host_role_id: 'quality-assurance-qc', months: 6, site_induction: false, objectives: [
        O('sk-qa-01-inspect', 2, 'Perform receiving inspections under supervision', 'إجراء فحوصات الاستلام تحت الإشراف'),
        O('sk-qa-02', 2, 'Review a supplier quality plan against requirements', 'مراجعة خطة جودة لمورد مقابل المتطلبات'),
        O('sk-qa-02-cgd', 1, 'Follow one commercial-grade dedication package end to end', 'متابعة حزمة اعتماد لمكوّن تجاري من البداية إلى النهاية')] },
      { family_id: 'licensing', host_team_en: 'Regulatory affairs and licensing', host_team_ar: 'الشؤون التنظيمية والترخيص', host_role_id: 'regulatory-affairs-licensing-engineer', months: 6, site_induction: false, objectives: [
        O('sk-ns-02-licensing', 2, 'Draft an applicability review for a licensing commitment', 'إعداد مسودة مراجعة انطباق لالتزام ترخيصي'),
        O('sk-ns-02-techspec', 1, 'Trace a technical specification to its basis', 'تتبّع مواصفة فنية حتى أساسها'),
        O('sk-ns-01', 1, 'Summarise one safety-analysis chapter for a briefing', 'تلخيص فصل من تحليل السلامة لإحاطة')] },
    ],
  },
  {
    id: 'rt-gpo-field', owner: 'p-training-mgr', programme: 'gpo', min: 24, max: 36, sources: ['enec-gpo'], eligible: ['operations'], status: 'active',
    title_en: 'Graduate Plant Operator: first two years in the field and on the simulator', title_ar: 'مشغّل المحطة الخريج: السنتان الأوليان في الميدان وعلى المحاكي',
    summary_en: 'GPO graduates start as Local Operators. This rotation builds field rounds, chemistry and radiation-protection awareness, simulator procedure use and work-control understanding before SRO training, which ENEC describes as starting after three years.',
    summary_ar: 'يبدأ خريجو البرنامج كمشغّلين محليين. يبني هذا التناوب مهارات الجولات الميدانية، والوعي بالكيمياء والوقاية من الإشعاع، واستخدام الإجراءات على المحاكي، وفهم مراقبة الأعمال، قبل تدريب كبير مشغّلي المفاعل الذي تذكر المؤسسة أنه يبدأ بعد ثلاث سنوات.',
    steps: [
      { family_id: 'operations', host_team_en: 'Field operations, Crew B', host_team_ar: 'العمليات الميدانية، الطاقم ب', host_role_id: 'local-operator', host_manager_id: 'p-sro', months: 9, site_induction: true, objectives: [
        O('sk-co-01-rounds', 2, 'Complete operator rounds on two systems unaided', 'إكمال جولات المشغّل على نظامين دون مساعدة'),
        O('sk-hu-01-star', 2, 'Use self-checking (STAR) on every manipulation', 'استخدام التحقق الذاتي (STAR) في كل عملية تشغيل'),
        O('sk-pf-03', 1, 'Explain the flow path of the main steam and feedwater systems', 'شرح مسار التدفق في نظامي البخار الرئيسي ومياه التغذية')] },
      { family_id: 'chemistry', host_team_en: 'Chemistry and radiation protection exposure', host_team_ar: 'التعرّف على الكيمياء والوقاية من الإشعاع', host_role_id: 'chemistry-technician', months: 3, site_induction: true, objectives: [
        O('sk-ch-01-primary', 1, 'Observe primary-chemistry sampling and the results review', 'ملاحظة أخذ عينات كيمياء الدائرة الأولية ومراجعة النتائج'),
        O('sk-rp-01', 1, 'Explain dose limits and the work permit dose estimate', 'شرح حدود الجرعة وتقدير الجرعة في تصريح العمل'),
        O('sk-rp-02-survey', 1, 'Accompany a radiation survey and read the survey map', 'مرافقة مسح إشعاعي وقراءة خريطة المسح')] },
      { family_id: 'training', host_team_en: 'Simulator and procedures', host_team_ar: 'المحاكي والإجراءات', host_role_id: 'nuclear-training-instructor', host_manager_id: 'p-training-mgr', months: 6, site_induction: false, objectives: [
        O('sk-co-01-eop', 2, 'Follow emergency operating procedures in simulator sessions', 'اتباع إجراءات التشغيل الطارئة في جلسات المحاكي'),
        O('sk-pf-03-rcs', 2, 'Describe reactor coolant system responses to transients', 'وصف استجابات نظام تبريد المفاعل للعوابر'),
        O('sk-hu-02-brief', 1, 'Take part in crew briefs and debriefs', 'المشاركة في إحاطات الطاقم وجلسات المراجعة')] },
      { family_id: 'operations', host_team_en: 'Work control and outage planning', host_team_ar: 'مراقبة الأعمال وتخطيط الانقطاع', host_role_id: 'operations-support-work-control', host_manager_id: 'p-work-control', months: 6, site_induction: true, objectives: [
        O('sk-ns-02-techspec', 1, 'Screen work orders against technical specifications', 'فحص أوامر العمل مقابل المواصفات الفنية'),
        O('sk-mp-01-outage', 1, 'Support one outage window from the work control centre', 'دعم نافذة انقطاع واحدة من مركز مراقبة الأعمال'),
        O('sk-co-03', 1, 'Prepare equipment clearances with a reviewer', 'إعداد عزل المعدات مع مراجِع')] },
    ],
  },
  {
    id: 'rt-dnt-workplace', owner: 'p-training-mgr', programme: 'dnt', min: 12, max: 24, sources: ['enec-dnt-launch', 'enec-dnt-grad'], eligible: [], status: 'active',
    title_en: 'Diploma in Nuclear Technology: work-based placements', title_ar: 'دبلوم التقنية النووية: التدريب في بيئة العمل',
    summary_en: 'The work-based part of the 24-month DNT: placements in the maintenance workshop, the chemistry laboratory, radiation protection and field operations, leading towards Local Operator or Maintenance Technician roles.',
    summary_ar: 'الجزء العملي من دبلوم التقنية النووية الممتد 24 شهراً: تدريب في ورشة الصيانة ومختبر الكيمياء والوقاية من الإشعاع والعمليات الميدانية، تمهيداً لوظيفتي المشغّل المحلي أو فني الصيانة.',
    steps: [
      { family_id: 'maintenance', host_team_en: 'Mechanical maintenance workshop', host_team_ar: 'ورشة الصيانة الميكانيكية', host_role_id: 'maintenance-technician-engineer', host_manager_id: 'p-work-control', months: 4, site_induction: true, objectives: [
        O('sk-mp-01-mech', 2, 'Complete supervised pump and valve maintenance tasks', 'إكمال مهام صيانة المضخات والصمامات تحت الإشراف'),
        O('sk-hu-01-star', 1, 'Apply procedure use and adherence on every task', 'تطبيق استخدام الإجراءات والالتزام بها في كل مهمة')] },
      { family_id: 'chemistry', host_team_en: 'Chemistry laboratory', host_team_ar: 'مختبر الكيمياء', host_role_id: 'chemistry-technician', months: 2, site_induction: true, objectives: [
        O('sk-ch-02-labqa', 1, 'Run laboratory quality-control checks', 'إجراء فحوصات ضبط الجودة في المختبر'),
        O('sk-ch-01', 1, 'Explain why each primary-chemistry parameter is controlled', 'شرح سبب ضبط كل معامل من معاملات كيمياء الدائرة الأولية')] },
      { family_id: 'radiation-protection', host_team_en: 'Radiation protection', host_team_ar: 'الوقاية من الإشعاع', host_role_id: 'radiation-protection-technician', months: 2, site_induction: true, objectives: [
        O('sk-rp-02-survey', 1, 'Perform contamination surveys with a technician', 'إجراء مسوحات التلوث مع فني'),
        O('sk-rp-01-dose', 1, 'Compare planned and actual dose for a work package', 'مقارنة الجرعة المخططة والفعلية لحزمة عمل')] },
      { family_id: 'operations', host_team_en: 'Field operations, Crew B', host_team_ar: 'العمليات الميدانية، الطاقم ب', host_role_id: 'local-operator', host_manager_id: 'p-sro', months: 4, site_induction: true, objectives: [
        O('sk-co-01-rounds', 1, 'Shadow and then perform operator rounds', 'مرافقة ثم تنفيذ جولات المشغّل'),
        O('sk-hu-02-brief', 1, 'Contribute to pre-job briefs', 'المساهمة في إحاطات ما قبل العمل')] },
    ],
  },
  {
    id: 'rt-cross-ops-eng', owner: 'p-chco', programme: 'cross_functional', min: 6, max: 18, sources: [], eligible: ['operations'], status: 'active',
    title_en: 'Cross-functional move: operations to plant engineering', title_ar: 'انتقال متعدد الوظائف: من العمليات إلى هندسة المحطة',
    summary_en: 'For licensed and experienced operators exploring engineering: twelve months in plant engineering and outage planning, so a later move is deliberate and evidence-based rather than a leap.',
    summary_ar: 'للمشغّلين المرخّصين وذوي الخبرة الراغبين في استكشاف الهندسة: اثنا عشر شهراً في هندسة المحطة وتخطيط الانقطاعات، ليكون أي انتقال لاحق مدروساً ومبنياً على أدلة لا قفزة في المجهول.',
    steps: [
      { family_id: 'engineering', host_team_en: 'Plant engineering: system performance', host_team_ar: 'هندسة المحطة: أداء الأنظمة', host_role_id: 'systems-design-plant-engineer', host_manager_id: 'p-ops-ceo', months: 6, site_induction: true, objectives: [
        O('sk-en-01-mods', 2, 'Own the operations review of two design changes', 'تولّي مراجعة العمليات لتعديلين تصميميين'),
        O('sk-en-02-perf', 2, 'Build a performance trend for one system', 'إعداد اتجاه أداء لنظام واحد'),
        O('sk-da-01-analysis', 1, 'Use exported plant data for one engineering question', 'استخدام بيانات المحطة المصدّرة للإجابة عن سؤال هندسي')] },
      { family_id: 'outage', host_team_en: 'Outage planning', host_team_ar: 'تخطيط الانقطاعات', host_role_id: 'outage-manager-planner', months: 6, site_induction: true, objectives: [
        O('sk-mp-01-outage', 2, 'Plan the operations scope of one outage window', 'تخطيط نطاق العمليات لنافذة انقطاع واحدة'),
        O('sk-en-01-project', 1, 'Track milestones for an outage modification', 'متابعة مراحل تعديل خلال الانقطاع')] },
    ],
  },
  {
    id: 'rt-hipo-leadership', owner: 'p-chco', programme: 'hipo', min: 9, max: 15, sources: [], eligible: [], status: 'active',
    title_en: 'High-potential leadership rotation', title_ar: 'تناوب القيادة لأصحاب الإمكانات العالية',
    summary_en: 'Twelve months across the corrective action programme, emergency preparedness and training, for people identified in talent review. Each placement has leadership and safety-culture objectives that the host signs off.',
    summary_ar: 'اثنا عشر شهراً في برنامج الإجراءات التصحيحية والتأهب للطوارئ والتدريب، للموظفين الذين حُدّدوا في مراجعة المواهب. لكل تناوب أهداف في القيادة وثقافة السلامة يعتمدها المضيف.',
    steps: [
      { family_id: 'oversight', host_team_en: 'Corrective action programme', host_team_ar: 'برنامج الإجراءات التصحيحية', host_role_id: 'nuclear-oversight-npi', months: 4, site_induction: false, objectives: [
        O('sk-hu-01', 2, 'Screen condition reports with the committee', 'فحص تقارير الحالة مع اللجنة'),
        O('sk-sc-02', 2, 'Lead one apparent-cause evaluation', 'قيادة تقييم سبب ظاهري واحد')] },
      { family_id: 'emergency-preparedness', host_team_en: 'Emergency preparedness', host_team_ar: 'التأهب للطوارئ', host_role_id: 'emergency-preparedness-coordinator', host_manager_id: 'p-ep-manager', months: 4, site_induction: true, objectives: [
        O('sk-ep-01-ero', 2, 'Fill an emergency-response organisation position in a drill', 'شغل موقع في منظمة الاستجابة للطوارئ خلال تمرين'),
        O('sk-ld-02-decide', 2, 'Make and record time-critical decisions in an exercise', 'اتخاذ قرارات حرجة زمنياً وتسجيلها في تمرين')] },
      { family_id: 'training', host_team_en: 'Training and coaching', host_team_ar: 'التدريب والتوجيه', host_role_id: 'nuclear-training-instructor', host_manager_id: 'p-training-mgr', months: 4, site_induction: false, objectives: [
        O('sk-ld-01-coach', 2, 'Coach two junior colleagues for a quarter', 'توجيه زميلين مبتدئين لمدة ربع سنة'),
        O('sk-ld-01-instruct', 1, 'Co-deliver one classroom session', 'المشاركة في تقديم جلسة صفية واحدة')] },
    ],
  },
  {
    id: 'rt-digital-draft', owner: 'p-chco', programme: 'cross_functional', min: 6, max: 12, sources: [], eligible: [], status: 'draft',
    title_en: 'Digital and data rotation (draft)', title_ar: 'تناوب الرقمنة والبيانات (مسودة)',
    summary_en: 'Draft: six months for people moving into data roles, starting in work-control data and continuing with the governed AI review pilot. Hosts to be confirmed before publishing.',
    summary_ar: 'مسودة: ستة أشهر لمن ينتقلون إلى أدوار البيانات، تبدأ ببيانات مراقبة الأعمال وتستمر مع تجربة مراجعة الذكاء الاصطناعي المحوكم. يُؤكَّد المضيفون قبل النشر.',
    steps: [
      { family_id: 'operations', host_team_en: 'Work control data', host_team_ar: 'بيانات مراقبة الأعمال', host_role_id: 'operations-support-work-control', host_manager_id: 'p-work-control', months: 3, site_induction: false, objectives: [
        O('sk-da-01-analysis', 2, 'Analyse backlog data for one quarter', 'تحليل بيانات الأعمال المتراكمة لربع سنة')] },
      { family_id: 'outage', host_team_en: 'Governed AI review pilot', host_team_ar: 'تجربة مراجعة الذكاء الاصطناعي المحوكم', host_role_id: 'outage-manager-planner', months: 3, site_induction: false, objectives: [
        O('sk-da-02-review', 2, 'Review AI-drafted summaries against source records', 'مراجعة الملخصات المُعدّة آلياً مقابل السجلات الأصلية')] },
    ],
  },
];

// [id, template, owner, name_en, name_ar, intake, status, participants]
const COHORTS = [
  ['rc-gdp-2025', 'rt-gdp-engineering', 'p-chco', 'GDP 2025 intake (synthetic)', 'دفعة 2025 من برنامج تطوير الخريجين (اصطناعية)', '2025-10-01', 'running',
    ['w-eng-02', 'w-eng-03', 'w-eng-04', 'w-qa-01', 'w-qa-02', 'w-sc-01', 'w-corp-01', 'w-corp-02', 'p-qc-inspector', 'p-buyer', 'p-nse', 'p-rao']],
  ['rc-gpo-2025', 'rt-gpo-field', 'p-training-mgr', 'GPO 2025 cohort (synthetic)', 'دفعة 2025 من برنامج مشغّل المحطة الخريج (اصطناعية)', '2025-09-01', 'running',
    ['w-lo-01', 'w-lo-02', 'w-lo-03', 'w-lo-04', 'w-lo-05', 'w-lo-06', 'w-lo-07', 'w-lo-08', 'w-lo-09', 'p-k-lo-trainee']],
  ['rc-dnt-2026', 'rt-dnt-workplace', 'p-training-mgr', 'DNT 2026 work placements (synthetic)', 'تدريب دفعة 2026 من دبلوم التقنية النووية في بيئة العمل (اصطناعية)', '2026-07-01', 'running',
    ['w-mnt-05', 'w-mnt-06', 'w-mnt-07', 'w-chem-03', 'w-rp-04', 'w-fire-01']],
  ['rc-cross-2026', 'rt-cross-ops-eng', 'p-chco', 'Operations to engineering 2026 (synthetic)', 'من العمليات إلى الهندسة 2026 (اصطناعية)', '2026-09-01', 'running',
    ['w-ro-03', 'w-ro-05', 'w-sro-05', 'p-k-ro']],
  ['rc-hipo-2026', 'rt-hipo-leadership', 'p-chco', 'High-potential leaders 2026 (synthetic)', 'القادة أصحاب الإمكانات العالية 2026 (اصطناعية)', '2026-06-01', 'running',
    ['w-sro-01', 'w-eng-01', 'p-outage-planner']],
];
// placements past their end date that the host has not signed off yet (check-in recorded): the host desk's to-do list
const OVERDUE = new Set(['rc-gdp-2025:p-buyer:2', 'rc-gdp-2025:w-sc-01:2', 'rc-gpo-2025:w-lo-05:2', 'rc-hipo-2026:p-outage-planner:1']);
// started placements whose mid-point has passed but no check-in yet
const NO_CHECKIN = new Set(['rc-dnt-2026:w-fire-01:1', 'rc-dnt-2026:w-rp-04:1']);
// started placements with an early check-in already recorded
const EARLY_CHECKIN = new Set(['rc-gpo-2025:w-lo-03:3', 'rc-gdp-2025:p-rao:3']);

const NOTES_EN = [
  'Met the objectives with growing independence; ready for the next placement.',
  'Strong contribution to the team; one objective needs more practice in the next placement.',
  'Reliable and well prepared. Briefs were clear and procedure use was consistent.',
  'Good progress. Recommend more exposure to this area later in the programme.',
];
const CHECKIN_NOTES = [
  'Settled in well; objectives on track. Agreed two extra field sessions.',
  'Progressing; one objective at risk because of the outage schedule, recovery plan agreed.',
  'All objectives on track. Good questions in team meetings.',
];

// shadowing host directory: [person, skills, days per month, note_en, note_ar, active]
const HOSTS = [
  ['p-outage-planner', ['sk-mp-01-outage', 'sk-en-01-project', 'sk-hu-02-brief'], 3, 'Outage schedule reviews on Tuesdays and Thursdays.', 'مراجعات جدول الانقطاع يومي الثلاثاء والخميس.', true],
  ['p-rp-lead', ['sk-rp-01', 'sk-rp-01-dose', 'sk-rp-02-survey'], 2, 'Dose desk and survey planning; office-based days available.', 'مكتب الجرعات وتخطيط المسوحات؛ تتوفر أيام مكتبية.', true],
  ['p-chem-sup', ['sk-ch-01-primary', 'sk-ch-02-labqa', 'sk-ch-02'], 2, 'Laboratory QA and results review.', 'ضمان جودة المختبر ومراجعة النتائج.', true],
  ['p-work-control', ['sk-ns-02-techspec', 'sk-co-03', 'sk-mp-01'], 4, 'Work control centre: screening and scheduling.', 'مركز مراقبة الأعمال: الفحص والجدولة.', true],
  ['p-training-mgr', ['sk-ld-01-instruct', 'sk-ld-01-coach'], 2, 'Instructor preparation and simulator debriefs.', 'تحضير المدربين وجلسات المراجعة بعد المحاكي.', true],
  ['p-k-instructor', ['sk-ld-01-instruct', 'sk-co-01-eop', 'sk-pf-03-rcs'], 3, 'Simulator scenario sessions (no exam content).', 'جلسات سيناريوهات المحاكي (دون محتوى امتحاني).', true],
  ['p-qc-inspector', ['sk-qa-01-inspect', 'sk-qa-02'], 2, 'Receiving inspection in the warehouse.', 'فحص الاستلام في المستودع.', true],
  ['p-cap-coord', ['sk-hu-01', 'sk-sc-02'], 2, 'Condition report screening and trending.', 'فحص تقارير الحالة وتحليل اتجاهاتها.', true],
  ['p-sro', ['sk-co-02', 'sk-ld-02-decide', 'sk-hu-02-brief'], 2, 'Shift turnover and crew briefs, Crew B.', 'تسليم الوردية وإحاطات الطاقم، الطاقم ب.', true],
  ['p-sme-reviewer', ['sk-en-01-mods', 'sk-en-02'], 2, 'Engineering reviews of design changes.', 'المراجعات الهندسية للتعديلات التصميمية.', true],
  ['p-fuel-pm', ['sk-pf-03-fuel', 'sk-en-01-project'], 1, 'Fuel project planning (office).', 'تخطيط مشاريع الوقود (مكتبي).', true],
  ['p-rao', ['sk-ns-02-licensing', 'sk-ns-02-techspec'], 2, 'Licensing correspondence and commitments tracking.', 'المراسلات الترخيصية ومتابعة الالتزامات.', true],
  ['p-ep-manager', ['sk-ep-01', 'sk-ep-01-ero', 'sk-ld-02-decide'], 2, 'Drill preparation and after-action reviews.', 'التحضير للتمارين ومراجعات ما بعد التمرين.', true],
  ['w-sro-02', ['sk-co-02', 'sk-co-01-eop'], 2, 'Control-room shadowing from the observation area.', 'المرافقة في غرفة التحكم من منطقة المراقبة.', true],
  ['w-ro-01', ['sk-co-01', 'sk-co-01-rounds'], 2, 'Reactor operator workday walk-through.', 'استعراض يوم عمل مشغّل المفاعل.', true],
  ['w-instr-01', ['sk-ld-01-instruct', 'sk-ld-01-coach'], 3, 'Classroom and simulator instruction.', 'التدريس في الصف وعلى المحاكي.', true],
  ['w-eng-01', ['sk-en-02-perf', 'sk-da-01-analysis'], 2, 'System performance monitoring.', 'مراقبة أداء الأنظمة.', true],
  ['p-doa-signatory', ['sk-en-01-project'], 1, 'Paused for the budget cycle.', 'متوقف خلال دورة الميزانية.', false],
];

// shadowing requests: [n, person, host, start, days, skills, purpose, status, consents {h, m}, reflection/decline note]
const SHADOW = [
  [1, 'p-k-ro', 'p-rp-lead', '2026-10-26', 2, ['sk-rp-01-dose'], 'I want to understand how dose estimates are built for work packages before my engineering placement.', 'requested', { h: true, m: null }],
  [2, 'p-qc-inspector', 'p-outage-planner', '2026-11-03', 3, ['sk-mp-01-outage', 'sk-en-01-project'], 'See how outage work packages are planned so my inspections fit the outage schedule.', 'requested', { h: null, m: null }],
  [3, 'w-lo-04', 'p-sro', '2026-10-20', 1, ['sk-co-02'], 'Observe a shift turnover from the control room observation area.', 'requested', { h: null, m: null }],
  [4, 'w-lo-06', 'w-sro-02', '2026-10-27', 2, ['sk-co-02', 'sk-co-01-eop'], 'Understand the senior reactor operator role before applying for RO training.', 'requested', { h: null, m: true }],
  [5, 'w-mnt-01', 'p-work-control', '2026-11-10', 3, ['sk-ns-02-techspec', 'sk-co-03'], 'Learn how work orders are screened against technical specifications.', 'requested', { h: null, m: null }],
  [6, 'p-buyer', 'p-qc-inspector', '2026-10-21', 1, ['sk-qa-01-inspect'], 'See a receiving inspection for parts I buy.', 'requested', { h: true, m: null }],
  [7, 'w-chem-01', 'p-rp-lead', '2026-11-17', 2, ['sk-rp-02-survey'], 'Cross-train in survey planning for outage support.', 'requested', { h: null, m: null }],
  [8, 'p-cap-coord', 'p-ep-manager', '2026-11-04', 2, ['sk-ep-01-ero', 'sk-ld-02-decide'], 'Observe drill preparation to improve how drill findings are screened.', 'approved', { h: true, m: true }],
  [9, 'w-ro-02', 'p-k-instructor', '2026-10-12', 3, ['sk-ld-01-instruct'], 'Explore the instructor path with simulator sessions.', 'approved', { h: true, m: true }],
  [10, 'w-mnt-02', 'p-chem-sup', '2026-10-05', 2, ['sk-ch-02-labqa'], 'Understand laboratory QA to support instrument maintenance.', 'approved', { h: true, m: true }],
  [11, 'w-lo-08', 'w-ro-01', '2026-10-01', 1, ['sk-co-01'], 'Walk through a reactor operator day before the RO selection.', 'approved', { h: true, m: true }],
  [12, 'p-nse', 'p-sme-reviewer', '2026-11-24', 2, ['sk-en-01-mods'], 'Follow an engineering review of a design change that needs new specifications.', 'approved', { h: true, m: true }],
  [13, 'w-ro-04', 'p-k-instructor', '2026-08-17', 3, ['sk-ld-01-instruct', 'sk-co-01-eop'], 'Try instructing before applying for the instructor role.', 'completed', { h: true, m: true }, 'Ran two scenario briefings and a debrief with confidence.'],
  [14, 'w-lo-03', 'p-sro', '2026-07-06', 1, ['sk-co-02', 'sk-hu-02-brief'], 'Observe shift turnover and the crew brief.', 'completed', { h: true, m: true }, 'Asked good questions about turnover priorities.'],
  [15, 'w-mnt-03', 'p-work-control', '2026-06-15', 2, ['sk-ns-02-techspec'], 'See how technical specifications constrain maintenance windows.', 'completed', { h: true, m: true }, 'Screened three work orders with the team.'],
  [16, 'w-ro-06', 'w-eng-01', '2026-09-07', 2, ['sk-en-02-perf', 'sk-da-01-analysis'], 'Understand system performance monitoring.', 'completed', { h: true, m: true }, 'Built a first trend chart from exported data.'],
  [17, 'p-outage-planner', 'p-rao', '2026-05-11', 1, ['sk-ns-02-licensing'], 'Understand licensing commitments that affect outage scope.', 'completed', { h: true, m: true }, 'Mapped two commitments to outage activities.'],
  [18, 'w-chem-01', 'p-chem-sup', '2026-04-20', 2, ['sk-ch-01-primary'], 'Deepen primary chemistry knowledge.', 'completed', { h: true, m: true }, 'Reviewed a week of primary results with the supervisor.'],
  [19, 'p-sustainability-lead', 'p-cap-coord', '2026-08-03', 1, ['sk-sc-02'], 'Learn how the corrective action programme tracks safety-culture findings.', 'completed', { h: true, m: true }, 'Joined a screening meeting and wrote a short summary.'],
  [20, 'w-lo-09', 'p-sro', '2026-09-14', 1, ['sk-ld-02-decide'], 'Observe crew decision-making during a shift.', 'declined', { h: true, m: false }, 'Crew A is short-staffed this month; please ask again in December.'],
  [21, 'w-mnt-04', 'p-outage-planner', '2026-09-21', 3, ['sk-mp-01-outage'], 'Learn outage planning.', 'declined', { h: false, m: null }, 'Outage preparation peak; offered dates in January instead.'],
  [22, 'p-buyer', 'p-rao', '2026-09-28', 1, ['sk-ns-02-licensing'], 'Understand licensing requirements on procurement.', 'withdrawn', { h: null, m: null }],
  [23, 'w-lo-01', 'w-sro-02', '2026-08-24', 2, ['sk-co-02'], 'Observe SRO shift duties.', 'withdrawn', { h: true, m: null }],
  [24, 'w-ro-05', 'p-training-mgr', '2026-11-16', 2, ['sk-ld-01-coach'], 'Explore coaching new operators.', 'requested', { h: null, m: null }],
];

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const src = new Map((T.sources ?? []).map((s) => [s.id, s]));
  const hostCtx = { people: T.people, assignments: T.role_assignments, today };
  const ref = { skills: T.skills, families: T.job_families.map((f) => f.id), roles: T.job_roles.map((r) => r.id), sources: [...src.keys()] };
  const at = (d, hh = 9) => `${d}T${String(hh).padStart(2, '0')}:00:00Z`;
  T.rotation_templates = [];
  T.rotation_cohorts = [];
  T.rotation_placements = [];
  T.shadow_hosts = [];
  T.shadow_requests = [];
  T.notifications ??= [];
  T.skill_evidence ??= [];
  const notify = (id, person, en, ar, link, severity = 'info', when = at(today, 8)) => {
    if (!people.has(person) || T.notifications.some((n) => n.id === id)) return;
    T.notifications.push({ id, person_id: person, kind: 'rotation', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity, created_at: when, read_at: null });
  };

  const tpl = new Map();
  for (const t of TEMPLATES) {
    const input = { programme: t.programme, title_en: t.title_en, title_ar: t.title_ar, summary_en: t.summary_en, summary_ar: t.summary_ar, duration_min_months: t.min, duration_max_months: t.max, steps: t.steps, eligible_families: t.eligible, source_ids: t.sources, status: t.status };
    const v = validateTemplate(input, ref, hostCtx);
    if ('code' in v) throw new Error(`f15: template ${t.id} invalid: ${v.message}`);
    const row = {
      id: t.id, programme: t.programme, owner_id: t.owner, title_en: t.title_en, title_ar: t.title_ar, summary_en: t.summary_en, summary_ar: t.summary_ar,
      duration_min_months: t.min, duration_max_months: t.max, steps: v.steps, eligible_families: t.eligible,
      sources: t.sources.map((id) => ({ id, label: src.get(id).label, url: src.get(id).url })), status: t.status, listed: t.status !== 'draft',
      created_at: at('2025-06-01'), updated_at: at('2026-09-15'),
    };
    T.rotation_templates.push(row);
    tpl.set(t.id, row);
  }

  for (const [cid, tid, owner, name_en, name_ar, intake, status, members] of COHORTS) {
    const t = tpl.get(tid);
    T.rotation_cohorts.push({ id: cid, template_id: tid, programme: t.programme, owner_id: owner, name_en, name_ar, intake_on: intake, status, listed: true, created_at: at(addDays(intake, -45)), updated_at: at(addDays(intake, -45)) });
    const slug = cid.replace(/^rc-/, '').replace('-20', '');
    for (const pid of members) {
      const p = people.get(pid);
      if (!p || p.kind !== 'staff' || p.status === 'leaver') throw new Error(`f15: ${pid} is not active staff`);
      const enrolment = `re-${slug}-${pid}`;
      const plan = planPlacements(t.steps, intake);
      plan.forEach(({ step, starts_on, ends_on }) => {
        const key = `${cid}:${pid}:${step.seq}`;
        const r = signerFor(pid, step.host_manager_id, T.people, T.role_assignments, today);
        if (!r.signer) throw new Error(`f15: no signer for ${key}`);
        const id = `rp-${slug}-${pid}-${step.seq}`;
        const mid = midpoint(starts_on, ends_on);
        const started = starts_on <= today;
        const past = ends_on < today;
        const signed = past && !OVERDUE.has(key) && pid !== 'p-k-ro';
        const hk = h32(key);
        let checkin = null;
        let checkin_at = null;
        let checkin_by = null;
        if (started && ((mid <= today && !NO_CHECKIN.has(key)) || EARLY_CHECKIN.has(key))) {
          const when = mid <= today ? mid : addDays(starts_on, 7);
          checkin_by = hk % 2 ? pid : step.host_manager_id;
          checkin_at = at(when, 10);
          const progress = Object.fromEntries(step.objectives.map((o, i) => [o.id, (hk >> (i + 2)) % 7 === 0 ? 'at_risk' : (hk >> (i + 5)) % 3 === 0 ? 'met' : 'on_track']));
          checkin = { at: checkin_at, by: checkin_by, progress, note: CHECKIN_NOTES[Object.values(progress).includes('at_risk') ? 1 : hk % 2 ? 0 : 2] };
        }
        let outcome_levels = {};
        let evidence_ids = [];
        let signed_off_at = null;
        let outcome_note = null;
        if (signed) {
          step.objectives.forEach((o, i) => {
            const roll = (hk >> (i * 3)) % 9;
            outcome_levels[o.id] = Math.max(1, Math.min(3, o.level + (roll === 0 ? -1 : roll === 1 ? 1 : 0)));
          });
          if (Object.values(outcome_levels).every((v) => v === 0)) outcome_levels[step.objectives[0].id] = 1;
          const signedOn = addDays(ends_on, 2 + (hk % 9)) <= today ? addDays(ends_on, 2 + (hk % 9)) : today;
          signed_off_at = at(signedOn, 14);
          outcome_note = NOTES_EN[hk % NOTES_EN.length];
          const lv = skillLevels(outcome_levels, step.objectives);
          for (const [skill, level] of Object.entries(lv).sort(([x], [y]) => (x < y ? -1 : 1))) {
            const e = rotationEvidence('rotation_placements', { id, person_id: pid }, skill, level, signedOn, r.signer, `${t.title_en} · ${step.host_team_en}`);
            T.skill_evidence.push({ ...e, created_at: signed_off_at });
            evidence_ids.push(e.id);
          }
        }
        T.rotation_placements.push({
          id, enrolment_id: enrolment, person_id: pid, template_id: tid, cohort_id: cid, seq: step.seq, family_id: step.family_id,
          host_team_en: step.host_team_en, host_team_ar: step.host_team_ar, host_role_id: step.host_role_id, host_manager_id: step.host_manager_id, host_name: step.host_name_en, host_name_ar: step.host_name_ar,
          line_manager_id: r.lineManager, signer_id: r.signer, skip_level: r.skipLevel, starts_on, ends_on, site_induction: step.site_induction, objectives: step.objectives,
          status: signed ? 'signed_off' : started ? 'active' : 'planned', checkin, checkin_at, checkin_by,
          signed_off_by: signed ? r.signer : null, signed_off_at, outcome_note, outcome_levels, evidence_ids, enrolled_by: owner,
          person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
          open_read: false, created_at: at(addDays(intake, -30)), updated_at: signed_off_at ?? checkin_at ?? at(addDays(intake, -30)),
        });
        if (!signed && past) notify(`nt-${id}-due`, r.signer, `Placement waiting for your sign-off: ${p.display_name}`, `تناوب بانتظار اعتمادك: ${p.display_name_ar || p.display_name}`, '/opportunities/rotations/host', 'warn');
      });
      if (intake >= addDays(today, -120)) notify(`nt-${enrolment}-enrolled`, pid, `You are enrolled: ${t.title_en}`, `تم تسجيلك: ${t.title_ar}`, '/opportunities/rotations/my', 'ok', at(addDays(intake, -30)));
    }
  }

  for (const [pid, skills, days, note_en, note_ar, active] of HOSTS) {
    const p = people.get(pid);
    if (!p || p.kind !== 'staff' || ['security', 'cyber', 'safeguards'].includes(p.job_family_id)) throw new Error(`f15: bad host ${pid}`);
    T.shadow_hosts.push({
      id: `sh:${pid}`, person_id: pid, name: p.display_name, name_ar: p.display_name_ar || p.display_name, role_id: p.job_role_id ?? null, family_id: p.job_family_id ?? null,
      skill_ids: skills, max_days_month: days, note_en, note_ar, site_induction: SITE_FAMILIES.includes(p.job_family_id ?? ''), active, listed: active, updated_at: at('2026-09-01'),
    });
  }
  const hostRow = new Map(T.shadow_hosts.map((x) => [x.person_id, x]));

  for (const [n, pid, hid, start, days, skills, purpose, status, consent, note] of SHADOW) {
    const p = people.get(pid);
    const hp = people.get(hid);
    const host = hostRow.get(hid);
    const lm = lineManagerOf(pid, T.people, T.role_assignments, today);
    if (!p || !hp || !host || !lm || pid === hid || skills.some((s) => !host.skill_ids.includes(s))) throw new Error(`f15: bad shadow request ${n}`);
    const id = `sr-${String(n).padStart(3, '0')}-${pid}`;
    // requested about three weeks ahead, but never after the demo's today (history steps run up to five days later)
    const ahead = addDays(start, -21);
    const latest = addDays(today, -6 - (n % 4));
    const created = ahead < latest ? ahead : latest;
    const hist = [{ at: at(created, 9), status: 'requested', by: pid, note: purpose }];
    const same = lm === hid;
    const hc = consent.h;
    const mc = same ? hc : consent.m;
    if (hc != null) hist.push({ at: at(addDays(created, 2), 11), status: hc ? (mc === true && same ? 'approved' : 'consented') : 'declined', by: hid, note: hc ? null : note ?? null });
    if (!same && mc != null) hist.push({ at: at(addDays(created, 3), 12), status: mc ? (hc ? 'approved' : 'consented') : 'declined', by: lm, note: mc ? null : note ?? null });
    if (status === 'withdrawn') hist.push({ at: at(addDays(created, 5), 15), status: 'withdrawn', by: pid, note: null });
    let evidence_ids = [];
    let completed_at = null;
    if (status === 'completed') {
      const on = addDays(start, days + 1);
      completed_at = at(on, 16);
      hist.push({ at: completed_at, status: 'completed', by: hid, note });
      for (const s of [...skills].sort()) {
        const e = rotationEvidence('shadow_requests', { id, person_id: pid }, s, 1, on, hid, `${host.name} (${days} d)`);
        T.skill_evidence.push({ ...e, created_at: completed_at });
        evidence_ids.push(e.id);
      }
    }
    T.shadow_requests.push({
      id, person_id: pid, host_id: hid, line_manager_id: lm, host_family_id: hp.job_family_id ?? null, host_role_id: hp.job_role_id ?? null, start_on: start, days, skill_ids: skills, purpose, status,
      host_consent: hc ?? null, manager_consent: mc ?? null, host_note: hc === false ? note : null, manager_note: !same && mc === false ? note : null, site_induction: host.site_induction,
      person_name: p.display_name, person_name_ar: p.display_name_ar || p.display_name, person_role_id: p.job_role_id ?? null, person_family_id: p.job_family_id ?? null,
      host_name: host.name, host_name_ar: host.name_ar, reflection: status === 'completed' ? note : null, completed_at, evidence_ids, history: hist, open_read: false,
      created_at: at(created, 9), updated_at: hist[hist.length - 1].at,
    });
    if (status === 'requested') {
      if (hc == null) notify(`nt-${id}-host`, hid, `Shadowing request from ${p.display_name}`, `طلب مرافقة من ${p.display_name_ar || p.display_name}`, '/opportunities/rotations/host', 'info', at(created, 9));
      if (!same && mc == null) notify(`nt-${id}-manager`, lm, `Shadowing consent needed: ${p.display_name}`, `مطلوب موافقتك على المرافقة: ${p.display_name_ar || p.display_name}`, '/opportunities/rotations/host', 'info', at(created, 9));
    }
  }
}
