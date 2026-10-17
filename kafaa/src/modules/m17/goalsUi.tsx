// FS33 shared UI (FS wave D · E3): the goal card, the goal editor (save / share / withdraw, each behind a confirmation), the goals
// strip mounted on /my/skills and /team/passport/:personId, and "Add to my goals" in the passport's evidence drawer.
// Rules: skillGoals.ts (TS = SQL). Private by default; a goal shared with my manager is readable by managers in scope only (RLS).
import { useMemo, useState } from 'react';
import { Card, ConfirmDialog, EmptyState, Icon, Modal, SelectField, StatusPill, TextArea, TextField, CheckboxField, WhyThis, ProgressBar } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { GOAL_RULES, goalProblem, goalView, sortGoals, type GoalStatus, type GoalView } from './skillGoals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export const GOAL_TONE: Record<GoalStatus, 'ok' | 'bad' | 'info' | 'sim' | 'neutral'> = { reached: 'ok', overdue: 'bad', due_soon: 'sim', on_track: 'info', removed: 'neutral' };
export function GoalPill({ status }: { status: GoalStatus }) {
  const t = useT();
  return <StatusPill tone={GOAL_TONE[status]} status={status}>{t(`m17.sg.status.${status}`)}</StatusPill>;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export interface GoalsData {
  today: string;
  person: string;
  plans: Row[];
  goals: Row[];
  states: Row[];
  skills: Row[];
  sec: Set<string>;
  views: (GoalView & { skill: Row | null; note: string | null; plan: Row | null })[];
  /** FS07 goals added from a skill page without a date yet (no plan): shown with "add a date". */
  unplanned: Row[];
}
/** My (or a person's) goals: plans joined to FS07's goal rows, today's state and the skill labels. RLS decides what a manager sees. */
export function useGoalsData(person: string | null) {
  const repo = useRepo();
  return useQuery(['skill_goal_plans', 'skill_goals', 'person_skills', 'skills'], async (): Promise<GoalsData> => {
    const p = person ?? '';
    const [plans, goals, states, skills, comps] = await Promise.all([
      repo.list('skill_goal_plans', { filter: { person_id: p } }), repo.list('skill_goals', { filter: { person_id: p } }).catch(() => [] as Row[]),
      repo.list('person_skills', { filter: { person_id: p } }), repo.list('skills'), repo.list('competencies'),
    ]);
    const today = todayIso();
    const byId = new Map(skills.map((s: Row) => [s.id, s]));
    const stateOf = new Map(states.filter((s: Row) => s.active !== false).map((s: Row) => [s.skill_id, s]));
    const views = sortGoals(plans.map((pl: Row) => { const sk = byId.get(pl.skill_id) ?? null; return goalView(pl, stateOf.get(pl.skill_id), today, sk ? { en: sk.name_en, ar: sk.name_ar } : undefined); }))
      .map((v) => { const pl = plans.find((x: Row) => x.id === v.id) ?? null; return { ...v, skill: byId.get(v.skill_id) ?? null, note: pl?.note ?? null, plan: pl }; });
    const planned = new Set(plans.map((x: Row) => x.id));
    const unplanned = goals.filter((g: Row) => g.status === 'active' && !planned.has(g.id));
    return { today, person: p, plans, goals, states, skills, sec: new Set(comps.filter((c: Row) => c.domain === 'security').map((c: Row) => String(c.id))), views, unplanned };
  }, [person]);
}

/** One goal: the skill, the climb from my level to the target, the date, status and the reasons (<WhyThis>). */
export function GoalCard({ v, readOnly, onEdit, onShare, onWithdraw }: { v: GoalsData['views'][number]; readOnly?: boolean; onEdit?: () => void; onShare?: () => void; onWithdraw?: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const pct = Math.min(100, (100 * v.level) / Math.max(1, v.target_level));
  return (
    <Card className="h-full">
      <div className="flex h-full flex-col gap-2.5" data-testid="m17-sg-goal" data-skill={v.skill_id} data-status={v.status} data-shared={v.shared ? 'yes' : 'no'}>
        <div className="flex flex-wrap items-center gap-1.5">
          <GoalPill status={v.status} />
          <span className={`chip ${v.shared ? 'border-accent/40 bg-accent/10 text-eyebrow' : 'border-line text-ink-3'}`}><Icon name={v.shared ? 'users' : 'lock'} size={12} /> {t(v.shared ? 'm17.sg.sharedChip' : 'm17.sg.privateChip')}</span>
          {v.skill?.code && <span className="num text-[11.5px] text-ink-3">{v.skill.code}</span>}
        </div>
        <div className="text-[15px] font-semibold leading-snug">{v.skill ? pick(v.skill, 'name') : v.skill_id}</div>
        <div className="space-y-1">
          <div className="flex justify-between text-[12px] text-ink-3"><span>{t('m17.sg.levelNow', { level: f.num(v.level) })}</span><span>{t('m17.sg.levelTarget', { level: f.num(v.target_level) })}</span></div>
          <ProgressBar value={pct} tone={v.status === 'reached' ? 'ok' : v.status === 'overdue' ? 'bad' : 'accent'} label={t('m17.sg.climb', { level: f.num(v.level), target: f.num(v.target_level) })} />
        </div>
        <p className="text-[12.5px] text-ink-2">
          <Icon name="calendar" size={12} className="inline" /> {v.target_date ? t('m17.sg.by', { date: f.date(v.target_date) }) : t('m17.sg.noDate')}
          {v.days_left != null && v.status !== 'reached' && v.status !== 'removed' && <span className={v.days_left < 0 ? 'text-bad' : 'text-ink-3'}> · {f.relDays(v.days_left)}</span>}
        </p>
        {v.note && <p className="text-[12.5px] italic text-ink-2">“{v.note}”</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <WhyThis reasons={v.reasons} testId="m17-sg-why" />
          {!readOnly && v.status !== 'removed' && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="btn-ghost btn-sm" onClick={onEdit} data-testid="m17-sg-edit">{t('m17.sg.edit')}</button>
              <button type="button" className="btn-ghost btn-sm" onClick={onShare} data-testid="m17-sg-share">{t(v.shared ? 'm17.sg.unshare' : 'm17.sg.share')}</button>
              <button type="button" className="btn-ghost btn-sm text-bad" onClick={onWithdraw} data-testid="m17-sg-withdraw">{t('m17.sg.withdraw')}</button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export interface GoalDraft { skill_id: string; target_level: number; target_date: string; note: string; shared: boolean }
/** Add or change a goal. The checks are the RPC's (goalProblem), shown before anything is sent; saving asks for confirmation. */
export function GoalEditor({ d, open, initial, lockSkill, onClose }: { d: Pick<GoalsData, 'skills' | 'sec' | 'today' | 'states'>; open: boolean; initial?: Partial<GoalDraft>; lockSkill?: boolean; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [x, setX] = useState<GoalDraft>(() => ({ skill_id: initial?.skill_id ?? '', target_level: initial?.target_level ?? 2, target_date: initial?.target_date ?? addDays(d.today, 180), note: initial?.note ?? '', shared: initial?.shared ?? false }));
  const [ask, setAsk] = useState(false);
  const options = useMemo(() => d.skills.filter((s) => s.lifecycle !== 'obsolete' && s.area !== 'security' && !d.sec.has(String(s.competency_id)))
    .sort((a, b) => String(a.code ?? a.id).localeCompare(String(b.code ?? b.id))).map((s) => ({ value: s.id, label: `${s.code ?? s.id} · ${pick(s, 'name')}` })), [d.skills, d.sec, pick]);
  const skill = d.skills.find((s) => s.id === x.skill_id) ?? null;
  const now = Number(d.states.find((s) => s.skill_id === x.skill_id && s.active !== false)?.level ?? 0);
  const problem = x.skill_id ? goalProblem({ ...x, note: x.note || null }, skill, d.today, d.sec) : 'not_found';
  if (!open) return null;
  return (
    <>
      <Modal open={open} onClose={onClose} title={t(initial?.skill_id && lockSkill ? 'm17.sg.editorTitleSkill' : 'm17.sg.editorTitle', { skill: skill ? pick(skill, 'name') : '' })}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={problem !== 'ok'} onClick={() => setAsk(true)} data-testid="m17-sg-save">{t('m17.sg.save')}</button></div>}>
        <div className="space-y-3" data-testid="m17-sg-editor">
          {lockSkill && skill ? <p className="text-[14px] font-semibold">{skill.code} · {pick(skill, 'name')}</p>
            : <SelectField label={t('m17.sg.skill')} name="skill" value={x.skill_id} onChange={(v) => setX({ ...x, skill_id: v })} placeholder={t('common.choose')} options={options} required />}
          {x.skill_id && <p className="text-[12.5px] text-ink-3">{t('m17.sg.levelNowLong', { level: f.num(now) })}</p>}
          <div role="radiogroup" aria-label={t('m17.sg.targetLevel')} className="space-y-1">
            <div className="text-[13px] font-semibold">{t('m17.sg.targetLevel')} <span className="text-bad">*</span></div>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((n) => <button key={n} type="button" role="radio" aria-checked={x.target_level === n} className={`chip ${x.target_level === n ? 'border-accent bg-accent/10 text-eyebrow' : 'border-line text-ink-2'}`} onClick={() => setX({ ...x, target_level: n })} data-testid={`m17-sg-level-${n}`}>{t(`m17.sg.level.${n}`)}</button>)}
            </div>
          </div>
          <TextField type="date" label={t('m17.sg.targetDate')} name="date" value={x.target_date} onChange={(v) => setX({ ...x, target_date: v })} required
            hint={t('m17.sg.dateHint', { min: f.date(addDays(d.today, GOAL_RULES.minDays)), max: f.date(addDays(d.today, GOAL_RULES.maxDays)) })} />
          <TextArea label={t('m17.sg.note')} name="note" rows={2} value={x.note} onChange={(v) => setX({ ...x, note: v })} hint={t('m17.sg.noteHint', { n: f.num(GOAL_RULES.noteMax - x.note.trim().length) })} />
          <CheckboxField label={t('m17.sg.shareLabel')} hint={t('m17.sg.shareHint')} checked={x.shared} onChange={(v) => setX({ ...x, shared: v })} />
          {problem !== 'ok' && x.skill_id && <p className="text-[12.5px] text-bad" role="alert" data-testid="m17-sg-problem">{t(`m17.sg.problem.${problem}`)}</p>}
        </div>
      </Modal>
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title={t('m17.sg.confirmSave', { skill: skill ? pick(skill, 'name') : '' })}
        consequence={t(x.shared ? 'm17.sg.confirmSaveShared' : 'm17.sg.confirmSavePrivate', { level: f.num(x.target_level), date: x.target_date ? f.date(x.target_date) : '—' })}
        onConfirm={async () => { const r = await act(() => repo.rpc.saveSkillGoal({ skill_id: x.skill_id, target_level: x.target_level, target_date: x.target_date, note: x.note.trim() || null, shared: x.shared })); if (r.ok) onClose(); }} />
    </>
  );
}

/** Share / unshare and withdraw confirmations for one goal. */
export function GoalActions({ d, v, mode, onClose }: { d: GoalsData; v: GoalsData['views'][number] | null; mode: 'edit' | 'share' | 'withdraw' | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  if (!v || !mode) return null;
  const name = v.skill ? pick(v.skill, 'name') : v.skill_id;
  if (mode === 'edit') return <GoalEditor d={d} open lockSkill initial={{ skill_id: v.skill_id, target_level: v.target_level, target_date: v.target_date ?? undefined, note: v.note ?? '', shared: v.shared }} onClose={onClose} />;
  if (mode === 'share') return (
    <ConfirmDialog open onClose={onClose} title={t(v.shared ? 'm17.sg.confirmUnshare' : 'm17.sg.confirmShare', { skill: name })} consequence={t(v.shared ? 'm17.sg.confirmUnshareBody' : 'm17.sg.confirmShareBody')}
      onConfirm={async () => { await act(() => repo.rpc.shareSkillGoal(v.skill_id, !v.shared)); }} />
  );
  return (
    <ConfirmDialog open onClose={onClose} danger title={t('m17.sg.confirmWithdraw', { skill: name })} consequence={t('m17.sg.confirmWithdrawBody')}
      onConfirm={async () => { await act(() => repo.rpc.withdrawSkillGoal(v.skill_id)); }} />
  );
}

/** Compact strip of goals for the passport (mine, or the shared goals of a person in my scope). */
export function GoalsStrip({ person, readOnly = false }: { person: string | null; readOnly?: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const q = useGoalsData(person);
  const live = (q.data?.views ?? []).filter((v) => v.status !== 'removed');
  if (!q.data) return null;
  if (readOnly && !live.length) return <p className="text-[12.5px] text-ink-3" data-testid="m17-sg-strip-none">{t('m17.sg.stripNoneShared')}</p>;
  return (
    <Card title={t(readOnly ? 'm17.sg.stripTitleTeam' : 'm17.sg.stripTitle')} eyebrow={t('m17.sg.eyebrow')}
      actions={!readOnly ? <L to="/my/skills/goals" className="btn-outline btn-sm no-underline" data-testid="m17-sg-to-goals">{t(live.length ? 'm17.sg.manage' : 'm17.sg.addFirst')}</L> : undefined}>
      <div data-testid="m17-sg-strip" data-count={live.length}>
        {live.length ? (
          <ul className="flex flex-wrap gap-2">
            {live.slice(0, 6).map((v) => (
              <li key={v.id} className="flex min-w-[220px] flex-1 items-center gap-2 rounded-card border border-line px-3 py-2" data-testid="m17-sg-strip-item" data-status={v.status}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{v.skill ? pick(v.skill, 'name') : v.skill_id}</span>
                  <span className="block text-[12px] text-ink-3">{t('m17.sg.stripLine', { level: f.num(v.level), target: f.num(v.target_level), date: v.target_date ? f.date(v.target_date) : '—' })}</span>
                </span>
                <GoalPill status={v.status} />
              </li>
            ))}
            {live.length > 6 && <li className="self-center text-[12.5px] text-ink-3">+{f.num(live.length - 6)}</li>}
          </ul>
        ) : <EmptyState title={t('m17.sg.stripEmpty')}>{t('m17.sg.stripEmptyBody')}</EmptyState>}
      </div>
    </Card>
  );
}

/** "Add to my goals" from the passport's evidence drawer (or any skill view). */
export function AddGoalButton({ skillId, person }: { skillId: string; person: string | null }) {
  const t = useT();
  const q = useGoalsData(person);
  const [open, setOpen] = useState(false);
  if (!q.data) return null;
  const skill = q.data.skills.find((s) => s.id === skillId);
  if (!skill || skill.area === 'security' || q.data.sec.has(String(skill.competency_id)) || skill.lifecycle === 'obsolete') return null;
  const existing = q.data.views.find((v) => v.skill_id === skillId && v.status !== 'removed');
  if (existing) return <L to="/my/skills/goals" className="btn-ghost btn-sm no-underline" data-testid="m17-sg-on-goals"><Icon name="check" size={12} /> {t('m17.sg.onGoals')}</L>;
  const lvl = Number(q.data.states.find((s) => s.skill_id === skillId && s.active !== false)?.level ?? 0);
  return (
    <>
      <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(true)} data-testid="m17-sg-add-from-skill"><Icon name="plus" size={12} /> {t('m17.sg.addToGoals')}</button>
      {open && <GoalEditor d={q.data} open lockSkill initial={{ skill_id: skillId, target_level: Math.min(4, lvl + 1) }} onClose={() => setOpen(false)} />}
    </>
  );
}
