/**
 * M36 · FS83 UAE energy consortium trainee cohort (FS wave I · E4). Pure rules, import-free apart from types (the seed builder, the
 * PGlite validator and both backends load this file). SQL twins in supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql
 * (kafaa_cc_*), proved by scripts/validate/fs94-grants-consortium.mjs.
 *
 * Benchmarks NUC-NET (Nordic NNTP: competing operators run one trainee cohort with shared modules, a project and a mentor, and site
 * visits across the members) and UAE-PEERS (EGA Academy national trainee cohorts). Builds on FS20 academies (M04): a cohort names the
 * FS20 academy whose courses its shared modules use. Partner organisations are synthetic and labelled as such; budgets are SIMULATED.
 *  - Members: ENEC trainees are staff (early career: entry level or hired in the last 5 years) nominated by HR; partner trainees are
 *    pseudonymous codes nominated by their own organisation's administrator, or by the programme office on behalf of a partner without
 *    Kafa'a access (no person record leaves the partner). Each partner reads
 *    its own trainees only (RLS OwnOrg); HR reads all; an ENEC trainee reads their own row. The HR director accepts with a mentor from
 *    ANOTHER consortium organisation (cross-employer mentoring) and a mixed project team.
 *  - Cross-site visits: logged by the trainee, their employer's administrator or the programme office; the host is another consortium
 *    organisation (never the trainee's own). Only the host confirms: the host organisation's administrator, the ENEC programme office for
 *    ENEC sites, or (hosts without Kafa'a access) the programme office on the host's behalf with the host's written confirmation reference
 *    (the FS69 on-behalf precedent). Never the visitor or whoever logged it. A confirmed visit writes evidence on the host site's focus
 *    skill (level 1; level 2 from the second confirmed visit to the same host with 12 hours or more there): F01 `ojt`, `validated`,
 *    ref_table `consortium_visits` for ENEC staff trainees; on the visit row for partner trainees (no Kafa'a skills profile).
 *  - consortiumStats(): aggregates readable by every ecosystem reader; any count of 1 to 9 is suppressed.
 */
import type { Reason } from '../../domain/engines/types';

export const DISCIPLINES = ['mechanical', 'electrical', 'chemical', 'operations', 'instrumentation', 'environmental', 'digital'] as const;
export const MEMBER_STATUSES = ['nominated', 'accepted', 'declined', 'withdrawn', 'completed'] as const;
export const ACTIVE_MEMBER = ['nominated', 'accepted'];
export const VISIT_STATUSES = ['logged', 'confirmed', 'declined', 'withdrawn'] as const;
export const TEAMS = ['A', 'B', 'C', 'D'] as const;
export const ENEC_ENTITIES = ['enec', 'enec-ops', 'enec-com', 'enec-con'] as const;
export const ENEC_TRAINEE_YEARS = 5;
export const VISIT_MIN_HOURS = 1;
export const VISIT_MAX_HOURS = 40;
export const VISIT_LOOKBACK_DAYS = 120;
export const L2_VISITS = 2;
export const L2_HOURS = 12;
export const VISIT_EVIDENCE_CAP = 2;
export const VISIT_EVIDENCE_KIND = 'ojt';
export const VISIT_REF_TABLE = 'consortium_visits';
export const MIN_GROUP = 10;

/** Email and phone patterns (identical to FS39 / F23 CONTACT_PATTERN and SQL kafaa_res_contact; a unit test keeps them equal). */
export const CONTACT_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|(\\+|00)[0-9][0-9 -]{7,}[0-9]|(^|[^0-9])0[2-9][0-9]?[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)';
const CONTACT_RE = new RegExp(CONTACT_PATTERN);

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const d10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
const validDate = (s: unknown): s is string => typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const dayNo = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const reason = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m36.reasons.${code}`, vars });
export const isEnec = (org: string | null | undefined) => !!org && (ENEC_ENTITIES as readonly string[]).includes(org);

export interface Partner { org_id: string; code: string; role: 'lead' | 'partner'; name_en: string; name_ar: string; site_en: string; site_ar: string; visit_skill: string; seats: number; kafaa_access: boolean; synthetic: boolean }
export interface Module { id: string; title_en: string; title_ar: string; host_org_id: string; starts_on: string; ends_on: string; course_id?: string | null }
export interface Mentor { id: string; org_id: string; label_en: string; label_ar: string }

// ───────────── Cohort phase and modules
export type CohortPhase = 'nominating' | 'confirmed' | 'running' | 'completed';
export function cohortPhase(c: Row, today: string): CohortPhase {
  if (today <= d10(c.nominations_close_on)) return 'nominating';
  if (today < d10(c.starts_on)) return 'confirmed';
  if (today <= d10(c.ends_on)) return 'running';
  return 'completed';
}
export type ModuleState = 'upcoming' | 'in_progress' | 'held';
export const moduleState = (m: { starts_on: string; ends_on: string }, today: string): ModuleState => (today < m.starts_on ? 'upcoming' : today <= m.ends_on ? 'in_progress' : 'held');
export const partnersOf = (c: Row): Partner[] => (Array.isArray(c?.partners) ? c.partners : []);
export const modulesOf = (c: Row): Module[] => (Array.isArray(c?.modules) ? c.modules : []);
export const mentorsOf = (c: Row): Mentor[] => (Array.isArray(c?.mentors) ? c.mentors : []);
export const partnerOf = (c: Row, org: string | null | undefined) => partnersOf(c).find((p) => p.org_id === org) ?? null;
/** The consortium organisation an ENEC entity belongs to in a cohort (ENEC is one partner, whichever entity employs the trainee). */
export const consortiumOrg = (c: Row, org: string | null | undefined) => (partnerOf(c, org) ? org! : isEnec(org) ? (partnersOf(c).find((p) => isEnec(p.org_id))?.org_id ?? null) : null);
/** Pseudonymous trainee code: <partner code>-<yy>-<nn>. */
export const traineeCode = (c: Row, org: string, n: number) => `${partnerOf(c, org)?.code ?? 'XX'}-${String(Number(c.intake_year) % 100).padStart(2, '0')}-${String(n).padStart(2, '0')}`;

// ───────────── Nominations
/** ENEC trainee: active staff at entry level or hired within the last 5 years. */
export function enecTraineeEligible(p: Row | null | undefined, today: string): boolean {
  if (!p || p.kind !== 'staff' || p.status !== 'active') return false;
  if (p.level === 'entry') return true;
  const h = d10(p.hire_date);
  return validDate(h) && h > `${Number(today.slice(0, 4)) - ENEC_TRAINEE_YEARS}${today.slice(4)}`;
}
export interface NominationInput { cohort_id: string; discipline: string; person_id?: string | null; org_id?: string | null }
/** org: the nominating organisation (a partner administrator's own; for HR the ENEC partner or a partner without Kafa'a access). */
export interface NominationCtx { cohort: Row; org: string | null; byHr: boolean; person: Row | null; activeForOrg: number; duplicate: boolean; today: string }
export type NominationProblem = 'phase' | 'org' | 'discipline' | 'person' | 'duplicate' | 'seats';
/** First problem of a nomination (SQL kafaa_cc_nom_problem): open for nominations, a partner, a discipline, the person rule, seats. */
export function nominationProblem(n: Partial<NominationInput> | null | undefined, ctx: NominationCtx): NominationProblem | null {
  if (cohortPhase(ctx.cohort, ctx.today) !== 'nominating') return 'phase';
  const p = partnerOf(ctx.cohort, ctx.org);
  // HR nominates ENEC trainees and, on the partner's behalf, trainees of partners without Kafa'a access; partners with access nominate their own.
  if (!p || (ctx.byHr && !isEnec(p.org_id) && p.kafaa_access) || (!ctx.byHr && isEnec(p.org_id))) return 'org';
  if (!n || !(DISCIPLINES as readonly string[]).includes(n.discipline as string)) return 'discipline';
  const pid = typeof n.person_id === 'string' && n.person_id ? n.person_id : null;
  if (isEnec(p.org_id) ? !enecTraineeEligible(ctx.person, ctx.today) || !pid : pid !== null) return 'person';
  if (ctx.duplicate) return 'duplicate';
  if (ctx.activeForOrg >= Number(p.seats)) return 'seats';
  return null;
}

// ───────────── Member decisions
export interface MemberDecisionInput { member_id: string; decision: string; mentor_id?: string | null; team?: string | null; note?: string | null }
export type MemberDecisionProblem = 'decision' | 'mentor' | 'team' | 'note';
/** Accept with a mentor from another consortium organisation and a project team; decline with a note (SQL kafaa_cc_decision_problem). */
export function memberDecisionProblem(d: Partial<MemberDecisionInput> | null | undefined, member: Row, cohort: Row): MemberDecisionProblem | null {
  if (!d || (d.decision !== 'accept' && d.decision !== 'decline')) return 'decision';
  const note = txt(d.note);
  if (d.decision === 'decline') return note.length < 5 || note.length > 300 ? 'note' : null;
  const m = mentorsOf(cohort).find((x) => x.id === d.mentor_id);
  if (!m || consortiumOrg(cohort, m.org_id) === consortiumOrg(cohort, member.org_id)) return 'mentor';
  if (!(TEAMS as readonly string[]).includes(d.team as string)) return 'team';
  if (note.length > 300) return 'note';
  return null;
}

// ───────────── Visits
export interface VisitInput { member_id: string; host_org_id: string; visit_on: string; hours: number; module_id?: string | null; note?: string | null }
export type VisitProblem = 'member' | 'host' | 'same_org' | 'date' | 'hours' | 'module' | 'note';
/** First problem of a visit to log (SQL kafaa_cc_visit_problem). */
export function visitProblem(v: Partial<VisitInput> | null | undefined, cohort: Row, member: Row | null, today: string): VisitProblem | null {
  if (!member || member.status !== 'accepted' || member.cohort_id !== cohort.id) return 'member';
  if (!v || typeof v.host_org_id !== 'string' || !partnerOf(cohort, v.host_org_id)) return 'host';
  if (consortiumOrg(cohort, v.host_org_id) === consortiumOrg(cohort, member.org_id)) return 'same_org';
  if (!validDate(v.visit_on) || v.visit_on < d10(cohort.starts_on) || v.visit_on > d10(cohort.ends_on) || v.visit_on > today || dayNo(today) - dayNo(v.visit_on) > VISIT_LOOKBACK_DAYS) return 'date';
  const h = v.hours;
  if (typeof h !== 'number' || !Number.isFinite(h) || h < VISIT_MIN_HOURS || h > VISIT_MAX_HOURS || Math.round(h * 2) !== h * 2) return 'hours';
  if (v.module_id != null && v.module_id !== '') {
    const m = modulesOf(cohort).find((x) => x.id === v.module_id);
    if (!m || m.host_org_id !== v.host_org_id) return 'module';
  }
  const note = v.note ?? '';
  if (typeof note !== 'string' || note.trim().length > 300 || CONTACT_RE.test(note)) return 'note';
  return null;
}
/** Evidence level of a visit confirmed now (SQL kafaa_cc_level): 2 from the second confirmed visit to the same host with 12+ hours there. */
export function visitLevel(confirmedBefore: { host_org_id: string; hours: number }[], current: { host_org_id: string; hours: number }): number {
  const same = [...confirmedBefore.filter((x) => x.host_org_id === current.host_org_id), current];
  const hours = same.reduce((m, x) => m + Number(x.hours), 0);
  return same.length >= L2_VISITS && hours >= L2_HOURS ? 2 : 1;
}
export const hostSkill = (cohort: Row, host: string) => partnerOf(cohort, host)?.visit_skill ?? null;
export type ConfirmRoute = 'host' | 'enec_host' | 'on_behalf';
/** Who may confirm a visit: the host organisation's administrator, the ENEC programme office for ENEC sites, or the programme office on
 *  behalf of a host without Kafa'a access (with the host's reference). Never the visitor or the person who logged it (checked apart). */
export function confirmRoute(visit: Row, cohort: Row, caller: { org: string | null; orgw: boolean; hr: boolean }): ConfirmRoute | null {
  const host = partnerOf(cohort, visit.host_org_id);
  if (!host) return null;
  if (isEnec(host.org_id)) return caller.hr ? 'enec_host' : null;
  if (host.kafaa_access) return caller.orgw && caller.org === host.org_id ? 'host' : null;
  return caller.hr ? 'on_behalf' : null;
}

/** Why I can or cannot be nominated as an ENEC trainee (the enecTraineeEligible rule). */
export function enecEligibilityReasons(p: Row | null | undefined, today: string): Reason[] {
  if (!p || p.kind !== 'staff' || p.status !== 'active') return [reason('cc_enec_not_staff')];
  if (p.level === 'entry') return [reason('cc_enec_entry')];
  return [reason(enecTraineeEligible(p, today) ? 'cc_enec_recent' : 'cc_enec_not_recent', { n: ENEC_TRAINEE_YEARS, date: String(p.hire_date ?? '').slice(0, 10) })];
}
export function memberReasons(m: Row, cohort: Row | null): Reason[] {
  const out: Reason[] = [reason(`cc_member_${m.status}`)];
  if (m.status === 'accepted' && cohort) {
    const mt = mentorsOf(cohort).find((x) => x.id === m.mentor_id);
    if (mt) out.push(reason('cc_mentor_other_org', { mentor: { en: mt.label_en, ar: mt.label_ar } }));
    if (m.team) out.push(reason('cc_team', { team: String(m.team) }));
  }
  if (m.decision_note && m.status === 'declined') out.push(reason('cc_decline_note'));
  return out;
}
export function visitReasons(v: Row): Reason[] {
  const out: Reason[] = [reason(`cc_visit_${v.status}`)];
  if (v.status === 'confirmed') {
    out.push(reason(v.confirmed_via === 'on_behalf' ? 'cc_confirmed_on_behalf' : 'cc_confirmed_by_host'));
    out.push(reason(v.profile_evidence ? 'cc_evidence_profile' : 'cc_evidence_record', { level: Number(v.level ?? 1) }));
  }
  if (v.status === 'logged') out.push(reason('cc_waiting_host'));
  return out;
}

// ───────────── Statistics (suppressed)
export interface Cell { value: number | null; suppressed: boolean }
export const cellOf = (v: number): Cell => (v > 0 && v < MIN_GROUP ? { value: null, suppressed: true } : { value: v, suppressed: false });
export interface CohortStat {
  cohort_id: string; phase: CohortPhase; trainees: Cell; nominated: Cell; organisations: number;
  by_org: { org_id: string; trainees: Cell }[]; visits_confirmed: Cell; visits_waiting: Cell; hours_confirmed: number | null;
  by_host: { org_id: string; confirmed: Cell }[]; evidence_rows: Cell;
}
export interface ConsortiumStats { as_of: string; min_group: number; cohorts: CohortStat[] }
/** Aggregates for every ecosystem reader (SQL kafaa_cc_stats): counts of 1-9 suppressed; confirmed hours only with 10+ confirmed visits. */
export function consortiumStats(cohorts: Row[], members: Row[], visits: Row[], today: string): ConsortiumStats {
  return {
    as_of: today, min_group: MIN_GROUP,
    cohorts: cohorts.slice().sort((a, b) => (d10(a.starts_on) < d10(b.starts_on) ? -1 : 1)).map((c): CohortStat => {
      const ms = members.filter((m) => m.cohort_id === c.id);
      const tr = ms.filter((m) => m.status === 'accepted' || m.status === 'completed');
      const vs = visits.filter((v) => v.cohort_id === c.id);
      const conf = vs.filter((v) => v.status === 'confirmed');
      return {
        cohort_id: String(c.id), phase: cohortPhase(c, today), trainees: cellOf(tr.length), nominated: cellOf(ms.filter((m) => m.status === 'nominated').length),
        organisations: partnersOf(c).length,
        by_org: partnersOf(c).map((p) => ({ org_id: p.org_id, trainees: cellOf(tr.filter((m) => consortiumOrg(c, m.org_id) === p.org_id).length) })),
        visits_confirmed: cellOf(conf.length), visits_waiting: cellOf(vs.filter((v) => v.status === 'logged').length),
        hours_confirmed: conf.length >= MIN_GROUP ? conf.reduce((m, v) => m + Number(v.hours), 0) : null,
        by_host: partnersOf(c).map((p) => ({ org_id: p.org_id, confirmed: cellOf(conf.filter((v) => v.host_org_id === p.org_id).length) })),
        evidence_rows: cellOf(conf.filter((v) => v.profile_evidence).length),
      };
    }),
  };
}
