/** [G3] M06 talent pipeline: applicant RPCs, HR decisions and the aggregate funnel on the LocalBackend (mirror of the SQL RPCs). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';

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

describe('applicant journey', () => {
  it('an applicant submits, sees the plain-language history and withdraws; deletion is scheduled', async () => {
    await as('k-student');
    const r = await b.rpc.submitApplication('dnt', { stage_finder: 'finishing_school', nationality: 'uae' });
    expect(r.ok).toBe(true);
    expect(r.data?.stage).toBe('submitted');
    const mine = await b.list('applications', { filter: { programme_id: 'dnt' } });
    expect(mine).toHaveLength(1);
    expect(mine[0].nationality_flag).toBe('uae');
    const ev = await b.list('application_events', { filter: { application_id: r.data!.id } });
    expect(ev.map((e) => e.stage)).toEqual(['submitted']);
    const w = await b.rpc.withdrawApplication(r.data!.id, 'Changed my plans');
    expect(w.ok).toBe(true);
    const after = await b.get('applications', r.data!.id);
    expect(after?.stage).toBe('withdrawn');
    expect(after?.delete_after).toBeTruthy();
  });
  it('refuses a duplicate open application, link-out programmes and identity documents', async () => {
    await as('k-student');
    expect((await b.rpc.submitApplication('dnt', {})).ok).toBe(true);
    const dup = await b.rpc.submitApplication('dnt', {});
    expect(dup.code).toBe('conflict');
    expect((await b.rpc.submitApplication('train-for-work', {})).code).toBe('invalid');
    const eid = await b.rpc.submitApplication('gpo', { emirates_id: '784-0000-0000000-0' });
    expect(eid.ok).toBe(false);
    expect(eid.code).toBe('invalid');
    expect(eid.audit_seq).toBeGreaterThan(0);
  });
  it('an expression of interest is recorded as stage "interest"', async () => {
    await as('k-graduate');
    const r = await b.rpc.submitApplication('mustaqbali', { mode: 'interest' });
    expect(r.data?.stage).toBe('interest');
  });
  it('anonymous visitors cannot apply and applicants cannot write applications directly', async () => {
    await as(null);
    expect((await b.rpc.submitApplication('dnt', {})).code).toBe('not_signed_in');
    await as('k-student');
    const own = (await b.list('applications'))[0];
    const direct = await b.update('applications', own.id, { stage: 'offer' });
    expect(direct.ok).toBe(false);
    const ins = await b.insert('applications', { person_id: own.person_id, programme_id: 'gdp', stage: 'offer' });
    expect(ins.ok).toBe(false);
  });
  it("an applicant cannot withdraw someone else's application", async () => {
    await as('k-graduate');
    const r = await b.rpc.withdrawApplication('app-1', 'x');
    expect(r.code).toBe('not_found');
  });
});

describe('HR screening and funnel', () => {
  it('the HR analyst sees counts only, with cells under the minimum group size suppressed', async () => {
    await as('k-hr-analyst');
    expect(await b.list('applications')).toEqual([]);
    const f = await b.rpc.applicationFunnel();
    expect(f.some((c) => c.suppressed && c.n === null)).toBe(true);
    expect(f.some((c) => !c.suppressed)).toBe(true);
    expect(f.every((c) => c.suppressed || (c.n ?? 0) >= MIN_GROUP_SIZE)).toBe(true);
  });
  it('the HR authority records a decision as evidence; a closed application cannot be decided', async () => {
    await as('chco');
    const all = await b.list('applications');
    expect(all.length).toBeGreaterThan(100);
    const r = await b.rpc.decideApplication('app-p001', 'screening', 'Eligibility confirmed');
    expect(r.ok).toBe(true);
    expect(r.audit_seq).toBeGreaterThan(0);
    const closed = await b.rpc.decideApplication('app-8', 'offer', 'x');
    expect(closed.code).toBe('invalid');
  });
  it('nobody else records HR decisions', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.decideApplication('app-p001', 'offer', 'x')).code).toBe('forbidden');
  });
});
