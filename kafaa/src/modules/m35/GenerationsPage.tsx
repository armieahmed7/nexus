// FS51 /workforce/skill-forecasts/generations (workforce_strategy Agg/R/W/A): the long-horizon "generations" view of the plant's operating
// life, SIMULATED. Each FANR operating licence runs for 60 years (sourced), so the view runs to the end of Unit 4's licence: the share of
// today's working-level holders still in post at the start of each window (attrition only) and the people-equivalents each window must
// develop to hold the 2035 demand of a scenario (skill change after 2035 is not modelled). Computed with the defaults on the server.
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { Page, Section, Async, Callout, BarChart, DataTable, SourceLink, BenchmarkChips, SimChip, StatTile, type Column } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { DEFAULTS, GENERATIONS, PLANT_LIFE, SCENARIOS, type ForecastResult, type ScenarioKey, type SkillForecast } from './forecast';
import { MethodBanner, SimLabels, Year, useM35Ref, useSkillName } from './ui';

export default function GenerationsPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useM35Ref();
  const skillName = useSkillName(ref.data);
  const q = useQuery(['person_skills', 'role_profile_versions'] as unknown as Table[], async () => {
    const r = await repo.rpc.computeSkillForecast(DEFAULTS);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  return (
    <Page title={t('m35.routes.workforce-skill-generations.title')} intro={t('m35.gen.intro')} wide eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS51" /><SimChip /></div>}
      actions={<L to="/workforce/skill-forecasts" className="btn-ghost btn-sm no-underline">{t('m35.fcd.back')}</L>}>
      <Async state={q}>{(r) => <Gen r={r} skillName={skillName} />}</Async>
    </Page>
  );
}

function Gen({ r, skillName }: { r: ForecastResult; skillName: (id: string) => string }) {
  const t = useT();
  const f = useFormat();
  const [sc, setSc] = useState<ScenarioKey>('advance');
  const g = r.generations;
  const cols: Column<SkillForecast>[] = [
    { key: 'skill', header: t('m35.fc.col.skill'), value: (k) => skillName(k.skill_id), sortable: true, render: (k) => <L to={`/workforce/skill-forecasts/skills/${k.skill_id}`} className="font-semibold">{skillName(k.skill_id)}</L> },
    { key: 'd35', header: t('m35.gen.hold'), align: 'end', value: (k) => k.sc[sc].d[9][1], render: (k) => <span className="num">{f.num(k.sc[sc].d[9][1])}</span>, sortable: true },
    ...GENERATIONS.map(([lo, hi], i): Column<SkillForecast> => ({ key: `g${i}`, header: `${f.num(lo, { useGrouping: false })}–${f.num(hi, { useGrouping: false })}`, align: 'end', sortable: true, value: (k) => k.sc[sc].gen[i], render: (k) => <span className="num">{f.num(k.sc[sc].gen[i])}</span> })),
  ];
  return (
    <div className="space-y-6" data-testid="m35-gen">
      <SimLabels method={r.method} />
      <MethodBanner basis={r.basis} />
      <Callout tone="info" title={t('m35.gen.who')}>
        <span data-testid="m35-gen-life">{t('m35.gen.life', { last: String(g.last_year) })}</span>{' '}
        <SourceLink href={PLANT_LIFE.source.url} date={PLANT_LIFE.source.as_of}>{PLANT_LIFE.source.label}</SourceLink>
      </Callout>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m35-gen-remain">
        {GENERATIONS.map(([lo], i) => <StatTile key={lo} label={t('m35.gen.remainAt', { year: String(lo) })} value={`${f.num(g.remain_pct[i])}%`} sub={t('m35.gen.remainSub', { a: f.num(r.params.attrition_pct) })} sim />)}
      </div>
      <Section title={t('m35.gen.develop')} description={t('m35.gen.developIntro')}
        actions={<div className="flex flex-wrap gap-1" role="group" aria-label={t('m35.gen.scenario')}>{SCENARIOS.map((x) => (
          <button key={x} type="button" className={`btn-sm ${sc === x ? 'btn-primary' : 'btn-outline'}`} aria-pressed={sc === x} onClick={() => setSc(x)} data-testid={`m35-gen-sc-${x}`}>{t(`m35.scenario.${x}`)}</button>
        ))}</div>}>
        <div data-testid="m35-gen-totals">
          <BarChart title={t('m35.gen.develop')} data={GENERATIONS.map(([lo, hi], i) => ({ label: `${f.num(lo, { useGrouping: false })}–${f.num(hi, { useGrouping: false })}`, value: r.totals[sc].gen[i], tone: 'sim' }))} />
        </div>
        <div className="mt-4 overflow-x-auto" data-testid="m35-gen-skills"><DataTable rows={r.skills} columns={cols} rowKey={(k) => k.skill_id} searchable={false} pageSize={20} caption={t('m35.gen.develop')} csvName="generations-SIMULATED" dense /></div>
        <p className="mt-1 text-[11.5px] text-ink-3">{t('m35.gen.note')} <Year y={2035} /></p>
      </Section>
    </div>
  );
}
