// M36 shared page helpers (FS64, FS65; owners: wave G E3). Labels, pills, the suppressed cell, the gap band bar (logical properties, so it
// mirrors in Arabic), academic term labels and reference data (skill names). Pages only; the rules live in regional.ts and pledges.ts.
import type { ReactNode } from 'react';
import { StatusPill, SimChip, type PillTone } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { TERM_RE } from './regional';
import type { Cell } from './pledges';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Catalogue skills (public) for names; a failed read returns an empty map. */
export function useSkills() {
  const repo = useRepo();
  return useQuery('skills', async () => new Map(((await (repo.list('skills') as Promise<Row[]>).catch(() => [] as Row[])) as Row[]).map((s) => [String(s.id), s])), []);
}
export function useSkillName(skills: Map<string, Row> | undefined) {
  const pick = usePick();
  return (id: string) => { const s = skills?.get(id); return s ? pick(s, 'name') : id; };
}

/** "Sep 2026 – Jan 2027" style label for an academic term code (2026S1). */
export function useTermLabel() {
  const t = useT();
  const f = useFormat();
  return (term: string) => {
    const m = TERM_RE.exec(term);
    if (!m) return term;
    const y = Number(m[1]);
    return t(`m36.term.S${m[2]}`, { y: f.num(y, { useGrouping: false }), y2: f.num(y + 1, { useGrouping: false }) });
  };
}

/** A number, or the suppressed mark (null = suppressed). */
export function Sup({ v, testId }: { v: number | null | undefined; testId?: string }) {
  const t = useT();
  const f = useFormat();
  if (v == null) return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true" data-testid={testId}>{t('common.suppressedShort')}</span>;
  return <span className="num" data-testid={testId} data-value={v}>{f.num(v)}</span>;
}
/** A ledger cell {value, suppressed}. */
export function CellView({ c, testId }: { c: Cell; testId?: string }) {
  return <Sup v={c.suppressed ? null : c.value} testId={testId} />;
}
/** Demand or gap band "low – high" (suppressed ends shown as such). */
export function Band({ lo, hi }: { lo: number | null; hi: number | null }) {
  const f = useFormat();
  const t = useT();
  if (lo == null || hi == null) return <Sup v={null} />;
  if (lo === hi) return <span className="num">{f.num(lo)}</span>;
  return <span className="num whitespace-nowrap">{t('m36.band', { lo: f.num(lo), hi: f.num(hi) })}</span>;
}
/** The gap band as a bar: hatched from low to high, a tick at the planning-scenario gap; mirrors in RTL (logical insets). */
export function GapBar({ lo, hi, plan, max }: { lo: number | null; hi: number | null; plan: number | null; max: number }) {
  const t = useT();
  if (lo == null || hi == null || max <= 0) return <span className="text-[11.5px] text-ink-3">{lo == null ? t('common.suppressedShort') : ''}</span>;
  const pc = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <span className="relative block h-3 w-full min-w-[96px] rounded-full bg-sunken" aria-hidden data-testid="m36-gap-bar">
      <span className="absolute inset-y-0 rounded-full border border-accent/40 bg-[repeating-linear-gradient(45deg,rgb(var(--accent)/0.18)_0_3px,rgb(var(--accent)/0.35)_3px_5px)]"
        style={{ insetInlineStart: pc(lo), width: `max(4px, calc(${pc(hi)} - ${pc(lo)}))` }} />
      {plan != null && <span className="absolute -top-0.5 h-4 w-0.5 rounded bg-ink" style={{ insetInlineStart: pc(plan) }} />}
    </span>
  );
}

export const COMMIT_TONE: Record<string, PillTone> = { on_track: 'ok', delivered: 'ok', at_risk: 'reserved', behind: 'bad', not_started: 'neutral', withdrawn: 'neutral' };
export function CommitStatusPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={COMMIT_TONE[status] ?? 'neutral'}><span data-testid="m36-commit-status" data-status={status}>{t(`m36.status.${status}`)}</span></StatusPill>;
}
export const TERM_TONE: Record<string, PillTone> = { planned: 'neutral', awaiting_report: 'info', on_track: 'ok', at_risk: 'reserved', behind: 'bad', delivered: 'ok', partly: 'reserved', missed: 'bad', not_reported: 'bad' };
export function TermStatusPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={TERM_TONE[status] ?? 'neutral'}><span data-testid="m36-term-status" data-status={status}>{t(`m36.termStatus.${status}`)}</span></StatusPill>;
}
export const HR_TONE: Record<string, PillTone> = { pending: 'info', acknowledged: 'ok', queried: 'reserved' };
export function HrPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={HR_TONE[status] ?? 'neutral'}><span data-testid="m36-hr-status" data-status={status}>{t(`m36.hr.${status}`)}</span></StatusPill>;
}
export const PLEDGE_TONE: Record<string, PillTone> = { met: 'ok', in_progress: 'info', not_started: 'neutral', lapsed: 'bad', withdrawn: 'neutral' };
export function PledgeStatusPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={PLEDGE_TONE[status] ?? 'neutral'}><span data-testid="m36-pledge-status" data-status={status}>{t(`m36.plStatus.${status}`)}</span></StatusPill>;
}
/** SIMULATED + SAMPLE label row: every number in the module is demo data. */
export function DemoLabels({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m36-demo-labels">
      <SimChip />
      <span>{t('m36.demoNote')}</span>
      {children}
    </div>
  );
}
/** Organisation name from a denormalised row (org_name_en / org_name_ar). */
export function useOrgName() {
  const pick = usePick();
  return (r: Row) => pick({ name_en: r.org_name_en ?? r.org_id, name_ar: r.org_name_ar ?? r.org_name_en ?? r.org_id }, 'name');
}
