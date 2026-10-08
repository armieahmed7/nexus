/** G5 business rules and LocalBackend workflows: ECP referral log and triage, access grants and reviews, feature flags,
 *  content publish blockers, self-service data rights. Mirrors the "G5 checks" in scripts/validate-migrations.mjs. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { accessReviewState, allowedConcernNext, concernTransitionError, publishBlockers, reviewOverdue, syncState, triageOverdue, dalilModeAllowed, availableDalilModes } from '../../src/domain/g5rules';

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

describe('g5rules', () => {
  it('concern transitions follow received -> triaged -> investigating/referred -> closed', () => {
    expect(allowedConcernNext('received')).not.toContain('closed');
    expect(allowedConcernNext('received')).toContain('triaged');
    expect(allowedConcernNext('closed').filter((x) => x !== 'closed')).toEqual([]);
    expect(concernTransitionError('received', 'closed', 'routine', 'no_action')).not.toBeNull();
    expect(concernTransitionError('triaged', 'closed', 'routine', null)).not.toBeNull(); // closing needs an outcome
    expect(concernTransitionError('triaged', 'closed', 'routine', 'no_action')).toBeNull();
  });
  it('triage is overdue after two working days', () => {
    expect(triageOverdue({ status: 'received', received_on: '2026-10-01' }, '2026-10-08')).toBe(true);
    expect(triageOverdue({ status: 'triaged', received_on: '2026-10-01' }, '2026-10-08')).toBe(false);
  });
  it('elevated grants need a review every 92 days; ordinary roles never do', () => {
    expect(accessReviewState({ role: 'employee', status: 'active', granted_at: '2020-01-01T00:00:00Z' }, '2026-10-08')).toBe('not_required');
    expect(accessReviewState({ role: 'admin', status: 'active', granted_at: '2026-01-01T00:00:00Z' }, '2026-10-08')).toBe('overdue');
    expect(accessReviewState({ role: 'admin', status: 'active', granted_at: '2026-01-01T00:00:00Z', reviewed_at: '2026-09-01T00:00:00Z' }, '2026-10-08')).toBe('ok');
    expect(accessReviewState({ role: 'admin', status: 'active', granted_at: '2026-07-01T00:00:00Z' }, '2026-09-25')).toBe('due');
  });
  it('a page publishes only with both languages, sources, a review date and body text; ECP pages never', () => {
    const ok = { translation_status: 'both_approved', sources: [{ id: 's' }], review_on: '2027-01-01', body_en: 'x', body_ar: 'س' };
    expect(publishBlockers(ok)).toEqual([]);
    expect(publishBlockers({ ...ok, translation_status: 'ar_draft' })).toContain('translation');
    expect(publishBlockers({ ...ok, sources: [] })).toContain('sources');
    expect(publishBlockers({ ...ok, sources: [], no_factual_claims: true })).toEqual([]);
    expect(publishBlockers({ ...ok, ecp_owned: true })).toContain('ecp_owned');
    expect(reviewOverdue({ review_on: '2026-01-01' }, '2026-10-08')).toBe(true);
  });
  it('sync state turns stale past the threshold', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(syncState({ status: 'ok', last_success: '2026-10-08T02:00:00Z', threshold_hours: 24 }, now)).toBe('ok');
    expect(syncState({ status: 'ok', last_success: '2026-10-05T02:00:00Z', threshold_hours: 24 }, now)).toBe('stale');
    expect(syncState({ status: 'disabled', last_success: '2026-10-05T02:00:00Z', threshold_hours: 24 }, now)).toBe('disabled');
  });
  it('Dalil modes: anonymous is public only; staff mode needs a staff role', () => {
    expect(availableDalilModes(['public'], false)).toEqual(['public']);
    expect(dalilModeAllowed('staff', ['public'], false)).toBe(false);
    expect(dalilModeAllowed('staff', ['employee'], true)).toBe(true);
    expect(dalilModeAllowed('partner', ['employee'], true)).toBe(false);
  });
});

describe('ECP referral log (metadata only)', () => {
  it('the ECP officer logs a referral with an ECP reference and no concern text', async () => {
    await as('k-ecp');
    const r = await b.rpc.logConcernReferral({ received_on: '2026-10-07', channel: 'phone', anonymous: true, category: 'nuclear_safety', ecp_system_ref: 'ECP-SYS-77' });
    expect(r.ok).toBe(true);
    expect(r.data!.ref_no).toMatch(/^ECP-\d{4}-\d{3}$/);
    const row = await b.get('concern_cases', r.data!.id);
    expect(row).not.toBeNull();
    expect(JSON.stringify(row)).not.toMatch(/description|concern_text|details/);
  });
  it('triage enforces the transition rules and records the outcome on closure', async () => {
    await as('k-ecp');
    expect((await b.rpc.triageConcernV2('cc-5', 'closed', 'routine', 'no_action')).ok).toBe(false);
    expect((await b.rpc.triageConcernV2('cc-5', 'triaged', 'priority', null)).ok).toBe(true);
    const closed = await b.rpc.triageConcernV2('cc-5', 'closed', 'priority', 'referred_cap');
    expect(closed.ok).toBe(true);
    const row = await b.get('concern_cases', 'cc-5');
    expect(row!.status).toBe('closed');
    expect(row!.outcome).toBe('referred_cap');
  });
  it('nobody else can read the referral log', async () => {
    for (const p of ['k-admin', 'k-auditor', 'k-hr-analyst', 'sro', null]) {
      await as(p);
      expect(await b.list('concern_cases')).toEqual([]);
    }
  });
});

describe('access administration', () => {
  it('an elevated grant waits for a second admin; the granting admin cannot approve it', async () => {
    await as('k-admin');
    const people = await b.list('people', { filter: { status: 'active' } });
    const target = people.find((p) => p.persona_id === 'k-hr-analyst')!;
    const g = await b.rpc.grantRole(target.id, 'auditor', 'all', null);
    expect(g.ok).toBe(true);
    expect(g.data!.status).toBe('pending_second');
    const self = await b.rpc.approveRole(g.data!.id);
    expect(self.ok).toBe(false);
    expect(self.code).toBe('maker_checker');
    await as('ai-governance');
    expect((await b.rpc.approveRole(g.data!.id)).ok).toBe(true);
  });
  it('a partner admin can grant partner_user only inside their own organisation', async () => {
    await as('alnoor-gm');
    const mine = await b.list('people');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((p) => p.org_id === mine[0].org_id)).toBe(true);
    expect((await b.rpc.grantRole(mine[0].id, 'partner_user', 'org', mine[0].org_id ?? null)).ok).toBe(true);
    expect((await b.rpc.grantRole(mine[0].id, 'admin', 'all', null)).ok).toBe(false);
  });
  it('access review: keep stamps the review, revoke needs a reason, nobody reviews their own access', async () => {
    await as('k-admin');
    const me = (await b.whoami()).personId!;
    const all = await b.list('role_assignments', { filter: { status: 'active' } });
    const own = all.find((a) => a.person_id === me)!;
    expect((await b.rpc.reviewRoleAccess(own.id, 'keep', '')).code).toBe('maker_checker');
    const other = all.find((a) => a.person_id !== me && ['training_manager', 'editor', 'auditor', 'instructor', 'licensing_coord'].includes(a.role))!;
    expect((await b.rpc.reviewRoleAccess(other.id, 'revoke', 'no')).ok).toBe(false);
    expect((await b.rpc.reviewRoleAccess(other.id, 'keep', 'still needed')).ok).toBe(true);
    expect((await b.get('role_assignments', other.id))!.reviewed_at).toBeTruthy();
  });
  it('the auditor reads access data but cannot change it', async () => {
    await as('k-auditor');
    expect((await b.list('role_assignments')).length).toBeGreaterThan(0);
    const a = (await b.list('role_assignments'))[0];
    expect((await b.rpc.revokeRole(a.id, 'testing')).ok).toBe(false);
  });
});

describe('feature flags', () => {
  it('everyone reads flags; only the platform admin changes them; locked flags never change', async () => {
    await as(null);
    const flags = await b.list('feature_flags');
    expect(flags.find((f) => f.key === 'speak_up_no_telemetry')!.locked).toBe(true);
    const news = flags.find((f) => f.key === 'news')!;
    expect((await b.update('feature_flags', news.id, { enabled: false })).ok).toBe(false);
    await as('k-editor');
    expect((await b.update('feature_flags', news.id, { enabled: false })).ok).toBe(false);
    await as('k-admin');
    expect((await b.update('feature_flags', news.id, { enabled: false })).ok).toBe(true);
    const locked = flags.find((f) => f.key === 'speak_up_no_telemetry')!;
    const r = await b.update('feature_flags', locked.id, { enabled: false });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('forbidden');
  });
});

describe('data rights and audit', () => {
  it('a person files a data request and withdraws a consent; others cannot see them', async () => {
    await as('k-lo-trainee');
    const me = (await b.whoami()).personId!;
    const r = await b.insert('data_requests', { person_id: me, kind: 'export', status: 'open', note: 'please' });
    expect(r.ok).toBe(true);
    expect((await b.insert('data_requests', { person_id: 'someone-else', kind: 'view', status: 'open', note: 'x' })).ok).toBe(false);
    await as('k-hr-analyst');
    expect((await b.list('data_requests')).some((x) => x.id === r.data!.id)).toBe(false);
  });
  it('audit entries cannot be edited, and the chain verifies', async () => {
    await as('k-auditor');
    const [first] = await b.list('audit_events', { order: [['seq', 'asc']] });
    expect((await b.update('audit_events', first.id, { reason: 'tampered' })).ok).toBe(false);
    expect((await b.rpc.auditVerify()).ok).toBe(true);
  });
  it('NEXUS ledger viewer: admin and auditor only, Kafa\'a entries only', async () => {
    await as('k-ecp');
    await b.rpc.logConcernReferral({ received_on: '2026-10-07', channel: 'intranet', anonymous: false, category: 'other', ecp_system_ref: 'ECP-SYS-78' });
    await as('k-auditor');
    const rows = await b.nexus.ledger();
    expect(rows.every((r) => r.domain === 'KAFAA')).toBe(true);
    await as('k-lo-trainee');
    expect(await b.nexus.ledger()).toEqual([]);
  });
});
