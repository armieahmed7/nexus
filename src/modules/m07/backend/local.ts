// M07 extension LocalBackend RPCs (owner: W3 · E3, F22 Handover 2030 board). Installed on every LocalRpc by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009133001_kafaa_w3e3_handover.sql (kafaa_handover_aggregate, kafaa_prepare_handover_release):
// same checks, refusal codes and audit rows. Rules: src/modules/m07/handover.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { todayIso } from '../../../domain/rules';
import { careerReadiness } from '../../m18/career';
import { careerDataFrom } from '../../m18/backend/local';
import { computeHandover, gatherNamed, releaseTiles, validScenario, OSSA_END_DEFAULT, type HandoverInput } from '../handover';
import type { HandoverResult, M07Rpc } from './rpc';

/** Roles that may read the board (workforce_analytics Agg/R); observers see only approved releases. */
export const HANDOVER_ROLES = ['hr_director', 'hr_analyst', 'manager', 'auditor'] as const;

type AnyRow = Record<string, unknown>;
/** F19 tables are read only when they exist (W3 · E1 builds them in the same wave); otherwise the F05 shortlist path serves. */
function optional(b: LocalBackend, table: string): AnyRow[] {
  try {
    const rows = (b.raw as (t: string) => unknown)(table);
    return Array.isArray(rows) ? (rows as AnyRow[]) : [];
  } catch {
    return [];
  }
}

export function handoverPeriods(b: LocalBackend): string[] {
  return [...new Set(b.raw('external_cover').map((c) => c.period))].sort();
}

/** Definer-side input for one period: cover plan, cohorts, roles and the named successors (F19 or F05). */
export function handoverInputFrom(b: LocalBackend, period: string, now: string): { input: HandoverInput; f19Roles: string[] } {
  const cover = b.raw('external_cover').filter((c) => c.period === period).map((c) => ({ role_id: c.role_id, year: c.year, cover_count: c.cover_count }));
  const coverRoles = [...new Set(cover.map((c) => c.role_id))];
  const { named, f19Roles } = gatherNamed(
    { people: b.raw('people'), targets: b.raw('career_targets'), slates: optional(b, 'succession_slates'), successors: optional(b, 'successors') },
    coverRoles,
    (pid, rid) => {
      const r = careerReadiness(careerDataFrom(b, pid), pid, [rid], now)[0];
      return r ? { band: r.band, months: r.months } : null;
    },
  );
  return {
    input: {
      period,
      roles: b.raw('job_roles').map((r) => ({ id: r.id, family_id: r.family_id ?? null })),
      cover,
      cohorts: b.raw('handover_cohorts').filter((c) => c.period === period).map((c) => ({ role_id: c.role_id, route: c.route, trainees: c.trainees, emirati: c.emirati, ready_on: c.ready_on })),
      named,
    },
    f19Roles,
  };
}

export function makeLocalM07(b: LocalBackend, h: LocalRpcHelpers): M07Rpc {
  const boardRole = (): string | null => {
    const roles = b.identity().roles as string[];
    if (!b.access().has('workforce_analytics', ['Agg', 'R'])) return null;
    return HANDOVER_ROLES.find((r) => roles.includes(r)) ?? null;
  };
  return {
    async handoverAggregate(period, scenario) {
      await b.whenReady();
      type R = HandoverResult;
      const who = b.identity();
      if (!who.personId) return h.refuse<R>('handover.read', 'external_cover', period ?? null, 'not_signed_in', 'Sign in to see the handover board');
      const role = boardRole();
      if (!role) return h.refuse<R>('handover.read', 'external_cover', period ?? null, 'forbidden', 'The handover board is for HR, line managers and auditors; observers see approved releases only');
      const periods = handoverPeriods(b);
      if (!period) period = periods[periods.length - 1] ?? ''; // no period: the latest plan
      if (!period || !periods.includes(period)) return h.refuse<R>('handover.read', 'external_cover', period ?? null, 'not_found', 'No handover plan for this period', role);
      const sc = validScenario({ ossa_end: scenario?.ossa_end ?? OSSA_END_DEFAULT, slip_months: scenario?.slip_months ?? 0 });
      if (!sc) return h.refuse<R>('handover.read', 'external_cover', period, 'invalid', 'OSSA end must be 2028 to 2032 and the pipeline slip 0 to 24 months', role);
      const { input, f19Roles } = handoverInputFrom(b, period, todayIso());
      return { ok: true, code: 'ok', message: 'Handover board', data: { ...computeHandover(input, sc, f19Roles), periods } } as Result<R>;
    },

    async prepareHandoverRelease(period) {
      await b.whenReady();
      type R = { id: string };
      if (!b.identity().personId) return h.refuse<R>('observer_report.draft_handover', 'observer_reports', period ?? null, 'not_signed_in', 'Sign in to prepare a release');
      const role = b.access().actingRole('observer_release', ['W', 'A']);
      if (!role) return h.refuse<R>('observer_report.draft_handover', 'observer_reports', period ?? null, 'forbidden', 'Only HR may prepare an observer report');
      if (!period || !handoverPeriods(b).includes(period)) return h.refuse<R>('observer_report.draft_handover', 'observer_reports', period ?? null, 'not_found', 'No handover plan for this period', role);
      const { input, f19Roles } = handoverInputFrom(b, period, todayIso());
      const a = computeHandover(input, { ossa_end: OSSA_END_DEFAULT, slip_months: 0 }, f19Roles);
      const n = b.raw('observer_reports').filter((r) => r.id.startsWith(`or-ho-${period.toLowerCase()}-`)).length + 1;
      const id = `or-ho-${period.toLowerCase()}-${n}`;
      b.rawInsert('observer_reports', {
        id, title_en: `Handover 2030 readiness, ${period} (aggregate)`, title_ar: `جاهزية التسليم 2030، ${period} (إجمالي)`, period,
        body: { kind: 'handover', tiles: releaseTiles(a), burndown: { years: a.years, cover: a.total.cover, ready: a.total.ready }, note: 'Aggregate only; groups under 10 suppressed. Cover plan SAMPLE; projections SIMULATED. Not a regulatory submission.' } as never,
        status: 'draft', prepared_by: b.identity().personId, approved_by: null, approved_at: null, released_to_org_ids: [],
      });
      return h.done<R>('observer_report.draft_handover', 'observer_reports', id, `handover ${period}`, role, null, '', 'Draft release saved; submit it from Workforce analytics', { id }, ['observer_reports']);
    },
  };
}
