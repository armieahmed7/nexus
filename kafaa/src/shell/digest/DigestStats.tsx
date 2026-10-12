// F36: digest aggregates for admins and auditors (rpc.digestStats): open rate per period and items per kind, every count under
// 10 suppressed; no person-level data. Rendered by the M13-hosted admin route /admin/digest.
import { useQuery, useRepo } from '../../data';
import { useFormat, useT } from '../../i18n';
import { Async, BarChart, Callout, Card, DataTable, StatTile, StatusPill } from '../../ui';
import { usePeriodLabel } from './DigestPanel';
import { CAPS, DIGEST_MAX, EXPIRY_WINDOW_DAYS, MATCH_MIN, NEW_OPP_DAYS } from './rules';
import { FS75_FROM } from './future';
import { FutureNudgeRules } from './FutureNudges';

export function DigestStats() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const label = usePeriodLabel();
  const q = useQuery(['digest_runs', 'digest_prefs', 'notifications'], () => repo.rpc.digestStats());
  const sup = (n: number | null) => (n == null ? <StatusPill tone="neutral">{t('digest.admin.suppressed')}</StatusPill> : f.num(n));
  return (
    <div className="space-y-4">
      <Callout tone="info" title={t('digest.admin.rulesTitle')}>{t('digest.admin.rules', { max: DIGEST_MAX, days: EXPIRY_WINDOW_DAYS, pct: Math.round(MATCH_MIN * 100), opp: NEW_OPP_DAYS })}
        <span className="mt-1 block" data-testid="digest-admin-future">{t('digest.admin.futureRules', { date: f.date(FS75_FROM), cap: f.num(CAPS.future) })}</span></Callout>
      <details className="rounded-btn border border-line p-2">
        <summary className="cursor-pointer text-[13px] font-semibold">{t('digest.future.how')}</summary>
        <div className="mt-2"><FutureNudgeRules /></div>
      </details>
      <Async state={q}>
        {(s) => {
          const latest = s.periods.find((p) => !p.suppressed);
          return (
            <div className="space-y-4" data-testid="digest-stats">
              <div className="grid gap-3 sm:grid-cols-4">
                <StatTile label={t('digest.admin.delivered')} value={latest?.delivered != null ? f.num(latest.delivered) : '—'} sub={latest ? label(latest.period) : t('digest.admin.suppressed')} />
                <StatTile label={t('digest.admin.openRate')} value={latest?.rate != null ? f.pct(latest.rate * 100, 0) : '—'} tone="ok" sub={t('digest.admin.openRateSub')} />
                <StatTile label={t('digest.admin.off')} value={s.off != null ? f.num(s.off) : t('digest.admin.lt10')} sub={t('digest.admin.offSub')} />
                <StatTile label={t('digest.admin.quiet')} value={s.quiet != null ? f.num(s.quiet) : t('digest.admin.lt10')} sub={t('digest.admin.quietSub')} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title={t('digest.admin.byPeriod')}>
                  <BarChart title={t('digest.admin.openRate')} unit="%" data={s.periods.filter((p) => p.rate != null).reverse().map((p) => ({ label: label(p.period), value: Math.round((p.rate ?? 0) * 1000) / 10 }))} />
                  <DataTable rows={s.periods} rowKey={(r) => r.period} dense csvName="digest-open-rate" columns={[
                    { key: 'period', header: t('digest.admin.period'), value: (r) => r.period, render: (r) => label(r.period) },
                    { key: 'delivered', header: t('digest.admin.delivered'), value: (r) => r.delivered ?? -1, render: (r) => sup(r.delivered), align: 'end' },
                    { key: 'opened', header: t('digest.admin.opened'), value: (r) => r.opened ?? -1, render: (r) => sup(r.opened), align: 'end' },
                    { key: 'rate', header: t('digest.admin.openRate'), value: (r) => r.rate ?? -1, render: (r) => (r.rate == null ? sup(null) : f.pct(r.rate * 100, 1)), align: 'end' },
                  ]} />
                </Card>
                <Card title={t('digest.admin.byKind')}>
                  <DataTable rows={s.kinds} rowKey={(r) => r.kind} dense csvName="digest-kinds" columns={[
                    { key: 'kind', header: t('digest.admin.kind'), value: (r) => r.kind, render: (r) => t(`digest.kind.${r.kind}`) },
                    { key: 'n', header: t('digest.admin.items'), value: (r) => r.n ?? -1, render: (r) => sup(r.n), align: 'end' },
                  ]} />
                  <p className="mt-2 text-[12px] text-ink-3">{t('digest.admin.mutedNote', { n: s.muted != null ? f.num(s.muted) : t('digest.admin.lt10') })}</p>
                </Card>
              </div>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
