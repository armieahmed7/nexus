// FS08 /skills/frameworks · International crosswalk (public): the frameworks Kafa'a aligns to, a coverage matrix (framework x skill
// group), per-framework lists with match type, code (or "code pending review"), review state ("indicative" until a framework owner
// reviews it), source and as-of date, and the machine-readable export of the published framework (CASE-shaped JSON, CSV, schema).
import { useMemo } from 'react';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import {
  Async, BenchmarkChip, BenchmarkChips, Card, DataTable, EmptyState, En, FilterBar, Heatmap, Page, Section, SourceLink, StatTile, StatusPill, useFilters, type Column,
} from '../../ui';
import { FS_AREAS } from '../../domain/taxonomy';
import type { SkillAlignmentsRow } from '../../data/types';
import { MATCH_TYPES, coverage, isIndicative, isLabelLevel, sortAlignments } from './crosswalk';
import { isListed } from './explorer';
import { CatalogueGaps, CodeCell, ExportButtons, MatchLegend, MatchPill, ReviewPill, useCatalogue, type Catalogue } from './ui';

const GROUPS = ['established', ...FS_AREAS];

export default function FrameworksPage() {
  const t = useT();
  const c = useCatalogue();
  return (
    <Page title={t('m28.routes.skills-frameworks.title')} eyebrow={t('m28.fw.eyebrow')} intro={t('m28.fw.intro')} wide
      actions={<L to="/skills" className="btn-outline">{t('m28.fw.toExplorer')}</L>}>
      <div data-testid="m28-bench-fs08"><BenchmarkChips feature="FS08" /></div>
      <Async state={c} isEmpty={(d) => d.frameworks.length === 0} empty={<EmptyState title={t('m28.fw.empty')} />}>{(d) => <><CatalogueGaps c={d} onRetry={c.reload} /><Body c={d} /></>}</Async>
    </Page>
  );
}

function Body({ c }: { c: Catalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const listed = useMemo(() => c.skills.filter(isListed), [c.skills]);
  const pub = useMemo(() => c.alignments.filter((a) => a.status === 'published'), [c.alignments]);
  const cov = useMemo(() => coverage(listed, pub, c.frameworks.map((x) => x.id), (s) => s.fs_area ?? 'established'), [listed, pub, c.frameworks]);
  const coded = pub.filter((a) => !isLabelLevel(a)).length;
  const reviewed = pub.filter((a) => !isIndicative(a)).length;
  const [flt, setFlt] = useFilters({ fw: 'esco', match: '', review: '', q: '' }, true);
  const skillById = useMemo(() => new Map(c.skills.map((s) => [s.id, s])), [c.skills]);
  const term = flt.q.trim().toLowerCase();
  const rows = sortAlignments(pub.filter((a) => (!flt.fw || a.framework === flt.fw) && (!flt.match || a.match_type === flt.match)
    && (!flt.review || (flt.review === 'indicative' ? isIndicative(a) : !isIndicative(a)))
    && (!term || `${a.label_en} ${a.label_ar} ${skillById.get(a.skill_id)?.name_en ?? ''} ${skillById.get(a.skill_id)?.name_ar ?? ''} ${a.external_code ?? ''}`.toLowerCase().includes(term))));
  const cols: Column<SkillAlignmentsRow>[] = [
    { key: 'skill', header: t('m28.fw.colSkill'), value: (a) => pick(skillById.get(a.skill_id), 'name'), sortable: true, render: (a) => {
      const s = skillById.get(a.skill_id);
      return s ? <span><L to={`/skills/${s.id}?tab=crosswalk`} className="font-medium">{pick(s, 'name')}</L><span className="block text-[11.5px] text-ink-3"><bdi dir="ltr">{s.code}</bdi></span></span> : a.skill_id;
    } },
    { key: 'label', header: t('m28.fw.colExternal'), value: (a) => (lang === 'ar' ? a.label_ar : a.label_en), sortable: true, render: (a) => (
      <span>{lang === 'ar' ? a.label_ar : a.label_en}{lang === 'ar' && <span className="block text-[11.5px] text-ink-3" dir="ltr" lang="en">{a.label_en}</span>}</span>
    ) },
    { key: 'code', header: t('m28.fw.colCode'), value: (a) => a.external_code ?? '', render: (a) => <CodeCell row={a} /> },
    { key: 'match', header: t('m28.fw.colMatch'), value: (a) => a.match_type, sortable: true, render: (a) => <MatchPill m={a.match_type} /> },
    { key: 'review', header: t('m28.fw.colReview'), value: (a) => (isIndicative(a) ? 'indicative' : 'reviewed'), render: (a) => <ReviewPill row={a} /> },
    { key: 'source', header: t('m28.fw.colSource'), value: (a) => a.source_url, render: (a) => <SourceLink href={a.source_url} date={f.date(a.as_of)} /> },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m28-fw-tiles">
        <StatTile label={t('m28.fw.tCoverage')} value={f.pct(cov.overall.pct, 1)} sub={t('m28.fw.tCoverageSub', { n: f.num(cov.overall.n), total: f.num(cov.overall.total) })} tone={cov.overall.pct >= 95 ? 'ok' : 'bad'} />
        <StatTile label={t('m28.fw.tRows')} value={f.num(pub.length)} sub={t('m28.fw.tRowsSub', { n: f.num(c.frameworks.length - cov.emptyFrameworks.length), total: f.num(c.frameworks.length) })} />
        <StatTile label={t('m28.fw.tCoded')} value={f.pct((coded / Math.max(1, pub.length)) * 100, 0)} sub={t('m28.fw.tCodedSub', { n: f.num(pub.length - coded) })} tone="info" />
        <StatTile label={t('m28.fw.tReviewed')} value={f.pct((reviewed / Math.max(1, pub.length)) * 100, 0)} sub={t('m28.fw.tReviewedSub', { n: f.num(pub.length - reviewed) })} tone="sim" />
      </div>

      <Section title={t('m28.fw.exportTitle')} description={t('m28.fw.exportDesc')}>
        <Card><ExportButtons c={c} /><div className="mt-2"><BenchmarkChip id="1EDTECH" /></div></Card>
      </Section>

      <Section title={t('m28.fw.registry')} description={t('m28.fw.registryDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m28-fw-cards">
          {c.frameworks.map((fw) => {
            const cell = cov.byFramework[fw.id];
            const n = pub.filter((a) => a.framework === fw.id).length;
            return (
              <Card key={fw.id} as="li" title={<span className="flex flex-wrap items-center gap-2"><En>{fw.short}</En>{n === 0 && <StatusPill tone="sim">{t('m28.fw.notYet')}</StatusPill>}</span>}>
                <p className="text-[13px] font-medium">{pick(fw, 'name')}</p>
                <p className="text-[12px] text-ink-3">{pick(fw, 'owner')}{fw.version_label ? ` · ${fw.version_label}` : ''}</p>
                <p className="mt-2 text-[12.5px] text-ink-2">{pick(fw, 'scope')}</p>
                <dl className="mt-2 grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-2 gap-y-1 text-[12px]">
                  <dt className="text-ink-3">{t('m28.fw.codes')}</dt><dd>{pick(fw, 'code_label')} · {fw.codes_copied ? t('m28.fw.copied') : t('m28.fw.pending')}</dd>
                  <dt className="text-ink-3">{t('m28.fw.levels')}</dt><dd>{pick(fw, 'level_scale')}</dd>
                  <dt className="text-ink-3">{t('m28.fw.rows')}</dt><dd className="num" data-testid={`m28-fw-n-${fw.id}`}>{t('m28.fw.rowsV', { n: f.num(n), skills: f.num(cell?.n ?? 0) })}</dd>
                </dl>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {fw.benchmark_id && <BenchmarkChip id={fw.benchmark_id} />}
                  <SourceLink href={fw.url} date={t('m28.asOf', { date: f.date(fw.as_of) })} />
                </div>
                {n > 0 && <button type="button" className="mt-2 text-[12.5px] text-eyebrow underline" onClick={() => setFlt({ fw: fw.id })}>{t('m28.fw.showRows')}</button>}
              </Card>
            );
          })}
        </ul>
      </Section>

      <Section title={t('m28.fw.matrix')} description={t('m28.fw.matrixDesc')}>
        <div className="card" data-testid="m28-fw-matrix">
          <Heatmap
            title={t('m28.fw.matrix')}
            rows={c.frameworks.map((x) => x.id)}
            cols={GROUPS}
            rowLabel={(id) => c.fwById.get(id)?.short ?? id}
            colLabel={(g) => (g === 'established' ? t('m28.fw.established') : t(`fs.area.${g}`))}
            value={(fw, g) => {
              const x = cov.matrix[fw]?.[g];
              if (!x || !x.total) return { v: null };
              return { v: x.pct, label: x.n ? `${f.num(x.n)}/${f.num(x.total)}` : '—' };
            }}
          />
          <p className="mt-2 text-[12px] text-ink-3">{t('m28.fw.matrixNote')}</p>
        </div>
        {(cov.emptyFrameworks.length > 0 || cov.unmapped.length > 0) && (
          <div className="card mt-3" data-testid="m28-fw-gaps">
            <h3 className="caps mb-1">{t('m28.fw.gaps')}</h3>
            {cov.emptyFrameworks.map((id) => <p key={id} className="text-[13px]">{t('m28.fw.gapFramework', { fw: c.fwById.get(id)?.short ?? id })} <span className="text-ink-3">{pick(c.fwById.get(id), 'scope')}</span></p>)}
            {cov.unmapped.map((id) => <p key={id} className="text-[13px]">{t('m28.fw.gapSkill')} <L to={`/skills/${id}`}>{pick(skillById.get(id), 'name')}</L></p>)}
          </div>
        )}
      </Section>

      <Section title={t('m28.fw.listTitle')} description={t('m28.fw.listDesc')}>
        <MatchLegend />
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'fw', label: t('m28.fw.colFramework'), options: c.frameworks.map((x) => ({ value: x.id, label: x.short })) },
          { key: 'match', label: t('m28.fw.colMatch'), options: MATCH_TYPES.map((m) => ({ value: m, label: t(`m28.match.${m}.label`) })) },
          { key: 'review', label: t('m28.fw.colReview'), options: [{ value: 'indicative', label: t('m28.review.indicative') }, { value: 'reviewed', label: t('m28.review.reviewed') }] },
        ]} />
        {rows.length === 0 ? <EmptyState title={t('m28.fw.noRows')} /> : (
          <div data-testid="m28-fw-table"><DataTable rows={rows} columns={cols} rowKey={(a) => a.id} csvName="kafaa-crosswalk" searchable={false} /></div>
        )}
      </Section>
    </>
  );
}
