// F07: the optional, private weekly learning goal and the coach's focus roles (both in kafaa_learning_goals, direct own
// writes under own_profile: nobody else can read them). No streaks, points or comparisons: the goal is a planning aid.
import { useState } from 'react';
import { Card, Drawer, Modal, ProgressBar, StatusPill, TextField, CheckboxField, Icon, useForm, numberRange } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useCount, useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { CoachCard, CoachInput, CoachResult } from './coach';
import { daysLeftInWeek, dubaiToday, fitsInTimeLeft, weeklyRecorded, type WeekBucket } from './week';
import { goalId } from './insights';
import type { CoachTables } from './inputs';

type R = CoachResult & { t: CoachTables; input: CoachInput };
interface GoalRow { id: string; person_id: string; hours_per_week: number | string; focus_role_ids: string[] }
const myGoal = (r: R) => (r.t.learning_goals.find((g) => g.person_id === r.input.personId) ?? null) as GoalRow | null;

async function saveGoal(repo: ReturnType<typeof useRepo>, current: GoalRow | null, personId: string, patch: Partial<GoalRow>) {
  const row = { hours_per_week: Number(patch.hours_per_week ?? current?.hours_per_week ?? 0), focus_role_ids: patch.focus_role_ids ?? current?.focus_role_ids ?? [], updated_at: new Date().toISOString() };
  return current ? repo.update('learning_goals', current.id, row) : repo.insert('learning_goals', { id: goalId(personId), person_id: personId, ...row });
}

const tenth = (n: number) => Math.round(n * 10) / 10;

export function GoalCard({ result, feedHours, feed = [] }: { result: R; feedHours: number; feed?: CoachCard[] }) {
  const t = useT();
  const f = useFormat();
  const count = useCount();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const goal = myGoal(result);
  const hours = Number(goal?.hours_per_week ?? 0);
  // EMP-09: this week's recorded hours come from my own learning record (every recorded activity, not only course completions).
  const me = result.input.personId;
  const lrs = useQuery('xapi_statements', async () => (me && hours > 0 ? repo.list('xapi_statements', { filter: { actor_person_id: me } }).catch(() => []) : []), [me, hours > 0]);
  const today = dubaiToday();
  const weeks = weeklyRecorded(lrs.data ?? [], today);
  const week = tenth(weeks[weeks.length - 1].minutes / 60);
  const left = Math.max(0, tenth(hours - week));
  const fits = fitsInTimeLeft(feed, left);
  const weekText = count('m19.goal.weekOf', hours, { done: f.num(week) });
  const form = useForm({ hours: hours ? String(hours) : '' }, { hours: [numberRange(0, 40)] });
  return (
    <Card eyebrow={t('m19.goal.eyebrow')} title={hours ? t('m19.goal.title', { n: f.num(hours) }) : t('m19.goal.none')}
      actions={<button type="button" className="btn-ghost btn-sm" onClick={() => { form.reset(); setOpen(true); }} data-testid="m19-goal-edit">{hours ? t('m19.goal.change') : t('m19.goal.set')}</button>}>
      {hours > 0 ? (
        <div className="space-y-2" data-testid="m19-goal">
          <ProgressBar value={Math.min(100, Math.round((week * 100) / hours))} tone={week >= hours ? 'ok' : 'accent'} label={weekText} />
          <p className="text-[13.5px] text-ink-2" data-testid="m19-goal-week" aria-live="polite">{lrs.loading ? t('m19.goal.weekLoading') : weekText}</p>
          {!lrs.loading && (
            <p className="text-[12.5px] text-ink-3" data-testid="m19-goal-left">
              {week >= hours ? t('m19.goal.weekReached') : t('m19.goal.weekLeft', { hours: count('m19.goal.nHours', left), days: count('common.nDays', daysLeftInWeek(today)) })}
            </p>
          )}
          {!lrs.loading && <WeekBars weeks={weeks} goal={hours} />}
          {!lrs.loading && fits.length > 0 && (
            <div data-testid="m19-goal-fits">
              <p className="caps">{t('m19.goal.fitsTitle')}</p>
              <ul className="mt-1 space-y-1 text-[13px]">
                {fits.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-2">
                    <L to={c.link} className="min-w-0">{lang === 'ar' ? c.title.ar : c.title.en}</L>
                    <span className="shrink-0 text-ink-3">{count('m19.goal.nHours', c.hours ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12px] text-ink-3">{t('m19.goal.recordedNote')} <L to="/my/learning-record">{t('m19.goal.recordLink')}</L></p>
          <p className="text-[12.5px] text-ink-3">{t('m19.goal.monthFit', { feed: f.num(Math.round(feedHours * 10) / 10), month: f.num(Math.round(hours * 4.3 * 10) / 10) })}</p>
        </div>
      ) : <p className="text-[13.5px] text-ink-2">{t('m19.goal.noneBody')}</p>}
      <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-3"><Icon name="lock" size={12} />{t('m19.goal.private')}</p>
      <Modal open={open} onClose={() => setOpen(false)} title={t('m19.goal.modalTitle')} size="sm"
        footer={<>
          {goal && hours > 0 && <button type="button" className="btn-ghost me-auto" onClick={async () => { const r = await run(() => saveGoal(repo, goal, result.input.personId, { hours_per_week: 0 }), { success: t('m19.goal.cleared') }); if (r.ok) setOpen(false); }}>{t('m19.goal.clear')}</button>}
          <button type="button" className="btn-outline" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          <button type="submit" form="m19-goal-form" className="btn-primary" disabled={form.submitting}>{t('common.save')}</button>
        </>}>
        <form id="m19-goal-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
          const r = await run(() => saveGoal(repo, goal, result.input.personId, { hours_per_week: v.hours ? Math.round(Number(v.hours) * 2) / 2 : 0 }), { success: t('m19.goal.saved') });
          if (r.ok) setOpen(false);
        })}>
          <TextField label={t('m19.goal.hoursLabel')} type="number" hint={t('m19.goal.hoursHint')} {...form.field('hours')} />
          <p className="text-[12.5px] text-ink-3">{t('m19.goal.noStreaks')}</p>
        </form>
      </Modal>
    </Card>
  );
}

/** The last weeks as a small bar row (oldest first, this week last). Each bar is a list item with its own text for screen readers. */
function WeekBars({ weeks, goal }: { weeks: WeekBucket[]; goal: number }) {
  const t = useT();
  const f = useFormat();
  const count = useCount();
  const top = Math.max(goal, ...weeks.map((w) => w.minutes / 60), 0.5);
  return (
    <ul className="flex h-10 items-end gap-1" aria-label={t('m19.goal.barsLabel', { n: f.num(weeks.length) })} data-testid="m19-goal-bars">
      {weeks.map((w, i) => {
        const h = tenth(w.minutes / 60);
        const label = t('m19.goal.barWeek', { date: f.date(w.start), hours: count('m19.goal.nHours', h) });
        return (
          <li key={w.start} className="flex h-full flex-1 items-end" title={label} data-hours={h}>
            <span className="sr-only">{label}</span>
            <span aria-hidden="true" className={`block w-full rounded-sm ${i === weeks.length - 1 ? 'bg-accent' : 'bg-line'}`} style={{ height: `${Math.max(h > 0 ? 8 : 2, Math.round((h / top) * 100))}%` }} />
          </li>
        );
      })}
    </ul>
  );
}

export function FocusCard({ result }: { result: R }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [open, setOpen] = useState(false);
  const goal = myGoal(result);
  const roles = new Map(result.input.roles.map((x) => [x.id, x]));
  const focus = goal?.focus_role_ids ?? [];
  const plan = new Set(result.t.dev_plans.filter((p) => p.person_id === result.input.personId).map((p) => String(p.target_role_id)));
  const shortlist = new Set((result.t.career_targets ?? []).filter((p) => p.person_id === result.input.personId && p.active !== false).map((p) => String(p.role_id)));
  const future = result.input.futureGoals ?? [];
  const [sel, setSel] = useState<string[]>(focus);
  const current = result.input.roleId ? roles.get(result.input.roleId) : null;
  const source = (id: string) => (focus.includes(id) ? 'focus' : shortlist.has(id) ? 'shortlist' : plan.has(id) ? 'plan' : 'focus');
  return (
    <Card eyebrow={t('m19.focus.eyebrow')} title={current ? pick(current, 'title') : t('m19.focus.noRole')}
      actions={<button type="button" className="btn-ghost btn-sm" onClick={() => { setSel(focus); setOpen(true); }} data-testid="m19-focus-edit">{t('m19.focus.change')}</button>}>
      <div className="text-[12.5px] text-ink-3">{t('m19.focus.currentWeight')}</div>
      {result.targets.length ? (
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="m19-targets">
          {result.targets.map((id) => <li key={id}><StatusPill tone="accent">{pick(roles.get(id) ?? null, 'title')}</StatusPill> <span className="text-[11.5px] text-ink-3">{t(`m19.focus.source.${source(id)}`)}</span></li>)}
        </ul>
      ) : <p className="mt-2 text-[13.5px] text-ink-2">{t('m19.focus.none')}</p>}
      {future.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="m19-future-goals">
          {future.map((g) => <li key={g.id}><StatusPill tone="info">{pick(g as never, 'title')}</StatusPill> <span className="text-[11.5px] text-ink-3">{t('m19.focus.source.future')}</span></li>)}
        </ul>
      )}
      {future.length > 0 && <p className="mt-1 text-[11.5px] text-ink-3">{t('m19.focus.futureNote')}</p>}
      <Drawer open={open} onClose={() => setOpen(false)} title={t('m19.focus.drawerTitle')}
        footer={<><button type="button" className="btn-outline" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" data-testid="m19-focus-save" onClick={async () => { if (!s.identity.personId) return; const r = await run(() => saveGoal(repo, goal, s.identity.personId!, { focus_role_ids: sel }), { success: t('m19.focus.saved') }); if (r.ok) setOpen(false); }}>{t('common.save')}</button></>}>
        <p className="mb-3 text-[13.5px] text-ink-2">{t('m19.focus.drawerIntro')}</p>
        <div className="space-y-1" data-testid="m19-focus-list">
          {result.input.roles.filter((x) => x.id !== result.input.roleId && !x.security_sensitive).map((x) => (
            <CheckboxField key={x.id} label={pick(x, 'title')} checked={sel.includes(x.id)} disabled={!sel.includes(x.id) && sel.length >= 3}
              onChange={(v) => setSel((cur) => (v ? [...cur, x.id].slice(0, 3) : cur.filter((y) => y !== x.id)))} />
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-ink-3">{t('m19.focus.securityNote')}</p>
      </Drawer>
    </Card>
  );
}
