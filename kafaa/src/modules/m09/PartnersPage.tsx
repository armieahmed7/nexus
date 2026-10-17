// M09 /partners: public directory of ENEC's publicly announced relationships (spec Section 9).
// Every entry carries its relationship type, dates, status, a binding flag and at least one public source. Oversight bodies are
// listed apart because regulators are not partners. Company names in text only; no logos; no individual names.
import { useMemo, useState } from 'react';
import { Page, Section, Callout, Async, EmptyState, FilterBar, useFilters, StatTile, Grid, DataTable, Icon, type Column } from '../../ui';
import { useT, usePick, useFormat, L, useNav, countryKey, countryName, countryOptions } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { CATEGORIES, CategoryChips, MStatus, NON_BINDING, REL_TYPES, SourceList, useSourceDates, type Org, type Source } from './shared';

export default function PartnersPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery('organisations', () => repo.list('organisations', { filter: { public_listed: true }, order: [['name_en', 'asc']] }));
  return (
    <Page title={t('m09.routes.partners.title')} eyebrow={t('m09.dir.eyebrow')} intro={t('m09.dir.intro')}
      actions={<L to="/suppliers" className="btn-outline" data-testid="m09-to-suppliers">{t('m09.dir.toSuppliers')}</L>}>
      <Async state={q} empty={<EmptyState title={t('m09.dir.empty')} />}>{(orgs) => <Directory orgs={orgs} />}</Async>
    </Page>
  );
}

function Directory({ orgs }: { orgs: Org[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const dates = useSourceDates();
  const [flt, setFlt] = useFilters({ q: '', cat: '', status: '', type: '', country: '' }, true);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const countries = useMemo(() => countryOptions(t, orgs.map((o) => o.country)), [orgs, t]); // values are language-neutral keys ("fr/it")
  const filtered = useMemo(() => {
    const term = flt.q.trim().toLowerCase();
    return orgs.filter((o) => {
      const cats = o.categories?.length ? o.categories : [o.category];
      if (flt.cat && !cats.includes(flt.cat)) return false;
      if (flt.status && o.status !== flt.status) return false;
      if (flt.type && !(o.rel_types ?? []).includes(flt.type)) return false;
      if (flt.country && countryKey(o.country) !== flt.country) return false;
      if (!term) return true;
      return [o.name_en, o.name_ar, o.relationship_en, o.relationship_ar, o.country, countryName(t, o.country)].some((s) => String(s ?? '').toLowerCase().includes(term));
    });
  }, [orgs, flt, t]);
  const isOversight = (o: Org) => (o.categories?.length ? o.categories : [o.category]).includes('oversight');
  const partners = filtered.filter((o) => !isOversight(o));
  const oversight = filtered.filter(isOversight);
  const mous = orgs.filter((o) => (o.rel_types ?? []).includes('mou')).length;
  const sourced = orgs.filter((o) => Array.isArray(o.sources) && (o.sources as unknown[]).length > 0).length;
  const catCount = (c: string) => orgs.filter((o) => (o.categories?.length ? o.categories : [o.category]).includes(c)).length;

  const cols: Column<Org>[] = [
    { key: 'name', header: t('m09.dir.col.name'), value: (o) => pick(o, 'name'), sortable: true, render: (o) => <L to={`/partners/${o.id}`} className="font-semibold">{pick(o, 'name')}</L> },
    { key: 'cat', header: t('m09.dir.col.category'), value: (o) => (o.categories ?? []).map((c) => t(`m09.cat.${c}`)).join('; '), sortable: true },
    { key: 'rel', header: t('m09.dir.col.relationship'), value: (o) => pick(o, 'relationship') },
    { key: 'type', header: t('m09.dir.col.type'), value: (o) => (o.rel_types ?? []).map((x) => t(`m09.rel.${x}`)).join(', '), sortable: true },
    { key: 'dates', header: t('m09.dir.col.dates'), value: (o) => datesLabel(t, o.dates) },
    { key: 'status', header: t('m09.dir.col.status'), value: (o) => o.status, render: (o) => <MStatus status={o.status} />, sortable: true },
    { key: 'binding', header: t('m09.dir.col.binding'), value: (o) => (o.binding ? t('m09.dir.binding') : t('m09.dir.nonBinding')) },
    { key: 'country', header: t('m09.dir.col.country'), value: (o) => countryName(t, o.country), sortable: true },
    { key: 'src', header: t('m09.dir.col.sources'), value: (o) => ((o.sources as Source[]) ?? []).map((s) => s.url).join(' '), render: (o) => <SourceList sources={(o.sources as Source[]) ?? []} dates={dates} compact /> },
  ];

  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m09.dir.statListed')} value={f.num(orgs.length)} sub={t('m09.dir.statListedSub')} />
        <StatTile label={t('m09.dir.statSourced')} value={`${f.num(sourced)} / ${f.num(orgs.length)}`} sub={t('m09.dir.statSourcedSub')} tone={sourced === orgs.length ? 'ok' : 'bad'} />
        <StatTile label={t('m09.dir.statMou')} value={f.num(mous)} sub={t('m09.dir.statMouSub')} />
        <StatTile label={t('m09.dir.statCats')} value={f.num(CATEGORIES.length)} sub={t('m09.dir.statCatsSub')} />
      </Grid>

      <Callout tone="info" title={t('m09.dir.ruleTitle')}>
        {t('m09.dir.ruleBody')}
      </Callout>

      <Section title={t('m09.dir.groupsTitle')}>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('m09.dir.groupsTitle')} data-testid="m09-category-tabs">
          {['', ...CATEGORIES].map((c) => (
            <button key={c || 'all'} role="tab" aria-selected={flt.cat === c} className={`chip ${flt.cat === c ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} onClick={() => setFlt({ cat: c })}>
              {c ? t(`m09.cat.${c}`) : t('m09.dir.allCats')} <span className="num ms-1 text-ink-3">{f.num(c ? catCount(c) : orgs.length)}</span>
            </button>
          ))}
        </div>
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[
            { key: 'status', label: t('m09.dir.f.status'), options: ['active', 'historic', 'exploratory'].map((s) => ({ value: s, label: t(`m09.status.${s}`) })) },
            { key: 'type', label: t('m09.dir.f.type'), options: REL_TYPES.map((r) => ({ value: r, label: t(`m09.rel.${r}`) })) },
            { key: 'country', label: t('m09.dir.f.country'), options: countries },
          ]}
          extra={
            <div className="flex items-end gap-1" role="group" aria-label={t('m09.dir.view')}>
              <button className={`btn-sm ${view === 'cards' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'cards'} onClick={() => setView('cards')}>{t('m09.dir.viewCards')}</button>
              <button className={`btn-sm ${view === 'table' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'table'} onClick={() => setView('table')} data-testid="m09-view-table">{t('m09.dir.viewTable')}</button>
            </div>
          }
        />
        <p className="text-[13px] text-ink-2" aria-live="polite">{t('m09.dir.showing', { n: f.num(filtered.length), total: f.num(orgs.length) })}</p>
      </Section>

      {filtered.length === 0 ? (
        <EmptyState title={t('m09.dir.noMatch')} action={<button className="btn-outline btn-sm" onClick={() => setFlt({ q: '', cat: '', status: '', type: '', country: '' })}>{t('common.clearFilters')}</button>} />
      ) : view === 'table' ? (
        <DataTable rows={filtered} columns={cols} rowKey={(o) => o.id} csvName="kafaa-partner-directory" initialSort={{ key: 'name', dir: 'asc' }} onRowClick={(o) => nav(`/partners/${o.id}`)} caption={t('m09.routes.partners.title')} />
      ) : (
        <>
          {partners.length > 0 && (
            <Section title={t('m09.dir.partnersTitle')} description={t('m09.dir.partnersDesc', { n: f.num(partners.length) })}>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m09-directory">
                {partners.map((o) => <PartnerCard key={o.id} o={o} dates={dates} />)}
              </ul>
            </Section>
          )}
          {oversight.length > 0 && (
            <Section title={t('m09.dir.oversightTitle')} description={t('m09.dir.oversightDesc')}>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m09-oversight">
                {oversight.map((o) => <PartnerCard key={o.id} o={o} dates={dates} />)}
              </ul>
            </Section>
          )}
        </>
      )}

      <Callout tone="sim" title={t('m09.dir.excludedTitle')}>
        {t('m09.dir.excludedBody')}
      </Callout>
    </>
  );
}

function PartnerCard({ o, dates }: { o: Org; dates: Map<string, string | null> }) {
  const t = useT();
  const pick = usePick();
  const types = o.rel_types ?? [];
  const nonBinding = types.some((x) => NON_BINDING.includes(x)) && !o.binding;
  return (
    <li className="card flex flex-col gap-2 p-4" data-testid="m09-partner-card">
      <div className="flex items-start justify-between gap-2">
        <L to={`/partners/${o.id}`} className="text-[15px] font-semibold leading-snug">
          {pick(o, 'name')}
        </L>
        <MStatus status={o.status} />
      </div>
      <CategoryChips cats={o.categories?.length ? o.categories : [o.category]} />
      <p className="text-[13.5px] text-ink-2">{pick(o, 'relationship')}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        {types.map((x) => (
          <span key={x} className="chip border-line bg-panel text-ink">{t(`m09.rel.${x}`)}</span>
        ))}
        <span className="num text-ink-3">· {datesLabel(t, o.dates)}</span>
        {nonBinding && <span className="chip border-sim-line bg-sim-bg text-sim" title={t('m09.dir.nonBindingHint')}>{t('m09.dir.nonBinding')}</span>}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-2">
        <SourceList sources={((o.sources as Source[]) ?? []).slice(0, 2)} dates={dates} />
        <L to={`/partners/${o.id}`} className="inline-flex shrink-0 items-center gap-1 text-[12.5px]" aria-label={t('m09.dir.openAria', { name: pick(o, 'name') })}>
          {t('m09.dir.open')} <Icon name="chevron" size={12} />
        </L>
      </div>
    </li>
  );
}

/** "current" / "historic" in the dates field are words, not dates: show them in the reader's language. */
function datesLabel(t: (k: string) => string, dates: string | null | undefined): string {
  return dates === 'current' || dates === 'historic' ? t(`m09.datesWord.${dates}`) : (dates ?? '');
}
