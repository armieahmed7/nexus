/**
 * FS56 Skill-change effectiveness: which learning actually moves skills. Pure rules shared by both backends, the seed builder, the
 * pages and the PGlite validator. Import-free apart from types and other import-free rule files. SQL mirror: kafaa_sc_* in
 * supabase/migrations/20261010264001_kafaa_fs64_skill_change_coverage.sql (scripts/validate/fs64-skill-change-coverage.mjs proves
 * SQL = TS on the seed, at several as-of dates).
 *
 * Items: every catalogue course and every FS17 pathway with at least one completion and at least one skill it teaches ("taught by",
 * coverage.ts courseSkills: the F01 mapping plus FS19 links; a pathway teaches its own skill). Participants: the people who completed
 * it (transcript rows passed/completed, completed enrolments, completed pathway enrolments), each once, at their first completion.
 *
 * Levels come from the F01 evidence history (person_skills keeps only today's state): a person's level on a skill at a date is the
 * highest counted level among the evidence rows observed by that date (verified, evidenced or validated; self-claims never count;
 * rows later superseded still count for the time they were on record). The participant's own completion record never counts for
 * them: a course cannot prove itself, only the assessments, observations, OJT, credentials and check-ins that follow it.
 *   before = level the day before the learning started (a course: its completion date; a pathway: its start date)
 *   after  = level WINDOW_DAYS (90) after completion; a participant is measured once that window has closed by the as-of date.
 * Matched comparison (where available): for each measured participant and skill, colleagues of the same kind (staff with staff,
 * contractors with contractors), active, who had not completed this learning by the end of the window and who held the same level
 * on the same skill when the participant started, over the same window. Their pooled mean change is the comparison; net = change
 * minus comparison. It is used when at least MIN_N distinct colleagues form the pool, else the item reports before and after only.
 *
 * Suppression: an item with fewer than MIN_N (10) completers shows nothing but "suppressed"; with fewer than MIN_N measured
 * participants it reports "window open" and the date its tenth window closes. Means are kept x100 with integer arithmetic.
 * Verdict: moves (effect >= 0.25 of a level), some (>= 0.10), flat; effect = net when matched, else change.
 */
import type { Reason } from '../../domain/engines/types';
import { courseSkills, restrictedSkills } from './coverage.ts';

export const MIN_N = 10;
export const WINDOW_DAYS = 90;
export const MOVES_X100 = 25;
export const SOME_X100 = 10;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function rdivS(a: number, b: number): number {
  const q = Math.round(Math.abs(a) / b);
  return a < 0 ? -q : q;
}
export function plusDays(d: string, n: number): string {
  const x = new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const d10 = (v: unknown) => String(v ?? '').slice(0, 10);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cell = (n: number) => (n >= MIN_N ? n : null);

export interface SkillChangeWorld {
  skills: Row[]; competencies: Row[]; courses: Row[]; course_skill_links: Row[]; pathways: Row[];
  training_records: Row[]; enrolments: Row[]; pathway_enrolments: Row[];
  evidence: Row[]; // person_id, skill_id, level, basis, observed_on, ref_table, ref_id
  people: Row[]; // id, kind, status
}
export interface Participant { person_id: string; start: string; done: string; exclude: string[] }
export interface SkillRow { skill_id: string; level: number; pairs: number | null; before_x100: number | null; after_x100: number | null; moved_pct: number | null }
export interface SkillChangeRow {
  id: string; kind: 'course' | 'pathway'; item_id: string; as_of: string; window_days: number;
  completers: number | null; measured: number | null; suppressed: boolean;
  before_x100: number | null; after_x100: number | null; change_x100: number | null; moved_pct: number | null;
  comparison_people: number | null; comparison_change_x100: number | null; net_x100: number | null;
  method: 'matched' | 'before_after' | null; verdict: 'moves' | 'some' | 'flat' | 'window_open' | 'suppressed';
  next_on: string | null; skills: SkillRow[]; reasons: Reason[];
}
export const measureId = (kind: string, item: string) => `scm:${kind}:${item}`;

/** Participants per item key `<kind>:<id>` (first completion per person; own transcript ids to exclude). */
export function participantsOf(w: Pick<SkillChangeWorld, 'training_records' | 'enrolments' | 'pathway_enrolments'>): Map<string, Map<string, Participant>> {
  const out = new Map<string, Map<string, Participant>>();
  const put = (key: string, person: string, start: string, done: string, tr: string | null) => {
    const m = out.get(key) ?? out.set(key, new Map()).get(key)!;
    const cur = m.get(person);
    if (!cur) m.set(person, { person_id: person, start, done, exclude: tr ? [tr] : [] });
    else {
      if (done < cur.done || (done === cur.done && start < cur.start)) { cur.done = done; cur.start = start; }
      if (tr && !cur.exclude.includes(tr)) cur.exclude.push(tr);
    }
  };
  for (const t of w.training_records) if (['passed', 'completed'].includes(t.result) && t.completed_on) put(`course:${t.course_id}`, t.person_id, d10(t.completed_on), d10(t.completed_on), String(t.id));
  for (const e of w.enrolments) if (e.status === 'completed' && e.completed_at) put(`course:${e.course_id}`, e.person_id, d10(e.completed_at), d10(e.completed_at), null);
  for (const p of w.pathway_enrolments) if (p.status === 'completed' && p.completed_on) put(`pathway:${p.pathway_id}`, p.person_id, d10(p.started_on || p.completed_on), d10(p.completed_on), null);
  for (const m of out.values()) for (const p of m.values()) p.exclude.sort();
  return out;
}

/** Evidence index: person|skill -> [observed_on, level, ref] (counted bases only). */
export function evidenceIndex(evidence: Row[]): Map<string, { on: string; level: number; tr: string | null }[]> {
  const ix = new Map<string, { on: string; level: number; tr: string | null }[]>();
  for (const e of evidence) {
    if (e.basis === 'claimed') continue;
    const k = `${e.person_id}|${e.skill_id}`;
    (ix.get(k) ?? ix.set(k, []).get(k)!).push({ on: d10(e.observed_on), level: Number(e.level), tr: e.ref_table === 'training_records' ? String(e.ref_id) : null });
  }
  return ix;
}
/** Level on a skill from the evidence on record before `before` (strict) or by `by` (inclusive), own transcript rows excluded. */
export function levelAt(ix: ReturnType<typeof evidenceIndex>, person: string, skill: string, date: string, strict: boolean, exclude: string[] = []): number {
  let m = 0;
  for (const e of ix.get(`${person}|${skill}`) ?? []) {
    if (e.tr && exclude.includes(e.tr)) continue;
    if (strict ? e.on < date : e.on <= date) m = Math.max(m, e.level);
  }
  return m;
}

/** Skills each item teaches (key `<kind>:<id>` -> skill -> level). */
export function itemSkills(w: Pick<SkillChangeWorld, 'skills' | 'competencies' | 'courses' | 'course_skill_links' | 'pathways'>): Map<string, Map<string, number>> {
  const restricted = restrictedSkills(w.skills, w.competencies);
  const out = new Map<string, Map<string, number>>();
  for (const c of w.courses) { const m = courseSkills(c, w.skills, w.course_skill_links, restricted); if (m.size) out.set(`course:${c.id}`, m); }
  for (const p of w.pathways) if (p.skill_id && !restricted.has(String(p.skill_id))) out.set(`pathway:${p.id}`, new Map([[String(p.skill_id), Number(p.level)]]));
  return out;
}

const R = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m25.reasons.${code}`, ...(vars ? { vars } : {}) });
const lv = (x100: number) => Math.round(x100) / 100;

/** The skill-change table as of a date: one row per item with completions and taught skills, sorted by kind then item id. */
export function skillChange(w: SkillChangeWorld, asOf: string): SkillChangeRow[] {
  const parts = participantsOf(w);
  const taught = itemSkills(w);
  const ix = evidenceIndex(w.evidence);
  const kindOf = new Map(w.people.map((p) => [String(p.id), String(p.kind)]));
  const active = w.people.filter((p) => p.status === 'active');
  const rows: SkillChangeRow[] = [];
  const keys = [...parts.keys()].filter((k) => taught.has(k)).sort((a, b) => cmp(a.split(':')[0], b.split(':')[0]) || cmp(a.slice(a.indexOf(':') + 1), b.slice(b.indexOf(':') + 1)));
  for (const key of keys) {
    const kind = key.slice(0, key.indexOf(':')) as 'course' | 'pathway';
    const item = key.slice(key.indexOf(':') + 1);
    const pm = parts.get(key)!;
    const skills = [...taught.get(key)!].sort((a, b) => cmp(a[0], b[0]));
    const all = [...pm.values()].sort((a, b) => cmp(a.person_id, b.person_id));
    const n = all.length;
    const measured = all.filter((p) => plusDays(p.done, WINDOW_DAYS) <= asOf);
    const m = measured.length;
    const closes = all.map((p) => plusDays(p.done, WINDOW_DAYS)).sort();
    const base: SkillChangeRow = {
      id: measureId(kind, item), kind, item_id: item, as_of: asOf, window_days: WINDOW_DAYS,
      completers: cell(n), measured: n >= MIN_N ? cell(m) : null, suppressed: n < MIN_N,
      before_x100: null, after_x100: null, change_x100: null, moved_pct: null, comparison_people: null, comparison_change_x100: null, net_x100: null,
      method: null, verdict: n < MIN_N ? 'suppressed' : 'window_open', next_on: null,
      skills: skills.map(([s, l]) => ({ skill_id: s, level: l, pairs: null, before_x100: null, after_x100: null, moved_pct: null })), reasons: [],
    };
    if (n < MIN_N) { base.reasons = [R('sc_suppressed', { min: MIN_N })]; rows.push(base); continue; }
    if (m < MIN_N) {
      base.next_on = closes[MIN_N - 1] > asOf ? closes[MIN_N - 1] : null;
      base.reasons = [R('sc_window', { min: MIN_N, days: WINDOW_DAYS, ...(base.next_on ? { date: base.next_on } : {}) })];
      rows.push(base); continue;
    }
    let sb = 0, sa = 0, mv = 0, pairs = 0, cs = 0, cn = 0;
    const pool = new Set<string>();
    const perSkill = new Map<string, { b: number; a: number; mv: number; n: number }>();
    for (const p of measured) {
      const end = plusDays(p.done, WINDOW_DAYS);
      const pk = kindOf.get(p.person_id) ?? '';
      for (const [s] of skills) {
        const b = levelAt(ix, p.person_id, s, p.start, true, p.exclude);
        const a = levelAt(ix, p.person_id, s, end, false, p.exclude);
        sb += b; sa += a; pairs++; if (a > b) mv++;
        const ps = perSkill.get(s) ?? perSkill.set(s, { b: 0, a: 0, mv: 0, n: 0 }).get(s)!;
        ps.b += b; ps.a += a; ps.n++; if (a > b) ps.mv++;
        for (const q of active) {
          if (q.id === p.person_id || String(q.kind) !== pk) continue;
          const qc = pm.get(q.id);
          if (qc && qc.done <= end) continue;
          const qb = levelAt(ix, q.id, s, p.start, true);
          if (qb !== b) continue;
          cs += levelAt(ix, q.id, s, end, false) - qb; cn++; pool.add(q.id);
        }
      }
    }
    const before = rdivS(100 * sb, pairs), after = rdivS(100 * sa, pairs);
    const change = after - before;
    const moved = rdivS(100 * mv, pairs);
    const matched = pool.size >= MIN_N && cn > 0;
    const comp = matched ? rdivS(100 * cs, cn) : null;
    const net = comp === null ? null : change - comp;
    const effect = net ?? change;
    const verdict = effect >= MOVES_X100 ? 'moves' : effect >= SOME_X100 ? 'some' : 'flat';
    const reasons: Reason[] = [R('sc_change', { before: lv(before), after: lv(after), days: WINDOW_DAYS }), R('sc_moved', { pct: moved })];
    if (matched) reasons.push(R('sc_matched', { comp: lv(comp!), net: lv(net!), people: pool.size }));
    else reasons.push(R('sc_no_comparison', { min: MIN_N }));
    reasons.push(R(`sc_verdict_${verdict}`));
    rows.push({
      ...base, measured: m, before_x100: before, after_x100: after, change_x100: change, moved_pct: moved,
      comparison_people: cell(pool.size), comparison_change_x100: comp, net_x100: net, method: matched ? 'matched' : 'before_after', verdict, next_on: null,
      skills: skills.map(([s, l]) => { const x = perSkill.get(s)!; return { skill_id: s, level: l, pairs: cell(x.n), before_x100: rdivS(100 * x.b, x.n), after_x100: rdivS(100 * x.a, x.n), moved_pct: rdivS(100 * x.mv, x.n) }; }),
      reasons,
    });
  }
  return rows;
}

// ───────────── report (stored rows + titles), the shape both backends return
export interface SkillChangeView extends SkillChangeRow { title_en: string; title_ar: string; code: string | null; computed_at: string | null }
export interface SkillChangeReport { as_of: string | null; computed_at: string | null; window_days: number; min_group: number; can_compute: boolean; rows: SkillChangeView[] }
const tsText = (v: unknown) => (v == null ? null : String(v).replace(/\.\d{3}Z$/, 'Z'));
/** Stored measure rows (any order) -> the report: titles from courses / pathways, sorted by kind then item id. */
export function skillChangeReportOf(stored: Row[], courses: Row[], pathways: Row[], canCompute: boolean): SkillChangeReport {
  const co = new Map(courses.map((c) => [String(c.id), c]));
  const pw = new Map(pathways.map((p) => [String(p.id), p]));
  const rows: SkillChangeView[] = [...stored]
    .sort((a, b) => cmp(String(a.kind), String(b.kind)) || cmp(String(a.item_id), String(b.item_id)))
    .map((r) => {
      const src = r.kind === 'course' ? co.get(String(r.item_id)) : pw.get(String(r.item_id));
      return {
        id: r.id, kind: r.kind, item_id: r.item_id, as_of: d10(r.as_of), window_days: Number(r.window_days), completers: r.completers ?? null, measured: r.measured ?? null,
        suppressed: r.suppressed === true, before_x100: r.before_x100 ?? null, after_x100: r.after_x100 ?? null, change_x100: r.change_x100 ?? null, moved_pct: r.moved_pct ?? null,
        comparison_people: r.comparison_people ?? null, comparison_change_x100: r.comparison_change_x100 ?? null, net_x100: r.net_x100 ?? null, method: r.method ?? null,
        verdict: r.verdict, next_on: r.next_on ? d10(r.next_on) : null, skills: (r.skills ?? []) as SkillRow[], reasons: (r.reasons ?? []) as Reason[],
        title_en: String(src?.title_en ?? r.item_id), title_ar: String(src?.title_ar ?? src?.title_en ?? r.item_id), code: r.kind === 'course' ? (src?.code ?? null) : null,
        computed_at: tsText(r.computed_at),
      };
    });
  const asOf = rows.map((r) => r.as_of).sort().pop() ?? null;
  const at = rows.map((r) => r.computed_at ?? '').sort().pop() || null;
  return { as_of: asOf, computed_at: at, window_days: WINDOW_DAYS, min_group: MIN_N, can_compute: canCompute, rows };
}

/** World from the seed / LocalBackend tables (evidence = every skill_evidence row, active or superseded). */
export function skillChangeWorld(tables: Record<string, Row[] | undefined>): SkillChangeWorld {
  const t = (k: string) => (tables[k] ?? []) as Row[];
  return {
    skills: t('skills'), competencies: t('competencies'), courses: t('courses'), course_skill_links: t('course_skill_links'), pathways: t('pathways'),
    training_records: t('training_records'), enrolments: t('enrolments'), pathway_enrolments: t('pathway_enrolments'), evidence: t('skill_evidence'), people: t('people'),
  };
}
