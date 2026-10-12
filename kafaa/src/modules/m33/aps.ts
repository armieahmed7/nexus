// FS58 Adaptive problem-solving practice (M33 Human Skills Studio, FS wave F · E5): the pure rules shared by the pages, the LocalBackend
// and the seed builder, mirrored 1:1 by SQL in supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql (kafaa_aps_*).
// PIAAC-style practice (OECD Survey of Adult Skills, Cycle 2, adaptive problem solving: problems whose goals or information change
// mid-task): a scenario runs in stages. The first stage sets the plan; every later stage reveals a change (a schedule slip, data that
// disagree, a delayed part) only after the person has committed to the earlier plan, so they must notice what matters now and revise
// the plan, or keep it when the change does not matter. Each stage: "which of these facts matter now?" (monitoring) and "what do you do
// now?" (plan or adaptation, expert effectiveness 0-3 per option). Scored on its own 0-100 practice scale with four bands; never the
// PIAAC scale, never converted to it, never a qualification gate, never skill evidence; results are Own only, HR sees suppressed
// aggregates. No plant-security content (the restricted word list is checked on every scenario).
// Import-free except `import type`.
import type { Reason } from '../../domain/engines/types';

export const APS_THEMES = ['outage_schedule', 'conflicting_data', 'supply_delay', 'staffing_change', 'weather_logistics', 'procedure_revision', 'digital_tool_outage', 'priority_conflict'] as const;
export type ApsTheme = (typeof APS_THEMES)[number];
export const APS_DIMS = ['plan', 'monitor', 'adapt'] as const;
export type ApsDim = (typeof APS_DIMS)[number];
/** A plan or adaptation choice weighs as much as two fact judgements per effectiveness point (3 points x 2 = 6 per stage). */
export const OPTION_WEIGHT = 2;
export const MAX_EFF = 3;
export const MIN_STAGES = 2;
export const MAX_STAGES = 4;
export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 4;
export const MIN_CUES = 3;
export const MAX_CUES = 5;
/** Practice scale bands (score 0-100). Kafa'a's own development scale, not PIAAC proficiency levels. */
export const APS_BANDS = [
  { id: 'emerging', min: 0, max: 39 },
  { id: 'developing', min: 40, max: 59 },
  { id: 'adaptive', min: 60, max: 79 },
  { id: 'strategic', min: 80, max: 100 },
] as const;
export type ApsBand = (typeof APS_BANDS)[number]['id'];
export const BAND_NAME: Record<ApsBand, { en: string; ar: string }> = {
  emerging: { en: 'Emerging', ar: 'في البداية' },
  developing: { en: 'Developing', ar: 'قيد التطوير' },
  adaptive: { en: 'Adaptive', ar: 'متكيّف' },
  strategic: { en: 'Strategic', ar: 'استراتيجي' },
};
export const DIM_NAME: Record<ApsDim, { en: string; ar: string }> = {
  plan: { en: 'Setting the first plan', ar: 'وضع الخطة الأولى' },
  monitor: { en: 'Noticing what matters', ar: 'ملاحظة ما يهم' },
  adapt: { en: 'Revising the plan when things change', ar: 'مراجعة الخطة عند تغيّر الظروف' },
};
export const THEME_NAME: Record<ApsTheme, { en: string; ar: string }> = {
  outage_schedule: { en: 'Outage schedule slip', ar: 'تأخر جدول الصيانة الدورية' },
  conflicting_data: { en: 'Data that disagree', ar: 'بيانات متعارضة' },
  supply_delay: { en: 'Supply delay', ar: 'تأخر التوريد' },
  staffing_change: { en: 'Staffing change', ar: 'تغيّر في الطاقم' },
  weather_logistics: { en: 'Weather and logistics', ar: 'الطقس والخدمات اللوجستية' },
  procedure_revision: { en: 'Procedure revised mid-job', ar: 'تعديل الإجراء أثناء العمل' },
  digital_tool_outage: { en: 'Digital tool outage', ar: 'تعطل أداة رقمية' },
  priority_conflict: { en: 'Competing priorities', ar: 'أولويات متنافسة' },
};
/** Plant-security wording never appears in a scenario (same list as SQL kafaa_aps_problem; FS26 list plus a few). */
export const APS_RESTRICTED = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection',
  'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address', 'patrol route', 'badge reader'];

export interface ApsOption { en: string; ar: string; eff: number; note_en: string; note_ar: string; keep?: boolean }
export interface ApsCue { en: string; ar: string; relevant: boolean }
export interface ApsStage {
  id: string; kind: 'initial' | 'change'; info_en: string; info_ar: string; question_en: string; question_ar: string;
  options: ApsOption[]; cues: ApsCue[]; debrief_en: string; debrief_ar: string;
}
export interface ApsScenario {
  id: string; code: string; theme: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; context_en: string; context_ar: string;
  core_skill_ids: string[]; skill_ids: string[]; difficulty: number; est_minutes: number; stages: ApsStage[]; status: string; version?: number; sort: number;
}
/** A stage as served to the person: never the effectiveness, notes, keep flag, relevance or debrief until they answer. */
export interface ApsStageView {
  id: string; kind: string; info_en: string; info_ar: string; question_en: string; question_ar: string;
  options: { en: string; ar: string }[]; cues: { en: string; ar: string }[];
}
export interface ApsResponse { stage_id: string; kind: string; choice: number; picks: number[]; eff: number; cue_ok: number; cue_n: number; kept: boolean; best_keep: boolean }
export interface ApsFeedback {
  stage_id: string; kind: string; choice: number; eff: number; best: number; effs: number[]; notes_en: string[]; notes_ar: string[];
  relevant: boolean[]; picks: number[]; cue_ok: number; cue_n: number; kept: boolean; best_keep: boolean; debrief_en: string; debrief_ar: string;
}
export interface ApsDimScore { pts: number; max: number; pct: number | null }
export interface ApsScore { points: number; max_points: number; score: number; band: ApsBand; dims: Record<ApsDim, ApsDimScore>; reasons: Reason[] }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Round half up, integers only (SQL kafaa_aps_pct). */
export const apsPct = (pts: number, max: number) => (max > 0 ? Math.floor((200 * pts + max) / (2 * max)) : 0);
export const bandOf = (score: number): ApsBand => (score >= 80 ? 'strategic' : score >= 60 ? 'adaptive' : score >= 40 ? 'developing' : 'emerging');
export const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterShift(q: string, k: number): string {
  const [y, n] = q.split('-Q').map(Number);
  const i = y * 4 + (n - 1) + k;
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}
export const windowQuarters = (today: string) => [3, 2, 1, 0].map((k) => quarterShift(quarterOf(today), -k));
/** Sum of the id's character codes: spreads first scenarios across the bank (SQL kafaa_sjt_seed, shared with FS26). */
export const personSeed = (id: string) => Array.from(id).reduce((s, ch) => s + ch.charCodeAt(0), 0);
export const changeCount = (s: Pick<ApsScenario, 'stages'>) => (s.stages ?? []).filter((x) => x.kind === 'change').length;
export const bestOf = (effs: number[]) => effs.indexOf(Math.max(...effs.map(Number)));

export function stageView(st: ApsStage): ApsStageView {
  return {
    id: st.id, kind: st.kind, info_en: st.info_en, info_ar: st.info_ar, question_en: st.question_en, question_ar: st.question_ar,
    options: st.options.map((o) => ({ en: o.en, ar: o.ar })), cues: (st.cues ?? []).map((c) => ({ en: c.en, ar: c.ar })),
  };
}

/** Normalise the facts picked as "matters now": distinct integers inside the cue list, sorted. Null when invalid. */
export function normPicks(picks: unknown, cueCount: number): number[] | null {
  if (picks == null) return [];
  if (!Array.isArray(picks)) return null;
  const out = new Set<number>();
  for (const p of picks) {
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p >= cueCount) return null;
    out.add(p);
  }
  return [...out].sort((a, b) => a - b);
}

/** The person's answer to one stage, judged against the key: effectiveness of the chosen option, facts judged correctly, keep flags. */
export function judgeStage(st: ApsStage, choice: number, picks: number[]): ApsFeedback {
  const effs = st.options.map((o) => Number(o.eff));
  const best = bestOf(effs);
  const relevant = (st.cues ?? []).map((c) => !!c.relevant);
  const set = new Set(picks);
  const cueOk = relevant.reduce((n, r, i) => n + ((r === set.has(i)) ? 1 : 0), 0);
  return {
    stage_id: st.id, kind: st.kind, choice, eff: effs[choice], best, effs, notes_en: st.options.map((o) => o.note_en), notes_ar: st.options.map((o) => o.note_ar),
    relevant, picks: [...picks], cue_ok: cueOk, cue_n: relevant.length, kept: !!st.options[choice]?.keep, best_keep: !!st.options[best]?.keep,
    debrief_en: st.debrief_en, debrief_ar: st.debrief_ar,
  };
}
export const responseOf = (fb: ApsFeedback): ApsResponse => ({
  stage_id: fb.stage_id, kind: fb.kind, choice: fb.choice, picks: [...fb.picks], eff: fb.eff, cue_ok: fb.cue_ok, cue_n: fb.cue_n, kept: fb.kept, best_keep: fb.best_keep,
});

/**
 * Score a finished scenario. plan = the initial stage choice(s), adapt = the change stages' choices (effectiveness x OPTION_WEIGHT),
 * monitor = facts judged correctly. Overall = round half up of 100 x points / max points; band from the score. Reasons: the score and
 * band, the strongest dimension and the one to develop (when they differ), how many changes were handled well (effectiveness 2 or 3),
 * whether a needed revision was missed (kept the plan when the best answer changed it) or a plan was changed when the change did not
 * matter, and that the result is private and never gates a qualification.
 */
export function scoreAps(responses: ApsResponse[]): ApsScore {
  const dims: Record<ApsDim, ApsDimScore> = { plan: { pts: 0, max: 0, pct: null }, monitor: { pts: 0, max: 0, pct: null }, adapt: { pts: 0, max: 0, pct: null } };
  for (const r of responses) {
    const d = r.kind === 'change' ? dims.adapt : dims.plan;
    d.pts += Number(r.eff) * OPTION_WEIGHT;
    d.max += MAX_EFF * OPTION_WEIGHT;
    dims.monitor.pts += Number(r.cue_ok);
    dims.monitor.max += Number(r.cue_n);
  }
  for (const k of APS_DIMS) dims[k].pct = dims[k].max > 0 ? apsPct(dims[k].pts, dims[k].max) : null;
  const points = dims.plan.pts + dims.monitor.pts + dims.adapt.pts;
  const max = dims.plan.max + dims.monitor.max + dims.adapt.max;
  const score = apsPct(points, max);
  const band = bandOf(score);
  const reasons: Reason[] = [{ code: 'aps_score', key: 'm33.aps.reason.score', vars: { score, band: BAND_NAME[band] } }];
  const ranked = APS_DIMS.filter((k) => dims[k].pct != null).map((k, i) => ({ k, pct: dims[k].pct as number, i }));
  if (ranked.length > 1) {
    const strong = [...ranked].sort((a, b) => b.pct - a.pct || a.i - b.i)[0];
    const dev = [...ranked].sort((a, b) => a.pct - b.pct || a.i - b.i)[0];
    if (strong.pct > dev.pct) {
      reasons.push({ code: 'aps_strong', key: 'm33.aps.reason.strong', vars: { dim: DIM_NAME[strong.k], pct: strong.pct } });
      reasons.push({ code: 'aps_develop', key: 'm33.aps.reason.develop', vars: { dim: DIM_NAME[dev.k], pct: dev.pct } });
    }
  }
  const changes = responses.filter((r) => r.kind === 'change');
  if (changes.length) reasons.push({ code: 'aps_changes', key: 'm33.aps.reason.changes', vars: { ok: changes.filter((r) => Number(r.eff) >= 2).length, n: changes.length } });
  if (changes.some((r) => r.kept && !r.best_keep)) reasons.push({ code: 'aps_held', key: 'm33.aps.reason.held' });
  if (changes.some((r) => !r.kept && r.best_keep)) reasons.push({ code: 'aps_overreact', key: 'm33.aps.reason.overreact' });
  reasons.push({ code: 'aps_private', key: 'm33.aps.reason.private' });
  return { points, max_points: max, score, band, dims, reasons };
}

/**
 * Which scenario to practise next when the person does not choose: published scenarios in bank order, rotated by the person's seed and
 * the attempt number, the ones I have finished least often first (SQL kafaa_aps_pick). Deterministic.
 */
export function pickScenario(scenarios: Pick<ApsScenario, 'id' | 'status' | 'sort'>[], done: Map<string, number>, attemptNo: number, seed: number): string | null {
  const pool = scenarios.filter((s) => s.status === 'published').sort((a, b) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id));
  const N = pool.length;
  if (!N) return null;
  const off = ((seed + (attemptNo - 1)) % N + N) % N;
  return pool.map((s, i) => ({ id: s.id, c: done.get(s.id) ?? 0, r: (i - off + N) % N })).sort((a, b) => a.c - b.c || a.r - b.r)[0].id;
}

/** Why a scenario is suggested next (SQL kafaa_aps_next_reasons). Ranks content, never people. */
export function nextReasons(sc: Pick<ApsScenario, 'theme' | 'stages'>, mine: number): Reason[] {
  return [
    { code: 'aps_next', key: 'm33.aps.reason.next', vars: { theme: THEME_NAME[sc.theme as ApsTheme] ?? { en: sc.theme, ar: sc.theme }, n: mine } },
    { code: 'aps_next_changes', key: 'm33.aps.reason.nextChanges', vars: { changes: changeCount(sc) } },
  ];
}

// ───────────── Scenario bank rules (training manager; secure_items A)
export type ApsProblem = 'code' | 'theme' | 'text' | 'core_skill' | 'skills' | 'difficulty' | 'minutes' | 'stages' | 'first_stage' | 'no_change' | 'stage_text'
  | 'options' | 'key' | 'keep' | 'cues' | 'restricted' | 'status';
export interface ApsScenarioInput {
  id?: string | null; code: string; theme: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; context_en: string; context_ar: string;
  core_skill_ids: string[]; skill_ids: string[]; difficulty: number; est_minutes: number; stages: ApsStage[]; status?: string;
}
const txt = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
const isInt = (x: unknown) => typeof x === 'number' && Number.isInteger(x);
/** Every texts' lower-case join (for the restricted-word check; SQL concatenates the same fields in the same order). */
export function apsAllText(s: Partial<ApsScenarioInput>): string {
  const parts: string[] = [s.title_en ?? '', s.title_ar ?? '', s.summary_en ?? '', s.summary_ar ?? '', s.context_en ?? '', s.context_ar ?? ''];
  for (const st of Array.isArray(s.stages) ? s.stages : []) {
    parts.push(st?.info_en ?? '', st?.info_ar ?? '', st?.question_en ?? '', st?.question_ar ?? '', st?.debrief_en ?? '', st?.debrief_ar ?? '');
    for (const o of Array.isArray(st?.options) ? st.options : []) parts.push(o?.en ?? '', o?.ar ?? '', o?.note_en ?? '', o?.note_ar ?? '');
    for (const c of Array.isArray(st?.cues) ? st.cues : []) parts.push(c?.en ?? '', c?.ar ?? '');
  }
  return parts.map((p) => String(p)).join(' ').toLowerCase();
}
/**
 * The first problem with a scenario, or null (SQL kafaa_aps_problem). Rules: code APS-XX-000; a known theme; title, summary and context
 * in English and Arabic; 1-3 active core skills and 1-4 catalogue skills (existing, not obsolete); difficulty 1-3; 5-30 minutes; 2-4
 * stages; the first stage is the initial plan and AT LEAST ONE LATER STAGE IS A MID-TASK CHANGE (FS58 acceptance); every stage has its
 * texts in both languages, 3-4 options with effectiveness 0-3 and exactly one best (3) and a why in both languages; only change stages
 * may mark one option as "keep the plan"; facts to judge are none or 3-5, with at least one that matters and one that does not; no
 * plant-security wording; status draft, published or retired.
 */
export function apsScenarioProblem(s: Partial<ApsScenarioInput> | null | undefined, ctx: { coreSkillIds: string[]; skillIds: string[] }): ApsProblem | null {
  if (!s || typeof s.code !== 'string' || !/^APS-[A-Z]{2}-\d{3}$/.test(s.code)) return 'code';
  if (typeof s.theme !== 'string' || !(APS_THEMES as readonly string[]).includes(s.theme)) return 'theme';
  if (!txt(s.title_en, 140) || !txt(s.title_ar, 140) || !txt(s.summary_en, 400) || !txt(s.summary_ar, 400) || !txt(s.context_en, 1200) || !txt(s.context_ar, 1200)) return 'text';
  const cs = s.core_skill_ids;
  if (!Array.isArray(cs) || cs.length < 1 || cs.length > 3 || !cs.every((x) => typeof x === 'string' && ctx.coreSkillIds.includes(x))) return 'core_skill';
  const sk = s.skill_ids;
  if (!Array.isArray(sk) || sk.length < 1 || sk.length > 4 || !sk.every((x) => typeof x === 'string' && ctx.skillIds.includes(x))) return 'skills';
  if (!isInt(s.difficulty) || (s.difficulty as number) < 1 || (s.difficulty as number) > 3) return 'difficulty';
  if (!isInt(s.est_minutes) || (s.est_minutes as number) < 5 || (s.est_minutes as number) > 30) return 'minutes';
  const stages = s.stages;
  if (!Array.isArray(stages) || stages.length < MIN_STAGES || stages.length > MAX_STAGES) return 'stages';
  if (stages[0]?.kind !== 'initial' || !stages.every((st, i) => st && typeof st.id === 'string' && /^[a-z0-9-]{1,24}$/.test(st.id) && (i === 0 || st.kind === 'change' || st.kind === 'initial'))
    || new Set(stages.map((st) => st.id)).size !== stages.length) return 'first_stage';
  if (!stages.slice(1).some((st) => st.kind === 'change') || stages.slice(1).some((st) => st.kind !== 'change')) return 'no_change';
  for (const st of stages) {
    if (!txt(st.info_en, 900) || !txt(st.info_ar, 900) || !txt(st.question_en, 300) || !txt(st.question_ar, 300) || !txt(st.debrief_en, 900) || !txt(st.debrief_ar, 900)) return 'stage_text';
    const o = st.options;
    if (!Array.isArray(o) || o.length < MIN_OPTIONS || o.length > MAX_OPTIONS || !o.every((x) => x && txt(x.en, 300) && txt(x.ar, 300) && txt(x.note_en, 400) && txt(x.note_ar, 400))) return 'options';
    if (!o.every((x) => isInt(x.eff) && x.eff >= 0 && x.eff <= MAX_EFF) || o.filter((x) => x.eff === MAX_EFF).length !== 1) return 'key';
    const keeps = o.filter((x) => x.keep === true).length;
    if ((st.kind === 'initial' && keeps > 0) || keeps > 1 || !o.every((x) => x.keep === undefined || x.keep === null || typeof x.keep === 'boolean')) return 'keep';
    const c = st.cues ?? [];
    if (!Array.isArray(c) || (c.length > 0 && (c.length < MIN_CUES || c.length > MAX_CUES)) || !c.every((x) => x && txt(x.en, 240) && txt(x.ar, 240) && typeof x.relevant === 'boolean')
      || (c.length > 0 && (!c.some((x) => x.relevant) || !c.some((x) => !x.relevant)))) return 'cues';
  }
  const all = apsAllText(s);
  if (APS_RESTRICTED.some((w) => all.includes(w))) return 'restricted';
  if (s.status !== undefined && s.status !== null && !['draft', 'published', 'retired'].includes(String(s.status))) return 'status';
  return null;
}

// ───────────── HR aggregate (skills_profile Agg): suppressed under 10, never a person
export interface ApsAttemptLite { id?: string; person_id: string; scenario_id: string; status: string; period: string; score: number | null; band: string | null; dims: Record<string, ApsDimScore> | null; completed_at?: string | null; started_at?: string | null }
export interface ApsStats {
  participants: number | null;
  attempts: number | null;
  avg: number | null;
  bands: { band: ApsBand; people: number | null }[];
  dims: { dim: ApsDim; pct: number | null }[];
  by_quarter: { period: string; people: number | null; attempts: number | null; avg: number | null }[];
  by_theme: { theme: string; people: number | null; avg: number | null }[];
}
const avgPts = (xs: { pts: number; max: number }[]) => { const p = xs.reduce((s, x) => s + Number(x.pts), 0); const m = xs.reduce((s, x) => s + Number(x.max), 0); return m > 0 ? apsPct(p, m) : null; };
/** Completed attempts by active staff in the last four quarters. Average = pooled points over pooled max (not a mean of scores). Bands
 *  count each person once, by their latest completed attempt. Every cell under minGroup people is suppressed (null). */
export function apsStats(attempts: (ApsAttemptLite & { points?: number | null; max_points?: number | null })[], people: { id: string; kind: string; status: string }[],
  scenarios: { id: string; theme: string }[], today: string, minGroup: number): ApsStats {
  const staff = new Set(people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id));
  const win = windowQuarters(today);
  const done = attempts.filter((a) => a.status === 'completed' && staff.has(a.person_id) && win.includes(a.period) && a.score != null && a.max_points != null);
  const ppl = new Set(done.map((a) => a.person_id));
  const ok = ppl.size >= minGroup;
  const pool = (xs: typeof done) => avgPts(xs.map((a) => ({ pts: Number(a.points), max: Number(a.max_points) })));
  const latest = new Map<string, (typeof done)[number]>();
  for (const a of [...done].sort((x, y) => cmp(String(x.completed_at ?? ''), String(y.completed_at ?? '')) || cmp(x.period, y.period) || cmp(String(x.id ?? ''), String(y.id ?? '')))) latest.set(a.person_id, a);
  const themeOf = new Map(scenarios.map((s) => [s.id, s.theme]));
  return {
    participants: ok ? ppl.size : null,
    attempts: ok ? done.length : null,
    avg: ok ? pool(done) : null,
    bands: APS_BANDS.map((b) => { const n = [...latest.values()].filter((a) => a.band === b.id).length; return { band: b.id, people: ok && n >= minGroup ? n : null }; }),
    dims: APS_DIMS.map((d) => ({ dim: d, pct: ok ? avgPts(done.map((a) => a.dims?.[d] ?? { pts: 0, max: 0 })) : null })),
    by_quarter: win.map((q) => {
      const xs = done.filter((a) => a.period === q);
      const p = new Set(xs.map((a) => a.person_id)).size;
      const big = p >= minGroup;
      return { period: q, people: big ? p : null, attempts: big ? xs.length : null, avg: big ? pool(xs) : null };
    }),
    by_theme: [...APS_THEMES].map((th) => {
      const xs = done.filter((a) => themeOf.get(a.scenario_id) === th);
      const p = new Set(xs.map((a) => a.person_id)).size;
      const big = p >= minGroup;
      return { theme: th, people: big ? p : null, avg: big ? pool(xs) : null };
    }),
  };
}
