// M32 RPC signatures (owners: wave E E2 (FS41, FS42, FS43)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// FS41 SQL: supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql. FS42/FS43 need no RPC of their own: the pages read the
// M32 reference rows and use M19's pathwayDetail / startPathway and M17's microcredEligibility.
import type { CecProfile, CecStats } from '../cec';

export interface M32Rpc {
  /** FS41: my CleanEnergyComp profile: level per competence from my counted F01 skill states, the overall level (lowest area), my family
   *  target, reasons and what to grow next (skills_profile Own; read-only, never audited). Null without Own. */
  cecMine(): Promise<CecProfile | null>;
  /** FS41: share of staff at CleanEnergyComp L1+ and at their family target, by level, area and family (skills_profile Agg; every cell
   *  under 10 suppressed; security, safeguards and cyber never broken out; no person ids). Null without Agg. */
  cecStats(): Promise<CecStats | null>;
}
