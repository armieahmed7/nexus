/**
 * Who is signed in, with which Kafa'a roles, on which backend.
 *   local mode    : explicit persona choice on /sign-in (no passwords), stored in "kafaa.session.v1". Anonymous by default.
 *   supabase mode : NEXUS same-origin role-card session (nexus.active + consent). Opening a URL never signs anyone in (B-01).
 * Sessions expire on inactivity: 30 minutes, 15 for elevated roles (M14).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { config, setBackendOverride, type BackendKind } from '../config';
import { makeBackend, RepoProvider, getLocalBackend } from '../data';
import type { Identity, Repository, PeopleRow } from '../data/types';
import { grantsFor, type Level, type PlatformRole, type Resource, ROLE_LABELS } from './policy';
import { activeNexusPersona, signInNexusPersona, signOutNexus } from './nexusSession';
import personasJson from '../seed/personas.json';

export interface PersonaCard {
  persona: string;
  person_id: string;
  nexus: boolean;
  title_en: string;
  title_ar: string;
  kind: string;
  org_id: string | null;
  roles: PlatformRole[];
  scopes: string[];
}
export const PERSONAS = personasJson as unknown as PersonaCard[];

export interface Session {
  status: 'loading' | 'anon' | 'signed_in';
  backend: BackendKind;
  persona: PersonaCard | null;
  identity: Identity;
  person: PeopleRow | null;
  roles: PlatformRole[];
  hasRole: (...r: PlatformRole[]) => boolean;
  can: (res: Resource, levels: Level[]) => boolean;
  signIn: (persona: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => void;
  switchBackend: (b: BackendKind) => void;
  personas: PersonaCard[];
  repo: Repository;
}

const ANON: Identity = { personId: null, personaId: null, orgId: null, roles: ['public'], assignments: [] };
const SessionContext = createContext<Session | null>(null);
const ELEVATED: PlatformRole[] = ['admin', 'auditor', 'hr_director', 'licensing_coord', 'training_manager', 'ecp_officer', 'instructor', 'hr_analyst', 'manager', 'partner_admin', 'editor'];

function storedLocalPersona(): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(config.sessionKey) || 'null') as { persona?: string } | null;
    return s?.persona && PERSONAS.some((p) => p.persona === s.persona) ? s.persona : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<BackendKind>(config.backend);
  const [personaId, setPersonaId] = useState<string | null>(() => (config.backend === 'supabase' ? activeNexusPersona() : storedLocalPersona()));
  const repo = useMemo(() => makeBackend(backend, personaId), [backend, personaId]);
  const [identity, setIdentity] = useState<Identity>(ANON);
  const [person, setPerson] = useState<PeopleRow | null>(null);
  const [status, setStatus] = useState<Session['status']>('loading');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    (async () => {
      const who = await repo.whoami().catch(() => ANON);
      const me = who.personId ? await repo.get('people', who.personId).catch(() => null) : null;
      if (!alive) return;
      setIdentity(who);
      setPerson(me);
      setStatus(who.personId ? 'signed_in' : 'anon');
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  // Pick up NEXUS role-card changes made in another tab (supabase mode).
  useEffect(() => {
    if (backend !== 'supabase') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nexus.active' || e.key === 'nexus.auth.v1.consent') setPersonaId(activeNexusPersona());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [backend]);

  const signOut = useCallback(() => {
    if (backend === 'supabase') signOutNexus();
    try {
      localStorage.removeItem(config.sessionKey);
    } catch {
      /* ignore */
    }
    setPersonaId(null);
  }, [backend]);

  const signIn = useCallback(
    async (persona: string) => {
      const card = PERSONAS.find((p) => p.persona === persona);
      if (!card) return { ok: false, message: 'Unknown persona' };
      if (backend === 'supabase') {
        if (!card.nexus) return { ok: false, message: "This persona exists only in the local demo. Switch to the local demo backend to use it." };
        const ok = await signInNexusPersona(persona);
        if (!ok) return { ok: false, message: 'Choose this role card in ENEC NEXUS first (Sign in), then come back.' };
        setPersonaId(persona);
        return { ok: true };
      }
      try {
        localStorage.setItem(config.sessionKey, JSON.stringify({ persona, at: Date.now() }));
      } catch {
        /* ignore */
      }
      setPersonaId(persona);
      return { ok: true };
    },
    [backend],
  );

  const switchBackend = useCallback((b: BackendKind) => {
    setBackendOverride(b === config.envBackend ? null : b);
    setBackend(b);
    setPersonaId(b === 'supabase' ? activeNexusPersona() : storedLocalPersona());
  }, []);

  // Inactivity timeout
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (status !== 'signed_in') return;
    const bump = () => (lastActive.current = Date.now());
    const evts = ['pointerdown', 'keydown', 'scroll'];
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const limit = (identity.roles.some((r) => ELEVATED.includes(r)) ? 15 : 30) * 60_000;
    const t = setInterval(() => {
      if (Date.now() - lastActive.current > limit) signOut();
    }, 30_000);
    return () => {
      evts.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [status, identity.roles, signOut]);

  const value = useMemo<Session>(() => {
    const roles = identity.roles;
    return {
      status,
      backend,
      persona: PERSONAS.find((p) => p.persona === identity.personaId) ?? null,
      identity,
      person,
      roles,
      hasRole: (...r) => r.some((x) => roles.includes(x)),
      can: (res, levels) => levels.some((l) => grantsFor(roles, res).has(l)),
      signIn,
      signOut,
      switchBackend,
      personas: PERSONAS,
      repo,
    };
  }, [status, backend, identity, person, signIn, signOut, switchBackend, repo]);

  return (
    <SessionContext.Provider value={value}>
      <RepoProvider repo={repo}>{children}</RepoProvider>
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

export function roleLabel(r: PlatformRole, lang: 'en' | 'ar') {
  return ROLE_LABELS[r][lang];
}

/** Test/demo helper: reset the local demo tenant to its seeded state. */
export async function resetLocalDemo() {
  await getLocalBackend().reset();
}
