// /leadership/insights (M22 · F16): HR view of the academy. Leadership-behaviour 360 averages by grade and nominations by status,
// both aggregate-only with every cell under 10 suppressed (rpc.leadershipStats), plus the published 2024 programme completions
// with their source. No individual 360 answer is ever shown.
import { Page, Section, Async, EmptyState, Callout, Heatmap, BarChart, StatTile, Grid } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BEHAVIOUR_IDS } from './domain';
import { Sources } from './ui';

export default function LeadershipInsightsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const me = useSession().identity.personId;
  const stats = useQuery(['leadership_360', 'leadership_nominations'], () => repo.rpc.leadershipStats(), [me]);
  const progs = useQuery(['leadership_programmes'], () => repo.list('leadership_programmes', { order: [['sort', 'asc']] }), []);
  return (
    <Page title={t('m22.routes.leadership-insights.title')} intro={t('m22.insights.intro')} eyebrow={<L to="/leadership">{t('m22.programme.back')}</L>} wide>
      <div className="space-y-8">
        <Async state={stats} isEmpty={(s) => !s} empty={<EmptyState icon="lock" title={t('m22.insights.noAccess')} />}>
          {(s) => (
            <>
              <Section title={t('m22.insights.nomTitle')} description={t('m22.insights.nomSub')}>
                <Grid cols={4}>
                  {s!.nominations.map((x) => <StatTile key={x.status} label={t(`m22.nomStatus.${x.status}`)} value={x.suppressed ? t('common.suppressedShort') : f.num(x.n)} sub={x.suppressed ? t('common.suppressed') : undefined} />)}
                </Grid>
              </Section>
              <Section title={t('m22.insights.r360Title', { cycle: s!.cycle ?? '—' })} description={t('m22.insights.r360Sub')}>
                <div data-testid="m22-insights-heatmap">
                  <Heatmap title={t('m22.insights.r360Title', { cycle: s!.cycle ?? '—' })} rows={s!.by_level.map((l) => l.level)} cols={BEHAVIOUR_IDS}
                    rowLabel={(r) => { const l = s!.by_level.find((x) => x.level === r)!; return `${t(`m22.grade.${r}`)}${l.subjects != null ? ` (${f.num(l.subjects)})` : ''}`; }}
                    colLabel={(c) => t(`m22.behaviours.${c}.short`)}
                    value={(r, c) => { const l = s!.by_level.find((x) => x.level === r)!; return l.suppressed ? { v: null, suppressed: true } : { v: l.scores![c] }; }} />
                </div>
                <p className="mt-2 text-[12px] text-ink-3">{t('m22.insights.r360Note')}</p>
              </Section>
            </>
          )}
        </Async>
        <Async state={progs}>
          {(rows) => (
            <Section title={t('m22.insights.factsTitle')} description={t('m22.insights.factsSub')}>
              <BarChart title={t('m22.insights.factsTitle')} data={rows.filter((g) => g.completions != null && g.completions_year === 2024).map((g) => ({ label: pick(g, 'title'), value: g.completions! }))} />
              <div className="mt-2"><Sources sources={rows[0]?.sources} /></div>
            </Section>
          )}
        </Async>
        <Callout title={t('m22.insights.privacyTitle')}>{t('m22.insights.privacyBody')}</Callout>
      </div>
    </Page>
  );
}
