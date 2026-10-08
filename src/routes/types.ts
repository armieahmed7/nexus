import type { ComponentType, LazyExoticComponent } from 'react';
import type { Level, PlatformRole, Resource } from '../auth/policy';

/**
 * Route guard. Deny by default for anything that is not explicitly public.
 *  {}                                   public (no sign-in)
 *  { signedIn: true }                   any signed-in persona
 *  { anyRole: ['manager'] }             signed in and holds one of the roles
 *  { grant: { res, levels } }           signed in and holds one of the levels on the resource (policy matrix)
 * anyRole and grant combine with OR. Pages must still check row-level rights through the repository.
 */
export interface Guard {
  signedIn?: boolean;
  anyRole?: PlatformRole[];
  grant?: { res: Resource; levels: Level[] };
  /** Never send analytics or audit events from this route (M08 speak-up). */
  noTelemetry?: boolean;
}

export type Lens = 'public' | 'my' | 'partner' | 'admin';
export type ModuleId = 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08' | 'M09' | 'M10' | 'M11' | 'M12' | 'M13' | 'M14' | 'M15' | 'M16';
export type Group = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'F';

export interface RouteDef {
  /** Stable id, also the i18n key: `<module>.routes.<id>.title` / `.purpose` */
  id: string;
  /** Path without the /kafaa basename and without the /ar prefix (both are added automatically). */
  path: string;
  module: ModuleId;
  zone: 'public' | 'staff' | 'partner' | 'admin';
  guard: Guard;
  /** Navigation placement; omit for detail pages. */
  nav?: { lens: Lens; section: string; order: number };
  /** Breadcrumb parent route id. */
  parent?: string;
  /** Spec reference (Section 5 route table / module key screens). */
  spec: string;
  component: LazyExoticComponent<ComponentType>;
}
