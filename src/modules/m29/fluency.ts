// FS09 AI Fluency Ladder: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql (kafaa_ai_rung). Import-free apart from types (node seed and validator
// scripts load it directly).
//
// Benchmarks: UNESCO AI Competency Frameworks (2024) and the EU AI Act Article 4 AI-literacy repository (four dimensions: human-centred
// mindset, ethics, techniques and applications, AI system design; progression that spirals through the same dimensions at deeper
// levels); DigComp 2.2/3.0 (proficiency ladder with work examples); LinkedIn Economic Graph (AI literacy kept apart from AI engineering);
// UAE National AI Strategy 2031 / DGE AiNative (a dated AI-capability target, shown as a leadership parameter).
//
//  - Four rungs (1 Aware, 2 Practitioner, 3 Builder, 4 Assurer) x four dimensions = 16 cells (kafaa_ai_rungs). A cell names the
//    literacy skills that evidence it and the minimum level (F01 person skill state).
//  - A cell is met when the person holds an active, not self-claimed state at or above the cell's minimum level on one of its skills, counting only
//    skills whose track is `literacy` (kafaa_ai_skill_tracks). AI-engineering skills (data engineering, automation design, scripting,
//    twin modelling) are shown separately and never raise the literacy rung, whatever is written in a cell.
//  - The rung is the highest r such that every dimension is met at every rung from 1 to r (spiral: each rung revisits all four
//    dimensions at a deeper level). Rung 0 means "not yet on the ladder".
//  - Reasons: the rung; every met cell up to the next rung, pointing at the evidence row behind the state; every gap on the next rung;
//    and a note when AI-engineering skills were left out.
//  - Role targets per job family: a rung plus, optionally, single cells from a higher rung (operators: Practitioner plus the
//    verification cell of Assurer). Target met = rung >= target rung and every extra cell met.
//  - No points, streaks or leaderboards: the ladder describes evidence, it does not score people against each other.
import type { Reason } from '../../domain/engines/types';

export const DIMENSIONS = ['mindset', 'ethics', 'techniques', 'design'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const RUNG_KEYS = ['aware', 'practitioner', 'builder', 'assurer'] as const;
export type RungKey = (typeof RUNG_KEYS)[number];
export const MAX_RUNG = 4;
export const MAX_SKILL_LEVEL = 4;
export const TRACKS = ['literacy', 'engineering'] as const;
export type Track = (typeof TRACKS)[number];
/** Practitioner: the rung the organisation indicator counts ("at Practitioner or above"). */
export const PRACTITIONER = 2;

export interface RungCell {
  id: string;
  rung: number;
  dimension: Dimension | string;
  skill_ids: string[];
  min_level: number;
}
export interface SkillTrackRow { skill_id: string; track: Track | string }
export interface StateLite { skill_id: string; level: number; active?: boolean; basis?: string | null; reasons?: { evidence_id?: string | null }[] | null }
export interface RoleTarget { family_id: string; rung: number; plus_cells: string[] }

export interface CellResult {
  id: string;
  rung: number;
  dimension: string;
  met: boolean;
  /** Highest literacy level held on the cell's skills (0 when none). */
  have: number;
  /** The skill that meets the cell (null when not met). */
  skill_id: string | null;
  level: number | null;
  evidence_id: string | null;
}
export interface AiRungResult {
  rung: number;
  cells: CellResult[];
  next: { rung: number; missing: string[] } | null;
  engineering: { skill_id: string; level: number }[];
  reasons: Reason[];
}

const dimIdx = (d: string) => { const i = (DIMENSIONS as readonly string[]).indexOf(d); return i < 0 ? 99 : i; };
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const cellId = (rung: number, dim: string) => `air:${rung}:${dim}`;
export const rungKey = (rung: number): RungKey | 'none' => (rung >= 1 && rung <= MAX_RUNG ? RUNG_KEYS[rung - 1] : 'none');
export const sortCells = <T extends Pick<RungCell, 'rung' | 'dimension' | 'id'>>(cells: T[]) =>
  [...cells].sort((a, b) => a.rung - b.rung || dimIdx(a.dimension) - dimIdx(b.dimension) || cmp(a.id, b.id));

/** The literacy rung of one person from their skill states (F01 person_skills of that person). Mirrored by SQL kafaa_ai_rung. */
export function aiRung(personId: string, cells: RungCell[], tracks: SkillTrackRow[], states: StateLite[]): AiRungResult {
  const track = new Map(tracks.map((t) => [t.skill_id, t.track]));
  const held = new Map<string, StateLite>();
  // Self-ratings alone (basis claimed) never move anyone up the ladder.
  for (const s of states) if (s.active !== false && Number(s.level) > 0 && s.basis !== 'claimed') held.set(s.skill_id, s);
  const lv = (sid: string) => Number(held.get(sid)?.level ?? 0);
  const sorted = sortCells(cells);
  const results: CellResult[] = sorted.map((c) => {
    const lit = (c.skill_ids ?? []).map((s, i) => ({ s, i, l: lv(s) })).filter((x) => track.get(x.s) === 'literacy');
    const have = lit.reduce((m, x) => Math.max(m, x.l), 0);
    const best = lit.filter((x) => x.l >= c.min_level).sort((a, b) => b.l - a.l || a.i - b.i)[0];
    const ev = best ? held.get(best.s)?.reasons?.[0]?.evidence_id ?? null : null;
    return { id: c.id, rung: c.rung, dimension: c.dimension, met: !!best, have, skill_id: best ? best.s : null, level: best ? best.l : null, evidence_id: ev };
  });
  let rung = 0;
  for (let r = 1; r <= MAX_RUNG; r++) {
    const at = results.filter((c) => c.rung === r);
    if (at.length === DIMENSIONS.length && at.every((c) => c.met)) rung = r; else break;
  }
  const engineering = [...held.values()].filter((s) => track.get(s.skill_id) === 'engineering')
    .map((s) => ({ skill_id: s.skill_id, level: Number(s.level) })).sort((a, b) => cmp(a.skill_id, b.skill_id));
  const reasons: Reason[] = [{ code: 'fs09_rung', key: 'm29.reason.rung', vars: { rung } }];
  const upto = Math.min(rung + 1, MAX_RUNG);
  for (const c of results) {
    if (!c.met || c.rung > upto) continue;
    reasons.push({
      code: 'fs09_cell_met', key: `m29.reason.met.${c.dimension}`, vars: { rung: c.rung, level: c.level ?? 0 },
      ref: c.evidence_id ? { table: 'skill_evidence', id: c.evidence_id } : { table: 'person_skills', id: `ps:${personId}:${c.skill_id}` },
    });
  }
  let next: AiRungResult['next'] = null;
  if (rung < MAX_RUNG) {
    const gaps = results.filter((c) => c.rung === rung + 1 && !c.met);
    for (const c of gaps) {
      const cell = sorted.find((x) => x.id === c.id)!;
      reasons.push({ code: 'fs09_cell_gap', key: `m29.reason.gap.${c.dimension}`, vars: { rung: c.rung, level: cell.min_level } });
    }
    next = { rung: rung + 1, missing: gaps.map((c) => c.id) };
  }
  if (engineering.length) reasons.push({ code: 'fs09_engineering', key: 'm29.reason.engineering', vars: { n: engineering.length } });
  return { rung, cells: results, next, engineering, reasons };
}

/** Target met: rung at or above the target rung and every extra cell met. Missing = unmet cells up to the target rung + extra cells. */
export function targetGap(res: Pick<AiRungResult, 'rung' | 'cells'>, target: Pick<RoleTarget, 'rung' | 'plus_cells'> | null | undefined): { met: boolean; missing: string[] } {
  if (!target) return { met: false, missing: [] };
  const plus = new Set(target.plus_cells ?? []);
  const missing = res.cells.filter((c) => !c.met && (c.rung <= target.rung || plus.has(c.id))).map((c) => c.id);
  const met = res.rung >= target.rung && [...plus].every((id) => res.cells.find((c) => c.id === id)?.met);
  return { met, missing };
}

/** Problems in a ladder definition (seed and admin guard): 16 cells, literacy skills only, levels 1-4 non-decreasing per dimension. */
export function ladderProblems(cells: RungCell[], tracks: SkillTrackRow[]): string[] {
  const out: string[] = [];
  const track = new Map(tracks.map((t) => [t.skill_id, t.track]));
  for (let r = 1; r <= MAX_RUNG; r++) for (const d of DIMENSIONS) {
    const c = cells.filter((x) => x.rung === r && x.dimension === d);
    if (c.length !== 1) { out.push(`cell ${r}/${d}: ${c.length} rows`); continue; }
    if (c[0].id !== cellId(r, d)) out.push(`cell ${r}/${d}: id ${c[0].id}`);
    if (!c[0].skill_ids?.length) out.push(`${c[0].id}: no skill`);
    for (const s of c[0].skill_ids ?? []) if (track.get(s) !== 'literacy') out.push(`${c[0].id}: ${s} is not a literacy skill`);
    if (!Number.isInteger(c[0].min_level) || c[0].min_level < 1 || c[0].min_level > MAX_SKILL_LEVEL) out.push(`${c[0].id}: min_level`);
  }
  for (const d of DIMENSIONS) {
    const lv = [1, 2, 3, 4].map((r) => cells.find((x) => x.rung === r && x.dimension === d)?.min_level ?? 0);
    for (let i = 1; i < lv.length; i++) if (lv[i] < lv[i - 1]) out.push(`${d}: min_level decreases at rung ${i + 1}`);
  }
  return out;
}

export interface RungStatsInput { person_id: string; family_id: string | null; rung: number; target_met: boolean }
export interface RungStats {
  staff: number;
  distribution: { rung: number; n: number | null }[];
  practitioner: { n: number | null; pct: number | null };
  target: { n: number | null; pct: number | null };
  by_family: { family_id: string; n: number | null; pct_practitioner: number | null; pct_target: number | null }[];
}
/** Families never broken out in aggregates (career-path level only). */
export const RESTRICTED_FAMILIES = ['security', 'safeguards', 'cyber'];
const pct1 = (a: number, b: number) => (b > 0 ? Math.floor((1000 * a) / b + 0.5) / 10 : 0);
/** HR aggregate of rungs (suppressed under minGroup: a cell naming fewer people than minGroup is null). Mirrored by SQL. */
export function rungStats(rows: RungStatsInput[], minGroup: number): RungStats {
  const n = rows.length;
  const sup = (v: number) => (v >= minGroup ? v : null);
  const ok = n >= minGroup;
  const prac = rows.filter((r) => r.rung >= PRACTITIONER).length;
  const tgt = rows.filter((r) => r.target_met).length;
  const fams = [...new Set(rows.map((r) => r.family_id ?? '').filter((f) => f && !RESTRICTED_FAMILIES.includes(f)))].sort(cmp);
  return {
    staff: n,
    distribution: [0, 1, 2, 3, 4].map((r) => ({ rung: r, n: ok ? sup(rows.filter((x) => x.rung === r).length) : null })),
    practitioner: { n: ok ? sup(prac) : null, pct: ok ? pct1(prac, n) : null },
    target: { n: ok ? sup(tgt) : null, pct: ok ? pct1(tgt, n) : null },
    by_family: fams.map((f) => {
      const g = rows.filter((r) => r.family_id === f);
      const big = g.length >= minGroup;
      return { family_id: f, n: big ? g.length : null, pct_practitioner: big ? pct1(g.filter((r) => r.rung >= PRACTITIONER).length, g.length) : null, pct_target: big ? pct1(g.filter((r) => r.target_met).length, g.length) : null };
    }),
  };
}
