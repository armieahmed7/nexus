// FS56 + FS57 (future-skills wave F · E4, M25) seed: the skill-change table and the gap-filling backlog.
// finalize() (FINALIZE_LAST; by file name after every f* and fs01-fs49 builder, before the fsqa builders, so it reads the final
// evidence, completions, pathways, gaps and role profiles):
//   - skill_change_measures: skillChange() as of DEMO_TODAY over every course and pathway with completions (F01 evidence history;
//     the completion record itself never counts; matched comparison where at least 10 colleagues form the pool). Nothing is typed in:
//     every number is computed by the rule, cells under 10 are null. No new completion, evidence or person row is added, so every
//     other table is unchanged.
//   - gap_backlog: one row per (skill, level) the catalogue should reach (uncovered FS05 role requirements at their teachable target and
//     open FS17 pathway gaps, coverage.ts backlogToCreate) with its default owner (the skill's FS02 owner function); then six decisions
//     by the training manager (role card) with their rationale in English and Arabic and the score moves predicted by whatIf().
//     The fsqa builders run after this one and change two inputs of the rule: fsqa1 re-points 2030/2035 requirements to FS02 skills
//     and fsqa3/fsqa4 replay the FS17 gap refresh. The backlog is therefore computed on the same final view (fsqa1 remapRequirements
//     and fsqa4 refreshGaps on copies; nothing of theirs is written here), so the seeded rows equal what syncGapBacklog finds on the
//     final seed (checked by the PGlite validator and the unit test).
// Synthetic only; decisions are illustrative planning entries, not ENEC commitments.
import { skillChange, skillChangeWorld } from '../../../src/modules/m25/skillChange.ts';
import { backlogToCreate, coverage, whatIf } from '../../../src/modules/m25/coverage.ts';
import { FUTURE_SKILL_EQUIVALENT } from '../../../src/domain/taxonomy.ts';
import { remapRequirements } from './fsqa1-integration.mjs';
import { QA_D_REFRESH, refreshGaps } from './fsqa4-integration.mjs';

export const FINALIZE_LAST = true;
const TM = 'p-training-mgr';

/** [backlog id, route, owner_role, owner_person_id, due_on, decided_on, plan title|level|hours or null, rationale EN, rationale AR] */
export const DECISIONS = [
  ['gb:sk-da-01:2', 'build', 'digital_ai_governance', 'p-ai-governance', '2027-06-30', '2026-10-06', 'Plant data in daily work (level 2)|2|16',
    'Twenty-four role profiles need data literacy at level 2 and the catalogue stops at level 1. Build one blended course on trend reading, data checks and work-order data, reusing the FS19 plant-data material.',
    'تحتاج أربعة وعشرون ملفاً وظيفياً إلى محو الأمية في البيانات بالمستوى 2 بينما يتوقف الكتالوج عند المستوى 1. نبني دورة مدمجة واحدة عن قراءة الاتجاهات والتحقق من البيانات وبيانات أوامر العمل، مع إعادة استخدام مواد بيانات المحطة في حزمة FS19.'],
  ['gb:sk-ns-01:2', 'partner', 'safety_licensing', null, '2027-03-31', '2026-10-06', 'Defence in depth in practice (co-delivered)|2|24',
    'Eleven profiles need defence in depth at level 2. Co-deliver a practical module with an international partner\'s training centre instead of building from scratch; our instructors shadow the first two runs.',
    'تحتاج أحد عشر ملفاً وظيفياً إلى الدفاع في العمق بالمستوى 2. نقدّم وحدة عملية بالشراكة مع مركز تدريب لشريك دولي بدلاً من البناء من الصفر، ويرافق مدربونا أول دورتين.'],
  ['gb:sk-sc-01:2', 'build', 'human_performance', 'p-training-mgr', '2027-01-31', '2026-10-07', 'Raising concerns: practice clinic|2|8',
    'Ten profiles need a questioning attitude at level 2. A short in-house practice clinic with scenario debriefs fits the safety-culture programme better than any external offer.',
    'تحتاج عشرة ملفات وظيفية إلى موقف التساؤل بالمستوى 2. عيادة تدريب داخلية قصيرة مع جلسات استخلاص للسيناريوهات تناسب برنامج ثقافة السلامة أكثر من أي عرض خارجي.'],
  ['gb:sk-qa-01:2', 'buy', 'quality', 'p-head-sq', '2027-02-28', '2026-10-07', 'NQA-1 requirements, licensed e-learning|2|12',
    'Nine profiles need NQA-1 requirements at level 2. Licensed e-learning already exists on the market; buy seats and add a local assessment rather than writing our own content.',
    'تحتاج تسعة ملفات وظيفية إلى متطلبات NQA-1 بالمستوى 2. يوجد في السوق تعلم إلكتروني مرخّص؛ نشتري مقاعد ونضيف تقييماً محلياً بدلاً من كتابة محتوى خاص بنا.'],
  ['gb:sk-fs-dp-robotics:2', 'partner', 'maintenance', null, '2027-09-30', '2026-10-08', 'Remote inspection with robots: supervised practice|2|20',
    'Two 2030 profiles and three open pathway steps need robotics at level 2. Partner with an equipment supplier for supervised practice on their demonstration rigs.',
    'يحتاج ملفان وظيفيان لعام 2030 وثلاث خطوات مفتوحة في المسارات إلى الروبوتات بالمستوى 2. نتشارك مع مورّد معدات لممارسة تحت الإشراف على منصات العرض لديه.'],
  ['gb:sk-fs-gr-climaterisk:2', 'buy', 'sustainability', 'p-head-sustainability', '2027-04-30', '2026-10-08', null,
    'Three open pathway steps need climate-risk content at level 2. Curate an outcome-gated external course for the FS18 catalogue instead of building one.',
    'تحتاج ثلاث خطوات مفتوحة في المسارات إلى محتوى مخاطر المناخ بالمستوى 2. ننتقي دورة خارجية مشروطة بالنتائج لكتالوج FS18 بدلاً من بناء دورة.'],
];

export default function build() {}

export function finalize(T, ctx) {
  const today = ctx.DEMO_TODAY;
  // FS56
  const rows = skillChange(skillChangeWorld(T), today);
  T.skill_change_measures = rows.map((r) => ({ ...r, computed_at: `${today}T06:00:00Z`, computed_by: TM }));
  // FS57
  const versions = (T.role_profile_versions ?? []).map((v) => (v.horizon === 'now' || !(v.requirements ?? []).some((r) => r.kind === 'skill' && FUTURE_SKILL_EQUIVALENT[r.ref_id])
    ? v : { ...v, requirements: remapRequirements(v.requirements) }));
  const gaps = T.pathways && T.pathway_gaps ? refreshGaps(T, T.pathway_gaps, QA_D_REFRESH) : [];
  const world = {
    skills: T.skills, competencies: T.competencies, courses: T.courses, course_skill_links: T.course_skill_links ?? [], pathways: T.pathways ?? [], pathway_gaps: gaps,
    external_resources: T.external_resources ?? [], job_roles: T.job_roles, role_profile_versions: versions,
  };
  const add = backlogToCreate(world, new Set());
  const backlog = add.map((r) => ({
    ...r, owner_person_id: null, due_on: null, route: null, rationale: '', rationale_ar: null, plan: null, predicted: [], status: 'open', first_seen: today,
    created_by: TM, decided_by: null, decided_at: null, history: [], updated_at: `${today}T06:00:00Z`,
  }));
  const roles = coverage(world).roles;
  for (const [id, route, owner, person, due, on, plan, en, ar] of DECISIONS) {
    const row = backlog.find((r) => r.id === id);
    if (!row) throw new Error(`fs56: seeded decision ${id} has no backlog need`);
    const p = plan ? (() => { const [title, level, hours] = plan.split('|'); return { title, level: Number(level), hours: Number(hours) }; })() : null;
    const at = `${on}T09:00:00Z`;
    Object.assign(row, {
      owner_role: owner, owner_person_id: person, due_on: due, route, rationale: en, rationale_ar: ar, plan: p, predicted: whatIf(roles, row.skill_id, p ? p.level : row.level),
      status: 'decided', decided_by: TM, decided_at: at, updated_at: at, history: [{ at, by: TM, route, due_on: due, owner_role: owner }],
    });
  }
  T.gap_backlog = backlog;
  const decided = backlog.filter((r) => r.status === 'decided');
  console.log(`fs56/57: ${rows.length} learning items measured as of ${today} (${rows.filter((r) => r.measured !== null).length} with 10+ measured, ${rows.filter((r) => r.verdict === 'moves').length} move skills); backlog ${backlog.length} rows, ${decided.length} decisions`);
}
