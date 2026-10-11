// M02 LocalBackend RPCs for FS23 (level descriptors) and FS24 (Authority recognition) (owner: FS wave C · E4). Spread into makeLocalM02.
// 1:1 mirror of kafaa_save_descriptor / kafaa_set_level_range / kafaa_recognise_authority / kafaa_authority_candidates in
// supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql: same checks in the same order, the same refusal codes and
// messages (DESC_MSG, AUTH_MSG), the same audit rows; ledger rows only when a recognition is granted or a current one withdrawn.
// Never writes skill_evidence or person_skills: Authority is a recognition above Expert, not a level. Shared writes: M14
// notifications (kind `skills`, ids `nt-ar-...`), like the SQL functions.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { DESC_MSG, checkDescriptor, checkRange, descResultCode, descriptorId, trimWs, type DescriptorInput, type RangeInput } from '../descriptors';
import { AUTH_ACTIONS, AUTH_MSG, DECIDER_ROLE, REVIEW_YEARS, addYearsIso, authResultCode, authorityId, checkDecide, checkPropose } from '../authority';
import type { AuthorityCandidate, AuthorityInput, M02Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (v: unknown) => trimWs(v);
const byId = (a: Row, b: Row) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function makeLocalM02Fs23(b: LocalBackend, h: LocalRpcHelpers): Pick<M02Rpc, 'saveDescriptor' | 'setLevelRange' | 'recogniseAuthority' | 'authorityCandidates'> {
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const rangeOf = (skill: string) => raw('skill_level_ranges').find((r) => r.skill_id === skill);
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !get('people', pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'skills', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };

  return {
    async saveDescriptor(input: DescriptorInput) {
      await b.whenReady();
      type R = { id: string; status: string; version: number };
      const A = 'skill_descriptor.save';
      const sid = str(input?.skill_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'skill_descriptors', sid || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', DESC_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', DESC_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      const skill = get('skills', sid);
      const c = checkDescriptor(input ?? {}, { skill: skill ? { id: skill.id, area: skill.area, fs_area: skill.fs_area ?? null, lifecycle: skill.lifecycle } : null, range: rangeOf(sid) as never });
      if (c !== 'ok') return refuse(descResultCode(c), DESC_MSG[c], role);
      const level = Number(input.level);
      const id = descriptorId(sid, level);
      const cur = get('skill_descriptors', id);
      const status = input.publish === true ? 'published' : 'draft';
      const version = cur ? Number(cur.version ?? 1) + 1 : 1;
      const row = {
        essence_en: str(input.essence_en), essence_ar: str(input.essence_ar),
        indicators_en: (input.indicators_en as string[]).map(str), indicators_ar: (input.indicators_ar as string[]).map(str), evidence_modes: [...(input.evidence_modes as string[])],
        status, listed: status === 'published', version, updated_by: me(), updated_at: nowTs(),
      };
      if (cur) upd('skill_descriptors', id, row);
      else ins('skill_descriptors', { id, skill_id: sid, level, ...row, created_by: me(), created_at: nowTs() });
      return h.done<R>(A, 'skill_descriptors', id, `${status} L${level} v${version}`, role, null, '', 'Descriptor saved', { id, status, version }, ['skill_descriptors']);
    },

    async setLevelRange(input: RangeInput) {
      await b.whenReady();
      type R = { skill_id: string; min_level: number; max_level: number; published: number; archived: number; version: number };
      const A = 'skill_level_range.set';
      const sid = str(input?.skill_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'skill_level_ranges', sid || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', DESC_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', DESC_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      const skill = get('skills', sid);
      const descs = raw('skill_descriptors').filter((d) => d.skill_id === sid);
      const cur = rangeOf(sid);
      const c = checkRange(input ?? {}, {
        skill: skill ? { id: skill.id, area: skill.area, fs_area: skill.fs_area ?? null, lifecycle: skill.lifecycle } : null,
        levels: descs.map((d) => Number(d.level)), current: cur as never,
      });
      if (c !== 'ok') return refuse(descResultCode(c), DESC_MSG[c], role);
      const lo = Number(input.min_level);
      const hi = Number(input.max_level);
      let published = 0;
      let archived = 0;
      for (const d of [...descs].sort(byId)) {
        const inR = d.level >= lo && d.level <= hi;
        if (inR && d.status !== 'published') { upd('skill_descriptors', d.id, { status: 'published', listed: true, updated_by: me(), updated_at: nowTs() }); published++; }
        else if (!inR && d.status === 'published') { upd('skill_descriptors', d.id, { status: 'archived', listed: false, updated_by: me(), updated_at: nowTs() }); archived++; }
      }
      const version = cur ? Number(cur.version ?? 1) + 1 : 1;
      const patch = { min_level: lo, max_level: hi, basis: str(input.basis), rationale_en: str(input.rationale_en), rationale_ar: str(input.rationale_ar), version, updated_by: me(), updated_at: nowTs() };
      if (cur) upd('skill_level_ranges', cur.id, patch);
      else ins('skill_level_ranges', { id: `slr:${sid}`, skill_id: sid, track: 'technical', ...patch });
      return h.done<R>(A, 'skill_level_ranges', `slr:${sid}`, `L${lo}-L${hi} ${str(input.basis)}`, role, null, '', 'Level range saved',
        { skill_id: sid, min_level: lo, max_level: hi, published, archived, version }, ['skill_level_ranges', 'skill_descriptors']);
    },

    async recogniseAuthority(input: AuthorityInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const action = str(input?.action);
      const A = `authority.${(AUTH_ACTIONS as readonly string[]).includes(action) ? action : 'invalid'}`;
      const entity = action === 'propose' ? (str(input?.person_id) || null) : (str(input?.id) || null);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'authority_recognitions', entity, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', AUTH_MSG.not_signed_in);
      if (!(AUTH_ACTIONS as readonly string[]).includes(action)) return refuse('invalid', AUTH_MSG.action);
      if (!ctx().has('recognition', ['A'])) return refuse('forbidden', AUTH_MSG.forbidden);
      const isDecider = ctx().roleGrant(DECIDER_ROLE, 'recognition', 'A');
      const today = todayIso();
      if (action === 'propose') {
        const role = isDecider ? 'hr_director' : ctx().roleGrant('training_manager', 'recognition', 'A') ? 'training_manager' : null;
        if (!role) return refuse('forbidden', AUTH_MSG.forbidden);
        const pid = str(input.person_id);
        const sk = str(input.skill_id);
        const person = get('people', pid);
        const skill = get('skills', sk);
        const ps = raw('person_skills').find((r) => r.person_id === pid && r.skill_id === sk && r.active !== false);
        const rows = raw('authority_recognitions').filter((r) => r.person_id === pid && r.skill_id === sk);
        const c = checkPropose(input, {
          me: who, person: person ? { id: person.id, kind: person.kind, status: person.status } : null,
          skill: skill ? { id: skill.id, area: skill.area, fs_area: skill.fs_area ?? null, lifecycle: skill.lifecycle } : null,
          level: ps ? Number(ps.level) : 0, open: rows.some((r) => r.status === 'proposed' || r.status === 'recognised'),
        });
        if (c !== 'ok') return refuse(authResultCode(c), AUTH_MSG[c], role);
        const id = authorityId(pid, sk, rows.length + 1);
        ins('authority_recognitions', {
          id, person_id: pid, person_name: person!.display_name ?? '', person_name_ar: person!.display_name_ar || person!.display_name || '', skill_id: sk, status: 'proposed',
          panel: [...(input.panel as string[])], citation_en: str(input.citation_en), citation_ar: str(input.citation_ar), level_at_proposal: 4, basis_at_proposal: String(ps!.basis ?? ''),
          proposed_by: who, proposed_role: role, proposed_on: today, decided_by: null, decided_role: null, decided_on: null, decision_note: null, recognised_on: null, review_due: null,
          withdrawn_by: null, withdrawn_on: null, created_at: nowTs(), updated_at: nowTs(),
        });
        const deciders = [...new Set(raw('role_assignments').filter((a) => a.role === DECIDER_ROLE && a.status === 'active' && (!a.expires_at || a.expires_at >= today)).map((a) => String(a.person_id)))].sort();
        for (const d of deciders) if (d !== who) notify(`nt-ar-${id}-proposed-${d}`, d, `Authority recognition awaiting your decision: ${skill!.name_en}`, `اعتراف بصفة مرجعية بانتظار قرارك: ${skill!.name_ar}`, '/admin/authority', 'info');
        return h.done<R>(A, 'authority_recognitions', id, `proposed ${sk}`, role, null, '', 'Authority recognition proposed', { id, status: 'proposed' }, ['authority_recognitions', 'notifications']);
      }
      const id = str(input.id);
      const row = get('authority_recognitions', id);
      const role = isDecider ? 'hr_director' : row && row.proposed_by === who ? (row.proposed_role ?? null) : null;
      const c = checkDecide(action, row ? { status: row.status, proposed_by: row.proposed_by } : null, { me: who, isDecider, note: input.note });
      if (c !== 'ok') return refuse(authResultCode(c), AUTH_MSG[c], role);
      const note = str(input.note) || null;
      const skill = get('skills', row!.skill_id);
      const sName = { en: String(skill?.name_en ?? row!.skill_id), ar: String(skill?.name_ar ?? row!.skill_id) };
      if (action === 'approve') {
        upd('authority_recognitions', id, { status: 'recognised', decided_by: who, decided_role: role, decided_on: today, decision_note: note, recognised_on: today, review_due: addYearsIso(today, REVIEW_YEARS), updated_at: nowTs() });
        notify(`nt-ar-${id}-recognised`, row!.person_id, `Recognised as an Authority: ${sName.en}`, `اعتُرف بك مرجعاً في: ${sName.ar}`, '/my/levels', 'ok');
        return h.done<R>(A, 'authority_recognitions', id, `recognised ${row!.skill_id}`, role, 'kafaa.authority.recognise',
          `Authority recognised above Expert (not a level): ${row!.person_id} on ${row!.skill_id}; panel of ${(row!.panel ?? []).length}; proposed by ${row!.proposed_by}`, 'Authority recognised', { id, status: 'recognised' }, ['authority_recognitions', 'notifications']);
      }
      if (action === 'not_yet') {
        upd('authority_recognitions', id, { status: 'not_yet', decided_by: who, decided_role: role, decided_on: today, decision_note: note, updated_at: nowTs() });
        notify(`nt-ar-${id}-not_yet`, row!.person_id, `Authority panel outcome: not yet (${sName.en})`, `نتيجة لجنة الصفة المرجعية: ليس بعد (${sName.ar})`, '/my/levels', 'info');
        return h.done<R>(A, 'authority_recognitions', id, `not yet ${row!.skill_id}`, role, null, '', 'Recorded as not yet', { id, status: 'not_yet' }, ['authority_recognitions', 'notifications']);
      }
      const wasCurrent = row!.status === 'recognised';
      upd('authority_recognitions', id, { status: 'withdrawn', withdrawn_by: who, withdrawn_on: today, decision_note: note, updated_at: nowTs() });
      return h.done<R>(A, 'authority_recognitions', id, `withdrawn ${row!.skill_id}`, role, wasCurrent ? 'kafaa.authority.withdraw' : null,
        wasCurrent ? `Authority recognition withdrawn: ${row!.person_id} on ${row!.skill_id}` : '', 'Recognition withdrawn', { id, status: 'withdrawn' }, ['authority_recognitions']);
    },

    async authorityCandidates() {
      await b.whenReady();
      if (!me() || !ctx().has('recognition', ['R', 'W', 'A'])) return [];
      const skills = new Map(raw('skills').map((s) => [s.id as string, s]));
      const people = new Map(raw('people').map((p) => [p.id as string, p]));
      const recs = raw('authority_recognitions');
      const out: AuthorityCandidate[] = [];
      for (const ps of raw('person_skills')) {
        if (ps.active === false || Number(ps.level) !== 4) continue;
        const s = skills.get(ps.skill_id);
        const p = people.get(ps.person_id);
        if (!s || !p || p.kind !== 'staff' || p.status !== 'active' || s.area === 'security' || s.fs_area === 'cyber_hygiene' || s.lifecycle === 'obsolete') continue;
        const mine = recs.filter((r) => r.person_id === ps.person_id && r.skill_id === ps.skill_id).sort(byId);
        const pick = mine.find((r) => r.status === 'proposed' || r.status === 'recognised') ?? mine[mine.length - 1] ?? null;
        out.push({
          person_id: p.id, name_en: String(p.display_name ?? p.id), name_ar: String(p.display_name_ar || p.display_name || p.id), job_role_id: p.job_role_id ?? null,
          skill_id: s.id, basis: String(ps.basis ?? ''), confidence: Number(ps.confidence ?? 0), recognition_id: pick?.id ?? null, recognition_status: pick?.status ?? null,
        });
      }
      return out.sort((a, c) => (a.skill_id < c.skill_id ? -1 : a.skill_id > c.skill_id ? 1 : a.person_id < c.person_id ? -1 : a.person_id > c.person_id ? 1 : 0));
    },
  };
}
