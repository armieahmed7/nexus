// M36 LocalBackend RPCs for FS82 (rolling mobility micro-grants) and FS83 (UAE energy consortium trainee cohort), FS wave I · E4.
// Spread into makeLocalM36 (backend/local.ts). 1:1 mirror of supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql: the
// same checks in the same order, the same refusal codes and messages (GR_MSG, CC_MSG), one audit row for every call and every refusal,
// ledger rows on a round scheduled, a grant decided, an output accepted, a consortium place decided and a visit confirmed.
// Shared writes (like the SQL SECURITY DEFINER functions): F01 skill_evidence `se:rating:<application>:<skill>` (kind rating, basis
// validated, ref_table grant_applications) and `se:ojt:<visit>:<skill>` (kind ojt, basis validated, ref_table consortium_visits), both
// <= L2 and for ENEC staff only, then applySkills; M14 notifications (kinds `grant`, `consortium`). Rules: ../grants.ts, ../consortium.ts.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import {
  GRANT_EVIDENCE_KIND, GRANT_REF_TABLE, applicationProblem, committedIn, costTotal, decisionProblem, eligibility, grantStats, latestRound, nextRoundSlot, openRound, outputLevel,
  outputProblem, scheduleProblem, type ApplicationInput, type DecisionInput, type GrantStats, type OutputInput, type ScheduleInput,
} from '../grants';
import {
  ACTIVE_MEMBER, VISIT_EVIDENCE_KIND, VISIT_REF_TABLE, confirmRoute, consortiumOrg, consortiumStats, memberDecisionProblem, nominationProblem, partnerOf, traineeCode,
  visitLevel, visitProblem, type ConsortiumStats, type MemberDecisionInput, type NominationInput, type VisitInput,
} from '../consortium';
import type { ConfirmConsortiumVisitInput, HostVisit, M36Rpc, ReviewOutputInput } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(n / 2))), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, n);
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** User-facing refusal messages (identical in SQL). */
export const GR_MSG = {
  not_signed_in: 'Sign in to use mobility micro-grants',
  forbidden_apply: 'Mobility micro-grants are for ENEC staff (HR files for students on a sponsored placement)',
  forbidden_hr: 'Only HR schedules rounds and files on behalf of placement students',
  forbidden_decide: 'Only the HR director decides micro-grants',
  forbidden_review: 'Only HR reviews grant outputs',
  forbidden_read: 'Grant statistics are for ENEC staff, HR and auditors',
  no_round: 'No round is open for applications today',
  person: 'Choose a student on an ENEC-sponsored placement',
  consent: 'Record the student\'s consent reference (3 to 80 characters)',
  not_eligible: 'Micro-grants are for early-career staff (fewer than 10 years since hire) and students on an ENEC-sponsored placement',
  duplicate: 'There is already an application for this person in this round',
  invalid: 'Check the application: ',
  not_found: 'Application not found',
  not_yours: 'Only the applicant withdraws an application',
  not_submitted: 'Only a submitted application can be withdrawn',
  decided: 'This application is already decided',
  self_decide: 'You cannot decide your own application',
  invalid_decision: 'Check the decision: ',
  not_approved: 'Outputs are logged for approved grants only',
  output_done: 'This output is already submitted or accepted',
  invalid_output: 'Check the output: ',
  self_review: 'You cannot review your own output',
  no_output: 'There is no submitted output to review',
  review: 'Choose accept or return; returning needs a note of 5 to 300 characters',
  exists: 'The next round is already scheduled',
  invalid_schedule: 'Check the round: ',
} as const;
export const APP_PROBLEM_TEXT: Record<string, string> = {
  kind: 'choose a conference, a short course, a site visit or an exchange',
  title: 'an activity name of 5 to 160 characters without contact details',
  purpose: 'a purpose of 20 to 600 characters without contact details',
  destination: 'the organiser or place, 2 to 120 characters without contact details',
  dates: 'an activity starting after the round deadline and within 180 days of it, lasting up to 30 days',
  costs: 'one to three cost lines (transport, subsistence, registration) in whole AED, totalling 500 up to the round maximum',
  skill: 'a catalogue skill that is current and not a security skill',
  output: 'promise a report or a presentation',
};
export const DECISION_PROBLEM_TEXT: Record<string, string> = {
  round_open: 'decisions are made after the round deadline',
  decision: 'choose approve or decline',
  note: 'a note of up to 300 characters (at least 5 when declining)',
  award: 'an award from 500 up to the amount requested and the round maximum',
  budget: 'the award would take the round over its SIMULATED budget',
};
export const OUTPUT_PROBLEM_TEXT: Record<string, string> = {
  too_early: 'log the output after the activity has ended',
  kind: 'choose a report or a presentation',
  title: 'a title of 5 to 160 characters without contact details',
  summary: 'a summary of 20 to 1200 characters without contact details',
};
export const SCHEDULE_PROBLEM_TEXT: Record<string, string> = {
  exists: 'the next round is already scheduled',
  budget: 'a SIMULATED budget from 10,000 to 500,000 AED',
  award: 'a maximum award from 1,000 to 25,000 AED, not above the budget',
  note: 'a note of up to 300 characters without contact details',
};
export const CC_MSG = {
  not_signed_in: 'Sign in to use the consortium cohort',
  forbidden_nominate: 'Only a consortium partner\'s administrator (own trainees) or HR (ENEC trainees) nominates',
  cohort_not_found: 'Cohort not found',
  invalid_nomination: 'Check the nomination: ',
  forbidden_decide: 'Only the HR director decides consortium places',
  member_not_found: 'Trainee not found',
  decided: 'This nomination is already decided',
  self_decide: 'You cannot decide your own place',
  invalid_decision: 'Check the decision: ',
  forbidden_log: 'Only the trainee, their employer\'s administrator or the programme office logs a visit',
  invalid_visit: 'Check the visit: ',
  visit_not_found: 'Visit not found',
  not_host: 'Only the host organisation confirms this visit',
  self_confirm: 'The visitor or whoever logged the visit cannot confirm it',
  visit_decided: 'This visit is already decided',
  decision: 'Choose confirm or decline',
  reason: 'Give a reason (5 to 300 characters) when you decline',
  host_ref: 'Record the host\'s written confirmation reference (3 to 80 characters)',
  not_yours: 'Only the trainee or whoever logged the visit withdraws it',
  forbidden_read: 'Consortium figures are for ENEC staff, partners, universities, HR and auditors',
} as const;
export const NOM_PROBLEM_TEXT: Record<string, string> = {
  phase: 'nominations for this cohort are closed',
  org: 'nominate for your own organisation (a partner in this cohort); HR nominates ENEC trainees and trainees of partners without Kafa\'a access',
  discipline: 'choose a discipline',
  person: 'ENEC trainees are active early-career staff (entry level or hired in the last 5 years); partner trainees carry no person record',
  duplicate: 'this person already holds a place or a nomination in the cohort',
  seats: 'your organisation\'s seats in this cohort are taken',
};
export const MEMBER_PROBLEM_TEXT: Record<string, string> = {
  decision: 'choose accept or decline',
  mentor: 'choose a mentor from another consortium organisation',
  team: 'choose a project team from A to D',
  note: 'a note of 5 to 300 characters when declining (up to 300 otherwise)',
};
export const VISIT_PROBLEM_TEXT: Record<string, string> = {
  member: 'the trainee must hold an accepted place in this cohort',
  host: 'choose a host organisation of the cohort',
  same_org: 'a cross-site visit is to another consortium organisation, not the trainee\'s own',
  date: 'a date within the cohort, not in the future and in the last 120 days',
  hours: '1 to 40 hours in half-hour steps',
  module: 'choose a module hosted by that organisation, or none',
  note: 'a note of up to 300 characters without contact details',
};

export type Fs82Rpc = Pick<M36Rpc, 'scheduleGrantRound' | 'applyGrant' | 'withdrawGrant' | 'decideGrant' | 'submitGrantOutput' | 'reviewGrantOutput' | 'grantStats'
  | 'nominateConsortiumTrainee' | 'decideConsortiumMember' | 'logConsortiumVisit' | 'confirmConsortiumVisit' | 'withdrawConsortiumVisit' | 'consortiumHostVisits' | 'consortiumStats'>;

export function makeLocalFs82(b: LocalBackend, h: LocalRpcHelpers): Fs82Rpc {
  const me = () => b.identity().personId;
  const myOrg = () => b.identity().orgId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  /** HR = the HR analyst and the HR director (ecosystem W/A and workforce_strategy W/A). */
  const isHr = () => ctx().has('ecosystem', ['W', 'A']) && ctx().has('workforce_strategy', ['W', 'A']);
  /** HR A = the HR director (ecosystem A and workforce_strategy W/A; platform admins hold workforce_strategy R only). */
  const isHrDirector = () => ctx().has('ecosystem', ['A']) && ctx().has('workforce_strategy', ['W', 'A']);
  const hrRole = () => ctx().actingRole('workforce_strategy', ['W', 'A']);
  const skillsMap = () => Object.fromEntries(raw('skills').map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
  const onPlacement = (pid: string) => raw('scholars').some((s) => s.person_id === pid && s.status === 'in_study');
  const notify = (id: string, pid: string | null | undefined, kind: string, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !get('people', pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind, title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };

  return {
    // ═════════════ FS82
    async scheduleGrantRound(input: ScheduleInput) {
      await b.whenReady();
      type R = { id: string; opens_on: string; closes_on: string; decide_by: string };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('grant.round.schedule', 'grant_rounds', null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', GR_MSG.not_signed_in);
      if (!isHr()) return refuse('forbidden', GR_MSG.forbidden_hr);
      const role = hrRole();
      const today = todayIso();
      const rounds = raw('grant_rounds');
      const problem = scheduleProblem(input, rounds, today);
      if (problem === 'exists') return refuse('exists', GR_MSG.exists, role);
      if (problem) return refuse('invalid', GR_MSG.invalid_schedule + SCHEDULE_PROBLEM_TEXT[problem], role);
      const slot = nextRoundSlot(latestRound(rounds)?.closes_on ?? null, today);
      if (get('grant_rounds', slot.id)) return refuse('exists', GR_MSG.exists, role);
      const note = txt(input.note);
      ins('grant_rounds', { ...slot, budget: input.budget, max_award: input.max_award, currency: 'AED', note: note || null, simulated: true, created_by: pid, created_at: nowTs(), sample: false });
      return h.done<R>('grant.round.schedule', 'grant_rounds', slot.id, `${slot.opens_on}..${slot.closes_on} budget ${input.budget} max ${input.max_award}`, role, 'kafaa.grant.round',
        `Micro-grant round ${slot.id} scheduled (${input.budget} AED SIMULATED)`, 'Round scheduled', slot, ['grant_rounds']);
    },

    async applyGrant(input: ApplicationInput) {
      await b.whenReady();
      type R = { id: string; round_id: string; amount: number };
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('grant.apply', 'grant_applications', null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', GR_MSG.not_signed_in);
      const given = typeof input?.person_id === 'string' && input.person_id ? input.person_id : null;
      const onBehalf = given !== null && given !== pid;
      let role: string | null;
      if (onBehalf) {
        if (!isHr()) return refuse('forbidden', GR_MSG.forbidden_hr);
        role = hrRole();
      } else {
        if (!ctx().has('ecosystem', ['Own'])) return refuse('forbidden', GR_MSG.forbidden_apply);
        role = ctx().actingRole('ecosystem', ['Own']);
      }
      const target = onBehalf ? given! : pid;
      const today = todayIso();
      const round = openRound(raw('grant_rounds'), today);
      if (!round) return refuse('no_round', GR_MSG.no_round, role);
      const person = get('people', target);
      const placement = onBehalf && onPlacement(target);
      if (onBehalf && !(person && person.kind === 'applicant' && placement)) return refuse('invalid', GR_MSG.person, role);
      const consent = txt(input?.consent_ref);
      if (onBehalf && (consent.length < 3 || consent.length > 80)) return refuse('invalid', GR_MSG.consent, role);
      if (!eligibility(person, today, placement).eligible) return refuse('not_eligible', GR_MSG.not_eligible, role);
      if (raw('grant_applications').some((a) => a.round_id === round.id && a.person_id === target && a.status !== 'withdrawn')) return refuse('duplicate', GR_MSG.duplicate, role);
      const problem = applicationProblem(input, { closes_on: String(round.closes_on), max_award: Number(round.max_award), skills: skillsMap() });
      if (problem) return refuse('invalid', GR_MSG.invalid + APP_PROBLEM_TEXT[problem], role);
      const id = `ga-${hex(12)}`;
      const amount = costTotal(input.costs);
      const ts = nowTs();
      ins('grant_applications', {
        id, round_id: round.id, person_id: target, initials: person?.initials ?? '', job_role_id: person?.job_role_id ?? null, years: eligibility(person, today, placement).years, basis: placement ? 'placement' : 'early_career', kind: input.kind, title: txt(input.title), purpose: txt(input.purpose), destination: txt(input.destination),
        starts_on: input.starts_on, ends_on: input.ends_on, costs: input.costs.map((c) => ({ item: c.item, amount: c.amount })), amount, skill_id: input.skill_id, output_kind: input.output_kind,
        status: 'submitted', awarded: null, decided_by: null, decided_at: null, decision_note: null, output_status: 'none', output: {}, output_reviewed_by: null, output_reviewed_at: null, output_note: null,
        evidence: [], profile_evidence: false, on_behalf: onBehalf, consent_ref: onBehalf ? consent : null, created_by: pid, created_at: ts, updated_at: ts, sample: false,
      });
      return h.done<R>('grant.apply', 'grant_applications', id, `${input.kind} ${amount} AED ${round.id}${onBehalf ? ' on behalf' : ''}`, role, null, '', 'Application submitted',
        { id, round_id: String(round.id), amount }, ['grant_applications']);
    },

    async withdrawGrant(applicationId: string) {
      await b.whenReady();
      type R = { id: string; status: string };
      const aid = str(applicationId);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('grant.withdraw', 'grant_applications', aid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', GR_MSG.not_signed_in);
      const app = get('grant_applications', aid);
      const hr = isHr();
      if (!app || (app.person_id !== pid && !(app.on_behalf && hr))) return refuse('not_found', GR_MSG.not_found);
      const role = app.person_id === pid ? ctx().actingRole('ecosystem', ['Own']) : hrRole();
      if (app.status !== 'submitted') return refuse('invalid', GR_MSG.not_submitted, role);
      upd('grant_applications', aid, { status: 'withdrawn', updated_at: nowTs() });
      return h.done<R>('grant.withdraw', 'grant_applications', aid, 'withdrawn', role, null, '', 'Application withdrawn', { id: aid, status: 'withdrawn' }, ['grant_applications']);
    },

    async decideGrant(input: DecisionInput) {
      await b.whenReady();
      type R = { id: string; status: string; awarded: number | null; committed: number };
      const aid = str(input?.application_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('grant.decide', 'grant_applications', aid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', GR_MSG.not_signed_in);
      if (!isHrDirector()) return refuse('forbidden', GR_MSG.forbidden_decide);
      const role = ctx().actingRole('ecosystem', ['A']);
      const app = get('grant_applications', aid);
      if (!app) return refuse('not_found', GR_MSG.not_found, role);
      if (app.status !== 'submitted') return refuse('decided', GR_MSG.decided, role);
      if (app.person_id === pid) return refuse('maker_checker', GR_MSG.self_decide, role);
      const round = get('grant_rounds', app.round_id)!;
      const today = todayIso();
      const committed = committedIn(raw('grant_applications'), String(round.id));
      const problem = decisionProblem(input, app, round, committed, today);
      if (problem) return refuse(problem === 'round_open' || problem === 'budget' ? problem : 'invalid', GR_MSG.invalid_decision + DECISION_PROBLEM_TEXT[problem], role);
      const approve = input.decision === 'approve';
      const award = approve ? (input.award == null ? Number(app.amount) : Number(input.award)) : null;
      const note = txt(input.note);
      upd('grant_applications', aid, { status: approve ? 'approved' : 'declined', awarded: award, decided_by: pid, decided_at: nowTs(), decision_note: note || null, updated_at: nowTs() });
      notify(`nt-gr-${aid}-decided`, app.person_id, 'grant', approve ? 'Your mobility micro-grant was approved' : 'Your mobility micro-grant was not approved',
        approve ? 'تمت الموافقة على منحة التنقل الصغيرة' : 'لم تتم الموافقة على منحة التنقل الصغيرة', '/my/grants', approve ? 'ok' : 'warn');
      return h.done<R>('grant.decide', 'grant_applications', aid, approve ? `approved ${award}` : `declined: ${note}`, role, 'kafaa.grant.decide',
        `Micro-grant ${aid} ${approve ? `approved (${award} AED SIMULATED)` : 'declined'}`, approve ? 'Grant approved' : 'Grant declined',
        { id: aid, status: approve ? 'approved' : 'declined', awarded: award, committed: committed + (award ?? 0) }, ['grant_applications', 'notifications']);
    },

    async submitGrantOutput(input: OutputInput) {
      await b.whenReady();
      type R = { id: string; output_status: string };
      const aid = str(input?.application_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('grant.output.submit', 'grant_applications', aid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', GR_MSG.not_signed_in);
      const app = get('grant_applications', aid);
      const mine = !!app && app.person_id === pid && ctx().has('ecosystem', ['Own']);
      const hrFor = !!app && !!app.on_behalf && isHr();
      if (!app || (!mine && !hrFor)) return refuse('not_found', GR_MSG.not_found);
      const role = mine ? ctx().actingRole('ecosystem', ['Own']) : hrRole();
      if (app.status !== 'approved') return refuse('invalid', GR_MSG.not_approved, role);
      if (app.output_status === 'submitted' || app.output_status === 'accepted') return refuse('invalid', GR_MSG.output_done, role);
      const today = todayIso();
      const problem = outputProblem(input, app, today);
      if (problem) return refuse(problem === 'too_early' ? 'too_early' : 'invalid', GR_MSG.invalid_output + OUTPUT_PROBLEM_TEXT[problem], role);
      const ts = nowTs();
      upd('grant_applications', aid, { output_status: 'submitted', output: { kind: input.kind, title: txt(input.title), summary: txt(input.summary), submitted_by: pid, submitted_at: ts }, output_note: null, updated_at: ts });
      return h.done<R>('grant.output.submit', 'grant_applications', aid, `${input.kind} submitted`, role, null, '', 'Output submitted for review', { id: aid, output_status: 'submitted' }, ['grant_applications']);
    },

    async reviewGrantOutput(input: ReviewOutputInput) {
      await b.whenReady();
      type R = { id: string; output_status: string; level: number | null; profile_evidence: boolean };
      const aid = str(input?.application_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('grant.output.review', 'grant_applications', aid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', GR_MSG.not_signed_in);
      if (!isHr()) return refuse('forbidden', GR_MSG.forbidden_review);
      const role = hrRole();
      const app = get('grant_applications', aid);
      if (!app) return refuse('not_found', GR_MSG.not_found, role);
      if (app.person_id === pid || (app.output ?? {}).submitted_by === pid) return refuse('maker_checker', GR_MSG.self_review, role);
      if (app.status !== 'approved' || app.output_status !== 'submitted') return refuse('invalid', GR_MSG.no_output, role);
      const note = txt(input?.note);
      const dec = input?.decision;
      if ((dec !== 'accept' && dec !== 'return') || note.length > 300 || (dec === 'return' && note.length < 5)) return refuse('invalid', GR_MSG.review, role);
      const ts = nowTs();
      if (dec === 'return') {
        upd('grant_applications', aid, { output_status: 'returned', output_reviewed_by: pid, output_reviewed_at: ts, output_note: note, updated_at: ts });
        notify(`nt-gr-${aid}-returned`, app.person_id, 'grant', 'Your grant output needs changes', 'تحتاج مخرجات منحتك إلى تعديلات', '/my/grants', 'warn');
        return h.done<R>('grant.output.review', 'grant_applications', aid, `returned: ${note}`, role, null, '', 'Output returned with a note', { id: aid, output_status: 'returned', level: null, profile_evidence: false },
          ['grant_applications', 'notifications']);
      }
      const kind = String((app.output ?? {}).kind ?? app.output_kind);
      const level = outputLevel(kind);
      const person = get('people', app.person_id);
      const profile = person?.kind === 'staff';
      const evidence = [{ skill_id: app.skill_id, level }];
      if (profile) {
        const eid = evidenceId(GRANT_EVIDENCE_KIND, aid, app.skill_id);
        if (!get('skill_evidence', eid)) {
          ins('skill_evidence', {
            id: eid, person_id: app.person_id, skill_id: app.skill_id, kind: GRANT_EVIDENCE_KIND, ref_table: GRANT_REF_TABLE, ref_id: aid, level, basis: 'validated', status: 'current',
            observed_on: String(app.ends_on).slice(0, 10), note: `Mobility grant output (${kind}) accepted by HR`, recorded_by: pid, active: true, created_at: ts,
          });
        }
      }
      upd('grant_applications', aid, { output_status: 'accepted', output_reviewed_by: pid, output_reviewed_at: ts, output_note: note || null, evidence, profile_evidence: profile, updated_at: ts });
      if (profile) await applySkills(b, app.person_id, todayIso());
      notify(`nt-gr-${aid}-accepted`, app.person_id, 'grant', 'Your grant output was accepted', 'تم قبول مخرجات منحتك', '/my/grants', 'ok');
      return h.done<R>('grant.output.review', 'grant_applications', aid, `accepted L${level}`, role, 'kafaa.grant.output_accept', `Micro-grant output ${aid} accepted (level ${level})`, 'Output accepted',
        { id: aid, output_status: 'accepted', level, profile_evidence: profile }, ['grant_applications', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async grantStats() {
      await b.whenReady();
      if (!me()) return h.refuse<GrantStats>('grant.stats', 'grant_applications', null, 'not_signed_in', GR_MSG.not_signed_in);
      if (!(ctx().has('ecosystem', ['Own', 'W', 'A']) || (ctx().has('ecosystem', ['R']) && ctx().has('internal_content', ['R']))))
        return h.refuse<GrantStats>('grant.stats', 'grant_applications', null, 'forbidden', GR_MSG.forbidden_read);
      return { ok: true, code: 'ok', message: 'Micro-grant statistics', data: grantStats(raw('grant_rounds'), raw('grant_applications'), todayIso()) } as Result<GrantStats>;
    },

    // ═════════════ FS83
    async nominateConsortiumTrainee(input: NominationInput) {
      await b.whenReady();
      type R = { id: string; trainee_code: string };
      const cid = str(input?.cohort_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('consortium.nominate', 'consortium_members', cid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CC_MSG.not_signed_in);
      const mine = myOrg();
      const orgw = !!mine && ctx().has('ecosystem', ['OrgW']);
      const hr = isHr();
      if (!orgw && !hr) return refuse('forbidden', CC_MSG.forbidden_nominate);
      const role = orgw ? ctx().actingRole('ecosystem', ['OrgW']) : hrRole();
      const cohort = get('consortium_cohorts', cid);
      if (!cohort) return refuse('not_found', CC_MSG.cohort_not_found, role);
      const givenOrg = typeof input?.org_id === 'string' && input.org_id ? input.org_id : null;
      const org = orgw ? (givenOrg && givenOrg !== mine ? null : mine) : givenOrg ? consortiumOrg(cohort, givenOrg) : consortiumOrg(cohort, 'enec');
      const personId = typeof input?.person_id === 'string' && input.person_id ? input.person_id : null;
      const person = personId ? get('people', personId) ?? null : null;
      const members = raw('consortium_members').filter((m) => m.cohort_id === cid);
      const today = todayIso();
      const problem = nominationProblem(input, {
        cohort, org, byHr: !orgw, person, today,
        activeForOrg: members.filter((m) => consortiumOrg(cohort, m.org_id) === org && ACTIVE_MEMBER.includes(m.status)).length,
        duplicate: !!personId && members.some((m) => m.person_id === personId && ACTIVE_MEMBER.includes(m.status)),
      });
      if (problem) return refuse('invalid', CC_MSG.invalid_nomination + NOM_PROBLEM_TEXT[problem], role);
      let n = members.filter((m) => consortiumOrg(cohort, m.org_id) === org).length + 1;
      while (members.some((m) => m.trainee_code === traineeCode(cohort, org!, n))) n++;
      const code = traineeCode(cohort, org!, n);
      const id = `cm-${cid}-${code.toLowerCase()}`;
      ins('consortium_members', {
        id, cohort_id: cid, org_id: person ? (person.org_id ?? org) : org, person_id: personId, initials: person?.initials ?? null, trainee_code: code, discipline: input.discipline, status: 'nominated', nominated_by: pid,
        nominated_at: nowTs(), decided_by: null, decided_at: null, decision_note: null, mentor_id: null, team: null, open_read: false, sample: false,
      });
      return h.done<R>('consortium.nominate', 'consortium_members', id, `${org} ${input.discipline}${personId ? ` ${personId}` : ''}`, role, null, '', 'Nomination recorded',
        { id, trainee_code: code }, ['consortium_members']);
    },

    async decideConsortiumMember(input: MemberDecisionInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const mid = str(input?.member_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('consortium.member.decide', 'consortium_members', mid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CC_MSG.not_signed_in);
      if (!isHrDirector()) return refuse('forbidden', CC_MSG.forbidden_decide);
      const role = ctx().actingRole('ecosystem', ['A']);
      const m = get('consortium_members', mid);
      if (!m) return refuse('not_found', CC_MSG.member_not_found, role);
      if (m.status !== 'nominated') return refuse('decided', CC_MSG.decided, role);
      if (m.person_id && m.person_id === pid) return refuse('maker_checker', CC_MSG.self_decide, role);
      const cohort = get('consortium_cohorts', m.cohort_id)!;
      const problem = memberDecisionProblem(input, m, cohort);
      if (problem) return refuse('invalid', CC_MSG.invalid_decision + MEMBER_PROBLEM_TEXT[problem], role);
      const accept = input.decision === 'accept';
      const note = txt(input.note);
      upd('consortium_members', mid, { status: accept ? 'accepted' : 'declined', decided_by: pid, decided_at: nowTs(), decision_note: note || null, mentor_id: accept ? input.mentor_id : null, team: accept ? input.team : null });
      notify(`nt-cc-${mid}-decided`, m.person_id, 'consortium', accept ? 'Your consortium trainee place is confirmed' : 'Your consortium nomination was not accepted',
        accept ? 'تم تأكيد مقعدك في دفعة المتدربين المشتركة' : 'لم يتم قبول ترشيحك لدفعة المتدربين المشتركة', '/my/consortium', accept ? 'ok' : 'warn');
      return h.done<R>('consortium.member.decide', 'consortium_members', mid, accept ? `accepted mentor ${input.mentor_id} team ${input.team}` : `declined: ${note}`, role, 'kafaa.consortium.member',
        `Consortium place ${m.trainee_code} ${accept ? 'accepted' : 'declined'}`, accept ? 'Place confirmed' : 'Nomination declined', { id: mid, status: accept ? 'accepted' : 'declined' },
        ['consortium_members', 'notifications']);
    },

    async logConsortiumVisit(input: VisitInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const mid = str(input?.member_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('consortium.visit.log', 'consortium_visits', null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CC_MSG.not_signed_in);
      const mine = myOrg();
      const own = ctx().has('ecosystem', ['Own']);
      const orgw = !!mine && ctx().has('ecosystem', ['OrgW']);
      const hr = isHr();
      if (!own && !orgw && !hr) return refuse('forbidden', CC_MSG.forbidden_log);
      const m = get('consortium_members', mid);
      const self = !!m && !!m.person_id && m.person_id === pid && own;
      const employer = !!m && orgw && m.org_id === mine;
      if (!m || (!self && !employer && !hr)) return refuse('not_found', CC_MSG.member_not_found);
      const via = self ? 'self' : employer ? 'employer' : 'programme';
      const role = self ? ctx().actingRole('ecosystem', ['Own']) : employer ? ctx().actingRole('ecosystem', ['OrgW']) : hrRole();
      const cohort = get('consortium_cohorts', m.cohort_id)!;
      const today = todayIso();
      const problem = visitProblem(input, cohort, m, today);
      if (problem) return refuse('invalid', CC_MSG.invalid_visit + VISIT_PROBLEM_TEXT[problem], role);
      const id = `cv-${hex(12)}`;
      const skill = partnerOf(cohort, input.host_org_id)!.visit_skill;
      ins('consortium_visits', {
        id, cohort_id: cohort.id, member_id: mid, org_id: m.org_id, person_id: m.person_id ?? null, trainee_code: m.trainee_code, host_org_id: input.host_org_id,
        module_id: input.module_id ? input.module_id : null, visit_on: input.visit_on, hours: input.hours, note: txt(input.note), skill_id: skill, status: 'logged', logged_by: pid, logged_via: via,
        confirmed_via: null, host_ref: null, decided_by: null, decided_at: null, decline_reason: null, level: 0, evidence: [], profile_evidence: false, created_at: nowTs(), open_read: false, sample: false,
      });
      return h.done<R>('consortium.visit.log', 'consortium_visits', id, `${m.trainee_code} at ${input.host_org_id} ${input.hours}h (${via})`, role, null, '', 'Visit logged; the host will confirm it',
        { id, status: 'logged' }, ['consortium_visits']);
    },

    async confirmConsortiumVisit(input: ConfirmConsortiumVisitInput) {
      await b.whenReady();
      type R = { id: string; status: string; level: number; profile_evidence: boolean };
      const vid = str(input?.visit_id);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('consortium.visit.decide', 'consortium_visits', vid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CC_MSG.not_signed_in);
      const mine = myOrg();
      const caller = { org: mine, orgw: !!mine && ctx().has('ecosystem', ['OrgW']), hr: isHr() };
      if (!caller.orgw && !caller.hr) return refuse('forbidden', CC_MSG.not_host);
      const v = get('consortium_visits', vid);
      if (!v) return refuse('not_found', CC_MSG.visit_not_found);
      const cohort = get('consortium_cohorts', v.cohort_id)!;
      const route = confirmRoute(v, cohort, caller);
      if (!route) return refuse('forbidden', CC_MSG.not_host);
      const role = route === 'host' ? ctx().actingRole('ecosystem', ['OrgW']) : hrRole();
      if (v.person_id === pid || v.logged_by === pid) return refuse('maker_checker', CC_MSG.self_confirm, role);
      if (v.status !== 'logged') return refuse('invalid', CC_MSG.visit_decided, role);
      const dec = input?.decision;
      if (dec !== 'confirm' && dec !== 'decline') return refuse('invalid', CC_MSG.decision, role);
      const ts = nowTs();
      if (dec === 'decline') {
        const reasonTxt = txt(input.reason);
        if (reasonTxt.length < 5 || reasonTxt.length > 300) return refuse('invalid', CC_MSG.reason, role);
        upd('consortium_visits', vid, { status: 'declined', decided_by: pid, decided_at: ts, decline_reason: reasonTxt, confirmed_via: route });
        notify(`nt-cv-${vid}-declined`, v.person_id, 'consortium', 'Your consortium visit was not confirmed by the host', 'لم تؤكد الجهة المضيفة زيارتك ضمن الدفعة المشتركة', '/my/consortium', 'warn');
        return h.done<R>('consortium.visit.decide', 'consortium_visits', vid, `declined (${route})`, role, null, '', 'Visit declined', { id: vid, status: 'declined', level: 0, profile_evidence: false },
          ['consortium_visits', 'notifications']);
      }
      const ref = txt(input.host_ref);
      if (route === 'on_behalf' && (ref.length < 3 || ref.length > 80)) return refuse('invalid', CC_MSG.host_ref, role);
      const before = raw('consortium_visits').filter((x) => x.member_id === v.member_id && x.status === 'confirmed' && x.id !== vid).map((x) => ({ host_org_id: String(x.host_org_id), hours: Number(x.hours) }));
      const level = visitLevel(before, { host_org_id: String(v.host_org_id), hours: Number(v.hours) });
      const person = v.person_id ? get('people', v.person_id) : undefined;
      const profile = person?.kind === 'staff';
      if (profile) {
        const eid = evidenceId(VISIT_EVIDENCE_KIND, vid, v.skill_id);
        if (!get('skill_evidence', eid)) {
          ins('skill_evidence', {
            id: eid, person_id: v.person_id, skill_id: v.skill_id, kind: VISIT_EVIDENCE_KIND, ref_table: VISIT_REF_TABLE, ref_id: vid, level, basis: 'validated', status: 'current',
            observed_on: String(v.visit_on).slice(0, 10), note: 'Consortium cross-site visit confirmed by the host', recorded_by: pid, active: true, created_at: ts,
          });
        }
      }
      upd('consortium_visits', vid, {
        status: 'confirmed', decided_by: pid, decided_at: ts, confirmed_via: route, host_ref: route === 'on_behalf' ? ref : (ref || null), level, evidence: [{ skill_id: v.skill_id, level }], profile_evidence: profile,
      });
      if (profile) await applySkills(b, v.person_id, todayIso());
      notify(`nt-cv-${vid}-confirmed`, v.person_id, 'consortium', 'Your consortium visit was confirmed by the host', 'أكدت الجهة المضيفة زيارتك ضمن الدفعة المشتركة', '/my/consortium', 'ok');
      return h.done<R>('consortium.visit.decide', 'consortium_visits', vid, `confirmed L${level} (${route})`, role, 'kafaa.consortium.visit_confirm',
        `Consortium visit ${vid} confirmed by the host (level ${level})`, 'Visit confirmed', { id: vid, status: 'confirmed', level, profile_evidence: profile },
        ['consortium_visits', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async withdrawConsortiumVisit(visitId: string) {
      await b.whenReady();
      type R = { id: string; status: string };
      const vid = str(visitId);
      const refuse = (code: string, msg: string, r: string | null = null) => h.refuse<R>('consortium.visit.withdraw', 'consortium_visits', vid || null, code, msg, r);
      const pid = me();
      if (!pid) return refuse('not_signed_in', CC_MSG.not_signed_in);
      const v = get('consortium_visits', vid);
      if (!v) return refuse('not_found', CC_MSG.visit_not_found);
      if (v.person_id !== pid && v.logged_by !== pid) return refuse('forbidden', CC_MSG.not_yours);
      if (v.status !== 'logged') return refuse('invalid', CC_MSG.visit_decided);
      upd('consortium_visits', vid, { status: 'withdrawn' });
      return h.done<R>('consortium.visit.withdraw', 'consortium_visits', vid, 'withdrawn', null, null, '', 'Visit withdrawn', { id: vid, status: 'withdrawn' }, ['consortium_visits']);
    },

    async consortiumHostVisits() {
      await b.whenReady();
      if (!me()) return h.refuse<HostVisit[]>('consortium.host_visits', 'consortium_visits', null, 'not_signed_in', CC_MSG.not_signed_in);
      const mine = myOrg();
      const caller = { org: mine, orgw: !!mine && ctx().has('ecosystem', ['OrgW']), hr: isHr() };
      if (!caller.orgw && !caller.hr) return h.refuse<HostVisit[]>('consortium.host_visits', 'consortium_visits', null, 'forbidden', CC_MSG.not_host);
      const cohorts = Object.fromEntries(raw('consortium_cohorts').map((c) => [c.id, c]));
      const data: HostVisit[] = raw('consortium_visits')
        .map((v) => ({ v, route: cohorts[v.cohort_id] ? confirmRoute(v, cohorts[v.cohort_id], caller) : null }))
        .filter((x) => x.route !== null)
        .sort((a, c) => (String(a.v.visit_on) === String(c.v.visit_on) ? (a.v.id < c.v.id ? -1 : 1) : String(a.v.visit_on) < String(c.v.visit_on) ? 1 : -1))
        .map(({ v, route }) => {
          const o = get('organisations', v.org_id);
          return {
            id: v.id, cohort_id: v.cohort_id, trainee_code: v.trainee_code, org_id: v.org_id, org_name_en: o?.name_en ?? v.org_id, org_name_ar: o?.name_ar ?? o?.name_en ?? v.org_id,
            host_org_id: v.host_org_id, module_id: v.module_id ?? null, visit_on: String(v.visit_on).slice(0, 10), hours: Number(v.hours), note: v.note ?? '', skill_id: v.skill_id, status: v.status,
            level: Number(v.level ?? 0), confirmed_via: v.confirmed_via ?? null, route: route!,
          };
        });
      return { ok: true, code: 'ok', message: 'Visits to confirm as host', data } as Result<HostVisit[]>;
    },

    async consortiumStats() {
      await b.whenReady();
      if (!me()) return h.refuse<ConsortiumStats>('consortium.stats', 'consortium_members', null, 'not_signed_in', CC_MSG.not_signed_in);
      if (!ctx().has('ecosystem', ['R', 'Own', 'OwnOrg', 'OrgW', 'Agg', 'W', 'A'])) return h.refuse<ConsortiumStats>('consortium.stats', 'consortium_members', null, 'forbidden', CC_MSG.forbidden_read);
      return { ok: true, code: 'ok', message: 'Consortium figures', data: consortiumStats(raw('consortium_cohorts'), raw('consortium_members'), raw('consortium_visits'), todayIso()) } as Result<ConsortiumStats>;
    },
  };
}
