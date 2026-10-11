// FS38 + FS39 + FS40 (future-skills wave E · E1, M31 Next-Gen Nuclear Readiness) seed.
// build():    FS38 SMR deltas for every current Barakah role on its three or four most relevant ADVANCE technology families (composed
//             from a technology x dimension table and a role-group lens, every text checked with the same rule the RPC applies:
//             deltaProblem, i.e. no headcount, site or deployment claims, two or more https sources from the research packs) plus two
//             drafts; FS40 digital-twin drills (four published, one draft) with synthetic SIMULATED trend sets and their keys.
// finalize(): FINALIZE_LAST and, by file name, after fs36 (drill evidence): FS39 plant visits (logged, confirmed, declined, withdrawn) with
//             host confirmation evidence (kind ojt, basis validated, ref_table plant_visits, level <= 2) and FS40 drill attempts scored
//             with the server rule (scoreTwinDrill; kind assessment, ref_table twin_attempts, level <= 2, latest attempt per drill
//             active); then re-derives the states of the people concerned, rebuilds the F36 digests, F23 snapshots and F35 outlooks from
//             the final states (as fs09/fs36 do) and fails the build if an original 71-skill state changes or any evidence exceeds L2.
// Synthetic people only; no real plant data (every series is SIMULATED, system codes SYN-TW-000).
import { decayModelFrom, deriveStates, evidenceId } from '../../../src/domain/skills.ts';
import { DIMENSIONS, PATH_ONLY_FAMILIES, deltaProblem } from '../../../src/modules/m31/nextgen.ts';
import { VISIT_SKILL, eligibleHosts, visitLevel, visitProblem } from '../../../src/modules/m31/literacy.ts';
import { TWIN_SKILLS, scoreTwinDrill, twinProblem } from '../../../src/modules/m31/twin.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true;
export const AS_OF = '2026-10-11';
const READ = '2026-10-10'; // research packs read on this date

// ───────────── Sources (only from docs/kafaa/ref/research/nuclear_energy.md)
export const SRC = {
  ans: { id: 'ans-smr-wf-2025', label: 'ANS Nuclear Newswire · Education and training to support Canadian nuclear workforce development (26 Nov 2025)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/', as_of: READ },
  wfp: { id: 'iaea-ng-t-3-10', label: 'IAEA NG-T-3.10 · Workforce Planning for New Nuclear Power Programmes (2011)', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf', as_of: READ },
  gev: { id: 'gevh-smr-centre-2025', label: 'GE Vernova · GE Vernova Hitachi SMR engineering and service centre, Ontario (June 2025)', url: 'https://www.gevernova.com/news/press-releases/ge-vernova-hitachi-nuclear-energy-canada-small-modular-reactor-engineering-service-centre-ontario', as_of: READ },
  e2: { id: 'osu-e2-center', label: 'Oregon State University · NuScale Energy Exploration (E2) Center', url: 'https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center', as_of: READ },
  iaeaai: { id: 'iaea-ai-bulletin', label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence (2025)', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence', as_of: READ },
  match: { id: 'nucleareurope-match', label: 'nucleareurope · MATCH programme: a tool for nuclear capacity building in France', url: 'https://www.nucleareurope.eu/blog/highlight-of-the-month/match-program-a-tool-for-nuclear-capacity-building-in-france/', as_of: READ },
  sask: { id: 'saskpolytech-nuclear', label: 'Saskatchewan Polytechnic · Nuclear skills training (short, non-credit cross-over courses)', url: 'https://saskpolytech.ca/programs-and-courses/part-time-studies/nuclear-skills-training.aspx', as_of: READ },
  nea: { id: 'nea-plan-2035', label: 'OECD-NEA · Plan 2035 vision paper (Oct 2025)', url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf', as_of: READ },
};

// ───────────── FS38 content
const DIM_LABEL = {
  multi_module: ['multi-module operation', 'التشغيل متعدد الوحدات'], passive_safety: ['passive safety', 'السلامة الخاملة'], digital_ic: ['digital I&C', 'الأجهزة والتحكم الرقمية'],
  factory_fab: ['factory fabrication', 'التصنيع في المصنع'], maintenance: ['the maintenance regime', 'نظام الصيانة'], systems: ['plant systems, coolant and fuel', 'أنظمة المحطة والمبرد والوقود'],
  delivery: ['project delivery', 'تنفيذ المشاريع'],
};
/** What each technology family changes, by dimension: [change, English, Arabic]. Planning assumptions drawn from the ADVANCE technology rows. */
const TECH = {
  'tech-bwr': {
    multi_module: ['adapts', 'A fleet of small units means several smaller reactors to run and maintain rather than a few large ones.', 'يعني أسطول من الوحدات الصغيرة تشغيل وصيانة عدد من المفاعلات الأصغر بدلاً من عدد قليل من المفاعلات الكبيرة.'],
    passive_safety: ['new', 'Small reactor designs put more weight on passive cooling that works for a period without AC power or operator action.', 'تعطي تصاميم المفاعلات الصغيرة وزناً أكبر للتبريد الخامل الذي يعمل لفترة دون كهرباء متناوبة أو تدخل من المشغلين.'],
    digital_ic: ['adapts', 'A different digital control platform and alarm philosophy from the APR-1400 digital I&C you know.', 'منصة تحكم رقمية وفلسفة إنذارات تختلفان عن الأجهزة والتحكم الرقمية في APR-1400 التي تعرفها.'],
    factory_fab: ['adapts', 'More of the plant arrives as factory-built modules, so quality evidence moves upstream to the factory.', 'يصل جزء أكبر من المحطة على شكل وحدات مصنّعة في المصنع، فتنتقل أدلة الجودة إلى المصنع.'],
    maintenance: ['adapts', 'Maintenance windows and refuelling follow a different design basis and outage rhythm.', 'تتبع نوافذ الصيانة والتزويد بالوقود أساس تصميم وإيقاع إيقاف مختلفين.'],
    systems: ['new', 'A boiling water reactor makes steam in the reactor itself, so plant systems, water chemistry and radiation zones differ from Barakah\'s two-loop APR-1400 units.', 'يولّد مفاعل الماء المغلي البخار داخل المفاعل نفسه، فتختلف أنظمة المحطة وكيمياء الماء ومناطق الإشعاع عن وحدات APR-1400 ذات الدائرتين في براكة.'],
  },
  'tech-htgr': {
    multi_module: ['new', 'Several smaller reactor modules may share one plant and one control room.', 'قد تتشارك عدة وحدات مفاعل أصغر محطة واحدة وغرفة تحكم واحدة.'],
    passive_safety: ['new', 'Gas-cooled designs aim to remove decay heat passively, relying on fuel and materials that tolerate high temperatures.', 'تسعى التصاميم المبرّدة بالغاز إلى إزالة حرارة الاضمحلال بطريقة خاملة، معتمدة على وقود ومواد تتحمل درجات حرارة عالية.'],
    digital_ic: ['adapts', 'New digital instrumentation for gas coolant and high-temperature systems.', 'أجهزة رقمية جديدة لأنظمة التبريد بالغاز والأنظمة عالية الحرارة.'],
    factory_fab: ['new', 'Reactor modules and major components are planned to be factory-built.', 'يُخطَّط لتصنيع وحدات المفاعل والمكونات الرئيسية في المصنع.'],
    maintenance: ['adapts', 'Gas coolant and a different fuel form change inspection and maintenance tasks.', 'يغيّر التبريد بالغاز وشكل الوقود المختلف مهام الفحص والصيانة.'],
    systems: ['new', 'Gas coolant, a different fuel form and high-temperature heat that can also serve industrial processes.', 'تبريد بالغاز وشكل وقود مختلف وحرارة عالية يمكن أن تخدم العمليات الصناعية أيضاً.'],
  },
  'tech-fast': {
    multi_module: ['adapts', 'Fleet concepts with several units change how operations and support are organised.', 'تغيّر مفاهيم الأساطيل متعددة الوحدات طريقة تنظيم التشغيل والدعم.'],
    passive_safety: ['new', 'Fast-reactor concepts rely on passive heat removal through the coolant\'s natural circulation.', 'تعتمد مفاهيم المفاعلات السريعة على إزالة الحرارة بطريقة خاملة عبر الدوران الطبيعي للمبرد.'],
    digital_ic: ['adapts', 'Instrumentation designed for liquid-metal coolant and a fast neutron spectrum.', 'أجهزة مصممة لمبرد معدني سائل وطيف نيوتروني سريع.'],
    factory_fab: ['adapts', 'More factory-built components and modular construction.', 'مكونات مصنّعة في المصنع وإنشاء معياري أكثر.'],
    maintenance: ['new', 'Liquid-metal coolant changes how components are inspected, drained and handled.', 'يغيّر المبرد المعدني السائل طريقة فحص المكونات وتصريفها ومناولتها.'],
    systems: ['new', 'Liquid-metal coolant handling and chemistry, and fast-spectrum reactor physics.', 'مناولة المبرد المعدني السائل وكيمياؤه، وفيزياء المفاعلات ذات الطيف السريع.'],
  },
  'tech-micro': {
    multi_module: ['new', 'Many small transportable units rather than one plant.', 'وحدات صغيرة كثيرة قابلة للنقل بدلاً من محطة واحدة.'],
    passive_safety: ['new', 'Microreactor concepts are designed to cool themselves passively for long periods.', 'صُممت مفاهيم المفاعلات المتناهية الصغر لتبريد نفسها بطريقة خاملة لفترات طويلة.'],
    digital_ic: ['new', 'Remote and autonomous operation concepts: monitoring from a distance rather than from a local control room.', 'مفاهيم التشغيل عن بعد والتشغيل الذاتي: المراقبة من بعيد بدلاً من غرفة تحكم محلية.'],
    factory_fab: ['new', 'Units are built in a factory and transported as complete units.', 'تُبنى الوحدات في المصنع وتُنقل وحدات كاملة.'],
    maintenance: ['new', 'Maintenance shifts towards remote monitoring and returning units to the factory.', 'تنتقل الصيانة نحو المراقبة عن بعد وإعادة الوحدات إلى المصنع.'],
    systems: ['adapts', 'Compact designs with their own coolant and fuel choices.', 'تصاميم مدمجة لها خياراتها الخاصة من المبرد والوقود.'],
  },
  'tech-msr': {
    multi_module: ['adapts', 'Modular plant concepts with several units.', 'مفاهيم محطات معيارية بعدة وحدات.'],
    passive_safety: ['new', 'Molten salt concepts rely on passive features of the salt and the design to remove heat.', 'تعتمد مفاهيم الأملاح المنصهرة على الخصائص الخاملة للملح والتصميم لإزالة الحرارة.'],
    digital_ic: ['adapts', 'Instrumentation and sampling designed for hot salt systems.', 'أجهزة وأخذ عينات مصممة لأنظمة الأملاح الساخنة.'],
    factory_fab: ['adapts', 'Factory-built modules for salt systems.', 'وحدات مصنّعة في المصنع لأنظمة الأملاح.'],
    maintenance: ['new', 'Salt-wetted components bring new handling and inspection tasks.', 'تجلب المكونات الملامسة للملح مهام مناولة وفحص جديدة.'],
    systems: ['new', 'Salt chemistry and materials replace water chemistry.', 'تحل كيمياء الأملاح وموادها محل كيمياء الماء.'],
  },
  'tech-intl': {
    systems: ['adapts', 'Other large reactor designs, such as the AP1000, bring their own systems and documentation.', 'تأتي تصاميم مفاعلات كبيرة أخرى، مثل AP1000، بأنظمتها ووثائقها الخاصة.'],
    digital_ic: ['adapts', 'Different digital platforms and engineering tools from each partner.', 'منصات رقمية وأدوات هندسية مختلفة لدى كل شريك.'],
    delivery: ['new', 'Project delivery abroad, investment and owner\'s-engineer work for partners.', 'تنفيذ المشاريع في الخارج والاستثمار وأعمال مهندس المالك للشركاء.'],
  },
};
/** Role-group lens: what each dimension means for this kind of work, which dimensions keep the technology's full change (strong), what stays. */
const GROUP = {
  ops: {
    strong: ['multi_module', 'passive_safety', 'digital_ic', 'systems'], level: 2,
    lens: {
      multi_module: ['Crews may supervise several units from one control room, so situational awareness and turnover cover more than one reactor.', 'قد تشرف الأطقم على عدة وحدات من غرفة تحكم واحدة، فيمتد الوعي بالموقف وتسليم الوردية إلى أكثر من مفاعل.'],
      passive_safety: ['Your response to a transient shifts from starting systems to confirming that passive systems are working as designed.', 'تنتقل استجابتك للحالات العابرة من تشغيل الأنظمة إلى التأكد من أن الأنظمة الخاملة تعمل كما صُممت.'],
      digital_ic: ['New screens, alarm handling and procedures on a different platform; expect simulator time on the new interface.', 'شاشات ومعالجة إنذارات وإجراءات جديدة على منصة مختلفة؛ توقّع ساعات على المحاكي للتعرف على الواجهة الجديدة.'],
      factory_fab: ['Fewer site-built systems to walk down during commissioning and more vendor documentation to learn before you operate.', 'أنظمة مبنية في الموقع أقل للتفقد أثناء التشغيل التجريبي، ووثائق موردين أكثر لتتعلمها قبل التشغيل.'],
      maintenance: ['Equipment outages and their rhythm change, so rounds and tagging follow a new pattern.', 'يتغير خروج المعدات من الخدمة وإيقاعه، فتتبع الجولات وعمليات العزل نمطاً جديداً.'],
      systems: ['Plant systems behave differently, so your mental model of the plant has to be rebuilt system by system.', 'تتصرف أنظمة المحطة بشكل مختلف، فيجب إعادة بناء تصورك الذهني للمحطة نظاماً بعد نظام.'],
    },
    stays: ['Conservative decision-making, procedure use, shift turnover and the questioning attitude you practise on Barakah\'s APR-1400 units carry over unchanged.', 'يبقى اتخاذ القرار المحافظ واستخدام الإجراءات وتسليم الوردية والتساؤل الذي تمارسه في وحدات APR-1400 في براكة كما هو.'],
  },
  outage: {
    strong: ['multi_module', 'factory_fab', 'maintenance'], level: 2,
    lens: {
      multi_module: ['Planning moves from a few long outages to shorter, more frequent windows across several units.', 'ينتقل التخطيط من فترات إيقاف قليلة وطويلة إلى نوافذ أقصر وأكثر تكراراً عبر عدة وحدات.'],
      factory_fab: ['Replacing modules instead of repairing in place changes scope, logistics and the critical path.', 'يغيّر استبدال الوحدات بدلاً من إصلاحها في مكانها نطاق العمل والإمداد والمسار الحرج.'],
      maintenance: ['A different refuelling cycle and design basis reshape the outage schedule template.', 'تعيد دورة تزويد بالوقود وأساس تصميم مختلفان تشكيل قالب جدول الإيقاف.'],
      digital_ic: ['Electronic work packages and digital tools tie the schedule to live plant data.', 'تربط حزم العمل الإلكترونية والأدوات الرقمية الجدول ببيانات المحطة الحية.'],
      systems: ['New equipment types to sequence and isolate safely.', 'أنواع جديدة من المعدات لترتيبها وعزلها بأمان.'],
    },
    stays: ['Risk-informed scheduling, work control discipline and the safety review of every outage plan stay the same.', 'تبقى الجدولة المستنيرة بالمخاطر وانضباط التحكم في الأعمال ومراجعة السلامة لكل خطة إيقاف كما هي.'],
  },
  maint: {
    strong: ['passive_safety', 'digital_ic', 'factory_fab', 'maintenance', 'systems'], level: 2,
    lens: {
      multi_module: ['The same task repeated across many smaller units rewards standard work and good records.', 'تكرار المهمة نفسها في وحدات صغيرة كثيرة يكافئ العمل المعياري والسجلات الجيدة.'],
      passive_safety: ['Passive systems have fewer pumps and diesels to maintain, but valves, heat exchangers and their testing matter more.', 'للأنظمة الخاملة مضخات ومولدات ديزل أقل للصيانة، لكن الصمامات والمبادلات الحرارية واختبارها تصبح أهم.'],
      digital_ic: ['A different digital platform to calibrate, test and fault-find.', 'منصة رقمية مختلفة للمعايرة والاختبار وتحديد الأعطال.'],
      factory_fab: ['More component swaps and vendor support, fewer field repairs; receiving inspection grows.', 'مزيد من استبدال المكونات ودعم الموردين وإصلاحات ميدانية أقل، ويزداد الفحص عند الاستلام.'],
      maintenance: ['New maintenance regimes, with remote inspection and robotics where access is harder.', 'أنظمة صيانة جديدة، مع الفحص عن بعد والروبوتات حيث يصعب الوصول.'],
      systems: ['New coolant and materials mean new tools, procedures and hazards to learn.', 'يعني المبرد والمواد الجديدة أدوات وإجراءات ومخاطر جديدة يجب تعلمها.'],
    },
    stays: ['Work package discipline, self-checking, foreign material exclusion and pre-job briefs stay exactly as today.', 'يبقى انضباط حزم العمل والتحقق الذاتي ومنع المواد الغريبة وإحاطات ما قبل العمل كما هي اليوم.'],
  },
  eng: {
    strong: ['multi_module', 'passive_safety', 'digital_ic', 'factory_fab', 'systems', 'delivery'], level: 2,
    lens: {
      multi_module: ['Design and configuration control span several identical units, so a change is assessed once and applied many times.', 'يمتد التصميم والتحكم في التهيئة إلى عدة وحدات متطابقة، فيُقيَّم التغيير مرة ويُطبَّق مرات.'],
      passive_safety: ['Safety analysis leans on natural circulation and passive heat removal rather than pumped systems.', 'يعتمد تحليل السلامة على الدوران الطبيعي وإزالة الحرارة الخاملة بدلاً من الأنظمة المعتمدة على المضخات.'],
      digital_ic: ['A new digital architecture to understand, modify and keep under configuration control.', 'بنية رقمية جديدة يجب فهمها وتعديلها وإبقاؤها تحت التحكم في التهيئة.'],
      factory_fab: ['The design authority works closer to the factory: design changes, deviations and acceptance move upstream.', 'تعمل جهة التصميم أقرب إلى المصنع، فتنتقل تغييرات التصميم والانحرافات والقبول إلى مراحل أبكر.'],
      maintenance: ['System health monitoring starts from new failure modes and new performance data.', 'تبدأ مراقبة سلامة الأنظمة من أنماط أعطال جديدة وبيانات أداء جديدة.'],
      systems: ['Core physics, coolant behaviour and materials differ, so analysis methods and codes change.', 'تختلف فيزياء القلب وسلوك المبرد والمواد، فتتغير طرق التحليل وبرمجياته.'],
      delivery: ['Owner\'s-engineer reviews of a partner\'s design and project documents.', 'مراجعات مهندس المالك لتصميم الشريك ووثائق المشروع.'],
    },
    stays: ['Design control, the discipline of the licensing basis and engineering judgement stay the foundation of the job.', 'يبقى التحكم في التصميم وانضباط أساس الترخيص والحكم الهندسي أساس العمل.'],
  },
  fuel: {
    strong: ['systems', 'factory_fab'], level: 2,
    lens: {
      systems: ['A different fuel form and handling chain, from receipt and storage to loading.', 'شكل وقود وسلسلة مناولة مختلفان، من الاستلام والتخزين حتى التحميل.'],
      factory_fab: ['Fuel may arrive in different packages from the factory, changing receipt inspection and records.', 'قد يصل الوقود في عبوات مختلفة من المصنع، فيتغير فحص الاستلام والسجلات.'],
      maintenance: ['Refuelling intervals and tooling follow the new design.', 'تتبع فترات التزويد بالوقود وأدواته التصميمَ الجديد.'],
    },
    stays: ['Criticality safety awareness, careful handling and complete records stay at the centre of the role.', 'يبقى الوعي بسلامة الحرجية والمناولة الحذرة والسجلات الكاملة في صميم الدور.'],
  },
  rp: {
    strong: ['systems', 'maintenance'], level: 1,
    lens: {
      systems: ['Radiation fields and contamination sources sit in different places, so survey plans and zoning change.', 'توجد مصادر الإشعاع والتلوث في أماكن مختلفة، فتتغير خطط المسح وتقسيم المناطق.'],
      maintenance: ['New maintenance tasks need new ALARA plans and dose estimates.', 'تحتاج مهام الصيانة الجديدة إلى خطط ALARA وتقديرات جرعة جديدة.'],
      factory_fab: ['Less work inside radiation areas when modules are swapped rather than repaired.', 'عمل أقل داخل مناطق الإشعاع عندما تُستبدل الوحدات بدلاً من إصلاحها.'],
      digital_ic: ['Remote monitoring and dosimetry data flow into digital systems.', 'تتدفق بيانات المراقبة عن بعد والجرعات إلى أنظمة رقمية.'],
    },
    stays: ['Dose limits, ALARA thinking and radiation work permits work the same way.', 'تعمل حدود الجرعات وتفكير ALARA وتصاريح العمل الإشعاعي بالطريقة نفسها.'],
  },
  chem: {
    strong: ['systems', 'maintenance'], level: 2,
    lens: {
      systems: ['Coolant chemistry changes completely, from water chemistry to the chemistry of the new coolant.', 'تتغير كيمياء المبرد كلياً، من كيمياء الماء إلى كيمياء المبرد الجديد.'],
      maintenance: ['New sampling points, analytical methods and laboratory QA.', 'نقاط أخذ عينات وطرق تحليل وضمان جودة مختبري جديدة.'],
      digital_ic: ['Online chemistry monitoring and trending tools.', 'أدوات مراقبة الكيمياء وتحليل الاتجاهات عبر الإنترنت.'],
    },
    stays: ['Sampling discipline, laboratory QA and effluent monitoring principles stay the same.', 'يبقى انضباط أخذ العينات وضمان جودة المختبر ومبادئ مراقبة الانبعاثات كما هي.'],
  },
  env: {
    strong: ['systems'], level: 1,
    lens: {
      systems: ['Different effluents and environmental pathways to model and monitor.', 'انبعاثات ومسارات بيئية مختلفة للنمذجة والمراقبة.'],
      digital_ic: ['Remote environmental sensors and data platforms.', 'مستشعرات بيئية عن بعد ومنصات بيانات.'],
    },
    stays: ['Radiological environmental monitoring principles and public reporting stay the same.', 'تبقى مبادئ الرصد الإشعاعي البيئي والإبلاغ العام كما هي.'],
  },
  qa: {
    strong: ['factory_fab', 'multi_module'], level: 2,
    lens: {
      factory_fab: ['Quality oversight moves into the factory: source inspection, factory acceptance tests and supplier audits.', 'تنتقل رقابة الجودة إلى المصنع: فحص المصدر واختبارات القبول في المصنع وتدقيق الموردين.'],
      multi_module: ['Identical modules make sampling plans and trend analysis across units possible.', 'تتيح الوحدات المتطابقة خطط أخذ عينات وتحليل اتجاهات عبر الوحدات.'],
      digital_ic: ['Digital records and software quality join hardware quality.', 'تنضم السجلات الرقمية وجودة البرمجيات إلى جودة المعدات.'],
      systems: ['New materials and coolants bring new inspection techniques.', 'تجلب المواد والمبردات الجديدة تقنيات فحص جديدة.'],
    },
    stays: ['NQA-1 discipline, independence and reliance on objective evidence stay the same.', 'يبقى انضباط NQA-1 والاستقلالية والاعتماد على الأدلة الموضوعية كما هي.'],
  },
  overs: {
    strong: ['passive_safety', 'delivery'], level: 1,
    lens: {
      multi_module: ['Performance trends and lessons learned compare several units.', 'تقارن اتجاهات الأداء والدروس المستفادة بين عدة وحدات.'],
      passive_safety: ['Human performance shifts from manual action to monitoring passive systems and avoiding complacency.', 'ينتقل الأداء البشري من الإجراء اليدوي إلى مراقبة الأنظمة الخاملة وتجنب التراخي.'],
      digital_ic: ['Human-system interface reviews of new screens and alarms.', 'مراجعات واجهة الإنسان والنظام للشاشات والإنذارات الجديدة.'],
      delivery: ['Independent oversight of work delivered with partners abroad.', 'رقابة مستقلة على الأعمال المنجزة مع الشركاء في الخارج.'],
    },
    stays: ['Safety culture traits, independent oversight and the corrective action programme stay the same.', 'تبقى سمات ثقافة السلامة والرقابة المستقلة وبرنامج الإجراءات التصحيحية كما هي.'],
  },
  ecp: {
    strong: [], level: 1,
    lens: {
      multi_module: ['Concern channels serve crews spread across several units.', 'تخدم قنوات المخاوف أطقماً موزعة على عدة وحدات.'],
      delivery: ['Concern channels for staff working with partners abroad.', 'قنوات المخاوف للموظفين العاملين مع الشركاء في الخارج.'],
    },
    stays: ['Confidentiality, non-retaliation and the right to raise a concern stay the same.', 'تبقى السرية وعدم الانتقام والحق في إثارة المخاوف كما هي.'],
  },
  lic: {
    strong: ['systems', 'passive_safety', 'delivery'], level: 2,
    lens: {
      systems: ['A new licensing basis: a different design, a different safety case and different regulatory questions.', 'أساس ترخيص جديد: تصميم مختلف وحالة سلامة مختلفة وأسئلة تنظيمية مختلفة.'],
      passive_safety: ['Safety cases built on passive features and longer coping times.', 'حالات سلامة مبنية على الخصائص الخاملة وفترات تحمّل أطول.'],
      factory_fab: ['Licensing questions about factory quality and module transport.', 'أسئلة ترخيص حول جودة المصنع ونقل الوحدات.'],
      delivery: ['Working with regulators and partners in other countries.', 'العمل مع الجهات التنظيمية والشركاء في دول أخرى.'],
    },
    stays: ['Tracking regulatory commitments and keeping a precise, honest licensing basis stay the same.', 'تبقى متابعة الالتزامات التنظيمية ودقة أساس الترخيص ونزاهته كما هي.'],
  },
  safe: {
    strong: ['systems', 'passive_safety'], level: 1,
    lens: {
      systems: ['New industrial hazards from different coolants and materials.', 'مخاطر صناعية جديدة من المبردات والمواد المختلفة.'],
      multi_module: ['Emergency plans and drills cover several smaller units.', 'تغطي خطط الطوارئ والتمارين عدة وحدات أصغر.'],
      passive_safety: ['Longer coping times change the timeline of an emergency response.', 'تغيّر فترات التحمل الأطول الجدول الزمني للاستجابة للطوارئ.'],
      digital_ic: ['Remote monitoring feeds the emergency organisation.', 'تغذي المراقبة عن بعد منظمة الطوارئ.'],
    },
    stays: ['Hazard identification, permits, drills and the emergency organisation\'s roles stay the same.', 'يبقى تحديد المخاطر والتصاريح والتمارين وأدوار منظمة الطوارئ كما هي.'],
  },
  train: {
    strong: ['digital_ic', 'passive_safety', 'systems'], level: 2,
    lens: {
      digital_ic: ['A new simulator and digital interface to master before you teach it.', 'محاكٍ وواجهة رقمية جديدان يجب إتقانهما قبل تدريسهما.'],
      passive_safety: ['New scenarios that teach crews to monitor passive systems.', 'سيناريوهات جديدة تعلّم الأطقم مراقبة الأنظمة الخاملة.'],
      multi_module: ['Training crews to coordinate across several units.', 'تدريب الأطقم على التنسيق بين عدة وحدات.'],
      systems: ['New plant-systems lessons, rebuilt through the systematic approach to training.', 'دروس جديدة لأنظمة المحطة يُعاد بناؤها بالنهج المنهجي للتدريب.'],
    },
    stays: ['The systematic approach to training, evaluation standards and instructor qualification stay the same.', 'يبقى النهج المنهجي للتدريب ومعايير التقييم وتأهيل المدربين كما هي.'],
  },
  supply: {
    strong: ['factory_fab', 'delivery'], level: 1,
    lens: {
      factory_fab: ['Buying factory-built modules: supplier qualification, factory acceptance and transport logistics.', 'شراء وحدات مصنّعة في المصنع: تأهيل الموردين والقبول في المصنع ولوجستيات النقل.'],
      multi_module: ['Fleet purchasing of identical components across units.', 'شراء أسطولي لمكونات متطابقة عبر الوحدات.'],
      delivery: ['International partners, contracts and owner\'s-engineer support.', 'شركاء دوليون وعقود ودعم مهندس المالك.'],
      digital_ic: ['Digital procurement and obsolescence management for new platforms.', 'المشتريات الرقمية وإدارة التقادم للمنصات الجديدة.'],
    },
    stays: ['Nuclear procurement discipline, commercial-grade dedication and vigilance against counterfeit items stay the same.', 'يبقى انضباط المشتريات النووية والتأهيل التجاري واليقظة تجاه المواد المزيفة كما هي.'],
  },
  corp: {
    strong: ['delivery'], level: 1,
    lens: {
      delivery: ['Investment cases, partnerships and communication about projects with partners abroad.', 'دراسات الاستثمار والشراكات والتواصل بشأن المشاريع مع الشركاء في الخارج.'],
      multi_module: ['Workforce planning for a fleet of smaller units rather than one large plant.', 'تخطيط القوى العاملة لأسطول من الوحدات الأصغر بدلاً من محطة كبيرة واحدة.'],
      factory_fab: ['Contracts and finance follow factory-built delivery.', 'تتبع العقود والشؤون المالية نموذج التسليم المصنّع في المصنع.'],
      systems: ['Plant literacy for a new technology, so you can explain it accurately.', 'إلمام بالمحطة لتقنية جديدة كي تستطيع شرحها بدقة.'],
    },
    stays: ['Stakeholder trust, accurate public communication and good governance stay the same.', 'تبقى ثقة أصحاب المصلحة والتواصل العام الدقيق والحوكمة الرشيدة كما هي.'],
  },
  path: {
    strong: [], level: 0,
    lens: { systems: ['Any future fleet would bring its own arrangements, designed and managed outside Kafa\'a; this overlay stays at career-path level.', 'سيأتي أي أسطول مستقبلي بترتيباته الخاصة التي تُصمَّم وتُدار خارج كفاءة؛ وتبقى هذه الطبقة على مستوى المسار المهني.'] },
    stays: ['Your qualification shows only as qualified or not qualified; no security detail is shown here.', 'يظهر تأهيلك فقط بصفة مؤهَّل أو غير مؤهَّل، ولا تُعرض هنا أي تفاصيل أمنية.'],
  },
};
/** Every current role: its lens group and its ADVANCE families in order of relevance (rank 1 first). */
const ROLES = {
  'senior-reactor-operator': ['ops', ['tech-bwr', 'tech-micro', 'tech-htgr']],
  'shift-supervisor': ['ops', ['tech-bwr', 'tech-micro', 'tech-htgr']],
  'reactor-operator': ['ops', ['tech-bwr', 'tech-micro', 'tech-htgr']],
  'local-operator': ['ops', ['tech-bwr', 'tech-htgr', 'tech-micro']],
  'shift-technical-advisor': ['ops', ['tech-bwr', 'tech-htgr', 'tech-fast']],
  'operations-support-work-control': ['outage', ['tech-bwr', 'tech-micro', 'tech-htgr']],
  'outage-manager-planner': ['outage', ['tech-bwr', 'tech-htgr', 'tech-fast']],
  'maintenance-technician-engineer': ['maint', ['tech-bwr', 'tech-fast', 'tech-micro', 'tech-msr']],
  'systems-design-plant-engineer': ['eng', ['tech-bwr', 'tech-htgr', 'tech-fast', 'tech-msr']],
  'reactor-engineer-core-physicist': ['eng', ['tech-fast', 'tech-htgr', 'tech-msr', 'tech-bwr']],
  'nuclear-fuel-specialist': ['fuel', ['tech-htgr', 'tech-fast', 'tech-msr']],
  'cyber-security-engineer': ['path', ['tech-micro', 'tech-bwr', 'tech-intl']],
  'radiation-protection-technician': ['rp', ['tech-bwr', 'tech-fast', 'tech-msr']],
  'chemistry-technician': ['chem', ['tech-msr', 'tech-fast', 'tech-bwr']],
  'environmental-monitoring-specialist': ['env', ['tech-bwr', 'tech-htgr', 'tech-msr']],
  'quality-assurance-qc': ['qa', ['tech-bwr', 'tech-htgr', 'tech-micro']],
  'nuclear-oversight-npi': ['overs', ['tech-bwr', 'tech-micro', 'tech-intl']],
  'regulatory-affairs-licensing-engineer': ['lic', ['tech-bwr', 'tech-htgr', 'tech-fast', 'tech-intl']],
  'human-performance-specialist': ['overs', ['tech-micro', 'tech-bwr', 'tech-htgr']],
  'ecp-officer': ['ecp', ['tech-bwr', 'tech-micro', 'tech-intl']],
  'industrial-health-safety-officer': ['safe', ['tech-fast', 'tech-msr', 'tech-bwr']],
  'fire-protection': ['safe', ['tech-fast', 'tech-bwr', 'tech-msr']],
  'emergency-preparedness-coordinator': ['safe', ['tech-micro', 'tech-bwr', 'tech-htgr']],
  'security-officer': ['path', ['tech-bwr', 'tech-micro', 'tech-intl']],
  'safeguards-specialist': ['path', ['tech-fast', 'tech-msr', 'tech-htgr']],
  'nuclear-training-instructor': ['train', ['tech-bwr', 'tech-micro', 'tech-htgr']],
  'procurement-engineer': ['supply', ['tech-intl', 'tech-htgr', 'tech-micro']],
  'corporate-professional': ['corp', ['tech-intl', 'tech-bwr', 'tech-micro']],
};
/** Two drafts that show the editing workflow (not published, so staff and the public never read them). */
const DRAFTS = [['corporate-professional', 'tech-htgr', 4], ['nuclear-training-instructor', 'tech-fast', 4]];
/** Concept future roles (FS05) a delta may point to, per technology; shown only when an FS05 future edge leads there from the role. */
const TECH_CONCEPTS = {
  'tech-bwr': ['fr-bwr-operator', 'fr-adv-licensing', 'fr-adv-instructor', 'fr-adv-fuel', 'fr-digital-twin'],
  'tech-htgr': ['fr-ht-materials', 'fr-process-heat', 'fr-adv-fuel', 'fr-adv-licensing', 'fr-adv-instructor'],
  'tech-fast': ['fr-liquid-metal', 'fr-adv-fuel', 'fr-adv-licensing', 'fr-adv-instructor'],
  'tech-micro': ['fr-remote-ops', 'fr-digital-twin', 'fr-adv-instructor'],
  'tech-msr': ['fr-salt-chemist', 'fr-adv-fuel', 'fr-adv-licensing'],
  'tech-intl': ['fr-owners-engineer'],
};
const DIM_SKILL = { multi_module: 'sk-fs-adv-multimodule', passive_safety: 'sk-fs-adv-passive', digital_ic: 'sk-fs-dp-dic', factory_fab: 'sk-fs-adv-factoryqa' };
function systemsSkill(group, tech) {
  if (tech === 'tech-intl') return null;
  if (tech === 'tech-micro') return 'sk-fs-adv-micro';
  if (group === 'chem' && (tech === 'tech-fast' || tech === 'tech-msr')) return 'sk-ch-01-advchem';
  if (group === 'eng' && tech !== 'tech-bwr') return 'sk-pf-02-advcool';
  if (group === 'fuel') return 'sk-pf-01-advfuel';
  if (tech === 'tech-bwr') return null; // SMR fundamentals already covers it
  return ['eng', 'rp', 'chem', 'lic'].includes(group) ? 'sk-fs-adv-fuelcycle' : null;
}
const joinEn = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const joinAr = (xs) => xs.map((x, i) => (i ? `و${x}` : x)).join('، ');
const DISCLAIMER = [' Planning assumption; no deployment decision implied.', ' افتراض تخطيطي، ولا يعني ذلك أي قرار بالنشر.'];

/** Compose one delta (role x technology) from the tables above. */
export function composeDelta(T, roleId, techId, rank, status) {
  const role = T.job_roles.find((r) => r.id === roleId);
  const tech = T.adv_technologies.find((x) => x.id === techId);
  if (!role || !tech) throw new Error(`fs38: unknown role or technology ${roleId} ${techId}`);
  const [gk] = ROLES[roleId];
  const g = GROUP[gk];
  const pathOnly = PATH_ONLY_FAMILIES.includes(role.family_id);
  const td = TECH[techId];
  const dims = [];
  for (const d of DIMENSIONS) {
    const t = td[d];
    const lens = g.lens[d];
    if (!t || !lens) continue;
    if (pathOnly) { dims.push({ dim: d, change: 'adapts', text_en: lens[0], text_ar: lens[1] }); continue; }
    const change = g.strong.includes(d) ? t[0] : 'adapts';
    dims.push({ dim: d, change, text_en: `${t[1]} ${lens[0]}`, text_ar: `${t[2]} ${lens[1]}` });
  }
  if (!pathOnly && dims.length === 0) throw new Error(`fs38: ${roleId} x ${techId} has no dimension`);
  const nw = dims.filter((d) => d.change === 'new').map((d) => d.dim);
  const ad = dims.filter((d) => d.change === 'adapts').map((d) => d.dim);
  const fam = [tech.family_en, tech.family_ar];
  let changes_en;
  let changes_ar;
  if (pathOnly) {
    changes_en = `${fam[0]}: career-path view only. Security, safeguards and cyber arrangements for any future fleet are designed and managed outside Kafa'a.`;
    changes_ar = `${fam[1]}: عرض على مستوى المسار المهني فقط. تُصمَّم ترتيبات الأمن والضمانات والأمن السيبراني لأي أسطول مستقبلي وتُدار خارج كفاءة.`;
  } else if (nw.length && ad.length) {
    changes_en = `${fam[0]}: the biggest shifts for this role are ${joinEn(nw.map((d) => DIM_LABEL[d][0]))}; ${joinEn(ad.map((d) => DIM_LABEL[d][0]))} ${ad.length > 1 ? 'adapt' : 'adapts'}.`;
    changes_ar = `${fam[1]}: أكبر التحولات لهذا الدور في ${joinAr(nw.map((d) => DIM_LABEL[d][1]))}، بينما يتكيف كل من ${joinAr(ad.map((d) => DIM_LABEL[d][1]))}.`;
  } else if (nw.length) {
    changes_en = `${fam[0]}: the biggest shifts for this role are ${joinEn(nw.map((d) => DIM_LABEL[d][0]))}.`;
    changes_ar = `${fam[1]}: أكبر التحولات لهذا الدور في ${joinAr(nw.map((d) => DIM_LABEL[d][1]))}.`;
  } else {
    changes_en = `${fam[0]}: for this role ${joinEn(ad.map((d) => DIM_LABEL[d][0]))} ${ad.length > 1 ? 'adapt' : 'adapts'}; the rest stays close to today.`;
    changes_ar = `${fam[1]}: في هذا الدور يتكيف كل من ${joinAr(ad.map((d) => DIM_LABEL[d][1]))}، ويبقى الباقي قريباً مما هو عليه اليوم.`;
  }
  changes_en += DISCLAIMER[0];
  changes_ar += DISCLAIMER[1];
  // skills: SMR fundamentals, one skill per changing dimension, the technology's systems skill; level 2 on strong dimensions of core groups
  const skills = [];
  const add = (id, lvl) => { if (!id) return; const c = skills.find((s) => s.skill_id === id); if (c) c.level = Math.max(c.level, lvl); else skills.push({ skill_id: id, level: lvl }); };
  if (!pathOnly) {
    add('sk-fs-adv-smr', g.level >= 2 ? 2 : 1);
    for (const d of dims) {
      const lvl = g.level >= 2 && g.strong.includes(d.dim) && d.change === 'new' ? 2 : 1;
      if (DIM_SKILL[d.dim]) add(DIM_SKILL[d.dim], lvl);
      if (d.dim === 'maintenance' && ['tech-fast', 'tech-micro', 'tech-msr'].includes(techId) && ['maint', 'outage', 'rp'].includes(gk)) add('sk-fs-dp-robotics', 1);
      if (d.dim === 'systems') add(systemsSkill(gk, techId), lvl);
      if (d.dim === 'delivery') add('sk-en-01-project', lvl);
    }
    if (['lic', 'overs'].includes(gk)) add('sk-fs-adv-regulation', gk === 'lic' ? 2 : 1);
  }
  // delta training: links only (FS31 micro-credential, FS19 courses, FS17 pathways, FS14 lanes)
  const training = [];
  const link = (kind, ref) => { if (training.length < 8 && !training.some((x) => x.kind === kind && x.ref === ref)) training.push({ kind, ref }); };
  if (pathOnly) { link('course', 'c-fs-smr'); link('lane', 'lane-advanced'); } else {
    link('microcred', 'MC-SMR-FOUND');
    link('course', ['corp', 'supply', 'ecp'].includes(gk) ? 'c-fs-smr-x' : 'c-fs-smr');
    if (gk === 'corp') link('course', 'c-fs-plantlit-x');
    link('pathway', 'pw-adv-smr-l1');
    const has = (d) => dims.some((x) => x.dim === d);
    if (has('passive_safety')) { link('course', 'c-fs-passive'); link('pathway', 'pw-adv-passive-l1'); }
    if (has('factory_fab')) { link('course', 'c-fs-factoryqa'); link('lane', 'lane-manufacturing'); }
    if (techId === 'tech-micro') { link('pathway', 'pw-adv-micro-l1'); link('course', 'c-fs-remote'); }
    if (has('digital_ic')) link('pathway', 'pw-dp-dic-l1');
    if (has('multi_module')) link('pathway', 'pw-adv-multimodule-l1');
    if (skills.some((s) => s.skill_id === 'sk-fs-dp-robotics')) link('pathway', 'pw-dp-robotics-l1');
    if (techId === 'tech-htgr') link('lane', 'lane-hydrogen');
    link('lane', 'lane-advanced');
  }
  // sources: the two benchmark sources plus the most relevant research source for the technology or the dimension
  const sources = [SRC.ans, SRC.wfp];
  if (techId === 'tech-bwr') sources.push(SRC.gev);
  if (dims.some((d) => d.dim === 'multi_module' && d.change === 'new')) sources.push(SRC.e2);
  if (techId === 'tech-intl') sources.push(SRC.match);
  if (dims.some((d) => d.dim === 'digital_ic' && d.change === 'new')) sources.push(SRC.iaeaai);
  if (['corp', 'supply'].includes(gk)) sources.push(SRC.sask);
  const futureTo = new Set(T.career_paths.filter((p) => p.kind === 'future' && p.from_role_id === roleId).map((p) => p.to_role_id));
  const concepts = (TECH_CONCEPTS[techId] ?? []).filter((c) => futureTo.has(c));
  return {
    id: `smrd:${roleId}:${techId}`, role_id: roleId, tech_id: techId, rank, path_only: pathOnly, dims, changes_en, changes_ar, stays_en: g.stays[0], stays_ar: g.stays[1],
    skills, training, concept_role_ids: concepts, sources: sources.slice(0, 5), benchmark_ids: ['SMR-WF', 'IAEA-WFP'], status, listed: status === 'published', version: 1, as_of: AS_OF, sort: 0,
    updated_by: 'p-training-mgr', updated_at: `${AS_OF}T08:00:00Z`,
  };
}

// ───────────── FS40 drills (synthetic trend sets)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;
const r1 = (x) => Math.round(x * 10) / 10;
const TT = Array.from({ length: 24 }, (_, i) => i + 1);
/** A synthetic signal: base + linear trend from `start` + optional sine + deterministic noise. */
function sig(id, en, ar, unit, band, { base, slope = 0, start = 0, amp = 0, period = 6, grow = 0, noise = 0.6 }) {
  const values = TT.map((t, i) => r1(base + (i >= start ? slope * (i - start) : 0) + (amp + grow * i) * Math.sin((2 * Math.PI * i) / period) + noise * (rnd(`tw:${id}:${i}`) - 0.5) * 2));
  return { id, name_en: en, name_ar: ar, unit, values, band };
}
const o = (id, en, ar) => ({ id, en, ar });
const ck = (id, en, ar, minutes, ren, rar) => ({ id, en, ar, minutes, result_en: ren, result_ar: rar });
export const TWINS = [
  {
    id: 'tw-fw-bearing', code: 'SYN-TW-101', difficulty: 1, level: 1, est_minutes: 10, max_checks: 3, status: 'published', skill_ids: ['sk-fs-ai-twin', 'sk-fs-ai-anomaly'],
    title_en: 'Pump bearing wear', title_ar: 'تآكل محمل مضخة',
    summary_en: 'Vibration and bearing temperature drift above the model band on a synthetic feedwater pump. Find the cause before it trips.', summary_ar: 'يرتفع الاهتزاز وحرارة المحمل فوق نطاق النموذج في مضخة تغذية اصطناعية. حدّد السبب قبل أن تتوقف.',
    scenario_en: 'You are on the plant-health team. The digital twin of a synthetic main feedwater pump has flagged a divergence over the last two weeks. You may run three checks, then name the degrading component, its failure mode and what you would do.',
    scenario_ar: 'أنت في فريق سلامة المحطة. رصد التوأم الرقمي لمضخة تغذية رئيسية اصطناعية انحرافاً خلال الأسبوعين الماضيين. يمكنك إجراء ثلاثة فحوص، ثم تحديد المكوّن المتدهور ونمط عطله وما الذي ستفعله.',
    system_en: 'Synthetic main feedwater pump model (SIMULATED)', system_ar: 'نموذج مضخة تغذية رئيسية اصطناعي (محاكاة)',
    series: (x) => [
      sig('vib', 'Bearing vibration', 'اهتزاز المحمل', '% norm', [30, 60], { base: 42, slope: 2.4, start: 10, noise: 1.2 }),
      sig('btemp', 'Bearing temperature index', 'مؤشر حرارة المحمل', 'index', [40, 70], { base: 52, slope: 1.3, start: 13, noise: 0.8 }),
      sig('flow', 'Pump flow', 'تدفق المضخة', '% norm', [92, 108], { base: 100, noise: 1.0 }),
      sig('amps', 'Motor current', 'تيار المحرك', '% norm', [62, 80], { base: 70, slope: 0.25, start: 12, noise: 0.6 }),
    ][x],
    components: [o('bearing', 'Pump bearing', 'محمل المضخة'), o('motor', 'Drive motor', 'محرك الإدارة'), o('valve', 'Discharge control valve', 'صمام التحكم في التصريف'), o('ft', 'Flow transmitter', 'مرسل التدفق'), o('coupling', 'Shaft coupling', 'وصلة العمود')],
    modes: [o('lube', 'Lubrication degradation', 'تدهور التزييت'), o('misalign', 'Shaft misalignment', 'عدم استقامة العمود'), o('drift', 'Sensor drift', 'انجراف المستشعر')],
    checks: [
      ck('oil', 'Oil sample analysis', 'تحليل عينة الزيت', 120, 'Elevated wear-metal particles and darkened oil in the bearing sample.', 'جزيئات معادن تآكل مرتفعة وزيت داكن في عينة المحمل.'),
      ck('spectrum', 'Vibration spectrum review', 'مراجعة طيف الاهتزاز', 30, 'Energy sits at bearing defect frequencies, not at running speed: it points to the bearing, not misalignment.', 'تتركز الطاقة عند ترددات عيوب المحمل لا عند سرعة الدوران: يشير ذلك إلى المحمل لا إلى عدم الاستقامة.'),
      ck('redundant', 'Compare the redundant temperature sensor', 'مقارنة مستشعر الحرارة الاحتياطي', 15, 'The redundant sensor shows the same rising trend: the temperature rise is real.', 'يُظهر المستشعر الاحتياطي الاتجاه الصاعد نفسه: ارتفاع الحرارة حقيقي.'),
      ck('align', 'Laser alignment check', 'فحص الاستقامة بالليزر', 240, 'Alignment is within tolerance.', 'الاستقامة ضمن الحدود المسموحة.'),
      ck('grid', 'Check grid frequency', 'فحص تردد الشبكة', 10, 'Grid frequency is normal.', 'تردد الشبكة طبيعي.'),
      ck('alarm', 'Raise the vibration alarm limit to stop nuisance alerts', 'رفع حد إنذار الاهتزاز لإيقاف التنبيهات المزعجة', 5, 'Alarm limit raised: the warning no longer shows.', 'رُفع حد الإنذار: لم يعد التحذير يظهر.'),
    ],
    actions: [
      o('swap', 'Raise a condition report and plan a controlled swap to the standby pump for a bearing inspection', 'رفع تقرير حالة وتخطيط تحويل منضبط إلى المضخة الاحتياطية لفحص المحمل'),
      o('monitor', 'Raise a condition report, increase monitoring and inspect at the next planned window', 'رفع تقرير حالة وزيادة المراقبة والفحص في النافذة المخططة التالية'),
      o('continue', 'Continue normal operation: the trend is still inside the trip limit', 'مواصلة التشغيل العادي: الاتجاه ما زال ضمن حد التوقف'),
      o('override', 'Raise the trip limit so the pump keeps running', 'رفع حد التوقف كي تواصل المضخة العمل'),
    ],
    rationales: [
      o('r1', 'Two independent signals, vibration and temperature, agree', 'يتفق مؤشران مستقلان، الاهتزاز والحرارة'),
      o('r2', 'The spectrum points to the bearing, not misalignment', 'يشير الطيف إلى المحمل لا إلى عدم الاستقامة'),
      o('r3', 'Flow is steady, so the pump is healthy', 'التدفق مستقر، إذن المضخة سليمة'),
      o('r4', 'A standby pump allows a controlled, low-risk swap', 'تتيح المضخة الاحتياطية تحويلاً منضبطاً منخفض المخاطر'),
      o('r5', 'The alarm is probably a nuisance', 'الإنذار على الأرجح مزعج فقط'),
    ],
    key: {
      component_id: 'bearing', mode_id: 'lube', useful_checks: ['oil', 'spectrum', 'redundant'], unsafe_checks: ['alarm'], conservative_actions: ['swap', 'monitor'], best_action: 'swap', unsafe_actions: ['override'],
      sound_rationales: ['r1', 'r2', 'r4'], pass_pct: 70,
      explain: {
        component: { en: 'The bearing: vibration at defect frequencies, rising temperature confirmed by a redundant sensor and wear metal in the oil.', ar: 'المحمل: اهتزاز عند ترددات العيوب وارتفاع حرارة يؤكده مستشعر احتياطي ومعادن تآكل في الزيت.' },
        mode: { en: 'Lubrication degradation: darkened oil with wear particles, while alignment is within tolerance.', ar: 'تدهور التزييت: زيت داكن به جزيئات تآكل، بينما الاستقامة ضمن الحدود.' },
        action: { en: 'A controlled swap to the standby pump removes the degrading pump from service before it trips; hiding the alarm or raising the trip limit removes protection.', ar: 'يُخرج التحويل المنضبط إلى المضخة الاحتياطية المضخة المتدهورة من الخدمة قبل توقفها؛ أما إخفاء الإنذار أو رفع حد التوقف فيزيل الحماية.' },
      },
    },
  },
  {
    id: 'tw-hx-fouling', code: 'SYN-TW-102', difficulty: 2, level: 1, est_minutes: 12, max_checks: 3, status: 'published', skill_ids: ['sk-fs-ai-twin', 'sk-fs-ai-plantdata'],
    title_en: 'Heat exchanger fouling', title_ar: 'ترسبات في مبادل حراري',
    summary_en: 'Outlet temperature and differential pressure creep up on a synthetic cooling heat exchanger while the inlet stays steady.', summary_ar: 'ترتفع حرارة المخرج وفرق الضغط تدريجياً في مبادل تبريد اصطناعي بينما يبقى المدخل مستقراً.',
    scenario_en: 'The twin of a synthetic component cooling heat exchanger shows a slow divergence over three weeks. You may run three checks, then decide what is degrading and what to do.',
    scenario_ar: 'يُظهر التوأم الرقمي لمبادل حراري اصطناعي لتبريد المكونات انحرافاً بطيئاً على مدى ثلاثة أسابيع. يمكنك إجراء ثلاثة فحوص، ثم تحديد ما يتدهور وما يجب فعله.',
    system_en: 'Synthetic component cooling heat exchanger model (SIMULATED)', system_ar: 'نموذج مبادل حراري اصطناعي لتبريد المكونات (محاكاة)',
    series: (x) => [
      sig('dp', 'Differential pressure', 'فرق الضغط', 'index', [40, 62], { base: 48, slope: 0.95, start: 4, noise: 0.7 }),
      sig('tout', 'Outlet temperature index', 'مؤشر حرارة المخرج', 'index', [38, 55], { base: 44, slope: 0.6, start: 6, noise: 0.5 }),
      sig('flowc', 'Cooling-water flow', 'تدفق ماء التبريد', '% norm', [90, 110], { base: 100, slope: -0.45, start: 6, noise: 0.8 }),
      sig('tin', 'Inlet temperature index', 'مؤشر حرارة المدخل', 'index', [25, 36], { base: 30, noise: 0.6 }),
    ][x],
    components: [o('tubes', 'Heat exchanger tubes', 'أنابيب المبادل الحراري'), o('valve', 'Cooling-water control valve', 'صمام التحكم في ماء التبريد'), o('pump', 'Cooling-water pump', 'مضخة ماء التبريد'), o('ts', 'Outlet temperature sensor', 'مستشعر حرارة المخرج')],
    modes: [o('fouling', 'Tube fouling', 'ترسبات على الأنابيب'), o('partial', 'Valve partly closed', 'صمام مغلق جزئياً'), o('drift', 'Sensor drift', 'انجراف المستشعر')],
    checks: [
      ck('valvepos', 'Compare valve position with demand', 'مقارنة موضع الصمام بالطلب', 15, 'Valve position matches demand: the valve is not the cause.', 'موضع الصمام يطابق الطلب: الصمام ليس السبب.'),
      ck('dpmodel', 'Compare measured and model differential pressure', 'مقارنة فرق الضغط المقاس بقيمة النموذج', 20, 'Measured differential pressure rises steadily above the model\'s clean-condition value.', 'يرتفع فرق الضغط المقاس باطراد فوق قيمة النموذج للحالة النظيفة.'),
      ck('intake', 'Review the intake water-quality log', 'مراجعة سجل جودة ماء السحب', 30, 'Biofouling notes were recorded on the intake screens in recent weeks.', 'سُجلت ملاحظات عن ترسبات حيوية على مصافي السحب في الأسابيع الأخيرة.'),
      ck('pumpcurve', 'Check the pump against its curve', 'فحص المضخة مقابل منحناها', 30, 'The pump runs on its curve.', 'تعمل المضخة على منحناها.'),
      ck('retune', 'Retune the twin to match the plant so the alert clears', 'إعادة ضبط التوأم ليطابق المحطة فيختفي التنبيه', 10, 'Model retuned: the divergence disappears from the screen.', 'أُعيد ضبط النموذج: اختفى الانحراف من الشاشة.'),
    ],
    actions: [
      o('clean', 'Raise a work request to clean the exchanger at a planned window and watch the margins closely', 'رفع طلب عمل لتنظيف المبادل في نافذة مخططة ومراقبة الهوامش عن كثب'),
      o('swap', 'Swap to the redundant exchanger train under procedure, then plan the cleaning', 'التحويل إلى مسار المبادل الاحتياطي وفق الإجراء ثم تخطيط التنظيف'),
      o('leave', 'Leave it: the outlet temperature is still within band', 'تركه: حرارة المخرج ما زالت ضمن النطاق'),
      o('bypass', 'Bypass the temperature alarm until the cleaning', 'تجاوز إنذار الحرارة حتى موعد التنظيف'),
    ],
    rationales: [
      o('r1', 'Differential pressure and outlet temperature rise together while the inlet is steady', 'يرتفع فرق الضغط وحرارة المخرج معاً بينما المدخل مستقر'),
      o('r2', 'The valve position rules out a closed valve', 'يستبعد موضع الصمام وجود صمام مغلق'),
      o('r3', 'Flow falls only a little, so there is no problem', 'ينخفض التدفق قليلاً فقط، إذن لا مشكلة'),
      o('r4', 'The model must be wrong because it disagrees with the plant', 'لا بد أن النموذج خاطئ لأنه يخالف المحطة'),
      o('r5', 'Cleaning at a planned window keeps margin while removing the cause', 'التنظيف في نافذة مخططة يحفظ الهامش ويزيل السبب'),
    ],
    key: {
      component_id: 'tubes', mode_id: 'fouling', useful_checks: ['valvepos', 'dpmodel', 'intake'], unsafe_checks: ['retune'], conservative_actions: ['clean', 'swap'], best_action: 'clean', unsafe_actions: ['bypass'],
      sound_rationales: ['r1', 'r2', 'r5'], pass_pct: 70,
      explain: {
        component: { en: 'The tubes: differential pressure rises above the clean-condition model while the valve and pump behave normally.', ar: 'الأنابيب: يرتفع فرق الضغط فوق نموذج الحالة النظيفة بينما يعمل الصمام والمضخة بشكل طبيعي.' },
        mode: { en: 'Fouling: biofouling notes at the intake and a slow, steady loss of heat transfer.', ar: 'الترسبات: ملاحظات عن ترسبات حيوية عند السحب وفقدان بطيء ومطرد في انتقال الحرارة.' },
        action: { en: 'Clean at a planned window while watching margins; retuning the twin to the plant hides a real degradation.', ar: 'التنظيف في نافذة مخططة مع مراقبة الهوامش؛ أما إعادة ضبط التوأم ليطابق المحطة فتخفي تدهوراً حقيقياً.' },
      },
    },
  },
  {
    id: 'tw-sensor-drift', code: 'SYN-TW-103', difficulty: 2, level: 2, est_minutes: 12, max_checks: 3, status: 'published', skill_ids: ['sk-fs-ai-twin', 'sk-fs-ai-plantdata', 'sk-fs-ai-anomaly'],
    title_en: 'Twin and plant disagree: one channel drifts', title_ar: 'التوأم والمحطة مختلفان: قناة واحدة تنجرف',
    summary_en: 'One of three redundant level channels moves away from the twin. Is the process changing, or the instrument?', summary_ar: 'تبتعد إحدى ثلاث قنوات مستوى مكررة عن التوأم. هل تتغير العملية أم الجهاز؟',
    scenario_en: 'A synthetic tank level is measured by three redundant channels. Channel A has crept away from the twin estimate for two weeks. Decide what is wrong before anyone acts on it.',
    scenario_ar: 'يُقاس مستوى خزان اصطناعي بثلاث قنوات مكررة. ابتعدت القناة أ تدريجياً عن تقدير التوأم لمدة أسبوعين. حدّد الخلل قبل أن يتصرف أحد بناءً عليه.',
    system_en: 'Synthetic storage tank level model (SIMULATED)', system_ar: 'نموذج مستوى خزان تخزين اصطناعي (محاكاة)',
    series: (x) => [
      sig('cha', 'Level channel A', 'قناة المستوى أ', '%', [44, 56], { base: 50, slope: 0.55, start: 8, noise: 0.4 }),
      sig('chb', 'Level channel B', 'قناة المستوى ب', '%', [44, 56], { base: 50, noise: 0.4 }),
      sig('chc', 'Level channel C', 'قناة المستوى ج', '%', [44, 56], { base: 50, noise: 0.4 }),
      sig('twin', 'Twin estimate', 'تقدير التوأم', '%', [44, 56], { base: 50, noise: 0.15 }),
    ][x],
    components: [o('cha', 'Level transmitter A', 'مرسل المستوى أ'), o('process', 'The tank level itself', 'مستوى الخزان نفسه'), o('chb', 'Level transmitter B', 'مرسل المستوى ب'), o('twin', 'The twin model', 'نموذج التوأم')],
    modes: [o('drift', 'Instrument drift', 'انجراف الجهاز'), o('real', 'A real process change', 'تغير حقيقي في العملية'), o('model', 'Model error', 'خطأ في النموذج')],
    checks: [
      ck('compare', 'Compare the three redundant channels', 'مقارنة القنوات المكررة الثلاث', 10, 'Channels B and C agree with the twin; only A moves away.', 'تتفق القناتان ب وج مع التوأم؛ وحدها القناة أ تبتعد.'),
      ck('calib', 'Review channel A\'s calibration history', 'مراجعة سجل معايرة القناة أ', 20, 'Channel A is near the end of its calibration interval.', 'القناة أ قريبة من نهاية فترة معايرتها.'),
      ck('mass', 'Check the mass balance of flows in and out', 'فحص توازن الكتلة للتدفقات الداخلة والخارجة', 30, 'Flows in and out balance: the real level is steady.', 'التدفقات الداخلة والخارجة متوازنة: المستوى الحقيقي مستقر.'),
      ck('replaceb', 'Replace transmitter B', 'استبدال المرسل ب', 120, 'Transmitter B replaced; readings unchanged.', 'استُبدل المرسل ب؛ ولم تتغير القراءات.'),
      ck('retune', 'Retune the twin to follow channel A', 'إعادة ضبط التوأم ليتبع القناة أ', 10, 'Model retuned to channel A: the alert clears.', 'أُعيد ضبط النموذج على القناة أ: اختفى التنبيه.'),
    ],
    actions: [
      o('suspect', 'Follow the procedure for a suspect channel and raise a calibration work request; keep the twin as it is', 'اتباع إجراء القناة المشكوك فيها ورفع طلب عمل للمعايرة؛ وإبقاء التوأم كما هو'),
      o('watch', 'Log channel A as suspect and watch it closely until calibration', 'تسجيل القناة أ كقناة مشكوك فيها ومراقبتها عن كثب حتى المعايرة'),
      o('ignore', 'Ignore it: two channels are fine', 'تجاهلها: قناتان سليمتان'),
      o('adjust', 'Adjust the process to bring channel A back into band', 'ضبط العملية لإعادة القناة أ إلى النطاق'),
    ],
    rationales: [
      o('r1', 'Two redundant channels and the twin agree; one channel disagrees', 'تتفق قناتان مكررتان والتوأم؛ وتخالفها قناة واحدة'),
      o('r2', 'The mass balance shows the process is steady', 'يُظهر توازن الكتلة أن العملية مستقرة'),
      o('r3', 'A twin is validated against independent data, not tuned to one sensor', 'يُتحقق من صحة التوأم ببيانات مستقلة، ولا يُضبط على مستشعر واحد'),
      o('r4', 'The newest reading is always right', 'القراءة الأحدث صحيحة دائماً'),
      o('r5', 'Retuning the model removes the alarm', 'إعادة ضبط النموذج تزيل الإنذار'),
    ],
    key: {
      component_id: 'cha', mode_id: 'drift', useful_checks: ['compare', 'calib', 'mass'], unsafe_checks: ['retune'], conservative_actions: ['suspect', 'watch'], best_action: 'suspect', unsafe_actions: ['adjust'],
      sound_rationales: ['r1', 'r2', 'r3'], pass_pct: 75,
      explain: {
        component: { en: 'Transmitter A: the other two channels, the twin and the mass balance all say the level is steady.', ar: 'المرسل أ: تقول القناتان الأخريان والتوأم وتوازن الكتلة جميعاً إن المستوى مستقر.' },
        mode: { en: 'Instrument drift near the end of the calibration interval, not a process change and not a model error.', ar: 'انجراف في الجهاز قرب نهاية فترة المعايرة، وليس تغيراً في العملية ولا خطأ في النموذج.' },
        action: { en: 'Treat channel A as suspect under procedure and calibrate it. Adjusting the process to a bad reading moves the real level; retuning the twin to it breaks the twin.', ar: 'عامل القناة أ كقناة مشكوك فيها وفق الإجراء وعايرها. ضبط العملية على قراءة خاطئة يحرّك المستوى الحقيقي، وإعادة ضبط التوأم عليها تُفسد التوأم.' },
      },
    },
  },
  {
    id: 'tw-valve-stiction', code: 'SYN-TW-104', difficulty: 3, level: 2, est_minutes: 15, max_checks: 3, status: 'published', skill_ids: ['sk-fs-ai-anomaly', 'sk-fs-dp-dic'],
    title_en: 'A control loop that will not settle', title_ar: 'حلقة تحكم لا تستقر',
    summary_en: 'Flow oscillates around its setpoint and the oscillation is growing. Controller, sensor or valve?', summary_ar: 'يتذبذب التدفق حول نقطة الضبط ويتزايد التذبذب. هل هو المتحكم أم المستشعر أم الصمام؟',
    scenario_en: 'A synthetic flow control loop started cycling ten days ago. The twin shows demand and valve position moving apart. You may run three checks before you decide.',
    scenario_ar: 'بدأت حلقة تحكم في تدفق اصطناعية بالتذبذب قبل عشرة أيام. يُظهر التوأم أن الطلب وموضع الصمام يتباعدان. يمكنك إجراء ثلاثة فحوص قبل أن تقرر.',
    system_en: 'Synthetic flow control loop model (SIMULATED)', system_ar: 'نموذج حلقة تحكم في تدفق اصطناعية (محاكاة)',
    series: (x) => [
      sig('flow', 'Flow', 'التدفق', '% norm', [94, 106], { base: 100, amp: 0.5, grow: 0.28, period: 5, noise: 0.4 }),
      sig('demand', 'Valve demand', 'طلب الصمام', '%', [45, 55], { base: 50, amp: 0.4, grow: 0.22, period: 5, noise: 0.3 }),
      sig('pos', 'Valve position', 'موضع الصمام', '%', [45, 55], { base: 50, amp: 0.2, grow: 0.12, period: 5, noise: 0.9 }),
      sig('sp', 'Setpoint', 'نقطة الضبط', '% norm', [99, 101], { base: 100, noise: 0 }),
    ][x],
    components: [o('valve', 'Control valve packing and actuator', 'حشوة الصمام ومشغّله'), o('controller', 'Flow controller tuning', 'ضبط متحكم التدفق'), o('ft', 'Flow transmitter', 'مرسل التدفق'), o('pump', 'Supply pump', 'مضخة الإمداد')],
    modes: [o('stiction', 'Stiction: stick-slip in the valve', 'الالتصاق: حركة متقطعة في الصمام'), o('tuning', 'Aggressive controller tuning', 'ضبط مفرط للمتحكم'), o('noise', 'Sensor noise', 'ضوضاء المستشعر')],
    checks: [
      ck('travel', 'Valve travel test in manual, under procedure', 'اختبار حركة الصمام يدوياً وفق الإجراء', 60, 'The valve sticks, then jumps: a classic stick-slip signature.', 'يلتصق الصمام ثم يقفز: بصمة تقليدية للحركة المتقطعة.'),
      ck('plot', 'Plot demand against position', 'رسم الطلب مقابل الموضع', 15, 'Position lags demand and moves in steps: hysteresis in the valve.', 'يتأخر الموضع عن الطلب ويتحرك على شكل خطوات: تخلّف في الصمام.'),
      ck('tunelog', 'Review the controller tuning history', 'مراجعة سجل ضبط المتحكم', 20, 'No tuning change in the last six months.', 'لا تغيير في الضبط خلال الأشهر الستة الماضية.'),
      ck('noise', 'Check transmitter noise', 'فحص ضوضاء المرسل', 10, 'Signal noise is low.', 'ضوضاء الإشارة منخفضة.'),
      ck('gain', 'Increase controller gain to fight the oscillation', 'زيادة كسب المتحكم لمقاومة التذبذب', 5, 'Gain increased: the oscillation grows.', 'زِيد الكسب: ازداد التذبذب.'),
    ],
    actions: [
      o('wr', 'Put the loop in a stable, supervised mode under procedure and raise a work request for valve packing and actuator maintenance', 'وضع الحلقة في نمط مستقر تحت الإشراف وفق الإجراء ورفع طلب عمل لصيانة حشوة الصمام ومشغّله'),
      o('cr', 'Raise a condition report, monitor and plan valve maintenance at the next window', 'رفع تقرير حالة والمراقبة وتخطيط صيانة الصمام في النافذة التالية'),
      o('retune', 'Retune the controller to hide the oscillation', 'إعادة ضبط المتحكم لإخفاء التذبذب'),
      o('limits', 'Remove the controller\'s output limits', 'إزالة حدود مخرج المتحكم'),
    ],
    rationales: [
      o('r1', 'Position moves in steps while demand changes smoothly', 'يتحرك الموضع على شكل خطوات بينما يتغير الطلب بسلاسة'),
      o('r2', 'No tuning change explains when it started', 'لا يوجد تغيير في الضبط يفسر بداية المشكلة'),
      o('r3', 'Fixing the valve removes the cause rather than the symptom', 'إصلاح الصمام يزيل السبب لا العَرَض'),
      o('r4', 'Oscillation is normal for this loop', 'التذبذب طبيعي في هذه الحلقة'),
      o('r5', 'Higher gain always improves control', 'الكسب الأعلى يحسّن التحكم دائماً'),
    ],
    key: {
      component_id: 'valve', mode_id: 'stiction', useful_checks: ['travel', 'plot', 'tunelog'], unsafe_checks: ['gain'], conservative_actions: ['wr', 'cr'], best_action: 'wr', unsafe_actions: ['limits'],
      sound_rationales: ['r1', 'r2', 'r3'], pass_pct: 75,
      explain: {
        component: { en: 'The valve: position moves in steps against a smooth demand, with no tuning change and a clean signal.', ar: 'الصمام: يتحرك الموضع على شكل خطوات مقابل طلب سلس، دون تغيير في الضبط ومع إشارة نظيفة.' },
        mode: { en: 'Stiction: the travel test shows stick-slip.', ar: 'الالتصاق: يُظهر اختبار الحركة حركة متقطعة.' },
        action: { en: 'Stabilise the loop under procedure and fix the valve; more gain or no output limits make it worse or remove protection.', ar: 'ثبّت الحلقة وفق الإجراء وأصلح الصمام؛ فالمزيد من الكسب أو إزالة حدود المخرج يزيد الأمر سوءاً أو يزيل الحماية.' },
      },
    },
  },
  {
    id: 'tw-fan-degradation', code: 'SYN-TW-105', difficulty: 1, level: 1, est_minutes: 8, max_checks: 2, status: 'draft', skill_ids: ['sk-fs-ai-anomaly'],
    title_en: 'Cooling fan running warm', title_ar: 'مروحة تبريد تعمل بحرارة مرتفعة',
    summary_en: 'Draft: a synthetic transformer cooling fan whose temperature creeps up.', summary_ar: 'مسودة: مروحة تبريد محوّل اصطناعية ترتفع حرارتها تدريجياً.',
    scenario_en: 'Draft scenario under review by the training manager.', scenario_ar: 'سيناريو مسودة قيد المراجعة من مدير التدريب.',
    system_en: 'Synthetic transformer cooling model (SIMULATED)', system_ar: 'نموذج تبريد محوّل اصطناعي (محاكاة)',
    series: (x) => [
      sig('ftemp', 'Fan motor temperature index', 'مؤشر حرارة محرك المروحة', 'index', [30, 55], { base: 40, slope: 0.7, start: 8, noise: 0.6 }),
      sig('famps', 'Fan current', 'تيار المروحة', '% norm', [85, 110], { base: 98, slope: 0.3, start: 8, noise: 0.6 }),
    ][x],
    components: [o('fanmotor', 'Fan motor', 'محرك المروحة'), o('blades', 'Fan blades', 'شفرات المروحة'), o('ts', 'Temperature sensor', 'مستشعر الحرارة')],
    modes: [o('bearing', 'Motor bearing wear', 'تآكل محمل المحرك'), o('dirt', 'Dirt on the blades', 'أوساخ على الشفرات')],
    checks: [
      ck('thermo', 'Thermographic survey', 'مسح حراري بالأشعة تحت الحمراء', 30, 'The motor end bell is hotter than the fan casing.', 'غطاء نهاية المحرك أسخن من غلاف المروحة.'),
      ck('visual', 'Visual inspection of the blades', 'فحص بصري للشفرات', 20, 'Blades are clean.', 'الشفرات نظيفة.'),
      ck('ignore', 'Silence the temperature alert', 'إسكات تنبيه الحرارة', 2, 'Alert silenced.', 'أُسكت التنبيه.'),
    ],
    actions: [o('plan', 'Plan motor bearing replacement and monitor', 'تخطيط استبدال محمل المحرك والمراقبة'), o('swap', 'Start the standby fan and inspect', 'تشغيل المروحة الاحتياطية والفحص'), o('wait', 'Wait for the next outage', 'الانتظار حتى فترة الإيقاف التالية')],
    rationales: [o('r1', 'Heat is at the motor, not the blades', 'الحرارة في المحرك لا في الشفرات'), o('r2', 'Current rises with temperature', 'يرتفع التيار مع الحرارة'), o('r3', 'Fans never fail', 'المراوح لا تتعطل أبداً')],
    key: { component_id: 'fanmotor', mode_id: 'bearing', useful_checks: ['thermo', 'visual'], unsafe_checks: ['ignore'], conservative_actions: ['plan', 'swap'], best_action: 'swap', unsafe_actions: [], sound_rationales: ['r1', 'r2'], pass_pct: 70, explain: {} },
  },
];
const SIG_N = { 'tw-fw-bearing': 4, 'tw-hx-fouling': 4, 'tw-sensor-drift': 4, 'tw-valve-stiction': 4, 'tw-fan-degradation': 2 };
/** Drill rows (what the taker sees) and key rows (training staff only). */
export function twinRows() {
  const scenarios = [];
  const keys = [];
  TWINS.forEach((d, i) => {
    const series = { t_en: 'Day', t_ar: 'اليوم', t: TT, signals: Array.from({ length: SIG_N[d.id] }, (_, x) => d.series(x)) };
    const { key, series: _s, ...rest } = d;
    void _s;
    scenarios.push({ ...rest, series, synthetic: true, sources: [SRC.iaeaai, SRC.ans], listed: d.status === 'published', version: 1, sort: i + 1, updated_by: 'p-training-mgr', updated_at: `${AS_OF}T08:00:00Z` });
    keys.push({ id: `twk-${d.id}`, scenario_id: d.id, ...key });
  });
  return { scenarios, keys };
}

/** FS38 deltas (in finalize: FS17 pathways, FS19 courses and FS31 micro-credentials are built by FINALIZE_LAST builders that sort earlier). */
function buildDeltas(T) {
  const skills = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  const refs = {
    microcred: T.microcred_defs.filter((m) => m.status === 'current').map((m) => m.code), course: T.courses.map((c) => c.id),
    pathway: T.pathways.filter((p) => p.status === 'published').map((p) => p.id), lane: T.horizon_lanes.map((l) => l.id),
  };
  const current = T.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
  if (current.length !== 28) throw new Error(`fs38: expected 28 current roles, found ${current.length}`);
  const deltas = [];
  for (const r of current) {
    const plan = ROLES[r.id];
    if (!plan) throw new Error(`fs38: no delta plan for role ${r.id}`);
    plan[1].forEach((tech, i) => deltas.push(composeDelta(T, r.id, tech, i + 1, 'published')));
  }
  for (const [role, tech, rank] of DRAFTS) deltas.push(composeDelta(T, role, tech, rank, 'draft'));
  deltas.forEach((d, i) => { d.sort = i + 1; });
  for (const d of deltas) {
    const role = T.job_roles.find((r) => r.id === d.role_id);
    const p = deltaProblem({ ...d }, { family: role.family_id, skills, refs });
    if (p) throw new Error(`fs38: delta ${d.id} fails the delta check (${p})`);
  }
  T.smr_deltas = deltas;
}

export default function build(T) {
  // FS40 drills
  const { scenarios, keys } = twinRows();
  for (const s of scenarios) {
    const k = keys.find((x) => x.scenario_id === s.id);
    const p = twinProblem({ ...s, key: k }, TWIN_SKILLS);
    if (p) throw new Error(`fs40: drill ${s.id} fails the drill check (${p})`);
  }
  T.twin_scenarios = scenarios;
  T.twin_keys = keys;
  T.twin_attempts = [];
  T.plant_visits = [];
}

// ───────────── finalize: FS39 visits and FS40 attempts, then states and derived snapshots
const day = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Demo visits for personas (visitor, kind, host, date, hours, status, note, decline reason). */
const DEMO_VISITS = [
  ['p-qc-inspector', 'reference_plant', 'p-k-instructor', '2026-05-12', 6, 'confirmed', 'Guided walk-down on the visitor route with the operations instructor.'],
  ['p-qc-inspector', 'simulator_observation', 'p-training-mgr', '2026-08-19', 6, 'confirmed', 'Observed a crew scenario from the simulator gallery.'],
  ['p-buyer', 'simulator_observation', 'p-sq-lead', '2026-07-08', 3, 'confirmed', 'Observed a crew turnover and a short transient.'],
  ['p-buyer', 'reference_plant', 'p-k-instructor', '2026-10-06', 4, 'logged', 'Visitor-route tour of the turbine hall.'],
  ['p-nse', 'partner_facility', 'p-training-mgr', '2026-06-23', 8, 'confirmed', 'Partner reference plant visit during a technical exchange.'],
  ['p-cap-coord', 'reference_plant', 'p-sro', '2026-09-02', 3, 'declined', 'Short visit after the safety stand-down.', 'The planned visit was cancelled on the day; please log it again once it takes place.'],
  ['p-outage-planner', 'simulator_observation', 'p-k-instructor', '2026-10-01', 2.5, 'logged', 'Watched a refuelling-outage briefing scenario.'],
  ['p-sme-reviewer', 'reference_plant', 'p-sro', '2026-10-05', 3, 'logged', ''],
  ['p-doa-signatory', 'simulator_observation', 'p-training-mgr', '2026-10-07', 2, 'logged', 'Leadership simulator familiarisation.'],
  ['p-fuel-pm', 'partner_facility', 'p-head-sq', '2026-04-14', 5, 'withdrawn', 'Logged twice by mistake.'],
];
const NOTES = [
  ['Visitor-route tour with the plant host.', ''], ['Observed a crew scenario from the gallery.', ''], ['Technical exchange visit.', ''], ['', ''],
];

function simulateVisits(T, now) {
  const hosts = eligibleHosts(T.people, T.role_assignments, null);
  const visits = [];
  DEMO_VISITS.forEach(([pid, kind, host, on, hours, status, note, reason], i) => {
    visits.push({ id: `pv-demo-${String(i + 1).padStart(2, '0')}`, person_id: pid, kind, host_person_id: host, visit_on: on, hours, note: note ?? '', status, reason: reason ?? null });
  });
  // Synthetic non-operator staff (engineering, quality, supply chain, corporate, training): about half log one or two visits.
  const fams = ['corporate', 'supply-chain', 'quality', 'engineering', 'training', 'licensing', 'environment', 'chemistry', 'radiation-protection', 'outage'];
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && !p.persona_id && fams.includes(p.job_family_id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const p of staff) {
    if (rnd(`pv:take:${p.id}`) >= 0.6) continue;
    const n = 1 + Math.floor(rnd(`pv:n:${p.id}`) * 2);
    let date = day('2026-03-02', Math.floor(rnd(`pv:start:${p.id}`) * 150));
    for (let k = 0; k < n; k++) {
      if (date > now) break;
      const kind = ['reference_plant', 'simulator_observation', 'partner_facility'][Math.floor(rnd(`pv:kind:${p.id}:${k}`) * (k === 0 ? 2 : 3))];
      const pool = hosts.filter((h) => h !== p.id);
      const host = pool[Math.floor(rnd(`pv:host:${p.id}:${k}`) * pool.length)];
      const hours = [2, 3, 4, 6, 7.5, 8][Math.floor(rnd(`pv:h:${p.id}:${k}`) * 6)];
      const r = rnd(`pv:status:${p.id}:${k}`);
      const age = Date.parse(`${now}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`);
      const status = age < 10 * 86400000 ? 'logged' : r < 0.86 ? 'confirmed' : r < 0.95 ? 'declined' : 'withdrawn';
      const nt = NOTES[Math.floor(rnd(`pv:note:${p.id}:${k}`) * NOTES.length)][0];
      visits.push({ id: `pv-${p.id.replace(/^[pw]-/, '')}-${k + 1}`, person_id: p.id, kind, host_person_id: host, visit_on: date, hours, note: nt, status,
        reason: status === 'declined' ? 'I was not the host for this visit; please name the colleague who hosted it.' : null });
      date = day(date, 20 + Math.floor(rnd(`pv:gap:${p.id}:${k}`) * 60));
    }
  }
  // Checks the RPC applies, decision time after the visit, evidence levels in decision order.
  const rows = [];
  const evidence = [];
  const decidedOn = (v) => day(v.visit_on, 1 + Math.floor(rnd(`pv:dec:${v.id}`) * 4));
  const ordered = [...visits].sort((a, b) => (decidedOn(a) < decidedOn(b) ? -1 : decidedOn(a) > decidedOn(b) ? 1 : a.id < b.id ? -1 : 1));
  const confirmed = new Map();
  for (const v of ordered) {
    const p = visitProblem({ kind: v.kind, host_person_id: v.host_person_id, visit_on: v.visit_on, hours: v.hours, note: v.note }, now);
    if (p) throw new Error(`fs39: visit ${v.id} fails the visit check (${p})`);
    if (!hosts.includes(v.host_person_id) || v.host_person_id === v.person_id) throw new Error(`fs39: visit ${v.id} has an ineligible host`);
    const dec = decidedOn(v) > now ? now : decidedOn(v);
    let level = 0;
    let ev = [];
    if (v.status === 'confirmed') {
      const before = confirmed.get(v.person_id) ?? [];
      level = visitLevel(before, { kind: v.kind, hours: v.hours });
      before.push({ id: v.id, kind: v.kind, hours: v.hours });
      confirmed.set(v.person_id, before);
      ev = [{ skill_id: VISIT_SKILL, level }];
      evidence.push({
        id: evidenceId('ojt', v.id, VISIT_SKILL), person_id: v.person_id, skill_id: VISIT_SKILL, kind: 'ojt', ref_table: 'plant_visits', ref_id: v.id, level, basis: 'validated', status: 'current',
        observed_on: v.visit_on, note: `Plant visit ${v.kind} confirmed by host`, recorded_by: v.host_person_id, active: true, created_at: `${dec}T12:00:00Z`,
      });
    }
    const decided = v.status === 'confirmed' || v.status === 'declined';
    rows.push({
      id: v.id, person_id: v.person_id, kind: v.kind, host_person_id: v.host_person_id, visit_on: v.visit_on, hours: v.hours, note: v.note, status: v.status,
      decided_by: decided ? v.host_person_id : null, decided_at: decided ? `${dec}T12:00:00Z` : null, decline_reason: v.status === 'declined' ? v.reason : null, level, evidence: ev,
      created_at: `${v.visit_on}T17:00:00Z`,
    });
  }
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));
  return { visits: rows, evidence };
}

/** Forced demo outcomes: persona -> [drill, theta, retakes] (theta 1 = perfect). */
const TWIN_PERSONAS = {
  'p-nse': [['tw-fw-bearing', 0.92]],
  'p-outage-planner': [['tw-hx-fouling', 0.3]],
  'p-sme-reviewer': [['tw-sensor-drift', 1]],
  'p-qc-inspector': [['tw-hx-fouling', 0.85], ['tw-fw-bearing', 0.4]],
};
function simulateSubmission(sc, key, theta, seed) {
  const r = (k) => rnd(`tw:${seed}:${k}`);
  const others = (xs, not) => xs.filter((x) => !not.includes(x.id)).map((x) => x.id);
  const checks = [];
  for (const c of key.useful_checks) if (checks.length < sc.max_checks && r(`u:${c}`) < theta) checks.push(c);
  const spare = others(sc.checks, [...key.useful_checks, ...key.unsafe_checks]);
  if (checks.length < sc.max_checks && spare.length && r('w') > theta) checks.push(spare[Math.floor(r('wi') * spare.length)]);
  if (checks.length < sc.max_checks && key.unsafe_checks.length && r('x') < 0.12 * (1 - theta)) checks.push(key.unsafe_checks[0]);
  const component = r('c') < theta + 0.1 ? key.component_id : others(sc.components, [key.component_id])[Math.floor(r('ci') * (sc.components.length - 1))];
  const mode = r('m') < theta ? key.mode_id : others(sc.modes, [key.mode_id])[Math.floor(r('mi') * (sc.modes.length - 1))];
  const ra = r('a');
  const action = ra < theta ? key.best_action : ra < theta + 0.25 * (1 - theta) ? key.conservative_actions.find((a) => a !== key.best_action) ?? key.best_action
    : ra < 0.97 ? others(sc.actions, [...key.conservative_actions, ...key.unsafe_actions])[0] ?? key.best_action : key.unsafe_actions[0] ?? key.best_action;
  const rats = [];
  for (const x of key.sound_rationales) if (rats.length < 3 && r(`s:${x}`) < theta) rats.push(x);
  const unsound = others(sc.rationales, key.sound_rationales);
  if ((rats.length < 3 && r('us') > theta) || rats.length === 0) rats.push(unsound[Math.floor(r('usi') * unsound.length)]);
  return { checks, component_id: component, mode_id: mode, action_id: action, rationale_ids: rats };
}
function simulateTwins(T, now) {
  const scenarios = T.twin_scenarios.filter((s) => s.status === 'published');
  const keyOf = new Map(T.twin_keys.map((k) => [k.scenario_id, k]));
  const personaIds = new Set(T.people.filter((x) => x.persona_id).map((x) => x.id));
  const fams = ['engineering', 'maintenance', 'operations', 'chemistry', 'quality', 'radiation-protection', 'training', 'outage', 'nuclear-fuel'];
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && (TWIN_PERSONAS[p.id] || (!personaIds.has(p.id) && fams.includes(p.job_family_id)))).sort((a, b) => (a.id < b.id ? -1 : 1));
  const attempts = [];
  const evidence = [];
  for (const p of staff) {
    const forced = TWIN_PERSONAS[p.id];
    if (!forced && rnd(`tw:take:${p.id}`) >= 0.62) continue;
    const base = 0.35 + 0.55 * rnd(`tw:theta:${p.id}`);
    const plan = forced ?? [...scenarios].sort((a, b) => rnd(`tw:pick:${p.id}:${a.id}`) - rnd(`tw:pick:${p.id}:${b.id}`)).slice(0, 1 + Math.floor(rnd(`tw:n:${p.id}`) * 3)).map((s) => [s.id, base]);
    let date = day('2026-06-15', Math.floor(rnd(`tw:start:${p.id}`) * 100));
    for (const [sid, theta] of plan) {
      const sc = scenarios.find((s) => s.id === sid);
      const key = keyOf.get(sid);
      let no = 0;
      let th = theta;
      for (;;) {
        no++;
        if (date > now) break;
        const sub = theta >= 1 ? { checks: key.useful_checks.slice(0, sc.max_checks), component_id: key.component_id, mode_id: key.mode_id, action_id: key.best_action, rationale_ids: key.sound_rationales.slice(0, 3) }
          : simulateSubmission(sc, key, th, `${p.id}:${sid}:${no}`);
        const s = scoreTwinDrill(key, sub, sc.level);
        const mm = 10 + Math.floor(rnd(`tw:m:${p.id}:${sid}:${no}`) * 45);
        const id = `ta-${p.id.replace(/^[pw]-/, '')}-${sid.replace(/^tw-/, '')}-${no}`;
        const ev = s.passed ? sc.skill_ids.map((x) => ({ skill_id: x, level: s.level })) : [];
        const { reasons, feedback } = s;
        attempts.push({
          id, person_id: p.id, scenario_id: sid, scenario_version: sc.version, attempt_no: no, checks: sub.checks, component_id: sub.component_id, mode_id: sub.mode_id, action_id: sub.action_id,
          rationale_ids: sub.rationale_ids, points: s.points, max_points: s.max, pct: s.pct, critical_ok: s.critical_ok, passed: s.passed, level: s.level, feedback, reasons, evidence: ev,
          submitted_at: `${date}T09:${String(mm).padStart(2, '0')}:00Z`,
        });
        for (const e of ev) evidence.push({
          id: evidenceId('assessment', id, e.skill_id), person_id: p.id, skill_id: e.skill_id, kind: 'assessment', ref_table: 'twin_attempts', ref_id: id, level: e.level, basis: 'evidenced',
          status: 'current', observed_on: date, note: `Digital-twin drill ${sid}`, recorded_by: p.id, active: true, created_at: `${date}T09:${String(mm).padStart(2, '0')}:00Z`,
        });
        date = day(date, 4 + Math.floor(rnd(`tw:gap:${p.id}:${sid}:${no}`) * 12));
        if (s.passed || forced || no >= 2 || rnd(`tw:retake:${p.id}:${sid}`) >= 0.5) break;
        th = Math.min(0.95, th + 0.2);
      }
    }
  }
  const latest = new Map();
  for (const a of attempts) { const k = `${a.person_id}|${a.scenario_id}`; const c = latest.get(k); if (!c || a.submitted_at > c.submitted_at) latest.set(k, a); }
  const active = new Set([...latest.values()].map((a) => a.id));
  for (const e of evidence) e.active = active.has(e.ref_id);
  return { attempts, evidence };
}

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  buildDeltas(T);
  const pv = simulateVisits(T, now);
  const tw = simulateTwins(T, now);
  const evidence = [...pv.evidence, ...tw.evidence];
  if (evidence.some((e) => e.level > 2 || e.level < 1)) throw new Error('fs38: evidence outside levels 1-2');
  T.plant_visits = pv.visits;
  T.twin_attempts = tw.attempts;
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
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  const changed = T.person_skills.filter((s) => !fsSkills.has(s.skill_id) && before71.has(s.id) && before71.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs38: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  // F36 digests, F23 snapshots and F35 outlooks read the final states: rebuild them the way fs09/fs36 do.
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
    for (const ol of T.skill_outlooks) {
      const r = outlookFor(inp, ol.params);
      if (r.code !== 'ok') throw new Error(`fs38: outlook ${ol.id} ${r.code}`);
      if (JSON.stringify(r.result) !== JSON.stringify(ol.results)) outlooksChanged++;
      ol.params = r.result.params; ol.results = r.result;
    }
  }
  const conf = pv.visits.filter((v) => v.status === 'confirmed').length;
  console.log(`fs38/39/40: ${T.smr_deltas.filter((d) => d.status === 'published').length} published SMR deltas (+${T.smr_deltas.filter((d) => d.status !== 'published').length} drafts) for 28 roles; ${pv.visits.length} plant visits (${conf} confirmed, ${pv.visits.filter((v) => v.status === 'logged').length} waiting for the host), ${pv.evidence.length} visit evidence rows; ${T.twin_scenarios.length} twin drills, ${tw.attempts.length} attempts by ${new Set(tw.attempts.map((a) => a.person_id)).size} staff (${tw.attempts.filter((a) => a.passed).length} passed), ${tw.evidence.length} evidence rows (level <= 2); ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}; F35 outlooks recomputed (${outlooksChanged} changed); ${snapshots} F23 snapshots refreshed`);
}
