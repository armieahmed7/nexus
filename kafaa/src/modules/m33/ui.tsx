// M33 shared UI (FS25 core skills, FS26 situational judgement practice): the reference-data hook, cluster and level names, the
// "proficiency against needed" bar (McKinsey's main chart), route links and mapping chips. Module-local; pages import from here.
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BenchmarkChip, Icon, StatusPill } from '../../ui';
import { CLUSTERS, CORE_MAX, byCoreSort, type CoreStatus, type RouteRef } from './coreSkills';
import { CourseLink } from '../m04/CourseLink';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

/** Reference rows every M33 page reads (all public). */
export function useM33Ref() {
  const repo = useRepo();
  return useQuery(['core_skills', 'core_skill_targets', 'core_skill_candidates', 'job_families', 'skills', 'sc_traits', 'courses'], async () => {
    const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);
    const [core, targets, candidates, families, skills, traits, courses] = await Promise.all([
      safe(repo.list('core_skills' as never)), safe(repo.list('core_skill_targets' as never)), safe(repo.list('core_skill_candidates' as never, { order: [['sort', 'asc']] } as never)),
      safe(repo.list('job_families')), safe(repo.list('skills')), safe(repo.list('sc_traits' as never)), safe(repo.list('courses')),
    ]);
    return { core: (core as Row[]).filter((c) => c.status !== 'retired').sort(byCoreSort), targets, candidates, families, skills, traits, courses };
  }, []);
}
export type M33Ref = NonNullable<ReturnType<typeof useM33Ref>['data']>;
export const CLUSTER_LIST = CLUSTERS;
export const FS25_FS26 = ['SSG-SF', 'WEF-FOJ', 'GREENCOMP', 'MCK-DELTA', 'IAEA-1917'];
export const CLUSTER_ICON: Record<string, string> = { thinking_critically: 'sparkle', interacting_with_others: 'users', staying_relevant: 'chart' };

export const STATUS_TONE: Record<CoreStatus, 'ok' | 'info' | 'neutral' | 'sim'> = { met: 'ok', below: 'sim', no_evidence: 'neutral', no_target: 'info' };

export function LevelPill({ level, testId }: { level: number; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const tone = level >= 3 ? 'bg-ok-bg text-ok' : level === 2 ? 'bg-accent-soft text-eyebrow' : level === 1 ? 'bg-info-bg text-info' : 'bg-sunken text-ink-3';
  return (
    <span className={`chip border-transparent normal-case tracking-normal ${tone}`} data-testid={testId} data-level={level}>
      {level > 0 && <span className="num">{f.num(level)}</span>}
      <span>{t(`m33.level.${level}`)}</span>
    </span>
  );
}

/** Proficiency against needed: three steps, filled to my level, a marker at the family target. */
export function NeedBar({ level, target, testId = 'm33-need' }: { level: number; target: number | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="grid grid-cols-3 gap-1" data-testid={testId} data-level={level} data-target={target ?? ''} role="img"
      aria-label={t('m33.need.aria', { level: f.num(level), target: target == null ? '—' : f.num(target) })}>
      {Array.from({ length: CORE_MAX }, (_, i) => i + 1).map((n) => {
        const on = n <= level;
        const isT = target === n;
        const short = target != null && n <= target && !on;
        return (
          <div key={n} className={`relative h-3 rounded-sm border ${on ? 'border-accent bg-[rgb(var(--accent))]' : short ? 'border-dashed border-[rgb(var(--sim))] bg-sunken' : 'border-line bg-sunken'}`}>
            {isT && <span className="absolute -top-1.5 end-0 h-6 w-0.5 rounded bg-[rgb(var(--ok))]" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

export function StatusTag({ status }: { status: CoreStatus }) {
  const t = useT();
  return <StatusPill tone={STATUS_TONE[status]}>{t(`m33.status.${status}`)}</StatusPill>;
}

/** A development or assessment route as a link (or plain text for on-the-job and observation routes). */
export function RouteLink({ r, d, icon }: { r: RouteRef; d: M33Ref; icon?: string }) {
  const t = useT();
  const pick = usePick();
  const label = pick(r as unknown as Row, 'title');
  const course = r.kind === 'course' ? d.courses.find((c: Row) => c.id === r.ref) : null;
  let body: ReactNode = <span>{label}</span>;
  if (r.kind === 'course') body = <CourseLink courseId={r.ref} title={course ? pick(course, 'title') : label}>{course ? pick(course, 'title') : label}</CourseLink>; // audit 2026-10-13
  else if (r.kind === 'practice' || r.kind === 'sjt') body = <L to={`/my/core-skills/practice?skill=${r.ref}`}>{label}</L>;
  else if (r.ref.startsWith('/')) body = <L to={r.ref}>{label}</L>;
  return (
    <span className="inline-flex min-w-0 items-start gap-2">
      <Icon name={icon ?? (r.kind === 'course' ? 'book' : r.kind === 'practice' || r.kind === 'sjt' ? 'sparkle' : 'check')} size={14} className="mt-0.5 shrink-0 text-accent" />
      <span className="min-w-0">{body} <span className="text-[11.5px] text-ink-3">· {t(`m33.kind.${r.kind}`)}</span></span>
    </span>
  );
}

export function RouteList({ routes, d, testId }: { routes: RouteRef[]; d: M33Ref; testId?: string }) {
  return (
    <ul className="space-y-1.5 text-[13px]" data-testid={testId}>
      {routes.map((r, i) => <li key={`${r.kind}-${r.ref}-${i}`}><RouteLink r={r} d={d} /></li>)}
    </ul>
  );
}

/** Benchmark mappings: the kafaa_benchmarks chip for each distinct benchmark, then the mapped labels. */
export function MappingList({ c, compact }: { c: Row; compact?: boolean }) {
  const pick = usePick();
  const t = useT();
  return (
    <div className="space-y-2" data-testid="m33-mappings">
      <div className="flex flex-wrap gap-1.5">{(c.benchmark_ids as string[]).map((id) => <BenchmarkChip key={id} id={id} />)}</div>
      {!compact && (
        <ul className="space-y-1 text-[12.5px] text-ink-2">
          {(c.mappings as Row[]).map((m, i) => (
            <li key={i} className="flex items-start gap-2" data-framework={m.framework}>
              <span className="caps mt-0.5 shrink-0 text-[10.5px] text-ink-3">{t(`m33.fwk.${m.framework}`)}</span>
              <span>{pick(m, 'label')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SkillLinks({ ids, d }: { ids: string[]; d: M33Ref }) {
  const pick = usePick();
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const s = d.skills.find((x: Row) => x.id === id);
        return <span key={id} className="chip max-w-full border-line bg-panel normal-case tracking-normal text-ink-2"><L to={`/skills/${id}`} className="truncate text-inherit" data-testid="m33-skill-link">{s ? pick(s, 'name') : id}</L></span>;
      })}
    </span>
  );
}

export function useCoreName(d: M33Ref) {
  const pick = usePick();
  return (id: string | null | undefined) => { const c = d.core.find((x: Row) => x.id === id); return c ? pick(c, 'name') : id ?? ''; };
}
export function useFamilyName(d: M33Ref) {
  const pick = usePick();
  return (id: string | null | undefined) => { const f = d.families.find((x: Row) => x.id === id); return f ? pick(f, 'name') : id ?? ''; };
}
