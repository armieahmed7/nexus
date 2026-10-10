/**
 * FS24 (future skills, wave C · E4, module M02): scale mapping and the "Authority" recognition. Pure and import-free.
 *
 *   scale map    kafaa_scale_maps: one `scale` row per external framework (its levels, from the source) and one `map` row per Kafa'a
 *                band (not yet, 1-4, Authority) giving the external level range and how good the fit is (exact, close, loose).
 *                Every row cites its framework source and an as-of date.
 *   Authority    kafaa_authority_recognitions: recognition above Expert by a panel. Never a fifth level, never gamified, never a
 *                change to the F01 skill level. Maker-checker: the person who proposes it (training manager or HR director, with the
 *                panel convened) is never the HR director who decides it; a decision is "recognised" or "not yet".
 *
 * SQL mirror (supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql): kafaa_ar_check_propose = checkPropose,
 * kafaa_ar_check_decide = checkDecide, kafaa_ar_message = AUTH_MSG.
 */
export const SCALE_FRAMEWORKS = ['sfia9', 'skillsfuture', 'digcomp', 'unesco_ai', 'uae_nqf'] as const;
export type ScaleFramework = (typeof SCALE_FRAMEWORKS)[number];
/** Kafa'a bands: the four F01 levels, the "not yet" state below them and the Authority recognition above Expert (not a level). */
export const BANDS = ['not_yet', 'l1', 'l2', 'l3', 'l4', 'authority'] as const;
export type Band = (typeof BANDS)[number];
export const FITS = ['exact', 'close', 'loose', 'none'] as const;
export type Fit = (typeof FITS)[number];
export const bandOfLevel = (level: number | null | undefined): Band => (level && level >= 1 && level <= 4 ? (`l${Math.round(level)}` as Band) : 'not_yet');

export interface ScaleRowLite {
  id: string;
  framework: string;
  row_kind: string;
  band?: string | null;
  ext_from?: number | null;
  ext_to?: number | null;
  fit?: string | null;
  levels?: { n: number; en: string; ar: string }[] | unknown;
  source_url: string;
  as_of: string;
}
/** External levels a Kafa'a band maps to in one framework ("3", "5-6", "-" when none). */
export function extRange(r: Pick<ScaleRowLite, 'ext_from' | 'ext_to'> | null | undefined): string {
  if (!r || r.ext_from == null) return '';
  return r.ext_to == null || r.ext_to === r.ext_from ? String(r.ext_from) : `${r.ext_from}-${r.ext_to}`;
}
/** Every scale-map row cites an https source and an as-of date (FS24 acceptance). */
export const rowCitesSource = (r: Pick<ScaleRowLite, 'source_url' | 'as_of'>): boolean =>
  /^https:\/\/[^\s/$.?#][^\s]*$/i.test(r.source_url ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(String(r.as_of ?? '').slice(0, 10));

/**
 * FS08 data-only coupling: does a crosswalk alignment's level map follow the published scale map? For each Kafa'a level in the
 * alignment's map, the external value ("3", "5-6") must equal the published range for that band. Frameworks without a scale map
 * row are 'n/a'.
 */
export function alignmentFollowsMap(levelMap: Record<string, string> | null | undefined, maps: ScaleRowLite[], framework: string): 'follows' | 'differs' | 'n/a' | 'empty' {
  const rows = maps.filter((m) => m.framework === framework && m.row_kind === 'map');
  if (!rows.length) return 'n/a';
  const entries = Object.entries(levelMap ?? {});
  if (!entries.length) return 'empty';
  for (const [k, v] of entries) {
    const r = rows.find((m) => m.band === `l${k}`);
    if (!r || extRange(r).replace(/\s/g, '') !== String(v).replace(/\s/g, '')) return 'differs';
  }
  return 'follows';
}

// ───────────── Authority recognition
export const AUTH_STATUSES = ['proposed', 'recognised', 'not_yet', 'withdrawn'] as const;
export type AuthStatus = (typeof AUTH_STATUSES)[number];
export const AUTH_ACTIONS = ['propose', 'approve', 'not_yet', 'withdraw'] as const;
export type AuthAction = (typeof AUTH_ACTIONS)[number];
/** Panel seats (role cards, never named people). */
export const PANEL_ROLES = ['hr_director', 'training_manager', 'line_manager', 'skill_owner', 'senior_instructor', 'external_peer'] as const;
export const PANEL_MIN = 3;
export const PANEL_MAX = 6;
export const CITATION_MIN = 20;
export const CITATION_MAX = 400;
export const NOTE_MIN = 10;
export const NOTE_MAX = 400;
/** A recognition is re-confirmed by a panel every three years. */
export const REVIEW_YEARS = 3;
/** Roles that may propose (convene the panel). The decision is the HR director's. */
export const PROPOSER_ROLES = ['training_manager', 'hr_director'] as const;
export const DECIDER_ROLE = 'hr_director';

export interface ProposeInput {
  action?: unknown;
  person_id?: unknown;
  skill_id?: unknown;
  panel?: unknown;
  citation_en?: unknown;
  citation_ar?: unknown;
}
export interface ProposeCtx {
  me: string;
  person: { id: string; kind: string; status: string } | null | undefined;
  skill: { id: string; area: string; fs_area?: string | null; lifecycle?: string | null } | null | undefined;
  /** The person's active F01 level on the skill (0 when none). */
  level: number;
  /** An open (proposed) or current (recognised) row exists for the person and skill. */
  open: boolean;
}
const s = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
export type ProposeCode = 'ok' | 'person' | 'self' | 'skill' | 'restricted' | 'obsolete' | 'not_expert' | 'conflict' | 'panel' | 'citation';

/** checkPropose(): 'ok' or the first failing code (same order as SQL kafaa_ar_check_propose). */
export function checkPropose(input: ProposeInput, ctx: ProposeCtx): ProposeCode {
  const p = ctx.person;
  if (!p || p.kind !== 'staff' || p.status !== 'active') return 'person';
  if (p.id === ctx.me) return 'self';
  const k = ctx.skill;
  if (!k) return 'skill';
  if (k.area === 'security' || k.fs_area === 'cyber_hygiene') return 'restricted';
  if (k.lifecycle === 'obsolete') return 'obsolete';
  if (ctx.level !== 4) return 'not_expert';
  if (ctx.open) return 'conflict';
  const panel = input.panel;
  if (!Array.isArray(panel) || panel.length < PANEL_MIN || panel.length > PANEL_MAX || panel.some((x) => typeof x !== 'string' || !(PANEL_ROLES as readonly string[]).includes(x)) || new Set(panel).size !== panel.length) return 'panel';
  const en = s(input.citation_en);
  const ar = s(input.citation_ar);
  if (en.length < CITATION_MIN || ar.length < CITATION_MIN || en.length > CITATION_MAX || ar.length > CITATION_MAX) return 'citation';
  return 'ok';
}

export type DecideCode = 'ok' | 'not_found' | 'state' | 'decider' | 'maker_checker' | 'note';
/** checkDecide(): for approve / not_yet / withdraw on an existing row (same order as SQL kafaa_ar_check_decide). */
export function checkDecide(action: string, row: { status: string; proposed_by: string } | null | undefined, ctx: { me: string; isDecider: boolean; note: unknown }): DecideCode {
  if (!row) return 'not_found';
  if (action === 'withdraw') {
    if (row.status !== 'proposed' && row.status !== 'recognised') return 'state';
    if (!ctx.isDecider && !(row.status === 'proposed' && row.proposed_by === ctx.me)) return 'decider';
  } else {
    if (row.status !== 'proposed') return 'state';
    if (!ctx.isDecider) return 'decider';
    if (row.proposed_by === ctx.me) return 'maker_checker';
  }
  const n = s(ctx.note);
  const needNote = action !== 'approve';
  if ((needNote && n.length < NOTE_MIN) || n.length > NOTE_MAX) return 'note';
  return 'ok';
}

export const AUTH_MSG: Record<string, string> = {
  not_signed_in: 'Sign in to work on Authority recognitions',
  forbidden: 'Authority recognitions are proposed by the training manager or the HR director and decided by the HR director',
  action: 'Choose propose, approve, not yet or withdraw',
  person: 'Choose an active member of staff',
  self: 'You cannot propose yourself',
  skill: 'Skill not found',
  restricted: 'Security and cyber-hygiene skills are not recognised individually: they follow the security career path',
  obsolete: 'This skill is obsolete',
  not_expert: 'Authority recognises people already at Expert (level 4) on the skill; it is never a fifth level',
  conflict: 'This person already has an open or current Authority recognition on this skill',
  panel: 'Name a panel of 3 to 6 different seats from the list',
  citation: 'Write the citation in English and Arabic (20 to 400 characters each)',
  not_found: 'Recognition not found',
  state: 'This recognition is not in a state that allows that action',
  decider: 'Only the HR director decides or withdraws an Authority recognition',
  maker_checker: 'The person who proposed it cannot decide it: a second approver is needed',
  note: 'Give a note of 10 to 400 characters (required for "not yet" and withdrawals)',
};
export const authResultCode = (c: string): string =>
  ({ person: 'invalid', self: 'maker_checker', skill: 'not_found', restricted: 'restricted', obsolete: 'obsolete', not_expert: 'not_eligible', conflict: 'conflict', panel: 'invalid', citation: 'invalid',
    not_found: 'not_found', state: 'invalid', decider: 'forbidden', maker_checker: 'maker_checker', note: 'invalid' } as Record<string, string>)[c] ?? 'invalid';

export const authorityId = (personId: string, skillId: string, n: number) => `ar:${personId}:${skillId}:${n}`;
/** ISO date + whole years (29 Feb -> 28 Feb). */
export function addYearsIso(iso: string, years: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${String(y + years).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
/** Review state of a current recognition: due within 180 days, or overdue. */
export function authorityReview(reviewDue: string | null | undefined, today: string): 'none' | 'ok' | 'due_soon' | 'overdue' {
  if (!reviewDue) return 'none';
  const d = Date.parse(`${reviewDue.slice(0, 10)}T00:00:00Z`);
  const t = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (d < t) return 'overdue';
  return d - t <= 180 * 86400000 ? 'due_soon' : 'ok';
}
