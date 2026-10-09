// M23 LocalBackend RPC implementations (owner: W3 · E1 · F18 Talent review, F19 Succession planning).
// 1:1 mirror of supabase/migrations/20261009131001_kafaa_w3e1_talent.sql: same checks in the same order, the same refusal codes and
// messages (src/modules/m23/domain.ts MSG), the same audit rows and ledger rows. Pages never import this file.
// Audited reads announce only `audit_events` (an empty list would make every open query refetch, and the read would loop).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { levelsOf, type PlatformRole } from '../../../auth/policy';
import { careerReadiness } from '../../m18/career';
import { careerDataFrom } from '../../m18/backend/local';
import { lineManagerOf, type AssignmentLite, type PersonLite } from '../../m20/domain';
import {
  ANCHORS, CANDIDATE_LIMIT, MSG, NOTE_MAX, NOTE_MIN, READINESS, READY_RANK, SUCCESSOR_ACTION_KINDS, WITHDRAW_MSG,
  benchCounts, boxOf, candidateReasons, critId, cutsOf, evidenceOf, feederRoles, flagsOf, gatesMet, hardGatesOf, isHipo, isPeriod, membersOf,
  normActions, perfFromRating, potentialOf, readinessOf, slateFlags, slateInScope, slateLoad, successionAggregatesOf, talentAggregatesOf,
  type DevAction, type EvidenceSnapshot, type HardGate, type Readiness, type SuccessorLite,
} from '../domain';
import type { BoardMember, Candidate, CycleSummary, M23Rpc, PlacementView, SlateView, SuccessionBoard, SuccessorView, TalentBoard } from './rpc';

type Row = Record<string, unknown>;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const str = (x: unknown) => (typeof x === 'string' ? x : '');
const isInt = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

export function makeLocalM23(b: LocalBackend, h: LocalRpcHelpers): M23Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string) => b.rawGet(t as never, id) as unknown as Row | undefined;
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const person = (id: string | null | undefined) => (id ? get('people', id) : undefined);
  const nameOf = (id: string | null | undefined) => { const p = person(id); return { en: p ? str(p.display_name) : '', ar: p ? str(p.display_name_ar) || str(p.display_name) : '' }; };
  const people = () => raw('people') as unknown as PersonLite[];
  const assignments = () => raw('role_assignments') as unknown as AssignmentLite[];
  const lm = (pid: string) => lineManagerOf(pid, people(), assignments(), todayIso());
  const hasRole = (r: PlatformRole) => ctx().roles.includes(r);
  /** Line manager of the person: a manager in scope (talent_review Scope) or the line manager of record. */
  const canPlace = (pid: string) => {
    const who = me();
    if (!who || pid === who || !hasRole('manager')) return false;
    return ctx().inScope('talent_review', pid) || lm(pid) === who;
  };
  /** Board visibility: R/W/A sees everyone; Scope holders see people in scope or their reports of record. Never themselves. */
  const sees = (pid: string) => {
    const who = me();
    if (!who || pid === who) return false;
    const c = ctx();
    if (c.has('talent_review', ['R', 'W', 'A'])) return true;
    return c.has('talent_review', ['Scope']) && (c.inScope('talent_review', pid) || lm(pid) === who);
  };
  const members = (cycle: Row) => membersOf((cycle.family_ids as string[]) ?? [], raw('people') as never, raw('role_assignments') as never, todayIso());
  const evidence = (pid: string, now = todayIso()): EvidenceSnapshot => evidenceOf({
    states: raw('person_skills').filter((s) => s.person_id === pid) as never,
    evidence: raw('skill_evidence').filter((s) => s.person_id === pid) as never,
    skills: raw('skills') as never,
  }, now);
  const perfRec = (pid: string) => {
    const r = raw('perf_ratings').filter((x) => x.person_id === pid).sort((a, c) => cmp(str(c.period), str(a.period)) || cmp(str(a.id), str(c.id)))[0];
    return r ? { period: str(r.period), rating: Number(r.rating) } : null;
  };
  const placementOf = (cycleId: string, pid: string) => get('review_placements', `tp:${cycleId}:${pid}`);
  /** Index per member: the placement's snapshot when placed, else the live evidence. */
  const indices = (cycle: Row, ids = members(cycle)) => {
    const out = new Map<string, { ev: EvidenceSnapshot; index: number }>();
    for (const pid of ids) {
      const ev = evidence(pid);
      const p = placementOf(String(cycle.id), pid);
      out.set(pid, { ev, index: p ? Number(p.evidence_index) : ev.index });
    }
    return out;
  };
  const cycleSummary = (c: Row, ids: string[]): CycleSummary => {
    const view = ids.filter(sees);
    const pl = view.map((pid) => placementOf(String(c.id), pid)).filter(Boolean) as Row[];
    return {
      id: str(c.id), code: str(c.code), title_en: str(c.title_en), title_ar: str(c.title_ar), period: str(c.period), family_ids: (c.family_ids as string[]) ?? [],
      status: c.status as CycleSummary['status'], opened_on: str(c.opened_on), due_on: (c.due_on as string) ?? null, members: ids.length, in_view: view.length,
      placed_in_view: pl.length, calibrated_in_view: pl.filter((p) => p.calibrated).length, locked_at: (c.locked_at as string) ?? null, calibrated_at: (c.calibrated_at as string) ?? null,
    };
  };
  const reviewRole = () => ctx().actingRole('talent_review', ['R', 'A', 'Scope']);
  const facilitatorRole = (): string | null => {
    const c = ctx();
    if (c.has('talent_review', ['A'])) return c.actingRole('talent_review', ['A']);
    if (c.roleGrant('hr_analyst', 'talent_review', 'Scope')) return 'hr_analyst';
    return null;
  };
  const hist = (action: string, extra: Row) => ({ at: nowTs(), by: me(), action, ...extra });

  // ───────────── F19 helpers
  const successorsLite = () => raw('successors') as unknown as SuccessorLite[];
  const scopeAssignments = () => b.identity().assignments.filter((a) => a.status === 'active' && levelsOf(a.role, 'talent_review').includes('Scope'));
  const slateVisible = (s: Row) => ctx().has('talent_review', ['R', 'W', 'A']) || slateInScope(s as never, scopeAssignments() as never);
  const roleRow = (id: string) => get('job_roles', id);
  const gateData = (pid: string) => ({
    person: person(pid) as never,
    licences: raw('licences').filter((l) => l.person_id === pid) as never,
    standards: raw('qual_standards') as never,
    qualRecords: raw('qual_records').filter((q) => q.person_id === pid) as never,
  });
  const assess = (pid: string, roleId: string, today = todayIso()) => {
    const cr = careerReadiness(careerDataFrom(b, pid), pid, [roleId], today)[0] ?? null;
    const gates = hardGatesOf(roleId, gateData(pid), cr, today);
    return { cr, gates, readiness: readinessOf(cr, gates) };
  };
  const successorView = (s: Row, load: Map<string, number>): SuccessorView => ({
    id: str(s.id), person_id: (s.person_id as string) ?? null, cover_source: s.cover_source as SuccessorView['cover_source'], cover_label_en: str(s.cover_label_en), cover_label_ar: str(s.cover_label_ar),
    readiness: (s.readiness as Readiness) ?? null, computed_readiness: (s.computed_readiness as Readiness) ?? null, readiness_pct: (s.readiness_pct as number) ?? null, months: (s.months as number) ?? null,
    gates: (s.gates as HardGate[]) ?? [], gaps: (s.gaps as SuccessorView['gaps']) ?? [], emergency: !!s.emergency, actions: (s.actions as DevAction[]) ?? [], note: (s.note as string) ?? null,
    status: s.status as SuccessorView['status'], slates: s.person_id ? load.get(s.person_id as string) ?? 0 : 0, person_name: str(s.person_name), person_name_ar: str(s.person_name_ar),
    person_role_id: (s.person_role_id as string) ?? null, confirmed_at: (s.confirmed_at as string) ?? null, proposed_at: str(s.proposed_at),
  });

  return {
    // ───────────────────────────── F18
    async talentCycles() {
      await b.whenReady();
      type R = CycleSummary[];
      if (!me()) return h.refuse<R>('talent.cycles', 'review_cycles', null, 'not_signed_in', MSG.not_signed_in);
      if (!reviewRole()) return h.refuse<R>('talent.cycles', 'review_cycles', null, 'forbidden', MSG.forbidden_review);
      const all = ctx().has('talent_review', ['R', 'W', 'A']);
      const out = raw('review_cycles')
        .map((c) => cycleSummary(c, members(c)))
        .filter((c) => all || c.in_view > 0)
        .sort((a, c) => cmp(c.period, a.period) || cmp(a.code, c.code));
      return { ok: true, code: 'ok', message: '', audit_seq: null, ledger_seq: null, data: out } as Result<R>;
    },

    async talentBoard(cycleId) {
      await b.whenReady();
      type R = TalentBoard;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('talent.board_read', 'review_placements', cycleId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const role = reviewRole();
      if (!role) return refuse('forbidden', MSG.forbidden_review);
      const c = cycleId ? get('review_cycles', cycleId) : undefined;
      const all = ctx().has('talent_review', ['R', 'W', 'A']);
      const ids = c ? members(c) : [];
      const view = ids.filter(sees);
      if (!c || (!all && view.length === 0)) return refuse('not_found', MSG.cycle_not_found, role);
      const idx = indices(c, ids);
      const cuts = cutsOf(ids.map((pid) => idx.get(pid)!.index));
      const pls = ids.map((pid) => placementOf(String(c.id), pid)).filter(Boolean) as Row[];
      const out: BoardMember[] = view.map((pid) => {
        const p = person(pid)!;
        const pl = placementOf(String(c.id), pid);
        const { ev, index } = idx.get(pid)!;
        const rec = perfRec(pid);
        const placement: PlacementView | null = pl ? {
          id: str(pl.id), perf: Number(pl.perf), potential: Number(pl.potential), anchors: (pl.anchors as PlacementView['anchors']) ?? {}, box: Number(pl.box), hipo: !!pl.hipo,
          perf_record: (pl.perf_record as number) ?? null, evidence_index: Number(pl.evidence_index), evidence_snapshot: (pl.evidence_snapshot as EvidenceSnapshot) ?? {},
          placed_by: str(pl.placed_by), placed_by_name: nameOf(str(pl.placed_by)).en, placed_by_name_ar: nameOf(str(pl.placed_by)).ar, placed_at: str(pl.placed_at),
          calibrated: !!pl.calibrated, calibrated_at: (pl.calibrated_at as string) ?? null, note: (pl.note as string) ?? null, actions: (pl.actions as DevAction[]) ?? [],
          status: pl.status as PlacementView['status'], history: (pl.history as unknown[]) ?? [],
        } : null;
        return {
          person_id: pid, name: str(p.display_name), name_ar: str(p.display_name_ar) || str(p.display_name), role_id: (p.job_role_id as string) ?? null, family_id: (p.job_family_id as string) ?? null,
          crew: (p.crew as string) ?? null, team_id: (p.team_id as string) ?? null, perf_rating: rec, suggested_perf: perfFromRating(rec?.rating),
          evidence: ev, index, flags: placement ? flagsOf(placement.potential, index, cuts) : [], can_place: c.status === 'open' && canPlace(pid), placement,
        };
      });
      const maker = pls.some((p) => p.placed_by === who || p.calibrated_by === who) || c.calibrated_by === who;
      const lockBlocker: TalentBoard['can']['lock_blocker'] = c.status === 'locked' ? 'locked' : c.status !== 'calibration' || !c.calibrated_at ? 'not_calibrated' : maker ? 'maker_checker' : null;
      const data: TalentBoard = {
        cycle: {
          id: str(c.id), code: str(c.code), title_en: str(c.title_en), title_ar: str(c.title_ar), period: str(c.period), family_ids: (c.family_ids as string[]) ?? [], status: c.status as TalentBoard['cycle']['status'],
          opened_on: str(c.opened_on), due_on: (c.due_on as string) ?? null, calibration_started_at: (c.calibration_started_at as string) ?? null,
          calibrated_by: (c.calibrated_by as string) ?? null, calibrated_name: c.calibrated_by ? nameOf(str(c.calibrated_by)).en : null, calibrated_at: (c.calibrated_at as string) ?? null,
          locked_by: (c.locked_by as string) ?? null, locked_name: c.locked_by ? nameOf(str(c.locked_by)).en : null, locked_at: (c.locked_at as string) ?? null, lock_note: (c.lock_note as string) ?? null,
        },
        view: all ? 'all' : 'scope',
        members_total: ids.length,
        placed_total: pls.length,
        cuts,
        can: { place: out.some((m) => m.can_place), calibrate: !!facilitatorRole() && c.status !== 'locked', lock: ctx().has('talent_review', ['A']) && lockBlocker === null, lock_blocker: ctx().has('talent_review', ['A']) ? lockBlocker : null },
        members: out,
      };
      return h.done<R>('talent.board_read', 'review_placements', String(c.id), `${out.length} people`, role, null, '', '', data, ['audit_events']);
    },

    async placeTalent(input) {
      await b.whenReady();
      type R = { id: string; box: number; potential: number; hipo: boolean; flags: ReturnType<typeof flagsOf> };
      const inp = (input && typeof input === 'object' ? input : {}) as Partial<typeof input>;
      const cid = str(inp.cycle_id);
      const pid = str(inp.person_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('talent.place', 'review_placements', cid && pid ? `tp:${cid}:${pid}` : null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      if (!hasRole('manager') || !ctx().has('talent_review', ['Scope'])) return refuse('forbidden', MSG.forbidden_place);
      const role = 'manager';
      const c = get('review_cycles', cid);
      if (!c) return refuse('not_found', MSG.cycle_not_found, role);
      if (c.status === 'locked') return refuse('cycle_locked', MSG.cycle_locked, role);
      if (c.status === 'calibration') return refuse('in_calibration', MSG.in_calibration, role);
      if (pid === who) return refuse('self', MSG.self, role);
      const ids = members(c);
      if (!ids.includes(pid)) return refuse('not_member', MSG.not_member, role);
      if (!canPlace(pid)) return refuse('not_in_scope', MSG.not_in_scope, role);
      const anchors = (inp.anchors && typeof inp.anchors === 'object' ? inp.anchors : {}) as Record<string, unknown>;
      const potential = potentialOf(anchors as never);
      if (!isInt(inp.perf, 1, 3) || potential == null) return refuse('invalid', MSG.invalid_scores, role);
      const perf = inp.perf as number;
      const note = str(inp.note).trim();
      if (note.length > NOTE_MAX) return refuse('invalid', MSG.invalid_note, role);
      const rec = perfRec(pid);
      const suggested = perfFromRating(rec?.rating);
      if (suggested != null && perf !== suggested && note.length < NOTE_MIN) return refuse('note_required', MSG.note_required, role);
      const actions = normActions(inp.actions ?? []);
      if (!actions) return refuse('invalid', MSG.invalid_actions, role);
      const ev = evidence(pid);
      const id = `tp:${cid}:${pid}`;
      const cur = get('review_placements', id);
      const box = boxOf(perf, potential);
      const hipo = isHipo(perf, potential);
      const anch = Object.fromEntries(ANCHORS.map((k) => [k, anchors[k] as number]));
      const ts = nowTs();
      const fields = {
        perf, potential, anchors: anch, box, hipo, perf_record: rec?.rating ?? null, evidence_snapshot: ev, evidence_index: ev.index, placed_by: who, placed_at: ts,
        calibrated: false, calibrated_by: null, calibrated_at: null, note: note || null, actions, status: 'placed', updated_at: ts,
      };
      const h1 = hist('placed', { perf, potential, note: note || null });
      if (cur) upd('review_placements', id, { ...fields, history: [...((cur.history as unknown[]) ?? []), h1] });
      else ins('review_placements', { id, cycle_id: cid, person_id: pid, ...fields, history: [h1], listed: true });
      upd('review_cycles', cid, { updated_at: ts });
      const idx = indices(c, ids);
      const flags = flagsOf(potential, ev.index, cutsOf(ids.map((x) => idx.get(x)!.index)));
      return h.done<R>('talent.place', 'review_placements', id, `box ${box}${flags.length ? ` · ${flags.join(',')}` : ''}`, role, null, '', 'Placement saved', { id, box, potential, hipo, flags }, ['review_placements', 'review_cycles']);
    },

    async calibrateCycle(cycleId, changes, finish) {
      await b.whenReady();
      type R = { status: 'open' | 'calibration' | 'locked'; changed: number; calibrated: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('talent.calibrate', 'review_cycles', cycleId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const role = facilitatorRole();
      if (!role) return refuse('forbidden', MSG.forbidden_calibrate);
      const c = cycleId ? get('review_cycles', cycleId) : undefined;
      if (!c) return refuse('not_found', MSG.cycle_not_found, role);
      if (c.status === 'locked') return refuse('cycle_locked', MSG.cycle_locked, role);
      const list = Array.isArray(changes) ? changes : null;
      if (!list || list.length > 60) return refuse('invalid', MSG.calibrate_invalid, role);
      const seen = new Set<string>();
      for (const x of list) {
        const pid = x && typeof x === 'object' ? str(x.person_id) : '';
        if (!pid || seen.has(pid) || !placementOf(String(c.id), pid) || !isInt(x.perf, 1, 3) || !isInt(x.potential, 1, 3)) return refuse('invalid', MSG.calibrate_invalid, role);
        if (pid === who) return refuse('self', MSG.self, role);
        const n = str(x.note).trim();
        if (n.length < NOTE_MIN || n.length > NOTE_MAX) return refuse('note_required', MSG.calibrate_note, role);
        seen.add(pid);
      }
      const ids = members(c);
      if (finish === true && ids.some((pid) => !placementOf(String(c.id), pid))) return refuse('incomplete', MSG.incomplete, role);
      const ts = nowTs();
      const patch: Row = { status: 'calibration', updated_at: ts };
      if (c.status === 'open') Object.assign(patch, { calibration_started_at: ts, calibration_started_by: who });
      for (const x of [...list].sort((a, d) => cmp(a.person_id, d.person_id))) {
        const pl = placementOf(String(c.id), x.person_id)!;
        upd('review_placements', String(pl.id), {
          perf: x.perf, potential: x.potential, box: boxOf(x.perf, x.potential), hipo: isHipo(x.perf, x.potential), calibrated: true, calibrated_by: who, calibrated_at: ts, updated_at: ts,
          history: [...((pl.history as unknown[]) ?? []), hist('calibrated', { perf: x.perf, potential: x.potential, note: str(x.note).trim() })],
        });
      }
      if (finish === true) {
        for (const pid of ids) {
          const pl = placementOf(String(c.id), pid)!;
          if (!pl.calibrated) upd('review_placements', String(pl.id), { calibrated: true, calibrated_by: who, calibrated_at: ts, updated_at: ts });
        }
        Object.assign(patch, { calibrated_by: who, calibrated_at: ts });
      } else if (list.length) Object.assign(patch, { calibrated_by: null, calibrated_at: null });
      upd('review_cycles', String(c.id), patch);
      const calibrated = finish === true || (!list.length && !!c.calibrated_at);
      return h.done<R>('talent.calibrate', 'review_cycles', String(c.id), `${list.length} changes${finish === true ? ' · finished' : ''}`, role, null, '',
        finish === true ? 'Calibration finished: ready for the HR director to lock' : list.length ? `${list.length} placements adjusted` : 'Calibration started', { status: 'calibration', changed: list.length, calibrated }, ['review_cycles', 'review_placements']);
    },

    async lockCycle(cycleId, note) {
      await b.whenReady();
      type R = { status: 'open' | 'calibration' | 'locked'; priorities: number; hipo: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('talent.lock', 'review_cycles', cycleId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const c0 = ctx();
      if (!c0.has('talent_review', ['A'])) return refuse('forbidden', MSG.forbidden_lock);
      const role = c0.actingRole('talent_review', ['A']);
      const c = cycleId ? get('review_cycles', cycleId) : undefined;
      if (!c) return refuse('not_found', MSG.cycle_not_found, role);
      if (c.status === 'locked') return refuse('cycle_locked', MSG.cycle_locked, role);
      if (c.status !== 'calibration' || !c.calibrated_at) return refuse('not_calibrated', MSG.not_calibrated, role);
      const pls = raw('review_placements').filter((p) => p.cycle_id === c.id).sort((a, d) => cmp(str(a.person_id), str(d.person_id)));
      if (c.calibrated_by === who || pls.some((p) => p.placed_by === who || p.calibrated_by === who)) return refuse('maker_checker', MSG.maker_checker, role);
      const text = str(note).trim();
      if (text.length > NOTE_MAX) return refuse('invalid', MSG.invalid_note, role);
      const ts = nowTs();
      const today = todayIso();
      let hipo = 0;
      for (const p of pls) {
        upd('review_placements', String(p.id), { status: 'locked', updated_at: ts, history: [...((p.history as unknown[]) ?? []), hist('locked', {})] });
        const pid = str(p.person_id);
        const tid = `tpr:${c.id}:${pid}`;
        if (!get('talent_priorities', tid)) ins('talent_priorities', { id: tid, person_id: pid, cycle_id: c.id, period: c.period, priorities: p.actions ?? [], agreed_on: today, status: 'agreed', listed: true, created_at: ts });
        if (p.hipo) {
          hipo++;
          const poolId = `pool:${c.id}:${pid}`;
          if (!get('talent_pool', poolId)) ins('talent_pool', { id: poolId, cycle_id: c.id, person_id: pid, pool: 'hipo', since: today, programme_id: 'prog-estadad', status: 'active', listed: true });
        }
        const nid = `nt-tpr-${c.id}-${pid}`;
        if (person(pid) && !get('notifications', nid)) ins('notifications', { id: nid, person_id: pid, kind: 'talent', title_en: 'Development priorities agreed', title_ar: 'تم الاتفاق على أولويات التطوير', link: '/my/development-priorities', severity: 'ok', created_at: ts });
      }
      upd('review_cycles', String(c.id), { status: 'locked', locked_by: who, locked_at: ts, lock_note: text || null, updated_at: ts });
      return h.done<R>('talent.lock', 'review_cycles', String(c.id), `${pls.length} placements, ${hipo} HiPo`, role, 'kafaa.talent.cycle_lock', `Talent review ${c.code} locked: ${pls.length} placements`,
        'Cycle locked: development priorities shared with employees', { status: 'locked', priorities: pls.length, hipo }, ['review_cycles', 'review_placements', 'talent_priorities', 'talent_pool', 'notifications']);
    },

    async talentAggregates(cycleId) {
      await b.whenReady();
      type R = ReturnType<typeof talentAggregatesOf>;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('talent.aggregates', 'review_placements', cycleId ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', MSG.not_signed_in);
      const role = ctx().actingRole('talent_review', ['Agg', 'R', 'A']);
      if (!role) return refuse('forbidden', MSG.forbidden_review);
      if (cycleId && !get('review_cycles', cycleId)) return refuse('not_found', MSG.cycle_not_found, role);
      const data = talentAggregatesOf(cycleId ?? null, raw('review_placements') as never, raw('people') as never, raw('review_cycles').map((c) => str(c.id)));
      return h.done<R>('talent.aggregates', 'review_placements', cycleId ?? null, data.suppressed ? 'suppressed' : `${data.n} placements`, role, null, '', '', data, ['audit_events']);
    },

    // ───────────────────────────── F19
    async successionBoard() {
      await b.whenReady();
      type R = SuccessionBoard;
      if (!me()) return h.refuse<R>('succession.board_read', 'succession_slates', null, 'not_signed_in', MSG.not_signed_in);
      const role = ctx().actingRole('talent_review', ['R', 'A', 'Scope', 'Agg']);
      if (!role) return h.refuse<R>('succession.board_read', 'succession_slates', null, 'forbidden', MSG.forbidden_review);
      const c = ctx();
      const all = c.has('talent_review', ['R', 'W', 'A']);
      const slates = raw('succession_slates').sort((a, d) => Number(a.sort) - Number(d.sort) || cmp(str(a.id), str(d.id)));
      const sx = successorsLite();
      const load = slateLoad(sx);
      const rolls = raw('bench_rollups');
      const out: SlateView[] = slates.filter(slateVisible).map((s) => {
        const roll = rolls.filter((r) => r.slate_id === s.id).sort((a, d) => cmp(str(d.rolled_at), str(a.rolled_at)))[0];
        return {
          id: str(s.id), role_id: str(s.role_id), period: str(s.period), status: s.status as SlateView['status'], entity_id: (s.entity_id as string) ?? null, family_id: (s.family_id as string) ?? null,
          critical: !!s.critical, leadership: !!s.leadership, incumbent_en: str(s.incumbent_en), incumbent_ar: str(s.incumbent_ar), target_bench: Number(s.target_bench),
          confirmed_at: (s.confirmed_at as string) ?? null, confirmed_name: s.confirmed_by ? nameOf(str(s.confirmed_by)).en : null, flags: slateFlags(str(s.id), sx, load),
          successors: raw('successors').filter((x) => x.slate_id === s.id && x.status !== 'withdrawn').sort((a, d) => Number(a.sort) - Number(d.sort) || cmp(str(a.id), str(d.id))).map((x) => successorView(x, load)),
          rolled_up: roll ? { period: str(roll.period), at: str(roll.rolled_at) } : null,
        };
      });
      const agg = c.has('talent_review', ['Agg', 'R', 'A']) ? successionAggregatesOf(slates as never, sx, raw('people') as never) : null;
      const data: R = { view: all ? 'all' : 'function', can: { edit: c.has('talent_review', ['A']), rollup: c.has('talent_review', ['A']) }, slates: out, aggregates: agg };
      return h.done<R>('succession.board_read', 'succession_slates', null, `${out.length} slates`, role, null, '', '', data, ['audit_events']);
    },

    async successionCandidates(slateId) {
      await b.whenReady();
      type R = Candidate[];
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('succession.candidates', 'successors', slateId ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', MSG.not_signed_in);
      const role = ctx().actingRole('talent_review', ['R', 'A', 'Scope']);
      if (!role) return refuse('forbidden', MSG.forbidden_review);
      const s = slateId ? get('succession_slates', slateId) : undefined;
      if (!s || !slateVisible(s)) return refuse('not_found', MSG.slate_not_found, role);
      const roleId = str(s.role_id);
      if (roleRow(roleId)?.security_sensitive) return refuse('path_only', MSG.path_only, role);
      const feeders = feederRoles(roleId, raw('career_paths') as never);
      const hrd = new Set(raw('role_assignments').filter((a) => a.role === 'hr_director' && a.status === 'active').map((a) => str(a.person_id)));
      const load = slateLoad(successorsLite());
      const onSlate = new Set(raw('successors').filter((x) => x.slate_id === s.id && x.status !== 'withdrawn' && x.person_id).map((x) => str(x.person_id)));
      const today = todayIso();
      const out: Candidate[] = raw('people')
        .filter((p) => p.kind === 'staff' && p.status === 'active' && p.id !== me() && !hrd.has(str(p.id)) && (p.job_role_id === roleId || feeders.includes(str(p.job_role_id))))
        .map((p) => {
          const pid = str(p.id);
          const a = assess(pid, roleId, today);
          return {
            person_id: pid, name: str(p.display_name), name_ar: str(p.display_name_ar) || str(p.display_name), role_id: (p.job_role_id as string) ?? null,
            relation: p.job_role_id === roleId ? 'peer' as const : 'feeder' as const, readiness: a.readiness, pct: a.cr?.pct ?? null, months: a.cr?.months ?? null,
            gates: a.gates, gates_met: gatesMet(a.gates), gaps: (a.cr?.gaps ?? []).slice(0, 5), reasons: candidateReasons(a.cr, a.gates), slates: load.get(pid) ?? 0, on_slate: onSlate.has(pid),
          };
        })
        .sort((x, y) => READY_RANK[x.readiness] - READY_RANK[y.readiness] || (y.pct ?? 0) - (x.pct ?? 0) || cmp(x.person_id, y.person_id))
        .slice(0, CANDIDATE_LIMIT);
      return h.done<R>('succession.candidates', 'successors', String(s.id), `${out.length} candidates`, role, null, '', '', out, ['audit_events']);
    },

    async proposeSuccessor(input) {
      await b.whenReady();
      type R = { id: string; readiness: Readiness | null; computed: Readiness | null };
      const inp = (input && typeof input === 'object' ? input : {}) as Partial<typeof input>;
      const sid = str(inp.slate_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('succession.propose', 'successors', sid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', MSG.not_signed_in);
      const c = ctx();
      if (!c.has('talent_review', ['A'])) return refuse('forbidden', MSG.forbidden_succession);
      const role = c.actingRole('talent_review', ['A']);
      const s = get('succession_slates', sid);
      if (!s) return refuse('not_found', MSG.slate_not_found, role);
      if (s.status === 'confirmed') return refuse('slate_confirmed', MSG.slate_confirmed, role);
      const roleId = str(s.role_id);
      if (roleRow(roleId)?.security_sensitive) return refuse('path_only', MSG.path_only, role);
      const source = inp.cover_source ?? 'internal';
      const note = str(inp.note).trim();
      if (note.length > NOTE_MAX) return refuse('invalid', MSG.invalid_note, role);
      const actions = normActions(inp.actions ?? []);
      if (!actions || actions.some((a) => !(SUCCESSOR_ACTION_KINDS as readonly string[]).includes(a.kind))) return refuse('invalid', MSG.invalid_actions, role);
      const emergency = inp.emergency === true;
      const ts = nowTs();
      let id: string;
      let fields: Row;
      let readiness: Readiness | null = null;
      let computed: Readiness | null = null;
      if (source === 'internal') {
        const pid = str(inp.person_id);
        const p = person(pid);
        const hrd = raw('role_assignments').some((a) => a.person_id === pid && a.role === 'hr_director' && a.status === 'active');
        if (!p || p.kind !== 'staff' || p.status !== 'active' || hrd) return refuse('not_found', MSG.person_not_found, role);
        const a = assess(pid, roleId);
        computed = a.readiness;
        readiness = inp.readiness == null ? computed : (inp.readiness as Readiness);
        if (!(READINESS as readonly string[]).includes(readiness)) return refuse('invalid', MSG.invalid_readiness, role);
        if (readiness === 'ready_now' && !gatesMet(a.gates)) return refuse('gate_not_met', MSG.gate_not_met, role);
        if (READY_RANK[readiness] < READY_RANK[computed] && note.length < NOTE_MIN) return refuse('optimistic_note', MSG.optimistic_note, role);
        id = `sx:${sid}:${pid}`;
        fields = {
          person_id: pid, cover_source: 'internal', cover_label_en: '', cover_label_ar: '', readiness, computed_readiness: computed, readiness_pct: a.cr?.pct ?? null, months: a.cr?.months ?? null,
          gates: a.gates, gaps: (a.cr?.gaps ?? []).slice(0, 5), person_name: str(p.display_name), person_name_ar: str(p.display_name_ar) || str(p.display_name), person_role_id: (p.job_role_id as string) ?? null,
        };
      } else if (source === 'khnp' || source === 'contractor') {
        const en = str(inp.cover_label_en).trim();
        const ar = str(inp.cover_label_ar).trim();
        if (inp.person_id || en.length < 3 || ar.length < 3 || en.length > 120 || ar.length > 120) return refuse('invalid', MSG.invalid_cover, role);
        id = `sx:${sid}:ext-${source}`;
        fields = { person_id: null, cover_source: source, cover_label_en: en, cover_label_ar: ar, readiness: null, computed_readiness: null, readiness_pct: null, months: null, gates: [], gaps: [], person_name: '', person_name_ar: '', person_role_id: null };
      } else return refuse('invalid', MSG.invalid_cover, role);
      if (emergency) for (const o of raw('successors').filter((x) => x.slate_id === sid && x.id !== id && x.emergency)) upd('successors', String(o.id), { emergency: false, updated_at: ts });
      const cur = get('successors', id);
      const sort = cur ? Number(cur.sort) : raw('successors').filter((x) => x.slate_id === sid).length + 1;
      const all = { ...fields, emergency, actions, note: note || null, status: 'proposed', proposed_by: who, proposed_at: ts, confirmed_by: null, confirmed_at: null, updated_at: ts, sort };
      if (cur) upd('successors', id, all);
      else ins('successors', { id, slate_id: sid, ...all, listed: true });
      if (s.status === 'draft') upd('succession_slates', sid, { status: 'proposed', updated_at: ts });
      else upd('succession_slates', sid, { updated_at: ts });
      return h.done<R>('succession.propose', 'successors', id, `${source === 'internal' ? str(inp.person_id) : source} ${readiness ?? 'cover'}${emergency ? ' · emergency' : ''}`, role, null, '',
        'Successor proposed', { id, readiness, computed }, ['successors', 'succession_slates']);
    },

    async withdrawSuccessor(id, note) {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('succession.withdraw', 'successors', id ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', MSG.not_signed_in);
      const c = ctx();
      if (!c.has('talent_review', ['A'])) return refuse('forbidden', MSG.forbidden_succession);
      const role = c.actingRole('talent_review', ['A']);
      const x = id ? get('successors', id) : undefined;
      if (!x || x.status === 'withdrawn') return refuse('not_found', MSG.successor_not_found, role);
      const s = get('succession_slates', str(x.slate_id))!;
      if (s.status === 'confirmed') return refuse('slate_confirmed', MSG.slate_confirmed, role);
      const text = str(note).trim();
      if (text.length < NOTE_MIN || text.length > NOTE_MAX) return refuse('note_required', WITHDRAW_MSG, role);
      const ts = nowTs();
      upd('successors', String(x.id), { status: 'withdrawn', emergency: false, note: text, updated_at: ts });
      upd('succession_slates', String(s.id), { updated_at: ts });
      return h.done<R>('succession.withdraw', 'successors', String(x.id), text, role, null, '', 'Successor withdrawn', { status: 'withdrawn' }, ['successors', 'succession_slates']);
    },

    async confirmSlate(slateId, note) {
      await b.whenReady();
      type R = { status: string; successors: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('succession.confirm', 'succession_slates', slateId ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', MSG.not_signed_in);
      const c = ctx();
      if (!c.has('talent_review', ['A'])) return refuse('forbidden', MSG.forbidden_succession);
      const role = c.actingRole('talent_review', ['A']);
      const s = slateId ? get('succession_slates', slateId) : undefined;
      if (!s) return refuse('not_found', MSG.slate_not_found, role);
      if (s.status === 'confirmed') return refuse('slate_confirmed', MSG.slate_confirmed, role);
      const act = raw('successors').filter((x) => x.slate_id === s.id && x.status === 'proposed').sort((a, d) => cmp(str(a.id), str(d.id)));
      if (!act.length) return refuse('slate_empty', MSG.slate_empty, role);
      const today = todayIso();
      for (const x of act) if (x.cover_source === 'internal' && x.readiness === 'ready_now' && !gatesMet(assess(str(x.person_id), str(s.role_id), today).gates)) return refuse('gate_not_met', MSG.gate_not_met, role);
      const text = str(note).trim();
      if (text.length > NOTE_MAX) return refuse('invalid', MSG.invalid_note, role);
      const ts = nowTs();
      for (const x of act) upd('successors', String(x.id), { status: 'confirmed', confirmed_by: me(), confirmed_at: ts, updated_at: ts });
      upd('succession_slates', String(s.id), { status: 'confirmed', confirmed_by: me(), confirmed_at: ts, confirm_note: text || null, updated_at: ts });
      return h.done<R>('succession.confirm', 'succession_slates', String(s.id), `${act.length} successors`, role, 'kafaa.succession.slate_confirm', `Succession slate ${s.id} confirmed (${act.length} successors)`,
        'Slate confirmed', { status: 'confirmed', successors: act.length }, ['succession_slates', 'successors']);
    },

    async rollupBench(period) {
      await b.whenReady();
      type R = { period: string; roles: number; skipped: string[] };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('succession.rollup', 'critical_roles', period ?? null, code, msg, role);
      if (!me()) return refuse('not_signed_in', MSG.not_signed_in);
      const c = ctx();
      if (!c.has('talent_review', ['A'])) return refuse('forbidden', MSG.forbidden_succession);
      const role = c.actingRole('talent_review', ['A']);
      if (!isPeriod(period)) return refuse('invalid', MSG.bad_period, role);
      const slates = raw('succession_slates').filter((s) => s.period === period && s.critical).sort((a, d) => cmp(str(a.role_id), str(d.role_id)));
      const done = slates.filter((s) => s.status === 'confirmed');
      const skipped = slates.filter((s) => s.status !== 'confirmed').map((s) => str(s.role_id));
      if (!done.length) return refuse('nothing_to_roll', MSG.nothing_to_roll, role);
      const sx = successorsLite();
      const ts = nowTs();
      for (const s of done) {
        const k = benchCounts(str(s.id), sx);
        const cid = critId(str(s.role_id), period);
        const cur = get('critical_roles', cid);
        const before = cur ? { target_bench: cur.target_bench, qualified: cur.qualified, in_training: cur.in_training, pipeline: cur.pipeline } : null;
        const after = { target_bench: Number(s.target_bench), ...k };
        if (cur) upd('critical_roles', cid, { ...after, source: 'Succession slates (F19 roll-up)', sample: true });
        else ins('critical_roles', { id: cid, role_id: s.role_id, period, ...after, source: 'Succession slates (F19 roll-up)', sample: true });
        const rid = `br:${period}:${s.role_id}`;
        const row = { period, role_id: s.role_id, slate_id: s.id, critical_role_id: cid, before: before ?? {}, after, rolled_by: me(), rolled_at: ts, listed: true };
        if (get('bench_rollups', rid)) upd('bench_rollups', rid, row);
        else ins('bench_rollups', { id: rid, ...row });
      }
      return h.done<R>('succession.rollup', 'critical_roles', period, `${done.length} roles${skipped.length ? `; skipped ${skipped.join(',')}` : ''}`, role, 'kafaa.succession.bench_rollup',
        `Bench roll-up ${period}: ${done.length} critical roles`, `Bench updated for ${done.length} critical roles`, { period, roles: done.length, skipped }, ['critical_roles', 'bench_rollups']);
    },
  };
}
