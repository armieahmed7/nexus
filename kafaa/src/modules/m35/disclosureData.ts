/**
 * M35 · FS60: computeDisclosure() on table rows (LocalBackend raw tables, the seed builder, the PGlite validator and tests). Pure and
 * loadable by node (explicit .ts imports). The FS09 rung of every active staff member = aiRung (SQL kafaa_air_people); the FS50 board on
 * the period's last day = criticalBoard (SQL kafaa_crs_board_core).
 */
import { aiRung, type RungCell, type SkillTrackRow, type StateLite } from '../m29/fluency.ts';
import { boardInputFromTables, criticalBoard } from './critical.ts';
import { computeDisclosure, hcInputFromTables, periodBounds, type DisclosureValues, type RungLite } from './disclosure.ts';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** FS09 rungs of every active staff member, ordered by id (same as kafaa_air_people and the FS36 local helper). */
export function staffRungs(raw: (t: string) => Row[]): RungLite[] {
  const by = new Map<string, StateLite[]>();
  for (const s of raw('person_skills')) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
  const rc = raw('ai_rungs') as unknown as RungCell[];
  const tr = raw('ai_skill_tracks') as unknown as SkillTrackRow[];
  return raw('people').filter((p) => p.kind === 'staff' && p.status === 'active').sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    .map((p) => ({ person_id: p.id as string, rung: aiRung(p.id, rc, tr, by.get(p.id) ?? []).rung }));
}
/** computeDisclosure on table rows for one quarter (null when the period is malformed). */
export function disclosureFromTables(raw: (t: string) => Row[], period: string, rungs?: RungLite[]): DisclosureValues | null {
  const b = periodBounds(period);
  if (!b) return null;
  const board = criticalBoard(boardInputFromTables(raw), b.end).rows.map((r) => ({ id: r.id, progress: { suppressed: r.progress.suppressed, status: r.progress.status } }));
  return computeDisclosure(hcInputFromTables(raw, rungs ?? staffRungs(raw)), period, board);
}
