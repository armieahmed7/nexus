/** M12 contact routing and the insert rule of kafaa_contact_requests. Import-free: scripts/validate/audit-fixes.mjs loads it under Node. */
export const CONTACT_ROUTES: Record<string, string> = {
  careers: 'Careers team (role mailbox)',
  programmes: 'Talent programmes team (role mailbox)',
  suppliers: 'Supplier development (role mailbox)',
  universities: 'University partnerships (role mailbox)',
  media: 'Media relations (role mailbox)',
  accessibility: 'Digital accessibility (role mailbox)',
  other: 'General enquiries (role mailbox)',
};
export const CONTACT_LIMITS = { id: 64, message: 4000, name: 200, email: 320, retentionDays: 400 } as const;
/** What a new contact request may hold (the insert check of kafaa_contact_requests, 20261012154001_kafaa_audit_contact_requests.sql):
 *  status new or routed, the role mailbox of its topic, bounded text and retention. Returns the first problem, or null. */
export function contactRequestProblems(r: Record<string, unknown>, today: string): string | null {
  const len = (v: unknown) => (v == null ? 0 : String(v).length);
  const status = r.status ?? 'new';
  if (status !== 'new' && status !== 'routed') return 'a new request is new or routed';
  if (r.route_to !== CONTACT_ROUTES[String(r.topic)]) return 'route_to must be the role mailbox of the topic';
  if (len(r.id) > CONTACT_LIMITS.id) return 'id too long';
  if (len(r.message) < 1 || len(r.message) > CONTACT_LIMITS.message) return `message must be 1-${CONTACT_LIMITS.message} characters`;
  if (len(r.name) > CONTACT_LIMITS.name) return `name at most ${CONTACT_LIMITS.name} characters`;
  if (len(r.email) > CONTACT_LIMITS.email) return `email at most ${CONTACT_LIMITS.email} characters`;
  if (r.retention_until != null) {
    const max = new Date(`${today}T00:00:00Z`);
    max.setUTCDate(max.getUTCDate() + CONTACT_LIMITS.retentionDays);
    if (String(r.retention_until) > max.toISOString().slice(0, 10)) return `retention at most ${CONTACT_LIMITS.retentionDays} days`;
  }
  return null;
}
