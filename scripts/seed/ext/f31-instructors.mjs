// F31 (wave 4 · w4e5) seed: the instructor and SME qualification pipeline (M02). Synthetic people only.
//   instructor_tracks        12 qualified instructors (two on the ASIP route), one lapsed (currency window ended short), and a pipeline in
//                            every stage: nominated (3), initial training (3), co-teach (3, one with two passes by the same observer),
//                            solo (2), ready (2; one observed by the training manager, so maker-checker bars them), declined and withdrawn.
//   instructor_observations  the qualifying sets of the qualified instructors (2 co-teach + 1 solo by three different observers), currency
//                            observations, and the pipeline's observations (passes and fails, scored with the shared checklist).
//   teaching_hours           monthly delivery hours (scheduling-system mirror) and continuing development since each qualification date,
//                            shaped so that one instructor is at risk 26 days before the due date, one at 17 days, one due in 68 days and
//                            one renewed this week. Co-teach hours for the pipeline.
// Shared rows written the way the RPCs write them: evaluator_quals `eq-ins-*`, enrolments `en-ins-*` (accepted nominations still in initial
// training) and notifications `nt-ins-*`. The F01 `credential` evidence on sk-ld-01-instruct is written by qualifyInstructor at run time and
// is not back-filled here: derived skill states feed snapshots that waves 2-3 already loaded live (career conversations, talent review,
// KLRA), and a seed backfill would change those rows.
import {
  INITIAL_COURSE, OBS_ITEMS, addDays, addMonths, currencyView, deriveStage, scoreObservation, standardSkills,
} from '../../../src/modules/m02/instructors.ts';

const QUALIFIED = [
  // person, route, standards, qualified_on, first_qualified_on, monthly delivery hours per window, CPD entries per window
  ['p-k-instructor', 'asip', ['qs-sro', 'qs-ro'], '2025-04-20', '2021-09-12', [6, 6], [2, 1]],
  ['w-instr-01', 'asip', ['qs-ro', 'qs-lo-turbine'], '2025-02-10', '2019-03-18', [6, 5.5], [2, 1]],
  ['w-instr-02', 'sme', ['qs-get', 'qs-lo-aux'], '2025-11-03', '2020-11-03', [2.5], [1]],
  ['p-training-mgr', 'sme', ['qs-instr'], '2025-06-01', '2018-06-01', [4, 4], [2, 1]],
  ['p-sq-lead', 'sme', ['qs-qa'], '2025-12-15', '2022-12-15', [3], [1]],
  ['p-head-sq', 'sme', ['qs-qa'], '2024-12-01', '2020-12-01', [4.5, 4], [2, 2]],
  ['p-ep-manager', 'sme', ['qs-ero'], '2025-09-20', '2021-09-20', [4, 4], [2, 1]],
  ['p-rp-lead', 'sme', ['qs-rp'], '2025-05-05', '2022-05-05', [4.5, 4.5], [2, 1]],
  ['w-eng-01', 'sme', ['qs-eng'], '2025-10-01', '2023-10-01', [4, 4], [2, 1]],
  ['w-mnt-01', 'sme', ['qs-mech'], '2024-10-25', '2019-10-25', [4.5, 3], [2, 2]],
  ['w-chem-01', 'sme', ['qs-chem'], '2026-03-01', '2026-03-01', [5], [1]],
  ['w-fire-01', 'sme', ['qs-fire'], '2025-07-15', '2023-07-15', [4, 4], [2, 1]],
  ['w-rp-01', 'sme', ['qs-rp'], '2024-08-10', '2024-08-10', [4, 2], [2, 2]], // second window ends 2026-08-10 with 24 h: lapsed
];

// Pipeline: person, route, standards, nomination kind, nominated by, started, accepted, initial done, status, observations, note
const PIPELINE = [
  ['p-qc-inspector', 'sme', ['qs-qa'], 'self', 'p-qc-inspector', '2026-10-02', null, null, 'active', [], 'I lead the receiving-inspection briefings and would like to teach the QC inspection modules.'],
  ['w-mnt-03', 'sme', ['qs-elec'], 'training_manager', 'p-training-mgr', '2026-09-28', null, null, 'active', [], null],
  ['w-eng-03', 'sme', ['qs-eng'], 'training_manager', 'p-training-mgr', '2026-09-24', null, null, 'active', [], null],
  ['p-sro', 'asip', ['qs-sro'], 'self', 'p-sro', '2026-08-30', '2026-09-10', null, 'active', [], 'Ten years on shift; I want to bring that command experience into the simulator.'],
  ['w-ro-03', 'sme', ['qs-lo-turbine'], 'manager', 'p-sro', '2026-08-05', '2026-08-20', null, 'active', [], null],
  ['w-qa-01', 'sme', ['qs-qa'], 'manager', 'p-head-sq', '2026-08-18', '2026-09-01', null, 'active', [], null],
  ['p-sme-reviewer', 'sme', ['qs-eng'], 'self', 'p-sme-reviewer', '2026-05-12', '2026-05-20', '2026-08-14', 'active',
    [['co_teach', 'w-instr-01', '2026-09-10', 'strong']], 'Design-change reviews are where I can help new engineers most.'],
  ['w-sro-03', 'asip', ['qs-sro', 'qs-ro'], 'training_manager', 'p-training-mgr', '2026-03-20', '2026-04-01', '2026-07-30', 'active',
    [['co_teach', 'p-k-instructor', '2026-08-20', 'good'], ['co_teach', 'p-k-instructor', '2026-09-24', 'strong']], null],
  ['w-eng-05', 'sme', ['qs-eng'], 'self', 'w-eng-05', '2026-06-02', '2026-06-15', '2026-09-05', 'active', [], 'Core physics refreshers for the engineering cohort.'],
  ['w-chem-02', 'sme', ['qs-chem'], 'manager', 'p-chem-sup', '2026-02-25', '2026-03-10', '2026-05-20', 'active',
    [['co_teach', 'w-instr-02', '2026-07-08', 'good'], ['co_teach', 'p-head-sq', '2026-08-12', 'strong']], null],
  ['w-mnt-04', 'sme', ['qs-elec'], 'training_manager', 'p-training-mgr', '2026-01-20', '2026-02-01', '2026-04-10', 'active',
    [['co_teach', 'w-instr-01', '2026-05-14', 'critical_fail'], ['co_teach', 'w-instr-01', '2026-06-18', 'good'], ['co_teach', 'p-k-instructor', '2026-07-22', 'strong']], null],
  ['w-ro-02', 'sme', ['qs-lo-aux'], 'manager', 'p-sro', '2026-01-08', '2026-01-15', '2026-03-20', 'active',
    [['co_teach', 'p-k-instructor', '2026-04-22', 'good'], ['co_teach', 'w-instr-01', '2026-05-27', 'strong'], ['solo', 'w-instr-02', '2026-09-02', 'strong']], null],
  ['w-rp-02', 'sme', ['qs-rp'], 'manager', 'p-rp-lead', '2026-03-02', '2026-03-12', '2026-04-24', 'active',
    [['co_teach', 'p-rp-lead', '2026-05-05', 'good'], ['co_teach', 'p-training-mgr', '2026-06-09', 'strong'], ['solo', 'w-instr-01', '2026-09-15', 'good']], null],
  ['w-lo-05', 'sme', ['qs-lo-turbine'], 'self', 'w-lo-05', '2026-06-02', null, null, 'declined', [], 'I enjoy explaining the turbine systems to new starters.'],
  ['w-eng-02', 'sme', ['qs-eng'], 'training_manager', 'p-training-mgr', '2026-02-02', '2026-02-10', null, 'withdrawn', [], null],
];
const DECISION = {
  'w-lo-05': 'Complete the Local Operator qualification first, then reapply next year',
  'w-eng-02': 'Moved to the outage project; will rejoin the track next year',
};
// Rating patterns (all eight checklist items in OBS_ITEMS order)
const PATTERN = {
  strong: ['met', 'met', 'met', 'met', 'met', 'met', 'met', 'partly'],
  good: ['met', 'met', 'met', 'partly', 'met', 'met', 'partly', 'met'],
  fair: ['partly', 'met', 'met', 'partly', 'partly', 'met', 'met', 'met'],
  critical_fail: ['met', 'not_met', 'met', 'partly', 'met', 'met', 'met', 'met'],
};
const NOTES = {
  strong: 'Clear objectives, accurate content and good use of operating experience.',
  good: 'Solid delivery; keep checking understanding before moving on.',
  fair: 'Competent; tighten the link between the objectives and the assessment.',
  critical_fail: 'A procedure step was described inaccurately; repeat the co-teach after a technical review.',
};

export default function build(T, ctx) {
  const TODAY = ctx.DEMO_TODAY;
  const NOW = `${TODAY}T08:00:00Z`;
  const person = new Map(T.people.map((p) => [p.id, p]));
  const std = new Map(T.qual_standards.map((s) => [s.id, s]));
  const name = (id) => person.get(id).display_name;
  const nameAr = (id) => person.get(id).display_name_ar || person.get(id).display_name;
  for (const [pid] of [...QUALIFIED, ...PIPELINE]) if (!person.has(pid)) throw new Error(`f31: unknown person ${pid}`);
  // A course of the standard's competencies for delivery-hour rows
  const courseFor = (stds) => {
    const comps = new Set(T.skills.filter((k) => (k.evidence_keys ?? []).some((e) => stds.includes(e))).map((k) => k.competency_id));
    const c = T.courses.filter((x) => x.audience === 'staff' && !['c-instr', 'c-asip'].includes(x.id) && x.competency_ids.some((cc) => comps.has(cc))).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    return c?.id ?? 'c-get';
  };
  const tracks = [];
  const obs = [];
  const hours = [];
  const items = (p) => OBS_ITEMS.map((it, i) => ({ key: it.key, rating: PATTERN[p][i] }));
  const addObs = (track, n, kind, observer, date, p) => {
    const it = items(p);
    const sc = scoreObservation(it);
    const row = {
      id: `io-${track.person_id}-${n}`, track_id: track.id, person_id: track.person_id, observer_person_id: observer, observer_name: name(observer), observer_name_ar: nameAr(observer),
      kind, observed_on: date, items: it, score: sc.score, result: sc.result, session_id: null, course_id: courseFor(track.standard_ids), note: NOTES[p], created_at: `${date}T12:00:00Z`,
    };
    obs.push(row);
    return row;
  };
  const baseTrack = (pid, route, stds, extra) => ({
    id: `it-${pid}`, person_id: pid, person_name: name(pid), person_name_ar: nameAr(pid), route, discipline: std.get(stds[0]).discipline, standard_ids: stds,
    skill_ids: standardSkills(stds, T.skills).slice(0, 6), stage: 'nominated', status: 'active', started_on: TODAY, nominated_by: pid, nomination_kind: 'self', motivation: null,
    accepted_on: null, accepted_by: null, initial_done_on: null, qualified_on: null, first_qualified_on: null, qualified_by: null, currency_due: null, currency_status: null,
    lapsed_on: null, decision_note: null, created_at: NOW, updated_at: NOW, ...extra,
  });

  // ── qualified (and lapsed) instructors
  const qualifiedIds = QUALIFIED.map((q) => q[0]);
  QUALIFIED.forEach(([pid, route, stds, q, first, rates, cpd], qi) => {
    const t = baseTrack(pid, route, stds, {
      stage: 'qualified', status: 'qualified', started_on: addMonths(first, -9), nominated_by: 'p-training-mgr', nomination_kind: 'training_manager',
      accepted_on: addMonths(first, -8), accepted_by: pid === 'p-training-mgr' ? 'p-head-sq' : 'p-training-mgr', initial_done_on: addMonths(first, -6),
      qualified_on: q, first_qualified_on: first, qualified_by: pid === 'p-training-mgr' ? 'p-head-sq' : 'p-training-mgr',
    });
    // qualifying set: three different observers among the other qualified instructors
    const others = qualifiedIds.filter((x) => x !== pid && x !== 'w-rp-01');
    const pickObs = (k) => others[(qi * 3 + k) % others.length];
    addObs(t, 1, 'co_teach', pickObs(0), addDays(addMonths(first, -4), 3), 'good');
    addObs(t, 2, 'co_teach', pickObs(1), addDays(addMonths(first, -3), 9), 'strong');
    addObs(t, 3, 'solo', pickObs(2), addDays(addMonths(first, -1), 14), 'strong');
    if (q !== first) addObs(t, 4, 'currency', pickObs(3), addDays(q, -12), qi % 3 === 0 ? 'fair' : 'strong');
    // hours: monthly delivery rows, CPD rows per window, up to the demo date (and never after a lapse)
    const course = courseFor(stds);
    for (let k = 0; k < 40; k++) {
      const d = addDays(addMonths(q, k), 6);
      if (d > TODAY) break;
      const w = Math.min(Math.floor(k / 12), rates.length - 1);
      hours.push({ id: `th-${pid}-d${String(k).padStart(2, '0')}`, person_id: pid, track_id: t.id, kind: 'delivery', source: 'mirror', session_id: null, course_id: course, delivered_on: d, hours: rates[w], note: null, recorded_by: 'p-training-mgr', created_at: `${d}T16:00:00Z` });
    }
    for (let w = 0; w < cpd.length; w++)
      for (let i = 0; i < cpd[w]; i++) {
        const d = addDays(addMonths(q, 12 * w + 3 + 5 * i), 10);
        if (d > TODAY) continue;
        hours.push({ id: `th-${pid}-c${w}${i}`, person_id: pid, track_id: t.id, kind: 'cpd', source: 'self', session_id: null, course_id: i === 0 ? 'c-instr' : null, delivered_on: d, hours: cpd[w] >= 2 ? 4.5 : 4,
          note: i === 0 ? 'Instructional skills workshop (SAT refresher)' : 'Technical update and OE review', recorded_by: pid, created_at: `${d}T16:00:00Z` });
      }
    const cv = currencyView(t, hours.filter((h) => h.person_id === pid), TODAY);
    if (cv.status === 'lapsed') Object.assign(t, { status: 'lapsed', lapsed_on: cv.lapsed_on, currency_due: cv.due, currency_status: 'lapsed' });
    else Object.assign(t, { currency_due: cv.due, currency_status: cv.status });
    tracks.push(t);
  });

  // ── pipeline
  for (const [pid, route, stds, kind, by, started, accepted, initial, status, observations, motivation] of PIPELINE) {
    const t = baseTrack(pid, route, stds, {
      started_on: started, nominated_by: by, nomination_kind: kind, motivation, accepted_on: accepted, accepted_by: accepted ? 'p-training-mgr' : null, initial_done_on: initial,
      status, decision_note: DECISION[pid] ?? null, created_at: `${started}T09:00:00Z`, updated_at: NOW,
    });
    const rows = observations.map(([k, observer, date, p], i) => addObs(t, i + 1, k, observer, date, p));
    for (const o of rows) hours.push({ id: `th-${pid}-o${o.id.split('-').pop()}`, person_id: pid, track_id: t.id, kind: 'delivery', source: 'mirror', session_id: null, course_id: o.course_id, delivered_on: o.observed_on, hours: 3, note: `${o.kind === 'solo' ? 'Solo' : 'Co-taught'} delivery (observed)`, recorded_by: 'p-training-mgr', created_at: `${o.observed_on}T16:00:00Z` });
    t.stage = status === 'withdrawn' ? (initial ? 'co_teach' : accepted ? 'initial_training' : 'nominated') : deriveStage(t, rows, initial);
    tracks.push(t);
  }

  T.instructor_tracks = [...(T.instructor_tracks ?? []), ...tracks];
  T.instructor_observations = [...(T.instructor_observations ?? []), ...obs];
  T.teaching_hours = [...(T.teaching_hours ?? []), ...hours];

  // ── shared rows, as the RPCs write them
  for (const t of tracks.filter((x) => x.status === 'qualified' || x.status === 'lapsed')) {
    const validTo = t.status === 'lapsed' ? t.lapsed_on : t.currency_due;
    for (const s of [...t.standard_ids].sort()) T.evaluator_quals.push({ id: `eq-ins-${t.person_id}-${s}`, person_id: t.person_id, standard_id: s, valid_to: validTo });
  }
  for (const t of tracks.filter((x) => x.status === 'active' && x.accepted_on && !x.initial_done_on)) {
    const course = INITIAL_COURSE[t.route];
    if (T.enrolments.some((e) => e.person_id === t.person_id && e.course_id === course && !['cancelled', 'failed'].includes(e.status))) continue;
    const inProg = t.person_id === 'w-ro-03';
    T.enrolments.push({
      id: `en-ins-${t.id}`, person_id: t.person_id, course_id: course, session_id: null, org_id: person.get(t.person_id).org_id ?? null, status: inProg ? 'in_progress' : 'assigned', source: 'coordinator',
      assigned_by: 'Instructor pipeline (F31)', due_on: addDays(t.accepted_on, 90), enrolled_at: `${t.accepted_on}T09:00:00Z`, progress_pct: inProg ? 40 : 0, completed_at: null, score: null, certificate_no: null,
      evaluation_id: null, attendance: null, waitlisted_at: null, decided_by: null, decision_note: null,
    });
  }
  const note = (id, pid, en, ar, link, severity) => T.notifications.push({ id, person_id: pid, kind: 'instructor', title_en: en, title_ar: ar, body_en: null, body_ar: null, link, severity, created_at: NOW, read_at: null });
  for (const t of tracks) {
    if (t.status === 'lapsed') note(`nt-ins-${t.id}-lapsed-${t.lapsed_on}`, t.person_id, `Your instructor currency lapsed on ${t.lapsed_on}`, `انتهت أهليتك كمدرب في ${t.lapsed_on}`, '/my/instructor', 'bad');
    if (t.status === 'qualified') {
      const cv = currencyView(t, hours.filter((h) => h.person_id === t.person_id), TODAY);
      if (cv.notice) note(`nt-ins-${t.id}-${cv.due}-${cv.notice}`, t.person_id, `Instructor currency due in ${cv.days} days: ${cv.hours} of 40 delivery hours, ${cv.cpd} of 8 development hours`,
        `تستحق أهليتك كمدرب خلال ${cv.days} يوماً: ${cv.hours} من 40 ساعة تدريس و${cv.cpd} من 8 ساعات تطوير`, '/my/instructor', cv.notice === 30 ? 'warn' : 'info');
    }
    if (t.status === 'active' && !t.accepted_on && t.person_id !== 'p-training-mgr')
      note(`nt-ins-${t.id}-tm-p-training-mgr`, 'p-training-mgr', `Instructor nomination to decide: ${t.person_name}`, `ترشيح مدرب بانتظار القرار: ${t.person_name_ar}`, `/training/instructors/${t.id}`, 'info');
  }
}
