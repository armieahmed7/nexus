// M17 wave 2 LocalBackend RPCs (owner: W2 · w2e1, F10 Skill check-ins, F11 Team capability heatmap). Installed through
// makeLocalM17 (backend/local.ts). 1:1 mirror of the SQL in supabase/migrations/20261009121001_kafaa_w2e1_checkins.sql:
// same checks in the same order, same codes, messages, audit rows, ledger action, evidence rows and notifications.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M17Rpc, PersonCard, TeamMember, InboxItem } from './rpc';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import { nowTs } from '../../../data/audit';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { securityComps } from '../badgeRules';
import {
  CHECKIN, CREW_PROFILE, MSG, TARGET, addDaysIso, availabilityOf, checkinBlock, checkinStatus, coverage, crews, defaultGroup, distributions, evidenceLevels,
  groupSkills, groupsOf, inGroup, isActiveStaff, isSecurity, lineManagerOf, peerPool, raterOffsets, ratingId, stateMapOf, targetId, validTargetKey,
  type AssignmentRow, type CheckinSkill, type PersonRow, type RatingLite, type SkillRowLite, type TargetRow,
} from '../checkins';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const hex16 = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const trim = (x: unknown) => String(x ?? '').trim();
const isInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n);

export function makeLocalM17W2(b: LocalBackend, h: LocalRpcHelpers): Pick<M17Rpc,
  'requestCheckin' | 'submitRating' | 'validateCheckin' | 'withdrawCheckin' | 'checkinPeers' | 'checkinInbox' | 'checkinCalibration' | 'teamCoverage' | 'setTeamTarget'> {
  const people = () => b.raw('people') as unknown as PersonRow[];
  const assignments = () => b.raw('role_assignments') as unknown as AssignmentRow[];
  const skillsAll = () => (b.raw('skills') as unknown as SkillRowLite[]).slice().sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0) || cmp(x.id, y.id));
  const sec = () => securityComps(b.raw('competencies') as never);
  const standardIds = () => new Set((b.raw('qual_standards') as Row[]).map((q) => String(q.id)));
  const card = (id: string | null | undefined): PersonCard | null => {
    const p = id ? (b.rawGet('people', id) as Row) : null;
    return p ? { id: p.id, name_en: p.display_name, name_ar: p.display_name_ar || p.display_name, job_role_id: p.job_role_id ?? null } : null;
  };
  const notify = (id: string, person: string | null, en: string, ar: string, link: string, severity = 'info') => {
    if (!person || !b.rawGet('people', person) || b.rawGet('notifications', id)) return;
    b.rawInsert('notifications', { id, person_id: person, kind: 'skills', title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  /** People mode (Scope/R/W/A: named people) or aggregate (Agg: counts only); the visible pool and its groups. */
  const scope = () => {
    const ctx = b.access();
    const me = b.identity().personId;
    const peopleMode = ctx.has('skills_profile', ['Scope', 'R', 'W', 'A']);
    const agg = ctx.has('skills_profile', ['Agg']);
    const staff = people().filter(isActiveStaff);
    const pool = peopleMode ? staff.filter((p) => ctx.ruleRead('skills_profile', p.id, null, true)) : staff;
    return { ctx, me, peopleMode, agg, pool, groups: groupsOf(pool), mePerson: people().find((p) => p.id === me) };
  };

  return {
    // ───────────── F10 request
    async requestCheckin(input) {
      await b.whenReady();
      type R = { id: string; manager_id: string; due_on: string };
      const me = b.identity().personId;
      const refuse = (code: string, msg: string, role: string | null = null, entity: string | null = null) => h.refuse<R>('skills.checkin.request', 'skill_checkins', entity, code, msg, role);
      if (!me) return refuse('not_signed_in', MSG.not_signed_in);
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', MSG.forbidden_request);
      const list = Array.isArray(input?.skills) ? input.skills : [];
      if (list.length < 1 || list.length > CHECKIN.MAX_SKILLS) return refuse('invalid', MSG.skills_count, role);
      const ids = list.map((s) => trim(s?.skill_id));
      if (new Set(ids).size !== ids.length) return refuse('invalid', MSG.skills_duplicate, role);
      const evidence = b.raw('skill_evidence') as Row[];
      const secC = sec(), std = standardIds();
      const items: CheckinSkill[] = [];
      for (const s of list) {
        const sk = b.rawGet('skills', trim(s.skill_id)) as unknown as SkillRowLite | undefined;
        if (!sk) return refuse('not_found', MSG.skill_not_found, role, trim(s.skill_id) || null);
        const block = checkinBlock(sk, { secComps: secC, standardIds: std, evidence, person: me });
        if (block === 'security_restricted') return refuse(block, MSG.security, role, sk.id);
        if (block === 'qualification_only') return refuse(block, MSG.qualification, role, sk.id);
        if (!isInt(s.self_level) || s.self_level < 1 || s.self_level > 4) return refuse('invalid', MSG.self_level, role, sk.id);
        const note = trim(s.note);
        if (note.length < CHECKIN.NOTE_MIN || note.length > CHECKIN.NOTE_MAX) return refuse('invalid', MSG.note, role, sk.id);
        items.push({ skill_id: sk.id, self_level: s.self_level, note });
      }
      const open = (b.raw('skill_checkins') as Row[]).filter((c) => c.person_id === me && c.status === 'open');
      for (const it of items) if (open.some((c) => (c.skills ?? []).some((x: CheckinSkill) => x.skill_id === it.skill_id))) return refuse('conflict', MSG.open_skill, role, it.skill_id);
      if (open.length >= CHECKIN.OPEN_MAX) return refuse('limit', MSG.open_max, role);
      const peerIds = Array.isArray(input?.peer_ids) ? input.peer_ids.map(trim) : [];
      if (peerIds.length > CHECKIN.MAX_PEERS) return refuse('invalid', MSG.peers_count, role);
      const today = todayIso();
      const pool = peerPool(me, people(), assignments(), today).peers.map((p) => p.id);
      if (new Set(peerIds).size !== peerIds.length || peerIds.some((p) => !pool.includes(p))) return refuse('not_peer', MSG.peer_invalid, role);
      const manager = lineManagerOf(me, people(), assignments(), today);
      if (!manager) return refuse('no_manager', MSG.no_manager, role);
      const message = trim(input?.message);
      if (message.length > CHECKIN.MESSAGE_MAX) return refuse('invalid', MSG.message, role);
      const id = `chk-${hex16()}`;
      const due = addDaysIso(today, CHECKIN.DUE_DAYS);
      const at = nowTs();
      b.rawInsert('skill_checkins', { id, person_id: me, manager_id: manager, peer_ids: peerIds, skills: items, message: message || null, status: 'open', requested_at: at, due_on: due, decided_by: null, decided_at: null, decision_note: null } as never);
      for (const it of items) {
        b.rawInsert('skill_ratings', { id: ratingId(id, me, it.skill_id), checkin_id: id, subject_id: me, rater_person_id: me, rater_kind: 'self', skill_id: it.skill_id, level: it.self_level, example: it.note, status: 'submitted', requested_at: at, at } as never);
        b.rawInsert('skill_ratings', { id: ratingId(id, manager, it.skill_id), checkin_id: id, subject_id: me, rater_person_id: manager, rater_kind: 'manager', skill_id: it.skill_id, level: null, example: null, status: 'pending', requested_at: at, at: null } as never);
        for (const p of peerIds) b.rawInsert('skill_ratings', { id: ratingId(id, p, it.skill_id), checkin_id: id, subject_id: me, rater_person_id: p, rater_kind: 'peer', skill_id: it.skill_id, level: null, example: null, status: 'pending', requested_at: at, at: null } as never);
      }
      notify(`nt-${id}-mgr`, manager, 'Skill check-in to validate', 'تقييم مهارات بانتظار اعتمادك', '/team/skills/validate');
      for (const p of peerIds) notify(`nt-${id}-${p}`, p, 'A colleague asked you to rate a skill', 'طلب منك زميل تقييم مهارة', '/my/skills/checkins');
      return h.done<R>('skills.checkin.request', 'skill_checkins', id, `${items.map((i) => i.skill_id).join(',')}; manager ${manager}; ${peerIds.length} peer(s)`, role, null, '', 'Check-in sent to your line manager', { id, manager_id: manager, due_on: due }, ['skill_checkins', 'skill_ratings', 'notifications']);
    },

    // ───────────── F10 peer rating
    async submitRating(input) {
      await b.whenReady();
      type R = { submitted: number };
      const me = b.identity().personId;
      const cid = trim(input?.checkin_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.checkin.rate', 'skill_ratings', cid || null, code, msg, role);
      if (!me) return refuse('not_signed_in', MSG.not_signed_in);
      const role = b.access().actingRole('skills_profile', ['Own']);
      if (!role) return refuse('forbidden', MSG.forbidden_request);
      const mine = (b.raw('skill_ratings') as Row[]).filter((r) => r.checkin_id === cid && r.rater_person_id === me && r.rater_kind === 'peer');
      const c = b.rawGet('skill_checkins', cid) as Row;
      if (!mine.length || !c) return refuse('not_found', MSG.checkin_not_found, role);
      if (c.status !== 'open') return refuse('conflict', MSG.closed, role);
      const list = Array.isArray(input?.ratings) ? input.ratings : [];
      if (!list.length) return refuse('invalid', MSG.rating_skill, role);
      for (const r of list) {
        if (!mine.some((m) => m.skill_id === trim(r.skill_id))) return refuse('invalid', MSG.rating_skill, role);
        if (!isInt(r.level) || r.level < 0 || r.level > 4) return refuse('invalid', MSG.rating_level, role);
        const ex = trim(r.example);
        if (r.level > 0 && (ex.length < 3 || ex.length > CHECKIN.EXAMPLE_MAX)) return refuse('invalid', MSG.rating_example, role);
        if (ex.length > CHECKIN.EXAMPLE_MAX) return refuse('invalid', MSG.rating_example, role);
      }
      const at = nowTs();
      for (const r of list) {
        const row = mine.find((m) => m.skill_id === trim(r.skill_id))!;
        b.rawUpdate('skill_ratings', row.id, { level: r.level > 0 ? r.level : null, example: trim(r.example) || null, status: r.level > 0 ? 'submitted' : 'not_observed', at } as never);
      }
      notify(`nt-${cid}-peer-${me}`, c.person_id, 'A colleague answered your skill check-in', 'أجاب زميل على طلب تقييم مهاراتك', '/my/skills/checkins');
      return h.done<R>('skills.checkin.rate', 'skill_ratings', cid, `${list.length} rating(s) as peer`, role, null, '', 'Thank you: your ratings were sent', { submitted: list.length }, ['skill_ratings', 'notifications']);
    },

    // ───────────── F10 manager validation
    async validateCheckin(input) {
      await b.whenReady();
      type R = { status: string; written: number };
      const me = b.identity().personId;
      const cid = trim(input?.checkin_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.checkin.validate', 'skill_checkins', cid || null, code, msg, role);
      if (!me) return refuse('not_signed_in', MSG.not_signed_in);
      const ctx = b.access();
      const c = b.rawGet('skill_checkins', cid) as Row;
      if (!c) return refuse('not_found', MSG.checkin_not_found);
      if (c.person_id === me) return refuse('self_validate', MSG.self_validate, ctx.actingRole('skills_profile', ['Own']));
      const allowed = (c.manager_id === me && ctx.has('skills_profile', ['Own', 'Scope', 'A'])) || ctx.inScope('skills_profile', c.person_id) || ctx.has('skills_profile', ['A']);
      if (!allowed) return refuse('forbidden', MSG.forbidden_validate);
      const role = ctx.actingRole('skills_profile', ['Scope', 'A']) ?? ctx.actingRole('skills_profile', ['Own']);
      if (c.status !== 'open') return refuse('conflict', MSG.closed, role);
      const decisions = Array.isArray(input?.decisions) ? input.decisions : [];
      const skills = (c.skills ?? []) as CheckinSkill[];
      for (const s of skills) if (decisions.filter((d) => trim(d?.skill_id) === s.skill_id).length !== 1) return refuse('invalid', MSG.decide_all, role);
      if (decisions.length !== skills.length) return refuse('invalid', MSG.decide_all, role);
      for (const d of decisions) {
        const s = skills.find((x) => x.skill_id === trim(d.skill_id))!;
        const why = trim(d.reason);
        if (d.outcome === 'adjust') { if (!isInt(d.level) || d.level! < 1 || d.level! > 4 || d.level === s.self_level || why.length < 3 || why.length > CHECKIN.NOTE_MAX) return refuse('invalid', MSG.adjust, role); }
        else if (d.outcome === 'not_yet') { if (why.length < 3 || why.length > CHECKIN.NOTE_MAX) return refuse('invalid', MSG.not_yet, role); }
        else if (d.outcome !== 'validate') return refuse('invalid', MSG.decide_all, role);
      }
      const today = todayIso();
      const at = nowTs();
      const evidence = b.raw('skill_evidence') as Row[];
      const secC = sec(), std = standardIds();
      let written = 0;
      const out: CheckinSkill[] = [];
      for (const s of skills) {
        const d = decisions.find((x) => trim(x.skill_id) === s.skill_id)!;
        const why = trim(d.reason) || null;
        const sk = b.rawGet('skills', s.skill_id) as unknown as SkillRowLite;
        const blocked = !sk || checkinBlock(sk, { secComps: secC, standardIds: std, evidence, person: c.person_id }) !== null;
        const outcome = blocked ? 'qualification_only' : d.outcome;
        const final = outcome === 'validate' ? s.self_level : outcome === 'adjust' ? Number(d.level) : null;
        out.push({ ...s, outcome, final_level: final, reason: why });
        // the validator's own manager rating row
        const rid = ratingId(cid, me, s.skill_id);
        const mrow = { level: final, example: why ?? (outcome === 'validate' ? 'Validated' : null), status: 'submitted', at };
        if (b.rawGet('skill_ratings', rid)) b.rawUpdate('skill_ratings', rid, mrow as never);
        else b.rawInsert('skill_ratings', { id: rid, checkin_id: cid, subject_id: c.person_id, rater_person_id: me, rater_kind: 'manager', skill_id: s.skill_id, requested_at: at, ...mrow } as never);
        if (final == null) continue;
        const claim = (b.raw('skill_claims') as Row[]).filter((x) => x.person_id === c.person_id && x.skill_id === s.skill_id && x.status === 'claimed').sort((x, y) => cmp(String(y.created_at), String(x.created_at)) || cmp(x.id, y.id))[0];
        const note = why ?? `Validated in check-in ${cid}`;
        if (claim) {
          b.rawUpdate('skill_claims', claim.id, { status: final >= Number(claim.level) ? 'validated' : 'rejected', decided_by: me, decided_at: at, decision_note: `Check-in ${cid}: level ${final}${why ? ` (${why})` : ''}` } as never);
          const ev = `se:rating:${claim.id}:${s.skill_id}`;
          if (b.rawGet('skill_evidence', ev)) b.rawUpdate('skill_evidence', ev, { level: final, basis: 'validated', status: 'current', observed_on: today, note, recorded_by: me, active: true } as never);
          else b.rawInsert('skill_evidence', { id: ev, person_id: c.person_id, skill_id: s.skill_id, kind: 'rating', ref_table: 'skill_claims', ref_id: claim.id, level: final, basis: 'validated', status: 'current', observed_on: today, note, recorded_by: me, active: true, created_at: at } as never);
        } else {
          const ev = `se:rating:${cid}:${s.skill_id}`;
          if (!b.rawGet('skill_evidence', ev)) b.rawInsert('skill_evidence', { id: ev, person_id: c.person_id, skill_id: s.skill_id, kind: 'rating', ref_table: 'skill_checkins', ref_id: cid, level: final, basis: 'validated', status: 'current', observed_on: today, note, recorded_by: me, active: true, created_at: at } as never);
        }
        written++;
      }
      for (const r of (b.raw('skill_ratings') as Row[]).filter((x) => x.checkin_id === cid && x.status === 'pending')) b.rawUpdate('skill_ratings', r.id, { status: 'closed' } as never);
      const status = checkinStatus(out);
      const note = trim(input?.note) || null;
      b.rawUpdate('skill_checkins', cid, { skills: out, status, decided_by: me, decided_at: at, decision_note: note } as never);
      await applySkills(b, c.person_id, today);
      const nV = out.filter((x) => x.outcome === 'validate').length, nA = out.filter((x) => x.outcome === 'adjust').length, nN = out.length - nV - nA;
      notify(`nt-${cid}-done`, c.person_id, 'Your skill check-in was reviewed', 'تمت مراجعة طلب تقييم مهاراتك', '/my/skills/checkins', status === 'validated' ? 'ok' : 'info');
      return h.done<R>('skills.checkin.validate', 'skill_checkins', cid, `${status}: ${nV} validated, ${nA} adjusted, ${nN} not yet`, role, 'kafaa.skills.checkin.validate', `Check-in ${cid}: ${nV} validated, ${nA} adjusted, ${nN} not yet`, status === 'validated' ? 'Check-in validated' : 'Check-in decided with adjustments', { status, written }, ['skill_checkins', 'skill_ratings', 'skill_evidence', 'skill_claims', 'person_skills', 'notifications']);
    },

    async withdrawCheckin(checkinId, reason) {
      await b.whenReady();
      const me = b.identity().personId;
      const cid = trim(checkinId);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse('skills.checkin.withdraw', 'skill_checkins', cid || null, code, msg, role);
      if (!me) return refuse('not_signed_in', MSG.not_signed_in);
      const role = b.access().actingRole('skills_profile', ['Own']);
      const c = b.rawGet('skill_checkins', cid) as Row;
      if (!c || c.person_id !== me || !role) return refuse('not_found', MSG.withdraw_not_found, role);
      if (c.status !== 'open') return refuse('conflict', MSG.closed, role);
      const why = trim(reason).slice(0, CHECKIN.NOTE_MAX) || null;
      b.rawUpdate('skill_checkins', cid, { status: 'withdrawn', decided_by: me, decided_at: nowTs(), decision_note: why } as never);
      for (const r of (b.raw('skill_ratings') as Row[]).filter((x) => x.checkin_id === cid && x.status === 'pending')) b.rawUpdate('skill_ratings', r.id, { status: 'closed' } as never);
      return h.done('skills.checkin.withdraw', 'skill_checkins', cid, why ?? 'withdrawn', role, null, '', 'Check-in withdrawn', undefined, ['skill_checkins', 'skill_ratings']);
    },

    // ───────────── F10 reads
    async checkinPeers() {
      await b.whenReady();
      const me = b.identity().personId;
      if (!me || !b.access().has('skills_profile', ['Own'])) throw new Error("Kafa'a · skill check-ins are for staff");
      const today = todayIso();
      const pool = peerPool(me, people(), assignments(), today);
      return { me, manager: card(lineManagerOf(me, people(), assignments(), today)), basis: pool.basis, peers: pool.peers.map((p) => card(p.id)!) };
    },
    async checkinInbox() {
      await b.whenReady();
      const me = b.identity().personId;
      if (!me) throw new Error("Kafa'a · sign in to see rating requests");
      const rows = (b.raw('skill_ratings') as Row[]).filter((r) => r.rater_person_id === me && r.rater_kind === 'peer');
      const ids = [...new Set(rows.map((r) => r.checkin_id))];
      const out: InboxItem[] = [];
      for (const id of ids) {
        const c = b.rawGet('skill_checkins', id) as Row;
        if (!c) continue;
        out.push({
          checkin_id: id, requester: card(c.person_id)!, requested_at: c.requested_at, due_on: c.due_on, message: c.message ?? null, status: c.status,
          items: rows.filter((r) => r.checkin_id === id).sort((x, y) => cmp(x.skill_id, y.skill_id)).map((r) => ({ skill_id: r.skill_id, level: r.level ?? null, example: r.example ?? null, status: r.status })),
        });
      }
      return out.sort((x, y) => cmp(String(y.requested_at), String(x.requested_at)) || cmp(x.checkin_id, y.checkin_id));
    },
    async checkinCalibration(groupKey) {
      await b.whenReady();
      const s = scope();
      if (!s.me || !s.peopleMode) throw new Error("Kafa'a · calibration is for managers in scope");
      const key = groupKey ?? defaultGroup(s.groups, s.mePerson, true);
      const g = s.groups.find((x) => x.key === key);
      const members = g ? s.pool.filter((p) => inGroup(p, g.key)).map((p) => p.id).sort(cmp) : [];
      const mset = new Set(members);
      const cks = (b.raw('skill_checkins') as Row[]).filter((c) => mset.has(c.person_id) && c.status !== 'withdrawn');
      const cset = new Set(cks.map((c) => c.id));
      const ratings = (b.raw('skill_ratings') as Row[]).filter((r) => cset.has(r.checkin_id)) as RatingLite[];
      const secC = sec();
      const order = skillsAll().filter((x) => !isSecurity(x, secC));
      const used = new Set(ratings.map((r) => r.skill_id));
      const skillIds = order.filter((x) => used.has(x.id)).map((x) => x.id);
      const states = stateMapOf((b.raw('person_skills') as Row[]).filter((x) => mset.has(x.person_id)));
      const suppressed = members.length < MIN_GROUP_SIZE;
      const raters = raterOffsets(ratings, evidenceLevels((b.raw('skill_evidence') as Row[]).filter((e) => mset.has(e.person_id)))).map((r) => {
        const c = card(r.rater_id);
        return { ...r, name_en: c?.name_en ?? r.rater_id, name_ar: c?.name_ar ?? r.rater_id };
      });
      return { groups: s.groups, group: g ? g.key : key, size: members.length, suppressed, checkins: cks.length, distributions: distributions(skillIds, members, states, ratings, suppressed), raters };
    },

    // ───────────── F11
    async teamCoverage(groupKey) {
      await b.whenReady();
      const s = scope();
      if (!s.me || (!s.peopleMode && !s.agg)) throw new Error("Kafa'a · team capability is for managers in scope and HR aggregates");
      const key = groupKey ?? defaultGroup(s.groups, s.mePerson, s.peopleMode);
      const g = s.groups.find((x) => x.key === key);
      const mem = g ? s.pool.filter((p) => inGroup(p, g.key)).sort((x, y) => cmp(x.id, y.id)) : [];
      const ids = mem.map((p) => p.id);
      const size = ids.length;
      const suppressed = !s.peopleMode && size < MIN_GROUP_SIZE;
      const allTargets = (b.raw('team_skill_targets') as unknown as (TargetRow & { id: string; horizon?: string | null })[]).filter((t) => (t.horizon ?? 'current') === 'current'); // FS84: F11 reads current targets only
      const targets = allTargets.filter((t) => t.active !== false && g && t.team_id === g.key).map(tgt).sort((x, y) => cmp(x.skill_id, y.skill_id));
      const profile = allTargets.filter((t) => t.active !== false && t.team_id === CREW_PROFILE).map(tgt).sort((x, y) => cmp(x.skill_id, y.skill_id));
      const crewPeople = s.peopleMode ? s.pool.filter((p) => !!p.crew) : [];
      const want = new Set([...ids, ...crewPeople.map((p) => p.id)]);
      const states = stateMapOf((b.raw('person_skills') as Row[]).filter((x) => want.has(x.person_id)));
      const memberStates = stateMapOf((b.raw('person_skills') as Row[]).filter((x) => ids.includes(x.person_id)));
      const all = skillsAll();
      const secC = sec();
      const cols = groupSkills(all, secC, suppressed ? [] : ids, memberStates, targets);
      const colSet = new Set(cols.map((c) => c.id));
      const now = new Date(), today = todayIso();
      const avail = new Map(crewPeople.map((p) => [p.id, availabilityOf(p.id, b.raw('licences') as Row[], b.raw('medical_due') as Row[], now, today)]));
      const cells = s.peopleMode
        ? [...memberStates.values()].filter((x) => colSet.has(x.skill_id)).map((x) => ({ p: x.person_id, s: x.skill_id, l: x.level, b: x.basis })).sort((x, y) => cmp(x.p, y.p) || cmp(x.s, y.s))
        : [];
      const members: TeamMember[] = s.peopleMode ? mem.map((p) => ({ id: p.id, name_en: p.display_name ?? p.id, name_ar: p.display_name_ar || p.display_name || p.id, initials: (p as Row).initials ?? '', job_role_id: p.job_role_id ?? null, crew: p.crew ?? null, team_id: p.team_id ?? null })) : [];
      return {
        mode: s.peopleMode ? 'people' as const : 'aggregate' as const, groups: s.groups, group: g ? g.key : key, size, suppressed, members, skills: cols.map((c) => c.id), cells,
        coverage: coverage(cols, ids, memberStates, targets, { suppressed, holders: s.peopleMode }), targets, crew_profile: profile,
        crews: s.peopleMode ? crews(crewPeople, states, profile, avail, all) : [],
      };
    },
    async setTeamTarget(input) {
      await b.whenReady();
      type R = { id: string };
      const me = b.identity().personId;
      const key = trim(input?.team_id), skillId = trim(input?.skill_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skills.target.set', 'team_skill_targets', key && skillId ? targetId(key, skillId) : null, code, msg, role);
      if (!me) return refuse('not_signed_in', MSG.not_signed_in);
      const ctx = b.access();
      const role = ctx.actingRole('skills_profile', ['A']) ?? ctx.actingRole('skills_profile', ['Scope']);
      if (!role) return refuse('forbidden', MSG.forbidden_target);
      if (!validTargetKey(key)) return refuse('invalid', MSG.target_group, role);
      const staff = people().filter(isActiveStaff).filter((p) => (key === CREW_PROFILE ? !!p.crew : inGroup(p, key)));
      if (!staff.length) return refuse('not_found', MSG.target_group, role);
      if (!ctx.has('skills_profile', ['A']) && !staff.some((p) => ctx.inScope('skills_profile', p.id))) return refuse('forbidden', MSG.forbidden_target, role);
      const sk = b.rawGet('skills', skillId) as unknown as SkillRowLite | undefined;
      if (!sk) return refuse('not_found', MSG.skill_not_found, role);
      if (isSecurity(sk, sec())) return refuse('security_restricted', MSG.security, role);
      const active = input?.active !== false;
      const minP = Number(input?.min_people), minL = Number(input?.min_level);
      if (active && (!isInt(minP) || minP < 1 || minP > TARGET.MIN_PEOPLE_MAX || !isInt(minL) || minL < 1 || minL > 4)) return refuse('invalid', MSG.target_values, role);
      const id = targetId(key, skillId);
      const prev = b.rawGet('team_skill_targets', id) as Row;
      const row = { team_id: key, skill_id: skillId, min_people: active ? minP : Number(prev?.min_people ?? TARGET.DEFAULT_PEOPLE), min_level: active ? minL : Number(prev?.min_level ?? sk.key_level), note: trim(input?.note).slice(0, CHECKIN.NOTE_MAX) || null, active, set_by: me, updated_at: nowTs() };
      if (prev) b.rawUpdate('team_skill_targets', id, row as never);
      else b.rawInsert('team_skill_targets', { id, ...row } as never);
      return h.done<R>('skills.target.set', 'team_skill_targets', id, active ? `${minP} at level ${minL}` : 'cleared', role, null, '', active ? 'Target saved' : 'Target cleared', { id }, ['team_skill_targets']);
    },
  };
}
const tgt = (t: Row): TargetRow => ({ team_id: t.team_id, skill_id: t.skill_id, min_people: Number(t.min_people), min_level: Number(t.min_level), active: t.active !== false, note: t.note ?? null });
