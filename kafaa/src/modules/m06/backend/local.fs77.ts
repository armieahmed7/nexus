// FS77 LocalBackend RPCs (owner: FS wave H · E5, M06). Spread into makeLocalM06 (backend/local.ts). 1:1 mirror of
// supabase/migrations/20261010285001_kafaa_fs85_student_starter.sql (kafaa_save_intake_baseline, kafaa_build_induction_plan,
// kafaa_induction_joiners): the same checks in the same order, refusal codes and messages (IB_MSG), audit and ledger rows.
// Shared write, as in the SQL function: M14 notifications (kind `induction`, id `nt-ip-<person>-r<revision>`). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result, Table } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import {
  IB_MSG, baselineFor, baselineId, baselineProblem, cleanEntries, inductionPlan, joinerCandidates, planId, planProblem,
  type BaselineRow, type InductionModule, type Joiner,
} from '../starter';
import type { BuildInductionPlanResult, M06Rpc, SaveIntakeBaselineResult } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Fs77Rpc = Pick<M06Rpc, 'saveIntakeBaseline' | 'buildInductionPlan' | 'inductionJoiners'>;
const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function makeLocalFs77(b: LocalBackend, h: LocalRpcHelpers): Fs77Rpc {
  const raw = (t: string) => b.raw(t as Table) as unknown as Row[];
  const get = (t: string, id: string) => b.rawGet(t as Table, id) as unknown as Row | undefined;
  const ins = (t: string, row: Row) => b.rawInsert(t as Table, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as Table, id, patch as never);
  const modules = () => raw('induction_modules') as unknown as InductionModule[];
  const baselines = () => raw('intake_baselines') as unknown as BaselineRow[];

  return {
    async saveIntakeBaseline(input) {
      await b.whenReady();
      type R = SaveIntakeBaselineResult;
      const me = b.identity().personId;
      if (!me) return h.refuse<R>('intake.baseline.save', 'intake_baselines', null, 'not_signed_in', IB_MSG.not_signed_in);
      const role = b.access().actingRole('workforce_strategy', ['W']);
      if (!role) return h.refuse<R>('intake.baseline.save', 'intake_baselines', null, 'forbidden', IB_MSG.forbidden_baseline);
      const p = (input ?? {}) as Row;
      const code = baselineProblem(p, modules());
      if (code) return h.refuse<R>('intake.baseline.save', 'intake_baselines', null, 'invalid', IB_MSG[code], role);
      const year = Number(p.intake_year);
      const scope = String(p.programme);
      const same = baselines().filter((x) => Number(x.intake_year) === year && x.programme === scope);
      const draft = same.find((x) => x.status === 'draft');
      const version = draft ? Number(draft.version) : same.reduce((m, x) => Math.max(m, Number(x.version)), 0) + 1;
      const id = draft ? draft.id : baselineId(year, scope, version);
      const ts = nowTs();
      const row = { entries: cleanEntries(p.entries, modules()), note_en: trim(p.note_en), note_ar: trim(p.note_ar), set_by: me, set_at: ts };
      if (draft) upd('intake_baselines', id, row);
      else ins('intake_baselines', { id, intake_year: year, programme: scope, version, status: 'draft', published_by: null, published_at: null, listed: false, sample: false, ...row });
      if (p.publish === true) {
        for (const x of same) if (x.status === 'published') upd('intake_baselines', x.id, { status: 'superseded', listed: false });
        upd('intake_baselines', id, { status: 'published', listed: true, published_by: me, published_at: ts });
      }
      const all = baselines();
      const stale = raw('induction_plans').filter((pl) => Number(pl.intake_year) === year && (scope === 'all' || pl.programme === scope)
        && (baselineFor(all, year, String(pl.programme))?.id ?? null) !== (pl.baseline_id ?? null)).length;
      const published = p.publish === true;
      return h.done<R>(published ? 'intake.baseline.publish' : 'intake.baseline.save', 'intake_baselines', id, `${published ? 'published' : 'draft'} v${version}, ${row.entries.length} modules, ${stale} stale plans`, role,
        published ? 'kafaa.intake.baseline_publish' : null, `Intake baseline ${year} (${scope}) v${version} published`,
        published ? `Baseline published; ${stale} induction plans now read a different baseline` : 'Draft baseline saved',
        { id, version, status: published ? 'published' : 'draft', stale_plans: stale }, ['intake_baselines']);
    },

    async buildInductionPlan(input) {
      await b.whenReady();
      type R = BuildInductionPlanResult;
      const me = b.identity().personId;
      if (!me) return h.refuse<R>('induction.plan.build', 'induction_plans', null, 'not_signed_in', IB_MSG.not_signed_in);
      const role = b.access().actingRole('workforce_strategy', ['W']);
      if (!role) return h.refuse<R>('induction.plan.build', 'induction_plans', null, 'forbidden', IB_MSG.forbidden_plan);
      const p = (input ?? {}) as Row;
      const person = typeof p.person_id === 'string' && p.person_id ? get('people', p.person_id) : undefined;
      const id = person ? planId(person.id) : null;
      const code = planProblem(p, person);
      if (code) return h.refuse<R>('induction.plan.build', 'induction_plans', id, 'invalid', IB_MSG[code], role);
      const year = Number(p.intake_year);
      const base = baselineFor(baselines(), year, String(p.programme));
      const plan = inductionPlan(modules(), base);
      const cur = get('induction_plans', id!);
      const revision = cur ? Number(cur.revision) + 1 : 1;
      const row = {
        person_name: String(person!.display_name ?? ''), programme: String(p.programme), intake_year: year, baseline_id: plan.baseline_id, baseline_version: plan.baseline_version,
        items: plan.items, hours_total: plan.hours_total, hours_planned: plan.hours_planned, hours_saved: plan.hours_saved, revision, built_by: me, built_at: nowTs(),
      };
      if (cur) upd('induction_plans', id!, row);
      else ins('induction_plans', { id, person_id: person!.id, sample: false, ...row });
      const nid = `nt-ip-${person!.id}-r${revision}`;
      if (!get('notifications', nid))
        ins('notifications', {
          id: nid, person_id: person!.id, kind: 'induction', title_en: `Your induction plan is ready: ${plan.hours_planned} hours (${plan.hours_saved} hours you already hold)`,
          title_ar: `خطة التهيئة الخاصة بك جاهزة: ${plan.hours_planned} ساعة (${plan.hours_saved} ساعة تمتلكها مسبقاً)`, body_en: null, body_ar: null, link: '/my/induction', severity: 'info', created_at: nowTs(), read_at: null,
        });
      return h.done<R>('induction.plan.build', 'induction_plans', id, `${p.programme} intake ${year}, baseline ${plan.baseline_id ?? 'none'}, ${plan.hours_planned} h planned, ${plan.hours_saved} h saved, r${revision}`, role, null, '',
        plan.baseline_id ? 'Induction plan built from the intake baseline' : 'Induction plan built: no published baseline for this intake, so the full induction applies',
        { id: id!, baseline_id: plan.baseline_id, hours_planned: plan.hours_planned, hours_saved: plan.hours_saved, revision }, ['induction_plans', 'notifications']);
    },

    async inductionJoiners() {
      await b.whenReady();
      type R = Joiner[];
      if (!b.identity().personId) return h.refuse<R>('induction.joiners', 'induction_plans', null, 'not_signed_in', IB_MSG.not_signed_in);
      if (!b.access().has('workforce_strategy', ['R', 'W']) && !b.access().has('sat', ['R', 'W', 'A'])) return h.refuse<R>('induction.joiners', 'induction_plans', null, 'forbidden', IB_MSG.forbidden_joiners);
      const data = joinerCandidates({ people: raw('people'), applications: raw('applications'), induction_plans: raw('induction_plans') }, todayIso());
      return { ok: true, code: 'ok', message: 'Joiners', audit_seq: null, ledger_seq: null, data } as Result<R>;
    },
  };
}
