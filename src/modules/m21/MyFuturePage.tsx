// M21 /my/future (F09 Future Me): my readiness for the ADVANCE era by technology family (SIMULATED index), the bridge plan that
// moves me most, the horizon roadmap 2026-2035 with my current level per lane, the concept future roles I am closest to, and my
// goals (handed to the Learning Coach) and interests (an aggregate demand signal for HR). Every index carries the SIMULATED chip
// and "ENEC is evaluating these technologies; no deployment decision is implied".
// FS13: readiness rule v2 (rpc.futureReadiness, TS = SQL): learning moves the index, both ceilings, "what raises it" with +points,
// before/after previews, planned learning and ADVANCE tracks. FS14: Horizon lanes 2.0 (eleven lanes, board and timeline, drawer).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, WhyThis, EngineBadge, Icon, SimChip } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useEngine } from '../../data';
import type { Ranked } from '../../domain/engines/types';
import { NoDecision, Radar } from '../m11/shared';
import { bridgePlan, rankBridges, rankFutureRoles, rankResources, type BridgeRank, type Readiness } from './future';
import { FutureMeData, GoalButton, IndexBadge, IndexMeter, InterestToggle, SourceLinks, techSlug, useFutureMe, useLabels, useReadiness, type FutureSource, type Labels } from './shared';
import { toV1Family, v2Levels } from './raises';
import { FamiliesV2, FS13Chips, PlannedLearning, ReadinessHero, TracksSection, useRaises, WhatRaisesIt } from './v2ui';
import { LanesSection } from './LanesSection';

export default function MyFuturePage() {
  const t = useT();
  const q = useFutureMe();
  const eng = useEngine('recommend');
  return (
    <Page title={t('m21.routes.my-future.title')} eyebrow={t('m21.page.eyebrow')} intro={t('m21.page.intro')} actions={<EngineBadge engine={eng} />} wide>
      <NoDecision />
      <FS13Chips />
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m21.page.signIn')} />}>
        {(d) => <Body d={d!} />}
      </Async>
    </Page>
  );
}

function Body({ d }: { d: FutureMeData }) {
  const t = useT();
  const labels = useLabels(d);
  const v1 = useReadiness(d, labels);
  const r = d.rv2;
  const ranked = useRaises(d, r, labels);
  const [focus, setFocus] = useState<string | null>(null);
  // the F09 rankers (bridges, resources, concept roles) read readiness v2 through the adapter
  const rd: Readiness = useMemo(() => (r ? { overall: r.overall, ceiling: r.learn_ceiling, families: r.families.map((f) => toV1Family(f)), levels: v2Levels(r) } : v1), [r, v1]);
  const onTrack = (id: string) => {
    setFocus(id);
    document.getElementById(`m21-track-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };
  const hasSkills = d.states.length > 0;
  return (
    <>
      {!hasSkills && (
        <Callout tone="info" title={t('m21.page.noSkillsTitle')}>
          {t('m21.page.noSkillsBody')} <L to="/my/skills">{t('m21.page.openPassport')}</L>
        </Callout>
      )}
      {r ? <ReadinessHero d={d} r={r} top={ranked[0]} /> : <Hero d={d} rd={v1} />}
      {r && <FamiliesV2 d={d} r={r} extra={(id) => <InterestToggle d={d} kind="tech" target={id} />} />}
      {r && <WhatRaisesIt d={d} r={r} ranked={ranked} onTrack={onTrack} />}
      {r && <PlannedLearning d={d} r={r} />}
      {r && <TracksSection d={d} r={r} focus={focus} />}
      <BridgePlan d={d} rd={rd} labels={labels} />
      <LanesSection d={d} />
      <ClosestRoles d={d} rd={rd} labels={labels} />
      <MyGoals d={d} />
      <Method />
    </>
  );
}

function Hero({ d, rd }: { d: FutureMeData; rd: Readiness }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const best = [...rd.families].sort((a, b) => b.index - a.index || (a.tech_id < b.tech_id ? -1 : 1))[0];
  const role = d.jobRoles.find((r) => r.id === d.person?.job_role_id);
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]" aria-labelledby="m21-hero">
      <Card className="relative overflow-hidden">
        <div className="frame-line absolute inset-x-0 top-0 h-1" aria-hidden />
        <h2 id="m21-hero" className="sr-only">{t('m21.hero.title')}</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
            <Icon name="user" size={14} />
            <span>{role ? t('m21.hero.asRole', { role: pick(role, 'title') }) : t('m21.hero.noRole')}</span>
          </div>
          <IndexBadge size="lg" value={rd.overall} label={t('m21.hero.overall')} sub={t('m21.hero.ceiling', { n: f.num(rd.ceiling, { maximumFractionDigits: 1 }) })} testId="m21-index-overall" />
          <IndexMeter value={rd.overall} ceiling={rd.ceiling} label={t('m21.hero.meter', { v: f.num(rd.overall), c: f.num(rd.ceiling) })} />
          <div className="flex flex-wrap gap-3 text-[12px] text-ink-2">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-accent" />{t('m21.hero.legendMine')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-sim-bg ring-1 ring-sim" />{t('m21.hero.legendCeiling')}</span>
          </div>
          <p className="text-[13.5px] text-ink-2">{t('m21.hero.explain')}</p>
          {best && best.index > 0 && (
            <div className="rounded-btn border border-line bg-sunken/60 p-3 text-[13px]">
              <span className="font-semibold">{t('m21.hero.strongest', { tech: pick(d.techs.find((x) => x.id === best.tech_id), 'family') })}</span>{' '}
              <span className="num">{f.num(best.index)}</span> <WhyThis reasons={best.reasons} />
            </div>
          )}
        </div>
      </Card>
      <Card>
        <Radar
          title={t('m21.hero.radar')}
          axes={rd.families.map((x) => pick(d.techs.find((y) => y.id === x.tech_id), 'family'))}
          series={[
            { name: t('m21.hero.legendMine'), values: rd.families.map((x) => x.index), tone: 'accent' },
            { name: t('m21.hero.legendCeiling'), values: rd.families.map((x) => x.ceiling), tone: 'sim', dashed: true },
          ]}
        />
        <p className="mt-1 text-center text-[11.5px] text-sim" data-testid="m21-no-decision">{t('m11.common.noDecision')}</p>
      </Card>
    </section>
  );
}

function BridgePlan({ d, rd, labels }: { d: FutureMeData; rd: Readiness; labels: Labels }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const eng = useEngine('recommend');
  const plan = useMemo(() => bridgePlan(rankBridges({ bridges: d.bridges, families: rd.families, myRole: d.person?.job_role_id ?? null, edges: d.edges, roleLabels: labels.roles, techLabels: labels.techs })), [d, rd, labels]);
  if (!plan.length) return <Section title={t('m21.bridge.title')}><EmptyState title={t('m21.bridge.empty')} /></Section>;
  return (
    <Section title={t('m21.bridge.title')} description={t('m21.bridge.desc')}>
      <ol className="space-y-3" data-testid="m21-bridge-plan">
        {plan.map((r, i) => {
          const it = r.item as BridgeRank;
          const b = d.bridges.find((x) => x.id === r.id)!;
          const tech = d.techs.find((x) => x.id === b.tech_id);
          const role = d.jobRoles.find((x) => x.id === b.from_role_id);
          const res = it.family ? rankResources(d.resources, it.family, labels.adv, eng.weights).slice(0, 3) : [];
          return (
            <li key={r.id} className="card p-4" data-testid="m21-bridge">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-eyebrow">{f.num(i + 1)}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      <span>{role ? pick(role, 'title') : b.from_role_id}</span>
                      <Icon name="chevron" size={14} className="text-ink-3 rtl:-scale-x-100" />
                      <L to={`/my/future/${techSlug(b.tech_id)}`}>{tech ? pick(tech, 'family') : b.tech_id}</L>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]">
                      <span className={`chip ${it.fit === 1 ? 'border-ok-line bg-ok-bg text-ok' : it.fit >= 0.6 ? 'border-info-line bg-info-bg text-info' : 'border-line bg-sunken text-ink-2'}`}>{t(it.fit === 1 ? 'm21.bridge.fitMine' : it.fit >= 0.6 ? 'm21.bridge.fitNear' : 'm21.bridge.fitOther')}</span>
                      <span className="chip border-sim-line bg-sim-bg text-sim">{t('m21.bridge.uplift', { n: f.num(it.uplift, { maximumFractionDigits: 1 }) })}</span>
                      <SimChip />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <WhyThis reasons={r.reasons} />
                  <GoalButton d={d} kind="bridge" refId={b.id} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-btn border border-ok-line bg-ok-bg p-2.5"><div className="caps text-ok">{t('m11.pub.transfers')}</div><p className="text-[13px]">{pick(b, 'transfers')}</p></div>
                <div className="rounded-btn border border-sim-line bg-sim-bg p-2.5"><div className="caps text-sim">{t('m11.pub.isNew')}</div><p className="text-[13px]">{pick(b, 'new')}</p></div>
              </div>
              <ResourceList ranked={res} />
              <p className="mt-2 text-[11.5px] text-sim">{t('m11.common.noDecision')}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function ResourceList({ ranked, title }: { ranked: Ranked<FutureMeData['resources'][number]>[]; title?: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  if (!ranked.length) return <p className="mt-3 text-[12.5px] text-ink-3">{t('m21.res.none')}</p>;
  return (
    <div className="mt-3">
      <div className="caps mb-1.5">{title ?? t('m21.res.title')}</div>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-3" data-testid="m21-resources">
        {ranked.map((r) => {
          const x = r.item!;
          return (
            <li key={r.id} className="flex flex-col gap-1.5 rounded-btn border border-line bg-panel p-3" data-testid="m21-resource">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="chip border-line bg-sunken text-ink-2">{t(`m21.res.kind.${x.kind}`)}</span>
                {x.hours != null && <span className="chip border-line bg-sunken text-ink-2 num">{t('m21.res.hours', { n: f.num(Number(x.hours), { maximumFractionDigits: 1 }) })}</span>}
              </div>
              <div className="text-[13px] font-semibold leading-snug">{x.course_id ? <L to={`/learn/course/${x.course_id}`}>{pick(x, 'title')}</L> : pick(x, 'title')}</div>
              {pick(x, 'provider') && <div className="text-[12px] text-ink-3">{pick(x, 'provider')}</div>}
              <p className="text-[12.5px] text-ink-2">{pick(x, 'summary')}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <SourceLinks sources={(x.sources as FutureSource[]) ?? []} compact />
                <WhyThis reasons={r.reasons} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ClosestRoles({ d, rd, labels }: { d: FutureMeData; rd: Readiness; labels: Labels }) {
  const t = useT();
  const pick = usePick();
  const ranked = useMemo(() => rankFutureRoles({ roles: d.roles, levels: rd.levels, myRole: d.person?.job_role_id ?? null, edges: d.edges, roleLabels: labels.roles, advLabels: labels.adv }).slice(0, 3), [d, rd, labels]);
  return (
    <Section title={t('m21.roles.title')} description={t('m21.roles.desc')}>
      {ranked.length === 0 ? <EmptyState title={t('m21.roles.empty')} /> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m21-future-roles">
          {ranked.map((r) => {
            const x = r.item!;
            return (
              <li key={r.id} className="card flex flex-col gap-2.5 p-4" data-testid="m21-future-role">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{pick(x, 'title')}</h3>
                  <span className="chip border-line bg-sunken text-ink-2">{t(`m11.horizon.${x.horizon}`)}</span>
                </div>
                <p className="text-[13px] text-ink-2">{pick(x, 'summary')}</p>
                <IndexBadge size="sm" value={Math.round(r.score * 1000) / 10} label={t('m21.roles.closeness')} />
                <div className="flex flex-wrap gap-1 text-[11.5px]">
                  {x.tech_ids.map((id) => <L key={id} to={`/my/future/${techSlug(id)}`} className="chip border-line bg-panel text-ink">{pick(d.techs.find((y) => y.id === id), 'family')}</L>)}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                  <WhyThis reasons={r.reasons} />
                  <GoalButton d={d} kind="future_role" refId={x.id} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[12.5px] text-ink-3">{t('m11.pub.catalogueFoot')}</p>
    </Section>
  );
}

function MyGoals({ d }: { d: FutureMeData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const goals = d.goals.filter((g) => g.status === 'active').sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const interest = d.interest.filter((i) => i.active);
  const name = (i: FutureMeData['interest'][number]) => (i.tech_id ? pick(d.techs.find((x) => x.id === i.tech_id), 'family') : pick(d.lanes.find((x) => x.id === i.lane_id), 'title'));
  return (
    <Section title={t('m21.goals.title')} description={t('m21.goals.desc')}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title={t('m21.goals.coach')} actions={<L to="/my/coach" className="btn-outline btn-sm">{t('m21.goals.openCoach')}</L>}>
          {goals.length === 0 ? <EmptyState title={t('m21.goals.empty')}>{t('m21.goals.emptyBody')}</EmptyState> : (
            <ul className="divide-y divide-line" data-testid="m21-goals">
              {goals.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold">{pick(g, 'title')}</div>
                    <div className="flex flex-wrap gap-1.5 text-[11.5px] text-ink-3">
                      <span className="chip border-line bg-sunken text-ink-2">{t(`m21.goals.kind.${g.kind}`)}</span>
                      <span>{t('m21.goals.skills', { n: f.num(g.skill_ids.length) })}</span>
                      <span>· {t('m21.goals.target', { n: f.num(g.target_level) })}</span>
                      <span>· {f.date(g.created_at)}</span>
                    </div>
                  </div>
                  <GoalButton d={d} kind={g.kind as never} refId={g.ref_id} compact />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-ink-3">{t('m21.goals.handoff')}</p>
        </Card>
        <Card title={t('m21.interest.title')}>
          {interest.length === 0 ? <p className="text-[13px] text-ink-3">{t('m21.interest.empty')}</p> : (
            <ul className="flex flex-wrap gap-1.5" data-testid="m21-interests">{interest.map((i) => <li key={i.id} className="chip border-accent/30 bg-accent-soft text-eyebrow">{name(i)}</li>)}</ul>
          )}
          <p className="mt-2 text-[12px] text-ink-3">{t('m21.interest.privacy')}</p>
        </Card>
      </div>
    </Section>
  );
}

function Method() {
  const t = useT();
  return (
    <Section>
      <details className="card p-4 text-[13px]" data-testid="m21-method">
        <summary className="cursor-pointer font-semibold">{t('m21.method.title')}</summary>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-ink-2">
          <li>{t('m21.method.v2.keyspace')}</li>
          <li>{t('m21.method.v2.carry')}</li>
          <li>{t('m21.method.v2.direct')}</li>
          <li>{t('m21.method.v2.learn')}</li>
          <li>{t('m21.method.v2.credit')}</li>
          <li>{t('m21.method.v2.index')}</li>
          <li>{t('m21.method.v2.ceilings')}</li>
          <li>{t('m21.method.bridges')}</li>
          <li>{t('m21.method.roles')}</li>
          <li>{t('m21.method.mirror')}</li>
        </ul>
      </details>
    </Section>
  );
}
