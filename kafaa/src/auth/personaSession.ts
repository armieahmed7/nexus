/**
 * Live sign-in for the 14 Kafa'a-only personas (k-*), supabase mode. No password exists anywhere on the client:
 *   1. POST {persona} to the Edge Function kafaa-persona-signin, which keeps one Supabase Auth user per persona (persona claim in
 *      app_metadata) and returns a one-time token hash for it;
 *   2. exchange the hash for a normal Supabase session here (POST /auth/v1/verify, type "email");
 *   3. ask kafaa_whoami() whether the database resolves the persona (migration 20261012161001_kafaa_persona_signin.sql).
 * Tokens live in "kafaa.auth.v1.sessions" (same shape as the NEXUS map) and the chosen persona in "kafaa.auth.v1.active".
 * Opening a URL never signs anyone in (B-01): this runs only from an explicit role-card choice on /sign-in.
 */
import { config } from '../config';
import { K_KAFAA_SESSIONS, dropEntry, readTokens, writeEntry, type NexusTokens } from './nexusSession';

export const K_KAFAA_ACTIVE = 'kafaa.auth.v1.active';

export type PersonaSignInResult =
  | { ok: true }
  /** unavailable: the Edge Function is not deployed (or unreachable); not_resolved: signed in, but the SQL is not live yet. */
  | { ok: false; code: 'unavailable' | 'failed' | 'not_resolved' };

export function activeKafaaPersona(): string | null {
  try {
    const a = localStorage.getItem(K_KAFAA_ACTIVE);
    return a && readTokens(a, K_KAFAA_SESSIONS) ? a : null;
  } catch {
    return null;
  }
}

const anonHeaders = () => ({ apikey: config.supabaseAnonKey, authorization: `Bearer ${config.supabaseAnonKey}`, 'content-type': 'application/json' });

async function requestTokenHash(persona: string): Promise<{ token_hash: string; email: string } | 'unavailable' | 'failed'> {
  let r: Response;
  try {
    r = await fetch(`${config.supabaseUrl}/functions/v1/kafaa-persona-signin`, { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ persona }) });
  } catch {
    return 'unavailable'; // network / CORS: typically the function is not deployed yet
  }
  if (r.status === 404) return 'unavailable';
  if (!r.ok) return r.status === 503 ? 'unavailable' : 'failed';
  try {
    const j = (await r.json()) as { ok?: boolean; token_hash?: string; email?: string };
    return j.ok && j.token_hash ? { token_hash: j.token_hash, email: j.email ?? '' } : 'failed';
  } catch {
    return 'failed';
  }
}

async function verify(tokenHash: string, email: string): Promise<NexusTokens | null> {
  try {
    const r = await fetch(`${config.supabaseUrl}/auth/v1/verify`, { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ type: 'email', token_hash: tokenHash }) });
    if (!r.ok) return null;
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number; user?: { email?: string } };
    if (!j.access_token || !j.refresh_token) return null;
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600), email: j.user?.email ?? email };
  } catch {
    return null;
  }
}

async function resolvesTo(accessToken: string, persona: string): Promise<boolean> {
  try {
    const r = await fetch(`${config.supabaseUrl}/rest/v1/rpc/kafaa_whoami`, { method: 'POST', headers: { ...anonHeaders(), authorization: `Bearer ${accessToken}` }, body: '{}' });
    if (!r.ok) return false;
    const j = (await r.json()) as { persona_id?: string | null; person_id?: string | null };
    return j.persona_id === persona && !!j.person_id;
  } catch {
    return false;
  }
}

function logout(accessToken: string) {
  void fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.supabaseAnonKey, authorization: `Bearer ${accessToken}` } }).catch(() => undefined);
}

/** Explicit role-card sign-in for a Kafa'a persona. Two visitors choosing the same card at once can race for its one-time token: retry once. */
export async function signInKafaaPersona(persona: string): Promise<PersonaSignInResult> {
  let tokens: NexusTokens | null = null;
  for (let attempt = 0; attempt < 2 && !tokens; attempt++) {
    const link = await requestTokenHash(persona);
    if (link === 'unavailable' || link === 'failed') return { ok: false, code: link };
    tokens = await verify(link.token_hash, link.email);
  }
  if (!tokens) return { ok: false, code: 'failed' };
  if (!(await resolvesTo(tokens.access_token, persona))) {
    logout(tokens.access_token);
    return { ok: false, code: 'not_resolved' };
  }
  signOutKafaa(); // an earlier Kafa'a persona in this browser
  writeEntry(persona, tokens, K_KAFAA_SESSIONS);
  try {
    localStorage.setItem(K_KAFAA_ACTIVE, persona);
  } catch {
    /* ignore */
  }
  return { ok: true };
}

/** Sign out of the active Kafa'a persona (revokes this browser's session only; other visitors of the same card are unaffected). */
export function signOutKafaa() {
  try {
    const active = localStorage.getItem(K_KAFAA_ACTIVE);
    const t = active ? readTokens(active, K_KAFAA_SESSIONS) : null;
    if (active && t) {
      logout(t.access_token);
      dropEntry(active, K_KAFAA_SESSIONS);
    }
    localStorage.removeItem(K_KAFAA_ACTIVE);
  } catch {
    /* ignore */
  }
}
