// M07 · FS52 AI and automation exposure: LocalBackend RPC (owner: FS wave F · E2). Spread into makeLocalM07.
// 1:1 mirror of kafaa_outlook_automation in supabase/migrations/20261010262001_kafaa_fs62_outlook_automation.sql: the computeOutlook
// guard (workforce_analytics Agg/R and an HR or auditor role), the same refusal codes and messages, one audit row per refusal.
// Rules: src/modules/m07/outlook.ts (automationFor). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { automationFor, type AutomationProfile } from '../outlook';
import { OUTLOOK_ROLES, outlookInputFrom } from './outlook.local';
import type { M07AutomationRpc } from './automation.rpc';

type Row = Record<string, unknown>;

export function makeLocalM07Automation(b: LocalBackend, h: LocalRpcHelpers): M07AutomationRpc {
  const roles = () => b.identity().roles as string[];
  return {
    async outlookAutomation(params) {
      await b.whenReady();
      type R = AutomationProfile;
      if (!b.identity().personId) return h.refuse<R>('outlook.automation', 'skill_outlooks', null, 'not_signed_in', 'Sign in to see the skills outlook');
      const role = b.access().has('workforce_analytics', ['Agg', 'R']) ? OUTLOOK_ROLES.find((r) => roles().includes(r)) ?? null : null;
      if (!role) return h.refuse<R>('outlook.automation', 'skill_outlooks', null, 'forbidden', 'The skills outlook is for HR and auditors; line managers see released outlooks');
      const r = automationFor(outlookInputFrom(b), params ?? {});
      if (r.code !== 'ok') {
        return r.code === 'invalid' ? h.refuse<R>('outlook.automation', 'skill_outlooks', null, 'invalid', 'An assumption is outside its range', role)
          : h.refuse<R>('outlook.automation', 'skill_outlooks', ((params ?? {}) as Row).scenario_id as string ?? null, 'not_found', 'Staffing scenario not found', role);
      }
      return { ok: true, code: 'ok', message: 'Automation exposure (SIMULATED)', data: r.result } as Result<R>;
    },
  };
}
