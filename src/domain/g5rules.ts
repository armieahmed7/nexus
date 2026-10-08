/**
 * G5 business rules (M08 safety culture, M13 Dalil, M14 access, M16 admin). Pure functions shared by pages, the
 * LocalBackend RPC mirror and unit tests; the SQL RPCs in supabase/migrations/20261008135001_kafaa_g5_core.sql
 * implement the same checks. Kept in a separate file from rules.ts so the foundation file stays untouched.
 */
import type { PlatformRole } from '../auth/policy';
import { addWorkingDays, daysBetween, todayIso } from './rules';

// ───────────── M13 Dalil
export type DalilModeName = 'public' | 'applicant' | 'staff' | 'partner';
const STAFF_ROLES: PlatformRole[] = ['employee', 'licensed_operator', 'manager', 'instructor', 'training_manager', 'licensing_coord', 'hr_analyst', 'hr_director', 'editor', 'ecp_officer', 'admin', 'auditor'];
const PARTNER_ROLES: PlatformRole[] = ['partner_user', 'partner_admin', 'university'];

/** Which Dalil modes a caller may use. Anonymous visitors get public mode only (spec M13 "cannot reach staff-mode content"). */
export function dalilModeAllowed(mode: DalilModeName, roles: readonly PlatformRole[], signedIn: boolean): boolean {
  if (mode === 'public') return true;
  if (!signedIn) return false;
  if (mode === 'applicant') return true; // any signed-in person may ask about their own applications
  if (mode === 'staff') return roles.some((r) => STAFF_ROLES.includes(r));
  if (mode === 'partner') return roles.some((r) => PARTNER_ROLES.includes(r));
  return false;
}
/** The richest mode the caller can use; the /ask page starts there. */
export function defaultDalilMode(roles: readonly PlatformRole[], signedIn: boolean): DalilModeName {
  if (!signedIn) return 'public';
  if (roles.some((r) => STAFF_ROLES.includes(r))) return 'staff';
  if (roles.some((r) => PARTNER_ROLES.includes(r))) return 'partner';
  return 'applicant';
}
export function availableDalilModes(roles: readonly PlatformRole[], signedIn: boolean): DalilModeName[] {
  return (['public', 'applicant', 'staff', 'partner'] as DalilModeName[]).filter((m) => dalilModeAllowed(m, roles, signedIn));
}
/** Marker stored instead of the user's words when Dalil detects a concern (Kafa'a never holds a concern). */
export const CONCERN_WITHHELD = '[withheld: concern; Dalil showed the ECP channels]';
/** Who receives a Dalil hand-off notice. */
export const HANDOFF_ROLES: Record<'careers' | 'training' | 'partner_desk', string[]> = {
  careers: ['hr_analyst', 'hr_director'],
  training: ['training_manager'],
  partner_desk: ['admin'],
};

// ───────────── M08 ECP referral workflow (metadata only)
export const CONCERN_STATUSES = ['received', 'triaged', 'investigating', 'referred', 'closed'] as const;
export const CONCERN_OUTCOMES = ['substantiated', 'not_substantiated', 'referred_cap', 'referred_hr', 'referred_external', 'no_action'] as const;
const NEXT: Record<string, string[]> = {
  received: ['received', 'triaged'],
  triaged: ['triaged', 'investigating', 'referred', 'closed'],
  investigating: ['investigating', 'referred', 'closed'],
  referred: ['referred', 'closed'],
  closed: [],
};
export function allowedConcernNext(from: string): string[] {
  return NEXT[from] ?? [];
}
/** Returns a user-facing reason when a triage step is not allowed, or null. */
export function concernTransitionError(from: string, to: string, priority: string, outcome: string | null): string | null {
  if (!(CONCERN_STATUSES as readonly string[]).includes(to)) return 'Unknown status';
  if (!['routine', 'priority', 'urgent'].includes(priority)) return 'Unknown priority';
  if (from === 'closed') return "A closed referral cannot be reopened in Kafa'a; reopen it in the ECP system";
  if (!allowedConcernNext(from).includes(to)) return `A referral cannot move from ${from} to ${to}`;
  if (to === 'closed' && !(outcome && (CONCERN_OUTCOMES as readonly string[]).includes(outcome))) return 'Closing needs an outcome category';
  if (to !== 'closed' && outcome) return 'An outcome is recorded only when closing';
  return null;
}
/** Demo service target: triage within 2 UAE working days of receipt (Kafa'a demo rule, not an ENEC procedure). */
export const TRIAGE_TARGET_WORKING_DAYS = 2;
export function triageDue(receivedOn: string): string {
  return addWorkingDays(receivedOn, TRIAGE_TARGET_WORKING_DAYS);
}
export function triageOverdue(c: { status: string; received_on: string }, today = todayIso()): boolean {
  return c.status === 'received' && triageDue(c.received_on) < today;
}

// ───────────── M14 access reviews (quarterly for elevated roles)
export const ELEVATED_ROLES: PlatformRole[] = ['admin', 'auditor', 'hr_director', 'licensing_coord', 'training_manager', 'ecp_officer', 'instructor', 'hr_analyst', 'editor'];
export const ACCESS_REVIEW_DAYS = 92;
export function accessReviewState(a: { role: string; status: string; granted_at: string; reviewed_at?: string | null }, today = todayIso()): 'not_required' | 'ok' | 'due' | 'overdue' {
  if (a.status !== 'active' || !ELEVATED_ROLES.includes(a.role as PlatformRole)) return 'not_required';
  const last = a.reviewed_at ?? a.granted_at;
  const age = daysBetween(last.slice(0, 10), today);
  if (age > ACCESS_REVIEW_DAYS) return 'overdue';
  if (age > ACCESS_REVIEW_DAYS - 14) return 'due';
  return 'ok';
}

// ───────────── M16 content workflow
export type ContentStatus = 'draft' | 'in_translation' | 'in_review' | 'published';
/** A page publishes only when both languages are approved and (unless it makes no factual claims) it cites a source. */
export function publishBlockers(p: { translation_status: string; sources?: unknown[] | null; no_factual_claims?: boolean | null; ecp_owned?: boolean | null; review_on?: string | null; body_en?: string; body_ar?: string }): string[] {
  const out: string[] = [];
  if (p.ecp_owned) out.push('ecp_owned');
  if (p.translation_status !== 'both_approved') out.push('translation');
  if (!p.no_factual_claims && !(Array.isArray(p.sources) && p.sources.length > 0)) out.push('sources');
  if (!p.review_on) out.push('review_date');
  if (!p.body_en?.trim() || !p.body_ar?.trim()) out.push('body');
  return out;
}
export function reviewOverdue(p: { review_on?: string | null }, today = todayIso()): boolean {
  return !!p.review_on && p.review_on < today;
}

// ───────────── M16 integrations
export function syncState(i: { status: string; last_success: string; threshold_hours: number }, now = new Date()): 'ok' | 'degraded' | 'stale' | 'error' | 'disabled' {
  if (i.status === 'disabled' || i.status === 'error') return i.status;
  const hours = (now.getTime() - new Date(i.last_success).getTime()) / 3_600_000;
  if (hours > i.threshold_hours) return 'stale';
  return i.status === 'degraded' ? 'degraded' : 'ok';
}

// ───────────── M12 contact routing (role mailboxes, never a named person)
export const CONTACT_ROUTES: Record<string, string> = {
  careers: 'Careers team (role mailbox)',
  programmes: 'Talent programmes team (role mailbox)',
  suppliers: 'Supplier development (role mailbox)',
  universities: 'University partnerships (role mailbox)',
  media: 'Media relations (role mailbox)',
  accessibility: 'Digital accessibility (role mailbox)',
  other: 'General enquiries (role mailbox)',
};
