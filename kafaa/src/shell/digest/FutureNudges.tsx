// FS75: the future-skills part of the digest UI. FutureNudgeStrip sits under this period's items on /my#digest (how many future-skills
// items the digest holds, the published rules behind them and the benchmarks FS75 follows); FutureNudgeRules lists the published method
// rows (kafaa_digest_nudge_rules: trigger, window, link, source feature) for the panel, the nudge settings and the admin digest page.
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BenchmarkChips, Icon, Skeleton, StatusPill } from '../../ui';
import { FS75_FROM } from './future';
import type { DigestItem } from './rules';

interface RuleRow { id: string; topic: string; kind: string; name_en: string; name_ar: string; rule_en: string; rule_ar: string; window_days: number | null; link: string; source_feature: string; since: string; sort: number }

export function FutureNudgeRules({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery('digest_nudge_rules', () => repo.list('digest_nudge_rules', { order: [['sort', 'asc']] }));
  if (q.error) return <p className="text-[12.5px] text-ink-3">{t('digest.future.empty')}</p>;
  if (!q.data) return <Skeleton lines={2} />;
  const rows = q.data as unknown as RuleRow[];
  if (!rows.length) return <p className="text-[12.5px] text-ink-3">{t('digest.future.empty')}</p>;
  return (
    <ol className="space-y-2" data-testid="digest-future-rules">
      {rows.map((r) => (
        <li key={r.id} className="rounded-btn border border-line bg-panel p-2.5" data-testid="digest-future-rule" data-topic={r.topic}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold">{pick(r as unknown as Record<string, unknown>, 'name')}</span>
            <StatusPill tone={r.kind === 'approval' ? 'sim' : 'info'}>{t(`digest.kind.${r.kind}`)}</StatusPill>
            <span className="text-[12px] text-ink-3">{r.window_days != null ? t('digest.future.window', { n: f.num(r.window_days) }) : t('digest.future.noWindow')}</span>
          </div>
          {!compact && <p className="mt-1 text-[12.5px] text-ink-2">{pick(r as unknown as Record<string, unknown>, 'rule')}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
            <span>{t('digest.future.feature', { id: r.source_feature })}</span>
            <span>{t('digest.future.since', { date: f.date(r.since) })}</span>
            <L to={r.link} className="font-semibold text-accent">{t('digest.future.link')}</L>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Under this period's items: the count of future-skills items, the method and the benchmarks (shown from the FS75 release on). */
export function FutureNudgeStrip({ items, asOf }: { items: DigestItem[]; asOf: string }) {
  const t = useT();
  const f = useFormat();
  if (asOf < FS75_FROM) return null;
  const n = items.filter((i) => i.kind === 'future').length;
  return (
    <div className="rounded-btn border border-accent/30 bg-accent-soft/30 p-2.5" data-testid="digest-future">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="chart" size={14} className="text-accent" />
        <span className="text-[12.5px] font-semibold">{t('digest.future.title')}</span>
        <span className="text-[12px] text-ink-3" data-testid="digest-future-count">{n ? t('digest.future.inThis', { n: f.num(n) }) : t('digest.future.none')}</span>
      </div>
      <details className="mt-1.5">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-accent" data-testid="digest-future-how">{t('digest.future.how')}</summary>
        <div className="mt-2 space-y-2">
          <p className="text-[12.5px] text-ink-2">{t('digest.future.intro')}</p>
          <p className="text-[12px] text-ink-3">{t('digest.future.method')}</p>
          <FutureNudgeRules compact />
        </div>
      </details>
      <div className="mt-2"><BenchmarkChips feature="FS75" /></div>
    </div>
  );
}
