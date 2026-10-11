// M26 shared page pieces (F27 SAT workbench, F29 accreditation readiness): data hooks over the `sat` tables, label lookups,
// status pills, DIF dots and the restricted-task chip. Pages never import backend/*.
import { useMemo } from 'react';
import { useQuery, useRepo, type RowOf } from '../../data';
import { SCHEMA } from '../../data/schema';
import { usePick, useT } from '../../i18n';
import { StatusPill, type PillTone } from '../../ui';
import { proposal, type Proposal } from './sat';
import { roleCoverage, type TraceData } from './evidence';

export const SAT_TABLES = ['jta_analyses', 'jta_tasks', 'dif_ratings', 'sat_objectives', 'task_objectives', 'sat_changes', 'sat_change_items'] as const;
export const ACCR_TABLES = ['accr_criteria', 'accr_programmes', 'accr_selfevals', 'accr_assessments'] as const;
export const HAS_REDESIGN = 'redesign_flags' in SCHEMA; // F25 (W4 · E1): courses flagged for redesign feed the SAT workbench

/** Everything the SAT pages read (sat R: instructors, the training manager, auditors) plus the reference tables they label with. */
export function useSatData() {
  const repo = useRepo();
  return useQuery([...SAT_TABLES, 'job_roles', 'courses', 'course_modules', 'jpms', 'qual_standards', 'role_competencies', 'competencies', 'items', 'job_families'], async () => {
    const [analyses, tasks, ratings, objectives, links, changes, items, roles, courses, modules, jpms, standards, roleComps, comps, families] = await Promise.all([
      repo.list('jta_analyses'), repo.list('jta_tasks', { order: [['sort', 'asc']] }), repo.list('dif_ratings'), repo.list('sat_objectives'), repo.list('task_objectives'),
      repo.list('sat_changes', { order: [['opened_at', 'desc']] }), repo.list('sat_change_items', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('courses').catch(() => [] as RowOf<'courses'>[]), repo.list('course_modules').catch(() => [] as RowOf<'course_modules'>[]),
      repo.list('jpms').catch(() => [] as RowOf<'jpms'>[]), repo.list('qual_standards').catch(() => [] as RowOf<'qual_standards'>[]),
      repo.list('role_competencies').catch(() => [] as RowOf<'role_competencies'>[]), repo.list('competencies').catch(() => [] as RowOf<'competencies'>[]),
      repo.list('job_families').catch(() => [] as RowOf<'job_families'>[]),
    ]);
    return { analyses, tasks, ratings, objectives, links, changes, items, roles, courses, modules, jpms, standards, roleComps, comps, families };
  });
}
export type SatData = NonNullable<ReturnType<typeof useSatData>['data']>;

/** Derived views: proposals per task, coverage per role, label lookups. */
export function useSatModel(d: SatData | undefined) {
  const pick = usePick();
  return useMemo(() => {
    if (!d) return null;
    const by = <R extends { id: string }>(xs: R[]) => new Map(xs.map((x) => [x.id, x]));
    const role = by(d.roles), course = by(d.courses), module = by(d.modules), jpm = by(d.jpms), std = by(d.standards), obj = by(d.objectives), task = by(d.tasks);
    const ratingsOf = new Map<string, typeof d.ratings>();
    for (const r of d.ratings) ratingsOf.set(r.task_id, [...(ratingsOf.get(r.task_id) ?? []), r]);
    const props = new Map<string, Proposal>(d.tasks.map((t) => [t.id, proposal((ratingsOf.get(t.id) ?? []) as never)]));
    const trace: TraceData = { tasks: d.tasks as never, links: d.links as never, objectives: d.objectives as never, roleComps: d.roleComps as never, courses: d.courses as never };
    const coverageOf = (roleId: string) => roleCoverage(roleId, trace);
    const analysisOf = (roleId: string) => d.analyses.find((a) => a.role_id === roleId) ?? null;
    return {
      role, course, module, jpm, std, obj, task, props, ratingsOf, coverageOf, analysisOf, trace,
      roleName: (id: string | null | undefined) => (id && role.get(id) ? pick(role.get(id), 'title') : id ?? '—'),
      courseName: (id: string | null | undefined) => (id && course.get(id) ? `${course.get(id)!.code} · ${pick(course.get(id), 'title')}` : id ?? '—'),
      moduleName: (id: string | null | undefined) => (id && module.get(id) ? pick(module.get(id), 'title') : id ?? '—'),
      jpmName: (id: string | null | undefined) => (id && jpm.get(id) ? `${jpm.get(id)!.code} · ${pick(jpm.get(id), 'title')}` : id ?? '—'),
      stdName: (id: string | null | undefined) => (id && std.get(id) ? `${std.get(id)!.code} · ${pick(std.get(id), 'title')}` : id ?? '—'),
      objText: (id: string) => (obj.get(id) ? pick(obj.get(id), 'text') : id),
    };
  }, [d, pick]);
}
export type SatModel = NonNullable<ReturnType<typeof useSatModel>>;

const ANALYSIS_TONE: Record<string, PillTone> = { draft: 'neutral', survey: 'info', approved: 'ok', restricted: 'reserved' };
export function AnalysisPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={ANALYSIS_TONE[status] ?? 'neutral'} status={status}>{t(`m26.analysis.${status}`)}</StatusPill>;
}
const DECISION_TONE: Record<string, PillTone> = { pending: 'neutral', train: 'accent', overtrain: 'sim', no_train: 'info' };
export function DecisionPill({ decision, override }: { decision: string; override?: boolean }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1">
      <StatusPill tone={DECISION_TONE[decision] ?? 'neutral'} status={decision}>{t(`m26.decision.${decision}`)}</StatusPill>
      {override && <span className="chip border-sim-line bg-sim-bg text-sim" title={t('m26.decision.overrideHint')}>{t('m26.decision.override')}</span>}
    </span>
  );
}
export function RestrictedChip() {
  const t = useT();
  return <span className="chip border-reserved-line bg-reserved-bg text-reserved" data-testid="m26-restricted">{t('m26.restricted.chip')}</span>;
}
export function SourceChip({ source }: { source: string }) {
  const t = useT();
  return <span className="chip border-line bg-sunken text-ink-2">{t(`m26.source.${source}`)}</span>;
}
/** One DIF dimension as five dots (accessible label carries the number). */
export function Dots({ value, label }: { value: number | null | undefined; label: string }) {
  const v = value ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label} title={label}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={`inline-block h-2 w-2 rounded-full ${i <= v ? 'bg-accent' : 'bg-sunken border border-line'}`} />)}
    </span>
  );
}
export function DifDots({ d, i, f }: { d: number | null | undefined; i: number | null | undefined; f: number | null | undefined }) {
  const t = useT();
  if (d == null) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-grid grid-cols-[auto_auto] items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-2">
      <span>{t('m26.dif.d1')}</span><Dots value={d} label={t('m26.dif.dN', { n: d ?? 0 })} />
      <span>{t('m26.dif.i1')}</span><Dots value={i} label={t('m26.dif.iN', { n: i ?? 0 })} />
      <span>{t('m26.dif.f1')}</span><Dots value={f} label={t('m26.dif.fN', { n: f ?? 0 })} />
    </span>
  );
}
const RATING_TONE: Record<number, PillTone> = { 1: 'bad', 2: 'sim', 3: 'info', 4: 'ok' };
export function RatingPill({ rating }: { rating: number | null | undefined }) {
  const t = useT();
  if (rating == null) return <StatusPill tone="neutral" status="unrated">{t('m26.rating.unrated')}</StatusPill>;
  return <StatusPill tone={RATING_TONE[rating] ?? 'neutral'} status={`r${rating}`}>{t(`m26.rating.r${rating}`)}</StatusPill>;
}
const SE_TONE: Record<string, PillTone> = { draft: 'info', finalised: 'ok' };
export function SelfEvalPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={SE_TONE[status] ?? 'neutral'} status={status}>{t(`m26.se.${status}`)}</StatusPill>;
}
export const isRestrictedTask = (t: { restricted: boolean }) => !!t.restricted;

const SCALE = [1, 2, 3, 4, 5];
/** Difficulty, importance and frequency as three 1-5 segmented radio groups (DIF survey and the task page). */
export function RatingInputs({ v, setV }: { v: { d: string; i: string; f: string }; setV: (x: never) => void }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {(['d', 'i', 'f'] as const).map((k) => (
        <fieldset key={k}>
          <legend className="mb-1 text-[12.5px] font-semibold">{t(`m26.dif.${k}`)}</legend>
          <div className="flex gap-1" role="radiogroup" aria-label={t(`m26.dif.${k}`)}>
            {SCALE.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={v[k] === String(n)} title={t(`m26.scale.${k}${n}`)}
                className={`btn-sm flex-1 rounded-btn border ${v[k] === String(n) ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-ink'}`}
                onClick={() => setV({ ...v, [k]: String(n) } as never)}>
                <span className="num">{n}</span>
              </button>
            ))}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">{v[k] ? t(`m26.scale.${k}${v[k]}`) : t('m26.dif.pick')}</div>
        </fieldset>
      ))}
    </div>
  );
}

/** F29: everything the accreditation pages read (sat R). */
export function useAccrData() {
  const repo = useRepo();
  return useQuery([...ACCR_TABLES, 'programmes'], async () => {
    const [criteria, scope, programmes, selfevals, assessments] = await Promise.all([
      repo.list('accr_criteria', { order: [['sort', 'asc']] }), repo.list('accr_programmes', { order: [['sort', 'asc']] }), repo.list('programmes').catch(() => [] as RowOf<'programmes'>[]),
      repo.list('accr_selfevals'), repo.list('accr_assessments'),
    ]);
    return { criteria, scope, programmes, selfevals, assessments };
  });
}
export type AccrData = NonNullable<ReturnType<typeof useAccrData>['data']>;
