/**
 * F07 "Ask the coach": retrieval Q&A over the course catalogue, practice quiz titles, training paths, programmes and the FAQ,
 * using the F02 SearchEngine (BM25) and answer templates. No model, no free text generation: the answer is a template
 * plus cited catalogue entries. The corpus is built only from catalogue rows; assessment items (secure or practice) are
 * never indexed, so no item text can appear in an answer.
 */
import { SearchIndex, type SearchDoc } from '../../domain/search';
import { tokenize } from '../../domain/text';
import type { BiText } from '../../domain/engines/types';
import type { CompLite, CourseLite, FormLite, RoleCompLite, RoleLite } from './coach';

export type AskKind = 'course' | 'practice' | 'path' | 'programme' | 'faq';
export interface AskDoc extends SearchDoc {
  kind: AskKind;
  route: string;
  competency_ids: string[];
  meta?: BiText;
}
export interface PathLite { id: string; title: BiText; summary: BiText; stages: { id: string; title: BiText; content: BiText; length?: BiText; courses?: string[] }[]; careerOnly?: boolean }
export interface ProgrammeLite { id: string; code: string; name_en: string; name_ar: string; purpose_en: string; purpose_ar: string; duration_en?: string; duration_ar?: string }
export interface FaqLite { id: string; q_en: string; q_ar: string; a_en: string; a_ar: string }
export interface ModuleLite { course_id: string; title_en: string; title_ar: string }

export function buildAskCorpus(src: { courses: CourseLite[]; modules?: ModuleLite[]; competencies: CompLite[]; forms?: FormLite[]; paths?: PathLite[]; programmes?: ProgrammeLite[]; faqs?: FaqLite[] }): AskDoc[] {
  const comp = new Map(src.competencies.map((c) => [c.id, c]));
  const mods = new Map<string, ModuleLite[]>();
  for (const m of src.modules ?? []) (mods.get(m.course_id) ?? mods.set(m.course_id, []).get(m.course_id)!).push(m);
  const docs: AskDoc[] = [];
  for (const c of src.courses.filter((x) => x.audience === 'staff' || x.audience === 'public')) {
    const cs = c.competency_ids.map((k) => comp.get(k)).filter(Boolean) as CompLite[];
    const ms = mods.get(c.id) ?? [];
    const x = c as CourseLite & { summary_en?: string; summary_ar?: string };
    docs.push({
      id: `course:${c.id}`, kind: 'course', route: `/learn/course/${c.id}`, competency_ids: c.competency_ids, keywords: [c.code],
      title: { en: c.title_en, ar: c.title_ar },
      text: { en: [x.summary_en, ...cs.map((k) => k.name_en), ...ms.map((m) => m.title_en)].filter(Boolean).join('. '), ar: [x.summary_ar, ...cs.map((k) => k.name_ar), ...ms.map((m) => m.title_ar)].filter(Boolean).join('. ') },
      meta: { en: `${c.code}${c.duration_hours ? ` · ${c.duration_hours} h` : ''}`, ar: `${c.code}${c.duration_hours ? ` · ${c.duration_hours} س` : ''}` },
    });
  }
  // practice quizzes: titles only (never item stems, options or keys)
  for (const f of (src.forms ?? []).filter((x) => x.is_practice && x.kind === 'practice' && x.status === 'approved'))
    docs.push({ id: `practice:${f.id}`, kind: 'practice', route: `/learn/practice/${f.id}`, competency_ids: [], title: { en: f.title_en, ar: f.title_ar }, text: { en: 'Practice quiz', ar: 'اختبار تدريبي' } });
  for (const p of src.paths ?? []) {
    docs.push({
      id: `path:${p.id}`, kind: 'path', route: `/learn/paths/${p.id}`, competency_ids: [], title: p.title,
      text: { en: [p.summary.en, ...(p.careerOnly ? [] : p.stages.map((s) => `${s.title.en}: ${s.content.en} ${s.length?.en ?? ''}`))].join(' '), ar: [p.summary.ar, ...(p.careerOnly ? [] : p.stages.map((s) => `${s.title.ar}: ${s.content.ar} ${s.length?.ar ?? ''}`))].join(' ') },
    });
  }
  for (const p of src.programmes ?? [])
    docs.push({ id: `programme:${p.id}`, kind: 'programme', route: '/learn', competency_ids: [], keywords: [p.code], title: { en: p.name_en, ar: p.name_ar }, text: { en: `${p.purpose_en} ${p.duration_en ?? ''}`, ar: `${p.purpose_ar} ${p.duration_ar ?? ''}` } });
  for (const q of src.faqs ?? []) docs.push({ id: `faq:${q.id}`, kind: 'faq', route: '/faq', competency_ids: [], title: { en: q.q_en, ar: q.q_ar }, text: { en: q.a_en, ar: q.a_ar } });
  return docs;
}

// Role mentions in questions ("for RO", "SRO", "مشغل المفاعل"): short codes plus the role titles.
const ROLE_CODES: Record<string, string> = { ro: 'reactor-operator', sro: 'senior-reactor-operator', lo: 'local-operator', ss: 'shift-supervisor', rp: 'radiation-protection-technician' };
export function roleMentioned(question: string, roles: RoleLite[]): string | null {
  const q = ` ${question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  for (const [code, id] of Object.entries(ROLE_CODES)) if (code !== 'rp' && q.includes(` ${code} `) && roles.some((x) => x.id === id)) return id;
  const byLen = [...roles].sort((a, b) => b.title_en.length - a.title_en.length);
  for (const x of byLen) if (q.includes(` ${x.title_en.toLowerCase()} `) || (x.title_ar && question.includes(x.title_ar))) return x.id;
  return null;
}

const EXAM_PATTERNS = ['answer key', 'exam answers', 'exam questions', 'secure item', 'test answers', 'cheat', 'مفتاح الإجابة', 'إجابات الامتحان', 'أسئلة الامتحان', 'أسئلة الاختبار'];
const COURSE_WORDS = ['course', 'courses', 'training', 'class', 'دورة', 'دورات', 'تدريب', 'برنامج'];

export interface AskAnswer {
  kind: 'answer' | 'none' | 'exam_refused' | 'empty';
  /** i18n key of the answer template (m19.ask.*) and its variables. */
  key: string;
  vars: Record<string, string | number | BiText>;
  citations: { id: string; kind: AskKind; title: BiText; route: string; meta?: BiText; snippet: BiText; role_match: boolean }[];
  role_id: string | null;
}
const snippetOf = (text: string, query: string) => {
  const q = new Set(tokenize(query));
  const parts = text.split(/(?<=[.!?؟])\s+/).map((x) => x.trim()).filter(Boolean);
  const best = [...parts].sort((a, b) => tokenize(b).filter((t) => q.has(t)).length - tokenize(a).filter((t) => q.has(t)).length)[0] ?? '';
  return best.length > 180 ? `${best.slice(0, 177)}…` : best;
};

export function askCoach(question: string, docs: AskDoc[], ctx: { roles: RoleLite[]; roleComps: RoleCompLite[]; index?: SearchIndex<AskDoc> }): AskAnswer {
  const q = question.trim();
  if (!q) return { kind: 'empty', key: 'm19.ask.empty', vars: {}, citations: [], role_id: null };
  const low = q.toLowerCase();
  if (EXAM_PATTERNS.some((p) => low.includes(p))) return { kind: 'exam_refused', key: 'm19.ask.examRefused', vars: {}, citations: [], role_id: null };
  const roleId = roleMentioned(q, ctx.roles);
  const roleComps = new Set(roleId ? ctx.roleComps.filter((x) => x.role_id === roleId).map((x) => x.competency_id) : []);
  const wantsCourses = COURSE_WORDS.some((w) => low.includes(w));
  const idx = ctx.index ?? new SearchIndex(docs);
  // strip the role phrase so "for RO" does not dominate retrieval
  const query = roleId ? q.replace(/\b(ro|sro|lo)\b/gi, ' ') : q;
  let hits = idx.search(query, 12);
  if (roleId) hits = hits.map((h) => ({ ...h, score: h.score * (h.doc.competency_ids.some((c) => roleComps.has(c)) ? 1.2 : 1) }));
  const best = Math.max(0, ...hits.map((h) => h.score));
  hits = hits.filter((h) => h.score >= best * 0.35);
  const rank = (k: AskKind) => (!wantsCourses ? 0 : k === 'course' ? 0 : k === 'practice' ? 1 : 2);
  const top = [...hits].sort((a, b) => rank(a.doc.kind) - rank(b.doc.kind) || b.score - a.score).slice(0, 4);
  if (!top.length) return { kind: 'none', key: 'm19.ask.none', vars: { q }, citations: [], role_id: roleId };
  const role = roleId ? ctx.roles.find((x) => x.id === roleId) : null;
  const courses = top.filter((h) => h.doc.kind === 'course').length;
  return {
    kind: 'answer',
    key: courses ? (role ? 'm19.ask.answerCoursesRole' : 'm19.ask.answerCourses') : 'm19.ask.answerOther',
    vars: { n: courses || top.length, ...(role ? { role: { en: role.title_en, ar: role.title_ar } } : {}) },
    citations: top.map((h) => ({ id: h.doc.id, kind: h.doc.kind, title: h.doc.title, route: h.doc.route, meta: h.doc.meta, snippet: { en: snippetOf(h.doc.text.en, query), ar: snippetOf(h.doc.text.ar, query) }, role_match: !!roleId && h.doc.competency_ids.some((c) => roleComps.has(c)) })),
    role_id: roleId,
  };
}
