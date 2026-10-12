/**
 * FS67 Fellowships and sponsored placements: pure rules shared by both backends, the seed builder, the pages and the PGlite validator.
 * Import-free apart from other import-free rule files. SQL mirror: kafaa_fw_* in
 * supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql (PGlite parity: scripts/validate/fs74-university-alignment.mjs).
 *
 * Two patterns (research pack: OECD-NEA NEST; IAEA MSCFP):
 *   nest_fellowship  a graduate student or early-career professional does real work inside an ENEC research challenge or an ADVANCE
 *                    technology study (planning assumption, no deployment decision implied), with a named supervisor role card.
 *   sponsored_study  study funding paired with a placement at ENEC (the two-part MSCFP design): the university reports enrolment,
 *                    year results and graduation; ENEC signs off the placement.
 * Each fellowship gets five required milestones from its kind's template (due dates spread over the planned span). The fellow (or the
 * university for its own milestones) submits; the named supervisor or HR (ecosystem A) signs off, never the person who submitted.
 * A fellowship is complete when every required milestone is signed off.
 *
 * Completion rate is the headline, computed from the milestones, never from award counts: due = complete, withdrawn, or past the
 * planned end; rate = completed / due, shown only when at least 10 fellowships are due (MIN 10); award counts are themselves
 * suppressed under 10 and are only ever shown next to the completion rate.
 */
import { publicTextIsClean } from '../../domain/future.ts';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const FW_MIN = 10;
export const FW_KINDS = ['nest_fellowship', 'sponsored_study'] as const;
export type FwKind = (typeof FW_KINDS)[number];
export const HOST_KINDS = ['research_challenge', 'advance_study'] as const;
export type HostKind = (typeof HOST_KINDS)[number];
export const FW_STATUSES = ['active', 'completed', 'withdrawn'] as const;
export const MS_STATUSES = ['planned', 'submitted', 'signed_off'] as const;
export const MS_ACTIONS = ['submit', 'sign_off', 'return'] as const;
export type MsAction = (typeof MS_ACTIONS)[number];
export const SPAN_MIN = 90;
export const SPAN_MAX = 1461;

/** Milestone template per kind: [kind, owner, fraction of the span (num/den), extra days]. */
export const MS_TEMPLATE: Record<FwKind, [string, 'enec' | 'university', number, number, number][]> = {
  nest_fellowship: [
    ['research_plan', 'enec', 1, 10, 0],
    ['midpoint_review', 'enec', 1, 2, 0],
    ['deliverable', 'enec', 9, 10, 0],
    ['final_report', 'enec', 1, 1, 0],
    ['knowledge_transfer', 'enec', 1, 1, 30],
  ],
  sponsored_study: [
    ['enrolment', 'university', 0, 1, 14],
    ['year_results', 'university', 2, 5, 0],
    ['placement_start', 'enec', 3, 5, 0],
    ['placement_review', 'enec', 4, 5, 0],
    ['graduation', 'university', 1, 1, 0],
  ],
};

export const FW_MSG = {
  not_signed_in: 'Sign in first',
  forbidden_hr: 'Only HR (the HR director) or a platform admin can do this',
  forbidden_stats: 'Fellowship results are shown to staff, partners and HR as aggregates',
  forbidden_ms: 'You cannot act on this milestone',
  not_found: 'Fellowship or milestone not found',
  kind: 'Choose a NEST-style fellowship or sponsored study with placement',
  title: 'Give the title in English and Arabic (3 to 160 characters each)',
  fellow: 'Choose the fellow (an applicant or a member of staff)',
  university: 'Sponsored study needs the host university; a fellowship names a university only if one is involved',
  host: 'Name a published research challenge or an ADVANCE technology study as the host project',
  supervisor: 'The supervisor must be an active ENEC role card, not the fellow',
  dates: 'The planned span is 90 days to four years (end after start)',
  placement: 'Describe the placement (up to 300 characters in each language; sponsored study needs it)',
  clean: 'ADVANCE text must not carry headcounts or site wording (no deployment decision implied)',
  duplicate: 'This fellow already has a fellowship starting that year',
  closed: 'The fellowship is no longer active',
  status: 'The milestone is not in a state that allows this action',
  maker_checker: 'The person who submitted a milestone cannot sign it off',
  note: 'Give a note of 5 to 500 characters',
  reason: 'Give the reason in 10 to 300 characters',
} as const;
export type FwCode = keyof typeof FW_MSG;

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const isIsoDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const dayNo = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
export const addDays = (iso: string, n: number) => new Date((dayNo(iso) + n) * 86400000).toISOString().slice(0, 10);
const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface MilestonePlan { id: string; n: number; kind: string; owner: 'enec' | 'university'; required: boolean; due_on: string }
/** The five milestones of a fellowship (ids `<fellowship>-m<n>`), due dates = start + floor(span x num / den) + extra days. */
export function milestonePlan(id: string, kind: FwKind, startsOn: string, endsOn: string): MilestonePlan[] {
  const span = dayNo(endsOn) - dayNo(startsOn);
  return MS_TEMPLATE[kind].map(([k, owner, num, den, plus], i) => ({ id: `${id}-m${i + 1}`, n: i + 1, kind: k, owner, required: true, due_on: addDays(startsOn, Math.floor((span * num) / den) + plus) }));
}
export const fellowshipId = (startsOn: string, fellow: string) => `fw-${startsOn.slice(0, 4)}-${fellow}`;

export interface FellowshipInput {
  kind?: unknown; title_en?: unknown; title_ar?: unknown; fellow_person_id?: unknown; university_org_id?: unknown; host_kind?: unknown; host_ref?: unknown;
  supervisor_person_id?: unknown; starts_on?: unknown; ends_on?: unknown; placement_en?: unknown; placement_ar?: unknown;
}
export interface FwWorld { people: Row[]; organisations: Row[]; research_challenges: Row[]; adv_technologies: Row[]; fellowships: Row[] }
const lenOk = (v: unknown, min: number, max: number) => (v == null || typeof v === 'string') && str(v).length >= min && str(v).length <= max;

/** First problem of a new fellowship (null = valid). */
export function fellowshipProblem(p: FellowshipInput, w: FwWorld): FwCode | null {
  if (typeof p.kind !== 'string' || !(FW_KINDS as readonly string[]).includes(p.kind)) return 'kind';
  if (typeof p.title_en !== 'string' || typeof p.title_ar !== 'string' || !lenOk(p.title_en, 3, 160) || !lenOk(p.title_ar, 3, 160)) return 'title';
  const fellow = w.people.find((x) => x.id === p.fellow_person_id);
  if (!fellow || !['applicant', 'staff'].includes(String(fellow.kind)) || fellow.status === 'leaver') return 'fellow';
  const uni = p.university_org_id == null || p.university_org_id === '' ? null : w.organisations.find((o) => o.id === p.university_org_id);
  if ((p.university_org_id != null && p.university_org_id !== '' && (!uni || uni.kind !== 'university')) || (p.kind === 'sponsored_study' && !uni)) return 'university';
  if (typeof p.host_kind !== 'string' || !(HOST_KINDS as readonly string[]).includes(p.host_kind)) return 'host';
  if (p.host_kind === 'research_challenge' ? !w.research_challenges.some((c) => c.id === p.host_ref && c.is_published === true) : !w.adv_technologies.some((t) => t.id === p.host_ref)) return 'host';
  const sup = w.people.find((x) => x.id === p.supervisor_person_id);
  if (!sup || sup.kind !== 'staff' || !sup.persona_id || sup.status !== 'active' || sup.id === p.fellow_person_id) return 'supervisor';
  if (!isIsoDate(p.starts_on) || !isIsoDate(p.ends_on)) return 'dates';
  const span = dayNo(p.ends_on) - dayNo(p.starts_on);
  if (span < SPAN_MIN || span > SPAN_MAX) return 'dates';
  if (!lenOk(p.placement_en, 0, 300) || !lenOk(p.placement_ar, 0, 300) || (p.kind === 'sponsored_study' && str(p.placement_en).length < 3)) return 'placement';
  if (p.host_kind === 'advance_study' && !publicTextIsClean([str(p.title_en), str(p.title_ar), str(p.placement_en), str(p.placement_ar)])) return 'clean';
  if (w.fellowships.some((f) => f.id === fellowshipId(p.starts_on as string, p.fellow_person_id as string))) return 'duplicate';
  return null;
}

/** Can the caller act on a milestone? `ctx` answers the role questions; codes match the SQL function's order. */
export interface MsCtx { me: string; hr: boolean; uniOrg: string | null }
export function milestoneProblem(action: unknown, ms: Row | undefined, fw: Row | undefined, c: MsCtx, note: unknown): FwCode | 'forbidden' | null {
  if (!ms || !fw) return 'not_found';
  if (fw.status !== 'active') return 'closed';
  if (typeof action !== 'string' || !(MS_ACTIONS as readonly string[]).includes(action)) return 'status';
  const n = typeof note === 'string' ? str(note).length : 0;
  if (n > 500) return 'note';
  if (action === 'submit') {
    const can = c.me === fw.fellow_person_id || (ms.owner === 'university' && !!c.uniOrg && c.uniOrg === fw.university_org_id);
    if (!can) return 'forbidden';
    if (ms.status !== 'planned') return 'status';
    return null;
  }
  if (!(c.hr || c.me === fw.supervisor_person_id)) return 'forbidden';
  if (ms.status !== 'submitted') return 'status';
  if (action === 'sign_off' && ms.submitted_by === c.me) return 'maker_checker';
  if (action === 'return' && n < 5) return 'note';
  return null;
}

/** Complete = at least one required milestone and every required milestone signed off. */
export function isComplete(milestones: Row[]): boolean {
  const req = milestones.filter((m) => m.required !== false);
  return req.length > 0 && req.every((m) => m.status === 'signed_off');
}

// ───────────── completion statistics (computed from milestones; suppressed under 10)
export interface StatCell { key: string; awarded: number | null; due: number | null; completed: number | null; rate: number | null; suppressed: boolean }
export interface FwStats { as_of: string; min: number; overall: StatCell; by_kind: StatCell[]; by_host: StatCell[]; by_university: StatCell[]; overdue: number | null }

function cell(key: string, rows: { complete: boolean; due: boolean }[]): StatCell {
  const awarded = rows.length, due = rows.filter((r) => r.due).length, completed = rows.filter((r) => r.complete).length;
  const ok = due >= FW_MIN; // an award count is never given without the completion rate beside it
  return {
    key, awarded: ok && awarded >= FW_MIN ? awarded : null, due: ok ? due : null, completed: ok && completed >= FW_MIN ? completed : null,
    rate: ok ? Math.round((100 * completed) / due) : null, suppressed: !ok,
  };
}
/** Completion statistics as of a date. Keys: kinds and host kinds in template order, universities by id with 'enec' (none) last. */
export function fellowshipStats(fellowships: Row[], milestones: Row[], asOf: string): FwStats {
  const ms = new Map<string, Row[]>();
  for (const m of milestones) (ms.get(String(m.fellowship_id)) ?? ms.set(String(m.fellowship_id), []).get(String(m.fellowship_id))!).push(m);
  const rows = [...fellowships].sort((a, b) => cmp(String(a.id), String(b.id))).map((f) => {
    const complete = f.status !== 'withdrawn' && isComplete(ms.get(String(f.id)) ?? []);
    return { f, complete, due: complete || f.status === 'withdrawn' || (d10(f.ends_on) ?? '9999') < asOf };
  });
  const unis = [...new Set(rows.map((r) => (r.f.university_org_id ? String(r.f.university_org_id) : 'enec')))].sort((a, b) => (a === 'enec' ? 1 : b === 'enec' ? -1 : cmp(a, b)));
  const overdueN = milestones.filter((m) => m.status !== 'signed_off' && (d10(m.due_on) ?? '9999') < asOf && rows.some((r) => r.f.id === m.fellowship_id && r.f.status === 'active')).length;
  return {
    as_of: asOf, min: FW_MIN,
    overall: cell('all', rows),
    by_kind: FW_KINDS.map((k) => cell(k, rows.filter((r) => r.f.kind === k))),
    by_host: HOST_KINDS.map((k) => cell(k, rows.filter((r) => r.f.host_kind === k))),
    by_university: unis.map((u) => cell(u, rows.filter((r) => (r.f.university_org_id ? String(r.f.university_org_id) : 'enec') === u))),
    overdue: overdueN >= FW_MIN ? overdueN : null,
  };
}

/** A milestone is overdue when it is not signed off and its due date has passed (active fellowships only). */
export const isOverdue = (m: Row, fw: Row, today: string) => fw.status === 'active' && m.status !== 'signed_off' && (d10(m.due_on) ?? '9999') < today;
