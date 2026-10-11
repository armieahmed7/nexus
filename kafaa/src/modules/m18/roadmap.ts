/**
 * F06 Career Roadmap and what-if simulator (pure, import-free: the seed builder loads it directly).
 * Lays a chosen route (career_paths edges from the current role to the target) out as a dated, quarter-by-quarter plan:
 *   experience blocks (months conditions, counted from the person's own records), programme blocks (published durations from
 *   kafaa_programmes with their source, or an indicative SAMPLE length), REG-17 milestones (internal exam, FANR 60-day notice,
 *   FANR exam, certification), licensee checks and development blocks (rotation, mentoring, leadership course, gap courses).
 * Programmes start at the next quarterly intake on or after the date the gate conditions allow, plus the what-if delay, so a
 * scenario can never start a programme before the person is eligible. Every dependent milestone moves with its programme.
 */

export interface BiText { en: string; ar: string }
export interface SourceRef { id: string; label: string; url: string }
export interface RmCond { kind: string; value: string | number; en: string; ar: string }
export interface RmEdge { id: string; from_role_id: string | null; to_role_id: string; type: string; route_code?: string | null; label_en: string; label_ar: string; conditions: RmCond[] | unknown; rule_ref?: string | null }
export interface RmProgramme { id: string; code: string; name_en: string; name_ar: string; weeks?: number | string | null; sources?: SourceRef[] | unknown }
export interface RmCourse { id: string; title_en: string; title_ar: string; duration_hours?: number | string | null }

export interface Scenario {
  /** Edge ids of the chosen route, in order (from the current role to the target). */
  path: string[];
  /** Start the first programme this many quarterly intakes after the earliest intake the gates allow (0..12). */
  delayQ: number;
  rotation: boolean;
  mentoring: boolean;
  leadership: boolean;
  courses: boolean;
}
export const DEFAULT_SCENARIO: Omit<Scenario, 'path'> = { delayQ: 0, rotation: false, mentoring: true, leadership: false, courses: true };
export const MAX_DELAY_Q = 12;
export const HORIZON_QUARTERS = 40;
/** Indicative values (SAMPLE): shown with an "indicative" tag in the page, print and export. */
export const INDICATIVE = { qualifyMonths: 6, programmeWeeks: 12, fanrAfterDays: 90, certAfterDays: 30, medicalBeforeDays: 90, rotationMonths: 3, mentoringMonths: 6, leadershipMonths: 3, courseMonths: 3 };
export const FANR_NOTICE_DAYS = 60;

export type Lane = 'experience' | 'programme' | 'milestone' | 'development';
export type BlockKind = 'qualify' | 'experience' | 'programme' | 'bridge' | 'internal_exam' | 'fanr_notice' | 'fanr_exam' | 'certification' | 'clearance' | 'medical' | 'appointment' | 'move' | 'rotation' | 'mentoring' | 'leadership' | 'course';
export interface Block {
  id: string;
  lane: Lane;
  kind: BlockKind;
  title: BiText;
  start: string;
  end: string;
  /** Duration as published (weeks or months) or indicative. */
  weeks?: number;
  months?: number;
  source: SourceRef | null;
  rule_ref?: string | null;
  indicative: boolean;
  critical: boolean;
  /** Development blocks only: becomes a plan activity. */
  plan_kind?: 'course' | 'mentoring' | 'project';
  course_id?: string | null;
  edge_id?: string | null;
}
export interface Roadmap {
  blocks: Block[];
  start: string;
  end: string;
  months: number;
  /** End date of the same route with no delay and no rotation. */
  earliest: string;
  beyondHorizon: boolean;
  firstProgramme: BiText | null;
}
export interface RoadmapInput {
  now: string;
  roleId: string;
  monthsInRole: number;
  qualifiedInRole: boolean;
  edges: RmEdge[];
  roles: { id: string; title_en: string; title_ar: string }[];
  programmes: RmProgramme[];
  sources?: SourceRef[];
  gapCourses?: RmCourse[];
  leadershipCourse?: RmCourse | null;
  /** FS15: concept role ids (FS05 lifecycle 'concept'). A route into one ends with an indicative bridge-learning block sized by
   *  the person's gaps against the concept profile (bridgeMonths) and a "profile-ready" milestone instead of a move. */
  conceptRoles?: string[];
  bridgeMonths?: number;
}

// ───────────── UTC date helpers (ISO yyyy-mm-dd)
const D = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + Math.round(n)); return iso(d); };
export function addMonths(s: string, n: number): string {
  const d = D(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}
/** First day of the quarter that contains the date. */
export const quarterStart = (s: string) => { const d = D(s); return iso(new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1))); };
/** Next quarterly intake on or after the date. */
export const nextIntake = (s: string) => (quarterStart(s) === s.slice(0, 10) ? s.slice(0, 10) : addMonths(quarterStart(s), 3));
export const quarterIndex = (start: string, s: string) => { const a = D(quarterStart(start)), b = D(s); return (b.getUTCFullYear() - a.getUTCFullYear()) * 4 + Math.floor(b.getUTCMonth() / 3) - Math.floor(a.getUTCMonth() / 3); };
export const quarterLabel = (s: string) => { const d = D(s); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
export const maxDate = (...xs: string[]) => xs.reduce((m, x) => (x > m ? x : m));
const monthsDiff = (a: string, b: string) => { const x = D(a), y = D(b); return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth()) - (y.getUTCDate() < x.getUTCDate() ? 1 : 0); };

const condsOf = (e: { conditions: unknown }): RmCond[] => (Array.isArray(e.conditions) ? (e.conditions as RmCond[]) : []);
const edgeMonths = (e: { conditions: unknown }) => condsOf(e).reduce((m, c) => (c.kind === 'months' && typeof c.value === 'number' ? Math.max(m, c.value) : m), 0);

/** Candidate routes from the current role to the target: simple paths over progression edges, shortest first (max 4 steps). */
export function routeOptions(edges: RmEdge[], from: string, to: string, maxDepth = 4, max = 4): RmEdge[][] {
  if (!from || !to || from === to) return [];
  const out: RmEdge[][] = [];
  const walk = (at: string, seen: Set<string>, acc: RmEdge[]) => {
    if (acc.length >= maxDepth) return;
    for (const e of edges) {
      if (e.from_role_id !== at || seen.has(e.to_role_id)) continue;
      const next = [...acc, e];
      if (e.to_role_id === to) out.push(next);
      else { seen.add(e.to_role_id); walk(e.to_role_id, seen, next); seen.delete(e.to_role_id); }
    }
  };
  walk(from, new Set([from]), []);
  const months = (p: RmEdge[]) => p.reduce((s, e) => s + edgeMonths(e), 0);
  return out.sort((a, b) => a.length - b.length || months(a) - months(b) || (a.map((e) => e.id).join() < b.map((e) => e.id).join() ? -1 : 1)).slice(0, max);
}

function programmeFor(code: string, programmes: RmProgramme[]): RmProgramme | null {
  const codes = code.toUpperCase().split('/');
  return programmes.find((p) => codes.includes(p.code.toUpperCase()) && Number(p.weeks) > 0) ?? null;
}
const firstSource = (p: RmProgramme | null): SourceRef | null => (p && Array.isArray(p.sources) && p.sources[0] ? (p.sources[0] as SourceRef) : null);

/** Build the dated roadmap for one scenario. Deterministic: same input and scenario, same blocks. */
export function buildRoadmap(input: RoadmapInput, s: Scenario): Roadmap {
  const roleTitle = (id: string): BiText => { const r = input.roles.find((x) => x.id === id); return r ? { en: r.title_en, ar: r.title_ar } : { en: id, ar: id }; };
  const regSource = input.sources?.find((x) => x.id === 'fanr-reg17') ?? null;
  const path = s.path.map((id) => input.edges.find((e) => e.id === id)).filter(Boolean) as RmEdge[];
  const blocks: Block[] = [];
  const now = input.now.slice(0, 10);
  let cursor = now;
  let firstProgramme: BiText | null = null;
  let delayUsed = false;
  // Development blocks run in parallel from today; a rotation is taken before the first programme.
  let rotationEnd = now;
  if (s.rotation) {
    rotationEnd = addMonths(now, INDICATIVE.rotationMonths);
    blocks.push({ id: 'dev-rotation', lane: 'development', kind: 'rotation', title: { en: 'Development rotation', ar: 'تدوير تطويري' }, start: now, end: rotationEnd, months: INDICATIVE.rotationMonths, source: null, indicative: true, critical: false, plan_kind: 'project' });
  }
  if (s.mentoring) blocks.push({ id: 'dev-mentoring', lane: 'development', kind: 'mentoring', title: { en: 'Mentoring with an experienced colleague in the target role', ar: 'إرشاد مع زميل متمرّس في الدور المستهدف' }, start: now, end: addMonths(now, INDICATIVE.mentoringMonths), months: INDICATIVE.mentoringMonths, source: null, indicative: true, critical: false, plan_kind: 'mentoring' });
  if (s.leadership && input.leadershipCourse) {
    const c = input.leadershipCourse;
    blocks.push({ id: `dev-leadership-${c.id}`, lane: 'development', kind: 'leadership', title: { en: c.title_en, ar: c.title_ar }, start: addMonths(now, 3), end: addMonths(now, 3 + INDICATIVE.leadershipMonths), months: INDICATIVE.leadershipMonths, source: null, indicative: true, critical: false, plan_kind: 'course', course_id: c.id });
  }
  if (s.courses) (input.gapCourses ?? []).slice(0, 3).forEach((c, i) => {
    const st = addMonths(now, i * INDICATIVE.courseMonths);
    blocks.push({ id: `dev-course-${c.id}`, lane: 'development', kind: 'course', title: { en: c.title_en, ar: c.title_ar }, start: st, end: addMonths(st, INDICATIVE.courseMonths), months: INDICATIVE.courseMonths, source: null, indicative: true, critical: false, plan_kind: 'course', course_id: c.id });
  });

  path.forEach((e, i) => {
    const from = e.from_role_id ?? input.roleId;
    const to = roleTitle(e.to_role_id);
    const conds = condsOf(e);
    let served = 0;
    if (i === 0) {
      if (!input.qualifiedInRole) {
        const end = addMonths(cursor, INDICATIVE.qualifyMonths);
        blocks.push({ id: 'qualify', lane: 'experience', kind: 'qualify', title: { en: `Complete the ${roleTitle(from).en} qualification`, ar: `إكمال تأهيل ${roleTitle(from).ar}` }, start: cursor, end, months: INDICATIVE.qualifyMonths, source: null, indicative: true, critical: true });
        cursor = end;
      } else served = input.monthsInRole;
    }
    const need = edgeMonths(e);
    const remaining = Math.max(0, need - served);
    if (remaining > 0) {
      const end = addMonths(cursor, remaining);
      blocks.push({ id: `exp-${i}`, lane: 'experience', kind: 'experience', title: { en: `${need} months as ${roleTitle(from).en}${served ? ` (${served} done)` : ''}`, ar: `${need} شهراً بدور ${roleTitle(from).ar}${served ? ` (أُنجز ${served})` : ''}` }, start: cursor, end, months: remaining, source: null, rule_ref: e.rule_ref ?? null, indicative: false, critical: true, edge_id: e.id });
      cursor = end;
    }
    const eligible = cursor;
    let gateDate = i === 0 && s.rotation ? maxDate(eligible, rotationEnd) : eligible;
    if (i === 0 && s.rotation && rotationEnd > eligible) { const r = blocks.find((b) => b.id === 'dev-rotation'); if (r) r.critical = true; }
    const progs = conds.filter((c) => c.kind === 'programme');
    let progStart: string | null = null;
    let progEnd = gateDate;
    progs.forEach((c, j) => {
      const p = programmeFor(String(c.value), input.programmes);
      let start = j === 0 ? nextIntake(gateDate) : progEnd;
      if (!delayUsed && j === 0) { start = addMonths(start, 3 * Math.max(0, Math.min(MAX_DELAY_Q, s.delayQ))); delayUsed = true; }
      const weeks = p ? Number(p.weeks) : INDICATIVE.programmeWeeks;
      const end = addDays(start, weeks * 7);
      const title: BiText = p ? { en: `${p.name_en} (${p.code})`, ar: `${p.name_ar} (${p.code})` } : { en: c.en, ar: c.ar };
      if (!firstProgramme) firstProgramme = title;
      blocks.push({ id: `prog-${i}-${j}`, lane: 'programme', kind: 'programme', title, start, end, weeks, source: firstSource(p), rule_ref: e.rule_ref ?? null, indicative: !p, critical: true, edge_id: e.id });
      if (j === 0) progStart = start;
      progEnd = end;
    });
    let done = progEnd;
    const has = (k: string, v?: string) => conds.some((c) => c.kind === k && (v === undefined || String(c.value) === v));
    if (has('clearance')) blocks.push({ id: `clear-${i}`, lane: 'milestone', kind: 'clearance', title: { en: 'Security clearance confirmed by the licensee (status only)', ar: 'تأكيد التصريح الأمني من المرخَّص له (الحالة فقط)' }, start: progStart ?? gateDate, end: progStart ?? gateDate, source: null, indicative: false, critical: false, edge_id: e.id });
    if (has('exam', 'internal') || has('exam', 'written+jpm')) blocks.push({ id: `iexam-${i}`, lane: 'milestone', kind: 'internal_exam', title: { en: 'Internal comprehensive exam (written, JPMs, simulator)', ar: 'الاختبار الداخلي الشامل (تحريري ومقاييس أداء ومحاكي)' }, start: progEnd, end: progEnd, source: null, rule_ref: e.rule_ref ?? null, indicative: false, critical: true, edge_id: e.id });
    if (has('exam', 'fanr')) {
      const exam = addDays(progEnd, INDICATIVE.fanrAfterDays);
      const notice = addDays(exam, -FANR_NOTICE_DAYS);
      const cert = addDays(exam, INDICATIVE.certAfterDays);
      blocks.push({ id: `notice-${i}`, lane: 'milestone', kind: 'fanr_notice', title: { en: 'Licensee notifies FANR of the exam (60 days ahead)', ar: 'إخطار الهيئة بالاختبار (قبل 60 يوماً)' }, start: notice, end: notice, source: regSource, rule_ref: 'FANR-REG-17', indicative: false, critical: true, edge_id: e.id });
      blocks.push({ id: `fanr-${i}`, lane: 'milestone', kind: 'fanr_exam', title: { en: `FANR written and operating exams (${to.en})`, ar: `اختبارات الهيئة الكتابية والتشغيلية (${to.ar})` }, start: exam, end: exam, source: regSource, rule_ref: e.rule_ref ?? 'FANR-REG-17', indicative: true, critical: true, edge_id: e.id });
      if (has('medical')) { const m = addDays(cert, -INDICATIVE.medicalBeforeDays); blocks.push({ id: `med-${i}`, lane: 'milestone', kind: 'medical', title: { en: 'Medical within 6 months of certification (date only)', ar: 'فحص طبي خلال 6 أشهر من الاعتماد (التاريخ فقط)' }, start: m, end: m, source: regSource, indicative: true, critical: false, edge_id: e.id }); }
      blocks.push({ id: `cert-${i}`, lane: 'milestone', kind: 'certification', title: { en: `FANR certification as ${to.en} (mirrored, not issued by Kafa'a)`, ar: `اعتماد الهيئة بدور ${to.ar} (معكوس، لا تصدره كفاءة)` }, start: cert, end: cert, source: regSource, indicative: true, critical: true, edge_id: e.id });
      done = cert;
    }
    if (has('appointment')) blocks.push({ id: `appoint-${i}`, lane: 'milestone', kind: 'appointment', title: { en: 'Licensee appointment decision', ar: 'قرار التعيين من المرخَّص له' }, start: done, end: done, source: null, rule_ref: e.rule_ref ?? null, indicative: false, critical: true, edge_id: e.id });
    const concept = (input.conceptRoles ?? []).includes(e.to_role_id);
    if (concept) {
      // FS15: bridge learning towards the concept profile, then "profile-ready" (no vacancy, no deployment decision)
      const m = Math.max(INDICATIVE.courseMonths, Math.round(input.bridgeMonths ?? 0));
      const end = addMonths(gateDate, m);
      const title: BiText = { en: `Bridge learning towards the ${to.en} profile`, ar: `تعلّم جسري نحو ملف ${to.ar}` };
      if (!firstProgramme) firstProgramme = title;
      blocks.push({ id: `bridge-${i}`, lane: 'programme', kind: 'bridge', title, start: gateDate, end, months: m, source: null, indicative: true, critical: true, edge_id: e.id });
      done = end;
    } else if (!progs.length && !has('exam', 'fanr')) done = nextIntake(gateDate);
    blocks.push(concept
      ? { id: `move-${i}`, lane: 'milestone', kind: 'move', title: { en: `Profile-ready for ${to.en} (concept role: no vacancy, no deployment decision)`, ar: `جاهزية الملف لدور ${to.ar} (دور مفاهيمي: لا وظيفة شاغرة ولا قرار نشر)` }, start: done, end: done, source: null, indicative: true, critical: true, edge_id: e.id }
      : { id: `move-${i}`, lane: 'milestone', kind: 'move', title: { en: `Move to ${to.en}`, ar: `الانتقال إلى ${to.ar}` }, start: done, end: done, source: null, indicative: false, critical: true, edge_id: e.id });
    cursor = done;
  });

  const end = path.length ? cursor : now;
  const earliest = s.delayQ > 0 || s.rotation ? buildRoadmap(input, { ...s, delayQ: 0, rotation: false }).end : end;
  return { blocks, start: now, end, months: monthsDiff(now, end), earliest, beyondHorizon: quarterIndex(now, end) >= HORIZON_QUARTERS, firstProgramme };
}

/** Blocks that become development-plan activities (one per development block). */
export const developmentBlocks = (r: Pick<Roadmap, 'blocks'>) => r.blocks.filter((b) => b.lane === 'development');

/** Plain-text export: every indicative duration is labelled as such. */
export function roadmapCsv(r: Roadmap, lang: 'en' | 'ar', labels: { indicative: string; published: string; header: string[] }): string {
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const rows = [labels.header.map(q).join(',')];
  for (const b of [...r.blocks].sort((a, c) => (a.start < c.start ? -1 : a.start > c.start ? 1 : 0))) {
    const dur = b.weeks ? `${b.weeks}w` : b.months ? `${b.months}m` : '';
    rows.push([b.title[lang], b.lane, b.start, b.end, dur, b.indicative ? labels.indicative : labels.published, b.source?.label ?? b.rule_ref ?? ''].map((x) => q(String(x))).join(','));
  }
  return rows.join('\r\n');
}
