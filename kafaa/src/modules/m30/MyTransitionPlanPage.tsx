// /my/transition-plan (M30 · FS81 Transition plans and ladder-rung protection). My own transition plan, a SIMULATED HR record that
// only I and HR (transformation A) can see: the role kept (protected) while I retrain and until when, the target role, the retraining
// steps, the ladder-rung alert of my Mastery Builder role (junior tasks moving to tools and the simulator / OJT practice added, with
// my acknowledged OJT repetitions), the dated reviews, and the acknowledgement. Managers never see it. Readers: the person (own).
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, useT, L } from '../../i18n';
import { Async, Card, ConfirmDialog, EmptyState, Grid, Page, Section, StatTile } from '../../ui';
import type { TransitionPlanView } from './backend/rpc';
import { PlanHeader, PlanStatus, PrivacyNote, RetrainingList, ReviewPill, ReviewTimeline, RoleName, RungAlertPanel, TpEyebrow, useTpRefs, type TpRefs } from './ui.fs81';

type Wrap = { v: TransitionPlanView | null };

export default function MyTransitionPlanPage() {
  const t = useT();
  const repo = useRepo();
  const refs = useTpRefs();
  const q = useQuery<Wrap>(['transition_plans', 'ojt_logs'], async () => ({ v: await repo.rpc.transitionPlanView(null) }));
  const others = useQuery(['transition_plans'], async () => ({ rows: await repo.list('transition_plans', { order: [['created_at', 'desc']] }).catch(() => []) }));
  return (
    <Page title={t('m30.routes.my-transition-plan.title')} intro={t('m30.tp.my.intro')} eyebrow={<TpEyebrow />} wide
      actions={<L to="/my/role-2030" className="btn-outline no-underline" data-testid="m30-tp-to-role">{t('m30.tp.my.toRole')}</L>}>
      <Async state={q}>{(w) => (w.v ? <Body v={w.v} refs={refs.data} others={(others.data?.rows ?? []) as never} /> : (
        <div className="space-y-4" data-testid="m30-tp-none">
          <EmptyState title={t('m30.tp.my.none')} icon="shield">{t('m30.tp.my.noneBody')}</EmptyState>
          <PrivacyNote />
        </div>
      ))}</Async>
    </Page>
  );
}

function Body({ v, refs, others }: { v: TransitionPlanView; refs: TpRefs | undefined; others: { id: string; status: string; target_role_id: string; created_at: string }[] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [confirm, setConfirm] = useState(false);
  const plan = v.plan;
  const ojt = v.progress.filter((p) => p.kind === 'ojt');
  const done = ojt.reduce((n, p) => n + Math.min(p.done ?? 0, p.reps), 0);
  const reps = ojt.reduce((n, p) => n + p.reps, 0);
  const hours = plan.retraining.reduce((n, r) => n + Number(r.hours), 0);
  const past = others.filter((o) => o.id !== plan.id);
  return (
    <div className="space-y-6" data-testid="m30-tp-mine">
      <PlanHeader plan={plan} refs={refs} extra={plan.acknowledged_at
        ? <span className="chip border-ok-line bg-ok-bg text-ok" data-testid="m30-tp-acked">{t('m30.tp.my.acked', { date: f.date(plan.acknowledged_at) })}</span>
        : plan.status === 'active' && <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m30-tp-ack">{t('m30.tp.my.ack')}</button>} />
      <Grid cols={4}>
        <StatTile label={t('m30.tp.tile.nextReview')} value={<span className="num">{f.date(plan.next_review_on)}</span>} sub={<ReviewPill state={v.review_state} date={plan.next_review_on} />} />
        <StatTile label={t('m30.tp.tile.retraining')} value={t('m30.bridge.hours', { n: f.num(hours) })} sub={t('m30.tp.tile.steps', { n: f.num(plan.retraining.length) })} />
        <StatTile label={t('m30.tp.tile.rungTasks')} value={f.num(v.alert.tasks.length)} tone={v.alert.uncovered.length ? 'bad' : 'ok'} sub={t('m30.tp.tile.rungTasksSub', { n: f.num(v.alert.covered) })} />
        <StatTile label={t('m30.tp.tile.ojt')} value={<span className="num" data-testid="m30-tp-ojt-total">{t('m30.tp.repsDone', { done: f.num(done), n: f.num(reps) })}</span>} sub={t('m30.tp.tile.ojtSub')} />
      </Grid>
      <PrivacyNote />
      <Section title={t('m30.tp.alertTitle')} description={t('m30.tp.my.alertDesc')}>
        <RungAlertPanel alert={v.alert} refs={refs} progress={v.progress} />
      </Section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m30.tp.retraining')} eyebrow={t('m30.tp.retrainingEyebrow')}><RetrainingList plan={plan} refs={refs} /></Card>
        <Card title={t('m30.tp.reviews')} eyebrow={t('m30.tp.reviewsEyebrow')}><ReviewTimeline plan={plan} /></Card>
      </div>
      {past.length > 0 && (
        <Section title={t('m30.tp.my.past')}>
          <ul className="divide-y divide-line rounded-card border border-line" data-testid="m30-tp-past">
            {past.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 p-2.5 text-[13px]"><PlanStatus status={o.status} /><RoleName refs={refs} id={o.target_role_id} /><span className="text-ink-3">{f.date(o.created_at)}</span></li>
            ))}
          </ul>
        </Section>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m30.tp.my.ackTitle')} consequence={t('m30.tp.my.ackBody')} confirmLabel={t('m30.tp.my.ack')}
        onConfirm={async () => { await act(() => repo.rpc.acknowledgeTransitionPlan(plan.id), { success: t('m30.tp.my.ackDone') }); setConfirm(false); }} />
    </div>
  );
}
