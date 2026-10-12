/** Audit 2026-10-12: the local-demo mirrors of the SQL fixes (scripts/validate/audit-fixes.mjs checks the SQL side in PGlite).
 *  e. kafaa_contact_requests insert check -> contactRequestProblems + the direct-write guard; staff change only the status afterwards.
 *  f. kafaa_verify_certificate rate limit -> LocalRpc.verifyCertificate (20 checks of one number per minute, every check audited). */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { CONTACT_ROUTES, contactRequestProblems } from '../../src/domain/contact';

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

const form = (x: Record<string, unknown> = {}) => ({ topic: 'careers', route_to: CONTACT_ROUTES.careers, name: 'Test', email: 'careers@example.org', message: 'I would like to know more.', status: 'routed', lang: 'en', consent_contact: true, retention_until: '2027-04-06', ...x });

describe('contact requests (fix e)', () => {
  it('the TS rule names the same limits as the SQL check, and the routes match its CASE', () => {
    const sql = readFileSync('supabase/migrations/20261012154001_kafaa_audit_contact_requests.sql', 'utf8');
    for (const [topic, route] of Object.entries(CONTACT_ROUTES)) expect(sql).toContain(`when '${topic}' then '${route}'`);
    for (const lim of ['length(id) <= 64', 'between 1 and 4000', 'length(name), 0) <= 200', 'length(email), 0) <= 320', 'current_date + 400']) expect(sql).toContain(lim);
    expect(contactRequestProblems(form(), '2026-10-08')).toBeNull();
    expect(contactRequestProblems(form({ status: undefined }), '2026-10-08')).toBeNull();
    expect(contactRequestProblems(form({ status: 'closed' }), '2026-10-08')).toMatch(/new or routed/);
    expect(contactRequestProblems(form({ route_to: CONTACT_ROUTES.media }), '2026-10-08')).toMatch(/mailbox/);
    expect(contactRequestProblems(form({ message: '' }), '2026-10-08')).toMatch(/message/);
    expect(contactRequestProblems(form({ message: 'x'.repeat(4001) }), '2026-10-08')).toMatch(/message/);
    expect(contactRequestProblems(form({ retention_until: '2027-11-13' }), '2026-10-08')).toMatch(/retention/);
  });

  it('anonymous visitors send the public form; a crafted row is refused; an admin only changes the status', async () => {
    await as(null);
    const sent = await b.insert('contact_requests', form() as never);
    expect(sent.ok).toBe(true);
    const supplier = await b.insert('contact_requests', { topic: 'suppliers', route_to: CONTACT_ROUTES.suppliers, name: 'Co', email: 'suppliers@example.org', message: 'Company: Co' } as never);
    expect(supplier.ok).toBe(true);
    expect((await b.insert('contact_requests', form({ status: 'closed' }) as never)).ok).toBe(false);
    expect((await b.insert('contact_requests', form({ route_to: 'A named person' }) as never)).ok).toBe(false);
    await as('k-admin');
    expect((await b.update('contact_requests', sent.data!.id, { status: 'closed' } as never)).ok).toBe(true);
    const edit = await b.update('contact_requests', sent.data!.id, { message: 'changed' } as never);
    expect(edit.ok).toBe(false);
    expect(edit.message).toMatch(/Only the status/);
  });
});

describe('certificate verification rate limit (fix f)', () => {
  it('every check is audited; the 21st check of one number within a minute is refused; other numbers still work', async () => {
    await as(null);
    const no = b.raw('certificates')[0].id;
    const before = b.raw('audit_events').filter((a) => a.action === 'certificate.verify').length;
    for (let k = 0; k < 20; k++) expect((await b.rpc.verifyCertificate(k % 2 ? no.toLowerCase() : no)).found).toBe(true);
    expect(b.raw('audit_events').filter((a) => a.action === 'certificate.verify').length).toBe(before + 20);
    const limited = await b.rpc.verifyCertificate(no);
    expect(limited).toMatchObject({ found: false, code: 'rate_limited' });
    expect(limited.message).toMatch(/try again in a minute/);
    const other = await b.rpc.verifyCertificate('NO-SUCH-CERT');
    expect(other.found).toBe(false);
    expect(other.code).toBeUndefined();
  });
});
