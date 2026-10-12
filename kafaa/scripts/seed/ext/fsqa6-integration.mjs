// FS wave F integration (QA lead): cross-feature hand-offs between the wave-F features (FS50-FS59) and earlier waves. Runs as a
// FINALIZE_LAST finalizer after every wave-F builder and after fsqa5 (file-name order). It changes two things and checks the rest:
//  A. FS56 after FS59: fs56 measured skill change before fs58 added the validated role-play evidence (fs56 < fs58 by file name), so the
//     stored kafaa_skill_change_measures no longer reproduced from the rule on the final seed. They are recomputed here with the same
//     rule (skillChange as of DEMO_TODAY, computed by the training manager role card), exactly as computeSkillChange would.
//  B. FS55 lint: the three ranked lists wave F added get their engine cards (RANKED_SURFACES entries with wave 'FSQA6'): the FS50
//     register attention order (ranks register rows), the FS52 automation ranking (ranks skill families) and the FS58 suggested scenario
//     (ranks content). None ranks people. Inserted live by the QA migration (on conflict do nothing).
// Invariants (the build fails if one breaks):
//  1. recorded evidence (handover 3.9): roleplay_sessions is in RECORDED_REF_TABLES and every validated session's evidence uses it;
//  2. every ranked surface has exactly one card (34 = 8 F24 + 23 FS55 + 3 FSQA6);
//  3. FS57 -> FS17: the gap backlog holds every need the coverage rule finds on the final seed (a sync adds nothing);
//  4. FS59 -> F36: every role-play review requested by the demo day appears in the named reviewer's digest candidates;
//  5. FS54 -> F35/FS51: the methodology banner has notices for the skills outlook and the skill forecasts on the demo day.
// The live database gets the matching SQL and guarded replays from supabase/migrations/20261010269001_kafaa_fs6qa_integration.sql.
import { RECORDED_REF_TABLES } from '../../../src/domain/skills.ts';
import { FUTURE_SKILL_EQUIVALENT } from '../../../src/domain/taxonomy.ts';
import { skillChange, skillChangeWorld } from '../../../src/modules/m25/skillChange.ts';
import { backlogToCreate } from '../../../src/modules/m25/coverage.ts';
import { RANKED_SURFACES } from '../../../src/modules/m16/surfaces.ts';
import { methodologyNotices } from '../../../src/modules/m16/taxonomyGov.ts';
import { gatherDigest } from '../../../src/shell/digest/rules.ts';
import { remapRequirements } from './fsqa1-integration.mjs';
import { QA_D_REFRESH, refreshGaps } from './fsqa4-integration.mjs';
import { fs55Columns } from './fs54-taxonomy-governance.mjs';

export const FINALIZE_LAST = true;
export const QA_F_DAY = '2026-10-11'; // seed dates stay at or before 2026-10-11
export const WAVE_F_REF_TABLES = ['roleplay_sessions'];
const TM = 'p-training-mgr';

const b = (en, ar) => ({ en, ar });
const I = (key, en, ar) => ({ key, en, ar });
const NO_DECISION = b('It never decides anything on its own: a person reads the reasons and chooses.', 'لا يقرّر شيئاً بمفرده: يقرأ الشخص الأسباب ويختار.');
/** Card text for the wave-F ranked surfaces (registry fields come from RANKED_SURFACES). */
export const FSQA6_CARD_TEXT = {
  critical_attention: {
    title: b('Critical skills register: attention order', 'سجل المهارات الحرجة: ترتيب الأولوية'),
    owner: b('HR authority, CHCO office (role card)', 'سلطة الموارد البشرية، مكتب الرئيس التنفيذي لرأس المال البشري (بطاقة دور)'),
    inputs: [
      I('critical_skills', 'Register rows: target level and yearly targets, the build, buy, borrow or bot decision, KPIs and review dates', 'صفوف السجل: المستوى المستهدف والأهداف السنوية وقرار البناء أو الشراء أو الاستعارة أو الأتمتة والمؤشرات ومواعيد المراجعة'),
      I('person_skills', 'Counts of recorded skill states per skill and level (aggregated, suppressed under 10 people)', 'أعداد حالات المهارات المسجلة لكل مهارة ومستوى (مجمّعة، ومحجوبة دون 10 أشخاص)'),
      I('skill_gap_plans', 'Active FS04 gap plans linked to the register row', 'خطط الفجوات النشطة (FS04) المرتبطة بصف السجل'),
      I('skill_forecasts', 'The forecast gap from the released skill forecast', 'فجوة التوقع من إصدار توقعات المهارات المعتمد'),
    ],
    purpose: b('Orders the rows of the critical future-skills register by how much they need the HR director\'s attention: progress off track or at risk, an overdue quarterly review, no active gap plan and the forecast gap.',
      'يرتّب صفوف سجل المهارات المستقبلية الحرجة حسب حاجتها إلى انتباه مدير الموارد البشرية: تقدّم خارج المسار أو معرّض للخطر، ومراجعة ربعية متأخرة، وغياب خطة فجوة نشطة، وفجوة التوقع.'),
    output: b('Register rows (skills, never people) in attention order, each with its reasons; progress based on fewer than 10 people is suppressed.', 'صفوف السجل (مهارات وليست أشخاصاً) بترتيب الأولوية مع أسباب كل منها؛ ويُحجب التقدّم القائم على أقل من 10 أشخاص.'),
    oversight: b('The HR director reviews every adopted row each quarter and decides the response; the order only suggests where to look first.', 'يراجع مدير الموارد البشرية كل صف معتمد كل ربع سنة ويقرّر الاستجابة؛ ويقترح الترتيب فقط من أين يبدأ النظر.'),
    limitations: b('Progress is computed from recorded skill states and is SIMULATED in this demo. It ranks skills, not people.', 'يُحتسب التقدّم من حالات المهارات المسجلة وهو محاكى في هذا العرض. يرتّب المهارات لا الأشخاص.'),
    sql: ['sql:kafaa_crs_board_core'],
  },
  outlook_automation: {
    title: b('Skills outlook: automation exposure by family', 'آفاق المهارات: التعرض للأتمتة حسب العائلة'),
    owner: b('Future workforce lead (role card)', 'مسؤول القوى العاملة المستقبلية (بطاقة دور)'),
    inputs: [
      I('jta_tasks', 'Task hours per role and each task\'s AI change horizon from the job and task analysis (FS06)', 'ساعات المهام لكل دور وأفق تغيّر كل مهمة بالذكاء الاصطناعي من تحليل الوظائف والمهام (FS06)'),
      I('ai_capability_levels', 'Published AI capability levels and exposure references per task', 'مستويات قدرات الذكاء الاصطناعي المنشورة ومراجع التعرض لكل مهمة'),
      I('skill_outlooks', 'The outlook assumptions, including the adoption level chosen on the page', 'افتراضات الآفاق، ومنها مستوى التبني المختار في الصفحة'),
    ],
    purpose: b('Orders skill families by the share of their task hours that the task layer marks as AI-assisted or partly automated, at the adoption level chosen on the page.', 'يرتّب عائلات المهارات حسب حصة ساعات مهامها التي تعدّها طبقة المهام مدعومة بالذكاء الاصطناعي أو مؤتمتة جزئياً، عند مستوى التبني المختار في الصفحة.'),
    output: b('Families in order of exposure with the demand change at the chosen adoption, each with its reasons; every number is SIMULATED and families under 10 people are suppressed.', 'العائلات بترتيب التعرض مع تغيّر الطلب عند التبني المختار وأسباب كل منها؛ وكل رقم محاكى، وتُحجب العائلات التي تضم أقل من 10 أشخاص.'),
    oversight: b('HR planners set the adoption assumption; nothing changes a role, a headcount or a person.', 'يحدّد مخططو الموارد البشرية افتراض التبني؛ ولا يغيّر شيء دوراً أو عدداً أو شخصاً.'),
    limitations: b('Exposure comes from the task analysis and published capability levels, not from observed automation. It ranks families, not people.', 'يأتي التعرض من تحليل المهام ومستويات القدرات المنشورة، لا من أتمتة مرصودة. يرتّب العائلات لا الأشخاص.'),
    sql: ['sql:kafaa_so_auto_profile'],
  },
  aps_next: {
    title: b('Problem-solving practice: suggested next scenario', 'تدريب حل المشكلات: السيناريو المقترح التالي'),
    owner: b('Training Manager (role card)', 'مدير التدريب (بطاقة دور)'),
    inputs: [
      I('aps_scenarios', 'Published practice scenarios with their theme', 'سيناريوهات التدريب المنشورة مع موضوعها'),
      I('aps_attempts', 'My own practice runs (how often I practised each scenario)', 'محاولاتي التدريبية (عدد مرات تدرّبي على كل سيناريو)'),
    ],
    purpose: b('Suggests the published scenario I have practised least, rotated so that colleagues do not all get the same one, with the theme it trains.', 'يقترح السيناريو المنشور الذي تدرّبت عليه أقل من غيره، مع تدوير حتى لا يحصل الزملاء جميعاً على السيناريو نفسه، مع الموضوع الذي يدرّبه.'),
    output: b('One suggested scenario with its reasons; any other published scenario can be chosen.', 'سيناريو واحد مقترح مع أسبابه؛ ويمكن اختيار أي سيناريو منشور آخر.'),
    oversight: b('Scenarios are written and published by the training manager; results are mine and never gate a qualification.', 'يكتب مدير التدريب السيناريوهات وينشرها؛ والنتائج لي ولا تكون شرطاً لأي مؤهل.'),
    limitations: b('It ranks content, not people, and only among published scenarios.', 'يرتّب المحتوى لا الأشخاص، ومن بين السيناريوهات المنشورة فقط.'),
    sql: ['sql:kafaa_aps_pick', 'sql:kafaa_aps_next_reasons'],
  },
};
export const FSQA6_CARD_DATE = `${QA_F_DAY}T00:00:00Z`;

/** The wave-F engine card rows (same columns as the FS55 cards). */
export function fsqa6Cards(T) {
  const base = T.engine_cards.find((c) => c.id === 'digest');
  if (!base) throw new Error('fsqa6: the FS55 cards are missing');
  let sort = Math.max(...T.engine_cards.filter((c) => !(c.id in FSQA6_CARD_TEXT)).map((c) => c.sort));
  return RANKED_SURFACES.filter((s) => s.wave === 'FSQA6').map((s) => {
    const t = FSQA6_CARD_TEXT[s.card];
    if (!t) throw new Error(`fsqa6: no card text for ${s.card}`);
    return {
      id: s.card, engine_surface: s.stored, module: s.module, route: s.route, feature: s.feature,
      title_en: t.title.en, title_ar: t.title.ar, purpose_en: t.purpose.en, purpose_ar: t.purpose.ar, owner_en: t.owner.en, owner_ar: t.owner.ar,
      inputs_used: t.inputs, inputs_excluded: base.inputs_excluded, scoring_functions: [...s.functions, ...t.sql], weight_keys: [],
      output_en: t.output.en, output_ar: t.output.ar, oversight_en: `${t.oversight.en} ${NO_DECISION.en}`, oversight_ar: `${t.oversight.ar} ${NO_DECISION.ar}`,
      limitations_en: t.limitations.en, limitations_ar: t.limitations.ar, opt_out: false, version: 1, last_changed_at: FSQA6_CARD_DATE, last_change_id: null,
      sources: base.sources, sort: ++sort, ...fs55Columns(s),
    };
  });
}

export default function build() {}

export function finalize(T, ctx) {
  const fail = (m) => { throw new Error(`fsqa6: ${m}`); };
  if (!T.roleplay_sessions || !T.skill_change_measures || !T.engine_cards) return; // partial builds (unit fixtures)
  const today = ctx?.DEMO_TODAY ?? '2026-10-08';
  // A. FS56 measures on the final evidence (after FS59)
  const before = new Map(T.skill_change_measures.map((r) => [r.id, JSON.stringify(r)]));
  T.skill_change_measures = skillChange(skillChangeWorld(T), today).map((r) => ({ ...r, computed_at: `${today}T06:00:00Z`, computed_by: TM }));
  const moved = T.skill_change_measures.filter((r) => before.get(r.id) !== JSON.stringify(r)).length;
  // B. engine cards for the wave-F ranked surfaces
  for (const c of fsqa6Cards(T)) if (!T.engine_cards.some((x) => x.id === c.id)) T.engine_cards.push(c);
  // 1. recorded evidence
  for (const t of WAVE_F_REF_TABLES) if (!RECORDED_REF_TABLES.includes(t)) fail(`${t} is not a recorded evidence table`);
  const validated = T.roleplay_sessions.filter((s) => s.review_status === 'validated');
  for (const s of validated) for (const id of s.evidence_ids ?? []) {
    const e = T.skill_evidence.find((x) => x.id === id);
    if (!e || e.ref_table !== 'roleplay_sessions' || e.kind !== 'rating' || e.basis !== 'validated') fail(`role-play session ${s.id}: evidence ${id} is not validated rating evidence on roleplay_sessions`);
  }
  // 2. one card per ranked surface
  const cards = new Set(T.engine_cards.map((c) => c.id));
  for (const s of RANKED_SURFACES) if (!cards.has(s.card)) fail(`ranked surface ${s.card} has no engine card`);
  if (cards.size !== RANKED_SURFACES.length || T.engine_cards.length !== RANKED_SURFACES.length) fail(`${T.engine_cards.length} engine cards for ${RANKED_SURFACES.length} ranked surfaces`);
  // 3. gap backlog = coverage needs on the final seed
  const versions = (T.role_profile_versions ?? []).map((v) => (v.horizon === 'now' || !(v.requirements ?? []).some((r) => r.kind === 'skill' && FUTURE_SKILL_EQUIVALENT[r.ref_id])
    ? v : { ...v, requirements: remapRequirements(v.requirements) }));
  const gaps = refreshGaps(T, T.pathway_gaps, QA_D_REFRESH);
  const world = { skills: T.skills, competencies: T.competencies, courses: T.courses, course_skill_links: T.course_skill_links ?? [], pathways: T.pathways ?? [], pathway_gaps: gaps,
    external_resources: T.external_resources ?? [], job_roles: T.job_roles, role_profile_versions: versions };
  const missing = backlogToCreate(world, new Set(T.gap_backlog.map((r) => r.id)));
  if (missing.length) fail(`the gap backlog misses ${missing.length} needs (${missing[0].id}): sync it`);
  // 4. role-play reviews owed in the reviewer's digest
  const data = { people: T.people, qual_records: [], qual_standards: [], licences: [], skill_checkins: [], skill_ratings: [], mentoring_requests: [], mentoring_agreements: [], mentoring_sessions: [], opportunities: [], opportunity_applications: [],
    career_conversations: [], refresh_state: [], refresh_prefs: [], enrolments: [], courses: [], person_skills: [], skills: [], role_competencies: [], career_paths: [], career_targets: [], engine_settings: [], reco_optouts: [], roleplay_sessions: T.roleplay_sessions };
  const owed = T.roleplay_sessions.filter((s) => s.review_status === 'requested' && s.requested_at && String(s.requested_at).slice(0, 10) <= today);
  for (const s of owed) if (!gatherDigest(data, s.reviewer_id, today).some((i) => i.id === `approval:roleplay_sessions:${s.id}`)) fail(`reviewer ${s.reviewer_id} misses role-play review ${s.id}`);
  const inDigests = T.digest_runs.filter((r) => (r.items ?? []).some((i) => i.ref_table === 'roleplay_sessions')).length;
  // 5. methodology banner notices
  const notices = Object.fromEntries(['skills_outlook', 'skill_forecasts'].map((k) => [k, methodologyNotices(T.skill_changes ?? [], k, today).length]));
  for (const [k, n] of Object.entries(notices)) if (!n) fail(`no methodology notice for ${k} on ${today}`);
  console.log(`fsqa6: FS56 measures recomputed after the FS59 evidence (${moved} of ${T.skill_change_measures.length} rows moved); ${T.engine_cards.length} engine cards for ${RANKED_SURFACES.length} ranked surfaces `
    + `(+${RANKED_SURFACES.filter((s) => s.wave === 'FSQA6').length} wave F); recorded evidence roleplay_sessions (${validated.length} validated sessions); gap backlog complete (${T.gap_backlog.length} rows); `
    + `${owed.length} role-play reviews owed (${inDigests} seeded digests list one); methodology notices outlook ${notices.skills_outlook}, forecasts ${notices.skill_forecasts}`);
}
