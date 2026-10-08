/** M04 (G2): enrolment, approvals, waitlist, completion gate, certificates, curriculum sync. LocalBackend mirrors the SQL RPCs. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';

let b: LocalBackend;
async function as(persona: string | null) {
  b.setPersona(persona);
  await b.whenReady();
}
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('M04 acceptance', () => {
  it('a role change assigns the mandatory curriculum of the new role within one sync cycle', async () => {
    // HR sync changes the job role (mirrored people record), then the curriculum sync runs once
    b.rawUpdate('people', 'w-lo-08', { job_role_id: 'reactor-operator' });
    await as('training-mgr');
    const r = await b.rpc.curriculumSync('w-lo-08');
    expect(r.ok).toBe(true);
    expect(r.data!.assigned).toBeGreaterThan(0);
    const mine = b.raw('enrolments').filter((e) => e.person_id === 'w-lo-08');
    for (const c of ['c-coit-gf', 'c-coit-sim', 'c-coit-exam', 'c-coct']) expect(mine.some((e) => e.course_id === c && e.status === 'assigned' && e.source === 'role_rule')).toBe(true);
    // the previous role's unstarted assignment that the new role does not need is withdrawn
    expect(mine.some((e) => e.course_id === 'c-hu-ref' && e.status === 'cancelled')).toBe(true);
    // a second run in the same cycle changes nothing
    expect((await b.rpc.curriculumSync('w-lo-08')).data).toMatchObject({ assigned: 0, withdrawn: 0 });
  });

  it('a COCT booking cannot be displaced by an elective booking', async () => {
    await as('training-mgr');
    const coct = b.raw('simulator_slots').find((s) => s.booking_kind === 'coct')!;
    const r = await b.rpc.bookSimulator(coct.id, 'elective', 'A');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('conflict');
    const free = b.raw('simulator_slots').find((s) => s.booking_kind === 'free')!;
    expect((await b.rpc.bookSimulator(free.id, 'elective', 'C')).ok).toBe(true);
    // licence-critical training can take an elective slot
    expect((await b.rpc.bookSimulator(free.id, 'requal', 'C')).ok).toBe(true);
  });

  it('every catalogue entry with a published duration carries a source', async () => {
    await as(null);
    const progs = await b.list('programmes');
    const withDuration = progs.filter((p) => p.weeks != null || p.hours != null || /\d/.test(p.duration_en));
    expect(withDuration.length).toBeGreaterThan(10);
    for (const p of withDuration) expect((p.sources as unknown[]).length, p.id).toBeGreaterThan(0);
  });
});

describe('M04 enrolment and approvals', () => {
  it('a learner choosing an elective sends a request; their crew manager approves; they cannot approve their own', async () => {
    await as('k-ro');
    const r = await b.rpc.enrolCourse('c-apr', 's-apr');
    expect(r.ok).toBe(true);
    expect(r.data!.status).toBe('requested');
    expect((await b.rpc.decideEnrolment(r.data!.id, 'approve', '')).code).toBe('forbidden');
    await as('sro');
    const d = await b.rpc.decideEnrolment(r.data!.id, 'approve', '');
    expect(d.ok).toBe(true);
    expect(['enrolled', 'waitlisted']).toContain(d.data!.status);
  });

  it('prerequisites are enforced', async () => {
    await as('k-lo-trainee');
    const r = await b.rpc.enrolCourse('c-coct', null);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('prerequisite');
  });

  it('cancelling a seat promotes the first person on the waitlist', async () => {
    await as('training-mgr');
    const seat = b.raw('enrolments').find((e) => e.person_id === 'w-ro-01' && e.course_id === 'c-sam')!;
    const r = await b.rpc.cancelEnrolment(seat.id, 'Crew rescheduled for outage');
    expect(r.ok).toBe(true);
    const promoted = b.rawGet('enrolments', r.data!.promoted!)!;
    expect(promoted.person_id).toBe('w-ro-05');
    expect(promoted.status).toBe('enrolled');
  });

  it('a learner cannot mark their own enrolment completed by a direct write', async () => {
    await as('k-ro');
    const mine = (await b.list('enrolments')).find((e) => e.person_id === 'p-k-ro' && e.status === 'assigned')!;
    const r = await b.update('enrolments', mine.id, { status: 'completed', certificate_no: 'KAF-2026-999999' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('forbidden');
    // progress on self-paced learning is still the learner's to update
    expect((await b.update('enrolments', mine.id, { progress_pct: 40 })).ok).toBe(true);
  });
});

describe('M04 completion: linked evaluation, then certificate', () => {
  it('a qualifying course cannot complete without its linked evaluation; a released pass issues a certificate', async () => {
    const enr = b.raw('enrolments').find((e) => e.person_id === 'p-k-lo-trainee' && e.course_id === 'c-hu')!;
    await as('k-instructor');
    expect((await b.rpc.completeEnrolment(enr.id, 'passed', 90, '')).ok).toBe(false); // no attendance yet
    expect((await b.rpc.recordAttendance('s-hu-past', [{ enrolment_id: enr.id, attendance: 'present' }])).ok).toBe(true);
    const gate = await b.rpc.completeEnrolment(enr.id, 'passed', 90, '');
    expect(gate.code).toBe('evaluation_required');

    await as('k-lo-trainee');
    const s = await b.rpc.startAttempt('at-5');
    expect(s.ok).toBe(true);
    const items = s.data!.items;
    expect(items.every((i) => !('answer' in i))).toBe(true);
    const key = (id: string) => b.raw('item_versions').find((v) => v.item_id === id && v.version === b.rawGet('items', id)!.current_version)!.answer;
    expect((await b.rpc.submitAttempt('at-5', items.map((i) => ({ item_id: i.item_id, answer: key(i.item_id) })))).ok).toBe(true);
    expect((await b.rpc.attemptFeedback('at-5')).ok).toBe(false); // hidden until released

    await as('k-instructor');
    expect((await b.rpc.releaseAttempt('at-5', 'Reviewed')).ok).toBe(true);
    const done = await b.rpc.completeEnrolment(enr.id, 'passed', null, 'HU core tools');
    expect(done.ok).toBe(true);
    expect(done.data!.certificate_no).toMatch(/^KAF-\d{4}-\d{6}$/);
    const check = await b.rpc.verifyCertificate(done.data!.certificate_no!);
    expect(check.found).toBe(true);
    expect(check.status).toBe('valid');
    expect(b.raw('training_records').some((r) => r.enrolment_id === enr.id && r.result === 'passed')).toBe(true);
  });

  it('a failed result gives no certificate, and nobody records completion of their own training', async () => {
    await as('k-instructor');
    const own = b.raw('enrolments').find((e) => e.person_id === 'p-k-instructor' && ['assigned', 'in_progress'].includes(e.status))!;
    const r = await b.rpc.completeEnrolment(own.id, 'passed', 95, '');
    expect(r.code).toBe('self_sign');
    const other = b.raw('enrolments').find((e) => e.person_id === 'w-fire-01' && e.course_id === 'c-hu')!;
    await b.rpc.recordAttendance('s-hu-past', [{ enrolment_id: other.id, attendance: 'present' }]);
    const f = await b.rpc.completeEnrolment(other.id, 'failed', 40, 'Did not complete the knowledge check');
    expect(f.ok).toBe(true);
    expect(f.data!.certificate_no).toBeNull();
  });
});

describe('M04 external requests, plans and mentoring', () => {
  it('external requests need a manager or training manager, not the requester', async () => {
    await as('k-instructor');
    expect((await b.rpc.decideExternalRequest('xr-3', 'approved', '')).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.decideExternalRequest('xr-3', 'rejected', '')).code).toBe('invalid'); // rejection needs a reason
    expect((await b.rpc.decideExternalRequest('xr-3', 'approved', 'Budget available')).ok).toBe(true);
  });

  it('a submitted development plan is approved by a manager in scope', async () => {
    await as('ops-ceo');
    const r = await b.rpc.decideDevPlan('dp-k-lo', 'approve', '');
    expect(r.ok).toBe(true);
    expect(b.rawGet('dev_plans', 'dp-k-lo')!.status).toBe('active');
  });

  it('only the mentor accepts a mentoring request, within capacity', async () => {
    await as('k-lo-trainee');
    expect((await b.rpc.respondMentoring('mr-1', 'matched')).code).toBe('forbidden');
    await as('k-instructor');
    const mine = await b.list('mentoring_requests');
    expect(mine.some((m) => m.id === 'mr-1')).toBe(true); // the mentor sees requests addressed to them
    expect((await b.rpc.respondMentoring('mr-1', 'matched')).ok).toBe(true);
  });
});
