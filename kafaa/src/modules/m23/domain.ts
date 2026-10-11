/**
 * M23 Talent review (F18) and succession (F19): pure rules shared by both backends, the seed builder and the PGlite validator.
 * Import-free apart from .ts files (node seed and validation scripts load this file directly). Mirrored 1:1 by the SQL functions
 * kafaa_tr_* / kafaa_sx_* in supabase/migrations/20261009131001_kafaa_w3e1_talent.sql; scripts/validate/w3e1-talent.mjs proves
 * TS = SQL on the seed. Change both together.
 *
 *  - Evidence index (0-100) from F01 skill state and evidence: breadth, depth, 12-month growth, validated skills (F10), completed
 *    opportunities and rotations (F08/F15 `ojt` evidence) and learning agility (skills brought to their key level in 12 months).
 *    Integer points only (floor), so SQL and TS agree to the unit. Self-claimed ratings never count as growth or agility.
 *  - Potential is the median of three behavioural anchors (agility, influence, drive), each 1-3. Performance comes from the
 *    synthetic performance field (1-5 → 1-3) and may be changed by the manager with a note.
 *  - Outlier flags (deterministic): potential 3 with an evidence index in the bottom third of the cycle; potential 1 with an
 *    index in the top third. Terciles are taken over every member of the cycle (not only the caller's view).
 *  - Succession readiness is the F05 career readiness (src/modules/m18/career.ts) plus the role's hard gates (licence route,
 *    current qualification, no entry condition "not met"). A person can never be "ready now" with a hard gate not met.
 */
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';
import type { CareerReadiness } from '../m18/career.ts';

export interface BiText { en: string; ar: string }
export interface Reason { code: string; key: string; vars?: Record<string, string | number | BiText>; ref?: { table: string; id: string }; weight?: number }
const rsn = (code: string, key: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ───────────────────────────── F18 · constants
export const CYCLE_STATUSES = ['open', 'calibration', 'locked'] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];
export const ANCHORS = ['agility', 'influence', 'drive'] as const;
export type Anchor = (typeof ANCHORS)[number];
export const ACTION_KINDS = ['training', 'rotation', 'mentoring', 'stretch', 'coaching'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const MAX_ACTIONS = 5;
export const NOTE_MIN = 10;
export const NOTE_MAX = 500;
export const GROWTH_DAYS = 365;

/** Evidence components: [key, cap, points]. Index = Σ floor(min(value, cap) × points / cap). Points add up to 100. */
export const EVIDENCE_WEIGHTS: [keyof EvidenceCounts, number, number][] = [
  ['breadth', 20, 25],
  ['depth', 12, 15],
  ['growth', 15, 20],
  ['validated', 4, 15],
  ['opportunities', 3, 10],
  ['agility', 8, 15],
];

export interface EvidenceCounts {
  /** Active skills at level 2 or above. */
  breadth: number;
  /** Active skills at level 3 or above. */
  depth: number;
  /** Distinct skills with fresh (≤ 12 months), non-claimed evidence. */
  growth: number;
  /** Distinct skills validated by a manager (F10 check-ins, F13 knowledge-transfer close-outs). */
  validated: number;
  /** Distinct completed opportunities, rotations and shadowing (F08/F15 `ojt` evidence). */
  opportunities: number;
  /** Distinct skills evidenced at or above their key level in the last 12 months (gaps closed per year). */
  agility: number;
}
export interface EvidenceSnapshot extends EvidenceCounts {
  index: number;
  points: Record<keyof EvidenceCounts, number>;
  as_of: string;
}
export interface EvidenceInput {
  states: { skill_id: string; level: number; active?: boolean | null }[];
  evidence: { skill_id: string; kind: string; basis: string; level: number; observed_on: string; ref_id: string; active?: boolean | null }[];
  skills: { id: string; key_level: number }[];
}

/** ISO date minus n days (UTC), as SQL `date - n`. */
export function minusDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function evidenceOf(inp: EvidenceInput, now: string): EvidenceSnapshot {
  const today = now.slice(0, 10);
  const since = minusDays(today, GROWTH_DAYS);
  const key = new Map(inp.skills.map((s) => [s.id, s.key_level]));
  const states = inp.states.filter((s) => s.active !== false);
  const ev = inp.evidence.filter((e) => e.active !== false);
  const fresh = ev.filter((e) => e.basis !== 'claimed' && String(e.observed_on).slice(0, 10) >= since && String(e.observed_on).slice(0, 10) <= today);
  const counts: EvidenceCounts = {
    breadth: states.filter((s) => s.level >= 2).length,
    depth: states.filter((s) => s.level >= 3).length,
    growth: new Set(fresh.map((e) => e.skill_id)).size,
    validated: new Set(ev.filter((e) => e.basis === 'validated').map((e) => e.skill_id)).size,
    opportunities: new Set(ev.filter((e) => e.kind === 'ojt').map((e) => e.ref_id)).size,
    agility: new Set(fresh.filter((e) => key.has(e.skill_id) && e.level >= (key.get(e.skill_id) as number)).map((e) => e.skill_id)).size,
  };
  const points = {} as Record<keyof EvidenceCounts, number>;
  let index = 0;
  for (const [k, cap, pts] of EVIDENCE_WEIGHTS) {
    points[k] = Math.floor((Math.min(counts[k], cap) * pts) / cap);
    index += points[k];
  }
  return { ...counts, index, points, as_of: today };
}

/** Human-readable reasons for an evidence index (rendered by <WhyThis>), strongest component first. */
export function evidenceReasons(s: Pick<EvidenceSnapshot, keyof EvidenceCounts | 'points' | 'index'>): Reason[] {
  const out: Reason[] = [rsn('index', 'm23.reasons.index', { n: s.index })];
  const order = [...EVIDENCE_WEIGHTS].sort((a, b) => (s.points[b[0]] ?? 0) - (s.points[a[0]] ?? 0) || cmp(a[0], b[0]));
  for (const [k] of order) out.push({ ...rsn(k, `m23.reasons.${k}`, { n: s[k] as number, pts: s.points[k] ?? 0 }), weight: s.points[k] ?? 0 });
  return out;
}

/** Tercile cut-offs over a cycle's evidence indices: low = highest index of the bottom third, high = lowest of the top third. */
export function cutsOf(indices: number[]): { low: number; high: number } | null {
  if (indices.length < 3) return null;
  const asc = [...indices].sort((a, b) => a - b);
  const k = Math.ceil(asc.length / 3) - 1;
  return { low: asc[k], high: asc[asc.length - 1 - k] };
}

export type FlagCode = 'potential_high_evidence_low' | 'potential_low_evidence_high';
export function flagsOf(potential: number | null | undefined, index: number, cuts: { low: number; high: number } | null): FlagCode[] {
  if (!cuts || potential == null) return [];
  const out: FlagCode[] = [];
  if (potential === 3 && index <= cuts.low) out.push('potential_high_evidence_low');
  if (potential === 1 && index >= cuts.high) out.push('potential_low_evidence_high');
  return out;
}

export const median3 = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => x - y)[1];
export function potentialOf(anchors: Partial<Record<Anchor, number>> | null | undefined): number | null {
  if (!anchors) return null;
  const v = ANCHORS.map((k) => anchors[k]);
  if (v.some((x) => typeof x !== 'number' || !Number.isInteger(x) || x < 1 || x > 3)) return null;
  return median3(v[0] as number, v[1] as number, v[2] as number);
}
export const perfFromRating = (r: number | null | undefined): number | null => (r == null ? null : r <= 2 ? 1 : r === 3 ? 2 : 3);
/** 9-box number: 1 (low performance, low potential) … 9 (high, high). Row = potential, column = performance. */
export const boxOf = (perf: number, potential: number) => (potential - 1) * 3 + perf;
/** HiPo pool: high potential with at least solid performance (boxes 8 and 9). */
export const isHipo = (perf: number, potential: number) => potential === 3 && perf >= 2;

export interface DevAction { kind: ActionKind; title_en: string; title_ar: string; ref_table?: string | null; ref_id?: string | null }
/** Normalise development actions; null when invalid (1-5 actions, known kind, a title in at least one language, ≤ 200 chars). */
export function normActions(a: unknown): DevAction[] | null {
  if (!Array.isArray(a) || a.length > MAX_ACTIONS) return null;
  const out: DevAction[] = [];
  for (const x of a) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const o = x as Record<string, unknown>;
    if (typeof o.kind !== 'string' || !(ACTION_KINDS as readonly string[]).includes(o.kind)) return null;
    const en = typeof o.title_en === 'string' ? o.title_en.trim() : '';
    const ar = typeof o.title_ar === 'string' ? o.title_ar.trim() : '';
    if ((!en && !ar) || en.length > 200 || ar.length > 200) return null;
    const refT = typeof o.ref_table === 'string' && o.ref_table ? o.ref_table : null;
    const refI = typeof o.ref_id === 'string' && o.ref_id ? o.ref_id : null;
    out.push({ kind: o.kind as ActionKind, title_en: en || ar, title_ar: ar || en, ref_table: refT, ref_id: refI });
  }
  return out;
}

export interface PlacementLite { person_id: string; perf: number; potential: number }
export interface PersonAttrs { id: string; gender?: string | null; nationality_flag?: string | null }
export interface AggCell { box: number; n: number | null; women: number | null; emirati: number | null }
export interface TalentAggregates {
  cycle_id: string | null;
  n: number | null;
  suppressed: boolean;
  min_group: number;
  cells: AggCell[];
  women: number | null;
  emirati: number | null;
  hipo: number | null;
  by_cycle: { cycle_id: string; n: number | null; placed: number | null; calibrated: number | null }[];
}
const sup = (n: number) => (n >= MIN_GROUP_SIZE ? n : null);
/** Aggregates of placements: every cell under MIN_GROUP_SIZE suppressed, including the women and Emirati splits. */
export function talentAggregatesOf(cycleId: string | null, placements: (PlacementLite & { cycle_id: string; calibrated?: boolean | null })[], people: PersonAttrs[], cycleIds: string[]): TalentAggregates {
  const pp = new Map(people.map((p) => [p.id, p]));
  const rows = placements.filter((p) => cycleId == null || p.cycle_id === cycleId);
  const women = (r: PlacementLite[]) => r.filter((x) => pp.get(x.person_id)?.gender === 'f').length;
  const emi = (r: PlacementLite[]) => r.filter((x) => pp.get(x.person_id)?.nationality_flag === 'uae').length;
  const total = rows.length;
  const suppressed = total < MIN_GROUP_SIZE;
  const cells: AggCell[] = [];
  for (let box = 1; box <= 9; box++) {
    const c = rows.filter((x) => boxOf(x.perf, x.potential) === box);
    cells.push({ box, n: suppressed ? null : sup(c.length), women: suppressed ? null : sup(women(c)), emirati: suppressed ? null : sup(emi(c)) });
  }
  const ids = [...new Set(cycleIds)].sort(cmp).filter((id) => cycleId == null || id === cycleId);
  return {
    cycle_id: cycleId,
    n: suppressed ? null : total,
    suppressed,
    min_group: MIN_GROUP_SIZE,
    cells,
    women: suppressed ? null : sup(women(rows)),
    emirati: suppressed ? null : sup(emi(rows)),
    hipo: suppressed ? null : sup(rows.filter((x) => isHipo(x.perf, x.potential)).length),
    by_cycle: ids.map((id) => {
      const r = placements.filter((p) => p.cycle_id === id);
      return { cycle_id: id, n: sup(r.length), placed: sup(r.length), calibrated: sup(r.filter((x) => x.calibrated).length) };
    }),
  };
}

// ───────────────────────────── F19 · succession
export const READINESS = ['ready_now', '1_2y', '3_5y'] as const;
export type Readiness = (typeof READINESS)[number];
export const READY_RANK: Record<Readiness, number> = { ready_now: 0, '1_2y': 1, '3_5y': 2 };
export const COVER_SOURCES = ['internal', 'khnp', 'contractor'] as const;
export type CoverSource = (typeof COVER_SOURCES)[number];
export const SUCCESSOR_ACTION_KINDS = ['training', 'rotation', 'mentoring'] as const;
export const MAX_SLATES_PER_PERSON = 2;
export const READY_NOW_SCORE = 0.85;
export const ONE_TWO_MAX_MONTHS = 24;
/** Licence types that satisfy a licensed role's licence gate (mirror of the licensee's register; Kafa'a is not the authority). */
export const ROLE_LICENCE: Record<string, string[]> = { 'reactor-operator': ['RO', 'SRO'], 'senior-reactor-operator': ['SRO'], 'shift-supervisor': ['SRO'] };
const CURRENT_QUAL = ['qualified', 'due', 'renewed'];

export interface GateData {
  person: { id: string; job_role_id?: string | null };
  licences: { person_id: string; type: string; status: string; expires_on?: string | null }[];
  standards: { id: string; role_ids: string[] | null; security_restricted?: boolean | null }[];
  qualRecords: { person_id: string; standard_id: string; status: string; expires_on?: string | null }[];
}
export type GateCode = 'licence' | 'qualification' | 'route';
export interface HardGate { code: GateCode; met: boolean; required: string[]; detail: string | null }

/** The role's hard gates for one person. `route` uses the F05 primary route status (not met = an entry condition failed). */
export function hardGatesOf(roleId: string, d: GateData, cr: Pick<CareerReadiness, 'band' | 'gate_status' | 'primary_route'> | null, now: string): HardGate[] {
  const out: HardGate[] = [];
  const lic = ROLE_LICENCE[roleId];
  if (lic) {
    const held = d.licences.filter((l) => l.person_id === d.person.id && l.status === 'valid' && (!l.expires_on || String(l.expires_on).slice(0, 10) >= now) && lic.includes(l.type)).map((l) => l.type).sort(cmp);
    out.push({ code: 'licence', met: held.length > 0, required: [...lic], detail: held[0] ?? null });
  }
  const stds = d.standards.filter((s) => !s.security_restricted && (s.role_ids ?? []).includes(roleId)).map((s) => s.id).sort(cmp);
  if (stds.length) {
    const cur = d.qualRecords.filter((r) => r.person_id === d.person.id && stds.includes(r.standard_id) && CURRENT_QUAL.includes(r.status) && (!r.expires_on || String(r.expires_on).slice(0, 10) >= now)).map((r) => r.standard_id).sort(cmp);
    out.push({ code: 'qualification', met: cur.length > 0, required: stds, detail: cur[0] ?? null });
  }
  if (d.person.job_role_id !== roleId) {
    const st = cr?.gate_status ?? 'none';
    out.push({ code: 'route', met: st !== 'not_met', required: cr?.primary_route ? [cr.primary_route] : [], detail: st });
  }
  return out;
}
export const gatesMet = (g: HardGate[]) => g.every((x) => x.met);

/** Computed readiness: ready now needs F05 readiness ≥ 85% and every hard gate met; else by the F05 months estimate. */
export function readinessOf(cr: Pick<CareerReadiness, 'score' | 'months' | 'path_only'> | null, gates: HardGate[]): Readiness {
  if (!cr || cr.path_only || cr.score == null) return '3_5y';
  if (cr.score >= READY_NOW_SCORE && gatesMet(gates)) return 'ready_now';
  return (cr.months ?? 999) <= ONE_TWO_MAX_MONTHS ? '1_2y' : '3_5y';
}

/** Why-this reasons for a candidate: F05 readiness first, then each hard gate. */
export function candidateReasons(cr: Pick<CareerReadiness, 'reasons'> | null, gates: HardGate[]): Reason[] {
  const out: Reason[] = [...(cr?.reasons ?? []).slice(0, 4)];
  for (const g of gates) out.push(rsn(`gate_${g.code}_${g.met ? 'met' : 'not_met'}`, `m23.reasons.gate_${g.code}_${g.met ? 'met' : 'not_met'}`, { req: g.required.join(' / ') || '—' }));
  return out;
}

export interface SuccessorLite { id: string; slate_id: string; person_id: string | null; status: string; readiness: string | null; emergency: boolean; cover_source: string }
export type SlateFlag = 'no_ready_now' | 'successor_overloaded' | 'external_cover' | 'no_emergency';
const active = (s: SuccessorLite) => s.status === 'proposed' || s.status === 'confirmed';
/** Slates each person is an active successor on. */
export function slateLoad(all: SuccessorLite[]): Map<string, number> {
  const m = new Map<string, Set<string>>();
  for (const s of all) if (active(s) && s.person_id) m.set(s.person_id, (m.get(s.person_id) ?? new Set()).add(s.slate_id));
  return new Map([...m].map(([k, v]) => [k, v.size]));
}
export function slateFlags(slateId: string, all: SuccessorLite[], load = slateLoad(all)): SlateFlag[] {
  const mine = all.filter((s) => s.slate_id === slateId && active(s));
  const internal = mine.filter((s) => s.cover_source === 'internal' && s.person_id);
  const out: SlateFlag[] = [];
  const readyNow = internal.some((s) => s.readiness === 'ready_now');
  if (!readyNow) out.push('no_ready_now');
  if (internal.some((s) => (load.get(s.person_id as string) ?? 0) > MAX_SLATES_PER_PERSON)) out.push('successor_overloaded');
  const ext = mine.filter((s) => s.cover_source !== 'internal');
  if (ext.some((s) => s.emergency) || (ext.length > 0 && !readyNow)) out.push('external_cover');
  if (!mine.some((s) => s.emergency)) out.push('no_emergency');
  return out;
}

/** Bench roll-up counts for one slate: confirmed internal successors by readiness (written to M07 critical_roles). */
export function benchCounts(slateId: string, all: SuccessorLite[]) {
  const c = all.filter((s) => s.slate_id === slateId && s.status === 'confirmed' && s.cover_source === 'internal' && s.person_id);
  return { qualified: c.filter((s) => s.readiness === 'ready_now').length, in_training: c.filter((s) => s.readiness === '1_2y').length, pipeline: c.filter((s) => s.readiness === '3_5y').length };
}
export const critId = (roleId: string, period: string) => `crit-${roleId}-${period.toLowerCase().replace('-', '')}`;

export interface SuccessionAggregates {
  slates: number;
  confirmed: number;
  with_ready_now: number;
  successors: number | null;
  emirati: number | null;
  women: number | null;
  emirati_pct: number | null;
  women_pct: number | null;
  by_readiness: Record<Readiness, number | null>;
  min_group: number;
}
/** Distinct internal successors (active), Emirati and women shares suppressed below MIN_GROUP_SIZE (count and base); the
 *  successor count and the counts by readiness are suppressed below MIN_GROUP_SIZE too (W3 QA; same as kafaa_sx_aggregates). */
export function successionAggregatesOf(slates: { id: string; status: string }[], all: SuccessorLite[], people: PersonAttrs[]): SuccessionAggregates {
  const pp = new Map(people.map((p) => [p.id, p]));
  const act = all.filter((s) => active(s) && s.cover_source === 'internal' && s.person_id);
  const ids = [...new Set(act.map((s) => s.person_id as string))];
  const n = ids.length;
  const emi = ids.filter((id) => pp.get(id)?.nationality_flag === 'uae').length;
  const wom = ids.filter((id) => pp.get(id)?.gender === 'f').length;
  const ok = (k: number) => n >= MIN_GROUP_SIZE && k >= MIN_GROUP_SIZE;
  const by = { ready_now: 0, '1_2y': 0, '3_5y': 0 } as Record<Readiness, number>;
  for (const s of act) if (s.readiness && s.readiness in by) by[s.readiness as Readiness]++;
  return {
    slates: slates.length,
    confirmed: slates.filter((s) => s.status === 'confirmed').length,
    with_ready_now: slates.filter((s) => act.some((x) => x.slate_id === s.id && x.readiness === 'ready_now')).length,
    successors: n >= MIN_GROUP_SIZE ? n : null,
    emirati: ok(emi) ? emi : null,
    women: ok(wom) ? wom : null,
    emirati_pct: ok(emi) ? Math.round((emi * 100) / n) : null,
    women_pct: ok(wom) ? Math.round((wom * 100) / n) : null,
    by_readiness: { ready_now: by.ready_now >= MIN_GROUP_SIZE ? by.ready_now : null, '1_2y': by['1_2y'] >= MIN_GROUP_SIZE ? by['1_2y'] : null, '3_5y': by['3_5y'] >= MIN_GROUP_SIZE ? by['3_5y'] : null },
    min_group: MIN_GROUP_SIZE,
  };
}

/** User-facing refusal messages (the same text in SQL). */
export const MSG = {
  not_signed_in: 'Sign in to use talent review',
  forbidden_review: 'Talent review is for line managers and HR',
  forbidden_place: 'Only a line manager places people in their own team',
  forbidden_calibrate: 'Calibration is facilitated by HR',
  forbidden_lock: 'Only the HR director locks a review cycle',
  forbidden_succession: 'Succession slates are changed by the HR director',
  cycle_not_found: 'Review cycle not found',
  cycle_locked: 'This review cycle is locked: decisions can no longer change',
  in_calibration: 'This cycle is in calibration: changes now go through the HR facilitator',
  not_member: 'This person is not part of this review cycle',
  not_in_scope: 'You can place only people in your own team',
  self: 'You cannot review yourself',
  invalid_scores: 'Choose a performance level and all three potential anchors (1 to 3)',
  note_required: 'Add a note (10 characters or more) when you change the performance level from the HR record',
  invalid_actions: 'Choose up to five development actions, each with a kind and a title',
  invalid_note: 'Notes are at most 500 characters',
  calibrate_note: 'Every calibration change needs a reason (10 characters or more)',
  calibrate_invalid: 'Each change needs a placed person and levels from 1 to 3',
  incomplete: 'Everyone in the cycle must be placed before calibration can finish',
  not_calibrated: 'Finish calibration before locking the cycle',
  maker_checker: 'Maker-checker: the person who calibrated or placed people in this cycle cannot lock it',
  slate_not_found: 'Succession slate not found',
  successor_not_found: 'Successor not found',
  person_not_found: 'Person not found or not eligible for this slate',
  path_only: 'Security, safeguards and cyber roles show the career path only',
  gate_not_met: 'Not ready now: a hard gate of this role (licence route, qualification or entry condition) is not met',
  optimistic_note: 'Give a reason (10 characters or more) when the readiness is earlier than the computed one',
  invalid_readiness: 'Choose ready now, 1 to 2 years or 3 to 5 years',
  invalid_cover: 'External cover needs a role-card label and must not name a person',
  duplicate: 'This person is already on the slate',
  slate_empty: 'Add at least one successor before confirming the slate',
  slate_confirmed: 'This slate is confirmed: propose changes in the next period',
  bad_period: 'Choose a period like 2026-H2',
  nothing_to_roll: 'No confirmed slate for a critical role in this period',
} as const;

export const PERIOD_RE = /^20\d\d-H[12]$/;
export const isPeriod = (p: unknown): p is string => typeof p === 'string' && PERIOD_RE.test(p);

// ───────────────────────────── membership and visibility (pure; same rules in SQL)
export interface MemberPerson { id: string; kind: string; status: string; job_role_id?: string | null; job_family_id?: string | null }
export interface AssignmentRow { person_id: string; role: string; status: string; scope_type: string; scope_value?: string | null; expires_at?: string | null }
/** Cycle members: active staff with a job role in one of the cycle's families, never the HR director (who locks the cycle). */
export function membersOf(familyIds: string[], people: MemberPerson[], assignments: AssignmentRow[], today: string): string[] {
  const hrd = new Set(assignments.filter((a) => a.role === 'hr_director' && a.status === 'active' && (!a.expires_at || String(a.expires_at).slice(0, 10) >= today)).map((a) => a.person_id));
  return people
    .filter((p) => p.kind === 'staff' && p.status === 'active' && !!p.job_role_id && !!p.job_family_id && familyIds.includes(p.job_family_id) && !hrd.has(p.id))
    .map((p) => p.id)
    .sort(cmp);
}
/** Feeder roles of a role: progression edges into it (entry routes excluded). */
export function feederRoles(roleId: string, edges: { from_role_id: string | null; to_role_id: string }[]): string[] {
  return [...new Set(edges.filter((e) => e.to_role_id === roleId && e.from_role_id && e.from_role_id !== roleId).map((e) => e.from_role_id as string))].sort(cmp);
}
/** Function-scoped slate visibility for executives and the HR business partner: a Scope assignment over all, the slate's entity or family. */
export function slateInScope(slate: { entity_id?: string | null; family_id?: string | null }, scopeAssignments: { scope_type: string; scope_value?: string | null }[]): boolean {
  return scopeAssignments.some((a) => a.scope_type === 'all' || (a.scope_type === 'entity' && !!slate.entity_id && a.scope_value === slate.entity_id) || (a.scope_type === 'family' && !!slate.family_id && a.scope_value === slate.family_id));
}
export const CANDIDATE_LIMIT = 30;
export const WITHDRAW_MSG = 'Give a reason (10 characters or more) for withdrawing a successor';
