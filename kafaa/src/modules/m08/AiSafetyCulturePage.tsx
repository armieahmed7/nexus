// FS49 /my/safety-culture/ai (internal_content R, all staff): safety culture for an AI-augmented plant. Questioning attitude and
// conservative decision-making with AI and automation in the loop, the AI-era HU tool cards (each linked to FS37 sandbox drills or OE
// lessons), "which tool fits this moment?" (deterministic matcher with reasons: it ranks content, never people), the classic tools with
// their AI angle and a sourced set of international lessons on automation and digital systems. No scores, no badges, nothing stored.
// Concerns go to the Employee Concerns Program: this page only links to /speak-up and adds nothing there.
import { useMemo, useState } from 'react';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, EmptyState, Icon, Page, Section, StatTile, WhyThis } from '../../ui';
import { SITUATIONS, fs49Coverage, matchSituation } from './aiCulture';
import { HuToolCard, LessonCard, TraitAiCard, useFs49Data, type Fs49Data } from './aiUi';

export default function AiSafetyCulturePage() {
  const t = useT();
  const s = useSession();
  const q = useFs49Data(s.identity.personId);
  return (
    <Page
      title={t('m08.routes.my-safety-culture-ai.title')}
      eyebrow={<BenchmarkChips feature="FS49" />}
      intro={t('m08.ai.intro')}
      wide
      actions={
        <>
          <L to="/my/ai-fluency/drills" className="btn-primary btn-sm no-underline" data-testid="m08-ai-to-drills"><Icon name="sparkle" />{t('m08.ai.toDrills')}</L>
          <L to="/my/safety-culture" className="btn-outline btn-sm no-underline">{t('m08.ai.toLearning')}</L>
        </>
      }
    >
      <Async state={q} isEmpty={(d) => d.cards.length === 0}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: Fs49Data }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cov = useMemo(() => fs49Coverage(d.cards as never, d.lessons as never, d.drills as never), [d]);
  const aiCards = d.cards.filter((c) => c.topic === 'ai_automation');
  const classic = d.cards.filter((c) => c.topic !== 'ai_automation');
  const traits = d.traits.filter((x) => (x.ai_behaviours as unknown[]).length > 0);
  const lessons = d.lessons.filter((l) => l.topic === 'ai_automation');
  const [sit, setSit] = useState(SITUATIONS[0].id);
  const matches = useMemo(() => matchSituation(sit, d.cards), [sit, d.cards]);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m08-ai-tiles">
        <StatTile label={t('m08.ai.tile.aiCards')} value={f.num(cov.aiCards)} sub={t('m08.ai.tile.aiCardsSub')} />
        <StatTile label={t('m08.ai.tile.classic')} value={f.num(classic.length)} sub={t('m08.ai.tile.classicSub')} />
        <StatTile label={t('m08.ai.tile.drills')} value={f.num(cov.drillsLinked)} sub={t('m08.ai.tile.drillsSub')} />
        <StatTile label={t('m08.ai.tile.lessons')} value={f.num(lessons.length)} sub={t('m08.ai.tile.lessonsSub')} />
      </div>

      <Section title={t('m08.ai.traitsTitle')} description={t('m08.ai.traitsIntro')}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2" data-testid="m08-ai-traits">
          {traits.map((tr) => <TraitAiCard key={tr.id} trait={tr} data={d} />)}
        </div>
      </Section>

      <Section title={t('m08.ai.cardsTitle')} description={t('m08.ai.cardsIntro')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m08-ai-cards">
          {aiCards.map((c) => <div key={c.id} id={`hu-${c.id}`} className="min-w-0"><HuToolCard card={c} data={d} /></div>)}
        </div>
      </Section>

      <Section title={t('m08.ai.fitTitle')} description={t('m08.ai.fitIntro')}>
        <div className="card space-y-3 p-4" data-testid="m08-ai-fit">
          <div role="radiogroup" aria-label={t('m08.ai.fitPick')} className="flex flex-wrap gap-1.5">
            {SITUATIONS.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={sit === x.id} onClick={() => setSit(x.id)} data-testid={`m08-ai-sit-${x.id}`}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${sit === x.id ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line text-ink-2 hover:bg-sunken'}`}>
                {t(`m08.ai.sit.${x.id}`)}
              </button>
            ))}
          </div>
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-3" aria-live="polite" data-testid="m08-ai-fit-results">
            {matches.map((m, i) => (
              <li key={m.id} className="rounded-card border border-line p-3" data-testid="m08-ai-fit-item" data-id={m.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="num text-[12px] text-ink-3">{f.num(i + 1)}</span>
                  <WhyThis reasons={m.reasons as never} testId={`m08-ai-why-${m.id}`} />
                </div>
                <a href={`#hu-${m.id}`} className="block text-[14px] font-semibold no-underline hover:underline">{pick(m.card, 'name')}</a>
                <p className="mt-1 text-[12.5px] text-ink-2">{pick(m.card, m.card.topic === 'ai_automation' ? 'description' : 'ai')}</p>
              </li>
            ))}
          </ol>
          <p className="text-[12px] text-ink-3">{t('m08.ai.fitNote')}</p>
        </div>
      </Section>

      <Section title={t('m08.ai.classicTitle')} description={t('m08.ai.classicIntro')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="m08-ai-classic">
          {classic.map((c) => <div key={c.id} id={`hu-${c.id}`} className="min-w-0"><HuToolCard card={c} data={d} /></div>)}
        </div>
      </Section>

      <Section title={t('m08.ai.lessonsTitle')} description={t('m08.ai.lessonsIntro')}>
        {lessons.length === 0 ? <EmptyState title={t('m08.ai.noLessons')} /> : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m08-ai-lessons">
            {lessons.map((l) => <LessonCard key={l.id} lesson={l} data={d} />)}
          </div>
        )}
        <p className="text-[12px] text-ink-3">{t('m08.ai.lessonsNote')}</p>
      </Section>

      <div className="grid gap-3 md:grid-cols-2">
        <Callout tone="info" title={t('m08.ai.concernTitle')}>
          {t('m08.ai.concernBody')} <L to="/speak-up" data-testid="m08-ai-speakup">{t('m08.ai.concernLink')}</L>
        </Callout>
        <Callout tone="info" title={t('m08.sc.noGameTitle')}>
          {t('m08.ai.noGame')} <L to="/workforce/ai-register">{t('m08.ai.toRegister')}</L>
        </Callout>
      </div>
    </div>
  );
}
