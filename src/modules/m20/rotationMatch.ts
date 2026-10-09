/**
 * F15 recommenders (deterministic, explainable; served through useEngine('match')). Every result carries reasons
 * (i18n keys m20.rot.reasons.*) rendered by <WhyThis>.
 *  - rankProgrammes: how much a rotation programme closes my gaps: Σ over objectives of min(target − my level, 2), with a bonus
 *    when my target role (F05 shortlist) needs the skill above my level, normalised by the programme's total objective levels.
 *  - rankHosts: shadowing hosts by the skills they offer that I want to grow (level below 2, or needed by my target role),
 *    plus a small bonus for seeing another job family (cross-functional exposure).
 * Nationality, gender and age are never inputs.
 */
import type { BiText, Ranked, Reason } from '../../domain/engines/types';
import { roleNeed, type MatchSkill } from './match';
import type { Objective, Step } from './rotation';

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const R = (code: string, vars?: Reason['vars'], weight?: number, ref?: Reason['ref']): Reason => ({ code, key: `m20.rot.reasons.${code}`, vars, weight, ref });

interface Ctx {
  states: { skill_id: string; level: number; active?: boolean | null }[];
  skills: MatchSkill[];
  roleComps: { role_id: string; competency_id: string; required_level: number }[];
  targetRole?: string | null;
  family?: string | null;
  roleLabels?: Record<string, BiText>;
  familyLabels?: Record<string, BiText>;
}
const levels = (states: Ctx['states']) => {
  const lv = new Map<string, number>();
  for (const s of states) if (s.active !== false && s.level > 0) lv.set(s.skill_id, Math.max(lv.get(s.skill_id) ?? 0, s.level));
  return lv;
};

export interface ProgrammeLike { id: string; steps: unknown; eligible_families?: string[] | null; duration_min_months: number; duration_max_months: number }
export interface ProgrammeMatch<T> { programme: T; eligible: boolean; gaps: number; objectives: number; months: number }

export function rankProgrammes<T extends ProgrammeLike>(programmes: T[], c: Ctx): Ranked<ProgrammeMatch<T>>[] {
  const lv = levels(c.states);
  const sk = new Map(c.skills.map((s) => [s.id, s]));
  const label = (id: string): BiText => { const s = sk.get(id); return s ? { en: s.name_en, ar: s.name_ar } : { en: id, ar: id }; };
  const role = c.targetRole ? c.roleLabels?.[c.targetRole] ?? { en: c.targetRole, ar: c.targetRole } : null;
  const out: Ranked<ProgrammeMatch<T>>[] = [];
  for (const p of programmes) {
    const steps = (Array.isArray(p.steps) ? p.steps : []) as Step[];
    const objs: Objective[] = steps.flatMap((s) => s.objectives ?? []);
    const reasons: Reason[] = [];
    let gain = 0;
    let max = 0;
    let gaps = 0;
    let targetHits = 0;
    const gapList: { id: string; from: number; to: number; c: number }[] = [];
    for (const o of objs) {
      const my = lv.get(o.skill_id) ?? 0;
      max += o.level;
      if (o.level > my) {
        const cgain = Math.min(o.level - my, 2);
        gain += cgain;
        gaps++;
        gapList.push({ id: o.skill_id, from: my, to: o.level, c: cgain });
      }
      if (c.targetRole && roleNeed(c.roleComps, c.targetRole, sk.get(o.skill_id)) > my) targetHits++;
    }
    const closure = max ? gain / max : 0;
    const target = Math.min(1, targetHits / 3);
    const months = steps.reduce((a, s) => a + (s.months ?? 0), 0);
    const eligible = !(p.eligible_families ?? []).length || (!!c.family && (p.eligible_families ?? []).includes(c.family));
    const score = r4(0.75 * closure + 0.25 * target);
    reasons.push(R('closure', { n: gaps, total: objs.length }, r4(0.75 * closure)));
    for (const g of [...gapList].sort((a, b) => b.c - a.c || (a.id < b.id ? -1 : 1)).slice(0, 2)) reasons.push(R('gap', { skill: label(g.id), from: g.from, to: g.to }, undefined, { table: 'skills', id: g.id }));
    if (role && targetHits) reasons.push(R('target', { role, n: targetHits }, r4(0.25 * target)));
    if (!gaps) reasons.push(R('consolidate'));
    reasons.push(R('months', { n: months, steps: steps.length }));
    if (!eligible) reasons.push(R('not_eligible'));
    out.push({ id: p.id, score, reasons, item: { programme: p, eligible, gaps, objectives: objs.length, months } });
  }
  return out.sort((a, b) => Number(b.item!.eligible) - Number(a.item!.eligible) || b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface HostLike { id: string; person_id: string; skill_ids: string[]; family_id?: string | null; max_days_month: number }
export interface HostMatch<T> { host: T; growth: string[] }

export function rankHosts<T extends HostLike>(hosts: T[], me: string | null, c: Ctx, wanted: string[] = []): Ranked<HostMatch<T>>[] {
  const lv = levels(c.states);
  const sk = new Map(c.skills.map((s) => [s.id, s]));
  const label = (id: string): BiText => { const s = sk.get(id); return s ? { en: s.name_en, ar: s.name_ar } : { en: id, ar: id }; };
  const role = c.targetRole ? c.roleLabels?.[c.targetRole] ?? { en: c.targetRole, ar: c.targetRole } : null;
  const out: Ranked<HostMatch<T>>[] = [];
  for (const h of hosts) {
    if (h.person_id === me) continue;
    const reasons: Reason[] = [];
    const ids = h.skill_ids ?? [];
    const growth = ids.filter((id) => (lv.get(id) ?? 0) < 2 || (c.targetRole && roleNeed(c.roleComps, c.targetRole, sk.get(id)) > (lv.get(id) ?? 0)));
    const asked = wanted.length ? ids.filter((id) => wanted.includes(id)) : [];
    const tHits = c.targetRole ? ids.filter((id) => roleNeed(c.roleComps, c.targetRole, sk.get(id)) > (lv.get(id) ?? 0)).length : 0;
    const cross = !!c.family && !!h.family_id && h.family_id !== c.family;
    const g = ids.length ? growth.length / ids.length : 0;
    const w = wanted.length ? asked.length / wanted.length : 0;
    const score = r4(wanted.length ? 0.6 * w + 0.3 * g + 0.1 * Number(cross) : 0.7 * g + 0.2 * Math.min(1, tHits / 2) + 0.1 * Number(cross));
    if (asked.length) reasons.push(R('host_wanted', { n: asked.length, total: wanted.length }, r4(0.6 * w)));
    for (const id of growth.slice(0, 2)) reasons.push(R('host_growth', { skill: label(id), level: lv.get(id) ?? 0 }, undefined, { table: 'skills', id }));
    if (!growth.length) reasons.push(R('host_refresh'));
    if (role && tHits) reasons.push(R('host_target', { role, n: tHits }));
    if (cross) reasons.push(R('host_cross', { family: c.familyLabels?.[h.family_id!] ?? { en: h.family_id!, ar: h.family_id! } }));
    reasons.push(R('host_days', { n: h.max_days_month }));
    out.push({ id: h.id, score, reasons, item: { host: h, growth } });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
