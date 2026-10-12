/**
 * FS76 Dalil future-skills mode: the four new intents, their detection words and their catalogue rows. Import-free (the seed builder
 * scripts/seed/ext/fs76-dalil-future.mjs and the PGlite validator scripts/validate/fs84-dalil-future.mjs load it directly).
 *
 *   future.role_2030       "How will my role change by 2030?"           FS11 role transformation map (+ my time-to-ready), FS05 profiles
 *   future.ai_rung         "Which AI rung do I need?"                   FS09 AI fluency ladder: my rung from evidence vs my family's target
 *   future.skill_crosswalk "What does X mean / what is its ESCO code?"  FS07 skill page + FS08 published crosswalk rows (codes, match type)
 *   future.pathway_gap     "Which pathway closes my gap?"               FS17 pathways ranked against my 2030 gaps (the Coach's rankPathways)
 *
 * Each intent is a row of kafaa_dalil_intents (public catalogue; the AI owner can switch one off with rpc.setDalilIntent, audited and
 * ledgered). Answers carry a suffix: `.personal` (from the signed-in person's own records), `.public` (public content only, the only
 * kind an anonymous visitor ever gets), or a named variant (`.path_only`, `.general`, `.sign_in`, `.off`). intentBase() strips it, the
 * same as SQL kafaa_dl_intent_base().
 */

export type FutureKind = 'role_2030' | 'ai_rung' | 'skill_crosswalk' | 'pathway_gap';
export const FUTURE_KINDS: FutureKind[] = ['role_2030', 'ai_rung', 'skill_crosswalk', 'pathway_gap'];
export type FutureAudience = 'both' | 'public' | 'personal';
export interface FutureSource { label: string; url: string; as_of: string }
export interface FutureIntentDef {
  id: string;
  kind: FutureKind;
  audience: FutureAudience;
  title_en: string; title_ar: string;
  summary_en: string; summary_ar: string;
  examples_en: string[]; examples_ar: string[];
  /** Internal routes (or route patterns) the answers cite. */
  cites: string[];
  sources: FutureSource[];
  benchmark_ids: string[];
  /** The feature whose rules the answer calls. */
  feature: string;
  sort: number;
}

const AS_OF = '2026-10-10';
const SG = { label: 'SkillsFuture Singapore · Careers and Skills Passport', url: 'https://www.myskillsfuture.gov.sg/csp', as_of: AS_OF };
const AILIT = { label: 'European Commission · Living repository of AI-literacy practices (EU AI Act Article 4)', url: 'https://digital-strategy.ec.europa.eu/en/policies/repository-ai-literacy-practices', as_of: AS_OF };
const JTM = { label: 'Workforce Singapore · Jobs Transformation Maps', url: 'https://wsg.gov.sg/for-employers/jobs-transformation-maps.html', as_of: AS_OF };
const ESCO = { label: 'ESCO v1.2.1 skills pillar (European Commission)', url: 'https://esco.ec.europa.eu/en/classification/skill_main', as_of: AS_OF };

export const FUTURE_INTENTS: FutureIntentDef[] = [
  {
    id: 'future.role_2030', kind: 'role_2030', audience: 'both', feature: 'FS11', sort: 1,
    title_en: 'How my role changes by 2030', title_ar: 'كيف يتغير دوري بحلول 2030',
    summary_en: 'The role transformation map: the technology drivers, which tasks grow with people, become AI-assisted or shrink, what the 2030 profile adds and, for you, your time-to-ready. A planning assumption, no deployment decision implied.',
    summary_ar: 'خريطة تحول الدور: محركات التقنية، والمهام التي تنمو مع الناس أو تصبح مدعومة بالذكاء الاصطناعي أو تتقلص، وما يضيفه ملف 2030، ووقتك المقدّر للجاهزية. افتراض تخطيطي ولا يعني أي قرار نشر.',
    examples_en: ['How will my role change by 2030?', 'How will the senior reactor operator role change by 2030?'],
    examples_ar: ['كيف سيتغير دوري بحلول 2030؟', 'كيف سيتغير دور مشغل المفاعل الأول بحلول 2030؟'],
    cites: ['/my/role-2030', '/careers/roles/:slug/transformation', '/careers/roles/:slug'], sources: [JTM, SG], benchmark_ids: ['SG-CAREER'],
  },
  {
    id: 'future.ai_rung', kind: 'ai_rung', audience: 'both', feature: 'FS09', sort: 2,
    title_en: 'Which AI rung I need', title_ar: 'درجة الذكاء الاصطناعي التي أحتاجها',
    summary_en: 'The AI fluency ladder target for a job family, and for you the rung your evidence shows and the cells still missing, each with the learning that evidences it. Self-ratings never move the rung.',
    summary_ar: 'هدف سلم الطلاقة في الذكاء الاصطناعي لكل عائلة وظيفية، ولك الدرجة التي تُظهرها أدلتك والخلايا الناقصة مع التعلم الذي يثبتها. التقييم الذاتي لا يرفع الدرجة أبداً.',
    examples_en: ['Which AI rung do I need?', 'What AI fluency does a reactor operator need?'],
    examples_ar: ['ما درجة الذكاء الاصطناعي التي أحتاجها؟', 'ما مستوى الطلاقة في الذكاء الاصطناعي الذي يحتاجه مشغل المفاعل؟'],
    cites: ['/learn/ai-fluency', '/my/ai-fluency'], sources: [AILIT], benchmark_ids: ['AI-LIT'],
  },
  {
    id: 'future.skill_crosswalk', kind: 'skill_crosswalk', audience: 'public', feature: 'FS08', sort: 3,
    title_en: 'What a skill means and its crosswalk', title_ar: 'معنى المهارة ومقابلها في الأطر الدولية',
    summary_en: 'The skill page in plain words and its published crosswalk to ESCO, O*NET, SFIA, DigComp and the other frameworks, with the match type, the review state and the source. Label-level rows say "code pending review".',
    summary_ar: 'صفحة المهارة بلغة واضحة ومقابلها المنشور في ESCO وO*NET وSFIA وDigComp وغيرها، مع نوع المطابقة وحالة المراجعة والمصدر. الصفوف على مستوى التسمية تقول "الرمز قيد المراجعة".',
    examples_en: ['What is the ESCO equivalent of digital twin validation?', 'What does AI output verification and challenge mean?'],
    examples_ar: ['ما المقابل في ESCO لمهارة التحقق من التوأم الرقمي؟', 'ما معنى مهارة التحقق من مخرجات الذكاء الاصطناعي ومساءلتها؟'],
    cites: ['/skills/:id', '/skills/frameworks'], sources: [ESCO, SG], benchmark_ids: ['SG-CAREER'],
  },
  {
    id: 'future.pathway_gap', kind: 'pathway_gap', audience: 'personal', feature: 'FS17', sort: 4,
    title_en: 'Which pathway closes my gap', title_ar: 'أي مسار تعلم يسد فجوتي',
    summary_en: 'The future-skill learning pathways that close your 2030 gaps first, ranked the same way as the Learning Coach, each with why it was picked. Anonymous visitors are pointed to the public skills catalogue.',
    summary_ar: 'مسارات تعلم مهارات المستقبل التي تسد فجوات 2030 لديك أولاً، مرتبة بالطريقة نفسها التي يرتبها بها مدرب التعلم، مع سبب اختيار كل منها. يُوجَّه الزوار غير المسجلين إلى دليل المهارات العام.',
    examples_en: ['Which pathway closes my gap?', 'Which learning pathway closes my gap in AI output verification?'],
    examples_ar: ['أي مسار تعلم يسد فجوتي؟', 'أي مسار تعلم يسد فجوتي في التحقق من مخرجات الذكاء الاصطناعي؟'],
    cites: ['/learn/pathways/:id', '/my/pathways', '/my/coach'], sources: [SG, AILIT], benchmark_ids: ['SG-CAREER', 'AI-LIT'],
  },
];

/** 'future.role_2030.personal' -> 'future.role_2030'; anything that is not a future intent -> null. Same as SQL kafaa_dl_intent_base. */
export function intentBase(intent: string | null | undefined): string | null {
  const m = /^(future\.[a-z0-9_]+)/.exec(String(intent ?? ''));
  return m ? m[1] : null;
}
/** True when the intent id names an answer built from the signed-in person's own records. */
export const isPersonalIntent = (intent: string | null | undefined) => /^future\.[a-z0-9_]+\.personal$/.test(String(intent ?? ''));

/** Detection words (matched on normalised text, word-prefix). Frameworks first: a framework name always means a crosswalk question. */
export const FW_WORDS = ['esco', 'o*net', 'onet', 'o net', 'sfia', 'digcomp', 'greencomp', 'skillsfuture', 'lightcast', 'nice framework', 'crosswalk', 'cross-walk', 'equivalent', 'framework code', 'international code', 'mapped to', 'maps to',
  'إسكو', 'اسكو', 'المقابل', 'مقابل', 'يعادل', 'المعادل', 'مكافئ', 'الأطر الدولية', 'إطار دولي'];
export const MEANING_WORDS = ['mean', 'means', 'meaning', 'definition', 'define', 'stands for', 'what is the skill', 'explain the skill', 'ما معنى', 'معنى', 'تعريف', 'ماذا تعني', 'ما المقصود'];
export const RUNG_WORDS = ['ai rung', 'rung', 'ai fluency', 'fluency ladder', 'ai ladder', 'ai literacy', 'ai level', 'level of ai', 'ai skills do i need', 'ai skill do i need', 'how fluent in ai',
  'درجة الذكاء', 'سلم الطلاقة', 'الطلاقة في الذكاء', 'مستوى الطلاقة', 'محو الأمية في الذكاء', 'مستوى الذكاء الاصطناعي', 'درجة في الذكاء'];
export const PATHWAY_WORDS = ['pathway', 'pathways', 'learning path', 'مسار تعلم', 'مسار التعلم', 'مسارات التعلم', 'مسار يسد', 'مسارات تعلم'];
export const GAP_CLOSE_WORDS = ['close my gap', 'closes my gap', 'close my gaps', 'close the gap', 'closes the gap', 'fill my gap', 'fills my gap', 'يسد فجوتي', 'يسد الفجوة', 'سد فجوتي', 'سد الفجوة', 'تسد فجوتي'];
/** Course words: "which courses close my gaps" stays a career-mode courses question (F07). */
export const COURSE_WORDS = ['course', 'courses', 'training', 'دورة', 'دورات', 'الدورات', 'تدريب'];
export const YEAR_WORDS = ['2030', '2035', '٢٠٣٠', '٢٠٣٥'];
export const CHANGE_WORDS = ['change', 'changing', 'changes', 'transform', 'evolve', 'evolving', 'look like', 'future of my', 'future of the', 'role in', 'job in',
  'يتغير', 'سيتغير', 'تتغير', 'ستتغير', 'تغير', 'تحول', 'مستقبل', 'سيبدو'];
export const ROLE_WORDS = ['role', 'job', 'work', 'position', 'دور', 'دوري', 'وظيفة', 'وظيفتي', 'عملي', 'مهنتي'];

/** Release gate r1.1 (seeded eval_runs row eval-2026-10-fs76) = public F14 set + F37 career set + FS76 future set, as a fresh run on the seed gives
 *  them; tests/unit/fs84-dalil-future.test.ts re-runs the three sets and fails if these numbers drift. */
export const FS76_EVAL = {
  public: { in_scope_total: 27, cited_correct: 27, refusal_total: 22, refusal_correct: 22, security_total: 11, security_correct: 11 },
  career: { in_scope_total: 16, cited_correct: 16, refusal_total: 7, refusal_correct: 7, security_total: 3, security_correct: 3 },
  future: { in_scope_total: 25, cited_correct: 25, refusal_total: 9, refusal_correct: 9, security_total: 5, security_correct: 5, public_total: 11, public_clean: 11 },
};
