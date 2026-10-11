// FS24 /competencies/scale · Level map (public): the Kafa'a scale (not yet, levels 1-4, Authority) set against SFIA 9 (7 levels),
// SkillsFuture (6), DigComp (8), UNESCO AI (3) and the UAE NQF (10). A band x framework grid with the external level range and how
// good the fit is, a visual strip per framework, every row citing its source with an as-of date, notes where the fit is loose, the
// FS08 crosswalk rows that follow the published map (data-only), and the Authority recognition explained (recognised by a panel,
// never a fifth level, never gamified; Kafa'a is not a recognition authority). CSV download.
import { useMemo } from 'react';
import { Async, BenchmarkChip, BenchmarkChips, Callout, Card, EmptyState, Page, Section, SourceLink, StatusPill, WhyThis, downloadText } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BANDS, FITS, SCALE_FRAMEWORKS, alignmentFollowsMap, extRange } from './authority';
import { FitPill, rangeText, useBandName, useLevelsData, type LevelsData, type Row } from './levelsUi';

const BAND_TONE: Record<string, string> = { not_yet: 'bg-sunken', l1: 'bg-accent/25', l2: 'bg-accent/45', l3: 'bg-accent/70', l4: 'bg-accent', authority: 'bg-eyebrow' };

export default function ScaleMapPage() {
  const t = useT();
  const q = useLevelsData();
  return (
    <Page title={t('m02.routes.competencies-scale.title')} eyebrow={t('m02.sc.eyebrow')} intro={t('m02.sc.intro')} wide
      actions={<L to="/competencies/levels" className="btn-outline">{t('m02.sc.toLevels')}</L>}>
      <div data-testid="m02-bench-fs24"><BenchmarkChips feature="FS24" /></div>
      <Async state={q} isEmpty={(d) => d.maps.length === 0} empty={<EmptyState title={t('m02.sc.empty')} />}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: LevelsData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const bandName = useBandName();
  const fw = (id: string) => d.frameworks.find((x) => x.id === id);
  const scaleOf = (id: string) => d.maps.find((m) => m.framework === id && m.row_kind === 'scale');
  const cell = (id: string, band: string) => d.maps.find((m) => m.framework === id && m.row_kind === 'map' && m.band === band);
  const follow = useMemo(() => Object.fromEntries(SCALE_FRAMEWORKS.map((id) => {
    const rows = d.alignments.filter((a) => a.framework === id && a.status === 'published' && Object.keys(a.level_map ?? {}).length > 0);
    const res = rows.map((a) => alignmentFollowsMap(a.level_map, d.maps, id));
    return [id, { n: rows.length, follows: res.filter((x) => x === 'follows').length }];
  })), [d.alignments, d.maps]);
  const csv = () => {
    const head = ['framework', 'band', 'external_levels', 'external_label_en', 'fit', 'note_en', 'source_url', 'as_of'];
    const lines = d.maps.filter((m) => m.row_kind === 'map').map((m) => [m.framework, m.band, extRange(m), m.label_en, m.fit, m.note_en, m.source_url, String(m.as_of).slice(0, 10)]
      .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(','));
    downloadText('kafaa-level-map.csv', [head.join(','), ...lines].join('\n'));
  };
  return (
    <>
      <Callout tone="info" title={t('m02.sc.howTitle')}>{t('m02.sc.howBody')}</Callout>

      <Section title={t('m02.sc.gridTitle')} description={t('m02.sc.gridDesc')} actions={<button type="button" className="btn-outline btn-sm" onClick={csv} data-testid="m02-sc-csv">{t('m02.sc.csv')}</button>}>
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]" data-testid="m02-sc-grid">
              <caption className="sr-only">{t('m02.sc.gridTitle')}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="p-3 text-start caps">{t('m02.sc.kafaa')}</th>
                  {SCALE_FRAMEWORKS.map((id) => (
                    <th key={id} scope="col" className="p-3 text-start">
                      <span className="caps">{fw(id)?.short ?? id}</span>
                      <span className="block text-[11.5px] font-normal text-ink-3">{t('m02.sc.nLevels', { n: f.num(scaleOf(id)?.level_count ?? 0) })}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BANDS.map((b) => (
                  <tr key={b} className={`border-b border-line align-top last:border-0 ${b === 'authority' ? 'bg-accent-soft/30' : ''}`} data-testid={`m02-sc-row-${b}`}>
                    <th scope="row" className="p-3 text-start">
                      <span className="font-semibold">{bandName(b)}</span>
                      {b === 'authority' && <span className="block"><StatusPill tone="info">{t('m02.lv.notALevel')}</StatusPill></span>}
                    </th>
                    {SCALE_FRAMEWORKS.map((id) => {
                      const c = cell(id, b);
                      return (
                        <td key={id} className="p-3">
                          {!c ? '—' : (
                            <div className="space-y-1">
                              <div className="font-semibold"><bdi className="num">{rangeText(c, f)}</bdi>{c.ext_from != null && <span className="ms-1 font-normal text-ink-2">{pick(c, 'label')}</span>}</div>
                              <FitPill fit={c.fit} />
                              {(c.fit === 'loose' || c.fit === 'none') && <p className="text-[11.5px] text-ink-3">{pick(c, 'note')}</p>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3" data-testid="m02-sc-fits">
          {FITS.map((x) => <span key={x} className="inline-flex items-center gap-1"><FitPill fit={x} /> {t(`m02.sc.fitHint.${x}`)}</span>)}
          <WhyThis reasons={[{ code: 'fit', key: 'm02.sc.why.fit' }, { code: 'source', key: 'm02.sc.why.source' }, { code: 'auth', key: 'm02.sc.why.authority' }]} testId="m02-sc-why" />
        </div>
      </Section>

      <Section title={t('m02.sc.stripsTitle')} description={t('m02.sc.stripsDesc')}>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m02-sc-frameworks">
          {SCALE_FRAMEWORKS.map((id) => {
            const sc = scaleOf(id);
            const levels = (Array.isArray(sc?.levels) ? sc.levels : []) as { n: number; en: string; ar: string }[];
            const bandFor = (n: number) => BANDS.filter((b) => b !== 'not_yet' && b !== 'authority').find((b) => { const c = cell(id, b); return c && c.ext_from != null && n >= c.ext_from && n <= (c.ext_to ?? c.ext_from); }) ?? (cell(id, 'authority')?.ext_from != null && n >= cell(id, 'authority').ext_from ? 'authority' : null);
            const fl = follow[id];
            return (
              <Card key={id} as="li" title={<span className="flex flex-wrap items-center gap-2">{fw(id)?.short ?? id}{sc?.benchmark_id && <BenchmarkChip id={sc.benchmark_id} />}</span>}>
                <ol className="flex gap-0.5" aria-label={t('m02.sc.stripAria', { fw: fw(id)?.short ?? id })} data-testid={`m02-sc-strip-${id}`}>
                  {levels.map((lv) => {
                    const b = bandFor(lv.n) as Row;
                    return (
                      <li key={lv.n} className={`flex-1 rounded-sm px-1 py-2 text-center text-[11px] ${b ? BAND_TONE[b] : 'bg-sunken'} ${b === 'l4' || b === 'authority' || b === 'l3' ? 'text-white' : 'text-ink'}`} title={`${f.num(lv.n)} · ${pick({ x_en: lv.en, x_ar: lv.ar } as Row, 'x')}${b ? ` → ${bandName(b)}` : ''}`}>
                        <span className="num font-semibold">{f.num(lv.n)}</span>
                        <span className="sr-only"> {pick({ x_en: lv.en, x_ar: lv.ar } as Row, 'x')}{b ? ` → ${bandName(b)}` : ''}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-[12.5px] text-ink-2">{pick(sc, 'note')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                  <SourceLink href={sc?.source_url ?? '#'} date={sc ? f.date(String(sc.as_of).slice(0, 10)) : null}>{t('m02.sc.source')}</SourceLink>
                  {fl && fl.n > 0 && <span className="text-ink-3" data-testid={`m02-sc-follow-${id}`}>{t('m02.sc.followN', { n: f.num(fl.follows), total: f.num(fl.n) })}</span>}
                </div>
              </Card>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2 text-[11.5px] text-ink-3" aria-hidden>
          {BANDS.filter((b) => b !== 'not_yet').map((b) => <span key={b} className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${BAND_TONE[b]}`} />{bandName(b)}</span>)}
        </div>
      </Section>

      <Section title={t('m02.sc.authTitle')} description={t('m02.sc.authDesc')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m02-sc-authority">
          <Card title={t('m02.sc.auth1Title')}><p className="text-[13px] text-ink-2">{t('m02.sc.auth1Body')}</p></Card>
          <Card title={t('m02.sc.auth2Title')}><p className="text-[13px] text-ink-2">{t('m02.sc.auth2Body')}</p></Card>
          <Card title={t('m02.sc.auth3Title')}><p className="text-[13px] text-ink-2">{t('m02.sc.auth3Body')}</p></Card>
        </div>
        <Callout tone="sim" title={t('m02.sc.mirrorTitle')}>{t('m02.sc.mirrorBody')}</Callout>
      </Section>
    </>
  );
}
