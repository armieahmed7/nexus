// M25 shared page pieces (F25 effectiveness, F26 needs): reference labels, suppressed cells, level dots, score bars, trend chips.
// Pages never import backend/*.
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo, type RowOf } from '../../data';
import { usePick, useT, useFormat } from '../../i18n';
import { StatusPill, type PillTone } from '../../ui';
import type { CourseCard, KpiView } from './eff';

/** Reference rows every M25 page labels with (courses: staff-readable; job roles: public). */
export function useM25Refs() {
  const repo = useRepo();
  return useQuery(['courses', 'job_roles', 'eval_surveys'], async () => {
    const [courses, roles, surveys] = await Promise.all([
      repo.list('courses').catch(() => [] as RowOf<'courses'>[]),
      repo.list('job_roles').catch(() => [] as RowOf<'job_roles'>[]),
      repo.list('eval_surveys').catch(() => [] as RowOf<'eval_surveys'>[]),
    ]);
    return { courses, roles, surveys };
  });
}
export type M25Refs = NonNullable<ReturnType<typeof useM25Refs>['data']>;

export function useM25Labels(refs: M25Refs | undefined) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const co = new Map((refs?.courses ?? []).map((c) => [c.id, c]));
    const ro = new Map((refs?.roles ?? []).map((r) => [r.id, r]));
    return {
      course: (id: string) => ({ code: co.get(id)?.code ?? id, title: co.get(id) ? pick(co.get(id), 'title') : id, row: co.get(id) }),
      role: (id: string) => (id === 'none' ? t('m25.common.noRole') : ro.get(id) ? pick(ro.get(id), 'title') : id),
      group: (key: string, source: string) => (source === 'klra' ? t(`m25.dept.${key}`) : key === 'none' ? t('m25.common.noRole') : ro.get(key) ? pick(ro.get(key), 'title') : key),
      committee: (k: string) => t(`m25.committee.${k}`),
    };
  }, [refs, pick, t]);
}

/** A count or percentage that may be suppressed (null = group under 10). */
export function Sup({ v, pct, decimal, testId }: { v: number | null | undefined; pct?: boolean; decimal?: boolean; testId?: string }) {
  const t = useT();
  const f = useFormat();
  if (v === null || v === undefined)
    return <span className="inline-flex items-center rounded-full border border-line bg-sunken px-2 text-[11.5px] text-ink-3" title={t('m25.common.suppressedHint')} data-testid={testId ?? 'm25-suppressed'}>{t('m25.common.suppressed')}</span>;
  return <span className="num">{decimal ? f.num(v / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : f.num(v)}{pct ? '%' : ''}</span>;
}

/** L1 mean (×10) as a /5 score with a small bar. */
export function ScoreBar({ v10 }: { v10: number | null }) {
  const f = useFormat();
  if (v10 === null) return <Sup v={null} />;
  const pct = Math.max(0, Math.min(100, (v10 / 50) * 100));
  const tone = v10 >= 40 ? 'bg-ok' : v10 >= 35 ? 'bg-accent' : 'bg-bad';
  return (
    <span className="inline-flex min-w-[96px] items-center gap-2">
      <span className="num w-8 text-end font-semibold">{f.num(v10 / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      <span className="h-1.5 flex-1 rounded-full bg-sunken" aria-hidden><span className={`block h-1.5 rounded-full ${tone}`} style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

/** Four dots, one per Kirkpatrick level shown with enough data. */
export function LevelDots({ card }: { card: CourseCard }) {
  const t = useT();
  const on = [!card.l1.suppressed, card.l2.pairs !== null, card.l3.done !== null, card.l4.kpis.length > 0];
  return (
    <span className="inline-flex items-center gap-1" aria-label={t('m25.common.levelsShown', { n: card.levels })} title={t('m25.common.levelsShown', { n: card.levels })}>
      {on.map((x, i) => (
        <span key={i} className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-semibold ${x ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line text-ink-3'}`}>{i + 1}</span>
      ))}
    </span>
  );
}

const TREND_TONE: Record<KpiView['trend'], PillTone> = { improving: 'ok', worsening: 'bad', flat: 'neutral' };
export function TrendChip({ k }: { k: KpiView }) {
  const t = useT();
  const pick = usePick();
  return <StatusPill tone={TREND_TONE[k.trend]}>{pick(k, 'label')} · {t(`m25.trend.${k.trend}`)}</StatusPill>;
}

export function VerdictPill({ card }: { card: CourseCard }) {
  const t = useT();
  if (card.open_flag) return <StatusPill tone="sim">{t('m25.verdict.flagged')}</StatusPill>;
  if (card.redesign) return <StatusPill tone="bad">{t('m25.verdict.redesign')}</StatusPill>;
  if (card.levels === 0 || card.l1.suppressed) return <StatusPill tone="neutral">{t('m25.verdict.insufficient')}</StatusPill>;
  return <StatusPill tone="ok">{t('m25.verdict.onTrack')}</StatusPill>;
}

/** The four Kirkpatrick levels as a compact legend. */
export function KirkpatrickLegend({ extra }: { extra?: ReactNode }) {
  const t = useT();
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m25-levels">
      {[1, 2, 3, 4].map((n) => (
        <li key={n} className="rounded-card border border-line bg-panel p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{n}</span>
            <span className="font-semibold">{t(`m25.level.l${n}.name`)}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-2">{t(`m25.level.l${n}.what`)}</p>
        </li>
      ))}
      {extra}
    </ol>
  );
}

export const SOURCE_ROUTES: Record<string, string> = {
  expiry: '/training/quals', mandatory: '/training/courses', klra: '/knowledge/klra', roadmap: '/my/career/roadmap', coach: '/my/coach', future: '/my/future',
};
