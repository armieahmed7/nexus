// F34 /pathways/journey/parents: the parent and family view, Arabic first (W5 · E3). The Arabic text always comes first; the
// English page adds the English text below it. A student can share their choices through the link (stage, route and interest
// families travel in the URL only); unknown values are ignored and nothing is stored or sent.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import { Async, Callout, Card, EmptyState, Grid, Icon, Page, Section, SimChip, SourceLink } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { JOURNEY_ROUTES, isRoute, isStage } from './journey';
import { FactList, useJourneyRefs, type FactRow } from './journeyUi';

const TIPS = ['t1', 't2', 't3', 't4', 't5'];
const ASK = ['a1', 'a2', 'a3', 'a4'];

export default function JourneyParentsPage() {
  const t = useT();
  const lang = useLang();
  const refs = useJourneyRefs();
  const [params] = useSearchParams();
  const fams = useMemo(() => {
    const known = new Set((refs.families.data ?? []).map((f) => f.id));
    return (params.get('families') ?? '').split(',').filter((f) => known.has(f)).slice(0, 3);
  }, [params, refs.families.data]);
  const route = isRoute(params.get('route')) ? (params.get('route') as string) : null;
  const stage = isStage(params.get('stage')) ? (params.get('stage') as string) : null;
  const personal = !!(route || stage || fams.length);
  const progs = refs.programmes.data ?? [];
  const progName = (id: string, l: 'en' | 'ar') => {
    const p = progs.find((x) => x.id === id);
    return p ? (l === 'ar' ? p.name_ar : p.name_en) : id;
  };
  const famNames = (l: 'en' | 'ar') => fams.map((id) => {
    const f = (refs.families.data ?? []).find((x) => x.id === id);
    return f ? (l === 'ar' ? f.name_ar : f.name_en) : id;
  }).join(l === 'ar' ? '، ' : ', ');

  // One block per language; Arabic always first, English only on the English page.
  const block = (l: 'en' | 'ar') => (
    <div lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className={`space-y-4 ${l === 'en' ? 'mt-6 border-t border-line pt-5' : ''}`} data-testid={`m06-parents-${l}`}>
      {personal && (
        <Card title={t(`m06.jparents.${l}.yourChild`)}>
          <ul className="list-disc space-y-1 ps-5 text-[14px]" data-testid={`m06-parents-summary-${l}`}>
            {stage && <li>{t(`m06.jparents.${l}.stage.${stage}`)}</li>}
            {fams.length > 0 && <li>{t(`m06.jparents.${l}.families`, { families: famNames(l) })}</li>}
            {route && <li>{t(`m06.jparents.${l}.route`, { route: progName(route, l) })}</li>}
          </ul>
          <p className="mt-2 text-[12.5px] text-ink-3">{t(`m06.jparents.${l}.noScore`)}</p>
        </Card>
      )}
      <Card title={t(`m06.jparents.${l}.journeyTitle`)}>
        <ol className="space-y-3">
          {(['explore', 'mustaqbali', 'route', 'first_role'] as const).map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-accent-ink" aria-hidden>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t(`m06.jparents.${l}.step.${step}`)}</div>
                <FactList facts={pickFacts(refs.facts, step, route)} sources={refs.sourceById} forceLang={l} testId={`m06-parents-facts-${l}-${step}`} />
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Grid cols={2}>
        <Card title={t(`m06.jparents.${l}.helpTitle`)}>
          <ul className="list-disc space-y-1 ps-5 text-[14px]">
            {TIPS.map((k) => <li key={k}>{t(`m06.jparents.${l}.tips.${k}`)}</li>)}
          </ul>
        </Card>
        <Card title={t(`m06.jparents.${l}.askTitle`)}>
          <ul className="list-disc space-y-1 ps-5 text-[14px]">
            {ASK.map((k) => <li key={k}>{t(`m06.jparents.${l}.ask.${k}`)}</li>)}
          </ul>
        </Card>
      </Grid>
    </div>
  );

  return (
    <Page title={t('m06.routes.pathways-journey-parents.title')} eyebrow={t('m06.jparents.eyebrow')} intro={t('m06.jparents.intro')}>
      <Async state={refs.factsState} empty={<EmptyState title={t('m06.journey.noFacts')} />}>
        {() => (
          <div>
            {block('ar')}
            {lang === 'en' && block('en')}
          </div>
        )}
      </Async>
      <Events />
      <Section title={t('m06.jparents.linksTitle')}>
        <Card>
          <div className="flex flex-wrap gap-3 text-[13px]">
            {JOURNEY_ROUTES.map((r) => (
              <L key={r} to={`/pathways/${r}`} className="btn-outline btn-sm">{progName(r, lang)}</L>
            ))}
            <L to="/pathways/journey" className="btn-primary btn-sm" data-testid="m06-parents-back">
              <Icon name="back" size={14} className="rtl:-scale-x-100" />
              {t('m06.jparents.back')}
            </L>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <SourceLink href="https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/">{t('m06.guide.sourceTalent')}</SourceLink>
            <SourceLink href="https://www.enec.ae/community/students-materials/">{t('m06.guide.sourceStudents')}</SourceLink>
            <L to="/contact" className="text-[12.5px]">{t('m06.guide.contact')}</L>
          </div>
        </Card>
      </Section>
      <Callout tone="info" title={t('m06.jparents.privacyTitle')}>
        {t('m06.jparents.privacyBody')}
      </Callout>
    </Page>
  );
}

/** Facts for a station; on the route station the shared route's facts come first, then the other routes'. */
function pickFacts(facts: FactRow[], step: string, route: string | null): FactRow[] {
  const list = facts.filter((f) => f.step === step);
  if (step !== 'route') return list;
  const rank = (f: FactRow) => (route && (f.programme_id === route || (route === 'energy-pioneers' && f.programme_id === 'internships')) ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.sort - b.sort).slice(0, route ? 6 : 8);
}

function Events() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const today = todayIso();
  const ev = useQuery('events', () => repo.list('events', { order: [['starts_on', 'asc']] }));
  return (
    <Section title={t('m06.jparents.eventsTitle')} description={t('m06.jparents.eventsHint')}>
      <Async state={ev} empty={<EmptyState title={t('m06.events.none')} />}>
        {(rows) => {
          const up = rows.filter((e) => (e.ends_on ?? e.starts_on) >= today).slice(0, 4);
          return up.length ? (
            <ul className="grid gap-3 md:grid-cols-2" data-testid="m06-parents-events">
              {up.map((e) => (
                <li key={e.id} className="card flex items-start justify-between gap-2 p-3">
                  <div>
                    <div className="font-semibold">{pick(e, 'title')}</div>
                    <div className="text-[12.5px] text-ink-2"><span className="num">{f.date(e.starts_on)}</span> · {pick(e, 'location')}</div>
                  </div>
                  {e.sample && <SimChip label={t('m06.events.sampleDate')} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-3">{t('m06.events.noneUpcoming')}</p>
          );
        }}
      </Async>
    </Section>
  );
}
