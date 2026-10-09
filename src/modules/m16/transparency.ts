/**
 * F24 transparency rules shared by both backends, the pages and the tests (pure, import-free).
 *  - ENGINE_MSG: refusal messages of setEngineWeights / changeEngineWeights (wave-0 wording kept; SQL uses the same text).
 *  - PROTECTED_INPUTS: fields no scoring function may read (gender, nationality, age and its proxies). The unit test
 *    tests/unit/w3e5-no-protected-inputs.test.ts proves it for every function listed on an engine card.
 *  - SCORING_FUNCTIONS: the ranking and readiness functions behind each recommendation surface (engine cards list them).
 */
export const RATIONALE_MIN = 10;
export const ENGINE_MSG = {
  forbidden: 'Only a platform admin may change engine settings',
  surface: 'Unknown surface',
  engine: 'Engine must be deterministic or model',
  weights: 'Weights must be numbers between 0 and 10',
  rationale: 'Give a rationale of 10 to 500 characters: it is shown in the change log',
  noChange: 'Nothing changed: the engine and weights are already set this way',
} as const;

/** Same rule as the wave-0 SQL: a JSON object whose values are numbers from 0 to 10. */
export function validWeights(w: unknown): w is Record<string, number> {
  return !!w && typeof w === 'object' && !Array.isArray(w) && Object.values(w as Record<string, unknown>).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10);
}
export function sameWeights(a: Record<string, number> | null | undefined, b: Record<string, number> | null | undefined): boolean {
  const x = a ?? {}, y = b ?? {};
  const kx = Object.keys(x).sort(), ky = Object.keys(y).sort();
  return kx.length === ky.length && kx.every((k, i) => k === ky[i] && Number(x[k]) === Number(y[k]));
}

/** Fields that identify a protected group or stand in for age. No scoring function may read any of them. */
export const PROTECTED_INPUTS = ['gender', 'nationality', 'nationality_flag', 'age', 'age_band', 'birth_date', 'date_of_birth', 'birth_year', 'dob', 'religion', 'marital_status'] as const;
/**
 * The protected fields as they appear in code and SQL. Bare "age" is left out of source scans because the skills core uses
 * it for the age of an evidence row (days since observed), not a person's age; no table holds a person's age or birth date
 * (asserted by the tests), and the runtime trap in the tests still catches any read of an "age" property on an input row.
 */
export const PROTECTED_COLUMNS = PROTECTED_INPUTS.filter((k) => k !== 'age');
/** The three excluded inputs every card states (BACKLOG F24). */
export const EXCLUDED_ON_CARDS = ['gender', 'nationality_flag', 'age'] as const;

/** Engine card ids (one per recommendation surface). */
export const CARD_IDS = ['navigator', 'coach', 'marketplace', 'talent_evidence', 'mentoring', 'rotations', 'experts', 'future'] as const;
export type CardId = (typeof CARD_IDS)[number];

/** Diff of two weight objects for the change log: keys whose value changed, was added or removed. */
export function weightDiff(before: Record<string, number> | null | undefined, after: Record<string, number> | null | undefined): { key: string; from: number | null; to: number | null }[] {
  const b = before ?? {}, a = after ?? {};
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()
    .filter((k) => Number(b[k]) !== Number(a[k]))
    .map((k) => ({ key: k, from: k in b ? Number(b[k]) : null, to: k in a ? Number(a[k]) : null }));
}

/** Strip // and /* *\/ comments (and string contents) so a source scan only sees code. */
export function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''");
}
/**
 * The source of `export function name` (or `export const name =`): from its declaration to the next top-level export (or the
 * end of the file). Conservative on purpose: non-exported helpers that follow the function are scanned with it.
 */
export function functionBody(src: string, name: string): string | null {
  const m = new RegExp(`(^|\\n)export\\s+(?:async\\s+)?function\\s+${name}\\b|(^|\\n)export\\s+const\\s+${name}\\s*[=:]`).exec(src);
  if (!m) return null;
  const next = src.indexOf('\nexport ', m.index + 1 + (m[0].startsWith('\n') ? 1 : 0));
  return src.slice(m.index, next < 0 ? src.length : next);
}
/** Protected identifiers used as property names or variables in code (comments and strings removed). */
export function protectedRefs(code: string): string[] {
  const clean = codeOnly(code);
  return PROTECTED_COLUMNS.filter((k) => new RegExp(`(?<![\\w$])${k}(?![\\w$])`).test(clean));
}
