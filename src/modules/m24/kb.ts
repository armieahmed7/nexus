/**
 * M24 · F21 knowledge base search: one BM25 index (F02 SearchEngine) over published knowledge assets, OE lessons and courses.
 * An asset hit pulls in the OE lessons its reviewer linked (accepted suggestions), so a search for a captured topic returns the
 * asset and the related lesson side by side, each with its citation. Withdrawn assets are not readable, so they drop out of the
 * index at the next refresh. Pure (no React); pages and tests share it.
 */
import { SearchIndex, bestSentences } from '../../domain/search';
import type { KbDoc } from './capture';

export interface AssetLite {
  id: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; body: string; body_lang: string; key_points: { en: string; ar: string }[];
  skill_ids: string[]; oe_ids: string[]; course_ids: string[]; system_family: string; status: string; published: boolean; sme_name: string; sme_name_ar: string;
  published_at?: string | null; used_by: number; template?: string | null; requal_standard_ids?: string[]; standard_ids?: string[];
}
export interface OeLite { id: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; lesson_en: string; lesson_ar: string; reviewed_on: string; reviewing_body: string; status?: string }
export interface CourseLite { id: string; code: string; title_en: string; title_ar: string; summary_en?: string; summary_ar?: string; competency_ids?: string[] }

export function kbDocs(assets: AssetLite[], oe: OeLite[], courses: CourseLite[], skillName: (id: string) => { en: string; ar: string } = (id) => ({ en: id, ar: id })): KbDoc[] {
  const docs: KbDoc[] = [];
  for (const a of assets.filter((x) => x.published && x.status === 'published')) {
    const kpEn = a.key_points.map((k) => k.en).join(' ');
    const kpAr = a.key_points.map((k) => k.ar).join(' ');
    docs.push({
      id: `asset:${a.id}`, kind: 'asset', route: `/knowledge/assets/${a.id}`,
      title: { en: a.title_en, ar: a.title_ar },
      text: { en: `${a.summary_en} ${kpEn} ${a.body_lang === 'en' ? a.body : ''}`, ar: `${a.summary_ar} ${kpAr} ${a.body_lang === 'ar' ? a.body : ''}` },
      keywords: a.skill_ids.flatMap((s) => [skillName(s).en, skillName(s).ar]),
    });
  }
  for (const o of oe.filter((x) => (x.status ?? 'published') === 'published')) docs.push({ id: `oe:${o.id}`, kind: 'oe', route: '/oe', title: { en: o.title_en, ar: o.title_ar }, text: { en: `${o.summary_en} ${o.lesson_en}`, ar: `${o.summary_ar} ${o.lesson_ar}` } });
  for (const c of courses) docs.push({ id: `course:${c.id}`, kind: 'course', route: `/learn/course/${c.id}`, title: { en: c.title_en, ar: c.title_ar }, text: { en: `${c.code} ${c.summary_en ?? ''}`, ar: `${c.code} ${c.summary_ar ?? ''}` } });
  return docs;
}

export interface KbFilters { kind?: '' | 'asset' | 'oe' | 'course'; skillId?: string; skillCompetency?: string; family?: string }
export interface KbHit { id: string; kind: 'asset' | 'oe' | 'course'; ref: string; score: number; doc: KbDoc; via?: string; snippet: string[] }

export function searchKb(index: SearchIndex<KbDoc>, all: KbDoc[], query: string, data: { assets: AssetLite[]; oe: OeLite[]; courses: CourseLite[] }, filters: KbFilters = {}, lang: 'en' | 'ar' = 'en'): KbHit[] {
  const assets = new Map(data.assets.map((a) => [a.id, a]));
  const courses = new Map(data.courses.map((c) => [c.id, c]));
  const byId = new Map(all.map((d) => [d.id, d]));
  const pass = (kind: string, ref: string) => {
    if (filters.kind && filters.kind !== kind) return false;
    if (kind === 'asset') {
      const a = assets.get(ref);
      if (!a) return false;
      if (filters.skillId && !a.skill_ids.includes(filters.skillId)) return false;
      if (filters.family && a.system_family !== filters.family) return false;
      return true;
    }
    if (filters.family) return false;
    if (kind === 'course' && filters.skillId) return !!filters.skillCompetency && (courses.get(ref)?.competency_ids ?? []).includes(filters.skillCompetency);
    if (kind === 'oe' && filters.skillId) return data.assets.some((a) => a.skill_ids.includes(filters.skillId!) && a.oe_ids.includes(ref));
    return true;
  };
  const hits = query.trim() ? index.search(query, 60) : [];
  const out: KbHit[] = [];
  const seen = new Set<string>();
  const snippet = (d: KbDoc) => bestSentences(lang === 'ar' && d.text.ar.trim() ? d.text.ar : d.text.en, query, 2);
  for (const h of hits) {
    const [kind, ref] = h.doc.id.split(/:(.+)/) as ['asset' | 'oe' | 'course', string];
    if (seen.has(h.doc.id) || !pass(kind, ref)) continue;
    seen.add(h.doc.id);
    out.push({ id: h.doc.id, kind, ref, score: Math.round(h.score * 100) / 100, doc: h.doc, snippet: snippet(h.doc) });
    if (kind === 'asset') {
      for (const o of assets.get(ref)?.oe_ids ?? []) {
        const id = `oe:${o}`;
        const od = byId.get(id);
        if (!od || seen.has(id) || (filters.kind && filters.kind !== 'oe' && filters.kind !== 'asset') || filters.family) continue;
        seen.add(id);
        out.push({ id, kind: 'oe', ref: o, score: 0, doc: od, via: ref, snippet: snippet(od) });
      }
    }
  }
  return out;
}
