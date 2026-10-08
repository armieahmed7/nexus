// F09 (wave 1 · E5) Future Me seed: horizon lanes 2026-2035 with public sources, source-linked learning suggestions for the
// ADVANCE skill bridges (catalogue courses, ADVANCE tracks, KU MSc, NITSS summer school, SRC/GIEMS MoU, public readings), and
// synthetic interest and goal rows so the HR demand signal has cells above and below the suppression threshold (10).
// Synthetic people only (w-* / p-* rows of the people table); no headcount, no site information, no real names.
import { goalTarget, goalId } from '../../../src/modules/m21/goals.ts';

const AS_OF = '2026-10-08';
// Public sources not in the shared registry (scripts/seed/sources.mjs); checked 8 Oct 2026 for BACKLOG.md [S19], [S25].
const EXTRA = {
  'wef-foj-2025': { label: 'WEF · Future of Jobs Report 2025 (press release, Jan 2025)', url: 'https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/' },
  'nea-nest': { label: 'OECD NEA · Building the vital skills for the future of nuclear energy (NEST)', url: 'https://www.oecd-nea.org/jcms/pl_56329/building-the-vital-skills-for-the-future-of-nuclear-energy' },
};

/** Small deterministic hash (FNV-1a) for stable synthetic picks. */
function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}

export default function build(T) {
  const reg = new Map(T.sources.map((s) => [s.id, s]));
  const S = (...ids) => ids.map((id) => {
    const r = reg.get(id) ?? EXTRA[id];
    if (!r) throw new Error(`f09: unknown source ${id}`);
    return { id, label: r.label, url: r.url, as_of: r.accessed ?? AS_OF };
  });

  // ───────────── horizon lanes (public; checked by publicTextIsClean in tests and PGlite)
  const L = (id, code, horizon, skill_ids, role_ids, path_only_role_ids, sources, sort, title_en, title_ar, summary_en, summary_ar, why_en, why_ar) =>
    ({ id, code, title_en, title_ar, summary_en, summary_ar, why_en, why_ar, skill_ids, horizon, path_only_role_ids, role_ids, sources, sort });
  T.horizon_lanes = [
    L('lane-digital', 'HZ-1', 'now', ['sk-mp-02-dic', 'sk-mp-02', 'sk-da-01', 'sk-da-01-analysis', 'sk-da-01-scripting', 'sk-da-01-twins', 'sk-en-02-perf'],
      ['maintenance-technician-engineer', 'systems-design-plant-engineer'], [], S('enec-presight', 'wnn-kepco-2025', 'wef-foj-2025'), 1,
      'Digital I&C and plant data', 'أجهزة القياس والتحكم الرقمية وبيانات المحطة',
      'Maintaining the APR-1400 digital platform, trending plant data and working with digital models of systems.',
      'صيانة منصة APR-1400 الرقمية، وتحليل اتجاهات بيانات المحطة، والعمل مع النماذج الرقمية للأنظمة.',
      'Barakah runs on digital instrumentation and control. ENEC is building data and AI platforms with partners, and the WEF expects technology skills to grow fastest to 2030 (per source).',
      'تعمل براكة بأجهزة قياس وتحكم رقمية. وتبني المؤسسة منصات بيانات وذكاء اصطناعي مع شركائها، ويتوقع المنتدى الاقتصادي العالمي أن تكون المهارات التقنية الأسرع نمواً حتى 2030 (وفق المصدر).'),
    L('lane-cyber', 'HZ-2', 'now', ['sk-sa-01', 'sk-da-01', 'sk-hu-01-star'],
      [], ['cyber-security-engineer', 'security-officer', 'safeguards-specialist'], S('wef-foj-2025'), 2,
      'Cyber hygiene for everyone', 'النظافة السيبرانية للجميع',
      'Everyday habits that protect plant and business systems: careful handling of media, accounts and messages, and stopping when something looks wrong.',
      'عادات يومية تحمي أنظمة المحطة والأعمال: التعامل الحذر مع الوسائط والحسابات والرسائل، والتوقف عند الشك.',
      'Networks and cybersecurity are among the fastest-growing skills in the WEF Future of Jobs Report 2025. Cyber and security roles are shown here as a career path only.',
      'الشبكات والأمن السيبراني من أسرع المهارات نمواً في تقرير مستقبل الوظائف 2025 للمنتدى الاقتصادي العالمي. وتظهر أدوار الأمن السيبراني والأمن هنا مساراً مهنياً فقط.'),
    L('lane-ai', 'HZ-3', 'next', ['sk-da-02', 'sk-da-02-review', 'sk-da-01-remote', 'sk-ld-02-decide', 'sk-hu-01-star'],
      ['shift-technical-advisor', 'human-performance-specialist'], [], S('enec-presight', 'wef-foj-2025'), 3,
      'AI-assisted operations, governed', 'العمليات المدعومة بالذكاء الاصطناعي ضمن الحوكمة',
      'Using AI tools for search, summaries and trend spotting while people keep every safety decision, check the outputs and record what they relied on.',
      'استخدام أدوات الذكاء الاصطناعي في البحث والتلخيص ورصد الاتجاهات، مع بقاء كل قرار سلامة بيد الإنسان، والتحقق من المخرجات وتوثيق ما اعتُمد عليه.',
      'ENEC and Presight are co-developing the ENECIQ AI platform for efficiency and knowledge sharing. Governed use needs staff who can question AI outputs and apply conservative decision-making.',
      'تطوّر المؤسسة وبرسايت منصة ENECIQ للذكاء الاصطناعي لتعزيز الكفاءة وتبادل المعرفة. ويتطلب الاستخدام المحكوم موظفين قادرين على مساءلة مخرجات الذكاء الاصطناعي واتخاذ قرارات متحفظة.'),
    L('lane-advanced', 'HZ-4', 'next', ['sk-pf-01-core', 'sk-pf-01-advfuel', 'sk-pf-02-advcool', 'sk-ch-01-advchem', 'sk-ns-02-licensing', 'sk-mp-01-remote'],
      ['reactor-engineer-core-physicist', 'regulatory-affairs-licensing-engineer'], [], S('wnn-advance', 'wnn-smr-mous', 'nea-nest'), 4,
      'Advanced reactor fundamentals', 'أساسيات المفاعلات المتقدمة',
      'Passive safety, new coolants and fuel forms, remote operation concepts and licensing a new design.',
      'السلامة الخاملة، والمبردات وأشكال الوقود الجديدة، ومفاهيم التشغيل عن بعد، وترخيص تصميم جديد.',
      'Through ADVANCE, ENEC is evaluating SMRs and microreactors under several MoUs, and the NEA notes that new designs need new skills across the value chain. ENEC is evaluating these technologies; no deployment decision is implied.',
      'تقيّم المؤسسة عبر برنامج ADVANCE المفاعلات الصغيرة والمتناهية الصغر بموجب عدة مذكرات تفاهم، وتشير وكالة الطاقة النووية إلى أن التصاميم الجديدة تتطلب مهارات جديدة عبر سلسلة القيمة. تقيّم المؤسسة هذه التقنيات ولا يعني ذلك أي قرار بالنشر.'),
    L('lane-netzero', 'HZ-5', 'later', ['sk-en-01-project', 'sk-en-02', 'sk-pf-02', 'sk-ch-01', 'sk-en-01-mods'],
      ['systems-design-plant-engineer', 'chemistry-technician'], [], S('enec-climate', 'enec-adnoc', 'wnn-ega', 'enec-samsung'), 5,
      'Net zero and hydrogen interfaces', 'الحياد المناخي وواجهات الهيدروجين',
      'How clean electricity and heat connect to industry: process-heat integration, hydrogen interfaces and project controls with industrial partners.',
      'كيف ترتبط الكهرباء والحرارة النظيفتان بالصناعة: دمج الحرارة في العمليات، وواجهات الهيدروجين، وضبط المشاريع مع الشركاء الصناعيين.',
      'Clean electricity from Barakah already supports industrial decarbonisation such as low-carbon aluminium, and ENEC is exploring advanced nuclear heat for industry and hydrogen cooperation (per source).',
      'تدعم الكهرباء النظيفة من براكة بالفعل إزالة الكربون في الصناعة مثل الألمنيوم منخفض الكربون، وتستكشف المؤسسة الحرارة النووية المتقدمة للصناعة والتعاون في الهيدروجين (وفق المصدر).'),
  ];

  // ───────────── learning suggestions (public)
  const R = (id, kind, o) => ({ id, kind, provider_en: '', provider_ar: '', tech_ids: [], adv_skill_ids: [], lane_ids: [], course_id: null, track_id: null, org_id: null, level: 1, hours: null, sources: [], sort: 0, ...o });
  const ALL = T.adv_technologies.map((t) => t.id);
  T.future_resources = [
    R('fr-c-adv-intro', 'course', { course_id: 'c-adv-intro', track_id: 'trk-orientation', tech_ids: ALL, adv_skill_ids: ['as-reactivity', 'as-passive-safety', 'as-gas-coolant', 'as-liquid-metal', 'as-remote-ops', 'as-salt-chemistry', 'as-other-regulators'], lane_ids: ['lane-advanced'], level: 1, hours: 3, sources: S('wnn-advance'), sort: 1,
      title_en: 'Advanced reactor families: an orientation', title_ar: 'عائلات المفاعلات المتقدمة: مدخل تعريفي', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'Three hours on what ADVANCE evaluates and what changes from APR-1400.', summary_ar: 'ثلاث ساعات عمّا يقيّمه برنامج ADVANCE وما الذي يتغير عن APR-1400.' }),
    R('fr-c-adv-smr', 'course', { course_id: 'c-adv-smr', track_id: 'trk-smr-ops', tech_ids: ['tech-bwr', 'tech-micro'], adv_skill_ids: ['as-passive-safety', 'as-bwr-systems', 'as-remote-ops', 'as-autonomous-control', 'as-new-licensing-basis', 'as-conduct-of-ops'], lane_ids: ['lane-advanced', 'lane-ai'], level: 2, hours: 4, sources: S('wnn-smr-mous', 'wnn-gevh'), sort: 2,
      title_en: 'SMRs and microreactors: what changes for operators', title_ar: 'المفاعلات الصغيرة والمتناهية الصغر: ما الذي يتغير للمشغّلين', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'Passive safety, remote and autonomous operation concepts and new licensing questions.', summary_ar: 'السلامة الخاملة ومفاهيم التشغيل عن بعد والتشغيل الذاتي وأسئلة الترخيص الجديدة.' }),
    R('fr-c-ai-gov', 'course', { course_id: 'c-ai-gov', tech_ids: ['tech-intl', 'tech-micro'], adv_skill_ids: ['as-digital-twins', 'as-autonomous-control'], lane_ids: ['lane-ai'], level: 1, hours: 2, sources: S('enec-presight'), sort: 3,
      title_en: 'Governed use of AI at work', title_ar: 'الاستخدام المحكوم للذكاء الاصطناعي في العمل', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'How to use AI tools within the rules, check their outputs and keep people in charge.', summary_ar: 'كيف تستخدم أدوات الذكاء الاصطناعي ضمن القواعد وتتحقق من مخرجاتها وتُبقي القرار بيد الإنسان.' }),
    R('fr-c-mnt-ic', 'course', { course_id: 'c-mnt-ic', tech_ids: ['tech-micro'], adv_skill_ids: ['as-ic-maintenance'], lane_ids: ['lane-digital'], level: 2, hours: 320, sources: S('enec-training-facilities'), sort: 4,
      title_en: 'I&C fundamentals', title_ar: 'أساسيات أجهزة القياس والتحكم', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'The instrumentation and control foundation that adapts to new digital platforms.', summary_ar: 'أساس أجهزة القياس والتحكم الذي يتكيف مع المنصات الرقمية الجديدة.' }),
    R('fr-c-chem-cont', 'course', { course_id: 'c-chem-cont', tech_ids: ['tech-bwr', 'tech-msr'], adv_skill_ids: ['as-bwr-chemistry', 'as-lab-qa'], level: 2, hours: 32, sources: S('enec-training-facilities'), sort: 5,
      title_en: 'Chemistry continuing 2026', title_ar: 'التدريب المستمر في الكيمياء 2026', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'Keeps sampling discipline and laboratory QA sharp: the chemistry skills that carry over.', summary_ar: 'يحافظ على انضباط أخذ العينات وضمان جودة المختبر: مهارات الكيمياء القابلة للانتقال.' }),
    R('fr-c-rp-cont', 'course', { course_id: 'c-rp-cont', tech_ids: ['tech-fast'], adv_skill_ids: ['as-radiological-work'], level: 2, hours: 32, sources: S('enec-training-facilities'), sort: 6,
      title_en: 'RP continuing 2026', title_ar: 'التدريب المستمر في الوقاية من الإشعاع 2026', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'ALARA planning and radiological work practice, which carry over to any reactor design.', summary_ar: 'تخطيط ALARA وممارسة العمل الإشعاعي، وهي مهارات تنتقل إلى أي تصميم مفاعل.' }),
    R('fr-c-eng-cont', 'course', { course_id: 'c-eng-cont', tech_ids: ['tech-intl'], adv_skill_ids: ['as-owners-engineer', 'as-project-abroad'], level: 1, hours: 24, sources: S('enec-training-facilities'), sort: 7,
      title_en: 'Engineering continuing 2026', title_ar: 'التدريب الهندسي المستمر 2026', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: "Design basis and configuration control: the base for owner's-engineer work.", summary_ar: 'أساس التصميم وضبط التهيئة: القاعدة لعمل مهندس المالك.' }),
    R('fr-c-sam', 'course', { course_id: 'c-sam', tech_ids: ['tech-bwr', 'tech-htgr'], adv_skill_ids: ['as-passive-safety', 'as-reactivity'], level: 1, hours: 16, sources: S('enec-training-facilities'), sort: 8,
      title_en: 'Severe-accident scenarios', title_ar: 'سيناريوهات الحوادث الجسيمة', provider_en: "Kafa'a catalogue", provider_ar: 'كتالوج كفاءة',
      summary_en: 'Defence in depth and safety functions: a bridge to passive safety thinking.', summary_ar: 'الدفاع في العمق ووظائف السلامة: جسر نحو التفكير في السلامة الخاملة.' }),
    R('fr-trk-materials', 'track', { track_id: 'trk-materials', tech_ids: ['tech-htgr', 'tech-fast', 'tech-msr'], adv_skill_ids: ['as-graphite', 'as-salt-materials', 'as-triso-fuel', 'as-opaque-inspection'], lane_ids: ['lane-advanced'], level: 1, hours: 3, sources: S('wnn-smr-mous'), sort: 9,
      title_en: 'Materials and fuels for advanced reactors (track)', title_ar: 'المواد والوقود للمفاعلات المتقدمة (مسار)', provider_en: 'ADVANCE learning track', provider_ar: 'مسار تعلّم ADVANCE',
      summary_en: 'Graphite, coated-particle fuel and corrosion in salts at an introductory level.', summary_ar: 'الغرافيت والوقود ذو الجسيمات المغلّفة والتآكل في الأملاح بمستوى تمهيدي.' }),
    R('fr-trk-digital', 'track', { track_id: 'trk-digital', tech_ids: ['tech-intl', 'tech-micro'], adv_skill_ids: ['as-digital-twins', 'as-remote-ops', 'as-autonomous-control'], lane_ids: ['lane-digital', 'lane-ai'], level: 1, hours: 1.8, sources: S('enec-presight'), sort: 10,
      title_en: 'Digital twins and autonomy (track)', title_ar: 'التوائم الرقمية والتشغيل الذاتي (مسار)', provider_en: 'ADVANCE learning track', provider_ar: 'مسار تعلّم ADVANCE',
      summary_en: 'What digital twins and remote monitoring add, and where people stay in the loop.', summary_ar: 'ما الذي تضيفه التوائم الرقمية والمراقبة عن بعد، وأين يبقى الإنسان في الحلقة.' }),
    R('fr-ku-msc', 'programme', { org_id: 'ku', tech_ids: ['tech-htgr', 'tech-fast', 'tech-msr', 'tech-bwr'], adv_skill_ids: ['as-fast-physics', 'as-reactivity', 'as-triso-fuel', 'as-gas-coolant', 'as-liquid-metal', 'as-new-licensing-basis', 'as-passive-safety'], lane_ids: ['lane-advanced'], level: 3, hours: null, sources: S('ku-msc'), sort: 11,
      title_en: 'MSc in Nuclear Engineering', title_ar: 'ماجستير الهندسة النووية', provider_en: 'Khalifa University', provider_ar: 'جامعة خليفة',
      summary_en: 'Postgraduate study in reactor physics, thermal hydraulics and safety: the deepest route into advanced-reactor design skills.', summary_ar: 'دراسات عليا في فيزياء المفاعلات والهيدروليكا الحرارية والسلامة: أعمق طريق إلى مهارات تصميم المفاعلات المتقدمة.' }),
    R('fr-nitss', 'event', { tech_ids: ['tech-micro', 'tech-intl'], adv_skill_ids: ['as-remote-ops', 'as-digital-twins', 'as-process-heat'], lane_ids: ['lane-digital', 'lane-netzero'], level: 1, hours: null, sources: S('cns10'), sort: 12,
      title_en: 'Nuclear Innovation & Technology Summer School (NITSS)', title_ar: 'المدرسة الصيفية للابتكار والتكنولوجيا النووية', provider_en: 'UAE nuclear sector (national report)', provider_ar: 'القطاع النووي في الدولة (التقرير الوطني)',
      summary_en: 'A summer school on nuclear innovation and new technology, listed in the UAE national report to the CNS.', summary_ar: 'مدرسة صيفية عن الابتكار النووي والتقنيات الجديدة، مذكورة في التقرير الوطني للدولة إلى اتفاقية الأمان النووي.' }),
    R('fr-src-giems', 'programme', { org_id: 'src', tech_ids: ['tech-micro', 'tech-intl'], adv_skill_ids: ['as-transportable-units', 'as-autonomous-control', 'as-other-regulators'], lane_ids: ['lane-advanced', 'lane-ai'], level: 1, hours: null, sources: S('enec-src', 'sask-src'), sort: 13,
      title_en: 'SRC and GIEMS MoU: research and capacity building', title_ar: 'مذكرة التفاهم مع مجلس أبحاث ساسكاتشوان وGIEMS: البحث وبناء القدرات', provider_en: 'Saskatchewan Research Council and GIEMS', provider_ar: 'مجلس أبحاث ساسكاتشوان وGIEMS',
      summary_en: 'Cooperation on SMRs, AI and robotics and capacity building; a watch item for exchange and joint learning.', summary_ar: 'تعاون في المفاعلات الصغيرة والذكاء الاصطناعي والروبوتات وبناء القدرات؛ بند للمتابعة لفرص التبادل والتعلّم المشترك.' }),
    R('fr-read-gevh', 'reading', { tech_ids: ['tech-bwr', 'tech-intl'], adv_skill_ids: ['as-bwr-systems', 'as-project-abroad'], level: 1, hours: 0.5, sources: S('wnn-gevh'), sort: 14,
      title_en: 'Reading: the BWRX-300 international deployment MoU', title_ar: 'قراءة: مذكرة التفاهم بشأن النشر الدولي لمفاعل BWRX-300', provider_en: 'World Nuclear News', provider_ar: 'وورلد نيوكلير نيوز',
      summary_en: 'Why a small boiling water reactor design matters to ENEC as an investor and operator abroad.', summary_ar: 'لماذا يهم تصميم مفاعل الماء المغلي الصغير المؤسسة بصفتها مستثمراً ومشغّلاً في الخارج.' }),
    R('fr-read-newcleo', 'reading', { tech_ids: ['tech-fast'], adv_skill_ids: ['as-liquid-metal', 'as-lm-chemistry', 'as-fast-physics'], level: 1, hours: 0.5, sources: S('wnn-newcleo'), sort: 15,
      title_en: 'Reading: lead-cooled fast reactors and the newcleo cooperation', title_ar: 'قراءة: المفاعلات السريعة المبرّدة بالرصاص والتعاون مع نيوكليو', provider_en: 'World Nuclear News', provider_ar: 'وورلد نيوكلير نيوز',
      summary_en: 'An introduction to liquid-metal coolants and fast-spectrum physics through a public news item.', summary_ar: 'مدخل إلى مبردات المعادن السائلة وفيزياء الطيف السريع من خلال خبر منشور.' }),
    R('fr-read-adnoc', 'reading', { tech_ids: ['tech-htgr'], adv_skill_ids: ['as-process-heat', 'as-investment-appraisal'], lane_ids: ['lane-netzero'], level: 1, hours: 0.5, sources: S('enec-adnoc'), sort: 16,
      title_en: 'Reading: advanced nuclear heat for oil and gas operations', title_ar: 'قراءة: الحرارة النووية المتقدمة لعمليات النفط والغاز', provider_en: 'ENEC', provider_ar: 'مؤسسة الإمارات للطاقة النووية',
      summary_en: 'How ENEC and ADNOC explore advanced technologies and excess heat for industry.', summary_ar: 'كيف تستكشف المؤسسة وأدنوك التقنيات المتقدمة والحرارة الفائضة للصناعة.' }),
    R('fr-read-nea', 'reading', { tech_ids: ALL, adv_skill_ids: ['as-other-regulators', 'as-new-licensing-basis'], lane_ids: ['lane-advanced'], level: 1, hours: 1, sources: S('nea-nest'), sort: 17,
      title_en: 'Reading: building the vital skills for the future of nuclear energy', title_ar: 'قراءة: بناء المهارات الحيوية لمستقبل الطاقة النووية', provider_en: 'OECD Nuclear Energy Agency', provider_ar: 'وكالة الطاقة النووية التابعة لمنظمة التعاون الاقتصادي والتنمية',
      summary_en: 'The NEA NEST view of the skills new reactor programmes need across the value chain.', summary_ar: 'رؤية برنامج NEST لدى وكالة الطاقة النووية للمهارات التي تحتاجها برامج المفاعلات الجديدة عبر سلسلة القيمة.' }),
  ];

  // ───────────── synthetic interest and goals (distinct people per cell; some cells stay under 10 to show suppression)
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && !p.persona_id).map((p) => p.id).sort();
  const pickN = (salt, n) => [...staff].sort((a, b) => h32(`${salt}:${a}`) - h32(`${salt}:${b}`) || (a < b ? -1 : 1)).slice(0, Math.min(n, staff.length));
  const day = (salt) => `2026-${String(7 + (h32(salt) % 3)).padStart(2, '0')}-${String(1 + (h32(`d${salt}`) % 28)).padStart(2, '0')}T08:00:00Z`;
  const interest = [];
  const addInterest = (person, kind, target) => interest.push({ id: `fi:${person}:${target}`, person_id: person, target_kind: kind, tech_id: kind === 'tech' ? target : null, lane_id: kind === 'lane' ? target : null, active: true, created_at: day(`${person}${target}`), updated_at: day(`${person}${target}`) });
  const TECH_N = { 'tech-bwr': 31, 'tech-micro': 18, 'tech-htgr': 12, 'tech-intl': 14, 'tech-fast': 7, 'tech-msr': 5 };
  const LANE_N = { 'lane-digital': 38, 'lane-ai': 26, 'lane-cyber': 8, 'lane-advanced': 21, 'lane-netzero': 11 };
  for (const [t, n] of Object.entries(TECH_N)) for (const p of pickN(t, n)) addInterest(p, 'tech', t);
  for (const [l, n] of Object.entries(LANE_N)) for (const p of pickN(l, n)) addInterest(p, 'lane', l);
  addInterest('p-k-ro', 'tech', 'tech-bwr');
  T.future_interest = interest;

  const data = { advSkills: T.adv_skills, skills: T.skills, bridges: T.skill_bridges, roles: T.future_roles, lanes: T.horizon_lanes, jobRoles: T.job_roles, techs: T.adv_technologies };
  const goals = [];
  const addGoal = (person, kind, ref) => {
    const tgt = goalTarget(kind, ref, data);
    if (!tgt) throw new Error(`f09: unknown goal target ${kind} ${ref}`);
    const ts = day(`g${person}${ref}`);
    goals.push({ id: goalId(person, kind, ref), person_id: person, kind, ref_id: ref, ...tgt, target_level: 2, status: 'active', source: 'future_me', created_at: ts, updated_at: ts });
  };
  const GOALS = [['lane', 'lane-digital', 12], ['lane', 'lane-ai', 6], ['adv_skill', 'as-passive-safety', 8], ['bridge', 'br-1', 4], ['future_role', 'fr-bwr-operator', 5], ['adv_skill', 'as-remote-ops', 4], ['adv_skill', 'as-digital-twins', 3]];
  for (const [kind, ref, n] of GOALS) for (const p of pickN(`goal:${ref}`, n)) addGoal(p, kind, ref);
  T.future_goals = goals;
}
