// FS49 · Safety culture for an AI-augmented plant (M08). Pure, import-free rules shared by the pages, the seed builder and the PGlite
// validator (node imports this file directly):
//   huCardProblems(card, refs?)   content rule for every HU tool card = SQL kafaa_fs49_hu_problems (trigger kafaa_fs49_content_guard)
//   lessonProblems(lesson, refs?) content rule for OE lessons (sources rule for topic ai_automation) = SQL kafaa_fs49_lesson_problems
//   matchSituation(id, cards)     deterministic "which HU tool fits this moment?" matcher with reasons (ranks content, never people)
//   liveLinks / fs49Coverage      what a reader can actually open, and the lead console tiles
// No scores, points or badges for people anywhere: safety culture is never gamified.

export type Bi = { en: string; ar: string };
export type Reason = { code: string; key: string; vars?: Record<string, string | number | Bi> };

export const HU_TOPICS = ['classic', 'ai_automation'] as const;
export const LESSON_TOPICS = ['general', 'ai_automation'] as const;

/** Situation cues: the vocabulary shared by HU cards (hu_tools.cues) and situations. SQL keeps the same list (kafaa_fs49_cue_ids). */
export const CUES: Record<string, Bi> = {
  confident: { en: 'the output sounds confident and fluent', ar: 'المخرَج يبدو واثقاً وسلساً' },
  disagree: { en: 'it disagrees with a plant indication or your own reading', ar: 'يخالف مؤشراً في المحطة أو قراءتك أنت' },
  summary: { en: 'a tool summarised a controlled document', ar: 'أداة لخّصت وثيقة خاضعة للرقابة' },
  controlled_source: { en: 'the controlled source is the authority', ar: 'المصدر الخاضع للرقابة هو المرجع' },
  revision: { en: 'a revision, data set or time window may be out of date', ar: 'قد تكون المراجعة أو البيانات أو الفترة الزمنية قديمة' },
  mode: { en: 'the tool or system may be in a different mode than you think', ar: 'قد تكون الأداة أو المنظومة في نمط غير الذي تظنه' },
  alarm: { en: 'automation changed an alarm, display or setpoint view', ar: 'غيّرت الأتمتة إنذاراً أو عرضاً أو قيمة ضبط' },
  autofill: { en: 'a tool pre-filled a checklist, work order or log', ar: 'أداة ملأت مسبقاً قائمة تحقق أو أمر عمل أو سجلاً' },
  routine: { en: 'a routine task where checking feels unnecessary', ar: 'مهمة روتينية يبدو فيها التحقق غير ضروري' },
  time_pressure: { en: 'time pressure', ar: 'ضغط الوقت' },
  handover: { en: 'information passes to another person or shift', ar: 'تنتقل المعلومات إلى شخص آخر أو نوبة أخرى' },
  recommendation: { en: 'a model or digital twin recommends an action', ar: 'نموذج أو توأم رقمي يوصي بإجراء' },
  translation: { en: 'a tool translated text between Arabic and English', ar: 'أداة ترجمت نصاً بين العربية والإنجليزية' },
};
export const CUE_IDS = Object.keys(CUES);

/** Moments where an AI or automated tool is in the loop. Labels live in m08.ai.sit.<id>. */
export const SITUATIONS: { id: string; cues: string[] }[] = [
  { id: 'summary', cues: ['summary', 'controlled_source', 'revision', 'confident'] },
  { id: 'twin', cues: ['recommendation', 'confident', 'disagree'] },
  { id: 'autofill', cues: ['autofill', 'routine', 'controlled_source'] },
  { id: 'mode', cues: ['mode', 'alarm', 'disagree'] },
  { id: 'pressure', cues: ['time_pressure', 'confident', 'routine'] },
  { id: 'handover', cues: ['handover', 'summary', 'autofill'] },
  { id: 'translation', cues: ['translation', 'controlled_source', 'revision'] },
  { id: 'disagree', cues: ['disagree', 'confident', 'recommendation'] },
];

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** Blank = only spaces, tabs or line breaks (SQL: translate(x, E' \t\n\r', '') = ''). */
export const blank = (v: unknown) => str(v).replace(/[ \t\n\r]/g, '') === '';
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const biOk = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Row).en === 'string' && typeof (v as Row).ar === 'string' && !blank((v as Row).en) && !blank((v as Row).ar);

export type HuRefs = { drills: string[]; lessons: string[]; traits: string[] };
export type LessonRefs = { drills: string[] };

/**
 * Problems of an HU tool card, in a fixed order (empty = publishable). Every card, classic or AI-era, must exist in EN and AR, carry
 * its "AI in the loop" angle (classic) or trap + plant example + at least two practice steps (AI-era), use known cues and link at least
 * one FS37 drill or OE lesson. With refs, every linked drill, lesson and trait must exist.
 */
export function huCardProblems(card: Row, refs?: HuRefs | null): string[] {
  const out: string[] = [];
  const ai = card.topic === 'ai_automation';
  if (blank(card.name_en) || blank(card.name_ar)) out.push('name');
  if (blank(card.description_en) || blank(card.description_ar)) out.push('description');
  if (!ai && (blank(card.ai_en) || blank(card.ai_ar))) out.push('ai_angle');
  if (ai && (blank(card.trap_en) || blank(card.trap_ar) || blank(card.example_en) || blank(card.example_ar))) out.push('ai_text');
  const practice = card.practice;
  if (!Array.isArray(practice) || practice.some((s) => !biOk(s)) || (ai && practice.length < 2)) out.push('practice');
  const cues = arr(card.cues);
  if (cues.some((c) => typeof c !== 'string' || !CUE_IDS.includes(c)) || (ai && cues.length === 0)) out.push('cues');
  const drills = arr(card.drill_ids), lessons = arr(card.lesson_ids);
  if (drills.length + lessons.length === 0) out.push('links');
  if (refs) {
    if (drills.some((d) => !refs.drills.includes(String(d)))) out.push('drill_unknown');
    if (lessons.some((l) => !refs.lessons.includes(String(l)))) out.push('lesson_unknown');
    if (arr(card.trait_ids).some((x) => !refs.traits.includes(String(x)))) out.push('trait_unknown');
  }
  return out;
}

/**
 * Problems of an OE lesson. International lessons on automation and digital systems (topic ai_automation) must be complete in EN and AR
 * and cite at least one public source: a label, an https URL, the source year (1990-2100) and an as-of date (YYYY-MM-DD). With refs,
 * linked drills must exist (any topic; HU links are not checked here because HU cards link lessons back). General lessons keep the
 * existing rules unchanged.
 */
export function lessonProblems(lesson: Row, refs?: LessonRefs | null): string[] {
  const out: string[] = [];
  if (lesson.topic === 'ai_automation') {
    if (['title_en', 'title_ar', 'summary_en', 'summary_ar', 'lesson_en', 'lesson_ar'].some((k) => blank(lesson[k]))) out.push('text');
    const src = lesson.sources;
    if (!Array.isArray(src) || src.length === 0) out.push('sources');
    else {
      const objs = src.map((s) => (s && typeof s === 'object' && !Array.isArray(s) ? (s as Row) : {}));
      if (objs.some((s) => typeof s.label !== 'string' || blank(s.label))) out.push('source_label');
      if (objs.some((s) => typeof s.url !== 'string' || !/^https:\/\/[^ \t\n\r]+$/.test(s.url))) out.push('source_url');
      if (objs.some((s) => typeof s.year !== 'number' || !Number.isInteger(s.year) || s.year < 1990 || s.year > 2100)) out.push('source_year');
      if (objs.some((s) => typeof s.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.as_of))) out.push('source_as_of');
    }
  }
  if (refs) {
    if (arr(lesson.drill_ids).some((d) => !refs.drills.includes(String(d)))) out.push('drill_unknown');
  }
  return out;
}

export type MatchCard = { id: string; topic?: string; sort?: number; cues?: string[]; drill_ids?: string[]; lesson_ids?: string[] };
export type Matched<T extends MatchCard = MatchCard> = { id: string; score: number; card: T; cues: string[]; reasons: Reason[] };

/**
 * Which HU tools fit this moment? Score = number of the situation's cues the card names, + 0.5 for an AI-era card (written for exactly
 * this). Ties: card sort, then id. Every result explains itself (one reason per shared cue, plus the AI-era and practice reasons).
 */
export function matchSituation<T extends MatchCard>(situationId: string, cards: T[], max = 3): Matched<T>[] {
  const sit = SITUATIONS.find((s) => s.id === situationId);
  if (!sit) return [];
  const out: Matched<T>[] = [];
  for (const card of cards) {
    const hits = sit.cues.filter((q) => (card.cues ?? []).includes(q));
    if (!hits.length) continue;
    const ai = card.topic === 'ai_automation';
    const reasons: Reason[] = hits.map((h) => ({ code: 'cue', key: 'm08.ai.reason.cue', vars: { cue: CUES[h] } }));
    if (ai) reasons.push({ code: 'ai', key: 'm08.ai.reason.ai' });
    const n = (card.drill_ids ?? []).length;
    if (n) reasons.push({ code: 'practise', key: 'm08.ai.reason.practise', vars: { n } });
    out.push({ id: card.id, score: hits.length + (ai ? 0.5 : 0), card, cues: hits, reasons });
  }
  out.sort((a, b) => b.score - a.score || (a.card.sort ?? 0) - (b.card.sort ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, max);
}

/** Links a reader can open: listed (published) drills and published lessons only, in the card's order. */
export function liveLinks(card: { drill_ids?: string[]; lesson_ids?: string[] }, drills: Row[], lessons: Row[]) {
  const d = new Set(drills.filter((x) => x.listed === true && x.status === 'published').map((x) => String(x.id)));
  const l = new Set(lessons.filter((x) => x.status === 'published').map((x) => String(x.id)));
  return { drills: (card.drill_ids ?? []).filter((x) => d.has(x)), lessons: (card.lesson_ids ?? []).filter((x) => l.has(x)) };
}

/** Lead console tiles: content health only (no people). */
export function fs49Coverage(cards: Row[], lessons: Row[], drills: Row[]) {
  const refs: HuRefs = { drills: drills.map((d) => String(d.id)), lessons: lessons.map((l) => String(l.id)), traits: [] };
  const aiLessons = lessons.filter((l) => l.topic === 'ai_automation');
  const live = cards.filter((c) => { const k = liveLinks(c as never, drills, lessons); return k.drills.length + k.lessons.length > 0; });
  const linkedDrills = new Set(cards.flatMap((c) => liveLinks(c as never, drills, lessons).drills));
  return {
    cards: cards.length,
    aiCards: cards.filter((c) => c.topic === 'ai_automation').length,
    complete: cards.filter((c) => huCardProblems(c, { ...refs, traits: arr(c.trait_ids).map(String) }).length === 0).length,
    liveLinked: live.length,
    drillsLinked: linkedDrills.size,
    aiLessons: aiLessons.length,
    aiLessonsSourced: aiLessons.filter((l) => lessonProblems(l).length === 0).length,
    aiLessonsPublished: aiLessons.filter((l) => l.status === 'published').length,
  };
}
