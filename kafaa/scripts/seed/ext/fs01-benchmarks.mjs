// FS01 (future skills, wave A) seed: the benchmark registry (kafaa_benchmarks), the 40 international benchmarks the
// future-skills programme follows (scratchpad fs/PLAN.md section 4, research packs read on 2026-10-10). Each row: owner,
// year, https sources, as-of date (the date the source was read), the published figures (every number the product shows
// comes from `figures`; quote_en is the exact wording in fact_en), what Kafa'a borrows, and the FS cards that follow it.
// Figures the research packs flag as secondary or unverified (WEF ranks 4-10, vendor ROI claims) are not stored.
// Loaded by scripts/build-seed.mjs (scripts/seed/ext/*.mjs in name order).
export const AS_OF = '2026-10-10';
export const BENCHMARKS = [
 {
  "id": "WEF-FOJ",
  "name_en": "WEF Future of Jobs Report 2025",
  "name_ar": "تقرير مستقبل الوظائف 2025 الصادر عن المنتدى الاقتصادي العالمي",
  "owner_en": "World Economic Forum",
  "owner_ar": "المنتدى الاقتصادي العالمي",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "global",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/"
  ],
  "fact_en": "39% of workers' core skills expected to change by 2030; AI and big data, networks and cybersecurity, technological literacy grow fastest; environmental stewardship enters the top 10.",
  "fact_ar": "يُتوقع أن تتغير 39% من المهارات الأساسية للعاملين بحلول 2030؛ وتنمو أسرع مهارات الذكاء الاصطناعي والبيانات الضخمة، والشبكات والأمن السيبراني، والإلمام التقني؛ وتدخل الإشراف البيئي قائمة العشر الأوائل.",
  "borrow_en": "Core-skill change per role, a rising/stable/declining trend field on every skill, and a transversal core-skills family.",
  "borrow_ar": "قياس تغيّر المهارات الأساسية لكل دور، وحقل اتجاه (صاعد/مستقر/متراجع) على كل مهارة، وعائلة مهارات أساسية مستعرضة.",
  "figures": [
   {
    "key": "core_skills_change_2030",
    "value": 39,
    "unit": "pct",
    "label_en": "Workers' core skills expected to change by 2030",
    "label_ar": "المهارات الأساسية للعاملين المتوقع تغيّرها بحلول 2030",
    "quote_en": "39",
    "scale_max": 100
   }
  ],
  "feature_ids": [
   "FS02",
   "FS03",
   "FS25",
   "FS35",
   "FS41",
   "FS46",
   "FS53",
   "FS70"
  ],
  "sort": 10
 },
 {
  "id": "OECD-PIAAC",
  "name_en": "OECD Survey of Adult Skills (PIAAC), Cycle 2",
  "name_ar": "مسح منظمة التعاون الاقتصادي والتنمية لمهارات البالغين (PIAAC)، الدورة الثانية",
  "owner_en": "OECD",
  "owner_ar": "منظمة التعاون الاقتصادي والتنمية",
  "country_en": "31 countries",
  "country_ar": "31 دولة",
  "category": "global",
  "year_from": 2024,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.oecd.org/en/data/datasets/PIAAC-2nd-Cycle-Database.html",
   "https://www.cso.ie/en/releasesandpublications/ep/p-piaac/programmefortheinternationalassessmentofadultcompetenciespiaac2023/keyfindings"
  ],
  "fact_en": "Adds adaptive problem solving as a measured domain (OECD average 251); 29% of adults at Level 1 or below.",
  "fact_ar": "يضيف حلّ المشكلات التكيّفي مجالاً مقيساً (متوسط دول المنظمة 251)؛ و29% من البالغين في المستوى الأول أو أدنى.",
  "borrow_en": "Adaptive problem solving as its own assessed scale, and a benchmark line on every score shown to a person.",
  "borrow_ar": "حلّ المشكلات التكيّفي مقياساً مستقلاً يُقيَّم، وخط مرجعي بجانب كل درجة تُعرض على الشخص.",
  "figures": [
   {
    "key": "aps_oecd_average",
    "value": 251,
    "unit": "score",
    "label_en": "Adaptive problem solving, OECD average score",
    "label_ar": "حلّ المشكلات التكيّفي، متوسط دول المنظمة",
    "quote_en": "251",
    "scale_max": 500
   },
   {
    "key": "adults_level1_or_below",
    "value": 29,
    "unit": "pct",
    "label_en": "Adults at Level 1 or below",
    "label_ar": "البالغون في المستوى الأول أو أدنى",
    "quote_en": "29",
    "scale_max": 100
   }
  ],
  "feature_ids": [
   "FS01",
   "FS10",
   "FS21",
   "FS58"
  ],
  "sort": 20
 },
 {
  "id": "OECD-AICI",
  "name_en": "OECD AI Capability Indicators",
  "name_ar": "مؤشرات قدرات الذكاء الاصطناعي لمنظمة التعاون الاقتصادي والتنمية",
  "owner_en": "OECD",
  "owner_ar": "منظمة التعاون الاقتصادي والتنمية",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "global",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://digital-skills-jobs.europa.eu/en/latest/research/oecd-ai-capability-indicators-technical-report"
  ],
  "fact_en": "Ten capability dimensions, each on a five-level scale, built so human-skill and AI-capability frameworks can be compared on the same axes.",
  "fact_ar": "عشرة أبعاد للقدرات، لكلٍّ منها مقياس من خمسة مستويات، صُممت لتُقارَن أطر المهارات البشرية وقدرات الذكاء الاصطناعي على المحاور نفسها.",
  "borrow_en": "A five-level AI capability rating per task, compared with the human requirement to flag augmentable tasks.",
  "borrow_ar": "تقييم قدرة الذكاء الاصطناعي على خمسة مستويات لكل مهمة، ومقارنته بالمتطلب البشري لتحديد المهام القابلة للتعزيز.",
  "figures": [
   {
    "key": "capability_dimensions",
    "value": 10,
    "unit": "count",
    "label_en": "AI capability dimensions",
    "label_ar": "أبعاد قدرات الذكاء الاصطناعي",
    "quote_en": "Ten"
   },
   {
    "key": "scale_levels",
    "value": 5,
    "unit": "count",
    "label_en": "Levels on each scale",
    "label_ar": "مستويات كل مقياس",
    "quote_en": "five"
   }
  ],
  "feature_ids": [
   "FS06",
   "FS12",
   "FS52"
  ],
  "sort": 30
 },
 {
  "id": "ILO-RPL",
  "name_en": "ILO Skills and Lifelong Learning Strategy 2030; recognition of prior learning",
  "name_ar": "استراتيجية منظمة العمل الدولية للمهارات والتعلم مدى الحياة 2030؛ الاعتراف بالتعلم السابق",
  "owner_en": "International Labour Organization",
  "owner_ar": "منظمة العمل الدولية",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "global",
  "year_from": 2023,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.ilo.org/global-skills-programme",
   "https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning"
  ],
  "fact_en": "Names quality-assured assessment, certification and recognition of prior learning (RPL) as one of five pillars; programme covers 61 countries.",
  "fact_ar": "تجعل التقييم المضمون الجودة والإشهاد والاعتراف بالتعلم السابق إحدى خمس ركائز؛ ويغطي البرنامج 61 دولة.",
  "borrow_en": "A structured RPL flow (request, evidence, assessor, credit) and re-assessment on each skill's own validity clock.",
  "borrow_ar": "مسار منظم للاعتراف بالتعلم السابق (طلب، أدلة، مقيّم، رصيد) وإعادة التقييم وفق مدة صلاحية كل مهارة.",
  "figures": [
   {
    "key": "countries",
    "value": 61,
    "unit": "count",
    "label_en": "Countries covered by the programme",
    "label_ar": "الدول التي يغطيها البرنامج",
    "quote_en": "61"
   },
   {
    "key": "pillars",
    "value": 5,
    "unit": "count",
    "label_en": "Pillars of the strategy",
    "label_ar": "ركائز الاستراتيجية",
    "quote_en": "five"
   }
  ],
  "feature_ids": [
   "FS29"
  ],
  "sort": 40
 },
 {
  "id": "EU-PACT",
  "name_en": "EU Pact for Skills",
  "name_ar": "ميثاق المهارات الأوروبي",
  "owner_en": "European Commission",
  "owner_ar": "المفوضية الأوروبية",
  "country_en": "EU",
  "country_ar": "الاتحاد الأوروبي",
  "category": "global",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://pact-for-skills.ec.europa.eu/about/news-and-factsheets/more-61-million-workers-trained-under-pact-skills-2025-05-19_en"
  ],
  "fact_en": "Over 10 million people trained cumulatively by 2025; 4,000+ member organisations; large-scale partnerships train about a quarter to a third of their workforce a year.",
  "fact_ar": "أكثر من 10 ملايين شخص تلقّوا التدريب تراكمياً حتى 2025؛ وأكثر من 4,000 مؤسسة عضو؛ وتدرّب الشراكات الكبرى نحو ربع إلى ثلث قواها العاملة سنوياً.",
  "borrow_en": "\"% of workforce trained this year\" as the headline KPI, and numeric commitments from suppliers and partners.",
  "borrow_ar": "\"نسبة القوى العاملة المدرَّبة هذا العام\" مؤشراً رئيسياً، والتزامات رقمية من الموردين والشركاء.",
  "figures": [
   {
    "key": "people_trained",
    "value": 10000000,
    "unit": "count",
    "label_en": "People trained (cumulative, 2025)",
    "label_ar": "الأشخاص المدرَّبون (تراكمياً، 2025)",
    "quote_en": "10 million"
   },
   {
    "key": "member_organisations",
    "value": 4000,
    "unit": "count",
    "label_en": "Member organisations",
    "label_ar": "المؤسسات الأعضاء",
    "quote_en": "4,000"
   }
  ],
  "feature_ids": [
   "FS53",
   "FS60",
   "FS64",
   "FS65",
   "FS68"
  ],
  "sort": 50
 },
 {
  "id": "ESCO",
  "name_en": "ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations)",
  "name_ar": "التصنيف الأوروبي للمهارات والكفاءات والمؤهلات والمهن (ESCO) الإصدار 1.2.1",
  "owner_en": "European Commission",
  "owner_ar": "المفوضية الأوروبية",
  "country_en": "EU, 28 languages incl. Arabic",
  "country_ar": "الاتحاد الأوروبي، 28 لغة منها العربية",
  "category": "global",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://esco.ec.europa.eu/en/about-esco/what-esco",
   "https://esco.ec.europa.eu/en/classification/skill_main"
  ],
  "fact_en": "3,039 occupations and 13,939 skills; each skill has a reusability level (transversal to occupation-specific); concepts are marked obsolete, never deleted.",
  "fact_ar": "3,039 مهنة و13,939 مهارة؛ لكل مهارة مستوى قابلية لإعادة الاستخدام (من المستعرضة إلى الخاصة بمهنة)؛ وتُوسَم المفاهيم بأنها متقادمة ولا تُحذف أبداً.",
  "borrow_en": "Reusability level on every skill, Arabic preferred and alternative labels, obsolete-not-deleted, and a published crosswalk.",
  "borrow_ar": "مستوى قابلية إعادة الاستخدام على كل مهارة، وتسميات عربية مفضلة وبديلة، والتقادم دون الحذف، وجدول مواءمة منشور.",
  "figures": [
   {
    "key": "occupations",
    "value": 3039,
    "unit": "count",
    "label_en": "Occupations",
    "label_ar": "المهن",
    "quote_en": "3,039"
   },
   {
    "key": "skills",
    "value": 13939,
    "unit": "count",
    "label_en": "Skills",
    "label_ar": "المهارات",
    "quote_en": "13,939"
   }
  ],
  "feature_ids": [
   "FS01",
   "FS02",
   "FS04",
   "FS07",
   "FS08",
   "FS34",
   "FS63"
  ],
  "sort": 60
 },
 {
  "id": "DIGCOMP",
  "name_en": "DigComp 2.2 / 3.0 digital competence framework",
  "name_ar": "إطار الكفاءة الرقمية DigComp 2.2 / 3.0",
  "owner_en": "European Commission JRC",
  "owner_ar": "مركز البحوث المشترك التابع للمفوضية الأوروبية",
  "country_en": "EU",
  "country_ar": "الاتحاد الأوروبي",
  "category": "global",
  "year_from": 2022,
  "year_to": 2025,
  "year_kind": "editions",
  "urls": [
   "https://joint-research-centre.ec.europa.eu/scientific-activities-z/education-and-training/digital-transformation-education/digital-competence-framework-citizens-digcomp_en"
  ],
  "fact_en": "21 competences in 5 areas at 8 proficiency levels, with AI examples in 2.2; only 56% of EU adults had above-basic digital skills in 2023.",
  "fact_ar": "21 كفاءة في 5 مجالات على 8 مستويات إتقان، مع أمثلة عن الذكاء الاصطناعي في الإصدار 2.2؛ ولم يكن لدى سوى 56% من البالغين في الاتحاد الأوروبي مهارات رقمية فوق الأساسية في 2023.",
  "borrow_en": "A digital and AI ladder with plant-specific examples, extra weight on safety and problem solving, and a \"% above basic\" indicator.",
  "borrow_ar": "سلّم للمهارات الرقمية والذكاء الاصطناعي بأمثلة من المحطة، ووزن إضافي للسلامة وحلّ المشكلات، ومؤشر \"النسبة فوق المستوى الأساسي\".",
  "figures": [
   {
    "key": "above_basic_eu_2023",
    "value": 56,
    "unit": "pct",
    "label_en": "EU adults with above-basic digital skills (2023)",
    "label_ar": "البالغون في الاتحاد الأوروبي بمهارات رقمية فوق الأساسية (2023)",
    "quote_en": "56",
    "scale_max": 100
   },
   {
    "key": "competences",
    "value": 21,
    "unit": "count",
    "label_en": "Competences",
    "label_ar": "الكفاءات",
    "quote_en": "21"
   }
  ],
  "feature_ids": [
   "FS08",
   "FS09",
   "FS10",
   "FS24"
  ],
  "sort": 70
 },
 {
  "id": "GREENCOMP",
  "name_en": "GreenComp, with EntreComp and LifeComp",
  "name_ar": "إطار GreenComp مع EntreComp وLifeComp",
  "owner_en": "European Commission JRC",
  "owner_ar": "مركز البحوث المشترك التابع للمفوضية الأوروبية",
  "country_en": "EU",
  "country_ar": "الاتحاد الأوروبي",
  "category": "global",
  "year_from": 2022,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://joint-research-centre.ec.europa.eu/greencomp"
  ],
  "fact_en": "GreenComp has 12 sustainability competences in 4 areas, authored with the same validated JRC method as DigComp.",
  "fact_ar": "يضم GreenComp 12 كفاءة للاستدامة في 4 مجالات، أُعدّت بالمنهج المعتمد نفسه لدى مركز البحوث المشترك في DigComp.",
  "borrow_en": "The 4 x 3 authoring method for an ENEC CleanEnergyComp, LifeComp as the home for human skills, and EntreComp for intrapreneurship.",
  "borrow_ar": "منهج التأليف 4 × 3 لإطار CleanEnergyComp خاص بالمؤسسة، وLifeComp مرجعاً للمهارات الإنسانية، وEntreComp لريادة الأعمال الداخلية.",
  "figures": [
   {
    "key": "competences",
    "value": 12,
    "unit": "count",
    "label_en": "Sustainability competences",
    "label_ar": "كفاءات الاستدامة",
    "quote_en": "12"
   },
   {
    "key": "areas",
    "value": 4,
    "unit": "count",
    "label_en": "Areas",
    "label_ar": "المجالات",
    "quote_en": "4"
   }
  ],
  "feature_ids": [
   "FS25",
   "FS41",
   "FS43",
   "FS46"
  ],
  "sort": 80
 },
 {
  "id": "FORECAST",
  "name_en": "Skills England priority skills to 2030 and LSIPs; Cedefop Skills Forecast to 2035",
  "name_ar": "المهارات ذات الأولوية حتى 2030 لدى Skills England وخطط المهارات المحلية؛ توقعات المهارات لدى Cedefop حتى 2035",
  "owner_en": "Skills England (UK); Cedefop (EU)",
  "owner_ar": "Skills England (المملكة المتحدة)؛ Cedefop (الاتحاد الأوروبي)",
  "country_en": "UK / EU",
  "country_ar": "المملكة المتحدة / الاتحاد الأوروبي",
  "category": "national",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.gov.uk/government/publications/assessment-of-priority-skills-to-2030/assessment-of-priority-skills-to-2030",
   "https://www.cedefop.europa.eu/en/datasets/dataset-skills-forecast"
  ],
  "fact_en": "Priority-occupation demand +15% to 2030 with uncertainty stated up front; a methodology change voids year-on-year comparison and is disclosed; LSIPs make local provision answer employer demand.",
  "fact_ar": "يرتفع الطلب على المهن ذات الأولوية 15% حتى 2030 مع الإفصاح المسبق عن عدم اليقين؛ وتغيير المنهجية يُبطل المقارنة السنوية ويُعلَن؛ وتجعل خطط المهارات المحلية العرضَ المحلي يستجيب لطلب أصحاب العمل.",
  "borrow_en": "One declared baseline with bands, \"pressure now\" kept apart from \"demand later\", a methodology-change banner, a \"not yet modelled\" list, and a regional demand-to-provider loop.",
  "borrow_ar": "خط أساس معلن مع نطاقات، وفصل \"الضغط الآن\" عن \"الطلب لاحقاً\"، وشريط تنبيه عند تغيير المنهجية، وقائمة \"لم يُنمذج بعد\"، وحلقة إقليمية من الطلب إلى مقدّمي التدريب.",
  "figures": [
   {
    "key": "priority_demand_growth_2030",
    "value": 15,
    "unit": "pct",
    "label_en": "Priority-occupation demand growth to 2030",
    "label_ar": "نمو الطلب على المهن ذات الأولوية حتى 2030",
    "quote_en": "15",
    "scale_max": 100
   }
  ],
  "feature_ids": [
   "FS03",
   "FS16",
   "FS50",
   "FS51",
   "FS54",
   "FS64"
  ],
  "sort": 90
 },
 {
  "id": "ONET",
  "name_en": "O*NET Hot Technologies and Bright Outlook",
  "name_ar": "التقنيات الرائجة ومؤشر النظرة المشرقة في O*NET",
  "owner_en": "US Department of Labor",
  "owner_ar": "وزارة العمل الأمريكية",
  "country_en": "United States",
  "country_ar": "الولايات المتحدة",
  "category": "national",
  "year_from": 2026,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://onetcenter.org/bright.html",
   "https://onetcenter.org/reports/Hot_Technologies_Demand.html"
  ],
  "fact_en": "Bright Outlook criteria are published (growth of 5% or more, 75,000+ openings, or new and emerging); hot-across-all-jobs is kept apart from in-demand-for-this-occupation.",
  "fact_ar": "معايير النظرة المشرقة منشورة (نمو 5% أو أكثر، أو 75,000 فرصة أو أكثر، أو مهنة جديدة وناشئة)؛ ويُفصل \"الرائج في كل الوظائف\" عن \"المطلوب لهذه المهنة\".",
  "borrow_en": "Role and technology badges with published thresholds, past lists kept, and a three-tier consumer label.",
  "borrow_ar": "شارات للأدوار والتقنيات بعتبات منشورة، والاحتفاظ بالقوائم السابقة، وتصنيف من ثلاث درجات للمستخدم.",
  "figures": [
   {
    "key": "bright_growth_threshold",
    "value": 5,
    "unit": "pct",
    "label_en": "Growth threshold for Bright Outlook",
    "label_ar": "عتبة النمو لمؤشر النظرة المشرقة",
    "quote_en": "5",
    "scale_max": 100
   },
   {
    "key": "bright_openings_threshold",
    "value": 75000,
    "unit": "count",
    "label_en": "Openings threshold for Bright Outlook",
    "label_ar": "عتبة الفرص لمؤشر النظرة المشرقة",
    "quote_en": "75,000"
   }
  ],
  "feature_ids": [
   "FS06",
   "FS08",
   "FS16",
   "FS71"
  ],
  "sort": 100
 },
 {
  "id": "LIGHTCAST",
  "name_en": "Lightcast Open Skills and Skillabi",
  "name_ar": "تصنيف المهارات المفتوح من Lightcast وأداة Skillabi",
  "owner_en": "Lightcast",
  "owner_ar": "Lightcast",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "corporate",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://lightcast.io/blog/open-skills-taxonomy",
   "https://lightcast.io/resources/blog/skillabi-press-release-june-3-2025"
  ],
  "fact_en": "About 32,000 to 34,000 skills typed as common, specialised or certification, with stable IDs; Skillabi scores curriculum coverage of real roles from 0 to 100.",
  "fact_ar": "نحو 32,000 إلى 34,000 مهارة مصنّفة إلى عامة أو متخصصة أو شهادات، بمعرّفات ثابتة؛ وتقيس Skillabi تغطية المناهج للأدوار الفعلية من 0 إلى 100.",
  "borrow_en": "Skill types, stable IDs and a dated changelog; a curriculum coverage score with the list of skills nothing teaches.",
  "borrow_ar": "أنواع المهارات والمعرّفات الثابتة وسجل تغييرات مؤرّخ؛ ودرجة تغطية المناهج مع قائمة المهارات التي لا يدرّسها شيء.",
  "figures": [
   {
    "key": "skills_low",
    "value": 32000,
    "unit": "count",
    "label_en": "Skills in the taxonomy (low end)",
    "label_ar": "المهارات في التصنيف (الحد الأدنى)",
    "quote_en": "32,000"
   },
   {
    "key": "coverage_scale",
    "value": 100,
    "unit": "score",
    "label_en": "Top of the curriculum coverage score",
    "label_ar": "أعلى درجة لتغطية المناهج",
    "quote_en": "100",
    "scale_max": 100
   }
  ],
  "feature_ids": [
   "FS02",
   "FS17",
   "FS57",
   "FS66"
  ],
  "sort": 110
 },
 {
  "id": "LINKEDIN",
  "name_en": "LinkedIn Economic Graph: Skills on the Rise and Work Change",
  "name_ar": "الرسم البياني الاقتصادي من LinkedIn: المهارات الصاعدة وتغيّر العمل",
  "owner_en": "LinkedIn",
  "owner_ar": "LinkedIn",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "corporate",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://economicgraph.linkedin.com/research"
  ],
  "fact_en": "Skills on the Rise combines three signals (profile additions, skills of recent hires, employer demand); AI literacy ranked first in 2025 and is kept apart from AI engineering.",
  "fact_ar": "تجمع قائمة المهارات الصاعدة ثلاث إشارات (إضافات الملفات الشخصية، ومهارات المعيَّنين حديثاً، وطلب أصحاب العمل)؛ وجاء الإلمام بالذكاء الاصطناعي أولاً في 2025 ويُفصل عن هندسة الذكاء الاصطناعي.",
  "borrow_en": "A three-signal rising-skill detector on ENEC's own data, and AI literacy separated from AI engineering.",
  "borrow_ar": "كاشف للمهارات الصاعدة بثلاث إشارات على بيانات المؤسسة نفسها، وفصل الإلمام بالذكاء الاصطناعي عن هندسته.",
  "figures": [
   {
    "key": "signals",
    "value": 3,
    "unit": "count",
    "label_en": "Signals behind Skills on the Rise",
    "label_ar": "الإشارات وراء المهارات الصاعدة",
    "quote_en": "three"
   }
  ],
  "feature_ids": [
   "FS09",
   "FS70",
   "FS72"
  ],
  "sort": 120
 },
 {
  "id": "MCK-DELTA",
  "name_en": "McKinsey DELTAs (Distinct Elements of Talent)",
  "name_ar": "العناصر المميزة للمواهب (DELTAs) من ماكنزي",
  "owner_en": "McKinsey Global Institute",
  "owner_ar": "معهد ماكنزي العالمي",
  "country_en": "International (18,000 people, 15 countries)",
  "country_ar": "دولي (18,000 شخص في 15 دولة)",
  "category": "global",
  "year_from": 2021,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.mckinsey.com/industries/public-and-social-sector/our-insights/defining-the-skills-citizens-will-need-in-the-future-world-of-work"
  ],
  "fact_en": "56 DELTAs in 13 groups and 4 categories; an item qualifies only if it needs a distinct development and assessment approach.",
  "fact_ar": "56 عنصراً في 13 مجموعة و4 فئات؛ ولا يُدرج عنصر إلا إذا احتاج نهجاً مميزاً في التطوير والتقييم.",
  "borrow_en": "The inclusion rule as taxonomy governance, and \"proficiency against needed\" as the main chart.",
  "borrow_ar": "قاعدة الإدراج أداةً لحوكمة التصنيف، و\"الإتقان مقابل المطلوب\" رسماً رئيسياً.",
  "figures": [
   {
    "key": "deltas",
    "value": 56,
    "unit": "count",
    "label_en": "DELTAs",
    "label_ar": "العناصر المميزة",
    "quote_en": "56"
   },
   {
    "key": "groups",
    "value": 13,
    "unit": "count",
    "label_en": "Groups",
    "label_ar": "المجموعات",
    "quote_en": "13"
   }
  ],
  "feature_ids": [
   "FS02",
   "FS25",
   "FS26",
   "FS54"
  ],
  "sort": 130
 },
 {
  "id": "ISO30414",
  "name_en": "ISO 30414:2025 human capital reporting",
  "name_ar": "المعيار ISO 30414:2025 لتقارير رأس المال البشري",
  "owner_en": "ISO TC 260",
  "owner_ar": "اللجنة الفنية ISO TC 260",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "global",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html"
  ],
  "fact_en": "Second edition (Aug 2025) adds auditable requirements, 14 baseline metrics, and a quantitative plus qualitative disclosure with variance explanations.",
  "fact_ar": "يضيف الإصدار الثاني (أغسطس 2025) متطلبات قابلة للتدقيق و14 مقياساً أساسياً، وإفصاحاً كمياً ونوعياً مع تفسير الفروق.",
  "borrow_en": "A Skills, Capabilities and Development disclosure pack where every metric has a definition, owner narrative, variance note and audit trail.",
  "borrow_ar": "حزمة إفصاح عن المهارات والقدرات والتطوير يكون لكل مقياس فيها تعريف وسرد من المالك وملاحظة عن الفروق وسجل تدقيق.",
  "figures": [
   {
    "key": "baseline_metrics",
    "value": 14,
    "unit": "count",
    "label_en": "Baseline metrics",
    "label_ar": "المقاييس الأساسية",
    "quote_en": "14"
   }
  ],
  "feature_ids": [
   "FS43",
   "FS50",
   "FS56",
   "FS60",
   "FS84"
  ],
  "sort": 140
 },
 {
  "id": "1EDTECH",
  "name_en": "Open Badges 3.0, CLR 2.0 and CASE",
  "name_ar": "الشارات المفتوحة 3.0 وسجل المتعلم الشامل 2.0 وCASE",
  "owner_en": "1EdTech",
  "owner_ar": "1EdTech",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "global",
  "year_from": 2024,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.1edtech.org/standards/open-badges",
   "https://www.1edtech.org/standards/clr"
  ],
  "fact_en": "Badges and the Comprehensive Learner Record are W3C Verifiable Credentials; CASE carries machine-readable competency definitions.",
  "fact_ar": "الشارات وسجل المتعلم الشامل بيانات اعتماد قابلة للتحقق وفق W3C؛ ويحمل CASE تعريفات الكفاءات بصيغة قابلة للقراءة آلياً.",
  "borrow_en": "A CLR-shaped learner record, credentials that point at a competency ID, and a CASE-shaped framework export.",
  "borrow_ar": "سجل متعلم بصيغة CLR، وبيانات اعتماد تشير إلى معرّف كفاءة، وتصدير للإطار بصيغة CASE.",
  "figures": [],
  "feature_ids": [
   "FS08",
   "FS31",
   "FS32",
   "FS69",
   "FS79"
  ],
  "sort": 150
 },
 {
  "id": "SFIA9",
  "name_en": "SFIA 9 (Skills Framework for the Information Age)",
  "name_ar": "إطار المهارات لعصر المعلومات SFIA 9",
  "owner_en": "SFIA Foundation",
  "owner_ar": "مؤسسة SFIA",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "global",
  "year_from": 2024,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://sfia-online.org/en/sfia-9/sfia-9-release-notes"
  ],
  "fact_en": "7 levels of responsibility defined by generic attributes; skills defined only at levels where they exist; level essence lines, an AI skills view and a change tracker.",
  "fact_ar": "7 مستويات للمسؤولية تُعرّفها سمات عامة؛ وتُعرَّف المهارات فقط في المستويات التي توجد فيها؛ مع أسطر جوهر المستوى وعرض لمهارات الذكاء الاصطناعي وسجل للتغييرات.",
  "borrow_en": "Generic level attributes across all skills, level essence lines, skills defined only at real levels, and a public change tracker.",
  "borrow_ar": "سمات مستويات عامة لكل المهارات، وأسطر جوهر المستوى، وتعريف المهارات في مستوياتها الفعلية فقط، وسجل تغييرات عام.",
  "figures": [
   {
    "key": "levels",
    "value": 7,
    "unit": "count",
    "label_en": "Levels of responsibility",
    "label_ar": "مستويات المسؤولية",
    "quote_en": "7"
   }
  ],
  "feature_ids": [
   "FS01",
   "FS07",
   "FS08",
   "FS23",
   "FS24",
   "FS54"
  ],
  "sort": 160
 },
 {
  "id": "SSG-SF",
  "name_en": "SkillsFuture Skills Frameworks, Critical Core Skills and AI Potential on Tasks",
  "name_ar": "أطر المهارات في SkillsFuture والمهارات الأساسية الحرجة وإمكانات الذكاء الاصطناعي في المهام",
  "owner_en": "SkillsFuture Singapore",
  "owner_ar": "SkillsFuture Singapore",
  "country_en": "Singapore",
  "country_ar": "سنغافورة",
  "category": "national",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf"
  ],
  "fact_en": "About 37,000 key work tasks across 2,000 roles; about 24% of tasks can be significantly aided by AI; entry roles typed as Mastery Builders, Analytical Specialists or Human Connectors; 16 Critical Core Skills.",
  "fact_ar": "نحو 37,000 مهمة عمل رئيسية في 2,000 دور؛ ويمكن للذكاء الاصطناعي أن يساعد بدرجة كبيرة في نحو 24% من المهام؛ وتُصنَّف أدوار الدخول إلى بُناة الإتقان أو المتخصصين التحليليين أو صانعي التواصل الإنساني؛ و16 مهارة أساسية حرجة.",
  "borrow_en": "A task layer between role and skill, AI exposure per task, role archetypes with ladder-rung protection, and a core-skills set.",
  "borrow_ar": "طبقة مهام بين الدور والمهارة، ودرجة تعرّض لكل مهمة للذكاء الاصطناعي، ونماذج أدوار مع حماية درجات السلّم، ومجموعة مهارات أساسية.",
  "figures": [
   {
    "key": "tasks",
    "value": 37000,
    "unit": "count",
    "label_en": "Key work tasks",
    "label_ar": "مهام العمل الرئيسية",
    "quote_en": "37,000"
   },
   {
    "key": "ai_aided_tasks",
    "value": 24,
    "unit": "pct",
    "label_en": "Tasks that AI can significantly aid",
    "label_ar": "المهام التي يمكن للذكاء الاصطناعي أن يساعد فيها بدرجة كبيرة",
    "quote_en": "24",
    "scale_max": 100
   },
   {
    "key": "critical_core_skills",
    "value": 16,
    "unit": "count",
    "label_en": "Critical Core Skills",
    "label_ar": "المهارات الأساسية الحرجة",
    "quote_en": "16"
   }
  ],
  "feature_ids": [
   "FS05",
   "FS06",
   "FS07",
   "FS11",
   "FS12",
   "FS23",
   "FS25",
   "FS52",
   "FS70",
   "FS81"
  ],
  "sort": 170
 },
 {
  "id": "SG-CAREER",
  "name_en": "Careers and Skills Passport, CareersFinder and Career Health SG",
  "name_ar": "جواز المهن والمهارات وCareersFinder وصحة المسار المهني في سنغافورة",
  "owner_en": "SSG, MOM, WSG",
  "owner_ar": "SSG وMOM وWSG",
  "country_en": "Singapore",
  "country_ar": "سنغافورة",
  "category": "national",
  "year_from": 2024,
  "year_to": 2025,
  "year_kind": "range",
  "urls": [
   "https://www.myskillsfuture.gov.sg/csp",
   "https://www.mom.gov.sg/newsroom/speeches/2025/0710-speech-by-min-at-career-health-summit-2025"
  ],
  "fact_en": "315,000 people opened their passport and 4,900 shared it (Apr 2025); three consent gates and curated sharing; CareersFinder used by 55,000+; ACE = Assess, Chart, Execute.",
  "fact_ar": "فتح 315,000 شخص جوازهم وشاركه 4,900 (أبريل 2025)؛ ثلاث بوابات للموافقة ومشاركة منتقاة؛ واستخدم CareersFinder أكثر من 55,000 شخص؛ وACE تعني التقييم والتخطيط والتنفيذ.",
  "borrow_en": "A provenance badge on every record, curated sharing with expiry, adjacency moves backed by real transitions, and a visible career-health check.",
  "borrow_ar": "شارة مصدر على كل سجل، ومشاركة منتقاة بتاريخ انتهاء، وتنقلات متجاورة تدعمها انتقالات فعلية، وفحص ظاهر لصحة المسار المهني.",
  "figures": [
   {
    "key": "passports_opened",
    "value": 315000,
    "unit": "count",
    "label_en": "People who opened their passport",
    "label_ar": "الأشخاص الذين فتحوا جوازهم",
    "quote_en": "315,000"
   },
   {
    "key": "passports_shared",
    "value": 4900,
    "unit": "count",
    "label_en": "People who shared it",
    "label_ar": "الأشخاص الذين شاركوه",
    "quote_en": "4,900"
   }
  ],
  "feature_ids": [
   "FS15",
   "FS32",
   "FS33",
   "FS35",
   "FS69",
   "FS75",
   "FS76"
  ],
  "sort": 180
 },
 {
  "id": "SG-JTM",
  "name_en": "Jobs Transformation Maps",
  "name_ar": "خرائط تحوّل الوظائف",
  "owner_en": "Workforce Singapore",
  "owner_ar": "Workforce Singapore",
  "country_en": "Singapore",
  "country_ar": "سنغافورة",
  "category": "national",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://wsg.gov.sg/for-employers/jobs-transformation-maps.html",
   "https://www.mom.gov.sg/newsroom/parliament-questions-and-replies/2025/1104-written-answer-to-pq-on-update-on-jobs-transformation-maps"
  ],
  "fact_en": "19 maps covering about 1.7 million workers; each ends in redesigned roles and a reskilling pathway, not a trend report.",
  "fact_ar": "19 خريطة تغطي نحو 1.7 مليون عامل؛ تنتهي كل منها بأدوار معاد تصميمها ومسار لإعادة التأهيل، لا بتقرير عن الاتجاهات.",
  "borrow_en": "A per-role transformation page: technology drivers, tasks added or removed, the redesigned profile and a dated reskilling path.",
  "borrow_ar": "صفحة تحوّل لكل دور: محرّكات التقنية، والمهام المضافة أو المحذوفة، والملف المعاد تصميمه، ومسار مؤرّخ لإعادة التأهيل.",
  "figures": [
   {
    "key": "maps",
    "value": 19,
    "unit": "count",
    "label_en": "Transformation maps",
    "label_ar": "خرائط التحوّل",
    "quote_en": "19"
   },
   {
    "key": "workers",
    "value": 1700000,
    "unit": "count",
    "label_en": "Workers covered",
    "label_ar": "العاملون المشمولون",
    "quote_en": "1.7 million"
   }
  ],
  "feature_ids": [
   "FS05",
   "FS11",
   "FS81"
  ],
  "sort": 190
 },
 {
  "id": "ENTITLE",
  "name_en": "SkillsFuture Level-Up (SG) and Lifelong Learning Entitlement (UK)",
  "name_ar": "برنامج SkillsFuture Level-Up (سنغافورة) واستحقاق التعلم مدى الحياة (المملكة المتحدة)",
  "owner_en": "MOE/SSG Singapore; DfE England",
  "owner_ar": "وزارة التعليم وSSG في سنغافورة؛ وزارة التعليم في إنجلترا",
  "country_en": "Singapore / UK",
  "country_ar": "سنغافورة / المملكة المتحدة",
  "category": "national",
  "year_from": 2024,
  "year_to": 2025,
  "year_kind": "range",
  "urls": [
   "https://www.moe.gov.sg/news/press-releases/20240304-new-skillsfuture-level-up-programme-to-boost-mid-career-upskilling-and-reskilling",
   "https://www.gov.uk/government/publications/lifelong-learning-entitlement-lle-overview/lifelong-learning-entitlement-overview"
  ],
  "fact_en": "A non-expiring mid-career credit usable only on about 7,000 outcome-filtered courses, plus a training allowance; the LLE expresses learning in credits with 30-credit modules.",
  "fact_ar": "رصيد لا ينتهي لمنتصف المسار المهني يُستخدم فقط في نحو 7,000 دورة منتقاة وفق نتائجها، إضافة إلى بدل تدريب؛ ويعبّر استحقاق التعلم مدى الحياة عن التعلم بأرصدة في وحدات من 30 رصيداً.",
  "borrow_en": "A visible learning balance, an outcome-gated catalogue, protected study time, and a credit unit for every learning asset.",
  "borrow_ar": "رصيد تعلم ظاهر، وكتالوج مشروط بالنتائج، ووقت دراسة محمي، ووحدة رصيد لكل أصل تعلّمي.",
  "figures": [
   {
    "key": "outcome_filtered_courses",
    "value": 7000,
    "unit": "count",
    "label_en": "Outcome-filtered courses",
    "label_ar": "الدورات المنتقاة وفق النتائج",
    "quote_en": "7,000"
   },
   {
    "key": "module_credits",
    "value": 30,
    "unit": "count",
    "label_en": "Credits per module",
    "label_ar": "الأرصدة لكل وحدة",
    "quote_en": "30"
   }
  ],
  "feature_ids": [
   "FS17",
   "FS18",
   "FS19",
   "FS30",
   "FS78"
  ],
  "sort": 200
 },
 {
  "id": "FSC",
  "name_en": "Future Skills Centre Impact Report 2025",
  "name_ar": "تقرير الأثر 2025 لمركز مهارات المستقبل",
  "owner_en": "Future Skills Centre (ESDC-funded)",
  "owner_ar": "مركز مهارات المستقبل (بتمويل من ESDC)",
  "country_en": "Canada",
  "country_ar": "كندا",
  "category": "national",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://fsc-ccf.ca/wp-content/uploads/2025/08/FSC-Impact-Report-EN-FINAL.pdf"
  ],
  "fact_en": "400 pilot and research projects, each with an independent evaluator; 78% of completed projects report adoption, expansion or further investment.",
  "fact_ar": "400 مشروع تجريبي وبحثي لكلٍّ منها مقيّم مستقل؛ و78% من المشاريع المكتملة أفادت بالتبنّي أو التوسّع أو استثمار إضافي.",
  "borrow_en": "A pilots registry (hypothesis, comparison group, evaluator, published result including failures) and an adoption-rate KPI.",
  "borrow_ar": "سجل للمشاريع التجريبية (فرضية، ومجموعة مقارنة، ومقيّم، ونتيجة منشورة بما فيها الإخفاقات) ومؤشر لمعدل التبنّي.",
  "figures": [
   {
    "key": "projects",
    "value": 400,
    "unit": "count",
    "label_en": "Pilot and research projects",
    "label_ar": "المشاريع التجريبية والبحثية",
    "quote_en": "400"
   },
   {
    "key": "adoption_rate",
    "value": 78,
    "unit": "pct",
    "label_en": "Completed projects reporting adoption, expansion or more investment",
    "label_ar": "المشاريع المكتملة التي أفادت بالتبنّي أو التوسّع أو استثمار إضافي",
    "quote_en": "78",
    "scale_max": 100
   }
  ],
  "feature_ids": [
   "FS56",
   "FS61"
  ],
  "sort": 210
 },
 {
  "id": "UPKEEP",
  "name_en": "Australia National Skills Taxonomy (ASC retired) and Korea NCS",
  "name_ar": "التصنيف الوطني للمهارات في أستراليا (إلغاء ASC) ومعايير الكفاءة الوطنية في كوريا",
  "owner_en": "Jobs and Skills Australia; MOEL Korea",
  "owner_ar": "هيئة الوظائف والمهارات الأسترالية؛ وزارة العمل الكورية",
  "country_en": "Australia / Korea",
  "country_ar": "أستراليا / كوريا",
  "category": "national",
  "year_from": 2024,
  "year_to": 2025,
  "year_kind": "range",
  "urls": [
   "https://www.jobsandskills.gov.au/australian-skills-classification",
   "https://moel.go.kr/english/news/moelNewsDetail.do?idx=3137"
  ],
  "fact_en": "Australia removed its skills classification in Jan 2025 over timeliness and validation; Korea's NCS ties each unit to a module and a qualification but is criticised where delivery never followed.",
  "fact_ar": "ألغت أستراليا تصنيفها للمهارات في يناير 2025 بسبب ضعف التحديث والتحقق؛ وتربط معايير الكفاءة الكورية كل وحدة بوحدة تدريبية ومؤهل، لكنها تُنتقد حيث لم يتبعها تنفيذ.",
  "borrow_en": "Review dates and staleness flags, skills derived from artefacts already maintained, and an annual orphan-rate audit.",
  "borrow_ar": "تواريخ مراجعة وإشارات تقادم، ومهارات مشتقة من أصول تُصان أصلاً، وتدقيق سنوي لنسبة المهارات اليتيمة.",
  "figures": [],
  "feature_ids": [
   "FS30",
   "FS54",
   "FS57"
  ],
  "sort": 220
 },
 {
  "id": "JAHIZ",
  "name_en": "Jahiz federal future-skills platform",
  "name_ar": "منصة جاهز الاتحادية لمهارات المستقبل",
  "owner_en": "UAE Government Development and the Future Office + FAHR",
  "owner_ar": "مكتب التطوير الحكومي والمستقبل والهيئة الاتحادية للموارد البشرية الحكومية",
  "country_en": "UAE",
  "country_ar": "الإمارات العربية المتحدة",
  "category": "uae",
  "year_from": 2022,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://wam.ae/en/details/1395303102696",
   "https://u.ae/en/information-and-services/jobs/training-and-development/Strategies-for-improving-digital-skills-and-eGovernment-literacy"
  ],
  "fact_en": "20 future skills in four groups (Digital, 10X, Data and AI, New Economy); badges build a Future Skills Wallet linked to performance management.",
  "fact_ar": "20 مهارة مستقبلية في أربع مجموعات (الرقمية، و10X، والبيانات والذكاء الاصطناعي، والاقتصاد الجديد)؛ والشارات تبني محفظة مهارات المستقبل المرتبطة بإدارة الأداء.",
  "borrow_en": "The four-group structure plus a nuclear fifth group, a wallet tied to the development plan, and a dated whole-workforce target.",
  "borrow_ar": "هيكل المجموعات الأربع مع مجموعة نووية خامسة، ومحفظة مرتبطة بخطة التطوير، وهدف مؤرّخ لكامل القوى العاملة.",
  "figures": [
   {
    "key": "future_skills",
    "value": 20,
    "unit": "count",
    "label_en": "Future skills",
    "label_ar": "مهارات المستقبل",
    "quote_en": "20"
   },
   {
    "key": "groups",
    "value": 4,
    "unit": "count",
    "label_en": "Groups",
    "label_ar": "المجموعات",
    "quote_en": "four"
   }
  ],
  "feature_ids": [
   "FS02",
   "FS31",
   "FS41",
   "FS62",
   "FS74"
  ],
  "sort": 230
 },
 {
  "id": "UAE-NQF",
  "name_en": "UAE National Qualifications Framework and NQC work-experience recognition",
  "name_ar": "الإطار الوطني للمؤهلات في الإمارات والاعتراف بالخبرة العملية لدى المركز الوطني للمؤهلات",
  "owner_en": "National Qualifications Centre (MoHESR)",
  "owner_ar": "المركز الوطني للمؤهلات (وزارة التعليم العالي والبحث العلمي)",
  "country_en": "UAE",
  "country_ar": "الإمارات العربية المتحدة",
  "category": "uae",
  "year_from": 2024,
  "year_to": 2026,
  "year_kind": "editions",
  "urls": [
   "https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses",
   "https://uaelegislation.gov.ae/en/legislations/2615/download"
  ],
  "fact_en": "The 2024 Cabinet Resolution defines RPL; in July 2026 the NQC sought private-sector pilots for a framework that converts work experience into academic hours or vocational qualifications.",
  "fact_ar": "يعرّف قرار مجلس الوزراء لعام 2024 الاعتراف بالتعلم السابق؛ وفي يوليو 2026 دعا المركز الوطني للمؤهلات القطاع الخاص إلى تجارب لإطار يحوّل الخبرة العملية إلى ساعات أكاديمية أو مؤهلات مهنية.",
  "borrow_en": "An NQF level on every credential and learning asset, an RPL package NQC-recognised assessors can review, and ENEC as a pilot employer.",
  "borrow_ar": "مستوى في الإطار الوطني على كل اعتماد وأصل تعلّمي، وحزمة اعتراف بالتعلم السابق يراجعها مقيّمون معترف بهم، والمؤسسة جهة عمل تجريبية.",
  "figures": [],
  "feature_ids": [
   "FS24",
   "FS29",
   "FS30",
   "FS66"
  ],
  "sort": 240
 },
 {
  "id": "MOHRE",
  "name_en": "MoHRE occupational classification and skill levels",
  "name_ar": "التصنيف المهني ومستويات المهارة لدى وزارة الموارد البشرية والتوطين",
  "owner_en": "Ministry of Human Resources and Emiratisation",
  "owner_ar": "وزارة الموارد البشرية والتوطين",
  "country_en": "UAE",
  "country_ar": "الإمارات العربية المتحدة",
  "category": "uae",
  "year_from": 2026,
  "year_to": null,
  "year_kind": "current",
  "urls": [
   "https://www.khaleejtimes.com/uae/government/uae-ministry-launches-new-job-classification-scheme",
   "https://gulfnews.com/uae/government/uae-workforce-jumps-124-in-2025-as-new-firms-surge-mohre-says-1.500416665"
  ],
  "fact_en": "725 occupational categories in nine occupational levels and five skill levels, ISCO-aligned.",
  "fact_ar": "725 فئة مهنية في تسعة مستويات مهنية وخمسة مستويات مهارة، متوافقة مع التصنيف الدولي ISCO.",
  "borrow_en": "An occupation code and national skill level on every role, and a skill-level uplift metric.",
  "borrow_ar": "رمز مهنة ومستوى مهارة وطني على كل دور، ومقياس لرفع مستوى المهارة.",
  "figures": [
   {
    "key": "occupational_categories",
    "value": 725,
    "unit": "count",
    "label_en": "Occupational categories",
    "label_ar": "الفئات المهنية",
    "quote_en": "725"
   },
   {
    "key": "skill_levels",
    "value": 5,
    "unit": "count",
    "label_en": "Skill levels",
    "label_ar": "مستويات المهارة",
    "quote_en": "five"
   }
  ],
  "feature_ids": [
   "FS63"
  ],
  "sort": 250
 },
 {
  "id": "NAFIS",
  "name_en": "Nafis and the Emirati Talent Competitiveness Council",
  "name_ar": "برنامج نافس ومجلس تنافسية الكوادر الإماراتية",
  "owner_en": "ETCC + MoHRE",
  "owner_ar": "مجلس تنافسية الكوادر الإماراتية ووزارة الموارد البشرية والتوطين",
  "country_en": "UAE",
  "country_ar": "الإمارات العربية المتحدة",
  "category": "uae",
  "year_from": 2026,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.wam.ae/en/article/c1betlp-emiratisation-agenda-advances-with-leadership",
   "https://www.zawya.com/en/press-release/events-and-conferences/uaes-emiratisation-drive-enters-a-new-outcomes-era-eiojkgck"
  ],
  "fact_en": "Emiratisation has moved to an \"outcomes era\": retention and progression rather than placement counts.",
  "fact_ar": "انتقل التوطين إلى \"مرحلة النتائج\": الاستبقاء والتقدّم بدلاً من أعداد التعيين.",
  "borrow_en": "Emirati readiness by competency for critical and future roles, plus retention at 12/24/36 months.",
  "borrow_ar": "جاهزية الكوادر الإماراتية حسب الكفاءة للأدوار الحرجة والمستقبلية، مع الاستبقاء عند 12 و24 و36 شهراً.",
  "figures": [],
  "feature_ids": [
   "FS62",
   "FS73"
  ],
  "sort": 260
 },
 {
  "id": "UAE-AI",
  "name_en": "UAE National AI Strategy 2031 and Abu Dhabi DGE AiNative",
  "name_ar": "الاستراتيجية الوطنية للذكاء الاصطناعي 2031 وبرنامج AiNative لدائرة التمكين الحكومي في أبوظبي",
  "owner_en": "UAE Government; DGE Abu Dhabi",
  "owner_ar": "حكومة الإمارات؛ دائرة التمكين الحكومي في أبوظبي",
  "country_en": "UAE",
  "country_ar": "الإمارات العربية المتحدة",
  "category": "uae",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www.khaleejtimes.com/abu-dhabi-train-23000-government-employees-ai-by-2027",
   "https://dge.gov.ae/en/what-we-do"
  ],
  "fact_en": "AiNative targets 23,000 Abu Dhabi government employees trained in AI by 2027; a K-12 AI curriculum runs from the 2025-26 school year.",
  "fact_ar": "يستهدف برنامج AiNative تدريب 23,000 موظف حكومي في أبوظبي على الذكاء الاصطناعي بحلول 2027؛ ويبدأ منهج للذكاء الاصطناعي من الروضة حتى الثاني عشر من العام الدراسي 2025-2026.",
  "borrow_en": "A dated AI-capability target, approved-use classes for AI tools, and intake-year baselines for new joiners.",
  "borrow_ar": "هدف مؤرّخ لقدرات الذكاء الاصطناعي، وفئات استخدام معتمدة لأدواته، وخطوط أساس حسب سنة الالتحاق للموظفين الجدد.",
  "figures": [
   {
    "key": "employees_trained_target_2027",
    "value": 23000,
    "unit": "count",
    "label_en": "Government employees to be trained in AI by 2027",
    "label_ar": "الموظفون الحكوميون المستهدف تدريبهم على الذكاء الاصطناعي بحلول 2027",
    "quote_en": "23,000"
   }
  ],
  "feature_ids": [
   "FS09",
   "FS36",
   "FS62",
   "FS74",
   "FS77"
  ],
  "sort": 270
 },
 {
  "id": "IAEA-WFP",
  "name_en": "IAEA NG-T-3.10 Workforce Planning and the Nuclear Infrastructure Competency Framework",
  "name_ar": "وثيقة الوكالة الدولية للطاقة الذرية NG-T-3.10 لتخطيط القوى العاملة وإطار كفاءات البنية التحتية النووية",
  "owner_en": "IAEA",
  "owner_ar": "الوكالة الدولية للطاقة الذرية",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "nuclear_energy",
  "year_from": 2011,
  "year_to": null,
  "year_kind": "reference",
  "urls": [
   "https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1477_web.pdf",
   "https://www.iaea.org/sites/default/files/20/11/nicf.pdf"
  ],
  "fact_en": "Demand, supply, gap and fill-plan by phase, with three-scenario demand curves; NICF links each competency to the activity and phase that needs it.",
  "fact_ar": "الطلب والعرض والفجوة وخطة السدّ حسب المرحلة، مع منحنيات طلب بثلاثة سيناريوهات؛ ويربط إطار كفاءات البنية التحتية كل كفاءة بالنشاط والمرحلة اللذين يحتاجانها.",
  "borrow_en": "Scenario bands rather than point estimates, a fill plan per gap, and a \"why this competency exists\" link to its activity.",
  "borrow_ar": "نطاقات سيناريوهات بدلاً من تقديرات نقطية، وخطة سدّ لكل فجوة، ورابط \"لماذا توجد هذه الكفاءة\" إلى نشاطها.",
  "figures": [
   {
    "key": "scenarios",
    "value": 3,
    "unit": "count",
    "label_en": "Demand scenarios",
    "label_ar": "سيناريوهات الطلب",
    "quote_en": "three"
   }
  ],
  "feature_ids": [
   "FS04",
   "FS05",
   "FS13",
   "FS38",
   "FS45",
   "FS50",
   "FS51",
   "FS73",
   "FS84"
  ],
  "sort": 280
 },
 {
  "id": "IAEA-1917",
  "name_en": "IAEA-TECDOC-1917 Assessing Behavioural Competencies in Nuclear Facilities",
  "name_ar": "الوثيقة التقنية IAEA-TECDOC-1917 لتقييم الكفاءات السلوكية في المنشآت النووية",
  "owner_en": "IAEA",
  "owner_ar": "الوكالة الدولية للطاقة الذرية",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "nuclear_energy",
  "year_from": 2020,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf"
  ],
  "fact_en": "Structured interviews, simulation observation, 360 and situational judgement as assessable evidence for behavioural competence.",
  "fact_ar": "المقابلات المنظمة، وملاحظة المحاكاة، وتقييم 360 درجة، والحكم الظرفي أدلةٌ قابلة للتقييم على الكفاءة السلوكية.",
  "borrow_en": "A behavioural track with the same evidence model as technical skills, and situational judgement items for safety behaviours.",
  "borrow_ar": "مسار سلوكي بنموذج الأدلة نفسه للمهارات الفنية، وأسئلة حكم ظرفي لسلوكيات السلامة.",
  "figures": [],
  "feature_ids": [
   "FS23",
   "FS26",
   "FS49",
   "FS58",
   "FS59"
  ],
  "sort": 290
 },
 {
  "id": "IAEA-AI",
  "name_en": "IAEA AI for nuclear energy (\"Atoms for Algorithms\")",
  "name_ar": "الذكاء الاصطناعي للطاقة النووية لدى الوكالة الدولية للطاقة الذرية (\"الذرّات من أجل الخوارزميات\")",
  "owner_en": "IAEA",
  "owner_ar": "الوكالة الدولية للطاقة الذرية",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "nuclear_energy",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence",
   "https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/"
  ],
  "fact_en": "First IAEA AI and nuclear energy symposium (250+ organisations); digital twins and predictive maintenance named as operational uses.",
  "fact_ar": "أول ندوة للوكالة عن الذكاء الاصطناعي والطاقة النووية (أكثر من 250 مؤسسة)؛ وذُكرت التوائم الرقمية والصيانة التنبؤية استخداماتٍ تشغيلية.",
  "borrow_en": "An operational Nuclear + AI skill family: AI output verification and the duty to challenge it, twin validation, anomaly triage.",
  "borrow_ar": "عائلة مهارات تشغيلية تجمع النووي والذكاء الاصطناعي: التحقق من مخرجات الذكاء الاصطناعي وواجب الاعتراض عليها، والتحقق من التوائم، وفرز الحالات الشاذة.",
  "figures": [
   {
    "key": "organisations",
    "value": 250,
    "unit": "count",
    "label_en": "Organisations at the first symposium",
    "label_ar": "المؤسسات المشاركة في الندوة الأولى",
    "quote_en": "250"
   }
  ],
  "feature_ids": [
   "FS14",
   "FS22",
   "FS37",
   "FS40",
   "FS49"
  ],
  "sort": 300
 },
 {
  "id": "OT-CYBER",
  "name_en": "IAEA NSS 42-G computer security and NICE Framework v2.0 OT role",
  "name_ar": "دليل الأمن النووي NSS 42-G لأمن الحاسوب والدور المتعلق بالتقنيات التشغيلية في إطار NICE 2.0",
  "owner_en": "IAEA; NIST/CISA",
  "owner_ar": "الوكالة الدولية للطاقة الذرية؛ NIST وCISA",
  "country_en": "International / US",
  "country_ar": "دولي / الولايات المتحدة",
  "category": "nuclear_energy",
  "year_from": 2021,
  "year_to": 2025,
  "year_kind": "editions",
  "urls": [
   "https://www.iaea.org/node/97473",
   "https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering"
  ],
  "fact_en": "NICE v2.0 adds its first OT work role inside engineering; NICE uses task, knowledge and skill statements with stable IDs.",
  "fact_ar": "يضيف الإصدار 2.0 من إطار NICE أول دور عمل للتقنيات التشغيلية ضمن الهندسة؛ ويستخدم الإطار عبارات مهام ومعارف ومهارات بمعرّفات ثابتة.",
  "borrow_en": "Stable statement IDs, and cyber hygiene for all staff while security roles stay at career-path level only.",
  "borrow_ar": "معرّفات ثابتة للعبارات، والنظافة السيبرانية لكل الموظفين مع بقاء أدوار الأمن على مستوى المسار المهني فقط.",
  "figures": [],
  "feature_ids": [
   "FS08"
  ],
  "sort": 310
 },
 {
  "id": "NEA",
  "name_en": "OECD-NEA NEST Framework and Plan 2035",
  "name_ar": "إطار NEST وخطة 2035 لوكالة الطاقة النووية",
  "owner_en": "OECD Nuclear Energy Agency",
  "owner_ar": "وكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية",
  "country_en": "International (15 countries in NEST)",
  "country_ar": "دولي (15 دولة في NEST)",
  "category": "nuclear_energy",
  "year_from": 2024,
  "year_to": 2025,
  "year_kind": "range",
  "urls": [
   "https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf",
   "https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development"
  ],
  "fact_en": "215+ NEST Fellows learn inside real multinational projects; Plan 2035 runs Inspire, Mentor and Network lanes with an expert video-lecture library.",
  "fact_ar": "أكثر من 215 زميلاً في NEST يتعلمون داخل مشاريع متعددة الجنسيات حقيقية؛ وتدير خطة 2035 مسارات الإلهام والإرشاد والتواصل مع مكتبة محاضرات مرئية للخبراء.",
  "borrow_en": "Fellowships inside real projects, an expert lecture library that doubles as knowledge capture, and a Future Leaders track.",
  "borrow_ar": "زمالات داخل مشاريع حقيقية، ومكتبة محاضرات للخبراء تعمل أيضاً على حفظ المعرفة، ومسار لقادة المستقبل.",
  "figures": [
   {
    "key": "fellows",
    "value": 215,
    "unit": "count",
    "label_en": "NEST Fellows",
    "label_ar": "زملاء NEST",
    "quote_en": "215"
   }
  ],
  "feature_ids": [
   "FS13",
   "FS14",
   "FS18",
   "FS27",
   "FS28",
   "FS39",
   "FS42",
   "FS44",
   "FS46",
   "FS47",
   "FS67",
   "FS77"
  ],
  "sort": 320
 },
 {
  "id": "UK-NUC",
  "name_en": "UK Nuclear Skills Strategic Plan, Destination Nuclear and nuclear skills passports",
  "name_ar": "الخطة الاستراتيجية للمهارات النووية في المملكة المتحدة وبرنامج Destination Nuclear وجوازات المهارات النووية",
  "owner_en": "UK Government and industry; Sellafield with Digital Catapult",
  "owner_ar": "حكومة المملكة المتحدة والقطاع؛ Sellafield مع Digital Catapult",
  "country_en": "United Kingdom",
  "country_ar": "المملكة المتحدة",
  "category": "nuclear_energy",
  "year_from": 2022,
  "year_to": 2024,
  "year_kind": "editions",
  "urls": [
   "https://world-nuclear-news.org/articles/uk-sets-out-plan-for-boosting-nuclear-workforce",
   "https://www.digicatapult.org.uk/wp-content/uploads/2022/07/Digital_Catapult_Sellafield_DLT_Field_Labs_Report_Final-July-22-ver-2.pdf"
  ],
  "fact_en": "40,000 new jobs by 2030; Destination Nuclear targets career-changers; the Sellafield passport trial used wallets with selective disclosure.",
  "fact_ar": "40,000 وظيفة جديدة بحلول 2030؛ ويستهدف Destination Nuclear المنتقلين من مسارات مهنية أخرى؛ واستخدمت تجربة جواز Sellafield محافظ رقمية بإفصاح انتقائي.",
  "borrow_en": "A transferable-skills translator for career-changers, sector target tracking, and selectively disclosable passports.",
  "borrow_ar": "مترجم للمهارات القابلة للنقل للمنتقلين مهنياً، ومتابعة أهداف القطاع، وجوازات قابلة للإفصاح الانتقائي.",
  "figures": [
   {
    "key": "new_jobs_2030",
    "value": 40000,
    "unit": "count",
    "label_en": "New nuclear jobs by 2030",
    "label_ar": "وظائف نووية جديدة بحلول 2030",
    "quote_en": "40,000"
   }
  ],
  "feature_ids": [
   "FS29",
   "FS32",
   "FS34",
   "FS68",
   "FS69",
   "FS77"
  ],
  "sort": 330
 },
 {
  "id": "SMR-WF",
  "name_en": "New-build and SMR workforce models (Canada BWRX-300, NuScale E2, France MATCH)",
  "name_ar": "نماذج القوى العاملة للمحطات الجديدة والمفاعلات الصغيرة (BWRX-300 في كندا وNuScale E2 وبرنامج MATCH في فرنسا)",
  "owner_en": "OPG, GE Vernova Hitachi, Sask Polytech, NuScale, GIFEN",
  "owner_ar": "OPG وGE Vernova Hitachi وSask Polytech وNuScale وGIFEN",
  "country_en": "Canada / US / France",
  "country_ar": "كندا / الولايات المتحدة / فرنسا",
  "category": "nuclear_energy",
  "year_from": 2023,
  "year_to": 2025,
  "year_kind": "range",
  "urls": [
   "https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/",
   "https://engineering.oregonstate.edu/facilities/energy-exploration-e2-center",
   "https://www.nucleareurope.eu/blog/highlight-of-the-month/match-program-a-tool-for-nuclear-capacity-building-in-france/"
  ],
  "fact_en": "Short cross-over nuclear courses for adjacent industries (Sask Polytech with NSAN); simulated SMR control rooms on campuses; MATCH refreshes job-by-job demand every year (about 100,000 hires 2023-2033).",
  "fact_ar": "دورات نووية قصيرة للعبور من الصناعات المجاورة (Sask Polytech مع NSAN)؛ وغرف تحكم محاكاة لمفاعلات صغيرة في الحرم الجامعية؛ ويحدّث MATCH الطلب وظيفةً بوظيفة كل عام (نحو 100,000 تعيين بين 2023 و2033).",
  "borrow_en": "An SMR delta per existing role, cross-over courses, plant-literacy simulation for non-operators, and an annual job-by-job refresh.",
  "borrow_ar": "فرق المفاعلات الصغيرة لكل دور قائم، ودورات عبور، ومحاكاة للإلمام بالمحطة لغير المشغّلين، وتحديث سنوي وظيفةً بوظيفة.",
  "figures": [
   {
    "key": "hires_2023_2033",
    "value": 100000,
    "unit": "count",
    "label_en": "Hires in France 2023-2033 (MATCH)",
    "label_ar": "التعيينات في فرنسا 2023-2033 (MATCH)",
    "quote_en": "100,000"
   }
  ],
  "feature_ids": [
   "FS13",
   "FS14",
   "FS19",
   "FS28",
   "FS34",
   "FS38",
   "FS39",
   "FS40",
   "FS51",
   "FS68"
  ],
  "sort": 340
 },
 {
  "id": "NUC-NET",
  "name_en": "Nuclear education networks: ENEN2plus, Nordic NNTP, IAEA MSCFP and INMA, KINGS",
  "name_ar": "شبكات التعليم النووي: ENEN2plus وبرنامج NNTP الشمالي وزمالة MSCFP وINMA لدى الوكالة وKINGS",
  "owner_en": "ENEN; Fortum/TVO/Uniper/Vattenfall; IAEA; KEPCO",
  "owner_ar": "ENEN؛ Fortum وTVO وUniper وVattenfall؛ الوكالة الدولية للطاقة الذرية؛ KEPCO",
  "country_en": "EU / Nordics / International / Korea",
  "country_ar": "الاتحاد الأوروبي / دول الشمال / دولي / كوريا",
  "category": "nuclear_energy",
  "year_from": 2019,
  "year_to": 2026,
  "year_kind": "range",
  "urls": [
   "https://cordis.europa.eu/project/id/101061677",
   "https://www.fortum.com/careers/NNTP",
   "https://www.iaea.org/node/136445",
   "https://www.iaea.org/node/17745"
  ],
  "fact_en": "Bi-monthly mobility grants paid to learners; a trainee cohort run by four competing operators; study funding paired with placements; endorsed nuclear-management master's programmes.",
  "fact_ar": "منح تنقّل كل شهرين تُدفع للمتعلمين؛ ودفعة متدربين يديرها أربعة مشغّلين متنافسين؛ وتمويل للدراسة مقترن بالتدريب الميداني؛ وبرامج ماجستير معتمدة في الإدارة النووية.",
  "borrow_en": "Rolling micro-grants, multi-employer cohorts (modules + project + mentor), sponsored study with placement, and a nuclear-management competency model.",
  "borrow_ar": "منح صغيرة متجددة، ودفعات متعددة الجهات (وحدات + مشروع + مرشد)، ودراسة مموّلة مع تدريب ميداني، ونموذج كفاءات للإدارة النووية.",
  "figures": [
   {
    "key": "operators_in_cohort",
    "value": 4,
    "unit": "count",
    "label_en": "Operators running one trainee cohort",
    "label_ar": "المشغّلون الذين يديرون دفعة متدربين واحدة",
    "quote_en": "four"
   }
  ],
  "feature_ids": [
   "FS18",
   "FS20",
   "FS28",
   "FS45",
   "FS47",
   "FS48",
   "FS66",
   "FS67",
   "FS82",
   "FS83"
  ],
  "sort": 350
 },
 {
  "id": "ENERGY-JOBS",
  "name_en": "IEA World Energy Employment 2025 and IRENA/ILO Renewable Energy and Jobs 2025",
  "name_ar": "تقرير التوظيف العالمي في قطاع الطاقة 2025 لوكالة الطاقة الدولية وتقرير الطاقة المتجددة والوظائف 2025 لآيرينا ومنظمة العمل الدولية",
  "owner_en": "IEA; IRENA with ILO",
  "owner_ar": "وكالة الطاقة الدولية؛ آيرينا مع منظمة العمل الدولية",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "nuclear_energy",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025",
   "https://build-up.ec.europa.eu/en/resources-and-tools/publications/annual-review-2025-renewable-energy-and-jobs"
  ],
  "fact_en": "76 million energy jobs in 2024; 60% of surveyed firms report shortages, worst for plant operators and nuclear specialists; renewable job growth slowed partly due to automation.",
  "fact_ar": "76 مليون وظيفة في الطاقة في 2024؛ و60% من الشركات المشمولة أفادت بنقص، وأشدّه في مشغّلي المحطات والمتخصصين النوويين؛ وتباطأ نمو وظائف الطاقة المتجددة جزئياً بسبب الأتمتة.",
  "borrow_en": "External shortage lines beside internal numbers, an automation factor in demand, and a public skills-pledge mechanic.",
  "borrow_ar": "خطوط نقص خارجية بجانب الأرقام الداخلية، وعامل أتمتة في الطلب، وآلية تعهدات علنية بالمهارات.",
  "figures": [
   {
    "key": "energy_jobs_2024",
    "value": 76000000,
    "unit": "count",
    "label_en": "Energy jobs worldwide (2024)",
    "label_ar": "وظائف الطاقة في العالم (2024)",
    "quote_en": "76 million"
   },
   {
    "key": "firms_reporting_shortages",
    "value": 60,
    "unit": "pct",
    "label_en": "Surveyed firms reporting shortages",
    "label_ar": "الشركات المشمولة التي أفادت بنقص",
    "quote_en": "60",
    "scale_max": 100
   }
  ],
  "feature_ids": [
   "FS12",
   "FS14",
   "FS42",
   "FS43",
   "FS48",
   "FS52",
   "FS53",
   "FS65"
  ],
  "sort": 360
 },
 {
  "id": "AI-LIT",
  "name_en": "EU AI Act Article 4 AI-literacy repository and UNESCO AI Competency Frameworks",
  "name_ar": "مستودع ممارسات الإلمام بالذكاء الاصطناعي وفق المادة 4 من قانون الذكاء الاصطناعي الأوروبي وأطر كفاءات الذكاء الاصطناعي لليونسكو",
  "owner_en": "European Commission AI Office; UNESCO",
  "owner_ar": "مكتب الذكاء الاصطناعي في المفوضية الأوروبية؛ اليونسكو",
  "country_en": "EU / International",
  "country_ar": "الاتحاد الأوروبي / دولي",
  "category": "ai",
  "year_from": 2024,
  "year_to": 2026,
  "year_kind": "range",
  "urls": [
   "https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices",
   "https://gcedclearinghouse.org/en/node/146447"
  ],
  "fact_en": "Article 4 applies from 2 Feb 2025; the repository labels practices planned, partially rolled out or fully implemented and separates providers from deployers; UNESCO uses 4 dimensions at Understand, Apply, Create.",
  "fact_ar": "تسري المادة 4 من 2 فبراير 2025؛ ويصنّف المستودع الممارسات إلى مخططة أو مطبقة جزئياً أو مطبقة كلياً ويفصل المزوّدين عن المستخدِمين؛ وتستخدم اليونسكو 4 أبعاد بمستويات الفهم والتطبيق والإبداع.",
  "borrow_en": "An AI-literacy register per AI system, provider vs deployer literacy, maturity labels, and a 4-dimension AI competency grid.",
  "borrow_ar": "سجل للإلمام بالذكاء الاصطناعي لكل نظام، والتمييز بين إلمام المزوّد والمستخدِم، ووسوم النضج، وشبكة كفاءات للذكاء الاصطناعي بأربعة أبعاد.",
  "figures": [
   {
    "key": "unesco_dimensions",
    "value": 4,
    "unit": "count",
    "label_en": "UNESCO AI competency dimensions",
    "label_ar": "أبعاد كفاءات الذكاء الاصطناعي لدى اليونسكو",
    "quote_en": "4"
   }
  ],
  "feature_ids": [
   "FS09",
   "FS36",
   "FS37",
   "FS49",
   "FS55",
   "FS76",
   "FS80"
  ],
  "sort": 370
 },
 {
  "id": "UAE-PEERS",
  "name_en": "ADNOC AI upskilling and EGA Academy",
  "name_ar": "تأهيل أدنوك في الذكاء الاصطناعي وأكاديمية الإمارات العالمية للألمنيوم",
  "owner_en": "ADNOC; Emirates Global Aluminium",
  "owner_ar": "أدنوك؛ الإمارات العالمية للألمنيوم",
  "country_en": "UAE",
  "country_ar": "الإمارات العربية المتحدة",
  "category": "corporate",
  "year_from": 2025,
  "year_to": null,
  "year_kind": "single",
  "urls": [
   "https://reports.adnoc.ae/e/sustainability-report-2025/eJFjvFKd42",
   "https://www.wam.ae/en/article/blmzwis-ega-launches-ega-academy"
  ],
  "fact_en": "40,000+ ADNOC staff trained on AI fundamentals; an agentic-AI course with 18,000+ participants produced 10,000+ agents; EGA runs 12-month national trainee cohorts with a role on completion.",
  "fact_ar": "أكثر من 40,000 موظف في أدنوك تدرّبوا على أساسيات الذكاء الاصطناعي؛ وأنتجت دورة في الذكاء الاصطناعي الوكيلي بأكثر من 18,000 مشارك أكثر من 10,000 وكيل؛ وتدير الإمارات العالمية للألمنيوم دفعات متدربين وطنية لمدة 12 شهراً مع وظيفة عند الإكمال.",
  "borrow_en": "AI learning whose output is a built artefact, AI-fundamentals coverage as a board KPI, and national trainee cohorts.",
  "borrow_ar": "تعلّم للذكاء الاصطناعي يكون ناتجه أداة مبنية، وتغطية أساسيات الذكاء الاصطناعي مؤشراً لمجلس الإدارة، ودفعات متدربين وطنية.",
  "figures": [
   {
    "key": "staff_trained_ai",
    "value": 40000,
    "unit": "count",
    "label_en": "ADNOC staff trained on AI fundamentals",
    "label_ar": "موظفو أدنوك المدرَّبون على أساسيات الذكاء الاصطناعي",
    "quote_en": "40,000"
   },
   {
    "key": "agents_built",
    "value": 10000,
    "unit": "count",
    "label_en": "Agents built in the agentic-AI course",
    "label_ar": "الوكلاء المبنيون في دورة الذكاء الاصطناعي الوكيلي",
    "quote_en": "10,000"
   }
  ],
  "feature_ids": [
   "FS19",
   "FS20",
   "FS37",
   "FS60",
   "FS74",
   "FS80",
   "FS83"
  ],
  "sort": 380
 },
 {
  "id": "CORP",
  "name_en": "Corporate reskilling programmes: AT&T, IBM, Schneider/Unilever, Google AI Essentials",
  "name_ar": "برامج إعادة التأهيل في الشركات: AT&T وIBM وSchneider/Unilever وGoogle AI Essentials",
  "owner_en": "AT&T; IBM; Schneider Electric; Unilever; Google",
  "owner_ar": "AT&T؛ IBM؛ Schneider Electric؛ Unilever؛ Google",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "corporate",
  "year_from": 2014,
  "year_to": 2025,
  "year_kind": "range",
  "urls": [
   "https://www.chieflearningofficer.com/2019/06/18/a-fixed-gaze-toward-the-future/",
   "https://workofthefuture-taskforce.mit.edu/document/2020-working-paper-qi-kochan",
   "https://gloat.com/wp-content/uploads/Schneider-Electric-Gloat-Case-Study.pdf",
   "https://services.google.com/fh/files/misc/new_google_career_certificates_impact_report.pdf"
  ],
  "fact_en": "AT&T told staff which roles were shrinking and how to reach growing ones; IBM linked strategic-skill badges to performance and promotion; marketplaces made projects, roles and mentoring one feed; Google keeps market statistics apart from measured outcomes.",
  "fact_ar": "أخبرت AT&T موظفيها بالأدوار المتقلصة وكيف يصلون إلى الأدوار النامية؛ وربطت IBM شارات المهارات الاستراتيجية بالأداء والترقية؛ وجعلت الأسواق الداخلية المشاريع والأدوار والإرشاد في موجز واحد؛ وتفصل Google إحصاءات السوق عن النتائج المقيسة.",
  "borrow_en": "Honest role decline signals, a strategic badge tier with consequences, a time envelope for gigs, and market data separated from outcomes.",
  "borrow_ar": "إشارات صادقة عن تراجع الأدوار، وفئة شارات استراتيجية لها عواقب، وإطار زمني للمهام القصيرة، وفصل بيانات السوق عن النتائج.",
  "figures": [],
  "feature_ids": [
   "FS11",
   "FS15",
   "FS16",
   "FS17",
   "FS27",
   "FS31",
   "FS53",
   "FS75",
   "FS79",
   "FS81"
  ],
  "sort": 390
 },
 {
  "id": "SKILLS-TECH",
  "name_en": "Skills-platform mechanics: Workday/TechWolf, Degreed, Workera, Pluralsight, Credly, AI role-play",
  "name_ar": "آليات منصات المهارات: Workday/TechWolf وDegreed وWorkera وPluralsight وCredly ولعب الأدوار بالذكاء الاصطناعي",
  "owner_en": "Vendors",
  "owner_ar": "مزوّدو المنصات",
  "country_en": "International",
  "country_ar": "دولي",
  "category": "corporate",
  "year_from": 2024,
  "year_to": 2026,
  "year_kind": "range",
  "urls": [
   "https://www.techwolf.ai/customer-stories/workday",
   "https://degreed.com/experience/blog/degreed-peer-ratings-your-360-degree-view-of-skills/",
   "https://workera.ai/skills-intelligence-platform",
   "https://training.talent.linkedin.com/introducing-role-play-with-ai-coach"
  ],
  "fact_en": "Explicit vs inferred skills with confirm or remove; multi-source ratings; adaptive tests reach an estimate in about 20 items; role-play practice in 5-10 minutes (LinkedIn does not save the feedback).",
  "fact_ar": "مهارات صريحة مقابل مستنتجة مع التأكيد أو الإزالة؛ وتقييمات متعددة المصادر؛ واختبارات تكيّفية تصل إلى تقدير في نحو 20 سؤالاً؛ وتدريب على لعب الأدوار في 5 إلى 10 دقائق (لا تحفظ LinkedIn الملاحظات).",
  "borrow_en": "Inferred-skill suggestions the person confirms, multi-source proficiency, adaptive assessment, and role-play practice with saved feedback.",
  "borrow_ar": "اقتراحات مهارات مستنتجة يؤكدها الشخص، وإتقان متعدد المصادر، وتقييم تكيّفي، وتدريب على لعب الأدوار مع حفظ الملاحظات.",
  "figures": [
   {
    "key": "adaptive_items",
    "value": 20,
    "unit": "count",
    "label_en": "Items an adaptive test needs for an estimate",
    "label_ar": "الأسئلة التي يحتاجها الاختبار التكيّفي للوصول إلى تقدير",
    "quote_en": "20"
   }
  ],
  "feature_ids": [
   "FS03",
   "FS10",
   "FS21",
   "FS22",
   "FS33",
   "FS44",
   "FS55",
   "FS56",
   "FS59",
   "FS72",
   "FS79"
  ],
  "sort": 400
 }
];

export default function build(T) {
  T.benchmarks = BENCHMARKS.map((b) => ({ ...b, as_of: AS_OF, status: 'published', listed: true, updated_at: `${AS_OF}T00:00:00Z`, updated_by: null }));
}
