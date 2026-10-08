// G5 seed extension (M08, M12, M13, M14, M16). Appends rows to tables G5 owns, after the foundation builders ran.
// Public facts and news items cite public sources only (research notes behind KAFAA-SPEC-001 Section 17).
// All people stay synthetic; no concern text is ever seeded (concern_cases holds metadata only).
import { src, srcs } from './sources.mjs';

const ASOF = '2026-10-08';
const ts = (d, h = 8) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

/** Extra public sources used by G5 pages (added to kafaa_sources). */
export const G5_SOURCES = [
  ['enec-rebrand', 'ENEC · New brand identity (Nov 2024)', 'https://www.enec.ae/en/news/latest-news/enec-unveils-new-brand-identity-signaling-a-new-era-of-clean-energy-leadership/', 'ENEC'],
  ['admo-consulting', 'Abu Dhabi Media Office · ENEC launches ENEC Consulting (Jan 2025)', 'https://www.mediaoffice.abudhabi/en/energy/emirates-nuclear-energy-company-launches-enec-consulting-to-support-new-civil-nuclear-energy-projects-globally/', 'ADMO'],
  ['admo-full-fleet', 'Abu Dhabi Media Office · Barakah completes first year of full-fleet operations (Sep 2025)', 'https://www.mediaoffice.abudhabi/en/energy/led-by-emirates-nuclear-energy-company-barakah-nuclear-energy-plant-completes-first-year-of-full-fleet-operations/', 'ADMO'],
  ['enec-lessons', 'ENEC · Lessons learned from the nuclear industry', 'https://www.enec.ae/barakah-plant/lessons-learned-from-nuclear-industry/', 'ENEC'],
  ['enec-energy-pioneers-2014', 'ENEC · 46 Energy Pioneers celebrate graduation (2014)', 'https://enec.ae/news/latest-news/46-enec-energy-pioneers-celebrate-graduation/', 'ENEC'],
];
const g5src = (id) => {
  const s = G5_SOURCES.find((x) => x[0] === id);
  return s ? { id: s[0], label: s[1], url: s[2] } : src(id);
};
const g5srcs = (...ids) => ids.map(g5src);

function news(slug, published_on, topic, title_en, title_ar, summary_en, summary_ar, body_en, body_ar, sids) {
  return {
    id: `news-${slug}`, slug: `news/${slug}`, zone: 'public', module: 'M12', title_en, title_ar, body_en, body_ar, sources: g5srcs(...sids), as_of: ASOF,
    review_on: '2027-04-08', status: 'published', is_published: true, translation_status: 'both_approved', owner_role: 'Editor', ecp_owned: false,
    kind: 'news', published_on, summary_en, summary_ar, topic, updated_by: null, updated_at: ts(ASOF), no_factual_claims: false,
  };
}

export function buildNews() {
  return [
    news('dnt-first-cohort', '2026-06-17', 'talent', 'First national cohort graduates from the Diploma in Nuclear Technology', 'تخرّج أول دفعة وطنية من دبلوم التكنولوجيا النووية',
      'Twenty UAE nationals completed the 24-month DNT, a route to Local Operator or Maintenance Technician roles.', 'أكمل عشرون مواطناً دبلوم التكنولوجيا النووية الذي يمتد 24 شهراً، وهو مسار إلى وظائف المشغّل المحلي أو فني الصيانة.',
      'ENEC celebrated the graduation of the first national cohort of the Diploma in Nuclear Technology on 17 June 2026. The 24-month vocational programme for UAE high-school graduates leads to Local Operator or Maintenance Technician roles and carries a monthly stipend. Sources differ on the start year and cohort size; Kafa\'a shows both on the programme page.',
      'احتفلت ENEC في 17 يونيو 2026 بتخرج أول دفعة وطنية من دبلوم التكنولوجيا النووية. البرنامج المهني الذي يمتد 24 شهراً موجّه لخريجي الثانوية من المواطنين ويقود إلى وظائف المشغّل المحلي أو فني الصيانة مع مكافأة شهرية. تختلف المصادر حول سنة البدء وحجم الدفعة، وتعرض كفاءة الروايتين في صفحة البرنامج.',
      ['enec-dnt-grad', 'enec-dnt-launch']),
    news('mawaheb-agreement', '2026-05-06', 'talent', 'ENEC and DGE agree to qualify at least 100 UAE nationals for nuclear roles', 'اتفاقية بين ENEC ودائرة التمكين الحكومي لتأهيل 100 مواطن على الأقل لأدوار نووية',
      'A five-year agreement covers high-school, diploma and postgraduate entrants; ENEC funds training and stipends.', 'تشمل الاتفاقية الممتدة خمس سنوات خريجي الثانوية والدبلوم والدراسات العليا، وتموّل ENEC التدريب والمكافآت.',
      'The Mawaheb agreement with the Department of Government Enablement, Abu Dhabi, runs for five years and aims to qualify at least 100 UAE nationals for nuclear-sector roles. Reported signing dates differ between sources (6 May per ENEC, later dates in other outlets).',
      'تمتد اتفاقية "مواهب" مع دائرة التمكين الحكومي في أبوظبي خمس سنوات وتهدف إلى تأهيل ما لا يقل عن 100 مواطن لأدوار في القطاع النووي. تختلف تواريخ التوقيع المذكورة بين المصادر (6 مايو بحسب ENEC وتواريخ لاحقة في منافذ أخرى).',
      ['enec-dge', 'wnn-dge']),
    news('ip-mou', '2026-05-20', 'research', 'Intellectual property route agreed with the Ministry of Economy and Tourism', 'مسار للملكية الفكرية بالتعاون مع وزارة الاقتصاد والسياحة',
      'Inventions from research collaborations have an agreed patents route.', 'أصبح للاختراعات الناتجة عن التعاون البحثي مسار متفق عليه لتسجيل براءات الاختراع.',
      'ENEC and the UAE Ministry of Economy and Tourism signed a memorandum on protecting intellectual property. Kafa\'a\'s research portal refers inventions to this route after security and export-control screening.',
      'وقّعت ENEC ووزارة الاقتصاد والسياحة مذكرة تفاهم لحماية الملكية الفكرية. وتحيل بوابة البحث في كفاءة الاختراعات إلى هذا المسار بعد فحص الحساسية الأمنية ورقابة الصادرات.',
      ['enec-moet']),
    news('maan-community-centre', '2026-02-10', 'community', 'Community centre agreement with Ma\'an for Al Dhafra', 'اتفاقية مركز مجتمعي مع "معاً" في الظفرة',
      'ENEC and the Authority of Social Contribution (Ma\'an) signed a collaboration agreement.', 'وقّعت ENEC وهيئة المساهمات المجتمعية "معاً" اتفاقية تعاون.',
      'The February 2026 agreement with Ma\'an supports a community centre in the Al Dhafra Region, adding to ENEC\'s forums in Al Dhanna and the Tamouh Al Dhafra career fair.',
      'تدعم اتفاقية فبراير 2026 مع "معاً" مركزاً مجتمعياً في منطقة الظفرة، إضافة إلى منتديات ENEC في الظنة ومعرض "طموح الظفرة" للتوظيف.',
      ['enec-maan', 'enec-dhafra']),
    news('src-giems-mou', '2026-01-16', 'research', 'Research and capacity-building MoU with the Saskatchewan Research Council and GIEMS', 'مذكرة تفاهم للبحث وبناء القدرات مع مجلس أبحاث ساسكاتشوان وGIEMS',
      'The memorandum covers nuclear research and capacity building.', 'تغطي المذكرة البحث النووي وبناء القدرات.',
      'ENEC, the Saskatchewan Research Council and GIEMS signed a memorandum to advance nuclear research and capacity, alongside a government-level MoU between Saskatchewan and the UAE.',
      'وقّعت ENEC ومجلس أبحاث ساسكاتشوان وGIEMS مذكرة تفاهم لتعزيز البحث النووي وبناء القدرات، إلى جانب مذكرة على المستوى الحكومي بين ساسكاتشوان والإمارات.',
      ['enec-src', 'sask-src']),
    news('coral-partnership', '2025-11-20', 'environment', 'EAD and ENEC to cultivate 500,000 corals around Barakah', 'هيئة البيئة وENEC تستزرعان 500,000 مرجانة حول براكة',
      'An environmental partnership with the Environment Agency, Abu Dhabi.', 'شراكة بيئية مع هيئة البيئة - أبوظبي.',
      'The Environment Agency, Abu Dhabi and ENEC announced a partnership in November 2025 to cultivate 500,000 corals in the waters around the Barakah Nuclear Energy Plant.',
      'أعلنت هيئة البيئة - أبوظبي وENEC في نوفمبر 2025 شراكة لاستزراع 500,000 مرجانة في المياه المحيطة بمحطة براكة للطاقة النووية.',
      ['admo-coral']),
    news('kepco-ai-lab', '2025-11-18', 'partners', 'KEPCO and ENEC widen cooperation, including a joint AI Innovation Lab', 'كيبكو وENEC توسّعان التعاون بما في ذلك مختبر مشترك لابتكار الذكاء الاصطناعي',
      'The MoU covers SMRs, fuel-cycle innovation, waste, AI, digital twins and third-country projects.', 'تغطي المذكرة المفاعلات الصغيرة وابتكار دورة الوقود والنفايات والذكاء الاصطناعي والتوائم الرقمية ومشاريع الدول الثالثة.',
      'At the UAE-Korea summit in November 2025, KEPCO and ENEC signed a memorandum covering small modular reactors, fuel-cycle innovation, waste, artificial intelligence, digital twins, a joint AI Innovation Lab and projects in third countries.',
      'وقّعت كيبكو وENEC خلال القمة الإماراتية الكورية في نوفمبر 2025 مذكرة تشمل المفاعلات المعيارية الصغيرة وابتكار دورة الوقود والنفايات والذكاء الاصطناعي والتوائم الرقمية ومختبراً مشتركاً لابتكار الذكاء الاصطناعي ومشاريع في دول ثالثة.',
      ['wnn-kepco-2025']),
    news('eneciq', '2025-10-15', 'technology', 'ENECIQ: an AI platform co-developed with Presight', 'ENECIQ: منصة ذكاء اصطناعي بالتعاون مع Presight',
      'ENEC and Presight are co-developing ENECIQ for efficiency and knowledge sharing.', 'تطوّر ENEC وPresight منصة ENECIQ لتعزيز الكفاءة وتبادل المعرفة.',
      'ENEC and Presight announced the co-development of ENECIQ, an AI platform intended to improve efficiency and knowledge sharing across the organisation. Kafa\'a\'s Dalil is a separate concept with its own governance.',
      'أعلنت ENEC وPresight تطوير منصة ENECIQ للذكاء الاصطناعي لتحسين الكفاءة وتبادل المعرفة في المؤسسة. ويُعد "دليل" في كفاءة مفهوماً منفصلاً بحوكمة خاصة به.',
      ['enec-presight']),
    news('full-fleet-year', '2025-09-05', 'barakah', 'Barakah completes its first year of full-fleet operations', 'براكة تكمل عامها الأول من التشغيل الكامل للأسطول',
      'More than 120 TWh generated since Unit 1 and more than 58 Mt of CO2 avoided, by ENEC\'s count.', 'أكثر من 120 تيراواط ساعة منذ الوحدة الأولى وتجنّب أكثر من 58 مليون طن من ثاني أكسيد الكربون بحسب ENEC.',
      'One year after Unit 4 entered commercial operation, ENEC reported more than 120 TWh generated since Unit 1 and more than 58 Mt of CO2 avoided. It also reported that cost, time and labour fell by 40% from Unit 1 to Unit 4.',
      'بعد عام من دخول الوحدة الرابعة التشغيل التجاري، أعلنت ENEC توليد أكثر من 120 تيراواط ساعة منذ الوحدة الأولى وتجنّب أكثر من 58 مليون طن من ثاني أكسيد الكربون، وانخفاض التكلفة والوقت والعمالة بنسبة 40% من الوحدة الأولى إلى الرابعة.',
      ['admo-full-fleet']),
    news('gpo-launch', '2025-08-21', 'talent', 'Graduate Plant Operator programme launched for Emirati engineers', 'إطلاق برنامج مشغّل المحطة للخريجين للمهندسين المواطنين',
      'Engineering graduates start as Local Operators, with SRO training after three years.', 'يبدأ خريجو الهندسة كمشغّلين محليين ثم يتدربون ليصبحوا مشغّلين أوائل بعد ثلاث سنوات.',
      'ENEC launched the Graduate Plant Operator (GPO) programme on 21 August 2025. At that time more than 70 Emiratis were among a 190-strong SRO and RO workforce.',
      'أطلقت ENEC برنامج مشغّل المحطة للخريجين في 21 أغسطس 2025. وكان آنذاك أكثر من 70 مواطناً ضمن قوة عاملة من المشغّلين المعتمدين والأوائل قوامها 190.',
      ['enec-gpo']),
    news('framatome-fuel', '2025-07-21', 'partners', 'Framatome to supply fuel assemblies for Barakah', 'فراماتوم لتوريد مجمعات الوقود لبراكة',
      'A fuel assembly supply and engineering agreement; lead test assemblies followed in Nov 2025.', 'اتفاقية لتوريد مجمعات الوقود والهندسة؛ وتبعتها مجمعات الاختبار الأولى في نوفمبر 2025.',
      'Framatome and ENEC agreed a fuel assembly supply and engineering arrangement in July 2025, with the first lead test assemblies manufactured in November 2025 for a qualification programme.',
      'اتفقت فراماتوم وENEC في يوليو 2025 على توريد مجمعات الوقود والخدمات الهندسية، وصُنعت أولى مجمعات الاختبار في نوفمبر 2025 ضمن برنامج تأهيل.',
      ['wnn-framatome', 'wnn-framatome-lta']),
    news('enec-consulting', '2025-01-15', 'corporate', 'ENEC Consulting launched to support newcomer countries', 'إطلاق ENEC للاستشارات لدعم الدول الجديدة في المجال النووي',
      'An advisory arm sharing the Barakah experience with countries starting nuclear programmes.', 'ذراع استشارية تنقل تجربة براكة إلى الدول التي تبدأ برامج نووية.',
      'ENEC Consulting was launched on 15 January 2025 to advise countries developing civil nuclear programmes, including on project management, regulatory frameworks, financing and workforce development.',
      'أُطلقت ENEC للاستشارات في 15 يناير 2025 لتقديم المشورة للدول التي تطوّر برامج نووية مدنية، بما في ذلك إدارة المشاريع والأطر التنظيمية والتمويل وتطوير القوى العاملة.',
      ['admo-consulting', 'enec-consulting']),
    news('rebrand', '2024-11-18', 'corporate', 'Emirates Nuclear Energy Company: a new name and brand', 'مؤسسة الإمارات للطاقة النووية: اسم وهوية جديدان',
      'Nawah became ENEC Operations and Barakah One became ENEC Commercial.', 'أصبحت "نواة" ENEC للعمليات و"براكة الأولى" ENEC التجارية.',
      'ENEC changed its English name to Emirates Nuclear Energy Company on 18 November 2024. Its joint-venture subsidiaries were renamed at the same time: Nawah Energy Company became ENEC Operations (still registered and licensed as Nawah) and Barakah One Company became ENEC Commercial.',
      'غيّرت ENEC اسمها الإنجليزي إلى Emirates Nuclear Energy Company في 18 نوفمبر 2024، وأُعيدت تسمية شركتيها المشتركتين: أصبحت شركة نواة للطاقة ENEC للعمليات (ولا تزال مسجلة ومرخصة باسم نواة) وأصبحت شركة براكة الأولى ENEC التجارية.',
      ['enec-rebrand']),
    news('unit4-full-fleet', '2024-09-05', 'barakah', 'Unit 4 enters commercial operation: the full Barakah fleet is online', 'الوحدة الرابعة تدخل التشغيل التجاري: أسطول براكة كاملاً',
      'Four APR-1400 units now produce about 40 TWh a year.', 'تنتج الوحدات الأربع من طراز APR-1400 نحو 40 تيراواط ساعة سنوياً.',
      'With Unit 4 in commercial operation from 5 September 2024, all four Barakah units are online, producing about 40 TWh a year. Each FANR operating licence runs for 60 years.',
      'مع دخول الوحدة الرابعة التشغيل التجاري في 5 سبتمبر 2024 أصبحت وحدات براكة الأربع في الخدمة وتنتج نحو 40 تيراواط ساعة سنوياً. وتمتد مدة كل ترخيص تشغيل من الهيئة 60 عاماً.',
      ['wnn-u4', 'enec-barakah']),
  ];
}

export function buildFlags() {
  const F = [
    ['dalil_public', 'Dalil for anonymous visitors', 'دليل للزوار غير المسجلين', 'When off, Dalil asks visitors to sign in before answering. The global kill switch is separate (Dalil settings).', 'عند الإيقاف يطلب دليل من الزوار تسجيل الدخول قبل الإجابة. مفتاح الإيقاف العام منفصل (إعدادات دليل).', true, false, 'dalil'],
    ['dalil_handoff', 'Dalil human hand-off', 'إحالة دليل إلى شخص', 'Lets users ask for the careers team, a training coordinator or the partner desk, with consent to pass on the conversation.', 'يتيح للمستخدمين طلب فريق المهن أو منسق التدريب أو مكتب الشركاء مع الموافقة على تمرير المحادثة.', true, false, 'dalil'],
    ['contact_form', 'Public contact form', 'نموذج الاتصال العام', 'When off, the contact page shows official channels only.', 'عند الإيقاف تعرض صفحة الاتصال القنوات الرسمية فقط.', true, false, 'public'],
    ['news', 'News section on public pages', 'قسم الأخبار في الصفحات العامة', 'Sourced news items on the home page and /news.', 'أخبار موثقة في الصفحة الرئيسية وصفحة الأخبار.', true, false, 'public'],
    ['nexus_links', 'Links into ENEC NEXUS', 'روابط إلى ENEC NEXUS', 'Shows deep links into NEXUS Academy, partner readiness and the directory.', 'يعرض روابط مباشرة إلى أكاديمية NEXUS وجاهزية الشركاء والدليل.', true, false, 'nexus'],
    ['self_export', 'Self-service data export', 'تصدير البيانات ذاتياً', 'Lets signed-in users download their own data from My settings.', 'يتيح للمستخدمين تنزيل بياناتهم من "إعداداتي".', true, false, 'privacy'],
    ['speak_up_no_telemetry', 'Speak-up: no telemetry (locked)', 'رفع المخاوف: بلا قياس (مقفل)', 'The speak-up route never sends analytics or audit events. Locked on by design.', 'لا يرسل مسار رفع المخاوف أي قياسات أو أحداث تدقيق. مفعّل دائماً بحكم التصميم.', true, true, 'safety'],
    ['gamification_qualification', 'Points and badges on qualification work (locked off)', 'النقاط والشارات على أعمال التأهيل (مقفل)', 'Qualification is not a game. Locked off by design.', 'التأهيل ليس لعبة. مقفل بحكم التصميم.', false, true, 'safety'],
  ];
  return F.map(([key, label_en, label_ar, description_en, description_ar, enabled, locked, area]) => ({ id: `ff-${key}`, key, label_en, label_ar, description_en, description_ar, enabled, locked, area, updated_at: ts('2026-10-01'), updated_by: null }));
}

export function buildMoreFaqs(start) {
  const F = [
    ['careers', 'How do I become a Reactor Operator?', 'كيف أصبح مشغّل مفاعل؟', 'FANR-REG-17 Art. 4 sets three entry routes, for example a high-school diploma plus 36 months as a fully qualified Local Operator. Every route also needs a UAE security clearance. See the Reactor Operator role page; ENEC and FANR decide eligibility.', 'تحدد المادة 4 من اللائحة 17 ثلاثة مسارات للالتحاق، منها شهادة الثانوية مع 36 شهراً كمشغّل محلي مؤهَّل تأهيلاً كاملاً، ويتطلب كل مسار تصريحاً أمنياً إماراتياً. راجع صفحة وظيفة مشغّل المفاعل؛ تحدد ENEC والهيئة الأهلية.'],
    ['programmes', 'What is the Diploma in Nuclear Technology?', 'ما هو دبلوم التكنولوجيا النووية؟', 'A 24-month vocational programme for UAE high-school graduates leading to Local Operator or Maintenance Technician roles, with a monthly stipend. The first cohort graduated on 17 June 2026.', 'برنامج مهني مدته 24 شهراً لخريجي الثانوية من المواطنين يقود إلى وظيفة مشغّل محلي أو فني صيانة مع مكافأة شهرية. وتخرجت الدفعة الأولى في 17 يونيو 2026.'],
    ['programmes', 'Which scholarships are available?', 'ما المنح الدراسية المتاحة؟', 'Energy Pioneers has sponsored UAE nationals in science and engineering since 2009, using partner universities in the UAE, the US and Korea. Khalifa University offers an MSc in Nuclear Engineering. See Pathways for eligibility and sources.', 'ترعى منح رواد الطاقة المواطنين في العلوم والهندسة منذ 2009 في جامعات شريكة في الإمارات والولايات المتحدة وكوريا، وتقدم جامعة خليفة ماجستير الهندسة النووية. راجع "المسارات" للأهلية والمصادر.'],
    ['licensing', 'How long is an operator certificate valid?', 'ما مدة صلاحية شهادة المشغّل؟', 'Five years for the named facility. Certified operators also need a medical every 12 months and minimum shifts each quarter (FANR-REG-17).', 'خمس سنوات للمنشأة المحددة، ويحتاج المشغّل المعتمد إلى فحص طبي كل 12 شهراً وحد أدنى من النوبات كل ربع سنة (اللائحة 17).'],
    ['safety', 'What is a safety culture?', 'ما هي ثقافة السلامة؟', 'The values and behaviours that put nuclear safety first. ENEC Operations publishes 10 traits informed by INPO 12-012 and WANO PL 2013-01.', 'القيم والسلوكيات التي تضع السلامة النووية أولاً. وتنشر ENEC للعمليات عشر سمات مستمدة من INPO 12-012 وWANO PL 2013-01.'],
    ['safety', 'Can I raise a concern anonymously?', 'هل يمكنني رفع مخاوف دون الكشف عن هويتي؟', 'The Employee Concerns Program is confidential and independent, and you can ask the ECP how anonymity works on each channel. Kafa\'a itself never takes or stores a concern.', 'برنامج مخاوف الموظفين سري ومستقل، ويمكنك سؤال البرنامج عن كيفية إخفاء الهوية في كل قناة. لا تتلقى كفاءة أي مخاوف ولا تخزنها.'],
    ['suppliers', 'What is In-Country Value (ICV)?', 'ما هي القيمة المحلية المضافة؟', 'The national programme that measures a supplier\'s contribution to the UAE economy. ENEC applies ICV in its tenders.', 'البرنامج الوطني الذي يقيس مساهمة المورد في اقتصاد الإمارات، وتطبقه ENEC في مناقصاتها.'],
    ['community', 'Does ENEC offer materials for schools?', 'هل توفر ENEC مواد للمدارس؟', 'Yes: student booklets for ages 6-10, 11-16 and 17-19, and a VR plant tour app, on the ENEC students page.', 'نعم: كتيبات للطلاب للأعمار 6-10 و11-16 و17-19 وتطبيق جولة افتراضية في المحطة على صفحة الطلاب في موقع ENEC.'],
    ['dalil', 'Does Dalil keep my conversation?', 'هل يحتفظ دليل بمحادثتي؟', 'For a limited period (30 days in the demo tenant) to review quality. If you start describing a concern, Dalil stops and the text is not stored.', 'لفترة محدودة (30 يوماً في البيئة التجريبية) لمراجعة الجودة. وإذا بدأت بوصف مخاوف يتوقف دليل ولا يُخزَّن النص.'],
    ['general', 'Why are some numbers labelled SAMPLE or SIMULATED?', 'لماذا تحمل بعض الأرقام وسم "عينة" أو "محاكاة"?', 'Kafa\'a shows no number without a public source. Demo-tenant figures are synthetic and labelled so they are never mistaken for real data.', 'لا تعرض كفاءة أي رقم دون مصدر عام. وأرقام البيئة التجريبية اصطناعية وموسومة حتى لا تُفهم على أنها بيانات حقيقية.'],
  ];
  return F.map(([topic, q_en, q_ar, a_en, a_ar], i) => ({ id: `faq-${start + i}`, topic, q_en, q_ar, a_en, a_ar, sort: start + i }));
}

export function buildFacts2() {
  const F = [
    ['ops-emiratization', 'Emiratization at ENEC Operations', 'نسبة التوطين في ENEC للعمليات', 'about 60%', 'نحو 60%', 'Staff from more than 50 nationalities (ENEC Operations CEO message)', 'موظفون من أكثر من 50 جنسية (رسالة الرئيس التنفيذي)', 'enec-ops-ceo', 'workforce'],
    ['safety-survey', 'Safety-culture survey completion (2024 assessment)', 'نسبة استكمال مسح ثقافة السلامة (تقييم 2024)', '89%', '89%', 'Biennial independent assessment', 'تقييم مستقل كل سنتين', 'cns10', 'safety'],
    ['sro-ro-2025', 'SRO and RO workforce (Aug 2025)', 'القوى العاملة من المشغّلين المعتمدين (أغسطس 2025)', '190', '190', 'More than 70 of them Emirati', 'أكثر من 70 منهم مواطنون', 'enec-gpo', 'workforce'],
    ['khnp-support', 'KHNP operations support staff', 'خبراء دعم التشغيل من KHNP', 'about 400 a year', 'نحو 400 سنوياً', 'Under the Operating Support Services Agreement, until 2030', 'بموجب اتفاقية خدمات دعم التشغيل حتى 2030', 'enec-khnp-ossa', 'partners'],
  ];
  return F.map(([key, label_en, label_ar, value, value_ar, detail_en, detail_ar, sid, topic]) => ({ id: `fact-${key}`, key, label_en, label_ar, value, value_ar, detail_en, detail_ar, source_id: sid, as_of: ASOF, sample: false, public: true, conflict_note: null, topic }));
}

/** Internal and partner corpus documents for Dalil staff and partner modes (cleared for Dalil, no secure content). */
export function buildCorpusExtra(newsPages) {
  const doc = (id, title, url, kind, modes, is_public, text_en, text_ar) => ({ id, title, url, kind, modes, is_public, approved: true, text_en, text_ar, updated_at: ts(ASOF) });
  const out = newsPages.map((p) => doc(`cd-${p.id}`, p.title_en, `/kafaa/${p.slug}`, 'kafaa_page', ['public', 'applicant', 'staff', 'partner'], true, `${p.summary_en} ${p.body_en}`, `${p.summary_ar} ${p.body_ar}`));
  out.push(
    doc('cd-int-hu-refresher', 'Human performance tools refresher (internal)', '/kafaa/my/safety-culture', 'internal', ['staff'], false,
      'Core human performance tools apply to everyone, supplemental workers included: self-checking with STAR (stop, think, act, review), three-way communication, procedure use and adherence, pre-job briefs graded to risk, and a questioning attitude. Conditional tools depend on the job: peer checking, independent verification and place-keeping. Refreshers are on My safety culture; there are no points or badges.',
      'تنطبق أدوات الأداء البشري الأساسية على الجميع: التحقق الذاتي STAR والاتصال الثلاثي واستخدام الإجراءات وإحاطة ما قبل العمل وموقف التساؤل. وتعتمد الأدوات المشروطة على العمل: التحقق من الزميل والتحقق المستقل وتتبع الموضع.'),
    doc('cd-int-oe-howto', 'How operating experience reaches you (internal)', '/kafaa/oe', 'internal', ['staff'], false,
      'Operating experience follows four phases: collect, screen, evaluate, act. External sources include INPO, WANO, the IAEA IRS, KHNP reference plants, EPRI, FANR and the US NRC. A cross-functional OE Screening Committee reviews each lesson before publication; Kafa\'a shows curated, de-identified lessons with the review date and reviewing body.',
      'تمر الخبرة التشغيلية بأربع مراحل: الجمع والفرز والتقييم والتنفيذ. وتراجع لجنة فرز الخبرة التشغيلية كل درس قبل نشره، وتعرض كفاءة دروساً منتقاة مجهولة الهوية مع تاريخ المراجعة والجهة المراجِعة.'),
    doc('cd-int-training-booking', 'Booking and assigned training (internal)', '/kafaa/my/learning', 'internal', ['staff'], false,
      'Mandatory training for your role is assigned automatically by curriculum rules when your role changes. Elective courses can be requested from My learning; your manager approves them. Simulator time for licence-critical continuing training (COCT, requalification) cannot be displaced by elective bookings.',
      'يُسند التدريب الإلزامي لدورك تلقائياً وفق قواعد المنهج عند تغيّر الدور. ويمكن طلب الدورات الاختيارية من "تعلّمي" ويوافق عليها مديرك. ولا يمكن لحجوزات المحاكي الاختيارية إزاحة التدريب المستمر الحرج للترخيص.'),
    doc('cd-int-idp', 'Individual development plans (internal)', '/kafaa/my/plan', 'internal', ['staff'], false,
      'A development plan names a target role and lists activities such as courses, on-the-job training, mentoring and projects, each with a due date. Your line manager approves the plan. Plans are for growth; they are never scored or ranked.',
      'تحدد خطة التطوير دوراً مستهدفاً وتسرد أنشطة مثل الدورات والتدريب أثناء العمل والإرشاد والمشاريع مع مواعيد استحقاق، ويوافق عليها المدير المباشر. الخطط للنمو ولا تُقيَّم أو تُرتَّب.'),
    doc('cd-partner-readiness', 'Supplier readiness path (partner)', '/kafaa/partner/onboarding', 'kafaa_page', ['partner', 'staff'], false,
      'The supplier readiness path has four stages: understand opportunities (ENEC localisation page and the Operational Spare Parts & Services Localization Plan), meet quality expectations (ASME, NQA-1, commercial-grade dedication), improve your In-Country Value score, then register through ENEC supplier registration. A completed path produces a readiness summary that is handed off to the ENEC NEXUS partner lens. Kafa\'a prepares suppliers; ENEC procurement and quality qualify them.',
      'لمسار جاهزية الموردين أربع مراحل: فهم الفرص، واستيفاء توقعات الجودة (ASME وNQA-1 واعتماد المواد التجارية)، وتحسين درجة القيمة المحلية المضافة، ثم التسجيل عبر نظام تسجيل الموردين. ويُنتج المسار المكتمل ملخص جاهزية يُحال إلى بوابة الشركاء في ENEC NEXUS.'),
    doc('cd-partner-academy', 'Supplier academy (partner)', '/kafaa/partner/academy', 'kafaa_page', ['partner', 'staff'], false,
      'The supplier academy offers courses for supplier staff, for example NQA-1 for suppliers, counterfeit and suspect items, commercial-grade dedication, supplier safety culture, ICV plans, working with Barakah, defect reporting and business continuity. Each course has a pass mark and a validity period; certificates are internal Kafa\'a course certificates, not operator licences.',
      'تقدم أكاديمية الموردين دورات لموظفي الموردين مثل NQA-1 والمواد المقلدة واعتماد المواد التجارية وثقافة السلامة لدى الموردين وخطط القيمة المحلية والعمل مع براكة والإبلاغ عن العيوب واستمرارية الأعمال. ولكل دورة درجة نجاح ومدة صلاحية.'),
    doc('cd-partner-icv', 'ICV improvement plan (partner)', '/kafaa/partner/icv', 'kafaa_page', ['partner', 'staff'], false,
      'In-Country Value is the national programme that measures a supplier\'s contribution to the UAE economy; ENEC applies it in tenders. Partners can record an improvement plan and upload their ICV certificate in the partner portal.',
      'القيمة المحلية المضافة برنامج وطني يقيس مساهمة المورد في اقتصاد الإمارات وتطبقه ENEC في المناقصات. ويمكن للشركاء تسجيل خطة تحسين ورفع شهادة القيمة المحلية في بوابة الشركاء.'),
  );
  return out;
}

export function extendG5(T) {
  // sources
  for (const [id, label, url, publisher] of G5_SOURCES) if (!T.sources.some((s) => s.id === id)) T.sources.push({ id, label, url, publisher, accessed: ASOF, note: null });
  // content pages: summaries on existing pages, plus news items and the news index page
  const summaries = {
    about: ['Who owns, operates and oversees Barakah, and where people fit in.', 'من يملك براكة ويشغّلها ويراقبها، وأين يقع دور الأفراد.'],
    community: ['Forums, career fairs, sponsorships and STEM outreach in Al Dhafra.', 'المنتديات ومعارض التوظيف والرعايات والتوعية العلمية في الظفرة.'],
    esg: ['Climate contribution and sustainability reporting, linked to the source.', 'المساهمة المناخية وتقارير الاستدامة مع روابط المصادر.'],
    'safety-culture': ['The 10 traits, the AT SITE values and how concerns are raised.', 'السمات العشر وقيم AT SITE وكيفية رفع المخاوف.'],
  };
  for (const p of T.content_pages) {
    p.kind = 'page';
    p.published_on = '2026-10-08';
    const s = summaries[p.slug];
    if (s) [p.summary_en, p.summary_ar] = s;
    p.topic = p.module === 'M12' ? 'public' : 'general';
    p.updated_at = ts(ASOF);
    if (p.slug.startsWith('legal/')) p.no_factual_claims = true;
  }
  // one page still in translation, to exercise the review workflow
  T.content_pages.push({
    id: 'page-women-in-nuclear', slug: 'community/women-in-nuclear', zone: 'public', module: 'M12', title_en: 'Women in Nuclear UAE', title_ar: 'المرأة في المجال النووي - الإمارات',
    body_en: 'The Women in Nuclear UAE chapter launched in 2018 and helped found the WiN Middle East chapter in 2023. Activities include mentoring, a book club and visibility programmes. The Barakah Youth Council (2018) hosted IYNC 2024 in Abu Dhabi.',
    body_ar: 'أُطلق فرع المرأة في المجال النووي في الإمارات عام 2018 وساهم في تأسيس فرع الشرق الأوسط عام 2023.',
    sources: g5srcs('enec-win'), as_of: ASOF, review_on: '2027-04-08', status: 'in_translation', is_published: false, translation_status: 'ar_draft', owner_role: 'Editor', ecp_owned: false,
    kind: 'page', published_on: null, summary_en: 'Mentoring and visibility programmes for women in the UAE nuclear sector.', summary_ar: 'برامج الإرشاد والظهور للمرأة في القطاع النووي الإماراتي.', topic: 'community', updated_by: 'p-k-editor', updated_at: ts('2026-10-06'), no_factual_claims: false,
  });
  const newsPages = buildNews();
  T.content_pages.push(...newsPages);
  // feature flags
  T.feature_flags = buildFlags();
  // FAQs and facts
  T.faqs.push(...buildMoreFaqs(T.faqs.length + 1));
  T.facts.push(...buildFacts2());
  // Dalil corpus additions (news, internal and partner documents)
  T.corpus_docs.push(...buildCorpusExtra(newsPages));
  T.dalil_settings = T.dalil_settings.map((s) => ({ ...s, signed_in_rate_limit_per_hour: 60, engine: 'retrieval-v1' }));
  T.eval_runs = T.eval_runs.map((e) => ({ ...e, details: [], engine: 'retrieval-v1', run_by: null, security_total: e.id === 'eval-2026-09' ? 20 : 20, security_correct: e.id === 'eval-2026-09' ? 19 : 20 }));
  // ECP referral log: closure metadata on closed cases and two more SAMPLE referrals (metadata only)
  for (const c of T.concern_cases) if (c.status === 'closed') Object.assign(c, { closed_on: '2026-08-20', outcome: 'referred_cap' });
  T.concern_cases.push(
    { id: 'cc-7', ref_no: 'ECP-2026-011', received_on: '2026-06-14', channel: 'r2p_referral', anonymous: true, category: 'nuclear_safety', status: 'closed', priority: 'priority', triage_owner_role: 'ECP officer', triaged_at: ts('2026-06-15', 10), ecp_system_ref: 'ECP-SYS/ECP-2026-011', sample: true, closed_on: '2026-07-30', outcome: 'not_substantiated' },
    { id: 'cc-8', ref_no: 'ECP-2026-029', received_on: '2026-10-08', channel: 'email', anonymous: false, category: 'hird', status: 'received', priority: 'routine', triage_owner_role: null, triaged_at: null, ecp_system_ref: 'ECP-SYS/ECP-2026-029', sample: true, closed_on: null, outcome: null },
  );
  // Access reviews: elevated grants reviewed at provisioning; a few left overdue for the demo
  let i = 0;
  for (const a of T.role_assignments) {
    if (['admin', 'auditor', 'hr_director', 'licensing_coord', 'training_manager', 'ecp_officer', 'instructor', 'hr_analyst', 'editor'].includes(a.role) && a.status === 'active') {
      i++;
      a.reviewed_at = i % 4 === 0 ? null : ts(i % 3 === 0 ? '2026-05-20' : '2026-09-15');
      a.reviewed_by = a.reviewed_at ? 'p-k-admin' : null;
      a.review_note = a.reviewed_at ? 'Quarterly access review: keep' : null;
    }
  }
  // Contact requests across routes
  T.contact_requests.push(
    { id: 'ct-2', topic: 'careers', route_to: 'Careers team (role mailbox)', name: null, email: null, message: 'Is there an information session for the DNT this year?', created_at: ts('2026-10-06'), status: 'new', lang: 'en', consent_contact: false, retention_until: '2027-04-06' },
    { id: 'ct-3', topic: 'accessibility', route_to: 'Digital accessibility (role mailbox)', name: null, email: null, message: 'تباين الألوان في جدول البيانات منخفض في الوضع الداكن.', created_at: ts('2026-10-07'), status: 'new', lang: 'ar', consent_contact: false, retention_until: '2027-04-07' },
  );
  for (const c of T.contact_requests) {
    c.lang ??= 'en';
    c.consent_contact ??= false;
    c.retention_until ??= '2027-04-05';
  }
  // Dalil logs: an anonymous refused turn and a hand-off waiting for the careers team (no personal data)
  T.advisor_sessions.push(
    { id: 'as-2', person_id: null, mode: 'public', started_at: ts('2026-10-07', 11), retention_until: '2026-11-06', handoff: 'none', handoff_consent: false, turns: 2, client_key: 'anon-demo-1', page_context: '/careers', handoff_status: 'none', handoff_note: null, last_turn_at: ts('2026-10-07', 11) },
    { id: 'as-3', person_id: 'p-k-graduate', mode: 'applicant', started_at: ts('2026-10-07', 14), retention_until: '2026-11-06', handoff: 'careers', handoff_consent: true, turns: 2, client_key: null, page_context: '/pathways/gpo', handoff_status: 'requested', handoff_note: 'Wants to talk about the GPO intake timing', last_turn_at: ts('2026-10-07', 14) },
  );
  for (const s of T.advisor_sessions) {
    s.client_key ??= null;
    s.page_context ??= null;
    s.handoff_status ??= 'none';
    s.handoff_note ??= null;
    s.last_turn_at ??= s.started_at;
  }
  T.advisor_turns.push(
    { id: 'at-2-1', session_id: 'as-2', person_id: null, speaker: 'user', text: 'What are the security arrangements at the plant?', citations: [], refused: false, refusal_category: null, ts: ts('2026-10-07', 11), intent: 'refusal', confidence: null, redacted: false, mode: 'public' },
    { id: 'at-2-2', session_id: 'as-2', person_id: null, speaker: 'dalil', text: 'I can\'t discuss plant security. If you are interested in a security career, the Career Map shows the path and the public requirements.', citations: [{ label: 'Security Officer / Physical Protection', url: '/kafaa/careers/roles/security-officer' }], refused: true, refusal_category: 'security', ts: ts('2026-10-07', 11), intent: 'refusal', confidence: null, redacted: false, mode: 'public' },
    { id: 'at-3-1', session_id: 'as-3', person_id: 'p-k-graduate', speaker: 'user', text: 'When does the next GPO intake open?', citations: [], refused: false, refusal_category: null, ts: ts('2026-10-07', 14), intent: 'programme', confidence: 0.4, redacted: false, mode: 'applicant' },
    { id: 'at-3-2', session_id: 'as-3', person_id: 'p-k-graduate', speaker: 'dalil', text: 'The GPO programme page gives eligibility and duration, but no approved source states the next intake date. I can pass this to the careers team if you agree.', citations: [{ label: 'Graduate Plant Operator (GPO)', url: '/kafaa/pathways/gpo' }], refused: false, refusal_category: null, ts: ts('2026-10-07', 14), intent: 'programme', confidence: 0.4, redacted: false, mode: 'applicant' },
  );
  for (const t of T.advisor_turns) {
    t.intent ??= t.speaker === 'dalil' ? 'role' : null;
    t.confidence ??= null;
    t.redacted ??= false;
    t.mode ??= 'staff';
  }
  // Notifications for G5 roles
  T.notifications.push(
    { id: 'nt-g5-1', person_id: 'p-k-ecp', kind: 'ecp', title_en: '2 new ECP referrals to triage', title_ar: 'إحالتان جديدتان للفرز', body_en: null, body_ar: null, link: '/admin/ecp', severity: 'warn', created_at: ts(ASOF), read_at: null },
    { id: 'nt-g5-2', person_id: 'p-k-admin', kind: 'access', title_en: 'Quarterly access review: elevated grants are due', title_ar: 'مراجعة الوصول الفصلية: صلاحيات مرتفعة مستحقة', body_en: null, body_ar: null, link: '/admin/access', severity: 'warn', created_at: ts(ASOF), read_at: null },
    { id: 'nt-g5-3', person_id: 'p-k-editor', kind: 'content', title_en: 'Women in Nuclear page is waiting for Arabic approval', title_ar: 'صفحة المرأة في المجال النووي بانتظار اعتماد النص العربي', body_en: null, body_ar: null, link: '/admin/content', severity: 'info', created_at: ts(ASOF), read_at: null },
  );
  void src;
  void srcs;
}
