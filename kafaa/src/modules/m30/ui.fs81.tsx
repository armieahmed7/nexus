// FS81 page pieces (FS wave I · E3): the plan header (protected role -> target role, SIMULATED HR record), the ladder-rung alert panel
// (junior tasks moving to tools, the practice added with OJT progress, the eligible options with "Why this?"), the review timeline, the
// retraining list and the privacy note. Pages never import backend/*.
import { useState, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { BenchmarkChips, Callout, Card, EmptyState, Icon, SimChip, StatusPill, Timeline, WhyThis, type PillTone } from '../../ui';
import type { AlertTask, PlanRow, PracticeOption, ProgressRow, ReviewState, RungAlert } from './transition';
import { DriverChip, HorizonChip } from './ui';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const FS81 = 'FS81';

export function useTpRefs() {
  const repo = useRepo();
  return useQuery(['job_roles', 'courses', 'skills'], async () => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [roles, courses, skills] = await Promise.all([safe(repo.list('job_roles', { order: [['sort', 'asc']] })), safe(repo.list('courses')), safe(repo.list('skills'))]);
    return {
      roles: roles as Row[], roleById: new Map(roles.map((r) => [r.id, r as Row])), courses: courses as Row[], courseById: new Map(courses.map((c) => [c.id, c as Row])),
      skillById: new Map(skills.map((s) => [s.id, s as Row])),
    };
  });
}
export type TpRefs = NonNullable<ReturnType<typeof useTpRefs>['data']>;

export function RoleName({ refs, id }: { refs: TpRefs | undefined; id: string | null | undefined }) {
  const pick = usePick();
  const t = useT();
  if (!id) return <span className="text-ink-3">—</span>;
  const r = refs?.roleById.get(id);
  return <span>{pick(r, 'title') || id}{r?.lifecycle === 'concept' && <span className="chip ms-1.5 border-sim-line bg-sim-bg text-sim">{t('m30.tp.concept')}</span>}</span>;
}

export const STATUS_TONE: Record<string, PillTone> = { active: 'ok', draft: 'info', completed: 'neutral', withdrawn: 'neutral' };
export const REVIEW_TONE: Record<ReviewState, PillTone> = { none: 'neutral', on_time: 'ok', due_soon: 'sim', overdue: 'bad' };
export function PlanStatus({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={STATUS_TONE[status] ?? 'neutral'} status={status}>{t(`m30.tp.status.${status}`)}</StatusPill>;
}
export function ReviewPill({ state, date }: { state: ReviewState; date: string | null }) {
  const t = useT();
  const f = useFormat();
  if (state === 'none') return <span className="text-ink-3">—</span>;
  return <StatusPill tone={REVIEW_TONE[state]}><span data-testid="m30-tp-review-state" data-state={state}>{t(`m30.tp.review.${state}`, { date: f.date(date) })}</span></StatusPill>;
}

/** The SIMULATED HR label, the FS81 benchmark chips and the privacy note, shown on every plan screen. */
export function TpEyebrow() {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <SimChip label={t('m30.tp.simulated')} />
      <span data-testid="m30-bench"><BenchmarkChips feature={FS81} label={t('m30.bench.label')} /></span>
    </span>
  );
}
export function PrivacyNote({ hr = false }: { hr?: boolean }) {
  const t = useT();
  return <Callout tone="info" title={t('m30.tp.privacy.title')}><span data-testid="m30-tp-privacy">{hr ? t('m30.tp.privacy.hr') : t('m30.tp.privacy.me')}</span></Callout>;
}

/** Protected role -> target role, horizon, why, dates. */
export function PlanHeader({ plan, refs, extra }: { plan: PlanRow & { person_name?: string; person_name_ar?: string }; refs: TpRefs | undefined; extra?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <Card className="border-accent/40">
      <div className="space-y-3" data-testid="m30-tp-header">
        <div className="flex flex-wrap items-center gap-2">
          <PlanStatus status={plan.status} />
          <SimChip label={t('m30.tp.simulatedShort')} />
          <HorizonChip horizon={plan.horizon} />
          <span className="chip border-line bg-sunken text-ink-2">{t(`m30.tp.trigger.${plan.trigger}`)}</span>
          {plan.person_name && <span className="text-[13px] font-semibold" data-testid="m30-tp-person">{pick({ person_name_en: plan.person_name, person_name_ar: plan.person_name_ar }, 'person_name')}</span>}
          {extra}
        </div>
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-card border border-line p-3">
            <div className="caps flex items-center gap-1.5"><Icon name="shield" size={13} />{t('m30.tp.protected')}</div>
            <div className="mt-1 text-[16px] font-semibold" data-testid="m30-tp-protected"><RoleName refs={refs} id={plan.protected_role_id} /></div>
            <div className="text-[12.5px] text-ink-2">{t('m30.tp.protectedUntil', { date: f.date(plan.protected_until) })}</div>
          </div>
          <div className="grid place-items-center text-ink-3" aria-hidden><Icon name="chevron" size={22} className="rotate-90 md:rotate-0 rtl:md:-scale-x-100" /></div>
          <div className="rounded-card border border-accent/40 bg-accent-soft p-3">
            <div className="caps flex items-center gap-1.5"><Icon name="sparkle" size={13} />{t('m30.tp.target')}</div>
            <div className="mt-1 text-[16px] font-semibold" data-testid="m30-tp-target"><RoleName refs={refs} id={plan.target_role_id} /></div>
            <div className="text-[12.5px] text-ink-2">{t('m30.tp.window', { from: f.date(plan.start_on), to: f.date(plan.end_on) })}</div>
          </div>
        </div>
        {refs?.roleById.get(plan.target_role_id)?.lifecycle === 'concept' && <p className="text-[12.5px] text-ink-2">{t('m30.tp.conceptNote')}</p>}
        {pick(plan as never, 'note') && <p className="text-[13.5px] text-ink-2" data-testid="m30-tp-note">{pick(plan as never, 'note')}</p>}
      </div>
    </Card>
  );
}

function OptionLine({ o }: { o: PracticeOption }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px]">
      <span className={`chip ${o.kind === 'simulator' ? 'border-info-line bg-info-bg text-info' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(`m30.tp.kind.${o.kind}`)}</span>
      <span className="num text-ink-3">{o.code}</span>
      <span className="min-w-0 basis-40 flex-1">{pick(o as never, 'title')}</span>
      {o.minutes != null && <span className="num text-ink-3">{t('m30.tp.minutes', { n: f.num(o.minutes) })}</span>}
      <WhyThis reasons={o.reasons} testId="m30-tp-option-why" />
    </span>
  );
}

function TaskCard({ task, refs, progress, mode, selected, onToggle }: {
  task: AlertTask; refs: TpRefs | undefined; progress?: ProgressRow[]; mode: 'plan' | 'role' | 'edit'; selected?: Set<string>; onToggle?: (task: AlertTask, o: PracticeOption) => void;
}) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [all, setAll] = useState(false);
  const shown = mode === 'edit' || all ? task.options : task.options.slice(0, 3);
  return (
    <li className={`rounded-card border p-3 ${mode !== 'role' && !task.covered ? 'border-bad-line bg-bad-bg' : 'border-line'}`} data-testid="m30-tp-task" data-task={task.task_id} data-covered={String(task.covered)}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 basis-56 space-y-1">
          <div className="font-semibold">{pick(task as never, 'title')}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="num text-ink-3">{task.code}</span>
            <span className="chip max-w-full whitespace-normal border-line bg-sunken text-start text-ink-2">{task.rung === 'below' ? t('m30.tp.rungBelow', { role: pick(refs?.roleById.get(task.role_id), 'title') || task.role_id }) : t('m30.tp.rungOwn')}</span>
            <HorizonChip horizon={task.horizon} />
            {task.driver && <DriverChip driver={task.driver} />}
            <WhyThis reasons={task.reasons} testId="m30-tp-task-why" />
          </div>
        </div>
        {mode !== 'role' && (task.covered
          ? <StatusPill tone="ok"><Icon name="check" size={12} className="me-1 inline" />{t('m30.tp.covered')}</StatusPill>
          : <StatusPill tone="bad"><Icon name="alert" size={12} className="me-1 inline" />{t('m30.tp.uncovered')}</StatusPill>)}
      </div>
      {mode !== 'role' && task.practice.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="m30-tp-practice">
          <div className="caps">{t('m30.tp.practiceAdded')}</div>
          <ul className="space-y-1">
            {task.practice.map((p) => {
              const o = task.options.find((x) => x.kind === p.kind && x.ref_id === p.ref_id);
              const pr = progress?.find((x) => x.task_id === p.task_id && x.kind === p.kind && x.ref_id === p.ref_id);
              return (
                <li key={`${p.kind}-${p.ref_id}`} className="flex flex-wrap items-center gap-2 rounded-card bg-sunken px-2 py-1.5">
                  {o && <OptionLine o={o} />}
                  <span className="num text-[12px] font-semibold" data-testid="m30-tp-reps">
                    {p.kind === 'ojt' && pr && pr.done != null ? t('m30.tp.repsDone', { done: f.num(Math.min(pr.done, p.reps)), n: f.num(p.reps) }) : t(p.kind === 'ojt' ? 'm30.tp.reps' : 'm30.tp.runs', { n: f.num(p.reps) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(mode !== 'plan' || !task.covered) && task.options.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="caps">{mode === 'role' ? t('m30.tp.practiceToAdd') : t('m30.tp.options')}</div>
          <ul className="space-y-1" data-testid="m30-tp-options">
            {shown.map((o) => {
              const key = `${task.task_id}|${o.kind}|${o.ref_id}`;
              return (
                <li key={key} className="flex flex-wrap items-center gap-2">
                  {mode === 'edit' && onToggle && (
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={!!selected?.has(key)} onChange={() => onToggle(task, o)} aria-label={t('m30.tp.addOption', { code: o.code })} data-testid="m30-tp-option-toggle" />
                  )}
                  <OptionLine o={o} />
                </li>
              );
            })}
          </ul>
          {mode !== 'edit' && task.options.length > 3 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAll(!all)}>{all ? t('m30.tp.fewer') : t('m30.tp.more', { n: f.num(task.options.length - 3) })}</button>
          )}
        </div>
      )}
    </li>
  );
}

/** The ladder-rung alert: what it is about, every task it names, the practice added (plan) or to add (role level). */
export function RungAlertPanel({ alert, refs, progress, mode = 'plan', selected, onToggle }: {
  alert: RungAlert; refs: TpRefs | undefined; progress?: ProgressRow[]; mode?: 'plan' | 'role' | 'edit'; selected?: Set<string>; onToggle?: (task: AlertTask, o: PracticeOption) => void;
}) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!alert.applies) {
    return <Callout tone="info" title={t('m30.tp.noAlert')}><span data-testid="m30-tp-no-alert">{t(alert.role_id ? 'm30.tp.noAlertBody' : 'm30.tp.noAlertNone')}</span> <WhyThis reasons={alert.reasons} testId="m30-tp-alert-why" /></Callout>;
  }
  const roleTitle = pick(refs?.roleById.get(alert.role_id ?? ''), 'title') || alert.role_id;
  return (
    <div className="space-y-3" data-testid="m30-tp-alert" data-fires={String(alert.fires)} data-uncovered={alert.uncovered.length}>
      {alert.fires ? (
        mode === 'role' ? null : alert.uncovered.length > 0
          ? <Callout tone="bad" title={t('m30.tp.alertOpen', { n: f.num(alert.uncovered.length) })}>{t('m30.tp.alertOpenBody')}</Callout>
          : <Callout tone="ok" title={t('m30.tp.alertCovered', { n: f.num(alert.tasks.length) })}>{t('m30.tp.alertCoveredBody')}</Callout>
      ) : <Callout tone="ok" title={t('m30.tp.alertNone')}>{t('m30.tp.alertNoneBody', { h: t(`m30.horizon.${alert.horizon}`) })}</Callout>}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold">{roleTitle}</span>
        <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m30.tp.masteryBuilder')}</span>
        {mode !== 'role' && <span className="text-ink-2">{t(`m30.tp.basis.${alert.basis}`)}</span>}
        {alert.rungs.length > 0 && <span className="text-ink-2">{t('m30.tp.rungs', { roles: alert.rungs.map((r) => pick(refs?.roleById.get(r), 'title') || r).join(t('m30.tp.listSep')) })}</span>}
        <WhyThis reasons={alert.reasons} testId="m30-tp-alert-why" />
      </div>
      {alert.tasks.length === 0 ? null : (
        <ul className="space-y-2" data-testid="m30-tp-tasks">
          {alert.tasks.map((task) => <TaskCard key={task.task_id} task={task} refs={refs} progress={progress} mode={mode} selected={selected} onToggle={onToggle} />)}
        </ul>
      )}
    </div>
  );
}

export function ReviewTimeline({ plan }: { plan: PlanRow }) {
  const t = useT();
  const f = useFormat();
  if (!plan.reviews.length) return <EmptyState title={t('m30.tp.noReviews')} />;
  const next = plan.next_review_on;
  return (
    <div data-testid="m30-tp-reviews">
      <Timeline items={plan.reviews.map((r, i) => ({
        id: `${r.due_on}-${i}`,
        tone: r.done_on ? (r.outcome === 'at_risk' ? 'sim' : 'ok') : r.due_on === next ? 'accent' : 'neutral',
        when: <span className="num">{f.date(r.due_on)}</span>,
        title: r.done_on ? t(`m30.tp.outcome.${r.outcome ?? 'on_track'}`) : r.due_on === next ? t('m30.tp.nextReview') : t('m30.tp.plannedReview'),
        detail: r.done_on ? <span>{t('m30.tp.reviewedOn', { date: f.date(r.done_on) })}{r.note ? ` · ${r.note}` : ''}</span> : undefined,
      }))} />
    </div>
  );
}

export function RetrainingList({ plan, refs }: { plan: PlanRow; refs: TpRefs | undefined }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!plan.retraining.length) return <EmptyState title={t('m30.tp.noRetraining')} />;
  const total = plan.retraining.reduce((n, r) => n + Number(r.hours), 0);
  return (
    <div className="space-y-2">
      <ol className="space-y-2" data-testid="m30-tp-retraining">
        {plan.retraining.map((r, i) => {
          const c = r.kind === 'course' && r.ref_id ? refs?.courseById.get(r.ref_id) : null;
          return (
            <li key={`${r.kind}-${i}`} className="flex items-start gap-3 rounded-card border border-line p-2.5 text-[13px]">
              <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{f.num(i + 1)}</span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="font-semibold">{c ? <L to={`/learn/course/${c.id}`}>{pick(c, 'title')}</L> : pick(r as never, 'title')}</div>
                <div className="flex flex-wrap gap-x-3 text-[12px] text-ink-2">
                  <span>{t(`m30.tp.rkind.${r.kind}`)}</span>
                  <span className="num">{t('m30.bridge.hours', { n: f.num(Number(r.hours)) })}</span>
                  <span>{t('m30.tp.due', { date: f.date(r.due_on) })}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-[12px] text-ink-3">{t('m30.tp.retrainingTotal', { n: f.num(total) })}</p>
    </div>
  );
}
