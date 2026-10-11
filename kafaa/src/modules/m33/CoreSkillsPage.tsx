// FS25 /learn/core-skills (public): the Nuclear Critical Core Skills framework. 16 skills in the three SkillsFuture clusters, each written
// for a nuclear plant with its benchmark mappings (kafaa_benchmarks chips), INPO trait and linked catalogue skills; the mapping matrix;
// the inclusion rule run live on the definitions (McKinsey DELTA: a core skill exists only with its own development and assessment
// approach) and the candidates it did not add, with wellbeing treated as an outcome, never a competency (SkillsFuture 2025 review).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, StatTile, BenchmarkChips, DataTable, Icon, SourceLink, StatusPill, type Column } from '../../ui';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { MAPPING_FRAMEWORKS, inclusionProblems } from './coreSkills';
import { CLUSTER_ICON, CLUSTER_LIST, MappingList, useCoreName, useM33Ref, type M33Ref, type Row } from './ui';

export default function CoreSkillsPage() {
  const t = useT();
  const ref = useM33Ref();
  return (
    <Page title={t('m33.routes.learn-core-skills.title')} intro={t('m33.fw.intro')} wide eyebrow={<BenchmarkChips feature="FS25" />}>
      <Async state={ref}>{(d) => <Framework d={d} />}</Async>
    </Page>
  );
}

function Framework({ d }: { d: M33Ref }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const coreName = useCoreName(d);
  const [cluster, setCluster] = useState<string>('all');
  const problems = useMemo(() => inclusionProblems(d.core), [d.core]);
  const mappings = d.core.reduce((n: number, c: Row) => n + (c.benchmark_ids?.length ?? 0), 0);
  const trait = (id: string) => { const x = d.traits.find((r: Row) => r.id === id); return x ? pick(x, 'name') : id; };
  const shown = d.core.filter((c: Row) => cluster === 'all' || c.cluster === cluster);
  const fwCols = MAPPING_FRAMEWORKS.filter((fw) => d.core.some((c: Row) => c.mappings.some((m: Row) => m.framework === fw)));
  const matrixCols: Column<Row>[] = [
    { key: 'code', header: t('m33.matrix.skill'), value: (c) => c.code, render: (c) => <L to={`/learn/core-skills/${c.id}`}><span className="num me-1.5 text-[11.5px] text-ink-3">{c.code}</span>{pick(c, 'name')}</L>, sortable: true },
    ...fwCols.map((fw) => ({
      key: fw, header: t(`m33.fwk.${fw}`), align: 'center' as const, value: (c: Row) => (c.mappings.some((m: Row) => m.framework === fw) ? 1 : 0),
      render: (c: Row) => (c.mappings.some((m: Row) => m.framework === fw)
        ? <span title={c.mappings.filter((m: Row) => m.framework === fw).map((m: Row) => pick(m, 'label')).join('; ')}><Icon name="check" size={14} className="text-ok" /><span className="sr-only">{t('m33.matrix.mapped')}</span></span>
        : <span className="text-ink-3" aria-label={t('m33.matrix.notMapped')}>·</span>),
    })),
    { key: 'n', header: t('m33.matrix.benchmarks'), align: 'end', value: (c) => c.benchmark_ids.length, render: (c) => <span className="num">{f.num(c.benchmark_ids.length)}</span>, sortable: true },
  ];
  const candCols: Column<Row>[] = [
    { key: 'name', header: t('m33.cand.col.name'), value: (c) => pick(c, 'name'), render: (c) => <span className="font-semibold">{pick(c, 'name')}</span> },
    { key: 'decision', header: t('m33.cand.col.decision'), value: (c) => c.decision, render: (c) => <StatusPill tone={c.decision === 'outcome' ? 'info' : c.decision === 'merged' ? 'accent' : 'neutral'}>{t(`m33.cand.decision.${c.decision}`)}</StatusPill> },
    { key: 'into', header: t('m33.cand.col.into'), value: (c) => coreName(c.merged_into), render: (c) => (c.merged_into ? <L to={`/learn/core-skills/${c.merged_into}`}>{coreName(c.merged_into)}</L> : <span className="text-ink-3">—</span>) },
    { key: 'rule', header: t('m33.cand.col.rule'), value: (c) => `${c.has_development}${c.has_assessment}`, render: (c) => (
      <span className="flex flex-wrap gap-1 text-[11.5px]">
        <StatusPill tone={c.has_development ? 'ok' : 'neutral'}>{t(c.has_development ? 'm33.cand.devYes' : 'm33.cand.devNo')}</StatusPill>
        <StatusPill tone={c.has_assessment ? 'ok' : 'neutral'}>{t(c.has_assessment ? 'm33.cand.assessYes' : 'm33.cand.assessNo')}</StatusPill>
      </span>) },
    { key: 'reason', header: t('m33.cand.col.reason'), value: (c) => pick(c, 'reason'), render: (c) => <span className="text-[12.5px] text-ink-2">{pick(c, 'reason')}</span> },
    { key: 'src', header: t('m33.cand.col.source'), value: (c) => c.sources?.[0]?.url ?? '', render: (c) => <span className="flex flex-col gap-0.5">{(c.sources as Row[]).map((x) => <SourceLink key={x.url} href={x.url} date={f.date(x.as_of)}>{x.label.split(' · ')[0]}</SourceLink>)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m33-fw-tiles">
        <StatTile label={t('m33.fw.tile.skills')} value={f.num(d.core.length)} sub={t('m33.fw.tile.skillsSub')} />
        <StatTile label={t('m33.fw.tile.clusters')} value={f.num(CLUSTER_LIST.length)} sub={t('m33.fw.tile.clustersSub')} />
        <StatTile label={t('m33.fw.tile.mappings')} value={f.num(mappings)} sub={t('m33.fw.tile.mappingsSub')} tone="ok" />
        <StatTile label={t('m33.fw.tile.notAdded')} value={f.num(d.candidates.length)} sub={t('m33.fw.tile.notAddedSub')} tone="info" />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('m33.fw.filter')} data-testid="m33-fw-clusters">
        {['all', ...CLUSTER_LIST].map((cl) => (
          <button key={cl} type="button" className={`chip normal-case tracking-normal ${cluster === cl ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`}
            aria-pressed={cluster === cl} onClick={() => setCluster(cl)} data-testid={`m33-fw-cluster-${cl}`}>
            {cl === 'all' ? t('m33.fw.all') : t(`m33.cluster.${cl}`)}
            <span className="num text-ink-3">{f.num(cl === 'all' ? d.core.length : d.core.filter((c: Row) => c.cluster === cl).length)}</span>
          </button>
        ))}
      </div>

      {CLUSTER_LIST.filter((cl) => cluster === 'all' || cl === cluster).map((cl) => (
        <Section key={cl} title={<span className="inline-flex items-center gap-2"><Icon name={CLUSTER_ICON[cl]} size={16} className="text-accent" />{t(`m33.cluster.${cl}`)}</span>} description={t(`m33.clusterSub.${cl}`)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.filter((c: Row) => c.cluster === cl).map((c: Row) => (
              <Card key={c.id} eyebrow={<span className="num">{c.code}</span>} title={<L to={`/learn/core-skills/${c.id}`} className="text-inherit" data-testid="m33-fw-skill-link">{pick(c, 'name')}</L>}>
                <div className="space-y-3" data-testid="m33-fw-skill" data-id={c.id}>
                  <p className="text-[13.5px] text-ink-2">{pick(c, 'summary')}</p>
                  <p className="rounded-card border border-line bg-sunken p-2.5 text-[12.5px] text-ink-2"><span className="caps me-1 text-[10.5px]">{t('m33.fw.atPlant')}</span>{pick(c, 'plant')}</p>
                  <MappingList c={c} compact />
                  {c.trait_ids.length > 0 && <p className="text-[12px] text-ink-3"><Icon name="shield" size={12} className="me-1 inline text-accent" />{t('m33.fw.trait', { trait: c.trait_ids.map(trait).join(', ') })}</p>}
                  {c.outcome_en && <p className="text-[12px] text-info">{pick(c, 'outcome')}</p>}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ))}

      <Section title={t('m33.matrix.title')} description={t('m33.matrix.intro')}>
        <div data-testid="m33-fw-matrix" className="overflow-x-auto">
          <DataTable rows={d.core} columns={matrixCols} rowKey={(c) => c.id} searchable={false} pageSize={20} caption={t('m33.matrix.title')} dense />
        </div>
      </Section>

      <Section title={t('m33.rule.title')} description={t('m33.rule.intro')}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card title={t('m33.rule.check')} eyebrow={t('m33.rule.checkEyebrow')}>
            <div data-testid="m33-rule-result" data-problems={problems.length}>
              {problems.length === 0
                ? <p className="flex items-center gap-2 text-[14px] text-ok"><Icon name="check" size={16} />{t('m33.rule.pass', { n: f.num(d.core.length) })}</p>
                : <ul className="text-[13px] text-bad">{problems.map((p) => <li key={`${p.id}-${p.code}`}>{coreName(p.id)}: {t(`m33.rule.problem.${p.code}`)}</li>)}</ul>}
              <ul className="mt-3 list-disc space-y-1 ps-5 text-[12.5px] text-ink-2">
                <li>{t('m33.rule.r1')}</li><li>{t('m33.rule.r2')}</li><li>{t('m33.rule.r3')}</li><li>{t('m33.rule.r4')}</li>
              </ul>
            </div>
          </Card>
          <Card title={t('m33.cand.title')} eyebrow={t('m33.cand.eyebrow', { n: f.num(d.candidates.length) })}>
            <div data-testid="m33-fw-candidates">
              <DataTable rows={d.candidates} columns={candCols} rowKey={(c) => c.id} searchable={false} pageSize={10} caption={t('m33.cand.title')} dense />
            </div>
          </Card>
        </div>
        <Callout tone="info" title={t('m33.wellbeing.title')}>{t('m33.wellbeing.body')}</Callout>
      </Section>

      <Card title={s.identity.personId ? t('m33.fw.cta.mine') : t('m33.fw.cta.signIn')}>
        <div className="flex flex-wrap items-center gap-3" data-testid="m33-fw-cta">
          <p className="text-[13.5px] text-ink-2">{t('m33.fw.cta.body')}</p>
          {s.identity.personId
            ? <><L to="/my/core-skills" className="btn-primary no-underline">{t('m33.fw.cta.mineBtn')}</L><L to="/my/core-skills/practice" className="btn-outline no-underline">{t('m33.fw.cta.practiceBtn')}</L></>
            : <L to="/sign-in" className="btn-primary no-underline" data-testid="m33-fw-signin">{t('m33.fw.cta.signInBtn')}</L>}
        </div>
      </Card>
    </div>
  );
}
