/**
 * FS28 Future-role rotations and external secondments (FS wave D · E1, M20): pure rules shared by the LocalBackend
 * (backend/fs28.local.ts), the seed builder (scripts/seed/ext/fs27-future-gigs.mjs), the pages and the tests.
 * Node loads this file directly, so it imports only rotation.ts (dates) and types.
 * SQL mirror: supabase/migrations/20261010241001_kafaa_fs41_future_gigs_secondments.sql (kafaa_fs28_* helpers,
 * kafaa_tag_future_rotation, kafaa_plan_secondment, kafaa_close_secondment, kafaa_secondment_desk).
 *
 * - Future-role rotation templates: an F15 template tagged with a future track (digital twin, data office, ADVANCE study team,
 *   energy transition) and the FS05 concept roles it prepares for. ADVANCE study is career-level only: no deployment decision implied.
 * - External secondment: host (IAEA, partner utility, vendor, university, research centre), objectives tied to catalogue skills,
 *   a duration, a host supervisor (a role, never a name) and a return-and-transfer obligation: closing a secondment on return
 *   creates a knowledge-capture session (M24) due within 60 days of the return date.
 * - Security, cyber and safeguards staff, skills and roles are never offered a placement (restricted_kind).
 */
import { addDays, addMonths, RESTRICTED_FAMILIES, RESTRICTED_SKILL_AREAS } from './rotation.ts';

export const HOST_KINDS = ['iaea', 'partner_utility', 'vendor', 'university', 'research_centre'] as const;
export const TRACKS = ['digital_twin', 'data_office', 'advance_study', 'energy_transition'] as const;
export type Track = (typeof TRACKS)[number];
/** Tracks that must stay at career level (no deployment decision implied, no headcount, no site). */
export const CAREER_LEVEL_TRACKS = ['advance_study'];
export const SEC_STATUSES = ['planned', 'returned', 'cancelled'] as const;
export const TRANSFER_DAYS = 60;
/** The capture session is planned three weeks after return, never after the due date and never in the past. */
export const CAPTURE_AFTER_DAYS = 21;
export const MAX_OBJECTIVES = 5;
export const MAX_FUTURE_ROLES = 4;
export const MIN_GROUP = 10;
export const HR_ROLES = ['hr_analyst', 'hr_director'] as const;

export const SMSG = {
  not_signed_in: 'Sign in to use secondments',
  forbidden_hr: 'Only HR (the CHCO office and HR analysts) plans and closes secondments',
  restricted: 'Security, cyber and safeguards work is career-path only and is never offered as a secondment or rotation',
  person_not_found: 'Person not found',
  invalid_host_kind: 'Choose the IAEA, a partner utility, a vendor, a university or a research centre',
  invalid_host: 'Give the host in English and Arabic (3 to 120 characters) and a two-letter country code',
  invalid_supervisor: 'Name the host supervisor by role in English and Arabic (3 to 120 characters), never by name',
  invalid_objectives: 'Give one to five objectives, each tied to a catalogue skill at level 1 to 3, in English and Arabic (5 to 200 characters)',
  invalid_dates: 'Start between today and twelve months from now, for 1 to 24 months',
  invalid_org: 'Unknown host organisation',
  invalid_role: 'Choose a current or concept role from the career map',
  invalid_track: 'Unknown future track',
  overlap: 'This person already has a secondment planned for these dates',
  no_line_manager: 'No line manager is recorded for this person; update their record first',
  not_found: 'Secondment not found',
  invalid_decision: 'Unknown decision',
  closed: 'This secondment is already closed',
  invalid_return: 'Record a return date between the start of the secondment and today, at most 30 days ago',
  invalid_outcome: 'Describe the outcome in at least one sentence (10 to 1,000 characters)',
  invalid_met: 'Say for every objective whether it was met',
  cancel_reason: 'Give a reason when you cancel',
  no_interviewer: 'Nobody can run the knowledge-capture session; record a line manager for this person first',
  forbidden_owner: 'Only HR programme owners and the training manager manage rotation programmes',
  template_not_found: 'Rotation programme not found',
  invalid_roles: 'Choose up to four current or concept roles (never security, cyber or safeguards roles)',
} as const;

const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : -1);
const isInt = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const between = (s: unknown, lo: number, hi: number) => len(s) >= lo && len(s) <= hi;

// ───────────── future-role rotation tagging
export interface TagInput { template_id: string; track: string | null; future_role_ids: string[] }
type RoleRef = { id: string; family_id?: string | null; lifecycle?: string | null };
export function validateTag(p: TagInput, roles: RoleRef[]): { code: string; message: string } | null {
  const ids = Array.isArray(p?.future_role_ids) ? p.future_role_ids : null;
  const byId = new Map(roles.map((r) => [r.id, r]));
  if ((ids ?? []).some((id) => RESTRICTED_FAMILIES.includes(String(byId.get(String(id))?.family_id ?? '')))) return { code: 'restricted_kind', message: SMSG.restricted };
  if (p?.track != null && !(TRACKS as readonly string[]).includes(String(p.track))) return { code: 'invalid', message: SMSG.invalid_track };
  if (!ids || ids.length > MAX_FUTURE_ROLES || new Set(ids).size !== ids.length || ids.some((id) => { const r = byId.get(String(id)); return !r || !['current', 'concept'].includes(String(r.lifecycle ?? 'current')); }))
    return { code: 'invalid', message: SMSG.invalid_roles };
  return null;
}

// ───────────── secondment plan
export interface SecObjectiveInput { skill_id: string; level: number; text_en: string; text_ar: string }
export interface SecondmentInput {
  person_id: string; host_kind: string; host_org_id?: string | null; host_name_en: string; host_name_ar: string; host_country: string;
  supervisor_en: string; supervisor_ar: string; objectives: SecObjectiveInput[]; future_role_id?: string | null; track?: string | null; start_on: string; months: number;
}
export interface SecRef {
  people: { id: string; kind?: string | null; status?: string | null; job_family_id?: string | null }[];
  skills: { id: string; area: string }[];
  roles: RoleRef[];
  orgs: string[];
}
/** Content checks for planSecondment (after the sign-in and HR checks). Returns the refusal or null. */
export function validateSecondment(p: SecondmentInput, ref: SecRef, today: string): { code: string; message: string } | null {
  const person = ref.people.find((x) => x.id === p?.person_id);
  const area = new Map(ref.skills.map((s) => [s.id, s.area]));
  const role = p?.future_role_id ? ref.roles.find((r) => r.id === p.future_role_id) : undefined;
  const objs = Array.isArray(p?.objectives) ? p.objectives : null;
  if (RESTRICTED_FAMILIES.includes(String(person?.job_family_id ?? '')) || RESTRICTED_FAMILIES.includes(String(role?.family_id ?? ''))
    || (objs ?? []).some((o) => RESTRICTED_SKILL_AREAS.includes(area.get(String(o?.skill_id)) ?? '')))
    return { code: 'restricted_kind', message: SMSG.restricted };
  if (!person || person.kind !== 'staff' || person.status !== 'active') return { code: 'not_found', message: SMSG.person_not_found };
  if (!(HOST_KINDS as readonly string[]).includes(String(p.host_kind))) return { code: 'invalid', message: SMSG.invalid_host_kind };
  if (!between(p.host_name_en, 3, 120) || !between(p.host_name_ar, 3, 120) || typeof p.host_country !== 'string' || !/^[A-Z]{2}$/.test(p.host_country)) return { code: 'invalid', message: SMSG.invalid_host };
  if (!between(p.supervisor_en, 3, 120) || !between(p.supervisor_ar, 3, 120)) return { code: 'invalid', message: SMSG.invalid_supervisor };
  if (!objs || objs.length < 1 || objs.length > MAX_OBJECTIVES || new Set(objs.map((o) => o?.skill_id)).size !== objs.length
    || objs.some((o) => !o || !area.has(String(o.skill_id)) || !isInt(o.level, 1, 3) || !between(o.text_en, 5, 200) || !between(o.text_ar, 5, 200)))
    return { code: 'invalid', message: SMSG.invalid_objectives };
  if (!isDate(p.start_on) || p.start_on < today || p.start_on > addDays(today, 365) || !isInt(p.months, 1, 24)) return { code: 'invalid', message: SMSG.invalid_dates };
  if (p.host_org_id != null && p.host_org_id !== '' && !ref.orgs.includes(p.host_org_id)) return { code: 'invalid', message: SMSG.invalid_org };
  if (p.future_role_id != null && p.future_role_id !== '' && (!role || !['current', 'concept'].includes(String(role.lifecycle ?? 'current')))) return { code: 'invalid', message: SMSG.invalid_role };
  if (p.track != null && p.track !== '' && !(TRACKS as readonly string[]).includes(String(p.track))) return { code: 'invalid', message: SMSG.invalid_track };
  return null;
}
/** Last day of a secondment of `months` starting on `start` (SQL: start + make_interval(months) - 1). */
export const endOf = (start: string, months: number) => addDays(addMonths(start, months), -1);
/** Objective rows stored on the secondment (ids o1..o5). */
export const objectivesOf = (objs: SecObjectiveInput[]) => objs.map((o, i) => ({ id: `o${i + 1}`, skill_id: o.skill_id, level: o.level, text_en: o.text_en.trim(), text_ar: o.text_ar.trim() }));

// ───────────── close (return or cancel)
export interface CloseInput { returned_on?: string | null; outcome_note?: string | null; met?: Record<string, unknown> | null }
type SecLite = { status: string; start_on: string; end_on: string; objectives: { id: string }[] | null };
export function validateClose(s: SecLite, decision: string, p: CloseInput, today: string): { code: string; message: string } | null {
  if (decision !== 'return' && decision !== 'cancel') return { code: 'invalid', message: SMSG.invalid_decision };
  if (s.status !== 'planned') return { code: 'invalid', message: SMSG.closed };
  if (decision === 'cancel') return len(p?.outcome_note) >= 5 ? null : { code: 'invalid', message: SMSG.cancel_reason };
  const r = p?.returned_on;
  if (!isDate(r) || (r as string) < s.start_on || (r as string) > today || (r as string) < addDays(today, -30)) return { code: 'invalid', message: SMSG.invalid_return };
  if (!between(p.outcome_note, 10, 1000)) return { code: 'invalid', message: SMSG.invalid_outcome };
  const met = p.met;
  if (!met || typeof met !== 'object' || Array.isArray(met) || (s.objectives ?? []).some((o) => typeof met[o.id] !== 'boolean') || Object.keys(met).some((k) => !(s.objectives ?? []).some((o) => o.id === k)))
    return { code: 'invalid', message: SMSG.invalid_met };
  return null;
}
export const transferDue = (returnedOn: string) => addDays(returnedOn, TRANSFER_DAYS);
/** Planned date of the knowledge-capture session: three weeks after return, not before today, never after the due date. */
export function capturePlannedOn(returnedOn: string, today: string): string {
  const due = transferDue(returnedOn);
  const want = addDays(returnedOn, CAPTURE_AFTER_DAYS);
  const d = want < today ? today : want;
  return d > due ? due : d;
}
export const captureTitle = (hostEn: string) => `Secondment return: what I learned at ${hostEn}`.slice(0, 140);

// ───────────── views
export type SecPhase = 'upcoming' | 'on_secondment' | 'return_due' | 'returned' | 'cancelled';
export function phaseOf(s: { status: string; start_on: string; end_on: string }, today: string): SecPhase {
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'returned') return 'returned';
  if (s.start_on > today) return 'upcoming';
  if (s.end_on < today) return 'return_due';
  return 'on_secondment';
}
export type TransferState = 'none' | 'due' | 'overdue' | 'done';
/** Return-and-transfer obligation: done once the capture session is held or transcribed; overdue after the due date. */
export function transferState(s: { status: string; transfer_due_on?: string | null }, session: { status: string } | null | undefined, today: string): TransferState {
  if (s.status !== 'returned' || !s.transfer_due_on) return 'none';
  if (session && (session.status === 'held' || session.status === 'transcribed')) return 'done';
  return today > s.transfer_due_on ? 'overdue' : 'due';
}

export interface SecDeskStats {
  total: number;
  by_phase: Record<SecPhase, number>;
  by_host: { host_kind: string; n: number | null; suppressed: boolean }[];
  transfer: Record<TransferState, number>;
  people: number | null; suppressed: boolean;
  min_group: number;
}
type DeskSec = { person_id: string; host_kind: string; status: string; start_on: string; end_on: string; transfer_due_on?: string | null; capture_session_id?: string | null };
/** HR desk and staff overview aggregates; host-kind cells suppressed below MIN_GROUP secondments, people below MIN_GROUP. */
export function secondmentStats(secs: DeskSec[], sessions: Map<string, { status: string }>, today: string): SecDeskStats {
  const by_phase = { upcoming: 0, on_secondment: 0, return_due: 0, returned: 0, cancelled: 0 } as Record<SecPhase, number>;
  const transfer = { none: 0, due: 0, overdue: 0, done: 0 } as Record<TransferState, number>;
  for (const s of secs) {
    by_phase[phaseOf(s, today)]++;
    transfer[transferState(s, s.capture_session_id ? sessions.get(s.capture_session_id) : null, today)]++;
  }
  const live = secs.filter((s) => s.status !== 'cancelled');
  const people = new Set(live.map((s) => s.person_id)).size;
  return {
    total: secs.length,
    by_phase,
    by_host: HOST_KINDS.map((k) => { const n = live.filter((s) => s.host_kind === k).length; return { host_kind: k, n: n < MIN_GROUP ? null : n, suppressed: n < MIN_GROUP }; }),
    transfer,
    people: people < MIN_GROUP ? null : people,
    suppressed: people < MIN_GROUP,
    min_group: MIN_GROUP,
  };
}

/** Design references (research pack nuclear_energy.md sections 5 and 24; read 2026-10-10). Figures live in kafaa_benchmarks only. */
export const FS28_REFS = [
  { id: 'nea-nest', label_en: 'OECD-NEA NEST: fellows learn inside real multinational projects', label_ar: 'إطار NEST لدى وكالة الطاقة النووية: يتعلّم الزملاء داخل مشاريع دولية حقيقية', url: 'https://oecd-nea.org/jcms/pl_98798/nest-framework-five-years-of-international-co-operation-on-nuclear-education-and-skills-development', as_of: '2026-10-10' },
  { id: 'iaea-mscfp', label_en: 'IAEA MSCFP: study is paired with a placement or internship', label_ar: 'برنامج IAEA MSCFP: تقترن الدراسة بتدريب أو تنسيب عملي', url: 'https://www.iaea.org/node/136445', as_of: '2026-10-10' },
] as const;
