// /training/instructors/:trackId (M02 · F31): one instructor track. Stage stepper, the card's requirements as a checklist (two co-teach
// and one solo observation by three different observers), observations with checklist scores, annual currency (hours and continuing
// development against the minimum, 90/60/30-day notices), the teaching hours chart and log, evaluator rows written on qualification,
// and the actions the viewer may take (record an observation, accept or decline, qualify or reinstate: maker-checker; close; log hours).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Grid, Card, Async, EmptyState, KeyValue, ConfirmDialog, Icon, Callout, WhyThis } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { Reason } from '../../domain/engines/types';
import { qualifyingSet, reinstateObservation } from './instructors';
import {
  CurrencyCard, HoursChart, LogHoursModal, MirrorNote, ObservationList, ObservationModal, Requirements, RouteChip, StagePill, StageStepper, StdChips, useInsData, useNamePick,
  type InsData, type TrackView,
} from './instructorUi';

export default function InstructorTrackPage() {
  const t = useT();
  const { trackId = '' } = useParams();
  const q = useInsData();
  return (
    <Async state={q}>
      {(d) => {
        const v = d.views.get(trackId);
        if (!v) return <Page title={t('m02.routes.training-instructor.title')}><EmptyState icon="search" title={t('m02.ins.track.notFound')} action={<L to="/training/instructors" className="btn-outline btn-sm">{t('m02.ins.track.back')}</L>} /></Page>;
        return <TrackBody v={v} d={d} />;
      }}
    </Async>
  );
}

function TrackBody({ v, d }: { v: TrackView; d: InsData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const nm = useNamePick();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const me = s.identity.personId;
  const isTm = s.can('sat', ['A']);
  const own = v.track.person_id === me;
  const [observe, setObserve] = useState(false);
  const [act, setAct] = useState<'accept' | 'decline' | 'qualify' | 'withdraw' | null>(null);
  const [log, setLog] = useState(false);
  const eq = useQuery('evaluator_quals', () => repo.list('evaluator_quals', { filter: { person_id: v.track.person_id } }).catch(() => []), [v.track.person_id]);
  const tr = v.track;
  const name = nm(tr.person_name, tr.person_name_ar);
  const open = ['active', 'qualified', 'lapsed'].includes(tr.status);
  const canObserve = s.can('sat', ['W']) && !own && open && !!v.next && (v.next === 'currency' || tr.status === 'active') && !(tr.status === 'active' && v.stage === 'ready');
  const ready = tr.status === 'active' && v.stage === 'ready';
  const lapsedReady = tr.status === 'lapsed' && !!reinstateObservation(v.obs as never, tr.lapsed_on);
  const makerBlocked = (ready && !qualifyingSet(v.obs as never, me)) || (lapsedReady && !reinstateObservation(v.obs as never, tr.lapsed_on, me));
  // why this person is (or is not yet) ready: the qualifying set as reasons for <WhyThis>
  const setReasons: Reason[] = v.qualSet
    ? [...v.qualSet.co, v.qualSet.solo].map((o) => ({ code: 'ins_obs', key: 'm02.reasons.ins_obs', vars: { kind: { en: o.kind === 'solo' ? 'Solo' : 'Co-teach', ar: o.kind === 'solo' ? 'التدريس المنفرد' : 'التدريس المشترك' }, name: { en: o.observer_name ?? '', ar: o.observer_name_ar || o.observer_name || '' }, score: o.score, date: o.observed_on }, ref: { table: 'instructor_observations', id: o.id } }))
    : [];
  return (
    <Page title={name} eyebrow={t('m02.routes.training-instructor.title')} intro={t('m02.ins.track.intro')} wide
      actions={<L to="/training/instructors" className="btn-ghost btn-sm"><Icon name="back" size={13} className="me-1 inline rtl:-scale-x-100" />{t('m02.ins.track.back')}</L>}>
      <div className="space-y-6" data-testid="m02-ins-track">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2"><StagePill v={v} /><RouteChip route={tr.route} /><StdChips ids={tr.standard_ids} d={d} /></div>
            <div className="flex flex-wrap gap-2">
              {canObserve && <button type="button" className="btn-primary btn-sm" onClick={() => setObserve(true)} data-testid="m02-ins-observe">{t('m02.ins.act.observe')}</button>}
              {isTm && !own && tr.status === 'active' && !tr.accepted_on && <>
                <button type="button" className="btn-outline btn-sm" onClick={() => setAct('decline')} data-testid="m02-ins-decline">{t('m02.ins.act.decline')}</button>
                <button type="button" className="btn-primary btn-sm" onClick={() => setAct('accept')} data-testid="m02-ins-accept">{t('m02.ins.act.accept')}</button>
              </>}
              {isTm && !own && (ready || lapsedReady) && <button type="button" className="btn-primary btn-sm" onClick={() => setAct('qualify')} data-testid="m02-ins-qualify">{t(lapsedReady ? 'm02.ins.act.reinstate' : 'm02.ins.act.qualify')}</button>}
              {isTm && open && <button type="button" className="btn-outline btn-sm" onClick={() => setLog(true)} data-testid="m02-ins-log">{t('m02.ins.act.logHours')}</button>}
              {(isTm || own) && open && <button type="button" className="btn-ghost btn-sm" onClick={() => setAct('withdraw')} data-testid="m02-ins-withdraw">{t('m02.ins.act.withdraw')}</button>}
            </div>
          </div>
          <div className="mt-4"><StageStepper v={v} /></div>
          {own && <p className="mt-3 text-[12.5px] text-sim" data-testid="m02-ins-own">{t('m02.ins.track.ownNote')}</p>}
          {isTm && makerBlocked && <div className="mt-3"><Callout tone="sim" title={t('m02.ins.track.makerTitle')}>{t('m02.ins.track.makerBody')}</Callout></div>}
        </Card>
        <Grid cols={2}>
          <Card title={t('m02.ins.track.requirements')} actions={setReasons.length ? <WhyThis reasons={setReasons} label={t('m02.ins.track.whyReady')} testId="m02-ins-why-ready" /> : undefined}>
            <Requirements v={v} d={d} />
          </Card>
          <Card title={t('m02.ins.track.details')}>
            <KeyValue items={[
              [t('m02.ins.track.discipline'), tr.discipline || '—'],
              [t('m02.ins.track.standards'), <span key="s" className="space-y-1">{tr.standard_ids.map((id) => { const st = d.stdById.get(id); return <span key={id} className="block">{st ? `${st.code} · ${pick(st, 'title')}` : id}</span>; })}</span>],
              [t('m02.ins.track.nominated'), t(`m02.ins.kind.${tr.nomination_kind}`) + ' · ' + f.date(tr.started_on)],
              ...(tr.motivation ? [[t('m02.ins.track.motivation'), `“${tr.motivation}”`] as [string, string]] : []),
              ...(tr.first_qualified_on ? [[t('m02.ins.track.firstQualified'), f.date(tr.first_qualified_on)] as [string, string]] : []),
              ...(tr.decision_note ? [[t('m02.ins.track.note'), tr.decision_note] as [string, string]] : []),
            ]} />
          </Card>
        </Grid>
        {v.currency && <CurrencyCard v={v} />}
        <Section title={t('m02.ins.track.observations')} description={t('m02.ins.track.observationsIntro')}><ObservationList obs={v.obs} /></Section>
        <Grid cols={2}>
          <Card><HoursChart hours={v.hours.filter((h) => h.kind === 'delivery')} today={d.today} /></Card>
          <Card title={t('m02.ins.track.evaluator')}>
            <Async state={eq}>
              {(rows) => {
                const mine = rows.filter((r) => r.id.startsWith('eq-ins-'));
                if (!mine.length) return <p className="text-[13px] text-ink-3" data-testid="m02-ins-eq-none">{t('m02.ins.track.evaluatorNone')}</p>;
                return (
                  <ul className="space-y-1.5" data-testid="m02-ins-eq">
                    {mine.map((r) => { const st = d.stdById.get(r.standard_id); return <li key={r.id} className="flex justify-between gap-2 text-[13px]"><span>{st ? `${st.code} · ${pick(st, 'title')}` : r.standard_id}</span><span className={r.valid_to < d.today ? 'text-bad' : 'text-ink-2'}>{t('m02.ins.track.validTo', { date: f.date(r.valid_to) })}</span></li>; })}
                  </ul>
                );
              }}
            </Async>
            <p className="mt-2 text-[12px] text-ink-3">{t('m02.ins.track.evaluatorNote')}</p>
          </Card>
        </Grid>
        <MirrorNote />
      </div>
      {observe && <ObservationModal v={v} d={d} open={observe} onClose={() => setObserve(false)} />}
      {log && <LogHoursModal open={log} onClose={() => setLog(false)} personId={tr.person_id} cpdOnly={false} d={d} />}
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} actingAs={act === 'withdraw' && own ? undefined : t('m02.ins.asTm')} danger={act === 'decline' || act === 'withdraw'}
        requireReason={act === 'decline' || act === 'withdraw'} reasonLabel={t('m02.ins.act.reason')}
        title={act ? t(`m02.ins.act.${act === 'qualify' && lapsedReady ? 'reinstate' : act}Title`, { name }) : ''} consequence={act ? t(`m02.ins.act.${act === 'qualify' && lapsedReady ? 'reinstate' : act}Body`) : ''}
        onConfirm={async (reason) => {
          if (act === 'qualify') await run(() => repo.rpc.qualifyInstructor(tr.id, reason || null));
          else if (act === 'withdraw') await run(() => repo.rpc.withdrawInstructorTrack(tr.id, reason));
          else if (act) await run(() => repo.rpc.decideInstructorNomination(tr.id, act, reason || null));
        }} />
    </Page>
  );
}
