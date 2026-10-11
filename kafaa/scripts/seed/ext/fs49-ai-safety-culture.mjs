// [FS wave E · E5 · FS49] Safety culture for an AI-augmented plant (M08). Seed rows only for M08's own tables:
//   - kafaa_hu_tools: 4 AI-era HU tool cards (automation bias, mode awareness, over-reliance, verify against the controlled source) and an
//     "AI in the loop" angle, situation cues and drill/lesson links on the 8 classic cards;
//   - kafaa_sc_traits: questioning attitude (trait-2) and decision-making (trait-5, conservative decisions) gain AI behaviours and prompts;
//   - kafaa_oe_lessons: 7 international lessons on automation and digital systems, every one drawn from public material in the FS research
//     packs (IAEA Bulletin, IAEA symposium report, IAEA-TECDOC-1917, EU AI Act Article 4 repository, UNESCO, OECD), each with an https
//     source, the source year and an as-of date. No ENEC events, no people, no figures typed into copy.
// finalize(): FINALIZE_LAST, so F07/F20 (which read OE lessons while they build) see exactly the rows they saw before FS49: no other
// module's seeded rows change. The SQL migration 20261010255001_kafaa_fs55_ai_safety_culture.sql fills the same values into the
// existing live rows with guarded updates (scripts/validate/fs55-ai-safety-culture.mjs proves the replay equals these rows).
import { huCardProblems, lessonProblems, matchSituation, SITUATIONS } from '../../../src/modules/m08/aiCulture.ts';

export const FINALIZE_LAST = true;
export const AS_OF = '2026-10-10';
export const REVIEWED_ON = '2026-10-10';
const b = (en, ar) => ({ en, ar });

/** The "AI in the loop" angle, cues and links added to the 8 classic HU tools (existing rows hu-1..hu-8). */
export const CLASSIC_AI = [
  { id: 'hu-1', sort: 10, cues: ['time_pressure', 'routine'], trait_ids: ['trait-1'], drill_ids: ['ad-valve-lineup'], lesson_ids: ['oe-ai-01'],
    ai: b("With AI in the loop: Stop before acting on a tool's output, Think about what you expected, Act from the controlled procedure, Review the result against the plant.",
      'مع الذكاء الاصطناعي: توقف قبل التصرف بناءً على مخرَج أداة، وفكّر فيما توقعته، ونفّذ من الإجراء الخاضع للرقابة، وراجع النتيجة مقابل المحطة.') },
  { id: 'hu-2', sort: 20, cues: ['handover', 'translation'], trait_ids: ['trait-3'], drill_ids: ['ad-shift-turnover'], lesson_ids: [],
    ai: b("When you pass on a tool's output, say where it came from (\"the summariser says...\"); the receiver repeats it back and you confirm.",
      'عندما تنقل مخرَج أداة، اذكر مصدره («يقول الملخِّص...»)، فيكرره المستلم وتؤكده أنت.') },
  { id: 'hu-3', sort: 30, cues: ['controlled_source', 'summary'], trait_ids: ['trait-10'], drill_ids: ['ad-feedwater-sample'], lesson_ids: ['oe-ai-04'],
    ai: b("The controlled procedure is the authority, never a summary of it: stop when a tool's version and the procedure differ.",
      'الإجراء الخاضع للرقابة هو المرجع لا ملخصه: توقف حين تختلف نسخة الأداة عن الإجراء.') },
  { id: 'hu-4', sort: 40, cues: ['recommendation', 'routine'], trait_ids: ['trait-10'], drill_ids: ['ad-rwp-briefing'], lesson_ids: ['oe-ai-04'],
    ai: b('Brief which tools will be used, what each is approved for, and which steps you will check by hand.',
      'اذكر في الإحاطة الأدوات التي ستُستخدم وما اعتُمدت له كل أداة والخطوات التي ستتحقق منها يدوياً.') },
  { id: 'hu-5', sort: 50, cues: ['disagree', 'confident'], trait_ids: ['trait-2'], drill_ids: ['ad-shift-turnover'], lesson_ids: ['oe-ai-03'],
    ai: b('Question AI outputs like any other input: how does the tool know, and what would prove it wrong? When unsure, stop.',
      'تساءل عن مخرجات الذكاء الاصطناعي كأي مُدخل آخر: كيف تعرف الأداة، وما الذي قد يثبت خطأها؟ وعند الشك توقف.') },
  { id: 'hu-6', sort: 60, cues: ['autofill', 'recommendation'], trait_ids: ['trait-1'], drill_ids: ['ad-mov-pm'], lesson_ids: [],
    ai: b('A tool is not a peer: a colleague still confirms the intended action, especially when a tool prepared it.',
      'الأداة ليست زميلاً: ما زال على زميل أن يؤكد الإجراء المقصود، خصوصاً حين تكون أداة قد أعدّته.') },
  { id: 'hu-7', sort: 70, cues: ['autofill', 'summary'], trait_ids: ['trait-10'], drill_ids: ['ad-requisition-qa'], lesson_ids: ['oe-ai-05'],
    ai: b('An AI check is not an independent verification: the second check is done separately by a qualified person.',
      'التحقق بالذكاء الاصطناعي ليس تحققاً مستقلاً: يجري التحقق الثاني شخص مؤهل بشكل منفصل.') },
  { id: 'hu-8', sort: 80, cues: ['autofill', 'handover'], trait_ids: ['trait-10'], drill_ids: ['ad-mov-pm'], lesson_ids: [],
    ai: b('Mark progress on the controlled procedure, not on a tool-generated checklist.',
      'علّم التقدم على الإجراء الخاضع للرقابة لا على قائمة تحقق ولّدتها أداة.') },
];

/** The four AI-era HU tool cards named in the FS49 card. */
export const AI_CARDS = [
  {
    id: 'hu-ai-bias', kind: 'conditional', sort: 1,
    name: b('Automation bias check', 'فحص انحياز الأتمتة'),
    description: b('Notice when you trust an answer because a tool produced it, and look for the evidence that would prove it wrong.',
      'انتبه حين تثق بإجابة لأن أداة أنتجتها، وابحث عن الدليل الذي قد يثبت خطأها.'),
    trap: b('A fluent, confident output feels finished. You stop reading the source, look only for information that agrees, and miss the one indication that does not.',
      'يبدو المخرَج السلس الواثق مكتملاً، فتتوقف عن قراءة المصدر وتبحث فقط عمّا يوافقه، فيفوتك المؤشر الوحيد الذي يخالفه.'),
    practice: [
      b('Before you read the output, say what you expect it to say.', 'قبل أن تقرأ المخرَج، قل ما تتوقع أن يقوله.'),
      b('Find one independent indication or document that could contradict it.', 'ابحث عن مؤشر أو وثيقة مستقلة قد تناقضه.'),
      b('If they disagree, treat the tool as wrong until the controlled source shows otherwise: stop and ask.', 'إذا اختلفا، فاعتبر الأداة مخطئة إلى أن يُظهر المصدر الخاضع للرقابة غير ذلك: توقف واسأل.'),
    ],
    example: b("Synthetic example: a summary says a pump's valve line-up is complete; the controlled procedure has one more step after the vent valve.",
      'مثال اصطناعي: يقول ملخّص إن اصطفاف صمامات مضخة مكتمل، بينما يتضمن الإجراء الخاضع للرقابة خطوة إضافية بعد صمام التنفيس.'),
    cues: ['confident', 'disagree', 'recommendation', 'time_pressure'], trait_ids: ['trait-2', 'trait-5'],
    drill_ids: ['ad-valve-lineup', 'ad-shift-turnover'], lesson_ids: ['oe-ai-01', 'oe-ai-03'],
  },
  {
    id: 'hu-ai-mode', kind: 'conditional', sort: 2,
    name: b('Mode awareness', 'الوعي بنمط التشغيل'),
    description: b('Know which mode a tool or automated system is in, and which revision, data set and time window its answer is based on.',
      'اعرف النمط الذي تعمل فيه الأداة أو المنظومة المؤتمتة، والمراجعة ومجموعة البيانات والفترة الزمنية التي بُنيت عليها إجابتها.'),
    trap: b("Mode confusion: the system is in automatic when you think it is in manual, or the tool answered from a superseded revision or yesterday's data. \"Why is it doing that?\" is the warning sign.",
      'التباس النمط: المنظومة في الوضع التلقائي وأنت تظنها يدوية، أو أجابت الأداة من مراجعة ملغاة أو من بيانات الأمس. وسؤال «لماذا تفعل ذلك؟» هو علامة التحذير.'),
    practice: [
      b('State the mode aloud in the brief and confirm it with three-way communication.', 'اذكر النمط بصوت مسموع في الإحاطة وأكّده بالاتصال الثلاثي.'),
      b('Check the revision, data date and scope the tool used before you use its answer.', 'تحقق من المراجعة وتاريخ البيانات والنطاق الذي استخدمته الأداة قبل أن تعتمد إجابتها.'),
      b('When the system surprises you, stop, go back to the procedure and ask before acting.', 'عندما تفاجئك المنظومة، توقف وارجع إلى الإجراء واسأل قبل أن تتصرف.'),
    ],
    example: b('Synthetic example: a sampling summary quotes a limit from a superseded revision of the chemistry procedure.',
      'مثال اصطناعي: ملخّص لإجراء أخذ العينات يقتبس حداً من مراجعة ملغاة لإجراء الكيمياء.'),
    cues: ['mode', 'alarm', 'revision', 'disagree'], trait_ids: ['trait-2'],
    drill_ids: ['ad-feedwater-sample', 'ad-requisition-qa'], lesson_ids: ['oe-ai-07', 'oe-ai-02'],
  },
  {
    id: 'hu-ai-reliance', kind: 'conditional', sort: 3,
    name: b('Over-reliance and skill fade', 'الإفراط في الاعتماد وتراجع المهارة'),
    description: b('Keep your own skill and attention in the job when a tool does most of the work.', 'حافظ على مهارتك وانتباهك في العمل حين تؤدي الأداة معظمه.'),
    trap: b('When a tool usually gets it right, checking feels like a waste of time. Attention drifts, pre-filled entries are accepted as read, and the skill to do the task by hand fades.',
      'حين تصيب الأداة عادةً، يبدو التحقق مضيعة للوقت؛ فيتشتت الانتباه وتُقبل الإدخالات المعبأة مسبقاً كأنها قُرئت، وتتراجع مهارة أداء المهمة يدوياً.'),
    practice: [
      b("Keep place on the controlled procedure, not on the tool's checklist.", 'تتبّع موضعك على الإجراء الخاضع للرقابة لا على قائمة الأداة.'),
      b('Read every pre-filled entry as if you had to sign it yourself, because you do.', 'اقرأ كل إدخال معبأ مسبقاً كأنك ستوقّعه بنفسك، لأنك ستفعل.'),
      b('Do the key steps yourself from time to time, and ask for a peer check when the tool did most of the work.', 'نفّذ الخطوات الأساسية بنفسك من حين لآخر، واطلب تحقق زميل حين تكون الأداة قد أدّت معظم العمل.'),
    ],
    example: b('Synthetic example: a generated maintenance checklist drops the torque re-check; the technician who worked from the procedure caught it.',
      'مثال اصطناعي: قائمة صيانة مولّدة تُسقط إعادة فحص عزم الربط، فاكتشف ذلك الفني الذي عمل من الإجراء.'),
    cues: ['autofill', 'routine', 'time_pressure', 'handover'], trait_ids: ['trait-1', 'trait-5'],
    drill_ids: ['ad-mov-pm', 'ad-rwp-briefing'], lesson_ids: ['oe-ai-05', 'oe-ai-06'],
  },
  {
    id: 'hu-ai-verify', kind: 'core', sort: 4,
    name: b('Verify against the controlled source', 'التحقق مقابل المصدر الخاضع للرقابة'),
    description: b('A summary, translation or answer from a tool is a pointer. The controlled document at its current revision is the authority.',
      'الملخص أو الترجمة أو الإجابة من أداة مجرد مؤشر؛ أما الوثيقة الخاضعة للرقابة بمراجعتها الحالية فهي المرجع.'),
    trap: b("Using a tool's summary in place of the procedure: values, order and omitted steps go unchecked, and an unsupported conclusion slips in.",
      'استخدام ملخص الأداة بدلاً من الإجراء، فلا تُفحص القيم والترتيب والخطوات المحذوفة، ويتسلل استنتاج غير مدعوم.'),
    practice: [
      b('Open the controlled document at its current revision.', 'افتح الوثيقة الخاضعة للرقابة بمراجعتها الحالية.'),
      b('Compare values, step order, missing steps and anything the tool added or concluded.', 'قارن القيم وترتيب الخطوات والخطوات الناقصة وأي شيء أضافته الأداة أو استنتجته.'),
      b("Work from the controlled document; record what you checked and report the tool's error.", 'اعمل من الوثيقة الخاضعة للرقابة، وسجّل ما تحققت منه، وأبلغ عن خطأ الأداة.'),
    ],
    example: b('Synthetic example: an Arabic translation of a step reverses two actions; the English controlled procedure shows the right order.',
      'مثال اصطناعي: ترجمة عربية لخطوة تعكس إجراءين، بينما يُظهر الإجراء الإنجليزي الخاضع للرقابة الترتيب الصحيح.'),
    cues: ['summary', 'controlled_source', 'revision', 'translation'], trait_ids: ['trait-2', 'trait-5'],
    drill_ids: ['ad-valve-lineup', 'ad-feedwater-sample', 'ad-requisition-qa'], lesson_ids: ['oe-ai-01', 'oe-ai-04'],
  },
];

/** Questioning attitude and conservative decision-making, with AI and automation in the loop. */
export const TRAIT_AI = [
  {
    id: 'trait-2', ai_hu_ids: ['hu-ai-bias', 'hu-ai-verify', 'hu-5'],
    ai_behaviours: [
      b('Asks how the tool knows before using an output: which data, which revision, which time window.', 'يسأل كيف تعرف الأداة قبل استخدام مخرَجها: أي بيانات، وأي مراجعة، وأي فترة زمنية.'),
      b('Treats a confident, fluent answer as a claim to check, not as a fact.', 'يعامل الإجابة الواثقة السلسة كادعاء يُتحقق منه لا كحقيقة.'),
      b('Stops when a tool and a plant indication disagree, and resolves it with the controlled source.', 'يتوقف حين تختلف الأداة ومؤشر المحطة، ويحسم الأمر بالمصدر الخاضع للرقابة.'),
      b('Reports a wrong or surprising output so others learn from it.', 'يبلّغ عن المخرَج الخاطئ أو المفاجئ ليتعلم منه الآخرون.'),
    ],
    ai_prompts: [
      b('When did a tool last tell you something you did not expect? What did you do next?', 'متى أخبرتك أداة آخر مرة بشيء لم تتوقعه؟ وماذا فعلت بعدها؟'),
      b('Which tool output would you be least likely to question, and why?', 'أي مخرَج لأداة هو الأقل احتمالاً أن تتساءل عنه، ولماذا؟'),
    ],
  },
  {
    id: 'trait-5', ai_hu_ids: ['hu-ai-reliance', 'hu-ai-mode', 'hu-4'],
    ai_behaviours: [
      b("When a model's recommendation and conservative judgement differ, takes the conservative path and escalates.", 'حين تختلف توصية النموذج عن الحكم المتحفظ، يسلك الطريق المتحفظ ويصعّد الأمر.'),
      b('Uses a tool to inform a decision, never to own it: the decision and its basis stay with a person.', 'يستخدم الأداة لدعم القرار لا لامتلاكه: يبقى القرار وأساسه لدى شخص.'),
      b("Says in the brief which parts of a decision rest on a tool's output.", 'يوضح في الإحاطة أي أجزاء القرار تستند إلى مخرَج أداة.'),
      b("Does not let time pressure turn a tool's all-clear into permission to proceed.", 'لا يسمح لضغط الوقت بأن يحوّل إشارة «لا مشكلة» من أداة إلى إذن بالمضي.'),
    ],
    ai_prompts: [
      b('Think of a decision a tool informed. Could you explain its basis without the tool?', 'فكّر في قرار دعمته أداة. هل يمكنك شرح أساسه من دون الأداة؟'),
      b("What would make you set a tool's recommendation aside?", 'ما الذي يجعلك تضع توصية الأداة جانباً؟'),
    ],
  },
];

const IAEA_BULLETIN = { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence', year: 2025, as_of: AS_OF };
const NEI_SYMPOSIUM = { label: 'NEI Magazine · IAEA hosts first AI nuclear symposium', url: 'https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/', year: 2025, as_of: AS_OF };
const TECDOC_1917 = { label: 'IAEA-TECDOC-1917 · Assessing Behavioural Competencies of Employees in Nuclear Facilities', url: 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf', year: 2020, as_of: AS_OF };
const EU_ART4 = { label: 'European Commission · Repository of AI literacy practices (AI Act Article 4)', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices', year: 2025, as_of: AS_OF };
const EU_REPO_2026 = { label: 'European Commission · Repository of AI literacy practices (page updated July 2026)', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices', year: 2026, as_of: AS_OF };
const UNESCO_AICF = { label: 'UNESCO AI competency frameworks (GCED Clearinghouse record)', url: 'https://gcedclearinghouse.org/en/node/146447', year: 2024, as_of: AS_OF };
const OECD_AICI = { label: 'OECD AI Capability Indicators · technical report', url: 'https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report', year: 2025, as_of: AS_OF };

/** International lessons on automation and digital systems (public guidance only; research packs nuclear_energy.md, corporate_platforms.md, global_frameworks.md). */
export const AI_LESSONS = [
  {
    id: 'oe-ai-01', source_kind: 'IAEA', sources: [IAEA_BULLETIN], trait_ids: ['trait-2', 'trait-5'], hu_ids: ['hu-ai-bias', 'hu-ai-verify', 'hu-1'], drill_ids: ['ad-mov-pm', 'ad-valve-lineup'],
    title: b('Digital twins and predictive maintenance are models of the plant', 'التوائم الرقمية والصيانة التنبؤية نماذج للمحطة'),
    summary: b('The IAEA Bulletin describes digital twins as AI-enhanced tools that analyse plant data to improve operations, and predictive maintenance as relying on digital replicas of real facilities.',
      'تصف نشرة الوكالة الدولية للطاقة الذرية التوائم الرقمية بأنها أدوات معززة بالذكاء الاصطناعي تحلل بيانات المحطة لتحسين التشغيل، وتصف الصيانة التنبؤية بأنها تعتمد على نسخ رقمية من المنشآت الفعلية.'),
    lesson: b('A twin or advisor is a model of the plant, not the plant: confirm its recommendation against plant indications and the controlled documents before you act on it.',
      'التوأم أو المستشار نموذج للمحطة وليس المحطة نفسها: تحقق من توصيته مقابل مؤشرات المحطة والوثائق الخاضعة للرقابة قبل أن تتصرف بناءً عليها.'),
  },
  {
    id: 'oe-ai-02', source_kind: 'IAEA', sources: [NEI_SYMPOSIUM], trait_ids: ['trait-4', 'trait-7'], hu_ids: ['hu-ai-mode', 'hu-4'], drill_ids: [],
    title: b('AI is arriving across the nuclear industry', 'الذكاء الاصطناعي يدخل قطاع الطاقة النووية بأكمله'),
    summary: b('The IAEA held its first symposium on AI and nuclear energy at its Vienna headquarters, framed as "Atoms for Algorithms" (reported December 2025).',
      'عقدت الوكالة الدولية للطاقة الذرية أول ندوة لها عن الذكاء الاصطناعي والطاقة النووية في مقرها بفيينا تحت شعار «الذرّات من أجل الخوارزميات» (بحسب تقرير ديسمبر 2025).'),
    lesson: b('Treat a new AI tool as a change to how work is done: brief it, train people on it, and keep the duty to challenge its output with the person doing the work.',
      'تعامل مع أداة الذكاء الاصطناعي الجديدة كتغيير في طريقة العمل: قدّم لها إحاطة، ودرّب الناس عليها، وأبقِ واجب الاعتراض على مخرجاتها لدى من يؤدي العمل.'),
  },
  {
    id: 'oe-ai-03', source_kind: 'IAEA', sources: [TECDOC_1917], trait_ids: ['trait-2', 'trait-5'], hu_ids: ['hu-5', 'hu-ai-bias'], drill_ids: ['ad-shift-turnover'],
    title: b('Questioning an output is a behaviour that can be observed', 'التساؤل عن المخرَج سلوك يمكن ملاحظته'),
    summary: b('IAEA-TECDOC-1917 (2020) gives nuclear organisations methods to assess behavioural competencies, including structured interviews, simulation observation, 360-degree feedback and situational judgement.',
      'تقدّم الوثيقة التقنية IAEA-TECDOC-1917 (2020) للمنظمات النووية أساليب لتقييم الكفاءات السلوكية، منها المقابلات المنظمة وملاحظة المحاكاة والتغذية الراجعة الشاملة والحكم الظرفي.'),
    lesson: b('Challenging an AI output is part of a questioning attitude: practise it in situational-judgement practice and AI drills, and expect it to be observed in simulator debriefs.',
      'الاعتراض على مخرَج الذكاء الاصطناعي جزء من موقف التساؤل: تدرّب عليه في تمارين الحكم الظرفي وتمارين الذكاء الاصطناعي، وتوقّع أن يُلاحَظ في جلسات المراجعة بعد المحاكاة.'),
  },
  {
    id: 'oe-ai-04', source_kind: 'EU AI Office', sources: [EU_ART4], trait_ids: ['trait-1'], hu_ids: ['hu-ai-verify', 'hu-3', 'hu-4'], drill_ids: [],
    title: b('AI literacy goes with every system people use', 'الإلمام بالذكاء الاصطناعي يرافق كل نظام يستخدمه الناس'),
    summary: b("Article 4 of the EU AI Act, in application since 2 February 2025, asks providers and deployers of AI systems to ensure a sufficient level of AI literacy among the staff who use them. It does not bind ENEC; Kafa'a uses it as a voluntary international reference.",
      'تطلب المادة 4 من قانون الذكاء الاصطناعي الأوروبي، السارية منذ 2 فبراير 2025، من مزوّدي أنظمة الذكاء الاصطناعي ومستخدميها ضمان مستوى كافٍ من الإلمام بالذكاء الاصطناعي لدى الموظفين الذين يستخدمونها. وهي لا تُلزم ENEC، وتستخدمها كفاءة مرجعاً دولياً طوعياً.'),
    lesson: b("Before you rely on a tool's output, know what that tool is approved for and complete the literacy measure listed for it in the AI-literacy register.",
      'قبل أن تعتمد على مخرَج أداة، اعرف ما اعتُمدت له تلك الأداة وأكمل إجراء الإلمام المدرج لها في سجل الإلمام بالذكاء الاصطناعي.'),
  },
  {
    id: 'oe-ai-05', source_kind: 'EU AI Office', sources: [EU_REPO_2026], trait_ids: ['trait-1', 'trait-7'], hu_ids: ['hu-ai-reliance', 'hu-7'], drill_ids: ['ad-rwp-briefing'],
    title: b('Completing a course is not the same as safe use', 'إتمام دورة لا يعني الاستخدام الآمن'),
    summary: b('The European Commission states that replicating the practices in its living repository of AI literacy practices does not automatically grant presumption of compliance with Article 4.',
      'تنص المفوضية الأوروبية على أن تكرار الممارسات الواردة في مستودعها الحي لممارسات الإلمام بالذكاء الاصطناعي لا يمنح تلقائياً افتراض الامتثال للمادة 4.'),
    lesson: b('A completion record shows that training happened, not that a person uses a tool safely: show it in the work, in drills, peer checks and observed practice.',
      'يُثبت سجل الإتمام أن التدريب حدث، لا أن الشخص يستخدم الأداة بأمان: أظهِر ذلك في العمل وفي التمارين وتحقق الزملاء والممارسة الملاحَظة.'),
  },
  {
    id: 'oe-ai-06', source_kind: 'UNESCO', sources: [UNESCO_AICF], trait_ids: ['trait-1', 'trait-5'], hu_ids: ['hu-ai-reliance'], drill_ids: [],
    title: b('Keep a human-centred mindset', 'حافظ على عقلية تتمحور حول الإنسان'),
    summary: b("UNESCO's AI competency frameworks (2024) place a human-centred mindset and the ethics of AI alongside AI techniques and system design, with progression from understanding to applying and creating.",
      'تضع أطر كفاءات الذكاء الاصطناعي لدى اليونسكو (2024) العقلية المتمحورة حول الإنسان وأخلاقيات الذكاء الاصطناعي إلى جانب تقنيات الذكاء الاصطناعي وتصميم أنظمته، مع تدرّج من الفهم إلى التطبيق والإبداع.'),
    lesson: b('The person stays accountable for a decision a tool informed: keep human judgement and the ethics of use ahead of convenience.',
      'يبقى الشخص مسؤولاً عن القرار الذي دعمته أداة: قدّم الحكم البشري وأخلاقيات الاستخدام على السهولة.'),
  },
  {
    id: 'oe-ai-07', source_kind: 'OECD', sources: [OECD_AICI], trait_ids: ['trait-2'], hu_ids: ['hu-ai-mode'], drill_ids: ['ad-requisition-qa'],
    title: b("Know where a tool's capability ends", 'اعرف أين تنتهي قدرة الأداة'),
    summary: b('The OECD AI Capability Indicators (2025) rate what AI systems can do across capability dimensions such as language, problem solving and metacognition, on a five-level scale, so it can be compared with what a task requires of people.',
      'تقيّم مؤشرات قدرات الذكاء الاصطناعي لدى منظمة التعاون الاقتصادي والتنمية (2025) ما تستطيع أنظمة الذكاء الاصطناعي فعله عبر أبعاد قدرات مثل اللغة وحل المشكلات وما وراء المعرفة، على مقياس من خمسة مستويات، لمقارنته بما تتطلبه المهمة من الإنسان.'),
    lesson: b('A tool that is strong with language can still be weak at judgement: match how hard you check to the gap between what the task needs and what the tool can do.',
      'قد تكون الأداة قوية في اللغة وضعيفة في الحكم: اجعل مقدار تحققك على قدر الفجوة بين ما تتطلبه المهمة وما تستطيعه الأداة.'),
  },
];

/** The values FS49 adds to an existing classic HU row (also written by the migration's guarded update). */
export function classicPatch(c) {
  return { topic: 'classic', sort: c.sort, ai_en: c.ai.en, ai_ar: c.ai.ar, cues: c.cues, trait_ids: c.trait_ids, drill_ids: c.drill_ids, lesson_ids: c.lesson_ids };
}
export function aiCardRow(c) {
  return {
    id: c.id, name_en: c.name.en, name_ar: c.name.ar, description_en: c.description.en, description_ar: c.description.ar, kind: c.kind,
    topic: 'ai_automation', sort: c.sort, ai_en: '', ai_ar: '', trap_en: c.trap.en, trap_ar: c.trap.ar, practice: c.practice,
    example_en: c.example.en, example_ar: c.example.ar, cues: c.cues, trait_ids: c.trait_ids, drill_ids: c.drill_ids, lesson_ids: c.lesson_ids,
  };
}
export function lessonRow(l) {
  return {
    id: l.id, title_en: l.title.en, title_ar: l.title.ar, summary_en: l.summary.en, summary_ar: l.summary.ar, lesson_en: l.lesson.en, lesson_ar: l.lesson.ar,
    source_kind: l.source_kind, trait_ids: l.trait_ids, reviewed_on: REVIEWED_ON, reviewing_body: 'OE Screening Committee', deidentified: true,
    status: 'published', affected_standard_ids: [], sample: false, topic: 'ai_automation', sources: l.sources, hu_ids: l.hu_ids, drill_ids: l.drill_ids,
  };
}
export function traitPatch(t) {
  return { ai_behaviours: t.ai_behaviours, ai_prompts: t.ai_prompts, ai_hu_ids: t.ai_hu_ids };
}

export default function build() {}

export function finalize(T) {
  const fail = (m) => { throw new Error(`fs49: ${m}`); };
  // existing rows gain the FS49 columns (defaults first, so every row has them)
  for (const h of T.hu_tools) Object.assign(h, { topic: 'classic', sort: 0, ai_en: '', ai_ar: '', trap_en: '', trap_ar: '', practice: [], example_en: '', example_ar: '', cues: [], trait_ids: [], drill_ids: [], lesson_ids: [] }, { ...h });
  for (const c of CLASSIC_AI) {
    const h = T.hu_tools.find((x) => x.id === c.id) ?? fail(`missing classic HU row ${c.id}`);
    Object.assign(h, classicPatch(c));
  }
  for (const c of AI_CARDS) if (!T.hu_tools.some((x) => x.id === c.id)) T.hu_tools.push(aiCardRow(c));
  for (const t of T.sc_traits) Object.assign(t, { ai_behaviours: [], ai_prompts: [], ai_hu_ids: [] }, { ...t });
  for (const p of TRAIT_AI) Object.assign(T.sc_traits.find((x) => x.id === p.id) ?? fail(`missing trait ${p.id}`), traitPatch(p));
  for (const o of T.oe_lessons) Object.assign(o, { topic: 'general', sources: [], hu_ids: [], drill_ids: [] }, { ...o });
  for (const l of AI_LESSONS) if (!T.oe_lessons.some((x) => x.id === l.id)) T.oe_lessons.push(lessonRow(l));

  // self-checks: the same rules the database trigger applies, with references
  const drills = (T.ai_drills ?? []).map((d) => d.id);
  const live = new Set((T.ai_drills ?? []).filter((d) => d.status === 'published' && d.listed).map((d) => d.id));
  const refs = { drills, lessons: T.oe_lessons.map((o) => o.id), traits: T.sc_traits.map((t) => t.id) };
  for (const h of T.hu_tools) {
    const p = huCardProblems(h, refs);
    if (p.length) fail(`HU card ${h.id}: ${p.join(', ')}`);
    if (![...h.drill_ids.filter((d) => live.has(d)), ...h.lesson_ids].length) fail(`HU card ${h.id} links no live drill or lesson`);
  }
  for (const o of T.oe_lessons) { const p = lessonProblems(o, { drills }); if (p.length) fail(`lesson ${o.id}: ${p.join(', ')}`); }
  const huIds = new Set(T.hu_tools.map((h) => h.id));
  for (const o of T.oe_lessons) for (const h of o.hu_ids) if (!huIds.has(h)) fail(`lesson ${o.id} links unknown HU card ${h}`);
  for (const s of SITUATIONS) if (matchSituation(s.id, T.hu_tools).length === 0) fail(`situation ${s.id} matches no HU card`);
  console.log(`fs49: ${AI_CARDS.length} AI-era HU cards + ${CLASSIC_AI.length} classic cards with an AI angle (every card links a drill or lesson), ${TRAIT_AI.length} traits extended, ${AI_LESSONS.length} sourced international lessons`);
}
