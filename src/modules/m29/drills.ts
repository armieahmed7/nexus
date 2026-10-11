// FS37 Governed AI sandbox drills: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261010245001_kafaa_fs45_ai_register_drills.sql (kafaa_dr_score, kafaa_dr_problem, kafaa_dr_stats_core).
// Import-free apart from types.
//
// Benchmarks: IAEA "Atoms for Algorithms" (AI output verification and the duty to challenge it), EU AI Act Article 4 practice
// repository (literacy measures per system), ADNOC / EGA (AI learning whose output is a built, checkable artefact).
//
//  - A drill compares an AI-styled summary (segments) with a synthetic controlled procedure. The planted errors and the protocol
//    answers live in kafaa_ai_drill_keys (training staff only) and never reach the taker before they submit.
//  - Browser-only and deterministic: no model call, no LLM key. The summary is authored text styled as AI output.
//  - Scoring (scoreDrill = SQL kafaa_dr_score): each planted error found +2 and +1 when its kind is named right; each flag on a correct
//    segment -1; each protocol step answered right +2. Points never go below 0; pct = round(100 x points / max).
//    Passed = every critical protocol step right AND at least two thirds of the errors found AND pct >= the drill's pass mark.
//    Level = 2 only for a level-2 drill passed with every error found and pct >= 85, else 1; never above the drill's level or EVIDENCE_CAP (2).
//  - A pass writes F01 `assessment` evidence (ref_table ai_drill_attempts) for the drill's skill; the latest attempt on a drill replaces
//    earlier evidence from that drill (kept, inactive). Practice never touches qualification records.
import type { Reason } from '../../domain/engines/types';

export const ERROR_KINDS = ['omitted_step', 'wrong_value', 'wrong_order', 'invented', 'overreach', 'stale_revision'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];
export const DRILL_EVIDENCE_CAP = 2;
export const LEVEL2_PCT = 85;
export const DRILL_STATUSES = ['draft', 'published', 'retired'] as const;
export const DRILL_SKILL = 'sk-fs-ai-verify';

export interface Segment { id: string; text_en: string; text_ar: string }
export interface DocStep { n: number; text_en: string; text_ar: string }
export interface ProtocolStep { id: string; q_en: string; q_ar: string; options: { en: string; ar: string }[] }
export interface KeyError { segment_id: string; kind: string; step_n: number | null; explain_en: string; explain_ar: string }
export interface KeyStep { id: string; correct: number; critical: boolean; explain_en: string; explain_ar: string }
export interface DrillKey { errors: KeyError[]; protocol: KeyStep[]; pass_pct: number }
export interface Flag { segment_id: string; kind: string }
export interface Answer { id: string; choice: number }

export interface DrillScore {
  points: number;
  max: number;
  pct: number;
  errors: number;
  found: number;
  kinds_right: number;
  false_flags: number;
  protocol_right: number;
  protocol_total: number;
  critical_ok: boolean;
  passed: boolean;
  level: number;
  feedback: {
    errors: { segment_id: string; kind: string; found: boolean; kind_right: boolean; flagged_kind: string | null; step_n: number | null; explain_en: string; explain_ar: string }[];
    false_flags: string[];
    protocol: { id: string; choice: number; correct: number; right: boolean; critical: boolean; explain_en: string; explain_ar: string }[];
  };
  reasons: Reason[];
}

/** Flags deduplicated by segment (the first flag on a segment counts), in the order given. */
export function normFlags(flags: Flag[]): Flag[] {
  const seen = new Set<string>();
  const out: Flag[] = [];
  for (const f of flags ?? []) { if (!f || typeof f.segment_id !== 'string' || seen.has(f.segment_id)) continue; seen.add(f.segment_id); out.push({ segment_id: f.segment_id, kind: typeof f.kind === 'string' ? f.kind : '' }); }
  return out;
}

/** Score one submission against the key (mirror of SQL kafaa_dr_score). `drillLevel` is the drill's evidence level (1 or 2). */
export function scoreDrill(key: DrillKey, flagsIn: Flag[], answers: Answer[], drillLevel: number): DrillScore {
  const flags = normFlags(flagsIn);
  const byseg = new Map(flags.map((f) => [f.segment_id, f.kind]));
  const errSegs = new Set(key.errors.map((e) => e.segment_id));
  let points = 0;
  let found = 0;
  let kinds = 0;
  const fe = key.errors.map((e) => {
    const fl = byseg.has(e.segment_id) ? byseg.get(e.segment_id)! : null;
    const f = fl !== null;
    const kr = f && fl === e.kind;
    if (f) { found++; points += 2; }
    if (kr) { kinds++; points += 1; }
    return { segment_id: e.segment_id, kind: e.kind, found: f, kind_right: kr, flagged_kind: fl, step_n: e.step_n ?? null, explain_en: e.explain_en, explain_ar: e.explain_ar };
  });
  const falseFlags = flags.filter((f) => !errSegs.has(f.segment_id)).map((f) => f.segment_id);
  points -= falseFlags.length;
  let pr = 0;
  let critical = true;
  const fp = key.protocol.map((s) => {
    const a = (answers ?? []).find((x) => x && x.id === s.id);
    const choice = a && Number.isInteger(a.choice) ? a.choice : -1;
    const right = choice === s.correct;
    if (right) { pr++; points += 2; } else if (s.critical) critical = false;
    return { id: s.id, choice, correct: s.correct, right, critical: !!s.critical, explain_en: s.explain_en, explain_ar: s.explain_ar };
  });
  const max = 3 * key.errors.length + 2 * key.protocol.length;
  points = Math.max(0, points);
  const pct = max > 0 ? Math.floor((200 * points + max) / (2 * max)) : 0;
  const need = Math.ceil((2 * key.errors.length) / 3);
  const passed = critical && found >= need && pct >= key.pass_pct;
  const cap = Math.min(DRILL_EVIDENCE_CAP, Math.max(1, drillLevel));
  const level = !passed ? 0 : cap >= 2 && found === key.errors.length && pct >= LEVEL2_PCT ? 2 : 1;
  const reasons: Reason[] = [
    { code: 'fs37_found', key: 'm29.dr.reason.found', vars: { found, errors: key.errors.length } },
    { code: 'fs37_kinds', key: 'm29.dr.reason.kinds', vars: { kinds, found } },
    { code: 'fs37_false', key: 'm29.dr.reason.false', vars: { n: falseFlags.length } },
    { code: 'fs37_protocol', key: 'm29.dr.reason.protocol', vars: { right: pr, total: key.protocol.length } },
  ];
  if (!critical) reasons.push({ code: 'fs37_critical', key: 'm29.dr.reason.critical' });
  reasons.push(passed ? { code: 'fs37_level', key: 'm29.dr.reason.level', vars: { level, pct } } : { code: 'fs37_not_passed', key: 'm29.dr.reason.notPassed', vars: { pct, pass: key.pass_pct, need } });
  return { points, max, pct, errors: key.errors.length, found, kinds_right: kinds, false_flags: falseFlags.length, protocol_right: pr, protocol_total: key.protocol.length, critical_ok: critical, passed, level,
    feedback: { errors: fe, false_flags: falseFlags, protocol: fp }, reasons };
}

/** Problems in a submission against the drill shown (unknown segment, unknown kind, every protocol step answered with a valid option). */
export function submissionProblem(drill: { output: { segments: Segment[] }; protocol: ProtocolStep[] }, flags: Flag[], answers: Answer[]): string | null {
  if (!Array.isArray(flags) || !Array.isArray(answers)) return 'shape';
  const segs = new Set((drill.output?.segments ?? []).map((s) => s.id));
  for (const f of flags) {
    if (!f || typeof f.segment_id !== 'string' || !segs.has(f.segment_id)) return 'segment';
    if (!(ERROR_KINDS as readonly string[]).includes(f.kind)) return 'kind';
  }
  for (const s of drill.protocol ?? []) {
    const a = answers.find((x) => x && x.id === s.id);
    if (!a || !Number.isInteger(a.choice) || a.choice < 0 || a.choice >= (s.options ?? []).length) return 'protocol';
  }
  return null;
}

export const RESTRICTED_DRILL_TERMS = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address'];
export interface DrillInput {
  id?: string | null; title_en: string; title_ar: string; summary_en: string; summary_ar: string; scenario_en: string; scenario_ar: string; difficulty: number; level: number; skill_id: string;
  doc: { code: string; title_en: string; title_ar: string; revision: string; steps: DocStep[] }; output: { tool_en: string; tool_ar: string; segments: Segment[] };
  protocol: ProtocolStep[]; key: DrillKey; est_minutes: number; status: string;
}
const s = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= max;
/** First problem code of an authored drill, or null (mirror of SQL kafaa_dr_problem). Documents must be synthetic (code SYN-...). */
export function drillProblem(d: DrillInput, skills: string[]): string | null {
  if (!s(d?.title_en, 140) || !s(d?.title_ar, 140) || !s(d.summary_en, 400) || !s(d.summary_ar, 400) || !s(d.scenario_en, 800) || !s(d.scenario_ar, 800)) return 'texts';
  if (!Number.isInteger(d.difficulty) || d.difficulty < 1 || d.difficulty > 3) return 'difficulty';
  if (!Number.isInteger(d.level) || d.level < 1 || d.level > DRILL_EVIDENCE_CAP) return 'level';
  if (!skills.includes(d.skill_id)) return 'skill';
  if (!(DRILL_STATUSES as readonly string[]).includes(d.status)) return 'status';
  if (!Number.isInteger(d.est_minutes) || d.est_minutes < 3 || d.est_minutes > 30) return 'minutes';
  if (!d.doc || !/^SYN-[A-Z]{2}-\d{3}$/.test(d.doc.code ?? '') || !s(d.doc.title_en, 160) || !s(d.doc.title_ar, 160) || !s(d.doc.revision, 10)) return 'synthetic';
  if (!Array.isArray(d.doc.steps) || d.doc.steps.length < 3 || d.doc.steps.length > 12 || d.doc.steps.some((x, i) => x?.n !== i + 1 || !s(x.text_en, 400) || !s(x.text_ar, 400))) return 'doc';
  const segs = d.output?.segments;
  if (!s(d.output?.tool_en, 80) || !s(d.output?.tool_ar, 80) || !Array.isArray(segs) || segs.length < 3 || segs.length > 12 || segs.some((x) => !s(x?.id, 20) || !s(x.text_en, 400) || !s(x.text_ar, 400))
    || new Set(segs.map((x) => x.id)).size !== segs.length) return 'output';
  if (!Array.isArray(d.protocol) || d.protocol.length < 3 || d.protocol.length > 5 || d.protocol.some((p) => !s(p?.id, 20) || !s(p.q_en, 300) || !s(p.q_ar, 300) || !Array.isArray(p.options) || p.options.length < 2 || p.options.length > 4
    || p.options.some((o) => !s(o?.en, 200) || !s(o?.ar, 200)))) return 'protocol';
  const k = d.key;
  if (!k || !Array.isArray(k.errors) || k.errors.length < 2 || k.errors.length > 5 || k.errors.some((e) => !segs.some((x) => x.id === e?.segment_id) || !(ERROR_KINDS as readonly string[]).includes(e.kind) || !s(e.explain_en, 400) || !s(e.explain_ar, 400))
    || new Set(k.errors.map((e) => e.segment_id)).size !== k.errors.length || k.errors.length >= segs.length) return 'errors';
  if (!Array.isArray(k.protocol) || k.protocol.length !== d.protocol.length || d.protocol.some((p) => { const ks = k.protocol.find((x) => x?.id === p.id); return !ks || !Number.isInteger(ks.correct) || ks.correct < 0 || ks.correct >= p.options.length || typeof ks.critical !== 'boolean' || !s(ks.explain_en, 400) || !s(ks.explain_ar, 400); })
    || !k.protocol.some((x) => x.critical)) return 'key';
  if (!Number.isInteger(k.pass_pct) || k.pass_pct < 50 || k.pass_pct > 95) return 'pass';
  const all = JSON.stringify([d.title_en, d.summary_en, d.scenario_en, d.doc, d.output, d.protocol, k]).toLowerCase();
  if (RESTRICTED_DRILL_TERMS.some((w) => all.includes(w))) return 'restricted';
  return null;
}

export interface DrillAttemptLite { id: string; person_id: string; drill_id: string; passed: boolean; pct: number; feedback?: DrillScore['feedback'] | null; submitted_at: string }
export interface DrillStats {
  attempts: number;
  people: number | null;
  drills: { drill_id: string; attempts: number | null; people: number | null; pass_pct: number | null; avg_pct: number | null }[];
  missed_kinds: { kind: string; missed: number | null; planted: number | null; pct_missed: number | null }[];
}
/** Training view of drill results (mirror of SQL kafaa_dr_stats_core): latest attempt per person and drill; cells under minGroup suppressed. */
export function drillStats(attempts: DrillAttemptLite[], drillIds: string[], minGroup: number): DrillStats {
  const latest = new Map<string, DrillAttemptLite>();
  for (const a of [...attempts].sort((x, y) => (x.submitted_at < y.submitted_at ? -1 : x.submitted_at > y.submitted_at ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) latest.set(`${a.person_id}|${a.drill_id}`, a);
  const rows = [...latest.values()];
  const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
  const people = new Set(rows.map((a) => a.person_id)).size;
  const drills = [...drillIds].sort().map((d) => {
    const g = rows.filter((a) => a.drill_id === d);
    const big = g.length >= minGroup;
    return { drill_id: d, attempts: big ? attempts.filter((a) => a.drill_id === d).length : null, people: big ? g.length : null,
      pass_pct: big ? r1((100 * g.filter((a) => a.passed).length) / g.length) : null, avg_pct: big ? r1(g.reduce((m, a) => m + Number(a.pct), 0) / g.length) : null };
  });
  const missed_kinds = [...ERROR_KINDS].map((k) => {
    let planted = 0;
    let missed = 0;
    for (const a of rows) for (const e of a.feedback?.errors ?? []) if (e.kind === k) { planted++; if (!e.found) missed++; }
    const big = planted >= minGroup;
    return { kind: k, missed: big && missed >= minGroup ? missed : null, planted: big ? planted : null, pct_missed: big ? r1((100 * missed) / planted) : null };
  });
  return { attempts: attempts.length, people: people >= minGroup ? people : null, drills, missed_kinds };
}
