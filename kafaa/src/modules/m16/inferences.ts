/**
 * F24 "Download what Kafa'a infers about me" (JSON). Pure builder: the settings card gathers the same inputs the pages use
 * (F01 skill states and evidence, F05 readiness, F07 coach feed, F08 match scores) and this function picks explicit fields
 * only, so the file never carries a protected attribute (tests/unit/w3e5-transparency.test.ts). Nothing is stored.
 */
import type { Ranked, Reason } from '../../domain/engines/types';
import { EXCLUDED_ON_CARDS } from './transparency';

export interface InferenceInput {
  personId: string;
  generatedAt: string;
  lang: 'en' | 'ar';
  skills: { id: string; name_en: string; name_ar: string }[];
  states: { skill_id: string; level: number; confidence: number | string; basis: string; evidence_count?: number | null; reasons?: unknown; active?: boolean | null; updated_at?: string | null }[];
  evidence: { id: string; skill_id: string; kind: string; ref_table?: string | null; ref_id?: string | null; level: number; basis: string; status?: string | null; observed_on?: string | null; active?: boolean | null }[];
  readiness: { role_id: string; pct: number | null; band: string; months: number | null; gate_status: string; reasons: Reason[] }[];
  roles: { id: string; title_en: string; title_ar: string }[];
  coach: { opted_out: boolean; items: { id: string; kind: string; itemId: string; score: number; reasons: Reason[] }[] };
  opportunities: { opted_out: boolean; items: Ranked[] };
  navigatorOptedOut: boolean;
  optouts: { surface: string; opted_out: boolean; updated_at?: string | null }[];
  cards: { id: string; engine_surface: string; version: number }[];
  engines: { surface: string; engine: string; weights: Record<string, number> }[];
}

const NOTE = {
  en: "What Kafa'a infers about you: skill levels with the evidence behind them, career readiness, and the ranked suggestions shown to you, each with its reasons. Gender, nationality and age are never used by any of these engines. To ask for a correction, use \"Ask for a correction\" in your settings.",
  ar: 'ما تستنتجه كفاءة عنك: مستويات المهارات والأدلة وراءها، والجاهزية المهنية، والاقتراحات المرتبة المعروضة لك مع أسبابها. لا تستخدم أيٌّ من هذه المحرّكات الجنس أو الجنسية أو العمر. لطلب تصحيح، استخدم "طلب تصحيح" في إعداداتك.',
};
const reasons = (r: unknown): unknown[] => (Array.isArray(r) ? r.map((x) => { const o = x as Record<string, unknown>; return { code: o.code, key: o.key, vars: o.vars ?? null, ref: o.ref ?? null }; }) : []);

export function buildInferenceExport(i: InferenceInput) {
  const sk = new Map(i.skills.map((s) => [s.id, s]));
  const role = new Map(i.roles.map((r) => [r.id, r]));
  return {
    kind: 'kafaa.ai-inferences',
    version: 1,
    generated_at: i.generatedAt,
    person_id: i.personId,
    note: NOTE[i.lang],
    never_used: [...EXCLUDED_ON_CARDS],
    engines: i.engines.map((e) => ({ surface: e.surface, engine: e.engine, weights: e.weights })),
    engine_cards: i.cards.map((c) => ({ id: c.id, engine_surface: c.engine_surface, version: c.version })),
    opt_outs: i.optouts.map((o) => ({ surface: o.surface, opted_out: o.opted_out, updated_at: o.updated_at ?? null })),
    skills: i.states.filter((s) => s.active !== false && s.level > 0).map((s) => ({
      skill_id: s.skill_id, name_en: sk.get(s.skill_id)?.name_en ?? s.skill_id, name_ar: sk.get(s.skill_id)?.name_ar ?? s.skill_id,
      level: s.level, confidence: Number(s.confidence), basis: s.basis, evidence_count: s.evidence_count ?? null, updated_at: s.updated_at ?? null, reasons: reasons(s.reasons),
    })),
    evidence: i.evidence.filter((e) => e.active !== false).map((e) => ({ id: e.id, skill_id: e.skill_id, kind: e.kind, source: e.ref_table ?? null, source_id: e.ref_id ?? null, level: e.level, basis: e.basis, status: e.status ?? null, observed_on: e.observed_on ?? null })),
    career_readiness: i.navigatorOptedOut ? { opted_out: true, items: [] } : {
      opted_out: false,
      items: i.readiness.map((r) => ({ role_id: r.role_id, role_en: role.get(r.role_id)?.title_en ?? r.role_id, role_ar: role.get(r.role_id)?.title_ar ?? r.role_id, readiness_pct: r.pct, band: r.band, months: r.months, gates: r.gate_status, reasons: reasons(r.reasons) })),
    },
    coach: { opted_out: i.coach.opted_out, items: i.coach.opted_out ? [] : i.coach.items.map((c, n) => ({ rank: n + 1, id: c.id, kind: c.kind, item_id: c.itemId, score: c.score, reasons: reasons(c.reasons) })) },
    opportunities: { opted_out: i.opportunities.opted_out, items: i.opportunities.opted_out ? [] : i.opportunities.items.map((r, n) => ({ rank: n + 1, id: r.id, match: r.score, reasons: reasons(r.reasons) })) },
  };
}
