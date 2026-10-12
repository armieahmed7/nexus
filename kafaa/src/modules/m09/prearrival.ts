/**
 * FS69 Contractor pre-arrival check with selective disclosure (FS wave G · E5, M09): pure rules shared by the pages, the LocalBackend
 * (backend/local.fs75.ts) and, rule for rule, the SQL in supabase/migrations/20261010275001_kafaa_fs75_supplier_readiness.sql
 * (kafaa_pa_*). Import-free apart from the FS32 learner-record rules and the F33 pre-check (both import-free), so node loads it.
 *
 *   share     an FS32 share link (kafaa_record_shares: token, items, expiry, revocation) plus an M09 pre-arrival row naming the
 *             qualification standard and the mobilisation date. The contractor chooses the items (three consent gates). Contractors
 *             hold no Kafa'a grant on the live backend, so an ENEC evaluator may record the share on the contractor's behalf with the
 *             reference of the contractor's signed consent (the FS29 precedent: an assessor opens on their behalf).
 *   check     the F33 pre-check run against the shared skill items only (never the rest of the passport, never prior equivalency
 *             requests). Shared badges and qualification lines are shown as supporting items. The check is guidance: it writes no
 *             skill evidence, no skill state, no qualification record and no equivalency status.
 *   expiry    a link works until its expiry day (FS32 rule, 1-90 days) and must last at least until mobilisation; an expired or revoked
 *             link shows nothing personal and the check is refused.
 */
import { SHARE_RULES, shareProblem, shareView, type RecordItem, type ShareInput } from '../m17/learnerRecord.ts';
import { precheck, type Precheck, type PrecheckInput } from './contractor.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export const PA_RULES = { consentRefMin: 3, consentRefMax: 80, mobiliseMaxDays: 90, noteMax: 300 } as const;

/** Refusal and result messages: identical in SQL. */
export const PA_MSG = {
  not_signed_in: 'Sign in first',
  forbidden: 'Only the contractor, or an ENEC evaluator recording the contractor\'s consent, can create a pre-arrival share',
  not_contractor: 'Pre-arrival shares are for contractor passports only',
  invalid: 'Choose 1 to 30 items, a label of 3 to 80 characters and an expiry between 1 and 90 days from today',
  consent_required: 'Confirm all three consent steps before the link is created',
  consent_ref: 'Record the reference of the contractor\'s signed consent (3 to 80 characters)',
  not_shareable: 'Some items are not the contractor\'s or cannot be shared (security and medical details never are)',
  mobilise: 'Choose a mobilisation date from today to the link\'s expiry date',
  standard: 'Qualification standard not found',
  security: "Security qualifications are not handled through equivalency in Kafa'a",
  too_many: 'Up to 10 active share links per person: revoke one first',
  created: 'Pre-arrival share created',
  not_found: 'Pre-arrival share not found',
  already_closed: 'This link is already revoked or expired',
  revoke_reason: 'Give the contractor\'s reason for revoking (3 to 300 characters)',
  revoked: 'Pre-arrival share revoked',
  check_forbidden: 'Only an ENEC evaluator can run the pre-arrival check',
  expired: 'This link has expired: ask the contractor for a new share',
  revoked_closed: 'The contractor revoked this link',
  check_ok: 'Pre-arrival check ready. It uses the shared items only and is guidance: an ENEC evaluator decides equivalency on arrival.',
  view_ok: 'Pre-arrival share',
} as const;

export interface PrearrivalInput extends ShareInput {
  person_id?: string | null;
  standard_id: string;
  mobilise_on: string;
  consent_ref?: string | null;
  note?: string | null;
}
const isDay = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

/**
 * Input check after access and the standard lookup (same order and codes as kafaa_pa_problem): the FS32 share rules, the consent
 * reference when recorded on behalf, then the mobilisation date (today .. expiry).
 */
export function prearrivalProblem(x: PrearrivalInput, available: RecordItem[], today: string, onBehalf: boolean): 'ok' | 'invalid' | 'consent_required' | 'not_shareable' | 'consent_ref' | 'mobilise' {
  const s = shareProblem(x, available, today);
  if (s !== 'ok') return s;
  if (onBehalf) {
    const ref = typeof x.consent_ref === 'string' ? x.consent_ref.trim() : '';
    if (ref.length < PA_RULES.consentRefMin || ref.length > PA_RULES.consentRefMax) return 'consent_ref';
  }
  if (!isDay(x.mobilise_on)) return 'mobilise';
  const d = dayDiff(today, x.mobilise_on);
  if (d < 0 || x.mobilise_on > x.expires_on) return 'mobilise';
  return 'ok';
}

/** The shared items still shareable today, in record order (what the evaluator may see). */
export const sharedItems = (available: RecordItem[], refs: string[]) => { const want = new Set(refs ?? []); return available.filter((i) => want.has(i.ref)); };
/** Skill states for the pre-check from the shared skill items only. */
export const sharedStates = (personId: string, shared: RecordItem[]): Row[] =>
  shared.filter((i) => i.kind === 'skill').map((i) => ({ person_id: personId, skill_id: i.id, level: Number(i.level ?? 0), basis: i.status, active: true }));

export interface PrearrivalCheck extends Precheck { share_id: string; shared: RecordItem[]; skills_used: number }
export interface CheckSummary { standard_id: string; total: number; likely: number; partial: number; gaps: number; critical_gaps: number; coverage: number; outlook: string; skills_used: number }

/** The F33 pre-check against the shared skills only (no prior equivalency requests). Same as kafaa_pa_check. */
export function precheckFromShare(shareId: string, personId: string, shared: RecordItem[], i: Omit<PrecheckInput, 'person_id' | 'states' | 'requests'>): PrearrivalCheck {
  const states = sharedStates(personId, shared);
  const p = precheck({ ...i, person_id: personId, states, requests: [] });
  return { ...p, share_id: shareId, shared, skills_used: states.length };
}
export const checkSummary = (p: PrearrivalCheck): CheckSummary => ({
  standard_id: p.standard_id, total: p.total, likely: p.likely, partial: p.partial, gaps: p.gaps, critical_gaps: p.critical_gaps, coverage: p.coverage, outlook: p.outlook, skills_used: p.skills_used,
});

export { SHARE_RULES, shareView };
