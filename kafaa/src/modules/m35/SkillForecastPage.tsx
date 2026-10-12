// FS51 /workforce/skill-forecasts/skills/:skillId (workforce_strategy Agg/R/W/A): one skill's three-scenario band, SIMULATED. Fan chart at
// a chosen level (band across baseline, ADVANCE and accelerated; supply of the chosen scenario), the level mix by year for each scenario,
// the reasons for each scenario (<WhyThis>), the generations view for this skill and its critical-register row. Defaults or a saved
// version (?version=<id>). A suppressed (under 10 holders) or not-modelled skill shows why, never a number.
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { Page, Section, Card, Async, EmptyState, Callout, Tabs, WhyThis, BenchmarkChips, SimChip } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { DEFAULTS, GENERATIONS, SCENARIOS, skillReasons, type ForecastResult, type ScenarioKey } from './forecast';
import { FanChart, LevelMixTable, MethodBanner, SimLabels, Year, useM35Ref, useSkillName, type Row } from './ui';

export default function SkillForecastPage() {
  const t = useT();
  const { skillId = '' } = useParams();
  const [sp] = useSearchParams();
  const versionId = sp.get('version');
  const repo = useRepo();
  const ref = useM35Ref();
  const skillName = useSkillName(ref.data);
  const q = useQuery(['person_skills', 'role_profile_versions', 'skill_forecasts', 'critical_skills'] as unknown as Table[], async () => {
    let result: ForecastResult;
    let version: Row | null = null;
    if (versionId) {
      version = (await repo.get('skill_forecasts' as never, versionId)) as unknown as Row | null;
      if (!version) throw new Error(t('m35.fcd.noVersion'));
      result = version.results as ForecastResult;
    } else {
      const r = await repo.rpc.computeSkillForecast(DEFAULTS);
      if (!r.ok || !r.data) throw new Error(r.message);
      result = r.data;
    }
    const reg = ((await (repo.list('critical_skills' as never) as unknown as Promise<Row[]>).catch(() => [])) as Row[]).find((x) => x.skill_id === skillId) ?? null;
    return { result, version, reg };
  }, [skillId, versionId]);
  return (
    <Page title={skillName(skillId)} intro={t('m35.fcd.intro')} wide eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS51" /><SimChip /></div>}
      actions={<L to="/workforce/skill-forecasts" className="btn-ghost btn-sm no-underline">{t('m35.fcd.back')}</L>}>
      <Async state={q}>{(x) => <Body skillId={skillId} r={x.result} version={x.version} reg={x.reg} skillName={skillName} />}</Async>
    </Page>
  );
}

function Body({ skillId, r, version, reg, skillName }: { skillId: string; r: ForecastResult; version: Row | null; reg: Row | null; skillName: (id: string) => string }) {
  const t = useT();
  const f = useFormat();
  const [scenario, setScenario] = useState<ScenarioKey>((version?.scenario as ScenarioKey) ?? 'advance');
  const [level, setLevel] = useState(2);
  const k = r.skills.find((x) => x.skill_id === skillId);
  const header = (
    <>
      <SimLabels method={r.method} />
      <MethodBanner basis={r.basis} cycle={version ? Number(version.cycle) : null} />
      <p className="text-[12.5px] text-ink-2" data-testid="m35-fcd-source">{version ? t('m35.fcd.fromVersion', { name: version.name }) : t('m35.fcd.fromLive')}</p>
      {reg && <p className="text-[12.5px]"><L to={`/workforce/critical-skills/${reg.id}`} data-testid="m35-fcd-register">{t('m35.fcd.onRegister')}</L></p>}
    </>
  );
  if (!k) {
    const why = r.suppressed.includes(skillId) ? 'suppressed' : r.not_modelled.some((x) => x.skill_id === skillId) ? 'not_modelled' : 'out_of_scope';
    return <div className="space-y-4">{header}<EmptyState title={t(`m35.fcd.${why}.title`)}><span data-testid="m35-fcd-why" data-why={why}>{t(`m35.fcd.${why}.body`, { n: f.num(r.min_group) })}</span></EmptyState></div>;
  }
  return (
    <div className="space-y-5" data-testid="m35-fcd" data-skill={skillId}>
      {header}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m35-fcd-scenarios">
        {SCENARIOS.map((sc) => {
          const x = k.sc[sc];
          return (
            <Card key={sc} title={t(`m35.scenario.${sc}`)} actions={<WhyThis reasons={skillReasons(k, sc, r.params)} testId={`m35-fcd-why-${sc}`} />}>
              <div className="space-y-1 text-[13px]">
                <p>{t('m35.fcd.gapMid')}: <span className={`num font-semibold ${x.gap_mid > 0 ? 'text-bad' : 'text-ok'}`}>{x.gap_mid > 0 ? '+' : ''}{f.num(x.gap_mid)}</span></p>
                <p>{t('m35.fcd.gapFar')}: <span className={`num font-semibold ${x.gap_far > 0 ? 'text-bad' : 'text-ok'}`}>{x.gap_far > 0 ? '+' : ''}{f.num(x.gap_far)}</span></p>
                <p className="text-ink-2">{t('m35.fcd.first')}: <Year y={x.first_gap_year} /></p>
                <p className="text-ink-3">{t('m35.fcd.bind', { level: t(`m35.level.${x.bind_level}`), gap: f.num(x.bind_gap) })}</p>
              </div>
            </Card>
          );
        })}
      </div>
      <Section title={t('m35.fcd.band')} description={t('m35.fcd.bandIntro')}
        actions={<div className="flex flex-wrap gap-1" role="group" aria-label={t('m35.fc.level')}>{[1, 2, 3, 4].map((L2) => (
          <button key={L2} type="button" className={`btn-sm ${level === L2 ? 'btn-primary' : 'btn-outline'}`} aria-pressed={level === L2} onClick={() => setLevel(L2)} data-testid={`m35-fcd-level-${L2}`}>{t(`m35.levelShort.${L2}`)}</button>
        ))}</div>}>
        <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label={t('m35.fcd.supplyFor')}>
          {SCENARIOS.map((sc) => <button key={sc} type="button" className={`btn-sm ${scenario === sc ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={scenario === sc} onClick={() => setScenario(sc)}>{t('m35.fc.supplyOf', { s: t(`m35.scenario.${sc}`) })}</button>)}
        </div>
        <FanChart k={k} level={level} scenario={scenario} height={260} title={t('m35.fc.fanTitle', { skill: skillName(skillId) })} />
      </Section>
      <Section title={t('m35.fc.mixTitle')} description={t('m35.fcd.mixIntro')}>
        <Tabs value={scenario} onChange={(v) => setScenario(v as ScenarioKey)} tabs={SCENARIOS.map((sc) => ({ id: sc, label: t(`m35.scenario.${sc}`), content: <LevelMixTable k={k} scenario={sc} years={[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]} /> }))} />
      </Section>
      <Section title={t('m35.fcd.generations')} description={t('m35.fcd.generationsIntro', { last: String(r.generations.last_year) })}>
        <table className="w-full text-[13px]" data-testid="m35-fcd-generations">
          <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.gen.scenario')}</th>{GENERATIONS.map(([lo, hi]) => <th key={lo} scope="col" className="py-1 text-end"><Year y={lo} />–<Year y={hi} /></th>)}</tr></thead>
          <tbody>{SCENARIOS.map((sc) => <tr key={sc} className="border-t border-line"><th scope="row" className="py-1.5 text-start font-medium">{t(`m35.scenario.${sc}`)}</th>{k.sc[sc].gen.map((g, i) => <td key={i} className="num py-1.5 text-end">{f.num(g)}</td>)}</tr>)}</tbody>
        </table>
        <p className="mt-1 text-[11.5px] text-ink-3">{t('m35.gen.note')}</p>
      </Section>
      <Callout tone="sim" title={t('m35.fcd.readTitle')}><span className="inline-flex flex-wrap items-center gap-2"><SimChip />{t('m35.fcd.readBody', { n: f.num(k.basis_n) })}</span></Callout>
    </div>
  );
}
