// FS51 /workforce/skill-forecasts/method (workforce_strategy Agg/R/W/A): definitions (the link every SIMULATED number carries), the method
// fs51-v1 step by step, the assumptions with their defaults and ranges, the scenario levers, the "not yet modelled" list and the sources
// (benchmark registry rows and the plant licence fact). Static: no person data.
import { Page, Section, Callout, SourceLink, BenchmarkChips, SimChip, KeyValue } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { DEFAULTS, LEVER_LIMITS, METHOD, PLANT_LIFE, SCENARIOS, SHARED_LIMITS, type LeverParam, type SharedParam } from './forecast';
import { useParamFormat } from './ui';
import { MethodologyBanner } from '../m16/MethodologyBanner'; // FS54 -> FS51 (FS wave F integration)

const TERMS = ['simulated', 'pe', 'working', 'demand', 'supply', 'band', 'gap', 'mix', 'suppressed', 'pace', 'advance', 'development', 'generations', 'register'];
const STEPS = ['scope', 'demand', 'phase', 'uplift', 'supply', 'develop', 'suppress', 'generations', 'versions'];

export default function ForecastMethodPage() {
  const t = useT();
  const f = useFormat();
  const fmt = useParamFormat();
  return (
    <Page title={t('m35.routes.workforce-skill-forecast-method.title')} intro={t('m35.met.intro')} wide eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS51" /><SimChip /></div>}
      actions={<L to="/workforce/skill-forecasts" className="btn-ghost btn-sm no-underline">{t('m35.fcd.back')}</L>}>
      <div className="space-y-6" data-testid="m35-method">
        <MethodologyBanner dashboard="skill_forecasts" />
        <Section id="definitions" title={t('m35.met.definitions')}>
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m35-met-terms">
            {TERMS.map((k) => (
              <div key={k} id={`def-${k}`} className="rounded-card border border-line p-3">
                <dt className="font-semibold">{t(`m35.def.${k}.term`)}</dt>
                <dd className="mt-1 text-[13px] text-ink-2">{t(`m35.def.${k}.body`, { n: f.num(10) })}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section id="method" title={t('m35.met.method', { method: METHOD })}>
          <ol className="list-decimal space-y-2 ps-5 text-[13.5px]" data-testid="m35-met-steps">
            {STEPS.map((k) => <li key={k}>{t(`m35.met.step.${k}`)}</li>)}
          </ol>
          <Callout tone="sim" title={t('m35.banner.title')}>{t('m35.met.banner')}</Callout>
        </Section>
        <Section id="assumptions" title={t('m35.met.assumptions')} description={t('m35.met.assumptionsIntro')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <table className="w-full text-[13px]" data-testid="m35-met-shared">
              <caption className="sr-only">{t('m35.met.assumptions')}</caption>
              <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.met.param')}</th><th scope="col" className="py-1 text-end">{t('m35.met.default')}</th><th scope="col" className="py-1 text-end">{t('m35.met.range')}</th></tr></thead>
              <tbody>{(Object.keys(SHARED_LIMITS) as SharedParam[]).map((k) => (
                <tr key={k} className="border-t border-line"><th scope="row" className="py-1.5 text-start font-medium">{t(`m35.param.${k}`)}<span className="block text-[11.5px] font-normal text-ink-3">{t(`m35.hint.${k}`)}</span></th>
                  <td className="py-1.5 text-end">{fmt(k, DEFAULTS[k])}</td><td className="py-1.5 text-end">{fmt(k, SHARED_LIMITS[k][0])} – {fmt(k, SHARED_LIMITS[k][1])}</td></tr>
              ))}</tbody>
            </table>
            <table className="w-full text-[13px]" data-testid="m35-met-levers">
              <caption className="sr-only">{t('m35.fc.levers')}</caption>
              <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.met.scenario')}</th>{(['pace', 'advance', 'adv_start'] as LeverParam[]).map((k) => <th key={k} scope="col" className="py-1 text-end">{t(`m35.param.${k}`)}</th>)}</tr></thead>
              <tbody>{SCENARIOS.map((s) => (
                <tr key={s} className="border-t border-line"><th scope="row" className="py-1.5 text-start font-medium">{t(`m35.scenario.${s}`)}<span className="block text-[11.5px] font-normal text-ink-3">{t(`m35.scenarioHint.${s}`)}</span></th>
                  {(['pace', 'advance', 'adv_start'] as LeverParam[]).map((k) => <td key={k} className="py-1.5 text-end">{fmt(k, DEFAULTS.levers[s][k])}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m35.met.leverRanges', { pace: `${fmt('pace', LEVER_LIMITS.pace[0])} – ${fmt('pace', LEVER_LIMITS.pace[1])}`, adv: `${fmt('advance', LEVER_LIMITS.advance[0])} – ${fmt('advance', LEVER_LIMITS.advance[1])}`, start: `${LEVER_LIMITS.adv_start[0]} – ${LEVER_LIMITS.adv_start[1]}` })}</p>
        </Section>
        <Section id="not-modelled" title={t('m35.nm.title')} description={t('m35.nm.intro')}>
          <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2" data-testid="m35-met-nm">
            {['smr_headcount', 'automation', 'contractors', 'market', 'after_2035', 'decay', 'specialised'].map((i) => <li key={i}>{t(`m35.nm.${i}`)}</li>)}
          </ul>
        </Section>
        <Section id="sources" title={t('m35.met.sources')} description={t('m35.met.sourcesIntro')}>
          <div className="space-y-3">
            <KeyValue items={[
              [t('m35.met.fs50'), <BenchmarkChips key="a" feature="FS50" />],
              [t('m35.met.fs51'), <BenchmarkChips key="b" feature="FS51" />],
              [t('m35.met.licence'), <span key="c" data-testid="m35-met-licence">{t('m35.met.licenceFact', { last: String(PLANT_LIFE.last_year) })} <SourceLink href={PLANT_LIFE.source.url} date={PLANT_LIFE.source.as_of}>{PLANT_LIFE.source.label}</SourceLink></span>],
            ]} />
            <p className="text-[12px] text-ink-3">{t('m35.met.notAuthority')}</p>
          </div>
        </Section>
      </div>
    </Page>
  );
}
