// FS23 /competencies/descriptors · Level descriptor library (public): every skill with the levels where it exists (range dots), its
// track (technical or behavioural, IAEA-TECDOC-1917), why its range is what it is, and a search across names and indicator text in
// English and Arabic. Each card opens the skill's behaviourally anchored descriptor page.
import { useMemo } from 'react';
import { Async, BenchmarkChips, EmptyState, FilterBar, Page, Section, StatTile, useFilters } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { RANGE_BASES, TRACKS, descriptorCoverage } from './descriptors';
import { BasisPill, RangeDots, TrackPill, useLevelsData, type LevelsData } from './levelsUi';

const AREAS = ['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'security', 'quality', 'leadership', 'digital', 'project'];
/** Arabic-insensitive normaliser for search (alef forms, ta marbuta, diacritics). */
const norm = (s: string) => s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export default function DescriptorLibraryPage() {
  const t = useT();
  const q = useLevelsData();
  return (
    <Page title={t('m02.routes.competencies-descriptors.title')} eyebrow={t('m02.lv.eyebrow')} intro={t('m02.dl.intro')} wide
      actions={<L to="/competencies/levels" className="btn-outline">{t('m02.dl.toLevels')}</L>}>
      <div data-testid="m02-bench-fs23"><BenchmarkChips feature="FS23" /></div>
      <Async state={q} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title={t('m02.lv.empty')} />}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: LevelsData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ q: '', area: '', track: '', basis: '' }, true);
  const pub = useMemo(() => d.descs.filter((x) => x.status === 'published'), [d.descs]);
  const cov = useMemo(() => descriptorCoverage(d.skills, d.ranges, pub), [d.skills, d.ranges, pub]);
  const text = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of d.skills) m.set(s.id, norm([s.code, s.name_en, s.name_ar].join(' ')));
    for (const x of pub) m.set(x.skill_id, `${m.get(x.skill_id) ?? ''} ${norm([x.essence_en, x.essence_ar, ...(x.indicators_en ?? []), ...(x.indicators_ar ?? [])].join(' '))}`);
    return m;
  }, [d.skills, pub]);
  const term = norm(flt.q.trim());
  const list = d.skills.filter((s) => {
    const r = d.rangeOf.get(s.id);
    if (flt.area && s.area !== flt.area) return false;
    if (flt.track && r?.track !== flt.track) return false;
    if (flt.basis && r?.basis !== flt.basis) return false;
    return !term || term.split(/\s+/).every((w) => (text.get(s.id) ?? '').includes(w));
  });
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m02-dl-tiles">
        <StatTile label={t('m02.dl.tComplete')} value={f.pct(cov.pct, 0)} sub={t('m02.dl.tCompleteSub', { n: f.num(cov.complete), total: f.num(cov.skills) })} tone={cov.complete === cov.skills ? 'ok' : 'bad'} />
        <StatTile label={t('m02.lv.tLevels')} value={f.num(cov.levels)} sub={t('m02.dl.tLevelsSub')} />
        <StatTile label={t('m02.lv.tIndicators')} value={f.num(cov.indicators)} sub={t('m02.dl.tIndSub')} tone="info" />
        <StatTile label={t('m02.dl.tTemplate')} value={f.num(cov.templated.length)} sub={t('m02.dl.tTemplateSub')} tone={cov.templated.length ? 'bad' : 'ok'} />
      </div>
      <Section title={t('m02.dl.listTitle')} description={t('m02.dl.listDesc', { n: f.num(list.length), total: f.num(d.skills.length) })}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'area', label: t('m02.dl.area'), options: AREAS.filter((a) => d.skills.some((s) => s.area === a)).map((a) => ({ value: a, label: t(`m02.area.${a}`) })) },
          { key: 'track', label: t('m02.dl.track'), options: TRACKS.map((x) => ({ value: x, label: t(`m02.lv.track.${x}`) })) },
          { key: 'basis', label: t('m02.dl.basis'), options: RANGE_BASES.map((x) => ({ value: x, label: t(`m02.lv.basis.${x}`) })) },
        ]} />
        {list.length === 0 ? <EmptyState title={t('m02.dl.none')} /> : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="m02-dl-list">
            {list.map((s) => {
              const r = d.rangeOf.get(s.id);
              const key = d.descOf(s.id, Number(s.key_level ?? 2));
              return (
                <li key={s.id} className="card flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <L to={`/competencies/descriptors/${s.id}`} className="font-semibold" data-testid={`m02-dl-skill-${s.id}`}>{pick(s, 'name')}</L>
                    <RangeDots range={r} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
                    <bdi dir="ltr">{s.code}</bdi><span>·</span><span>{t(`m02.area.${s.area}`)}</span><TrackPill track={r?.track} /><BasisPill basis={r?.basis} />
                  </div>
                  {key && <p className="line-clamp-2 text-[12.5px] text-ink-2">{pick(key, 'essence')}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
