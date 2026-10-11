// FS23 content (FS wave C · E4, module M02): generic level attributes, behaviour families and per-skill anchors.
// Data only (no default export): scripts/seed/ext/fs23-descriptors.mjs composes the 120 skills' descriptors from it.
//
// How a descriptor is written: each skill belongs to one behaviour family (plant, maintenance, radiation and chemistry, engineering,
// safety and quality, emergency, behavioural, digital and AI, green, advanced reactors, cyber hygiene). A family gives, per level, a
// level-essence line and four observable indicator patterns written as what an assessor sees someone do (SFIA 9 level essence;
// IAEA-TECDOC-1917: behaviour is assessed with the same evidence as technical work). Each skill gives three anchors that make the
// patterns specific: {o} what the skill is about, {s} a situation that tests it, {w} the record or work product it leaves.
// Patterns never reuse the old template sentences (descriptors.ts TEMPLATE_PATTERNS); Arabic patterns avoid pronouns that would have
// to agree with an anchor's gender.

/** Generic level attributes across all skills (SFIA 9 style). sfia = the SFIA 9 levels of responsibility each level corresponds to. */
export const LEVEL_ATTRIBUTES = {
  names: {
    essence: ['Level essence', 'جوهر المستوى'], autonomy: ['Autonomy', 'الاستقلالية'], influence: ['Influence', 'التأثير'],
    complexity: ['Complexity', 'التعقيد'], knowledge: ['Knowledge', 'المعرفة'], behaviours: ['Behaviours', 'السلوكيات'],
  },
  sfia: { 1: '1-2', 2: '3', 3: '4', 4: '5' },
  levels: {
    1: {
      essence: ['Knows what the skill is for and why it matters for safety; uses it only with guidance.', 'يعرف الغرض من المهارة وأهميتها للسلامة، ولا يمارسها إلا بتوجيه.'],
      autonomy: ['Works under close direction; every task is checked.', 'يعمل تحت توجيه مباشر، وتُراجَع كل مهمة.'],
      influence: ['Interacts mainly with own team and passes on information accurately.', 'يتفاعل أساساً مع فريقه، وينقل المعلومات بدقة.'],
      complexity: ['Routine, well-defined tasks with a procedure for every step.', 'مهام روتينية محددة بوضوح، لكل خطوة فيها إجراء.'],
      knowledge: ['Basic facts and terms, and the reasons behind the main rules.', 'حقائق ومصطلحات أساسية، والأسباب الكامنة وراء القواعد الرئيسية.'],
      behaviours: ['Asks questions, reports concerns and accepts correction.', 'يطرح الأسئلة، ويبلّغ عن المخاوف، ويتقبّل التصحيح.'],
    },
    2: {
      essence: ['Does routine work with the skill reliably while a qualified person checks the result.', 'يؤدي الأعمال الروتينية بالمهارة بموثوقية، بينما يراجع شخص مؤهل النتيجة.'],
      autonomy: ['Works under general direction on routine tasks and asks when conditions change.', 'يعمل بتوجيه عام في المهام الروتينية، ويستوضح عند تغيّر الظروف.'],
      influence: ['Works with other teams on shared tasks and reports status clearly.', 'يعمل مع فرق أخرى في المهام المشتركة، ويبلّغ عن الحالة بوضوح.'],
      complexity: ['A range of routine tasks with some variation and known problems.', 'مجموعة من المهام الروتينية مع بعض التنوع والمشكلات المعروفة.'],
      knowledge: ['Working knowledge of the procedures, the equipment and their limits.', 'معرفة عملية بالإجراءات والمعدات وحدودها.'],
      behaviours: ['Uses the human performance tools without prompting and records work fully.', 'يستخدم أدوات الأداء البشري دون تذكير، ويوثّق العمل كاملاً.'],
    },
    3: {
      essence: ['Works alone to the qualification standard, in normal and abnormal conditions.', 'يعمل منفرداً وفق معيار التأهيل، في الظروف العادية وغير العادية.'],
      autonomy: ['Plans and performs own work without supervision and is accountable for the result.', 'يخطط عمله وينفّذه دون إشراف، ويتحمّل مسؤولية النتيجة.'],
      influence: ['Checks others\' work, briefs the team and influences decisions in own area.', 'يراجع عمل الآخرين ويقدّم الإحاطات للفريق، ويؤثر في القرارات ضمن نطاقه.'],
      complexity: ['Varied and non-routine work, including off-normal conditions.', 'أعمال متنوعة وغير روتينية، بما في ذلك الظروف غير الاعتيادية.'],
      knowledge: ['Deep knowledge of the systems and of the reasoning behind the procedures.', 'معرفة معمّقة بالأنظمة وبالمنطق الكامن وراء الإجراءات.'],
      behaviours: ['Makes conservative decisions under pressure and stops work when unsure.', 'يتخذ قرارات متحفظة تحت الضغط ويوقف العمل عند الشك.'],
    },
    4: {
      essence: ['Sets the standard for the skill across ENEC and grows the people who hold it.', 'يضع المعيار للمهارة على مستوى المؤسسة ويطوّر من يمتلكونها.'],
      autonomy: ['Sets the direction for the skill and decides within broad policy.', 'يحدد توجّه المهارة، ويتخذ القرارات ضمن السياسة العامة.'],
      influence: ['Influences across units and with external peers; the advice given shapes decisions.', 'يؤثر عبر الوحدات ومع النظراء الخارجيين، وتُسهم المشورة المقدمة في صنع القرار.'],
      complexity: ['Complex, novel problems with incomplete information and high consequences.', 'مشكلات معقدة وجديدة بمعلومات ناقصة وعواقب كبيرة.'],
      knowledge: ['Authoritative knowledge, including industry experience and the regulatory basis.', 'معرفة مرجعية تشمل خبرة القطاع والأساس التنظيمي.'],
      behaviours: ['Models the safety culture, develops others and challenges the organisation constructively.', 'يجسّد ثقافة السلامة، ويطوّر الآخرين، ويتحدى المؤسسة بشكل بنّاء.'],
    },
  },
};

/** Behaviour families: per level an essence pattern, four indicator patterns ([en, ar]) and the evidence modes. */
export const FAMILIES = {
  plant: {
    1: { e: ['Knows why {o} matters to the plant and spots obvious abnormal signs.', 'يعرف أهمية {o} للمحطة ويلاحظ العلامات غير الطبيعية الواضحة.'], m: ['interview', 'records'], i: [
      ['Names the main elements of {o} and the safety function each one serves.', 'يسمّي العناصر الرئيسية في {o} ووظيفة السلامة التي يخدمها كل عنصر.'],
      ['Reports {s} to the responsible operator instead of acting alone.', 'يبلّغ عن {s} إلى المشغّل المسؤول بدلاً من التصرف منفرداً.'],
      ['Finds the right procedure or drawing for {o} when asked.', 'يجد الإجراء أو المخطط الصحيح المتعلق بـ{o} عند الطلب.'],
      ['Says in plain words why {o} matters for keeping the reactor safe.', 'يوضح بكلمات بسيطة أهمية {o} للحفاظ على سلامة المفاعل.'] ] },
    2: { e: ['Handles routine work involving {o} while a supervisor checks each step.', 'يتولى الأعمال الروتينية المتعلقة بـ{o} بينما يراجع المشرف كل خطوة.'], m: ['observation', 'jpm', 'records'], i: [
      ['Carries out routine tasks involving {o} with a supervisor present, placekeeping each step.', 'ينفّذ المهام الروتينية المتعلقة بـ{o} بحضور مشرف، مع تعليم كل خطوة عند إنجازها.'],
      ['Reads the plant indications linked to {o} and logs them accurately in {w}.', 'يقرأ مؤشرات المحطة المرتبطة بـ{o} ويسجّلها بدقة في {w}.'],
      ['Recognises {s} and applies the first response steps the procedure gives.', 'يتعرّف على {s} ويطبّق خطوات الاستجابة الأولى التي يحددها الإجراء.'],
      ['Uses three-way communication when reporting on {o}.', 'يستخدم الاتصال الثلاثي عند الإبلاغ عن {o}.'] ] },
    3: { e: ['Applies {o} alone in normal and abnormal conditions and makes the conservative call.', 'يطبّق {o} منفرداً في الظروف العادية وغير العادية ويتخذ القرار المتحفظ.'], m: ['simulator', 'jpm', 'observation'], i: [
      ['Applies {o} without supervision in normal and abnormal plant conditions, to the qualification standard.', 'يطبّق {o} دون إشراف في ظروف المحطة العادية وغير العادية وفق معيار التأهيل.'],
      ['Diagnoses {s} from plant indications and chooses the conservative action.', 'يشخّص أسباب {s} من مؤشرات المحطة ويختار الإجراء المتحفظ.'],
      ['Checks the work of others involving {o} and stops the job when a result is unexpected.', 'يراجع عمل الآخرين المتعلق بـ{o} ويوقف العمل عند ظهور نتيجة غير متوقعة.'],
      ['Briefs the crew on the risks of tasks involving {o} before they start.', 'يقدّم للطاقم إحاطة بمخاطر المهام المتعلقة بـ{o} قبل بدئها.'] ] },
    4: { e: ['Sets the standard for {o} and prepares the next generation of qualified staff.', 'يضع المعيار في {o} ويُعدّ الجيل التالي من الكوادر المؤهلة.'], m: ['work_product', 'peer', 'interview'], i: [
      ['Sets the standard for {o}: reviews procedures and proposes improvements from operating experience.', 'يضع المعيار في {o}: يراجع الإجراءات ويقترح تحسينات مستندة إلى الخبرة التشغيلية.'],
      ['Leads the analysis of {s} and shares the lessons across crews.', 'يقود تحليل {s} وينقل الدروس المستفادة إلى جميع الأطقم.'],
      ['Designs simulator scenarios and observations that test mastery of {o}.', 'يصمّم سيناريوهات المحاكي وعمليات الملاحظة التي تختبر الإتقان في {o}.'],
      ['Is consulted across units on {o}; the advice given is recorded in {w}.', 'يُستشار عبر الوحدات في {o}، وتُوثَّق المشورة المقدمة في {w}.'] ] },
  },
  maintenance: {
    1: { e: ['Knows the safe way to carry out {o} and the most common errors.', 'يعرف الطريقة الآمنة لأداء {o} وأبرز الأخطاء الشائعة.'], m: ['interview', 'records'], i: [
      ['Identifies the isolations and permits needed before {o} starts.', 'يحدد العوازل والتصاريح اللازمة قبل بدء {o}.'],
      ['Prepares tools and parts for {o} as directed and checks they are the right ones.', 'يجهّز الأدوات وقطع الغيار اللازمة لـ{o} حسب التوجيه، ويتحقق من مطابقتها.'],
      ['Points out {s} to the job lead.', 'ينبّه قائد العمل إلى {s}.'],
      ['Keeps to the foreign material exclusion rules at the work site.', 'يلتزم بقواعد منع دخول المواد الغريبة في موقع العمل.'] ] },
    2: { e: ['Performs the steps of {o} reliably while a qualified technician checks the result.', 'ينفّذ خطوات {o} بموثوقية بينما يراجع فني مؤهل النتيجة.'], m: ['observation', 'jpm', 'records'], i: [
      ['Performs the work-package steps of {o} beside a qualified technician, signing each step.', 'ينفّذ خطوات حزمة العمل في {o} بجانب فني مؤهل، ويوقّع على كل خطوة.'],
      ['Records as-found and as-left values in {w} without gaps.', 'يسجّل القيم قبل العمل وبعده في {w} دون نقص.'],
      ['Stops and checks with the job lead when the plant condition differs from the work package.', 'يتوقف ويراجع قائد العمل عندما تختلف حالة المحطة عن حزمة العمل.'],
      ['Uses self-checking (STAR) on every component manipulation.', 'يطبّق الفحص الذاتي (STAR) عند كل تعامل مع المكونات.'] ] },
    3: { e: ['Completes {o} alone, first time right, and returns equipment ready for service.', 'ينجز {o} منفرداً ومن المحاولة الأولى، ويعيد المعدات جاهزة للخدمة.'], m: ['jpm', 'work_product', 'observation'], i: [
      ['Completes {o} without supervision to the work package, first time right.', 'ينجز {o} دون إشراف وفق حزمة العمل ومن المحاولة الأولى.'],
      ['Traces the cause of {s} and documents it in {w}.', 'يتتبّع أسباب {s} ويوثّقها في {w}.'],
      ['Leads the pre-job brief and the post-job review for {o}.', 'يقود إحاطة ما قبل العمل ومراجعة ما بعده في {o}.'],
      ['Verifies post-maintenance testing before equipment returns to operations.', 'يتحقق من اختبارات ما بعد الصيانة قبل عودة المعدات إلى التشغيل.'] ] },
    4: { e: ['Sets the long-term approach to {o} and qualifies the technicians who do it.', 'يضع النهج طويل الأمد في {o} ويؤهّل الفنيين الذين يؤدونه.'], m: ['work_product', 'records', 'peer'], i: [
      ['Sets the long-term strategy for {o} from failure trends and operating experience.', 'يضع الاستراتيجية طويلة الأمد في {o} مستنداً إلى اتجاهات الأعطال والخبرة التشغيلية.'],
      ['Reviews and improves the work packages and technical instructions for {o}.', 'يراجع حزم العمل والتعليمات الفنية في {o} ويحسّنها.'],
      ['Leads the root-cause analysis of {s} and sees the corrective actions closed.', 'يقود تحليل الأسباب الجذرية لـ{s} ويتابع إغلاق الإجراءات التصحيحية.'],
      ['Assesses technicians\' performance in {o} for qualification.', 'يقيّم أداء الفنيين في {o} لأغراض التأهيل.'] ] },
  },
  radchem: {
    1: { e: ['Understands the role of {o} in protecting people and the plant, and keeps to the controls.', 'يدرك دور {o} في حماية الأفراد والمحطة، ويلتزم بالضوابط.'], m: ['interview', 'records'], i: [
      ['Keeps to the radiological and chemistry controls posted for {o}.', 'يلتزم بالضوابط الإشعاعية والكيميائية المعلنة المتعلقة بـ{o}.'],
      ['Reports {s} straight away to the radiation protection or chemistry technician.', 'يبلّغ فوراً فني الوقاية الإشعاعية أو الكيمياء عن {s}.'],
      ['Reads a dosimeter or a sample label correctly and knows the stop limits.', 'يقرأ مقياس الجرعات أو ملصق العينة بشكل صحيح ويعرف حدود التوقف.'],
      ['Describes the units and limits used in {o}.', 'يصف الوحدات والحدود المستخدمة في {o}.'] ] },
    2: { e: ['Works on {o} to procedure and records results a qualified technician can trust.', 'يعمل في {o} وفق الإجراء ويسجّل نتائج يمكن لفني مؤهل الوثوق بها.'], m: ['observation', 'jpm', 'records'], i: [
      ['Performs {o} tasks to procedure with a qualified technician checking the results.', 'ينفّذ مهام {o} وفق الإجراء بينما يراجع فني مؤهل النتائج.'],
      ['Records results in {w} with the units, time and instrument identified.', 'يسجّل النتائج في {w} مع الوحدات والوقت ورقم الجهاز.'],
      ['Checks {s} against the action level and notifies the shift.', 'يتحقق من {s} مقارنةً بمستوى الإجراء ويُخطر النوبة.'],
      ['Checks instrument calibration and source checks before use.', 'يتحقق من معايرة الجهاز وفحص المصدر قبل الاستخدام.'] ] },
    3: { e: ['Runs {o} alone and decides when a result needs a resample or a hold.', 'يدير {o} منفرداً ويقرر متى تحتاج النتيجة إلى إعادة أخذ العينة أو إلى إيقاف.'], m: ['work_product', 'observation', 'records'], i: [
      ['Runs {o} without supervision and decides when a result needs a resample or a hold.', 'يدير {o} دون إشراف ويقرر متى تحتاج النتيجة إلى إعادة أخذ العينة أو إلى إيقاف.'],
      ['Interprets trends in {w} and advises operations on {s}.', 'يفسّر الاتجاهات في {w} ويقدّم المشورة للتشغيل بشأن {s}.'],
      ['Plans the controls for a job so that exposure stays as low as reasonably achievable.', 'يخطط ضوابط العمل بحيث يبقى التعرض عند أدنى مستوى ممكن عملياً.'],
      ['Challenges a job that does not meet the controls, whatever the schedule pressure.', 'يعترض على أي عمل لا يستوفي الضوابط مهما كان ضغط الجدول الزمني.'] ] },
    4: { e: ['Sets the programme for {o} and qualifies the technicians who apply it.', 'يضع برنامج {o} ويؤهّل الفنيين الذين يطبّقونه.'], m: ['work_product', 'peer', 'interview'], i: [
      ['Sets the programme and acceptance criteria for {o}, citing the licensing basis.', 'يضع برنامج {o} ومعايير القبول، مستنداً إلى أساس الترخيص.'],
      ['Leads the investigation of {s} and presents the lessons.', 'يقود التحقيق في {s} ويعرض الدروس المستفادة.'],
      ['Benchmarks {o} against industry practice and closes the gaps.', 'يقارن {o} بممارسات القطاع ويعالج الفجوات.'],
      ['Qualifies technicians in {o} through observed practice and oral boards.', 'يؤهّل الفنيين في {o} عبر الممارسة الملاحَظة والمقابلات الشفهية.'] ] },
  },
  engineering: {
    1: { e: ['Knows what {o} is for and where the related records are kept.', 'يعرف الغرض من {o} وأين تُحفظ السجلات المرتبطة.'], m: ['interview', 'records'], i: [
      ['Locates {w} and the current revision of the design documents.', 'يعثر على {w} وعلى أحدث مراجعة لوثائق التصميم.'],
      ['Describes the contribution of {o} to safe and reliable operation.', 'يصف إسهام {o} في التشغيل الآمن والموثوق.'],
      ['Raises {s} through the corrective action programme.', 'يرفع بلاغاً عن {s} عبر برنامج الإجراءات التصحيحية.'],
      ['Uses the engineering terms of {o} correctly.', 'يستخدم المصطلحات الهندسية الخاصة بـ{o} بشكل صحيح.'] ] },
    2: { e: ['Prepares parts of {o} work for review by a responsible engineer.', 'يُعدّ أجزاء من أعمال {o} لمراجعتها من قبل مهندس مسؤول.'], m: ['work_product', 'records'], i: [
      ['Prepares sections of {w} for review by a responsible engineer.', 'يُعدّ أقساماً من {w} لمراجعتها من قبل مهندس مسؤول.'],
      ['Gathers plant data for {o} and checks it for gaps and errors.', 'يجمع بيانات المحطة اللازمة لـ{o} ويتحقق من خلوها من النقص والأخطاء.'],
      ['Applies the design inputs and codes named in the task to {o}.', 'يطبّق مدخلات التصميم والمعايير المحددة في المهمة على {o}.'],
      ['Flags {s} to the responsible engineer with the evidence.', 'ينبّه المهندس المسؤول إلى {s} مع الأدلة.'] ] },
    3: { e: ['Owns {o} for a system and signs the work as preparer.', 'يتولى مسؤولية {o} لنظام كامل ويوقّع على العمل بصفته مُعدّاً.'], m: ['work_product', 'peer', 'records'], i: [
      ['Owns {o} for a whole system and signs {w} as preparer.', 'يتولى مسؤولية {o} لنظام كامل ويوقّع على {w} بصفته مُعدّاً.'],
      ['Evaluates {s} and recommends action with the safety and cost case.', 'يقيّم أثر {s} ويوصي بالإجراء مع مبررات السلامة والتكلفة.'],
      ['Checks other engineers\' work on {o} as an independent reviewer.', 'يراجع عمل المهندسين الآخرين في {o} بصفته مراجعاً مستقلاً.'],
      ['Explains engineering decisions on {o} to operations in plain language.', 'يشرح القرارات الهندسية في {o} لفريق التشغيل بلغة واضحة.'] ] },
    4: { e: ['Sets the engineering standard for {o} across units.', 'يضع المعيار الهندسي في {o} عبر الوحدات.'], m: ['work_product', 'peer', 'interview'], i: [
      ['Sets the engineering standard for {o} across units and approves {w}.', 'يضع المعيار الهندسي في {o} عبر الوحدات ويعتمد {w}.'],
      ['Anticipates {s} from industry experience and leads the response.', 'يستبق احتمال {s} مستفيداً من خبرة القطاع ويقود الاستجابة.'],
      ['Represents ENEC on {o} with vendors and peer utilities.', 'يمثّل المؤسسة في {o} أمام الموردين والمرافق النظيرة.'],
      ['Mentors engineers through their first independent work on {o}.', 'يرشد المهندسين خلال أول عمل مستقل لهم في {o}.'] ] },
  },
  safety: {
    1: { e: ['Knows which rules of {o} apply to own work.', 'يعرف قواعد {o} التي تنطبق على عمله.'], m: ['interview', 'sjt'], i: [
      ['States which requirements of {o} apply to own tasks.', 'يحدد متطلبات {o} التي تنطبق على مهامه.'],
      ['Pauses and asks when unsure whether {s} applies.', 'يتوقف ويسأل إذا لم يتأكد من انطباق {s}.'],
      ['Reports a suspected non-conformance on the same shift.', 'يبلّغ عن أي حالة عدم مطابقة مشتبه بها خلال النوبة نفسها.'],
      ['Finds the controlling document for {o}.', 'يجد الوثيقة الحاكمة في {o}.'] ] },
    2: { e: ['Uses {o} in routine work and records each check made.', 'يستخدم {o} في الأعمال الروتينية ويوثّق كل فحص يجريه.'], m: ['records', 'observation'], i: [
      ['Applies {o} to routine work and has the result checked.', 'يطبّق {o} على الأعمال الروتينية ويخضع النتيجة للمراجعة.'],
      ['Completes {w} accurately and on time.', 'يكمل {w} بدقة وفي الوقت المحدد.'],
      ['Recognises {s} and escalates it with the facts.', 'يتعرّف على {s} ويصعّد الأمر مع الحقائق.'],
      ['Quotes the requirement behind each check performed.', 'يذكر المتطلب الذي يستند إليه كل فحص يجريه.'] ] },
    3: { e: ['Makes {o} calls alone and documents the basis.', 'يتخذ القرارات المتعلقة بـ{o} منفرداً ويوثّق الأساس.'], m: ['work_product', 'sjt', 'peer'], i: [
      ['Makes {o} calls without supervision and documents the basis in {w}.', 'يتخذ القرارات المتعلقة بـ{o} دون إشراف ويوثّق الأساس في {w}.'],
      ['Spots {s} early and stops the activity before an event happens.', 'يكتشف مؤشرات {s} مبكراً ويوقف النشاط قبل وقوع حدث.'],
      ['Challenges assumptions in others\' work on {o} with a questioning attitude.', 'يتحدى الافتراضات في عمل الآخرين المتعلق بـ{o} بروح التساؤل.'],
      ['Explains the safety margin linked to {o}.', 'يشرح هامش السلامة المرتبط بـ{o}.'] ] },
    4: { e: ['Interprets {o} for the organisation and teaches the reasoning behind it.', 'يفسّر {o} للمؤسسة ويعلّم المنطق الكامن وراءه.'], m: ['work_product', 'peer', 'interview'], i: [
      ['Interprets {o} for the organisation and resolves conflicting requirements.', 'يفسّر {o} للمؤسسة ويحلّ التعارض بين المتطلبات.'],
      ['Leads independent oversight of {s} and reports trends to management.', 'يقود الرقابة المستقلة على {s} ويعرض الاتجاهات على الإدارة.'],
      ['Leads the preparation and review of {w}, anticipating regulatory questions.', 'يقود إعداد {w} وعملية المراجعة، مستبقاً أسئلة الجهة الرقابية.'],
      ['Teaches the reasoning behind {o}, not only the rules.', 'يعلّم المنطق الكامن وراء {o} لا القواعد وحدها.'] ] },
  },
  emergency: {
    1: { e: ['Knows own part in {o} and how to respond to an alarm.', 'يعرف دوره في {o} وكيفية الاستجابة للإنذار.'], m: ['interview', 'records'], i: [
      ['Goes to the right assembly point or facility when {s} is announced.', 'يتوجه إلى نقطة التجمع أو المرفق الصحيح عند الإعلان عن {s}.'],
      ['Names own duties and who to report to in {o}.', 'يذكر مهامه والجهة التي يتبع لها في {o}.'],
      ['Takes part in drills and follows instructions.', 'يشارك في التمارين ويتبع التعليمات.'],
      ['Knows where the emergency equipment for the area is kept.', 'يعرف أماكن معدات الطوارئ في منطقته.'] ] },
    2: { e: ['Carries out own part in {o} during drills with a coach alongside.', 'يؤدي دوره في {o} خلال التمارين بوجود موجّه إلى جانبه.'], m: ['observation', 'records'], i: [
      ['Performs assigned duties in {o} during drills with a coach present.', 'يؤدي المهام المسندة إليه في {o} خلال التمارين بوجود موجّه.'],
      ['Uses the checklists and keeps {w} during a drill.', 'يستخدم قوائم التحقق ويحرّر {w} أثناء التمرين.'],
      ['Passes accurate information up the chain using repeat-back.', 'ينقل المعلومات الدقيقة عبر التسلسل باستخدام أسلوب التكرار للتأكيد.'],
      ['Recognises {s} and reports on time.', 'يتعرّف على {s} ويبلّغ في الوقت المحدد.'] ] },
    3: { e: ['Fills the role in {o} alone through a full drill or exercise.', 'يشغل الدور في {o} منفرداً طوال تمرين كامل.'], m: ['observation', 'simulator', 'records'], i: [
      ['Fills the position in {o} without a coach through a full drill or exercise.', 'يشغل المنصب في {o} دون موجّه طوال تمرين كامل.'],
      ['Makes time-critical decisions on {s} using the procedures.', 'يتخذ القرارات الحرجة زمنياً بشأن {s} وفق الإجراءات.'],
      ['Keeps {w} complete so the next shift can take over.', 'يحافظ على اكتمال {w} لتتمكن النوبة التالية من الاستلام.'],
      ['Coordinates with other response teams without losing track of priorities.', 'ينسّق مع فرق الاستجابة الأخرى دون أن يغفل عن الأولويات.'] ] },
    4: { e: ['Shapes how ENEC prepares for {o} and leads the response.', 'يشكّل طريقة استعداد المؤسسة في {o} ويقود الاستجابة.'], m: ['work_product', 'observation', 'peer'], i: [
      ['Designs drill scenarios that test {o} and the hand-offs between teams.', 'يصمّم سيناريوهات تمارين تختبر {o} وعمليات التسليم بين الفرق.'],
      ['Evaluates drill performance and writes the improvement actions.', 'يقيّم الأداء في التمارين ويكتب إجراءات التحسين.'],
      ['Leads the response to {s} and runs the debrief.', 'يقود الاستجابة لـ{s} ويدير جلسة استخلاص الدروس.'],
      ['Keeps the emergency plan for {o} aligned with current plant conditions.', 'يحافظ على مواءمة خطة الطوارئ في {o} مع ظروف المحطة الحالية.'] ] },
  },
  behavioural: {
    1: { e: ['Knows what {o} looks like in practice and tries it in routine work.', 'يعرف المظاهر العملية لـ{o} ويحرص على ممارستها في المهام الروتينية.'], m: ['interview', 'sjt'], i: [
      ['Describes {o} with an example from own work.', 'يصف {o} بمثال من عمله.'],
      ['Practises {o} in routine situations when reminded.', 'يمارس {o} في المواقف الروتينية عند التذكير.'],
      ['Accepts feedback on {o} and acts on it.', 'يتقبّل الملاحظات حول {o} ويعمل بها.'],
      ['Notices {s} and raises it with the team lead.', 'ينتبه إلى {s} ويطرح الأمر على قائد الفريق.'] ] },
    2: { e: ['Practises {o} reliably in everyday work and learns from feedback.', 'يمارس {o} بموثوقية في العمل اليومي ويتعلّم من الملاحظات.'], m: ['observation', 'peer'], i: [
      ['Shows {o} consistently in routine work without prompting.', 'يُظهر {o} باستمرار في العمل الروتيني دون حاجة إلى تذكير.'],
      ['Handles {s} calmly and asks for help early.', 'يتعامل مع {s} بهدوء ويطلب المساعدة مبكراً.'],
      ['Gives and receives feedback that names behaviours, not people.', 'يقدّم الملاحظات ويتلقاها بالتركيز على السلوك لا على الأشخاص.'],
      ['Reflects after a task on how {o} went and what to change.', 'يتأمل بعد كل مهمة في مستوى ممارسته لـ{o} وما ينبغي تغييره.'] ] },
    3: { e: ['Shows {o} under pressure and helps the team do the same.', 'يُظهر {o} تحت الضغط ويساعد الفريق على ذلك.'], m: ['observation', 'simulator', 'peer', 'sjt'], i: [
      ['Shows {o} under pressure, including off-normal and time-critical work.', 'يُظهر {o} تحت الضغط، بما في ذلك الأعمال غير الاعتيادية والحرجة زمنياً.'],
      ['Turns {s} into a team conversation and a clear next step.', 'يحوّل التعامل مع {s} إلى نقاش جماعي وخطوة تالية واضحة.'],
      ['Models {o} for newer colleagues and corrects drift kindly but firmly.', 'يقدّم نموذجاً في {o} للزملاء الجدد ويصحح الانحراف بلطف وحزم.'],
      ['Uses situational judgement to choose the conservative option when goals conflict.', 'يستخدم حسن التقدير لاختيار الخيار المتحفظ عند تعارض الأهداف.'] ] },
    4: { e: ['Shapes how the organisation practises {o} and is a role model for it.', 'يشكّل طريقة ممارسة المؤسسة لـ{o} ويُعدّ قدوة فيه.'], m: ['peer', 'interview', 'work_product'], i: [
      ['Shapes how the organisation practises {o}: sets expectations and reinforces them.', 'يشكّل طريقة ممارسة المؤسسة لـ{o}: يضع التوقعات ويعززها.'],
      ['Coaches leaders on handling {s} and observes the change in their teams.', 'يوجّه القادة في التعامل مع {s} ويتابع أثر ذلك في فرقهم.'],
      ['Builds {o} into selection, training and observation programmes.', 'يدمج {o} في برامج الاختيار والتدريب والملاحظة.'],
      ['Is sought out across departments as a role model for {o}.', 'يُقصد عبر الإدارات كقدوة في {o}.'] ] },
  },
  digital: {
    1: { e: ['Uses {o} safely for simple tasks and knows the limits of use.', 'يستخدم {o} بأمان في المهام البسيطة ويعرف حدود الاستخدام.'], m: ['sjt', 'records'], i: [
      ['Uses {o} for routine tasks following the approved guidance.', 'يستخدم {o} في المهام الروتينية وفق الإرشادات المعتمدة.'],
      ['Keeps plant and personal data inside approved tools.', 'يحفظ بيانات المحطة والبيانات الشخصية داخل الأدوات المعتمدة.'],
      ['Recognises {s} and asks before relying on the result.', 'يتعرّف على {s} ويستوضح قبل الاعتماد على النتيجة.'],
      ['Says in plain words what can and cannot be done with {o}.', 'يوضح بكلمات بسيطة ما يمكن وما لا يمكن تحقيقه عبر {o}.'] ] },
    2: { e: ['Applies {o} to own work and checks every output against the source.', 'يطبّق {o} في عمله ويتحقق من كل مخرجات مقابل المصدر.'], m: ['work_product', 'records'], i: [
      ['Applies {o} to own work and checks the output against the source.', 'يطبّق {o} في عمله ويتحقق من المخرجات مقابل المصدر.'],
      ['Documents inputs, versions and checks in {w}.', 'يوثّق المدخلات والإصدارات والفحوصات في {w}.'],
      ['Reports {s} through the right channel.', 'يبلّغ عن {s} عبر القناة الصحيحة.'],
      ['Chooses the approved tool and use class for the task.', 'يختار الأداة المعتمدة وفئة الاستخدام المناسبة للمهمة.'] ] },
    3: { e: ['Works with {o} alone, verifies results and challenges what conflicts with plant evidence.', 'يعمل في {o} منفرداً، ويتحقق من النتائج ويعترض على ما يتعارض مع أدلة المحطة.'], m: ['work_product', 'peer', 'observation'], i: [
      ['Develops {w} and keeps versions that others can reuse.', 'يطوّر {w} ويحافظ على نسخ قابلة لإعادة الاستخدام من قبل الآخرين.'],
      ['Verifies {o} results without supervision and challenges output that conflicts with plant evidence.', 'يتحقق دون إشراف من نتائج {o} ويعترض على أي مخرجات تتعارض مع أدلة المحطة.'],
      ['Diagnoses {s} and fixes the cause, not only the symptom.', 'يشخّص أسباب {s} ويعالج السبب الجذري لا العَرَض فقط.'],
      ['Helps colleagues adopt {o} safely and explains the governance rules.', 'يساعد الزملاء على تبنّي {o} بأمان ويشرح قواعد الحوكمة.'] ] },
    4: { e: ['Sets how {o} is used across ENEC and builds the capability in others.', 'يحدد طريقة استخدام {o} على مستوى المؤسسة ويبني القدرات لدى الآخرين.'], m: ['work_product', 'peer', 'interview'], i: [
      ['Sets how {o} is used across ENEC: standards, approved tools and checks.', 'يحدد ضوابط استخدام {o} على مستوى المؤسسة: المعايير والأدوات المعتمدة والفحوصات.'],
      ['Evaluates new tools for {o} against safety, security and data rules before adoption.', 'يقيّم الأدوات الجديدة في مجال {o} وفق قواعد السلامة والأمن والبيانات قبل اعتمادها.'],
      ['Leads the review of {s} and turns the findings into a governance improvement.', 'يقود مراجعة {s} ويحوّل النتائج إلى تحسين في الحوكمة.'],
      ['Designs learning and assessments that build {o} across teams.', 'يصمّم أنشطة التعلم والتقييم التي تبني {o} عبر الفرق.'] ] },
  },
  green: {
    1: { e: ['Knows why {o} matters for ENEC\'s clean-energy role.', 'يعرف أهمية {o} لدور المؤسسة في الطاقة النظيفة.'], m: ['interview', 'sjt'], i: [
      ['Says in plain words how {o} relates to nuclear energy\'s low-carbon role.', 'يوضح بكلمات بسيطة علاقة {o} بدور الطاقة النووية منخفضة الكربون.'],
      ['Finds the approved public sources used for {o}.', 'يجد المصادر العامة المعتمدة المتعلقة بـ{o}.'],
      ['Notices {s} in own area and reports it.', 'ينتبه إلى {s} في منطقة عمله ويبلّغ عن ذلك.'],
      ['Uses the correct terms and units of {o}.', 'يستخدم المصطلحات والوحدات الصحيحة في {o}.'] ] },
    2: { e: ['Applies the method of {o} to a defined scope with a reviewer checking it.', 'يطبّق منهجية {o} على نطاق محدد بينما يراجعها مختص.'], m: ['work_product', 'records'], i: [
      ['Collects the data for {o} while a reviewer checks the method.', 'يجمع بيانات {o} بينما يراجع مختص المنهجية.'],
      ['Applies the method of {o} to a defined scope and records the assumptions in {w}.', 'يطبّق منهجية {o} على نطاق محدد ويوثّق الافتراضات في {w}.'],
      ['Flags {s} with the evidence.', 'ينبّه إلى {s} مع الأدلة.'],
      ['Separates measured values from estimates when reporting.', 'يميّز بين القيم المقاسة والتقديرات عند إعداد التقارير.'] ] },
    3: { e: ['Delivers {o} for a full scope alone, with the assumptions published.', 'ينجز {o} لنطاق كامل منفرداً مع نشر الافتراضات.'], m: ['work_product', 'peer'], i: [
      ['Delivers {o} for a full scope without supervision, with the assumptions published.', 'ينجز {o} لنطاق كامل دون إشراف مع نشر الافتراضات.'],
      ['Reviews others\' work on {o} and corrects double counting or gaps.', 'يراجع عمل الآخرين في {o} ويصحح الاحتساب المزدوج أو الفجوات.'],
      ['Advises engineering or operations on {s}.', 'يقدّم المشورة للهندسة أو التشغيل بشأن {s}.'],
      ['Explains the uncertainty in the results to non-specialists.', 'يشرح عدم اليقين في النتائج لغير المختصين.'] ] },
    4: { e: ['Sets ENEC\'s method for {o} and represents it with partners.', 'يضع منهجية المؤسسة في {o} ويمثّلها أمام الشركاء.'], m: ['work_product', 'peer', 'interview'], i: [
      ['Sets ENEC\'s method for {o} and keeps it aligned with recognised frameworks.', 'يضع منهجية المؤسسة في {o} ويحافظ على توافقها مع الأطر المعترف بها.'],
      ['Leads the response to {s} at organisation level.', 'يقود الاستجابة لـ{s} على مستوى المؤسسة.'],
      ['Represents ENEC on {o} with partners and peers.', 'يمثّل المؤسسة في {o} أمام الشركاء والنظراء.'],
      ['Builds the capability in others through reviewed practice.', 'يبني القدرات لدى الآخرين عبر الممارسة الخاضعة للمراجعة.'] ] },
  },
  advanced: {
    1: { e: ['Explains the core idea of {o} and how it differs from APR-1400.', 'يوضح الفكرة الجوهرية لـ{o} وأوجه اختلافها عن APR-1400.'], m: ['interview', 'sjt'], i: [
      ['Describes {o} in plain words and names one difference from APR-1400.', 'يصف {o} بكلمات بسيطة ويذكر فرقاً واحداً عن APR-1400.'],
      ['Separates published facts about {o} from vendor claims and speculation.', 'يميّز بين الحقائق المنشورة حول {o} وادعاءات الموردين والتكهنات.'],
      ['Finds a reputable source (IAEA, OECD-NEA or a regulator) on {o}.', 'يجد مصدراً موثوقاً (الوكالة الدولية للطاقة الذرية أو وكالة الطاقة النووية أو جهة رقابية) حول {o}.'],
      ['Recognises that interest in {o} implies no deployment decision.', 'يدرك أن الاهتمام بـ{o} لا يعني أي قرار بالنشر.'] ] },
    2: { e: ['Compares {o} with today\'s plant and works through guided cases.', 'يقارن {o} بالمحطة الحالية ويعمل على حالات موجّهة.'], m: ['work_product', 'interview'], i: [
      ['Compares {o} with today\'s plant using the transfers, adapts or new view.', 'يقارن {o} بالمحطة الحالية وفق منظور: ينتقل كما هو، أو يتكيّف، أو جديد.'],
      ['Works through a guided case or simulation on {s}.', 'يعمل على حالة موجّهة أو محاكاة حول {s}.'],
      ['Summarises a technical source on {o} for colleagues, citing it.', 'يلخّص مصدراً فنياً حول {o} لزملائه مع ذكر المصدر.'],
      ['Identifies which of own skills transfer to {o} and which are new.', 'يحدد أيّ مهاراته تنتقل إلى {o} وأيّها جديدة.'] ] },
    3: { e: ['Analyses {o} alone and reviews claims critically, as planning assumptions only.', 'يحلّل {o} منفرداً ويراجع الادعاءات بشكل نقدي، في إطار افتراضات تخطيطية فقط.'], m: ['work_product', 'peer'], i: [
      ['Analyses {s} without supervision and explains the safety case reasoning.', 'يحلّل جوانب {s} دون إشراف ويشرح منطق حالة السلامة.'],
      ['Reviews vendor or literature claims on {o} critically and records the evidence gaps in {w}.', 'يراجع ادعاءات الموردين أو الأدبيات حول {o} بشكل نقدي ويدوّن فجوات الأدلة في {w}.'],
      ['Contributes to studies on {o} as a reviewer, framed as planning assumptions only.', 'يسهم في الدراسات المتعلقة بـ{o} بصفة مراجع، في إطار افتراضات تخطيطية فقط.'],
      ['Runs a short session on {o} for colleagues.', 'يقدّم جلسة قصيرة حول {o} لزملائه.'] ] },
  },
  cyber: {
    1: { e: ['Follows the basic rule of {o} every working day.', 'يلتزم بالقاعدة الأساسية في {o} في كل يوم عمل.'], m: ['sjt', 'records'], i: [
      ['Applies {o} in daily work without being reminded.', 'يطبّق {o} في العمل اليومي دون تذكير.'],
      ['Reports {s} straight away through the reporting channel.', 'يبلّغ فوراً عن {s} عبر قناة الإبلاغ.'],
      ['Completes the annual awareness module and its short check.', 'يكمل وحدة التوعية السنوية واختبارها القصير.'],
      ['Asks before doing anything unusual with plant devices or media.', 'يستوضح قبل القيام بأي تصرف غير معتاد مع أجهزة المحطة أو الوسائط.'] ] },
    2: { e: ['Helps colleagues keep to {o} and responds correctly in realistic exercises.', 'يساعد الزملاء على الالتزام بـ{o} ويستجيب بشكل صحيح في التمارين الواقعية.'], m: ['sjt', 'observation'], i: [
      ['Helps colleagues apply {o} and explains the reasons.', 'يساعد الزملاء على تطبيق {o} ويوضح الأسباب.'],
      ['Recognises {s} in a realistic exercise and responds correctly.', 'يتعرّف على {s} في تمرين واقعي ويستجيب بشكل صحيح.'],
      ['Keeps own team area compliant during walk-downs.', 'يحافظ على امتثال منطقة فريقه خلال الجولات التفقدية.'],
      ['Points colleagues to the security career path for anything beyond awareness.', 'يوجّه الزملاء إلى المسار المهني الأمني في كل ما يتجاوز التوعية.'] ] },
  },
};

/** Published rationale per range basis ({parent} = the parent core skill). */
export const RATIONALE = {
  full: ['Defined at all four levels: the skill is held from first awareness to setting the standard for others.', 'معرَّفة في المستويات الأربعة: تُمتلك المهارة من الإلمام الأول حتى وضع المعيار للآخرين.'],
  licence_like: ['Starts at Practitioner: a qualified plant task is either done under supervision or not at all. Awareness of it sits with the parent skill, {parent}.', 'تبدأ من مستوى الممارس: مهمة المحطة المؤهَّلة تُؤدّى تحت الإشراف أو لا تُؤدّى إطلاقاً. أما الإلمام بها فيندرج تحت المهارة الأم: {parent}.'],
  leading: ['Starts at Practitioner: leading, coaching or instructing begins when you do it for someone. Awareness is covered by the human performance skills.', 'تبدأ من مستوى الممارس: القيادة أو التوجيه أو التدريب تبدأ عندما تمارسها مع شخص آخر. أما الإلمام فتغطيه مهارات الأداء البشري.'],
  not_operated: ['Stops at Qualified: Expert means setting the standard on an operating plant, and no such technology is operated, so level 4 cannot be evidenced. No deployment decision implied.', 'تتوقف عند مستوى المؤهَّل: الخبير يضع المعيار في محطة عاملة، ولا تُشغَّل هذه التقنية، فلا يمكن إثبات المستوى الرابع. لا يعني ذلك أي قرار بالنشر.'],
  awareness_only: ['Awareness and Practitioner only: all-staff cyber and security hygiene is awareness content. Deeper levels belong to security roles, shown at career-path level only.', 'الإلمام والممارسة فقط: النظافة السيبرانية والأمنية لجميع الموظفين محتوى توعوي. أما المستويات الأعمق فتخص الأدوار الأمنية وتظهر على مستوى المسار المهني فقط.'],
  watch: ['Awareness and Practitioner only: a watch horizon with no plant to operate, so independent and expert levels are not defined.', 'الإلمام والممارسة فقط: أفق للرصد دون محطة للتشغيل، لذلك لا يُعرَّف المستويان المستقل والخبير.'],
  declining: ['Kept to Qualified for history: the practice is declining or obsolete, and its descriptors stay so past assessments remain readable. No Expert level is defined for a practice being retired.', 'تُحفظ حتى مستوى المؤهَّل لأغراض السجل: الممارسة متراجعة أو متقادمة، وتبقى الأوصاف كي تظل التقييمات السابقة مقروءة. لا يُعرَّف مستوى الخبير لممارسة يجري إيقافها.'],
};

/** Per-skill anchors: o = what the skill is about, s = a situation that tests it, w = the record or work product it leaves. */
const T = (o, s, w) => ({ o, s, w: w ?? ['the work record', 'سجل العمل'] });
export const ANCHORS = {
  'sk-pf-01': T(['reactor physics concepts such as criticality, reactivity and reactivity coefficients', 'مفاهيم فيزياء المفاعل مثل الحرجية والتفاعلية ومعاملاتها'], ['an unexpected change in reactivity', 'تغيّر غير متوقع في التفاعلية'], ['the reactivity calculation record', 'سجل حسابات التفاعلية']),
  'sk-pf-01-core': T(['core reactivity monitoring and power distribution limits', 'مراقبة تفاعلية القلب وحدود توزيع القدرة'], ['an axial offset or power tilt outside its band', 'انحراف محوري أو ميل في القدرة خارج نطاقه'], ['the core monitoring log', 'سجل مراقبة القلب']),
  'sk-pf-01-advfuel': T(['advanced fuel forms such as TRISO and metallic fuel', 'أشكال الوقود المتقدمة مثل وقود TRISO والوقود المعدني'], ['a fuel performance question raised by a new design', 'سؤال عن أداء الوقود يطرحه تصميم جديد'], ['the technology watch note', 'مذكرة الرصد التقني']),
  'sk-pf-02': T(['heat transfer and fluid flow in plant systems', 'انتقال الحرارة وجريان الموائع في أنظمة المحطة'], ['a loss of subcooling margin', 'فقدان هامش التبريد دون الإشباع'], ['the heat balance record', 'سجل الموازنة الحرارية']),
  'sk-pf-02-advcool': T(['advanced coolant systems such as gas, liquid metal and natural circulation', 'أنظمة التبريد المتقدمة مثل الغاز والمعادن السائلة والدوران الطبيعي'], ['a natural-circulation transient in a passive design', 'حالة عابرة في الدوران الطبيعي ضمن تصميم سلبي'], ['the technology watch note', 'مذكرة الرصد التقني']),
  'sk-pf-03': T(['the APR-1400 integrated plant systems and their interfaces', 'أنظمة محطة APR-1400 المتكاملة وواجهاتها'], ['a system interaction that spreads a fault to another system', 'تداخل بين الأنظمة ينقل عطلاً إلى نظام آخر'], ['the system lineup checklist', 'قائمة التحقق من تهيئة الأنظمة']),
  'sk-pf-03-rcs': T(['reactor coolant system and pressuriser pressure and level control', 'التحكم في ضغط ومستوى نظام تبريد المفاعل والمضغاط'], ['an unexpected pressuriser level trend', 'اتجاه غير متوقع في مستوى المضغاط'], ['the RCS heat-up and cool-down log', 'سجل تسخين وتبريد نظام تبريد المفاعل']),
  'sk-pf-03-steam': T(['main steam, feedwater and turbine control', 'التحكم في البخار الرئيسي ومياه التغذية والتوربين'], ['a feedwater flow mismatch', 'عدم توازن في تدفق مياه التغذية'], ['the secondary plant log', 'سجل الدائرة الثانوية']),
  'sk-pf-03-eccs': T(['safety injection and emergency core cooling alignment', 'تهيئة الحقن الآمن والتبريد الطارئ لقلب المفاعل'], ['a safety injection actuation signal', 'إشارة تفعيل الحقن الآمن'], ['the ECCS surveillance record', 'سجل مراقبة نظام التبريد الطارئ']),
  'sk-pf-03-elec': T(['electrical distribution and emergency diesel generator operation', 'تشغيل شبكة التوزيع الكهربائي ومولدات الديزل للطوارئ'], ['the loss of an electrical bus', 'فقدان أحد القضبان الكهربائية'], ['the electrical lineup record', 'سجل تهيئة الشبكة الكهربائية']),
  'sk-pf-03-aux': T(['auxiliary systems such as chemical and volume control, component cooling and HVAC', 'الأنظمة المساعدة مثل التحكم الكيميائي والحجمي وتبريد المكونات والتهوية'], ['a component cooling flow alarm', 'إنذار تدفق في نظام تبريد المكونات'], ['the auxiliary building rounds sheet', 'ورقة جولات مبنى الأنظمة المساعدة']),
  'sk-pf-03-fuel': T(['fuel handling and refuelling operations', 'عمليات مناولة الوقود وإعادة التزود به'], ['a fuel assembly misalignment during transfer', 'عدم محاذاة إحدى حزم الوقود أثناء النقل'], ['the core loading sequence record', 'سجل تسلسل تحميل القلب']),
  'sk-co-01': T(['procedure use and adherence', 'استخدام الإجراءات والالتزام بها'], ['a procedure step that does not match plant conditions', 'خطوة في الإجراء لا تطابق ظروف المحطة'], ['the placekept procedure copy', 'نسخة الإجراء المعلَّمة الخطوات']),
  'sk-co-01-eop': T(['emergency operating procedures', 'إجراءات التشغيل في حالات الطوارئ'], ['a transition point between emergency procedures', 'نقطة انتقال بين إجراءات الطوارئ'], ['the emergency procedure placekeeping record', 'سجل تتبّع خطوات إجراءات الطوارئ']),
  'sk-co-01-rounds': T(['field rounds and equipment monitoring', 'الجولات الميدانية ومراقبة المعدات'], ['a reading outside its normal band', 'قراءة خارج نطاقها الطبيعي'], ['the rounds log', 'سجل الجولات']),
  'sk-co-02': T(['shift turnover and operational communications', 'تسليم النوبات والاتصالات التشغيلية'], ['a turnover item that is unclear or incomplete', 'بند في التسليم غير واضح أو غير مكتمل'], ['the shift turnover sheet', 'ورقة تسليم النوبة']),
  'sk-co-03': T(['reactivity management', 'إدارة التفاعلية'], ['an unplanned reactivity change', 'تغيّر غير مخطط في التفاعلية'], ['the reactivity plan', 'خطة التفاعلية']),
  'sk-co-03-startup': T(['reactor start-up and power manoeuvres', 'بدء تشغيل المفاعل ومناورات القدرة'], ['a start-up rate higher than planned', 'معدل بدء تشغيل أعلى من المخطط'], ['the start-up and power change plan', 'خطة بدء التشغيل وتغيير القدرة']),
  'sk-mp-01': T(['work package execution', 'تنفيذ حزم العمل'], ['a work package step that does not match the field', 'خطوة في حزمة العمل لا تطابق الواقع الميداني'], ['the completed work package', 'حزمة العمل المنجزة']),
  'sk-mp-01-mech': T(['rotating equipment and valve maintenance', 'صيانة المعدات الدوارة والصمامات'], ['an out-of-tolerance vibration or seat leakage', 'اهتزاز خارج الحدود أو تسرّب من مقعد الصمام'], ['the maintenance data sheet', 'ورقة بيانات الصيانة']),
  'sk-mp-01-elec': T(['electrical maintenance on switchgear, motors and protection', 'الصيانة الكهربائية للمفاتيح والمحركات وأنظمة الحماية'], ['an abnormal insulation or protection test result', 'نتيجة غير طبيعية في اختبار العزل أو الحماية'], ['the electrical test record', 'سجل الاختبارات الكهربائية']),
  'sk-mp-01-outage': T(['outage work planning and scheduling', 'تخطيط أعمال الانقطاع وجدولتها'], ['a schedule conflict on the critical path', 'تعارض في الجدول على المسار الحرج'], ['the outage schedule', 'جدول الانقطاع']),
  'sk-mp-01-remote': T(['remote inspection and modular installation', 'الفحص عن بُعد والتركيب المعياري'], ['an inspection image that cannot be interpreted with confidence', 'صورة فحص لا يمكن تفسيرها بثقة'], ['the inspection report', 'تقرير الفحص']),
  'sk-mp-02': T(['calibration and testing', 'المعايرة والاختبار'], ['an as-found value outside tolerance', 'قيمة مقاسة قبل المعايرة خارج حدود التفاوت'], ['the calibration data sheet', 'ورقة بيانات المعايرة']),
  'sk-mp-02-dic': T(['digital I&C maintenance on the APR-1400 platform', 'صيانة أجهزة القياس والتحكم الرقمية في منصة APR-1400'], ['a channel fault or diagnostic alarm', 'عطل في إحدى القنوات أو إنذار تشخيصي'], ['the I&C maintenance record', 'سجل صيانة أجهزة القياس والتحكم']),
  'sk-rp-01': T(['radiation fundamentals and dose limits', 'أساسيات الإشعاع وحدود الجرعات'], ['a dosimeter alarm', 'إنذار مقياس الجرعات'], ['the dose record', 'سجل الجرعات']),
  'sk-rp-01-dose': T(['dosimetry and dose assessment', 'قياس الجرعات وتقييمها'], ['an unexpected dose result', 'نتيجة جرعة غير متوقعة'], ['the dose assessment report', 'تقرير تقييم الجرعة']),
  'sk-rp-02': T(['ALARA planning and radiation work permits', 'تخطيط ALARA وتصاريح العمل الإشعاعي'], ['a job whose dose is trending above the estimate', 'عمل تتجه جرعته إلى تجاوز التقدير'], ['the radiation work permit', 'تصريح العمل الإشعاعي']),
  'sk-rp-02-survey': T(['radiological surveys and contamination control', 'المسوحات الإشعاعية والتحكم في التلوث'], ['a contamination level above the posting limit', 'مستوى تلوث يتجاوز حد اللافتة'], ['the survey map', 'خريطة المسح']),
  'sk-ch-01': T(['water chemistry control', 'ضبط كيمياء المياه'], ['a chemistry parameter approaching its action level', 'معامل كيميائي يقترب من مستوى الإجراء'], ['the chemistry log', 'سجل الكيمياء']),
  'sk-ch-01-primary': T(['primary-side water chemistry sampling', 'أخذ عينات كيمياء المياه في الدائرة الأولية'], ['a sample result that does not match the trend', 'نتيجة عينة لا تتفق مع الاتجاه'], ['the sample analysis record', 'سجل تحليل العينات']),
  'sk-ch-01-advchem': T(['advanced coolant chemistry such as liquid metal and molten salt', 'كيمياء المبردات المتقدمة مثل المعادن السائلة والأملاح المنصهرة'], ['a corrosion or impurity question in a new coolant', 'مسألة تآكل أو شوائب في مبرد جديد'], ['the technology watch note', 'مذكرة الرصد التقني']),
  'sk-ch-02': T(['radiochemistry and effluent monitoring', 'الكيمياء الإشعاعية ورصد المخلفات'], ['an effluent result near its release limit', 'نتيجة مخلفات قريبة من حد التصريف'], ['the effluent release record', 'سجل التصريف']),
  'sk-ch-02-labqa': T(['laboratory QA and analytical instruments', 'ضمان جودة المختبر والأجهزة التحليلية'], ['a control chart point outside its limits', 'نقطة في مخطط الضبط خارج الحدود'], ['the instrument QC record', 'سجل ضبط جودة الأجهزة']),
  'sk-en-01': T(['configuration management and design control', 'إدارة التهيئة وضبط التصميم'], ['a mismatch between the plant and its design documents', 'عدم تطابق بين المحطة ووثائق تصميمها'], ['the design change package', 'حزمة تغيير التصميم']),
  'sk-en-01-mods': T(['design changes and plant modifications', 'تغييرات التصميم وتعديلات المحطة'], ['a modification that affects a safety function', 'تعديل يؤثر في إحدى وظائف السلامة'], ['the modification package', 'حزمة التعديل']),
  'sk-en-01-project': T(['project controls and owner\'s engineering', 'ضبط المشاريع وهندسة المالك'], ['a cost or schedule variance beyond its threshold', 'انحراف في التكلفة أو الجدول يتجاوز الحد المسموح'], ['the project control report', 'تقرير ضبط المشروع']),
  'sk-en-02': T(['system health monitoring', 'رصد سلامة الأنظمة'], ['a degrading system health indicator', 'مؤشر متراجع لسلامة النظام'], ['the system health report', 'تقرير سلامة النظام']),
  'sk-en-02-perf': T(['system performance monitoring and trending', 'مراقبة أداء الأنظمة وتحليل الاتجاهات'], ['an adverse performance trend', 'اتجاه سلبي في الأداء'], ['the performance trend report', 'تقرير اتجاهات الأداء']),
  'sk-ns-01': T(['defence in depth and the safety functions', 'الدفاع في العمق ووظائف السلامة'], ['a degraded barrier', 'حاجز متدهور'], ['the safety function assessment', 'تقييم وظائف السلامة']),
  'sk-ns-01-psa': T(['probabilistic safety insights', 'رؤى السلامة الاحتمالية'], ['a plant configuration with elevated risk', 'تهيئة للمحطة بمخاطر مرتفعة'], ['the work-week risk assessment', 'تقييم مخاطر أسبوع العمل']),
  'sk-ns-02': T(['technical specifications and the licensing basis', 'المواصفات الفنية وأساس الترخيص'], ['an LCO entry condition', 'حالة دخول في شرط تشغيل محدد'], ['the LCO tracking record', 'سجل متابعة شروط التشغيل المحددة']),
  'sk-ns-02-techspec': T(['technical specification compliance', 'الامتثال للمواصفات الفنية'], ['an equipment condition that may affect operability', 'حالة معدات قد تؤثر في قابلية التشغيل'], ['the operability determination', 'تحديد قابلية التشغيل']),
  'sk-ns-02-licensing': T(['the licensing basis and regulatory submissions', 'أساس الترخيص والتقديمات التنظيمية'], ['a change that may need regulatory review', 'تغيير قد يتطلب مراجعة تنظيمية'], ['the licensing basis screening', 'فحص أساس الترخيص']),
  'sk-hu-01': T(['the core human performance tools', 'الأدوات الأساسية للأداء البشري'], ['an error-likely situation', 'موقف يُرجَّح فيه وقوع الخطأ']),
  'sk-hu-01-star': T(['self-checking and stopping when unsure', 'الفحص الذاتي والتوقف عند الشك'], ['a moment of doubt during a task', 'لحظة شك أثناء المهمة']),
  'sk-hu-02': T(['pre-job briefs graded to risk', 'إحاطات ما قبل العمل المتدرجة حسب المخاطر'], ['a high-risk task about to start', 'مهمة عالية المخاطر على وشك البدء']),
  'sk-hu-02-brief': T(['pre-job briefs and post-job reviews', 'إحاطات ما قبل العمل ومراجعات ما بعده'], ['a lesson the last job revealed', 'درس كشفه العمل السابق']),
  'sk-sc-01': T(['a questioning attitude and raising concerns', 'موقف التساؤل ورفع المخاوف'], ['a condition that does not look right', 'حالة لا تبدو سليمة']),
  'sk-sc-02': T(['leadership safety values and actions', 'قيم وأفعال القيادة في مجال السلامة'], ['production pressure that competes with safety', 'ضغط إنتاج يتنافس مع السلامة']),
  'sk-ep-01': T(['the emergency response organisation', 'منظمة الاستجابة للطوارئ'], ['an emergency classification', 'تصنيف حالة طوارئ'], ['the position log', 'سجل المنصب']),
  'sk-ep-01-ero': T(['emergency response organisation positions', 'مناصب منظمة الاستجابة للطوارئ'], ['an escalating event', 'حدث متصاعد'], ['the position log', 'سجل المنصب']),
  'sk-ep-02': T(['drills and emergency notifications', 'التمارين وإخطارات الطوارئ'], ['a notification deadline', 'موعد نهائي لإخطار'], ['the notification form', 'نموذج الإخطار']),
  'sk-ep-02-fire': T(['fire brigade response', 'استجابة فرقة الإطفاء'], ['a fire alarm in a safety-related area', 'إنذار حريق في منطقة ذات صلة بالسلامة'], ['the fire response log', 'سجل الاستجابة للحرائق']),
  'sk-sa-01': T(['the security awareness rules for all staff', 'قواعد الوعي الأمني لجميع الموظفين'], ['something that looks out of place', 'أمر يبدو في غير موضعه']),
  'sk-qa-01': T(['NQA-1 quality assurance requirements', 'متطلبات ضمان الجودة وفق NQA-1'], ['an incomplete quality record', 'سجل جودة غير مكتمل'], ['the quality record', 'سجل الجودة']),
  'sk-qa-01-inspect': T(['inspection and test planning', 'تخطيط الفحص والاختبار'], ['a hold point that has not been released', 'نقطة توقف لم يُفرج عنها'], ['the inspection and test plan', 'خطة الفحص والاختبار']),
  'sk-qa-02': T(['commercial-grade dedication and counterfeit item prevention', 'اعتماد المواد التجارية ومنع المواد المقلدة'], ['a part with signs of being counterfeit or suspect', 'قطعة تظهر عليها علامات تقليد أو اشتباه'], ['the dedication package', 'حزمة الاعتماد']),
  'sk-qa-02-cgd': T(['the technical evaluation for commercial-grade dedication', 'التقييم الفني لاعتماد المواد التجارية'], ['a critical characteristic that cannot be verified', 'خاصية حرجة لا يمكن التحقق منها'], ['the technical evaluation', 'التقييم الفني']),
  'sk-ld-01': T(['leading effective teams', 'قيادة فرق فعّالة'], ['a conflict inside the team', 'خلاف داخل الفريق']),
  'sk-ld-01-coach': T(['coaching and feedback', 'التوجيه وتقديم الملاحظات'], ['a performance gap in a team member', 'فجوة أداء لدى أحد أعضاء الفريق']),
  'sk-ld-01-instruct': T(['instructional delivery to the SAT standard', 'تقديم التدريب وفق معايير النهج المنهجي للتدريب'], ['a trainee who is not meeting the objective', 'متدرب لا يحقق الهدف التعليمي']),
  'sk-ld-02': T(['conservative decision-making', 'اتخاذ القرارات المتحفظة'], ['an uncertain plant condition', 'حالة غير مؤكدة في المحطة']),
  'sk-ld-02-decide': T(['operational decision-making under uncertainty', 'اتخاذ القرار التشغيلي في ظروف عدم اليقين'], ['a decision with incomplete information and time pressure', 'قرار بمعلومات ناقصة وتحت ضغط الوقت']),
  'sk-da-01': T(['digital tools and data literacy', 'الأدوات الرقمية ومحو الأمية في البيانات'], ['a dataset with missing or doubtful values', 'مجموعة بيانات بقيم ناقصة أو مشكوك فيها'], ['the data file', 'ملف البيانات']),
  'sk-da-01-analysis': T(['data analysis and visualisation', 'تحليل البيانات وتصويرها'], ['a chart that hides an important outlier', 'مخطط يخفي قيمة شاذة مهمة'], ['the analysis notebook', 'دفتر التحليل']),
  'sk-da-01-scripting': T(['scripting for engineering analysis', 'البرمجة النصية للتحليل الهندسي'], ['a script that disagrees with the hand calculation', 'برنامج نصي تختلف نتيجته عن الحساب اليدوي'], ['the version-controlled script', 'البرنامج النصي الخاضع لضبط الإصدارات']),
  'sk-da-01-twins': T(['digital twins and plant data models', 'التوائم الرقمية ونماذج بيانات المحطة'], ['a twin prediction that drifts from plant data', 'تنبؤ للتوأم الرقمي ينحرف عن بيانات المحطة'], ['the model validation record', 'سجل التحقق من صحة النموذج']),
  'sk-da-01-remote': T(['remote monitoring and oversight of autonomous control', 'المراقبة عن بُعد والإشراف على التحكم الذاتي'], ['an automated action the operator did not expect', 'إجراء آلي لم يتوقعه المشغّل'], ['the monitoring log', 'سجل المراقبة']),
  'sk-da-02': T(['the governed use of AI', 'الاستخدام المحوكم للذكاء الاصطناعي'], ['an AI answer that cites no controlled source', 'إجابة من الذكاء الاصطناعي لا تستند إلى مصدر معتمد'], ['the AI use record', 'سجل استخدام الذكاء الاصطناعي']),
  'sk-da-02-review': T(['the review of AI outputs under governance', 'مراجعة مخرجات الذكاء الاصطناعي ضمن الحوكمة'], ['an AI output that conflicts with the controlled document', 'مخرجات ذكاء اصطناعي تتعارض مع الوثيقة المعتمدة'], ['the review checklist', 'قائمة التحقق للمراجعة']),
  'sk-fs-tr-analytical': T(['analytical thinking', 'التفكير التحليلي'], ['a problem with conflicting data', 'مشكلة ذات بيانات متضاربة']),
  'sk-fs-tr-systems': T(['systems thinking', 'التفكير المنظومي'], ['a change whose side effects reach other teams', 'تغيير تمتد آثاره الجانبية إلى فرق أخرى']),
  'sk-fs-tr-resilience': T(['resilience, flexibility and agility', 'المرونة والقدرة على التكيّف وسرعة الاستجابة'], ['a sudden change of plan', 'تغيير مفاجئ في الخطة']),
  'sk-fs-tr-curiosity': T(['curiosity and lifelong learning', 'الفضول والتعلّم مدى الحياة'], ['a new method or technology in the field', 'أسلوب أو تقنية جديدة في المجال']),
  'sk-fs-tr-creative': T(['creative thinking', 'التفكير الإبداعي'], ['a recurring problem that standard fixes have not solved', 'مشكلة متكررة لم تحلّها الحلول المعتادة']),
  'sk-fs-tr-techlit': T(['technological literacy', 'الإلمام التقني'], ['an unfamiliar digital tool', 'أداة رقمية غير مألوفة']),
  'sk-fs-tr-leadership': T(['leadership and social influence', 'القيادة والتأثير الاجتماعي'], ['a team that resists a needed change', 'فريق يقاوم تغييراً ضرورياً']),
  'sk-fs-tr-environment': T(['environmental stewardship', 'الإشراف البيئي'], ['an avoidable waste of energy or materials', 'هدر يمكن تجنبه في الطاقة أو المواد']),
  'sk-fs-tr-dependable': T(['dependability and attention to detail', 'الموثوقية والدقة في التفاصيل'], ['a small discrepancy that is easy to overlook', 'تباين صغير يسهل إغفاله']),
  'sk-fs-tr-empathy': T(['empathy and active listening', 'التعاطف والإصغاء الفعّال'], ['a colleague under strain', 'زميل يمر بضغط']),
  'sk-fs-tr-selfaware': T(['motivation and self-awareness', 'الدافعية والوعي الذاتي'], ['fatigue or stress that could affect performance', 'إرهاق أو ضغط قد يؤثر في الأداء']),
  'sk-fs-tr-crosscultural': T(['collaboration across cultures', 'التعاون بين الثقافات'], ['a misunderstanding between colleagues from different backgrounds', 'سوء فهم بين زملاء من خلفيات مختلفة']),
  'sk-fs-ai-use': T(['approved AI tools', 'أدوات الذكاء الاصطناعي المعتمدة'], ['an AI answer that sounds confident but may be wrong', 'إجابة من الذكاء الاصطناعي تبدو واثقة لكنها قد تكون خاطئة'], ['the AI use note', 'ملاحظة استخدام الذكاء الاصطناعي']),
  'sk-fs-ai-verify': T(['AI output verification', 'التحقق من مخرجات الذكاء الاصطناعي'], ['an AI summary that omits a procedure caution', 'ملخص من الذكاء الاصطناعي يُغفل تحذيراً في الإجراء'], ['the verification record', 'سجل التحقق']),
  'sk-fs-ai-prompt': T(['prompt and agent design', 'تصميم الأوامر والوكلاء الذكيين'], ['an agent step that acts outside its approved scope', 'خطوة لوكيل ذكي تتجاوز نطاقه المعتمد'], ['the prompt library', 'مكتبة الأوامر']),
  'sk-fs-ai-dataeng': T(['data pipelines and data engineering basics', 'مسارات البيانات وأساسيات هندسة البيانات'], ['a pipeline that silently drops records', 'مسار بيانات يُسقط السجلات دون تنبيه'], ['the pipeline documentation', 'توثيق مسار البيانات']),
  'sk-fs-ai-plantdata': T(['plant-data quality', 'جودة بيانات المحطة'], ['a sensor tag with frozen or implausible values', 'وسم مستشعر بقيم ثابتة أو غير معقولة'], ['the data quality report', 'تقرير جودة البيانات']),
  'sk-fs-ai-automation': T(['automation design', 'تصميم الأتمتة'], ['an automated step without a human check', 'خطوة مؤتمتة دون مراجعة بشرية'], ['the automation design record', 'سجل تصميم الأتمتة']),
  'sk-fs-ai-xr': T(['AR and VR for training and work', 'الواقع المعزّز والافتراضي في التدريب والعمل'], ['a virtual scene that differs from the real plant', 'مشهد افتراضي يختلف عن المحطة الفعلية'], ['the scenario validation record', 'سجل التحقق من السيناريو']),
  'sk-fs-ai-twin': T(['digital twin validation', 'التحقق من صحة التوائم الرقمية'], ['a twin running outside its validated envelope', 'توأم رقمي يعمل خارج نطاقه المتحقق منه'], ['the twin validation report', 'تقرير التحقق من التوأم الرقمي']),
  'sk-fs-ai-anomaly': T(['anomaly triage with AI alerts', 'فرز الحالات الشاذة باستخدام تنبيهات الذكاء الاصطناعي'], ['an AI anomaly alert with no clear cause', 'تنبيه شذوذ من الذكاء الاصطناعي دون سبب واضح'], ['the alert triage log', 'سجل فرز التنبيهات']),
  'sk-fs-ai-data-care': T(['responsible data handling', 'التعامل المسؤول مع البيانات'], ['a request to share data outside its approved use', 'طلب لمشاركة بيانات خارج استخدامها المعتمد'], ['the data handling record', 'سجل التعامل مع البيانات']),
  'sk-fs-gr-lifecycle': T(['lifecycle carbon assessment', 'تقييم الكربون على امتداد دورة الحياة'], ['a data gap in the lifecycle inventory', 'فجوة بيانات في جرد دورة الحياة'], ['the lifecycle assessment file', 'ملف تقييم دورة الحياة']),
  'sk-fs-gr-ghg': T(['greenhouse gas accounting', 'محاسبة غازات الاحتباس الحراري'], ['an emission source missing from the inventory', 'مصدر انبعاثات غير مدرج في الجرد'], ['the GHG inventory', 'جرد غازات الاحتباس الحراري']),
  'sk-fs-gr-h2heat': T(['hydrogen and process-heat interfaces', 'واجهات الهيدروجين والحرارة الصناعية'], ['an interface risk between a heat user and the plant', 'خطر في الواجهة بين مستخدم الحرارة والمحطة'], ['the interface study note', 'مذكرة دراسة الواجهة']),
  'sk-fs-gr-grid': T(['grid integration and flexible operation', 'التكامل مع الشبكة والتشغيل المرن'], ['a grid request for load following', 'طلب من الشبكة لمتابعة الأحمال'], ['the flexible operation study', 'دراسة التشغيل المرن']),
  'sk-fs-gr-circular': T(['circularity and waste stewardship', 'الاقتصاد الدائري والإشراف على النفايات'], ['a waste stream that could be reduced or reused', 'تيار نفايات يمكن تقليله أو إعادة استخدامه'], ['the waste minimisation plan', 'خطة تقليل النفايات']),
  'sk-fs-gr-esg': T(['ESG disclosure', 'الإفصاح البيئي والاجتماعي والحوكمي'], ['a disclosure figure without a traceable source', 'رقم إفصاح دون مصدر يمكن تتبّعه'], ['the disclosure data sheet', 'ورقة بيانات الإفصاح']),
  'sk-fs-gr-climaterisk': T(['climate risk to plant operations', 'مخاطر المناخ على تشغيل المحطة'], ['an extreme heat or seawater temperature forecast', 'توقع بحرارة شديدة أو بارتفاع حرارة مياه البحر'], ['the climate risk register', 'سجل مخاطر المناخ']),
  'sk-fs-adv-smr': T(['small modular reactor designs', 'تصاميم المفاعلات المعيارية الصغيرة'], ['a design feature with no APR-1400 equivalent', 'ميزة تصميمية لا مثيل لها في APR-1400'], ['the technology watch note', 'مذكرة الرصد التقني']),
  'sk-fs-adv-passive': T(['passive safety concepts', 'مفاهيم السلامة السلبية'], ['a passive system that must work without power or operator action', 'نظام سلبي يجب أن يعمل دون طاقة أو تدخل من المشغّل'], ['the design comparison note', 'مذكرة مقارنة التصاميم']),
  'sk-fs-adv-multimodule': T(['multi-module operations concepts', 'مفاهيم تشغيل الوحدات المتعددة'], ['an event affecting several modules at once', 'حدث يؤثر في عدة وحدات في آن واحد'], ['the operating concept note', 'مذكرة مفهوم التشغيل']),
  'sk-fs-adv-factoryqa': T(['factory fabrication quality assurance', 'ضمان الجودة في التصنيع بالمصنع'], ['a non-conformance found after a module leaves the factory', 'حالة عدم مطابقة تُكتشف بعد خروج الوحدة من المصنع'], ['the factory surveillance note', 'مذكرة الرقابة على المصنع']),
  'sk-fs-adv-fuelcycle': T(['advanced fuel-cycle options', 'خيارات دورة الوقود المتقدمة'], ['a fuel-cycle claim without published evidence', 'ادعاء عن دورة الوقود دون دليل منشور'], ['the technology watch note', 'مذكرة الرصد التقني']),
  'sk-fs-adv-fusion': T(['fusion energy concepts', 'مفاهيم طاقة الاندماج'], ['a fusion milestone reported in the news', 'إنجاز في الاندماج تتناقله الأخبار'], ['the horizon watch note', 'مذكرة رصد الأفق']),
  'sk-fs-adv-micro': T(['microreactor and transportable unit concepts', 'مفاهيم المفاعلات الدقيقة والوحدات القابلة للنقل'], ['a remote-site operating assumption', 'افتراض تشغيلي لموقع بعيد'], ['the technology watch note', 'مذكرة الرصد التقني']),
  'sk-fs-adv-regulation': T(['advanced-reactor regulatory approaches', 'المقاربات التنظيمية للمفاعلات المتقدمة'], ['a licensing question that today\'s rules do not answer', 'مسألة ترخيص لا تجيب عنها القواعد الحالية'], ['the regulatory watch note', 'مذكرة الرصد التنظيمي']),
  'sk-fs-cy-phishing': T(['phishing awareness', 'الوعي بالتصيّد الاحتيالي'], ['a suspicious message', 'رسالة مشبوهة']),
  'sk-fs-cy-media': T(['removable media discipline', 'الانضباط في استخدام الوسائط القابلة للإزالة'], ['an unapproved USB device', 'جهاز USB غير معتمد']),
  'sk-fs-cy-zones': T(['zone-and-conduit awareness', 'الوعي بمفهوم المناطق والقنوات'], ['a device connected where it should not be', 'جهاز متصل في مكان لا ينبغي أن يكون فيه']),
  'sk-fs-cy-access': T(['password and access hygiene', 'النظافة في كلمات المرور وصلاحيات الوصول'], ['a request to share a password or badge', 'طلب لمشاركة كلمة مرور أو بطاقة دخول']),
  'sk-fs-cy-report': T(['cyber incident reporting', 'الإبلاغ عن الحوادث السيبرانية'], ['a suspected cyber incident', 'حادث سيبراني مشتبه به']),
  'sk-fs-dp-dic': T(['digital I&C fundamentals', 'أساسيات أجهزة القياس والتحكم الرقمية'], ['a digital channel that disagrees with its redundant channel', 'قناة رقمية تخالف قراءتها القناة الاحتياطية'], ['the digital system notes', 'ملاحظات النظام الرقمي']),
  'sk-fs-dp-robotics': T(['robotic and remote inspection', 'الفحص الروبوتي وعن بُعد'], ['a robot that loses position or signal in the field', 'روبوت يفقد موقعه أو إشارته في الموقع'], ['the inspection data package', 'حزمة بيانات الفحص']),
  'sk-fs-dp-procurement': T(['digital procurement', 'المشتريات الرقمية'], ['a catalogue item with an incomplete quality classification', 'بند في الكتالوج بتصنيف جودة غير مكتمل'], ['the e-procurement record', 'سجل الشراء الإلكتروني']),
  'sk-fs-dp-ework': T(['electronic work packages', 'حزم العمل الإلكترونية'], ['a sync conflict between the device and the work management system', 'تعارض في المزامنة بين الجهاز ونظام إدارة الأعمال'], ['the electronic work record', 'سجل العمل الإلكتروني']),
  'sk-fs-dp-rounds': T(['digital operator rounds on handheld devices', 'الجولات التشغيلية الرقمية باستخدام الأجهزة المحمولة'], ['a missed or out-of-band reading flagged by the device', 'قراءة فائتة أو خارج النطاق ينبّه إليها الجهاز'], ['the electronic rounds record', 'السجل الإلكتروني للجولات']),
  'sk-fs-dp-paperlog': T(['paper log-sheet rounds', 'الجولات بسجلات ورقية'], ['a gap or illegible entry in a log sheet', 'فجوة أو قيد غير مقروء في سجل ورقي'], ['the paper log sheet', 'السجل الورقي']),
  'sk-fs-dp-paperwp': T(['paper work-package handling', 'التعامل مع حزم العمل الورقية'], ['a missing signature or page in a paper package', 'توقيع أو صفحة مفقودة في حزمة ورقية'], ['the paper work package', 'حزمة العمل الورقية']),
};

/** F01 specialised skills about advanced reactors (same range rule as the FS02 advanced-reactor area). */
export const ADVANCED_F01 = ['sk-pf-01-advfuel', 'sk-pf-02-advcool', 'sk-ch-01-advchem'];
export const LEADING = ['sk-ld-01', 'sk-ld-01-coach', 'sk-ld-01-instruct'];
