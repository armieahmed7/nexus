// M06 extension RPC signatures (owner: W5 · E3, F34 Student-to-career journey). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
// SQL: supabase/migrations/20261009153001_kafaa_w5e3_journey.sql. Rules: src/modules/m06/journey.ts.
import type { Result } from '../../../data/types';
import type { JourneyAggregate, SaveJourneyInput } from '../journey';

export interface SaveJourneyResult {
  id: string;
  families: string[];
  route: string | null;
  cleared: boolean;
}

export interface M06Rpc {
  /**
   * F34: saves (or clears, with `clear: true`) the signed-in student's journey: life stage, chosen route, explorer answers and the
   * readiness checklist. The server recomputes the families from the answers (never trusts the client). Own row only, holders of
   * applications Own (applicants and staff); audited, no ledger. Anonymous visitors never call it: the explorer stores nothing.
   * Refusals: not_signed_in, forbidden, invalid.
   */
  saveStudentJourney(input: SaveJourneyInput): Promise<Result<SaveJourneyResult>>;
  /**
   * F34 HR view: aggregate counts only (journeys, stages, routes, interest families, journey-to-application, starter credentials);
   * every cell under 10 is null and flagged suppressed. applications Agg, A or R. Refusals (audited): not_signed_in, forbidden.
   */
  journeyAggregate(): Promise<Result<JourneyAggregate>>;
  /**
   * F34: issues the synthetic Mustaqbali starter credential to every accepted Mustaqbali participant who has none yet (portfolio row
   * + notice). HR director (applications A). Audited with a ledger row. Refusals: not_signed_in, forbidden, not_found (nobody waiting).
   */
  issueStarterCredentials(): Promise<Result<{ issued: number }>>;
}
