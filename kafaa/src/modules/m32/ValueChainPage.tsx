// FS42 /learn/energy-transition/:chainId (staff): one value-chain explainer (hydrogen, process heat or grid). Its stages and the role a
// nuclear plant could play at each, sourced facts (each with its source, as-of date and whether the source is secondary), the skills and
// CleanEnergyComp competences it builds, the matching horizon lanes, and the FS42 awareness-to-practitioner pathway with its envelope,
// weekly hours, steps and my progress (M19 pathwayDetail). Concept learning: no ENEC project or site claim.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, Icon, SourceLink, StatusPill } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { StageFlow } from './EnergyTransitionPage';
import { PathwayPanel, SkillChips, SourceList, useEtRef, type EtRef, type Row } from './ui';

export default function ValueChainPage() {
  const t = useT();
  const { chainId = '' } = useParams();
  const ref = useEtRef();
  return (
    <Page title={t('m32.routes.learn-energy-chain.title')} intro={t('m32.chain.intro')} wide eyebrow={<BenchmarkChips feature="FS42" />}
      actions={<L to="/learn/energy-transition" className="btn-outline btn-sm no-underline"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m32.chain.back')}</L>}>
      <Async state={ref}>{(d) => {
        const c = d.value_chains.find((x: Row) => x.id === chainId);
        return c ? <Chain c={c} d={d} /> : <EmptyState title={t('m32.chain.notFound')} />;
      }}</Async>
    </Page>
  );
}

function Chain({ c, d }: { c: Row; d: EtRef }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const track = d.transition_tracks.find((x: Row) => x.feature === 'FS42' && x.chain_ids.includes(c.id));
  const others = d.value_chains.filter((x: Row) => x.id !== c.id);
  return (
    <div className="space-y-6" data-testid="m32-chain" data-id={c.id}>
      <Card eyebrow={<span className="num">{c.code}</span>} title={<span data-testid="m32-chain-title">{pick(c, 'name')}</span>}>
        <p className="text-[14px] text-ink-2">{pick(c, 'summary')}</p>
      </Card>

      <Section title={t('m32.chain.stages')} description={t('m32.chain.stagesIntro')}>
        <StageFlow stages={c.stages} testId="m32-chain-stages" />
      </Section>

      <Section title={t('m32.chain.facts')} description={t('m32.chain.factsIntro')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m32-chain-facts">
          {(c.facts as Row[]).map((x) => (
            <li key={x.id} className="card space-y-2 p-3.5" data-testid="m32-chain-fact" data-secondary={x.secondary ? 'true' : 'false'}>
              <p className="text-[13.5px]">{lang === 'ar' ? x.ar : x.en}</p>
              <p className="flex flex-wrap items-center gap-2 text-[12px]">
                <SourceLink href={x.url} date={f.date(x.as_of)}>{x.label}</SourceLink>
                {x.secondary && <StatusPill tone="sim">{t('m32.chain.secondary')}</StatusPill>}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t('m32.chain.skills')}><SkillChips ids={c.skill_ids} skills={d.skills} testId="m32-chain-skills" /></Card>
        <Card title={t('m32.chain.cec')}>
          <ul className="space-y-1 text-[13px]" data-testid="m32-chain-cec">{c.cec_ids.map((id: string) => {
            const k = d.cec_competences.find((x: Row) => x.id === id);
            return <li key={id}><L to={`/skills/clean-energy/${id}`}><span className="num me-1.5 text-[11.5px] text-ink-3">{k?.code}</span>{k ? pick(k, 'name') : id}</L></li>;
          })}</ul>
        </Card>
        <Card title={t('m32.chain.lanes')}>
          <ul className="space-y-1 text-[13px]" data-testid="m32-chain-lanes">{c.lane_ids.map((id: string) => {
            const l = d.horizon_lanes.find((x: Row) => x.id === id);
            return <li key={id}><L to="/my/future" className="inline-flex items-center gap-1.5"><Icon name="globe" size={13} className="text-accent" /><span className="num text-[11.5px] text-ink-3">{l?.code}</span>{l ? pick(l, 'title') : id}</L></li>;
          })}</ul>
        </Card>
      </div>

      {track && (
        <Section title={t('m32.chain.pathway')} description={t('m32.chain.pathwayIntro')}>
          <PathwayPanel track={track} d={d} />
        </Section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout tone="sim" title={t('m32.hub.concept.title')}>{t('m32.hub.concept.body')}</Callout>
        <Card title={t('m32.chain.more')}>
          <ul className="space-y-1 text-[13px]">{others.map((o: Row) => <li key={o.id}><L to={`/learn/energy-transition/${o.id}`} data-testid="m32-chain-other">{pick(o, 'name')}</L></li>)}</ul>
        </Card>
      </div>
      <Card title={t('m32.fw.sources')}><SourceList sources={c.sources} testId="m32-chain-sources" /></Card>
    </div>
  );
}
