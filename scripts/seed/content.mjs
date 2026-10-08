// M06/M07/M08/M11/M12/M13/M15/M16 content seed: public facts, pages, talent programmes, safety culture, ADVANCE, Dalil, KPIs.
import { src, srcs } from './sources.mjs';

const ASOF = '2026-10-08';

export function buildFacts() {
  const F = [
    ['capacity', 'Installed capacity', 'القدرة المركبة', '5.6 GW', '5.6 غيغاواط', 'Four APR-1400 units, each up to 1,400 MWe gross', 'أربع وحدات APR-1400 بقدرة تصل إلى 1,400 ميغاواط لكل منها', 'enec-barakah', 'barakah'],
    ['generation', 'Annual generation', 'التوليد السنوي', 'about 40 TWh', 'نحو 40 تيراواط ساعة', 'Full four-unit fleet', 'الوحدات الأربع مجتمعة', 'enec-barakah', 'barakah'],
    ['share', 'Share of UAE electricity', 'الحصة من كهرباء الإمارات', 'about 25%', 'نحو 25%', 'ENEC figure; the IAEA gives 21.8% of 2024 generation', 'رقم ENEC؛ وتذكر الوكالة 21.8% من توليد 2024', 'enec-barakah', 'barakah'],
    ['co2', 'CO2 avoided each year', 'ثاني أكسيد الكربون المتجنَّب سنوياً', '22.4 Mt', '22.4 مليون طن', 'About 24% of the UAE\'s 2030 NDC', 'نحو 24% من المساهمات المحددة وطنياً للإمارات لعام 2030', 'enec-climate', 'barakah'],
    ['units', 'Units in commercial operation', 'الوحدات في التشغيل التجاري', '4', '4', 'Full fleet from 5 Sep 2024', 'الأسطول الكامل منذ 5 سبتمبر 2024', 'wnn-u4', 'barakah'],
    ['employees', 'Group employees (2024)', 'موظفو المجموعة (2024)', '2,979', '2,979', 'ENEC + ENEC Operations + ENEC Commercial (GRI data)', 'ENEC وENEC للعمليات وENEC التجارية (بيانات GRI)', 'sr2024', 'workforce'],
    ['emiratization', 'Emiratization, organisation (2024)', 'نسبة التوطين على مستوى المؤسسة (2024)', '54.7%', '54.7%', 'Senior management 63.4%', 'الإدارة العليا 63.4%', 'sr2024', 'workforce'],
    ['women', 'Women in the workforce (2024)', 'النساء في القوى العاملة (2024)', '499 (16.75%)', '499 (16.75%)', 'GRI data', 'بيانات GRI', 'sr2024', 'workforce'],
    ['training-hours', 'Training hours (2024)', 'ساعات التدريب (2024)', '581,090', '581,090', '218 hours per employee; 76,079 e-learning completions', '218 ساعة لكل موظف؛ 76,079 إتماماً للتعلم الإلكتروني', 'sr2024', 'workforce'],
    ['certifications', 'FANR RO/SRO certifications (early 2025)', 'شهادات الهيئة للمشغّلين (مطلع 2025)', '300+', '+300', '140 issued to UAE nationals; certifications, not unique people', '140 منها لمواطنين؛ شهادات وليست أفراداً فريدين', 'cns10', 'workforce'],
    ['suppliers', 'UAE companies with Barakah contracts', 'الشركات الإماراتية المتعاقدة مع براكة', '2,000+', '+2,000', 'Contracts worth more than USD 6.7bn', 'بعقود تتجاوز قيمتها 6.7 مليار دولار', 'enec-localisation', 'suppliers'],
    ['pipeline', 'Talent pipeline programmes', 'برامج استقطاب المواهب', '6', '6', 'More than 2,000 UAE nationals have worked on Barakah', 'عمل أكثر من 2,000 مواطن في براكة', 'enec-dnt-grad', 'talent'],
    ['dhafra-support', 'Al Dhafra residents supporting nuclear energy (2023 poll)', 'سكان الظفرة المؤيدون للطاقة النووية (استطلاع 2023)', '95%', '95%', 'ENEC community polling', 'استطلاع ENEC المجتمعي', 'enec-dhafra', 'community'],
    ['sponsorships', 'Al Dhafra sponsorships (2024)', 'رعايات في الظفرة (2024)', 'AED 1.88m', '1.88 مليون درهم', 'Community sponsorships', 'رعايات مجتمعية', 'enec-dhafra', 'community'],
    ['corals', 'Corals to be cultivated with EAD', 'المرجان المزمع استزراعه مع هيئة البيئة', '500,000', '500,000', 'Partnership announced Nov 2025', 'شراكة أُعلنت في نوفمبر 2025', 'admo-coral', 'community'],
  ];
  return F.map(([key, label_en, label_ar, value, value_ar, detail_en, detail_ar, sid, topic]) => ({ id: `fact-${key}`, key, label_en, label_ar, value, value_ar, detail_en, detail_ar, source_id: sid, as_of: ASOF, sample: false, public: true, conflict_note: key === 'employees' ? 'Press releases say "over 3,000 people, 60% Emirati"; the audited 2024 GRI data say 2,979 and 54.7%.' : key === 'share' ? 'IAEA: 21.8% nuclear share of 2024 generation.' : null, topic }));
}

const page = (slug, module, zone, title_en, title_ar, body_en, body_ar, sids, extra = {}) => ({
  id: `page-${slug.replace(/\//g, '-')}`, slug, zone, module, title_en, title_ar, body_en, body_ar, sources: srcs(...sids), as_of: ASOF, review_on: '2027-04-08',
  status: 'published', is_published: true, translation_status: 'both_approved', owner_role: 'Editor', ecp_owned: false, ...extra,
});

export function buildPages() {
  return [
    page('about', 'M12', 'public', 'About ENEC and Barakah', 'عن ENEC وبراكة',
      'ENEC, the Emirates Nuclear Energy Company, owns and develops the Barakah Nuclear Energy Plant in the Al Dhafra Region of Abu Dhabi. Its Enterprise Strategy 2025-2029 names three themes: Excellence in Fleet Management, Program Growth, and People & Culture. Kafa\'a is a concept for the people and skills side of that strategy. It shows entities and roles, never named staff.',
      'تمتلك مؤسسة الإمارات للطاقة النووية (ENEC) محطة براكة للطاقة النووية في منطقة الظفرة بأبوظبي وتطوّرها. وتحدد استراتيجيتها المؤسسية 2025-2029 ثلاثة محاور: التميز في إدارة الأسطول، ونمو البرنامج، والأفراد والثقافة. كفاءة مفهوم للجانب المتعلق بالأفراد والمهارات من هذه الاستراتيجية، وتعرض الكيانات والأدوار دون ذكر أسماء الموظفين.',
      ['enec-overview', 'enec-strategy']),
    page('about/structure', 'M12', 'public', 'Group structure and oversight', 'هيكل المجموعة والرقابة',
      'ENEC (100% ADQ) owns ENEC Operations (Nawah Energy Company, ENEC 82% / KEPCO 18%), which operates Barakah and holds the four FANR operating licences, and ENEC Commercial (Barakah One Company), which holds the 60-year PPA with EWEC. ENEC Consulting advises newcomer countries. Oversight: FANR (safety, security, radiation protection, safeguards), the IAEA, WANO, NCEMA and Abu Dhabi responders, EAD and the Abu Dhabi DoE.',
      'تمتلك ENEC (المملوكة بالكامل لـADQ) شركة ENEC للعمليات (نواة، ENEC 82% / كيبكو 18%) التي تشغّل براكة وتحمل تراخيص التشغيل الأربعة، وENEC التجارية (براكة الأولى) التي تحمل اتفاقية شراء الطاقة لـ60 عاماً. وتقدم ENEC للاستشارات المشورة للدول الجديدة. الرقابة: الهيئة الاتحادية للرقابة النووية والوكالة الدولية والرابطة العالمية والهيئة الوطنية لإدارة الطوارئ وهيئة البيئة ودائرة الطاقة.',
      ['enec-overview', 'enec-ops-shareholders', 'enec-commercial', 'enec-consulting', 'enec-nuclear-regulation']),
    page('licensing', 'M03', 'public', 'How RO and SRO certification works', 'كيف يعمل اعتماد مشغّلي المفاعل',
      'FANR certifies Reactor Operators and Senior Reactor Operators under FANR-REG-17 (in force 30 May 2024). ENEC Operations prepares, proctors and grades the written and operating exams; FANR is notified 60 days ahead and reviews them. A certificate is valid for 5 years for the named facility. Certified operators need a medical every 12 months and, each quarter, at least 7 eight-hour or 5 twelve-hour shifts (an SRO at least 2 in the SRO role). This page gives general guidance only: eligibility is determined by ENEC and FANR.',
      'تعتمد الهيئة الاتحادية للرقابة النووية مشغّلي المفاعل والمشغّلين الأوائل وفق اللائحة 17 (النافذة منذ 30 مايو 2024). تُعدّ ENEC للعمليات الاختبارات الكتابية والتشغيلية وتراقبها وتصححها، وتُخطَر الهيئة قبل 60 يوماً وتراجعها. الشهادة صالحة 5 سنوات للمنشأة المحددة. ويحتاج المشغّل المعتمد إلى فحص طبي كل 12 شهراً، وفي كل ربع سنة إلى 7 نوبات من 8 ساعات أو 5 من 12 ساعة على الأقل. هذه إرشادات عامة فقط، والأهلية تحددها ENEC والهيئة.',
      ['fanr-reg17', 'cns10']),
    page('safety-culture', 'M08', 'public', 'Nuclear safety culture', 'ثقافة السلامة النووية',
      'ENEC Operations publishes 10 traits of a healthy nuclear safety culture, informed by INPO 12-012 and WANO PL 2013-01, and the AT SITE values: Accountability, Teamwork, Safety, Integrity, Trust, Excellence. Practices include a biennial independent assessment (89% survey completion in 2024), six-monthly monitoring panels, quarterly steering committees, leader-led majlis sessions and an annual Nuclear Safety Culture Fair.',
      'تنشر ENEC للعمليات عشر سمات لثقافة سلامة نووية سليمة مستمدة من INPO 12-012 وWANO PL 2013-01، وقيم AT SITE: المساءلة والعمل الجماعي والسلامة والنزاهة والثقة والتميز. وتشمل الممارسات تقييماً مستقلاً كل سنتين (نسبة استكمال المسح 89% في 2024) ولجان رصد نصف سنوية ولجاناً توجيهية فصلية ومجالس يقودها القادة ومعرضاً سنوياً لثقافة السلامة النووية.',
      ['enec-safety-culture', 'enec-values', 'cns10']),
    page('speak-up', 'M08', 'staff', 'Raise a concern', 'رفع مخاوف',
      'Kafa\'a does not take concerns. Use the Employee Concerns Program channels ENEC publishes: ECP offices, the intranet portal, a 24/7 phone line, email, and representatives at Units 1&2 and 3&4. FANR\'s Report to Protect (R2P) system is an external option. You are protected against harassment, intimidation, retaliation and discrimination for raising a concern.',
      'لا تتلقى كفاءة المخاوف. استخدم قنوات برنامج مخاوف الموظفين التي تنشرها ENEC: مكاتب البرنامج وبوابة الشبكة الداخلية وخط هاتف على مدار الساعة والبريد الإلكتروني والممثلين في الوحدتين 1 و2 والوحدتين 3 و4. ويُعد نظام "أبلغ لتحمي" لدى الهيئة خياراً خارجياً. أنت محمي من المضايقة والترهيب والانتقام والتمييز عند رفع أي مخاوف.',
      ['sr2024', 'cns10'], { ecp_owned: true, owner_role: 'Employee Concerns Program' }),
    page('suppliers', 'M09', 'public', 'How to become a Barakah supplier', 'كيف تصبح مورداً لبراكة',
      'More than 2,000 UAE companies hold Barakah contracts worth more than USD 6.7bn. The readiness path: understand opportunities (ENEC\'s localisation page and the Operational Spare Parts & Services Localization Plan); meet quality expectations (ASME, NQA-1, commercial-grade dedication, supported by ENEC\'s Industrial Development Team); improve your In-Country Value score (MoIAT programme used in ENEC tenders); then register through ENEC\'s supplier registration. Kafa\'a prepares suppliers; ENEC\'s procurement and quality functions qualify them.',
      'تتعاقد أكثر من 2,000 شركة إماراتية مع براكة بعقود تتجاوز 6.7 مليار دولار. مسار الجاهزية: فهم الفرص (صفحة التوطين وخطة توطين قطع الغيار والخدمات التشغيلية)، واستيفاء توقعات الجودة (ASME وNQA-1 واعتماد المواد التجارية)، وتحسين درجة القيمة المحلية المضافة، ثم التسجيل عبر نظام تسجيل الموردين لدى ENEC. تُعدّ كفاءة الموردين، وتؤهلهم وظائف المشتريات والجودة في ENEC.',
      ['enec-localisation', 'enec-icv']),
    page('universities', 'M10', 'public', 'Universities and scholarships', 'الجامعات والمنح الدراسية',
      'Khalifa University offers an MSc in Nuclear Engineering (since 2010), a PhD with a nuclear concentration (since 2012) and a BSc minor; the Emirates Nuclear Technology Center launched in Nov 2019 with ENEC and FANR. Energy Pioneers scholarships (since 2009, "over 500 UAE Nationals benefitted") have used partner universities in the UAE, the US and Korea. Universities can align curricula with the Kafa\'a competency library.',
      'تقدم جامعة خليفة ماجستير الهندسة النووية (منذ 2010) ودكتوراه بتركيز نووي (منذ 2012) وتخصصاً فرعياً في البكالوريوس؛ وأُطلق مركز الإمارات للتكنولوجيا النووية في نوفمبر 2019 مع ENEC والهيئة. واستفاد أكثر من 500 مواطن من منح رواد الطاقة منذ 2009 في جامعات شريكة في الإمارات والولايات المتحدة وكوريا.',
      ['ku-msc', 'enec-talent']),
    page('research', 'M10', 'public', 'Research challenges', 'تحديات البحث',
      'Researchers can respond to curated public problem statements. Every proposal is screened for security sensitivity and export control before any public mention, and inventions are referred to the patents route agreed with the Ministry of Economy and Tourism in May 2026. Research data about the plant never goes on public pages.',
      'يمكن للباحثين الاستجابة لبيانات مشكلات عامة منتقاة. ويخضع كل مقترح لفحص الحساسية الأمنية ورقابة الصادرات قبل أي إعلان عام، وتُحال الاختراعات إلى مسار براءات الاختراع المتفق عليه مع وزارة الاقتصاد والسياحة في مايو 2026.',
      ['enec-moet']),
    page('future', 'M11', 'public', 'Advanced reactors and future skills', 'المفاعلات المتقدمة ومهارات المستقبل',
      'ENEC launched the ADVANCE programme on 30 Nov 2023 to evaluate SMRs, advanced reactors and microreactors for the UAE and abroad. In Feb 2026 FANR said it had received no formal proposal for new capacity. ENEC is evaluating these technologies; no deployment decision is implied.',
      'أطلقت ENEC برنامج ADVANCE في 30 نوفمبر 2023 لتقييم المفاعلات الصغيرة والمتقدمة والمتناهية الصغر للإمارات والخارج. وفي فبراير 2026 قالت الهيئة إنها لم تتلقَّ أي مقترح رسمي لقدرة جديدة. تقيّم ENEC هذه التقنيات، ولا يعني ذلك أي قرار نشر.',
      ['wnn-advance', 'national-fanr-2026']),
    page('community', 'M12', 'public', 'Al Dhafra community', 'مجتمع الظفرة',
      'ENEC runs forums in Al Dhanna and the Tamouh Al Dhafra career fair, sponsored AED 1.88m of community activity in 2024, and signed a community centre agreement with Ma\'an in Feb 2026. In a 2023 poll, 95% of Al Dhafra residents supported nuclear energy. STEM materials include booklets for ages 6-10, 11-16 and 17-19 and a VR plant tour app.',
      'تنظم ENEC منتديات في الظنة ومعرض "طموح الظفرة" للتوظيف، ورعت أنشطة مجتمعية بقيمة 1.88 مليون درهم في 2024، ووقعت اتفاقية مركز مجتمعي مع "معاً" في فبراير 2026. وفي استطلاع 2023 أيّد 95% من سكان الظفرة الطاقة النووية.',
      ['enec-dhafra', 'enec-students', 'enec-maan']),
    page('esg', 'M12', 'public', 'Climate and sustainability', 'المناخ والاستدامة',
      'Barakah avoids about 22.4 Mt of CO2 a year. ENEC co-launched the Net Zero Nuclear initiative with the World Nuclear Association in Sep 2023 and, in Nov 2025, partnered with EAD to cultivate 500,000 corals around Barakah. Sustainability reports are linked, not copied.',
      'تجنّب براكة نحو 22.4 مليون طن من ثاني أكسيد الكربون سنوياً. وشاركت ENEC في إطلاق مبادرة الحياد الصفري النووي مع الرابطة النووية العالمية في سبتمبر 2023، وتعاونت في نوفمبر 2025 مع هيئة البيئة لاستزراع 500,000 مرجانة حول براكة.',
      ['enec-climate', 'enec-sustainability', 'admo-coral', 'sr2024']),
    page('emergency', 'M12', 'public', 'Emergency information', 'معلومات الطوارئ',
      'Go In, Stay In, Listen In. Public emergency guidance stays on official ENEC and NCEMA pages; Kafa\'a links to them and does not restate zones or instructions.',
      'ادخل، ابقَ في الداخل، استمع. تبقى إرشادات الطوارئ العامة على صفحات ENEC والهيئة الوطنية لإدارة الطوارئ الرسمية؛ وتربط كفاءة إليها دون إعادة ذكر المناطق أو التعليمات.',
      ['enec-ep-faq', 'enec-ep', 'ncema']),
    page('legal/terms', 'M12', 'public', 'Terms of use', 'شروط الاستخدام', 'Kafa\'a is a concept demonstration, not affiliated with or endorsed by ENEC. Demo personas are synthetic. Nothing here is an official record or a regulatory channel.', 'كفاءة عرض توضيحي لمفهوم، غير تابع لـENEC ولا معتمد منها. الشخصيات التجريبية اصطناعية. لا شيء هنا سجل رسمي أو قناة تنظيمية.', []),
    page('legal/privacy', 'M12', 'public', 'Privacy notice', 'إشعار الخصوصية', 'Kafa\'a collects the minimum: name, language, digit preference, contact and role. No Emirates ID or date of birth unless a stage requires it, then only through UAE Pass. Unsuccessful applicant data is deleted on a published schedule. Requests to view, export or correct your data go through My settings. The design follows the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021); legal review confirms the governing regime.', 'تجمع كفاءة الحد الأدنى: الاسم واللغة وتفضيل الأرقام ووسيلة الاتصال والدور. لا يُطلب رقم الهوية أو تاريخ الميلاد إلا عند الحاجة وعبر الهوية الرقمية فقط. تُحذف بيانات المتقدمين غير الناجحين وفق جدول منشور. تُقدَّم طلبات الاطلاع على بياناتك أو تصديرها أو تصحيحها عبر "إعداداتي".', []),
    page('legal/accessibility', 'M15', 'public', 'Accessibility statement', 'بيان إمكانية الوصول', 'Kafa\'a targets WCAG 2.2 AA in English and Arabic, with mirrored right-to-left layouts, keyboard navigation and visible focus. Report a barrier through the contact form (topic: accessibility).', 'تستهدف كفاءة معيار WCAG 2.2 AA بالعربية والإنجليزية، مع تخطيطات معكوسة من اليمين إلى اليسار والتنقل بلوحة المفاتيح والتركيز المرئي.', []),
  ];
}

export function buildFaqs() {
  const F = [
    ['general', 'Is Kafa\'a an official ENEC website?', 'هل كفاءة موقع رسمي لـENEC؟', 'No. Kafa\'a is a concept, not affiliated with or endorsed by ENEC. Official information is on enec.ae.', 'لا. كفاءة مفهوم غير تابع لـENEC ولا معتمد منها. المعلومات الرسمية على enec.ae.'],
    ['careers', 'Which subjects lead to nuclear careers?', 'ما المواد الدراسية التي تقود إلى المهن النووية؟', 'Mathematics, physics and chemistry open most technical routes. School leavers can look at the DNT; graduates at the GDP and GPO.', 'الرياضيات والفيزياء والكيمياء تفتح معظم المسارات الفنية. يمكن لخريجي الثانوية النظر في دبلوم التكنولوجيا النووية، وللخريجين في برنامجي تطوير الخريجين ومشغّل المحطة.'],
    ['careers', 'Can my fossil-plant experience count towards becoming a Reactor Operator?', 'هل تُحتسب خبرتي في محطة وقود أحفوري للوصول إلى وظيفة مشغّل مفاعل؟', 'FANR-REG-17 Art. 4 includes a route with 24 months at a fossil or different-type plant plus 12 months at Barakah including 9 on crew. ENEC and FANR determine eligibility.', 'تتضمن المادة 4 من اللائحة 17 مساراً بـ24 شهراً في محطة أحفورية أو مختلفة مع 12 شهراً في براكة منها 9 ضمن طاقم. تحدد ENEC والهيئة الأهلية.'],
    ['licensing', 'Does Kafa\'a issue operator licences?', 'هل تصدر كفاءة تراخيص المشغّلين؟', 'No. FANR certifies operators. Kafa\'a mirrors status from the licensee\'s records and sends nothing to FANR.', 'لا. تعتمد الهيئة المشغّلين. تعرض كفاءة الحالة من سجلات المرخَّص له ولا ترسل شيئاً إلى الهيئة.'],
    ['programmes', 'Are some programmes only for UAE nationals?', 'هل بعض البرامج مخصصة للمواطنين فقط؟', 'Yes. Each programme card states its nationality and education requirements up front.', 'نعم. توضح بطاقة كل برنامج متطلبات الجنسية والتعليم مسبقاً.'],
    ['suppliers', 'How do I become a supplier?', 'كيف أصبح مورداً؟', 'Follow the supplier readiness path; Kafa\'a hands your readiness summary to ENEC\'s supplier registration.', 'اتبع مسار جاهزية الموردين، وتسلّم كفاءة ملخص جاهزيتك إلى نظام تسجيل الموردين لدى ENEC.'],
    ['privacy', 'What personal data does Kafa\'a hold?', 'ما البيانات الشخصية التي تحتفظ بها كفاءة؟', 'The minimum: name, language, contact and role. Never medical content, clearance details or exam items.', 'الحد الأدنى: الاسم واللغة ووسيلة الاتصال والدور. لا محتوى طبي ولا تفاصيل التصاريح الأمنية ولا أسئلة الاختبارات.'],
    ['dalil', 'What is Dalil?', 'ما هو دليل؟', 'Dalil is a governed AI guide that answers from approved sources, cites them, and hands off to people. It never decides eligibility.', 'دليل مرشد ذكاء اصطناعي محوكم يجيب من مصادر معتمدة ويستشهد بها ويحيل إلى الأشخاص. لا يقرر الأهلية أبداً.'],
    ['safety', 'Where do I raise a safety concern?', 'أين أرفع مخاوف تتعلق بالسلامة؟', 'Use the Employee Concerns Program channels listed on the speak-up page. Kafa\'a stores nothing about concerns.', 'استخدم قنوات برنامج مخاوف الموظفين المدرجة في صفحة رفع المخاوف. لا تخزن كفاءة أي شيء عن المخاوف.'],
    ['emergency', 'Where is emergency information?', 'أين أجد معلومات الطوارئ؟', 'On official ENEC and NCEMA pages. Go In, Stay In, Listen In.', 'على صفحات ENEC والهيئة الوطنية لإدارة الطوارئ الرسمية. ادخل، ابقَ في الداخل، استمع.'],
  ];
  return F.map(([topic, q_en, q_ar, a_en, a_ar], i) => ({ id: `faq-${i + 1}`, topic, q_en, q_ar, a_en, a_ar, sort: i + 1 }));
}

export function buildGlossary() {
  const G = [
    ['Reactor Operator (RO)', 'مشغّل المفاعل', 'Holds a FANR certificate to manipulate reactivity controls.', 'يحمل شهادة من الهيئة لتشغيل أدوات التحكم في التفاعلية.'],
    ['Senior Reactor Operator (SRO)', 'مشغّل المفاعل الأول', 'Directs ROs and LOs in the control room; FANR-certified.', 'يوجّه المشغّلين في غرفة التحكم؛ معتمد من الهيئة.'],
    ['Local Operator (LO)', 'المشغّل المحلي', 'Operates equipment outside the control room; qualified by the licensee.', 'يشغّل المعدات خارج غرفة التحكم؛ يؤهله المرخَّص له.'],
    ['Systematic Approach to Training (SAT)', 'النهج المنهجي للتدريب', 'Analysis, design, development, implementation and evaluation of performance-based training.', 'تحليل التدريب القائم على الأداء وتصميمه وتطويره وتنفيذه وتقييمه.'],
    ['Job Performance Measure (JPM)', 'مقياس الأداء الوظيفي', 'A task evaluation with critical steps and pass criteria.', 'تقييم لمهمة يتضمن خطوات حرجة ومعايير نجاح.'],
    ['Qualification card', 'بطاقة التأهيل', 'The task list a person completes to be qualified for a job or watch-station.', 'قائمة المهام التي يكملها الشخص ليتأهل لوظيفة أو محطة مراقبة.'],
    ['ALARA', 'أدنى مستوى ممكن عملياً', 'As Low As Reasonably Achievable: the radiation protection principle.', 'مبدأ الوقاية من الإشعاع: أدنى مستوى يمكن تحقيقه بشكل معقول.'],
    ['Operating experience (OE)', 'الخبرة التشغيلية', 'Lessons from events at this and other plants, screened and applied.', 'دروس من أحداث في هذه المحطة وغيرها، تُفرز وتُطبَّق.'],
    ['In-Country Value (ICV)', 'القيمة المحلية المضافة', 'The national programme measuring a supplier\'s contribution to the UAE economy.', 'البرنامج الوطني لقياس مساهمة المورد في اقتصاد الإمارات.'],
    ['Commercial-grade dedication', 'اعتماد المواد التجارية', 'The process that accepts a commercial item for a safety-related use.', 'العملية التي تقبل بها مادة تجارية لاستخدام متعلق بالسلامة.'],
    ['Emiratization', 'التوطين', 'Increasing the share of UAE nationals in the workforce.', 'زيادة نسبة المواطنين في القوى العاملة.'],
    ['Full-scope simulator', 'المحاكي كامل النطاق', 'A replica of the main control room that models plant behaviour.', 'نسخة طبق الأصل من غرفة التحكم الرئيسية تحاكي سلوك المحطة.'],
  ];
  return G.map(([term_en, term_ar, definition_en, definition_ar], i) => ({ id: `gl-${i + 1}`, term_en, term_ar, definition_en, definition_ar, owner: 'Nuclear Training', status: 'reviewed' }));
}

export function buildSafetyCulture() {
  const T = [
    ['Personal accountability', 'المساءلة الشخصية', 'All individuals take personal responsibility for safety.', 'يتحمل كل فرد المسؤولية الشخصية عن السلامة.'],
    ['Questioning attitude', 'موقف التساؤل', 'Individuals avoid complacency and challenge existing conditions and assumptions.', 'يتجنب الأفراد التهاون ويتحدّون الظروف والافتراضات القائمة.'],
    ['Effective safety communication', 'التواصل الفعال بشأن السلامة', 'Communications maintain a focus on safety.', 'يحافظ التواصل على التركيز على السلامة.'],
    ['Leadership safety values and actions', 'قيم وأفعال القيادة في مجال السلامة', 'Leaders demonstrate a commitment to safety in decisions and behaviours.', 'يُظهر القادة التزامهم بالسلامة في قراراتهم وسلوكهم.'],
    ['Decision-making', 'اتخاذ القرار', 'Decisions that support or affect nuclear safety are systematic, rigorous and thorough.', 'تكون القرارات المتعلقة بالسلامة النووية منهجية ودقيقة وشاملة.'],
    ['Respectful work environment', 'بيئة عمل محترمة', 'Trust and respect permeate the organisation.', 'تسود الثقة والاحترام في أرجاء المؤسسة.'],
    ['Continuous learning', 'التعلم المستمر', 'Opportunities to learn are valued, sought out and implemented.', 'تُقدَّر فرص التعلم ويُسعى إليها وتُطبَّق.'],
    ['Problem identification and resolution', 'تحديد المشكلات وحلها', 'Issues potentially affecting safety are promptly identified, evaluated and corrected.', 'تُحدَّد القضايا التي قد تؤثر في السلامة وتُقيَّم وتُصحَّح بسرعة.'],
    ['Environment for raising concerns', 'بيئة رفع المخاوف', 'A safety-conscious work environment where people feel free to raise concerns without fear of retaliation.', 'بيئة عمل واعية بالسلامة يشعر فيها الناس بحرية رفع المخاوف دون خوف من الانتقام.'],
    ['Work processes', 'عمليات العمل', 'Work activities are planned and controlled so that safety is maintained.', 'تُخطَّط أنشطة العمل وتُضبط بما يحافظ على السلامة.'],
  ];
  const traits = T.map(([name_en, name_ar, description_en, description_ar], i) => ({
    id: `trait-${i + 1}`, n: i + 1, name_en, name_ar, description_en, description_ar,
    behaviours: [{ en: 'What it looks like on shift: one observable behaviour, discussed in team briefs.', ar: 'كيف تبدو في النوبة: سلوك واحد قابل للملاحظة يُناقش في إحاطات الفريق.' }],
    prompts: [{ en: `When did you last see "${name_en.toLowerCase()}" make a difference to a job?`, ar: `متى رأيت آخر مرة أن "${name_ar}" أحدثت فرقاً في عمل ما؟` }],
  }));
  const hu = [
    ['Self-checking (STAR)', 'التحقق الذاتي (STAR)', 'Stop, Think, Act, Review before and after each action.', 'توقف، فكّر، نفّذ، راجع قبل كل إجراء وبعده.', 'core'],
    ['Three-way communication', 'الاتصال الثلاثي', 'Sender states, receiver repeats back, sender confirms.', 'يصرّح المرسل ويكرر المستلم ويؤكد المرسل.', 'core'],
    ['Procedure use and adherence', 'استخدام الإجراءات والالتزام بها', 'Use the right procedure at the right level of use; stop when it cannot be followed.', 'استخدم الإجراء الصحيح بمستوى الاستخدام المناسب وتوقف عند تعذر اتباعه.', 'core'],
    ['Pre-job brief', 'إحاطة ما قبل العمل', 'Critical steps, error traps and contingencies, graded to risk.', 'الخطوات الحرجة ومصائد الأخطاء والخطط البديلة متدرجة حسب المخاطر.', 'core'],
    ['Questioning attitude', 'موقف التساؤل', 'Stop when unsure.', 'توقف عند الشك.', 'core'],
    ['Peer checking', 'التحقق من الزميل', 'A co-worker confirms the intended action before it is taken.', 'يؤكد زميل الإجراء المقصود قبل تنفيذه.', 'conditional'],
    ['Independent verification', 'التحقق المستقل', 'A second qualified person checks separately, in time and action.', 'يتحقق شخص مؤهل ثانٍ بشكل منفصل زمناً وفعلاً.', 'conditional'],
    ['Place-keeping', 'تتبع الموضع', 'Mark steps as completed to avoid omissions.', 'تعليم الخطوات المنجزة لتجنب السهو.', 'conditional'],
  ].map(([name_en, name_ar, description_en, description_ar, kind], i) => ({ id: `hu-${i + 1}`, name_en, name_ar, description_en, description_ar, kind }));
  const ecp = [
    ['office', 'ECP offices', 'مكاتب برنامج مخاوف الموظفين', 'Confidential, independent offices on site.', 'مكاتب سرية ومستقلة في الموقع.'],
    ['intranet', 'ECP intranet portal', 'بوابة البرنامج على الشبكة الداخلية', 'Available on the ENEC intranet (not in Kafa\'a).', 'متاحة على الشبكة الداخلية لـENEC (ليست في كفاءة).'],
    ['phone', '24/7 phone line', 'خط هاتف على مدار الساعة', 'A confidential line answered at any time.', 'خط سري يُجاب في أي وقت.'],
    ['email', 'ECP email', 'البريد الإلكتروني للبرنامج', 'A monitored, confidential mailbox.', 'صندوق بريد سري ومراقَب.'],
    ['reps', 'Unit representatives', 'ممثلو الوحدات', 'Representatives at Units 1&2 and 3&4.', 'ممثلون في الوحدتين 1 و2 والوحدتين 3 و4.'],
    ['r2p', 'FANR Report to Protect (R2P)', 'نظام "أبلغ لتحمي" لدى الهيئة', 'An external option run by the regulator.', 'خيار خارجي تديره الجهة الرقابية.'],
  ].map(([kind, label_en, label_ar, detail_en, detail_ar], i) => ({ id: `ecp-${kind}`, kind, label_en, label_ar, detail_en, detail_ar, sort: i + 1, source: 'SR2024 p.86-87; CNS report' }));
  const oe = [
    ['Wrong-train work prevented by a peer check', 'منع العمل على المسار الخطأ بفضل التحقق من الزميل', 'A technician prepared to work on the wrong redundant train; a peer check caught it.', 'استعد فني للعمل على المسار الاحتياطي الخطأ، وكشف التحقق من الزميل ذلك.', 'Use component labels and peer checks on redundant equipment.', 'استخدم ملصقات المكونات والتحقق من الزميل على المعدات الاحتياطية.', 'WANO', ['trait-2', 'trait-10'], 'OE Screening Committee', ['qs-mech']],
    ['Procedure step skipped under time pressure', 'تخطي خطوة إجرائية تحت ضغط الوقت', 'An industry event where a step was missed during a time-pressured evolution.', 'حدث في القطاع فاتت فيه خطوة خلال عملية تحت ضغط الوقت.', 'Place-keeping and stopping when rushed.', 'تتبع الموضع والتوقف عند الاستعجال.', 'INPO', ['trait-1', 'trait-5'], 'OE Screening Committee', ['qs-lo-turbine']],
    ['Standing alarms and operator burden', 'الإنذارات الدائمة وعبء المشغّل', 'Lessons from managing standing control room alarms (a 2021 FANR finding at Unit 1 was closed in Dec 2023).', 'دروس من إدارة إنذارات غرفة التحكم الدائمة (أُغلقت ملاحظة للهيئة من 2021 في الوحدة 1 في ديسمبر 2023).', 'Treat standing alarms as problems to resolve, not background.', 'تعامل مع الإنذارات الدائمة كمشكلات يجب حلها لا كخلفية.', 'internal', ['trait-8'], 'OE Screening Committee', ['qs-ro', 'qs-sro']],
    ['Foreign material found during an outage', 'العثور على مواد غريبة خلال فترة إيقاف', 'A generic industry lesson on foreign material exclusion.', 'درس عام من القطاع حول منع دخول المواد الغريبة.', 'FME controls apply to every open system.', 'تنطبق ضوابط منع المواد الغريبة على كل نظام مفتوح.', 'EPRI', ['trait-10'], 'OE Screening Committee', ['qs-mech']],
    ['Contamination from an unsurveyed tool', 'تلوث من أداة غير ممسوحة', 'A generic lesson on tool control in contaminated areas.', 'درس عام حول التحكم في الأدوات في المناطق الملوثة.', 'Survey tools before release.', 'امسح الأدوات قبل إخراجها.', 'IAEA IRS', ['trait-7'], 'OE Screening Committee', ['qs-rp']],
    ['Supplier certificate mismatch caught at receiving', 'كشف عدم تطابق شهادة المورد عند الاستلام', 'Heat numbers missing from a material certificate were caught at receipt inspection.', 'كُشف غياب أرقام الصهر من شهادة مادة عند فحص الاستلام.', 'Verify certificates against the item, not the paperwork alone.', 'تحقق من الشهادات مقابل المادة لا الورق وحده.', 'internal', ['trait-2', 'trait-8'], 'OE Screening Committee', []],
  ].map(([title_en, title_ar, summary_en, summary_ar, lesson_en, lesson_ar, source_kind, trait_ids, reviewing_body, affected], i) => ({ id: `oe-${i + 1}`, title_en, title_ar, summary_en, summary_ar, lesson_en, lesson_ar, source_kind, trait_ids, reviewed_on: `2026-0${(i % 8) + 1}-15`, reviewing_body, deidentified: true, status: 'published', affected_standard_ids: affected, sample: true }));
  const cases = [
    ['ECP-2026-014', '2026-07-02', 'phone', true, 'nuclear_safety', 'closed', 'routine'],
    ['ECP-2026-019', '2026-08-11', 'intranet', true, 'quality', 'investigating', 'priority'],
    ['ECP-2026-022', '2026-09-03', 'ecp_office', false, 'hird', 'triaged', 'priority'],
    ['ECP-2026-025', '2026-09-21', 'email', true, 'other', 'referred', 'routine'],
    ['ECP-2026-027', '2026-10-05', 'unit_rep', false, 'nuclear_safety', 'received', 'routine'],
    ['ECP-2026-028', '2026-10-07', 'phone', true, 'quality', 'received', 'routine'],
  ].map(([ref_no, received_on, channel, anonymous, category, status, priority], i) => ({ id: `cc-${i + 1}`, ref_no, received_on, channel, anonymous, category, status, priority, triage_owner_role: status === 'received' ? null : 'ECP officer', triaged_at: status === 'received' ? null : `${received_on}T10:00:00Z`, ecp_system_ref: `ECP-SYS/${ref_no}`, sample: true }));
  return { traits, hu, ecp, oe, cases };
}

export function buildAdvanced() {
  const T = [
    ['bwr', 'Small boiling water reactor', 'مفاعل الماء المغلي الصغير', 'GE Hitachi / GE Vernova Hitachi; ORLEN Synthos Green Energy framework', 'جي إي هيتاشي / جي إي فيرنوفا هيتاشي؛ إطار أورلين سينثوس', 'BWRX-300', 'BWR plant systems and chemistry; new licensing basis', 'أنظمة مفاعلات الماء المغلي وكيمياؤها؛ أساس ترخيص جديد', 'Dec 2023, May 2025', ['wnn-smr-mous', 'wnn-gevh', 'wnn-osge']],
    ['htgr', 'High-temperature gas-cooled', 'المفاعلات عالية الحرارة المبرّدة بالغاز', 'X-energy; CNNC (HTGR MoU)', 'إكس-إنرجي؛ المؤسسة الصينية (مذكرة HTGR)', 'Xe-100', 'Gas coolant systems, different fuel form, high-temperature process heat', 'أنظمة التبريد بالغاز وشكل وقود مختلف وحرارة عمليات عالية', 'Dec 2023', ['wnn-smr-mous']],
    ['fast', 'Fast reactors with liquid-metal coolant', 'المفاعلات السريعة المبرّدة بالمعادن السائلة', 'TerraPower; Newcleo', 'تيراباور؛ نيوكليو', 'Natrium; lead-cooled fast reactor', 'Liquid-metal handling and chemistry, fast-spectrum physics', 'مناولة المعادن السائلة وكيمياؤها وفيزياء الطيف السريع', 'Dec 2023, Feb 2025', ['wnn-advance', 'wnn-newcleo']],
    ['micro', 'Microreactors', 'المفاعلات المتناهية الصغر', 'Westinghouse; USNC (assets now with NANO Nuclear)', 'وستنجهاوس؛ يو إس إن سي (أصولها لدى نانو نيوكلير)', 'eVinci; MMR', 'Remote and autonomous operation concepts, transportable units', 'مفاهيم التشغيل عن بعد والتشغيل الذاتي والوحدات القابلة للنقل', 'Dec 2023', ['wnn-smr-mous']],
    ['msr', 'Molten salt', 'مفاعلات الأملاح المنصهرة', 'MoltexFLEX', 'مولتكس فلكس', 'FLEX', 'Salt chemistry and materials', 'كيمياء الأملاح والمواد', 'Dec 2023', ['wnn-smr-mous']],
    ['intl', 'International projects', 'المشاريع الدولية', 'Westinghouse (AP1000 US MoU); Samsung C&T; KEPCO (SMR, AI, digital twins)', 'وستنجهاوس (مذكرة AP1000)؛ سامسونج سي آند تي؛ كيبكو', 'AP1000 and others', 'Project delivery abroad, investment and owner\'s-engineer skills (ENEC Consulting)', 'تنفيذ المشاريع في الخارج والاستثمار ومهارات مهندس المالك', 'Jul 2025, Nov 2025', ['admo-westinghouse', 'enec-samsung', 'wnn-kepco-2025']],
  ];
  const techs = T.map(([id, family_en, family_ar, partners_en, partners_ar, designs, skill_areas_en, skill_areas_ar, mou_date, sids], i) => ({ id: `tech-${id}`, family_en, family_ar, partners_en, partners_ar, designs, skill_areas_en, skill_areas_ar, mou_date, sources: srcs(...sids), sort: i + 1 }));
  const B = [
    ['reactor-operator', 'bwr', 'Plant fundamentals, conduct of operations, procedure use, simulator training habits', 'أساسيات المحطة وإدارة العمليات واستخدام الإجراءات وعادات التدريب على المحاكي', 'BWR reactivity control (recirculation flow), BWR emergency procedures, new tech specs', 'التحكم في تفاعلية مفاعلات الماء المغلي وإجراءات الطوارئ والمواصفات الفنية الجديدة'],
    ['reactor-operator', 'micro', 'Reactivity fundamentals, alarm response, conservative decisions', 'أساسيات التفاعلية والاستجابة للإنذارات والقرارات المتحفظة', 'Remote monitoring, autonomous control concepts, transport and siting constraints', 'المراقبة عن بعد ومفاهيم التحكم الذاتي وقيود النقل والموقع'],
    ['chemistry-technician', 'msr', 'Sampling discipline, lab QA, radiochemistry', 'انضباط أخذ العينات وضمان جودة المختبر والكيمياء الإشعاعية', 'Molten salt chemistry, corrosion in salt, high-temperature sampling', 'كيمياء الأملاح المنصهرة والتآكل فيها وأخذ العينات في درجات حرارة عالية'],
    ['chemistry-technician', 'fast', 'Water chemistry control principles', 'مبادئ ضبط كيمياء المياه', 'Sodium or lead coolant chemistry and handling', 'كيمياء مبرّد الصوديوم أو الرصاص ومناولته'],
    ['maintenance-technician-engineer', 'htgr', 'Work packages, FME, calibration', 'حزم العمل ومنع المواد الغريبة والمعايرة', 'Helium systems, graphite components, high-temperature materials', 'أنظمة الهيليوم ومكونات الغرافيت والمواد عالية الحرارة'],
    ['radiation-protection-technician', 'fast', 'Surveys, RWPs, ALARA', 'المسوحات وتصاريح العمل الإشعاعي ومبدأ ALARA', 'Different source terms and activation products', 'مصادر إشعاعية ونواتج تنشيط مختلفة'],
    ['systems-design-plant-engineer', 'bwr', 'Configuration management, system health', 'إدارة التهيئة وسلامة الأنظمة', 'BWR system design, new licensing basis', 'تصميم أنظمة مفاعلات الماء المغلي وأساس ترخيص جديد'],
    ['regulatory-affairs-licensing-engineer', 'intl', 'FANR licensing basis experience', 'خبرة أساس الترخيص لدى الهيئة', 'Other regulators\' frameworks, owner\'s-engineer roles abroad', 'أطر الجهات الرقابية الأخرى وأدوار مهندس المالك في الخارج'],
  ];
  const bridges = B.map(([from_role_id, t, transfers_en, transfers_ar, new_en, new_ar], i) => ({ id: `br-${i + 1}`, from_role_id, tech_id: `tech-${t}`, transfers_en, transfers_ar, new_en, new_ar }));
  const S = [
    ['Liquid-metal handling', 'مناولة المعادن السائلة', ['tech-fast']], ['Salt chemistry', 'كيمياء الأملاح', ['tech-msr']], ['Gas-coolant systems', 'أنظمة التبريد بالغاز', ['tech-htgr']],
    ['Remote / autonomous operation', 'التشغيل عن بعد / الذاتي', ['tech-micro']], ['BWR operations', 'تشغيل مفاعلات الماء المغلي', ['tech-bwr']], ['Owner\'s-engineer skills', 'مهارات مهندس المالك', ['tech-intl']],
    ['Digital twins', 'التوائم الرقمية', ['tech-intl', 'tech-micro']], ['AI governance', 'حوكمة الذكاء الاصطناعي', ['tech-intl']],
  ];
  const future = [];
  for (const scenario of ['Scenario A (SIMULATED)', 'Scenario B (SIMULATED)']) S.forEach(([skill_en, skill_ar, tech_ids], i) => future.push({ id: `fs-${scenario[9]}-${i + 1}`, skill_en, skill_ar, tech_ids, scenario, value: scenario.includes('A') ? 20 + ((i * 17) % 60) : 35 + ((i * 23) % 55), simulated: true }));
  return { techs, bridges, future };
}

export function buildTalent() {
  const crit = (en, ar, kind = 'info') => ({ en, ar, kind });
  const T = [
    ['mustaqbali', 'Mustaqbali', 'مستقبلي', 'school', 'uae_only', 'High-school students', 'طلاب المدارس الثانوية', '2 weeks', 'أسبوعان', '2-week STEM experience; 50 participants in 2024', 'تجربة في العلوم والتكنولوجيا لمدة أسبوعين؛ 50 مشاركاً في 2024', 'Discover nuclear careers early', 'التعرف المبكر على المهن النووية', 'in_kafaa', ['sr2024', 'cns10'], null, [crit('UAE national', 'مواطن إماراتي', 'nationality'), crit('In high school', 'طالب في المرحلة الثانوية', 'education')]],
    ['dnt', 'Diploma in Nuclear Technology (DNT)', 'دبلوم التكنولوجيا النووية', 'school_leaver', 'uae_only', 'UAE high-school graduates', 'خريجو الثانوية العامة من المواطنين', '24 months', '24 شهراً', 'Leads to Local Operator or Maintenance Technician; national vocational qualification; first cohort of 20 graduated 17 Jun 2026', 'يقود إلى مشغّل محلي أو فني صيانة؛ مؤهل مهني وطني؛ تخرج أول دفعة من 20 طالباً في 17 يونيو 2026', 'Local Operator or Maintenance Technician', 'مشغّل محلي أو فني صيانة', 'in_kafaa', ['enec-dnt-grad', 'enec-dnt-launch', 'sr2024'], 'DNT start: 2023 (launch release) or 2024 (graduation release); first cohort 20 (SR2024) or 30 recruited (CNS).', [crit('UAE national', 'مواطن إماراتي', 'nationality'), crit('High-school diploma', 'شهادة الثانوية العامة', 'education'), crit('Monthly stipend during the programme', 'مكافأة شهرية خلال البرنامج', 'info')]],
    ['internships', 'University internships', 'التدريب الداخلي للطلاب الجامعيين', 'university', 'uae_priority', 'University students', 'طلاب الجامعات', 'Placement', 'فترة تدريب', '22 university interns in 2024; online registration with screening exams and interviews', '22 متدرباً جامعياً في 2024؛ تسجيل إلكتروني مع اختبارات فرز ومقابلات', 'Work experience at ENEC', 'خبرة عملية في ENEC', 'in_kafaa', ['sr2024'], null, [crit('Enrolled at university', 'مسجل في جامعة', 'education'), crit('Screening exams and interviews', 'اختبارات فرز ومقابلات', 'info')]],
    ['energy-pioneers', 'Energy Pioneers (scholarships)', 'رواد الطاقة (المنح الدراسية)', 'university', 'uae_only', 'Science and engineering students', 'طلاب العلوم والهندسة', 'Degree duration', 'مدة الدراسة الجامعية', 'Since 2009; "over 500 UAE Nationals benefitted"; partner universities in the UAE, US and Korea', 'منذ 2009؛ "استفاد أكثر من 500 مواطن"؛ جامعات شريكة في الإمارات والولايات المتحدة وكوريا', 'Sponsored degree and a role at ENEC', 'شهادة برعاية وفرصة عمل في ENEC', 'in_kafaa', ['enec-talent'], null, [crit('UAE national', 'مواطن إماراتي', 'nationality'), crit('Admission to a partner university programme', 'القبول في برنامج جامعة شريكة', 'education')]],
    ['gdp', 'Graduate Development Program (GDP)', 'برنامج تطوير الخريجين', 'graduate', 'uae_only', 'Top bachelor\'s graduates', 'خريجو البكالوريوس المتميزون', '18-36 months (careers page); 12-30 months (GPO release)', '18-36 شهراً (صفحة الوظائف)؛ 12-30 شهراً (بيان البرنامج)', 'Position-targeted, workplace-based; 22 recruited in 2024', 'تطوير موجه للوظيفة في مكان العمل؛ 22 خريجاً في 2024', 'A targeted position', 'وظيفة مستهدفة', 'in_kafaa', ['enec-careers', 'sr2024'], 'GDP length: 18-36 months (careers page) vs 12-30 months (Aug 2025 GPO release).', [crit('UAE national', 'مواطن إماراتي', 'nationality'), crit('Bachelor\'s degree', 'شهادة بكالوريوس', 'education')]],
    ['gpo', 'Graduate Plant Operator (GPO)', 'مشغّل المحطة للخريجين', 'graduate', 'uae_only', 'Emirati BSc engineering graduates', 'خريجو بكالوريوس الهندسة المواطنون', 'Start as LO; SRO training after three years', 'البدء كمشغّل محلي؛ تدريب المشغّل الأول بعد ثلاث سنوات', 'Launched 21 Aug 2025', 'أُطلق في 21 أغسطس 2025', 'Route to Senior Reactor Operator', 'مسار إلى مشغّل المفاعل الأول', 'in_kafaa', ['enec-gpo'], null, [crit('UAE national', 'مواطن إماراتي', 'nationality'), crit('BSc in engineering', 'بكالوريوس في الهندسة', 'education')]],
    ['train-for-work', 'Train for Work', 'التدريب من أجل العمل', 'experienced', 'uae_only', 'UAE national job seekers', 'الباحثون عن عمل من المواطنين', '6 months (careers page); 6-12 months (CNS)', '6 أشهر (صفحة الوظائف)؛ 6-12 شهراً (تقرير الاتفاقية)', 'Abu Dhabi HRA initiative; 39 trainees in 2024, 71% placed permanently', 'مبادرة هيئة الموارد البشرية في أبوظبي؛ 39 متدرباً في 2024، 71% منهم عُيّنوا بشكل دائم', 'Placement and possible permanent role', 'تدريب وفرصة وظيفة دائمة', 'link_out', ['sr2024', 'enec-careers'], null, [crit('UAE national', 'مواطن إماراتي', 'nationality'), crit('Job seeker', 'باحث عن عمل', 'info')]],
    ['mawaheb', 'DGE Mawaheb agreement', 'اتفاقية مواهب مع دائرة التمكين الحكومي', 'mixed', 'uae_only', 'High school, diploma or postgraduate', 'الثانوية أو الدبلوم أو الدراسات العليا', 'Five-year agreement', 'اتفاقية لخمس سنوات', 'Signed May 2026 to qualify at least 100 UAE nationals; ENEC funds training and stipends', 'وُقّعت في مايو 2026 لتأهيل ما لا يقل عن 100 مواطن؛ تموّل ENEC التدريب والمكافآت', 'Qualification for nuclear roles', 'التأهيل لأدوار نووية', 'link_out', ['enec-dge', 'wnn-dge'], 'Signing date: 6 May (ENEC) vs 14 May (Abu Dhabi Media Office) vs 27 May 2026 (WNN).', [crit('UAE national', 'مواطن إماراتي', 'nationality')]],
    ['ku-msc', 'Khalifa University MSc in Nuclear Engineering', 'ماجستير الهندسة النووية في جامعة خليفة', 'postgraduate', 'uae_priority', 'Engineering graduates', 'خريجو الهندسة', 'MSc programme', 'برنامج ماجستير', 'Since 2010; aimed at careers at FANR, ENEC and ENEC Operations; available to UAE and Saudi nationals', 'منذ 2010؛ يستهدف المهن في الهيئة وENEC وENEC للعمليات؛ متاح للمواطنين الإماراتيين والسعوديين', 'Careers at FANR, ENEC and ENEC Operations', 'مهن في الهيئة وENEC', 'link_out', ['ku-msc'], null, [crit('UAE or Saudi national', 'مواطن إماراتي أو سعودي', 'nationality'), crit('Engineering degree', 'شهادة في الهندسة', 'education')]],
  ];
  const programmes = T.map(([id, name_en, name_ar, stage, nationality, education_en, education_ar, duration_en, duration_ar, facts_en, facts_ar, outcome_en, outcome_ar, apply_mode, sids, conflict_note, criteria], i) => ({
    id, name_en, name_ar, stage, nationality, education_en, education_ar, duration_en, duration_ar, facts_en, facts_ar, outcome_en, outcome_ar, apply_mode,
    link_out_url: apply_mode === 'link_out' ? (id === 'ku-msc' ? src('ku-msc').url : src('enec-talent').url) : null, sources: srcs(...sids), conflict_note, criteria, sort: i + 1,
    nexus_program_id: { dnt: 'TP-DNT', 'energy-pioneers': 'TP-EP', gpo: 'TP-GPO', gdp: 'TP-GDP', mawaheb: 'TP-MAWAHEB', 'ku-msc': 'TP-SCHOL' }[id] ?? null,
  }));
  const events = [
    ['ev-tamouh', 'Tamouh Al Dhafra career fair', 'معرض طموح الظفرة للتوظيف', 'career_fair', '2025-04-30', '2025-05-01', 'Al Dhafra', 'الظفرة', ['enec-dhafra'], false],
    ['ev-nitss', 'Nuclear Innovation & Technology Summer School', 'المدرسة الصيفية للابتكار والتكنولوجيا النووية', 'summer_school', '2024-07-15', null, 'Abu Dhabi', 'أبوظبي', ['cns10'], false],
    ['ev-adsf', 'Abu Dhabi Science Festival (sample date)', 'مهرجان أبوظبي للعلوم (تاريخ تجريبي)', 'festival', '2026-11-20', '2026-11-29', 'Abu Dhabi', 'أبوظبي', [], true],
    ['ev-dnt-info', 'DNT information session (sample)', 'جلسة تعريفية بدبلوم التكنولوجيا النووية (تجريبية)', 'info_session', '2026-11-04', null, 'Online', 'عبر الإنترنت', [], true],
    ['ev-gpo-webinar', 'GPO webinar for engineering graduates (sample)', 'ندوة إلكترونية لبرنامج مشغّل المحطة للخريجين (تجريبية)', 'webinar', '2026-11-12', null, 'Online', 'عبر الإنترنت', [], true],
    ['ev-tamouh-2026', 'Al Dhafra career fair 2026 (sample date)', 'معرض الظفرة للتوظيف 2026 (تاريخ تجريبي)', 'career_fair', '2027-04-28', '2027-04-29', 'Al Dhafra', 'الظفرة', [], true],
  ].map(([id, title_en, title_ar, kind, starts_on, ends_on, location_en, location_ar, sids, sample]) => ({ id, title_en, title_ar, kind, starts_on, ends_on, location_en, location_ar, url: null, audience: 'Students and job seekers', sources: srcs(...sids), sample }));
  const careers = src('enec-careers').url;
  const vacancies = [
    ['Local Operator trainee (DNT graduate intake)', 'متدرب مشغّل محلي (دفعة خريجي الدبلوم)', 'local-operator', 'enec-ops', 'Barakah, Al Dhafra', true],
    ['Reactor Operator (experienced)', 'مشغّل مفاعل (ذو خبرة)', 'reactor-operator', 'enec-ops', 'Barakah, Al Dhafra', false],
    ['Radiation Protection Technician', 'فني وقاية من الإشعاع', 'radiation-protection-technician', 'enec-ops', 'Barakah, Al Dhafra', false],
    ['I&C Maintenance Engineer', 'مهندس صيانة أجهزة وتحكم', 'maintenance-technician-engineer', 'enec-ops', 'Barakah, Al Dhafra', false],
    ['Systems Engineer', 'مهندس أنظمة', 'systems-design-plant-engineer', 'enec-ops', 'Barakah, Al Dhafra', false],
    ['Nuclear Training Instructor (simulator)', 'مدرب تدريب نووي (المحاكي)', 'nuclear-training-instructor', 'enec-ops', 'Barakah, Al Dhafra', false],
    ['Procurement Engineer (supplier development)', 'مهندس مشتريات (تطوير الموردين)', 'procurement-engineer', 'enec', 'Abu Dhabi', false],
    ['Administrative Assistant', 'مساعد إداري', 'corporate-professional', 'enec', 'Abu Dhabi', true],
  ].map(([title_en, title_ar, role_id, entity_id, location, uae], i) => ({ id: `vac-${i + 1}`, title_en, title_ar, role_id, entity_id, location, uae_nationals_only: uae, posted_on: `2026-09-${String(10 + i * 2).padStart(2, '0')}`, closes_on: `2026-11-${String(5 + i * 2).padStart(2, '0')}`, official_url: careers, status: 'open', sample: true }));
  return { programmes, events, vacancies };
}

export function buildKpis() {
  const K = [];
  const add = (metric, label_en, label_ar, period, value, unit, source, source_url, pub, sample = false, def_en = '', def_ar = '') => K.push({ id: `kpi-${metric}-${period}`, metric, label_en, label_ar, period, value, unit, source, source_url, sample, public: pub, definition_en: def_en, definition_ar: def_ar });
  const sr = src('sr2024').url;
  [['2022', 3050], ['2023', 2988], ['2024', 2979]].forEach(([p, v]) => add('employees', 'Employees', 'الموظفون', p, v, 'people', 'SR2024 p.78-79', sr, true, false, 'Total employees, ENEC + ENEC Operations + ENEC Commercial (GRI 2-7).', 'إجمالي الموظفين في ENEC وشركتيها (GRI 2-7).'));
  [['2022', 51.18], ['2023', 52.54], ['2024', 54.7]].forEach(([p, v]) => add('emiratization', 'Emiratization, organisation', 'التوطين على مستوى المؤسسة', p, v, '%', 'SR2024 p.90', sr, true, false, 'UAE nationals as a share of employees (GRI 405-1).', 'نسبة المواطنين من الموظفين (GRI 405-1).'));
  [['2022', 63.29], ['2023', 68.13], ['2024', 63.4]].forEach(([p, v]) => add('emiratization_senior', 'Emiratization, senior management', 'التوطين في الإدارة العليا', p, v, '%', 'SR2024 p.90', sr, true));
  [['2022', 17.02], ['2023', 17.17], ['2024', 16.75]].forEach(([p, v]) => add('women', 'Women in workforce', 'النساء في القوى العاملة', p, v, '%', 'SR2024 p.78-79', sr, true));
  [['2022', 805962], ['2023', 537662], ['2024', 581090]].forEach(([p, v]) => add('training_hours', 'Training hours', 'ساعات التدريب', p, v, 'h', 'SR2024 p.49', sr, true));
  [['2022', 264.25], ['2023', 201.1], ['2024', 218.45]].forEach(([p, v]) => add('training_hours_per_employee', 'Training hours per employee', 'ساعات التدريب لكل موظف', p, v, 'h', 'SR2024 p.49', sr, true));
  [['2022', 50], ['2023', 62], ['2024', 97]].forEach(([p, v]) => add('top_positions_uae', 'UAE nationals in top positions', 'المواطنون في المناصب العليا', p, v, 'people', 'SR2024 p.90', sr, true));
  [['2022', 5.34], ['2023', 6.0], ['2024', 7.3]].forEach(([p, v]) => add('attrition', 'Attrition (chart parsing uncertain)', 'معدل الدوران (قراءة الرسم غير مؤكدة)', p, v, '%', 'SR2024 p.80', sr, false));
  add('hires', 'Hires', 'التعيينات', '2024', 155, 'people', 'SR2024 p.80 (chart parsing uncertain)', sr, false);
  add('sro_ro', 'SRO/RO workforce', 'القوى العاملة من المشغّلين المعتمدين', '2025-08', 190, 'people', 'ENEC GPO release (Aug 2025)', src('enec-gpo').url, true);
  add('coct_population', 'Operators in COCT', 'المشغّلون في التدريب المستمر', '2024', 182, 'people', 'SR2024 p.51; CNS Art. 11.2(c)', sr, false);
  add('loct_population', 'Local operators in LOCT', 'المشغّلون المحليون في التدريب المستمر', '2024', 162, 'people', 'SR2024 p.51', sr, false);
  // SAMPLE internal KPIs for the demo tenant
  [['2026-Q1', 96], ['2026-Q2', 97], ['2026-Q3', 98]].forEach(([p, v]) => add('quals_renewed_on_time', 'Qualifications renewed before expiry', 'المؤهلات المجددة قبل انتهائها', p, v, '%', 'Demo tenant', null, false, true));
  [['2026-Q1', 0], ['2026-Q2', 0], ['2026-Q3', 1]].forEach(([p, v]) => add('lapses', 'Licence validity lapses', 'حالات انقضاء صلاحية الترخيص', p, v, 'count', 'Demo tenant', null, false, true));
  [['2026-Q1', 4.1], ['2026-Q2', 3.6], ['2026-Q3', 3.2]].forEach(([p, v]) => add('jpm_to_signed_days', 'Days from JPM performed to record signed', 'الأيام من أداء المقياس حتى توقيع السجل', p, v, 'days', 'Demo tenant', null, false, true));
  [['2026-Q1', 18], ['2026-Q2', 15], ['2026-Q3', 12]].forEach(([p, v]) => add('equivalency_turnaround', 'Equivalency decision turnaround', 'مدة البت في طلبات المعادلة', p, v, 'days', 'Demo tenant', null, false, true));
  return K;
}

export function buildWorkforce(families) {
  // SAMPLE aggregates per job family for the demo tenant. Some groups are deliberately below 10 to exercise suppression.
  const out = [];
  const sizes = { operations: 640, maintenance: 520, engineering: 410, 'radiation-protection': 120, chemistry: 70, 'nuclear-fuel': 24, outage: 60, 'emergency-preparedness': 18, security: 210, cyber: 45, safeguards: 7, quality: 85, oversight: 40, licensing: 22, training: 96, 'health-safety': 38, environment: 9, 'supply-chain': 150, 'fire-protection': 55, corporate: 350 };
  for (const f of families) {
    const n = sizes[f.id] ?? 20;
    const em = Math.round(n * (0.45 + ((f.sort * 7) % 25) / 100));
    const wm = Math.round(n * (0.08 + ((f.sort * 5) % 15) / 100));
    out.push({ id: `ws-2026q3-${f.id}-hc`, period: '2026-Q3', entity_id: null, family_id: f.id, level: null, measure: 'headcount', value: n, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
    out.push({ id: `ws-2026q3-${f.id}-em`, period: '2026-Q3', entity_id: null, family_id: f.id, level: null, measure: 'emirati', value: em, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
    out.push({ id: `ws-2026q3-${f.id}-wo`, period: '2026-Q3', entity_id: null, family_id: f.id, level: null, measure: 'women', value: wm, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
    out.push({ id: `ws-2026q3-${f.id}-th`, period: '2026-Q3', entity_id: null, family_id: f.id, level: null, measure: 'training_hours', value: n * 52, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
  }
  for (const [lvl, n, e] of [['entry', 820, 520], ['professional', 1420, 720], ['senior', 560, 260], ['leadership', 179, 115]]) {
    out.push({ id: `ws-2026q3-level-${lvl}-hc`, period: '2026-Q3', entity_id: null, family_id: null, level: lvl, measure: 'headcount', value: n, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
    out.push({ id: `ws-2026q3-level-${lvl}-em`, period: '2026-Q3', entity_id: null, family_id: null, level: lvl, measure: 'emirati', value: e, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
  }
  for (const [ent, n, e] of [['enec', 640, 410], ['enec-ops', 2210, 1120], ['enec-com', 60, 38], ['enec-con', 69, 25]]) {
    out.push({ id: `ws-2026q3-ent-${ent}-hc`, period: '2026-Q3', entity_id: ent, family_id: null, level: null, measure: 'headcount', value: n, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
    out.push({ id: `ws-2026q3-ent-${ent}-em`, period: '2026-Q3', entity_id: ent, family_id: null, level: null, measure: 'emirati', value: e, group_size: n, source: 'Demo tenant (SAMPLE)', sample: true });
  }
  // [G3] Earlier quarters for trends, hires and leavers by family, organisation totals, women by level and age bands (M07).
  const S = 'Demo tenant (SAMPLE)';
  const row = (id, period, dims, measure, value, group_size) => out.push({ id, period, entity_id: dims.entity_id ?? null, family_id: dims.family_id ?? null, level: dims.level ?? null, measure, value, group_size, source: S, sample: true });
  const totals = {};
  const addT = (period, m, v) => { totals[period] ??= {}; totals[period][m] = (totals[period][m] ?? 0) + v; };
  for (const [period, scale, emAdj, thPer] of [['2026-Q1', 0.97, -0.02, 49], ['2026-Q2', 0.985, -0.01, 50], ['2026-Q3', 1, 0, 52]]) {
    const pk = period.toLowerCase().replace('-', '');
    for (const f of families) {
      const base = sizes[f.id] ?? 20;
      const n = period === '2026-Q3' ? base : Math.max(1, Math.round(base * scale));
      const em = Math.round(n * (0.45 + ((f.sort * 7) % 25) / 100 + emAdj));
      const wm = Math.round(n * (0.08 + ((f.sort * 5) % 15) / 100));
      if (period !== '2026-Q3') {
        row(`ws-${pk}-${f.id}-hc`, period, { family_id: f.id }, 'headcount', n, n);
        row(`ws-${pk}-${f.id}-em`, period, { family_id: f.id }, 'emirati', em, n);
        row(`ws-${pk}-${f.id}-wo`, period, { family_id: f.id }, 'women', wm, n);
        row(`ws-${pk}-${f.id}-th`, period, { family_id: f.id }, 'training_hours', n * thPer, n);
      }
      const hires = Math.round(n * (0.035 + ((f.sort * 3) % 4) / 100));
      const leavers = Math.round(n * (0.012 + ((f.sort * 2) % 3) / 200));
      row(`ws-${pk}-${f.id}-hi`, period, { family_id: f.id }, 'hires', hires, n);
      row(`ws-${pk}-${f.id}-at`, period, { family_id: f.id }, 'attrition', leavers, n);
      addT(period, 'headcount', n); addT(period, 'emirati', em); addT(period, 'women', wm); addT(period, 'training_hours', n * (period === '2026-Q3' ? 52 : thPer)); addT(period, 'hires', hires); addT(period, 'attrition', leavers);
    }
    const hc = totals[period].headcount;
    for (const [m, v] of Object.entries(totals[period])) row(`ws-${pk}-org-${m}`, period, {}, m, v, hc);
  }
  for (const [lvl, n, w] of [['entry', 820, 168], ['professional', 1420, 252], ['senior', 560, 62], ['leadership', 179, 16]]) row(`ws-2026q3-level-${lvl}-wo`, '2026-Q3', { level: lvl }, 'women', w, n);
  for (const [m, v] of [['age_18_30', 506], ['age_31_50', 1874], ['age_51_plus', 589]]) row(`ws-2026q3-org-${m}`, '2026-Q3', {}, m, v, 2969);
  return out;
}

export function buildCriticalRoles() {
  return [
    ['senior-reactor-operator', 90, 84, 14, 22], ['reactor-operator', 110, 106, 56, 40], ['local-operator', 180, 162, 237, 35], ['shift-supervisor', 24, 22, 6, 10],
    ['nuclear-training-instructor', 40, 33, 6, 8], ['radiation-protection-technician', 60, 52, 18, 12], ['chemistry-technician', 34, 30, 8, 6], ['emergency-preparedness-coordinator', 16, 14, 3, 4],
  ].flatMap(([role_id, target_bench, qualified, in_training, pipeline]) => [
    { id: `crit-${role_id}`, role_id, period: '2026-Q3', target_bench, qualified, in_training, pipeline, source: 'Demo tenant (SAMPLE)', sample: true },
    // [G3] previous quarter for the bench-depth trend
    { id: `crit-${role_id}-2026q2`, role_id, period: '2026-Q2', target_bench, qualified: Math.max(0, qualified - 2), in_training: in_training + 1, pipeline: Math.max(0, pipeline - 3), source: 'Demo tenant (SAMPLE)', sample: true },
  ]);
}

export function buildDalil(pages, roles) {
  const docs = [];
  for (const p of pages) docs.push({ id: `cd-${p.id}`, title: p.title_en, url: `/kafaa/${p.slug}`, kind: 'kafaa_page', modes: p.zone === 'public' ? ['public', 'applicant', 'staff', 'partner'] : ['staff'], is_public: p.zone === 'public', approved: true, text_en: p.body_en, text_ar: p.body_ar, updated_at: '2026-10-08T00:00:00Z' });
  for (const r of roles) docs.push({ id: `cd-role-${r.id}`, title: r.title_en, url: `/kafaa/careers/roles/${r.id}`, kind: 'kafaa_page', modes: ['public', 'applicant', 'staff', 'partner'], is_public: true, approved: true, text_en: `${r.title_en}. ${r.summary_en} Qualifications: ${r.qualifications_en} Training: ${r.training_path_en} Authority: ${r.licensing_body_en}. ${(r.entry_routes || []).map((e) => `${e.en} (${e.rule_ref})`).join('; ')}`, text_ar: `${r.title_ar}. ${r.summary_ar}`, updated_at: '2026-10-08T00:00:00Z' });
  docs.push({ id: 'cd-fanr-reg17', title: 'FANR-REG-17 Certification of Operating Personnel', url: src('fanr-reg17').url, kind: 'fanr_page', modes: ['public', 'applicant', 'staff'], is_public: true, approved: true, text_en: 'RO entry (Art. 4): high-school diploma plus 36 months as a fully qualified LO; or 24 months as RO/SRO at another plant plus 12 months at Barakah including 6 on crew; or 24 months at a fossil or different-type plant plus 12 months at Barakah including 9 on crew; plus UAE security clearance. SRO entry: 24 months as RO at Barakah; or a BSc plus 24 months at Barakah including 12 as LO; or 24 months as RO/SRO/SRO-QI elsewhere plus 12 at Barakah including 6 on crew. Certificate valid 5 years. Medical every 12 months. Each quarter at least 7 eight-hour or 5 twelve-hour shifts; SRO at least 2 in the SRO role.', text_ar: 'متطلبات الالتحاق بالمادة 4 وصلاحية الشهادة 5 سنوات والفحص الطبي كل 12 شهراً والحد الأدنى للنوبات ربع السنوية.', updated_at: '2026-10-08T00:00:00Z' });
  const refusals = [
    ['operations', 'Plant operations and procedures', 'عمليات المحطة وإجراءاتها', ['procedure', 'how do i operate', 'setpoint', 'emergency operating procedure', 'تشغيل المفاعل'], 'I can\'t help with plant operating procedures. For careers in operations, see the Career Map.', 'لا يمكنني المساعدة في إجراءات تشغيل المحطة. للاطلاع على المهن في العمليات راجع خريطة المهن.', false],
    ['security', 'Security and physical protection', 'الأمن والحماية المادية', ['security arrangement', 'guard', 'physical protection', 'perimeter', 'access control', 'drone', 'الأمن'], 'I can\'t discuss plant security. If you are interested in a security career, the Career Map shows the path and the public requirements.', 'لا يمكنني مناقشة أمن المحطة. إذا كنت مهتماً بمهنة في الأمن، تعرض خريطة المهن المسار والمتطلبات العامة.', false],
    ['safeguards', 'Safeguards', 'الضمانات', ['safeguards', 'nuclear material account', 'inventory of uranium'], 'Safeguards details are out of scope. The IAEA and FANR publish general information.', 'تفاصيل الضمانات خارج النطاق. تنشر الوكالة والهيئة معلومات عامة.', false],
    ['cyber', 'Cyber details', 'تفاصيل الأمن السيبراني', ['network', 'firewall', 'scada', 'vulnerability', 'password'], 'I can\'t discuss cyber security details.', 'لا يمكنني مناقشة تفاصيل الأمن السيبراني.', false],
    ['emergency', 'Emergency actions', 'إجراءات الطوارئ', ['evacuat', 'iodine', 'emergency zone', 'what should i do in an emergency', 'طوارئ'], 'For emergency guidance, use official ENEC and NCEMA pages: Go In, Stay In, Listen In.', 'لإرشادات الطوارئ استخدم صفحات ENEC والهيئة الوطنية الرسمية: ادخل، ابقَ في الداخل، استمع.', false],
    ['medical', 'Medical matters', 'المسائل الطبية', ['medical condition', 'diagnos', 'my health', 'fitness for duty test result'], 'I can\'t discuss medical matters. Occupational health can help.', 'لا يمكنني مناقشة المسائل الطبية. يمكن للصحة المهنية المساعدة.', false],
    ['exam', 'Exam items', 'أسئلة الاختبارات', ['exam question', 'exam answer', 'answer key', 'what is on the fanr exam'], 'I can\'t share exam content. Practice quizzes on public topics are available in Learn.', 'لا يمكنني مشاركة محتوى الاختبارات. تتوفر اختبارات تدريبية في موضوعات عامة.', false],
    ['personal', 'Other people\'s personal data', 'البيانات الشخصية للآخرين', ['who is the', 'name of the operator', 'phone number of', 'email of'], 'I can\'t share information about other people.', 'لا يمكنني مشاركة معلومات عن أشخاص آخرين.', false],
    ['decision', 'Eligibility decisions', 'قرارات الأهلية', ['am i eligible', 'will i be accepted', 'will i pass', 'predict my'], 'I can explain the published criteria, but I can\'t decide or predict eligibility, admission or licensing outcomes. ENEC and FANR decide.', 'يمكنني شرح المعايير المنشورة، لكن لا يمكنني تقرير الأهلية أو القبول أو نتائج الترخيص أو توقعها. تقرر ENEC والهيئة ذلك.', false],
    ['concern', 'Concerns (stop and show ECP channels)', 'المخاوف (التوقف وعرض القنوات)', ['i want to report', 'report a concern', 'harass', 'retaliat', 'unsafe', 'أريد الإبلاغ', 'أبلغ عن'], 'I can\'t take concerns. Please use the Employee Concerns Program channels: ECP offices, the intranet portal, the 24/7 phone line, email, unit representatives, or FANR\'s Report to Protect.', 'لا يمكنني تلقي المخاوف. يرجى استخدام قنوات برنامج مخاوف الموظفين: المكاتب وبوابة الشبكة الداخلية والخط الهاتفي على مدار الساعة والبريد الإلكتروني وممثلي الوحدات أو نظام "أبلغ لتحمي" لدى الهيئة.', true],
  ].map(([category, description_en, description_ar, patterns, response_en, response_ar, stop_conversation]) => ({ id: `rp-${category}`, category, description_en, description_ar, patterns, response_en, response_ar, enabled: true, stop_conversation }));
  const settings = [{ id: 'global', enabled: true, public_rate_limit_per_hour: 20, staff_mode: true, model_gateway: 'Grounded retrieval over the approved corpus (demo); UAE-hosted model option in production', retention_days: 30, updated_at: '2026-10-08T00:00:00Z', updated_by: null }];
  const evals = [
    { id: 'eval-2026-09', run_at: '2026-09-28T09:00:00Z', release: 'r0.9', lang: 'both', in_scope_total: 120, cited_correct: 112, refusal_total: 60, refusal_correct: 59, pass: false, notes: 'Citation rate 93.3% below the 95% floor; one security red-team miss. Blocked release.' },
    { id: 'eval-2026-10', run_at: '2026-10-06T09:00:00Z', release: 'r1.0', lang: 'both', in_scope_total: 120, cited_correct: 116, refusal_total: 60, refusal_correct: 60, pass: true, notes: 'Citation rate 96.7%; 100% refusal on the security red-team set.' },
  ];
  return { docs, refusals, settings, evals };
}

export function buildIntegrations() {
  return [
    ['hr', 'HR system of record', 'HRIS', 'people, org, positions', 'in', '2026-10-08T02:00:00Z', 24, 'ok', 2979, 0, 'Nightly', 'Joiner, mover and leaver events; leavers lose access within one sync cycle.'],
    ['trs', 'Training records system', 'Training records', 'qualifications, training history', 'in', '2026-10-08T03:00:00Z', 24, 'ok', 41200, 3, 'Nightly', 'Kafa\'a mirrors qualification records until ENEC approves it as the system of record. 3 reconciliation errors open.'],
    ['octs', 'Licensee certification records (OCTS mirror)', 'Licensing', 'RO/SRO certificate status', 'in', '2026-10-08T04:00:00Z', 72, 'ok', 196, 0, 'Daily', 'FANR records decisions in OCTS; Kafa\'a mirrors status from the licensee\'s certification records.'],
    ['roster', 'Shift roster feed (counts only)', 'Roster', 'quarterly shift counts', 'in', '2026-10-07T22:00:00Z', 24, 'ok', 196, 0, 'Daily', 'Counts only; no rosters or crew composition.'],
    ['ohs', 'Occupational health (flag only)', 'Occupational health', 'medical due dates and fit flag', 'in', '2026-10-03T05:00:00Z', 72, 'stale', 196, 0, 'Daily', 'Stale: last success more than 72 hours ago. Medical flags show "not yet confirmed".'],
    ['careers', 'ENEC careers channel', 'Careers', 'vacancies (link-out)', 'in', '2026-10-08T01:00:00Z', 24, 'ok', 8, 0, 'Daily', 'Vacancies link out to the official careers channel.'],
    ['lms', 'E-learning (xAPI)', 'LMS', 'e-learning completions', 'in', '2026-10-08T01:30:00Z', 24, 'degraded', 76079, 12, 'Hourly', '12 statements rejected for unknown activity ids.'],
    ['nexus-ledger', 'ENEC NEXUS evidence ledger', 'NEXUS', 'material actions (append)', 'out', '2026-10-08T08:00:00Z', 24, 'ok', 0, 0, 'On event', 'Consequential actions append to nexus_append_ledger, plane PEOPLE.'],
    ['nexus-partner', 'NEXUS partner lens hand-off', 'NEXUS', 'supplier readiness summaries', 'out', '2026-10-01T08:00:00Z', 168, 'ok', 1, 0, 'On event', 'Ready suppliers hand off to /partner/readiness in NEXUS.'],
    ['uaepass', 'UAE Pass (concept)', 'Identity', 'verified identity when a stage needs it', 'in', '2026-10-01T00:00:00Z', 720, 'disabled', 0, 0, 'On demand', 'Not connected in the demo tenant.'],
  ].map(([id, name, system_kind, domain, direction, last_success, threshold_hours, status, records, errors, schedule, notes]) => ({ id: `int-${id}`, name, system_kind, domain, direction, last_success, threshold_hours, status, records, errors, schedule, notes }));
}
