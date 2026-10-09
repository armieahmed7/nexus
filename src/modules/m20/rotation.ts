/**
 * F15 Rotations and job shadowing: pure rules shared by the LocalBackend (backend/local.ts), the seed builder
 * (scripts/seed/ext/f15-rotations.mjs), the pages and the tests. Node loads this file directly, so it imports only domain.ts.
 * SQL mirror: supabase/migrations/20261009124001_kafaa_w2e4_rotations.sql (kafaa_rot_* helpers, kafaa_rotation_board).
 * Same checks, same order, same refusal codes and messages: change both together.
 */
import { lineManagerOf, type AssignmentLite, type PersonLite } from './domain.ts';

export const PROGRAMMES = ['gdp', 'gpo', 'dnt', 'cross_functional', 'hipo'] as const;
export type Programme = (typeof PROGRAMMES)[number];
/** Security, cyber and safeguards are career-path only: never a placement, a shadowing host or an objective. */
export const RESTRICTED_FAMILIES = ['security', 'cyber', 'safeguards'];
export const RESTRICTED_SKILL_AREAS = ['security'];
/** Families whose work is at the plant: placements and shadowing there only show "site induction required" (never access detail). */
export const SITE_FAMILIES = ['operations', 'maintenance', 'radiation-protection', 'chemistry', 'outage', 'fire-protection', 'emergency-preparedness', 'nuclear-fuel'];
/** Roles that can host (and sign off) a placement. */
export const HOST_ROLES = ['manager', 'training_manager'];
/** HR programme owners (templates, cohorts, enrolment): the CHCO office, HR analysts and the training manager. */
export const OWNER_ROLES = ['hr_analyst', 'hr_director', 'training_manager'] as const;
export const OWNER_LEVEL: Record<string, string> = { hr_analyst: 'Agg', hr_director: 'Agg', training_manager: 'W' };
export const PLACEMENT_STATUSES = ['planned', 'active', 'signed_off', 'cancelled'] as const;
export const PROGRESS = ['on_track', 'at_risk', 'met'] as const;
export const SHADOW_STATUSES = ['requested', 'approved', 'declined', 'withdrawn', 'completed'] as const;
export const TEMPLATE_STATUSES = ['draft', 'active', 'retired'] as const;
/** OJT sign-off never claims more than level 3 (Qualified belongs to the qualification system, not Kafa'a). */
export const ROT_LEVEL_CAP = 3;
export const MAX_STEPS = 8;
export const MAX_OBJECTIVES = 5;
export const SHADOW_MAX_DAYS = 5;
export const SHADOW_MAX_OPEN = 3;
export const SHADOW_MAX_SKILLS = 3;
export const HOST_MAX_SKILLS = 6;
export const MIN_GROUP = 10;

export const RMSG = {
  not_signed_in: 'Sign in to use rotations and shadowing',
  forbidden_owner: 'Only HR programme owners and the training manager manage rotation programmes',
  restricted_template: 'Security, cyber and safeguards placements are career-path only and cannot be part of a rotation',
  invalid_programme: 'Unknown programme',
  invalid_text: 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters)',
  invalid_duration: 'Set a minimum and maximum duration between 1 and 48 months (minimum not above maximum)',
  invalid_steps: 'Each placement needs a known job family, a host team in English and Arabic, 1 to 12 months and 1 to 5 objectives tied to catalogue skills at levels 1 to 3',
  invalid_host: 'Each placement needs a host manager (a line manager or the training manager)',
  invalid_total: 'The placements must add up to the programme duration (between the minimum and maximum months)',
  invalid_families: 'Unknown job family or source',
  invalid_status: 'A programme is a draft, active or retired',
  template_not_found: 'Rotation programme not found',
  forbidden_template: 'Only the programme owner or the training manager can change this programme',
  invalid_cohort_text: 'Give the cohort an English and an Arabic name (3 to 120 characters) and an intake date',
  cohort_not_found: 'Cohort not found',
  cohort_mismatch: 'That cohort belongs to another programme',
  template_inactive: 'Only an active programme can take enrolments',
  person_not_found: 'Person not found',
  not_eligible: 'This programme is open to other job families',
  invalid_start: 'Start between today and twelve months from now',
  already_enrolled: 'This person is already enrolled in this programme',
  no_host: 'A placement has no one who can sign it off; update the programme hosts',
  placement_not_found: 'Placement not found',
  forbidden_checkin: 'Only the person on rotation or the host records the mid-point check-in',
  closed: 'This placement is closed',
  not_started: 'The placement has not started yet',
  checkin_done: 'The mid-point check-in is already recorded',
  invalid_progress: 'Give a status for every objective',
  invalid_note: 'Add a short note (at least one sentence, at most 1,000 characters)',
  self_signoff: 'You cannot sign off your own placement',
  maker_checker: 'As both host and line manager you cannot sign off alone; the sign-off goes to your own line manager',
  forbidden_signoff: 'Only the host manager signs off this placement',
  checkin_required: 'Record the mid-point check-in before signing off',
  invalid_levels: 'Rate at least one objective, at levels 1 to 3',
  forbidden_shadow: 'Only staff may request shadowing',
  host_not_found: 'Host not found or not taking requests',
  restricted_shadow: 'Security, cyber and safeguards work is career-path only and cannot be shadowed',
  self_shadow: 'You cannot shadow yourself',
  invalid_days: 'Shadowing lasts 1 to 5 days',
  invalid_shadow_start: 'Start between today and six months from now',
  invalid_shadow_skills: 'Choose one to three skills this host offers',
  invalid_purpose: 'Say in a sentence or two what you want to learn (10 to 500 characters)',
  too_many_open: 'You already have three open shadowing requests',
  duplicate_open: 'You already have an open request with this host',
  no_line_manager: 'No line manager is recorded for you; ask HR to update your record',
  shadow_not_found: 'Shadowing request not found',
  invalid_decision: 'Unknown decision',
  forbidden_withdraw: 'Only the person who asked can withdraw a request',
  shadow_closed: 'This request is closed',
  forbidden_consent: 'Only the host and the line manager give consent',
  decline_reason: 'Give a reason when you decline',
  already_consented: 'You have already given your consent',
  forbidden_complete: 'Only the host confirms the shadowing took place',
  not_approved: 'Only an approved request can be completed',
  shadow_not_started: 'The shadowing has not started yet',
  restricted_host: 'Security, cyber and safeguards staff cannot host shadowing',
  invalid_host_profile: 'Offer one to six catalogue skills, 1 to 10 days a month, and keep notes under 300 characters',
  forbidden_host: 'Only staff can offer to host shadowing',
} as const;

// ───────────── dates (UTC calendar days, like SQL date arithmetic)
const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
export const dayNo = (d: string) => Math.floor(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86_400_000);
const fromDay = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromDay(dayNo(d) + n);
/** SQL `date + make_interval(months => n)`: the day is clamped to the end of the target month. */
export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ty = Math.floor(idx / 12);
  const tm = idx - ty * 12;
  const dim = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(day, dim)).padStart(2, '0')}`;
}
/** Mid-point of a placement: start + floor(days between / 2). */
export const midpoint = (start: string, end: string) => addDays(start, Math.floor((dayNo(end) - dayNo(start)) / 2));
export type Phase = 'upcoming' | 'in_progress' | 'overdue' | 'signed_off' | 'cancelled';
export function phaseOf(p: { status: string; starts_on: string; ends_on: string }, today: string): Phase {
  if (p.status === 'cancelled') return 'cancelled';
  if (p.status === 'signed_off') return 'signed_off';
  if (p.starts_on > today) return 'upcoming';
  if (p.ends_on < today) return 'overdue';
  return 'in_progress';
}

const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : -1);
const isInt = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

// ───────────── templates
export interface ObjectiveInput { id?: string | null; skill_id: string; level: number; text_en: string; text_ar: string }
export interface StepInput { family_id: string; host_team_en: string; host_team_ar: string; host_role_id?: string | null; host_manager_id?: string | null; months: number; site_induction?: boolean; objectives: ObjectiveInput[] }
export interface TemplateInput {
  id?: string | null; programme: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string;
  duration_min_months: number; duration_max_months: number; steps: StepInput[]; eligible_families?: string[]; source_ids?: string[]; status?: 'draft' | 'active' | 'retired';
}
export interface Objective { id: string; skill_id: string; level: number; text_en: string; text_ar: string }
export interface Step { seq: number; family_id: string; host_team_en: string; host_team_ar: string; host_role_id: string | null; host_manager_id: string; host_name_en: string; host_name_ar: string; months: number; site_induction: boolean; objectives: Objective[] }

export interface HostCtx {
  people: (PersonLite & { kind?: string | null })[];
  assignments: AssignmentLite[];
  today: string;
}
/** Can this person host a placement: active staff with an active manager or training-manager assignment. */
export function isHost(id: string | null | undefined, c: HostCtx): boolean {
  if (!id) return false;
  const p = c.people.find((x) => x.id === id);
  if (!p || p.kind !== 'staff' || p.status === 'leaver') return false;
  return c.assignments.some((a) => a.person_id === id && HOST_ROLES.includes(a.role) && a.status === 'active' && !(a.expires_at && String(a.expires_at).slice(0, 10) < c.today));
}
/** Default host for a family: the holder of an active family-scoped manager assignment (lowest person id). */
export function familyHost(family: string, c: HostCtx): string | null {
  const ids = c.assignments
    .filter((a) => a.role === 'manager' && a.status === 'active' && a.scope_type === 'family' && a.scope_value === family && !(a.expires_at && String(a.expires_at).slice(0, 10) < c.today))
    .map((a) => a.person_id)
    .filter((id) => isHost(id, c))
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return ids[0] ?? null;
}

/** Display name of a host (role cards: "Outage Manager (role card)"), stored on the template step so readers need no people access. */
export function hostName(id: string, c: HostCtx): { en: string; ar: string } {
  const p = c.people.find((x) => x.id === id) as (PersonLite & { display_name?: string; display_name_ar?: string | null }) | undefined;
  return { en: p?.display_name ?? id, ar: p?.display_name_ar || p?.display_name || id };
}
export function validateTemplate(
  p: TemplateInput,
  ref: { skills: { id: string; area: string }[]; families: string[]; roles: string[]; sources: string[] },
  hosts: HostCtx,
): { code: string; message: string } | { steps: Step[] } {
  const area = new Map(ref.skills.map((s) => [s.id, s.area]));
  const steps = Array.isArray(p?.steps) ? p.steps : null;
  if ((steps ?? []).some((s) => RESTRICTED_FAMILIES.includes(String(s?.family_id)) || (Array.isArray(s?.objectives) ? s.objectives : []).some((o) => RESTRICTED_SKILL_AREAS.includes(area.get(String(o?.skill_id)) ?? ''))))
    return { code: 'restricted_kind', message: RMSG.restricted_template };
  if (!(PROGRAMMES as readonly string[]).includes(String(p?.programme))) return { code: 'invalid', message: RMSG.invalid_programme };
  if (len(p.title_en) < 5 || len(p.title_en) > 120 || len(p.title_ar) < 5 || len(p.title_ar) > 120 || len(p.summary_en) < 20 || len(p.summary_en) > 1000 || len(p.summary_ar) < 20 || len(p.summary_ar) > 1000)
    return { code: 'invalid', message: RMSG.invalid_text };
  if (!isInt(p.duration_min_months, 1, 48) || !isInt(p.duration_max_months, 1, 48) || p.duration_min_months > p.duration_max_months) return { code: 'invalid', message: RMSG.invalid_duration };
  if (!steps || steps.length < 1 || steps.length > MAX_STEPS) return { code: 'invalid', message: RMSG.invalid_steps };
  for (const s of steps) {
    const objs = Array.isArray(s?.objectives) ? s.objectives : null;
    if (!s || typeof s !== 'object' || Array.isArray(s) || !ref.families.includes(String(s.family_id)) || len(s.host_team_en) < 2 || len(s.host_team_en) > 80 || len(s.host_team_ar) < 2 || len(s.host_team_ar) > 80 || !isInt(s.months, 1, 12)
      || (s.host_role_id != null && !ref.roles.includes(String(s.host_role_id))) || (s.site_induction != null && typeof s.site_induction !== 'boolean')
      || !objs || objs.length < 1 || objs.length > MAX_OBJECTIVES
      || objs.some((o) => !area.has(String(o?.skill_id)) || !isInt(o.level, 1, ROT_LEVEL_CAP) || len(o.text_en) < 5 || len(o.text_en) > 200 || len(o.text_ar) < 5 || len(o.text_ar) > 200)
      || new Set(objs.map((o) => o.skill_id)).size !== objs.length)
      return { code: 'invalid', message: RMSG.invalid_steps };
  }
  const resolved: string[] = [];
  for (const s of steps) {
    const h = s.host_manager_id != null && s.host_manager_id !== '' ? (isHost(s.host_manager_id, hosts) ? s.host_manager_id : null) : familyHost(s.family_id, hosts);
    if (!h) return { code: 'invalid', message: RMSG.invalid_host };
    resolved.push(h);
  }
  const total = steps.reduce((a, s) => a + s.months, 0);
  if (total < p.duration_min_months || total > p.duration_max_months) return { code: 'invalid', message: RMSG.invalid_total };
  if (!Array.isArray(p.eligible_families ?? []) || (p.eligible_families ?? []).some((f) => !ref.families.includes(f)) || !Array.isArray(p.source_ids ?? []) || (p.source_ids ?? []).some((x) => !ref.sources.includes(x)))
    return { code: 'invalid', message: RMSG.invalid_families };
  if (p.status != null && !(TEMPLATE_STATUSES as readonly string[]).includes(p.status)) return { code: 'invalid', message: RMSG.invalid_status };
  return {
    steps: steps.map((s, i) => ({
      seq: i + 1, family_id: s.family_id, host_team_en: s.host_team_en.trim(), host_team_ar: s.host_team_ar.trim(), host_role_id: s.host_role_id ?? null, host_manager_id: resolved[i],
      host_name_en: hostName(resolved[i], hosts).en, host_name_ar: hostName(resolved[i], hosts).ar,
      months: s.months, site_induction: s.site_induction ?? SITE_FAMILIES.includes(s.family_id),
      objectives: s.objectives.map((o, j) => ({ id: `o${i + 1}-${j + 1}`, skill_id: o.skill_id, level: o.level, text_en: o.text_en.trim(), text_ar: o.text_ar.trim() })),
    })),
  };
}
export const totalMonths = (steps: { months: number }[]) => steps.reduce((a, s) => a + s.months, 0);

// ───────────── enrolment
/**
 * Who signs off a placement: the host manager, unless the host is the person or the person's own line manager
 * (maker-checker); then the host's own line manager (skip level). Null when nobody qualifies.
 */
export function signerFor(person: string, host: string, people: PersonLite[], assignments: AssignmentLite[], today: string) {
  const lm = lineManagerOf(person, people, assignments, today);
  if (host !== person && host !== lm) return { lineManager: lm, signer: host as string | null, skipLevel: false };
  const skip = lineManagerOf(host, people, assignments, today);
  return { lineManager: lm, signer: skip && skip !== person ? skip : null, skipLevel: true };
}
/** Placement rows (without ids) for an enrolment starting on `start`: consecutive, months long each. */
export function planPlacements(steps: Step[], start: string) {
  let cum = 0;
  return steps.map((s) => {
    const starts_on = addMonths(start, cum);
    cum += s.months;
    return { step: s, starts_on, ends_on: addDays(addMonths(start, cum), -1) };
  });
}

// ───────────── check-in and sign-off
export function cleanProgress(progress: unknown, objectives: Objective[]): Record<string, string> | null {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null;
  const ids = objectives.map((o) => o.id);
  const p = progress as Record<string, unknown>;
  if (Object.keys(p).some((k) => !ids.includes(k))) return null;
  const out: Record<string, string> = {};
  for (const id of ids) {
    if (!(PROGRESS as readonly string[]).includes(String(p[id]))) return null;
    out[id] = String(p[id]);
  }
  return out;
}
/** Levels at sign-off: objective ids only, integers 0..3, at least one above 0. */
export function cleanObjectiveLevels(levels: unknown, objectives: Objective[]): Record<string, number> | null {
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)) return null;
  const ids = objectives.map((o) => o.id);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(levels as Record<string, unknown>)) {
    if (!ids.includes(k) || typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > ROT_LEVEL_CAP) return null;
    if (v > 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
/** Highest level achieved per skill across the objectives rated at sign-off. */
export function skillLevels(levels: Record<string, number>, objectives: Objective[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of objectives) if ((levels[o.id] ?? 0) > 0) out[o.skill_id] = Math.max(out[o.skill_id] ?? 0, levels[o.id]);
  return out;
}
/** An objective is met when the signed-off level reaches its target level. */
export const objectivesMet = (levels: Record<string, number> | null | undefined, objectives: Objective[]) => objectives.filter((o) => (levels?.[o.id] ?? 0) >= o.level).length;

/** Evidence row for one skill (kind ojt, basis evidenced, level capped at 3). */
export function rotationEvidence(refTable: 'rotation_placements' | 'shadow_requests', ref: { id: string; person_id: string }, skillId: string, level: number, on: string, by: string, title: string) {
  return {
    id: `se:ojt:${ref.id}:${skillId}`, person_id: ref.person_id, skill_id: skillId, kind: 'ojt' as const, ref_table: refTable, ref_id: ref.id,
    level: Math.min(ROT_LEVEL_CAP, Math.max(1, Math.round(level))), basis: 'evidenced' as const, status: 'current' as const, observed_on: on.slice(0, 10),
    note: `${refTable === 'rotation_placements' ? 'Rotation' : 'Shadowing'}: ${title}`, recorded_by: by, active: true,
  };
}

// ───────────── shadowing
export interface ShadowInput { host_id: string; start_on: string; days: number; skill_ids: string[]; purpose: string }
export function validateShadow(p: ShadowInput, host: { skill_ids: string[] }, today: string): { code: string; message: string } | null {
  if (!isInt(p?.days, 1, SHADOW_MAX_DAYS)) return { code: 'invalid', message: RMSG.invalid_days };
  if (!isDate(p.start_on) || p.start_on < today || dayNo(p.start_on) - dayNo(today) > 180) return { code: 'invalid', message: RMSG.invalid_shadow_start };
  const sk = Array.isArray(p.skill_ids) ? p.skill_ids : null;
  if (!sk || sk.length < 1 || sk.length > SHADOW_MAX_SKILLS || new Set(sk).size !== sk.length || sk.some((s) => !(host.skill_ids ?? []).includes(s))) return { code: 'invalid', message: RMSG.invalid_shadow_skills };
  if (len(p.purpose) < 10 || len(p.purpose) > 500) return { code: 'invalid', message: RMSG.invalid_purpose };
  return null;
}
export interface HostInput { active: boolean; skill_ids: string[]; max_days_month: number; note_en?: string; note_ar?: string }
export function validateHost(p: HostInput, skills: { id: string; area: string }[]): { code: string; message: string } | null {
  if (p?.active === false) return null;
  const area = new Map(skills.map((s) => [s.id, s.area]));
  const sk = Array.isArray(p?.skill_ids) ? p.skill_ids : null;
  if (sk && sk.some((s) => RESTRICTED_SKILL_AREAS.includes(area.get(s) ?? ''))) return { code: 'restricted_kind', message: RMSG.restricted_shadow };
  if (!sk || sk.length < 1 || sk.length > HOST_MAX_SKILLS || new Set(sk).size !== sk.length || sk.some((s) => !area.has(s)) || !isInt(p.max_days_month, 1, 10) || len(p.note_en ?? '') > 300 || len(p.note_ar ?? '') > 300)
    return { code: 'invalid', message: RMSG.invalid_host_profile };
  return null;
}
/** Consent state after one decision (the same person can be host and line manager: one approval counts for both). */
export function consentAfter(r: { host_id: string; line_manager_id: string | null; host_consent: boolean | null; manager_consent: boolean | null }, me: string, approve: boolean) {
  const host = me === r.host_id ? approve : r.host_consent;
  const mgr = me === r.line_manager_id ? approve : r.manager_consent;
  const status = host === false || mgr === false ? 'declined' : host === true && mgr === true ? 'approved' : 'requested';
  return { host_consent: host ?? null, manager_consent: mgr ?? null, status };
}

// ───────────── HR programme board (both backends; SQL mirror kafaa_rotation_board)
type CohortRow = { id: string; template_id: string; programme: string; name_en: string; name_ar: string; intake_on: string; status: string };
type PlacementRow = { id: string; person_id: string; cohort_id?: string | null; family_id: string; status: string; starts_on: string; ends_on: string; objectives: unknown; outcome_levels?: unknown; checkin_at?: string | null };
type ShadowRow = { person_id: string; status: string };
export interface CohortTile {
  cohort_id: string; template_id: string; programme: string; name_en: string; name_ar: string; intake_on: string; suppressed: boolean;
  participants: number | null; placements: number | null; signed_off: number | null; in_progress: number | null; overdue: number | null; upcoming: number | null;
  checkins_due: number | null; checkins_done: number | null; objectives_total: number | null; objectives_met: number | null; met_pct: number | null; progress_pct: number | null;
}
export interface RotationBoard {
  cohorts: CohortTile[];
  totals: { templates: number; cohorts: number; participants: number | null; placements: number | null; signed_off: number | null; objectives_total: number | null; objectives_met: number | null; met_pct: number | null; evidence_rows: number; suppressed: boolean };
  by_family: { family_id: string; people: number | null; placements: number | null; signed_off: number | null; suppressed: boolean }[];
  shadow: { requests: number | null; people: number | null; requested: number | null; approved: number | null; completed: number | null; declined: number | null; suppressed: boolean };
  min_group: number;
}
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);
const objs = (p: PlacementRow) => (Array.isArray(p.objectives) ? (p.objectives as Objective[]) : []);
const levelsOf = (p: PlacementRow) => (p.outcome_levels && typeof p.outcome_levels === 'object' ? (p.outcome_levels as Record<string, number>) : {});
function agg(rows: PlacementRow[], today: string) {
  const ph = rows.map((p) => phaseOf(p, today));
  const done = rows.filter((p) => p.status === 'signed_off');
  const due = rows.filter((p) => midpoint(p.starts_on, p.ends_on) <= today);
  const total = done.reduce((a, p) => a + objs(p).length, 0);
  const met = done.reduce((a, p) => a + objectivesMet(levelsOf(p), objs(p)), 0);
  return {
    participants: new Set(rows.map((p) => p.person_id)).size, placements: rows.length, signed_off: done.length,
    in_progress: ph.filter((x) => x === 'in_progress').length, overdue: ph.filter((x) => x === 'overdue').length, upcoming: ph.filter((x) => x === 'upcoming').length,
    checkins_due: due.length, checkins_done: due.filter((p) => !!p.checkin_at).length, objectives_total: total, objectives_met: met, met_pct: pct(met, total), progress_pct: pct(done.length, rows.length),
  };
}
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function computeBoard(templates: { status: string }[], cohorts: CohortRow[], placements: PlacementRow[], shadows: ShadowRow[], evidenceRows: number, today: string): RotationBoard {
  const live = placements.filter((p) => p.status !== 'cancelled');
  const tiles: CohortTile[] = [...cohorts].sort(byId).map((c) => {
    const a = agg(live.filter((p) => p.cohort_id === c.id), today);
    const sup = a.participants < MIN_GROUP;
    const n = (v: number | null) => (sup ? null : v);
    return {
      cohort_id: c.id, template_id: c.template_id, programme: c.programme, name_en: c.name_en, name_ar: c.name_ar, intake_on: c.intake_on, suppressed: sup,
      participants: n(a.participants), placements: n(a.placements), signed_off: n(a.signed_off), in_progress: n(a.in_progress), overdue: n(a.overdue), upcoming: n(a.upcoming),
      checkins_due: n(a.checkins_due), checkins_done: n(a.checkins_done), objectives_total: n(a.objectives_total), objectives_met: n(a.objectives_met), met_pct: n(a.met_pct), progress_pct: n(a.progress_pct),
    };
  });
  const all = agg(live, today);
  const tsup = all.participants < MIN_GROUP;
  const fams = [...new Set(live.map((p) => p.family_id))].sort();
  const sh = shadows.filter((s) => s.status !== 'withdrawn');
  const shPeople = new Set(sh.map((s) => s.person_id)).size;
  const ssup = shPeople < MIN_GROUP;
  const sc = (st: string) => (ssup ? null : sh.filter((s) => s.status === st).length);
  return {
    cohorts: tiles,
    totals: {
      templates: templates.filter((t) => t.status === 'active').length, cohorts: cohorts.length,
      participants: tsup ? null : all.participants, placements: tsup ? null : all.placements, signed_off: tsup ? null : all.signed_off,
      objectives_total: tsup ? null : all.objectives_total, objectives_met: tsup ? null : all.objectives_met, met_pct: tsup ? null : all.met_pct, evidence_rows: evidenceRows, suppressed: tsup,
    },
    by_family: fams.map((f) => {
      const rows = live.filter((p) => p.family_id === f);
      const people = new Set(rows.map((p) => p.person_id)).size;
      const s = people < MIN_GROUP;
      return { family_id: f, people: s ? null : people, placements: s ? null : rows.length, signed_off: s ? null : rows.filter((p) => p.status === 'signed_off').length, suppressed: s };
    }),
    shadow: { requests: ssup ? null : sh.length, people: ssup ? null : shPeople, requested: sc('requested'), approved: sc('approved'), completed: sc('completed'), declined: sc('declined'), suppressed: ssup },
    min_group: MIN_GROUP,
  };
}

/** The programme-owner role the caller acts in (first alphabetically), from the caller's roles and the policy grants. */
export function ownerRoleOf(hasRoleGrant: (role: string, level: string) => boolean): string | null {
  for (const r of OWNER_ROLES) if (hasRoleGrant(r, OWNER_LEVEL[r])) return r;
  return null;
}

/** A staff member a programme owner may enrol (names are shown to HR programme owners only, through rpc.rotationCandidates). */
export interface RotationCandidate { id: string; display_name: string; display_name_ar: string; job_role_id: string | null; job_family_id: string | null; eligible: boolean; enrolled: boolean; can_host: boolean }
export function computeCandidates(
  template: { id: string; eligible_families?: string[] | null } | null,
  people: { id: string; kind?: string | null; status?: string | null; display_name: string; display_name_ar?: string | null; job_role_id?: string | null; job_family_id?: string | null }[],
  placements: { person_id: string; template_id: string; status: string }[],
  hosts: HostCtx,
): RotationCandidate[] {
  const fams = template?.eligible_families ?? [];
  const enrolled = new Set(placements.filter((p) => p.template_id === template?.id && p.status !== 'cancelled').map((p) => p.person_id));
  return people
    .filter((p) => p.kind === 'staff' && p.status !== 'leaver')
    .map((p) => ({ id: p.id, display_name: p.display_name, display_name_ar: p.display_name_ar || p.display_name, job_role_id: p.job_role_id ?? null, job_family_id: p.job_family_id ?? null,
      eligible: !fams.length || fams.includes(p.job_family_id ?? ''), enrolled: enrolled.has(p.id), can_host: isHost(p.id, hosts) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

