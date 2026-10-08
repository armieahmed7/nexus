/**
 * F08 match engine (deterministic, explainable; served through useEngine('match') weights skills / development / target).
 *   skills       how well my skill vector covers the needed-skills vector: cosine(mine, need) × |mine| / |need|, with my levels
 *                capped at the needed level (= the projection of my vector onto the need vector, 0..1)
 *   development  share of the skills gained that close a gap to my current role or my target role (gap of 2+ levels counts fully)
 *   target       skills (needed or gained) that my target role requires above my level: 1 skill = 0.5, 2+ = 1
 * score = Σ weight × component / Σ weights. Every result carries reasons (i18n keys m20.reasons.*), rendered by <WhyThis>.
 * Nationality is never an input: the "Emirati development priority" flag is shown on the card but does not change the score.
 */
import { cosine, type Vec } from '../../domain/engines/rank';
import type { BiText, Ranked, Reason, Weights } from '../../domain/engines/types';

export const NEED_LEVEL = 2;
export const MATCH_DEFAULTS = { skills: 0.7, development: 0.2, target: 0.1 };

export interface MatchOpp { id: string; skills_needed: string[]; skills_gained: string[]; eligible_families?: string[] | null }
export interface MatchSkill { id: string; competency_id: string; core: boolean; key_level: number; name_en: string; name_ar: string }
export interface MatchInput<O extends MatchOpp> {
  opps: O[];
  states: { skill_id: string; level: number; active?: boolean | null }[];
  skills: MatchSkill[];
  roleComps: { role_id: string; competency_id: string; required_level: number }[];
  currentRole?: string | null;
  targetRole?: string | null;
  family?: string | null;
  roleLabels?: Record<string, BiText>;
  weights?: Weights;
}
export interface MatchItem<O> { opp: O; skills: number; development: number; target: number; eligible: boolean; have: number; need: number }

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const R = (code: string, vars?: Reason['vars'], weight?: number, ref?: Reason['ref']): Reason => ({ code, key: `m20.reasons.${code}`, vars, weight, ref });

/** Level a role needs on a skill: the competency requirement on core skills; min(key level, requirement) on specialised ones. */
export function roleNeed(roleComps: MatchInput<MatchOpp>['roleComps'], roleId: string | null | undefined, s: MatchSkill | undefined): number {
  if (!roleId || !s) return 0;
  const rc = roleComps.find((r) => r.role_id === roleId && r.competency_id === s.competency_id);
  if (!rc) return 0;
  return s.core ? rc.required_level : Math.min(s.key_level, rc.required_level);
}

export function matchOpportunities<O extends MatchOpp>(input: MatchInput<O>): Ranked<MatchItem<O>>[] {
  const ws = { ...MATCH_DEFAULTS, ...(input.weights ?? {}) };
  const wsum = (ws.skills ?? 0) + (ws.development ?? 0) + (ws.target ?? 0) || 1;
  const lv = new Map<string, number>();
  for (const s of input.states) if (s.active !== false && s.level > 0) lv.set(s.skill_id, Math.max(lv.get(s.skill_id) ?? 0, s.level));
  const sk = new Map(input.skills.map((s) => [s.id, s]));
  const label = (id: string): BiText => { const s = sk.get(id); return s ? { en: s.name_en, ar: s.name_ar } : { en: id, ar: id }; };
  const roleLabel = (id: string): BiText => input.roleLabels?.[id] ?? { en: id, ar: id };
  const out: Ranked<MatchItem<O>>[] = [];
  for (const o of input.opps) {
    const reasons: Reason[] = [];
    const needed = o.skills_needed ?? [];
    // skills component
    let fit = 1;
    let have = 0;
    if (needed.length) {
      const need: Vec = new Map(needed.map((id) => [id, NEED_LEVEL]));
      const mine: Vec = new Map(needed.filter((id) => (lv.get(id) ?? 0) > 0).map((id) => [id, Math.min(lv.get(id)!, NEED_LEVEL)]));
      const norm = (v: Vec) => Math.sqrt([...v.values()].reduce((a, x) => a + x * x, 0));
      fit = mine.size ? cosine(mine, need) * (norm(mine) / norm(need)) : 0;
      have = needed.filter((id) => (lv.get(id) ?? 0) >= NEED_LEVEL).length;
      reasons.push(R('fit', { pct: Math.round(fit * 100), have, total: needed.length }, r4(ws.skills * fit)));
      for (const id of needed.filter((x) => (lv.get(x) ?? 0) >= NEED_LEVEL).slice(0, 2)) reasons.push(R('have', { skill: label(id), level: lv.get(id)! }, undefined, { table: 'skills', id }));
      for (const id of needed.filter((x) => (lv.get(x) ?? 0) < NEED_LEVEL).slice(0, 2)) reasons.push(R('stretch', { skill: label(id), level: lv.get(id) ?? 0, need: NEED_LEVEL }, undefined, { table: 'skills', id }));
    } else reasons.push(R('open', undefined, r4(ws.skills)));
    // development component
    const gained = o.skills_gained ?? [];
    let dev = 0;
    for (const id of gained) {
      const s = sk.get(id);
      const my = lv.get(id) ?? 0;
      const cur = roleNeed(input.roleComps, input.currentRole, s);
      const tgt = roleNeed(input.roleComps, input.targetRole, s);
      const needLv = Math.max(cur, tgt);
      if (needLv > my) {
        const c = Math.min(needLv - my, 2) / 2;
        dev += c;
        reasons.push(R(cur >= tgt ? 'gap_current' : 'gap_target', { skill: label(id), from: my, to: needLv, ...(cur >= tgt ? {} : { role: roleLabel(input.targetRole!) }) }, r4((ws.development * c) / Math.max(1, gained.length)), { table: 'skills', id }));
      } else if (my === 0) reasons.push(R('new_skill', { skill: label(id) }, 0, { table: 'skills', id }));
    }
    dev = gained.length ? dev / gained.length : 0;
    // target-role component
    let tcount = 0;
    if (input.targetRole) for (const id of new Set([...needed, ...gained])) if (roleNeed(input.roleComps, input.targetRole, sk.get(id)) > (lv.get(id) ?? 0)) tcount++;
    const target = Math.min(1, tcount / 2);
    if (tcount > 0) reasons.push(R('target', { role: roleLabel(input.targetRole!), n: tcount }, r4(ws.target * target)));
    const eligible = !(o.eligible_families ?? []).length || (!!input.family && (o.eligible_families ?? []).includes(input.family));
    if (!eligible) reasons.push(R('not_eligible'));
    const score = r4((ws.skills * fit + ws.development * dev + ws.target * target) / wsum);
    out.push({ id: o.id, score, reasons, item: { opp: o, skills: r4(fit), development: r4(dev), target: r4(target), eligible, have, need: needed.length } });
  }
  return out.sort((a, b) => Number(b.item!.eligible) - Number(a.item!.eligible) || b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
