/**
 * F12 → F18 hand-off: the aspiration signal for talent review. rpc.talentAspirations returns content only for people in the
 * caller's talent-review scope who switched "show my aspiration in talent review" on; otherwise the card reads
 * "Aspiration not shared" (or "No career conversation on record"). F18 renders <AspirationSignalCard signal=…/> per person,
 * fetched once per page with useTalentAspirations(personIds).
 */
import { useQuery, useRepo } from '../../data';
import { Icon, StatusPill } from '../../ui';
import { useFormat, useT } from '../../i18n';
import type { AspirationSignal } from './conversations';

export function useTalentAspirations(personIds: string[]) {
  const repo = useRepo();
  const key = [...new Set(personIds)].sort().join(',');
  return useQuery(['career_conversations'], async () => {
    if (!key) return new Map<string, AspirationSignal>();
    const r = await repo.rpc.talentAspirations(key.split(','));
    if (!r.ok) throw new Error(r.message);
    return new Map((r.data ?? []).map((x) => [x.person_id, x]));
  }, [key]);
}

export function AspirationSignalCard({ signal }: { signal: AspirationSignal | undefined | null }) {
  const t = useT();
  const f = useFormat();
  if (!signal || !signal.shared) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3" data-testid="m18-aspiration" data-shared="false" data-reason={signal?.reason ?? 'not_shared'}>
        <Icon name="lock" size={13} />{signal?.reason === 'none' ? t('m18.cc.signal.none') : t('m18.cc.signal.notShared')}
      </span>
    );
  }
  return (
    <div className="space-y-1 text-[13px]" data-testid="m18-aspiration" data-shared="true">
      <div className="flex flex-wrap gap-1.5">{(signal.aspirations ?? []).map((a, i) => <StatusPill key={a} tone={i === 0 ? 'accent' : 'neutral'}>{t(`m18.cc.asp.${a}`)}</StatusPill>)}</div>
      {signal.mobility && <div className="text-ink-2">{t(`m18.cc.mob.${signal.mobility}`)}{signal.leadership ? ` · ${t(`m18.cc.lead.${signal.leadership}`)}` : ''}</div>}
      {signal.goal_12m && <div className="text-ink-2">{t('m18.cc.signal.goal', { goal: signal.goal_12m })}</div>}
      <div className="text-[11.5px] text-ink-3">{t('m18.cc.signal.asOf', { date: f.date(signal.held_on ?? '') })}</div>
    </div>
  );
}
