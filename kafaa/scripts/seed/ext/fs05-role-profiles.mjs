// FS05 (wave A · E4, fsAe4) Future role profiles and 2030/2035 role horizons.
// - Marks the 28 seed roles lifecycle 'current' and adds the 11 concept future roles of M11's catalogue (future_roles) to
//   job_roles with lifecycle 'concept' (same ids), so the career graph, readiness and roadmaps can name them.
// - Adds 1 to 3 inbound career_paths edges of kind 'future' per concept role, from the roles M11 lists as their origin.
// - Seeds role_profile_versions: now / 2030 / 2035 for every current role (security, safeguards and cyber roles at path
//   level only), 2030 and/or 2035 for every concept role (at least 4 requirements), plus a short version history (one
//   superseded version) and two drafts awaiting review.
// Every version is a planning assumption: no deployment decision implied, no headcount, no sites. Synthetic only.
import { normaliseReqs, versionId, profileTextIsClean, checkVersion } from '../../../src/modules/m01/roleProfiles.ts';

const AS_OF = '2026-10-10';
const PUBLISHED_NOW = '2026-03-01T08:00:00Z';
const PUBLISHED_FUTURE = '2026-09-20T08:00:00Z';
const BY = 'p-training-mgr';
// Benchmark sources not in the shared registry (PLAN.md section 4; research pack national_systems.md 1.1, 1.2, 1.8).
const EXTRA = {
  'sg-jtm': { label: 'Workforce Singapore · Jobs Transformation Maps', url: 'https://wsg.gov.sg/for-employers/jobs-transformation-maps.html' },
  'ssg-trends-2025': { label: 'SkillsFuture Singapore · Top skills trends in 2025 (AI potential on tasks, critical core skills)', url: 'https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf' },
};

// ───────────── role groups (current roles)
const GROUP = {
  'senior-reactor-operator': 'ops', 'shift-supervisor': 'ops', 'reactor-operator': 'ops', 'local-operator': 'ops', 'shift-technical-advisor': 'ops', 'operations-support-work-control': 'ops',
  'outage-manager-planner': 'maint', 'maintenance-technician-engineer': 'maint',
  'systems-design-plant-engineer': 'eng', 'reactor-engineer-core-physicist': 'eng', 'nuclear-fuel-specialist': 'eng',
  'radiation-protection-technician': 'rpchem', 'chemistry-technician': 'rpchem', 'environmental-monitoring-specialist': 'rpchem',
  'quality-assurance-qc': 'assure', 'nuclear-oversight-npi': 'assure', 'regulatory-affairs-licensing-engineer': 'assure', 'human-performance-specialist': 'assure',
  'ecp-officer': 'assure', 'industrial-health-safety-officer': 'assure', 'fire-protection': 'assure', 'emergency-preparedness-coordinator': 'assure',
  'nuclear-training-instructor': 'train', 'procurement-engineer': 'corp', 'corporate-professional': 'corp',
  'cyber-security-engineer': 'sec', 'security-officer': 'sec', 'safeguards-specialist': 'sec',
};

// Why a skill or competency matters at a future horizon (generic per reference; shown in "Why this?").
const WHY = {
  'sk-da-01': ['Digital I&C screens and plant-data tools put trend reading and data checks into daily work.', 'تجعل شاشات الأجهزة والتحكم الرقمية وأدوات بيانات المحطة قراءة الاتجاهات والتحقق من البيانات جزءاً من العمل اليومي.'],
  'sk-da-01-analysis': ['Engineering judgement increasingly starts from plant data: trending, simple statistics and clear charts.', 'يبدأ الحكم الهندسي بشكل متزايد من بيانات المحطة: تحليل الاتجاهات والإحصاءات البسيطة والرسوم الواضحة.'],
  'sk-da-01-scripting': ['Small scripts automate repetitive engineering calculations and data preparation under configuration control.', 'تؤتمت البرامج النصية الصغيرة الحسابات الهندسية المتكررة وإعداد البيانات تحت ضبط التهيئة.'],
  'sk-da-01-twins': ['Digital twins support what-if reviews and training; they stay separate from reactor control systems.', 'تدعم التوائم الرقمية مراجعات "ماذا لو" والتدريب، وتبقى منفصلة عن أنظمة التحكم في المفاعل.'],
  'sk-da-01-remote': ['Remote monitoring of factory-built units asks for oversight of automated functions from a central room.', 'تتطلب المراقبة عن بعد للوحدات المصنّعة في المصنع الإشراف على الوظائف المؤتمتة من غرفة مركزية.'],
  'sk-da-02': ['Teams will use approved AI tools; leaders need to know which uses are allowed and how they are governed.', 'ستستخدم الفرق أدوات ذكاء اصطناعي معتمدة؛ ويحتاج القادة إلى معرفة الاستخدامات المسموح بها وكيفية حوكمتها.'],
  'sk-da-02-review': ['AI tools can draft and screen; people stay accountable for checking outputs before anyone acts on them.', 'يمكن لأدوات الذكاء الاصطناعي أن تصوغ وتفرز، لكن الإنسان يبقى مسؤولاً عن التحقق من المخرجات قبل التصرف بناءً عليها.'],
  'sk-mp-01-remote': ['Crawlers, drones and remote cameras reduce dose and outage time for inspections.', 'تقلل الروبوتات الزاحفة والطائرات المسيّرة والكاميرات عن بعد الجرعة الإشعاعية ومدة الانقطاع في أعمال التفتيش.'],
  'sk-mp-02-dic': ['The APR-1400 digital platform needs technicians who can test and troubleshoot digital channels.', 'تحتاج المنصة الرقمية لمفاعل APR-1400 إلى فنيين قادرين على اختبار القنوات الرقمية وتشخيص أعطالها.'],
  'sk-en-02-perf': ['Predictive maintenance turns equipment data into early warnings that someone must interpret.', 'تحوّل الصيانة التنبؤية بيانات المعدات إلى إنذارات مبكرة يجب أن يفسرها شخص مختص.'],
  'sk-pf-02-advcool': ['Awareness of passive safety and advanced coolants prepares for any future advanced-reactor work; no deployment decision implied.', 'يهيئ الوعي بالسلامة الذاتية والمبرّدات المتقدمة لأي عمل مستقبلي على المفاعلات المتقدمة؛ دون أي قرار نشر ضمني.'],
  'sk-pf-01-advfuel': ['Advanced fuel forms and core materials differ from today\'s fuel; specialists need the fundamentals first.', 'تختلف أشكال الوقود المتقدم ومواد القلب عن الوقود الحالي، ويحتاج المختصون إلى الأساسيات أولاً.'],
  'sk-ch-01-advchem': ['Liquid-metal and molten-salt chemistry follow different control rules from water chemistry.', 'تتبع كيمياء المعادن السائلة والأملاح المنصهرة قواعد ضبط مختلفة عن كيمياء المياه.'],
  'sk-ns-02-licensing': ['A new design would need its own licensing basis built with the regulator; no proposal has been made.', 'يحتاج أي تصميم جديد إلى أساس ترخيص خاص يُبنى مع الجهة الرقابية؛ ولم يُقدَّم أي مقترح.'],
  'sk-en-01-project': ['Factory-built modules and international projects shift work towards project controls and owner\'s engineering.', 'تنقل الوحدات المصنّعة في المصنع والمشاريع الدولية العمل نحو ضبط المشاريع وهندسة المالك.'],
  'sk-ld-01-instruct': ['New content still follows the systematic approach to training, delivered by qualified instructors.', 'يتبع المحتوى الجديد النهج المنهجي للتدريب ويقدمه مدربون مؤهلون.'],
  'sk-qa-02-cgd': ['New suppliers and modules need commercial-grade dedication done right the first time.', 'يحتاج الموردون والوحدات الجدد إلى اعتماد سليم للمكونات التجارية من المرة الأولى.'],
  'sk-ch-02-labqa': ['Laboratory QA keeps new analytical methods traceable.', 'تحافظ ضمانة جودة المختبر على إمكانية تتبع طرق التحليل الجديدة.'],
  'da-01': ['Digital tools and data literacy move from a specialist skill to an expected one for this role.', 'تنتقل الأدوات الرقمية ومحو الأمية البيانية من مهارة تخصصية إلى مهارة متوقعة لهذا الدور.'],
  'da-02': ['Governed use of AI becomes part of everyday work for this role.', 'يصبح الاستخدام المحوكم للذكاء الاصطناعي جزءاً من العمل اليومي لهذا الدور.'],
  'en-02': ['System health monitoring relies more on continuous data and fewer manual walk-downs.', 'تعتمد مراقبة سلامة الأنظمة أكثر على البيانات المستمرة وبدرجة أقل على الجولات اليدوية.'],
  'mp-02': ['Calibration and testing of digital channels adds new procedures to master.', 'يضيف معايرة القنوات الرقمية واختبارها إجراءات جديدة يجب إتقانها.'],
  'en-01': ['Design control has to cover software and data models as configuration items.', 'يجب أن يشمل ضبط التصميم البرمجيات ونماذج البيانات بوصفها عناصر تهيئة.'],
};
const why = (id) => WHY[id] ?? ['Required for this role at this horizon (planning assumption).', 'مطلوب لهذا الدور في هذا الأفق (افتراض تخطيطي).'];
/** r(kind-or-id, level, importance, driver): 'sk-*' ids are skills, others competencies. */
const r = (id, level, importance, driver = null) => {
  const [we, wa] = why(id);
  return { kind: id.startsWith('sk-') ? 'skill' : 'competency', ref_id: id, level, importance, why_en: we, why_ar: wa, driver };
};

// Group additions at 2030 and 2035 (each list adds to or raises the previous horizon).
const ADD = {
  ops: {
    2030: [r('sk-da-01', 2, 'important', 'digital_ic'), r('sk-da-02-review', 2, 'important', 'ai_assistance')],
    2035: [r('sk-da-01-twins', 1, 'useful', 'digital_twin'), r('sk-pf-02-advcool', 1, 'useful', 'smr_design')],
  },
  maint: {
    2030: [r('sk-mp-01-remote', 2, 'important', 'robotics'), r('sk-en-02-perf', 2, 'important', 'ai_assistance')],
    2035: [r('sk-mp-01-remote', 3, 'important', 'robotics'), r('sk-da-01-twins', 2, 'important', 'digital_twin'), r('sk-da-02-review', 2, 'important', 'ai_assistance')],
  },
  eng: {
    2030: [r('sk-da-01-analysis', 3, 'important', 'digital_ic'), r('sk-da-01-scripting', 2, 'important', 'digital_ic'), r('sk-da-02-review', 2, 'important', 'ai_assistance')],
    2035: [r('sk-da-01-twins', 3, 'important', 'digital_twin'), r('sk-da-02-review', 3, 'important', 'ai_assistance')],
  },
  rpchem: {
    2030: [r('sk-da-01', 2, 'important', 'digital_ic'), r('sk-da-02-review', 1, 'useful', 'ai_assistance')],
    2035: [r('sk-da-01-analysis', 2, 'important', 'digital_twin')],
  },
  assure: {
    2030: [r('sk-da-01', 2, 'important', 'digital_ic'), r('sk-da-02-review', 2, 'important', 'ai_assistance')],
    2035: [r('sk-da-02', 2, 'important', 'ai_assistance')],
  },
  train: {
    2030: [r('sk-da-01', 2, 'important', 'digital_ic'), r('sk-da-01-twins', 1, 'important', 'digital_twin'), r('sk-da-02', 2, 'important', 'ai_assistance')],
    2035: [r('sk-da-01-twins', 2, 'important', 'digital_twin'), r('sk-pf-02-advcool', 2, 'important', 'smr_design'), r('sk-pf-01-advfuel', 1, 'useful', 'smr_design')],
  },
  corp: {
    2030: [r('sk-da-01-analysis', 2, 'important', 'digital_ic'), r('da-01', 3, 'important', 'digital_ic')],
    2035: [r('sk-da-02-review', 3, 'important', 'ai_assistance')],
  },
};
// Role-specific additions on top of the group.
const ROLE_ADD = {
  'senior-reactor-operator': { 2030: [r('sk-da-02', 2, 'important', 'ai_assistance')], 2035: [r('sk-da-02-review', 3, 'core', 'ai_assistance')] },
  'shift-supervisor': { 2030: [r('sk-da-02', 2, 'important', 'ai_assistance')], 2035: [r('sk-da-02', 3, 'important', 'ai_assistance')] },
  'shift-technical-advisor': { 2030: [r('sk-da-01-analysis', 2, 'important', 'digital_ic')], 2035: [r('en-02', 4, 'important', 'digital_twin')] },
  'local-operator': { 2035: [r('sk-mp-01-remote', 1, 'useful', 'robotics')] },
  'maintenance-technician-engineer': { 2030: [r('sk-mp-02-dic', 2, 'important', 'digital_ic')], 2035: [r('mp-02', 4, 'core', 'digital_ic')] },
  'outage-manager-planner': { 2030: [r('sk-da-01-analysis', 2, 'important', 'digital_ic')] },
  'systems-design-plant-engineer': { 2030: [r('da-01', 3, 'important', 'digital_ic')], 2035: [r('sk-pf-02-advcool', 2, 'useful', 'smr_design'), r('en-01', 4, 'core', 'digital_twin')] },
  'reactor-engineer-core-physicist': { 2035: [r('sk-pf-01-advfuel', 2, 'important', 'smr_design')] },
  'nuclear-fuel-specialist': { 2035: [r('sk-pf-01-advfuel', 2, 'important', 'smr_design')] },
  'radiation-protection-technician': { 2030: [r('sk-mp-01-remote', 1, 'useful', 'robotics')] },
  'chemistry-technician': { 2035: [r('sk-ch-01-advchem', 1, 'useful', 'smr_design')] },
  'regulatory-affairs-licensing-engineer': { 2035: [r('sk-ns-02-licensing', 3, 'important', 'smr_design')] },
  'nuclear-oversight-npi': { 2035: [r('sk-da-02-review', 3, 'important', 'ai_assistance')] },
  'emergency-preparedness-coordinator': { 2035: [r('sk-da-01-twins', 1, 'useful', 'digital_twin')] },
  'procurement-engineer': { 2030: [r('sk-da-02', 2, 'important', 'ai_assistance')], 2035: [r('sk-en-01-project', 2, 'useful', 'smr_design')] },
  'corporate-professional': { 2030: [r('da-02', 3, 'important', 'ai_assistance')], 2035: [r('sk-da-01-scripting', 1, 'useful', 'digital_ic')] },
};
const DRIVERS_OF = (reqs) => [...new Set(reqs.map((x) => x.driver).filter(Boolean))].sort();

// Version rationale per group and horizon (EN/AR). No headcount, sites or deployment claims.
const RAT = {
  now: ['Today\'s profile: the competencies this role requires now, from the current role profile.', 'ملف اليوم: الكفاءات التي يتطلبها هذا الدور حالياً وفق ملف الدور الحالي.'],
  ops: {
    2030: ['By 2030, digital I&C, plant-data tools and AI-based operator aids are expected in every shift; operators read trends and verify any AI output before acting. Planning assumption; no deployment decision implied.', 'بحلول 2030 يُتوقع أن تكون الأجهزة والتحكم الرقمية وأدوات بيانات المحطة ومساعدات المشغّل القائمة على الذكاء الاصطناعي حاضرة في كل وردية؛ يقرأ المشغّلون الاتجاهات ويتحققون من أي مخرج للذكاء الاصطناعي قبل التصرف. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, twin-based what-if reviews and awareness of advanced reactor concepts round out the operator profile. Planning assumption; no deployment decision implied.', 'بحلول 2035 تكمل مراجعات "ماذا لو" القائمة على التوائم الرقمية والوعي بمفاهيم المفاعلات المتقدمة ملف المشغّل. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  maint: {
    2030: ['By 2030, remote and robotic inspection and predictive-maintenance data become routine in maintenance and outage work. Planning assumption; no deployment decision implied.', 'بحلول 2030 يصبح التفتيش عن بعد والتفتيش الروبوتي وبيانات الصيانة التنبؤية أمراً روتينياً في أعمال الصيانة والانقطاع. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, maintenance plans draw on digital twins and AI-assisted diagnostics that people verify. Planning assumption; no deployment decision implied.', 'بحلول 2035 تعتمد خطط الصيانة على التوائم الرقمية والتشخيص بمساعدة الذكاء الاصطناعي الذي يتحقق منه الإنسان. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  eng: {
    2030: ['By 2030, engineering analysis starts from plant data and scripted calculations, and AI-drafted outputs are always independently checked. Planning assumption; no deployment decision implied.', 'بحلول 2030 يبدأ التحليل الهندسي من بيانات المحطة والحسابات المؤتمتة، ويُتحقق دائماً بشكل مستقل من المخرجات التي يصوغها الذكاء الاصطناعي. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, engineers maintain digital twins as controlled configuration items and understand advanced reactor fundamentals. Planning assumption; no deployment decision implied.', 'بحلول 2035 يدير المهندسون التوائم الرقمية بوصفها عناصر تهيئة مضبوطة ويفهمون أساسيات المفاعلات المتقدمة. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  rpchem: {
    2030: ['By 2030, radiation protection and chemistry work uses connected instruments, remote surveys and data checks. Planning assumption; no deployment decision implied.', 'بحلول 2030 يستخدم عمل الوقاية الإشعاعية والكيمياء أجهزة متصلة ومسوحات عن بعد وفحوصاً للبيانات. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, trending and analysis of monitoring data is expected at practitioner level. Planning assumption; no deployment decision implied.', 'بحلول 2035 يُتوقع تحليل بيانات الرصد واتجاهاتها على مستوى الممارس. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  assure: {
    2030: ['By 2030, assurance and oversight work reviews digital records and AI-assisted document screening, with people accountable for every finding. Planning assumption; no deployment decision implied.', 'بحلول 2030 يراجع عمل الضمان والرقابة السجلات الرقمية وفرز الوثائق بمساعدة الذكاء الاصطناعي، مع بقاء الإنسان مسؤولاً عن كل ملاحظة. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, assurance roles also check how AI tools are governed in the work they oversee. Planning assumption; no deployment decision implied.', 'بحلول 2035 تتحقق أدوار الضمان أيضاً من كيفية حوكمة أدوات الذكاء الاصطناعي في العمل الذي تشرف عليه. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  train: {
    2030: ['By 2030, instructors build twin-based scenarios and use approved AI tools for content, under the systematic approach to training. Planning assumption; no deployment decision implied.', 'بحلول 2030 يبني المدربون سيناريوهات قائمة على التوائم الرقمية ويستخدمون أدوات ذكاء اصطناعي معتمدة لإعداد المحتوى، وفق النهج المنهجي للتدريب. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, instructors can teach advanced reactor fundamentals alongside APR-1400 content. Planning assumption; no deployment decision implied.', 'بحلول 2035 يستطيع المدربون تدريس أساسيات المفاعلات المتقدمة إلى جانب محتوى APR-1400. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  corp: {
    2030: ['By 2030, corporate and supply work relies on data analysis and governed AI tools. Planning assumption; no deployment decision implied.', 'بحلول 2030 يعتمد العمل المؤسسي وأعمال التوريد على تحليل البيانات وأدوات الذكاء الاصطناعي المحوكمة. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
    2035: ['By 2035, checking AI outputs and working with modular supply chains is expected at practitioner level. Planning assumption; no deployment decision implied.', 'بحلول 2035 يُتوقع التحقق من مخرجات الذكاء الاصطناعي والعمل مع سلاسل التوريد المعيارية على مستوى الممارس. افتراض تخطيطي؛ دون أي قرار نشر ضمني.'],
  },
  sec: ['Security, safeguards and cyber roles are shown at career-path level only: status is qualified or not qualified, and requirements are not published here.', 'تُعرض أدوار الأمن والضمانات والأمن السيبراني على مستوى المسار المهني فقط: الحالة مؤهل أو غير مؤهل، ولا تُنشر المتطلبات هنا.'],
};

// Concept future roles: profile requirements (2035; 'prepare' roles also 2030), level, education, edge months.
const CONCEPT = {
  'fr-bwr-operator': { level: 'professional', education: 'diploma', months: 36, h2035: [r('co-01', 3, 'core'), r('co-03', 3, 'core'), r('pf-02', 3, 'core'), r('ns-01', 3, 'core'), r('hu-01', 3, 'core'), r('sk-pf-02-advcool', 2, 'important', 'smr_design'), r('sk-da-02-review', 2, 'important', 'ai_assistance')] },
  'fr-remote-ops': { level: 'professional', education: 'bachelor', months: 36, h2035: [r('co-01', 3, 'core'), r('ns-01', 3, 'core'), r('sk-da-01-remote', 3, 'core', 'digital_ic'), r('sk-da-01', 3, 'important', 'digital_ic'), r('sk-da-02-review', 3, 'important', 'ai_assistance')] },
  'fr-liquid-metal': { level: 'professional', education: 'bachelor', months: 36, h2035: [r('en-01', 3, 'core'), r('ns-01', 3, 'core'), r('sk-pf-02-advcool', 3, 'core', 'smr_design'), r('sk-ch-01-advchem', 2, 'important', 'smr_design'), r('sk-mp-01-remote', 2, 'important', 'robotics')] },
  'fr-salt-chemist': { level: 'professional', education: 'bachelor', months: 24, h2035: [r('ch-01', 3, 'core'), r('rp-01', 2, 'important'), r('sk-ch-01-advchem', 3, 'core', 'smr_design'), r('sk-ch-02-labqa', 3, 'important'), r('sk-da-01-analysis', 2, 'useful', 'digital_ic')] },
  'fr-ht-materials': { level: 'professional', education: 'master', months: 36, h2035: [r('en-01', 3, 'core'), r('qa-01', 3, 'important'), r('sk-pf-01-advfuel', 2, 'important', 'smr_design'), r('sk-pf-02-advcool', 2, 'important', 'smr_design'), r('sk-da-01-analysis', 2, 'useful', 'digital_ic')] },
  'fr-adv-fuel': { level: 'senior', education: 'master', months: 36, h2035: [r('pf-01', 4, 'core'), r('ns-02', 3, 'important'), r('qa-01', 3, 'important'), r('sk-pf-01-advfuel', 3, 'core', 'smr_design'), r('sk-da-01-scripting', 2, 'useful', 'digital_ic')] },
  'fr-adv-licensing': { level: 'senior', education: 'bachelor', months: 36, title_en: 'Licensing specialist for new reactor designs (concept)', title_ar: 'أخصائي ترخيص تصاميم المفاعلات الجديدة (مفهوم)', h2035: [r('ns-02', 4, 'core'), r('ns-01', 3, 'core'), r('en-01', 3, 'important'), r('sk-ns-02-licensing', 4, 'core', 'smr_design'), r('sk-da-02-review', 2, 'useful', 'ai_assistance')] },
  'fr-owners-engineer': {
    level: 'senior', education: 'bachelor', months: 24,
    h2030: [r('en-01', 3, 'core'), r('qa-01', 3, 'important'), r('sk-en-01-project', 2, 'core', 'smr_design'), r('ld-01', 2, 'important')],
    h2035: [r('en-01', 3, 'core'), r('qa-01', 3, 'important'), r('ld-01', 3, 'important'), r('sk-en-01-project', 3, 'core', 'smr_design'), r('sk-qa-02-cgd', 2, 'important', 'smr_design'), r('sk-da-01-analysis', 2, 'useful', 'digital_ic')],
  },
  'fr-digital-twin': {
    level: 'professional', education: 'bachelor', months: 24,
    h2030: [r('en-02', 3, 'important'), r('sk-da-01-twins', 2, 'core', 'digital_twin'), r('sk-da-01-analysis', 3, 'core', 'digital_twin'), r('sk-da-01-scripting', 2, 'important', 'digital_ic')],
    h2035: [r('en-02', 3, 'important'), r('pf-03', 2, 'important'), r('sk-da-01-twins', 3, 'core', 'digital_twin'), r('sk-da-01-analysis', 3, 'core', 'digital_twin'), r('sk-da-01-scripting', 3, 'important', 'digital_ic'), r('sk-da-02-review', 3, 'important', 'ai_assistance')],
  },
  'fr-process-heat': { level: 'professional', education: 'master', months: 36, h2035: [r('pf-02', 4, 'core'), r('en-01', 3, 'core'), r('sk-pf-02-advcool', 2, 'important', 'smr_design'), r('sk-da-01-analysis', 2, 'important', 'digital_ic'), r('sk-en-01-project', 2, 'useful', 'smr_design')] },
  'fr-adv-instructor': {
    level: 'senior', education: 'bachelor', months: 24,
    // own title and summary: M11's "Advanced reactor instructor" matched Dalil's role intent for "the ADVANCE programme for
    // advanced reactors" (two title words) and outranked the /future page in the evaluation set
    title_en: 'Instructor for new reactor technologies (concept)', title_ar: 'مدرّب تقنيات المفاعلات الجديدة (مفهوم)',
    summary_en: 'Teaches new reactor designs to staff and students, using the systematic approach to training.',
    summary_ar: 'يدرّس تصاميم المفاعلات الجديدة للموظفين والطلاب وفق النهج المنهجي للتدريب.',
    h2030: [r('ld-01', 3, 'core'), r('ns-01', 3, 'important'), r('sk-ld-01-instruct', 3, 'core'), r('sk-pf-02-advcool', 2, 'core', 'smr_design')],
    h2035: [r('ld-01', 3, 'core'), r('ns-01', 3, 'important'), r('sk-ld-01-instruct', 3, 'core'), r('sk-pf-02-advcool', 3, 'core', 'smr_design'), r('sk-pf-01-advfuel', 2, 'important', 'smr_design'), r('sk-da-01-twins', 2, 'useful', 'digital_twin')],
  },
};

const merge = (base, adds) => {
  const m = new Map(base.map((x) => [`${x.kind}:${x.ref_id}`, x]));
  for (const a of adds) {
    const k = `${a.kind}:${a.ref_id}`;
    const p = m.get(k);
    m.set(k, p ? { ...p, level: Math.max(p.level, a.level), importance: a.importance, why_en: a.why_en, why_ar: a.why_ar, driver: a.driver ?? p.driver } : a);
  }
  return [...m.values()];
};

export default function build(T) {
  const reg = new Map(T.sources.map((s) => [s.id, s]));
  const S = (...ids) => ids.map((id) => {
    const x = reg.get(id) ?? EXTRA[id];
    if (!x) throw new Error(`fs05: unknown source ${id}`);
    return { id, label: x.label, url: x.url, as_of: x.accessed ?? AS_OF };
  });
  const roleById = new Map(T.job_roles.map((x) => [x.id, x]));
  for (const x of T.job_roles) x.lifecycle ??= 'current';
  for (const e of T.career_paths) e.kind ??= 'current';
  const fams = new Map(T.job_families.map((f) => [f.id, f]));

  // ───────────── concept future roles in job_roles (same ids as future_roles)
  const futureRoles = [...(T.future_roles ?? [])].sort((a, b) => a.sort - b.sort);
  futureRoles.forEach((fr, i) => {
    if (roleById.has(fr.id)) return;
    const c = CONCEPT[fr.id];
    if (!c) throw new Error(`fs05: no concept profile for ${fr.id}`);
    const fam = fams.get(fr.family_id);
    const row = {
      id: fr.id, family_id: fr.family_id, title_en: c.title_en ?? fr.title_en, title_ar: c.title_ar ?? fr.title_ar,
      function_en: `Future role (concept) · ${fam?.name_en ?? ''}`.trim(), function_ar: `دور مستقبلي (مفهوم) · ${fam?.name_ar ?? ''}`.trim(),
      level: c.level, regulated: false, regulation_ref: null, regulation_url: null, basis: 'uncertain',
      basis_note: 'Concept role for planning: no vacancy, no deployment decision implied.',
      summary_en: c.summary_en ?? fr.summary_en, summary_ar: c.summary_ar ?? fr.summary_ar,
      qualifications_en: 'Defined in the 2030/2035 role profile: the requirements listed there are planning assumptions, not a job advertisement.',
      qualifications_ar: 'محددة في ملف الدور لعامي 2030 و2035: المتطلبات المدرجة هناك افتراضات تخطيطية وليست إعلاناً وظيفياً.',
      training_path_en: 'Bridge learning from a current role (learning tracks and catalogue courses) plus project exposure; see "How to get here".',
      training_path_ar: 'تعلّم جسري انطلاقاً من دور حالي (مسارات التعلّم ومقررات الدليل) مع خبرة عملية في المشاريع؛ راجع "كيف تصل إلى هنا".',
      licensing_body_en: 'Not applicable (concept role)', licensing_body_ar: 'لا ينطبق (دور مفاهيمي)', entry_routes: [],
      education: c.education, entry_level: false, emiratization_reserved: false, critical: false, security_sensitive: false,
      sources: S('wnn-advance', 'ngt310').map(({ id, label, url }) => ({ id, label, url })), status: 'published', version: 1, sort: 100 + i, lifecycle: 'concept',
    };
    T.job_roles.push(row);
    roleById.set(row.id, row);

    // inbound future edges from the roles M11 lists as origins
    fr.from_role_ids.forEach((from, j) => {
      const src = roleById.get(from);
      if (!src) throw new Error(`fs05: unknown origin ${from}`);
      T.career_paths.push({
        id: `fp-${from}--${fr.id}`, from_role_id: from, to_role_id: fr.id, from_label_en: null, from_label_ar: null,
        type: src.family_id === fr.family_id ? 'lateral' : 'cross_functional', route_code: 'future_concept',
        label_en: 'Future move (concept): bridge from a current role', label_ar: 'انتقال مستقبلي (مفهوم): جسر من دور حالي',
        conditions: [
          { kind: 'months', value: c.months, en: `Indicative ${c.months} months of experience in the current role`, ar: `خبرة إرشادية مدتها ${c.months} شهراً في الدور الحالي` },
          { kind: 'learning', value: 'bridge', en: 'Bridge learning on the new requirements of the concept profile', ar: 'تعلّم جسري للمتطلبات الجديدة في ملف الدور المفاهيمي' },
          { kind: 'concept', value: 'no_decision', en: 'Concept role: no vacancy and no deployment decision implied', ar: 'دور مفاهيمي: لا توجد وظيفة شاغرة ولا قرار نشر ضمني' },
        ],
        rule_ref: null, basis: 'uncertain', sort: 200 + i * 3 + j, kind: 'future',
      });
    });
  });

  // ───────────── role profile versions
  const comps = new Map(T.competencies.map((c) => [c.id, c.domain]));
  const skills = new Map(T.skills.map((s) => [s.id, s.area]));
  const rows = [];
  const push = (role, horizon, version, status, reqs, ratEn, ratAr, srcIds, publishedAt, extra = {}) => {
    const sec = !!role.security_sensitive;
    const requirements = sec ? [] : normaliseReqs(reqs);
    const sources = S(...srcIds);
    const input = { role_id: role.id, horizon, requirements, drivers: sec ? [] : DRIVERS_OF(requirements), rationale_en: ratEn, rationale_ar: ratAr, sources, publish: status !== 'draft' };
    const code = checkVersion(input, { role: { id: role.id, lifecycle: role.lifecycle, security_sensitive: sec }, competencies: comps, skills });
    if (code !== 'ok') throw new Error(`fs05: ${role.id} ${horizon} v${version} fails ${code}`);
    rows.push({
      id: versionId(role.id, horizon, version), role_id: role.id, horizon, version, status, is_public: status === 'published', path_only: sec,
      requirements, drivers: input.drivers, rationale_en: ratEn, rationale_ar: ratAr, sources, as_of: AS_OF,
      supersedes_id: null, superseded_by_id: null, created_by: BY, created_at: publishedAt ?? '2026-10-08T08:00:00Z', updated_at: publishedAt ?? '2026-10-08T08:00:00Z',
      published_by: status === 'draft' ? null : BY, published_at: status === 'draft' ? null : publishedAt, ...extra,
    });
  };
  const srcFor = (horizon, reqs) => {
    const d = new Set(reqs.map((x) => x.driver).filter(Boolean));
    const ids = horizon === 'now' ? ['ssg75', 'ngt310'] : ['sg-jtm', 'ssg-trends-2025', 'ngt310'];
    if (d.has('digital_ic')) ids.push('enec-technology');
    if (d.has('ai_assistance')) ids.push('enec-presight');
    if (d.has('robotics')) ids.push('enec-tii');
    if (d.has('smr_design')) ids.push('wnn-advance');
    return [...new Set(ids)];
  };

  for (const role of T.job_roles.filter((x) => x.lifecycle === 'current')) {
    const g = GROUP[role.id];
    if (!g) throw new Error(`fs05: no group for ${role.id}`);
    const now = T.role_competencies.filter((rc) => rc.role_id === role.id).map((rc) => ({
      kind: 'competency', ref_id: rc.competency_id, level: rc.required_level, importance: rc.importance,
      why_en: 'Required today (current role profile).', why_ar: 'مطلوب اليوم (ملف الدور الحالي).', driver: null,
    }));
    if (g === 'sec') {
      for (const h of ['now', '2030', '2035']) push(role, h, 1, 'published', [], RAT.sec[0], RAT.sec[1], ['ssg75', 'ngt310'], h === 'now' ? PUBLISHED_NOW : PUBLISHED_FUTURE);
      continue;
    }
    const r30 = merge(now, [...ADD[g][2030], ...(ROLE_ADD[role.id]?.[2030] ?? [])]);
    const r35 = merge(r30, [...ADD[g][2035], ...(ROLE_ADD[role.id]?.[2035] ?? [])]);
    push(role, 'now', 1, 'published', now, RAT.now[0], RAT.now[1], srcFor('now', now), PUBLISHED_NOW);
    if (role.id === 'reactor-operator') {
      // version history: v1 (Apr 2026) lacked AI output verification; v2 added it after the review
      const v1 = r30.filter((x) => x.ref_id !== 'sk-da-02-review');
      push(role, '2030', 1, 'superseded', v1, RAT[g][2030][0], RAT[g][2030][1], srcFor('2030', v1), '2026-04-15T08:00:00Z', { superseded_by_id: versionId(role.id, '2030', 2) });
      push(role, '2030', 2, 'published', r30, RAT[g][2030][0], RAT[g][2030][1], srcFor('2030', r30), PUBLISHED_FUTURE, { supersedes_id: versionId(role.id, '2030', 1) });
    } else push(role, '2030', 1, 'published', r30, RAT[g][2030][0], RAT[g][2030][1], srcFor('2030', r30), PUBLISHED_FUTURE);
    push(role, '2035', 1, 'published', r35, RAT[g][2035][0], RAT[g][2035][1], srcFor('2035', r35), PUBLISHED_FUTURE);
    // drafts awaiting review (visible to the training manager, admins, instructors for SAT review and auditors)
    if (role.id === 'maintenance-technician-engineer') {
      const d = merge(r35, [r('sk-da-01-scripting', 1, 'useful', 'digital_ic')]);
      push(role, '2035', 2, 'draft', d, RAT[g][2035][0], RAT[g][2035][1], srcFor('2035', d), null, { created_at: '2026-10-07T09:00:00Z', updated_at: '2026-10-07T09:00:00Z' });
    }
    if (role.id === 'systems-design-plant-engineer') {
      const d = merge(r30, [r('sk-da-01-scripting', 3, 'important', 'digital_ic')]);
      push(role, '2030', 2, 'draft', d, RAT[g][2030][0], RAT[g][2030][1], srcFor('2030', d), null, { created_at: '2026-10-08T10:30:00Z', updated_at: '2026-10-08T10:30:00Z' });
    }
  }
  for (const fr of futureRoles) {
    const role = roleById.get(fr.id);
    const c = CONCEPT[fr.id];
    const ratEn = (h) => `Concept profile for ${h}: ${fr.summary_en} Requirements are planning assumptions for learning and career conversations; no vacancy and no deployment decision implied.`;
    const ratAr = (h) => `ملف مفاهيمي لعام ${h}: ${fr.summary_ar} المتطلبات افتراضات تخطيطية لأغراض التعلّم والحوار المهني؛ لا توجد وظيفة شاغرة ولا قرار نشر ضمني.`;
    if (c.h2030) push(role, '2030', 1, 'published', c.h2030, ratEn('2030'), ratAr('2030'), srcFor('2030', c.h2030), PUBLISHED_FUTURE);
    push(role, '2035', 1, 'published', c.h2035, ratEn('2035'), ratAr('2035'), srcFor('2035', c.h2035), PUBLISHED_FUTURE);
  }
  const pub = rows.filter((x) => x.is_public);
  if (!profileTextIsClean(pub.flatMap((x) => [x.rationale_en, x.rationale_ar, x.requirements]))) throw new Error('fs05: public profile text is not clean');
  T.role_profile_versions = rows;
}
