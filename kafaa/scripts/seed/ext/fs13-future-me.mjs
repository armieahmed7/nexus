// FS13 + FS14 (FS wave B · E4, M21) seed: Future Me readiness that learning can move, and Horizon lanes 2.0.
//   FS13  * six keyspace rows on the FS04 map (FS13_KEYSPACE_ROWS): the new-capability skill for the ADVANCE skills that only had
//           today's skills on them, so every ADVANCE skill can reach full credit through evidence (adv_skills.sk_ids follow the map)
//         * synthetic ADVANCE track progress (future_track_progress): completed tracks are level-1 learning evidence
//         * the Future Me engine card (F24) moves to version 2 with the new scoring function and inputs (FS13_CARD)
//   FS14  * eleven horizon lanes (five F09 lanes updated, six new), each with three or more public sources and an as-of date,
//           placed against dated, sourced milestones (horizon_milestones); lane links to FS02 skills, courses, tracks, training
//           pathways and gigs (horizon_lane_links); learning resources tagged with the new lanes
//         * synthetic interest and goals in the new lanes (some cells under 10 to show suppression); the F26 demand snapshots are
//           recomputed with F26's own rules so the interest keeps feeding training-needs forecasting
// Synthetic people only (w-* / p-* rows); no headcount, no site information, no real names. Readiness itself is never seeded:
// rpc.futureReadiness computes it (src/modules/m21/readiness.ts = SQL kafaa_fm_readiness_of).
import { FS13_KEYSPACE_ROWS, FS13_CARD } from '../../../src/modules/m21/fs13data.ts';
import { linkId, laneProblems } from '../../../src/modules/m21/lanes.ts';
import { unreachableKeys, trackProgressId } from '../../../src/modules/m21/readiness.ts';
import { goalTarget, goalId } from '../../../src/modules/m21/goals.ts';
import { mapId, rowsOf } from '../../../src/modules/m11/keyspace.ts';
import { publicTextIsClean } from '../../../src/domain/future.ts';
import { FS_QA_KEYSPACE_ROWS } from '../../../src/domain/taxonomy.ts';

const AS_OF = '2026-10-10';
// Public sources not in the shared registry (scripts/seed/sources.mjs); from the research packs in scratchpad/fs, read 10 Oct 2026.
const EXTRA = {
  'wef-foj-2025': { label: 'WEF · Future of Jobs Report 2025 (press release, Jan 2025)', url: 'https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/', as_of: '2026-10-08' },
  'nea-nest': { label: 'OECD NEA · Building the vital skills for the future of nuclear energy (NEST)', url: 'https://www.oecd-nea.org/jcms/pl_56329/building-the-vital-skills-for-the-future-of-nuclear-energy', as_of: '2026-10-08' },
  'iaea-ai-bulletin': { label: 'IAEA Bulletin · Enhancing nuclear power production with artificial intelligence', url: 'https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence' },
  'nei-iaea-ai': { label: 'NEI Magazine · IAEA hosts first AI and nuclear energy symposium (Dec 2025)', url: 'https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/' },
  'iea-wee-2025': { label: 'NucNet · IEA World Energy Employment 2025: nuclear jobs growth (Dec 2025)', url: 'https://smr.nucnet.org/news/jobs-growth-in-nuclear-surged-in-2024-and-will-continue-to-expand-despite-headwinds-iea-report-12-5-2025' },
  'irena-jobs-2025': { label: 'EU BUILD UP · IRENA and ILO, Renewable Energy and Jobs: Annual Review 2025', url: 'https://build-up.ec.europa.eu/en/resources-and-tools/publications/annual-review-2025-renewable-energy-and-jobs' },
  'gevh-centre': { label: 'GE Vernova · GE Vernova Hitachi SMR engineering and service centre in Ontario (Jun 2025)', url: 'https://www.gevernova.com/news/press-releases/ge-vernova-hitachi-nuclear-energy-canada-small-modular-reactor-engineering-service-centre-ontario' },
  'ans-canada-smr': { label: 'ANS · Education and training to support Canadian nuclear workforce development (Nov 2025)', url: 'https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/' },
  'iaea-nss42g': { label: 'IAEA · Computer security techniques for nuclear facilities, NSS 42-G (2021)', url: 'https://www.iaea.org/node/97473' },
  'nice-ot': { label: 'NIST / CISA · NICE Framework v2.0: OT cybersecurity engineering work role', url: 'https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering' },
  'nea-plan-2035': { label: 'OECD-NEA · Plan 2035 vision paper (Oct 2025)', url: 'https://www.oecd-nea.org/upload/docs/application/pdf/2025-10/plan_2035_-_vision_paper_-_final_version.pdf' },
  'dge-ainative': { label: 'Abu Dhabi DGE · What we do (AiNative)', url: 'https://dge.gov.ae/en/what-we-do' },
};

/** Small deterministic hash (FNV-1a) for stable synthetic picks. */
function h32(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x >>> 0;
}

// ───────────── milestones: [id, year, month, kind, sources, title_en, title_ar, summary_en, summary_ar]
const MILESTONES = [
  ['ms-cop28-smr', 2023, 12, 'enec', ['wnn-smr-mous', 'wnn-advance'], 'SMR and advanced-technology MoUs at COP28', 'مذكرات تفاهم للمفاعلات الصغيرة والتقنيات المتقدمة في COP28',
    'ENEC signs several memoranda on small modular and advanced reactors and starts evaluating them through ADVANCE.', 'توقّع المؤسسة عدة مذكرات تفاهم بشأن المفاعلات المعيارية الصغيرة والمتقدمة وتبدأ تقييمها عبر برنامج ADVANCE.'],
  ['ms-adnoc-heat', 2024, 11, 'enec', ['enec-adnoc'], 'ENEC and ADNOC explore advanced nuclear heat', 'المؤسسة وأدنوك تستكشفان الحرارة النووية المتقدمة',
    'A strategic collaboration to explore advanced nuclear technologies and excess heat for oil and gas operations.', 'تعاون استراتيجي لاستكشاف التقنيات النووية المتقدمة والحرارة الفائضة لعمليات النفط والغاز.'],
  ['ms-gevh', 2025, 5, 'enec', ['wnn-gevh'], 'MoU on international BWRX-300 deployment', 'مذكرة تفاهم بشأن النشر الدولي لمفاعل BWRX-300',
    'ENEC joins a memorandum on deploying the BWRX-300 small boiling water reactor internationally.', 'تنضم المؤسسة إلى مذكرة تفاهم بشأن نشر مفاعل الماء المغلي الصغير BWRX-300 دولياً.'],
  ['ms-samsung', 2025, 7, 'enec', ['enec-samsung'], 'ENEC and Samsung C&T MoU', 'مذكرة تفاهم بين المؤسسة وسامسونج سي آند تي',
    'A memorandum to advance global nuclear energy collaboration, including new-build delivery.', 'مذكرة تفاهم لتعزيز التعاون العالمي في الطاقة النووية، بما في ذلك تنفيذ المشاريع الجديدة.'],
  ['ms-full-fleet', 2025, 9, 'enec', ['admo-full-fleet'], 'First year of full-fleet operations at Barakah', 'السنة الأولى من التشغيل الكامل لأسطول براكة',
    'All four Barakah units complete a first full year of operation together.', 'تُكمل وحدات براكة الأربع سنتها الأولى من التشغيل معاً.'],
  ['ms-eneciq', 2025, 10, 'enec', ['enec-presight'], 'ENECIQ AI platform with Presight', 'منصة ENECIQ للذكاء الاصطناعي مع برسايت',
    'ENEC and Presight co-develop an AI platform for efficiency and knowledge sharing.', 'تطوّر المؤسسة وبرسايت منصة للذكاء الاصطناعي لتعزيز الكفاءة وتبادل المعرفة.'],
  ['ms-iaea-ai', 2025, 12, 'international', ['nei-iaea-ai', 'iaea-ai-bulletin'], 'IAEA first AI and nuclear energy symposium', 'أول ندوة للوكالة الدولية للطاقة الذرية عن الذكاء الاصطناعي والطاقة النووية',
    'The IAEA convenes its first symposium on AI for nuclear energy ("Atoms for Algorithms").', 'تعقد الوكالة الدولية للطاقة الذرية أول ندوة لها عن الذكاء الاصطناعي للطاقة النووية ("الذرة من أجل الخوارزميات").'],
  ['ms-iea-wee', 2025, 12, 'international', ['iea-wee-2025'], 'IEA World Energy Employment 2025', 'تقرير الوكالة الدولية للطاقة عن التوظيف في قطاع الطاقة 2025',
    'The first edition with occupation-level estimates; it reports labour shortages in technical trades and nuclear specialists.', 'أول إصدار بتقديرات على مستوى المهن؛ ويشير إلى نقص في المهن الفنية والمتخصصين النوويين.'],
  ['ms-tii', 2026, 1, 'enec', ['enec-tii'], 'Autonomous aerial systems with TII and ASPIRE', 'الأنظمة الجوية الذاتية مع معهد الابتكار التكنولوجي وأسباير',
    'ENEC, TII and ASPIRE collaborate on autonomous aerial systems to enhance critical infrastructure.', 'تتعاون المؤسسة ومعهد الابتكار التكنولوجي وأسباير في الأنظمة الجوية الذاتية لتعزيز البنية التحتية الحيوية.'],
  ['ms-src', 2026, 1, 'enec', ['enec-src', 'sask-src'], 'SRC and GIEMS MoU on research and capacity', 'مذكرة تفاهم مع مجلس أبحاث ساسكاتشوان وGIEMS للبحث وبناء القدرات',
    'Cooperation on small modular reactors, AI and robotics, and capacity building.', 'تعاون في المفاعلات المعيارية الصغيرة والذكاء الاصطناعي والروبوتات وبناء القدرات.'],
  ['ms-mawaheb', 2026, 5, 'uae', ['enec-dge', 'wnn-dge'], 'ENEC and DGE Abu Dhabi Mawaheb agreement', 'اتفاقية مواهب بين المؤسسة ودائرة التمكين الحكومي في أبوظبي',
    'A five-year agreement to train UAE nationals for civil nuclear roles.', 'اتفاقية لخمس سنوات لتدريب المواطنين على أدوار في قطاع الطاقة النووية السلمية.'],
  ['ms-gevh-centre', 2027, 12, 'international', ['gevh-centre', 'ans-canada-smr'], 'SMR engineering and service centre expected in Ontario', 'مركز هندسة وخدمات المفاعلات الصغيرة المتوقع في أونتاريو',
    'GE Vernova Hitachi expects its SMR engineering and service centre, with training facilities, to be operational by the end of 2027.', 'تتوقع جي إي فيرنوفا هيتاشي تشغيل مركزها لهندسة وخدمات المفاعلات الصغيرة، بمرافق تدريبية، بحلول نهاية 2027.'],
  ['ms-strategy', 2029, null, 'enec', ['enec-strategy'], 'ENEC Enterprise Strategy 2025-2029 horizon', 'أفق الاستراتيجية المؤسسية للمؤسسة 2025-2029',
    'The current enterprise strategy runs to the end of 2029.', 'تمتد الاستراتيجية المؤسسية الحالية حتى نهاية 2029.'],
  ['ms-uae-ai', 2031, null, 'uae', ['dge-ainative'], 'UAE National AI Strategy 2031', 'الاستراتيجية الوطنية للذكاء الاصطناعي 2031',
    'The national target year for AI capability across government and the economy.', 'سنة الهدف الوطني لقدرات الذكاء الاصطناعي في الحكومة والاقتصاد.'],
  ['ms-nea-2035', 2035, null, 'international', ['nea-plan-2035'], 'OECD-NEA Plan 2035', 'خطة وكالة الطاقة النووية 2035',
    'The NEA initiative to build the nuclear workforce for growing capacity, with three pathways: inspire, mentor and network.', 'مبادرة وكالة الطاقة النووية لبناء القوى العاملة النووية لقدرات متنامية، عبر ثلاثة مسارات: الإلهام والإرشاد والتواصل.'],
];

// ───────────── lane updates (F09 lanes) and new lanes
const LANE_UPDATE = {
  'lane-digital': { add: [], ms: ['ms-full-fleet', 'ms-eneciq'] },
  'lane-cyber': { add: ['iaea-nss42g', 'nice-ot'], ms: ['ms-full-fleet'] },
  'lane-ai': { add: ['iaea-ai-bulletin', 'nei-iaea-ai'], ms: ['ms-eneciq', 'ms-iaea-ai', 'ms-uae-ai'] },
  'lane-advanced': { add: ['ans-canada-smr'], ms: ['ms-cop28-smr', 'ms-gevh', 'ms-src', 'ms-strategy'] },
  'lane-netzero': {
    add: [], ms: ['ms-adnoc-heat', 'ms-strategy'],
    text: {
      title_en: 'Net zero and low-carbon industry', title_ar: 'الحياد المناخي والصناعة منخفضة الكربون',
      summary_en: 'How clean electricity supports decarbonisation: lifecycle carbon, greenhouse-gas accounting and project controls with industrial partners.',
      summary_ar: 'كيف تدعم الكهرباء النظيفة إزالة الكربون: الكربون عبر دورة الحياة، ومحاسبة غازات الدفيئة، وضبط المشاريع مع الشركاء الصناعيين.',
      why_en: 'Clean electricity from Barakah already supports industrial decarbonisation such as low-carbon aluminium, and ENEC reports its climate and sustainability goals publicly (per source). Hydrogen and industrial heat now have their own lane.',
      why_ar: 'تدعم الكهرباء النظيفة من براكة بالفعل إزالة الكربون في الصناعة مثل الألمنيوم منخفض الكربون، وتنشر المؤسسة أهدافها المناخية وأهداف الاستدامة علناً (وفق المصدر). وأصبح للهيدروجين والحرارة الصناعية مسار مستقل.',
    },
  },
};
// [id, code, horizon, kind, skill_ids, role_ids, sources, milestones, sort, title_en, title_ar, summary_en, summary_ar, why_en, why_ar]
const NEW_LANES = [
  ['lane-robotics', 'HZ-6', 'now', 'build', ['sk-mp-01-remote', 'sk-da-01-remote', 'sk-mp-01'], ['maintenance-technician-engineer'], ['enec-tii', 'enec-src', 'iaea-ai-bulletin'], ['ms-tii', 'ms-src'], 6,
    'Robotics and remote inspection', 'الروبوتات والتفتيش عن بعد',
    'Drones, crawlers and remote cameras for inspection in hard-to-reach areas, with people planning the work and judging what the images show.',
    'الطائرات المسيّرة والروبوتات الزاحفة والكاميرات عن بعد للتفتيش في الأماكن الصعبة الوصول، مع بقاء تخطيط العمل والحكم على ما تُظهره الصور بيد الإنسان.',
    'ENEC is working with TII and ASPIRE on autonomous aerial systems for critical infrastructure, and its MoU with SRC and GIEMS covers AI and robotics. The IAEA describes AI-enhanced digital replicas that support inspection and predictive maintenance (per source).',
    'تعمل المؤسسة مع معهد الابتكار التكنولوجي وأسباير على الأنظمة الجوية الذاتية للبنية التحتية الحيوية، وتشمل مذكرة التفاهم مع مجلس أبحاث ساسكاتشوان وGIEMS الذكاء الاصطناعي والروبوتات. وتصف الوكالة الدولية للطاقة الذرية نماذج رقمية معززة بالذكاء الاصطناعي تدعم التفتيش والصيانة التنبؤية (وفق المصدر).'],
  ['lane-ai-maint', 'HZ-7', 'now', 'build', ['sk-mp-02-dic', 'sk-en-02-perf', 'sk-da-01-analysis', 'sk-da-02-review'], ['maintenance-technician-engineer', 'systems-design-plant-engineer'], ['iaea-ai-bulletin', 'enec-presight', 'iea-wee-2025', 'nei-iaea-ai'], ['ms-eneciq', 'ms-iaea-ai', 'ms-iea-wee'], 7,
    'AI-augmented maintenance', 'الصيانة المعززة بالذكاء الاصطناعي',
    'Predictive maintenance from plant data: reading condition trends, triaging AI alerts and checking model outputs before any work order changes.',
    'الصيانة التنبؤية من بيانات المحطة: قراءة اتجاهات حالة المعدات، وفرز تنبيهات الذكاء الاصطناعي، والتحقق من مخرجات النماذج قبل أي تغيير في أوامر العمل.',
    'The IAEA describes digital twins and predictive maintenance as AI uses in plant operation, and ENEC is building the ENECIQ AI platform with Presight. The IEA reports labour shortages in technical trades across the energy sector (per source).',
    'تصف الوكالة الدولية للطاقة الذرية التوائم الرقمية والصيانة التنبؤية بوصفها من استخدامات الذكاء الاصطناعي في تشغيل المحطات، وتبني المؤسسة منصة ENECIQ للذكاء الاصطناعي مع برسايت. وتشير الوكالة الدولية للطاقة إلى نقص في المهن الفنية في قطاع الطاقة (وفق المصدر).'],
  ['lane-manufacturing', 'HZ-8', 'next', 'build', ['sk-qa-01', 'sk-qa-01-inspect', 'sk-qa-02-cgd'], ['quality-assurance-qc', 'procurement-engineer'], ['wnn-gevh', 'enec-samsung', 'irena-jobs-2025', 'gevh-centre'], ['ms-gevh', 'ms-samsung', 'ms-gevh-centre'], 8,
    'Advanced manufacturing and factory QA', 'التصنيع المتقدم وضمان الجودة في المصنع',
    'Modules built in factories and shipped to the plant: overseeing fabrication quality, dedicating commercial-grade items and digital procurement.',
    'وحدات تُصنَّع في المصانع ثم تُنقل إلى المحطة: الإشراف على جودة التصنيع، واعتماد المواد التجارية، والمشتريات الرقمية.',
    'Small modular designs move work from construction into factories. ENEC has signed MoUs on BWRX-300 deployment and with Samsung C&T, and IRENA and the ILO report skills shortages in manufacturing (per source). ENEC is evaluating these technologies; no deployment decision is implied.',
    'تنقل التصاميم المعيارية الصغيرة جزءاً من العمل من الإنشاء إلى المصانع. ووقّعت المؤسسة مذكرات تفاهم بشأن نشر مفاعل BWRX-300 ومع سامسونج سي آند تي، وتشير الوكالة الدولية للطاقة المتجددة ومنظمة العمل الدولية إلى نقص المهارات في التصنيع (وفق المصدر). تقيّم المؤسسة هذه التقنيات ولا يعني ذلك أي قرار بالنشر.'],
  ['lane-hydrogen', 'HZ-9', 'later', 'build', ['sk-en-01-project', 'sk-pf-02', 'sk-ch-01'], ['systems-design-plant-engineer', 'chemistry-technician'], ['enec-adnoc', 'admo-emsteel', 'wnn-ega', 'enec-climate'], ['ms-adnoc-heat'], 9,
    'Hydrogen and industrial heat', 'الهيدروجين والحرارة الصناعية',
    'Using clean electricity and heat beyond the grid: process-heat integration, hydrogen interfaces and the safety cases that connect a plant to industrial users.',
    'استخدام الكهرباء والحرارة النظيفتين خارج الشبكة: دمج حرارة العمليات، وواجهات الهيدروجين، وحالات السلامة التي تربط المحطة بالمستخدمين الصناعيين.',
    'ENEC and ADNOC are exploring advanced nuclear technologies and excess heat for oil and gas operations, and agreements with EMSTEEL and EGA already link clean nuclear electricity to industry (per source). ENEC is evaluating these technologies; no deployment decision is implied.',
    'تستكشف المؤسسة وأدنوك التقنيات النووية المتقدمة والحرارة الفائضة لعمليات النفط والغاز، وتربط الاتفاقيات مع إمستيل والإمارات العالمية للألمنيوم بالفعل الكهرباء النووية النظيفة بالصناعة (وفق المصدر). تقيّم المؤسسة هذه التقنيات ولا يعني ذلك أي قرار بالنشر.'],
  ['lane-grid', 'HZ-10', 'later', 'build', ['sk-pf-03', 'sk-co-03', 'sk-en-02'], ['shift-technical-advisor', 'systems-design-plant-engineer'], ['wnn-grid', 'iea-wee-2025', 'irena-jobs-2025', 'enec-climate'], ['ms-full-fleet', 'ms-iea-wee'], 10,
    'Nuclear-renewables system integration', 'تكامل الطاقة النووية والمتجددة في المنظومة',
    'Running clean firm power alongside a growing share of solar: grid integration, flexible operation studies and system-level planning.',
    'تشغيل الطاقة النظيفة الثابتة إلى جانب حصة متزايدة من الطاقة الشمسية: التكامل مع الشبكة، ودراسات التشغيل المرن، والتخطيط على مستوى المنظومة.',
    'Barakah has supplied the UAE grid since its first unit connected, and the IEA and IRENA expect energy employment to keep growing as power systems change, with shortages in technical and digital skills (per source).',
    'تزوّد براكة شبكة الدولة بالكهرباء منذ ربط وحدتها الأولى، وتتوقع الوكالة الدولية للطاقة والوكالة الدولية للطاقة المتجددة استمرار نمو التوظيف في الطاقة مع تغيّر منظومات الكهرباء، مع نقص في المهارات الفنية والرقمية (وفق المصدر).'],
  ['lane-fusion', 'HZ-11', 'later', 'watch', ['sk-pf-01-core'], [], ['iea-wee-2025', 'nea-plan-2035', 'nea-nest'], ['ms-iea-wee', 'ms-nea-2035'], 11,
    'Fusion watch (awareness only)', 'متابعة الاندماج النووي (للتوعية فقط)',
    'A watching brief on fusion research: what it is, how it differs from fission and why it draws on the same specialist skills. Awareness only; no ENEC programme is implied.',
    'متابعة لأبحاث الاندماج النووي: ما هو، وكيف يختلف عن الانشطار، ولماذا يعتمد على المهارات المتخصصة نفسها. للتوعية فقط، ولا يعني ذلك وجود برنامج لدى المؤسسة.',
    'The IEA notes that defence nuclear and fusion compete with civil nuclear for the same specialists, and the NEA Plan 2035 aims to grow the whole nuclear workforce. Kafa\'a follows fusion for awareness only (per source).',
    'تشير الوكالة الدولية للطاقة إلى أن الاستخدامات النووية الدفاعية والاندماج يتنافسان مع الطاقة النووية المدنية على المتخصصين أنفسهم، وتهدف خطة وكالة الطاقة النووية 2035 إلى تنمية القوى العاملة النووية بأكملها. وتتابع كفاءة الاندماج للتوعية فقط (وفق المصدر).'],
];

// ───────────── lane links: FS02 skills [id, target level], catalogue courses, ADVANCE tracks, training pathways (M04), gigs (M20)
const LINKS = {
  'lane-digital': { skill: [['sk-fs-dp-dic', 2], ['sk-fs-ai-plantdata', 2], ['sk-fs-dp-rounds', 2], ['sk-fs-dp-ework', 2], ['sk-fs-tr-techlit', 2]], course: ['c-mnt-ic'], track: ['trk-digital'], pathway: ['maintenance', 'engineering'], gig: ['opp-digital-twin-study'] },
  'lane-cyber': { skill: [['sk-fs-cy-phishing', 1], ['sk-fs-cy-media', 1], ['sk-fs-cy-access', 1], ['sk-fs-cy-zones', 1], ['sk-fs-cy-report', 1]], course: [], track: [], pathway: ['all-staff'], gig: [] },
  'lane-ai': { skill: [['sk-fs-ai-use', 2], ['sk-fs-ai-verify', 2], ['sk-fs-ai-prompt', 2], ['sk-fs-ai-data-care', 2]], course: ['c-ai-gov'], track: ['trk-digital'], pathway: ['all-staff'], gig: ['opp-governed-ai-pilot'] },
  'lane-advanced': { skill: [['sk-fs-adv-smr', 2], ['sk-fs-adv-passive', 2], ['sk-fs-adv-multimodule', 1], ['sk-fs-adv-micro', 1], ['sk-fs-adv-regulation', 1], ['sk-fs-adv-fuelcycle', 1]], course: ['c-adv-intro', 'c-adv-smr'], track: ['trk-orientation', 'trk-smr-ops', 'trk-materials'], pathway: ['licensed-operator', 'engineering'], gig: ['opp-licensing-psr-inputs'] },
  'lane-netzero': { skill: [['sk-fs-gr-ghg', 2], ['sk-fs-gr-lifecycle', 2], ['sk-fs-gr-esg', 1], ['sk-fs-gr-climaterisk', 1], ['sk-fs-gr-circular', 1]], course: ['c-eng-cont'], track: [], pathway: ['engineering'], gig: [] },
  'lane-robotics': { skill: [['sk-fs-dp-robotics', 2], ['sk-fs-ai-xr', 1], ['sk-fs-ai-automation', 1]], course: ['c-mnt-mech', 'c-mnt-ic'], track: ['trk-digital'], pathway: ['maintenance'], gig: ['opp-u3-outage-valve-walkdowns'] },
  'lane-ai-maint': { skill: [['sk-fs-ai-anomaly', 2], ['sk-fs-ai-twin', 2], ['sk-fs-ai-plantdata', 2], ['sk-fs-ai-verify', 2]], course: ['c-mnt-ic', 'c-ai-gov'], track: ['trk-digital'], pathway: ['maintenance', 'engineering'], gig: ['opp-outage-schedule-analytics', 'opp-digital-twin-study', 'opp-chem-trending-2026'] },
  'lane-manufacturing': { skill: [['sk-fs-adv-factoryqa', 2], ['sk-fs-dp-procurement', 2], ['sk-fs-adv-smr', 1]], course: ['c-eng-init', 'c-sa-cgd-103'], track: ['trk-smr-ops', 'trk-materials'], pathway: ['supplier', 'engineering'], gig: ['opp-supplier-quality-surveillance', 'opp-icv-supplier-mapping'] },
  'lane-hydrogen': { skill: [['sk-fs-gr-h2heat', 2], ['sk-fs-gr-lifecycle', 1]], course: ['c-eng-cont', 'c-chem-cont'], track: ['trk-materials'], pathway: ['engineering', 'chemistry'], gig: [] },
  'lane-grid': { skill: [['sk-fs-gr-grid', 2], ['sk-fs-tr-systems', 2]], course: ['c-apr', 'c-loit-sys'], track: ['trk-orientation'], pathway: ['licensed-operator', 'engineering'], gig: [] },
  'lane-fusion': { skill: [['sk-fs-adv-fusion', 1], ['sk-fs-tr-curiosity', 1]], course: ['c-adv-intro'], track: ['trk-orientation'], pathway: ['graduate'], gig: [] },
};
// Learning resources tagged with the new lanes (F26 reads course resources' lane_ids; tracks and readings show on the lane).
const RESOURCE_LANES = {
  'fr-c-mnt-ic': ['lane-ai-maint', 'lane-robotics'],
  'fr-c-ai-gov': ['lane-ai-maint'],
  'fr-c-adv-smr': ['lane-manufacturing'],
  'fr-c-eng-cont': ['lane-hydrogen', 'lane-grid', 'lane-manufacturing'],
  'fr-c-adv-intro': ['lane-fusion'],
  'fr-trk-digital': ['lane-robotics', 'lane-ai-maint'],
  'fr-trk-materials': ['lane-manufacturing'],
  'fr-read-adnoc': ['lane-hydrogen'],
  'fr-nitss': ['lane-robotics'],
  'fr-src-giems': ['lane-robotics'],
  'fr-read-gevh': ['lane-manufacturing'],
  'fr-read-nea': ['lane-fusion'],
};

// Builds before every finalizer, so F26 (demand snapshots, f25 finalize) and the F36 digest / F07 coach read the new interest and goals.
export default function build(T) {
  const reg = new Map((T.sources ?? []).map((s) => [s.id, s]));
  const S = (ids) => ids.map((id) => {
    const r = reg.get(id) ?? EXTRA[id];
    if (!r) throw new Error(`fs13: unknown source ${id}`);
    return { id, label: r.label, url: r.url, as_of: r.accessed ?? r.as_of ?? AS_OF };
  });
  const skills = new Map(T.skills.map((s) => [s.id, s]));

  // ── FS14: milestones, lanes, links, resource lanes
  T.horizon_milestones = MILESTONES.map(([id, year, month, kind, src, title_en, title_ar, summary_en, summary_ar], i) => ({ id, year, month, kind, title_en, title_ar, summary_en, summary_ar, sources: S(src), sort: i + 1 }));
  const msIds = new Set(T.horizon_milestones.map((m) => m.id));
  for (const l of T.horizon_lanes) {
    const u = LANE_UPDATE[l.id];
    if (!u) throw new Error(`fs13: no update for lane ${l.id}`);
    const have = new Set(l.sources.map((s) => s.id));
    l.sources = [...l.sources, ...S(u.add.filter((x) => !have.has(x)))];
    Object.assign(l, u.text ?? {}, { kind: 'build', milestone_ids: u.ms, as_of: AS_OF });
  }
  for (const [id, code, horizon, kind, skill_ids, role_ids, src, ms, sort, title_en, title_ar, summary_en, summary_ar, why_en, why_ar] of NEW_LANES) {
    for (const s of skill_ids) if (!skills.has(s)) throw new Error(`fs13: unknown skill ${s}`);
    for (const r of role_ids) if (!T.job_roles.some((x) => x.id === r)) throw new Error(`fs13: unknown role ${r}`);
    T.horizon_lanes.push({ id, code, title_en, title_ar, summary_en, summary_ar, why_en, why_ar, skill_ids, horizon, path_only_role_ids: [], role_ids, sources: S(src), sort, kind, milestone_ids: ms, as_of: AS_OF });
  }
  for (const l of T.horizon_lanes) {
    const p = laneProblems(l);
    if (p.length) throw new Error(`fs13: lane ${l.id}: ${p.join(', ')}`);
    for (const m of l.milestone_ids) if (!msIds.has(m)) throw new Error(`fs13: unknown milestone ${m}`);
  }
  const known = { course: new Set(T.courses.map((c) => c.id)), track: new Set(T.adv_tracks.map((t) => t.id)), gig: new Set(T.opportunities.map((o) => o.id)) };
  const PATHWAYS = new Set(['licensed-operator', 'maintenance', 'radiation-protection', 'chemistry', 'engineering', 'all-staff', 'emergency-preparedness', 'supplier', 'graduate']);
  T.horizon_lane_links = [];
  for (const [lane, kinds] of Object.entries(LINKS)) {
    if (!T.horizon_lanes.some((l) => l.id === lane)) throw new Error(`fs13: links for unknown lane ${lane}`);
    kinds.skill.forEach(([sk, level], i) => {
      T.horizon_lane_links.push({ id: linkId(lane, 'skill', sk), lane_id: lane, kind: 'skill', ref_id: sk, level, sort: i + 1 });
    });
    for (const kind of ['course', 'track', 'pathway', 'gig']) kinds[kind].forEach((ref, i) => {
      const ok = kind === 'pathway' ? PATHWAYS.has(ref) : known[kind].has(ref);
      if (!ok) throw new Error(`fs13: unknown ${kind} ${ref}`);
      T.horizon_lane_links.push({ id: linkId(lane, kind, ref), lane_id: lane, kind, ref_id: ref, level: null, sort: i + 1 });
    });
  }
  for (const [rid, lanes] of Object.entries(RESOURCE_LANES)) {
    const r = T.future_resources.find((x) => x.id === rid);
    if (!r) throw new Error(`fs13: unknown resource ${rid}`);
    r.lane_ids = [...r.lane_ids, ...lanes.filter((x) => !r.lane_ids.includes(x))];
  }
  if (!publicTextIsClean([...T.horizon_lanes, ...T.horizon_milestones])) throw new Error('fs13: public lane text fails publicTextIsClean');

  // ── FS13: synthetic ADVANCE track progress (completed tracks are learning evidence)
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active' && !p.persona_id).map((p) => p.id).sort();
  const pickN = (salt, n, from = 0) => [...staff].sort((a, b) => h32(`${salt}:${a}`) - h32(`${salt}:${b}`) || (a < b ? -1 : 1)).slice(from, from + n);
  const day = (salt, m0 = 5, span = 4) => `2026-${String(m0 + (h32(salt) % span)).padStart(2, '0')}-${String(1 + (h32(`d${salt}`) % 28)).padStart(2, '0')}T09:00:00Z`;
  const track = new Map(T.adv_tracks.map((t) => [t.id, t]));
  T.future_track_progress = [];
  const addTrack = (person, tid, done) => {
    const total = track.get(tid).modules.length;
    const steps = done === 'all' ? [...Array(total).keys()] : [...Array(Math.min(done, total - 1)).keys()];
    const started = day(`s${person}${tid}`, 4, 3);
    const end = day(`e${person}${tid}`, 7, 3);
    const complete = steps.length === total;
    T.future_track_progress.push({ id: trackProgressId(person, tid), person_id: person, track_id: tid, steps_done: steps, status: complete ? 'completed' : 'in_progress', started_at: started, completed_at: complete ? end : null, updated_at: complete ? end : started });
  };
  const PLAN = [['trk-orientation', 26, 'all'], ['trk-orientation', 9, 2], ['trk-digital', 15, 'all'], ['trk-digital', 6, 1], ['trk-materials', 8, 'all'], ['trk-smr-ops', 6, 'all'], ['trk-smr-ops', 5, 2]];
  const seen = new Set();
  for (const [tid, n, done] of PLAN) {
    let k = 0;
    for (const p of pickN(`fs13:${tid}`, staff.length)) {
      if (k >= n) break;
      if (seen.has(`${p}|${tid}`)) continue;
      seen.add(`${p}|${tid}`);
      addTrack(p, tid, done);
      k++;
    }
  }
  addTrack('p-k-ro', 'trk-orientation', 2); // demo: two of four steps done, finish it live
  addTrack('p-sro', 'trk-orientation', 'all');
  addTrack('p-k-lo-trainee', 'trk-smr-ops', 1);

  // ── FS14: interest and goals in the new lanes (distinct people per cell; some stay under 10 to show suppression)
  const LANE_N = { 'lane-robotics': 16, 'lane-ai-maint': 22, 'lane-manufacturing': 9, 'lane-hydrogen': 13, 'lane-grid': 6, 'lane-fusion': 11 };
  for (const [lane, n] of Object.entries(LANE_N)) for (const p of pickN(`fs14:${lane}`, n)) {
    const ts = day(`${p}${lane}`, 8, 2);
    T.future_interest.push({ id: `fi:${p}:${lane}`, person_id: p, target_kind: 'lane', tech_id: null, lane_id: lane, active: true, created_at: ts, updated_at: ts });
  }
  T.future_interest.push({ id: 'fi:p-k-ro:lane-ai-maint', person_id: 'p-k-ro', target_kind: 'lane', tech_id: null, lane_id: 'lane-ai-maint', active: true, created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z' });
  const data = { advSkills: T.adv_skills, skills: T.skills, bridges: T.skill_bridges, roles: T.future_roles, lanes: T.horizon_lanes, jobRoles: T.job_roles, techs: T.adv_technologies };
  for (const [lane, n] of [['lane-ai-maint', 10], ['lane-robotics', 4]]) for (const p of pickN(`fs14:goal:${lane}`, n)) {
    const active = T.future_goals.filter((g) => g.person_id === p && g.status === 'active').length;
    if (active >= 12) continue;
    const tgt = goalTarget('lane', lane, data);
    const ts = day(`g${p}${lane}`, 8, 2);
    T.future_goals.push({ id: goalId(p, 'lane', lane), person_id: p, kind: 'lane', ref_id: lane, ...tgt, target_level: 2, status: 'active', source: 'future_me', created_at: ts, updated_at: ts });
  }

  // ── F24 engine card for Future Me, version 2 (FS13)
  const card = (T.engine_cards ?? []).find((c) => c.id === 'future');
  if (card) Object.assign(card, FS13_CARD);
}

// FS02 appends its future skills in its own FINALIZE_LAST finalizer; this one runs after it (fs02 < fs03 < fs13 < fsqa1 by file name).
export const FINALIZE_LAST = true;
export function finalize(T) {
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  for (const l of T.horizon_lane_links.filter((x) => x.kind === 'skill')) {
    const s = skills.get(l.ref_id);
    if (!s?.fs_area || s.area === 'security') throw new Error(`fs13: lane skill ${l.ref_id} must be an FS02 future skill`);
  }
  // ── FS13: keyspace rows (FS04 map) and adv_skills.sk_ids
  for (const [key, sk, relation, need, note_en, note_ar] of FS13_KEYSPACE_ROWS) {
    if (!skills.has(sk) || skills.get(sk).area === 'security') throw new Error(`fs13: bad keyspace skill ${sk}`);
    if (!T.adv_skills.some((a) => a.id === key)) throw new Error(`fs13: unknown ADVANCE skill ${key}`);
    const id = mapId(key, sk);
    if (T.future_skill_map.some((m) => m.id === id)) continue;
    T.future_skill_map.push({ id, key, key_kind: 'adv_skill', sk_id: sk, relation, need_level: need, primary_sk: false, active: true, note_en, note_ar,
      sort: 1 + Math.max(0, ...T.future_skill_map.filter((m) => m.key === key).map((m) => m.sort)), updated_by: null, updated_at: `${AS_OF}T00:00:00Z` });
  }
  for (const a of T.adv_skills) a.sk_ids = rowsOf(T.future_skill_map, a.id).map((m) => m.sk_id);
  // fsqa1 (runs after this finalizer) adds the wave-A QA keyspace rows; count them here so the check sees the final map
  const qa = FS_QA_KEYSPACE_ROWS.filter(([, kind]) => kind === 'adv_skill').map(([key, , sk_id, relation]) => ({ key, sk_id, relation, active: true }));
  const bad = unreachableKeys({ advSkills: T.adv_skills, map: [...T.future_skill_map, ...qa], skills: T.skills, resources: T.future_resources });
  if (bad.length) throw new Error(`fs13: ADVANCE skills that evidence cannot bring to 100: ${bad.join(', ')}`);

  if (!publicTextIsClean(T.future_skill_map.map((m) => [m.note_en, m.note_ar]))) throw new Error('fs13: keyspace notes fail publicTextIsClean');
}
