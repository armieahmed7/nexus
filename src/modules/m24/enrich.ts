/**
 * M24 · F21 deterministic enrichment for capture transcripts: RAKE key phrases, TF-IDF keywords and a BM25 match against
 * the skills catalogue, the OE lessons and the course catalogue. Suggestions only: the technical reviewer accepts or rejects
 * each one. Import-free (the seed builder loads this file in node) and fully deterministic (same text, same suggestions).
 */
const EN_STOP = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yes ok okay really thing things lot get got go going know make made way well say said one two first also may might much many use used using every always never often still even back like just us let lets want need take').split(' '));
const AR_STOP = new Set(('في من على الى إلى عن مع هذا هذه ذلك تلك التي الذي الذين هو هي هم انا أنا نحن انت أنت كان كانت يكون لم لن لا ما ماذا كيف متى اين أين او أو ثم قد كل بعض اي أي عند بين بعد قبل حتى اذا إذا لكن لأن ان أن إن و ف ب ل').split(' '));
const norm = (s: string) =>
  String(s ?? '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const stem = (w: string) => (/[a-z]/.test(w) && w.length > 5 ? w.replace(/(ing|ed|es|s)$/, '') : w);

/** Content words (normalised, stop words removed, light English stemming). */
export function tok(s: string): string[] {
  return norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !EN_STOP.has(w) && !AR_STOP.has(w) && !/^\d+$/.test(w)).map(stem);
}

export interface Phrase { phrase: string; score: number }
/** RAKE: candidate phrases are runs of content words between stop words and punctuation; word score = degree / frequency. */
export function rake(text: string, n = 8): Phrase[] {
  const words = norm(text).split(/([^\p{L}\p{N}]+)/u);
  const phrases: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    const isSep = !/^[\p{L}\p{N}]+$/u.test(w);
    const brk = isSep ? /[.,;:!?؟،()\n"]/.test(w) : EN_STOP.has(w) || AR_STOP.has(w) || w.length <= 2 || /^\d+$/.test(w);
    if (isSep && !brk) continue;
    if (brk) { if (cur.length) phrases.push(cur); cur = []; continue; }
    cur.push(w);
    if (cur.length === 4) { phrases.push(cur); cur = []; }
  }
  if (cur.length) phrases.push(cur);
  const freq = new Map<string, number>();
  const deg = new Map<string, number>();
  for (const p of phrases) for (const w of p) { freq.set(w, (freq.get(w) ?? 0) + 1); deg.set(w, (deg.get(w) ?? 0) + p.length); }
  const scored = new Map<string, number>();
  for (const p of phrases) {
    if (p.length < 2) continue;
    const k = p.join(' ');
    const s = p.reduce((a, w) => a + (deg.get(w) ?? 0) / (freq.get(w) ?? 1), 0);
    scored.set(k, Math.max(scored.get(k) ?? 0, s));
  }
  return [...scored.entries()].map(([phrase, s]) => ({ phrase, score: Math.round(s * 100) / 100 })).sort((a, b) => b.score - a.score || (a.phrase < b.phrase ? -1 : 1)).slice(0, n);
}

/** TF-IDF keywords of `text` against a background corpus (document frequency smoothed). */
export function tfidf(text: string, corpus: string[], n = 12): { term: string; score: number }[] {
  const tf = new Map<string, number>();
  for (const t of tok(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const df = new Map<string, number>();
  for (const d of corpus) for (const t of new Set(tok(d))) df.set(t, (df.get(t) ?? 0) + 1);
  const N = corpus.length + 1;
  return [...tf.entries()].map(([term, f]) => ({ term, score: Math.round(f * Math.log(N / (1 + (df.get(term) ?? 0)) + 1) * 100) / 100 }))
    .sort((a, b) => b.score - a.score || (a.term < b.term ? -1 : 1)).slice(0, n);
}

export interface RefDoc { id: string; text: string }
/** BM25 of a bag of query terms against reference documents; returns the matched terms for the "why". */
export function bm25(query: string[], docs: RefDoc[]): { id: string; score: number; terms: string[] }[] {
  const items = docs.map((d) => { const ts = tok(d.text); const tf = new Map<string, number>(); for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1); return { id: d.id, tf, len: ts.length || 1 }; });
  const avg = items.reduce((a, b) => a + b.len, 0) / Math.max(1, items.length);
  const df = new Map<string, number>();
  for (const it of items) for (const t of it.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const q = [...new Set(query)];
  const out: { id: string; score: number; terms: string[] }[] = [];
  for (const it of items) {
    let s = 0;
    const hit: string[] = [];
    for (const t of q) {
      const f = it.tf.get(t);
      if (!f) continue;
      const d = df.get(t) ?? 0;
      s += Math.log(1 + (items.length - d + 0.5) / (d + 0.5)) * ((f * 2.2) / (f + 1.2 * (0.25 + (0.75 * it.len) / avg)));
      hit.push(t);
    }
    if (s > 0) out.push({ id: it.id, score: Math.round(s * 100) / 100, terms: hit.sort() });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

export type SuggestionKind = 'skill' | 'oe' | 'course';
export interface Suggestion { kind: SuggestionKind; ref: string; score: number; terms: string[]; decision: 'pending' | 'accepted' | 'rejected' }
export interface EnrichRefs { skills: RefDoc[]; oe: RefDoc[]; courses: RefDoc[] }
export interface Enrichment { phrases: Phrase[]; keywords: { term: string; score: number }[]; suggestions: Suggestion[] }
const LIMIT: Record<SuggestionKind, number> = { skill: 5, oe: 3, course: 3 };
const MIN_SCORE = 1.5;
const MIN_TERMS: Record<SuggestionKind, number> = { skill: 2, oe: 2, course: 2 };

/** Key phrases, keywords and suggested skill tags, related OE lessons and courses for a transcript or draft. */
export function enrich(text: string, refs: EnrichRefs): Enrichment {
  const corpus = [...refs.skills, ...refs.oe, ...refs.courses].map((d) => d.text);
  const phrases = rake(text, 8);
  const keywords = tfidf(text, corpus, 14);
  const query = [...keywords.map((k) => k.term), ...phrases.flatMap((p) => tok(p.phrase))];
  const suggestions: Suggestion[] = [];
  for (const kind of ['skill', 'oe', 'course'] as SuggestionKind[]) {
    const docs = kind === 'skill' ? refs.skills : kind === 'oe' ? refs.oe : refs.courses;
    for (const h of bm25(query, docs).filter((x) => x.score >= MIN_SCORE && x.terms.length >= MIN_TERMS[kind]).slice(0, LIMIT[kind])) suggestions.push({ kind, ref: h.id, score: h.score, terms: h.terms.slice(0, 6), decision: 'pending' });
  }
  return { phrases, keywords, suggestions };
}
