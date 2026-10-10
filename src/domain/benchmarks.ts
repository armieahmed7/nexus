/**
 * FS01 (future skills, wave A): rules for the benchmark registry (kafaa_benchmarks). Pure and import-free.
 * Every benchmark figure shown in the product is a sourced row in `figures`, never a number typed into copy:
 * pages read it with figureOf(rows, 'OECD-PIAAC', 'aps_oecd_average') or <BenchmarkLine benchmark=... figure=...>.
 * The SQL checks in the FS11 migration (kafaa_benchmarks_https_ck, _listed_ck) mirror benchmarkProblems().
 */
export const BENCHMARK_CATEGORIES = ['global', 'national', 'uae', 'nuclear_energy', 'ai', 'corporate'] as const;
export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];
export const BENCHMARK_STATUSES = ['draft', 'published', 'retired'] as const;
export type YearKind = 'single' | 'range' | 'editions' | 'current' | 'reference';

export type FigureUnit = 'pct' | 'count' | 'score';
export interface BenchmarkFigure {
  key: string;
  value: number;
  unit: FigureUnit;
  /** Upper end of the scale the figure lives on (a PIAAC score: 500; a percentage: 100). */
  scale_max?: number;
  label_en: string;
  label_ar: string;
  /** The exact wording of the figure in fact_en (checked by a unit test, so a figure never drifts from its source text). */
  quote_en?: string;
}
export interface BenchmarkRow {
  id: string;
  name_en: string;
  name_ar: string;
  owner_en: string;
  owner_ar: string;
  country_en: string;
  country_ar: string;
  category: string;
  year_from: number;
  year_to?: number | null;
  year_kind: string;
  urls: string[];
  fact_en: string;
  fact_ar: string;
  borrow_en: string;
  borrow_ar: string;
  figures: BenchmarkFigure[] | unknown;
  feature_ids: string[];
  as_of: string;
  status: string;
  listed: boolean;
  sort?: number;
}

const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/i;
/** Problems that block saving or publishing a benchmark row (empty = fine). Same rules as the SQL checks. */
export function benchmarkProblems(b: Partial<BenchmarkRow>): string[] {
  const p: string[] = [];
  if (!b.id || !/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(b.id)) p.push('id');
  if (!b.name_en?.trim() || !b.name_ar?.trim()) p.push('name');
  if (!b.owner_en?.trim() || !b.owner_ar?.trim()) p.push('owner');
  if (!Array.isArray(b.urls) || b.urls.length < 1 || b.urls.some((u) => !HTTPS.test(String(u)))) p.push('urls');
  if (!b.as_of || !/^\d{4}-\d{2}-\d{2}$/.test(b.as_of)) p.push('as_of');
  if (!b.year_from || b.year_from < 1990 || b.year_from > 2100 || (b.year_to != null && b.year_to < b.year_from)) p.push('year');
  if (b.listed !== (b.status === 'published')) p.push('listed');
  if (!b.fact_en?.trim() || !b.fact_ar?.trim() || !b.borrow_en?.trim() || !b.borrow_ar?.trim()) p.push('text');
  for (const f of figuresOf(b)) if (!f.key || !Number.isFinite(f.value) || !f.label_en || !f.label_ar) p.push('figure');
  return [...new Set(p)];
}
export const figuresOf = (b: Partial<BenchmarkRow> | null | undefined): BenchmarkFigure[] => (Array.isArray(b?.figures) ? (b!.figures as BenchmarkFigure[]) : []);
export function figureOf(rows: Partial<BenchmarkRow>[], id: string, key: string): BenchmarkFigure | null {
  return figuresOf(rows.find((r) => r.id === id)).find((f) => f.key === key) ?? null;
}
/** Year parts for display: years are numbers so the reader's digit setting applies; `kind` picks the wording. */
export function yearParts(b: Pick<BenchmarkRow, 'year_from' | 'year_to' | 'year_kind'>): { kind: YearKind; from: number; to: number | null } {
  const kind = (['single', 'range', 'editions', 'current', 'reference'].includes(b.year_kind) ? b.year_kind : 'single') as YearKind;
  return { kind, from: b.year_from, to: b.year_to ?? null };
}
/** Host name of a source URL (shown next to the link). */
export const hostOf = (url: string): string => {
  const m = /^https?:\/\/([^/]+)/i.exec(url);
  return m ? m[1].replace(/^www\./, '') : url;
};
