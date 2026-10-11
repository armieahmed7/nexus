/**
 * F08 Opportunity Marketplace: pure rules shared by the LocalBackend (backend/local.ts), the seed builder
 * (scripts/seed/ext/f08-opportunities.mjs), the pages and the tests. Import-free (node loads it directly).
 * SQL mirror: supabase/migrations/20261009114001_kafaa_w1e4_opportunities.sql (kafaa_opp_line_manager, kafaa_opp_validate,
 * kafaa_opportunity_stats). Same checks, same order, same refusal codes and messages: change both together.
 */

export const OPP_KINDS = ['project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research'] as const;
export type OppKind = (typeof OPP_KINDS)[number];
/** Never listed. Posting one of these kinds or locations is refused (restricted_kind) and audited. */
export const RESTRICTED_KINDS = ['security', 'protected_area', 'cyber', 'safeguards'];
export const LOCATIONS = ['office', 'site_non_protected', 'remote'] as const;
export const RESTRICTED_LOCATIONS = ['protected_area'];
/** Skill areas that make an opportunity security work (refused like the restricted kinds). */
export const RESTRICTED_SKILL_AREAS = ['security'];
export const PRIORITY_FLAGS = ['emirati_development', 'knowledge_transfer', 'new_joiner_friendly'] as const;
export const APP_STATUSES = ['applied', 'released', 'declined_release', 'selected', 'not_selected', 'completed', 'withdrawn'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];
/** Statuses that block a new application to the same opportunity. */
export const LIVE_APP_STATUSES: AppStatus[] = ['applied', 'released', 'selected', 'completed'];
/** OJT sign-off never claims more than "level 3" (Qualified is for the qualification system, not Kafa'a). */
export const OJT_LEVEL_CAP = 3;
export const MAX_SKILLS = 6;
export const MIN_GROUP = 10;

export const MSG = {
  not_signed_in_post: 'Sign in to post an opportunity',
  forbidden_post: 'Only managers and the training manager may post opportunities',
  restricted_kind: 'Security, cyber, safeguards and protected-area work is never listed in the marketplace',
  invalid_kind: 'Unknown opportunity kind',
  invalid_location: 'Unknown location type',
  invalid_text: 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters)',
  invalid_skills: 'Choose up to six needed skills and one to six skills gained from the skills catalogue',
  invalid_hours: 'Hours per week must be between 1 and 20',
  invalid_dates: 'Start today or later, end on or after the start, and run at most 12 months',
  invalid_seats: 'Seats must be between 1 and 10',
  invalid_families: 'Unknown job family or priority flag',
  invalid_status: 'A new opportunity is either a draft or open',
  not_signed_in: 'Sign in to use the opportunity marketplace',
  forbidden_apply: 'Only staff may apply for opportunities',
  not_found: 'Opportunity not found',
  app_not_found: 'Application not found',
  not_open: 'This opportunity is not open for applications',
  own_opportunity: 'You cannot apply to your own opportunity',
  not_eligible: 'This opportunity is open to other job families',
  credential_required: 'This gig is open to holders of a strategic credential it names', // FS wave D QA (FS31)
  already_applied: 'You already have an application for this opportunity',
  invalid_note: 'Keep your note under 500 characters',
  no_line_manager: 'No line manager is recorded for you; ask HR to update your record',
  maker_checker: 'The person who posted this opportunity cannot release an applicant; the release goes to the line manager',
  forbidden_release: "Only the applicant's line manager can release them",
  not_waiting_release: 'This application is not waiting for a release decision',
  invalid_decision: 'Unknown decision',
  decline_reason: 'Give a reason when you decline a release',
  forbidden_select: 'Only the person who posted this opportunity selects applicants',
  release_required: "The applicant's line manager must release them before they can be selected",
  already_decided: 'This application has already been decided',
  no_seats: 'All seats on this opportunity are filled',
  forbidden_complete: 'Only the person who posted this opportunity signs off the outcome',
  self_signoff: 'You cannot sign off your own work',
  not_selected_yet: "Only a selected applicant's work can be signed off",
  invalid_levels: 'Rate at least one skill gained, at levels 1 to 3',
  outcome_note: 'Describe the outcome in at least one sentence',
  forbidden_withdraw: 'Only the applicant can withdraw an application',
  not_withdrawable: 'This application can no longer be withdrawn',
  forbidden_status: 'Only the poster or the training manager can change this opportunity',
  invalid_transition: 'That status change is not allowed',
  forbidden_save: 'Only staff can save opportunities',
} as const;

export interface PersonLite { id: string; manager_id?: string | null; crew?: string | null; team_id?: string | null; job_family_id?: string | null; org_id?: string | null; entity_id?: string | null; status?: string | null }
export interface AssignmentLite { person_id: string; role: string; scope_type: string; scope_value?: string | null; status: string; expires_at?: string | null }

const SCOPE_RANK: Record<string, number> = { crew: 1, team: 1, family: 2, org: 3, entity: 3, all: 4 };
const covers = (a: AssignmentLite, t: PersonLite) => {
  switch (a.scope_type) {
    case 'all': return true;
    case 'crew': return !!t.crew && t.crew === a.scope_value;
    case 'team': return !!t.team_id && t.team_id === a.scope_value;
    case 'family': return !!t.job_family_id && t.job_family_id === a.scope_value;
    case 'org': return !!t.org_id && t.org_id === a.scope_value;
    case 'entity': return !!t.entity_id && t.entity_id === a.scope_value;
    default: return false;
  }
};
/**
 * The applicant's line manager: people.manager_id when set (and not a leaver), else the holder of an active `manager`
 * assignment whose scope covers the person, narrowest scope first (crew/team, family, org/entity, all), ties by person id.
 */
export function lineManagerOf(personId: string, people: PersonLite[], assignments: AssignmentLite[], today: string): string | null {
  const byId = new Map(people.map((p) => [p.id, p]));
  const t = byId.get(personId);
  if (!t) return null;
  if (t.manager_id) {
    const m = byId.get(t.manager_id);
    if (m && m.status !== 'leaver') return m.id;
  }
  let best: { id: string; rank: number } | null = null;
  for (const a of assignments) {
    if (a.role !== 'manager' || a.status !== 'active' || (a.expires_at && String(a.expires_at).slice(0, 10) < today) || a.person_id === personId) continue;
    const h = byId.get(a.person_id);
    if (!h || h.status === 'leaver' || !covers(a, t)) continue;
    const rank = SCOPE_RANK[a.scope_type] ?? 9;
    if (!best || rank < best.rank || (rank === best.rank && a.person_id < best.id)) best = { id: a.person_id, rank };
  }
  return best?.id ?? null;
}
/** Who must release an applicant: the line manager, or the poster's own line manager when the line manager posted it. */
export function releaserFor(applicant: string, poster: string, people: PersonLite[], assignments: AssignmentLite[], today: string) {
  const lm = lineManagerOf(applicant, people, assignments, today);
  if (lm && lm !== poster) return { lineManager: lm, releaser: lm, skipLevel: false };
  const skip = lm ? lineManagerOf(poster, people, assignments, today) : null;
  return { lineManager: lm, releaser: skip && skip !== applicant ? skip : null, skipLevel: !!lm };
}

export interface OpportunityInput {
  kind: string;
  title_en: string; title_ar: string; summary_en: string; summary_ar: string;
  skills_needed: string[]; skills_gained: string[];
  hours_week: number; start_on: string; end_on: string; seats: number;
  location_type: string; eligible_families?: string[]; priority_flags?: string[];
  status?: 'draft' | 'open';
  /** FS27: future-skills gig channel (src/modules/m20/futureGigs.ts CHANNELS); null for an ordinary stretch assignment. */
  channel?: string | null;
}
const dayNo = (d: string) => Math.floor(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86_400_000);
const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : 0);
const isInt = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

/** Content checks for postOpportunity (after the sign-in and grant checks). Returns the refusal or null. */
export function validateOpportunity(p: OpportunityInput, skills: { id: string; area: string }[], families: string[], today: string): { code: string; message: string } | null {
  const area = new Map(skills.map((s) => [s.id, s.area]));
  const all = [...(p.skills_needed ?? []), ...(p.skills_gained ?? [])];
  if (RESTRICTED_KINDS.includes(String(p.kind)) || RESTRICTED_LOCATIONS.includes(String(p.location_type)) || all.some((s) => RESTRICTED_SKILL_AREAS.includes(area.get(s) ?? '')))
    return { code: 'restricted_kind', message: MSG.restricted_kind };
  if (!(OPP_KINDS as readonly string[]).includes(String(p.kind))) return { code: 'invalid', message: MSG.invalid_kind };
  if (!(LOCATIONS as readonly string[]).includes(String(p.location_type))) return { code: 'invalid', message: MSG.invalid_location };
  if (len(p.title_en) < 5 || len(p.title_en) > 120 || len(p.title_ar) < 5 || len(p.title_ar) > 120 || len(p.summary_en) < 20 || len(p.summary_en) > 1000 || len(p.summary_ar) < 20 || len(p.summary_ar) > 1000)
    return { code: 'invalid', message: MSG.invalid_text };
  const need = p.skills_needed ?? [];
  const gain = p.skills_gained ?? [];
  if (!Array.isArray(need) || !Array.isArray(gain) || need.length > MAX_SKILLS || gain.length < 1 || gain.length > MAX_SKILLS || new Set(need).size !== need.length || new Set(gain).size !== gain.length || all.some((s) => !area.has(s)))
    return { code: 'invalid', message: MSG.invalid_skills };
  if (!isInt(p.hours_week, 1, 20)) return { code: 'invalid', message: MSG.invalid_hours };
  if (!isDate(p.start_on) || !isDate(p.end_on) || p.start_on < today || p.end_on < p.start_on || dayNo(p.end_on) - dayNo(p.start_on) > 365) return { code: 'invalid', message: MSG.invalid_dates };
  if (!isInt(p.seats, 1, 10)) return { code: 'invalid', message: MSG.invalid_seats };
  if ((p.eligible_families ?? []).some((f) => !families.includes(f)) || (p.priority_flags ?? []).some((f) => !(PRIORITY_FLAGS as readonly string[]).includes(f))) return { code: 'invalid', message: MSG.invalid_families };
  if (p.status != null && p.status !== 'draft' && p.status !== 'open') return { code: 'invalid', message: MSG.invalid_status };
  return null;
}

/** Steps of an application shown in the stepper; index of the current one, or the failed step. */
export const APP_STEPS = ['applied', 'released', 'selected', 'completed'] as const;
export function stepOf(status: string): { current: number; failedAt?: number } {
  switch (status) {
    case 'applied': return { current: 1 };
    case 'released': return { current: 2 };
    case 'declined_release': return { current: 1, failedAt: 1 };
    case 'selected': return { current: 3 };
    case 'not_selected': return { current: 2, failedAt: 2 };
    case 'completed': return { current: 4 };
    case 'withdrawn': return { current: 0, failedAt: 0 };
    default: return { current: 0 };
  }
}
/** Allowed opportunity status changes through setOpportunityStatus. */
export function canTransition(from: string, to: string): boolean {
  if (to === 'open') return from === 'draft' || from === 'closed';
  if (to === 'closed') return from === 'draft' || from === 'open' || from === 'filled';
  return false;
}

export interface HistoryEntry { at: string; status: string; by: string | null; note?: string | null }

/** Evidence row written by completeOpportunity for one skill gained (kind ojt, basis evidenced). */
export function ojtEvidence(app: { id: string; person_id: string }, skillId: string, level: number, on: string, by: string, title: string) {
  return {
    id: `se:ojt:${app.id}:${skillId}`, person_id: app.person_id, skill_id: skillId, kind: 'ojt' as const, ref_table: 'opportunity_applications', ref_id: app.id,
    level: Math.min(OJT_LEVEL_CAP, Math.max(1, Math.round(level))), basis: 'evidenced' as const, status: 'current' as const, observed_on: on.slice(0, 10),
    note: `Opportunity: ${title}`, recorded_by: by, active: true,
  };
}
/** Levels submitted at sign-off: only skills gained, integers 0..3, at least one above 0. */
export function cleanLevels(levels: Record<string, unknown> | null | undefined, gained: string[]): Record<string, number> | null {
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(levels)) {
    if (!gained.includes(k) || typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > OJT_LEVEL_CAP) return null;
    if (v > 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// ───────────── HR aggregates (both backends; SQL mirror kafaa_opportunity_stats)
export interface OppStats {
  opportunities: { open: number; filled: number; closed: number; draft: number; emirati_open: number; knowledge_transfer_open: number };
  by_kind: { kind: string; open: number; total: number }[];
  funnel: { applied: number | null; released: number | null; selected: number | null; completed: number | null; applicants: number | null; suppressed: boolean };
  by_family: { family_id: string; applicants: number | null; applications: number | null; completed: number | null; suppressed: boolean }[];
  evidence_rows: number;
  min_group: number;
}
type OppRow = { id: string; kind: string; status: string; priority_flags?: string[] | null };
type AppRow = { person_id: string; status: string; applicant_family_id?: string | null; released_by?: string | null };
/** Applications by family suppressed below MIN_GROUP distinct applicants (counts of people, never names). */
export function computeStats(opps: OppRow[], apps: AppRow[], evidenceRows: number): OppStats {
  const cnt = (s: string) => opps.filter((o) => o.status === s).length;
  const open = opps.filter((o) => o.status === 'open');
  const live = apps.filter((a) => a.status !== 'withdrawn');
  const reached = (ss: string[]) => live.filter((a) => ss.includes(a.status)).length;
  const people = new Set(live.map((a) => a.person_id)).size;
  const sup = people < MIN_GROUP;
  const fams = new Map<string, AppRow[]>();
  for (const a of live) {
    const f = a.applicant_family_id ?? 'unknown';
    (fams.get(f) ?? fams.set(f, []).get(f)!).push(a);
  }
  const by_family = [...fams.entries()].map(([family_id, rows]) => {
    const n = new Set(rows.map((r) => r.person_id)).size;
    const s = n < MIN_GROUP;
    return { family_id, applicants: s ? null : n, applications: s ? null : rows.length, completed: s ? null : rows.filter((r) => r.status === 'completed').length, suppressed: s };
  }).sort((a, b) => (a.family_id < b.family_id ? -1 : a.family_id > b.family_id ? 1 : 0));
  return {
    opportunities: { open: open.length, filled: cnt('filled'), closed: cnt('closed'), draft: cnt('draft'), emirati_open: open.filter((o) => (o.priority_flags ?? []).includes('emirati_development')).length, knowledge_transfer_open: open.filter((o) => (o.priority_flags ?? []).includes('knowledge_transfer')).length },
    by_kind: OPP_KINDS.map((k) => ({ kind: k, open: open.filter((o) => o.kind === k).length, total: opps.filter((o) => o.kind === k && o.status !== 'draft').length })),
    funnel: {
      applied: sup ? null : live.length,
      released: sup ? null : live.filter((a) => !!a.released_by).length,
      selected: sup ? null : reached(['selected', 'completed']),
      completed: sup ? null : reached(['completed']),
      applicants: sup ? null : people,
      suppressed: sup,
    },
    by_family,
    evidence_rows: evidenceRows,
    min_group: MIN_GROUP,
  };
}
