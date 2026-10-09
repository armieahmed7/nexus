// /training/refreshers (M19 · F14 instructor view): how hard each open practice-bank question is in real refresher use, as aggregates
// only. Items and competencies answered by fewer than 10 people are suppressed. Feeds item analysis (M05): very easy or very hard
// items are flagged for the item writers. No individual learner is ever shown.
import { Page, Section, Card, Grid, StatTile, Async, ErrorState, DataTable, BarChart, Callout, StatusPill, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { TOO_EASY, TOO_HARD, type CompStat, type ItemStat } from './refresh';

export default function RefresherInsightsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['refresh_state', 'items'], async () => {
    const [res, comps] = await Promise.all([repo.rpc.refresherItemStats(), repo.list('competencies')]);
    return { res, comps };
  }, []);
  const pct = (p: number | null) => (p == null ? '—' : `${f.num(Math.round(p * 100))}%`);
  return (
    <Page title={t('m19.routes.training-refreshers.title')} intro={t('m19.rstats.intro')} wide actions={<L to="/training/items" className="btn-outline btn-sm">{t('m19.rstats.itemBank')}</L>}>
      <Async state={q} isEmpty={() => false}>
        {({ res, comps }) => {
          if (!res.ok || !res.data) return <ErrorState error={res.message} />;
          const d = res.data;
          const compName = (id: string) => { const c = comps.find((x) => x.id === id); return c ? pick(c, 'name') : id; };
          const shown = d.items.filter((i) => !i.suppressed);
          const flagged = shown.filter((i) => i.flag);
          const sup = (v: string) => <span className="text-ink-3">{v}</span>;
          const cols: Column<ItemStat>[] = [
            { key: 'item', header: t('m19.rstats.colItem'), value: (i) => i.item_id, render: (i) => <span className="ltr font-mono text-[12.5px]">{i.item_id}</span> },
            { key: 'comp', header: t('m19.rstats.colCompetency'), value: (i) => compName(i.competency_id) },
            { key: 'diff', header: t('m19.rstats.colDifficulty'), value: (i) => t(`m19.refresh.diff.${i.difficulty}`) },
            { key: 'people', header: t('m19.rstats.colPeople'), value: (i) => i.people, render: (i) => (i.suppressed ? sup(t('common.suppressedShort')) : f.num(i.people ?? 0)), align: 'end' },
            { key: 'attempts', header: t('m19.rstats.colAttempts'), value: (i) => i.attempts, render: (i) => (i.suppressed ? sup('—') : f.num(i.attempts ?? 0)), align: 'end' },
            { key: 'p', header: t('m19.rstats.colP'), value: (i) => i.p_value, render: (i) => (i.suppressed ? sup('—') : pct(i.p_value)), align: 'end' },
            { key: 'bank', header: t('m19.rstats.colBankP'), value: (i) => i.bank_p_value, render: (i) => pct(i.bank_p_value), align: 'end' },
            { key: 'flag', header: t('m19.rstats.colFlag'), value: (i) => i.flag ?? '', render: (i) => (i.flag ? <StatusPill tone={i.flag === 'too_hard' ? 'bad' : 'sim'}>{t(`m19.rstats.flag.${i.flag}`)}</StatusPill> : null) },
          ];
          const ccols: Column<CompStat>[] = [
            { key: 'comp', header: t('m19.rstats.colCompetency'), value: (c) => compName(c.competency_id) },
            { key: 'people', header: t('m19.rstats.colPeople'), value: (c) => c.people, render: (c) => (c.suppressed ? sup(t('common.suppressedShort')) : f.num(c.people ?? 0)), align: 'end' },
            { key: 'attempts', header: t('m19.rstats.colAttempts'), value: (c) => c.attempts, render: (c) => (c.suppressed ? sup('—') : f.num(c.attempts ?? 0)), align: 'end' },
            { key: 'p', header: t('m19.rstats.colP'), value: (c) => c.p_value, render: (c) => (c.suppressed ? sup('—') : pct(c.p_value)), align: 'end' },
          ];
          return (
            <div className="space-y-6" data-testid="m19-rstats">
              <Grid cols={4}>
                <StatTile label={t('m19.rstats.items')} value={f.num(d.items.length)} sub={t('m19.rstats.itemsSub', { n: f.num(shown.length) })} />
                <StatTile label={t('m19.rstats.suppressed')} value={f.num(d.items.length - shown.length)} sub={t('m19.rstats.suppressedSub', { n: f.num(d.min_group) })} />
                <StatTile label={t('m19.rstats.tooEasy')} value={f.num(flagged.filter((i) => i.flag === 'too_easy').length)} sub={t('m19.rstats.tooEasySub', { p: f.num(TOO_EASY * 100) })} tone="sim" />
                <StatTile label={t('m19.rstats.tooHard')} value={f.num(flagged.filter((i) => i.flag === 'too_hard').length)} sub={t('m19.rstats.tooHardSub', { p: f.num(TOO_HARD * 100) })} tone="bad" />
              </Grid>
              <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                <Section title={t('m19.rstats.byCompetency')}>
                  <Card><BarChart title={t('m19.rstats.byCompetency')} unit="%" max={100} data={d.by_competency.map((c) => ({ label: compName(c.competency_id), value: c.p_value == null ? null : Math.round(c.p_value * 100), suppressed: c.suppressed }))} /></Card>
                </Section>
                <Section title={t('m19.rstats.byCompetencyTable')}>
                  <DataTable rows={d.by_competency} columns={ccols} rowKey={(c) => c.competency_id} searchable={false} dense caption={t('m19.rstats.byCompetencyTable')} />
                </Section>
              </div>
              <Section title={t('m19.rstats.itemsTitle')} description={t('m19.rstats.itemsBody')}>
                <DataTable rows={d.items} columns={cols} rowKey={(i) => i.item_id} csvName="kafaa-refresher-item-difficulty.csv" initialSort={{ key: 'p', dir: 'asc' }} caption={t('m19.rstats.itemsTitle')} dense />
              </Section>
              <Callout title={t('m19.rstats.privacyTitle')}>{t('m19.rstats.privacyBody', { n: f.num(d.min_group) })}</Callout>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
