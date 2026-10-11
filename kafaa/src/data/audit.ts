/** Append-only audit chain: same canonical form and hash as kafaa_audit_canonical / kafaa_audit in SQL. */
export interface AuditFields {
  seq: number;
  ts: string; // ISO, seconds precision, UTC "Z"
  actor_person_id: string | null;
  actor_role: string | null;
  action: string;
  entity_table: string | null;
  entity_id: string | null;
  outcome: 'ok' | 'refused' | 'error';
  reason: string | null;
}

export function canonical(e: AuditFields): string {
  return [e.seq, e.ts.replace(/\.\d{3}Z$/, 'Z'), e.actor_person_id ?? '', e.actor_role ?? '', e.action, e.entity_table ?? '', e.entity_id ?? '', e.outcome, e.reason ?? ''].join('|');
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function chainHash(prevHash: string, e: AuditFields): Promise<string> {
  return sha256Hex(prevHash + canonical(e));
}

export const GENESIS = '0'.repeat(64);

/** Seconds-precision UTC timestamp, matching date_trunc('second', now()) in SQL. */
export function nowTs(): string {
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** NEXUS ledger canonical (nexus_ledger_canonical) used by the local ledger mirror. */
export function ledgerCanonical(e: { seq: number; ts: string; actor: string; role: string; plane: string; domain: string; action: string; evidence_class: string; reason: string | null; case_id: string | null; agent_id: string | null }): string {
  return JSON.stringify({ seq: e.seq, ts: e.ts, actor: e.actor, role: e.role, plane: e.plane, domain: e.domain, action: e.action, evidence_class: e.evidence_class, reason: e.reason, case_id: e.case_id, agent_id: e.agent_id });
}
