// /skills/datasheet (M16 · FS55, public): the published skills-ontology datasheet. Size, sources, update cadence, languages, how inference
// works and how bias is handled, every number computed by datasheet() from the public catalogue, the public change log and the code
// registries (ranked surfaces, evidence kinds, protected inputs); no figure on this page is typed into copy. Downloadable as JSON.
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useT } from '../../i18n';
import { Async, BarChart, BenchmarkChips, Callout, Card, Donut, Icon, Page, SourceLink, StatTile, downloadText } from '../../ui';
import { todayIso } from '../../domain/rules';
import { datasheet, type DsChange, type DsSkill } from './surfaces';
import { MethodologyBanner } from './MethodologyBanner';

export default function DatasheetPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['skills', 'skill_changes'], async () => ({
    skills: (await repo.list('skills')) as unknown as DsSkill[],
    changes: (await repo.list('skill_changes').catch(() => [])) as unknown as DsChange[],
  }), []);
  return (
    <Page title={t('m16.routes.skills-datasheet.title')} eyebrow={<BenchmarkChips feature="FS55" />} intro={t('m16.ds.intro')} wide>
      <Async state={q} isEmpty={(d) => d.skills.length === 0}>
        {(d) => <Sheet skills={d.skills} changes={d.changes} />}
      </Async>
    </Page>
  );
}

function Sheet({ skills, changes }: { skills: DsSkill[]; changes: DsChange[] }) {
  const t = useT();
  const f = useFormat();
  const ds = useMemo(() => datasheet(skills, changes, todayIso()), [skills, changes]);
  const n = (x: number | null) => f.num(x);
  const pct = (x: number | null) => (x == null ? '—' : f.pct(x));
  const bars = (o: Record<string, number>, label: (k: string) => string) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: label(k), value: v }));
  const LIFE_TONE: Record<string, string> = { emerging: 'accent', growing: 'ok', stable: 'info', declining: 'sim', obsolete: 'bad' };
  return (
    <div className="space-y-6" data-testid="m16-datasheet" data-skills={ds.size.skills}>
      <MethodologyBanner dashboard="datasheet" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-2" data-testid="m16-ds-generated">{t('m16.ds.generated', { date: f.date(ds.as_of), last: ds.cadence.last_change ? f.date(ds.cadence.last_change) : '—' })}</p>
        <button className="btn-outline btn-sm" onClick={() => downloadText('kafaa-skills-datasheet.json', JSON.stringify(ds, null, 2), 'application/json')} data-testid="m16-ds-download"><Icon name="download" size={14} />{t('m16.ds.download')}</button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m16-ds-tiles">
        <StatTile label={t('m16.ds.tile.skills')} value={n(ds.size.skills)} sub={t('m16.ds.tile.skillsSub', { live: n(ds.size.live), obsolete: n(ds.size.obsolete) })} />
        <StatTile label={t('m16.ds.tile.sources')} value={pct(ds.sources.with_https_pct)} sub={t('m16.ds.tile.sourcesSub', { n: n(ds.sources.domains) })} tone="ok" />
        <StatTile label={t('m16.ds.tile.changes')} value={n(ds.cadence.changes_12m)} sub={t('m16.ds.tile.changesSub')} />
        <StatTile label={t('m16.ds.tile.bilingual')} value={pct(ds.languages.bilingual_pct)} sub={t('m16.ds.tile.bilingualSub')} />
        <StatTile label={t('m16.ds.tile.surfaces')} value={n(ds.inference.ranked_surfaces)} sub={t('m16.ds.tile.surfacesSub', { n: n(ds.inference.model_slots_enabled) })} />
      </div>

      <Section n={1} title={t('m16.ds.size.title')} body={t('m16.ds.size.body', { skills: n(ds.size.skills), live: n(ds.size.live), owners: n(ds.size.owners) })}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t('m16.ds.size.lifecycle')}><Donut title={t('m16.ds.size.lifecycle')} data={Object.entries(ds.size.by_lifecycle).map(([k, v]) => ({ label: t(`fs.lifecycle.${k}`), value: v, tone: LIFE_TONE[k] }))} /></Card>
          <Card title={t('m16.ds.size.area')}><BarChart title={t('m16.ds.size.area')} data={bars(ds.size.by_area, (k) => t(`m28.area.${k}`))} /></Card>
          <Card title={t('m16.ds.size.future')}><BarChart title={t('m16.ds.size.future')} data={bars(ds.size.by_fs_area, (k) => t(`fs.area.${k}`))} /></Card>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">{t('m16.ds.size.types', { common: n(ds.size.by_type.common ?? 0), specialised: n(ds.size.by_type.specialised ?? 0), licence: n(ds.size.by_type.licence_like ?? 0),
          transversal: n(ds.size.by_reusability.transversal ?? 0) })}</p>
      </Section>

      <Section n={2} title={t('m16.ds.sources.title')} body={t('m16.ds.sources.body', { with: n(ds.sources.with_https), total: n(ds.size.skills), refs: n(ds.sources.sources_total), domains: n(ds.sources.domains), bm: n(ds.sources.benchmarks) })}>
        <ol className="grid grid-cols-1 gap-1.5 text-[13px] sm:grid-cols-2" data-testid="m16-ds-domains">
          {ds.sources.top_domains.map((d, i) => <li key={d.domain} className="flex items-center justify-between gap-2 rounded-btn border border-line px-2 py-1"><span className="truncate font-mono text-[12px]" dir="ltr">{f.num(i + 1)}. {d.domain}</span><span className="num text-ink-3">{t('m16.ds.sources.skills', { n: n(d.skills) })}</span></li>)}
        </ol>
      </Section>

      <Section n={3} title={t('m16.ds.cadence.title')} body={t('m16.ds.cadence.body', { fast: n(ds.cadence.review_months.fast), standard: n(ds.cadence.review_months.standard), slow: n(ds.cadence.review_months.slow) })}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t('m16.ds.cadence.overdue')} value={n(ds.cadence.overdue)} tone={ds.cadence.overdue ? 'bad' : 'ok'} />
          <StatTile label={t('m16.ds.cadence.dueSoon')} value={n(ds.cadence.due_soon)} />
          <StatTile label={t('m16.ds.cadence.median')} value={ds.cadence.median_months_to_review == null ? '—' : t('m16.ds.cadence.months', { n: f.num(ds.cadence.median_months_to_review, { maximumFractionDigits: 1 }) })} />
          <StatTile label={t('m16.ds.cadence.methodology')} value={n(ds.cadence.methodology_12m)} tone="sim" />
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">{t('m16.ds.cadence.kinds', { list: Object.entries(ds.cadence.by_kind).map(([k, v]) => `${t(`m16.gov.kind.${k}`)} ${f.num(v)}`).join(' · ') || '—' })} <L to="/skills/changes" className="link">{t('m16.ds.cadence.toLog')}</L></p>
      </Section>

      <Section n={4} title={t('m16.ds.lang.title')} body={t('m16.ds.lang.body')}>
        <table className="w-full text-start text-[13px]" data-testid="m16-ds-languages">
          <thead><tr className="text-ink-3"><th className="py-1 text-start font-normal">{t('m16.ds.lang.field')}</th><th className="py-1 text-start font-normal">{t('m16.ds.lang.en')}</th><th className="py-1 text-start font-normal">{t('m16.ds.lang.ar')}</th></tr></thead>
          <tbody>
            {([['names', ds.languages.name_en, ds.languages.name_ar], ['descriptions', ds.languages.description_en, ds.languages.description_ar], ['essence', ds.languages.essence_en, ds.languages.essence_ar], ['alt', ds.languages.alt_en, ds.languages.alt_ar]] as const).map(([k, en, ar]) => (
              <tr key={k} className="border-t border-line"><td className="py-1 pe-2 text-ink-2">{t(`m16.ds.lang.${k}`)}</td><td className="num py-1">{n(en)}</td><td className="num py-1">{n(ar)}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n={5} title={t('m16.ds.inf.title')} body={t('m16.ds.inf.body', { kinds: n(ds.inference.evidence_kinds), bases: n(ds.inference.bases), fast: n(ds.inference.half_lives.fast), standard: n(ds.inference.half_lives.standard), slow: n(ds.inference.half_lives.slow) })}>
        <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2" data-testid="m16-ds-inference">
          <li>{t('m16.ds.inf.surfaces', { n: n(ds.inference.ranked_surfaces), first: n(ds.inference.cards_f24), added: n(ds.inference.cards_fs55) })}</li>
          <li>{t('m16.ds.inf.deterministic', { n: n(ds.inference.deterministic), model: n(ds.inference.model_slots_enabled) })}</li>
          <li>{t('m16.ds.inf.claims')}</li>
        </ul>
      </Section>

      <Section n={6} title={t('m16.ds.bias.title')} body={t('m16.ds.bias.body', { protected: n(ds.bias.protected_inputs), min: n(ds.bias.min_group), pct: n(ds.bias.four_fifths_pct) })}>
        <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2" data-testid="m16-ds-bias">
          <li>{t('m16.ds.bias.metrics', { n: n(ds.bias.fairness_metrics) })}</li>
          <li>{t('m16.ds.bias.without', { n: n(ds.bias.surfaces_without_metric) })}</li>
          <li>{t('m16.ds.bias.suppress', { min: n(ds.bias.min_group) })}</li>
        </ul>
      </Section>

      <Callout tone="sim" title={t('m16.ds.limits.title')}>
        <ul className="list-disc space-y-1 ps-4">{(['synthetic', 'mirror', 'claims', 'security'] as const).map((k) => <li key={k}>{t(`m16.ds.limits.${k}`)}</li>)}</ul>
        <p className="mt-2 flex flex-wrap gap-3 text-[12.5px]">
          <SourceLink href="https://www.cornerstoneondemand.com/resources/article/what-you-need-to-get-started-with-cornerstone-skills-graph" date="2026-10-11">{t('m16.ds.limits.srcDatasheet')}</SourceLink>
          <SourceLink href="https://www.techwolf.ai/customer-stories/workday" date="2026-10-11">{t('m16.ds.limits.srcTechwolf')}</SourceLink>
        </p>
      </Callout>
    </div>
  );
}

function Section({ n, title, body, children }: { n: number; title: string; body: string; children?: ReactNode }) {
  const f = useFormat();
  return (
    <section className="space-y-3" aria-labelledby={`m16-ds-${n}`} data-testid={`m16-ds-section-${n}`}>
      <div>
        <h2 id={`m16-ds-${n}`} className="flex items-center gap-2 text-[17px] font-semibold"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[12px] text-eyebrow">{f.num(n)}</span>{title}</h2>
        <p className="mt-1 max-w-3xl text-[13.5px] text-ink-2">{body}</p>
      </div>
      {children}
    </section>
  );
}
