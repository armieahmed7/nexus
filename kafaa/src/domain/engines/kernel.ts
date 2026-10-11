/**
 * F02 kernel: which engine serves a surface. Settings come from kafaa_engine_settings (admin, rpc.setEngineWeights);
 * the model slot is used only when requested AND a gateway URL exists, otherwise deterministic serves with
 * status 'model_unavailable'. Pages use useEngine(surface) from src/data, which calls makeEngine(resolveEngine(...)).
 */
import { SearchIndex, type SearchDoc } from '../search';
import { ModelGatewayEngine } from './model';
import * as Rank from './rank';
import { SkillsEngine } from './skills';
import * as Future from './future'; // FS01: transform and assess surfaces
import type { EngineKind, EngineStatus, Ranked, Surface, Weights } from './types';

export interface EngineSetting { surface: Surface; engine: EngineKind; weights: Weights }
export const DEFAULT_SETTINGS: Record<Surface, EngineSetting> = {
  skills: { surface: 'skills', engine: 'deterministic', weights: { half_life_months: 36, half_life_fast: 18, half_life_slow: 60 } }, // FS03: per-class half-lives (months)
  recommend: { surface: 'recommend', engine: 'deterministic', weights: { ...Rank.DEFAULT_RECOMMEND } },
  match: { surface: 'match', engine: 'deterministic', weights: { ...Rank.DEFAULT_MATCH } },
  search: { surface: 'search', engine: 'deterministic', weights: { title: 3, k1: 1.4, b: 0.7 } },
  // FS01: defaults only (not stored in kafaa_engine_settings); the model slot serves only when a gateway exists.
  transform: { surface: 'transform', engine: 'deterministic', weights: { ...Future.DEFAULT_TRANSFORM } },
  assess: { surface: 'assess', engine: 'deterministic', weights: { ...Future.DEFAULT_ASSESS } },
};
export interface ResolvedEngine {
  surface: Surface;
  /** What the admin asked for. */
  requested: EngineKind;
  /** What actually serves. */
  kind: EngineKind;
  status: EngineStatus;
  weights: Weights;
}
export function resolveEngine(surface: Surface, setting?: { engine?: string | null; weights?: unknown } | null, modelUrl: string | null = null): ResolvedEngine {
  const def = DEFAULT_SETTINGS[surface];
  const requested: EngineKind = setting?.engine === 'model' ? 'model' : 'deterministic';
  const raw = setting?.weights && typeof setting.weights === 'object' ? (setting.weights as Weights) : {};
  const weights = { ...def.weights, ...Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) };
  if (requested === 'model' && !modelUrl) return { surface, requested, kind: 'deterministic', status: 'model_unavailable', weights };
  return { surface, requested, kind: requested, status: 'active', weights };
}

export interface Engine extends ResolvedEngine {
  /** Deterministic strategies with this surface's weights bound where they take weights. */
  rank: {
    byGapClosure: <T>(c: Rank.GapCandidate<T>[], n: Rank.GapNeed[]) => Ranked<T>[];
    byCoOccurrence: typeof Rank.byCoOccurrence;
    byCosine: typeof Rank.byCosine;
    careerMoves: (i: Omit<Parameters<typeof Rank.careerMoves>[0], 'weights'>) => ReturnType<typeof Rank.careerMoves>;
    coursesForGaps: <C extends { id: string; competency_ids: string[]; qualifying?: boolean | null; duration_hours?: number | null }>(i: Omit<Parameters<typeof Rank.coursesForGaps<C>>[0], 'weights'>) => Ranked<C>[];
    readiness: (have: Map<string, number>, rc: Parameters<typeof Rank.readiness>[1], roleId: string) => ReturnType<typeof Rank.readiness>;
    cosine: typeof Rank.cosine;
  };
  skills: typeof SkillsEngine;
  /** FS01: task exposure (transform) and adaptive item selection (assess) with this surface's weights. */
  future: {
    taskExposure: (t: Future.TaskExposureInput) => ReturnType<typeof Future.taskExposure>;
    nextItem: (history: Future.AssessAnswer[]) => Future.NextItem;
  };
  /** BM25 index over any bilingual documents (the SearchEngine). */
  search: <D extends SearchDoc>(docs: D[]) => SearchIndex<D>;
  model: ModelGatewayEngine;
  /** Run the model slot when it serves this surface, else (or on any model failure) the deterministic function. Never throws for a missing model. */
  run: <T>(deterministic: () => Ranked<T>[], payload?: { candidates: unknown[]; context?: unknown }) => Promise<{ results: Ranked<T>[]; kind: EngineKind; status: EngineStatus }>;
}
export function makeEngine(r: ResolvedEngine, model = new ModelGatewayEngine()): Engine {
  const ws = r.weights;
  return {
    ...r,
    rank: {
      byGapClosure: (c, n) => Rank.byGapClosure(c, n, ws),
      byCoOccurrence: Rank.byCoOccurrence,
      byCosine: Rank.byCosine,
      careerMoves: (i) => Rank.careerMoves({ ...i, weights: ws }),
      coursesForGaps: (i) => Rank.coursesForGaps({ ...i, weights: ws }),
      readiness: (h, rc, id) => Rank.readiness(h, rc, id, ws),
      cosine: Rank.cosine,
    },
    skills: SkillsEngine,
    future: {
      taskExposure: (t) => Future.taskExposure(t, { ...Future.DEFAULT_TRANSFORM, ...ws }),
      nextItem: (h) => Future.nextItem(h, { ...Future.DEFAULT_ASSESS, ...ws }),
    },
    search: (docs) => new SearchIndex(docs),
    model,
    run: async (deterministic, payload) => {
      if (r.kind === 'model' && model.available && payload) {
        try {
          return { results: (await model.rank(r.surface, payload.candidates, payload.context)) as never, kind: 'model', status: 'active' };
        } catch {
          return { results: deterministic(), kind: 'deterministic', status: 'model_unavailable' };
        }
      }
      return { results: deterministic(), kind: 'deterministic', status: r.status };
    },
  };
}
