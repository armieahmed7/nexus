// M07 · F35 Skills supply-and-demand outlook: LocalBackend RPCs (owner: W5 · E4). Spread into makeLocalM07.
// 1:1 mirror of supabase/migrations/20261009154001_kafaa_w5e4_skills_outlook.sql: same checks in the same order, the same refusal
// codes and messages, one audit row for every refusal and every write, ledger rows on release and withdrawal. Rules:
// src/modules/m07/outlook.ts. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { newId } from '../../../data/local/store';
import { publicTextIsClean } from '../../../domain/future';
import { inputFromTables, outlookFor, simulatedName, type OutlookInput, type OutlookParams, type OutlookResult } from '../outlook';
import type { M07OutlookRpc, ReleasedOutlook } from './outlook.rpc';

type Row = Record<string, any>;
/** Who may run the live outlook (workforce_analytics Agg/R): HR and auditors. */
export const OUTLOOK_ROLES = ['hr_director', 'hr_analyst', 'auditor'] as const;
/** Who may read released outlooks: the above plus line managers (never observers). */
export const RELEASED_ROLES = ['hr_director', 'hr_analyst', 'manager', 'auditor'] as const;
export const SUMMARY_MIN = 10;
export const SUMMARY_MAX = 600;
export const NAME_MAX = 120;

/** Definer-side input from the in-browser tables. */
export const outlookInputFrom = (b: LocalBackend): OutlookInput => inputFromTables((t) => ((b.raw as (x: string) => unknown)(t) as Row[]) ?? []);

export function makeLocalM07Outlook(b: LocalBackend, h: LocalRpcHelpers): M07OutlookRpc {
  const roles = () => b.identity().roles as string[];
  const outlookRole = (): string | null => (b.access().has('workforce_analytics', ['Agg', 'R']) ? OUTLOOK_ROLES.find((r) => roles().includes(r)) ?? null : null);
  const hrRole = (): string | null => (roles().includes('hr_director') ? 'hr_director' : roles().includes('hr_analyst') ? 'hr_analyst' : null);
  const now = () => new Date().toISOString();
  return {
    async computeOutlook(params) {
      await b.whenReady();
      type R = OutlookResult;
      if (!b.identity().personId) return h.refuse<R>('outlook.compute', 'skill_outlooks', null, 'not_signed_in', 'Sign in to see the skills outlook');
      const role = outlookRole();
      if (!role) return h.refuse<R>('outlook.compute', 'skill_outlooks', null, 'forbidden', 'The skills outlook is for HR and auditors; line managers see released outlooks');
      const r = outlookFor(outlookInputFrom(b), params ?? {});
      if (r.code !== 'ok') {
        return r.code === 'invalid' ? h.refuse<R>('outlook.compute', 'skill_outlooks', null, 'invalid', 'An assumption is outside its range', role)
          : h.refuse<R>('outlook.compute', 'skill_outlooks', (params as Row)?.scenario_id ?? null, 'not_found', 'Staffing scenario not found', role);
      }
      return { ok: true, code: 'ok', message: 'Skills outlook (SIMULATED)', data: r.result } as Result<R>;
    },

    async saveOutlook(input) {
      await b.whenReady();
      type R = { id: string; name: string };
      const id0 = input?.id || null;
      if (!b.identity().personId) return h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'not_signed_in', 'Sign in to save an outlook');
      const role = hrRole();
      if (!role) return h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'forbidden', 'Only HR analysts and the HR director may save outlooks');
      const nm = (input?.name ?? '').trim();
      if (nm.length < 3 || nm.length > NAME_MAX) return h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'invalid', 'An outlook needs a name of 3 to 120 characters', role);
      const r = outlookFor(outlookInputFrom(b), input?.params ?? {});
      if (r.code !== 'ok') {
        return r.code === 'invalid' ? h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'invalid', 'An assumption is outside its range', role)
          : h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'not_found', 'Staffing scenario not found', role);
      }
      const name = simulatedName(nm);
      const me = b.identity().personId!;
      const ts = now();
      if (id0) {
        const cur = b.rawGet('skill_outlooks', id0) as Row | null;
        if (!cur || cur.created_by !== me) return h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'not_found', 'Outlook not found', role);
        if (cur.status === 'released') return h.refuse<R>('outlook.save', 'skill_outlooks', id0, 'released', 'Withdraw the release before changing this outlook', role);
        b.rawUpdate('skill_outlooks', id0, { name, params: r.result.params as never, results: r.result as never, status: 'draft', updated_at: ts, computed_at: ts } as never);
        return h.done<R>('outlook.save', 'skill_outlooks', id0, name, role, null, '', 'Outlook saved', { id: id0, name }, ['skill_outlooks']);
      }
      const id = newId('so');
      b.rawInsert('skill_outlooks', {
        id, name, params: r.result.params as never, results: r.result as never, status: 'draft', summary_en: '', summary_ar: '', created_by: me,
        created_at: ts, updated_at: ts, computed_at: ts, released_by: null, released_at: null, withdrawn_reason: null, simulated: true,
      } as never);
      return h.done<R>('outlook.save', 'skill_outlooks', id, name, role, null, '', 'Outlook saved', { id, name }, ['skill_outlooks']);
    },

    async releaseOutlook(id, summaryEn, summaryAr) {
      await b.whenReady();
      type R = { id: string };
      if (!b.identity().personId) return h.refuse<R>('outlook.release', 'skill_outlooks', id ?? null, 'not_signed_in', 'Sign in to release an outlook');
      if (!roles().includes('hr_director')) return h.refuse<R>('outlook.release', 'skill_outlooks', id ?? null, 'forbidden', 'Only the HR director releases a skills outlook');
      const cur = id ? (b.rawGet('skill_outlooks', id) as Row | null) : null;
      if (!cur) return h.refuse<R>('outlook.release', 'skill_outlooks', id ?? null, 'not_found', 'Outlook not found', 'hr_director');
      if (cur.status === 'released') return h.refuse<R>('outlook.release', 'skill_outlooks', id, 'already_released', 'This outlook is already released', 'hr_director');
      const en = (summaryEn ?? '').trim(), ar = (summaryAr ?? '').trim();
      if (en.length < SUMMARY_MIN || en.length > SUMMARY_MAX || ar.length < SUMMARY_MIN || ar.length > SUMMARY_MAX)
        return h.refuse<R>('outlook.release', 'skill_outlooks', id, 'invalid', 'Write a summary of 10 to 600 characters in English and in Arabic', 'hr_director');
      if (!publicTextIsClean([cur.name, en, ar])) return h.refuse<R>('outlook.release', 'skill_outlooks', id, 'not_clean', 'Release text may not state headcounts or site information (M11 rule)', 'hr_director');
      const r = outlookFor(outlookInputFrom(b), cur.params ?? {});
      if (r.code !== 'ok') return h.refuse<R>('outlook.release', 'skill_outlooks', id, r.code, r.code === 'not_found' ? 'Staffing scenario not found' : 'An assumption is outside its range', 'hr_director');
      const ts = now();
      b.rawUpdate('skill_outlooks', id, { status: 'released', summary_en: en, summary_ar: ar, results: r.result as never, released_by: b.identity().personId, released_at: ts, withdrawn_reason: null, updated_at: ts, computed_at: ts } as never);
      return h.done<R>('outlook.release', 'skill_outlooks', id, cur.name, 'hr_director', 'kafaa.workforce.outlook_release', `Skills outlook released: ${cur.name}`, 'Outlook released to line managers', { id }, ['skill_outlooks']);
    },

    async withdrawOutlook(id, reason) {
      await b.whenReady();
      type R = { id: string };
      if (!b.identity().personId) return h.refuse<R>('outlook.withdraw', 'skill_outlooks', id ?? null, 'not_signed_in', 'Sign in to withdraw an outlook');
      if (!roles().includes('hr_director')) return h.refuse<R>('outlook.withdraw', 'skill_outlooks', id ?? null, 'forbidden', 'Only the HR director withdraws a skills outlook');
      const cur = id ? (b.rawGet('skill_outlooks', id) as Row | null) : null;
      if (!cur) return h.refuse<R>('outlook.withdraw', 'skill_outlooks', id ?? null, 'not_found', 'Outlook not found', 'hr_director');
      if (cur.status !== 'released') return h.refuse<R>('outlook.withdraw', 'skill_outlooks', id, 'not_released', 'Only a released outlook can be withdrawn', 'hr_director');
      const why = (reason ?? '').trim();
      if (why.length < 5 || why.length > 500) return h.refuse<R>('outlook.withdraw', 'skill_outlooks', id, 'invalid', 'Give a reason of 5 to 500 characters', 'hr_director');
      b.rawUpdate('skill_outlooks', id, { status: 'withdrawn', withdrawn_reason: why, updated_at: now() } as never);
      return h.done<R>('outlook.withdraw', 'skill_outlooks', id, why, 'hr_director', 'kafaa.workforce.outlook_withdraw', `Skills outlook withdrawn: ${cur.name}`, 'Outlook withdrawn', { id }, ['skill_outlooks']);
    },

    async releasedOutlooks() {
      await b.whenReady();
      type R = ReleasedOutlook[];
      if (!b.identity().personId) return h.refuse<R>('outlook.released', 'skill_outlooks', null, 'not_signed_in', 'Sign in to see released outlooks');
      const role = b.access().has('workforce_analytics', ['Agg', 'R']) ? RELEASED_ROLES.find((r) => roles().includes(r)) ?? null : null;
      if (!role) return h.refuse<R>('outlook.released', 'skill_outlooks', null, 'forbidden', 'Released outlooks are for line managers, HR and auditors');
      const rows = (b.raw('skill_outlooks') as unknown as Row[]).filter((r) => r.status === 'released')
        .sort((x, y) => (x.released_at < y.released_at ? 1 : x.released_at > y.released_at ? -1 : x.id < y.id ? -1 : 1))
        .map((r) => ({ id: r.id, name: r.name, summary_en: r.summary_en, summary_ar: r.summary_ar, results: r.results, released_at: r.released_at }) as ReleasedOutlook);
      return { ok: true, code: 'ok', message: 'Released outlooks', data: rows } as Result<R>;
    },
  };
}

export type { OutlookParams };
