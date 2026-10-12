// /workforce/transition-plans (M30 · FS81) — HR board of transition plans. HR (transformation A) only: managers, the training manager
// and HR analysts get the forbidden screen, and the RPCs answer them with nothing. Tiles (active, drafts, reviews due or overdue, open
// ladder-rung alerts, acknowledgements pending), the plan table (person, protected -> target role, status, alert coverage, next review)
// and the editor for a new plan. Every plan is a SIMULATED HR record.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT, useNav, L } from '../../i18n';
import { Async, DataTable, EmptyState, Grid, Icon, Page, StatTile, StatusPill } from '../../ui';
import type { TransitionPlanView } from './backend/rpc';
import { PlanEditor } from './PlanEditor';
import { PlanStatus, PrivacyNote, ReviewPill, RoleName, TpEyebrow, useTpRefs } from './ui.fs81';

export default function WorkforceTransitionPlansPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const nav = useNav();
  const refs = useTpRefs();
  const q = useQuery(['transition_plans', 'ojt_logs'], async () => ({ rows: (await repo.rpc.transitionPlans()) ?? null }));
  const cand = useQuery(['transition_plans', 'people'], async () => ({ rows: (await repo.rpc.transitionCandidates()) ?? [] }));
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const active = rows.filter((v) => v.plan.status === 'active');
  return (
    <Page title={t('m30.routes.workforce-transition-plans.title')} intro={t('m30.tp.hr.intro')} eyebrow={<TpEyebrow />} wide
      actions={<span className="flex flex-wrap gap-2">
        <L to="/workforce/rung-alerts" className="btn-outline no-underline" data-testid="m30-tp-to-rung">{t('m30.tp.hr.toRung')}</L>
        {!creating && <button type="button" className="btn-primary" onClick={() => setCreating(true)} data-testid="m30-tp-new"><Icon name="plus" size={14} />{t('m30.tp.hr.new')}</button>}
      </span>}>
      <Async state={q}>{(d) => (d.rows === null ? <EmptyState title={t('m30.tp.hr.noAccess')} /> : (
        <div className="space-y-5">
          <Grid cols={4}>
            <StatTile label={t('m30.tp.hr.tile.active')} value={<span data-testid="m30-tp-count-active">{f.num(active.length)}</span>} sub={t('m30.tp.hr.tile.activeSub', { n: f.num(d.rows.filter((v) => v.plan.status === 'draft').length) })} />
            <StatTile label={t('m30.tp.hr.tile.reviews')} value={f.num(active.filter((v) => v.review_state === 'due_soon' || v.review_state === 'overdue').length)} tone={active.some((v) => v.review_state === 'overdue') ? 'bad' : 'sim'}
              sub={t('m30.tp.hr.tile.reviewsSub', { n: f.num(active.filter((v) => v.review_state === 'overdue').length) })} />
            <StatTile label={t('m30.tp.hr.tile.alerts')} value={f.num(d.rows.filter((v) => v.alert.fires).length)} sub={t('m30.tp.hr.tile.alertsSub', { n: f.num(d.rows.filter((v) => v.alert.uncovered.length > 0).length) })}
              tone={d.rows.some((v) => v.alert.uncovered.length > 0) ? 'bad' : 'ok'} />
            <StatTile label={t('m30.tp.hr.tile.ack')} value={f.num(active.filter((v) => !v.plan.acknowledged_at).length)} sub={t('m30.tp.hr.tile.ackSub')} />
          </Grid>
          <PrivacyNote hr />
          {creating && (
            <Async state={refs}>{(r) => (
              <PlanEditor refs={r} candidates={cand.data?.rows ?? []} plan={null} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); nav(`/workforce/transition-plans/${id}`); }} />
            )}</Async>
          )}
          {d.rows.length === 0 ? <EmptyState title={t('m30.tp.hr.empty')} /> : (
            <div data-testid="m30-tp-board">
              <DataTable<TransitionPlanView>
                rows={d.rows}
                rowKey={(v) => v.plan.id}
                csvName="transition-plans"
                onRowClick={(v) => nav(`/workforce/transition-plans/${v.plan.id}`)}
                columns={[
                  { key: 'person', header: t('m30.tp.col.person'), value: (v) => v.plan.person_name, sortable: true,
                    render: (v) => <L to={`/workforce/transition-plans/${v.plan.id}`} className="font-semibold" data-testid="m30-tp-row">{pick({ n_en: v.plan.person_name, n_ar: v.plan.person_name_ar }, 'n')}</L> },
                  { key: 'from', header: t('m30.tp.protected'), value: (v) => v.plan.protected_role_id, render: (v) => <RoleName refs={refs.data} id={v.plan.protected_role_id} /> },
                  { key: 'to', header: t('m30.tp.target'), value: (v) => v.plan.target_role_id, render: (v) => <RoleName refs={refs.data} id={v.plan.target_role_id} /> },
                  { key: 'status', header: t('m30.tp.col.status'), value: (v) => v.plan.status, render: (v) => <PlanStatus status={v.plan.status} />, sortable: true },
                  { key: 'alert', header: t('m30.tp.col.alert'), value: (v) => v.alert.uncovered.length,
                    render: (v) => (!v.alert.fires ? <span className="text-ink-3">{t('m30.tp.col.noAlert')}</span>
                      : v.alert.uncovered.length ? <StatusPill tone="bad">{t('m30.tp.col.uncovered', { n: f.num(v.alert.uncovered.length), of: f.num(v.alert.tasks.length) })}</StatusPill>
                        : <StatusPill tone="ok">{t('m30.tp.col.covered', { n: f.num(v.alert.tasks.length) })}</StatusPill>) },
                  { key: 'next', header: t('m30.tp.col.next'), value: (v) => v.plan.next_review_on ?? '', render: (v) => <ReviewPill state={v.review_state} date={v.plan.next_review_on} />, sortable: true },
                  { key: 'ack', header: t('m30.tp.col.ack'), value: (v) => (v.plan.acknowledged_at ? 1 : 0), render: (v) => (v.plan.acknowledged_at ? <Icon name="check" size={14} className="text-ok" /> : <span className="text-ink-3">—</span>) },
                ]}
              />
            </div>
          )}
        </div>
      ))}</Async>
    </Page>
  );
}
