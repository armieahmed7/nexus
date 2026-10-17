// M12 · Future-skills glossary (/help/glossary#term-<id>): workforce and skills terms the platform uses without defining.
// Each general definition paraphrases the cited public source (official bodies and standards organisations, read on
// READ_ON); "In Kafa'a" lines describe the platform itself. The 12 plant and licensing terms stay in the database glossary
// (kafaa_glossary) and are merged in on the page; replacesDb hides a database row this list covers with a sourced entry.
import type { Bi, GlossaryTerm, HelpLink } from './types';
import { SRC } from './sources';

const bi = (en: string, ar: string): Bi => ({ en, ar });
const to = (...routes: string[]): HelpLink[] => routes.map((route) => ({ route }));

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: 'advanced-reactor',
    term: bi('Advanced reactors (Generation IV)', 'المفاعلات المتقدمة (الجيل الرابع)'),
    abbr: 'Gen IV',
    definition: bi(
      'Reactor designs beyond those operating today. The Generation IV International Forum, founded in 2001, coordinates international research on six advanced reactor systems.',
      'تصاميم مفاعلات تتجاوز المفاعلات العاملة اليوم. ويتولى منتدى الجيل الرابع الدولي، الذي تأسس عام 2001، تنسيق البحث الدولي في ستة أنظمة متقدمة للمفاعلات.',
    ),
    inKafaa: bi(
      'Advanced-reactor skills are defined up to Qualified only, because Expert needs an operating plant. Everything about them is planning: no deployment decision is implied.',
      'تُعرَّف مهارات المفاعلات المتقدمة حتى مستوى المؤهَّل فقط، لأن مستوى الخبير يتطلب محطة عاملة. وكل ما يتعلق بها تخطيطي، ولا يعني أي قرار بالنشر.',
    ),
    where: to('future', 'careers-next-gen', 'learn-academies'),
    sources: [SRC.gif],
  },
  {
    id: 'ai-literacy',
    term: bi('AI literacy and AI fluency', 'الإلمام بالذكاء الاصطناعي والطلاقة فيه'),
    definition: bi(
      'The notions people need to make informed decisions about AI systems. Article 4 of the EU AI Act asks providers and deployers to take measures to support the AI literacy of their staff and of others who operate AI systems for them.',
      'المفاهيم التي يحتاجها الأفراد لاتخاذ قرارات مستنيرة بشأن أنظمة الذكاء الاصطناعي. وتطلب المادة 4 من قانون الاتحاد الأوروبي للذكاء الاصطناعي من المزوّدين والجهات المستخدِمة اتخاذ تدابير لدعم إلمام موظفيهم ومن يشغّلون أنظمة الذكاء الاصطناعي لحسابهم بهذا المجال.',
    ),
    inKafaa: bi(
      'The AI Fluency Ladder describes four rungs (Aware, Practitioner, Builder, Assurer) worked out from evidence, never from points.',
      'يصف سلّم الطلاقة في الذكاء الاصطناعي أربع درجات (مُدرِك، ممارِس، بانٍ، ضامِن) تُحسب من الأدلة ولا تُحسب بالنقاط أبداً.',
    ),
    where: to('learn-ai-fluency', 'pathways-starter', 'my-ai-fluency'),
    sources: [SRC.euAiLiteracy],
  },
  {
    id: 'ai-rmf',
    term: bi('AI Risk Management Framework (NIST)', 'إطار إدارة مخاطر الذكاء الاصطناعي (NIST)'),
    abbr: 'AI RMF',
    definition: bi(
      'A voluntary framework from the US National Institute of Standards and Technology, released in January 2023, that helps organisations manage AI risks and build trustworthiness into how AI systems are designed, developed, used and evaluated.',
      'إطار طوعي أصدره المعهد الوطني الأمريكي للمعايير والتقنية في يناير 2023، يساعد المؤسسات على إدارة مخاطر الذكاء الاصطناعي وبناء الجدارة بالثقة في تصميم أنظمته وتطويرها واستخدامها وتقييمها.',
    ),
    where: to('admin-ai-transparency', 'workforce-ai-register'),
    sources: [SRC.nistAiRmf],
  },
  {
    id: 'case',
    term: bi('Competencies and Academic Standards Exchange', 'معيار تبادل الكفاءات والمعايير الأكاديمية'),
    abbr: 'CASE',
    definition: bi(
      'A 1EdTech standard that lets institutions and software share standards and competencies in one consistent digital format, so learning resources can be matched to the goals they support.',
      'معيار من 1EdTech يتيح للمؤسسات والبرمجيات تبادل المعايير والكفاءات بصيغة رقمية موحدة، لتُربط موارد التعلّم بالأهداف التي تخدمها.',
    ),
    inKafaa: bi('The published skills framework can be exported as a CASE-shaped package.', 'يمكن تصدير إطار المهارات المنشور حزمةً بصيغة CASE.'),
    where: to('skills-frameworks'),
    sources: [SRC.case],
  },
  {
    id: 'clr',
    term: bi('Comprehensive learner record', 'سجل المتعلّم الشامل'),
    abbr: 'CLR',
    definition: bi(
      "A 1EdTech standard for trustworthy digital records of a person's academic and workplace achievements (courses, competencies, skills and milestones), kept under the learner's control.",
      'معيار من 1EdTech لسجلات رقمية موثوقة توثّق إنجازات الشخص الأكاديمية والمهنية (الدورات والكفاءات والمهارات والمحطات البارزة)، وتبقى تحت تصرّف المتعلّم.',
    ),
    inKafaa: bi('My learner record follows this shape; you share a chosen part with a link that expires.', 'يتبع سجل المتعلّم الخاص بك هذه الصيغة، وتشارك جزءاً تختاره منه برابط تنتهي صلاحيته.'),
    where: to('my-skills-record'),
    sources: [SRC.clr],
  },
  {
    id: 'competency',
    term: bi('Competency and skill', 'الكفاءة والمهارة'),
    definition: bi(
      'A competency is the ability to apply a set of related skills, knowledge and abilities to perform tasks in a defined work setting. A skill usually names one proficiency; a competency groups several related strengths.',
      'الكفاءة هي القدرة على تطبيق مجموعة من المهارات والمعارف والقدرات المترابطة لأداء المهام في بيئة عمل محددة. أما المهارة فتدل عادةً على إتقان واحد، بينما تجمع الكفاءة عدة قدرات مترابطة.',
    ),
    inKafaa: bi(
      'The competency library groups roles\' requirements into domains; the skills catalogue describes individual skills level by level.',
      'تجمع مكتبة الكفاءات متطلبات الأدوار في مجالات، ويصف كتالوج المهارات كل مهارة مستوى بمستوى.',
    ),
    where: to('competencies', 'skills'),
    sources: [SRC.uCompetency, SRC.uSkillsVsCompetence],
  },
  {
    id: 'credit',
    term: bi('Learning credit', 'الرصيد التعليمي'),
    definition: bi(
      'A unit earned for successfully completing courses or modules, which also measures the volume of learning a programme involves based on the usual effort it takes.',
      'وحدة تُكتسب عند إتمام الدورات أو الوحدات الدراسية بنجاح، وتقيس كذلك حجم التعلّم في البرنامج بناءً على الجهد المعتاد الذي يتطلبه.',
    ),
    inKafaa: bi('1 credit is 10 notional hours of study and practice; 30 credits make a stack toward an indicative award.', 'الرصيد الواحد يساوي 10 ساعات اسمية من الدراسة والممارسة، وتشكّل 30 رصيداً حزمة نحو مؤهل إرشادي.'),
    where: to('recognition', 'my-credits'),
    sources: [SRC.uCredit],
  },
  {
    id: 'critical-core-skills',
    term: bi('Critical core skills', 'المهارات الأساسية الحرجة'),
    abbr: 'CCS',
    definition: bi(
      'Transferable skills that SkillsFuture Singapore set out as 16 soft skills in three clusters, to create a common skills language for individuals, employers and training providers.',
      'مهارات قابلة للنقل حددتها SkillsFuture في سنغافورة في 16 مهارة شخصية ضمن ثلاث مجموعات، لتكوين لغة مهارات مشتركة بين الأفراد وأصحاب العمل ومقدمي التدريب.',
    ),
    inKafaa: bi('Nuclear Critical Core Skills are 16 skills written for a nuclear plant, in the same three clusters: thinking critically, interacting with others and staying relevant.', 'المهارات الأساسية الحرجة في المجال النووي 16 مهارة مكتوبة لمحطة نووية ضمن المجموعات الثلاث نفسها: التفكير النقدي، والتفاعل مع الآخرين، ومواكبة المستجدات.'),
    where: to('learn-core-skills', 'my-core-skills'),
    sources: [SRC.criticalCore],
  },
  {
    id: 'digcomp',
    term: bi('DigComp (European Digital Competence Framework)', 'DigComp (الإطار الأوروبي للكفاءة الرقمية)'),
    abbr: 'DigComp',
    definition: bi(
      'The European Commission\'s framework of the knowledge, skills and attitudes needed for confident, critical and responsible use of digital technologies. Version 3.0 has five competence areas.',
      'إطار المفوضية الأوروبية للمعارف والمهارات والاتجاهات اللازمة لاستخدام التقنيات الرقمية بثقة ووعي نقدي ومسؤولية. ويضم الإصدار 3.0 خمسة مجالات للكفاءة.',
    ),
    where: to('skills-frameworks', 'competencies-scale'),
    sources: [SRC.digcomp],
  },
  {
    id: 'digital-skills',
    term: bi('Digital skills', 'المهارات الرقمية'),
    definition: bi(
      'The skills needed to use digital technology in daily life and work: a range from basic functional skills to advanced specialist ones, combining knowledge, attitudes and habits.',
      'المهارات اللازمة لاستخدام التقنية الرقمية في الحياة اليومية والعمل: طيف يمتد من المهارات الوظيفية الأساسية إلى المهارات التخصصية المتقدمة، ويجمع بين المعارف والاتجاهات والعادات.',
    ),
    where: to('skills', 'learn-ai-fluency'),
    sources: [SRC.uDigital],
  },
  {
    id: 'digital-twin',
    term: bi('Digital twin', 'التوأم الرقمي'),
    abbr: 'DT',
    definition: bi(
      'A virtual (digital) representation of a physical or perceived real-world entity, concept or notion.',
      'تمثيل افتراضي (رقمي) لكيان أو مفهوم أو فكرة من العالم الواقعي، مادياً كان أو متصوَّراً.',
    ),
    inKafaa: bi('Digital twins are one of the technology drivers in the 2030 and 2035 role views, and the theme of a future-skills academy.', 'التوائم الرقمية أحد المحركات التقنية في عروض الأدوار لعامي 2030 و2035، وموضوع إحدى أكاديميات مهارات المستقبل.'),
    where: to('careers-horizons', 'learn-academies', 'my-twin-drills'),
    sources: [SRC.nistTwin],
  },
  {
    id: 'emiratisation',
    term: bi('Emiratisation', 'التوطين'),
    definition: bi(
      'The UAE Government programme to help Emiratis get hired and stay employed, through training, life skills, reserved jobs and legal protections.',
      'برنامج حكومة دولة الإمارات لمساعدة المواطنين على الحصول على الوظائف والاستمرار فيها، عبر التدريب والمهارات الحياتية والوظائف المخصصة والحماية القانونية.',
    ),
    where: to('pathways', 'workforce-emiratization'),
    sources: [SRC.emiratisation],
    replacesDb: ['gl-11'],
  },
  {
    id: 'endorsement',
    term: bi('Endorsement', 'الاعتماد'),
    definition: bi(
      'In Open Badges 3.0, a specialised credential that signals support for an issuer, a credential programme or an individual\'s achievement.',
      'في معيار Open Badges 3.0، اعتماد رقمي متخصص يعبّر عن دعم جهة إصدار أو برنامج شهادات أو إنجاز فردي.',
    ),
    inKafaa: bi(
      'Framework owners endorse university programmes for three years; graduates of an endorsed programme receive validated evidence at hire, capped at level 2.',
      'يعتمد مالكو الإطار البرامج الجامعية لمدة ثلاث سنوات، ويحصل خريجو البرنامج المعتمد على أدلة مُصادق عليها عند التعيين بحد أقصى المستوى 2.',
    ),
    where: to('universities', 'partner-university-programmes'),
    sources: [SRC.badges],
  },
  {
    id: 'esco',
    term: bi('ESCO (European Skills, Competences, Qualifications and Occupations)', 'ESCO (التصنيف الأوروبي للمهارات والكفاءات والمؤهلات والمهن)'),
    abbr: 'ESCO',
    definition: bi(
      "The European Commission's multilingual classification of occupations and skills, available in 28 languages. Its skills pillar makes no distinction between skills and competences.",
      'تصنيف المفوضية الأوروبية متعدد اللغات للمهن والمهارات، ومتاح بثماني وعشرين لغة. ولا يميّز ركن المهارات فيه بين المهارات والكفاءات.',
    ),
    where: to('skills-frameworks', 'skills'),
    sources: [SRC.escoWhat, SRC.escoSkills],
  },
  {
    id: 'fanr',
    term: bi('Federal Authority for Nuclear Regulation', 'الهيئة الاتحادية للرقابة النووية'),
    abbr: 'FANR',
    definition: bi(
      'The UAE federal authority that regulates the nuclear sector, including licensing of regulated activities and certification.',
      'الجهة الاتحادية في دولة الإمارات التي تنظّم القطاع النووي، بما في ذلك ترخيص الأنشطة الخاضعة للتنظيم وإصدار الشهادات.',
    ),
    inKafaa: bi(
      "Kafa'a is never a regulator: it does not issue or verify FANR licences or operator certificates; qualification and licence lines only mirror the licensee's systems.",
      'كفاءة ليست جهة رقابية أبداً: فهي لا تصدر تراخيص الهيئة أو شهادات المشغّلين ولا تتحقق منها، وبنود المؤهلات والتراخيص فيها مجرد نسخة مطابقة لأنظمة المرخَّص له.',
    ),
    where: to('licensing', 'verify'),
    sources: [SRC.fanr],
  },
  {
    id: 'green-skills',
    term: bi('Green skills', 'المهارات الخضراء'),
    definition: bi(
      'The skills the workforce needs, in all sectors and at all levels, to adapt products, services and processes to climate change and environmental requirements.',
      'المهارات التي تحتاجها القوى العاملة في جميع القطاعات وعلى جميع المستويات لتكييف المنتجات والخدمات والعمليات مع تغيّر المناخ والمتطلبات البيئية.',
    ),
    where: to('skills-clean-energy', 'skills'),
    sources: [SRC.uGreen],
  },
  {
    id: 'greencomp',
    term: bi('GreenComp (European sustainability competence framework)', 'GreenComp (الإطار الأوروبي لكفاءات الاستدامة)'),
    abbr: 'GreenComp',
    definition: bi(
      'A reference framework for sustainability competences from the European Commission\'s Joint Research Centre: 12 competences grouped into four areas, for learners of any age in any setting.',
      'إطار مرجعي لكفاءات الاستدامة من مركز البحوث المشترك التابع للمفوضية الأوروبية: 12 كفاءة موزعة على أربعة مجالات، للمتعلّمين من جميع الأعمار وفي جميع البيئات.',
    ),
    inKafaa: bi('CleanEnergyComp keeps its structure: twelve competences in four areas, written for a nuclear energy company.', 'يحافظ إطار كفاءات الطاقة النظيفة على هيكله: اثنتا عشرة كفاءة في أربعة مجالات، مكتوبة لشركة طاقة نووية.'),
    where: to('skills-clean-energy'),
    sources: [SRC.greencomp],
  },
  {
    id: 'iso-30414',
    term: bi('ISO 30414 (human capital reporting)', 'ISO 30414 (الإفصاح عن رأس المال البشري)'),
    abbr: 'ISO 30414',
    definition: bi(
      'The international standard of requirements and recommendations for human capital reporting and disclosure. The second edition, ISO 30414:2025, added auditable requirements and a baseline set of metrics.',
      'المعيار الدولي للمتطلبات والتوصيات الخاصة بإعداد التقارير والإفصاح عن رأس المال البشري. وأضاف الإصدار الثاني ISO 30414:2025 متطلبات قابلة للتدقيق ومجموعة أساسية من المؤشرات.',
    ),
    inKafaa: bi(
      "The disclosure pack follows the shape of its Skills, Capabilities and Development area. Kafa'a is not an auditor or a certification body; the numbers are demonstration data.",
      'تتبع حزمة الإفصاح هيكل مجال المهارات والقدرات والتطوير فيه. وكفاءة ليست جهة تدقيق أو جهة إصدار شهادات، والأرقام بيانات للعرض فقط.',
    ),
    where: to('workforce-disclosure'),
    sources: [SRC.iso30414],
  },
  {
    id: 'jahiz',
    term: bi('Jahiz', 'جاهز'),
    definition: bi(
      'An interactive digital platform of the UAE federal government that offers federal employees courses to build emerging future skills.',
      'منصة رقمية تفاعلية تابعة للحكومة الاتحادية في دولة الإمارات، تقدّم لموظفي الحكومة الاتحادية دورات لبناء مهارات المستقبل الناشئة.',
    ),
    inKafaa: bi('Skills in the catalogue carry a Jahiz-style group (such as Digital or 10X) so they line up with that national effort.', 'تحمل المهارات في الكتالوج مجموعة على غرار جاهز (مثل الرقمية أو مهارات 10X) لتتوافق مع ذلك الجهد الوطني.'),
    where: to('skills', 'skills-clean-energy'),
    sources: [SRC.jahiz],
  },
  {
    id: 'learning-outcomes',
    term: bi('Learning outcomes', 'نواتج التعلّم'),
    definition: bi(
      'What a person is expected to master on completing a programme: knowledge, understanding, attitudes, values, skills and behaviours.',
      'ما يُتوقع أن يتقنه الشخص عند إتمام البرنامج: المعارف والفهم والاتجاهات والقيم والمهارات والسلوكيات.',
    ),
    where: to('skills-clean-energy', 'learn-future-skills'),
    sources: [SRC.uOutcomes],
  },
  {
    id: 'learning-pathway',
    term: bi('Learning pathway', 'مسار التعلّم'),
    definition: bi(
      'The sequence of learning someone follows to gain knowledge, skills or competences. It can combine formal and non-formal learning, and validating it can lead to certification.',
      'تسلسل التعلّم الذي يتبعه الشخص لاكتساب المعارف أو المهارات أو الكفاءات. ويمكن أن يجمع بين التعلّم النظامي وغير النظامي، وقد تؤدي المصادقة عليه إلى شهادة.',
    ),
    where: to('learn-paths', 'learn-pathways'),
    sources: [SRC.uPathway],
  },
  {
    id: 'micro-credential',
    term: bi('Micro-credential', 'الشهادة المصغّرة'),
    definition: bi(
      'A credential that certifies the learning outcomes of a short learning experience, such as a short course, giving a flexible, targeted way to build knowledge, skills and competences.',
      'شهادة توثّق نواتج تجربة تعلّم قصيرة، مثل دورة قصيرة، وتوفر طريقة مرنة وموجّهة لبناء المعارف والمهارات والكفاءات.',
    ),
    inKafaa: bi(
      'Kafa\'a micro-credentials are signed and stackable, earned from evidence already on the platform, and never a licence or a qualification.',
      'الشهادات المصغّرة في كفاءة موقّعة وقابلة للتجميع، وتُكتسب من أدلة موجودة على المنصة، وليست رخصة أو مؤهلاً أبداً.',
    ),
    where: to('my-skills-credentials', 'recognition'),
    sources: [SRC.euMicro],
  },
  {
    id: 'nqf',
    term: bi('National qualifications framework', 'الإطار الوطني للمؤهلات'),
    abbr: 'NQF',
    definition: bi(
      'A national instrument that classifies qualifications at levels by the learning outcomes expected at each level, making qualifications easier to compare. In the UAE, for example, a diploma sits at level 5 and a bachelor\'s degree at level 7.',
      'أداة وطنية تصنّف المؤهلات في مستويات وفق نواتج التعلّم المتوقعة في كل مستوى، فتسهّل المقارنة بين المؤهلات. ففي دولة الإمارات مثلاً، يقع الدبلوم في المستوى 5 والبكالوريوس في المستوى 7.',
    ),
    inKafaa: bi('Kafa\'a maps its levels loosely and indicatively to the UAE NQF; NQF levels describe qualifications, not job proficiency.', 'تطابق كفاءة مستوياتها مطابقة تقريبية وإرشادية مع الإطار الوطني للمؤهلات، إذ تصف مستويات الإطار المؤهلات لا الإتقان الوظيفي.'),
    where: to('recognition', 'competencies-scale'),
    sources: [SRC.uNqf, SRC.adekNqf],
  },
  {
    id: 'onet',
    term: bi('O*NET', 'O*NET (شبكة المعلومات المهنية)'),
    abbr: 'O*NET',
    definition: bi(
      "The United States' primary source of occupational information, sponsored by the US Department of Labor's Employment and Training Administration.",
      'المصدر الرئيسي للمعلومات المهنية في الولايات المتحدة، وترعاه إدارة التوظيف والتدريب في وزارة العمل الأمريكية.',
    ),
    where: to('skills-frameworks'),
    sources: [SRC.onet],
  },
  {
    id: 'open-badges',
    term: bi('Open Badges', 'الشارات المفتوحة (Open Badges)'),
    definition: bi(
      'A 1EdTech standard that packages metadata about a single achievement, such as a micro-credential, a skill or a degree, into a shareable credential. Version 3.0 is current.',
      'معيار من 1EdTech يجمع البيانات الوصفية لإنجاز واحد، مثل شهادة مصغّرة أو مهارة أو درجة علمية، في اعتماد قابل للمشاركة. والإصدار 3.0 هو الإصدار الحالي.',
    ),
    inKafaa: bi('The Credential Wallet issues signed Open Badges 3.0 credentials for internal course certificates and completions.', 'تُصدر محفظة الاعتمادات شارات موقّعة بصيغة Open Badges 3.0 لشهادات الدورات الداخلية وإتمامها.'),
    where: to('my-skills-wallet', 'verify-badge-check'),
    sources: [SRC.badges],
  },
  {
    id: 'proficiency-level',
    term: bi('Proficiency level', 'مستوى الإتقان'),
    definition: bi(
      'A step on a scale that says how well, and with how much autonomy and responsibility, someone applies a skill. SFIA 9, for example, uses seven levels of responsibility, from "Follow" to "Set strategy, inspire, mobilise".',
      'درجة على مقياس تبيّن مدى إتقان الشخص لتطبيق مهارة ما ومقدار استقلاليته ومسؤوليته. فإطار SFIA 9 مثلاً يعتمد سبعة مستويات للمسؤولية، من "يتّبع" إلى "يضع الاستراتيجية ويُلهم ويحشد".',
    ),
    inKafaa: bi('Kafa\'a uses four levels (Awareness, Practitioner, Qualified, Expert), shows "not yet" instead of zero, and treats Authority as a recognition, not a level.', 'تعتمد كفاءة أربعة مستويات (إلمام، ممارس، مؤهَّل، خبير)، وتعرض "ليس بعد" بدلاً من الصفر، وتعدّ الصفة المرجعية اعترافاً لا مستوى.'),
    where: to('competencies-levels', 'competencies-scale'),
    sources: [SRC.sfiaLevels],
  },
  {
    id: 'reskilling',
    term: bi('Reskilling (retraining)', 'إعادة التأهيل المهني'),
    definition: bi(
      'Training that lets people acquire new skills giving access to a new occupation or new professional activities. It is close to, but not the same as, upskilling.',
      'تدريب يتيح للأفراد اكتساب مهارات جديدة تفتح لهم الطريق إلى مهنة جديدة أو أنشطة مهنية جديدة. وهو قريب من تطوير المهارات لكنه ليس مثله.',
    ),
    where: to('careers-translate', 'my-transition-plan'),
    sources: [SRC.uRetraining],
  },
  {
    id: 'reusability',
    term: bi('Skill reusability level', 'مستوى قابلية إعادة استخدام المهارة'),
    definition: bi(
      'How widely a skill applies. ESCO records a reusability level for each skill: transversal, cross-sectoral, sector-specific or occupation-specific.',
      'مدى اتساع نطاق تطبيق المهارة. ويسجّل تصنيف ESCO لكل مهارة مستوى قابلية إعادة الاستخدام: مستعرضة، أو عابرة للقطاعات، أو خاصة بقطاع، أو خاصة بمهنة.',
    ),
    inKafaa: bi('The skills catalogue filters by reusability; sector-specific means nuclear.', 'يتيح كتالوج المهارات التصفية حسب قابلية إعادة الاستخدام، و"خاصة بالقطاع" تعني القطاع النووي.'),
    where: to('skills'),
    sources: [SRC.escoSkills],
  },
  {
    id: 'rpl',
    term: bi('Recognition of prior learning', 'الاعتراف بالتعلّم السابق'),
    abbr: 'RPL',
    definition: bi(
      "A process in which qualified people identify, document, assess and certify a person's competencies, whether gained through formal, non-formal or informal learning, against established standards.",
      'عملية يحدد فيها أشخاص مؤهلون كفاءات الفرد ويوثقونها ويقيّمونها ويشهدون بها وفق معايير معتمدة، سواء اكتُسبت عبر التعلّم النظامي أو غير النظامي أو العرضي.',
    ),
    inKafaa: bi('A request needs an evidence pack, two different assessors and ends in full, partial or not-yet credit.', 'يتطلب الطلب حزمة أدلة ومقيّمَين مختلفين، وينتهي باعتراف كامل أو جزئي أو "ليس بعد".'),
    where: to('recognition', 'my-recognition'),
    sources: [SRC.uRpl, SRC.iloRpl],
  },
  {
    id: 'safety-culture',
    term: bi('Nuclear safety culture', 'ثقافة السلامة النووية'),
    definition: bi(
      'The core values and behaviours resulting from a collective commitment by leaders and individuals to put safety ahead of competing goals, to protect people and the environment.',
      'القيم والسلوكيات الأساسية الناتجة عن التزام جماعي من القادة والأفراد بتقديم السلامة على الأهداف المنافسة، لحماية الناس والبيئة.',
    ),
    where: to('safety-culture', 'learn-core-skills'),
    sources: [SRC.nrcSafetyCulture],
  },
  {
    id: 'sfia',
    term: bi('SFIA (Skills Framework for the Information Age)', 'SFIA (إطار المهارات لعصر المعلومات)'),
    abbr: 'SFIA',
    definition: bi(
      'A skills framework from the SFIA Foundation built on seven levels of responsibility. SFIA 9 defines each skill only at the levels where it exists.',
      'إطار مهارات صادر عن مؤسسة SFIA يقوم على سبعة مستويات للمسؤولية، ويعرّف الإصدار SFIA 9 كل مهارة في المستويات التي توجد فيها فقط.',
    ),
    where: to('competencies-levels', 'skills-frameworks'),
    sources: [SRC.sfiaLevels],
  },
  {
    id: 'skill-obsolescence',
    term: bi('Skill decay, obsolescence and half-life', 'تراجع المهارات وتقادمها وعمر النصف'),
    definition: bi(
      'Skill obsolescence is when learned abilities and knowledge are in little or no demand or have become outdated, for example through new technology or changing job requirements. It is usually addressed by retraining or upgrading skills.',
      'تقادم المهارات هو أن تصبح القدرات والمعارف المكتسبة قليلة الطلب أو غير مطلوبة أو قديمة، بسبب التقنيات الجديدة أو تغيّر متطلبات الوظائف مثلاً. ويُعالج عادةً بإعادة التأهيل أو تطوير المهارات.',
    ),
    inKafaa: bi(
      'Each skill has a half-life without use (fast 18, standard 36 or slow 60 months), and evidence older than 36 months counts one level lower.',
      'لكل مهارة عمر نصف دون استخدام (سريع 18 شهراً أو معتاد 36 شهراً أو بطيء 60 شهراً)، ويُحتسب الدليل الذي يتجاوز عمره 36 شهراً بمستوى أدنى.',
    ),
    where: to('skills', 'skills-changes'),
    sources: [SRC.uObsolescence],
  },
  {
    id: 'skills-passport',
    term: bi('Skills passport', 'جواز المهارات'),
    definition: bi(
      'A trusted digital repository that consolidates a person\'s skills by bringing together employment, training, licensing and education records. Singapore\'s Careers & Skills Passport is one public example.',
      'مستودع رقمي موثوق يجمع مهارات الشخص من سجلات التوظيف والتدريب والترخيص والتعليم في مكان واحد. ويُعد جواز المسارات المهنية والمهارات في سنغافورة مثالاً عاماً على ذلك.',
    ),
    inKafaa: bi('My Skills Passport shows every level with how it was evidenced; qualification lines mirror the source systems.', 'يعرض جواز مهاراتي كل مستوى مع طريقة ثبوته، وبنود المؤهلات نسخة مطابقة للأنظمة المصدر.'),
    where: to('my-skills', 'my-skills-print'),
    sources: [SRC.skillsPassportSg],
  },
  {
    id: 'smr',
    term: bi('Small modular reactor', 'المفاعل المعياري الصغير'),
    abbr: 'SMR',
    definition: bi(
      'A reactor generally of 300 MWe equivalent or less, using modular technology with major components built in factories, aiming at economies from series production and shorter construction times.',
      'مفاعل تبلغ قدرته عادةً 300 ميغاواط كهربائي أو أقل، يعتمد تقنية معيارية تُصنع فيها المكونات الرئيسية في المصانع، بهدف تحقيق وفورات الإنتاج المتسلسل وتقصير مدة البناء.',
    ),
    inKafaa: bi('Next-generation views show what SMRs would change and keep in each role, as planning only: no deployment decision is implied.', 'تعرض صفحات الجيل القادم ما قد تغيّره المفاعلات المعيارية الصغيرة وما يبقى في كل دور، لأغراض التخطيط فقط، ولا يعني ذلك أي قرار بالنشر.'),
    where: to('careers-next-gen', 'future', 'pathways-starter'),
    sources: [SRC.wnaSmr],
  },
  {
    id: 'transversal-skills',
    term: bi('Transversal skills', 'المهارات المستعرضة'),
    definition: bi(
      'Skills not tied to one job, task, subject or field, which can be used in many situations and work settings, such as critical thinking, communication, teamwork and self-discipline. They are also called soft, core or life skills.',
      'مهارات لا ترتبط بوظيفة أو مهمة أو مادة أو مجال بعينه، ويمكن استخدامها في مواقف وبيئات عمل كثيرة، مثل التفكير النقدي والتواصل والعمل الجماعي والانضباط الذاتي. وتُسمّى أيضاً المهارات الشخصية أو الأساسية أو الحياتية.',
    ),
    where: to('learn-core-skills', 'skills'),
    sources: [SRC.uTransversal],
  },
  {
    id: 'upskilling',
    term: bi('Upskilling', 'تطوير المهارات'),
    definition: bi(
      "Short-term, targeted training, usually after initial education or training, that adds to, improves or refreshes a person's existing knowledge, skills and competences.",
      'تدريب قصير الأمد وموجّه يأتي عادةً بعد التعليم أو التدريب الأولي، ويضيف إلى معارف الشخص ومهاراته وكفاءاته القائمة أو يحسّنها أو يجددها.',
    ),
    where: to('learn', 'my-coach'),
    sources: [SRC.uUpskilling],
  },
  {
    id: 'validation',
    term: bi('Validation of learning', 'المصادقة على التعلّم'),
    definition: bi(
      "Evaluation of an individual's achievement of learning objectives using methods such as written, oral and practical tests, projects and portfolios, whether or not the person followed an education programme.",
      'تقييم مدى تحقيق الفرد لأهداف التعلّم بأساليب مثل الاختبارات الكتابية والشفهية والعملية والمشاريع وملفات الإنجاز، سواء التحق ببرنامج تعليمي أم لا.',
    ),
    inKafaa: bi('A self-rated skill becomes "validated" when a manager or peer confirms it in a check-in.', 'تصبح المهارة المقيّمة ذاتياً "مُصادقاً عليها" عندما يؤكدها مدير أو زميل في أحد التقييمات.'),
    where: to('my-skills-checkins', 'team-skills-validate'),
    sources: [SRC.uValidation],
  },
  {
    id: 'verifiable-credential',
    term: bi('Verifiable credential', 'الاعتماد القابل للتحقق'),
    definition: bi(
      'A tamper-evident credential whose authorship can be verified cryptographically, so anyone can check who issued it and whether it was changed. The W3C data model reached Recommendation status in May 2025 (version 2.0).',
      'اعتماد يكشف أي تلاعب به، ويمكن التحقق من مُصدره بالتشفير، فيستطيع أي شخص معرفة من أصدره وما إذا عُدّل. وبلغ نموذج بياناته لدى W3C مرتبة التوصية في مايو 2025 (الإصدار 2.0).',
    ),
    where: to('verify-badge-check', 'my-skills-wallet'),
    sources: [SRC.vc],
  },
  {
    id: 'xapi',
    term: bi('xAPI (Experience API)', 'واجهة xAPI (Experience API)'),
    abbr: 'xAPI',
    definition: bi(
      'A learning-technology interoperability specification for communicating about learner activity and experiences between technologies.',
      'مواصفة للتشغيل البيني في تقنيات التعلّم، تُستخدم لتبادل المعلومات عن نشاط المتعلّمين وتجاربهم بين التقنيات المختلفة.',
    ),
    inKafaa: bi('Kafa\'a keeps learning experiences as xAPI 2.0 statements in its learning record store; My learning record lists the ones about you, with a download.', 'تحفظ كفاءة تجارب التعلّم في صورة بيانات xAPI 2.0 في مستودع سجلات التعلّم لديها، وتعرض صفحة سجل تعلّمي ما يخصك منها مع إمكانية التنزيل.'),
    where: to('my-learning-record'),
    sources: [SRC.xapi],
  },
];
