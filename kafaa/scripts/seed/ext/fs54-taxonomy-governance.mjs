// [FS wave F · E3 · FS54 + FS55] Skills council and taxonomy change tracker; engine cards for every ranked surface, the skills-ontology
// datasheet and the model-risk template (module M16). Seed rows for M16's own tables only:
//   - engine_cards: the FS55 cards (digest, Dalil career mode, Dalil answers, pathways, externals, translator, fitness check, future gigs and
//     every other ranked surface added since F24), each listing the ranking functions the lint test finds in the code (src/modules/m16/
//     surfaces.ts RANKED_SURFACES); the eight F24 cards gain the FS55 columns (kernel surface, what they rank, fairness outcome) and the
//     navigator and Future Me cards name the rankers their pages already use (rankConcepts, bridgePlan, rankRaises) at version 3. The
//     migration 20261010263001_kafaa_fs63_taxonomy_governance.sql applies the same updates to the live rows (guarded, idempotent).
//   - skill_change_requests + skill_changes (finalize, after FS02 appends its future skills): the council's history. Every published change
//     is already reflected in the catalogue (the FS02 future skills added through the council in June-September 2026, the paper
//     work-package skill retired on 2026-06-30 with its replacement), so no catalogue row changes here. Open requests (a rename, a split
//     with one approval, a retire with one approval, a re-level, two additions, one with a first rejection) are left for the demo.
//   - surface_fairness (finalize): ten weekly FS55 snapshots computed by surfaceSnapshot() as of each week, exactly what
//     kafaa_run_surface_fairness would store (PGlite proves SQL = TS).
// People are role cards (persona ids p-*); no names in the public change log (roles only).
import { F24_ADDED_FUNCTIONS, RANKED_SURFACES, surfaceSnapshot } from '../../../src/modules/m16/surfaces.ts';
import { weeklyDates } from '../../../src/modules/m16/fairness.ts';
import { inclusionChecks, requestTitle, snapshot, changeImpact } from '../../../src/modules/m16/taxonomyGov.ts';

export const FINALIZE_LAST = true; // after fs02-catalogue.mjs (future skills) and f36 (digest runs), by file name
const AS_OF = '2026-10-11';
// Card sources come from the FS research packs only (corporate_platforms.md: TechWolf/Workday governance, EU AI Act Article 4 repository).
const SRC = {
  techwolf: { label: 'TechWolf · Workday customer story (skills inference with governance)', url: 'https://www.techwolf.ai/customer-stories/workday', as_of: AS_OF },
  ailit: { label: 'European Commission · EU AI Act Article 4 AI-literacy repository', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices', as_of: AS_OF },
};
const EXCLUDED = ['gender', 'nationality_flag', 'age'];
const I = (key, en, ar) => ({ key, en, ar });
const IN = {
  skills: I('person_skills', 'My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)', 'مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)'),
  roleReq: I('role_competencies', 'The competency levels each role requires (core, important, useful)', 'مستويات الكفاءة التي يتطلبها كل دور (أساسية، مهمة، مفيدة)'),
  training: I('training_records', 'Courses I completed or am enrolled in', 'الدورات التي أكملتها أو المسجّل فيها'),
  targets: I('career_targets', 'My shortlisted target roles (only if I set them)', 'الأدوار المستهدفة في قائمتي المختصرة (إن حدّدتها فقط)'),
  digest: I('digest_sources', 'What needs me this week from my own records: approvals I owe, expiring qualifications, refreshers, coach picks and matched opportunities', 'ما يحتاجني هذا الأسبوع من سجلاتي: الموافقات المطلوبة مني والمؤهلات التي توشك على الانتهاء والتنشيط واختيارات المدرّب والفرص المطابقة'),
  opp: I('opportunities', 'Each opportunity: skills needed, skills gained, eligible job families', 'كل فرصة: المهارات المطلوبة والمهارات المكتسبة والعائلات الوظيفية المؤهلة'),
  dalil: I('career_context', 'When I ask Dalil a career question: my skills, targets, training and open applications (read for that answer only)', 'عندما أسأل دليل سؤالاً مهنياً: مهاراتي وأهدافي وتدريبي وطلباتي المفتوحة (تُقرأ لتلك الإجابة فقط)'),
  corpus: I('corpus_docs', 'Published Dalil corpus documents with their citations (public pages only in public mode)', 'وثائق مدوّنة دليل المنشورة مع استشهاداتها (الصفحات العامة فقط في الوضع العام)'),
  pathways: I('pathways', 'Published pathways: skill, level, steps, time envelope and weekly hours', 'المسارات المنشورة: المهارة والمستوى والخطوات والإطار الزمني والساعات الأسبوعية'),
  externals: I('external_resources', 'Published external resources: skills, hours, cost band, languages and the outcome criteria they met', 'الموارد الخارجية المنشورة: المهارات والساعات وفئة التكلفة واللغات ومعايير النتائج التي استوفتها'),
  held: I('held_skills', 'The skills and experience I enter (nothing is stored)', 'المهارات والخبرات التي أدخلها (لا يُحفظ شيء)'),
  occupations: I('occupation_templates', 'ESCO occupation templates and the published Barakah role requirements', 'قوالب المهن في ESCO ومتطلبات أدوار براكة المنشورة'),
  fitness: I('fitness_responses', 'My answers in the check: correct or not, per area and difficulty', 'إجاباتي في الفحص: صحيحة أم لا، لكل مجال ومستوى صعوبة'),
  drills: I('drill_responses', 'My drill answers: the flags I raised, my decision and rationale', 'إجاباتي في التمارين: التنبيهات التي رفعتها وقراري ومبرراته'),
  gigs: I('future_gigs', 'Future-skills gigs: skills gained, time envelope and the line manager release', 'مهام المهارات المستقبلية: المهارات المكتسبة والإطار الزمني وموافقة المدير المباشر'),
  smr: I('smr_deltas', 'SMR delta rows per role and technology (public sources) and my skill levels', 'صفوف فروق المفاعلات الصغيرة لكل دور وتقنية (مصادر عامة) ومستويات مهاراتي'),
  twin: I('twin_submissions', 'My twin drill submissions: checks, diagnosis, action and rationale', 'إجاباتي في تمارين التوأم الرقمي: الفحوص والتشخيص والإجراء والمبرر'),
  profiles: I('role_profiles', 'Role profiles now, in 2030 and 2035, and task exposure on the OECD AI capability scale', 'ملفات الأدوار اليوم وفي 2030 و2035، وتعرّض المهام وفق مقياس قدرات الذكاء الاصطناعي لمنظمة التعاون الاقتصادي والتنمية'),
  adaptive: I('adaptive_items', 'Calibrated item difficulty and my answers so far', 'صعوبة الأسئلة المعايَرة وإجاباتي حتى الآن'),
  candidates: I('instructor_candidates', 'Instructor and SME candidates: discipline, qualifications, observations and motivation', 'المرشحون للتدريب والخبرة: التخصص والمؤهلات والملاحظات والدافعية'),
  reserve: I('reserve_members', 'Alumni and experts who opted in: skills and availability window', 'الخريجون والخبراء الذين اختاروا المشاركة: المهارات وفترة التوفر'),
  scenarios: I('sim_scenarios', 'Simulator scenarios: objectives, competencies, last run and coverage of the cycle', 'سيناريوهات المحاكي: الأهداف والكفاءات وآخر تشغيل وتغطية الدورة'),
  kb: I('knowledge_index', 'Published knowledge assets, OE lessons and course texts (BM25 index)', 'أصول المعرفة المنشورة ودروس الخبرة التشغيلية ونصوص الدورات (فهرس BM25)'),
  klra: I('klra_positions', 'Position bands: retirement and contract-end bands, criticality and single points of failure (no ages or birth dates)', 'فئات المناصب: فئات التقاعد وانتهاء العقد والأهمية ونقاط الإخفاق المنفردة (دون أعمار أو تواريخ ميلاد)'),
  leadership: I('leadership_programmes', 'Leadership programmes, my nominations and completed modules, and 360 behaviour scores (form 2)', 'برامج القيادة وترشيحاتي والوحدات المكتملة ودرجات سلوكيات التقييم الشامل (النموذج 2)'),
  hu: I('hu_tools', 'HU tool cards with their situation cues, AI-era topic and linked drills or lessons', 'بطاقات أدوات الأداء البشري مع مؤشرات المواقف وموضوع عصر الذكاء الاصطناعي والتمارين أو الدروس المرتبطة'),
  journey: I('student_journey', 'My journey answers: stage, interests and chosen route (students and applicants)', 'إجاباتي في الرحلة: المرحلة والاهتمامات والمسار المختار (الطلاب والمتقدمون)'),
  agenda: I('conversation_agenda', 'The agreed conversation agenda, preparation notes and catalogue courses', 'جدول المحادثة المتفق عليه وملاحظات التحضير ودورات الكتالوج'),
  passport: I('passport_context', 'My validated skill levels, role requirements and similar roles', 'مستويات مهاراتي المعتمدة ومتطلبات الأدوار والأدوار المشابهة'),
  accr: I('accreditation_criteria', 'Accreditation criteria and the evidence kinds already on file', 'معايير الاعتماد وأنواع الأدلة المتوفرة'),
};
const b = (en, ar) => ({ en, ar });
const OWN = {
  talent: b('Head of Talent and Careers (role card)', 'رئيس المواهب والمسارات المهنية (بطاقة دور)'),
  training: b('Training Manager (role card)', 'مدير التدريب (بطاقة دور)'),
  km: b('Knowledge management lead (role card)', 'مسؤول إدارة المعرفة (بطاقة دور)'),
  ai: b('AI governance lead (role card)', 'مسؤول حوكمة الذكاء الاصطناعي (بطاقة دور)'),
  future: b('Future workforce lead (role card)', 'مسؤول القوى العاملة المستقبلية (بطاقة دور)'),
  hr: b('HR authority, CHCO office (role card)', 'سلطة الموارد البشرية، مكتب الرئيس التنفيذي لرأس المال البشري (بطاقة دور)'),
  culture: b('Safety culture lead (role card)', 'مسؤول ثقافة السلامة (بطاقة دور)'),
  academy: b('Nuclear training academy lead (role card)', 'مسؤول أكاديمية التدريب النووي (بطاقة دور)'),
  quality: b('Training quality and accreditation lead (role card)', 'مسؤول جودة التدريب والاعتماد (بطاقة دور)'),
  outreach: b('Talent outreach lead (role card)', 'مسؤول استقطاب المواهب (بطاقة دور)'),
};
const NO_DECISION = b('It never decides anything on its own: a person reads the reasons and chooses.', 'لا يقرّر شيئاً بمفرده: يقرأ الشخص الأسباب ويختار.');

/** FS55 card text, keyed by card id (registry fields come from RANKED_SURFACES). */
const CARDS = {
  digest: { title: b('Weekly digest', 'الملخص الأسبوعي'), owner: OWN.talent, inputs: [IN.digest, IN.skills, IN.opp, IN.targets],
    purpose: b('Picks at most seven things that need me this week and orders them by urgency, with matched opportunities scored like the marketplace.', 'يختار سبعة بنود كحد أقصى تحتاجني هذا الأسبوع ويرتّبها حسب الإلحاح، مع فرص مطابقة تُحتسب درجتها كما في سوق الفرص.'),
    output: b('A short weekly list, each item with why it is there and a link; opportunity items carry their match reasons.', 'قائمة أسبوعية قصيرة، لكل بند سبب ظهوره ورابط؛ وتحمل بنود الفرص أسباب المطابقة.'),
    oversight: b('I choose the frequency, quiet hours and muted kinds; nothing is sent during quiet hours and nothing is decided for me.', 'أختار التكرار وساعات الهدوء والأنواع المكتومة؛ لا يُرسل شيء في ساعات الهدوء ولا يُقرَّر شيء نيابة عني.'),
    limitations: b('Only items from records Kafa\'a holds; approvals outside Kafa\'a do not appear. Opportunities follow the marketplace engine weights.', 'تظهر البنود المستمدة من سجلات كفاءة فقط؛ ولا تظهر الموافقات خارجها. وتتبع الفرص أوزان محرك سوق الفرص.') },
  dalil_career: { title: b('Dalil career mode', 'وضع المسار المهني في دليل'), owner: OWN.talent, inputs: [IN.dalil, IN.skills, IN.roleReq, IN.training, IN.opp],
    purpose: b('Answers career questions with my own readiness, gaps, courses and open opportunities, each answer card ranked with its reasons.', 'يجيب عن الأسئلة المهنية بجاهزيتي وفجواتي ودوراتي والفرص المفتوحة، وكل بطاقة إجابة مرتبة مع أسبابها.'),
    output: b('Answer cards (roles, gaps, courses, opportunities) with reasons and links; no free-text generation.', 'بطاقات إجابة (أدوار، فجوات، دورات، فرص) مع الأسباب والروابط؛ دون توليد نص حر.'),
    oversight: b('Guidance only; a person can hand the conversation to HR with my consent. Moves are decided by managers and HR.', 'إرشاد فقط؛ ويمكن تحويل المحادثة إلى الموارد البشرية بموافقتي. ويقرّر المديرون والموارد البشرية التنقلات.'),
    limitations: b('Uses the same deterministic engines as the Navigator, Coach and marketplace; questions outside careers are answered by the public mode or refused.', 'يستخدم المحركات الحتمية نفسها في المستكشف والمدرّب وسوق الفرص؛ وتُجاب الأسئلة خارج المسار المهني بالوضع العام أو تُرفض.') },
  dalil_answers: { title: b('Dalil answers (retrieval)', 'إجابات دليل (الاسترجاع)'), owner: OWN.ai, inputs: [IN.corpus],
    purpose: b('Finds the published passages that answer a question and cites them; refuses security, medical and exam topics.', 'يجد المقاطع المنشورة التي تجيب عن السؤال ويستشهد بها؛ ويرفض موضوعات الأمن والطب والاختبارات.'),
    output: b('An answer assembled from cited passages, with the sources; the model gateway slot is disabled.', 'إجابة مجمّعة من مقاطع مستشهد بها مع المصادر؛ ومنفذ بوابة النماذج معطّل.'),
    oversight: b('Corpus documents are published by editors; refusals follow the published refusal policy and are evaluated before release.', 'ينشر المحررون وثائق المدوّنة؛ وتتبع حالات الرفض سياسة الرفض المنشورة وتُقيَّم قبل الإصدار.'),
    limitations: b('Answers only from the corpus; anything not published is unknown to it. Public mode reads public pages only.', 'يجيب من المدوّنة فقط؛ وما لم يُنشر لا يعرفه. ويقرأ الوضع العام الصفحات العامة فقط.') },
  pathways: { title: b('Future-skill pathways', 'مسارات المهارات المستقبلية'), owner: OWN.training, inputs: [IN.pathways, IN.skills, IN.targets],
    purpose: b('Orders published pathways by the skill levels they would add for me and my targets, within a time envelope I can keep.', 'يرتّب المسارات المنشورة حسب مستويات المهارات التي تضيفها لي ولأهدافي، ضمن إطار زمني يمكنني الالتزام به.'),
    output: b('Ranked pathways with the level gain, weekly hours and reasons; enrolment is my choice.', 'مسارات مرتبة مع مكسب المستوى والساعات الأسبوعية والأسباب؛ والتسجيل خياري.'),
    oversight: b('Pathways are published by the training manager after the coverage checks; nothing enrols me automatically.', 'ينشر مدير التدريب المسارات بعد فحوص التغطية؛ ولا يسجّلني شيء تلقائياً.'),
    limitations: b('Only published pathways with steps in the catalogue; level gains are planned, not measured, until evidence is recorded.', 'المسارات المنشورة ذات الخطوات في الكتالوج فقط؛ ومكاسب المستوى مخطّطة لا مقيسة حتى تُسجَّل الأدلة.') },
  externals: { title: b('Curated external catalogue', 'الكتالوج الخارجي المنتقى'), owner: OWN.training, inputs: [IN.externals, IN.skills],
    purpose: b('Suggests up to four external resources that passed the outcome criteria, for the skills my ranked pathways target.', 'يقترح حتى أربعة موارد خارجية اجتازت معايير النتائج، للمهارات التي تستهدفها مساراتي المرتبة.'),
    output: b('A short list per pathway with cost band, hours and languages; completion is self-declared until verified.', 'قائمة قصيرة لكل مسار مع فئة التكلفة والساعات واللغات؛ والإكمال ذاتي التصريح حتى يُتحقق منه.'),
    oversight: b('Resources are curated and published by the training manager against published criteria; nothing is bought automatically.', 'ينتقي مدير التدريب الموارد وينشرها وفق معايير منشورة؛ ولا يُشترى شيء تلقائياً.'),
    limitations: b('External completions never become verified evidence on their own.', 'لا تصبح الإنجازات الخارجية أدلة موثّقة بمفردها.') },
  translator: { title: b('Transferable-skills translator', 'مترجم المهارات القابلة للنقل'), owner: OWN.outreach, inputs: [IN.held, IN.occupations, IN.roleReq],
    purpose: b('Translates the skills and experience someone enters into the Barakah roles they cover best, with the gaps and a first course.', 'يترجم المهارات والخبرات التي يُدخلها الشخص إلى أدوار براكة الأكثر تغطية لها، مع الفجوات وأول دورة.'),
    output: b('Roles ordered by weighted coverage (the Navigator formula) with the reasons; nothing is stored.', 'أدوار مرتبة حسب التغطية المرجّحة (معادلة المستكشف) مع الأسباب؛ ولا يُحفظ شيء.'),
    oversight: b('Exploration only; applications go through the published recruitment process.', 'للاستكشاف فقط؛ وتمر الطلبات بإجراءات التوظيف المنشورة.'),
    limitations: b('Public tool: it cannot see real records, so coverage reflects only what was entered. Security roles show the path only.', 'أداة عامة: لا ترى السجلات الفعلية، فتعكس التغطية ما أُدخل فقط. وتعرض أدوار الأمن المسار فقط.') },
  fitness: { title: b('AI and digital fitness check and drills', 'فحص اللياقة الرقمية وتمارين الذكاء الاصطناعي'), owner: OWN.ai, inputs: [IN.fitness, IN.drills],
    purpose: b('Chooses the next question by area and difficulty, scores the check and governed AI drills, and writes capped evidence.', 'يختار السؤال التالي حسب المجال والصعوبة، ويحتسب نتيجة الفحص وتمارين الذكاء الاصطناعي المحوكمة، ويسجّل أدلة بسقف محدد.'),
    output: b('Area levels, a band and the reasons; evidence never above level 2 and never a qualification.', 'مستويات المجالات وفئة وأسباب؛ ولا تتجاوز الأدلة المستوى 2 ولا تكون مؤهلاً أبداً.'),
    oversight: b('Items are written and reviewed by the training manager; results are mine and appear to HR only as suppressed aggregates.', 'يكتب مدير التدريب الأسئلة ويراجعها؛ والنتائج لي ولا تظهر للموارد البشرية إلا كمجاميع محجوبة.'),
    limitations: b('A short self-paced check, not an exam; quarterly retakes show the trend.', 'فحص قصير ذاتي الوتيرة لا اختبار؛ وتُظهر الإعادات الفصلية الاتجاه.') },
  future_gigs: { title: b('Future-skills gigs', 'مهام المهارات المستقبلية'), owner: OWN.talent, inputs: [IN.gigs, IN.skills],
    purpose: b('Orders future-skills gigs by the skill levels they would add for me, inside my approved time envelope.', 'يرتّب مهام المهارات المستقبلية حسب مستويات المهارات التي تضيفها لي، ضمن إطاري الزمني المعتمد.'),
    output: b('Ranked gigs with the level gain and fit; applying needs my line manager\'s release.', 'مهام مرتبة مع مكسب المستوى والملاءمة؛ ويتطلب التقديم موافقة مديري المباشر.'),
    oversight: b('Posting managers select; the score never selects anyone.', 'يختار المديرون الناشرون؛ ولا تختار الدرجة أحداً أبداً.'),
    limitations: b('Gigs without skills gained show no level gain; the envelope caps hours, not ambition.', 'لا تُظهر المهام دون مهارات مكتسبة مكسب مستوى؛ ويحدّ الإطار الساعات لا الطموح.') },
  smr_delta: { title: b('SMR delta overlay', 'طبقة فروق المفاعلات الصغيرة'), owner: OWN.future, inputs: [IN.smr, IN.skills],
    purpose: b('Shows what would change in my role for each small modular reactor technology and how ready I am for the delta.', 'يعرض ما سيتغير في دوري لكل تقنية مفاعل وحدات صغيرة ومدى جاهزيتي للفرق.'),
    output: b('Per technology: change size, what stays, the skills to build and my readiness; no deployment decision implied.', 'لكل تقنية: حجم التغيير وما يبقى والمهارات المطلوب بناؤها وجاهزيتي؛ دون أي قرار نشر ضمني.'),
    oversight: b('Delta rows come from public sources and are published by the future workforce lead.', 'تأتي صفوف الفروق من مصادر عامة وينشرها مسؤول القوى العاملة المستقبلية.'),
    limitations: b('A planning lens with no headcount or site. Transform-surface weights are defaults only and cannot be stored.', 'عدسة تخطيط دون أعداد موظفين أو مواقع. وأوزان سطح التحول افتراضية فقط ولا يمكن حفظها.') },
  twin_drills: { title: b('Digital-twin diagnosis drills', 'تمارين التشخيص بالتوأم الرقمي'), owner: OWN.academy, inputs: [IN.twin],
    purpose: b('Scores my diagnosis of a simulated twin anomaly against the rubric and lists the drills that evidence a skill.', 'يقيّم تشخيصي لشذوذ توأم رقمي محاكى وفق معيار التصحيح ويعرض التمارين التي تثبت مهارة ما.'),
    output: b('Points per rubric line, a pass mark with critical checks and capped evidence (SIMULATED data).', 'نقاط لكل بند في المعيار وعلامة نجاح مع فحوص حرجة وأدلة بسقف محدد (بيانات محاكاة).'),
    oversight: b('Rubrics and keys are written by instructors; the drill never connects to the plant.', 'يكتب المدربون المعايير والمفاتيح؛ ولا يتصل التمرين بالمحطة أبداً.'),
    limitations: b('Synthetic scenarios; assess-surface weights are defaults only and cannot be stored.', 'سيناريوهات اصطناعية؛ وأوزان سطح التقييم افتراضية فقط ولا يمكن حفظها.') },
  role_2030: { title: b('My role in 2030', 'دوري في 2030'), owner: OWN.future, inputs: [IN.profiles, IN.skills],
    purpose: b('Maps how each task of my role may change with AI by 2030 and my readiness for the 2030 profile.', 'يرسم كيف قد تتغير كل مهمة في دوري بالذكاء الاصطناعي بحلول 2030 وجاهزيتي لملف 2030.'),
    output: b('Task exposure (augment, automate, stay) with reasons and my readiness per horizon.', 'تعرّض المهام (تعزيز، أتمتة، بقاء) مع الأسباب وجاهزيتي لكل أفق.'),
    oversight: b('Profiles are planning assumptions published by the training manager and HR director; no role change is implied.', 'الملفات افتراضات تخطيط ينشرها مدير التدريب ومدير الموارد البشرية؛ ولا يُفهم منها أي تغيير في الدور.'),
    limitations: b('Exposure follows the published capability scale; transform-surface weights are defaults only.', 'يتبع التعرّض مقياس القدرات المنشور؛ وأوزان سطح التحول افتراضية فقط.') },
  adaptive: { title: b('Adaptive future-skills assessments', 'تقييمات المهارات المستقبلية التكيفية'), owner: OWN.academy, inputs: [IN.adaptive],
    purpose: b('Picks the next calibrated item from my answers so far and stops when the estimate is stable.', 'يختار السؤال المعايَر التالي من إجاباتي حتى الآن ويتوقف حين يستقر التقدير.'),
    output: b('An estimate, whether it meets the cut level, and capped evidence; safety-related banks never gate a qualification.', 'تقدير، وهل يبلغ مستوى القطع، وأدلة بسقف محدد؛ ولا تشترط بنوك السلامة أي مؤهل.'),
    oversight: b('Banks and items are calibrated and reviewed by the academy; integrity flags go to a person.', 'تعاير الأكاديمية البنوك والأسئلة وتراجعها؛ وتُحال إشارات النزاهة إلى شخص.'),
    limitations: b('Item difficulty comes from synthetic calibration; assess-surface weights are defaults only.', 'تأتي صعوبة الأسئلة من معايرة اصطناعية؛ وأوزان سطح التقييم افتراضية فقط.') },
  instructors: { title: b('Instructor and SME candidates', 'المرشحون للتدريب والخبرة'), owner: OWN.training, inputs: [IN.candidates, IN.skills],
    purpose: b('Suggests colleagues who could become instructors or SMEs for a discipline, strongest evidence first.', 'يقترح زملاء يمكن أن يصبحوا مدربين أو خبراء في تخصص، بدءاً بأقوى الأدلة.'),
    output: b('A candidate list with reasons; nominations are made by managers and the training manager.', 'قائمة مرشحين مع الأسباب؛ ويرشّح المديرون ومدير التدريب.'),
    oversight: b('Every nomination is accepted by the person and qualified through observations; the list nominates no one.', 'يقبل الشخص كل ترشيح ويتأهل عبر الملاحظات؛ ولا ترشّح القائمة أحداً.'),
    limitations: b('Only evidence held in Kafa\'a counts; teaching quality shows only after observations.', 'تُحتسب الأدلة الموجودة في كفاءة فقط؛ ولا تظهر جودة التدريس إلا بعد الملاحظات.') },
  reserve: { title: b('Alumni and expert reserve matching', 'مطابقة احتياطي الخريجين والخبراء'), owner: OWN.hr, inputs: [IN.reserve],
    purpose: b('Matches opted-in alumni and experts to short engagements by the skills needed and their availability.', 'يطابق الخريجين والخبراء الذين اختاروا المشاركة مع ارتباطات قصيرة حسب المهارات المطلوبة وتوفرهم.'),
    output: b('Ranked requests for a member and ranked members for a request, with reasons.', 'طلبات مرتبة للعضو وأعضاء مرتبون للطلب، مع الأسباب.'),
    oversight: b('HR reviews every engagement; members choose to take part and can withdraw at any time.', 'تراجع الموارد البشرية كل ارتباط؛ ويختار الأعضاء المشاركة ويمكنهم الانسحاب في أي وقت.'),
    limitations: b('Covers alumni who opted in, not current staff, so it is outside the staff fairness population.', 'يشمل الخريجين الذين اختاروا المشاركة لا الموظفين الحاليين، فهو خارج فئة الإنصاف للموظفين.') },
  simulator: { title: b('Simulator scenario suggestions', 'اقتراحات سيناريوهات المحاكي'), owner: OWN.academy, inputs: [IN.scenarios],
    purpose: b('Suggests scenarios that cover the objectives a training cycle still misses.', 'يقترح سيناريوهات تغطي الأهداف التي لم تغطها دورة التدريب بعد.'),
    output: b('Ranked scenarios with the objectives each would cover; the planner chooses.', 'سيناريوهات مرتبة مع الأهداف التي يغطيها كل منها؛ ويختار المخطط.'),
    oversight: b('Cycles are approved maker-checker by the simulator lead and training manager.', 'تُعتمد الدورات بمبدأ المُعِدّ والمُدقِّق من مسؤول المحاكي ومدير التدريب.'),
    limitations: b('Ranks scenarios, not people.', 'يرتّب السيناريوهات لا الأشخاص.') },
  knowledge_search: { title: b('Knowledge search', 'بحث المعرفة'), owner: OWN.km, inputs: [IN.kb],
    purpose: b('Finds published knowledge assets, OE lessons, sessions and learning records for a query, best match first.', 'يجد أصول المعرفة المنشورة ودروس الخبرة التشغيلية والجلسات وسجلات التعلّم لاستعلام، الأفضل أولاً.'),
    output: b('Results with the matched terms; nothing is ranked about people.', 'نتائج مع المصطلحات المطابقة؛ ولا يُرتَّب شيء عن الأشخاص.'),
    oversight: b('Assets are reviewed by an SME before publication.', 'يراجع خبير الأصول قبل نشرها.'),
    limitations: b('Keyword relevance (BM25) only; synonyms not in the text are missed.', 'صلة الكلمات المفتاحية فقط (BM25)؛ وتفوت المرادفات غير الواردة في النص.') },
  klra: { title: b('Knowledge-loss risk assessment', 'تقييم مخاطر فقدان المعرفة'), owner: OWN.km, inputs: [IN.klra],
    purpose: b('Proposes attrition and position factors for each critical position so the knowledge owner can rank where to capture first.', 'يقترح عوامل الاستنزاف والمنصب لكل منصب حرج ليرتّب مسؤول المعرفة أين يبدأ التوثيق.'),
    output: b('Proposed factors with reasons; the assessor confirms or adjusts every score.', 'عوامل مقترحة مع الأسباب؛ ويؤكد المقيّم كل درجة أو يعدّلها.'),
    oversight: b('Scores are confirmed by a person; HR sees only the suppressed department heatmap.', 'يؤكد شخص الدرجات؛ ولا ترى الموارد البشرية إلا خريطة الأقسام المحجوبة.'),
    limitations: b('Uses bands, never ages or birth dates; synthetic HR feed.', 'يستخدم الفئات لا الأعمار أو تواريخ الميلاد أبداً؛ وتغذية موارد بشرية اصطناعية.') },
  leadership: { title: b('Leadership programme suggestions', 'اقتراحات برامج القيادة'), owner: OWN.talent, inputs: [IN.leadership, IN.skills],
    purpose: b('Orders leadership programmes and the behaviours to work on by my level, nominations and 360 results.', 'يرتّب برامج القيادة والسلوكيات التي أعمل عليها حسب مستواي وترشيحاتي ونتائج التقييم الشامل.'),
    output: b('Ranked programmes and focus behaviours with reasons; nominations are made by managers.', 'برامج مرتبة وسلوكيات تركيز مع الأسباب؛ ويرشّح المديرون.'),
    oversight: b('Nominations are approved by HR; the pipeline feeds the F24 high-potential fairness metric.', 'تعتمد الموارد البشرية الترشيحات؛ وتغذي القائمة مقياس الإنصاف للمواهب العالية في F24.'),
    limitations: b('360 scores below the suppression threshold are not shown.', 'لا تُعرض درجات التقييم الشامل دون حد الحجب.') },
  hu_situations: { title: b('HU tools for a situation', 'أدوات الأداء البشري لموقف'), owner: OWN.culture, inputs: [IN.hu],
    purpose: b('Orders HU tool cards for a situation I pick (for example a confident AI summary), AI-era cards first.', 'يرتّب بطاقات أدوات الأداء البشري لموقف أختاره (مثل ملخص واثق من الذكاء الاصطناعي)، وبطاقات عصر الذكاء الاصطناعي أولاً.'),
    output: b('Up to three cards with the cues they match and a linked drill or lesson.', 'حتى ثلاث بطاقات مع المؤشرات التي تطابقها وتمرين أو درس مرتبط.'),
    oversight: b('Cards are written by the safety culture team; nothing is recorded about me.', 'يكتب فريق ثقافة السلامة البطاقات؛ ولا يُسجَّل شيء عني.'),
    limitations: b('Same answer for everyone: it ranks content, not people.', 'الإجابة نفسها للجميع: يرتّب المحتوى لا الأشخاص.') },
  student_journey: { title: b('Student journey suggestions', 'اقتراحات رحلة الطالب'), owner: OWN.outreach, inputs: [IN.journey],
    purpose: b('Suggests job families and the next step of the route for students and applicants from their own answers.', 'يقترح عائلات وظيفية والخطوة التالية في المسار للطلاب والمتقدمين من إجاباتهم.'),
    output: b('Ranked families and a route suggestion with reasons; applications follow the published process.', 'عائلات مرتبة واقتراح مسار مع الأسباب؛ وتتبع الطلبات الإجراءات المنشورة.'),
    oversight: b('Talent programme staff own the routes; answers are cleared when the student asks.', 'يملك فريق برامج المواهب المسارات؛ وتُمسح الإجابات حين يطلب الطالب.'),
    limitations: b('Students and applicants, not staff, so it is outside the staff fairness population.', 'للطلاب والمتقدمين لا الموظفين، فهو خارج فئة الإنصاف للموظفين.') },
  conversations: { title: b('Career conversation suggestions', 'اقتراحات المحادثة المهنية'), owner: OWN.talent, inputs: [IN.agenda, IN.training],
    purpose: b('Suggests actions and courses for the agenda a manager and employee agreed.', 'يقترح إجراءات ودورات لجدول الأعمال الذي اتفق عليه المدير والموظف.'),
    output: b('A short list of actions with reasons; both people agree what goes into the plan.', 'قائمة قصيرة بالإجراءات مع الأسباب؛ ويتفق الطرفان على ما يدخل الخطة.'),
    oversight: b('Nothing enters the plan without both people agreeing.', 'لا يدخل شيء الخطة دون موافقة الطرفين.'),
    limitations: b('Ranks catalogue content for the agreed agenda only.', 'يرتّب محتوى الكتالوج لجدول الأعمال المتفق عليه فقط.') },
  passport: { title: b('Skills passport strengths', 'نقاط القوة في جواز المهارات'), owner: OWN.academy, inputs: [IN.passport, IN.roleReq],
    purpose: b('Lists my transferable strengths and the roles they are closest to, and the actions a team lead could take on team gaps.', 'يعرض نقاط قوتي القابلة للنقل والأدوار الأقرب إليها، والإجراءات التي يمكن لقائد الفريق اتخاذها لسد فجوات الفريق.'),
    output: b('Strengths and similar roles with reasons; team actions only for teams of ten or more.', 'نقاط قوة وأدوار مشابهة مع الأسباب؛ وإجراءات الفريق للفرق من عشرة أشخاص فأكثر فقط.'),
    oversight: b('I choose what to share; the passport never places anyone.', 'أختار ما أشاركه؛ ولا يضع الجواز أحداً في أي موقع.'),
    limitations: b('Only validated or evidenced levels count.', 'تُحتسب المستويات المعتمدة أو المثبتة فقط.') },
  accreditation: { title: b('Accreditation evidence suggestions', 'اقتراحات أدلة الاعتماد'), owner: OWN.quality, inputs: [IN.accr],
    purpose: b('Suggests which evidence already on file supports each accreditation criterion.', 'يقترح أي الأدلة المتوفرة تدعم كل معيار من معايير الاعتماد.'),
    output: b('Suggestions per criterion; the self-evaluation team decides what to submit.', 'اقتراحات لكل معيار؛ ويقرّر فريق التقييم الذاتي ما يُقدَّم.'),
    oversight: b('Kafa\'a is not an accreditation authority: the accrediting body decides.', 'كفاءة ليست جهة اعتماد: الجهة المعتمِدة هي التي تقرّر.'),
    limitations: b('Ranks evidence records, not people.', 'يرتّب سجلات الأدلة لا الأشخاص.') },
};
/** The scoring functions each FS55 card lists: the registry's functions plus the SQL mirrors where one exists. */
const SQL_FNS = { digest: ['sql:kafaa_dg_gather'], fitness: ['sql:kafaa_fit_next', 'sql:kafaa_fit_pick', 'sql:kafaa_fit_score'] };
const WEIGHT_KEYS = { skills: ['half_life_months'], recommend: ['core', 'important', 'useful'], match: ['skills', 'development', 'target'], search: ['title', 'k1', 'b'] };

/** The FS55 column values of one card (registry -> row). */
export function fs55Columns(s) {
  return { kernel_surface: s.kernel, ranks: s.ranks, fairness_metric: 'none' in s.fairness ? null : (s.fairness.f24 ?? s.fairness.metric), fairness_none: 'none' in s.fairness ? s.fairness.none : null };
}
/** F24 cards: rankers added to their scoring functions (and the version bump), same as the migration's guarded updates. */
export const F24_ADD = F24_ADDED_FUNCTIONS;
export const CARD_DATE = '2026-10-11T00:00:00Z';

/** Engine cards (run in finalize, after FS13/FS15 patched their F24 cards, so the order of scoring functions matches the live append). */
function engineCards(T) {
  const reg = new Map(RANKED_SURFACES.map((s) => [s.card, s]));
  // F24 cards: FS55 columns, and the rankers their pages already call
  for (const c of T.engine_cards) {
    const s = reg.get(c.id);
    if (!s) throw new Error(`fs54: engine card ${c.id} is not in RANKED_SURFACES`);
    Object.assign(c, fs55Columns(s));
    const add = (F24_ADD[c.id] ?? []).filter((f) => !c.scoring_functions.includes(f));
    if (add.length) { c.scoring_functions = [...c.scoring_functions, ...add]; c.version = (c.version ?? 1) + 1; c.last_changed_at = CARD_DATE; }
  }
  // FS55 cards
  let sort = Math.max(...T.engine_cards.map((c) => c.sort));
  for (const s of RANKED_SURFACES.filter((x) => x.wave === 'FS55')) {
    const t = CARDS[s.card];
    if (!t) throw new Error(`fs54: no card text for ${s.card}`);
    T.engine_cards.push({
      id: s.card, sort: ++sort, engine_surface: s.stored, module: s.module, route: s.route, feature: s.feature,
      title_en: t.title.en, title_ar: t.title.ar, purpose_en: t.purpose.en, purpose_ar: t.purpose.ar, owner_en: t.owner.en, owner_ar: t.owner.ar,
      inputs_used: t.inputs, inputs_excluded: EXCLUDED, scoring_functions: [...s.functions, ...(SQL_FNS[s.card] ?? [])],
      weight_keys: s.kernel === s.stored ? WEIGHT_KEYS[s.stored] : [],
      output_en: t.output.en, output_ar: t.output.ar, oversight_en: `${t.oversight.en} ${NO_DECISION.en}`, oversight_ar: `${t.oversight.ar} ${NO_DECISION.ar}`,
      limitations_en: t.limitations.en, limitations_ar: t.limitations.ar, opt_out: false, version: 1, last_changed_at: CARD_DATE, last_change_id: null,
      sources: [SRC.techwolf, SRC.ailit], ...fs55Columns(s),
    });
  }
}

// ───────────── FS54 council history (finalize: the catalogue is complete after FS02's finalizer)

const AREA_PLAN = [
  // [fs_area, effective_on, proposer, [first approver, role], [second approver, role], development, assessment]
  ['digital_plant', '2026-06-16', 'p-k-instructor', ['p-training-mgr', 'training_manager'], ['p-chco', 'hr_director'],
    'Developed through the digital work management and digital I&C courses and supervised on-the-job tasks on the new tools.',
    'Assessed through the course practical and an observed electronic work-package or digital round, separate from the legacy paper tasks.'],
  ['cyber_hygiene', '2026-07-07', 'p-k-instructor', ['p-training-mgr', 'training_manager'], ['p-k-admin', 'admin'],
    'Developed through the all-staff cyber hygiene awareness module and the yearly refresher; awareness level only.',
    'Assessed with the awareness quiz per behaviour (phishing, media, zones, access, reporting); no security arrangements are tested.'],
  ['transversal', '2026-07-21', 'p-k-instructor', ['p-training-mgr', 'training_manager'], ['p-chco', 'hr_director'],
    'Developed through the human skills studio practice, leadership journeys and coaching, each behaviour with its own practice set.',
    'Assessed through situational judgement practice and behaviourally anchored ratings, separate from the technical skills.'],
  ['ai_data', '2026-08-11', 'p-sme-reviewer', ['p-training-mgr', 'training_manager'], ['p-k-admin', 'admin'],
    'Developed through the future-skills course pack, the governed AI sandbox drills and AI fluency rungs.',
    'Assessed with the adaptive AI-literacy bank, performance tasks or drills, each mapped to this skill only.'],
  ['green_energy', '2026-08-25', 'p-k-instructor', ['p-training-mgr', 'training_manager'], ['p-chco', 'hr_director'],
    'Developed through the CleanEnergyComp modules and the energy-system pathway, separate from plant chemistry.',
    'Assessed through the module assessments and an applied exercise on a sourced value chain.'],
  ['advanced_reactor', '2026-09-15', 'p-k-instructor', ['p-training-mgr', 'training_manager'], ['p-chco', 'hr_director'],
    'Developed through the SMR foundations micro-credential and expert lectures; awareness of concepts, no deployment decision implied.',
    'Assessed through the micro-credential criteria and a short concept review, separate from current plant systems.'],
];
const RATIONALE = {
  digital_plant: 'The plant is moving to digital work management and rounds; the catalogue needs the digital skills alongside the declining paper ones.',
  cyber_hygiene: 'All staff need cyber hygiene as awareness content, kept separate from security roles (path only).',
  transversal: 'The WEF core skills appear in role profiles for 2030; they need their own catalogue entries to be evidenced and developed.',
  ai_data: 'AI tools are in daily use under the AI register; the skills to use, verify and govern them must be evidenced separately.',
  green_energy: 'CleanEnergyComp and the energy-transition pathways need sustainability skills that can be developed and assessed on their own.',
  advanced_reactor: 'Awareness of next-generation reactor concepts is needed for the SMR delta and future roles (no deployment decision implied).',
};
const ts = (day, h = 9) => `${day}T${String(h).padStart(2, '0')}:00:00Z`;
const minusDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** Open and closed requests that did not publish, plus the retire (kept apart so ids follow the timeline). */
function openRequests(skillsById) {
  const S = (id) => skillsById.get(id);
  return [
    { on: '2026-09-09', kind: 'add', skill_id: null, status: 'rejected', proposed_by: 'p-outage-planner', role: 'employee',
      proposal: { name_en: 'Chatbot prompt writing', name_ar: 'كتابة الأوامر لروبوتات المحادثة', area: 'digital', competency_id: 'da-02', fs_area: 'ai_data', key_level: 1, source_label: 'European Commission · EU AI Act Article 4 AI-literacy repository', source_url: SRC.ailit.url },
      rationale: 'Outage planners use chatbots to draft work-order texts and want the skill recognised.',
      development: 'A short module on writing prompts for the approved chatbot, with examples from planning work.', assessment: 'A practical exercise: draft three prompts and review the outputs with a peer.',
      votes: [['p-training-mgr', 'training_manager', 'reject', 'Not distinct from Prompt and agent literacy (FS-AI-03): same development and the same assessment.', '2026-09-12'],
        ['p-k-admin', 'admin', 'reject', 'Agree: covered by FS-AI-03; suggest the planner examples are added to its practice set.', '2026-09-14']] },
    { on: '2026-09-30', kind: 'rename', skill_id: 'sk-fs-ai-prompt', status: 'submitted', proposed_by: 'p-k-instructor', role: 'instructor',
      proposal: { name_en: 'Prompting and AI-agent oversight', name_ar: 'صياغة الأوامر والإشراف على وكلاء الذكاء الاصطناعي' },
      rationale: 'Learners read "literacy" as awareness only; the skill is about directing and overseeing agents in the approved tools.',
      development: 'Unchanged: the AI fluency rungs and the governed sandbox drills on agents.', assessment: 'Unchanged: the agent drills and the adaptive AI-literacy items mapped to this skill.', votes: [] },
    { on: '2026-10-01', kind: 'split', skill_id: 'sk-fs-ai-dataeng', status: 'first_approved', proposed_by: 'p-sme-reviewer', role: 'employee',
      proposal: { parts: [
        { name_en: 'Data pipeline basics', name_ar: 'أساسيات خطوط البيانات', description_en: 'Moves plant and work data between systems with checks, logs and owners for each step.', description_ar: 'ينقل بيانات المحطة والعمل بين الأنظمة مع فحوص وسجلات ومالك لكل خطوة.' },
        { name_en: 'Data modelling basics', name_ar: 'أساسيات نمذجة البيانات', description_en: 'Structures plant and work data into clear entities, keys and definitions others can reuse.', description_ar: 'ينظّم بيانات المحطة والعمل في كيانات ومفاتيح وتعريفات واضحة يمكن للآخرين إعادة استخدامها.' }] },
      rationale: 'Pipelines and modelling are taught in different courses and assessed by different tasks; one skill hides which one a person has.',
      development: 'Pipelines through the plant-data course labs; modelling through the data modelling workshop with the engineering data team.',
      assessment: 'Pipelines: a performance task on a drifting channel; modelling: a reviewed model of a work-order dataset.',
      votes: [['p-training-mgr', 'training_manager', 'approve', 'Two development routes and two assessments: meets the inclusion rule.', '2026-10-05']] },
    { on: '2026-10-02', kind: 'retire', skill_id: 'sk-fs-dp-paperlog', status: 'first_approved', proposed_by: 'p-training-mgr', role: 'training_manager',
      proposal: { replaced_by: 'sk-fs-dp-rounds' },
      rationale: 'Digital operator rounds replace paper log sheets in the rollout plan; keep the skill readable but stop developing it.',
      development: 'No new development: the digital rounds course covers the replacement skill.', assessment: 'No new assessment: digital rounds are observed on the new tablets.',
      votes: [['p-chco', 'hr_director', 'approve', 'Agreed with the rollout plan; the replacement is live.', '2026-10-06']] },
    { on: '2026-10-05', kind: 'relevel', skill_id: 'sk-fs-cy-report', status: 'submitted', proposed_by: 'p-head-sq', role: 'manager',
      proposal: { key_level: 2, level_essence_en: 'Practitioner: reports a suspected cyber incident through the right channel without delay, preserves what was seen and briefs the next shift.', level_essence_ar: 'ممارس: يبلّغ عن الحادث السيبراني المشتبه به عبر القناة الصحيحة دون تأخير، ويحفظ ما شوهد ويطلع المناوبة التالية.' },
      rationale: 'Reporting is expected from every shift supervisor at practitioner level, not awareness.',
      development: 'The reporting drill in the yearly cyber hygiene refresher, run by shift.', assessment: 'Observed during the shift reporting drill against the practitioner essence.', votes: [] },
    { on: '2026-10-07', kind: 'add', skill_id: null, status: 'submitted', proposed_by: 'p-k-ro', role: 'licensed_operator',
      proposal: { name_en: 'AI risk awareness for safety-related work', name_ar: 'الوعي بمخاطر الذكاء الاصطناعي في الأعمال المتصلة بالسلامة', description_en: 'Recognises where an AI output could affect safety-related work and stops to confirm with the controlled source.', description_ar: 'يدرك المواضع التي قد يؤثر فيها مخرَج الذكاء الاصطناعي في الأعمال المتصلة بالسلامة ويتوقف للتأكد من المصدر الخاضع للرقابة.',
        area: 'digital', competency_id: 'da-02', fs_area: 'ai_data', key_level: 1, decay_class: 'fast', owner_role: 'digital_ai_governance', source_label: 'European Commission · EU AI Act Article 4 AI-literacy repository', source_url: SRC.ailit.url },
      rationale: 'Operators meet AI summaries in turnover notes; awareness of where they touch safety-related work is not covered by everyday tool use.',
      development: 'The AI-era HU tool cards and the turnover drill, with a safety-culture briefing by shift.', assessment: 'Situation questions in the AI-literacy bank tagged to this skill, separate from tool use and verification.', votes: [] },
    { on: '2026-10-08', kind: 'add', skill_id: null, status: 'first_rejected', proposed_by: 'p-nse', role: 'employee',
      proposal: { name_en: 'Spreadsheet skills', name_ar: 'مهارات جداول البيانات', area: 'digital', competency_id: 'da-01', key_level: 2, source_label: 'European Commission JRC · DigComp, the digital competence framework for citizens', source_url: 'https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en' },
      rationale: 'Procurement uses spreadsheets every day and wants the skill in development plans.',
      development: 'Office tools training from the corporate catalogue.', assessment: 'A practical spreadsheet exercise set by the trainer.',
      votes: [['p-k-admin', 'admin', 'reject', 'Too generic for the nuclear catalogue: covered by Technological literacy (FS-TR-06) and Data engineering basics.', '2026-10-09']] },
  ].map((r) => ({ ...r, target: r.skill_id ? S(r.skill_id) : null }));
}

export default function build() {}

export function finalize(T, ctx) {
  engineCards(T);
  const skills = T.skills;
  const byId = new Map(skills.map((s) => [s.id, s]));
  const comps = T.competencies.map((c) => c.id);
  const reqs = [];
  const changes = [];
  const pad = (n) => String(n).padStart(3, '0');
  const vote = (by, role, decision, note, day, h) => ({ by, role, decision, note, at: ts(day, h) });
  // timeline of published changes: adds per area (FS02 future skills through the council), and the 2026-06-30 retire
  const events = [];
  for (const [area, on, by, first, second, development, assessment] of AREA_PLAN) {
    for (const s of skills.filter((x) => x.fs_area === area && x.id !== 'sk-fs-dp-paperwp').sort((a, b) => a.sort - b.sort)) events.push({ type: 'add', on, s, by, first, second, development, assessment, area });
    if (area === 'digital_plant') events.push({ type: 'retire', on: '2026-06-30', s: byId.get('sk-fs-dp-paperwp'), by: 'p-k-instructor', first: ['p-training-mgr', 'training_manager'], second: ['p-chco', 'hr_director'] });
  }
  const opens = openRequests(byId);
  const all = [...events.map((e) => ({ ...e, sortKey: `${e.on}:${e.type === 'retire' ? 1 : 0}` })), ...opens.map((o) => ({ type: 'open', o, on: o.on, sortKey: `${o.on}:2` }))]
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  let nr = 0, nc = 0;
  for (const e of all) {
    const id = `scr-${pad(++nr)}`;
    if (e.type === 'open') {
      const o = e.o;
      const title = requestTitle(o.kind, o.target, o.proposal);
      const x = { kind: o.kind, skill_id: o.skill_id, proposal: o.proposal, rationale: o.rationale, development: o.development, assessment: o.assessment };
      const votes = o.votes.map(([by, role, decision, note, day], i) => vote(by, role, decision, note, day, 10 + i));
      const final = o.status === 'rejected';
      reqs.push({ id, kind: o.kind, skill_id: o.skill_id, title_en: title.en, title_ar: title.ar, proposal: o.proposal, rationale: o.rationale, development: o.development, assessment: o.assessment,
        inclusion: inclusionChecks(x, skills, comps), status: o.status, proposed_by: o.proposed_by, proposed_role: o.role, proposed_at: ts(o.on, 8),
        votes, first_by: final ? votes[0].by : votes[0]?.by ?? null, first_decision: final ? votes[0].decision : votes[0]?.decision ?? null,
        second_by: final ? votes[1].by : null, decided_at: final ? votes[1].at : null, change_id: null, updated_at: votes.length ? votes[votes.length - 1].at : ts(o.on, 8) });
      continue;
    }
    const s = e.s;
    const proposedOn = minusDays(e.on, 14);
    const firstOn = minusDays(e.on, 7);
    const votes = [vote(e.first[0], e.first[1], 'approve', null, firstOn, 10), vote(e.second[0], e.second[1], 'approve', null, e.on, 11)];
    const cid = `sc-${pad(++nc)}`;
    const impact = changeImpact(e.type);
    const srcs = (Array.isArray(s.sources) ? s.sources : []).filter((x) => /^https:\/\//.test(x.url ?? '')).map((x) => ({ label: x.label ?? '', url: x.url }));
    if (e.type === 'add') {
      const proposal = { name_en: s.name_en, name_ar: s.name_ar, description_en: s.description_en, description_ar: s.description_ar, area: s.area, competency_id: s.competency_id, fs_area: s.fs_area,
        key_level: s.key_level, decay_class: s.decay_class, owner_role: s.owner_role, source_label: srcs[0]?.label ?? '', source_url: srcs[0]?.url ?? '' };
      const title = requestTitle('add', null, proposal);
      // the inclusion rule as it stood when proposed: the skill itself is not yet in the catalogue
      const inc = inclusionChecks({ kind: 'add', skill_id: null, proposal, rationale: RATIONALE[e.area], development: e.development, assessment: e.assessment }, skills.filter((x) => x.id !== s.id), comps);
      if (!inc.every((c) => c.ok)) throw new Error(`fs54: seeded add of ${s.id} fails the inclusion rule: ${inc.filter((c) => !c.ok).map((c) => c.key).join(', ')}`);
      reqs.push({ id, kind: 'add', skill_id: null, title_en: title.en, title_ar: title.ar, proposal, rationale: RATIONALE[e.area], development: e.development, assessment: e.assessment, inclusion: inc,
        status: 'published', proposed_by: e.by, proposed_role: e.by === 'p-sme-reviewer' ? 'employee' : 'instructor', proposed_at: ts(proposedOn, 8), votes, first_by: votes[0].by, first_decision: 'approve',
        second_by: votes[1].by, decided_at: votes[1].at, change_id: cid, updated_at: votes[1].at });
      changes.push({ id: cid, request_id: id, kind: 'add', skill_id: s.id, skill_code: s.code, skill_name_en: s.name_en, skill_name_ar: s.name_ar, summary_en: `Added "${s.name_en}"`, summary_ar: `أُضيفت «${s.name_ar}»`,
        before: {}, after: snapshot(s), version_before: null, version_after: 1, new_skill_ids: [s.id], replaced_by: null, effective_on: e.on, methodology: impact.methodology, dashboards: impact.dashboards,
        decided_roles: [e.first[1], e.second[1]], proposed_role: reqs[reqs.length - 1].proposed_role, published_at: votes[1].at, ledger_seq: null, sources: srcs });
    } else {
      const repl = byId.get(s.replaced_by);
      const proposal = { replaced_by: s.replaced_by };
      const before = { ...s, lifecycle: 'declining', obsolete_on: null, replaced_by: null };
      const title = requestTitle('retire', s, proposal);
      const rationale = 'Electronic work packages replaced paper packages at the end of the rollout; keep the skill readable for history but stop developing it.';
      const development = 'No new development: the digital work management course covers the replacement skill.';
      const assessment = 'No new assessment: electronic work packages are observed on the job.';
      const inc = inclusionChecks({ kind: 'retire', skill_id: s.id, proposal, rationale, development, assessment }, skills.map((x) => (x.id === s.id ? before : x)), comps);
      if (!inc.every((c) => c.ok)) throw new Error(`fs54: seeded retire fails the inclusion rule`);
      reqs.push({ id, kind: 'retire', skill_id: s.id, title_en: title.en, title_ar: title.ar, proposal, rationale, development, assessment, inclusion: inc, status: 'published', proposed_by: e.by, proposed_role: 'instructor',
        proposed_at: ts(proposedOn, 8), votes, first_by: votes[0].by, first_decision: 'approve', second_by: votes[1].by, decided_at: votes[1].at, change_id: cid, updated_at: votes[1].at });
      changes.push({ id: cid, request_id: id, kind: 'retire', skill_id: s.id, skill_code: s.code, skill_name_en: s.name_en, skill_name_ar: s.name_ar,
        summary_en: `Retired "${s.name_en}", replaced by "${repl.name_en}"`, summary_ar: `أُوقفت «${s.name_ar}» وحلّت محلها «${repl.name_ar}»`,
        before: snapshot(before), after: snapshot(s), version_before: s.version, version_after: s.version, new_skill_ids: [], replaced_by: s.replaced_by, effective_on: e.on,
        methodology: impact.methodology, dashboards: impact.dashboards, decided_roles: [e.first[1], e.second[1]], proposed_role: 'instructor', published_at: votes[1].at, ledger_seq: null, sources: srcs });
      if (s.obsolete_on !== e.on || s.lifecycle !== 'obsolete') throw new Error('fs54: the seeded retire must match the catalogue (obsolete on 2026-06-30)');
    }
  }
  T.skill_change_requests = reqs;
  T.skill_changes = changes;

  // FS55: ten weekly ranked-surface fairness snapshots (as kafaa_run_surface_fairness would store them)
  const d = {
    people: T.people, digestRuns: T.digest_runs ?? [], advisorSessions: T.advisor_sessions ?? [], pathwayEnrolments: T.pathway_enrolments ?? [], externalCompletions: T.external_completions ?? [],
    fitnessAttempts: T.fitness_attempts ?? [], opportunities: T.opportunities ?? [], applications: T.opportunity_applications ?? [], twinAttempts: T.twin_attempts ?? [],
    adaptiveAttempts: T.adaptive_attempts ?? [], instructorTracks: T.instructor_tracks ?? [],
  };
  T.surface_fairness = [];
  for (const day of weeklyDates(ctx.DEMO_TODAY, 10))
    for (const r of surfaceSnapshot(d, day)) T.surface_fairness.push({ id: r.id, period: r.period, as_of: r.as_of, card: r.card, metric: r.metric, dimension: r.dimension, group_key: r.group_key,
      n: r.n, positives: r.positives, rate: r.rate, ratio: r.ratio, suppressed: r.suppressed, flagged: r.flagged, source: r.source, run_by: 'p-ai-governance', created_at: `${day}T06:00:00Z` });
  const pub = changes.length, open = reqs.filter((r) => ['submitted', 'first_approved', 'first_rejected'].includes(r.status)).length;
  console.log(`fs54/55: ${T.engine_cards.length} engine cards, ${reqs.length} skill change requests (${open} open), ${pub} published changes, ${T.surface_fairness.length} surface fairness rows`);
}
