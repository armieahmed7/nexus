// FS17 + FS18 (future-skills wave C · E1, M19) seed: future-skill learning pathways and the curated, outcome-gated external catalogue.
// finalize(): (1) the four published admission criteria (relevance, provider standing, assessment, language); 11 external resources from real
//             providers (IAEA, World Nuclear University, OECD-NEA, UNITAR UN CC:Learn, University of Helsinki, DeepLearning.AI, Google,
//             The Open University, ENEN), each with its provider URL, a source and the date it was read (2026-10-10): 8 published, 1 retired
//             (a past edition), 2 drafts (one fails the criteria: security content stays out of Kafa'a); a pathway for every FS02 future
//             skill at L1 (L2 where the key level is 2 or more, L3 where it is 3), each with learn / practice / assess steps, a 3-6 month
//             envelope and a weekly hour cost, and pins to existing courses, gigs and credentials chosen by the training manager.
//             (2) FINALIZE_LAST (after every content builder and after fs02 adds the future skills): synthetic enrolments (completed, active, left) so colleagues' completion times
//             reach 10 on some pathways and stay suppressed on others; demo-persona progress; the FS57 gap backlog (steps that resolve to
//             nothing). Fails the build if any rule is broken (pathwayProblems, catalogueCheck, every future skill with an L1 pathway).
// Synthetic people only. Facts about external resources are copied from the provider pages named in `sources`; hours are the
// provider's own figure, or null with the provider's duration text.
import { catalogueCheck, envelopeWeeks, pathwayProblems, pathwaySkillOk, resolvePathway } from '../../../src/modules/m19/pathways.ts';

export const FINALIZE_LAST = true;
export const AS_OF = '2026-10-10';
const S = (id, label, url) => ({ id, label, url, accessed: AS_OF });
const ENTITLE = S('bm:ENTITLE', 'MOE Singapore · SkillsFuture Level-Up programme (outcome-gated support for mid-career learning)', 'https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling');
const LLE = S('bm:ENTITLE-uk', 'DfE · Lifelong Learning Entitlement overview', 'https://www.gov.uk/government/publications/lifelong-learning-entitlement-lle-overview/lifelong-learning-entitlement-overview');
const CORP = S('bm:CORP', 'Chief Learning Officer · AT&T: a fixed gaze toward the future (reskilling pathways)', 'https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/');
const LIGHTCAST = S('bm:LIGHTCAST', 'Lightcast · Open Skills taxonomy', 'https://lightcast.io/blog/open-skills-taxonomy');

// ───────────── FS18 criteria (published; the publish gate reads min_score and required)
const SCALE = (rows) => rows.map(([score, en, ar]) => ({ score, en, ar }));
export const CRITERIA = [
  { id: 'relevance', name_en: 'Relevance', name_ar: 'الصلة', question_en: 'Does it teach a Kafa\'a future skill at a stated level, in a way that applies to work at Barakah?', question_ar: 'هل يعلّم مهارة مستقبلية من مهارات كفاءة بمستوى محدد، وبطريقة تنطبق على العمل في براكة؟',
    scale: SCALE([[0, 'Not relevant, or outside Kafa\'a (for example security detail)', 'غير ذي صلة، أو خارج نطاق كفاءة (مثل تفاصيل الأمن)'], [1, 'Touches the skill in passing', 'يتناول المهارة عَرَضاً'], [2, 'Teaches the skill at the stated level', 'يعلّم المهارة بالمستوى المذكور'], [3, 'Teaches the skill with nuclear or energy examples', 'يعلّم المهارة بأمثلة من الطاقة النووية أو الطاقة']]),
    min_score: 2, required: true, sort: 1 },
  { id: 'standing', name_en: 'Provider standing', name_ar: 'مكانة الجهة المقدِّمة', question_en: 'Is the provider an intergovernmental body, an accredited university, a recognised professional body or an established industry body?', question_ar: 'هل الجهة المقدِّمة هيئة حكومية دولية أو جامعة معتمدة أو هيئة مهنية معترف بها أو جهة صناعية راسخة؟',
    scale: SCALE([[0, 'Unknown provider', 'جهة غير معروفة'], [1, 'Commercial provider without a track record', 'جهة تجارية بلا سجل معروف'], [2, 'Established company or professional body', 'شركة راسخة أو هيئة مهنية'], [3, 'Intergovernmental body or accredited university', 'هيئة حكومية دولية أو جامعة معتمدة']]),
    min_score: 2, required: true, sort: 2 },
  { id: 'assessment', name_en: 'Assessment', name_ar: 'التقييم', question_en: 'Does it end in an assessment or a verifiable output? (Shown to learners; not required to publish.)', question_ar: 'هل ينتهي بتقييم أو بمُخرج يمكن التحقق منه؟ (يُعرض للمتعلمين؛ وليس شرطاً للنشر.)',
    scale: SCALE([[0, 'No assessment', 'لا تقييم'], [1, 'Self-check only', 'تحقق ذاتي فقط'], [2, 'Graded quiz or certificate', 'اختبار مصحَّح أو شهادة'], [3, 'Assessed project or performance', 'مشروع أو أداء مقيَّم']]),
    min_score: 0, required: false, sort: 3 },
  { id: 'language', name_en: 'Language', name_ar: 'اللغة', question_en: 'Is it available in Arabic or English?', question_ar: 'هل هو متاح بالعربية أو الإنجليزية؟',
    scale: SCALE([[0, 'Neither Arabic nor English', 'لا عربية ولا إنجليزية'], [1, 'Other languages, translated summaries only', 'لغات أخرى مع ملخصات مترجمة فقط'], [2, 'English', 'الإنجليزية'], [3, 'Arabic available', 'متاح بالعربية']]),
    min_score: 2, required: true, sort: 4 },
].map((c) => ({ ...c, status: 'published', benchmark_ids: ['ENTITLE'], sources: [ENTITLE, LLE], as_of: AS_OF }));

// ───────────── FS18 external resources (real providers; read on 2026-10-10)
const X = (o) => ({
  duration_en: '', duration_ar: '', summary_en: '', summary_ar: '', criteria_note_en: '', criteria_note_ar: '', hours: null, has_assessment: false, version: 1,
  published_by: null, published_on: null, retired_reason: null, retired_on: null, created_by: 'p-training-mgr', updated_by: 'p-training-mgr', updated_at: `${AS_OF}T08:00:00Z`, as_of: AS_OF, ...o,
  listed: o.status === 'published',
});
export const EXTERNALS = [
  X({ id: 'xr-iaea-newcomers', sort: 1, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'E-learning for Nuclear Newcomers', title_ar: 'التعلم الإلكتروني للدول الجديدة في المجال النووي',
    provider_en: 'International Atomic Energy Agency (IAEA)', provider_ar: 'الوكالة الدولية للطاقة الذرية', provider_url: 'https://www.iaea.org', url: 'https://www.iaea.org/node/53487',
    format: 'elearning', hours: 20, duration_en: 'About 20 hours, self-paced (IAEA listing)', duration_ar: 'نحو 20 ساعة بالوتيرة الذاتية (وفق قائمة الوكالة)', cost_band: 'free', languages: ['en'],
    skills: [{ skill_id: 'sk-fs-adv-regulation', level: 1 }, { skill_id: 'sk-fs-tr-systems', level: 1 }],
    summary_en: 'Interactive IAEA modules on developing a safe, secure and sustainable nuclear power programme, built around the Milestones Approach and its 19 infrastructure issues. Free with an IAEA NUCLEUS account.',
    summary_ar: 'وحدات تفاعلية من الوكالة الدولية للطاقة الذرية حول تطوير برنامج قوى نووية آمن ومأمون ومستدام، مبنية على نهج المعالم وقضايا البنية الأساسية التسع عشرة. مجانية بحساب NUCLEUS لدى الوكالة.',
    criteria: { relevance: 3, standing: 3, assessment: 1, language: 2 }, sources: [S('iaea-newcomers', 'IAEA · E-learning for Nuclear Newcomers', 'https://www.iaea.org/node/53487')] }),
  X({ id: 'xr-wnu-summer-institute', sort: 2, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'World Nuclear University Summer Institute 2027', title_ar: 'المعهد الصيفي للجامعة النووية العالمية 2027',
    provider_en: 'World Nuclear University (World Nuclear Association)', provider_ar: 'الجامعة النووية العالمية (الرابطة النووية العالمية)', provider_url: 'https://world-nuclear.org', url: 'https://world-nuclear.org/events/wnu-summer-institute-2027',
    format: 'programme', hours: null, duration_en: 'Five weeks, residential: 30 May to 3 July 2027, Cape Town', duration_ar: 'خمسة أسابيع بالإقامة: من 30 مايو إلى 3 يوليو 2027، كيب تاون', cost_band: 'high', languages: ['en'],
    skills: [{ skill_id: 'sk-fs-tr-leadership', level: 2 }, { skill_id: 'sk-fs-tr-crosscultural', level: 2 }],
    summary_en: 'The WNU flagship five-week leadership and professional development programme for nuclear professionals with at least four years in the industry: lectures, mentored group work, industry projects and site visits.',
    summary_ar: 'البرنامج الرئيسي للجامعة النووية العالمية لتطوير القيادة والمهارات المهنية على مدى خمسة أسابيع للمهنيين النوويين ذوي الخبرة لا تقل عن أربع سنوات: محاضرات وعمل جماعي بإرشاد ومشاريع صناعية وزيارات ميدانية.',
    criteria: { relevance: 3, standing: 3, assessment: 1, language: 2 }, sources: [S('wnu-si-2027', 'World Nuclear Association · WNU Summer Institute 2027', 'https://world-nuclear.org/events/wnu-summer-institute-2027')] }),
  X({ id: 'xr-nea-nest', sort: 3, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'NEST Fellowship (Nuclear Education, Skills and Technology Framework)', title_ar: 'زمالة NEST (إطار التعليم والمهارات والتكنولوجيا النووية)',
    provider_en: 'OECD Nuclear Energy Agency (NEA)', provider_ar: 'وكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية', provider_url: 'https://www.oecd-nea.org', url: 'https://www.oecd-nea.org/jcms/pl_56329/building-the-vital-skills-for-the-future-of-nuclear-energy',
    format: 'fellowship', hours: null, duration_en: 'Fellowship inside a multinational NEST project; length set by the project', duration_ar: 'زمالة ضمن مشروع NEST متعدد الجنسيات؛ يحدد المشروع مدتها', cost_band: 'varies', languages: ['en'],
    skills: [{ skill_id: 'sk-fs-adv-smr', level: 2 }, { skill_id: 'sk-fs-tr-analytical', level: 2 }],
    summary_en: 'Young professionals and graduate students work inside real multinational projects (reactor safety, SMR design, decommissioning, radiological protection, waste management) under experts from at least three NEST countries.',
    summary_ar: 'يعمل المهنيون الشباب وطلاب الدراسات العليا ضمن مشاريع حقيقية متعددة الجنسيات (أمان المفاعلات، تصميم المفاعلات النمطية الصغيرة، الإخراج من الخدمة، الوقاية الإشعاعية، إدارة النفايات) بإشراف خبراء من ثلاث دول على الأقل من دول NEST.',
    criteria: { relevance: 3, standing: 3, assessment: 3, language: 2 }, criteria_note_en: 'Assessed through the project output reviewed by the NEST supervisors.', criteria_note_ar: 'يُقيَّم عبر مُخرج المشروع الذي يراجعه مشرفو NEST.',
    sources: [S('nea-nest', 'OECD-NEA · Building the vital skills for the future of nuclear energy (NEST)', 'https://www.oecd-nea.org/jcms/pl_56329/building-the-vital-skills-for-the-future-of-nuclear-energy'), S('nea-nest-5y', 'OECD-NEA · NEST Framework: five years of international co-operation', 'https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development')] }),
  X({ id: 'xr-nea-nextgen-2026', sort: 4, status: 'retired', published_by: 'p-training-mgr', published_on: '2026-05-04', retired_reason: 'The 2026 school took place on 13-17 July 2026 in Karlsruhe; the next edition is not yet announced.', retired_on: '2026-07-20',
    title_en: 'NEA NextGen Nuclear Leaders Summer School 2026', title_ar: 'المدرسة الصيفية لقادة الجيل القادم في المجال النووي 2026 (وكالة الطاقة النووية)',
    provider_en: 'OECD Nuclear Energy Agency (NEA)', provider_ar: 'وكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية', provider_url: 'https://www.oecd-nea.org', url: 'https://oecd-nea.org/upload/docs/application/pdf/2026-07/nextgen_nuclear_leaders_summer_school_2026_final_programme.pdf',
    format: 'programme', hours: null, duration_en: 'Five days: 13-17 July 2026, Karlsruhe', duration_ar: 'خمسة أيام: 13-17 يوليو 2026، كارلسروه', cost_band: 'varies', languages: ['en'],
    skills: [{ skill_id: 'sk-fs-tr-leadership', level: 2 }],
    summary_en: 'A one-week summer school for future nuclear leaders run under the NEA NEST framework.', summary_ar: 'مدرسة صيفية لمدة أسبوع لقادة المستقبل في المجال النووي ضمن إطار NEST التابع لوكالة الطاقة النووية.',
    criteria: { relevance: 3, standing: 3, assessment: 0, language: 2 }, sources: [S('nea-nextgen-2026', 'OECD-NEA · NextGen Nuclear Leaders Summer School 2026, final programme', 'https://oecd-nea.org/upload/docs/application/pdf/2026-07/nextgen_nuclear_leaders_summer_school_2026_final_programme.pdf')] }),
  X({ id: 'xr-elements-of-ai', sort: 5, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'Elements of AI', title_ar: 'أساسيات الذكاء الاصطناعي (Elements of AI)',
    provider_en: 'University of Helsinki and MinnaLearn', provider_ar: 'جامعة هلسنكي وMinnaLearn', provider_url: 'https://www.helsinki.fi', url: 'https://www.elementsofai.com',
    format: 'mooc', hours: 30, duration_en: 'About 30 hours of work, self-paced (University of Helsinki)', duration_ar: 'نحو 30 ساعة عمل بالوتيرة الذاتية (جامعة هلسنكي)', cost_band: 'free', languages: ['en'], has_assessment: true,
    skills: [{ skill_id: 'sk-fs-ai-use', level: 1 }, { skill_id: 'sk-fs-tr-techlit', level: 1 }],
    summary_en: 'A free introduction to what AI is, what it can and cannot do and how it is built, with exercises and a free certificate; no coding needed. Translated into many languages.',
    summary_ar: 'مدخل مجاني إلى ماهية الذكاء الاصطناعي وما يستطيعه وما لا يستطيعه وكيف يُبنى، مع تمارين وشهادة مجانية؛ دون حاجة إلى البرمجة. مترجم إلى لغات عديدة.',
    criteria: { relevance: 2, standing: 3, assessment: 2, language: 2 }, sources: [S('helsinki-eoai', 'University of Helsinki · Elements of AI has introduced one million people to the basics of AI', 'https://www.helsinki.fi/en/news/artificial-intelligence/elements-ai-has-introduced-one-million-people-basics-artificial-intelligence')] }),
  X({ id: 'xr-ai-for-everyone', sort: 6, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'AI For Everyone', title_ar: 'الذكاء الاصطناعي للجميع (AI For Everyone)',
    provider_en: 'DeepLearning.AI on Coursera', provider_ar: 'DeepLearning.AI عبر Coursera', provider_url: 'https://www.deeplearning.ai', url: 'https://www.coursera.org/learn/ai-for-everyone',
    format: 'mooc', hours: 6, duration_en: 'About 6 hours, four modules, self-paced (Coursera)', duration_ar: 'نحو 6 ساعات في أربع وحدات بالوتيرة الذاتية (Coursera)', cost_band: 'low', languages: ['en'], has_assessment: true,
    skills: [{ skill_id: 'sk-fs-ai-use', level: 1 }],
    summary_en: 'A non-technical course on what AI can realistically do, how AI projects work and how to work with AI in an organisation.', summary_ar: 'مقرر غير تقني عمّا يستطيع الذكاء الاصطناعي فعله واقعياً وكيف تسير مشاريعه وكيف نعمل معه داخل المؤسسة.',
    criteria: { relevance: 2, standing: 2, assessment: 2, language: 2 }, sources: [S('coursera-ai4e', 'Coursera · AI For Everyone (DeepLearning.AI)', 'https://www.coursera.org/learn/ai-for-everyone')] }),
  X({ id: 'xr-google-ai-essentials', sort: 7, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'Google AI Essentials', title_ar: 'أساسيات الذكاء الاصطناعي من Google',
    provider_en: 'Google on Coursera', provider_ar: 'Google عبر Coursera', provider_url: 'https://grow.google', url: 'https://grow.google/ai-essentials/',
    format: 'course', hours: 7, duration_en: '5 to 7 hours, self-paced (Google)', duration_ar: 'من 5 إلى 7 ساعات بالوتيرة الذاتية (Google)', cost_band: 'low', languages: ['en'], has_assessment: true,
    skills: [{ skill_id: 'sk-fs-ai-prompt', level: 1 }, { skill_id: 'sk-fs-ai-data-care', level: 1 }],
    summary_en: 'How to use generative AI tools at work: writing clear prompts, checking outputs and using AI responsibly. Ends with a certificate.', summary_ar: 'كيف تستخدم أدوات الذكاء الاصطناعي التوليدي في العمل: كتابة أوامر واضحة، والتحقق من المخرجات، والاستخدام المسؤول. ينتهي بشهادة.',
    criteria: { relevance: 2, standing: 2, assessment: 2, language: 2 }, criteria_note_en: 'Use only Kafa\'a-approved AI tools at work; the course examples use public tools.', criteria_note_ar: 'استخدم في العمل أدوات الذكاء الاصطناعي المعتمدة فقط؛ أمثلة المقرر تستخدم أدوات عامة.',
    sources: [S('google-aie', 'Google · Get started with Google AI Essentials', 'https://grow.google/ai-essentials/')] }),
  X({ id: 'xr-uncclearn-climate', sort: 8, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'Introductory e-Course on Climate Change', title_ar: 'المقرر الإلكتروني التمهيدي حول تغير المناخ',
    provider_en: 'UN CC:Learn (UNITAR)', provider_ar: 'منصة الأمم المتحدة للتعلم حول تغير المناخ (يونيتار)', provider_url: 'https://www.uncclearn.org', url: 'https://unccelearn.org',
    format: 'elearning', hours: 12, duration_en: 'Six modules of about 2 hours each, self-paced', duration_ar: 'ست وحدات مدة كل منها نحو ساعتين بالوتيرة الذاتية', cost_band: 'free', languages: ['ar', 'en', 'fr', 'es', 'pt', 'zh'], has_assessment: true,
    skills: [{ skill_id: 'sk-fs-gr-climaterisk', level: 1 }, { skill_id: 'sk-fs-gr-ghg', level: 1 }, { skill_id: 'sk-fs-tr-environment', level: 1 }],
    summary_en: 'Climate science, adaptation, mitigation, finance and negotiations in six modules; all six are needed for the certificate. Available in Arabic since 2018.',
    summary_ar: 'علم المناخ والتكيّف والتخفيف والتمويل والمفاوضات في ست وحدات؛ ويلزم إتمامها جميعاً للحصول على الشهادة. متاح بالعربية منذ 2018.',
    criteria: { relevance: 2, standing: 3, assessment: 2, language: 3 }, sources: [S('uncclearn-ar', 'UN CC:Learn · Introductory e-course on climate change now available in Arabic', 'https://www.uncclearn.org/news/introductory-e-course-on-climate-change-now-available-in-arabic/')] }),
  X({ id: 'xr-openlearn-systems', sort: 9, status: 'published', published_by: 'p-training-mgr', published_on: AS_OF,
    title_en: 'Mastering systems thinking in practice', title_ar: 'إتقان التفكير المنظومي في الممارسة',
    provider_en: 'The Open University (OpenLearn)', provider_ar: 'الجامعة المفتوحة (OpenLearn)', provider_url: 'https://www.open.edu/openlearn/', url: 'https://www.open.edu/openlearn/science-maths-technology/mastering-systems-thinking-practice',
    format: 'mooc', hours: 24, duration_en: 'Eight weeks of about three hours (OpenLearn)', duration_ar: 'ثمانية أسابيع بنحو ثلاث ساعات أسبوعياً (OpenLearn)', cost_band: 'free', languages: ['en'], has_assessment: true,
    skills: [{ skill_id: 'sk-fs-tr-systems', level: 2 }],
    summary_en: 'A free postgraduate-level course on systems thinking in practice; a digital badge for completing it and passing the quizzes.', summary_ar: 'مقرر مجاني بمستوى الدراسات العليا عن التفكير المنظومي في الممارسة؛ وشارة رقمية عند إتمامه واجتياز الاختبارات.',
    criteria: { relevance: 3, standing: 3, assessment: 2, language: 2 }, sources: [S('openlearn-stip', 'The Open University · OpenLearn: Mastering systems thinking in practice', 'https://www.open.edu/openlearn/science-maths-technology/mastering-systems-thinking-practice')] }),
  X({ id: 'xr-iaea-nuclear-security-elearning', sort: 10, status: 'draft',
    title_en: 'IAEA Nuclear Security e-Learning modules', title_ar: 'وحدات الوكالة الدولية للطاقة الذرية للتعلم الإلكتروني في الأمن النووي',
    provider_en: 'International Atomic Energy Agency (IAEA)', provider_ar: 'الوكالة الدولية للطاقة الذرية', provider_url: 'https://www.iaea.org', url: 'https://iaea.org/topics/security-of-nuclear-and-other-radioactive-material/nuclear-security-e-learning',
    format: 'elearning', hours: null, duration_en: '21 modules of one to four hours each (IAEA)', duration_ar: '21 وحدة مدة كل منها من ساعة إلى أربع ساعات (الوكالة)', cost_band: 'free', languages: ['en'],
    skills: [{ skill_id: 'sk-fs-cy-zones', level: 1 }],
    summary_en: 'Free IAEA modules on nuclear security. Proposed for the cyber hygiene pathway; not admitted.', summary_ar: 'وحدات مجانية من الوكالة عن الأمن النووي. اقتُرحت لمسار النظافة السيبرانية ولم تُقبل.',
    criteria: { relevance: 0, standing: 3, assessment: 1, language: 2 }, criteria_note_en: 'Security detail stays out of Kafa\'a: security roles appear at career-path level only and all-staff cyber hygiene is awareness content.',
    criteria_note_ar: 'تفاصيل الأمن خارج نطاق كفاءة: تظهر أدوار الأمن على مستوى المسار المهني فقط، والنظافة السيبرانية لجميع الموظفين محتوى توعوي.',
    sources: [S('iaea-nsec', 'IAEA · Nuclear security e-learning', 'https://iaea.org/topics/security-of-nuclear-and-other-radioactive-material/nuclear-security-e-learning')] }),
  X({ id: 'xr-enen2plus', sort: 11, status: 'draft',
    title_en: 'ENEN2plus education and mobility support', title_ar: 'دعم التعليم والتنقل ضمن مشروع ENEN2plus',
    provider_en: 'European Nuclear Education Network (ENEN), Euratom project', provider_ar: 'الشبكة الأوروبية للتعليم النووي (ENEN)، مشروع يوراتوم', provider_url: 'https://cordis.europa.eu', url: 'https://cordis.europa.eu/project/id/101061677',
    format: 'programme', hours: null, duration_en: 'Euratom project 2022 to 2026; calls set the length', duration_ar: 'مشروع يوراتوم من 2022 إلى 2026؛ تحدد الدعوات المدة', cost_band: 'varies', languages: ['en'],
    skills: [{ skill_id: 'sk-fs-adv-fuelcycle', level: 1 }],
    summary_en: 'A Euratom-funded project of the European nuclear education network that brings in new talent through education, training and mobility.', summary_ar: 'مشروع ممول من يوراتوم ضمن الشبكة الأوروبية للتعليم النووي لاستقطاب مواهب جديدة عبر التعليم والتدريب والتنقل.',
    criteria: { relevance: 2, standing: 3, assessment: 0, language: 2 }, criteria_note_en: 'Awaiting the training manager\'s review: check that calls are open to UAE participants.', criteria_note_ar: 'بانتظار مراجعة مدير التدريب: التحقق من أن الدعوات مفتوحة للمشاركين من الإمارات.',
    sources: [S('cordis-enen2plus', 'CORDIS · ENEN2plus project description', 'https://cordis.europa.eu/project/id/101061677')] }),
];

// ───────────── FS17 pathways
const LV = { 1: ['foundations', 'الأساسيات'], 2: ['practitioner', 'الممارسة'], 3: ['advanced practice', 'الممارسة المتقدمة'] };
const PLAN = { // envelope months, weekly hours, [learn, practice, assess] hours
  1: [3, 2, [8, 10, 2]], 2: [4, 3, [12, 24, 4]], 3: [6, 3, [16, 40, 6]], cy: [3, 0.5, [3, 2, 1]],
};
const PRACTICE = {
  transversal: ['Use it on a real piece of work with a colleague who gives feedback', 'طبّقها على عمل حقيقي مع زميل يقدّم لك الملاحظات'],
  ai_data: ['Use an approved tool on a real task and record how you checked the output', 'استخدم أداة معتمدة في مهمة حقيقية ودوّن كيف تحققت من المخرجات'],
  green_energy: ['Apply it to a real ENEC case and discuss it with the sustainability team', 'طبّقها على حالة حقيقية في إينك وناقشها مع فريق الاستدامة'],
  advanced_reactor: ['Work through a case study comparing it with APR1400 practice', 'اعمل على دراسة حالة تقارنها بممارسات APR1400'],
  cyber_hygiene: ['Practise the habit for two weeks and note what you changed', 'مارس العادة أسبوعين ودوّن ما غيّرته'],
  digital_plant: ['Apply it to a real work package or plant round with a mentor', 'طبّقها على حزمة عمل أو جولة حقيقية في المحطة مع مرشد'],
};
const LEARN_T = { 1: ['Learn the foundations', 'تعلّم الأساسيات'], 2: ['Deepen the method', 'عمّق المنهج'], 3: ['Study advanced cases', 'ادرس حالات متقدمة'] };
const ASSESS_T = { 1: ['Show what you can do (short check)', 'أظهر ما تستطيعه (تحقق قصير)'], 2: ['Show it at practitioner level', 'أظهرها بمستوى الممارسة'], 3: ['Show it on an assessed piece of work', 'أظهرها في عمل مقيَّم'] };
const OUTCOME = {
  1: ['You can explain the basics of {s} and apply them with guidance.', 'تستطيع شرح أساسيات {s} وتطبيقها بتوجيه.'],
  2: ['You apply {s} on your own in routine work and check your result.', 'تطبّق {s} بنفسك في العمل الاعتيادي وتتحقق من نتيجتك.'],
  3: ['You apply {s} in unfamiliar situations and help others do it.', 'تطبّق {s} في مواقف غير مألوفة وتساعد الآخرين على ذلك.'],
};
/** Pins chosen by the training manager: `${skill}:${level}:${kind}` -> refs (validated at build time: each must resolve). */
export const PINS = {
  'sk-fs-ai-use:1:learn': ['course:c-ai-gov'],
  'sk-fs-ai-verify:1:learn': ['course:c-ai-gov'], 'sk-fs-ai-verify:1:practice': ['opportunity:opp-governed-ai-pilot'],
  'sk-fs-ai-verify:2:practice': ['opportunity:opp-governed-ai-pilot'], 'sk-fs-ai-verify:2:assess': ['credential:mcd-mc-ai-lit-v1'],
  'sk-fs-ai-prompt:1:learn': ['course:c-ai-gov'], 'sk-fs-ai-data-care:1:learn': ['course:c-ai-gov'],
  'sk-fs-ai-plantdata:1:practice': ['opportunity:opp-outage-schedule-analytics'], 'sk-fs-ai-plantdata:1:assess': ['credential:mcd-mc-data-found-v1'],
  'sk-fs-ai-plantdata:2:practice': ['opportunity:opp-outage-schedule-analytics'], 'sk-fs-ai-plantdata:2:assess': ['credential:mcd-mc-data-analysis-v2'],
  'sk-fs-ai-twin:1:practice': ['opportunity:opp-digital-twin-study'], 'sk-fs-ai-twin:2:practice': ['opportunity:opp-digital-twin-study'],
  'sk-fs-ai-anomaly:1:practice': ['opportunity:opp-digital-twin-study'], 'sk-fs-ai-dataeng:1:practice': ['opportunity:opp-outage-schedule-analytics'],
  'sk-fs-adv-smr:2:learn': ['course:c-adv-smr'], 'sk-fs-adv-micro:2:learn': ['course:c-adv-smr'], 'sk-fs-adv-multimodule:2:learn': ['course:c-adv-smr'],
  'sk-fs-tr-analytical:1:practice': ['opportunity:opp-oe-review-2026-q4'], 'sk-fs-tr-analytical:1:assess': ['credential:mcd-mc-oe-review-v1'],
  'sk-fs-tr-analytical:2:practice': ['opportunity:opp-oe-review-2026-q4'], 'sk-fs-tr-curiosity:1:practice': ['opportunity:opp-oe-review-2026-q4'],
  'sk-fs-tr-systems:1:learn': ['course:c-one'],
  'sk-fs-tr-selfaware:1:learn': ['course:c-hu'], 'sk-fs-tr-dependable:1:learn': ['course:c-hu'], 'sk-fs-tr-dependable:1:assess': ['credential:mcd-mc-hu-prac-v1'],
  'sk-fs-tr-empathy:1:learn': ['course:c-crucial'], 'sk-fs-tr-empathy:1:practice': ['opportunity:opp-knowledge-capture-senior-ops'],
  'sk-fs-tr-crosscultural:1:learn': ['course:c-crucial'], 'sk-fs-tr-crosscultural:1:practice': ['opportunity:opp-stem-outreach-schools'],
  'sk-fs-tr-leadership:2:learn': ['course:c-intilaqa'], 'sk-fs-tr-leadership:2:practice': ['opportunity:opp-instructor-shadow-coct'], 'sk-fs-tr-leadership:3:learn': ['course:c-mcc'],
};
for (const s of ['sk-fs-adv-smr', 'sk-fs-adv-passive', 'sk-fs-adv-multimodule', 'sk-fs-adv-factoryqa', 'sk-fs-adv-fuelcycle', 'sk-fs-adv-fusion', 'sk-fs-adv-micro', 'sk-fs-adv-regulation']) PINS[`${s}:1:learn`] = ['course:c-adv-intro', ...(['sk-fs-adv-smr', 'sk-fs-adv-micro', 'sk-fs-adv-multimodule'].includes(s) ? ['course:c-adv-smr'] : [])];
for (const s of ['sk-fs-cy-phishing', 'sk-fs-cy-media', 'sk-fs-cy-zones', 'sk-fs-cy-access', 'sk-fs-cy-report']) PINS[`${s}:1:learn`] = ['course:c-sec-aw'];

export function pathwayRows(skills) {
  const pathways = [];
  const steps = [];
  const fs = skills.filter((s) => s.fs_area && pathwaySkillOk(s)).sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1));
  let sort = 0;
  for (const s of fs) {
    const levels = [1, ...(Number(s.key_level) >= 2 && s.lifecycle !== 'declining' ? [2] : []), ...(Number(s.key_level) >= 3 ? [3] : [])];
    for (const L of levels) {
      const [months, weekly, hours] = s.fs_area === 'cyber_hygiene' ? PLAN.cy : PLAN[L];
      const id = `pw-${s.id.replace(/^sk-fs-/, '')}-l${L}`;
      const fill = (t, lang) => t.replace('{s}', lang === 'ar' ? s.name_ar : s.name_en.toLowerCase());
      const declining = s.lifecycle === 'declining';
      pathways.push({
        id, skill_id: s.id, level: L, title_en: `${s.name_en}: ${LV[L][0]}`, title_ar: `${s.name_ar}: ${LV[L][1]}`,
        summary_en: declining ? `${s.level_essence_en} This skill is declining; the pathway helps you move to its digital successor.` : s.level_essence_en ?? '',
        summary_ar: declining ? `${s.level_essence_ar} هذه المهارة في تراجع؛ يساعدك المسار على الانتقال إلى بديلها الرقمي.` : s.level_essence_ar ?? '',
        outcome_en: fill(OUTCOME[L][0], 'en'), outcome_ar: fill(OUTCOME[L][1], 'ar'), envelope_months: months, weekly_hours: weekly, status: 'published', listed: true, version: 1,
        benchmark_ids: ['ENTITLE', 'CORP', 'LIGHTCAST'], sources: [ENTITLE, CORP, LIGHTCAST, ...(s.sources ?? []).slice(0, 1)], updated_by: 'p-training-mgr', updated_at: `${AS_OF}T08:00:00Z`, sort: ++sort,
      });
      const kinds = [['learn', LEARN_T[L]], ['practice', PRACTICE[s.fs_area] ?? PRACTICE.transversal], ['assess', ASSESS_T[L]]];
      kinds.forEach(([kind, [en, ar]], i) => steps.push({ id: `${id}:v1:s${i + 1}`, pathway_id: id, n: i + 1, kind, title_en: en, title_ar: ar, hours: hours[i], pins: PINS[`${s.id}:${L}:${kind}`] ?? [], auto: true, version: 1 }));
    }
  }
  // one draft (shown to training staff only): an L3 pathway for automation design still being written
  const auto = skills.find((s) => s.id === 'sk-fs-ai-automation');
  if (auto) {
    const id = 'pw-ai-automation-l3';
    pathways.push({ id, skill_id: auto.id, level: 3, title_en: `${auto.name_en}: ${LV[3][0]}`, title_ar: `${auto.name_ar}: ${LV[3][1]}`, summary_en: 'Draft: content still being commissioned.', summary_ar: 'مسودة: ما زال المحتوى قيد الإعداد.',
      outcome_en: OUTCOME[3][0].replace('{s}', auto.name_en.toLowerCase()), outcome_ar: OUTCOME[3][1].replace('{s}', auto.name_ar), envelope_months: 6, weekly_hours: 3, status: 'draft', listed: false, version: 1,
      benchmark_ids: ['ENTITLE', 'CORP', 'LIGHTCAST'], sources: [ENTITLE, CORP], updated_by: 'p-training-mgr', updated_at: `${AS_OF}T08:00:00Z`, sort: ++sort });
    [['learn', LEARN_T[3]], ['practice', PRACTICE.ai_data], ['assess', ASSESS_T[3]]].forEach(([kind, [en, ar]], i) => steps.push({ id: `${id}:v1:s${i + 1}`, pathway_id: id, n: i + 1, kind, title_en: en, title_ar: ar, hours: PLAN[3][2][i], pins: [], auto: true, version: 1 }));
  }
  return { pathways, steps };
}

export default function build() {}

function buildRows(T) {
  T.catalogue_criteria = CRITERIA.map((c) => ({ ...c }));
  T.external_resources = EXTERNALS.map((x) => ({ ...x }));
  T.pathway_enrolments = [];
  T.pathway_gaps = [];
  T.external_completions = [];
  const skills = T.skills;
  const { pathways, steps } = pathwayRows(skills);
  T.pathways = pathways;
  T.pathway_steps = steps;
  const problems = [];
  for (const p of pathways) {
    const ps = steps.filter((s) => s.pathway_id === p.id).map((s) => ({ ...s }));
    const pr = pathwayProblems({ ...p, steps: ps }, skills);
    if (pr.length) problems.push(`${p.id}: ${pr.join(',')}`);
    if (p.envelope_months < 3 || p.envelope_months > 6 || envelopeWeeks(p.envelope_months) * p.weekly_hours < ps.reduce((n, s) => n + s.hours, 0)) problems.push(`${p.id}: envelope`);
  }
  for (const x of EXTERNALS) {
    const c = catalogueCheck(x, CRITERIA, skills, AS_OF);
    if (c.problems.length) problems.push(`${x.id}: ${c.problems.join(',')}`);
    if (x.status === 'published' && !c.ok) problems.push(`${x.id}: published but fails ${c.failing.join(',')}`);
  }
  if (!EXTERNALS.some((x) => x.status === 'draft' && catalogueCheck(x, CRITERIA, skills, AS_OF).failing.length)) problems.push('no draft demonstrates the criteria gate');
  const fsSkills = skills.filter((s) => s.fs_area && pathwaySkillOk(s));
  for (const s of fsSkills) if (!pathways.some((p) => p.skill_id === s.id && p.level === 1 && p.status === 'published')) problems.push(`${s.id}: no L1 pathway`);
  if (problems.length) throw new Error(`fs17 seed: ${problems.slice(0, 8).join(' | ')}`);
}

// ───────────── finalize: enrolments and the gap backlog
let seedN = 1709;
const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** [pathway, completed, active, withdrawn] for the synthetic workforce; 10 or more completions make colleagues' times visible. */
export const ENROL_PLAN = [
  ['pw-ai-use-l1', 14, 3, 1], ['pw-cy-phishing-l1', 18, 2, 0], ['pw-ai-verify-l1', 11, 2, 0], ['pw-adv-smr-l1', 12, 4, 1], ['pw-adv-intro-l1', 0, 0, 0],
  ['pw-gr-climaterisk-l1', 6, 2, 0], ['pw-tr-systems-l2', 4, 3, 1], ['pw-ai-plantdata-l1', 9, 3, 0], ['pw-tr-empathy-l1', 10, 1, 0], ['pw-dp-rounds-l1', 2, 2, 0],
];

export function contentOf(T) {
  return { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs ?? [], fitness: T.fitness_areas ?? [] };
}

export function finalize(T) {
  buildRows(T); // the FS02 skills exist only after fs02's finalize
  seedN = 1709;
  const content = contentOf(T);
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && !p.persona_id).sort((a, b) => (a.id < b.id ? -1 : 1));
  const enrol = [];
  const used = new Set();
  for (const [pw, completed, active, withdrawn] of ENROL_PLAN) {
    const p = T.pathways.find((x) => x.id === pw);
    if (!p) continue;
    const pool = staff.filter((s) => !used.has(`${s.id}:${pw}`));
    let k = Math.floor(rand() * pool.length);
    const take = () => { const s = pool[k % pool.length]; k += 7; used.add(`${s.id}:${pw}`); return s; };
    for (let i = 0; i < completed; i++) {
      const s = take();
      const start = addDays('2025-11-03', Math.floor(rand() * 240));
      const weeks = Math.max(4, Math.round(envelopeWeeks(p.envelope_months) * (0.5 + rand() * 0.6)));
      const done = addDays(start, weeks * 7 - Math.floor(rand() * 5));
      enrol.push({ id: `pe:${s.id}:${pw}`, person_id: s.id, pathway_id: pw, status: 'completed', started_on: start, completed_on: done > '2026-10-08' ? '2026-10-06' : done, withdrawn_on: null, withdrawn_reason: null, steps_done: [], updated_at: `${done > '2026-10-08' ? '2026-10-06' : done}T16:00:00Z` });
    }
    for (let i = 0; i < active; i++) {
      const s = take();
      const start = addDays('2026-07-01', Math.floor(rand() * 90));
      enrol.push({ id: `pe:${s.id}:${pw}`, person_id: s.id, pathway_id: pw, status: 'active', started_on: start, completed_on: null, withdrawn_on: null, withdrawn_reason: null, steps_done: [], updated_at: `${start}T09:00:00Z` });
    }
    for (let i = 0; i < withdrawn; i++) {
      const s = take();
      const start = addDays('2026-03-02', Math.floor(rand() * 60));
      const off = addDays(start, 21 + Math.floor(rand() * 30));
      enrol.push({ id: `pe:${s.id}:${pw}`, person_id: s.id, pathway_id: pw, status: 'withdrawn', started_on: start, completed_on: null, withdrawn_on: off, withdrawn_reason: 'Outage season: I will restart after the outage.', steps_done: [], updated_at: `${off}T09:00:00Z` });
    }
  }
  // demo personas: one active pathway each where they do not yet hold the level, plus a completed one for the RO
  const holds = (pid, sk, L) => T.person_skills.some((x) => x.person_id === pid && x.skill_id === sk && x.active !== false && Number(x.level) >= L);
  const pick = (pid, prefs) => prefs.map((id) => T.pathways.find((p) => p.id === id)).find((p) => p && p.status === 'published' && !holds(pid, p.skill_id, p.level) && !enrol.some((e) => e.id === `pe:${pid}:${p.id}`));
  const DEMO = [['p-k-ro', ['pw-ai-verify-l1', 'pw-ai-verify-l2', 'pw-adv-smr-l1', 'pw-ai-plantdata-l1']], ['p-sro', ['pw-adv-passive-l1', 'pw-tr-leadership-l2', 'pw-ai-verify-l2']], ['p-k-lo-trainee', ['pw-cy-phishing-l1', 'pw-ai-use-l1']]];
  for (const [pid, prefs] of DEMO) {
    if (!T.people.some((p) => p.id === pid)) continue;
    const p = pick(pid, prefs);
    if (p) enrol.push({ id: `pe:${pid}:${p.id}`, person_id: pid, pathway_id: p.id, status: 'active', started_on: '2026-09-14', completed_on: null, withdrawn_on: null, withdrawn_reason: null, steps_done: [], updated_at: '2026-09-14T09:00:00Z' });
  }
  const roDone = pick('p-k-ro', ['pw-cy-phishing-l1', 'pw-cy-report-l1', 'pw-cy-media-l1']);
  if (roDone) enrol.push({ id: `pe:p-k-ro:${roDone.id}`, person_id: 'p-k-ro', pathway_id: roDone.id, status: 'completed', started_on: '2026-04-06', completed_on: '2026-06-22', withdrawn_on: null, withdrawn_reason: null, steps_done: [], updated_at: '2026-06-22T15:00:00Z' });
  T.pathway_enrolments = enrol.sort((a, b) => (a.id < b.id ? -1 : 1));

  // FS57 gap backlog: steps of published pathways that resolve to nothing
  const gaps = [];
  for (const p of T.pathways.filter((x) => x.status === 'published')) {
    for (const s of resolvePathway(p, T.pathway_steps, content).steps.filter((x) => x.status === 'requested')) {
      gaps.push({ id: `pg:${s.step_id}`, pathway_id: p.id, step_id: s.step_id, skill_id: p.skill_id, level: p.level, kind: s.kind, status: 'open', first_seen: AS_OF, last_checked: AS_OF, filled_on: null });
    }
  }
  T.pathway_gaps = gaps.sort((a, b) => (a.id < b.id ? -1 : 1));
  // every pin must resolve (a pin to a missing or closed item is a seed error)
  const bad = [];
  for (const s of T.pathway_steps) for (const ref of s.pins ?? []) {
    const p = T.pathways.find((x) => x.id === s.pathway_id);
    const r = resolvePathway(p, [s], content).steps[0];
    if (!r || !r.items.some((it) => `${it.type}:${it.id}` === ref)) bad.push(`${s.id} ${ref}`);
  }
  if (bad.length) throw new Error(`fs17 seed: pins that do not resolve: ${bad.slice(0, 6).join(', ')}`);
  const nRes = T.pathways.filter((p) => p.status === 'published').length;
  console.log(`fs17/18: ${nRes} published pathways (+${T.pathways.length - nRes} draft), ${T.pathway_steps.length} steps, ${gaps.length} requested steps in the gap backlog; ${T.pathway_enrolments.length} enrolments; ${T.external_resources.length} external resources (${T.external_resources.filter((x) => x.status === 'published').length} published)`);
}
