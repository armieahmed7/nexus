// FS59 Role-play practice library with saved feedback (M33 Human Skills Studio, FS wave F · E5): the pure rules shared by the pages, the
// LocalBackend and the seed builder, mirrored 1:1 by SQL in supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql (kafaa_rp_*).
// ENEC-authored practice conversations (a pre-job brief, a shift turnover, raising a concern to a senior, regulator-style interview
// practice, a knowledge-transfer session, coaching a peer on an AI output). Each scenario publishes its rubric in English and Arabic:
// every criterion says what it looks for (cue words, length, a question, a number) and how to improve. The rubric is deterministic
// (extends the F37 Dalil role-play idea, re-implemented here so M13 is never edited): the same answer always gets the same ticks.
// What is kept: the ticks per turn, the word count and the summary (the feedback history), Own only. What is never kept: the answer text.
// Speak-up: an answer that reads like a real concern (harassment, retaliation, falsification, "I want to report") is not practice: the
// page and the server route it to the existing speak-up channels and store nothing (no session change, no audit row, no telemetry).
// A completed session can become evidence only after a named reviewer (recognition A) validates it: kind rating, basis validated,
// ref_table roleplay_sessions, level 1-2. Import-free except `import type`.
import type { Reason } from '../../domain/engines/types';

export const RP_KINDS = ['pre_job_brief', 'shift_turnover', 'raise_concern', 'regulator_interview', 'knowledge_transfer', 'ai_peer_coaching'] as const;
export type RpKind = (typeof RP_KINDS)[number];
export const CHECK_TYPES = ['cues', 'length', 'question', 'digit'] as const;
export type CheckType = (typeof CHECK_TYPES)[number];
export const REVIEW_STATUSES = ['none', 'requested', 'validated', 'declined', 'withdrawn'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
/** Platform roles that hold recognition A (instructor, training manager, HR authority): the reviewers who may validate a session. */
export const REVIEWER_ROLES = ['instructor', 'training_manager', 'hr_director'];
export const MIN_TURNS = 3;
export const MAX_TURNS = 5;
export const MIN_CRITERIA = 3;
export const MAX_CRITERIA = 8;
export const MAX_ANSWER = 2000;
export const MIN_ANSWER = 3;

// ───────────── Text normalisation (SQL kafaa_rp_norm): ASCII lower case only (the same on every database locale), Arabic diacritics and
// tatweel removed, alef / ya / ta marbuta / hamza forms unified, Arabic-Indic digits to Latin, every listed punctuation or space character
// to one space, padded with one space on each side.
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const AR_FROM = 'إأآٱىةؤئ٠١٢٣٤٥٦٧٨٩';
const AR_TO = 'اااايهوي0123456789';
/** Every character turned into a space (SQL translate() with the same string). */
export const RP_PUNCT = ' \t\n\r .,;:!?"\'()[]{}<>/\\|@#$%^&*+=~`_،؛؟«»…–—-';
const DIACRITIC = /[ً-ٰٟـ]/g;
/** Trim spaces only (SQL btrim), never other whitespace, so both sides agree on every input. */
const trimSp = (s: string) => s.replace(/^ +| +$/g, '');
export function rpNorm(s: string): string {
  let out = '';
  for (const ch of String(s ?? '').replace(DIACRITIC, '')) {
    const u = UPPER.indexOf(ch);
    if (u >= 0) { out += LOWER[u]; continue; }
    const a = AR_FROM.indexOf(ch);
    if (a >= 0) { out += AR_TO[a]; continue; }
    out += RP_PUNCT.includes(ch) ? ' ' : ch;
  }
  return ` ${out.replace(/ +/g, ' ').replace(/^ +| +$/g, '')} `;
}
const isPrefixCue = (cue: string) => trimSp(cue).endsWith('*');
/** The normalised words a cue looks for (its trailing "*" removed). Two cues with the same key count once. */
export const cueKey = (cue: string) => trimSp(rpNorm(isPrefixCue(cue) ? trimSp(cue).slice(0, -1) : cue));
/** A cue matches as whole words; a cue ending in "*" matches the start of a word ("escalat*" matches "escalate", "escalation"). */
export function cueHit(norm: string, cue: string): boolean {
  const q = cueKey(cue);
  if (!q) return false;
  return isPrefixCue(cue) ? norm.includes(` ${q}`) : norm.includes(` ${q} `);
}
export const wordCount = (norm: string) => (trimSp(norm) ? trimSp(norm).split(' ').length : 0);

export interface RpCheck { type: CheckType; cues?: string[]; min?: number; max?: number }
export interface RpCriterion { id: string; label_en: string; label_ar: string; desc_en: string; desc_ar: string; tip_en: string; tip_ar: string; check: RpCheck }
export interface RpTurn { id: string; prompt_en: string; prompt_ar: string; hint_en: string; hint_ar: string; example_en: string; example_ar: string; criteria: string[] }
export interface RpScenario {
  id: string; code: string; kind: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; setting_en: string; setting_ar: string;
  counterpart_en: string; counterpart_ar: string; role_en: string; role_ar: string; core_skill_ids: string[]; skill_ids: string[]; level: number; pass_pct: number;
  est_minutes: number; turns: RpTurn[]; rubric: RpCriterion[]; status: string; version?: number; sort: number;
}
export interface CriterionResult { id: string; pass: boolean }
export interface TurnResult { turn_id: string; criteria: CriterionResult[]; words: number; at?: string }

/** One rubric check on one answer (deterministic). */
export function checkPasses(c: RpCheck, raw: string, norm: string): boolean {
  if (c.type === 'cues') {
    const hits = new Set((c.cues ?? []).filter((q) => cueHit(norm, q)).map(cueKey));
    return hits.size >= Math.max(1, Number(c.min ?? 1));
  }
  if (c.type === 'length') { const w = wordCount(norm); return w >= Number(c.min ?? 0) && w <= Number(c.max ?? 100000); }
  if (c.type === 'question') return raw.includes('?') || raw.includes('؟');
  if (c.type === 'digit') return /[0-9]/.test(norm);
  return false;
}
/** Score one turn's answer against the criteria the turn names, in the turn's order. */
export function evaluateTurn(turn: Pick<RpTurn, 'id' | 'criteria'>, rubric: RpCriterion[], text: string): TurnResult {
  const norm = rpNorm(text);
  return {
    turn_id: turn.id,
    criteria: turn.criteria.map((id) => { const c = rubric.find((r) => r.id === id); return { id, pass: !!c && checkPasses(c.check, text, norm) }; }),
    words: wordCount(norm),
  };
}

// ───────────── Speak-up routing: real concerns are never practice material (SQL kafaa_rp_speak_up). The skill of raising a concern is
// practised on purpose, so generic words like "raise a concern", "report", "stop work" or "speak up" are NOT on this list: only what reads
// like a real complaint, a real incident or pressure on the person.
export const SPEAK_UP_CUES = [
  'i want to report', 'i would like to report', 'i need to report', 'make a complaint', 'file a complaint', 'formal complaint', 'whistleblow*', 'harass*', 'retaliat*',
  'intimidat*', 'bullied', 'bullying', 'bully me', 'discriminat*', 'cover up', 'covered up', 'covering up', 'falsif*', 'threatened me', 'threaten me', 'afraid to speak',
  'afraid to report', 'pressured to sign', 'pressured me', 'my supervisor told me to', 'my manager told me to', 'this really happened', 'this happened for real', 'happened to me',
  'اريد الابلاغ', 'اود الابلاغ', 'شكوي', 'شكوى', 'مضايقه*', 'انتقام', 'تحرش*', 'ترهيب', 'تمييز', 'تستر', 'تزوير', 'حدث فعلا', 'حدث معي', 'ضغط علي للتوقيع',
];
export function speakUpTopic(text: string): boolean {
  const n = rpNorm(text);
  return SPEAK_UP_CUES.some((c) => cueHit(n, c));
}

/** Session summary: criteria passed of all checked, % (round half up), pass flag against the scenario's mark, and reasons: the score, the
 *  criteria met most and least often (when they differ), and that the feedback is private. */
export interface RpSummary { passed: number; total: number; pct: number; ready: boolean; reasons: Reason[] }
export const rpPct = (a: number, b: number) => (b > 0 ? Math.floor((200 * a + b) / (2 * b)) : 0);
export function summarise(turns: TurnResult[], rubric: Pick<RpCriterion, 'id' | 'label_en' | 'label_ar'>[], passPct: number): RpSummary {
  const all = turns.flatMap((t) => t.criteria);
  const passed = all.filter((c) => c.pass).length;
  const total = all.length;
  const pct = rpPct(passed, total);
  const reasons: Reason[] = [{ code: 'rp_score', key: 'm33.rp.reason.score', vars: { passed, total, pct } }];
  const per = rubric.map((r, i) => {
    const xs = all.filter((c) => c.id === r.id);
    return { r, i, n: xs.length, p: xs.filter((c) => c.pass).length };
  }).filter((x) => x.n > 0).map((x) => ({ ...x, pct: rpPct(x.p, x.n) }));
  if (per.length > 1) {
    const strong = [...per].sort((a, b) => b.pct - a.pct || a.i - b.i)[0];
    const weak = [...per].sort((a, b) => a.pct - b.pct || a.i - b.i)[0];
    if (strong.pct > weak.pct) {
      reasons.push({ code: 'rp_strong', key: 'm33.rp.reason.strong', vars: { criterion: { en: strong.r.label_en, ar: strong.r.label_ar }, pct: strong.pct } });
      reasons.push({ code: 'rp_develop', key: 'm33.rp.reason.develop', vars: { criterion: { en: weak.r.label_en, ar: weak.r.label_ar }, pct: weak.pct } });
    }
  }
  const ready = total > 0 && pct >= passPct;
  reasons.push({ code: ready ? 'rp_ready' : 'rp_not_ready', key: ready ? 'm33.rp.reason.ready' : 'm33.rp.reason.notReady', vars: { mark: passPct } });
  reasons.push({ code: 'rp_private', key: 'm33.rp.reason.private' });
  return { passed, total, pct, ready, reasons };
}

// ───────────── Evidence: which scenario skills can carry the validated rating (existing, not obsolete, not security, not cyber hygiene).
export interface SkillLite { id: string; area?: string | null; lifecycle?: string | null; fs_area?: string | null }
export function evidenceSkills(skillIds: string[], skills: Map<string, SkillLite>): string[] {
  return [...new Set(skillIds)].filter((id) => { const s = skills.get(id); return !!s && s.lifecycle !== 'obsolete' && s.area !== 'security' && s.fs_area !== 'cyber_hygiene'; }).sort();
}
export const evidenceId = (sessionId: string, skillId: string) => `se:roleplay:${sessionId}:${skillId}`;
/** Eligible reviewers: active staff holding an active instructor, training manager or HR authority assignment, never the person. */
export function eligibleReviewers(people: { id: string; kind: string; status: string }[], assignments: { person_id: string; role: string; status: string }[], person: string | null): string[] {
  const ok = new Set(assignments.filter((a) => a.status === 'active' && REVIEWER_ROLES.includes(a.role)).map((a) => a.person_id));
  return people.filter((p) => p.kind === 'staff' && p.status === 'active' && ok.has(p.id) && p.id !== person).map((p) => p.id).sort();
}

// ───────────── Scenario library rules (training manager; secure_items A)
export type RpProblem = 'code' | 'kind' | 'text' | 'core_skill' | 'skills' | 'level' | 'pass_pct' | 'minutes' | 'rubric' | 'criterion' | 'check' | 'turns' | 'turn'
  | 'turn_criteria' | 'unused' | 'restricted' | 'status';
export interface RpScenarioInput extends Omit<RpScenario, 'id' | 'status' | 'sort' | 'version'> { id?: string | null; status?: string }
/** Plant-security wording never appears in a scenario (same list as SQL kafaa_rp_problem). */
export const RP_RESTRICTED = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection',
  'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address', 'patrol route', 'badge reader'];
const txt = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
const isInt = (x: unknown) => typeof x === 'number' && Number.isInteger(x);
export function rpAllText(s: Partial<RpScenarioInput>): string {
  const parts: string[] = [s.title_en ?? '', s.title_ar ?? '', s.summary_en ?? '', s.summary_ar ?? '', s.setting_en ?? '', s.setting_ar ?? '', s.counterpart_en ?? '', s.counterpart_ar ?? '', s.role_en ?? '', s.role_ar ?? ''];
  for (const t of Array.isArray(s.turns) ? s.turns : []) parts.push(t?.prompt_en ?? '', t?.prompt_ar ?? '', t?.hint_en ?? '', t?.hint_ar ?? '', t?.example_en ?? '', t?.example_ar ?? '');
  for (const c of Array.isArray(s.rubric) ? s.rubric : []) parts.push(c?.label_en ?? '', c?.label_ar ?? '', c?.desc_en ?? '', c?.desc_ar ?? '', c?.tip_en ?? '', c?.tip_ar ?? '');
  return parts.map((p) => String(p)).join(' ').toLowerCase();
}
function checkProblem(c: unknown): boolean {
  if (!c || typeof c !== 'object') return true;
  const k = c as RpCheck;
  if (!(CHECK_TYPES as readonly string[]).includes(k.type)) return true;
  if (k.type === 'cues') {
    if (!Array.isArray(k.cues) || k.cues.length < 1 || k.cues.length > 40 || !k.cues.every((q) => typeof q === 'string' && cueKey(q).length > 0 && q.length <= 60)) return true;
    if (k.min !== undefined && k.min !== null && (!isInt(k.min) || k.min < 1 || k.min > k.cues.length)) return true;
  }
  if (k.type === 'length' && (!isInt(k.min) || !isInt(k.max) || (k.min as number) < 1 || (k.max as number) < (k.min as number) || (k.max as number) > 400)) return true;
  return false;
}
/**
 * The first problem with a scenario, or null (SQL kafaa_rp_problem). Rules: code RP-XX-00; a known kind; title, summary, setting, the
 * counterpart and my role in English and Arabic; 1-3 active core skills; 1-4 catalogue skills that can carry evidence; evidence level
 * 1-2; pass mark 50-90%; 5-40 minutes; a published rubric of 3-8 criteria, each with a label, what it looks for and a tip in English and
 * Arabic and a valid check; 3-5 turns, each with the counterpart's line, a hint and an example answer in both languages and 1-5 known
 * criteria; every criterion used by at least one turn; no plant-security wording; status draft, published or retired.
 */
export function rpScenarioProblem(s: Partial<RpScenarioInput> | null | undefined, ctx: { coreSkillIds: string[]; evidenceSkillIds: string[] }): RpProblem | null {
  if (!s || typeof s.code !== 'string' || !/^RP-[A-Z]{2}-\d{2}$/.test(s.code)) return 'code';
  if (typeof s.kind !== 'string' || !(RP_KINDS as readonly string[]).includes(s.kind)) return 'kind';
  if (!txt(s.title_en, 140) || !txt(s.title_ar, 140) || !txt(s.summary_en, 400) || !txt(s.summary_ar, 400) || !txt(s.setting_en, 1200) || !txt(s.setting_ar, 1200)
    || !txt(s.counterpart_en, 120) || !txt(s.counterpart_ar, 120) || !txt(s.role_en, 120) || !txt(s.role_ar, 120)) return 'text';
  const cs = s.core_skill_ids;
  if (!Array.isArray(cs) || cs.length < 1 || cs.length > 3 || !cs.every((x) => typeof x === 'string' && ctx.coreSkillIds.includes(x))) return 'core_skill';
  const sk = s.skill_ids;
  if (!Array.isArray(sk) || sk.length < 1 || sk.length > 4 || !sk.every((x) => typeof x === 'string' && ctx.evidenceSkillIds.includes(x))) return 'skills';
  if (!isInt(s.level) || (s.level as number) < 1 || (s.level as number) > 2) return 'level';
  if (!isInt(s.pass_pct) || (s.pass_pct as number) < 50 || (s.pass_pct as number) > 90) return 'pass_pct';
  if (!isInt(s.est_minutes) || (s.est_minutes as number) < 5 || (s.est_minutes as number) > 40) return 'minutes';
  const rb = s.rubric;
  if (!Array.isArray(rb) || rb.length < MIN_CRITERIA || rb.length > MAX_CRITERIA || new Set(rb.map((c) => c?.id)).size !== rb.length) return 'rubric';
  for (const c of rb) {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(c.id) || !txt(c.label_en, 80) || !txt(c.label_ar, 80) || !txt(c.desc_en, 300) || !txt(c.desc_ar, 300)
      || !txt(c.tip_en, 300) || !txt(c.tip_ar, 300)) return 'criterion';
    if (checkProblem(c.check)) return 'check';
  }
  const turns = s.turns;
  if (!Array.isArray(turns) || turns.length < MIN_TURNS || turns.length > MAX_TURNS || new Set(turns.map((t) => t?.id)).size !== turns.length) return 'turns';
  const ids = new Set(rb.map((c) => c.id));
  for (const t of turns) {
    if (!t || typeof t.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(t.id) || !txt(t.prompt_en, 600) || !txt(t.prompt_ar, 600) || !txt(t.hint_en, 300) || !txt(t.hint_ar, 300)
      || !txt(t.example_en, 1200) || !txt(t.example_ar, 1200)) return 'turn';
    if (!Array.isArray(t.criteria) || t.criteria.length < 1 || t.criteria.length > 5 || new Set(t.criteria).size !== t.criteria.length || !t.criteria.every((c) => ids.has(c))) return 'turn_criteria';
  }
  if (rb.some((c) => !turns.some((t) => t.criteria.includes(c.id)))) return 'unused';
  const all = rpAllText(s);
  if (RP_RESTRICTED.some((w) => all.includes(w))) return 'restricted';
  if (s.status !== undefined && s.status !== null && !['draft', 'published', 'retired'].includes(String(s.status))) return 'status';
  return null;
}

// ───────────── HR aggregate (skills_profile Agg): suppressed under 10, never a person and never a criterion result of a person
export interface RpSessionLite { person_id: string; scenario_id: string; status: string; period: string; passed: number | null; total: number | null; review_status: string }
export interface RpStats {
  participants: number | null;
  sessions: number | null;
  completed: number | null;
  pct: number | null;
  validated: number | null;
  by_kind: { kind: string; people: number | null; pct: number | null }[];
}
export function rpStats(sessions: RpSessionLite[], people: { id: string; kind: string; status: string }[], scenarios: { id: string; kind: string }[], today: string, minGroup: number): RpStats {
  const staff = new Set(people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id));
  const q = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
  const shift = (qq: string, k: number) => { const [y, n] = qq.split('-Q').map(Number); const i = y * 4 + (n - 1) + k; return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`; };
  const win = [3, 2, 1, 0].map((k) => shift(q(today), -k));
  const all = sessions.filter((s) => staff.has(s.person_id) && win.includes(s.period));
  const done = all.filter((s) => s.status === 'completed' && s.total != null && Number(s.total) > 0);
  const ppl = new Set(all.map((s) => s.person_id));
  const ok = ppl.size >= minGroup;
  const pooled = (xs: RpSessionLite[]) => { const a = xs.reduce((m, s) => m + Number(s.passed), 0); const b = xs.reduce((m, s) => m + Number(s.total), 0); return b > 0 ? rpPct(a, b) : null; };
  const kindOf = new Map(scenarios.map((s) => [s.id, s.kind]));
  const val = new Set(all.filter((s) => s.review_status === 'validated').map((s) => s.person_id)).size;
  return {
    participants: ok ? ppl.size : null,
    sessions: ok ? all.length : null,
    completed: ok ? done.length : null,
    pct: ok ? pooled(done) : null,
    validated: ok && val >= minGroup ? val : null,
    by_kind: [...RP_KINDS].map((k) => {
      const xs = done.filter((s) => kindOf.get(s.scenario_id) === k);
      const p = new Set(xs.map((s) => s.person_id)).size;
      const big = p >= minGroup;
      return { kind: k, people: big ? p : null, pct: big ? pooled(xs) : null };
    }),
  };
}
