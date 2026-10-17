// /opportunities/future (M20 · FS27): the future-skills gig channel. Five channels (ADVANCE study support, digital innovation, governed AI
// pilots, data clean-up, knowledge capture), every open future gig ranked for me with <WhyThis> (the future skills it grows, my level now,
// their FS02 lifecycle and whether it fits my time envelope), my envelope at a glance, and the HR programme view (suppressed below 10).
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, StatTile, WhyThis, Icon, SourceLink, BenchmarkChips, BarChart, BenchmarkLine, SimChip } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { Can } from '../../auth/guards';
import { CHANNELS, FS27_REFS, rankFutureGigs } from './futureGigs';
import { useFutureData, useMyEnvelopes, ChannelChip, FitBadge, EnvelopeMeter, EnvelopePill, FutureSkillChips, type FutureData } from './fsUi';
import { AppPill, OppPill, seatsLeft, useRange } from './ui';

export default function FutureGigsPage() {
  const t = useT();
  const { q, me } = useFutureData();
  return (
    <Page
      title={t('m20.routes.opportunities-future.title')}
      eyebrow={t('m20.fs.hub.eyebrow')}
      intro={t('m20.fs.hub.intro')}
      wide
      actions={
        <>
          <L to="/opportunities/envelope" className="btn-primary btn-sm" data-testid="m20-fs-envelope-link"><Icon name="calendar" size={14} />{t('m20.fs.hub.myEnvelope')}</L>
          <Can res="opportunities" levels={['A']}><L to="/opportunities/envelopes" className="btn-outline btn-sm"><Icon name="users" size={14} />{t('m20.fs.hub.teamEnvelopes')}</L></Can>
          <L to="/opportunities" className="btn-outline btn-sm"><Icon name="briefcase" size={14} />{t('m20.fs.hub.allGigs')}</L>
        </>
      }
    >
      <div className="mb-4"><BenchmarkChips feature="FS27" /></div>
      <Async state={q} isEmpty={() => false}>{(d) => <Hub d={d} me={me} />}</Async>
    </Page>
  );
}

function Hub({ d, me }: { d: FutureData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const range = useRange();
  const env = useMyEnvelopes(d, me);
  const [channel, setChannel] = useState<string>('all');
  const levels = useMemo(() => new Map(d.states.map((s) => [s.skill_id, s.level])), [d.states]);
  const open = d.opps.filter((o) => o.channel && o.status === 'open');
  const ranked = useMemo(() => rankFutureGigs(open as never, d.skills as never, levels, (g) => env.fitOf(g as never)), [open, d.skills, levels, env]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ranked.filter((r) => channel === 'all' || r.item.gig.channel === channel);
  const allOpen = d.opps.filter((o) => o.status === 'open').length;
  const cur = env.current;
  const view = cur && cur.status === 'approved' ? env.viewOf(cur) : null;
  const fits = ranked.filter((r) => r.item.fit.fits).length;
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.fs.hub.statOpen')} value={f.num(open.length)} sub={t('m20.fs.hub.statOpenSub', { all: f.num(allOpen) })} tone="info" />
        <StatTile label={t('m20.fs.hub.statChannels')} value={f.num(CHANNELS.filter((c) => open.some((o) => o.channel === c)).length)} sub={t('m20.fs.hub.statChannelsSub')} />
        <StatTile label={t('m20.fs.hub.statEnvelope')} value={view ? t('m20.fs.hours', { n: f.num(view.remaining) }) : cur ? t(`m20.fs.envStatus.${cur.status}`) : '—'} sub={view ? t('m20.fs.hub.statEnvelopeSub', { cap: f.num(view.cap), period: cur!.period }) : cur ? `${f.num(cur.pct)}% · ${cur.period}` /* FS wave D QA: a requested or declined envelope is not "no envelope" */ : t('m20.fs.hub.statEnvelopeNone')} tone={view ? 'ok' : undefined} />
        <StatTile label={t('m20.fs.hub.statFits')} value={f.num(fits)} sub={t('m20.fs.hub.statFitsSub')} tone={fits ? 'ok' : undefined} />
      </Grid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title={t('m20.fs.hub.listTitle')} description={t('m20.fs.hub.listSub')}>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t('m20.fs.hub.filter')} data-testid="m20-fs-channels">
            {['all', ...CHANNELS].map((c) => (
              <button key={c} type="button" className={`chip ${channel === c ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-ink-2'}`} aria-pressed={channel === c} onClick={() => setChannel(c)} data-testid={`m20-fs-channel-${c}`}>
                {c === 'all' ? t('m20.fs.hub.all') : t(`m20.fs.channel.${c}`)}
                <span className="num">{f.num(c === 'all' ? open.length : open.filter((o) => o.channel === c).length)}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? <EmptyState icon="sparkle" title={t('m20.fs.hub.empty')} /> : (
            <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2" data-testid="m20-fs-gigs">
              {shown.map((r) => {
                const g = r.item.gig as unknown as FutureData['opps'][number];
                const app = d.apps.find((a) => a.opportunity_id === g.id && a.person_id === me && a.status !== 'withdrawn');
                return (
                  <li key={g.id} data-testid="m20-fs-gig" data-channel={g.channel ?? ''}>
                    <Card className="h-full">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5"><ChannelChip channel={g.channel} /><OppPill status={g.status} />{app ? <AppPill status={app.status} /> : <FitBadge fit={r.item.fit} />}</div>
                      <h3 className="text-[15px] font-semibold leading-snug"><L to={`/opportunities/${g.id}`} className="hover:underline">{pick(g, 'title')}</L></h3>
                      <p className="mt-1 line-clamp-3 text-[13px] text-ink-2">{pick(g, 'summary')}</p>
                      <div className="mt-3"><FutureSkillChips ids={g.skills_gained} skills={d.skills} levels={levels} /></div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                        <span><Icon name="calendar" size={12} className="text-ink-3" /> {range(g.start_on, g.end_on)}</span>
                        <span>{t('m20.common.hoursWeek', { n: f.num(g.hours_week) })}</span>
                        <span>{t('m20.common.seatsLeft', { n: f.num(seatsLeft(g)), of: f.num(g.seats) })}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <WhyThis reasons={r.reasons} testId={`m20-fs-why-${g.id}`} />
                        <L to={`/opportunities/${g.id}`} className="btn-outline btn-sm">{t('m20.common.viewApply')}</L>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <aside className="space-y-4">
          <Card title={t('m20.fs.hub.envTitle')} actions={cur ? <EnvelopePill status={view ? view.phase : cur.status} /> : null}>
            {view && cur ? (
              <div className="space-y-3" data-testid="m20-fs-my-envelope">
                <p className="text-[13px] text-ink-2">{t('m20.fs.hub.envRunning', { pct: f.num(cur.pct), period: cur.period, cap: f.num(cur.cap_hours) })}</p>
                <EnvelopeMeter used={view.used} cap={view.cap} />
                <div className="flex flex-wrap gap-1">{(cur.channels ?? []).map((c) => <ChannelChip key={c} channel={c} />)}</div>
                <p className="text-[12.5px] text-ink-3">{t('m20.fs.hub.envRule')}</p>
              </div>
            ) : cur ? (
              <p className="text-[13px] text-ink-2">{t('m20.fs.hub.envPending', { period: cur.period })}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-ink-2">{t('m20.fs.hub.envNone')}</p>
                <L to="/opportunities/envelope" className="btn-primary btn-sm w-full justify-center">{t('m20.fs.hub.envAsk')}</L>
              </div>
            )}
          </Card>
          <Card title={t('m20.fs.hub.howTitle')}>
            <ol className="list-decimal space-y-1.5 ps-5 text-[13px] text-ink-2">
              <li>{t('m20.fs.hub.how1')}</li><li>{t('m20.fs.hub.how2')}</li><li>{t('m20.fs.hub.how3')}</li><li>{t('m20.fs.hub.how4')}</li>
            </ol>
          </Card>
          <Card title={t('m20.fs.hub.refsTitle')}>
            <ul className="space-y-2 text-[12.5px]" data-testid="m20-fs-refs">
              {FS27_REFS.map((r) => <li key={r.id}><SourceLink href={r.url} date={r.as_of}>{lang === 'ar' ? r.label_ar : r.label_en}</SourceLink></li>)}
            </ul>
          </Card>
        </aside>
      </div>

      {d.stats && <HrView d={d} />}
    </div>
  );
}

/** HR / auditor programme view: is the channel moving the share of opportunities that build future skills? */
function HrView({ d }: { d: FutureData }) {
  const t = useT();
  const f = useFormat();
  const s = d.stats!;
  // Measured baseline: ordinary (channel-less) open gigs that happen to grow a future skill (the card's "about 2 of 25").
  const fsSkills = new Set(d.skills.filter((x) => x.fs_area).map((x) => x.id));
  const plain = d.opps.filter((o) => !o.channel && o.status === 'open');
  const base = plain.length ? Math.round((plain.filter((o) => o.skills_gained.some((x) => fsSkills.has(x))).length / plain.length) * 100) : 0;
  return (
    <Section title={t('m20.fs.hr.title')} description={t('m20.fs.hr.sub', { min: f.num(s.min_group) })} actions={<SimChip label={t('m20.fs.hr.sim')} />}>
      <div data-testid="m20-fs-hr">
        <Grid cols={4}>
          <StatTile label={t('m20.fs.hr.share')} value={f.pct(s.share_open_future * 100)} sub={t('m20.fs.hr.shareSub', { n: f.num(s.open_future), all: f.num(s.open_all) })} tone="info" />
          <StatTile label={t('m20.fs.hr.envelopes')} value={f.num(s.envelopes.approved)} sub={s.envelopes.suppressed ? t('m20.fs.hr.suppressed') : t('m20.fs.hr.envelopesSub', { people: f.num(s.envelopes.people ?? 0), pct: f.num(s.envelopes.avg_pct ?? 0), requested: f.num(s.envelopes.requested) })} />
          <StatTile label={t('m20.fs.hr.via')} value={s.via_envelope.suppressed ? t('m20.fs.hr.suppressedShort') : f.num(s.via_envelope.applications ?? 0)} sub={s.via_envelope.suppressed ? t('m20.fs.hr.suppressed') : t('m20.fs.hr.viaSub', { people: f.num(s.via_envelope.people ?? 0), selected: f.num(s.via_envelope.selected ?? 0) })} />
          <StatTile label={t('m20.fs.hr.evidence')} value={f.num(s.evidence_rows)} sub={t('m20.fs.hr.evidenceSub')} />
        </Grid>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card><BarChart title={t('m20.fs.hr.byChannel')} data={s.channels.map((c) => ({ label: t(`m20.fs.channel.${c.channel}`), value: c.open }))} /></Card>
          <Card>
            <BenchmarkLine value={Math.round(s.share_open_future * 100)} max={100} unit="pct" label={t('m20.fs.hr.shareLine')} lines={[{ kind: 'enec', value: base, label: t('m20.fs.hr.baseline', { n: f.num(plain.filter((o) => o.skills_gained.some((x) => fsSkills.has(x))).length), all: f.num(plain.length) }) }]} />
            <p className="mt-2 text-[12.5px] text-ink-3">{t('m20.fs.hr.shareNote')}</p>
          </Card>
        </div>
        <Callout tone="info" title={t('m20.fs.hr.noRankTitle')}>{t('m20.fs.hr.noRank')}</Callout>
      </div>
    </Section>
  );
}
