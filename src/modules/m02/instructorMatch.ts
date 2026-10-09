/**
 * F31 SME finder: ranks colleagues who could teach a qualification standard. Deterministic, explainable, F02-shaped (Ranked + reasons
 * for <WhyThis>), and never uses a personal attribute (age, gender, nationality) as an input.
 *   fit     mean over the standard's skills of min(level, 3) / 3, from the F01 skill state (person_skills)
 *   sme     1 when the person has an F21 subject-matter-expert profile or is an F13 SME mentor
 *   tenure  min(years of service / 10, 1)
 * score = 0.6 fit + 0.25 sme + 0.15 tenure. People already on the track, leavers, non-staff and security, cyber and safeguards families
 * are left out; a candidate needs level 2 or more on at least one of the standard's skills.
 */
import type { BiText, Ranked, Reason } from '../../domain/engines/types';
import { RESTRICTED_FAMILIES, standardSkills, type SkillLite } from './instructors';

export const SME_WEIGHTS = { fit: 0.6, sme: 0.25, tenure: 0.15 };
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const R = (code: string, vars?: Reason['vars'], weight?: number, ref?: Reason['ref']): Reason => ({ code, key: `m02.reasons.${code}`, vars, weight, ref });

export interface CandidatePerson { id: string; kind?: string | null; status?: string | null; job_family_id?: string | null; hire_date?: string | null }
export interface CandidateState { person_id: string; skill_id: string; level: number; active?: boolean | null }
export interface SkillLabel extends SkillLite { name_en?: string; name_ar?: string }
export interface CandidateInput {
  standardIds: string[];
  skills: SkillLabel[];
  people: CandidatePerson[];
  states: CandidateState[];
  smeProfiles: { id?: string; person_id: string }[];
  smeMentors: { id?: string; person_id: string; sme?: boolean | null }[];
  onTrack: Set<string>;
  today: string;
}
export interface CandidateItem { person: CandidatePerson; fit: number; sme: number; tenure: number; levels: { skill_id: string; level: number }[] }

export function rankSmeCandidates(x: CandidateInput): Ranked<CandidateItem>[] {
  const target = standardSkills(x.standardIds, x.skills);
  if (!target.length) return [];
  const label = new Map(x.skills.map((s) => [s.id, { en: s.name_en ?? s.id, ar: s.name_ar ?? s.name_en ?? s.id } as BiText]));
  const byPerson = new Map<string, Map<string, number>>();
  for (const s of x.states) {
    if (s.active === false || !target.includes(s.skill_id)) continue;
    const m = byPerson.get(s.person_id) ?? new Map<string, number>();
    m.set(s.skill_id, Math.max(m.get(s.skill_id) ?? 0, Number(s.level) || 0));
    byPerson.set(s.person_id, m);
  }
  const profile = new Map(x.smeProfiles.map((p) => [p.person_id, p]));
  const mentor = new Map(x.smeMentors.filter((m) => m.sme).map((m) => [m.person_id, m]));
  const out: Ranked<CandidateItem>[] = [];
  for (const p of x.people) {
    if (p.kind !== 'staff' || p.status === 'leaver' || x.onTrack.has(p.id) || RESTRICTED_FAMILIES.includes(p.job_family_id ?? '')) continue;
    const lv = byPerson.get(p.id);
    if (!lv || ![...lv.values()].some((v) => v >= 2)) continue;
    const levels = target.map((k) => ({ skill_id: k, level: lv.get(k) ?? 0 }));
    const fit = r4(levels.reduce((a, l) => a + Math.min(l.level, 3) / 3, 0) / target.length);
    const prof = profile.get(p.id);
    const men = mentor.get(p.id);
    const sme = prof || men ? 1 : 0;
    const years = p.hire_date ? Math.max(0, Math.floor((Date.parse(`${x.today}T00:00:00Z`) - Date.parse(`${p.hire_date}T00:00:00Z`)) / (365.25 * 86_400_000))) : 0;
    const tenure = r4(Math.min(years / 10, 1));
    const reasons: Reason[] = [R('ins_fit', { have: levels.filter((l) => l.level >= 2).length, need: target.length }, r4(SME_WEIGHTS.fit * fit))];
    for (const l of [...levels].filter((l) => l.level >= 2).sort((a, b) => b.level - a.level || (a.skill_id < b.skill_id ? -1 : 1)).slice(0, 2))
      reasons.push(R('ins_level', { skill: label.get(l.skill_id) ?? { en: l.skill_id, ar: l.skill_id }, level: l.level }, undefined, { table: 'person_skills', id: `ps:${p.id}:${l.skill_id}` }));
    if (prof) reasons.push(R('ins_sme_profile', undefined, r4(SME_WEIGHTS.sme), { table: 'sme_profiles', id: prof.id ?? p.id }));
    else if (men) reasons.push(R('ins_sme_mentor', undefined, r4(SME_WEIGHTS.sme), { table: 'mentors', id: men.id ?? p.id }));
    reasons.push(R('ins_tenure', { years }, r4(SME_WEIGHTS.tenure * tenure)));
    out.push({ id: p.id, score: r4(SME_WEIGHTS.fit * fit + SME_WEIGHTS.sme * sme + SME_WEIGHTS.tenure * tenure), reasons, item: { person: p, fit, sme, tenure, levels } });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}
