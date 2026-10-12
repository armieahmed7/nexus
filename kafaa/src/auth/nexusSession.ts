/**
 * Same-origin NEXUS session reuse (discovery doc §1.5). Kafa'a never signs anyone in by opening a URL (NEXUS B-01):
 * it uses a NEXUS role-card session only when the viewer has explicitly chosen one in NEXUS (consent === "1").
 *   nexus.auth.v1.sessions  {personaId: {access_token, refresh_token, expires_at, email}}
 *   nexus.active            current persona id
 *   nexus.auth.v1.consent   "1" once a role card was chosen explicitly
 * When refreshing, re-read the map and merge only this persona's entry (a NEXUS tab may have rewritten the map).
 */
import { config } from '../config';

export interface NexusTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  email: string;
}
const K_SESSIONS = 'nexus.auth.v1.sessions';
const K_ACTIVE = 'nexus.active';
const K_CONSENT = 'nexus.auth.v1.consent';

/** Kafa'a-only personas (k-*) signed in through the kafaa-persona-signin Edge Function keep their tokens here, in the same shape. */
export const K_KAFAA_SESSIONS = 'kafaa.auth.v1.sessions';

function readMap(key = K_SESSIONS): Record<string, NexusTokens> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, NexusTokens>;
  } catch {
    return {};
  }
}
export function writeEntry(persona: string, tokens: NexusTokens, key = K_SESSIONS) {
  try {
    const fresh = readMap(key); // re-read immediately before writing
    fresh[persona] = tokens;
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch {
    /* ignore */
  }
}
/** The token map that holds this persona: the Kafa'a persona map when it has an entry, else the NEXUS map. */
function mapKeyFor(persona: string): string {
  return readMap(K_KAFAA_SESSIONS)[persona] ? K_KAFAA_SESSIONS : K_SESSIONS;
}
export function readTokens(persona: string, key = K_SESSIONS): NexusTokens | null {
  return readMap(key)[persona] ?? null;
}
export function dropEntry(persona: string, key: string) {
  try {
    const map = readMap(key);
    delete map[persona];
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function activeNexusPersona(): string | null {
  try {
    if (localStorage.getItem(K_CONSENT) !== '1') return null;
    const a = localStorage.getItem(K_ACTIVE);
    if (!a) return null;
    return readMap()[a] ? a : null;
  } catch {
    return null;
  }
}

export async function tokenRequest(grant: 'refresh_token' | 'password', body: Record<string, string>): Promise<NexusTokens | null> {
  try {
    const r = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user?: { email?: string } };
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600), email: j.user?.email ?? body.email ?? '' };
  } catch {
    return null;
  }
}

const inflight = new Map<string, Promise<string | null>>();
/** A valid access token for the persona, refreshing (and writing back) when needed; null if none. */
export function accessTokenFor(persona: string): Promise<string | null> {
  const existing = inflight.get(persona);
  if (existing) return existing;
  const p = (async () => {
    const key = mapKeyFor(persona);
    const t = readMap(key)[persona];
    if (!t) return null;
    if (t.expires_at - 60 > Date.now() / 1000) return t.access_token;
    const next = await tokenRequest('refresh_token', { refresh_token: t.refresh_token });
    if (next) {
      writeEntry(persona, { ...next, email: next.email || t.email }, key);
      return next.access_token;
    }
    // The refresh token may have been rotated by another tab: re-read once before giving up.
    const again = readMap(key)[persona];
    if (again && again.expires_at - 60 > Date.now() / 1000) return again.access_token;
    return null;
  })().finally(() => inflight.delete(persona));
  inflight.set(persona, p);
  return p;
}

/**
 * Explicit role-card sign-in from the Kafa'a sign-in screen (supabase mode only, and only when VITE_NEXUS_DEMO_PASSWORD
 * is configured). Mirrors what NEXUS itself does: password grant, then record the session, the active persona and consent.
 */
export async function signInNexusPersona(persona: string): Promise<boolean> {
  if (!config.nexusDemoPassword) return false;
  const email = `${persona}@demo.enec-nexus.ae`;
  const t = await tokenRequest('password', { email, password: config.nexusDemoPassword });
  if (!t) return false;
  writeEntry(persona, { ...t, email });
  try {
    localStorage.setItem(K_ACTIVE, persona);
    localStorage.setItem(K_CONSENT, '1');
  } catch {
    /* ignore */
  }
  return true;
}

/** Sign out of the active NEXUS role card (the same keys NEXUS clears). */
export function signOutNexus() {
  try {
    const active = localStorage.getItem(K_ACTIVE);
    const map = readMap();
    if (active && map[active]) {
      void fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.supabaseAnonKey, authorization: `Bearer ${map[active].access_token}` } }).catch(() => undefined);
      delete map[active];
      localStorage.setItem(K_SESSIONS, JSON.stringify(map));
    }
    localStorage.removeItem(K_ACTIVE);
    localStorage.removeItem(K_CONSENT);
  } catch {
    /* ignore */
  }
}
