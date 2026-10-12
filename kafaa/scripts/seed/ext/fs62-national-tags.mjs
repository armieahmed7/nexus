// FS62 National-strategy alignment layer + FS63 MoHRE occupation and skill-level mapping (future-skills wave G · E2, M37).
// finalize() (FINALIZE_LAST; "fs62" sorts after fs41 (CleanEnergyComp), fs50 (critical skills register) and the catalogue, credential,
// pathway and leadership builders it links to, and before the fsqa* integration builders):
//   national_tags      the six national strategies the card names (National Employment Strategy 2031 with four goals, We the UAE 2031
//                      with its Forward Society and Forward Economy pillars, National AI Strategy 2031 with two goals, UAE Net Zero 2050,
//                      the four Jahiz groups, UAE Centennial 2071), EN and AR, each citing the most official source the research pack
//                      gives (tier computed by sourceTier); tags whose best source is secondary or indirect are flagged in the UI.
//   tag_links          curated links to skills, CleanEnergyComp competences, programmes, pathways, credentials, talent and leadership
//                      programmes and targets (FS50 register rows, the FS09/FS36 AI-fluency organisation target, FS41 family targets).
//                      Jahiz-group links (FS02 skills.future_group) and Net Zero competence links (FS41 net_zero) are derived from the data
//                      at read time and never stored.
//   role_occupations   the 28 current roles: an occupation label EN/AR and the indicative skill level from the education rule; every
//                      MoHRE code "pending review" (the research pack verifies no per-occupation code; settled decision). Concept roles get
//                      no row.
// External facts, dates and URLs come only from docs/kafaa/ref/research/national_systems.md (read 2026-10-10). Synthetic people only.
// The builder fails on any broken rule (tagProblem, linkProblem, occupationProblem, typed totals, sources).
import { effectiveLinks, linkProblem, sourceTier, tagProblem, tagSourceView, targetView, worldFrom } from '../../../src/modules/m37/national.ts';
import { indicativeLevel, occupationProblem } from '../../../src/modules/m37/occupations.ts';

export const FINALIZE_LAST = true;
export const AS_OF = '2026-10-10'; // research pack read on this date
const SEEDED_AT = '2026-10-11T08:00:00Z';
const BY = 'p-chco'; // HR director (CHCO office) role card
const S = (label, url, year = null) => ({ label, url, as_of: AS_OF, tier: sourceTier(url), year });
export const SRC = {
  nes: S('u.ae (UAE Government portal) · The National Employment Strategy 2031', 'https://u.ae/about-the-uae/strategies-initiatives-and-awards/strategies-plans-and-visions/human-resources-development-and-education/the-national-employment-strategy-2031'),
  nafis: S('WAM · Emiratisation agenda advances with leadership support, private sector partnership', 'https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership', 2026),
  andp: S('UN-ESCWA Arab National Development Planning portal · We the UAE 2031', 'https://andp.unescwa.org/plans/1491'),
  ghurair: S('Al Ghurair Foundation · UAE Skills (PDF)', 'https://www.alghurairfoundation.org/wp-content/uploads/2025/12/UAE-Skills-En-251210.pdf', 2025),
  dge: S('Abu Dhabi Department of Government Enablement · What we do', 'https://dge.gov.ae/en/what-we-do'),
  ktAi: S('Khaleej Times · Abu Dhabi to train government employees in AI by 2027', 'https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027', 2025),
  comms: S('Communicate Online · UAE embeds AI literacy into national strategy to boost workforce skills', 'https://communicateonline.me/news/uae-embeds-ai-literacy-into-national-strategy-to-boost-workforce-skills-coursera/', 2025),
  jahizWam: S('WAM · Jahiz, UAE\'s digital platform for upskilling all federal government talents with future skills', 'https://wam.ae/en/details/1395303102696', 2022),
  jahizUae: S('u.ae · Strategies for improving digital skills and eGovernment literacy', 'https://u.ae/en/information-and-services/jobs/training-and-development/Strategies-for-improving-digital-skills-and-eGovernment-literacy'),
  fahr: S('FAHR · A new partnership between the Authority and global platform Udacity', 'https://www.fahr.gov.ae/en/news/a-new-partnership-between-the-authority-and-global-platform-udacity/', 2024),
};

const tag = (id, strategy, kind, parent, code, name_en, name_ar, summary_en, summary_ar, sources, extra = {}) => ({
  id, strategy, kind, parent_id: parent, code, name_en, name_ar, summary_en, summary_ar, horizon_year: null, owner_en: null, owner_ar: null, sources,
  source_scope: 'direct', source_note_en: null, source_note_ar: null, derive: null, future_group: null, status: 'active', version: 1, benchmark_ids: [],
  created_by: BY, created_at: SEEDED_AT, updated_by: BY, updated_at: SEEDED_AT, ...extra,
});

export const TAGS = [
  // ── National Employment Strategy 2031
  tag('nt-nes-2031', 'nes_2031', 'strategy', null, 'NES-2031', 'National Employment Strategy 2031', 'الاستراتيجية الوطنية للتوظيف 2031',
    'Federal strategy adopted in 2018 to build labour-market skills, increase research and development personnel, expand lifelong learning and advance Emiratisation in sectors including artificial intelligence.',
    'استراتيجية اتحادية اعتُمدت في 2018 لبناء مهارات سوق العمل وزيادة الكوادر العاملة في البحث والتطوير والتوسع في التعلم مدى الحياة وتعزيز التوطين في قطاعات منها الذكاء الاصطناعي.',
    [SRC.nes], { horizon_year: 2031, sort: 1 }),
  tag('nt-nes-2031-skills', 'nes_2031', 'goal', 'nt-nes-2031', 'NES-SKILLS', 'Build labour-market skills', 'بناء مهارات سوق العمل',
    'The strategy goal of building the skills the labour market needs; at ENEC, the future-skills courses, academies and the critical skills register serve it.',
    'هدف الاستراتيجية في بناء المهارات التي يحتاجها سوق العمل؛ وفي المؤسسة تخدمه مقررات مهارات المستقبل والأكاديميات وسجل المهارات الحرجة.',
    [SRC.nes], { horizon_year: 2031, sort: 1 }),
  tag('nt-nes-2031-rnd', 'nes_2031', 'goal', 'nt-nes-2031', 'NES-RND', 'Increase research and development personnel', 'زيادة الكوادر العاملة في البحث والتطوير',
    'The strategy goal of growing research and development personnel; graduate study and scholarship routes into nuclear engineering serve it.',
    'هدف الاستراتيجية في زيادة الكوادر العاملة في البحث والتطوير؛ وتخدمه مسارات الدراسات العليا والمنح الدراسية في الهندسة النووية.',
    [SRC.nes], { horizon_year: 2031, sort: 2 }),
  tag('nt-nes-2031-lifelong', 'nes_2031', 'goal', 'nt-nes-2031', 'NES-LIFELONG', 'Expand lifelong learning', 'التوسع في التعلم مدى الحياة',
    'The strategy goal of expanding lifelong learning; learning pathways, stackable micro-credentials and the curiosity and lifelong learning skill serve it.',
    'هدف الاستراتيجية في التوسع في التعلم مدى الحياة؛ وتخدمه مسارات التعلم والشهادات المصغّرة القابلة للتجميع ومهارة الفضول والتعلم مدى الحياة.',
    [SRC.nes], { horizon_year: 2031, sort: 3 }),
  tag('nt-nes-2031-emiratisation', 'nes_2031', 'goal', 'nt-nes-2031', 'NES-EMIRATI', 'Emiratisation in priority sectors, including AI', 'التوطين في القطاعات ذات الأولوية بما فيها الذكاء الاصطناعي',
    'The strategy goal of Emiratisation; Nafis and the Emirati Talent Competitiveness Council carry it into the private sector. ENEC\'s Emirati talent programmes serve it.',
    'هدف الاستراتيجية في التوطين؛ ويحمله برنامج نافس ومجلس تنافسية الكوادر الإماراتية إلى القطاع الخاص، وتخدمه برامج المؤسسة للكفاءات الإماراتية.',
    [SRC.nes, SRC.nafis], { horizon_year: 2031, sort: 4, owner_en: 'Emirati Talent Competitiveness Council with MoHRE (Nafis)', owner_ar: 'مجلس تنافسية الكوادر الإماراتية مع وزارة الموارد البشرية والتوطين (نافس)', benchmark_ids: ['NAFIS'] }),
  // ── We the UAE 2031
  tag('nt-we-uae-2031', 'we_uae_2031', 'strategy', null, 'WE-UAE-2031', 'We the UAE 2031', 'نحن الإمارات 2031',
    'National vision with a Forward Society pillar (lifelong learning, skilled minds) and a Forward Economy pillar (attracting global talent), nested inside UAE Centennial 2071.',
    'رؤية وطنية تضم ركيزة مجتمع متقدّم (التعلم مدى الحياة والعقول الماهرة) وركيزة اقتصاد متقدّم (استقطاب المواهب العالمية)، ضمن مئوية الإمارات 2071.',
    [SRC.andp, SRC.ghurair], { horizon_year: 2031, sort: 2,
      source_note_en: 'The research pack cites this vision through the UN-ESCWA planning portal and a foundation paper, not a UAE government page, and found no skills target attributable to the vision itself. Re-check the official page before external reporting.',
      source_note_ar: 'يستشهد ملف البحث بهذه الرؤية عبر بوابة التخطيط التابعة للإسكوا وورقة صادرة عن مؤسسة، لا عبر صفحة حكومية إماراتية، ولم يجد هدفاً للمهارات منسوباً إلى الرؤية نفسها. يُرجى التحقق من الصفحة الرسمية قبل أي تقرير خارجي.' }),
  tag('nt-we-uae-2031-society', 'we_uae_2031', 'pillar', 'nt-we-uae-2031', 'WE-SOCIETY', 'Forward Society pillar', 'ركيزة مجتمع متقدّم',
    'The pillar on lifelong learning and skilled minds; ENEC\'s future-skills pack, AI Academy and systems-thinking credential serve it.',
    'الركيزة المعنية بالتعلم مدى الحياة والعقول الماهرة؛ وتخدمها حزمة مهارات المستقبل وأكاديمية الذكاء الاصطناعي وشهادة التفكير المنظومي.',
    [SRC.andp, SRC.ghurair], { horizon_year: 2031, sort: 1 , source_note_en: 'Cited, like the vision, through the UN-ESCWA planning portal and a foundation paper, not a UAE government page. Re-check before external reporting.', source_note_ar: 'يُستشهد بها، مثل الرؤية، عبر بوابة التخطيط التابعة للإسكوا وورقة صادرة عن مؤسسة، لا عبر صفحة حكومية إماراتية. يُرجى التحقق قبل أي تقرير خارجي.' }),
  tag('nt-we-uae-2031-economy', 'we_uae_2031', 'pillar', 'nt-we-uae-2031', 'WE-ECONOMY', 'Forward Economy pillar', 'ركيزة اقتصاد متقدّم',
    'The pillar on attracting global talent; international leadership exposure and graduate study in nuclear engineering serve it.',
    'الركيزة المعنية باستقطاب المواهب العالمية؛ ويخدمها الاحتكاك القيادي الدولي والدراسات العليا في الهندسة النووية.',
    [SRC.andp, SRC.ghurair], { horizon_year: 2031, sort: 2 , source_note_en: 'Cited, like the vision, through the UN-ESCWA planning portal and a foundation paper, not a UAE government page. Re-check before external reporting.', source_note_ar: 'يُستشهد بها، مثل الرؤية، عبر بوابة التخطيط التابعة للإسكوا وورقة صادرة عن مؤسسة، لا عبر صفحة حكومية إماراتية. يُرجى التحقق قبل أي تقرير خارجي.' }),
  // ── National AI Strategy 2031
  tag('nt-ai-2031', 'ai_2031', 'strategy', null, 'AI-2031', 'UAE National AI Strategy 2031', 'الاستراتيجية الوطنية للذكاء الاصطناعي 2031',
    'National policy that embeds AI literacy, alongside the UAE AI Charter, with free public AI courses and an AI curriculum in schools; in Abu Dhabi the Department of Government Enablement runs AiNative, practical AI-tools training for government employees.',
    'سياسة وطنية تُرسّخ الإلمام بالذكاء الاصطناعي إلى جانب ميثاق الإمارات للذكاء الاصطناعي، مع دورات عامة مجانية ومنهج للذكاء الاصطناعي في المدارس؛ وفي أبوظبي تدير دائرة التمكين الحكومي برنامج AiNative للتدريب العملي على أدوات الذكاء الاصطناعي لموظفي الحكومة.',
    [SRC.ktAi, SRC.dge, SRC.comms], { horizon_year: 2031, sort: 3, benchmark_ids: ['UAE-AI'],
      source_note_en: 'The research pack holds no page of the strategy itself: the official source is the Abu Dhabi DGE remit page, and the AiNative training target is shown from the benchmark registry, not typed here.',
      source_note_ar: 'لا يضم ملف البحث صفحة للاستراتيجية نفسها: المصدر الرسمي هو صفحة اختصاصات دائرة التمكين الحكومي في أبوظبي، ويُعرض هدف تدريب AiNative من سجل المعايير المرجعية لا مكتوباً هنا.' }),
  tag('nt-ai-2031-literacy', 'ai_2031', 'goal', 'nt-ai-2031', 'AI-LITERACY', 'AI literacy for the workforce', 'الإلمام بالذكاء الاصطناعي للقوى العاملة',
    'AI literacy embedded as national policy; ENEC\'s governed AI literacy, AI output verification and responsible data handling serve it.',
    'الإلمام بالذكاء الاصطناعي بوصفه سياسة وطنية؛ ويخدمه في المؤسسة الإلمام المحوكم بالذكاء الاصطناعي والتحقق من مخرجاته والتعامل المسؤول مع البيانات.',
    [SRC.dge, SRC.comms], { horizon_year: 2031, sort: 1, benchmark_ids: ['UAE-AI'] }),
  tag('nt-ai-2031-ainative', 'ai_2031', 'goal', 'nt-ai-2031', 'AI-AINATIVE', 'AiNative: practical AI tools at work', 'AiNative: أدوات الذكاء الاصطناعي العملية في العمل',
    'Abu Dhabi\'s practical AI-tools training across government; ENEC\'s AI Academy and automation design skill follow the same practical, governed approach.',
    'تدريب أبوظبي العملي على أدوات الذكاء الاصطناعي في الجهات الحكومية؛ وتتبع أكاديمية الذكاء الاصطناعي في المؤسسة ومهارة تصميم الأتمتة النهج العملي المحوكم ذاته.',
    [SRC.dge, SRC.ktAi], { horizon_year: 2027, sort: 2, owner_en: 'Abu Dhabi Department of Government Enablement (DGE)', owner_ar: 'دائرة التمكين الحكومي في أبوظبي', benchmark_ids: ['UAE-AI'] }),
  // ── UAE Net Zero 2050
  tag('nt-net-zero-2050', 'net_zero_2050', 'strategy', null, 'NET-ZERO-2050', 'UAE Net Zero 2050 strategic initiative', 'مبادرة الإمارات الاستراتيجية للحياد المناخي 2050',
    'The national net-zero goal. Kafa\'a links it to CleanEnergyComp, the sustainability competence framework, and to the New Economy group of the federal Jahiz platform, which covers net zero and climate change.',
    'الهدف الوطني للحياد المناخي. تربطه كفاءة بإطار كفاءات الطاقة النظيفة للاستدامة، وبمجموعة مهارات الاقتصاد الجديد في منصة جاهز الاتحادية التي تشمل الحياد المناخي وتغيّر المناخ.',
    [SRC.jahizWam], { horizon_year: 2050, sort: 4, source_scope: 'indirect', derive: 'cec_net_zero',
      source_note_en: 'Indirect source: the research pack cites net zero through the Jahiz New Economy group, not the strategy\'s own page. Re-check the government page before external reporting.',
      source_note_ar: 'مصدر غير مباشر: يستشهد ملف البحث بالحياد المناخي عبر مجموعة الاقتصاد الجديد في منصة جاهز، لا عبر صفحة المبادرة نفسها. يُرجى التحقق من الصفحة الحكومية قبل أي تقرير خارجي.' }),
  // ── Jahiz groups
  tag('nt-jahiz', 'jahiz', 'strategy', null, 'JAHIZ', 'Jahiz future-skills groups', 'مجموعات مهارات المستقبل في منصة جاهز',
    'Federal future-skills platform launched in November 2022 for all federal government employees, built with government entities and global companies; its skills sit in four groups and build a Future Skills Wallet linked to performance management.',
    'منصة اتحادية لمهارات المستقبل أُطلقت في نوفمبر 2022 لجميع موظفي الحكومة الاتحادية، بُنيت مع جهات حكومية وشركات عالمية؛ تتوزع مهاراتها على أربع مجموعات وتبني محفظة لمهارات المستقبل مرتبطة بإدارة الأداء.',
    [SRC.jahizWam, SRC.jahizUae, SRC.fahr], { sort: 5, owner_en: 'Government Development and the Future Office with FAHR', owner_ar: 'مكتب تطوير الحكومة والمستقبل مع الهيئة الاتحادية للموارد البشرية الحكومية', benchmark_ids: ['JAHIZ'] }),
  tag('nt-jahiz-digital', 'jahiz', 'group', 'nt-jahiz', 'JAHIZ-DIGITAL', 'Digital Skills', 'المهارات الرقمية',
    'Jahiz group for digital skills. Catalogue skills in this group are linked automatically from their Jahiz group in the skills catalogue.',
    'مجموعة جاهز للمهارات الرقمية. تُربط مهارات الدليل في هذه المجموعة تلقائياً من مجموعة جاهز المسجلة لها في دليل المهارات.',
    [SRC.jahizWam, SRC.jahizUae], { sort: 1, derive: 'future_group', future_group: 'digital', benchmark_ids: ['JAHIZ'] }),
  tag('nt-jahiz-10x', 'jahiz', 'group', 'nt-jahiz', 'JAHIZ-10X', '10X Skills', 'مهارات 10X',
    'Jahiz group for the human skills that multiply impact. Catalogue skills in this group are linked automatically from their Jahiz group.',
    'مجموعة جاهز للمهارات الإنسانية التي تضاعف الأثر. تُربط مهارات الدليل في هذه المجموعة تلقائياً من مجموعة جاهز المسجلة لها.',
    [SRC.jahizWam, SRC.jahizUae], { sort: 2, derive: 'future_group', future_group: 'ten_x', benchmark_ids: ['JAHIZ'] }),
  tag('nt-jahiz-data-ai', 'jahiz', 'group', 'nt-jahiz', 'JAHIZ-DATA-AI', 'Data & AI Skills', 'مهارات البيانات والذكاء الاصطناعي',
    'Jahiz group for data and artificial intelligence skills. Catalogue skills in this group are linked automatically from their Jahiz group.',
    'مجموعة جاهز لمهارات البيانات والذكاء الاصطناعي. تُربط مهارات الدليل في هذه المجموعة تلقائياً من مجموعة جاهز المسجلة لها.',
    [SRC.jahizWam, SRC.jahizUae], { sort: 3, derive: 'future_group', future_group: 'data_ai', benchmark_ids: ['JAHIZ'] }),
  tag('nt-jahiz-new-economy', 'jahiz', 'group', 'nt-jahiz', 'JAHIZ-NEW-ECONOMY', 'New Economy Skills', 'مهارات الاقتصاد الجديد',
    'Jahiz group covering net zero and climate change, circular economy and sustainability, the digital economy and new economy models. Catalogue skills in this group are linked automatically.',
    'مجموعة جاهز التي تشمل الحياد المناخي وتغيّر المناخ والاقتصاد الدائري والاستدامة والاقتصاد الرقمي ونماذج الاقتصاد الجديد. تُربط مهارات الدليل في هذه المجموعة تلقائياً.',
    [SRC.jahizWam, SRC.jahizUae], { sort: 4, derive: 'future_group', future_group: 'new_economy', benchmark_ids: ['JAHIZ'] }),
  // ── UAE Centennial 2071
  tag('nt-centennial-2071', 'centennial_2071', 'strategy', null, 'CENTENNIAL-2071', 'UAE Centennial 2071', 'مئوية الإمارات 2071',
    'The long-term national vision within which We the UAE 2031 sits. For a plant licensed to operate for decades it frames multi-generation workforce planning; advanced-reactor learning here is concept learning, with no deployment decision implied.',
    'الرؤية الوطنية بعيدة المدى التي تندرج ضمنها رؤية نحن الإمارات 2031. ولمحطة مرخّصة للتشغيل لعقود فهي إطار لتخطيط القوى العاملة عبر الأجيال؛ والتعلم عن المفاعلات المتقدمة هنا تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.',
    [SRC.andp, SRC.ghurair], { horizon_year: 2071, sort: 6,
      source_note_en: 'The research pack cites the Centennial through the UN-ESCWA planning portal and a foundation paper, not a UAE government page. Re-check the official page before external reporting.',
      source_note_ar: 'يستشهد ملف البحث بالمئوية عبر بوابة التخطيط التابعة للإسكوا وورقة صادرة عن مؤسسة، لا عبر صفحة حكومية إماراتية. يُرجى التحقق من الصفحة الرسمية قبل أي تقرير خارجي.' }),
];

// [tag, table, target id (microcred_defs: the credential code, resolved to its current version), note EN, note AR]
const LINKS = [
  ['nt-nes-2031-skills', 'programmes', 'pg-fs-pack', 'The future-skills course pack builds the skills the plant needs in the next decade.', 'تبني حزمة مقررات مهارات المستقبل المهارات التي تحتاجها المحطة في العقد المقبل.'],
  ['nt-nes-2031-skills', 'programmes', 'pg-acad-twin', 'The Digital Twin Bootcamp builds plant-data and validation skills.', 'يبني المعسكر التدريبي للتوائم الرقمية مهارات بيانات المحطة والتحقق.'],
  ['nt-nes-2031-skills', 'critical_skills', 'cs-sk-fs-ai-plantdata', 'Plant-data quality is a critical future skill on the register.', 'جودة بيانات المحطة مهارة مستقبلية حرجة في السجل.'],
  ['nt-nes-2031-skills', 'critical_skills', 'cs-sk-fs-dp-rounds', 'Digital operator rounds is a critical future skill on the register.', 'الجولات التشغيلية الرقمية مهارة مستقبلية حرجة في السجل.'],
  ['nt-nes-2031-skills', 'skills', 'sk-fs-dp-ework', 'Digital work management is a labour-market skill across industries.', 'إدارة العمل الرقمية مهارة مطلوبة في سوق العمل عبر القطاعات.'],
  ['nt-nes-2031-rnd', 'talent_programmes', 'ku-msc', 'Graduate study in nuclear engineering grows research capacity.', 'تنمّي الدراسات العليا في الهندسة النووية القدرات البحثية.'],
  ['nt-nes-2031-rnd', 'talent_programmes', 'energy-pioneers', 'Scholarships feed engineering and research careers.', 'تغذّي المنح الدراسية المسارات المهنية في الهندسة والبحث.'],
  ['nt-nes-2031-rnd', 'talent_programmes', 'internships', 'University internships connect students with plant engineering problems.', 'تربط التدريبات الجامعية الطلاب بمسائل هندسة المحطة.'],
  ['nt-nes-2031-lifelong', 'skills', 'sk-fs-tr-curiosity', 'Curiosity and lifelong learning is the skill this goal names.', 'الفضول والتعلم مدى الحياة هي المهارة التي يسمّيها هذا الهدف.'],
  ['nt-nes-2031-lifelong', 'pathways', 'pw-tr-curiosity-l1', 'A learning pathway that grows the habit of learning on the job.', 'مسار تعلم ينمّي عادة التعلم أثناء العمل.'],
  ['nt-nes-2031-lifelong', 'microcred_defs', 'MC-SYSTEMS', 'A stackable micro-credential that counts towards larger awards.', 'شهادة مصغّرة قابلة للتجميع تُحتسب ضمن شهادات أكبر.'],
  ['nt-nes-2031-lifelong', 'microcred_defs', 'MC-DATA-FOUND', 'A stackable micro-credential open to every employee.', 'شهادة مصغّرة قابلة للتجميع متاحة لكل موظف.'],
  ['nt-nes-2031-emiratisation', 'talent_programmes', 'dnt', 'The Diploma in Nuclear Technology prepares Emirati school leavers for plant roles.', 'يُعدّ دبلوم التكنولوجيا النووية خريجي الثانوية من المواطنين لأدوار في المحطة.'],
  ['nt-nes-2031-emiratisation', 'talent_programmes', 'mustaqbali', 'An early careers experience for Emirati school students.', 'تجربة مهنية مبكرة لطلاب المدارس من المواطنين.'],
  ['nt-nes-2031-emiratisation', 'talent_programmes', 'gdp', 'The Graduate Development Program brings Emirati graduates into the plant.', 'يستقطب برنامج تطوير الخريجين الخريجين المواطنين إلى المحطة.'],
  ['nt-nes-2031-emiratisation', 'talent_programmes', 'gpo', 'The Graduate Plant Operator route leads Emirati graduates towards licensed roles.', 'يقود مسار مشغّل المحطة من الخريجين الخريجين المواطنين نحو الأدوار المرخّصة.'],
  ['nt-nes-2031-emiratisation', 'leadership_programmes', 'prog-future-leaders', 'The Future Leaders track builds the next generation of nuclear managers.', 'يبني مسار قادة المستقبل الجيل القادم من المديرين في القطاع النووي.'],
  ['nt-we-uae-2031-society', 'programmes', 'pg-fs-pack', 'Lifelong learning for every employee through the future-skills pack.', 'التعلم مدى الحياة لكل موظف عبر حزمة مهارات المستقبل.'],
  ['nt-we-uae-2031-society', 'programmes', 'pg-acad-ai', 'The AI Academy builds skilled minds for an AI-augmented plant.', 'تبني أكاديمية الذكاء الاصطناعي عقولاً ماهرة لمحطة معزّزة بالذكاء الاصطناعي.'],
  ['nt-we-uae-2031-society', 'microcred_defs', 'MC-SYSTEMS', 'Systems thinking is a skilled-minds credential.', 'التفكير المنظومي شهادة للعقول الماهرة.'],
  ['nt-we-uae-2031-economy', 'leadership_programmes', 'prog-inpo', 'International leadership courses keep ENEC visible to global talent.', 'تُبقي دورات القيادة الدولية المؤسسة حاضرة أمام المواهب العالمية.'],
  ['nt-we-uae-2031-economy', 'talent_programmes', 'ku-msc', 'Graduate study that competes for global engineering talent.', 'دراسات عليا تتنافس على المواهب الهندسية العالمية.'],
  ['nt-ai-2031', 'ai_org_targets', 'aot-practitioner-2027', 'The organisation AI-fluency target is ENEC\'s dated contribution to the AI strategy.', 'هدف الطلاقة المؤسسية في الذكاء الاصطناعي هو إسهام المؤسسة المؤرخ في استراتيجية الذكاء الاصطناعي.'],
  ['nt-ai-2031', 'critical_skills', 'cs-sk-fs-ai-verify', 'AI output verification is a critical future skill on the register.', 'التحقق من مخرجات الذكاء الاصطناعي مهارة مستقبلية حرجة في السجل.'],
  ['nt-ai-2031-literacy', 'skills', 'sk-fs-ai-use', 'Everyday use of approved AI tools is the base of AI literacy.', 'الاستخدام اليومي لأدوات الذكاء الاصطناعي المعتمدة أساس الإلمام به.'],
  ['nt-ai-2031-literacy', 'skills', 'sk-fs-ai-verify', 'Checking AI output before anyone acts on it.', 'التحقق من مخرجات الذكاء الاصطناعي قبل أن يتصرف أحد بناءً عليها.'],
  ['nt-ai-2031-literacy', 'skills', 'sk-fs-ai-data-care', 'Responsible data handling is part of AI literacy.', 'التعامل المسؤول مع البيانات جزء من الإلمام بالذكاء الاصطناعي.'],
  ['nt-ai-2031-literacy', 'microcred_defs', 'MC-AI-LIT', 'The governed AI literacy credential.', 'شهادة الإلمام المحوكم بالذكاء الاصطناعي.'],
  ['nt-ai-2031-literacy', 'pathways', 'pw-ai-use-l1', 'A pathway to confident everyday use of approved AI tools.', 'مسار نحو الاستخدام اليومي الواثق لأدوات الذكاء الاصطناعي المعتمدة.'],
  ['nt-ai-2031-ainative', 'programmes', 'pg-acad-ai', 'Practical, governed AI tools training in the approved sandbox.', 'تدريب عملي محوكم على أدوات الذكاء الاصطناعي في البيئة التجريبية المعتمدة.'],
  ['nt-ai-2031-ainative', 'skills', 'sk-fs-ai-automation', 'Designing small, governed automations for real work.', 'تصميم أتمتة صغيرة ومحوكمة لعمل حقيقي.'],
  ['nt-ai-2031-ainative', 'microcred_defs', 'MC-AI-ASSURER', 'The AI assurer credential for people who check AI-assisted work.', 'شهادة ضامن الذكاء الاصطناعي لمن يتحققون من العمل المدعوم به.'],
  ['nt-net-zero-2050', 'skills', 'sk-fs-gr-ghg', 'GHG accounting is the measurement skill behind any net-zero claim.', 'محاسبة غازات الاحتباس الحراري هي مهارة القياس وراء أي ادعاء بالحياد المناخي.'],
  ['nt-net-zero-2050', 'skills', 'sk-fs-gr-climaterisk', 'Climate risk awareness for the plant and its users.', 'الوعي بالمخاطر المناخية على المحطة ومستخدميها.'],
  ['nt-net-zero-2050', 'skills', 'sk-fs-gr-lifecycle', 'Lifecycle carbon assessment of plant activities.', 'تقييم الكربون على امتداد دورة الحياة لأنشطة المحطة.'],
  ['nt-net-zero-2050', 'pathways', 'pw-et-esg-managers', 'ESG and GHG literacy for managers.', 'الإلمام بالحوكمة البيئية والاجتماعية ومحاسبة الانبعاثات للمديرين.'],
  ['nt-net-zero-2050', 'pathways', 'pw-et-system-integration', 'Energy-system integration: concept learning, no deployment decision implied.', 'تكامل منظومة الطاقة: تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.'],
  ['nt-net-zero-2050', 'programmes', 'pg-acad-energy', 'The Energy Transition cohort.', 'دفعة تحوّل الطاقة.'],
  ['nt-net-zero-2050', 'microcred_defs', 'MC-CLEAN-ENERGY', 'The clean energy systems credential.', 'شهادة منظومات الطاقة النظيفة.'],
  ['nt-net-zero-2050', 'critical_skills', 'cs-sk-fs-gr-ghg', 'GHG accounting is a critical future skill on the register.', 'محاسبة غازات الاحتباس الحراري مهارة مستقبلية حرجة في السجل.'],
  ['nt-net-zero-2050', 'cec_role_targets', 'cect:operations', 'The CleanEnergyComp target for operations staff.', 'هدف كفاءات الطاقة النظيفة لموظفي العمليات.'],
  ['nt-net-zero-2050', 'cec_role_targets', 'cect:engineering', 'The CleanEnergyComp target for engineering staff.', 'هدف كفاءات الطاقة النظيفة لموظفي الهندسة.'],
  ['nt-net-zero-2050', 'cec_role_targets', 'cect:corporate', 'The CleanEnergyComp target for corporate staff.', 'هدف كفاءات الطاقة النظيفة لموظفي الخدمات المؤسسية.'],
  ['nt-jahiz-digital', 'microcred_defs', 'MC-DIGITAL-PLANT', 'Digital plant foundations, the plant-specific route into the digital group.', 'أساسيات المحطة الرقمية، المسار الخاص بالمحطة إلى المجموعة الرقمية.'],
  ['nt-jahiz-data-ai', 'programmes', 'pg-acad-ai', 'The AI Academy grows data and AI skills.', 'تنمّي أكاديمية الذكاء الاصطناعي مهارات البيانات والذكاء الاصطناعي.'],
  ['nt-jahiz-new-economy', 'microcred_defs', 'MC-CLEAN-ENERGY', 'Clean energy systems, ENEC\'s route into the new economy group.', 'منظومات الطاقة النظيفة، مسار المؤسسة إلى مجموعة الاقتصاد الجديد.'],
  ['nt-centennial-2071', 'programmes', 'adv-fundamentals', 'Advanced reactor fundamentals: concept learning, no deployment decision implied.', 'أساسيات المفاعلات المتقدمة: تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.'],
  ['nt-centennial-2071', 'programmes', 'pg-acad-smr', 'The SMR Fundamentals cohort: concept learning, no deployment decision implied.', 'دفعة أساسيات المفاعلات المعيارية الصغيرة: تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.'],
  ['nt-centennial-2071', 'microcred_defs', 'MC-SMR-FOUND', 'SMR foundations credential: concept learning, no deployment decision implied.', 'شهادة أساسيات المفاعلات المعيارية الصغيرة: تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.'],
  ['nt-centennial-2071', 'skills', 'sk-fs-adv-smr', 'SMR fundamentals for the multi-generation workforce, no deployment decision implied.', 'أساسيات المفاعلات المعيارية الصغيرة لقوى عاملة عبر الأجيال، ولا يُفهم منها أي قرار بالنشر.'],
  ['nt-centennial-2071', 'leadership_programmes', 'prog-future-leaders', 'Leaders who will run the plant in the decades ahead.', 'قادة سيديرون المحطة في العقود المقبلة.'],
  ['nt-centennial-2071', 'critical_skills', 'cs-sk-pf-02-advcool', 'A critical skill for the plant\'s long operating life.', 'مهارة حرجة لعمر التشغيل الطويل للمحطة.'],
];

// FS63: occupation labels for the 28 current roles (Kafa'a's proposed labels; MoHRE codes pending review)
const OCCUPATIONS = {
  'senior-reactor-operator': ['Nuclear reactor operator, senior (unit supervisor)', 'مشغّل مفاعل نووي أول (مشرف وحدة)'],
  'shift-supervisor': ['Nuclear power plant shift manager', 'مدير وردية في محطة للطاقة النووية'],
  'reactor-operator': ['Nuclear reactor operator', 'مشغّل مفاعل نووي'],
  'local-operator': ['Power plant field operator', 'مشغّل ميداني في محطة طاقة'],
  'shift-technical-advisor': ['Nuclear shift technical advisor (engineer)', 'مستشار فني للوردية النووية (مهندس)'],
  'operations-support-work-control': ['Plant work control and clearance coordinator', 'منسّق التحكم في الأعمال والعزل في المحطة'],
  'outage-manager-planner': ['Maintenance outage planner and scheduler', 'مخطط ومجدول فترات إيقاف الصيانة'],
  'maintenance-technician-engineer': ['Mechanical, electrical and instrumentation maintenance technician', 'فني صيانة ميكانيكية وكهربائية وأجهزة قياس'],
  'systems-design-plant-engineer': ['Power plant systems engineer', 'مهندس أنظمة محطات الطاقة'],
  'reactor-engineer-core-physicist': ['Nuclear reactor engineer (core physics)', 'مهندس مفاعل نووي (فيزياء القلب)'],
  'nuclear-fuel-specialist': ['Nuclear fuel handling specialist', 'أخصائي مناولة الوقود النووي'],
  'cyber-security-engineer': ['Cyber security engineer', 'مهندس أمن سيبراني'],
  'radiation-protection-technician': ['Radiation protection technician', 'فني وقاية من الإشعاع'],
  'chemistry-technician': ['Plant chemistry technician', 'فني كيمياء المحطة'],
  'environmental-monitoring-specialist': ['Environmental monitoring specialist', 'أخصائي الرصد البيئي'],
  'quality-assurance-qc': ['Quality assurance and inspection specialist', 'أخصائي ضمان الجودة والفحص'],
  'nuclear-oversight-npi': ['Nuclear oversight and performance improvement specialist', 'أخصائي الرقابة النووية وتحسين الأداء'],
  'regulatory-affairs-licensing-engineer': ['Regulatory affairs and licensing engineer', 'مهندس الشؤون التنظيمية والترخيص'],
  'human-performance-specialist': ['Human performance and safety culture specialist', 'أخصائي الأداء البشري وثقافة السلامة'],
  'ecp-officer': ['Employee concerns officer', 'مسؤول مخاوف الموظفين'],
  'industrial-health-safety-officer': ['Occupational health and safety officer', 'مسؤول الصحة والسلامة المهنية'],
  'fire-protection': ['Fire protection technician', 'فني الحماية من الحرائق'],
  'emergency-preparedness-coordinator': ['Emergency preparedness coordinator', 'منسّق التأهب للطوارئ'],
  'security-officer': ['Security officer', 'ضابط أمن'],
  'safeguards-specialist': ['Nuclear safeguards specialist', 'أخصائي الضمانات النووية'],
  'nuclear-training-instructor': ['Nuclear training instructor', 'مدرّب في التدريب النووي'],
  'procurement-engineer': ['Procurement and supply chain engineer', 'مهندس مشتريات وسلسلة إمداد'],
  'corporate-professional': ['Corporate services professional', 'مختص في الخدمات المؤسسية'],
};

export default function build() {}

export function finalize(T) {
  const today = '2026-10-11';
  T.national_tags = TAGS;
  const defByCode = (code) => (T.microcred_defs ?? []).find((d) => d.code === code && d.status === 'current');
  T.tag_links = LINKS.map(([tagId, table, ref, en, ar]) => {
    const id = table === 'microcred_defs' ? defByCode(ref)?.id : ref;
    if (!id) throw new Error(`fs62: no current credential ${ref}`);
    return { id: `tl:${tagId}:${table}:${id}`, tag_id: tagId, target_table: table, target_id: id, note_en: en, note_ar: ar, active: true, created_by: BY, created_at: SEEDED_AT, updated_by: BY, updated_at: SEEDED_AT };
  });
  const rows = T.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
  T.role_occupations = rows.map((r) => {
    const lab = OCCUPATIONS[r.id];
    if (!lab) throw new Error(`fs62: no occupation label for ${r.id}`);
    const level = indicativeLevel(r.education);
    return {
      id: `ro-${r.id}`, role_id: r.id, label_en: lab[0], label_ar: lab[1], mohre_code: null, code_status: 'pending_review', code_source: null, verified_by: null, verified_on: null,
      skill_level: level, level_basis: 'education_rule', education_basis: r.education ?? null, rationale_en: null, rationale_ar: null,
      history: [{ version: 1, on: today, by: BY, change: 'save', label_en: lab[0], skill_level: level, level_basis: 'education_rule' }], version: 1, updated_by: BY, updated_at: SEEDED_AT,
    };
  });

  // ── checks (fail the build)
  for (const t of T.national_tags) {
    const p = tagProblem(t, { tags: T.national_tags, today });
    if (p) throw new Error(`fs62: tag ${t.id}: ${p}`);
    if (!tagSourceView(t.sources, t.source_scope)) throw new Error(`fs62: tag ${t.id} has no source`);
  }
  const w = worldFrom((n) => T[n] ?? []);
  for (const l of T.tag_links) {
    const v = targetView(w, l.target_table, l.target_id);
    const p = linkProblem(l, T.national_tags.find((t) => t.id === l.tag_id), { exists: v.exists, area: v.area });
    if (p || !v.active) throw new Error(`fs62: link ${l.id}: ${p ?? 'target not active'}`);
  }
  if (T.role_occupations.length !== 28) throw new Error(`fs62: expected 28 current roles, got ${T.role_occupations.length}`);
  for (const o of T.role_occupations) { const p = occupationProblem(o, T.job_roles.find((r) => r.id === o.role_id)); if (p) throw new Error(`fs62: occupation ${o.id}: ${p}`); }
  const eff = effectiveLinks(w);
  const flagged = T.national_tags.filter((t) => tagSourceView(t.sources, t.source_scope).flagged).length;
  console.log(`fs62: ${T.national_tags.length} national tags (${flagged} flagged: secondary or indirect source), ${T.tag_links.length} curated links, ${eff.length} effective links (${eff.filter((l) => l.basis !== 'curated').length} derived from data); fs63: ${T.role_occupations.length} role occupations, codes pending review`);
}
