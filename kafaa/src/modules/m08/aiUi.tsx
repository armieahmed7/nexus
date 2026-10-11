// FS49 shared UI: data hook and cards for safety culture in an AI-augmented plant (HU tool cards, trait extensions, sourced lessons).
// Read-only: nothing here writes. Drill links open the FS37 sandbox drills; lesson links open /oe. No scores or badges for people.
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { Icon, SimChip, SourceLink, StatusPill } from '../../ui';
import type { HuToolsRow, OeLessonsRow, ScTraitsRow } from '../../data/types';
import { liveLinks, type Bi } from './aiCulture';

export type Row = Record<string, unknown>;
export type DrillLite = { id: string; title_en: string; title_ar: string; level: number; status: string; listed: boolean };
export type AttemptLite = { drill_id: string; passed: boolean; submitted_at: string };
export type Fs49Data = { cards: HuToolsRow[]; traits: ScTraitsRow[]; lessons: OeLessonsRow[]; drills: DrillLite[]; attempts: AttemptLite[] };

/** HU cards (public), traits (public), lessons (staff), published drills (staff) and my own drill attempts (FS37, own rows only). */
export function useFs49Data(personId: string | null, opts: { allLessons?: boolean } = {}) {
  const repo = useRepo();
  return useQuery(['hu_tools', 'sc_traits', 'oe_lessons', 'ai_drills', 'ai_drill_attempts'], async (): Promise<Fs49Data> => {
    const [cards, traits, lessons, drills, attempts] = await Promise.all([
      repo.list('hu_tools', { order: [['sort', 'asc']] }),
      repo.list('sc_traits', { order: [['n', 'asc']] }),
      repo.list('oe_lessons', opts.allLessons ? { order: [['reviewed_on', 'desc']] } : { filter: { status: 'published' }, order: [['reviewed_on', 'desc']] }).catch(() => [] as OeLessonsRow[]),
      (repo.list('ai_drills' as never, { order: [['sort', 'asc']] } as never) as Promise<DrillLite[]>).catch(() => [] as DrillLite[]),
      personId
        ? (repo.list('ai_drill_attempts' as never, { filter: { person_id: personId }, order: [['submitted_at', 'asc']] } as never) as Promise<AttemptLite[]>).catch(() => [] as AttemptLite[])
        : Promise.resolve([] as AttemptLite[]),
    ]);
    return { cards: [...cards].sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1)), traits, lessons, drills, attempts };
  }, [personId, !!opts.allLessons]);
}

export function biText(v: unknown, lang: string) {
  const b = v as Bi | null;
  return b ? (lang === 'ar' && b.ar ? b.ar : b.en) : '';
}

/** "Practise" and "Read" links of a card: only what the reader can open (listed drills, published lessons). */
export function CardLinks({ card, data }: { card: HuToolsRow; data: Fs49Data }) {
  const t = useT();
  const pick = usePick();
  const live = liveLinks(card, data.drills as never, data.lessons as never);
  const latest = (id: string) => data.attempts.filter((a) => a.drill_id === id).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))).pop();
  if (!live.drills.length && !live.lessons.length) {
    // Anonymous visitors cannot open drills or lessons: say what the card links instead of showing dead links.
    const n = card.drill_ids.length + card.lesson_ids.length;
    return n ? <p className="text-[12px] text-ink-3" data-testid="m08-hu-links-staff">{t('m08.hu.linksStaff', { n })}</p> : null;
  }
  return (
    <div className="space-y-1.5" data-testid="m08-hu-links">
      {live.drills.map((id) => {
        const d = data.drills.find((x) => x.id === id)!;
        const a = latest(id);
        return (
          <L key={id} to={`/my/ai-fluency/drills/${id}`} className="flex items-center gap-2 rounded-btn border border-line px-2 py-1.5 text-[12.5px] no-underline hover:bg-sunken" data-testid="m08-hu-drill" data-id={id}>
            <Icon name="sparkle" size={14} className="shrink-0 text-eyebrow" />
            <span className="min-w-0 flex-1 truncate"><span className="text-ink-3">{t('m08.hu.practise')} </span>{pick(d, 'title')}</span>
            {a ? <StatusPill status={a.passed ? 'passed' : 'not_met'}>{a.passed ? t('m08.hu.practised') : t('m08.hu.tryAgain')}</StatusPill> : null}
          </L>
        );
      })}
      {live.lessons.map((id) => {
        const l = data.lessons.find((x) => x.id === id)!;
        return (
          <L key={id} to={`/oe?lesson=${id}`} className="flex items-center gap-2 rounded-btn border border-line px-2 py-1.5 text-[12.5px] no-underline hover:bg-sunken" data-testid="m08-hu-lesson" data-id={id}>
            <Icon name="book" size={14} className="shrink-0 text-eyebrow" />
            <span className="min-w-0 flex-1 truncate"><span className="text-ink-3">{t('m08.hu.read')} </span>{pick(l, 'title')}</span>
          </L>
        );
      })}
    </div>
  );
}

/** One HU tool card: AI-era cards show the trap, the counter-moves and a synthetic plant example; classic cards their AI angle. */
export function HuToolCard({ card, data, showLinks = true }: { card: HuToolsRow; data: Fs49Data; showLinks?: boolean }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const ai = card.topic === 'ai_automation';
  const practice = (Array.isArray(card.practice) ? card.practice : []) as Bi[];
  return (
    <article className={`card flex min-w-0 flex-col gap-3 p-4 ${ai ? 'border-accent/40' : ''}`} data-testid="m08-hu-card" data-id={card.id} data-topic={card.topic}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold leading-snug">{pick(card, 'name')}</h3>
        <span className="flex flex-wrap gap-1">
          {ai && <StatusPill tone="accent">{t('m08.hu.topic.ai_automation')}</StatusPill>}
          <StatusPill tone={card.kind === 'core' ? 'info' : 'neutral'}>{t(`m08.sc.hu.${card.kind}`)}</StatusPill>
        </span>
      </header>
      <p className="text-[13.5px] text-ink-2">{pick(card, 'description')}</p>
      {ai ? (
        <>
          <div className="rounded-card border border-sim-line bg-sim-bg p-3">
            <div className="caps mb-1 flex items-center gap-1"><Icon name="alert" size={13} />{t('m08.hu.trap')}</div>
            <p className="text-[13px]">{pick(card, 'trap')}</p>
          </div>
          <div>
            <div className="caps mb-1">{t('m08.hu.counter')}</div>
            <ol className="list-decimal space-y-1 ps-5 text-[13px]" data-testid="m08-hu-practice">
              {practice.map((s, i) => <li key={i}>{biText(s, lang)}</li>)}
            </ol>
          </div>
          <div className="text-[12.5px] text-ink-2">
            <SimChip label={t('m08.hu.synthetic')} /> <span className="ms-1">{pick(card, 'example')}</span>
          </div>
        </>
      ) : (
        <div className="rounded-card border border-accent/30 bg-accent-soft p-3" data-testid="m08-hu-ai-angle">
          <div className="caps mb-1 flex items-center gap-1"><Icon name="sparkle" size={13} />{t('m08.hu.aiAngle')}</div>
          <p className="text-[13px]">{pick(card, 'ai')}</p>
        </div>
      )}
      {showLinks && <div className="mt-auto"><CardLinks card={card} data={data} /></div>}
    </article>
  );
}

/** A trait with AI and automation in the loop: behaviours, reflection prompts and the HU cards that support it. */
export function TraitAiCard({ trait, data }: { trait: ScTraitsRow; data: Fs49Data }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const cards = trait.ai_hu_ids.map((id) => data.cards.find((c) => c.id === id)).filter((c): c is HuToolsRow => !!c);
  return (
    <article className="card flex min-w-0 flex-col gap-3 p-4" data-testid="m08-ai-trait" data-id={trait.id}>
      <div className="flex items-center gap-2">
        <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-eyebrow" aria-hidden>{f.num(trait.n)}</span>
        <div className="min-w-0">
          <div className="caps">{t('m08.ai.traitEyebrow')}</div>
          <h3 className="text-[15px] font-semibold leading-snug">{pick(trait, 'name')}</h3>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="caps mb-1">{t('m08.ai.looksLike')}</div>
          <ul className="list-disc space-y-1 ps-5 text-[13px]" data-testid="m08-ai-behaviours">
            {(trait.ai_behaviours as Bi[]).map((b, i) => <li key={i}>{biText(b, lang)}</li>)}
          </ul>
        </div>
        <div>
          <div className="caps mb-1">{t('m08.my.reflect')}</div>
          <ul className="list-disc space-y-1 ps-5 text-[13px]">
            {(trait.ai_prompts as Bi[]).map((b, i) => <li key={i}>{biText(b, lang)}</li>)}
          </ul>
        </div>
      </div>
      {cards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-ink-3">{t('m08.ai.supportedBy')}</span>
          {cards.map((c) => <a key={c.id} href={`#hu-${c.id}`} className="chip border-line bg-sunken text-ink-2 no-underline">{pick(c, 'name')}</a>)}
        </div>
      )}
    </article>
  );
}

/** Sources of a lesson: label, link, source year and as-of date. */
export function LessonSources({ lesson }: { lesson: OeLessonsRow }) {
  const t = useT();
  const f = useFormat();
  const src = (Array.isArray(lesson.sources) ? lesson.sources : []) as { label: string; url: string; year: number; as_of: string }[];
  if (!src.length) return null;
  return (
    <ul className="space-y-1" data-testid="m08-lesson-sources">
      {src.map((s, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
          <SourceLink href={s.url}>{s.label}</SourceLink>
          <span className="text-ink-3">{t('m08.ai.sourceMeta', { year: f.num(s.year, { useGrouping: false }), date: f.date(s.as_of) })}</span>
        </li>
      ))}
    </ul>
  );
}

/** One international lesson on automation and digital systems. */
export function LessonCard({ lesson, data }: { lesson: OeLessonsRow; data: Fs49Data }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cards = lesson.hu_ids.map((id) => data.cards.find((c) => c.id === id)).filter((c): c is HuToolsRow => !!c);
  return (
    <article className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m08-ai-lesson" data-id={lesson.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill tone="info">{lesson.source_kind}</StatusPill>
        <span className="text-[12px] text-ink-3">{t('m08.ai.reviewed', { date: f.date(lesson.reviewed_on), body: lesson.reviewing_body })}</span>
      </div>
      <h3 className="text-[15px] font-semibold leading-snug"><L to={`/oe?lesson=${lesson.id}`} className="no-underline hover:underline">{pick(lesson, 'title')}</L></h3>
      <p className="text-[13px] text-ink-2">{pick(lesson, 'summary')}</p>
      <div className="rounded-card border border-accent/40 bg-accent-soft p-3">
        <div className="caps mb-1">{t('m08.oe.lessonFor')}</div>
        <p className="text-[13.5px] font-semibold">{pick(lesson, 'lesson')}</p>
      </div>
      <LessonSources lesson={lesson} />
      {cards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-ink-3">{t('m08.ai.tools')}</span>
          {cards.map((c) => <a key={c.id} href={`#hu-${c.id}`} className="chip border-line bg-sunken text-ink-2 no-underline">{pick(c, 'name')}</a>)}
        </div>
      )}
    </article>
  );
}
