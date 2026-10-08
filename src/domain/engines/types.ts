/**
 * F02 engine kernel: shared types. Import-free (node seed scripts load the domain files directly).
 * Every ranked result carries reasons[]: i18n keys with variables, rendered by <WhyThis> in English or Arabic.
 */
export interface BiText {
  en: string;
  ar: string;
}
/** A human-readable explanation. `key` is a full i18n key (e.g. 'common.engines.reason.gap'); bilingual vars are picked per language. */
export interface Reason {
  code: string;
  key: string;
  vars?: Record<string, string | number | BiText>;
  /** The record the reason points at (evidence row, course, role ...). */
  ref?: { table: string; id: string };
  /** Contribution to the score, when the strategy is additive. */
  weight?: number;
}
export interface Ranked<T = unknown> {
  id: string;
  score: number;
  reasons: Reason[];
  item?: T;
}
/** AI-flavoured surfaces that pages request with useEngine(surface). */
export type Surface = 'skills' | 'recommend' | 'match' | 'search';
export const SURFACES: Surface[] = ['skills', 'recommend', 'match', 'search'];
export type EngineKind = 'deterministic' | 'model';
/** active: the requested engine serves; model_unavailable: model requested but no gateway, deterministic serves instead. */
export type EngineStatus = 'active' | 'model_unavailable';
export type Weights = Record<string, number>;
