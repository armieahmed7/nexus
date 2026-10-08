// /my/coach/insights (M19 · F07 RBAC): aggregated acceptance of Learning Coach suggestions for HR (skills_profile Agg) and the
// training manager (A). Counts only, from rpc.coachInsights; any cell with fewer than 10 people is suppressed. No names.
import { Page, Grid, StatTile, Card, BarChart, DataTable, Async, Callout, StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import type { CoachInsightCell } from './backend/rpc';

export default function CoachInsightsPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const pick = usePick();
  const q = useQuery(['coach_feedback', 'learning_goals'], async () => {
    const [r, families] = await Promise.all([repo.rpc.coachInsights(), repo.list('job_families').catch(() => [])]);
    if (!r.ok || !r.data) throw new Error(r.message);
    return { ...r.data, families: new Map(families.map((x) => [x.id, x])) };
  });
  const sup = (c: CoachInsightCell, v: number | null, fmt: (n: number) => string) => (c.suppressed ? <StatusPill tone="sim">{t('common.suppressedShort')}</StatusPill> : v == null ? '—' : fmt(v));
  const cols = (label: string, name: (k: string) => string) => [
    { key: 'key', header: label, value: (c: CoachInsightCell) => name(c.key), sortable: true },
    { key: 'people', header: t('m19.insights.people'), value: (c: CoachInsightCell) => c.people ?? -1, render: (c: CoachInsightCell) => sup(c, c.people, (n) => f.num(n)), align: 'end' as const },
    { key: 'saved', header: t('m19.insights.saved'), value: (c: CoachInsightCell) => c.saved ?? -1, render: (c: CoachInsightCell) => sup(c, c.saved, (n) => f.num(n)), align: 'end' as const },
    { key: 'enrolled', header: t('m19.insights.enrolled'), value: (c: CoachInsightCell) => c.enrolled ?? -1, render: (c: CoachInsightCell) => sup(c, c.enrolled, (n) => f.num(n)), align: 'end' as const },
    { key: 'dismissed', header: t('m19.insights.dismissed'), value: (c: CoachInsightCell) => c.dismissed ?? -1, render: (c: CoachInsightCell) => sup(c, c.dismissed, (n) => f.num(n)), align: 'end' as const },
    { key: 'acceptance', header: t('m19.insights.acceptance'), value: (c: CoachInsightCell) => c.acceptance_pct ?? -1, render: (c: CoachInsightCell) => sup(c, c.acceptance_pct, (n) => f.pct(n)), align: 'end' as const, sortable: true },
  ];
  return (
    <Page title={t('m19.routes.coach-insights.title')} intro={t('m19.insights.intro')}>
      <Async state={q}>
        {(d) => (
          <div className="space-y-6">
            <Callout title={t('m19.insights.ruleTitle')}>{t('m19.insights.ruleBody', { n: f.num(d.min_group) })}</Callout>
            <Grid cols={3}>
              <StatTile label={t('m19.insights.acceptanceAll')} value={d.total.suppressed ? t('common.suppressedShort') : f.pct(d.total.acceptance_pct)} sub={t('m19.insights.acceptanceSub')} sim />
              <StatTile label={t('m19.insights.peopleAll')} value={d.total.suppressed ? t('common.suppressedShort') : f.num(d.total.people)} sub={t('m19.insights.peopleSub')} sim />
              <StatTile label={t('m19.insights.goals')} value={d.goals.suppressed ? t('common.suppressedShort') : f.num(d.goals.people)} sub={d.goals.suppressed ? t('common.suppressed') : t('m19.insights.goalsSub', { h: f.num(d.goals.median_hours) })} sim />
            </Grid>
            <Card title={t('m19.insights.byKindChart')}>
              <BarChart title={t('m19.insights.byKindChart')} unit="%" max={100} data={d.by_kind.filter((c) => !c.suppressed && c.acceptance_pct != null).map((c) => ({ label: t(`m19.kind.${c.key}`), value: c.acceptance_pct! }))} />
            </Card>
            <Card title={t('m19.insights.byKind')}>
              <div data-testid="m19-insights-kind"><DataTable rows={d.by_kind} rowKey={(c) => c.key} searchable={false} csvName="coach-acceptance-by-kind" columns={cols(t('m19.insights.kindCol'), (k) => t(`m19.kind.${k}`))} /></div>
            </Card>
            <Card title={t('m19.insights.byFamily')}>
              <div data-testid="m19-insights-family"><DataTable rows={d.by_family} rowKey={(c) => c.key} searchable={false} csvName="coach-acceptance-by-family" columns={cols(t('m19.insights.familyCol'), (k) => (k === 'unassigned' ? t('m19.insights.unassigned') : d.families.has(k) ? pick(d.families.get(k), 'name') : k))} /></div>
            </Card>
          </div>
        )}
      </Async>
    </Page>
  );
}
