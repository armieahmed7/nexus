/**
 * FS79 (future skills, wave I · E1, module M34): verified import of external certificates. Pure and import-free (seed builder, PGlite
 * validator, both backends and, through trustTier(), the M17 wallet / learner record / credential views wired by the integration lead).
 *
 *   entry     kafaa_external_certs: the person enters certificate metadata (title, issuer, issuer kind, accreditation reference,
 *             credential reference, dates) and an https verification URL, and names the crosswalk entries (FS08 skill_alignments)
 *             the certificate covers. Status `submitted` until a verifier (recognition A, never the holder) verifies, rejects or later
 *             revokes it.
 *   tiers     trustTier(): ENEC-assessed (issuer ENEC, verified through an ENEC assessment), accredited third party (university or
 *             professional body with an accreditation reference) or vendor self-serve (vendors, online platforms, anything without an
 *             accreditation reference). An unverified certificate is shown as "claimed", whatever its issuer.
 *   evidence  Only a verified certificate writes F01 evidence (kind `credential`, ref_table `external_certs`, recorded): basis by tier
 *             (ENEC-assessed evidenced, accredited validated, vendor validated) and level capped by tier (3, 2, 1). Unverified,
 *             rejected, withdrawn and revoked certificates write nothing above "claimed" (in fact nothing at all; revoking makes the
 *             rows inactive). Skills come ONLY from reviewed crosswalk rows (published, with a second-person review): certMapping().
 *
 * SQL mirror (supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql): kafaa_xc_issuer_tier = issuerTier,
 * kafaa_xc_trust_tier = trustTier, kafaa_xc_map = certMapping, kafaa_xc_check_submit = checkSubmit, kafaa_xc_check_verify = checkVerify,
 * kafaa_xc_message = XC_MSG.
 */
export const ISSUER_KINDS = ['enec', 'university', 'professional_body', 'vendor', 'online_platform'] as const;
export type IssuerKind = (typeof ISSUER_KINDS)[number];
export const TIERS = ['enec_assessed', 'accredited', 'vendor_self_serve'] as const;
export type Tier = (typeof TIERS)[number];
export type TrustTier = Tier | 'claimed';
export const METHODS = ['issuer_url', 'issuer_registry', 'enec_assessment', 'document_check'] as const;
export const CERT_STATUSES = ['submitted', 'verified', 'rejected', 'withdrawn', 'revoked'] as const;
export const VERIFY_DECISIONS = ['verify', 'reject', 'revoke'] as const;
/** F01 basis and level cap of the evidence a verified certificate writes, by tier. */
export const TIER_BASIS: Record<Tier, 'evidenced' | 'validated'> = { enec_assessed: 'evidenced', accredited: 'validated', vendor_self_serve: 'validated' };
export const TIER_CAP: Record<Tier, number> = { enec_assessed: 3, accredited: 2, vendor_self_serve: 1 };
export const TIER_RANK: Record<TrustTier, number> = { enec_assessed: 3, accredited: 2, vendor_self_serve: 1, claimed: 0 };
export const MAX_ALIGNMENTS = 6;
export const certEvidenceId = (cert: string, skill: string) => `se:xc:${cert}:${skill}`;

const s = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const isInt = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.trunc(v) === v;
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/;

export interface CertLite {
  id: string; person_id: string; issuer_kind: string; accreditation_ref?: string | null; status: string; tier?: string | null;
  alignment_ids?: string[] | null; levels?: Record<string, unknown> | null; expires_on?: string | null; verified_on?: string | null;
}
/** The tier an issuer earns once verified (no verification in it). */
export function issuerTier(c: { issuer_kind: string; accreditation_ref?: string | null }): Tier {
  if (c.issuer_kind === 'enec') return 'enec_assessed';
  if ((c.issuer_kind === 'university' || c.issuer_kind === 'professional_body') && s(c.accreditation_ref).length > 0) return 'accredited';
  return 'vendor_self_serve';
}
/** The trust tier shown wherever the credential appears: the verified tier, or "claimed" for anything not verified. */
export function trustTier(c: CertLite): TrustTier {
  if (c.status !== 'verified') return 'claimed';
  return (TIERS as readonly string[]).includes(String(c.tier)) ? (c.tier as Tier) : issuerTier(c);
}
/** Highest evidence basis a certificate in this state may carry (unverified: "claimed" at most). */
export const maxBasisOf = (c: CertLite): 'evidenced' | 'validated' | 'claimed' => { const t = trustTier(c); return t === 'claimed' ? 'claimed' : TIER_BASIS[t]; };

// ───────────── Crosswalk mapping (SQL kafaa_xc_map): reviewed rows only
export interface AlignmentLite { id: string; skill_id: string; framework: string; label_en: string; label_ar: string; status: string; reviewed_by?: string | null; reviewed_on?: string | null; match_type?: string | null }
export interface SkillLite { id: string; area?: string | null; fs_area?: string | null; lifecycle?: string | null }
export type MapState = 'maps' | 'unreviewed' | 'retired' | 'missing' | 'restricted';
export interface MapRow { alignment_id: string; skill_id: string | null; framework: string | null; label_en: string; label_ar: string; state: MapState; level: number }
export interface Mapping { rows: MapRow[]; skills: { skill_id: string; level: number; alignment_ids: string[] }[] }
export const reviewed = (a: AlignmentLite | undefined | null) => !!a && a.status === 'published' && !!a.reviewed_by && !!a.reviewed_on;
const claimedLevel = (levels: Record<string, unknown> | null | undefined, id: string) => {
  const v = levels && typeof levels === 'object' ? levels[id] : undefined;
  return isInt(v) && (v as number) >= 1 && (v as number) <= 3 ? (v as number) : 1;
};
export function certMapping(c: { alignment_ids?: string[] | null; levels?: Record<string, unknown> | null }, tier: Tier, alignments: Map<string, AlignmentLite>, skills: Map<string, SkillLite>): Mapping {
  const ids = [...new Set((c.alignment_ids ?? []).filter((x) => typeof x === 'string'))].sort(cmp);
  const rows: MapRow[] = ids.map((id) => {
    const a = alignments.get(id);
    if (!a) return { alignment_id: id, skill_id: null, framework: null, label_en: '', label_ar: '', state: 'missing', level: 0 };
    const sk = skills.get(a.skill_id);
    const state: MapState = !sk || sk.area === 'security' ? 'restricted' : a.status === 'retired' ? 'retired' : reviewed(a) ? 'maps' : 'unreviewed';
    return { alignment_id: id, skill_id: a.skill_id, framework: a.framework, label_en: a.label_en, label_ar: a.label_ar, state, level: state === 'maps' ? Math.min(claimedLevel(c.levels, id), TIER_CAP[tier]) : 0 };
  });
  const by = new Map<string, { skill_id: string; level: number; alignment_ids: string[] }>();
  for (const r of rows) {
    if (r.state !== 'maps' || !r.skill_id) continue;
    const x = by.get(r.skill_id) ?? { skill_id: r.skill_id, level: 0, alignment_ids: [] };
    x.level = Math.max(x.level, r.level);
    x.alignment_ids.push(r.alignment_id);
    by.set(r.skill_id, x);
  }
  return { rows, skills: [...by.values()].sort((a, b) => cmp(a.skill_id, b.skill_id)) };
}
/** The F01 evidence rows a verified certificate writes (none for any other state). */
export function certEvidence(c: CertLite, m: Mapping, on: string, by: string) {
  const t = trustTier(c);
  if (t === 'claimed') return [];
  return m.skills.map((k) => ({
    id: certEvidenceId(c.id, k.skill_id), person_id: c.person_id, skill_id: k.skill_id, kind: 'credential' as const, ref_table: 'external_certs', ref_id: c.id, level: k.level,
    basis: TIER_BASIS[t], status: 'current' as const, observed_on: on, note: `External certificate (${t})`, recorded_by: by, active: true,
  }));
}

// ───────────── Submit (SQL kafaa_xc_check_submit)
export interface SubmitInput {
  title?: unknown; issuer?: unknown; issuer_kind?: unknown; accreditation_ref?: unknown; credential_ref?: unknown; issued_on?: unknown; expires_on?: unknown;
  verification_url?: unknown; alignment_ids?: unknown; levels?: unknown; resource_id?: unknown; note?: unknown;
}
export interface SubmitCtx { today: string; alignments: Map<string, AlignmentLite>; skills: Map<string, SkillLite>; duplicate: boolean }
export type SubmitCode = 'ok' | 'title' | 'issuer' | 'issuer_kind' | 'accreditation' | 'credential_ref' | 'dates' | 'url' | 'alignments' | 'levels' | 'note' | 'security_restricted' | 'conflict';
const lenIn = (v: unknown, lo: number, hi: number) => { const x = s(v); return x.length >= lo && x.length <= hi; };
const optLen = (v: unknown, hi: number) => v == null || (typeof v === 'string' && s(v).length <= hi);
export function checkSubmit(input: SubmitInput, ctx: SubmitCtx): SubmitCode {
  if (!lenIn(input.title, 3, 160)) return 'title';
  if (!lenIn(input.issuer, 2, 120)) return 'issuer';
  if (!(ISSUER_KINDS as readonly string[]).includes(s(input.issuer_kind))) return 'issuer_kind';
  if (!optLen(input.accreditation_ref, 80)) return 'accreditation';
  if (!lenIn(input.credential_ref, 1, 80)) return 'credential_ref';
  if (!isDate(input.issued_on) || (input.issued_on as string) > ctx.today || !(input.expires_on == null || input.expires_on === '' || (isDate(input.expires_on) && (input.expires_on as string) > (input.issued_on as string)))) return 'dates';
  if (typeof input.verification_url !== 'string' || !HTTPS_URL.test(s(input.verification_url)) || s(input.verification_url).length > 300) return 'url';
  const al = input.alignment_ids;
  if (!Array.isArray(al) || al.length < 1 || al.length > MAX_ALIGNMENTS || al.some((x) => typeof x !== 'string') || new Set(al).size !== al.length) return 'alignments';
  if (al.some((x) => { const a = ctx.alignments.get(x as string); return !a || a.status === 'retired'; })) return 'alignments';
  const lv = input.levels;
  if (lv != null && (typeof lv !== 'object' || Array.isArray(lv) || Object.entries(lv as Record<string, unknown>).some(([k, v]) => !al.includes(k) || !isInt(v) || (v as number) < 1 || (v as number) > 3))) return 'levels';
  if (!optLen(input.note, 300)) return 'note';
  if (al.some((x) => ctx.skills.get(ctx.alignments.get(x as string)!.skill_id)?.area === 'security')) return 'security_restricted';
  if (ctx.duplicate) return 'conflict';
  return 'ok';
}

// ───────────── Verify (SQL kafaa_xc_check_verify): a verifier who is not the holder
export interface VerifyInput { id?: unknown; decision?: unknown; method?: unknown; note?: unknown }
export type VerifyCode = 'ok' | 'invalid' | 'self' | 'state' | 'method' | 'method_tier' | 'expired' | 'note';
export function checkVerify(input: VerifyInput, c: CertLite, me: string, today: string): VerifyCode {
  const d = s(input.decision);
  if (!(VERIFY_DECISIONS as readonly string[]).includes(d)) return 'invalid';
  if (c.person_id === me) return 'self';
  if (d === 'revoke' ? c.status !== 'verified' : c.status !== 'submitted') return 'state';
  if (d === 'verify') {
    if (!(METHODS as readonly string[]).includes(s(input.method))) return 'method';
    if ((issuerTier(c) === 'enec_assessed') !== (s(input.method) === 'enec_assessment')) return 'method_tier';
    if (d10(c.expires_on) != null && (d10(c.expires_on) as string) < today) return 'expired';
    return 'ok';
  }
  if (s(input.note).length < 5) return 'note';
  return 'ok';
}
export function checkWithdrawCert(c: CertLite, me: string): 'ok' | 'forbidden' | 'state' {
  if (c.person_id !== me) return 'forbidden';
  return c.status === 'submitted' ? 'ok' : 'state';
}

export const XC_MSG: Record<string, string> = {
  not_signed_in: 'Sign in to add an external certificate',
  forbidden_submit: 'You add and withdraw only your own certificates',
  forbidden_verify: 'Only verifiers (assessors and the HR authority) verify external certificates',
  title: 'Give the certificate title (3 to 160 characters)',
  issuer: 'Give the issuer (2 to 120 characters)',
  issuer_kind: 'Choose the kind of issuer: ENEC, a university, a professional body, a vendor or an online platform',
  accreditation: 'The accreditation reference is at most 80 characters',
  credential_ref: 'Give the certificate or credential number (1 to 80 characters)',
  dates: 'Give an issue date up to today and, if it expires, an expiry date after it',
  url: 'Give an https verification link from the issuer (at most 300 characters)',
  alignments: 'Name 1 to 6 different crosswalk entries the certificate covers (published or under review, not retired)',
  levels: 'Claimed levels are whole numbers from 1 to 3 for the entries you named',
  note: 'The note is at most 300 characters',
  security_restricted: 'Security-area skills are recorded as qualified or not qualified only, never from external certificates',
  conflict: 'This certificate (same verification link) is already in your record',
  invalid: 'Unknown decision',
  self: 'You cannot verify your own certificate',
  state: 'This certificate is not in a state for that decision',
  method: 'Choose how it was verified: issuer link, issuer registry, ENEC assessment or document check',
  method_tier: 'An ENEC-issued certificate is verified through an ENEC assessment, and only ENEC certificates are',
  expired: 'An expired certificate cannot be verified',
  reason: 'Give a reason of at least 5 characters',
  not_found: 'Certificate not found',
  w_forbidden: 'Only the holder withdraws a certificate',
  w_state: 'Only a certificate waiting for verification can be withdrawn',
};
export const xcResultCode = (c: string): string =>
  ({ self: 'maker_checker', security_restricted: 'security_restricted', conflict: 'conflict', not_found: 'not_found', w_forbidden: 'forbidden' } as Record<string, string>)[c] ?? 'invalid';
export const xcMsgKey = (c: string) => (c === 'note' ? 'reason' : c);

// ───────────── Explanations (<WhyThis>)
export interface Reason { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }> }
export function tierReasons(c: CertLite & { verified_on?: string | null; method?: string | null }): Reason[] {
  const t = trustTier(c);
  const it = issuerTier(c);
  const out: Reason[] = [{ code: `issuer_${c.issuer_kind}`, key: `m34.xc.why.issuer.${c.issuer_kind}` }];
  if (c.issuer_kind === 'university' || c.issuer_kind === 'professional_body') out.push({ code: s(c.accreditation_ref) ? 'accredited' : 'no_accreditation', key: s(c.accreditation_ref) ? 'm34.xc.why.accredited' : 'm34.xc.why.noAccreditation' });
  out.push(t === 'claimed'
    ? { code: 'claimed', key: `m34.xc.why.claimed.${it}` }
    : { code: 'verified', key: `m34.xc.why.verified.${(METHODS as readonly string[]).includes(String(c.method)) ? c.method : 'issuer_url'}`, vars: { date: String(d10(c.verified_on) ?? '') } });
  out.push({ code: 'cap', key: t === 'claimed' ? 'm34.xc.why.noEvidence' : 'm34.xc.why.cap', vars: { l: t === 'claimed' ? 0 : TIER_CAP[t] } });
  return out;
}
