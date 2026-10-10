// FS18 /learn/external (staff, internal_content R): the curated, outcome-gated external catalogue. Every item cites its provider URL,
// a source and the date it was read; it is listed only because it met the published admission criteria (shown on the page with the
// scale). Completions are recorded as self-declared xAPI "experienced" statements and never become verified skill evidence (FS79 will
// verify certificates).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Async, EmptyState, StatTile, BenchmarkChips, FilterBar, useFilters, Icon, Callout, StatusPill } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { COST_BANDS, EXT_FORMATS } from './pathways';
import { CompleteExternalModal, ExternalCard, useMyCompletions, usePwRef, type PwRef, type Row } from './fsui';
import { FS_AREAS } from './PathwaysPage';
import { Can } from '../../auth/guards';

export default function ExternalCataloguePage() {
  const t = useT();
  const ref = usePwRef();
  return (
    <Page title={t('m19.routes.learn-external.title')} intro={t('m19.xr.intro')} wide eyebrow={<BenchmarkChips feature="FS18" />}
      actions={<L to="/learn/pathways" className="btn-outline btn-sm no-underline"><Icon name="grad" size={14} /> {t('m19.xr.toPathways')}</L>}>
      <Async state={ref}>{(d) => <Catalogue d={d} />}</Async>
    </Page>
  );
}

function Catalogue({ d }: { d: PwRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const [sp] = useSearchParams();
  const focus = sp.get('item');
  const mine = useMyCompletions();
  const [record, setRecord] = useState<Row | null>(null);
  const [flt, setFlt] = useFilters({ format: '', cost: '', lang: '', area: '', q: '' }, true);
  const pub = d.externals.filter((x) => x.status === 'published');
  const skills = new Map(d.skills.map((s) => [s.id, s]));
  const q = flt.q.trim().toLowerCase();
  const list = pub.filter((x) => (!flt.format || x.format === flt.format) && (!flt.cost || x.cost_band === flt.cost) && (!flt.lang || (x.languages ?? []).includes(flt.lang))
    && (!flt.area || (x.skills ?? []).some((s: Row) => skills.get(s.skill_id)?.fs_area === flt.area))
    && (!q || [x.title_en, x.title_ar, x.provider_en, x.provider_ar].some((v) => String(v ?? '').toLowerCase().includes(q))))
    .sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : Number(a.sort) - Number(b.sort)));
  const covered = new Set(pub.flatMap((x) => (x.skills ?? []).map((s: Row) => s.skill_id)));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m19-xr-tiles">
        <StatTile label={t('m19.xr.tilePublished')} value={f.num(pub.length)} sub={t('m19.xr.tilePublishedSub')} />
        <StatTile label={t('m19.xr.tileFree')} value={f.num(pub.filter((x) => x.cost_band === 'free').length)} sub={t('m19.xr.tileFreeSub')} tone="ok" />
        <StatTile label={t('m19.xr.tileArabic')} value={f.num(pub.filter((x) => (x.languages ?? []).includes('ar')).length)} sub={t('m19.xr.tileArabicSub')} />
        <StatTile label={t('m19.xr.tileSkills')} value={f.num(covered.size)} sub={t('m19.xr.tileSkillsSub')} />
      </div>
      <Section title={t('m19.xr.listTitle')} description={t('m19.xr.listIntro')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'format', label: t('m19.xr.fFormat'), options: [{ value: '', label: t('m19.pw.cat.all') }, ...EXT_FORMATS.map((x) => ({ value: x, label: t(`m19.xr.format.${x}`) }))] },
          { key: 'cost', label: t('m19.xr.fCost'), options: [{ value: '', label: t('m19.pw.cat.all') }, ...COST_BANDS.map((x) => ({ value: x, label: t(`m19.xr.cost.${x}`) }))] },
          { key: 'lang', label: t('m19.xr.fLang'), options: [{ value: '', label: t('m19.pw.cat.all') }, { value: 'ar', label: t('m19.xr.lang.ar') }, { value: 'en', label: t('m19.xr.lang.en') }] },
          { key: 'area', label: t('m19.pw.cat.fArea'), options: [{ value: '', label: t('m19.pw.cat.all') }, ...FS_AREAS.map((a) => ({ value: a, label: t(`fs.area.${a}`) }))] },
        ]} />
        {list.length ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m19-xr-list">
            {list.map((x) => <ExternalCard key={x.id} x={x} skills={d.skills} mine={mine.get(x.id) ?? null} highlight={x.id === focus} onRecord={() => setRecord(x)} />)}
          </ul>
        ) : <EmptyState icon="filter" title={t('m19.pw.cat.noMatch')} />}
      </Section>
      <Section title={t('m19.xr.criteriaTitle')} description={t('m19.xr.criteriaIntro')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m19-xr-criteria">
          {d.criteria.filter((c) => c.status === 'published').map((c) => (
            <li key={c.id} className="card p-4" data-testid="m19-xr-criterion" data-id={c.id}>
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{pick(c, 'name')}</span>
                {c.required ? <StatusPill tone="accent">{t('m19.xr.minScore', { n: f.num(c.min_score) })}</StatusPill> : <StatusPill tone="neutral">{t('m19.xr.informative')}</StatusPill>}</div>
              <p className="mt-1 text-[13px] text-ink-2">{pick(c, 'question')}</p>
              <ol className="mt-2 space-y-0.5 text-[12.5px] text-ink-3">{(c.scale as Row[]).map((s) => <li key={s.score}><span className="num me-1">{f.num(s.score)}</span>{lang === 'ar' ? s.ar : s.en}</li>)}</ol>
            </li>
          ))}
        </ul>
      </Section>
      <Callout tone="sim" title={t('m19.xr.selfTitle')}>{t('m19.xr.selfBody')}</Callout>
      <Can res="internal_content" levels={['W']}><p className="text-[12.5px]"><L to="/training/external">{t('m19.xr.toAdmin')}</L></p></Can>
      <CompleteExternalModal resource={record} open={!!record} onClose={() => setRecord(null)} />
    </div>
  );
}
