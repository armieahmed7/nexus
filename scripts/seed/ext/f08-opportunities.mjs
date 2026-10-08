// F08 (wave 1 · w1e4) seed: 25 synthetic marketplace opportunities posted by manager role cards, about 75 applications in every
// state of the flow (applied → line-manager release → selection → outcome sign-off), saved items and notices. Completed
// applications carry their ojt skill evidence (basis evidenced), which f01-skills finalize() folds into the skill states, so the
// F03 passport shows them. Release routing uses the same rule as both backends (src/modules/m20/domain.ts releaserFor).
// Synthetic people only (w-* workers and role cards). No security, cyber, safeguards or protected-area work.
import { releaserFor, ojtEvidence } from '../../../src/modules/m20/domain.ts';

// [slug, poster, kind, location, hours, start, end, seats, status, needed, gained, flags, eligible, title_en, title_ar, summary_en, summary_ar]
const OPPS = [
  ['opp-u3-outage-valve-walkdowns', 'p-outage-manager', 'outage_support', 'site_non_protected', 12, '2026-11-02', '2026-12-18', 3, 'open', ['sk-co-01-rounds', 'sk-hu-01-star'], ['sk-mp-01-outage', 'sk-hu-02-brief'], ['knowledge_transfer'], [],
    'Unit 3 refuelling outage: work-package walkdown support', 'انقطاع إعادة التزوّد بالوقود للوحدة 3: دعم جولات التحقق من حزم العمل',
    'Support the outage control centre by checking work packages and walkdown readiness before each outage window. You work beside experienced outage planners, including KHNP colleagues, and learn how a refuelling outage is sequenced and controlled.',
    'ادعم مركز التحكم في الانقطاع بمراجعة حزم العمل وجاهزية الجولات قبل كل نافذة انقطاع. ستعمل إلى جانب مخططي انقطاع ذوي خبرة، منهم زملاء من KHNP، وتتعلم كيف يُرتّب انقطاع إعادة التزوّد بالوقود ويُدار.'],
  ['opp-outage-schedule-analytics', 'p-outage-manager', 'project', 'office', 6, '2026-10-26', '2027-01-29', 1, 'open', ['sk-da-01'], ['sk-mp-01-outage', 'sk-da-01-analysis'], ['emirati_development'], [],
    'Outage schedule analytics: critical-path dashboard', 'تحليلات جدول الانقطاع: لوحة المسار الحرج',
    'Build a simple dashboard that tracks critical-path activities and schedule slippage across the last three outages, using exported schedule data only. The result feeds the lessons-learned review for the next outage.',
    'أنشئ لوحة بسيطة تتابع أنشطة المسار الحرج وانزلاق الجدول في آخر ثلاثة انقطاعات، باستخدام بيانات الجدول المصدّرة فقط. تُستخدم النتيجة في مراجعة الدروس المستفادة للانقطاع القادم.'],
  ['opp-sim-scenario-pilot', 'p-training-mgr', 'project', 'office', 8, '2026-11-01', '2027-02-26', 2, 'open', ['sk-co-01-eop', 'sk-pf-03-rcs'], ['sk-ld-01-instruct', 'sk-co-01-eop'], ['knowledge_transfer'], ['operations', 'training'],
    'Simulator training scenario pilot with the instructor team', 'تجربة سيناريوهات تدريب على المحاكي مع فريق المدربين',
    'Help instructors dry-run new transient training scenarios on the full-scope simulator before they enter the continuing-training programme. You give the operator view on realism and timing; no exam content is involved.',
    'ساعد المدربين في التجربة الأولية لسيناريوهات تدريب جديدة على العوابر في المحاكي الكامل قبل إدخالها في برنامج التدريب المستمر. تقدّم منظور المشغّل حول الواقعية والتوقيت، ولا يتضمن ذلك أي محتوى امتحاني.'],
  ['opp-instructor-shadow-coct', 'p-training-mgr', 'shadowing', 'office', 10, '2026-11-09', '2026-12-04', 2, 'open', ['sk-co-01'], ['sk-ld-01-instruct', 'sk-ld-01-coach'], ['new_joiner_friendly'], [],
    'Shadow a continuing-training instructor for one COCT week', 'مرافقة مدرب تدريب مستمر لأسبوع واحد من التدريب المستمر للمشغّلين',
    'Spend a continuing-training week with an instructor: lesson preparation, simulator debriefs and feedback to crews. A first step for anyone considering the instructor path.',
    'اقضِ أسبوع تدريب مستمر مع أحد المدربين: تحضير الدروس، وجلسات المراجعة بعد المحاكي، وتقديم الملاحظات للأطقم. خطوة أولى لكل من يفكر في مسار التدريب.'],
  ['opp-rp-dose-desk', 'p-rp-lead', 'shadowing', 'office', 8, '2026-11-16', '2026-12-11', 2, 'open', ['sk-rp-01'], ['sk-rp-01-dose', 'sk-rp-02'], [], ['radiation-protection', 'chemistry', 'operations', 'maintenance'],
    'Radiation protection: dose assessment desk rotation', 'الوقاية من الإشعاع: تناوب على مكتب تقييم الجرعات',
    'Join the dosimetry desk for four weeks and learn how planned dose is estimated for work packages and compared with actual dose afterwards. Office-based work with anonymised dose records.',
    'انضم إلى مكتب قياس الجرعات لمدة أربعة أسابيع وتعلّم كيف تُقدّر الجرعة المخططة لحزم العمل وتُقارن بالجرعة الفعلية بعد ذلك. عمل مكتبي على سجلات جرعات مجهّلة الهوية.'],
  ['opp-chem-lab-qa-review', 'p-chem-sup', 'project', 'office', 6, '2026-10-19', '2026-12-31', 1, 'open', ['sk-ch-02'], ['sk-ch-02-labqa', 'sk-qa-02'], [], [],
    'Chemistry laboratory QA procedure review', 'مراجعة إجراءات ضمان الجودة في مختبر الكيمياء',
    'Review the laboratory quality-control procedures against the current instrument fleet and propose clearer acceptance criteria. Supervised by the chemistry supervisor and a quality engineer.',
    'راجع إجراءات ضبط الجودة في المختبر مقارنةً بالأجهزة الحالية واقترح معايير قبول أوضح. تحت إشراف مشرف الكيمياء ومهندس جودة.'],
  ['opp-ep-exercise-evaluator', 'p-ep-manager', 'project', 'site_non_protected', 4, '2026-11-23', '2026-12-18', 4, 'open', ['sk-ep-01'], ['sk-ep-01-ero', 'sk-ld-02-decide'], [], [],
    'Emergency exercise controller and evaluator support', 'دعم التحكم والتقييم في تمارين الطوارئ',
    'Act as a controller or evaluator for the year-end emergency preparedness exercise at the emergency facilities. You observe decision-making, record timings and contribute to the after-action report.',
    'شارك بصفة متحكّم أو مقيّم في تمرين التأهب للطوارئ في نهاية العام في مرافق الطوارئ. ستلاحظ اتخاذ القرار وتسجّل التوقيتات وتساهم في تقرير ما بعد التمرين.'],
  ['opp-oe-review-2026-q4', 'p-cap-chair', 'oe_review', 'office', 4, '2026-10-20', '2026-12-15', 3, 'open', ['sk-hu-01'], ['sk-hu-02-brief', 'sk-sc-02', 'sk-ns-01'], [], [],
    'Operating experience review: industry events, third quarter 2026', 'مراجعة الخبرة التشغيلية: أحداث القطاع في الربع الثالث 2026',
    'Screen published industry operating-experience reports for lessons that apply to Barakah, and draft applicability reviews for the corrective action programme. Builds judgement on human performance and safety culture.',
    'افحص تقارير الخبرة التشغيلية المنشورة في القطاع بحثاً عن دروس تنطبق على براكة، وأعدّ مسودات مراجعات الانطباق لبرنامج الإجراءات التصحيحية. تبني الحكم في الأداء البشري وثقافة السلامة.'],
  ['opp-knowledge-capture-senior-ops', 'p-ops-ceo', 'knowledge_capture', 'office', 4, '2026-11-02', '2027-03-31', 3, 'open', ['sk-co-01'], ['sk-hu-02-brief', 'sk-ld-01-coach'], ['knowledge_transfer', 'emirati_development'], [],
    'Knowledge capture: structured interviews with departing senior operators', 'التقاط المعرفة: مقابلات منظمة مع كبار المشغّلين المغادرين',
    'Prepare and run structured interviews with senior operators and KHNP experts before they leave, then turn them into searchable notes. Part of the handover to the next generation of Emirati operators before 2030.',
    'حضّر وأجرِ مقابلات منظمة مع كبار المشغّلين وخبراء KHNP قبل مغادرتهم، ثم حوّلها إلى ملاحظات قابلة للبحث. جزء من التسليم للجيل القادم من المشغّلين المواطنين قبل عام 2030.'],
  ['opp-stem-outreach-schools', 'p-training-mgr', 'outreach', 'office', 3, '2026-11-10', '2027-03-31', 6, 'open', [], ['sk-ld-01-coach', 'sk-sc-01'], ['emirati_development', 'new_joiner_friendly'], [],
    'STEM outreach: careers talks for secondary schools', 'التواصل في مجالات العلوم والتقنية: محاضرات مهنية لطلاب المدارس الثانوية',
    'Visit secondary schools in Al Dhafra and Abu Dhabi with the talent team to explain careers in nuclear energy. Training on presenting and safeguarding is provided before the first visit.',
    'زر المدارس الثانوية في الظفرة وأبوظبي مع فريق المواهب لشرح المسارات المهنية في الطاقة النووية. يُقدَّم تدريب على العرض وحماية الطلاب قبل الزيارة الأولى.'],
  ['opp-digital-twin-study', 'p-ops-ceo', 'research', 'office', 6, '2026-12-01', '2027-05-28', 2, 'open', ['sk-da-01', 'sk-en-02'], ['sk-da-01-twins', 'sk-en-02-perf'], ['emirati_development'], [],
    'Research: digital twin feasibility for condensate system trending', 'بحث: جدوى التوأم الرقمي لتحليل اتجاهات نظام المكثّفات',
    'Work with a university research partner on a feasibility study for a digital twin of the condensate system, using historical, exported performance data only. No connection to plant systems.',
    'اعمل مع شريك بحثي جامعي على دراسة جدوى لتوأم رقمي لنظام المكثّفات باستخدام بيانات أداء تاريخية مصدّرة فقط. لا يوجد أي اتصال بأنظمة المحطة.'],
  ['opp-governed-ai-pilot', 'p-work-control', 'project', 'office', 4, '2026-11-01', '2027-01-29', 2, 'open', ['sk-da-02'], ['sk-da-02-review', 'sk-da-01-analysis'], [], [],
    'Governed AI pilot: reviewing AI-drafted work-order summaries', 'تجربة الذكاء الاصطناعي المحوكم: مراجعة ملخصات أوامر العمل المُعدّة آلياً',
    'Review AI-drafted summaries of closed work orders against the source records, log every error and help write the review checklist. Human review stays mandatory; nothing is used for decisions.',
    'راجع ملخصات أوامر العمل المغلقة التي أعدّها الذكاء الاصطناعي مقارنةً بالسجلات الأصلية، وسجّل كل خطأ، وساعد في كتابة قائمة المراجعة. تبقى المراجعة البشرية إلزامية ولا يُستخدم أي شيء لاتخاذ القرار.'],
  ['opp-work-planning-shadow', 'p-work-control', 'shadowing', 'office', 10, '2026-11-02', '2026-11-27', 2, 'open', ['sk-hu-01'], ['sk-ns-02-techspec', 'sk-mp-01-outage'], ['new_joiner_friendly'], [],
    'Shadow the work planning team for four weeks', 'مرافقة فريق تخطيط الأعمال لمدة أربعة أسابيع',
    'See how maintenance work is screened against technical specifications, scheduled and released. Ideal for operators and technicians who want to understand the planning side.',
    'تعرّف على كيفية فحص أعمال الصيانة مقابل المواصفات الفنية وجدولتها وإطلاقها. مناسب للمشغّلين والفنيين الراغبين في فهم جانب التخطيط.'],
  ['opp-licensing-psr-inputs', 'p-dra', 'project', 'office', 6, '2026-10-26', '2027-01-15', 1, 'open', ['sk-ns-02'], ['sk-ns-02-licensing'], [], ['licensing', 'engineering', 'operations', 'oversight'],
    'Licensing support: periodic safety review inputs', 'دعم الترخيص: مدخلات المراجعة الدورية للسلامة',
    'Collect and check the operating-experience inputs for a periodic safety review chapter with the regulatory affairs team. Kafa\'a records the development; regulatory submissions remain with the licensee.',
    'اجمع وتحقّق من مدخلات الخبرة التشغيلية لفصل من المراجعة الدورية للسلامة مع فريق الشؤون التنظيمية. تسجّل كفاءة التطوير فقط، وتبقى التقديمات التنظيمية مسؤولية المرخَّص له.'],
  ['opp-supplier-quality-surveillance', 'p-head-sq', 'shadowing', 'office', 6, '2026-11-16', '2026-12-11', 2, 'open', ['sk-qa-01'], ['sk-qa-01-inspect', 'sk-qa-02-cgd'], [], [],
    'Supplier quality surveillance and commercial-grade dedication', 'الرقابة على جودة الموردين واعتماد المكونات التجارية',
    'Shadow quality engineers through a supplier surveillance plan and a commercial-grade dedication package, from document review to the acceptance decision.',
    'رافق مهندسي الجودة خلال خطة رقابة على أحد الموردين وحزمة اعتماد لمكونات تجارية، من مراجعة الوثائق حتى قرار القبول.'],
  ['opp-icv-supplier-mapping', 'p-cpo', 'project', 'office', 5, '2026-11-02', '2027-02-26', 1, 'open', [], ['sk-en-01-project', 'sk-qa-02'], ['emirati_development'], [],
    'In-country value: local supplier capability mapping', 'القيمة المحلية المضافة: رسم خريطة قدرات الموردين المحليين',
    'Map local suppliers against upcoming spare-parts and services needs and summarise capability gaps for the supply chain team. Uses public and partner-provided information only.',
    'اربط الموردين المحليين بالاحتياجات القادمة من قطع الغيار والخدمات، ولخّص فجوات القدرات لفريق سلسلة الإمداد. باستخدام المعلومات العامة وتلك المقدمة من الشركاء فقط.'],
  ['opp-crewb-procedure-usability', 'p-sro', 'project', 'office', 4, '2026-11-16', '2027-01-15', 2, 'draft', ['sk-co-01-eop'], ['sk-co-03', 'sk-hu-02-brief'], [], ['operations'],
    'Crew B: abnormal operating procedure usability review', 'الطاقم ب: مراجعة سهولة استخدام إجراءات التشغيل غير الاعتيادية',
    'Walk through selected abnormal operating procedures on the simulator and record usability issues for the procedure owners. Draft: dates to be confirmed with the training schedule.',
    'استعرض إجراءات تشغيل غير اعتيادية مختارة على المحاكي وسجّل مشكلات سهولة الاستخدام لمالكي الإجراءات. مسودة: تُؤكَّد التواريخ مع جدول التدريب.'],
  ['opp-crewb-turnover-capture', 'p-sro', 'knowledge_capture', 'office', 3, '2026-10-19', '2027-01-29', 2, 'open', ['sk-co-01'], ['sk-ld-01-coach', 'sk-co-03'], ['knowledge_transfer'], ['operations'],
    'Crew B: capture shift-turnover good practice', 'الطاقم ب: توثيق الممارسات الجيدة في تسليم الوردية',
    'Observe shift turnovers, interview senior operators about what makes a good turnover and write a short guide for new operators.',
    'لاحظ عمليات تسليم الوردية، وقابل كبار المشغّلين حول ما يجعل التسليم جيداً، واكتب دليلاً قصيراً للمشغّلين الجدد.'],
  ['opp-fire-drill-reviews', 'p-emergency-director', 'oe_review', 'office', 3, '2026-11-02', '2026-12-18', 2, 'open', ['sk-ep-02'], ['sk-ep-02-fire', 'sk-hu-02-brief'], [], [],
    'Fire drill after-action reviews', 'مراجعات ما بعد تمارين الحريق',
    'Review the last year of fire drill reports, identify repeat findings and propose two improvements for the fire brigade training plan.',
    'راجع تقارير تمارين الحريق للعام الماضي، وحدّد الملاحظات المتكررة، واقترح تحسينين لخطة تدريب فرقة الإطفاء.'],
  // past and in-progress
  ['opp-u2-outage-2026-support', 'p-outage-manager', 'outage_support', 'site_non_protected', 12, '2026-04-06', '2026-05-29', 4, 'closed', ['sk-co-01-rounds'], ['sk-mp-01-outage', 'sk-hu-02-brief'], ['knowledge_transfer'], [],
    'Unit 2 outage 2026: outage control centre support', 'انقطاع الوحدة 2 لعام 2026: دعم مركز التحكم في الانقطاع',
    'Support the outage control centre during the Unit 2 refuelling outage: work-package tracking, walkdown readiness and daily schedule updates.',
    'دعم مركز التحكم في الانقطاع خلال انقطاع إعادة التزوّد بالوقود للوحدة 2: متابعة حزم العمل وجاهزية الجولات والتحديثات اليومية للجدول.'],
  ['opp-oe-review-2026-q2', 'p-cap-chair', 'oe_review', 'office', 4, '2026-06-01', '2026-07-31', 3, 'closed', ['sk-hu-01'], ['sk-hu-02-brief', 'sk-sc-02'], [], [],
    'Operating experience review: industry events, first half 2026', 'مراجعة الخبرة التشغيلية: أحداث القطاع في النصف الأول من 2026',
    'Screen published industry operating-experience reports from the first half of 2026 and draft applicability reviews for the corrective action programme.',
    'افحص تقارير الخبرة التشغيلية المنشورة في القطاع للنصف الأول من 2026، وأعدّ مسودات مراجعات الانطباق لبرنامج الإجراءات التصحيحية.'],
  ['opp-sim-instructor-assist-2026', 'p-training-mgr', 'shadowing', 'office', 8, '2026-05-04', '2026-06-26', 2, 'filled', ['sk-co-01'], ['sk-ld-01-instruct', 'sk-ld-01-coach'], [], [],
    'Simulator instructor assistant, spring 2026', 'مساعد مدرب المحاكي، ربيع 2026',
    'Assist simulator instructors during the spring continuing-training cycle: scenario set-up, timing logs and crew debriefs.',
    'مساعدة مدربي المحاكي خلال دورة التدريب المستمر في الربيع: إعداد السيناريوهات وسجلات التوقيت وجلسات المراجعة مع الأطقم.'],
  ['opp-chem-trending-2026', 'p-chem-sup', 'project', 'office', 4, '2026-03-02', '2026-06-30', 1, 'closed', ['sk-ch-01'], ['sk-ch-01-primary', 'sk-da-01-analysis'], [], [],
    'Primary chemistry trending workbook', 'مصنّف تحليل اتجاهات الكيمياء في الدائرة الأولية',
    'Build a trending workbook for primary-side chemistry parameters from exported laboratory results and present the first quarterly review.',
    'أنشئ مصنّفاً لتحليل اتجاهات معاملات الكيمياء في الدائرة الأولية من نتائج المختبر المصدّرة، وقدّم أول مراجعة ربع سنوية.'],
  ['opp-careers-fair-2026', 'p-training-mgr', 'outreach', 'office', 2, '2026-09-01', '2026-10-31', 5, 'filled', [], ['sk-ld-01-coach', 'sk-sc-01'], ['emirati_development'], [],
    'University careers fairs, autumn 2026', 'معارض التوظيف الجامعية، خريف 2026',
    'Represent nuclear careers at university careers fairs with the talent team and answer students\' questions about operator and engineering pathways.',
    'مثّل المسارات المهنية النووية في معارض التوظيف الجامعية مع فريق المواهب، وأجب عن أسئلة الطلاب حول مسارات التشغيل والهندسة.'],
  ['opp-rp-dose-trend-2026', 'p-rp-lead', 'research', 'office', 4, '2026-08-03', '2026-12-18', 1, 'filled', ['sk-rp-01'], ['sk-rp-01-dose', 'sk-da-01-analysis'], [], [],
    'Research: collective dose trends across outages', 'بحث: اتجاهات الجرعة الجماعية عبر الانقطاعات',
    'Analyse anonymised collective dose data across outages and compare with published industry benchmarks.',
    'حلّل بيانات الجرعة الجماعية المجهّلة عبر الانقطاعات وقارنها بالمعايير المرجعية المنشورة في القطاع.'],
];

// [opp slug, person, status, note, levels (completed)]
const APPS = [
  ['opp-u3-outage-valve-walkdowns', 'p-k-ro', 'applied', 'I supported the Unit 2 outage from the control room side and want to see the field side.'],
  ['opp-u3-outage-valve-walkdowns', 'w-lo-01', 'released', 'Outage support last spring; keen to do it again.'],
  ['opp-u3-outage-valve-walkdowns', 'w-lo-03', 'applied', ''],
  ['opp-u3-outage-valve-walkdowns', 'w-mnt-01', 'released', 'Valve maintenance background.'],
  ['opp-u3-outage-valve-walkdowns', 'w-lo-05', 'declined_release', 'Crew A is short-staffed during the outage window; please apply for the next one.'],
  ['opp-u3-outage-valve-walkdowns', 'p-outage-planner', 'applied', 'I plan these packages; walking them down would close the loop.'],
  ['opp-outage-schedule-analytics', 'w-ro-03', 'applied', 'I built crew dashboards for shift data.'],
  ['opp-outage-schedule-analytics', 'w-eng-01', 'released', ''],
  ['opp-sim-scenario-pilot', 'p-k-ro', 'released', 'Interested in the instructor path.'],
  ['opp-sim-scenario-pilot', 'w-sro-02', 'applied', ''],
  ['opp-sim-scenario-pilot', 'w-ro-05', 'released', ''],
  ['opp-instructor-shadow-coct', 'p-k-lo-trainee', 'applied', 'I would like to see how instructors prepare.'],
  ['opp-instructor-shadow-coct', 'w-lo-08', 'released', ''],
  ['opp-instructor-shadow-coct', 'w-ro-06', 'applied', ''],
  ['opp-rp-dose-desk', 'w-rp-01', 'applied', ''],
  ['opp-rp-dose-desk', 'w-chem-02', 'released', ''],
  ['opp-chem-lab-qa-review', 'w-chem-01', 'applied', ''],
  ['opp-chem-lab-qa-review', 'w-qa-01', 'applied', ''],
  ['opp-ep-exercise-evaluator', 'w-ep-01', 'released', ''],
  ['opp-ep-exercise-evaluator', 'w-ro-07', 'applied', ''],
  ['opp-ep-exercise-evaluator', 'w-fire-01', 'applied', ''],
  ['opp-ep-exercise-evaluator', 'w-sro-03', 'released', ''],
  ['opp-oe-review-2026-q4', 'p-qc-inspector', 'applied', 'Inspection findings often trace back to OE.'],
  ['opp-oe-review-2026-q4', 'w-ro-02', 'released', ''],
  ['opp-oe-review-2026-q4', 'w-lo-02', 'selected', ''],
  ['opp-oe-review-2026-q4', 'w-mnt-03', 'applied', ''],
  ['opp-oe-review-2026-q4', 'p-cap-coord', 'applied', ''],
  ['opp-knowledge-capture-senior-ops', 'w-sro-01', 'applied', ''],
  ['opp-knowledge-capture-senior-ops', 'w-ss-01', 'released', ''],
  ['opp-knowledge-capture-senior-ops', 'w-ro-04', 'applied', ''],
  ['opp-knowledge-capture-senior-ops', 'w-lo-09', 'selected', ''],
  ['opp-stem-outreach-schools', 'w-lo-04', 'selected', ''],
  ['opp-stem-outreach-schools', 'w-lo-06', 'released', ''],
  ['opp-stem-outreach-schools', 'w-corp-01', 'applied', ''],
  ['opp-stem-outreach-schools', 'w-ro-08', 'applied', ''],
  ['opp-digital-twin-study', 'w-eng-02', 'applied', ''],
  ['opp-digital-twin-study', 'w-eng-03', 'released', ''],
  ['opp-governed-ai-pilot', 'w-wc-01', 'applied', ''],
  ['opp-governed-ai-pilot', 'w-corp-02', 'applied', ''],
  ['opp-work-planning-shadow', 'w-lo-10', 'applied', ''],
  ['opp-licensing-psr-inputs', 'w-eng-04', 'applied', ''],
  ['opp-supplier-quality-surveillance', 'w-qa-02', 'applied', ''],
  ['opp-supplier-quality-surveillance', 'w-sc-01', 'applied', ''],
  ['opp-icv-supplier-mapping', 'p-buyer', 'applied', 'I already work with several local suppliers.'],
  ['opp-icv-supplier-mapping', 'p-nse', 'applied', ''],
  ['opp-crewb-turnover-capture', 'w-ro-01', 'applied', 'Seven years on Crew B; happy to help write it down.'],
  ['opp-crewb-turnover-capture', 'w-lo-07', 'released', ''],
  ['opp-fire-drill-reviews', 'w-fire-02', 'applied', ''],
  ['opp-u2-outage-2026-support', 'w-lo-01', 'completed', '', { 'sk-mp-01-outage': 2, 'sk-hu-02-brief': 2 }],
  ['opp-u2-outage-2026-support', 'w-lo-02', 'completed', '', { 'sk-mp-01-outage': 2 }],
  ['opp-u2-outage-2026-support', 'w-ro-03', 'completed', '', { 'sk-mp-01-outage': 2, 'sk-hu-02-brief': 3 }],
  ['opp-u2-outage-2026-support', 'w-mnt-02', 'completed', '', { 'sk-mp-01-outage': 3 }],
  ['opp-u2-outage-2026-support', 'w-lo-05', 'not_selected', ''],
  ['opp-oe-review-2026-q2', 'p-k-ro', 'completed', 'OE screening is part of being a good RO.', { 'sk-hu-02-brief': 2, 'sk-sc-02': 2 }],
  ['opp-oe-review-2026-q2', 'w-ro-02', 'completed', '', { 'sk-hu-02-brief': 2 }],
  ['opp-oe-review-2026-q2', 'w-sro-04', 'completed', '', { 'sk-sc-02': 3, 'sk-hu-02-brief': 2 }],
  ['opp-oe-review-2026-q2', 'w-qa-01', 'withdrawn', ''],
  ['opp-sim-instructor-assist-2026', 'w-sro-05', 'completed', '', { 'sk-ld-01-instruct': 2, 'sk-ld-01-coach': 2 }],
  ['opp-sim-instructor-assist-2026', 'w-ro-06', 'completed', '', { 'sk-ld-01-coach': 1 }],
  ['opp-chem-trending-2026', 'w-chem-03', 'completed', '', { 'sk-ch-01-primary': 2, 'sk-da-01-analysis': 2 }],
  ['opp-careers-fair-2026', 'w-lo-06', 'selected', ''],
  ['opp-careers-fair-2026', 'w-lo-08', 'selected', ''],
  ['opp-careers-fair-2026', 'w-ro-04', 'selected', ''],
  ['opp-careers-fair-2026', 'w-ss-02', 'selected', ''],
  ['opp-careers-fair-2026', 'w-lo-10', 'selected', ''],
  ['opp-rp-dose-trend-2026', 'w-rp-02', 'selected', ''],
];
const OUTCOME = {
  en: 'Delivered the agreed scope; feedback shared with the team.',
};
const SAVES = [['p-k-ro', 'opp-knowledge-capture-senior-ops'], ['p-k-ro', 'opp-digital-twin-study'], ['p-k-lo-trainee', 'opp-stem-outreach-schools'], ['p-outage-planner', 'opp-outage-schedule-analytics']];

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const ts = (d, h = 8) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;
const minDate = (a, b) => (a < b ? a : b);

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  T.opportunities = [];
  T.opportunity_applications = [];
  T.opportunity_saves = [];
  OPPS.forEach(([id, poster, kind, location_type, hours_week, start_on, end_on, seats, status, needed, gained, flags, eligible, title_en, title_ar, summary_en, summary_ar], i) => {
    const p = people.get(poster);
    if (!p) throw new Error(`f08: unknown poster ${poster}`);
    const created = start_on > today ? addDays(today, -(4 + (i % 9) * 2)) : addDays(start_on, -30);
    T.opportunities.push({
      id, posted_by: poster, org_id: p.org_id ?? null, family_id: p.job_family_id ?? null, host_role_id: p.job_role_id ?? null, host_team: p.team_id ?? null,
      kind, title_en, title_ar, summary_en, summary_ar, skills_needed: needed, skills_gained: gained, hours_week, start_on, end_on, seats, seats_taken: 0, location_type,
      eligible_families: eligible, priority_flags: flags, status, listed: status !== 'draft', created_at: ts(created, 7), updated_at: ts(created, 7),
    });
  });
  const opp = new Map(T.opportunities.map((o) => [o.id, o]));
  APPS.forEach(([oid, pid, status, note, levels], i) => {
    const o = opp.get(oid);
    const p = people.get(pid);
    if (!o || !p) throw new Error(`f08: bad application ${oid} ${pid}`);
    const r = releaserFor(pid, o.posted_by, T.people, T.role_assignments, today);
    if (!r.releaser) throw new Error(`f08: no releaser for ${pid} on ${oid}`);
    const id = `oa-${oid.replace(/^opp-/, '')}-${pid}`;
    const applied = minDate(addDays(o.created_at.slice(0, 10), 2 + (i % 5)), addDays(today, -1));
    const history = [{ at: ts(applied, 9), status: 'applied', by: pid, note: status === 'declined_release' ? null : note || null }];
    const row = {
      id, opportunity_id: oid, person_id: pid, note, status, history,
      applicant_name: p.display_name, applicant_name_ar: p.display_name_ar || p.display_name, applicant_role_id: p.job_role_id ?? null, applicant_family_id: p.job_family_id ?? null,
      poster_id: o.posted_by, line_manager_id: r.lineManager, releaser_id: r.releaser, skip_level: r.skipLevel,
      released_by: null, released_at: null, decided_by: null, decided_at: null, completed_at: null, outcome_note: null, outcome_levels: {}, evidence_ids: [],
      open_read: false, created_at: ts(applied, 9), updated_at: ts(applied, 9),
    };
    const relOn = minDate(addDays(applied, 2), today);
    if (['released', 'selected', 'not_selected', 'completed', 'declined_release'].includes(status)) {
      const st = status === 'declined_release' ? 'declined_release' : 'released';
      history.push({ at: ts(relOn, 11), status: st, by: r.releaser, note: status === 'declined_release' ? note : null });
      row.released_by = r.releaser;
      row.released_at = ts(relOn, 11);
      if (status === 'declined_release') row.note = '';
    }
    const decOn = minDate(addDays(relOn, 3), today);
    if (['selected', 'not_selected', 'completed'].includes(status)) {
      const st = status === 'not_selected' ? 'not_selected' : 'selected';
      history.push({ at: ts(decOn, 13), status: st, by: o.posted_by, note: null });
      row.decided_by = o.posted_by;
      row.decided_at = ts(decOn, 13);
    }
    if (status === 'completed') {
      const on = minDate(o.end_on, today);
      const ids = [];
      for (const [skill, level] of Object.entries(levels).sort(([a], [b]) => (a < b ? -1 : 1))) {
        const e = ojtEvidence(row, skill, level, on, o.posted_by, o.title_en);
        T.skill_evidence.push(e);
        ids.push(e.id);
      }
      history.push({ at: ts(on, 15), status: 'completed', by: o.posted_by, note: OUTCOME.en });
      Object.assign(row, { completed_at: ts(on, 15), outcome_note: OUTCOME.en, outcome_levels: levels, evidence_ids: ids });
    }
    if (status === 'withdrawn') history.push({ at: ts(addDays(applied, 1), 10), status: 'withdrawn', by: pid, note: null });
    row.updated_at = history[history.length - 1].at;
    T.opportunity_applications.push(row);
    // notices for role-card releasers and applicants (Kafa'a demo personas)
    const card = (x) => !!people.get(x)?.persona_id;
    if (status === 'applied' && card(r.releaser))
      T.notifications.push({ id: `nt-${id}-applied`, person_id: r.releaser, kind: 'opportunity', title_en: `Release request: ${o.title_en}`, title_ar: `طلب إفراج: ${o.title_ar}`, body_en: null, body_ar: null, link: '/opportunities/manage', severity: 'info', created_at: ts(applied, 9), read_at: null });
    if (status === 'released' && card(o.posted_by))
      T.notifications.push({ id: `nt-${id}-released`, person_id: o.posted_by, kind: 'opportunity', title_en: `Applicant released: ${o.title_en}`, title_ar: `تم الإفراج عن متقدّم: ${o.title_ar}`, body_en: null, body_ar: null, link: '/opportunities/manage', severity: 'info', created_at: ts(relOn, 11), read_at: null });
    if (status === 'completed' && card(pid))
      T.notifications.push({ id: `nt-${id}-completed`, person_id: pid, kind: 'opportunity', title_en: `Signed off: ${o.title_en}. Your skills passport is updated`, title_ar: `تم الاعتماد: ${o.title_ar}. تم تحديث جواز مهاراتك`, body_en: null, body_ar: null, link: '/opportunities/my', severity: 'ok', created_at: row.completed_at, read_at: null });
  });
  for (const o of T.opportunities) o.seats_taken = T.opportunity_applications.filter((a) => a.opportunity_id === o.id && (a.status === 'selected' || a.status === 'completed')).length;
  for (const [pid, oid] of SAVES) T.opportunity_saves.push({ id: `os:${pid}:${oid}`, person_id: pid, opportunity_id: oid, saved: true, open_read: false, updated_at: ts(addDays(today, -3), 12) });
}
