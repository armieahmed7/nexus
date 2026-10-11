/** Runtime configuration. Backend can be overridden per browser for demos (localStorage "kafaa.backend"). */
export type BackendKind = 'local' | 'supabase';

/** Default is the live NEXUS project; VITE_KAFAA_BACKEND=local keeps the in-browser demo tenant as a fallback. */
const envBackend: BackendKind = (import.meta.env.VITE_KAFAA_BACKEND as string | undefined) === 'local' ? 'local' : 'supabase';

/** Where ENEC NEXUS lives. When Kafa'a is served on that origin, NEXUS links are root-relative. */
const NEXUS_URL = ((import.meta.env.VITE_NEXUS_URL as string | undefined) || 'https://enecai.xyz/').replace(/\/?$/, '/');
function nexusOrigin(): string {
  try {
    return new URL(NEXUS_URL).origin;
  } catch {
    return '';
  }
}
/** True when Kafa'a and NEXUS share an origin (and so share NEXUS's localStorage session). */
export function sameOriginAsNexus(): boolean {
  try {
    return typeof window !== 'undefined' && window.location.origin === nexusOrigin();
  } catch {
    return false;
  }
}
/** A NEXUS URL: root-relative on the NEXUS origin, absolute (https://enecai.xyz/...) anywhere else. */
export function nexusHref(path = ''): string {
  const p = path.replace(/^\//, '');
  return sameOriginAsNexus() ? `/${p}` : `${NEXUS_URL}${p}`;
}
function override(): BackendKind | null {
  try {
    const v = localStorage.getItem('kafaa.backend');
    return v === 'local' || v === 'supabase' ? v : null;
  } catch {
    return null;
  }
}

export const config = {
  /** Default backend from VITE_KAFAA_BACKEND (local|supabase); a per-browser override wins. */
  backend: (override() ?? envBackend) as BackendKind,
  envBackend: envBackend as BackendKind,
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://hlirqxoddysxtdezwcgv.supabase.co',
  /** Public anon key; the same key ships in the NEXUS bundle by design. */
  supabaseAnonKey:
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaXJxeG9kZHlzeHRkZXp3Y2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODI3MjMsImV4cCI6MjEwNjI1ODcyM30.zLcxcZQhfdVriYwAna-lIBSajSG7ENfnrlHcCMJK6Zc',
  /** Optional: lets the Kafa'a sign-in screen sign NEXUS role cards in directly (never committed; see .env.example). */
  nexusDemoPassword: (import.meta.env.VITE_NEXUS_DEMO_PASSWORD as string | undefined) || '',
  basename: '/kafaa',
  nexusUrl: NEXUS_URL,
  get nexusHome() {
    return nexusHref('');
  },
  get nexusSignIn() {
    return nexusHref('sign-in');
  },
  localStorageKey: 'kafaa.local.v1',
  sessionKey: 'kafaa.session.v1',
};

export function setBackendOverride(b: BackendKind | null) {
  try {
    if (b) localStorage.setItem('kafaa.backend', b);
    else localStorage.removeItem('kafaa.backend');
  } catch {
    /* ignore */
  }
}
