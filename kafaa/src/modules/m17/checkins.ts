/**
 * F10 Skill check-ins (360) and F11 Team capability heatmap: pure rules shared by the pages, the LocalBackend RPCs
 * (backend/local.ts), the seed builder (scripts/seed/ext/f10-checkins.mjs) and the tests. The SQL mirror lives in
 * supabase/migrations/20261009121001_kafaa_w2e1_checkins.sql (kafaa_request_checkin, kafaa_submit_rating,
 * kafaa_validate_checkin, kafaa_withdraw_checkin, kafaa_checkin_peers, kafaa_checkin_inbox, kafaa_checkin_calibration,
 * kafaa_team_coverage, kafaa_set_team_target); scripts/validate/w2e1-checkins.mjs proves SQL = TS on the seed. Change both.
 *
 *   checkinBlock      a skill that cannot be checked in: security (status only) or qualification-only (a skill keyed to a
 *                     qualification standard, or one this person holds by a current qualification record)
 *   lineManagerOf     people.manager_id, else the narrowest active `manager` assignment covering the person
 *   peerPool          same team (or same job family when the person has no team), never the line manager or anyone who
 *                     holds skills_profile Scope over the person (they would see every answer)
 *   groups / coverage group keys team:<id> and family:<id>; coverage per skill against the target (default: 2 people at the
 *                     skill's key level), counting verified, evidenced and validated levels only; single point of failure
 *                     when exactly one person reaches the target level
 *   crews             counts per crew for the crew profile (crew:profile targets) and availability counts only
 *   calibration       level distribution per skill (suppressed below MIN_GROUP_SIZE) and rater offsets against independent
 *                     evidence (deterministic mean offset; flagged at |offset| >= 0.75 over at least 3 ratings)
 * Import-free apart from pure helpers, so node scripts can load it.
 */
import type { Reason, Ranked, BiText } from '../../domain/engines/types';
import { hoursSinceSyncOf } from '../../domain/mirrorClock.ts';

/** MIN_GROUP_SIZE from src/auth/policy.ts (inlined so node scripts can load this file; a unit test keeps them equal). */
export const MIN_GROUP = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export const CHECKIN = { MAX_SKILLS: 5, MAX_PEERS: 2, NOTE_MIN: 3, NOTE_MAX: 300, EXAMPLE_MAX: 200, DUE_DAYS: 14, OPEN_MAX: 3, MESSAGE_MAX: 300 } as const;
export const OFFSET = { FLAG: 0.75, MIN_N: 3 } as const;
export const TARGET = { MIN_PEOPLE_MAX: 10, DEFAULT_PEOPLE: 2 } as const;
export const SCOPE_ROLES = ['manager', 'instructor', 'training_manager'];
export const COUNTED_BASES = ['verified', 'evidenced', 'validated'];
export const CREW_PROFILE = 'crew:profile';
export const STALE_HOURS = 72;

export const r2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const ratingId = (checkinId: string, rater: string, skill: string) => `skr:${checkinId}:${rater}:${skill}`;
export const targetId = (group: string, skill: string) => `tst:${group}:${skill}`;
export function addDaysIso(d: string, n: number): string {
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// ───────────── people, scope and line managers
export interface PersonRow { id: string; kind?: string; status?: string; team_id?: string | null; job_family_id?: string | null; crew?: string | null; org_id?: string | null; entity_id?: string | null; manager_id?: string | null; display_name?: string; display_name_ar?: string; job_role_id?: string | null }
export interface AssignmentRow { person_id: string; role: string; scope_type: string; scope_value?: string | null; status: string; expires_at?: string | null }
export const isActiveStaff = (p: PersonRow | undefined | null) => !!p && p.kind === 'staff' && p.status === 'active';
const SCOPE_RANK: Record<string, number> = { crew: 1, team: 1, family: 2, org: 3, entity: 3, all: 4 };
export function covers(a: AssignmentRow, t: PersonRow): boolean {
  switch (a.scope_type) {
    case 'all': return true;
    case 'crew': return !!t.crew && t.crew === a.scope_value;
    case 'team': return !!t.team_id && t.team_id === a.scope_value;
    case 'family': return !!t.job_family_id && t.job_family_id === a.scope_value;
    case 'org': return !!t.org_id && t.org_id === a.scope_value;
    case 'entity': return !!t.entity_id && t.entity_id === a.scope_value;
    default: return false;
  }
}
const live = (a: AssignmentRow, today: string) => a.status === 'active' && (!a.expires_at || String(a.expires_at).slice(0, 10) >= today);
/** Same rule as F08 (kafaa_opp_line_manager): people.manager_id when set and not a leaver, else the narrowest manager assignment. */
export function lineManagerOf(personId: string, people: PersonRow[], assignments: AssignmentRow[], today: string): string | null {
  const map = new Map(people.map((p) => [p.id, p]));
  const t = map.get(personId);
  if (!t) return null;
  if (t.manager_id) {
    const m = map.get(t.manager_id);
    if (m && m.status !== 'leaver') return m.id;
  }
  let best: { id: string; rank: number } | null = null;
  for (const a of assignments) {
    if (a.role !== 'manager' || !live(a, today) || a.person_id === personId) continue;
    const h = map.get(a.person_id);
    if (!h || h.status === 'leaver' || !covers(a, t)) continue;
    const rank = SCOPE_RANK[a.scope_type] ?? 9;
    if (!best || rank < best.rank || (rank === best.rank && a.person_id < best.id)) best = { id: a.person_id, rank };
  }
  return best?.id ?? null;
}
/** Does anyone other than the person hold skills_profile Scope (manager, instructor, training manager) over them? */
export function scopeHolders(personId: string, people: PersonRow[], assignments: AssignmentRow[], today: string): Set<string> {
  const t = people.find((p) => p.id === personId);
  const out = new Set<string>();
  if (!t) return out;
  for (const a of assignments) if (SCOPE_ROLES.includes(a.role) && live(a, today) && a.person_id !== personId && covers(a, t)) out.add(a.person_id);
  return out;
}
export type PeerBasis = 'team' | 'family' | null;
/** Colleagues a person may ask as peers: same team (or same job family without a team), active staff, not a manager over them. */
export function peerPool(me: string, people: PersonRow[], assignments: AssignmentRow[], today: string): { basis: PeerBasis; peers: PersonRow[] } {
  const p = people.find((x) => x.id === me);
  if (!p) return { basis: null, peers: [] };
  const basis: PeerBasis = p.team_id ? 'team' : p.job_family_id ? 'family' : null;
  if (!basis) return { basis, peers: [] };
  const lm = lineManagerOf(me, people, assignments, today);
  const holders = scopeHolders(me, people, assignments, today);
  const peers = people
    .filter((x) => x.id !== me && isActiveStaff(x) && x.id !== lm && !holders.has(x.id) && (basis === 'team' ? x.team_id === p.team_id : x.job_family_id === p.job_family_id))
    .sort(byId);
  return { basis, peers };
}

// ───────────── skills that cannot be checked in
export interface SkillRowLite { id: string; competency_id: string; area: string; core?: boolean; key_level: number; evidence_keys: string[]; sort?: number; name_en?: string; name_ar?: string }
export const isSecurity = (s: Pick<SkillRowLite, 'area' | 'competency_id'>, secComps: Set<string>) => s.area === 'security' || secComps.has(s.competency_id);
export const isQualStandardSkill = (s: Pick<SkillRowLite, 'evidence_keys'>, standardIds: Set<string>) => (s.evidence_keys ?? []).some((k) => standardIds.has(k));
export const holdsCurrentQual = (evidence: Row[], person: string, skill: string) =>
  evidence.some((e) => e.person_id === person && e.skill_id === skill && e.kind === 'qual' && e.status === 'current' && e.active !== false);
export type Block = 'security_restricted' | 'qualification_only' | null;
export function checkinBlock(skill: SkillRowLite, ctx: { secComps: Set<string>; standardIds: Set<string>; evidence: Row[]; person: string }): Block {
  if (isSecurity(skill, ctx.secComps)) return 'security_restricted';
  if (isQualStandardSkill(skill, ctx.standardIds) || holdsCurrentQual(ctx.evidence, ctx.person, skill.id)) return 'qualification_only';
  return null;
}

// ───────────── check-in model
export type Outcome = 'validate' | 'adjust' | 'not_yet' | 'qualification_only';
export interface CheckinSkill { skill_id: string; self_level: number; note: string; outcome?: Outcome; final_level?: number | null; reason?: string | null }
export interface Decision { skill_id: string; outcome: 'validate' | 'adjust' | 'not_yet'; level?: number | null; reason?: string | null }
/** Final status of a decided check-in: validated when every skill was validated as asked, else adjusted. */
export const checkinStatus = (skills: CheckinSkill[]) => (skills.every((s) => s.outcome === 'validate') ? 'validated' : 'adjusted');
export const isOverdue = (c: { status: string; due_on?: string | null }, today: string) => c.status === 'open' && !!c.due_on && String(c.due_on).slice(0, 10) < today;

// ───────────── groups (team:<id>, family:<id>)
export interface Group { key: string; kind: 'team' | 'family'; id: string; size: number }
export const validGroupKey = (k: string) => /^(team|family):[a-z0-9][a-z0-9-]{0,59}$/.test(k);
export const validTargetKey = (k: string) => validGroupKey(k) || k === CREW_PROFILE;
export const inGroup = (p: PersonRow, key: string) => (!!p.team_id && key === `team:${p.team_id}`) || (!!p.job_family_id && key === `family:${p.job_family_id}`);
export function groupsOf(people: PersonRow[]): Group[] {
  const m = new Map<string, Group>();
  for (const p of people) {
    for (const [kind, id] of [['team', p.team_id], ['family', p.job_family_id]] as const) {
      if (!id) continue;
      const key = `${kind}:${id}`;
      const g = m.get(key) ?? m.set(key, { key, kind, id, size: 0 }).get(key)!;
      g.size++;
    }
  }
  return [...m.values()].sort((a, b) => (a.kind === b.kind ? cmp(a.id, b.id) : a.kind === 'team' ? -1 : 1));
}
export function defaultGroup(groups: Group[], me: PersonRow | undefined, peopleMode: boolean): string | null {
  if (!groups.length) return null;
  if (peopleMode && me) {
    for (const k of [me.team_id ? `team:${me.team_id}` : null, me.job_family_id ? `family:${me.job_family_id}` : null]) if (k && groups.some((g) => g.key === k)) return k;
  }
  return [...groups].sort((a, b) => b.size - a.size || cmp(a.key, b.key))[0].key;
}

// ───────────── coverage (F11)
export interface StateLite { person_id: string; skill_id: string; level: number; basis: string }
export type StateMap = Map<string, StateLite>;
export const stateKey = (p: string, s: string) => `${p}|${s}`;
export const stateMapOf = (states: Row[]): StateMap => new Map(states.filter((s) => s.active !== false && Number(s.level) > 0 && s.basis !== 'none').map((s) => [stateKey(s.person_id, s.skill_id), { person_id: s.person_id, skill_id: s.skill_id, level: Number(s.level), basis: s.basis }]));
export interface TargetRow { team_id: string; skill_id: string; min_people: number; min_level: number; active?: boolean; note?: string | null }
export type CoverageStatus = 'covered' | 'thin' | 'uncovered' | 'suppressed';
export interface CoverageRow { skill_id: string; min_people: number; min_level: number; target_set: boolean; n: number | null; claimed_n: number | null; status: CoverageStatus; spof: boolean; holders?: string[] }
/** Columns of the heatmap: non-security skills with a target for the group, or held (level > 0) by a member. Catalogue order. */
export function groupSkills(skills: SkillRowLite[], secComps: Set<string>, members: string[], states: StateMap, targets: TargetRow[]): SkillRowLite[] {
  const tg = new Set(targets.filter((t) => t.active !== false).map((t) => t.skill_id));
  return skills
    .filter((s) => !isSecurity(s, secComps) && (tg.has(s.id) || members.some((m) => states.has(stateKey(m, s.id)))))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || cmp(a.id, b.id));
}
export const statusOf = (n: number, min: number): CoverageStatus => (n >= min ? 'covered' : n === 0 ? 'uncovered' : 'thin');
/** Coverage per skill. Only verified, evidenced and validated levels count; claimed levels are reported separately. */
export function coverage(skills: SkillRowLite[], members: string[], states: StateMap, targets: TargetRow[], opts: { suppressed?: boolean; holders?: boolean; exclude?: Set<string> } = {}): CoverageRow[] {
  const tmap = new Map(targets.filter((t) => t.active !== false).map((t) => [t.skill_id, t]));
  const who = members.filter((m) => !opts.exclude?.has(m));
  return skills.map((s) => {
    const t = tmap.get(s.id);
    const min_people = t ? Number(t.min_people) : TARGET.DEFAULT_PEOPLE;
    const min_level = t ? Number(t.min_level) : Number(s.key_level);
    if (opts.suppressed) return { skill_id: s.id, min_people, min_level, target_set: !!t, n: null, claimed_n: null, status: 'suppressed' as const, spof: false };
    const holders: string[] = [];
    let claimed = 0;
    for (const m of who) {
      const st = states.get(stateKey(m, s.id));
      if (!st || st.level < min_level) continue;
      if (COUNTED_BASES.includes(st.basis)) holders.push(m);
      else claimed++;
    }
    const row: CoverageRow = { skill_id: s.id, min_people, min_level, target_set: !!t, n: holders.length, claimed_n: claimed, status: statusOf(holders.length, min_people), spof: holders.length === 1 };
    if (opts.holders) row.holders = holders.sort();
    return row;
  });
}
export interface CoverageSummary { skills: number; covered: number; thin: number; uncovered: number; spof: number }
export function coverageSummary(rows: CoverageRow[]): CoverageSummary {
  return {
    skills: rows.length,
    covered: rows.filter((r) => r.status === 'covered').length,
    thin: rows.filter((r) => r.status === 'thin').length,
    uncovered: rows.filter((r) => r.status === 'uncovered').length,
    spof: rows.filter((r) => r.spof).length,
  };
}

// ───────────── crews (F11 crew view: counts and availability only)
/** Same approach as crewAvailability (M03): a licence mirror row must be valid, unexpired, medically in date and freshly synced. */
export function availabilityOf(personId: string, licences: Row[], medical: Row[], now: Date, today: string): boolean | null {
  const l = licences.find((x) => x.person_id === personId);
  if (!l) return true;
  if (hoursSinceSyncOf(l.last_synced, now) > STALE_HOURS) return null; // mirror clock (readiness 2026-10-13)
  const m = medical.find((x) => x.person_id === personId);
  return l.status === 'valid' && String(l.expires_on).slice(0, 10) >= today && !!m && String(m.due_on).slice(0, 10) >= today;
}
export interface CrewSkill { skill_id: string; min_people: number; min_level: number; n: number; available_n: number; status: CoverageStatus }
export interface CrewRow { crew: string; headcount: number; available: number; unknown: number; skills: CrewSkill[] }
export function crews(people: PersonRow[], states: StateMap, profile: TargetRow[], avail: Map<string, boolean | null>, skillOrder: SkillRowLite[]): CrewRow[] {
  const order = new Map(skillOrder.map((s, i) => [s.id, i]));
  const prof = profile.filter((t) => t.active !== false).sort((a, b) => (order.get(a.skill_id) ?? 999) - (order.get(b.skill_id) ?? 999) || cmp(a.skill_id, b.skill_id));
  const names = [...new Set(people.filter((p) => p.crew).map((p) => p.crew as string))].sort(cmp);
  return names.map((crew) => {
    const in_ = people.filter((p) => p.crew === crew);
    return {
      crew,
      headcount: in_.length,
      available: in_.filter((p) => avail.get(p.id) === true).length,
      unknown: in_.filter((p) => avail.get(p.id) == null).length,
      skills: prof.map((t) => {
        const q = in_.filter((p) => { const st = states.get(stateKey(p.id, t.skill_id)); return !!st && st.level >= Number(t.min_level) && COUNTED_BASES.includes(st.basis); });
        const n = q.length;
        return { skill_id: t.skill_id, min_people: Number(t.min_people), min_level: Number(t.min_level), n, available_n: q.filter((p) => avail.get(p.id) === true).length, status: statusOf(n, Number(t.min_people)) };
      }),
    };
  });
}

// ───────────── calibration (F10)
/** Highest level of the person's active independent (non-rating) evidence for a skill: qualification, course, assessment, JPM, OJT, credential. */
export function evidenceLevels(evidence: Row[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of evidence) {
    if (e.active === false || e.kind === 'rating') continue;
    const k = stateKey(e.person_id, e.skill_id);
    out.set(k, Math.max(out.get(k) ?? 0, Number(e.level)));
  }
  return out;
}
export interface Distribution { skill_id: string; dist: number[] | null; means: { self: number | null; peer: number | null; manager: number | null } | null; ratings: number }
export interface RaterOffset { rater_id: string; kind: 'self' | 'manager' | 'peer'; n: number; offset: number; flag: 'high' | 'low' | 'aligned' | 'few' }
export interface RatingLite { checkin_id: string; subject_id: string; rater_person_id: string; rater_kind: 'self' | 'manager' | 'peer'; skill_id: string; level: number | null; status: string }
const mean = (xs: number[]) => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
export function distributions(skillIds: string[], members: string[], states: StateMap, ratings: RatingLite[], suppressed: boolean): Distribution[] {
  return skillIds.map((sid) => {
    const rs = ratings.filter((r) => r.skill_id === sid && r.status === 'submitted' && r.level != null);
    if (suppressed) return { skill_id: sid, dist: null, means: null, ratings: rs.length };
    const dist = [0, 0, 0, 0, 0];
    for (const m of members) dist[Math.min(4, states.get(stateKey(m, sid))?.level ?? 0)]++;
    const by = (k: string) => mean(rs.filter((r) => r.rater_kind === k).map((r) => Number(r.level)));
    return { skill_id: sid, dist, means: { self: by('self'), peer: by('peer'), manager: by('manager') }, ratings: rs.length };
  });
}
/** Mean (rating - independent evidence level) per rater and rater kind; flagged when |mean| >= 0.75 over >= 3 ratings. */
export function raterOffsets(ratings: RatingLite[], evLevels: Map<string, number>): RaterOffset[] {
  const acc = new Map<string, { rater_id: string; kind: RatingLite['rater_kind']; d: number[] }>();
  for (const r of ratings) {
    if (r.status !== 'submitted' || r.level == null) continue;
    const ev = evLevels.get(stateKey(r.subject_id, r.skill_id));
    if (ev == null) continue;
    const k = `${r.rater_person_id}|${r.rater_kind}`;
    (acc.get(k) ?? acc.set(k, { rater_id: r.rater_person_id, kind: r.rater_kind, d: [] }).get(k)!).d.push(Number(r.level) - ev);
  }
  return [...acc.values()]
    .map((a) => {
      const offset = mean(a.d)!;
      const flag: RaterOffset['flag'] = a.d.length < OFFSET.MIN_N ? 'few' : offset >= OFFSET.FLAG ? 'high' : offset <= -OFFSET.FLAG ? 'low' : 'aligned';
      return { rater_id: a.rater_id, kind: a.kind, n: a.d.length, offset, flag };
    })
    .sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset) || cmp(a.rater_id, b.rater_id) || cmp(a.kind, b.kind));
}
export const suppressedGroup = (size: number) => size < MIN_GROUP;

// ───────────── suggested actions (F11 → F07 course, F08 opportunity, F13 mentoring); every item carries reasons
export const teamReason = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m17.reasons.${code}`, vars, ref });
export interface ActionItem { kind: 'course' | 'opportunity' | 'mentoring'; skill_id: string; course_id?: string; nominee?: string; mentor?: string }
export function teamActions(input: {
  rows: CoverageRow[]; members: PersonRow[]; states: StateMap; skills: SkillRowLite[]; courses: Row[]; secComps: Set<string>; name: (id: string) => BiText; skillName: (id: string) => BiText; courseName: (c: Row) => BiText;
}): Ranked<ActionItem>[] {
  const out: Ranked<ActionItem>[] = [];
  const skill = new Map(input.skills.map((s) => [s.id, s]));
  for (const r of input.rows) {
    if (r.n == null || (r.status === 'covered' && !r.spof)) continue;
    const s = skill.get(r.skill_id);
    if (!s) continue;
    const gap = Math.max(0, r.min_people - r.n) + (r.spof ? 1 : 0);
    const base: Reason[] = [r.spof
      ? teamReason('team_spof', { skill: input.skillName(s.id), level: r.min_level })
      : teamReason('team_gap', { skill: input.skillName(s.id), n: r.n, min: r.min_people, level: r.min_level })];
    // nearest non-holder: highest level below the target (claimed counts as nearest), then id
    const holders = new Set(r.holders ?? []);
    const near = input.members
      .filter((m) => !holders.has(m.id))
      .map((m) => ({ m, lv: input.states.get(stateKey(m.id, s.id))?.level ?? 0 }))
      .sort((a, b) => b.lv - a.lv || cmp(a.m.id, b.m.id))[0];
    const courses = input.courses
      .filter((c) => !(c.competency_ids ?? []).some((id: string) => input.secComps.has(id)) && ((s.evidence_keys ?? []).includes(c.id) || (c.competency_ids ?? []).includes(s.competency_id)))
      .sort((a, b) => Number((s.evidence_keys ?? []).includes(b.id)) - Number((s.evidence_keys ?? []).includes(a.id)) || Number(!!b.qualifying) - Number(!!a.qualifying) || (Number(a.duration_hours ?? 999) - Number(b.duration_hours ?? 999)) || cmp(a.id, b.id));
    if (near && courses[0]) {
      const c = courses[0];
      out.push({ id: `course:${s.id}`, score: r2(gap + 0.3), item: { kind: 'course', skill_id: s.id, course_id: c.id, nominee: near.m.id }, reasons: [...base, teamReason('team_nearest', { name: input.name(near.m.id), level: near.lv, target: r.min_level }), teamReason('team_course', { course: input.courseName(c) }, { table: 'courses', id: c.id })] });
    }
    out.push({ id: `opportunity:${s.id}`, score: r2(gap + 0.2), item: { kind: 'opportunity', skill_id: s.id }, reasons: [...base, teamReason('team_gig', { skill: input.skillName(s.id) })] });
    const mentor = [...holders].sort()[0];
    if (mentor && near) out.push({ id: `mentoring:${s.id}`, score: r2(gap + 0.1), item: { kind: 'mentoring', skill_id: s.id, mentor, nominee: near.m.id }, reasons: [...base, teamReason('team_mentor', { name: input.name(mentor), level: r.min_level })] });
  }
  return out.sort((a, b) => b.score - a.score || cmp(a.id, b.id));
}

// ───────────── CSV export (watermarked with role and date)
export function heatmapCsv(input: { watermark: string; skills: { id: string; label: string }[]; members: { id: string; label: string }[]; states: StateMap; basisLabel: (b: string) => string }): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [esc(input.watermark), ['person', ...input.skills.map((s) => s.label)].map(esc).join(',')];
  for (const m of input.members) {
    lines.push([m.label, ...input.skills.map((s) => { const st = input.states.get(stateKey(m.id, s.id)); return st ? `${st.level} ${input.basisLabel(st.basis)}` : ''; })].map(esc).join(','));
  }
  lines.push(esc(input.watermark));
  return lines.join('\r\n');
}

// ───────────── user-facing refusal messages (same text in the SQL functions)
export const MSG = {
  not_signed_in: 'Sign in to use skill check-ins',
  forbidden_request: 'Only staff can ask for a skill check-in on their own skills',
  skills_count: 'Choose one to five skills',
  skills_duplicate: 'Each skill can appear once in a check-in',
  skill_not_found: 'Skill not found',
  security: 'Security competencies show as qualified or not qualified only: they cannot be checked in',
  qualification: 'Verified by qualification only: this skill cannot be validated by a check-in',
  self_level: 'Self level must be between 1 and 4',
  note: 'Add a short evidence note for each skill (3 to 300 characters)',
  open_skill: 'This skill is already in an open check-in',
  open_max: 'You can have up to 3 open check-ins',
  peers_count: 'Choose up to two peers',
  peer_invalid: 'Peers must be different colleagues from your own team',
  no_manager: 'No line manager found for you: ask HR to record your line manager',
  message: 'The note to raters can be up to 300 characters',
  checkin_not_found: 'Check-in not found',
  closed: 'This check-in is already closed',
  rating_skill: 'Rate only the skills named for you',
  rating_level: 'Level must be between 1 and 4, or 0 for not observed',
  rating_example: 'Give a one-line example (3 to 200 characters)',
  self_validate: 'You cannot validate your own check-in',
  forbidden_validate: 'Only your line manager, a manager in scope or the training manager can validate this check-in',
  decide_all: 'Decide every skill in the check-in',
  adjust: 'An adjustment needs a different level (1 to 4) and a reason (3 to 300 characters)',
  not_yet: 'Say why the skill is not validated yet (3 to 300 characters)',
  withdraw_not_found: 'Check-in not found',
  forbidden_target: 'Only a manager in scope or the training manager can set team targets',
  target_group: 'Unknown team or group',
  target_values: 'Target needs 1 to 10 people at level 1 to 4',
} as const;
