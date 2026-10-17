// M23 shared page pieces (F18 Talent review, F19 Succession): RPC-backed data hooks, labels, the 9-box grid, the evidence panel,
// status pills for cycles, readiness, gates and flags. Pages never import backend/*; confidential rows come only through the RPCs.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useRepo, type RowOf } from '../../data';
import { usePick, useFormat, useT } from '../../i18n';
import { Icon, ProgressBar, ProgressRing, SimChip, StatusPill, WhyThis, type PillTone, ScrollRegion } from '../../ui';
import { AspirationSignalCard } from '../m18/AspirationSignal';
import type { AspirationSignal } from '../m18/conversations';
import { EVIDENCE_WEIGHTS, evidenceReasons, type EvidenceSnapshot, type FlagCode, type HardGate, type Readiness, type SlateFlag } from './domain';
import type { BoardMember } from './backend/rpc';

/** Unwrap a Result-returning RPC for useQuery (refusals become the error state with the user-facing message). */
export async function unwrap<T>(p: Promise<{ ok: boolean; message: string; data?: T }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.message);
  return r.data as T;
}

/** F12 aspiration signals for the people on a board (rpc.talentAspirations: shared ones only, in the caller's scope). Fetched once
 *  per set of people, not re-run on table events: the read is audited and the LocalBackend announces it to every query. */
export function useAspirations(personIds: string[]) {
  const repo = useRepo();
  const key = [...new Set(personIds)].sort().join(',');
  const [map, setMap] = useState<Map<string, AspirationSignal> | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (!key) { setMap(new Map()); return; }
    repo.rpc.talentAspirations(key.split(',')).then(
      (r) => live && setMap(new Map((r.ok ? r.data ?? [] : []).map((x) => [x.person_id, x]))),
      () => live && setMap(new Map()),
    );
    return () => { live = false; };
  }, [repo, key]);
  return map;
}

/** Reference labels (public catalogues): job roles, competencies, job families. */
export function useCatalogue() {
  const repo = useRepo();
  return useQuery(['job_roles', 'competencies', 'job_families'], async () => {
    const [roles, comps, fams] = await Promise.all([repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('competencies'), repo.list('job_families').catch(() => [] as RowOf<'job_families'>[])]);
    return { roles, comps, fams };
  }, []);
}
export type Catalogue = NonNullable<ReturnType<typeof useCatalogue>['data']>;
export function useLabels(cat: Catalogue | undefined) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const ro = new Map((cat?.roles ?? []).map((r) => [r.id, r]));
    const co = new Map((cat?.comps ?? []).map((c) => [c.id, c]));
    const fa = new Map((cat?.fams ?? []).map((f) => [f.id, f]));
    return {
      role: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title') : t('m23.common.roleCard')),
      roleShort: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title').split(' (')[0] : t('m23.common.roleCard')),
      comp: (id: string) => (co.get(id) ? pick(co.get(id), 'name') : id),
      family: (id: string | null | undefined) => (id && fa.get(id) ? pick(fa.get(id), 'name') || id : id ?? '—'),
    };
  }, [cat, pick, t]);
}
export type Labels = ReturnType<typeof useLabels>;

export const personName = (m: { name: string; name_ar: string }, lang: string) => (lang === 'ar' ? m.name_ar || m.name : m.name);

// ───────────────────────────── cycle status
const CYCLE_TONE: Record<string, PillTone> = { open: 'info', calibration: 'sim', locked: 'ok' };
export function CyclePill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={CYCLE_TONE[status] ?? 'neutral'} status={status}>{t(`m23.cycleStatus.${status}`)}</StatusPill>;
}
export function CycleSteps({ status }: { status: string }) {
  const t = useT();
  const steps = ['open', 'calibration', 'locked'];
  const cur = steps.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[12px]" aria-label={t('m23.cycle.stepsLabel')} data-testid="m23-cycle-steps">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5" aria-current={i === cur ? 'step' : undefined}>
          <span className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] font-semibold ${i < cur ? 'border-ok-line bg-ok-bg text-ok' : i === cur ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-3'}`}>
            {i < cur ? <Icon name="check" size={11} /> : i + 1}
          </span>
          <span className={i === cur ? 'font-semibold' : 'text-ink-3'}>{t(`m23.cycleStatus.${s}`)}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

// ───────────────────────────── 9-box
const BOX_TONE: Record<number, string> = {
  9: 'bg-ok-bg border-ok-line', 8: 'bg-ok-bg/60 border-ok-line', 6: 'bg-ok-bg/60 border-ok-line',
  7: 'bg-info-bg border-info-line', 5: 'bg-panel border-line', 3: 'bg-info-bg/60 border-info-line',
  4: 'bg-sim-bg/60 border-sim-line', 2: 'bg-sim-bg/60 border-sim-line', 1: 'bg-bad-bg border-bad-line',
};
export function BoxName({ box }: { box: number }) {
  const t = useT();
  return <>{t(`m23.box.${box}`)}</>;
}
/** The 3×3 grid as a semantic table: rows are potential (high first), columns performance (low → high). People are buttons. */
export function NineBox({ members, onPick, selected, lang, testId = 'm23-ninebox' }: { members: BoardMember[]; onPick?: (id: string) => void; selected?: string | null; lang: string; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const placed = members.filter((m) => m.placement);
  return (
    <ScrollRegion className="overflow-x-auto">
      <table className="w-full min-w-[520px] table-fixed border-separate border-spacing-1.5" data-testid={testId}>
        <caption className="sr-only">{t('m23.box.caption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-20 text-start align-bottom"><span className="caps">{t('m23.box.potential')} ↑</span></th>
            {[1, 2, 3].map((p) => <th key={p} scope="col" className="caps text-center">{t(`m23.perf.${p}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {[3, 2, 1].map((pot) => (
            <tr key={pot}>
              <th scope="row" className="caps text-start align-top">{t(`m23.pot.${pot}`)}</th>
              {[1, 2, 3].map((perf) => {
                const box = (pot - 1) * 3 + perf;
                const here = placed.filter((m) => m.placement!.box === box);
                return (
                  <td key={perf} className={`h-28 rounded-card border p-2 align-top ${BOX_TONE[box]}`} data-testid="m23-box" data-box={box}>
                    <div className="mb-1 flex items-start justify-between gap-1">
                      <span className="text-[11.5px] font-semibold leading-4 text-ink-2"><BoxName box={box} /></span>
                      <span className="num text-[12px] text-ink-3">{f.num(here.length)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {here.map((m) => (
                        <button key={m.person_id} type="button" onClick={() => onPick?.(m.person_id)} aria-pressed={selected === m.person_id}
                          className={`chip max-w-full truncate ${selected === m.person_id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-panel text-ink hover:border-accent'}`}
                          title={personName(m, lang)} data-testid="m23-box-person">
                          {m.flags.length > 0 && <Icon name="alert" size={11} />}
                          <span className="truncate">{personName(m, lang)}</span>
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td />
            <td colSpan={3} className="pt-1 text-center"><span className="caps">{t('m23.box.performance')} →</span></td>
          </tr>
        </tbody>
      </table>
    </ScrollRegion>
  );
}

// ───────────────────────────── evidence panel
export function EvidencePanel({ ev, aspiration, perf, compact }: { ev: EvidenceSnapshot; aspiration?: AspirationSignal | null; perf?: { period: string; rating: number } | null; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-3" data-testid="m23-evidence">
      <div className="flex flex-wrap items-center gap-3">
        <ProgressRing value={ev.index} label={<span className="num">{f.num(ev.index)}</span>} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{t('m23.ev.index')}</div>
          <div className="text-[12.5px] text-ink-2">{t('m23.ev.indexSub', { date: f.date(ev.as_of) })}</div>
        </div>
        <WhyThis reasons={evidenceReasons(ev)} testId="m23-why-evidence" />
      </div>
      {!compact && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EVIDENCE_WEIGHTS.map(([k, cap, pts]) => (
            <li key={k} className="rounded-btn border border-line p-2" data-testid="m23-ev-part">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-semibold">{t(`m23.ev.${k}`)}</span>
                <span className="num text-ink-3">{f.num(ev[k])} · {f.num(ev.points?.[k] ?? 0)}/{f.num(pts)}</span>
              </div>
              <ProgressBar value={(Math.min(ev[k], cap) / cap) * 100} tone={ev[k] >= cap ? 'ok' : 'accent'} label={t(`m23.ev.${k}`)} />
              <div className="mt-1 text-[11.5px] text-ink-3">{t(`m23.ev.${k}Hint`)}</div>
            </li>
          ))}
        </ul>
      )}
      {perf !== undefined && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="text-ink-2">{t('m23.ev.perfRecord')}</span>
          {perf ? <span className="num font-semibold">{t('m23.ev.perfValue', { rating: f.num(perf.rating), period: perf.period })}</span> : <span className="text-ink-3">—</span>}
          <SimChip label={t('m23.common.simulatedHr')} />
        </div>
      )}
      {aspiration !== undefined && (
        <div className="rounded-btn border border-line p-2">
          <div className="caps mb-1">{t('m23.ev.aspiration')}</div>
          <AspirationSignalCard signal={aspiration} />
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── flags, readiness, gates
export function FlagPills({ flags }: { flags: (FlagCode | SlateFlag)[] }) {
  const t = useT();
  if (!flags.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((x) => <StatusPill key={x} tone={x === 'no_emergency' ? 'sim' : 'bad'} status={x}><Icon name="alert" size={11} />{t(`m23.flag.${x}`)}</StatusPill>)}
    </span>
  );
}
const READY_TONE: Record<string, PillTone> = { ready_now: 'ok', '1_2y': 'info', '3_5y': 'sim' };
export function ReadinessPill({ r }: { r: Readiness | null }) {
  const t = useT();
  if (!r) return <StatusPill tone="reserved">{t('m23.readiness.external')}</StatusPill>;
  return <StatusPill tone={READY_TONE[r]} status={r}>{t(`m23.readiness.${r}`)}</StatusPill>;
}
export function GateChips({ gates }: { gates: HardGate[] }) {
  const t = useT();
  if (!gates.length) return <span className="text-[12px] text-ink-3">{t('m23.gate.none')}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="m23-gates">
      {gates.map((g) => (
        <span key={g.code} className={`chip ${g.met ? 'border-ok-line bg-ok-bg text-ok' : 'border-bad-line bg-bad-bg text-bad'}`} data-met={g.met} title={g.required.join(' / ')}>
          <Icon name={g.met ? 'check' : 'close'} size={11} />{t(`m23.gate.${g.code}`)}
        </span>
      ))}
    </span>
  );
}
export function ActionKindPill({ kind }: { kind: string }) {
  const t = useT();
  return <span className="chip border-line bg-sunken text-ink-2">{t(`m23.actionKind.${kind}`)}</span>;
}
export function ConfidentialNote({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <p className="flex items-start gap-1.5 text-[12px] text-ink-3" data-testid="m23-confidential">
      <Icon name="lock" size={13} />
      <span>{children ?? t('m23.common.confidential')}</span>
    </p>
  );
}
