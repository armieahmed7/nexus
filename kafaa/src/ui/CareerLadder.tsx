/**
 * Career ladder and path graph helpers (M01). Pure layout over career_paths-like edges; no data access here.
 *   <CareerLadder steps={[{ id, title, sub, conditions: ['...'], current: true }]} />
 *   const g = layoutGraph(nodes, edges)  →  positioned nodes for an SVG or grid path view.
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface LadderStep {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  conditions?: ReactNode[];
  current?: boolean;
  done?: boolean;
  href?: string;
}
export function CareerLadder({ steps, onSelect }: { steps: LadderStep[]; onSelect?: (id: string) => void }) {
  return (
    <ol className="space-y-0" data-testid="career-ladder">
      {steps.map((s, i) => (
        <li key={s.id} className="relative ps-8">
          {i < steps.length - 1 && <span className="absolute start-[11px] top-7 h-[calc(100%-12px)] w-0.5 bg-line-strong" aria-hidden />}
          <span className={`absolute start-0 top-1 grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] font-semibold ${s.current ? 'border-accent bg-accent text-accent-ink' : s.done ? 'border-ok bg-ok text-white' : 'border-line-strong bg-panel text-ink-3'}`}>{s.done ? '✓' : i + 1}</span>
          <div className={`mb-4 rounded-card border p-3 ${s.current ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`}>
            <button type="button" className="flex w-full items-center justify-between gap-2 text-start" onClick={onSelect ? () => onSelect(s.id) : undefined} disabled={!onSelect}>
              <span>
                <span className="block font-semibold">{s.title}</span>
                {s.sub && <span className="block text-[12.5px] text-ink-2">{s.sub}</span>}
              </span>
              {onSelect && <Icon name="chevron" className="text-ink-3" />}
            </button>
            {s.conditions && s.conditions.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-line pt-2 text-[12.5px] text-ink-2">
                {s.conditions.map((c, j) => (
                  <li key={j} className="flex gap-1.5">
                    <Icon name="check" size={13} className="mt-0.5 text-accent" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface GraphNode {
  id: string;
  label: string;
  group?: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}
/** Longest-path layering (DAG; cycles are broken by visit order). Returns column (depth) and row per node. */
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const d = (depth.get(e.from) ?? 0) + 1;
      if (depth.has(e.to) && d > (depth.get(e.to) ?? 0) && d < nodes.length) {
        depth.set(e.to, d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const cols = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    cols.set(d, [...(cols.get(d) ?? []), n]);
  }
  const placed = nodes.map((n) => {
    const col = depth.get(n.id) ?? 0;
    return { ...n, col, row: (cols.get(col) ?? []).indexOf(n) };
  });
  return { nodes: placed, edges, columns: cols.size, rows: Math.max(0, ...Array.from(cols.values()).map((c) => c.length)) };
}

/** Simple SVG path graph built on layoutGraph. Mirrors in RTL by flipping x. */
export function PathGraph({ nodes, edges, highlight, onSelect, rtl }: { nodes: GraphNode[]; edges: GraphEdge[]; highlight?: string; onSelect?: (id: string) => void; rtl?: boolean }) {
  const g = layoutGraph(nodes, edges);
  const CW = 200;
  const RH = 64;
  const W = Math.max(1, g.columns) * CW;
  const H = Math.max(1, g.rows) * RH;
  const pos = new Map(g.nodes.map((n) => [n.id, { x: (rtl ? g.columns - 1 - n.col : n.col) * CW + 10, y: n.row * RH + 10 }]));
  return (
    <div className="overflow-x-auto" data-testid="path-graph">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="career path graph">
        {g.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = rtl ? a.x : a.x + 170;
          const x2 = rtl ? b.x + 170 : b.x;
          return <path key={i} d={`M${x1},${a.y + 20} C${(x1 + x2) / 2},${a.y + 20} ${(x1 + x2) / 2},${b.y + 20} ${x2},${b.y + 20}`} fill="none" stroke="rgb(var(--line-strong))" strokeWidth="1.5" />;
        })}
        {g.nodes.map((n) => {
          const p = pos.get(n.id)!;
          const hi = n.id === highlight;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} className={onSelect ? 'cursor-pointer' : ''} onClick={onSelect ? () => onSelect(n.id) : undefined}>
              <rect width="170" height="40" rx="8" fill={hi ? 'rgb(var(--accent))' : 'rgb(var(--panel))'} stroke={hi ? 'rgb(var(--accent))' : 'rgb(var(--line-strong))'} />
              <text x="85" y="24" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={hi ? 'rgb(var(--accent-ink))' : 'rgb(var(--ink))'}>
                {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
