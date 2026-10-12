// FS75 (wave H · E3, fsHe3) Future-skills nudges in the weekly digest: the published method rows (kafaa_digest_nudge_rules), one per
// topic, read by the digest panel, the nudge settings and the admin digest page. The windows below are the constants of
// src/shell/digest/future.ts (tests/unit/fs83-digest-nudges.test.ts pins them equal). The nudges themselves are computed, never seeded:
// they apply from FS75_FROM (2026-10-12, ISO week 2026-W42), so the seeded digests (2026-W38..W41, built by f36-digest.mjs's
// FINALIZE_LAST step on or before 2026-10-08) stay exactly as they were and no seeded digest is rewritten.
// No rows go into other modules' tables: FS33 goals are also an FS70 signal in this wave, so the demo uses the goals already seeded.
import { FS75_FROM, LAPSE_AHEAD_DAYS, GOAL_AHEAD_DAYS, PROFILE_NEW_DAYS, GIG_NEW_DAYS, PATHWAY_NEW_DAYS } from '../../../src/shell/digest/future.ts';

const BM = ['SG-CAREER', 'CORP'];
const R = (sort, topic, kind, window_days, link, source_feature, name_en, name_ar, rule_en, rule_ar) => ({
  id: `dnr-${topic}`, topic, kind, name_en, name_ar, rule_en, rule_ar, window_days, link, source_feature, benchmark_ids: BM, since: FS75_FROM, sort,
});

export default function build(T) {
  T.digest_nudge_rules = [
    R(1, 'decay', 'future', LAPSE_AHEAD_DAYS, '/my/skills/confidence', 'FS03', 'A fast-changing skill may slip a level', 'مهارة سريعة التغيّر قد ينخفض مستواها',
      `A skill in the fast decay class that you hold at level 2 or above, whose newest evidence at that level passes its half-life within ${LAPSE_AHEAD_DAYS} days. After that date the skill counts one level lower until new evidence arrives.`,
      `مهارة من فئة التقادم السريع تحملها بالمستوى 2 أو أعلى، ويتجاوز أحدث دليل عليها بهذا المستوى نصف عمره خلال ${LAPSE_AHEAD_DAYS} يوماً. بعد ذلك التاريخ تُحتسب المهارة بمستوى أدنى حتى يصل دليل جديد.`),
    R(2, 'goal', 'future', GOAL_AHEAD_DAYS, '/my/skills/goals', 'FS33', 'A skill goal is due', 'موعد هدف مهاري يقترب',
      `One of your skill goals reaches its target date within ${GOAL_AHEAD_DAYS} days (or passed it in the last 30) while your level is still below the target; a goal without a date asks you to give it one.`,
      `يصل أحد أهدافك المهارية إلى موعده خلال ${GOAL_AHEAD_DAYS} يوماً (أو تجاوزه خلال آخر 30 يوماً) بينما لا يزال مستواك دون الهدف؛ والهدف الذي لا موعد له يطلب منك تحديد موعد.`),
    R(3, 'ai_literacy', 'future', null, '/my/ai-fluency', 'FS36', 'An AI system you use needs a higher AI fluency rung', 'نظام ذكاء اصطناعي تستخدمه يتطلب مستوى أعلى من الطلاقة',
      'A published AI system in the AI-literacy register has a user group that covers all staff or your job family and needs an AI fluency rung (or a single skill cell) you have not yet evidenced.',
      'لنظام ذكاء اصطناعي منشور في سجل الإلمام بالذكاء الاصطناعي مجموعة مستخدمين تشمل جميع الموظفين أو عائلتك الوظيفية، وتتطلب مستوى من سلّم الطلاقة (أو خلية مهارة) لم تثبته بعد.'),
    R(4, 'role_profile', 'future', PROFILE_NEW_DAYS, '/my/role-2030', 'FS05', 'Your role\'s 2030 profile was published or changed', 'نُشر ملف دورك لعام 2030 أو تغيّر',
      `The 2030 profile of your current role was published, or a new version replaced it, in the last ${PROFILE_NEW_DAYS} days. It is a planning assumption: no deployment decision is implied.`,
      `نُشر ملف دورك الحالي لعام 2030، أو حلّت محله نسخة جديدة، خلال آخر ${PROFILE_NEW_DAYS} يوماً. إنه افتراض تخطيطي، دون أي قرار نشر ضمني.`),
    R(5, 'rising_skill', 'future', null, '/skills', 'FS70', 'A skill is rising in your area', 'مهارة صاعدة في مجالك',
      'A skill the latest quarterly Skills on the Rise list marks as growing for your job family (or, when the list names no family, one your role\'s 2030 profile or one of your goals asks for), that you hold below level 2. Read from the published list only: signals under 10 are suppressed there.',
      'مهارة تصنّفها أحدث قائمة فصلية للمهارات الصاعدة بأنها في نمو لعائلتك الوظيفية (أو، إن لم تسمِّ القائمة عائلة، يطلبها ملف دورك لعام 2030 أو أحد أهدافك)، وتحملها بمستوى أقل من 2. تُقرأ من القائمة المنشورة فقط، حيث تُحجب الإشارات التي تقل عن 10.'),
    R(6, 'future_gig', 'future', GIG_NEW_DAYS, '/opportunities/future', 'FS27', 'A new future-skills gig builds one of your skills', 'مهمة جديدة للمهارات المستقبلية تبني إحدى مهاراتك',
      `An open future-skills gig posted in the last ${GIG_NEW_DAYS} days, open to your job family, with a seat left, that builds a skill from your goals or your role's 2030 profile. Not shown when the gig is already in your digest as a match, or when you opted out of marketplace ranking.`,
      `مهمة مفتوحة للمهارات المستقبلية نُشرت خلال آخر ${GIG_NEW_DAYS} يوماً، متاحة لعائلتك الوظيفية وفيها مقعد شاغر، وتبني مهارة من أهدافك أو من ملف دورك لعام 2030. لا تظهر إذا كانت ضمن ملخصك كفرصة مطابقة، أو إذا اخترت عدم ترتيب السوق.`),
    R(7, 'pathway', 'future', PATHWAY_NEW_DAYS, '/learn/pathways', 'FS17', 'A new learning pathway fits your next level', 'مسار تعلّم جديد يناسب مستواك التالي',
      `A future-skill learning pathway published or updated in the last ${PATHWAY_NEW_DAYS} days that takes one of your future skills exactly one level up (never past the target), which you have not started.`,
      `مسار تعلّم للمهارات المستقبلية نُشر أو حُدّث خلال آخر ${PATHWAY_NEW_DAYS} يوماً، يرفع إحدى مهاراتك المستقبلية مستوى واحداً بالضبط (ولا يتجاوز الهدف)، ولم تبدأه بعد.`),
    R(8, 'fellowship', 'approval', null, '/universities/fellowships', 'FS67', 'A fellowship milestone waits for your sign-off', 'مرحلة زمالة بانتظار اعتمادك',
      'A fellow or their university submitted a fellowship milestone that names you as the supervisor; it waits for your sign-off or a return note.',
      'قدّم زميل باحث أو جامعته مرحلة من مراحل الزمالة تسمّيك مشرفاً؛ وهي بانتظار اعتمادك أو ملاحظة إعادة.'),
  ];
}
