// FS06 LocalBackend RPCs (owner: wave A · E5, M26): setTaskFuture, taskFuture, designateSatAnalyst. 1:1 mirror of
// supabase/migrations/20261010215001_kafaa_fs15_task_future.sql: same checks in the same order, the same refusal codes and messages
// (FX_MSG in ../future.ts), the same audit rows, SAT change-log rows and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import {
  FX_MSG, MAX_SKILLS, MAX_SKILL_LEVEL, NOTE_MAX, SKILL_KINDS, canonNeeds, exposureOf, futureSummaryLine, isDriver, isHorizon, validNeeds, type CapLevel,
} from '../future';
import type { FutureRpc, FutureTask, SetTaskFutureResult, TaskFutureView } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function makeLocalM26Future(b: LocalBackend, h: LocalRpcHelpers): FutureRpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const nameOf = (id: string | null | undefined) => { const p = get('people', id); return { en: p?.display_name ?? '', ar: p?.display_name_ar || p?.display_name || '' }; };
  const levels = () => raw('ai_capability_levels') as CapLevel[];
  const isAnalyst = (pid: string | null) => !!pid && !!raw('sat_analysts').find((a) => a.person_id === pid && a.active);
  const canWrite = () => ctx().has('sat', ['A']) || (ctx().has('sat', ['W']) && isAnalyst(me()));
  const isInstructor = (pid: string) => raw('role_assignments').some((r) => r.person_id === pid && r.role === 'instructor' && r.status === 'active');
  const skillsOf = (taskId: string) => raw('jta_task_skills').filter((x) => x.task_id === taskId && x.active)
    .sort((x, y) => (Number(x.sort) - Number(y.sort)) || cmp(x.skill_id, y.skill_id));
  const futureOf = (t: Row) => ({ needs: t.ai_capability_needed ?? null, exposure: t.exposure ?? null, change_horizon: t.change_horizon ?? null, tech_driver: t.tech_driver ?? null,
    skills: skillsOf(t.id).map((x) => `${x.skill_id}:${x.level}:${x.kind}`), title_en: t.title_en, title_ar: t.title_ar });

  return {
    async setTaskFuture(input) {
      await b.whenReady();
      type R = SetTaskFutureResult;
      const taskId = str(input?.task_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.task.future', 'jta_tasks', taskId || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', FX_MSG.not_signed_in);
      if (!canWrite()) return refuse('forbidden', FX_MSG.forbidden);
      const role = ctx().actingRole('sat', ctx().has('sat', ['A']) ? ['A'] : ['W']);
      const t = get('jta_tasks', taskId);
      if (!t) return refuse('not_found', FX_MSG.not_found, role);
      if (t.restricted) return refuse('restricted', FX_MSG.restricted, role);
      if (t.status !== 'active') return refuse('invalid', FX_MSG.retired, role);
      if (!validNeeds(input?.needs)) return refuse('invalid', FX_MSG.needs_invalid, role);
      if (!isHorizon(input?.change_horizon)) return refuse('invalid', FX_MSG.horizon_invalid, role);
      if (!isDriver(input?.tech_driver)) return refuse('invalid', FX_MSG.driver_invalid, role);
      const skills = Array.isArray(input?.skills) ? input.skills : null;
      if (!skills || skills.length < 1 || skills.length > MAX_SKILLS) return refuse('invalid', FX_MSG.skills_invalid, role);
      const seen = new Set<string>();
      for (const s of skills) {
        const sid = typeof s?.skill_id === 'string' ? s.skill_id : '';
        const kind = s?.kind ?? 'current';
        if (!sid || seen.has(sid) || !Number.isInteger(s?.level) || s.level < 1 || s.level > MAX_SKILL_LEVEL || !(SKILL_KINDS as readonly string[]).includes(kind)) return refuse('invalid', FX_MSG.skills_invalid, role);
        seen.add(sid);
      }
      for (const s of skills) {
        const sk = get('skills', s.skill_id);
        if (!sk) return refuse('not_found', FX_MSG.skill_not_found, role);
        if (sk.area === 'security') return refuse('restricted', FX_MSG.skill_restricted, role);
      }
      const note = str(input?.note);
      if (note.length > NOTE_MAX) return refuse('invalid', FX_MSG.note_long, role);
      const needs = canonNeeds(input.needs);
      const ex = exposureOf({ needs, change_horizon: input.change_horizon, critical: !!t.critical, restricted: false }, levels())!;
      const before = futureOf(t);
      upd('jta_tasks', taskId, { ai_capability_needed: needs, exposure: ex.exposure, change_horizon: input.change_horizon, tech_driver: input.tech_driver, future_by: who, future_on: todayIso(), changed_at: nowTs() });
      const keep = new Set(skills.map((s) => s.skill_id));
      for (const x of raw('jta_task_skills').filter((x) => x.task_id === taskId && x.active && !keep.has(x.skill_id))) upd('jta_task_skills', x.id, { active: false, linked_by: who, linked_at: nowTs() });
      skills.forEach((s, i) => {
        const id = `jts:${taskId}:${s.skill_id}`;
        const row = { task_id: taskId, skill_id: s.skill_id, level: s.level, kind: s.kind ?? 'current', source: 'analyst', active: true, linked_by: who, linked_at: nowTs(), sort: i + 1 };
        if (get('jta_task_skills', id)) upd('jta_task_skills', id, row); else ins('jta_task_skills', { id, ...row });
      });
      const after = futureOf(get('jta_tasks', taskId)!);
      const nm = nameOf(who);
      const cid = rid('sc');
      ins('sat_changes', {
        id: cid, task_id: taskId, role_id: t.role_id, kind: 'modified', trigger: 'task_change', area: 'future',
        summary: note || futureSummaryLine({ exposure: ex.exposure, change_horizon: input.change_horizon, tech_driver: input.tech_driver }),
        before, after, impact: {}, status: 'closed', opened_by: who, opened_by_name: nm.en, opened_by_name_ar: nm.ar, opened_at: nowTs(), closed_at: nowTs(),
      });
      return h.done<R>('sat.task.future', 'jta_tasks', taskId, `${ex.exposure} ${input.change_horizon} ${input.tech_driver}`, role, null, '', 'Future attributes saved',
        { exposure: ex.exposure, augmentable: ex.augmentable, reasons: ex.reasons, change_id: cid }, ['jta_tasks', 'jta_task_skills', 'sat_changes']);
    },

    async taskFuture(roleId = null) {
      await b.whenReady();
      if (!me() || !ctx().has('sat', ['R', 'W', 'A'])) return null;
      const lv = levels();
      const tasks: FutureTask[] = raw('jta_tasks')
        .filter((t) => !t.restricted && t.status === 'active' && (!roleId || t.role_id === roleId))
        .sort((x, y) => cmp(x.role_id, y.role_id) || (Number(x.sort) - Number(y.sort)) || cmp(x.id, y.id))
        .map((t) => {
          const ex = exposureOf({ needs: t.ai_capability_needed ?? null, change_horizon: t.change_horizon ?? null, critical: !!t.critical, restricted: false }, lv);
          return {
            id: t.id, role_id: t.role_id, code: t.code, title_en: t.title_en, title_ar: t.title_ar, critical: !!t.critical, decision: t.decision, source: t.source,
            needs: t.ai_capability_needed ?? null, exposure: t.exposure ?? null, augmentable: ex ? ex.augmentable : null, change_horizon: t.change_horizon ?? null, tech_driver: t.tech_driver ?? null,
            future_on: t.future_on ? String(t.future_on).slice(0, 10) : null, reasons: ex ? ex.reasons : [],
            skills: skillsOf(t.id).map((x) => ({ skill_id: x.skill_id, level: Number(x.level), kind: x.kind, source: x.source })),
          };
        });
      const canDesignate = ctx().has('sat', ['A']);
      const analysts = raw('sat_analysts').sort((x, y) => cmp(x.person_id, y.person_id))
        .map((a) => ({ person_id: a.person_id, name: a.name, name_ar: a.name_ar, active: !!a.active, designated_on: String(a.designated_on).slice(0, 10) }));
      const candidates = canDesignate
        ? [...new Set(raw('role_assignments').filter((r) => r.role === 'instructor' && r.status === 'active' && r.person_id !== me()).map((r) => r.person_id as string))]
          .sort(cmp).map((pid) => { const n = nameOf(pid); return { person_id: pid, name: n.en, name_ar: n.ar }; })
        : [];
      const view: TaskFutureView = { can_write: canWrite(), can_designate: canDesignate, tasks, analysts, candidates };
      return view;
    },

    async designateSatAnalyst(personId, active) {
      await b.whenReady();
      type R = { person_id: string; active: boolean };
      const pid = str(personId);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('sat.analyst.designate', 'sat_analysts', pid || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', FX_MSG.not_signed_in);
      if (!ctx().has('sat', ['A'])) return refuse('forbidden', FX_MSG.forbidden_designate);
      const role = ctx().actingRole('sat', ['A']);
      if (!get('people', pid)) return refuse('not_found', FX_MSG.person_not_found, role);
      if (pid === me()) return refuse('invalid', FX_MSG.self_designate, role);
      const want = active !== false;
      if (want && !isInstructor(pid)) return refuse('invalid', FX_MSG.not_instructor, role);
      const cur = raw('sat_analysts').find((a) => a.person_id === pid);
      if ((cur?.active ?? false) === want) return refuse('no_change', FX_MSG.no_change, role);
      const n = nameOf(pid);
      const hist = [...(cur?.history ?? []), { at: nowTs(), by: me(), active: want }];
      if (cur) upd('sat_analysts', cur.id, { active: want, designated_by: me(), designated_on: todayIso(), history: hist, name: n.en, name_ar: n.ar });
      else ins('sat_analysts', { id: `sa-${pid}`, person_id: pid, active: want, name: n.en, name_ar: n.ar, designated_by: me(), designated_on: todayIso(), history: hist });
      return h.done<R>('sat.analyst.designate', 'sat_analysts', pid, want ? 'designated' : 'withdrawn', role, 'kafaa.sat.analyst_designate', `${pid} ${want ? 'designated' : 'withdrawn'} as SAT analyst`,
        want ? 'SAT analyst designated' : 'SAT analyst designation withdrawn', { person_id: pid, active: want }, ['sat_analysts']);
    },
  };
}
