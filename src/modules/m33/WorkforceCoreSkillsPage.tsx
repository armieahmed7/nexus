// FS25/FS26 /workforce/core-skills (skills_profile Agg: HR analyst, HR director): the core skills across ENEC. Evidence against family
// targets per core skill, cluster and family (rpc.coreSkillsStats; SQL kafaa_cs_stats_core = coreStats), and situational judgement
// practice participation and average by quarter and core skill (rpc.sjtStats; SQL kafaa_sjt_stats_core = sjtStats). Aggregates only:
// any cell naming fewer than 10 people is suppressed, no person is ever listed, and security, safeguards and cyber are never broken out.
// Practice results are for development and never feed talent review.
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, BarChart, LineChart, DataTable, Tabs, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { CoreStats, CoreStatRow } from './coreSkills';
import type { SjtStats } from './sjt';
import { FS25_FS26, useCoreName, useFamilyName, useM33Ref, type M33Ref, type Row } from './ui';

export default function WorkforceCoreSkillsPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useM33Ref();
  const q = useQuery(['person_skills', 'sjt_attempts'], async () => {
    const [core, sjt] = await Promise.all([repo.rpc.coreSkillsStats(), repo.rpc.sjtStats()]);
    return { core, sjt };
  }, []);
  return (
    <Page title={t('m33.routes.workforce-core-skills.title')} intro={t('m33.wf.intro')} wide eyebrow={<BenchmarkChips ids={FS25_FS26} />}>
      <Async state={ref}>{(d) => <Async state={q}>{(s) => (s.core && s.sjt ? <Stats d={d} core={s.core} sjt={s.sjt} /> : <EmptyState title={t('m33.wf.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Stats({ d, core, sjt }: { d: M33Ref; core: CoreStats; sjt: SjtStats }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const coreName = useCoreName(d);
  const famName = useFamilyName(d);
  const sup = t('common.suppressedShort');
  const n = (v: number | null | undefined) => (v == null ? <span className="text-ink-3" title={t('common.suppressed')}>{sup}</span> : <span className="num">{f.num(v)}</span>);
  const p = (v: number | null | undefined) => (v == null ? <span className="text-ink-3" title={t('common.suppressed')}>{sup}</span> : <span className="num">{f.pct(v)}</span>);
  const skillCols: Column<CoreStatRow>[] = [
    { key: 'skill', header: t('m33.wf.col.skill'), value: (r) => coreName(r.core_skill_id), render: (r) => {
      const c = d.core.find((x: Row) => x.id === r.core_skill_id);
      return <L to={`/learn/core-skills/${r.core_skill_id}`}><span className="num me-1.5 text-[11.5px] text-ink-3">{c?.code}</span>{coreName(r.core_skill_id)}</L>;
    } },
    { key: 'met', header: t('m33.wf.col.met'), align: 'end', value: (r) => r.met ?? -1, render: (r) => n(r.met), sortable: true },
    { key: 'below', header: t('m33.wf.col.below'), align: 'end', value: (r) => r.below ?? -1, render: (r) => n(r.below), sortable: true },
    { key: 'none', header: t('m33.wf.col.none'), align: 'end', value: (r) => r.no_evidence ?? -1, render: (r) => n(r.no_evidence), sortable: true },
    { key: 'pct', header: t('m33.wf.col.pct'), align: 'end', value: (r) => r.pct_met ?? -1, render: (r) => p(r.pct_met), sortable: true },
  ];
  const famCols: Column<Row>[] = [
    { key: 'family', header: t('m33.wf.col.family'), value: (r) => famName(r.family_id), sortable: true },
    { key: 'n', header: t('m33.wf.col.people'), align: 'end', value: (r) => r.n ?? -1, render: (r) => n(r.n) },
    { key: 'pct', header: t('m33.wf.col.pairs'), align: 'end', value: (r) => r.pct_met ?? -1, render: (r) => p(r.pct_met), sortable: true },
  ];
  const sjtCols: Column<Row>[] = [
    { key: 'skill', header: t('m33.wf.col.skill'), value: (r) => coreName(r.core_skill_id) },
    { key: 'people', header: t('m33.wf.col.practising'), align: 'end', value: (r) => r.people ?? -1, render: (r) => n(r.people), sortable: true },
    { key: 'pct', header: t('m33.wf.col.avg'), align: 'end', value: (r) => r.pct ?? -1, render: (r) => p(r.pct), sortable: true },
  ];
  const gaps = core.by_skill.filter((r) => r.no_evidence != null).sort((a, b) => (b.no_evidence ?? 0) - (a.no_evidence ?? 0)).slice(0, 3);

  const evidence = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m33-wf-tiles">
        <StatTile label={t('m33.wf.tile.staff')} value={f.num(core.staff)} sub={t('m33.wf.tile.staffSub')} />
        <StatTile label={t('m33.wf.tile.met')} value={core.pct_met == null ? sup : f.pct(core.pct_met)} sub={t('m33.wf.tile.metSub')} tone="ok" />
        <StatTile label={t('m33.wf.tile.evidenced')} value={core.pct_evidenced == null ? sup : f.pct(core.pct_evidenced)} sub={t('m33.wf.tile.evidencedSub')} />
        <StatTile label={t('m33.wf.tile.practice')} value={sjt.participants == null ? sup : f.num(sjt.participants)} sub={t('m33.wf.tile.practiceSub')} tone="info" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={t('m33.wf.bySkill')} eyebrow={t('m33.wf.bySkillEyebrow')}>
          <div data-testid="m33-wf-skills">
            <DataTable rows={core.by_skill} columns={skillCols} rowKey={(r) => r.core_skill_id} searchable={false} pageSize={16} caption={t('m33.wf.bySkill')} dense csvName="core-skills-evidence.csv" />
          </div>
        </Card>
        <div className="space-y-4">
          <Card title={t('m33.wf.byCluster')}>
            <div data-testid="m33-wf-clusters">
              <BarChart title={t('m33.wf.byCluster')} max={100} unit="%" data={core.by_cluster.map((c) => ({ label: t(`m33.cluster.${c.cluster}`), value: c.pct_met ?? 0, tone: 'ok' }))} />
            </div>
          </Card>
          <Card title={t('m33.wf.gaps')} eyebrow={t('m33.wf.gapsEyebrow')}>
            <ul className="space-y-2 text-[13px]" data-testid="m33-wf-gaps">
              {gaps.map((g) => {
                const c = d.core.find((x: Row) => x.id === g.core_skill_id);
                const dev = (c?.development as Row[] | undefined)?.find((r) => r.kind !== 'practice');
                return (
                  <li key={g.core_skill_id}>
                    <span className="font-semibold">{coreName(g.core_skill_id)}</span> <span className="text-ink-3">· {t('m33.wf.gapN', { n: f.num(g.no_evidence ?? 0) })}</span>
                    {dev && <span className="block text-[12px] text-ink-2">{t('m33.wf.gapRoute', { route: pick(dev, 'title') })}</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
      <Card title={t('m33.wf.byFamily')} eyebrow={t('m33.wf.byFamilyEyebrow')}>
        <div data-testid="m33-wf-families">
          <DataTable rows={core.by_family} columns={famCols} rowKey={(r) => r.family_id} searchable={false} pageSize={20} caption={t('m33.wf.byFamily')} dense />
        </div>
      </Card>
    </div>
  );

  const practice = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="m33-wf-sjt-tiles">
        <StatTile label={t('m33.wf.sjt.people')} value={sjt.participants == null ? sup : f.num(sjt.participants)} sub={t('m33.wf.sjt.peopleSub')} />
        <StatTile label={t('m33.wf.sjt.sets')} value={sjt.attempts == null ? sup : f.num(sjt.attempts)} sub={t('m33.wf.sjt.setsSub')} />
        <StatTile label={t('m33.wf.sjt.avg')} value={sjt.avg == null ? sup : `${f.num(sjt.avg)}%`} sub={t('m33.wf.sjt.avgSub')} tone="ok" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m33.wf.sjt.trend')} eyebrow={t('m33.wf.sjt.trendEyebrow')}>
          <div data-testid="m33-wf-sjt-trend">
            <LineChart title={t('m33.wf.sjt.trend')} yMin={0} yMax={100} unit="%" series={[{ name: t('m33.wf.sjt.avg'), points: sjt.by_quarter.map((q) => ({ x: q.period, y: q.avg })) }]} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m33.wf.sjt.quarters', { list: sjt.by_quarter.map((q) => `${q.period}: ${q.people == null ? sup : f.num(q.people)}`).join(' · ') })}</p>
        </Card>
        <Card title={t('m33.wf.sjt.bySkill')}>
          <div data-testid="m33-wf-sjt-skills">
            <DataTable rows={sjt.by_skill} columns={sjtCols} rowKey={(r) => r.core_skill_id} searchable={false} pageSize={16} caption={t('m33.wf.sjt.bySkill')} dense />
          </div>
        </Card>
      </div>
      <Callout tone="ok" title={t('m33.wf.sjt.devTitle')}>{t('m33.wf.sjt.devBody')}</Callout>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs tabs={[{ id: 'evidence', label: t('m33.wf.tab.evidence'), content: evidence }, { id: 'practice', label: t('m33.wf.tab.practice'), content: practice }]} />
      <Section title={t('m33.wf.def.title')}>
        <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2" data-testid="m33-wf-definitions">
          <li>{t('m33.wf.def.d1')}</li><li>{t('m33.wf.def.d2')}</li><li>{t('m33.wf.def.d3')}</li><li>{t('m33.wf.def.d4')}</li>
        </ul>
      </Section>
    </div>
  );
}
