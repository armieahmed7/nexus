// FS56 Skill-change effectiveness + FS57 Curriculum coverage: LocalBackend RPCs (FS wave F · E4), spread into makeLocalM25.
// 1:1 mirror of supabase/migrations/20261010264001_kafaa_fs64_skill_change_coverage.sql: the same checks in the same order, the same
// refusal codes and messages (FS56_MSG), the same audit and ledger rows. Rules: ../skillChange.ts and ../coverage.ts. Pages never import
// this file. Reads (never writes) other modules' tables: F01 skill_evidence, M04 courses / enrolments / training records, FS19 links,
// FS17 pathways / pathway enrolments / pathway gaps, FS18 external resources, FS05 role profiles.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { skillChange, skillChangeReportOf, skillChangeWorld, type SkillChangeReport } from '../skillChange';
import { backlogToCreate, cleanPlan, coverage, coverageReport, decisionProblem, isActiveStaff, whatIf, type CoverageReport, type CoverageWorld, type ReportWorld, type WhatIfMove } from '../coverage';
import type { Fs56Rpc } from './rpc';

/** User-facing refusal messages (identical in the SQL functions). */
export const FS56_MSG = {
  not_signed_in: 'Sign in first',
  forbidden_report: 'Skill-change and coverage results are for training staff, managers and HR, as aggregates only',
  forbidden_tm: 'Only the training manager can do this',
  not_found: 'Backlog item not found',
  route: 'Choose build, partner or buy',
  owner: 'Choose the owning function from the skills catalogue owners',
  person: 'The named lead must be an active member of staff',
  due: 'Give a due date between today and 31 Dec 2030',
  rationale: 'Explain the decision in 10 to 500 characters',
  plan: 'A plan needs a title of 3 to 120 characters, a level from 1 to 3 and 1 to 200 hours',
} as const;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LA = 'learning_analytics';
const ok = <T>(message: string, data: T): Result<T> => ({ ok: true, code: 'ok', message, audit_seq: null, ledger_seq: null, data }) as Result<T>;

export function makeLocalFs56(b: LocalBackend, h: LocalRpcHelpers): Fs56Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const tmRole = () => ctx().actingRole(LA, ['A']);
  const canRead = () => ctx().has(LA, ['Agg', 'R', 'A']);
  const covWorld = (): CoverageWorld => ({
    skills: raw('skills'), competencies: raw('competencies'), courses: raw('courses'), course_skill_links: raw('course_skill_links'), pathways: raw('pathways'),
    pathway_gaps: raw('pathway_gaps'), external_resources: raw('external_resources'), job_roles: raw('job_roles'), role_profile_versions: raw('role_profile_versions'),
  });
  const tables = (names: string[]) => Object.fromEntries(names.map((n) => [n, raw(n)]));

  return {
    async skillChangeReport() {
      await b.whenReady();
      type R = SkillChangeReport;
      if (!me()) return h.refuse<R>('skillchange.report', 'skill_change_measures', null, 'not_signed_in', FS56_MSG.not_signed_in);
      if (!canRead()) return h.refuse<R>('skillchange.report', 'skill_change_measures', null, 'forbidden', FS56_MSG.forbidden_report);
      return ok('Skill change', skillChangeReportOf(raw('skill_change_measures'), raw('courses'), raw('pathways'), ctx().has(LA, ['A'])));
    },

    async computeSkillChange() {
      await b.whenReady();
      type R = { rows: number; measured: number; as_of: string };
      if (!me()) return h.refuse<R>('skillchange.compute', 'skill_change_measures', null, 'not_signed_in', FS56_MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('skillchange.compute', 'skill_change_measures', null, 'forbidden', FS56_MSG.forbidden_tm);
      const today = todayIso();
      const rows = skillChange(skillChangeWorld(tables(['skills', 'competencies', 'courses', 'course_skill_links', 'pathways', 'training_records', 'enrolments', 'pathway_enrolments', 'skill_evidence', 'people'])), today);
      const at = nowTs();
      for (const r of rows) {
        const patch = { ...r, computed_at: at, computed_by: me() };
        if (get('skill_change_measures', r.id)) upd('skill_change_measures', r.id, patch); else ins('skill_change_measures', patch);
      }
      const measured = rows.filter((r) => r.measured !== null).length;
      return h.done<R>('skillchange.compute', 'skill_change_measures', null, `${rows.length} items, ${measured} measured`, role, null, '', `Skill change recomputed as of ${today}`, { rows: rows.length, measured, as_of: today }, ['skill_change_measures']);
    },

    async curriculumCoverage() {
      await b.whenReady();
      type R = CoverageReport;
      if (!me()) return h.refuse<R>('coverage.report', 'gap_backlog', null, 'not_signed_in', FS56_MSG.not_signed_in);
      if (!canRead()) return h.refuse<R>('coverage.report', 'gap_backlog', null, 'forbidden', FS56_MSG.forbidden_report);
      const w: ReportWorld = { ...covWorld(), people: raw('people'), gap_backlog: raw('gap_backlog') };
      return ok('Curriculum coverage', coverageReport(w, todayIso(), ctx().has(LA, ['A'])));
    },

    async syncGapBacklog() {
      await b.whenReady();
      type R = { created: number; total: number };
      if (!me()) return h.refuse<R>('coverage.sync', 'gap_backlog', null, 'not_signed_in', FS56_MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('coverage.sync', 'gap_backlog', null, 'forbidden', FS56_MSG.forbidden_tm);
      const today = todayIso();
      const add = backlogToCreate(covWorld(), new Set(raw('gap_backlog').map((r) => String(r.id))));
      for (const r of add) ins('gap_backlog', {
        ...r, owner_person_id: null, due_on: null, route: null, rationale: '', rationale_ar: null, plan: null, predicted: [], status: 'open', first_seen: today,
        created_by: me(), decided_by: null, decided_at: null, history: [], updated_at: nowTs(),
      });
      const total = raw('gap_backlog').length;
      return h.done<R>('coverage.sync', 'gap_backlog', null, `${add.length} added`, role, null, '', add.length ? `${add.length} skills added to the backlog with their default owner` : 'Every uncovered skill and open pathway gap is already in the backlog', { created: add.length, total }, ['gap_backlog']);
    },

    async decideGap(input) {
      await b.whenReady();
      type R = { id: string; predicted: WhatIfMove[] };
      const id = typeof input?.id === 'string' ? input.id : null;
      if (!me()) return h.refuse<R>('coverage.decide', 'gap_backlog', id, 'not_signed_in', FS56_MSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>('coverage.decide', 'gap_backlog', id, 'forbidden', FS56_MSG.forbidden_tm);
      const row = get('gap_backlog', id);
      const today = todayIso();
      const code = decisionProblem(input ?? {}, row, today, (pid) => isActiveStaff(get('people', pid)));
      if (code === 'not_found') return h.refuse<R>('coverage.decide', 'gap_backlog', id, 'not_found', FS56_MSG.not_found, role);
      if (code) return h.refuse<R>('coverage.decide', 'gap_backlog', id, 'invalid', FS56_MSG[code], role);
      const plan = cleanPlan(input.plan);
      const predicted = whatIf(coverage(covWorld()).roles, String(row!.skill_id), plan ? plan.level : Number(row!.level));
      const person = input.owner_person_id ? input.owner_person_id : null;
      const at = nowTs();
      upd('gap_backlog', id!, {
        owner_role: input.owner_role, owner_person_id: person, due_on: input.due_on, route: input.route, rationale: String(input.rationale).trim(), rationale_ar: null,
        plan, predicted, status: 'decided', decided_by: me(), decided_at: at, updated_at: at,
        history: [...((row!.history as Row[]) ?? []), { at, by: me(), route: input.route, due_on: input.due_on, owner_role: input.owner_role }],
      });
      const gain = predicted.reduce((s, m) => s + m.delta, 0);
      return h.done<R>('coverage.decide', 'gap_backlog', id, `${input.route} by ${input.due_on} (${input.owner_role})`, role, 'kafaa.coverage.gap_decision',
        `Gap ${id}: ${input.route} by ${input.due_on}, owner ${input.owner_role}; predicted coverage moves on ${predicted.length} role profiles (+${gain} points in total)`,
        'Decision recorded in the backlog', { id: id!, predicted }, ['gap_backlog']);
    },
  };
}
