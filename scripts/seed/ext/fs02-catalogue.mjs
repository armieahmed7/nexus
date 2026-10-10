// FS02 (future skills, wave A) seed: the future-skills catalogue extension and the taxonomy attributes on every skill.
//  1. Back-fills the 71 F01 skills (owner function, version 1, review date, lifecycle, reusability, skill type, decay class,
//     Jahiz group, level essence EN/AR, at least one https source, benchmark ids). Their ids, codes, competencies, evidence
//     keys and adjacency are unchanged, so every derived skill state (and the F01 digest) stays the same.
//  2. Adds 49 future skills in six areas (transversal, ai_data, green_energy, advanced_reactor, cyber_hygiene,
//     digital_plant) with EN/AR names, 2+ alternative labels per language, a written level-essence line, sources and the
//     benchmarks they follow. They carry no evidence keys: holders appear only through recorded evidence (claims,
//     check-ins, credentials) in later waves, so no existing derived row changes. Cyber hygiene is all-staff awareness:
//     digital area (DA competencies), never the SA-01 security area or a security standard.
//  3. "Obsolete, never delete" (ESCO): one superseded skill is kept as obsolete with its replacement; one is declining.
// Runs as the very last finalizer (FINALIZE_LAST, and "fs02" sorts after every f* file), so the derived rows other modules
// seed from the catalogue (F20 enrichment, F35 outlook aggregates, agendas ...) are built exactly as before and stay equal to
// the live rows; at run time both backends read the full catalogue. It then re-runs the F01 derivation over the extended
// catalogue and fails the build if any state differs (the F01 digest for the original 71 skills is unchanged).
import { deriveStates } from '../../../src/domain/skills.ts';
import { levelEssence, addMonthsIso, REVIEW_CYCLE_MONTHS } from '../../../src/domain/taxonomy.ts';
import { src } from '../sources.mjs';
import { BENCHMARKS } from './fs01-benchmarks.mjs';

export const REVIEW_BASE = '2026-01-15';
const BM = new Map(BENCHMARKS.map((b) => [b.id, b]));
const bmSource = (id) => {
  const b = BM.get(id);
  if (!b) throw new Error(`fs02: unknown benchmark ${id}`);
  return { id: `bm:${id}`, label: b.name_en, url: b.urls[0] };
};

// ── 1. Back-fill rules for the 71 F01 skills (by area and evidence)
const OWNER = { plant_systems: 'nuclear_training', operations: 'operations', maintenance: 'maintenance', radiation_chemistry: 'radiation_chemistry', engineering: 'engineering', project: 'engineering', safety: 'safety_licensing', human_performance: 'human_performance', emergency: 'emergency_preparedness', security: 'nuclear_training', quality: 'quality', leadership: 'leadership_development', digital: 'digital_ai_governance' };
const AREA_SOURCE = { operations: 'enec-operation', plant_systems: 'enec-technology', maintenance: 'enec-operation', radiation_chemistry: 'enec-opsafety', engineering: 'enec-technology', project: 'enec-strategy', safety: 'fanr-reg16', human_performance: 'enec-safety-culture', emergency: 'fanr-reg12', quality: 'enec-intl-standards', leadership: 'enec-values', digital: 'enec-presight' };
const CROSS = new Set(['human_performance', 'leadership', 'quality', 'digital', 'project']);
/** Review dates a little overdue or due soon, so the staleness flags have something to show (UPKEEP benchmark). */
const REVIEW_OVERRIDE = { 'sk-da-01-scripting': '2026-09-01', 'sk-co-01-rounds': '2026-09-30', 'sk-mp-01-remote': '2026-12-01', 'sk-ch-01-advchem': '2026-11-20' };

export function backfill(s, i) {
  const qualKeyed = (s.evidence_keys ?? []).some((k) => k.startsWith('qs-'));
  const futureOnly = (s.adv_skill_ids ?? []).length > 0 && (s.evidence_keys ?? []).length === 0;
  const dataAi = s.competency_id === 'da-02' || ['sk-da-01-analysis', 'sk-da-01-twins', 'sk-da-01-remote'].includes(s.id);
  const decay = s.area === 'digital' ? 'fast' : ['human_performance', 'leadership'].includes(s.area) ? 'slow' : 'standard';
  const bms = s.area === 'digital' ? (s.competency_id === 'da-02' ? ['AI-LIT', 'IAEA-AI'] : ['DIGCOMP']) : ['human_performance', 'leadership'].includes(s.area) ? ['IAEA-1917'] : ['IAEA-WFP'];
  const name = { en: s.name_en, ar: s.name_ar };
  const ess = levelEssence(s.key_level, name);
  const sources = [src('ssg75')];
  if (s.area !== 'security' && AREA_SOURCE[s.area]) sources.push(src(AREA_SOURCE[s.area]));
  if (qualKeyed && ['operations', 'plant_systems'].includes(s.area) && (s.evidence_keys ?? []).some((k) => ['qs-ro', 'qs-sro'].includes(k))) sources.push(src('fanr-reg17'));
  return {
    reusability: CROSS.has(s.area) ? 'cross_sectoral' : qualKeyed && /APR-1400|qs-ro|qs-sro/.test(`${s.name_en} ${(s.evidence_keys ?? []).join(' ')}`) ? 'occupation_specific' : 'sector_specific',
    skill_type: ['human_performance', 'leadership'].includes(s.area) ? 'common' : qualKeyed ? 'licence_like' : 'specialised',
    lifecycle: s.area === 'digital' ? 'growing' : futureOnly ? 'emerging' : 'stable',
    decay_class: decay,
    owner_role: OWNER[s.area] ?? 'nuclear_training',
    version: 1,
    review_due: REVIEW_OVERRIDE[s.id] ?? addMonthsIso(addMonthsIso(REVIEW_BASE, i % 6), REVIEW_CYCLE_MONTHS[decay]),
    level_essence_en: ess.en,
    level_essence_ar: ess.ar,
    alt_labels_en: s.alt_labels_en ?? [],
    alt_labels_ar: s.alt_labels_ar ?? [],
    future_group: s.area === 'digital' ? (dataAi ? 'data_ai' : 'digital') : ['human_performance', 'leadership'].includes(s.area) ? 'ten_x' : s.area === 'project' ? 'new_economy' : 'nuclear_excellence',
    fs_area: null,
    benchmark_ids: bms,
    obsolete_on: null,
    replaced_by: null,
    sources: (s.sources ?? []).length ? s.sources : sources,
  };
}

// ── 2. The 49 future skills.
// [id, code, competency, area, fs_area, key_level, reusability, skill_type, lifecycle, decay, future_group, owner, benchmarks, extra source,
//  name_en, name_ar, alt_en, alt_ar, essence_en, essence_ar]
const TR = 'transversal', AI = 'ai_data', GR = 'green_energy', ADV = 'advanced_reactor', CY = 'cyber_hygiene', DP = 'digital_plant';
const NO_DECISION_EN = ' Awareness only: no deployment decision is implied.';
const NO_DECISION_AR = ' للتوعية فقط: لا يعني ذلك أي قرار بالنشر.';
export const FUTURE = [
  // Transversal: the WEF core skills written as nuclear behaviours
  ['sk-fs-tr-analytical', 'FS-TR-01', 'ld-02', 'leadership', TR, 3, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'human_performance', ['WEF-FOJ', 'MCK-DELTA'], null,
    'Analytical thinking', 'التفكير التحليلي', ['Critical analysis', 'Problem analysis'], ['التحليل النقدي', 'تحليل المشكلات'],
    'Breaks a plant problem into causes and evidence, weighs options against safety margins and explains the reasoning in writing.', 'يفكّك مشكلة في المحطة إلى أسباب وأدلة، ويوازن الخيارات مقابل هوامش السلامة، ويشرح استدلاله كتابةً.'],
  ['sk-fs-tr-systems', 'FS-TR-02', 'ns-01', 'safety', TR, 3, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'safety_licensing', ['WEF-FOJ', 'GREENCOMP'], null,
    'Systems thinking', 'التفكير المنظومي', ['Whole-system view', 'Interdependency analysis'], ['النظرة الشاملة للمنظومة', 'تحليل الترابطات'],
    'Traces how a change in one system, team or contract ripples through defence in depth, and flags interactions others miss.', 'يتتبّع كيف ينتقل أثر تغيير في نظام أو فريق أو عقد عبر طبقات الدفاع في العمق، وينبّه إلى تفاعلات يغفلها الآخرون.'],
  ['sk-fs-tr-resilience', 'FS-TR-03', 'hu-01', 'human_performance', TR, 2, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'human_performance', ['WEF-FOJ', 'GREENCOMP'], null,
    'Resilience, flexibility and agility', 'المرونة والقدرة على التكيّف وسرعة الاستجابة', ['Adaptability', 'Working under pressure'], ['القدرة على التكيّف', 'العمل تحت الضغط'],
    'Stays effective through outages, shift changes and new technology, recovers from setbacks and keeps procedure discipline under pressure.', 'يحافظ على فعاليته خلال فترات الانقطاع وتغيّر الورديات والتقنيات الجديدة، ويتعافى من الانتكاسات ويلتزم بالإجراءات تحت الضغط.'],
  ['sk-fs-tr-curiosity', 'FS-TR-04', 'sc-01', 'human_performance', TR, 2, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'human_performance', ['WEF-FOJ', 'LINKEDIN'], null,
    'Curiosity and lifelong learning', 'الفضول والتعلّم مدى الحياة', ['Learning agility', 'Self-directed learning'], ['سرعة التعلّم', 'التعلّم الذاتي'],
    'Seeks out new knowledge and operating experience, asks why, and turns what is learned into changed practice.', 'يبحث عن المعارف الجديدة وخبرات التشغيل، ويسأل عن الأسباب، ويحوّل ما يتعلّمه إلى ممارسة متغيّرة.'],
  ['sk-fs-tr-creative', 'FS-TR-05', 'en-01', 'engineering', TR, 2, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'engineering', ['WEF-FOJ', 'GREENCOMP'], null,
    'Creative thinking', 'التفكير الإبداعي', ['Innovation', 'Idea generation'], ['الابتكار', 'توليد الأفكار'],
    'Generates and tests new ways of working within the licensing basis, separating improvement ideas from changes that need design control.', 'يولّد طرق عمل جديدة ويختبرها ضمن أساس الترخيص، ويميّز أفكار التحسين عن التغييرات التي تتطلب ضبط التصميم.'],
  ['sk-fs-tr-techlit', 'FS-TR-06', 'da-01', 'digital', TR, 2, 'transversal', 'common', 'growing', 'fast', 'digital', 'digital_ai_governance', ['WEF-FOJ', 'DIGCOMP'], null,
    'Technological literacy', 'الإلمام التقني', ['Digital confidence', 'Tech fluency'], ['الثقة الرقمية', 'الطلاقة التقنية'],
    'Picks up new digital tools quickly, understands what they do and where they can fail, and uses them within approved boundaries.', 'يتقن الأدوات الرقمية الجديدة بسرعة، ويفهم ما تفعله وأين قد تخفق، ويستخدمها ضمن الحدود المعتمدة.'],
  ['sk-fs-tr-leadership', 'FS-TR-07', 'ld-01', 'leadership', TR, 3, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'leadership_development', ['WEF-FOJ', 'IAEA-1917'], null,
    'Leadership and social influence', 'القيادة والتأثير الاجتماعي', ['Influencing others', 'Leading without authority'], ['التأثير في الآخرين', 'القيادة دون سلطة رسمية'],
    'Builds commitment to safety and change across teams, including people they do not manage, and models the behaviours they ask for.', 'يبني الالتزام بالسلامة والتغيير عبر الفرق، بما في ذلك من لا يديرهم مباشرة، ويكون قدوة في السلوكيات التي يطلبها.'],
  ['sk-fs-tr-environment', 'FS-TR-08', 'ch-02', 'radiation_chemistry', TR, 2, 'transversal', 'common', 'emerging', 'slow', 'new_economy', 'sustainability', ['WEF-FOJ', 'GREENCOMP'], 'enec-sustainability',
    'Environmental stewardship', 'الإشراف البيئي', ['Environmental responsibility', 'Sustainability mindset'], ['المسؤولية البيئية', 'عقلية الاستدامة'],
    'Considers environmental impact in daily decisions, from effluents and waste to energy use, and raises improvement ideas.', 'يراعي الأثر البيئي في قراراته اليومية، من الانبعاثات السائلة والنفايات إلى استهلاك الطاقة، ويطرح أفكاراً للتحسين.'],
  ['sk-fs-tr-dependable', 'FS-TR-09', 'co-01', 'operations', TR, 2, 'transversal', 'common', 'stable', 'slow', 'ten_x', 'human_performance', ['WEF-FOJ', 'IAEA-1917'], null,
    'Dependability and attention to detail', 'الموثوقية والدقة في التفاصيل', ['Reliability', 'Precision'], ['الاعتمادية', 'الإتقان'],
    'Delivers what was agreed, to the letter of the procedure, and catches small discrepancies before they become events.', 'ينجز ما اتُّفق عليه بحرفية الإجراء، ويلتقط التباينات الصغيرة قبل أن تتحول إلى أحداث.'],
  ['sk-fs-tr-empathy', 'FS-TR-10', 'co-02', 'operations', TR, 2, 'transversal', 'common', 'stable', 'slow', 'ten_x', 'human_performance', ['WEF-FOJ', 'IAEA-1917'], null,
    'Empathy and active listening', 'التعاطف والإصغاء الفعّال', ['Active listening', 'Perspective taking'], ['الإنصات الفعّال', 'تفهّم وجهات النظر'],
    'Listens to understand, checks back what was heard and adapts how they communicate to the person and the situation.', 'يُصغي ليفهم، ويتحقق مما سمعه، ويكيّف أسلوب تواصله مع الشخص والموقف.'],
  ['sk-fs-tr-selfaware', 'FS-TR-11', 'hu-01', 'human_performance', TR, 2, 'transversal', 'common', 'stable', 'slow', 'ten_x', 'human_performance', ['WEF-FOJ', 'IAEA-1917'], null,
    'Motivation and self-awareness', 'الدافعية والوعي الذاتي', ['Self-management', 'Reflective practice'], ['إدارة الذات', 'الممارسة التأملية'],
    'Knows their own limits and error traps, asks for help early and keeps themselves fit for duty and for learning.', 'يعرف حدوده ومواطن الخطأ لديه، ويطلب المساعدة مبكراً، ويحافظ على جاهزيته للعمل والتعلّم.'],
  ['sk-fs-tr-crosscultural', 'FS-TR-12', 'ld-01', 'leadership', TR, 2, 'transversal', 'common', 'growing', 'slow', 'ten_x', 'leadership_development', ['NEA', 'WEF-FOJ'], null,
    'Collaboration across cultures', 'التعاون بين الثقافات', ['Multinational teamwork', 'Intercultural communication'], ['العمل في فرق متعددة الجنسيات', 'التواصل بين الثقافات'],
    'Works effectively in mixed Emirati, Korean and international teams, bridging language and working styles without losing precision.', 'يعمل بفعالية في فرق تجمع كوادر إماراتية وكورية ودولية، ويجسر فروق اللغة وأساليب العمل دون أن يفقد الدقة.'],
  // AI and data
  ['sk-fs-ai-use', 'FS-AI-01', 'da-02', 'digital', AI, 2, 'transversal', 'common', 'growing', 'fast', 'data_ai', 'digital_ai_governance', ['AI-LIT', 'LINKEDIN', 'UAE-AI'], 'enec-presight',
    'Everyday use of approved AI tools', 'الاستخدام اليومي لأدوات الذكاء الاصطناعي المعتمدة', ['AI literacy', 'Using generative AI at work'], ['الإلمام بالذكاء الاصطناعي', 'استخدام الذكاء الاصطناعي التوليدي في العمل'],
    'Uses approved AI assistants for drafting, search and summarising, keeps protected information out of them and labels AI-assisted work.', 'يستخدم مساعدي الذكاء الاصطناعي المعتمدين في الصياغة والبحث والتلخيص، ويُبقي المعلومات المحمية بعيداً عنهم، ويوسم العمل المُنجز بمساعدتهم.'],
  ['sk-fs-ai-verify', 'FS-AI-02', 'da-02', 'digital', AI, 3, 'cross_sectoral', 'specialised', 'emerging', 'fast', 'data_ai', 'digital_ai_governance', ['IAEA-AI', 'AI-LIT'], null,
    'AI output verification and challenge', 'التحقق من مخرجات الذكاء الاصطناعي والاعتراض عليها', ['Human-in-the-loop review', 'Checking AI answers'], ['المراجعة البشرية ضمن الحلقة', 'تدقيق إجابات الذكاء الاصطناعي'],
    'Checks AI outputs against procedures and plant data, recognises plausible but wrong answers, and stops or challenges before acting.', 'يتحقق من مخرجات الذكاء الاصطناعي مقابل الإجراءات وبيانات المحطة، ويتعرّف على الإجابات المقنعة الخاطئة، ويتوقف أو يعترض قبل التصرّف.'],
  ['sk-fs-ai-prompt', 'FS-AI-03', 'da-02', 'digital', AI, 2, 'cross_sectoral', 'specialised', 'emerging', 'fast', 'data_ai', 'digital_ai_governance', ['UAE-PEERS', 'AI-LIT'], null,
    'Prompt and agent literacy', 'الإلمام بصياغة الأوامر والوكلاء الذكيين', ['Prompt writing', 'Working with AI agents'], ['كتابة الأوامر', 'العمل مع الوكلاء الذكيين'],
    'Writes clear, bounded instructions for AI assistants and agents, sets limits on what an agent may do, and reviews each step it takes.', 'يكتب تعليمات واضحة ومحددة لمساعدي الذكاء الاصطناعي ووكلائه، ويضع حدوداً لما يجوز للوكيل فعله، ويراجع كل خطوة يتخذها.'],
  ['sk-fs-ai-dataeng', 'FS-AI-04', 'da-01', 'digital', AI, 2, 'cross_sectoral', 'specialised', 'growing', 'fast', 'data_ai', 'digital_ai_governance', ['LINKEDIN', 'DIGCOMP'], null,
    'Data engineering basics', 'أساسيات هندسة البيانات', ['Data pipelines', 'Data preparation'], ['خطوط البيانات', 'تحضير البيانات'],
    'Builds simple, documented data pipelines from approved sources, with versioned inputs and checks that others can rerun.', 'يبني خطوط بيانات بسيطة وموثّقة من مصادر معتمدة، بمدخلات مرقّمة الإصدارات وفحوص يمكن للآخرين إعادة تشغيلها.'],
  ['sk-fs-ai-plantdata', 'FS-AI-05', 'en-02', 'engineering', AI, 2, 'sector_specific', 'specialised', 'growing', 'fast', 'data_ai', 'engineering', ['IAEA-AI', 'DIGCOMP'], null,
    'Plant-data quality', 'جودة بيانات المحطة', ['Data integrity', 'Sensor data validation'], ['سلامة البيانات', 'التحقق من بيانات المستشعرات'],
    'Spots drift, gaps and bad tags in plant historian data, records where each data set came from and keeps data fit for safety analysis.', 'يكتشف الانحراف والفجوات والوسوم الخاطئة في البيانات التاريخية للمحطة، ويسجّل مصدر كل مجموعة بيانات، ويحافظ على صلاحيتها لتحليلات السلامة.'],
  ['sk-fs-ai-automation', 'FS-AI-06', 'da-01', 'digital', AI, 2, 'cross_sectoral', 'specialised', 'emerging', 'fast', 'data_ai', 'digital_ai_governance', ['UAE-PEERS', 'CORP'], null,
    'Automation design', 'تصميم الأتمتة', ['Workflow automation', 'Low-code automation'], ['أتمتة سير العمل', 'الأتمتة منخفضة البرمجة'],
    'Designs small automations for administrative workflows with a named owner, a fallback and a test record, never for plant control.', 'يصمّم أتمتة صغيرة لسير العمل الإداري مع مالك محدد وخطة بديلة وسجل اختبار، ولا يستخدمها أبداً في التحكم بالمحطة.'],
  ['sk-fs-ai-xr', 'FS-AI-07', 'da-01', 'digital', AI, 2, 'cross_sectoral', 'specialised', 'emerging', 'fast', 'digital', 'nuclear_training', ['SMR-WF', 'DIGCOMP'], null,
    'AR and VR for training and work', 'الواقع المعزّز والافتراضي في التدريب والعمل', ['Immersive learning', 'Extended reality'], ['التعلّم الغامر', 'الواقع الممتد'],
    'Uses augmented and virtual reality for walk-downs and practice, and knows where a simulator or the real plant is still required.', 'يستخدم الواقع المعزّز والافتراضي في الجولات التفقدية والتدريب، ويعرف متى يظل المحاكي أو المحطة الفعلية ضرورياً.'],
  ['sk-fs-ai-twin', 'FS-AI-08', 'da-01', 'digital', AI, 3, 'sector_specific', 'specialised', 'emerging', 'fast', 'nuclear_excellence', 'engineering', ['IAEA-AI'], null,
    'Digital twin validation', 'التحقق من صحة التوائم الرقمية', ['Model validation', 'Twin-to-plant comparison'], ['التحقق من النماذج', 'مقارنة التوأم بالمحطة'],
    'Compares twin predictions with plant behaviour, records where the model is valid and flags when it drifts out of its range.', 'يقارن تنبؤات التوأم الرقمي بسلوك المحطة، ويسجّل النطاق الذي يصحّ فيه النموذج، وينبّه عند خروجه عن نطاقه.'],
  ['sk-fs-ai-anomaly', 'FS-AI-09', 'en-02', 'engineering', AI, 2, 'sector_specific', 'specialised', 'emerging', 'fast', 'nuclear_excellence', 'engineering', ['IAEA-AI'], null,
    'Anomaly triage with AI alerts', 'فرز الحالات الشاذة باستخدام تنبيهات الذكاء الاصطناعي', ['Alert triage', 'Predictive maintenance alerts'], ['فرز التنبيهات', 'تنبيهات الصيانة التنبؤية'],
    'Sorts AI-generated anomaly alerts into act, watch and dismiss, with reasons, and feeds the outcome back to the model owner.', 'يفرز تنبيهات الحالات الشاذة التي يولّدها الذكاء الاصطناعي إلى: تصرّف، أو مراقبة، أو تجاهل، مع الأسباب، ويعيد النتيجة إلى مالك النموذج.'],
  ['sk-fs-ai-data-care', 'FS-AI-10', 'da-02', 'digital', AI, 2, 'transversal', 'common', 'growing', 'fast', 'data_ai', 'digital_ai_governance', ['AI-LIT', 'DIGCOMP'], null,
    'Responsible data handling', 'التعامل المسؤول مع البيانات', ['Data protection', 'Privacy by design'], ['حماية البيانات', 'الخصوصية في التصميم'],
    'Handles personal and commercial data on a need-to-know basis, minimises what is shared and knows how to report a data mistake.', 'يتعامل مع البيانات الشخصية والتجارية على أساس الحاجة إلى المعرفة، ويقلّل ما يُشارك، ويعرف كيف يبلّغ عن خطأ في البيانات.'],
  // Energy transition and green skills
  ['sk-fs-gr-lifecycle', 'FS-GR-01', 'en-01', 'engineering', GR, 2, 'cross_sectoral', 'specialised', 'emerging', 'standard', 'new_economy', 'sustainability', ['GREENCOMP', 'ENERGY-JOBS'], 'enec-climate',
    'Lifecycle carbon assessment', 'تقييم الكربون على امتداد دورة الحياة', ['Life-cycle assessment', 'Embodied carbon'], ['تقييم دورة الحياة', 'الكربون المتضمَّن'],
    'Estimates the lifecycle emissions of an energy option or project with a stated method and compares it fairly with alternatives.', 'يقدّر انبعاثات خيار طاقة أو مشروع على امتداد دورة حياته بمنهجية معلنة، ويقارنه بالبدائل مقارنة منصفة.'],
  ['sk-fs-gr-ghg', 'FS-GR-02', 'en-02', 'engineering', GR, 2, 'cross_sectoral', 'specialised', 'growing', 'standard', 'new_economy', 'sustainability', ['GREENCOMP', 'ISO30414'], 'sr2024',
    'GHG accounting basics', 'أساسيات محاسبة غازات الاحتباس الحراري', ['Carbon accounting', 'Scope 1, 2 and 3 emissions'], ['المحاسبة الكربونية', 'انبعاثات النطاقات 1 و2 و3'],
    'Explains scope 1, 2 and 3 emissions, follows the GHG Protocol logic and checks the data behind a sustainability figure.', 'يشرح انبعاثات النطاقات 1 و2 و3، ويتبع منطق بروتوكول غازات الاحتباس الحراري، ويتحقق من البيانات وراء أي رقم للاستدامة.'],
  ['sk-fs-gr-h2heat', 'FS-GR-03', 'pf-02', 'plant_systems', GR, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'new_economy', 'sustainability', ['ENERGY-JOBS', 'SMR-WF'], 'enec-adnoc',
    'Hydrogen and process-heat interfaces', 'واجهات الهيدروجين والحرارة الصناعية', ['Nuclear cogeneration', 'Clean hydrogen production'], ['التوليد المشترك النووي', 'إنتاج الهيدروجين النظيف'],
    'Explains how nuclear heat and power can feed hydrogen and industrial heat users, and the safety and grid questions each interface raises.', 'يشرح كيف يمكن للحرارة والكهرباء النوويتين تزويد مستخدمي الهيدروجين والحرارة الصناعية، وأسئلة السلامة والشبكة التي تثيرها كل واجهة.'],
  ['sk-fs-gr-grid', 'FS-GR-04', 'pf-03', 'plant_systems', GR, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'new_economy', 'operations', ['ENERGY-JOBS'], 'wnn-grid',
    'Grid integration and flexible operation', 'التكامل مع الشبكة والتشغيل المرن', ['Load following', 'Grid code compliance'], ['متابعة الأحمال', 'الامتثال لكود الشبكة'],
    'Understands how a nuclear fleet works alongside solar, storage and the grid operator, including load-following limits and grid-code duties.', 'يفهم كيف يعمل أسطول نووي إلى جانب الطاقة الشمسية والتخزين ومشغّل الشبكة، بما في ذلك حدود متابعة الأحمال والتزامات كود الشبكة.'],
  ['sk-fs-gr-circular', 'FS-GR-05', 'ch-02', 'radiation_chemistry', GR, 2, 'cross_sectoral', 'specialised', 'growing', 'standard', 'new_economy', 'sustainability', ['GREENCOMP'], 'enec-sustainability',
    'Circularity and waste stewardship', 'الاقتصاد الدائري والإشراف على النفايات', ['Waste minimisation', 'Circular economy'], ['تقليل النفايات', 'الاقتصاد الدائري'],
    'Applies reduce, reuse and recycle to conventional waste and minimises radioactive waste at source, following the site waste hierarchy.', 'يطبّق مبادئ التقليل وإعادة الاستخدام والتدوير على النفايات التقليدية، ويقلّل النفايات المشعة من مصدرها وفق هرمية إدارة النفايات المعتمدة.'],
  ['sk-fs-gr-esg', 'FS-GR-06', 'qa-01', 'quality', GR, 2, 'cross_sectoral', 'specialised', 'growing', 'standard', 'new_economy', 'sustainability', ['ISO30414', 'GREENCOMP'], 'sr2024',
    'ESG disclosure literacy', 'الإلمام بالإفصاح البيئي والاجتماعي والحوكمي', ['Sustainability reporting', 'GRI literacy'], ['تقارير الاستدامة', 'الإلمام بمعايير GRI'],
    'Reads and checks environmental, social and governance disclosures, knows what an auditable metric needs and where a claim needs evidence.', 'يقرأ الإفصاحات البيئية والاجتماعية والحوكمية ويتحقق منها، ويعرف ما يحتاجه المقياس القابل للتدقيق ومتى يحتاج الادعاء إلى دليل.'],
  ['sk-fs-gr-climaterisk', 'FS-GR-07', 'ns-01', 'safety', GR, 2, 'cross_sectoral', 'specialised', 'emerging', 'standard', 'new_economy', 'sustainability', ['ENERGY-JOBS', 'GREENCOMP'], 'enec-climate',
    'Climate risk awareness', 'الوعي بمخاطر المناخ', ['Climate adaptation', 'Extreme heat and sea-level risk'], ['التكيّف مع المناخ', 'مخاطر الحرارة الشديدة وارتفاع مستوى البحر'],
    'Recognises how heat, humidity, dust and sea conditions affect plant, people and supply chains, and feeds that into planning.', 'يدرك كيف تؤثر الحرارة والرطوبة والغبار وأحوال البحر في المحطة والأفراد وسلاسل الإمداد، ويُدخل ذلك في التخطيط.'],
  // Advanced reactors, SMR and fusion readiness (awareness; no deployment decision implied)
  ['sk-fs-adv-smr', 'FS-ADV-01', 'pf-01', 'plant_systems', ADV, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'advanced_reactors', ['SMR-WF', 'NEA'], 'wnn-advance',
    'SMR fundamentals', 'أساسيات المفاعلات المعيارية الصغيرة', ['Small modular reactors', 'SMR design families'], ['المفاعلات المعيارية الصغيرة', 'عائلات تصاميم المفاعلات الصغيرة'],
    'Compares the main SMR and microreactor design families with the APR-1400: size, coolant, fuel and what changes for operations.', 'يقارن عائلات تصاميم المفاعلات المعيارية الصغيرة والمفاعلات الدقيقة الرئيسية بمفاعل APR-1400: الحجم والمبرّد والوقود وما يتغير في التشغيل.'],
  ['sk-fs-adv-passive', 'FS-ADV-02', 'ns-01', 'safety', ADV, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'advanced_reactors', ['SMR-WF'], 'wnn-advance',
    'Passive safety concepts', 'مفاهيم السلامة السلبية', ['Natural circulation cooling', 'Inherent safety'], ['التبريد بالدوران الطبيعي', 'السلامة الذاتية'],
    'Explains how passive systems remove decay heat without pumps or operator action, and what still needs monitoring and human judgement.', 'يشرح كيف تزيل الأنظمة السلبية الحرارة المتبقية دون مضخات أو تدخل المشغّل، وما الذي يظل بحاجة إلى المراقبة والحكم البشري.'],
  ['sk-fs-adv-multimodule', 'FS-ADV-03', 'co-03', 'operations', ADV, 2, 'occupation_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'advanced_reactors', ['SMR-WF'], 'wnn-advance',
    'Multi-module operations concepts', 'مفاهيم تشغيل الوحدات المتعددة', ['Multi-unit control room', 'Fleet-style operation'], ['غرفة التحكم متعددة الوحدات', 'التشغيل على نمط الأسطول'],
    'Describes how one crew may supervise several modules, the human-factors questions this raises and how staffing cases are justified.', 'يصف كيف يمكن لطاقم واحد الإشراف على عدة وحدات، وأسئلة العوامل البشرية التي يثيرها ذلك، وكيف تُبرَّر حالات تحديد الطواقم.'],
  ['sk-fs-adv-factoryqa', 'FS-ADV-04', 'qa-01', 'quality', ADV, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'quality', ['SMR-WF'], null,
    'Factory fabrication QA', 'ضمان الجودة في التصنيع بالمصنع', ['Modular manufacturing quality', 'Shop inspection'], ['جودة التصنيع المعياري', 'الفحص في الورشة'],
    'Applies nuclear QA to modules built in a factory: source inspection, traceability and acceptance testing before shipment.', 'يطبّق ضمان الجودة النووية على الوحدات المصنّعة في المصنع: الفحص عند المصدر، وإمكانية التتبّع، واختبارات القبول قبل الشحن.'],
  ['sk-fs-adv-fuelcycle', 'FS-ADV-05', 'pf-01', 'plant_systems', ADV, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'advanced_reactors', ['SMR-WF'], 'wnn-advance',
    'Advanced fuel-cycle awareness', 'الوعي بدورة الوقود المتقدمة', ['HALEU and TRISO fuel', 'Fuel-cycle options'], ['وقود HALEU وTRISO', 'خيارات دورة الوقود'],
    'Explains advanced fuel forms such as TRISO and HALEU, and what they change for handling, transport and supply.', 'يشرح أشكال الوقود المتقدمة مثل TRISO وHALEU، وما تغيّره في المناولة والنقل والإمداد.'],
  ['sk-fs-adv-fusion', 'FS-ADV-06', 'pf-01', 'plant_systems', ADV, 1, 'sector_specific', 'specialised', 'emerging', 'fast', 'nuclear_excellence', 'advanced_reactors', ['NEA'], null,
    'Fusion awareness', 'الوعي بالاندماج النووي', ['Fusion energy basics', 'Magnetic and inertial confinement'], ['أساسيات طاقة الاندماج', 'الحصر المغناطيسي والقصوري'],
    'Explains how fusion differs from fission, where the main research programmes stand and which plant skills would transfer.', 'يشرح كيف يختلف الاندماج عن الانشطار، وأين تقف برامج البحث الرئيسية، وأي مهارات المحطة يمكن أن تنتقل إليه.'],
  ['sk-fs-adv-micro', 'FS-ADV-07', 'pf-03', 'plant_systems', ADV, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'advanced_reactors', ['SMR-WF'], 'wnn-advance',
    'Microreactor and transportable unit concepts', 'مفاهيم المفاعلات الدقيقة والوحدات القابلة للنقل', ['Microreactors', 'Remote power units'], ['المفاعلات الدقيقة', 'وحدات توليد الطاقة عن بُعد'],
    'Describes microreactor concepts, factory-sealed cores and transport considerations, and the different operating model they imply.', 'يصف مفاهيم المفاعلات الدقيقة والقلوب المختومة في المصنع واعتبارات النقل، ونموذج التشغيل المختلف الذي تقتضيه.'],
  ['sk-fs-adv-regulation', 'FS-ADV-08', 'ns-02', 'safety', ADV, 2, 'sector_specific', 'specialised', 'emerging', 'standard', 'nuclear_excellence', 'safety_licensing', ['NEA', 'SMR-WF'], null,
    'Advanced-reactor regulatory awareness', 'الوعي التنظيمي بالمفاعلات المتقدمة', ['Technology-inclusive regulation', 'Regulatory pathways'], ['التنظيم الشامل للتقنيات', 'المسارات التنظيمية'],
    'Explains how regulators internationally are adapting their approaches for new designs, without anticipating any regulatory decision.', 'يشرح كيف تكيّف الجهات الرقابية حول العالم مناهجها للتصاميم الجديدة، دون استباق أي قرار رقابي.'],
  // Cyber hygiene for all staff (awareness only: no security detail; security roles stay at career-path level)
  ['sk-fs-cy-phishing', 'FS-CY-01', 'da-01', 'digital', CY, 1, 'transversal', 'common', 'stable', 'fast', 'digital', 'cyber_awareness', ['OT-CYBER'], null,
    'Phishing awareness', 'الوعي بالتصيّد الاحتيالي', ['Spotting suspicious emails', 'Social engineering awareness'], ['اكتشاف الرسائل المشبوهة', 'الوعي بالهندسة الاجتماعية'],
    'Recognises suspicious emails, messages and calls, does not click or reply, and reports them through the normal channel.', 'يتعرّف على الرسائل والمكالمات المشبوهة، فلا ينقر ولا يرد، ويبلّغ عنها عبر القناة المعتادة.'],
  ['sk-fs-cy-media', 'FS-CY-02', 'da-01', 'digital', CY, 1, 'transversal', 'common', 'stable', 'fast', 'digital', 'cyber_awareness', ['OT-CYBER'], null,
    'Removable media discipline', 'الانضباط في استخدام الوسائط القابلة للإزالة', ['USB hygiene', 'Portable media rules'], ['النظافة في استخدام وحدات USB', 'قواعد الوسائط المحمولة'],
    'Uses only approved, checked portable media and never connects personal devices where they are not allowed.', 'لا يستخدم إلا الوسائط المحمولة المعتمدة والمفحوصة، ولا يوصل أجهزته الشخصية حيث لا يُسمح بذلك.'],
  ['sk-fs-cy-zones', 'FS-CY-03', 'da-01', 'digital', CY, 1, 'transversal', 'common', 'stable', 'fast', 'digital', 'cyber_awareness', ['OT-CYBER'], null,
    'Zone-and-conduit awareness', 'الوعي بمفهوم المناطق والقنوات', ['Network zones awareness', 'Why plant networks are kept apart'], ['الوعي بالمناطق الشبكية', 'لماذا تُفصل شبكات المحطة'],
    'Explains, in general terms, why plant and office networks are kept apart and why only approved connections may cross between them.', 'يشرح بعبارات عامة لماذا تُفصل شبكات المحطة عن شبكات المكاتب، ولماذا لا يُسمح إلا بالاتصالات المعتمدة بينها.'],
  ['sk-fs-cy-access', 'FS-CY-04', 'da-01', 'digital', CY, 1, 'transversal', 'common', 'stable', 'fast', 'digital', 'cyber_awareness', ['OT-CYBER', 'DIGCOMP'], null,
    'Password and access hygiene', 'النظافة في كلمات المرور وصلاحيات الوصول', ['Multi-factor authentication', 'Account hygiene'], ['المصادقة متعددة العوامل', 'النظافة في الحسابات'],
    'Uses strong, unique passwords and multi-factor sign-in, never shares accounts and locks the screen when away.', 'يستخدم كلمات مرور قوية وفريدة وتسجيل دخول متعدد العوامل، ولا يشارك حساباته أبداً، ويقفل الشاشة عند الابتعاد.'],
  ['sk-fs-cy-report', 'FS-CY-05', 'da-01', 'digital', CY, 1, 'transversal', 'common', 'stable', 'fast', 'digital', 'cyber_awareness', ['OT-CYBER'], null,
    'Reporting a suspected cyber incident', 'الإبلاغ عن حادث سيبراني مشتبه به', ['Incident reporting', 'If you see something, say something'], ['الإبلاغ عن الحوادث', 'إذا رأيت شيئاً فبلّغ'],
    'Knows that any suspected cyber problem is reported at once through the normal channel, without investigating it themselves.', 'يعرف أن أي مشكلة سيبرانية مشتبه بها يُبلَّغ عنها فوراً عبر القناة المعتادة، دون أن يحقق فيها بنفسه.'],
  // Digital plant
  ['sk-fs-dp-dic', 'FS-DP-01', 'mp-02', 'maintenance', DP, 2, 'sector_specific', 'specialised', 'growing', 'standard', 'nuclear_excellence', 'engineering', ['OT-CYBER', 'IAEA-AI'], 'enec-technology',
    'Digital I&C fundamentals', 'أساسيات أجهزة القياس والتحكم الرقمية', ['Digital instrumentation basics', 'Software-based protection systems'], ['أساسيات الأجهزة الرقمية', 'أنظمة الحماية القائمة على البرمجيات'],
    'Explains how digital instrumentation and control differs from analogue, including software qualification, diversity and common-cause failure.', 'يشرح كيف تختلف أجهزة القياس والتحكم الرقمية عن التناظرية، بما في ذلك تأهيل البرمجيات والتنوّع وأعطال السبب المشترك.'],
  ['sk-fs-dp-robotics', 'FS-DP-02', 'mp-01', 'maintenance', DP, 2, 'sector_specific', 'specialised', 'emerging', 'fast', 'nuclear_excellence', 'maintenance', ['IAEA-AI', 'SMR-WF'], 'enec-tii',
    'Robotics and remote inspection', 'الروبوتات والفحص عن بُعد', ['Crawler and drone inspection', 'Remote handling'], ['الفحص بالروبوتات الزاحفة والطائرات المسيّرة', 'المناولة عن بُعد'],
    'Plans and supervises robot or drone inspections that cut dose and confined-space entry, and judges the quality of what they record.', 'يخطط لعمليات الفحص بالروبوتات أو الطائرات المسيّرة التي تقلّل الجرعة الإشعاعية ودخول الأماكن الضيقة ويشرف عليها، ويقيّم جودة ما تسجّله.'],
  ['sk-fs-dp-procurement', 'FS-DP-03', 'qa-02', 'quality', DP, 2, 'cross_sectoral', 'specialised', 'growing', 'standard', 'digital', 'quality', ['LIGHTCAST'], 'enec-icv',
    'Digital procurement', 'المشتريات الرقمية', ['e-Procurement', 'Digital supplier portals'], ['المشتريات الإلكترونية', 'بوابات الموردين الرقمية'],
    'Runs purchases through digital portals with traceable quality requirements, supplier evidence and in-country value data.', 'يُجري عمليات الشراء عبر البوابات الرقمية بمتطلبات جودة قابلة للتتبّع وأدلة من الموردين وبيانات القيمة المحلية المضافة.'],
  ['sk-fs-dp-ework', 'FS-DP-04', 'mp-01', 'maintenance', DP, 2, 'sector_specific', 'specialised', 'growing', 'standard', 'digital', 'maintenance', ['SG-JTM'], null,
    'Digital work management (electronic work packages)', 'الإدارة الرقمية للأعمال (حزم العمل الإلكترونية)', ['e-Work packages', 'Mobile work orders'], ['حزم العمل الإلكترونية', 'أوامر العمل عبر الأجهزة المحمولة'],
    'Executes and closes electronic work packages on a tablet, with signatures, holds and records captured as the work is done.', 'ينفّذ حزم العمل الإلكترونية ويغلقها على جهاز لوحي، مع تسجيل التواقيع ونقاط التوقف والسجلات أثناء تنفيذ العمل.'],
  ['sk-fs-dp-rounds', 'FS-DP-05', 'co-01', 'operations', DP, 2, 'occupation_specific', 'specialised', 'growing', 'standard', 'digital', 'operations', ['SG-JTM', 'WEF-FOJ'], null,
    'Digital operator rounds', 'الجولات التشغيلية الرقمية', ['Handheld rounds', 'Electronic log readings'], ['الجولات بالأجهزة المحمولة', 'القراءات الإلكترونية للسجلات'],
    'Records field readings on a handheld device, responds to out-of-range prompts and attaches photos or notes as evidence.', 'يسجّل القراءات الميدانية على جهاز محمول، ويستجيب لتنبيهات القيم خارج النطاق، ويرفق الصور أو الملاحظات دليلاً.'],
  ['sk-fs-dp-paperlog', 'FS-DP-06', 'co-01', 'operations', DP, 2, 'occupation_specific', 'specialised', 'declining', 'standard', 'nuclear_excellence', 'operations', ['WEF-FOJ', 'CORP'], null,
    'Paper log-sheet rounds', 'الجولات بسجلات ورقية', ['Manual log sheets', 'Paper round sheets'], ['سجلات القراءة اليدوية', 'أوراق الجولات'],
    'Records readings on paper log sheets and transcribes them; still in use while digital rounds are rolled out.', 'يسجّل القراءات على سجلات ورقية ثم ينقلها؛ ولا يزال مستخدماً إلى أن تُعمَّم الجولات الرقمية.'],
  ['sk-fs-dp-paperwp', 'FS-DP-07', 'mp-01', 'maintenance', DP, 2, 'sector_specific', 'specialised', 'obsolete', 'standard', 'nuclear_excellence', 'maintenance', ['ESCO', 'CORP'], null,
    'Paper work-package handling', 'التعامل مع حزم العمل الورقية', ['Paper work orders', 'Hard-copy work packages'], ['أوامر العمل الورقية', 'حزم العمل المطبوعة'],
    'Superseded by electronic work packages; kept in the catalogue as obsolete, never deleted.', 'حلّت محلها حزم العمل الإلكترونية؛ وتبقى في الكتالوج متقادمة ولا تُحذف أبداً.'],
];
export const OBSOLETE = { 'sk-fs-dp-paperwp': { obsolete_on: '2026-06-30', replaced_by: 'sk-fs-dp-ework' } };

export function futureRows(T) {
  const comp = new Map(T.competencies.map((c) => [c.id, c]));
  const base = Math.max(...T.skills.map((s) => s.sort)) + 100;
  const rows = FUTURE.map((r, i) => {
    const [id, code, cid, area, fsArea, key, reus, type, life, decay, group, owner, bms, extra, en, ar, altEn, altAr, essEn, essAr] = r;
    const c = comp.get(cid);
    if (!c) throw new Error(`fs02: unknown competency ${cid}`);
    if (fsArea === CY && (cid === 'sa-01' || area === 'security')) throw new Error(`fs02: cyber hygiene must stay out of the security area (${id})`);
    const adv = fsArea === ADV;
    const o = OBSOLETE[id];
    return {
      id, code, competency_id: cid, name_en: en, name_ar: ar, area, core: false, key_level: key, evidence_keys: [], adjacent_ids: [], adv_skill_ids: [],
      description_en: `${essEn} Part of ${c.name_en} (${c.code}).${adv ? NO_DECISION_EN : ''}`,
      description_ar: `${essAr} جزء من ${c.name_ar} (${c.code}).${adv ? NO_DECISION_AR : ''}`,
      sources: [...bms.map(bmSource), ...(extra ? [src(extra)] : [])],
      sort: base + i * 10,
      reusability: reus, skill_type: type, lifecycle: life, decay_class: decay, owner_role: owner, version: 1,
      review_due: addMonthsIso(addMonthsIso('2026-07-01', i % 6), REVIEW_CYCLE_MONTHS[decay]),
      level_essence_en: essEn, level_essence_ar: essAr, alt_labels_en: altEn, alt_labels_ar: altAr,
      future_group: group, fs_area: fsArea, benchmark_ids: bms, obsolete_on: o?.obsolete_on ?? null, replaced_by: o?.replaced_by ?? null,
    };
  });
  // Adjacency inside each future area (max 6, deterministic); the F01 skills keep their own adjacency.
  for (const s of rows) s.adjacent_ids = rows.filter((x) => x.id !== s.id && x.fs_area === s.fs_area && x.lifecycle !== 'obsolete').map((x) => x.id).slice(0, 6);
  return rows;
}

export default function build() {}

export function finalize(T, ctx) {
  T.skills = T.skills.map((s, i) => ({ ...s, ...backfill(s, i) }));
  T.skills.push(...futureRows(T));
  // F01 recompute on the extended catalogue: deterministic, and identical to the states F01 derived before the extension.
  const again = deriveStates(T.skill_evidence, ctx.DEMO_TODAY);
  const key = (x) => `${x.id}|${x.level}|${x.confidence}|${x.basis}|${x.evidence_count}`;
  const a = T.person_skills.map(key).sort().join('\n');
  const b = again.map(key).sort().join('\n');
  if (a !== b) throw new Error('fs02: the F01 recompute changed after the catalogue extension');
}
export const FINALIZE_LAST = true;
