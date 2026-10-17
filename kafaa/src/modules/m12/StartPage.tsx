// M12 · Find my route (/start, public): three short questions (who you are, with a role family for employees; what you want to
// do; an optional interest and experience level) produce an ordered, printable route of 4-7 steps into real pages and help
// guides (src/modules/m12/orient/route.ts). The answers live in the URL query (?who=…&goal=…&s=r), so a route can be shared
// or bookmarked; nothing is sent or stored. One public read on the route screen: programmes for students and graduates, or the
// roles in an employee's family. Native radio groups (arrow keys move, Enter submits), focus moves to each new question.
import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { L, useLang, usePick, useT } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { config } from '../../config';
import { Async, Callout, Icon, Page, Section, Stepper, useToast } from '../../ui';
import { href } from '../../routes/registry';
import { GUIDE_BY_ID } from './help/content';
import { GoToLink } from './help/ui';
import type { HelpLink } from './help/types';
import {
  FAMILIES, FAMILY_IDS, GOALS, INTERESTS, LEVELS, PROGRAMME_STAGES, SCREENS, WHO,
  buildRoute, parseAnswers, screenDone, screenFor, toQuery, type Answers, type ProgrammeStage, type Screen,
} from './orient/route';

export default function StartPage() {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const a = parseAnswers(sp);
  const screen = screenFor(a, sp.get('s'));
  const head = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // A new screen: move focus to its question (not on first load, so the page title is read first).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    head.current?.focus();
  }, [screen]);

  /** Answer changes replace the history entry; moving between screens adds one, so the browser Back button works. */
  const set = (next: Answers) => setSp(toQuery(next, screen), { replace: true });
  const go = (s: Screen, next: Answers = a) => setSp(toQuery(next, s));
  const idx = SCREENS.indexOf(screen);

  return (
    <Page title={t('m12.routes.start.title')} intro={t('m12.start.intro')}>
      <div className="no-print space-y-2">
        <nav aria-label={t('m12.start.progress')}>
          <Stepper steps={(['who', 'goal', 'details', 'route'] as const).map((id) => ({ id, label: t(`m12.start.step.${id}`) }))} current={idx} />
        </nav>
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3" data-testid="m12-start-privacy">
          <Icon name="shield" size={13} />
          {t('m12.start.privacy')}
        </p>
      </div>

      {screen === '1' && (
        <Question
          head={head}
          n={1}
          title={t('m12.start.q.who')}
          canGo={screenDone(a, '1')}
          onNext={() => go('2')}
          testid="m12-start-q1"
        >
          <Choices name="who" value={a.who ?? ''} onChange={(v) => set({ ...a, who: v as Answers['who'], family: v === 'employee' ? a.family : undefined })}
            options={WHO.map((w) => ({ value: w, label: t(`m12.start.who.${w}.label`), hint: t(`m12.start.who.${w}.hint`) }))} />
          {a.who === 'employee' && (
            <fieldset className="mt-5" data-testid="m12-start-family-q">
              <legend className="mb-2 text-[15px] font-semibold">{t('m12.start.q.family')}</legend>
              <Choices name="family" value={a.family ?? ''} onChange={(v) => set({ ...a, family: v as Answers['family'] })}
                options={FAMILIES.map((x) => ({ value: x, label: t(`m12.start.family.${x}`) }))} />
            </fieldset>
          )}
        </Question>
      )}

      {screen === '2' && (
        <Question head={head} n={2} title={t('m12.start.q.goal')} canGo={screenDone(a, '2')} onBack={() => go('1')} onNext={() => go('3')} testid="m12-start-q2">
          <Choices name="goal" value={a.goal ?? ''} onChange={(v) => set({ ...a, goal: v as Answers['goal'] })}
            options={GOALS.map((g) => ({ value: g, label: t(`m12.start.goal.${g}.label`), hint: t(`m12.start.goal.${g}.hint`) }))} />
        </Question>
      )}

      {screen === '3' && (
        <Question head={head} n={3} title={t('m12.start.q.details')} hint={t('m12.start.q.detailsHint')} canGo onBack={() => go('2')} onNext={() => go('r')} nextLabel={t('m12.start.show')} testid="m12-start-q3">
          <div className="grid gap-5 md:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-[15px] font-semibold">{t('m12.start.q.interest')}</legend>
              <Choices name="interest" value={a.interest ?? ''} onChange={(v) => set({ ...a, interest: (v || undefined) as Answers['interest'] })}
                options={[{ value: '', label: t('m12.start.interest.none') }, ...INTERESTS.map((x) => ({ value: x, label: t(`m12.start.interest.${x}`) }))]} />
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[15px] font-semibold">{t('m12.start.q.level')}</legend>
              <Choices name="level" value={a.level ?? ''} onChange={(v) => set({ ...a, level: (v || undefined) as Answers['level'] })}
                options={[{ value: '', label: t('m12.start.level.none') }, ...LEVELS.map((x) => ({ value: x, label: t(`m12.start.level.${x}`) }))]} />
            </fieldset>
          </div>
        </Question>
      )}

      {screen === 'r' && <RouteView a={a} head={head} onChange={() => go('1')} onRestart={() => go('1', {})} />}
    </Page>
  );
}

/** One question screen: a form with Back and Next below; Enter on a chosen option moves on too. */
function Question({ head, n, title, hint, children, canGo, onBack, onNext, nextLabel, testid }: {
  head: RefObject<HTMLHeadingElement>; n: number; title: string; hint?: string; children: ReactNode; canGo: boolean;
  onBack?: () => void; onNext: () => void; nextLabel?: string; testid: string;
}) {
  const t = useT();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canGo) onNext();
  };
  // Browsers do not submit a form on Enter from a radio button; here Enter on a chosen option moves on, like Next.
  const onKey = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement) || e.target.type !== 'radio') return;
    e.preventDefault();
    if (canGo) onNext();
  };
  return (
    <form onSubmit={submit} onKeyDown={onKey} className="card p-4 sm:p-6" aria-labelledby={`${testid}-h`} data-testid={testid}>
      <p className="caps">{t('m12.start.stepOf', { n, total: 3 })}</p>
      <h2 id={`${testid}-h`} ref={head} tabIndex={-1} className="mt-1 text-[20px] font-semibold focus:outline-none">
        {title}
      </h2>
      {hint && <p className="mt-1 text-[13.5px] text-ink-2">{hint}</p>}
      <div className="mt-4">{children}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {onBack ? (
          <button type="button" className="btn-outline" onClick={onBack} data-testid="m12-start-back">
            <Icon name="back" size={14} />
            {t('m12.start.back')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!canGo && (
            <span className="text-[12.5px] text-ink-3" id={`${testid}-req`}>
              {t('m12.start.required')}
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={!canGo} aria-describedby={canGo ? undefined : `${testid}-req`} data-testid="m12-start-next">
            {nextLabel ?? t('m12.start.next')}
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </div>
    </form>
  );
}

/** A native radio group drawn as option cards: arrow keys move between options, the whole card is the label. */
function Choices({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; hint?: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid={`m12-start-${name}`}>
      {options.map((o) => (
        <label
          key={o.value || 'none'}
          className="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-panel p-3 transition-colors hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 accent-[rgb(var(--accent))]" data-testid={`m12-start-${name}-${o.value || 'none'}`} />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-[12.5px] text-ink-2">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** The label of a route step's button: the guide's title for a help guide, otherwise the page title. */
function useLinkLabel() {
  const lang = useLang();
  return (l: HelpLink): string | undefined => (l.route === 'help-guide' && l.params?.guide ? GUIDE_BY_ID[l.params.guide]?.title[lang] : undefined);
}

function RouteView({ a, head, onChange, onRestart }: { a: Answers; head: RefObject<HTMLHeadingElement>; onChange: () => void; onRestart: () => void }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const label = useLinkLabel();
  const steps = buildRoute(a);
  const answers = [
    t(`m12.start.who.${a.who}.label`),
    a.family ? t(`m12.start.family.${a.family}`) : null,
    t(`m12.start.goal.${a.goal}.label`),
    a.interest ? t(`m12.start.interest.${a.interest}`) : null,
    a.level ? t(`m12.start.level.${a.level}`) : null,
  ].filter((x): x is string => !!x);
  const copy = () => {
    const url = window.location.href;
    const done = navigator.clipboard?.writeText(url);
    if (!done) return toast.push({ tone: 'bad', title: t('m12.start.copyFailed') });
    done.then(
      () => toast.push({ tone: 'ok', title: t('m12.start.copied') }),
      () => toast.push({ tone: 'bad', title: t('m12.start.copyFailed') }),
    );
  };
  /** The full address of a step, printed under it (links do not work on paper). */
  const printed = (l: HelpLink) => `${window.location.origin}${config.basename}${lang === 'ar' ? '/ar' : ''}${href(l.route, l.params ?? {})}${l.hash ? `#${l.hash}` : ''}`;

  return (
    <div className="space-y-6" data-testid="m12-start-route">
      <section className="card p-4 sm:p-6" aria-labelledby="start-route-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="start-route-h" ref={head} tabIndex={-1} className="text-[20px] font-semibold focus:outline-none">
              {t('m12.start.routeTitle')}
            </h2>
            <p className="mt-1 text-[13.5px] text-ink-2">{t('m12.start.routeIntro', { n: steps.length })}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={() => window.print()} data-testid="m12-start-print">
              {t('m12.start.print')}
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={copy} data-testid="m12-start-copy">
              <Icon name="link" size={13} />
              {t('m12.start.copy')}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px]" data-testid="m12-start-answers">
          <span className="caps me-1">{t('m12.start.answers')}</span>
          {answers.map((x) => (
            <span key={x} className="chip border-line bg-sunken text-ink-2">
              {x}
            </span>
          ))}
        </div>

        <ol className="mt-5 space-y-3" data-testid="m12-start-steps">
          {steps.map((s, i) => (
            <li key={s.id} className="flex gap-3 rounded-card border border-line p-4" data-step={s.id}>
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-eyebrow" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold">
                  <span className="sr-only">{t('m12.start.stepN', { n: i + 1 })}: </span>
                  {s.title[lang]}
                </h3>
                <p className="mt-1 text-[13.5px] text-ink-2">{s.body[lang]}</p>
                <div className="mt-2 no-print">
                  <GoToLink link={s.link} label={label(s.link)} />
                </div>
                <p className="mt-1 hidden break-all text-[11.5px] text-ink-3 print:block" dir="ltr">
                  {printed(s.link)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button type="button" className="btn-outline btn-sm" onClick={onChange} data-testid="m12-start-change">
            <Icon name="back" size={13} />
            {t('m12.start.change')}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onRestart} data-testid="m12-start-restart">
            <Icon name="reset" size={13} />
            {t('m12.start.startOver')}
          </button>
        </div>
      </section>

      {a.who && PROGRAMME_STAGES[a.who] && <Programmes stages={PROGRAMME_STAGES[a.who]!} />}
      {a.who === 'employee' && a.family && <Roles families={FAMILY_IDS[a.family]} />}

      <Callout tone="sim" title={t('m12.fsx.honest.simTitle')}>
        {t('m12.start.concept')}
      </Callout>

      <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <span className="font-semibold">{t('m12.start.moreHelp')}</span>
        <L to="/help" className="inline-flex items-center gap-1">
          {t('m12.routes.help.title')}
        </L>
        <L to="/future-skills" className="inline-flex items-center gap-1">
          {t('m12.start.fsx')}
        </L>
        <L to="/ask" className="inline-flex items-center gap-1">
          <Icon name="sparkle" size={13} />
          {t('m12.home.ctaAsk')}
        </L>
      </div>
    </div>
  );
}

/** Programmes for the visitor's stage, from the public programme table (one read). */
function Programmes({ stages }: { stages: ProgrammeStage[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery('talent_programmes', () => repo.list('talent_programmes', { filter: { stage: stages }, order: [['sort', 'asc']] }), [stages.join()]);
  return (
    <Section title={t('m12.start.programmesTitle')} description={t('m12.start.programmesIntro')}>
      <Async state={q} empty={<p className="text-[13px] text-ink-3">{t('m12.start.noneFound')}</p>}>
        {(rows) => (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="m12-start-programmes">
            {rows.map((p) => (
              <li key={p.id}>
                <L to={href('pathways-programme', { programme: p.id })} className="link-plain card flex h-full flex-col p-3 hover:border-accent">
                  <span className="font-semibold text-accent">{pick(p, 'name')}</span>
                  <span className="mt-1 text-[12.5px] text-ink-2">{pick(p, 'duration')}</span>
                </L>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Section>
  );
}

/** Current, published roles in the employee's role family, from the public role table (one read). */
function Roles({ families }: { families: string[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery('job_roles', () => repo.list('job_roles', { filter: { family_id: families, lifecycle: 'current', status: 'published' }, order: [['sort', 'asc']] }), [families.join()]);
  return (
    <Section title={t('m12.start.rolesTitle')} description={t('m12.start.rolesIntro')}>
      <Async state={q} empty={<p className="text-[13px] text-ink-3">{t('m12.start.noneFound')}</p>}>
        {(rows) => (
          <ul className="flex flex-wrap gap-2" data-testid="m12-start-roles">
            {rows.map((r) => (
              <li key={r.id}>
                <L to={href('careers-role', { slug: r.id })} className="btn-outline btn-sm no-underline">
                  {pick(r, 'title')}
                </L>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Section>
  );
}

