/** Which routes, nav entries and lenses the current session can use. */
import { useMemo } from 'react';
import { useSession } from '../auth/session';
import { checkGuard } from '../auth/guards';
import { ROUTES } from '../routes/registry';
import type { Lens, RouteDef } from '../routes/types';

export const LENSES: Lens[] = ['public', 'my', 'partner', 'admin'];
export const zoneLens = (zone: RouteDef['zone']): Lens => (zone === 'staff' ? 'my' : zone === 'partner' ? 'partner' : zone === 'admin' ? 'admin' : 'public');

export function useAccessibleNav() {
  const s = useSession();
  return useMemo(() => {
    const nav = ROUTES.filter((r) => r.nav && checkGuard(r.guard, s) === 'ok').sort((a, b) => a.nav!.order - b.nav!.order);
    const byLens: Record<Lens, RouteDef[]> = { public: [], my: [], partner: [], admin: [] };
    for (const r of nav) byLens[r.nav!.lens].push(r);
    const lenses = LENSES.filter((l) => l === 'public' || byLens[l].length > 0);
    const home = (l: Lens) => (l === 'public' ? '/' : (byLens[l][0]?.path ?? '/'));
    return { byLens, lenses, home };
  }, [s]);
}

/** Group routes into ordered sections. */
export function sections(routes: RouteDef[]): { section: string; items: RouteDef[] }[] {
  const out: { section: string; items: RouteDef[] }[] = [];
  for (const r of routes) {
    const s = r.nav!.section;
    let g = out.find((x) => x.section === s);
    if (!g) out.push((g = { section: s, items: [] }));
    g.items.push(r);
  }
  return out;
}
