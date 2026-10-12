// FS72 (wave H · E1, M28) · the FS55 fairness snapshot of the "Skills you may have" surface, built with the F24 population and group
// rules (src/modules/m16/fairness.ts, read-only: active staff with a job role hired by the date; per gender and nationality, a
// comparison is suppressed whole when any group has fewer than 10 people; four-fifths flag). Outcome: people with at least one
// suggestion made on or before the date. Never an input to the suggestions themselves. SQL mirror: kafaa_ssg_fairness_compute
// (supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql, over kafaa_fairness_base / kafaa_fairness_rows).
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';
import { basePopulation, groupRows, type FairnessData, type FairnessRow } from '../m16/fairness.ts';
import { FAIRNESS, reachedBy } from './suggestions.ts';

export type SuggestFairnessRow = Omit<FairnessRow, 'metric' | 'surface'> & { metric: string; card: string };
export function suggestionFairness(people: FairnessData['people'], suggestions: { person_id: string; first_on?: string | null }[], asOf: string, minGroup = MIN_GROUP_SIZE): SuggestFairnessRow[] {
  const day = asOf.slice(0, 10);
  const reached = reachedBy(suggestions, day);
  const pop = basePopulation(people, day).map((p) => p.id);
  const byId = new Map(people.map((p) => [p.id, p as unknown as Record<string, unknown>]));
  return groupRows({ metric: FAIRNESS.metric, surface: FAIRNESS.card, source: FAIRNESS.source, people: new Map(pop.map((id) => [id, reached.has(id)] as const)) }, byId, day, minGroup, FAIRNESS.prefix)
    .map(({ surface, ...r }) => ({ ...r, metric: FAIRNESS.metric, card: surface }));
}
