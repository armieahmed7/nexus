// M30 page pieces (FS11 My Role in 2030, FS12 task exposure view): the data hooks over rpc.roleTransformation and the public
// reference rows, labels for requirements, the move / band / driver chips, the archetype card, the milestone timeline, the role and
// horizon pickers and the benchmark ties. Pages never import backend/*.
import { type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { BenchmarkChips, Callout, Card, SimChip, SourceLink, StatusPill, Timeline, type PillTone } from '../../ui';
import type { Archetype, Band, Move } from './transform';
import type { RoleTransformationView } from './backend/rpc';

export const FS11 = 'FS11';
export const FS12 = 'FS12';
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ───────────── data
/** Optional reference lookups of the m30 pages: when one fails the page still renders and names what is missing (RefGaps). */
export type RefLookup = 'families' | 'skills' | 'competencies' | 'courses' | 'archetypes' | 'milestones' | 'maps';
/** Readiness fixes 2026-10-13 (finding 5): the job roles are required, so a failed read shows the error state with a retry (it used to
 *  become an empty list and a valid role page said "Role not found"); the other lookups are optional and listed in `missing`. */
export function useRefData() {
  const repo = useRepo();
  return useQuery(['job_roles', 'job_families', 'skills', 'competencies', 'courses', 'transformation_archetypes', 'transformation_milestones', 'role_transformations'], async () => {
    const missing: RefLookup[] = [];
    const opt = <T,>(what: RefLookup, p: Promise<T[]>) => p.catch((e: unknown) => { console.warn(`[m30] ${what} not loaded`, e); missing.push(what); return [] as T[]; });
    const [roles, families, skills, comps, courses, archetypes, milestones, maps] = await Promise.all([
      repo.list('job_roles', { order: [['sort', 'asc']] }), opt('families', repo.list('job_families', { order: [['sort', 'asc']] })),
      opt('skills', repo.list('skills', { order: [['sort', 'asc']] })), opt('competencies', repo.list('competencies')), opt('courses', repo.list('courses')),
      opt('archetypes', repo.list('transformation_archetypes', { order: [['sort', 'asc']] })), opt('milestones', repo.list('transformation_milestones', { order: [['sort', 'asc']] })),
      opt('maps', repo.list('role_transformations', { order: [['sort', 'asc']] })),
    ]);
    const current = roles.filter((r) => ((r as Row).lifecycle ?? 'current') === 'current');
    return {
      roles: current, roleById: new Map(roles.map((r) => [r.id, r as Row])), familyById: new Map(families.map((f) => [f.id, f as Row])), families: families as Row[],
      skillById: new Map(skills.map((s) => [s.id, s as Row])), compById: new Map(comps.map((c) => [c.id, c as Row])), courseById: new Map(courses.map((c) => [c.id, c as Row])),
      archetypes: archetypes as Row[], milestones: milestones as Row[], maps: maps as Row[], mapByRole: new Map(maps.map((m) => [(m as Row).role_id as string, m as Row])),
      missing: missing.sort(),
    };
  });
}
/** Names the optional lookups that did not load, with a retry (same notice as m28 CatalogueGaps). */
export function RefGaps({ d, onRetry }: { d: { missing: RefLookup[] } | undefined; onRetry?: () => void }) {
  const t = useT();
  if (!d || !d.missing.length) return null;
  return (
    <Callout tone="sim" title={t('m30.refGaps.title')}>
      <span data-testid="m30-ref-gaps">{t('m30.refGaps.body', { parts: d.missing.map((m) => t(`m30.refGaps.part.${m}`)).join(', ') })}</span>
      {onRetry && <button type="button" className="btn-outline btn-sm ms-2" onClick={onRetry}>{t('m30.refGaps.retry')}</button>}
    </Callout>
  );
}
export type RefData = NonNullable<ReturnType<typeof useRefData>['data']>;

export function useRoleMap(roleId: string | null, horizon: '2030' | '2035') {
  const repo = useRepo();
  return useQuery<RoleTransformationView | null>(['role_transformations', 'transformation_drafts', 'jta_tasks', 'person_skills', 'role_profile_versions'],
    () => repo.rpc.roleTransformation(roleId, horizon), [roleId, horizon]);
}

/** ?role= and ?h= in the URL (shareable, back button friendly). */
export function useRoleParams(): { role: string | null; horizon: '2030' | '2035'; set: (k: 'role' | 'h', v: string | null) => void } {
  const [params, setParams] = useSearchParams();
  const role = params.get('role');
  const horizon = params.get('h') === '2035' ? '2035' : '2030';
  const set = (k: 'role' | 'h', v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  return { role: role || null, horizon, set };
}

// ───────────── labels
export function useRefLabel(d: RefData | undefined) {
  const pick = usePick();
  return (kind: string, ref: string | null | undefined) => {
    if (!ref) return '';
    if (kind === 'competency') return pick(d?.compById.get(ref), 'name') || ref;
    return pick(d?.skillById.get(ref), 'name') || ref;
  };
}

// ───────────── chips
export const MOVE_TONE: Record<Move, PillTone> = { grow: 'ok', augmented: 'accent', shrink: 'sim' };
export const BAND_TONE: Record<Band, PillTone> = { human_core: 'ok', augment: 'accent', automate_partly: 'sim' };
export function MovePill({ move }: { move: Move }) {
  const t = useT();
  return <StatusPill tone={MOVE_TONE[move]} status={move}>{t(`m30.move.${move}`)}</StatusPill>;
}
export function BandPill({ band }: { band: Band }) {
  const t = useT();
  return <StatusPill tone={BAND_TONE[band]} status={band}>{t(`m30.band.${band}`)}</StatusPill>;
}
export function DriverChip({ driver, children }: { driver: string; children?: ReactNode }) {
  const t = useT();
  // audit 2026-10-13 (finding 16): long Arabic driver names wrap inside the hero card instead of overflowing it at 390 px
  return <span className="chip max-w-full shrink whitespace-normal break-words border-info-line bg-info-bg text-start text-info" data-testid="m30-driver">{t(`m30.driver.${driver}`)}{children}</span>;
}
export function HorizonChip({ horizon }: { horizon: string | null | undefined }) {
  const t = useT();
  if (!horizon) return null;
  return <span className="chip border-line bg-sunken text-ink-2">{t(`m30.horizon.${horizon}`)}</span>;
}

/** The FS card's benchmark chips (FS01 shared component, rows from kafaa_benchmarks). */
export function BenchTies({ feature }: { feature: string }) {
  const t = useT();
  return <span data-testid="m30-bench"><BenchmarkChips feature={feature} label={t('m30.bench.label')} /></span>;
}

export function NoDeployNote() {
  const t = useT();
  return <Callout tone="sim" title={t('m30.planning.title')}>{t('m30.planning.body')}</Callout>;
}

// ───────────── archetype
export function ArchetypeCard({ id, d }: { id: Archetype | null; d: RefData }) {
  const t = useT();
  const pick = usePick();
  const a = d.archetypes.find((x) => x.id === id);
  if (!a) return null;
  return (
    <Card title={pick(a, 'name')} eyebrow={t('m30.archetype.eyebrow')} className="h-full">
      <div className="space-y-2 text-[13.5px]" data-testid="m30-archetype">
        <p>{pick(a, 'meaning')}</p>
        <p className="rounded-card border border-accent/30 bg-accent-soft p-2.5 text-[13px]"><span className="caps me-1.5 text-eyebrow">{t('m30.archetype.forLearning')}</span>{pick(a, 'learning')}</p>
        <p className="text-[12px] text-ink-3">{t('m30.archetype.example', { roles: pick(a, 'example') })}</p>
        <div className="flex flex-wrap gap-2 text-[12px]">{(a.sources as Row[]).map((s) => <SourceLink key={s.url} href={s.url} date={s.as_of}>{s.label}</SourceLink>)}</div>
      </div>
    </Card>
  );
}

// ───────────── milestones
export function MilestoneTimeline({ d }: { d: RefData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  return (
    <div data-testid="m30-timeline">
      <Timeline items={d.milestones.map((m) => ({
        id: m.id, tone: m.simulated ? 'sim' : m.kind === 'ossa' ? 'bad' : 'accent',
        when: <span className="inline-flex items-center gap-2"><span className="num">{f.num(m.year, { useGrouping: false })}</span>{m.simulated && <SimChip label={t('m30.timeline.sim')} />}</span>,
        title: pick(m, 'title'),
        detail: (
          <span className="block space-y-1">
            <span className="block">{pick(m, 'body')}</span>
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">{(m.sources as Row[]).map((s) => <SourceLink key={s.url} href={s.url} date={s.as_of}>{s.label}</SourceLink>)}</span>
          </span>
        ),
      }))} />
    </div>
  );
}

// ───────────── pickers
export function RolePicker({ d, value, onChange, testId = 'm30-role-picker' }: { d: RefData; value: string; onChange: (v: string) => void; testId?: string }) {
  const t = useT();
  const pick = usePick();
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12.5px] font-semibold">
      <span>{t('m30.picker.role')}</span>
      <select className="input max-w-full" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        <option value="">{t('m30.picker.myRole')}</option>
        {d.families.map((fam) => {
          const rs = d.roles.filter((r) => r.family_id === fam.id);
          return rs.length ? <optgroup key={fam.id} label={pick(fam, 'name')}>{rs.map((r) => <option key={r.id} value={r.id}>{pick(r, 'title')}</option>)}</optgroup> : null;
        })}
      </select>
    </label>
  );
}
export function HorizonToggle({ value, onChange }: { value: '2030' | '2035'; onChange: (h: '2030' | '2035') => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1 text-[12.5px] font-semibold">
      <span>{t('m30.picker.horizon')}</span>
      <div className="inline-flex rounded-card border border-line p-0.5" role="group" aria-label={t('m30.picker.horizon')} data-testid="m30-horizon">
        {(['2030', '2035'] as const).map((h) => (
          <button key={h} type="button" aria-pressed={value === h} onClick={() => onChange(h)}
            className={`rounded-[6px] px-3 py-1 text-[13px] ${value === h ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-sunken'}`}>{t(`m30.horizon.${h}`)}</button>
        ))}
      </div>
    </div>
  );
}

export const roleLink = (roleId: string) => `/careers/roles/${roleId}`;
export function RoleLink({ d, id }: { d: RefData; id: string }) {
  const pick = usePick();
  return <L to={roleLink(id)} className="link">{pick(d.roleById.get(id), 'title') || id}</L>;
}
export type { RowOf };
