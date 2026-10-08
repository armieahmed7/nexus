/**
 * F04 Credential Wallet: the Kafa'a demo issuer, the Open Badges 3.0-shaped credential and its verification.
 * Import-free apart from ./badgeCrypto.ts (node seed builders and the PGlite validator import this file directly).
 *
 * One credential = one OpenBadgeCredential wrapping a Kafa'a-issued internal course certificate (KAF-/SA-CERT-) or a
 * passed Kafa'a course completion. Never a FANR licence, never a qualification-record mirror (see badgeSources in
 * ./passport.ts and kafaa_issue_badge in SQL).
 *
 * Signing: Ed25519 over the UTF-8 bytes of canon(credential with proof minus proofValue) ("kafaa-jcs-eddsa-2026").
 *   key-1        the server key. Its private half lives only in the SQL function kafaa_badge_issuer_seed() (Supabase).
 *   key-offline  the in-browser demo backend key (LocalBackend). Clearly labelled; the live registry never holds it.
 * Both public keys are published at /kafaa/.well-known/kafaa-issuer.json (public/.well-known/kafaa-issuer.json).
 * The SQL mirror kafaa_badge_credential() builds the identical object; the validator proves canon/signature parity.
 */
import { b64url, base58btc, canon, concat, edVerify, fromB64url, fromHex, utf8 } from './badgeCrypto.ts';

export const ISSUER_ID = 'urn:kafaa:issuer:demo-tenant';
export const ISSUER_NAME = "Kafa'a demo tenant";
export const ISSUER_URL = '/kafaa/.well-known/kafaa-issuer.json';
export const CRYPTOSUITE = 'kafaa-jcs-eddsa-2026';
export const NOTICE_EN = "Internal Kafa'a credential; not a FANR certificate or licence.";
export const NOTICE_AR = 'اعتماد داخلي من كفاءة؛ ليس شهادة أو رخصة صادرة عن الهيئة الاتحادية للرقابة النووية.';
export const CONTEXTS = ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'];

export type KeyId = 'key-1' | 'key-offline';
export const ISSUER_KEYS: Record<KeyId, { publicKeyHex: string; label_en: string; label_ar: string }> = {
  'key-1': { publicKeyHex: '09613c2d60072a14352f5d1055a0cfdd868dd928a097ace9eef0a438188f6455', label_en: 'Kafa\'a issuer key (server)', label_ar: 'مفتاح جهة الإصدار في كفاءة (الخادم)' },
  'key-offline': { publicKeyHex: 'da9a5f6ae4735980fc10dcf3af89373d998249ec128495a549702a4ae4a0cd0e', label_en: 'Offline demo key (in-browser demo backend only)', label_ar: 'مفتاح العرض دون اتصال (واجهة العرض داخل المتصفح فقط)' },
};
export const verificationMethod = (k: KeyId) => `${ISSUER_ID}#${k}`;
/** Multikey form (multicodec ed25519-pub 0xed01 + key, base58btc) used in the issuer document. */
export const publicKeyMultibase = (hex: string) => `z${base58btc(concat(Uint8Array.from([0xed, 0x01]), fromHex(hex)))}`;

/** The issuer profile published at /kafaa/.well-known/kafaa-issuer.json (a unit test keeps the file equal to this). */
export function issuerDocument() {
  return {
    '@context': CONTEXTS,
    id: ISSUER_ID,
    type: ['Profile'],
    name: ISSUER_NAME,
    description: `${NOTICE_EN} Demo tenant of a concept platform with synthetic data; not affiliated with or endorsed by ENEC or FANR.`,
    cryptosuite: CRYPTOSUITE,
    verificationMethod: (Object.keys(ISSUER_KEYS) as KeyId[]).map((k) => ({
      id: verificationMethod(k),
      type: 'Multikey',
      controller: ISSUER_ID,
      publicKeyMultibase: publicKeyMultibase(ISSUER_KEYS[k].publicKeyHex),
      publicKeyHex: ISSUER_KEYS[k].publicKeyHex,
      label: ISSUER_KEYS[k].label_en,
    })),
  };
}

export interface AlignmentInput { id: string; code: string; name_en: string }
export interface CredentialInput {
  slug: string;
  kind: 'certificate' | 'completion';
  /** Certificate number for kind certificate (public, also verifiable at /verify); ignored for completions. */
  certificateNo: string | null;
  course: { id: string; code: string; title_en: string; title_ar: string };
  holderInitials: string;
  /** Date the badge was issued (validFrom, proof.created). */
  issuedOn: string;
  validTo: string | null;
  /** Date of the source event: certificate issue date or course completion date. */
  sourceDate: string;
  sourceSystem: string;
  alignment: AlignmentInput[];
  keyId: KeyId;
}
export type Credential = Record<string, any>;

const day = (d: string) => `${d.slice(0, 10)}T00:00:00Z`;
/** Unsigned credential (proof without proofValue). Same object as kafaa_badge_credential() in SQL. */
export function buildCredential(i: CredentialInput): Credential {
  const name = `${i.course.code} ${i.course.title_en}`;
  const cert = i.kind === 'certificate';
  const cred: Credential = {
    '@context': CONTEXTS,
    id: `urn:kafaa:badge:${i.slug}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name,
    nameAr: `${i.course.code} ${i.course.title_ar}`,
    issuer: { id: ISSUER_ID, type: ['Profile'], name: ISSUER_NAME, url: ISSUER_URL },
    validFrom: day(i.issuedOn),
    credentialSubject: {
      type: ['AchievementSubject'],
      holderInitials: i.holderInitials,
      achievement: {
        id: `urn:kafaa:achievement:${i.course.id}`,
        type: ['Achievement'],
        achievementType: cert ? 'Certificate' : 'Course',
        humanCode: i.course.code,
        name: i.course.title_en,
        nameAr: i.course.title_ar,
        description: cert ? `Kafa'a internal course certificate for ${name}.` : `Kafa'a internal course completion for ${name}.`,
        criteria: {
          narrative: cert
            ? `Holds Kafa'a course certificate ${i.certificateNo} for ${name}, issued ${i.sourceDate.slice(0, 10)}.`
            : `Completed ${name} as recorded in ${i.sourceSystem} on ${i.sourceDate.slice(0, 10)}.`,
        },
        criteriaAr: cert
          ? `يحمل شهادة الدورة الداخلية من كفاءة رقم ${i.certificateNo} للدورة ${i.course.code} ${i.course.title_ar}، الصادرة بتاريخ ${i.sourceDate.slice(0, 10)}.`
          : `أكمل الدورة ${i.course.code} ${i.course.title_ar} كما هو مسجل في ${i.sourceSystem} بتاريخ ${i.sourceDate.slice(0, 10)}.`,
        alignment: i.alignment.map((a) => ({ type: ['Alignment'], targetType: 'ceterms:Skill', targetFramework: "Kafa'a skills catalogue", targetCode: a.code, targetName: a.name_en, targetUrl: `urn:kafaa:skill:${a.id}` })),
      },
    },
    evidence: [
      cert
        ? { id: `urn:kafaa:certificate:${i.certificateNo}`, type: ['Evidence'], name: `Kafa'a course certificate ${i.certificateNo}`, narrative: 'Certificate number can also be checked at /kafaa/verify.' }
        : { id: `urn:kafaa:evidence:${i.slug}`, type: ['Evidence'], name: `Course completion ${i.course.code}`, narrative: `Completion mirrored from ${i.sourceSystem}.` },
    ],
    kafaaNotice: NOTICE_EN,
    proof: { type: 'DataIntegrityProof', cryptosuite: CRYPTOSUITE, created: day(i.issuedOn), verificationMethod: verificationMethod(i.keyId), proofPurpose: 'assertionMethod' },
  };
  if (i.validTo) cred.validUntil = day(i.validTo);
  return cred;
}

/** The exact bytes that are signed: canonical JSON of the credential with proof.proofValue removed. */
export function signingText(cred: Credential): string {
  const proof = { ...(cred.proof ?? {}) };
  delete proof.proofValue;
  return canon({ ...cred, proof });
}
export const signingBytes = (cred: Credential) => utf8(signingText(cred));
export const proofValueOf = (sig: Uint8Array) => `u${b64url(sig)}`;
export function withProof(cred: Credential, sig: Uint8Array): Credential {
  return { ...cred, proof: { ...cred.proof, proofValue: proofValueOf(sig) } };
}

export type VerifyOutcome = 'valid' | 'invalid_signature' | 'unknown_key' | 'malformed';
export interface CredentialCheck { outcome: VerifyOutcome; keyId: KeyId | null; slug: string | null }
export const slugOf = (cred: Credential): string | null => {
  const id = typeof cred?.id === 'string' ? cred.id : '';
  return id.startsWith('urn:kafaa:badge:') ? id.slice('urn:kafaa:badge:'.length) : null;
};
/** Check the Ed25519 proof of a credential against the published issuer keys. Never throws. */
export function verifyCredential(cred: unknown): CredentialCheck {
  try {
    if (!cred || typeof cred !== 'object' || Array.isArray(cred)) return { outcome: 'malformed', keyId: null, slug: null };
    const c = cred as Credential;
    const slug = slugOf(c);
    const p = c.proof;
    if (!p || typeof p !== 'object' || typeof p.proofValue !== 'string' || !p.proofValue.startsWith('u') || p.cryptosuite !== CRYPTOSUITE) return { outcome: 'malformed', keyId: null, slug };
    const keyId = (Object.keys(ISSUER_KEYS) as KeyId[]).find((k) => p.verificationMethod === verificationMethod(k)) ?? null;
    if (!keyId) return { outcome: 'unknown_key', keyId: null, slug };
    let sig: Uint8Array;
    try { sig = fromB64url(p.proofValue.slice(1)); } catch { return { outcome: 'invalid_signature', keyId, slug }; }
    const ok = edVerify(sig, signingBytes(c), fromHex(ISSUER_KEYS[keyId].publicKeyHex));
    return { outcome: ok ? 'valid' : 'invalid_signature', keyId, slug };
  } catch {
    return { outcome: 'malformed', keyId: null, slug: null };
  }
}
