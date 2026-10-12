// /communities/women-in-nuclear (M22 · FS48): women in future nuclear skills. Three ways to take part: mentor circles, visiting
// placements (the Lise Meitner pattern) and sponsored study with a placement (the IAEA MSCFP pattern). Participation is opt-in and
// withdrawable at any time; withdrawing ends my circle seats and open requests and removes me from every ranking. Circles and offers
// are ranked only from the future-skill areas and ways to take part I chose (rankCircles, rankOffers, with "Why this?"); gender is
// never an input. HR sees aggregates only, on the programme page.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, WhyThis, BenchmarkChips, Modal, ConfirmDialog, CheckboxField, Icon, StatusPill } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { WFN_INTERESTS, WFN_MAX_OPEN_REQUESTS, WFN_STRANDS, circleMembersView, rankCircles, rankOffers, wfnArea } from './future';
import { RequestPill, useArea } from './fsui';
import { Sources } from './ui';

type Participant = RowOf<'wfn_participants'>;
type Circle = RowOf<'wfn_circles'>;
type Offer = RowOf<'wfn_offers'>;
type Member = RowOf<'wfn_circle_members'>;
type Req = RowOf<'wfn_requests'>;

function useNetwork() {
  const repo = useRepo();
  const me = useSession().identity.personId;
  return useQuery(['wfn_programmes', 'wfn_participants', 'wfn_circles', 'wfn_circle_members', 'wfn_offers', 'wfn_requests'], async () => {
    const [programmes, parts, circles, members, offers, requests] = await Promise.all([
      repo.list('wfn_programmes', { order: [['sort', 'asc']] }),
      me ? repo.list('wfn_participants', { filter: { person_id: me } }).catch(() => [] as Participant[]) : Promise.resolve([] as Participant[]),
      repo.list('wfn_circles', { order: [['sort', 'asc']] }).catch(() => [] as Circle[]),
      repo.list('wfn_circle_members').catch(() => [] as Member[]),
      repo.list('wfn_offers', { order: [['sort', 'asc']] }).catch(() => [] as Offer[]),
      me ? repo.list('wfn_requests', { filter: { person_id: me }, order: [['updated_at', 'desc']] }).catch(() => [] as Req[]) : Promise.resolve([] as Req[]),
    ]);
    return { programmes, me: parts[0] ?? null, circles, members, offers, requests };
  }, [me]);
}
type Net = NonNullable<ReturnType<typeof useNetwork>['data']>;

export default function WomenInNuclearPage() {
  const t = useT();
  const s = useSession();
  const q = useNetwork();
  const hr = s.hasRole('hr_analyst', 'hr_director', 'training_manager', 'auditor');
  return (
    <Page title={t('m22.routes.communities-women.title')} intro={t('m22.wfn.intro')} eyebrow={<L to="/communities">{t('m22.wfn.back')}</L>} wide
      actions={hr ? <L to="/communities/women-in-nuclear/programme" className="btn-outline btn-sm" data-testid="m22-wfn-programme-link"><Icon name="chart" size={14} />{t('m22.wfn.programmeLink')}</L> : undefined}>
      <div className="space-y-8">
        <BenchmarkChips feature="FS48" />
        <Async state={q}>
          {(d) => (
            <>
              <Strands d={d} />
              <OptIn d={d} />
              {d.me?.active && <Ranked d={d} p={d.me} />}
              {d.requests.length > 0 && <MyRequests d={d} />}
            </>
          )}
        </Async>
        <Callout title={t('m22.wfn.privacyTitle')}>{t('m22.wfn.privacyBody')}</Callout>
      </div>
    </Page>
  );
}

function Strands({ d }: { d: Net }) {
  const t = useT();
  const pick = usePick();
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m22-wfn-strands">
      {d.programmes.map((g) => (
        <li key={g.id} className="card space-y-2 p-4">
          <div className="flex items-center gap-2 font-semibold"><Icon name={g.strand === 'circles' ? 'users' : g.strand === 'visiting' ? 'globe' : 'grad'} size={16} className="text-accent" />{pick(g, 'title')}</div>
          <p className="text-[13px]">{pick(g, 'summary')}</p>
          <p className="text-[12.5px] text-ink-2">{pick(g, 'pattern')}</p>
          <p className="text-[12px] text-ink-3">{pick(g, 'fact')}</p>
          <Sources sources={g.sources} />
          <span className="sr-only">{t(`m22.wfn.strand.${g.strand}`)}</span>
        </li>
      ))}
    </ul>
  );
}

function OptIn({ d }: { d: Net }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const area = useArea();
  const p = d.me;
  const [interests, setInterests] = useState<string[]>(p?.active ? p.interests : []);
  const [strands, setStrands] = useState<string[]>(p?.active ? p.strands : ['circles']);
  const [mentor, setMentor] = useState<boolean>(!!p?.active && p.mentor);
  const [withdraw, setWithdraw] = useState(false);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const valid = interests.length >= 1 && interests.length <= 4 && strands.length >= 1;
  return (
    <Section title={t('m22.wfn.optTitle')} description={p?.active ? t('m22.wfn.optActive', { date: f.date(p.joined_on) }) : t('m22.wfn.optSub')}>
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="m22-wfn-optin">
          <fieldset className="space-y-1.5">
            <legend className="caps mb-1">{t('m22.wfn.interests')}</legend>
            {WFN_INTERESTS.map((a) => <CheckboxField key={a} label={area(a)} checked={interests.includes(a)} onChange={() => setInterests((x) => toggle(x, a))} />)}
            <span className="text-[12px] text-ink-3">{t('m22.wfn.interestsHint')}</span>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="caps mb-1">{t('m22.wfn.strands')}</legend>
            {WFN_STRANDS.map((x) => <CheckboxField key={x} label={t(`m22.wfn.strand.${x}`)} checked={strands.includes(x)} onChange={() => setStrands((y) => toggle(y, x))} />)}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="caps mb-1">{t('m22.wfn.mentorTitle')}</legend>
            <CheckboxField label={t('m22.wfn.mentor')} checked={mentor} onChange={setMentor} hint={t('m22.wfn.mentorHint')} />
          </fieldset>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary btn-sm" disabled={!valid} onClick={() => run(() => repo.rpc.setWfnOptin({ active: true, interests, strands, mentor }))} data-testid="m22-wfn-save">
            <Icon name="check" size={14} />{p?.active ? t('m22.wfn.update') : t('m22.wfn.join')}
          </button>
          {p?.active && <button className="btn-outline btn-sm" onClick={() => setWithdraw(true)} data-testid="m22-wfn-withdraw">{t('m22.wfn.withdraw')}</button>}
          {p && !p.active && p.withdrawn_on && <span className="text-[12.5px] text-ink-3">{t('m22.wfn.withdrawnOn', { date: f.date(p.withdrawn_on) })}</span>}
        </div>
      </Card>
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} danger title={t('m22.wfn.withdrawTitle')} consequence={t('m22.wfn.withdrawBody')} confirmLabel={t('m22.wfn.withdraw')}
        onConfirm={async () => { const r = await run(() => repo.rpc.setWfnOptin({ active: false })); if (r.ok) { setInterests([]); setMentor(false); } }} />
    </Section>
  );
}

function Ranked({ d, p }: { d: Net; p: Participant }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const area = useArea();
  const today = todayIso();
  // staff read only their own memberships; the circle flags (is_full, mentor_open) stand in for everyone else's
  const members = useMemo(() => circleMembersView(d.circles, d.members), [d.circles, d.members]);
  const circles = useMemo(() => rankCircles(p, d.circles, members, wfnArea), [p, d.circles, members]);
  const offers = useMemo(() => rankOffers(p, d.offers, d.requests, today, wfnArea), [p, d.offers, d.requests, today]);
  const open = d.requests.filter((r) => ['interested', 'shortlisted'].includes(r.status)).length;
  const [ask, setAsk] = useState<Offer | null>(null);
  const [statement, setStatement] = useState('');
  const myCircle = (cid: string) => d.members.some((m) => m.circle_id === cid && m.person_id === p.person_id && m.active);
  return (
    <>
      {p.strands.includes('circles') && (
        <Section title={t('m22.wfn.circlesTitle')} description={t('m22.wfn.circlesSub')}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-wfn-circles">
            {circles.map((r) => {
              const c = r.item!;
              const mine = myCircle(c.id);
              const full = !!(c as Circle).is_full;
              const mentorSeat = p.mentor && (c as Circle).mentor_open;
              return (
                <li key={c.id} className="card space-y-2 p-4" data-testid="m22-wfn-circle">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-semibold">{pick(c as Circle, 'title')}</div>
                    {mine ? <StatusPill tone="ok">{t('m22.wfn.inCircle')}</StatusPill> : <StatusPill tone={full ? 'neutral' : 'info'}>{full ? t('m22.wfn.full') : t('m22.wfn.open')}</StatusPill>}
                  </div>
                  <div className="text-[12.5px] text-ink-2">{pick(c as Circle, 'mentor_role')} · {pick(c as Circle, 'cadence')}</div>
                  <div className="flex flex-wrap gap-1.5">{c.focus.map((a) => <span key={a} className="chip border-line bg-panel text-ink-2">{area(a)}</span>)}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mine ? <button className="btn-outline btn-sm" onClick={() => run(() => repo.rpc.joinWfnCircle(c.id, false))}>{t('m22.wfn.leave')}</button>
                      : <button className="btn-primary btn-sm" disabled={full && !mentorSeat} onClick={() => run(() => repo.rpc.joinWfnCircle(c.id, true))} data-testid="m22-wfn-join-circle">{t('m22.wfn.joinCircle')}</button>}
                    <WhyThis reasons={r.reasons} testId="m22-why-circle" />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {(p.strands.includes('visiting') || p.strands.includes('sponsored') || offers.length > 0) && (
        <Section title={t('m22.wfn.offersTitle')} description={t('m22.wfn.offersSub', { n: WFN_MAX_OPEN_REQUESTS, open })}>
          {offers.length === 0 ? <EmptyState icon="globe" title={t('m22.wfn.noOffers')} /> : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-wfn-offers">
              {offers.map((r) => {
                const o = r.item as Offer;
                const requested = d.requests.some((q) => q.offer_id === o.id && !['declined', 'withdrawn'].includes(q.status));
                return (
                  <li key={o.id} className="card space-y-2 p-4" data-testid="m22-wfn-offer">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="font-semibold">{pick(o, 'title')}</div>
                      <StatusPill tone="accent">{t(`m22.wfn.strand.${o.strand}`)}</StatusPill>
                    </div>
                    <div className="text-[12.5px] text-ink-2">{pick(o, 'host')}</div>
                    <p className="text-[13px]">{pick(o, 'placement')}</p>
                    <div className="text-[12px] text-ink-3">{o.weeks ? t('m22.wfn.weeks', { n: f.num(o.weeks) }) : t('m22.wfn.months', { n: f.num(o.months ?? 0) })} · {t('m22.wfn.closes', { date: f.date(o.closes_on) })}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="btn-primary btn-sm" disabled={requested || open >= WFN_MAX_OPEN_REQUESTS} onClick={() => { setAsk(o); setStatement(''); }} data-testid="m22-wfn-request">{requested ? t('m22.wfn.requested') : t('m22.wfn.request')}</button>
                      <WhyThis reasons={r.reasons} testId="m22-why-offer" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask ? pick(ask, 'title') : ''}
        footer={<>
          <button className="btn-outline" onClick={() => setAsk(null)}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={statement.trim().length < 20 || statement.trim().length > 600} data-testid="m22-wfn-request-confirm"
            onClick={async () => { if (!ask) return; const r = await run(() => repo.rpc.requestWfnOffer(ask.id, statement.trim())); if (r.ok) setAsk(null); }}>{t('m22.wfn.send')}</button>
        </>}>
        <label className="block">
          <span className="caps">{t('m22.wfn.statement')}</span>
          <textarea className="input mt-1" rows={4} maxLength={600} value={statement} onChange={(e) => setStatement(e.target.value)} data-testid="m22-wfn-statement" />
          <span className="text-[12px] text-ink-3">{t('m22.wfn.statementHint')}</span>
        </label>
      </Modal>
    </>
  );
}

function MyRequests({ d }: { d: Net }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <Section title={t('m22.wfn.myRequests')}>
      <ul className="space-y-2" data-testid="m22-wfn-my-requests">
        {d.requests.map((r) => {
          const o = d.offers.find((x) => x.id === r.offer_id);
          return (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <div className="font-semibold">{o ? pick(o, 'title') : r.offer_id}</div>
                <div className="text-[12.5px] text-ink-2">{f.date(r.created_at)}{r.outcome ? ` · ${t(`m22.wfn.outcome.${r.outcome}`)}` : ''}{r.note ? ` · ${r.note}` : ''}</div>
              </div>
              <RequestPill status={r.status} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
