/**
 * F02: useEngine(surface) - the engine serving an AI-flavoured surface, with its weights.
 *   const eng = useEngine('recommend');
 *   const ranked = eng.rank.coursesForGaps({ have, currentRole, targets, roleComps, courses });   // every item has reasons[]
 *   <EngineBadge engine={eng} />  <WhyThis reasons={ranked[0].reasons} />
 * Settings come from kafaa_engine_settings (public read); while they load, or if they cannot be read, the defaults serve.
 * A model request without VITE_KAFAA_MODEL_URL falls back to deterministic with status 'model_unavailable'.
 */
import { useMemo } from 'react';
import { useQuery, useRepo } from './index';
import { makeEngine, modelGatewayUrl, resolveEngine, type Engine, type Surface } from '../domain/engines';

export function useEngine(surface: Surface): Engine {
  const repo = useRepo();
  const q = useQuery('engine_settings', () => repo.get('engine_settings', surface).catch(() => null), [surface]);
  const row = q.data ?? null;
  return useMemo(() => makeEngine(resolveEngine(surface, row, modelGatewayUrl())), [surface, row]);
}
