// FS56/FS57 shared page pieces (FS wave F · E4): labels, the before/after level shift, the measurement timeline, verdict / state / route
// pills, the coverage bar and the backlog decision drawer (what-if computed in memory; saved only after a confirmation). Pages never import
// backend/*.
import { useMemo, useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { useLang, usePick, useFormat, useT } from '../../i18n';
import { Card, ConfirmDialog, Drawer, Icon, StatusPill, WhyThis, type PillTone } from '../../ui';
import { L } from '../../i18n';
import { decisionProblem, whatIf, ROUTES_GB, type BacklogView, type CoverageReport, type GapRoute, type WhatIfMove } from './coverage';
import type { SkillChangeRow } from './skillChange';

/** Skill and job-role names (both public). */
export function useFs56Refs() {
  const repo = useRepo();
  return useQuery(['skills', 'job_roles'], async () => {
    const [skills, roles] = await Promise.all([
      repo.list('skills').catch(() => [] as RowOf<'skills'>[]),
      repo.list('job_roles').catch(() => [] as RowOf<'job_roles'>[]),
    ]);
    return { skills, roles };
  });
}
export function useFs56Labels() {
  const refs = useFs56Refs();
  const pick = usePick();
  return useMemo(() => {
    const sk = new Map((refs.data?.skills ?? []).map((s) => [s.id, s]));
    const ro = new Map((refs.data?.roles ?? []).map((r) => [r.id, r]));
    return {
      skill: (id: string) => (sk.get(id) ? pick(sk.get(id) as never, 'name') : id),
      role: (id: string) => (ro.get(id) ? pick(ro.get(id) as never, 'title') : id),
      roleRow: (id: string) => ro.get(id),
    };
  }, [refs.data, pick]);
}

/** Mean level x100 as "1.4". */
export function useLv() {
  const f = useFormat();
  return (x100: number | null | undefined) => (x100 == null ? '—' : f.num(x100 / 100, { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
}
export function useSigned() {
  const f = useFormat();
  return (x100: number | null | undefined) => (x100 == null ? '—' : `${x100 > 0 ? '+' : x100 < 0 ? '−' : '±'}${f.num(Math.abs(x100) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

/** Before → after on a 0-4 level scale (participants), with the comparison group's after-level as a tick when there is one. */
export function LevelShift({ row }: { row: Pick<SkillChangeRow, 'before_x100' | 'after_x100' | 'comparison_change_x100'> }) {
  const t = useT();
  const lv = useLv();
  if (row.before_x100 == null || row.after_x100 == null) return <span className="text-ink-3">—</span>;
  const pos = (x: number) => `${Math.max(0, Math.min(100, (x / 400) * 100))}%`;
  const comp = row.comparison_change_x100 == null ? null : row.before_x100 + row.comparison_change_x100;
  const lo = Math.min(row.before_x100, row.after_x100), hi = Math.max(row.before_x100, row.after_x100);
  return (
    <span className="inline-flex min-w-[150px] flex-col gap-1" aria-label={t('m25.sc.shiftAria', { before: lv(row.before_x100), after: lv(row.after_x100) })} data-testid="m25-sc-shift">
      <span className="flex items-baseline gap-1.5 text-[12.5px]"><span className="num text-ink-2">{lv(row.before_x100)}</span><Icon name="chevron" size={12} className="text-ink-3 rtl:-scale-x-100" /><span className="num font-semibold">{lv(row.after_x100)}</span></span>
      <span className="relative h-2 rounded-full bg-sunken" aria-hidden>
        <span className="absolute inset-y-0 rounded-full bg-accent" style={{ insetInlineStart: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
        <span className="absolute -top-0.5 h-3 w-1 rounded-sm bg-ink-3" style={{ insetInlineStart: pos(row.before_x100) }} />
        <span className="absolute -top-0.5 h-3 w-1 rounded-sm bg-ink" style={{ insetInlineStart: pos(row.after_x100) }} />
        {comp !== null && <span className="absolute -top-1 h-4 w-0.5 border-s-2 border-dashed border-ink-2" style={{ insetInlineStart: pos(comp) }} title={t('m25.sc.compTick')} />}
      </span>
    </span>
  );
}

/** The measurement window as a small timeline (before - learning - completion - 90 days - after). */
export function MethodTimeline() {
  const t = useT();
  const step = (n: string, title: string, body: string, tone = 'border-line') => (
    <li className={`min-w-0 flex-1 rounded-card border ${tone} bg-panel p-3`}>
      <span className="caps">{n}</span>
      <div className="font-semibold">{title}</div>
      <p className="text-[12.5px] text-ink-2">{body}</p>
    </li>
  );
  return (
    <ol className="flex flex-col gap-2 sm:flex-row" data-testid="m25-sc-method">
      {step('1', t('m25.sc.m.before'), t('m25.sc.m.beforeBody'))}
      {step('2', t('m25.sc.m.learning'), t('m25.sc.m.learningBody'))}
      {step('3', t('m25.sc.m.window'), t('m25.sc.m.windowBody'), 'border-accent')}
      {step('4', t('m25.sc.m.after'), t('m25.sc.m.afterBody'))}
      {step('5', t('m25.sc.m.compare'), t('m25.sc.m.compareBody'))}
    </ol>
  );
}

const VERDICT_TONE: Record<SkillChangeRow['verdict'], PillTone> = { moves: 'ok', some: 'info', flat: 'neutral', window_open: 'sim', suppressed: 'neutral' };
export function ScVerdict({ v }: { v: SkillChangeRow['verdict'] }) {
  const t = useT();
  return <span data-testid="m25-sc-verdict" data-verdict={v}><StatusPill tone={VERDICT_TONE[v]}>{t(`m25.sc.verdict.${v}`)}</StatusPill></span>;
}
export function MethodChip({ m }: { m: SkillChangeRow['method'] }) {
  const t = useT();
  if (!m) return <span className="text-ink-3">—</span>;
  return <span className="inline-flex items-center rounded-full border border-line px-2 text-[11.5px]" data-testid="m25-sc-method-chip" data-method={m}>{t(`m25.sc.method.${m}`)}</span>;
}
const STATE_TONE: Record<BacklogView['state'], PillTone> = { open: 'bad', planned: 'info', covered: 'ok' };
export function GbState({ s }: { s: BacklogView['state'] }) {
  const t = useT();
  return <span data-testid="m25-gb-state" data-state={s}><StatusPill tone={STATE_TONE[s]}>{t(`m25.gb.state.${s}`)}</StatusPill></span>;
}
export function RoutePill({ r }: { r: GapRoute | null }) {
  const t = useT();
  if (!r) return <span className="text-ink-3">{t('m25.gb.undecided')}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 text-[11.5px] font-semibold text-eyebrow" data-testid="m25-gb-route" data-route={r}><Icon name={r === 'build' ? 'book' : r === 'partner' ? 'users' : 'download'} className="h-3 w-3" />{t(`m25.gb.route.${r}`)}</span>;
}

/** Coverage score 0-100 with a bar (null = path-only / unscored). */
export function CoverageBar({ score, testId }: { score: number | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  if (score === null) return <span className="text-[12px] text-ink-3">{t('m25.cov.unscored')}</span>;
  const tone = score >= 90 ? 'bg-ok' : score >= 70 ? 'bg-accent' : 'bg-bad';
  return (
    <span className="inline-flex min-w-[120px] items-center gap-2" data-testid={testId ?? 'm25-cov-bar'} data-score={score}>
      <span className="num w-9 text-end font-semibold">{f.num(score)}</span>
      <span className="h-2 flex-1 rounded-full bg-sunken" aria-hidden><span className={`block h-2 rounded-full ${tone}`} style={{ width: `${score}%` }} /></span>
    </span>
  );
}

/** Predicted moves (what-if) as a compact list. */
export function MovesList({ moves, labels, empty }: { moves: WhatIfMove[]; labels: ReturnType<typeof useFs56Labels>; empty?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  if (!moves.length) return <p className="text-[12.5px] text-ink-3" data-testid="m25-moves-none">{empty ?? t('m25.cov.wi.none')}</p>;
  return (
    <ul className="divide-y divide-line rounded-card border border-line" data-testid="m25-moves">
      {moves.map((m) => (
        <li key={`${m.role_id}@${m.horizon}`} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[13px]" data-testid="m25-move">
          <span className="min-w-0 flex-1 truncate">{labels.role(m.role_id)}</span>
          <span className="caps">{t(`m25.cov.h.${m.horizon}`)}</span>
          <span className="num text-ink-2">{f.num(m.before)}</span><Icon name="chevron" size={12} className="text-ink-3 rtl:-scale-x-100" /><span className="num font-semibold">{f.num(m.after)}</span>
          <span className="num rounded-full bg-ok-bg px-2 text-[12px] font-semibold text-ok" data-testid="m25-move-delta">+{f.num(m.delta)}</span>
        </li>
      ))}
    </ul>
  );
}

const addDays = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Record a backlog decision. The predicted moves are recomputed live from the coverage rule; nothing is saved until confirmed. */
export function DecisionDrawer({ row, report, plan: seedPlan, open, onClose }: { row: BacklogView | null; report: CoverageReport; plan?: { title: string; level: number } | null; open: boolean; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const labels = useFs56Labels();
  const [form, setForm] = useState(() => init(row, seedPlan));
  const [confirm, setConfirm] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const pickStaff = usePickName();
  const k = `${row?.id}|${seedPlan?.title ?? ''}|${seedPlan?.level ?? ''}|${open}`;
  if (open && key !== k) { setKey(k); setForm(init(row, seedPlan)); }
  if (!row) return null;
  const staff = new Map(report.staff.map((p) => [p.id, p]));
  const input = {
    id: row.id, owner_role: form.owner, owner_person_id: form.person || null, due_on: form.due, route: form.route, rationale: form.rationale,
    plan: form.withPlan ? { title: form.title, level: Number(form.level), hours: Number(form.hours) } : null,
  };
  const today = new Date().toISOString().slice(0, 10);
  const problem = decisionProblem(input, row, today, (id) => staff.has(id));
  const moves = whatIf(report.roles, row.skill_id, form.withPlan ? Number(form.level) || row.level : row.level);
  const set = (p: Partial<typeof form>) => setForm((x) => ({ ...x, ...p }));
  return (
    <>
      <Drawer open={open} onClose={onClose} title={t('m25.dec.title', { skill: labels.skill(row.skill_id), level: row.level })}
        footer={<div className="flex flex-wrap items-center justify-end gap-2">
          {problem && <span className="me-auto text-[12.5px] text-bad" role="alert" data-testid="m25-dec-problem" data-code={problem}>{t(`m25.dec.problem.${problem}`)}</span>}
          <button type="button" className="btn-outline" onClick={onClose}>{t('m25.common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={!!problem || !report.can_edit} onClick={() => setConfirm(true)} data-testid="m25-dec-save"><Icon name="check" />{t('m25.dec.save')}</button>
        </div>}>
        <div className="space-y-4" data-testid="m25-dec-form">
          <p className="text-[13px] text-ink-2">{t('m25.dec.intro')}</p>
          <fieldset className="space-y-1">
            <legend className="caps">{t('m25.dec.route')}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {ROUTES_GB.map((r) => (
                <label key={r} className={`flex cursor-pointer items-start gap-2 rounded-card border p-2 text-[13px] ${form.route === r ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                  <input type="radio" name="m25-route" checked={form.route === r} onChange={() => set({ route: r })} data-testid={`m25-dec-route-${r}`} />
                  <span><span className="font-semibold">{t(`m25.gb.route.${r}`)}</span><span className="block text-[12px] text-ink-3">{t(`m25.gb.routeHint.${r}`)}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="caps">{t('m25.dec.owner')}</span>
              <select className="input" value={form.owner} onChange={(e) => set({ owner: e.target.value })} data-testid="m25-dec-owner">
                {report.owners.map((o) => <option key={o} value={o}>{t(`fs.owner.${o}`)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="caps">{t('m25.dec.lead')}</span>
              <select className="input" value={form.person} onChange={(e) => set({ person: e.target.value })} data-testid="m25-dec-lead">
                <option value="">{t('m25.dec.noLead')}</option>
                {report.staff.map((p) => <option key={p.id} value={p.id}>{pickStaff(p)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="caps">{t('m25.dec.due')}</span>
              <input type="date" className="input" min={today} max="2030-12-31" value={form.due} onChange={(e) => set({ due: e.target.value })} data-testid="m25-dec-due" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m25.dec.rationale')}</span>
            <textarea className="input min-h-[84px]" value={form.rationale} maxLength={500} onChange={(e) => set({ rationale: e.target.value })} data-testid="m25-dec-rationale" />
            <span className="text-[12px] text-ink-3">{t('m25.dec.rationaleHint')}</span>
          </label>
          <div className="space-y-2 rounded-card border border-line p-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input type="checkbox" checked={form.withPlan} onChange={(e) => set({ withPlan: e.target.checked })} data-testid="m25-dec-withplan" />
              {t('m25.dec.withPlan')}
            </label>
            {form.withPlan && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input className="input" placeholder={t('m25.dec.planTitle')} aria-label={t('m25.dec.planTitle')} value={form.title} onChange={(e) => set({ title: e.target.value })} data-testid="m25-dec-plan-title" />
                <label className="flex items-center gap-1 text-[13px]">{t('m25.dec.planLevel')}
                  <select className="input" value={form.level} onChange={(e) => set({ level: e.target.value })} data-testid="m25-dec-plan-level">{[1, 2, 3].map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
                <label className="flex items-center gap-1 text-[13px]">{t('m25.dec.planHours')}
                  <input type="number" min={1} max={200} className="input w-20" value={form.hours} onChange={(e) => set({ hours: e.target.value })} data-testid="m25-dec-plan-hours" /></label>
              </div>
            )}
          </div>
          <div className="space-y-1" aria-live="polite">
            <div className="caps">{t('m25.dec.predicted')}</div>
            <MovesList moves={moves} labels={labels} />
            <p className="text-[12px] text-ink-3">{t('m25.dec.predictedNote')}</p>
          </div>
          {!s.can('learning_analytics', ['A']) && <p className="text-[12.5px] text-ink-3">{t('m25.dec.readOnly')}</p>}
        </div>
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m25.dec.confirmTitle')} consequence={t('m25.dec.confirmBody', { n: moves.length })} confirmLabel={t('m25.dec.save')}
        onConfirm={async () => { const r = await run(() => repo.rpc.decideGap(input)); setConfirm(false); if (r.ok) onClose(); }} />
    </>
  );
}
function init(row: BacklogView | null, plan?: { title: string; level: number } | null) {
  return {
    owner: row?.owner_role ?? 'nuclear_training', person: row?.owner_person_id ?? '', due: row?.due_on ?? addDays(180), route: (row?.route ?? 'build') as GapRoute,
    rationale: row?.rationale ?? '', withPlan: !!(plan || row?.plan), title: plan?.title ?? row?.plan?.title ?? '', level: String(plan?.level ?? row?.plan?.level ?? row?.level ?? 2),
    hours: String(row?.plan?.hours ?? 12),
  };
}
function usePickName() {
  const lang = useLang();
  return (p: { name: string; name_ar: string }) => (lang === 'ar' ? p.name_ar || p.name : p.name);
}

/** FS56 on the F25 course page: this course's skill change (or why there is none yet), with a link to the full table. */
export function SkillChangeCard({ courseId }: { courseId: string }) {
  const t = useT();
  const repo = useRepo();
  const f = useFormat();
  const q = useQuery(['skill_change_measures'], async () => {
    const r = await repo.rpc.skillChangeReport();
    return r.ok && r.data ? r.data.rows.find((x) => x.kind === 'course' && x.item_id === courseId) ?? null : null;
  }, [courseId]);
  const signed = useSigned();
  const row = q.data;
  return (
    <Card title={t('m25.sc.card.title')} actions={<L to="/training/skill-change" className="link text-[13px]" data-testid="m25-sc-card-link">{t('m25.sc.card.link')}</L>}>
      <div data-testid="m25-sc-card" data-verdict={row?.verdict ?? 'none'}>
        {!row ? <p className="text-[13px] text-ink-3">{t('m25.sc.card.none')}</p> : (
          <div className="flex flex-wrap items-center gap-4">
            <ScVerdict v={row.verdict} />
            {row.change_x100 !== null ? <LevelShift row={row} /> : null}
            {row.change_x100 !== null && <span className="text-[13px]">{t('m25.sc.card.line', { net: signed(row.net_x100 ?? row.change_x100), moved: f.num(row.moved_pct ?? 0) })}</span>}
            <MethodChip m={row.method} />
            <span className="text-[12px] text-ink-3" data-testid="m25-sc-card-window">{t('m25.sc.windowDays', { n: row.window_days })}</span>
            <WhyThis reasons={row.reasons} testId="why-sc-card" />
          </div>
        )}
      </div>
    </Card>
  );
}
