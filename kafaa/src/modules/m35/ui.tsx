// M35 shared page helpers (FS50, FS51; owners: wave F E1). Reference data (skill names, owners, gap plans), pills, the suppressed cell,
// the methodology banner, the fan chart (three-scenario demand band, distinguishable without colour), the level-mix table and a slider.
// Pages only; the rules live in critical.ts and forecast.ts.
import { useId, type ReactNode } from 'react';
import { Callout, Icon, SimChip, StatusPill, type PillTone } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BASE_YEAR, HORIZON, SCENARIOS, WORK_LEVEL, type ForecastResult, type LeverParam, type ScenarioKey, type SharedParam, type SkillForecast } from './forecast';
import type { ProgressStatus } from './critical';
import { MethodologyBanner } from '../m16/MethodologyBanner'; // FS54 -> FS51 (FS wave F integration)

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface M35Ref { skills: Map<string, Row>; people: Map<string, Row>; plans: Row[] }
/** Skill names, role-card owners and FS04 gap plans (reads that fail return empty lists). */
export function useM35Ref() {
  const repo = useRepo();
  return useQuery(['skills', 'people', 'skill_gap_plans'], async (): Promise<M35Ref> => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [skills, people, plans] = await Promise.all([
      safe(repo.list('skills') as Promise<Row[]>),
      safe(repo.list('people', { filter: { kind: 'staff' } } as never) as Promise<Row[]>),
      safe(repo.list('skill_gap_plans') as Promise<Row[]>),
    ]);
    return { skills: new Map(skills.map((s) => [s.id, s])), people: new Map(people.map((p) => [p.id, p])), plans };
  }, []);
}
export function useSkillName(ref: M35Ref | undefined) {
  const pick = usePick();
  return (id: string) => { const s = ref?.skills.get(id); return s ? pick(s, 'name') : id; };
}
export function useOwnerLabel(ref: M35Ref | undefined) {
  const t = useT();
  const pick = usePick();
  return (fn: string, pid: string) => {
    const p = ref?.people.get(pid);
    const who = p ? (p.display_name_ar || p.display_name ? pick({ name_en: p.display_name, name_ar: p.display_name_ar ?? p.display_name }, 'name') : pid) : t('m35.cs.ownerCard');
    return `${t(`fs.owner.${fn}`)} · ${who}`;
  };
}

export const DECISION_TONE: Record<string, PillTone> = { build: 'ok', buy: 'info', borrow: 'accent', bot: 'sim' };
export function DecisionPill({ decision }: { decision: string }) {
  const t = useT();
  return <StatusPill tone={DECISION_TONE[decision] ?? 'neutral'}><span data-testid="m35-decision" data-decision={decision}>{t(`m35.decision.${decision}`)}</span></StatusPill>;
}
export const PROGRESS_TONE: Record<string, PillTone> = { met: 'ok', on_track: 'ok', at_risk: 'reserved', off_track: 'bad', suppressed: 'neutral', no_target: 'neutral' };
export function ProgressPill({ status }: { status: ProgressStatus | string }) {
  const t = useT();
  return <StatusPill tone={PROGRESS_TONE[status] ?? 'neutral'}><span data-testid="m35-progress-status" data-status={status}>{t(`m35.progress.${status}`)}</span></StatusPill>;
}
export const REVIEW_TONE: Record<string, PillTone> = { done: 'ok', due: 'info', overdue: 'bad', not_started: 'neutral', retired: 'neutral' };
export function ReviewPill({ state }: { state: string }) {
  const t = useT();
  return <StatusPill tone={REVIEW_TONE[state] ?? 'neutral'}><span data-testid="m35-review-state" data-state={state}>{t(`m35.review.${state}`)}</span></StatusPill>;
}
/** A number, or the "suppressed" mark when the group is under 10. */
export function Sup({ v, suffix = '' }: { v: number | null | undefined; suffix?: string }) {
  const t = useT();
  const f = useFormat();
  if (v == null) return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
  return <span className="num">{f.num(v)}{suffix}</span>;
}
export function Year({ y }: { y: number | string | null | undefined }) {
  const f = useFormat();
  return <span className="num">{y == null ? '—' : f.num(Number(y), { useGrouping: false })}</span>;
}

/** SIMULATED label row with the definitions link (FS51: every number is SIMULATED with a definitions link). */
export function SimLabels({ method }: { method?: string }) {
  const t = useT();
  return (
    <>
    {/* FS54 -> FS51 (FS wave F integration): the catalogue methodology-change banner, next to the forecast's own method banner */}
    <MethodologyBanner dashboard="skill_forecasts" />
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m35-sim-labels">
      <SimChip />
      <span>{t('m35.fc.labels', { n: 10 })}</span>
      {method && <span className="num rounded bg-sunken px-1.5 py-0.5 text-[11.5px]">{method}</span>}
      <L to="/workforce/skill-forecasts/method#definitions" className="inline-flex items-center gap-1 text-[12px]" data-testid="m35-definitions-link"><Icon name="info" size={12} />{t('m35.fc.definitions')}</L>
    </div>
    </>
  );
}
/** The methodology banner: a method or catalogue change voids year-on-year comparison. */
export function MethodBanner({ basis, cycle }: { basis?: { method: string; catalogue: string; skills_in_scope: number } | null; cycle?: number | null }) {
  const t = useT();
  const f = useFormat();
  return (
    <Callout tone="sim" title={t('m35.banner.title')}>
      <span data-testid="m35-method-banner">
        {t('m35.banner.body', { method: basis?.method ?? 'fs51-v1', n: f.num(basis?.skills_in_scope ?? 0), catalogue: t(`m35.catalogue.${basis?.catalogue ?? 'all'}`), cycle: cycle == null ? '—' : String(cycle) })}{' '}
        <L to="/workforce/skill-forecasts/method#method">{t('m35.banner.link')}</L>
      </span>
    </Callout>
  );
}

const LINE_STYLE: Record<ScenarioKey | 'supply', { tone: string; dash?: string; width: number }> = {
  baseline: { tone: 'rgb(var(--ink-3))', width: 2 },
  advance: { tone: 'rgb(var(--accent))', dash: '7 4', width: 2 },
  accelerated: { tone: 'rgb(var(--sim))', dash: '2 3', width: 2.2 },
  supply: { tone: 'rgb(var(--ok))', width: 2.6 },
};
/** Fan chart for one skill at one level: the demand band across the three scenarios, a line per scenario (solid, dashed, dotted) and
 *  the supply of the chosen scenario (thick). Line patterns and labels distinguish the series without colour; a data table follows. */
export function FanChart({ k, level = WORK_LEVEL, scenario, title, height = 230 }: { k: SkillForecast; level?: number; scenario: ScenarioKey; title: string; height?: number }) {
  const t = useT();
  const f = useFormat();
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const years = Array.from({ length: HORIZON - BASE_YEAR + 1 }, (_, i) => BASE_YEAR + i);
  const li = level - 1;
  const dem = Object.fromEntries(SCENARIOS.map((s) => [s, k.sc[s].d.map((r) => r[li])])) as Record<ScenarioKey, number[]>;
  const sup = k.sc[scenario].s.map((r) => r[li]);
  const lo = years.map((_, i) => Math.min(...SCENARIOS.map((s) => dem[s][i])));
  const hi = years.map((_, i) => Math.max(...SCENARIOS.map((s) => dem[s][i])));
  const W = 640, H = height, pad = { l: 46, r: 14, t: 12, b: 26 };
  const max = Math.max(1, ...hi, ...sup) * 1.1;
  const X = (i: number) => pad.l + (i / (years.length - 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const band = `${hi.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} ${lo.map((v, i) => `L${X(lo.length - 1 - i).toFixed(1)},${Y(lo[lo.length - 1 - i]).toFixed(1)}`).join(' ')} Z`;
  const ticks = [0, max / 2, max];
  const series: { key: ScenarioKey | 'supply'; label: string; vals: number[] }[] = [
    ...SCENARIOS.map((s) => ({ key: s, label: t('m35.fc.demandOf', { s: t(`m35.scenario.${s}`) }), vals: dem[s] })),
    { key: 'supply', label: t('m35.fc.supplyOf', { s: t(`m35.scenario.${scenario}`) }), vals: sup },
  ];
  return (
    <figure data-testid="m35-fan-chart" data-level={level} data-scenario={scenario}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} style={{ direction: 'ltr' }}>
        <defs>
          <pattern id={`band-${gid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgb(var(--accent) / 0.10)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(var(--accent) / 0.25)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgb(var(--line))" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--ink-3))">{f.num(Math.round(v))}</text>
          </g>
        ))}
        {years.map((y, i) => (i % 2 === 0 || i === years.length - 1) && (
          <text key={y} x={X(i)} y={H - 7} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-3))">{f.num(y, { useGrouping: false })}</text>
        ))}
        <line x1={X(4)} x2={X(4)} y1={pad.t} y2={H - pad.b} stroke="rgb(var(--line-strong))" strokeDasharray="3 3" />
        <path d={band} fill={`url(#band-${gid})`} stroke="none" data-testid="m35-fan-band" />
        {series.map((s) => (
          <path key={s.key} d={path(s.vals)} fill="none" stroke={LINE_STYLE[s.key].tone} strokeWidth={LINE_STYLE[s.key].width} strokeDasharray={LINE_STYLE[s.key].dash} data-series={s.key} />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-4 rounded-sm border border-line bg-[repeating-linear-gradient(45deg,rgb(var(--accent)/0.12)_0_3px,rgb(var(--accent)/0.3)_3px_4px)]" />{t('m35.fc.band')}</span>
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="22" height="8" style={{ direction: 'ltr' }}><line x1="0" x2="22" y1="4" y2="4" stroke={LINE_STYLE[s.key].tone} strokeWidth={LINE_STYLE[s.key].width} strokeDasharray={LINE_STYLE[s.key].dash} /></svg>
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-ink-3">{t('m35.fc.midMark')}</span>
      </figcaption>
      <div className="sr-only"><table>
        <caption>{title}</caption>
        <thead><tr><th scope="col">{t('m35.fc.year')}</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{years.map((y, i) => <tr key={y}><th scope="row">{y}</th>{series.map((s) => <td key={s.key}>{s.vals[i]}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}

/** Level mix for one scenario: demand, supply and gap at levels 1+ to 4 for selected years. */
export function LevelMixTable({ k, scenario, years = [2026, 2028, 2030, 2033, 2035] }: { k: SkillForecast; scenario: ScenarioKey; years?: number[] }) {
  const t = useT();
  const f = useFormat();
  const x = k.sc[scenario];
  return (
    <div className="overflow-x-auto" data-testid="m35-level-mix">
      <table className="w-full text-[12.5px]">
        <caption className="sr-only">{t('m35.fc.mixTitle')}</caption>
        <thead>
          <tr className="text-ink-3">
            <th scope="col" className="py-1 text-start font-semibold">{t('m35.fc.level')}</th>
            {years.map((y) => <th key={y} scope="col" className="py-1 text-end font-semibold"><Year y={y} /></th>)}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4].map((L) => (
            <tr key={L} className="border-t border-line" data-level={L}>
              <th scope="row" className="py-1.5 text-start font-medium">{t(`m35.level.${L}`)}</th>
              {years.map((y) => {
                const yi = y - BASE_YEAR;
                const d = x.d[yi][L - 1], s = x.s[yi][L - 1], g = d - s;
                return (
                  <td key={y} className="py-1.5 text-end">
                    <span className="num block">{f.num(d)} / {f.num(s)}</span>
                    <span className={`num block text-[11.5px] ${g > 0 ? 'font-semibold text-bad' : 'text-ok'}`}>{g > 0 ? t('m35.fc.short', { n: f.num(g) }) : t('m35.fc.covered', { n: f.num(-g) })}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11.5px] text-ink-3">{t('m35.fc.mixNote')}</p>
    </div>
  );
}

/** Small band sparkline for a table row (working level): band across scenarios plus the baseline supply. */
export function BandSpark({ k }: { k: SkillForecast }) {
  const li = WORK_LEVEL - 1;
  const n = k.sc.baseline.d.length;
  const lo = Array.from({ length: n }, (_, i) => Math.min(...SCENARIOS.map((s) => k.sc[s].d[i][li])));
  const hi = Array.from({ length: n }, (_, i) => Math.max(...SCENARIOS.map((s) => k.sc[s].d[i][li])));
  const sup = k.sc.baseline.s.map((r) => r[li]);
  const max = Math.max(1, ...hi, ...sup);
  const W = 96, H = 26;
  const X = (i: number) => (i / (n - 1)) * (W - 2) + 1;
  const Y = (v: number) => H - 2 - (v / max) * (H - 4);
  const band = `${hi.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} ${lo.map((_, i) => `L${X(n - 1 - i)},${Y(lo[n - 1 - i])}`).join(' ')} Z`;
  return (
    <svg aria-hidden width={W} height={H} style={{ direction: 'ltr' }} data-testid="m35-band-spark">
      <path d={band} fill="rgb(var(--accent) / 0.18)" />
      <path d={sup.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} fill="none" stroke="rgb(var(--ok))" strokeWidth="1.6" />
    </svg>
  );
}

/** Range slider with its default marked and the value shown (assumptions panel). */
export function Slider({ id, label, value, min, max, step, def, format, onChange, hint }: { id: string; label: ReactNode; value: number; min: number; max: number; step: number; def: number; format: (v: number) => string; onChange: (v: number) => void; hint?: ReactNode }) {
  const t = useT();
  const changed = value !== def;
  const pct = ((def - min) / (max - min || 1)) * 100;
  return (
    <label className="block" data-testid={`m35-param-${id}`}>
      <span className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className={`num ${changed ? 'font-semibold text-sim' : 'text-ink-2'}`}>{format(value)}</span>
      </span>
      <span className="relative mt-1 block">
        <input type="range" className="w-full accent-[rgb(var(--accent))]" min={min} max={max} step={step} value={value} aria-valuetext={format(value)} onChange={(e) => onChange(Number(e.target.value))} />
        <span aria-hidden className="pointer-events-none absolute top-[-2px] h-1.5 w-0.5 bg-ink-3" style={{ insetInlineStart: `${pct}%` }} />
      </span>
      {(hint || changed) && <span className="mt-0.5 block text-[11.5px] text-ink-3">{hint}{changed ? ` · ${t('m35.fc.defaultIs', { v: format(def) })}` : ''}</span>}
    </label>
  );
}

/** The computed "not yet modelled" items of a result plus the standing list. */
export function NotModelled({ r, skillName }: { r: ForecastResult; skillName: (id: string) => string }) {
  const t = useT();
  const f = useFormat();
  const items = ['smr_headcount', 'automation', 'contractors', 'market', 'after_2035', 'decay', 'specialised'];
  return (
    <div className="space-y-3" data-testid="m35-not-modelled">
      <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
        {items.map((i) => <li key={i} data-testid="m35-nm-item">{t(`m35.nm.${i}`)}</li>)}
      </ul>
      <details className="rounded-card border border-line p-2">
        <summary className="cursor-pointer text-[13px] font-semibold">{t('m35.nm.skills', { n: f.num(r.not_modelled.length) })}</summary>
        <p className="mt-1 text-[12px] text-ink-3">{t('m35.nm.skillsNote')}</p>
        <ul className="mt-1 flex flex-wrap gap-1.5" data-testid="m35-nm-skills">
          {r.not_modelled.map((x) => <li key={x.skill_id} className="rounded bg-sunken px-1.5 py-0.5 text-[12px]">{skillName(x.skill_id)}</li>)}
        </ul>
      </details>
    </div>
  );
}

/** Display format of an assumption value. */
export function useParamFormat() {
  const t = useT();
  const f = useFormat();
  return (k: SharedParam | LeverParam, v: number): string => {
    switch (k) {
      case 'attrition_pct': return `${f.num(v, { maximumFractionDigits: 1 })}%`;
      case 'develop_rate': return t('m35.fc.pctYear', { n: f.num(v) });
      case 'annual_intake': return t('m35.fc.perYear', { n: f.num(v) });
      case 'adv_start': return f.num(v, { useGrouping: false });
      case 'advance': return v === 0 ? t('m35.fc.off') : `× ${f.num(v, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
      default: return `× ${f.num(v, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    }
  };
}

