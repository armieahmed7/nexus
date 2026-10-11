// F25 Training effectiveness (Kirkpatrick L1-L4) and F26 Training needs forecast (wave 4 · w4e1) seed. Synthetic data only.
//   needs_links        requalification course per qualification standard (security standards excluded) and the cross-training
//                      course per job family (F20 actions)
//   eval_surveys       one evaluation design per staff course: L1 items, the committee that reviews it, the L2 pre/post knowledge
//                      checks (6 courses) and the L3 checklist built from the course objectives (qualifying courses)
//   assessment_forms   + 12 L2 knowledge-check forms (M05 rows, written, NOT linked to a course, so they never feed skill evidence)
//   attempts           + released pre/post attempts on those forms for most completions, and a few graded-but-unreleased post
//                      attempts (excluded from the gain: "L2 uses only released attempts")
//   eval_responses     L1 answers for about 70% of completions; completions of the demo personas inside the 90-day window are
//                      left open so they can give feedback in the demo
//   l3_observations    one per completion of a qualifying course, due 90 days after completion, observer = line manager of record;
//                      most past-due ones recorded, a few overdue
//   course_kpi_links   SAMPLE L4 KPIs (HU-event rate, first-time pass, rework rate)
//   redesign_flags     one open flag (Security awareness: low relevance), raised by the training manager
//   demand_snapshots   F26 demand for the current quarter and the next three, computed with the same rules as computeDemand
//   session_proposals  one draft proposal (the largest shortfall next quarter), shown as a draft on /training/schedule
// Everything person-level is built in finalize (FINALIZE_LAST, after F01 derived skill states and F20 built its KLRA actions).
import { completionsOf, courseCard, l1Id, l3Template, l3ToSchedule, L1_ITEMS, L1_WINDOW_DAYS, addDaysIso } from '../../../src/modules/m25/eff.ts';
import { computeDemand, needsReport, periodsFrom, proposalDates, proposalSize, sessionKindFor } from '../../../src/modules/m25/needs.ts';
import { lineManagerOf } from '../../../src/modules/m20/domain.ts';

export const FINALIZE_LAST = true;

const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick01 = (s) => (hash(s) % 1000) / 1000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const REQUAL = {
  'qs-lo-turbine': 'c-loct', 'qs-lo-aux': 'c-loct', 'qs-ro': 'c-coct', 'qs-sro': 'c-coct', 'qs-mech': 'c-mnt-cont', 'qs-elec': 'c-mnt-cont', 'qs-ic': 'c-mnt-cont',
  'qs-rp': 'c-rp-cont', 'qs-chem': 'c-chem-cont', 'qs-eng': 'c-eng-cont', 'qs-ero': 'c-ero-drill', 'qs-fire': 'c-fire', 'qs-get': 'c-get', 'qs-wc': 'c-hu-ref',
};
const FAMILY = {
  operations: 'c-loct', maintenance: 'c-mnt-cont', engineering: 'c-eng-cont', chemistry: 'c-chem-cont', 'radiation-protection': 'c-rp-cont', 'emergency-preparedness': 'c-ero',
};
const COMMITTEE = {
  operations: ['c-loit-sys', 'c-loit-ojt', 'c-coit-gf', 'c-coit-sim', 'c-coit-exam', 'c-loct', 'c-coct', 'c-sam', 'c-asip'],
  maintenance: ['c-mnt-mech', 'c-mnt-elec', 'c-mnt-ic', 'c-mnt-ojt', 'c-mnt-cont'],
  rp_chem: ['c-rp-init', 'c-chem-init', 'c-rp-cont', 'c-chem-cont'],
  engineering: ['c-eng-init', 'c-eng-cont', 'c-apr', 'c-adv-smr'],
  emergency: ['c-ero', 'c-ero-drill', 'c-fire'],
  leadership: ['c-exec-sim', 'c-mcc', 'c-intilaqa', 'c-estadad', 'c-one', 'c-crucial'],
  training: ['c-instr'],
};
const committeeOf = (cid) => Object.entries(COMMITTEE).find(([, ids]) => ids.includes(cid))?.[0] ?? 'all_staff';
/** L2 knowledge checks and the designed profile per course: L1 mean, recommend share, pre/post mean, L3 application. */
const PROFILE = {
  'c-get': { l1: 4.3, rec: 0.88, pre: 58, post: 86, l3: 0.84 },
  'c-hu': { l1: 4.4, rec: 0.9, pre: 55, post: 82, l3: 0.6 },
  'c-sec-aw': { l1: 3.0, rec: 0.5, pre: 71, post: 76, l3: 0.8 },
  'c-scwe': { l1: 4.0, rec: 0.8, pre: 62, post: 84, l3: 0.8 },
  'c-coct': { l1: 4.5, rec: 0.95, pre: 74, post: 90, l3: 0.9 },
  'c-hu-ref': { l1: 3.8, rec: 0.75, pre: 70, post: 80, l3: 0.8 },
};
const DEFAULT_PROFILE = { l1: 4.0, rec: 0.8, pre: 60, post: 80, l3: 0.8 };

export default function build(T) {
  T.needs_links ??= [];
  for (const [sid, cid] of Object.entries(REQUAL)) T.needs_links.push({ id: `nl-requal-${sid}`, kind: 'requal', from_id: sid, course_id: cid, note: 'Requalification course before the standard expires' });
  for (const [fid, cid] of Object.entries(FAMILY)) T.needs_links.push({ id: `nl-family-${fid}`, kind: 'family', from_id: fid, course_id: cid, note: 'Cross-training course for knowledge-loss mitigation (F20)' });

  T.course_kpi_links ??= [];
  const Q = ['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'];
  const series = (vals, delivered = []) => vals.map((v, i) => ({ period: Q[i], value: v, ...(delivered.includes(Q[i]) ? { delivered: true } : {}) }));
  const note = { note_en: 'SAMPLE series for the demo. Association, not causation: many things move a plant KPI besides one course.', note_ar: 'سلسلة نموذجية للعرض. ارتباط لا سببية: عوامل كثيرة تحرك مؤشر المحطة غير دورة واحدة.' };
  T.course_kpi_links.push(
    { id: 'kpi-c-hu-hu', course_id: 'c-hu', kpi: 'hu_event_rate', label_en: 'HU-related event rate', label_ar: 'معدل الأحداث المرتبطة بالأداء البشري', unit: 'per 200,000 h', direction: 'lower_better', series: series([0.42, 0.39, 0.36, 0.35, 0.33], ['2025-Q4', '2026-Q1']), sample: true, ...note },
    { id: 'kpi-c-hu-ref-hu', course_id: 'c-hu-ref', kpi: 'hu_event_rate', label_en: 'HU-related event rate', label_ar: 'معدل الأحداث المرتبطة بالأداء البشري', unit: 'per 200,000 h', direction: 'lower_better', series: series([0.42, 0.39, 0.36, 0.35, 0.33], ['2026-Q1', '2026-Q2']), sample: true, ...note },
    { id: 'kpi-c-get-ftp', course_id: 'c-get', kpi: 'first_time_pass', label_en: 'GET first-time pass', label_ar: 'النجاح من المحاولة الأولى في التدريب العام', unit: '%', direction: 'higher_better', series: series([88, 90, 91, 93, 94], ['2025-Q3', '2025-Q4', '2026-Q2', '2026-Q3']), sample: true, ...note },
    { id: 'kpi-c-coct-ftp', course_id: 'c-coct', kpi: 'first_time_pass', label_en: 'Requalification first-time pass', label_ar: 'النجاح من المحاولة الأولى في إعادة التأهيل', unit: '%', direction: 'higher_better', series: series([92, 94, 93, 95, 96], ['2026-Q1', '2026-Q2']), sample: true, ...note },
    { id: 'kpi-c-mnt-cont-rw', course_id: 'c-mnt-cont', kpi: 'rework_rate', label_en: 'Maintenance rework rate', label_ar: 'معدل إعادة العمل في الصيانة', unit: '%', direction: 'lower_better', series: series([3.1, 3.4, 3.6, 3.5, 3.8], ['2025-Q4', '2026-Q2']), sample: true, ...note },
    { id: 'kpi-c-chem-cont-ftp', course_id: 'c-chem-cont', kpi: 'first_time_pass', label_en: 'Chemistry qualification first-time pass', label_ar: 'النجاح من المحاولة الأولى في تأهيل الكيمياء', unit: '%', direction: 'higher_better', series: series([85, 84, 86, 88, 89], ['2026-Q1']), sample: true, ...note },
  );

  // Evaluation designs and the L2 knowledge-check forms (M05 rows, no course link: never skill evidence)
  T.eval_surveys ??= [];
  for (const c of T.courses.filter((x) => x.audience !== 'supplier' && x.audience !== 'contractor')) {
    const l2 = !!PROFILE[c.id];
    if (l2) {
      for (const k of ['pre', 'post']) T.assessment_forms.push({
        id: `form-l2-${k}-${c.id}`, blueprint_id: null, title_en: `L2 knowledge check (${k === 'pre' ? 'before' : 'after'}): ${c.title_en}`,
        title_ar: `فحص المعرفة للمستوى الثاني (${k === 'pre' ? 'قبل' : 'بعد'}): ${c.title_ar}`, kind: 'written', is_practice: false, item_ids: [], time_limit_min: 15, pass_mark: 70,
        status: 'approved', audience_en: 'Course participants (training effectiveness, not a qualification exam)', audience_ar: 'المشاركون في الدورة (فعالية التدريب، وليس اختبار تأهيل)',
        course_id: null, max_attempts: 1, retake_wait_days: 0, appeal_days: 10,
      });
    }
    T.eval_surveys.push({
      id: `es-${c.id}`, course_id: c.id, committee: committeeOf(c.id), l1_items: [...L1_ITEMS], pre_form_id: l2 ? `form-l2-pre-${c.id}` : null, post_form_id: l2 ? `form-l2-post-${c.id}` : null,
      l3_days: 90, l3_items: c.qualifying ? l3Template(c) : [], active: true, updated_at: '2026-09-01T08:00:00Z',
    });
  }
}

export function finalize(T, ctx) {
  const now = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const course = new Map(T.courses.map((c) => [c.id, c]));
  const surveyed = new Set(T.eval_surveys.map((s) => s.course_id));
  const comps = completionsOf(T.training_records, T.enrolments).filter((c) => surveyed.has(c.course_id) && people.get(c.person_id)?.status !== 'leaver');
  const persona = (pid) => !!people.get(pid)?.persona_id || pid.startsWith('p-');

  // L2 attempts (released pre/post for ~85% of completions with knowledge checks; a few graded-unreleased post attempts)
  const seenPre = new Set();
  for (const c of comps) {
    const pr = PROFILE[c.course_id];
    if (!pr || pick01(`l2:${c.ref}`) > 0.85) continue;
    const k = `${c.person_id}|${c.course_id}`;
    if (seenPre.has(k)) continue; // one pair per person and course
    seenPre.add(k);
    const pre = clamp(Math.round(pr.pre + (pick01(`pre:${c.ref}`) - 0.5) * 30), 20, 100);
    const post = clamp(Math.round(pr.post + (pick01(`post:${c.ref}`) - 0.5) * 20), 30, 100);
    const unreleased = c.ref.startsWith('en:') && c.completed_on >= addDaysIso(now, -21);
    const start = addDaysIso(c.completed_on, -Math.max(1, Math.ceil(Number(course.get(c.course_id)?.duration_hours ?? 8) / 8)));
    const att = (kind, score, rel, day) => ({
      id: `at-l2-${kind}-${c.ref.replace(':', '-')}`, form_id: `form-l2-${kind}-${c.course_id}`, person_id: c.person_id, scheduled_for: `${day}T07:00:00Z`, started_at: `${day}T07:05:00Z`,
      submitted_at: `${day}T07:20:00Z`, score, passed: kind === 'post' ? score >= 70 : null, status: rel ? 'released' : 'graded', proctor_person_id: null, released: rel,
      attempt_no: 1, retake_of: null, deadline_at: null, late: false, released_by: rel ? 'p-k-instructor' : null, released_at: rel ? `${addDaysIso(day, 2)}T09:00:00Z` : null,
      voided_item_ids: [], counts: true, evaluator_note: null,
    });
    T.attempts.push(att('pre', pre, true, start), att('post', post, !unreleased, c.completed_on));
  }

  // L1 responses (~70%); demo personas inside the feedback window stay open
  T.eval_responses ??= [];
  for (const c of comps) {
    const open = c.completed_on >= addDaysIso(now, -L1_WINDOW_DAYS);
    if ((open && persona(c.person_id)) || pick01(`l1:${c.ref}`) > 0.72 || c.completed_on > now) continue;
    const pr = PROFILE[c.course_id] ?? DEFAULT_PROFILE;
    const noise = (k) => [-1, 0, 0, 0, 1][hash(`${k}:${c.ref}`) % 5];
    const base = (k, d = 0) => clamp(Math.round(pr.l1 + d + noise(k) * 0.8), 1, 5);
    T.eval_responses.push({
      id: l1Id(c.ref), course_id: c.course_id, person_id: c.person_id, completion_ref: c.ref, completed_on: c.completed_on,
      ratings: { relevance: base('rel'), objectives: base('obj', 0.1), delivery: base('del', 0.2), confidence: base('con', -0.2), time: base('tim', -0.1) },
      recommend: pick01(`rec:${c.ref}`) < pr.rec, submitted_at: `${addDaysIso(c.completed_on, 1 + (hash(c.ref) % 5))}T10:00:00Z`, open_read: false,
    });
  }

  // L3 observations: every completion of a qualifying course, due +90 days; most past-due recorded
  T.l3_observations ??= [];
  const sched = l3ToSchedule(comps, T.courses, T.eval_surveys, new Set());
  for (const s of sched) {
    const c = s.c;
    const obs = lineManagerOf(c.person_id, T.people, T.role_assignments, now);
    const sv = T.eval_surveys.find((x) => x.course_id === c.course_id);
    const pr = PROFILE[c.course_id] ?? DEFAULT_PROFILE;
    const opens = addDaysIso(s.due_on, -30);
    const done = (s.due_on < now && pick01(`l3:${c.ref}`) < 0.86) || (opens <= now && s.due_on >= now && pick01(`l3:${c.ref}`) < 0.3);
    const rate = (k) => { const r = pick01(`${k}:${c.ref}`); return r < pr.l3 * 0.75 ? 'yes' : r < pr.l3 * 0.75 + 0.25 ? 'partly' : r < 0.96 ? 'no' : 'na'; };
    const items = (sv.l3_items ?? []).map((i) => ({ ...i, rating: done ? rate(i.key) : null }));
    const recDay = done ? (s.due_on < now ? addDaysIso(s.due_on, -(hash(c.ref) % 20)) : now) : null;
    T.l3_observations.push({
      id: s.id, person_id: c.person_id, course_id: c.course_id, completion_ref: c.ref, completed_on: c.completed_on, observer_person_id: obs, due_on: s.due_on, items,
      status: done ? 'done' : 'scheduled', note: done && hash(c.ref) % 4 === 0 ? 'Observed during a routine shift task; discussed one improvement point.' : null,
      recorded_by: done ? obs ?? 'p-training-mgr' : null, recorded_at: done ? `${recDay}T11:00:00Z` : null, scheduled_at: `${c.completed_on}T18:00:00Z`, open_read: false,
    });
  }

  // One open redesign flag with the evidence of the day
  T.redesign_flags ??= [];
  const x = { courses: T.courses, surveys: T.eval_surveys, completions: completionsOf(T.training_records, T.enrolments), responses: T.eval_responses, attempts: T.attempts, observations: T.l3_observations, kpis: T.course_kpi_links, flags: [] };
  const card = courseCard('c-sec-aw', x, now);
  T.redesign_flags.push({
    id: 'rf-c-sec-aw-1', course_id: 'c-sec-aw', reasons: card.reasons, note: 'Learners rate relevance low and the knowledge gain is small; refocus on the scenarios people meet on site.',
    status: 'open', raised_by: 'p-training-mgr', raised_by_name: people.get('p-training-mgr')?.display_name ?? 'Training Manager (role card)', raised_at: '2026-10-01T09:00:00Z', sat_ref: null,
  });

  // F26: demand for the horizon, then one draft proposal for next quarter's largest shortfall
  T.demand_snapshots ??= [];
  const input = {
    people: T.people, courses: T.courses, curriculum_rules: T.curriculum_rules, training_records: T.training_records, enrolments: T.enrolments, qual_records: T.qual_records,
    qual_standards: T.qual_standards, links: T.needs_links, roadmaps: T.roadmaps ?? [], coach_feedback: T.coach_feedback ?? [], future_interest: T.future_interest ?? [],
    future_resources: T.future_resources ?? [], klra_actions: T.klra_actions ?? [], klra_positions: T.klra_positions ?? [],
  };
  const periods = periodsFrom(now);
  for (const p of periods) for (const r of computeDemand(input, p, now)) T.demand_snapshots.push({ ...r, computed_at: `${now}T06:00:00Z`, computed_by: 'p-training-mgr', open_read: false });
  T.session_proposals ??= [];
  const next = periods[1];
  const rep = needsReport(T.demand_snapshots, { sessions: T.sessions, simulator_slots: T.simulator_slots, proposals: [], courses: T.courses }, next, true);
  const top = [...rep.rows].filter((r) => course.get(r.course_id)?.modality !== 'elearning').sort((a, b) => b.shortfall - a.shortfall || (a.course_id < b.course_id ? -1 : 1))[0];
  if (top && top.shortfall > 0) {
    const c = course.get(top.course_id);
    const size = proposalSize(top.shortfall, 0, c.modality);
    T.session_proposals.push({
      id: `sp-${next.toLowerCase()}-${top.course_id}-1`, period: next, course_id: top.course_id, kind: sessionKindFor(c.modality), sessions: size.sessions, seats_each: size.seats_each,
      dates: proposalDates(next, size.sessions), demand: top.total, shortfall: top.shortfall, status: 'draft', session_id: null,
      note: 'Proposed from the demand forecast; the scheduler sets rooms and instructors.', created_by: 'p-training-mgr', created_at: `${now}T06:30:00Z`, decided_by: null, decided_at: null,
    });
  }
}
