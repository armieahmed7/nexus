// FS25 + FS26 (future-skills wave C · E5, M33 Human Skills Studio) seed: Nuclear Critical Core Skills and situational judgement practice.
// build():    the 16 core skills in the three SkillsFuture clusters (written for a nuclear plant, each mapped to at least two benchmarks,
//             to INPO traits in M08 and to FS02 catalogue skills, with three level descriptors and its own development and assessment
//             routes), the candidates the inclusion rule did not add (wellbeing is an outcome, not a skill), a target for each of the 20 job
//             families x 16 core skills, the 48-item bilingual SJT bank, and simulated practice sets for active staff 2025-Q4 to 2026-Q4 with
//             the same rules as the server (pickSet, scoreSjt). Practice never writes skill evidence.
// finalize(): FINALIZE_LAST: checks only (no writes): the inclusion rule passes, every core skill has evidence holders in the final F01
//             states, and the demo personas see a profile.
// Synthetic people only; every benchmark mapping names a kafaa_benchmarks row; every fact on screen comes from a stored row with a source.
import { CLUSTERS, coreProfile, inclusionProblems, benchmarkIdsOf } from '../../../src/modules/m33/coreSkills.ts';
import { pickSet, personSeed, scoreSjt, sjtItemProblem, feedbackOf, quarterOf } from '../../../src/modules/m33/sjt.ts';
import { ITEMS } from './fs25-core-skills.items.mjs';

export const FINALIZE_LAST = true;
const AS_OF = '2026-10-10';
const S = {
  ssg: { label: 'SkillsFuture Singapore · Factsheet on top skills trends in 2025 (Critical Core Skills)', url: 'https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf', as_of: AS_OF },
  ssgReview: { label: 'IAFOR PCAH 2025 · mixed-methods review of the Critical Core Skills (wellbeing and career health as outcomes)', url: 'https://papers.iafor.org/wp-content/uploads/papers/pcah2025/PCAH2025_93970.pdf', as_of: AS_OF },
  wef: { label: 'World Economic Forum · Future of Jobs Report 2025, skills outlook', url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/', as_of: AS_OF },
  jrc: { label: 'European Commission JRC · GreenComp, with EntreComp and LifeComp', url: 'https://joint-research-centre.ec.europa.eu/greencomp', as_of: AS_OF },
  delta: { label: 'McKinsey · Defining the skills citizens will need in the future world of work (DELTAs)', url: 'https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work', as_of: AS_OF },
  iaea: { label: 'IAEA-TECDOC-1917 · Assessing behavioural competencies of employees in nuclear facilities', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf', as_of: AS_OF },
};

// ───────────── Benchmark mappings (labels only from the research packs; benchmark ids are kafaa_benchmarks rows)
const M = (framework, benchmark_id, ref, label_en, label_ar) => ({ framework, benchmark_id, ref, label_en, label_ar });
const SSG = {
  thinking_critically: M('ssg_ccs', 'SSG-SF', 'TC', 'SkillsFuture Critical Core Skills · Thinking Critically cluster', 'المهارات الأساسية الحرجة في SkillsFuture · مجموعة التفكير النقدي'),
  interacting_with_others: M('ssg_ccs', 'SSG-SF', 'IO', 'SkillsFuture Critical Core Skills · Interacting with Others cluster', 'المهارات الأساسية الحرجة في SkillsFuture · مجموعة التفاعل مع الآخرين'),
  staying_relevant: M('ssg_ccs', 'SSG-SF', 'SR', 'SkillsFuture Critical Core Skills · Staying Relevant cluster', 'المهارات الأساسية الحرجة في SkillsFuture · مجموعة مواكبة المستجدات'),
};
const INPO = (n, en, ar) => M('inpo', null, `trait-${n}`, `INPO safety-culture trait · ${en} (M08)`, `سمة ثقافة السلامة لدى INPO · ${ar} (M08)`);
const WEF = (en, ar) => M('wef', 'WEF-FOJ', null, `WEF core skill · ${en}`, `مهارة أساسية لدى المنتدى الاقتصادي العالمي · ${ar}`);
const LIFE = (en, ar) => M('lifecomp', 'GREENCOMP', null, `LifeComp · ${en}`, `إطار LifeComp · ${ar}`);
const ENTRE = M('entrecomp', 'GREENCOMP', null, 'EntreComp · ideas, resources, into action', 'إطار EntreComp · الأفكار والموارد والتنفيذ');
const GREEN = M('greencomp', 'GREENCOMP', null, 'GreenComp · embracing complexity in sustainability', 'إطار GreenComp · استيعاب التعقيد في الاستدامة');
const DELTA = (en, ar) => M('delta', 'MCK-DELTA', null, `McKinsey DELTA · ${en}`, `عناصر DELTA لدى ماكنزي · ${ar}`);
const IAEA = (en, ar) => M('iaea_1917', 'IAEA-1917', null, `IAEA-TECDOC-1917 behavioural competency · ${en}`, `الكفاءة السلوكية في IAEA-TECDOC-1917 · ${ar}`);

// ───────────── Routes (development and assessment). `practice` / `sjt` on the skill itself are the generic FS26 routes.
const R = (kind, ref, title_en, title_ar) => ({ kind, ref, title_en, title_ar });
const PRACTICE = (id) => R('practice', id, 'Situational judgement practice for this skill', 'تمارين الحكم الظرفي لهذه المهارة');
const SJT = (id) => R('sjt', id, 'Situational judgement practice result (development only)', 'نتيجة تمارين الحكم الظرفي (للتطوير فقط)');
const CHECKIN = R('checkin', '/my/skills/checkins', 'Skill check-in with peers and your manager', 'تقييم دوري للمهارة مع الزملاء ومديرك');

const D = (l1en, l1ar, l2en, l2ar, l3en, l3ar) => [{ level: 1, en: l1en, ar: l1ar }, { level: 2, en: l2en, ar: l2ar }, { level: 3, en: l3en, ar: l3ar }];

/** The 16 Nuclear Critical Core Skills. */
export const CORE = [
  // ── Thinking critically
  {
    id: 'cs-questioning', code: 'TC-1', cluster: 'thinking_critically', name_en: 'Questioning attitude', name_ar: 'موقف التساؤل',
    summary_en: 'Notices when something is not as expected, asks why, and challenges assumptions before acting, including assumptions built into a plan or a tool\'s output.',
    summary_ar: 'يلاحظ ما لا يسير كما هو متوقع، ويسأل عن السبب، ويتحدى الافتراضات قبل التصرف، بما فيها الافتراضات المضمّنة في خطة أو في مخرجات أداة.',
    plant_en: 'Pauses a work package when a valve label does not match the drawing and asks work control before continuing.',
    plant_ar: 'يوقف حزمة العمل مؤقتاً عندما لا يطابق ملصق الصمام المخطط، ويستشير التحكم في العمل قبل المتابعة.',
    descriptors: D('Asks when something looks different from what the procedure or briefing said.', 'يسأل عندما يبدو شيء مختلفاً عمّا ورد في الإجراء أو الإحاطة.',
      'Challenges assumptions in plans and readings with specific questions and checks independent indications.', 'يتحدى الافتراضات في الخطط والقراءات بأسئلة محددة ويتحقق من مؤشرات مستقلة.',
      'Builds a team habit of challenge: invites questions, values them and closes each one with an answer.', 'يبني لدى الفريق عادة التحدي: يدعو إلى الأسئلة ويقدّرها ويغلق كل سؤال بإجابة.'),
    mappings: [INPO(2, 'Questioning attitude', 'موقف التساؤل'), IAEA('questioning attitude', 'موقف التساؤل'), LIFE('critical thinking', 'التفكير النقدي'), WEF('analytical thinking', 'التفكير التحليلي'), SSG.thinking_critically],
    trait_ids: ['trait-2'], skill_ids: ['sk-sc-01', 'sk-fs-tr-analytical'],
    development: [R('course', 'c-scwe', 'Safety-conscious work environment', 'بيئة العمل الواعية بالسلامة'), R('page', '/oe', 'Operating experience lessons where an assumption went unchallenged', 'دروس الخبرة التشغيلية حيث لم يُطعن في افتراض'), PRACTICE('cs-questioning')],
    assessment: [CHECKIN, R('observation', 'brief-challenge', 'Observed challenge in a pre-job brief', 'تحدٍّ ملاحظ في إحاطة ما قبل العمل'), SJT('cs-questioning')],
    dev_approach_en: 'Learning from operating experience where an unchallenged assumption mattered, and rehearsing challenge in briefs.',
    dev_approach_ar: 'التعلّم من الخبرة التشغيلية حيث كان لافتراض لم يُطعن فيه أثر، والتمرّن على التحدي في الإحاطات.',
    assess_approach_en: 'Peer and manager check-ins on observed challenges, plus scenario practice.',
    assess_approach_ar: 'تقييمات دورية من الزملاء والمدير لحالات تحدٍّ ملاحظة، إضافة إلى تمارين السيناريوهات.',
    sources: [S.ssg, S.iaea, S.wef, S.jrc],
  },
  {
    id: 'cs-conservative', code: 'TC-2', cluster: 'thinking_critically', name_en: 'Conservative decision-making', name_ar: 'اتخاذ القرار المحافظ',
    summary_en: 'When conditions are uncertain, chooses the action that keeps the plant in a known safe state, even at a cost to schedule or output.',
    summary_ar: 'عندما تكون الظروف غير مؤكدة، يختار الإجراء الذي يُبقي المحطة في حالة آمنة معروفة، حتى لو كان ذلك على حساب الجدول الزمني أو الإنتاج.',
    plant_en: 'Recommends holding a power change when an indication is unexplained, and records the reasoning for the shift manager.',
    plant_ar: 'يوصي بتثبيت تغيير القدرة عندما يظهر مؤشر غير مفسَّر، ويوثّق الأسباب لمدير الوردية.',
    descriptors: D('Stops and asks when unsure, rather than proceeding on a guess.', 'يتوقف ويسأل عند عدم التيقّن بدلاً من المضي بناءً على تخمين.',
      'Weighs options against safety margins, chooses the conservative one and explains why.', 'يوازن الخيارات مقابل هوامش السلامة ويختار الخيار المحافظ ويشرح السبب.',
      'Sets the expectation that production pressure never outranks margin, and backs people who slow down.', 'يرسّخ أن ضغط الإنتاج لا يتقدّم أبداً على هامش السلامة، ويساند من يتمهّل.'),
    mappings: [INPO(5, 'Decision-making', 'اتخاذ القرار'), IAEA('conservative decision-making', 'اتخاذ القرار المحافظ'), DELTA('self-leadership · coping with uncertainty', 'القيادة الذاتية · التعامل مع عدم اليقين'), SSG.thinking_critically],
    trait_ids: ['trait-5'], skill_ids: ['sk-ld-02', 'sk-ld-02-decide'],
    development: [R('page', '/my/simulator', 'Simulator scenarios with uncertain indications and a decision debrief', 'سيناريوهات المحاكي بمؤشرات غير مؤكدة مع مراجعة للقرار'), R('ojt', 'decision-meetings', 'Shadow the shift manager\'s operational decision meetings', 'مرافقة مدير الوردية في اجتماعات القرارات التشغيلية'), PRACTICE('cs-conservative')],
    assessment: [R('simulator', '/my/simulator', 'Decision scoring in the simulator debrief', 'تقييم القرار في مراجعة ما بعد المحاكي'), SJT('cs-conservative')],
    dev_approach_en: 'Simulator scenarios with uncertain indications and a decision debrief, and shadowing real decision meetings.',
    dev_approach_ar: 'سيناريوهات المحاكي بمؤشرات غير مؤكدة مع مراجعة للقرار، ومرافقة اجتماعات القرارات الفعلية.',
    assess_approach_en: 'The decision is scored in the simulator debrief, plus scenario practice.',
    assess_approach_ar: 'يُقيَّم القرار في مراجعة ما بعد المحاكي، إضافة إلى تمارين السيناريوهات.',
    sources: [S.ssg, S.iaea, S.delta],
  },
  {
    id: 'cs-procedure', code: 'TC-3', cluster: 'thinking_critically', name_en: 'Procedure use and knowing when to stop', name_ar: 'استخدام الإجراءات ومعرفة متى تتوقف',
    summary_en: 'Follows procedures as written, keeps place, and stops when a step cannot be done as written or the result is not what the procedure expects.',
    summary_ar: 'يتّبع الإجراءات كما هي مكتوبة، ويتتبّع موضعه فيها، ويتوقف عندما يتعذّر تنفيذ خطوة كما كُتبت أو عندما تختلف النتيجة عمّا يتوقعه الإجراء.',
    plant_en: 'Stops at a step whose expected pump response does not occur, places the system in a safe condition and calls the supervisor.',
    plant_ar: 'يتوقف عند خطوة لا تحدث فيها استجابة المضخة المتوقعة، ويضع النظام في حالة آمنة ويتصل بالمشرف.',
    descriptors: D('Uses the procedure in hand, marks each step and knows the stop criteria.', 'يستخدم الإجراء بين يديه ويؤشّر كل خطوة ويعرف معايير التوقف.',
      'Recognises when a procedure no longer fits the situation and stops with the plant safe.', 'يدرك متى لم يعد الإجراء مناسباً للموقف ويتوقف مع إبقاء المحطة آمنة.',
      'Coaches others in procedure use and feeds procedure problems back so they are fixed.', 'يدرّب الآخرين على استخدام الإجراءات ويرفع مشكلاتها كي تُعالَج.'),
    mappings: [INPO(10, 'Work processes', 'إجراءات العمل'), IAEA('error prevention', 'منع الأخطاء'), WEF('dependability and attention to detail', 'الاعتمادية والاهتمام بالتفاصيل'), SSG.thinking_critically],
    trait_ids: ['trait-10'], skill_ids: ['sk-co-01', 'sk-hu-01-star'],
    development: [R('course', 'c-hu', 'Human performance core tools', 'الأدوات الأساسية للأداء البشري'), R('ojt', 'place-keeping', 'Supervised place-keeping on real procedures', 'تتبّع الموضع تحت الإشراف في إجراءات حقيقية'), PRACTICE('cs-procedure')],
    assessment: [R('observation', 'procedure-use', 'Field observation of procedure use against the stop criteria', 'ملاحظة ميدانية لاستخدام الإجراءات مقابل معايير التوقف'), SJT('cs-procedure')],
    dev_approach_en: 'HU tools training and supervised place-keeping on real procedures.',
    dev_approach_ar: 'تدريب على أدوات الأداء البشري وتتبّع الموضع تحت الإشراف في إجراءات حقيقية.',
    assess_approach_en: 'Field observation of procedure use against the stop criteria.',
    assess_approach_ar: 'ملاحظة ميدانية لاستخدام الإجراءات مقابل معايير التوقف.',
    sources: [S.ssg, S.iaea, S.wef],
  },
  {
    id: 'cs-systems', code: 'TC-4', cluster: 'thinking_critically', name_en: 'Systems thinking', name_ar: 'التفكير المنظومي',
    summary_en: 'Sees how a change in one system, task or team affects others, including through the plant\'s defence in depth.',
    summary_ar: 'يرى كيف يؤثر تغيير في نظام أو مهمة أو فريق على غيره، بما في ذلك عبر مستويات الدفاع في العمق في المحطة.',
    plant_en: 'Before an isolation, checks which other systems share the power supply and who else is working on them.',
    plant_ar: 'قبل العزل، يتحقق من الأنظمة الأخرى التي تتشارك مصدر الطاقة نفسه ومن يعمل عليها.',
    descriptors: D('Knows the main interfaces of their own system and asks about effects outside it.', 'يعرف الواجهات الرئيسية لنظامه ويسأل عن الآثار خارجه.',
      'Traces knock-on effects across systems and teams before acting, and records them.', 'يتتبّع الآثار المتسلسلة عبر الأنظمة والفرق قبل التصرف ويوثّقها.',
      'Leads cross-discipline reviews that expose hidden couplings.', 'يقود مراجعات متعددة التخصصات تكشف الترابطات الخفية.'),
    mappings: [WEF('systems thinking', 'التفكير المنظومي'), GREEN, DELTA('cognitive skills', 'المهارات المعرفية'), SSG.thinking_critically],
    trait_ids: [], skill_ids: ['sk-fs-tr-systems', 'sk-ns-01'],
    development: [R('page', '/communities', 'A system-engineering community of practice', 'مجتمع ممارسة لهندسة الأنظمة'), R('page', '/opportunities/rotations', 'A rotation through another discipline', 'تناوب في تخصص آخر'), PRACTICE('cs-systems')],
    assessment: [CHECKIN, SJT('cs-systems')],
    dev_approach_en: 'Cross-system walkdowns, a community of practice and a rotation through another discipline.',
    dev_approach_ar: 'جولات ميدانية عبر الأنظمة، ومجتمع ممارسة، وتناوب في تخصص آخر.',
    assess_approach_en: 'Check-in ratings on interfaces traced in real work.',
    assess_approach_ar: 'تقييمات دورية لتتبّع الواجهات في العمل الفعلي.',
    sources: [S.ssg, S.wef, S.jrc, S.delta],
  },
  {
    id: 'cs-problem', code: 'TC-5', cluster: 'thinking_critically', name_en: 'Problem identification and resolution', name_ar: 'تحديد المشكلات وحلها',
    summary_en: 'Spots problems early, reports them in the corrective action programme, looks for causes rather than symptoms and checks the fix worked.',
    summary_ar: 'يكتشف المشكلات مبكراً ويبلغ عنها في برنامج الإجراءات التصحيحية، ويبحث عن الأسباب لا الأعراض، ويتحقق من نجاح الإصلاح.',
    plant_en: 'Raises a condition report for a recurring alarm and joins the cause evaluation instead of resetting it each shift.',
    plant_ar: 'يرفع تقرير حالة عن إنذار متكرر وينضم إلى تقييم السبب بدلاً من إعادة ضبطه في كل وردية.',
    descriptors: D('Reports problems promptly and clearly, with the facts.', 'يبلغ عن المشكلات فوراً وبوضوح مع الوقائع.',
      'Uses structured cause analysis and checks whether actions worked.', 'يستخدم تحليلاً منظماً للأسباب ويتحقق من فعالية الإجراءات.',
      'Leads cause evaluations and spots trends across reports.', 'يقود تقييمات الأسباب ويرصد الاتجاهات عبر التقارير.'),
    mappings: [INPO(8, 'Problem identification and resolution', 'تحديد المشكلات وحلها'), WEF('analytical thinking', 'التفكير التحليلي'), DELTA('cognitive skills', 'المهارات المعرفية'), SSG.thinking_critically],
    trait_ids: ['trait-8'], skill_ids: ['sk-fs-tr-analytical', 'sk-da-01-analysis'],
    development: [R('page', '/oe', 'Operating experience and cause evaluations', 'الخبرة التشغيلية وتقييمات الأسباب'), R('ojt', 'cause-evaluation', 'Join a cause evaluation with a qualified lead', 'المشاركة في تقييم للأسباب بقيادة مؤهلة'), PRACTICE('cs-problem')],
    assessment: [CHECKIN, R('observation', 'cause-review', 'Review of condition reports and cause work', 'مراجعة تقارير الحالة وأعمال تحليل الأسباب'), SJT('cs-problem')],
    dev_approach_en: 'Taking part in a cause evaluation with a qualified lead.',
    dev_approach_ar: 'المشاركة في تقييم للأسباب بقيادة مؤهلة.',
    assess_approach_en: 'Review of the person\'s condition reports and cause work in check-ins.',
    assess_approach_ar: 'مراجعة تقارير الحالة وأعمال تحليل الأسباب التي أعدّها في التقييمات الدورية.',
    sources: [S.ssg, S.wef, S.delta],
  },
  {
    id: 'cs-creative', code: 'TC-6', cluster: 'thinking_critically', name_en: 'Creative thinking and improvement', name_ar: 'التفكير الإبداعي والتحسين',
    summary_en: 'Proposes better ways of working and tests them through the proper change process, never by improvising on plant.',
    summary_ar: 'يقترح طرق عمل أفضل ويختبرها عبر عملية التغيير المعتمدة، ولا يرتجل أبداً في المحطة.',
    plant_en: 'Suggests a clearer outage turnover sheet, pilots it with one crew and submits it through document control.',
    plant_ar: 'يقترح نموذجاً أوضح لتسليم العمل أثناء الانقطاع، ويجرّبه مع طاقم واحد، ويقدّمه عبر ضبط الوثائق.',
    descriptors: D('Shares improvement ideas through the suggestion channel.', 'يشارك أفكار التحسين عبر قناة المقترحات.',
      'Develops an idea with evidence and takes it through the change process.', 'يطوّر فكرة بالأدلة ويمضي بها عبر عملية التغيير.',
      'Runs small, safe pilots and helps others turn ideas into approved changes.', 'يدير تجارب صغيرة آمنة ويساعد الآخرين على تحويل الأفكار إلى تغييرات معتمدة.'),
    mappings: [WEF('creative thinking', 'التفكير الإبداعي'), ENTRE, SSG.thinking_critically],
    trait_ids: [], skill_ids: ['sk-fs-tr-creative'],
    development: [R('page', '/opportunities', 'An improvement project through the opportunity marketplace', 'مشروع تحسين عبر سوق الفرص'), PRACTICE('cs-creative')],
    assessment: [R('observation', 'improvement-review', 'Review of an improvement proposal and its outcome', 'مراجعة مقترح تحسين ونتيجته'), SJT('cs-creative')],
    dev_approach_en: 'An improvement project through the opportunity marketplace, with a mentor.',
    dev_approach_ar: 'مشروع تحسين عبر سوق الفرص بإرشاد موجّه.',
    assess_approach_en: 'Review of the improvement proposal and its outcome.',
    assess_approach_ar: 'مراجعة مقترح التحسين ونتيجته.',
    sources: [S.ssg, S.wef, S.jrc],
  },
  // ── Interacting with others
  {
    id: 'cs-peer-check', code: 'IO-1', cluster: 'interacting_with_others', name_en: 'Peer checking and team error prevention', name_ar: 'التحقق المتبادل ومنع أخطاء الفريق',
    summary_en: 'Checks a colleague\'s critical step before it happens, independently, and accepts the same check without taking it personally.',
    summary_ar: 'يتحقق من الخطوة الحرجة لزميله قبل تنفيذها وبشكل مستقل، ويتقبّل التحقق نفسه دون أن يأخذه على محمل شخصي.',
    plant_en: 'Before a breaker is racked out, the second technician confirms the component ID and the expected result aloud from their own copy.',
    plant_ar: 'قبل سحب القاطع، يؤكد الفني الثاني رقم المكوّن والنتيجة المتوقعة بصوت مسموع من نسخته الخاصة.',
    descriptors: D('Asks for and gives peer checks on critical steps.', 'يطلب التحقق من الزملاء ويقدّمه في الخطوات الحرجة.',
      'Peer-checks independently: own eyes, own reference, never the colleague\'s assumption.', 'يتحقق بشكل مستقل: بعينيه ومرجعه الخاص، لا بافتراض زميله.',
      'Makes peer checking normal across crews and coaches it after events.', 'يجعل التحقق المتبادل ممارسة طبيعية بين الأطقم ويدرّب عليه بعد الأحداث.'),
    mappings: [IAEA('error prevention', 'منع الأخطاء'), DELTA('interpersonal · teamwork effectiveness', 'المهارات الشخصية · فعالية العمل الجماعي'), SSG.interacting_with_others],
    trait_ids: [], skill_ids: ['sk-hu-01', 'sk-hu-02-brief'],
    development: [R('course', 'c-hu-ref', 'HU tools refresher', 'تنشيط أدوات الأداء البشري'), R('ojt', 'peer-pairing', 'Paired peer-check practice on shift', 'تمرين ثنائي على التحقق المتبادل أثناء الوردية'), PRACTICE('cs-peer-check')],
    assessment: [CHECKIN, R('observation', 'peer-check', 'Observed peer checks in the field', 'تحقق متبادل ملاحظ في الميدان'), SJT('cs-peer-check')],
    dev_approach_en: 'Paired practice of peer checks on real critical steps, with feedback.',
    dev_approach_ar: 'تمرين ثنائي على التحقق المتبادل في خطوات حرجة حقيقية مع تغذية راجعة.',
    assess_approach_en: 'Observation of peer checks in the field by a qualified observer.',
    assess_approach_ar: 'ملاحظة التحقق المتبادل في الميدان من قِبل ملاحظ مؤهل.',
    sources: [S.ssg, S.iaea, S.delta],
  },
  {
    id: 'cs-comm-stress', code: 'IO-2', cluster: 'interacting_with_others', name_en: 'Communication under stress', name_ar: 'التواصل تحت الضغط',
    summary_en: 'Keeps communication clear, closed-loop and calm when time is short and the situation is changing.',
    summary_ar: 'يحافظ على تواصل واضح ومغلق الحلقة وهادئ عندما يضيق الوقت ويتغيّر الموقف.',
    plant_en: 'During an unplanned transient, repeats back each order, uses the phonetic alphabet and confirms completion.',
    plant_ar: 'أثناء حالة عابرة غير مخطط لها، يكرّر كل أمر ويستخدم الأبجدية الصوتية ويؤكد الإنجاز.',
    descriptors: D('Uses three-way communication and the phonetic alphabet.', 'يستخدم التواصل ثلاثي الاتجاه والأبجدية الصوتية.',
      'Keeps messages short, specific and confirmed when pressure rises.', 'يبقي الرسائل قصيرة ومحددة ومؤكدة عند تصاعد الضغط.',
      'Sets the communication rhythm for a team in an event and corrects drift.', 'يضبط إيقاع التواصل للفريق أثناء الحدث ويصحّح الانحراف.'),
    mappings: [INPO(3, 'Effective safety communication', 'التواصل الفعّال بشأن السلامة'), DELTA('interpersonal · communication', 'المهارات الشخصية · التواصل'), IAEA('teamwork and communication', 'العمل الجماعي والتواصل'), SSG.interacting_with_others],
    trait_ids: ['trait-3'], skill_ids: ['sk-co-02', 'sk-hu-02'],
    development: [R('page', '/my/simulator', 'Crew simulator scenarios with communication coaching', 'سيناريوهات المحاكي للأطقم مع تدريب على التواصل'), R('ojt', 'drill-communicator', 'Take the communicator role in emergency drills', 'تولي دور المتواصل في تمارين الطوارئ'), PRACTICE('cs-comm-stress')],
    assessment: [R('simulator', '/my/simulator', 'Communication scoring in the simulator debrief', 'تقييم التواصل في مراجعة ما بعد المحاكي'), R('observation', 'drill-debrief', 'Drill debrief on communication', 'مراجعة التمرين بشأن التواصل'), SJT('cs-comm-stress')],
    dev_approach_en: 'Crew simulator scenarios and drills with communication coaching.',
    dev_approach_ar: 'سيناريوهات المحاكي للأطقم والتمارين مع تدريب على التواصل.',
    assess_approach_en: 'Communication scoring in simulator and drill debriefs.',
    assess_approach_ar: 'تقييم التواصل في مراجعات المحاكي والتمارين.',
    sources: [S.ssg, S.iaea, S.delta],
  },
  {
    id: 'cs-speak-up', code: 'IO-3', cluster: 'interacting_with_others', name_en: 'Raising concerns and speaking up', name_ar: 'طرح المخاوف والتحدث بصراحة',
    summary_en: 'Raises safety and quality concerns promptly through the right channel, and listens well when others raise them.',
    summary_ar: 'يطرح مخاوف السلامة والجودة فوراً عبر القناة الصحيحة، ويصغي جيداً عندما يطرحها الآخرون.',
    plant_en: 'Tells the supervisor that a contractor team skipped a pre-job brief, and uses the corrective action programme if it recurs. Kafa\'a never takes concerns; the Employee Concerns Program does.',
    plant_ar: 'يبلغ المشرف بأن فريق مقاول تجاوز إحاطة ما قبل العمل، ويستخدم برنامج الإجراءات التصحيحية إن تكرر ذلك. لا تتلقى كفاءة أي مخاوف؛ فذلك دور برنامج مخاوف الموظفين.',
    descriptors: D('Knows the channels, including the Employee Concerns Program, and uses them.', 'يعرف القنوات، ومنها برنامج مخاوف الموظفين، ويستخدمها.',
      'Raises concerns clearly and early, with facts, and follows up.', 'يطرح المخاوف بوضوح ومبكراً مع الوقائع ويتابعها.',
      'Responds to concerns in a way that makes others more willing to speak.', 'يستجيب للمخاوف بطريقة تشجّع الآخرين على التحدث.'),
    mappings: [INPO(9, 'Environment for raising concerns', 'بيئة طرح المخاوف'), IAEA('safety culture behaviours', 'سلوكيات ثقافة السلامة'), SSG.interacting_with_others],
    trait_ids: ['trait-9'], skill_ids: ['sk-sc-01', 'sk-sc-02'],
    development: [R('course', 'c-scwe', 'Safety-conscious work environment', 'بيئة العمل الواعية بالسلامة'), R('page', '/my/safety-culture', 'Team discussions of the safety-culture traits', 'نقاشات الفريق حول سمات ثقافة السلامة'), PRACTICE('cs-speak-up')],
    assessment: [CHECKIN, SJT('cs-speak-up')],
    dev_approach_en: 'Safety-conscious work environment training and team discussions of the safety-culture traits.',
    dev_approach_ar: 'تدريب على بيئة العمل الواعية بالسلامة ونقاشات الفريق حول سمات ثقافة السلامة.',
    assess_approach_en: 'A check-in discussion of how the person raises and responds to concerns; concern content is never recorded here.',
    assess_approach_ar: 'نقاش في التقييم الدوري حول كيفية طرح المخاوف والاستجابة لها؛ ولا يُسجَّل مضمون أي مخاوف هنا أبداً.',
    sources: [S.ssg, S.iaea],
  },
  {
    id: 'cs-cross-cultural', code: 'IO-4', cluster: 'interacting_with_others', name_en: 'Working across cultures', name_ar: 'العمل عبر الثقافات',
    summary_en: 'Works effectively with colleagues and partners of many nationalities and organisations, checking understanding rather than assuming it.',
    summary_ar: 'يعمل بفعالية مع زملاء وشركاء من جنسيات ومؤسسات متعددة، ويتحقق من الفهم بدلاً من افتراضه.',
    plant_en: 'In a handover with a partner-company engineer, confirms technical terms in both languages and writes down the agreed actions.',
    plant_ar: 'في تسليم مع مهندس من شركة شريكة، يؤكد المصطلحات الفنية باللغتين ويدوّن الإجراءات المتفق عليها.',
    descriptors: D('Respects different working styles and checks shared understanding.', 'يحترم أساليب العمل المختلفة ويتحقق من الفهم المشترك.',
      'Adapts how they communicate and decide to the team in front of them.', 'يكيّف أسلوب تواصله واتخاذ قراراته مع الفريق الذي أمامه.',
      'Builds mixed teams where knowledge transfers both ways.', 'يبني فرقاً مختلطة تنتقل فيها المعرفة في الاتجاهين.'),
    mappings: [INPO(6, 'Respectful work environment', 'بيئة عمل قائمة على الاحترام'), LIFE('empathy', 'التعاطف'), WEF('empathy and active listening', 'التعاطف والإصغاء الفعّال'), SSG.interacting_with_others],
    trait_ids: ['trait-6'], skill_ids: ['sk-fs-tr-crosscultural', 'sk-fs-tr-empathy'],
    development: [R('page', '/my/mentoring', 'Cross-organisation mentoring', 'الإرشاد بين المؤسسات'), R('ojt', 'knowledge-transfer', 'Structured knowledge-transfer handovers with partner engineers', 'عمليات تسليم منظّمة لنقل المعرفة مع مهندسي الشركاء'), PRACTICE('cs-cross-cultural')],
    assessment: [CHECKIN, SJT('cs-cross-cultural'), R('observation', 'mixed-team-feedback', 'Feedback from mixed-team colleagues', 'تغذية راجعة من زملاء الفرق المختلطة')],
    dev_approach_en: 'Cross-organisation mentoring and structured knowledge-transfer handovers.',
    dev_approach_ar: 'إرشاد بين المؤسسات وعمليات تسليم منظّمة لنقل المعرفة.',
    assess_approach_en: 'Feedback from mixed-team colleagues in check-ins.',
    assess_approach_ar: 'تغذية راجعة من زملاء الفرق المختلطة في التقييمات الدورية.',
    sources: [S.ssg, S.wef, S.jrc],
  },
  {
    id: 'cs-developing', code: 'IO-5', cluster: 'interacting_with_others', name_en: 'Developing others', name_ar: 'تطوير الآخرين',
    summary_en: 'Helps colleagues grow through coaching, feedback and sharing what they know, so knowledge does not sit with one person.',
    summary_ar: 'يساعد زملاءه على النمو عبر التوجيه والتغذية الراجعة ومشاركة ما يعرفه، كي لا تبقى المعرفة لدى شخص واحد.',
    plant_en: 'Talks a new operator through a system walkdown and asks them to explain it back.',
    plant_ar: 'يرافق مشغّلاً جديداً في جولة على نظام ما ويطلب منه أن يشرحه بدوره.',
    descriptors: D('Shares know-how willingly when asked.', 'يشارك خبرته عن طيب خاطر عندما يُطلب منه.',
      'Gives specific, timely feedback and coaches on the job.', 'يقدّم تغذية راجعة محددة وفي وقتها ويوجّه أثناء العمل.',
      'Builds a pipeline of successors and teaches others to coach.', 'يبني صفاً من الخلفاء ويعلّم الآخرين التوجيه.'),
    mappings: [INPO(4, 'Leadership safety values and actions', 'قيم القيادة وأفعالها في السلامة'), WEF('leadership and social influence', 'القيادة والتأثير الاجتماعي'), DELTA('interpersonal skills', 'المهارات الشخصية'), SSG.interacting_with_others],
    trait_ids: ['trait-4'], skill_ids: ['sk-ld-01', 'sk-ld-01-coach', 'sk-fs-tr-leadership'],
    development: [R('course', 'c-intilaqa', 'INTILAQA: Leading Effective Teams', 'انطلاقة: قيادة الفرق الفعّالة'), R('page', '/leadership', 'Leadership programmes and mentoring others', 'برامج القيادة وإرشاد الآخرين'), PRACTICE('cs-developing')],
    assessment: [R('360', '/leadership/360', 'Leadership 360 feedback', 'تقييم القيادة 360 درجة'), CHECKIN, SJT('cs-developing')],
    dev_approach_en: 'Leading Effective Teams and serving as a mentor.',
    dev_approach_ar: 'برنامج قيادة الفرق الفعّالة والعمل موجّهاً.',
    assess_approach_en: 'Leadership 360 feedback and mentee check-ins.',
    assess_approach_ar: 'تقييم القيادة 360 درجة وتقييمات المتعلّمين الدورية.',
    sources: [S.ssg, S.wef, S.delta],
  },
  // ── Staying relevant
  {
    id: 'cs-learning-agility', code: 'SR-1', cluster: 'staying_relevant', name_en: 'Learning agility', name_ar: 'سرعة التعلّم',
    summary_en: 'Learns new systems, tools and roles quickly, seeks feedback and applies lessons from operating experience.',
    summary_ar: 'يتعلّم الأنظمة والأدوات والأدوار الجديدة بسرعة، ويطلب التغذية الراجعة، ويطبّق دروس الخبرة التشغيلية.',
    plant_en: 'Takes up a new digital rounds tool, finds its limits in the first week and shares tips with the crew.',
    plant_ar: 'يتبنّى أداة رقمية جديدة للجولات، ويكتشف حدودها في الأسبوع الأول، ويشارك النصائح مع الطاقم.',
    descriptors: D('Completes required learning on time and asks for feedback.', 'ينجز التعلّم المطلوب في موعده ويطلب التغذية الراجعة.',
      'Plans their own learning against future role needs and applies it at work.', 'يخطّط لتعلّمه وفق احتياجات الدور المستقبلية ويطبّقه في العمل.',
      'Helps the team adopt new ways of working and learn from experience.', 'يساعد الفريق على تبنّي طرق عمل جديدة والتعلّم من التجربة.'),
    outcome_en: 'Career health is treated as an outcome of this skill, not a separate competency (SkillsFuture 2025 review).',
    outcome_ar: 'تُعامَل الصحة المهنية بوصفها نتيجة لهذه المهارة لا كفاءة مستقلة (مراجعة SkillsFuture لعام 2025).',
    mappings: [M('ssg_ccs', 'SSG-SF', 'SR', 'SkillsFuture Critical Core Skills · Learning Agility', 'المهارات الأساسية الحرجة في SkillsFuture · سرعة التعلّم'), WEF('curiosity and lifelong learning', 'الفضول والتعلّم مدى الحياة'), LIFE('growth mindset and managing learning', 'عقلية النمو وإدارة التعلّم'), INPO(7, 'Continuous learning', 'التعلّم المستمر')],
    trait_ids: ['trait-7'], skill_ids: ['sk-fs-tr-curiosity'],
    development: [R('page', '/my/plan', 'A development plan tied to future role needs', 'خطة تطوير مرتبطة باحتياجات الدور المستقبلية'), R('page', '/my/coach', 'Coach nudges for the next learning step', 'تنبيهات المدرب لخطوة التعلّم التالية'), PRACTICE('cs-learning-agility')],
    assessment: [CHECKIN, SJT('cs-learning-agility')],
    dev_approach_en: 'A personal development plan tied to future role needs, with coach nudges.',
    dev_approach_ar: 'خطة تطوير شخصية مرتبطة باحتياجات الدور المستقبلية مع تنبيهات من المدرب.',
    assess_approach_en: 'A check-in on learning applied at work.',
    assess_approach_ar: 'تقييم دوري لما طُبّق من التعلّم في العمل.',
    sources: [S.ssg, S.ssgReview, S.wef, S.jrc],
  },
  {
    id: 'cs-resilience', code: 'SR-2', cluster: 'staying_relevant', name_en: 'Resilience and self-management', name_ar: 'المرونة وإدارة الذات',
    summary_en: 'Manages their own energy, attention and reactions through long outages, shift work and setbacks, and keeps procedure discipline under pressure.',
    summary_ar: 'يدير طاقته وانتباهه وردود أفعاله خلال فترات الانقطاع الطويلة والعمل بنظام الورديات والانتكاسات، ويلتزم بالإجراءات تحت الضغط.',
    plant_en: 'Recognises fatigue near the end of a night shift and uses the fatigue rules to hand over a critical task.',
    plant_ar: 'يدرك الإرهاق قرب نهاية وردية ليلية ويطبّق قواعد إدارة الإرهاق لتسليم مهمة حرجة.',
    descriptors: D('Knows the signs of fatigue and stress and the fitness-for-duty rules.', 'يعرف علامات الإرهاق والضغط وقواعد الأهلية للعمل.',
      'Plans workload and recovery and speaks up early when not fit for a task.', 'يخطّط لعبء العمل والتعافي ويبادر بالإفصاح عندما لا يكون مؤهلاً لمهمة.',
      'Builds team routines that protect alertness through outages.', 'يبني لدى الفريق روتيناً يحافظ على اليقظة خلال فترات الانقطاع.'),
    outcome_en: 'Wellbeing is an outcome of this skill and is never a separate competency or score (SkillsFuture 2025 review). Kafa\'a records behaviours, never health information.',
    outcome_ar: 'العافية نتيجة لهذه المهارة ولا تكون أبداً كفاءة أو درجة مستقلة (مراجعة SkillsFuture لعام 2025). تسجّل كفاءة السلوكيات ولا تسجّل أي معلومات صحية.',
    mappings: [M('ssg_ccs', 'SSG-SF', 'SR', 'SkillsFuture Critical Core Skills · Self-Management', 'المهارات الأساسية الحرجة في SkillsFuture · إدارة الذات'), WEF('resilience, flexibility and agility', 'المرونة والقدرة على التكيّف وسرعة الاستجابة'), LIFE('self-regulation', 'التنظيم الذاتي'), DELTA('self-leadership', 'القيادة الذاتية')],
    trait_ids: [], skill_ids: ['sk-fs-tr-resilience'],
    development: [R('course', 'c-hu-ref', 'HU tools refresher (fatigue and error traps)', 'تنشيط أدوات الأداء البشري (الإرهاق وفخاخ الأخطاء)'), R('ojt', 'fatigue-briefing', 'Fatigue-management briefing before outages', 'إحاطة إدارة الإرهاق قبل فترات الانقطاع'), PRACTICE('cs-resilience')],
    assessment: [CHECKIN, SJT('cs-resilience')],
    dev_approach_en: 'Fatigue-management and stress-awareness sessions before outages, with team routines.',
    dev_approach_ar: 'جلسات لإدارة الإرهاق والوعي بالضغط قبل فترات الانقطاع، مع روتين للفريق.',
    assess_approach_en: 'A self and manager check-in on behaviours, never on health data.',
    assess_approach_ar: 'تقييم دوري ذاتي ومن المدير يتناول السلوكيات، ولا يتناول البيانات الصحية أبداً.',
    sources: [S.ssg, S.ssgReview, S.wef, S.jrc, S.delta],
  },
  {
    id: 'cs-adaptability', code: 'SR-3', cluster: 'staying_relevant', name_en: 'Adaptability when plans change', name_ar: 'التكيّف عند تغيّر الخطط',
    summary_en: 'Adjusts quickly and safely when a schedule, scope or condition changes, re-planning rather than forcing the old plan.',
    summary_ar: 'يتكيّف بسرعة وأمان عند تغيّر الجدول أو النطاق أو الظروف، ويعيد التخطيط بدلاً من فرض الخطة القديمة.',
    plant_en: 'When a spare part arrives late during an outage, re-sequences the work package with work control and re-briefs the crew.',
    plant_ar: 'عندما تتأخر قطعة غيار أثناء الانقطاع، يعيد ترتيب حزمة العمل مع التحكم في العمل ويعيد إحاطة الطاقم.',
    descriptors: D('Accepts changes to plans and asks what they mean for their task.', 'يتقبّل تغيّر الخطط ويسأل عن أثرها على مهمته.',
      'Re-plans their work when conditions change and re-briefs the risks.', 'يعيد تخطيط عمله عند تغيّر الظروف ويعيد الإحاطة بالمخاطر.',
      'Leads a team through a changing plan without losing control of risk.', 'يقود الفريق عبر خطة متغيّرة دون أن يفقد السيطرة على المخاطر.'),
    mappings: [DELTA('adaptability and mental flexibility', 'القدرة على التكيّف والمرونة الذهنية'), WEF('resilience, flexibility and agility', 'المرونة والقدرة على التكيّف وسرعة الاستجابة'), SSG.staying_relevant],
    trait_ids: [], skill_ids: ['sk-fs-tr-resilience', 'sk-mp-01'],
    development: [R('ojt', 'outage-replanning', 'Outage re-planning practice alongside work control', 'التمرّن على إعادة التخطيط أثناء الانقطاع إلى جانب التحكم في العمل'), R('page', '/opportunities', 'A short rotation into outage planning', 'تناوب قصير في تخطيط الانقطاع'), PRACTICE('cs-adaptability')],
    assessment: [R('observation', 'replan-brief', 'Observed re-brief after a plan change', 'إعادة إحاطة ملاحظة بعد تغيّر الخطة'), CHECKIN, SJT('cs-adaptability')],
    dev_approach_en: 'Outage re-planning practice alongside work control, and a short rotation into outage planning.',
    dev_approach_ar: 'التمرّن على إعادة التخطيط أثناء الانقطاع إلى جانب التحكم في العمل، وتناوب قصير في تخطيط الانقطاع.',
    assess_approach_en: 'Observation of a re-brief after a plan change.',
    assess_approach_ar: 'ملاحظة إعادة الإحاطة بعد تغيّر الخطة.',
    sources: [S.ssg, S.wef, S.delta],
  },
  {
    id: 'cs-digital-judgement', code: 'SR-4', cluster: 'staying_relevant', name_en: 'Digital and AI judgement', name_ar: 'الحكم الرقمي وفي الذكاء الاصطناعي',
    summary_en: 'Uses approved digital and AI tools well and knows when to trust, check or override what they produce.',
    summary_ar: 'يستخدم الأدوات الرقمية وأدوات الذكاء الاصطناعي المعتمدة بكفاءة، ويعرف متى يثق بمخرجاتها ومتى يتحقق منها أو يتجاوزها.',
    plant_en: 'Checks an AI-drafted procedure summary against the controlled document before using it in a brief.',
    plant_ar: 'يتحقق من ملخص إجراء صاغه الذكاء الاصطناعي مقابل الوثيقة المضبوطة قبل استخدامه في الإحاطة.',
    descriptors: D('Uses approved tools only and knows they can be wrong.', 'يستخدم الأدوات المعتمدة فقط ويعرف أنها قد تخطئ.',
      'Verifies outputs that will be relied on against controlled sources.', 'يتحقق من المخرجات التي سيُعتمد عليها مقابل مصادر مضبوطة.',
      'Designs team checks for AI-assisted work and challenges tool outputs openly.', 'يصمم ضوابط للفريق للعمل بمساعدة الذكاء الاصطناعي ويطعن في مخرجات الأدوات علناً.'),
    mappings: [WEF('technological literacy; AI and big data', 'الإلمام التقني؛ الذكاء الاصطناعي والبيانات الضخمة'), DELTA('digital skills', 'المهارات الرقمية'), SSG.staying_relevant],
    trait_ids: [], skill_ids: ['sk-fs-ai-verify', 'sk-fs-tr-techlit', 'sk-fs-ai-use'],
    development: [R('page', '/learn/ai-fluency', 'The AI fluency ladder', 'سلّم الطلاقة في الذكاء الاصطناعي'), R('course', 'c-ai-gov', 'Governed use of AI at work', 'الاستخدام المحوكم للذكاء الاصطناعي في العمل'), PRACTICE('cs-digital-judgement')],
    assessment: [R('fitness', '/my/ai-fluency/check', 'The quarterly AI and digital fitness check', 'فحص اللياقة الرقمية وفي الذكاء الاصطناعي ربع السنوي'), SJT('cs-digital-judgement')],
    dev_approach_en: 'The AI fluency ladder and the governed AI-use course.',
    dev_approach_ar: 'سلّم الطلاقة في الذكاء الاصطناعي ودورة الاستخدام المحوكم للذكاء الاصطناعي.',
    assess_approach_en: 'The quarterly AI and digital fitness check.',
    assess_approach_ar: 'فحص اللياقة الرقمية وفي الذكاء الاصطناعي ربع السنوي.',
    sources: [S.ssg, S.wef, S.delta],
  },
  {
    id: 'cs-accountability', code: 'SR-5', cluster: 'staying_relevant', name_en: 'Personal accountability', name_ar: 'المساءلة الشخصية',
    summary_en: 'Owns their work and its safety consequences, keeps commitments and admits mistakes quickly so others can learn.',
    summary_ar: 'يتحمّل مسؤولية عمله وعواقبه على السلامة، ويفي بالتزاماته، ويعترف بأخطائه سريعاً كي يتعلّم الآخرون.',
    plant_en: 'Reports their own mis-positioned valve straight away, even though nobody else noticed.',
    plant_ar: 'يبلغ فوراً عن صمام وضعه بنفسه في موضع خاطئ، رغم أن أحداً لم يلاحظ ذلك.',
    descriptors: D('Meets commitments and reports their own errors.', 'يفي بالتزاماته ويبلغ عن أخطائه.',
      'Takes ownership of outcomes beyond the task, including follow-up.', 'يتحمّل مسؤولية النتائج بما يتجاوز المهمة، بما في ذلك المتابعة.',
      'Models accountability without blame, so the team reports freely.', 'يجسّد المساءلة دون لوم، فيبلغ الفريق بحرّية.'),
    mappings: [INPO(1, 'Personal accountability', 'المساءلة الشخصية'), WEF('motivation and self-awareness', 'الدافعية والوعي الذاتي'), DELTA('self-leadership', 'القيادة الذاتية'), SSG.staying_relevant],
    trait_ids: ['trait-1'], skill_ids: ['sk-fs-tr-dependable', 'sk-fs-tr-selfaware'],
    development: [R('page', '/my/safety-culture', 'Team discussions of the personal accountability trait', 'نقاشات الفريق حول سمة المساءلة الشخصية'), R('ojt', 'post-job-review', 'Lead post-job reviews', 'قيادة مراجعات ما بعد العمل'), PRACTICE('cs-accountability')],
    assessment: [CHECKIN, R('observation', 'post-job-review', 'Observed post-job review', 'مراجعة ما بعد العمل الملاحظة'), SJT('cs-accountability')],
    dev_approach_en: 'Leading post-job reviews and team discussions of the personal accountability trait.',
    dev_approach_ar: 'قيادة مراجعات ما بعد العمل ونقاشات الفريق حول سمة المساءلة الشخصية.',
    assess_approach_en: 'Check-in evidence of owned follow-ups and self-reported errors.',
    assess_approach_ar: 'أدلة في التقييم الدوري على متابعات تحمّل مسؤوليتها وأخطاء أبلغ عنها بنفسه.',
    sources: [S.ssg, S.wef, S.delta],
  },
];

// ───────────── Candidates the inclusion rule did not add
const C = (id, name_en, name_ar, decision, merged_into, has_development, has_assessment, reason_en, reason_ar, benchmark_ids, sources) =>
  ({ id, name_en, name_ar, decision, merged_into, has_development, has_assessment, reason_en, reason_ar, benchmark_ids, sources });
export const CANDIDATES = [
  C('cand-wellbeing', 'Mental wellbeing', 'العافية النفسية', 'outcome', 'cs-resilience', false, false,
    'Treated as an outcome of Resilience and self-management, never as a competency: SkillsFuture\'s 2025 review found wellbeing is best embedded as an outcome within existing skills.',
    'تُعامَل بوصفها نتيجة لمهارة المرونة وإدارة الذات وليست كفاءة: وجدت مراجعة SkillsFuture لعام 2025 أن العافية تُدمج على أفضل وجه بوصفها نتيجة ضمن المهارات القائمة.', ['SSG-SF'], [S.ssg, S.ssgReview]),
  C('cand-career-health', 'Career health', 'الصحة المهنية', 'outcome', 'cs-learning-agility', false, false,
    'Treated as an outcome of Learning agility, following the same SkillsFuture 2025 finding.', 'تُعامَل بوصفها نتيجة لسرعة التعلّم، وفق نتيجة SkillsFuture نفسها لعام 2025.', ['SSG-SF'], [S.ssg, S.ssgReview]),
  C('cand-attention', 'Attention to detail', 'الاهتمام بالتفاصيل', 'merged', 'cs-procedure', true, false,
    'No assessment approach distinct from procedure use and place-keeping, so it fails the inclusion rule and is part of that skill.', 'لا يوجد له أسلوب تقييم مستقل عن استخدام الإجراءات وتتبّع الموضع، لذا لا يجتاز قاعدة الإدراج وهو جزء من تلك المهارة.', ['MCK-DELTA', 'WEF-FOJ'], [S.delta, S.wef]),
  C('cand-teamwork', 'Teamwork', 'العمل الجماعي', 'merged', 'cs-peer-check', true, true,
    'Its development and assessment at the plant are the peer-check routes, so it is not a separate core skill.', 'أساليب تطويره وتقييمه في المحطة هي نفسها مسارات التحقق المتبادل، لذا ليس مهارة أساسية مستقلة.', ['MCK-DELTA'], [S.delta]),
  C('cand-eq', 'Emotional intelligence', 'الذكاء العاطفي', 'merged', 'cs-cross-cultural', false, false,
    'Broad and hard to assess on its own; its observable parts sit in Working across cultures and Communication under stress.', 'واسع ويصعب تقييمه منفرداً؛ وتقع جوانبه القابلة للملاحظة ضمن العمل عبر الثقافات والتواصل تحت الضغط.', ['MCK-DELTA', 'GREENCOMP'], [S.delta, S.jrc]),
  C('cand-environment', 'Environmental stewardship', 'الإشراف البيئي', 'not_added', null, true, false,
    'A transversal skill in the catalogue and part of the energy-transition skills; it has no plant-specific core development and assessment approach of its own.', 'مهارة مستعرضة في الدليل وجزء من مهارات التحول في الطاقة؛ وليس لها أسلوب تطوير وتقييم أساسي خاص بالمحطة.', ['WEF-FOJ', 'GREENCOMP'], [S.wef, S.jrc]),
  C('cand-attitude', 'Positive attitude', 'الموقف الإيجابي', 'not_added', null, false, false,
    'An attitude without an observable assessment approach; the inclusion rule needs both a development and an assessment approach.', 'موقف بلا أسلوب تقييم قابل للملاحظة؛ وتتطلب قاعدة الإدراج أسلوباً للتطوير وآخر للتقييم.', ['MCK-DELTA'], [S.delta]),
  C('cand-techlit', 'Technological literacy', 'الإلمام التقني', 'merged', 'cs-digital-judgement', true, true,
    'Assessed by the same AI and digital fitness check and developed on the same ladder, so it is part of Digital and AI judgement.', 'يُقيَّم بفحص اللياقة الرقمية نفسه ويُطوَّر على السلّم نفسه، لذا هو جزء من الحكم الرقمي وفي الذكاء الاصطناعي.', ['WEF-FOJ'], [S.wef]),
];

// ───────────── Targets: 1 Foundation, 2 Proficient, 3 Role model
const OPERATING = ['operations', 'maintenance', 'radiation-protection', 'chemistry', 'fire-protection', 'emergency-preparedness', 'outage', 'nuclear-fuel'];
const SAFETY_BEHAVIOURS = ['cs-questioning', 'cs-conservative', 'cs-procedure', 'cs-peer-check', 'cs-comm-stress'];
const HIGH = {
  training: ['cs-developing', 'cs-learning-agility'],
  oversight: ['cs-questioning', 'cs-problem', 'cs-speak-up'], quality: ['cs-questioning', 'cs-problem', 'cs-speak-up'], licensing: ['cs-questioning', 'cs-problem', 'cs-speak-up'],
  engineering: ['cs-systems', 'cs-problem'], cyber: ['cs-digital-judgement'], corporate: ['cs-cross-cultural'], 'supply-chain': ['cs-cross-cultural'],
  'health-safety': ['cs-speak-up'], environment: ['cs-speak-up'],
};
const WHY = {
  base: ['Everyone at ENEC needs this core skill at Proficient.', 'يحتاج الجميع في مؤسسة الإمارات للطاقة النووية إلى هذه المهارة الأساسية بمستوى متمكّن.'],
  safety: ['Safety-significant work in this family expects role-model behaviour.', 'يتطلب العمل ذو الأهمية للسلامة في هذه العائلة سلوكاً قدوة.'],
  family: ['This family\'s work depends on it more than most, so the target is Role model.', 'يعتمد عمل هذه العائلة عليها أكثر من غيرها، لذا فالهدف مستوى القدوة.'],
  creative: ['In operating crews, improvement ideas go through the suggestion channel; Foundation is the target.', 'في أطقم التشغيل تمر أفكار التحسين عبر قناة المقترحات؛ والهدف مستوى الأساس.'],
};
export function targetRows(families) {
  const out = [];
  for (const f of families) {
    for (const cs of CORE) {
      let level = 2;
      let why = WHY.base;
      if (OPERATING.includes(f.id) && SAFETY_BEHAVIOURS.includes(cs.id)) { level = 3; why = WHY.safety; }
      else if ((HIGH[f.id] ?? []).includes(cs.id)) { level = 3; why = WHY.family; }
      else if (f.id === 'operations' && cs.id === 'cs-creative') { level = 1; why = WHY.creative; }
      out.push({ id: `cst-${f.id}-${cs.id.replace(/^cs-/, '')}`, family_id: f.id, core_skill_id: cs.id, level, rationale_en: why[0], rationale_ar: why[1] });
    }
  }
  return out;
}

export function coreRows() {
  return CORE.map((c, i) => ({
    id: c.id, code: c.code, cluster: c.cluster, name_en: c.name_en, name_ar: c.name_ar, summary_en: c.summary_en, summary_ar: c.summary_ar, plant_en: c.plant_en, plant_ar: c.plant_ar,
    descriptors: c.descriptors, mappings: c.mappings, benchmark_ids: benchmarkIdsOf(c), trait_ids: c.trait_ids, skill_ids: c.skill_ids, development: c.development, assessment: c.assessment,
    dev_approach_en: c.dev_approach_en, dev_approach_ar: c.dev_approach_ar, assess_approach_en: c.assess_approach_en, assess_approach_ar: c.assess_approach_ar,
    outcome_en: c.outcome_en ?? '', outcome_ar: c.outcome_ar ?? '', sources: c.sources, status: 'active', version: 1, as_of: AS_OF, sort: (CLUSTERS.indexOf(c.cluster) + 1) * 100 + i + 1,
  }));
}

/** Bank order interleaves the core skills: round r of skill k sorts at r * 100 + k. */
export function itemRows() {
  const per = new Map();
  return ITEMS.map((it) => {
    const round = (per.get(it.core_skill_id) ?? 0) + 1;
    per.set(it.core_skill_id, round);
    const k = CORE.findIndex((c) => c.id === it.core_skill_id) + 1;
    return {
      id: `sjt-${it.core_skill_id.replace(/^cs-/, '')}-${round}`, core_skill_id: it.core_skill_id, theme: it.theme, stem_en: it.stem_en, stem_ar: it.stem_ar,
      options_en: it.options.map((o) => o.en), options_ar: it.options.map((o) => o.ar), expert_key: it.options.map((o) => o.eff),
      notes_en: it.options.map((o) => o.note_en), notes_ar: it.options.map((o) => o.note_ar), rationale_en: it.rationale_en, rationale_ar: it.rationale_ar,
      status: 'active', version: 1, sort: round * 100 + k, updated_by: null, updated_at: `${AS_OF.slice(0, 8)}01T00:00:00Z`,
    };
  });
}

// ───────────── Practice simulation (the same rules as the server)
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
const rnd = (s) => h32(s) / 4294967296;
const QUARTERS = [['2025-Q4', '2025-11-'], ['2026-Q1', '2026-02-'], ['2026-Q2', '2026-05-'], ['2026-Q3', '2026-08-'], ['2026-Q4', '2026-10-0']];
/** Demo personas with a visible practice history and an improving trend. */
const FORCE = { 'p-k-ro': [0, 1, 2, 3, 4], 'p-sro': [1, 3, 4], 'p-k-lo-trainee': [2, 3, 4], 'p-training-mgr': [3], 'p-chco': [4] };

export function simulate(T) {
  const rows = itemRows();
  const names = CORE.map((c, i) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, sort: (CLUSTERS.indexOf(c.cluster) + 1) * 100 + i + 1 }));
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').sort((a, b) => (a.id < b.id ? -1 : 1));
  const attempts = [];
  for (const p of staff) {
    let qs = FORCE[p.id];
    if (!qs) {
      if (rnd(`take:${p.id}`) >= 0.72) continue;
      qs = QUARTERS.map((_, qi) => qi).filter((qi) => rnd(`q:${p.id}:${qi}`) < 0.5);
      if (!qs.some((qi) => qi >= 1)) qs.push(1 + Math.floor(rnd(`qq:${p.id}`) * 4));
      qs = [...new Set(qs)].sort();
    }
    const base = p.id === 'p-k-ro' ? 0.3 : 0.18 + 0.32 * rnd(`ab:${p.id}`);
    const answered = new Map();
    let no = 0;
    for (const qi of qs) {
      no++;
      const [period, prefix] = QUARTERS[qi];
      const focus = !FORCE[p.id] && rnd(`f:${p.id}:${no}`) < 0.2 ? CORE[Math.floor(rnd(`fc:${p.id}:${no}`) * CORE.length)].id : null;
      const set = pickSet(rows, answered, no, focus, personSeed(p.id));
      const ability = Math.min(0.9, base + (p.id === 'p-k-ro' ? 0.13 : 0.07) * (no - 1));
      const responses = set.map((iid) => {
        const it = rows.find((r) => r.id === iid);
        const order = it.expert_key.map((e, i) => ({ e, i })).sort((a, b) => b.e - a.e || a.i - b.i);
        const u = rnd(`c:${p.id}:${no}:${iid}`);
        const pick = u < ability ? order[0] : u < ability + (1 - ability) * 0.45 ? order[1] : order[2 + Math.floor(rnd(`w:${p.id}:${no}:${iid}`) * 2)];
        return { item_id: iid, core_skill_id: it.core_skill_id, choice: pick.i, eff: feedbackOf(it, pick.i).eff };
      });
      for (const r of responses) answered.set(r.item_id, (answered.get(r.item_id) ?? 0) + 1);
      const sc = scoreSjt(responses, names);
      const day = prefix.endsWith('-0') ? `${prefix}${1 + Math.floor(rnd(`d:${p.id}:${no}`) * 8)}` : `${prefix}${String(3 + Math.floor(rnd(`d:${p.id}:${no}`) * 24)).padStart(2, '0')}`;
      const hh = String(8 + Math.floor(rnd(`h:${p.id}:${no}`) * 8)).padStart(2, '0');
      attempts.push({
        id: `sjt-a-${p.id.replace(/^p-/, '')}-${no}`, person_id: p.id, period, attempt_no: no, core_skill_id: focus, status: 'completed', item_ids: set, responses,
        score: sc.score, by_skill: sc.by_skill, reasons: sc.reasons, started_at: `${day}T${hh}:00:00Z`, completed_at: `${day}T${hh}:18:00Z`,
      });
      if (quarterOf(day) !== period) throw new Error(`fs25: ${day} is not in ${period}`);
    }
  }
  return attempts;
}

export default function build(T) {
  T.core_skills = coreRows();
  T.core_skill_candidates = CANDIDATES.map((c, i) => ({ ...c, sort: i + 1 }));
  T.core_skill_targets = targetRows(T.job_families ?? []);
  T.sjt_items = itemRows();
  // Checks that fail the build
  const benchmarks = new Set((T.benchmarks ?? []).map((b) => b.id));
  const traits = new Set((T.sc_traits ?? []).map((t) => t.id));
  const courses = new Set((T.courses ?? []).map((c) => c.id));
  const problems = inclusionProblems(T.core_skills);
  if (problems.length) throw new Error(`fs25: inclusion rule fails: ${JSON.stringify(problems)}`);
  for (const c of T.core_skills) {
    for (const m of c.mappings) if (m.benchmark_id && !benchmarks.has(m.benchmark_id)) throw new Error(`fs25: ${c.id} maps to unknown benchmark ${m.benchmark_id}`);
    for (const t of c.trait_ids) if (!traits.has(t)) throw new Error(`fs25: ${c.id} unknown INPO trait ${t}`);
    for (const r of c.development) if (r.kind === 'course' && !courses.has(r.ref)) throw new Error(`fs25: ${c.id} unknown course ${r.ref}`);
    if (c.descriptors.some((d) => !d.en || !d.ar)) throw new Error(`fs25: ${c.id} descriptor missing a language`);
  }
  if (T.core_skill_targets.length !== (T.job_families ?? []).length * 16) throw new Error('fs25: a target for every family and core skill');
  const ids = T.core_skills.map((c) => c.id);
  const badItems = T.sjt_items.map((i) => [i.id, sjtItemProblem(i, ids)]).filter(([, p]) => p);
  if (badItems.length) throw new Error(`fs25: invalid SJT items ${JSON.stringify(badItems)}`);
  if (T.sjt_items.length < 40 || ids.some((id) => T.sjt_items.filter((i) => i.core_skill_id === id).length < 2)) throw new Error('fs25: at least 40 items and 2 per core skill');
  T.sjt_attempts = simulate(T);
  console.log(`fs25/26: ${T.core_skills.length} core skills, ${T.core_skill_candidates.length} candidates not added, ${T.core_skill_targets.length} family targets, ${T.sjt_items.length} SJT items, ${T.sjt_attempts.length} practice sets for ${new Set(T.sjt_attempts.map((a) => a.person_id)).size} staff (no skill evidence written)`);
}

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const names = new Map(T.skills.map((s) => [s.id, s]));
  for (const c of T.core_skills) for (const s of c.skill_ids) if (!names.has(s)) throw new Error(`fs25: ${c.id} unknown catalogue skill ${s}`);
  const by = new Map();
  for (const s of T.person_skills) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const holders = new Map(T.core_skills.map((c) => [c.id, 0]));
  for (const p of T.people.filter((x) => x.kind === 'staff' && x.status === 'active')) {
    const prof = coreProfile(p.id, p.job_family_id, T.core_skills, T.core_skill_targets, by.get(p.id) ?? [], names, T.sjt_attempts, today);
    for (const v of prof.skills) if (v.level > 0) holders.set(v.core_skill_id, holders.get(v.core_skill_id) + 1);
  }
  const kro = coreProfile('p-k-ro', 'operations', T.core_skills, T.core_skill_targets, by.get('p-k-ro') ?? [], names, T.sjt_attempts, today);
  if (kro.summary.met + kro.summary.below < 3 || !kro.skills.some((v) => v.practice)) throw new Error('fs25: k-ro should see evidence and practice on several core skills');
  if (T.skill_evidence.some((e) => e.ref_table === 'sjt_attempts')) throw new Error('fs25: practice never writes skill evidence');
  void holders;
}
