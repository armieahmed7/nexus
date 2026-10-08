/**
 * F07 Learning Coach: the "This month for you" feed. Pure and deterministic (no React, no repository), so the page,
 * the tests and any future server twin compute the same list from the same rows.
 *
 * Ranking (F02 kernel):
 *   - needs = my current role's competencies (weight current_role, 1.0) + shortlisted target roles (target_role, 0.6),
 *     each scaled by my feedback on that competency (saved/enrolled x1.15, not relevant x0.75, clamped 0.4..1.6)
 *   - every candidate is scored with weighted gap closure (byGapClosure: Σ level gain × importance × target weight / hours);
 *     practice quizzes and readings also earn "keep sharp" value on core competencies I already hold at the required level
 *   - pinned first: qualifications expiring inside their requalification notice window (default 90 days, so always
 *     within 60 days), then up to two mandatory items of my current role that are due or overdue ("must keep")
 *   - the rest is a learning mix filled by Sainte-Laguë allocation over kinds (course 3, practice 2, OJT 2, opportunity 1.5,
 *     mentor 1, reading 1; each × my feedback on that kind), best item of each kind first, 5 to 8 cards in total
 * Every card carries reasons (i18n keys) for <WhyThis>. Dismissed suggestions stay out for 90 days. Practice quizzes are
 * served only when every item is in the open practice bank: secure items are never referenced.
 */
import { byGapClosure, reason as engineReason, DEFAULT_RECOMMEND } from '../../domain/engines/rank';
import type { BiText, Ranked, Reason, Weights } from '../../domain/engines/types';
import type { CoachItemKind } from './backend/rpc';

export const FEED_MAX = 8;
export const FEED_MIN = 5;
export const PIN_WINDOW_DEFAULT = 90;
export const MUST_KEEP_DAYS = 60;
export const MUST_KEEP_MAX = 2;
export const MIX: Record<Exclude<CoachItemKind, 'refresher'>, number> = { course: 3, practice: 2, ojt: 2, opportunity: 1.5, mentor: 1, reading: 1 };
export const KIND_CAP: Record<Exclude<CoachItemKind, 'refresher'>, number> = { course: 3, practice: 2, ojt: 2, opportunity: 2, mentor: 1, reading: 1 };
const OPEN = ['assigned', 'approved', 'enrolled', 'in_progress', 'requested', 'waitlisted'];
const DONE_RESULTS = ['passed', 'completed', 'attended'];
const SECURITY_OPP_KINDS = ['security', 'protected_area', 'cyber', 'safeguards'];

export const r = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m19.reasons.${code}`, vars, ref });
const bi = (row: Record<string, unknown> | undefined | null, f: string, fallback = ''): BiText => ({ en: String(row?.[`${f}_en`] ?? fallback), ar: String(row?.[`${f}_ar`] || row?.[`${f}_en`] || fallback) });
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const dayNo = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
export const daysFrom = (now: string, to: string) => dayNo(to) - dayNo(now);

// ───────────── input rows (structural; the page passes repository rows, tests pass seed rows)
export interface RoleLite { id: string; title_en: string; title_ar: string; security_sensitive?: boolean | null }
export interface RoleCompLite { role_id: string; competency_id: string; required_level: number; importance: string }
export interface CompLite { id: string; name_en: string; name_ar: string }
export interface CourseLite { id: string; code: string; title_en: string; title_ar: string; modality: string; initial?: boolean | null; mandatory?: boolean | null; audience: string; competency_ids: string[]; prerequisites?: string[] | null; duration_hours?: number | string | null; qualifying?: boolean | null; validity_months?: number | null }
export interface SessionLite { id: string; course_id: string; starts_at: string; capacity: number; status?: string | null; crew?: string | null; audience?: string | null }
export interface Availability { taken: number; waiting: number }
export interface EnrolmentLite { id: string; course_id: string; session_id?: string | null; status: string; source: string; due_on?: string | null }
export interface RecordLite { course_id: string; completed_on: string; result: string; hours?: number | string | null }
export interface QualLite { id: string; standard_id: string; status: string; expires_on?: string | null; security_mirror_only?: boolean | null }
export interface StandardLite { id: string; code: string; title_en: string; title_ar: string; role_ids: string[]; status?: string | null; security_restricted?: boolean | null }
export interface RequalLite { standard_id: string; notice_days?: number[] | null }
export interface CurriculumLite { role_id: string; course_id: string; mandatory?: boolean | null }
export interface FormLite { id: string; title_en: string; title_ar: string; kind: string; is_practice: boolean; status: string; item_ids: string[]; time_limit_min?: number | null }
export interface ItemLite { id: string; bank: string; is_practice?: boolean | null; status: string; competency_id?: string | null }
export interface TaskLite { id: string; standard_id: string; code: string; statement_en: string; statement_ar: string; method: string; evaluator_role: string; critical?: boolean | null; sort?: number | null }
export interface EvalLite { task_id?: string | null; result: string; record_id: string }
export interface MentorLite { id: string; person_id: string; role_id?: string | null; interests: string[]; opt_in: boolean; bio_en?: string; bio_ar?: string }
export interface MentorRequestLite { mentor_id?: string | null; status: string }
export interface LessonLite { id: string; title_en: string; title_ar: string; affected_standard_ids: string[]; status: string; reviewed_on: string; reviewing_body: string }
export interface OpportunityLite { id: string; kind: string; title_en: string; title_ar?: string | null; status: string; skills_gained?: string[] | null; hours_week?: number | null; start_on?: string | null }
export interface SkillLite { id: string; competency_id: string; evidence_keys?: string[] | null }
export interface FeedbackLite { item_kind: string; item_id: string; signal: string; competency_ids?: string[] | null; hidden_until?: string | null }

export interface CoachInput {
  now: string;
  personId: string;
  roleId: string | null;
  crew?: string | null;
  targets: string[];
  /** Competency id -> my level (F01 states through SkillsEngine.competencyLevels). */
  have: Map<string, number>;
  roles: RoleLite[];
  roleComps: RoleCompLite[];
  competencies: CompLite[];
  courses: CourseLite[];
  sessions: SessionLite[];
  availability?: Record<string, Availability>;
  enrolments: EnrolmentLite[];
  records: RecordLite[];
  quals: QualLite[];
  standards: StandardLite[];
  requalRules?: RequalLite[];
  curriculum: CurriculumLite[];
  forms: FormLite[];
  items: ItemLite[];
  tasks: TaskLite[];
  evaluations?: EvalLite[];
  mentors: MentorLite[];
  mentorRequests?: MentorRequestLite[];
  lessons: LessonLite[];
  opportunities?: OpportunityLite[];
  skills?: SkillLite[];
  feedback: FeedbackLite[];
  weights?: Weights;
}

export type CoachAction =
  | { type: 'enrol'; courseId: string; sessionId: string | null; full: boolean }
  | { type: 'link'; to: string; label: 'openCourse' | 'openLearning' | 'openQuals' | 'openPractice' | 'openMentoring' | 'openLesson' | 'openOpportunity' | 'openStandard' };
export interface CoachCard {
  id: string;
  kind: CoachItemKind;
  itemId: string;
  title: BiText;
  meta: BiText | null;
  hours: number | null;
  pinned: 'expiry' | 'must_keep' | null;
  score: number;
  reasons: Reason[];
  competencyIds: string[];
  link: string;
  action: CoachAction;
  session: { id: string; starts_at: string; left: number; capacity: number; waiting: number } | null;
  saved: boolean;
  /** Days to expiry (refresher pins) or to the due date (must-keep pins). */
  days: number | null;
}
export interface CoachResult {
  feed: CoachCard[];
  /** Every candidate considered (including those not in the feed), keyed by card id: the Saved tab resolves from here. */
  pool: Map<string, CoachCard>;
  hidden: CoachCard[];
  needs: { competency_id: string; role_id: string; need: number; have: number; weight: number }[];
  /** The target roles the feed planned for (after removing my own role, unknown and security roles). */
  targets: string[];
  kindFactor: Record<string, number>;
}

// ───────────── feedback -> per-person weights
export function feedbackWeights(feedback: FeedbackLite[], now: string) {
  const comp = new Map<string, number>();
  const kind: Record<string, number> = {};
  const pos = (s: string) => s === 'saved' || s === 'enrolled';
  const hidden = new Set<string>();
  const saved = new Set<string>();
  const cnt: Record<string, { p: number; n: number }> = {};
  const cc: Record<string, { p: number; n: number }> = {};
  for (const f of feedback) {
    const id = `${f.item_kind}:${f.item_id}`;
    if (f.signal === 'dismissed' && (!f.hidden_until || f.hidden_until > now.slice(0, 10))) hidden.add(id);
    if (f.signal === 'saved') saved.add(id);
    if (f.signal === 'cleared') continue;
    const k = (cnt[f.item_kind] ??= { p: 0, n: 0 });
    if (pos(f.signal)) k.p++; else if (f.signal === 'dismissed') k.n++;
    for (const c of f.competency_ids ?? []) {
      const x = (cc[c] ??= { p: 0, n: 0 });
      if (pos(f.signal)) x.p++; else if (f.signal === 'dismissed') x.n++;
    }
  }
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  for (const [c, x] of Object.entries(cc)) comp.set(c, r4(clamp(1.15 ** x.p * 0.75 ** x.n, 0.4, 1.6)));
  for (const [k, x] of Object.entries(cnt)) kind[k] = r4(clamp(1 + 0.1 * x.p - 0.15 * x.n, 0.5, 1.5));
  return { comp, kind, hidden, saved };
}

/** The roles the coach plans for: shortlist/plan/focus targets, without my own role, unknown roles or security roles (path only). */
export function coachTargets(input: Pick<CoachInput, 'roleId' | 'roles'> & { candidates: (string | null | undefined)[] }, max = 3): string[] {
  const roles = new Map(input.roles.map((x) => [x.id, x]));
  const out: string[] = [];
  for (const id of input.candidates) {
    if (!id || id === input.roleId || out.includes(id)) continue;
    const role = roles.get(id);
    if (!role || role.security_sensitive) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/** A practice form may be served only if it is an approved practice form and every item is an approved open-practice item. */
export function practiceSafe(form: FormLite, items: Map<string, ItemLite>): boolean {
  if (!form.is_practice || form.kind !== 'practice' || form.status !== 'approved' || !form.item_ids.length) return false;
  return form.item_ids.every((id) => {
    const it = items.get(id);
    return !!it && it.bank === 'practice' && it.is_practice !== false && it.status === 'approved';
  });
}

export function buildCoachFeed(input: CoachInput): CoachResult {
  const now = input.now.slice(0, 10);
  const ws = input.weights ?? {};
  const wt = (k: string, d: number) => (typeof ws[k] === 'number' ? ws[k] : d);
  const fb = feedbackWeights(input.feedback, now);
  const roles = new Map(input.roles.map((x) => [x.id, x]));
  const comps = new Map(input.competencies.map((c) => [c.id, c]));
  const roleLabel = (id: string): BiText => bi(roles.get(id) as never, 'title', id);
  const compLabel = (id: string): BiText => bi(comps.get(id) as never, 'name', id);
  const courses = new Map(input.courses.map((c) => [c.id, c]));
  const standards = new Map(input.standards.map((s) => [s.id, s]));
  const targets = coachTargets({ roleId: input.roleId, roles: input.roles, candidates: input.targets });
  const roleWeight = new Map<string, number>();
  if (input.roleId) roleWeight.set(input.roleId, wt('current_role', DEFAULT_RECOMMEND.current_role));
  for (const tId of targets) roleWeight.set(tId, wt('target_role', DEFAULT_RECOMMEND.target_role));
  const securityRole = (id: string | null) => !!(id && roles.get(id)?.security_sensitive);

  // needs, scaled by feedback per competency
  const needs: { key: string; need: number; have: number; importance: 'core' | 'important' | 'useful'; weight: number; label: BiText; role: BiText; role_id: string }[] = [];
  for (const [roleId, w] of roleWeight) {
    if (securityRole(roleId)) continue;
    for (const rc of input.roleComps.filter((x) => x.role_id === roleId)) {
      needs.push({ key: rc.competency_id, need: rc.required_level, have: input.have.get(rc.competency_id) ?? 0, importance: (['core', 'important', 'useful'].includes(rc.importance) ? rc.importance : 'useful') as never,
        weight: r4(w * (fb.comp.get(rc.competency_id) ?? 1)), label: compLabel(rc.competency_id), role: roleLabel(rc.role_id), role_id: roleId });
    }
  }
  const current = input.roleId && !securityRole(input.roleId) ? input.roleComps.filter((x) => x.role_id === input.roleId) : [];
  const keepComps = current.filter((x) => (input.have.get(x.competency_id) ?? 0) >= x.required_level && x.importance !== 'useful');
  const impW = (imp: string) => wt(imp, (DEFAULT_RECOMMEND as Record<string, number>)[imp] ?? 1);

  // what I already have or am doing
  const doneCourses = new Set(input.records.filter((x) => DONE_RESULTS.includes(x.result)).map((x) => x.course_id));
  for (const e of input.enrolments) if (e.status === 'completed') doneCourses.add(e.course_id);
  // open enrolments per course: the earliest due one stands for the course; a course counts as booked if any has a session
  const openList = input.enrolments.filter((e) => OPEN.includes(e.status)).sort((a, b) => String(a.due_on ?? '9999').localeCompare(String(b.due_on ?? '9999')) || (a.id < b.id ? -1 : 1));
  const openEnrol = new Map<string, EnrolmentLite>();
  for (const e of openList) if (!openEnrol.has(e.course_id)) openEnrol.set(e.course_id, e);
  const booked = new Set(openList.filter((e) => e.session_id && e.status !== 'requested').map((e) => e.course_id));
  const nowTs = `${now}T23:59:59Z`;
  type Slot = { id: string; starts_at: string; capacity: number; left: number; waiting: number };
  const nextSession = (courseId: string): Slot | null => {
    const list = input.sessions
      .filter((x) => x.course_id === courseId && (x.status ?? 'scheduled') === 'scheduled' && x.starts_at > nowTs && (x.audience ?? 'staff') === 'staff' && (!x.crew || !input.crew || x.crew === input.crew))
      .sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0))
      .map((x) => {
        const a = input.availability?.[x.id];
        return { id: x.id, starts_at: x.starts_at, capacity: x.capacity, left: Math.max(0, x.capacity - (a?.taken ?? 0)), waiting: a?.waiting ?? 0 };
      });
    return list.find((x) => x.left > 0) ?? list[0] ?? null;
  };
  const sessionReason = (s: Slot | null): Reason[] =>
    !s ? [] : s.left > 0 ? [r('seats', { n: s.left, date: s.starts_at.slice(0, 10) }, { table: 'sessions', id: s.id })] : [r('waitlist', { n: s.waiting, date: s.starts_at.slice(0, 10) }, { table: 'sessions', id: s.id })];
  const courseMeta = (c: CourseLite): BiText => ({ en: `${c.code} · ${c.modality}`, ar: `${c.code} · ${c.modality}` });

  const pool = new Map<string, CoachCard>();
  const card = (c: Omit<CoachCard, 'saved'>): CoachCard => {
    const full = { ...c, saved: fb.saved.has(c.id) };
    if (!pool.has(c.id)) pool.set(c.id, full);
    return full;
  };
  const fbReasons = (kind: string, compIds: string[]): Reason[] => {
    const k = fb.kind[kind] ?? 1;
    const cs = compIds.map((x) => fb.comp.get(x) ?? 1);
    const up = k > 1 || cs.some((x) => x > 1);
    const down = k < 1 || cs.some((x) => x < 1);
    return up && !down ? [r('feedback_up')] : down && !up ? [r('feedback_down')] : [];
  };

  // The continuing-training course that keeps a qualification current: a non-initial staff course that the skills catalogue
  // lists as evidence together with the standard (F01 evidence_keys), preferring qualifying courses; generic all-staff
  // curriculum courses never count. No match: the card points to /my/quals.
  const roleCount = new Set(input.curriculum.map((x) => x.role_id)).size || 1;
  const curriculumShare = new Map<string, number>();
  for (const x of input.curriculum) curriculumShare.set(x.course_id, (curriculumShare.get(x.course_id) ?? 0) + 1 / roleCount);
  const refresherFor = (st: StandardLite): CourseLite | undefined => {
    const score = new Map<string, number>();
    for (const sk of input.skills ?? []) {
      const keys = sk.evidence_keys ?? [];
      if (!keys.includes(st.id)) continue;
      for (const k of keys) if (courses.has(k)) score.set(k, (score.get(k) ?? 0) + 1);
    }
    return [...score.entries()]
      .map(([id, n]) => ({ c: courses.get(id)!, n }))
      .filter(({ c }) => c.initial === false && c.audience === 'staff' && (curriculumShare.get(c.id) ?? 0) <= 0.5)
      .sort((a, b) => b.n - a.n || Number(!!b.c.qualifying) - Number(!!a.c.qualifying) || (a.c.id < b.c.id ? -1 : 1))[0]?.c;
  };

  // ── pinned 1: expiring qualifications (never security-restricted ones: status only)
  const pins: CoachCard[] = [];
  const pinnedCourses = new Set<string>();
  const notice = new Map((input.requalRules ?? []).map((x) => [x.standard_id, Math.max(...(x.notice_days?.length ? x.notice_days : [PIN_WINDOW_DEFAULT]))]));
  for (const q of input.quals) {
    const st = standards.get(q.standard_id);
    if (!q.expires_on || !st || st.security_restricted || q.security_mirror_only) continue;
    if (!['qualified', 'due', 'renewed', 'expired'].includes(q.status)) continue;
    const days = daysFrom(now, q.expires_on);
    const window = Math.max(PIN_WINDOW_DEFAULT, notice.get(q.standard_id) ?? PIN_WINDOW_DEFAULT);
    if (days > window || days < -365) continue;
    const refresh = refresherFor(st);
    const s = refresh ? nextSession(refresh.id) : null;
    const reasons: Reason[] = [days >= 0 ? r('expires', { qual: bi(st as never, 'title'), n: days }, { table: 'qual_records', id: q.id }) : r('expired', { qual: bi(st as never, 'title'), n: -days }, { table: 'qual_records', id: q.id })];
    if (refresh) reasons.push(r('refresher_course', { course: bi(refresh as never, 'title') }, { table: 'courses', id: refresh.id }), ...sessionReason(s));
    else reasons.push(r('refresher_quals'));
    if (refresh) pinnedCourses.add(refresh.id);
    const enrolledInSession = !!refresh && booked.has(refresh.id);
    pins.push(card({
      id: `refresher:${q.id}`, kind: 'refresher', itemId: q.id, title: bi(st as never, 'title'), meta: refresh ? { en: `${st.code} → ${refresh.code}`, ar: `${st.code} ← ${refresh.code}` } : { en: st.code, ar: st.code },
      hours: refresh?.duration_hours != null ? Number(refresh.duration_hours) : null, pinned: 'expiry', score: r4(1000 - days), reasons, competencyIds: refresh?.competency_ids ?? [],
      link: refresh ? `/learn/course/${refresh.id}` : '/my/quals',
      action: refresh && s && !enrolledInSession ? { type: 'enrol', courseId: refresh.id, sessionId: s.id, full: s.left <= 0 } : { type: 'link', to: refresh && enrolledInSession ? '/my/learning' : '/my/quals', label: refresh && enrolledInSession ? 'openLearning' : 'openQuals' },
      session: s, days,
    }));
  }
  pins.sort((a, b) => (a.days ?? 0) - (b.days ?? 0) || (a.id < b.id ? -1 : 1));

  // ── pinned 2: must-keep items of my current role (open mandatory assignments due within 60 days or overdue)
  const mustKeep: CoachCard[] = [];
  for (const e of [...openEnrol.values()].sort((a, b) => String(a.due_on ?? '9999').localeCompare(String(b.due_on ?? '9999')) || (a.course_id < b.course_id ? -1 : 1))) {
    const c = courses.get(e.course_id);
    if (!c || pinnedCourses.has(c.id) || !e.due_on || e.status === 'requested' || e.status === 'waitlisted') continue;
    if (!(e.source === 'role_rule' || c.mandatory)) continue;
    const days = daysFrom(now, e.due_on);
    if (days > MUST_KEEP_DAYS) continue;
    const s = booked.has(c.id) ? null : nextSession(c.id);
    mustKeep.push(card({
      id: `course:${c.id}`, kind: 'course', itemId: c.id, title: bi(c as never, 'title'), meta: courseMeta(c), hours: c.duration_hours != null ? Number(c.duration_hours) : null, pinned: 'must_keep',
      score: r4(500 - days), reasons: [days >= 0 ? r('must_keep', { date: e.due_on, n: days }, { table: 'enrolments', id: e.id }) : r('must_keep_overdue', { date: e.due_on, n: -days }, { table: 'enrolments', id: e.id }), ...sessionReason(s)],
      competencyIds: c.competency_ids, link: `/learn/course/${c.id}`,
      action: s ? { type: 'enrol', courseId: c.id, sessionId: s.id, full: s.left <= 0 } : { type: 'link', to: '/my/learning', label: 'openLearning' }, session: s, days,
    }));
    if (mustKeep.length >= MUST_KEEP_MAX) break;
  }

  // ── ranked candidates per kind
  const gapRank = <T,>(cands: { id: string; effortHours: number | null | undefined; gives: { key: string; level: number }[]; item?: T }[]) => byGapClosure(cands, needs, ws);
  const keepScore = (compIds: string[]) => {
    let v = 0;
    const out: Reason[] = [];
    for (const k of keepComps.filter((x) => compIds.includes(x.competency_id))) {
      v += 0.5 * impW(k.importance) * wt('current_role', DEFAULT_RECOMMEND.current_role);
      out.push(r('keep_sharp', { skill: compLabel(k.competency_id), role: roleLabel(k.role_id) }));
    }
    return { v, reasons: out };
  };
  const ranked: Record<string, CoachCard[]> = { course: [], practice: [], ojt: [], mentor: [], opportunity: [], reading: [] };
  const kf = (k: string) => fb.kind[k] ?? 1;

  // courses
  const courseCands = input.courses.filter((c) => c.audience === 'staff' && !doneCourses.has(c.id) && !openEnrol.has(c.id) && !pinnedCourses.has(c.id) && (c.prerequisites ?? []).every((p) => doneCourses.has(p)));
  for (const x of gapRank(courseCands.map((c) => ({ id: c.id, effortHours: c.duration_hours == null ? null : Number(c.duration_hours), gives: c.competency_ids.map((k) => ({ key: k, level: c.qualifying ? 2 : 1 })), item: c })))) {
    const c = x.item!;
    const s = nextSession(c.id);
    ranked.course.push(card({
      id: `course:${c.id}`, kind: 'course', itemId: c.id, title: bi(c as never, 'title'), meta: courseMeta(c), hours: c.duration_hours != null ? Number(c.duration_hours) : null, pinned: null,
      score: x.score, reasons: [...x.reasons, ...sessionReason(s), ...(s ? [] : [r('no_session')]), ...fbReasons('course', c.competency_ids)], competencyIds: c.competency_ids, link: `/learn/course/${c.id}`,
      action: { type: 'enrol', courseId: c.id, sessionId: s?.id ?? null, full: !!s && s.left <= 0 }, session: s, days: null,
    }));
  }

  // practice quizzes (open practice bank only)
  const items = new Map(input.items.map((i) => [i.id, i]));
  for (const f of input.forms.filter((x) => practiceSafe(x, items))) {
    const compIds = [...new Set(f.item_ids.map((i) => items.get(i)!.competency_id).filter((c): c is string => !!c))].sort();
    const g = gapRank([{ id: f.id, effortHours: (f.time_limit_min ?? 20) / 60, gives: compIds.map((k) => ({ key: k, level: 1 })) }])[0];
    const keep = keepScore(compIds);
    const score = (g?.score ?? 0) + keep.v;
    if (score <= 0) continue;
    ranked.practice.push(card({
      id: `practice:${f.id}`, kind: 'practice', itemId: f.id, title: bi(f as never, 'title'), meta: null, hours: r4((f.time_limit_min ?? 20) / 60), pinned: null, score: r4(score),
      reasons: [...(g?.reasons.filter((x) => x.code !== 'effort') ?? []), ...keep.reasons, r('practice_bank', { n: f.item_ids.length, min: f.time_limit_min ?? 20 }), ...fbReasons('practice', compIds)],
      competencyIds: compIds, link: `/learn/practice/${f.id}`, action: { type: 'link', to: `/learn/practice/${f.id}`, label: 'openPractice' }, session: null, days: null,
    }));
  }

  // OJT tasks from qualification standards of my role and targets (never security-restricted standards)
  const heldStd = new Map(input.quals.map((q) => [q.standard_id, q]));
  const passedTasks = new Set((input.evaluations ?? []).filter((e) => e.result === 'pass' && e.task_id).map((e) => e.task_id!));
  for (const [roleId] of roleWeight) {
    if (securityRole(roleId)) continue;
    for (const st of input.standards.filter((x) => x.role_ids.includes(roleId) && (x.status ?? 'current') === 'current' && !x.security_restricted)) {
      const held = heldStd.get(st.id);
      if (held && ['qualified', 'renewed', 'due'].includes(held.status)) continue;
      const tasks = input.tasks.filter((t) => t.standard_id === st.id && ['ojt', 'jpm', 'simulator'].includes(t.method) && !passedTasks.has(t.id)).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.id < b.id ? -1 : 1));
      if (!tasks.length) continue;
      const rc = input.roleComps.filter((x) => x.role_id === roleId);
      const g = gapRank([{ id: st.id, effortHours: 8 * tasks.length, gives: rc.map((x) => ({ key: x.competency_id, level: x.required_level })) }])[0];
      if (!g) continue;
      tasks.slice(0, 2).forEach((t, i) => {
        ranked.ojt.push(card({
          id: `ojt:${t.id}`, kind: 'ojt', itemId: t.id, title: bi(t as never, 'statement'), meta: { en: `${t.code} · ${st.code}`, ar: `${t.code} · ${st.code}` }, hours: 8, pinned: null, score: r4(g.score / (i + 1)),
          reasons: [r('ojt_task', { standard: bi(st as never, 'title'), role: roleLabel(roleId), evaluator: t.evaluator_role }, { table: 'task_items', id: t.id }), ...g.reasons.filter((x) => x.code !== 'effort').slice(0, 2), ...(t.critical ? [r('ojt_critical')] : []), ...fbReasons('ojt', rc.map((x) => x.competency_id))],
          competencyIds: rc.map((x) => x.competency_id), link: '/my/plan', action: { type: 'link', to: '/my/plan', label: 'openStandard' }, session: null, days: null,
        }));
      });
    }
  }

  // mentors (human matching through /my/mentoring; the coach only suggests)
  const asked = new Set((input.mentorRequests ?? []).filter((m) => ['requested', 'matched'].includes(m.status)).map((m) => m.mentor_id));
  for (const m of input.mentors.filter((x) => x.opt_in && x.person_id !== input.personId && !asked.has(x.id))) {
    const rc = m.role_id ? input.roleComps.filter((x) => x.role_id === m.role_id) : [];
    const gives = rc.map((x) => ({ key: x.competency_id, level: Math.min(x.required_level, (input.have.get(x.competency_id) ?? 0) + 1) }));
    const g = gapRank([{ id: m.id, effortHours: 2, gives }])[0];
    const isTarget = !!m.role_id && targets.includes(m.role_id);
    const interestHit = m.interests.filter((i) => targets.some((tId) => roleLabel(tId).en.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 3 && !['incl', 'unit', 'and', 'the'].includes(w) && i.toLowerCase().split(/[^a-z0-9]+/).includes(w))));
    const score = (g?.score ?? 0) + (isTarget ? 2 : 0) + interestHit.length * 0.5;
    if (score <= 0) continue;
    ranked.mentor.push(card({
      id: `mentor:${m.id}`, kind: 'mentor', itemId: m.id, title: m.role_id ? roleLabel(m.role_id) : { en: m.id, ar: m.id }, meta: { en: m.bio_en ?? '', ar: m.bio_ar || m.bio_en || '' }, hours: 2, pinned: null, score: r4(score),
      reasons: [...(isTarget ? [r('mentor_target', { role: roleLabel(m.role_id!) })] : []), ...(m.role_id && !isTarget ? [r('mentor_role', { role: roleLabel(m.role_id) })] : []), ...(g?.reasons.filter((x) => x.code !== 'effort').slice(0, 2) ?? []),
        ...(interestHit.length ? [r('mentor_interest_match', { interests: interestHit.join(', ') })] : m.interests.length ? [r('mentor_interests', { interests: m.interests.join(', ') })] : []), ...fbReasons('mentor', rc.map((x) => x.competency_id))],
      competencyIds: rc.map((x) => x.competency_id), link: '/my/mentoring', action: { type: 'link', to: '/my/mentoring', label: 'openMentoring' }, session: null, days: null,
    }));
  }

  // readings: operating-experience lessons linked to the qualification cards of my role, my targets or my records
  const stdWeight = new Map<string, { w: number; role: string }>();
  for (const [roleId, w] of roleWeight) for (const st of input.standards.filter((x) => x.role_ids.includes(roleId) && !x.security_restricted)) if ((stdWeight.get(st.id)?.w ?? 0) < w) stdWeight.set(st.id, { w, role: roleId });
  for (const q of input.quals) if (!stdWeight.has(q.standard_id) && !standards.get(q.standard_id)?.security_restricted) stdWeight.set(q.standard_id, { w: 0.8, role: input.roleId ?? '' });
  for (const l of input.lessons.filter((x) => x.status === 'published')) {
    const linked = l.affected_standard_ids.filter((sId) => stdWeight.has(sId)).sort((a, b) => stdWeight.get(b)!.w - stdWeight.get(a)!.w || (a < b ? -1 : 1));
    const recency = Math.max(0, 1 - daysFrom(l.reviewed_on, now) / 730) * 0.2;
    const score = linked.length ? stdWeight.get(linked[0])!.w + recency : 0.05 + recency / 2;
    const st = linked.length ? standards.get(linked[0]) : null;
    ranked.reading.push(card({
      id: `reading:${l.id}`, kind: 'reading', itemId: l.id, title: bi(l as never, 'title'), meta: null, hours: 0.25, pinned: null, score: r4(score),
      reasons: [st ? r('reading_standard', { standard: bi(st as never, 'title') }, { table: 'qual_standards', id: st.id }) : r('reading_general'), r('reading_reviewed', { date: l.reviewed_on, body: l.reviewing_body }), ...fbReasons('reading', [])],
      competencyIds: [], link: `/oe#${l.id}`, action: { type: 'link', to: `/oe#${l.id}`, label: 'openLesson' }, session: null, days: null,
    }));
  }

  // opportunities (F08 marketplace rows, when present): skills gained in my gaps
  const skillComp = new Map((input.skills ?? []).map((s) => [s.id, s.competency_id]));
  for (const o of (input.opportunities ?? []).filter((x) => x.status === 'open' && !SECURITY_OPP_KINDS.includes(x.kind))) {
    const compIds = [...new Set((o.skills_gained ?? []).map((s) => skillComp.get(s) ?? (comps.has(s) ? s : null)).filter((c): c is string => !!c))].sort();
    const g = gapRank([{ id: o.id, effortHours: Math.max(1, Number(o.hours_week ?? 4)), gives: compIds.map((k) => ({ key: k, level: Math.min(3, (input.have.get(k) ?? 0) + 1) })) }])[0];
    if (!g) continue;
    ranked.opportunity.push(card({
      id: `opportunity:${o.id}`, kind: 'opportunity', itemId: o.id, title: { en: o.title_en, ar: o.title_ar || o.title_en }, meta: null, hours: o.hours_week ?? null, pinned: null, score: g.score,
      reasons: [...g.reasons.filter((x) => x.code !== 'effort'), ...(o.hours_week ? [r('opportunity_hours', { hours: o.hours_week })] : []), ...fbReasons('opportunity', compIds)],
      competencyIds: compIds, link: `/opportunities`, action: { type: 'link', to: '/opportunities', label: 'openOpportunity' }, session: null, days: null,
    }));
  }

  // hide dismissed (90 days) and order each kind by score
  const hidden: CoachCard[] = [];
  for (const k of Object.keys(ranked)) {
    ranked[k] = ranked[k].filter((c) => (fb.hidden.has(c.id) ? (hidden.push(c), false) : true)).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  }
  // must-keep may be dismissed? No: mandatory items and expiring qualifications always show.
  const feed: CoachCard[] = [...pins, ...mustKeep].slice(0, FEED_MAX);
  const seen = new Set(feed.map((c) => c.id));
  const taken: Record<string, number> = {};
  const kinds = Object.keys(MIX) as (keyof typeof MIX)[];
  while (feed.length < FEED_MAX) {
    let best: { k: keyof typeof MIX; q: number } | null = null;
    for (const k of kinds) {
      const n = taken[k] ?? 0;
      const next = ranked[k].find((c) => !seen.has(c.id));
      if (!next || n >= KIND_CAP[k]) continue;
      const q = (MIX[k] * kf(k)) / (2 * n + 1);
      if (!best || q > best.q) best = { k, q };
    }
    if (!best) break;
    const c = ranked[best.k].find((x) => !seen.has(x.id))!;
    taken[best.k] = (taken[best.k] ?? 0) + 1;
    seen.add(c.id);
    feed.push({ ...c, reasons: c.reasons.length ? c.reasons : [r('general')] });
  }
  // short feed (few gaps, no targets): relax the per-kind caps until the minimum is reached
  if (feed.length < FEED_MIN) {
    const rest = kinds.flatMap((k) => ranked[k]).filter((c) => !seen.has(c.id)).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    for (const c of rest) {
      if (feed.length >= FEED_MIN) break;
      seen.add(c.id);
      feed.push(c);
    }
  }
  return {
    feed: feed.map((c, i) => ({ ...c, score: c.pinned ? c.score : r4(FEED_MAX - i) })),
    pool,
    hidden: hidden.filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i),
    needs: needs.map((n) => ({ competency_id: n.key, role_id: n.role_id, need: n.need, have: n.have, weight: n.weight })),
    targets,
    kindFactor: Object.fromEntries(kinds.map((k) => [k, kf(k)])),
  };
}

/** Feed as F02 Ranked items (for lintRanked and the engine model slot payload). */
export const asRanked = (cards: CoachCard[]): Ranked<CoachCard>[] => cards.map((c) => ({ id: c.id, score: c.score, reasons: c.reasons, item: c }));
/** Re-export so pages can label engine reasons with the same helper. */
export { engineReason };
