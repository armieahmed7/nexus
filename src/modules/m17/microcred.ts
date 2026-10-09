/**
 * F32 Stackable micro-credentials (W5 · E1, module M17): pure rules shared by the pages, the LocalBackend
 * (src/modules/m17/backend/local.w5.ts), the seed builder (scripts/seed/ext/f32-microcred.mjs) and, line for line, the SQL in
 * supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql (kafaa_mc_*). The PGlite validator
 * (scripts/validate/w5e1-microcred-ojt.mjs) proves SQL = TS for every seeded person x definition. Import-free apart from the F04
 * issuer (./issuer.ts, itself import-free), so node scripts load it directly.
 *
 * A definition (kafaa_microcred_defs, versioned like qualification standards) lists criteria over F01 evidence:
 *   course       a passed Kafa'a course completion still inside the course validity
 *   assessment   a passed, released assessment attempt on a form
 *   opportunity  a completed F08 opportunity (a given id, or `kind:<kind>`)
 *   skill        a skill state at or above a level whose basis is verified, evidenced or validated (claims do not count)
 *   manual       a training manager confirms it (the award waits for approval)
 * A stacked definition (kind `stack`) is earned by holding every current micro-credential that stacks into it (`stacks_into` =
 * the stack's code) plus any criteria of its own. Awards are signed Open Badges 3.0-shaped credentials (F04 issuer). Expired or
 * revoked components flag the stacked credential "renewal due". Micro-credentials are internal recognition: never a FANR
 * certificate, licence or qualification.
 */
import { CONTEXTS, CRYPTOSUITE, ISSUER_ID, ISSUER_NAME, ISSUER_URL, NOTICE_EN, verificationMethod, type Credential, type KeyId } from './issuer.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export const CRIT_KINDS = ['course', 'assessment', 'opportunity', 'skill', 'manual'] as const;
export type CritKind = (typeof CRIT_KINDS)[number];
export const DEF_KINDS = ['micro', 'stack'] as const;
export const DEF_LEVELS = ['foundation', 'practitioner', 'advanced'] as const;
export const DEF_AREAS = ['human_performance', 'digital', 'project', 'operations', 'leadership', 'quality', 'maintenance', 'safety'] as const;
export const DEF_STATUSES = ['draft', 'current', 'superseded', 'retired'] as const;
export const AWARD_STATES = ['pending_approval', 'awarded', 'declined', 'revoked', 'superseded'] as const;
export type AwardView = 'pending_approval' | 'declined' | 'revoked' | 'superseded' | 'active' | 'renewal_due' | 'expired';
export type CritStatus = 'met' | 'missing' | 'lapsed' | 'claimed' | 'manual';

export const MC_RULES = {
  /** An active award enters "renewal due" this many days before it expires. */
  renewWindowDays: 60,
  validityMin: 6,
  validityMax: 60,
  maxCriteria: 8,
  maxAlignment: 6,
  maxRoles: 8,
  noteMin: 3,
  noteMax: 500,
  /** Skill bases that count (claims never do). */
  skillBases: ['verified', 'evidenced', 'validated'],
  /** Highest level a micro-credential adds as F01 `credential` evidence. */
  evidenceLevelMax: 2,
} as const;

/** Refusal messages: identical in SQL. */
export const MCMSG = {
  not_signed_in: 'Sign in to use micro-credentials',
  forbidden_award: 'Only staff can earn micro-credentials on their own passport',
  not_found_def: 'Micro-credential not found or not published',
  already_requested: 'Your request for this micro-credential is waiting for a training manager',
  already_awarded: 'You already hold this micro-credential and it is not yet due for renewal',
  not_eligible: 'Not eligible yet: some criteria are not met',
  pending_sent: 'Request sent: a training manager confirms the manual criteria',
  awarded: 'Micro-credential awarded and signed',
  forbidden_decide: 'Only a training manager can approve micro-credentials',
  not_found_award: 'Award not found',
  maker_checker: 'You cannot approve your own micro-credential',
  not_pending: 'This request is no longer waiting for approval',
  note_required: 'Add a short note (3 to 500 characters)',
  declined: 'Request declined',
  forbidden_revoke: 'Award not found',
  already_revoked: 'This award is already revoked or replaced',
  revoked_own: 'Micro-credential withdrawn',
  revoked: 'Micro-credential revoked',
  forbidden_def: 'Only framework owners (training managers and admins) can manage micro-credential definitions',
  invalid_def: 'Check the definition: code, titles, criteria, validity and alignment',
  regulatory_wording: 'Micro-credentials are internal recognition: the wording must not suggest a FANR certificate, licence or qualification',
  security_restricted: 'Security-related training and skills show as qualified or not qualified only and cannot be part of a micro-credential',
  mirror_only: 'Qualification standards and licences mirror the licensee\'s systems and cannot be micro-credential criteria',
  code_taken: 'A micro-credential with this code already exists: revise it instead',
  saved: 'Draft saved',
  not_draft: 'Only a draft can be published',
  not_current: 'Only a published micro-credential can be retired',
  stack_needs_parts: 'A stacked credential needs at least two published micro-credentials that stack into it',
  published: 'Micro-credential published',
  retired: 'Micro-credential retired; holders keep their awards',
  forbidden_sweep: 'Only a training manager can run the renewal sweep',
  rate_limited: 'Too many verification requests: try again in a minute',
  verify_not_found: 'No Kafa\'a micro-credential has this link',
} as const;

export interface Criterion { key: string; kind: CritKind; ref: string; min_level?: number | null; label_en: string; label_ar: string }
export interface Alignment { skill_id: string; level: number }
export interface DefRow {
  id: string; code: string; version: number; kind: 'micro' | 'stack'; area: string; level: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string;
  criteria: Criterion[]; stacks_into: string | null; alignment: Alignment[]; role_ids: string[]; validity_months: number; hours: number | null;
  status: 'draft' | 'current' | 'superseded' | 'retired'; effective_date: string | null; supersedes_id: string | null; change_reason: string | null;
  updated_by?: string | null; updated_at?: string | null; published_by?: string | null; published_at?: string | null; sort?: number;
}
export interface AwardRow {
  id: string; def_id: string; def_code: string; def_version: number; person_id: string; holder_initials: string; status: string;
  requested_at?: string | null; issued_on: string | null; valid_to: string | null; component_award_ids: string[]; public_slug: string | null; renewed_from?: string | null;
  evidence?: unknown; credential?: unknown; key_id?: string | null; decided_by?: string | null; decided_at?: string | null; decision_note?: string | null;
}
export interface EvidenceRef { table: string; id: string; date: string | null; level: number | null }
export interface CritResult { key: string; kind: CritKind; ref: string; min_level: number | null; label_en: string; label_ar: string; status: CritStatus; met: boolean; level: number | null; evidence: EvidenceRef[] }
export interface CompResult { code: string; def_id: string; title_en: string; title_ar: string; award_id: string | null; status: AwardView | 'none'; met: boolean }
export interface Eligibility {
  def_id: string; code: string; version: number; kind: 'micro' | 'stack'; person_id: string;
  criteria: CritResult[]; components: CompResult[];
  /** Every non-manual criterion and every component is met. */
  auto_met: boolean;
  /** Number of manual criteria (a training manager confirms them). */
  manual: number;
  /** Awardable without approval. */
  eligible: boolean;
}

/** Everything the rules read (rows as stored). */
export interface McWorld {
  today: string;
  defs: DefRow[];
  awards: AwardRow[];
  courses: Row[];
  training_records: Row[];
  attempts: Row[];
  opportunities: Row[];
  opportunity_applications: Row[];
  person_skills: Row[];
}

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
export const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
const d10 = (v: unknown): string | null => (v == null || v === '' ? null : String(v).slice(0, 10));
/** Byte-wise ordering (SQL `collate "C"`). */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ───────────── award state
/**
 * Effective status of an award. pending/declined/revoked/superseded are stored; an `awarded` row is expired after valid_to,
 * "renewal due" inside the 60-day window or (stacks) when any component award is no longer active, else active.
 */
type ViewRow = Pick<AwardRow, 'id' | 'status' | 'valid_to' | 'component_award_ids'> & { renewed_from?: string | null };
/** Follow renewals: a superseded award stands for the award that renewed it (at most 20 steps). */
export function resolveRenewal<T extends ViewRow>(id: string, awards: T[]): T | null {
  let c = awards.find((x) => x.id === id) ?? null;
  for (let i = 0; c && c.status === 'superseded' && i < 20; i++) {
    const cur: T = c;
    c = awards.find((x) => x.renewed_from === cur.id) ?? null;
  }
  return c;
}
export function awardView(a: Pick<AwardRow, 'status' | 'valid_to' | 'component_award_ids'>, today: string, awards: ViewRow[]): { status: AwardView; reason: 'window' | 'component' | null; days_left: number | null } {
  if (a.status !== 'awarded') return { status: a.status as AwardView, reason: null, days_left: null };
  const vt = d10(a.valid_to);
  const left = vt ? dayDiff(today, vt) : null;
  if (left != null && left < 0) return { status: 'expired', reason: null, days_left: left };
  const comps = a.component_award_ids ?? [];
  if (comps.length) {
    for (const id of comps) {
      const c = resolveRenewal(id, awards);
      const s = c ? awardView({ ...c, component_award_ids: [] }, today, []).status : 'revoked';
      if (s !== 'active' && s !== 'renewal_due') return { status: 'renewal_due', reason: 'component', days_left: left };
    }
  }
  if (left != null && left <= MC_RULES.renewWindowDays) return { status: 'renewal_due', reason: 'window', days_left: left };
  return { status: 'active', reason: null, days_left: left };
}
/** A component counts while it is active or merely inside its renewal window. */
export const isValidView = (s: AwardView | 'none') => s === 'active' || s === 'renewal_due';

/** The latest `awarded` row of a person for a definition code (by issue date, then id). */
export function latestAward(awards: AwardRow[], person: string, code: string, states: string[] = ['awarded']): AwardRow | null {
  const mine = awards.filter((a) => a.person_id === person && a.def_code === code && states.includes(a.status));
  mine.sort((a, b) => cmp(String(b.issued_on ?? b.requested_at ?? ''), String(a.issued_on ?? a.requested_at ?? '')) || cmp(b.id, a.id));
  return mine[0] ?? null;
}
/** The definition that names a code: the current version, else the highest version. */
export function defFor(defs: DefRow[], code: string): DefRow | null {
  const all = defs.filter((d) => d.code === code).sort((a, b) => Number(b.status === 'current') - Number(a.status === 'current') || Number(b.version) - Number(a.version));
  return all[0] ?? null;
}
/** The current (published) version of a code. */
export const currentDef = (defs: DefRow[], code: string) => defs.find((d) => d.code === code && d.status === 'current') ?? null;
/** Components of a stack: current micro definitions whose stacks_into is the stack's code, by code. */
export const componentsOf = (defs: DefRow[], stackCode: string) => defs.filter((d) => d.status === 'current' && d.kind === 'micro' && d.stacks_into === stackCode).sort((a, b) => cmp(a.code, b.code));

// ───────────── eligibility
function courseCrit(c: Criterion, person: string, w: McWorld): Omit<CritResult, keyof Criterion | 'min_level'> {
  const course = w.courses.find((x) => x.id === c.ref);
  const recs = w.training_records.filter((t) => t.person_id === person && t.course_id === c.ref && (t.result === 'passed' || t.result === 'completed'))
    .sort((a, b) => cmp(String(b.completed_on), String(a.completed_on)) || cmp(String(b.id), String(a.id)));
  if (!recs.length) return { status: 'missing', met: false, level: null, evidence: [] };
  const best = recs[0];
  const done = d10(best.completed_on)!;
  const ev = [{ table: 'training_records', id: String(best.id), date: done, level: null }];
  const months = Number(course?.validity_months) || 0;
  if (months > 0 && addMonths(done, months) < w.today) return { status: 'lapsed', met: false, level: null, evidence: ev };
  return { status: 'met', met: true, level: null, evidence: ev };
}
function assessmentCrit(c: Criterion, person: string, w: McWorld): Omit<CritResult, keyof Criterion | 'min_level'> {
  const at = w.attempts.filter((a) => a.person_id === person && a.form_id === c.ref && a.passed === true && a.released === true)
    .sort((a, b) => cmp(String(b.submitted_at ?? ''), String(a.submitted_at ?? '')) || cmp(String(b.id), String(a.id)));
  if (!at.length) return { status: 'missing', met: false, level: null, evidence: [] };
  return { status: 'met', met: true, level: null, evidence: [{ table: 'attempts', id: String(at[0].id), date: d10(at[0].submitted_at), level: null }] };
}
export const oppMatches = (ref: string, opp: Row | undefined) => !!opp && (ref.startsWith('kind:') ? opp.kind === ref.slice(5) : opp.id === ref);
function opportunityCrit(c: Criterion, person: string, w: McWorld): Omit<CritResult, keyof Criterion | 'min_level'> {
  const opps = new Map(w.opportunities.map((o) => [o.id, o]));
  const apps = w.opportunity_applications.filter((a) => a.person_id === person && a.status === 'completed' && oppMatches(c.ref, opps.get(a.opportunity_id)))
    .sort((a, b) => cmp(String(b.completed_at ?? ''), String(a.completed_at ?? '')) || cmp(String(b.id), String(a.id)));
  if (!apps.length) return { status: 'missing', met: false, level: null, evidence: [] };
  return { status: 'met', met: true, level: null, evidence: [{ table: 'opportunity_applications', id: String(apps[0].id), date: d10(apps[0].completed_at), level: null }] };
}
function skillCrit(c: Criterion, person: string, w: McWorld): Omit<CritResult, keyof Criterion | 'min_level'> {
  const min = Number(c.min_level) || 2;
  const st = w.person_skills.find((p) => p.id === `ps:${person}:${c.ref}` && p.active === true);
  if (!st) return { status: 'missing', met: false, level: 0, evidence: [] };
  const level = Number(st.level) || 0;
  const ev = [{ table: 'person_skills', id: String(st.id), date: null, level }];
  if (level < min) return { status: 'missing', met: false, level, evidence: ev };
  if (!(MC_RULES.skillBases as readonly string[]).includes(String(st.basis))) return { status: 'claimed', met: false, level, evidence: ev };
  return { status: 'met', met: true, level, evidence: ev };
}

/** Eligibility of `person` for definition `def` (any status; pages and RPCs pass the current version). Same as kafaa_mc_eligibility. */
export function eligibility(def: DefRow, person: string, w: McWorld): Eligibility {
  const criteria: CritResult[] = (def.criteria ?? []).map((c) => {
    const base = { key: c.key, kind: c.kind, ref: c.ref, min_level: c.kind === 'skill' ? Number(c.min_level) || 2 : null, label_en: c.label_en ?? '', label_ar: c.label_ar ?? '' };
    const r = c.kind === 'course' ? courseCrit(c, person, w) : c.kind === 'assessment' ? assessmentCrit(c, person, w) : c.kind === 'opportunity' ? opportunityCrit(c, person, w)
      : c.kind === 'skill' ? skillCrit(c, person, w) : { status: 'manual' as const, met: false, level: null, evidence: [] };
    return { ...base, ...r };
  });
  const components: CompResult[] = def.kind === 'stack' ? componentsOf(w.defs, def.code).map((cd) => {
    const a = latestAward(w.awards, person, cd.code);
    const status = a ? awardView(a, w.today, w.awards).status : 'none';
    return { code: cd.code, def_id: cd.id, title_en: cd.title_en, title_ar: cd.title_ar, award_id: a?.id ?? null, status, met: isValidView(status) };
  }) : [];
  const auto_met = criteria.every((c) => c.kind === 'manual' || c.met) && components.every((c) => c.met) && (def.kind !== 'stack' || components.length > 0);
  const manual = criteria.filter((c) => c.kind === 'manual').length;
  return { def_id: def.id, code: def.code, version: Number(def.version), kind: def.kind, person_id: person, criteria, components, auto_met, manual, eligible: auto_met && manual === 0 };
}

/**
 * Re-derive the result from the evidence it lists only (F32 acceptance "eligibility is reproducible from the listed evidence"):
 * every met criterion must be backed by listed rows that, on their own, satisfy the criterion.
 */
export function reproduce(e: Eligibility, rows: Record<string, Row[]>, def: DefRow, w: Pick<McWorld, 'today' | 'courses' | 'opportunities'>): boolean {
  const byId = (t: string) => new Map((rows[t] ?? []).map((r) => [String(r.id), r]));
  for (const c of e.criteria) {
    if (!c.met) continue;
    const ev = c.evidence[0];
    if (!ev) return false;
    const r = byId(ev.table).get(ev.id);
    if (!r || r.person_id !== e.person_id) return false;
    const crit = def.criteria.find((x) => x.key === c.key)!;
    const sub: McWorld = { today: w.today, defs: [], awards: [], courses: w.courses, opportunities: w.opportunities, training_records: [], attempts: [], opportunity_applications: [], person_skills: [] };
    (sub as unknown as Record<string, Row[]>)[ev.table] = [r];
    const again = eligibility({ ...def, kind: 'micro', criteria: [crit] }, e.person_id, sub).criteria[0];
    if (!again.met) return false;
  }
  return true;
}

// ───────────── definitions: validation and the copy check
/** Wording that would read as a regulator's certificate, licence or qualification (EN and AR). */
export const REGULATORY_WORDING = /\b(fanr|licen[cs]e[ds]?|licensing|certified|certification|certificate of competence|qualified operator|authori[sz]ation|regulator[- ]approved)\b|الهيئة الاتحادية للرقابة النووية|رخصة|ترخيص|مرخص|شهادة الهيئة|معتمد من الهيئة/i;
export const hasRegulatoryWording = (...texts: (string | null | undefined)[]) => texts.some((s) => typeof s === 'string' && REGULATORY_WORDING.test(s));
export const CODE_RE = /^MC-[A-Z0-9][A-Z0-9-]{1,30}$/;
export const KEY_RE = /^[a-z][a-z0-9_]{0,15}$/;
export interface DefInput {
  /** Revise this definition (a new draft version, or the open draft itself); omit for a new code. */
  id?: string | null;
  code: string; kind: 'micro' | 'stack'; area: string; level: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string;
  criteria: Criterion[]; stacks_into?: string | null; alignment: Alignment[]; role_ids: string[]; validity_months: number; hours?: number | null; change_reason?: string | null;
}
export interface DefWorld {
  defs: DefRow[]; courses: Row[]; forms: Row[]; opportunities: Row[]; skills: Row[]; competencies: Row[]; job_roles: Row[]; qual_standards: Row[];
}
const str = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
/** A JSON integer in [lo, hi] (strings never count; same as SQL jsonb_typeof = 'number'). */
const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const OPP_KINDS = ['project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research'];
/** Validate a definition draft. Same order and codes as kafaa_mc_validate_def. */
export function validateDef(x: DefInput, w: DefWorld): { code: 'ok' | 'invalid' | 'regulatory_wording' | 'security_restricted' | 'mirror_only'; message: string } {
  const bad = { code: 'invalid' as const, message: MCMSG.invalid_def };
  if (!x || typeof x !== 'object') return bad;
  if (typeof x.code !== 'string' || !CODE_RE.test(x.code)) return bad;
  if (!(DEF_KINDS as readonly string[]).includes(x.kind) || !(DEF_AREAS as readonly string[]).includes(x.area) || !(DEF_LEVELS as readonly string[]).includes(x.level)) return bad;
  if (!str(x.title_en, 3, 120) || !str(x.title_ar, 3, 120) || !str(x.summary_en, 10, 600) || !str(x.summary_ar, 10, 600)) return bad;
  if (!int(x.validity_months, MC_RULES.validityMin, MC_RULES.validityMax)) return bad;
  if (x.hours != null && !int(x.hours, 1, 400)) return bad;
  const crit = Array.isArray(x.criteria) ? x.criteria : null;
  if (!crit || crit.length > MC_RULES.maxCriteria || (x.kind === 'micro' && crit.length < 1)) return bad;
  const keys = new Set<string>();
  for (const c of crit) {
    if (!c || typeof c !== 'object' || typeof c.key !== 'string' || !KEY_RE.test(c.key) || keys.has(c.key)) return bad;
    keys.add(c.key);
    if (!(CRIT_KINDS as readonly string[]).includes(c.kind) || typeof c.ref !== 'string' || !str(c.label_en, 3, 160) || !str(c.label_ar, 3, 160)) return bad;
    if (c.kind === 'skill' && !int(c.min_level, 1, 4)) return bad;
  }
  const al = Array.isArray(x.alignment) ? x.alignment : null;
  if (!al || al.length > MC_RULES.maxAlignment || new Set(al.map((a) => a?.skill_id)).size !== al.length) return bad;
  for (const a of al) if (!a || typeof a.skill_id !== 'string' || !int(a.level, 1, MC_RULES.evidenceLevelMax)) return bad;
  const roles = Array.isArray(x.role_ids) ? x.role_ids : null;
  if (!roles || roles.length > MC_RULES.maxRoles || new Set(roles).size !== roles.length || roles.some((r) => typeof r !== 'string' || !w.job_roles.some((j) => j.id === r))) return bad;
  if (x.stacks_into != null && x.stacks_into !== '') {
    if (x.kind !== 'micro' || x.stacks_into === x.code || !w.defs.some((d) => d.code === x.stacks_into && d.kind === 'stack' && d.status !== 'retired')) return bad;
  }
  // copy check: never imply a FANR certificate, licence or qualification
  if (hasRegulatoryWording(x.title_en, x.title_ar, x.summary_en, x.summary_ar, ...crit.flatMap((c) => [c.label_en, c.label_ar]))) return { code: 'regulatory_wording', message: MCMSG.regulatory_wording };
  // mirrors never become criteria
  for (const c of crit) if (c.ref.startsWith('qs-') || c.ref.startsWith('lic-') || w.qual_standards.some((s) => s.id === c.ref)) return { code: 'mirror_only', message: MCMSG.mirror_only };
  const sec = new Set(w.competencies.filter((k) => k.domain === 'security').map((k) => String(k.id)));
  const secSkill = (id: string) => { const s = w.skills.find((k) => k.id === id); return !!s && (s.area === 'security' || sec.has(String(s.competency_id))); };
  for (const c of crit) {
    if (c.kind === 'course') {
      const co = w.courses.find((k) => k.id === c.ref);
      if (!co) return bad;
      if ((co.competency_ids ?? []).some((k: string) => sec.has(k))) return { code: 'security_restricted', message: MCMSG.security_restricted };
    } else if (c.kind === 'assessment') {
      const f = w.forms.find((k) => k.id === c.ref);
      if (!f) return bad;
      const co = f.course_id ? w.courses.find((k) => k.id === f.course_id) : null;
      if (co && (co.competency_ids ?? []).some((k: string) => sec.has(k))) return { code: 'security_restricted', message: MCMSG.security_restricted };
    } else if (c.kind === 'opportunity') {
      if (c.ref.startsWith('kind:') ? !OPP_KINDS.includes(c.ref.slice(5)) : !w.opportunities.some((o) => o.id === c.ref)) return bad;
    } else if (c.kind === 'skill') {
      if (!w.skills.some((k) => k.id === c.ref)) return bad;
      if (secSkill(c.ref)) return { code: 'security_restricted', message: MCMSG.security_restricted };
    } else if (c.ref !== '') return bad; // manual criteria carry no reference
  }
  for (const a of al) {
    if (!w.skills.some((k) => k.id === a.skill_id)) return bad;
    if (secSkill(a.skill_id)) return { code: 'security_restricted', message: MCMSG.security_restricted };
  }
  return { code: 'ok', message: 'ok' };
}

// ───────────── the signed credential (F04 issuer)
export interface McCredentialInput {
  slug: string;
  def: Pick<DefRow, 'code' | 'version' | 'kind' | 'title_en' | 'title_ar' | 'summary_en' | 'criteria'>;
  holderInitials: string;
  issuedOn: string;
  validTo: string | null;
  /** Skills the credential aligns to (code and English name), in skill sort order. */
  alignment: { id: string; code: string; name_en: string }[];
  /** Public slugs and titles of the component credentials (stacks), by code. */
  components: { slug: string; code: string; title_en: string }[];
  keyId: KeyId;
}
/** Unsigned OpenBadgeCredential for a micro-credential award. Same object as kafaa_mc_credential() in SQL. */
export function buildMicrocredCredential(i: McCredentialInput): Credential {
  const d = (x: string) => `${x.slice(0, 10)}T00:00:00Z`;
  const name = `${i.def.code} ${i.def.title_en}`;
  const stack = i.def.kind === 'stack';
  const labels = (i.def.criteria ?? []).map((c) => c.label_en);
  const labelsAr = (i.def.criteria ?? []).map((c) => c.label_ar);
  const partsEn = [...(stack ? [`holds every component micro-credential (${i.components.map((c) => c.code).join(', ')})`] : []), ...labels];
  const partsAr = [...(stack ? [`يحمل جميع الاعتمادات المصغّرة المكوِّنة (${i.components.map((c) => c.code).join('، ')})`] : []), ...labelsAr];
  const cred: Credential = {
    '@context': CONTEXTS,
    id: `urn:kafaa:badge:${i.slug}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name,
    nameAr: `${i.def.code} ${i.def.title_ar}`,
    issuer: { id: ISSUER_ID, type: ['Profile'], name: ISSUER_NAME, url: ISSUER_URL },
    validFrom: d(i.issuedOn),
    credentialSubject: {
      type: ['AchievementSubject'],
      holderInitials: i.holderInitials,
      achievement: {
        id: `urn:kafaa:microcredential:${i.def.code}:v${i.def.version}`,
        type: ['Achievement'],
        achievementType: 'MicroCredential',
        humanCode: i.def.code,
        name: i.def.title_en,
        nameAr: i.def.title_ar,
        description: i.def.summary_en,
        criteria: { narrative: `${stack ? "Kafa'a stacked micro-credential" : "Kafa'a micro-credential"} ${name}: ${partsEn.join('; ')}.` },
        criteriaAr: `${stack ? 'اعتماد مصغّر مركّب من كفاءة' : 'اعتماد مصغّر من كفاءة'} ${i.def.code} ${i.def.title_ar}: ${partsAr.join('؛ ')}.`,
        alignment: i.alignment.map((a) => ({ type: ['Alignment'], targetType: 'ceterms:Skill', targetFramework: "Kafa'a skills catalogue", targetCode: a.code, targetName: a.name_en, targetUrl: `urn:kafaa:skill:${a.id}` })),
      },
    },
    evidence: [
      ...i.components.map((c) => ({ id: `urn:kafaa:badge:${c.slug}`, type: ['Evidence'], name: `${c.code} ${c.title_en}`, narrative: 'Component micro-credential, verifiable on its own.' })),
      ...(i.def.criteria ?? []).map((c) => ({
        id: `urn:kafaa:evidence:${i.slug}:${c.key}`, type: ['Evidence'], name: c.label_en,
        narrative: c.kind === 'manual' ? `Confirmed by a Kafa'a training manager on ${i.issuedOn.slice(0, 10)}.` : `Met on ${i.issuedOn.slice(0, 10)}, checked by the Kafa'a eligibility rules.`,
      })),
    ],
    kafaaNotice: NOTICE_EN,
    proof: { type: 'DataIntegrityProof', cryptosuite: CRYPTOSUITE, created: d(i.issuedOn), verificationMethod: verificationMethod(i.keyId), proofPurpose: 'assertionMethod' },
  };
  if (i.validTo) cred.validUntil = d(i.validTo);
  return cred;
}

/** Skills a definition aligns to, in catalogue order, never security skills; levels capped for F01 evidence. */
export function alignedSkills(def: Pick<DefRow, 'alignment'>, skills: Row[], competencies: Row[]): { id: string; code: string; name_en: string; name_ar: string; level: number; sort: number }[] {
  const sec = new Set(competencies.filter((k) => k.domain === 'security').map((k) => String(k.id)));
  const out: { id: string; code: string; name_en: string; name_ar: string; level: number; sort: number }[] = [];
  for (const a of def.alignment ?? []) {
    const s = skills.find((k) => k.id === a.skill_id);
    if (!s || s.area === 'security' || sec.has(String(s.competency_id))) continue;
    out.push({ id: s.id, code: s.code, name_en: s.name_en, name_ar: s.name_ar, level: Math.min(Number(a.level) || 1, MC_RULES.evidenceLevelMax), sort: Number(s.sort) || 0 });
  }
  return out.sort((a, b) => a.sort - b.sort || cmp(a.id, b.id));
}

/** Snapshot stored on the award: criteria results with their evidence (manual ones marked met by the approver). */
export function evidenceSnapshot(e: Eligibility, approvedBy: string | null, on: string): Row[] {
  return [
    ...e.criteria.map((c) => (c.kind === 'manual' && approvedBy
      ? { key: c.key, kind: c.kind, ref: c.ref, status: 'met', evidence: [{ table: 'microcred_awards', id: 'approval', date: on, level: null }] }
      : { key: c.key, kind: c.kind, ref: c.ref, status: c.status, evidence: c.evidence })),
    ...e.components.map((c) => ({ key: `part:${c.code}`, kind: 'microcred', ref: c.code, status: c.met ? 'met' : 'missing', evidence: c.award_id ? [{ table: 'microcred_awards', id: c.award_id, date: null, level: null }] : [] })),
  ];
}

/** Catalogue helper: which roles a definition says it is useful for (F05 "what it unlocks"). */
export const unlocks = (def: Pick<DefRow, 'role_ids'>, roles: Row[]) => (def.role_ids ?? []).map((id) => roles.find((r) => r.id === id)).filter(Boolean);

/** Deterministic seed slug (scripts/seed/ext/f32-microcred.mjs and tests). */
export const MC_SLUG_PREFIX = 'mc';
