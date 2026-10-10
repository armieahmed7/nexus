// M29 shared UI (FS09 AI fluency ladder, FS10 fitness check): reference data hook, rung names, the ladder steps visual, cell and
// learning lists. Module-local; pages import from here.
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Icon, StatusPill } from '../../ui';
import { DIMENSIONS, MAX_RUNG, RUNG_KEYS, sortCells } from './fluency';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

/** Reference rows every M29 page reads (all public except the organisation target, which is Agg/R). */
export function useM29Ref() {
  const repo = useRepo();
  return useQuery(['ai_rungs', 'ai_skill_tracks', 'ai_role_targets', 'fitness_areas', 'job_families', 'skills', 'courses'], async () => {
    const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);
    const [cells, tracks, targets, areas, families, skills, courses] = await Promise.all([
      safe(repo.list('ai_rungs' as never)), safe(repo.list('ai_skill_tracks' as never)), safe(repo.list('ai_role_targets' as never, { order: [['sort', 'asc']] } as never)),
      safe(repo.list('fitness_areas' as never, { order: [['sort', 'asc']] } as never)), safe(repo.list('job_families')), safe(repo.list('skills')),
      safe(repo.list('courses', { filter: { id: 'c-ai-gov' } } as never)),
    ]);
    return { cells: sortCells(cells as Row[]) as Row[], tracks, targets, areas, families, skills, courses };
  }, []);
}
export type M29Ref = NonNullable<ReturnType<typeof useM29Ref>['data']>;

export const RUNG_TONE = ['bg-sunken text-ink-3', 'bg-info-bg text-info', 'bg-accent-soft text-eyebrow', 'bg-ok-bg text-ok', 'bg-ok-bg text-ok'];

export function useRungName() {
  const t = useT();
  return (rung: number) => (rung >= 1 && rung <= MAX_RUNG ? t(`m29.rung.${RUNG_KEYS[rung - 1]}`) : t('m29.rung.none'));
}

export function RungPill({ rung, testId }: { rung: number; testId?: string }) {
  const name = useRungName();
  const f = useFormat();
  return (
    <span className={`chip border-transparent normal-case tracking-normal ${RUNG_TONE[Math.max(0, Math.min(4, rung))]}`} data-testid={testId} data-rung={rung}>
      <span className="num">{f.num(rung)}</span>
      <span>{name(rung)}</span>
    </span>
  );
}

/** Four ascending steps: filled up to the person's rung, a marker on the target rung. */
export function LadderSteps({ rung, target, testId = 'm29-steps' }: { rung: number; target?: number | null; testId?: string }) {
  const t = useT();
  const name = useRungName();
  const f = useFormat();
  return (
    <ol className="grid grid-cols-4 items-end gap-1.5 sm:gap-2" data-testid={testId} aria-label={t('m29.steps.aria', { rung: name(rung) })}>
      {[1, 2, 3, 4].map((r) => {
        const on = r <= rung;
        const isTarget = target === r;
        return (
          <li key={r} className="flex min-w-0 flex-col items-stretch gap-1" data-step={r} data-on={on ? 'yes' : 'no'}>
            {isTarget ? <span className="caps truncate text-center text-[10.5px] text-ok">{t('m29.steps.target')}</span> : <span className="h-[15px]" aria-hidden="true" />}
            <div className={`rounded-md border ${on ? 'border-accent bg-[rgb(var(--accent))]' : 'border-line bg-sunken'} ${isTarget ? 'ring-2 ring-[rgb(var(--ok))] ring-offset-1' : ''}`}
              style={{ height: `${18 + r * 14}px` }} aria-hidden="true" />
            <span className={`truncate text-center text-[12px] ${on ? 'font-semibold text-ink' : 'text-ink-3'}`}>
              <span className="num">{f.num(r)}</span> {name(r)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function DimHead({ dim }: { dim: string }) {
  const t = useT();
  return (
    <span className="flex flex-col">
      <span className="font-semibold">{t(`m29.dim.${dim}`)}</span>
      <span className="text-[11.5px] font-normal text-ink-3">{t(`m29.dimSub.${dim}`)}</span>
    </span>
  );
}

export function SkillChips({ ids, data: d, level }: { ids: string[]; data: M29Ref; level?: number }) {
  const pick = usePick();
  const t = useT();
  const f = useFormat();
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const s = d.skills.find((x: Row) => x.id === id);
        return <span key={id} className="chip max-w-full border-line bg-panel normal-case tracking-normal text-ink-2"><span className="truncate">{s ? pick(s, 'name') : id}</span></span>;
      })}
      {level != null && <span className="chip border-transparent bg-sunken normal-case tracking-normal text-ink-3">{t('m29.cell.minLevel', { level: f.num(level) })}</span>}
    </span>
  );
}

export function LearningList({ items, d }: { items: Row[]; d: M29Ref }) {
  const t = useT();
  const pick = usePick();
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5 text-[13px]" data-testid="m29-learning">
      {items.map((it, i) => {
        const course = it.kind === 'course' ? d.courses.find((c: Row) => c.id === it.ref) : null;
        const label = course ? pick(course, 'title') : pick(it, 'title');
        const icon = it.kind === 'course' ? 'book' : it.kind === 'check' ? 'check' : 'sparkle';
        const body: ReactNode = it.kind === 'course' && it.ref ? <L to={`/learn/course/${it.ref}`}>{label}</L>
          : it.kind === 'check' ? <L to="/my/ai-fluency/check">{label}</L> : <span>{label}</span>;
        return (
          <li key={`${it.kind}-${i}`} className="flex items-start gap-2">
            <Icon name={icon} size={14} className="mt-0.5 shrink-0 text-accent" />
            <span className="min-w-0">{body} <span className="text-[11.5px] text-ink-3">· {t(`m29.learn.kind.${it.kind}`)}</span></span>
          </li>
        );
      })}
    </ul>
  );
}

export function TargetLine({ target, d }: { target: Row | null | undefined; d: M29Ref }) {
  const t = useT();
  const name = useRungName();
  if (!target) return <span className="text-ink-3">—</span>;
  const extra = (target.plus_cells ?? []).map((id: string) => {
    const c = d.cells.find((x: Row) => x.id === id);
    return c ? t('m29.target.plus', { rung: name(c.rung), dim: t(`m29.dim.${c.dimension}`) }) : id;
  });
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RungPill rung={target.rung} />
      {extra.map((x: string) => <StatusPill key={x} tone="accent">{x}</StatusPill>)}
    </span>
  );
}

export const DIMS = DIMENSIONS;
export const FS09_FS10 = ['AI-LIT', 'UAE-AI', 'LINKEDIN', 'DIGCOMP', 'SKILLS-TECH', 'OECD-PIAAC'];
