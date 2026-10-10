// FS08 International crosswalk + FS07 skill goals (FS wave B · E1, module M28) seed.
//  1. skill_frameworks: the 11 external frameworks the crosswalk aligns to, each with owner, version, code kind, level scale, the
//     benchmark row it follows (FS01 registry) and an https source read on 2026-10-10.
//  2. skill_alignments: 253 rows from fs08-crosswalk.data.json, at least one per skill (120 of 120). Codes are only those copied from
//     the source on 2026-10-10: ESCO concept URIs and Arabic preferred labels from the ESCO API (v1.2.1), SFIA 9 skill codes from
//     sfia-online.org skill pages, O*NET content-model element ids from O*NET OnLine, DigComp 2.2 competence numbers from the JRC
//     DigComp page. GreenComp, SkillsFuture CCS, UNESCO AI, NICE, IAEA and Lightcast rows are label-level ("code pending review").
//     Every row is checked with checkAlignment (the rule SQL kafaa_al_check mirrors). About a third of the strongest coded rows are
//     reviewed by a second framework owner (maker-checker: the reviewer is never the editor); the rest stay "indicative".
//     Plus two drafts (not public) and one retired row, so the admin page shows the whole lifecycle.
//  3. skill_goals: a few "Add to my goals" rows for staff personas (FS07 overlay; hand-off to FS33).
// Runs as a FINALIZE_LAST finalizer: "fs08" sorts after fs02, whose finalizer appends the FS02 skills. Synthetic people only.
import { readFileSync } from 'node:fs';
import { checkAlignment, canonLevelMap } from '../../../src/modules/m28/crosswalk.ts';

export const FINALIZE_LAST = true;
const READ_ON = '2026-10-10';
const EDITOR = 'p-training-mgr';
const ROWS = JSON.parse(readFileSync(new URL('./fs08-crosswalk.data.json', import.meta.url), 'utf8'));

export const FRAMEWORKS = [
  { id: 'esco', short: 'ESCO', name_en: 'ESCO v1.2.1 (European Skills, Competences, Qualifications and Occupations)', name_ar: 'التصنيف الأوروبي للمهارات والكفاءات والمؤهلات والمهن (ESCO) الإصدار 1.2.1', owner_en: 'European Commission', owner_ar: 'المفوضية الأوروبية', version_label: 'v1.2.1', kind: 'skills',
    code_label_en: 'Concept URI', code_label_ar: 'معرّف المفهوم (URI)', codes_copied: true, level_scale_en: 'No proficiency levels: ESCO describes what a skill is, not how well it is held', level_scale_ar: 'لا مستويات إتقان: يصف ESCO ماهية المهارة لا درجة امتلاكها',
    scope_en: '13,939 skills in 28 languages including Arabic, each with a reusability level', scope_ar: '13,939 مهارة بـ 28 لغة منها العربية، لكل منها مستوى قابلية لإعادة الاستخدام', url: 'https://esco.ec.europa.eu/en/classification/skill_main', benchmark_id: 'ESCO' },
  { id: 'onet', short: 'O*NET', name_en: 'O*NET Content Model (skills, knowledge, work activities)', name_ar: 'نموذج محتوى O*NET (المهارات والمعارف وأنشطة العمل)', owner_en: 'US Department of Labor', owner_ar: 'وزارة العمل الأمريكية', version_label: 'O*NET OnLine', kind: 'occupations',
    code_label_en: 'Element ID', code_label_ar: 'معرّف العنصر', codes_copied: true, level_scale_en: 'Level scale 0-7 per element', level_scale_ar: 'مقياس مستوى من 0 إلى 7 لكل عنصر',
    scope_en: 'Basic and cross-functional skills, knowledge areas and generalised work activities', scope_ar: 'المهارات الأساسية والمشتركة ومجالات المعرفة وأنشطة العمل العامة', url: 'https://www.onetcenter.org/content.html', benchmark_id: 'ONET' },
  { id: 'sfia9', short: 'SFIA 9', name_en: 'SFIA 9 (Skills Framework for the Information Age)', name_ar: 'إطار مهارات عصر المعلومات (SFIA 9)', owner_en: 'SFIA Foundation', owner_ar: 'مؤسسة SFIA', version_label: '9', kind: 'skills',
    code_label_en: 'Skill code', code_label_ar: 'رمز المهارة', codes_copied: true, level_scale_en: '7 levels of responsibility: Follow, Assist, Apply, Enable, Ensure/advise, Initiate/influence, Set strategy', level_scale_ar: '7 مستويات مسؤولية: يتبع، يساعد، يطبّق، يمكّن، يضمن ويستشير، يبادر ويؤثر، يضع الاستراتيجية',
    scope_en: 'Professional digital, data, AI and supporting skills, each defined only at the levels where it exists', scope_ar: 'مهارات مهنية رقمية وللبيانات والذكاء الاصطناعي، كل منها معرّف فقط في مستوياته الفعلية', url: 'https://sfia-online.org/en/sfia-9/skills', benchmark_id: 'SFIA9' },
  { id: 'skillsfuture', short: 'SkillsFuture', name_en: 'SkillsFuture Skills Frameworks: Critical Core Skills', name_ar: 'أطر مهارات SkillsFuture: المهارات الأساسية الحرجة', owner_en: 'SkillsFuture Singapore', owner_ar: 'SkillsFuture سنغافورة', version_label: '2025', kind: 'competences',
    code_label_en: 'CCS / TSC code', code_label_ar: 'رمز المهارة (CCS / TSC)', codes_copied: false, level_scale_en: 'Basic, Intermediate, Advanced', level_scale_ar: 'أساسي، متوسط، متقدم',
    scope_en: 'Transferable critical core skills (thinking critically, interacting with others, staying relevant)', scope_ar: 'مهارات أساسية حرجة قابلة للنقل (التفكير النقدي، التفاعل مع الآخرين، مواكبة التغيير)', url: 'https://isomer-user-content.by.gov.sg/41/4955bc61-161d-4584-945c-7eeeb276867a/Factsheet%20on%20Top%20skills%20trends%20in%202025.pdf', benchmark_id: 'SSG-SF' },
  { id: 'digcomp', short: 'DigComp', name_en: 'DigComp 2.2 digital competence framework', name_ar: 'إطار الكفاءة الرقمية DigComp 2.2', owner_en: 'European Commission JRC', owner_ar: 'مركز البحوث المشترك التابع للمفوضية الأوروبية', version_label: '2.2', kind: 'competences',
    code_label_en: 'Competence number', code_label_ar: 'رقم الكفاءة', codes_copied: true, level_scale_en: '8 proficiency levels (foundation to highly specialised)', level_scale_ar: '8 مستويات إتقان (من الأساسي إلى المتخصص جداً)',
    scope_en: '21 competences in 5 areas, with AI examples', scope_ar: '21 كفاءة في 5 مجالات، مع أمثلة عن الذكاء الاصطناعي', url: 'https://joint-research-centre.ec.europa.eu/digcomp/digcomp-framework_en', benchmark_id: 'DIGCOMP' },
  { id: 'unesco_ai', short: 'UNESCO AI', name_en: 'UNESCO AI competency framework', name_ar: 'إطار اليونسكو لكفاءات الذكاء الاصطناعي', owner_en: 'UNESCO', owner_ar: 'اليونسكو', version_label: '2024', kind: 'competences',
    code_label_en: 'Dimension', code_label_ar: 'البُعد', codes_copied: false, level_scale_en: 'Understand, Apply, Create', level_scale_ar: 'يفهم، يطبّق، يبتكر',
    scope_en: 'Four dimensions: human-centred mindset, ethics of AI, AI techniques and applications, AI system design', scope_ar: 'أربعة أبعاد: العقلية المتمحورة حول الإنسان، أخلاقيات الذكاء الاصطناعي، تقنياته وتطبيقاته، تصميم أنظمته', url: 'https://gcedclearinghouse.org/en/node/146447', benchmark_id: 'AI-LIT' },
  { id: 'greencomp', short: 'GreenComp', name_en: 'GreenComp: the European sustainability competence framework', name_ar: 'GreenComp: الإطار الأوروبي لكفاءات الاستدامة', owner_en: 'European Commission JRC', owner_ar: 'مركز البحوث المشترك التابع للمفوضية الأوروبية', version_label: '2022', kind: 'competences',
    code_label_en: 'Competence', code_label_ar: 'الكفاءة', codes_copied: false, level_scale_en: 'No proficiency levels', level_scale_ar: 'لا مستويات إتقان',
    scope_en: '12 sustainability competences in 4 areas', scope_ar: '12 كفاءة استدامة في 4 مجالات', url: 'https://joint-research-centre.ec.europa.eu/greencomp', benchmark_id: 'GREENCOMP' },
  { id: 'nice', short: 'NICE', name_en: 'NICE Workforce Framework for Cybersecurity v2.0', name_ar: 'إطار NICE للقوى العاملة في الأمن السيبراني v2.0', owner_en: 'NIST / CISA', owner_ar: 'NIST / CISA', version_label: '2.0', kind: 'reference',
    code_label_en: 'Work role ID', code_label_ar: 'معرّف دور العمل', codes_copied: false, level_scale_en: 'No proficiency levels', level_scale_ar: 'لا مستويات إتقان',
    scope_en: 'Awareness alignment only: security roles appear at career-path level in Kafa\'a', scope_ar: 'مطابقة توعوية فقط: تظهر أدوار الأمن على مستوى المسار المهني فقط في كفاءة', url: 'https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering', benchmark_id: 'OT-CYBER' },
  { id: 'iaea', short: 'IAEA', name_en: 'IAEA safety guides and competency references (SSG-75, TECDOC-1917, NSS 42-G, NG-T-3.10)', name_ar: 'أدلة الأمان ومراجع الكفاءات للوكالة الدولية للطاقة الذرية (SSG-75، TECDOC-1917، NSS 42-G، NG-T-3.10)', owner_en: 'International Atomic Energy Agency', owner_ar: 'الوكالة الدولية للطاقة الذرية', version_label: 'current references', kind: 'reference',
    code_label_en: 'Publication', code_label_ar: 'المنشور', codes_copied: false, level_scale_en: 'No common level scale', level_scale_ar: 'لا مقياس مستويات موحّد',
    scope_en: 'Qualification and training of NPP personnel, behavioural competencies, computer security, workforce planning, AI for nuclear energy', scope_ar: 'تأهيل موظفي المحطات وتدريبهم، الكفاءات السلوكية، أمن الحاسوب، تخطيط القوى العاملة، الذكاء الاصطناعي للطاقة النووية', url: 'https://www.iaea.org/node/109535', benchmark_id: 'IAEA-WFP' },
  { id: 'uae_nqf', short: 'UAE NQF', name_en: 'UAE National Qualifications Framework', name_ar: 'الإطار الوطني للمؤهلات في دولة الإمارات', owner_en: 'National Qualifications Centre (MoHESR)', owner_ar: 'المركز الوطني للمؤهلات (وزارة التعليم العالي والبحث العلمي)', version_label: 'current', kind: 'qualifications',
    code_label_en: 'NQF level', code_label_ar: 'مستوى الإطار الوطني', codes_copied: false, level_scale_en: '10 levels', level_scale_ar: '10 مستويات',
    scope_en: 'Levels for qualifications and credentials; skill-level mapping arrives with NQF levels and learning credits (FS30)', scope_ar: 'مستويات للمؤهلات والشهادات؛ تأتي مطابقة مستويات المهارات مع ميزة مستويات الإطار الوطني والأرصدة التعليمية (FS30)', url: 'https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses', benchmark_id: 'UAE-NQF' },
  { id: 'lightcast', short: 'Lightcast', name_en: 'Lightcast Open Skills taxonomy', name_ar: 'تصنيف المهارات المفتوح من Lightcast', owner_en: 'Lightcast', owner_ar: 'Lightcast', version_label: '2025', kind: 'skills',
    code_label_en: 'Skill ID', code_label_ar: 'معرّف المهارة', codes_copied: false, level_scale_en: 'No proficiency levels', level_scale_ar: 'لا مستويات إتقان',
    scope_en: 'Open skills taxonomy with stable IDs and a dated changelog', scope_ar: 'تصنيف مهارات مفتوح بمعرّفات ثابتة وسجل تغييرات مؤرخ', url: 'https://lightcast.io/blog/open-skills-taxonomy', benchmark_id: 'LIGHTCAST' },
].map((f, i) => ({ ...f, as_of: READ_ON, sort: i + 1 }));

const NOTES = {
  lightcast: ['Label to confirm against the Lightcast Open Skills taxonomy; the skill ID is pending review.', 'التسمية بانتظار التأكيد مقابل تصنيف Lightcast المفتوح؛ معرّف المهارة قيد المراجعة.'],
  nice: ['Awareness only: the OT cybersecurity work role itself stays at career-path level in Kafa\'a.', 'للتوعية فقط: يبقى دور العمل في الأمن السيبراني للتقنيات التشغيلية على مستوى المسار المهني في كفاءة.'],
  iaea: ['Aligned to a published IAEA reference; the IAEA does not publish codes for these competencies.', 'مطابقة مع مرجع منشور للوكالة الدولية للطاقة الذرية؛ لا تنشر الوكالة رموزاً لهذه الكفاءات.'],
  skillsfuture: ['Critical Core Skill title; the CCS code is pending review.', 'عنوان مهارة أساسية حرجة؛ الرمز قيد المراجعة.'],
  greencomp: ['GreenComp competence title; the competence number is pending review.', 'عنوان كفاءة GreenComp؛ رقم الكفاءة قيد المراجعة.'],
  unesco_ai: ['UNESCO AI competency dimension; no code published for dimensions.', 'بُعد من أبعاد إطار اليونسكو لكفاءات الذكاء الاصطناعي؛ لا رموز منشورة للأبعاد.'],
};
/** Deterministic pseudo-random in [0, 1) from a string (stable seed). */
const unit = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return (h % 1000) / 1000; };
const DIGITAL = new Set(['digital']);

export function alignmentRows(skills) {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const sortBy = new Map();
  const rows = ROWS.map((r) => {
    const sk = byId.get(r.skill_id);
    const n = (sortBy.get(r.skill_id) ?? 0) + 1;
    sortBy.set(r.skill_id, n);
    const strong = ['esco', 'sfia9', 'onet', 'digcomp'].includes(r.framework) && ['exact', 'close'].includes(r.match_type);
    const reviewed = strong && unit(r.id) < 0.62;
    const reviewer = DIGITAL.has(sk.area) ? 'p-ai-governance' : 'p-k-instructor';
    const [note_en, note_ar] = NOTES[r.framework] ?? ['', ''];
    return {
      ...r, level_map: canonLevelMap(r.level_map), note_en, note_ar, status: 'published', listed: true,
      reviewed_by: reviewed ? reviewer : null, reviewed_role: reviewed ? (reviewer === 'p-ai-governance' ? 'admin' : 'instructor') : null, reviewed_on: reviewed ? `2026-10-0${6 + Math.floor(unit(r.id + 'd') * 4)}` : null,
      retired_reason: null, retired_on: null, version: 1, created_by: EDITOR, created_at: '2026-10-05T08:00:00Z', updated_by: EDITOR, updated_at: '2026-10-05T08:00:00Z', sort: n,
    };
  });
  // Lifecycle demo rows: two drafts (framework owners only) and one retired row (kept, never deleted).
  rows.push({
    id: 'al:sk-fs-tr-dependable:onet:draft-attention', skill_id: 'sk-fs-tr-dependable', framework: 'onet', external_code: null, label_en: 'Attention to Detail (work style)', label_ar: 'الاهتمام بالتفاصيل (نمط عمل)', label_ar_official: false, external_meta: { element: 'work_style' },
    match_type: 'close', level_map: {}, note_en: 'Draft: copy the element ID from O*NET OnLine before publishing.', note_ar: 'مسودة: انسخ معرّف العنصر من O*NET OnLine قبل النشر.', source_url: 'https://www.onetcenter.org/content.html', as_of: READ_ON,
    status: 'draft', listed: false, reviewed_by: null, reviewed_role: null, reviewed_on: null, retired_reason: null, retired_on: null, version: 1, created_by: 'p-k-instructor', created_at: '2026-10-09T10:00:00Z', updated_by: 'p-k-instructor', updated_at: '2026-10-09T10:00:00Z', sort: 9,
  }, {
    id: 'al:sk-fs-gr-h2heat:greencomp:draft-systems', skill_id: 'sk-fs-gr-h2heat', framework: 'greencomp', external_code: null, label_en: 'Systems thinking', label_ar: 'التفكير المنظومي', label_ar_official: false, external_meta: {},
    match_type: 'partial', level_map: {}, note_en: 'Draft: under discussion with the energy-transition owners.', note_ar: 'مسودة: قيد النقاش مع مسؤولي التحول في الطاقة.', source_url: 'https://joint-research-centre.ec.europa.eu/greencomp', as_of: READ_ON,
    status: 'draft', listed: false, reviewed_by: null, reviewed_role: null, reviewed_on: null, retired_reason: null, retired_on: null, version: 1, created_by: EDITOR, created_at: '2026-10-08T10:00:00Z', updated_by: EDITOR, updated_at: '2026-10-08T10:00:00Z', sort: 9,
  }, {
    id: 'al:sk-da-01:sfia9:datm-retired', skill_id: 'sk-da-01', framework: 'sfia9', external_code: 'DATM', label_en: 'Data management', label_ar: 'إدارة البيانات', label_ar_official: false, external_meta: {},
    match_type: 'partial', level_map: { 1: '1-2', 2: '3', 3: '4', 4: '5' }, note_en: '', note_ar: '', source_url: 'https://sfia-online.org/en/sfia-9/skills/data-management', as_of: '2026-10-01',
    status: 'retired', listed: false, reviewed_by: null, reviewed_role: null, reviewed_on: null, retired_reason: 'Too narrow for an all-staff data literacy skill: DigComp 1.3 fits better.', retired_on: '2026-10-07',
    version: 2, created_by: EDITOR, created_at: '2026-10-01T09:00:00Z', updated_by: 'p-k-admin', updated_at: '2026-10-07T09:00:00Z', sort: 9,
  });
  return rows;
}

export const GOALS = [
  ['p-k-ro', 'sk-fs-ai-verify', 2, 'active'], ['p-k-ro', 'sk-fs-adv-passive', 2, 'active'], ['p-k-ro', 'sk-fs-tr-systems', 3, 'active'],
  ['p-qc-inspector', 'sk-fs-adv-factoryqa', 3, 'active'], ['p-qc-inspector', 'sk-fs-dp-ework', 2, 'active'],
  ['p-nse', 'sk-fs-ai-twin', 2, 'removed'], ['p-nse', 'sk-fs-ai-anomaly', 2, 'active'], ['p-sro', 'sk-fs-adv-multimodule', 2, 'active'],
];

export default function build(T) {
  T.skill_frameworks = FRAMEWORKS;
}

export function finalize(T) {
  const bms = new Set((T.benchmarks ?? []).map((b) => b.id));
  for (const f of FRAMEWORKS) if (!bms.has(f.benchmark_id)) throw new Error(`fs08: framework ${f.id} follows unknown benchmark ${f.benchmark_id}`);
  const rows = alignmentRows(T.skills);
  const ctx = { skills: new Map(T.skills.map((s) => [s.id, { lifecycle: s.lifecycle }])), frameworks: new Set(FRAMEWORKS.map((f) => f.id)), rows: [], today: READ_ON };
  for (const r of rows) {
    const c = checkAlignment({ ...r, publish: r.status === 'published' }, ctx, r.status === 'retired' ? null : undefined);
    // obsolete skills keep their alignments (ESCO: obsolete, never deleted): only new rows are refused for them
    if (c !== 'ok' && !(c === 'obsolete' && ctx.skills.get(r.skill_id)?.lifecycle === 'obsolete')) throw new Error(`fs08: ${r.id} fails ${c}`);
    if (r.status !== 'retired') ctx.rows.push(r);
  }
  T.skill_alignments = rows;
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  T.skill_goals = GOALS.map(([p, s, lv, st], i) => {
    if (!skills.has(s) || !T.people.some((x) => x.id === p)) throw new Error(`fs08: bad goal ${p} ${s}`);
    return { id: `sg:${p}:${s}`, person_id: p, skill_id: s, target_level: lv, status: st, source: 'skills_explorer', created_at: `2026-10-0${3 + (i % 6)}T09:00:00Z`, updated_at: `2026-10-0${3 + (i % 6)}T09:00:00Z` };
  });
}
