// F36: one digest item: kind icon, title, the date line, urgency, "Why this?" and the deep link.
import { L, useFormat, useLang, useT } from '../../i18n';
import { Icon, StatusPill, WhyThis, type PillTone } from '../../ui';
import type { IconName } from '../../ui/Icon';
import type { DigestItem } from './rules';
import { itemReasons, KIND_ICON } from './useDigest';

const URGENCY_TONE: Record<number, PillTone> = { 1: 'bad', 2: 'sim', 3: 'info' };

export function DigestItemRow({ i, compact = false, onOpen }: { i: DigestItem; compact?: boolean; onOpen?: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const title = lang === 'ar' ? i.title_ar || i.title_en : i.title_en;
  const line = (() => {
    if (i.kind === 'opportunity') return t('digest.line.opportunity', { pct: f.num(Math.round((i.score ?? 0) * 100)) });
    if (i.kind === 'refresher') return t('digest.line.refresher');
    if (i.days == null) return t(`digest.line.${i.kind}_open`);
    if (i.days < 0) return t('digest.line.overdue', { date: f.date(i.due_on!) });
    if (i.days === 0) return t('digest.line.today');
    return t(`digest.line.${i.kind}`, { n: f.num(i.days), date: f.date(i.due_on!) });
  })();
  return (
    <li className={`flex items-start gap-3 ${compact ? 'py-1.5' : 'rounded-btn border border-line bg-panel p-3'}`} data-testid="digest-item" data-kind={i.kind} data-urgency={i.urgency}>
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${i.urgency === 1 ? 'bg-bad-bg text-bad' : i.urgency === 2 ? 'bg-sim-bg text-sim' : 'bg-accent-soft text-accent'}`}>
        <Icon name={(KIND_ICON[i.kind] ?? 'info') as IconName} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <L to={i.link} className="font-semibold" onClick={onOpen} data-testid="digest-link">{title}</L>
          {!compact && <StatusPill tone={URGENCY_TONE[i.urgency]}>{t(`digest.kind.${i.kind}`)}</StatusPill>}
        </div>
        <div className="text-[12.5px] text-ink-3">
          {compact && <span className="me-1">{t(`digest.kind.${i.kind}`)} ·</span>}
          {line}
        </div>
        {!compact && <WhyThis reasons={itemReasons(i)} testId="digest-why" />}
      </div>
    </li>
  );
}
