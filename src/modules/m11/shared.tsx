// M11 shared pieces: the "no deployment decision" line every page carries, technology-to-partner links and a small radar chart.
import { Callout, SimChip } from '../../ui';
import { useFormat, useT } from '../../i18n';

/** Spec M11 rule: every page carries this line. */
export function NoDecision({ compact }: { compact?: boolean }) {
  const t = useT();
  return compact ? (
    <p className="text-[12.5px] font-semibold text-sim" data-testid="m11-no-decision">{t('m11.common.noDecision')}</p>
  ) : (
    <div data-testid="m11-no-decision">
      <Callout tone="sim" title={t('m11.common.noDecision')}>{t('m11.common.noDecisionBody')}</Callout>
    </div>
  );
}

/** Directory entries behind each technology family (ids in the public partner directory). */
export const TECH_ORGS: Record<string, string[]> = {
  'tech-bwr': ['ge-vernova-hitachi', 'osge'],
  'tech-htgr': ['x-energy', 'cnnc'],
  'tech-fast': ['terrapower', 'newcleo'],
  'tech-micro': ['westinghouse', 'usnc'],
  'tech-msr': ['moltexflex'],
  'tech-intl': ['westinghouse', 'samsung-ct', 'kepco'],
};
export const techSlug = (id: string) => id.replace(/^tech-/, '');
export const AREAS = ['physics', 'chemistry', 'materials', 'operations', 'maintenance', 'licensing', 'digital', 'project', 'safety'] as const;
export const RELATION_CLS: Record<string, string> = {
  transfers: 'border-ok-line bg-ok-bg text-ok',
  adapts: 'border-info-line bg-info-bg text-info',
  new: 'border-sim-line bg-sim-bg text-sim',
};

/** Radar chart (SVG) for SIMULATED indices 0-100, with a data table for screen readers. Polar layout reads the same in RTL. */
export function Radar({ title, axes, series }: { title: string; axes: string[]; series: { name: string; values: number[]; tone: 'accent' | 'sim' | 'ok' | 'info'; dashed?: boolean }[] }) {
  const t = useT();
  const f = useFormat();
  const size = 320;
  const c = size / 2;
  const r = c - 64;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)];
  };
  const color: Record<string, string> = { accent: 'rgb(var(--accent))', sim: 'rgb(var(--sim))', ok: 'rgb(var(--ok))', info: 'rgb(var(--info))' };
  return (
    <figure className="space-y-2">
      <div className="flex items-center justify-between gap-2"><figcaption className="font-semibold">{title}</figcaption><SimChip /></div>
      <svg viewBox={`-80 0 ${size + 160} ${size}`} className="mx-auto w-full max-w-[460px]" style={{ direction: 'ltr' }} role="img" aria-label={title}>
        {[25, 50, 75, 100].map((g) => (
          <polygon key={g} points={axes.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="rgb(var(--line))" strokeWidth={1} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = pt(i, 122);
          return (
            <g key={a}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="rgb(var(--line))" strokeWidth={1} />
              <text x={lx} y={ly} fontSize={10.5} textAnchor={Math.abs(lx - c) < 8 ? 'middle' : lx > c ? 'start' : 'end'} dominantBaseline="middle" fill="rgb(var(--ink-2))">{a.length > 22 ? `${a.slice(0, 21)}…` : a}</text>
            </g>
          );
        })}
        {series.map((s) => (
          <polygon key={s.name} points={s.values.map((v, i) => pt(i, v).join(',')).join(' ')} fill={color[s.tone]} fillOpacity={0.14} stroke={color[s.tone]} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
        ))}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-[12px]">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color[s.tone] }} />{s.name}</span>
        ))}
      </div>
      <div className="sr-only"><table>
        <caption>{title}</caption>
        <thead><tr><th scope="col">{t('m11.wf.skill')}</th>{series.map((s) => <th key={s.name} scope="col">{s.name}</th>)}</tr></thead>
        <tbody>{axes.map((a, i) => <tr key={a}><th scope="row">{a}</th>{series.map((s) => <td key={s.name}>{f.num(s.values[i])}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}
