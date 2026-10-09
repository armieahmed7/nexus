/**
 * F33 team matrix (pure): a partner admin's contractors against a contracted ENEC role profile. One row per contractor with the level
 * held per required competency (F02 competencyLevels over the passport states), F02 readiness, the gaps (with reasons) and the latest
 * equivalency status per standard of the role; coverage per competency and against the contracted headcount band.
 */
import { competencyLevels } from '../../domain/engines/skills';
import { readiness } from '../../domain/engines/rank';
import type { Reason } from '../../domain/engines/types';
import { BAND_MIN, m09r, type HeadcountBand } from './contractor';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type CellStatus = 'met' | 'near' | 'gap';
export interface MatrixCell { competency_id: string; have: number; need: number; basis: string; status: CellStatus }
export interface MatrixRow { person: Row; assigned: boolean; cells: MatrixCell[]; readiness: number; met: number; reasons: Reason[]; eq: { standard_id: string; status: string | null; request_id: string | null }[] }
export interface MatrixCoverage { competency_id: string; met: number; need: number }
export interface TeamMatrix {
  roleId: string;
  required: { competency_id: string; need: number; importance: string }[];
  standards: Row[];
  rows: MatrixRow[];
  coverage: MatrixCoverage[];
  ready: number;
  bandMin: number;
}
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function teamMatrix(i: { people: Row[]; states: Row[]; skills: Row[]; comps: Row[]; roleComps: Row[]; roleId: string; band?: string | null; requests: Row[]; standards: Row[] }): TeamMatrix {
  const sec = new Set(i.comps.filter((c) => c.domain === 'security').map((c) => c.id));
  const compBy = new Map(i.comps.map((c) => [c.id, c]));
  const required = i.roleComps
    .filter((r) => r.role_id === i.roleId && !sec.has(r.competency_id))
    .map((r) => ({ competency_id: r.competency_id as string, need: Number(r.required_level), importance: String(r.importance ?? 'core') }))
    .sort((a, b) => b.need - a.need || cmp(compBy.get(a.competency_id)?.code ?? a.competency_id, compBy.get(b.competency_id)?.code ?? b.competency_id));
  const standards = i.standards.filter((s) => s.status === 'current' && !s.security_restricted && (s.role_ids ?? []).includes(i.roleId)).sort((a, b) => cmp(a.code, b.code));
  const skillBy = new Map(i.skills.map((s) => [s.id, s]));
  const rows: MatrixRow[] = [];
  for (const p of i.people) {
    const st = i.states.filter((s) => s.person_id === p.id && s.active !== false && Number(s.level) > 0);
    const have = competencyLevels(st as never, i.skills as never);
    // basis of the competency level: the core skill's state when it carries the level, else the strongest specialised state
    const basisOf = (comp: string, lvl: number) => {
      const own = st.filter((s) => skillBy.get(s.skill_id)?.competency_id === comp && Number(s.level) === lvl);
      const core = own.find((s) => skillBy.get(s.skill_id)?.core);
      return String((core ?? own[0])?.basis ?? 'none');
    };
    const cells: MatrixCell[] = required.map((r) => {
      const h = have.get(r.competency_id) ?? 0;
      return { competency_id: r.competency_id, have: h, need: r.need, basis: h > 0 ? basisOf(r.competency_id, h) : 'none', status: h >= r.need ? 'met' : h === r.need - 1 && h > 0 ? 'near' : 'gap' };
    });
    const rd = required.length ? readiness(have, i.roleComps.filter((r) => !sec.has(r.competency_id)) as never, i.roleId) : { score: 0, gaps: [] };
    const reasons: Reason[] = [m09r('matrix_readiness', { pct: Math.round(rd.score * 100) })];
    for (const g of rd.gaps) {
      const c = compBy.get(g.competency_id);
      reasons.push(m09r('matrix_gap', { comp: { en: `${c?.code ?? ''} ${c?.name_en ?? g.competency_id}`, ar: `${c?.code ?? ''} ${c?.name_ar ?? g.competency_id}` }, have: g.have, need: g.need }, { table: 'competencies', id: g.competency_id }));
    }
    const mine = i.requests.filter((r) => r.person_id === p.id).sort((a, b) => cmp(String(b.submitted_at ?? ''), String(a.submitted_at ?? '')) || cmp(String(b.id), String(a.id)));
    rows.push({
      person: p, assigned: p.job_role_id === i.roleId, cells, readiness: rd.score, met: cells.filter((c) => c.status === 'met').length, reasons,
      eq: standards.map((s) => { const r = mine.find((x) => x.standard_id === s.id); return { standard_id: s.id, status: r?.status ?? null, request_id: r?.id ?? null }; }),
    });
  }
  rows.sort((a, b) => Number(b.assigned) - Number(a.assigned) || b.readiness - a.readiness || cmp(String(a.person.display_name ?? a.person.id), String(b.person.display_name ?? b.person.id)));
  const coverage = required.map((r) => ({ competency_id: r.competency_id, need: r.need, met: rows.filter((x) => x.cells.find((c) => c.competency_id === r.competency_id)?.status === 'met').length }));
  return { roleId: i.roleId, required, standards, rows, coverage, ready: rows.filter((r) => required.length > 0 && r.met === required.length).length, bandMin: BAND_MIN[(i.band ?? '1-4') as HeadcountBand] ?? 1 };
}
