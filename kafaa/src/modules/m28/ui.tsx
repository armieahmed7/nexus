// FS07/FS08 shared pieces for the M28 pages: the catalogue data hook, match and review pills, the crosswalk list with its level
// map, the export buttons (CASE-shaped JSON, CSV, the JSON schema) and the "what match types mean" note. Strings: m28.*.
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../data';
import { useFormat, useLang, usePick, useT, L } from '../../i18n';
import { Callout, Icon, SourceLink, StatusPill, type PillTone } from '../../ui';
import type { SkillsRow, SkillAlignmentsRow, SkillFrameworksRow, SourcesRow, BenchmarksRow } from '../../data/types';
import {
  CASE_SCHEMA, FRAMEWORK_IDS, MATCH_TYPES, alignmentsCsv, buildCasePackage, canonLevelMap, isIndicative, isLabelLevel, shortCode, sortAlignments, validateJson,
} from './crosswalk';
import type { Bi } from './explorer';

export interface Catalogue {
  skills: SkillsRow[];
  frameworks: SkillFrameworksRow[];
  alignments: SkillAlignmentsRow[];
  sources: Map<string, SourcesRow>;
  benchmarks: Map<string, BenchmarksRow>;
  bySkill: Map<string, SkillAlignmentsRow[]>;
  fwById: Map<string, SkillFrameworksRow>;
  /** crosswalk labels per skill (published rows), for search */
  labels: Map<string, Bi[]>;
  /** secondary lookups that failed to load (audit 2026-10-13): the page still renders the skills, with an inline notice */
  missing: CatalogueLookup[];
}
export type CatalogueLookup = 'frameworks' | 'alignments' | 'sources' | 'benchmarks';

/** Skills, frameworks, the alignments the viewer may read, citation registry and benchmark rows: one query, both backends.
 *  Only the skills are required: if a secondary lookup fails (e.g. a transient statement timeout on skill_frameworks), the page
 *  renders without it and shows <CatalogueGaps> instead of replacing everything with an error (audit 2026-10-13, finding 13). */
export function useCatalogue() {
  const repo = useRepo();
  return useQuery(['skills', 'skill_frameworks', 'skill_alignments', 'sources', 'benchmarks'], async (): Promise<Catalogue> => {
    const missing: CatalogueLookup[] = [];
    const opt = <T,>(what: CatalogueLookup, p: Promise<T[]>): Promise<T[]> => p.catch((e: unknown) => { console.warn(`[m28] ${what} not loaded`, e); missing.push(what); return [] as T[]; });
    const [skills, frameworks, alignments, sources, benchmarks] = await Promise.all([
      repo.list('skills', { order: [['sort', 'asc']] }),
      opt('frameworks', repo.list('skill_frameworks', { order: [['sort', 'asc']] })),
      opt('alignments', repo.list('skill_alignments', { order: [['sort', 'asc']] })),
      opt('sources', repo.list('sources')),
      opt('benchmarks', repo.list('benchmarks')),
    ]);
    const bySkill = new Map<string, SkillAlignmentsRow[]>();
    const labels = new Map<string, Bi[]>();
    for (const a of alignments) {
      if (!bySkill.has(a.skill_id)) bySkill.set(a.skill_id, []);
      bySkill.get(a.skill_id)!.push(a);
      if (a.status === 'published') {
        if (!labels.has(a.skill_id)) labels.set(a.skill_id, []);
        labels.get(a.skill_id)!.push({ en: a.label_en, ar: a.label_ar });
      }
    }
    return {
      skills, frameworks, alignments, bySkill, labels, missing: missing.sort(),
      sources: new Map(sources.map((s) => [s.id, s])), benchmarks: new Map(benchmarks.map((b) => [b.id, b])), fwById: new Map(frameworks.map((f) => [f.id, f])),
    };
  });
}

/** Inline notice when part of the catalogue did not load (the rest of the page is shown). */
export function CatalogueGaps({ c, onRetry }: { c: Pick<Catalogue, 'missing'>; onRetry?: () => void }) {
  const t = useT();
  if (!c.missing.length) return null;
  return (
    <Callout tone="sim" title={t('m28.gaps.title')}>
      <span data-testid="m28-catalogue-gaps">{t('m28.gaps.body', { parts: c.missing.map((m) => t(`m28.gaps.part.${m}`)).join(', ') })}</span>
      {onRetry && <button type="button" className="btn-outline btn-sm ms-2" onClick={onRetry}>{t('m28.gaps.retry')}</button>}
    </Callout>
  );
}

export const MATCH_TONE: Record<string, PillTone> = { exact: 'ok', close: 'info', broad: 'neutral', partial: 'sim' };
export const LIFE_TONE: Record<string, PillTone> = { emerging: 'info', growing: 'ok', stable: 'neutral', declining: 'sim', obsolete: 'bad' };

export function MatchPill({ m }: { m: string }) {
  const t = useT();
  return <span title={t(`m28.match.${m}.help`)}><StatusPill tone={MATCH_TONE[m] ?? 'neutral'}>{t(`m28.match.${m}.label`)}</StatusPill></span>;
}
export function ReviewPill({ row }: { row: { reviewed_by?: string | null; reviewed_role?: string | null; reviewed_on?: string | null } }) {
  const t = useT();
  const f = useFormat();
  if (isIndicative(row)) return <span data-testid="m28-indicative" title={t('m28.review.indicativeHelp')}><StatusPill tone="sim">{t('m28.review.indicative')}</StatusPill></span>;
  return <span data-testid="m28-reviewed" title={t('m28.review.reviewedHelp', { role: t(`m28.role.${row.reviewed_role ?? 'admin'}`), date: f.date(row.reviewed_on) })}><StatusPill tone="ok">{t('m28.review.reviewed')}</StatusPill></span>;
}
export function CodeCell({ row, fw }: { row: { external_code?: string | null; framework: string }; fw?: SkillFrameworksRow | null }) {
  const t = useT();
  const pick = usePick();
  if (isLabelLevel(row)) return <span className="text-[12px] italic text-ink-3" data-testid="m28-code-pending">{t('m28.code.pending')}</span>;
  return (
    <span className="inline-flex items-baseline gap-1">
      {fw && <span className="text-[11px] text-ink-3">{pick(fw, 'code_label')}</span>}
      <bdi dir="ltr" className="font-mono text-[12px]" title={row.external_code ?? ''}>{shortCode(row.external_code)}</bdi>
    </span>
  );
}

/** Kafa'a level -> external level, as a small table. */
export function LevelMap({ map, fw }: { map: unknown; fw?: SkillFrameworksRow | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const m = canonLevelMap(map);
  const keys = Object.keys(m);
  if (!keys.length) return <p className="text-[12px] text-ink-3">{fw ? pick(fw, 'level_scale') || t('m28.levels.none') : t('m28.levels.none')}</p>;
  return (
    <table className="text-[12px]" data-testid="m28-level-map">
      <caption className="sr-only">{t('m28.levels.caption')}</caption>
      <thead><tr><th className="pe-3 text-start font-medium text-ink-3">{t('m28.levels.kafaa')}</th><th className="text-start font-medium text-ink-3">{fw?.short ?? t('m28.levels.external')}</th></tr></thead>
      <tbody>
        {keys.map((k) => <tr key={k}><td className="num pe-3">{t('m28.levels.level', { n: f.num(Number(k)) })}</td><td><bdi>{m[k]}</bdi></td></tr>)}
      </tbody>
    </table>
  );
}

/** The crosswalk of one skill, grouped by framework (FS08 tab on /skills/:id). */
export function CrosswalkList({ rows, fwById }: { rows: SkillAlignmentsRow[]; fwById: Map<string, SkillFrameworksRow> }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const pub = sortAlignments(rows.filter((r) => r.status === 'published'));
  if (!pub.length) return <p className="text-ink-3">{t('m28.xw.none')}</p>;
  return (
    <ul className="space-y-3" data-testid="m28-crosswalk">
      {pub.map((r) => {
        const fw = fwById.get(r.framework);
        const label = lang === 'ar' ? r.label_ar : r.label_en;
        return (
          <li key={r.id} className="rounded-card border border-line bg-panel p-3" data-testid="m28-xw-row">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-accent/40 bg-accent-soft text-eyebrow">{fw?.short ?? r.framework}</span>
              <span className="font-semibold">{label}</span>
              {lang === 'ar' && <span className="text-[11px] text-ink-3">{r.label_ar_official ? t('m28.xw.arOfficial') : t('m28.xw.arKafaa')}</span>}
              <span className="ms-auto flex flex-wrap items-center gap-1.5"><MatchPill m={r.match_type} /><ReviewPill row={r} /></span>
            </div>
            {lang === 'ar' && <p className="mt-0.5 text-[12px] text-ink-3" lang="en" dir="ltr">{r.label_en}</p>}
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1 text-[12.5px]">
                <p><CodeCell row={r} fw={fw} /></p>
                <p className="text-ink-2">{t(`m28.match.${r.match_type}.help`)}</p>
                {pick(r, 'note') && <p className="text-ink-3">{pick(r, 'note')}</p>}
                <p><SourceLink href={r.source_url} date={t('m28.asOf', { date: f.date(r.as_of) })}>{t('m28.xw.source', { fw: fw?.short ?? r.framework })}</SourceLink></p>
              </div>
              <LevelMap map={r.level_map} fw={fw} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MatchLegend() {
  const t = useT();
  return (
    <Callout tone="info" title={t('m28.match.legendTitle')}>
      <ul className="mt-1 grid gap-1.5 sm:grid-cols-2" data-testid="m28-match-legend">
        {MATCH_TYPES.map((m) => <li key={m} className="flex items-start gap-2"><MatchPill m={m} /><span className="text-[12.5px] text-ink-2">{t(`m28.match.${m}.help`)}</span></li>)}
      </ul>
      <p className="mt-2 text-[12.5px] text-ink-2">{t('m28.match.indicativeNote')}</p>
    </Callout>
  );
}

function save(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The CASE-shaped package of the published framework in the current language, plus its schema check. */
export function useCaseExport(c: Catalogue | undefined) {
  const t = useT();
  const lang = useLang();
  return useMemo(() => {
    if (!c) return null;
    const pkg = buildCasePackage(c.skills.filter((s) => s.lifecycle !== 'obsolete' || s.obsolete_on), c.alignments.filter((a) => a.status === 'published'), c.frameworks, {
      lang, generatedAt: '2026-10-10T00:00:00Z', baseUri: 'https://enec-nexus.netlify.app/kafaa', version: '2026.10', areaLabel: (a, l) => (l === lang ? t(`m28.area.${a}`) : a),
    });
    return { pkg, errors: validateJson(CASE_SCHEMA, pkg) };
  }, [c, lang, t]);
}

export function ExportButtons({ c }: { c: Catalogue }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const ex = useCaseExport(c);
  if (!ex) return null;
  const nAssoc = ex.pkg.CFAssociations.length;
  return (
    <div className="space-y-2" data-testid="m28-export">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" data-testid="m28-export-case" onClick={() => save(`kafaa-skills-case-${lang}.json`, JSON.stringify(ex.pkg, null, 2), 'application/json')}>
          <Icon name="download" size={14} /> {t('m28.export.case')}
        </button>
        <button type="button" className="btn-outline" data-testid="m28-export-csv" onClick={() => save('kafaa-skills-crosswalk.csv', alignmentsCsv(c.skills, c.alignments), 'text/csv;charset=utf-8')}>
          {t('m28.export.csv')}
        </button>
        <button type="button" className="btn-outline" data-testid="m28-export-schema" onClick={() => save('kafaa-case-package.schema.json', JSON.stringify(CASE_SCHEMA, null, 2), 'application/schema+json')}>
          {t('m28.export.schema')}
        </button>
      </div>
      <p className="text-[12.5px] text-ink-3" data-testid="m28-export-valid">
        {ex.errors.length === 0
          ? t('m28.export.valid', { items: f.num(ex.pkg.CFItems.length), assoc: f.num(nAssoc) })
          : t('m28.export.invalid', { n: f.num(ex.errors.length) })}
      </p>
    </div>
  );
}

export function SkillLink({ s }: { s: { id: string; name_en: string; name_ar: string } }) {
  const pick = usePick();
  return <L to={`/skills/${s.id}`}>{pick(s, 'name')}</L>;
}

export const FW_ORDER = FRAMEWORK_IDS;
