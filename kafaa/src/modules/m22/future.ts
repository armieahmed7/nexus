/**
 * FS46-FS48 (wave E · E4, M22): future leadership behaviours in the 360, the Future Leaders track and women in future nuclear
 * skills. Pure rules, import-free apart from types (the seed builder and the PGlite validator load this file in node).
 * SQL mirror: supabase/migrations/20261010254001_kafaa_fs54_future_leadership.sql. Change both together.
 * No function here reads gender, nationality or age, except wfnStats(), which measures participation and scores nobody
 * (like the F24 fairness monitor); tests/unit/w3e5-no-protected-inputs.test.ts proves it for the ranking functions.
 */
import type { Ranked, Reason } from '../../domain/engines/types';

type Bi = { en: string; ar: string };
type Label = (id: string) => Bi;
const r = (code: string, vars?: Reason['vars'], ref?: Reason['ref'], weight?: number): Reason => ({ code, key: `m22.reasons.${code}`, vars, ref, weight });
const round2 = (n: number) => Math.round(n * 100) / 100;
const avg2 = (sum: number, n: number) => (n ? Math.round((sum * 100) / n) / 100 : null);
const MIN_RATERS = 5;
const share = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 1000 : null);

// ═════════════════════════════ FS46 · coach cards and the programme view of 360 form 2
export interface CoachBehaviour { id: string; form_from: number; sort: number; title_en: string; title_ar: string }
export interface BehaviourResult { id: string; self: number | null; others: number }
/**
 * Coach cards in the order that helps most: with results, the lowest colleague average first, a possible blind spot (self at least
 * 0.75 above colleagues) next, the four future behaviours slightly ahead; without results (fewer than five responses), the future
 * behaviours first, then the catalogue order. Every card carries reasons (F02 lint).
 */
export function coachFocus(behaviours: CoachBehaviour[], results: BehaviourResult[] | null): Ranked<CoachBehaviour>[] {
  const out: Ranked<CoachBehaviour>[] = [];
  const res = new Map((results ?? []).map((x) => [x.id, x]));
  for (const bh of behaviours) {
    const title: Bi = { en: bh.title_en, ar: bh.title_ar };
    const future = bh.form_from === 2;
    const reasons: Reason[] = [];
    let score: number;
    if (results) {
      const x = res.get(bh.id);
      if (!x) continue;
      const blind = x.self != null && x.self - x.others >= 0.75;
      score = (5 - x.others) * 10 + (blind ? 8 : 0) + (future ? 2 : 0);
      reasons.push(r('cf_avg', { behaviour: title, avg: x.others }, { table: 'leadership_behaviours', id: bh.id }));
      if (blind) reasons.push(r('cf_blind', { self: x.self!, others: x.others }));
      if (x.others >= 4.2) reasons.push(r('cf_strength', { avg: x.others }));
      if (future) reasons.push(r('cf_future'));
    } else {
      score = (future ? 20 : 10) - bh.sort / 100;
      if (future) reasons.push(r('cf_future'));
      reasons.push(r('cf_default', { behaviour: title }, { table: 'leadership_behaviours', id: bh.id }));
    }
    out.push({ id: bh.id, score: round2(score), reasons, item: bh });
  }
  return out.sort((a, b) => b.score - a.score || a.item!.sort - b.item!.sort || (a.id < b.id ? -1 : 1));
}

export interface Resp2 { cycle: string; subject_id: string; rater_kind: string; scores: Record<string, number>; form_version?: number | null }
export interface NomLite { person_id: string; programme_id: string; status: string }
export interface StatCell { subjects: number | null; suppressed: boolean; scores: Record<string, number> | null }
export interface ProgrammeStats { cycle: string | null; form_version: 2; behaviours: string[]; all: StatCell; rows: (StatCell & { programme_id: string })[] }
/**
 * HR view of 360 form 2 by programme: the latest form-2 cycle in which a subject reached five responses (self excluded); a subject
 * belongs to every programme with an approved or completed nomination; a cell naming fewer than minGroup subjects is suppressed.
 */
export function computeProgrammeStats(resps: Resp2[], noms: NomLite[], programmeIds: string[], ids: string[], minGroup: number): ProgrammeStats {
  const v2 = resps.filter((x) => (x.form_version ?? 1) === 2 && x.rater_kind !== 'self');
  const cnt = new Map<string, number>();
  for (const x of v2) cnt.set(`${x.cycle}|${x.subject_id}`, (cnt.get(`${x.cycle}|${x.subject_id}`) ?? 0) + 1);
  const ready = [...cnt.entries()].filter(([, n]) => n >= MIN_RATERS).map(([k]) => k.split('|')[0]);
  const cycle = (ready.length ? ready : v2.map((x) => x.cycle)).sort().reverse()[0] ?? null;
  const inCycle = v2.filter((x) => x.cycle === cycle);
  const subjects = new Set([...cnt.entries()].filter(([k, n]) => n >= MIN_RATERS && k.split('|')[0] === cycle).map(([k]) => k.split('|')[1]));
  const cell = (set: Set<string>): StatCell => {
    const k = set.size;
    if (k < minGroup) return { subjects: null, suppressed: true, scores: null };
    const rs = inCycle.filter((x) => set.has(x.subject_id));
    const scores: Record<string, number> = {};
    for (const id of ids) scores[id] = avg2(rs.reduce((a, x) => a + (x.scores[id] ?? 0), 0), rs.length)!;
    return { subjects: k, suppressed: false, scores };
  };
  const rows = programmeIds.map((pid) => {
    const members = new Set(noms.filter((n) => n.programme_id === pid && (n.status === 'approved' || n.status === 'completed')).map((n) => n.person_id));
    return { programme_id: pid, ...cell(new Set([...subjects].filter((s) => members.has(s)))) };
  });
  return { cycle, form_version: 2, behaviours: ids, all: cell(subjects), rows };
}

// ═════════════════════════════ FS47 · Future Leaders track
export const FL_PROGRAMME_ID = 'prog-future-leaders';
export const FL_PROJECT_STATUSES = ['none', 'draft', 'submitted', 'returned', 'accepted'] as const;
export const FL_NOM_STATUSES = ['nominated', 'approved', 'declined', 'completed'] as const;
/** Nominations made in the first half-year join that year's cohort; second-half nominations join next year's. */
export function flCohortFor(cycle: string): string {
  const y = Number(String(cycle).slice(0, 4));
  return `flc-${String(cycle).endsWith('H2') ? y + 1 : y}`;
}
export const FL_MSG = {
  not_signed_in: 'Sign in to use the Future Leaders track',
  forbidden_nominate: 'Only HR (HR analyst or HR director) nominates people for the Future Leaders track',
  self_nominate: 'You cannot nominate yourself',
  not_found_person: 'Person not found',
  reason: 'Give a reason of 10 to 500 characters (what the person is ready for)',
  duplicate: 'This person already has an open Future Leaders nomination',
  not_found: 'Participant not found',
  forbidden_record: 'Only the training manager records Future Leaders modules',
  not_running: 'This cohort is not running, so modules cannot be recorded',
  module: 'Unknown module for this cohort',
  not_participant: 'Only the selected participant edits their policy project',
  project_locked: 'This policy project has been accepted and can no longer be edited',
  title: 'Give the project a title of 5 to 140 characters',
  question: 'State the policy question in 10 to 300 characters',
  summary: 'Write a summary of 20 to 1,500 characters',
  sponsor: 'Name the sponsor role (3 to 80 characters, a role, not a person)',
  forbidden_review: 'Only the training manager or the HR authority reviews policy projects',
  maker_checker: 'You cannot review your own policy project',
  not_submitted: 'Only a submitted project can be reviewed',
  invalid_decision: 'Unknown decision',
  return_note: 'Give a note of 5 to 500 characters when you return a project',
} as const;
export interface FlComp { id: string; title_en: string; title_ar: string; skill_targets: Record<string, number>; sort: number }
export interface FlReadiness { person_id: string; score: number; comps: { id: string; score: number; rows: { skill_id: string; have: number; need: number; met: boolean }[] }[] }
/** Readiness on the five nuclear-management competencies: per competency Σ min(have, need) / Σ need over its skills; overall = mean. */
export function flReadiness(personId: string, levels: Map<string, { level: number }>, comps: FlComp[]): FlReadiness {
  const out = [...comps].sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1)).map((c) => {
    let have = 0;
    let need = 0;
    const rows = Object.keys(c.skill_targets).sort().map((s) => {
      const h = levels.get(s)?.level ?? 0;
      const n = c.skill_targets[s];
      have += Math.min(h, n);
      need += n;
      return { skill_id: s, have: h, need: n, met: h >= n };
    });
    return { id: c.id, pct: need ? Math.round((100 * have) / need) : 0, rows };
  });
  // integer percentages first (same arithmetic as SQL numeric), then two decimals
  const score = out.length ? Math.round(out.reduce((a, c) => a + c.pct, 0) / out.length) / 100 : 0;
  return { person_id: personId, score, comps: out.map(({ pct, ...c }) => ({ ...c, score: pct / 100 })) };
}
/** "Why this?" for a readiness result (both backends return the same numbers; the reasons are built in the page). */
export function flReasons(x: FlReadiness, comps: FlComp[], skill: Label): Reason[] {
  const name = new Map(comps.map((c) => [c.id, { en: c.title_en, ar: c.title_ar } as Bi]));
  const out: Reason[] = [r('fl_ready', { pct: Math.round(x.score * 100) })];
  for (const c of [...x.comps].sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1))) out.push(r('fl_comp', { comp: name.get(c.id) ?? { en: c.id, ar: c.id }, pct: Math.round(c.score * 100) }, { table: 'fl_competencies', id: c.id }));
  const gaps = x.comps.flatMap((c) => c.rows.filter((y) => !y.met)).sort((a, b) => b.need - b.have - (a.need - a.have) || (a.skill_id < b.skill_id ? -1 : 1));
  const seen = new Set<string>();
  for (const g of gaps) {
    if (seen.has(g.skill_id) || seen.size >= 5) continue;
    seen.add(g.skill_id);
    out.push(r('fl_gap', { skill: skill(g.skill_id), from: g.have, to: g.need }, { table: 'skills', id: g.skill_id }, g.need - g.have));
  }
  return out;
}
export interface FlParticipantLite { nomination_id: string; cohort_id: string; modules_done: string[]; project_status: string; status: string }
export interface FlCohortLite { id: string; sort: number; modules: { id: string }[] }
export interface FlStats {
  nominations: { status: string; n: number | null; suppressed: boolean }[];
  cohorts: { id: string; participants: number | null; suppressed: boolean; modules: { id: string; done: number | null; suppressed: boolean }[]; projects: { status: string; n: number | null; suppressed: boolean }[]; completed: number | null; completed_suppressed: boolean }[];
}
/** Track statistics for HR, the training manager and auditors: every count under minGroup is null and flagged. */
export function computeFlStats(noms: (NomLite & { id: string; cycle: string })[], parts: FlParticipantLite[], cohorts: FlCohortLite[], minGroup: number): FlStats {
  const fl = noms.filter((n) => n.programme_id === FL_PROGRAMME_ID);
  const cell = (n: number) => ({ n: n < minGroup ? null : n, suppressed: n < minGroup });
  const byNom = new Map(parts.map((p) => [p.nomination_id, p]));
  return {
    nominations: FL_NOM_STATUSES.map((status) => ({ status, ...cell(fl.filter((n) => n.status === status).length) })),
    cohorts: [...cohorts].sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1)).map((c) => {
      const sel = fl.filter((n) => (n.status === 'approved' || n.status === 'completed') && flCohortFor(n.cycle) === c.id);
      const rows = sel.map((n) => byNom.get(n.id) ?? { nomination_id: n.id, cohort_id: c.id, modules_done: [], project_status: 'none', status: n.status === 'completed' ? 'completed' : 'active' });
      const k = sel.length;
      const done = rows.filter((x) => x.status === 'completed').length;
      return {
        id: c.id, participants: k < minGroup ? null : k, suppressed: k < minGroup,
        modules: c.modules.map((m) => { const d = rows.filter((x) => (x.modules_done ?? []).includes(m.id)).length; return { id: m.id, done: d < minGroup ? null : d, suppressed: d < minGroup }; }),
        projects: FL_PROJECT_STATUSES.map((status) => ({ status, ...cell(rows.filter((x) => (x.project_status ?? 'none') === status).length) })),
        completed: done < minGroup ? null : done, completed_suppressed: done < minGroup,
      };
    }),
  };
}

// ═════════════════════════════ FS48 · Women in future nuclear skills
export const WFN_INTERESTS = ['ai_data', 'digital_plant', 'advanced_reactor', 'green_energy', 'leadership', 'project_delivery'] as const;
export const WFN_STRANDS = ['circles', 'visiting', 'sponsored'] as const;
/** Labels of the future-skill areas (reason variables carry both languages, F02). */
export const WFN_AREA_LABELS: Record<string, Bi> = {
  ai_data: { en: 'AI and data', ar: 'الذكاء الاصطناعي والبيانات' },
  digital_plant: { en: 'Digital plant and I&C', ar: 'المحطة الرقمية والقياس والتحكم' },
  advanced_reactor: { en: 'Advanced reactors and SMRs', ar: 'المفاعلات المتقدمة والمفاعلات الصغيرة' },
  green_energy: { en: 'Clean energy systems', ar: 'أنظمة الطاقة النظيفة' },
  leadership: { en: 'Leadership', ar: 'القيادة' },
  project_delivery: { en: 'Project delivery', ar: 'تنفيذ المشاريع' },
};
export const wfnArea = (id: string): Bi => WFN_AREA_LABELS[id] ?? { en: id, ar: id };
export const WFN_REQUEST_STATUSES = ['interested', 'shortlisted', 'placed', 'completed', 'declined'] as const;
export const WFN_MAX_OPEN_REQUESTS = 3;
export const WFN_MSG = {
  not_signed_in: 'Sign in to take part in the network',
  forbidden: 'The network is open to staff',
  interests: 'Choose one to four future-skill areas',
  strands: 'Choose at least one way to take part (circles, visiting placements or sponsored study)',
  not_opted_in: 'Opt in to the network first (you can withdraw at any time)',
  not_found_circle: 'Circle not found',
  circle_closed: 'This circle is closed',
  circle_full: 'This circle is full; try another circle or ask to open a new one',
  not_found_offer: 'Offer not found',
  offer_closed: 'This offer is closed',
  duplicate: 'You already have an open request for this offer',
  limit: 'You can have up to three open requests at a time',
  statement: 'Write 20 to 600 characters on why this placement or study fits you',
  not_found: 'Request not found',
  forbidden_decide: 'Only the training manager (programme owner) decides placements and sponsored study',
  maker_checker: 'You cannot decide your own request',
  transition: 'This decision does not fit the request\'s current status',
  decline_note: 'Give a note of 5 to 300 characters when you decline',
  outcome: 'Record the outcome (progressed or same role) when you mark a request completed',
} as const;
export interface WfnParticipant { person_id: string; active: boolean; interests: string[]; strands: string[]; mentor: boolean }
export interface WfnCircle { id: string; status: string; seats: number; focus: string[]; sort: number; title_en: string; title_ar: string }
export interface WfnMember { circle_id: string; person_id: string; role: string; active: boolean }
export interface WfnOffer { id: string; strand: string; status: string; closes_on: string; focus: string[]; sort: number; title_en: string; title_ar: string }
export interface WfnRequest { id: string; offer_id: string; person_id: string; status: string; outcome?: string | null }
/** A circle has room while its active members (mentors excluded) are fewer than its seats. */
export const circleOpen = (c: { id: string; seats: number }, members: WfnMember[]) => members.filter((m) => m.circle_id === c.id && m.active && m.role === 'member').length < c.seats;
const hasMentor = (cid: string, members: WfnMember[]) => members.some((m) => m.circle_id === cid && m.active && m.role === 'mentor');
/** The two public flags of a circle (staff never read other people's memberships): is_full, and whether the mentor seat is free. */
export const circleFlags = (c: { id: string; seats: number }, members: WfnMember[]) => ({ is_full: !circleOpen(c, members), mentor_open: !hasMentor(c.id, members) });
/**
 * The membership view a participant's page can rank with: my own rows plus placeholder rows rebuilt from the circle flags, so
 * rankCircles() gives the same order as with every membership (seat room and mentor seat are all it reads of other people).
 */
export function circleMembersView(circles: { id: string; seats: number; is_full?: boolean | null; mentor_open?: boolean | null }[], mine: WfnMember[]): WfnMember[] {
  const out = mine.filter((m) => m.active);
  for (const c of circles) {
    const own = out.filter((m) => m.circle_id === c.id && m.role === 'member').length;
    if (c.is_full) for (let i = own; i < c.seats; i++) out.push({ circle_id: c.id, person_id: `_seat${i}`, role: 'member', active: true });
    if (c.mentor_open === false && !out.some((m) => m.circle_id === c.id && m.role === 'mentor')) out.push({ circle_id: c.id, person_id: '_mentor', role: 'mentor', active: true });
  }
  return out;
}

/** Mentor circles for an opted-in participant: overlap with my future-skill areas, room in the circle, a mentor seat if I mentor. */
export function rankCircles(p: WfnParticipant, circles: WfnCircle[], members: WfnMember[], area: Label): Ranked<WfnCircle>[] {
  const out: Ranked<WfnCircle>[] = [];
  for (const c of circles) {
    if (c.status !== 'active') continue;
    const reasons: Reason[] = [];
    const overlap = c.focus.filter((f) => p.interests.includes(f)).sort();
    const open = circleOpen(c, members);
    const mine = members.some((m) => m.circle_id === c.id && m.person_id === p.person_id && m.active);
    const mentorSeat = p.mentor && !hasMentor(c.id, members);
    let score = 3 * overlap.length + (open ? 1 : 0) + (mentorSeat ? 1 : 0);
    for (const f of overlap) reasons.push(r('wc_focus', { area: area(f) }));
    if (!overlap.length) reasons.push(r('wc_explore'));
    reasons.push(r(open ? 'wc_open' : 'wc_full'));
    if (mentorSeat) reasons.push(r('wc_mentor_seat'));
    if (mine) { score = 0; reasons.unshift(r('wc_member')); }
    out.push({ id: c.id, score, reasons, item: c });
  }
  return out.sort((a, b) => b.score - a.score || a.item!.sort - b.item!.sort || (a.id < b.id ? -1 : 1));
}
/** Visiting placements and sponsored study for an opted-in participant: open offers, my areas, the ways I chose to take part. */
export function rankOffers(p: WfnParticipant, offers: WfnOffer[], mine: WfnRequest[], today: string, area: Label): Ranked<WfnOffer>[] {
  const out: Ranked<WfnOffer>[] = [];
  for (const o of offers) {
    if (o.status !== 'open' || o.closes_on < today) continue;
    const reasons: Reason[] = [];
    const overlap = o.focus.filter((f) => p.interests.includes(f)).sort();
    const pref = p.strands.includes(o.strand);
    let score = 3 * overlap.length + (pref ? 2 : 0);
    for (const f of overlap) reasons.push(r('wo_focus', { area: area(f) }));
    if (!overlap.length) reasons.push(r('wo_explore'));
    if (pref) reasons.push(r(`wo_strand_${o.strand}`));
    reasons.push(r('wo_closes', { date: o.closes_on }));
    if (mine.some((q) => q.offer_id === o.id && q.person_id === p.person_id && !['declined', 'withdrawn'].includes(q.status))) { score = 0; reasons.unshift(r('wo_requested')); }
    out.push({ id: o.id, score, reasons, item: o });
  }
  return out.sort((a, b) => b.score - a.score || a.item!.sort - b.item!.sort || (a.id < b.id ? -1 : 1));
}

export interface WfnStatsInput {
  participants: WfnParticipant[];
  members: WfnMember[];
  circles: { id: string; status: string }[];
  requests: WfnRequest[];
  people: { id: string; kind?: string | null; status?: string | null; gender?: string | null }[];
  academyMembers: { person_id: string; status: string }[];
  gigApplications: { person_id: string; status: string; channel: string | null }[];
  nominations: NomLite[];
}
export interface WfnStats {
  network: {
    participants: number | null; mentors: number | null; circle_members: number | null; requests_total: number | null;
    requests: { status: string; n: number | null; suppressed: boolean }[];
    completion: { completed: number | null; base: number | null; rate: number | null; suppressed: boolean };
    progression: { progressed: number | null; rate: number | null; suppressed: boolean };
  };
  pipeline: { id: string; women: number | null; men: number | null; share: number | null; suppressed: boolean }[];
}
export const WFN_PIPELINE = ['staff', 'academies', 'future_gigs', 'future_leaders', 'leadership_academy'] as const;
/**
 * Pipeline metrics, aggregates only. Network counts use active participants only: a withdrawn participant leaves no trace (their
 * memberships and requests are left out). Gender appears only here, as a share per programme, and the whole comparison is suppressed
 * when either group is under minGroup (no subtraction attack). Nothing here ranks anyone.
 */
export function wfnStats(x: WfnStatsInput, minGroup: number): WfnStats {
  const n = (k: number) => (k < minGroup ? null : k);
  const active = x.participants.filter((p) => p.active);
  const ids = new Set(active.map((p) => p.person_id));
  const openCircles = new Set(x.circles.filter((c) => c.status === 'active').map((c) => c.id));
  const reqs = x.requests.filter((q) => ids.has(q.person_id) && q.status !== 'withdrawn');
  const count = (s: string) => reqs.filter((q) => q.status === s).length;
  const completed = count('completed');
  const base = count('placed') + completed;
  const progressed = reqs.filter((q) => q.status === 'completed' && q.outcome === 'progressed').length;
  const gender = new Map(x.people.map((p) => [p.id, p.gender ?? null]));
  const row = (id: string, people: Set<string>) => {
    let w = 0;
    let m = 0;
    for (const p of people) { const g = gender.get(p); if (g === 'f') w++; else if (g === 'm') m++; }
    const suppressed = w < minGroup || m < minGroup;
    return { id, women: suppressed ? null : w, men: suppressed ? null : m, share: suppressed ? null : share(w, w + m), suppressed };
  };
  const nomSet = (pred: (z: NomLite) => boolean) => new Set(x.nominations.filter(pred).map((z) => z.person_id));
  return {
    network: {
      participants: n(active.length), mentors: n(active.filter((p) => p.mentor).length),
      circle_members: n(new Set(x.members.filter((m) => m.active && openCircles.has(m.circle_id) && ids.has(m.person_id)).map((m) => m.person_id)).size),
      requests_total: n(reqs.length),
      requests: WFN_REQUEST_STATUSES.map((s) => ({ status: s, n: n(count(s)), suppressed: count(s) < minGroup })),
      completion: { completed: n(completed), base: n(base), rate: base < minGroup ? null : share(completed, base), suppressed: base < minGroup },
      progression: { progressed: n(progressed), rate: completed < minGroup ? null : share(progressed, completed), suppressed: completed < minGroup },
    },
    pipeline: [
      row('staff', new Set(x.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id))),
      row('academies', new Set(x.academyMembers.filter((a) => !['declined', 'withdrawn'].includes(a.status)).map((a) => a.person_id))),
      row('future_gigs', new Set(x.gigApplications.filter((a) => a.channel && a.status !== 'withdrawn').map((a) => a.person_id))),
      row('future_leaders', nomSet((z) => z.programme_id === FL_PROGRAMME_ID && z.status !== 'declined')),
      row('leadership_academy', nomSet((z) => z.programme_id !== FL_PROGRAMME_ID && (z.status === 'approved' || z.status === 'completed'))),
    ],
  };
}
