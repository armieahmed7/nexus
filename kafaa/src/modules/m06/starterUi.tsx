// FS77 (FS wave H · E5) shared pieces of the starter and induction pages. Module-local.
//   useStarterRefs()   public reference data: starter lessons, induction modules, published baselines (and drafts for HR)
//   LessonCard         one starter lesson: key points, a non-scoring self-check (client state only), sources with as-of dates
//   SourceList         https sources with an as-of date; secondary sources flagged
//   planReasons()      the <WhyThis> reasons of one induction-plan item
//   PlanTable          an induction plan: full / refresher / skip per module with reasons
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { Icon, SourceLink, StatusPill, WhyThis } from '../../ui';
import { L, translate, useFormat, useLang, usePick, useT } from '../../i18n';
import type { Reason } from '../../domain/engines';
import {
  checkOf, linksOf, pointsOf, sourcesOf, type BaselineRow, type InductionModule, type InductionPlan, type PlanItem, type StarterLesson, type StarterSource,
} from './starter';

export type ModuleRow = InductionModule & { title_en: string; title_ar: string; summary_en: string; summary_ar: string; skill_ids?: string[] };
export type BaselineFull = BaselineRow & { note_en: string; note_ar: string; set_by?: string | null; set_at?: string | null; published_by?: string | null; published_at?: string | null; listed?: boolean };

export function useStarterRefs() {
  const repo = useRepo();
  const lessons = useQuery('starter_lessons', () => repo.list('starter_lessons', { order: [['sort', 'asc']] }));
  const modules = useQuery('induction_modules', () => repo.list('induction_modules', { order: [['sort', 'asc']] }));
  const baselines = useQuery('intake_baselines', () => repo.list('intake_baselines', { order: [['intake_year', 'desc']] }));
  const mods = useMemo(() => ((modules.data ?? []) as unknown as ModuleRow[]).map((m) => ({ ...m, hours: Number(m.hours), refresh_hours: Number(m.refresh_hours) })), [modules.data]);
  const bases = useMemo(() => ((baselines.data ?? []) as unknown as BaselineFull[]).map((b) => ({ ...b, intake_year: Number(b.intake_year), version: Number(b.version) })), [baselines.data]);
  return {
    lessonsState: lessons,
    lessons: (lessons.data ?? []) as unknown as StarterLesson[],
    modulesState: modules,
    modules: mods,
    baselinesState: baselines,
    baselines: bases,
  };
}

/** Sources with as-of dates; a secondary source carries a visible flag. */
export function SourceList({ sources, testId = 'm06-starter-sources' }: { sources: StarterSource[]; testId?: string }) {
  const t = useT();
  const f = useFormat();
  if (!sources.length) return null;
  return (
    <ul className="space-y-1" data-testid={testId}>
      {sources.map((s) => (
        <li key={s.url} className="flex flex-wrap items-center gap-1.5 text-[12.5px]" data-testid="m06-starter-source" data-secondary={s.secondary ? 'true' : undefined}>
          <SourceLink href={s.url} date={t('m06.starter.asOf', { date: f.date(s.as_of) })}>{s.label}</SourceLink>
          {s.secondary && (
            <span className="chip border-sim-line bg-sim-bg text-sim" title={t('m06.starter.secondaryHint')} data-testid="m06-starter-secondary">
              {t('m06.starter.secondary')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** One lesson card. The self-check answer lives in this component only (never sent, never stored); `onChecked` lets the page track progress. */
export function LessonCard({ lesson, done, onChecked, moduleTitle }: { lesson: StarterLesson; done: boolean; onChecked: (id: string) => void; moduleTitle?: string | null }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const [answer, setAnswer] = useState<number | null>(null);
  const c = checkOf(lesson);
  const L2 = (x: { en: string; ar: string }) => (lang === 'ar' ? x.ar : x.en);
  return (
    <li className="card flex min-w-0 flex-col gap-3 p-4" data-testid="m06-starter-lesson" data-lesson={lesson.id} data-track={String(lesson.track)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold">{pick(lesson as never, 'title')}</h3>
        {done && <StatusPill tone="ok">{t('m06.starter.checked')}</StatusPill>}
      </div>
      <p className="text-[13.5px] text-ink-2">{pick(lesson as never, 'summary')}</p>
      <div>
        <div className="caps mb-1">{t('m06.starter.keyPoints')}</div>
        <ul className="list-disc space-y-1 ps-5 text-[13px]">
          {pointsOf(lesson).map((p, i) => <li key={i}>{L2(p)}</li>)}
        </ul>
      </div>
      {c && (
        <fieldset className="rounded-card border border-line p-3" data-testid="m06-starter-check">
          <legend className="px-1 text-[13px] font-semibold">{t('m06.starter.checkYourself')}</legend>
          <p className="text-[13px]">{lang === 'ar' ? c.prompt_ar : c.prompt_en}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {c.options.map((o, i) => (
              <label key={i} className={`flex cursor-pointer items-start gap-2 rounded-card border p-2 text-[13px] ${answer === i ? (i === c.correct ? 'border-ok-line bg-ok-bg' : 'border-sim-line bg-sim-bg') : 'border-line hover:border-accent'}`}>
                <input
                  type="radio"
                  className="mt-0.5 accent-[rgb(var(--accent))]"
                  name={`sc-${lesson.id}`}
                  checked={answer === i}
                  onChange={() => { setAnswer(i); onChecked(lesson.id); }}
                  data-testid={`m06-starter-opt-${lesson.id}-${i}`}
                />
                <span>{L2(o)}</span>
              </label>
            ))}
          </div>
          {answer !== null && (
            <div className="mt-2 text-[13px]" aria-live="polite" data-testid={`m06-starter-feedback-${lesson.id}`}>
              <span className="font-semibold">{answer === c.correct ? t('m06.starter.right') : t('m06.starter.notQuite')}</span>{' '}
              {lang === 'ar' ? c.explain_ar : c.explain_en}
            </div>
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        {linksOf(lesson).map((k) => (
          <L key={k.to} to={k.to} className="btn-outline btn-sm" data-testid="m06-starter-link">
            {lang === 'ar' ? k.label_ar : k.label_en}
            <Icon name="chevron" size={13} className="rtl:-scale-x-100" />
          </L>
        ))}
      </div>
      {moduleTitle && <p className="text-[12px] text-ink-3">{t('m06.starter.relatedModule', { module: moduleTitle })}</p>}
      <div className="mt-auto border-t border-line pt-2">
        <div className="caps mb-1">{t('m06.starter.sources')}</div>
        <SourceList sources={sourcesOf(lesson)} />
      </div>
    </li>
  );
}

/** <WhyThis> reasons for one plan item. */
export function planReasons(item: PlanItem, ctx: { year: number; moduleTitle: { en: string; ar: string }; baselineId: string | null; version: number | null; basisLabel: { en: string; ar: string } | null }): Reason[] {
  const vars = { module: ctx.moduleTitle, year: String(ctx.year), basis: ctx.basisLabel ?? { en: '', ar: '' }, hours: item.planned_hours };
  const out: Reason[] = [{ code: `ib_${item.reason}`, key: `m06.reasons.ib_${item.reason}`, vars, ref: { table: 'induction_modules', id: item.module_id } }];
  if (ctx.baselineId && item.reason !== 'mandatory') out.push({ code: 'ib_version', key: 'm06.reasons.ib_version', vars: { id: ctx.baselineId, version: ctx.version ?? 1 }, ref: { table: 'intake_baselines', id: ctx.baselineId } });
  return out;
}

const ACTION_TONE: Record<string, 'ok' | 'info' | 'neutral'> = { skip: 'ok', refresher: 'info', full: 'neutral' };

export function PlanTable({ plan, modules, year, testId = 'm06-plan' }: { plan: Pick<InductionPlan, 'items' | 'baseline_id' | 'baseline_version'>; modules: ModuleRow[]; year: number; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const byId = new Map(modules.map((m) => [m.id, m]));
  const bl = (b: string | null) => (b ? { en: translateBasis(b, 'en'), ar: translateBasis(b, 'ar') } : null);
  return (
    <ul className="divide-y divide-line rounded-card border border-line" data-testid={testId}>
      {plan.items.map((it) => {
        const m = byId.get(it.module_id);
        const title = m ? { en: m.title_en, ar: m.title_ar } : { en: it.module_id, ar: it.module_id };
        return (
          <li key={it.module_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3" data-testid="m06-plan-item" data-module={it.module_id} data-action={it.action}>
            <div className="min-w-0 flex-1 basis-48">{/* FS wave H QA: the module title keeps its width at 390 px; the pills wrap below */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`font-semibold ${it.action === 'skip' ? 'text-ink-3 line-through decoration-1' : ''}`}>{m ? pick(m as never, 'title') : it.module_id}</span>
                {m?.mandatory && <span className="chip border-line bg-sunken text-ink-2">{t('m06.ind.mandatory')}</span>}
              </div>
              {m && <div className="text-[12px] text-ink-3">{t(`m06.ind.area.${m.area}`)}</div>}
            </div>
            <StatusPill tone={ACTION_TONE[it.action]}>{t(`m06.ind.action.${it.action}`)}</StatusPill>
            <span className="num w-24 text-end text-[13px]" data-testid="m06-plan-hours">
              {it.action === 'full' ? t('m06.ind.hoursN', { n: f.num(it.hours) }) : t('m06.ind.hoursOf', { n: f.num(it.planned_hours), of: f.num(it.hours) })}
            </span>
            <WhyThis reasons={planReasons(it, { year, moduleTitle: title, baselineId: plan.baseline_id, version: plan.baseline_version, basisLabel: bl(it.basis) })} testId="m06-plan-why" />
          </li>
        );
      })}
    </ul>
  );
}

// Basis labels used inside reasons (BiText from both language files, so the reason text follows the reader's language).
export const translateBasis = (b: string, lang: 'en' | 'ar') => translate(lang, `m06.ind.basisLower.${b}`);
