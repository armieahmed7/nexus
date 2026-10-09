// F36: the signed-in person's digests and nudge settings (RLS: own rows only), the current period and the build action.
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useI18n } from '../../i18n';
import { routeForPath } from '../../routes/registry';
import { todayIso } from '../../domain/rules';
import { periodOf, prefsOf, type DigestItem } from './rules';
import type { Reason } from '../../domain/engines/types';

export interface RunRow { id: string; person_id: string; period: string; frequency: string; as_of: string; items: DigestItem[]; item_count: number; notification_id: string | null; coach_hint: boolean; built_at: string }

export function useDigest() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['digest_runs', 'digest_prefs', 'notifications'], async () => {
    if (!me) return null;
    const [runs, prefs, notes] = await Promise.all([
      repo.list('digest_runs', { filter: { person_id: me }, order: [['built_at', 'desc']], limit: 6 }).catch(() => []),
      repo.list('digest_prefs', { filter: { person_id: me } }).catch(() => []),
      repo.list('notifications', { filter: { person_id: me, kind: 'digest' }, order: [['created_at', 'desc']], limit: 6 }).catch(() => []),
    ]);
    return { runs: runs as unknown as RunRow[], prefsRow: (prefs[0] ?? null) as unknown as Record<string, unknown> | null, notes };
  }, [me]);
  const view = useMemo(() => {
    if (!q.data) return null;
    const prefs = prefsOf(q.data.prefsRow);
    const period = periodOf(todayIso(), prefs.frequency);
    const current = q.data.runs.find((r) => r.period === period) ?? null;
    const notice = current?.notification_id ? q.data.notes.find((n) => n.id === current.notification_id) ?? null : null;
    return { prefs, period, current, notice, history: q.data.runs.filter((r) => r.period !== period).slice(0, 3) };
  }, [q.data]);
  return { q, view, me };
}

/** Speak-up and any other no-telemetry route never shows or builds a nudge. */
export function useNoNudges(): boolean {
  const { path } = useI18n();
  return !!routeForPath(path)?.def.guard.noTelemetry;
}

/** Item reasons as F02 reasons for <WhyThis> (digest.why.* unless the item carries the coach engine's own key). */
export const itemReasons = (i: DigestItem): Reason[] => i.why.map((w) => ({ code: w.code, key: w.key ?? `digest.why.${w.code}`, vars: (w.vars ?? {}) as Reason['vars'] }));
export const KIND_ICON: Record<string, string> = { expiry: 'alert', approval: 'check', coach: 'grad', opportunity: 'sparkle', mentoring: 'users', conversation: 'chat', refresher: 'reset' };
