// M12 · "Find my route" (/start): a short questionnaire that turns three or four answers into an ordered, printable route of
// 4-7 steps into real pages and help guides. Pure and client-side: the answers live in the URL query (shareable, bookmarkable),
// nothing is sent or stored anywhere. Step texts describe what the platform does; links are route ids (src/routes/registry.ts),
// staff pages go through sign-in. Tested for every audience x goal (x interest x level) in tests/unit/m12-orientation.test.tsx.
import type { Bi, HelpLink } from '../help/types';
import { THEME_BY_ID, type ThemeId } from './themes';

export const WHO = ['student', 'graduate', 'employee', 'manager', 'partner'] as const;
export type Who = (typeof WHO)[number];
export const GOALS = ['explore', 'skill', 'recognised', 'team', 'partner'] as const;
export type Goal = (typeof GOALS)[number];
/** Role families for ENEC employees, each a group of job_families rows (every family id appears exactly once). */
export const FAMILIES = ['operations', 'technical', 'science', 'safety', 'support'] as const;
export type Family = (typeof FAMILIES)[number];
export const FAMILY_IDS: Record<Family, string[]> = {
  operations: ['operations', 'outage'],
  technical: ['maintenance', 'engineering', 'nuclear-fuel', 'cyber'],
  science: ['radiation-protection', 'chemistry', 'environment'],
  safety: ['health-safety', 'fire-protection', 'emergency-preparedness', 'security', 'safeguards', 'quality', 'oversight', 'licensing'],
  support: ['training', 'supply-chain', 'corporate'],
};
/** Optional interest area, each one a future-skills theme on /future-skills. */
export const INTERESTS = ['ai', 'clean', 'nextgen', 'human', 'safety'] as const;
export type Interest = (typeof INTERESTS)[number];
export const INTEREST_THEME: Record<Interest, ThemeId> = { ai: 'ai', clean: 'grn', nextgen: 'adv', human: 'hum', safety: 'nks' };
/** Optional experience level. */
export const LEVELS = ['new', 'some', 'experienced'] as const;
export type Level = (typeof LEVELS)[number];

/** Talent programme stages (kafaa_talent_programmes.stage) shown to students and to graduates. */
export type ProgrammeStage = 'school' | 'school_leaver' | 'university' | 'graduate' | 'experienced' | 'postgraduate' | 'mixed';
export const PROGRAMME_STAGES: Partial<Record<Who, ProgrammeStage[]>> = {
  student: ['school', 'school_leaver', 'university'],
  graduate: ['graduate', 'experienced', 'postgraduate', 'mixed'],
};

export interface Answers {
  who?: Who;
  family?: Family;
  goal?: Goal;
  interest?: Interest;
  level?: Level;
}
/** The questionnaire screens: 1 who, 2 goal, 3 optional details, r the route. */
export const SCREENS = ['1', '2', '3', 'r'] as const;
export type Screen = (typeof SCREENS)[number];

const one = <T extends string>(list: readonly T[], v: string | null): T | undefined => (v && (list as readonly string[]).includes(v) ? (v as T) : undefined);

/** Answers from a query string; unknown values are ignored, a family only counts for employees. */
export function parseAnswers(q: URLSearchParams): Answers {
  const who = one(WHO, q.get('who'));
  return {
    who,
    family: who === 'employee' ? one(FAMILIES, q.get('family')) : undefined,
    goal: one(GOALS, q.get('goal')),
    interest: one(INTERESTS, q.get('interest')),
    level: one(LEVELS, q.get('level')),
  };
}

/** Is a screen's question answered (enough to move on)? Screen 3 is optional. */
export function screenDone(a: Answers, s: Screen): boolean {
  if (s === '1') return !!a.who && (a.who !== 'employee' || !!a.family);
  if (s === '2') return !!a.goal;
  return true;
}
export const routeReady = (a: Answers) => screenDone(a, '1') && screenDone(a, '2');

/** The screen to show: the requested one, unless an earlier required question is still open. */
export function screenFor(a: Answers, requested: string | null): Screen {
  const want = one(SCREENS, requested) ?? (routeReady(a) ? 'r' : '1');
  for (const s of ['1', '2'] as const) if (!screenDone(a, s) && SCREENS.indexOf(want) > SCREENS.indexOf(s)) return s;
  return want;
}

/** The query string for answers and a screen, in a stable order (who, family, goal, interest, level, s). */
export function toQuery(a: Answers, screen?: Screen): string {
  const q = new URLSearchParams();
  if (a.who) q.set('who', a.who);
  if (a.who === 'employee' && a.family) q.set('family', a.family);
  if (a.goal) q.set('goal', a.goal);
  if (a.interest) q.set('interest', a.interest);
  if (a.level) q.set('level', a.level);
  if (screen) q.set('s', screen);
  return q.toString();
}

export interface RouteStep {
  id: string;
  title: Bi;
  body: Bi;
  link: HelpLink;
}

const bi = (en: string, ar: string): Bi => ({ en, ar });
const st = (id: string, link: HelpLink, titleEn: string, titleAr: string, bodyEn: string, bodyAr: string): RouteStep => ({ id, link, title: bi(titleEn, titleAr), body: bi(bodyEn, bodyAr) });
const r = (route: string): HelpLink => ({ route });
const guide = (id: string): HelpLink => ({ route: 'help-guide', params: { guide: id } });

/** Every step a route can use. Titles say what to do; bodies say what you will find there. */
export const STEPS: Record<string, RouteStep> = Object.fromEntries(
  [
    // Orientation
    st('start-students', guide('start-students'), 'Read the start guide for students and graduates', 'اقرأ دليل البداية للطلاب والخريجين',
      'Five minutes on how to find a programme, check whether it fits you, practise and apply.',
      'خمس دقائق تعرف فيها كيف تعثر على برنامج، وتتحقق من ملاءمته لك، وتتدرّب، ثم تقدّم طلبك.'),
    st('start-employees', guide('start-employees'), 'Read the start guide for employees', 'اقرأ دليل البداية للموظفين',
      'What you see once signed in: your skills as Kafa\'a derives them from evidence, what to learn next and who can help you grow.',
      'ما تراه بعد تسجيل الدخول: مهاراتك كما تستنتجها كفاءة من الأدلة، وما تتعلّمه تالياً، ومن يمكنه مساعدتك على النمو.'),
    st('start-managers', guide('start-managers'), 'Read the start guide for managers and HR', 'اقرأ دليل البداية للمديرين والموارد البشرية',
      'Your team\'s skill depth, validating what people claim and planning training from evidence.',
      'عمق مهارات فريقك، واعتماد ما يدّعيه أعضاؤه، والتخطيط للتدريب بناءً على الأدلة.'),
    st('start-partners', guide('start-partners'), 'Read the start guide for partners', 'اقرأ دليل البداية للشركاء',
      'What universities, suppliers and partner organisations can do on Kafa\'a.',
      'ما يمكن للجامعات والموردين والجهات الشريكة القيام به على كفاءة.'),
    st('levels', r('competencies-levels'), 'Learn how skill levels work', 'تعرّف على كيفية عمل مستويات المهارات',
      'Four levels from awareness to expert, the same for every skill, so you always know what to show next.',
      'أربعة مستويات من الإلمام إلى الخبرة، وهي واحدة لكل المهارات، لتعرف دائماً ما الذي عليك إظهاره تالياً.'),
    // Careers
    st('careers-map', r('careers'), 'Browse the Career Map', 'تصفّح خريطة المهن',
      'Job families with filters for entry-level and regulated roles and the education each role asks for.',
      'العائلات الوظيفية مع مرشحات للأدوار المناسبة للمبتدئين والأدوار الخاضعة للتنظيم والتعليم الذي يتطلبه كل دور.'),
    st('journey', r('pathways-journey'), 'Follow the journey from school to a first role', 'تابع الرحلة من المدرسة إلى أول وظيفة',
      'From your interests and STEM experiences to a programme and a first role, with a readiness checklist.',
      'من اهتماماتك وتجاربك في العلوم والتقنية والهندسة والرياضيات إلى برنامج ثم أول وظيفة، مع قائمة تحقق للجاهزية.'),
    st('programmes', r('pathways'), 'Find a programme for your stage', 'اعثر على برنامج يناسب مرحلتك',
      'The programme finder groups every programme by life stage, with eligibility and duration.',
      'يجمع باحث البرامج كل البرامج حسب المرحلة العمرية، مع شروط الأهلية والمدة.'),
    st('jobs', r('careers-jobs'), 'Check the vacancies', 'اطّلع على الوظائف الشاغرة',
      'The vacancy listing is linked to ENEC\'s official careers channel.',
      'ترتبط قائمة الوظائف الشاغرة بقناة التوظيف الرسمية لـENEC.'),
    st('translate', r('careers-translate'), 'See how your experience carries over', 'اطّلع على كيفية انتقال خبرتك',
      'From oil and gas, power, aviation, defence or utilities: the nearest roles, what transfers and how to bridge the gap.',
      'من النفط والغاز أو الطاقة أو الطيران أو الدفاع أو المرافق: أقرب الأدوار، وما ينتقل من خبرتك، وكيف تسدّ الفجوة.'),
    st('paths', r('careers-paths'), 'Look at the career paths', 'اطّلع على المسارات المهنية',
      'Family and path views, including the operator ladder with the conditions on each step.',
      'عروض العائلات والمسارات، بما فيها سلّم المشغّلين مع شروط كل خطوة.'),
    st('plan', r('careers-plan'), 'Plan a path to a target role', 'خطّط لمسار إلى دور مستهدف',
      'Steps, conditions, indicative months and the competency gap from where you are to where you want to be.',
      'الخطوات والشروط والمدة التقديرية بالأشهر وفجوة الكفاءات بين موقعك الحالي وما تطمح إليه.'),
    st('horizons', r('careers-horizons'), 'See how roles change by 2030 and 2035', 'اطّلع على تغيّر الأدوار بحلول 2030 و2035',
      'The technology drivers behind each change and the concept future roles.',
      'المحرّكات التقنية وراء كل تغيير، والأدوار المستقبلية المقترحة.'),
    st('outlook', r('careers-outlook-criteria'), 'Read the role outlook criteria', 'اقرأ معايير آفاق الأدوار',
      'Which roles are growing, changing or stable, and the published criteria behind each label.',
      'الأدوار المتنامية أو المتغيرة أو المستقرة، والمعايير المنشورة وراء كل تصنيف.'),
    st('next-gen', r('careers-next-gen'), 'See what next-generation reactors would change', 'اطّلع على ما قد تغيّره مفاعلات الجيل القادم',
      'A planning overlay for every role, with sources. No deployment decision is implied.',
      'طبقة تخطيطية لكل دور مع المصادر، ولا تعني اتخاذ أي قرار بالنشر.'),
    st('role2030', r('my-role-2030'), 'Open My role in 2030', 'افتح دوري في 2030',
      'How your own role changes, the skills it adds, a bridge curriculum and your time to get ready.',
      'كيف يتغير دورك أنت، والمهارات التي يضيفها، ومنهج انتقالي، والوقت اللازم لتستعد.'),
    st('career-health', r('my-career-health'), 'Take the Career Health check', 'أجرِ فحص الصحة المهنية',
      'Assess five parts of your career health, chart a plan and book a career conversation. Private to you.',
      'قيّم خمسة جوانب من صحتك المهنية، وارسم خطة، واحجز محادثة مهنية. النتائج خاصة بك.'),
    // Skills and learning
    st('skills', r('skills'), 'Explore the Skills catalogue', 'استكشف كتالوج المهارات',
      'Every skill at each level, who needs it now and in 2030, and how it maps to international frameworks.',
      'كل مهارة في كل مستوى، ومن يحتاجها الآن وفي 2030، وكيف تُطابق الأطر الدولية.'),
    st('starter', r('pathways-starter'), 'Try the future-skills starter', 'جرّب بداية مهارات المستقبل',
      'Short, sourced lessons on AI literacy and SMR orientation with a self-check. Nothing is stored.',
      'دروس قصيرة موثّقة المصادر في الإلمام بالذكاء الاصطناعي والتعريف بالمفاعلات المعيارية الصغيرة، مع اختبار ذاتي. لا يُحفظ شيء.'),
    st('practice', r('learn-practice'), 'Take an open practice quiz', 'أجرِ اختباراً تدريبياً مفتوحاً',
      'Practice quizzes on public topics, no sign-in needed.',
      'اختبارات تدريبية في موضوعات عامة، دون الحاجة إلى تسجيل الدخول.'),
    st('academies', r('learn-academies'), 'Look at the future-skills academies', 'اطّلع على أكاديميات مهارات المستقبل',
      'AI Academy, Digital Twin Bootcamp, SMR Fundamentals and Energy Transition cohorts on one template.',
      'أكاديمية الذكاء الاصطناعي، والمعسكر التدريبي للتوأم الرقمي، ودفعة أساسيات المفاعلات المعيارية الصغيرة، ودفعة تحوّل الطاقة، وفق قالب واحد.'),
    st('course-pack', r('learn-future-skills'), 'Browse the future-skills course pack', 'تصفّح حزمة دورات مهارات المستقبل',
      'Modular courses that close future-skill gaps, each linked to skills at a stated level.',
      'دورات معيارية تسدّ فجوات مهارات المستقبل، وكل منها مرتبط بمهارات عند مستوى محدد.'),
    st('learn', r('learn'), 'Browse the learning catalogue', 'تصفّح كتالوج التعلّم',
      'What each programme covers and how long it runs, with sources.',
      'ما يغطيه كل برنامج ومدته، مع المصادر.'),
    st('passport', r('my-skills'), 'Open your Skills Passport', 'افتح جواز مهاراتك',
      'What you are qualified and skilled in, how it was evidenced and what is about to lapse.',
      'ما أنت مؤهل وماهر فيه، وكيف ثبت ذلك بالأدلة، وما الذي يوشك أن تنتهي صلاحيته.'),
    st('coach', r('my-coach'), 'Ask the Learning Coach what to learn next', 'اسأل مدرّب التعلّم عمّا تتعلّمه تالياً',
      'Your next-best learning this month, ranked against your role and target roles, with the reason for each.',
      'أنسب ما تتعلّمه هذا الشهر، مرتّباً وفق دورك والأدوار التي تستهدفها، مع سبب كل اقتراح.'),
    st('guide-skill', guide('reading-a-skill'), 'Read the guide to reading a skill', 'اقرأ دليل قراءة المهارة',
      'What the level descriptions, trend and decay class on a skill page mean.',
      'معنى وصف المستويات والاتجاه وفئة التقادم في صفحة المهارة.'),
    // Recognition
    st('recognition', r('recognition'), 'See how experience becomes credit', 'اطّلع على كيفية تحوّل الخبرة إلى رصيد',
      'Recognition of prior learning: evidence, two assessors, indicative NQF levels and credits.',
      'الاعتراف بالتعلّم السابق: الأدلة، ومقيّمان اثنان، ومستويات الإطار الوطني للمؤهلات والأرصدة الاسترشادية.'),
    st('guide-recognition', guide('recognition-and-credits'), 'Read the guide to recognition and credits', 'اقرأ دليل الاعتراف والأرصدة',
      'How a recognition request moves from evidence to a decision, step by step.',
      'كيف ينتقل طلب الاعتراف من الأدلة إلى القرار، خطوة بخطوة.'),
    st('guide-evidence', guide('evidence-and-validation'), 'Read the guide to evidence and validation', 'اقرأ دليل الأدلة والتحقق',
      'Which evidence counts towards a skill level and who validates it.',
      'ما الأدلة التي تُحتسب لمستوى المهارة، ومن يتحقق منها.'),
    st('my-recognition', r('my-recognition'), 'Ask for recognition of what you already do', 'اطلب الاعتراف بما تقوم به فعلاً',
      'Build the evidence pack and answer attestation requests.',
      'أعدّ ملف الأدلة، وأجب عن طلبات الإفادة.'),
    st('my-credits', r('my-credits'), 'Follow your learning credits', 'تابع أرصدتك التعليمية',
      'Your credit ledger, indicative NQF levels and progress on credit stacks.',
      'سجل أرصدتك، ومستويات الإطار الوطني للمؤهلات الاسترشادية، وتقدّمك في حزم الأرصدة.'),
    st('external-certs', r('my-external-certs'), 'Add your external certificates', 'أضف شهاداتك الخارجية',
      'A verifier checks them and the crosswalk maps them to skills.',
      'يتحقق منها مدقّق، ويطابقها جدول المطابقة مع المهارات.'),
    st('verify', r('verify'), 'Verify a certificate', 'تحقّق من شهادة',
      'Check a Kafa\'a-issued course certificate by its number. It is never a FANR certificate.',
      'تحقّق من شهادة دورة صادرة عن كفاءة برقمها. وهي ليست شهادة صادرة عن الهيئة الاتحادية للرقابة النووية.'),
    st('verify-badge', r('verify-badge-check'), 'Verify a Kafa\'a badge', 'تحقّق من شارة كفاءة',
      'Check the signature and status of a downloaded badge.',
      'تحقّق من توقيع شارة منزّلة وحالتها.'),
    st('guide-verify', guide('verify-a-credential'), 'Read the guide to verifying a credential', 'اقرأ دليل التحقق من الشهادات',
      'What a verification result means and what it does not.',
      'ما الذي تعنيه نتيجة التحقق وما الذي لا تعنيه.'),
    // Teams and planning
    st('team-skills', r('team-skills'), 'Open your team capability heatmap', 'افتح خريطة قدرات فريقك',
      'Skill depth, coverage against targets and single points of failure in your team.',
      'عمق المهارات، والتغطية مقارنة بالأهداف، ونقاط الإخفاق المنفردة في فريقك.'),
    st('critical', r('workforce-critical-skills'), 'Review the critical future skills', 'راجع مهارات المستقبل الحرجة',
      'The register of future skills to secure, with owners, targets and computed progress.',
      'سجل مهارات المستقبل الواجب تأمينها، مع المسؤولين والأهداف والتقدّم المحتسب.'),
    st('needs', r('training-needs'), 'Check the training needs forecast', 'اطّلع على توقّع الاحتياجات التدريبية',
      'Demand per course and quarter against session capacity.',
      'الطلب على كل دورة في كل ربع سنة مقارنة بالسعة المتاحة للجلسات.'),
    st('datasheet', r('skills-datasheet'), 'Read the skills ontology datasheet', 'اقرأ ورقة بيانات أنطولوجيا المهارات',
      'Size, sources, update cadence, how inference works and how bias is handled.',
      'الحجم والمصادر ووتيرة التحديث وكيفية عمل الاستدلال وكيفية التعامل مع التحيّز.'),
    st('frameworks', r('skills-frameworks'), 'Use the international crosswalk', 'استخدم جدول المطابقة الدولي',
      'How Kafa\'a skills map to ESCO, O*NET, SFIA and other frameworks, with a machine-readable export.',
      'كيف تُطابق مهارات كفاءة أطر ESCO وO*NET وSFIA وغيرها، مع ملف تصدير قابل للقراءة آلياً.'),
    // Partners
    st('partners', r('partners'), 'See the partner directory', 'اطّلع على دليل الشركاء',
      'Publicly announced relationships, with source links and status.',
      'العلاقات المعلنة للعامة، مع روابط المصادر وحالة كل علاقة.'),
    st('suppliers', r('suppliers'), 'Read how to become a supplier', 'اقرأ كيف تصبح مورداً',
      'Localisation, ICV and quality standards, then the readiness path and sign-up.',
      'معايير التوطين والقيمة المحلية المضافة والجودة، ثم مسار الجاهزية والتسجيل.'),
    st('universities', r('universities'), 'Visit the universities page', 'زر صفحة الجامعات',
      'Academic partners, scholarships and curriculum alignment.',
      'الشركاء الأكاديميون والمنح الدراسية ومواءمة المناهج.'),
    st('research', r('research'), 'Look at the research challenges', 'اطّلع على تحديات البحث',
      'Screened public research challenges and how to propose work.',
      'تحديات بحثية عامة تمت مراجعتها، وكيفية اقتراح عمل بحثي.'),
    st('consortium', r('ecosystem-consortium'), 'Learn about the energy trainee consortium', 'تعرّف على اتحاد متدربي الطاقة',
      'One trainee cohort shared by energy employers, with modules hosted in turn and a joint project.',
      'دفعة متدربين واحدة تتشاركها جهات العمل في قطاع الطاقة، مع وحدات تستضيفها الجهات بالتناوب ومشروع مشترك.'),
    st('regional-plan', r('ecosystem-regional-plan'), 'Open the regional skills plan', 'افتح خطة المهارات الإقليمية',
      'Forward skill demand released to local providers as suppressed aggregates, and the providers\' commitments.',
      'الطلب المستقبلي على المهارات، منشوراً للجهات المزوّدة المحلية كبيانات مجمّعة محجوبة الخلايا الصغيرة، والتزامات هذه الجهات.'),
    st('partner-readiness', r('partner-future-readiness'), 'Check your contractors\' future-skills readiness', 'تحقّق من جاهزية مقاوليك لمهارات المستقبل',
      'Your contractors against the 2030 versions of the role profiles you are contracted for.',
      'مقاولوك مقارنة بنسخ 2030 من ملفات الأدوار المتعاقد عليها.'),
    st('contact', r('contact'), 'Get in touch', 'تواصل معنا',
      'A contact form that goes to the right team\'s mailbox.',
      'نموذج اتصال يُوجَّه إلى صندوق بريد الفريق المعني.'),
  ].map((x) => [x.id, x]),
);

/** The audience's start guide (always the first step). */
const ORIENT: Record<Who, string> = { student: 'start-students', graduate: 'start-students', employee: 'start-employees', manager: 'start-managers', partner: 'start-partners' };

/** Goal steps per audience, in order (the start guide, the level tweak and the interest step are added around them). */
export const RECIPES: Record<Goal, Record<Who, string[]>> = {
  explore: {
    student: ['journey', 'programmes', 'careers-map', 'horizons'],
    graduate: ['careers-map', 'programmes', 'jobs', 'plan'],
    employee: ['paths', 'plan', 'horizons', 'role2030', 'career-health'],
    manager: ['horizons', 'outlook', 'paths', 'team-skills'],
    partner: ['careers-map', 'horizons', 'universities', 'consortium'],
  },
  skill: {
    student: ['starter', 'practice', 'skills', 'academies'],
    graduate: ['skills', 'practice', 'course-pack', 'academies'],
    employee: ['passport', 'skills', 'coach', 'course-pack', 'academies'],
    manager: ['team-skills', 'needs', 'course-pack', 'academies'],
    partner: ['frameworks', 'course-pack', 'partner-readiness', 'suppliers'],
  },
  recognised: {
    student: ['recognition', 'guide-recognition', 'practice', 'verify'],
    graduate: ['recognition', 'guide-evidence', 'translate', 'verify'],
    employee: ['passport', 'guide-evidence', 'my-recognition', 'my-credits', 'external-certs'],
    manager: ['guide-evidence', 'recognition', 'team-skills', 'verify'],
    partner: ['verify', 'verify-badge', 'guide-verify', 'recognition'],
  },
  team: {
    student: ['horizons', 'outlook', 'datasheet'],
    graduate: ['horizons', 'outlook', 'datasheet'],
    employee: ['team-skills', 'horizons', 'needs', 'start-managers'],
    manager: ['team-skills', 'critical', 'needs', 'horizons', 'datasheet'],
    partner: ['partner-readiness', 'regional-plan', 'frameworks'],
  },
  partner: {
    student: ['universities', 'research', 'consortium'],
    graduate: ['universities', 'research', 'consortium', 'partners'],
    employee: ['partners', 'universities', 'research', 'consortium'],
    manager: ['partners', 'suppliers', 'consortium', 'regional-plan'],
    partner: ['partners', 'suppliers', 'universities', 'research', 'regional-plan', 'partner-readiness'],
  },
};

export const MIN_STEPS = 4;
export const MAX_STEPS = 7;

/** The step for an interest area: open its theme on the future-skills explainer. */
export function interestStep(i: Interest): RouteStep {
  const th = THEME_BY_ID[INTEREST_THEME[i]];
  return {
    id: `interest-${i}`,
    link: { route: 'future-skills', hash: `theme-${th.id}` },
    title: bi(`Go deeper: ${th.title.en}`, `تعمّق أكثر: ${th.title.ar}`),
    body: bi(
      'Open this theme in the future-skills programme explainer: what it covers, who it helps and every page for it.',
      'افتح هذا المحور في دليل برنامج مهارات المستقبل: ما يغطيه، ومن يفيد، وكل الصفحات المتعلقة به.',
    ),
  };
}

/**
 * The route for a set of answers: the audience's start guide, the goal steps for that audience (newcomers get "how levels
 * work" first; experienced graduates and employees who want to explore or build skills get a recognition or "your skills in
 * nuclear" step), then the interest step. Duplicates are dropped and the route is 4-7 steps long. Empty until who and goal
 * are answered.
 */
export function buildRoute(a: Answers): RouteStep[] {
  if (!a.who || !a.goal) return [];
  const ids: string[] = [ORIENT[a.who], ...RECIPES[a.goal][a.who]];
  if (a.level === 'new' && a.goal !== 'team' && a.goal !== 'partner') ids.splice(1, 0, 'levels');
  if (a.level === 'experienced' && (a.who === 'graduate' || a.who === 'employee')) {
    if (a.goal === 'explore') ids.splice(2, 0, 'translate');
    if (a.goal === 'skill') ids.splice(2, 0, 'recognition');
  }
  const seen = new Set<string>();
  const steps = ids.filter((id) => !seen.has(id) && seen.add(id)).map((id) => STEPS[id]);
  const extra = a.interest ? [interestStep(a.interest)] : [];
  const room = MAX_STEPS - extra.length;
  const out = [...steps.slice(0, room), ...extra];
  // Short recipes (a goal far from the audience) are padded with the general overview steps.
  for (const id of ['skills', 'careers-map', 'learn']) {
    if (out.length >= MIN_STEPS || seen.has(id)) continue;
    out.splice(out.length - extra.length, 0, STEPS[id]);
    seen.add(id);
  }
  return out;
}
