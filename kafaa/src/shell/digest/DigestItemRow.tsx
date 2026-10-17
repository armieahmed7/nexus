// F36: one digest item: kind icon, title, the date line, urgency, "Why this?" and the deep link.
// EMP-01: days and overdue are worked out from the item's date and today at render (the stored run is a snapshot of the day it
// was built), day counts use the language's plural forms, and an item handled since the build is ticked and greyed (`done`).
import { L, useCount, useFormat, useLang, useT } from '../../i18n';
import { Icon, StatusPill, WhyThis, type PillTone } from '../../ui';
import type { IconName } from '../../ui/Icon';
import { todayIso } from '../../domain/rules';
import type { DigestItem } from './rules';
import { itemReasons, KIND_ICON } from './useDigest';
import { futureTopic } from './future';
import { liveItem } from './live';

const URGENCY_TONE: Record<number, PillTone> = { 1: 'bad', 2: 'sim', 3: 'info' };

export function DigestItemRow({ i: stored, compact = false, onOpen, done = false, today }: { i: DigestItem; compact?: boolean; onOpen?: () => void; done?: boolean; today?: string }) {
  const t = useT();
  const f = useFormat();
  const c = useCount();
  const lang = useLang();
  const i = liveItem(stored, today ?? todayIso());
  const title = lang === 'ar' ? i.title_ar || i.title_en : i.title_en;
  const days = (n: number) => c('common.nDays', n);
  const line = (() => {
    if (i.kind === 'future') { // FS75: one line per topic (dated: decay lapse, goal target date)
      const tp = futureTopic(i) ?? 'open';
      if (i.days != null && i.due_on) return i.days < 0 ? t('digest.line.overdue', { date: f.date(i.due_on) }) : i.days === 0 ? t('digest.line.today') : t(`digest.line.future_${tp}`, { n: f.num(i.days), days: days(i.days), date: f.date(i.due_on) });
      return t(tp === 'goal' ? 'digest.line.future_goal_open' : tp === 'decay' || tp === 'open' ? 'digest.line.future_open' : `digest.line.future_${tp}`);
    }
    if (i.kind === 'opportunity') return t('digest.line.opportunity', { pct: f.num(Math.round((i.score ?? 0) * 100)) });
    if (i.kind === 'refresher') return t('digest.line.refresher');
    if (i.days == null) return t(`digest.line.${i.kind}_open`);
    if (i.days < 0) return t('digest.line.overdue', { date: f.date(i.due_on!) });
    if (i.days === 0) return t('digest.line.today');
    return t(`digest.line.${i.kind}`, { n: f.num(i.days), days: days(i.days), date: f.date(i.due_on!) });
  })();
  // stored reasons carry the build-day count as a number: show today's count as a plural phrase
  const reasons = itemReasons(i).map((r) => (r.key.startsWith('digest.why.') && typeof r.vars?.days === 'number' ? { ...r, vars: { ...r.vars, days: days(r.vars.days) } } : r));
  return (
    <li className={`flex items-start gap-3 ${compact ? 'py-1.5' : 'rounded-btn border border-line bg-panel p-3'}`} data-testid="digest-item" data-kind={i.kind} data-urgency={i.urgency} data-done={done ? 'true' : undefined}>
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? 'bg-ok-bg text-ok' : i.urgency === 1 ? 'bg-bad-bg text-bad' : i.urgency === 2 ? 'bg-sim-bg text-sim' : 'bg-accent-soft text-accent'}`}>
        <Icon name={(done ? 'check' : KIND_ICON[i.kind] ?? 'info') as IconName} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <L to={i.link} className={`font-semibold ${done ? 'text-ink-3' : ''}`} onClick={onOpen} data-testid="digest-link">{title}</L>
          {!compact && <StatusPill tone={done ? 'ok' : URGENCY_TONE[i.urgency]}>{t(`digest.kind.${i.kind}`)}</StatusPill>}
        </div>
        <div className="text-[12.5px] text-ink-3">
          {compact && <span className="me-1">{t(`digest.kind.${i.kind}`)} ·</span>}
          {done ? <span data-testid="digest-done">{t('digest.line.done')}</span> : line}
        </div>
        {!compact && <WhyThis reasons={reasons} testId="digest-why" />}
      </div>
    </li>
  );
}
