/**
 * Training and qualification paths (spec Section 8). Public, sourced content rendered by /learn/paths and /learn/paths/:track.
 * Durations are as published by ENEC for 2024 unless noted; where sources disagree, both values appear.
 * Personal progress is computed from the viewer's own records (pathProgress) and is never shown on public pages.
 * Security track: career-level view only; status is "qualified / not qualified" (spec: no security detail).
 */
export interface L {
  en: string;
  ar: string;
}
export interface PathStage {
  id: string;
  title: L;
  content: L;
  length?: L;
  gate?: L;
  sources: string[];
  /** Courses whose completion is evidence for this stage. */
  courses?: string[];
  /** Qualification standards whose "qualified" status is evidence for this stage. */
  standards?: string[];
  /** Mirrored licence type held at this stage. */
  licence?: 'RO' | 'SRO';
  /** Job roles a person holds while at this stage (puts "you are here" on the timeline). */
  roles?: string[];
  /** Internal links (route paths) for next steps. */
  links?: { to: string; label: L }[];
}
export interface TrainingPath {
  id: string;
  icon: string;
  family: string | null;
  title: L;
  summary: L;
  note?: L;
  careerOnly?: boolean;
  /** Job roles that belong to this track (for "your track"). */
  roles: string[];
  stages: PathStage[];
}

const l = (en: string, ar: string): L => ({ en, ar });

export const TRAINING_PATHS: TrainingPath[] = [
  {
    id: 'licensed-operator', icon: 'shield', family: 'operations', roles: ['local-operator', 'reactor-operator', 'senior-reactor-operator', 'shift-supervisor'],
    title: l('Licensed operator track', 'مسار المشغّل المرخّص'),
    summary: l('From Local Operator to Reactor Operator, Senior Reactor Operator and Shift Supervisor, with FANR certification under FANR-REG-17.', 'من المشغّل المحلي إلى مشغّل المفاعل والمشغّل الأول ومشرف الوردية، مع اعتماد الهيئة الاتحادية للرقابة النووية وفق اللائحة FANR-REG-17.'),
    note: l('FANR certifies operators and ENEC qualifies staff. Kafa\'a mirrors status from those systems and is not an authority.', 'تعتمد الهيئة الاتحادية للرقابة النووية المشغّلين وتؤهّل ENEC موظفيها. تعكس كفاءة الحالة من تلك الأنظمة ولا تُعد جهة اعتماد.'),
    stages: [
      { id: 'entry', title: l('Entry', 'الالتحاق'), content: l('DNT for UAE high-school graduates; LOIT for direct hires; GPO for engineering graduates.', 'دبلوم التكنولوجيا النووية لخريجي الثانوية الإماراتيين؛ التدريب الأولي للمشغّلين المحليين للتعيين المباشر؛ برنامج مشغّلي المحطة الخريجين لخريجي الهندسة.'),
        length: l('DNT 24 months; LOIT 60 weeks / 1,920 h', 'الدبلوم 24 شهراً؛ التدريب الأولي 60 أسبوعاً / 1,920 ساعة'), gate: l('Programme completion; written exams and JPMs', 'إكمال البرنامج؛ اختبارات تحريرية ومقاييس أداء'),
        sources: ['sr2024', 'enec-dnt-launch', 'enec-gpo'], courses: ['c-loit-sys', 'c-loit-ojt'], links: [{ to: '/pathways', label: l('Talent programmes', 'برامج المواهب') }] },
      { id: 'local-operator', title: l('Local Operator', 'المشغّل المحلي'), content: l('Watch-station qualification, rounds, clearances; LOCT each year, including combined scenarios on full-scope simulators linked to a 3D virtual plant.', 'تأهيل محطات المراقبة والجولات والعزل؛ التدريب المستمر سنوياً بما في ذلك سيناريوهات مشتركة على محاكيات كاملة النطاق مرتبطة بمحطة افتراضية ثلاثية الأبعاد.'),
        length: l('36 months as fully qualified LO before RO eligibility; LOCT 5-6 weeks per crew per year', '36 شهراً كمشغّل محلي مؤهل بالكامل قبل أهلية مشغّل المفاعل؛ التدريب المستمر 5-6 أسابيع لكل طاقم سنوياً'), gate: l('Licensee qualification card per watch-station', 'بطاقة تأهيل من المرخَّص له لكل محطة مراقبة'),
        sources: ['sr2024', 'cns10', 'fanr-reg17'], courses: ['c-loct'], standards: ['qs-lo-turbine', 'qs-lo-aux'], roles: ['local-operator'] },
      { id: 'coit', title: l('Certified Operator Initial Training (COIT)', 'التدريب الأولي للمشغّلين المعتمدين'), content: l('Classroom (generic fundamentals, integrated systems, fuel handling, leadership); OJT and task performance evaluations with job qualification cards; main-control-room simulator including severe accidents.', 'دروس صفية (الأساسيات العامة والأنظمة المتكاملة ومناولة الوقود والقيادة)؛ تدريب أثناء العمل وتقييمات أداء المهام ببطاقات التأهيل؛ محاكي غرفة التحكم الرئيسية بما في ذلك الحوادث الشديدة.'),
        length: l('91 weeks / 2,912 h (SR2024) or 82 weeks (CNS report): sources differ', '91 أسبوعاً / 2,912 ساعة (تقرير الاستدامة) أو 82 أسبوعاً (تقرير الاتفاقية): المصادر مختلفة'), gate: l('Internal comprehensive exam: written, JPMs, simulator', 'الاختبار الداخلي الشامل: تحريري ومقاييس أداء ومحاكي'),
        sources: ['sr2024', 'cns10'], courses: ['c-coit-gf', 'c-coit-sim', 'c-coit-exam'] },
      { id: 'fanr-exam', title: l('FANR examination', 'اختبار الهيئة الاتحادية للرقابة النووية'), content: l('Written (generic fundamentals and plant-specific) and operating test (simulator scenarios and in-plant JPMs); the licensee prepares, proctors and grades; FANR reviews.', 'اختبار تحريري (أساسيات عامة وخاصة بالمحطة) واختبار تشغيلي (سيناريوهات محاكي ومقاييس أداء في المحطة)؛ يُعدّه المرخَّص له ويراقبه ويصححه وتراجعه الهيئة.'),
        length: l('FANR notified 60 days before', 'إخطار الهيئة قبل 60 يوماً'), gate: l('FANR certificate, 5 years, Barakah-specific', 'شهادة الهيئة لمدة 5 سنوات خاصة ببراكة'),
        sources: ['fanr-reg17'], links: [{ to: '/licensing', label: l('How RO and SRO certification works', 'كيف يعمل اعتماد مشغّل المفاعل والمشغّل الأول') }] },
      { id: 'reactor-operator', title: l('Reactor Operator', 'مشغّل المفاعل'), content: l('COCT; quarterly shift minimums; annual medical; biennial requalification.', 'التدريب المستمر للمعتمدين؛ الحد الأدنى الفصلي للنوبات؛ فحص طبي سنوي؛ إعادة تأهيل كل سنتين.'),
        length: l('COCT 5-6 weeks per crew per year', 'التدريب المستمر 5-6 أسابيع لكل طاقم سنوياً'), gate: l('Continuing validity', 'استمرار الصلاحية'),
        sources: ['fanr-reg17', 'sr2024'], courses: ['c-coct'], standards: ['qs-ro'], licence: 'RO', roles: ['reactor-operator'] },
      { id: 'sro', title: l('Senior Reactor Operator', 'المشغّل الأول للمفاعل'), content: l('SRO-level COIT content, leadership ("Leading Effective Teams" in INTILAQA), FANR SRO exams.', 'محتوى التدريب الأولي على مستوى المشغّل الأول، والقيادة ("قيادة فرق فعّالة" ضمن انطلاقة)، واختبارات الهيئة للمشغّل الأول.'),
        length: l('After 24 months as RO at Barakah, or graduate route', 'بعد 24 شهراً كمشغّل مفاعل في براكة، أو عبر مسار الخريجين'), gate: l('FANR SRO certificate; at least 2 SRO-role shifts each quarter', 'شهادة المشغّل الأول من الهيئة؛ نوبتان على الأقل بدور المشغّل الأول كل ربع سنة'),
        sources: ['fanr-reg17', 'cns10'], courses: ['c-intilaqa', 'c-sam'], standards: ['qs-sro'], licence: 'SRO', roles: ['senior-reactor-operator'] },
      { id: 'shift-supervisor', title: l('Shift Supervisor and beyond', 'مشرف الوردية وما بعده'), content: l('Command experience, ESTADAD or ONE leadership programmes; possible SRO-qualified instructor via ASIP.', 'خبرة القيادة وبرامج استعداد أو نحو التميز النووي؛ وإمكانية العمل كمدرب مؤهل كمشغّل أول عبر برنامج المدرب المعجل.'),
        length: l('IAEA SSG-75: 4-6 years\' experience', 'دليل الوكالة SSG-75: خبرة 4-6 سنوات'), gate: l('Licensee appointment', 'تعيين من المرخَّص له'),
        sources: ['ssg75', 'cns10'], courses: ['c-estadad', 'c-one'], roles: ['shift-supervisor'] },
    ],
  },
  {
    id: 'maintenance', icon: 'briefcase', family: 'maintenance', roles: ['maintenance-technician-engineer'],
    title: l('Maintenance (mechanical, electrical, I&C)', 'الصيانة (الميكانيكية والكهربائية والأجهزة والتحكم)'),
    summary: l('Initial training of 53 weeks / 1,969 h, task qualification and JPMs for safety-related work, then annual continuing training.', 'تدريب أولي مدته 53 أسبوعاً / 1,969 ساعة، ثم تأهيل المهام ومقاييس الأداء للأعمال المتعلقة بالسلامة، ثم تدريب مستمر سنوي.'),
    stages: [
      { id: 'entry', title: l('Entry routes', 'مسارات الالتحاق'), content: l('DNT (Maintenance Technician), GDP or experienced hire.', 'دبلوم التكنولوجيا النووية (فني صيانة) أو برنامج تطوير الخريجين أو التعيين من ذوي الخبرة.'), sources: ['sr2024', 'enec-talent'], links: [{ to: '/pathways', label: l('Talent programmes', 'برامج المواهب') }] },
      { id: 'initial', title: l('Initial training', 'التدريب الأولي'), content: l('Mechanical, electrical and I&C fundamentals.', 'أساسيات الميكانيكا والكهرباء والأجهزة والتحكم.'), length: l('53 weeks / 1,969 h', '53 أسبوعاً / 1,969 ساعة'), sources: ['sr2024', 'cns10'], courses: ['c-mnt-mech', 'c-mnt-elec', 'c-mnt-ic'] },
      { id: 'qualification', title: l('Qualification gate', 'بوابة التأهيل'), content: l('Task qualification cards; JPMs for safety-related work.', 'بطاقات تأهيل المهام؛ مقاييس الأداء للأعمال المتعلقة بالسلامة.'), gate: l('Task qualification cards and JPMs', 'بطاقات تأهيل المهام ومقاييس الأداء'), sources: ['sr2024', 'cns10'], courses: ['c-mnt-ojt'], roles: ['maintenance-technician-engineer'] },
      { id: 'continuing', title: l('Continuing training', 'التدريب المستمر'), content: l('Refreshers driven by plant data, operating experience and benchmarking. 907 trainees in 2024 (initial and continuing).', 'تجديد معرفي مدفوع ببيانات المحطة والخبرة التشغيلية والمقارنة المعيارية. 907 متدربين في 2024 (أولي ومستمر).'), sources: ['sr2024', 'cns10'], courses: ['c-mnt-cont'] },
    ],
  },
  {
    id: 'radiation-protection', icon: 'shield', family: 'radiation-protection', roles: ['radiation-protection-technician'],
    title: l('Radiation Protection', 'الوقاية من الإشعاع'),
    summary: l('Initial training of 36 weeks / 1,056 h, RP qualification cards with RWP and survey JPMs, then continuing training.', 'تدريب أولي مدته 36 أسبوعاً / 1,056 ساعة، ثم بطاقات تأهيل الوقاية من الإشعاع ومقاييس أداء تصاريح العمل الإشعاعي والمسوحات، ثم تدريب مستمر.'),
    stages: [
      { id: 'entry', title: l('Entry routes', 'مسارات الالتحاق'), content: l('Science graduates, GDP or experienced hire.', 'خريجو العلوم أو برنامج تطوير الخريجين أو التعيين من ذوي الخبرة.'), sources: ['sr2024'] },
      { id: 'initial', title: l('Initial training', 'التدريب الأولي'), content: l('Surveys, radiation work permits, dosimetry and ALARA.', 'المسوحات وتصاريح العمل الإشعاعي وقياس الجرعات ومبدأ ALARA.'), length: l('36 weeks / 1,056 h', '36 أسبوعاً / 1,056 ساعة'), sources: ['sr2024'], courses: ['c-rp-init'] },
      { id: 'qualification', title: l('Qualification gate', 'بوابة التأهيل'), content: l('RP qualification cards; RWP and survey JPMs.', 'بطاقات تأهيل الوقاية من الإشعاع؛ مقاييس أداء تصاريح العمل الإشعاعي والمسوحات.'), gate: l('RP qualification card', 'بطاقة تأهيل الوقاية من الإشعاع'), sources: ['sr2024', 'cns10'], standards: ['qs-rp'], roles: ['radiation-protection-technician'] },
      { id: 'continuing', title: l('Continuing training', 'التدريب المستمر'), content: l('RP refreshers and instrument updates. 111 staff in 2024 (initial and continuing).', 'تجديد معرفي وتحديثات الأجهزة. 111 موظفاً في 2024 (أولي ومستمر).'), sources: ['sr2024', 'cns10'], courses: ['c-rp-cont'] },
    ],
  },
  {
    id: 'chemistry', icon: 'sparkle', family: 'chemistry', roles: ['chemistry-technician'],
    title: l('Chemistry', 'الكيمياء'),
    summary: l('Initial training of 28 weeks / 896 h under FANR-REG-16 Art. 9, chemistry qualification cards and laboratory proficiency.', 'تدريب أولي مدته 28 أسبوعاً / 896 ساعة وفق المادة 9 من اللائحة FANR-REG-16، ثم بطاقات تأهيل الكيمياء وكفاءة المختبر.'),
    stages: [
      { id: 'entry', title: l('Entry routes', 'مسارات الالتحاق'), content: l('Chemistry graduates or GDP.', 'خريجو الكيمياء أو برنامج تطوير الخريجين.'), sources: ['sr2024'] },
      { id: 'initial', title: l('Initial training', 'التدريب الأولي'), content: l('Water chemistry, radiochemistry and laboratory proficiency.', 'كيمياء المياه والكيمياء الإشعاعية وكفاءة المختبر.'), length: l('28 weeks / 896 h', '28 أسبوعاً / 896 ساعة'), sources: ['sr2024', 'fanr-reg16'], courses: ['c-chem-init'] },
      { id: 'qualification', title: l('Qualification gate', 'بوابة التأهيل'), content: l('Chemistry qualification cards; lab proficiency.', 'بطاقات تأهيل الكيمياء؛ كفاءة المختبر.'), gate: l('Chemistry qualification card', 'بطاقة تأهيل الكيمياء'), sources: ['sr2024', 'cns10'], standards: ['qs-chem'], roles: ['chemistry-technician'] },
      { id: 'continuing', title: l('Continuing training', 'التدريب المستمر'), content: l('Chemistry refreshers and lab proficiency. 65 staff in 2024 (initial and continuing).', 'تجديد معرفي في الكيمياء وكفاءة المختبر. 65 موظفاً في 2024 (أولي ومستمر).'), sources: ['sr2024', 'cns10'], courses: ['c-chem-cont'] },
    ],
  },
  {
    id: 'engineering', icon: 'chart', family: 'engineering', roles: ['systems-design-plant-engineer', 'reactor-engineer-core-physicist', 'shift-technical-advisor'],
    title: l('Engineering', 'الهندسة'),
    summary: l('Initial training of 20 weeks / 640 h, engineering qualification standards by discipline, then continuing training.', 'تدريب أولي مدته 20 أسبوعاً / 640 ساعة، ثم معايير التأهيل الهندسي حسب التخصص، ثم تدريب مستمر.'),
    stages: [
      { id: 'entry', title: l('Entry routes', 'مسارات الالتحاق'), content: l('Energy Pioneers, GDP, KU MSc or experienced hire.', 'رواد الطاقة أو برنامج تطوير الخريجين أو ماجستير جامعة خليفة أو التعيين من ذوي الخبرة.'), sources: ['sr2024', 'enec-talent', 'ku-msc'], links: [{ to: '/pathways', label: l('Talent programmes', 'برامج المواهب') }] },
      { id: 'initial', title: l('Initial training', 'التدريب الأولي'), content: l('Plant design basis, configuration management and engineering qualification standards by discipline.', 'أساس تصميم المحطة وإدارة التهيئة ومعايير التأهيل الهندسي حسب التخصص.'), length: l('20 weeks / 640 h', '20 أسبوعاً / 640 ساعة'), sources: ['sr2024'], courses: ['c-eng-init'] },
      { id: 'qualification', title: l('Qualification gate', 'بوابة التأهيل'), content: l('Engineering qualification standards by discipline.', 'معايير التأهيل الهندسي حسب التخصص.'), gate: l('Engineering qualification standard', 'معيار التأهيل الهندسي'), sources: ['sr2024', 'cns10'], standards: ['qs-eng'], roles: ['systems-design-plant-engineer', 'reactor-engineer-core-physicist'] },
      { id: 'continuing', title: l('Continuing training', 'التدريب المستمر'), content: l('Design changes, operating experience and licensing-basis updates. 447 engineers in 2024 (initial and continuing).', 'تغييرات التصميم والخبرة التشغيلية وتحديثات أساس الترخيص. 447 مهندساً في 2024 (أولي ومستمر).'), sources: ['sr2024', 'cns10'], courses: ['c-eng-cont'] },
    ],
  },
  {
    id: 'all-staff', icon: 'users', family: null, roles: [],
    title: l('All staff', 'جميع الموظفين'),
    summary: l('General Employee Training, onboarding and human performance core tools: site access prerequisites for everyone.', 'التدريب العام للموظفين والتهيئة والأدوات الأساسية للأداء البشري: متطلبات دخول الموقع للجميع.'),
    stages: [
      { id: 'onboarding', title: l('Onboarding', 'التهيئة'), content: l('Welcome to ENEC: values, safety culture and ways of working.', 'مرحباً بك في ENEC: القيم وثقافة السلامة وأساليب العمل.'), length: l('3 days', '3 أيام'), sources: ['sr2024'], courses: ['c-onb'] },
      { id: 'get', title: l('General Employee Training', 'التدريب العام للموظفين'), content: l('Plant access fundamentals for everyone working at Barakah. 1,090 people in GET in 2024.', 'أساسيات دخول المحطة لكل من يعمل في براكة. 1,090 شخصاً في التدريب العام في 2024.'), gate: l('Site access prerequisite', 'متطلب دخول الموقع'), sources: ['sr2024', 'cns10'], courses: ['c-get'], standards: ['qs-get'] },
      { id: 'hu', title: l('Human performance core tools', 'الأدوات الأساسية للأداء البشري'), content: l('Self-checking, peer checking, three-way communication, procedure use and pre-job briefs.', 'التحقق الذاتي والتحقق من الزميل والاتصال الثلاثي واستخدام الإجراءات وإحاطات ما قبل العمل.'), sources: ['cns10'], courses: ['c-hu', 'c-sec-aw'] },
    ],
  },
  {
    id: 'emergency-preparedness', icon: 'alert', family: 'emergency-preparedness', roles: ['emergency-preparedness-coordinator', 'fire-protection'],
    title: l('Emergency preparedness', 'التأهب للطوارئ'),
    summary: l('Everyone with an on-site emergency role is trained and tested, takes part in drills and exercises, and can qualify through FANR\'s TAHYAA programme.', 'يُدرَّب ويُختبر كل من له دور في الطوارئ في الموقع، ويشارك في التمارين، ويمكنه التأهل عبر برنامج تهيأ التابع للهيئة.'),
    note: l('Kafa\'a records drill participation and role qualification. Scenarios, plans and facility details stay in ENEC\'s emergency preparedness systems.', 'تسجل كفاءة المشاركة في التمارين وتأهيل الأدوار فقط. تبقى السيناريوهات والخطط وتفاصيل المرافق في أنظمة التأهب للطوارئ لدى ENEC.'),
    stages: [
      { id: 'role-training', title: l('Role training', 'التدريب على الدور'), content: l('Everyone with an on-site emergency role is trained and tested.', 'يُدرَّب ويُختبر كل من له دور في الطوارئ في الموقع.'), gate: l('FANR-REG-12 Art. 23', 'المادة 23 من اللائحة FANR-REG-12'), sources: ['fanr-reg12'], courses: ['c-ero'], standards: ['qs-ero'], roles: ['emergency-preparedness-coordinator'] },
      { id: 'drills', title: l('Drills', 'التمارين'), content: l('Periodic drills: 4 ERO drills in 2024, 6 proficiency drills in 2022.', 'تمارين دورية: 4 تمارين لمنظمة الاستجابة للطوارئ في 2024، و6 تمارين كفاءة في 2022.'), sources: ['fanr-reg12', 'cns10'], courses: ['c-ero-drill', 'c-fire'] },
      { id: 'exercises', title: l('Exercises', 'التمارين الشاملة'), content: l('Broad on- and off-site exercises at least once every two years; all response organisations involved over an 8-year cycle.', 'تمارين شاملة داخل الموقع وخارجه مرة كل سنتين على الأقل؛ وتشارك جميع جهات الاستجابة خلال دورة مدتها 8 سنوات.'), sources: ['fanr-reg12'] },
      { id: 'national', title: l('National exercises', 'التمارين الوطنية'), content: l('UAE Barakah Exercise 2023 (36 hours, 21 federal and 19 local entities); ADCMC exercise on 7 Oct 2025 (22 entities, 7 field teams, 20 operation centres).', 'تمرين براكة الإماراتي 2023 (36 ساعة، 21 جهة اتحادية و19 جهة محلية)؛ تمرين مركز إدارة الطوارئ والأزمات في أبوظبي في 7 أكتوبر 2025 (22 جهة، 7 فرق ميدانية، 20 مركز عمليات).'), sources: ['admo-exercise-2023', 'admo-adcmc-2025'] },
      { id: 'tahyaa', title: l('National qualification (TAHYAA)', 'المؤهل الوطني (تهيأ)'), content: l('FANR\'s TAHYAA programme qualifies emergency workers against a UAE national qualification.', 'يؤهّل برنامج تهيأ التابع للهيئة العاملين في الطوارئ وفق مؤهل وطني إماراتي.'), sources: ['cns10'] },
    ],
  },
  {
    id: 'security', icon: 'lock', family: 'security', roles: ['security-officer'], careerOnly: true,
    title: l('Security (career view only)', 'الأمن (عرض المسار المهني فقط)'),
    summary: l('Security roles require a trustworthiness and reliability programme, fitness for duty with drug and alcohol testing, and UAE security clearance (FANR-REG-08 V2, which also adds cyber security).', 'تتطلب الأدوار الأمنية برنامج الموثوقية والجدارة بالثقة، واللياقة للعمل مع فحص المخدرات والكحول، والتصريح الأمني الإماراتي (اللائحة FANR-REG-08 الإصدار 2، التي تضيف الأمن السيبراني أيضاً).'),
    note: l('Security training content, post orders and physical protection details never enter Kafa\'a. Qualification status for security staff is mirrored as "qualified / not qualified" only.', 'لا يدخل محتوى التدريب الأمني وأوامر المواقع وتفاصيل الحماية المادية إلى كفاءة أبداً. تُعرض حالة تأهيل موظفي الأمن كـ"مؤهل / غير مؤهل" فقط.'),
    stages: [
      { id: 'requirements', title: l('Career requirements', 'متطلبات المسار'), content: l('Trustworthiness and reliability programme; fitness for duty including drug and alcohol testing; UAE security clearance.', 'برنامج الموثوقية والجدارة بالثقة؛ اللياقة للعمل بما في ذلك فحص المخدرات والكحول؛ التصريح الأمني الإماراتي.'), gate: l('FANR-REG-08 V2', 'اللائحة FANR-REG-08 الإصدار 2'), sources: ['cns10', 'enec-nuclear-regulation'] },
      { id: 'awareness', title: l('Security awareness for all staff', 'الوعي الأمني لجميع الموظفين'), content: l('General awareness only; no security arrangements are described.', 'وعي عام فقط؛ لا تُوصف أي ترتيبات أمنية.'), sources: ['cns10'], courses: ['c-sec-aw'] },
      { id: 'qualification', title: l('Role qualification', 'تأهيل الدور'), content: l('Held in ENEC\'s systems; Kafa\'a shows qualified or not qualified only.', 'يُحفظ في أنظمة ENEC؛ تعرض كفاءة "مؤهل" أو "غير مؤهل" فقط.'), sources: ['cns10'], standards: ['qs-sec'], roles: ['security-officer'] },
    ],
  },
  {
    id: 'supplier', icon: 'briefcase', family: 'supply-chain', roles: [],
    title: l('Supplier and contractor track', 'مسار الموردين والمقاولين'),
    summary: l('From orientation and quality standards to safety culture, ICV and the hand-off to ENEC supplier registration. Contractor staff need the same qualifications as ENEC staff.', 'من التعريف ومعايير الجودة إلى ثقافة السلامة والقيمة المحلية المضافة والتسليم إلى تسجيل موردي ENEC. يحتاج موظفو المقاولين إلى المؤهلات نفسها التي يحتاجها موظفو ENEC.'),
    note: l('Supplier academy course titles come from the NEXUS concept; the content is concept content until ENEC confirms a curriculum.', 'عناوين دورات أكاديمية الموردين مأخوذة من مفهوم NEXUS؛ والمحتوى مفاهيمي حتى تعتمد ENEC منهجاً.'),
    stages: [
      { id: 'orientation', title: l('Orientation', 'التعريف'), content: l('How Barakah procurement works; localisation opportunities; the OSPS Localization Plan.', 'كيف تعمل مشتريات براكة؛ فرص التوطين؛ خطة توطين خدمات دعم التشغيل.'), gate: l('Supplier understands fit', 'فهم المورد لمدى ملاءمته'), sources: ['enec-localisation'], courses: ['c-sa-brk-106'] },
      { id: 'quality', title: l('Quality standards', 'معايير الجودة'), content: l('ASME and NQA-1 expectations, commercial-grade dedication, counterfeit and suspect items.', 'توقعات ASME وNQA-1، واعتماد المواد التجارية، والمواد المقلدة والمشبوهة.'), gate: l('Supplier academy certificates', 'شهادات أكاديمية الموردين'), sources: ['enec-localisation'], courses: ['c-sa-nqa1-101', 'c-sa-cfsi-102', 'c-sa-cgd-103'] },
      { id: 'safety-culture', title: l('Safety culture for suppliers', 'ثقافة السلامة للموردين'), content: l('The 10 traits applied to supplier work; defect reporting.', 'السمات العشر مطبقة على عمل الموردين؛ الإبلاغ عن العيوب.'), gate: l('Certificate', 'شهادة'), sources: ['enec-safety-culture'], courses: ['c-sa-sc-104', 'c-sa-def-107'] },
      { id: 'icv', title: l('ICV', 'القيمة المحلية المضافة'), content: l('MoIAT ICV programme; improvement plan.', 'برنامج القيمة المحلية المضافة لوزارة الصناعة والتكنولوجيا المتقدمة؛ خطة التحسين.'), gate: l('ICV plan on file', 'خطة القيمة المحلية المضافة في الملف'), sources: ['enec-icv'], courses: ['c-sa-icv-105'], links: [{ to: '/partner/icv', label: l('ICV plan', 'خطة القيمة المحلية المضافة') }] },
      { id: 'handoff', title: l('Hand-off', 'التسليم'), content: l('Readiness summary to ENEC supplier registration (NEXUS partner lens in the concept).', 'ملخص الجاهزية إلى تسجيل موردي ENEC (عدسة الشركاء في NEXUS ضمن المفهوم).'), gate: l('Registration starts in the procurement system', 'يبدأ التسجيل في نظام المشتريات'), sources: ['enec-localisation'], links: [{ to: '/partner/onboarding', label: l('Supplier onboarding', 'تأهيل الموردين') }] },
      { id: 'contractor-staff', title: l('Contractor staff', 'موظفو المقاولين'), content: l('Same qualifications as ENEC staff, through ENEC training or equivalency.', 'المؤهلات نفسها التي يحتاجها موظفو ENEC، عبر تدريب ENEC أو المعادلة.'), gate: l('Equivalency decision per person and standard', 'قرار معادلة لكل شخص ومعيار'), sources: ['cns10'], links: [{ to: '/partner/workforce', label: l('Contractor equivalency', 'معادلة المقاولين') }] },
    ],
  },
  {
    id: 'graduate', icon: 'grad', family: null, roles: [],
    title: l('Graduate and Pioneer track', 'مسار الخريجين والرواد'),
    summary: l('From school outreach and university scholarships to graduate programmes, early-career qualification and leadership development.', 'من التواصل مع المدارس والمنح الجامعية إلى برامج الخريجين والتأهيل في بداية المسار المهني وتطوير القيادة.'),
    stages: [
      { id: 'school', title: l('School', 'المدرسة'), content: l('Mustaqbali (2 weeks), student booklets, science festivals. Recognition badges are allowed here.', 'برنامج مستقبلي (أسبوعان)، وكتيبات الطلاب، والمهرجانات العلمية. يُسمح بشارات التقدير هنا.'), length: l('Mustaqbali: 2 weeks', 'مستقبلي: أسبوعان'), sources: ['enec-talent', 'enec-students'], links: [{ to: '/learn/practice', label: l('Practice quizzes', 'اختبارات تدريبية') }] },
      { id: 'university', title: l('University', 'الجامعة'), content: l('Energy Pioneers scholarship; internships; KU BSc minor and MSc. Scholarship partners include KU and US and Korean universities.', 'منحة رواد الطاقة؛ التدريب الصيفي؛ التخصص الفرعي والماجستير في جامعة خليفة. يشمل شركاء المنح جامعة خليفة وجامعات أمريكية وكورية.'), sources: ['enec-talent', 'ku-msc'], links: [{ to: '/pathways', label: l('Talent programmes', 'برامج المواهب') }] },
      { id: 'graduate', title: l('Graduate', 'الخريج'), content: l('GDP for graduates; GPO for engineers. GPO leads to SRO training after three years as LO.', 'برنامج تطوير الخريجين؛ برنامج مشغّلي المحطة الخريجين للمهندسين. يقود البرنامج إلى تدريب المشغّل الأول بعد ثلاث سنوات كمشغّل محلي.'), length: l('GDP 18-36 months, or 12-30 per the GPO release: sources differ', 'برنامج تطوير الخريجين 18-36 شهراً، أو 12-30 وفق إعلان البرنامج: المصادر مختلفة'), sources: ['enec-talent', 'enec-gpo', 'cns10'] },
      { id: 'early-career', title: l('Early career', 'بداية المسار المهني'), content: l('Discipline initial training; INTILAQA for first-line leaders. Qualification cards begin.', 'التدريب الأولي في التخصص؛ انطلاقة لقادة الخط الأول. تبدأ بطاقات التأهيل.'), sources: ['cns10', 'sr2024'], courses: ['c-intilaqa'] },
      { id: 'leadership', title: l('Leadership', 'القيادة'), content: l('ESTADAD (8 days), ONE (3 weeks), executive master classes, INPO leadership courses in Atlanta (19 leaders in 2024), executive coaching. Partners INSEAD, Wharton, LBS, NQA.', 'استعداد (8 أيام)، نحو التميز النووي (3 أسابيع)، دروس متقدمة للتنفيذيين، دورات القيادة لدى INPO في أتلانتا (19 قائداً في 2024)، والتوجيه التنفيذي. الشركاء: INSEAD وWharton وكلية لندن للأعمال وNQA.'), sources: ['cns10', 'sr2024'], courses: ['c-estadad', 'c-one'] },
    ],
  },
];

export const PATH_BY_ID: Record<string, TrainingPath> = Object.fromEntries(TRAINING_PATHS.map((p) => [p.id, p]));

// ───────────── personal progress (pure; tested in tests/unit/m04-paths.test.ts)
export interface PathEvidence {
  roleId: string | null;
  completedCourses: Set<string>;
  activeCourses: Set<string>;
  qualifiedStandards: Set<string>;
  activeStandards: Set<string>;
  licences: Set<string>;
}
export type StageState = 'done' | 'current' | 'upcoming';
export interface StageProgress {
  id: string;
  state: StageState;
  here: boolean;
  coursesDone: number;
  coursesTotal: number;
}
export function pathProgress(path: TrainingPath, ev: PathEvidence): { stages: StageProgress[]; pct: number; onTrack: boolean } {
  const hereIdx = ev.roleId ? path.stages.findIndex((s) => s.roles?.includes(ev.roleId!)) : -1;
  const raw = path.stages.map((s, i) => {
    const courses = s.courses ?? [];
    const coursesDone = courses.filter((c) => ev.completedCourses.has(c)).length;
    const evidence = courses.length > 0 || (s.standards?.length ?? 0) > 0 || !!s.licence;
    const doneByEvidence =
      (!!s.licence && ev.licences.has(s.licence)) ||
      (s.standards ?? []).some((x) => ev.qualifiedStandards.has(x)) ||
      (courses.length > 0 && coursesDone === courses.length && !(s.standards?.length));
    const doneByPosition = hereIdx >= 0 && i < hereIdx;
    const active = courses.some((c) => ev.activeCourses.has(c) || ev.completedCourses.has(c)) || (s.standards ?? []).some((x) => ev.activeStandards.has(x)) || i === hereIdx;
    return { id: s.id, done: doneByPosition || (evidence && doneByEvidence), active, here: i === hereIdx, coursesDone, coursesTotal: courses.length };
  });
  // current = the first stage that is not done; later stages are upcoming
  const firstOpen = raw.findIndex((r) => !r.done);
  const stages: StageProgress[] = raw.map((r, i) => ({ id: r.id, here: r.here, coursesDone: r.coursesDone, coursesTotal: r.coursesTotal, state: r.done ? 'done' : i === firstOpen ? 'current' : 'upcoming' }));
  const pct = Math.round((raw.filter((r) => r.done).length * 100) / Math.max(1, raw.length));
  const onTrack = hereIdx >= 0 || raw.some((r) => r.active || r.done);
  return { stages, pct, onTrack };
}

/** The track a job role belongs to (first match), for "your track". */
export function trackForRole(roleId: string | null | undefined): TrainingPath | null {
  if (!roleId) return null;
  return TRAINING_PATHS.find((p) => p.roles.includes(roleId)) ?? null;
}
