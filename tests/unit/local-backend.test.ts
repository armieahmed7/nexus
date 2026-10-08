/** LocalBackend mirrors RLS and the SQL RPCs: these are the same guarantees validate-migrations checks in Postgres. */
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

describe('identity and row-level access', () => {
  it('anonymous visitors see public catalogue rows but no people', async () => {
    await as(null);
    expect((await b.whoami()).roles).toEqual(['public']);
    expect((await b.list('job_roles')).length).toBeGreaterThan(20);
    expect(await b.list('people')).toEqual([]);
  });
  it('a partner admin sees only their own organisation equivalency requests', async () => {
    await as('alnoor-gm');
    const rows = await b.list('equivalency_requests');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.org_id === 'org-alnoor')).toBe(true);
    const other = await b.rpc.getEquivalency('eq-4');
    expect(other.ok).toBe(false);
    expect(other.code).toBe('not_found');
    expect((await b.rpc.getEquivalency('eq-1')).ok).toBe(true);
  });
});

describe('consequential actions', () => {
  it('an evaluator cannot sign off their own qualification (refusal is audited)', async () => {
    await as('k-instructor');
    const r = await b.rpc.signoffEvaluation({ record_id: 'qr-p-k-instructor-qs-sro', result: 'pass' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('self_sign');
    expect(r.audit_seq).toBeGreaterThan(0);
  });
  it('the audit chain verifies after actions', async () => {
    await as('k-instructor');
    await b.rpc.signoffEvaluation({ record_id: 'qr-p-k-instructor-qs-sro', result: 'pass' });
    await as('k-auditor');
    const v = await b.rpc.auditVerify();
    expect(v.ok).toBe(true);
    expect(v.data?.entries).toBeGreaterThan(7);
  });
  it('workforce aggregates suppress groups under 10', async () => {
    await as('k-hr-analyst');
    const rows = await b.rpc.workforceAggregate('2026-Q3', null);
    const small = rows.filter((r) => r.suppressed);
    expect(small.length).toBeGreaterThan(0);
    // Neither the value nor the group size of a suppressed cell is revealed.
    expect(small.every((r) => r.value === null && r.group_size === null)).toBe(true);
    expect(rows.filter((r) => !r.suppressed).every((r) => (r.group_size ?? 0) >= 10)).toBe(true);
  });
});
