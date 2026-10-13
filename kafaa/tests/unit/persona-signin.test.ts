// @vitest-environment jsdom
// Kafa'a persona live sign-in (src/auth/personaSession.ts): Edge Function -> /auth/v1/verify -> kafaa_whoami, with no password anywhere.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeKafaaPersona, signInKafaaPersona, signOutKafaa, K_KAFAA_ACTIVE } from '../../src/auth/personaSession';
import { accessTokenFor, K_KAFAA_SESSIONS } from '../../src/auth/nexusSession';
import personas from '../../src/seed/personas.json';
import { readFileSync } from 'node:fs';

type Call = { url: string; body: unknown; headers: Record<string, string> };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockFetch(routes: { fn?: () => Response; verify?: () => Response; whoami?: () => Response }) {
  const calls: Call[] = [];
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes('/functions/v1/kafaa-persona-signin')) return routes.fn ? routes.fn() : json(404, {});
    if (url.includes('/auth/v1/verify')) return routes.verify ? routes.verify() : json(400, {});
    if (url.includes('/rest/v1/rpc/kafaa_whoami')) return routes.whoami ? routes.whoami() : json(200, { persona_id: null, person_id: null });
    if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
    return json(404, {});
  });
  vi.stubGlobal('fetch', f);
  return calls;
}
const session = (n = 1) => json(200, { access_token: `at-${n}`, refresh_token: `rt-${n}`, expires_in: 3600, user: { email: 'k-admin@personas.kafaa.demo' } });

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Kafa\'a persona live sign-in', () => {
  it('signs in through the Edge Function and stores a real session (no password sent anywhere)', async () => {
    const calls = mockFetch({ fn: () => json(200, { ok: true, token_hash: 'th-1', email: 'k-admin@personas.kafaa.demo' }), verify: () => session(1), whoami: () => json(200, { persona_id: 'k-admin', person_id: 'p-k-admin' }) });
    const r = await signInKafaaPersona('k-admin');
    expect(r).toEqual({ ok: true });
    expect(activeKafaaPersona()).toBe('k-admin');
    expect(await accessTokenFor('k-admin')).toBe('at-1');
    expect(calls[0].body).toEqual({ persona: 'k-admin' });
    expect(calls[1].body).toEqual({ type: 'email', token_hash: 'th-1' });
    expect(calls[2].headers.authorization).toBe('Bearer at-1');
    expect(JSON.stringify(calls).toLowerCase()).not.toContain('password');
  });

  it('says "unavailable" when the Edge Function is not deployed, and stores nothing', async () => {
    mockFetch({});
    expect(await signInKafaaPersona('k-ro')).toEqual({ ok: false, code: 'unavailable' });
    expect(activeKafaaPersona()).toBeNull();
    expect(localStorage.getItem(K_KAFAA_SESSIONS)).toBeNull();
  });

  it('says "not_resolved" (and signs the session out) when the database does not recognise the persona yet', async () => {
    const calls = mockFetch({ fn: () => json(200, { ok: true, token_hash: 'th', email: 'e' }), verify: () => session(2) });
    expect(await signInKafaaPersona('k-ro')).toEqual({ ok: false, code: 'not_resolved' });
    expect(activeKafaaPersona()).toBeNull();
    expect(calls.some((c) => c.url.includes('/auth/v1/logout'))).toBe(true);
  });

  it('retries once when another visitor used the same card\'s one-time token first', async () => {
    let verifies = 0;
    mockFetch({ fn: () => json(200, { ok: true, token_hash: `th-${verifies}`, email: 'e' }), verify: () => (++verifies === 1 ? json(403, { error: 'otp_expired' }) : session(3)), whoami: () => json(200, { persona_id: 'k-ecp', person_id: 'p-k-ecp' }) });
    expect(await signInKafaaPersona('k-ecp')).toEqual({ ok: true });
    expect(verifies).toBe(2);
  });

  it('signing out drops this browser\'s Kafa\'a session', async () => {
    mockFetch({ fn: () => json(200, { ok: true, token_hash: 'th', email: 'e' }), verify: () => session(4), whoami: () => json(200, { persona_id: 'k-editor', person_id: 'p-k-editor' }) });
    await signInKafaaPersona('k-editor');
    signOutKafaa();
    expect(localStorage.getItem(K_KAFAA_ACTIVE)).toBeNull();
    expect(JSON.parse(localStorage.getItem(K_KAFAA_SESSIONS) || '{}')).toEqual({});
  });

  it('the Edge Function allow-list is exactly the Kafa\'a-only personas (never a NEXUS role card)', () => {
    const src = readFileSync('supabase/functions/kafaa-persona-signin/index.ts', 'utf8');
    const list = [...src.match(/new Set\(\[([\s\S]*?)\]\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const kafaa = (personas as { persona: string; nexus: boolean }[]).filter((p) => !p.nexus).map((p) => p.persona).sort();
    expect(list).toEqual(kafaa);
    expect(list.every((p) => p.startsWith('k-'))).toBe(true);
  });
});
