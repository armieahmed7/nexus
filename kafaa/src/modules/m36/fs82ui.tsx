// FS82 / FS83 shared page helpers (wave I · E4): status pills, the SIMULATED money label, the round schedule strip, partner names
// from a cohort's denormalised partners (synthetic organisations carry their label), and the cohort module timeline. Pages only; the
// rules live in grants.ts and consortium.ts.
import type { ReactNode } from 'react';
import { StatusPill, SimChip, Timeline, type PillTone } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { roundPhase, type RoundPhase, type OutputState } from './grants';
import { moduleState, modulesOf, partnerOf, type CohortPhase, type Module, type Partner } from './consortium';
import type { Row } from './ui';

export const ROUND_TONE: Record<RoundPhase, PillTone> = { scheduled: 'neutral', open: 'ok', closed: 'info' };
export function RoundPill({ phase }: { phase: RoundPhase }) {
  const t = useT();
  return <StatusPill tone={ROUND_TONE[phase]}><span data-testid="m36-round-phase" data-phase={phase}>{t(`m36.gr.phase.${phase}`)}</span></StatusPill>;
}
export const APP_TONE: Record<string, PillTone> = { submitted: 'info', approved: 'ok', declined: 'bad', withdrawn: 'neutral' };
export function AppPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={APP_TONE[status] ?? 'neutral'}><span data-testid="m36-app-status" data-status={status}>{t(`m36.gr.status.${status}`)}</span></StatusPill>;
}
export const OUTPUT_TONE: Record<OutputState, PillTone> = { not_due: 'neutral', due: 'info', overdue: 'bad', submitted: 'info', accepted: 'ok', returned: 'reserved' };
export function OutputPill({ state }: { state: OutputState }) {
  const t = useT();
  return <StatusPill tone={OUTPUT_TONE[state]}><span data-testid="m36-output-state" data-state={state}>{t(`m36.gr.output.${state}`)}</span></StatusPill>;
}
export const COHORT_TONE: Record<CohortPhase, PillTone> = { nominating: 'info', confirmed: 'accent', running: 'ok', completed: 'neutral' };
export function CohortPill({ phase }: { phase: CohortPhase }) {
  const t = useT();
  return <StatusPill tone={COHORT_TONE[phase]}><span data-testid="m36-cohort-phase" data-phase={phase}>{t(`m36.cc.phase.${phase}`)}</span></StatusPill>;
}
export const MEMBER_TONE: Record<string, PillTone> = { nominated: 'info', accepted: 'ok', declined: 'bad', withdrawn: 'neutral', completed: 'ok' };
export function MemberPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={MEMBER_TONE[status] ?? 'neutral'}><span data-testid="m36-member-status" data-status={status}>{t(`m36.cc.member.${status}`)}</span></StatusPill>;
}
export const VISIT_TONE: Record<string, PillTone> = { logged: 'info', confirmed: 'ok', declined: 'bad', withdrawn: 'neutral' };
export function VisitPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={VISIT_TONE[status] ?? 'neutral'}><span data-testid="m36-visit-status" data-status={status}>{t(`m36.cc.visit.${status}`)}</span></StatusPill>;
}

/** "12,000 AED" with the SIMULATED marker kept nearby by the caller. */
export function useMoney() {
  const t = useT();
  const f = useFormat();
  return (n: number | null | undefined) => (n == null ? t('common.suppressedShort') : t('m36.gr.aed', { n: f.num(n) }));
}
export function useRange() {
  const t = useT();
  const f = useFormat();
  return (a: string, b: string) => (a === b ? f.date(a) : t('m36.gr.range', { a: f.date(a), b: f.date(b) }));
}

/** SIMULATED budgets + synthetic organisations label row. */
export function GrantLabels({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m36-gr-labels">
      <SimChip />
      <span>{t('m36.gr.simNote')}</span>
      {children}
    </div>
  );
}
export function ConsortiumLabels({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m36-cc-labels">
      <SimChip />
      <StatusPill tone="sim">{t('m36.cc.syntheticChip')}</StatusPill>
      <span>{t('m36.cc.simNote')}</span>
      {children}
    </div>
  );
}

/** The bi-monthly schedule as a strip of round cards (wraps on narrow screens). */
export function RoundStrip({ rounds, today }: { rounds: Row[]; today: string }) {
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const sorted = rounds.slice().sort((a, b) => (String(a.closes_on) < String(b.closes_on) ? -1 : 1));
  return (
    <ol className="flex min-w-0 flex-wrap gap-2" data-testid="m36-round-strip" aria-label={t('m36.gr.schedule')}>
      {sorted.map((r) => {
        const ph = roundPhase(r, today);
        return (
          <li key={r.id} className={`card min-w-[150px] flex-1 basis-40 p-3 ${ph === 'open' ? 'border-ok-line' : ''}`} data-testid="m36-round" data-id={r.id} data-phase={ph}>
            <div className="flex flex-wrap items-center justify-between gap-1"><span className="caps">{t('m36.gr.roundTo', { date: f.date(r.closes_on) })}</span><RoundPill phase={ph} /></div>
            <div className="mt-1 text-[12.5px] text-ink-2">{t('m36.gr.window', { a: f.date(r.opens_on), b: f.date(r.closes_on) })}</div>
            <div className="text-[12.5px] text-ink-2">{t('m36.gr.decideBy', { date: f.date(r.decide_by) })}</div>
            <div className="mt-1 text-[12.5px]"><span className="text-ink-3">{t('m36.gr.budget')}</span> <span className="num">{money(Number(r.budget))}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

/** Partner name (synthetic organisations keep their label in the name), from a cohort's partners list. */
export function usePartnerName() {
  const pick = usePick();
  return (cohort: Row | null | undefined, org: string) => {
    const p = cohort ? (partnerOf(cohort, org) as Partner | null) : null;
    return p ? pick(p as unknown as Row, 'name') : org;
  };
}

/** The shared modules, hosted in turn by the members (Nordic NNTP pattern), as a timeline. */
export function ModuleTimeline({ cohort, today }: { cohort: Row; today: string }) {
  const t = useT();
  const pick = usePick();
  const range = useRange();
  const partnerName = usePartnerName();
  const mods = modulesOf(cohort) as Module[];
  return (
    <div data-testid="m36-cc-modules">
      <Timeline items={mods.map((m) => {
        const st = moduleState(m, today);
        return {
          id: m.id, when: range(m.starts_on, m.ends_on), tone: st === 'held' ? 'ok' : st === 'in_progress' ? 'info' : 'neutral',
          title: <span data-testid="m36-cc-module" data-state={st}>{pick(m as unknown as Row, 'title')}</span>,
          detail: (
            <span className="flex flex-wrap items-center gap-2">
              <span>{t('m36.cc.hostedBy', { org: partnerName(cohort, m.host_org_id) })}</span>
              <StatusPill tone={st === 'held' ? 'ok' : st === 'in_progress' ? 'info' : 'neutral'}>{t(`m36.cc.moduleState.${st}`)}</StatusPill>
              {m.course_id && <L to={`/learn/course/${m.course_id}`} className="text-[12.5px]">{t('m36.cc.course')}</L>}
            </span>
          ),
        };
      })} />
    </div>
  );
}
