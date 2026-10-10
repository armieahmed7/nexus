/**
 * FS01 (future skills, wave A): deterministic defaults for the two new engine surfaces. Import-free apart from types.
 *   transform  task exposure for role transformation (FS06/FS11/FS12): an AI capability level per task (1-5, OECD AI
 *              Capability Indicators) compared with the human requirement (1-5) gives automatable / augmentable / human-led.
 *   assess     adaptive item selection for future-skills checks (FS10/FS21): a staircase over levels 1-4 with a stopping rule.
 * Both return reasons[] (lintRanked-compatible) and run behind the kernel, so the disabled ModelGatewayEngine slot can take
 * over only when a gateway exists. Settings for these surfaces are not stored yet (kafaa_engine_settings.surface keeps its
 * four values; widening its check would need a drop), so DEFAULT_TRANSFORM / DEFAULT_ASSESS always serve.
 */
import type { Ranked, Reason, Weights } from './types';

export const DEFAULT_TRANSFORM: Weights = { augment_gap: 1, human_floor: 5, horizon_2030: 1, horizon_2035: 0.6 };
export const DEFAULT_ASSESS: Weights = { start_level: 2, up_after: 2, down_after: 1, min_items: 6, max_items: 12, stop_streak: 4 };

export type ExposureClass = 'automatable' | 'augmentable' | 'human_led';
export interface TaskExposureInput {
  id: string;
  /** AI capability needed by the task on the OECD five-level scale (1 low ... 5 high). */
  ai_level: number;
  /** Human requirement for the task on the same five-level scale. */
  human_level: number;
  horizon?: '2030' | '2035';
  /** Safety-critical tasks (licensed decisions, reactivity, emergency actions) always keep a qualified human in charge. */
  safety_critical?: boolean;
}
const R = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `common.engines.reason.${code}`, vars });
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Exposure of one task: score 0-1 (share of the human requirement the AI capability covers, discounted by horizon). */
export function taskExposure(t: TaskExposureInput, w: Weights = DEFAULT_TRANSFORM): Ranked<{ cls: ExposureClass }> {
  const ai = clamp(Math.round(t.ai_level), 1, 5);
  const human = clamp(Math.round(t.human_level), 1, 5);
  const hz = t.horizon === '2035' ? (w.horizon_2035 ?? 0.6) : (w.horizon_2030 ?? 1);
  const score = Math.round(clamp(ai / human, 0, 1) * hz * 1000) / 1000;
  const reasons: Reason[] = [R('fs_exposure_levels', { ai, human })];
  let cls: ExposureClass;
  if (t.safety_critical) {
    cls = 'human_led';
    reasons.push(R('fs_exposure_safety'));
  } else if (ai >= human && human < (w.human_floor ?? 5)) {
    cls = 'automatable';
    reasons.push(R('fs_exposure_automatable'));
  } else if (ai >= human - (w.augment_gap ?? 1)) {
    cls = 'augmentable';
    reasons.push(R('fs_exposure_augmentable'));
  } else {
    cls = 'human_led';
    reasons.push(R('fs_exposure_human'));
  }
  if (t.horizon === '2035') reasons.push(R('fs_exposure_horizon', { year: 2035 }));
  return { id: t.id, score, reasons, item: { cls } };
}

export interface AssessAnswer {
  level: number;
  correct: boolean;
}
export interface NextItem {
  level: 1 | 2 | 3 | 4;
  done: boolean;
  /** Highest level answered correctly at least `up_after` times (0 when none yet). */
  estimate: number;
  reasons: Reason[];
}
/** Staircase item selection: up after `up_after` correct in a row at a level, down after `down_after` wrong; stops at
 *  max_items, or after min_items once the level has not moved for `stop_streak` answers. Deterministic and explainable. */
export function nextItem(history: AssessAnswer[], w: Weights = DEFAULT_ASSESS): NextItem {
  const up = Math.max(1, w.up_after ?? 2);
  const down = Math.max(1, w.down_after ?? 1);
  let level = clamp(Math.round(w.start_level ?? 2), 1, 4);
  let right = 0;
  let wrong = 0;
  let still = 0;
  const reasons: Reason[] = [];
  for (const a of history) {
    const before = level;
    if (a.correct) {
      right++;
      wrong = 0;
      if (right >= up && level < 4) { level++; right = 0; }
    } else {
      wrong++;
      right = 0;
      if (wrong >= down && level > 1) { level--; wrong = 0; }
    }
    still = level === before ? still + 1 : 0;
  }
  const byLevel = new Map<number, number>();
  for (const a of history) if (a.correct) byLevel.set(a.level, (byLevel.get(a.level) ?? 0) + 1);
  const estimate = Math.max(0, ...[...byLevel].filter(([, n]) => n >= up).map(([l]) => l));
  const n = history.length;
  const done = n >= (w.max_items ?? 12) || (n >= (w.min_items ?? 6) && still >= (w.stop_streak ?? 4));
  reasons.push(R(history.length ? (history[history.length - 1].correct ? 'fs_assess_up' : 'fs_assess_down') : 'fs_assess_start', { level }));
  if (done) reasons.push(R('fs_assess_done', { n, estimate }));
  return { level: level as 1 | 2 | 3 | 4, done, estimate, reasons };
}
