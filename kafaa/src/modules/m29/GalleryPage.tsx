// FS80 /workforce/ai-automations (ai_literacy R): the automation and agent gallery. Every approved entry (RLS: listed only) with what it
// is for, the data it uses, the AI-system register row it runs on, the minimum FS09 rung, its adoption counter and the builder's credit.
// Metadata only: Kafa'a never runs an automation; entries are plain text. Filters and the order (most adopted, newest) are not a
// personal ranking. Builder credit (F01 evidence) is written only after approval and the first adoption.
import { useMemo } from 'react';
import { Page, Section, Async, EmptyState, StatTile, BenchmarkChips, FilterBar, useFilters, Icon, WhyThis } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { AUTOMATION_KINDS, BUILDER_LEVEL_REUSE, DATA_CLASSES, REUSE_AT, builderLevel, sortGallery } from './automations';
import { Counter, DataClassChips, KindChip, MetadataNotice, SystemLink, listedReasons, useGallery, type GalleryData } from './fs80ui';
import { RungPill, type Row } from './ui';

export default function GalleryPage() {
  const t = useT();
  const q = useGallery();
  return (
    <Page title={t('m29.routes.workforce-ai-automations.title')} intro={t('m29.atm.gal.intro')} wide eyebrow={<BenchmarkChips feature="FS80" />}
      actions={<span className="flex flex-wrap gap-2">
        <L to="/my/ai-fluency/builds" className="btn-primary btn-sm no-underline" data-testid="m29-atm-to-builds"><Icon name="plus" size={14} /> {t('m29.atm.gal.share')}</L>
        <L to="/workforce/ai-register" className="btn-outline btn-sm no-underline">{t('m29.atm.gal.toRegister')}</L>
      </span>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: GalleryData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [flt, setF] = useFilters({ q: '', kind: '', system: '', data: '', sort: 'adopted' }, true);
  const sysOf = (id: string) => d.systems.find((s: Row) => s.id === id);
  const listed = d.entries.filter((a: Row) => a.status === 'approved');
  const rows = useMemo(() => {
    const qq = flt.q.trim().toLowerCase();
    const hit = listed.filter((a: Row) => (!flt.kind || a.kind === flt.kind) && (!flt.system || a.system_id === flt.system) && (!flt.data || (a.data_classes ?? []).includes(flt.data))
      && (!qq || [a.title_en, a.title_ar, a.purpose_en, a.purpose_ar].some((x) => String(x ?? '').toLowerCase().includes(qq))));
    return sortGallery(hit as never, flt.sort === 'newest' ? 'newest' : 'adopted') as Row[];
  }, [listed, flt]);
  const adoptions = listed.reduce((m: number, a: Row) => m + Number(a.adoption_count), 0);
  const usedSystems = new Set(listed.map((a: Row) => a.system_id));
  const mineIds = new Set(d.mine.map((x: Row) => x.automation_id));
  return (
    <div className="space-y-6">
      <MetadataNotice />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-atm-tiles">
        <StatTile label={t('m29.atm.gal.tile.entries')} value={f.num(listed.length)} />
        <StatTile label={t('m29.atm.gal.tile.adoptions')} value={f.num(adoptions)} tone="ok" sub={t('m29.atm.gal.tile.adoptionsSub')} />
        <StatTile label={t('m29.atm.gal.tile.systems')} value={f.num(usedSystems.size)} sub={t('m29.atm.gal.tile.systemsSub')} />
        <StatTile label={t('m29.atm.gal.tile.mine')} value={f.num(d.mine.length)} />
      </div>
      <Section title={t('m29.atm.gal.list.title')} description={t('m29.atm.gal.list.intro')}>
        <div className="mb-3">
          <FilterBar value={flt} onChange={setF} search="q" fields={[
            { key: 'kind', label: t('m29.atm.f.kind'), options: AUTOMATION_KINDS.map((k) => ({ value: k, label: t(`m29.atm.kind.${k}`) })) },
            { key: 'system', label: t('m29.atm.f.system'), options: d.systems.filter((s: Row) => usedSystems.has(s.id)).map((s: Row) => ({ value: s.id, label: pick(s, 'name') })) },
            { key: 'data', label: t('m29.atm.f.data'), options: DATA_CLASSES.map((c) => ({ value: c, label: t(`m29.atm.class.${c}`) })) },
            { key: 'sort', label: t('m29.atm.f.sort'), options: [{ value: 'adopted', label: t('m29.atm.sort.adopted') }, { value: 'newest', label: t('m29.atm.sort.newest') }] },
          ]} />
        </div>
        {rows.length ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m29-atm-list">
            {rows.map((a) => {
              const sys = sysOf(a.system_id);
              const lvl = builderLevel(a.status, Number(a.adoption_count));
              return (
                <li key={a.id} className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m29-atm-card" data-id={a.id} data-adopted={mineIds.has(a.id) ? 'yes' : 'no'}>
                  <div className="flex flex-wrap items-center gap-1.5"><KindChip kind={a.kind} />{mineIds.has(a.id) && <span className="chip border-ok-line bg-ok-bg normal-case tracking-normal text-ok">{t('m29.atm.youAdopted')}</span>}</div>
                  <L to={`/workforce/ai-automations/${a.id}`} className="min-w-0 break-words font-semibold" data-testid="m29-atm-open">{pick(a, 'title')}</L>
                  <p className="line-clamp-3 break-words text-[13px] text-ink-2">{pick(a, 'purpose')}</p>
                  <SystemLink sys={sys} />
                  <DataClassChips classes={a.data_classes} />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                    <Counter n={Number(a.adoption_count)} />
                    <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">{t('m29.atm.needs')} <RungPill rung={Number(a.min_rung)} /></span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
                    <span>{t('m29.atm.builtBy', { name: pick(a, 'builder') })}{lvl > 0 ? ` · ${t('m29.atm.credit.levelShort', { n: f.num(lvl) })}` : ''}</span>
                    <WhyThis reasons={listedReasons(a, sys)} testId="m29-atm-why" />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={t('m29.atm.gal.none')} />}
      </Section>
      <Section title={t('m29.atm.how.title')} description={t('m29.atm.how.intro')}>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="m29-atm-how">
          {(['submit', 'review', 'listed', 'adopted', 'reuse'] as const).map((k, i) => (
            <li key={k} className="card flex min-w-0 flex-col gap-1 p-3">
              <span className="caps text-eyebrow"><span className="num">{f.num(i + 1)}</span> · {t(`m29.atm.how.${k}.title`)}</span>
              <span className="text-[13px] text-ink-2">{t(`m29.atm.how.${k}.body`, { n: f.num(REUSE_AT), level: f.num(BUILDER_LEVEL_REUSE) })}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
