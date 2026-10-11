import type { RouteDef } from '../routes/types';
type T = (k: string, v?: Record<string, string | number>) => string;
export const routeTitle = (t: T, def: RouteDef) => t(`${def.module.toLowerCase()}.routes.${def.id}.title`);
export const routePurpose = (t: T, def: RouteDef) => t(`${def.module.toLowerCase()}.routes.${def.id}.purpose`);
export function isRehearsal(): boolean {
  try {
    return localStorage.getItem('nexus.rehearsal') === '1';
  } catch {
    return false;
  }
}
