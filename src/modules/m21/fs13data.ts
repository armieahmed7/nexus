/**
 * FS13 / FS14 shared constants (import-free: the seed builder, the PGlite validator and the tests load them).
 * The migration supabase/migrations/20261010224001_kafaa_fs24_future_readiness.sql writes the same rows live; the validator
 * proves the two agree.
 */

/**
 * Keyspace rows FS13 adds to the FS04 map (kafaa_future_skill_map): the new-capability skill for ADVANCE skills that had only
 * today's skills on them, so every ADVANCE skill can reach full credit through evidence. [key, sk_id, relation, need, note_en, note_ar]
 */
export const FS13_KEYSPACE_ROWS: [string, string, 'new', number, string, string][] = [
  ['as-bwr-systems', 'sk-fs-adv-smr', 'new', 2, 'SMR fundamentals: the boiling-water SMR systems themselves (FS02).', 'أساسيات المفاعلات الصغيرة: أنظمة مفاعل الماء المغلي الصغير نفسها (من الكتالوج).'],
  ['as-bwr-chemistry', 'sk-fs-adv-smr', 'new', 2, 'SMR fundamentals include the boiling-water chemistry regime (FS02).', 'تشمل أساسيات المفاعلات الصغيرة نظام كيمياء الماء المغلي (من الكتالوج).'],
  ['as-owners-engineer', 'sk-fs-adv-factoryqa', 'new', 2, 'Factory fabrication QA: overseeing modules built in a vendor factory (FS02).', 'ضمان جودة التصنيع في المصنع: الإشراف على الوحدات المصنّعة لدى المورّد (من الكتالوج).'],
  ['as-project-abroad', 'sk-fs-tr-crosscultural', 'new', 2, 'Collaboration across cultures: delivering projects with partners abroad (FS02).', 'التعاون بين الثقافات: تنفيذ المشاريع مع الشركاء في الخارج (من الكتالوج).'],
  ['as-process-heat', 'sk-fs-gr-h2heat', 'new', 2, 'Hydrogen and process-heat interfaces (FS02).', 'واجهات الهيدروجين وحرارة العمليات (من الكتالوج).'],
  ['as-remote-ops', 'sk-fs-adv-multimodule', 'new', 1, 'Multi-module operations concepts (FS02).', 'مفاهيم تشغيل الوحدات المتعددة (من الكتالوج).'],
];

/** The Future Me engine card after FS13 (F24 card "future", version 2). */
export const FS13_CARD = {
  version: 2,
  last_changed_at: '2026-10-10T00:00:00Z',
  purpose_en: 'Estimates my readiness for ADVANCE-era technologies from what carries over, the new skills I hold and the learning I have recorded, and ranks the bridges, learning and roles that would help most.',
  purpose_ar: 'يقدّر جاهزيتي لتقنيات عصر ADVANCE مما ينتقل من مهاراتي الحالية والمهارات الجديدة التي أمتلكها والتعلّم الذي سجّلته، ويرتّب الجسور والتعلّم والأدوار الأكثر فائدة.',
  inputs_used: [
    { key: 'person_skills', en: 'My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)', ar: 'مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)' },
    { key: 'future_skill_map', en: 'The future-skill keyspace (FS04): which of today\'s skills carry over to each ADVANCE skill and which new skills count directly', ar: 'خريطة المهارات المستقبلية (FS04): أي مهارات اليوم تنتقل إلى كل مهارة من مهارات ADVANCE وأي المهارات الجديدة تُحتسب مباشرة' },
    { key: 'learning', en: 'Learning I have completed: catalogue courses (level 1-2) and ADVANCE learning tracks (level 1)', ar: 'التعلّم الذي أكملته: دورات الكتالوج (المستوى 1-2) ومسارات تعلّم ADVANCE (المستوى 1)' },
    { key: 'adv_skills', en: 'ADVANCE-era skills and bridges from today\'s skills (public sources)', ar: 'مهارات عصر ADVANCE والجسور من مهارات اليوم (مصادر عامة)' },
    { key: 'career_paths', en: 'Published career paths and entry routes, with their conditions (FANR-REG-17 for licensed roles)', ar: 'المسارات المهنية المنشورة وطرق الالتحاق وشروطها (FANR-REG-17 للأدوار المرخّصة)' },
  ],
  scoring_functions: [
    'src/modules/m21/readiness.ts#readinessV2',
    'src/modules/m21/readiness.ts#previewEvidence',
    'src/modules/m21/future.ts#rankBridges',
    'src/modules/m21/future.ts#rankFutureRoles',
    'src/modules/m21/future.ts#rankResources',
    'sql:kafaa_fm_readiness_of',
  ],
  limitations_en: 'Readiness rule v2 (FS13): learning raises the index, and 100 is reachable through recorded evidence alone. The index is SIMULATED and is not a qualification. Future roles are concepts from public sources, with no headcount or sites.',
  limitations_ar: 'قاعدة الجاهزية الإصدار 2 (FS13): يرفع التعلّم المؤشر، ويمكن بلوغ 100 من خلال الأدلة المسجّلة وحدها. المؤشر محاكاة وليس مؤهلاً. الأدوار المستقبلية مفاهيم من مصادر عامة، دون أعداد موظفين أو مواقع.',
};
