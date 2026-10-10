// FS19 + FS20 (future-skills wave C · E2, M04) seed: the future-skills course pack and the four academies with their cohorts.
// build():    the pack programme and four academy programmes, 18 modular courses (60 h or less) plus two cross-over versions for
//             adjacent industries, their modules, skill links at a stated level (course_skill_links), pack metadata (theme, hour
//             envelope, SIMULATED outline), the academies (module + project + mentor template) and seven cohorts.
// finalize(): FINALIZE_LAST and, by file name, after fs02 (the FS02 skills exist), fs03 (final states) and fs09 (fitness evidence):
//             adds each linked course to its skill's F01 evidence keys (the platform's "course teaches skill" relation), runs the copy
//             and link check on every course, then simulates nominations, places, module enrolments and capstones with the same rules
//             as the RPCs. Signed-off capstones write F01 `ojt` evidence (ref_table cohort_capstones) on FS02 skills only; the states of
//             the people concerned are re-derived and the F36 digests rebuilt. Fails the build if an acceptance rule breaks or any
//             state of the original 71-skill catalogue changes.
// Synthetic people only; every course cites sources with an as-of date and is a SIMULATED demo outline.
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import { copyProblems, courseTexts, courseUrls, learningRoutes, packProblems, UNHELD_BASELINE, FS_PACK_PROGRAMME } from '../../../src/modules/m04/fsPack.ts';
import { capstoneEvidence, capstoneId, memberId, academyEnrolmentId, academyStats } from '../../../src/modules/m04/academy.ts';
import { lineManagerOf } from '../../../src/modules/m17/checkins.ts';
import { finalize as rebuildDigests } from './f36-digest.mjs';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const S = (id, label, url) => ({ id, label, url, as_of: AS_OF });
const SRC = {
  iaeaAi: S('fs19-iaea-ai', 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence'),
  aiLit: S('fs19-ai-lit', 'European Commission · Living repository of AI-literacy practices (AI Act Article 4)', 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices'),
  adnoc: S('fs19-adnoc', 'ADNOC · Sustainability Report 2025 (AI upskilling)', 'https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42'),
  digcomp: S('fs19-digcomp', 'European Commission JRC · DigComp digital competence framework', 'https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en'),
  linkedin: S('fs19-linkedin', 'LinkedIn Economic Graph · research', 'https://economicgraph.linkedin.com/research'),
  presight: S('fs19-eneciq', 'ENEC · ENECIQ AI platform co-developed with Presight', 'https://www.enec.ae/en/news/latest-news/enec-and-presight-co-develop-eneciq-ai-platform-to-boost-efficiency-and-knowledge-sharing/'),
  tii: S('fs19-tii', 'ENEC · TII and ASPIRE collaborate on autonomous aerial systems', 'https://www.enec.ae/en/news/latest-news/enec-tii-and-aspire-collaborate-on-autonomous-aerial-systems-to-enhance-critical-infrastructure/'),
  nss42: S('fs19-nss42', 'IAEA · Nuclear Security Series 42-G, computer security for nuclear facilities (public summary)', 'https://www.iaea.org/node/97473'),
  nice: S('fs19-nice', 'NICCS · NICE Workforce Framework for Cybersecurity', 'https://niccs.cisa.gov/workforce-development/nice-framework'),
  ans: S('fs19-ans', 'ANS Nuclear Newswire · Education and training to support the Canadian nuclear workforce', 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/'),
  e2: S('fs19-e2', 'Oregon State University · NuScale Energy Exploration (E2) Center', 'https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center'),
  wnnSmr: S('fs19-wnn-smr', 'World Nuclear News · ENEC to evaluate deployment of SMRs and microreactors', 'https://world-nuclear-news.org/articles/enec-to-evaluate-deployment-of-smrs-and-microreact'),
  nea: S('fs19-nea', 'OECD-NEA · Plan 2035 vision paper (NEST)', 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf'),
  match: S('fs19-match', 'nucleareurope · MATCH, a tool for nuclear capacity building in France', 'https://www.nucleareurope.eu/blog/highlight-of-the-month/match-program-a-tool-for-nuclear-capacity-building-in-france/'),
  enecAdnoc: S('fs19-enec-adnoc', 'ENEC · ENEC and ADNOC to explore advanced nuclear technologies and excess heat', 'https://www.enec.ae/en/news/latest-news/enec-and-adnoc-to-explore-the-use-of-advanced-nuclear-technologies-and-excess-heat-utilization-for-oil-and-gas-operations/'),
  iea: S('fs19-iea', 'NucNet · IEA World Energy Employment 2025: nuclear jobs growth', 'https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025'),
  enecSr: S('fs19-enec-sr', 'ENEC · Sustainability Report 2024 (GRI data)', 'https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf'),
  greencomp: S('fs19-greencomp', 'European Commission JRC · GreenComp, the European sustainability competence framework', 'https://joint-research-centre.ec.europa.eu/greencomp'),
  wef: S('fs19-wef', 'World Economic Forum · Future of Jobs Report 2025, skills outlook', 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/'),
  tecdoc: S('fs19-tecdoc1917', 'IAEA-TECDOC-1917 · Assessing behavioural competencies in nuclear facilities', 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf'),
  mck: S('fs19-mck', 'McKinsey · Defining the skills citizens will need in the future world of work', 'https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work'),
  icv: S('fs19-icv', 'ENEC · In-Country Value programme for vendors', 'https://www.enec.ae/vendors/vendor-education/icv/'),
  sask: S('fs19-sask', 'Saskatchewan Polytechnic · Nuclear skills training (short courses for adjacent industries)', 'https://saskpolytech.ca/programs-and-courses/part-time-studies/nuclear-skills-training.aspx'),
  ukNuc: S('fs19-uk-nuc', 'World Nuclear News · UK sets out plan for boosting nuclear workforce', 'https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce'),
  nntp: S('fs20-nntp', 'Fortum · Nordic Nuclear Trainee Programme', 'https://www.fortum.com/careers/NNTP'),
  enen: S('fs20-enen', 'CORDIS · ENEN2plus project', 'https://cordis.europa.eu/project/id/101061677'),
  ega: S('fs20-ega', 'WAM · EGA launches EGA Academy', 'https://www.wam.ae/en/article/blmzwis-ega-launches-ega-academy'),
};
const NO_DECISION_EN = 'Concept learning only: ENEC is evaluating these technologies and no deployment decision is implied.';
const NO_DECISION_AR = 'تعلّم مفاهيمي فقط: تقيّم مؤسسة الإمارات للطاقة النووية هذه التقنيات، ولا يُفهم من ذلك أي قرار بالنشر.';

// ───────────── The pack: [id, code, theme, kind, crossover_of, hours, weeks, weekly, modality, title_en, title_ar, summary_en, summary_ar,
//                modules [[en, ar, minutes]], links [[skill, level, objective_en, objective_ar]], sources, industries, no_decision]
const COURSES = [
  ['c-fs-plantdata', 'FS-DA-201', 'data_ai', 'core', null, 24, 8, 3, 'blended',
    'Plant-data analysis', 'تحليل بيانات المحطة',
    'Turn trend data, logs and work-order records into findings a team can act on: clean, chart, compare and explain, with the limits of the data stated.',
    'حوّل بيانات الاتجاهات والسجلات وأوامر العمل إلى نتائج يمكن للفريق العمل بها: تنظيف ورسم ومقارنة وشرح، مع بيان حدود البيانات.',
    [['Questions worth asking of plant data', 'أسئلة تستحق أن تُطرح على بيانات المحطة', 240], ['Cleaning and joining records', 'تنظيف السجلات وربطها', 360], ['Charts that tell the truth', 'رسوم بيانية صادقة', 360], ['Comparing periods and units', 'المقارنة بين الفترات والوحدات', 300], ['Writing up a finding', 'كتابة النتيجة', 180]],
    [['sk-da-01-analysis', 2, 'Analyse plant trend and work-order data and present a defensible finding', 'تحليل بيانات اتجاهات المحطة وأوامر العمل وتقديم نتيجة قابلة للدفاع عنها'], ['sk-fs-ai-plantdata', 1, 'Judge whether a data set is fit for the question being asked', 'الحكم على ملاءمة مجموعة البيانات للسؤال المطروح']],
    [SRC.iaeaAi, SRC.digcomp], [], false],
  ['c-fs-scripting', 'FS-DA-202', 'data_ai', 'core', null, 30, 10, 3, 'elearning',
    'Scripting basics for engineers', 'أساسيات البرمجة النصية للمهندسين',
    'Automate a repetitive analysis safely: read files, transform tables, produce a chart and keep the script reviewable and version-controlled in an approved sandbox.',
    'أتمتة تحليل متكرر بأمان: قراءة الملفات وتحويل الجداول وإنتاج رسم بياني، مع إبقاء النص البرمجي قابلاً للمراجعة وتحت ضبط الإصدارات في بيئة تجريبية معتمدة.',
    [['Why and when to script', 'لماذا ومتى نكتب نصاً برمجياً', 180], ['Reading and transforming tables', 'قراءة الجداول وتحويلها', 480], ['Functions, tests and review', 'الدوال والاختبارات والمراجعة', 480], ['Charts and reports from code', 'الرسوم والتقارير من الشيفرة', 360], ['Working in the approved sandbox', 'العمل في البيئة التجريبية المعتمدة', 300]],
    [['sk-da-01-scripting', 2, 'Write, test and document a short script that automates a routine analysis', 'كتابة نص برمجي قصير واختباره وتوثيقه لأتمتة تحليل روتيني'], ['sk-fs-ai-automation', 1, 'Describe where a task can be automated and where a person must stay in the loop', 'وصف المواضع التي يمكن فيها أتمتة المهمة وتلك التي يجب أن يبقى فيها الإنسان طرفاً']],
    [SRC.digcomp, SRC.linkedin], [], false],
  ['c-fs-twin', 'FS-DP-201', 'digital_plant', 'core', null, 32, 8, 4, 'blended',
    'Digital-twin fundamentals', 'أساسيات التوائم الرقمية',
    'What a digital twin is and is not, how it is fed and validated against plant behaviour, and how to spot drift before anyone relies on it.',
    'ما التوأم الرقمي وما ليس كذلك، وكيف يُغذّى ويُتحقق منه مقابل سلوك المحطة، وكيف تُكتشف الانحرافات قبل أن يعتمد عليه أحد.',
    [['Models, twins and simulators', 'النماذج والتوائم والمحاكيات', 300], ['Feeding a twin: data paths', 'تغذية التوأم: مسارات البيانات', 420], ['Validation against recorded behaviour', 'التحقق مقابل السلوك المسجّل', 480], ['Drift, limits and ownership', 'الانحراف والحدود والمسؤولية', 360], ['Practice on a SIMULATED twin', 'تدريب على توأم مُحاكى', 360]],
    [['sk-da-01-twins', 2, 'Explain how a plant digital twin is built, fed and kept in step with the plant', 'شرح كيفية بناء التوأم الرقمي للمحطة وتغذيته والإبقاء على تطابقه مع المحطة'], ['sk-fs-ai-twin', 1, 'Check a twin\'s output against recorded behaviour and flag drift', 'مطابقة مخرجات التوأم مع السلوك المسجّل والإشارة إلى الانحراف']],
    [SRC.iaeaAi, SRC.presight], [], false],
  ['c-fs-remote', 'FS-DP-202', 'digital_plant', 'core', null, 20, 5, 4, 'blended',
    'Remote and autonomous operations oversight', 'الإشراف على التشغيل عن بُعد والتشغيل الذاتي',
    'Oversee remote inspection and autonomous systems as the responsible person: what to monitor, when to intervene and how to hand over.',
    'الإشراف على الفحص عن بُعد والأنظمة الذاتية بصفتك الشخص المسؤول: ما الذي تراقبه، ومتى تتدخل، وكيف تسلّم المهمة.',
    [['Levels of autonomy', 'مستويات الاستقلالية', 240], ['Monitoring an autonomous task', 'مراقبة مهمة ذاتية', 300], ['Intervention and safe states', 'التدخل والحالات الآمنة', 300], ['Remote inspection with robots and drones', 'الفحص عن بُعد بالروبوتات والطائرات المسيّرة', 240], ['Hand-over and records', 'التسليم والسجلات', 120]],
    [['sk-da-01-remote', 2, 'Monitor an autonomous or remote task and decide when to intervene', 'مراقبة مهمة ذاتية أو عن بُعد وتقرير وقت التدخل'], ['sk-mp-01-remote', 1, 'Plan a remote inspection and the installation checks around it', 'تخطيط فحص عن بُعد وفحوص التركيب المحيطة به'], ['sk-fs-dp-robotics', 1, 'Describe the inspection robots and drones in use and their limits', 'وصف روبوتات الفحص والطائرات المسيّرة المستخدمة وحدودها']],
    [SRC.tii, SRC.iaeaAi], [], false],
  ['c-fs-aiverify', 'FS-AI-201', 'data_ai', 'core', null, 12, 4, 3, 'elearning',
    'AI output verification and challenge', 'التحقق من مخرجات الذكاء الاصطناعي والطعن فيها',
    'The duty to check and challenge: independent indications, plausibility tests, and how to record that an AI output was verified or rejected.',
    'واجب التحقق والطعن: المؤشرات المستقلة واختبارات المعقولية، وكيفية تسجيل أن مخرجات الذكاء الاصطناعي قد تم التحقق منها أو رُفضت.',
    [['Why AI output needs a checker', 'لماذا تحتاج مخرجات الذكاء الاصطناعي إلى مدقق', 120], ['Independent indications', 'المؤشرات المستقلة', 180], ['Plausibility and bias checks', 'فحوص المعقولية والتحيز', 180], ['Triage of AI alerts', 'فرز تنبيهات الذكاء الاصطناعي', 120], ['Recording the decision', 'تسجيل القرار', 120]],
    [['sk-fs-ai-verify', 2, 'Verify an AI output against independent indications and challenge it when they disagree', 'التحقق من مخرجات الذكاء الاصطناعي مقابل مؤشرات مستقلة والطعن فيها عند التعارض'], ['sk-da-02-review', 2, 'Review AI outputs under the governance procedure and record the result', 'مراجعة مخرجات الذكاء الاصطناعي وفق إجراء الحوكمة وتسجيل النتيجة'], ['sk-fs-ai-anomaly', 1, 'Triage an AI alert with at least one independent indication', 'فرز تنبيه من الذكاء الاصطناعي بمؤشر مستقل واحد على الأقل']],
    [SRC.iaeaAi, SRC.aiLit], [], false],
  ['c-fs-agents', 'FS-AI-202', 'data_ai', 'core', null, 16, 4, 4, 'blended',
    'Governed prompt and agent use', 'الاستخدام المحوكم للأوامر والوكلاء',
    'Use approved AI tools and build one small governed assistant for your own work: clear prompts, data you may use, review points and a named owner. The output is a built artefact, not a quiz.',
    'استخدم أدوات الذكاء الاصطناعي المعتمدة وابنِ مساعداً محوكماً صغيراً لعملك: أوامر واضحة، وبيانات مسموح باستخدامها، ونقاط مراجعة، ومالك محدد. الناتج أداة مبنية لا اختبار.',
    [['Approved tools and use classes', 'الأدوات المعتمدة وفئات الاستخدام', 120], ['Prompts that are clear and bounded', 'أوامر واضحة ومحددة', 240], ['What data may go in', 'البيانات المسموح بإدخالها', 180], ['Building a small assistant', 'بناء مساعد صغير', 300], ['Review points and ownership', 'نقاط المراجعة والمسؤولية', 120]],
    [['sk-fs-ai-prompt', 2, 'Write clear, bounded prompts and agent instructions for an approved tool', 'كتابة أوامر وتعليمات وكلاء واضحة ومحددة لأداة معتمدة'], ['sk-fs-ai-use', 2, 'Use approved AI tools in daily work within their use class', 'استخدام أدوات الذكاء الاصطناعي المعتمدة في العمل اليومي ضمن فئة استخدامها'], ['sk-fs-ai-data-care', 1, 'Decide which data may and may not go into a tool', 'تحديد البيانات التي يجوز إدخالها في الأداة وتلك التي لا يجوز']],
    [SRC.adnoc, SRC.aiLit], [], false],
  ['c-fs-cyber', 'FS-CY-101', 'cyber', 'core', null, 4, 2, 2, 'elearning',
    'Cyber hygiene for all staff', 'النظافة السيبرانية لجميع الموظفين',
    'Awareness for everyone: spotting phishing, handling removable media, looking after passwords and access, why plant and office networks are kept apart, and how to report something suspicious. No technical security detail.',
    'توعية للجميع: اكتشاف التصيّد، والتعامل مع الوسائط القابلة للإزالة، والعناية بكلمات المرور والصلاحيات، ولماذا تُفصل شبكات المحطة عن شبكات المكاتب، وكيفية الإبلاغ عن أي أمر مريب. دون أي تفاصيل أمنية تقنية.',
    [['Phishing and social engineering', 'التصيّد والهندسة الاجتماعية', 50], ['Removable media discipline', 'الانضباط في الوسائط القابلة للإزالة', 40], ['Passwords and access hygiene', 'نظافة كلمات المرور والصلاحيات', 50], ['Why networks are kept apart', 'لماذا تُفصل الشبكات', 40], ['Reporting a suspected incident', 'الإبلاغ عن حادث مشتبه به', 60]],
    [['sk-fs-cy-phishing', 1, 'Recognise a phishing attempt and respond safely', 'التعرف على محاولة تصيّد والتصرف بأمان'], ['sk-fs-cy-media', 1, 'Follow the removable media rules every time', 'اتباع قواعد الوسائط القابلة للإزالة في كل مرة'], ['sk-fs-cy-access', 1, 'Look after passwords and access as personal duties', 'العناية بكلمات المرور والصلاحيات كواجبات شخصية'], ['sk-fs-cy-zones', 1, 'Explain in general terms why plant and office networks are kept apart', 'شرح سبب فصل شبكات المحطة عن شبكات المكاتب بعبارات عامة'], ['sk-fs-cy-report', 1, 'Report a suspected cyber incident through the right channel', 'الإبلاغ عن حادث سيبراني مشتبه به عبر القناة الصحيحة']],
    [SRC.nss42, SRC.nice, SRC.digcomp], [], false],
  ['c-fs-smr', 'FS-AR-201', 'advanced_reactor', 'core', null, 24, 6, 4, 'blended',
    'SMR fundamentals', 'أساسيات المفاعلات المعيارية الصغيرة',
    'Small modular reactor concepts compared with a large PWR: module size, factory build, multi-module operation and fuel forms. Concept learning only; no deployment decision implied.',
    'مفاهيم المفاعلات المعيارية الصغيرة مقارنةً بمفاعل الماء المضغوط الكبير: حجم الوحدة، والتصنيع في المصنع، والتشغيل متعدد الوحدات، وأشكال الوقود. تعلّم مفاهيمي فقط، ولا يُفهم منه أي قرار بالنشر.',
    [['From large PWR to small modules', 'من مفاعل الماء المضغوط الكبير إلى الوحدات الصغيرة', 300], ['Design families compared', 'مقارنة عائلات التصميم', 360], ['Fuel forms and core materials', 'أشكال الوقود ومواد القلب', 300], ['Multi-module operation concepts', 'مفاهيم التشغيل متعدد الوحدات', 300], ['What changes for my role', 'ما الذي يتغير في دوري', 180]],
    [['sk-fs-adv-smr', 2, 'Compare SMR design families with the APR-1400 and explain the main differences', 'مقارنة عائلات تصميم المفاعلات المعيارية الصغيرة بمفاعل APR-1400 وشرح الفروق الرئيسية'], ['sk-pf-01-advfuel', 1, 'Describe advanced fuel forms and core materials in general terms', 'وصف أشكال الوقود المتقدمة ومواد القلب بعبارات عامة'], ['sk-fs-adv-multimodule', 1, 'Explain how one control room can oversee several modules', 'شرح كيفية إشراف غرفة تحكم واحدة على عدة وحدات']],
    [SRC.ans, SRC.e2, SRC.wnnSmr], [], true],
  ['c-fs-passive', 'FS-AR-202', 'advanced_reactor', 'core', null, 16, 4, 4, 'elearning',
    'Passive safety concepts', 'مفاهيم السلامة الخاملة',
    'Natural circulation, gravity-driven cooling and long coping times: how passive features change the safety case and what probabilistic insights add. Concept learning only; no deployment decision implied.',
    'الدوران الطبيعي والتبريد بالجاذبية وأزمنة التحمل الطويلة: كيف تغيّر الخصائص الخاملة حالة السلامة، وما الذي تضيفه الرؤى الاحتمالية. تعلّم مفاهيمي فقط، ولا يُفهم منه أي قرار بالنشر.',
    [['Active and passive safety', 'السلامة النشطة والخاملة', 180], ['Natural circulation and advanced coolants', 'الدوران الطبيعي والمبرّدات المتقدمة', 240], ['Coping time and the operator\'s role', 'زمن التحمل ودور المشغّل', 240], ['Probabilistic safety insights', 'الرؤى الاحتمالية للسلامة', 180], ['Case study (SIMULATED)', 'دراسة حالة (مُحاكاة)', 120]],
    [['sk-fs-adv-passive', 2, 'Explain how passive safety features work and change operator actions', 'شرح عمل خصائص السلامة الخاملة وكيف تغيّر إجراءات المشغّل'], ['sk-ns-01-psa', 1, 'Read a probabilistic safety insight and say what it means for a design choice', 'قراءة رؤية احتمالية للسلامة وبيان دلالتها على خيار تصميمي'], ['sk-pf-02-advcool', 1, 'Describe gas, liquid-metal and natural-circulation coolant systems', 'وصف أنظمة التبريد بالغاز والمعادن السائلة والدوران الطبيعي']],
    [SRC.nea, SRC.wnnSmr], [], true],
  ['c-fs-factoryqa', 'FS-AR-203', 'advanced_reactor', 'core', null, 20, 5, 4, 'blended',
    'Factory fabrication QA for modular builds', 'ضمان جودة التصنيع في المصنع للإنشاءات المعيارية',
    'Quality assurance when modules are built in a factory and installed on site: supplier surveillance, receipt inspection, digital records and modular installation checks. Concept learning only; no deployment decision implied.',
    'ضمان الجودة عندما تُصنع الوحدات في المصنع وتُركّب في الموقع: مراقبة الموردين، وفحص الاستلام، والسجلات الرقمية، وفحوص التركيب المعياري. تعلّم مفاهيمي فقط، ولا يُفهم منه أي قرار بالنشر.',
    [['From stick-built to factory-built', 'من البناء في الموقع إلى التصنيع في المصنع', 180], ['Supplier surveillance', 'مراقبة الموردين', 300], ['Receipt inspection and digital records', 'فحص الاستلام والسجلات الرقمية', 300], ['Modular installation checks', 'فحوص التركيب المعياري', 240], ['Non-conformances across borders', 'حالات عدم المطابقة عبر الحدود', 180]],
    [['sk-fs-adv-factoryqa', 2, 'Plan quality surveillance for a factory-built module', 'تخطيط مراقبة الجودة لوحدة مصنّعة في المصنع'], ['sk-mp-01-remote', 1, 'Check modular installation against its records, including remote inspection', 'فحص التركيب المعياري مقابل سجلاته، بما في ذلك الفحص عن بُعد']],
    [SRC.ans, SRC.match], [], true],
  ['c-fs-h2heat', 'FS-GR-201', 'green', 'core', null, 16, 4, 4, 'blended',
    'Hydrogen and process heat', 'الهيدروجين والحرارة الصناعية',
    'How nuclear heat and electricity can serve hydrogen production and industrial users: interfaces, heat transfer media (including molten salt) and the safety boundary. Concept learning only; no deployment decision implied.',
    'كيف يمكن للحرارة والكهرباء النوويتين خدمة إنتاج الهيدروجين والمستخدمين الصناعيين: الواجهات، ووسائط نقل الحرارة (بما فيها الأملاح المنصهرة)، وحدود السلامة. تعلّم مفاهيمي فقط، ولا يُفهم منه أي قرار بالنشر.',
    [['Energy beyond electricity', 'الطاقة إلى ما بعد الكهرباء', 180], ['Hydrogen routes compared', 'مقارنة مسارات الهيدروجين', 240], ['Heat transfer media and chemistry', 'وسائط نقل الحرارة وكيمياؤها', 240], ['Interfaces and the safety boundary', 'الواجهات وحدود السلامة', 180], ['Case study (SIMULATED)', 'دراسة حالة (مُحاكاة)', 120]],
    [['sk-fs-gr-h2heat', 2, 'Explain how nuclear heat and power could serve hydrogen and industrial users', 'شرح كيفية خدمة الحرارة والطاقة النوويتين لمستخدمي الهيدروجين والصناعة'], ['sk-ch-01-advchem', 1, 'Describe the chemistry of high-temperature coolants such as molten salt', 'وصف كيمياء المبرّدات عالية الحرارة مثل الأملاح المنصهرة'], ['sk-fs-gr-grid', 1, 'Describe flexible operation alongside renewables on the grid', 'وصف التشغيل المرن إلى جانب الطاقة المتجددة على الشبكة']],
    [SRC.enecAdnoc, SRC.iea], [], true],
  ['c-fs-ghg', 'FS-GR-202', 'green', 'core', null, 12, 4, 3, 'elearning',
    'GHG accounting basics', 'أساسيات محاسبة غازات الدفيئة',
    'Scopes 1, 2 and 3, lifecycle thinking and how ENEC reports emissions avoided, so you can read and question a sustainability disclosure.',
    'النطاقات 1 و2 و3، والتفكير في دورة الحياة، وكيف تُبلغ المؤسسة عن الانبعاثات التي تم تجنبها، حتى تتمكن من قراءة إفصاح الاستدامة ومناقشته.',
    [['Why we count carbon', 'لماذا نحسب الكربون', 120], ['Scopes 1, 2 and 3', 'النطاقات 1 و2 و3', 180], ['Lifecycle assessment', 'تقييم دورة الحياة', 180], ['Reading a sustainability report', 'قراءة تقرير الاستدامة', 120], ['Disclosure literacy', 'الإلمام بالإفصاح', 120]],
    [['sk-fs-gr-ghg', 2, 'Classify emissions by scope and explain an emissions-avoided figure', 'تصنيف الانبعاثات حسب النطاق وشرح رقم الانبعاثات التي تم تجنبها'], ['sk-fs-gr-esg', 1, 'Read an ESG disclosure and identify its main metrics', 'قراءة إفصاح بيئي واجتماعي وحوكمي وتحديد مقاييسه الرئيسية'], ['sk-fs-gr-lifecycle', 1, 'Outline a lifecycle carbon assessment for a plant activity', 'وضع مخطط لتقييم الكربون على امتداد دورة الحياة لنشاط في المحطة']],
    [SRC.enecSr, SRC.greencomp], [], false],
  ['c-fs-systems', 'FS-TR-201', 'human', 'core', null, 12, 4, 3, 'classroom',
    'Systems thinking', 'التفكير المنظومي',
    'See the plant, the organisation and the supply chain as connected systems: feedback loops, delays and unintended effects, practised on real cases.',
    'انظر إلى المحطة والمؤسسة وسلسلة الإمداد كمنظومات مترابطة: حلقات التغذية الراجعة والتأخيرات والآثار غير المقصودة، مع التطبيق على حالات واقعية.',
    [['Parts, wholes and boundaries', 'الأجزاء والكل والحدود', 120], ['Feedback loops and delays', 'حلقات التغذية الراجعة والتأخيرات', 180], ['Mapping a real problem', 'رسم خريطة لمشكلة حقيقية', 180], ['Unintended consequences', 'العواقب غير المقصودة', 120], ['Decisions in a system', 'القرارات داخل المنظومة', 120]],
    [['sk-fs-tr-systems', 2, 'Map a plant or organisational problem as a system with loops and delays', 'رسم مشكلة في المحطة أو المؤسسة كمنظومة ذات حلقات وتأخيرات'], ['sk-fs-tr-analytical', 1, 'Break a problem into causes and test them with evidence', 'تفكيك المشكلة إلى أسباب واختبارها بالأدلة']],
    [SRC.wef, SRC.tecdoc], [], false],
  ['c-fs-resilience', 'FS-TR-202', 'human', 'core', null, 8, 4, 2, 'classroom',
    'Resilience through change', 'المرونة في مواجهة التغيير',
    'Stay effective when roles, tools and teams change: recovering from setbacks, adapting routines and noticing your own limits, without lowering the bar on safety.',
    'حافظ على فعاليتك عندما تتغير الأدوار والأدوات والفرق: التعافي من العثرات، وتكييف الروتين، وإدراك حدودك، دون التهاون في معايير السلامة.',
    [['What changes and what does not', 'ما الذي يتغير وما الذي لا يتغير', 90], ['Recovering from setbacks', 'التعافي من العثرات', 90], ['Adapting routines safely', 'تكييف الروتين بأمان', 90], ['Knowing your limits', 'معرفة حدودك', 90], ['A personal change plan', 'خطة تغيير شخصية', 120]],
    [['sk-fs-tr-resilience', 2, 'Adapt routines through a change while keeping safety standards', 'تكييف الروتين خلال التغيير مع الحفاظ على معايير السلامة'], ['sk-fs-tr-selfaware', 1, 'Notice your own limits and ask for support early', 'إدراك حدودك وطلب الدعم مبكراً']],
    [SRC.wef, SRC.mck], [], false],
  ['c-fs-creative', 'FS-TR-203', 'human', 'core', null, 10, 5, 2, 'classroom',
    'Creative problem solving', 'حل المشكلات بطرق إبداعية',
    'Generate and test options when the procedure does not cover the problem in an office or project setting: reframing, analogies, quick experiments and choosing with evidence.',
    'توليد الخيارات واختبارها عندما لا يغطي الإجراء المشكلة في بيئة مكتبية أو مشروع: إعادة الصياغة والتشبيهات والتجارب السريعة والاختيار بالأدلة.',
    [['Reframing the problem', 'إعادة صياغة المشكلة', 120], ['Many options before one', 'خيارات كثيرة قبل خيار واحد', 120], ['Quick, safe experiments', 'تجارب سريعة وآمنة', 120], ['Choosing with evidence', 'الاختيار بالأدلة', 120], ['Curiosity as a habit', 'الفضول كعادة', 120]],
    [['sk-fs-tr-creative', 2, 'Generate several options for a problem and choose one with evidence', 'توليد عدة خيارات لمشكلة واختيار أحدها بالأدلة'], ['sk-fs-tr-curiosity', 1, 'Keep a learning habit and share what you learn', 'الحفاظ على عادة التعلم ومشاركة ما تتعلمه']],
    [SRC.wef, SRC.greencomp], [], false],
  ['c-fs-dataquality', 'FS-DA-203', 'data_ai', 'core', null, 10, 5, 2, 'elearning',
    'Data quality for plant records', 'جودة البيانات في سجلات المحطة',
    'Good data starts at the source: complete, timely and consistent records in work orders and electronic work packages, and how bad data breaks analysis and AI.',
    'تبدأ البيانات الجيدة من المصدر: سجلات كاملة وفي وقتها ومتسقة في أوامر العمل وحزم العمل الإلكترونية، وكيف تُفسد البيانات الرديئة التحليل والذكاء الاصطناعي.',
    [['Data quality dimensions', 'أبعاد جودة البيانات', 120], ['Records at the source', 'السجلات من المصدر', 120], ['Electronic work packages', 'حزم العمل الإلكترونية', 120], ['Finding and fixing errors', 'اكتشاف الأخطاء وتصحيحها', 120], ['Why AI needs good data', 'لماذا يحتاج الذكاء الاصطناعي إلى بيانات جيدة', 120]],
    [['sk-fs-ai-plantdata', 2, 'Assess and improve the quality of plant records used for decisions', 'تقييم جودة سجلات المحطة المستخدمة في القرارات وتحسينها'], ['sk-fs-dp-ework', 1, 'Complete electronic work packages to the data standard', 'إكمال حزم العمل الإلكترونية وفق معيار البيانات']],
    [SRC.iaeaAi, SRC.digcomp], [], false],
  ['c-fs-xr', 'FS-DP-203', 'digital_plant', 'core', null, 14, 7, 2, 'blended',
    'AR and VR for maintenance', 'الواقع المعزز والافتراضي للصيانة',
    'Use augmented and virtual reality to rehearse maintenance tasks, view work instructions in place and support colleagues remotely, with the limits of each tool.',
    'استخدم الواقع المعزز والافتراضي للتمرّن على مهام الصيانة، وعرض تعليمات العمل في مكانها، ودعم الزملاء عن بُعد، مع حدود كل أداة.',
    [['XR in plant work', 'الواقع الممتد في أعمال المحطة', 120], ['Rehearsing a task in VR', 'التمرّن على مهمة بالواقع الافتراضي', 240], ['Instructions in place with AR', 'التعليمات في مكانها بالواقع المعزز', 180], ['Remote expert support', 'دعم الخبراء عن بُعد', 180], ['Limits and good practice', 'الحدود والممارسات الجيدة', 120]],
    [['sk-fs-ai-xr', 2, 'Rehearse a maintenance task in VR and use AR work instructions', 'التمرّن على مهمة صيانة بالواقع الافتراضي واستخدام تعليمات العمل بالواقع المعزز'], ['sk-fs-dp-ework', 1, 'Link an XR step to its electronic work package', 'ربط خطوة الواقع الممتد بحزمة العمل الإلكترونية الخاصة بها']],
    [SRC.e2, SRC.iaeaAi], [], false],
  ['c-fs-procure', 'FS-DP-204', 'digital_plant', 'core', null, 10, 5, 2, 'elearning',
    'Digital procurement', 'المشتريات الرقمية',
    'E-sourcing, digital supplier qualification and in-country value data: how procurement works end to end in digital systems.',
    'التوريد الإلكتروني، والتأهيل الرقمي للموردين، وبيانات القيمة المحلية المضافة: كيف تعمل المشتريات من البداية إلى النهاية في الأنظمة الرقمية.',
    [['The digital procurement cycle', 'دورة المشتريات الرقمية', 120], ['E-sourcing and evaluation', 'التوريد الإلكتروني والتقييم', 120], ['Supplier qualification records', 'سجلات تأهيل الموردين', 120], ['In-country value data', 'بيانات القيمة المحلية المضافة', 120], ['Analytics for buyers', 'التحليلات للمشترين', 120]],
    [['sk-fs-dp-procurement', 2, 'Run a sourcing event end to end in the digital procurement system', 'إدارة عملية توريد من البداية إلى النهاية في نظام المشتريات الرقمي']],
    [SRC.icv, SRC.wef], [], false],
  ['c-fs-smr-x', 'FS-AR-201X', 'advanced_reactor', 'crossover', 'c-fs-smr', 20, 5, 4, 'blended',
    'SMR fundamentals: cross-over for adjacent industries', 'أساسيات المفاعلات المعيارية الصغيرة: نسخة انتقالية للقطاعات المجاورة',
    'A cross-over version for people from oil and gas, power generation, process industries and aviation maintenance: what transfers, what is different in nuclear, and SMR concepts. Concept learning only; no deployment decision implied.',
    'نسخة انتقالية للقادمين من النفط والغاز وتوليد الطاقة والصناعات التحويلية وصيانة الطيران: ما الذي ينتقل، وما المختلف في القطاع النووي، ومفاهيم المفاعلات المعيارية الصغيرة. تعلّم مفاهيمي فقط، ولا يُفهم منه أي قرار بالنشر.',
    [['What transfers from your industry', 'ما الذي ينتقل من قطاعك', 240], ['Nuclear safety culture and rules', 'ثقافة السلامة النووية وقواعدها', 300], ['SMR concepts', 'مفاهيم المفاعلات المعيارية الصغيرة', 300], ['Passive safety in brief', 'السلامة الخاملة باختصار', 180], ['Routes into nuclear roles', 'مسارات الانتقال إلى الأدوار النووية', 180]],
    [['sk-fs-adv-smr', 1, 'Describe SMR concepts and how they differ from large plants', 'وصف مفاهيم المفاعلات المعيارية الصغيرة واختلافها عن المحطات الكبيرة'], ['sk-fs-adv-passive', 1, 'Describe passive safety in general terms', 'وصف السلامة الخاملة بعبارات عامة']],
    [SRC.sask, SRC.ans], ['oil_gas', 'power', 'process', 'aviation'], true],
  ['c-fs-plantlit-x', 'FS-PL-101X', 'advanced_reactor', 'crossover', 'c-fs-smr', 16, 4, 4, 'elearning',
    'Nuclear plant literacy for career changers', 'الإلمام بالمحطة النووية للمنتقلين مهنياً',
    'How a pressurised water reactor plant works, end to end, for people joining from other industries: systems, roles, the control room and safety culture, with a browser simulation (SIMULATED).',
    'كيف تعمل محطة مفاعل الماء المضغوط من البداية إلى النهاية، للقادمين من قطاعات أخرى: الأنظمة والأدوار وغرفة التحكم وثقافة السلامة، مع محاكاة في المتصفح (مُحاكاة).',
    [['From fission to the grid', 'من الانشطار إلى الشبكة', 180], ['Main plant systems', 'أنظمة المحطة الرئيسية', 240], ['Who does what', 'من يفعل ماذا', 180], ['Inside the control room (simulation)', 'داخل غرفة التحكم (محاكاة)', 240], ['Safety culture first', 'ثقافة السلامة أولاً', 120]],
    [['sk-fs-tr-techlit', 1, 'Explain how a PWR plant turns heat into electricity', 'شرح كيف تحوّل محطة مفاعل الماء المضغوط الحرارة إلى كهرباء'], ['sk-fs-tr-systems', 1, 'Describe how the main plant systems depend on each other', 'وصف اعتماد أنظمة المحطة الرئيسية بعضها على بعض']],
    [SRC.e2, SRC.ukNuc], ['oil_gas', 'power', 'process', 'defence'], false],
];

// ───────────── Academies (module + project + mentor template; reviewer signs the capstone off)
const ACADEMIES = [
  { id: 'ac-ai', programme_id: 'pg-acad-ai', code: 'ACAD-AI', theme: 'data_ai', sort: 1, weeks: 24, weekly_hours: 4, capacity: 16, artefact_kind: 'automation', no_decision: false,
    name_en: 'AI Academy', name_ar: 'أكاديمية الذكاء الاصطناعي',
    tagline_en: 'From approved tools to a governed assistant you built and verified for your own work.', tagline_ar: 'من الأدوات المعتمدة إلى مساعد محوكم بنيته وتحققت منه لعملك.',
    modules: ['c-fs-agents', 'c-fs-aiverify', 'c-fs-plantdata', 'c-fs-scripting'],
    project_en: 'Build and verify a small governed AI assistant or automation for a real task in your own work, in the approved sandbox.', project_ar: 'ابنِ مساعداً أو أتمتة صغيرة ومحوكمة بالذكاء الاصطناعي لمهمة حقيقية في عملك وتحقق منها، في البيئة التجريبية المعتمدة.',
    deliverable_en: 'The working artefact, its verification record (independent checks and challenges) and a one-page owner note.', deliverable_ar: 'الأداة العاملة، وسجل التحقق منها (فحوص مستقلة وطعون)، وملاحظة من صفحة واحدة من المالك.',
    mentor_role_en: 'AI practitioner mentor (Digital and AI governance)', mentor_role_ar: 'مرشد ممارس للذكاء الاصطناعي (الحوكمة الرقمية والذكاء الاصطناعي)',
    reviewer_role_en: 'AI governance reviewer', reviewer_role_ar: 'مراجع حوكمة الذكاء الاصطناعي',
    criteria_en: 'Staff in any role with a task an approved AI tool could help with; line manager supports 4 hours a week.', criteria_ar: 'موظفون في أي دور لديهم مهمة يمكن أن تساعد فيها أداة ذكاء اصطناعي معتمدة؛ ويدعم المدير المباشر 4 ساعات أسبوعياً.',
    capstone_skills: [{ skill_id: 'sk-fs-ai-verify', level: 2 }, { skill_id: 'sk-fs-ai-prompt', level: 2 }, { skill_id: 'sk-fs-ai-automation', level: 1 }],
    benchmark_ids: ['UAE-PEERS', 'NUC-NET'], sources: [SRC.adnoc, SRC.nntp] },
  { id: 'ac-twin', programme_id: 'pg-acad-twin', code: 'ACAD-TWIN', theme: 'digital_plant', sort: 2, weeks: 24, weekly_hours: 4, capacity: 12, artefact_kind: 'twin_validation', no_decision: false,
    name_en: 'Digital Twin Bootcamp', name_ar: 'المعسكر التدريبي للتوائم الرقمية',
    tagline_en: 'Validate a twin against recorded plant behaviour before anyone relies on it.', tagline_ar: 'تحقق من التوأم مقابل سلوك المحطة المسجّل قبل أن يعتمد عليه أحد.',
    modules: ['c-fs-plantdata', 'c-fs-dataquality', 'c-fs-twin', 'c-fs-scripting'],
    project_en: 'Validate a SIMULATED digital twin of one plant system against recorded (SIMULATED) data and report drift and limits.', project_ar: 'تحقق من توأم رقمي مُحاكى لأحد أنظمة المحطة مقابل بيانات مسجلة (مُحاكاة)، وأبلغ عن الانحراف والحدود.',
    deliverable_en: 'A validation report: data used, checks run, drift found, limits of use and the owner who keeps it in step.', deliverable_ar: 'تقرير تحقق: البيانات المستخدمة، والفحوص المنفذة، والانحراف المكتشف، وحدود الاستخدام، والمالك المسؤول عن إبقائه متطابقاً.',
    mentor_role_en: 'Digital plant engineer mentor', mentor_role_ar: 'مرشد مهندس المحطة الرقمية',
    reviewer_role_en: 'Engineering subject-matter reviewer', reviewer_role_ar: 'مراجع متخصص في الهندسة',
    criteria_en: 'Engineers, technicians and operators who use plant data; scripting basics completed or taken in the first month.', criteria_ar: 'المهندسون والفنيون والمشغلون الذين يستخدمون بيانات المحطة؛ مع إكمال أساسيات البرمجة النصية أو أخذها في الشهر الأول.',
    capstone_skills: [{ skill_id: 'sk-fs-ai-twin', level: 2 }, { skill_id: 'sk-fs-ai-plantdata', level: 2 }, { skill_id: 'sk-fs-ai-dataeng', level: 1 }],
    benchmark_ids: ['NUC-NET', 'UAE-PEERS'], sources: [SRC.iaeaAi, SRC.nntp] },
  { id: 'ac-smr', programme_id: 'pg-acad-smr', code: 'ACAD-SMR', theme: 'advanced_reactor', sort: 3, weeks: 26, weekly_hours: 3, capacity: 16, artefact_kind: 'role_delta', no_decision: true,
    name_en: 'SMR Fundamentals cohort', name_ar: 'دفعة أساسيات المفاعلات المعيارية الصغيرة',
    tagline_en: 'Understand small modular reactors and what would change in your role. No deployment decision implied.', tagline_ar: 'افهم المفاعلات المعيارية الصغيرة وما الذي سيتغير في دورك. لا يُفهم من ذلك أي قرار بالنشر.',
    modules: ['c-fs-smr', 'c-fs-passive', 'c-fs-factoryqa'],
    project_en: 'Write a role-delta note: how your role would change in a multi-module plant, as a planning assumption.', project_ar: 'اكتب مذكرة فرق الدور: كيف سيتغير دورك في محطة متعددة الوحدات، كافتراض تخطيطي.',
    deliverable_en: 'A two-page role-delta note with the tasks that grow, shrink or are new, and the learning each needs. Planning assumption only.', deliverable_ar: 'مذكرة فرق الدور من صفحتين تتضمن المهام التي تنمو أو تتقلص أو تستجد، والتعلم الذي تحتاجه كل منها. افتراض تخطيطي فقط.',
    mentor_role_en: 'Senior operations mentor', mentor_role_ar: 'مرشد عمليات أول',
    reviewer_role_en: 'Quality and nuclear safety reviewer', reviewer_role_ar: 'مراجع الجودة والسلامة النووية',
    criteria_en: 'Operations, engineering, quality and maintenance staff; open to all families. Concept learning only.', criteria_ar: 'موظفو العمليات والهندسة والجودة والصيانة؛ ومفتوحة لجميع العائلات الوظيفية. تعلّم مفاهيمي فقط.',
    capstone_skills: [{ skill_id: 'sk-fs-adv-smr', level: 2 }, { skill_id: 'sk-fs-adv-passive', level: 2 }, { skill_id: 'sk-fs-adv-factoryqa', level: 1 }],
    benchmark_ids: ['NUC-NET'], sources: [SRC.enen, SRC.nntp] },
  { id: 'ac-energy', programme_id: 'pg-acad-energy', code: 'ACAD-ENERGY', theme: 'green', sort: 4, weeks: 26, weekly_hours: 3, capacity: 14, artefact_kind: 'study', no_decision: true,
    name_en: 'Energy Transition cohort', name_ar: 'دفعة التحول في قطاع الطاقة',
    tagline_en: 'Nuclear in a net-zero system: heat, hydrogen, grid flexibility and carbon accounting.', tagline_ar: 'الطاقة النووية في منظومة صافي الانبعاثات الصفري: الحرارة والهيدروجين ومرونة الشبكة ومحاسبة الكربون.',
    modules: ['c-fs-h2heat', 'c-fs-ghg', 'c-fs-systems'],
    project_en: 'A lifecycle carbon and heat-integration study for one plant activity, on SIMULATED data.', project_ar: 'دراسة للكربون على امتداد دورة الحياة ولتكامل الحرارة لنشاط واحد في المحطة، على بيانات مُحاكاة.',
    deliverable_en: 'A short study with the method, the assumptions, the result and what would change it. SIMULATED data only.', deliverable_ar: 'دراسة قصيرة تتضمن المنهجية والافتراضات والنتيجة وما الذي قد يغيّرها. بيانات مُحاكاة فقط.',
    mentor_role_en: 'Sustainability mentor', mentor_role_ar: 'مرشد الاستدامة',
    reviewer_role_en: 'Sustainability lead reviewer', reviewer_role_ar: 'مراجع قائد الاستدامة',
    criteria_en: 'Staff in engineering, chemistry, sustainability, finance and strategy roles.', criteria_ar: 'الموظفون في أدوار الهندسة والكيمياء والاستدامة والمالية والاستراتيجية.',
    capstone_skills: [{ skill_id: 'sk-fs-gr-h2heat', level: 2 }, { skill_id: 'sk-fs-gr-ghg', level: 2 }, { skill_id: 'sk-fs-gr-grid', level: 1 }],
    benchmark_ids: ['UAE-PEERS', 'NUC-NET'], sources: [SRC.enecSr, SRC.ega] },
];
const COHORTS = [
  ['ac-ai-2026a', 'ac-ai', 'AI-2026-A', 'Cohort 1 (pilot)', 'الدفعة 1 (تجريبية)', '2026-02-02', '2026-07-31', '2026-01-15', 'completed', 16, 1],
  ['ac-ai-2026b', 'ac-ai', 'AI-2026-B', 'Cohort 2', 'الدفعة 2', '2026-09-07', '2027-02-26', '2026-08-20', 'running', 16, 2],
  ['ac-ai-2027a', 'ac-ai', 'AI-2027-A', 'Cohort 3', 'الدفعة 3', '2027-03-01', '2027-08-27', '2026-11-30', 'nominating', 16, 3],
  ['ac-twin-2026a', 'ac-twin', 'TWIN-2026-A', 'Bootcamp 1', 'المعسكر 1', '2026-03-02', '2026-08-28', '2026-02-12', 'completed', 12, 1],
  ['ac-twin-2027a', 'ac-twin', 'TWIN-2027-A', 'Bootcamp 2', 'المعسكر 2', '2027-01-11', '2027-06-25', '2026-12-10', 'planned', 12, 2],
  ['ac-smr-2026a', 'ac-smr', 'SMR-2026-A', 'Cohort 1', 'الدفعة 1', '2026-09-14', '2027-03-12', '2026-08-31', 'running', 16, 1],
  ['ac-energy-2026a', 'ac-energy', 'ENERGY-2026-A', 'Cohort 1', 'الدفعة 1', '2026-11-02', '2027-04-30', '2026-10-23', 'nominating', 14, 1],
];
const PROGRAMMES = [
  [FS_PACK_PROGRAMME, 'FS-PACK', 'Future-skills course pack', 'حزمة دورات مهارات المستقبل', 'all_staff', 'continuing', 'Modular, 4-32 h per course', 'وحدات، 4-32 ساعة لكل دورة', null, null,
    'Modular courses that close the future-skill gaps no course taught before: data, scripting, digital twins, remote operations, AI verification, cyber hygiene, SMR and green skills.', 'دورات معيارية تسد فجوات مهارات المستقبل التي لم تكن تدرّسها أي دورة: البيانات والبرمجة النصية والتوائم الرقمية والتشغيل عن بُعد والتحقق من الذكاء الاصطناعي والنظافة السيبرانية والمفاعلات المعيارية الصغيرة والمهارات الخضراء.', [SRC.ans, SRC.adnoc], 60],
  ['pg-acad-ai', 'ACAD-AI', 'AI Academy', 'أكاديمية الذكاء الاصطناعي', 'all_staff', 'continuing', '24 weeks, about 4 h a week', '24 أسبوعاً، نحو 4 ساعات أسبوعياً', 24, 96,
    'Modules, a built and verified AI artefact as the capstone, and a mentor.', 'وحدات، وأداة ذكاء اصطناعي مبنية ومتحقق منها كمشروع ختامي، ومرشد.', [SRC.adnoc, SRC.nntp], 61],
  ['pg-acad-twin', 'ACAD-TWIN', 'Digital Twin Bootcamp', 'المعسكر التدريبي للتوائم الرقمية', 'disciplines', 'continuing', '24 weeks, about 4 h a week', '24 أسبوعاً، نحو 4 ساعات أسبوعياً', 24, 96,
    'Modules, a twin validation capstone and a mentor.', 'وحدات، ومشروع ختامي للتحقق من توأم رقمي، ومرشد.', [SRC.iaeaAi, SRC.nntp], 62],
  ['pg-acad-smr', 'ACAD-SMR', 'SMR Fundamentals cohort', 'دفعة أساسيات المفاعلات المعيارية الصغيرة', 'foundation', 'continuing', '26 weeks, about 3 h a week', '26 أسبوعاً، نحو 3 ساعات أسبوعياً', 26, 78,
    `Modules, a role-delta capstone and a mentor. ${NO_DECISION_EN}`, `وحدات، ومشروع ختامي لفرق الدور، ومرشد. ${NO_DECISION_AR}`, [SRC.enen, SRC.nntp], 63],
  ['pg-acad-energy', 'ACAD-ENERGY', 'Energy Transition cohort', 'دفعة التحول في قطاع الطاقة', 'all_staff', 'continuing', '26 weeks, about 3 h a week', '26 أسبوعاً، نحو 3 ساعات أسبوعياً', 26, 78,
    'Modules, a carbon and heat study as the capstone, and a mentor.', 'وحدات، ودراسة للكربون والحرارة كمشروع ختامي، ومرشد.', [SRC.enecSr, SRC.ega], 64],
];

export default function build(T) {
  T.programmes.push(...PROGRAMMES.map(([id, code, en, ar, area, kind, den, dar, weeks, hours, pen, par, sources, sort]) => ({
    id, code, name_en: en, name_ar: ar, area, kind, family_id: null, duration_en: den, duration_ar: dar, weeks, hours, population_2024: null, population_note: null,
    purpose_en: pen, purpose_ar: par, sources, conflict_note: null, mandatory: false, sort,
  })));
  T.course_pack_items = [];
  T.course_skill_links = [];
  COURSES.forEach(([id, code, theme, kind, crossOf, hours, weeks, weekly, modality, ten, tar, sen, sar, modules, links, sources, industries, noDecision], i) => {
    T.courses.push({
      id, programme_id: FS_PACK_PROGRAMME, code, title_en: ten, title_ar: tar, modality, initial: false, mandatory: false, audience: kind === 'crossover' ? 'public' : 'staff',
      competency_ids: [], objectives: links.map(([skill_id, level, en, ar]) => ({ skill_id, level, en, ar })), prerequisites: [], duration_hours: hours, qualifying: false,
      evaluation_form_id: null, owner_role: 'Nuclear Training', public_summary: true, summary_en: noDecision && !sen.includes('no deployment decision') ? `${sen} ${NO_DECISION_EN}` : sen,
      summary_ar: sar, sources, packaging: 'xapi', pass_mark: null, validity_months: null, nexus_course_id: null, concept_content: true,
    });
    modules.forEach(([en, ar, min], n) => T.course_modules.push({ id: `${id}-m${n + 1}`, course_id: id, n: n + 1, title_en: en, title_ar: ar, minutes: min, public_summary: true }));
    links.forEach(([skill_id, level, en, ar], n) => T.course_skill_links.push({
      id: `csl-${id.replace(/^c-fs-/, '')}-${skill_id.replace(/^sk-/, '')}`, course_id: id, skill_id, level, objective_n: n + 1, objective_en: en, objective_ar: ar, active: true, updated_by: null, updated_at: `${AS_OF}T00:00:00Z`,
    }));
    T.course_pack_items.push({
      id: `cpi-${id.replace(/^c-fs-/, '')}`, course_id: id, pack: 'fs19', theme, kind, crossover_of: crossOf, for_industries: industries, weeks, weekly_hours: weekly, simulated: true, no_decision: !!noDecision,
      copy_check: 'pending', copy_problems: [], copy_checked_at: null, benchmark_ids: kind === 'crossover' ? ['SMR-WF', 'ENTITLE'] : theme === 'data_ai' ? ['UAE-PEERS', 'ENTITLE'] : theme === 'advanced_reactor' ? ['SMR-WF', 'ENTITLE'] : ['ENTITLE'], sort: i + 1,
    });
  });
  T.academies = ACADEMIES.map((a) => ({
    id: a.id, programme_id: a.programme_id, code: a.code, name_en: a.name_en, name_ar: a.name_ar, tagline_en: a.tagline_en, tagline_ar: a.tagline_ar, theme: a.theme,
    module_course_ids: a.modules, project_en: a.project_en, project_ar: a.project_ar, deliverable_en: a.deliverable_en, deliverable_ar: a.deliverable_ar, artefact_kind: a.artefact_kind,
    mentor_role_en: a.mentor_role_en, mentor_role_ar: a.mentor_role_ar, reviewer_role_en: a.reviewer_role_en, reviewer_role_ar: a.reviewer_role_ar, criteria_en: a.criteria_en, criteria_ar: a.criteria_ar,
    weeks: a.weeks, weekly_hours: a.weekly_hours, capacity: a.capacity, capstone_skills: a.capstone_skills, no_decision: a.no_decision, simulated: true, benchmark_ids: a.benchmark_ids, sources: a.sources, sort: a.sort,
  }));
  T.academy_cohorts = COHORTS.map(([id, academy_id, code, en, ar, starts_on, ends_on, close, status, capacity, sort]) => ({ id, academy_id, code, label_en: en, label_ar: ar, starts_on, ends_on, nominations_close_on: close, status, capacity, sort }));
  T.academy_members = [];
  T.cohort_capstones = [];
}

// ───────────── Simulated nominations, places and capstones (finalize)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;
const MENTORS = { 'ac-ai': ['w-eng-03', 'p-k-instructor'], 'ac-twin': ['w-eng-04', 'w-instr-02'], 'ac-smr': ['w-sro-04', 'w-ss-01'], 'ac-energy': ['p-sustainability-lead', 'w-chem-03'] };
const REVIEWER = { 'ac-ai': 'p-ai-governance', 'ac-twin': 'p-sme-reviewer', 'ac-smr': 'p-head-sq', 'ac-energy': 'p-head-sustainability' };
// [cohort, person, source, status, capstone: [status, result, title, summary] | null]
const MEMBERS = [
  // AI Academy pilot (completed): 11 signed off (2 merit), one returned for rework
  ...[['p-outage-planner', 'merit', 'Outage schedule clash finder', 'An approved-tool assistant that reads the draft outage schedule export and lists clashes between work windows and isolations for a planner to check; every flagged clash is verified against the isolation register before action.'],
    ['p-cap-coord', 'pass', 'Corrective action summary drafter', 'Drafts a plain summary of each new corrective action record for the weekly review; the coordinator verifies each summary against the record and corrects it before it is shared.'],
    ['w-eng-01', 'merit', 'Design change impact checklist', 'Generates a first-pass impact checklist for a design change package from the approved template; the engineer checks every item against the design basis documents and records the challenges made.'],
    ['w-eng-02', 'pass', 'Vendor document triage assistant', 'Sorts incoming vendor documents into review queues with a confidence note; low-confidence items always go to a person and a weekly sample is re-checked.'],
    ['w-qa-01', 'pass', 'Inspection report consistency checker', 'Compares inspection report fields with the inspection plan and highlights gaps for the inspector; it never changes a record.'],
    ['w-corp-01', 'pass', 'Meeting action tracker', 'Extracts actions and owners from meeting notes into a tracker draft that the secretary verifies before circulation.'],
    ['w-mnt-01', 'pass', 'Work order history search', 'A retrieval assistant over closed work orders that returns similar past jobs with links, so the planner reads the originals before deciding.'],
    ['w-ro-01', 'pass', 'Shift turnover note helper', 'Turns a shift log extract into a turnover note draft; the operator verifies each line against the log and the control-room indications.'],
    ['w-chem-01', 'pass', 'Lab trend narrative draft', 'Drafts a weekly narrative for chemistry trends from the approved data export; values are checked against the lab system before release.'],
    ['w-rp-01', 'pass', 'Survey map annotation checker', 'Checks that survey map annotations follow the template and flags missing fields for the technician to correct.'],
    ['w-instr-01', 'pass', 'Lesson plan alignment helper', 'Maps a draft lesson plan to its learning objectives and flags objectives with no activity; the instructor reviews every suggestion.'],
    ['w-ep-01', 'not_yet', 'Drill scenario summary', 'A summary assistant for drill reports. The verification record is incomplete: no independent check of the summaries yet.'],
  ].map(([p, r, t, s]) => ['ac-ai-2026a', p, 'manager', r === 'not_yet' ? 'active' : 'completed', [r === 'not_yet' ? 'returned' : 'signed_off', r, t, s]]),
  // AI Academy cohort 2 (running): 14 places; four capstones submitted for review, the rest drafting
  ['ac-ai-2026b', 'p-k-ro', 'self', 'active', ['draft', null, 'Alarm response cross-reference', 'Draft: an assistant that cross-references an alarm with the alarm response procedure index so I can open the right procedure faster; I will verify it against the index.']],
  ['ac-ai-2026b', 'p-buyer', 'self', 'active', ['submitted', null, 'Supplier quote comparison sheet', 'Builds a side-by-side comparison of supplier quotes from the approved e-sourcing export and flags missing items; every figure is checked against the quote documents before evaluation.']],
  ['ac-ai-2026b', 'p-qc-inspector', 'manager', 'active', ['submitted', null, 'Receipt inspection checklist drafter', 'Drafts a receipt inspection checklist from the purchase order and the quality plan; the inspector verifies each line against the plan and records changes.']],
  ['ac-ai-2026b', 'w-ro-02', 'manager', 'active', ['submitted', null, 'Rounds deviation summary', 'Summarises deviations recorded on digital rounds for the shift supervisor; each deviation links back to the original reading.']],
  ['ac-ai-2026b', 'w-eng-04', 'manager', 'active', ['submitted', null, 'Performance test data checker', 'Checks a performance test data set for missing and out-of-range values before analysis and lists them for the engineer.']],
  ...['w-ro-03', 'w-lo-01', 'w-lo-02', 'w-mnt-02', 'w-mnt-03', 'w-corp-02', 'w-sc-01', 'w-wc-01', 'w-qa-02'].map((p) => ['ac-ai-2026b', p, 'manager', 'active', ['draft', null, '', '']]),
  // AI Academy cohort 3 (nominating)
  ['ac-ai-2027a', 'w-ro-04', 'manager', 'nominated', null], ['ac-ai-2027a', 'w-lo-03', 'manager', 'nominated', null], ['ac-ai-2027a', 'p-k-lo-trainee', 'self', 'nominated', null],
  ['ac-ai-2027a', 'w-chem-02', 'self', 'nominated', null], ['ac-ai-2027a', 'w-rp-02', 'manager', 'nominated', null], ['ac-ai-2027a', 'p-fuel-pm', 'self', 'nominated', null],
  // Digital Twin Bootcamp 1 (completed): 9 signed off (1 merit), one returned
  ...[['w-eng-03', 'merit'], ['w-eng-05', 'pass'], ['w-mnt-04', 'pass'], ['w-mnt-05', 'pass'], ['w-chem-03', 'pass'], ['w-rp-03', 'pass'], ['w-ro-05', 'pass'], ['w-sro-01', 'pass'], ['p-work-control', 'pass'], ['w-mnt-06', 'not_yet']]
    .map(([p, r]) => ['ac-twin-2026a', p, 'manager', r === 'not_yet' ? 'active' : 'completed', [r === 'not_yet' ? 'returned' : 'signed_off', r, `Twin validation: ${['feedwater heater', 'condensate pump', 'cooling tower fan', 'demineraliser', 'area monitor', 'charging pump', 'turbine lube oil', 'main transformer', 'service water', 'air compressor'][Math.floor(rnd(p) * 10)]} (SIMULATED)`, 'Validated the SIMULATED twin against recorded SIMULATED data for three operating states, documented the drift found, the limits of use and the owner who keeps the twin in step with the plant.']]),
  // SMR Fundamentals cohort 1 (running): 11 places; two capstones submitted
  ['ac-smr-2026a', 'p-nse', 'self', 'active', ['submitted', null, 'Role-delta note: nuclear supply engineer', 'Planning assumption only: in a multi-module plant my supplier surveillance grows (factory QA, repeat modules), on-site receipt work changes, and I would need factory fabrication QA at level 2. No deployment decision implied.']],
  ['ac-smr-2026a', 'w-sro-02', 'manager', 'active', ['submitted', null, 'Role-delta note: senior reactor operator', 'Planning assumption only: oversight of several modules from one control room, longer coping times from passive features, more emphasis on monitoring and less on manual actions. No deployment decision implied.']],
  ...['w-sro-03', 'w-ro-06', 'w-ro-07', 'w-eng-02', 'w-mnt-07', 'w-qa-02', 'w-ep-02', 'w-chem-01', 'w-fire-01'].map((p) => ['ac-smr-2026a', p, 'manager', 'active', ['draft', null, '', '']]),
  // Energy Transition cohort 1 (nominating): three accepted early, five nominations waiting
  ['ac-energy-2026a', 'p-consulting-director', 'self', 'accepted', null], ['ac-energy-2026a', 'w-chem-02', 'manager', 'accepted', null], ['ac-energy-2026a', 'w-eng-05', 'manager', 'accepted', null],
  ['ac-energy-2026a', 'w-corp-01', 'self', 'nominated', null], ['ac-energy-2026a', 'w-eng-01', 'manager', 'nominated', null], ['ac-energy-2026a', 'p-group-cfo', 'self', 'nominated', null],
  ['ac-energy-2026a', 'w-rp-04', 'manager', 'nominated', null], ['ac-energy-2026a', 'p-buyer', 'self', 'nominated', null],
];

export function simulate(T, now) {
  const people = T.people;
  const assign = T.role_assignments ?? [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const cohort = new Map(T.academy_cohorts.map((c) => [c.id, c]));
  const academy = new Map(T.academies.map((a) => [a.id, a]));
  const members = [];
  const capstones = [];
  const enrolments = [];
  const evidence = [];
  for (const [cid, pid, source, status, cap] of MEMBERS) {
    const c = cohort.get(cid);
    const a = academy.get(c.academy_id);
    const p = byId.get(pid);
    if (!p || p.kind !== 'staff' || p.status !== 'active') throw new Error(`fs19: ${pid} is not active staff`);
    const id = memberId(cid, pid);
    const lm = lineManagerOf(pid, people, assign, now);
    const nominator = source === 'self' ? pid : source === 'manager' ? (lm ?? 'p-training-mgr') : 'p-training-mgr';
    const src = source === 'manager' && !lm ? 'programme' : source;
    const nomAt = `${(c.nominations_close_on ?? c.starts_on) < now ? addDays(c.nominations_close_on ?? c.starts_on, -12 - Math.floor(rnd(id) * 20)) : addDays(now, -2 - Math.floor(rnd(id) * 12))}T08:${String(10 + Math.floor(rnd(`m${id}`) * 40)).padStart(2, '0')}:00Z`;
    const decided = status !== 'nominated';
    const [m1, m2] = MENTORS[a.id];
    const mentor = decided ? (m1 !== pid ? (rnd(`mm${id}`) < 0.5 || m2 === pid ? m1 : m2) : m2) : null;
    const reviewer = decided ? REVIEWER[a.id] : null;
    if (decided && (mentor === pid || reviewer === pid || mentor === reviewer)) throw new Error(`fs19: mentor/reviewer conflict for ${id}`);
    const decidedAt = decided ? `${addDays(c.nominations_close_on ?? c.starts_on, 3)}T10:00:00Z` : null;
    let completedOn = null;
    // module enrolments: completed cohorts all done; running cohorts progress by weeks elapsed
    if (decided) {
      const mods = a.module_course_ids;
      const elapsed = Math.max(0, dayNo(now) - dayNo(c.starts_on)) / 7;
      mods.forEach((course, k) => {
        const per = a.weeks / mods.length;
        let st;
        if (c.status === 'completed') st = 'completed';
        else if (status === 'accepted') st = 'enrolled';
        else if (elapsed >= per * (k + 1) - (rnd(`late${id}${k}`) < 0.3 ? -2 : 0)) st = 'completed';
        else if (elapsed >= per * k) st = 'in_progress';
        else st = 'enrolled';
        const doneOn = addDays(c.starts_on, Math.round(per * 7 * (k + 1)) - Math.floor(rnd(`d${id}${k}`) * 6));
        enrolments.push({
          id: academyEnrolmentId(id, course), person_id: pid, course_id: course, session_id: null, org_id: null, status: st, source: 'coordinator', assigned_by: 'p-training-mgr',
          due_on: c.ends_on, enrolled_at: decidedAt, progress_pct: st === 'completed' ? 100 : st === 'in_progress' ? 20 + Math.floor(rnd(`pp${id}${k}`) * 60) : 0,
          completed_at: st === 'completed' ? `${doneOn}T12:00:00Z` : null, score: null, certificate_no: null, evaluation_id: null, attendance: null, waitlisted_at: null,
          decided_by: 'p-training-mgr', decision_note: `Academy place: ${a.name_en}`,
        });
      });
      const ccid = capstoneId(id);
      const [cst, result, title, summary] = cap ?? ['draft', null, '', ''];
      const submittedAt = cst === 'draft' ? null : `${c.status === 'completed' ? addDays(c.ends_on, -14) : addDays(now, -3 - Math.floor(rnd(`s${id}`) * 10))}T09:00:00Z`;
      const reviewedOn = ['signed_off', 'returned'].includes(cst) ? addDays(c.ends_on, -3 + Math.floor(rnd(`r${id}`) * 5)) : null;
      const ev = cst === 'signed_off' ? capstoneEvidence(ccid, pid, a.capstone_skills, result, reviewedOn, reviewer, a.name_en) : [];
      evidence.push(...ev.map((e) => ({ ...e, created_at: `${reviewedOn}T15:00:00Z` })));
      if (cst === 'signed_off') completedOn = reviewedOn;
      capstones.push({
        id: ccid, member_id: id, cohort_id: cid, academy_id: a.id, person_id: pid, mentor_person_id: mentor, reviewer_person_id: reviewer, artefact_kind: a.artefact_kind,
        title, summary, lang: 'en', status: cst, result: ['signed_off', 'returned'].includes(cst) ? result : null,
        feedback: cst === 'returned' ? 'Add the verification record: independent checks for at least a week of outputs and the challenges you made. Then resubmit.' : cst === 'signed_off' ? (result === 'merit' ? 'Clear verification record and a real improvement for the team. Merit.' : 'Meets the brief; verification recorded. Pass.') : null,
        submitted_at: submittedAt, reviewed_at: reviewedOn ? `${reviewedOn}T15:00:00Z` : null, evidence_ids: ev.map((e) => e.id), updated_at: reviewedOn ? `${reviewedOn}T15:00:00Z` : submittedAt ?? decidedAt,
      });
    }
    members.push({
      id, cohort_id: cid, academy_id: a.id, person_id: pid, status, source: src, nominated_by: nominator, nominated_at: nomAt,
      note: source === 'self' ? 'I would like to build skills for the next stage of my role.' : 'Recommended by the line manager.',
      decided_by: decided ? 'p-training-mgr' : null, decided_at: decidedAt, decision_note: decided ? 'Place offered; mentor and reviewer named.' : null,
      mentor_person_id: mentor, reviewer_person_id: reviewer, completed_on: completedOn,
    });
  }
  return { members, capstones, enrolments, evidence };
}
const dayNo = (d) => Math.floor(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86_400_000);
const addDays = (d, n) => new Date((dayNo(d) + n) * 86_400_000).toISOString().slice(0, 10);

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  // 1. links become evidence keys (the existing "course teaches skill" relation), never on security skills
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  for (const l of T.course_skill_links) {
    const s = skills.get(l.skill_id);
    if (!s) throw new Error(`fs19: unknown skill ${l.skill_id}`);
    if (!s.evidence_keys.includes(l.course_id)) s.evidence_keys = [...s.evidence_keys, l.course_id];
  }
  // 2. acceptance checks on the pack, and the copy and link check result stored per course
  const course = new Map(T.courses.map((c) => [c.id, c]));
  for (const m of T.course_pack_items) {
    const c = course.get(m.course_id);
    const links = T.course_skill_links.filter((l) => l.course_id === c.id);
    const probs = packProblems(c, m, links, skills);
    if (probs.length) throw new Error(`fs19: ${c.id} fails the pack rules (${probs.join(', ')})`);
    const cp = copyProblems(m.theme, courseTexts(c, T.course_modules.filter((x) => x.course_id === c.id), links), courseUrls(c));
    if (cp.length) throw new Error(`fs19: ${c.id} fails the copy and link check (${cp.map((x) => `${x.code}:${x.detail}`).join(', ')})`);
    Object.assign(m, { copy_check: 'passed', copy_problems: [], copy_checked_at: `${AS_OF}T06:00:00Z` });
  }
  const routes = learningRoutes([...skills.values()], T.person_skills, T.course_skill_links);
  const base = routes.filter((r) => UNHELD_BASELINE.includes(r.skill_id));
  if (base.length !== 6 || base.some((r) => !r.courses.length)) throw new Error('fs19: each of the 6 skills held by nobody needs a course');
  // 3. academies: members, module enrolments, capstones and their evidence
  const { members, capstones, enrolments, evidence } = simulate(T, now);
  T.academy_members = members;
  T.cohort_capstones = capstones;
  T.enrolments.push(...enrolments);
  const before = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  T.skill_evidence = [...T.skill_evidence, ...evidence].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const who = new Set(evidence.map((e) => e.person_id));
  const states = deriveStates(T.skill_evidence.filter((e) => who.has(e.person_id)), now, decayModelFrom(T.engine_settings, T.skills));
  const byId = new Map(T.person_skills.map((p) => [p.id, p]));
  let added = 0;
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const cur = byId.get(s.id);
    if (!cur) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${now}T00:00:00Z` }); added++; continue; }
    Object.assign(cur, patch);
  }
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fs = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  if (evidence.some((e) => !fs.has(e.skill_id))) throw new Error('fs19: capstone evidence must name FS02 skills only');
  const changed = T.person_skills.filter((s) => !fs.has(s.skill_id) && before.has(s.id) && before.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs19: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  // F36 digests read the final states and enrolments: rebuild them the same way fs03 / fs09 do.
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  const beforeDigests = JSON.stringify(T.digest_runs ?? []);
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  const digestsChanged = beforeDigests !== JSON.stringify(T.digest_runs ?? []);
  // 4. acceptance: every academy lists modules, a project and a mentor role; statistics under 10 suppressed
  for (const a of T.academies) if (!a.module_course_ids.length || !a.project_en || !a.mentor_role_en || !a.project_ar || !a.mentor_role_ar) throw new Error(`fs19: academy ${a.id} misses modules, project or mentor role`);
  const st = academyStats(T.academies, T.academy_cohorts, members, capstones, T.enrolments);
  for (const a of st.academies) for (const c of a.cohort_stats) if (c.participants != null && c.participants < 10) throw new Error('fs19: an unsuppressed cohort below 10');
  console.log(`fs19: ${T.course_pack_items.length} pack courses (${T.course_skill_links.length} skill links, copy check passed), ${T.academies.length} academies, ${T.academy_cohorts.length} cohorts, ${members.length} members, ${capstones.length} capstones, ${enrolments.length} module enrolments, ${evidence.length} capstone evidence rows, ${added} new skill states; digests ${digestsChanged ? 'rebuilt (changed)' : 'unchanged'}`);
}
