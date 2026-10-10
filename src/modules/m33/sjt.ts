// FS26 Situational judgement practice for core skills (M33 Human Skills Studio, FS wave C · E5): the pure rules shared by the pages,
// the LocalBackend and the seed builder, mirrored 1:1 by SQL in supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql (kafaa_sjt_*).
// Practice, never a test: every option carries an expert effectiveness rating (0 counterproductive, 1 weak, 2 acceptable, 3 the expert's
// best response) and a short why, every item an expert rationale in English and Arabic. The person picks what they would do; the server
// reveals the key after each answer. Results stay with the person (Own), never gate anything, never write skill evidence and never reach
// talent review; HR sees suppressed aggregates only. No points, streaks, badges or leaderboards.
// Import-free except `import type`.
import type { Reason } from '../../domain/engines/types';

export const SET_SIZE = 8;
export const MAX_EFF = 3;
export const OPTION_COUNT = 4;
export const MIN_ACTIVE_PER_SKILL = 2;
export const THEMES = ['conservative_decisions', 'questioning', 'raising_concerns', 'teamwork_pressure', 'procedure_use', 'learning_change', 'working_across_cultures', 'digital_judgement'] as const;
export type Theme = (typeof THEMES)[number];
/** Plant-security wording never appears in a practice item (same list as SQL kafaa_sjt_item_problem). */
export const RESTRICTED = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection',
  'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address'];

export interface SjtItem {
  id: string; core_skill_id: string; theme: string; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[];
  expert_key: number[]; notes_en: string[]; notes_ar: string[]; rationale_en: string; rationale_ar: string; status: string; sort: number;
}
/** An item as served to the person: never the key, notes or rationale until they answer. */
export interface SjtItemView { id: string; core_skill_id: string; theme: string; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[] }
export interface SjtResponse { item_id: string; core_skill_id: string; choice: number; eff: number }
export interface SjtFeedback {
  item_id: string; choice: number; eff: number; best: number; key: number[]; notes_en: string[]; notes_ar: string[]; rationale_en: string; rationale_ar: string;
}
export interface SjtScore { score: number; by_skill: Record<string, { n: number; sum: number }>; reasons: Reason[] }
export interface CoreName { id: string; name_en: string; name_ar: string; sort: number }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const bySort = (a: Pick<SjtItem, 'sort' | 'id'>, b: Pick<SjtItem, 'sort' | 'id'>) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id);
export const itemView = (i: SjtItem): SjtItemView => ({
  id: i.id, core_skill_id: i.core_skill_id, theme: i.theme, stem_en: i.stem_en, stem_ar: i.stem_ar, options_en: [...i.options_en], options_ar: [...i.options_ar],
});
export const bestOf = (key: number[]) => key.indexOf(Math.max(...key.map(Number)));
export const scorePct = (sum: number, n: number) => (n > 0 ? Math.floor((200 * sum + MAX_EFF * n) / (2 * MAX_EFF * n)) : 0);
export const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterShift(q: string, k: number): string {
  const [y, n] = q.split('-Q').map(Number);
  const i = y * 4 + (n - 1) + k;
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}
/** The four quarters shown in trends: three before this one, then this one. */
export const windowQuarters = (today: string) => [3, 2, 1, 0].map((k) => quarterShift(quarterOf(today), -k));

/** A small per-person number that spreads first sets across the bank (sum of the id's character codes; SQL kafaa_sjt_seed). */
export const personSeed = (id: string) => Array.from(id).reduce((s, ch) => s + ch.charCodeAt(0), 0);
/**
 * The practice set: active items (all, or one core skill's), in bank order, rotated by the person's seed and the attempt number so
 * successive sets start at a different place, and the items I have answered least come first. Deterministic: the same inputs always
 * give the same set (SQL kafaa_sjt_pick).
 */
export function pickSet(items: SjtItem[], answered: Map<string, number>, attemptNo: number, coreSkillId: string | null, seed = 0, n = SET_SIZE): string[] {
  const pool = items.filter((i) => i.status === 'active' && (!coreSkillId || i.core_skill_id === coreSkillId)).sort(bySort);
  const N = pool.length;
  if (!N) return [];
  const off = ((seed + (attemptNo - 1) * n) % N + N) % N;
  return pool
    .map((it, i) => ({ id: it.id, c: answered.get(it.id) ?? 0, r: (i - off + N) % N }))
    .sort((a, b) => a.c - b.c || a.r - b.r)
    .slice(0, Math.min(n, N))
    .map((x) => x.id);
}

export function feedbackOf(item: SjtItem, choice: number): SjtFeedback {
  const key = item.expert_key.map(Number);
  return {
    item_id: item.id, choice, eff: key[choice], best: bestOf(key), key, notes_en: [...item.notes_en], notes_ar: [...item.notes_ar],
    rationale_en: item.rationale_en, rationale_ar: item.rationale_ar,
  };
}

/** Score a finished set: overall %, the tally per core skill (stored on the attempt), and reasons naming the strongest and the one to develop. */
export function scoreSjt(responses: SjtResponse[], names: CoreName[]): SjtScore {
  const by: Record<string, { n: number; sum: number }> = {};
  for (const r of responses) {
    const cur = by[r.core_skill_id] ?? { n: 0, sum: 0 };
    by[r.core_skill_id] = { n: cur.n + 1, sum: cur.sum + Number(r.eff) };
  }
  const sorted: Record<string, { n: number; sum: number }> = {};
  for (const k of Object.keys(by).sort(cmp)) sorted[k] = by[k];
  const n = responses.length;
  const sum = responses.reduce((s, r) => s + Number(r.eff), 0);
  const score = scorePct(sum, n);
  const nm = (id: string) => { const c = names.find((x) => x.id === id); return { en: c?.name_en ?? id, ar: c?.name_ar ?? id }; };
  const ranked = Object.entries(sorted).map(([id, v]) => ({ id, pct: scorePct(v.sum, v.n), sort: names.find((x) => x.id === id)?.sort ?? 999 }));
  const reasons: Reason[] = [{ code: 'sjt_score', key: 'm33.sjt.reason.score', vars: { score, n, best: responses.filter((r) => Number(r.eff) === MAX_EFF).length } }];
  if (ranked.length > 1) {
    const strong = [...ranked].sort((a, b) => b.pct - a.pct || a.sort - b.sort || cmp(a.id, b.id))[0];
    const dev = [...ranked].sort((a, b) => a.pct - b.pct || a.sort - b.sort || cmp(a.id, b.id))[0];
    if (strong.pct > dev.pct) {
      reasons.push({ code: 'sjt_strong', key: 'm33.sjt.reason.strong', vars: { skill: nm(strong.id), pct: strong.pct }, ref: { table: 'core_skills', id: strong.id } });
      reasons.push({ code: 'sjt_develop', key: 'm33.sjt.reason.develop', vars: { skill: nm(dev.id), pct: dev.pct }, ref: { table: 'core_skills', id: dev.id } });
    }
  }
  reasons.push({ code: 'sjt_private', key: 'm33.sjt.reason.private' });
  return { score, by_skill: sorted, reasons };
}

// ───────────── Item bank rules (training manager)
export interface SjtItemInput {
  id?: string | null; core_skill_id: string; theme: string; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[];
  expert_key: number[]; notes_en: string[]; notes_ar: string[]; rationale_en: string; rationale_ar: string; status?: 'active' | 'retired';
}
export type SjtItemProblem = 'core_skill' | 'theme' | 'stem' | 'options' | 'key' | 'notes' | 'rationale' | 'restricted';
const txt = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
const list = (x: unknown, max: number) => Array.isArray(x) && x.length === OPTION_COUNT && x.every((s) => txt(s, max));

export function sjtItemProblem(i: (Partial<Omit<SjtItemInput, 'status'>> & { status?: string }) | null | undefined, coreSkillIds: string[]): SjtItemProblem | null {
  if (!i || typeof i.core_skill_id !== 'string' || !coreSkillIds.includes(i.core_skill_id)) return 'core_skill';
  if (typeof i.theme !== 'string' || !(THEMES as readonly string[]).includes(i.theme)) return 'theme';
  if (!txt(i.stem_en, 700) || !txt(i.stem_ar, 700)) return 'stem';
  if (!list(i.options_en, 240) || !list(i.options_ar, 240)) return 'options';
  const k = i.expert_key;
  if (!Array.isArray(k) || k.length !== OPTION_COUNT || !k.every((v) => Number.isInteger(v) && v >= 0 && v <= MAX_EFF)
    || k.filter((v) => v === MAX_EFF).length !== 1) return 'key';
  if (!list(i.notes_en, 300) || !list(i.notes_ar, 300)) return 'notes';
  if (!txt(i.rationale_en, 700) || !txt(i.rationale_ar, 700)) return 'rationale';
  const all = [i.stem_en, i.stem_ar, ...(i.options_en ?? []), ...(i.options_ar ?? []), ...(i.notes_en ?? []), i.rationale_en].join(' ').toLowerCase();
  if (RESTRICTED.some((w) => all.includes(w))) return 'restricted';
  return null;
}

// ───────────── HR aggregate (skills_profile Agg): suppressed under 10, never a person
export interface SjtAttemptLite { person_id: string; status: string; period: string; score: number | null; by_skill: Record<string, { n: number; sum: number }> }
export interface SjtStats {
  participants: number | null;
  attempts: number | null;
  avg: number | null;
  by_quarter: { period: string; people: number | null; attempts: number | null; avg: number | null }[];
  by_skill: { core_skill_id: string; people: number | null; pct: number | null }[];
}
export function sjtStats(attempts: SjtAttemptLite[], people: { id: string; kind: string; status: string }[], skills: CoreName[], today: string, minGroup: number): SjtStats {
  const staff = new Set(people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id));
  const win = windowQuarters(today);
  const done = attempts.filter((a) => a.status === 'completed' && staff.has(a.person_id) && win.includes(a.period) && a.score != null);
  const ppl = new Set(done.map((a) => a.person_id));
  const ok = ppl.size >= minGroup;
  const avgOf = (xs: SjtAttemptLite[]) => {
    const n = xs.reduce((s, a) => s + Object.values(a.by_skill ?? {}).reduce((t, v) => t + Number(v.n), 0), 0);
    const sum = xs.reduce((s, a) => s + Object.values(a.by_skill ?? {}).reduce((t, v) => t + Number(v.sum), 0), 0);
    return n > 0 ? scorePct(sum, n) : null;
  };
  return {
    participants: ok ? ppl.size : null,
    attempts: ok ? done.length : null,
    avg: ok ? avgOf(done) : null,
    by_quarter: win.map((q) => {
      const xs = done.filter((a) => a.period === q);
      const p = new Set(xs.map((a) => a.person_id)).size;
      const big = p >= minGroup;
      return { period: q, people: big ? p : null, attempts: big ? xs.length : null, avg: big ? avgOf(xs) : null };
    }),
    by_skill: [...skills].sort((a, b) => a.sort - b.sort || cmp(a.id, b.id)).map((c) => {
      const xs = done.filter((a) => a.by_skill?.[c.id]);
      const p = new Set(xs.map((a) => a.person_id)).size;
      const n = xs.reduce((s, a) => s + Number(a.by_skill[c.id].n), 0);
      const sum = xs.reduce((s, a) => s + Number(a.by_skill[c.id].sum), 0);
      const big = p >= minGroup;
      return { core_skill_id: c.id, people: big ? p : null, pct: big && n > 0 ? scorePct(sum, n) : null };
    }),
  };
}
