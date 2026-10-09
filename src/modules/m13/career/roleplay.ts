/**
 * F37 role-play practice (deterministic, no model): scripted interview and career-conversation dialogues built from templates and
 * the person's target role, with a rubric checklist per answer. Inspired by AI role-play coaching, but rule-based: each criterion
 * is a keyword or structure check in English and Arabic, and every result says which words or structure it looked for.
 * The practice answer never leaves the browser; only "practised, N of M criteria" is logged through rpc.dalilCareerTurn.
 */
import { normText, hasAny } from '../dalil/text';

export type Scenario = 'interview' | 'career_conversation';
export interface Criterion { id: string; pass: boolean }
export interface PromptDef { id: string; criteria: string[]; vars?: Record<string, string> }
export interface Script { scenario: Scenario; prompts: PromptDef[] }

const W = {
  situation: ['when ', 'during', 'situation', 'once', 'last year', 'last month', 'on shift', 'in 20', 'عندما', 'أثناء', 'خلال', 'في إحدى', 'الموقف'],
  task: ['my task', 'my role', 'i was responsible', 'responsible for', 'i had to', 'i needed to', 'the goal', 'مهمتي', 'دوري', 'كنت مسؤولا', 'كان علي'],
  action: ['i did', 'i used', 'i checked', 'i stopped', 'i asked', 'i led', 'i decided', 'i verified', 'i raised', 'i applied', 'i followed', 'i briefed', 'قمت', 'استخدمت', 'تحققت', 'أوقفت', 'سألت', 'قدت', 'قررت'],
  result: ['result', 'outcome', 'as a result', 'so that', 'which meant', 'learned', 'learnt', 'improved', 'reduced', 'prevented', 'النتيجة', 'نتيجة', 'تعلمت', 'تحسن', 'منع', 'خفض'],
  questioning: ['stop', 'stopped', 'question', 'paused', 'raised', 'peer check', 'self-check', 'star', 'time out', 'escalat', 'supervisor', 'when in doubt', 'أوقفت', 'توقفت', 'تساءلت', 'رفعت', 'التحقق الذاتي', 'المشرف'],
  procedure: ['procedure', 'place-keeping', 'placekeeping', 'read back', 'three-way', '3-way', 'verify', 'step by step', 'sign off', 'الإجراء', 'خطوة بخطوة', 'التواصل الثلاثي', 'تحقق'],
  plan: ['course', 'mentor', 'practice', 'practise', 'simulator', 'shadow', 'rotation', 'study', 'read', 'دورة', 'مرشد', 'تدريب', 'المحاكي', 'تناوب', 'أدرس'],
  support: ['course', 'mentor', 'mentoring', 'rotation', 'shadow', 'time', 'coaching', 'feedback', 'project', 'دورة', 'إرشاد', 'تناوب', 'وقت', 'تدريب', 'مشروع', 'ملاحظات'],
  evidence: ['qualif', 'certif', 'course', 'assessment', 'feedback', 'project', 'jpm', 'licen', 'evaluat', 'مؤهل', 'شهادة', 'دورة', 'تقييم', 'مشروع', 'ترخيص'],
  motivation: ['because', 'interest', 'motivat', 'goal', 'want to', 'passion', 'grow', 'لأن', 'أرغب', 'هدفي', 'شغف', 'أطمح'],
  horizon: ['year', 'years', 'month', 'months', '202', 'سنة', 'سنوات', 'شهر', 'أشهر'],
  risk: ['shift', 'workload', 'time', 'outage', 'family', 'travel', 'exam', 'وردية', 'ضغط', 'وقت', 'الصيانة', 'الاختبار'],
};

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const has = (t: string, k: keyof typeof W) => !!hasAny(normText(t), W[k]);
export interface RubricCtx { roleWords?: string[]; gapWords?: string[] }
const mentions = (t: string, ws: string[] | undefined) => (ws ?? []).some((w) => w && normText(t).includes(` ${normText(w).trim()}`));
/** Distinctive words of a title or name (EN 4+ letters, AR 3+), lower-cased, for "names the role / the gap" checks. */
export const keyWords = (...names: (string | null | undefined)[]) =>
  [...new Set(names.flatMap((n) => String(n ?? '').split(/[^\p{L}\p{N}]+/u)).filter((w) => (/[\u0600-\u06FF]/.test(w) ? w.length >= 3 : w.length >= 4)).map((w) => w.toLowerCase()))]
    .filter((w) => !['with', 'and', 'incl', 'including', 'unit', 'from', 'that', 'this'].includes(w));
const CHECKS: Record<string, (t: string, ctx: RubricCtx) => boolean> = {
  length: (t) => words(t) >= 25 && words(t) <= 250,
  first_person: (t) => /\b(i|my|me)\b/i.test(t) || /(قمت|كنت|أنا|لدي|دوري|مهمتي|أرغب|هدفي)/.test(t),
  specific: (t) => /\d/.test(t) || has(t, 'situation'),
  situation: (t) => has(t, 'situation'),
  task: (t) => has(t, 'task'),
  action: (t) => has(t, 'action'),
  result: (t) => has(t, 'result'),
  questioning: (t) => has(t, 'questioning'),
  procedure: (t) => has(t, 'procedure'),
  plan: (t) => has(t, 'plan'),
  support: (t) => has(t, 'support'),
  evidence: (t) => has(t, 'evidence'),
  motivation: (t) => has(t, 'motivation'),
  horizon: (t) => has(t, 'horizon'),
  risk: (t) => has(t, 'risk'),
  names_role: (t, c) => mentions(t, c.roleWords),
  names_gap: (t, c) => mentions(t, c.gapWords),
};

export function script(scenario: Scenario, ctx: { competency?: string | null } = {}): Script {
  if (scenario === 'interview') {
    return { scenario, prompts: [
      { id: 'why_role', criteria: ['motivation', 'names_role', 'first_person', 'length'] },
      { id: 'star', criteria: ['situation', 'task', 'action', 'result', 'specific'], vars: { competency: ctx.competency ?? '' } },
      { id: 'questioning', criteria: ['questioning', 'action', 'result', 'first_person'] },
      { id: 'procedure', criteria: ['procedure', 'action', 'specific'] },
      { id: 'gap_plan', criteria: ['names_gap', 'plan', 'horizon'] },
    ] };
  }
  return { scenario, prompts: [
    { id: 'goal_12m', criteria: ['first_person', 'specific', 'horizon'] },
    { id: 'goal_3y', criteria: ['names_role', 'motivation', 'horizon'] },
    { id: 'strengths', criteria: ['evidence', 'first_person', 'specific'] },
    { id: 'support', criteria: ['support', 'specific'] },
    { id: 'risks', criteria: ['risk', 'plan'] },
  ] };
}

/** Score one practice answer against the prompt's rubric. Deterministic: same text, same ticks. */
export function evaluate(p: PromptDef, text: string, ctx: RubricCtx): Criterion[] {
  return p.criteria.map((id) => ({ id, pass: CHECKS[id](text, ctx) }));
}
export const summary = (all: Criterion[][]) => ({ passed: all.flat().filter((c) => c.pass).length, total: all.flat().length });
