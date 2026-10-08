/**
 * Data access for pages:
 *   const repo = useRepo();
 *   const { data, loading, error, reload } = useQuery(['job_roles'], () => repo.list('job_roles', { order: [['sort','asc']] }));
 *   const run = useAction();  await run(() => repo.rpc.signoffEvaluation({...}), { success: t('...') });
 * useQuery refetches automatically when any of the listed tables changes (repo.subscribe).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { config, type BackendKind } from '../config';
import { LocalBackend } from './local/LocalBackend';
import { SupabaseBackend } from './supabase/SupabaseBackend';
import type { Repository, Result, Table } from './types';
import { useToast } from '../ui/Toast';

export * from './types';
export { can, AccessContext } from './access';

let localSingleton: LocalBackend | null = null;
export function getLocalBackend(): LocalBackend {
  return (localSingleton ??= new LocalBackend());
}
let supaSingleton: SupabaseBackend | null = null;
export function getSupabaseBackend(): SupabaseBackend {
  return (supaSingleton ??= new SupabaseBackend(null));
}
/** Backends are singletons; the session sets the persona on them (repo.setPersona) inside an effect. */
export function makeBackend(kind: BackendKind): Repository {
  return kind === 'supabase' ? getSupabaseBackend() : getLocalBackend();
}

const RepoContext = createContext<Repository | null>(null);
export function RepoProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}
export function useRepo(): Repository {
  const r = useContext(RepoContext);
  if (!r) throw new Error('useRepo outside RepoProvider');
  return r;
}

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}
/** Fetch with automatic refetch when one of `tables` changes. `deps` re-run the fetch (e.g. route params). */
export function useQuery<T>(tables: Table[] | Table, fn: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const repo = useRepo();
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({ data: undefined, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current().then(
      (data) => id === seq.current && setState({ data, loading: false, error: null }),
      (error: unknown) => id === seq.current && setState({ data: undefined, loading: false, error: error instanceof Error ? error : new Error(String(error)) }),
    );
  }, []);
  const tableKey = (Array.isArray(tables) ? tables : [tables]).join(',');
  useEffect(() => {
    run();
    const watched = new Set(tableKey.split(','));
    return repo.subscribe((changed) => {
      if (changed.length === 0 || changed.some((t) => watched.has(t))) run();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, tableKey, run, ...deps]);
  return useMemo(() => ({ ...state, reload: run }), [state, run]);
}

/** Run a write and toast the outcome. Returns the Result so callers can branch. */
export function useAction() {
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => Promise<Result<T>>, msgs: { success?: string; failure?: string } = {}): Promise<Result<T>> => {
      try {
        const r = await fn();
        if (r.ok) toast.push({ tone: 'ok', title: msgs.success ?? r.message });
        else toast.push({ tone: 'bad', title: msgs.failure ?? r.message, detail: r.code });
        return r;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.push({ tone: 'bad', title: msgs.failure ?? message });
        return { ok: false, code: 'error', message };
      }
    },
    [toast],
  );
}

export { config };
// F02 (wave 0): engine kernel hook for pages
export { useEngine } from './useEngine';
