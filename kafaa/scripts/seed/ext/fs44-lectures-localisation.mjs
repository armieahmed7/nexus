// FS44 + FS45 (future-skills wave E · E3, M24) seed: the expert lecture library, expert contributions, and the localisation countdown.
// buildRows(): (called first in finalize, after F20's finalize has built the KLRA positions and assets) 17 lectures (synthetic metadata: speakers are synthetic workers or role cards; recordings are REC- codes, never real
//             media) linked to skills and, where the speaker holds one, to their KLRA position (resolved with resolvePosition, as the
//             RPC does); 27 contributions (6 validated, 6 pending and 2 rejected lecture contributions; 13 pending knowledge-asset
//             contributions for the SME and the author of every published F21 asset); 16 localisation items (SAMPLE plan) with
//             targets no later than 2030-12-31. Every lecture passes lectureProblem and every item the status rule.
// finalize(): FINALIZE_LAST and, by file name, after fs36 and before the fsqa builders: writes the F01 evidence of the validated
//             contributions (kind rating, basis validated, ref_table lectures, level 3 for speakers), re-derives the states of the people
//             concerned, rebuilds the F36 digests, F23 snapshots and F35 outlooks from the final states (as fs36 does), and fails the
//             build if any original 71-skill state changes (validated seed contributions evidence FS02 future skills only) or a
//             transferred localisation item is not covered by the computed readiness.
// Synthetic people only; no real recordings; the localisation plan is illustrative, not an ENEC or partner commitment.
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import { hasContactDetails, postGuard } from '../../../src/modules/m22/domain.ts';
import { currencyView, deriveStage, initialDoneOn } from '../../../src/modules/m02/instructors.ts';
import { contributionEvidenceId, contributionId, contributorsOf, evidenceSkills, lectureProblem, levelFor, resolvePosition } from '../../../src/modules/m24/lectures.ts';
import { TARGET_MAX, computeBoard, statusProblem } from '../../../src/modules/m24/localisation.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true;
const KM = 'p-training-mgr';

/** [id, speaker, format, lang, delivered_on, minutes, family, skills, status, contribution, decided_on, title_en, title_ar, abstract_en, abstract_ar, chapters "min|en|ar;..."] */
export const LECTURES = [
  ['lec-001', 'w-mnt-01', 'masterclass', 'en', '2026-05-14', 55, 'i_and_c', ['sk-fs-dp-dic', 'sk-fs-dp-ework'], 'published', 'validated', '2026-06-02',
    'Digital I&C for maintainers: what changes after the analogue cards', 'أنظمة القياس والتحكم الرقمية لفنيي الصيانة: ما الذي يتغير بعد البطاقات التناظرية',
    'A senior maintainer walks through how fault finding changes when protection and control move from analogue cards to digital platforms: self-diagnostics, configuration control, and why the electronic work package becomes the record of what was touched.',
    'يشرح فني صيانة أول كيف يتغير تحديد الأعطال عندما تنتقل أنظمة الحماية والتحكم من البطاقات التناظرية إلى المنصات الرقمية: التشخيص الذاتي، وضبط التهيئة، ولماذا تصبح حزمة العمل الإلكترونية سجلاً لكل ما جرى العمل عليه.',
    '0|Why digital I&C changes the job|لماذا تغير الأنظمة الرقمية طبيعة العمل;14|Self-diagnostics and what they do not tell you|التشخيص الذاتي وما لا يخبرك به;31|Configuration control in practice|ضبط التهيئة عملياً;46|The electronic work package as the record|حزمة العمل الإلكترونية بوصفها السجل'],
  ['lec-002', 'w-ss-01', 'talk', 'en', '2026-06-18', 40, 'reactor_core', ['sk-fs-adv-multimodule'], 'published', 'validated', '2026-07-01',
    'One control room, several modules: operating concepts explained', 'غرفة تحكم واحدة لعدة وحدات: شرح مفاهيم التشغيل',
    'A shift supervisor compares crew work on a large unit with the multi-module operating concepts published for small modular reactors: shared displays, staffing questions and how shift turnover would need to change. Concepts only; no deployment decision is implied.',
    'يقارن مشرف مناوبة عمل الطاقم في وحدة كبيرة بمفاهيم تشغيل الوحدات المتعددة المنشورة للمفاعلات المعيارية الصغيرة: الشاشات المشتركة، وأسئلة التوظيف، وكيف ينبغي أن يتغير تسليم المناوبة. مفاهيم فقط ولا يترتب على ذلك أي قرار بالنشر.',
    '0|Crew roles on a large unit today|أدوار الطاقم في الوحدة الكبيرة اليوم;12|What multi-module operation means|ما المقصود بتشغيل الوحدات المتعددة;25|Turnover and situational awareness|تسليم المناوبة والوعي بالموقف'],
  ['lec-003', 'w-qa-01', 'walkthrough', 'en', '2026-07-09', 45, 'maintenance', ['sk-fs-adv-factoryqa'], 'published', 'validated', '2026-07-20',
    'Factory fabrication QA: inspecting a module before it ships', 'ضمان الجودة في التصنيع بالمصنع: فحص الوحدة قبل شحنها',
    'How receiving inspection habits carry over when large components are built and tested in a factory: hold points at the supplier, witness inspections, and the documents a site team should expect to receive with a finished module.',
    'كيف تنتقل عادات فحص الاستلام عندما تُصنع المكونات الكبيرة وتُختبر في المصنع: نقاط التوقف لدى المورد، وعمليات الفحص بالحضور، والوثائق التي ينبغي أن يتسلمها فريق الموقع مع الوحدة المكتملة.',
    '0|From receiving inspection to the factory floor|من فحص الاستلام إلى أرض المصنع;15|Hold points and witness inspections|نقاط التوقف والفحص بالحضور;32|What arrives with the module|ما يصل مع الوحدة'],
  ['lec-004', 'w-chem-01', 'talk', 'ar', '2026-08-05', 35, 'chemistry', ['sk-fs-gr-circular', 'sk-fs-tr-environment'], 'published', 'validated', '2026-08-19',
    'Waste stewardship and circularity in plant chemistry', 'الإشراف على النفايات والاقتصاد الدائري في كيمياء المحطة',
    'A chemist explains how resin, filter and chemical use decisions shape the volume of waste the plant produces, and which small habits in the laboratory and on the systems reduce it over a fuel cycle.',
    'تشرح كيميائية كيف تحدد قرارات استخدام الراتنجات والمرشحات والمواد الكيميائية حجم النفايات التي تنتجها المحطة، وما العادات الصغيرة في المختبر وعلى الأنظمة التي تقللها على مدى دورة الوقود.',
    '0|Where chemistry waste comes from|من أين تأتي نفايات الكيمياء;10|Resins and filters: choices that matter|الراتنجات والمرشحات: خيارات مؤثرة;22|Habits that reduce volume|عادات تقلل الحجم'],
  ['lec-005', 'w-mnt-02', 'walkthrough', 'en', '2026-08-27', 50, 'outage', ['sk-fs-dp-robotics'], 'published', 'validated', '2026-09-10',
    'Robots and remote inspection during an outage', 'الروبوتات والفحص عن بعد خلال فترة الصيانة',
    'An outage maintainer shares what changed when crawler and submersible tools took over some inspections: planning the deployment, keeping dose low, reviewing the video record and deciding when a person still needs to look.',
    'يشارك فني صيانة كيف تغير العمل حين تولت أدوات الزحف والأدوات المغمورة بعض عمليات الفحص: تخطيط الاستخدام، وخفض الجرعة الإشعاعية، ومراجعة التسجيل المرئي، وتحديد متى ما زال على الإنسان أن ينظر بنفسه.',
    '0|Which inspections moved to remote tools|أي عمليات الفحص انتقلت إلى الأدوات عن بعد;13|Planning a deployment|تخطيط الاستخدام;28|Reviewing the record|مراجعة التسجيل;41|When a person still looks|متى ينظر الإنسان بنفسه'],
  ['lec-006', 'p-sme-reviewer', 'masterclass', 'en', '2026-09-03', 60, 'electrical', ['sk-fs-gr-grid'], 'published', 'validated', '2026-09-17',
    'Grid integration and flexible operation: the plant engineer\'s view', 'التكامل مع الشبكة والتشغيل المرن: منظور مهندس المحطة',
    'Why grid operators ask nuclear plants about flexibility, what load following means for margins and equipment, and the engineering questions a utility studies before it changes how a unit is dispatched. Based on published studies; no ENEC operating plan is implied.',
    'لماذا يسأل مشغلو الشبكات محطات الطاقة النووية عن المرونة، وما معنى متابعة الأحمال بالنسبة للهوامش والمعدات، والأسئلة الهندسية التي تدرسها شركة المرافق قبل تغيير طريقة تشغيل الوحدة. يستند إلى دراسات منشورة ولا يعني أي خطة تشغيل لدى المؤسسة.',
    '0|What the grid needs from baseload plants|ما تحتاجه الشبكة من محطات الحمل الأساسي;18|Load following and margins|متابعة الأحمال والهوامش;37|Questions before changing dispatch|أسئلة قبل تغيير التشغيل'],
  ['lec-007', 'w-eng-01', 'talk', 'en', '2026-09-24', 45, 'secondary', ['sk-fs-gr-lifecycle'], 'published', 'pending', null,
    'Lifecycle carbon of a nuclear plant, from concrete to decommissioning', 'البصمة الكربونية لمحطة نووية على مدى عمرها من الخرسانة إلى الإيقاف النهائي',
    'An engineer walks through how lifecycle assessments count emissions for a nuclear plant: construction materials, fuel supply, operation and decommissioning, and why the method matters when results are compared.',
    'يشرح مهندس كيف تحسب تقييمات دورة الحياة الانبعاثات لمحطة نووية: مواد البناء وإمداد الوقود والتشغيل والإيقاف النهائي، ولماذا تهم المنهجية عند مقارنة النتائج.',
    '0|What a lifecycle assessment counts|ما يحسبه تقييم دورة الحياة;15|Construction and fuel supply|البناء وإمداد الوقود;30|Comparing results fairly|مقارنة النتائج بإنصاف'],
  ['lec-008', 'w-rp-02', 'talk', 'ar', '2026-09-29', 40, 'radiation_protection', ['sk-rp-01', 'sk-fs-tr-environment'], 'published', 'pending', null,
    'Keeping dose low: lessons from twenty outages', 'إبقاء الجرعة منخفضة: دروس من عشرين فترة صيانة',
    'A radiation protection technician shares the planning habits that kept collective dose down across many outages: pre-job briefings, shielding decisions, time in the field and what to log so the next crew learns from it.',
    'تشارك فنية الوقاية من الإشعاع عادات التخطيط التي أبقت الجرعة الجماعية منخفضة عبر فترات صيانة كثيرة: إحاطات ما قبل العمل، وقرارات التدريع، والوقت في الميدان، وما يجب تدوينه ليتعلم منه الطاقم التالي.',
    '0|Planning before the job|التخطيط قبل العمل;12|Shielding and time in the field|التدريع والوقت في الميدان;27|What to log for the next crew|ما يجب تدوينه للطاقم التالي'],
  ['lec-009', 'w-sro-01', 'panel', 'en', '2026-10-01', 55, 'human_performance', ['sk-fs-dp-rounds', 'sk-co-01'], 'published', 'pending', null,
    'Shift turnover with digital rounds: what the log still needs', 'تسليم المناوبة مع الجولات الرقمية: ما الذي يحتاجه السجل',
    'A senior reactor operator and colleagues discuss how handheld rounds change the turnover conversation: what the device records well, what it misses, and the questions an oncoming operator should still ask face to face.',
    'يناقش مشغل مفاعل أول وزملاؤه كيف تغير الجولات المحمولة حوار تسليم المناوبة: ما يسجله الجهاز جيداً وما يفوته، والأسئلة التي ينبغي أن يطرحها المشغل القادم وجهاً لوجه.',
    '0|What digital rounds record|ما تسجله الجولات الرقمية;16|What they miss|ما تفوته;34|Questions to ask face to face|أسئلة تُطرح وجهاً لوجه'],
  ['lec-010', 'p-nse', 'talk', 'en', '2026-09-16', 35, 'reactor_core', ['sk-fs-adv-fuelcycle'], 'published', 'pending', null,
    'Advanced fuel cycles: what a specification engineer should know', 'دورات الوقود المتقدمة: ما ينبغي أن يعرفه مهندس المواصفات',
    'An introduction to the fuel forms discussed for advanced reactors and what they would mean for procurement specifications and supplier qualification. Awareness level; no deployment decision is implied.',
    'مقدمة عن أشكال الوقود المطروحة للمفاعلات المتقدمة وما قد تعنيه لمواصفات الشراء وتأهيل الموردين. على مستوى التوعية ولا يترتب على ذلك أي قرار بالنشر.',
    '0|Fuel forms in the advanced-reactor literature|أشكال الوقود في أدبيات المفاعلات المتقدمة;12|What changes in a specification|ما يتغير في المواصفات;24|Supplier qualification questions|أسئلة تأهيل الموردين'],
  ['lec-011', 'w-fire-01', 'walkthrough', 'ar', '2026-09-15', 30, 'emergency_preparedness', ['sk-ep-02-fire'], 'published', 'pending', null,
    'Fire protection walkdowns: reading the plant', 'جولات الحماية من الحريق: قراءة المحطة',
    'A fire protection specialist shows how to walk a building with fresh eyes: combustible loading, transient materials after maintenance, and the small signs that a fire barrier needs attention.',
    'يوضح متخصص في الحماية من الحريق كيف يتجول في المبنى بعين جديدة: الأحمال القابلة للاشتعال، والمواد المؤقتة بعد الصيانة، والعلامات الصغيرة التي تدل على أن حاجز الحريق يحتاج إلى عناية.',
    '0|Walking with fresh eyes|التجول بعين جديدة;9|Transient materials after maintenance|المواد المؤقتة بعد الصيانة;19|Fire barriers that need attention|حواجز الحريق التي تحتاج إلى عناية'],
  ['lec-012', 'w-eng-05', 'talk', 'en', '2026-07-22', 50, 'reactor_core', ['sk-pf-01-core'], 'published', 'rejected', '2026-08-04',
    'Startup physics tests: notes from the core', 'اختبارات فيزياء بدء التشغيل: ملاحظات من القلب',
    'A core physicist explains what the low-power physics tests confirm after refuelling, how the measured values are compared with predictions, and what the team does when a result sits near its acceptance band.',
    'يشرح فيزيائي القلب ما تؤكده اختبارات الفيزياء عند القدرة المنخفضة بعد إعادة التزويد بالوقود، وكيف تقارن القيم المقيسة بالتوقعات، وما يفعله الفريق حين تقترب نتيجة من حدود القبول.',
    '0|Why the tests are run|لماذا تُجرى الاختبارات;14|Measured against predicted|المقيس مقابل المتوقع;33|Results near the band|نتائج قريبة من الحدود'],
  ['lec-013', 'w-ep-01', 'talk', 'en', '2026-09-30', 40, 'emergency_preparedness', ['sk-ep-01'], 'review', null, null,
    'Designing a drill from the controller\'s seat', 'تصميم تمرين الطوارئ من مقعد المتحكم',
    'An emergency preparedness coordinator explains how a drill scenario is built so that it tests decisions rather than memory: objectives first, realistic timelines, and the evaluation points the controllers watch for.',
    'يشرح منسق التأهب للطوارئ كيف يُبنى سيناريو التمرين بحيث يختبر القرارات لا الحفظ: الأهداف أولاً، والجداول الزمنية الواقعية، ونقاط التقييم التي يراقبها المتحكمون.',
    '0|Objectives before the scenario|الأهداف قبل السيناريو;13|Realistic timelines|جداول زمنية واقعية;27|What controllers evaluate|ما يقيمه المتحكمون'],
  ['lec-014', 'p-qc-inspector', 'walkthrough', 'en', '2026-10-05', 30, 'maintenance', ['sk-fs-dp-procurement', 'sk-qa-01'], 'review', null, null,
    'Digital procurement and the receiving inspection', 'الشراء الرقمي وفحص الاستلام',
    'A quality inspector shows how supplier documents arriving through a digital procurement portal change the receiving inspection: what can be checked before the item arrives and what must still be checked on the item itself.',
    'يوضح مفتش جودة كيف تغير وثائق الموردين الواردة عبر بوابة الشراء الرقمية فحص الاستلام: ما يمكن التحقق منه قبل وصول القطعة وما يجب التحقق منه على القطعة نفسها.',
    '0|Documents before the item|الوثائق قبل القطعة;11|Checks on the item itself|الفحوص على القطعة نفسها'],
  ['lec-015', 'p-sro', 'talk', 'en', '2026-09-21', 30, 'reactor_core', ['sk-fs-adv-micro'], 'draft', null, null,
    'Microreactors and transportable units: concepts for operators', 'المفاعلات الدقيقة والوحدات القابلة للنقل: مفاهيم للمشغلين',
    'A shift supervisor\'s draft notes on the operating concepts published for microreactors and transportable units, and the questions they raise for crew training. Concepts only; no deployment decision is implied.',
    'مسودة ملاحظات مشرف مناوبة حول مفاهيم التشغيل المنشورة للمفاعلات الدقيقة والوحدات القابلة للنقل، والأسئلة التي تثيرها لتدريب الأطقم. مفاهيم فقط ولا يترتب على ذلك أي قرار بالنشر.',
    '0|What a microreactor is|ما المفاعل الدقيق;10|Questions for crew training|أسئلة لتدريب الأطقم'],
  ['lec-016', 'w-corp-01', 'talk', 'en', '2026-06-25', 35, 'training', ['sk-fs-gr-climaterisk'], 'withdrawn', 'rejected', '2026-07-08',
    'Answering stakeholder questions on nuclear and climate', 'الإجابة عن أسئلة أصحاب المصلحة حول الطاقة النووية والمناخ',
    'A communications professional shares how to answer common questions about nuclear energy and climate with sourced facts, and when to refer a question to a subject matter expert.',
    'تشارك مختصة في الاتصال كيفية الإجابة عن الأسئلة الشائعة حول الطاقة النووية والمناخ بحقائق موثقة، ومتى تُحال المسألة إلى خبير متخصص.',
    '0|Common questions|أسئلة شائعة;12|Answering with sourced facts|الإجابة بحقائق موثقة;25|When to refer to an expert|متى تُحال المسألة إلى خبير'],
  ['lec-017', 'p-presenter', 'talk', 'en', '2026-09-09', 35, 'training', ['sk-fs-tr-dependable', 'sk-fs-dp-ework'], 'published', 'pending', null,
    'Records an independent reviewer can follow', 'سجلات يستطيع المراجع المستقل تتبّعها',
    'What makes a work record easy to review months later: who did what, against which revision, with what result, and how electronic work packages help or hide that trail. Drawn from a reviewer\'s side of the table.',
    'ما الذي يجعل سجل العمل سهل المراجعة بعد أشهر: من قام بماذا، ووفق أي مراجعة، وبأي نتيجة، وكيف تساعد حزم العمل الإلكترونية في إظهار هذا الأثر أو تخفيه. من منظور المراجع.',
    '0|Who, what, which revision|من وماذا ووفق أي مراجعة;12|Electronic packages: help or hide|الحزم الإلكترونية: تساعد أم تخفي;24|Writing for the next reader|الكتابة للقارئ التالي'],
];
const REJECT_NOTE = {
  'lec-012': 'The recording follows a vendor training module closely; resubmit with your own worked examples from the last refuelling so it can count as your contribution.',
  'lec-016': 'Withdrawn by the speaker before validation; an updated recording is planned.',
};
const VALIDATE_NOTE = 'Content checked against the linked skills; recorded expert practice, reviewed for accuracy.';

/** [id, programme, partner org, scope, standards, discipline, needed, baseline, target, status, sort, title_en, title_ar, partner_role_en, partner_role_ar, note] */
export const LOC_ITEMS = [
  ['loc-loit-watch', 'loit', 'kepco-kps', 'both', ['qs-lo-turbine', 'qs-lo-aux'], 'Operations', 4, '2024-01-15', '2026-06-30', 'uae_led_supervised', 1,
    'Local operator watch-station instruction and final walk-through', 'تدريب محطات مراقبة المشغل المحلي والجولة النهائية', 'Co-delivers the watch-station modules and signs off the final walk-through', 'يشارك في تقديم وحدات محطات المراقبة ويعتمد الجولة النهائية', 'In-house instructors deliver; partner sign-off remains on the final walk-through'],
  ['loc-rp-initial', 'rp-init', 'khnp', 'delivery', ['qs-rp'], 'Radiation Protection', 3, '2024-01-15', '2026-09-30', 'uae_led_supervised', 2,
    'Radiation protection initial training: field practicals', 'التدريب الأولي على الوقاية من الإشعاع: التطبيقات الميدانية', 'Supervises the field practicals', 'يشرف على التطبيقات الميدانية', 'One in-house instructor lapsed on currency in August'],
  ['loc-ero-drills', 'ero', 'khnp', 'signoff', ['qs-ero'], 'Emergency Preparedness', 1, '2024-01-15', '2026-03-31', 'transferred', 3,
    'Emergency response organisation drill evaluation', 'تقييم تمارين منظمة الاستجابة للطوارئ', 'Signed off drill evaluations until the transfer', 'اعتمد تقييمات التمارين حتى النقل', 'Transferred: in-house evaluator qualified and current'],
  ['loc-fire-brigade', 'ero', 'kepco-kps', 'delivery', ['qs-fire'], 'Fire Protection', 1, '2024-01-15', '2026-06-30', 'transferred', 4,
    'Fire brigade qualification practicals', 'التطبيقات العملية لتأهيل فرقة الإطفاء', 'Delivered the practicals until the transfer', 'قدّم التطبيقات العملية حتى النقل', 'Transferred: in-house instructor qualified and current'],
  ['loc-qa-auditor', 'mgmt-cert', 'kepco-ec', 'signoff', ['qs-qa'], 'Quality', 2, '2024-06-01', '2026-12-31', 'uae_led_supervised', 5,
    'QA auditor qualification sign-off', 'اعتماد تأهيل مدققي ضمان الجودة', 'Countersigns the auditor qualification', 'يوقّع بالمصادقة على تأهيل المدققين', 'In-house auditors deliver; partner countersignature until the transfer'],
  ['loc-chem-initial', 'chem-init', 'kepco-kps', 'delivery', ['qs-chem'], 'Chemistry', 2, '2024-06-01', '2027-03-31', 'co_delivery', 6,
    'Chemistry technician initial training: laboratory modules', 'التدريب الأولي لفنيي الكيمياء: وحدات المختبر', 'Co-delivers the laboratory modules', 'يشارك في تقديم وحدات المختبر', ''],
  ['loc-sro-exam', 'coit', 'khnp', 'signoff', ['qs-sro'], 'Operations', 3, '2024-06-01', '2027-06-30', 'partner_led', 7,
    'Senior reactor operator certification exam preparation and sign-off', 'التحضير لامتحان اعتماد مشغل المفاعل الأول واعتماده', 'Delivers the exam preparation and signs off readiness', 'يقدّم التحضير للامتحان ويعتمد الجاهزية', ''],
  ['loc-instr-qual', 'instr-qual', 'wano-ac', 'delivery', ['qs-instr'], 'Nuclear Training', 2, '2024-06-01', '2027-06-30', 'co_delivery', 8,
    'Instructor initial qualification course', 'دورة التأهيل الأولي للمدربين', 'Co-delivers the instructor course', 'يشارك في تقديم دورة المدربين', ''],
  ['loc-maint-mech', 'maint-init', 'kepco-kps', 'delivery', ['qs-mech'], 'Maintenance', 3, '2024-06-01', '2027-12-31', 'co_delivery', 9,
    'Mechanical maintenance initial training: workshop phase', 'التدريب الأولي للصيانة الميكانيكية: مرحلة الورشة', 'Co-delivers the workshop phase', 'يشارك في تقديم مرحلة الورشة', ''],
  ['loc-eng-initial', 'eng-init', 'kepco-ec', 'delivery', ['qs-eng'], 'Engineering', 3, '2024-06-01', '2027-12-31', 'co_delivery', 10,
    'Systems engineering initial training: design basis modules', 'التدريب الأولي لهندسة الأنظمة: وحدات أساس التصميم', 'Co-delivers the design basis modules', 'يشارك في تقديم وحدات أساس التصميم', ''],
  ['loc-maint-elec', 'maint-init', 'kepco-kps', 'delivery', ['qs-elec'], 'Maintenance', 2, '2024-06-01', '2028-06-30', 'partner_led', 11,
    'Electrical maintenance initial training: switchgear practicals', 'التدريب الأولي للصيانة الكهربائية: تطبيقات لوحات التوزيع', 'Delivers the switchgear practicals', 'يقدّم تطبيقات لوحات التوزيع', ''],
  ['loc-coit-sim', 'coit', 'khnp', 'delivery', ['qs-ro', 'qs-sro'], 'Operations', 6, '2024-01-15', '2028-12-31', 'co_delivery', 12,
    'Certified operator initial training: simulator phase instruction', 'التدريب الأولي للمشغل المعتمد: تدريس مرحلة المحاكي', 'Co-delivers the simulator phase', 'يشارك في تقديم مرحلة المحاكي', ''],
  ['loc-maint-ic', 'maint-init', 'doosan', 'delivery', ['qs-ic'], 'Maintenance', 2, '2024-06-01', '2029-06-30', 'partner_led', 13,
    'I&C maintenance initial training: digital platform modules', 'التدريب الأولي لصيانة أنظمة القياس والتحكم: وحدات المنصة الرقمية', 'Delivers the digital platform modules', 'يقدّم وحدات المنصة الرقمية', 'No in-house instructor track yet'],
  ['loc-severe-sim', 'severe-accident', 'khnp', 'delivery', ['qs-sro'], 'Operations', 2, '2024-06-01', '2029-12-31', 'partner_led', 14,
    'Severe-accident simulator scenarios', 'سيناريوهات المحاكي للحوادث الشديدة', 'Delivers the severe-accident scenarios', 'يقدّم سيناريوهات الحوادث الشديدة', ''],
  ['loc-apr1400', 'apr1400', 'kepco-ec', 'delivery', ['qs-eng', 'qs-ro'], 'Engineering', 4, '2024-06-01', '2030-06-30', 'partner_led', 15,
    'APR1400 systems course', 'دورة أنظمة APR1400', 'Delivers the systems course', 'يقدّم دورة الأنظمة', ''],
  ['loc-exec-sim', 'exec-sim', 'khnp', 'delivery', ['qs-sro'], 'Operations', 1, '2024-06-01', '2030-12-31', 'on_hold', 16,
    'Executive simulator course', 'دورة المحاكي للقيادات التنفيذية', 'Delivers the executive simulator course', 'يقدّم دورة المحاكي للقيادات', 'On hold until the simulator instructor pipeline grows'],
];

const day = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** F31 track states as kafaa_ins_stage / kafaa_ins_currency compute them (M02 rules). */
export function trackStatesFrom(T, on) {
  return T.instructor_tracks.map((t) => {
    const init = initialDoneOn(t.person_id, t.route, T.training_records);
    const stage = deriveStage(t, T.instructor_observations.filter((o) => o.track_id === t.id), init);
    const cur = currencyView(t, T.teaching_hours.filter((x) => x.person_id === t.person_id).map((x) => ({ ...x, hours: Number(x.hours) })), on);
    return { id: t.id, person_id: t.person_id, status: t.status, stage, discipline: t.discipline ?? '', standard_ids: [...(t.standard_ids ?? [])], currency: cur?.status ?? null };
  });
}

export default function build(T) {
  T.lectures = [];
  T.contributions = [];
  T.localisation_items = [];
}

/** Lectures, contributions and the localisation plan (run from finalize: F20 builds the KLRA positions and assets in its own finalize). */
export function buildRows(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const skills = new Map(T.skills.map((s) => [s.id, { id: s.id, area: s.area, competency_id: s.competency_id, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const secComps = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
  const policies = T.refusal_policies.map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  const name = (id) => { const p = people.get(id); if (!p) throw new Error(`fs44: person ${id} missing`); return { en: p.display_name, ar: p.display_name_ar || p.display_name }; };
  T.lectures = [];
  T.contributions = [];
  let rec = 0;
  for (const [id, speaker, format, lang, delivered, minutes, family, skillIds, status, contrib, decided, ten, tar, aen, aar, chap] of LECTURES) {
    const sp = people.get(speaker);
    if (!sp || sp.kind !== 'staff' || sp.status !== 'active') throw new Error(`fs44: speaker ${speaker} is not active staff`);
    const positions = T.klra_positions.filter((p) => p.person_id === speaker && p.active).map((p) => ({ id: p.id, person_id: p.person_id, family_id: p.family_id, active: true, title_en: p.title_en, title_ar: p.title_ar }));
    const pos = resolvePosition(null, positions);
    if (pos === false) throw new Error(`fs44: ${id} position`);
    const chapters = chap.split(';').map((c) => { const [at, en, ar] = c.split('|'); return { at: Number(at), en, ar }; });
    const recording_code = status === 'draft' ? null : `REC-2026-${String(++rec).padStart(3, '0')}`;
    const input = { title_en: ten, title_ar: tar, abstract_en: aen, abstract_ar: aar, format, lang, delivered_on: delivered, duration_min: minutes, skill_ids: skillIds, system_family: family, chapters, recording_code };
    const bad = lectureProblem(input, { skills, secComps, position: pos, speakerPositions: positions, guard: (t) => postGuard(t, policies), contact: hasContactDetails, today });
    if (bad) throw new Error(`fs44: lecture ${id} fails the lecture check (${bad.code}: ${bad.message})`);
    const submitted = day(delivered, 3);
    const publishedOn = status === 'published' || status === 'withdrawn' ? day(delivered, 7) : null;
    const history = [{ at: `${submitted}T09:00:00Z`, status: 'review', by: speaker, note: null }];
    if (status === 'draft') history.splice(0, 1, { at: `${submitted}T09:00:00Z`, status: 'draft', by: speaker, note: null });
    if (publishedOn) history.push({ at: `${publishedOn}T10:00:00Z`, status: 'published', by: KM, note: null });
    if (status === 'withdrawn') history.push({ at: `${day(publishedOn, 5)}T10:00:00Z`, status: 'withdrawn', by: speaker, note: 'An updated recording is planned' });
    const n = name(speaker);
    T.lectures.push({
      id, title_en: ten, title_ar: tar, abstract_en: aen, abstract_ar: aar, speaker_id: speaker, speaker_name: n.en, speaker_name_ar: n.ar, speaker_role_id: sp.job_role_id ?? null,
      format, lang, delivered_on: delivered, duration_min: minutes, recording_code, chapters, skill_ids: skillIds, position_id: pos ? pos.id : null,
      position_title_en: pos ? pos.title_en : '', position_title_ar: pos ? pos.title_ar : '', system_family: family, status, published: status === 'published',
      published_by: publishedOn ? KM : null, published_at: publishedOn ? `${publishedOn}T10:00:00Z` : null, withdrawn_reason: status === 'withdrawn' ? 'An updated recording is planned' : null,
      synthetic: true, history, created_by: speaker, created_at: `${submitted}T09:00:00Z`, updated_at: `${(status === 'withdrawn' ? day(publishedOn, 5) : publishedOn ?? submitted)}T10:00:00Z`,
    });
    if (contrib) {
      const k = contributorsOf('lecture', { id, speaker_id: speaker })[0];
      const ev = contrib === 'validated' ? evidenceSkills(skillIds, skills, secComps) : [];
      T.contributions.push({
        id: k.id, person_id: speaker, person_name: n.en, person_name_ar: n.ar, kind: 'lecture', contributor_role: 'speaker', ref_table: 'lectures', ref_id: id, title_en: ten, title_ar: tar,
        skill_ids: skillIds, level: k.level, status: contrib, submitted_on: publishedOn, decided_by: decided ? KM : null, decided_role: decided ? 'training_manager' : null, decided_on: decided,
        note: contrib === 'validated' ? VALIDATE_NOTE : contrib === 'rejected' ? REJECT_NOTE[id] : null, evidence_ids: ev.map((s) => contributionEvidenceId(k.id, s)), created_at: `${publishedOn}T10:00:00Z`,
      });
    }
  }
  // Every published F21 knowledge asset: a pending contribution for its SME and (when different) its author.
  for (const a of [...T.knowledge_assets].filter((x) => x.status === 'published' && x.published).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const on = String(a.published_at).slice(0, 10);
    for (const k of contributorsOf('asset', a)) {
      const n = name(k.person_id);
      T.contributions.push({
        id: k.id, person_id: k.person_id, person_name: n.en, person_name_ar: n.ar, kind: 'asset', contributor_role: k.role, ref_table: 'knowledge_assets', ref_id: a.id, title_en: a.title_en, title_ar: a.title_ar,
        skill_ids: [...(a.skill_ids ?? [])], level: levelFor(k.role), status: 'pending', submitted_on: on, decided_by: null, decided_role: null, decided_on: null, note: null, evidence_ids: [], created_at: `${on}T12:00:00Z`,
      });
    }
  }
  if (T.contributions.some((c) => c.id !== (c.kind === 'lecture' ? contributionId('lecture', c.ref_id, 'speaker') : contributionId('asset', c.ref_id, c.contributor_role)))) throw new Error('fs44: contribution ids');

  // FS45: the SAMPLE localisation plan
  const orgs = new Set(T.organisations.map((o) => o.id));
  const progs = new Set(T.programmes.map((p) => p.id));
  const stds = new Set(T.qual_standards.filter((q) => !q.security_restricted).map((q) => q.id));
  T.localisation_items = LOC_ITEMS.map(([id, programme, partner, scope, standards, discipline, needed, baseline, target, status, sort, ten, tar, pen, par, note]) => {
    if (!progs.has(programme) || !orgs.has(partner) || standards.some((s) => !stds.has(s)) || target > TARGET_MAX || target < baseline) throw new Error(`fs44: localisation item ${id}`);
    const history = [{ at: `${baseline}T08:00:00Z`, by: KM, status: status === 'transferred' ? 'uae_led_supervised' : status, target_on: target, note: 'Plan baseline' }];
    if (status === 'transferred') history.push({ at: `${target}T08:00:00Z`, by: KM, status: 'transferred', target_on: target, note });
    return {
      id, programme_id: programme, title_en: ten, title_ar: tar, scope, partner_org_id: partner, partner_role_en: pen, partner_role_ar: par, standard_ids: standards, discipline, instructors_needed: needed,
      baseline_on: baseline, target_on: target, status, status_note: note, status_by: KM, status_at: `${status === 'transferred' ? target : baseline}T08:00:00Z`, history, sample: true, sort,
      created_at: `${baseline}T08:00:00Z`, updated_at: `${status === 'transferred' ? target : baseline}T08:00:00Z`,
    };
  });
}

export function finalize(T, ctx) {
  buildRows(T, ctx);
  const now = ctx.DEMO_TODAY;
  const skills = new Map(T.skills.map((s) => [s.id, { id: s.id, area: s.area, competency_id: s.competency_id, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const secComps = new Set(T.competencies.filter((c) => c.domain === 'security').map((c) => c.id));
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  const evidence = [];
  for (const c of T.contributions.filter((x) => x.status === 'validated')) {
    for (const sk of evidenceSkills(c.skill_ids, skills, secComps)) {
      if (!fsSkills.has(sk)) throw new Error(`fs44: seeded validated contribution ${c.id} evidences ${sk}, which is not an FS02 future skill (it would change the original 71-skill states)`);
      evidence.push({
        id: contributionEvidenceId(c.id, sk), person_id: c.person_id, skill_id: sk, kind: 'rating', ref_table: c.ref_table, ref_id: c.ref_id, level: c.level, basis: 'validated', status: 'current',
        observed_on: c.decided_on, note: `Validated contribution (${c.kind}, ${c.contributor_role})`, recorded_by: c.decided_by, active: true, created_at: `${c.decided_on}T11:00:00Z`,
      });
    }
  }
  if (evidence.some((e) => e.level > 3)) throw new Error('fs44: contribution evidence above level 3');
  const before71 = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  T.skill_evidence = [...T.skill_evidence, ...evidence].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const people = new Set(evidence.map((e) => e.person_id));
  const states = deriveStates(T.skill_evidence.filter((e) => people.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const byId = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const cur = byId.get(s.id);
    if (!cur) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    Object.assign(cur, patch);
  }
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const changed = T.person_skills.filter((s) => !fsSkills.has(s.skill_id) && before71.has(s.id) && before71.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs44: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  // F36 digests, F23 snapshots and F35 outlooks read the final states: rebuild them the way fs09 / fs36 do.
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  const digestsChanged = beforeDigests !== JSON.stringify(T.digest_runs ?? []);
  let snapshots = 0;
  for (const m of T.alumni ?? []) {
    if (!people.has(m.person_id)) continue;
    const snap = snapshotFrom(T.person_skills.filter((s) => s.person_id === m.person_id), T.skills);
    if (JSON.stringify(snap) !== JSON.stringify(m.skill_snapshot)) { m.skill_snapshot = snap; snapshots++; }
  }
  let outlooksChanged = 0;
  if (T.skill_outlooks?.length) {
    const inp = inputFromTables((t) => T[t] ?? []);
    for (const o of T.skill_outlooks) {
      const r = outlookFor(inp, o.params);
      if (r.code !== 'ok') throw new Error(`fs44: outlook ${o.id} ${r.code}`);
      if (JSON.stringify(r.result) !== JSON.stringify(o.results)) outlooksChanged++;
      o.params = r.result.params; o.results = r.result;
    }
  }
  // FS45: transferred items must be covered by the computed readiness on the seed date; report the board.
  const tracks = trackStatesFrom(T, now);
  const board = computeBoard(T.localisation_items, tracks, now);
  for (const it of T.localisation_items) {
    const bi = board.items.find((x) => x.id === it.id);
    if (it.status === 'transferred' && bi.readiness.ready_now < bi.readiness.needed) throw new Error(`fs44: ${it.id} is transferred but only ${bi.readiness.ready_now} of ${bi.readiness.needed} in-house instructors are current`);
    if (it.status !== 'transferred' && statusProblem({ ...it, status: 'partner_led' }, { status: it.status, note: 'seed check of the status rule' }, bi.readiness) === 'status') throw new Error(`fs44: ${it.id} status`);
  }
  const s = board.summary;
  console.log(`fs44/45: ${T.lectures.length} lectures (${T.lectures.filter((l) => l.status === 'published').length} published, ${T.lectures.filter((l) => l.position_id).length} protect a KLRA position), ${T.contributions.length} contributions (${T.contributions.filter((c) => c.status === 'validated').length} validated, ${T.contributions.filter((c) => c.status === 'pending').length} pending), ${evidence.length} contribution evidence rows (level <= 3), ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}; F35 outlooks recomputed (${outlooksChanged} changed); ${snapshots} F23 snapshots refreshed; localisation ${s.items} items (${s.transferred} transferred, ${s.overdue} overdue, ${s.high} high, ${s.medium} medium, ${s.low} low, average readiness ${s.avg_pct}%) on ${now}`);
}
