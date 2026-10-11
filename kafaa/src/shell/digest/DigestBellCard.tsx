// F36: the digest at the top of the notifications panel: this period's count and top three items, with a link to /my#digest.
// Never rendered on speak-up (no-telemetry) routes; nothing is built from here (the /my panel builds it once per period).
import { L, useFormat, useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { DigestItemRow } from './DigestItemRow';
import { useDigest, useNoNudges } from './useDigest';
import { usePeriodLabel } from './DigestPanel';

export function DigestBellCard({ onNavigate }: { onNavigate: () => void }) {
  const t = useT();
  const f = useFormat();
  const { view, me } = useDigest();
  const label = usePeriodLabel();
  const noNudges = useNoNudges();
  if (!me || noNudges || !view || !view.prefs.enabled) return null;
  const cur = view.current;
  return (
    <div className="mb-2 rounded-btn border border-accent/30 bg-accent-soft/40 p-2" data-testid="digest-bell">
      <div className="flex items-center gap-2 px-1">
        <Icon name="sparkle" size={14} className="text-accent" />
        <span className="text-[12.5px] font-semibold">{t('digest.bell.title', { period: label(view.period) })}</span>
        {cur && <span className="num ms-auto text-[12px] text-ink-3">{t('digest.panel.items', { n: f.num(cur.item_count) })}</span>}
      </div>
      {cur ? (
        cur.items.length ? <ol className="px-1">{cur.items.slice(0, 3).map((i) => <DigestItemRow key={i.id} i={i} compact onOpen={onNavigate} />)}</ol> : <p className="px-1 text-[12px] text-ink-3">{t('digest.panel.nothing')}</p>
      ) : (
        <p className="px-1 text-[12px] text-ink-3">{t('digest.bell.notYet')}</p>
      )}
      <L to="/my#digest" className="mt-1 block px-1 text-[12px] font-semibold text-accent" onClick={onNavigate} data-testid="digest-bell-open">{t('digest.bell.open')}</L>
    </div>
  );
}
