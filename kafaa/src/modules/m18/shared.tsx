/**
 * M18 shared pieces (F05/F06): one data hook for the career graph and the signed-in person's own records, the readiness hook
 * (rpc.careerReadiness, same rules in TS and SQL), and the presentation bits reused by the Navigator, Roadmap and team pages:
 * band and gate pills, the route-by-route gate list, the readiness ring and the opportunity map.
 */
import { useMemo, type KeyboardEvent } from 'react';
import { useQuery, useRepo } from '../../data';
import type { RowOf } from '../../data';
import { Icon, ProgressRing, StatusPill, type PillTone } from '../../ui';
import { useFormat, useI18n, useLang, usePick, useRefText, useT } from '../../i18n';
import { careerFacts, type CareerFacts, type CareerReadiness, type RouteGate, type CondStatus, type Band } from './career';
import type { BiText } from './career';

export type Role = RowOf<'job_roles'>;
export type Edge = RowOf<'career_paths'>;
export type Target = RowOf<'career_targets'>;
export type RoadmapRow = RowOf<'roadmaps'>;

/** Career graph + catalogue (public reads) and the person's own records (RLS: own rows only). */
export function useCareerBase(personId: string | null | undefined) {
  const repo = useRepo();
  return useQuery(
    ['job_roles', 'career_paths', 'role_competencies', 'competencies', 'skills', 'person_skills', 'courses', 'programmes', 'sources', 'career_targets', 'roadmaps', 'licences', 'qual_records', 'qual_standards', 'training_records', 'enrolments', 'people'],
    async () => {
      const me = personId ?? '__none__';
      const [roles, edges, roleComps, competencies, skills, states, courses, programmes, sources, targets, roadmaps, licences, qualRecords, standards, trainingRecords, enrolments, people] = await Promise.all([
        repo.list('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }),
        repo.list('career_paths', { order: [['sort', 'asc']] }),
        repo.list('role_competencies'),
        repo.list('competencies'),
        repo.list('skills', { order: [['sort', 'asc']] }),
        repo.list('person_skills', { filter: { person_id: me, active: true } }),
        repo.list('courses'),
        repo.list('programmes', { order: [['sort', 'asc']] }),
        repo.list('sources'),
        repo.list('career_targets', { filter: { person_id: me } }),
        repo.list('roadmaps', { filter: { person_id: me } }),
        repo.list('licences', { filter: { person_id: me } }),
        repo.list('qual_records', { filter: { person_id: me } }),
        repo.list('qual_standards'),
        repo.list('training_records', { filter: { person_id: me } }),
        repo.list('enrolments', { filter: { person_id: me } }),
        repo.list('people', { filter: { id: me } }),
      ]);
      const roleById = new Map(roles.map((r) => [r.id, r]));
      const compById = new Map(competencies.map((c) => [c.id, c]));
      const facts: CareerFacts | null = personId
        ? careerFacts({ people, roles, edges: edges as never, roleComps, competencies, skills, states, licences, standards, qualRecords, programmes, courses, trainingRecords, enrolments }, personId, new Date().toISOString().slice(0, 10))
        : null;
      return { roles, edges, roleComps, competencies, skills, states, courses, programmes, sources, targets, roadmaps, roleById, compById, facts, trainingRecords };
    },
    [personId],
  );
}
export type CareerBase = NonNullable<ReturnType<typeof useCareerBase>['data']>;

/** rpc.careerReadiness for a person and a set of roles (throws the refusal message so <Async> shows the error state). */
export function useReadiness(personId: string | null | undefined, roleIds: string[]) {
  const repo = useRepo();
  const key = [...new Set(roleIds)].sort().join(',');
  return useQuery(
    ['person_skills', 'career_targets', 'roadmaps', 'engine_settings', 'qual_records', 'licences', 'training_records'],
    async () => {
      if (!personId || !key) return new Map<string, CareerReadiness>();
      const r = await repo.rpc.careerReadiness(personId, key.split(','));
      if (!r.ok) throw new Error(r.message);
      return new Map((r.data ?? []).map((x) => [x.role_id, x]));
    },
    [personId, key],
  );
}

export const BAND_TONE: Record<Band, PillTone> = { ready_now: 'ok', ready_in: 'info', stretch: 'sim', path_only: 'neutral', current: 'accent' };
export const GATE_TONE: Record<CondStatus | 'none', PillTone> = { met: 'ok', pending: 'sim', not_met: 'bad', none: 'neutral' };
const BAND_FILL: Record<Band, [string, string]> = {
  ready_now: ['var(--ok-bg)', 'var(--ok-line)'],
  ready_in: ['var(--info-bg)', 'var(--info-line)'],
  stretch: ['var(--sim-bg)', 'var(--sim-line)'],
  path_only: ['var(--sunken)', 'var(--line-strong)'],
  current: ['var(--accent)', 'var(--accent)'],
};

export function BandPill({ r }: { r: Pick<CareerReadiness, 'band' | 'months'> }) {
  const t = useT();
  const f = useFormat();
  return (
    <span data-testid="m18-band" data-band={r.band}>
      <StatusPill tone={BAND_TONE[r.band]}>{t(`m18.band.${r.band}`, { n: f.num(r.months ?? 0) })}</StatusPill>
    </span>
  );
}
export function GatePill({ status }: { status: CondStatus | 'none' }) {
  const t = useT();
  return (
    <span data-testid="m18-gate" data-gate={status}>
      <StatusPill tone={GATE_TONE[status]}>{t(`m18.gate.${status}`)}</StatusPill>
    </span>
  );
}
export function ReadinessRing({ r, size = 56 }: { r: Pick<CareerReadiness, 'pct' | 'band' | 'path_only'>; size?: number }) {
  const t = useT();
  const f = useFormat();
  if (r.path_only || r.pct == null) return <span className="caps" title={t('m18.pathOnlyHint')}>{t('m18.noPct')}</span>;
  const tone = r.band === 'ready_now' ? 'ok' : r.band === 'stretch' ? 'sim' : 'accent';
  return <ProgressRing value={r.pct} size={size} tone={tone} label={f.pct(r.pct, 0)} />;
}

const STATUS_ICON: Record<CondStatus, { icon: string; cls: string }> = { met: { icon: 'check', cls: 'text-ok' }, pending: { icon: 'calendar', cls: 'text-sim' }, not_met: { icon: 'close', cls: 'text-bad' } };

/** Every route into the role, each with its conditions marked met / pending / not met and the rule reference. */
export function GateRoutes({ routes, roleById, compact }: { routes: RouteGate[]; roleById: Map<string, Role>; compact?: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const bi = useBi();
  const refText = useRefText();
  if (!routes.length) return <p className="text-[13px] text-ink-2">{t('m18.gates.none')}</p>;
  return (
    <ol className="space-y-3" data-testid="m18-gates">
      {routes.map((r) => (
        <li key={r.edge_id} className="rounded-card border border-line bg-panel p-3" data-testid="m18-gate-route" data-route={r.route_code ?? r.edge_id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">{bi(r.label)}</div>
              <div className="text-[12px] text-ink-2">
                {r.from_role_id ? t('m18.gates.from', { role: pick(roleById.get(r.from_role_id), 'title') }) : t('m18.gates.entry')}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.mine && <StatusPill tone="accent">{t('m18.gates.mine')}</StatusPill>}
              <StatusPill tone="neutral">{t(`m18.edgeType.${r.type}`)}</StatusPill>
              <GatePill status={r.status} />
            </div>
          </div>
          {!compact && (
            <ul className="mt-2 space-y-1 text-[13px]">
              {r.conditions.map((c, i) => (
                <li key={i} className="flex gap-2" data-status={c.status}>
                  <Icon name={STATUS_ICON[c.status].icon} size={14} className={`mt-0.5 shrink-0 ${STATUS_ICON[c.status].cls}`} />
                  <span>
                    <span className="sr-only">{t(`m18.gate.${c.status}`)}: </span>
                    {bi(c)}
                    <span className="ms-1.5 text-[12px] text-ink-3">· {t(`m18.note.${c.note}`, { n: f.num(c.remaining_months) })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {r.rule_ref && (
            <div className="mt-2 text-[11.5px] text-ink-3">
              <Icon name="shield" size={12} className="me-1 inline" />
              {refText(r.rule_ref)}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Bilingual picker for {en, ar} objects (reasons, labels from the engine). */
export function useBi() {
  const l = useLang();
  return (x: BiText | null | undefined) => (x ? (l === 'ar' && x.ar ? x.ar : x.en) : '');
}
/** Direction-aware arrow for "from → to" text. */
export function useArrow() {
  return useI18n().dir === 'rtl' ? '←' : '→';
}

export interface MapNode { id: string; label: string; steps: 0 | 1 | 2; r: CareerReadiness | null; security: boolean }
export interface MapEdge { from: string; to: string; type: string }

/**
 * Opportunity map: my role in the first column, roles one step away in the second, two steps in the third. Node colour =
 * readiness band (with the %), line style = move type (solid vertical, dashed lateral, dotted cross-functional). Mirrors in RTL.
 * Keyboard: every node is a button. A data table follows for screen readers.
 */
export function OpportunityMap({ nodes, edges, onSelect, selected }: { nodes: MapNode[]; edges: MapEdge[]; onSelect: (id: string) => void; selected?: string | null }) {
  const t = useT();
  const f = useFormat();
  const rtl = useI18n().dir === 'rtl';
  const cols = [0, 1, 2].map((s) => nodes.filter((n) => n.steps === s));
  const CW = 250, NW = 200, NH = 52, RH = 66, PAD = 12;
  const rows = Math.max(1, ...cols.map((c) => c.length));
  const W = CW * 2 + NW + PAD * 2;
  const H = rows * RH + PAD * 2;
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    cols.forEach((c, ci) => {
      const off = ((rows - c.length) * RH) / 2;
      c.forEach((n, ri) => {
        const x = PAD + ci * CW;
        m.set(n.id, { x: rtl ? W - x - NW : x, y: PAD + off + ri * RH });
      });
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, rtl]);
  const dash: Record<string, string | undefined> = { vertical: undefined, lateral: '7 5', cross_functional: '2 5' };
  const key = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); }
  };
  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-line bg-raised" data-testid="m18-map">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('m18.map.aria')} className="block">
          <defs>
            <marker id="m18-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--line-strong))" />
            </marker>
          </defs>
          {[1, 2].map((s) => {
            const x = PAD + s * CW - (CW - NW) / 2;
            return <line key={s} x1={rtl ? W - x : x} x2={rtl ? W - x : x} y1={4} y2={H - 4} stroke="rgb(var(--line))" strokeDasharray="2 6" />;
          })}
          {edges.map((e, i) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const x1 = rtl ? a.x : a.x + NW, x2 = rtl ? b.x + NW : b.x;
            const y1 = a.y + NH / 2, y2 = b.y + NH / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 + (rtl ? 4 : -4)},${y2}`} fill="none" markerEnd="url(#m18-arrow)"
                stroke={e.type === 'vertical' ? 'rgb(var(--accent))' : 'rgb(var(--line-strong))'} strokeWidth={e.type === 'vertical' ? 2 : 1.5} strokeDasharray={dash[e.type]} data-type={e.type} />
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id)!;
            const band: Band = n.steps === 0 ? 'current' : n.security ? 'path_only' : (n.r?.band ?? 'stretch');
            const [fill, stroke] = BAND_FILL[band];
            const mine = n.steps === 0;
            const label = n.label.length > 27 ? `${n.label.slice(0, 26)}…` : n.label;
            const pctText = mine ? t('m18.map.you') : n.security ? t('m18.map.pathOnly') : n.r?.pct != null ? f.pct(n.r.pct, 0) : '…';
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${n.label}: ${pctText}`} aria-pressed={selected === n.id}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[3px]" onClick={() => onSelect(n.id)} onKeyDown={(e) => key(e, n.id)} data-testid="m18-map-node" data-role={n.id} data-band={band}>
                <rect width={NW} height={NH} rx="10" fill={`rgb(${fill})`} stroke={selected === n.id ? 'rgb(var(--accent))' : `rgb(${stroke})`} strokeWidth={selected === n.id ? 2.5 : 1.2} />
                <text x={rtl ? NW - 12 : 12} y={21} textAnchor={rtl ? 'end' : 'start'} fontSize="12" fontWeight="600" fill={mine ? 'rgb(var(--accent-ink))' : 'rgb(var(--ink))'}>{label}</text>
                <text x={rtl ? NW - 12 : 12} y={39} textAnchor={rtl ? 'end' : 'start'} fontSize="11" className="num" fill={mine ? 'rgb(var(--accent-ink))' : 'rgb(var(--ink-2))'}>
                  {mine ? t('m18.map.you') : `${pctText} · ${n.security ? t('m18.map.careerOnly') : t(`m18.band.${band}`, { n: f.num(n.r?.months ?? 0) })}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2" data-testid="m18-map-legend">
        <span className="flex items-center gap-1.5"><svg width="28" height="6" aria-hidden><line x1="0" y1="3" x2="28" y2="3" stroke="rgb(var(--accent))" strokeWidth="2" /></svg>{t('m18.edgeType.vertical')}</span>
        <span className="flex items-center gap-1.5"><svg width="28" height="6" aria-hidden><line x1="0" y1="3" x2="28" y2="3" stroke="rgb(var(--line-strong))" strokeWidth="1.5" strokeDasharray="7 5" /></svg>{t('m18.edgeType.lateral')}</span>
        <span className="flex items-center gap-1.5"><svg width="28" height="6" aria-hidden><line x1="0" y1="3" x2="28" y2="3" stroke="rgb(var(--line-strong))" strokeWidth="1.5" strokeDasharray="2 5" /></svg>{t('m18.edgeType.cross_functional')}</span>
        {(['ready_now', 'ready_in', 'stretch', 'path_only'] as Band[]).map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: `rgb(${BAND_FILL[b][0]})`, border: `1px solid rgb(${BAND_FILL[b][1]})` }} aria-hidden />
            {t(`m18.legend.${b}`)}
          </span>
        ))}
      </div>
      <div className="sr-only"><table>
        <caption>{t('m18.map.aria')}</caption>
        <thead><tr><th>{t('m18.map.colRole')}</th><th>{t('m18.map.colSteps')}</th><th>{t('m18.map.colReadiness')}</th></tr></thead>
        <tbody>
          {nodes.filter((n) => n.steps > 0).map((n) => (
            <tr key={n.id}><td>{n.label}</td><td>{n.steps}</td><td>{n.security ? t('m18.map.pathOnly') : n.r?.pct != null ? `${n.r.pct}%` : '—'}</td></tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
