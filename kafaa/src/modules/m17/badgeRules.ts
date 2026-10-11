/**
 * F04 badge rules (and the shared date/security helpers of F03). Import-free: the seed builder (node) imports this file
 * directly. SQL mirror: kafaa_course_alignment / kafaa_issue_badge / kafaa_verify_badge in
 * supabase/migrations/20261009111001_kafaa_w1e1_passport.sql. Change both together.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export interface SkillRow { id: string; code: string; competency_id: string; name_en: string; name_ar: string; area: string; core: boolean; key_level: number; evidence_keys: string[]; sort: number }
export interface CompRow { id: string; code: string; domain: string; domain_en: string; domain_ar: string; name_en: string; name_ar: string }
export interface CourseRow { id: string; code: string; title_en: string; title_ar: string; competency_ids: string[]; qualifying?: boolean | null; validity_months?: number | null; duration_hours?: number | null }
export const URL_MAX = 300;

// ───────────── dates (same semantics as SQL: date + interval 'n months' clamps to the month end)
export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12), nm = (t % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function addDays(d: string, n: number): string {
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// ───────────── security and claims
export const securityComps = (comps: Pick<CompRow, 'id' | 'domain'>[]) => new Set(comps.filter((c) => c.domain === 'security').map((c) => c.id));
/** A skill is security-restricted when its competency is in the security domain (or its area is security). */
export const isSecuritySkill = (s: Pick<SkillRow, 'competency_id' | 'area'>, sec: Set<string>) => s.area === 'security' || sec.has(s.competency_id);
export const isHttpUrl = (u: string) => /^https?:\/\/[^\s]{3,}$/i.test(u) && u.length <= URL_MAX;

// ───────────── badges (F04)
export const courseIsSecurity = (c: Pick<CourseRow, 'competency_ids'>, sec: Set<string>) => (c.competency_ids ?? []).some((id) => sec.has(id));
export interface AlignedSkill { id: string; code: string; name_en: string; name_ar: string; level: number }
/** Skills a course evidences (core skill of each course competency, plus skills keyed to the course), security skills excluded. */
export function courseAlignment(c: CourseRow, skills: SkillRow[], sec: Set<string>): AlignedSkill[] {
  const cap = c.qualifying ? 2 : 1;
  return skills
    .filter((s) => !isSecuritySkill(s, sec))
    .map((s) => ({ s, level: Math.max(s.core && (c.competency_ids ?? []).includes(s.competency_id) ? cap : 0, (s.evidence_keys ?? []).includes(c.id) ? Math.min(s.key_level, cap) : 0) }))
    .filter((x) => x.level > 0)
    .sort((a, b) => a.s.sort - b.s.sort || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0))
    .map(({ s, level }) => ({ id: s.id, code: s.code, name_en: s.name_en, name_ar: s.name_ar, level }));
}

export type BadgeCode = 'ok' | 'not_found' | 'not_eligible' | 'security_restricted' | 'already_issued';
export interface BadgeSource {
  source_table: 'certificates' | 'training_records';
  source_id: string;
  kind: 'certificate' | 'completion';
  course_id: string;
  certificate_no: string | null;
  source_date: string;
  valid_to: string | null;
  source_system: string;
  holder_initials: string;
}
export interface BadgeSourceCheck { code: BadgeCode; message: string; source?: BadgeSource; why?: 'expired' | 'revoked' | 'mirror' | 'covered' | 'security' | 'duplicate' }
export interface BadgeWorld {
  me: string;
  today: string;
  initials: string;
  certificates: Row[];
  training_records: Row[];
  courses: CourseRow[];
  competencies: Pick<CompRow, 'id' | 'domain'>[];
  badges: Row[];
  licences: Row[];
  qual_records: Row[];
}
export const CERT_SYSTEM = "Kafa'a certificate register";
/**
 * Can `sourceId` become a badge for `me`? Same order of checks and codes as kafaa_issue_badge (SQL):
 * not_found (not mine) → not_eligible (licence or qualification mirror; expired or revoked certificate; expired completion;
 * completion already covered by a certificate) → security_restricted → already_issued (an active badge for the course).
 */
export function badgeSourceCheck(sourceId: string, w: BadgeWorld): BadgeSourceCheck {
  const id = (sourceId ?? '').trim();
  const cert = w.certificates.find((c) => c.id === id && c.person_id === w.me);
  const tr = cert ? undefined : w.training_records.find((t) => t.id === id && t.person_id === w.me && ['passed', 'completed'].includes(t.result));
  if (!cert && !tr) {
    if (w.licences.some((l) => l.id === id && l.person_id === w.me) || w.qual_records.some((q) => q.id === id && q.person_id === w.me))
      return { code: 'not_eligible', why: 'mirror', message: "Licences and qualification records mirror the licensee's systems and are never issued as badges" };
    return { code: 'not_found', message: 'No certificate or course completion of yours has this number' };
  }
  const course = w.courses.find((c) => c.id === (cert ? cert.course_id : tr!.course_id));
  if (!course) return { code: 'not_found', message: 'Course not found' };
  let src: BadgeSource;
  if (cert) {
    const expired = cert.status === 'expired' || (cert.status === 'valid' && cert.valid_to && String(cert.valid_to).slice(0, 10) < w.today);
    if (cert.status === 'revoked') return { code: 'not_eligible', why: 'revoked', message: 'This certificate is revoked: a badge cannot be issued' };
    if (expired || cert.status !== 'valid') return { code: 'not_eligible', why: 'expired', message: 'This certificate has expired: a badge cannot be issued' };
    src = { source_table: 'certificates', source_id: cert.id, kind: 'certificate', course_id: course.id, certificate_no: cert.id, source_date: String(cert.issued_on).slice(0, 10), valid_to: cert.valid_to ? String(cert.valid_to).slice(0, 10) : null, source_system: CERT_SYSTEM, holder_initials: cert.holder_initials || w.initials };
  } else {
    const done = String(tr!.completed_on).slice(0, 10);
    const validTo = course.validity_months ? addMonths(done, course.validity_months) : null;
    if (validTo && validTo < w.today) return { code: 'not_eligible', why: 'expired', message: 'This course completion is past its validity: a badge cannot be issued' };
    if (w.certificates.some((c) => c.person_id === w.me && c.course_id === course.id))
      return { code: 'not_eligible', why: 'covered', message: 'A certificate exists for this course: the badge wraps the certificate instead' };
    src = { source_table: 'training_records', source_id: tr!.id, kind: 'completion', course_id: course.id, certificate_no: null, source_date: done, valid_to: validTo, source_system: String(tr!.source_system ?? 'Training records system'), holder_initials: w.initials };
  }
  if (courseIsSecurity(course, securityComps(w.competencies as CompRow[])))
    return { code: 'security_restricted', why: 'security', message: 'Security-related training shows as qualified or not qualified only and is never issued as a badge', source: src };
  if (w.badges.some((b) => b.person_id === w.me && b.course_id === course.id && b.status === 'active'))
    return { code: 'already_issued', why: 'duplicate', message: 'You already hold an active badge for this course', source: src };
  return { code: 'ok', message: 'Eligible', source: src };
}
/** Every certificate and course completion of `me`, with its eligibility (wallet "ready to wrap" list). */
export function badgeCandidates(w: BadgeWorld): (BadgeSourceCheck & { source_id: string; course_id: string })[] {
  const ids = [
    ...w.certificates.filter((c) => c.person_id === w.me).map((c) => [c.id, c.course_id] as const),
    ...w.training_records.filter((t) => t.person_id === w.me && ['passed', 'completed'].includes(t.result)).map((t) => [t.id, t.course_id] as const),
  ];
  const seen = new Set<string>();
  const out: (BadgeSourceCheck & { source_id: string; course_id: string })[] = [];
  for (const [id, course] of ids) {
    const r = badgeSourceCheck(id, w);
    // a completion covered by a certificate is not listed: the certificate row stands for it
    if (r.why === 'covered') continue;
    const k = `${course}:${r.code}`;
    if (r.source?.kind === 'completion' && seen.has(k)) continue;
    seen.add(k);
    out.push({ ...r, source_id: id, course_id: course });
  }
  return out;
}
export type BadgeStatus = 'active' | 'expired' | 'revoked';
/** Effective status: revoked if the badge or its source certificate is revoked; expired once valid_to (or the certificate) has passed. */
export function badgeView(b: { status: string; valid_to?: string | null; source_table?: string; source_id?: string }, today: string, certificates: Row[] = []): BadgeStatus {
  if (b.status === 'revoked') return 'revoked';
  const cert = b.source_table === 'certificates' ? certificates.find((c) => c.id === b.source_id) : undefined;
  if (cert?.status === 'revoked') return 'revoked';
  if (cert && (cert.status === 'expired' || (cert.valid_to && String(cert.valid_to).slice(0, 10) < today))) return 'expired';
  if (b.valid_to && String(b.valid_to).slice(0, 10) < today) return 'expired';
  return 'active';
}

