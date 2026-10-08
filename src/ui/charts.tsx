/**
 * Dependency-free SVG charts. All accept a `title` (used as the accessible name) and render a visually hidden
 * data table for screen readers. Suppressed values (groups under 10) render as hatched "<10" cells, never as numbers.
 *   <BarChart title=".." data={[{ label: 'Operations', value: 54.2, suppressed: false }]} unit="%" />
 *   <LineChart title=".." series={[{ name: 'Emiratization', points: [{ x: '2023', y: 50 }] }]} />
 *   <Donut title=".." data={[{ label: 'Valid', value: 41, tone: 'ok' }]} />
 *   <Funnel title=".." stages={[{ label: 'Applied', value: 420 }]} />
 *   <Heatmap title=".." rows={['Ops']} cols={['L1']} value={(r, c) => ({ v: 3 })} />
 *   <ProgressRing value={72} label="72%" />
 */
import type { ReactNode } from 'react';
import { useFormat, useT } from '../i18n';

const TONES: Record<string, string> = { accent: 'rgb(var(--accent))', ok: 'rgb(var(--ok))', bad: 'rgb(var(--bad))', info: 'rgb(var(--info))', sim: 'rgb(var(--sim))', leaf: 'rgb(var(--leaf))', sky: 'rgb(var(--sky))', ink: 'rgb(var(--ink-3))' };
const PALETTE = ['accent', 'sky', 'leaf', 'sim', 'info', 'bad', 'ink'];
const color = (tone: string | undefined, i: number) => TONES[tone ?? PALETTE[i % PALETTE.length]];

export interface Datum {
  label: string;
  value: number | null;
  suppressed?: boolean;
  tone?: string;
}

function SrTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i}>
            <th scope="row">{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="rgb(var(--sunken))" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(var(--line-strong))" strokeWidth="2" />
    </pattern>
  );
}

/** Horizontal bar chart (HTML, so it mirrors naturally in RTL). */
export function BarChart({ title, data, unit = '', max, target }: { title: string; data: Datum[]; unit?: string; max?: number; target?: number }) {
  const f = useFormat();
  const t = useT();
  const m = max ?? Math.max(1, ...data.map((d) => (d.suppressed ? 0 : (d.value ?? 0))), target ?? 0);
  const fmt = (d: Datum) => (d.suppressed ? t('common.suppressedShort') : d.value == null ? '—' : `${f.num(d.value, { maximumFractionDigits: 1 })}${unit}`);
  return (
    <figure className="space-y-1.5" data-testid="bar-chart">
      <figcaption className="sr-only">{title}</figcaption>
      <div aria-hidden className="space-y-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="grid grid-cols-[minmax(90px,30%)_1fr_auto] items-center gap-2 text-[12.5px]">
            <span className="truncate text-ink-2" title={d.label}>
              {d.label}
            </span>
            <div className="relative h-4 rounded bg-sunken">
              {d.suppressed ? (
                <div className="h-full w-full rounded bg-[repeating-linear-gradient(45deg,rgb(var(--sunken))_0_4px,rgb(var(--line-strong))_4px_6px)]" />
              ) : (
                <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(100, ((d.value ?? 0) / m) * 100))}%`, background: color(d.tone, 0) }} />
              )}
              {target !== undefined && <div className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ insetInlineStart: `${(target / m) * 100}%` }} />}
            </div>
            <span className="num min-w-[3.5rem] text-end">{fmt(d)}</span>
          </div>
        ))}
      </div>
      <SrTable title={title} rows={data.map((d) => [d.label, fmt(d)])} />
    </figure>
  );
}

export function LineChart({ title, series, unit = '', height = 180, yMin, yMax }: { title: string; series: { name: string; points: { x: string; y: number | null }[]; tone?: string; dashed?: boolean }[]; unit?: string; height?: number; yMin?: number; yMax?: number }) {
  const f = useFormat();
  const W = 600;
  const H = height;
  const pad = { l: 40, r: 12, t: 10, b: 24 };
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x))));
  const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y != null));
  const lo = yMin ?? Math.min(0, ...ys);
  const hi = yMax ?? Math.max(1, ...ys) * 1.08;
  const X = (x: string) => pad.l + (xs.length <= 1 ? 0 : (xs.indexOf(x) / (xs.length - 1)) * (W - pad.l - pad.r));
  const Y = (y: number) => H - pad.b - ((y - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const ticks = [lo, lo + (hi - lo) / 2, hi];
  return (
    <figure data-testid="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} style={{ direction: 'ltr' }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgb(var(--line))" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--ink-3))">
              {f.num(Math.round(v))}
              {unit}
            </text>
          </g>
        ))}
        {xs.map((x) => (
          <text key={x} x={X(x)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-3))">
            {x}
          </text>
        ))}
        {series.map((s, i) => {
          const pts = s.points.filter((p) => p.y != null);
          const d = pts.map((p, j) => `${j ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y as number).toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={color(s.tone, i)} strokeWidth="2" strokeDasharray={s.dashed ? '5 4' : undefined} />
              {pts.map((p) => (
                <circle key={p.x} cx={X(p.x)} cy={Y(p.y as number)} r="2.5" fill={color(s.tone, i)} />
              ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <figcaption className="mt-1 flex flex-wrap gap-3 text-[12px] text-ink-2">
          {series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color(s.tone, i) }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <SrTable title={title} rows={series.flatMap((s) => s.points.map((p) => [`${s.name} ${p.x}`, p.y == null ? '—' : `${p.y}${unit}`] as [string, string]))} />
    </figure>
  );
}

export function Donut({ title, data, center, size = 140 }: { title: string; data: Datum[]; center?: ReactNode; size?: number }) {
  const f = useFormat();
  const total = data.reduce((a, d) => a + (d.suppressed ? 0 : (d.value ?? 0)), 0) || 1;
  const r = 52;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <figure className="flex flex-wrap items-center gap-4" data-testid="donut-chart">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={title}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth="18" />
          {data.map((d, i) => {
            const v = d.suppressed ? 0 : (d.value ?? 0);
            const len = (v / total) * C;
            const el = <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={color(d.tone, i)} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />;
            acc += len;
            return el;
          })}
        </svg>
        {center && <div className="absolute inset-0 grid place-items-center text-center text-[13px] font-semibold">{center}</div>}
      </div>
      <figcaption className="space-y-1 text-[12.5px]">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color(d.tone, i) }} />
            <span className="text-ink-2">{d.label}</span>
            <span className="num ms-auto ps-3 font-semibold">{d.suppressed ? '<10' : f.num(d.value)}</span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

export function Funnel({ title, stages }: { title: string; stages: Datum[] }) {
  const f = useFormat();
  const t = useT();
  const top = Math.max(1, ...stages.map((s) => (s.suppressed ? 0 : (s.value ?? 0))));
  return (
    <figure className="space-y-1" data-testid="funnel-chart">
      <figcaption className="sr-only">{title}</figcaption>
      {stages.map((s, i) => {
        const w = s.suppressed ? 20 : Math.max(6, ((s.value ?? 0) / top) * 100);
        const prev = i > 0 ? stages[i - 1] : null;
        const conv = prev && !prev.suppressed && !s.suppressed && prev.value ? Math.round(((s.value ?? 0) / prev.value) * 100) : null;
        return (
          <div key={s.label} className="flex items-center gap-3 text-[12.5px]">
            <span className="w-32 shrink-0 truncate text-ink-2">{s.label}</span>
            <div className="flex-1">
              <div className={`mx-auto flex h-7 items-center justify-center rounded text-[12px] font-semibold ${s.suppressed ? 'bg-sunken text-ink-3' : 'bg-accent text-accent-ink'}`} style={{ width: `${w}%`, opacity: s.suppressed ? 1 : 1 - i * 0.08 }}>
                <span className="num">{s.suppressed ? t('common.suppressedShort') : f.num(s.value)}</span>
              </div>
            </div>
            <span className="num w-12 text-end text-ink-3">{conv !== null ? `${f.num(conv)}%` : ''}</span>
          </div>
        );
      })}
    </figure>
  );
}

export function Heatmap({ title, rows, cols, value, rowLabel, colLabel }: { title: string; rows: string[]; cols: string[]; value: (r: string, c: string) => { v: number | null; suppressed?: boolean; tone?: 'ok' | 'bad' | 'sim' | 'info' | 'neutral'; label?: string }; rowLabel?: (r: string) => string; colLabel?: (c: string) => string }) {
  const f = useFormat();
  const all = rows.flatMap((r) => cols.map((c) => value(r, c))).filter((x) => !x.suppressed && x.v != null).map((x) => x.v as number);
  const hi = Math.max(1, ...all);
  const toneBg: Record<string, string> = { ok: 'bg-ok-bg text-ok', bad: 'bg-bad-bg text-bad', sim: 'bg-sim-bg text-sim', info: 'bg-info-bg text-info', neutral: 'bg-sunken text-ink-3' };
  return (
    <div className="overflow-x-auto" data-testid="heatmap">
      <table className="border-separate border-spacing-0.5 text-[12px]">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} scope="col" className="caps px-1.5 py-1 text-center">
                {colLabel ? colLabel(c) : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className="whitespace-nowrap pe-2 text-start font-medium text-ink-2">
                {rowLabel ? rowLabel(r) : r}
              </th>
              {cols.map((c) => {
                const x = value(r, c);
                if (x.suppressed) {
                  return (
                    <td key={c} className="h-8 min-w-[44px] rounded bg-[repeating-linear-gradient(45deg,rgb(var(--sunken))_0_4px,rgb(var(--line))_4px_6px)] text-center text-ink-3" title="<10">
                      &lt;10
                    </td>
                  );
                }
                if (x.tone) {
                  return (
                    <td key={c} className={`h-8 min-w-[44px] rounded px-1 text-center font-semibold ${toneBg[x.tone]}`}>
                      {x.label ?? (x.v == null ? '—' : f.num(x.v))}
                    </td>
                  );
                }
                const a = x.v == null ? 0 : 0.12 + 0.78 * (x.v / hi);
                return (
                  <td key={c} className="num h-8 min-w-[44px] rounded px-1 text-center" style={{ background: `rgb(var(--accent) / ${a})`, color: a > 0.55 ? 'rgb(var(--accent-ink))' : 'rgb(var(--ink))' }}>
                    {x.label ?? (x.v == null ? '—' : f.num(x.v))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProgressRing({ value, size = 56, label, tone = 'accent' }: { value: number; size?: number; label?: ReactNode; tone?: string }) {
  const r = 22;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 56 56" width={size} height={size}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={TONES[tone] ?? TONES.accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(v / 100) * C} ${C}`} transform="rotate(-90 28 28)" />
      </svg>
      <span className="num absolute text-[12px] font-semibold">{label ?? `${Math.round(v)}%`}</span>
    </div>
  );
}

/** Thin linear progress bar. */
export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: string; label?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-sunken" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: TONES[tone] ?? TONES.accent }} />
    </div>
  );
}

export { Hatch };
