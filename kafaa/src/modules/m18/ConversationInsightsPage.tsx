// M18 /workforce/career-conversations (F12, HR aggregates). The aspiration signal reaches HR only as counts by job family from
// rpc.conversationInsights: a family under MIN_GROUP_SIZE shows "suppressed" throughout, and each aspiration or mobility count
// under 10 is suppressed on its own. Coverage of the six-monthly cadence, overdue pairs and acknowledgements with a comment.
// No individual record, name or free text is ever shown here.
import { Page, Section, Card, Async, Callout, StatTile, Grid, BarChart, Heatmap, DataTable, SimChip, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { ASPIRATIONS, MOBILITY, type ConversationInsights, type InsightCell } from './conversations';

export default function ConversationInsightsPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['career_conversations'], async () => {
    const [r, fams] = await Promise.all([repo.rpc.conversationInsights(), repo.list('job_families')]);
    if (!r.ok) throw new Error(r.message);
    return { ins: r.data as ConversationInsights, fams: new Map(fams.map((x) => [x.id, x])) };
  }, []);
  return (
    <Page title={t('m18.routes.workforce-career-conversations.title')} intro={t('m18.cc.ins.intro')} actions={<SimChip label={t('m18.cc.ins.synthetic')} />}>
      <Async state={q}>{(d) => <Body ins={d.ins} fams={d.fams} />}</Async>
    </Page>
  );
}

function Body({ ins, fams }: { ins: ConversationInsights; fams: Map<string, { name_en: string; name_ar: string }> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const tot = ins.total;
  const famName = (k: string) => (k === 'unassigned' ? t('m18.cc.ins.unassigned') : pick(fams.get(k), 'name') || k);
  const num = (v: number | null) => (v == null ? t('m18.cc.ins.suppressed') : f.num(v));
  const shown = ins.by_family.filter((c) => !c.suppressed);
  const cols: Column<InsightCell>[] = [
    { key: 'key', header: t('m18.cc.ins.family'), value: (c) => famName(c.key), sortable: true },
    { key: 'people', header: t('m18.cc.ins.people'), value: (c) => c.people, render: (c) => num(c.people), sortable: true, align: 'end' },
    { key: 'coverage', header: t('m18.cc.ins.coverage'), value: (c) => c.coverage_pct, render: (c) => (c.coverage_pct == null ? t('m18.cc.ins.suppressed') : f.pct(c.coverage_pct / 100, 1)), sortable: true, align: 'end' },
    { key: 'overdue', header: t('m18.cc.ins.overdue'), value: (c) => c.overdue, render: (c) => num(c.overdue), sortable: true, align: 'end' },
    { key: 'disagreed', header: t('m18.cc.ins.disagreed'), value: (c) => c.disagreed, render: (c) => num(c.disagreed), align: 'end' },
  ];
  return (
    <>
      <Callout tone="info" title={t('m18.cc.ins.rule', { n: f.num(ins.min_group) })}>{t('m18.cc.ins.ruleBody')}</Callout>
      <div className="mt-4">
        <Grid cols={4}>
          <StatTile label={t('m18.cc.ins.pairs')} value={num(tot.people)} sub={t('m18.cc.ins.pairsSub')} />
          <StatTile label={t('m18.cc.ins.coverage')} value={tot.coverage_pct == null ? t('m18.cc.ins.suppressed') : f.pct(tot.coverage_pct / 100, 1)} tone="info" sub={t('m18.cc.ins.coverageSub')} />
          <StatTile label={t('m18.cc.ins.overdue')} value={num(tot.overdue)} tone={tot.overdue ? 'bad' : 'ok'} sub={t('m18.cc.ins.overdueSub')} />
          <StatTile label={t('m18.cc.ins.disagreed')} value={num(tot.disagreed)} sub={t('m18.cc.ins.disagreedSub', { n: num(tot.acknowledged) })} />
        </Grid>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m18.cc.ins.aspTitle')} description={t('m18.cc.ins.aspDesc')}>
          <Card><BarChart title={t('m18.cc.ins.aspTitle')} data={ASPIRATIONS.map((a) => ({ label: t(`m18.cc.asp.${a}`), value: tot.aspirations[a], suppressed: tot.aspirations[a] == null }))} /></Card>
        </Section>
        <Section title={t('m18.cc.ins.mobTitle')} description={t('m18.cc.ins.mobDesc')}>
          <Card><BarChart title={t('m18.cc.ins.mobTitle')} data={MOBILITY.map((m) => ({ label: t(`m18.cc.mob.${m}`), value: tot.mobility[m], suppressed: tot.mobility[m] == null }))} /></Card>
        </Section>
      </div>
      <Section title={t('m18.cc.ins.heatTitle')} description={t('m18.cc.ins.heatDesc')}>
        <Card>
          <div data-testid="m18-cc-ins-heat">
            <Heatmap title={t('m18.cc.ins.heatTitle')} rows={ins.by_family.map((c) => c.key)} cols={[...ASPIRATIONS]} rowLabel={famName} colLabel={(a) => t(`m18.cc.asp.${a}`)}
              value={(r, c) => { const cell = ins.by_family.find((x) => x.key === r)!; const v = cell.aspirations[c as keyof InsightCell['aspirations']]; return { v, suppressed: v == null, tone: v == null ? 'neutral' : 'info', label: v == null ? t('m18.cc.ins.suppressedShort') : undefined }; }} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m18.cc.ins.heatNote', { n: f.num(shown.length), m: f.num(ins.by_family.length) })}</p>
        </Card>
      </Section>
      <Section title={t('m18.cc.ins.tableTitle')}>
        <div data-testid="m18-cc-ins-table"><DataTable rows={ins.by_family} columns={cols} rowKey={(c) => c.key} csvName="career-conversations-by-family.csv" searchable={false} caption={t('m18.cc.ins.tableTitle')} /></div>
      </Section>
      <p className="mt-2 text-[12.5px] text-ink-3">{t('m18.cc.ins.asOf', { date: f.date(ins.as_of) })}</p>
    </>
  );
}
