// M07 · F35 Skills outlook: shared React pieces (assumption slider, diverging gap bars, tornado chart, family label). Charts are
// HTML (they mirror in RTL with logical insets) and carry a screen-reader table; suppressed families render hatched, never a value.
import type { ReactNode } from 'react';
import { SimChip } from '../../ui';
import { useFormat, useT } from '../../i18n';
import { AUTO_PARAM, BASELINE, LIMITS, type AutoParam, type FamilyOutlook, type NumParam, type TornadoBar } from './outlook';

const HATCH = 'bg-[repeating-linear-gradient(45deg,rgb(var(--sunken))_0_4px,rgb(var(--line-strong))_4px_6px)]';

export function useFamilyLabel() {
  const t = useT();
  return (key: string) => t(`m17.area.${key}`);
}

function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** One assumption: a range input with its value, the baseline marker and the unit. */
export function ParamSlider({ k, value, onChange, format }: { k: NumParam; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const t = useT();
  const [lo, hi, step] = LIMITS[k];
  const changed = value !== BASELINE[k];
  const pct = ((BASELINE[k] - lo) / (hi - lo)) * 100;
  return (
    <label className="block" data-testid={`m07-so-param-${k}`}>
      <span className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-semibold">{t(`m07.so.param.${k}`)}</span>
        <span className={`num ${changed ? 'font-semibold text-sim' : 'text-ink-2'}`}>{format(value)}</span>
      </span>
      <span className="relative mt-1 block">
        <input type="range" className="w-full accent-[rgb(var(--accent))]" min={lo} max={hi} step={step} value={value} aria-valuetext={format(value)}
          onChange={(e) => onChange(Number(e.target.value))} />
        <span aria-hidden className="pointer-events-none absolute top-[-2px] h-1.5 w-0.5 bg-ink-3" style={{ insetInlineStart: `${pct}%` }} title={t('m07.so.baselineMark')} />
      </span>
      <span className="mt-0.5 block text-[11.5px] text-ink-3">{t(`m07.so.hint.${k}`)}{changed ? ` · ${t('m07.so.baselineIs', { v: format(BASELINE[k]) })}` : ''}</span>
    </label>
  );
}

/** Diverging bars: shortfall (demand above supply) to the end side, surplus to the start side; suppressed rows hatched. */
export function GapBars({ families, year, label, onPick, picked }: { families: FamilyOutlook[]; year: number; label: (k: string) => string; onPick?: (k: string) => void; picked?: string | null }) {
  const t = useT();
  const f = useFormat();
  const gapAt = (x: FamilyOutlook) => x.years.find((c) => c.year === year)?.gap ?? null;
  const rows = [...families].sort((a, b) => (a.suppressed === b.suppressed ? (gapAt(b) ?? 0) - (gapAt(a) ?? 0) : a.suppressed ? 1 : -1));
  const max = Math.max(1, ...rows.map((x) => Math.abs(gapAt(x) ?? 0)));
  const txt = (x: FamilyOutlook) => (x.suppressed ? t('m07.so.suppressed') : gapAt(x)! > 0 ? t('m07.so.short', { n: f.num(gapAt(x)) }) : gapAt(x)! < 0 ? t('m07.so.surplus', { n: f.num(-gapAt(x)!) }) : t('m07.so.balanced'));
  return (
    <figure data-testid="m07-so-gapbars">
      <figcaption className="sr-only">{t('m07.so.gapTitle', { year })}</figcaption>
      <div aria-hidden className="mb-1 grid grid-cols-[minmax(96px,32%)_1fr_minmax(88px,auto)] gap-2 text-[11px] text-ink-3">
        <span />
        <span className="flex justify-between"><span>← {t('m07.so.surplusAxis')}</span><span>{t('m07.so.shortAxis')} →</span></span>
        <span />
      </div>
      <div aria-hidden className="space-y-1.5">
        {rows.map((x) => {
          const g = gapAt(x) ?? 0;
          const w = (Math.abs(g) / max) * 50;
          const sel = picked === x.key;
          return (
            <button key={x.key} type="button" tabIndex={-1} disabled={x.suppressed || !onPick} onClick={() => onPick?.(x.key)}
              className={`grid w-full grid-cols-[minmax(96px,32%)_1fr_minmax(88px,auto)] items-center gap-2 rounded px-1 text-start text-[12.5px] ${sel ? 'bg-sunken ring-1 ring-accent' : ''} ${x.suppressed ? 'cursor-default' : 'hover:bg-sunken'}`}
              data-testid={`m07-so-bar-${x.key}`}>
              <span className="truncate text-ink-2" title={label(x.key)}>{label(x.key)}</span>
              <span className="relative h-4 rounded bg-sunken">
                {x.suppressed ? <span className={`absolute inset-0 rounded ${HATCH}`} /> : (
                  <span className="absolute inset-y-0 rounded" style={{ insetInlineStart: g >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: g > 0 ? 'rgb(var(--bad))' : 'rgb(var(--ok))' }} />
                )}
                <span className="absolute inset-y-[-3px] w-px bg-ink-3" style={{ insetInlineStart: '50%' }} />
              </span>
              <span className={`num text-end ${x.suppressed ? 'text-ink-3' : g > 0 ? 'font-semibold text-bad' : 'text-ok'}`}>{txt(x)}</span>
            </button>
          );
        })}
      </div>
      <SrTable caption={t('m07.so.gapTitle', { year })} head={[t('m07.so.family'), t('m07.so.gapCol', { year })]} rows={rows.map((x) => [label(x.key), txt(x)])} />
    </figure>
  );
}

/** Tornado: each assumption from the low to the high end of its range; bars sorted by swing around the current value. */
export function Tornado({ bars, current, format }: { bars: TornadoBar[]; current: number; format: (k: NumParam | AutoParam, v: number) => string }) {
  const t = useT();
  const f = useFormat();
  const vals = [current, ...bars.flatMap((b) => [b.low, b.high])];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(1, hi - lo);
  const pos = (v: number) => ((v - lo) / span) * 100;
  return (
    <figure data-testid="m07-so-tornado">
      <figcaption className="sr-only">{t('m07.so.tornadoTitle')}</figcaption>
      <div aria-hidden className="space-y-2">
        {bars.map((b) => {
          const a = Math.min(b.low, b.high), z = Math.max(b.low, b.high);
          return (
            <div key={b.param} className="grid grid-cols-[minmax(110px,34%)_1fr] items-center gap-2 text-[12.5px]" data-testid={`m07-so-tornado-${b.param}`}>
              <span className="min-w-0">
                <span className="block truncate font-semibold" title={t(`m07.so.param.${b.param}`)}>{t(`m07.so.param.${b.param}`)}</span>
                {b.param === AUTO_PARAM && <span className="chip mt-0.5 border-line bg-sunken text-[10.5px] text-ink-2" data-testid="m07-au-tornado-tag">{t('m07.au.tornadoTag')}</span>}
              </span>
              <span>
                <span className="relative block h-5 rounded bg-sunken">
                  {/* the low end of the range in one tone, the high end in the other, meeting at today's value */}
                  <span className="absolute inset-y-0 rounded-s" style={{ insetInlineStart: `${pos(Math.min(b.low, current))}%`, width: `${Math.abs(pos(b.low) - pos(current))}%`, background: 'rgb(var(--sky))' }} />
                  <span className="absolute inset-y-0 rounded-e" style={{ insetInlineStart: `${pos(Math.min(b.high, current))}%`, width: `${Math.abs(pos(b.high) - pos(current))}%`, background: 'rgb(var(--sim))' }} />
                  <span className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ insetInlineStart: `${pos(current)}%` }} />
                </span>
                <span className="mt-0.5 flex justify-between text-[11px] text-ink-3">
                  <span>{format(b.param, b.lo)} → <span className="num">{f.num(b.low)}</span></span>
                  <span className="num">{t('m07.so.swing', { n: f.num(z - a) })}</span>
                  <span>{format(b.param, b.hi)} → <span className="num">{f.num(b.high)}</span></span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-3">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: 'rgb(var(--sky))' }} />{t('m07.so.tornadoLow')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: 'rgb(var(--sim))' }} />{t('m07.so.tornadoHigh')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-ink" />{t('m07.so.tornadoNow', { n: f.num(current) })}</span>
      </p>
      <SrTable caption={t('m07.so.tornadoTitle')} head={[t('m07.so.assumption'), t('m07.so.atLow'), t('m07.so.atHigh'), t('m07.so.swingCol')]}
        rows={bars.map((b) => [t(`m07.so.param.${b.param}`), `${format(b.param, b.lo)}: ${b.low}`, `${format(b.param, b.hi)}: ${b.high}`, b.swing])} />
    </figure>
  );
}

/** "SIMULATED" + definitions link, the label every chart and number carries. */
export function SimDef({ children }: { children?: ReactNode }) {
  return <span className="flex flex-wrap items-center gap-2">{children}<SimChip /></span>;
}
