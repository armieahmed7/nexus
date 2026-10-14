// /learn (M04, public): programme catalogue by area with published durations and sources; course summaries; links to paths.
import { Fragment, useMemo } from 'react';
import { Page, Section, Card, Grid, StatTile, FilterBar, useFilters, Async, EmptyState, Callout, Icon, SourceLink } from '../../ui';
import { useQuery, useRepo } from '../../data';
import type { ProgrammesRow } from '../../data/types';
import { L, useFormat, usePick, useT, useLang } from '../../i18n';
import { useSession } from '../../auth/session';
import { G2Pill, Sources, SourcesRegistryProvider, useCatalogue, useLabels, Chip } from './ui';
import { TRAINING_PATHS } from './paths';

const AREAS = ['all_staff', 'operations', 'disciplines', 'foundation', 'leadership', 'emergency', 'simulation', 'soft_skills', 'supplier'] as const;
const MODALITIES = ['classroom', 'ojt', 'simulator', 'elearning', 'drill', 'external', 'blended', 'clinic'];

// Readiness fixes 2026-10-13 (finding 4): the citation registry is loaded once for the page (SourcesRegistryProvider) instead of once per
// programme card, and the cards are rendered by a plain function (an inner component type was re-created, and so remounted, on every render).
export default function LearnPage() {
  return <SourcesRegistryProvider><LearnView /></SourcesRegistryProvider>;
}

function LearnView() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const lab = useLabels();
  const repo = useRepo();
  const s = useSession();
  const cat = useCatalogue();
  const families = useQuery('job_families', () => repo.list('job_families', { order: [['sort', 'asc']] }), []);
  const sr = useQuery('sources', () => repo.get('sources', 'sr2024'), []);
  const [flt, setFlt] = useFilters({ q: '', area: '', kind: '', mandatory: '', family: '', modality: '' }, true);

  const filtered = useMemo(() => {
    const term = flt.q.trim().toLowerCase();
    return cat.programmes.filter((p) => {
      const courses = cat.courses.filter((c) => c.programme_id === p.id);
      if (flt.area && p.area !== flt.area) return false;
      if (flt.kind === 'initial' && p.kind !== 'initial') return false;
      if (flt.kind === 'continuing' && p.kind !== 'continuing') return false;
      if (flt.kind && !['initial', 'continuing'].includes(flt.kind) && p.kind !== flt.kind) return false;
      if (flt.mandatory === 'yes' && !p.mandatory) return false;
      if (flt.mandatory === 'no' && p.mandatory) return false;
      if (flt.family && p.family_id !== flt.family) return false;
      if (flt.modality && !courses.some((c) => c.modality === flt.modality)) return false;
      if (term) {
        const hay = [p.code, p.name_en, p.name_ar, p.purpose_en, p.purpose_ar, ...courses.map((c) => `${c.code} ${c.title_en} ${c.title_ar}`)].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [cat.programmes, cat.courses, flt]);

  const byArea = AREAS.map((a) => ({ area: a, items: filtered.filter((p) => p.area === a) })).filter((g) => g.items.length);

  return (
    <Page title={t('m04.routes.learn.title')} eyebrow={t('m04.learn.eyebrow')} intro={t('m04.learn.intro')}
      actions={s.status === 'signed_in' ? <L to="/my/learning" className="btn-primary" data-testid="m04-go-my-learning"><Icon name="book" />{t('m04.learn.myLearning')}</L> : <L to="/learn/practice" className="btn-outline">{t('m04.learn.practice')}</L>}>
      <Grid cols={4}>
        <StatTile label={t('m04.learn.statHours')} value={f.num(581090)} sub={t('m04.learn.statHoursSub', { n: f.num(218) })} source={sr.data ? <SourceLink href={sr.data.url} date={t('common.asOf', { date: f.date(sr.data.accessed) })}>SR2024 p.49</SourceLink> : null} />
        <StatTile label={t('m04.learn.statGet')} value={f.num(1090)} sub={t('m04.learn.statGetSub')} source={sr.data ? <SourceLink href={sr.data.url} date={t('common.asOf', { date: f.date(sr.data.accessed) })}>SR2024 p.49-53</SourceLink> : null} />
        <StatTile label={t('m04.learn.statExternal')} value={f.num(51675)} sub={t('m04.learn.statExternalSub', { n: f.num(740) })} source={sr.data ? <SourceLink href={sr.data.url} date={t('common.asOf', { date: f.date(sr.data.accessed) })}>SR2024</SourceLink> : null} />
        <StatTile label={t('m04.learn.statProgrammes')} value={f.num(cat.programmes.length)} sub={t('m04.learn.statProgrammesSub')} />
      </Grid>

      <Section title={t('m04.learn.pathsTitle')} description={t('m04.learn.pathsIntro')} actions={<L to="/learn/paths" className="btn-outline btn-sm">{t('common.viewAll')}</L>}>
        <div className="flex gap-3 overflow-x-auto pb-1" data-testid="m04-path-teasers">
          {TRAINING_PATHS.map((p) => (
            <L key={p.id} to={`/learn/paths/${p.id}`} className="card link-plain min-w-[210px] max-w-[240px] flex-1 p-3 hover:border-accent">
              <div className="flex items-center gap-2 text-eyebrow"><Icon name={p.icon} size={18} /><span className="caps">{t('m04.paths.stages', { n: f.num(p.stages.length) })}</span></div>
              <div className="mt-1 font-semibold leading-snug">{p.title[lang]}</div>
            </L>
          ))}
        </div>
      </Section>

      <Section title={t('m04.learn.catalogueTitle')} description={t('m04.learn.catalogueIntro')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'area', label: t('m04.learn.fArea'), options: AREAS.map((a) => ({ value: a, label: lab.area(a) })) },
          { key: 'kind', label: t('m04.learn.fKind'), options: ['initial', 'continuing', 'leadership', 'foundation', 'general', 'supplier'].map((k) => ({ value: k, label: lab.kind(k) })) },
          { key: 'mandatory', label: t('m04.learn.fMandatory'), options: [{ value: 'yes', label: t('m04.common.mandatory') }, { value: 'no', label: t('m04.common.elective') }] },
          { key: 'family', label: t('m04.learn.fFamily'), options: (families.data ?? []).map((fm) => ({ value: fm.id, label: pick(fm, 'name') })) },
          { key: 'modality', label: t('m04.learn.fModality'), options: MODALITIES.map((m) => ({ value: m, label: lab.modality(m) })) },
        ]} />
        <Async state={cat.pstate} empty={<EmptyState title={t('m04.learn.empty')} />} isEmpty={() => false}>
          {() => byArea.length === 0 ? <EmptyState title={t('m04.learn.noMatch')} action={<button className="btn-outline btn-sm" onClick={() => setFlt({ q: '', area: '', kind: '', mandatory: '', family: '', modality: '' })}>{t('common.clearFilters')}</button>} /> : (
            <div className="space-y-6" data-testid="m04-catalogue">
              {byArea.map((g) => (
                <section key={g.area} id={`area-${g.area}`} aria-labelledby={`h-${g.area}`}>
                  <h3 id={`h-${g.area}`} className="mb-2 text-[16px] font-semibold">{lab.area(g.area)} <span className="text-ink-3">· {f.num(g.items.length)}</span></h3>
                  <Grid cols={2}>{g.items.map((p) => <Fragment key={p.id}>{programmeCard(p)}</Fragment>)}</Grid>
                </section>
              ))}
            </div>
          )}
        </Async>
      </Section>

      <Callout title={t('m04.learn.publicNoteTitle')}>{t('m04.learn.publicNote')}</Callout>
    </Page>
  );

  function programmeCard(p: ProgrammesRow) {
    const courses = cat.courses.filter((c) => c.programme_id === p.id);
    return (
      <Card as="article" eyebrow={<span className="ltr">{p.code}</span>} title={pick(p, 'name')}
        actions={<div className="flex flex-wrap justify-end gap-1">{p.mandatory ? <Chip tone="accent">{t('m04.common.mandatory')}</Chip> : null}<Chip>{lab.kind(p.kind)}</Chip></div>}>
        <p className="text-[13.5px] text-ink-2">{pick(p, 'purpose')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          {pick(p, 'duration') && <span className="inline-flex items-center gap-1"><Icon name="calendar" size={14} className="text-ink-3" /><span className="font-semibold">{pick(p, 'duration')}</span></span>}
          {p.population_2024 != null && <span className="text-ink-2">· {t('m04.learn.population', { n: f.num(p.population_2024), note: pick(p, 'population_note') })}</span>}
        </div>
        {p.conflict_note && <div className="mt-2"><Callout tone="sim" title={t('m04.learn.sourcesDiffer')}>{pick(p, 'conflict_note')}</Callout></div>}
        {courses.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-2" aria-label={t('m04.learn.courses')}>
            {courses.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                <L to={`/learn/course/${c.id}`} className="min-w-0 truncate">{pick(c, 'title')}</L>
                <span className="flex shrink-0 gap-1">{c.qualifying && <G2Pill status="qualifying" tone="info" />}<Chip>{lab.modality(c.modality)}</Chip></span>
              </li>
            ))}
            {courses.length > 5 && <li className="text-[12px] text-ink-3">{t('m04.learn.moreCourses', { n: f.num(courses.length - 5) })}</li>}
          </ul>
        )}
        <Sources items={p.sources} />
      </Card>
    );
  }
}
