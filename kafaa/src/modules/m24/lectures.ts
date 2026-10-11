/**
 * FS44 Expert lecture library and knowledge that counts as evidence (FS wave E · E3, module M24). Pure rules shared by the pages, the
 * LocalBackend (src/modules/m24/backend/local.fs44.ts) and, line for line, the SQL in
 * supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql (kafaa_lc_*). The PGlite validator
 * (scripts/validate/fs53-lectures-localisation.mjs) proves SQL = TS. Import-free: node scripts load it directly.
 *
 * Lecture library (OECD-NEA Plan 2035 INSPIRE pattern: "a library of video lectures by NEA member experts"): recorded expert talks with
 * synthetic metadata (no real recording, no real person), each linked to 1-6 catalogue skills and, where the speaker holds one, to the
 * F20 knowledge-loss-risk (KLRA) position the talk protects. The position is resolved on the server from the speaker's own active
 * positions (people cannot read KLRA rows), so a lecture always names it when one exists. The risk band never leaves the KLRA.
 * No security-restricted topic is ever stored or published: security-area skills, security competencies, positions in the security,
 * cyber and safeguards families and texts the shared community guard flags (kafaa_cop_guard / postGuard) are refused with
 * `security_restricted`.
 *
 * Contributions: a published, delivered lecture (speaker) and a published knowledge asset (author, and the SME whose knowledge it
 * captures) become "contributions". They write nothing until the knowledge-management owner (knowledge A) validates them; the
 * contributor can never validate their own. A validated contribution writes F01 evidence: kind `rating`, basis `validated`,
 * ref_table `lectures` or `knowledge_assets` (the evidence kind check cannot be widened, so there is no `contribution` kind), level
 * 3 for the speaker or the SME and 2 for an author, on every linked skill that is not security, cyber hygiene or obsolete; then the
 * person's skill states are recomputed. Rejected and pending contributions write nothing. `validatedContributions()` (SQL
 * kafaa_lc_validated) is the clean query FS72 reads as a suggestion source.
 */

export const LECTURE_FORMATS = ['talk', 'masterclass', 'walkthrough', 'panel'] as const;
export type LectureFormat = (typeof LECTURE_FORMATS)[number];
export const LECTURE_STATUSES = ['draft', 'review', 'published', 'withdrawn'] as const;
export type LectureStatus = (typeof LECTURE_STATUSES)[number];
export const LECTURE_LANGS = ['en', 'ar'] as const;
/** Same list as SYSTEM_FAMILIES in ./capture.ts (kept here so this file stays import-free; a unit test checks they agree). */
export const LECTURE_FAMILIES = ['reactor_core', 'primary', 'secondary', 'electrical', 'i_and_c', 'chemistry', 'radiation_protection', 'maintenance', 'outage', 'human_performance', 'emergency_preparedness', 'training'] as const;
export const CONTRIB_KINDS = ['lecture', 'asset'] as const;
export type ContribKind = (typeof CONTRIB_KINDS)[number];
export const CONTRIB_ROLES = ['speaker', 'author', 'sme'] as const;
export type ContribRole = (typeof CONTRIB_ROLES)[number];
export const CONTRIB_STATUSES = ['pending', 'validated', 'rejected'] as const;
export type ContribStatus = (typeof CONTRIB_STATUSES)[number];
/** Families that are career-path only: a lecture never protects a position in them (same list as F31 RESTRICTED_FAMILIES). */
export const RESTRICTED_FAMILIES = ['security', 'cyber', 'safeguards'] as const;
/** Evidence level of a validated contribution: delivering a talk or being the SME behind an asset is expert evidence (3); writing up
 *  someone else's knowledge is practitioner evidence (2). Never above 3 (level 4 stays with qualifications and assessments). */
export const CONTRIB_LEVEL: Record<ContribRole, number> = { speaker: 3, sme: 3, author: 2 };
export const CONTRIB_MAX_LEVEL = 3;
export const LEC_LIMITS = { TITLE: [5, 160], ABSTRACT: [20, 1200], SKILLS_MAX: 6, CHAPTERS_MAX: 12, CHAPTER_TEXT: 120, DURATION: [10, 240], NOTE_MAX: 600, EARLIEST: '2015-01-01' } as const;

/** User-facing refusal messages: identical in the LocalBackend and the SQL functions. */
export const LEC_MSG = {
  not_signed_in: 'Sign in to use the lecture library',
  forbidden: 'The lecture library is open to ENEC staff',
  forbidden_behalf: 'Only the knowledge-management owner records a lecture on behalf of another speaker',
  forbidden_owner: 'Only the knowledge-management owner publishes lectures and validates contributions',
  not_found: 'Lecture not found',
  not_editable: 'Only draft and submitted lectures can be edited; a published lecture is withdrawn first',
  not_in_review: 'This lecture is not waiting for publication',
  maker_checker: 'You cannot publish a lecture you give or recorded yourself',
  withdraw_forbidden: 'Only the speaker or the knowledge-management owner withdraws a lecture',
  withdraw_state: 'Only submitted or published lectures can be withdrawn',
  withdraw_reason: 'Give a reason of 5 to 600 characters',
  speaker: 'The speaker must be an active ENEC staff member',
  texts: 'Give a title (5 to 160 characters) and an abstract (20 to 1,200 characters) in English and Arabic',
  fields: 'Choose a format, a language and a system family',
  duration: 'The recording lasts 10 to 240 minutes',
  date: 'The delivery date must be a real date from 2015 up to today',
  skills: 'Link 1 to 6 catalogue skills',
  obsolete: 'Obsolete skills cannot be linked; use the skill that replaced it',
  security: 'Security-restricted topics are not published in the lecture library: security, safeguards and cyber skills follow the security career path',
  position: 'A lecture protects the knowledge-loss-risk position its speaker holds, never someone else\'s',
  chapters: 'Up to 12 chapters, each with a start minute inside the recording and a title in English and Arabic (up to 120 characters)',
  recording: 'The recording reference is a synthetic code such as REC-2026-014',
  contact: 'Not saved: remove email addresses and phone numbers. Name roles, never people',
  contrib_not_found: 'Contribution not found',
  contrib_decided: 'This contribution has already been decided',
  contrib_self: 'You cannot validate your own contribution',
  contrib_source: 'The lecture or knowledge asset behind this contribution is no longer published',
  contrib_decision: 'Choose validate or reject; a rejection needs a reason of 5 to 600 characters',
  contrib_skills: 'This contribution names no skill that can carry evidence',
} as const;
/** Text-guard refusal (kafaa_cop_guard category in English). */
export const restrictedLecture = (category: string) =>
  `Not saved: ${category} content is not allowed in the lecture library. Share reasoning, lessons and practice; leave out plant security arrangements, safeguards figures and cyber or network details`;

export interface Chapter { at: number; en: string; ar: string }
export interface LectureInput {
  title_en?: unknown; title_ar?: unknown; abstract_en?: unknown; abstract_ar?: unknown; format?: unknown; lang?: unknown; delivered_on?: unknown;
  duration_min?: unknown; skill_ids?: unknown; system_family?: unknown; chapters?: unknown; recording_code?: unknown;
}
export interface SkillLite { id: string; area?: string | null; competency_id?: string | null; lifecycle?: string | null; fs_area?: string | null }
export interface PositionLite { id: string; person_id?: string | null; family_id?: string | null; active?: boolean; title_en?: string; title_ar?: string }
export interface LectureWorld {
  skills: Map<string, SkillLite>;
  /** Competency ids in the security domain. */
  secComps: Set<string>;
  /** The resolved position (or null) and the speaker's own active positions. */
  position: PositionLite | null;
  speakerPositions: PositionLite[];
  /** Shared community guard: returns 'security' | 'safeguards' | 'cyber' or null (kafaa_cop_guard / postGuard). */
  guard: (text: string) => string | null;
  /** Email or phone number in the text (kafaa_cop_contact / hasContactDetails). */
  contact: (text: string) => boolean;
  today: string;
}
export interface Problem { code: 'invalid' | 'security_restricted' | 'contact_details'; message: string }

const isStr = (v: unknown): v is string => typeof v === 'string';
const len = (v: unknown) => (isStr(v) ? v.trim().length : -1);
const inRange = (v: unknown, [lo, hi]: readonly [number, number]) => len(v) >= lo && len(v) <= hi;
export function isIsoDay(s: unknown): s is string {
  if (!isStr(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
/** Distinct strings of an array in first-seen order, or null when it is not an array of strings only. */
export function strList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const x of v) { if (!isStr(x)) return null; if (!out.includes(x)) out.push(x); }
  return out;
}
const isSecuritySkill = (s: SkillLite | undefined, secComps: Set<string>) => !!s && (s.area === 'security' || (!!s.competency_id && secComps.has(s.competency_id)));

/** The KLRA position a lecture protects: the speaker's own active position (the requested one when it is theirs, else the first by id);
 *  null when the speaker holds none. `false` when a position was requested that the speaker does not hold. */
export function resolvePosition(requested: unknown, speakerPositions: PositionLite[]): PositionLite | null | false {
  const mine = [...speakerPositions].filter((p) => p.active !== false).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const req = isStr(requested) && requested.trim() ? requested.trim() : null;
  if (!mine.length) return req ? false : null;
  if (req) return mine.find((p) => p.id === req) ?? false;
  return mine[0];
}

/** Every text a lecture shows (screened by the guard). */
export function lectureText(x: LectureInput): string {
  const ch = Array.isArray(x.chapters) ? (x.chapters as Record<string, unknown>[]).map((c) => `${isStr(c?.en) ? c.en : ''} ${isStr(c?.ar) ? c.ar : ''}`).join(' ') : '';
  return [x.title_en, x.title_ar, x.abstract_en, x.abstract_ar].map((s) => (isStr(s) ? s : '')).join(' ') + ' ' + ch;
}

/** Checks a lecture (kafaa_lc_problem): the first problem in a fixed order, or null. */
export function lectureProblem(x: LectureInput, w: LectureWorld): Problem | null {
  const bad = (message: string): Problem => ({ code: 'invalid', message });
  if (!inRange(x.title_en, LEC_LIMITS.TITLE) || !inRange(x.title_ar, LEC_LIMITS.TITLE) || !inRange(x.abstract_en, LEC_LIMITS.ABSTRACT) || !inRange(x.abstract_ar, LEC_LIMITS.ABSTRACT)) return bad(LEC_MSG.texts);
  if (!(LECTURE_FORMATS as readonly unknown[]).includes(x.format) || !(LECTURE_LANGS as readonly unknown[]).includes(x.lang) || !(LECTURE_FAMILIES as readonly unknown[]).includes(x.system_family)) return bad(LEC_MSG.fields);
  if (!isInt(x.duration_min) || x.duration_min < LEC_LIMITS.DURATION[0] || x.duration_min > LEC_LIMITS.DURATION[1]) return bad(LEC_MSG.duration);
  if (!isIsoDay(x.delivered_on) || x.delivered_on < LEC_LIMITS.EARLIEST || x.delivered_on > w.today) return bad(LEC_MSG.date);
  const sk = strList(x.skill_ids);
  if (!sk || sk.length < 1 || sk.length > LEC_LIMITS.SKILLS_MAX || sk.some((id) => !w.skills.has(id))) return bad(LEC_MSG.skills);
  if (sk.some((id) => isSecuritySkill(w.skills.get(id), w.secComps))) return { code: 'security_restricted', message: LEC_MSG.security };
  if (sk.some((id) => w.skills.get(id)?.lifecycle === 'obsolete')) return bad(LEC_MSG.obsolete);
  if (x.chapters !== undefined && x.chapters !== null) {
    if (!Array.isArray(x.chapters) || x.chapters.length > LEC_LIMITS.CHAPTERS_MAX) return bad(LEC_MSG.chapters);
    for (const c of x.chapters as Record<string, unknown>[]) {
      if (!c || typeof c !== 'object' || !isInt(c.at) || c.at < 0 || c.at > (x.duration_min as number) || !inRange(c.en, [1, LEC_LIMITS.CHAPTER_TEXT]) || !inRange(c.ar, [1, LEC_LIMITS.CHAPTER_TEXT])) return bad(LEC_MSG.chapters);
    }
  }
  if (x.recording_code !== undefined && x.recording_code !== null && x.recording_code !== '' && !(isStr(x.recording_code) && /^REC-\d{4}-\d{3}$/.test(x.recording_code))) return bad(LEC_MSG.recording);
  if (w.position && !w.speakerPositions.some((p) => p.id === w.position!.id)) return bad(LEC_MSG.position);
  if (!w.position && w.speakerPositions.some((p) => p.active !== false)) return bad(LEC_MSG.position);
  if (w.position && (RESTRICTED_FAMILIES as readonly string[]).includes(w.position.family_id ?? '')) return { code: 'security_restricted', message: LEC_MSG.security };
  const text = lectureText(x);
  const cat = w.guard(text);
  if (cat) return { code: 'security_restricted', message: restrictedLecture(cat) };
  if (w.contact(text)) return { code: 'contact_details', message: LEC_MSG.contact };
  return null;
}

// ───────────── contributions
export interface ContributionRow {
  id: string; person_id: string; kind: ContribKind | string; contributor_role: ContribRole | string; ref_table: string; ref_id: string;
  skill_ids: string[]; level: number; status: ContribStatus | string; submitted_on?: string; decided_on?: string | null; decided_by?: string | null;
  title_en?: string; title_ar?: string; evidence_ids?: string[];
}
export const contributionId = (kind: ContribKind, refId: string, role: ContribRole) => (kind === 'lecture' ? `ctb-${refId}` : `ctb-${refId}-${role}`);
export const contributionEvidenceId = (contributionId: string, skillId: string) => `se:contrib:${contributionId}:${skillId}`;
export const levelFor = (role: string) => Math.min(CONTRIB_MAX_LEVEL, CONTRIB_LEVEL[role as ContribRole] ?? 2);

/** Skills a validated contribution evidences: linked, existing, not security, not cyber hygiene (awareness content is not recognised
 *  individually), not obsolete; in the stored order. */
export function evidenceSkills(skillIds: string[], skills: Map<string, SkillLite>, secComps: Set<string>): string[] {
  return (skillIds ?? []).filter((id, i, a) => a.indexOf(id) === i && skills.has(id) && !isSecuritySkill(skills.get(id), secComps)
    && skills.get(id)!.fs_area !== 'cyber_hygiene' && skills.get(id)!.lifecycle !== 'obsolete');
}

/** The contributions a published source should have (who contributed, in which role, at which level). */
export function contributorsOf(kind: ContribKind, src: { id: string; speaker_id?: string | null; author_id?: string | null; sme_id?: string | null }): { person_id: string; role: ContribRole; id: string; level: number }[] {
  if (kind === 'lecture') return src.speaker_id ? [{ person_id: src.speaker_id, role: 'speaker', id: contributionId('lecture', src.id, 'speaker'), level: levelFor('speaker') }] : [];
  const out: { person_id: string; role: ContribRole; id: string; level: number }[] = [];
  if (src.sme_id) out.push({ person_id: src.sme_id, role: 'sme', id: contributionId('asset', src.id, 'sme'), level: levelFor('sme') });
  if (src.author_id && src.author_id !== src.sme_id) out.push({ person_id: src.author_id, role: 'author', id: contributionId('asset', src.id, 'author'), level: levelFor('author') });
  return out;
}

export type DecideCode = 'ok' | 'not_found' | 'decided' | 'self' | 'source' | 'decision' | 'skills';
/** Can `me` decide this contribution now? (kafaa_lc_decide_problem) A rejection stays possible when the source is gone; a validation
 *  needs the lecture or asset to be published and at least one skill that can carry evidence. */
export function decideProblem(c: ContributionRow | undefined | null, me: string, decision: unknown, note: unknown, sourcePublished: boolean, evidenceSkillCount: number): DecideCode {
  if (!c) return 'not_found';
  if (c.status !== 'pending') return 'decided';
  if (c.person_id === me) return 'self';
  if (decision !== 'validate' && decision !== 'reject') return 'decision';
  const n = isStr(note) ? note.trim().length : 0;
  if (n > LEC_LIMITS.NOTE_MAX || (decision === 'reject' && n < 5)) return 'decision';
  if (decision === 'validate' && !sourcePublished) return 'source';
  if (decision === 'validate' && evidenceSkillCount === 0) return 'skills';
  return 'ok';
}

/** Validated contributions as a clean list (newest first): the FS72 suggestion source (SQL kafaa_lc_validated). */
export function validatedContributions(rows: ContributionRow[], personId?: string | null): { id: string; person_id: string; kind: string; ref_table: string; ref_id: string; skill_ids: string[]; level: number; decided_on: string | null }[] {
  return rows.filter((r) => r.status === 'validated' && (!personId || r.person_id === personId))
    .map((r) => ({ id: r.id, person_id: r.person_id, kind: r.kind, ref_table: r.ref_table, ref_id: r.ref_id, skill_ids: [...(r.skill_ids ?? [])], level: Number(r.level), decided_on: r.decided_on ?? null }))
    .sort((a, b) => ((b.decided_on ?? '') < (a.decided_on ?? '') ? -1 : (b.decided_on ?? '') > (a.decided_on ?? '') ? 1 : a.id < b.id ? -1 : 1));
}

export interface ReasonLite { code: string; key: string; vars?: Record<string, string | number> }
const R = (code: string, vars: Record<string, string | number> = {}): ReasonLite => ({ code, key: `m24.lc.reason.${code}`, vars });
/** Why a contribution counts (or does not yet): rendered by <WhyThis>. */
export function contributionReasons(c: Pick<ContributionRow, 'kind' | 'contributor_role' | 'level' | 'status'>, evidenceSkillCount: number, positionLinked: boolean): ReasonLite[] {
  const out: ReasonLite[] = [R(`role_${c.contributor_role}`, { level: Number(c.level) })];
  out.push(R('skills', { n: evidenceSkillCount }));
  if (positionLinked) out.push(R('position'));
  out.push(R(c.status === 'validated' ? 'validated' : c.status === 'rejected' ? 'rejected' : 'pending'));
  return out;
}

/** Library summary for the tiles (published lectures only). */
export function librarySummary(lectures: { status: string; duration_min: number; position_id?: string | null; speaker_id: string; skill_ids: string[] }[]) {
  const pub = lectures.filter((l) => l.status === 'published');
  return {
    lectures: pub.length,
    hours: Math.round(pub.reduce((a, l) => a + Number(l.duration_min), 0) / 6) / 10,
    speakers: new Set(pub.map((l) => l.speaker_id)).size,
    protecting: pub.filter((l) => !!l.position_id).length,
    skills: new Set(pub.flatMap((l) => l.skill_ids ?? [])).size,
  };
}
