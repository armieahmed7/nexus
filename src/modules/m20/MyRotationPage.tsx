// /opportunities/rotations/my (M20 · F15): my placement plan (sequence, host, objectives with my current level, mid-point
// check-in, host sign-off and the skills evidence it wrote) and my shadowing requests with their consent status.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Tabs, StatTile, Grid, Callout, Icon, ConfirmDialog, ProgressRing, KeyValue } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { phaseOf } from './rotation';
import { useRotations, useRotLabels, ProgrammeChip, PlacementRail, ObjectiveList, PhasePill, SiteChip, ShadowPill, ConsentChips, objectivesOf, checkinOf, midOf, todayIso, usePlacementPeople, type RotData, type Placement, type ShadowReq } from './rotUi';
import { CheckinModal } from './rotDialogs';

export default function MyRotationPage() {
  const t = useT();
  const { q, me } = useRotations();
  return (
    <Page title={t('m20.routes.rotations-my.title')} intro={t('m20.rot.my.intro')} wide
      actions={<><L to="/opportunities/rotations" className="btn-outline btn-sm"><Icon name="grad" size={14} />{t('m20.rot.my.programmes')}</L><L to="/opportunities/rotations/shadow" className="btn-primary btn-sm"><Icon name="plus" size={14} />{t('m20.rot.hub.requestShadow')}</L></>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Mine d={d} me={me} />}</Async>
    </Page>
  );
}

function Mine({ d, me }: { d: RotData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const [sp, setSp] = useSearchParams();
  const today = todayIso();
  const mine = d.placements.filter((p) => p.person_id === me);
  const enrolments = [...new Set(mine.map((p) => p.enrolment_id))];
  const shadows = d.shadows.filter((r) => r.person_id === me);
  const evidence = mine.reduce((a, p) => a + (p.evidence_ids?.length ?? 0), 0) + shadows.reduce((a, r) => a + (r.evidence_ids?.length ?? 0), 0);
  const tab = sp.get('tab') === 'shadow' ? 'shadow' : 'plan';
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.rot.my.statPlacements')} value={f.num(mine.length)} sub={t('m20.rot.my.statPlacementsSub', { n: f.num(mine.filter((p) => p.status === 'signed_off').length) })} />
        <StatTile label={t('m20.rot.my.statNow')} value={f.num(mine.filter((p) => phaseOf(p, today) === 'in_progress').length)} tone="info" sub={t('m20.rot.my.statNowSub')} />
        <StatTile label={t('m20.rot.my.statShadow')} value={f.num(shadows.filter((r) => r.status === 'requested' || r.status === 'approved').length)} sub={t('m20.rot.my.statShadowSub', { n: f.num(shadows.filter((r) => r.status === 'completed').length) })} />
        <StatTile label={t('m20.rot.my.statEvidence')} value={f.num(evidence)} tone="ok" sub={<L to="/my/skills">{t('m20.rot.my.openPassport')}</L>} />
      </Grid>
      <Tabs value={tab} onChange={(id) => setSp(id === 'shadow' ? { tab: 'shadow' } : {}, { replace: true })} tabs={[
        { id: 'plan', label: t('m20.rot.my.tabPlan'), badge: f.num(mine.length), content: enrolments.length === 0 ? (
          <EmptyState icon="grad" title={t('m20.rot.my.noPlan')} action={<L to="/opportunities/rotations" className="btn-outline btn-sm">{t('m20.rot.my.programmes')}</L>}>{t('m20.rot.my.noPlanBody')}</EmptyState>
        ) : <div className="space-y-6" data-testid="m20-rot-plan">{enrolments.map((e) => <Enrolment key={e} d={d} rows={mine.filter((p) => p.enrolment_id === e)} me={me} today={today} />)}</div> },
        { id: 'shadow', label: t('m20.rot.my.tabShadow'), badge: f.num(shadows.length), content: shadows.length === 0 ? (
          <EmptyState icon="users" title={t('m20.rot.my.noShadow')} action={<L to="/opportunities/rotations/shadow" className="btn-primary btn-sm">{t('m20.rot.hub.requestShadow')}</L>}>{t('m20.rot.my.noShadowBody')}</EmptyState>
        ) : <ul className="space-y-3" data-testid="m20-rot-my-shadow">{shadows.map((r) => <ShadowItem key={r.id} r={r} d={d} />)}</ul> },
      ]} />
      <Callout tone="sim" title={t('m20.rot.common.mirrorTitle')}>{t('m20.rot.common.mirrorBody')}</Callout>
    </div>
  );
}

function Enrolment({ d, rows, me, today }: { d: RotData; rows: Placement[]; me: string | null; today: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const tpl = d.templates.find((x) => x.id === sorted[0].template_id);
  const done = sorted.filter((p) => p.status === 'signed_off').length;
  return (
    <section className="space-y-3">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <ProgressRing value={Math.round((100 * done) / sorted.length)} size={60} label={`${f.num(done)}/${f.num(sorted.length)}`} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1.5">{tpl && <ProgrammeChip programme={tpl.programme} />}<span className="chip border-line bg-sunken text-ink-2">{lab.cohort(sorted[0].cohort_id)}</span></div>
            <h2 className="text-[16px] font-semibold">{tpl ? <L to={`/opportunities/rotations/programmes/${tpl.id}`} className="link-plain hover:underline">{pick(tpl, 'title')}</L> : lab.template(sorted[0].template_id)}</h2>
            <div className="text-[12.5px] text-ink-2">{f.date(sorted[0].starts_on)} – {f.date(sorted[sorted.length - 1].ends_on)}</div>
          </div>
        </div>
        <div className="mt-3"><PlacementRail lab={lab} today={today} steps={sorted.map((p) => ({ key: p.id, family_id: p.family_id, months: Math.max(1, Math.round((Date.parse(p.ends_on) - Date.parse(p.starts_on)) / (30.4 * 86_400_000))), title: pick(p, 'host_team'), starts_on: p.starts_on, ends_on: p.ends_on, status: p.status }))} /></div>
      </Card>
      <ol className="space-y-3">{sorted.map((p) => <PlacementCard key={p.id} p={p} d={d} me={me} today={today} />)}</ol>
    </section>
  );
}

function PlacementCard({ p, d, me, today }: { p: Placement; d: RotData; me: string | null; today: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const who = usePlacementPeople();
  const [ck, setCk] = useState(false);
  const lv = new Map(d.states.map((s) => [s.skill_id, s.level]));
  const checkin = checkinOf(p);
  const ph = phaseOf(p, today);
  const canCheckin = !checkin && p.status !== 'signed_off' && p.status !== 'cancelled' && p.starts_on <= today && [p.person_id, p.host_manager_id, p.signer_id].includes(me ?? '');
  return (
    <li className="card p-4" data-testid="m20-rot-placement">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="caps">{t('m20.rot.my.placementN', { n: f.num(p.seq) })} · {lab.family(p.family_id)}</div>
          <h3 className="text-[15px] font-semibold">{pick(p, 'host_team')}</h3>
          <div className="text-[12.5px] text-ink-3">{f.date(p.starts_on)} – {f.date(p.ends_on)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5"><PhasePill p={p} today={today} />{p.site_induction && <SiteChip />}</div>
      </div>
      <div className="mt-3">
        <KeyValue items={[
          [t('m20.rot.my.host'), <>{pick({ name_en: p.host_name, name_ar: p.host_name_ar }, 'name') || t('m20.rot.common.hostManager')}{p.host_role_id ? <span className="text-ink-3"> · {lab.role(p.host_role_id)}</span> : null}</>],
          [t('m20.rot.my.signer'), p.skip_level ? <span>{t('m20.rot.common.skipSigner')} <span className="chip border-info-line bg-info-bg text-info">{t('m20.rot.common.makerChecker')}</span></span> : t('m20.rot.common.hostManager')],
          [t('m20.rot.my.checkin'), checkin ? t('m20.rot.my.checkinDone', { d: f.date(checkin.at), by: who(p, checkin.by) }) : t('m20.rot.my.checkinDue', { d: f.date(midOf(p)) })],
        ]} />
      </div>
      <div className="mt-3"><ObjectiveList objectives={objectivesOf(p)} lab={lab} myLevel={(s) => lv.get(s) ?? 0} progress={checkin?.progress} achieved={p.status === 'signed_off' ? (p.outcome_levels as unknown as Record<string, number>) : null} /></div>
      {checkin?.note && <p className="mt-2 text-[13px] text-ink-2"><span className="caps">{t('m20.rot.my.checkinNote')}</span> “{checkin.note}”</p>}
      {p.status === 'signed_off' && (
        <div className="mt-3 rounded-btn border border-ok-line bg-ok-bg/60 p-3 text-[13px]">
          <div className="font-semibold text-ok"><Icon name="check" size={13} /> {t('m20.rot.my.signedOff', { d: f.date(p.signed_off_at), n: f.num(p.evidence_ids?.length ?? 0) })}</div>
          {p.outcome_note && <p className="mt-1 text-ink-2">“{p.outcome_note}”</p>}
          <L to="/my/skills" className="mt-1 inline-block text-[12.5px]">{t('m20.rot.my.openPassport')}</L>
        </div>
      )}
      {ph === 'overdue' && p.status !== 'signed_off' && <p className="mt-2 text-[12.5px] text-bad">{checkin ? t('m20.rot.my.awaitingSignoff') : t('m20.rot.my.overdueNoCheckin')}</p>}
      {canCheckin && <div className="mt-3"><button className="btn-primary btn-sm" onClick={() => setCk(true)} data-testid="m20-rot-checkin"><Icon name="calendar" size={14} />{t('m20.rot.my.recordCheckin')}</button></div>}
      {ck && <CheckinModal p={p} lab={lab} onClose={() => setCk(false)} />}
    </li>
  );
}

function ShadowItem({ r, d }: { r: ShadowReq; d: RotData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const repo = useRepo();
  const run = useAction();
  const [w, setW] = useState(false);
  return (
    <li className="card p-4" data-testid="m20-rot-shadow-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{t('m20.rot.my.shadowWith', { name: pick({ name_en: r.host_name, name_ar: r.host_name_ar }, 'name') })}</div>
          <div className="text-[12.5px] text-ink-3">{lab.role(r.host_role_id)} · {lab.family(r.host_family_id)} · {f.date(r.start_on)} · {t('m20.rot.common.days', { n: f.num(r.days) })}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5"><ShadowPill status={r.status} />{r.site_induction && <SiteChip />}</div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">{r.skill_ids.map((s) => <li key={s} className="chip border-accent/30 bg-accent-soft text-eyebrow">{lab.skill(s)}</li>)}</ul>
      <p className="mt-2 text-[13px] text-ink-2">“{r.purpose}”</p>
      <div className="mt-2"><ConsentChips r={r} /></div>
      {(r.host_note || r.manager_note) && r.status === 'declined' && <p className="mt-2 text-[12.5px] text-bad">{r.host_note || r.manager_note}</p>}
      {r.status === 'completed' && <p className="mt-2 text-[13px] text-ok"><Icon name="check" size={13} /> {t('m20.rot.my.shadowDone', { n: f.num(r.evidence_ids?.length ?? 0) })}{r.reflection ? ` “${r.reflection}”` : ''}</p>}
      {(r.status === 'requested' || r.status === 'approved') && <div className="mt-2"><button className="btn-ghost btn-sm" onClick={() => setW(true)} data-testid="m20-rot-withdraw">{t('m20.rot.my.withdraw')}</button></div>}
      <ConfirmDialog open={w} onClose={() => setW(false)} title={t('m20.rot.my.withdrawTitle')} consequence={t('m20.rot.my.withdrawBody')} danger confirmLabel={t('m20.rot.my.withdraw')}
        onConfirm={async () => { await run(() => repo.rpc.decideShadow(r.id, 'withdraw', '')); }} />
    </li>
  );
}
