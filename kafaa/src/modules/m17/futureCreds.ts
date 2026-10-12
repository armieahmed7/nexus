/**
 * FS31 Future-skills micro-credentials with a strategic tier (FS wave D · E3, module M17): pure rules shared by the pages, the
 * LocalBackend (backend/local.fs4.ts), the seed builder (scripts/seed/ext/fs31-future-credentials.mjs) and, line for line, the SQL in
 * supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql (kafaa_fc_*). Import-free apart from microcred.ts
 * (itself import-free apart from the F04 issuer), so node scripts load it directly.
 *
 *   strategic tier   microcred_defs.strategic: holding a current strategic credential (active or inside its renewal window) grants
 *                    eligibility for the named future gigs and rotations (microcred_unlocks: the gig or rotation names the credential).
 *                    IBM pattern: a badge tier with consequences; the correlation with internal moves is reported (never causation).
 *   takes you        "Where this credential takes you": the roles the definition is useful for, and the gigs and rotations that name it.
 *   satisfiable      every criterion has at least one route through existing or FS19 content (a course, an FS21 bank, an FS22
 *                    task, an opportunity, or a course / bank / task that evidences the skill at the level asked).
 * Micro-credentials are internal recognition: never a FANR certificate, licence or qualification.
 */
import { awardView, latestAward, hasMinLevel, type AwardRow, type AwardView, type Criterion, type DefRow } from './microcred.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Reason = { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }>; ref?: { table: string; id: string } };
const R = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m17.reasons.${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The FS31 definitions (codes) seeded by scripts/seed/ext/fs31-future-credentials.mjs. */
export const FS31_CODES = ['MC-AI-ASSURER', 'MC-DATA-DECISIONS', 'MC-TWINS', 'MC-SMR-FOUND', 'MC-CLEAN-ENERGY', 'MC-CYBER-HYGIENE', 'MC-QUESTION-AI', 'MC-SYSTEMS'] as const;
export const FUTURE_AREAS = ['ai_data', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'transversal'] as const;
export const UNLOCK_KINDS = ['opportunity', 'rotation'] as const;
export type UnlockKind = (typeof UNLOCK_KINDS)[number];
export const FC_RULES = { noteMin: 3, noteMax: 300, maxUnlocksPerDef: 8, reportWindowDays: 365 } as const;

/** Refusal messages: identical in SQL. */
export const FC_MSG = {
  not_signed_in: 'Sign in to manage micro-credentials',
  forbidden: 'Only framework owners (training managers and admins) can manage the strategic tier',
  not_found_def: 'Micro-credential not found or not published',
  note_required: 'Add a short reason (3 to 300 characters)',
  no_change: 'Nothing changes: the micro-credential is already in that tier',
  tier_set: 'Strategic tier updated',
  invalid_unlock: 'Choose a published micro-credential and an existing gig or rotation',
  security_restricted: 'Security placements are career-path only and cannot be unlocked by a credential',
  too_many: 'A micro-credential can name at most 8 gigs and rotations',
  unlock_saved: 'Unlock saved',
  report_forbidden: 'Only the training manager, HR and auditors read the strategic-tier report',
} as const;

export interface UnlockRow { id: string; def_code: string; target_kind: UnlockKind; target_id: string; note_en: string; note_ar: string; active: boolean; set_by?: string | null; set_at?: string | null }
export interface UnlockWorld {
  today: string;
  defs: DefRow[];
  awards: AwardRow[];
  unlocks: UnlockRow[];
  opportunities: Row[];
  rotation_templates: Row[];
}
export interface UnlockView {
  id: string; def_code: string; def_title_en: string; def_title_ar: string; target_kind: UnlockKind; target_id: string; title_en: string; title_ar: string; target_status: string;
  strategic: boolean; held: AwardView | 'none'; unlocked: boolean; award_id: string | null; reasons: Reason[];
}

/** The current (published) definition of a code. */
const currentOf = (defs: DefRow[], code: string) => defs.find((d) => d.code === code && d.status === 'current') ?? null;
/** My view of a code: the latest awarded row's effective status, else 'none'. */
export function heldView(w: Pick<UnlockWorld, 'awards' | 'today'>, person: string, code: string): { view: AwardView | 'none'; award: AwardRow | null } {
  const a = latestAward(w.awards, person, code);
  return { view: a ? awardView(a, w.today, w.awards).status : 'none', award: a };
}
const counts = (v: AwardView | 'none') => v === 'active' || v === 'renewal_due';
export function targetOf(kind: string, id: string, w: Pick<UnlockWorld, 'opportunities' | 'rotation_templates'>): Row | null {
  return (kind === 'opportunity' ? w.opportunities : kind === 'rotation' ? w.rotation_templates : []).find((x: Row) => x.id === id) ?? null;
}

/**
 * Every active unlock with my state: unlocked when the definition is current and strategic and I hold it (active or inside the
 * renewal window). Sorted by credential code, kind, target id. Same as kafaa_fc_unlocks(person, today).
 */
export function unlocksFor(person: string, w: UnlockWorld): UnlockView[] {
  const out: UnlockView[] = [];
  const list = w.unlocks.filter((u) => u.active).sort((a, b) => cmp(a.def_code, b.def_code) || cmp(a.target_kind, b.target_kind) || cmp(a.target_id, b.target_id));
  for (const u of list) {
    const def = currentOf(w.defs, u.def_code);
    const tgt = targetOf(u.target_kind, u.target_id, w);
    if (!def || !tgt) continue;
    const strategic = def.strategic === true;
    const { view, award } = heldView(w, person, u.def_code);
    const unlocked = strategic && counts(view);
    const name = { en: `${def.code} ${def.title_en}`, ar: `${def.code} ${def.title_ar}` };
    const reasons: Reason[] = [];
    if (!strategic) reasons.push(R('fc_tier_off', { code: name }));
    else if (unlocked) reasons.push(R('fc_unlocked', { code: name }, award ? { table: 'microcred_awards', id: award.id } : undefined));
    else if (view === 'expired' || view === 'revoked') reasons.push(R('fc_lapsed', { code: name }, award ? { table: 'microcred_awards', id: award.id } : undefined));
    else reasons.push(R('fc_locked', { code: name }));
    reasons.push(R(`fc_target_${u.target_kind}`, { title: { en: String(tgt.title_en ?? ''), ar: String(tgt.title_ar ?? '') } }, { table: u.target_kind === 'opportunity' ? 'opportunities' : 'rotation_templates', id: u.target_id }));
    out.push({
      id: u.id, def_code: u.def_code, def_title_en: def.title_en, def_title_ar: def.title_ar, target_kind: u.target_kind, target_id: u.target_id,
      title_en: String(tgt.title_en ?? ''), title_ar: String(tgt.title_ar ?? ''), target_status: String(tgt.status ?? ''), strategic, held: view, unlocked, award_id: award?.id ?? null, reasons,
    });
  }
  return out;
}
/**
 * Eligibility rule extension (the F08/F15 hand-off): a gig or rotation that names a strategic credential is open to its holders.
 * `named` = some active unlock of a current strategic definition names the target; `unlocked` = I hold one of those credentials.
 * A target that names no strategic credential is open as before. Same as kafaa_fc_target_check(person, kind, target).
 */
export function targetCheck(person: string, kind: UnlockKind, targetId: string, w: UnlockWorld): { named: boolean; unlocked: boolean; codes: string[]; held: string[] } {
  const codes = [...new Set(w.unlocks.filter((u) => u.active && u.target_kind === kind && u.target_id === targetId && currentOf(w.defs, u.def_code)?.strategic === true).map((u) => u.def_code))].sort(cmp);
  const held = codes.filter((c) => counts(heldView(w, person, c).view));
  return { named: codes.length > 0, unlocked: held.length > 0, codes, held };
}

/** "Where this credential takes you": roles, gigs and rotations (active unlocks only), by catalogue order then id. */
export function takesYou(def: Pick<DefRow, 'code' | 'role_ids'>, w: Pick<UnlockWorld, 'unlocks' | 'opportunities' | 'rotation_templates'> & { job_roles: Row[] }) {
  const roles = (def.role_ids ?? []).map((id) => w.job_roles.find((r) => r.id === id)).filter(Boolean) as Row[];
  const named = w.unlocks.filter((u) => u.active && u.def_code === def.code).sort((a, b) => cmp(a.target_kind, b.target_kind) || cmp(a.target_id, b.target_id));
  const gigs = named.filter((u) => u.target_kind === 'opportunity').map((u) => ({ unlock: u, target: targetOf('opportunity', u.target_id, w) })).filter((x) => x.target);
  const rotations = named.filter((u) => u.target_kind === 'rotation').map((u) => ({ unlock: u, target: targetOf('rotation', u.target_id, w) })).filter((x) => x.target);
  return { roles, gigs, rotations };
}

// ───────────── satisfiability ("every definition is satisfiable through existing or FS19 content")
/** twin_scenarios (FS40, wave E integration) is optional: a published digital-twin drill is a route to the skills it evidences (level <= 2). */
export interface ContentWorld { courses: Row[]; course_skill_links: Row[]; adaptive_banks: Row[]; performance_tasks: Row[]; opportunities: Row[]; skills: Row[]; twin_scenarios?: Row[] }
export interface Route { kind: 'course' | 'adaptive' | 'task' | 'opportunity' | 'manual' | 'twin'; id: string; level: number | null; fs19: boolean }
const isFs19 = (courseId: string) => courseId.startsWith('c-fs-');
/** The content routes that can satisfy one criterion (empty = not satisfiable). */
export function routesFor(c: Criterion, w: ContentWorld): Route[] {
  const min = Number(c.min_level) || 2;
  const out: Route[] = [];
  if (c.kind === 'manual') return [{ kind: 'manual', id: '', level: null, fs19: false }];
  if (c.kind === 'course') { if (w.courses.some((x) => x.id === c.ref)) out.push({ kind: 'course', id: c.ref, level: null, fs19: isFs19(c.ref) }); return out; }
  if (c.kind === 'assessment') return out; // F32 assessment forms are reached through their course (checked by validateDef)
  if (c.kind === 'adaptive') { if (w.adaptive_banks.some((b) => b.id === c.ref && b.status === 'active' && Number(b.evidence_cap ?? 3) >= 1)) out.push({ kind: 'adaptive', id: c.ref, level: min, fs19: false }); return out; }
  if (c.kind === 'task') { if (w.performance_tasks.some((t) => t.id === c.ref && t.status === 'active')) out.push({ kind: 'task', id: c.ref, level: null, fs19: false }); return out; }
  if (c.kind === 'opportunity') {
    for (const o of w.opportunities) if (o.status === 'open' && (c.ref.startsWith('kind:') ? o.kind === c.ref.slice(5) : o.id === c.ref)) out.push({ kind: 'opportunity', id: o.id, level: null, fs19: false });
    return out.sort((a, b) => cmp(a.id, b.id));
  }
  // skill: courses linked at the level (FS19 course_skill_links) or keyed to the skill (F01 evidence keys), banks and tasks that evidence it
  const skill = w.skills.find((s) => s.id === c.ref);
  for (const l of w.course_skill_links) if (l.skill_id === c.ref && Number(l.level) >= min) out.push({ kind: 'course', id: l.course_id, level: Number(l.level), fs19: isFs19(l.course_id) });
  // F01/F04 courseAlignment: a course evidences a core skill of its competency, or a skill keyed to it, up to level 2 (qualifying) or 1
  if (skill) for (const co of w.courses) {
    if (out.some((r) => r.id === co.id)) continue;
    const cap = co.qualifying ? 2 : 1;
    const lvl = Math.max(skill.core && (co.competency_ids ?? []).includes(skill.competency_id) ? cap : 0, (skill.evidence_keys ?? []).includes(co.id) ? Math.min(Number(skill.key_level) || 1, cap) : 0);
    if (lvl >= min) out.push({ kind: 'course', id: co.id, level: lvl, fs19: isFs19(co.id) });
  }
  for (const b of w.adaptive_banks) if (b.status === 'active' && (b.skill_ids ?? []).includes(c.ref) && Number(b.evidence_cap ?? 3) >= min) out.push({ kind: 'adaptive', id: b.id, level: Number(b.evidence_cap ?? 3), fs19: false });
  for (const t of w.performance_tasks) if (t.status === 'active' && (t.skill_ids ?? []).includes(c.ref) && Number(t.evidence_level ?? 2) >= min) out.push({ kind: 'task', id: t.id, level: Number(t.evidence_level ?? 2), fs19: false });
  // FS40 (wave E integration): published digital-twin drills evidence their skills at the drill level, never above 2 (= m31 twinDrillsFor)
  for (const d of [...(w.twin_scenarios ?? [])].sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.id, b.id)))
    if (d.status === 'published' && d.listed !== false && (d.skill_ids ?? []).includes(c.ref) && Math.min(Number(d.level) || 1, 2) >= min) out.push({ kind: 'twin', id: d.id, level: Math.min(Number(d.level) || 1, 2), fs19: false });
  return out;
}
export function satisfiability(def: Pick<DefRow, 'criteria'>, w: ContentWorld): { ok: boolean; missing: string[]; routes: Record<string, Route[]> } {
  const routes: Record<string, Route[]> = {};
  for (const c of def.criteria ?? []) routes[c.key] = routesFor(c, w);
  const missing = Object.entries(routes).filter(([, r]) => !r.length).map(([k]) => k);
  return { ok: missing.length === 0, missing, routes };
}
export const minLevelOf = (c: Criterion) => (hasMinLevel(c.kind) ? Number(c.min_level) || 2 : null);

// ───────────── tier and unlock input checks (same order and codes as kafaa_set_microcred_strategic / kafaa_set_credential_unlock)
export interface UnlockInput { id?: string | null; def_code: string; target_kind: string; target_id: string; note_en: string; note_ar: string; active?: boolean }
const str = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
export function unlockProblem(x: UnlockInput, w: Pick<UnlockWorld, 'defs' | 'unlocks' | 'opportunities' | 'rotation_templates'>): 'ok' | 'invalid' | 'security_restricted' | 'too_many' {
  if (!x || typeof x !== 'object') return 'invalid';
  if (!(UNLOCK_KINDS as readonly string[]).includes(x.target_kind) || typeof x.def_code !== 'string' || typeof x.target_id !== 'string') return 'invalid';
  if (!currentOf(w.defs, x.def_code)) return 'invalid';
  const tgt = targetOf(x.target_kind, x.target_id, w);
  if (!tgt) return 'invalid';
  if (!str(x.note_en, FC_RULES.noteMin, FC_RULES.noteMax) || !str(x.note_ar, FC_RULES.noteMin, FC_RULES.noteMax)) return 'invalid';
  // security placements stay career-path only: never a target (rotation families or opportunity skill areas named security)
  if ((tgt.eligible_families ?? []).some((f: string) => (SECURITY_FAMILIES as readonly string[]).includes(f)) || (tgt.skills_gained ?? []).some((s: string) => /^sk-sa-/.test(s))) return 'security_restricted';
  const id = x.id || unlockId(x.def_code, x.target_kind as UnlockKind, x.target_id);
  if (x.active !== false && w.unlocks.filter((u) => u.active && u.def_code === x.def_code && u.id !== id).length >= FC_RULES.maxUnlocksPerDef) return 'too_many';
  return 'ok';
}
/** Job families whose placements stay at career-path level (security, cyber, safeguards). */
export const SECURITY_FAMILIES = ['security', 'cyber', 'safeguards'] as const;
export const unlockId = (code: string, kind: UnlockKind, target: string) => `mcu:${code}:${kind}:${target}`;

// ───────────── strategic-tier report (correlation with internal moves, never causation; groups under 10 suppressed)
export interface ReportWorld {
  today: string; defs: DefRow[]; awards: AwardRow[]; people: Row[]; opportunity_applications: Row[]; rotation_placements: Row[];
}
export interface ReportRow { code: string; title_en: string; title_ar: string; holders: number | null; moved: number | null; rate: number | null; suppressed: boolean }
const d10 = (v: unknown) => (v == null || v === '' ? null : String(v).slice(0, 10));
const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
/** Internal move dates of a person: completed or selected opportunities, started rotation placements. */
export function moveDates(person: string, w: Pick<ReportWorld, 'opportunity_applications' | 'rotation_placements'>): string[] {
  const out: string[] = [];
  for (const a of w.opportunity_applications) {
    if (a.person_id !== person) continue;
    const d = a.status === 'completed' ? d10(a.completed_at) : a.status === 'selected' ? d10(a.decided_at) : null;
    if (d) out.push(d);
  }
  for (const p of w.rotation_placements) if (p.person_id === person && (p.status === 'active' || p.status === 'signed_off') && d10(p.starts_on)) out.push(d10(p.starts_on)!);
  return out.sort();
}
const MIN = 10;
const pct = (a: number, b: number) => (b > 0 ? Math.round((1000 * a) / b) / 10 : 0);
/**
 * Per current strategic credential: holders now (active or renewal due), holders with an internal move on or after their issue date,
 * and the baseline (active staff holding no strategic credential, moves in the last 365 days). Same as kafaa_fc_report(today).
 */
export function strategicReport(w: ReportWorld): { rows: ReportRow[]; baseline: { people: number | null; moved: number | null; rate: number | null; suppressed: boolean }; window_days: number } {
  const staff = w.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => String(p.id)).sort(cmp);
  const strategic = w.defs.filter((d) => d.status === 'current' && d.strategic === true).sort((a, b) => cmp(a.code, b.code));
  const anyHolder = new Set<string>();
  const rows: ReportRow[] = [];
  for (const d of strategic) {
    let holders = 0, moved = 0;
    for (const pid of staff) {
      const { view, award } = heldView(w, pid, d.code);
      if (!counts(view) || !award) continue;
      holders++; anyHolder.add(pid);
      const since = d10(award.issued_on) ?? '';
      if (moveDates(pid, w).some((x) => x >= since)) moved++;
    }
    const sup = holders < MIN;
    rows.push({ code: d.code, title_en: d.title_en, title_ar: d.title_ar, holders: sup ? null : holders, moved: sup ? null : moved, rate: sup ? null : pct(moved, holders), suppressed: sup });
  }
  const from = addDays(w.today, -FC_RULES.reportWindowDays);
  const base = staff.filter((p) => !anyHolder.has(p));
  const bMoved = base.filter((p) => moveDates(p, w).some((x) => x >= from && x <= w.today)).length;
  const bSup = base.length < MIN;
  return { rows, baseline: { people: bSup ? null : base.length, moved: bSup ? null : bMoved, rate: bSup ? null : pct(bMoved, base.length), suppressed: bSup }, window_days: FC_RULES.reportWindowDays };
}
