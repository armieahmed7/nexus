// FS31 + FS32 + FS33 (future-skills wave D · E3, M17) seed: future-skills micro-credentials with a strategic tier, learner-record
// shares and skill-goal plans.
// build():    eight FS31 definitions (seven new codes plus MC-TWINS v2, published; v1 was the F32 draft and is now superseded), one new
//             draft for review (MC-H2-HEAT), the strategic tier on three of them, the gigs and rotations that name a strategic credential
//             (microcred_unlocks), and every definition checked with the same validateDef the RPC applies and for satisfiability through
//             existing or FS19 content.
// finalize(): FINALIZE_LAST and, by file name, after f32 (F32 awards), fs03 (award evidence back-fill), fs19 (course pack) and fs21
//             (FS21/FS22 results): awards of the FS31 credentials for active staff whose real evidence meets every criterion (adaptive
//             and task criteria count only counted attempts whose integrity report is not voided), signed with the server issuer key
//             exactly as kafaa_mc_issue signs them; their F01 `credential` evidence (FS03 back-fill rule), the states of the people
//             concerned re-derived and the F36 digests, F23 snapshots and F35 outlooks rebuilt the same way fs21 does; FS33 plans for the
//             FS07 goals plus new goals (some shared with the manager, one withdrawn); FS32 share links (active, expired, revoked).
//             Fails the build if a definition fails validation or is not satisfiable, or if an original 71-skill state changes.
// Synthetic people only.
import { readFileSync } from 'node:fs';
import { signingBytes, withProof } from '../../../src/modules/m17/issuer.ts';
import { edSign, fromHex, sha256, toHex, utf8 } from '../../../src/modules/m17/badgeCrypto.ts';
import { addDays, addMonths, alignedSkills, buildMicrocredCredential, eligibility, evidenceSnapshot, latestAward, validateDef } from '../../../src/modules/m17/microcred.ts';
import { satisfiability, unlockId, unlockProblem } from '../../../src/modules/m17/futureCreds.ts';
import { recordItems, buildBundle, validateClr } from '../../../src/modules/m17/learnerRecord.ts';
import { goalId, planRow } from '../../../src/modules/m17/skillGoals.ts';
import { decayModelFrom, deriveStates } from '../../../src/domain/skills.ts';
import { backfillAwardEvidence } from './fs03-decay.mjs';
import { finalize as rebuildDigests } from './f36-digest.mjs';
import { inputFromTables, outlookFor } from '../../../src/modules/m07/outlook.ts';
import { snapshotFrom } from '../../../src/modules/m20/reserve.ts';

export const FINALIZE_LAST = true;
const MIGRATION = 'supabase/migrations/20261009111001_kafaa_w1e1_passport.sql';
const serverSeed = () => {
  const m = readFileSync(MIGRATION, 'utf8').match(/kafaa_badge_issuer_seed\(\)[\s\S]*?'\\x([0-9a-f]{64})'::bytea/);
  if (!m) throw new Error(`fs31: issuer seed not found in ${MIGRATION}`);
  return fromHex(m[1]);
};
const hx = (s) => toHex(sha256(utf8(s)));
const h = (s) => parseInt(hx(`kafaa-fs31:${s}`).slice(0, 8), 16);
const slugFor = (id) => `mc${hx(`kafaa-seed-mc:${id}`).slice(0, 12)}`;
const ts = (d, hh = 9) => `${d}T${String(hh).padStart(2, '0')}:00:00Z`;
const C = (key, kind, ref, label_en, label_ar, min_level = null) => ({ key, kind, ref, min_level: kind === 'skill' || kind === 'adaptive' ? min_level ?? 2 : null, label_en, label_ar });
const NDDI_EN = 'No deployment decision implied.';
const NDDI_AR = 'لا يعني ذلك اتخاذ أي قرار بالنشر.';

// [code, version, status, area, level, title_en, title_ar, summary_en, summary_ar, criteria, alignment, role_ids, validity, hours, effective, reason, strategic]
export const FS31_DEFS = [
  ['MC-AI-ASSURER', 1, 'current', 'ai_data', 'advanced', 'AI assurer', 'ضامن مخرجات الذكاء الاصطناعي',
    'Checks AI outputs against plant data and procedures, challenges them when they do not fit, and records the decision. Strategic: opens the governed AI pilots.',
    'يتحقق من مخرجات الذكاء الاصطناعي مقابل بيانات المحطة والإجراءات، ويعترض عليها عندما لا تتطابق، ويسجّل القرار. استراتيجي: يفتح تجارب الذكاء الاصطناعي المُحكَمة.',
    [C('adaptive', 'adaptive', 'ab-ai-literacy', 'AI literacy adaptive check at level 2 or above (counted, integrity not voided)', 'الفحص التكيّفي لمحو الأمية في الذكاء الاصطناعي بمستوى 2 فأعلى (محتسب، وتقرير النزاهة غير ملغى)', 2),
     C('verify', 'skill', 'sk-fs-ai-verify', 'AI output verification and challenge at level 2 or above (evidenced)', 'التحقق من مخرجات الذكاء الاصطناعي والاعتراض عليها بمستوى 2 فأعلى (مثبت بالأدلة)', 2),
     C('anomaly', 'skill', 'sk-fs-ai-anomaly', 'Anomaly triage with AI alerts at level 2 or above (evidenced, for example the AI alert performance task)', 'فرز الحالات الشاذة باستخدام تنبيهات الذكاء الاصطناعي بمستوى 2 فأعلى (مثبت بالأدلة، مثل مهمة الأداء الخاصة بتنبيهات الذكاء الاصطناعي)', 2)],
    [{ skill_id: 'sk-fs-ai-verify', level: 2 }, { skill_id: 'sk-fs-ai-use', level: 1 }], ['systems-design-plant-engineer', 'operations-support-work-control', 'quality-assurance-qc'], 24, 30, '2026-09-15', 'First published (FS31)', true],
  ['MC-DATA-DECISIONS', 1, 'current', 'ai_data', 'practitioner', 'Data for plant decisions', 'البيانات لقرارات المحطة',
    'Turns SIMULATED plant trends into a decision others can check: data quality first, then the drift, then the recommendation. Strategic: opens the outage analytics gig.',
    'يحوّل اتجاهات المحطة المحاكاة إلى قرار يمكن للآخرين التحقق منه: جودة البيانات أولًا، ثم الانحراف، ثم التوصية. استراتيجي: يفتح فرصة تحليلات الانقطاع.',
    [C('task', 'task', 'pt-feedwater-drift', 'Passed the feedwater drift performance task (counted, integrity not voided)', 'اجتياز مهمة الأداء الخاصة بانحراف مياه التغذية (محتسبة، وتقرير النزاهة غير ملغى)'),
     C('quality', 'skill', 'sk-fs-ai-plantdata', 'Plant-data quality at level 2 or above (evidenced)', 'جودة بيانات المحطة بمستوى 2 فأعلى (مثبت بالأدلة)', 2)],
    [{ skill_id: 'sk-fs-ai-plantdata', level: 2 }], ['systems-design-plant-engineer', 'reactor-engineer-core-physicist', 'operations-support-work-control'], 24, 24, '2026-09-15', 'First published (FS31)', true],
  ['MC-TWINS', 2, 'current', 'ai_data', 'advanced', 'Digital twin practitioner', 'ممارس التوائم الرقمية',
    'Validates a digital twin against plant data, triages a divergence and explains what the model can and cannot show. Strategic: opens the digital twin study and the digital rotation.',
    'يتحقق من التوأم الرقمي مقابل بيانات المحطة، ويفرز حالات الانحراف، ويشرح ما يمكن للنموذج إظهاره وما لا يمكنه. استراتيجي: يفتح دراسة التوأم الرقمي والتدوير الرقمي.',
    [C('task', 'task', 'pt-twin-divergence', 'Passed the twin divergence performance task (counted, integrity not voided)', 'اجتياز مهمة الأداء الخاصة بانحراف التوأم الرقمي (محتسبة، وتقرير النزاهة غير ملغى)'),
     C('twin', 'skill', 'sk-fs-ai-twin', 'Digital twin validation at level 2 or above (evidenced)', 'التحقق من التوأم الرقمي بمستوى 2 فأعلى (مثبت بالأدلة)', 2)],
    [{ skill_id: 'sk-fs-ai-twin', level: 2 }], ['systems-design-plant-engineer', 'fr-digital-twin'], 24, 40, '2026-09-15', 'Published as the Digital twin practitioner: FS21/FS22 evidence replaces the study criterion (FS31)', true],
  ['MC-SMR-FOUND', 1, 'current', 'advanced_reactor', 'foundation', 'SMR foundations', 'أساسيات المفاعلات المعيارية الصغيرة',
    `Explains how small modular reactors differ from a large PWR: passive safety, modules and factory build. Orientation only. ${NDDI_EN}`,
    `يشرح كيف تختلف المفاعلات المعيارية الصغيرة عن مفاعل الماء المضغوط الكبير: السلامة السلبية والوحدات والتصنيع في المصنع. للتعريف فقط. ${NDDI_AR}`,
    [C('adaptive', 'adaptive', 'ab-smr', 'SMR fundamentals check: standard met at level 2 or above', 'فحص أساسيات المفاعلات المعيارية الصغيرة: تحقيق المعيار بمستوى 2 فأعلى', 2),
     C('passive', 'skill', 'sk-fs-adv-passive', 'Passive safety concepts at level 2 or above (evidenced)', 'مفاهيم السلامة السلبية بمستوى 2 فأعلى (مثبت بالأدلة)', 2)],
    [{ skill_id: 'sk-fs-adv-smr', level: 1 }, { skill_id: 'sk-fs-adv-passive', level: 1 }], ['reactor-operator', 'senior-reactor-operator', 'reactor-engineer-core-physicist'], 36, 16, '2026-09-15', 'First published (FS31)', false],
  ['MC-CLEAN-ENERGY', 1, 'current', 'green_energy', 'practitioner', 'Clean energy systems', 'أنظمة الطاقة النظيفة',
    'Reads lifecycle carbon and GHG figures for a nuclear plant, keeps a clean GHG log and places nuclear in the clean energy system.',
    'يقرأ أرقام الكربون على مدى دورة الحياة وانبعاثات غازات الدفيئة لمحطة نووية، ويحافظ على سجل دقيق للانبعاثات، ويضع الطاقة النووية في منظومة الطاقة النظيفة.',
    [C('adaptive', 'adaptive', 'ab-clean-energy', 'CleanEnergyComp adaptive check at level 2 or above (counted, integrity not voided)', 'الفحص التكيّفي لكفاءات الطاقة النظيفة بمستوى 2 فأعلى (محتسب، وتقرير النزاهة غير ملغى)', 2),
     C('ghg', 'skill', 'sk-fs-gr-ghg', 'GHG accounting basics at level 2 or above (evidenced, for example the GHG log performance task)', 'أساسيات محاسبة انبعاثات غازات الدفيئة بمستوى 2 فأعلى (مثبت بالأدلة، مثل مهمة الأداء الخاصة بسجل الانبعاثات)', 2)],
    [{ skill_id: 'sk-fs-gr-ghg', level: 2 }], ['environmental-monitoring-specialist', 'corporate-professional', 'systems-design-plant-engineer'], 24, 20, '2026-09-15', 'First published (FS31)', false],
  ['MC-CYBER-HYGIENE', 1, 'current', 'cyber_hygiene', 'foundation', 'Cyber hygiene for all staff', 'النظافة السيبرانية لجميع الموظفين',
    'Awareness only: spots phishing, keeps removable media and passwords clean, and reports anything suspicious straight away. No security detail.',
    'للتوعية فقط: يكتشف رسائل التصيّد، ويحافظ على نظافة الوسائط القابلة للإزالة وكلمات المرور، ويبلّغ فورًا عن أي أمر مريب. لا يتضمن أي تفاصيل أمنية.',
    [C('adaptive', 'adaptive', 'ab-cyber-hygiene', 'Cyber hygiene check: standard met at level 2 or above', 'فحص النظافة السيبرانية: تحقيق المعيار بمستوى 2 فأعلى', 2)],
    [{ skill_id: 'sk-fs-cy-phishing', level: 1 }, { skill_id: 'sk-fs-cy-report', level: 1 }], [], 12, 4, '2026-09-15', 'First published (FS31)', false],
  ['MC-QUESTION-AI', 1, 'current', 'human_performance', 'practitioner', 'Questioning in an AI-augmented plant', 'الموقف التساؤلي في محطة معزّزة بالذكاء الاصطناعي',
    'Keeps a questioning attitude when a tool or a model gives the answer: stops, checks the source and raises it when something does not fit.',
    'يحافظ على الموقف التساؤلي عندما تقدّم أداة أو نموذج الإجابة: يتوقف، ويتحقق من المصدر، ويثير الأمر عندما لا يتطابق شيء ما.',
    [C('question', 'skill', 'sk-sc-01', 'Questioning attitude and raising concerns at level 2 or above (verified, evidenced or validated)', 'الموقف التساؤلي وإثارة المخاوف بمستوى 2 فأعلى (موثّق أو مثبت أو مُصادق عليه)', 2),
     C('adaptive', 'adaptive', 'ab-ai-literacy', 'AI literacy adaptive check at level 2 or above (counted, integrity not voided)', 'الفحص التكيّفي لمحو الأمية في الذكاء الاصطناعي بمستوى 2 فأعلى (محتسب، وتقرير النزاهة غير ملغى)', 2)],
    [{ skill_id: 'sk-fs-ai-verify', level: 1 }], ['reactor-operator', 'senior-reactor-operator', 'shift-supervisor', 'human-performance-specialist'], 24, 10, '2026-09-15', 'First published (FS31)', false],
  ['MC-SYSTEMS', 1, 'current', 'transversal', 'practitioner', 'Systems thinking', 'التفكير المنظومي',
    'Maps how a change in one plant system, team or schedule ripples into others before acting, and explains the trade-offs.',
    'يرسم كيف ينعكس تغيير في نظام أو فريق أو جدول في المحطة على الأنظمة الأخرى قبل التصرف، ويشرح المفاضلات.',
    [C('course', 'course', 'c-fs-systems', 'Completed FS-TR-201 Systems thinking (course pack)', 'إكمال دورة FS-TR-201 التفكير المنظومي (حزمة الدورات)'),
     C('systems', 'skill', 'sk-fs-tr-systems', 'Systems thinking at level 2 or above (evidenced)', 'التفكير المنظومي بمستوى 2 فأعلى (مثبت بالأدلة)', 2),
     C('analytic', 'skill', 'sk-fs-tr-analytical', 'Analytical thinking at level 2 or above (evidenced)', 'التفكير التحليلي بمستوى 2 فأعلى (مثبت بالأدلة)', 2)],
    [{ skill_id: 'sk-fs-tr-systems', level: 2 }], ['shift-supervisor', 'outage-manager-planner', 'nuclear-oversight-npi', 'shift-technical-advisor'], 36, 20, '2026-09-15', 'First published (FS31)', false],
  ['MC-H2-HEAT', 1, 'draft', 'green_energy', 'practitioner', 'Hydrogen and process heat interfaces', 'واجهات الهيدروجين والحرارة الصناعية',
    `Explains how a nuclear plant could supply hydrogen or process heat and what that changes at the interface. ${NDDI_EN}`,
    `يشرح كيف يمكن لمحطة نووية توفير الهيدروجين أو الحرارة الصناعية وما الذي يتغير عند الواجهة. ${NDDI_AR}`,
    [C('course', 'course', 'c-fs-h2heat', 'Completed FS-GR-201 Hydrogen and process heat (course pack)', 'إكمال دورة FS-GR-201 الهيدروجين والحرارة الصناعية (حزمة الدورات)'),
     C('h2', 'skill', 'sk-fs-gr-h2heat', 'Hydrogen and process-heat interfaces at level 2 or above (evidenced)', 'واجهات الهيدروجين والحرارة الصناعية بمستوى 2 فأعلى (مثبت بالأدلة)', 2)],
    [{ skill_id: 'sk-fs-gr-h2heat', level: 2 }], ['fr-process-heat', 'systems-design-plant-engineer'], 24, 24, null, 'Draft for review (FS31)', false],
];
/** Gigs (F08 opportunities) and rotations (F15 templates) that name a strategic credential. */
export const FS31_UNLOCKS = [
  ['MC-AI-ASSURER', 'opportunity', 'opp-governed-ai-pilot', 'Reviewers of AI-drafted work-order summaries must hold the AI assurer credential.', 'يجب أن يحمل مراجعو ملخصات أوامر العمل التي يصوغها الذكاء الاصطناعي اعتماد ضامن مخرجات الذكاء الاصطناعي.'],
  ['MC-AI-ASSURER', 'rotation', 'rt-digital-draft', 'The digital and data rotation takes AI assurers first.', 'يقبل تدوير البيانات والرقمنة حاملي اعتماد ضامن مخرجات الذكاء الاصطناعي أولًا.'],
  ['MC-TWINS', 'opportunity', 'opp-digital-twin-study', 'The twin feasibility study needs people who can validate a twin.', 'تحتاج دراسة جدوى التوأم الرقمي إلى أشخاص قادرين على التحقق من التوأم.'],
  ['MC-TWINS', 'rotation', 'rt-digital-draft', 'Digital twin practitioners are eligible for the digital and data rotation.', 'ممارسو التوائم الرقمية مؤهلون لتدوير البيانات والرقمنة.'],
  ['MC-DATA-DECISIONS', 'opportunity', 'opp-outage-schedule-analytics', 'The critical-path dashboard is built on data-for-decisions practice.', 'تُبنى لوحة المسار الحرج على ممارسة البيانات لقرارات المحطة.'],
  ['MC-DATA-DECISIONS', 'rotation', 'rt-cross-ops-eng', 'Operations staff moving to plant engineering with this credential are eligible for the cross-functional rotation.', 'موظفو العمليات المنتقلون إلى هندسة المحطة الحاملون لهذا الاعتماد مؤهلون للتدوير متعدد الوظائف.'],
];

export default function build(T) {
  // Definitions and unlocks are added in finalize (after fs17's pathway gap snapshot, so FS17's seeded rows stay as loaded live);
  // here only the tables exist.
  T.microcred_unlocks = [];
  T.record_shares = [];
  T.skill_goal_plans = [];
}

/** The FS31 definitions, the tier and the unlocks (finalize, before the awards). */
function addDefs(T) {
  const defs = T.microcred_defs;
  // MC-TWINS v1 was the F32 draft: revised into v2 and published (v1 superseded, never deleted)
  const v1 = defs.find((d) => d.id === 'mcd-mc-twins-v1');
  if (!v1) throw new Error('fs31: F32 draft MC-TWINS v1 missing');
  v1.status = 'superseded';
  let sort = Math.max(...defs.map((d) => Number(d.sort) || 0));
  for (const [code, version, status, area, level, title_en, title_ar, summary_en, summary_ar, criteria, alignment, role_ids, validity_months, hours, effective, change_reason, strategic] of FS31_DEFS) {
    sort += 10;
    defs.push({
      id: `mcd-${code.toLowerCase()}-v${version}`, code, version, kind: 'micro', area, level, title_en, title_ar, summary_en, summary_ar, criteria, stacks_into: null, alignment, role_ids, validity_months, hours,
      status, effective_date: effective, supersedes_id: version > 1 ? `mcd-${code.toLowerCase()}-v${version - 1}` : null, change_reason, sort,
      updated_by: 'p-training-mgr', updated_at: ts(effective ?? '2026-10-06'), published_by: status === 'draft' ? null : 'p-training-mgr', published_at: status === 'draft' ? null : ts(effective ?? '2026-10-06'),
      strategic, strategic_note: strategic ? 'Strategic tier: opens named future gigs and rotations (IBM digital-credential pattern)' : null, strategic_since: strategic ? effective : null,
    });
  }
  for (const d of defs) if (d.strategic == null) Object.assign(d, { strategic: false, strategic_note: null, strategic_since: null });
  T.microcred_unlocks = [];
  for (const [def_code, target_kind, target_id, note_en, note_ar] of FS31_UNLOCKS) {
    const u = { id: unlockId(def_code, target_kind, target_id), def_code, target_kind, target_id, note_en, note_ar, active: true, set_by: 'p-training-mgr', set_at: ts('2026-09-16') };
    const p = unlockProblem(u, { defs, unlocks: T.microcred_unlocks, opportunities: T.opportunities, rotation_templates: T.rotation_templates });
    if (p !== 'ok') throw new Error(`fs31: unlock ${u.id} ${p}`);
    T.microcred_unlocks.push(u);
  }
}

// FS33 goals: [person, skill, level, date, shared, note, status]; the first eight plan FS07's seeded goals
const GOALS = [
  ['p-k-ro', 'sk-fs-ai-verify', 2, '2026-12-31', true, 'Before the governed AI pilot opens in Q1', 'active'],
  ['p-k-ro', 'sk-fs-adv-passive', 2, '2027-06-30', true, 'For the ADVANCE study support channel', 'active'],
  ['p-k-ro', 'sk-fs-tr-systems', 3, '2027-09-30', false, null, 'active'],
  ['p-qc-inspector', 'sk-fs-adv-factoryqa', 3, '2027-03-31', true, 'Supplier surveillance for modular builds', 'active'],
  ['p-qc-inspector', 'sk-fs-dp-ework', 2, '2027-01-31', false, null, 'active'],
  ['p-nse', 'sk-fs-ai-twin', 2, '2027-02-28', false, null, 'removed'],
  ['p-nse', 'sk-fs-ai-anomaly', 2, '2027-02-28', false, null, 'active'],
  ['p-sro', 'sk-fs-adv-multimodule', 2, '2027-12-31', false, null, 'active'],
  ['w-ro-01', 'sk-fs-ai-use', 3, '2027-03-31', true, null, 'active'],
  ['w-ro-02', 'sk-fs-adv-smr', 2, '2026-12-15', false, null, 'active'],
  ['w-ro-02', 'sk-fs-tr-resilience', 2, '2027-04-30', true, 'Shift pattern change next year', 'active'],
  ['w-lo-02', 'sk-fs-cy-phishing', 3, '2026-11-30', true, null, 'active'],
  ['w-sro-04', 'sk-fs-tr-leadership', 3, '2027-10-31', true, 'Shift supervisor development', 'active'],
  ['w-sro-01', 'sk-fs-ai-prompt', 2, '2026-12-31', false, null, 'removed'],
  ['p-buyer', 'sk-fs-dp-procurement', 3, '2027-05-31', false, null, 'active'],
  ['p-chem-sup', 'sk-fs-gr-ghg', 2, '2027-01-31', false, null, 'active'],
];
const AWARD_RATE = 7; // of 10: eligible people who have claimed the credential

/** Every FS31 definition passes the RPC's validateDef (copy check, no security or mirror criteria) and is satisfiable. Run in finalize:
 *  the FS02 skills it names are added by fs02's finalizer. */
function checkDefs(T) {
  const defs = T.microcred_defs;
  const w = { defs, courses: T.courses, forms: T.assessment_forms, opportunities: T.opportunities, skills: T.skills, competencies: T.competencies, job_roles: T.job_roles, qual_standards: T.qual_standards,
    adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks };
  const content = { courses: T.courses, course_skill_links: T.course_skill_links ?? [], adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks, opportunities: T.opportunities, skills: T.skills };
  for (const d of defs.filter((x) => x.id.startsWith('mcd-') && FS31_DEFS.some((f) => `mcd-${f[0].toLowerCase()}-v${f[1]}` === x.id))) {
    const v = validateDef({ ...d, stacks_into: null }, { ...w, defs: defs.filter((x) => x.id !== d.id) });
    if (v.code !== 'ok') throw new Error(`fs31: definition ${d.id} fails validation: ${v.code}`);
    const s = satisfiability(d, content);
    if (!s.ok) throw new Error(`fs31: definition ${d.id} is not satisfiable (${s.missing.join(', ')})`);
  }
}

export function finalize(T, ctx) {
  addDefs(T);
  checkDefs(T);
  const today = ctx.DEMO_TODAY;
  const seed = serverSeed();
  const defs = T.microcred_defs;
  const awards = T.microcred_awards;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const base = {
    defs, awards, courses: T.courses, training_records: T.training_records, attempts: T.attempts, opportunities: T.opportunities, opportunity_applications: T.opportunity_applications,
    person_skills: T.person_skills, adaptive_attempts: T.adaptive_attempts ?? [], task_attempts: T.task_attempts ?? [], integrity_reports: T.integrity_reports ?? [],
  };
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id).sort();
  const mine = defs.filter((d) => d.status === 'current' && FS31_DEFS.some((f) => f[0] === d.code)).sort((a, b) => (a.code < b.code ? -1 : 1));
  const evDate = (e) => e.criteria.flatMap((c) => c.evidence.map((x) => x.date)).filter(Boolean).sort().pop() ?? null;
  const issued = [];
  for (const pid of staff) {
    for (const def of mine) {
      const now = eligibility(def, pid, { ...base, today });
      if (!now.eligible) continue;
      const k = h(`${pid}:${def.code}`);
      if (pid !== 'p-k-ro' && k % 10 >= (def.strategic ? 9 : AWARD_RATE)) continue; // eligible but not yet claimed (p-k-ro's story: claims what it can)
      const last = evDate(now);
      let on = last ? addDays(last < def.effective_date ? def.effective_date : last, 2 + (k % 12)) : addDays(def.effective_date, 3 + (k % 18));
      if (on >= today) on = addDays(today, -(1 + (k % 5)));
      const e = eligibility(def, pid, { ...base, today: on });
      if (!e.eligible) continue;
      const id = `mca-${pid}-${def.code.toLowerCase()}-${on.replace(/-/g, '')}`;
      const slug = slugFor(id);
      const initials = people.get(pid)?.initials || '—';
      const validTo = addMonths(on, def.validity_months);
      const cred = buildMicrocredCredential({ slug, def, holderInitials: initials, issuedOn: on, validTo, alignment: alignedSkills(def, T.skills, T.competencies), components: [], keyId: 'key-1' });
      if (latestAward(awards, pid, def.code)) throw new Error(`fs31: ${pid} already holds ${def.code}`);
      awards.push({
        id, def_id: def.id, def_code: def.code, def_version: def.version, person_id: pid, holder_initials: initials, status: 'awarded', requested_at: ts(on, 8), issued_on: on, valid_to: validTo,
        evidence: evidenceSnapshot(e, null, on), component_award_ids: [], credential: withProof(cred, edSign(signingBytes(cred), seed)), key_id: 'key-1', public_slug: slug, renewed_from: null,
        decided_by: null, decided_at: null, decision_note: null, revoked_at: null, revoke_reason: null, created_at: ts(on, 8),
      });
      issued.push(id);
      T.notifications.push({ id: `nt-mc-${id}-awarded`, person_id: pid, kind: 'microcred', title_en: `Micro-credential awarded: ${def.code} ${def.title_en}`, title_ar: `مُنح الاعتماد المصغّر: ${def.code} ${def.title_ar}`,
        body_en: null, body_ar: null, link: '/my/skills/credentials', severity: 'ok', created_at: ts(on, 8), read_at: null });
    }
  }
  awards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  T.notifications.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // F01 credential evidence for the new awards (the FS03 back-fill rule), then the states of the people concerned
  const added = backfillAwardEvidence(T);
  const before = new Map(T.person_skills.map((s) => [s.id, `${s.level}|${s.confidence}|${s.basis}|${s.active}`]));
  T.skill_evidence = [...T.skill_evidence, ...added].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const touched = new Set(added.map((e) => e.person_id));
  const states = deriveStates(T.skill_evidence.filter((e) => touched.has(e.person_id)), today, decayModelFrom(T.engine_settings, T.skills));
  const byId = new Map(T.person_skills.map((p) => [p.id, p]));
  for (const s of states) {
    const patch = { level: s.level, confidence: s.confidence, basis: s.basis, reasons: s.reasons, evidence_count: s.evidence_count, confidence_band: s.confidence_band, conf_low: s.conf_low, conf_high: s.conf_high, active: true };
    const cur = byId.get(s.id);
    if (!cur) { T.person_skills.push({ id: s.id, person_id: s.person_id, skill_id: s.skill_id, ...patch, updated_at: `${today}T00:00:00Z` }); continue; }
    Object.assign(cur, patch);
  }
  T.person_skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  const changed = T.person_skills.filter((s) => !fsSkills.has(s.skill_id) && before.has(s.id) && before.get(s.id) !== `${s.level}|${s.confidence}|${s.basis}|${s.active}`);
  if (changed.length) throw new Error(`fs31: ${changed.length} states of the original catalogue changed (${changed[0].id})`);
  const levelUp = T.person_skills.filter((s) => before.has(s.id) && before.get(s.id).split('|')[0] !== String(s.level)).length;
  const oldNotices = new Set((T.digest_runs ?? []).map((r) => r.notification_id).filter(Boolean));
  if (T.digest_runs && T.digest_prefs) {
    T.notifications = T.notifications.filter((n) => !oldNotices.has(n.id));
    rebuildDigests(T, ctx);
  }
  for (const m of T.alumni ?? []) {
    if (!touched.has(m.person_id)) continue;
    m.skill_snapshot = snapshotFrom(T.person_skills.filter((s) => s.person_id === m.person_id), T.skills);
  }
  if (T.skill_outlooks?.length) {
    const inp = inputFromTables((t) => T[t] ?? []);
    for (const o of T.skill_outlooks) {
      const r = outlookFor(inp, o.params);
      if (r.code !== 'ok') throw new Error(`fs31: outlook ${o.id} ${r.code}`);
      o.params = r.result.params; o.results = r.result;
    }
  }

  // FS33: plans for FS07's goals and new goals (the FS07 goal rows for the new ones are added with source fs33)
  T.skill_goal_plans = [];
  for (const [pid, skill, level, date, shared, note, status] of GOALS) {
    if (!people.has(pid)) throw new Error(`fs31: goal person ${pid} missing`);
    const gid = goalId(pid, skill);
    let g = T.skill_goals.find((x) => x.id === gid);
    const at = ts('2026-10-0' + (1 + (h(gid) % 7)), 10);
    if (!g) { g = { id: gid, person_id: pid, skill_id: skill, target_level: level, status, source: 'fs33', created_at: at, updated_at: at }; T.skill_goals.push(g); }
    if (g.target_level !== level || g.status !== status) throw new Error(`fs31: goal ${gid} disagrees with FS07's row`);
    const row = planRow(pid, skill, { target_level: level, target_date: date, note, shared, status }, at, { created_at: g.created_at });
    T.skill_goal_plans.push(row);
  }
  T.skill_goals.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.skill_goal_plans.sort((a, b) => (a.id < b.id ? -1 : 1));

  // FS32: share links for k-ro (active, expired, revoked) and sro (active)
  const shareFor = (pid, id, label, created, expires, pickRefs, extra = {}) => {
    const w = { today, person: pid, initials: people.get(pid)?.initials || '—', microcred_awards: awards, microcred_defs: defs, badges: T.badges, certificates: T.certificates,
      qual_records: T.qual_records, qual_standards: T.qual_standards, person_skills: T.person_skills, skills: T.skills, competencies: T.competencies };
    const items = pickRefs(recordItems(w));
    if (!items.length) throw new Error(`fs31: share ${id} has no items`);
    const probs = validateClr(buildBundle(w, items, { id, issued_on: today, valid_until: expires }));
    if (probs.length) throw new Error(`fs31: share ${id} bundle is not CLR-shaped: ${probs[0]}`);
    T.record_shares.push({
      id, person_id: pid, token: hx(`kafaa-fs32-share:${id}`).slice(0, 32), label, items, holder_initials: w.initials, consents: { items: true, preview: true, share: true, at: ts(created, 11) },
      expires_on: expires, revoked_at: null, revoke_reason: null, views: 0, last_viewed_at: null, created_at: ts(created, 11), ...extra,
    });
  };
  const pickMix = (n) => (items) => [...items.filter((i) => i.kind === 'mc').slice(0, 2), ...items.filter((i) => i.kind === 'badge').slice(0, 1), ...items.filter((i) => i.kind === 'qual').slice(0, 1), ...items.filter((i) => i.kind === 'skill' && i.level >= 2).slice(0, n)].map((i) => i.ref);
  T.record_shares = [];
  shareFor('p-k-ro', 'rs-kro-digital-rotation', 'Digital and data rotation application', '2026-10-05', '2026-12-20', pickMix(4), { views: 3, last_viewed_at: ts('2026-10-07', 14) });
  shareFor('p-k-ro', 'rs-kro-mentoring-2026', 'Mentoring programme application', '2026-07-01', '2026-08-15', pickMix(2), { views: 1, last_viewed_at: ts('2026-07-03', 9) });
  shareFor('p-k-ro', 'rs-kro-old-draft', 'Shared by mistake', '2026-09-20', '2026-11-20', pickMix(1), { revoked_at: ts('2026-09-20', 12), revoke_reason: 'Shared the wrong items' });
  shareFor('p-sro', 'rs-sro-iaea-secondment', 'Secondment application (international organisation)', '2026-10-02', '2026-11-30', pickMix(3), { views: 2, last_viewed_at: ts('2026-10-06', 10) });
  T.record_shares.sort((a, b) => (a.id < b.id ? -1 : 1));

  const byCode = Object.fromEntries(mine.map((d) => [d.code, awards.filter((a) => a.def_code === d.code && issued.includes(a.id)).length]));
  console.log(`fs31: ${mine.length} FS31 definitions (${mine.filter((d) => d.strategic).length} strategic), ${T.microcred_unlocks.length} unlocks; ${issued.length} awards ${JSON.stringify(byCode)}; ${added.length} credential evidence rows; ${levelUp} skill levels changed; fs33: ${T.skill_goal_plans.length} goal plans (${T.skill_goal_plans.filter((p) => p.shared).length} shared); fs32: ${T.record_shares.length} share links`);
}
