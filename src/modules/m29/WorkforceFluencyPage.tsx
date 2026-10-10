// FS09/FS10 /workforce/ai-fluency (ai_literacy Agg: HR analyst, HR director): the organisation indicator "% of staff above basic"
// from the latest fitness check per person in the last four quarters, beside the EU DigComp figure as a separate benchmark line;
// the quarterly trend, bands, families and areas; and the AI fluency rungs: share at Practitioner or above against the dated
// leadership parameter (a demo parameter, not a claim) and share meeting their family target. Every cell naming fewer than 10
// people is suppressed; security, safeguards and cyber families are never broken out.
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, BenchmarkLine, BarChart, LineChart, DataTable, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import type { FitnessStats } from './fitness';
import type { AiFluencyStats } from './backend/rpc';
import { useM29Ref, useRungName, type M29Ref, type Row } from './ui';

function useStats() {
  const repo = useRepo();
  return useQuery(['fitness_attempts', 'person_skills', 'ai_org_targets'], async () => {
    const [fit, rung, org] = await Promise.all([
      repo.rpc.fitnessStats(), repo.rpc.aiFluencyStats(),
      (repo.list('ai_org_targets' as never) as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { fit, rung, org: org as Row[] };
  }, []);
}

export default function WorkforceFluencyPage() {
  const t = useT();
  const ref = useM29Ref();
  const q = useStats();
  return (
    <Page title={t('m29.routes.workforce-ai-fluency.title')} intro={t('m29.wf.intro')} wide eyebrow={<BenchmarkChips ids={['DIGCOMP', 'OECD-PIAAC', 'SKILLS-TECH', 'AI-LIT', 'UAE-AI', 'LINKEDIN']} />}>
      <Async state={ref}>{(d) => <Async state={q}>{(s) => (s.fit && s.rung ? <Stats d={d} fit={s.fit} rung={s.rung} org={s.org} /> : <EmptyState title={t('m29.wf.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Stats({ d, fit, rung, org }: { d: M29Ref; fit: FitnessStats; rung: AiFluencyStats; org: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const name = useRungName();
  const sup = t('common.suppressed');
  const fam = (id: string) => { const x = d.families.find((y: Row) => y.id === id); return x ? pick(x, 'name') : id; };
  const target = org.find((o) => o.metric === 'practitioner_or_above');
  const famRows = fit.by_family.map((r) => ({ ...r, ...(rung.by_family.find((x) => x.family_id === r.family_id) ?? { pct_practitioner: null, pct_target: null }), rn: rung.by_family.find((x) => x.family_id === r.family_id)?.n ?? null }));
  const cols: Column<Row>[] = [
    { key: 'family', header: t('m29.wf.fam.family'), value: (r) => fam(r.family_id), sortable: true },
    { key: 'n', header: t('m29.wf.fam.n'), value: (r) => r.n, render: (r) => (r.n == null ? <span className="text-ink-3" title={sup}>{t('common.suppressedShort')}</span> : f.num(r.n)), align: 'end', sortable: true },
    { key: 'pct', header: t('m29.wf.fam.pct'), value: (r) => r.pct_above_basic, render: (r) => (r.pct_above_basic == null ? <span className="text-ink-3">{t('common.suppressedShort')}</span> : f.pct(r.pct_above_basic)), align: 'end', sortable: true },
    { key: 'avg', header: t('m29.wf.fam.avg'), value: (r) => r.avg_score, render: (r) => (r.avg_score == null ? <span className="text-ink-3">{t('common.suppressedShort')}</span> : f.num(r.avg_score)), align: 'end' },
    { key: 'prac', header: t('m29.wf.fam.prac'), value: (r) => r.pct_practitioner, render: (r) => (r.pct_practitioner == null ? <span className="text-ink-3">{t('common.suppressedShort')}</span> : f.pct(r.pct_practitioner)), align: 'end' },
    { key: 'tgt', header: t('m29.wf.fam.tgt'), value: (r) => r.pct_target, render: (r) => (r.pct_target == null ? <span className="text-ink-3">{t('common.suppressedShort')}</span> : f.pct(r.pct_target)), align: 'end' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-wf-tiles">
        <StatTile label={t('m29.wf.tile.above')} value={fit.pct_above_basic == null ? t('common.suppressedShort') : f.pct(fit.pct_above_basic)} sub={t('m29.wf.tile.aboveSub', { n: f.num(fit.tested) })} tone="info" />
        <StatTile label={t('m29.wf.tile.coverage')} value={fit.coverage_pct == null ? t('common.suppressedShort') : f.pct(fit.coverage_pct)} sub={t('m29.wf.tile.coverageSub', { n: f.num(fit.tested), staff: f.num(fit.staff) })} />
        <StatTile label={t('m29.wf.tile.avg')} value={fit.avg_score == null ? t('common.suppressedShort') : f.num(fit.avg_score)} sub={t('m29.wf.tile.avgSub')} />
        <StatTile label={t('m29.wf.tile.prac')} value={rung.practitioner.pct == null ? t('common.suppressedShort') : f.pct(rung.practitioner.pct)} sub={target ? t('m29.wf.tile.pracSub', { pct: f.pct(Number(target.pct), 0), date: f.date(String(target.due_on)) }) : undefined} tone={rung.practitioner.pct != null && target && rung.practitioner.pct >= Number(target.pct) ? 'ok' : 'sim'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.wf.above.title')} eyebrow={t('m29.wf.above.eyebrow')}>
          <div data-testid="m29-wf-above">
            <BenchmarkLine value={fit.pct_above_basic} max={100} unit="pct" label={t('m29.wf.above.line')} benchmark={{ id: 'DIGCOMP', figure: 'above_basic_eu_2023' }} />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">{t('m29.wf.above.apart')}</p>
        </Card>
        <Card title={t('m29.wf.prac.title')} eyebrow={t('m29.wf.prac.eyebrow')}>
          <div data-testid="m29-wf-prac">
            <BenchmarkLine value={rung.practitioner.pct} max={100} unit="pct" label={t('m29.wf.prac.line')}
              lines={target ? [{ kind: 'target', label: t('m29.wf.prac.target', { date: f.date(String(target.due_on)) }), value: Number(target.pct) }] : []} />
          </div>
          {target && <p className="mt-2 text-[12.5px] text-ink-3" data-testid="m29-wf-param">{pick(target, 'basis')} <span className="caps ms-1">{pick(target, 'set_by')}</span></p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.wf.trend.title')} eyebrow={t('m29.wf.trend.eyebrow')}>
          <div data-testid="m29-wf-trend">
            <LineChart title={t('m29.wf.trend.title')} yMin={0} yMax={100} unit="%"
              series={[{ name: t('m29.wf.trend.above'), points: fit.trend.map((x) => ({ x: x.quarter, y: x.pct_above_basic })) },
                { name: t('m29.wf.trend.avg'), points: fit.trend.map((x) => ({ x: x.quarter, y: x.avg_score })), dashed: true, tone: 'info' }]} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m29.wf.trend.note')}</p>
        </Card>
        <Card title={t('m29.wf.bands.title')} eyebrow={t('m29.wf.bands.eyebrow')}>
          <BarChart title={t('m29.wf.bands.title')} data={fit.bands.map((b) => ({ label: t(`m29.band.${b.band}`), value: b.n, suppressed: b.n == null, tone: b.band === 'above_basic' || b.band === 'advanced' ? 'ok' : 'info' }))} />
          <h3 className="caps mb-1.5 mt-4">{t('m29.wf.rungs.title')}</h3>
          <div data-testid="m29-wf-rungs">
            <BarChart title={t('m29.wf.rungs.title')} data={rung.distribution.map((x) => ({ label: name(x.rung), value: x.n, suppressed: x.n == null, tone: x.rung >= 2 ? 'ok' : 'info' }))} />
          </div>
        </Card>
      </div>

      <Section title={t('m29.wf.areas.title')} description={t('m29.wf.areas.intro')}>
        <Card>
          <BarChart title={t('m29.wf.areas.title')} max={3} data={fit.by_area.map((a) => { const ar = d.areas.find((x: Row) => x.id === a.area_id); return { label: ar ? pick(ar, 'name') : a.area_id, value: a.avg_level, suppressed: a.avg_level == null, tone: Number(ar?.weight) > 1 ? 'accent' : 'info' }; })} />
        </Card>
      </Section>

      <Section title={t('m29.wf.fam.title')} description={t('m29.wf.fam.intro')}>
        <div data-testid="m29-wf-families">
          <DataTable rows={famRows} columns={cols} rowKey={(r) => r.family_id} csvName="ai-fluency-by-family.csv" caption={t('m29.wf.fam.title')} searchable={false} pageSize={25} />
        </div>
      </Section>

      <Card title={t('m29.wf.def.title')} eyebrow={t('m29.wf.def.eyebrow')}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] md:grid-cols-2" data-testid="m29-wf-definitions">
          {['above', 'window', 'prac', 'target', 'suppress', 'restricted'].map((k) => (
            <div key={k}><dt className="font-semibold">{t(`m29.wf.def.${k}.t`)}</dt><dd className="text-ink-2">{t(`m29.wf.def.${k}.d`, { window: fit.window.join(', ') })}</dd></div>
          ))}
        </dl>
      </Card>
      <Callout tone="info" title={t('m29.wf.noRank.title')}>{t('m29.wf.noRank.body')}</Callout>
    </div>
  );
}
