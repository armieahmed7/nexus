// /workforce/transition-plans/:planId (M30 · FS81) — one transition plan for HR (transformation A): the header (protected role ->
// target role, SIMULATED HR record), the ladder-rung alert with the practice added and the person's acknowledged OJT repetitions, the
// retraining steps, the review timeline and the history; actions: edit (the editor), record the due review, complete or withdraw.
// HR cannot act on their own plan (refused by the RPCs). Nobody else can open a plan (the RPC returns nothing).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, useT, L } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { Async, Card, ConfirmDialog, EmptyState, Grid, Modal, Page, Section, SelectField, StatTile, TextField, Timeline } from '../../ui';
import { REVIEW_WINDOW, daysFrom, type PlanRow } from './transition';
import type { TransitionPlanView } from './backend/rpc';
import { PlanEditor } from './PlanEditor';
import { PlanHeader, PrivacyNote, RetrainingList, ReviewPill, ReviewTimeline, RungAlertPanel, TpEyebrow, useTpRefs } from './ui.fs81';

type Wrap = { v: TransitionPlanView | null };

export default function TransitionPlanPage() {
  const t = useT();
  const repo = useRepo();
  const { planId = '' } = useParams();
  const refs = useTpRefs();
  const q = useQuery<Wrap>(['transition_plans', 'ojt_logs'], async () => ({ v: await repo.rpc.transitionPlanView(planId) }), [planId]);
  return (
    <Page title={t('m30.routes.workforce-transition-plan.title')} intro={t('m30.tp.plan.intro')} eyebrow={<TpEyebrow />} wide
      actions={<L to="/workforce/transition-plans" className="btn-outline no-underline">{t('m30.tp.plan.back')}</L>}>
      <Async state={q}>{(w) => (w.v ? <Body v={w.v} refs={refs} /> : <EmptyState title={t('m30.tp.plan.notFound')} />)}</Async>
    </Page>
  );
}

function Body({ v, refs }: { v: TransitionPlanView; refs: ReturnType<typeof useTpRefs> }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const plan = v.plan;
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [close, setClose] = useState<'completed' | 'withdrawn' | null>(null);
  const cand = useQuery(['transition_plans'], async () => ({ rows: (await repo.rpc.transitionCandidates()) ?? [] }));
  const open = plan.status === 'draft' || plan.status === 'active';
  const pending = plan.reviews.find((r) => !r.done_on);
  const canReview = v.can_decide && plan.status === 'active' && !!pending && daysFrom(todayIso(), pending.due_on) <= REVIEW_WINDOW;
  return (
    <div className="space-y-6" data-testid="m30-tp-plan">
      <PlanHeader plan={plan} refs={refs.data} />
      {v.can_decide && open && !editing && (
        <div className="flex flex-wrap gap-2" data-testid="m30-tp-actions">
          <button type="button" className="btn-primary" onClick={() => setEditing(true)} data-testid="m30-tp-edit">{plan.status === 'draft' ? t('m30.tp.plan.editActivate') : t('m30.tp.plan.edit')}</button>
          <button type="button" className="btn-outline" disabled={!canReview} onClick={() => setReview(true)} data-testid="m30-tp-review" title={canReview ? undefined : t('m30.tp.err.no_review_due')}>{t('m30.tp.plan.review')}</button>
          {plan.status === 'active' && <button type="button" className="btn-outline" onClick={() => setClose('completed')} data-testid="m30-tp-complete">{t('m30.tp.plan.complete')}</button>}
          <button type="button" className="btn-ghost" onClick={() => setClose('withdrawn')} data-testid="m30-tp-withdraw">{t('m30.tp.plan.withdraw')}</button>
        </div>
      )}
      {!v.can_decide && v.mine && <PrivacyNote />}
      {editing && refs.data && <PlanEditor refs={refs.data} candidates={cand.data?.rows ?? []} plan={plan} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      <Grid cols={4}>
        <StatTile label={t('m30.tp.tile.nextReview')} value={<span className="num">{f.date(plan.next_review_on)}</span>} sub={<ReviewPill state={v.review_state} date={plan.next_review_on} />} />
        <StatTile label={t('m30.tp.tile.rungTasks')} value={f.num(v.alert.tasks.length)} tone={v.alert.uncovered.length ? 'bad' : 'ok'} sub={t('m30.tp.tile.rungTasksSub', { n: f.num(v.alert.covered) })} />
        <StatTile label={t('m30.tp.tile.practice')} value={f.num(plan.practice.length)} sub={t('m30.tp.tile.practiceSub', { n: f.num(plan.practice.filter((p) => p.kind === 'simulator').length) })} />
        <StatTile label={t('m30.tp.tile.ack')} value={plan.acknowledged_at ? f.date(plan.acknowledged_at) : t('m30.tp.tile.notYet')} tone={plan.acknowledged_at ? 'ok' : 'sim'} />
      </Grid>
      <Section title={t('m30.tp.alertTitle')} description={t('m30.tp.plan.alertDesc')}>
        <RungAlertPanel alert={v.alert} refs={refs.data} progress={v.progress} />
      </Section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m30.tp.retraining')} eyebrow={t('m30.tp.retrainingEyebrow')}><RetrainingList plan={plan} refs={refs.data} /></Card>
        <Card title={t('m30.tp.reviews')} eyebrow={t('m30.tp.reviewsEyebrow')}><ReviewTimeline plan={plan} /></Card>
      </div>
      <Section title={t('m30.tp.plan.history')}>
        <History plan={plan} />
        {plan.close_note && <p className="mt-2 text-[13px] text-ink-2" data-testid="m30-tp-close-note">{plan.close_note}</p>}
      </Section>
      {review && <ReviewModal plan={plan} onClose={() => setReview(false)} />}
      <ConfirmDialog open={close !== null} onClose={() => setClose(null)} requireReason reasonLabel={t('m30.tp.plan.reason')}
        title={close === 'completed' ? t('m30.tp.plan.complete') : t('m30.tp.plan.withdraw')}
        consequence={close === 'completed' ? t('m30.tp.plan.completeBody') : t('m30.tp.plan.withdrawBody')} danger={close === 'withdrawn'}
        confirmLabel={close === 'completed' ? t('m30.tp.plan.complete') : t('m30.tp.plan.withdraw')}
        onConfirm={async (reason) => { await act(() => repo.rpc.closeTransitionPlan({ plan_id: plan.id, outcome: close!, note: reason })); setClose(null); }} />
    </div>
  );
}

function History({ plan }: { plan: PlanRow }) {
  const t = useT();
  const f = useFormat();
  const items = (plan.history as { at: string; by: string; action: string; status: string; revision: number; outcome?: string }[]).slice().reverse();
  if (!items.length) return <EmptyState title={t('m30.tp.plan.noHistory')} />;
  return (
    <div data-testid="m30-tp-history">
      <Timeline items={items.map((h, i) => ({
        id: `${h.at}-${i}`, tone: h.action === 'withdraw' ? 'neutral' : h.action === 'review' && h.outcome === 'at_risk' ? 'sim' : 'accent',
        when: f.dateTime(h.at), title: t(`m30.tp.action.${h.action}`), detail: t('m30.tp.plan.historyDetail', { by: h.by, r: f.num(h.revision) }),
      }))} />
    </div>
  );
}

function ReviewModal({ plan, onClose }: { plan: PlanRow; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const pending = plan.reviews.filter((r) => !r.done_on);
  const [outcome, setOutcome] = useState('on_track');
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const needNext = pending.length <= 1;
  const run = async () => {
    const r = await act(() => repo.rpc.reviewTransitionPlan({ plan_id: plan.id, outcome, note, next_review_on: next || null }), { success: t('m30.tp.plan.reviewed') });
    if (r.ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={t('m30.tp.plan.reviewTitle', { date: f.date(pending[0]?.due_on) })}
      footer={<span className="flex gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={needNext && !next} onClick={run} data-testid="m30-tp-review-save">{t('m30.tp.plan.reviewSave')}</button></span>}>
      <div className="space-y-3" data-testid="m30-tp-review-form">
        <SelectField label={t('m30.tp.plan.outcome')} name="outcome" value={outcome} onChange={setOutcome} options={['on_track', 'at_risk'].map((o) => ({ value: o, label: t(`m30.tp.outcome.${o}`) }))} />
        <TextField label={t('m30.tp.plan.note')} name="note" value={note} onChange={setNote} />
        <TextField label={t('m30.tp.plan.nextDate')} name="next" type="date" value={next} onChange={setNext} hint={needNext ? t('m30.tp.plan.nextNeeded') : t('m30.tp.plan.nextOptional')} required={needNext} />
      </div>
    </Modal>
  );
}
