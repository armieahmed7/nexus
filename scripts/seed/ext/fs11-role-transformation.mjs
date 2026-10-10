// FS11 My Role in 2030 (Role Transformation Maps) + FS12 Task exposure view (FS wave B · E3, module M30) seed.
// Runs after fs05 (role profiles) and fs06 (task layer) in file order; it stores only editorial content, the computed parts
// (task bands, skills added, bridge, time-to-ready) come from transformRole at read time, so the wave-A remap (fsqa1) is picked up.
//  - role_transformations: one map per current role (28): archetype (SkillsFuture Singapore 2025), technology drivers, a staff summary,
//    a public summary with no numbers, sources; 27 published (two with a published history), and one open draft for the editor demo.
//  - transformation_milestones: the dated timeline (OSSA support to around 2030 with its ENEC source, ADVANCE evaluation with its
//    WNN sources, planning gates labelled SIMULATED, the annual profile refresh and the 2035 horizon). "No deployment decision implied".
//  - transformation_archetypes: Mastery Builders, Analytical Specialists, Human Connectors with what each means for learning.
// Every row passes the FS11/FS12 checks (checkTransformation: clean text, the copy check, no numbers in public summaries).
// Synthetic role cards only; no people are named.
import { checkTransformation, isPathOnly } from '../../../src/modules/m30/transform.ts';

const READ_ON = '2026-10-10';
const TM = 'p-training-mgr';
const HRD = 'p-chco';
const ts = (d, hm = '09:00') => `${d}T${hm}:00Z`;
const SRC = {
  jtm: { label: 'Workforce Singapore · Jobs Transformation Maps', url: 'https://wsg.gov.sg/for-employers/jobs-transformation-maps.html', as_of: READ_ON },
  ssg: { label: 'SkillsFuture Singapore · Top skills trends 2025 (AI potential on tasks, role archetypes)', url: 'https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf', as_of: READ_ON },
  oecd: { label: 'OECD AI Capability Indicators (technical report)', url: 'https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report', as_of: READ_ON },
  ossa: { label: 'ENEC · KHNP Operating Support Services Agreement', url: 'https://www.enec.ae/news/latest-news/enec-and-khnp-sign-operating-support-services-agreement-for-the-barakah-nuc/', as_of: READ_ON },
  oe: { label: 'ENEC · Global operating experience (KHNP OSSA)', url: 'https://www.enec.ae/discover/how-nuclear-energy-works/who-operates-the-plant-/global-operating-experience/', as_of: READ_ON },
  advance: { label: 'WNN · ENEC to evaluate deployment of SMRs and microreactors (ADVANCE)', url: 'https://world-nuclear-news.org/articles/enec-to-evaluate-deployment-of-smrs-and-microreact', as_of: READ_ON },
  smrMous: { label: 'WNN · ENEC signs multiple SMR MoUs (COP28)', url: 'https://world-nuclear-news.org/articles/enec-signs-multiple-smr-mous', as_of: READ_ON },
  presight: { label: 'ENEC · ENECIQ with Presight (Oct 2025)', url: 'https://www.enec.ae/en/news/latest-news/enec-and-presight-co-develop-eneciq-ai-platform-to-boost-efficiency-and-knowledge-sharing/', as_of: READ_ON },
  tii: { label: 'ENEC · TII and ASPIRE autonomous aerial systems (Jan 2026)', url: 'https://www.enec.ae/en/news/latest-news/enec-tii-and-aspire-collaborate-on-autonomous-aerial-systems-to-enhance-critical-infrastructure/', as_of: READ_ON },
  att: { label: 'Chief Learning Officer · AT&T: a fixed gaze toward the future (2019)', url: 'https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/', as_of: READ_ON },
  smrwf: { label: 'ANS · Education and training to support the Canadian nuclear workforce (2025)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/', as_of: READ_ON },
};
const NDD_EN = 'Planning assumption, no deployment decision implied.';
const NDD_AR = 'افتراض تخطيطي، ولا يعني ذلك أي قرار بالنشر.';

// role -> [archetype, drivers, tools EN, tools AR, keep EN, keep AR, learn EN, learn AR, extra source keys]
const M = 'mastery_builder', A = 'analytical_specialist', H = 'human_connector';
const MAPS = {
  'senior-reactor-operator': [M, ['ai_assist', 'digital_ic'], 'digital control-room displays and AI assistance prepare logs, trend summaries and procedure look-ups', 'تُعِدّ شاشات غرفة التحكم الرقمية والمساعدة بالذكاء الاصطناعي السجلات وملخصات الاتجاهات والبحث في الإجراءات', 'command and control of the unit, crew direction and every safety decision', 'القيادة والسيطرة على الوحدة وتوجيه الطاقم وكل قرار يتعلق بالسلامة', 'verifying AI output against plant data, and coaching crews to challenge it', 'التحقق من مخرجات الذكاء الاصطناعي مقابل بيانات المحطة، وتدريب الطواقم على مساءلتها', ['presight']],
  'shift-supervisor': [M, ['ai_assist', 'digital_ic'], 'shift handover packs, turnover notes and status boards are drafted from plant systems', 'تُصاغ حزم تسليم الوردية وملاحظات التسليم ولوحات الحالة من أنظمة المحطة', 'shift leadership, crew resource management and operability calls', 'قيادة الوردية وإدارة موارد الطاقم وقرارات قابلية التشغيل', 'reading plant data in context and leading crews that work with AI assistance', 'قراءة بيانات المحطة في سياقها وقيادة طواقم تعمل بمساعدة الذكاء الاصطناعي', ['presight']],
  'reactor-operator': [M, ['ai_assist', 'digital_ic'], 'digital I&C and AI assistance take on logging, routine surveillance records and alarm summaries', 'تتولى أنظمة الأجهزة والتحكم الرقمية والمساعدة بالذكاء الاصطناعي التسجيل وسجلات المراقبة الروتينية وملخصات الإنذارات', 'reactivity manipulations, emergency and abnormal operating procedures and the licensed operator judgement', 'التحكم في التفاعلية وإجراءات التشغيل الطارئة وغير الاعتيادية وحكم المشغّل المرخّص', 'plant-data literacy and verifying AI output, while simulator practice protects the skills juniors used to learn on the job', 'الإلمام ببيانات المحطة والتحقق من مخرجات الذكاء الاصطناعي، مع ممارسة على المحاكي تحمي المهارات التي كان المبتدئون يتعلمونها أثناء العمل', ['presight']],
  'local-operator': [M, ['robotics', 'digital_ic', 'ai_assist'], 'digital rounds, remote sensors and inspection robots take on routine readings and parameter logging', 'تتولى الجولات الرقمية وأجهزة الاستشعار عن بُعد وروبوتات الفحص القراءات الروتينية وتسجيل المعايير', 'equipment manipulation, field judgement, clearances and foreign-material discipline', 'تشغيل المعدات يدوياً والحكم الميداني والعزل والانضباط في منع المواد الغريبة', 'digital rounds tools and recognising when a sensor or a robot reading needs a second look', 'أدوات الجولات الرقمية ومعرفة متى تحتاج قراءة جهاز الاستشعار أو الروبوت إلى تحقق إضافي', ['tii']],
  'shift-technical-advisor': [A, ['ai_assist', 'digital_twin'], 'analytics and digital-twin views prepare transient reviews and technical evaluations', 'تُعِدّ التحليلات وطرق عرض التوأم الرقمي مراجعات الحالات العابرة والتقييمات الفنية', 'independent safety assessment for the shift and the engineering judgement behind it', 'التقييم المستقل للسلامة في الوردية والحكم الهندسي الذي يقوم عليه', 'validating twin and model results and explaining their limits to the crew', 'التحقق من نتائج التوأم والنماذج وشرح حدودها للطاقم', ['presight']],
  'operations-support-work-control': [A, ['ai_assist', 'digital_ic'], 'work-order triage, clearance drafting and schedule checks are prepared by planning tools', 'تتولى أدوات التخطيط فرز أوامر العمل وصياغة العزل ومراجعة الجداول', 'risk judgement on work windows, clearance boundaries and coordination with the shift', 'الحكم على مخاطر نوافذ العمل وحدود العزل والتنسيق مع الوردية', 'checking tool-drafted clearances and work packages line by line', 'مراجعة العزل وحزم العمل التي تصوغها الأدوات بنداً بنداً', ['presight']],
  'outage-manager-planner': [A, ['ai_assist', 'digital_ic', 'robotics'], 'schedule optimisation and AI assistance build outage logic and resource views', 'يُعِدّ تحسين الجداول والمساعدة بالذكاء الاصطناعي منطق فترة الإيقاف وطرق عرض الموارد', 'outage strategy, nuclear safety and shutdown-risk decisions and contractor coordination', 'استراتيجية فترة الإيقاف وقرارات السلامة النووية ومخاطر الإيقاف وتنسيق المقاولين', 'reading optimiser output critically and planning robot-assisted inspection windows', 'قراءة مخرجات أدوات التحسين بعين ناقدة وتخطيط نوافذ الفحص بمساعدة الروبوتات', ['tii']],
  'maintenance-technician-engineer': [M, ['robotics', 'digital_ic', 'ai_assist', 'digital_twin'], 'remote and robotic inspection, predictive-maintenance analytics and digital I&C diagnostics take on routine checks', 'يتولى الفحص عن بُعد وبالروبوتات وتحليلات الصيانة التنبؤية وتشخيص الأجهزة والتحكم الرقمية الفحوص الروتينية', 'hands-on repair, foreign-material exclusion and the sign-off on safety-related work', 'الإصلاح اليدوي ومنع المواد الغريبة والتوقيع على الأعمال المتعلقة بالسلامة', 'digital I&C, robot-assisted inspection and interpreting predictive-maintenance data', 'الأجهزة والتحكم الرقمية والفحص بمساعدة الروبوتات وتفسير بيانات الصيانة التنبؤية', ['tii']],
  'systems-design-plant-engineer': [A, ['ai_assist', 'digital_twin', 'digital_ic'], 'design checks, document search and performance trending are prepared by engineering tools and twins', 'تتولى الأدوات الهندسية والتوائم الرقمية مراجعات التصميم والبحث في الوثائق ومتابعة اتجاهات الأداء', 'design authority, engineering judgement and the safety basis behind every change', 'سلطة التصميم والحكم الهندسي وأساس السلامة وراء كل تعديل', 'model and twin validation, and verifying AI-drafted engineering text', 'التحقق من صحة النماذج والتوائم ومراجعة النصوص الهندسية التي يصوغها الذكاء الاصطناعي', ['presight']],
  'reactor-engineer-core-physicist': [A, ['ai_assist', 'digital_twin', 'smr_design'], 'core-monitoring analytics and simulation tools prepare follow and reload studies', 'تُعِدّ تحليلات مراقبة القلب وأدوات المحاكاة دراسات المتابعة وإعادة التحميل', 'reactivity management decisions and the physics judgement behind them', 'قرارات إدارة التفاعلية والحكم الفيزيائي الذي تقوم عليه', 'code validation, uncertainty reading and awareness of advanced-reactor core designs', 'التحقق من صحة الشيفرات وقراءة عدم اليقين والإلمام بتصاميم قلوب المفاعلات المتقدمة', ['advance']],
  'nuclear-fuel-specialist': [M, ['ai_assist', 'digital_ic', 'smr_design'], 'fuel records, inspection imagery review and tracking are prepared by digital tools', 'تتولى الأدوات الرقمية سجلات الوقود ومراجعة صور الفحص والتتبع', 'fuel handling, accountability checks in the field and the judgement on anomalies', 'مناولة الوقود والتحقق الميداني والحكم على الحالات الشاذة', 'reading inspection imagery with AI support and awareness of advanced fuel designs', 'قراءة صور الفحص بدعم الذكاء الاصطناعي والإلمام بتصاميم الوقود المتقدمة', ['advance']],
  'cyber-security-engineer': [null, [], '', '', '', '', '', '', []],
  'radiation-protection-technician': [M, ['robotics', 'ai_assist', 'digital_ic'], 'remote monitoring, robotic surveys and digital dose tracking take on routine surveys and records', 'تتولى المراقبة عن بُعد والمسوح الروبوتية وتتبع الجرعات الرقمي المسوح والسجلات الروتينية', 'job coverage, ALARA judgement and protecting the people in the field', 'تغطية الأعمال والحكم وفق مبدأ ALARA وحماية الأشخاص في الميدان', 'remote survey tools and checking robot and sensor readings against field knowledge', 'أدوات المسح عن بُعد ومطابقة قراءات الروبوتات وأجهزة الاستشعار مع المعرفة الميدانية', ['tii']],
  'chemistry-technician': [M, ['ai_assist', 'digital_ic'], 'online analysers and trend analytics take on routine sampling records and chemistry trending', 'تتولى أجهزة التحليل المباشرة وتحليلات الاتجاهات سجلات أخذ العينات الروتينية ومتابعة اتجاهات الكيمياء', 'laboratory quality, the judgement on out-of-specification results and plant chemistry control', 'جودة المختبر والحكم على النتائج الخارجة عن المواصفات والتحكم في كيمياء المحطة', 'analyser data quality and verifying model-flagged chemistry anomalies', 'جودة بيانات أجهزة التحليل والتحقق من الحالات الكيميائية الشاذة التي تُبرزها النماذج', ['presight']],
  'environmental-monitoring-specialist': [A, ['ai_assist', 'digital_ic'], 'sensor networks and analytics take on data collection and first-pass reporting', 'تتولى شبكات الاستشعار والتحليلات جمع البيانات وإعداد التقارير الأولية', 'sampling programme design, interpretation and stakeholder-facing judgement', 'تصميم برامج أخذ العينات وتفسير النتائج والحكم في التواصل مع أصحاب المصلحة', 'environmental data analysis and greenhouse-gas and ESG literacy', 'تحليل البيانات البيئية والإلمام بغازات الاحتباس الحراري والحوكمة البيئية والاجتماعية', []],
  'quality-assurance-qc': [A, ['ai_assist', 'digital_ic', 'robotics'], 'AI-assisted document checks and automated NDE data screening prepare inspection packages', 'تُعِدّ مراجعة الوثائق بمساعدة الذكاء الاصطناعي والفرز الآلي لبيانات الفحص غير الإتلافي حزم الفحص', 'acceptance decisions, hold points and the independence of the quality function', 'قرارات القبول ونقاط التوقف واستقلالية وظيفة الجودة', 'verifying AI-screened results and digital quality records', 'التحقق من النتائج التي يفرزها الذكاء الاصطناعي وسجلات الجودة الرقمية', []],
  'nuclear-oversight-npi': [A, ['ai_assist', 'digital_ic'], 'condition-report trending and text analytics prepare performance reviews', 'تُعِدّ متابعة اتجاهات تقارير الحالة وتحليلات النصوص مراجعات الأداء', 'independent challenge, cause analysis and the oversight conclusions', 'المساءلة المستقلة وتحليل الأسباب واستنتاجات الرقابة', 'reading analytics critically and auditing how AI tools are used', 'قراءة التحليلات بعين ناقدة وتدقيق طريقة استخدام أدوات الذكاء الاصطناعي', ['presight']],
  'regulatory-affairs-licensing-engineer': [A, ['ai_assist', 'digital_ic', 'smr_design'], 'AI assistance drafts submissions, searches commitments and compares documents', 'تصوغ المساعدة بالذكاء الاصطناعي المراسلات وتبحث في الالتزامات وتقارن الوثائق', 'regulator-facing argument, licensing judgement and commitment ownership', 'الحجة أمام الجهة الرقابية والحكم في شؤون الترخيص وملكية الالتزامات', 'verifying AI-drafted text against the licensing basis and advanced-reactor licensing awareness', 'التحقق من النصوص التي يصوغها الذكاء الاصطناعي مقابل أساس الترخيص والإلمام بترخيص المفاعلات المتقدمة', ['advance']],
  'human-performance-specialist': [H, ['ai_assist'], 'observation records and trend dashboards are compiled by digital tools', 'تُجمع سجلات الملاحظة ولوحات الاتجاهات بواسطة الأدوات الرقمية', 'coaching, field observation conversations and building a questioning attitude', 'التوجيه وحوارات الملاحظة الميدانية وبناء موقف التساؤل', 'human performance in AI-augmented work and coaching people to challenge tool output', 'الأداء البشري في العمل المعزّز بالذكاء الاصطناعي وتوجيه الأشخاص لمساءلة مخرجات الأدوات', []],
  'ecp-officer': [H, ['ai_assist'], 'case administration and scheduling are supported by digital tools', 'تدعم الأدوات الرقمية إدارة الحالات والجدولة', 'listening, protecting confidentiality and building trust to raise concerns', 'الإصغاء وحماية السرية وبناء الثقة لطرح المخاوف', 'privacy-aware use of digital tools and safety culture in an AI-augmented plant', 'الاستخدام الواعي بالخصوصية للأدوات الرقمية وثقافة السلامة في محطة معززة بالذكاء الاصطناعي', []],
  'industrial-health-safety-officer': [H, ['ai_assist', 'robotics'], 'permit checks, incident trending and wearable-sensor alerts are prepared by digital tools', 'تُعِدّ الأدوات الرقمية مراجعة التصاريح ومتابعة اتجاهات الحوادث وتنبيهات أجهزة الاستشعار القابلة للارتداء', 'field coaching, stop-work authority and engaging crews on safe work', 'التوجيه الميداني وصلاحية إيقاف العمل وإشراك الطواقم في العمل الآمن', 'safe work around robots and remote tools, and reading sensor alerts in context', 'العمل الآمن حول الروبوتات والأدوات عن بُعد وقراءة تنبيهات أجهزة الاستشعار في سياقها', ['tii']],
  'fire-protection': [M, ['digital_ic', 'robotics'], 'digital detection systems and inspection drones take on routine checks and records', 'تتولى أنظمة الكشف الرقمية وطائرات الفحص المسيّرة الفحوص والسجلات الروتينية', 'fire response, impairment judgement and hands-on equipment readiness', 'الاستجابة للحرائق والحكم على حالات التعطل وجاهزية المعدات يدوياً', 'digital detection systems and drone-assisted inspection', 'أنظمة الكشف الرقمية والفحص بمساعدة الطائرات المسيّرة', ['tii']],
  'emergency-preparedness-coordinator': [H, ['ai_assist', 'digital_ic'], 'drill scheduling, scenario drafting and notification checks are prepared by digital tools', 'تُعِدّ الأدوات الرقمية جدولة التمارين وصياغة السيناريوهات ومراجعة الإشعارات', 'coordinating the response organisation, working with external agencies and leading under pressure', 'تنسيق منظمة الاستجابة والعمل مع الجهات الخارجية والقيادة تحت الضغط', 'scenario design with digital tools and judging AI-drafted scenarios', 'تصميم السيناريوهات بالأدوات الرقمية والحكم على السيناريوهات التي يصوغها الذكاء الاصطناعي', []],
  'security-officer': [null, [], '', '', '', '', '', '', []],
  'safeguards-specialist': [null, [], '', '', '', '', '', '', []],
  'nuclear-training-instructor': [H, ['ai_assist', 'digital_twin', 'digital_ic'], 'AI assistance drafts lesson material and question banks; digital twins extend the simulator', 'تصوغ المساعدة بالذكاء الاصطناعي المواد التعليمية وبنوك الأسئلة؛ وتوسّع التوائم الرقمية المحاكي', 'coaching, evaluating performance and passing on operating experience', 'التوجيه وتقييم الأداء ونقل الخبرة التشغيلية', 'checking AI-drafted training material and teaching with twins and simulators', 'مراجعة المواد التدريبية التي يصوغها الذكاء الاصطناعي والتدريس بالتوائم والمحاكيات', ['smrwf']],
  'procurement-engineer': [A, ['ai_assist', 'digital_ic'], 'AI assistance screens bids, compares specifications and tracks supplier documents', 'تفرز المساعدة بالذكاء الاصطناعي العطاءات وتقارن المواصفات وتتابع وثائق الموردين', 'commercial and technical judgement, supplier relationships and quality classification', 'الحكم التجاري والفني والعلاقات مع الموردين وتصنيف الجودة', 'verifying AI-screened bids and digital procurement records', 'التحقق من العطاءات التي يفرزها الذكاء الاصطناعي وسجلات المشتريات الرقمية', []],
  'corporate-professional': [H, ['ai_assist', 'digital_ic'], 'AI assistance drafts documents, analyses data and prepares reports', 'تصوغ المساعدة بالذكاء الاصطناعي الوثائق وتحلل البيانات وتُعِدّ التقارير', 'stakeholder relationships, judgement on sensitive matters and accountability for advice', 'العلاقات مع أصحاب المصلحة والحكم في المسائل الحساسة والمسؤولية عن المشورة', 'data analysis, responsible AI use and verifying AI-drafted text', 'تحليل البيانات والاستخدام المسؤول للذكاء الاصطناعي والتحقق من النصوص التي يصوغها الذكاء الاصطناعي', ['att']],
};
const PATH_EN = 'Security, safeguards and cyber roles are shown at career-path level only: how to enter the path and the qualified or not-qualified status. Task and skill detail stays outside Kafa\'a.';
const PATH_AR = 'تُعرض أدوار الأمن والضمانات والأمن السيبراني على مستوى المسار المهني فقط: كيفية الالتحاق بالمسار وحالة التأهيل أو عدمه. وتبقى تفاصيل المهام والمهارات خارج كفاءة.';
const PATH_PUB_EN = 'This role is shown at career-path level only. Task and skill detail stays outside Kafa\'a.';
const PATH_PUB_AR = 'يُعرض هذا الدور على مستوى المسار المهني فقط. وتبقى تفاصيل المهام والمهارات خارج كفاءة.';

function texts(role, m) {
  if (!m[0]) return { summary_en: PATH_EN, summary_ar: PATH_AR, public_summary_en: PATH_PUB_EN, public_summary_ar: PATH_PUB_AR };
  const [, , tEn, tAr, kEn, kAr, lEn, lAr] = m;
  return {
    summary_en: `By 2030, ${tEn}. People keep ${kEn}. Learning focus: ${lEn}. ${NDD_EN}`,
    summary_ar: `بحلول 2030، ${tAr}. ويحتفظ الأشخاص بـ${kAr}. محور التعلّم: ${lAr}. ${NDD_AR}`,
    public_summary_en: `Tools take on more routine work; people keep ${kEn}. ${NDD_EN}`,
    public_summary_ar: `تتولى الأدوات مزيداً من العمل الروتيني؛ ويحتفظ الأشخاص بـ${kAr}. ${NDD_AR}`,
  };
}

const MILESTONES = [
  ['ms-2026-advance', 2026, 'advance', false, ['advance', 'smrMous'],
    'ADVANCE: SMRs and microreactors under evaluation', 'برنامج ADVANCE: تقييم المفاعلات المعيارية الصغيرة والمفاعلات الدقيقة',
    'ENEC is evaluating small modular reactors and microreactors under its ADVANCE programme and has signed several technology MoUs. Role profiles for 2035 carry advanced-reactor awareness as a planning assumption. No deployment decision implied.',
    'تُقيّم مؤسسة الإمارات للطاقة النووية المفاعلات المعيارية الصغيرة والمفاعلات الدقيقة ضمن برنامج ADVANCE ووقّعت عدة مذكرات تفاهم تقنية. وتتضمن ملفات الأدوار لعام 2035 الإلمام بالمفاعلات المتقدمة كافتراض تخطيطي. ولا يعني ذلك أي قرار بالنشر.'],
  ['ms-2027-gate-1', 2027, 'advance', true, ['advance'],
    'Planning gate 1 (SIMULATED): technology shortlist review', 'بوابة التخطيط 1 (محاكاة): مراجعة القائمة المختصرة للتقنيات',
    'A demo planning gate: the skills plan is reviewed against a technology shortlist. Dates and content are illustrative. No deployment decision implied.',
    'بوابة تخطيط تجريبية: تُراجع خطة المهارات مقابل قائمة مختصرة من التقنيات. التواريخ والمحتوى توضيحية. ولا يعني ذلك أي قرار بالنشر.'],
  ['ms-2028-profiles', 2028, 'profiles', true, ['smrwf', 'jtm'],
    'Annual role-profile refresh (SIMULATED)', 'التحديث السنوي لملفات الأدوار (محاكاة)',
    'Role profiles and transformation maps are refreshed every year, job by job, as new-build workforce programmes do. The next refresh date is illustrative.',
    'تُحدَّث ملفات الأدوار وخرائط التحول سنوياً، وظيفة بوظيفة، كما تفعل برامج القوى العاملة للمحطات الجديدة. موعد التحديث القادم توضيحي.'],
  ['ms-2030-ossa', 2030, 'ossa', false, ['ossa', 'oe'],
    'Operating support under the ENEC–KHNP OSSA ends around 2030', 'انتهاء دعم التشغيل بموجب اتفاقية خدمات دعم التشغيل مع KHNP نحو 2030',
    'Experienced operators from KHNP support Barakah under the Operating Support Services Agreement until around 2030. Every role should be ready to run without that support by then.',
    'يدعم مشغلون ذوو خبرة من KHNP محطة براكة بموجب اتفاقية خدمات دعم التشغيل حتى نحو 2030. وينبغي أن يكون كل دور جاهزاً للعمل دون هذا الدعم بحلول ذلك الوقت.'],
  ['ms-2031-gate-2', 2031, 'advance', true, ['advance'],
    'Planning gate 2 (SIMULATED): skills readiness review', 'بوابة التخطيط 2 (محاكاة): مراجعة جاهزية المهارات',
    'A demo planning gate: readiness for advanced-reactor skills is reviewed before any further step. Dates and content are illustrative. No deployment decision implied.',
    'بوابة تخطيط تجريبية: تُراجع الجاهزية لمهارات المفاعلات المتقدمة قبل أي خطوة لاحقة. التواريخ والمحتوى توضيحية. ولا يعني ذلك أي قرار بالنشر.'],
  ['ms-2035-horizon', 2035, 'horizon', false, ['jtm'],
    'The 2035 role horizon', 'أفق الأدوار لعام 2035',
    'The second horizon of every role profile: digital twins, advanced-reactor awareness and deeper AI assistance. Planning assumption, no deployment decision implied.',
    'الأفق الثاني لكل ملف دور: التوائم الرقمية والإلمام بالمفاعلات المتقدمة ومساعدة أعمق بالذكاء الاصطناعي. افتراض تخطيطي، ولا يعني ذلك أي قرار بالنشر.'],
];

const ARCH = [
  ['mastery_builder', 'Mastery Builder', 'باني الإتقان',
    'Skill grows step by step on the job; the risk is that tools take on the junior tasks people used to learn on.', 'تنمو المهارة خطوة بخطوة أثناء العمل؛ والخطر أن تتولى الأدوات المهام المبتدئة التي كان الأشخاص يتعلمون منها.',
    'Protect the ladder: simulator time, practice repetitions and supervised field work make up for the practice that tools take on.', 'حماية سُلّم التعلّم: وقت المحاكي وتكرار الممارسة والعمل الميداني تحت الإشراف تعوّض الممارسة التي تتولاها الأدوات.',
    'Licensed operators and maintenance technicians', 'المشغلون المرخّصون وفنيو الصيانة'],
  ['analytical_specialist', 'Analytical Specialist', 'الأخصائي التحليلي',
    'Learning is front-loaded; as tools prepare analysis, the weight moves to judgement and interpretation.', 'يتركز التعلّم في البداية؛ ومع إعداد الأدوات للتحليل ينتقل الثقل إلى الحكم والتفسير.',
    'Invest in judgement: verifying tool output, explaining its limits and owning the conclusion.', 'الاستثمار في الحكم: التحقق من مخرجات الأدوات وشرح حدودها وتحمّل مسؤولية الاستنتاج.',
    'Engineers, licensing, quality and oversight', 'المهندسون والترخيص والجودة والرقابة'],
  ['human_connector', 'Human Connector', 'الموصل الإنساني',
    'Interpersonal skills stay critical; tools take on administration around the human work.', 'تبقى مهارات التعامل مع الآخرين حاسمة؛ وتتولى الأدوات الأعمال الإدارية المحيطة بالعمل الإنساني.',
    'Deepen the human skills: coaching, communication and trust, plus responsible use of the tools that free up time.', 'تعميق المهارات الإنسانية: التوجيه والتواصل والثقة، إلى جانب الاستخدام المسؤول للأدوات التي توفر الوقت.',
    'Instructors, human performance, emergency preparedness and corporate roles', 'المدربون والأداء البشري والتأهب للطوارئ والأدوار المؤسسية'],
];

export default function build(T) {
  const roles = T.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
  T.role_transformations = T.role_transformations ?? [];
  T.transformation_drafts = T.transformation_drafts ?? [];
  T.transformation_milestones = T.transformation_milestones ?? [];
  T.transformation_archetypes = T.transformation_archetypes ?? [];
  const problems = [];
  for (const role of roles) {
    const m = MAPS[role.id];
    if (!m) { problems.push(`no map for ${role.id}`); continue; }
    const tx = texts(role, m);
    const path = isPathOnly(role);
    const sources = path ? [SRC.jtm] : [SRC.jtm, SRC.ssg, SRC.oecd, ...m[8].map((k) => SRC[k])];
    const input = { role_id: role.id, archetype: m[0], drivers: m[1], ...tx, sources, publish: true };
    const code = checkTransformation(input, role);
    if (code !== 'ok') problems.push(`${role.id}: ${code}`);
    const pubDay = path ? '2026-09-15' : '2026-09-20';
    T.role_transformations.push({
      id: `rt-${role.id}`, role_id: role.id, family_id: role.family_id, archetype: m[0], drivers: m[1], ...tx, sources, as_of: READ_ON,
      status: 'published', is_public: true, path_only: path, version: 1, history: [], updated_by: HRD, updated_at: ts(pubDay), published_by: HRD, published_at: ts(pubDay), sort: role.sort,
    });
  }
  // two maps with a published history (v1 -> v2): the editors refined the learning focus after the FS06 task ratings
  for (const [rid, oldLearnEn, oldLearnAr] of [
    ['maintenance-technician-engineer', 'digital I&C diagnostics', 'تشخيص الأجهزة والتحكم الرقمية'],
    ['reactor-operator', 'plant-data literacy', 'الإلمام ببيانات المحطة'],
  ]) {
    const r = T.role_transformations.find((x) => x.role_id === rid);
    const m = MAPS[rid];
    const old = texts(null, [m[0], m[1], m[2], m[3], m[4], m[5], oldLearnEn, oldLearnAr]);
    r.history = [{ version: 1, archetype: m[0], drivers: m[1].slice(0, 2), ...old, published_by: TM, published_at: ts('2026-06-15') }];
    r.version = 2;
    r.published_by = HRD;
    r.published_at = ts('2026-09-20');
  }
  // one open draft: the training manager proposes adding the digital-twin driver to the RO map
  const ro = MAPS['reactor-operator'];
  const draftIn = { role_id: 'reactor-operator', archetype: ro[0], drivers: [...ro[1], 'digital_twin'], ...texts(null, ro), sources: [SRC.jtm, SRC.ssg, SRC.presight], publish: false };
  draftIn.summary_en = draftIn.summary_en.replace('Learning focus:', 'Digital twins extend simulator practice. Learning focus:');
  draftIn.summary_ar = draftIn.summary_ar.replace('محور التعلّم:', 'وتوسّع التوائم الرقمية ممارسة المحاكي. محور التعلّم:');
  const dc = checkTransformation(draftIn, T.job_roles.find((r) => r.id === 'reactor-operator'));
  if (dc !== 'ok') problems.push(`draft: ${dc}`);
  const { role_id: _r, publish: _p, ...content } = draftIn;
  T.transformation_drafts.push({ id: 'rtd-reactor-operator', role_id: 'reactor-operator', content: { ...content, sources: content.sources.map((s) => ({ label: s.label, url: s.url, as_of: s.as_of })) }, open: true, saved_by: TM, saved_at: ts('2026-10-06', '10:30') });

  MILESTONES.forEach(([id, year, kind, simulated, src, ten, tar, ben, bar], i) => {
    T.transformation_milestones.push({ id, year, kind, title_en: ten, title_ar: tar, body_en: ben, body_ar: bar, simulated, families: [], sources: src.map((k) => SRC[k]), as_of: READ_ON, sort: i + 1 });
  });
  ARCH.forEach(([id, nen, nar, men, mar, len, lar, een, ear], i) => {
    T.transformation_archetypes.push({ id, name_en: nen, name_ar: nar, meaning_en: men, meaning_ar: mar, learning_en: len, learning_ar: lar, example_en: een, example_ar: ear, sources: [SRC.ssg], as_of: READ_ON, sort: i + 1 });
  });
  if (problems.length) throw new Error(`fs11-role-transformation: ${problems.join('; ')}`);
}
