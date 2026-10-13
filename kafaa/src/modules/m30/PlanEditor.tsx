// FS81 transition plan editor (HR, transformation A), used by the board (new plan) and the plan page (edit). Nothing is saved until
// HR confirms: the server preview (rpc.previewTransitionPlan, the same rule as saving) shows the first problem and the ladder-rung
// alert of the chosen roles; HR ticks the simulator / OJT practice for every alerted task, and activation stays disabled until each
// one has practice. Retraining can start from the FS11 bridge curriculum of the target role. Every write goes through an RPC behind
// a ConfirmDialog.
import { useEffect, useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { Callout, Card, ConfirmDialog, Icon, SelectField, Skeleton, TextField } from '../../ui';
import {
  MAX_REVIEWS, OJT_REPS, PLAN_HORIZONS, RETRAIN_KINDS, REVIEW_MAX_GAP, SIM_REPS, TRIGGERS, addDays, daysFrom, doneReviews,
  type AlertTask, type PlanInput, type PlanRow, type PracticeItem, type PracticeOption, type RetrainItem,
} from './transition';
import type { Candidate } from './backend/rpc';
import { RungAlertPanel, type TpRefs } from './ui.fs81';
import { HorizonToggle } from './ui';

type Draft = Omit<PlanInput, 'activate'>;
/** Stored titles are bilingual data (both languages whatever the page language), like the seed's. */
const practiceTitles = (en: string, ar: string) => ({ title_en: `Guided practice: ${en}`, title_ar: `ممارسة موجّهة: ${ar}` });
const keyOf = (p: Pick<PracticeItem, 'task_id' | 'kind' | 'ref_id'>) => `${p.task_id}|${p.kind}|${p.ref_id}`;

/** Review dates every six months (182 days) after `from`, up to the end, at most 12 in all. */
export function cadence(from: string, end: string, have = 0): string[] {
  const out: string[] = [];
  let d = addDays(from, 182);
  while (daysFrom(d, end) >= 0 && out.length + have < MAX_REVIEWS) { out.push(d); d = addDays(d, 182); }
  if (!out.length && daysFrom(from, end) > 0 && daysFrom(from, end) <= REVIEW_MAX_GAP) out.push(end);
  return out;
}
export function newDraft(c: Candidate | null): Draft {
  const start = todayIso();
  const end = addDays(addDays(start, 730), -1);
  return {
    plan_id: null, person_id: c?.person_id ?? '', protected_role_id: c?.role_id ?? '', protected_until: addDays(start, 365), target_role_id: '', horizon: '2030', trigger: 'task_automation',
    start_on: start, end_on: end, review_dates: cadence(start, end), retraining: [], practice: [], note_en: '', note_ar: '',
  };
}
export function draftOf(plan: PlanRow): Draft {
  return {
    plan_id: plan.id, person_id: plan.person_id, protected_role_id: plan.protected_role_id, protected_until: plan.protected_until, target_role_id: plan.target_role_id, horizon: plan.horizon,
    trigger: plan.trigger, start_on: plan.start_on, end_on: plan.end_on, review_dates: plan.reviews.filter((r) => !r.done_on).map((r) => r.due_on),
    retraining: plan.retraining.map((r) => ({ ...r })), practice: plan.practice.map((p) => ({ ...p })), note_en: plan.note_en, note_ar: plan.note_ar,
  };
}

/** Debounced value (the preview runs on the server; one call after typing settles). */
function useSettled<T>(v: T, ms = 300): T {
  const [s, setS] = useState(v);
  useEffect(() => { const h = setTimeout(() => setS(v), ms); return () => clearTimeout(h); }, [v, ms]);
  return s;
}

export function PlanEditor({ refs, candidates, plan, onClose, onSaved }: { refs: TpRefs; candidates: Candidate[]; plan: PlanRow | null; onClose: () => void; onSaved: (id: string) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [d, setD] = useState<Draft>(() => (plan ? draftOf(plan) : newDraft(null)));
  const [confirm, setConfirm] = useState<'draft' | 'activate' | null>(null);
  const done = doneReviews(plan);
  const isActive = plan?.status === 'active';
  const json = useSettled(JSON.stringify(d));
  const pv = useQuery(['transition_plans'], async () => {
    const input = JSON.parse(json) as Draft;
    const [draftCheck, activateCheck] = await Promise.all([repo.rpc.previewTransitionPlan({ ...input, activate: false }), repo.rpc.previewTransitionPlan({ ...input, activate: true })]);
    return { draftCheck, activateCheck };
  }, [json]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const pickPerson = (id: string) => {
    const c = candidates.find((x) => x.person_id === id) ?? null;
    setD((x) => ({ ...x, person_id: id, protected_role_id: c?.role_id ?? '', target_role_id: x.target_role_id === c?.role_id ? '' : x.target_role_id, practice: [] }));
  };
  const free = candidates.filter((c) => !c.open_plan_id || c.person_id === plan?.person_id);
  const targets = useMemo(() => refs.roles.filter((r) => r.id !== d.protected_role_id && (r.lifecycle === 'current' || r.lifecycle === 'concept' || r.lifecycle == null)), [refs.roles, d.protected_role_id]);
  const selected = new Set(d.practice.map(keyOf));
  const toggle = (task: AlertTask, o: PracticeOption) => {
    const k = keyOf({ task_id: task.task_id, kind: o.kind, ref_id: o.ref_id });
    set('practice', selected.has(k) ? d.practice.filter((p) => keyOf(p) !== k) : [...d.practice, { task_id: task.task_id, kind: o.kind, ref_id: o.ref_id, reps: o.kind === 'simulator' ? SIM_REPS.def : OJT_REPS.def }]);
  };
  const fillBridge = async () => {
    const v = await repo.rpc.roleTransformation(d.target_role_id, d.horizon === '2035' ? '2035' : '2030');
    const steps = v?.map?.bridge ?? [];
    const due = (i: number) => addDays(d.start_on, Math.min(daysFrom(d.start_on, d.end_on), 90 * (i + 1)));
    const items: RetrainItem[] = steps.slice(0, 8).map((s, i) => {
      const c = s.course_id ? refs.courseById.get(s.course_id) : null;
      return c ? { kind: 'course', ref_id: c.id, title_en: c.title_en, title_ar: c.title_ar, hours: Number(s.hours), due_on: due(i) }
        : { kind: 'practice', ref_id: null, ...practiceTitles(refs.skillById.get(s.skill_id ?? s.ref_id)?.name_en ?? s.ref_id, refs.skillById.get(s.skill_id ?? s.ref_id)?.name_ar ?? s.ref_id), hours: Number(s.hours), due_on: due(i) };
    });
    set('retraining', items);
  };
  const setR = (i: number, patch: Partial<RetrainItem>) => set('retraining', d.retraining.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async (activate: boolean) => {
    const r = await act(() => repo.rpc.saveTransitionPlan({ ...d, activate }), { success: activate ? t('m30.tp.ed.activated') : t('m30.tp.ed.saved') });
    if (r.ok && r.data) onSaved(r.data.id);
  };
  const draftProblem = pv.data?.draftCheck?.problem ?? null;
  const actProblem = pv.data?.activateCheck?.problem ?? null;
  const alert = pv.data?.activateCheck?.alert ?? pv.data?.draftCheck?.alert;
  return (
    <Card title={plan ? t('m30.tp.ed.editTitle') : t('m30.tp.ed.newTitle')} eyebrow={t('m30.tp.ed.eyebrow')} actions={<button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>}>
      <div className="space-y-5" data-testid="m30-tp-editor">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label={t('m30.tp.ed.person')} name="person_id" value={d.person_id} onChange={pickPerson} disabled={!!plan} placeholder={t('m30.tp.ed.choosePerson')}
            options={free.map((c) => ({ value: c.person_id, label: `${pick({ n_en: c.name, n_ar: c.name_ar }, 'n')} · ${pick(refs.roleById.get(c.role_id), 'title') || c.role_id}` }))} />
          <TextField label={t('m30.tp.protected')} name="protected_role" value={pick(refs.roleById.get(d.protected_role_id), 'title') || d.protected_role_id} onChange={() => undefined} disabled hint={t('m30.tp.ed.protectedHint')} />
          <SelectField label={t('m30.tp.target')} name="target_role_id" value={d.target_role_id} onChange={(v) => setD((x) => ({ ...x, target_role_id: v, practice: [] }))} placeholder={t('m30.tp.ed.chooseRole')}
            options={targets.map((r) => ({ value: r.id, label: `${pick(r, 'title')}${r.lifecycle === 'concept' ? ` (${t('m30.tp.concept')})` : ''}` }))} />
          <SelectField label={t('m30.tp.ed.trigger')} name="trigger" value={d.trigger} onChange={(v) => set('trigger', v)} options={TRIGGERS.map((x) => ({ value: x, label: t(`m30.tp.trigger.${x}`) }))} />
          <TextField label={t('m30.tp.ed.start')} name="start_on" type="date" value={d.start_on} onChange={(v) => set('start_on', v)} disabled={isActive} />
          <TextField label={t('m30.tp.ed.end')} name="end_on" type="date" value={d.end_on} onChange={(v) => set('end_on', v)} />
          <TextField label={t('m30.tp.ed.until')} name="protected_until" type="date" value={d.protected_until} onChange={(v) => set('protected_until', v)} hint={t('m30.tp.ed.untilHint')} />
          <HorizonToggle value={(PLAN_HORIZONS as readonly string[]).includes(d.horizon) ? (d.horizon as '2030' | '2035') : '2030'} onChange={(h) => setD((x) => ({ ...x, horizon: h, practice: [] }))} />
        </div>

        <fieldset className="space-y-2 rounded-card border border-line p-3" data-testid="m30-tp-ed-reviews">
          <legend className="px-1 text-[13px] font-semibold">{t('m30.tp.reviews')}</legend>
          <p className="text-[12.5px] text-ink-2">{t('m30.tp.ed.reviewsHint', { n: f.num(REVIEW_MAX_GAP) })}</p>
          {done.length > 0 && <p className="text-[12.5px] text-ink-3">{t('m30.tp.ed.doneReviews', { dates: done.map((r) => f.date(r.due_on)).join(t('m30.tp.listSep')) })}</p>}
          <div className="flex flex-wrap gap-2">
            {d.review_dates.map((r, i) => (
              <span key={i} className="flex items-end gap-1">
                <TextField label={t('m30.tp.ed.reviewN', { n: f.num(done.length + i + 1) })} name={`review-${i}`} type="date" value={r} onChange={(v) => set('review_dates', d.review_dates.map((x, j) => (j === i ? v : x)))} />
                <button type="button" className="btn-ghost btn-sm" aria-label={t('m30.tp.ed.remove')} onClick={() => set('review_dates', d.review_dates.filter((_, j) => j !== i))}><Icon name="close" size={13} /></button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => set('review_dates', [...d.review_dates, addDays(d.review_dates[d.review_dates.length - 1] ?? done[done.length - 1]?.due_on ?? d.start_on, 182)])}><Icon name="plus" size={13} />{t('m30.tp.ed.addReview')}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => set('review_dates', cadence(done[done.length - 1]?.due_on ?? d.start_on, d.end_on, done.length))} data-testid="m30-tp-ed-cadence">{t('m30.tp.ed.cadence')}</button>
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-card border border-line p-3" data-testid="m30-tp-ed-retraining">
          <legend className="px-1 text-[13px] font-semibold">{t('m30.tp.retraining')}</legend>
          {d.retraining.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-card bg-sunken p-2 sm:grid-cols-2 lg:grid-cols-6">
              <SelectField label={t('m30.tp.ed.kind')} name={`rk-${i}`} value={r.kind} onChange={(v) => setR(i, { kind: v, ref_id: v === 'course' ? r.ref_id : null })} options={RETRAIN_KINDS.map((k) => ({ value: k, label: t(`m30.tp.rkind.${k}`) }))} />
              {r.kind === 'course' ? (
                <SelectField label={t('m30.tp.ed.course')} name={`rc-${i}`} value={r.ref_id ?? ''} placeholder={t('m30.tp.ed.chooseCourse')}
                  onChange={(v) => { const c = refs.courseById.get(v); setR(i, { ref_id: v, title_en: c?.title_en ?? r.title_en, title_ar: c?.title_ar ?? r.title_ar, hours: Number(c?.duration_hours ?? r.hours) || r.hours }); }}
                  options={refs.courses.filter((c) => c.audience === 'staff' && !c.initial).map((c) => ({ value: c.id, label: pick(c, 'title') }))} />
              ) : <span className="hidden lg:block" />}
              <TextField label={t('m30.tp.ed.titleEn')} name={`rte-${i}`} value={r.title_en} onChange={(v) => setR(i, { title_en: v })} />
              <TextField label={t('m30.tp.ed.titleAr')} name={`rta-${i}`} value={r.title_ar} onChange={(v) => setR(i, { title_ar: v })} />
              <TextField label={t('m30.tp.ed.hours')} name={`rh-${i}`} type="number" value={String(r.hours)} onChange={(v) => setR(i, { hours: Number(v) })} />
              <span className="flex items-end gap-1">
                <TextField label={t('m30.tp.ed.due')} name={`rd-${i}`} type="date" value={r.due_on} onChange={(v) => setR(i, { due_on: v })} />
                <button type="button" className="btn-ghost btn-sm" aria-label={t('m30.tp.ed.remove')} onClick={() => set('retraining', d.retraining.filter((_, j) => j !== i))}><Icon name="close" size={13} /></button>
              </span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => set('retraining', [...d.retraining, { kind: 'course', ref_id: null, title_en: '', title_ar: '', hours: 8, due_on: addDays(d.start_on, 90) }])} data-testid="m30-tp-ed-add-step"><Icon name="plus" size={13} />{t('m30.tp.ed.addStep')}</button>
            <button type="button" className="btn-ghost btn-sm" disabled={!d.target_role_id || refs.roleById.get(d.target_role_id)?.lifecycle === 'concept'} onClick={fillBridge} data-testid="m30-tp-ed-bridge">{t('m30.tp.ed.fromBridge')}</button>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m30.tp.ed.noteEn')} name="note_en" value={d.note_en ?? ''} onChange={(v) => set('note_en', v)} />
          <TextField label={t('m30.tp.ed.noteAr')} name="note_ar" value={d.note_ar ?? ''} onChange={(v) => set('note_ar', v)} />
        </div>

        <section className="space-y-2" data-testid="m30-tp-ed-alert">
          <h3 className="text-[14px] font-semibold">{t('m30.tp.alertTitle')}</h3>
          <p className="text-[12.5px] text-ink-2">{t('m30.tp.ed.alertHint')}</p>
          {!alert ? <Skeleton lines={3} /> : <RungAlertPanel alert={alert} refs={refs} mode="edit" selected={selected} onToggle={toggle} />}
        </section>

        {draftProblem ? <Callout tone="bad"><span data-testid="m30-tp-ed-problem" data-code={draftProblem}>{t(`m30.tp.err.${draftProblem}`)}</span></Callout>
          : actProblem ? <Callout tone="sim"><span data-testid="m30-tp-ed-problem" data-code={actProblem}>{t('m30.tp.ed.draftOnly', { why: t(`m30.tp.err.${actProblem}`) })}</span></Callout>
            : pv.data && <Callout tone="ok"><span data-testid="m30-tp-ed-ready">{t('m30.tp.ed.ready')}</span></Callout>}
        <div className="flex flex-wrap gap-2">
          {!isActive && <button type="button" className="btn-outline" disabled={!pv.data || !!draftProblem || json !== JSON.stringify(d)} onClick={() => setConfirm('draft')} data-testid="m30-tp-ed-save">{t('m30.tp.ed.saveDraft')}</button>}
          <button type="button" className="btn-primary" disabled={!pv.data || !!actProblem || json !== JSON.stringify(d)} onClick={() => setConfirm('activate')} data-testid="m30-tp-ed-activate">{isActive ? t('m30.tp.ed.saveActive') : t('m30.tp.ed.activate')}</button>
        </div>
      </div>
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)}
        title={confirm === 'activate' ? (isActive ? t('m30.tp.ed.saveActive') : t('m30.tp.ed.activateTitle')) : t('m30.tp.ed.saveDraft')}
        consequence={confirm === 'activate' ? (isActive ? t('m30.tp.ed.saveActiveBody') : t('m30.tp.ed.activateBody')) : t('m30.tp.ed.saveDraftBody')}
        confirmLabel={confirm === 'activate' ? (isActive ? t('m30.tp.ed.saveActive') : t('m30.tp.ed.activate')) : t('m30.tp.ed.saveDraft')}
        onConfirm={async () => { await save(confirm === 'activate'); setConfirm(null); }} />
    </Card>
  );
}
