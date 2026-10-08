// M02 qualification standards, task lists, JPMs; M04 programmes, courses, modules, curriculum rules.
// Task statements are generic industry-practice descriptions; no procedures, layouts or security content.
import { srcs } from './sources.mjs';

// [id, code, title_en, title_ar, roles, discipline, owner, requalMonths, securityRestricted, tasks[[code, en, ar, method, evaluator_role, critical]]]
const QS = [
  ['qs-lo-turbine', 'LO-WS-TB', 'Local Operator watch-station: turbine building', 'محطة مراقبة المشغّل المحلي: مبنى التوربين', ['local-operator'], 'Operations', 'Operations Training', 24, false, [
    ['T1', 'Perform a routine operator round and record parameters', 'إجراء جولة المشغّل الروتينية وتسجيل المعايير', 'ojt', 'Qualified LO evaluator', false],
    ['T2', 'Start and stop a secondary-side pump using the approved procedure', 'تشغيل مضخة في الجانب الثانوي وإيقافها باستخدام الإجراء المعتمد', 'jpm', 'Instructor / evaluator', true],
    ['T3', 'Hang and remove a clearance under supervision', 'وضع العزل وإزالته تحت الإشراف', 'jpm', 'Instructor / evaluator', true],
    ['T4', 'Respond to a local alarm and report to the control room', 'الاستجابة لإنذار محلي وإبلاغ غرفة التحكم', 'simulator', 'Instructor / evaluator', false],
    ['T5', 'Apply three-way communication and peer checking', 'تطبيق الاتصال الثلاثي والتحقق من الزميل', 'ojt', 'Qualified LO evaluator', false]]],
  ['qs-lo-aux', 'LO-WS-AUX', 'Local Operator watch-station: auxiliary building', 'محطة مراقبة المشغّل المحلي: المبنى المساعد', ['local-operator'], 'Operations', 'Operations Training', 24, false, [
    ['T1', 'Perform a routine operator round and record parameters', 'إجراء جولة المشغّل الروتينية وتسجيل المعايير', 'ojt', 'Qualified LO evaluator', false],
    ['T2', 'Align a system valve line-up per procedure with independent verification', 'ضبط اصطفاف صمامات نظام وفق الإجراء مع تحقق مستقل', 'jpm', 'Instructor / evaluator', true],
    ['T3', 'Observe radiological controls when entering a controlled area', 'مراعاة الضوابط الإشعاعية عند دخول منطقة خاضعة للرقابة', 'ojt', 'RP technician', false],
    ['T4', 'Report an equipment deficiency through the corrective action programme', 'الإبلاغ عن عيب في المعدات عبر برنامج الإجراءات التصحيحية', 'classroom', 'Instructor / evaluator', false]]],
  ['qs-ro', 'RO-QC', 'Reactor Operator qualification card (pre-FANR exam)', 'بطاقة تأهيل مشغّل المفاعل (قبل اختبار الهيئة)', ['reactor-operator'], 'Operations', 'Operations Training', 24, false, [
    ['T1', 'Perform a reactor start-up on the full-scope simulator', 'تنفيذ بدء تشغيل المفاعل على المحاكي كامل النطاق', 'simulator', 'SRO-qualified instructor', true],
    ['T2', 'Respond to a reactor trip using emergency operating procedures (simulator)', 'الاستجابة لتوقف المفاعل باستخدام إجراءات التشغيل في الطوارئ (المحاكي)', 'simulator', 'SRO-qualified instructor', true],
    ['T3', 'Perform a reactivity manipulation with peer verification', 'تنفيذ تعديل في التفاعلية مع تحقق الزميل', 'jpm', 'SRO-qualified instructor', true],
    ['T4', 'Conduct a shift turnover', 'إجراء تسليم النوبة', 'ojt', 'Shift supervisor', false],
    ['T5', 'Pass the internal comprehensive written exam', 'اجتياز الاختبار الكتابي الداخلي الشامل', 'written', 'Instructor / evaluator', false]]],
  ['qs-sro', 'SRO-QC', 'Senior Reactor Operator qualification card', 'بطاقة تأهيل المشغّل الأول للمفاعل', ['senior-reactor-operator'], 'Operations', 'Operations Training', 24, false, [
    ['T1', 'Direct the crew through an emergency scenario (simulator)', 'توجيه الطاقم خلال سيناريو طوارئ (المحاكي)', 'simulator', 'SRO-qualified instructor', true],
    ['T2', 'Apply technical specifications to a plant condition', 'تطبيق المواصفات الفنية على حالة في المحطة', 'jpm', 'SRO-qualified instructor', true],
    ['T3', 'Lead a pre-job brief graded to risk', 'قيادة إحاطة ما قبل العمل المتدرجة حسب المخاطر', 'ojt', 'Shift supervisor', false],
    ['T4', 'Make and document a conservative operating decision', 'اتخاذ قرار تشغيلي متحفظ وتوثيقه', 'simulator', 'SRO-qualified instructor', false]]],
  ['qs-mech', 'MNT-MECH', 'Mechanical maintenance technician qualification', 'تأهيل فني الصيانة الميكانيكية', ['maintenance-technician-engineer'], 'Maintenance', 'Maintenance Training', 36, false, [
    ['T1', 'Disassemble and reassemble a centrifugal pump per work package', 'فك مضخة طاردة مركزية وإعادة تجميعها وفق حزمة العمل', 'jpm', 'Instructor / evaluator', true],
    ['T2', 'Perform a valve packing adjustment', 'ضبط حشوة صمام', 'ojt', 'Qualified maintenance evaluator', false],
    ['T3', 'Apply foreign material exclusion controls', 'تطبيق ضوابط منع دخول المواد الغريبة', 'ojt', 'Qualified maintenance evaluator', true],
    ['T4', 'Complete work package documentation', 'إكمال وثائق حزمة العمل', 'classroom', 'Instructor / evaluator', false]]],
  ['qs-elec', 'MNT-ELEC', 'Electrical maintenance technician qualification', 'تأهيل فني الصيانة الكهربائية', ['maintenance-technician-engineer'], 'Maintenance', 'Maintenance Training', 36, false, [
    ['T1', 'Perform a motor insulation resistance test', 'إجراء اختبار مقاومة العزل لمحرك', 'jpm', 'Instructor / evaluator', true],
    ['T2', 'Apply electrical safe work practices and verify zero energy', 'تطبيق ممارسات العمل الكهربائي الآمن والتحقق من انعدام الطاقة', 'jpm', 'Instructor / evaluator', true],
    ['T3', 'Perform breaker preventive maintenance', 'إجراء الصيانة الوقائية للقواطع', 'ojt', 'Qualified maintenance evaluator', false]]],
  ['qs-ic', 'MNT-IC', 'I&C maintenance technician qualification', 'تأهيل فني صيانة الأجهزة والتحكم', ['maintenance-technician-engineer'], 'Maintenance', 'Maintenance Training', 36, false, [
    ['T1', 'Calibrate a pressure transmitter', 'معايرة مرسل ضغط', 'jpm', 'Instructor / evaluator', true],
    ['T2', 'Perform a loop check', 'إجراء فحص الحلقة', 'ojt', 'Qualified maintenance evaluator', false],
    ['T3', 'Control measuring and test equipment', 'ضبط معدات القياس والاختبار', 'classroom', 'Instructor / evaluator', false]]],
  ['qs-rp', 'RP-TECH', 'Radiation Protection technician qualification', 'تأهيل فني الوقاية من الإشعاع', ['radiation-protection-technician'], 'Radiation Protection', 'RP Training', 24, false, [
    ['T1', 'Perform a radiation and contamination survey', 'إجراء مسح للإشعاع والتلوث', 'jpm', 'Instructor / evaluator', true],
    ['T2', 'Prepare a radiation work permit', 'إعداد تصريح عمل إشعاعي', 'jpm', 'Instructor / evaluator', true],
    ['T3', 'Perform an instrument response check', 'إجراء فحص استجابة الجهاز', 'ojt', 'Qualified RP evaluator', false],
    ['T4', 'Brief workers on ALARA controls', 'إحاطة العاملين بضوابط ALARA', 'ojt', 'Qualified RP evaluator', false]]],
  ['qs-chem', 'CHEM-TECH', 'Chemistry technician qualification', 'تأهيل فني الكيمياء', ['chemistry-technician'], 'Chemistry', 'Chemistry Training', 24, false, [
    ['T1', 'Collect a primary system sample using approved controls', 'جمع عينة من النظام الأولي باستخدام الضوابط المعتمدة', 'jpm', 'Instructor / evaluator', true],
    ['T2', 'Perform a pH and conductivity analysis', 'إجراء تحليل الأس الهيدروجيني والموصلية', 'jpm', 'Instructor / evaluator', false],
    ['T3', 'Maintain laboratory quality control charts', 'الحفاظ على مخططات مراقبة جودة المختبر', 'ojt', 'Qualified chemistry evaluator', false]]],
  ['qs-eng', 'ENG-SYS', 'Systems engineer qualification standard', 'معيار تأهيل مهندس الأنظمة', ['systems-design-plant-engineer'], 'Engineering', 'Engineering Training', 36, false, [
    ['T1', 'Prepare a system health report', 'إعداد تقرير سلامة النظام', 'ojt', 'Engineering supervisor', false],
    ['T2', 'Review a design change for configuration impact', 'مراجعة تغيير تصميم لتأثيره على التهيئة', 'ojt', 'Engineering supervisor', true],
    ['T3', 'Present an operability input to operations', 'تقديم مدخلات قابلية التشغيل إلى العمليات', 'classroom', 'Engineering supervisor', false]]],
  ['qs-ero', 'EP-ERO', 'Emergency response organisation role qualification', 'تأهيل أدوار منظمة الاستجابة للطوارئ', ['emergency-preparedness-coordinator'], 'Emergency Preparedness', 'EP Training', 12, false, [
    ['T1', 'Complete ERO role training and test (REG-12 Art. 23)', 'إكمال تدريب دور منظمة الاستجابة واختباره (المادة 23 من اللائحة 12)', 'classroom', 'EP instructor', true],
    ['T2', 'Participate in a drill in the assigned role', 'المشاركة في تمرين ضمن الدور المحدد', 'ojt', 'EP instructor', true]]],
  ['qs-fire', 'FIRE-BRIG', 'Plant fire brigade member qualification', 'تأهيل عضو فرقة الإطفاء في المحطة', ['fire-protection'], 'Fire Protection', 'Fire Protection', 12, false, [
    ['T1', 'Don breathing apparatus within the required time', 'ارتداء جهاز التنفس خلال الوقت المطلوب', 'jpm', 'Fire brigade instructor', true],
    ['T2', 'Participate in a live fire drill', 'المشاركة في تمرين إطفاء حي', 'ojt', 'Fire brigade instructor', true]]],
  ['qs-instr', 'INSTR-QUAL', 'Instructor initial qualification', 'التأهيل الأولي للمدرب', ['nuclear-training-instructor'], 'Nuclear Training', 'Nuclear Training', 24, false, [
    ['T1', 'Design a lesson plan using SAT', 'تصميم خطة درس باستخدام النهج المنهجي للتدريب', 'ojt', 'Training supervisor', false],
    ['T2', 'Deliver a classroom session observed by a qualified evaluator', 'تقديم جلسة صفية بحضور مقيّم مؤهل', 'ojt', 'Training supervisor', true],
    ['T3', 'Evaluate a JPM and document the result', 'تقييم مقياس أداء وتوثيق النتيجة', 'jpm', 'Training supervisor', true]]],
  ['qs-qa', 'QA-AUDITOR', 'Quality assurance lead auditor qualification', 'تأهيل كبير مدققي ضمان الجودة', ['quality-assurance-qc'], 'Quality', 'Quality', 36, false, [
    ['T1', 'Plan an NQA-1 audit', 'تخطيط تدقيق وفق NQA-1', 'ojt', 'Lead auditor', false],
    ['T2', 'Lead an audit team and write findings', 'قيادة فريق تدقيق وكتابة الملاحظات', 'ojt', 'Lead auditor', true]]],
  ['qs-wc', 'WC-CLEAR', 'Work control clearance writer qualification', 'تأهيل محرر العزل في التحكم بالأعمال', ['operations-support-work-control'], 'Operations', 'Operations Training', 24, false, [
    ['T1', 'Prepare a clearance boundary from approved drawings', 'إعداد حدود العزل من المخططات المعتمدة', 'jpm', 'Instructor / evaluator', true],
    ['T2', 'Independently verify a clearance', 'التحقق المستقل من العزل', 'jpm', 'Instructor / evaluator', true]]],
  ['qs-get', 'GET', 'General Employee Training (site access prerequisite)', 'التدريب العام للموظفين (متطلب دخول الموقع)', [], 'All staff', 'Nuclear Training', 24, false, [
    ['T1', 'Complete GET and pass the knowledge check', 'إكمال التدريب العام واجتياز فحص المعرفة', 'written', 'Instructor / evaluator', false],
    ['T2', 'Complete human performance core tools refresher', 'إكمال تجديد الأدوات الأساسية للأداء البشري', 'classroom', 'Instructor / evaluator', false]]],
  ['qs-sec', 'SEC-QUAL', 'Security officer qualification (mirrored as qualified / not qualified only)', 'تأهيل ضابط الأمن (يُعرض كمؤهل / غير مؤهل فقط)', ['security-officer'], 'Security', 'Security', 12, true, []],
];

export function buildQualification() {
  const standards = [];
  const tasks = [];
  const jpms = [];
  const requal = [];
  for (const [id, code, title_en, title_ar, role_ids, discipline, owner_role, requal_months, security_restricted, tl] of QS) {
    standards.push({ id, code, title_en, title_ar, role_ids, discipline, version: 1, status: 'current', owner_role, requal_months, effective_date: '2025-01-01', supersedes_id: null, change_reason: null, security_restricted });
    requal.push({ id: `rq-${id}`, standard_id: id, interval_months: requal_months, notice_days: [90, 60, 30], description_en: `Requalify every ${requal_months} months; notices at 90, 60 and 30 days.`, description_ar: `إعادة التأهيل كل ${requal_months} شهراً؛ إشعارات قبل 90 و60 و30 يوماً.` });
    tl.forEach(([tcode, en, ar, method, evaluator_role, critical], i) => {
      const tid = `${id}-${tcode.toLowerCase()}`;
      tasks.push({ id: tid, standard_id: id, code: `${code}-${tcode}`, statement_en: en, statement_ar: ar, conditions_en: 'Given the approved procedure and required tools.', standards_en: 'Performed without error on critical steps.', method, evaluator_role, critical, sort: i + 1 });
      if (method === 'jpm') {
        jpms.push({
          id: `jpm-${tid}`, task_id: tid, standard_id: id, code: `JPM-${code}-${tcode}`, title_en: en, title_ar: ar,
          critical_steps: [
            { n: 1, en: 'Obtain and review the current procedure revision', ar: 'الحصول على المراجعة الحالية للإجراء ومراجعتها', critical: false },
            { n: 2, en: 'Perform a pre-job brief and identify error-likely situations', ar: 'إجراء إحاطة ما قبل العمل وتحديد المواقف المعرّضة للخطأ', critical: false },
            { n: 3, en: 'Perform the step that changes plant or equipment state with peer verification', ar: 'تنفيذ الخطوة التي تغيّر حالة المحطة أو المعدات مع تحقق الزميل', critical: true },
            { n: 4, en: 'Verify the expected response', ar: 'التحقق من الاستجابة المتوقعة', critical: true },
            { n: 5, en: 'Restore, document and report', ar: 'الإعادة والتوثيق والإبلاغ', critical: false },
          ],
          pass_criteria_en: 'All critical steps performed correctly; a failed critical step fails the JPM regardless of total score.',
          pass_criteria_ar: 'أداء جميع الخطوات الحرجة بشكل صحيح؛ يؤدي الإخفاق في خطوة حرجة إلى رسوب المقياس بغض النظر عن المجموع.',
          time_limit_min: 30,
        });
      }
    });
  }
  return { standards, tasks, jpms, requal };
}

// ───────────── Programmes (catalogue seed, M04) [id, code, en, ar, area, kind, family, dur_en, dur_ar, weeks, hours, pop, note, purpose_en, purpose_ar, srcIds, conflict, mandatory]
const P = [
  ['get', 'GET', 'General Employee Training', 'التدريب العام للموظفين', 'all_staff', 'general', null, 'Site access prerequisite', 'متطلب دخول الموقع', null, null, 1090, 'people in GET, 2024', 'Plant access fundamentals (FSAR 13.2 and OSHAD) for everyone working at Barakah.', 'أساسيات دخول المحطة لكل من يعمل في براكة.', ['sr2024', 'cns10'], null, true],
  ['onboarding', 'ONB', 'Onboarding', 'برنامج التهيئة', 'all_staff', 'general', null, '3 days', '3 أيام', null, null, 281, 'people, 2024', 'Welcome to ENEC: values, safety culture and ways of working.', 'مرحباً بك في ENEC: القيم وثقافة السلامة وأساليب العمل.', ['sr2024'], null, true],
  ['hu-core', 'HU-CORE', 'Human performance core tools', 'الأدوات الأساسية للأداء البشري', 'all_staff', 'general', null, 'Mandatory for all, incl. supplemental workers', 'إلزامي للجميع بما في ذلك العمالة المساندة', null, null, null, null, 'Self-checking, peer checking, three-way communication, procedure use and pre-job briefs.', 'التحقق الذاتي والتحقق من الزميل والاتصال الثلاثي واستخدام الإجراءات وإحاطات ما قبل العمل.', ['cns10'], null, true],
  ['scwe', 'SCWE', 'Safety-conscious work environment (SCWE) training', 'تدريب بيئة العمل الواعية بالسلامة', 'all_staff', 'general', null, 'Workshop', 'ورشة عمل', null, null, 215, 'completed YTD 2024', 'How to raise concerns, and the protection against harassment, intimidation, retaliation and discrimination.', 'كيفية رفع المخاوف والحماية من المضايقة والترهيب والانتقام والتمييز.', ['sr2024'], null, false],
  ['professionalism', 'NPW', 'Nuclear professionalism workshops', 'ورش الاحترافية النووية', 'all_staff', 'general', null, 'Workshop', 'ورشة عمل', null, null, null, null, 'What nuclear professionalism means day to day.', 'معنى الاحترافية النووية في العمل اليومي.', ['cns10'], null, false],
  ['security-awareness', 'SEC-AW', 'Security awareness (general)', 'الوعي الأمني (عام)', 'all_staff', 'general', null, 'E-learning', 'تعلم إلكتروني', null, null, null, null, 'General security awareness for all staff. No security arrangements are described.', 'الوعي الأمني العام لجميع الموظفين. لا يتضمن أي ترتيبات أمنية.', ['cns10'], null, true],
  ['loit', 'LOIT', 'Local Operator Initial Training (LOIT)', 'التدريب الأولي للمشغّلين المحليين', 'operations', 'initial', 'operations', '60 weeks / 1,920 h', '60 أسبوعاً / 1,920 ساعة', 60, 1920, 237, 'trainees, 2024', 'Initial training for Local Operators: plant systems, watch-station qualification, rounds and clearances.', 'التدريب الأولي للمشغّلين المحليين: أنظمة المحطة وتأهيل محطة المراقبة والجولات والعزل.', ['sr2024'], null, false],
  ['coit', 'COIT', 'Certified Operator Initial Training (COIT)', 'التدريب الأولي للمشغّلين المعتمدين', 'operations', 'initial', 'operations', '91 weeks / 2,912 h (SR2024); 82 weeks (CNS)', '91 أسبوعاً / 2,912 ساعة (تقرير الاستدامة)؛ 82 أسبوعاً (تقرير الاتفاقية)', 91, 2912, 56, 'operators, 2024', 'Classroom (generic fundamentals, integrated systems, fuel handling, leadership), OJT with job qualification cards, and main-control-room simulator training including severe accidents.', 'دروس صفية (الأساسيات العامة والأنظمة المتكاملة ومناولة الوقود والقيادة) وتدريب أثناء العمل بطاقات التأهيل وتدريب على محاكي غرفة التحكم بما في ذلك الحوادث الشديدة.', ['sr2024', 'cns10'], 'COIT length: 91 weeks (SR2024) vs 82 weeks (CNS report).', false],
  ['loct', 'LOCT', 'Local Operator Continuing Training (LOCT)', 'التدريب المستمر للمشغّلين المحليين', 'operations', 'continuing', 'operations', '5-6 weeks per crew per year', '5-6 أسابيع لكل طاقم سنوياً', 6, null, 162, 'local operators, 2024', 'Continuing training with combined scenarios on full-scope simulators linked to a 3D virtual plant.', 'تدريب مستمر بسيناريوهات مشتركة على محاكيات كاملة النطاق مرتبطة بمحطة افتراضية ثلاثية الأبعاد.', ['sr2024', 'cns10'], 'COCT/LOCT: 6 weeks (SR2024) vs about 5 weeks (CNS).', true],
  ['coct', 'COCT', 'Certified Operator Continuing Training (COCT)', 'التدريب المستمر للمشغّلين المعتمدين', 'operations', 'continuing', 'operations', '5-6 weeks per crew per year (1,200 h)', '5-6 أسابيع لكل طاقم سنوياً (1,200 ساعة)', 6, 1200, 182, 'certified operators, 2024', 'Licence-critical continuing training for ROs and SROs; linked to biennial requalification.', 'تدريب مستمر حاسم للترخيص لمشغّلي المفاعل والمشغّلين الأوائل؛ مرتبط بإعادة التأهيل كل سنتين.', ['sr2024', 'cns10'], 'COCT: 6 weeks (SR2024) vs about 5 weeks (CNS).', true],
  ['severe-accident', 'SAM-SIM', 'Severe-accident simulator training', 'تدريب الحوادث الشديدة على المحاكي', 'operations', 'continuing', 'operations', 'Part of COIT and COCT', 'جزء من التدريب الأولي والمستمر', null, null, null, null, 'Training on the most risk-significant accident sequences, as REG-17 Art. 5-6 requires.', 'التدريب على تسلسلات الحوادث الأكثر أهمية من حيث المخاطر وفق المادتين 5 و6 من اللائحة 17.', ['fanr-reg17', 'cns10'], null, false],
  ['maint-init', 'MNT-INIT', 'Maintenance initial training', 'التدريب الأولي للصيانة', 'disciplines', 'initial', 'maintenance', '53 weeks / 1,969 h', '53 أسبوعاً / 1,969 ساعة', 53, 1969, 907, 'trainees in initial + continuing, 2024', 'Mechanical, electrical and I&C fundamentals, task qualification and JPMs.', 'أساسيات الميكانيكا والكهرباء والأجهزة والتحكم وتأهيل المهام ومقاييس الأداء.', ['sr2024', 'cns10'], null, false],
  ['rp-init', 'RP-INIT', 'Radiation Protection initial training', 'التدريب الأولي للوقاية من الإشعاع', 'disciplines', 'initial', 'radiation-protection', '36 weeks / 1,056 h', '36 أسبوعاً / 1,056 ساعة', 36, 1056, 111, 'staff in initial + continuing, 2024', 'Surveys, radiation work permits, dosimetry and ALARA.', 'المسوحات وتصاريح العمل الإشعاعي وقياس الجرعات ومبدأ ALARA.', ['sr2024'], null, false],
  ['chem-init', 'CHEM-INIT', 'Chemistry initial training', 'التدريب الأولي للكيمياء', 'disciplines', 'initial', 'chemistry', '28 weeks / 896 h', '28 أسبوعاً / 896 ساعة', 28, 896, 65, 'staff in initial + continuing, 2024', 'Water chemistry, radiochemistry and laboratory proficiency (FANR-REG-16 Art. 9).', 'كيمياء المياه والكيمياء الإشعاعية وكفاءة المختبر (المادة 9 من اللائحة 16).', ['sr2024', 'fanr-reg16'], null, false],
  ['eng-init', 'ENG-INIT', 'Engineering initial training', 'التدريب الهندسي الأولي', 'disciplines', 'initial', 'engineering', '20 weeks / 640 h', '20 أسبوعاً / 640 ساعة', 20, 640, 447, 'engineers in initial + continuing, 2024', 'Plant design basis, configuration management and engineering qualification standards by discipline.', 'أساس تصميم المحطة وإدارة التهيئة ومعايير التأهيل الهندسي حسب التخصص.', ['sr2024'], null, false],
  ['maint-cont', 'MNT-CONT', 'Maintenance continuing training', 'التدريب المستمر للصيانة', 'disciplines', 'continuing', 'maintenance', 'Annual', 'سنوي', null, null, null, null, 'Refreshers driven by plant data, operating experience and benchmarking.', 'تجديد معرفي مدفوع ببيانات المحطة والخبرة التشغيلية والمقارنة المعيارية.', ['cns10'], null, true],
  ['rp-cont', 'RP-CONT', 'Radiation Protection continuing training', 'التدريب المستمر للوقاية من الإشعاع', 'disciplines', 'continuing', 'radiation-protection', 'Annual', 'سنوي', null, null, null, null, 'RP refreshers and instrument updates.', 'تجديد معرفي في الوقاية من الإشعاع وتحديثات الأجهزة.', ['cns10'], null, true],
  ['chem-cont', 'CHEM-CONT', 'Chemistry continuing training', 'التدريب المستمر للكيمياء', 'disciplines', 'continuing', 'chemistry', 'Annual', 'سنوي', null, null, null, null, 'Chemistry refreshers and lab proficiency.', 'تجديد معرفي في الكيمياء وكفاءة المختبر.', ['cns10'], null, true],
  ['eng-cont', 'ENG-CONT', 'Engineering continuing training', 'التدريب الهندسي المستمر', 'disciplines', 'continuing', 'engineering', 'Annual', 'سنوي', null, null, null, null, 'Design changes, OE and licensing-basis updates.', 'تغييرات التصميم والخبرة التشغيلية وتحديثات أساس الترخيص.', ['cns10'], null, true],
  ['apr1400', 'APR1400', 'APR1400 Course', 'دورة APR1400', 'foundation', 'foundation', null, 'Foundation course', 'دورة تأسيسية', null, null, null, null, 'Overview of the APR-1400 design and its systems.', 'نظرة عامة على تصميم APR-1400 وأنظمته.', ['cns10'], null, false],
  ['exec-sim', 'EXEC-SIM', 'Executive Simulator Course', 'دورة المحاكي للتنفيذيين', 'foundation', 'foundation', null, 'Foundation course', 'دورة تأسيسية', null, null, null, null, 'Plant behaviour on the simulator for senior leaders.', 'سلوك المحطة على المحاكي لكبار القادة.', ['cns10'], null, false],
  ['mgmt-cert', 'MCC', 'Management Certification Course', 'دورة اعتماد الإدارة', 'foundation', 'foundation', null, 'Foundation course', 'دورة تأسيسية', null, null, null, null, 'Nuclear management fundamentals for managers.', 'أساسيات الإدارة النووية للمديرين.', ['cns10'], null, false],
  ['asip', 'ASIP', 'Accelerated SRO Instructor Program (ASIP)', 'برنامج مدرب المشغّل الأول المعجل', 'foundation', 'foundation', 'training', 'Foundation course', 'دورة تأسيسية', null, null, null, null, 'Prepares SRO-qualified instructors.', 'يُعدّ المدربين المؤهلين كمشغّلين أوائل.', ['cns10'], null, false],
  ['instr-qual', 'INSTR', 'Instructor Initial and Continuing Qualification', 'التأهيل الأولي والمستمر للمدربين', 'foundation', 'foundation', 'training', 'Initial + continuing', 'أولي ومستمر', null, null, null, null, 'Instructional skills for technical instructors (SAT).', 'مهارات التدريس للمدربين الفنيين (النهج المنهجي للتدريب).', ['cns10'], null, false],
  ['intilaqa', 'INTILAQA', 'INTILAQA first-line leader course', 'انطلاقة: دورة قادة الخط الأول', 'leadership', 'leadership', null, '4 days', '4 أيام', null, null, 285, 'completions, 2024', 'Mandatory course for first-line leaders; ROs and SROs take "Leading Effective Teams".', 'دورة إلزامية لقادة الخط الأول؛ يحضر مشغّلو المفاعل والمشغّلون الأوائل "قيادة فرق فعّالة".', ['cns10', 'sr2024'], null, false],
  ['estadad', 'ESTADAD', 'ESTADAD (high potentials)', 'استعداد (أصحاب الإمكانات العالية)', 'leadership', 'leadership', null, '8 days', '8 أيام', null, null, 62, 'completions, 2024', 'Leadership development for high-potential staff.', 'تطوير القيادة للموظفين ذوي الإمكانات العالية.', ['cns10', 'sr2024'], null, false],
  ['one', 'ONE', 'Onwards to Nuclear Excellence (ONE)', 'نحو التميز النووي', 'leadership', 'leadership', null, '3 weeks', '3 أسابيع', 3, null, 52, 'completions, 2024', 'Leadership programme towards nuclear excellence.', 'برنامج قيادي نحو التميز النووي.', ['cns10', 'sr2024'], null, false],
  ['fas', 'FAS', 'Foundational Alignment Session', 'جلسة المواءمة التأسيسية', 'leadership', 'leadership', null, 'Session', 'جلسة', null, null, 419, 'completions, 2024', 'Aligns leaders on expectations and values.', 'مواءمة القادة حول التوقعات والقيم.', ['cns10'], null, false],
  ['cld', 'CLD', 'Continuous Leadership Development', 'التطوير القيادي المستمر', 'leadership', 'leadership', null, 'Ongoing', 'مستمر', null, null, 326, 'completions, 2024', 'Ongoing leadership development.', 'تطوير قيادي مستمر.', ['cns10'], null, false],
  ['master-classes', 'EMC', 'Executive master classes', 'دروس متقدمة للتنفيذيين', 'leadership', 'leadership', null, 'Sessions', 'جلسات', null, null, 32, 'completions, 2024', 'Master classes for executives, with partners INSEAD, Wharton, London Business School and NQA.', 'دروس متقدمة للتنفيذيين مع شركاء INSEAD وWharton وكلية لندن للأعمال وNQA.', ['cns10'], null, false],
  ['inpo-leadership', 'INPO-LD', 'INPO leadership courses (Atlanta)', 'دورات القيادة لدى INPO (أتلانتا)', 'leadership', 'leadership', null, 'External', 'خارجي', null, null, 19, 'leaders, 2024', 'Industry leadership courses through WANO-AC access to INPO services.', 'دورات قيادية للقطاع عبر وصول WANO-AC إلى خدمات INPO.', ['cns10'], null, false],
  ['exec-coaching', 'COACH', 'Executive coaching', 'التوجيه التنفيذي', 'leadership', 'leadership', null, 'Ongoing', 'مستمر', null, null, 15, 'senior leaders, 2024', 'One-to-one coaching for senior leaders.', 'توجيه فردي لكبار القادة.', ['cns10'], null, false],
  ['ero', 'ERO', 'Emergency response organisation training and drills', 'تدريب منظمة الاستجابة للطوارئ والتمارين', 'emergency', 'continuing', 'emergency-preparedness', 'Periodic drills; 4 ERO drills in 2024', 'تمارين دورية؛ 4 تمارين في 2024', null, null, null, null, 'Everyone with an on-site emergency role is trained and tested (FANR-REG-12 Art. 23).', 'يُدرَّب ويُختبر كل من له دور في الطوارئ في الموقع (المادة 23 من اللائحة 12).', ['fanr-reg12', 'cns10'], null, true],
  ['tahyaa', 'TAHYAA', 'TAHYAA national qualification for emergency workers (FANR)', 'مؤهل تهيأ الوطني للعاملين في الطوارئ (الهيئة)', 'emergency', 'continuing', 'emergency-preparedness', 'National qualification', 'مؤهل وطني', null, null, null, null, 'FANR\'s programme qualifying emergency workers against a UAE national qualification. Kafa\'a links to it.', 'برنامج الهيئة لتأهيل العاملين في الطوارئ وفق مؤهل وطني إماراتي. تربط كفاءة إليه.', ['cns10'], null, false],
  ['stc', 'STC', 'Simulator Training Center (full-scope main control room replicas)', 'مركز التدريب على المحاكاة (نسخ كاملة لغرفة التحكم الرئيسية)', 'simulation', 'continuing', 'operations', 'Facility', 'منشأة', null, null, null, null, 'Full-scope digital simulators, an exact replica of the main control room.', 'محاكيات رقمية كاملة النطاق، نسخة طبق الأصل من غرفة التحكم الرئيسية.', ['enec-opsafety', 'enec-training-facilities'], 'Number of full-scope simulators: 2 at the STC or 4 in total (sources differ).', false],
  ['otc', 'OTC', 'Operator Training Center and immersive training', 'مركز تدريب المشغّلين والتدريب الغامر', 'simulation', 'continuing', 'operations', 'Facility', 'منشأة', null, null, null, null, 'Further simulators and classrooms, the "Orchid IX" 3D plant model and a 3D VR classroom for local operators.', 'محاكيات وفصول إضافية ونموذج "أوركيد IX" ثلاثي الأبعاد للمحطة وفصل واقع افتراضي للمشغّلين المحليين.', ['enec-training-facilities'], null, false],
  ['crucial', 'CC', 'Crucial Conversations', 'المحادثات الحاسمة', 'soft_skills', 'general', null, 'Course', 'دورة', null, null, 54, 'people, 2024', 'Communication skills for high-stakes conversations.', 'مهارات التواصل في المحادثات عالية المخاطر.', ['sr2024'], null, false],
  ['external', 'EXT', 'External courses', 'دورات خارجية', 'soft_skills', 'general', null, '51,675 h in 2024', '51,675 ساعة في 2024', null, 51675, 740, 'people, 2024', 'External courses requested and approved through the catalogue.', 'دورات خارجية تُطلب وتُعتمد عبر الدليل.', ['sr2024'], null, false],
  ['supplier-academy', 'SA', 'Supplier academy (concept)', 'أكاديمية الموردين (مفهوم)', 'supplier', 'supplier', 'supply-chain', 'Short courses', 'دورات قصيرة', null, null, null, null, 'Courses for suppliers on NQA-1, CFSI, commercial-grade dedication, safety culture, ICV, working at Barakah, defect reporting and business continuity. Titles from the NEXUS concept; concept content until ENEC confirms a curriculum.', 'دورات للموردين في NQA-1 والمواد المقلدة واعتماد المواد التجارية وثقافة السلامة والقيمة المحلية المضافة والعمل في براكة والإبلاغ عن العيوب واستمرارية الأعمال. عناوين من مفهوم NEXUS.', ['enec-localisation'], null, false],
  ['adv-fundamentals', 'ADV', 'Advanced reactor fundamentals (learning track)', 'أساسيات المفاعلات المتقدمة (مسار تعليمي)', 'foundation', 'foundation', null, 'Self-paced', 'ذاتي الوتيرة', null, null, null, null, 'Orientation to technology families ENEC is evaluating under ADVANCE. No deployment decision is implied.', 'تعريف بعائلات التقنيات التي تقيّمها ENEC ضمن برنامج ADVANCE. لا يعني ذلك أي قرار نشر.', ['wnn-advance'], null, false],
];

export function buildProgrammes() {
  return P.map(([id, code, name_en, name_ar, area, kind, family_id, duration_en, duration_ar, weeks, hours, population_2024, population_note, purpose_en, purpose_ar, sids, conflict_note, mandatory], i) => ({
    id, code, name_en, name_ar, area, kind, family_id, duration_en, duration_ar, weeks, hours, population_2024, population_note, purpose_en, purpose_ar, sources: srcs(...sids), conflict_note, mandatory, sort: i + 1,
  }));
}

// Courses: [id, programme, code, en, ar, modality, initial, mandatory, audience, competencies, hours, qualifying, public_summary, extra]
const CO = [
  ['c-get', 'get', 'GET-101', 'General Employee Training', 'التدريب العام للموظفين', 'blended', true, true, 'staff', ['hu-01', 'rp-01', 'sa-01'], 16, true, true],
  ['c-onb', 'onboarding', 'ONB-101', 'ENEC onboarding', 'تهيئة الموظفين الجدد', 'classroom', true, true, 'staff', ['sc-01'], 24, false, true],
  ['c-hu', 'hu-core', 'HU-101', 'Human performance core tools', 'الأدوات الأساسية للأداء البشري', 'classroom', true, true, 'staff', ['hu-01', 'hu-02'], 8, true, true],
  ['c-hu-ref', 'hu-core', 'HU-201', 'HU tools refresher', 'تجديد أدوات الأداء البشري', 'elearning', false, true, 'staff', ['hu-01'], 2, false, false],
  ['c-scwe', 'scwe', 'SCWE-101', 'Safety-conscious work environment', 'بيئة العمل الواعية بالسلامة', 'classroom', false, false, 'staff', ['sc-01'], 4, false, true],
  ['c-sec-aw', 'security-awareness', 'SEC-101', 'Security awareness (general)', 'الوعي الأمني (عام)', 'elearning', false, true, 'staff', ['sa-01'], 1, false, false],
  ['c-loit-sys', 'loit', 'LOIT-110', 'LOIT: plant systems', 'التدريب الأولي للمشغّلين المحليين: أنظمة المحطة', 'classroom', true, false, 'staff', ['pf-03', 'pf-02'], 640, false, false],
  ['c-loit-ojt', 'loit', 'LOIT-150', 'LOIT: watch-station OJT and JPMs', 'التدريب الأولي: التدريب أثناء العمل في محطة المراقبة', 'ojt', true, false, 'staff', ['co-01', 'co-02'], 960, true, false],
  ['c-coit-gf', 'coit', 'COIT-110', 'COIT: generic fundamentals', 'التدريب الأولي للمعتمدين: الأساسيات العامة', 'classroom', true, false, 'staff', ['pf-01', 'pf-02'], 480, false, false],
  ['c-coit-sim', 'coit', 'COIT-210', 'COIT: main control room simulator', 'التدريب الأولي للمعتمدين: محاكي غرفة التحكم', 'simulator', true, false, 'staff', ['pf-03', 'co-03', 'ns-02'], 800, true, false],
  ['c-coit-exam', 'coit', 'COIT-290', 'COIT: internal comprehensive exam', 'التدريب الأولي للمعتمدين: الاختبار الداخلي الشامل', 'classroom', true, false, 'staff', ['pf-01', 'pf-03'], 24, true, false],
  ['c-loct', 'loct', 'LOCT-26', 'LOCT 2026 cycle', 'دورة التدريب المستمر للمشغّلين المحليين 2026', 'simulator', false, true, 'staff', ['co-01', 'pf-03'], 240, false, false],
  ['c-coct', 'coct', 'COCT-26', 'COCT 2026 cycle', 'دورة التدريب المستمر للمشغّلين المعتمدين 2026', 'simulator', false, true, 'staff', ['co-03', 'ns-02', 'ld-02'], 240, true, false],
  ['c-sam', 'severe-accident', 'SAM-201', 'Severe-accident scenarios', 'سيناريوهات الحوادث الشديدة', 'simulator', false, false, 'staff', ['ns-01'], 16, false, false],
  ['c-mnt-mech', 'maint-init', 'MNT-110', 'Mechanical maintenance fundamentals', 'أساسيات الصيانة الميكانيكية', 'classroom', true, false, 'staff', ['mp-01'], 320, false, false],
  ['c-mnt-elec', 'maint-init', 'MNT-120', 'Electrical maintenance fundamentals', 'أساسيات الصيانة الكهربائية', 'classroom', true, false, 'staff', ['mp-01', 'mp-02'], 320, false, false],
  ['c-mnt-ic', 'maint-init', 'MNT-130', 'I&C fundamentals', 'أساسيات الأجهزة والتحكم', 'classroom', true, false, 'staff', ['mp-02'], 320, false, false],
  ['c-mnt-ojt', 'maint-init', 'MNT-190', 'Maintenance task qualification (OJT/JPM)', 'تأهيل مهام الصيانة (أثناء العمل / مقاييس الأداء)', 'ojt', true, false, 'staff', ['mp-01', 'mp-02'], 600, true, false],
  ['c-rp-init', 'rp-init', 'RP-110', 'Radiation protection technician initial', 'التدريب الأولي لفني الوقاية من الإشعاع', 'classroom', true, false, 'staff', ['rp-01', 'rp-02'], 520, true, false],
  ['c-chem-init', 'chem-init', 'CHEM-110', 'Chemistry technician initial', 'التدريب الأولي لفني الكيمياء', 'classroom', true, false, 'staff', ['ch-01', 'ch-02'], 440, true, false],
  ['c-eng-init', 'eng-init', 'ENG-110', 'Engineering initial: design basis and configuration', 'التدريب الهندسي الأولي: أساس التصميم والتهيئة', 'classroom', true, false, 'staff', ['en-01', 'en-02'], 320, false, false],
  ['c-mnt-cont', 'maint-cont', 'MNT-CT26', 'Maintenance continuing 2026', 'التدريب المستمر للصيانة 2026', 'classroom', false, true, 'staff', ['mp-01'], 40, false, false],
  ['c-rp-cont', 'rp-cont', 'RP-CT26', 'RP continuing 2026', 'التدريب المستمر للوقاية من الإشعاع 2026', 'classroom', false, true, 'staff', ['rp-02'], 32, false, false],
  ['c-chem-cont', 'chem-cont', 'CHEM-CT26', 'Chemistry continuing 2026', 'التدريب المستمر للكيمياء 2026', 'classroom', false, true, 'staff', ['ch-01'], 32, false, false],
  ['c-eng-cont', 'eng-cont', 'ENG-CT26', 'Engineering continuing 2026', 'التدريب الهندسي المستمر 2026', 'classroom', false, true, 'staff', ['en-01'], 24, false, false],
  ['c-apr', 'apr1400', 'APR-101', 'APR1400 Course', 'دورة APR1400', 'classroom', true, false, 'staff', ['pf-03'], 40, false, true],
  ['c-exec-sim', 'exec-sim', 'EXS-101', 'Executive Simulator Course', 'دورة المحاكي للتنفيذيين', 'simulator', false, false, 'staff', ['ld-02'], 16, false, false],
  ['c-mcc', 'mgmt-cert', 'MCC-101', 'Management Certification Course', 'دورة اعتماد الإدارة', 'classroom', false, false, 'staff', ['ld-01'], 40, false, false],
  ['c-asip', 'asip', 'ASIP-101', 'Accelerated SRO Instructor Program', 'برنامج مدرب المشغّل الأول المعجل', 'blended', true, false, 'staff', ['pf-03', 'co-01'], 160, true, false],
  ['c-instr', 'instr-qual', 'INSTR-101', 'Instructor initial qualification', 'التأهيل الأولي للمدربين', 'blended', true, false, 'staff', ['ld-01'], 80, true, false],
  ['c-intilaqa', 'intilaqa', 'INT-101', 'INTILAQA: Leading Effective Teams', 'انطلاقة: قيادة فرق فعّالة', 'classroom', false, false, 'staff', ['ld-01'], 32, false, true],
  ['c-estadad', 'estadad', 'EST-101', 'ESTADAD', 'استعداد', 'classroom', false, false, 'staff', ['ld-01', 'ld-02'], 64, false, true],
  ['c-one', 'one', 'ONE-101', 'Onwards to Nuclear Excellence', 'نحو التميز النووي', 'blended', false, false, 'staff', ['ld-02', 'sc-02'], 120, false, true],
  ['c-ero', 'ero', 'ERO-101', 'ERO role training and test', 'تدريب دور منظمة الاستجابة للطوارئ واختباره', 'classroom', false, true, 'staff', ['ep-01'], 8, true, false],
  ['c-ero-drill', 'ero', 'ERO-201', 'ERO proficiency drill', 'تمرين كفاءة منظمة الاستجابة للطوارئ', 'drill', false, true, 'staff', ['ep-02'], 4, true, false],
  ['c-fire', 'ero', 'FIRE-101', 'Fire brigade training and drills', 'تدريب فرقة الإطفاء والتمارين', 'drill', false, true, 'staff', ['ep-02'], 16, true, false],
  ['c-crucial', 'crucial', 'CC-101', 'Crucial Conversations', 'المحادثات الحاسمة', 'external', false, false, 'staff', ['ld-01'], 16, false, false],
  ['c-adv-intro', 'adv-fundamentals', 'ADV-101', 'Advanced reactor families: an orientation', 'عائلات المفاعلات المتقدمة: مدخل تعريفي', 'elearning', false, false, 'public', ['pf-01'], 3, false, true],
  ['c-adv-smr', 'adv-fundamentals', 'ADV-110', 'SMRs and microreactors: what changes for operators', 'المفاعلات الصغيرة والمتناهية الصغر: ما الذي يتغير للمشغّلين', 'elearning', false, false, 'staff', ['pf-01', 'pf-03'], 4, false, false],
  ['c-ai-gov', 'cld', 'DA-101', 'Governed use of AI at work', 'الاستخدام المحوكم للذكاء الاصطناعي في العمل', 'elearning', false, false, 'staff', ['da-02'], 2, false, false],
];

// Supplier academy courses (titles and facts from NEXUS eco_courses SA 101-108; concept content)
const SA = [
  ['SA-NQA1-101', 'SA 101', 'NQA-1 for suppliers: the 18 requirements in practice', 'معيار NQA-1 للموردين: المتطلبات الثمانية عشر عملياً', 'blended', 4, 80, 36, 'How ASME NQA-1 quality-assurance requirements land in a supplier\'s shop.', 'كيف تنعكس متطلبات ضمان الجودة وفق ASME NQA-1 على ورشة المورد.', ['qa-01']],
  ['SA-CFSI-102', 'SA 102', 'CFSI: counterfeit, fraudulent and suspect items', 'المواد المقلدة والاحتيالية والمشبوهة', 'elearning', 2.5, 80, 24, 'Recognise, prevent and report counterfeit, fraudulent and suspect items.', 'التعرف على المواد المقلدة والاحتيالية والمشبوهة ومنعها والإبلاغ عنها.', ['qa-02']],
  ['SA-CGD-103', 'SA 103', 'Commercial Grade Dedication: critical characteristics and acceptance', 'اعتماد المواد التجارية: الخصائص الحرجة والقبول', 'classroom', 3, 75, 36, 'How a commercial-grade item is dedicated for nuclear use.', 'كيف تُعتمد مادة تجارية للاستخدام النووي.', ['qa-02']],
  ['SA-SC-104', 'SA 104', 'Nuclear safety culture for suppliers', 'ثقافة السلامة النووية للموردين', 'elearning', 2, 75, 24, 'The 10 traits applied to supplier work.', 'السمات العشر مطبقة على عمل الموردين.', ['sc-01']],
  ['SA-ICV-105', 'SA 105', 'ICV certification and your improvement plan', 'شهادة القيمة المحلية المضافة وخطة التحسين', 'clinic', 2, 70, 12, 'How the National ICV Programme certificate works and how to build an improvement plan.', 'كيف تعمل شهادة البرنامج الوطني للقيمة المحلية المضافة وكيف تُبنى خطة التحسين.', []],
  ['SA-BRK-106', 'SA 106', 'Working with Barakah: nuclear vs. non-nuclear supply', 'العمل مع براكة: التوريد النووي مقابل غير النووي', 'elearning', 1.5, 70, 36, 'General requirements for supplying ENEC.', 'المتطلبات العامة للتوريد إلى ENEC.', []],
  ['SA-DEF-107', 'SA 107', 'Defect and noncompliance reporting', 'الإبلاغ عن العيوب وعدم المطابقة', 'elearning', 1.5, 80, 24, 'When and how a supplier must evaluate and report a defect.', 'متى وكيف يجب على المورد تقييم العيب والإبلاغ عنه.', ['qa-01']],
  ['SA-BCM-108', 'SA 108', 'Supplier business continuity', 'استمرارية أعمال الموردين', 'elearning', 1.25, 70, 24, 'Supplier business continuity expectations.', 'توقعات استمرارية أعمال الموردين.', []],
];

export function buildCourses() {
  const courses = [];
  const modules = [];
  for (const [id, programme_id, code, title_en, title_ar, modality, initial, mandatory, audience, competency_ids, duration_hours, qualifying, public_summary] of CO) {
    courses.push({
      id, programme_id, code, title_en, title_ar, modality, initial, mandatory, audience, competency_ids, duration_hours, qualifying, public_summary,
      objectives: competency_ids.map((c) => ({ competency_id: c, en: `Demonstrate ${c.toUpperCase()} at the level the role requires`, ar: `إظهار ${c.toUpperCase()} بالمستوى الذي يتطلبه الدور` })),
      prerequisites: id.startsWith('c-coit') ? ['c-get', 'c-loit-ojt'] : id === 'c-coct' ? ['c-coit-exam'] : id === 'c-get' ? [] : ['c-get'],
      evaluation_form_id: qualifying ? `form-${id}` : null, owner_role: 'Nuclear Training', summary_en: '', summary_ar: '', sources: [], packaging: modality === 'elearning' ? 'xapi' : 'none',
      pass_mark: qualifying ? 80 : null, validity_months: mandatory ? 24 : null, nexus_course_id: null, concept_content: false,
    });
    const n = modality === 'elearning' ? 3 : 4;
    for (let i = 1; i <= n; i++) modules.push({ id: `${id}-m${i}`, course_id: id, n: i, title_en: `${title_en}: module ${i}`, title_ar: `${title_ar}: الوحدة ${i}`, minutes: Math.round(((duration_hours || 4) * 60) / n), public_summary });
  }
  for (const [nid, code, title_en, title_ar, modality, hours, pass, validity, sum_en, sum_ar, comps] of SA) {
    const id = `c-${nid.toLowerCase()}`;
    courses.push({
      id, programme_id: 'supplier-academy', code, title_en, title_ar, modality, initial: false, mandatory: false, audience: 'supplier', competency_ids: comps,
      objectives: [{ en: sum_en, ar: sum_ar }], prerequisites: [], duration_hours: hours, qualifying: true, evaluation_form_id: null, owner_role: 'Supplier Development (concept)',
      public_summary: true, summary_en: sum_en, summary_ar: sum_ar, sources: srcs('enec-localisation'), packaging: 'xapi', pass_mark: pass, validity_months: validity,
      nexus_course_id: nid, concept_content: true,
    });
    for (let i = 1; i <= 3; i++) modules.push({ id: `${id}-m${i}`, course_id: id, n: i, title_en: `${title_en}: part ${i}`, title_ar: `${title_ar}: الجزء ${i}`, minutes: Math.round((hours * 60) / 3), public_summary: true });
  }
  return { courses, modules };
}

// Role-based mandatory curricula (M04: changing role assigns the new role's curriculum)
export function buildCurriculum() {
  const base = ['c-get', 'c-hu', 'c-sec-aw'];
  const byRole = {
    'local-operator': ['c-loit-sys', 'c-loit-ojt', 'c-loct'],
    'reactor-operator': ['c-coit-gf', 'c-coit-sim', 'c-coit-exam', 'c-coct'],
    'senior-reactor-operator': ['c-coct', 'c-intilaqa', 'c-sam'],
    'shift-supervisor': ['c-coct', 'c-estadad'],
    'maintenance-technician-engineer': ['c-mnt-ojt', 'c-mnt-cont'],
    'radiation-protection-technician': ['c-rp-init', 'c-rp-cont'],
    'chemistry-technician': ['c-chem-init', 'c-chem-cont'],
    'systems-design-plant-engineer': ['c-eng-init', 'c-eng-cont'],
    'emergency-preparedness-coordinator': ['c-ero', 'c-ero-drill'],
    'fire-protection': ['c-fire'],
    'nuclear-training-instructor': ['c-instr', 'c-asip'],
    'operations-support-work-control': ['c-hu-ref'],
  };
  const out = [];
  const roles = ['senior-reactor-operator', 'shift-supervisor', 'reactor-operator', 'local-operator', 'shift-technical-advisor', 'operations-support-work-control', 'outage-manager-planner', 'maintenance-technician-engineer', 'systems-design-plant-engineer', 'reactor-engineer-core-physicist', 'nuclear-fuel-specialist', 'cyber-security-engineer', 'radiation-protection-technician', 'chemistry-technician', 'environmental-monitoring-specialist', 'quality-assurance-qc', 'nuclear-oversight-npi', 'regulatory-affairs-licensing-engineer', 'human-performance-specialist', 'ecp-officer', 'industrial-health-safety-officer', 'fire-protection', 'emergency-preparedness-coordinator', 'security-officer', 'safeguards-specialist', 'nuclear-training-instructor', 'procurement-engineer', 'corporate-professional'];
  for (const r of roles) for (const c of [...base, ...(byRole[r] || [])]) out.push({ id: `cr-${r}-${c}`, role_id: r, course_id: c, mandatory: true, due_within_days: base.includes(c) ? 30 : 180, note: null });
  return out;
}
