// /opportunities/rotations/host (M20 · F15): the host desk. Placements I sign off (after the mid-point check-in; maker-checker:
// never the person, never a line manager who is also the host, whose sign-off goes to their own line manager), placements I host,
// and shadowing requests waiting for my consent as host or line manager, or for my confirmation that the shadowing took place.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Tabs, StatTile, Grid, Callout, Icon, ConfirmDialog } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { phaseOf } from './rotation';
import { useRotations, useRotLabels, PhasePill, SiteChip, ShadowPill, ConsentChips, ObjectiveList, objectivesOf, checkinOf, midOf, todayIso, usePlacementPeople, type RotData, type Placement, type ShadowReq } from './rotUi';
import { CheckinModal, CompleteShadowModal, SignoffPlacementModal } from './rotDialogs';

export default function HostDeskPage() {
  const t = useT();
  const { q, me } = useRotations();
  return (
    <Page title={t('m20.routes.rotations-host.title')} intro={t('m20.rot.host.intro')} wide
      actions={<L to="/opportunities/rotations" className="btn-outline btn-sm"><Icon name="grad" size={14} />{t('m20.rot.my.programmes')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Desk d={d} me={me} />}</Async>
    </Page>
  );
}

function Desk({ d, me }: { d: RotData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const today = todayIso();
  const open = (p: Placement) => p.status !== 'signed_off' && p.status !== 'cancelled';
  const toSign = d.placements.filter((p) => p.signer_id === me && p.person_id !== me && open(p) && p.starts_on <= today)
    .sort((a, b) => Number(!!checkinOf(b)) - Number(!!checkinOf(a)) || (a.ends_on < b.ends_on ? -1 : 1));
  const ready = toSign.filter((p) => !!checkinOf(p));
  const hosting = d.placements.filter((p) => p.host_manager_id === me && p.person_id !== me);
  const hostingNow = hosting.filter((p) => open(p) && p.starts_on <= today);
  const checkinsDue = d.placements.filter((p) => (p.host_manager_id === me || p.signer_id === me) && p.person_id !== me && open(p) && !checkinOf(p) && midOf(p) <= today);
  const consents = d.shadows.filter((r) => r.status === 'requested' && ((r.host_id === me && r.host_consent == null) || (r.line_manager_id === me && r.manager_consent == null)));
  const toConfirm = d.shadows.filter((r) => r.host_id === me && r.status === 'approved');
  const otherShadow = d.shadows.filter((r) => (r.host_id === me || r.line_manager_id === me) && r.person_id !== me && !consents.includes(r) && !toConfirm.includes(r));
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.rot.host.statSign')} value={f.num(ready.length)} tone={ready.length ? 'info' : undefined} sub={t('m20.rot.host.statSignSub', { n: f.num(toSign.length) })} />
        <StatTile label={t('m20.rot.host.statCheckins')} value={f.num(checkinsDue.length)} tone={checkinsDue.length ? 'bad' : undefined} sub={t('m20.rot.host.statCheckinsSub')} />
        <StatTile label={t('m20.rot.host.statHosting')} value={f.num(hostingNow.length)} sub={t('m20.rot.host.statHostingSub', { n: f.num(hosting.length) })} />
        <StatTile label={t('m20.rot.host.statConsent')} value={f.num(consents.length + toConfirm.length)} sub={t('m20.rot.host.statConsentSub')} />
      </Grid>
      <Callout title={t('m20.rot.host.makerTitle')}>{t('m20.rot.host.makerBody')}</Callout>
      <Tabs initial={toSign.length ? 'sign' : consents.length + toConfirm.length ? 'shadow' : 'hosting'} tabs={[
        { id: 'sign', label: t('m20.rot.host.tabSign'), badge: f.num(toSign.length), content: toSign.length === 0 ? <EmptyState icon="check" title={t('m20.rot.host.noSign')}>{t('m20.rot.host.noSignBody')}</EmptyState> : (
          <ul className="space-y-3" data-testid="m20-rot-signoffs">{toSign.map((p) => <HostPlacement key={p.id} p={p} d={d} me={me} today={today} />)}</ul>
        ) },
        { id: 'hosting', label: t('m20.rot.host.tabHosting'), badge: f.num(hosting.length), content: hosting.length === 0 ? <EmptyState icon="users" title={t('m20.rot.host.noHosting')} /> : (
          <ul className="space-y-3" data-testid="m20-rot-hosting">{[...hosting].sort((a, b) => Number(open(b)) - Number(open(a)) || (a.starts_on < b.starts_on ? 1 : -1)).map((p) => <HostPlacement key={p.id} p={p} d={d} me={me} today={today} />)}</ul>
        ) },
        { id: 'shadow', label: t('m20.rot.host.tabShadow'), badge: f.num(consents.length + toConfirm.length), content: consents.length + toConfirm.length + otherShadow.length === 0 ? <EmptyState icon="users" title={t('m20.rot.host.noShadow')} /> : (
          <div className="space-y-4">
            {[...consents, ...toConfirm].length > 0 && <ul className="space-y-3" data-testid="m20-rot-consents">{[...consents, ...toConfirm].map((r) => <ShadowCard key={r.id} r={r} d={d} me={me} today={today} />)}</ul>}
            {otherShadow.length > 0 && (
              <details className="rounded-card border border-line p-3">
                <summary className="cursor-pointer font-semibold">{t('m20.rot.host.decided', { n: f.num(otherShadow.length) })}</summary>
                <ul className="mt-3 space-y-3">{otherShadow.map((r) => <ShadowCard key={r.id} r={r} d={d} me={me} today={today} />)}</ul>
              </details>
            )}
          </div>
        ) },
      ]} />
    </div>
  );
}

function HostPlacement({ p, d, me, today }: { p: Placement; d: RotData; me: string | null; today: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const who = usePlacementPeople();
  const [ck, setCk] = useState(false);
  const [so, setSo] = useState(false);
  const checkin = checkinOf(p);
  const isOpen = p.status !== 'signed_off' && p.status !== 'cancelled';
  const canSign = isOpen && p.signer_id === me && !!checkin && p.starts_on <= today;
  const hostIsLm = p.host_manager_id === me && p.line_manager_id === me;
  return (
    <li className="card p-4" data-testid="m20-rot-host-placement">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{who(p, p.person_id)} <span className="font-normal text-ink-3">· {lab.role(p.person_role_id)}</span></div>
          <div className="text-[13px] text-ink-2">{lab.template(p.template_id)} · {t('m20.rot.my.placementN', { n: f.num(p.seq) })}: {pick(p, 'host_team')}</div>
          <div className="text-[12px] text-ink-3">{f.date(p.starts_on)} – {f.date(p.ends_on)} · {lab.cohort(p.cohort_id)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5"><PhasePill p={p} today={today} />{p.site_induction && <SiteChip />}</div>
      </div>
      {p.skip_level && p.signer_id === me && <div className="mt-2 chip border-info-line bg-info-bg text-info">{t('m20.rot.host.skipYou')}</div>}
      {hostIsLm && <div className="mt-2 chip border-sim-line bg-sim-bg text-sim">{t('m20.rot.host.hostIsLm')}</div>}
      <div className="mt-3"><ObjectiveList objectives={objectivesOf(p)} lab={lab} progress={checkin?.progress} achieved={p.status === 'signed_off' ? (p.outcome_levels as unknown as Record<string, number>) : null} /></div>
      <p className="mt-2 text-[12.5px] text-ink-2">{checkin ? <>{t('m20.rot.my.checkinDone', { d: f.date(checkin.at), by: who(p, checkin.by) })}{checkin.note ? ` · “${checkin.note}”` : ''}</> : t('m20.rot.my.checkinDue', { d: f.date(midOf(p)) })}</p>
      {p.status === 'signed_off' && <p className="mt-1 text-[12.5px] text-ok">{t('m20.rot.my.signedOff', { d: f.date(p.signed_off_at), n: f.num(p.evidence_ids?.length ?? 0) })}</p>}
      {isOpen && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!checkin && p.starts_on <= today && <button className="btn-outline btn-sm" onClick={() => setCk(true)} data-testid="m20-rot-host-checkin"><Icon name="calendar" size={14} />{t('m20.rot.my.recordCheckin')}</button>}
          {p.signer_id === me && <button className="btn-primary btn-sm" disabled={!canSign} title={!checkin ? t('m20.rot.host.checkinFirst') : undefined} onClick={() => setSo(true)} data-testid="m20-rot-signoff"><Icon name="check" size={14} />{t('m20.rot.host.signoff')}</button>}
          {phaseOf(p, today) === 'overdue' && <span className="self-center text-[12.5px] text-bad">{t('m20.rot.host.overdue')}</span>}
        </div>
      )}
      {ck && <CheckinModal p={p} lab={lab} onClose={() => setCk(false)} />}
      {so && <SignoffPlacementModal p={p} lab={lab} onClose={() => setSo(false)} />}
    </li>
  );
}

function ShadowCard({ r, d, me, today }: { r: ShadowReq; d: RotData; me: string | null; today: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const repo = useRepo();
  const run = useAction();
  const [act, setAct] = useState<'approve' | 'decline' | null>(null);
  const [done, setDone] = useState(false);
  const asHost = r.host_id === me;
  const asMgr = r.line_manager_id === me;
  const mine = r.status === 'requested' && ((asHost && r.host_consent == null) || (asMgr && r.manager_consent == null));
  const role = asHost && asMgr ? t('m20.rot.consent.both') : asHost ? t('m20.rot.consent.host') : t('m20.rot.consent.manager');
  return (
    <li className="card p-4" data-testid="m20-rot-shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{pick({ name_en: r.person_name, name_ar: r.person_name_ar }, 'name')} <span className="font-normal text-ink-3">· {lab.role(r.person_role_id)}</span></div>
          <div className="text-[12.5px] text-ink-3">{t('m20.rot.host.shadowing', { host: pick({ name_en: r.host_name, name_ar: r.host_name_ar }, 'name') })} · {f.date(r.start_on)} · {t('m20.rot.common.days', { n: f.num(r.days) })}</div>
          <div className="mt-0.5 text-[12px] text-ink-3">{t('m20.rot.host.youAre', { role })}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5"><ShadowPill status={r.status} />{r.site_induction && <SiteChip />}</div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">{r.skill_ids.map((s) => <li key={s} className="chip border-accent/30 bg-accent-soft text-eyebrow">{lab.skill(s)}</li>)}</ul>
      <p className="mt-2 text-[13px] text-ink-2">“{r.purpose}”</p>
      <div className="mt-2"><ConsentChips r={r} /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {mine && <>
          <button className="btn-primary btn-sm" onClick={() => setAct('approve')} data-testid="m20-rot-consent">{t('m20.rot.host.consent')}</button>
          <button className="btn-outline btn-sm" onClick={() => setAct('decline')}>{t('m20.rot.host.decline')}</button>
        </>}
        {asHost && r.status === 'approved' && (r.start_on <= today
          ? <button className="btn-primary btn-sm" onClick={() => setDone(true)} data-testid="m20-rot-complete"><Icon name="check" size={14} />{t('m20.rot.host.complete')}</button>
          : <span className="text-[12.5px] text-ink-3">{t('m20.rot.host.completeLater', { d: f.date(r.start_on) })}</span>)}
      </div>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act === 'decline' ? t('m20.rot.host.declineTitle') : t('m20.rot.host.consentTitle')}
        consequence={act === 'decline' ? t('m20.rot.host.declineBody') : asHost && asMgr ? t('m20.rot.host.consentBothBody') : t('m20.rot.host.consentBody')} actingAs={role}
        requireReason={act === 'decline'} reasonLabel={t('m20.rot.host.declineReason')} danger={act === 'decline'} confirmLabel={act === 'decline' ? t('m20.rot.host.decline') : t('m20.rot.host.consent')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.decideShadow(r.id, act, reason)); }} />
      {done && <CompleteShadowModal r={r} onClose={() => setDone(false)} />}
    </li>
  );
}
