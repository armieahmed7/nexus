// F01 (wave 0) seed: the skill catalogue (a finer layer under the 29 competencies, adv_skills mapped in), fallback
// self-ratings for people with no recorded evidence, and every person's derived skill state.
// Loaded by scripts/build-seed.mjs (scripts/seed/ext/*.mjs, sorted): default export runs in file order, finalize() runs after
// every ext builder, so evidence added by later features (ojt, ratings, credentials) is included in the derived states.
import { gatherEvidence, deriveStates, evidenceId, decayModelFrom } from '../../../src/domain/skills.ts';

const AREA = { plant: 'plant_systems', conduct: 'operations', maintenance: 'maintenance', rp: 'radiation_chemistry', chemistry: 'radiation_chemistry', engineering: 'engineering', safety: 'safety', hu: 'human_performance', culture: 'human_performance', ep: 'emergency', security: 'security', quality: 'quality', leadership: 'leadership', digital: 'digital' };

// [id, code, competency, area|null (= competency area), key_level, evidence_keys, adv_skill_ids, name_en, name_ar]
const SPECIAL = [
  ['sk-pf-03-rcs', 'PF-03.1', 'pf-03', null, 3, ['qs-ro', 'qs-sro', 'c-coit-sim'], ['as-bwr-systems'], 'Reactor coolant system and pressuriser (APR-1400)', 'نظام تبريد المفاعل والمضغاط (APR-1400)'],
  ['sk-pf-03-steam', 'PF-03.2', 'pf-03', null, 3, ['qs-lo-turbine', 'qs-ro', 'qs-sro', 'c-loit-sys'], [], 'Main steam, feedwater and turbine systems', 'أنظمة البخار الرئيسي ومياه التغذية والتوربين'],
  ['sk-pf-03-eccs', 'PF-03.3', 'pf-03', null, 3, ['qs-ro', 'qs-sro', 'c-coit-sim', 'c-sam'], [], 'Safety injection and emergency core cooling', 'الحقن الآمن والتبريد الطارئ لقلب المفاعل'],
  ['sk-pf-03-elec', 'PF-03.4', 'pf-03', null, 2, ['qs-lo-aux', 'qs-elec', 'qs-ro'], [], 'Electrical distribution and emergency diesel generators', 'توزيع الكهرباء ومولدات الديزل للطوارئ'],
  ['sk-pf-03-aux', 'PF-03.5', 'pf-03', null, 2, ['qs-lo-aux', 'c-loit-sys'], [], 'Auxiliary systems (chemical and volume control, component cooling, HVAC)', 'الأنظمة المساعدة (التحكم الكيميائي والحجمي وتبريد المكونات والتهوية)'],
  ['sk-pf-03-fuel', 'PF-03.6', 'pf-03', null, 2, ['qs-sro', 'c-apr'], [], 'Fuel handling and refuelling', 'مناولة الوقود وإعادة التزود به'],
  ['sk-pf-01-core', 'PF-01.1', 'pf-01', null, 3, ['qs-sro'], ['as-reactivity', 'as-fast-physics'], 'Core physics and reactivity monitoring', 'فيزياء القلب ومراقبة التفاعلية'],
  ['sk-pf-01-advfuel', 'PF-01.2', 'pf-01', null, 2, ['c-adv-smr'], ['as-triso-fuel', 'as-graphite', 'as-salt-materials'], 'Advanced fuel forms and core materials', 'أشكال الوقود المتقدمة ومواد القلب'],
  ['sk-pf-02-advcool', 'PF-02.1', 'pf-02', null, 2, ['c-adv-smr'], ['as-gas-coolant', 'as-liquid-metal', 'as-passive-safety'], 'Advanced coolant systems (gas, liquid metal, natural circulation)', 'أنظمة التبريد المتقدمة (الغاز والمعادن السائلة والدوران الطبيعي)'],
  ['sk-co-01-eop', 'CO-01.1', 'co-01', null, 3, ['qs-ro', 'qs-sro', 'c-coct', 'c-coit-sim'], [], 'Emergency operating procedures', 'إجراءات التشغيل في حالات الطوارئ'],
  ['sk-co-01-rounds', 'CO-01.2', 'co-01', null, 3, ['qs-lo-turbine', 'qs-lo-aux', 'c-loit-ojt'], ['as-conduct-of-ops'], 'Field rounds and equipment monitoring', 'الجولات الميدانية ومراقبة المعدات'],
  ['sk-co-03-startup', 'CO-03.1', 'co-03', null, 3, ['qs-ro', 'qs-sro', 'c-coct'], [], 'Reactor start-up and power manoeuvres', 'بدء تشغيل المفاعل ومناورات القدرة'],
  ['sk-mp-01-mech', 'MP-01.1', 'mp-01', null, 3, ['qs-mech', 'c-mnt-mech'], [], 'Rotating equipment and valve maintenance', 'صيانة المعدات الدوارة والصمامات'],
  ['sk-mp-01-elec', 'MP-01.2', 'mp-01', null, 3, ['qs-elec', 'c-mnt-elec'], [], 'Electrical maintenance (switchgear, motors, protection)', 'الصيانة الكهربائية (المفاتيح والمحركات والحماية)'],
  ['sk-mp-01-outage', 'MP-01.3', 'mp-01', null, 2, ['qs-wc'], [], 'Outage work planning and scheduling', 'تخطيط أعمال الانقطاع وجدولتها'],
  ['sk-mp-01-remote', 'MP-01.4', 'mp-01', null, 2, [], ['as-opaque-inspection', 'as-transportable-units'], 'Remote inspection and modular installation', 'الفحص عن بُعد والتركيب المعياري'],
  ['sk-mp-02-dic', 'MP-02.1', 'mp-02', null, 3, ['qs-ic', 'c-mnt-ic'], ['as-ic-maintenance'], 'Digital I&C maintenance (APR-1400 digital platform)', 'صيانة أجهزة القياس والتحكم الرقمية (منصة APR-1400)'],
  ['sk-rp-02-survey', 'RP-02.1', 'rp-02', null, 3, ['qs-rp', 'c-rp-init'], ['as-radiological-work'], 'Radiological surveys and contamination control', 'المسوحات الإشعاعية والتحكم في التلوث'],
  ['sk-rp-01-dose', 'RP-01.1', 'rp-01', null, 2, ['qs-rp'], [], 'Dosimetry and dose assessment', 'قياس الجرعات وتقييمها'],
  ['sk-ch-01-primary', 'CH-01.1', 'ch-01', null, 3, ['qs-chem', 'c-chem-init'], ['as-bwr-chemistry'], 'Primary-side water chemistry sampling', 'أخذ عينات كيمياء المياه في الدائرة الأولية'],
  ['sk-ch-02-labqa', 'CH-02.1', 'ch-02', null, 2, ['qs-chem', 'c-chem-cont'], ['as-lab-qa'], 'Laboratory QA and analytical instruments', 'ضمان جودة المختبر والأجهزة التحليلية'],
  ['sk-ch-01-advchem', 'CH-01.2', 'ch-01', null, 2, [], ['as-lm-chemistry', 'as-salt-chemistry'], 'Advanced coolant chemistry (liquid metal, molten salt)', 'كيمياء المبردات المتقدمة (المعادن السائلة والأملاح المنصهرة)'],
  ['sk-en-02-perf', 'EN-02.1', 'en-02', null, 2, ['qs-eng', 'c-eng-cont'], [], 'System performance monitoring and trending', 'مراقبة أداء الأنظمة وتحليل الاتجاهات'],
  ['sk-en-01-mods', 'EN-01.1', 'en-01', null, 2, ['qs-eng', 'c-eng-init'], [], 'Design changes and plant modifications', 'تغييرات التصميم وتعديلات المحطة'],
  ['sk-en-01-project', 'EN-01.2', 'en-01', 'project', 2, [], ['as-owners-engineer', 'as-project-abroad', 'as-investment-appraisal', 'as-process-heat'], "Project controls and owner's engineering", 'ضبط المشاريع وهندسة المالك'],
  ['sk-ns-02-techspec', 'NS-02.1', 'ns-02', null, 3, ['qs-ro', 'qs-sro', 'qs-wc'], [], 'Technical specification compliance (LCOs)', 'الامتثال للمواصفات الفنية (شروط التشغيل المحددة)'],
  ['sk-ns-02-licensing', 'NS-02.2', 'ns-02', null, 2, [], ['as-new-licensing-basis', 'as-other-regulators'], 'Licensing basis and regulatory submissions', 'أساس الترخيص والتقديمات التنظيمية'],
  ['sk-ns-01-psa', 'NS-01.1', 'ns-01', null, 2, ['c-sam'], [], 'Probabilistic safety insights', 'رؤى السلامة الاحتمالية'],
  ['sk-hu-01-star', 'HU-01.1', 'hu-01', null, 2, ['qs-get', 'c-hu', 'c-hu-ref'], [], 'Self-checking and stop when unsure', 'الفحص الذاتي والتوقف عند الشك'],
  ['sk-hu-02-brief', 'HU-02.1', 'hu-02', null, 2, ['c-hu', 'qs-wc', 'qs-sro'], [], 'Pre-job briefs and post-job reviews', 'إحاطات ما قبل العمل ومراجعات ما بعده'],
  ['sk-ep-01-ero', 'EP-01.1', 'ep-01', null, 3, ['qs-ero', 'c-ero'], [], 'Emergency response organisation position', 'منصب في منظمة الاستجابة للطوارئ'],
  ['sk-ep-02-fire', 'EP-02.1', 'ep-02', null, 3, ['qs-fire', 'c-fire'], [], 'Fire brigade response', 'استجابة فرقة الإطفاء'],
  ['sk-qa-01-inspect', 'QA-01.1', 'qa-01', null, 3, ['qs-qa'], [], 'Inspection and test planning (QC)', 'تخطيط الفحص والاختبار (مراقبة الجودة)'],
  ['sk-qa-02-cgd', 'QA-02.1', 'qa-02', null, 2, ['c-sa-cgd-103'], [], 'Commercial-grade dedication technical evaluation', 'التقييم الفني لاعتماد المواد التجارية'],
  ['sk-ld-01-coach', 'LD-01.1', 'ld-01', null, 2, ['qs-instr', 'c-instr', 'c-crucial'], [], 'Coaching and feedback', 'التوجيه وتقديم الملاحظات'],
  ['sk-ld-01-instruct', 'LD-01.2', 'ld-01', null, 3, ['qs-instr', 'c-instr', 'c-asip'], [], 'Instructional delivery (SAT)', 'تقديم التدريب وفق النهج المنهجي'],
  ['sk-ld-02-decide', 'LD-02.1', 'ld-02', null, 3, ['qs-sro', 'c-coct', 'c-exec-sim'], [], 'Operational decision-making under uncertainty', 'اتخاذ القرار التشغيلي في ظروف عدم اليقين'],
  ['sk-da-01-analysis', 'DA-01.1', 'da-01', null, 2, [], [], 'Data analysis and visualisation', 'تحليل البيانات وتصويرها'],
  ['sk-da-01-scripting', 'DA-01.2', 'da-01', null, 2, [], [], 'Scripting for engineering analysis', 'البرمجة النصية للتحليل الهندسي'],
  ['sk-da-01-twins', 'DA-01.3', 'da-01', null, 2, [], ['as-digital-twins'], 'Digital twins and plant data models', 'التوائم الرقمية ونماذج بيانات المحطة'],
  ['sk-da-01-remote', 'DA-01.4', 'da-01', null, 2, [], ['as-remote-ops', 'as-autonomous-control'], 'Remote monitoring and oversight of autonomous control', 'المراقبة عن بُعد والإشراف على التحكم الذاتي'],
  ['sk-da-02-review', 'DA-02.1', 'da-02', null, 2, ['c-ai-gov'], [], 'Reviewing AI outputs under governance', 'مراجعة مخرجات الذكاء الاصطناعي ضمن الحوكمة'],
];

/** Catalogue rows: one core skill per competency (same code and name) plus the specialised skills above. */
export function buildSkills(T) {
  const comp = new Map(T.competencies.map((c) => [c.id, c]));
  const core = T.competencies.map((c, i) => ({
    id: `sk-${c.id}`, code: c.code, competency_id: c.id, name_en: c.name_en, name_ar: c.name_ar, area: AREA[c.domain] ?? 'operations',
    core: true, key_level: 2, evidence_keys: [], adjacent_ids: [], adv_skill_ids: [], description_en: c.description_en, description_ar: c.description_ar, sources: [], sort: i * 10,
  }));
  const spec = SPECIAL.map(([id, code, cid, area, key_level, keys, adv, en, ar]) => {
    const c = comp.get(cid);
    if (!c) throw new Error(`f01: unknown competency ${cid}`);
    return { id, code, competency_id: cid, name_en: en, name_ar: ar, area: area ?? AREA[c.domain], core: false, key_level, evidence_keys: keys, adjacent_ids: [], adv_skill_ids: adv, description_en: `${en}: part of ${c.name_en} (${c.code}).`, description_ar: `${ar}: جزء من ${c.name_ar} (${c.code}).`, sources: [], sort: core.find((x) => x.competency_id === cid).sort + 1 + SPECIAL.filter((s) => s[2] === cid).findIndex((s) => s[0] === id) };
  });
  const all = [...core, ...spec].sort((a, b) => a.sort - b.sort);
  // Adjacency: skills under the same competency, plus skills in the same area (max 6, deterministic).
  for (const s of all) {
    const same = all.filter((x) => x.id !== s.id && x.competency_id === s.competency_id).map((x) => x.id);
    const area = all.filter((x) => x.id !== s.id && x.competency_id !== s.competency_id && x.area === s.area).map((x) => x.id);
    s.adjacent_ids = [...same, ...area].slice(0, 6);
  }
  // Every adv_skill maps to at least one skill: unmapped ones go to the core skill of the closest competency.
  const mapped = new Set(all.flatMap((s) => s.adv_skill_ids));
  for (const a of T.adv_skills ?? []) if (!mapped.has(a.id)) throw new Error(`f01: adv_skill ${a.id} not mapped to a skill`);
  return all;
}

const sourcesOf = (T) => ({
  skills: T.skills, competencies: T.competencies, role_competencies: T.role_competencies, qual_standards: T.qual_standards, qual_records: T.qual_records,
  training_records: T.training_records, courses: T.courses, attempts: T.attempts, assessment_forms: T.assessment_forms, jpm_results: T.jpm_results, jpms: T.jpms,
});

export default function build(T) {
  T.skills = buildSkills(T);
  T.skill_evidence = [...(T.skill_evidence ?? [])];
  T.person_skills = [];
  T.engine_settings = [
    { id: 'skills', surface: 'skills', engine: 'deterministic', weights: { half_life_months: 36 } },
    { id: 'recommend', surface: 'recommend', engine: 'deterministic', weights: { current_role: 1, target_role: 0.6, core: 3, important: 2, useful: 1 } },
    { id: 'match', surface: 'match', engine: 'deterministic', weights: { skills: 0.7, development: 0.2, target: 0.1 } },
    { id: 'search', surface: 'search', engine: 'deterministic', weights: { title: 3, k1: 1.4, b: 0.7 } },
  ];
}

const rating = (person, skill, level, refTable, refId, note) => ({
  id: evidenceId('rating', refId, skill), person_id: person, skill_id: skill, kind: 'rating', ref_table: refTable, ref_id: refId, level, basis: 'claimed', status: 'current',
  observed_on: null, note, recorded_by: person, active: true,
});

/** After every ext builder: fallback self-ratings for people with no evidence at all, then derive every state. */
export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const derived = gatherEvidence(sourcesOf(T), { person: null, now });
  const has = new Set([...derived, ...T.skill_evidence].map((e) => e.person_id));
  const firstApp = new Map();
  for (const a of [...T.applications].sort((x, y) => String(x.submitted_at).localeCompare(String(y.submitted_at)))) if (!firstApp.has(a.person_id)) firstApp.set(a.person_id, a);
  for (const p of T.people) {
    if (has.has(p.id)) continue;
    const app = firstApp.get(p.id);
    if (app) {
      const on = String(app.submitted_at).slice(0, 10);
      T.skill_evidence.push({ ...rating(p.id, 'sk-da-01', 2, 'applications', app.id, 'Self-rated on the application form'), observed_on: on });
      T.skill_evidence.push({ ...rating(p.id, 'sk-pf-01', 1, 'applications', app.id, 'Self-rated on the application form'), observed_on: on });
      continue;
    }
    const on = String(p.hire_date ?? '2026-01-01').slice(0, 10);
    const set = p.kind === 'contractor' || p.kind === 'partner' ? [['sk-qa-01', 2], ['sk-sc-01', 1]]
      : p.level === 'leadership' ? [['sk-ld-01', 3], ['sk-ld-02', 3], ['sk-sc-02', 3]]
      : p.level === 'senior' ? [['sk-ld-01', 2], ['sk-da-01', 2]]
      : [['sk-da-01', 2], ['sk-hu-01', 1]];
    for (const [s, l] of set) T.skill_evidence.push({ ...rating(p.id, s, l, 'people', p.id, 'Self-rated at onboarding (synthetic profile)'), observed_on: on });
  }
  const recorded = T.skill_evidence.filter((e) => ['rating', 'ojt', 'credential'].includes(e.kind) || ['fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts'].includes(e.ref_table)); // FS10, FS21/FS22 (fsCe3)
  T.skill_evidence = [...derived.map((e) => ({ ...e, note: null, recorded_by: null, active: true })), ...recorded].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  T.person_skills = deriveStates(T.skill_evidence, now, decayModelFrom(T.engine_settings, T.skills)).map( // FS03: per-class half-lives
    (s) => ({ ...s, active: true, updated_at: `${now}T00:00:00Z` }));
}
export const FINALIZE_LAST = true;
