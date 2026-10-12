/**
 * FS75 Future-skills nudges in the weekly digest (wave H · E3): the pure rules, gathered by rules.ts gatherDigest as the new kind
 * `future` (plus one `approval` source). Mirrored 1:1 by the FS75 block of kafaa_dg_gather in
 * supabase/migrations/20261010283001_kafaa_fs83_digest_nudges.sql; scripts/validate/fs83-digest-nudges.mjs proves TS = SQL for every
 * seeded person on several days. Imports only other pure rule files (with .ts extensions: node scripts load this file directly).
 *
 * Release gate: every FS75 addition applies from FS75_FROM (2026-10-12, the first day of ISO week 2026-W42). Digests are records: the
 * seeded digests (2026-W38..W41, built on or before 2026-10-08) are not rewritten, and kafaa_dg_gather returns exactly the wave-G items
 * for any day before the release.
 *
 * Topics of the `future` kind (each topic gives at most one item, the best one; the kind keeps at most CAPS.future = 2 items):
 *   decay         a fast-decay skill (FS03 class `fast`) held at level 2+ whose newest evidence at that level passes its half-life within
 *                 60 days: after that date the skill counts one level lower ("ageing"). Dated (soonest first).
 *   goal          an active FS33 goal plan whose target date falls within 30 days (or passed in the last 30) while my level is still
 *                 below the target; else an FS07 goal that has no dated plan yet ("give it a date"). Dated plans first.
 *   ai_literacy   an AI system I use (FS36 register: a published, listed system with an active, listed user group covering all staff
 *                 or my job family) needs an FS09 rung (and cells) I do not yet meet. Highest required rung first.
 *   role_profile  my role's 2030 profile (FS05) was published or changed (version 2+) in the last 28 days.
 *   rising_skill  a skill on the latest published FS70 "Skills on the Rise" list (data-only coupling: kafaa_skill_signals rows of the newest
 *                 quarter with category 'growing', read only when the table exists) for my job family (its `families`), or, for a row
 *                 without families, required by my role's 2030 profile or one of my goals; held below level 2. Family rows first, then rank.
 *   future_gig    an open FS27 future-skills gig (opportunity with a channel) posted in the last 21 days, open to my family, not mine,
 *                 not applied for, with seats left, that builds one of my future skills and is not already in the digest as an
 *                 opportunity match. Skipped when I opted out of marketplace ranking (F24).
 *   pathway       a published FS17 pathway updated in the last 28 days that takes one of my future skills one level up (at most to
 *                 the target), which I have not started.
 * "My future skills": my active FS07/FS33 goals (target level) and the skill requirements of my role's 2030 profile above my level.
 * Approvals (FS67 hand-off from wave G): fellowship milestones submitted to me as the named supervisor and waiting for my sign-off.
 * Pre-arrival checks (FS69) name no person to act, so they stay out of the digest (logged in the FS75 hand-off).
 * Order inside the kind: dated items first (days), then a fixed topic priority (score), then id. Non-staff people get no future item.
 */
import { aiRung } from '../../modules/m29/fluency.ts';
import { decayClassOf, monthsToDays } from '../../domain/skills.ts';

type Row = Record<string, any>;

export const FS75_FROM = '2026-10-12';
export const FUTURE_TOPICS = ['decay', 'goal', 'ai_literacy', 'role_profile', 'rising_skill', 'future_gig', 'pathway'] as const;
export type FutureTopic = (typeof FUTURE_TOPICS)[number];
export const LAPSE_AHEAD_DAYS = 60;
export const GOAL_AHEAD_DAYS = 30;
export const GOAL_GRACE_DAYS = 30;
export const PROFILE_NEW_DAYS = 28;
export const GIG_NEW_DAYS = 21;
export const PATHWAY_NEW_DAYS = 28;
export const RISING_HELD_LEVEL = 2;
export const DECAY_MIN_LEVEL = 2;
/** Fixed priority of undated topics inside the kind (stored as the item score; dated topics carry none). */
export const TOPIC_SCORE: Record<FutureTopic, number | null> = { decay: null, goal: 0.7, ai_literacy: 0.8, role_profile: 0.9, rising_skill: 0.6, future_gig: 0.5, pathway: 0.4 };
/** ref_table -> topic (the item id is future:<ref_table>:<ref_id>). */
export const TOPIC_OF_TABLE: Record<string, FutureTopic> = {
  person_skills: 'decay', skill_goal_plans: 'goal', skill_goals: 'goal', ai_system_users: 'ai_literacy', role_profile_versions: 'role_profile',
  skill_signals: 'rising_skill', opportunities: 'future_gig', pathways: 'pathway',
};
export const futureTopic = (i: { ref_table: string }): FutureTopic | null => TOPIC_OF_TABLE[i.ref_table] ?? null;

/** The data the FS75 rules read (all optional: callers built before FS75 omit them and get no FS75 item). */
export interface FutureData {
  role_profile_versions?: Row[];
  skill_goals?: Row[];
  skill_goal_plans?: Row[];
  pathways?: Row[];
  pathway_enrolments?: Row[];
  ai_rungs?: Row[];
  ai_skill_tracks?: Row[];
  ai_systems?: Row[];
  ai_system_users?: Row[];
  /** FS70 (fsHe1, same wave): published list rows with quarter, skill_id, category ('now' | 'growing'), rank and families (text[]). */
  skill_signals?: Row[];
  fellowship_milestones?: Row[];
}

/** The digest item shape (same as rules.ts DigestItem; kept structural so this file has no value import from rules.ts). */
export interface FutureItem {
  id: string; kind: 'future' | 'approval'; urgency: 2 | 3; ref_table: string; ref_id: string; title_en: string; title_ar: string;
  meta_en: string | null; meta_ar: string | null; link: string; due_on: string | null; days: number | null; score: number | null;
  why: { code: string; key?: string; vars?: Record<string, unknown> }[];
}

const DAY = 86_400_000;
const d10 = (s: unknown) => String(s ?? '').slice(0, 10);
const dayNo = (s: string) => Math.floor(Date.parse(`${s.slice(0, 10)}T00:00:00Z`) / DAY);
const between = (a: string, b: string) => dayNo(b) - dayNo(a);
const plus = (s: string, n: number) => new Date((dayNo(s) + n) * DAY).toISOString().slice(0, 10);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const bi = (en: unknown, ar: unknown) => ({ en: String(en ?? ''), ar: String(ar || en || '') });
const fut = (topic: FutureTopic, x: Omit<FutureItem, 'kind' | 'urgency' | 'meta_en' | 'meta_ar' | 'due_on' | 'days' | 'score'> & Partial<FutureItem>): FutureItem => ({
  meta_en: null, meta_ar: null, due_on: null, days: null, score: TOPIC_SCORE[topic], ...x, kind: 'future', urgency: 3,
});

/** My current published 2030 profile (highest version). */
export function myProfile2030(d: FutureData, roleId: string | null | undefined): Row | null {
  if (!roleId) return null;
  return (d.role_profile_versions ?? []).filter((r) => r.role_id === roleId && r.horizon === '2030' && r.status === 'published')
    .sort((a, b) => Number(b.version) - Number(a.version) || cmp(a.id, b.id))[0] ?? null;
}

/** My future skills: skill -> target level and source (goal wins over profile). */
export function myFutureSkills(d: FutureData, me: string, profile: Row | null, lv: Map<string, number>): Map<string, { target: number; source: 'goal' | 'profile' }> {
  const out = new Map<string, { target: number; source: 'goal' | 'profile' }>();
  for (const g of [...(d.skill_goals ?? []), ...(d.skill_goal_plans ?? [])]) {
    if (g.person_id !== me || g.status !== 'active') continue;
    const t = Number(g.target_level ?? 2);
    const cur = out.get(g.skill_id);
    out.set(g.skill_id, { target: Math.max(cur?.target ?? 0, t), source: 'goal' });
  }
  for (const q of profile?.requirements ?? []) {
    if (q.kind !== 'skill' || !q.ref_id) continue;
    const need = Number(q.level ?? 0);
    if (need <= (lv.get(q.ref_id) ?? 0) || out.has(q.ref_id)) continue;
    out.set(q.ref_id, { target: need, source: 'profile' });
  }
  return out;
}

/** The day a held skill state drops one level (FS03 ageing), or null when it holds (qualification, already ageing, level < 2). */
export function lapseDate(state: Row): { date: string; months: number } | null {
  const level = Number(state.level ?? 0);
  if (level < DECAY_MIN_LEVEL || state.active === false) return null;
  const top = (Array.isArray(state.reasons) ? state.reasons : []).filter((r: Row) => Number(r.level) === level);
  if (!top.length) return null;
  let best: { date: string; months: number } | null = null;
  for (const r of top) {
    if (r.ageing || r.code === 'qual' || !r.observed_on || typeof r.hl !== 'number') return null;
    const date = plus(d10(r.observed_on), monthsToDays(r.hl));
    if (!best || date > best.date) best = { date, months: r.hl };
  }
  return best;
}

export interface FutureCtx {
  person: Row;
  today: string;
  /** person_skills, skills, opportunities, opportunity_applications, people, reco_optouts: the digest's base tables. */
  person_skills: Row[];
  skills: Row[];
  opportunities: Row[];
  opportunity_applications: Row[];
  people: Row[];
  reco_optouts: Row[];
  /** Ids already gathered (the future gig topic skips opportunities already listed as a match). */
  taken: Set<string>;
}

const LIVE_APP = ['applied', 'released', 'selected', 'completed', 'declined_release', 'not_selected'];

/** FS75 approvals (urgency 2): fellowship milestones waiting for my sign-off as the named supervisor. */
export function gatherFs75Approvals(d: FutureData, c: FutureCtx): FutureItem[] {
  if (c.today < FS75_FROM) return [];
  const me = c.person.id;
  const out: FutureItem[] = [];
  for (const m of d.fellowship_milestones ?? []) {
    const at = d10(m.submitted_at);
    if (m.supervisor_person_id !== me || m.status !== 'submitted' || m.fellow_person_id === me || !at || at > c.today) continue;
    const p = c.people.find((x) => x.id === m.fellow_person_id);
    const [en, ar] = p ? [p.display_name, p.display_name_ar || p.display_name] : ['A fellow', 'زميل باحث'];
    out.push({ id: `approval:fellowship_milestones:${m.id}`, kind: 'approval', urgency: 2, ref_table: 'fellowship_milestones', ref_id: m.id,
      title_en: `Fellowship milestone to sign off: ${en}`, title_ar: `مرحلة زمالة بانتظار اعتمادك: ${ar}`, meta_en: en, meta_ar: ar,
      link: `/universities/fellowships/${m.fellowship_id}`, due_on: null, days: null, score: null, why: [{ code: 'approval_fellowship', vars: { date: at } }] });
  }
  return out;
}

/** FS75 future-skills items (kind `future`, at most one per topic) for one staff member on one day. */
export function gatherFuture(d: FutureData, c: FutureCtx): FutureItem[] {
  const { person, today } = c;
  if (today < FS75_FROM || person.kind !== 'staff' || person.status !== 'active') return [];
  const me = person.id;
  const out: FutureItem[] = [];
  const skill = new Map(c.skills.map((s) => [s.id, s]));
  const sname = (id: string) => bi(skill.get(id)?.name_en ?? id, skill.get(id)?.name_ar);
  const mine = c.person_skills.filter((s) => s.person_id === me && s.active !== false);
  const lv = new Map<string, number>();
  for (const s of mine) if (Number(s.level) > 0) lv.set(s.skill_id, Math.max(lv.get(s.skill_id) ?? 0, Number(s.level)));
  const profile = myProfile2030(d, person.job_role_id);
  const fs = myFutureSkills(d, me, profile, lv);

  // decay: the soonest fast-decay lapse within 60 days
  const lapses: { s: Row; date: string; months: number }[] = [];
  for (const s of mine) {
    if (decayClassOf(skill.get(s.skill_id)) !== 'fast') continue;
    const l = lapseDate(s);
    if (l && l.date >= today && l.date <= plus(today, LAPSE_AHEAD_DAYS)) lapses.push({ s, ...l });
  }
  lapses.sort((a, b) => cmp(a.date, b.date) || cmp(a.s.id, b.s.id));
  if (lapses.length) {
    const { s, date, months } = lapses[0];
    const n = sname(s.skill_id);
    out.push(fut('decay', { id: `future:person_skills:${s.id}`, ref_table: 'person_skills', ref_id: s.id, title_en: `${n.en}: level ${s.level} may slip`, title_ar: `${n.ar}: قد ينخفض المستوى ${s.level}`,
      link: '/my/skills/confidence', due_on: date, days: between(today, date), why: [{ code: 'future_decay', vars: { date, level: Number(s.level), months } }, { code: 'future_decay_renew' }] }));
  }

  // goal: a dated plan due within 30 days (or overdue up to 30) below its target; else an undated FS07 goal
  const plans = (d.skill_goal_plans ?? []).filter((g) => g.person_id === me && g.status === 'active' && g.target_date
    && d10(g.target_date) >= plus(today, -GOAL_GRACE_DAYS) && d10(g.target_date) <= plus(today, GOAL_AHEAD_DAYS) && (lv.get(g.skill_id) ?? 0) < Number(g.target_level ?? 2))
    .sort((a, b) => cmp(d10(a.target_date), d10(b.target_date)) || cmp(a.id, b.id));
  if (plans.length) {
    const g = plans[0];
    const due = d10(g.target_date);
    const n = sname(g.skill_id);
    out.push(fut('goal', { id: `future:skill_goal_plans:${g.id}`, ref_table: 'skill_goal_plans', ref_id: g.id, title_en: `Your goal: ${n.en} at level ${g.target_level}`, title_ar: `هدفك: ${n.ar} بالمستوى ${g.target_level}`,
      link: '/my/skills/goals', due_on: due, days: between(today, due), score: null,
      why: [{ code: due < today ? 'future_goal_overdue' : 'future_goal_due', vars: { date: due } }, { code: 'future_goal_level', vars: { have: lv.get(g.skill_id) ?? 0, level: Number(g.target_level ?? 2) } }] }));
  } else {
    const planned = new Set((d.skill_goal_plans ?? []).filter((g) => g.person_id === me && g.status === 'active').map((g) => g.skill_id));
    const open = (d.skill_goals ?? []).filter((g) => g.person_id === me && g.status === 'active' && !planned.has(g.skill_id) && (lv.get(g.skill_id) ?? 0) < Number(g.target_level ?? 2))
      .sort((a, b) => cmp(d10(a.created_at), d10(b.created_at)) || cmp(a.id, b.id));
    if (open.length) {
      const g = open[0];
      const n = sname(g.skill_id);
      out.push(fut('goal', { id: `future:skill_goals:${g.id}`, ref_table: 'skill_goals', ref_id: g.id, title_en: `Give your goal a date: ${n.en}`, title_ar: `حدّد موعداً لهدفك: ${n.ar}`,
        link: '/my/skills/goals', why: [{ code: 'future_goal_undated', vars: { date: d10(g.created_at) } }, { code: 'future_goal_level', vars: { have: lv.get(g.skill_id) ?? 0, level: Number(g.target_level ?? 2) } }] }));
    }
  }

  // ai_literacy: an AI system I use needs a rung or cells I do not meet
  if ((d.ai_rungs ?? []).length) {
    const res = aiRung(me, (d.ai_rungs ?? []) as never, (d.ai_skill_tracks ?? []) as never, mine as never);
    const met = new Set(res.cells.filter((x) => x.met).map((x) => x.id));
    const sys = new Map((d.ai_systems ?? []).filter((s) => s.status === 'published' && s.listed).map((s) => [s.id, s]));
    const groups = (d.ai_system_users ?? []).filter((g) => g.active && g.listed && sys.has(g.system_id)
      && (g.all_staff || (!!person.job_family_id && (g.family_ids ?? []).includes(person.job_family_id)))
      && !(res.rung >= Number(g.required_rung) && (g.required_cells ?? []).every((x: string) => met.has(x))))
      .sort((a, b) => Number(b.required_rung) - Number(a.required_rung) || cmp(a.id, b.id));
    if (groups.length) {
      const g = groups[0];
      const s = sys.get(g.system_id)!;
      out.push(fut('ai_literacy', { id: `future:ai_system_users:${g.id}`, ref_table: 'ai_system_users', ref_id: g.id, title_en: `${s.name_en}: AI fluency rung ${g.required_rung} needed`,
        title_ar: `${s.name_ar || s.name_en}: يلزم المستوى ${g.required_rung} من سلّم الطلاقة في الذكاء الاصطناعي`, link: '/my/ai-fluency',
        why: [{ code: 'future_ai_required', vars: { system: bi(s.name_en, s.name_ar), rung: Number(g.required_rung), have: res.rung } }, { code: 'future_ai_group', vars: { group: bi(g.label_en, g.label_ar) } }] }));
    }
  }

  // role_profile: my role's 2030 profile published or changed in the last 28 days
  if (profile && profile.published_at) {
    const at = d10(profile.published_at);
    if (at >= plus(today, -PROFILE_NEW_DAYS) && at <= today) {
      const v = Number(profile.version ?? 1);
      const gaps = (profile.requirements ?? []).filter((q: Row) => q.kind === 'skill' && Number(q.level ?? 0) > (lv.get(q.ref_id) ?? 0)).length;
      out.push(fut('role_profile', { id: `future:role_profile_versions:${profile.id}`, ref_table: 'role_profile_versions', ref_id: profile.id,
        title_en: v > 1 ? 'Your role in 2030: the profile was updated' : 'Your role in 2030: the profile was published', title_ar: v > 1 ? 'دورك في 2030: حُدّث الملف' : 'دورك في 2030: نُشر الملف',
        link: '/my/role-2030', why: [{ code: v > 1 ? 'future_profile_changed' : 'future_profile_published', vars: { date: at, version: v } }, { code: gaps > 0 ? 'future_profile_gaps' : 'future_profile_ready', vars: { n: gaps } }] }));
    }
  }

  // rising_skill: an FS70 "growing" skill near me, held below level 2
  const reqd = new Set((profile?.requirements ?? []).filter((q: Row) => q.kind === 'skill').map((q: Row) => q.ref_id));
  const sig = d.skill_signals ?? [];
  const latest = sig.reduce((m, r) => (String(r.quarter ?? '') > m ? String(r.quarter ?? '') : m), '');
  const famOf = (r: Row): unknown[] => (Array.isArray(r.families) ? r.families : []);
  const rank = (r: Row) => (typeof r.rank === 'number' ? r.rank : 1e9);
  const rising = sig.filter((r) => r.skill_id && String(r.quarter ?? '') === latest && r.category === 'growing' && skill.has(r.skill_id)
    && (lv.get(r.skill_id) ?? 0) < RISING_HELD_LEVEL
    && (famOf(r).length ? famOf(r).includes(person.job_family_id) : reqd.has(r.skill_id) || fs.has(r.skill_id)))
    .sort((a, b) => Number(famOf(b).length > 0) - Number(famOf(a).length > 0) || rank(a) - rank(b) || cmp(a.skill_id, b.skill_id));
  if (rising.length) {
    const r = rising[0];
    const n = sname(r.skill_id);
    out.push(fut('rising_skill', { id: `future:skill_signals:${r.skill_id}`, ref_table: 'skill_signals', ref_id: r.skill_id, title_en: `Rising at ENEC: ${n.en}`, title_ar: `مهارة صاعدة في المؤسسة: ${n.ar}`,
      link: `/skills/${r.skill_id}`, why: [{ code: 'future_rising', vars: { quarter: String(r.quarter ?? '') } }, { code: famOf(r).length ? 'future_rising_family' : 'future_rising_role' }] }));
  }

  // future_gig: an open FS27 gig that builds one of my future skills
  const optedOut = c.reco_optouts.some((o) => o.person_id === me && o.surface === 'marketplace' && o.opted_out);
  if (!optedOut && fs.size) {
    const applied = new Set(c.opportunity_applications.filter((a) => a.person_id === me && LIVE_APP.includes(a.status)).map((a) => a.opportunity_id));
    const gigs = c.opportunities.filter((o) => {
      const at = d10(o.created_at);
      if (!o.channel || o.status !== 'open' || o.listed === false || o.posted_by === me || applied.has(o.id) || at < plus(today, -GIG_NEW_DAYS) || at > today) return false;
      if (o.seats != null && Number(o.seats_taken ?? 0) >= Number(o.seats)) return false;
      const fam: string[] = o.eligible_families ?? [];
      if (fam.length && !(person.job_family_id && fam.includes(person.job_family_id))) return false;
      if (c.taken.has(`opportunity:opportunities:${o.id}`)) return false;
      return (o.skills_gained ?? []).some((s: string) => fs.has(s));
    }).map((o) => ({ o, hit: (o.skills_gained as string[]).filter((s) => fs.has(s)) }))
      .sort((a, b) => b.hit.length - a.hit.length || cmp(d10(b.o.created_at), d10(a.o.created_at)) || cmp(a.o.id, b.o.id));
    if (gigs.length) {
      const { o, hit } = gigs[0];
      const first = [...hit].sort((a, b) => (fs.get(a)!.source === fs.get(b)!.source ? cmp(a, b) : fs.get(a)!.source === 'goal' ? -1 : 1))[0];
      out.push(fut('future_gig', { id: `future:opportunities:${o.id}`, ref_table: 'opportunities', ref_id: o.id, title_en: o.title_en, title_ar: o.title_ar || o.title_en, link: `/opportunities/${o.id}`,
        why: [{ code: fs.get(first)!.source === 'goal' ? 'future_gig_goal' : 'future_gig_profile', vars: { skill: sname(first) } }, { code: 'future_gig_new', vars: { date: d10(o.created_at) } }] }));
    }
  }

  // pathway: a recently published pathway one level up on one of my future skills, not started
  if (fs.size) {
    const started = new Set((d.pathway_enrolments ?? []).filter((e) => e.person_id === me && (e.status === 'active' || e.status === 'completed')).map((e) => e.pathway_id));
    const pws = (d.pathways ?? []).filter((p) => {
      const at = d10(p.updated_at);
      const f = fs.get(p.skill_id);
      return p.status === 'published' && p.listed && !started.has(p.id) && f && at >= plus(today, -PATHWAY_NEW_DAYS) && at <= today
        && Number(p.level) === (lv.get(p.skill_id) ?? 0) + 1 && Number(p.level) <= f.target;
    }).sort((a, b) => (fs.get(a.skill_id)!.source === fs.get(b.skill_id)!.source ? 0 : fs.get(a.skill_id)!.source === 'goal' ? -1 : 1) || cmp(a.id, b.id));
    if (pws.length) {
      const p = pws[0];
      out.push(fut('pathway', { id: `future:pathways:${p.id}`, ref_table: 'pathways', ref_id: p.id, title_en: p.title_en, title_ar: p.title_ar || p.title_en, link: `/learn/pathways/${p.id}`,
        why: [{ code: fs.get(p.skill_id)!.source === 'goal' ? 'future_pathway_goal' : 'future_pathway_profile', vars: { skill: sname(p.skill_id), level: Number(p.level) } },
          { code: 'future_pathway_effort', vars: { months: Number(p.envelope_months), hours: Number(p.weekly_hours) } }] }));
    }
  }
  return out;
}
