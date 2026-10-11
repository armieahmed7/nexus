// /opportunities (M20 · F08): the opportunity marketplace. Every card is ranked by the match engine (useEngine('match'):
// skills cosine, development bonus for my gaps, target-role bonus) and explains itself with <WhyThis>.
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, FilterBar, useFilters, StatTile, WhyThis, EngineBadge, Icon } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Can } from '../../auth/guards';
import { OPP_KINDS, LOCATIONS, PRIORITY_FLAGS } from './domain';
import { NEED_LEVEL } from './match';
import { ChannelChip } from './fsUi';
import { useMarket, useMatches, useLabels, defaultTarget, KindChip, FlagChips, MatchRing, NeededSkills, GainedSkills, Meta, useRange, seatsLeft, AppPill, type MarketData, type Opp } from './ui';
import type { Ranked } from '../../domain/engines/types';
import type { MatchItem } from './match';
import { RecoOptedOut, useRecoOptOut } from '../m16/optout'; // W3E5 (F24): per-surface opt-out

export default function MarketplacePage() {
  const t = useT();
  const { q, person, me } = useMarket();
  return (
    <Page
      title={t('m20.routes.opportunities.title')}
      eyebrow={t('m20.market.eyebrow')}
      intro={t('m20.market.intro')}
      wide
      actions={
        <>
          <L to="/opportunities/my" className="btn-outline btn-sm" data-testid="m20-my-link"><Icon name="user" size={14} />{t('m20.market.myApps')}</L>
          <L to="/opportunities/future" className="btn-outline btn-sm" data-testid="m20-future-link"><Icon name="sparkle" size={14} />{t('m20.fs.link.future')}</L>
          <L to="/opportunities/secondments" className="btn-outline btn-sm" data-testid="m20-secondments-link"><Icon name="globe" size={14} />{t('m20.fs.link.secondments')}</L>
          <L to="/opportunities/rotations" className="btn-outline btn-sm" data-testid="m20-rotations-link"><Icon name="grad" size={14} />{t('m20.market.rotations')}</L>
          <Can res="opportunities" levels={['W', 'A']}><L to="/opportunities/manage" className="btn-outline btn-sm"><Icon name="check" size={14} />{t('m20.market.manage')}</L></Can>
          <Can res="opportunities" levels={['W']}><L to="/opportunities/post" className="btn-primary btn-sm" data-testid="m20-post-link"><Icon name="plus" size={14} />{t('m20.market.post')}</L></Can>
        </>
      }
    >
      <Async state={q} isEmpty={() => false}>{(d) => <Market d={d} me={me} currentRole={person?.job_role_id ?? null} family={person?.job_family_id ?? null} />}</Async>
    </Page>
  );
}

type Flt = { q: string; kind: string; loc: string; hours: string; flag: string; show: string; sort: string; target: string };

function Market({ d, me, currentRole, family }: { d: MarketData; me: string | null; currentRole: string | null; family: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels(d);
  const [flt, setFlt] = useFilters<Flt>({ q: '', kind: '', loc: '', hours: '', flag: '', show: '', sort: '', target: '' }, true);
  const target = flt.target === 'none' ? null : flt.target || defaultTarget(d.paths, currentRole, d.shortlist);
  const { eng, ranked: matched } = useMatches(d, target, currentRole, family);
  const unranked = useRecoOptOut('marketplace').optedOut; // W3E5 (F24): opted out -> no match scores or top picks, listed by start date
  const ranked = useMemo(() => (unranked ? [...matched].sort((a, b) => { const x = (a.item!.opp as Opp).start_on, y = (b.item!.opp as Opp).start_on; return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1; }) : matched), [matched, unranked]);
  const saved = new Set(d.saves.filter((s) => s.saved).map((s) => s.opportunity_id));
  const mine = new Map(d.apps.filter((a) => a.person_id === me && a.status !== 'withdrawn').map((a) => [a.opportunity_id, a]));
  const term = flt.q.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const list = useMemo(() => {
    const rows = ranked.filter(({ item }) => {
      const o = item!.opp as Opp;
      if (flt.show !== 'all' && o.status !== 'open' && !mine.has(o.id)) return false;
      if (flt.kind && o.kind !== flt.kind) return false;
      if (flt.loc && o.location_type !== flt.loc) return false;
      if (flt.hours && o.hours_week > Number(flt.hours)) return false;
      if (flt.flag && !(o.priority_flags ?? []).includes(flt.flag)) return false;
      if (flt.show === 'saved' && !saved.has(o.id)) return false;
      if (flt.show === 'eligible' && !item!.eligible) return false;
      if (term && !`${o.title_en} ${o.title_ar} ${o.summary_en} ${o.summary_ar} ${[...o.skills_needed, ...o.skills_gained].map(lab.skill).join(' ')}`.toLowerCase().includes(term)) return false;
      return true;
    });
    if (flt.sort === 'start') return [...rows].sort((a, b) => ((a.item!.opp as Opp).start_on < (b.item!.opp as Opp).start_on ? -1 : 1));
    if (flt.sort === 'new') return [...rows].sort((a, b) => ((a.item!.opp as Opp).created_at > (b.item!.opp as Opp).created_at ? -1 : 1));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, flt, term, d.saves, d.apps]);
  const open = ranked.filter((r) => (r.item!.opp as Opp).status === 'open');
  const strong = open.filter((r) => r.item!.eligible && r.score >= 0.6);
  const top = unranked ? [] : open.filter((r) => r.item!.eligible && !mine.has(r.id)).slice(0, 3);
  const inProgress = d.apps.filter((a) => a.person_id === me && ['applied', 'released', 'selected'].includes(a.status)).length;
  const soon = open.filter((r) => { const s = (r.item!.opp as Opp).start_on; return s >= today && s <= new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10); }).length;
  const targets = [...new Set(d.paths.filter((p) => p.from_role_id === currentRole).map((p) => p.to_role_id))];
  const roleOpts = d.roles.filter((r) => r.status === 'published').map((r) => ({ value: r.id, label: pick(r, 'title') }));

  return (
    <div className="space-y-6">
      {unranked && <RecoOptedOut surface="marketplace" />}
      <Grid cols={4}>
        <StatTile label={t('m20.market.statOpen')} value={f.num(open.length)} sub={t('m20.market.statOpenSub', { n: f.num(d.opps.filter((o) => o.status === 'open' && (o.priority_flags ?? []).includes('emirati_development')).length) })} />
        {!unranked && <StatTile label={t('m20.market.statStrong')} value={f.num(strong.length)} tone="ok" sub={t('m20.market.statStrongSub')} />}
        <StatTile label={t('m20.market.statSoon')} value={f.num(soon)} sub={t('m20.market.statSoonSub')} />
        <StatTile label={t('m20.market.statMine')} value={f.num(inProgress)} sub={<L to="/opportunities/my">{t('m20.market.statMineSub')}</L>} />
      </Grid>

      <Card className="bg-sunken/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="caps">{t('m20.market.profileFor')}</div>
            <div className="mt-0.5 font-semibold">{lab.role(currentRole)}</div>
            <div className="text-[12.5px] text-ink-2">{t('m20.market.profileSkills', { n: f.num(d.states.filter((s) => s.level > 0).length) })}</div>
          </div>
          <label className="flex min-w-[260px] flex-col gap-1">
            <span className="caps">{t('m20.market.target')}</span>
            <select className="input" value={flt.target || target || ''} onChange={(e) => setFlt({ target: e.target.value })} data-testid="m20-target">
              <option value="none">{t('m20.market.noTarget')}</option>
              {(d.shortlist ?? []).length > 0 && <optgroup label={t('m20.market.shortlist')}>{(d.shortlist ?? []).map((id) => <option key={`s-${id}`} value={id}>{lab.role(id)}</option>)}</optgroup>}
              {targets.length > 0 && <optgroup label={t('m20.market.nextSteps')}>{targets.map((id) => <option key={id} value={id}>{lab.role(id)}</option>)}</optgroup>}
              <optgroup label={t('m20.market.allRoles')}>{roleOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
            </select>
          </label>
          <div className="flex items-center gap-2"><EngineBadge engine={eng} /></div>
        </div>
        {!unranked && <p className="mt-3 text-[12.5px] text-ink-2">{t('m20.market.how', { s: f.num(Math.round((eng.weights.skills ?? 0.7) * 100)), d: f.num(Math.round((eng.weights.development ?? 0.2) * 100)), g: f.num(Math.round((eng.weights.target ?? 0.1) * 100)), need: NEED_LEVEL })}</p>}
      </Card>

      {top.length > 0 && (
        <Section title={t('m20.market.topPicks')} description={t('m20.market.topPicksSub')}>
          <Grid cols={3}>
            {top.map((r) => <OppCard key={r.id} r={r} d={d} saved={saved.has(r.id)} app={mine.get(r.id)} feature />)}
          </Grid>
        </Section>
      )}

      <Section title={t('m20.market.all')} description={t('m20.market.count', { n: f.num(list.length) })}>
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[
            { key: 'kind', label: t('m20.f.kind'), options: OPP_KINDS.map((k) => ({ value: k, label: t(`m20.kind.${k}`) })) },
            { key: 'loc', label: t('m20.f.location'), options: LOCATIONS.map((k) => ({ value: k, label: t(`m20.location.${k}`) })) },
            { key: 'hours', label: t('m20.f.hours'), options: [4, 6, 8, 12].map((h) => ({ value: String(h), label: t('m20.f.hoursMax', { n: f.num(h) }) })) },
            { key: 'flag', label: t('m20.f.flag'), options: PRIORITY_FLAGS.map((k) => ({ value: k, label: t(`m20.flag.${k}`) })) },
            { key: 'show', label: t('m20.f.show'), options: [{ value: 'eligible', label: t('m20.f.eligible') }, { value: 'saved', label: t('m20.f.saved') }, { value: 'all', label: t('m20.f.includeClosed') }] },
            { key: 'sort', label: t('m20.f.sort'), options: [{ value: 'start', label: t('m20.f.sortStart') }, { value: 'new', label: t('m20.f.sortNew') }] },
          ]}
        />
        {list.length === 0 ? (
          <EmptyState icon="briefcase" title={t('m20.market.none')}>{t('m20.market.noneBody')}</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m20-list">
            {list.map((r) => <OppCard key={r.id} r={r} d={d} saved={saved.has(r.id)} app={mine.get(r.id)} unranked={unranked} />)}
          </div>
        )}
      </Section>
      <Callout title={t('m20.market.fairTitle')}>{t('m20.market.fairBody')}</Callout>
    </div>
  );
}

function OppCard({ r, d, saved, app, feature, unranked }: { r: Ranked<MatchItem<Opp>>; d: MarketData; saved: boolean; app?: MarketData['apps'][number]; feature?: boolean; unranked?: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const lab = useLabels(d);
  const range = useRange();
  const o = r.item!.opp as Opp;
  const lv = new Map(d.states.map((s) => [s.skill_id, s.level]));
  const left = seatsLeft(o);
  return (
    <Card as="article" className={`flex flex-col ${feature ? 'border-accent/40 shadow-card' : ''}`}>
      <div className="flex items-start gap-3" data-testid="m20-card">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5"><KindChip kind={o.kind} /><ChannelChip channel={o.channel} /><FlagChips flags={o.priority_flags} />{!r.item!.eligible && <span className="chip border-line bg-sunken text-ink-3">{t('m20.market.otherFamilies')}</span>}</div>
          <h3 className="text-[15.5px] font-semibold leading-snug"><L to={`/opportunities/${o.id}`} className="link-plain hover:underline">{pick(o, 'title')}</L></h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <Meta icon="user">{lab.role(o.host_role_id)}</Meta>
            <Meta icon="calendar">{range(o.start_on, o.end_on)}</Meta>
            <Meta icon="chart">{t('m20.common.hoursWeek', { n: f.num(o.hours_week) })}</Meta>
            <Meta icon="home">{t(`m20.location.${o.location_type}`)}</Meta>
          </div>
        </div>
        {!unranked && (
          <div className="flex flex-col items-center gap-0.5">
            <MatchRing score={r.score} />
            <span className="caps">{t('m20.common.match')}</span>
          </div>
        )}
      </div>
      {!feature && <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-2">{pick(o, 'summary')}</p>}
      <div className="mt-3 space-y-2">
        <div><div className="caps mb-1">{t('m20.common.needed')}</div><NeededSkills ids={o.skills_needed} levelOf={(id) => lv.get(id) ?? 0} label={lab.skill} /></div>
        <div><div className="caps mb-1">{t('m20.common.gained')}</div><GainedSkills ids={o.skills_gained} label={lab.skill} /></div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 mt-3">
        <div className="flex items-center gap-2">
          {!unranked && <WhyThis reasons={r.reasons} testId="m20-why" />}
          <button type="button" className="btn-ghost btn-sm" aria-pressed={saved} onClick={() => run(() => repo.rpc.saveOpportunity(o.id, !saved))} data-testid="m20-save">
            <Icon name="book" size={14} />{saved ? t('m20.common.saved') : t('m20.common.save')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {app ? <AppPill status={app.status} /> : o.status === 'open' ? <span className="text-[12px] text-ink-3">{t('m20.common.seatsLeft', { n: f.num(left), of: f.num(o.seats) })}</span> : <span className="text-[12px] text-ink-3">{t(`m20.oppStatus.${o.status}`)}</span>}
          <L to={`/opportunities/${o.id}`} className="btn-primary btn-sm" data-testid="m20-open">{app ? t('m20.common.view') : t('m20.common.viewApply')}<Icon name="chevron" size={13} /></L>
        </div>
      </div>
    </Card>
  );
}
