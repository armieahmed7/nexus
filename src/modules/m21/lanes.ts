/**
 * FS14 Horizon lanes 2.0: eleven trend lanes (now / next / later) placed against dated, sourced ENEC and UAE milestones. Each lane
 * lists its FS02 future skills, catalogue courses, ADVANCE tracks, training pathways, learning resources and open gigs
 * (kafaa_horizon_lane_links), and cites at least three public sources with as-of dates. Import-free (seed builder and validator
 * load it in node); the SQL checks are kafaa_horizon_lanes_fs14_ck and the PGlite validator scripts/validate/fs24-future-readiness.mjs.
 */

export const LANE_HORIZONS = { now: [2026, 2028], next: [2029, 2031], later: [2032, 2035] } as const;
export type LaneHorizon = keyof typeof LANE_HORIZONS;
export const LANE_LINK_KINDS = ['skill', 'course', 'track', 'pathway', 'resource', 'gig'] as const;
export type LaneLinkKind = (typeof LANE_LINK_KINDS)[number];
export const MIN_LANE_SOURCES = 3;

export interface LaneSource { id?: string; label: string; url: string; as_of?: string | null }
export interface LaneRow { id: string; code: string; horizon: string; kind?: string; skill_ids: string[]; milestone_ids?: string[]; sources: LaneSource[]; sort?: number }
export interface LaneLink { id: string; lane_id: string; kind: string; ref_id: string; level?: number | null; sort?: number }
export interface Milestone { id: string; year: number; month?: number | null; kind: string; sources: LaneSource[] }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const linkId = (lane: string, kind: string, ref: string) => `hl:${lane}:${kind}:${ref}`;

/** The horizon a year falls in (before 2026 counts as "now": it has already happened). */
export function horizonOfYear(year: number): LaneHorizon {
  return year <= LANE_HORIZONS.now[1] ? 'now' : year <= LANE_HORIZONS.next[1] ? 'next' : 'later';
}

/** Problems with one lane: fewer than three sources, a source without https or as-of date, an unknown horizon. Empty = publishable. */
export function laneProblems(l: LaneRow): string[] {
  const p: string[] = [];
  if (!(l.horizon in LANE_HORIZONS)) p.push('horizon');
  const src = Array.isArray(l.sources) ? l.sources : [];
  if (src.length < MIN_LANE_SOURCES) p.push('sources');
  if (src.some((s) => !/^https:\/\//.test(s?.url ?? ''))) p.push('https');
  if (src.some((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s?.as_of ?? ''))) p.push('as_of');
  if (new Set(src.map((s) => s?.url)).size !== src.length) p.push('duplicate_source');
  return p;
}

/** Links of one lane grouped by kind, in display order. */
export function linksOf(links: LaneLink[], laneId: string): Record<LaneLinkKind, LaneLink[]> {
  const out = Object.fromEntries(LANE_LINK_KINDS.map((k) => [k, [] as LaneLink[]])) as Record<LaneLinkKind, LaneLink[]>;
  for (const l of links) if (l.lane_id === laneId && (LANE_LINK_KINDS as readonly string[]).includes(l.kind)) out[l.kind as LaneLinkKind].push(l);
  for (const k of LANE_LINK_KINDS) out[k].sort((a, b) => (Number(a.sort ?? 0) - Number(b.sort ?? 0)) || cmp(a.ref_id, b.ref_id));
  return out;
}

export interface GigLite { id: string; status: string; listed?: boolean | null; end_on?: string | null; start_on?: string | null }
/** Open gigs of a lane: linked opportunities that are open and listed (closed or filled ones are never shown as open). */
export function openGigs<G extends GigLite>(links: LaneLink[], laneId: string, gigs: G[]): G[] {
  const ids = new Set(linksOf(links, laneId).gig.map((l) => l.ref_id));
  return gigs.filter((g) => ids.has(g.id) && g.status === 'open' && g.listed !== false).sort((a, b) => cmp(a.id, b.id));
}

export interface LaneSkillLite { id: string; area: string; fs_area?: string | null }
export interface LaneStateLite { skill_id: string; level: number; active?: boolean | null }
export interface LaneSkillLevel { skill_id: string; level: number; future: boolean; security: boolean; qualified: boolean }
/**
 * My level on a lane (0-4): mean over its non-security skills, today's skills (skill_ids) and its FS02 future skills (links of kind
 * skill). Security-area skills show qualified / not qualified only and never enter the mean.
 */
export function laneLevel2(lane: { id: string; skill_ids: string[] }, links: LaneLink[], skills: LaneSkillLite[], states: LaneStateLite[]): { level: number | null; items: LaneSkillLevel[] } {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const mine = new Map<string, number>();
  for (const s of states) if (s.active !== false && s.level > 0) mine.set(s.skill_id, Math.max(mine.get(s.skill_id) ?? 0, s.level));
  const ids = [...lane.skill_ids, ...linksOf(links, lane.id).skill.map((l) => l.ref_id)].filter((id, i, a) => byId.has(id) && a.indexOf(id) === i);
  const items = ids.map((id) => {
    const s = byId.get(id)!;
    const security = s.area === 'security';
    const lv = mine.get(id) ?? 0;
    return { skill_id: id, level: security ? 0 : lv, future: !!s.fs_area, security, qualified: lv > 0 };
  });
  const scored = items.filter((i) => !i.security);
  return { level: scored.length ? Math.round((10 * scored.reduce((s, i) => s + i.level, 0)) / scored.length) / 10 : null, items };
}

/** Milestones of a lane ordered by date, with the horizon each falls in. */
export function laneMilestones<M extends Milestone>(lane: { milestone_ids?: string[] }, milestones: M[]): (M & { horizon: LaneHorizon })[] {
  const ids = new Set(lane.milestone_ids ?? []);
  return milestones.filter((m) => ids.has(m.id)).map((m) => ({ ...m, horizon: horizonOfYear(m.year) })).sort((a, b) => a.year - b.year || Number(a.month ?? 0) - Number(b.month ?? 0) || cmp(a.id, b.id));
}

/** Position (0-1) of a date on the roadmap axis from 2023 to 2036, for the swimlane timeline. */
export const AXIS = { from: 2023, to: 2036 } as const;
export function axisPos(year: number, month?: number | null): number {
  const x = year + ((month ?? 7) - 1) / 12;
  return Math.max(0, Math.min(1, (x - AXIS.from) / (AXIS.to - AXIS.from)));
}
