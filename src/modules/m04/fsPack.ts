// FS19 Future-skills course pack: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261010232001_kafaa_fs32_course_pack_academies.sql (kafaa_fsc_copy_problems, kafaa_fsc_pack_problems).
// Import-free apart from types (node seed and validator scripts load it directly).
//
// Benchmarks: SMR-WF (cross-over courses for adjacent industries, an SMR delta per role), UAE-PEERS (AI learning whose output is a
// built artefact), ENTITLE (a credit unit and an hour envelope for every learning asset).
//
//  - The pack is about 18 modular courses (60 hours or less each) plus cross-over versions for adjacent industries. Each course states
//    its objectives as links to skills at a stated level (course_skill_links, level 1-3) and a weekly-hour envelope.
//  - A link is also the course's F01 evidence key on that skill (skills.evidence_keys), so a completion becomes F01 course evidence
//    through the existing derivation (level = min(key level, course cap)); this is how the explorer, the Coach and FS17 find the course.
//  - Copy and link check (every course; strict for the all-staff cyber hygiene course): no security-restricted wording, https links
//    only, and the cyber course may link only awareness-level public pages on an allow-list of hosts. Security-area skills are never
//    linked (security stays at career-path level).
//  - Every course carries sources with an as-of date and is marked SIMULATED (concept_content) while it is a demo outline.
//  - "Learning routes": a skill has a route when an active link teaches it; the pack must give each of the six skills that nobody
//    held before (audit baseline) at least one course.
import type { Reason } from '../../domain/engines/types';

export const FS_PACK_PROGRAMME = 'pg-fs-pack';
export const PACK_THEMES = ['data_ai', 'digital_plant', 'advanced_reactor', 'green', 'human', 'cyber'] as const;
export type PackTheme = (typeof PACK_THEMES)[number];
export const PACK_KINDS = ['core', 'crossover'] as const;
export const MAX_COURSE_HOURS = 60;
export const MAX_LINKS = 8;
export const LINK_LEVELS = [1, 2, 3] as const;
export const OBJECTIVE_MIN = 5;
export const OBJECTIVE_MAX = 200;
/** The six catalogue skills nobody held in the audit baseline (scratchpad audit, section 2.3). */
export const UNHELD_BASELINE = ['sk-pf-01-advfuel', 'sk-pf-02-advcool', 'sk-mp-01-remote', 'sk-ch-01-advchem', 'sk-ns-01-psa', 'sk-da-01-remote'] as const;

/** Wording a course, objective or capstone may never carry (CONTRACT section 1.3; superset of the FS10 item list). Lower case. */
export const RESTRICTED_TERMS = [
  'vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station',
  'access code', 'firewall rule', 'network diagram', 'ip address', 'scada password', 'plc password', 'default password', 'port number',
  'vlan', 'remote access configuration', 'penetration test', 'exploit', 'malware sample', 'vulnerability scan', 'security zone map',
  'clearance level', 'patrol route',
];
/** Hosts the all-staff cyber hygiene course may link: awareness-level public pages only. */
export const CYBER_LINK_HOSTS = ['www.iaea.org', 'iaea.org', 'niccs.cisa.gov', 'joint-research-centre.ec.europa.eu'];
/** URL path fragments that point at technical security detail (advisories, CVEs, exploit databases). Lower case. */
export const RESTRICTED_LINK_PARTS = ['exploit', 'vulnerab', 'advisor', 'cve-', 'ics-cert', 'pentest'];

export type CopyCode = 'restricted_term' | 'link_https' | 'link_host' | 'link_path';
export interface CopyProblem { code: CopyCode; detail: string }

const hostOf = (url: string) => { const m = /^[a-z]+:\/\/([^/:?#]+)/i.exec(url.trim()); return m ? m[1].toLowerCase() : ''; };

/** The copy and link check. Same order and output as SQL kafaa_fsc_copy_problems(theme, texts, urls). */
export function copyProblems(theme: string, texts: (string | null | undefined)[], urls: (string | null | undefined)[]): CopyProblem[] {
  const out: CopyProblem[] = [];
  const blob = texts.map((x) => String(x ?? '').toLowerCase()).join(' \n ');
  for (const term of RESTRICTED_TERMS) if (blob.includes(term)) out.push({ code: 'restricted_term', detail: term });
  for (const raw of urls) {
    const u = String(raw ?? '').trim();
    if (!/^https:\/\//i.test(u)) { out.push({ code: 'link_https', detail: u }); continue; }
    const low = u.toLowerCase();
    const part = RESTRICTED_LINK_PARTS.find((p) => low.includes(p));
    if (part) out.push({ code: 'link_path', detail: u });
    else if (theme === 'cyber' && !CYBER_LINK_HOSTS.includes(hostOf(u))) out.push({ code: 'link_host', detail: u });
  }
  return out;
}

export interface PackCourseLite {
  id: string; title_en: string; title_ar: string; summary_en?: string | null; summary_ar?: string | null; duration_hours: number | null;
  sources?: { url?: string | null; label?: string | null; as_of?: string | null }[] | null; objectives?: { en?: string; ar?: string }[] | null; concept_content?: boolean | null;
}
export interface PackMetaLite { course_id: string; theme: string; kind: string; crossover_of?: string | null; weeks: number; weekly_hours: number; simulated?: boolean | null }
export interface SkillLinkLite { id?: string; course_id: string; skill_id: string; level: number; objective_en?: string | null; objective_ar?: string | null; active?: boolean | null }
export interface SkillRef { id: string; area: string; lifecycle?: string | null; fs_area?: string | null; name_en?: string; name_ar?: string; competency_id?: string | null }

/** Texts the copy check reads for one course: titles, summaries, objectives, module titles and link objectives. */
export function courseTexts(c: PackCourseLite, modules: { title_en?: string | null; title_ar?: string | null }[], links: SkillLinkLite[]): string[] {
  return [
    c.title_en, c.title_ar, c.summary_en ?? '', c.summary_ar ?? '',
    ...(c.objectives ?? []).flatMap((o) => [o.en ?? '', o.ar ?? '']),
    ...modules.flatMap((m) => [m.title_en ?? '', m.title_ar ?? '']),
    ...links.filter((l) => l.active !== false).flatMap((l) => [l.objective_en ?? '', l.objective_ar ?? '']),
  ];
}
export const courseUrls = (c: PackCourseLite) => (c.sources ?? []).map((s) => s.url ?? '');

export type PackCode = 'hours' | 'no_skill' | 'level' | 'no_source' | 'source_as_of' | 'crossover' | 'security_skill' | 'obsolete_skill' | 'not_simulated' | 'envelope';
/** Acceptance problems for one pack course (empty = publishable). */
export function packProblems(c: PackCourseLite, meta: PackMetaLite, links: SkillLinkLite[], skills: Map<string, SkillRef>): PackCode[] {
  const out: PackCode[] = [];
  const h = Number(c.duration_hours);
  if (!Number.isFinite(h) || h <= 0 || h > MAX_COURSE_HOURS) out.push('hours');
  const act = links.filter((l) => l.active !== false && l.course_id === c.id);
  if (!act.length) out.push('no_skill');
  if (act.some((l) => !(LINK_LEVELS as readonly number[]).includes(Number(l.level)))) out.push('level');
  const src = c.sources ?? [];
  if (!src.length) out.push('no_source');
  if (src.some((s) => !s.as_of)) out.push('source_as_of');
  if (meta.kind === 'crossover' && !meta.crossover_of) out.push('crossover');
  if (act.some((l) => skills.get(l.skill_id)?.area === 'security')) out.push('security_skill');
  if (act.some((l) => skills.get(l.skill_id)?.lifecycle === 'obsolete')) out.push('obsolete_skill');
  if (!c.concept_content || meta.simulated === false) out.push('not_simulated');
  if (!(meta.weekly_hours > 0) || !(meta.weeks > 0) || meta.weeks * meta.weekly_hours + 1e-9 < h) out.push('envelope');
  return out;
}

export interface LearningRoute { skill_id: string; holders: number; courses: { course_id: string; level: number }[]; unheld: boolean; baseline_unheld: boolean }
/** Skills with the courses that teach them and how many people hold them (any active state above 0). */
export function learningRoutes(skills: SkillRef[], states: { skill_id: string; level: number; active?: boolean | null }[], links: SkillLinkLite[]): LearningRoute[] {
  const count = new Map<string, number>();
  for (const s of states) if (s.active !== false && Number(s.level) > 0) count.set(s.skill_id, (count.get(s.skill_id) ?? 0) + 1);
  const by = new Map<string, { course_id: string; level: number }[]>();
  for (const l of links) if (l.active !== false) (by.get(l.skill_id) ?? by.set(l.skill_id, []).get(l.skill_id)!).push({ course_id: l.course_id, level: Number(l.level) });
  const base = new Set<string>(UNHELD_BASELINE);
  return skills.filter((s) => s.lifecycle !== 'obsolete' && s.area !== 'security').map((s) => ({
    skill_id: s.id, holders: count.get(s.id) ?? 0, courses: (by.get(s.id) ?? []).sort((a, b) => a.level - b.level || (a.course_id < b.course_id ? -1 : 1)),
    unheld: !(count.get(s.id) ?? 0), baseline_unheld: base.has(s.id),
  }));
}

export interface PackCoverage { baseline: number; baselineCovered: number; future: number; futureCovered: number; unheldNow: number; unheldCovered: number; uncovered: string[] }
export function packCoverage(routes: LearningRoute[], skills: Map<string, SkillRef>): PackCoverage {
  const fut = routes.filter((r) => skills.get(r.skill_id)?.fs_area);
  const base = routes.filter((r) => r.baseline_unheld);
  const un = routes.filter((r) => r.unheld);
  return {
    baseline: base.length, baselineCovered: base.filter((r) => r.courses.length).length,
    future: fut.length, futureCovered: fut.filter((r) => r.courses.length).length,
    unheldNow: un.length, unheldCovered: un.filter((r) => r.courses.length).length,
    uncovered: fut.filter((r) => !r.courses.length).map((r) => r.skill_id).sort(),
  };
}

// ───────────── "For me": rank pack courses against my gaps today and in my role's 2030 profile (FS05), with reasons
export interface Requirement { kind: string; ref_id: string; level: number; horizon: 'now' | '2030' }
export interface PackPick { course_id: string; score: number; reasons: Reason[]; gaps: number; status: 'open' | 'enrolled' | 'completed' }
const R = (code: string, vars?: Reason['vars'], ref?: Reason['ref'], weight?: number): Reason => ({ code, key: `m04.fsc.why.${code}`, vars, ref, weight });
/** Weight of a gap by horizon: today's role gaps count fully, 2030 gaps at 0.8 (they still need closing, a little later). */
export const HORIZON_WEIGHT = { now: 1, '2030': 0.8 } as const;
export function packForMe(
  courses: PackCourseLite[], metas: PackMetaLite[], links: SkillLinkLite[], reqs: Requirement[], myLevel: (skillId: string) => number,
  skills: Map<string, SkillRef>, routes: Map<string, LearningRoute>, done: Set<string>, open: Set<string>,
): PackPick[] {
  const meta = new Map(metas.map((m) => [m.course_id, m]));
  const need = new Map<string, { level: number; horizon: 'now' | '2030' }>();
  for (const r of reqs) {
    if (r.kind !== 'skill') continue;
    const cur = need.get(r.ref_id);
    if (!cur || r.level > cur.level || (r.level === cur.level && r.horizon === 'now')) need.set(r.ref_id, { level: Number(r.level), horizon: r.horizon });
  }
  const out: PackPick[] = [];
  for (const c of courses) {
    const m = meta.get(c.id);
    if (!m || m.kind !== 'core') continue;
    const reasons: Reason[] = [];
    let score = 0;
    let gaps = 0;
    for (const l of links.filter((x) => x.course_id === c.id && x.active !== false).sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1))) {
      const sk = skills.get(l.skill_id);
      const name = { en: sk?.name_en ?? l.skill_id, ar: sk?.name_ar ?? l.skill_id };
      const n = need.get(l.skill_id);
      const have = myLevel(l.skill_id);
      if (n && have < n.level) {
        const w = HORIZON_WEIGHT[n.horizon] * Math.min(Number(l.level), n.level - have);
        score += w;
        gaps++;
        reasons.push(R(n.horizon === 'now' ? 'gapNow' : 'gap2030', { skill: name, need: n.level, have, level: Number(l.level) }, { table: 'skills', id: l.skill_id }, w));
      }
      if (routes.get(l.skill_id)?.unheld) { score += 0.1; reasons.push(R('unheld', { skill: name }, { table: 'skills', id: l.skill_id }, 0.1)); }
    }
    if (!gaps) continue;
    reasons.push(R('envelope', { hours: Number(c.duration_hours), weeks: m.weeks, weekly: m.weekly_hours }));
    const status = done.has(c.id) ? 'completed' : open.has(c.id) ? 'enrolled' : 'open';
    if (status !== 'open') reasons.push(R(status));
    out.push({ course_id: c.id, score: Math.round(score * 100) / 100, reasons, gaps, status });
  }
  return out.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.score - a.score || (a.course_id < b.course_id ? -1 : 1));
}
