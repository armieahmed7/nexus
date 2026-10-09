// F38 (wave 5 · w5e1) seed: OJT practice logbook entries, preceptor acknowledgements and evaluation requests.
// Runs in build() (not finalize), so the F30 builder's finalize backfills one `attempted` statement per entry (source f38_ojt).
// Stories: the local-operator trainees (k-lo-trainee, w-lo-10) on their watch-station standards, the QC inspector keeping the
// audit tasks fresh with the supplier-quality lead as preceptor (live demo: sq-lead acknowledges, head-sq evaluates), and qualified
// maintenance, RP and chemistry technicians practising before requalification. Nothing here touches qualification records or
// evaluations: practice is not a sign-off.
import { preceptorOk, readiness } from '../../../src/modules/m02/ojt.ts';

const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const ts = (d, h) => `${d}T${String(h).padStart(2, '0')}:${h % 2 ? '30' : '10'}:00Z`;

// [person, task, preceptor, entries: [days ago, mode, ack ('a' acknowledged | 'r' returned | 'p' pending), ready, confidence, conditions, note, feedback]]
const STORIES = [
  ['p-k-lo-trainee', 'qs-lo-turbine-t1', 'w-lo-01', [
    [96, 'walkthrough', 'a', false, 2, 'Turbine building, day shift', 'First round with the checklist; needed prompts for the lube oil skid readings.', 'Good pace. Read back each parameter to the log sheet before moving on.'],
    [81, 'perform', 'a', false, 3, 'Turbine building, day shift', 'Completed the round alone, preceptor watching.', 'Correct readings. Missed the condensate pump seal check; review the round sheet.'],
    [67, 'perform', 'a', false, 4, 'Turbine building, night shift', 'Night round, all parameters logged.', 'Clean round. Flashlight discipline on the stairs was good.'],
    [52, 'perform', 'a', true, 4, 'Turbine building, day shift', 'Round with an abnormal vibration reading; reported to the control room.', 'Right call to stop and report. Ready for evaluation in my view.']]],
  ['p-k-lo-trainee', 'qs-lo-turbine-t3', 'p-k-instructor', [
    [60, 'walkthrough', 'a', false, 2, 'Clearance office mock-up', 'Walked through the clearance hang sequence with the instructor.', 'Know the boundary drawings before you start.'],
    [45, 'simulate', 'a', false, 3, 'Training mock-up', 'Simulated hang and removal with independent verification.', 'Independent verification done properly. Slow down at the tag check.'],
    [38, 'perform', 'a', false, 3, 'Unit 3, condensate system', 'Hung a clearance under supervision.', 'Correct, with one prompt on the second tag.'],
    [30, 'perform', 'a', false, 4, 'Unit 3, feedwater heater', 'Hung and removed a clearance under supervision.', 'No prompts. Good use of the stop-when-unsure tool.'],
    [21, 'perform', 'a', false, 4, 'Unit 4, service water', 'Clearance removal at the end of a work package.', 'Smooth removal and correct paperwork.'],
    [12, 'perform', 'a', true, 5, 'Unit 4, component cooling', 'Clearance hang for an outage work package.', 'Fully independent. Ready for evaluation.']]],
  ['p-k-lo-trainee', 'qs-lo-turbine-t4', 'p-k-instructor', [
    [40, 'simulate', 'a', false, 2, 'Full-scope simulator, LOIT session', 'Responded to a turbine trip alarm in the simulator.', 'Correct first actions; use the alarm response procedure earlier.'],
    [25, 'perform', 'a', false, 3, 'Full-scope simulator, LOIT session', 'Second alarm response with the crew.', 'Better. Communicate the plant status back to the operator at the controls.'],
    [6, 'perform', 'p', false, 4, 'Full-scope simulator, LOIT session', 'Third alarm response; tried the three-way communication.', null]]],
  ['p-k-lo-trainee', 'qs-lo-turbine-t5', 'w-lo-03', [
    [33, 'walkthrough', 'a', false, 2, 'Turbine building', 'Walked the equipment status board with the preceptor.', 'Know which boards update automatically and which do not.'],
    [9, 'walkthrough', 'r', false, 3, 'Turbine building', 'Second walk-through.', 'Please log the actual board names and the time; this entry is too vague to count.']]],
  ['p-k-lo-trainee', 'qs-lo-aux-t3', 'w-lo-01', [
    [44, 'perform', 'a', false, 3, 'RCA entry, auxiliary building', 'Entered the controlled area with the RP briefing.', 'Correct dosimetry and frisking.'],
    [29, 'perform', 'a', false, 4, 'RCA entry, auxiliary building', 'Second entry, contamination area boundary.', 'Good boundary awareness.'],
    [15, 'perform', 'a', true, 4, 'RCA entry, auxiliary building', 'Third entry, high-noise area.', 'Consistent. Ready for evaluation.']]],
  ['w-lo-10', 'qs-lo-turbine-t1', 'w-lo-05', [
    [70, 'walkthrough', 'a', false, 2, 'Turbine building', 'Round with the checklist.', 'Good start.'],
    [62, 'perform', 'a', false, 3, 'Turbine building', 'Round under supervision.', 'Correct readings.'],
    [55, 'perform', 'a', false, 4, 'Turbine building', 'Round under supervision.', 'Correct readings.'],
    [48, 'perform', 'a', true, 4, 'Turbine building', 'Round under supervision, abnormal reading found.', 'Ready for evaluation.']]],
  ['w-lo-10', 'qs-lo-turbine-t3', 'w-lo-05', [
    [26, 'walkthrough', 'a', false, 2, 'Clearance office', 'Walk-through of the clearance process.', 'Read the boundary drawing first.'],
    [11, 'perform', 'a', false, 3, 'Unit 3', 'First supervised clearance hang.', 'One prompt on independent verification.'],
    [4, 'perform', 'p', false, 3, 'Unit 3', 'Second supervised clearance hang.', null]]],
  ['p-qc-inspector', 'qs-qa-t1', 'p-sq-lead', [
    [58, 'walkthrough', 'a', false, 3, 'Supplier audit plan, valve vendor', 'Reviewed the audit plan template with the lead.', 'Tie each checklist line to an NQA-1 requirement.'],
    [41, 'perform', 'a', false, 4, 'Supplier audit plan, pump vendor', 'Drafted the audit plan for a pump vendor.', 'Scope is right; add the previous findings to the plan.'],
    [27, 'perform', 'a', false, 4, 'Supplier audit plan, cable vendor', 'Drafted the plan including previous findings.', 'Good. Sampling plan is well reasoned.'],
    [13, 'perform', 'a', true, 5, 'Supplier audit plan, instrument vendor', 'Planned the audit independently.', 'Independent and complete. Ready for evaluation.']]],
  ['p-qc-inspector', 'qs-qa-t2', 'p-sq-lead', [
    [35, 'simulate', 'a', false, 3, 'Mock audit, training room', 'Led a mock audit opening meeting.', 'Clear opening. Keep findings factual, not interpretive.'],
    [20, 'perform', 'a', false, 4, 'Supplier audit, valve vendor', 'Led the team for one audit day.', 'Findings well written. Watch the time on interviews.'],
    [8, 'perform', 'a', false, 4, 'Supplier audit, pump vendor', 'Led the team and wrote two findings.', 'Solid. Two more supervised audits before I call it ready.'],
    [2, 'perform', 'p', false, 4, 'Supplier audit, cable vendor', 'Led the audit and drafted the report.', null]]],
  ['w-mnt-03', 'qs-mech-t1', 'w-mnt-06', [
    [50, 'perform', 'a', false, 4, 'Maintenance shop, spare pump', 'Pump disassembly practice before requalification.', 'Torque sequence correct.'],
    [22, 'perform', 'a', false, 5, 'Maintenance shop, spare pump', 'Reassembly with the work package.', 'Correct and documented.']]],
  ['w-mnt-03', 'qs-mech-t3', 'w-mnt-06', [
    [44, 'perform', 'a', false, 3, 'Maintenance shop, FME training rig', 'FME zone set-up on the training rig.', 'Zone boundary correct; log entries late.'],
    [37, 'perform', 'a', false, 4, 'Unit 3, condensate pump room', 'FME controls for a pump seal change.', 'Log kept in real time this time.'],
    [29, 'perform', 'a', false, 4, 'Unit 4, component cooling water room', 'FME controls for an open flange.', 'Covers and tool tally correct.'],
    [18, 'perform', 'a', true, 4, 'Unit 4, service water pump room', 'FME controls set up for an open system.', 'Correct FME zone and log.']]],
  ['w-rp-02', 'qs-rp-t1', 'w-rp-01', [
    [47, 'perform', 'a', false, 4, 'Auxiliary building, survey route', 'Routine survey practice.', 'Survey map complete.'],
    [24, 'perform', 'a', false, 4, 'Auxiliary building, survey route', 'Survey with a contamination find.', 'Correct posting and report.'],
    [7, 'perform', 'p', false, 5, 'Fuel building', 'Survey of the spent fuel pool area.', null]]],
  ['w-rp-02', 'qs-rp-t3', 'p-rp-lead', [
    [16, 'perform', 'a', false, 4, 'RP instrument room', 'Instrument response checks on three survey meters.', 'Correct source check and record.']]],
  ['w-chem-02', 'qs-chem-t1', 'w-chem-01', [
    [39, 'simulate', 'a', false, 3, 'Chemistry lab mock-up', 'Sampling sequence in the mock-up.', 'Purge time correct.'],
    [19, 'perform', 'a', false, 4, 'Primary sampling room', 'Primary sample collection under supervision.', 'Correct controls; good dose awareness.'],
    [5, 'perform', 'p', false, 4, 'Primary sampling room', 'Second primary sample collection.', null]]],
  ['w-chem-03', 'qs-chem-t3', 'p-chem-sup', [
    [30, 'perform', 'a', false, 4, 'Chemistry lab', 'Updated the QC charts for two analysers.', 'Correct limits and trend notes.'],
    [10, 'perform', 'a', false, 5, 'Chemistry lab', 'QC chart review with an out-of-trend point.', 'Good catch on the out-of-trend point.'],
    [3, 'perform', 'a', true, 5, 'Chemistry lab', 'Third QC chart review.', 'Consistent. Ready if you want an evaluation.']]],
];

export default function build(T, ctx) {
  const today = ctx.DEMO_TODAY;
  const people = new Map(T.people.map((p) => [p.id, p]));
  const tasks = new Map(T.task_items.map((t) => [t.id, t]));
  const stds = new Map(T.qual_standards.map((s) => [s.id, s]));
  const w = { today, people: T.people, qual_records: T.qual_records, evaluator_quals: T.evaluator_quals };
  const name = (id) => ({ en: people.get(id)?.display_name ?? id, ar: people.get(id)?.display_name_ar || people.get(id)?.display_name || id });
  T.ojt_logs = [];
  T.ojt_eval_requests = [];
  for (const [pid, taskId, pre, entries] of STORIES) {
    const task = tasks.get(taskId);
    const std = stds.get(task?.standard_id);
    if (!task || !std || std.security_restricted || !['ojt', 'jpm', 'simulator'].includes(task.method)) throw new Error(`f38: task ${taskId} cannot be practised`);
    if (preceptorOk(pre, pid, std.id, w) !== 'ok') throw new Error(`f38: ${pre} is not a preceptor for ${pid} on ${std.id}`);
    entries.forEach(([ago, mode, ack, ready, confidence, conditions, note, feedback], i) => {
      const on = addDays(today, -ago);
      const id = `ojt-${pid}-${taskId}-${i + 1}`;
      const status = ack === 'a' ? 'acknowledged' : ack === 'r' ? 'returned' : 'pending_ack';
      const p = name(pid), r = name(pre);
      T.ojt_logs.push({
        id, client_key: `seed:${id}`, person_id: pid, person_name: p.en, person_name_ar: p.ar, task_id: taskId, standard_id: std.id, on_date: on, mode,
        preceptor_person_id: pre, preceptor_name: r.en, preceptor_name_ar: r.ar, confidence, conditions, note, status, feedback: status === 'pending_ack' ? null : feedback,
        preceptor_ready: status === 'acknowledged' && ready, ack_at: status === 'pending_ack' ? null : ts(addDays(on, 1), 14), synced: i % 4 === 2 ? 'offline' : 'online', created_at: ts(on, 16),
      });
      if (status === 'pending_ack') T.notifications.push({ id: `nt-ojt-${id}`, person_id: pre, kind: 'ojt', title_en: `Practice to acknowledge: ${task.code} (${p.en})`, title_ar: `تدريب عملي بانتظار تأكيدك: ${task.code} (${p.ar})`,
        body_en: null, body_ar: null, link: '/my/ojt?tab=acknowledge', severity: 'info', created_at: ts(on, 16), read_at: null });
    });
  }
  // evaluation requests: one open (k-lo-trainee, clearance task, to the instructor), one completed with the recorded evaluation (w-lo-10 round),
  // one cancelled (w-mnt-03 changed shift); the readiness snapshot is computed from the entries above
  const req = (id, pid, taskId, ev, status, requested, extra = {}) => {
    const task = tasks.get(taskId);
    const rec = T.qual_records.filter((q) => q.person_id === pid && q.standard_id === task.standard_id && q.status !== 'suspended').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    if (!rec) throw new Error(`f38: no qualification record for ${pid} on ${task.standard_id}`);
    if (!T.evaluator_quals.some((q) => q.person_id === ev && q.standard_id === task.standard_id)) throw new Error(`f38: ${ev} is not an evaluator for ${task.standard_id}`);
    const r = readiness(task, T.ojt_logs.filter((l) => l.person_id === pid));
    const p = name(pid), e = name(ev);
    T.ojt_eval_requests.push({
      id, person_id: pid, person_name: p.en, person_name_ar: p.ar, task_id: taskId, standard_id: task.standard_id, record_id: rec.id, evaluator_person_id: ev, evaluator_name: e.en, evaluator_name_ar: e.ar,
      status, readiness: { supervised: r.supervised, needed: r.needed, last_ack_id: r.last_ack_id }, note: extra.note ?? null, requested_at: ts(requested, 10),
      closed_at: extra.closed_at ?? null, closed_by: extra.closed_by ?? null, close_note: extra.close_note ?? null, evaluation_id: extra.evaluation_id ?? null, result: extra.result ?? null,
    });
    if (status === 'requested') T.notifications.push({ id: `nt-ojt-${id}`, person_id: ev, kind: 'ojt', title_en: `Evaluation requested: ${task.code} (${p.en})`, title_ar: `طلب تقييم: ${task.code} (${p.ar})`,
      body_en: null, body_ar: null, link: '/my/ojt?tab=evaluate', severity: 'info', created_at: ts(requested, 10), read_at: null });
  };
  req('oer-p-k-lo-trainee-qs-lo-turbine-t3', 'p-k-lo-trainee', 'qs-lo-turbine-t3', 'p-k-instructor', 'requested', addDays(today, -10), { note: 'Available on day shifts this week.' });
  const ev225 = T.evaluations.find((e) => e.id === 'ev-225');
  req('oer-w-lo-10-qs-lo-turbine-t1', 'w-lo-10', 'qs-lo-turbine-t1', 'w-instr-01', ev225 ? 'completed' : 'cancelled', addDays(today, -45),
    ev225 ? { closed_at: ts(ev225.date, 15), closed_by: 'w-instr-01', close_note: 'Signed off in the qualification record.', evaluation_id: 'ev-225', result: ev225.result } : { closed_at: ts(addDays(today, -40), 9), closed_by: 'w-lo-10' });
  req('oer-w-mnt-03-qs-mech-t3', 'w-mnt-03', 'qs-mech-t3', 'w-instr-02', 'cancelled', addDays(today, -14), { closed_at: ts(addDays(today, -13), 9), closed_by: 'w-mnt-03', close_note: 'Moved to the outage shift; will request again.' });
  T.ojt_logs.sort((a, b) => (a.id < b.id ? -1 : 1));
}
