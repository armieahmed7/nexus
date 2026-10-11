/**
 * F13 skills-based mentor matching, ranked by the F02 kernel with reasons for <WhyThis>. Pure (pages and tests).
 *
 *   skills      byGapClosure over my competency gaps (current role weight 1.0, shortlisted targets 0.6): every skill a mentor
 *               offers closes the gap on its competency up to level 3, or the level the mentor's own role requires, or level 4
 *               for an SME's nominated skills; normalised 0..1
 *   target      the mentor works in one of my target roles (1) or in my current role (0.5)
 *   development type fit (0.5), free capacity (0.25) and reporting line (0.25: outside my reporting line 1, skip-level 0.4)
 *   score = w.skills × skills + w.target × target + w.development × development (F02 "match" weights, default 0.7 / 0.1 / 0.2)
 *
 * Never suggested: my own offer, a mentor who is not opted in, my line manager (excluded with reason own_manager; mentoring works
 * across reporting lines), and a mentor I already have an open request or agreement with. Full mentors are listed separately.
 * Humans still decide: a suggestion is only a suggestion; the mentor accepts or declines every request.
 */
import { byGapClosure, DEFAULT_MATCH, type GapNeed } from '../../domain/engines/rank';
import type { BiText, Ranked, Reason, Weights } from '../../domain/engines/types';
import { MENTOR_LEVEL, SME_LEVEL, freePlaces, isSecuritySkill, type MentorRowLite, type MentoringType, type RequestLite, type SkillLite } from './mentoring';

export const rr = (code: string, vars?: Reason['vars'], weight?: number): Reason => ({ code, key: `m04.reasons.${code}`, vars, weight });
const r4 = (x: number) => Math.round(x * 10000) / 10000;

export interface MatchInput<M extends MentorRowLite = MentorRowLite> {
  me: string;
  roleId: string | null;
  targets: string[];
  /** competency -> my level (F01 states through SkillsEngine.competencyLevels) */
  have: Map<string, number>;
  roleComps: { role_id: string; competency_id: string; required_level: number; importance: string }[];
  competencies: { id: string; name_en: string; name_ar: string }[];
  roles: { id: string; title_en: string; title_ar: string; job_family_id?: string | null }[];
  skills: SkillLite[];
  mentors: M[];
  requests: RequestLite[];
  /** Agreements I am part of, still in force (proposed/active/closing) */
  openWithMentorIds?: string[];
  lineManager: string | null;
  chain: string[];
  type?: MentoringType | '';
  focusSkillIds?: string[];
  weights?: Weights;
}
export interface MentorMatch<M extends MentorRowLite = MentorRowLite> {
  mentor: M;
  free: number;
  gapSkills: string[];
}
export interface MatchResult<M extends MentorRowLite = MentorRowLite> {
  ranked: Ranked<MentorMatch<M>>[];
  full: Ranked<MentorMatch<M>>[];
  excluded: { mentor: M; code: 'own_manager' | 'already_open' }[];
  needs: GapNeed[];
}

export function rankMentors<M extends MentorRowLite>(input: MatchInput<M>): MatchResult<M> {
  const ws = { ...DEFAULT_MATCH, ...(input.weights ?? {}) } as Record<string, number>;
  const compLabel = new Map(input.competencies.map((c) => [c.id, { en: c.name_en, ar: c.name_ar } as BiText]));
  const role = new Map(input.roles.map((r) => [r.id, r]));
  const roleLabel = (id: string): BiText => ({ en: role.get(id)?.title_en ?? id, ar: role.get(id)?.title_ar || role.get(id)?.title_en || id });
  const skills = new Map(input.skills.map((s) => [s.id, s]));
  // needs: my current role (1.0) and shortlisted targets (0.6)
  const needs: GapNeed[] = [];
  const addNeeds = (roleId: string, weight: number) => {
    for (const rc of input.roleComps.filter((x) => x.role_id === roleId)) {
      const have = input.have.get(rc.competency_id) ?? 0;
      if (have >= rc.required_level) continue;
      needs.push({ key: rc.competency_id, need: rc.required_level, have, importance: (['core', 'important', 'useful'].includes(rc.importance) ? rc.importance : 'useful') as GapNeed['importance'], weight, label: compLabel.get(rc.competency_id), role: roleLabel(roleId) });
    }
  };
  if (input.roleId) addNeeds(input.roleId, ws.current_role ?? 1);
  for (const t of input.targets.filter((x) => x !== input.roleId)) addNeeds(t, ws.target_role ?? 0.6);
  const focus = new Set(input.focusSkillIds ?? []);
  const focusComps = new Set([...focus].map((s) => skills.get(s)?.competency_id).filter(Boolean) as string[]);
  // focus skills I picked count as a need even when my role does not require them (current-role weight, up to level 3)
  for (const c of focusComps) if (!needs.some((n) => n.key === c)) needs.push({ key: c, need: MENTOR_LEVEL, have: input.have.get(c) ?? 0, importance: 'important', weight: ws.current_role ?? 1, label: compLabel.get(c) });

  const open = new Set([...input.requests.filter((r) => r.person_id === input.me && ['requested', 'matched'].includes(r.status)).map((r) => r.mentor_id), ...(input.openWithMentorIds ?? [])]);
  const excluded: MatchResult<M>['excluded'] = [];
  const pool: M[] = [];
  for (const m of input.mentors) {
    if (!m.opt_in || m.person_id === input.me) continue;
    if (input.lineManager && m.person_id === input.lineManager) { excluded.push({ mentor: m, code: 'own_manager' }); continue; }
    if (open.has(m.id)) { excluded.push({ mentor: m, code: 'already_open' }); continue; }
    pool.push(m);
  }
  // A mentor offers a skill at practitioner level (3), at the level their own role requires (an SRO teaches SRO-level reactivity
  // management), and at expert level (4) for an SME's nominated skills.
  const gives = (m: MentorRowLite) => {
    const sme = new Set(m.sme ? (m.sme_skill_ids?.length ? m.sme_skill_ids : m.skill_ids) ?? [] : []);
    const roleLevel = new Map(input.roleComps.filter((rc) => rc.role_id === m.role_id).map((rc) => [rc.competency_id, rc.required_level]));
    const best = new Map<string, number>();
    for (const sid of m.skill_ids ?? []) {
      const s = skills.get(sid);
      if (!s || isSecuritySkill(s)) continue;
      const lvl = sme.has(sid) ? SME_LEVEL : Math.max(MENTOR_LEVEL, Math.min(SME_LEVEL, roleLevel.get(s.competency_id) ?? 0));
      best.set(s.competency_id, Math.max(best.get(s.competency_id) ?? 0, lvl));
    }
    return [...best.entries()].map(([key, level]) => ({ key, level }));
  };
  const gap = byGapClosure(pool.map((m) => ({ id: m.id, effortHours: null, gives: gives(m), item: m })), needs, input.weights);
  const gapById = new Map(gap.map((g) => [g.id, g]));
  const maxGap = Math.max(0, ...gap.map((g) => g.score));
  const out: Ranked<MentorMatch<M>>[] = [];
  for (const m of pool) {
    const g = gapById.get(m.id);
    const skillsScore = g && maxGap > 0 ? g.score / maxGap : 0;
    const reasons: Reason[] = [...(g?.reasons ?? []).slice(0, 3)];
    const gapComps = new Set(needs.map((n) => n.key));
    const gapSkills = (m.skill_ids ?? []).filter((s) => gapComps.has(skills.get(s)?.competency_id ?? ''));
    const hitFocus = (m.skill_ids ?? []).filter((s) => focus.has(s));
    if (hitFocus.length) reasons.unshift(rr('focus_skill', { skills: joinBi(hitFocus.map((s) => skillLabel(skills.get(s)))) }, 1));
    // target-role alignment
    let target = 0;
    if (m.role_id && input.targets.includes(m.role_id)) { target = 1; reasons.push(rr('mentor_target_role', { role: roleLabel(m.role_id) }, ws.target)); }
    else if (m.role_id && m.role_id === input.roleId) { target = 0.5; reasons.push(rr('mentor_same_role', { role: roleLabel(m.role_id) }, ws.target * 0.5)); }
    // development fit: type, capacity, reporting line
    const free = freePlaces(m, input.requests);
    const typeFit = input.type ? ((m.types ?? []).includes(input.type) ? 1 : 0) : (m.types?.length ? 0.5 : 0);
    if (input.type && typeFit) reasons.push(rr('mentor_type', { type: typeLabel(input.type) }));
    const line = input.chain.includes(m.person_id) ? 0.4 : 1;
    reasons.push(line === 1 ? rr('different_line') : rr('skip_level'));
    if (m.sme) reasons.push(rr('sme', { skills: joinBi(((m.sme_skill_ids?.length ? m.sme_skill_ids : m.skill_ids) ?? []).slice(0, 3).map((s) => skillLabel(skills.get(s)))) }));
    if (m.khnp_paired) reasons.push(rr('khnp_paired'));
    reasons.push(rr(free > 0 ? 'capacity' : 'capacity_full', { n: free, cap: m.capacity }));
    const dev = 0.5 * typeFit + 0.25 * (m.capacity > 0 ? free / m.capacity : 0) + 0.25 * line;
    const ktBonus = input.type === 'knowledge_transfer' && m.sme ? 0.1 : 0;
    const focusBonus = hitFocus.length ? 0.15 * Math.min(1, hitFocus.length / Math.max(1, focus.size)) : 0;
    const score = r4((ws.skills ?? 0.7) * skillsScore + (ws.target ?? 0.1) * target + (ws.development ?? 0.2) * dev + ktBonus + focusBonus);
    out.push({ id: m.id, score, reasons, item: { mentor: m, free, gapSkills } });
  }
  out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return { ranked: out.filter((x) => x.item!.free > 0), full: out.filter((x) => x.item!.free === 0), excluded, needs };
}

const skillLabel = (s: SkillLite | undefined): BiText => ({ en: s?.name_en ?? s?.id ?? '', ar: s?.name_ar || s?.name_en || s?.id || '' });
const joinBi = (xs: BiText[]): BiText => ({ en: xs.map((x) => x.en).join(', '), ar: xs.map((x) => x.ar).join('، ') });
const TYPE_LABEL: Record<MentoringType, BiText> = {
  career: { en: 'career', ar: 'المسار المهني' },
  knowledge_transfer: { en: 'knowledge transfer', ar: 'نقل المعرفة' },
  leadership: { en: 'leadership', ar: 'القيادة' },
  reverse: { en: 'reverse (digital and AI)', ar: 'العكسي (الرقمي والذكاء الاصطناعي)' },
  peer_onboarding: { en: 'peer onboarding', ar: 'تأهيل الأقران' },
};
export const typeLabel = (t: MentoringType): BiText => TYPE_LABEL[t];
