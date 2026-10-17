// M12 · Future-skills programme explainer (/future-skills): the twelve future-skills themes in plain language, in English and
// Arabic. Each theme says what it is, who it helps and what you can do on Kafa'a for it, and links to the real pages by route
// id (staff pages go through sign-in, see GoToLink). The theme list and its feature ids follow the programme plan
// (docs/kafaa/ref/PLAN.md, section 3); the benchmarks shown for a theme are read from FEATURE_BENCHMARKS and the
// kafaa_benchmarks rows, never typed here. Content describes the platform only: no ENEC facts, figures or policies.
// Parity, ids, routes and features are enforced by tests/unit/m12-orientation.test.tsx.
import { FEATURE_BENCHMARKS } from '../../../domain/taxonomy';
import type { Bi, HelpLink } from '../help/types';

export type ThemeId = 'tax' | 'ai' | 'adv' | 'grn' | 'hum' | 'nks' | 'mob' | 'lrn' | 'crd' | 'uae' | 'gov' | 'eco';
/** Bands on the theme map. Labels: m12.fsx.band.<id>. */
export type ThemeBand = 'skills' | 'growth' | 'system';

export interface FsTheme {
  id: ThemeId;
  /** Plan code (TAX, AI ...), shown as a small tag. */
  code: string;
  band: ThemeBand;
  icon: string;
  title: Bi;
  /** What the theme is. */
  what: Bi;
  /** Who it helps. */
  who: Bi;
  /** What you can do on Kafa'a for it. */
  doHere: Bi[];
  /** "Explore" buttons: public pages first, then pages that need sign-in. */
  explore: HelpLink[];
  /** Programme feature ids in this theme (FS01 ... FS84). */
  features: string[];
}

export const THEME_BANDS: ThemeBand[] = ['skills', 'growth', 'system'];

const bi = (en: string, ar: string): Bi => ({ en, ar });
const to = (...ids: string[]): HelpLink[] => ids.map((route) => ({ route }));

export const THEMES: FsTheme[] = [
  {
    id: 'tax',
    code: 'TAX',
    band: 'skills',
    icon: 'search',
    title: bi('Skills intelligence and the catalogue', 'ذكاء المهارات والكتالوج'),
    what: bi(
      'One shared language for skills. Every skill is described at four levels and tagged with how widely it can be reused, whether demand for it is emerging, growing, stable or declining, and how fast it goes out of date.',
      'لغة مشتركة واحدة للمهارات. توصف كل مهارة على أربعة مستويات، وتُصنَّف بحسب مدى قابليتها لإعادة الاستخدام، وما إذا كان الطلب عليها ناشئاً أو متنامياً أو مستقراً أو متراجعاً، ومدى سرعة تقادمها.',
    ),
    who: bi(
      'Anyone who wants to know what a skill really means, and the people who plan learning and roles around it.',
      'كل من يريد أن يعرف المعنى الحقيقي لمهارة ما، والمعنيون بتخطيط التعلّم والأدوار على أساسها.',
    ),
    doHere: [
      bi(
        'Browse the Skills catalogue and open any skill to see its level descriptions, the roles that need it now and in 2030, and the learning that builds it.',
        'تصفّح كتالوج المهارات وافتح أي مهارة لترى وصف مستوياتها، والأدوار التي تحتاجها الآن وفي عام 2030، والتعلّم الذي يبنيها.',
      ),
      bi(
        'See how Kafa\'a skills map to international frameworks such as ESCO, O*NET, SFIA, SkillsFuture and DigComp, and download the crosswalk.',
        'اطّلع على مطابقة مهارات كفاءة مع أطر دولية مثل ESCO وO*NET وSFIA وSkillsFuture وDigComp، ونزّل جدول المطابقة.',
      ),
      bi(
        'Follow every published change in the catalogue change log, and read how Skills on the Rise is counted.',
        'تابع كل تغيير منشور في سجل تغييرات الكتالوج، واقرأ كيف تُحتسب المهارات الصاعدة.',
      ),
    ],
    explore: to('skills', 'skills-frameworks', 'skills-changes', 'skills-rising-method', 'skills-rising'),
    features: ['FS01', 'FS02', 'FS03', 'FS07', 'FS08', 'FS23', 'FS70', 'FS71', 'FS72'],
  },
  {
    id: 'ai',
    code: 'AI',
    band: 'skills',
    icon: 'sparkle',
    title: bi('AI and digital fluency', 'الطلاقة في الذكاء الاصطناعي والمجال الرقمي'),
    what: bi(
      'What good, safe use of AI and digital tools looks like at work, described as a ladder of four rungs across four dimensions, with plant examples.',
      'ما يبدو عليه الاستخدام الجيد والآمن للذكاء الاصطناعي والأدوات الرقمية في العمل، موصوفاً في سلّم من أربع درجات عبر أربعة أبعاد، مع أمثلة من المحطة.',
    ),
    who: bi(
      'Everyone. The ladder sets a target for every job family, not only for digital specialists.',
      'الجميع؛ إذ يحدد السلّم هدفاً لكل عائلة وظيفية، لا للمتخصصين الرقميين وحدهم.',
    ),
    doHere: [
      bi('Read the AI Fluency Ladder and the target for your job family.', 'اقرأ سلّم الطلاقة في الذكاء الاصطناعي والهدف المحدد لعائلتك الوظيفية.'),
      bi(
        'Once signed in, see your rung from your skill evidence, take the short AI and digital fitness check, and practise catching a wrong AI output in sandbox drills.',
        'بعد تسجيل الدخول، اطّلع على درجتك في السلّم استناداً إلى أدلة مهاراتك، وأجرِ فحص اللياقة الرقمية والذكاء الاصطناعي القصير، وتدرّب على اكتشاف مخرجات الذكاء الاصطناعي الخاطئة في تمارين البيئة التجريبية.',
      ),
      bi('Students can begin with the future-skills starter, which includes an AI-literacy lesson.', 'ويمكن للطلاب البدء ببداية مهارات المستقبل، وفيها درس في الإلمام بالذكاء الاصطناعي.'),
    ],
    explore: to('learn-ai-fluency', 'pathways-starter', 'my-ai-fluency', 'my-ai-fitness', 'my-ai-drills'),
    features: ['FS09', 'FS10', 'FS36', 'FS37', 'FS40', 'FS76', 'FS80'],
  },
  {
    id: 'adv',
    code: 'ADV',
    band: 'skills',
    icon: 'sun',
    title: bi('Next-generation reactors', 'مفاعلات الجيل القادم'),
    what: bi(
      'Awareness of the reactor technologies under evaluation, such as small modular and advanced reactors, and what they would change, and keep, in today\'s roles. It is a planning view only: no deployment decision is implied.',
      'الوعي بتقنيات المفاعلات قيد التقييم، مثل المفاعلات المعيارية الصغيرة والمفاعلات المتقدمة، وما قد تغيّره أو تُبقيه في أدوار اليوم. إنها رؤية تخطيطية فقط، ولا تعني اتخاذ أي قرار بالنشر.',
    ),
    who: bi(
      'Staff who want to see how their role could evolve, students thinking about a long career in nuclear, and workforce planners.',
      'الموظفون الذين يريدون معرفة كيف قد يتطور دورهم، والطلاب الذين يفكرون في مسيرة طويلة في القطاع النووي، ومخططو القوى العاملة.',
    ),
    doHere: [
      bi('See what next-generation reactors would change in each role, with sources.', 'اطّلع على ما قد تغيّره مفاعلات الجيل القادم في كل دور، مع المصادر.'),
      bi('Explore the technology families under evaluation and the skills they may need.', 'استكشف العائلات التقنية قيد التقييم والمهارات التي قد تحتاجها.'),
      bi(
        'Once signed in, compare your skills with each technology family and practise diagnosis in digital-twin drills.',
        'بعد تسجيل الدخول، قارن مهاراتك بكل عائلة تقنية، وتدرّب على التشخيص في تمارين التوأم الرقمي.',
      ),
    ],
    explore: to('careers-next-gen', 'future', 'careers-horizons', 'my-next-gen', 'my-twin-drills'),
    features: ['FS04', 'FS13', 'FS14', 'FS38', 'FS39'],
  },
  {
    id: 'grn',
    code: 'GRN',
    band: 'skills',
    icon: 'globe',
    title: bi('Energy transition and green skills', 'تحوّل الطاقة والمهارات الخضراء'),
    what: bi(
      'CleanEnergyComp, the sustainability competence framework in Kafa\'a: twelve competences in four areas, with learning outcomes and role targets, plus learning on hydrogen, process heat and the grid.',
      'كفاءات الطاقة النظيفة، إطار كفاءات الاستدامة في كفاءة: اثنتا عشرة كفاءة في أربعة مجالات، مع نواتج التعلّم وأهداف الأدوار، إضافة إلى تعلّم يتناول الهيدروجين والحرارة الصناعية والشبكة الكهربائية.',
    ),
    who: bi(
      'Anyone whose work touches the wider energy system, and managers who need ESG and greenhouse-gas literacy.',
      'كل من يتصل عمله بمنظومة الطاقة الأوسع، والمديرون الذين يحتاجون إلى الإلمام بالحوكمة البيئية والاجتماعية وغازات الدفيئة.',
    ),
    doHere: [
      bi('Read the twelve competences, their learning outcomes and role targets.', 'اقرأ الكفاءات الاثنتي عشرة ونواتج تعلّمها وأهداف الأدوار.'),
      bi(
        'Once signed in, see your level against your job family\'s target, and follow the energy-transition learning and the ESG and GHG track for managers.',
        'بعد تسجيل الدخول، اطّلع على مستواك مقارنة بهدف عائلتك الوظيفية، وتابع تعلّم تحوّل الطاقة ومسار الحوكمة البيئية والاجتماعية وغازات الدفيئة للمديرين.',
      ),
    ],
    explore: to('skills-clean-energy', 'my-clean-energy', 'learn-energy-transition', 'learn-esg-managers'),
    features: ['FS41', 'FS42', 'FS43'],
  },
  {
    id: 'hum',
    code: 'HUM',
    band: 'skills',
    icon: 'users',
    title: bi('Human and leadership skills', 'المهارات الإنسانية والقيادية'),
    what: bi(
      'The Nuclear Critical Core Skills: the human and thinking skills every role at a nuclear plant needs, with how each is developed and assessed, and the behaviours expected of leaders.',
      'المهارات الأساسية الحرجة في المجال النووي: المهارات الإنسانية ومهارات التفكير التي يحتاجها كل دور في المحطة النووية، وكيف تُطوَّر كل منها وتُقيَّم، والسلوكيات المتوقعة من القادة.',
    ),
    who: bi('Every role, from new starters to senior leaders.', 'كل الأدوار، من المنضمين الجدد إلى كبار القادة.'),
    doHere: [
      bi('Read each core skill and how it maps to international frameworks.', 'اقرأ كل مهارة أساسية وكيف تُطابق الأطر الدولية.'),
      bi(
        'Once signed in, practise situational-judgement scenarios, adaptive problem solving and role-play conversations, for development only.',
        'بعد تسجيل الدخول، تدرّب على سيناريوهات الحكم الظرفي وحلّ المشكلات التكيّفي ومحادثات لعب الأدوار، لأغراض التطوير فقط.',
      ),
      bi('Leaders can read the behaviours rated in the leadership 360.', 'ويمكن للقادة الاطلاع على السلوكيات التي يقيّمها تقييم القيادة الشامل.'),
    ],
    explore: to('learn-core-skills', 'my-core-skills', 'my-core-practice', 'my-problem-solving', 'leadership-behaviours'),
    features: ['FS25', 'FS26', 'FS46', 'FS47', 'FS48', 'FS58', 'FS59'],
  },
  {
    id: 'nks',
    code: 'NKS',
    band: 'skills',
    icon: 'shield',
    title: bi('Nuclear knowledge and safety culture', 'المعرفة النووية وثقافة السلامة'),
    what: bi(
      'Keeping expert knowledge inside the organisation, and keeping a questioning attitude when AI and automation join the work.',
      'الحفاظ على معرفة الخبراء داخل المؤسسة، والإبقاء على موقف التساؤل عندما يدخل الذكاء الاصطناعي والأتمتة إلى العمل.',
    ),
    who: bi(
      'Experts who share what they know, newer colleagues who learn from them, and everyone who works alongside AI tools.',
      'الخبراء الذين يشاركون ما يعرفونه، والزملاء الأحدث الذين يتعلمون منهم، وكل من يعمل إلى جانب أدوات الذكاء الاصطناعي.',
    ),
    doHere: [
      bi('Read about safety culture: the traits, the values and how concerns are raised.', 'اقرأ عن ثقافة السلامة: السمات والقيم وكيفية إثارة المخاوف.'),
      bi(
        'Once signed in, watch the expert lecture library, follow the localisation countdown to 2030 and work through safety culture with AI in the loop.',
        'بعد تسجيل الدخول، شاهد مكتبة محاضرات الخبراء، وتابع العد التنازلي للتوطين حتى 2030، واطّلع على ثقافة السلامة مع الذكاء الاصطناعي.',
      ),
    ],
    explore: to('safety-culture', 'knowledge-lectures', 'knowledge-localisation', 'my-safety-culture-ai'),
    features: ['FS44', 'FS45', 'FS49'],
  },
  {
    id: 'mob',
    code: 'MOB',
    band: 'growth',
    icon: 'briefcase',
    title: bi('Career mobility and role change', 'التنقل المهني وتحوّل الأدوار'),
    what: bi(
      'How roles are expected to change by 2030 and 2035, which tasks tools may take on and what people will still own, and the routes from one role to another.',
      'كيف يُتوقع أن تتغير الأدوار بحلول 2030 و2035، وما المهام التي قد تتولاها الأدوات وما يبقى على عاتق الناس، والمسارات من دور إلى آخر.',
    ),
    who: bi(
      'Staff planning their next move, career changers from other industries, and HR teams planning transitions.',
      'الموظفون الذين يخططون لخطوتهم التالية، والقادمون من قطاعات أخرى، وفرق الموارد البشرية التي تخطط لعمليات الانتقال.',
    ),
    doHere: [
      bi('See every role in 2030 and 2035, and the published criteria behind each outlook label.', 'اطّلع على كل دور في 2030 و2035، وعلى المعايير المنشورة وراء كل تصنيف للآفاق.'),
      bi(
        'Plan a path to a target role, or see how experience from oil and gas, power, aviation, defence or utilities carries over.',
        'خطّط لمسار إلى دور مستهدف، أو اطّلع على كيفية انتقال خبرتك من النفط والغاز أو الطاقة أو الطيران أو الدفاع أو المرافق.',
      ),
      bi(
        'Once signed in, open My role in 2030 and the Career Health check.',
        'بعد تسجيل الدخول، افتح دوري في 2030 وفحص الصحة المهنية.',
      ),
    ],
    explore: to('careers-horizons', 'careers-outlook-criteria', 'careers-plan', 'careers-translate', 'my-role-2030', 'my-career-health'),
    features: ['FS05', 'FS06', 'FS11', 'FS12', 'FS15', 'FS16', 'FS27', 'FS28', 'FS33', 'FS34', 'FS35', 'FS81'],
  },
  {
    id: 'lrn',
    code: 'LRN',
    band: 'growth',
    icon: 'book',
    title: bi('Learning that closes future-skill gaps', 'تعلّم يسدّ فجوات مهارات المستقبل'),
    what: bi(
      'Modular courses, academies and pathways built around the skills that are missing, each linked to skills at a stated level.',
      'دورات معيارية وأكاديميات ومسارات مبنية حول المهارات الناقصة، وكل منها مرتبط بمهارات عند مستوى محدد.',
    ),
    who: bi(
      'Learners, and training teams who need to see which skills nothing teaches yet.',
      'المتعلمون، وفرق التدريب التي تحتاج إلى معرفة المهارات التي لا يغطيها أي تعلّم بعد.',
    ),
    doHere: [
      bi(
        'Browse the future-skills course pack and the academies: AI Academy, Digital Twin Bootcamp, SMR Fundamentals and Energy Transition cohorts.',
        'تصفّح حزمة دورات مهارات المستقبل والأكاديميات: أكاديمية الذكاء الاصطناعي، والمعسكر التدريبي للتوأم الرقمي، ودفعة أساسيات المفاعلات المعيارية الصغيرة، ودفعة تحوّل الطاقة.',
      ),
      bi('Try the open practice quizzes, no sign-in needed.', 'جرّب الاختبارات التدريبية المفتوحة دون الحاجة إلى تسجيل الدخول.'),
      bi(
        'Once signed in, the Learning Coach ranks what to learn next and gives the reason for every suggestion.',
        'بعد تسجيل الدخول، يرتّب لك مدرّب التعلّم ما تتعلّمه تالياً ويوضح سبب كل اقتراح.',
      ),
    ],
    explore: to('learn-future-skills', 'learn-academies', 'learn-practice', 'learn', 'my-coach', 'learn-pathways'),
    features: ['FS17', 'FS18', 'FS19', 'FS20', 'FS21', 'FS22', 'FS56', 'FS57', 'FS75'],
  },
  {
    id: 'crd',
    code: 'CRD',
    band: 'growth',
    icon: 'check',
    title: bi('Credentials and recognition', 'الشهادات والاعتراف'),
    what: bi(
      'Turning learning and experience into records others can check: recognition of prior learning, indicative NQF levels and credits, micro-credentials and signed badges.',
      'تحويل التعلّم والخبرة إلى سجلات يمكن للآخرين التحقق منها: الاعتراف بالتعلّم السابق، ومستويات الإطار الوطني للمؤهلات والأرصدة الاسترشادية، والشهادات المصغّرة والشارات الموقّعة.',
    ),
    who: bi(
      'Experienced people whose skills are not on paper yet, and anyone who needs to check a Kafa\'a record.',
      'أصحاب الخبرة الذين لم تُوثَّق مهاراتهم بعد، وكل من يحتاج إلى التحقق من سجل صادر عن كفاءة.',
    ),
    doHere: [
      bi(
        'Read how experience becomes recognised credit: evidence, two assessors, indicative NQF levels and credits.',
        'اقرأ كيف تتحول الخبرة إلى رصيد معترف به: الأدلة، ومقيّمان اثنان، ومستويات الإطار الوطني للمؤهلات والأرصدة الاسترشادية.',
      ),
      bi('Verify a Kafa\'a certificate or badge.', 'تحقّق من شهادة أو شارة صادرة عن كفاءة.'),
      bi(
        'Once signed in, ask for recognition, follow your credits and add external certificates.',
        'بعد تسجيل الدخول، اطلب الاعتراف بتعلّمك، وتابع أرصدتك، وأضف شهاداتك الخارجية.',
      ),
    ],
    explore: to('recognition', 'verify', 'verify-badge-check', 'my-recognition', 'my-credits', 'my-external-certs'),
    features: ['FS24', 'FS29', 'FS30', 'FS31', 'FS32', 'FS78', 'FS79'],
  },
  {
    id: 'uae',
    code: 'UAE',
    band: 'system',
    icon: 'home',
    title: bi('National alignment and Emiratisation', 'المواءمة الوطنية والتوطين'),
    what: bi(
      'Linking skills, programmes and targets to the national strategies they serve, each link citing its source, and following Emirati progression by competency area in aggregate.',
      'ربط المهارات والبرامج والأهداف بالاستراتيجيات الوطنية التي تخدمها، مع ذكر مصدر كل ربط، ومتابعة تقدّم الكفاءات الإماراتية حسب مجال الكفاءة على مستوى إجمالي.',
    ),
    who: bi(
      'Students and graduates looking for national programmes, and the planners who report on alignment.',
      'الطلاب والخريجون الباحثون عن البرامج الوطنية، والمخططون الذين يعدّون تقارير المواءمة.',
    ),
    doHere: [
      bi('Find programmes by life stage, from school to graduate, and follow the journey from school to a first role.', 'اعثر على البرامج حسب المرحلة العمرية، من المدرسة إلى التخرّج، وتابع الرحلة من المدرسة إلى أول وظيفة.'),
      bi(
        'Once signed in, staff see the core five future skills from their own evidence in My Future Skills Wallet; planning roles see national-strategy alignment.',
        'بعد تسجيل الدخول، يرى الموظفون مهارات المستقبل الخمس الأساسية المحتسبة من أدلتهم في محفظتي لمهارات المستقبل، وتطّلع أدوار التخطيط على المواءمة مع الاستراتيجيات الوطنية.',
      ),
    ],
    explore: to('pathways', 'pathways-journey', 'my-future-wallet', 'national-alignment'),
    features: ['FS62', 'FS63', 'FS73', 'FS74'],
  },
  {
    id: 'gov',
    code: 'GOV',
    band: 'system',
    icon: 'chart',
    title: bi('Workforce analytics and reporting', 'تحليلات القوى العاملة والتقارير'),
    what: bi(
      'A register of the critical future skills to secure, forecast bands to 2035, a quarterly skills disclosure that follows ISO 30414 and a registry of workforce pilots, failures included. The figures are simulated.',
      'سجل لمهارات المستقبل الحرجة الواجب تأمينها، ونطاقات توقعات حتى 2035، وإفصاح ربع سنوي عن المهارات وفق ISO 30414، وسجل للمشاريع التجريبية للقوى العاملة بما فيها الإخفاقات. والأرقام محاكاة.',
    ),
    who: bi('Managers, HR and leadership teams.', 'المديرون وفرق الموارد البشرية والقيادة.'),
    doHere: [
      bi(
        'Read the skills ontology datasheet: size, sources, update cadence, how inference works and how bias is handled.',
        'اقرأ ورقة بيانات أنطولوجيا المهارات: الحجم والمصادر ووتيرة التحديث وكيفية عمل الاستدلال وكيفية التعامل مع التحيّز.',
      ),
      bi(
        'Once signed in, managers see their team capability heatmap; HR and leadership roles see critical future skills, skill forecasts and the ISO 30414 disclosure.',
        'بعد تسجيل الدخول، يرى المديرون خريطة قدرات فرقهم، وتطّلع أدوار الموارد البشرية والقيادة على مهارات المستقبل الحرجة وتوقعات المهارات وإفصاح ISO 30414.',
      ),
    ],
    explore: to('skills-datasheet', 'team-skills', 'workforce-critical-skills', 'workforce-skill-forecasts', 'workforce-disclosure'),
    features: ['FS50', 'FS51', 'FS52', 'FS53', 'FS54', 'FS55', 'FS60', 'FS61', 'FS84'],
  },
  {
    id: 'eco',
    code: 'ECO',
    band: 'system',
    icon: 'link',
    title: bi('Universities, suppliers and partners', 'الجامعات والموردون والشركاء'),
    what: bi(
      'Working with education providers, suppliers and other energy employers on shared skills: a regional skills plan, numeric pledges, a shared trainee consortium and contractor readiness against future role profiles.',
      'العمل مع مزوّدي التعليم والموردين وجهات العمل الأخرى في قطاع الطاقة على مهارات مشتركة: خطة مهارات إقليمية، وتعهدات رقمية، واتحاد مشترك للمتدربين، وجاهزية المقاولين مقارنة بملفات الأدوار المستقبلية.',
    ),
    who: bi('Universities, training providers, suppliers and partner organisations.', 'الجامعات ومزوّدو التدريب والموردون والجهات الشريكة.'),
    doHere: [
      bi(
        'See the UAE energy trainee consortium, the universities page, the research challenges and how to become a supplier.',
        'اطّلع على اتحاد متدربي الطاقة في الإمارات، وصفحة الجامعات، وتحديات البحث، وكيفية أن تصبح مورداً.',
      ),
      bi(
        'Once signed in, partners see the regional skills plan and future-skills readiness for their contractors.',
        'بعد تسجيل الدخول، يطّلع الشركاء على خطة المهارات الإقليمية وجاهزية مقاوليهم لمهارات المستقبل.',
      ),
    ],
    explore: to('ecosystem-consortium', 'universities', 'research', 'suppliers', 'ecosystem-regional-plan', 'partner-future-readiness'),
    features: ['FS64', 'FS65', 'FS66', 'FS67', 'FS68', 'FS69', 'FS77', 'FS82', 'FS83'],
  },
];

export const THEME_BY_ID: Record<string, FsTheme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

/** The benchmarks a theme follows most often (ids from FEATURE_BENCHMARKS), most-used first, ties in the order the features list them. */
export function themeBenchmarks(theme: FsTheme, max = 3): string[] {
  const n = new Map<string, number>();
  for (const f of theme.features) for (const id of FEATURE_BENCHMARKS[f] ?? []) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
}
