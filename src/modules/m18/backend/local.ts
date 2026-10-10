// M18 LocalBackend RPC implementations (owner: W1 engineer 2). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of kafaa_career_readiness / kafaa_roadmap_to_plan in supabase/migrations/20261009112001_kafaa_w1e2_career.sql:
// same checks, refusal codes, audit rows and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { careerFacts, careerReadiness, MAX_ROLES, type CareerData, type CareerReadiness } from '../career';
import { conceptReadiness, transitionEvidence, type ConceptData, type ConceptReadiness, type MoveRow, type TransitionEvidence } from '../futureRoles';
import { computeLabels, criteriaFor, type CriteriaRow, type LabelData, type OutlookLabel } from '../outlookLabels';
import type { M18Rpc, OutlookPreview, OutlookPublishResult, RoadmapToPlanResult, SubmitPrepResult, RecordConversationResult, AcknowledgeResult, ReminderResult } from './rpc';
import {
  aspirationOf, buildAgenda, cadenceState, conversationInsightsOf, cycleOf, goalIdFor, isIsoDate, lastHeldOf, normActions, normPrep, pairsOf, planIdFor, activityId,
  teamRowsOf, addDaysIso, HELD_BACK_DAYS, MAX_COMMENT, MAX_NOTES, MAX_PEOPLE, type Agenda, type AgendaTables, type AspirationSignal, type ConvRow, type ConversationInsights, type PeopleRow, type TeamRow,
} from '../conversations';
import { lineManagerOf, type AssignmentLite } from '../../m20/domain';

const PLAN_KINDS = ['course', 'mentoring', 'project'];
const OPEN_PLAN = ['draft', 'submitted', 'approved', 'active'];

/** The tables careerReadiness reads, as definer (both backends read the same rows). */
export function careerDataFrom(b: LocalBackend, personId: string): CareerData {
  const w = b.rawGet('engine_settings', 'recommend')?.weights;
  return {
    people: b.raw('people').filter((p) => p.id === personId),
    roles: b.raw('job_roles'),
    edges: b.raw('career_paths') as never,
    roleComps: b.raw('role_competencies'),
    competencies: b.raw('competencies'),
    skills: b.raw('skills'),
    states: b.raw('person_skills').filter((s) => s.person_id === personId),
    licences: b.raw('licences').filter((s) => s.person_id === personId),
    standards: b.raw('qual_standards'),
    qualRecords: b.raw('qual_records').filter((s) => s.person_id === personId),
    programmes: b.raw('programmes'),
    courses: b.raw('courses'),
    trainingRecords: b.raw('training_records').filter((s) => s.person_id === personId),
    enrolments: b.raw('enrolments').filter((s) => s.person_id === personId),
    weights: w && typeof w === 'object' ? Object.fromEntries(Object.entries(w as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number> : undefined,
  };
}

/** F12: the tables the agenda reads for one person, as definer. */
export function agendaTablesFrom(b: LocalBackend, personId: string): AgendaTables {
  const mine = <T extends { person_id: string }>(rows: T[]) => rows.filter((r) => r.person_id === personId);
  return {
    ...careerDataFrom(b, personId),
    skillRows: b.raw('skills') as never,
    competencyRows: b.raw('competencies') as never,
    personSkills: mine(b.raw('person_skills')) as never,
    targets: mine(b.raw('career_targets')) as never,
    roadmaps: mine(b.raw('roadmaps')) as never,
    qualRows: mine(b.raw('qual_records')) as never,
    standardRows: b.raw('qual_standards') as never,
    goals: mine(b.raw('learning_goals')) as never,
    feedback: mine(b.raw('coach_feedback')) as never,
    training: mine(b.raw('training_records')) as never,
    conversations: mine(b.raw('career_conversations')) as never,
    versions: b.raw('role_profile_versions') as never, // FS wave B: concept targets (FS15)
  };
}

/** FS15: the tables concept readiness reads, as definer. */
export function conceptDataFrom(b: LocalBackend, personId: string): ConceptData {
  const c = careerDataFrom(b, personId);
  return { roles: b.raw('job_roles') as never, versions: b.raw('role_profile_versions') as never, edges: b.raw('career_paths') as never, skills: b.raw('skills') as never, competencies: c.competencies, states: c.states, weights: c.weights };
}
/** FS16: the inputs of the outlook labels, as definer: the latest released F35 outlook and the published FS05 versions. */
export function labelDataFrom(b: LocalBackend): LabelData {
  const released = (b.raw('skill_outlooks') as unknown as { id: string; status: string; released_at: string | null; results: unknown }[])
    .filter((o) => o.status === 'released').sort((x, y) => (String(y.released_at ?? '') < String(x.released_at ?? '') ? -1 : String(y.released_at ?? '') > String(x.released_at ?? '') ? 1 : x.id < y.id ? -1 : 1))[0] ?? null;
  return { roles: b.raw('job_roles') as never, roleComps: b.raw('role_competencies') as never, skills: b.raw('skills') as never, outlook: released ? { id: released.id, results: released.results } : null, versions: b.raw('role_profile_versions') as never };
}
const emptyCounts = (): Record<OutlookLabel, number> => ({ growing: 0, stable: 0, changing: 0 });
const randomId = (prefix: string) => {
  const a = new Uint8Array(8);
  globalThis.crypto.getRandomValues(a);
  return prefix + [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const COMPACT = (o: Record<string, unknown>) => JSON.parse(JSON.stringify(o));

export function makeLocalM18(b: LocalBackend, h: LocalRpcHelpers): M18Rpc {
  const people = () => b.raw('people') as unknown as PeopleRow[];
  const assignments = () => b.raw('role_assignments') as unknown as AssignmentLite[];
  const convs = () => b.raw('career_conversations') as unknown as ConvRow[];
  const lm = (personId: string) => lineManagerOf(personId, people(), assignments(), todayIso());
  const notify = (id: string, personId: string, title_en: string, title_ar: string, link: string, severity: 'info' | 'ok' | 'warn' | 'bad', body_en: string | null = null, body_ar: string | null = null) => {
    if (b.rawGet('notifications', id)) return false;
    b.rawInsert('notifications', { id, person_id: personId, kind: 'career_conversation', title_en, title_ar, body_en, body_ar, link, severity, created_at: nowTs(), read_at: null } as never);
    return true;
  };
  return {
    async careerReadiness(personId, roleIds) {
      await b.whenReady();
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<CareerReadiness[]>('career.readiness', 'career_targets', personId ?? null, code, msg, null);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to see your career readiness');
      if (!personId || !b.rawGet('people', personId)) return refuse('not_found', 'Person not found');
      if (personId === who.personId) {
        if (!ctx.has('skills_profile', ['Own', 'Scope'])) return refuse('forbidden', 'Career readiness is for staff with a skills profile');
      } else {
        const shared = b.raw('career_targets').some((t) => t.person_id === personId && t.shared && t.active) || b.raw('roadmaps').some((r) => r.person_id === personId && r.shared && r.active);
        if (!(ctx.has('skills_profile', ['Scope']) && ctx.inScope('skills_profile', personId) && shared)) return refuse('forbidden', 'This person has not shared their career plans with you');
      }
      const ids = (Array.isArray(roleIds) ? roleIds : []).filter((x) => typeof x === 'string').slice(0, MAX_ROLES);
      const data = careerReadiness(careerDataFrom(b, personId), personId, ids, todayIso());
      return { ok: true, code: 'ok', message: '', data } as Result<CareerReadiness[]>;
    },

    async roadmapToPlan(roadmapId) {
      await b.whenReady();
      type R = RoadmapToPlanResult;
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roadmap.to_plan', 'roadmaps', roadmapId ?? null, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to update your development plan');
      const role = ctx.actingRole('dev_plans', ['Own', 'Scope']);
      if (!role) return refuse('forbidden', 'Only staff with a development plan can do this');
      const rm = roadmapId ? b.rawGet('roadmaps', roadmapId) : undefined;
      if (!rm || rm.person_id !== who.personId || !rm.active) return refuse('not_found', 'Roadmap not found', role);
      const plan = Array.isArray(rm.plan) ? (rm.plan as Record<string, unknown>[]) : [];
      const dev = plan.filter((x) => x && x.lane === 'development');
      if (!dev.length) return refuse('invalid', 'This roadmap has no development blocks to send', role);
      for (const x of dev) {
        const t = x.title as { en?: unknown; ar?: unknown } | undefined;
        const bad = typeof x.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(x.id as string) || !PLAN_KINDS.includes(String(x.plan_kind)) || typeof t?.en !== 'string' || typeof t?.ar !== 'string'
          || !(t.en as string).trim() || (t.en as string).length > 200 || (t.ar as string).length > 200 || (x.course_id != null && !b.rawGet('courses', String(x.course_id)))
          || (x.end != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(x.end)));
        if (bad) return refuse('invalid', 'The roadmap contains an activity that cannot be added', role);
      }
      const plans = b.raw('dev_plans').filter((p) => p.person_id === who.personId && p.target_role_id === rm.target_role_id && OPEN_PLAN.includes(p.status)).sort((a, c) => (a.id < c.id ? -1 : 1));
      let planId = plans.find((p) => p.id === `dp-rm-${rm.id}`)?.id ?? plans[0]?.id ?? null;
      let planCreated = false;
      if (!planId) {
        planId = `dp-rm-${rm.id}`;
        b.rawInsert('dev_plans', { id: planId, person_id: who.personId, target_role_id: rm.target_role_id, status: 'draft', created_at: nowTs(), note: 'Created from a Career Roadmap scenario' } as never);
        planCreated = true;
      }
      let created = 0, existing = 0;
      for (const x of dev) {
        const id = `pa-rm-${rm.id}-${x.id}`;
        const t = x.title as { en: string; ar: string };
        // same block already in the plan (this roadmap, or another saved scenario for the same target): never duplicate
        const same = (b.raw('plan_activities') as unknown as { plan_id: string; kind: string; title_en: string; course_id: string | null }[])
          .some((a) => a.plan_id === planId && a.kind === x.plan_kind && a.title_en === t.en && (a.course_id ?? '') === ((x.course_id as string) ?? ''));
        if (b.rawGet('plan_activities', id) || same) { existing++; continue; }
        b.rawInsert('plan_activities', { id, plan_id: planId, person_id: who.personId, kind: x.plan_kind as never, title_en: t.en, title_ar: t.ar, due_on: (x.end as string) ?? null, status: 'planned', course_id: (x.course_id as string) ?? null } as never);
        created++;
      }
      b.rawUpdate('roadmaps', rm.id, { sent_plan_id: planId, sent_at: nowTs() } as never);
      return h.done<R>('roadmap.to_plan', 'plan_activities', rm.id, `${created} added, ${existing} already in plan ${planId}`, role, 'kafaa.career.roadmap_to_plan',
        `Career roadmap ${rm.id} sent to development plan ${planId} (${created} activities added)`, created ? 'Added to your development plan' : 'Already in your development plan',
        { plan_id: planId, plan_created: planCreated, created, existing }, ['roadmaps', 'dev_plans', 'plan_activities']);
    },

    // ───────────── FS15 Future roles in the Navigator and Roadmap (SQL: 20261010225001_kafaa_fs25_future_roles.sql; same checks, codes and messages)
    async futureRoleReadiness(personId, roleIds) {
      await b.whenReady();
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<ConceptReadiness[]>('career.future_readiness', 'career_targets', personId ?? null, code, msg, null);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to see your career readiness');
      if (!personId || !b.rawGet('people', personId)) return refuse('not_found', 'Person not found');
      if (personId === who.personId) {
        if (!ctx.has('skills_profile', ['Own', 'Scope'])) return refuse('forbidden', 'Career readiness is for staff with a skills profile');
      } else {
        const shared = b.raw('career_targets').some((t) => t.person_id === personId && t.shared && t.active) || b.raw('roadmaps').some((r) => r.person_id === personId && r.shared && r.active);
        if (!(ctx.has('skills_profile', ['Scope']) && ctx.inScope('skills_profile', personId) && shared)) return refuse('forbidden', 'This person has not shared their career plans with you');
      }
      const ids = roleIds == null ? null : (Array.isArray(roleIds) ? roleIds : []).filter((x) => typeof x === 'string').slice(0, MAX_ROLES);
      const today = todayIso();
      const facts = careerFacts(careerDataFrom(b, personId), personId, today);
      return { ok: true, code: 'ok', message: '', data: conceptReadiness(conceptDataFrom(b, personId), facts, personId, ids) } as Result<ConceptReadiness[]>;
    },

    async transitionEvidence(fromRoleId, toRoleIds) {
      await b.whenReady();
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<TransitionEvidence[]>('career.transitions', 'role_moves', fromRoleId ?? null, code, msg, null);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to see career moves');
      if (!(ctx.has('skills_profile', ['Own', 'Scope', 'Agg', 'A']) || ctx.has('transformation', ['R']))) return refuse('forbidden', 'Career move evidence is for staff');
      if (!fromRoleId || !b.rawGet('job_roles', fromRoleId)) return refuse('not_found', 'Role not found');
      const ids = (Array.isArray(toRoleIds) ? toRoleIds : []).filter((x) => typeof x === 'string');
      return { ok: true, code: 'ok', message: '', data: transitionEvidence(b.raw('role_moves') as unknown as MoveRow[], b.raw('job_roles') as never, fromRoleId, ids) } as Result<TransitionEvidence[]>;
    },

    // ───────────── FS16 Role outlook labels with published criteria
    async outlookLabelsPreview(year) {
      await b.whenReady();
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<OutlookPreview>('outlook.preview', 'role_outlook_labels', String(year ?? ''), code, msg, null);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to preview outlook labels');
      if (!ctx.has('transformation', ['W', 'A'])) return refuse('forbidden', 'Only the training manager or the HR director can preview outlook labels');
      const y = Number(year);
      if (!Number.isInteger(y) || y !== Number(todayIso().slice(0, 4))) return refuse('invalid', 'Labels are computed for the current year only');
      const crit = criteriaFor(b.raw('role_outlook_criteria') as unknown as CriteriaRow[], y);
      if (!crit) return refuse('not_found', 'No published criteria for this year');
      const stored = new Map((b.raw('role_outlook_labels') as unknown as { role_id: string; year: number; label: OutlookLabel }[]).filter((r) => r.year === y).map((r) => [r.role_id, r.label]));
      const counts = emptyCounts();
      const rows = computeLabels(labelDataFrom(b), crit, y).map((r) => {
        counts[r.label]++;
        const st = stored.get(r.role_id) ?? null;
        return { role_id: r.role_id, label: r.label, components: r.components, stored_label: st, changed: st !== r.label };
      });
      return { ok: true, code: 'ok', message: '', data: { year: y, criteria_id: crit.id, rows, counts, changed: rows.filter((r) => r.changed).length } } as Result<OutlookPreview>;
    },

    async publishOutlookLabels(year) {
      await b.whenReady();
      type R = OutlookPublishResult;
      const who = b.identity();
      const ctx = b.access();
      const role = ctx.actingRole('transformation', ['A']);
      const refuse = (code: string, msg: string) => h.refuse<R>('outlook.publish', 'role_outlook_labels', String(year ?? ''), code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to publish outlook labels');
      if (!role) return refuse('forbidden', 'Only the HR director can publish outlook labels');
      const y = Number(year);
      const cur = Number(todayIso().slice(0, 4));
      if (!Number.isInteger(y) || y > cur || y < 2000) return refuse('invalid', 'Labels are published for the current year only');
      if (y < cur) return refuse('past_year_locked', 'Past years are kept as published and cannot be changed');
      const crit = criteriaFor(b.raw('role_outlook_criteria') as unknown as CriteriaRow[], y);
      if (!crit) return refuse('not_found', 'No published criteria for this year');
      const rows = computeLabels(labelDataFrom(b), crit, y);
      if (!rows.length) return refuse('invalid', 'No role could be labelled from the current inputs');
      const counts = emptyCounts();
      let changed = 0;
      const ts = nowTs();
      for (const r of rows) {
        counts[r.label]++;
        const old = b.rawGet('role_outlook_labels', r.id) as unknown as { label: string } | undefined;
        const row = { id: r.id, role_id: r.role_id, year: y, label: r.label, criteria_id: crit.id, archived: false, as_of: todayIso(), published_by_role: role, published_at: ts };
        if (!old) { b.rawInsert('role_outlook_labels', row as never); changed++; } else { if (old.label !== r.label) changed++; b.rawUpdate('role_outlook_labels', r.id, row as never); }
        const comp = { id: r.id, role_id: r.role_id, year: y, criteria_id: crit.id, components: r.components, computed_at: ts };
        if (b.rawGet('role_outlook_components', r.id)) b.rawUpdate('role_outlook_components', r.id, comp as never); else b.rawInsert('role_outlook_components', comp as never);
      }
      return h.done<R>('outlook.publish', 'role_outlook_labels', String(y), `${rows.length} labels for ${y} under ${crit.id} (${changed} changed)`, role, 'kafaa.careers.outlook_labels_publish',
        `Role outlook labels ${y} published under ${crit.id}: ${counts.growing} growing, ${counts.changing} changing, ${counts.stable} stable`, `Outlook labels for ${y} published`,
        { year: y, criteria_id: crit.id, published: rows.length, changed, counts }, ['role_outlook_labels', 'role_outlook_components']);
    },

    // ───────────── F12 Career conversations (SQL: 20261009122001_kafaa_w2e2_conversations.sql; same checks, order, codes and messages)
    async conversationAgenda(personId) {
      await b.whenReady();
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<Agenda>('conversation.agenda', 'career_conversations', personId ?? null, code, msg, null);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to prepare your career conversation');
      if (!personId || !b.rawGet('people', personId)) return refuse('not_found', 'Person not found');
      const today = todayIso();
      if (personId === who.personId) {
        if (!ctx.has('skills_profile', ['Own'])) return refuse('forbidden', 'Career conversations are for staff');
        return { ok: true, code: 'ok', message: '', data: buildAgenda(agendaTablesFrom(b, personId), personId, { targets: true, roadmap: true, coach: true, sharedOnly: false }, today) } as Result<Agenda>;
      }
      if (!ctx.has('skills_profile', ['Scope']) || lm(personId) !== who.personId) return refuse('forbidden', 'Only the line manager of record sees this agenda');
      return { ok: true, code: 'ok', message: '', data: buildAgenda(agendaTablesFrom(b, personId), personId, { targets: true, roadmap: true, coach: false, sharedOnly: true }, today) } as Result<Agenda>;
    },

    async submitPrep(prepIn, submit) {
      await b.whenReady();
      type R = SubmitPrepResult;
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('conversation.prep', 'career_conversations', who.personId ?? null, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to prepare your career conversation');
      const me = who.personId;
      const role = ctx.actingRole('skills_profile', ['Own']);
      const person = b.rawGet('people', me);
      if (!role || !person || person.kind !== 'staff') return refuse('forbidden', 'Career conversations are for staff', role);
      const prep = typeof submit === 'boolean' ? normPrep(prepIn, submit) : null;
      if (!prep) return refuse('invalid', 'Check the preparation form: an aspiration and a 12-month goal are needed to share it', role);
      const mgr = lm(me);
      if (submit && !mgr) return refuse('no_line_manager', 'No line manager is recorded for you; ask HR to update your record', role);
      const today = todayIso();
      const row = convs().filter((r) => r.person_id === me && r.status === 'draft').sort((a, c) => String(c.created_at).localeCompare(String(a.created_at)) || (a.id < c.id ? -1 : 1))[0];
      const agenda = buildAgenda(agendaTablesFrom(b, me), me, { targets: prep.include.targets, roadmap: prep.include.roadmap, coach: prep.include.coach, sharedOnly: false }, today);
      const was = !!row?.prep_submitted_at;
      const shared = submit || was;
      const m = mgr ? b.rawGet('people', mgr) : undefined;
      const { share_with_talent_review, ...stored } = prep;
      const now = nowTs();
      const patch = {
        prep: COMPACT(stored as never), agenda: COMPACT(agenda as never), share_with_talent_review, manager_person_id: mgr, manager_read_id: shared ? mgr : null,
        manager_name: m?.display_name ?? '', manager_name_ar: m?.display_name_ar || m?.display_name || '', prep_submitted_at: shared ? (row?.prep_submitted_at ?? now) : null, cycle: cycleOf(today), updated_at: now,
      };
      let id: string;
      if (row) { id = row.id; b.rawUpdate('career_conversations', id, patch as never); }
      else {
        id = randomId('cc-');
        b.rawInsert('career_conversations', { id, person_id: me, status: 'draft', person_name: person.display_name, person_name_ar: person.display_name_ar || person.display_name, held_on: null, notes: null, actions: [], focus_role_id: null, coach_hours: null, plan_id: null, recorded_at: null, employee_agrees: null, employee_comment: null, acknowledged_at: null, created_at: now, ...patch } as never);
      }
      if (submit && !was && mgr) notify(`nt-cc-${id}-prep`, mgr, `${person.display_name} shared their career conversation preparation`, `شارك ${person.display_name_ar || person.display_name} تحضيره للحوار المهني`, `/team/conversations?person=${me}`, 'info');
      return h.done<R>('conversation.prep', 'career_conversations', id, shared ? `shared with ${mgr ?? 'none'}` : 'draft saved', role, null, '', submit ? 'Shared with your line manager' : 'Draft saved',
        { id, status: 'draft', submitted: shared, manager_person_id: mgr }, ['career_conversations', 'notifications']);
    },

    async recordConversation(input) {
      await b.whenReady();
      type R = RecordConversationResult;
      const who = b.identity();
      const ctx = b.access();
      const inp = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const entity = (typeof inp.conversation_id === 'string' && inp.conversation_id) || (typeof inp.person_id === 'string' && inp.person_id) || null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('conversation.record', 'career_conversations', entity, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to record a career conversation');
      const me = who.personId;
      const role = ctx.actingRole('skills_profile', ['Scope']);
      if (!role) return refuse('forbidden', 'Only line managers record career conversations');
      let row: ConvRow | undefined;
      let personId: string;
      if (typeof inp.conversation_id === 'string' && inp.conversation_id) {
        row = b.rawGet('career_conversations', inp.conversation_id) as unknown as ConvRow | undefined;
        if (!row || row.manager_read_id !== me) return refuse('not_found', 'Conversation not found', role);
        if (row.person_id === me) return refuse('self_record', 'You cannot record your own career conversation', role);
        if (row.status === 'acknowledged') return refuse('locked', 'This conversation is already acknowledged; start a new one next cycle', role);
        personId = row.person_id;
      } else {
        if (typeof inp.person_id !== 'string' || !inp.person_id) return refuse('invalid', 'Choose the person', role);
        personId = inp.person_id;
        if (personId === me) return refuse('self_record', 'You cannot record your own career conversation', role);
        const p = b.rawGet('people', personId);
        if (!p || p.kind !== 'staff' || p.status !== 'active') return refuse('not_found', 'Person not found', role);
        if (lm(personId) !== me) return refuse('not_manager', 'Only the line manager of record can record this conversation', role);
        row = convs().filter((r) => r.person_id === personId && r.manager_read_id === me && (r.status === 'draft' || r.status === 'held'))
          .sort((a, c) => String(c.created_at).localeCompare(String(a.created_at)) || (a.id < c.id ? -1 : 1))[0];
      }
      const today = todayIso();
      const heldOn = inp.held_on;
      if (!isIsoDate(heldOn) || heldOn > today || heldOn < addDaysIso(today, -HELD_BACK_DAYS)) return refuse('invalid', 'Enter the date the conversation was held (within the last year)', role);
      const notes = inp.notes == null ? '' : inp.notes;
      if (typeof notes !== 'string' || notes.trim().length > MAX_NOTES) return refuse('invalid', 'The notes are too long', role);
      const actions = normActions(inp.actions, (id) => !!b.rawGet('courses', id));
      if (!actions) return refuse('invalid', 'Check the agreed actions', role);
      const focus = inp.focus_role_id == null || inp.focus_role_id === '' ? null : inp.focus_role_id;
      const fr = typeof focus === 'string' ? b.rawGet('job_roles', focus) : undefined;
      if (focus !== null && (!fr || fr.security_sensitive)) return refuse('invalid', 'Choose a focus role from the career map (security roles show the career path only)', role);
      const hours = inp.coach_hours == null ? null : inp.coach_hours;
      if (hours !== null && (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || hours > 40)) return refuse('invalid', 'Weekly learning hours must be between 0 and 40', role);
      const person = b.rawGet('people', personId)!;
      const target = (focus as string | null) ?? person.job_role_id ?? null;
      if (actions.length && !target) return refuse('invalid', 'Choose a focus role so the actions can go into a development plan', role);

      const now = nowTs();
      const id = row?.id ?? randomId('cc-');
      let planId: string | null = row?.plan_id ?? null;
      let created = 0, updated = 0;
      if (actions.length) {
        const drafts = b.raw('dev_plans').filter((p) => p.person_id === personId && p.target_role_id === target && p.status === 'draft');
        planId = drafts.find((p) => p.id === row?.plan_id)?.id ?? drafts.find((p) => p.id === planIdFor(id))?.id ?? [...drafts].sort((a, c) => (a.id < c.id ? -1 : 1))[0]?.id ?? null;
        if (!planId) {
          planId = planIdFor(id);
          b.rawInsert('dev_plans', { id: planId, person_id: personId, target_role_id: target, status: 'draft', created_at: now, note: 'Created from a career conversation' } as never);
        }
        for (const a of actions) {
          const aid = activityId(id, a.id);
          const ex = b.rawGet('plan_activities', aid);
          const vals = { kind: a.kind, title_en: a.title.en, title_ar: a.title.ar, due_on: a.due_on, course_id: a.course_id };
          if (ex) { if (ex.status === 'planned' && ex.plan_id === planId) { b.rawUpdate('plan_activities', aid, vals as never); updated++; } continue; }
          b.rawInsert('plan_activities', { id: aid, plan_id: planId, person_id: personId, status: 'planned', ...vals } as never);
          created++;
        }
      }
      const mgr = b.rawGet('people', me);
      const patch = {
        status: 'held', held_on: heldOn, notes: notes.trim(), actions: COMPACT({ a: actions }).a, focus_role_id: focus, coach_hours: hours, plan_id: planId, manager_person_id: me, manager_read_id: me,
        manager_name: mgr?.display_name ?? '', manager_name_ar: mgr?.display_name_ar || mgr?.display_name || '', cycle: cycleOf(heldOn), recorded_at: now, updated_at: now,
      };
      if (row) {
        const empty = !row.agenda || (typeof row.agenda === 'object' && !Array.isArray(row.agenda) && Object.keys(row.agenda as object).length === 0);
        b.rawUpdate('career_conversations', id, { ...patch, ...(empty ? { agenda: COMPACT(buildAgenda(agendaTablesFrom(b, personId), personId, { targets: true, roadmap: true, coach: false, sharedOnly: true }, today) as never) } : {}) } as never);
      } else {
        b.rawInsert('career_conversations', {
          id, person_id: personId, person_name: person.display_name, person_name_ar: person.display_name_ar || person.display_name, prep: {}, prep_submitted_at: null,
          agenda: COMPACT(buildAgenda(agendaTablesFrom(b, personId), personId, { targets: true, roadmap: true, coach: false, sharedOnly: true }, today) as never),
          employee_agrees: null, employee_comment: null, acknowledged_at: null, share_with_talent_review: false, created_at: now, ...patch,
        } as never);
      }
      notify(`nt-cc-${id}-held`, personId, `Your career conversation with ${mgr?.display_name ?? ''} is recorded: please acknowledge it`, `سُجِّل حوارك المهني مع ${mgr?.display_name_ar || mgr?.display_name || ''}: يُرجى الإقرار به`, '/my/career/conversations', 'info');
      return h.done<R>('conversation.record', 'career_conversations', id, actions.length ? `${created} added, ${updated} updated in plan ${planId}` : 'no agreed actions', role, 'kafaa.career.conversation_held',
        `Career conversation ${id} with ${personId} recorded (${actions.length} agreed actions)`, actions.length ? 'Conversation recorded; the agreed actions are in the development plan as draft activities' : 'Conversation recorded',
        { id, person_id: personId, plan_id: planId, created, updated }, ['career_conversations', 'dev_plans', 'plan_activities', 'notifications']);
    },

    async acknowledgeConversation(id, agree, comment, addToCoach) {
      await b.whenReady();
      type R = AcknowledgeResult;
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('conversation.acknowledge', 'career_conversations', id ?? null, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to acknowledge your career conversation');
      const me = who.personId;
      const row = (id ? b.rawGet('career_conversations', id) : undefined) as unknown as ConvRow | undefined;
      if (!row || (row.person_id !== me && row.manager_read_id !== me)) return refuse('not_found', 'Conversation not found');
      if (row.person_id !== me) return refuse('not_person', 'Only the employee can acknowledge their career conversation', ctx.actingRole('skills_profile', ['Scope', 'Own']));
      const role = ctx.actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Career conversations are for staff');
      if (row.status !== 'held') return refuse('invalid', 'This conversation is not waiting for your acknowledgement', role);
      if (typeof agree !== 'boolean' || (comment != null && typeof comment !== 'string')) return refuse('invalid', 'Choose whether you agree with the record', role);
      const text = (comment ?? '').trim();
      if (text.length > MAX_COMMENT) return refuse('invalid', 'The comment is too long', role);
      if (!agree && text.length < 3) return refuse('invalid', 'Say briefly what you disagree with', role);
      const now = nowTs();
      b.rawUpdate('career_conversations', row.id, { status: 'acknowledged', employee_agrees: agree, employee_comment: text || null, acknowledged_at: now, updated_at: now } as never);
      let coach = false;
      if (addToCoach === true && (row.focus_role_id || row.coach_hours != null)) {
        const g = b.raw('learning_goals').find((x) => x.person_id === me);
        const focus = [...((g?.focus_role_ids as string[] | undefined) ?? [])];
        const fr = row.focus_role_id ? b.rawGet('job_roles', row.focus_role_id) : undefined;
        if (fr && !fr.security_sensitive && !focus.includes(fr.id) && focus.length < 3) focus.push(fr.id);
        const hours = row.coach_hours != null ? Number(row.coach_hours) : Number(g?.hours_per_week ?? 0);
        if (!g) { b.rawInsert('learning_goals', { id: goalIdFor(me), person_id: me, hours_per_week: hours, focus_role_ids: focus, updated_at: now } as never); coach = true; }
        else if (Number(g.hours_per_week) !== hours || focus.length !== ((g.focus_role_ids as string[]) ?? []).length) { b.rawUpdate('learning_goals', g.id, { hours_per_week: hours, focus_role_ids: focus, updated_at: now } as never); coach = true; }
      }
      const p = b.rawGet('people', me);
      if (row.manager_read_id) notify(`nt-cc-${row.id}-ack`, row.manager_read_id, agree ? `${p?.display_name ?? me} acknowledged your career conversation` : `${p?.display_name ?? me} acknowledged your career conversation with a comment`,
        agree ? `أقرّ ${p?.display_name_ar || p?.display_name || me} بحواركما المهني` : `أقرّ ${p?.display_name_ar || p?.display_name || me} بحواركما المهني مع تعليق`, `/team/conversations?person=${me}`, agree ? 'ok' : 'warn');
      return h.done<R>('conversation.acknowledge', 'career_conversations', row.id, agree ? 'agreed' : 'acknowledged with a comment', role, 'kafaa.career.conversation_acknowledged',
        `Career conversation ${row.id} acknowledged by ${me}${agree ? '' : ' with a disagreement comment'}`, agree ? 'Conversation acknowledged' : 'Conversation acknowledged with your comment',
        { id: row.id, agree, coach_updated: coach }, ['career_conversations', 'learning_goals', 'notifications']);
    },

    async setAspirationSharing(id, on) {
      await b.whenReady();
      type R = { id: string; share_with_talent_review: boolean };
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('conversation.share', 'career_conversations', id ?? null, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to change your sharing choice');
      const row = (id ? b.rawGet('career_conversations', id) : undefined) as unknown as ConvRow | undefined;
      if (!row || row.person_id !== who.personId) return refuse('not_found', 'Conversation not found');
      const role = ctx.actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', 'Career conversations are for staff');
      if (typeof on !== 'boolean') return refuse('invalid', 'Choose on or off', role);
      b.rawUpdate('career_conversations', row.id, { share_with_talent_review: on, updated_at: nowTs() } as never);
      return h.done<R>('conversation.share', 'career_conversations', row.id, on ? 'on' : 'off', role, 'kafaa.career.aspiration_sharing', `Aspiration sharing with talent review ${on ? 'on' : 'off'} for ${row.id}`,
        on ? 'Your aspiration is now visible in talent review' : 'Your aspiration is no longer visible in talent review', { id: row.id, share_with_talent_review: on }, ['career_conversations']);
    },

    async talentAspirations(personIds) {
      await b.whenReady();
      type R = AspirationSignal[];
      const who = b.identity();
      const ctx = b.access();
      if (!who.personId) return h.refuse<R>('conversation.aspirations_read', 'career_conversations', null, 'not_signed_in', 'Sign in to see talent review data');
      const role = ctx.actingRole('talent_review', ['R', 'A', 'Scope']);
      if (!role) return h.refuse<R>('conversation.aspirations_read', 'career_conversations', null, 'forbidden', 'Aspirations are shared only in talent review');
      const ids = [...new Set((Array.isArray(personIds) ? personIds : []).filter((x) => typeof x === 'string' && x))].slice(0, MAX_PEOPLE);
      const all = ctx.has('talent_review', ['R', 'W', 'A']);
      const out = ids.filter((pid) => b.rawGet('people', pid) && (all || (ctx.has('talent_review', ['Scope']) && ctx.inScope('talent_review', pid)))).map((pid) => aspirationOf(convs(), pid));
      return h.done<R>('conversation.aspirations_read', 'career_conversations', null, `${out.length} people, ${out.filter((x) => x.shared).length} shared`, role, null, '', '', out, ['audit_events']);
    },

    async conversationInsights() {
      await b.whenReady();
      type R = ConversationInsights;
      const who = b.identity();
      const ctx = b.access();
      if (!who.personId) return h.refuse<R>('conversation.insights', 'career_conversations', null, 'not_signed_in', 'Sign in to see career conversation insights');
      const role = ctx.actingRole('skills_profile', ['Agg', 'A']);
      if (!role) return h.refuse<R>('conversation.insights', 'career_conversations', null, 'forbidden', 'Career conversation insights are for HR (aggregates only)');
      return { ok: true, code: 'ok', message: 'Career conversation insights', data: conversationInsightsOf(convs(), people(), assignments(), todayIso()) } as Result<R>;
    },

    async teamConversations() {
      await b.whenReady();
      type R = TeamRow[];
      const who = b.identity();
      const ctx = b.access();
      if (!who.personId) return h.refuse<R>('conversation.team', 'career_conversations', null, 'not_signed_in', 'Sign in to see your team');
      if (!ctx.actingRole('skills_profile', ['Scope'])) return h.refuse<R>('conversation.team', 'career_conversations', null, 'forbidden', 'The team view is for line managers');
      return { ok: true, code: 'ok', message: '', data: teamRowsOf(who.personId, convs(), people(), assignments(), todayIso()) } as Result<R>;
    },

    async conversationReminders() {
      await b.whenReady();
      type R = ReminderResult;
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<R>('conversation.reminders', 'career_conversations', null, code, msg);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to send reminders');
      const all = ctx.has('skills_profile', ['A']);
      const role = ctx.actingRole('skills_profile', all ? ['A'] : ['Scope']);
      if (!role) return refuse('forbidden', 'Reminders are sent by line managers and the training manager');
      const today = todayIso();
      const ppl = people();
      const byId = new Map(ppl.map((p) => [p.id, p]));
      const pairs = pairsOf(ppl, assignments(), today).filter((x) => all || x.manager_id === who.personId);
      const rows = convs();
      let overdue = 0, created = 0;
      const month = today.slice(0, 7);
      for (const x of pairs) {
        const p = byId.get(x.person_id)!;
        const l = lastHeldOf(rows, x.person_id);
        if (cadenceState(l ? String(l.held_on).slice(0, 10) : null, p.hire_date ?? null, today) !== 'overdue') continue;
        overdue++;
        if (notify(`nt-cc-due-${x.person_id}-${month}`, x.person_id, 'Your six-monthly career conversation is due', 'حان موعد حوارك المهني نصف السنوي', '/my/career/conversations', 'warn',
          'Prepare your aspirations and goals, then share them with your line manager.', 'حضّر تطلعاتك وأهدافك ثم شاركها مع مديرك المباشر.')) created++;
        if (notify(`nt-cc-due-${x.person_id}-${month}-m`, x.manager_id, `Career conversation overdue: ${p.display_name ?? x.person_id}`, `حوار مهني متأخر: ${p.display_name_ar || p.display_name || x.person_id}`, `/team/conversations?person=${x.person_id}`, 'warn')) created++;
      }
      return h.done<R>('conversation.reminders', 'career_conversations', null, `${pairs.length} pairs, ${overdue} overdue, ${created} reminders`, role, null, '',
        created ? `${created} reminders sent` : 'No new reminders: everyone is up to date or already reminded this month', { pairs: pairs.length, overdue, created }, ['notifications']);
    },

  };
}
