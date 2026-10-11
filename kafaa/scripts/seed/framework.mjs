// M01 + M02 reference seed: job families, 28 roles, responsibilities, competencies, career paths.
// Facts follow KAFAA-SPEC-001 Section 7 (FANR-REG-17, FANR-REG-16, IAEA SSG-75, SR2024, CNS report).
import { srcs } from './sources.mjs';

export const FAMILIES = [
  ['operations', 'Operations', 'العمليات', 'Running the units safely from the main control room and the plant, around the clock.', 'تشغيل الوحدات بأمان من غرفة التحكم الرئيسية وفي أنحاء المحطة على مدار الساعة.', 'operations'],
  ['maintenance', 'Maintenance', 'الصيانة', 'Mechanical, electrical and instrumentation and control maintenance, in operation and during outages.', 'الصيانة الميكانيكية والكهربائية والأجهزة والتحكم أثناء التشغيل وفترات الإيقاف.', 'maintenance_engineering'],
  ['engineering', 'Engineering', 'الهندسة', 'System health, design authority, modifications, reactor engineering and ageing management.', 'سلامة الأنظمة وسلطة التصميم والتعديلات وهندسة المفاعل وإدارة التقادم.', 'maintenance_engineering'],
  ['radiation-protection', 'Radiation Protection', 'الوقاية من الإشعاع', 'Keeping doses as low as reasonably achievable for workers and the public.', 'إبقاء الجرعات الإشعاعية عند أدنى مستوى ممكن عملياً للعاملين والجمهور.', 'rp_chem_env'],
  ['chemistry', 'Chemistry', 'الكيمياء', 'Primary and secondary water chemistry, radiochemistry and effluent monitoring.', 'كيمياء المياه في الدائرتين الأولية والثانوية والكيمياء الإشعاعية ورصد المخلفات السائلة.', 'rp_chem_env'],
  ['nuclear-fuel', 'Nuclear Fuel', 'الوقود النووي', 'Fuel procurement, receipt, refuelling and spent-fuel management.', 'شراء الوقود واستلامه وإعادة التزويد بالوقود وإدارة الوقود المستهلك.', 'maintenance_engineering'],
  ['outage', 'Outage & Work Management', 'إدارة فترات الإيقاف والأعمال', 'Planning and scheduling refuelling outages and daily plant work.', 'تخطيط وجدولة فترات إيقاف إعادة التزويد بالوقود والأعمال اليومية في المحطة.', 'operations'],
  ['emergency-preparedness', 'Emergency Preparedness', 'التأهب للطوارئ', 'On-site emergency plans, facilities, drills and exercises.', 'خطط الطوارئ في الموقع ومرافقها والتدريبات والتمارين.', 'ep_security_safeguards'],
  ['security', 'Security', 'الأمن', 'Physical protection and access authorisation. Kafa\'a shows the career path only.', 'الحماية المادية وتصاريح الدخول. تعرض كفاءة المسار المهني فقط.', 'ep_security_safeguards'],
  ['cyber', 'Cyber & IT/OT', 'الأمن السيبراني وتقنية المعلومات والتشغيل', 'Protecting digital systems and plant networks; enterprise IT.', 'حماية الأنظمة الرقمية وشبكات المحطة وتقنية المعلومات المؤسسية.', 'ep_security_safeguards'],
  ['safeguards', 'Safeguards', 'الضمانات', 'Nuclear material accountancy and support to IAEA safeguards.', 'محاسبة المواد النووية ودعم ضمانات الوكالة الدولية للطاقة الذرية.', 'ep_security_safeguards'],
  ['quality', 'Quality', 'الجودة', 'Quality assurance, quality control, inspection and supplier audits.', 'ضمان الجودة ومراقبتها والتفتيش وتدقيق الموردين.', 'safety_quality_oversight'],
  ['oversight', 'Nuclear Oversight', 'الرقابة النووية', 'Independent oversight, performance improvement, human performance and the Employee Concerns Program.', 'الرقابة المستقلة وتحسين الأداء والأداء البشري وبرنامج مخاوف الموظفين.', 'safety_quality_oversight'],
  ['licensing', 'Licensing', 'الترخيص', 'Licensing basis, regulatory correspondence and periodic safety review.', 'أساس الترخيص والمراسلات التنظيمية والمراجعة الدورية للسلامة.', 'safety_quality_oversight'],
  ['training', 'Nuclear Training', 'التدريب النووي', 'Systematic Approach to Training: programmes, simulators and examinations.', 'النهج المنهجي للتدريب: البرامج وأجهزة المحاكاة والاختبارات.', 'training_supply_corporate'],
  ['health-safety', 'Health & Safety', 'الصحة والسلامة', 'Industrial health and safety management system.', 'نظام إدارة الصحة والسلامة المهنية.', 'safety_quality_oversight'],
  ['environment', 'Environment', 'البيئة', 'Environmental and radiological environmental monitoring.', 'الرصد البيئي والرصد الإشعاعي البيئي.', 'rp_chem_env'],
  ['supply-chain', 'Supply Chain', 'سلسلة الإمداد', 'Safety-related procurement, commercial-grade dedication and supplier development.', 'المشتريات المتعلقة بالسلامة واعتماد المواد التجارية وتطوير الموردين.', 'training_supply_corporate'],
  ['fire-protection', 'Fire Protection', 'الحماية من الحرائق', 'Fire brigade and the fire-protection programme.', 'فرقة الإطفاء وبرنامج الحماية من الحرائق.', 'safety_quality_oversight'],
  ['corporate', 'Corporate', 'الخدمات المؤسسية', 'HR, finance, legal, communications and stakeholder engagement.', 'الموارد البشرية والمالية والشؤون القانونية والاتصال وإشراك أصحاب المصلحة.', 'training_supply_corporate'],
].map(([id, name_en, name_ar, description_en, description_ar, grp], i) => ({ id, name_en, name_ar, description_en, description_ar, sort: i + 1, grp }));

const R17 = 'https://www.fanr.gov.ae/en/Documents/FANR-REG17%20V.1%20EN%20-%20BOM%20Version%20Certified.PDF';

// [id, family, title_en, title_ar, function_en, function_ar, level, regulated, regRef, basis, basisNote, education, entry, critical, sec, srcIds,
//  summary_en, summary_ar, quals_en, quals_ar, path_en, path_ar, body_en, body_ar, resp[[en,ar]...] ]
const R = [
  ['senior-reactor-operator', 'operations', 'Senior Reactor Operator (SRO), incl. unit supervisor', 'مشغّل مفاعل أول (بما في ذلك مشرف الوحدة)', 'Operations', 'العمليات', 'senior', true, 'FANR-REG-17 Art. 4, 8, 10, 11', 'barakah', null, 'high_school', false, true, false, ['fanr-reg17', 'cns10', 'sr2024'],
    'Directs Reactor Operators and Local Operators in the main control room and holds command and control of the unit.',
    'يوجّه مشغّلي المفاعل والمشغّلين المحليين في غرفة التحكم الرئيسية ويتولى القيادة والسيطرة على الوحدة.',
    'REG-17 Art. 4: 24 months as RO at Barakah, or a BSc plus 24 months at Barakah including 12 as LO, plus UAE security clearance. Annual medical; at least 2 SRO-role shifts per quarter.',
    'المادة 4 من اللائحة 17: 24 شهراً كمشغّل مفاعل في براكة، أو بكالوريوس مع 24 شهراً في براكة منها 12 شهراً كمشغّل محلي، إضافة إلى تصريح أمني إماراتي. فحص طبي سنوي ونوبتان على الأقل بدور مشغّل أول في كل ربع سنة.',
    'COIT, internal comprehensive exam, FANR written and operating exams; COCT every year; biennial requalification.',
    'التدريب الأولي للمشغّلين المعتمدين، والاختبار الداخلي الشامل، واختبارات الهيئة الكتابية والتشغيلية؛ التدريب المستمر سنوياً؛ إعادة التأهيل كل سنتين.',
    'FANR certificate, valid 5 years, plant-specific', 'شهادة من الهيئة الاتحادية للرقابة النووية صالحة لخمس سنوات وخاصة بالمحطة',
    [['Directs ROs and LOs in the main control room', 'توجيه مشغّلي المفاعل والمشغّلين المحليين في غرفة التحكم الرئيسية'], ['Command and control of the unit on shift', 'القيادة والسيطرة على الوحدة أثناء النوبة'], ['Technical specification compliance', 'الالتزام بالمواصفات الفنية'], ['May manipulate reactivity controls', 'يجوز له تشغيل أدوات التحكم في التفاعلية']]],
  ['shift-supervisor', 'operations', 'Shift Supervisor / Shift Manager', 'مشرف / مدير الوردية', 'Operations', 'العمليات', 'leadership', true, 'FANR-REG-17 (holds SRO certificate)', 'uncertain', 'Barakah title and structure unconfirmed; follows IAEA SSG-75.', 'high_school', false, true, false, ['ssg75', 'fanr-reg17'],
    'Holds overall shift authority for the units and acts as emergency director until the emergency organisation activates.',
    'يتولى السلطة الكاملة على الوردية في الوحدات ويعمل مديراً للطوارئ إلى أن تُفعَّل منظمة الطوارئ.',
    'Normally SRO-certified. IAEA SSG-75: 4-6 years\' experience, 2-3 at an operating plant, at least 1 year on site.',
    'يحمل عادةً شهادة مشغّل مفاعل أول. وفق دليل الوكالة SSG-75: خبرة من 4 إلى 6 سنوات، منها سنتان إلى ثلاث في محطة عاملة، وسنة على الأقل في الموقع.',
    'Command experience as SRO; leadership programmes such as ESTADAD or ONE; licensee appointment.',
    'خبرة قيادية كمشغّل أول؛ برامج قيادية مثل استعداد أو "نحو التميز النووي"؛ تعيين من المرخَّص له.',
    'FANR (SRO certificate) and licensee appointment', 'الهيئة الاتحادية للرقابة النووية (شهادة مشغّل أول) وتعيين من المرخَّص له',
    [['Overall shift authority for the units', 'السلطة الكاملة على الوردية في الوحدات'], ['Emergency director until the emergency organisation activates', 'مدير الطوارئ إلى حين تفعيل منظمة الطوارئ'], ['Conservative decision-making', 'اتخاذ قرارات متحفظة']]],
  ['reactor-operator', 'operations', 'Reactor Operator (RO)', 'مشغّل المفاعل', 'Operations', 'العمليات', 'professional', true, 'FANR-REG-17 Art. 4, 7, 8, 10, 11', 'barakah', null, 'high_school', false, true, false, ['fanr-reg17', 'sr2024', 'cns10'],
    'Manipulates reactivity and plant controls in the main control room and monitors plant parameters.',
    'يشغّل أدوات التحكم في التفاعلية وفي المحطة داخل غرفة التحكم الرئيسية ويراقب معايير المحطة.',
    'REG-17 Art. 4: high-school diploma plus 36 months as a fully qualified LO (or an equivalent route) plus security clearance.',
    'المادة 4 من اللائحة 17: شهادة الثانوية العامة مع 36 شهراً كمشغّل محلي مؤهَّل تأهيلاً كاملاً (أو مسار معادل) وتصريح أمني.',
    'COIT 91 weeks / 2,912 h (SR2024); FANR written and operating exams; COCT; quarterly shift minimums.',
    'التدريب الأولي للمشغّلين المعتمدين 91 أسبوعاً / 2,912 ساعة؛ اختبارات الهيئة؛ التدريب المستمر؛ الحد الأدنى من النوبات ربع السنوية.',
    'FANR certificate, valid 5 years', 'شهادة من الهيئة الاتحادية للرقابة النووية صالحة لخمس سنوات',
    [['Manipulates reactivity and plant controls in the MCR', 'تشغيل أدوات التحكم في التفاعلية والمحطة في غرفة التحكم'], ['Monitors plant parameters', 'مراقبة معايير المحطة'], ['Start-up, shutdown and emergency operating procedures', 'إجراءات بدء التشغيل والإيقاف والتشغيل في الطوارئ']]],
  ['local-operator', 'operations', 'Local Operator (LO)', 'مشغّل محلي', 'Operations', 'العمليات', 'entry', true, 'FANR-REG-17 Art. 12 (licensee qualification)', 'barakah', null, 'high_school', true, true, false, ['fanr-reg17', 'sr2024', 'enec-dnt-grad'],
    'Operates equipment outside the main control room under the direction of ROs and SROs.',
    'يشغّل المعدات خارج غرفة التحكم الرئيسية بتوجيه من مشغّلي المفاعل والمشغّلين الأوائل.',
    'High-school diploma (REG-17). Qualified by the licensee, not certified by FANR.',
    'شهادة الثانوية العامة (اللائحة 17). يؤهله المرخَّص له ولا تصدر له شهادة من الهيئة.',
    'DNT 24 months, or LOIT 60 weeks / 1,920 h; LOCT 5-6 weeks a year; written exams and JPMs.',
    'دبلوم التكنولوجيا النووية 24 شهراً أو التدريب الأولي للمشغّلين المحليين 60 أسبوعاً / 1,920 ساعة؛ تدريب مستمر 5-6 أسابيع سنوياً؛ اختبارات كتابية ومقاييس أداء وظيفي.',
    'Licensee qualification (not FANR-certified)', 'تأهيل من المرخَّص له (لا يحمل شهادة من الهيئة)',
    [['Operates equipment outside the MCR under RO and SRO direction', 'تشغيل المعدات خارج غرفة التحكم بتوجيه من المشغّلين'], ['Operator rounds', 'جولات المشغّل الميدانية'], ['Clearances and tag-outs', 'العزل ووضع بطاقات الحظر']]],
  ['shift-technical-advisor', 'operations', 'Shift Technical Advisor (STA)', 'المستشار الفني للوردية', 'Operations / Engineering', 'العمليات / الهندسة', 'senior', false, null, 'uncertain', 'A separate STA role at Barakah is unconfirmed; follows IAEA SSG-75.', 'bachelor', false, false, false, ['ssg75', 'fanr-reg16'],
    'Gives independent engineering advice to the shift on transients and accidents and monitors core and safety functions.',
    'يقدّم مشورة هندسية مستقلة للوردية بشأن الحالات العابرة والحوادث ويراقب القلب ووظائف السلامة.',
    'SSG-75: university degree plus training in transient and accident analysis.',
    'وفق SSG-75: شهادة جامعية مع تدريب على تحليل الحالات العابرة والحوادث.',
    'Engineering initial training; simulator transient training; licensee qualification card.',
    'التدريب الهندسي الأولي؛ تدريب على المحاكي للحالات العابرة؛ بطاقة تأهيل من المرخَّص له.',
    'Licensee; FANR oversight under REG-16', 'المرخَّص له؛ رقابة الهيئة بموجب اللائحة 16',
    [['Independent engineering advice on transients and accidents', 'مشورة هندسية مستقلة بشأن الحالات العابرة والحوادث'], ['Core and safety-function monitoring', 'مراقبة القلب ووظائف السلامة']]],
  ['operations-support-work-control', 'operations', 'Operations Support / Work Control / Clearance Writer', 'دعم العمليات / التحكم في الأعمال / محرر العزل', 'Operations', 'العمليات', 'professional', false, null, 'barakah', null, 'high_school', false, false, false, ['cns10'],
    'Runs the work control centre, prepares clearances and tag-outs, and keeps operating procedures current.',
    'يدير مركز التحكم في الأعمال ويعدّ عمليات العزل وبطاقات الحظر ويحافظ على تحديث إجراءات التشغيل.',
    'Operations background, often a former LO or RO; licensee qualification card.',
    'خلفية في العمليات، غالباً مشغّل محلي أو مشغّل مفاعل سابق؛ بطاقة تأهيل من المرخَّص له.',
    'Work control qualification card; clearance writer JPMs.',
    'بطاقة تأهيل التحكم في الأعمال؛ مقاييس أداء محرر العزل.',
    'Licensee', 'المرخَّص له',
    [['Work control centre', 'مركز التحكم في الأعمال'], ['Clearances and tag-outs', 'العزل وبطاقات الحظر'], ['Procedure upkeep', 'تحديث الإجراءات']]],
  ['outage-manager-planner', 'outage', 'Outage Manager / Planner / Scheduler', 'مدير / مخطط / مجدول فترات الإيقاف', 'Outage & Work Management', 'إدارة فترات الإيقاف والأعمال', 'senior', false, null, 'barakah', null, 'bachelor', false, false, false, ['sr2024', 'cns10'],
    'Plans refuelling outages and coordinates contractors; Unit 2\'s first refuelling outage involved about 8,000 maintenance tasks.',
    'يخطط لفترات إيقاف إعادة التزويد بالوقود وينسق مع المقاولين؛ شملت أول فترة إيقاف للوحدة 2 نحو 8,000 مهمة صيانة.',
    'Operations or maintenance background; INPO and WANO work-management practice.',
    'خلفية في العمليات أو الصيانة؛ ممارسات إدارة الأعمال لدى معهد عمليات الطاقة النووية والرابطة العالمية لمشغلي المحطات النووية.',
    'Work management training; outage planning qualification.',
    'تدريب على إدارة الأعمال؛ تأهيل في تخطيط فترات الإيقاف.',
    'Licensee', 'المرخَّص له',
    [['Plans refuelling outages', 'تخطيط فترات إيقاف إعادة التزويد بالوقود'], ['Coordinates contractors', 'التنسيق مع المقاولين'], ['Schedules daily plant work', 'جدولة الأعمال اليومية في المحطة']]],
  ['maintenance-technician-engineer', 'maintenance', 'Mechanical, Electrical and I&C Maintenance Technician and Engineer', 'فني ومهندس صيانة ميكانيكية وكهربائية وأجهزة وتحكم', 'Maintenance', 'الصيانة', 'professional', false, null, 'barakah', null, 'diploma', true, true, false, ['sr2024', 'ssg75'],
    'Carries out preventive, corrective and predictive maintenance, calibration and outage work.',
    'يتولى الصيانة الوقائية والتصحيحية والتنبؤية والمعايرة وأعمال فترات الإيقاف.',
    'Maintenance initial training 53 weeks / 1,969 h; DNT route for technicians; SSG-75: senior technicians 2-3 years.',
    'تدريب الصيانة الأولي 53 أسبوعاً / 1,969 ساعة؛ مسار دبلوم التكنولوجيا النووية للفنيين؛ وفق SSG-75 خبرة الفنيين الأوائل 2-3 سنوات.',
    'Task qualification cards; JPMs for safety-related work; continuing training (907 trainees in 2024).',
    'بطاقات تأهيل المهام؛ مقاييس أداء للأعمال المتعلقة بالسلامة؛ تدريب مستمر (907 متدربين في 2024).',
    'Licensee qualification; contractors through equivalency', 'تأهيل من المرخَّص له؛ المقاولون عبر المعادلة',
    [['Preventive, corrective and predictive maintenance', 'الصيانة الوقائية والتصحيحية والتنبؤية'], ['Calibration', 'المعايرة'], ['Outage work', 'أعمال فترات الإيقاف'], ['Maintenance-rule monitoring', 'رصد قاعدة الصيانة']]],
  ['systems-design-plant-engineer', 'engineering', 'Systems, Design and Plant Engineer', 'مهندس أنظمة وتصميم ومحطة', 'Engineering', 'الهندسة', 'professional', false, null, 'barakah', null, 'bachelor', true, false, false, ['sr2024', 'cns10'],
    'Looks after system health and design authority, modifications, ageing management and equipment qualification.',
    'يتابع سلامة الأنظمة وسلطة التصميم والتعديلات وإدارة التقادم وتأهيل المعدات.',
    'Engineering degree.', 'شهادة في الهندسة.',
    'Engineering initial training 20 weeks / 640 h; continuing training (447 engineers in 2024).',
    'التدريب الهندسي الأولي 20 أسبوعاً / 640 ساعة؛ تدريب مستمر (447 مهندساً في 2024).',
    'Licensee; FANR approval of licensing-basis changes', 'المرخَّص له؛ موافقة الهيئة على تغييرات أساس الترخيص',
    [['System health', 'سلامة الأنظمة'], ['Design authority and modifications', 'سلطة التصميم والتعديلات'], ['Ageing management', 'إدارة التقادم'], ['Equipment qualification', 'تأهيل المعدات']]],
  ['reactor-engineer-core-physicist', 'engineering', 'Reactor Engineer / Core Physicist', 'مهندس مفاعل / فيزيائي القلب', 'Reactor Engineering', 'هندسة المفاعل', 'professional', false, null, 'generic', 'Nuclear Fuel Design track detail from search digests only.', 'master', false, true, false, ['ssg75', 'sr2024'],
    'Supports Operations with core design checks, start-up physics tests, fuel performance and reactivity management.',
    'يدعم العمليات بفحوص تصميم القلب واختبارات فيزياء بدء التشغيل وأداء الوقود وإدارة التفاعلية.',
    'Degree, often an MSc.', 'شهادة جامعية، غالباً ماجستير.',
    'Engineering initial training; reactor engineering qualification standard.',
    'التدريب الهندسي الأولي؛ معيار تأهيل هندسة المفاعل.',
    'Licensee', 'المرخَّص له',
    [['Core design checks', 'فحوص تصميم القلب'], ['Start-up physics tests', 'اختبارات فيزياء بدء التشغيل'], ['Fuel performance and reactivity management support', 'دعم أداء الوقود وإدارة التفاعلية']]],
  ['nuclear-fuel-specialist', 'nuclear-fuel', 'Nuclear Fuel / Fuel Handling Specialist', 'أخصائي الوقود النووي / مناولة الوقود', 'Nuclear Fuel', 'الوقود النووي', 'professional', true, 'FANR-REG-10 (nuclear material accounting)', 'generic', null, 'bachelor', false, false, false, ['ssg75', 'cns10'],
    'Covers fuel procurement and receipt, refuelling (about one third of the core per outage), the spent-fuel pool and dry-storage planning.',
    'يغطي شراء الوقود واستلامه وإعادة التزويد بالوقود (نحو ثلث القلب في كل فترة إيقاف) وحوض الوقود المستهلك وتخطيط التخزين الجاف.',
    'Degree; fuel handling is also part of COIT for operators.', 'شهادة جامعية؛ مناولة الوقود جزء من تدريب المشغّلين المعتمدين أيضاً.',
    'Engineering initial training; fuel handling qualification.', 'التدريب الهندسي الأولي؛ تأهيل مناولة الوقود.',
    'Licensee; FANR-REG-10 nuclear material accounting', 'المرخَّص له؛ اللائحة 10 لمحاسبة المواد النووية',
    [['Fuel procurement and receipt', 'شراء الوقود واستلامه'], ['Refuelling', 'إعادة التزويد بالوقود'], ['Spent-fuel pool and dry-storage planning', 'حوض الوقود المستهلك وتخطيط التخزين الجاف']]],
  ['cyber-security-engineer', 'cyber', 'Cyber Security / IT-OT Engineer', 'مهندس الأمن السيبراني / تقنية المعلومات والتشغيل', 'IT/OT & Cyber', 'تقنية المعلومات والتشغيل والأمن السيبراني', 'professional', true, 'FANR-REG-08 V2 (adds cyber security)', 'generic', null, 'bachelor', false, false, true, ['cns10'],
    'Maintains the cyber security programme and protects digital systems and plant networks under an ISO/IEC 27001 management system.',
    'يدير برنامج الأمن السيبراني ويحمي الأنظمة الرقمية وشبكات المحطة ضمن نظام إدارة وفق ISO/IEC 27001.',
    'Degree and cyber certifications; ENEC holds ISO/IEC 27001.', 'شهادة جامعية وشهادات في الأمن السيبراني؛ تحمل ENEC شهادة ISO/IEC 27001.',
    'Cyber security qualification (general content only in Kafa\'a).', 'تأهيل في الأمن السيبراني (محتوى عام فقط في كفاءة).',
    'FANR-REG-08 V2', 'اللائحة 08 الإصدار 2 للهيئة',
    [['Cyber security programme', 'برنامج الأمن السيبراني'], ['Protection of digital systems and plant networks', 'حماية الأنظمة الرقمية وشبكات المحطة'], ['ISO 27001 management system', 'نظام إدارة ISO 27001']]],
  ['radiation-protection-technician', 'radiation-protection', 'Radiation Protection Technician / Health Physicist / ALARA', 'فني وقاية من الإشعاع / فيزيائي صحي / أخصائي ALARA', 'Radiation Protection', 'الوقاية من الإشعاع', 'professional', true, 'FANR radiation protection regulations', 'barakah', null, 'diploma', true, true, false, ['sr2024', 'ssg75'],
    'Performs surveys, issues radiation work permits, manages dosimetry and contamination control, and plans ALARA work.',
    'يجري المسوحات ويصدر تصاريح العمل الإشعاعي ويدير قياس الجرعات ومكافحة التلوث ويخطط للعمل وفق مبدأ ALARA.',
    'RP officers are usually graduates (SSG-75).', 'مسؤولو الوقاية من الإشعاع عادةً من حملة الشهادات الجامعية (SSG-75).',
    'RP initial training 36 weeks / 1,056 h; continuing training (111 staff in 2024).',
    'تدريب الوقاية من الإشعاع الأولي 36 أسبوعاً / 1,056 ساعة؛ تدريب مستمر (111 موظفاً في 2024).',
    'Licensee; FANR radiation protection regulations', 'المرخَّص له؛ لوائح الهيئة للوقاية من الإشعاع',
    [['Radiation surveys', 'المسوحات الإشعاعية'], ['Radiation work permits', 'تصاريح العمل الإشعاعي'], ['Dosimetry and contamination control', 'قياس الجرعات ومكافحة التلوث'], ['ALARA planning and dose reporting', 'تخطيط ALARA والإبلاغ عن الجرعات']]],
  ['chemistry-technician', 'chemistry', 'Chemistry Technician / Chemist', 'فني كيمياء / كيميائي', 'Chemistry', 'الكيمياء', 'professional', true, 'FANR-REG-16 Art. 9 (chemistry training)', 'barakah', null, 'bachelor', true, false, false, ['sr2024', 'fanr-reg16'],
    'Controls primary and secondary water chemistry, performs radiochemistry and monitors effluents.',
    'يضبط كيمياء المياه في الدائرتين الأولية والثانوية ويجري التحاليل الكيميائية الإشعاعية ويرصد المخلفات.',
    'Chemistry graduates; GDP route.', 'خريجو الكيمياء؛ مسار برنامج تطوير الخريجين.',
    'Chemistry initial training 28 weeks / 896 h (REG-16 Art. 9); continuing training (65 staff in 2024).',
    'تدريب الكيمياء الأولي 28 أسبوعاً / 896 ساعة (المادة 9 من اللائحة 16)؛ تدريب مستمر (65 موظفاً في 2024).',
    'Licensee; FANR-REG-16 chemistry programme', 'المرخَّص له؛ برنامج الكيمياء وفق اللائحة 16',
    [['Primary and secondary water chemistry', 'كيمياء المياه في الدائرتين الأولية والثانوية'], ['Radiochemistry', 'الكيمياء الإشعاعية'], ['Effluent monitoring', 'رصد المخلفات']]],
  ['environmental-monitoring-specialist', 'environment', 'Environment / Radiological Environmental Monitoring', 'أخصائي البيئة / الرصد الإشعاعي البيئي', 'Environment', 'البيئة', 'professional', false, null, 'barakah', null, 'bachelor', false, false, false, ['enec-erc', 'sr2024'],
    'Monitors environmental radiation, runs the environmental laboratory at the Emergency Response Center and tracks effluent limits and permits.',
    'يرصد الإشعاع البيئي ويشغّل المختبر البيئي في مركز الاستجابة للطوارئ ويتابع حدود المخلفات والتصاريح.',
    'Degree; ISO 14001 knowledge.', 'شهادة جامعية؛ معرفة بمعيار ISO 14001.',
    'Environmental monitoring qualification.', 'تأهيل في الرصد البيئي.',
    'EAD; FANR', 'هيئة البيئة - أبوظبي؛ الهيئة الاتحادية للرقابة النووية',
    [['Environmental radiation monitoring', 'رصد الإشعاع البيئي'], ['Environmental laboratory at the ERC', 'المختبر البيئي في مركز الاستجابة للطوارئ'], ['Effluent limits and EAD permits', 'حدود المخلفات وتصاريح هيئة البيئة']]],
  ['quality-assurance-qc', 'quality', 'Quality Assurance / QC / NDE', 'ضمان الجودة / مراقبة الجودة / الفحص غير الإتلافي', 'Quality', 'الجودة', 'professional', false, null, 'barakah', null, 'bachelor', false, false, false, ['enec-intl-standards', 'cns10'],
    'Runs audits, NQA-1 compliance, supplier audits and quality control inspections.',
    'يتولى عمليات التدقيق والامتثال لمعيار NQA-1 وتدقيق الموردين وفحوص مراقبة الجودة.',
    'Lead-auditor training; ENEC holds ISO 9001 and NQA-1 compliance.', 'تدريب المدقق الرئيسي؛ تحمل ENEC شهادة ISO 9001 وتلتزم بمعيار NQA-1.',
    'QA auditor qualification standard; NDE certifications.', 'معيار تأهيل مدقق الجودة؛ شهادات الفحص غير الإتلافي.',
    'Licensee; FANR-REG-01', 'المرخَّص له؛ اللائحة 01 للهيئة',
    [['Audits and NQA-1 compliance', 'التدقيق والامتثال لمعيار NQA-1'], ['Supplier audits', 'تدقيق الموردين'], ['QC inspections', 'فحوص مراقبة الجودة']]],
  ['nuclear-oversight-npi', 'oversight', 'Nuclear Oversight / Nuclear Performance Improvement', 'الرقابة النووية / تحسين الأداء النووي', 'Independent Oversight', 'الرقابة المستقلة', 'senior', false, null, 'barakah', null, 'bachelor', false, false, false, ['enec-oversight', 'cns10'],
    'Trends corrective actions, runs self-assessments and OE screening, and supports the Committee on Nuclear Power and the Nuclear Safety Review Board.',
    'يحلل اتجاهات الإجراءات التصحيحية ويجري التقييمات الذاتية وفرز الخبرات التشغيلية ويدعم لجنة الطاقة النووية ومجلس مراجعة السلامة النووية.',
    'Experienced engineers or former operators.', 'مهندسون ذوو خبرة أو مشغّلون سابقون.',
    'WANO self-assessment training.', 'تدريب التقييم الذاتي لدى الرابطة العالمية لمشغلي المحطات النووية.',
    'Licensee; reports to CNP and NSRB', 'المرخَّص له؛ يرفع التقارير إلى لجنة الطاقة النووية ومجلس مراجعة السلامة النووية',
    [['Corrective action trending', 'تحليل اتجاهات الإجراءات التصحيحية'], ['Self-assessments', 'التقييمات الذاتية'], ['OE screening', 'فرز الخبرات التشغيلية']]],
  ['regulatory-affairs-licensing-engineer', 'licensing', 'Regulatory Affairs / Licensing Engineer', 'مهندس الشؤون التنظيمية / الترخيص', 'Licensing', 'الترخيص', 'professional', false, null, 'barakah', null, 'bachelor', false, false, false, ['enec-licensing', 'cns10'],
    'Updates the safety analysis report, manages licensing-basis changes and regulatory correspondence, and supports periodic safety review.',
    'يحدّث تقرير تحليل السلامة ويدير تغييرات أساس الترخيص والمراسلات التنظيمية ويدعم المراجعة الدورية للسلامة.',
    'Degree; knowledge of FANR regulations.', 'شهادة جامعية؛ معرفة بلوائح الهيئة.',
    'Engineering initial training; licensing qualification.', 'التدريب الهندسي الأولي؛ تأهيل في الترخيص.',
    'Licensee interface with FANR', 'واجهة المرخَّص له مع الهيئة',
    [['Safety analysis report updates', 'تحديثات تقرير تحليل السلامة'], ['Licensing-basis changes', 'تغييرات أساس الترخيص'], ['Regulatory correspondence', 'المراسلات التنظيمية'], ['Periodic safety review', 'المراجعة الدورية للسلامة']]],
  ['human-performance-specialist', 'oversight', 'Human Performance / Safety Culture Specialist', 'أخصائي الأداء البشري / ثقافة السلامة', 'Organisational Effectiveness', 'الفعالية المؤسسية', 'professional', false, null, 'barakah', null, 'bachelor', false, false, false, ['cns10', 'enec-safety-culture'],
    'Trains human performance tools, runs the observation and coaching programme and supports safety-culture assessments.',
    'يدرّب على أدوات الأداء البشري ويدير برنامج الملاحظة والتوجيه ويدعم تقييمات ثقافة السلامة.',
    'INPO and WANO human performance training.', 'تدريب الأداء البشري لدى INPO وWANO.',
    'HU instructor qualification; observation and coaching.', 'تأهيل مدرب الأداء البشري؛ الملاحظة والتوجيه.',
    'Licensee', 'المرخَّص له',
    [['HU tools training', 'التدريب على أدوات الأداء البشري'], ['Observation and coaching programme', 'برنامج الملاحظة والتوجيه'], ['Safety-culture assessments', 'تقييمات ثقافة السلامة']]],
  ['ecp-officer', 'oversight', 'Employee Concerns Program Officer', 'مسؤول برنامج مخاوف الموظفين', 'ECP (independent)', 'برنامج مخاوف الموظفين (مستقل)', 'professional', false, null, 'barakah', null, 'bachelor', false, false, false, ['sr2024'],
    'Handles nuclear safety and quality concerns confidentially and investigates harassment, intimidation, retaliation and discrimination.',
    'يتعامل بسرية مع مخاوف السلامة النووية والجودة ويحقق في حالات المضايقة والترهيب والانتقام والتمييز.',
    'Specialist ECP training.', 'تدريب متخصص في برنامج مخاوف الموظفين.',
    'ENEC participates in the North American ECP association.', 'تشارك ENEC في رابطة برامج مخاوف الموظفين في أمريكا الشمالية.',
    'Licensee', 'المرخَّص له',
    [['Confidential handling of concerns', 'التعامل السري مع المخاوف'], ['HIRD investigations', 'التحقيق في المضايقة والترهيب والانتقام والتمييز']]],
  ['industrial-health-safety-officer', 'health-safety', 'Industrial Health & Safety Officer', 'مسؤول الصحة والسلامة المهنية', 'Health & Safety', 'الصحة والسلامة', 'professional', false, null, 'barakah', null, 'bachelor', true, false, false, ['sr2024'],
    'Runs the ISO 45001 management system, job hazard analyses and inspections (2,186 in 2024), including heat-stress controls.',
    'يدير نظام ISO 45001 وتحليل مخاطر الأعمال وعمليات التفتيش (2,186 في 2024) بما في ذلك ضوابط الإجهاد الحراري.',
    'OSHAD / ADOSH requirements; recognised safety certifications.', 'متطلبات نظام إدارة الصحة والسلامة المهنية في أبوظبي؛ شهادات سلامة معترف بها.',
    'H&S qualification; site induction.', 'تأهيل الصحة والسلامة؛ تعريف بالموقع.',
    'ADOSH / OSHAD; FANR for nuclear safety', 'مركز أبوظبي للسلامة والصحة المهنية؛ الهيئة للسلامة النووية',
    [['ISO 45001 management system', 'نظام إدارة ISO 45001'], ['Job hazard analyses', 'تحليل مخاطر الأعمال'], ['Inspections and heat-stress controls', 'التفتيش وضوابط الإجهاد الحراري']]],
  ['fire-protection', 'fire-protection', 'Fire Protection', 'الحماية من الحرائق', 'Fire Protection', 'الحماية من الحرائق', 'professional', true, 'FANR-REG-16 Art. 22', 'generic', null, 'diploma', true, false, false, ['fanr-reg16'],
    'Runs the plant fire brigade, the fire-protection programme and fire drills.',
    'يدير فرقة الإطفاء في المحطة وبرنامج الحماية من الحرائق وتمارين الإطفاء.',
    'Firefighter certification.', 'شهادة رجل إطفاء.',
    'Plant fire-brigade training and drills.', 'تدريب فرقة الإطفاء في المحطة والتمارين.',
    'FANR-REG-16 Art. 22; Civil Defence', 'المادة 22 من اللائحة 16؛ الدفاع المدني',
    [['Fire brigade', 'فرقة الإطفاء'], ['Fire-protection programme', 'برنامج الحماية من الحرائق'], ['Drills', 'التمارين']]],
  ['emergency-preparedness-coordinator', 'emergency-preparedness', 'Emergency Preparedness Coordinator / ERO member', 'منسق التأهب للطوارئ / عضو منظمة الاستجابة للطوارئ', 'Emergency Preparedness', 'التأهب للطوارئ', 'professional', true, 'FANR-REG-12 Art. 23', 'barakah', null, 'bachelor', false, true, false, ['fanr-reg12', 'enec-erc', 'cns10'],
    'Maintains on-site plans and emergency facilities, runs drills and notifications. Kafa\'a records participation and role qualification only.',
    'يحافظ على خطط الطوارئ في الموقع ومرافقها ويدير التمارين والإخطارات. تسجل كفاءة المشاركة وتأهيل الدور فقط.',
    'Training and drills under FANR-REG-12 Art. 23.', 'التدريب والتمارين وفق المادة 23 من اللائحة 12.',
    'ERO role training; FANR\'s TAHYAA national qualification for emergency workers.', 'تدريب أدوار منظمة الاستجابة للطوارئ؛ مؤهل "تهيأ" الوطني للعاملين في الطوارئ.',
    'Licensee; FANR-REG-12 and -15; NCEMA off-site', 'المرخَّص له؛ اللائحتان 12 و15؛ الهيئة الوطنية لإدارة الطوارئ خارج الموقع',
    [['On-site plans and emergency facilities', 'خطط الطوارئ في الموقع ومرافقها'], ['Drills and exercises', 'التمارين والتدريبات'], ['Notifications', 'الإخطارات']]],
  ['security-officer', 'security', 'Security Officer / Physical Protection', 'ضابط أمن / الحماية المادية', 'Security', 'الأمن', 'professional', true, 'FANR-REG-08 V2', 'barakah', 'Career path only; no security detail is held in Kafa\'a.', 'high_school', true, false, true, ['cns10'],
    'Physical protection and access authorisation. Kafa\'a shows the career path only.',
    'الحماية المادية وتصاريح الدخول. تعرض كفاءة المسار المهني فقط.',
    'Trustworthiness and reliability programme; fitness for duty including drug and alcohol testing (REG-08 Art. 11); UAE security clearance.',
    'برنامج الجدارة بالثقة والموثوقية؛ اللياقة للعمل بما في ذلك فحص المخدرات والكحول (المادة 11 من اللائحة 08)؛ تصريح أمني إماراتي.',
    'Security training content stays outside Kafa\'a; status mirrored as qualified / not qualified only.',
    'يبقى محتوى التدريب الأمني خارج كفاءة؛ تُعرض الحالة "مؤهل / غير مؤهل" فقط.',
    'FANR-REG-08 V2; UAE security clearance', 'اللائحة 08 الإصدار 2؛ تصريح أمني إماراتي',
    [['Physical protection', 'الحماية المادية'], ['Access authorisation', 'تصاريح الدخول'], ['Liaison with response forces', 'التنسيق مع قوات الاستجابة']]],
  ['safeguards-specialist', 'safeguards', 'Safeguards / Nuclear Material Accountancy Specialist', 'أخصائي الضمانات / محاسبة المواد النووية', 'Safeguards', 'الضمانات', 'professional', true, 'FANR-REG-10; IAEA safeguards agreement', 'barakah', null, 'bachelor', false, false, true, ['cns10'],
    'Keeps nuclear material accounts and supports IAEA inspections and Additional Protocol declarations.',
    'يحتفظ بحسابات المواد النووية ويدعم عمليات تفتيش الوكالة وإعلانات البروتوكول الإضافي.',
    'Degree.', 'شهادة جامعية.',
    'FANR and IAEA safeguards training.', 'تدريب الضمانات لدى الهيئة والوكالة الدولية.',
    'FANR-REG-10; IAEA safeguards agreement and Additional Protocol', 'اللائحة 10؛ اتفاق الضمانات مع الوكالة والبروتوكول الإضافي',
    [['Nuclear material accounting', 'محاسبة المواد النووية'], ['Support to IAEA inspections', 'دعم عمليات تفتيش الوكالة'], ['Additional Protocol declarations', 'إعلانات البروتوكول الإضافي']]],
  ['nuclear-training-instructor', 'training', 'Nuclear Training Instructor, incl. simulator and SRO-qualified instructor', 'مدرب التدريب النووي بما في ذلك مدرب المحاكي والمدرب المؤهل كمشغّل أول', 'Nuclear Training', 'التدريب النووي', 'senior', true, 'FANR-REG-17 (SRO-qualified instructor requalification)', 'barakah', null, 'bachelor', false, true, false, ['fanr-reg17', 'cns10'],
    'Designs and delivers SAT programmes, simulator scenarios and examinations.',
    'يصمم ويقدم برامج النهج المنهجي للتدريب وسيناريوهات المحاكي والاختبارات.',
    'Technical competence plus instructional skills.', 'كفاءة فنية مع مهارات تدريسية.',
    'Accelerated SRO Instructor Program (ASIP); Instructor Initial and Continuing Qualification; SRO-qualified instructors keep biennial requalification.',
    'برنامج مدرب المشغّل الأول المعجل؛ التأهيل الأولي والمستمر للمدربين؛ يحافظ المدربون المؤهلون كمشغّلين أوائل على إعادة التأهيل كل سنتين.',
    'Licensee; FANR reviews exams', 'المرخَّص له؛ تراجع الهيئة الاختبارات',
    [['Designs and delivers SAT programmes', 'تصميم وتقديم برامج النهج المنهجي للتدريب'], ['Simulator scenarios', 'سيناريوهات المحاكي'], ['Examinations and JPM evaluation', 'الاختبارات وتقييم مقاييس الأداء']]],
  ['procurement-engineer', 'supply-chain', 'Procurement / Supply Chain / Nuclear Procurement Engineer', 'مهندس مشتريات / سلسلة إمداد / مشتريات نووية', 'Supply Chain', 'سلسلة الإمداد', 'professional', false, null, 'generic', null, 'bachelor', true, false, false, ['enec-localisation', 'enec-icv'],
    'Runs safety-related procurement, commercial-grade dedication, ICV and supplier development.',
    'يتولى المشتريات المتعلقة بالسلامة واعتماد المواد التجارية والقيمة المحلية المضافة وتطوير الموردين.',
    'Degree; NQA-1 knowledge.', 'شهادة جامعية؛ معرفة بمعيار NQA-1.',
    'Procurement engineering qualification; supplier quality training.', 'تأهيل في هندسة المشتريات؛ تدريب جودة الموردين.',
    'Licensee QA', 'ضمان الجودة لدى المرخَّص له',
    [['Safety-related procurement', 'المشتريات المتعلقة بالسلامة'], ['Commercial-grade dedication', 'اعتماد المواد التجارية'], ['ICV and supplier development', 'القيمة المحلية المضافة وتطوير الموردين']]],
  ['corporate-professional', 'corporate', 'Corporate: HR, Finance, Legal, Communications, Stakeholder Engagement', 'الخدمات المؤسسية: الموارد البشرية والمالية والقانونية والاتصال وإشراك أصحاب المصلحة', 'ENEC corporate', 'الخدمات المؤسسية في ENEC', 'professional', false, null, 'barakah', 'Administrative Assistant vacancies are open only to UAE nationals (enec.ae careers).', 'bachelor', true, false, false, ['enec-careers', 'enec-talent'],
    'Delivers Emiratization and the talent pipeline, community outreach, public opinion research, finance and governance.',
    'يتولى التوطين وبرامج استقطاب المواهب والتواصل المجتمعي وأبحاث الرأي العام والمالية والحوكمة.',
    'Degree in the relevant discipline.', 'شهادة جامعية في التخصص المعني.',
    'GDP and Train for Work routes; General Employee Training.', 'مسارا برنامج تطوير الخريجين و"التدريب من أجل العمل"؛ التدريب العام للموظفين.',
    'n/a', 'لا ينطبق',
    [['Emiratization and talent pipeline', 'التوطين واستقطاب المواهب'], ['Community outreach', 'التواصل المجتمعي'], ['Finance and governance', 'المالية والحوكمة']]],
];

const RO_ROUTES = [
  { id: 'ro_lo36', en: 'High-school diploma plus 36 months as a fully qualified Local Operator', ar: 'شهادة الثانوية العامة مع 36 شهراً كمشغّل محلي مؤهَّل تأهيلاً كاملاً', rule_ref: 'FANR-REG-17 Art. 4', url: R17 },
  { id: 'ro_other_plant', en: '24 months as RO or SRO at another plant, plus 12 months at Barakah including 6 on crew', ar: '24 شهراً كمشغّل مفاعل أو مشغّل أول في محطة أخرى، مع 12 شهراً في براكة منها 6 أشهر ضمن طاقم', rule_ref: 'FANR-REG-17 Art. 4', url: R17 },
  { id: 'ro_fossil', en: '24 months at a fossil or different-type nuclear plant, plus 12 months at Barakah including 9 on crew', ar: '24 شهراً في محطة وقود أحفوري أو محطة نووية من نوع مختلف، مع 12 شهراً في براكة منها 9 أشهر ضمن طاقم', rule_ref: 'FANR-REG-17 Art. 4', url: R17 },
];
const SRO_ROUTES = [
  { id: 'sro_ro24', en: '24 months as Reactor Operator at Barakah', ar: '24 شهراً كمشغّل مفاعل في براكة', rule_ref: 'FANR-REG-17 Art. 4', url: R17 },
  { id: 'sro_bsc', en: 'BSc in engineering, engineering technology or a related science, plus 24 months of nuclear work at Barakah including 12 as Local Operator', ar: 'بكالوريوس في الهندسة أو تكنولوجيا الهندسة أو علم ذي صلة، مع 24 شهراً من العمل النووي في براكة منها 12 شهراً كمشغّل محلي', rule_ref: 'FANR-REG-17 Art. 4', url: R17 },
  { id: 'sro_other_plant', en: '24 months as RO, SRO or SRO-Qualified Instructor elsewhere, plus 12 months at Barakah including 6 on crew', ar: '24 شهراً كمشغّل مفاعل أو مشغّل أول أو مدرب مؤهل كمشغّل أول في مكان آخر، مع 12 شهراً في براكة منها 6 أشهر ضمن طاقم', rule_ref: 'FANR-REG-17 Art. 4', url: R17 },
];
const CLEARANCE = { en: 'Every route also needs a UAE security clearance (recorded only as confirmed or pending).', ar: 'يتطلب كل مسار أيضاً تصريحاً أمنياً إماراتياً (يُسجَّل فقط كمؤكد أو قيد الانتظار).' };

export function buildRoles() {
  const roles = [];
  const resp = [];
  R.forEach((r, i) => {
    const [id, family_id, title_en, title_ar, function_en, function_ar, level, regulated, regulation_ref, basis, basis_note, education, entry_level, critical, security_sensitive, srcIds,
      summary_en, summary_ar, qualifications_en, qualifications_ar, training_path_en, training_path_ar, licensing_body_en, licensing_body_ar, responsibilities] = r;
    let entry_routes = [];
    if (id === 'reactor-operator') entry_routes = [...RO_ROUTES, { id: 'clearance', ...CLEARANCE, rule_ref: 'FANR-REG-17 Art. 4', url: R17 }];
    if (id === 'senior-reactor-operator') entry_routes = [...SRO_ROUTES, { id: 'clearance', ...CLEARANCE, rule_ref: 'FANR-REG-17 Art. 4', url: R17 }];
    if (id === 'local-operator') entry_routes = [
      { id: 'dnt', en: 'Diploma in Nuclear Technology (24 months) for UAE high-school graduates', ar: 'دبلوم التكنولوجيا النووية (24 شهراً) لخريجي الثانوية العامة من المواطنين', rule_ref: 'ENEC talent pipeline', url: 'https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/' },
      { id: 'loit', en: 'Local Operator Initial Training (60 weeks / 1,920 h) for direct hires', ar: 'التدريب الأولي للمشغّلين المحليين (60 أسبوعاً / 1,920 ساعة) للمعيّنين مباشرة', rule_ref: 'SR2024 p.51', url: 'https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf' },
      { id: 'gpo', en: 'Graduate Plant Operator for Emirati engineering graduates (start as LO)', ar: 'برنامج مشغّل المحطة للخريجين لخريجي الهندسة المواطنين (البدء كمشغّل محلي)', rule_ref: 'ENEC GPO release (Aug 2025)', url: 'https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/' },
    ];
    roles.push({
      id, family_id, title_en, title_ar, function_en, function_ar, level, regulated, regulation_ref, regulation_url: regulated ? (regulation_ref?.includes('REG-17') ? R17 : regulation_ref?.includes('REG-16') ? 'https://www.fanr.gov.ae/en/Documents/REG-16-English.pdf' : regulation_ref?.includes('REG-12') ? 'https://www.fanr.gov.ae/en/Documents/FANR-REG-12%20V1%20ENG%20for%20website.pdf' : null) : null,
      basis, basis_note, summary_en, summary_ar, qualifications_en, qualifications_ar, training_path_en, training_path_ar, licensing_body_en, licensing_body_ar,
      entry_routes, education, entry_level, emiratization_reserved: id === 'corporate-professional', critical, security_sensitive, sources: srcs(...srcIds), status: 'published', version: 1, sort: i + 1,
    });
    responsibilities.forEach(([en, ar], j) => resp.push({ id: `${id}-r${j + 1}`, role_id: id, text_en: en, text_ar: ar, sort: j + 1 }));
  });
  return { roles, resp };
}

// ───────────── Competency framework (M02): 14 domains, 4 levels
export const LEVELS = [
  [1, 'Awareness', 'إلمام', 'Knows the basics and why they matter.', 'يعرف الأساسيات وأهميتها.'],
  [2, 'Practitioner', 'ممارس', 'Works under supervision.', 'يعمل تحت الإشراف.'],
  [3, 'Qualified', 'مؤهَّل', 'Works independently.', 'يعمل باستقلالية.'],
  [4, 'Expert', 'خبير', 'Can train and evaluate others.', 'يستطيع تدريب الآخرين وتقييمهم.'],
].map(([level, name_en, name_ar, description_en, description_ar]) => ({ id: `L${level}`, level, name_en, name_ar, description_en, description_ar }));

const DOMAINS = [
  ['plant', 'Plant fundamentals and APR-1400 systems', 'أساسيات المحطة وأنظمة APR-1400', [
    ['PF-01', 'Reactor theory and nuclear physics fundamentals', 'نظرية المفاعل وأساسيات الفيزياء النووية'],
    ['PF-02', 'Thermodynamics, heat transfer and fluid flow', 'الديناميكا الحرارية وانتقال الحرارة وجريان الموائع'],
    ['PF-03', 'APR-1400 integrated plant systems', 'أنظمة محطة APR-1400 المتكاملة']]],
  ['conduct', 'Conduct of operations', 'إدارة العمليات', [
    ['CO-01', 'Procedure use and adherence', 'استخدام الإجراءات والالتزام بها'],
    ['CO-02', 'Shift turnover and communications', 'تسليم النوبات والاتصالات'],
    ['CO-03', 'Reactivity management', 'إدارة التفاعلية']]],
  ['maintenance', 'Maintenance practices', 'ممارسات الصيانة', [
    ['MP-01', 'Work package execution', 'تنفيذ حزم العمل'],
    ['MP-02', 'Calibration and testing', 'المعايرة والاختبار']]],
  ['rp', 'Radiation protection', 'الوقاية من الإشعاع', [
    ['RP-01', 'Radiation fundamentals and dose limits', 'أساسيات الإشعاع وحدود الجرعات'],
    ['RP-02', 'ALARA planning and radiation work permits', 'تخطيط ALARA وتصاريح العمل الإشعاعي']]],
  ['chemistry', 'Chemistry', 'الكيمياء', [
    ['CH-01', 'Water chemistry control', 'ضبط كيمياء المياه'],
    ['CH-02', 'Radiochemistry and effluent monitoring', 'الكيمياء الإشعاعية ورصد المخلفات']]],
  ['engineering', 'Engineering and design authority', 'الهندسة وسلطة التصميم', [
    ['EN-01', 'Configuration management and design control', 'إدارة التهيئة وضبط التصميم'],
    ['EN-02', 'System health monitoring', 'رصد سلامة الأنظمة']]],
  ['safety', 'Nuclear safety and licensing basis', 'السلامة النووية وأساس الترخيص', [
    ['NS-01', 'Defence in depth and safety functions', 'الدفاع في العمق ووظائف السلامة'],
    ['NS-02', 'Technical specifications and the licensing basis', 'المواصفات الفنية وأساس الترخيص']]],
  ['hu', 'Human performance', 'الأداء البشري', [
    ['HU-01', 'Core human performance tools', 'الأدوات الأساسية للأداء البشري'],
    ['HU-02', 'Pre-job briefs graded to risk', 'إحاطات ما قبل العمل المتدرجة حسب المخاطر']]],
  ['culture', 'Nuclear safety culture (the 10 traits)', 'ثقافة السلامة النووية (السمات العشر)', [
    ['SC-01', 'Questioning attitude and raising concerns', 'موقف التساؤل ورفع المخاوف'],
    ['SC-02', 'Leadership safety values and actions', 'قيم وأفعال القيادة في مجال السلامة']]],
  ['ep', 'Emergency preparedness', 'التأهب للطوارئ', [
    ['EP-01', 'Emergency response organisation roles', 'أدوار منظمة الاستجابة للطوارئ'],
    ['EP-02', 'Drill participation and notifications', 'المشاركة في التمارين والإخطارات']]],
  ['security', 'Security awareness (general content only)', 'الوعي الأمني (محتوى عام فقط)', [
    ['SA-01', 'Security awareness for all staff', 'الوعي الأمني لجميع الموظفين']]],
  ['quality', 'Quality and NQA-1', 'الجودة ومعيار NQA-1', [
    ['QA-01', 'NQA-1 quality assurance requirements', 'متطلبات ضمان الجودة وفق NQA-1'],
    ['QA-02', 'Commercial-grade dedication and CFSI', 'اعتماد المواد التجارية والمواد المقلدة والمشبوهة']]],
  ['leadership', 'Leadership', 'القيادة', [
    ['LD-01', 'Leading effective teams', 'قيادة فرق فعّالة'],
    ['LD-02', 'Conservative decision-making', 'اتخاذ القرارات المتحفظة']]],
  ['digital', 'Digital and AI', 'الرقمنة والذكاء الاصطناعي', [
    ['DA-01', 'Digital tools and data literacy', 'الأدوات الرقمية ومحو الأمية في البيانات'],
    ['DA-02', 'Governed use of AI', 'الاستخدام المحوكم للذكاء الاصطناعي']]],
];

export function buildCompetencies() {
  const out = [];
  for (const [domain, den, dar, list] of DOMAINS) {
    for (const [code, en, ar] of list) {
      out.push({
        id: code.toLowerCase(), code, domain, domain_en: den, domain_ar: dar, name_en: en, name_ar: ar,
        description_en: `${en}: what a person in a nuclear role needs to know and do, from awareness to expert.`,
        description_ar: `${ar}: ما يحتاج الشخص في دور نووي إلى معرفته وأدائه، من الإلمام إلى الخبرة.`,
        levels: [
          { level: 1, en: `Explains the purpose and basic principles of ${en.toLowerCase()}.`, ar: `يشرح الغرض والمبادئ الأساسية لـ${ar}.` },
          { level: 2, en: `Applies ${en.toLowerCase()} under supervision using approved procedures.`, ar: `يطبّق ${ar} تحت الإشراف باستخدام الإجراءات المعتمدة.` },
          { level: 3, en: `Applies ${en.toLowerCase()} independently and recognises when to stop and ask.`, ar: `يطبّق ${ar} باستقلالية ويعرف متى يتوقف ويسأل.` },
          { level: 4, en: `Coaches, trains and evaluates others in ${en.toLowerCase()}.`, ar: `يوجّه الآخرين ويدربهم ويقيّمهم في ${ar}.` },
        ],
      });
    }
  }
  return out;
}

// Role → competency requirements [role, [[code, level, importance]...]]
const RC = {
  'senior-reactor-operator': [['PF-01', 4, 'core'], ['PF-02', 3, 'core'], ['PF-03', 4, 'core'], ['CO-01', 4, 'core'], ['CO-02', 4, 'core'], ['CO-03', 4, 'core'], ['NS-02', 4, 'core'], ['HU-01', 4, 'core'], ['LD-01', 3, 'core'], ['LD-02', 4, 'core'], ['EP-01', 3, 'important']],
  'shift-supervisor': [['PF-03', 4, 'core'], ['CO-02', 4, 'core'], ['NS-01', 4, 'core'], ['LD-01', 4, 'core'], ['LD-02', 4, 'core'], ['EP-01', 4, 'core'], ['SC-02', 4, 'core']],
  'reactor-operator': [['PF-01', 3, 'core'], ['PF-02', 3, 'core'], ['PF-03', 3, 'core'], ['CO-01', 3, 'core'], ['CO-02', 3, 'core'], ['CO-03', 3, 'core'], ['NS-02', 3, 'core'], ['HU-01', 3, 'core']],
  'local-operator': [['PF-02', 2, 'core'], ['PF-03', 3, 'core'], ['CO-01', 3, 'core'], ['CO-02', 3, 'important'], ['HU-01', 3, 'core'], ['RP-01', 2, 'important']],
  'shift-technical-advisor': [['PF-01', 4, 'core'], ['PF-02', 4, 'core'], ['NS-01', 4, 'core'], ['EN-02', 3, 'important']],
  'operations-support-work-control': [['CO-01', 3, 'core'], ['MP-01', 3, 'core'], ['HU-02', 3, 'core']],
  'outage-manager-planner': [['MP-01', 3, 'core'], ['LD-01', 3, 'core'], ['HU-02', 3, 'important'], ['RP-02', 2, 'important']],
  'maintenance-technician-engineer': [['MP-01', 3, 'core'], ['MP-02', 3, 'core'], ['HU-01', 3, 'core'], ['RP-01', 2, 'important'], ['QA-01', 2, 'useful']],
  'systems-design-plant-engineer': [['EN-01', 3, 'core'], ['EN-02', 3, 'core'], ['NS-01', 3, 'core'], ['PF-03', 3, 'important'], ['DA-01', 2, 'useful']],
  'reactor-engineer-core-physicist': [['PF-01', 4, 'core'], ['CO-03', 3, 'core'], ['NS-02', 3, 'important']],
  'nuclear-fuel-specialist': [['PF-01', 3, 'core'], ['QA-01', 2, 'important'], ['NS-02', 2, 'important']],
  'cyber-security-engineer': [['DA-01', 4, 'core'], ['DA-02', 3, 'important'], ['SA-01', 3, 'core']],
  'radiation-protection-technician': [['RP-01', 4, 'core'], ['RP-02', 3, 'core'], ['HU-01', 3, 'core'], ['CH-02', 2, 'useful']],
  'chemistry-technician': [['CH-01', 3, 'core'], ['CH-02', 3, 'core'], ['RP-01', 2, 'important']],
  'environmental-monitoring-specialist': [['CH-02', 3, 'core'], ['RP-01', 3, 'core']],
  'quality-assurance-qc': [['QA-01', 4, 'core'], ['QA-02', 3, 'core'], ['HU-01', 2, 'important']],
  'nuclear-oversight-npi': [['SC-01', 4, 'core'], ['NS-01', 3, 'core'], ['HU-01', 3, 'core']],
  'regulatory-affairs-licensing-engineer': [['NS-02', 4, 'core'], ['EN-01', 3, 'important']],
  'human-performance-specialist': [['HU-01', 4, 'core'], ['HU-02', 4, 'core'], ['SC-01', 4, 'core']],
  'ecp-officer': [['SC-01', 4, 'core'], ['SC-02', 3, 'important']],
  'industrial-health-safety-officer': [['HU-02', 3, 'core'], ['SC-01', 3, 'important']],
  'fire-protection': [['EP-02', 3, 'core'], ['HU-01', 2, 'important']],
  'emergency-preparedness-coordinator': [['EP-01', 4, 'core'], ['EP-02', 4, 'core'], ['NS-01', 2, 'important']],
  'security-officer': [['SA-01', 3, 'core'], ['HU-01', 2, 'important']],
  'safeguards-specialist': [['NS-02', 3, 'core'], ['QA-01', 2, 'important']],
  'nuclear-training-instructor': [['PF-03', 4, 'core'], ['CO-01', 4, 'core'], ['HU-01', 4, 'core'], ['LD-01', 3, 'important']],
  'procurement-engineer': [['QA-01', 3, 'core'], ['QA-02', 3, 'core'], ['DA-01', 2, 'useful']],
  'corporate-professional': [['SC-01', 2, 'important'], ['DA-01', 2, 'important'], ['LD-01', 2, 'useful'], ['DA-02', 2, 'useful']],
};
export function buildRoleCompetencies() {
  const out = [];
  for (const [role, list] of Object.entries(RC)) for (const [code, required_level, importance] of list) out.push({ id: `${role}--${code.toLowerCase()}`, role_id: role, competency_id: code.toLowerCase(), required_level, importance });
  return out;
}

// ───────────── Career paths with structured conditions (M01). Entry edges have from_role_id null.
const C = (kind, value, en, ar) => ({ kind, value, en, ar });
export function buildCareerPaths() {
  const p = [];
  const add = (o) => p.push({ sort: p.length + 1, basis: 'barakah', ...o });
  add({ id: 'entry-dnt-lo', from_role_id: null, from_label_en: 'DNT (24 months, UAE high-school graduates)', from_label_ar: 'دبلوم التكنولوجيا النووية (24 شهراً لخريجي الثانوية المواطنين)', to_role_id: 'local-operator', type: 'entry', route_code: 'dnt', label_en: 'Diploma in Nuclear Technology', label_ar: 'دبلوم التكنولوجيا النووية', conditions: [C('programme', 'DNT', 'Complete the 24-month DNT', 'إكمال دبلوم التكنولوجيا النووية لمدة 24 شهراً'), C('exam', 'written+jpm', 'Written exams and JPMs', 'اختبارات كتابية ومقاييس أداء وظيفي')], rule_ref: 'ENEC talent pipeline' });
  add({ id: 'entry-loit-lo', from_role_id: null, from_label_en: 'LOIT (60 weeks / 1,920 h, direct hires)', from_label_ar: 'التدريب الأولي للمشغّلين المحليين (60 أسبوعاً)', to_role_id: 'local-operator', type: 'entry', route_code: 'loit', label_en: 'Local Operator Initial Training', label_ar: 'التدريب الأولي للمشغّلين المحليين', conditions: [C('degree', 'high_school', 'High-school diploma', 'شهادة الثانوية العامة'), C('programme', 'LOIT', 'Complete LOIT (60 weeks / 1,920 h)', 'إكمال التدريب الأولي (60 أسبوعاً / 1,920 ساعة)')], rule_ref: 'FANR-REG-17 Art. 4 (LO: high-school diploma)' });
  add({ id: 'entry-gpo-lo', from_role_id: null, from_label_en: 'GPO (Emirati BSc engineering graduates)', from_label_ar: 'برنامج مشغّل المحطة للخريجين (خريجو الهندسة المواطنون)', to_role_id: 'local-operator', type: 'entry', route_code: 'gpo', label_en: 'Graduate Plant Operator', label_ar: 'مشغّل المحطة للخريجين', conditions: [C('degree', 'bachelor', 'BSc in engineering', 'بكالوريوس في الهندسة'), C('programme', 'GPO', 'Start as Local Operator; SRO training after three years', 'البدء كمشغّل محلي؛ تدريب المشغّل الأول بعد ثلاث سنوات')], rule_ref: 'ENEC GPO release (Aug 2025)' });
  add({ id: 'entry-exp-ro', from_role_id: null, from_label_en: 'Experienced hire (other plant or fossil)', from_label_ar: 'تعيين ذوي الخبرة (محطة أخرى أو محطة وقود أحفوري)', to_role_id: 'reactor-operator', type: 'entry', route_code: 'ro_other_plant', label_en: 'Experienced RO route', label_ar: 'مسار مشغّل المفاعل ذي الخبرة', conditions: [C('months', 24, '24 months as RO/SRO at another plant (or 24 at a fossil plant)', '24 شهراً كمشغّل في محطة أخرى (أو 24 في محطة أحفورية)'), C('months', 12, '12 months at Barakah incl. 6 on crew (9 for fossil route)', '12 شهراً في براكة منها 6 ضمن طاقم (9 لمسار المحطة الأحفورية)'), C('clearance', 'uae', 'UAE security clearance', 'تصريح أمني إماراتي')], rule_ref: 'FANR-REG-17 Art. 4' });
  add({ id: 'entry-exp-sro', from_role_id: null, from_label_en: 'Experienced hire (RO/SRO elsewhere)', from_label_ar: 'تعيين ذوي الخبرة (مشغّل في محطة أخرى)', to_role_id: 'senior-reactor-operator', type: 'entry', route_code: 'sro_other_plant', label_en: 'Experienced SRO route', label_ar: 'مسار المشغّل الأول ذي الخبرة', conditions: [C('months', 24, '24 months as RO, SRO or SRO-QI elsewhere', '24 شهراً كمشغّل أو مشغّل أول أو مدرب في مكان آخر'), C('months', 12, '12 months at Barakah incl. 6 on crew', '12 شهراً في براكة منها 6 ضمن طاقم'), C('clearance', 'uae', 'UAE security clearance', 'تصريح أمني إماراتي')], rule_ref: 'FANR-REG-17 Art. 4' });
  add({ id: 'lo-ro', from_role_id: 'local-operator', to_role_id: 'reactor-operator', type: 'vertical', route_code: 'ro_lo36', label_en: '36 months as qualified LO + COIT + FANR exams', label_ar: '36 شهراً كمشغّل محلي مؤهل + التدريب الأولي + اختبارات الهيئة', conditions: [C('months', 36, '36 months as a fully qualified LO', '36 شهراً كمشغّل محلي مؤهل تأهيلاً كاملاً'), C('programme', 'COIT', 'COIT (91 weeks / 2,912 h per SR2024; 82 weeks per CNS)', 'التدريب الأولي للمشغّلين المعتمدين (91 أسبوعاً وفق تقرير الاستدامة؛ 82 وفق تقرير الاتفاقية)'), C('exam', 'internal', 'Internal comprehensive exam: written, JPMs, simulator', 'الاختبار الداخلي الشامل: كتابي ومقاييس أداء ومحاكي'), C('exam', 'fanr', 'FANR written and operating exams (FANR notified 60 days ahead)', 'اختبارات الهيئة الكتابية والتشغيلية (إخطار الهيئة قبل 60 يوماً)'), C('clearance', 'uae', 'UAE security clearance', 'تصريح أمني إماراتي'), C('medical', 'within_6_months', 'Medical within 6 months of certification', 'فحص طبي خلال 6 أشهر من الاعتماد')], rule_ref: 'FANR-REG-17 Art. 4, 7, 10' });
  add({ id: 'ro-sro', from_role_id: 'reactor-operator', to_role_id: 'senior-reactor-operator', type: 'vertical', route_code: 'sro_ro24', label_en: '24 months as RO at Barakah + SRO exams', label_ar: '24 شهراً كمشغّل مفاعل في براكة + اختبارات المشغّل الأول', conditions: [C('months', 24, '24 months as RO at Barakah', '24 شهراً كمشغّل مفاعل في براكة'), C('programme', 'COIT-SRO', 'SRO-level COIT content and "Leading Effective Teams" (INTILAQA)', 'محتوى المشغّل الأول في التدريب الأولي و"قيادة فرق فعّالة" (انطلاقة)'), C('exam', 'fanr', 'FANR SRO written and operating exams', 'اختبارات الهيئة الكتابية والتشغيلية للمشغّل الأول'), C('clearance', 'uae', 'UAE security clearance', 'تصريح أمني إماراتي')], rule_ref: 'FANR-REG-17 Art. 4' });
  add({ id: 'lo-sro-bsc', from_role_id: 'local-operator', to_role_id: 'senior-reactor-operator', type: 'vertical', route_code: 'sro_bsc', label_en: 'Graduate route: BSc + 24 months at Barakah incl. 12 as LO', label_ar: 'مسار الخريجين: بكالوريوس + 24 شهراً في براكة منها 12 كمشغّل محلي', conditions: [C('degree', 'bachelor', 'BSc in engineering, engineering technology or a related science', 'بكالوريوس في الهندسة أو تكنولوجيا الهندسة أو علم ذي صلة'), C('months', 24, '24 months of nuclear work at Barakah', '24 شهراً من العمل النووي في براكة'), C('months', 12, 'including 12 months as LO', 'منها 12 شهراً كمشغّل محلي'), C('exam', 'fanr', 'FANR SRO exams', 'اختبارات الهيئة للمشغّل الأول'), C('clearance', 'uae', 'UAE security clearance', 'تصريح أمني إماراتي')], rule_ref: 'FANR-REG-17 Art. 4' });
  add({ id: 'sro-ss', from_role_id: 'senior-reactor-operator', to_role_id: 'shift-supervisor', type: 'vertical', basis: 'generic', route_code: 'appointment', label_en: 'Licensee appoints (SSG-75: 4-6 years\' experience)', label_ar: 'تعيين من المرخَّص له (SSG-75: خبرة 4-6 سنوات)', conditions: [C('appointment', 'licensee', 'Licensee appointment; holds SRO certificate', 'تعيين من المرخَّص له؛ يحمل شهادة مشغّل أول'), C('months', 48, 'SSG-75: 4-6 years\' experience, 2-3 at an operating plant, at least 1 on site', 'SSG-75: خبرة 4-6 سنوات منها 2-3 في محطة عاملة وسنة في الموقع'), C('programme', 'ESTADAD/ONE', 'Leadership: ESTADAD or Onwards to Nuclear Excellence', 'القيادة: استعداد أو نحو التميز النووي')], rule_ref: 'IAEA SSG-75 §3.28-3.34' });
  add({ id: 'sro-instructor', from_role_id: 'senior-reactor-operator', to_role_id: 'nuclear-training-instructor', type: 'lateral', route_code: 'asip', label_en: 'SRO-qualified instructor via ASIP', label_ar: 'مدرب مؤهل كمشغّل أول عبر برنامج ASIP', conditions: [C('programme', 'ASIP', 'Accelerated SRO Instructor Program', 'برنامج مدرب المشغّل الأول المعجل'), C('exam', 'biennial', 'Biennial requalification', 'إعادة التأهيل كل سنتين')], rule_ref: 'FANR-REG-17 Art. 1 (SRO Qualified Instructor)' });
  add({ id: 'ro-workcontrol', from_role_id: 'reactor-operator', to_role_id: 'operations-support-work-control', type: 'lateral', label_en: 'Move to work control', label_ar: 'الانتقال إلى التحكم في الأعمال', conditions: [C('programme', 'WC-QC', 'Work control qualification card', 'بطاقة تأهيل التحكم في الأعمال')] });
  add({ id: 'lo-workcontrol', from_role_id: 'local-operator', to_role_id: 'operations-support-work-control', type: 'lateral', label_en: 'Clearance writer route', label_ar: 'مسار محرر العزل', conditions: [C('programme', 'WC-QC', 'Clearance writer JPMs', 'مقاييس أداء محرر العزل')] });
  add({ id: 'sro-outage', from_role_id: 'senior-reactor-operator', to_role_id: 'outage-manager-planner', type: 'cross_functional', label_en: 'Operations to outage management', label_ar: 'من العمليات إلى إدارة فترات الإيقاف', conditions: [C('programme', 'WM', 'Work management training', 'تدريب إدارة الأعمال')] });
  add({ id: 'eng-sta', from_role_id: 'systems-design-plant-engineer', to_role_id: 'shift-technical-advisor', type: 'cross_functional', basis: 'uncertain', label_en: 'Engineer to STA (structure unconfirmed)', label_ar: 'من مهندس إلى مستشار فني للوردية (الهيكل غير مؤكد)', conditions: [C('degree', 'bachelor', 'University degree', 'شهادة جامعية'), C('programme', 'transient', 'Transient and accident analysis training', 'تدريب على تحليل الحالات العابرة والحوادث')], rule_ref: 'IAEA SSG-75 §3.17' });
  add({ id: 'maint-tech-eng', from_role_id: 'maintenance-technician-engineer', to_role_id: 'systems-design-plant-engineer', type: 'cross_functional', label_en: 'Maintenance to systems engineering', label_ar: 'من الصيانة إلى هندسة الأنظمة', conditions: [C('degree', 'bachelor', 'Engineering degree', 'شهادة في الهندسة'), C('programme', 'ENG-INIT', 'Engineering initial training (20 weeks / 640 h)', 'التدريب الهندسي الأولي (20 أسبوعاً / 640 ساعة)')] });
  add({ id: 'maint-outage', from_role_id: 'maintenance-technician-engineer', to_role_id: 'outage-manager-planner', type: 'lateral', label_en: 'Maintenance to outage planning', label_ar: 'من الصيانة إلى تخطيط فترات الإيقاف', conditions: [C('programme', 'WM', 'Work management training', 'تدريب إدارة الأعمال')] });
  add({ id: 'rp-env', from_role_id: 'radiation-protection-technician', to_role_id: 'environmental-monitoring-specialist', type: 'lateral', label_en: 'RP to environmental monitoring', label_ar: 'من الوقاية من الإشعاع إلى الرصد البيئي', conditions: [C('programme', 'ENV', 'Environmental monitoring qualification', 'تأهيل الرصد البيئي')] });
  add({ id: 'chem-env', from_role_id: 'chemistry-technician', to_role_id: 'environmental-monitoring-specialist', type: 'lateral', label_en: 'Chemistry to environmental monitoring', label_ar: 'من الكيمياء إلى الرصد البيئي', conditions: [C('programme', 'ENV', 'Environmental monitoring qualification', 'تأهيل الرصد البيئي')] });
  add({ id: 'qa-procurement', from_role_id: 'quality-assurance-qc', to_role_id: 'procurement-engineer', type: 'cross_functional', label_en: 'Quality to supplier quality and procurement', label_ar: 'من الجودة إلى جودة الموردين والمشتريات', conditions: [C('programme', 'CGD', 'Commercial-grade dedication training', 'تدريب اعتماد المواد التجارية')] });
  add({ id: 'ops-hu', from_role_id: 'reactor-operator', to_role_id: 'human-performance-specialist', type: 'cross_functional', label_en: 'Operations to human performance', label_ar: 'من العمليات إلى الأداء البشري', conditions: [C('programme', 'HU-INSTR', 'HU instructor qualification', 'تأهيل مدرب الأداء البشري')] });
  add({ id: 'ops-npi', from_role_id: 'senior-reactor-operator', to_role_id: 'nuclear-oversight-npi', type: 'cross_functional', label_en: 'Operations to independent oversight', label_ar: 'من العمليات إلى الرقابة المستقلة', conditions: [C('programme', 'WANO-SA', 'WANO self-assessment training', 'تدريب التقييم الذاتي لدى WANO')] });
  add({ id: 'eng-licensing', from_role_id: 'systems-design-plant-engineer', to_role_id: 'regulatory-affairs-licensing-engineer', type: 'lateral', label_en: 'Engineering to licensing', label_ar: 'من الهندسة إلى الترخيص', conditions: [C('programme', 'LIC', 'Licensing basis training', 'تدريب أساس الترخيص')] });
  add({ id: 'eng-reactor', from_role_id: 'systems-design-plant-engineer', to_role_id: 'reactor-engineer-core-physicist', type: 'lateral', basis: 'generic', label_en: 'Systems to reactor engineering', label_ar: 'من الأنظمة إلى هندسة المفاعل', conditions: [C('degree', 'master', 'MSc preferred (e.g. KU MSc in Nuclear Engineering)', 'يفضَّل الماجستير (مثل ماجستير الهندسة النووية في جامعة خليفة)')] });
  add({ id: 'fire-ep', from_role_id: 'fire-protection', to_role_id: 'emergency-preparedness-coordinator', type: 'lateral', label_en: 'Fire protection to emergency preparedness', label_ar: 'من الحماية من الحرائق إلى التأهب للطوارئ', conditions: [C('programme', 'ERO', 'ERO role training; TAHYAA', 'تدريب أدوار منظمة الاستجابة؛ مؤهل تهيأ')], rule_ref: 'FANR-REG-12 Art. 23' });
  add({ id: 'hse-hu', from_role_id: 'industrial-health-safety-officer', to_role_id: 'human-performance-specialist', type: 'lateral', label_en: 'H&S to human performance', label_ar: 'من الصحة والسلامة إلى الأداء البشري', conditions: [C('programme', 'HU-INSTR', 'HU instructor qualification', 'تأهيل مدرب الأداء البشري')] });
  add({ id: 'corp-procurement', from_role_id: 'corporate-professional', to_role_id: 'procurement-engineer', type: 'cross_functional', label_en: 'Corporate to supply chain', label_ar: 'من الخدمات المؤسسية إلى سلسلة الإمداد', conditions: [C('programme', 'NQA1', 'NQA-1 awareness', 'الإلمام بمعيار NQA-1')] });
  add({ id: 'cyber-instr', from_role_id: 'cyber-security-engineer', to_role_id: 'nuclear-training-instructor', type: 'cross_functional', label_en: 'Specialist instructor (cyber awareness)', label_ar: 'مدرب متخصص (الوعي السيبراني)', conditions: [C('programme', 'INSTR', 'Instructor Initial Qualification', 'التأهيل الأولي للمدربين')] });
  return p;
}
