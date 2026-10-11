// FS41 CleanEnergyComp + FS42 Energy-system integration pathway + FS43 ESG and GHG literacy for managers (future-skills wave E · E2, M32).
// finalize() (FINALIZE_LAST; "fs41" sorts after fs02 (FS02 skills), fs17 (pathways, external catalogue), fs19 (course pack), fs21 (adaptive
// banks, performance tasks), fs27 (gigs) and fs31 (credentials), and before the fsqa* integration builders):
//   M32 rows   12 CleanEnergyComp competences in the four GreenComp-method areas (outcomes EN/AR, FS02 skills, learning items, sources),
//              20 family targets, 3 value-chain explainers (hydrogen, process heat, grid) with sourced facts, 2 learning tracks.
//   M19 rows   (data-only coupling, logged in CONTRACT): 2 published FS17 pathways (pw-et-system-integration, pw-et-esg-managers) with
//              their steps, and 5 published FS18 external readings (OECD-NEA Plan 2035, IEA World Energy Employment 2025, IRENA/ILO
//              Renewable Energy and Jobs 2025, ISO 30414:2025, JRC GreenComp). Readings use the format "reading" without an assessment,
//              so FS17 discovery never picks them up: they appear only where a step pins them (no other pathway changes).
//   M04 rows   2 short manager electives (c-et-ghg-mgr, c-et-esg-clinic; no skill objectives, so no discovery and no F01 evidence keys).
//   FS30       credit tags for the new courses and pathways come from fs29's ensureCreditTags, run by fsqa4 after this builder.
// Every step of the two pathways resolves with content that existed before the wave-C QA replay (fsqa3 contentBefore) and after it, so the
// FS17 gap backlog (215 rows; open = requested steps) is unchanged. The builder fails on any broken rule (CleanEnergyComp framework and
// targets, pathwayProblems, catalogueCheck, value-chain checks, FS43 under 10 hours, the credential route, publicTextIsClean).
// External facts, dates and URLs come only from docs/kafaa/ref/research/*.md (read 2026-10-10). Synthetic people only; no person rows.
import { frameworkProblems, targetProblems } from '../../../src/modules/m32/cec.ts';
import { chainProblems, credentialRoute, quickRoute, trackHours, trackProblems, FS43_HOUR_CAP } from '../../../src/modules/m32/transition.ts';
import { catalogueCheck, resolvePathway } from '../../../src/modules/m19/pathways.ts';
import { contentBefore } from './fsqa3-integration.mjs';

export const FINALIZE_LAST = true;
export const AS_OF = '2026-10-10'; // research packs read on this date
export const SEEDED_AT = '2026-10-11T08:00:00Z';
const S = (id, label, url, as_of = AS_OF) => ({ id, label, url, as_of });
export const SRC = {
  greencomp: S('fs41-greencomp', 'European Commission JRC · GreenComp, the European sustainability competence framework (2022)', 'https://joint-research-centre.ec.europa.eu/greencomp'),
  greencompPdf: S('fs41-greencomp-pdf', 'European Commission · GreenComp (JRC128040, EUR 30955 EN), PDF', 'https://wikis.ec.europa.eu/download/attachments/80183613/GreenComp.pdf'),
  jahiz: S('fs41-jahiz', 'WAM · Jahiz, the UAE platform upskilling federal government talent with future skills (Nov 2022)', 'https://wam.ae/en/details/1395303102696'),
  wef: S('fs41-wef-foj', 'World Economic Forum · Future of Jobs Report 2025, skills outlook', 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/'),
  nea: S('fs42-nea-plan2035', 'OECD-NEA · Plan 2035 vision paper: Scaling Technology, Growing Careers, Securing the Future (Oct 2025)', 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf'),
  iea: S('fs42-iea-wee', 'NucNet · IEA World Energy Employment 2025: jobs growth in nuclear (Dec 2025)', 'https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025'),
  irena: S('fs42-irena-jobs', 'EU BUILD UP · IRENA and ILO, Renewable Energy and Jobs: Annual Review 2025', 'https://build-up.ec.europa.eu/en/resources-and-tools/publications/annual-review-2025-renewable-energy-and-jobs'),
  iso: S('fs43-iso30414', 'ISO TC 260 · ISO 30414:2025, strengthening human capital reporting (24 Aug 2025)', 'https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html'),
};

// ───────────── FS41 CleanEnergyComp: 12 competences in four areas (GreenComp method)
const L = (kind, ref) => ({ kind, ref });
const O = (en, ar) => ({ en, ar });
const C = (n, area, a) => ({ id: `cec-${n.replace('.', '-')}`, code: `CEC-${n}`, area, ...a });
export const COMPETENCES = [
  C('1.1', 'values', {
    name_en: 'Public trust and transparency', name_ar: 'الثقة العامة والشفافية',
    summary_en: "Explains nuclear energy's place in a low-carbon energy system honestly, with the evidence and its limits, so people can judge for themselves.",
    summary_ar: 'يشرح مكانة الطاقة النووية في منظومة طاقة منخفضة الكربون بأمانة، بالأدلة وحدودها، ليحكم الناس بأنفسهم.',
    plant_en: 'At a nuclear plant this means answering questions about emissions, safety and waste with sourced facts, never with slogans.',
    plant_ar: 'في المحطة النووية يعني ذلك الإجابة عن أسئلة الانبعاثات والسلامة والنفايات بحقائق موثّقة المصدر، لا بالشعارات.',
    outcomes: [
      O('Explain in plain language why nuclear electricity is low-carbon over its lifecycle, and where the evidence comes from.', 'يشرح بلغة بسيطة لماذا تُعدّ الكهرباء النووية منخفضة الكربون على امتداد دورة حياتها، ومن أين تأتي الأدلة.'),
      O('Answer a difficult public question about safety or waste with sourced facts, and say what is not known.', 'يجيب عن سؤال عام صعب حول السلامة أو النفايات بحقائق موثّقة المصدر، ويذكر ما لا يزال غير معروف.'),
      O('Recognise when a claim about clean energy goes beyond the evidence, and correct it respectfully.', 'يتعرّف على الادعاء الذي يتجاوز الأدلة بشأن الطاقة النظيفة ويصححه باحترام.'),
    ],
    skill_ids: ['sk-fs-gr-esg', 'sk-fs-tr-empathy', 'sk-sc-01'],
    learning: [L('pathway', 'pw-gr-esg-l1'), L('external', 'xr-et-greencomp'), L('course', 'c-fs-ghg')],
  }),
  C('1.2', 'values', {
    name_en: 'Stewardship of people and the environment', name_ar: 'رعاية الناس والبيئة',
    summary_en: 'Treats protecting people and the environment as part of the job, from radiation protection to effluent monitoring.',
    summary_ar: 'يعدّ حماية الناس والبيئة جزءاً من العمل، من الوقاية من الإشعاع إلى رصد المخلفات السائلة والغازية.',
    plant_en: 'Radiation protection, chemistry and environmental monitoring teams already live this every day; everyone else learns why it matters.',
    plant_ar: 'تعيش فرق الوقاية من الإشعاع والكيمياء والرصد البيئي هذه الكفاءة يومياً؛ ويتعلّم الآخرون سبب أهميتها.',
    outcomes: [
      O('Describe how radiation protection and effluent monitoring protect people and the environment around a plant.', 'يصف كيف تحمي الوقاية من الإشعاع ورصد المخلفات الناس والبيئة حول المحطة.'),
      O('Apply ALARA thinking to an everyday task and explain the trade-offs.', 'يطبّق مبدأ "أدنى مستوى يمكن بلوغه عملياً" على مهمة يومية ويشرح الموازنات.'),
      O('Report an environmental concern through the right channel without delay.', 'يبلّغ عن أي مخاوف بيئية عبر القناة الصحيحة دون تأخير.'),
    ],
    skill_ids: ['sk-fs-tr-environment', 'sk-rp-02', 'sk-ch-02', 'sk-sc-02'],
    learning: [L('pathway', 'pw-tr-environment-l1'), L('external', 'xr-uncclearn-climate')],
  }),
  C('1.3', 'values', {
    name_en: 'Fairness across generations', name_ar: 'العدالة بين الأجيال',
    summary_en: "Weighs today's decisions against the people who will run, use and inherit the plant over its long life.",
    summary_ar: 'يوازن قرارات اليوم مع مصلحة من سيشغّلون المحطة ويستفيدون منها ويرثونها على امتداد عمرها الطويل.',
    plant_en: 'A nuclear plant runs for decades: fuel, waste and knowledge decisions made now are inherited by the next generation of staff.',
    plant_ar: 'تعمل المحطة النووية لعقود: قرارات الوقود والنفايات والمعرفة المتخذة اليوم يرثها الجيل القادم من العاملين.',
    outcomes: [
      O('Explain why decisions on fuel, waste and knowledge affect people decades from now.', 'يشرح لماذا تؤثّر قرارات الوقود والنفايات والمعرفة في أناس بعد عقود.'),
      O('Pass on what you know so that the next generation can operate safely.', 'ينقل ما يعرفه ليتمكّن الجيل القادم من التشغيل بأمان.'),
      O('Take account of future users when choosing between short-term and long-term options.', 'يراعي المستخدمين في المستقبل عند الاختيار بين الخيارات قصيرة الأجل وطويلة الأجل.'),
    ],
    skill_ids: ['sk-fs-gr-circular', 'sk-fs-tr-crosscultural', 'sk-ld-01-coach'],
    learning: [L('pathway', 'pw-gr-circular-l1'), L('lane', 'lane-netzero')],
  }),
  C('2.1', 'complexity', {
    name_en: 'Systems thinking under uncertainty', name_ar: 'التفكير المنظومي في ظل عدم اليقين',
    summary_en: 'Sees the energy system, the plant and its people as connected parts, and reasons about effects that are delayed, shared or uncertain.',
    summary_ar: 'يرى منظومة الطاقة والمحطة والعاملين فيها أجزاءً مترابطة، ويستدل على الآثار المتأخرة أو المشتركة أو غير المؤكدة.',
    plant_en: 'Defence in depth is a systems idea: the same habit of mind helps when thinking about energy security and the wider grid.',
    plant_ar: 'الدفاع في العمق فكرة منظومية: والعادة الذهنية نفسها تساعد عند التفكير في أمن الطاقة والشبكة الأوسع.',
    outcomes: [
      O('Map how a change in one part of the energy system affects others, including feedback and delays.', 'يرسم كيف يؤثّر تغيير في جزء من منظومة الطاقة في الأجزاء الأخرى، بما في ذلك التغذية الراجعة والتأخير.'),
      O('Explain defence in depth as a systems idea and relate it to energy security.', 'يشرح الدفاع في العمق بوصفه فكرة منظومية ويربطه بأمن الطاقة.'),
      O('State the uncertainty in a forecast or plan and what would change your view.', 'يحدّد عدم اليقين في توقّع أو خطة وما الذي قد يغيّر رأيه.'),
    ],
    skill_ids: ['sk-fs-tr-systems', 'sk-ns-01', 'sk-ld-02-decide'],
    learning: [L('course', 'c-fs-systems'), L('external', 'xr-openlearn-systems'), L('pathway', 'pw-tr-systems-l1')],
  }),
  C('2.2', 'complexity', {
    name_en: 'Lifecycle carbon thinking', name_ar: 'التفكير في الكربون على امتداد دورة الحياة',
    summary_en: 'Counts emissions across the whole life of a plant or activity, from construction and fuel to operation and decommissioning.',
    summary_ar: 'يحسب الانبعاثات على امتداد عمر المحطة أو النشاط كاملاً، من الإنشاء والوقود إلى التشغيل والإيقاف النهائي.',
    plant_en: 'Lifecycle thinking lets a team compare options honestly, including the emissions of maintenance, travel and purchased goods.',
    plant_ar: 'يتيح التفكير في دورة الحياة للفريق مقارنة الخيارات بأمانة، بما في ذلك انبعاثات الصيانة والسفر والسلع المشتراة.',
    outcomes: [
      O('Classify emissions by scope and explain an emissions-avoided figure.', 'يصنّف الانبعاثات حسب النطاق ويشرح رقم الانبعاثات التي تم تجنّبها.'),
      O('Outline a lifecycle carbon assessment for a plant activity.', 'يضع مخططاً لتقييم الكربون على امتداد دورة الحياة لنشاط في المحطة.'),
      O('Explain why lifecycle numbers differ between studies and which assumptions drive them.', 'يشرح لماذا تختلف أرقام دورة الحياة بين الدراسات وما الافتراضات التي تحرّكها.'),
    ],
    skill_ids: ['sk-fs-gr-lifecycle', 'sk-fs-gr-ghg'],
    learning: [L('course', 'c-fs-ghg'), L('adaptive', 'ab-clean-energy'), L('task', 'pt-ghg-log'), L('credential', 'MC-CLEAN-ENERGY')],
  }),
  C('2.3', 'complexity', {
    name_en: 'Critical use of evidence and data', name_ar: 'الاستخدام النقدي للأدلة والبيانات',
    summary_en: 'Checks the quality of data and claims before using them in a sustainability decision or report.',
    summary_ar: 'يتحقق من جودة البيانات والادعاءات قبل استخدامها في قرار أو تقرير يخص الاستدامة.',
    plant_en: 'The same discipline that keeps plant data trustworthy keeps sustainability figures trustworthy: source, scope, date.',
    plant_ar: 'الانضباط نفسه الذي يحفظ موثوقية بيانات المحطة يحفظ موثوقية أرقام الاستدامة: المصدر والنطاق والتاريخ.',
    outcomes: [
      O('Test a sustainability figure for its source, scope and date before repeating it.', 'يختبر رقماً يخص الاستدامة من حيث مصدره ونطاقه وتاريخه قبل تكراره.'),
      O('Spot gaps and double counting in an emissions or resource data set.', 'يكتشف الثغرات والعدّ المزدوج في مجموعة بيانات للانبعاثات أو الموارد.'),
      O('Present a conclusion with its evidence and its limits.', 'يعرض استنتاجاً مع أدلته وحدوده.'),
    ],
    skill_ids: ['sk-fs-tr-analytical', 'sk-fs-ai-plantdata', 'sk-da-01-analysis'],
    learning: [L('task', 'pt-ghg-log'), L('course', 'c-et-ghg-mgr'), L('pathway', 'pw-et-esg-managers')],
  }),
  C('3.1', 'futures', {
    name_en: 'Net-zero pathways literacy', name_ar: 'الإلمام بمسارات الحياد الصفري',
    summary_en: 'Understands how countries and industries plan to reach net zero, and the part low-carbon electricity plays.',
    summary_ar: 'يفهم كيف تخطط الدول والصناعات لبلوغ الحياد الصفري، والدور الذي تؤديه الكهرباء منخفضة الكربون.',
    plant_en: 'Linked to the UAE Net Zero 2050 strategic initiative and to the New Economy group of the federal Jahiz future-skills platform.',
    plant_ar: 'مرتبطة بالمبادرة الاستراتيجية للحياد المناخي 2050 في الإمارات، وبمجموعة مهارات الاقتصاد الجديد في منصة "جاهز" الاتحادية لمهارات المستقبل.',
    outcomes: [
      O('Describe the main levers of a net-zero pathway: clean power, efficiency, electrification and low-carbon fuels.', 'يصف الروافع الرئيسية لمسار الحياد الصفري: الطاقة النظيفة والكفاءة والكهربة والوقود منخفض الكربون.'),
      O('Explain climate risk to the plant and its users in simple terms.', 'يشرح المخاطر المناخية على المحطة ومستخدميها بعبارات بسيطة.'),
      O('Relate the national net-zero goal to your own work and your team.', 'يربط الهدف الوطني للحياد الصفري بعمله وبفريقه.'),
    ],
    skill_ids: ['sk-fs-gr-climaterisk', 'sk-fs-gr-ghg'],
    learning: [L('external', 'xr-uncclearn-climate'), L('lane', 'lane-netzero'), L('pathway', 'pw-gr-climaterisk-l1')],
  }),
  C('3.2', 'futures', {
    name_en: 'The role of nuclear in an integrated energy system', name_ar: 'دور الطاقة النووية في منظومة طاقة متكاملة',
    summary_en: 'Explains how nuclear power and heat could work with renewables, storage, hydrogen and industry. Concept learning; no deployment decision implied.',
    summary_ar: 'يشرح كيف يمكن للكهرباء والحرارة النوويتين العمل مع الطاقة المتجددة والتخزين والهيدروجين والصناعة. تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.',
    plant_en: 'Steady low-carbon output complements variable renewables; heat and power could also serve hydrogen and industrial users.',
    plant_ar: 'يكمّل الإنتاج الثابت منخفض الكربون الطاقة المتجددة المتغيرة؛ ويمكن للحرارة والكهرباء أيضاً خدمة مستخدمي الهيدروجين والصناعة.',
    outcomes: [
      O('Explain how steady nuclear output complements variable renewables on the grid.', 'يشرح كيف يكمّل الإنتاج النووي الثابت الطاقة المتجددة المتغيرة على الشبكة.'),
      O('Describe how nuclear heat and electricity could serve hydrogen and industrial users, and where the safety boundary sits.', 'يصف كيف يمكن للحرارة والكهرباء النوويتين خدمة مستخدمي الهيدروجين والصناعة، وأين تقع حدود السلامة.'),
      O('Compare the hydrogen, process-heat and grid value chains and the skills each needs.', 'يقارن سلاسل القيمة للهيدروجين والحرارة الصناعية والشبكة والمهارات التي تحتاجها كل منها.'),
    ],
    skill_ids: ['sk-fs-gr-h2heat', 'sk-fs-gr-grid', 'sk-pf-02', 'sk-pf-03-elec'],
    learning: [L('chain', 'vc-hydrogen'), L('pathway', 'pw-et-system-integration'), L('course', 'c-fs-h2heat'), L('academy', 'ac-energy')],
  }),
  C('3.3', 'futures', {
    name_en: 'Exploring new technologies with an open mind', name_ar: 'استكشاف التقنيات الجديدة بعقل منفتح',
    summary_en: 'Approaches advanced reactors and other new energy technologies with curiosity and sound judgement, separating what is known from what is promoted.',
    summary_ar: 'يتعامل مع المفاعلات المتقدمة وتقنيات الطاقة الجديدة الأخرى بفضول وحكم سليم، فيفصل بين ما هو معروف وما يُروَّج له.',
    plant_en: 'Advanced reactor families are evaluated as concepts; curiosity and evidence keep that learning honest.',
    plant_ar: 'تُقيَّم عائلات المفاعلات المتقدمة بوصفها مفاهيم؛ ويحافظ الفضول والأدلة على أمانة هذا التعلّم.',
    outcomes: [
      O('Describe the main advanced reactor families and what changes for the people who run them.', 'يصف العائلات الرئيسية للمفاعلات المتقدمة وما يتغيّر لمن يشغّلونها.'),
      O('Separate evidence from promotion in claims about a new energy technology.', 'يفصل بين الأدلة والترويج في الادعاءات المتعلقة بتقنية طاقة جديدة.'),
      O('Adapt how you work when a new technology or method arrives.', 'يكيّف طريقة عمله عند ظهور تقنية أو أسلوب جديد.'),
    ],
    skill_ids: ['sk-fs-adv-smr', 'sk-fs-tr-curiosity', 'sk-fs-tr-resilience'],
    learning: [L('course', 'c-adv-intro'), L('adaptive', 'ab-smr'), L('lane', 'lane-advanced')],
  }),
  C('4.1', 'acting', {
    name_en: 'Waste stewardship', name_ar: 'رعاية النفايات',
    summary_en: 'Minimises, tracks and safely manages waste and effluents, from daily work to the back end of the fuel cycle.',
    summary_ar: 'يقلّل النفايات والمخلفات ويتتبعها ويديرها بأمان، من العمل اليومي إلى المرحلة الختامية من دورة الوقود.',
    plant_en: 'Every work package can create less radioactive and conventional waste when it is planned with the waste hierarchy in mind.',
    plant_ar: 'يمكن لكل حزمة عمل أن تُنتج نفايات مشعة وتقليدية أقل عندما تُخطَّط مع مراعاة هرم إدارة النفايات.',
    outcomes: [
      O('Explain the waste hierarchy and how it applies to plant work.', 'يشرح هرم إدارة النفايات وكيف ينطبق على العمل في المحطة.'),
      O('Plan a task so that it creates less radioactive and conventional waste.', 'يخطط لمهمة بحيث تُنتج نفايات مشعة وتقليدية أقل.'),
      O('Describe, as a concept, how spent fuel and radioactive waste are kept safe over the long term.', 'يصف، بوصفه مفهوماً، كيف يُحافَظ على سلامة الوقود المستهلك والنفايات المشعة على المدى الطويل.'),
    ],
    skill_ids: ['sk-fs-gr-circular', 'sk-ch-02', 'sk-rp-02-survey'],
    learning: [L('opportunity', 'fg-kc-waste-minimisation'), L('pathway', 'pw-gr-circular-l1')],
  }),
  C('4.2', 'acting', {
    name_en: 'Circularity and resource efficiency', name_ar: 'الاقتصاد الدائري وكفاءة الموارد',
    summary_en: 'Keeps equipment, materials and data in use for longer, and buys with the whole life in mind.',
    summary_ar: 'يُبقي المعدات والمواد والبيانات قيد الاستخدام مدة أطول، ويشتري مع مراعاة دورة الحياة كاملة.',
    plant_en: 'Maintenance, engineering and supply chain decide together when to repair, refurbish or replace.',
    plant_ar: 'تقرر الصيانة والهندسة وسلسلة الإمداد معاً متى يكون الإصلاح أو التجديد أو الاستبدال.',
    outcomes: [
      O('Identify where repair, refurbishment or reuse can replace replacement in maintenance work.', 'يحدّد أين يمكن للإصلاح أو التجديد أو إعادة الاستخدام أن يحلّ محل الاستبدال في أعمال الصيانة.'),
      O('Include lifecycle and end-of-life questions when specifying or buying equipment.', 'يضمّن أسئلة دورة الحياة ونهاية العمر عند تحديد مواصفات المعدات أو شرائها.'),
      O('Use condition data to extend the useful life of a component safely.', 'يستخدم بيانات الحالة لإطالة العمر النافع لمكوّن بأمان.'),
    ],
    skill_ids: ['sk-fs-gr-circular', 'sk-fs-dp-procurement', 'sk-en-02'],
    learning: [L('pathway', 'pw-gr-circular-l2'), L('opportunity', 'fg-kc-waste-minimisation')],
  }),
  C('4.3', 'acting', {
    name_en: 'Advocacy with evidence', name_ar: 'المناصرة بالأدلة',
    summary_en: 'Speaks up for sustainable choices inside and outside the organisation, always with evidence and respect for other views.',
    summary_ar: 'يدافع عن الخيارات المستدامة داخل المؤسسة وخارجها، دائماً بالأدلة ومع احترام الآراء الأخرى.',
    plant_en: 'Managers and communicators carry this most: they turn data into a fair account of progress, including what went less well.',
    plant_ar: 'يحمل المديرون والمختصون بالتواصل هذه الكفاءة أكثر من غيرهم: يحوّلون البيانات إلى عرض منصف للتقدم، بما في ذلك ما لم يسر على ما يرام.',
    outcomes: [
      O('Make a short, sourced case for a sustainability improvement in your team.', 'يقدّم حجة قصيرة موثّقة المصدر لتحسين يخص الاستدامة في فريقه.'),
      O('Disclose sustainability information clearly, including what went less well.', 'يفصح عن معلومات الاستدامة بوضوح، بما في ذلك ما لم يسر على ما يرام.'),
      O('Lead or join a team effort that measurably reduces the use of a resource.', 'يقود جهداً جماعياً أو يشارك فيه يقلّل استخدام أحد الموارد بشكل قابل للقياس.'),
    ],
    skill_ids: ['sk-fs-gr-esg', 'sk-fs-tr-leadership', 'sk-ld-01'],
    learning: [L('pathway', 'pw-et-esg-managers'), L('course', 'c-et-esg-clinic'), L('credential', 'MC-CLEAN-ENERGY')],
  }),
];
const GREENCOMP_AREA = { values: 'embodying_sustainability_values', complexity: 'embracing_complexity_in_sustainability', futures: 'envisioning_sustainable_futures', acting: 'acting_for_sustainability' };

// ───────────── FS41 family targets (1 Aware, 2 Practitioner, 3 Advocate)
const TG = (family_id, level, focus, en, ar) => ({ id: `cect:${family_id}`, family_id, level, focus_ids: focus.map((x) => `cec-${x.replace('.', '-')}`), rationale_en: en, rationale_ar: ar });
export const TARGETS = [
  TG('operations', 1, ['1.2', '2.1'], 'Operators steward people and the environment every shift and think in systems; awareness level across all four areas.', 'يرعى المشغّلون الناس والبيئة في كل وردية ويفكرون بطريقة منظومية؛ مستوى الوعي في المجالات الأربعة.'),
  TG('maintenance', 1, ['4.2', '4.1'], 'Maintenance decides daily between repair and replacement and creates most work-package waste.', 'تقرر الصيانة يومياً بين الإصلاح والاستبدال، وتُنتج معظم نفايات حزم العمل.'),
  TG('engineering', 2, ['3.2', '2.2', '4.2'], 'Engineers assess lifecycle impacts and would carry the technical work on any energy-system interface.', 'يقيّم المهندسون آثار دورة الحياة، وسيحملون العمل الفني لأي واجهة مع منظومة الطاقة.'),
  TG('radiation-protection', 2, ['1.2', '4.1'], 'Radiation protection leads stewardship of people and the environment and the control of radioactive waste.', 'تقود الوقاية من الإشعاع رعاية الناس والبيئة وضبط النفايات المشعة.'),
  TG('chemistry', 2, ['4.1', '1.2'], 'Chemistry monitors effluents and manages chemical and radioactive waste streams.', 'تراقب الكيمياء المخلفات وتدير مسارات النفايات الكيميائية والمشعة.'),
  TG('nuclear-fuel', 2, ['1.3', '4.1'], 'Fuel decisions shape the back end of the fuel cycle for decades.', 'تشكّل قرارات الوقود المرحلة الختامية من دورة الوقود لعقود.'),
  TG('outage', 1, ['4.2', '4.1'], 'Outages concentrate maintenance waste and buying decisions in a few weeks.', 'تتركّز في فترات الانقطاع نفايات الصيانة وقرارات الشراء خلال أسابيع قليلة.'),
  TG('emergency-preparedness', 1, ['3.1', '2.1'], 'Emergency planning needs a clear view of climate risk and of how systems fail together.', 'يحتاج التخطيط للطوارئ إلى رؤية واضحة للمخاطر المناخية ولكيفية تعطّل الأنظمة معاً.'),
  TG('security', 1, ['1.1'], 'Awareness level only; the role is shown at career-path level and sustainability content stays general.', 'مستوى الوعي فقط؛ يُعرض الدور على مستوى المسار المهني ويبقى محتوى الاستدامة عاماً.'),
  TG('cyber', 1, ['2.3'], 'Awareness level; the data discipline behind trustworthy figures is the most relevant competence.', 'مستوى الوعي؛ والانضباط في البيانات الذي يقف خلف الأرقام الموثوقة هو الكفاءة الأوثق صلة.'),
  TG('safeguards', 1, ['1.3'], 'Awareness level; fairness across generations matches the long view of safeguards work.', 'مستوى الوعي؛ وتتوافق العدالة بين الأجيال مع النظرة البعيدة لعمل الضمانات.'),
  TG('quality', 1, ['2.3', '4.3'], 'Quality staff check data and claims and help disclose them accurately.', 'يتحقق موظفو الجودة من البيانات والادعاءات ويساعدون في الإفصاح عنها بدقة.'),
  TG('oversight', 1, ['2.1', '2.3'], 'Oversight challenges assumptions and evidence across the organisation.', 'تتحدى الرقابة الافتراضات والأدلة على مستوى المؤسسة.'),
  TG('licensing', 1, ['1.1', '2.1'], 'Licensing explains the plant to external audiences with evidence and its limits.', 'يشرح الترخيص المحطة للجهات الخارجية بالأدلة وحدودها.'),
  TG('training', 1, ['1.3', '4.3'], 'Trainers pass knowledge to the next generation and model evidence-based advocacy.', 'ينقل المدربون المعرفة إلى الجيل القادم ويقدّمون نموذجاً للمناصرة القائمة على الأدلة.'),
  TG('health-safety', 1, ['1.2', '3.1'], 'Health and safety connects stewardship of people with climate risk such as heat stress.', 'تربط الصحة والسلامة رعاية الناس بالمخاطر المناخية مثل الإجهاد الحراري.'),
  TG('environment', 3, ['2.2', '1.2', '4.1'], 'The environment team leads the framework and advises others on lifecycle carbon, stewardship and waste.', 'يقود فريق البيئة الإطار وينصح الآخرين في الكربون على امتداد دورة الحياة والرعاية والنفايات.'),
  TG('supply-chain', 2, ['4.2', '2.2'], 'Supply chain buys with the whole life in mind and owns much of the purchased-goods footprint.', 'تشتري سلسلة الإمداد مع مراعاة دورة الحياة كاملة، وتملك جزءاً كبيراً من بصمة السلع المشتراة.'),
  TG('fire-protection', 1, ['1.2'], 'Fire protection protects people and the environment from fire and its run-off.', 'تحمي الوقاية من الحرائق الناس والبيئة من الحرائق ومخلفاتها.'),
  TG('corporate', 2, ['1.1', '4.3', '3.1'], 'Communications, sustainability and reporting teams explain and disclose progress, so they need practitioner level.', 'تشرح فرق التواصل والاستدامة وإعداد التقارير التقدّم وتفصح عنه، لذا تحتاج إلى مستوى الممارس.'),
];

// ───────────── FS42 value chains (concept explainers; facts from the research packs only)
const F = (id, src, en, ar, published, secondary) => ({ id, en, ar, label: src.label, url: src.url, as_of: src.as_of, published, secondary });
const ST = (key, en, ar, role_en, role_ar) => ({ key, en, ar, role_en, role_ar });
export const CHAINS = [
  {
    id: 'vc-hydrogen', code: 'VC-1', name_en: 'Hydrogen', name_ar: 'الهيدروجين', sort: 1,
    summary_en: 'Clean electricity, and for some designs heat, can split water into hydrogen for industrial users. This explainer covers the chain and its skills only; no ENEC project or site is implied.',
    summary_ar: 'يمكن للكهرباء النظيفة، وللحرارة في بعض التصاميم، فصل الماء لإنتاج الهيدروجين للمستخدمين الصناعيين. يغطي هذا الشرح السلسلة ومهاراتها فقط، ولا يُفهم منه أي مشروع أو موقع للمؤسسة.',
    stages: [
      ST('source', 'Low-carbon electricity and heat', 'كهرباء وحرارة منخفضتا الكربون', 'A nuclear plant supplies steady low-carbon electricity; some reactor designs could also supply high-temperature heat.', 'توفر المحطة النووية كهرباء ثابتة منخفضة الكربون؛ ويمكن لبعض تصاميم المفاعلات أيضاً توفير حرارة عالية.'),
      ST('conversion', 'Electrolysis', 'التحليل الكهربائي', 'Electrolysers split water into hydrogen and oxygen; high-temperature electrolysis uses heat to need less electricity.', 'تفصل أجهزة التحليل الكهربائي الماء إلى هيدروجين وأكسجين؛ ويستخدم التحليل عالي الحرارة الحرارة ليحتاج إلى كهرباء أقل.'),
      ST('storage', 'Storage and transport', 'التخزين والنقل', 'Hydrogen is compressed, stored or converted (for example to ammonia) before it moves; safety distances and codes matter here.', 'يُضغط الهيدروجين أو يُخزَّن أو يُحوَّل (إلى الأمونيا مثلاً) قبل نقله؛ وهنا تهم مسافات السلامة والمعايير.'),
      ST('use', 'Industrial users', 'المستخدمون الصناعيون', 'Fertiliser, steel and refining can replace fossil hydrogen; the interface stays outside the plant safety boundary.', 'يمكن لصناعات الأسمدة والصلب والتكرير استبدال الهيدروجين الأحفوري؛ وتبقى الواجهة خارج حدود السلامة للمحطة.'),
    ],
    facts: [
      F('vc-h2-f1', SRC.irena, 'At least 16.6 million renewable-energy jobs existed worldwide in 2024; growth slowed to 2.3% despite record capacity additions.', 'بلغت وظائف الطاقة المتجددة في العالم 16.6 مليون وظيفة على الأقل في 2024، وتباطأ نموها إلى 2.3% رغم إضافات قياسية في القدرة.', '2025', true),
      F('vc-h2-f2', SRC.irena, 'IRENA and the ILO call for education and training at scale against shortages, particularly in digital skills and manufacturing.', 'تدعو آيرينا ومنظمة العمل الدولية إلى توسيع التعليم والتدريب لمواجهة النقص، ولا سيما في المهارات الرقمية والتصنيع.', '2025', true),
      F('vc-h2-f3', SRC.nea, "The OECD-NEA's Plan 2035 builds the nuclear workforce in support of tripling nuclear capacity by 2050.", 'تبني خطة 2035 لوكالة الطاقة النووية القوى العاملة النووية دعماً لمضاعفة القدرة النووية ثلاث مرات بحلول 2050.', '2025-10', false),
    ],
    skill_ids: ['sk-fs-gr-h2heat', 'sk-fs-gr-lifecycle'], lane_ids: ['lane-hydrogen', 'lane-netzero'], pathway_ids: ['pw-et-system-integration', 'pw-gr-h2heat-l1'], cec_ids: ['cec-3-2', 'cec-2-2'],
    benchmark_ids: ['ENERGY-JOBS', 'NEA'], sources: [SRC.irena, SRC.nea],
  },
  {
    id: 'vc-process-heat', code: 'VC-2', name_en: 'Process heat', name_ar: 'الحرارة الصناعية', sort: 2,
    summary_en: 'Reactor heat, not only electricity, could serve industrial processes such as desalination or chemicals. Concept learning only; no deployment decision implied.',
    summary_ar: 'يمكن لحرارة المفاعل، لا الكهرباء وحدها، أن تخدم عمليات صناعية مثل التحلية أو الكيماويات. تعلّم مفاهيمي فقط، ولا يُفهم منه أي قرار بالنشر.',
    stages: [
      ST('source', 'Heat source', 'مصدر الحرارة', 'Light-water reactors give steam at moderate temperature; high-temperature and molten-salt designs give hotter heat.', 'تعطي مفاعلات الماء الخفيف بخاراً بحرارة متوسطة؛ وتعطي التصاميم عالية الحرارة وتصاميم الأملاح المنصهرة حرارة أعلى.'),
      ST('loop', 'Heat transport loop', 'دائرة نقل الحرارة', 'An intermediate loop (steam, gas or molten salt) carries heat away and keeps the plant separated from the user.', 'تنقل دائرة وسيطة (بخار أو غاز أو أملاح منصهرة) الحرارة وتُبقي المحطة منفصلة عن المستخدم.'),
      ST('process', 'Industrial process', 'العملية الصناعية', 'Desalination, district heat and chemical processes use the heat; each temperature range suits different users.', 'تستخدم التحلية والتدفئة المركزية والعمليات الكيميائية الحرارة؛ ويناسب كل نطاق حراري مستخدمين مختلفين.'),
      ST('safety', 'Safety boundary', 'حدود السلامة', 'Coupling a reactor to an industrial user needs a safety case that covers both sides of the interface.', 'يحتاج ربط مفاعل بمستخدم صناعي إلى حالة سلامة تغطي جانبي الواجهة.'),
    ],
    facts: [
      F('vc-ph-f1', SRC.iea, 'In the IEA Energy Employment Survey, 60% of companies reported labour shortages, worst in technical trades such as pipefitters, plant operators and nuclear specialists.', 'في مسح الوكالة الدولية للطاقة للتوظيف في قطاع الطاقة، أفادت 60% من الشركات بنقص في العمالة، وكان أشدّه في المهن الفنية مثل مركّبي الأنابيب ومشغلي المحطات والمتخصصين النوويين.', '2025-12', true),
      F('vc-ph-f2', SRC.iea, 'To avoid further skill misalignment by 2030, graduates entering the energy sector must rise by about 40% globally.', 'لتجنّب مزيد من عدم التوافق في المهارات بحلول 2030، يجب أن يرتفع عدد الخريجين الداخلين إلى قطاع الطاقة بنحو 40% عالمياً.', '2025-12', true),
      F('vc-ph-f3', SRC.iea, 'The IEA warns that skills shortages have contributed to increased outages and reduced output in several advanced nuclear fleets.', 'تحذّر الوكالة الدولية للطاقة من أن نقص المهارات أسهم في زيادة فترات الانقطاع وتراجع الإنتاج في عدة أساطيل نووية متقدمة.', '2025-12', true),
    ],
    skill_ids: ['sk-fs-gr-h2heat', 'sk-fs-tr-systems'], lane_ids: ['lane-hydrogen', 'lane-advanced'], pathway_ids: ['pw-et-system-integration', 'pw-gr-h2heat-l2'], cec_ids: ['cec-3-2', 'cec-2-1'],
    benchmark_ids: ['ENERGY-JOBS', 'NEA'], sources: [SRC.iea],
  },
  {
    id: 'vc-grid', code: 'VC-3', name_en: 'Grid integration', name_ar: 'التكامل مع الشبكة', sort: 3,
    summary_en: 'Firm low-carbon power works alongside solar, storage and flexible demand to keep the grid balanced. This explainer covers the system and its skills; it makes no ENEC project claim.',
    summary_ar: 'تعمل الطاقة الثابتة منخفضة الكربون جنباً إلى جنب مع الطاقة الشمسية والتخزين والطلب المرن للحفاظ على توازن الشبكة. يغطي هذا الشرح المنظومة ومهاراتها، ولا يتضمن أي ادعاء بمشروع للمؤسسة.',
    stages: [
      ST('generation', 'Generation', 'التوليد', 'Large reactors run at steady output and provide firm low-carbon power alongside variable solar.', 'تعمل المفاعلات الكبيرة بإنتاج ثابت وتوفر طاقة ثابتة منخفضة الكربون إلى جانب الطاقة الشمسية المتغيرة.'),
      ST('flexibility', 'Flexible operation', 'التشغيل المرن', 'Some fleets follow load; flexibility has limits set by fuel, chemistry and equipment.', 'تتبع بعض الأساطيل الحمل؛ وللمرونة حدود يفرضها الوقود والكيمياء والمعدات.'),
      ST('network', 'Transmission and distribution', 'النقل والتوزيع', 'The network carries power to users and depends on skilled electricians and line workers.', 'تنقل الشبكة الكهرباء إلى المستخدمين وتعتمد على كهربائيين وعمال خطوط مهرة.'),
      ST('balance', 'Demand and storage', 'الطلب والتخزين', 'Batteries, storage and demand response balance supply and demand; hydrogen can store surplus power.', 'توازن البطاريات والتخزين والاستجابة للطلب بين العرض والطلب؛ ويمكن للهيدروجين تخزين الكهرباء الفائضة.'),
    ],
    facts: [
      F('vc-gr-f1', SRC.iea, 'The energy sector employed 76 million people in 2024, 5 million more than in 2019, growing about twice as fast as the global economy.', 'وظّف قطاع الطاقة 76 مليون شخص في 2024، بزيادة 5 ملايين عن 2019، بنمو يقارب ضعف نمو الاقتصاد العالمي.', '2025-12', true),
      F('vc-gr-f2', SRC.iea, 'Among technical trades, the IEA reports shortages of electricians and line workers alongside plant operators.', 'من بين المهن الفنية، تشير الوكالة الدولية للطاقة إلى نقص في الكهربائيين وعمال الخطوط إلى جانب مشغلي المحطات.', '2025-12', true),
      F('vc-gr-f3', SRC.wef, 'Employers in the WEF Future of Jobs Report 2025 name the green transition a top driver of change; environmental stewardship entered the ten fastest-growing skills for the first time.', 'يرى أصحاب العمل في تقرير مستقبل الوظائف 2025 للمنتدى الاقتصادي العالمي أن التحول الأخضر من أبرز محركات التغيير؛ ودخلت رعاية البيئة قائمة أسرع عشر مهارات نمواً لأول مرة.', '2025-01', true),
    ],
    skill_ids: ['sk-fs-gr-grid', 'sk-fs-tr-systems'], lane_ids: ['lane-grid'], pathway_ids: ['pw-et-system-integration', 'pw-gr-grid-l1'], cec_ids: ['cec-3-2', 'cec-2-1'],
    benchmark_ids: ['ENERGY-JOBS', 'NEA'], sources: [SRC.iea, SRC.wef],
  },
];

// ───────────── FS18 external readings (M19 rows; real providers and URLs from the research packs)
const X = (o) => ({
  format: 'reading', hours: null, cost_band: 'free', languages: ['en'], has_assessment: false, criteria_note_en: '', criteria_note_ar: '', as_of: AS_OF,
  status: 'published', listed: true, version: 1, published_by: 'p-training-mgr', published_on: '2026-10-11', retired_reason: null, retired_on: null,
  created_by: 'p-training-mgr', updated_by: 'p-training-mgr', updated_at: SEEDED_AT, ...o,
  sources: o.sources.map((s) => ({ id: s.id, label: s.label, url: s.url, accessed: s.as_of })),
});
export const READINGS = [
  X({ id: 'xr-et-nea-plan2035', title_en: 'OECD-NEA Plan 2035: Scaling Technology, Growing Careers, Securing the Future', title_ar: 'خطة وكالة الطاقة النووية 2035: توسيع التقنية، وتنمية المسارات المهنية، وتأمين المستقبل',
    provider_en: 'OECD Nuclear Energy Agency', provider_ar: 'وكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية', provider_url: 'https://www.oecd-nea.org', url: SRC.nea.url,
    duration_en: 'Vision paper (PDF); a short read', duration_ar: 'ورقة رؤية (PDF)؛ قراءة قصيرة', skills: [{ skill_id: 'sk-fs-gr-grid', level: 1 }],
    summary_en: 'The NEA workforce initiative launched in April 2024 in support of tripling nuclear capacity by 2050, with three pathways: inspire, mentor and network.',
    summary_ar: 'مبادرة القوى العاملة لوكالة الطاقة النووية التي أُطلقت في أبريل 2024 دعماً لمضاعفة القدرة النووية ثلاث مرات بحلول 2050، عبر ثلاثة مسارات: الإلهام والإرشاد والتواصل.',
    criteria: { relevance: 2, standing: 3, assessment: 0, language: 2 }, sources: [SRC.nea] }),
  X({ id: 'xr-et-iea-wee2025', title_en: 'IEA World Energy Employment 2025: what it says about skills', title_ar: 'تقرير الوكالة الدولية للطاقة عن التوظيف في قطاع الطاقة 2025: ما يقوله عن المهارات',
    provider_en: 'NucNet (report on the IEA World Energy Employment 2025)', provider_ar: 'نوك نت (تقرير عن التوظيف في قطاع الطاقة 2025 للوكالة الدولية للطاقة)', provider_url: 'https://smr.nucnet.org', url: SRC.iea.url,
    duration_en: 'News article; a short read', duration_ar: 'مقال إخباري؛ قراءة قصيرة', skills: [{ skill_id: 'sk-fs-gr-grid', level: 1 }],
    summary_en: 'The first edition with occupation-level estimates: energy employment, labour shortages in technical trades and nuclear specialists, and the graduate pipeline needed by 2030.',
    summary_ar: 'أول إصدار بتقديرات على مستوى المهن: التوظيف في قطاع الطاقة، ونقص العمالة في المهن الفنية والمتخصصين النوويين، وأعداد الخريجين المطلوبة بحلول 2030.',
    criteria: { relevance: 2, standing: 2, assessment: 0, language: 2 }, sources: [SRC.iea] }),
  X({ id: 'xr-et-irena-jobs2025', title_en: 'Renewable Energy and Jobs: Annual Review 2025', title_ar: 'الطاقة المتجددة والوظائف: المراجعة السنوية 2025',
    provider_en: 'IRENA and the ILO (via EU BUILD UP)', provider_ar: 'الوكالة الدولية للطاقة المتجددة ومنظمة العمل الدولية (عبر منصة BUILD UP الأوروبية)', provider_url: 'https://build-up.ec.europa.eu', url: SRC.irena.url,
    duration_en: 'Publication page; a short read', duration_ar: 'صفحة إصدار؛ قراءة قصيرة', skills: [{ skill_id: 'sk-fs-gr-grid', level: 1 }],
    summary_en: 'The twelfth edition on renewable-energy employment, with 2024 data, slowing job growth and the call for training in digital skills and manufacturing.',
    summary_ar: 'الإصدار الثاني عشر عن التوظيف في الطاقة المتجددة، ببيانات 2024، وتباطؤ نمو الوظائف، والدعوة إلى التدريب على المهارات الرقمية والتصنيع.',
    criteria: { relevance: 2, standing: 3, assessment: 0, language: 2 }, sources: [SRC.irena] }),
  X({ id: 'xr-et-iso30414', title_en: 'ISO 30414:2025 human capital reporting: what changed', title_ar: 'المعيار ISO 30414:2025 لإعداد تقارير رأس المال البشري: ما الذي تغيّر',
    provider_en: 'ISO Technical Committee 260 (Human resource management)', provider_ar: 'اللجنة الفنية 260 في المنظمة الدولية للتوحيد القياسي (إدارة الموارد البشرية)', provider_url: 'https://committee.iso.org', url: SRC.iso.url,
    duration_en: 'Committee news item; a short read', duration_ar: 'خبر من اللجنة؛ قراءة قصيرة', skills: [{ skill_id: 'sk-fs-gr-esg', level: 1 }],
    summary_en: 'The second edition (24 August 2025) keeps 11 human capital areas, adds a baseline of 14 required metrics and asks for quantitative and qualitative disclosure with variance explanations.',
    summary_ar: 'يحتفظ الإصدار الثاني (24 أغسطس 2025) بأحد عشر مجالاً لرأس المال البشري، ويضيف مجموعة أساسية من 14 مقياساً إلزامياً، ويطلب إفصاحاً كمياً ونوعياً مع شرح الفروق.',
    criteria: { relevance: 2, standing: 2, assessment: 0, language: 2 }, sources: [SRC.iso] }),
  X({ id: 'xr-et-greencomp', title_en: 'GreenComp: the European sustainability competence framework', title_ar: 'إطار "غرين كومب": الإطار الأوروبي لكفاءات الاستدامة',
    provider_en: 'European Commission Joint Research Centre', provider_ar: 'مركز البحوث المشترك التابع للمفوضية الأوروبية', provider_url: 'https://joint-research-centre.ec.europa.eu', url: SRC.greencomp.url,
    duration_en: 'Framework page and PDF; a short read', duration_ar: 'صفحة الإطار وملف PDF؛ قراءة قصيرة', skills: [{ skill_id: 'sk-fs-tr-environment', level: 1 }, { skill_id: 'sk-fs-gr-esg', level: 1 }],
    summary_en: 'Twelve sustainability competences in four areas, built with the JRC method used for DigComp; a reference for designing learning, not a curriculum.',
    summary_ar: 'اثنتا عشرة كفاءة للاستدامة في أربعة مجالات، بُنيت بمنهجية مركز البحوث المشترك المستخدمة في DigComp؛ مرجع لتصميم التعلّم وليس منهجاً دراسياً.',
    criteria: { relevance: 2, standing: 3, assessment: 0, language: 2 }, sources: [SRC.greencomp, SRC.greencompPdf] }),
];

// ───────────── M04 manager electives (FS43), programme Continuous Leadership Development
const CO = (o) => ({ programme_id: 'cld', initial: false, mandatory: false, audience: 'staff', competency_ids: [], prerequisites: [], qualifying: false, evaluation_form_id: null,
  owner_role: 'Corporate Sustainability', public_summary: false, packaging: 'xapi', pass_mark: null, validity_months: null, nexus_course_id: null, concept_content: true, ...o });
export const COURSES = [
  CO({ id: 'c-et-ghg-mgr', code: 'ET-GR-101', title_en: 'GHG and ESG basics for managers', title_ar: 'أساسيات غازات الدفيئة والحوكمة البيئية والاجتماعية للمديرين', modality: 'elearning', duration_hours: 3,
    objectives: [O('Explain emission scopes, an emissions inventory and the difference between reductions and avoided emissions', 'شرح نطاقات الانبعاثات وجرد الانبعاثات والفرق بين التخفيض والانبعاثات التي تم تجنبها'),
      O('Read a sustainability disclosure and find its main metrics, scope and date', 'قراءة إفصاح عن الاستدامة وتحديد مقاييسه الرئيسية ونطاقه وتاريخه'),
      O('Describe the human capital reporting areas and the baseline metrics of ISO 30414:2025', 'وصف مجالات تقارير رأس المال البشري والمقاييس الأساسية في المعيار ISO 30414:2025')],
    summary_en: 'Three short modules for line managers: greenhouse-gas accounting basics, reading a sustainability disclosure, and human capital reporting concepts. Concept content; no figures about ENEC.',
    summary_ar: 'ثلاث وحدات قصيرة للمديرين المباشرين: أساسيات محاسبة غازات الدفيئة، وقراءة إفصاح عن الاستدامة، ومفاهيم تقارير رأس المال البشري. محتوى مفاهيمي، ولا أرقام عن المؤسسة.',
    sources: [SRC.iso, SRC.greencomp, SRC.wef] }),
  CO({ id: 'c-et-esg-clinic', code: 'ET-GR-102', title_en: "ESG data clinic: your team's numbers", title_ar: 'عيادة بيانات الحوكمة البيئية والاجتماعية: أرقام فريقك', modality: 'clinic', duration_hours: 2, prerequisites: ['c-et-ghg-mgr'],
    objectives: [O("Trace one of your team's resource or emissions figures back to its source and scope", 'تتبّع أحد أرقام الموارد أو الانبعاثات لفريقك إلى مصدره ونطاقه'),
      O('Draft a short qualitative explanation for a change in a metric, as ISO 30414:2025 asks', 'صياغة شرح نوعي قصير لتغيّر في أحد المقاييس، كما يطلب المعيار ISO 30414:2025')],
    summary_en: 'A two-hour facilitated clinic: managers bring one team metric, check its source and scope, and write the narrative that should accompany it.',
    summary_ar: 'عيادة بإشراف ميسّر لمدة ساعتين: يحضر المديرون مقياساً واحداً لفريقهم، ويتحققون من مصدره ونطاقه، ويكتبون الشرح الذي ينبغي أن يرافقه.',
    sources: [SRC.iso, SRC.greencomp] }),
];

// ───────────── FS42 / FS43 pathways (M19 rows) and tracks
const PW = (o) => ({ status: 'published', listed: true, version: 1, updated_by: 'p-training-mgr', updated_at: SEEDED_AT, ...o });
const STEP = (pw, n, kind, hours, en, ar, pins, auto) => ({ id: `${pw}:v1:s${n}`, pathway_id: pw, n, kind, title_en: en, title_ar: ar, hours, pins, auto, version: 1 });
export const PATHWAYS = [
  PW({ id: 'pw-et-system-integration', skill_id: 'sk-fs-gr-h2heat', level: 2, envelope_months: 6, weekly_hours: 2,
    title_en: 'Energy-system integration: from awareness to practitioner', title_ar: 'تكامل منظومة الطاقة: من الوعي إلى الممارسة',
    summary_en: 'Hydrogen, process heat and the grid in one route: three value chains, the interfaces with a nuclear plant and the skills they need. Concept learning; no deployment decision implied.',
    summary_ar: 'الهيدروجين والحرارة الصناعية والشبكة في مسار واحد: ثلاث سلاسل قيمة، والواجهات مع المحطة النووية، والمهارات التي تحتاجها. تعلّم مفاهيمي، ولا يُفهم منه أي قرار بالنشر.',
    outcome_en: 'You can explain how nuclear heat and electricity could serve hydrogen, industry and the grid, and where the safety boundary sits.',
    outcome_ar: 'تستطيع شرح كيف يمكن للحرارة والكهرباء النوويتين خدمة الهيدروجين والصناعة والشبكة، وأين تقع حدود السلامة.',
    benchmark_ids: ['ENERGY-JOBS', 'NEA'], sources: [SRC.nea, SRC.iea, SRC.irena].map((s) => ({ id: s.id, label: s.label, url: s.url, accessed: s.as_of })) }),
  PW({ id: 'pw-et-esg-managers', skill_id: 'sk-fs-gr-esg', level: 1, envelope_months: 3, weekly_hours: 1,
    title_en: 'ESG and GHG literacy for managers', title_ar: 'الإلمام بالحوكمة البيئية والاجتماعية وغازات الدفيئة للمديرين',
    summary_en: 'A short route for managers and reporting staff: greenhouse-gas accounting basics, sustainability and human capital reporting concepts, and a check that counts toward MC-CLEAN-ENERGY.',
    summary_ar: 'مسار قصير للمديرين وموظفي إعداد التقارير: أساسيات محاسبة غازات الدفيئة، ومفاهيم تقارير الاستدامة ورأس المال البشري، وفحص يُحتسب ضمن الاعتماد المصغّر MC-CLEAN-ENERGY.',
    outcome_en: 'You can read a sustainability or human capital disclosure, explain its main metrics and question a figure before you repeat it.',
    outcome_ar: 'تستطيع قراءة إفصاح عن الاستدامة أو رأس المال البشري، وشرح مقاييسه الرئيسية، ومساءلة الرقم قبل تكراره.',
    benchmark_ids: ['GREENCOMP', 'ISO30414', 'ENERGY-JOBS'], sources: [SRC.iso, SRC.greencomp].map((s) => ({ id: s.id, label: s.label, url: s.url, accessed: s.as_of })) }),
];
export const STEPS = [
  STEP('pw-et-system-integration', 1, 'learn', 6, 'Awareness: three value chains and where nuclear fits', 'الوعي: ثلاث سلاسل قيمة وموقع الطاقة النووية منها', ['external:xr-et-nea-plan2035', 'external:xr-et-iea-wee2025', 'external:xr-et-irena-jobs2025'], false),
  STEP('pw-et-system-integration', 2, 'learn', 16, 'Practitioner: hydrogen and process-heat interfaces', 'الممارسة: واجهات الهيدروجين والحرارة الصناعية', ['course:c-fs-h2heat', 'course:c-adv-intro'], true),
  STEP('pw-et-system-integration', 3, 'practice', 12, 'Map one value chain with engineering and chemistry colleagues', 'ارسم سلسلة قيمة واحدة مع زملاء الهندسة والكيمياء', ['opportunity:fg-adv-licensing-compare', 'course:c-eng-cont', 'course:c-chem-cont'], true),
  STEP('pw-et-system-integration', 4, 'practice', 8, 'Grid integration: flexible operation alongside renewables', 'التكامل مع الشبكة: التشغيل المرن إلى جانب الطاقة المتجددة', ['course:c-apr'], false),
  STEP('pw-et-system-integration', 5, 'assess', 4, 'Show it: the climate and energy-transition certificate', 'أثبت ذلك: شهادة المناخ وتحوّل الطاقة', ['external:xr-uncclearn-climate'], true),
  STEP('pw-et-esg-managers', 1, 'learn', 2, 'Reporting concepts: sustainability and human capital', 'مفاهيم إعداد التقارير: الاستدامة ورأس المال البشري', ['external:xr-et-iso30414', 'external:xr-et-greencomp'], false),
  STEP('pw-et-esg-managers', 2, 'learn', 3, 'GHG accounting basics: scopes, inventories and avoided emissions', 'أساسيات محاسبة غازات الدفيئة: النطاقات والجرد والانبعاثات التي تم تجنبها', ['course:c-et-ghg-mgr', 'course:c-fs-ghg'], false),
  STEP('pw-et-esg-managers', 3, 'practice', 2, "Apply it to your team's numbers", 'طبّق ذلك على أرقام فريقك', ['course:c-et-esg-clinic'], true),
  STEP('pw-et-esg-managers', 4, 'assess', 2, 'Show it: the CleanEnergyComp check or the GHG log task', 'أثبت ذلك: فحص كفاءات الطاقة النظيفة أو مهمة سجل الانبعاثات', ['external:xr-uncclearn-climate'], true),
];
export const TRACKS = [
  { id: 'tt-system-integration', feature: 'FS42', pathway_id: 'pw-et-system-integration', credential_code: 'MC-H2-HEAT', max_hours: null, sort: 1,
    audience_en: 'Engineers, strategy staff and interested employees', audience_ar: 'المهندسون وموظفو الاستراتيجية والموظفون المهتمون',
    summary_en: 'An awareness-to-practitioner route through the hydrogen, process-heat and grid value chains, with curated readings, a study gig, practice with engineering and chemistry, and the matching horizon lanes.',
    summary_ar: 'مسار من الوعي إلى الممارسة عبر سلاسل القيمة للهيدروجين والحرارة الصناعية والشبكة، مع قراءات منتقاة، ومهمة دراسية قصيرة، وممارسة مع الهندسة والكيمياء، والمسارات المستقبلية المطابقة.',
    chain_ids: ['vc-hydrogen', 'vc-process-heat', 'vc-grid'], benchmark_ids: ['ENERGY-JOBS', 'NEA'], sources: [SRC.nea, SRC.iea, SRC.irena] },
  { id: 'tt-esg-managers', feature: 'FS43', pathway_id: 'pw-et-esg-managers', credential_code: 'MC-CLEAN-ENERGY', max_hours: FS43_HOUR_CAP, sort: 2,
    audience_en: 'Managers, finance and reporting staff', audience_ar: 'المديرون وموظفو المالية وإعداد التقارير',
    summary_en: 'A shared baseline for managers who report on sustainability and human capital, completable in under 10 hours at about one hour a week.',
    summary_ar: 'أساس مشترك للمديرين الذين يعدّون تقارير الاستدامة ورأس المال البشري، يمكن إكماله في أقل من 10 ساعات بمعدل ساعة أسبوعياً تقريباً.',
    chain_ids: [], benchmark_ids: ['GREENCOMP', 'ISO30414', 'ENERGY-JOBS'], sources: [SRC.iso, SRC.greencomp, SRC.wef] },
];

const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
const contentAll = (T) => ({ courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs ?? [], fitness: T.fitness_areas ?? [], adaptive: T.adaptive_banks ?? [], tasks: T.performance_tasks ?? [] });

export default function build() {}

export function finalize(T, ctx) {
  const today = '2026-10-11';
  // M19 / M04 rows first, so the competence learning links and the checks can see them
  const extSort = Math.max(0, ...T.external_resources.map((x) => Number(x.sort) || 0));
  for (const [i, x] of READINGS.entries()) if (!T.external_resources.some((r) => r.id === x.id)) T.external_resources.push({ ...x, sort: extSort + i + 1 });
  for (const c of COURSES) if (!T.courses.some((r) => r.id === c.id)) T.courses.push(c);
  const pwSort = Math.max(0, ...T.pathways.map((x) => Number(x.sort) || 0));
  for (const [i, p] of PATHWAYS.entries()) if (!T.pathways.some((r) => r.id === p.id)) T.pathways.push({ ...p, sort: pwSort + i + 1 });
  for (const s of STEPS) if (!T.pathway_steps.some((r) => r.id === s.id)) T.pathway_steps.push(s);

  // M32 rows
  T.value_chains = CHAINS.map((c) => ({ ...c, status: 'active', as_of: AS_OF }));
  const titleOf = (r) => {
    const get = (rows, id, f = 'title') => { const x = (rows ?? []).find((y) => y.id === id); return x ? [x[`${f}_en`], x[`${f}_ar`]] : null; };
    switch (r.kind) {
      case 'course': return get(T.courses, r.ref);
      case 'pathway': return get(T.pathways, r.ref);
      case 'external': return get(T.external_resources, r.ref);
      case 'adaptive': return get(T.adaptive_banks, r.ref, 'name');
      case 'task': return get(T.performance_tasks, r.ref);
      case 'credential': { const d = (T.microcred_defs ?? []).find((x) => x.code === r.ref && x.status === 'current'); return d ? [d.title_en, d.title_ar] : null; }
      case 'lane': return get(T.horizon_lanes, r.ref);
      case 'chain': return get(T.value_chains, r.ref, 'name');
      case 'academy': return get(T.academies, r.ref, 'name');
      case 'opportunity': return get(T.opportunities, r.ref);
      default: return null;
    }
  };
  T.cec_competences = COMPETENCES.map((c, i) => {
    const learning = c.learning.map((r) => { const tt = titleOf(r); if (!tt) throw new Error(`fs41: ${c.id} learning ${r.kind}:${r.ref} not found`); return { ...r, title_en: tt[0], title_ar: tt[1] || tt[0] }; });
    return { ...c, learning, greencomp_area: GREENCOMP_AREA[c.area], jahiz_group: 'new_economy', net_zero: true, benchmark_ids: ['GREENCOMP', 'WEF-FOJ', 'JAHIZ'],
      sources: [SRC.greencomp, SRC.greencompPdf, SRC.jahiz, SRC.wef], status: 'active', version: 1, as_of: AS_OF, sort: i + 1 };
  });
  T.cec_role_targets = TARGETS;
  T.transition_tracks = TRACKS;

  // FS30 credit tags: the new courses and pathways are tagged by fs29's ensureCreditTags, which fsqa4-integration.mjs runs after this
  // builder (same rule as every other item; checked by the tests).

  // ── checks (fail the build)
  const learningExists = (r) => !!titleOf(r);
  const fw = frameworkProblems(T.cec_competences, T.skills, learningExists);
  if (fw.length) throw new Error(`fs41: CleanEnergyComp problems ${JSON.stringify(fw)}`);
  const tp = targetProblems(T.cec_role_targets, T.job_families.map((f) => f.id), T.cec_competences.map((c) => c.id));
  if (tp.length) throw new Error(`fs41: target problems ${tp.join(', ')}`);
  const chCtx = { skills: T.skills, lanes: T.horizon_lanes.map((l) => l.id), pathways: T.pathways.map((p) => p.id), cec: T.cec_competences.map((c) => c.id), benchmarks: T.benchmarks.map((b) => b.id), today };
  for (const c of T.value_chains) { const p = chainProblems(c, chCtx); if (p.length) throw new Error(`fs41: chain ${c.id}: ${p.join(', ')}`); }
  const criteria = T.catalogue_criteria ?? [];
  for (const x of READINGS) { const r = catalogueCheck(T.external_resources.find((y) => y.id === x.id), criteria, T.skills, today); if (!r.ok) throw new Error(`fs41: reading ${x.id} fails catalogueCheck ${JSON.stringify(r)}`); }
  const P = byId(T.pathways);
  const before = contentBefore(T);
  const after = contentAll(T);
  for (const t of T.transition_tracks) {
    const p = P.get(t.pathway_id);
    const probs = trackProblems(t, p, T.pathway_steps, T.skills);
    if (probs.length) throw new Error(`fs41: track ${t.id}: ${probs.join(', ')}`);
    for (const content of [before, after]) {
      const res = resolvePathway(p, T.pathway_steps, content);
      if (res.requested) throw new Error(`fs41: ${p.id} has ${res.requested} requested step(s); the FS17 gap backlog must stay unchanged`);
    }
  }
  const esg = T.transition_tracks.find((t) => t.feature === 'FS43');
  const esgP = P.get(esg.pathway_id);
  const h = trackHours(esgP, T.pathway_steps, FS43_HOUR_CAP);
  const resolved = resolvePathway(esgP, T.pathway_steps, after);
  const q = quickRoute(resolved);
  if (!h.under_cap || !q.all_fit) throw new Error(`fs41: FS43 must be completable in under ${FS43_HOUR_CAP} hours (${h.total_hours} h, quick route fits ${q.all_fit})`);
  const def = T.microcred_defs.find((d) => d.code === esg.credential_code && d.status === 'current');
  const route = credentialRoute(def.criteria, resolved, { courses: T.courses, adaptive: T.adaptive_banks ?? [], tasks: T.performance_tasks ?? [] });
  if (!route.every((r) => r.covered)) throw new Error(`fs41: FS43 pathway does not reach every ${esg.credential_code} criterion ${JSON.stringify(route.map((r) => [r.key, r.covered]))}`);
  void ctx;
  console.log(`fs41: CleanEnergyComp ${T.cec_competences.length} competences, ${T.cec_role_targets.length} family targets; ${T.value_chains.length} value chains; FS42/FS43 pathways (FS43 ${h.total_hours} h at ${h.weekly_hours} h a week); ${READINGS.length} readings, ${COURSES.length} manager electives`);
}
