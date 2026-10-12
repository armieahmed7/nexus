// FS54 (wave F · E3): run a council RPC and toast the outcome in the reader's language. Refusal messages come back in English from both
// backends (GOV_MSG / kafaa_fs63_msg); they are mapped back to their code and shown from m16.gov.msg.<code>.
import { useCallback } from 'react';
import { useT } from '../../i18n';
import { useToast } from '../../ui';
import type { Result } from '../../data/types';
import { GOV_MSG, type GovCode } from './taxonomyGov';

const BY_MESSAGE = new Map<string, GovCode>(Object.entries(GOV_MSG).map(([k, v]) => [v, k as GovCode]));

export function govMessageKey(message: string | null | undefined): string | null {
  const c = message ? BY_MESSAGE.get(message) : undefined;
  return c ? `m16.gov.msg.${c}` : null;
}

export function useGovAction() {
  const t = useT();
  const toast = useToast();
  return useCallback(async <T,>(fn: () => Promise<Result<T>>, success: string): Promise<Result<T>> => {
    try {
      const r = await fn();
      if (r.ok) toast.push({ tone: 'ok', title: success });
      else { const k = govMessageKey(r.message); toast.push({ tone: 'bad', title: k ? t(k) : r.message, detail: r.code }); }
      return r;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.push({ tone: 'bad', title: message });
      return { ok: false, code: 'error', message };
    }
  }, [t, toast]);
}
