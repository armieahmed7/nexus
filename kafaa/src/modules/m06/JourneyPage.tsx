// F34 /pathways/journey: the student-to-career journey (W5 · E3). A personal journey board (Explore → Mustaqbali → DNT, Energy
// Pioneers, GDP or GPO → first role) with sourced, dated facts; a 10-question non-scoring interest explorer with "roles like
// this"; a non-binding readiness checklist; public practice quizzes; a link to the Arabic-first parent view; and, for signed-in
// students, a starter portfolio. Anonymous visitors store nothing: no RPC, no write, no browser storage (unit-tested).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { Async, Callout, Card, ConfirmDialog, EmptyState, EngineBadge, Icon, Page, Section, SimChip, StatusPill, WhyThis, useFilters } from '../../ui';
import { L, useFormat, useI18n, useLang, usePick, useT } from '../../i18n';
import {
  BOARD_STEPS, JOURNEY_ROUTES, JOURNEY_STAGES, PREP_ITEMS, ROUTE_ROLES, STAGE_STEP, eligKey, eligibilityView, isRoute, isStage, nextStep, optionsOf, prepKey,
  type Answers, type JourneyRoute, type JourneyStage,
} from './journey';
import { FactList, familyRanked, routeReasons, useExploration, useJourneyRefs, type FactRow } from './journeyUi';
import { NationalityBadge, criteriaOf } from './shared';
import type { TalentProgrammesRow } from '../../data/types';

type Checklist = Record<string, string>;
const PRACTICE_FORMS = ['form-basics', 'form-radiation', 'form-barakah'];

export default function JourneyPage() {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const s = useSession();
  const act = useAction();
  const eng = useEngine('match');
  const refs = useJourneyRefs();
  const [flt, setFlt] = useFilters({ stage: '' }, true);
  const canSave = s.status === 'signed_in' && s.can('applications', ['Own']);
  // Tagged with the persona it was read for, so a stale result from before sign-in is never taken as the saved journey.
  const me = s.persona?.persona ?? null;
  const saved = useQuery('student_journeys', async () => (canSave ? { who: me, rows: await repo.list('student_journeys', {}) } : null), [canSave, me]);
  const [answers, setAnswers] = useState<Answers>({});
  const [chosen, setChosen] = useState<JourneyRoute | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef<string | null>(null);

  // Signed-in students get their saved journey back (once per persona). Anonymous visitors start empty every time.
  useEffect(() => {
    if (!canSave || !saved.data || saved.data.who !== me || loadedFor.current === me) return;
    loadedFor.current = me;
    const row = saved.data.rows.find((j) => !j.cleared_at);
    if (!row) return;
    const i = (row.interests ?? {}) as { answers?: Answers };
    const m = (row.milestones ?? {}) as { checklist?: Checklist };
    setAnswers(i.answers ?? {});
    setChosen(isRoute(row.route) ? row.route : null);
    setChecklist(m.checklist ?? {});
    if (!flt.stage && isStage(row.stage)) setFlt({ stage: row.stage });
  }, [canSave, saved.data, me, flt.stage, setFlt]);

  const stage: JourneyStage | null = isStage(flt.stage) ? flt.stage : null;
  const { ex, suggestion } = useExploration(refs.qs, answers, refs.familySort, stage, chosen);
  const route = suggestion.route;
  const famRow = (id: string) => (refs.families.data ?? []).find((f) => f.id === id);
  const famName = (id: string) => ({ en: famRow(id)?.name_en ?? id, ar: famRow(id)?.name_ar ?? id });
  const progById = useMemo(() => new Map((refs.programmes.data ?? []).map((p) => [p.id, p])), [refs.programmes.data]);
  const stageLabel = (x: string) => t(`m06.journey.stage.${x}`);
  const ranked = useMemo(() => familyRanked(refs.qs, answers, ex), [refs.qs, answers, ex]);
  const rReasons = routeReasons(suggestion, refs.qs, answers, stageLabel, famName, stage);

  const save = async () => {
    setBusy(true);
    try {
      await act(() => repo.rpc.saveStudentJourney({ stage, route: chosen, answers, checklist }), { success: t('m06.journey.saved') });
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    const r = await act(() => repo.rpc.saveStudentJourney({ clear: true }), { success: t('m06.journey.cleared') });
    if (r.ok) {
      setAnswers({});
      setChosen(null);
      setChecklist({});
      setFlt({ stage: '' });
    }
  };

  return (
    <Page title={t('m06.routes.pathways-journey.title')} eyebrow={t('m06.journey.eyebrow')} intro={t('m06.journey.intro')} wide>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">{t('m06.journey.whereNow')}</h2>
            <div role="radiogroup" aria-label={t('m06.journey.whereNow')} className="mt-2 flex flex-wrap gap-2" data-testid="m06-journey-stages">
              {JOURNEY_STAGES.map((x) => (
                <button key={x} type="button" role="radio" aria-checked={stage === x} className={stage === x ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setFlt({ stage: stage === x ? '' : x })} data-testid={`m06-journey-stage-${x}`}>
                  {stageLabel(x)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-ink-2" aria-live="polite" data-testid="m06-journey-here">
              {stage ? t(`m06.journey.here.${stage}`) : t('m06.journey.pickStage')}
            </p>
          </div>
          <div className="max-w-sm space-y-2 text-[12.5px]">
            <StatusPill tone={canSave ? 'info' : 'neutral'}>{canSave ? t('m06.journey.storeSignedIn') : t('m06.journey.storeNothing')}</StatusPill>
            <nav aria-label={t('m06.journey.jump')} className="flex flex-wrap gap-x-3 gap-y-1">
              {['board', 'explore', 'ready', 'practice', 'parents', ...(canSave ? ['portfolio'] : [])].map((a) => (
                <a key={a} href={`#${a}`} className="text-[12.5px]">{t(`m06.journey.nav.${a}`)}</a>
              ))}
            </nav>
          </div>
        </div>
      </Card>

      <Section id="board" title={t('m06.journey.boardTitle')} description={t('m06.journey.boardHint')}>
        <Async state={refs.factsState} empty={<EmptyState title={t('m06.journey.noFacts')} />}>
          {() => (
            <Board
              facts={refs.facts}
              sources={refs.sourceById}
              stage={stage}
              route={route}
              chosen={chosen}
              onChoose={(r) => setChosen((c) => (c === r ? null : r))}
              programmes={progById}
              roles={refs.roles.data ?? []}
              routeWhy={rReasons}
            />
          )}
        </Async>
      </Section>

      <Section id="explore" title={t('m06.journey.exploreTitle')} description={t('m06.journey.exploreHint')} actions={<EngineBadge engine={eng} />}>
        <Async state={refs.questions} empty={<EmptyState title={t('m06.journey.noQuestions')} />}>
          {() => (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <ol className="space-y-4" data-testid="m06-journey-explorer">
                  {refs.qs.map((q, i) => (
                    <li key={q.id}>
                      <fieldset>
                        <legend className="text-[13.5px] font-semibold">
                          <span className="num me-1.5 text-ink-3">{i + 1}.</span>
                          {pick(q, 'prompt')}
                        </legend>
                        {pick(q, 'hint') && <p className="mt-0.5 text-[12px] text-ink-3">{pick(q, 'hint')}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {optionsOf(q).map((o) => {
                            const on = answers[q.id] === o.id;
                            return (
                              <label key={o.id} className={`chip cursor-pointer ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-panel hover:border-accent'}`}>
                                <input
                                  type="radio"
                                  className="sr-only"
                                  name={`jq-${q.id}`}
                                  checked={on}
                                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                                  data-testid={`m06-journey-q-${q.id}-${o.id}`}
                                />
                                {lang === 'ar' ? o.ar : o.en}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setAnswers({})} data-testid="m06-journey-reset">
                    <Icon name="reset" size={14} />
                    {t('m06.journey.reset')}
                  </button>
                </div>
              </Card>
              <Matches
                ranked={ranked}
                famRow={famRow}
                roles={refs.roles.data ?? []}
                hasAnswers={ex.answered > 0}
              />
            </div>
          )}
        </Async>
      </Section>

      <Section id="ready" title={t('m06.journey.readyTitle')} description={t('m06.journey.readyHint')}>
        <Readiness route={route} stage={stage} programmes={progById} checklist={checklist} setChecklist={setChecklist} onPickRoute={(r) => setChosen(r)} />
      </Section>

      <SaveBar canSave={canSave} signedIn={s.status === 'signed_in'} busy={busy} onSave={save} onClear={() => setConfirmClear(true)} hasSaved={!!saved.data?.rows.some((j) => !j.cleared_at)} />

      <Section id="practice" title={t('m06.journey.practiceTitle')} description={t('m06.journey.practiceHint')}>
        <Practice />
      </Section>

      <Section id="parents" title={t('m06.journey.parentsTitle')} description={t('m06.journey.parentsHint')}>
        <Card>
          <div dir="rtl" lang="ar" className="text-[14px]">
            <div className="font-semibold">{t('m06.journey.parentsAr.title')}</div>
            <p className="mt-1 text-ink-2">{t('m06.journey.parentsAr.body')}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <L to={parentsHref(stage, route, ex.families.map((f) => f.id))} className="btn-primary btn-sm" data-testid="m06-journey-parents-link">
              <Icon name="users" size={14} />
              {t('m06.journey.parentsOpen')}
            </L>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m06.journey.parentsPrivacy')}</p>
        </Card>
      </Section>

      {canSave && (
        <Section id="portfolio" title={t('m06.journey.portfolioTitle')} description={t('m06.journey.portfolioHint')}>
          <Portfolio />
        </Section>
      )}

      <Callout tone="info" title={t('m06.journey.rulesTitle')}>
        {t('m06.journey.rulesBody')}
      </Callout>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('m06.journey.clearTitle')}
        consequence={t('m06.journey.clearConsequence')}
        confirmLabel={t('m06.journey.clear')}
        danger
        onConfirm={async () => {
          await clear();
          setConfirmClear(false);
        }}
      />
    </Page>
  );
}

/** Link to the parent view; the child's choices travel in the URL only (nothing is stored). */
export function parentsHref(stage: string | null, route: string | null, families: string[]) {
  const p = new URLSearchParams();
  if (stage) p.set('stage', stage);
  if (route) p.set('route', route);
  if (families.length) p.set('families', families.join(','));
  const q = p.toString();
  return `/pathways/journey/parents${q ? `?${q}` : ''}`;
}

// ───────────── journey board
function Board(props: {
  facts: FactRow[];
  sources: Map<string, { id: string; label: string; url: string }>;
  stage: JourneyStage | null;
  route: JourneyRoute | null;
  chosen: JourneyRoute | null;
  onChoose: (r: JourneyRoute) => void;
  programmes: Map<string, TalentProgrammesRow>;
  roles: { id: string; title_en: string; title_ar: string; family_id: string; security_sensitive?: boolean | null }[];
  routeWhy: import('../../domain/engines').Reason[];
}) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const here = props.stage ? STAGE_STEP[props.stage] : null;
  const factsFor = (step: string, pred: (f: FactRow) => boolean = () => true) => props.facts.filter((f) => f.step === step && pred(f));
  const mq = props.programmes.get('mustaqbali');
  const roleIds = props.route ? ROUTE_ROLES[props.route] : [...new Set(Object.values(ROUTE_ROLES).flat())];
  const station = (step: (typeof BOARD_STEPS)[number], n: number, body: ReactNode, sub?: ReactNode) => (
    <li
      key={step}
      className={`card relative flex min-w-0 flex-col p-4 ${here === step ? 'ring-2 ring-accent' : ''}`}
      aria-current={here === step ? 'step' : undefined}
      data-testid={`m06-journey-station-${step}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-accent-ink num" aria-hidden>{f.num(n)}</span>
        <div className="min-w-0">
          <div className="font-semibold">{t(`m06.journey.step.${step}`)}</div>
          {sub && <div className="text-[12px] text-ink-2">{sub}</div>}
        </div>
      </div>
      {here === step && (
        <span className="chip mt-2 w-fit border-accent bg-accent-soft text-ink" data-testid="m06-journey-you-are-here">
          <Icon name="user" size={12} />
          {t('m06.journey.youAreHere')}
        </span>
      )}
      <div className="mt-3 flex flex-1 flex-col gap-3">{body}</div>
    </li>
  );
  return (
    <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="m06-journey-board">
      {station('explore', 1, (
        <>
          <p className="text-[13px] text-ink-2">{t('m06.journey.exploreBody')}</p>
          <FactList facts={factsFor('explore')} sources={props.sources} />
          <div className="mt-auto flex flex-wrap gap-2">
            <a href="#explore" className="btn-outline btn-sm">{t('m06.journey.takeExplorer')}</a>
            <a href="#practice" className="btn-ghost btn-sm">{t('m06.journey.nav.practice')}</a>
          </div>
        </>
      ), t('m06.journey.exploreSub'))}
      {station('mustaqbali', 2, (
        <>
          <FactList facts={factsFor('mustaqbali')} sources={props.sources} />
          <div className="mt-auto flex flex-wrap gap-2">
            <L to="/pathways/mustaqbali" className="btn-outline btn-sm" data-testid="m06-journey-step-mustaqbali">
              {t('m06.journey.open', { name: mq ? pick(mq, 'name') : 'Mustaqbali' })}
            </L>
          </div>
        </>
      ), mq ? pick(mq, 'duration') : undefined)}
      {station('route', 3, (
        <ul className="space-y-2.5" data-testid="m06-journey-routes">
          {JOURNEY_ROUTES.map((r) => {
            const p = props.programmes.get(r);
            const suggested = props.route === r;
            const isChosen = props.chosen === r;
            const fitStage = props.stage ? (r === 'gdp' || r === 'gpo' ? props.stage === 'graduate' : props.stage !== 'graduate') : true;
            return (
              <li key={r} className={`rounded-card border p-3 ${suggested ? 'border-accent bg-accent-soft/40' : 'border-line'} ${fitStage ? '' : 'opacity-80'}`} data-testid={`m06-journey-route-${r}`} data-suggested={suggested || undefined}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{p ? pick(p, 'name') : r}</div>
                    {p && <div className="text-[12px] text-ink-2">{pick(p, 'duration')} · {pick(p, 'education')}</div>}
                  </div>
                  {p && <NationalityBadge value={p.nationality} />}
                </div>
                {suggested && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="accent">{isChosen ? t('m06.journey.yourRoute') : t('m06.journey.suggested')}</StatusPill>
                    <WhyThis reasons={props.routeWhy} testId="m06-journey-route-why" />
                  </div>
                )}
                <div className="mt-2">
                  <FactList facts={factsFor('route', (f) => f.programme_id === r || (r === 'energy-pioneers' && f.programme_id === 'internships'))} sources={props.sources} testId={`m06-journey-facts-${r}`} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <L to={`/pathways/${r}`} className="btn-primary btn-sm" data-testid={`m06-journey-step-${r}`}>
                    {t('m06.journey.open', { name: p ? pick(p, 'name') : r })}
                    <Icon name="chevron" size={13} className="rtl:-scale-x-100" />
                  </L>
                  <button type="button" className={isChosen ? 'btn-outline btn-sm' : 'btn-ghost btn-sm'} aria-pressed={isChosen} onClick={() => props.onChoose(r)} data-testid={`m06-journey-choose-${r}`}>
                    {isChosen ? t('m06.journey.chosen') : t('m06.journey.choose')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ), t('m06.journey.routeSub'))}
      {station('first_role', 4, (
        <>
          <ul className="space-y-1.5" data-testid="m06-journey-first-roles">
            {roleIds.map((id) => {
              const r = props.roles.find((x) => x.id === id);
              return r ? (
                <li key={id}>
                  <L to={`/careers/roles/${id}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold">
                    <Icon name="briefcase" size={14} />
                    {pick(r, 'title')}
                  </L>
                </li>
              ) : null;
            })}
          </ul>
          <FactList facts={factsFor('first_role', (f) => !f.role_id || roleIds.includes(f.role_id))} sources={props.sources} />
          <p className="mt-auto text-[12px] text-ink-3">{t('m06.journey.firstRoleNote')}</p>
        </>
      ), props.route ? t('m06.journey.firstRoleFor', { route: props.programmes.get(props.route) ? pick(props.programmes.get(props.route)!, 'name') : props.route }) : t('m06.journey.firstRoleAll'))}
    </ol>
  );
}

// ───────────── explorer results
function Matches({ ranked, famRow, roles, hasAnswers }: {
  ranked: import('../../domain/engines').Ranked[];
  famRow: (id: string) => { id: string; name_en: string; name_ar: string; description_en?: string | null; description_ar?: string | null } | undefined;
  roles: { id: string; title_en: string; title_ar: string; family_id: string; entry_level?: boolean | null; security_sensitive?: boolean | null; sort?: number | null }[];
  hasAnswers: boolean;
}) {
  const t = useT();
  const pick = usePick();
  return (
    <Card title={t('m06.journey.matchesTitle')} eyebrow={t('m06.journey.matchesEyebrow')}>
      <div aria-live="polite" data-testid="m06-journey-matches">
        {!hasAnswers ? (
          <p className="text-[13px] text-ink-3">{t('m06.journey.matchesEmpty')}</p>
        ) : !ranked.length ? (
          <p className="text-[13px] text-ink-3">{t('m06.journey.matchesNone')}</p>
        ) : (
          <ul className="space-y-3">
            {ranked.map((r) => {
              const f = famRow(r.id);
              const like = roles.filter((x) => x.family_id === r.id).sort((a, b) => Number(!!b.entry_level) - Number(!!a.entry_level) || Number(a.sort ?? 0) - Number(b.sort ?? 0)).slice(0, 3);
              return (
                <li key={r.id} className="rounded-card border border-line p-3" data-testid="m06-journey-match" data-family={r.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{f ? pick(f, 'name') : r.id}</div>
                    <WhyThis reasons={r.reasons} testId="m06-journey-why" />
                  </div>
                  {f && pick(f, 'description') && <p className="mt-1 text-[12.5px] text-ink-2">{pick(f, 'description')}</p>}
                  {like.length > 0 && (
                    <div className="mt-2">
                      <div className="caps mb-1">{t('m06.journey.rolesLike')}</div>
                      <ul className="flex flex-wrap gap-1.5">
                        {like.map((x) => (
                          <li key={x.id}>
                            <L to={`/careers/roles/${x.id}`} className="btn-outline btn-sm" data-testid="m06-journey-role-link">
                              {pick(x, 'title')}
                            </L>
                            {x.security_sensitive && <span className="ms-1 text-[11.5px] text-ink-3">{t('m06.journey.pathOnly')}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">{t('m06.journey.noScore')}</p>
    </Card>
  );
}

// ───────────── readiness checklist (non-binding)
function Readiness({ route, stage, programmes, checklist, setChecklist, onPickRoute }: {
  route: JourneyRoute | null;
  stage: JourneyStage | null;
  programmes: Map<string, TalentProgrammesRow>;
  checklist: Checklist;
  setChecklist: (fn: (c: Checklist) => Checklist) => void;
  onPickRoute: (r: JourneyRoute) => void;
}) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const progs = [...(stage === 'school' ? ['mustaqbali'] : []), ...(route ? [route] : [])];
  if (!progs.length)
    return (
      <EmptyState title={t('m06.journey.readyPick')}>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {JOURNEY_ROUTES.map((r) => (
            <button key={r} type="button" className="btn-outline btn-sm" onClick={() => onPickRoute(r)}>
              {programmes.get(r) ? pick(programmes.get(r)!, 'name') : r}
            </button>
          ))}
        </div>
      </EmptyState>
    );
  const set = (k: string, v: string | null) => setChecklist((c) => {
    const n = { ...c };
    if (v === null) delete n[k];
    else n[k] = v;
    return n;
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="m06-journey-readiness">
      {progs.map((pid) => {
        const p = programmes.get(pid);
        if (!p) return null;
        const crit = criteriaOf(p).map((c, i) => ({ c, i })).filter((x) => x.c.kind !== 'info');
        const view = eligibilityView(crit.map((x) => checklist[eligKey(pid, x.i)]));
        const next = nextStep(pid, checklist);
        return (
          <Card key={pid} title={pick(p, 'name')} eyebrow={t('m06.journey.readyEyebrow')} actions={<NationalityBadge value={p.nationality} />}>
            <h3 className="caps mb-1">{t('m06.journey.eligibility')}</h3>
            <ol className="space-y-2.5" data-testid={`m06-journey-elig-${pid}`}>
              {crit.map(({ c, i }) => (
                <li key={i}>
                  <fieldset>
                    <legend className="text-[13px] font-semibold">{t(`m06.check.q.${c.kind}`, { criterion: lang === 'ar' ? c.ar : c.en })}</legend>
                    <div className="mt-1 flex flex-wrap gap-3 text-[13px]">
                      {(['yes', 'no', 'unsure'] as const).map((v) => (
                        <label key={v} className="flex items-center gap-1.5">
                          <input type="radio" name={`je-${pid}-${i}`} checked={checklist[eligKey(pid, i)] === v} onChange={() => set(eligKey(pid, i), v)} className="accent-[rgb(var(--accent))]" data-testid={`m06-journey-elig-${pid}-${i}-${v}`} />
                          {t(`m06.check.${v}`)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ol>
            {view !== 'unanswered' && (
              <div className="mt-2" aria-live="polite" data-testid={`m06-journey-elig-result-${pid}`}>
                <Callout tone={view === 'check' ? 'sim' : view === 'meets' ? 'ok' : 'info'} title={t(`m06.journey.elig.${view}`)}>
                  {t('m06.check.notDecision')}
                </Callout>
              </div>
            )}
            <h3 className="caps mb-1 mt-4">{t('m06.journey.prepTitle')}</h3>
            <ul className="space-y-1.5" data-testid={`m06-journey-prep-${pid}`}>
              {(PREP_ITEMS[pid as JourneyRoute] ?? []).map((item) => {
                const k = prepKey(pid, item);
                return (
                  <li key={item}>
                    <label className="flex items-start gap-2 text-[13px]">
                      <input type="checkbox" className="mt-0.5 accent-[rgb(var(--accent))]" checked={checklist[k] === 'done'} onChange={(e) => set(k, e.target.checked ? 'done' : null)} data-testid={`m06-journey-prep-${pid}-${item}`} />
                      <span>{t(`m06.journey.prep.${item}`)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[13px]" data-testid={`m06-journey-next-${pid}`}>
              <span className="caps me-1">{t('m06.journey.nextStep')}</span>
              {next ? t(`m06.journey.prep.${next}`) : t('m06.journey.allSet')}
            </p>
          </Card>
        );
      })}
      <p className="text-[12px] text-ink-3 lg:col-span-2">{t('m06.journey.readyNote')}</p>
    </div>
  );
}

function SaveBar({ canSave, signedIn, busy, onSave, onClear, hasSaved }: { canSave: boolean; signedIn: boolean; busy: boolean; onSave: () => void; onClear: () => void; hasSaved: boolean }) {
  const t = useT();
  const { path } = useI18n();
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="m06-journey-savebar">
        <p className="max-w-2xl text-[13px] text-ink-2">{canSave ? t('m06.journey.saveHint') : signedIn ? t('m06.journey.saveNotForRole') : t('m06.journey.saveAnon')}</p>
        <div className="flex flex-wrap gap-2">
          {canSave ? (
            <>
              <button type="button" className="btn-primary" onClick={onSave} disabled={busy} data-testid="m06-journey-save">
                <Icon name="check" size={15} />
                {t('m06.journey.save')}
              </button>
              {hasSaved && (
                <button type="button" className="btn-ghost" onClick={onClear} data-testid="m06-journey-clear">
                  {t('m06.journey.clear')}
                </button>
              )}
            </>
          ) : !signedIn ? (
            <L to={`/sign-in?next=${encodeURIComponent(path)}`} className="btn-outline" data-testid="m06-journey-signin">
              <Icon name="user" size={15} />
              {t('m06.journey.signInToSave')}
            </L>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function Practice() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const forms = useQuery('assessment_forms', () => repo.list('assessment_forms', { filter: { id: PRACTICE_FORMS } }));
  return (
    <Async state={forms} empty={<EmptyState title={t('m06.journey.practiceNone')} />}>
      {(rows) => (
        <ul className="grid gap-3 md:grid-cols-3" data-testid="m06-journey-practice">
          {PRACTICE_FORMS.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((r) => (
            <li key={r!.id} className="card flex flex-col p-4">
              <div className="font-semibold">{pick(r!, 'title')}</div>
              <div className="mt-1 text-[12.5px] text-ink-2">{pick(r!, 'audience')}</div>
              <div className="mt-auto pt-3">
                <L to={`/learn/practice/${r!.id}`} className="btn-outline btn-sm" data-testid={`m06-journey-practice-${r!.id}`}>
                  <Icon name="book" size={14} />
                  {t('m06.journey.practiceStart')}
                </L>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Async>
  );
}

function Portfolio() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const f = useI18n();
  const rows = useQuery('student_portfolio', () => repo.list('student_portfolio', { order: [['issued_on', 'desc']] }));
  const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat(f.lang === 'ar' ? 'ar-AE' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)) : '');
  return (
    <Async state={rows}>
      {(list) => {
        const starter = list.find((r) => r.kind === 'microcred' && r.programme_id === 'mustaqbali');
        return (
          <div className="space-y-3" data-testid="m06-journey-portfolio">
            <ul className="grid gap-3 md:grid-cols-2">
              {!starter && (
                <li className="card border-dashed p-4" data-testid="m06-journey-portfolio-pending">
                  <div className="flex items-center gap-2">
                    <Icon name="sparkle" size={16} className="text-ink-3" />
                    <span className="font-semibold">{t('m06.journey.starterTitle')}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2">{t('m06.journey.starterPending')}</p>
                </li>
              )}
              {list.map((r) => (
                <li key={r.id} className="card p-4" data-testid="m06-journey-portfolio-item" data-kind={r.kind}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon name={r.kind === 'microcred' ? 'shield' : r.kind === 'practice' ? 'book' : r.kind === 'event' ? 'calendar' : 'grad'} size={16} className="text-accent" />
                      <span className="font-semibold">{pick(r, 'title')}</span>
                    </div>
                    {r.sample && <SimChip label={t('m06.journey.synthetic')} />}
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-2">
                    {t(`m06.journey.kind.${r.kind}`)} · {pick(r, 'issuer')}
                    {r.issued_on && <> · <span className="num">{fmt(r.issued_on)}</span></>}
                  </div>
                  {pick(r, 'evidence') && <p className="mt-1 text-[12.5px]">{pick(r, 'evidence')}</p>}
                </li>
              ))}
            </ul>
            <Callout tone="sim" title={t('m06.journey.notFanrTitle')}>
              {t('m06.journey.notFanrBody')}
            </Callout>
            <button type="button" className="btn-outline btn-sm" onClick={() => window.print()}>
              <Icon name="download" size={14} />
              {t('m06.journey.print')}
            </button>
          </div>
        );
      }}
    </Async>
  );
}

