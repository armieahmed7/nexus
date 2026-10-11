/**
 * F04 acceptance "the verify payload passes check:public": the same rules as scripts/check-public-payloads.mjs (personal
 * column names, email addresses, phone numbers) plus photo URLs, applied recursively to an RPC payload. Import-free: the
 * PGlite validator (SQL payloads) and the unit tests (LocalBackend payloads) both run it.
 */
export const PERSONAL_KEY = /^(display_name|display_name_ar|full_name|person_name|first_name|last_name|initials|email|phone|mobile|photo|photo_url|avatar|emirates_id|passport|dob|birth_date|nationality|gender|salary|person_id|personId)$/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /\+?971[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}/;
const PHOTO = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;

/** Problems found in a public payload (empty when clean). */
export function publicPayloadProblems(v: unknown, path = '$'): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return [EMAIL.test(v) ? `${path}: email address` : '', PHONE.test(v) ? `${path}: phone number` : '', PHOTO.test(v) ? `${path}: photo URL` : ''].filter(Boolean);
  if (Array.isArray(v)) return v.flatMap((x, i) => publicPayloadProblems(x, `${path}[${i}]`));
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => [...(PERSONAL_KEY.test(k) ? [`${path}.${k}: personal field`] : []), ...publicPayloadProblems(x, `${path}.${k}`)]);
  return [];
}
