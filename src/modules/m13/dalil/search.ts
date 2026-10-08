/** BM25 retrieval over the Dalil corpus (titles weighted, per-language fields). */
import { tokenize, type Lang } from './text';
import type { CorpusDoc } from './types';

interface Indexed {
  doc: CorpusDoc;
  tf: Map<string, number>;
  len: number;
}
export interface Hit {
  doc: CorpusDoc;
  score: number;
}

const K1 = 1.4;
const B = 0.7;
const TITLE_WEIGHT = 3;

export class SearchIndex {
  private items: Indexed[] = [];
  private df = new Map<string, number>();
  private avg = 1;
  constructor(docs: CorpusDoc[]) {
    for (const doc of docs) {
      const tf = new Map<string, number>();
      const add = (s: string, w: number) => {
        for (const t of tokenize(s)) tf.set(t, (tf.get(t) ?? 0) + w);
      };
      add(`${doc.title.en} ${doc.title.ar}`, TITLE_WEIGHT);
      add(`${doc.text.en} ${doc.text.ar} ${(doc.keywords ?? []).join(' ')}`, 1);
      const len = [...tf.values()].reduce((a, b) => a + b, 0) || 1;
      this.items.push({ doc, tf, len });
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avg = this.items.reduce((a, b) => a + b.len, 0) / Math.max(1, this.items.length);
  }
  get size() {
    return this.items.length;
  }
  search(query: string, k = 5, opts: { boostRoute?: string | null; kinds?: CorpusDoc['kind'][] } = {}): Hit[] {
    const q = [...new Set(tokenize(query))];
    if (!q.length) return [];
    const N = this.items.length;
    const out: Hit[] = [];
    for (const it of this.items) {
      if (opts.kinds && !opts.kinds.includes(it.doc.kind)) continue;
      let s = 0;
      for (const t of q) {
        const f = it.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * it.len) / this.avg)));
      }
      if (s <= 0) continue;
      if (opts.boostRoute && it.doc.route && opts.boostRoute.startsWith(it.doc.route)) s *= 1.15;
      out.push({ doc: it.doc, score: s });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, k);
  }
  /** How many of the query's content tokens appear in the doc (0..1): a cheap precision signal for confidence. */
  coverage(query: string, doc: CorpusDoc): number {
    const q = [...new Set(tokenize(query))];
    if (!q.length) return 0;
    const it = this.items.find((x) => x.doc === doc);
    if (!it) return 0;
    return q.filter((t) => it.tf.has(t)).length / q.length;
  }
}

/** Pick the sentences of a doc that best match the query (keeps original order). */
export function bestSentences(text: string, query: string, n: number): string[] {
  const q = new Set(tokenize(query));
  const ss = text
    .split(/(?<=[.!?؟])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 2);
  const scored = ss.map((s, i) => ({ s, i, v: tokenize(s).filter((t) => q.has(t)).length }));
  const top = [...scored].sort((a, b) => b.v - a.v || a.i - b.i).slice(0, n);
  return top.sort((a, b) => a.i - b.i).map((x) => x.s);
}
export function pickLang<T>(v: { en: T; ar: T }, lang: Lang): T {
  const ar = v.ar as unknown as string;
  return lang === 'ar' && ar && String(ar).trim() ? v.ar : v.en;
}
