// F34 Student-to-career journey (W5 · E3): shared pieces of the journey pages. Module-local.
//   useJourneyRefs()   public reference data (questions, facts, sources, programmes, families, roles), read for everyone
//   FactList           board facts, each with its source link and as-of date (BACKLOG F34 acceptance 3)
//   asOfText()         as-of date at the stored precision (day, month or year)
//   familyRanked()     explorer families as engine-style ranked items with reasons (answers that point to them), never a score
import { useMemo } from 'react';
import { useRepo, useQuery } from '../../data';
import { SourceLink } from '../../ui';
import { L, translate, useFormat, useLang, usePick, useT } from '../../i18n';
import type { Ranked, Reason } from '../../domain/engines';
import { exploreInterests, optionsOf, suggestRoute, type Answers, type Exploration, type JourneyQuestionRow, type RouteSuggestion } from './journey';

export interface FactRow {
  id: string;
  step: string;
  programme_id: string | null;
  role_id: string | null;
  text_en: string;
  text_ar: string;
  source_id: string;
  as_of: string;
  precision: string;
  sort: number;
}
export interface SourceRow {
  id: string;
  label: string;
  url: string;
}

export function useJourneyRefs() {
  const repo = useRepo();
  const questions = useQuery('journey_questions', () => repo.list('journey_questions', { order: [['sort', 'asc']] }));
  const facts = useQuery('journey_facts', () => repo.list('journey_facts', { order: [['sort', 'asc']] }));
  const sources = useQuery('sources', () => repo.list('sources', {}));
  const programmes = useQuery('talent_programmes', () => repo.list('talent_programmes', { order: [['sort', 'asc']] }));
  const families = useQuery('job_families', () => repo.list('job_families', { order: [['sort', 'asc']] }));
  const roles = useQuery('job_roles', () => repo.list('job_roles', { order: [['sort', 'asc']] }));
  const familySort = useMemo(() => Object.fromEntries((families.data ?? []).map((f) => [f.id, Number(f.sort ?? 999)])), [families.data]);
  const sourceById = useMemo(() => new Map((sources.data ?? []).map((s) => [s.id, s as unknown as SourceRow])), [sources.data]);
  return {
    questions: questions as typeof questions & { data?: JourneyQuestionRow[] },
    qs: (questions.data ?? []) as unknown as JourneyQuestionRow[],
    facts: (facts.data ?? []) as unknown as FactRow[],
    factsState: facts,
    sourceById,
    programmes,
    families,
    roles,
    familySort,
  };
}

/** As-of date at the fact's precision, in the reader's language and digits (or in a forced language: the parent view's Arabic block
 *  on the English page reads "حتى ..." in Arabic, W5 QA). */
export function useAsOf(forceLang?: 'en' | 'ar') {
  const f = useFormat();
  const lang = useLang();
  const locale = forceLang && forceLang !== lang ? f.locale.replace(/^(ar-AE|en-GB)/, forceLang === 'ar' ? 'ar-AE' : 'en-GB') : f.locale;
  return (iso: string, precision: string) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    if (precision === 'year') return new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: 'UTC' }).format(d);
    if (precision === 'month') return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
    return locale === f.locale ? f.date(iso) : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  };
}

/** Facts with a source link and an as-of date each. `lang` forces a language (the parent view shows Arabic first). */
export function FactList({ facts, sources, testId = 'm06-journey-facts', forceLang }: { facts: FactRow[]; sources: Map<string, SourceRow>; testId?: string; forceLang?: 'en' | 'ar' }) {
  const t = useT();
  const lang = useLang();
  const l = forceLang ?? lang;
  const asOf = useAsOf(l);
  const tl = (key: string, vars: Record<string, string>) => (l === lang ? t(key, vars) : translate(l, key, vars));
  if (!facts.length) return null;
  return (
    <ul className="space-y-2 text-[13px]" data-testid={testId}>
      {facts.map((x) => {
        const s = sources.get(x.source_id);
        return (
          <li key={x.id} className="border-s-2 border-line ps-2.5" data-testid="m06-journey-fact" data-fact={x.id} lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'}>
            <div className="text-ink">{l === 'ar' ? x.text_ar : x.text_en}</div>
            <div className="mt-0.5">
              {s ? (
                <SourceLink href={s.url} date={tl('m06.journey.asOf', { date: asOf(x.as_of, x.precision) })}>
                  <span data-testid="m06-journey-fact-source" {...(l === 'ar' && !/[\u0600-\u06FF]/.test(s.label) ? { lang: 'en', dir: 'ltr' } : {})}>{s.label}</span>
                </SourceLink>
              ) : (
                <span className="text-ink-3">{tl('m06.journey.asOf', { date: asOf(x.as_of, x.precision) })}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Explorer families as ranked items: the reasons are the answers that point to the family (no score is ever displayed). */
export function familyRanked(qs: JourneyQuestionRow[], answers: Answers, ex: Exploration): Ranked[] {
  const byId = new Map(qs.map((q) => [q.id, q]));
  return ex.families.map((h) => ({
    id: h.id,
    score: ex.answered ? h.hits / ex.answered : 0,
    reasons: h.questions.map((qid): Reason => {
      const q = byId.get(qid)!;
      const o = optionsOf(q).find((x) => x.id === answers[qid]);
      return { code: 'answer', key: 'm06.reasons.answer', vars: { q: { en: q.prompt_en, ar: q.prompt_ar }, a: { en: o?.en ?? '', ar: o?.ar ?? '' } }, ref: { table: 'journey_questions', id: qid } };
    }),
  }));
}

/** Reasons for the suggested route (shown in a "Why this?" next to it). */
export function routeReasons(s: RouteSuggestion, qs: JourneyQuestionRow[], answers: Answers, stageLabel: (s: string) => string, famName: (id: string) => { en: string; ar: string }, stage: string | null): Reason[] {
  const out: Reason[] = [];
  for (const w of s.why) {
    if (w === 'chosen') out.push({ code: 'route_chosen', key: 'm06.reasons.route_chosen' });
    if (w === 'study') {
      const q = qs.find((x) => optionsOf(x).some((o) => o.route && answers[x.id] === o.id));
      const o = q ? optionsOf(q).find((x) => x.id === answers[q.id]) : undefined;
      out.push({ code: 'route_study', key: 'm06.reasons.route_study', vars: { a: { en: o?.en ?? '', ar: o?.ar ?? '' } } });
    }
    if (w === 'stage' && stage) out.push({ code: 'route_stage', key: 'm06.reasons.route_stage', vars: { stage: stageLabel(stage) } });
    if (w === 'family') {
      const names = s.fits.map(famName);
      out.push({ code: 'route_family', key: 'm06.reasons.route_family', vars: { families: { en: names.map((n) => n.en).join(', '), ar: names.map((n) => n.ar).join('، ') } } });
    }
  }
  return out;
}

/** Explorer state derived for a set of answers (memoised by callers). */
export function useExploration(qs: JourneyQuestionRow[], answers: Answers, familySort: Record<string, number>, stage: string | null, chosen: string | null) {
  return useMemo(() => {
    const ex = exploreInterests(qs, answers, familySort);
    return { ex, suggestion: suggestRoute(stage, chosen, ex) };
  }, [qs, answers, familySort, stage, chosen]);
}

export function usePickName() {
  const pick = usePick();
  return (row: object | null | undefined, field = 'name') => pick(row, field);
}

/** F34 entry point on /pathways: one card that opens the personal journey (school leavers reach DNT in two clicks from here). */
export function JourneyTeaser() {
  const t = useT();
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-accent p-4" data-testid="m06-journey-teaser">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{t('m06.journey.teaserTitle')}</div>
        <p className="mt-0.5 text-[13px] text-ink-2">{t('m06.journey.teaserBody')}</p>
      </div>
      <L to="/pathways/journey" className="btn-primary btn-sm" data-testid="m06-journey-teaser-open">
        {t('m06.journey.teaserOpen')}
      </L>
    </div>
  );
}
