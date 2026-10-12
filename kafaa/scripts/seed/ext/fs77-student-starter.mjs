// FS77 (FS wave H · E5, M06) Student future-skills starter and intake baselines seed.
//   starter_lessons    5 AI-literacy lessons + 3 SMR orientation lessons (public). Every fact cites an https source with an as-of
//                      date, taken only from the research packs (docs/kafaa/ref/research/*.md); sources the packs mark secondary,
//                      unverified or that are news reports of someone else's policy carry `secondary: true` and are flagged on the page.
//                      SMR text carries no site, headcount or deployment claim (lessonProblem / starterTextIsClean); no figure is typed
//                      into copy (the UAE-AI, NEA and UK-NUC figures come from kafaa_benchmarks through <BenchmarkChips>).
//   induction_modules  12 induction modules (33.5 h); the five nuclear and company modules are mandatory and never skipped.
//   intake_baselines   versioned HR baselines 2024-2027 (published, superseded and one 2027 draft waiting for HR to publish). The
//                      2026 AI-basics entry is "partly held" because the UAE school AI curriculum started in the 2025-26 academic year.
//   induction_plans    8 synthetic joiners: the DNT graduate persona k-lo-trainee (2026, current baseline), one 2026 direct hire built
//                      on the superseded 2026 v1 (stale: HR rebuilds it), and six offered applicants of the 2027 intake (no published
//                      2027 baseline yet, so the full induction). Plans are computed with inductionPlan() (the same rule as SQL).
// Synthetic people only (existing p-k-*, w-*, ap-*, a-* rows); no real names. Seeded rows write no notification, so the F36 digests are unchanged.
import { baselineFor, baselineId, cleanEntries, inductionPlan, lessonProblem, planId } from '../../../src/modules/m06/starter.ts';

const READ = '2026-10-10';
const S = {
  unesco: { label: 'UNESCO · AI competency framework for students (2024), summary via the GCED Clearinghouse', url: 'https://gcedclearinghouse.org/en/node/146447', publisher: 'UNESCO', as_of: READ, secondary: true },
  euRepo: { label: 'European Commission · Living repository of AI literacy practices (AI Act Article 4)', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices', publisher: 'European Commission', as_of: READ },
  curriculum: { label: 'Middle East AI News · UAE moves to embed AI learning across the entire school system (2025)', url: 'https://www.middleeastainews.com/p/uae-rolls-out-ai-school-curriculum', publisher: 'Middle East AI News', as_of: READ, secondary: true },
  dge: { label: 'Abu Dhabi Department of Government Enablement · What we do', url: 'https://dge.gov.ae/en/what-we-do', publisher: 'DGE Abu Dhabi', as_of: READ },
  ainative: { label: 'Khaleej Times · Abu Dhabi to train government employees in AI by 2027 (AiNative)', url: 'https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027', publisher: 'Khaleej Times', as_of: READ, secondary: true },
  iaeaAi: { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence (2025)', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence', publisher: 'IAEA', as_of: READ, secondary: true },
  gev: { label: 'GE Vernova · GE Vernova Hitachi SMR engineering and service centre, Ontario (June 2025)', url: 'https://www.gevernova.com/news/press-releases/ge-vernova-hitachi-nuclear-energy-canada-small-modular-reactor-engineering-service-centre-ontario', publisher: 'GE Vernova', as_of: READ, secondary: true },
  ans: { label: 'ANS Nuclear Newswire · Education and training to support Canadian nuclear workforce development (26 Nov 2025)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/', publisher: 'American Nuclear Society', as_of: READ, secondary: true },
  e2: { label: 'Oregon State University · NuScale Energy Exploration (E2) Center', url: 'https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center', publisher: 'Oregon State University', as_of: READ, secondary: true },
  nea: { label: 'OECD-NEA · Plan 2035 vision paper: Scaling Technology, Growing Careers, Securing the Future (Oct 2025)', url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf', publisher: 'OECD Nuclear Energy Agency', as_of: READ },
};
const P = (en, ar) => ({ en, ar });
const C = (prompt_en, prompt_ar, options, correct, explain_en, explain_ar) => ({ prompt_en, prompt_ar, options: options.map(([en, ar]) => ({ en, ar })), correct, explain_en, explain_ar });
const K = (to, label_en, label_ar) => ({ to, label_en, label_ar });
const LADDER = K('/learn/ai-fluency', 'See the AI Fluency Ladder', 'اطّلع على سلّم الطلاقة في الذكاء الاصطناعي');
const NEXTGEN = K('/careers/next-gen', 'What changes for each Barakah role (next-generation careers)', 'ما الذي يتغير في كل وظيفة في براكة (وظائف الجيل القادم)');

export const LESSONS = [
  {
    id: 'sl-ai-what', track: 'ai', sort: 1, induction_module_id: 'ind-ai-basics',
    title_en: 'What AI is, and what it is not', title_ar: 'ما هو الذكاء الاصطناعي، وما ليس هو',
    summary_en: 'AI tools find patterns in large amounts of data and use them to predict, sort or write. They do not understand the world the way people do, and they can be confidently wrong.',
    summary_ar: 'تكتشف أدوات الذكاء الاصطناعي الأنماط في كميات كبيرة من البيانات وتستخدمها للتنبؤ أو التصنيف أو الكتابة. لكنها لا تفهم العالم كما يفهمه الناس، وقد تخطئ وهي واثقة.',
    points: [
      P('AI learns patterns from examples, so a situation that looks new can confuse it.', 'يتعلم الذكاء الاصطناعي الأنماط من الأمثلة، لذلك قد يرتبك أمام موقف يبدو جديداً.'),
      P('Generative AI writes text and makes images by predicting what usually comes next.', 'يكتب الذكاء الاصطناعي التوليدي النصوص وينشئ الصور بالتنبؤ بما يأتي عادةً بعد ذلك.'),
      P('A person stays responsible for every decision that uses an AI output.', 'يبقى الإنسان مسؤولاً عن كل قرار يستخدم ناتج الذكاء الاصطناعي.'),
    ],
    self_check: C('A chatbot gives you a confident answer about a plant procedure. What do you do?', 'يعطيك روبوت محادثة إجابة واثقة عن إجراء في المحطة. ماذا تفعل؟', [
      ['Use it: AI answers are checked before you see them', 'أستخدمها: إجابات الذكاء الاصطناعي تُراجع قبل أن أراها'],
      ['Check it against the approved procedure and ask a qualified person', 'أتحقق منها مقابل الإجراء المعتمد وأسأل شخصاً مؤهلاً'],
      ['Stop using every AI tool', 'أتوقف عن استخدام كل أدوات الذكاء الاصطناعي'],
    ], 1, 'AI can be confidently wrong. In a nuclear plant the approved procedure and qualified people decide; AI only helps.', 'قد يخطئ الذكاء الاصطناعي وهو واثق. في المحطة النووية يقرر الإجراء المعتمد والأشخاص المؤهلون؛ والذكاء الاصطناعي يساعد فقط.'),
    links: [LADDER], sources: [S.unesco, S.iaeaAi],
  },
  {
    id: 'sl-ai-check', track: 'ai', sort: 2, induction_module_id: 'ind-ai-responsible',
    title_en: 'Checking what AI tells you', title_ar: 'التحقق مما يخبرك به الذكاء الاصطناعي',
    summary_en: 'Good AI users check an output before they use it: they look for the source, compare it with what they know and ask when they are unsure.',
    summary_ar: 'يتحقق المستخدم الجيد للذكاء الاصطناعي من الناتج قبل استخدامه: يبحث عن المصدر، ويقارنه بما يعرفه، ويسأل عندما لا يكون متأكداً.',
    points: [
      P('Ask where a fact comes from, then open the source yourself.', 'اسأل من أين جاءت المعلومة، ثم افتح المصدر بنفسك.'),
      P('Compare the answer with an approved document or an expert.', 'قارن الإجابة بوثيقة معتمدة أو بخبير.'),
      P('Say clearly when AI helped with your work.', 'وضّح متى ساعدك الذكاء الاصطناعي في عملك.'),
    ],
    self_check: C('Which habit makes AI use safer?', 'أي عادة تجعل استخدام الذكاء الاصطناعي أكثر أماناً؟', [
      ['Copying the first answer', 'نسخ الإجابة الأولى'],
      ['Checking the answer against a trusted source', 'التحقق من الإجابة مقابل مصدر موثوق'],
      ['Asking again until the answer sounds right', 'إعادة السؤال حتى تبدو الإجابة صحيحة'],
    ], 1, 'A trusted source is the check; asking again only gives you another prediction.', 'المصدر الموثوق هو أداة التحقق؛ أما إعادة السؤال فتعطيك تنبؤاً آخر فقط.'),
    links: [LADDER], sources: [S.euRepo, S.unesco],
  },
  {
    id: 'sl-ai-fair', track: 'ai', sort: 3, induction_module_id: 'ind-ai-responsible',
    title_en: 'Fairness, privacy and your data', title_ar: 'العدالة والخصوصية وبياناتك',
    summary_en: 'AI systems can repeat unfair patterns from their training data, and anything you type into a public tool may leave your control.',
    summary_ar: 'قد تكرر أنظمة الذكاء الاصطناعي أنماطاً غير عادلة من بيانات تدريبها، وأي شيء تكتبه في أداة عامة قد يخرج عن سيطرتك.',
    points: [
      P('Never paste personal, confidential or security information into a public AI tool.', 'لا تلصق أبداً معلومات شخصية أو سرية أو أمنية في أداة ذكاء اصطناعي عامة.'),
      P('Results can be biased when the training data were unbalanced.', 'قد تكون النتائج متحيزة عندما تكون بيانات التدريب غير متوازنة.'),
      P('Respect other people\'s work and say what you used.', 'احترم عمل الآخرين ووضّح ما استخدمته.'),
    ],
    self_check: C('You want an AI tool to summarise a document that lists people\'s names and ID numbers. What is right?', 'تريد من أداة ذكاء اصطناعي تلخيص وثيقة فيها أسماء أشخاص وأرقام هوياتهم. ما التصرف الصحيح؟', [
      ['Paste it into any free chatbot', 'ألصقها في أي روبوت محادثة مجاني'],
      ['Remove the personal data or use an approved tool, and ask first', 'أحذف البيانات الشخصية أو أستخدم أداة معتمدة، وأسأل أولاً'],
      ['Ask a friend to paste it for you', 'أطلب من صديق أن يلصقها بدلاً مني'],
    ], 1, 'Personal data stays protected: remove it, or use a tool your organisation has approved for it.', 'تبقى البيانات الشخصية محمية: احذفها، أو استخدم أداة اعتمدتها مؤسستك لهذا الغرض.'),
    links: [LADDER], sources: [S.unesco, S.euRepo],
  },
  {
    id: 'sl-ai-uae', track: 'ai', sort: 4, induction_module_id: 'ind-ai-basics',
    title_en: 'Learning AI in the UAE', title_ar: 'تعلّم الذكاء الاصطناعي في الإمارات',
    summary_en: 'The UAE treats AI literacy as national policy: the National AI Strategy 2031, AI inside the school curriculum from the 2025-26 academic year, and practical AI training for government employees in Abu Dhabi (AiNative).',
    summary_ar: 'تتعامل الإمارات مع الإلمام بالذكاء الاصطناعي كسياسة وطنية: الاستراتيجية الوطنية للذكاء الاصطناعي 2031، والذكاء الاصطناعي ضمن المنهج المدرسي منذ العام الدراسي 2025-2026، والتدريب العملي لموظفي حكومة أبوظبي (برنامج AiNative).',
    points: [
      P('AI is taught in UAE schools from the 2025-26 academic year, inside existing lessons.', 'يُدرَّس الذكاء الاصطناعي في مدارس الإمارات منذ العام الدراسي 2025-2026 ضمن الحصص القائمة.'),
      P('Abu Dhabi\'s Department of Government Enablement runs AiNative, practical AI training for government employees.', 'تدير دائرة التمكين الحكومي في أبوظبي برنامج AiNative للتدريب العملي على الذكاء الاصطناعي لموظفي الحكومة.'),
      P('Because school leavers now learn AI basics, ENEC\'s induction can skip what a new intake already knows.', 'لأن خريجي المدارس يتعلمون الآن أساسيات الذكاء الاصطناعي، يمكن لبرنامج التهيئة في ENEC تخطي ما تعرفه الدفعة الجديدة مسبقاً.'),
    ],
    self_check: C('Why does Kafa\'a keep induction baselines by intake year?', 'لماذا تحتفظ كفاءة بخطوط أساس للتهيئة حسب سنة الالتحاق؟', [
      ['To compare new joiners with each other', 'لمقارنة المنضمين الجدد ببعضهم'],
      ['So induction does not re-teach what an intake already learned at school or university', 'حتى لا تعيد التهيئة تدريس ما تعلمته الدفعة في المدرسة أو الجامعة'],
      ['To decide who gets a job', 'لتحديد من يحصل على الوظيفة'],
    ], 1, 'Baselines describe a whole intake, never one person, and they only shorten induction: nobody is compared or selected by them.', 'تصف خطوط الأساس دفعة كاملة وليس شخصاً واحداً، وهي تختصر التهيئة فقط: لا يُقارَن أحد ولا يُختار بناءً عليها.'),
    links: [LADDER], sources: [S.curriculum, S.dge, S.ainative],
  },
  {
    id: 'sl-ai-plant', track: 'ai', sort: 5, induction_module_id: 'ind-ai-enec',
    title_en: 'AI at a nuclear plant: people stay in charge', title_ar: 'الذكاء الاصطناعي في المحطة النووية: يبقى الإنسان صاحب القرار',
    summary_en: 'Nuclear operators use AI and digital twins to analyse plant data, for example to spot equipment that may need maintenance. Qualified people still make the safety decisions.',
    summary_ar: 'يستخدم مشغلو المحطات النووية الذكاء الاصطناعي والتوائم الرقمية لتحليل بيانات المحطة، مثل رصد المعدات التي قد تحتاج إلى صيانة. ويبقى الأشخاص المؤهلون أصحاب قرارات السلامة.',
    points: [
      P('A digital twin is a computer copy of real equipment that helps analyse plant data.', 'التوأم الرقمي نسخة حاسوبية من معدات حقيقية تساعد على تحليل بيانات المحطة.'),
      P('Predictive maintenance uses data to plan work before a part fails.', 'تستخدم الصيانة التنبؤية البيانات لتخطيط العمل قبل أن يتعطل الجزء.'),
      P('Safety-related decisions always need qualified human review.', 'تحتاج القرارات المتعلقة بالسلامة دائماً إلى مراجعة بشرية مؤهلة.'),
    ],
    self_check: C('An AI tool flags a possible problem with a pump. Who decides what to do?', 'تنبّه أداة ذكاء اصطناعي إلى مشكلة محتملة في مضخة. من يقرر ما يجب فعله؟', [
      ['The AI tool', 'أداة الذكاء الاصطناعي'],
      ['Qualified people, using the AI alert as one input', 'الأشخاص المؤهلون، مع اعتبار تنبيه الذكاء الاصطناعي أحد المدخلات'],
      ['Whoever sees the alert first', 'أول من يرى التنبيه'],
    ], 1, 'The alert is information. Qualified people check it and decide, following procedures.', 'التنبيه معلومة. يتحقق منها الأشخاص المؤهلون ويقررون وفق الإجراءات.'),
    links: [LADDER], sources: [S.iaeaAi],
  },
  {
    id: 'sl-smr-what', track: 'smr', sort: 6, induction_module_id: 'ind-smr',
    title_en: 'What is a small modular reactor?', title_ar: 'ما هو المفاعل النمطي الصغير؟',
    summary_en: 'Small modular reactors (SMRs) are smaller nuclear power units designed around factory-made modules. Several designs exist, and countries such as Canada are already training people for them.',
    summary_ar: 'المفاعلات النمطية الصغيرة وحدات أصغر لتوليد الطاقة النووية تقوم على وحدات تُصنع في المصانع. توجد عدة تصاميم منها، وتدرّب دول مثل كندا الكوادر عليها منذ الآن.',
    points: [
      P('Main parts are built in a factory as modules, then assembled.', 'تُصنع الأجزاء الرئيسية في المصنع على شكل وحدات، ثم تُجمَّع.'),
      P('In Canada, GE Vernova Hitachi opened an SMR engineering and service centre in Ontario that includes training.', 'في كندا، افتتحت شركة جي إي فيرنوفا هيتاشي مركزاً لهندسة وخدمات المفاعلات النمطية الصغيرة في أونتاريو يشمل التدريب.'),
      P('University simulators let students act as control-room operators of a multi-unit SMR plant (NuScale E2 Centers).', 'تتيح أجهزة المحاكاة في الجامعات للطلاب أداء دور مشغلي غرفة التحكم في محطة متعددة الوحدات (مراكز E2 من نيوسكيل).'),
    ],
    self_check: C('What does "modular" mean in small modular reactor?', 'ماذا تعني كلمة "النمطي" في المفاعل النمطي الصغير؟', [
      ['Main parts are built in a factory as modules', 'تُصنع الأجزاء الرئيسية في المصنع على شكل وحدات'],
      ['The reactor is moved every week', 'يُنقل المفاعل كل أسبوع'],
      ['It makes heat but never electricity', 'ينتج الحرارة ولا ينتج الكهرباء أبداً'],
    ], 0, 'Modular means factory-built modules. This is a learning topic only: no deployment decision is implied.', 'النمطي يعني وحدات مصنّعة في المصنع. هذا موضوع للتعلم فقط: لا يعني أي قرار بالنشر.'),
    links: [NEXTGEN], sources: [S.gev, S.e2, S.ans],
  },
  {
    id: 'sl-smr-skills', track: 'smr', sort: 7, induction_module_id: 'ind-smr',
    title_en: 'What changes, and what stays the same', title_ar: 'ما الذي يتغير، وما الذي يبقى كما هو',
    summary_en: 'Most Barakah skills carry over to newer reactor designs: safety culture, procedures, radiation protection and plant fundamentals. What changes is mainly running several units, digital controls, passive safety features and maintenance.',
    summary_ar: 'تنتقل معظم مهارات براكة إلى تصاميم المفاعلات الأحدث: ثقافة السلامة والإجراءات والوقاية من الإشعاع وأساسيات المحطة. وما يتغير أساساً هو تشغيل عدة وحدات والتحكم الرقمي وخصائص السلامة الذاتية والصيانة.',
    points: [
      P('Carries over: safety culture, procedure use, radiation protection and plant fundamentals.', 'ينتقل كما هو: ثقافة السلامة واستخدام الإجراءات والوقاية من الإشعاع وأساسيات المحطة.'),
      P('Changes: multi-unit operation, digital instrumentation and control, passive safety and different maintenance regimes.', 'يتغير: تشغيل عدة وحدات، والأجهزة والتحكم الرقمي، والسلامة الذاتية، وأنظمة صيانة مختلفة.'),
      P('Every Barakah role has its own change summary on the next-generation careers page.', 'لكل وظيفة في براكة ملخص للتغيير في صفحة وظائف الجيل القادم.'),
    ],
    self_check: C('Which of these carries over from Barakah to a newer reactor design?', 'أي مما يلي ينتقل من براكة إلى تصميم مفاعل أحدث؟', [
      ['Safety culture and procedure use', 'ثقافة السلامة واستخدام الإجراءات'],
      ['The exact control-room layout', 'التصميم الدقيق لغرفة التحكم'],
      ['The same maintenance schedule', 'جدول الصيانة نفسه'],
    ], 0, 'Safety culture and procedure use travel with you; layouts and maintenance regimes change with the design.', 'ثقافة السلامة واستخدام الإجراءات ترافقك دائماً؛ أما التصاميم وأنظمة الصيانة فتتغير بتغير التصميم.'),
    links: [NEXTGEN], sources: [S.ans, S.gev],
  },
  {
    id: 'sl-smr-careers', track: 'smr', sort: 8, induction_module_id: 'ind-smr',
    title_en: 'Nuclear careers from school to young professional', title_ar: 'المسار المهني النووي من المدرسة إلى المهني الشاب',
    summary_en: 'The OECD Nuclear Energy Agency\'s Plan 2035 aims to grow the nuclear workforce from secondary school through trade school and university to young professionals, with three pathways: Inspire, Mentor and Network.',
    summary_ar: 'تهدف خطة 2035 لوكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية إلى تنمية القوى العاملة النووية من المدرسة الثانوية مروراً بالتعليم المهني والجامعة وصولاً إلى المهنيين الشباب، عبر ثلاثة مسارات: الإلهام والإرشاد والتواصل.',
    points: [
      P('Inspire: outreach resources and video lectures for schools.', 'الإلهام: موارد توعوية ومحاضرات مصورة للمدارس.'),
      P('Mentor: mentoring workshops and a global internship programme.', 'الإرشاد: ورش إرشاد وبرنامج عالمي للتدريب الداخلي.'),
      P('Network: role models, educators and alumni of young-talent programmes.', 'التواصل: قدوات ومعلمون وخريجو برامج المواهب الشابة.'),
    ],
    self_check: C('Which Plan 2035 pathway is about reaching schools?', 'أي مسار في خطة 2035 يهتم بالوصول إلى المدارس؟', [
      ['Inspire', 'الإلهام'], ['Mentor', 'الإرشاد'], ['Network', 'التواصل'],
    ], 0, 'Inspire is the outreach pathway: exhibits, online resources and lectures for schools.', 'الإلهام هو مسار التوعية: المعارض والموارد الإلكترونية والمحاضرات للمدارس.'),
    links: [NEXTGEN, K('/pathways/journey', 'Back to your journey board', 'العودة إلى لوحة رحلتك')], sources: [S.nea],
  },
];

const M = (id, sort, area, hours, refresh_hours, mandatory, title_en, title_ar, summary_en, summary_ar, skill_ids = []) =>
  ({ id, sort, area, hours, refresh_hours, mandatory, title_en, title_ar, summary_en, summary_ar, skill_ids, listed: true });
export const MODULES = [
  M('ind-ai-basics', 1, 'ai', 3, 1, false, 'AI basics: what AI is and is not', 'أساسيات الذكاء الاصطناعي: ما هو وما ليس هو',
    'Patterns, predictions and limits of AI tools, with plant examples.', 'الأنماط والتنبؤات وحدود أدوات الذكاء الاصطناعي، مع أمثلة من المحطة.', ['sk-fs-ai-use']),
  M('ind-ai-responsible', 2, 'ai', 2, 1, false, 'Responsible AI: checking outputs, bias and privacy', 'الذكاء الاصطناعي المسؤول: التحقق من النواتج والتحيز والخصوصية',
    'Verify before use, protect personal data, recognise bias.', 'تحقق قبل الاستخدام، واحمِ البيانات الشخصية، وتعرّف على التحيز.', ['sk-fs-ai-verify', 'sk-fs-ai-data-care']),
  M('ind-ai-enec', 3, 'ai', 1.5, 0, true, 'AI at ENEC: approved tools and the human check', 'الذكاء الاصطناعي في ENEC: الأدوات المعتمدة والمراجعة البشرية',
    'Which tools are approved for which tasks, and the rule that a qualified person checks every AI output. Always taught: it is ENEC-specific.', 'أي الأدوات معتمدة لأي المهام، وقاعدة أن يراجع شخص مؤهل كل ناتج للذكاء الاصطناعي. يُدرَّس دائماً لأنه خاص بـ ENEC.', ['sk-fs-ai-use', 'sk-fs-ai-verify']),
  M('ind-digital', 4, 'digital', 3, 1, false, 'Digital essentials: files, collaboration and records', 'الأساسيات الرقمية: الملفات والتعاون والسجلات',
    'Working with shared files, collaboration tools and controlled records.', 'العمل بالملفات المشتركة وأدوات التعاون والسجلات المضبوطة.', ['sk-fs-tr-techlit']),
  M('ind-data', 5, 'digital', 2, 1, false, 'Reading data: trends, charts and dashboards', 'قراءة البيانات: الاتجاهات والرسوم البيانية ولوحات المعلومات',
    'Reading a trend, spotting an outlier and asking where the data came from.', 'قراءة الاتجاه، ورصد القيمة الشاذة، والسؤال عن مصدر البيانات.', ['sk-fs-ai-plantdata']),
  M('ind-cyber', 6, 'cyber', 1.5, 0, true, 'Cyber hygiene awareness', 'التوعية بالنظافة السيبرانية',
    'Phishing, passwords, removable media and how to report. All-staff awareness; always taught.', 'التصيد الاحتيالي وكلمات المرور ووسائط التخزين القابلة للإزالة وطريقة الإبلاغ. توعية لجميع الموظفين؛ تُدرَّس دائماً.', ['sk-fs-cy-phishing', 'sk-fs-cy-media', 'sk-fs-cy-report']),
  M('ind-energy', 7, 'energy', 4, 1.5, false, 'Energy and nuclear basics: from fission to the grid', 'أساسيات الطاقة والطاقة النووية: من الانشطار إلى الشبكة',
    'How fission makes heat, heat makes steam and steam makes electricity.', 'كيف ينتج الانشطار الحرارة، وتنتج الحرارة البخار، وينتج البخار الكهرباء.'),
  M('ind-smr', 8, 'smr', 1.5, 0.5, false, 'Next-generation reactors orientation', 'التعريف بمفاعلات الجيل القادم',
    'What small modular and advanced reactors would change and keep. Planning view: no deployment decision implied.', 'ما الذي ستغيره المفاعلات النمطية الصغيرة والمتقدمة وما الذي ستبقيه. رؤية تخطيطية: لا يعني أي قرار بالنشر.', ['sk-fs-adv-smr']),
  M('ind-safety-culture', 9, 'safety', 6, 0, true, 'Nuclear safety culture and human performance tools', 'ثقافة السلامة النووية وأدوات الأداء البشري',
    'Questioning attitude, conservative decisions and the human performance tools. Mandatory for every joiner.', 'الموقف التساؤلي والقرارات المتحفظة وأدوات الأداء البشري. إلزامي لكل منضم جديد.'),
  M('ind-radiation', 10, 'radiation', 4, 0, true, 'Radiation protection basics', 'أساسيات الوقاية من الإشعاع',
    'Dose, time, distance and shielding, and the rules in controlled areas. Mandatory.', 'الجرعة والزمن والمسافة والتدريع، والقواعد في المناطق المراقبة. إلزامي.'),
  M('ind-site', 11, 'site', 3, 0, true, 'Site induction', 'التعريف بالموقع',
    'The site induction every joiner completes before plant work. Mandatory.', 'التعريف بالموقع الذي يكمله كل منضم قبل العمل في المحطة. إلزامي.'),
  M('ind-company', 12, 'company', 2, 0, true, 'ENEC, Barakah and the UAE peaceful nuclear programme', 'ENEC وبراكة والبرنامج النووي السلمي الإماراتي',
    'Who we are, how the organisation works and where to get help. Always taught.', 'من نحن، وكيف تعمل المؤسسة، وأين تجد المساعدة. يُدرَّس دائماً.'),
];

const E = (module_id, status, basis, note_en = '', note_ar = '', source_url = null) => ({ module_id, status, basis, source_url, note_en, note_ar });
const CURRICULUM = S.curriculum.url;
const DIAG = (y) => [`Intake diagnostic of the ${y} intake (synthetic summary).`, `التشخيص عند الالتحاق لدفعة ${y} (ملخص تجريبي).`];
const B = (year, programme, version, status, entries, set_by, set_at, published_by, published_at, note_en, note_ar) => ({
  id: baselineId(year, programme, version), intake_year: year, programme, version, status, entries, note_en, note_ar, set_by, set_at,
  published_by, published_at, listed: status === 'published', sample: true,
});
const BASELINES_RAW = [
  B(2024, 'all', 1, 'published', [E('ind-digital', 'partial', 'intake_diagnostic', ...DIAG(2023))], 'p-chco', '2024-02-12T09:00:00Z', 'p-chco', '2024-02-12T09:00:00Z',
    'First intake baseline: most joiners already used shared files and collaboration tools.', 'أول خط أساس للالتحاق: استخدم معظم المنضمين الملفات المشتركة وأدوات التعاون من قبل.'),
  B(2025, 'all', 1, 'superseded', [E('ind-digital', 'held', 'intake_diagnostic', ...DIAG(2024))], 'p-k-hr-analyst', '2025-01-20T09:00:00Z', 'p-chco', '2025-01-22T09:00:00Z', '', ''),
  B(2025, 'all', 2, 'published', [E('ind-digital', 'held', 'intake_diagnostic', ...DIAG(2024)), E('ind-data', 'partial', 'intake_diagnostic', ...DIAG(2024))], 'p-k-hr-analyst', '2025-03-03T09:00:00Z', 'p-chco', '2025-03-04T09:00:00Z',
    'Data reading added after the 2024 diagnostic.', 'أُضيفت قراءة البيانات بعد تشخيص 2024.'),
  B(2026, 'all', 1, 'superseded', [E('ind-digital', 'held', 'intake_diagnostic', ...DIAG(2025)), E('ind-data', 'partial', 'intake_diagnostic', ...DIAG(2025))], 'p-k-hr-analyst', '2026-01-15T09:00:00Z', 'p-chco', '2026-01-18T09:00:00Z', '', ''),
  B(2026, 'all', 2, 'published', [
    E('ind-ai-basics', 'partial', 'national_curriculum', 'UAE schools teach AI from the 2025-26 academic year: 2026 school leavers had one year of it.', 'تُدرّس مدارس الإمارات الذكاء الاصطناعي منذ العام الدراسي 2025-2026: درسه خريجو المدارس لعام 2026 لمدة عام واحد.', CURRICULUM),
    E('ind-ai-responsible', 'not_held', 'none'),
    E('ind-digital', 'held', 'intake_diagnostic', ...DIAG(2025)),
    E('ind-data', 'partial', 'intake_diagnostic', ...DIAG(2025)),
    E('ind-energy', 'not_held', 'none'),
    E('ind-smr', 'not_held', 'none'),
  ], 'p-k-hr-analyst', '2026-05-10T09:00:00Z', 'p-chco', '2026-05-12T09:00:00Z',
    'AI basics shortened to a refresher once the school AI curriculum reached the 2026 school leavers.', 'اختُصرت أساسيات الذكاء الاصطناعي إلى جلسة تذكيرية بعد أن وصل منهج الذكاء الاصطناعي المدرسي إلى خريجي 2026.'),
  B(2026, 'gdp', 1, 'published', [
    E('ind-ai-basics', 'partial', 'programme_curriculum', 'Most graduates took an AI or data course at university (intake diagnostic, synthetic).', 'درس معظم الخريجين مقرراً في الذكاء الاصطناعي أو البيانات في الجامعة (تشخيص تجريبي).'),
    E('ind-digital', 'held', 'programme_curriculum', 'Degree coursework (synthetic summary).', 'مقررات الدرجة الجامعية (ملخص تجريبي).'),
    E('ind-data', 'held', 'programme_curriculum', 'Degree coursework (synthetic summary).', 'مقررات الدرجة الجامعية (ملخص تجريبي).'),
  ], 'p-k-hr-analyst', '2026-05-10T10:00:00Z', 'p-chco', '2026-05-12T10:00:00Z', 'Graduate Development Program intake: degree coursework covers the digital modules.', 'دفعة برنامج تطوير الخريجين: تغطي مقررات الدرجة الجامعية الوحدات الرقمية.'),
  B(2027, 'all', 1, 'draft', [
    E('ind-ai-basics', 'held', 'national_curriculum', 'Two school years of the UAE AI curriculum (from 2025-26); to be confirmed by the 2027 intake diagnostic.', 'عامان دراسيان من منهج الذكاء الاصطناعي في الإمارات (منذ 2025-2026)؛ يُؤكَّد بتشخيص دفعة 2027.', CURRICULUM),
    E('ind-ai-responsible', 'partial', 'national_curriculum', 'The school curriculum covers ethics and responsible use.', 'يغطي المنهج المدرسي الأخلاقيات والاستخدام المسؤول.', CURRICULUM),
    E('ind-digital', 'held', 'intake_diagnostic', ...DIAG(2026)),
    E('ind-data', 'partial', 'intake_diagnostic', ...DIAG(2026)),
  ], 'p-k-hr-analyst', '2026-10-05T09:00:00Z', null, null, 'Draft for the 2027 intake, waiting for HR to publish.', 'مسودة لدفعة 2027 بانتظار نشرها من الموارد البشرية.'),
];

export default function build(T) {
  for (const l of LESSONS) {
    const bad = lessonProblem({ ...l, as_of: READ });
    if (bad) throw new Error(`fs77: lesson ${l.id}: ${bad}`);
  }
  T.starter_lessons = LESSONS.map((l) => ({ ...l, as_of: READ, listed: true }));
  T.induction_modules = MODULES.map((m) => ({ ...m }));
  const baselines = BASELINES_RAW.map((b) => ({ ...b, entries: cleanEntries(b.entries, MODULES) }));
  T.intake_baselines = baselines;

  const people = new Map(T.people.map((p) => [p.id, p]));
  const byId = new Map(baselines.map((b) => [b.id, b]));
  // [person, programme, intake year, baseline used (null = whatever baselineFor gave at build time), built by, built at]
  const JOINERS = [
    ['p-k-lo-trainee', 'dnt', 2026, 'current', 'p-chco', '2026-06-25T09:00:00Z'],
    ['w-lo-10', 'direct', 2026, 'ib-2026-all-v1', 'p-k-hr-analyst', '2026-03-02T09:00:00Z'],
    ['ap-054', 'dnt', 2027, 'current', 'p-k-hr-analyst', '2026-09-01T09:00:00Z'],
    ['ap-055', 'dnt', 2027, 'current', 'p-k-hr-analyst', '2026-09-01T09:00:00Z'],
    ['ap-056', 'dnt', 2027, 'current', 'p-k-hr-analyst', '2026-09-01T09:00:00Z'],
    ['ap-057', 'dnt', 2027, 'current', 'p-k-hr-analyst', '2026-09-01T09:00:00Z'],
    ['ap-127', 'gdp', 2027, 'current', 'p-k-hr-analyst', '2026-08-20T09:00:00Z'],
    ['a-05', 'gdp', 2027, 'current', 'p-chco', '2026-10-07T09:00:00Z'],
  ];
  T.induction_plans = JOINERS.map(([pid, programme, year, used, by, at]) => {
    const person = people.get(pid);
    if (!person) throw new Error(`fs77: unknown joiner ${pid}`);
    const base = used === 'current' ? baselineFor(baselines, year, programme) : byId.get(used);
    const plan = inductionPlan(MODULES, base ?? null);
    return {
      id: planId(pid), person_id: pid, person_name: person.display_name, programme, intake_year: year, baseline_id: plan.baseline_id, baseline_version: plan.baseline_version,
      items: plan.items, hours_total: plan.hours_total, hours_planned: plan.hours_planned, hours_saved: plan.hours_saved, revision: 1, built_by: by, built_at: at, sample: true,
    };
  });
}
