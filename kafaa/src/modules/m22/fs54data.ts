/**
 * FS46-FS48 (wave E · E4, M22) reference content, import-free (the seed builder scripts/seed/ext/fs46-future-leadership.mjs and
 * the PGlite validator load it in node). Rows land in kafaa_leadership_behaviours, kafaa_fl_competencies, kafaa_fl_external,
 * kafaa_fl_cohorts, kafaa_wfn_programmes, kafaa_wfn_circles and kafaa_wfn_offers. External facts, dates and URLs come only from
 * docs/kafaa/ref/research/nuclear_energy.md and global_frameworks.md (retrieved 2026-10-10, flagged [secondary] there); nothing
 * here is a regulatory statement, and concept offers are marked as concepts.
 */
export const FS54_AS_OF = '2026-10-10';
type Bi = { en: string; ar: string };
type Src = { label: string; url: string; as_of: string; precision?: 'secondary' };
const sec = (label: string, url: string): Src => ({ label, url, as_of: FS54_AS_OF, precision: 'secondary' });

// ───────────────────────────── sources (research packs)
export const SRC = {
  greencomp: { label: 'EU JRC · GreenComp (with EntreComp and LifeComp)', url: 'https://joint-research-centre.ec.europa.eu/greencomp', as_of: FS54_AS_OF } as Src,
  wef: { label: 'WEF · Future of Jobs Report 2025, skills outlook', url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/', as_of: FS54_AS_OF } as Src,
  nea2035: { label: 'OECD-NEA · Plan 2035 vision paper (NEST)', url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf', as_of: FS54_AS_OF } as Src,
  iaeaAi: { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence', as_of: FS54_AS_OF } as Src,
  neaNextgen: sec('OECD-NEA · NextGen Nuclear Leaders Summer School 2026, final programme (PDF)', 'https://oecd-nea.org/upload/docs/application/pdf/2026-07/nextgen_nuclear_leaders_summer_school_2026_final_programme.pdf'),
  inma: sec('IAEA · International Nuclear Management Academy (INMA)', 'https://www.iaea.org/node/17745'),
  sofia: sec('Sofia University · INMA endorsement (early 2025)', 'https://phys.uni-sofia.bg/?p=28612'),
  mephi: sec('MEPhI · nuclear technology management graduates', 'https://eng.mephi.ru/news/120165'),
  ansCanada: sec('ANS Nuclear Newswire · Education and training to support the Canadian nuclear workforce (26 Nov 2025)', 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/'),
  enen: sec('CORDIS · ENEN2plus project 101061677', 'https://cordis.europa.eu/project/id/101061677'),
  nntp: sec('Fortum · Nordic Nuclear Trainee Programme', 'https://www.fortum.com/careers/NNTP'),
  kings: sec('ENEC · Emirati students participate in ENEC internship program in South Korea', 'https://www.enec.gov.ae/news/latest-news/emirati-students-participate-in-enec-internship-program-in-south-korea'),
  iaeaWomen: sec('IAEA Annual Report 2023 · In focus: together for more women in nuclear', 'https://www.iaea.org/publications/reports/annual-report/2023/in-focus/together-for-more-women-in-nuclear'),
  iaeaMscfp: sec('IAEA · Marie Sklodowska-Curie Fellowship Programme', 'https://www.iaea.org/node/136445'),
  ansMscfp: sec('ANS Nuclear Newswire · Applications open to women for 2025 IAEA fellowship program (9 Sep 2025)', 'https://www.ans.org/news/2025-09-09/article-7354/applications-open-to-women-for-2025-iaea-fellowship-program/'),
};

// ───────────────────────────── FS46 · leadership behaviours (360 form 2 = the eight form-1 behaviours + four future ones)
export interface BehaviourDef {
  id: string; form_from: 1 | 2; sort: number; trait_id: string | null; benchmark_ids: string[]; sources: Src[];
  title: Bi; short: Bi; statement: Bi; framework: Bi;
  anchors: Record<'1' | '2' | '3' | '4' | '5', Bi>;
  coach: { tips: Bi[]; practice: Bi; watch: Bi };
  links: { to: string; label: Bi }[];
  programme_ids: string[];
}
const A = (a1: Bi, a2: Bi, a3: Bi, a4: Bi, a5: Bi) => ({ '1': a1, '2': a2, '3': a3, '4': a4, '5': a5 });
const b = (en: string, ar: string): Bi => ({ en, ar });
const INPO = (n: number, en: string, ar: string) => b(`INPO 12-012 safety-culture trait ${n}: ${en}`, `سمة ثقافة السلامة ${n} في INPO 12-012: ${ar}`);
const L_CULTURE = { to: '/safety-culture', label: b('Safety culture traits', 'سمات ثقافة السلامة') };
const L_MYCULTURE = { to: '/my/safety-culture', label: b('My safety culture', 'ثقافة السلامة لديّ') };

export const BEHAVIOUR_DEFS: BehaviourDef[] = [
  {
    id: 'b-safety-values', form_from: 1, sort: 10, trait_id: 'trait-4', benchmark_ids: [], sources: [],
    title: b('Safety values and actions', 'قيم السلامة وأفعالها'), short: b('Safety values', 'قيم السلامة'),
    statement: b('Puts nuclear safety first in words and decisions, even under schedule pressure.', 'يضع السلامة النووية أولاً في الأقوال والقرارات حتى تحت ضغط الجدول.'),
    framework: INPO(4, 'leadership safety values and actions', 'قيم السلامة القيادية وأفعالها'),
    anchors: A(
      b('Lets schedule or cost pressure override safety in words or decisions.', 'يسمح لضغط الجدول أو التكلفة بأن يتقدّم على السلامة في الأقوال أو القرارات.'),
      b('Talks about safety but sends mixed signals when the work is behind.', 'يتحدث عن السلامة لكنه يرسل إشارات متضاربة عندما يتأخر العمل.'),
      b('Puts safety first in briefs and decisions, including under schedule pressure.', 'يضع السلامة أولاً في الإحاطات والقرارات، حتى تحت ضغط الجدول.'),
      b('Visibly stops or slows work for safety and explains why to the team.', 'يوقف العمل أو يبطئه علناً من أجل السلامة ويشرح السبب للفريق.'),
      b('Sets the standard across teams; others quote their safety decisions as examples.', 'يضع المعيار عبر الفرق، ويستشهد الآخرون بقراراته المتعلقة بالسلامة كأمثلة.'),
    ),
    coach: {
      tips: [b('Open your next brief with the one thing that must not be traded for time.', 'افتتح إحاطتك القادمة بالأمر الوحيد الذي لا يجوز التنازل عنه مقابل الوقت.'), b('When you slow a job for safety, say so out loud and say why.', 'عندما تبطئ عملاً من أجل السلامة، قل ذلك بصوت مسموع واذكر السبب.')],
      practice: b('This week: ask your team which pressure most often competes with safety, and agree one response.', 'هذا الأسبوع: اسأل فريقك عن أكثر ضغط يتنافس مع السلامة، واتفقوا على استجابة واحدة.'),
      watch: b('Silence under schedule pressure reads as permission.', 'الصمت تحت ضغط الجدول يُفهم كإذن.'),
    },
    links: [L_CULTURE, L_MYCULTURE], programme_ids: [],
  },
  {
    id: 'b-accountability', form_from: 1, sort: 20, trait_id: 'trait-1', benchmark_ids: [], sources: [],
    title: b('Personal accountability', 'المساءلة الشخصية'), short: b('Accountability', 'المساءلة'),
    statement: b('Owns outcomes, follows through and holds the standard for themselves first.', 'يتحمل مسؤولية النتائج ويتابع حتى النهاية ويلتزم بالمعيار بنفسه أولاً.'),
    framework: INPO(1, 'personal accountability', 'المساءلة الشخصية'),
    anchors: A(
      b('Blames others or circumstances when things go wrong.', 'يلوم الآخرين أو الظروف عندما تسوء الأمور.'),
      b('Owns their own tasks but not the outcome for the team.', 'يتحمل مسؤولية مهامه لكن لا يتحمل نتيجة الفريق.'),
      b('Owns outcomes, follows through on commitments and holds themselves to the standard.', 'يتحمل مسؤولية النتائج ويفي بالتزاماته ويلتزم بالمعيار بنفسه.'),
      b('Admits mistakes openly and fixes the system, not just the symptom.', 'يعترف بالأخطاء علناً ويصلح النظام لا العَرَض فقط.'),
      b('Builds a team where everyone owns the standard without being told.', 'يبني فريقاً يتحمل فيه الجميع مسؤولية المعيار دون توجيه.'),
    ),
    coach: {
      tips: [b('Close every commitment you make in a meeting: done, changed or dropped, and tell people which.', 'أغلق كل التزام تقطعه في اجتماع: أُنجز أو تغيّر أو أُلغي، وأخبر الناس بذلك.'), b('Name your own part first in any post-job review.', 'اذكر دورك أنت أولاً في أي مراجعة بعد العمل.')],
      practice: b('This week: list three open commitments and close one with the people who depend on it.', 'هذا الأسبوع: اكتب ثلاثة التزامات مفتوحة وأغلق واحداً منها مع من يعتمدون عليه.'),
      watch: b('Accountability is not blame: fix the system as well as the slip.', 'المساءلة ليست لوماً: أصلح النظام إلى جانب الخطأ.'),
    },
    links: [L_CULTURE], programme_ids: [],
  },
  {
    id: 'b-questioning', form_from: 1, sort: 30, trait_id: 'trait-2', benchmark_ids: [], sources: [],
    title: b('Questioning attitude', 'الموقف التساؤلي'), short: b('Questioning', 'التساؤل'),
    statement: b('Challenges assumptions and stops when unsure; invites others to do the same.', 'يتحدى الافتراضات ويتوقف عند الشك ويدعو الآخرين إلى فعل ذلك.'),
    framework: INPO(2, 'questioning attitude', 'الموقف التساؤلي'),
    anchors: A(
      b('Proceeds on assumptions and discourages questions.', 'يمضي بناءً على افتراضات ويثبّط الأسئلة.'),
      b('Asks questions when prompted; rarely stops when unsure.', 'يسأل عند التنبيه، ونادراً ما يتوقف عند الشك.'),
      b('Challenges assumptions and stops when unsure.', 'يتحدى الافتراضات ويتوقف عند الشك.'),
      b('Invites challenge from the team and thanks people who stop the job.', 'يدعو الفريق إلى التحدي ويشكر من يوقف العمل.'),
      b('Makes a questioning attitude a team habit that others learn from.', 'يجعل الموقف التساؤلي عادة لدى الفريق يتعلم منها الآخرون.'),
    ),
    coach: {
      tips: [b('Ask "what would make this go wrong?" before every non-routine task.', 'اسأل "ما الذي قد يجعل هذا يسوء؟" قبل كل مهمة غير اعتيادية.'), b('Thank the first person who stops a job, even when the job was fine.', 'اشكر أول من يوقف العمل، حتى لو كان العمل سليماً.')],
      practice: b('This week: in one brief, ask the most junior person for the risk they see first.', 'هذا الأسبوع: في إحاطة واحدة، اسأل أحدث الحاضرين أولاً عن الخطر الذي يراه.'),
      watch: b('Familiar tasks are where assumptions hide.', 'المهام المألوفة هي حيث تختبئ الافتراضات.'),
    },
    links: [L_CULTURE, { to: '/my/ai-fluency/drills', label: b('Governed AI drills', 'تمارين الذكاء الاصطناعي المنضبطة') }], programme_ids: [],
  },
  {
    id: 'b-communication', form_from: 1, sort: 40, trait_id: 'trait-3', benchmark_ids: [], sources: [],
    title: b('Effective safety communication', 'التواصل الفعّال بشأن السلامة'), short: b('Communication', 'التواصل'),
    statement: b('Communicates clearly and checks understanding, in briefs and turnovers.', 'يتواصل بوضوح ويتحقق من الفهم في الإحاطات وتسليم الورديات.'),
    framework: INPO(3, 'effective safety communication', 'التواصل الفعّال بشأن السلامة'),
    anchors: A(
      b('Briefs are unclear or skipped, and understanding is not checked.', 'الإحاطات غير واضحة أو تُتخطّى، ولا يُتحقق من الفهم.'),
      b('Communicates the basics but rarely checks understanding.', 'يوصل الأساسيات لكنه نادراً ما يتحقق من الفهم.'),
      b('Communicates clearly and checks understanding in briefs and turnovers.', 'يتواصل بوضوح ويتحقق من الفهم في الإحاطات وتسليم الورديات.'),
      b('Uses three-way communication and adapts the message to the audience.', 'يستخدم التواصل الثلاثي ويكيّف الرسالة مع الجمهور.'),
      b('Coaches others on safety communication; their team\'s turnovers are a model.', 'يدرّب الآخرين على التواصل بشأن السلامة، وتسليم ورديات فريقه نموذج يُحتذى.'),
    ),
    coach: {
      tips: [b('End each brief by asking one person to repeat the key risk in their own words.', 'اختم كل إحاطة بأن تطلب من شخص إعادة الخطر الرئيسي بكلماته.'), b('Use the same turnover structure every shift so gaps stand out.', 'استخدم بنية التسليم نفسها في كل وردية حتى تظهر الفجوات.')],
      practice: b('This week: observe one turnover and give the pair one piece of specific feedback.', 'هذا الأسبوع: راقب تسليماً واحداً وقدّم للطرفين ملاحظة محددة واحدة.'),
      watch: b('A nod is not confirmation.', 'الإيماءة ليست تأكيداً.'),
    },
    links: [L_CULTURE], programme_ids: [],
  },
  {
    id: 'b-decisions', form_from: 1, sort: 50, trait_id: 'trait-5', benchmark_ids: [], sources: [],
    title: b('Conservative decision-making', 'اتخاذ القرار المتحفظ'), short: b('Decisions', 'القرارات'),
    statement: b('Makes decisions that are systematic, conservative and explained to the team.', 'يتخذ قرارات منهجية ومتحفظة ويشرحها للفريق.'),
    framework: INPO(5, 'decision-making', 'اتخاذ القرار'),
    anchors: A(
      b('Makes quick decisions without considering the margin to safety.', 'يتخذ قرارات سريعة دون مراعاة هامش السلامة.'),
      b('Considers risk but rarely explains the decision.', 'يراعي المخاطر لكنه نادراً ما يشرح القرار.'),
      b('Makes systematic, conservative decisions and explains them to the team.', 'يتخذ قرارات منهجية ومتحفظة ويشرحها للفريق.'),
      b('Seeks other views before deciding and chooses the safer path under uncertainty.', 'يستطلع آراء أخرى قبل القرار ويختار المسار الأكثر أماناً عند عدم اليقين.'),
      b('Others seek them out for difficult decisions, and their decisions are reviewed and learned from.', 'يلجأ إليه الآخرون في القرارات الصعبة، وتُراجَع قراراته ويُتعلَّم منها.'),
    ),
    coach: {
      tips: [b('Say what you do not know before you decide.', 'قل ما لا تعرفه قبل أن تقرر.'), b('When two options look equal, pick the one that keeps more margin and say so.', 'عندما يبدو خياران متساويين، اختر الذي يحافظ على هامش أكبر وصرّح بذلك.')],
      practice: b('This week: write down one recent decision, the options you rejected and why; share it with your team.', 'هذا الأسبوع: دوّن قراراً حديثاً والخيارات التي رفضتها وسبب ذلك، وشاركه مع فريقك.'),
      watch: b('Confidence is not evidence.', 'الثقة ليست دليلاً.'),
    },
    links: [L_CULTURE], programme_ids: [],
  },
  {
    id: 'b-respect', form_from: 1, sort: 60, trait_id: 'trait-6', benchmark_ids: [], sources: [],
    title: b('Respectful work environment', 'بيئة عمل محترمة'), short: b('Respect', 'الاحترام'),
    statement: b('Treats people with dignity and builds trust across teams.', 'يعامل الناس بكرامة ويبني الثقة بين الفرق.'),
    framework: INPO(6, 'respectful work environment', 'بيئة عمل محترمة'),
    anchors: A(
      b('Dismisses or embarrasses people.', 'يتجاهل الآخرين أو يحرجهم.'),
      b('Polite, but trust stays low across teams.', 'مهذب، لكن الثقة بين الفرق تبقى منخفضة.'),
      b('Treats people with dignity and builds trust across teams.', 'يعامل الناس بكرامة ويبني الثقة بين الفرق.'),
      b('Resolves conflict fairly and recognises others\' contributions.', 'يحل الخلافات بإنصاف ويقدّر مساهمات الآخرين.'),
      b('Creates a climate of trust that people describe as a reason to stay.', 'يخلق مناخاً من الثقة يصفه الناس بأنه سبب للبقاء.'),
    ),
    coach: {
      tips: [b('Recognise one specific contribution in public each week.', 'قدّر مساهمة محددة علناً كل أسبوع.'), b('Deal with disrespect the same day, in private.', 'تعامل مع عدم الاحترام في اليوم نفسه وعلى انفراد.')],
      practice: b('This week: thank a colleague from another team for something that helped yours.', 'هذا الأسبوع: اشكر زميلاً من فريق آخر على أمر ساعد فريقك.'),
      watch: b('Jokes at someone\'s expense close mouths.', 'النكات على حساب الآخرين تُسكت الأفواه.'),
    },
    links: [L_CULTURE], programme_ids: [],
  },
  {
    id: 'b-learning', form_from: 1, sort: 70, trait_id: 'trait-7', benchmark_ids: [], sources: [],
    title: b('Continuous learning', 'التعلم المستمر'), short: b('Learning', 'التعلم'),
    statement: b('Seeks feedback, learns from experience and develops others.', 'يسعى إلى الملاحظات ويتعلم من التجربة ويطوّر الآخرين.'),
    framework: INPO(7, 'continuous learning', 'التعلم المستمر'),
    anchors: A(
      b('Avoids feedback and repeats the same mistakes.', 'يتجنب الملاحظات ويكرر الأخطاء نفسها.'),
      b('Accepts feedback when given; learning stays personal.', 'يقبل الملاحظات عندما تُقدَّم، ويبقى التعلم شخصياً.'),
      b('Seeks feedback, learns from experience and develops others.', 'يسعى إلى الملاحظات ويتعلم من التجربة ويطوّر الآخرين.'),
      b('Uses operating experience to change how the team works.', 'يستخدم الخبرة التشغيلية لتغيير طريقة عمل الفريق.'),
      b('Builds a learning organisation: lessons spread beyond their own team.', 'يبني مؤسسة متعلمة تنتشر فيها الدروس خارج فريقه.'),
    ),
    coach: {
      tips: [b('Ask for one piece of feedback after every significant task.', 'اطلب ملاحظة واحدة بعد كل مهمة مهمة.'), b('Share one operating-experience lesson in each team meeting.', 'شارك درساً واحداً من الخبرة التشغيلية في كل اجتماع للفريق.')],
      practice: b('This week: pick one lesson from operating experience and change one thing your team does.', 'هذا الأسبوع: اختر درساً من الخبرة التشغيلية وغيّر أمراً واحداً يفعله فريقك.'),
      watch: b('Learning that is not shared is lost at the next shift change.', 'التعلم الذي لا يُشارك يضيع عند تغيير الوردية التالي.'),
    },
    links: [L_CULTURE, { to: '/knowledge', label: b('Knowledge library', 'مكتبة المعرفة') }], programme_ids: [],
  },
  {
    id: 'b-concerns', form_from: 1, sort: 80, trait_id: 'trait-9', benchmark_ids: [], sources: [],
    title: b('Environment for raising concerns', 'بيئة طرح المخاوف'), short: b('Raising concerns', 'طرح المخاوف'),
    statement: b('Makes it easy and safe for anyone to raise a concern, and acts on it.', 'يجعل طرح المخاوف سهلاً وآمناً للجميع ويتصرف بناءً عليها.'),
    framework: INPO(9, 'environment for raising concerns', 'بيئة طرح المخاوف'),
    anchors: A(
      b('People hesitate to raise concerns with them.', 'يتردد الناس في طرح مخاوفهم عليه.'),
      b('Listens to concerns but rarely closes the loop.', 'يستمع إلى المخاوف لكنه نادراً ما يعود إلى صاحبها بما تم.'),
      b('Makes it easy and safe to raise a concern, and acts on it.', 'يجعل طرح المخاوف سهلاً وآمناً ويتصرف بناءً عليها.'),
      b('Thanks people for concerns, reports back on actions and protects them from blame.', 'يشكر من يطرح المخاوف ويبلغهم بالإجراءات ويحميهم من اللوم.'),
      b('Concerns are raised early across the area because people trust the response.', 'تُطرح المخاوف مبكراً في نطاق عمله لأن الناس يثقون بالاستجابة.'),
    ),
    coach: {
      tips: [b('Report back on every concern within a week, even if the answer is "not yet".', 'عُد بإجابة عن كل مخوف خلال أسبوع، حتى لو كانت "ليس بعد".'), b('Remind the team of every channel, including the confidential one.', 'ذكّر الفريق بكل القنوات، بما فيها القناة السرية.')],
      practice: b('This week: ask your team what would make raising a concern easier, and act on one answer.', 'هذا الأسبوع: اسأل فريقك عما يسهّل طرح المخاوف، ونفّذ إجابة واحدة.'),
      watch: b('How you react to the first concern decides whether there is a second.', 'ردّ فعلك على أول مخوف يحدد ما إذا كان سيأتي ثانٍ.'),
    },
    links: [L_CULTURE], programme_ids: [],
  },
  // ── FS46 future-leadership behaviours (form 2)
  {
    id: 'b-digital-change', form_from: 2, sort: 90, trait_id: null, benchmark_ids: ['WEF-FOJ'], sources: [SRC.wef],
    title: b('Leading digital change', 'قيادة التحول الرقمي'), short: b('Digital change', 'التحول الرقمي'),
    statement: b('Explains why a digital change matters for safety and the work, involves the people who will use it, and keeps a proven fallback until the new way works.', 'يشرح لماذا يهم التغيير الرقمي للسلامة وللعمل، ويشرك من سيستخدمونه، ويُبقي بديلاً مجرّباً حتى تثبت الطريقة الجديدة.'),
    framework: b('WEF Future of Jobs 2025: technological literacy is among the fastest-growing skills (per source)', 'تقرير مستقبل الوظائف 2025 للمنتدى الاقتصادي العالمي: الإلمام التقني من أسرع المهارات نمواً (وفق المصدر)'),
    anchors: A(
      b('Avoids or resists digital change and leaves the team to work it out.', 'يتجنب التغيير الرقمي أو يقاومه ويترك الفريق ليتدبر أمره.'),
      b('Supports changes others lead but rarely explains them to the team.', 'يدعم تغييرات يقودها غيره لكنه نادراً ما يشرحها للفريق.'),
      b('Explains the reason for a change, plans the training and checks that it works in practice.', 'يشرح سبب التغيير ويخطط للتدريب ويتحقق من نجاحه عملياً.'),
      b('Involves users early, pilots the change with clear stop criteria and keeps a fallback until it is proven.', 'يشرك المستخدمين مبكراً ويجرّب التغيير بمعايير توقف واضحة ويُبقي بديلاً حتى يثبت.'),
      b('Shapes the digital roadmap with the team, measures the benefit for safety and the work, and coaches other leaders to do the same.', 'يشكّل خارطة الطريق الرقمية مع الفريق ويقيس الفائدة للسلامة والعمل ويدرّب القادة الآخرين على ذلك.'),
    ),
    coach: {
      tips: [
        b('Before a rollout, write one sentence on the problem it solves for the team and one on what will not change.', 'قبل أي إطلاق، اكتب جملة عن المشكلة التي يحلها للفريق وجملة عما لن يتغير.'),
        b('Name the fallback: the old route stays until two clean weeks on the new one.', 'حدّد البديل: يبقى المسار القديم حتى أسبوعين نظيفين على الجديد.'),
        b('Ask the newest and the most experienced user to test it first, and listen to both.', 'اطلب من أحدث مستخدم وأكثرهم خبرة أن يختبراه أولاً، واستمع إلى كليهما.'),
      ],
      practice: b('This week: run a 15-minute walk-through of one digital tool with your team and capture three questions.', 'هذا الأسبوع: قدّم عرضاً لمدة 15 دقيقة لأداة رقمية واحدة مع فريقك ودوّن ثلاثة أسئلة.'),
      watch: b('Do not measure success by go-live dates alone.', 'لا تقِس النجاح بمواعيد الإطلاق وحدها.'),
    },
    links: [
      { to: '/learn/future-skills', label: b('Future-skills course pack', 'حزمة دورات المهارات المستقبلية') },
      { to: '/my/ai-fluency', label: b('My AI fluency', 'طلاقتي في الذكاء الاصطناعي') },
      { to: '/opportunities/future', label: b('Future-skills gigs', 'مهام المهارات المستقبلية') },
    ],
    programme_ids: ['prog-future-leaders'],
  },
  {
    id: 'b-ai-teams', form_from: 2, sort: 100, trait_id: 'trait-2', benchmark_ids: ['WEF-FOJ'], sources: [SRC.wef, SRC.iaeaAi],
    title: b('Leading AI-augmented teams', 'قيادة فرق معززة بالذكاء الاصطناعي'), short: b('AI-augmented teams', 'الفرق المعززة بالذكاء الاصطناعي'),
    statement: b('Sets clear rules for when the team uses approved AI tools, expects outputs to be verified against the controlled source, and backs anyone who overrides a tool when something does not look right.', 'يضع قواعد واضحة لاستخدام الفريق لأدوات الذكاء الاصطناعي المعتمدة، ويتوقع التحقق من المخرجات مقابل المصدر المعتمد، ويساند كل من يتجاوز الأداة عندما يبدو أمر ما غير صحيح.'),
    framework: b('WEF Future of Jobs 2025: AI and big data is the fastest-growing skill (per source); the override rule follows the questioning attitude (INPO 12-012 trait 2)', 'تقرير مستقبل الوظائف 2025: الذكاء الاصطناعي والبيانات الضخمة الأسرع نمواً (وفق المصدر)؛ وقاعدة التجاوز امتداد للموقف التساؤلي (السمة 2 في INPO 12-012)'),
    anchors: A(
      b('Lets people use AI tools without rules, or bans them without explanation.', 'يترك الناس يستخدمون أدوات الذكاء الاصطناعي بلا قواعد، أو يمنعها دون تفسير.'),
      b('Knows the approved tools but does not talk about how outputs are checked.', 'يعرف الأدوات المعتمدة لكنه لا يتحدث عن كيفية التحقق من المخرجات.'),
      b('Explains which tools are approved for which tasks and expects outputs to be verified against the controlled source.', 'يوضح الأدوات المعتمدة لكل مهمة ويتوقع التحقق من المخرجات مقابل المصدر المعتمد.'),
      b('Sets clear override rules: anyone may stop and override a tool that disagrees with indications or procedures, and is thanked for it.', 'يضع قواعد تجاوز واضحة: يحق لأي شخص إيقاف الأداة وتجاوزها إذا خالفت المؤشرات أو الإجراءات، ويُشكر على ذلك.'),
      b('Reviews AI-related near misses with the team, feeds lessons into the AI register and coaches others on human oversight.', 'يراجع مع الفريق الحوادث الوشيكة المرتبطة بالذكاء الاصطناعي، ويغذي سجل الذكاء الاصطناعي بالدروس، ويدرّب الآخرين على الإشراف البشري.'),
    ),
    coach: {
      tips: [
        b('Agree with your team: an AI suggestion never replaces the procedure or the controlled source.', 'اتفق مع فريقك: اقتراح الذكاء الاصطناعي لا يحل محل الإجراء أو المصدر المعتمد أبداً.'),
        b('Praise, in front of the team, the first person who overrides a tool for a good reason.', 'امدح أمام الفريق أول شخص يتجاوز أداة لسبب وجيه.'),
        b('Review one AI-assisted task a month: what was checked, by whom, and what would have been missed.', 'راجع مهمة واحدة بمساعدة الذكاء الاصطناعي كل شهر: ما الذي تم التحقق منه، ومن قام به، وما الذي كان سيفوت.'),
      ],
      practice: b('This week: do a governed AI drill and talk the planted errors through with your team.', 'هذا الأسبوع: أدِّ تمريناً منضبطاً للذكاء الاصطناعي وناقش الأخطاء المزروعة مع فريقك.'),
      watch: b('Automation bias grows when a tool is usually right.', 'يزداد الانحياز للأتمتة عندما تكون الأداة محقة في الغالب.'),
    },
    links: [
      { to: '/my/ai-fluency/drills', label: b('Governed AI drills', 'تمارين الذكاء الاصطناعي المنضبطة') },
      { to: '/my/ai-fluency', label: b('My AI fluency', 'طلاقتي في الذكاء الاصطناعي') },
      { to: '/workforce/ai-register', label: b('AI-literacy register', 'سجل الإلمام بالذكاء الاصطناعي') },
    ],
    programme_ids: ['prog-future-leaders'],
  },
  {
    id: 'b-intrapreneurship', form_from: 2, sort: 110, trait_id: 'trait-8', benchmark_ids: ['GREENCOMP'], sources: [SRC.greencomp],
    title: b('Intrapreneurship', 'روح المبادرة داخل المؤسسة'), short: b('Intrapreneurship', 'المبادرة'),
    statement: b('Spots chances to improve how ENEC works, gathers the resources and allies to test an idea safely, and turns it into action (EntreComp areas: ideas and opportunities, resources, into action).', 'يلتقط فرص تحسين طريقة عمل المؤسسة، ويجمع الموارد والحلفاء لاختبار الفكرة بأمان، ويحوّلها إلى عمل (مجالات EntreComp: الأفكار والفرص، والموارد، والتنفيذ).'),
    framework: b('EntreComp, the JRC framework in the same family as GreenComp and LifeComp (per source)', 'إطار EntreComp من مركز البحوث المشترك، من عائلة GreenComp وLifeComp نفسها (وفق المصدر)'),
    anchors: A(
      b('Rarely suggests improvements and waits to be told.', 'نادراً ما يقترح تحسينات وينتظر التوجيه.'),
      b('Shares ideas but does not follow them up.', 'يشارك الأفكار لكنه لا يتابعها.'),
      b('Turns an idea into a small, safe trial with a clear owner and a check on the result.', 'يحوّل الفكرة إلى تجربة صغيرة وآمنة بمالك واضح وتحقق من النتيجة.'),
      b('Builds a case with data, secures time and allies, and scales ideas that work through the change process.', 'يبني حجة بالبيانات ويؤمّن الوقت والحلفاء ويوسّع الأفكار الناجحة عبر عملية التغيير.'),
      b('Creates room for others to experiment safely, sponsors their ideas and shares what failed as well as what worked.', 'يتيح للآخرين مساحة للتجريب الآمن ويرعى أفكارهم ويشارك ما فشل وما نجح.'),
    ),
    coach: {
      tips: [
        b('Pick one friction in your area and write it as a problem statement, not a solution.', 'اختر عائقاً واحداً في نطاقك واكتبه كمشكلة لا كحل.'),
        b('Ask for a time envelope to test it, such as a future-skills gig or a small pilot.', 'اطلب نطاقاً زمنياً لاختباره، مثل مهمة مهارات مستقبلية أو تجربة صغيرة.'),
        b('Close the loop: share the result, even when the idea did not work.', 'أغلق الحلقة: شارك النتيجة حتى لو لم تنجح الفكرة.'),
      ],
      practice: b('This week: post an idea as a gig in the digital-innovation channel, or join one.', 'هذا الأسبوع: انشر فكرة كمهمة في قناة الابتكار الرقمي، أو انضم إلى إحداها.'),
      watch: b('Never trial a change on plant equipment outside the formal modification process.', 'لا تجرّب أي تغيير على معدات المحطة خارج عملية التعديل الرسمية.'),
    },
    links: [
      { to: '/opportunities/future', label: b('Future-skills gigs', 'مهام المهارات المستقبلية') },
      { to: '/opportunities/envelope', label: b('Ask for a time envelope', 'طلب نطاق زمني') },
      { to: '/knowledge/capture', label: b('Knowledge capture studio', 'استوديو توثيق المعرفة') },
    ],
    programme_ids: ['prog-future-leaders'],
  },
  {
    id: 'b-inclusion', form_from: 2, sort: 120, trait_id: 'trait-6', benchmark_ids: ['NEA'], sources: [SRC.nea2035],
    title: b('Inclusive leadership', 'القيادة الشاملة'), short: b('Inclusion', 'الشمول'),
    statement: b('Makes sure every voice is heard whatever the person\'s background, shift, grade or gender, shares opportunities fairly and acts on the barriers people raise.', 'يحرص على سماع كل صوت أياً كانت خلفية الشخص أو ورديته أو درجته أو جنسه، ويوزع الفرص بإنصاف، ويعالج العوائق التي يطرحها الناس.'),
    framework: b('OECD-NEA Plan 2035: mentor and network lanes for the nuclear workforce (per source)', 'خطة 2035 لوكالة الطاقة النووية: مسارا الإرشاد والشبكات للقوى العاملة النووية (وفق المصدر)'),
    anchors: A(
      b('The same few people speak and get the opportunities.', 'يتحدث الأشخاص القلائل أنفسهم ويحصلون على الفرص.'),
      b('Is fair when asked but does not notice who is left out.', 'منصف عندما يُطلب منه، لكنه لا يلاحظ من يُستبعد.'),
      b('Invites quieter voices in meetings and rotates stretch opportunities across the team.', 'يدعو الأصوات الأهدأ في الاجتماعات ويدوّر الفرص التطويرية على الفريق.'),
      b('Checks who gets development and visibility, removes barriers people raise and mentors across backgrounds.', 'يتحقق ممن يحصل على التطوير والظهور، ويزيل العوائق المطروحة، ويرشد أشخاصاً من خلفيات مختلفة.'),
      b('Builds a team where people of different backgrounds lead, sponsors under-represented talent and is a role model across ENEC.', 'يبني فريقاً يقوده أشخاص من خلفيات مختلفة، ويرعى المواهب الأقل تمثيلاً، ويكون قدوة في المؤسسة.'),
    ),
    coach: {
      tips: [
        b('In your next brief, ask the person who has not spoken yet first.', 'في إحاطتك القادمة، اسأل أولاً من لم يتحدث بعد.'),
        b('Look at who led the last three stretch tasks and offer the next one to someone else.', 'انظر إلى من قاد آخر ثلاث مهام تطويرية واعرض التالية على شخص آخر.'),
        b('Offer to mentor, or sponsor a mentor circle outside your own group.', 'تطوّع للإرشاد، أو ارعَ حلقة إرشاد خارج مجموعتك.'),
      ],
      practice: b('This week: open a mentor circle seat in the women in future nuclear skills network, or ask how to sponsor one.', 'هذا الأسبوع: افتح مقعداً في حلقة إرشاد ضمن شبكة المرأة في المهارات النووية المستقبلية، أو اسأل كيف ترعى حلقة.'),
      watch: b('Inclusion is about access to opportunities, never about scores: no ranking in Kafa\'a uses gender or nationality.', 'الشمول يتعلق بالوصول إلى الفرص لا بالدرجات: لا يستخدم أي ترتيب في كفاءة الجنس أو الجنسية.'),
    },
    links: [
      { to: '/communities/women-in-nuclear', label: b('Women in future nuclear skills', 'المرأة في المهارات النووية المستقبلية') },
      { to: '/my/mentoring', label: b('My mentoring', 'الإرشاد الخاص بي') },
    ],
    programme_ids: ['prog-future-leaders'],
  },
];

// ───────────────────────────── FS47 · Future Leaders track (INMA pattern)
export const FL_PROGRAMME_ROW = {
  id: 'prog-future-leaders', code: 'FUTURE-LEADERS', kind: 'programme', steps: ['first_line', 'manager'], mandatory_steps: [], required_tracks: [],
  skill_ids: ['sk-sc-02', 'sk-ld-02', 'sk-ld-01-coach', 'sk-ns-02-licensing', 'sk-en-01-project', 'sk-fs-tr-crosscultural'],
  behaviour_ids: ['b-safety-values', 'b-digital-change', 'b-ai-teams', 'b-intrapreneurship', 'b-inclusion'],
  nominable: false, course_id: null, duration_days: 18, completions: null, completions_year: null, link_route: '/leadership/future-leaders', sort: 120,
  title_en: 'Future Leaders track: nuclear management competence', title_ar: 'مسار قادة المستقبل: كفاءة الإدارة النووية',
  summary_en: 'A one-year cohort for high-potential leaders: five nuclear-management competencies (the IAEA INMA pattern), six three-day modules, a policy project with an executive sponsor and a mentor. Concept track (demo).',
  summary_ar: 'دفعة لمدة عام لأصحاب الإمكانات القيادية العالية: خمس كفاءات للإدارة النووية (نمط أكاديمية INMA التابعة للوكالة الدولية للطاقة الذرية)، وست وحدات مدة كل منها ثلاثة أيام، ومشروع سياسات برعاية تنفيذية، ومرشد. مسار مفاهيمي (عرض توضيحي).',
  audience_en: 'High-potential first-line leaders and managers, nominated by HR and selected by the HR authority or the training manager.',
  audience_ar: 'قادة الخط الأول والمديرون أصحاب الإمكانات العالية، بترشيح من الموارد البشرية واختيار من سلطة الموارد البشرية أو مدير التدريب.',
  duration_en: '6 modules of 3 days over a year, plus a policy project', duration_ar: '6 وحدات من 3 أيام على مدى عام، إضافة إلى مشروع سياسات',
  fact_en: 'Pattern: INMA endorses nuclear-management master\'s programmes against an IAEA competency model; the Nordic trainee programme runs six three-day modules with a project and mentoring (per source).',
  fact_ar: 'النمط: تعتمد أكاديمية INMA برامج ماجستير في الإدارة النووية وفق نموذج كفاءات للوكالة، ويقدّم برنامج المتدربين الشمالي ست وحدات من ثلاثة أيام مع مشروع وإرشاد (وفق المصدر).',
  sources: [SRC.inma, SRC.nntp],
};

export interface FlCompetencyDef {
  id: string; code: string; sort: number; title: Bi; summary: Bi; area: Bi;
  descriptors: Record<'1' | '2' | '3' | '4', Bi>; skill_targets: Record<string, number>;
  route: { kind: 'module' | 'programme' | 'external' | 'route'; ref: string; title: Bi }[];
  external_ids: string[]; sources: Src[];
}
const D = (d1: Bi, d2: Bi, d3: Bi, d4: Bi) => ({ '1': d1, '2': d2, '3': d3, '4': d4 });
export const FL_LEVEL_NAMES: Record<'1' | '2' | '3' | '4', Bi> = { '1': b('Awareness', 'الوعي'), '2': b('Practitioner', 'الممارسة'), '3': b('Leader', 'القيادة'), '4': b('Strategic', 'الاستراتيجية') };
export const FL_COMPETENCIES: FlCompetencyDef[] = [
  {
    id: 'fl-safety-leadership', code: 'FL-1', sort: 10, title: b('Safety culture leadership', 'قيادة ثقافة السلامة'),
    summary: b('Leads so that nuclear safety is the overriding priority in decisions, resources and behaviours across an organisation, not only a team.', 'يقود بحيث تكون السلامة النووية الأولوية العليا في القرارات والموارد والسلوكيات على مستوى المؤسسة لا الفريق فقط.'),
    area: b('Safety and safety culture', 'السلامة وثقافة السلامة'),
    descriptors: D(
      b('Explains the safety-culture traits and how leaders influence them.', 'يشرح سمات ثقافة السلامة وكيف يؤثر القادة فيها.'),
      b('Uses safety-culture observations and operating experience to set priorities in their own area.', 'يستخدم ملاحظات ثقافة السلامة والخبرة التشغيلية لتحديد الأولويات في نطاقه.'),
      b('Balances production, cost and safety openly across functions and makes the trade-offs visible.', 'يوازن علناً بين الإنتاج والتكلفة والسلامة عبر الوظائف ويُظهر المفاضلات.'),
      b('Shapes organisation-wide safety-culture improvement and answers to oversight for it.', 'يشكّل تحسين ثقافة السلامة على مستوى المؤسسة ويُسأل عنه أمام جهات الإشراف.'),
    ),
    skill_targets: { 'sk-sc-02': 3, 'sk-ld-02': 3, 'sk-sc-01': 3 },
    route: [
      { kind: 'module', ref: 'flm-safety', title: b('Module 1: Leading safety culture', 'الوحدة 1: قيادة ثقافة السلامة') },
      { kind: 'programme', ref: 'prog-cld', title: b('Culture of leadership development (academy)', 'تطوير ثقافة القيادة (الأكاديمية)') },
      { kind: 'route', ref: '/safety-culture', title: b('Safety culture traits', 'سمات ثقافة السلامة') },
      { kind: 'external', ref: 'fx-iaea-nem', title: b('IAEA School of Nuclear Energy Management', 'مدرسة إدارة الطاقة النووية التابعة للوكالة') },
    ],
    external_ids: ['fx-iaea-nem'], sources: [SRC.inma],
  },
  {
    id: 'fl-regulatory', code: 'FL-2', sort: 20, title: b('Regulatory affairs literacy', 'الإلمام بالشؤون التنظيمية'),
    summary: b('Understands how the regulator, the licensing basis and international safety standards shape decisions, and works with them early and openly. This is literacy, not a regulatory role.', 'يفهم كيف يشكّل المنظِّم وأساس الترخيص ومعايير السلامة الدولية القرارات، ويتعامل معها مبكراً وبشفافية. هذا إلمام وليس دوراً تنظيمياً.'),
    area: b('Regulation and licensing', 'التنظيم والترخيص'),
    descriptors: D(
      b('Explains, at a high level, the role of the national regulator, licence conditions and the IAEA safety standards.', 'يشرح على مستوى عام دور المنظِّم الوطني وشروط الترخيص ومعايير السلامة للوكالة الدولية للطاقة الذرية.'),
      b('Uses the licensing basis and technical specifications correctly when planning work in their area.', 'يستخدم أساس الترخيص والمواصفات الفنية بشكل صحيح عند تخطيط العمل في نطاقه.'),
      b('Prepares a change or submission with the licensing team and anticipates the questions it will raise.', 'يُعدّ تغييراً أو تقديماً مع فريق الترخيص ويتوقع الأسئلة التي سيثيرها.'),
      b('Leads engagement on new technology, such as SMRs, where the path is still being defined. No deployment decision implied.', 'يقود التواصل بشأن التقنيات الجديدة، مثل المفاعلات الصغيرة، حيث ما زال المسار قيد التحديد. لا يُفهم من ذلك أي قرار نشر.'),
    ),
    skill_targets: { 'sk-ns-02': 2, 'sk-ns-02-licensing': 2, 'sk-fs-adv-regulation': 1 },
    route: [
      { kind: 'module', ref: 'flm-regulation', title: b('Module 2: Regulation, licensing and international standards', 'الوحدة 2: التنظيم والترخيص والمعايير الدولية') },
      { kind: 'route', ref: '/skills/sk-ns-02-licensing', title: b('Skill: licensing basis and regulatory submissions', 'مهارة: أساس الترخيص والتقديمات التنظيمية') },
      { kind: 'external', ref: 'fx-inma', title: b('INMA-endorsed master\'s programmes', 'برامج الماجستير المعتمدة من INMA') },
    ],
    external_ids: ['fx-inma', 'fx-nea-nextgen'], sources: [SRC.inma],
  },
  {
    id: 'fl-project-cost', code: 'FL-3', sort: 30, title: b('Project and cost control', 'ضبط المشاريع والتكاليف'),
    summary: b('Plans, estimates and controls projects and outages against scope, schedule, cost and risk, with safety and quality as fixed constraints.', 'يخطط المشاريع والانقطاعات ويقدّرها ويضبطها وفق النطاق والجدول والتكلفة والمخاطر، مع بقاء السلامة والجودة قيوداً ثابتة.'),
    area: b('Projects, cost and economics', 'المشاريع والتكاليف والاقتصاد'),
    descriptors: D(
      b('Reads a project schedule and budget and explains a variance.', 'يقرأ جدول المشروع وميزانيته ويشرح أي انحراف.'),
      b('Builds and tracks a work plan with milestones, costs and risks for a small project.', 'يبني خطة عمل لمشروع صغير بمعالمها وتكاليفها ومخاطرها ويتابعها.'),
      b('Leads a multi-discipline project or outage scope with earned-value or equivalent controls.', 'يقود مشروعاً متعدد التخصصات أو نطاق انقطاع بضوابط القيمة المكتسبة أو ما يعادلها.'),
      b('Owns a portfolio, sets investment priorities and challenges business cases.', 'يملك محفظة مشاريع ويحدد أولويات الاستثمار ويتحدى دراسات الجدوى.'),
    ),
    skill_targets: { 'sk-en-01-project': 2, 'sk-mp-01-outage': 2, 'sk-fs-tr-analytical': 2 },
    route: [
      { kind: 'module', ref: 'flm-project', title: b('Module 3: Project, cost and outage economics', 'الوحدة 3: المشاريع والتكاليف واقتصاديات الانقطاعات') },
      { kind: 'programme', ref: 'prog-one', title: b('ONE leadership programme (academy)', 'برنامج ONE القيادي (الأكاديمية)') },
      { kind: 'route', ref: '/opportunities/future', title: b('Practise on a future-skills gig', 'تدرّب عبر مهمة مهارات مستقبلية') },
    ],
    external_ids: ['fx-enen2plus'], sources: [SRC.inma],
  },
  {
    id: 'fl-stakeholder', code: 'FL-4', sort: 40, title: b('Stakeholder and international affairs', 'شؤون أصحاب المصلحة والشؤون الدولية'),
    summary: b('Represents the organisation credibly with communities, partners and international bodies, and explains nuclear energy in plain language.', 'يمثّل المؤسسة بمصداقية أمام المجتمعات والشركاء والهيئات الدولية، ويشرح الطاقة النووية بلغة واضحة.'),
    area: b('Stakeholders and international affairs', 'أصحاب المصلحة والشؤون الدولية'),
    descriptors: D(
      b('Explains the organisation\'s role and the basics of nuclear energy to a non-specialist.', 'يشرح دور المؤسسة وأساسيات الطاقة النووية لغير المتخصصين.'),
      b('Works effectively with partner organisations and suppliers from other cultures.', 'يعمل بفعالية مع الشركاء والموردين من ثقافات أخرى.'),
      b('Represents the organisation in external forums and handles difficult questions calmly.', 'يمثّل المؤسسة في المحافل الخارجية ويتعامل مع الأسئلة الصعبة بهدوء.'),
      b('Builds long-term partnerships and contributes to international programmes.', 'يبني شراكات طويلة الأمد ويسهم في البرامج الدولية.'),
    ),
    skill_targets: { 'sk-fs-tr-crosscultural': 2, 'sk-fs-tr-leadership': 2, 'sk-fs-tr-empathy': 2 },
    route: [
      { kind: 'module', ref: 'flm-stakeholder', title: b('Module 4: Stakeholders, public communication and international affairs', 'الوحدة 4: أصحاب المصلحة والتواصل العام والشؤون الدولية') },
      { kind: 'external', ref: 'fx-nea-nextgen', title: b('NEA NextGen Nuclear Leaders Summer School', 'المدرسة الصيفية لقادة الجيل القادم النوويين (NEA)') },
      { kind: 'route', ref: '/communities', title: b('Communities of practice', 'مجتمعات الممارسة') },
    ],
    external_ids: ['fx-nea-nextgen', 'fx-kings'], sources: [SRC.neaNextgen],
  },
  {
    id: 'fl-knowledge', code: 'FL-5', sort: 50, title: b('Knowledge management', 'إدارة المعرفة'),
    summary: b('Treats nuclear knowledge as an asset: finds what is critical, makes sure it is captured and passed on, and plans for succession.', 'يتعامل مع المعرفة النووية كأصل: يحدد ما هو حرج ويضمن توثيقه ونقله ويخطط للتعاقب.'),
    area: b('Knowledge management', 'إدارة المعرفة'),
    descriptors: D(
      b('Explains why knowledge loss is a safety and business risk.', 'يشرح لماذا يمثّل فقدان المعرفة خطراً على السلامة والأعمال.'),
      b('Captures and shares their own critical knowledge with approved methods.', 'يوثّق معرفته الحرجة ويشاركها بالطرق المعتمدة.'),
      b('Runs knowledge-loss assessments and capture plans for a team.', 'يجري تقييمات فقدان المعرفة وخطط التوثيق لفريق.'),
      b('Sets knowledge strategy and succession for a function.', 'يضع استراتيجية المعرفة والتعاقب لوظيفة كاملة.'),
    ),
    skill_targets: { 'sk-ld-01-coach': 3, 'sk-fs-tr-curiosity': 2, 'sk-ld-01-instruct': 2 },
    route: [
      { kind: 'module', ref: 'flm-knowledge', title: b('Module 5: Knowledge management and succession', 'الوحدة 5: إدارة المعرفة والتعاقب') },
      { kind: 'route', ref: '/knowledge/capture', title: b('Knowledge capture studio', 'استوديو توثيق المعرفة') },
      { kind: 'route', ref: '/knowledge', title: b('Knowledge library', 'مكتبة المعرفة') },
    ],
    external_ids: ['fx-iaea-nem'], sources: [SRC.inma],
  },
];

export interface FlExternalDef { id: string; kind: string; sort: number; owner: Bi; title: Bi; summary: Bi; dates: Bi; year_from: number | null; year_to: number | null; competency_ids: string[]; sources: Src[] }
export const FL_EXTERNAL: FlExternalDef[] = [
  {
    id: 'fx-nea-nextgen', kind: 'summer_school', sort: 10, owner: b('OECD Nuclear Energy Agency (NEA)', 'وكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية'),
    title: b('NextGen Nuclear Leaders Summer School', 'المدرسة الصيفية لقادة الجيل القادم النوويين'),
    summary: b('The NEA\'s flagship summer school for the next generation of nuclear leaders, convened through its Global Forum on Nuclear Education, Science, Technology and Policy.', 'المدرسة الصيفية الرئيسية للوكالة لقادة الجيل القادم، تُعقد عبر منتداها العالمي للتعليم والعلوم والتكنولوجيا والسياسات النووية.'),
    dates: b('2026 programme published', 'نُشر برنامج 2026'), year_from: 2026, year_to: 2026, competency_ids: ['fl-stakeholder', 'fl-regulatory'], sources: [SRC.neaNextgen],
  },
  {
    id: 'fx-iaea-nem', kind: 'school', sort: 20, owner: b('International Atomic Energy Agency (IAEA)', 'الوكالة الدولية للطاقة الذرية'),
    title: b('IAEA School of Nuclear Energy Management', 'مدرسة إدارة الطاقة النووية التابعة للوكالة الدولية للطاقة الذرية'),
    summary: b('For young professionals in Member States planning or starting nuclear power programmes; the Japan-hosted Nuclear Energy Management programme serves as a practicum component of INMA.', 'للمهنيين الشباب في الدول الأعضاء التي تخطط لبرامج القوى النووية أو تبدأها؛ ويُعد برنامج إدارة الطاقة النووية الذي تستضيفه اليابان مكوّناً تطبيقياً ضمن أكاديمية INMA.'),
    dates: b('Recurring school (see the source for current dates)', 'مدرسة دورية (راجع المصدر للمواعيد الحالية)'), year_from: null, year_to: null, competency_ids: ['fl-safety-leadership', 'fl-knowledge'], sources: [SRC.inma],
  },
  {
    id: 'fx-inma', kind: 'masters', sort: 30, owner: b('IAEA International Nuclear Management Academy (INMA)', 'الأكاديمية الدولية للإدارة النووية (INMA) التابعة للوكالة'),
    title: b('INMA-endorsed master\'s programmes in nuclear technology management', 'برامج ماجستير إدارة التكنولوجيا النووية المعتمدة من INMA'),
    summary: b('INMA endorses university master\'s programmes in nuclear technology management against an IAEA competency model; about 10 universities are reported, and Sofia University was endorsed in early 2025.', 'تعتمد INMA برامج ماجستير جامعية في إدارة التكنولوجيا النووية وفق نموذج كفاءات للوكالة؛ ويُذكر نحو 10 جامعات، واعتُمدت جامعة صوفيا مطلع 2025.'),
    dates: b('Endorsements continue; Sofia University endorsed early 2025', 'الاعتمادات مستمرة؛ اعتُمدت جامعة صوفيا مطلع 2025'), year_from: 2025, year_to: null, competency_ids: ['fl-regulatory', 'fl-project-cost', 'fl-knowledge'], sources: [SRC.inma, SRC.sofia, SRC.mephi],
  },
  {
    id: 'fx-cnnems', kind: 'school', sort: 40, owner: b('University of Saskatchewan (IAEA-led)', 'جامعة ساسكاتشوان (بقيادة الوكالة)'),
    title: b('Canadian National Nuclear Energy Management School', 'المدرسة الوطنية الكندية لإدارة الطاقة النووية'),
    summary: b('An IAEA-led nuclear energy management school hosted by the University of Saskatchewan.', 'مدرسة لإدارة الطاقة النووية بقيادة الوكالة تستضيفها جامعة ساسكاتشوان.'),
    dates: b('Reported November 2025', 'وردت في نوفمبر 2025'), year_from: 2025, year_to: null, competency_ids: ['fl-safety-leadership', 'fl-project-cost'], sources: [SRC.ansCanada],
  },
  {
    id: 'fx-enen2plus', kind: 'mobility', sort: 50, owner: b('European Nuclear Education Network (ENEN)', 'الشبكة الأوروبية للتعليم النووي (ENEN)'),
    title: b('ENEN2plus mobility grants', 'منح التنقل ENEN2plus'),
    summary: b('Lump-sum grants paid to the learner for internships, on-the-job training, exchanges, conferences and courses; open to students and early-career professionals with up to 10 years\' experience, with deadlines every 2 months.', 'منح مقطوعة تُدفع للمتعلم لقاء التدريب الداخلي والتدريب أثناء العمل والتبادل والمؤتمرات والدورات؛ متاحة للطلاب والمهنيين في بداية مسيرتهم بخبرة حتى 10 سنوات، ومواعيد التقديم كل شهرين.'),
    dates: b('June 2022 to May 2026 (CORDIS 101061677)', 'من يونيو 2022 إلى مايو 2026 (CORDIS 101061677)'), year_from: 2022, year_to: 2026, competency_ids: ['fl-project-cost', 'fl-stakeholder'], sources: [SRC.enen],
  },
  {
    id: 'fx-nntp', kind: 'trainee', sort: 60, owner: b('Fortum, TVO, Uniper and Vattenfall', 'فورتوم وTVO ويونيبر وفاتنفال'),
    title: b('Nordic Nuclear Trainee Programme', 'برنامج المتدربين النوويين الشمالي'),
    summary: b('A trainee programme run jointly by four operators: six in-person modules of three days with site visits, a project assignment and mentoring. Its module, project and mentor triad is the pattern for this track.', 'برنامج متدربين يديره أربعة مشغّلين معاً: ست وحدات حضورية مدة كل منها ثلاثة أيام مع زيارات ميدانية ومشروع وإرشاد. وثلاثية الوحدة والمشروع والمرشد هي نمط هذا المسار.'),
    dates: b('Launched 2019; fourth round January to December 2027', 'أُطلق في 2019؛ الجولة الرابعة من يناير إلى ديسمبر 2027'), year_from: 2019, year_to: 2027, competency_ids: ['fl-safety-leadership', 'fl-knowledge'], sources: [SRC.nntp],
  },
  {
    id: 'fx-kings', kind: 'internship', sort: 70, owner: b('KEPCO International Nuclear Graduate School (KINGS)', 'كلية كيبكو الدولية للدراسات العليا النووية (KINGS)'),
    title: b('KINGS master\'s and the ENEC internship in Korea', 'ماجستير KINGS وبرنامج التدريب الداخلي في كوريا'),
    summary: b('KINGS was established in 2012 with a two-year master\'s accredited by Korea\'s Ministry of Education; ENEC\'s internship with KINGS ran a second edition from 2016 with a first batch of 10 Emirati students.', 'تأسست KINGS في 2012 ببرنامج ماجستير لمدة عامين معتمد من وزارة التعليم الكورية؛ ونُظمت النسخة الثانية من برنامج التدريب الداخلي مع KINGS منذ 2016 بدفعة أولى من 10 طلاب إماراتيين.'),
    dates: b('Established 2012; internship edition from 2016 (historical)', 'تأسست 2012؛ نسخة التدريب منذ 2016 (تاريخي)'), year_from: 2012, year_to: null, competency_ids: ['fl-stakeholder'], sources: [SRC.kings],
  },
];

export interface FlModuleDef { id: string; title: Bi; format: Bi; weeks: number; competency_ids: string[] }
export const FL_MODULES: FlModuleDef[] = [
  { id: 'flm-safety', title: b('Leading safety culture', 'قيادة ثقافة السلامة'), format: b('Three days with a site visit', 'ثلاثة أيام مع زيارة ميدانية'), weeks: 6, competency_ids: ['fl-safety-leadership'] },
  { id: 'flm-regulation', title: b('Regulation, licensing and international standards', 'التنظيم والترخيص والمعايير الدولية'), format: b('Three days with the licensing team', 'ثلاثة أيام مع فريق الترخيص'), weeks: 6, competency_ids: ['fl-regulatory'] },
  { id: 'flm-project', title: b('Project, cost and outage economics', 'المشاريع والتكاليف واقتصاديات الانقطاعات'), format: b('Three days with a case study', 'ثلاثة أيام مع دراسة حالة'), weeks: 6, competency_ids: ['fl-project-cost'] },
  { id: 'flm-stakeholder', title: b('Stakeholders, public communication and international affairs', 'أصحاب المصلحة والتواصل العام والشؤون الدولية'), format: b('Three days with a media exercise', 'ثلاثة أيام مع تمرين إعلامي'), weeks: 6, competency_ids: ['fl-stakeholder'] },
  { id: 'flm-knowledge', title: b('Knowledge management and succession', 'إدارة المعرفة والتعاقب'), format: b('Three days with a capture interview', 'ثلاثة أيام مع مقابلة توثيق'), weeks: 6, competency_ids: ['fl-knowledge'] },
  { id: 'flm-future', title: b('Leading the future plant: digital change, AI-augmented teams and new reactors', 'قيادة محطة المستقبل: التحول الرقمي والفرق المعززة بالذكاء الاصطناعي والمفاعلات الجديدة'), format: b('Three days with a governed AI drill and the 360 (form 2)', 'ثلاثة أيام مع تمرين ذكاء اصطناعي منضبط وتقييم 360 (النموذج 2)'), weeks: 6, competency_ids: ['fl-safety-leadership', 'fl-regulatory'] },
];
const BRIEF = b('Each participant writes a short policy paper on a question an executive sponsors (for example, how a future fleet would change workforce planning). Concept work: no deployment decision implied.', 'يكتب كل مشارك ورقة سياسات قصيرة حول سؤال يرعاه أحد التنفيذيين (مثل كيف سيغيّر أسطول مستقبلي تخطيط القوى العاملة). عمل مفاهيمي: لا يُفهم منه أي قرار نشر.');
const MENTOR = b('Each participant has a senior leader as mentor (role card) for the year.', 'لكل مشارك مرشد من كبار القادة (بطاقة دور) طوال العام.');
export const FL_COHORTS = [
  { id: 'flc-2025', code: 'FL-2025', year: 2025, status: 'completed', seats: 8, starts_on: '2024-10-01', ends_on: '2025-06-30', title: b('Future Leaders pilot cohort 2025', 'الدفعة التجريبية لقادة المستقبل 2025'), sort: 10 },
  { id: 'flc-2026', code: 'FL-2026', year: 2026, status: 'running', seats: 12, starts_on: '2026-09-01', ends_on: '2027-06-30', title: b('Future Leaders cohort 2026', 'دفعة قادة المستقبل 2026'), sort: 20 },
  { id: 'flc-2027', code: 'FL-2027', year: 2027, status: 'open', seats: 12, starts_on: '2027-09-01', ends_on: '2028-06-30', title: b('Future Leaders cohort 2027 (nominations open)', 'دفعة قادة المستقبل 2027 (الترشيحات مفتوحة)'), sort: 30 },
].map((c) => ({ ...c, modules: FL_MODULES, brief: BRIEF, mentor: MENTOR }));

// ───────────────────────────── FS48 · Women in future nuclear skills
export const WFN_PROGRAMMES = [
  {
    id: 'wfn-circles', strand: 'circles', sort: 10, title: b('Mentor circles', 'حلقات الإرشاد'),
    summary: b('Small circles of colleagues with a senior mentor, meeting monthly on a future-skills theme. Open to everyone who opts in, including mentors who support women in nuclear.', 'حلقات صغيرة من الزملاء مع مرشد من كبار القادة تلتقي شهرياً حول موضوع من المهارات المستقبلية. مفتوحة لكل من يختار المشاركة، بمن فيهم المرشدون الداعمون للمرأة في القطاع النووي.'),
    pattern: b('Pattern: a women-in-nuclear surface with mentor matching and a cohort network, as the IAEA promotes.', 'النمط: منصة للمرأة في القطاع النووي تضم مطابقة المرشدين وشبكة للدفعات، كما تروّج الوكالة الدولية للطاقة الذرية.'),
    fact: b('The IAEA states that women are only about a fifth of the nuclear workforce (per source).', 'تذكر الوكالة الدولية للطاقة الذرية أن النساء يشكّلن نحو خُمس القوى العاملة النووية فقط (وفق المصدر).'),
    sources: [SRC.iaeaWomen],
  },
  {
    id: 'wfn-visiting', strand: 'visiting', sort: 20, title: b('Visiting-professional placements', 'تنسيبات المهنيات الزائرات'),
    summary: b('Multi-week placements with a partner team abroad or in the UAE to learn a future skill on the job, then bring it back to your team.', 'تنسيبات لعدة أسابيع مع فريق شريك في الخارج أو في الدولة لتعلّم مهارة مستقبلية أثناء العمل ثم نقلها إلى فريقك.'),
    pattern: b('Pattern: the IAEA Lise Meitner Programme, a multi-week visiting professional programme for early- and mid-career women launched in 2023.', 'النمط: برنامج ليزه مايتنر التابع للوكالة، وهو برنامج للمهنيات الزائرات لعدة أسابيع للنساء في بداية مسيرتهن ومنتصفها، أُطلق في 2023.'),
    fact: b('Launched in 2023 for early- and mid-career women (per source).', 'أُطلق في 2023 للنساء في بداية مسيرتهن المهنية ومنتصفها (وفق المصدر).'),
    sources: [SRC.iaeaWomen, SRC.iaeaMscfp],
  },
  {
    id: 'wfn-sponsored', strand: 'sponsored', sort: 30, title: b('Sponsored study with a placement', 'دراسة مموّلة مع تنسيب'),
    summary: b('Funded study in a future-skills field paired with a placement in an ENEC team, so learning meets real work. Completion, not awards, is the headline measure.', 'دراسة مموّلة في مجال من المهارات المستقبلية مقترنة بتنسيب في أحد فرق المؤسسة، ليلتقي التعلم بالعمل الحقيقي. ومقياس النجاح الرئيسي هو الإتمام لا عدد المنح.'),
    pattern: b('Pattern: the IAEA Marie Sklodowska-Curie Fellowship Programme (launched 2020): funding for a master\'s plus an internship.', 'النمط: برنامج زمالة ماري سكلودوفسكا-كوري التابع للوكالة (أُطلق في 2020): تمويل للماجستير مع تدريب داخلي.'),
    fact: b('About 3,100 applications and 760 women from 129 countries supported as of September 2025; by end-2023 there were 560 fellows, 173 of whom had completed their master\'s (per source).', 'نحو 3,100 طلب ودعم 760 امرأة من 129 دولة حتى سبتمبر 2025؛ وبنهاية 2023 بلغ عدد الزميلات 560، أكملت 173 منهن الماجستير (وفق المصدر).'),
    sources: [SRC.ansMscfp, SRC.iaeaWomen],
  },
];

export const WFN_CIRCLES = [
  { id: 'wc-ai', sort: 10, status: 'active', seats: 6, focus: ['ai_data', 'digital_plant'], skill_ids: ['sk-fs-ai-verify', 'sk-fs-ai-plantdata'], starts_on: '2026-03-01', title: b('AI and data in the plant', 'الذكاء الاصطناعي والبيانات في المحطة'), mentor_role: b('Senior digital I&C engineer (role card)', 'مهندسة أولى للقياس والتحكم الرقمي (بطاقة دور)'), cadence: b('Monthly, 60 minutes', 'شهرياً، 60 دقيقة') },
  { id: 'wc-smr', sort: 20, status: 'active', seats: 6, focus: ['advanced_reactor'], skill_ids: ['sk-fs-adv-smr', 'sk-fs-adv-passive'], starts_on: '2026-04-01', title: b('Advanced reactors and SMRs (no deployment decision implied)', 'المفاعلات المتقدمة والصغيرة (لا يُفهم منها أي قرار نشر)'), mentor_role: b('Reactor engineering lead (role card)', 'قائدة هندسة المفاعلات (بطاقة دور)'), cadence: b('Monthly, 60 minutes', 'شهرياً، 60 دقيقة') },
  { id: 'wc-lead', sort: 30, status: 'active', seats: 8, focus: ['leadership'], skill_ids: ['sk-fs-tr-leadership', 'sk-ld-01'], starts_on: '2026-02-01', title: b('Stepping into leadership', 'الانتقال إلى القيادة'), mentor_role: b('Station director (role card)', 'مديرة محطة (بطاقة دور)'), cadence: b('Every four weeks, 90 minutes', 'كل أربعة أسابيع، 90 دقيقة') },
  { id: 'wc-green', sort: 40, status: 'active', seats: 6, focus: ['green_energy'], skill_ids: ['sk-fs-gr-h2heat', 'sk-fs-gr-esg'], starts_on: '2026-05-01', title: b('Energy transition and hydrogen', 'تحوّل الطاقة والهيدروجين'), mentor_role: b('Sustainability lead (role card)', 'قائدة الاستدامة (بطاقة دور)'), cadence: b('Monthly, 60 minutes', 'شهرياً، 60 دقيقة') },
  { id: 'wc-project', sort: 50, status: 'active', seats: 6, focus: ['project_delivery', 'leadership'], skill_ids: ['sk-en-01-project', 'sk-mp-01-outage'], starts_on: '2026-06-01', title: b('Projects and outages', 'المشاريع والانقطاعات'), mentor_role: b('Outage manager (role card)', 'مديرة الانقطاعات (بطاقة دور)'), cadence: b('Monthly, 60 minutes', 'شهرياً، 60 دقيقة') },
  { id: 'wc-pilot-2025', sort: 90, status: 'closed', seats: 8, focus: ['leadership', 'digital_plant'], skill_ids: ['sk-fs-tr-leadership'], starts_on: '2025-01-15', title: b('Pilot circle 2025 (closed)', 'الحلقة التجريبية 2025 (مغلقة)'), mentor_role: b('Training manager (role card)', 'مديرة التدريب (بطاقة دور)'), cadence: b('Monthly, 60 minutes', 'شهرياً، 60 دقيقة') },
];
export const WFN_OFFERS = [
  { id: 'wo-visit-twin', strand: 'visiting', sort: 10, status: 'open', seats: 2, weeks: 6, months: null, closes_on: '2026-11-30', focus: ['ai_data', 'digital_plant'], title: b('Visiting placement: digital twin team at a partner utility (concept)', 'تنسيب زائر: فريق التوأم الرقمي لدى مرفق شريك (مفهوم)'), host: b('International nuclear operator partner (concept)', 'مشغّل نووي دولي شريك (مفهوم)'), placement: b('Six weeks validating a plant model with the partner\'s twin team.', 'ستة أسابيع في التحقق من نموذج محطة مع فريق التوأم الرقمي لدى الشريك.') },
  { id: 'wo-visit-smr', strand: 'visiting', sort: 20, status: 'open', seats: 2, weeks: 8, months: null, closes_on: '2026-12-15', focus: ['advanced_reactor'], title: b('Visiting placement: SMR design review team (concept, no deployment decision implied)', 'تنسيب زائر: فريق مراجعة تصميم مفاعل صغير (مفهوم، لا يُفهم منه أي قرار نشر)'), host: b('Advanced-reactor vendor partner (concept)', 'مورّد مفاعلات متقدمة شريك (مفهوم)'), placement: b('Eight weeks observing design reviews and passive-safety analysis.', 'ثمانية أسابيع لمتابعة مراجعات التصميم وتحليل السلامة السلبية.') },
  { id: 'wo-visit-hub', strand: 'visiting', sort: 30, status: 'closed', seats: 1, weeks: 4, months: null, closes_on: '2026-09-15', focus: ['leadership'], title: b('Visiting placement: international knowledge hub (concept)', 'تنسيب زائر: مركز معرفة دولي (مفهوم)'), host: b('International organisation partner (concept)', 'منظمة دولية شريكة (مفهوم)'), placement: b('Four weeks with a knowledge-management team.', 'أربعة أسابيع مع فريق لإدارة المعرفة.') },
  { id: 'wo-study-ntm', strand: 'sponsored', sort: 40, status: 'open', seats: 2, weeks: null, months: 24, closes_on: '2027-01-31', focus: ['leadership', 'project_delivery'], title: b('Sponsored master\'s in nuclear technology management, with a placement (concept)', 'ماجستير مموّل في إدارة التكنولوجيا النووية مع تنسيب (مفهوم)'), host: b('INMA-endorsed university (concept)', 'جامعة معتمدة من INMA (مفهوم)'), placement: b('A three-month placement in an ENEC project team during the second year.', 'تنسيب لمدة ثلاثة أشهر في فريق مشاريع بالمؤسسة خلال السنة الثانية.') },
  { id: 'wo-study-data', strand: 'sponsored', sort: 50, status: 'open', seats: 2, weeks: null, months: 18, closes_on: '2027-01-31', focus: ['ai_data'], title: b('Sponsored master\'s in data science for engineering, with a placement (concept)', 'ماجستير مموّل في علوم البيانات للهندسة مع تنسيب (مفهوم)'), host: b('UAE university partner (concept)', 'جامعة شريكة في الدولة (مفهوم)'), placement: b('A three-month placement with the plant data and AI team.', 'تنسيب لمدة ثلاثة أشهر مع فريق بيانات المحطة والذكاء الاصطناعي.') },
  { id: 'wo-study-h2', strand: 'sponsored', sort: 60, status: 'open', seats: 1, weeks: null, months: 12, closes_on: '2026-12-31', focus: ['green_energy'], title: b('Sponsored postgraduate certificate in hydrogen and energy systems, with a placement (concept)', 'شهادة دراسات عليا مموّلة في الهيدروجين وأنظمة الطاقة مع تنسيب (مفهوم)'), host: b('UAE university partner (concept)', 'جامعة شريكة في الدولة (مفهوم)'), placement: b('Six weeks with the energy-transition team on a process-heat study.', 'ستة أسابيع مع فريق تحوّل الطاقة في دراسة للحرارة الصناعية.') },
];
