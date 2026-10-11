// M06 /pathways: programme finder by life stage, events calendar, vacancies preview, parent and counsellor guide.
import { useMemo } from 'react';
import { useRepo, useQuery } from '../../data';
import { Page, Section, Grid, Card, Async, EmptyState, SimChip, SourceLink, Callout, Icon, StatusPill, useFilters } from '../../ui';
import { L, useFormat, usePick, useT, useLang } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { FINDER_MATCH, FINDER_STAGES, ProgrammeCard, SourceList, type FinderStage } from './shared';
import { JourneyTeaser } from './journeyUi'; // W5E3 (F34)

export default function PathwaysPage() {
  const t = useT();
  const repo = useRepo();
  const [flt, setFlt] = useFilters({ stage: '' }, true);
  const programmes = useQuery('talent_programmes', () => repo.list('talent_programmes', { order: [['sort', 'asc']] }));
  const stage = (FINDER_STAGES as readonly string[]).includes(flt.stage) ? (flt.stage as FinderStage) : null;
  const shown = useMemo(() => (programmes.data ?? []).filter((p) => !stage || FINDER_MATCH[stage].includes(p.stage)), [programmes.data, stage]);

  return (
    <Page title={t('m06.routes.pathways.title')} eyebrow={t('m06.pathways.eyebrow')} intro={t('m06.pathways.intro')}>
      <Section title={t('m06.pathways.finderTitle')} description={t('m06.pathways.finderHint')}>
        <div role="radiogroup" aria-label={t('m06.pathways.finderTitle')} className="flex flex-wrap gap-2" data-testid="m06-stage-finder">
          <button role="radio" aria-checked={!stage} className={!stage ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setFlt({ stage: '' })}>
            {t('m06.pathways.allStages')}
          </button>
          {FINDER_STAGES.map((s) => (
            <button key={s} role="radio" aria-checked={stage === s} className={stage === s ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setFlt({ stage: s })} data-testid={`m06-finder-${s}`}>
              {t(`m06.finder.${s}`)}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-ink-3" aria-live="polite">
          {t('m06.pathways.showing', { n: shown.length })}
        </p>
      </Section>
      <JourneyTeaser />

      <Async state={programmes} empty={<EmptyState title={t('m06.pathways.none')} />}>
        {() =>
          shown.length === 0 ? (
            <EmptyState title={t('m06.pathways.noneForStage')} action={<button className="btn-outline btn-sm" onClick={() => setFlt({ stage: '' })}>{t('m06.pathways.allStages')}</button>} />
          ) : (
            <div data-testid="m06-programmes">
              <Grid cols={3}>
                {shown.map((p) => (
                  <ProgrammeCard key={p.id} p={p} />
                ))}
              </Grid>
            </div>
          )
        }
      </Async>
      <Callout tone="info" title={t('m06.pathways.rulesTitle')}>
        {t('m06.pathways.rulesBody')}
      </Callout>

      <EventsSection />
      <VacanciesPreview />
      <GuideSection />
      <StoriesSection />
    </Page>
  );
}

function EventsSection() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const events = useQuery('events', () => repo.list('events', { order: [['starts_on', 'asc']] }));
  const today = todayIso();
  return (
    <Section title={t('m06.events.title')} description={t('m06.events.hint')}>
      <Async state={events} empty={<EmptyState title={t('m06.events.none')} />}>
        {(rows) => {
          const upcoming = rows.filter((e) => (e.ends_on ?? e.starts_on) >= today);
          const past = rows.filter((e) => (e.ends_on ?? e.starts_on) < today).reverse();
          const item = (e: (typeof rows)[number]) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
              <div className="flex gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-btn border border-line bg-raised text-center leading-tight">
                  <Icon name="calendar" size={16} className="text-ink-3" />
                </div>
                <div>
                  <div className="font-semibold">{pick(e, 'title')}</div>
                  <div className="text-[12.5px] text-ink-2">
                    <span className="num">{f.date(e.starts_on)}</span>
                    {e.ends_on && <> – <span className="num">{f.date(e.ends_on)}</span></>} · {pick(e, 'location')} · {t(`m06.eventKind.${e.kind}`)}
                  </div>
                  <div className="mt-1"><SourceList sources={e.sources} /></div>
                </div>
              </div>
              {e.sample && <SimChip label={t('m06.events.sampleDate')} />}
            </li>
          );
          return (
            <Grid cols={2}>
              <Card title={t('m06.events.upcoming')}>
                {upcoming.length ? <ul data-testid="m06-events">{upcoming.map(item)}</ul> : <p className="text-ink-3">{t('m06.events.noneUpcoming')}</p>}
              </Card>
              <Card title={t('m06.events.past')}>{past.length ? <ul>{past.map(item)}</ul> : <p className="text-ink-3">{t('m06.events.nonePast')}</p>}</Card>
            </Grid>
          );
        }}
      </Async>
    </Section>
  );
}

function VacanciesPreview() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const vac = useQuery('vacancies', () => repo.list('vacancies', { filter: { status: 'open' }, order: [['posted_on', 'desc']], limit: 4 }));
  return (
    <Section
      title={t('m06.vacancies.title')}
      description={t('m06.vacancies.hint')}
      actions={<L to="/careers/jobs" className="btn-outline btn-sm">{t('m06.vacancies.all')}</L>}
    >
      <Async state={vac} empty={<EmptyState title={t('m06.vacancies.none')} />}>
        {(rows) => (
          <Grid cols={2}>
            {rows.map((v) => (
              <Card key={v.id} title={pick(v, 'title')} actions={v.sample ? <SimChip label={t('common.sample')} /> : undefined}>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
                  <span>{v.location}</span>
                  {v.closes_on && <span>· {t('m06.vacancies.closes', { date: f.date(v.closes_on) })}</span>}
                  {v.uae_nationals_only && <StatusPill tone="accent">{t('m06.nationality.uae_only')}</StatusPill>}
                </div>
                <div className="mt-3">
                  <SourceLink href={v.official_url}>{t('m06.vacancies.applyOfficial')}</SourceLink>
                </div>
              </Card>
            ))}
          </Grid>
        )}
      </Async>
    </Section>
  );
}

function GuideSection() {
  const t = useT();
  const lang = useLang();
  const points = ['p1', 'p2', 'p3', 'p4'];
  const ar = (
    <div dir="rtl" lang="ar" className="space-y-1.5 text-[14px]">
      <div className="font-semibold">{t('m06.guide.titleAr')}</div>
      <ul className="list-disc space-y-1 ps-5">
        {points.map((p) => (
          <li key={p}>{t(`m06.guide.ar.${p}`)}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <Section title={t('m06.guide.title')} description={t('m06.guide.hint')}>
      <Card>
        {ar}
        {lang === 'en' && (
          <div dir="ltr" lang="en" className="mt-4 space-y-1.5 border-t border-line pt-3 text-[14px]">
            <div className="font-semibold">{t('m06.guide.titleEn')}</div>
            <ul className="list-disc space-y-1 ps-5">
              {points.map((p) => (
                <li key={p}>{t(`m06.guide.en.${p}`)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-[12.5px]">
          <SourceLink href="https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/">{t('m06.guide.sourceTalent')}</SourceLink>
          <SourceLink href="https://www.enec.ae/community/students-materials/">{t('m06.guide.sourceStudents')}</SourceLink>
          <L to="/contact" className="text-[12.5px]">{t('m06.guide.contact')}</L>
        </div>
      </Card>
    </Section>
  );
}

function StoriesSection() {
  const t = useT();
  return (
    <Section title={t('m06.stories.title')} description={t('m06.stories.hint')}>
      <Grid cols={2}>
        {['s1', 's2'].map((s) => (
          <Card key={s} title={t(`m06.stories.${s}.name`)} eyebrow={t(`m06.stories.${s}.programme`)} actions={<SimChip label={t('m06.stories.illustrative')} />}>
            <p className="text-[13.5px] text-ink-2">“{t(`m06.stories.${s}.quote`)}”</p>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}
