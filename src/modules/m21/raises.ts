/**
 * FS13 "what raises it": ranked learning and practice actions with their before/after effect on readiness v2, the reasons
 * behind every family and item, and the adapter that lets the F09 rankers (bridges, resources, concept roles) read v2.
 * Deterministic, pure (no React, no repository); every ranked item carries reasons (lintRanked).
 */
import type { BiText, Ranked, Reason } from '../../domain/engines/types';
import { factorOf, m21Reason, type AdvLevel, type FamilyReadiness, type ReadinessItem, type Relation } from './future';
import { deltaOf, learningActions, previewEvidence, type EvidenceChange, type RV2, type RV2Family, type RV2Item } from './readiness';

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const lab = (m: Record<string, BiText> | undefined, id: string | null | undefined): BiText => (id ? m?.[id] ?? { en: id, ar: id } : { en: '', ar: '' });

export interface RaiseLabels { skills?: Record<string, BiText>; adv?: Record<string, BiText>; techs?: Record<string, BiText>; resources?: Record<string, BiText>; courses?: Record<string, BiText>; tracks?: Record<string, BiText> }

/** Reasons for one ADVANCE skill's credit: what carries over, what counts directly, what was learnt, or nothing yet. */
export function itemReasons(it: RV2Item, L: RaiseLabels = {}): Reason[] {
  const out: Reason[] = [];
  if (it.c6 > 0) {
    const f = it.carry_opts.find((o) => o.sk_id === it.carry_via)?.f ?? 1;
    out.push(m21Reason(f === 2 ? 'v2_item_transfers' : 'v2_item_adapts', { skill: lab(L.skills, it.carry_via), level: it.carry_level }, it.carry_via ? { table: 'person_skills', id: it.carry_via } : undefined));
  }
  if (it.d3 > 0) out.push(m21Reason('v2_item_direct', { skill: lab(L.skills, it.direct_via), level: it.direct_level }, it.direct_via ? { table: 'person_skills', id: it.direct_via } : undefined));
  if (it.l3 > 0) out.push(m21Reason('v2_item_learn', { title: lab(L.resources, it.learn_via), level: it.learn_level }, it.learn_via ? { table: 'future_resources', id: it.learn_via } : undefined));
  if (!out.length) out.push(m21Reason('v2_item_none'));
  out.push(m21Reason('v2_item_credit', { pct: Math.round(it.bp / 100) }));
  return out;
}

/** Reasons for a family index: how many ADVANCE skills each kind of evidence covers, what is still open, and the ceilings. */
export function familyReasonsV2(f: RV2Family): Reason[] {
  const carry = f.items.filter((i) => i.c6 > 0).length;
  const direct = f.items.filter((i) => i.d3 > 0).length;
  const learn = f.items.filter((i) => i.l3 > 0).length;
  const none = f.items.filter((i) => i.bp === 0).length;
  const out: Reason[] = [];
  if (carry) out.push(m21Reason('v2_carry', { n: carry }));
  if (direct) out.push(m21Reason('v2_direct', { n: direct }));
  if (learn) out.push(m21Reason('v2_learn', { n: learn }));
  if (none) out.push(m21Reason('v2_gap', { n: none }));
  out.push(m21Reason('v2_ceiling', { c: f.carry_ceiling, l: f.learn_ceiling }));
  return out;
}

export interface RaiseAction {
  kind: 'course' | 'track' | 'practice';
  ref: string;
  title: BiText;
  level: number;
  adv_skill_ids: string[];
  change: EvidenceChange;
  delta: number;
  families: { tech_id: string; before: number; after: number; delta: number }[];
  after: RV2;
}

/**
 * Every course and ADVANCE track not yet recorded, and the new-capability skills not yet at level 2, ranked by how many index
 * points recording them would add (overall, then the largest family gain, then kind and id). Items with no gain are left out.
 */
export function rankRaises(r: RV2, L: RaiseLabels = {}, opts: { practice?: number } = {}): Ranked<RaiseAction>[] {
  const out: Ranked<RaiseAction>[] = [];
  const doneC = new Set(r.completed_courses), doneT = new Set(r.completed_tracks);
  const push = (kind: RaiseAction['kind'], ref: string, title: BiText, level: number, adv: string[], change: EvidenceChange) => {
    const after = previewEvidence(r, change);
    const d = deltaOf(r, after);
    if (d.overall <= 0 && !d.families.some((x) => x.delta > 0)) return;
    const fam = d.families.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta || cmp(a.tech_id, b.tech_id));
    const reasons: Reason[] = [
      kind === 'practice' ? m21Reason('act_practice', { skill: title, level, n: adv.length }) : m21Reason(kind === 'course' ? 'act_course' : 'act_track', { level, n: adv.length }),
      ...fam.slice(0, 3).map((x) => m21Reason('act_family', { pts: x.delta, tech: lab(L.techs, x.tech_id) }, undefined, x.delta)),
    ];
    const best = fam[0]?.delta ?? 0;
    out.push({ id: `${kind}:${ref}`, score: Math.round((d.overall * 1000 + best) * 100) / 100, reasons, item: { kind, ref, title, level, adv_skill_ids: adv, change, delta: d.overall, families: d.families, after } });
  };
  for (const a of learningActions(r)) {
    if (a.kind === 'course' ? doneC.has(a.ref) : doneT.has(a.ref)) continue;
    const level = a.kind === 'track' ? 1 : Math.max(1, ...r.families.flatMap((f) => f.items.flatMap((i) => i.learn_opts.filter((o) => o.course_id === a.ref).map((o) => o.course_level ?? 1))));
    push(a.kind, a.ref, lab(a.kind === 'course' ? L.courses : L.tracks, a.ref), level, a.adv_skill_ids, a.kind === 'course' ? { courses: [a.ref] } : { tracks: [a.ref] });
  }
  const practice = new Map<string, Set<string>>();
  for (const f of r.families) for (const it of f.items) if (it.d3 < 2) for (const sk of it.direct_opts) (practice.get(sk) ?? practice.set(sk, new Set()).get(sk)!).add(it.adv_skill_id);
  const pr: Ranked<RaiseAction>[] = [];
  const keep = out.length;
  for (const [sk, adv] of [...practice.entries()].sort(([a], [b]) => cmp(a, b))) push('practice', sk, lab(L.skills, sk), 2, [...adv].sort(cmp), { skills: [{ skill_id: sk, level: 2 }] });
  pr.push(...out.splice(keep));
  pr.sort((a, b) => b.score - a.score || cmp(a.id, b.id));
  out.sort((a, b) => b.score - a.score || cmp(a.id, b.id));
  return [...out, ...pr.slice(0, opts.practice ?? 3)];
}

/** The F09 shape of a v2 family, so the bridge plan, resource ranking and concept roles keep working on readiness v2. */
export function toV1Family(f: RV2Family, reasons: Reason[] = familyReasonsV2(f)): FamilyReadiness {
  const counts: Record<Relation, number> = { transfers: 0, adapts: 0, new: 0 };
  const items: ReadinessItem[] = f.items.map((i) => {
    if (i.relation in counts) counts[i.relation as Relation] += 1;
    const level = Math.max(i.carry_level, i.direct_level, i.learn_level);
    return { adv_skill_id: i.adv_skill_id, relation: i.relation, level, via: i.carry_via ?? i.direct_via, basis: null, factor: factorOf(i.relation), credit: i.bp / 10000 };
  });
  return { tech_id: f.tech_id, index: f.index, ceiling: f.learn_ceiling, n: f.n, counts, items, reasons };
}
/** My level per ADVANCE skill under v2 (the best of carry, direct and learning), for the concept-role ranking. */
export function v2Levels(r: RV2): Map<string, AdvLevel> {
  const m = new Map<string, AdvLevel>();
  for (const f of r.families) for (const i of f.items) m.set(i.adv_skill_id, { level: Math.max(i.carry_level, i.direct_level, i.learn_level), via: i.carry_via ?? i.direct_via, basis: null });
  return m;
}
export const pointsOf = (it: RV2Item, n: number) => r1(it.bp / Math.max(1, n) / 100);
