// FS42 + FS43 /learn/energy-transition (staff, internal_content R): the energy-transition learning hub. Three value-chain explainers
// (hydrogen, process heat, grid) with their stages and sourced facts; the FS42 awareness-to-practitioner pathway and the FS43 ESG and
// GHG literacy track for managers (both FS17 pathways in M19, with envelope and weekly hours); the Energy Transition cohort (FS20) and the
// CleanEnergyComp framework (FS41). Concept learning only: no ENEC project, site or deployment decision is implied.
import { Page, Section, Card, Async, Callout, StatTile, BenchmarkChips, Icon, StatusPill } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { trackHours } from './transition';
import { SkillChips, useEtRef, type EtRef, type Row } from './ui';

export default function EnergyTransitionPage() {
  const t = useT();
  const ref = useEtRef();
  return (
    <Page title={t('m32.routes.learn-energy-transition.title')} intro={t('m32.hub.intro')} wide
      eyebrow={<span className="flex flex-wrap gap-2"><BenchmarkChips feature="FS42" /><BenchmarkChips feature="FS43" /></span>}>
      <Async state={ref}>{(d) => <Hub d={d} />}</Async>
    </Page>
  );
}

export function StageFlow({ stages, testId = 'm32-stages' }: { stages: Row[]; testId?: string }) {
  const lang = useLang();
  const f = useFormat();
  return (
    <ol className="flex flex-col gap-2 md:flex-row md:items-stretch" data-testid={testId}>
      {stages.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1 rounded-card border border-line bg-sunken p-2.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><span className="num flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] text-eyebrow">{f.num(i + 1)}</span>{lang === 'ar' ? s.ar : s.en}</p>
            <p className="mt-1 text-[12px] text-ink-2">{lang === 'ar' ? s.role_ar : s.role_en}</p>
          </div>
          {i < stages.length - 1 && <Icon name="chevron" size={14} className="hidden shrink-0 text-ink-3 md:block rtl:-scale-x-100" />}
        </li>
      ))}
    </ol>
  );
}

function Hub({ d }: { d: EtRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const facts = d.value_chains.reduce((n: number, c: Row) => n + c.facts.length, 0);
  const steps = d.pathway_steps.map((s: Row) => ({ ...s, hours: Number(s.hours) }));
  const academy = d.academies.find((a: Row) => a.id === 'ac-energy');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m32-hub-tiles">
        <StatTile label={t('m32.hub.tile.chains')} value={f.num(d.value_chains.length)} sub={t('m32.hub.tile.chainsSub')} />
        <StatTile label={t('m32.hub.tile.facts')} value={f.num(facts)} sub={t('m32.hub.tile.factsSub')} tone="ok" />
        <StatTile label={t('m32.hub.tile.tracks')} value={f.num(d.transition_tracks.length)} sub={t('m32.hub.tile.tracksSub')} />
        <StatTile label={t('m32.hub.tile.competences')} value={f.num(d.cec_competences.length)} sub={t('m32.hub.tile.competencesSub')} tone="info" />
      </div>
      <Callout tone="sim" title={t('m32.hub.concept.title')}>{t('m32.hub.concept.body')}</Callout>

      <Section title={t('m32.hub.chainsTitle')} description={t('m32.hub.chainsIntro')}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3" data-testid="m32-hub-chains">
          {d.value_chains.map((c: Row) => (
            <Card key={c.id} eyebrow={<span className="num">{c.code}</span>} title={<L to={`/learn/energy-transition/${c.id}`} className="text-inherit" data-testid="m32-hub-chain-link">{pick(c, 'name')}</L>}>
              <div className="space-y-2.5" data-testid="m32-hub-chain" data-id={c.id}>
                <p className="text-[13px] text-ink-2">{pick(c, 'summary')}</p>
                <ol className="flex flex-wrap items-center gap-1 text-[11.5px]">{(c.stages as Row[]).map((s, i) => (
                  <li key={s.key} className="flex items-center gap-1"><span className="chip border-line bg-panel normal-case tracking-normal">{lang === 'ar' ? s.ar : s.en}</span>{i < c.stages.length - 1 && <Icon name="chevron" size={11} className="text-ink-3 rtl:-scale-x-100" />}</li>
                ))}</ol>
                <SkillChips ids={c.skill_ids} skills={d.skills} />
                <p className="text-[12px] text-ink-3">{t('m32.hub.chainFacts', { n: f.num(c.facts.length) })}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={t('m32.hub.tracksTitle')} description={t('m32.hub.tracksIntro')}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m32-hub-tracks">
          {d.transition_tracks.map((tr: Row) => {
            const p = d.pathways.find((x: Row) => x.id === tr.pathway_id);
            if (!p) return null;
            const h = trackHours({ ...p, weekly_hours: Number(p.weekly_hours) }, steps, tr.max_hours == null ? null : Number(tr.max_hours));
            const href = tr.feature === 'FS43' ? '/learn/energy-transition/esg-managers' : `/learn/energy-transition/${tr.chain_ids[0] ?? ''}`;
            return (
              <Card key={tr.id} eyebrow={<span className="flex items-center gap-2"><StatusPill tone="accent">{tr.feature}</StatusPill>{pick(tr, 'audience')}</span>}
                title={<L to={href} className="text-inherit" data-testid="m32-hub-track-link">{pick(p, 'title')}</L>}>
                <div className="space-y-2" data-testid="m32-hub-track" data-id={tr.id}>
                  <p className="text-[13px] text-ink-2">{pick(tr, 'summary')}</p>
                  <p className="flex flex-wrap gap-2 text-[12.5px]">
                    <span className="chip border-line bg-panel normal-case tracking-normal">{t('m32.monthsN', { n: f.num(Number(p.envelope_months)) })}</span>
                    <span className="chip border-line bg-panel normal-case tracking-normal">{t('m32.hub.weekly', { n: f.num(Number(p.weekly_hours)) })}</span>
                    <span className="chip border-line bg-panel normal-case tracking-normal">{t('m32.hoursN', { n: f.num(h.total_hours) })}</span>
                    {tr.max_hours != null && <StatusPill tone={h.under_cap ? 'ok' : 'bad'}>{t('m32.hub.underCap', { n: f.num(Number(tr.max_hours)) })}</StatusPill>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <L to={href} className="btn-primary btn-sm no-underline">{t('m32.hub.openTrack')}</L>
                    <L to={`/learn/pathways/${p.id}`} className="btn-outline btn-sm no-underline">{t('m32.track.open')}</L>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {academy && (
          <Card title={pick(academy, 'name')} eyebrow={t('m32.hub.academyEyebrow')}>
            <p className="text-[13px] text-ink-2">{pick(academy, 'tagline')}</p>
            <L to={`/learn/academies/${academy.id}`} className="mt-2 inline-block text-[13px]" data-testid="m32-hub-academy">{t('m32.hub.academyOpen')}</L>
          </Card>
        )}
        <Card title={t('m32.hub.cecTitle')} eyebrow="FS41">
          <p className="text-[13px] text-ink-2">{t('m32.hub.cecBody')}</p>
          <div className="mt-2 flex flex-wrap gap-2"><L to="/skills/clean-energy" className="btn-outline btn-sm no-underline" data-testid="m32-hub-cec">{t('m32.hub.cecOpen')}</L><L to="/my/clean-energy" className="btn-ghost btn-sm no-underline">{t('m32.fw.cta.mineBtn')}</L></div>
        </Card>
      </div>
    </div>
  );
}
