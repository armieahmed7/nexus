/**
 * FS32 Learner record (CLR-shaped) with selective disclosure (FS wave D · E3, module M17): pure rules shared by the pages, the
 * LocalBackend (backend/local.fs4.ts), the seed builder and, line for line, the SQL in
 * supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql (kafaa_lr_*). Import-free apart from the F04 issuer and
 * the F04/F32 status rules, so node scripts load it directly.
 *
 *   items         what a person can put in a record: micro-credential awards (active or renewal due), F04 badges (active),
 *                 verified FS79 external certificates (not expired; the status is the trust tier, wave I integration),
 *                 qualification mirror lines (qualified / not qualified only) and skills with their provenance badge. Never a
 *                 security standard, a security skill, a medical flag or a date that is not on a public credential.
 *   bundle        a 1EdTech CLR 2.0-shaped ClrCredential: the signed Open Badges 3.0 credentials as they were issued, plus a Kafa'a
 *                 record statement (an AchievementCredential) for each qualification mirror line and skill, and isPartOf / isParentOf
 *                 associations between a stacked credential and its shared components. Holder initials only, never a name.
 *   share         three consent gates (I chose the items; I reviewed what the recipient sees; I agree to share until the date), an
 *                 expiry of 1 to 90 days and revocation at any time. The public verify page shows only the shared items while the link
 *                 is active; an expired or revoked link shows nothing personal.
 */
import { CONTEXTS, ISSUER_ID, ISSUER_NAME, ISSUER_URL } from './issuer.ts';
import { awardView } from './microcred.ts';
import { trustTier } from '../m34/extcerts.ts'; // FS79 -> FS32 (wave I integration): the trust tier of a verified external certificate

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const d10 = (v: unknown): string | null => (v == null || v === '' ? null : String(v).slice(0, 10));

export const CLR_CONTEXT = 'https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json';
export const VC_CONTEXT = CONTEXTS[0];
export const OB_CONTEXT = CONTEXTS[1];
export const RECORD_NOTICE_EN = "Kafa'a learner record (internal recognition). Qualification lines mirror the licensee's systems as qualified or not qualified only; Kafa'a is not an authority and nothing here is a FANR certificate or licence.";
export const ITEM_KINDS = ['mc', 'badge', 'xcert', 'qual', 'skill'] as const; // xcert: FS79 verified external certificate (wave I integration)
export type ItemKind = (typeof ITEM_KINDS)[number];
const KIND_ORDER: Record<string, number> = { mc: 1, badge: 2, xcert: 3, qual: 4, skill: 5 };
/** English trust-tier names used inside a shared record statement (the pages show the localised TrustTierBadge). Same text in SQL. */
export const XCERT_TIER_EN: Record<string, string> = { enec_assessed: 'ENEC-assessed', accredited: 'accredited third party', vendor_self_serve: 'vendor self-serve' };
export const SHARE_RULES = { maxItems: 30, minDays: 1, maxDays: 90, labelMin: 3, labelMax: 80, maxActive: 10, verifyPerTokenPerMin: 20, verifyPerMin: 600, reasonMax: 300 } as const;

/** Refusal and result messages: identical in SQL. */
export const LR_MSG = {
  not_signed_in: 'Sign in to share your learner record',
  forbidden: 'Only staff with a skills passport can share a learner record',
  invalid: 'Choose 1 to 30 items, a label of 3 to 80 characters and an expiry between 1 and 90 days from today',
  consent_required: 'Confirm all three consent steps before the link is created',
  not_shareable: 'Some items are not yours or cannot be shared (security and medical details never are)',
  too_many: 'You can keep up to 10 active share links: revoke one first',
  created: 'Share link created',
  not_found: 'Share link not found',
  already_closed: 'This link is already revoked or expired',
  revoked: 'Share link revoked',
  rate_limited: 'Too many verification requests: try again in a minute',
  verify_not_found: 'No Kafa\'a learner record has this link',
  found: 'Learner record found',
  closed: 'This link is no longer active',
} as const;

export interface RecordWorld {
  today: string;
  person: string;
  initials: string;
  microcred_awards: Row[];
  microcred_defs: Row[];
  badges: Row[];
  certificates: Row[];
  qual_records: Row[];
  qual_standards: Row[];
  person_skills: Row[];
  skills: Row[];
  competencies: Row[];
  /** FS79 (wave I integration): external certificates; only the person's verified, unexpired ones become record items. */
  external_certs?: Row[];
}
export interface RecordItem {
  ref: string; kind: ItemKind; id: string; code: string; title_en: string; title_ar: string;
  /** mc/badge: active | renewal_due; xcert: the trust tier (enec_assessed | accredited | vendor_self_serve); qual: qualified | not_qualified; skill: the provenance basis. */
  status: string;
  level: number | null;
  band: string | null;
  date: string | null;
}

// ───────────── what can be shared (security and medical never)
const secComps = (w: Pick<RecordWorld, 'competencies'>) => new Set(w.competencies.filter((c) => c.domain === 'security').map((c) => String(c.id)));
export const isSecuritySkillRow = (s: Row, sec: Set<string>) => !s || s.area === 'security' || sec.has(String(s.competency_id));
/** F04 badge status (same as kafaa_badge_status, with an explicit day). */
export function badgeStatus(b: Row, today: string, certificates: Row[]): 'active' | 'expired' | 'revoked' {
  if (b.status === 'revoked') return 'revoked';
  const cert = b.source_table === 'certificates' ? certificates.find((c) => c.id === b.source_id) : undefined;
  if (cert?.status === 'revoked') return 'revoked';
  if (cert && (cert.status === 'expired' || (cert.valid_to && String(cert.valid_to).slice(0, 10) < today))) return 'expired';
  if (b.valid_to && String(b.valid_to).slice(0, 10) < today) return 'expired';
  return 'active';
}
/** Mirror status of a qualification record: qualified (qualified or due, not past its expiry) or not qualified. */
export const qualMirror = (r: Row, today: string) => ((r.status === 'qualified' || r.status === 'due') && (!r.expires_on || String(r.expires_on).slice(0, 10) >= today) ? 'qualified' : 'not_qualified');

/** Everything `person` may put in a record today, in record order (kind, then reference). Same as kafaa_lr_items(person, today). */
export function recordItems(w: RecordWorld): RecordItem[] {
  const out: RecordItem[] = [];
  const sec = secComps(w);
  const defs = new Map(w.microcred_defs.map((d) => [d.id, d]));
  for (const a of w.microcred_awards) {
    if (a.person_id !== w.person || a.status !== 'awarded') continue;
    const v = awardView(a, w.today, w.microcred_awards).status;
    if (v !== 'active' && v !== 'renewal_due') continue;
    const d = defs.get(a.def_id);
    out.push({ ref: `mc:${a.id}`, kind: 'mc', id: a.id, code: a.def_code, title_en: d?.title_en ?? a.def_code, title_ar: d?.title_ar ?? a.def_code, status: v, level: null, band: null, date: d10(a.issued_on) });
  }
  for (const b of w.badges) {
    if (b.person_id !== w.person || badgeStatus(b, w.today, w.certificates) !== 'active') continue;
    const ach = b.achievement ?? {};
    out.push({ ref: `badge:${b.id}`, kind: 'badge', id: b.id, code: String(ach.code ?? ''), title_en: String(ach.name_en ?? ''), title_ar: String(ach.name_ar ?? ''), status: 'active', level: null, band: null, date: d10(b.issued_on) });
  }
  for (const c of w.external_certs ?? []) { // FS79 -> FS32 (wave I integration) = the xcert branch of kafaa_lr_items
    if (c.person_id !== w.person || c.status !== 'verified' || (c.expires_on && String(c.expires_on).slice(0, 10) < w.today)) continue;
    out.push({ ref: `xcert:${c.id}`, kind: 'xcert', id: c.id, code: String(c.credential_ref ?? ''), title_en: String(c.title ?? ''), title_ar: String(c.title ?? ''), status: trustTier(c), level: null, band: null, date: d10(c.issued_on) });
  }
  const stds = new Map(w.qual_standards.map((s) => [s.id, s]));
  for (const r of w.qual_records) {
    const s = stds.get(r.standard_id);
    if (r.person_id !== w.person || !s || s.security_restricted || r.security_mirror_only) continue;
    out.push({ ref: `qual:${r.id}`, kind: 'qual', id: r.id, code: String(s.code ?? ''), title_en: s.title_en, title_ar: s.title_ar, status: qualMirror(r, w.today), level: null, band: null, date: null });
  }
  const skills = new Map(w.skills.map((s) => [s.id, s]));
  for (const p of w.person_skills) {
    if (p.person_id !== w.person || p.active !== true || !(Number(p.level) >= 1)) continue;
    const s = skills.get(p.skill_id);
    if (!s || isSecuritySkillRow(s, sec)) continue;
    out.push({ ref: `skill:${s.id}`, kind: 'skill', id: s.id, code: String(s.code ?? ''), title_en: s.name_en, title_ar: s.name_ar, status: String(p.basis), level: Number(p.level), band: p.confidence_band ?? null, date: null });
  }
  return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || cmp(a.ref, b.ref));
}

// ───────────── the CLR-shaped bundle
export interface BundleMeta { id: string; issued_on: string; valid_until: string | null }
const issuer = () => ({ id: ISSUER_ID, type: ['Profile'], name: ISSUER_NAME, url: ISSUER_URL });
/** A Kafa'a record statement (unsigned AchievementCredential) for one mirror line, skill or verified external certificate. */
function statement(meta: BundleMeta, initials: string, it: RecordItem, cert?: Row): Row {
  if (it.kind === 'xcert') return xcertStatement(meta, initials, it, cert);
  const qual = it.kind === 'qual';
  return {
    '@context': [VC_CONTEXT, OB_CONTEXT],
    id: `urn:kafaa:clr:${meta.id}:${it.kind}:${it.id}`,
    type: ['VerifiableCredential', 'AchievementCredential'],
    name: it.title_en,
    issuer: issuer(),
    validFrom: `${meta.issued_on}T00:00:00Z`,
    credentialSubject: {
      type: ['AchievementSubject'],
      holderInitials: initials,
      achievement: {
        id: qual ? `urn:kafaa:qualification-mirror:${it.code}` : `urn:kafaa:skill:${it.id}`,
        type: ['Achievement'],
        achievementType: qual ? 'ext:QualificationMirror' : 'Competency',
        humanCode: it.code,
        name: it.title_en,
        nameAr: it.title_ar,
        criteria: { narrative: qual ? "Mirrored from the licensee's system of record as qualified or not qualified only; Kafa'a is not an authority." : `Skill state in the Kafa'a skills catalogue: level ${it.level} of 4, ${it.status} (provenance).` },
      },
      ...(qual ? { kafaaStatus: it.status } : { kafaaLevel: it.level, kafaaProvenance: it.status, kafaaConfidenceBand: it.band }),
    },
  };
}
/** FS79 -> FS32 (wave I integration): the record statement for a verified external certificate, with its trust tier (= kafaa_lr_bundle). */
function xcertStatement(meta: BundleMeta, initials: string, it: RecordItem, cert?: Row): Row {
  const issuerName = String(cert?.issuer ?? '');
  return {
    '@context': [VC_CONTEXT, OB_CONTEXT],
    id: `urn:kafaa:clr:${meta.id}:${it.kind}:${it.id}`,
    type: ['VerifiableCredential', 'AchievementCredential'],
    name: it.title_en,
    issuer: issuer(),
    validFrom: `${meta.issued_on}T00:00:00Z`,
    credentialSubject: {
      type: ['AchievementSubject'],
      holderInitials: initials,
      achievement: {
        id: `urn:kafaa:external-certificate:${it.id}`,
        type: ['Achievement'],
        achievementType: 'Certificate',
        humanCode: it.code,
        name: it.title_en,
        nameAr: it.title_ar,
        criteria: { narrative: `External certificate issued by ${issuerName}, verified for Kafa'a with the issuer (trust tier: ${XCERT_TIER_EN[it.status] ?? it.status}). Kafa'a is not the issuer and not an authority.` },
      },
      kafaaTrustTier: it.status,
      kafaaIssuer: issuerName,
    },
  };
}

/**
 * The CLR 2.0-shaped ClrCredential for the chosen items (only those still shareable today, in record order). Signed credentials are
 * embedded exactly as issued. Same as kafaa_lr_bundle(person, refs, today, id, valid_until).
 */
export function buildBundle(w: RecordWorld, refs: string[], meta: BundleMeta): Row {
  const want = new Set(refs);
  const items = recordItems(w).filter((i) => want.has(i.ref));
  const vcs: Row[] = [];
  const awards = new Map(w.microcred_awards.map((a) => [a.id, a]));
  const badges = new Map(w.badges.map((b) => [b.id, b]));
  const certs = new Map((w.external_certs ?? []).map((c) => [c.id, c]));
  for (const it of items) {
    if (it.kind === 'mc') vcs.push(awards.get(it.id)?.credential ?? {});
    else if (it.kind === 'badge') vcs.push(badges.get(it.id)?.credential ?? {});
    else vcs.push(statement(meta, w.initials, it, certs.get(it.id)));
  }
  // stacked credential -> shared component (both shared): isParentOf
  const assoc: Row[] = [];
  const shared = new Set(items.filter((i) => i.kind === 'mc').map((i) => i.id));
  for (const it of items) {
    if (it.kind !== 'mc') continue;
    const a = awards.get(it.id);
    for (const cid of [...(a?.component_award_ids ?? [])].sort(cmp)) {
      if (!shared.has(cid)) continue;
      assoc.push({ type: 'Association', associationType: 'isParentOf', sourceId: `urn:kafaa:badge:${a.public_slug}`, targetId: `urn:kafaa:badge:${awards.get(cid)?.public_slug}` });
    }
  }
  const bundle: Row = {
    '@context': [VC_CONTEXT, CLR_CONTEXT, OB_CONTEXT],
    id: `urn:kafaa:clr:${meta.id}`,
    type: ['VerifiableCredential', 'ClrCredential'],
    name: "Kafa'a learner record",
    nameAr: 'سجل المتعلم من كفاءة',
    issuer: issuer(),
    validFrom: `${meta.issued_on}T00:00:00Z`,
    credentialSubject: {
      type: ['ClrSubject'],
      holderInitials: w.initials,
      verifiableCredential: vcs,
      ...(assoc.length ? { association: assoc } : {}),
    },
    kafaaItems: items.map((i) => ({ ref: i.ref, kind: i.kind, code: i.code, title_en: i.title_en, title_ar: i.title_ar, status: i.status, level: i.level, band: i.band, date: i.date })),
    kafaaNotice: RECORD_NOTICE_EN,
  };
  if (meta.valid_until) bundle.validUntil = `${meta.valid_until}T00:00:00Z`;
  return bundle;
}

// ───────────── CLR 2.0-shaped schema (a JSON Schema subset: type, required, properties, items, minItems, contains, enum, pattern)
export interface Schema { type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'; required?: string[]; properties?: Record<string, Schema>; items?: Schema; minItems?: number; contains?: string[]; enum?: unknown[]; pattern?: string; anyOf?: Schema[] }
const DATE_TIME = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$';
const PROFILE: Schema = { type: 'object', required: ['id', 'type'], properties: { id: { type: 'string', pattern: '^(urn:|https?:)' }, type: { type: 'array', contains: ['Profile'] }, name: { type: 'string' } } };
const ACHIEVEMENT: Schema = {
  type: 'object', required: ['id', 'type', 'name', 'criteria'],
  properties: { id: { type: 'string', pattern: '^(urn:|https?:)' }, type: { type: 'array', contains: ['Achievement'] }, name: { type: 'string' }, criteria: { type: 'object', required: ['narrative'] }, achievementType: { type: 'string' } },
};
const VC: Schema = {
  type: 'object', required: ['@context', 'id', 'type', 'issuer', 'validFrom', 'credentialSubject'],
  properties: {
    '@context': { type: 'array', minItems: 2, contains: [VC_CONTEXT] },
    id: { type: 'string', pattern: '^(urn:|https?:)' },
    type: { type: 'array', contains: ['VerifiableCredential'], anyOf: [{ contains: ['OpenBadgeCredential'] }, { contains: ['AchievementCredential'] }] },
    issuer: PROFILE,
    validFrom: { type: 'string', pattern: DATE_TIME },
    validUntil: { type: 'string', pattern: DATE_TIME },
    credentialSubject: { type: 'object', required: ['type', 'achievement'], properties: { type: { type: 'array', contains: ['AchievementSubject'] }, achievement: ACHIEVEMENT } },
  },
};
/** The CLR 2.0 ClrCredential shape Kafa'a promises (1EdTech CLR Standard 2.0: ClrCredential / ClrSubject / Association). */
export const CLR_SCHEMA: Schema = {
  type: 'object', required: ['@context', 'id', 'type', 'issuer', 'name', 'validFrom', 'credentialSubject'],
  properties: {
    '@context': { type: 'array', minItems: 2, contains: [VC_CONTEXT, CLR_CONTEXT] },
    id: { type: 'string', pattern: '^(urn:|https?:)' },
    type: { type: 'array', contains: ['VerifiableCredential', 'ClrCredential'] },
    issuer: PROFILE,
    name: { type: 'string' },
    validFrom: { type: 'string', pattern: DATE_TIME },
    validUntil: { type: 'string', pattern: DATE_TIME },
    credentialSubject: {
      type: 'object', required: ['type', 'verifiableCredential'],
      properties: {
        type: { type: 'array', contains: ['ClrSubject'] },
        verifiableCredential: { type: 'array', minItems: 1, items: VC },
        association: { type: 'array', items: { type: 'object', required: ['type', 'associationType', 'sourceId', 'targetId'], properties: { associationType: { type: 'string', enum: ['exactMatchOf', 'isChildOf', 'isParentOf', 'isPartOf', 'isPeerOf', 'isRelatedTo', 'precedes', 'replacedBy'] } } } },
      },
    },
  },
};
const typeOf = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v);
/** Validate `v` against the schema subset; returns the list of problems (empty = valid). */
export function validateSchema(v: unknown, s: Schema, path = '$'): string[] {
  const out: string[] = [];
  if (s.type) { const t = typeOf(v); if (!(t === s.type || (s.type === 'number' && t === 'integer'))) return [`${path}: expected ${s.type}, got ${t}`]; }
  if (s.enum && !s.enum.includes(v)) out.push(`${path}: not one of ${s.enum.join(', ')}`);
  if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) out.push(`${path}: does not match ${s.pattern}`);
  if (Array.isArray(v)) {
    if (s.minItems != null && v.length < s.minItems) out.push(`${path}: fewer than ${s.minItems} items`);
    for (const c of s.contains ?? []) if (!v.includes(c)) out.push(`${path}: must contain ${c}`);
    if (s.items) v.forEach((x, i) => out.push(...validateSchema(x, s.items!, `${path}[${i}]`)));
  }
  if (s.anyOf && !s.anyOf.some((alt) => validateSchema(v, alt, path).length === 0)) out.push(`${path}: matches none of the allowed shapes`);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    for (const k of s.required ?? []) if (!(k in o) || o[k] === undefined) out.push(`${path}.${k}: required`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in o && o[k] !== undefined) out.push(...validateSchema(o[k], sub, `${path}.${k}`));
  }
  return out;
}
export const validateClr = (bundle: unknown) => validateSchema(bundle, CLR_SCHEMA);

/** Words that would carry security or medical detail; never in a shared record (unit test and SQL check). */
export const RESTRICTED_RECORD = /\b(medical|fitness for duty|security clearance|vetting|safeguards inspection|security plan|physical protection|access control list|guard force)\b/i;

// ───────────── shares
export interface ShareInput { items: string[]; label: string; expires_on: string; consents: { items: boolean; preview: boolean; share: boolean } }
export interface ShareRow { id: string; person_id: string; token: string; label: string; items: string[]; expires_on: string; revoked_at: string | null; created_at?: string | null; views?: number; last_viewed_at?: string | null; consents?: Row }
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
/** Same order and codes as kafaa_create_record_share. */
export function shareProblem(x: ShareInput, available: RecordItem[], today: string): 'ok' | 'invalid' | 'consent_required' | 'not_shareable' {
  if (!x || typeof x !== 'object' || !Array.isArray(x.items)) return 'invalid';
  const items = x.items;
  if (items.length < 1 || items.length > SHARE_RULES.maxItems || new Set(items).size !== items.length || items.some((r) => typeof r !== 'string')) return 'invalid';
  const label = typeof x.label === 'string' ? x.label.trim() : '';
  if (label.length < SHARE_RULES.labelMin || label.length > SHARE_RULES.labelMax) return 'invalid';
  if (typeof x.expires_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.expires_on) || Number.isNaN(Date.parse(`${x.expires_on}T00:00:00Z`))) return 'invalid';
  const days = dayDiff(today, x.expires_on);
  if (days < SHARE_RULES.minDays || days > SHARE_RULES.maxDays) return 'invalid';
  const c = x.consents ?? ({} as ShareInput['consents']);
  if (c.items !== true || c.preview !== true || c.share !== true) return 'consent_required';
  const ok = new Set(available.map((i) => i.ref));
  if (items.some((r) => !ok.has(r))) return 'not_shareable';
  return 'ok';
}
/** Effective state of a share link today: revoked, expired (after its expiry day) or active. */
export const shareView = (s: Pick<ShareRow, 'revoked_at' | 'expires_on'>, today: string): 'active' | 'expired' | 'revoked' => (s.revoked_at ? 'revoked' : String(s.expires_on).slice(0, 10) < today ? 'expired' : 'active');
export interface VerifyResult { found: boolean; status: 'active' | 'expired' | 'revoked'; checked_on: string; expires_on?: string; holder_initials?: string; item_count?: number; clr?: Row; notice: string; purpose?: string } // purpose (wave G integration, FS69 -> FS32): 'prearrival' for a contractor pre-arrival share, else 'record'
/** Why a link was shared (active links only): FS69 pre-arrival shares carry consents.purpose = 'prearrival' (= SQL coalesce(consents ->> 'purpose', 'record')). */
export const sharePurpose = (consents: unknown): string => { const p = (consents as { purpose?: unknown } | null)?.purpose; return typeof p === 'string' && p ? p : 'record'; };

/**
 * Display name of an embedded signed credential. Course and micro-credential badges carry nameAr ("HU-101 <Arabic title>"); record
 * statements carry it on the achievement with humanCode. Arabic pages show that; the signed bytes are not touched. English otherwise.
 */
export function credName(c: Row, lang: 'en' | 'ar'): string {
  const ach = c?.credentialSubject?.achievement ?? {};
  const en = String(c?.name ?? ach.name ?? c?.id ?? '');
  if (lang !== 'ar') return en;
  if (c?.nameAr) return String(c.nameAr);
  if (ach.nameAr) return ach.humanCode ? `${ach.humanCode} ${ach.nameAr}` : String(ach.nameAr);
  return en;
}
