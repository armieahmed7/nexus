// M28 LocalBackend RPC implementations (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file. 1:1 mirror of supabase/migrations/20261010221001_kafaa_fs21_skills_crosswalk.sql: same checks in
// the same order, the same refusal codes and messages (AL_MSG, GOAL_MSG), the same audit rows; no ledger rows.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { AL_MSG, REASON_MAX, REASON_MIN, alResultCode, canonLevelMap, checkAlignment, type AlignmentInput } from '../crosswalk';
import { GOAL_MAX_ACTIVE, GOAL_MSG } from '../crosswalk';
import type { M28Rpc, SaveAlignmentResult, SkillGoalResult } from './rpc';
import { makeLocalFs70 } from './local.fs70'; // FS wave H · E1 (FS70, FS71, FS72)

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const rand8 = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('');

export function makeLocalM28(b: LocalBackend, h: LocalRpcHelpers): M28Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const canEdit = () => ctx().has('frameworks', ['W', 'A']);
  const editRole = () => ctx().actingRole('frameworks', ['W', 'A']);
  const checkCtx = () => ({
    skills: new Map(raw('skills').map((s) => [s.id as string, { lifecycle: s.lifecycle as string }])),
    frameworks: new Set(raw('skill_frameworks').map((f) => f.id as string)),
    rows: raw('skill_alignments').map((r) => ({ id: r.id, skill_id: r.skill_id, framework: r.framework, external_code: r.external_code ?? null, label_en: r.label_en, status: r.status })),
    today: todayIso(),
  });

  return {
    ...makeLocalFs70(b, h),
    async saveAlignment(input: AlignmentInput) {
      await b.whenReady();
      type R = SaveAlignmentResult;
      const id = str(input?.id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skill_alignment.save', 'skill_alignments', id || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', AL_MSG.not_signed_in);
      if (!canEdit()) return refuse('forbidden', AL_MSG.forbidden);
      const role = editRole();
      const cur = id ? get('skill_alignments', id) : undefined;
      if (id && !cur) return refuse('not_found', AL_MSG.not_found, role);
      const c = checkAlignment(input ?? {}, checkCtx(), cur ? { skill_id: cur.skill_id, framework: cur.framework, status: cur.status } : null);
      if (c !== 'ok') return refuse(alResultCode(c), AL_MSG[c], role);
      const publish = input.publish === true;
      const status = publish ? 'published' : 'draft';
      const row = {
        external_code: str(input.external_code) || null, label_en: str(input.label_en), label_ar: str(input.label_ar), label_ar_official: input.label_ar_official === true,
        match_type: str(input.match_type), level_map: canonLevelMap(input.level_map), note_en: str(input.note_en), note_ar: str(input.note_ar),
        source_url: str(input.source_url), as_of: str(input.as_of), status, listed: publish, reviewed_by: null, reviewed_role: null, reviewed_on: null,
        updated_by: me(), updated_at: nowTs(),
      };
      let newId = id;
      let version = 1;
      if (cur) {
        version = Number(cur.version ?? 1) + 1;
        upd('skill_alignments', id, { ...row, version });
      } else {
        const skill = str(input.skill_id);
        const fw = str(input.framework);
        newId = `al:${skill}:${fw}:${rand8()}`;
        const sort = raw('skill_alignments').filter((r) => r.skill_id === skill).reduce((m, r) => Math.max(m, Number(r.sort) || 0), 0) + 1;
        ins('skill_alignments', { id: newId, skill_id: skill, framework: fw, external_meta: {}, retired_reason: null, retired_on: null, ...row, version, created_by: me(), created_at: nowTs(), sort });
      }
      return h.done<R>('skill_alignment.save', 'skill_alignments', newId, `${status} v${version}`, role, null, '', cur ? 'Alignment saved' : 'Alignment added', { id: newId, status, version }, ['skill_alignments']);
    },

    async reviewAlignment(id) {
      await b.whenReady();
      type R = { id: string; reviewed_on: string };
      const aid = str(id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skill_alignment.review', 'skill_alignments', aid || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', AL_MSG.not_signed_in);
      if (!canEdit()) return refuse('forbidden', AL_MSG.forbidden);
      const role = editRole();
      const cur = get('skill_alignments', aid);
      if (!cur) return refuse('not_found', AL_MSG.not_found, role);
      if (cur.status === 'retired') return refuse('retired', AL_MSG.retired, role);
      if (cur.status !== 'published') return refuse('invalid', AL_MSG.not_published, role);
      if (cur.reviewed_by) return refuse('no_change', AL_MSG.already_reviewed, role);
      if (cur.updated_by && cur.updated_by === me()) return refuse('maker_checker', AL_MSG.maker_checker, role);
      const today = todayIso();
      upd('skill_alignments', aid, { reviewed_by: me(), reviewed_role: role, reviewed_on: today });
      return h.done<R>('skill_alignment.review', 'skill_alignments', aid, `reviewed ${cur.framework} ${cur.match_type}`, role, null, '', 'Alignment reviewed', { id: aid, reviewed_on: today }, ['skill_alignments']);
    },

    async retireAlignment(id, reason) {
      await b.whenReady();
      type R = { id: string };
      const aid = str(id);
      const why = str(reason);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skill_alignment.retire', 'skill_alignments', aid || null, code, msg, role);
      if (!me()) return refuse('not_signed_in', AL_MSG.not_signed_in);
      if (!canEdit()) return refuse('forbidden', AL_MSG.forbidden);
      const role = editRole();
      const cur = get('skill_alignments', aid);
      if (!cur) return refuse('not_found', AL_MSG.not_found, role);
      if (cur.status === 'retired') return refuse('retired', AL_MSG.retired, role);
      if (why.length < REASON_MIN || why.length > REASON_MAX) return refuse('invalid', AL_MSG.reason, role);
      upd('skill_alignments', aid, { status: 'retired', listed: false, retired_reason: why, retired_on: todayIso(), updated_by: me(), updated_at: nowTs() });
      return h.done<R>('skill_alignment.retire', 'skill_alignments', aid, why, role, null, '', 'Alignment retired', { id: aid }, ['skill_alignments']);
    },

    async setSkillGoal(skillId, targetLevel, active) {
      await b.whenReady();
      type R = SkillGoalResult;
      const sid = str(skillId);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('skill_goal.set', 'skill_goals', sid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', GOAL_MSG.not_signed_in);
      if (!ctx().has('skills_profile', ['Own'])) return refuse('forbidden', GOAL_MSG.forbidden);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const sk = get('skills', sid);
      if (!sk) return refuse('not_found', GOAL_MSG.not_found, role);
      const gid = `sg:${who}:${sid}`;
      const cur = get('skill_goals', gid);
      if (active === false) {
        if (!cur || cur.status !== 'active') return refuse('no_change', GOAL_MSG.no_change, role);
        upd('skill_goals', gid, { status: 'removed', updated_at: nowTs() });
        return h.done<R>('skill_goal.set', 'skill_goals', gid, `removed ${sid}`, role, null, '', 'Removed from your goals', { id: gid, skill_id: sid, status: 'removed', target_level: Number(cur.target_level) }, ['skill_goals']);
      }
      if (sk.area === 'security') return refuse('restricted', GOAL_MSG.restricted, role);
      if (sk.lifecycle === 'obsolete') return refuse('obsolete', GOAL_MSG.obsolete, role);
      if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 4) return refuse('invalid', GOAL_MSG.invalid, role);
      const activeN = raw('skill_goals').filter((g) => g.person_id === who && g.status === 'active' && g.id !== gid).length;
      if (activeN >= GOAL_MAX_ACTIVE) return refuse('limit', GOAL_MSG.limit, role);
      if (cur) upd('skill_goals', gid, { target_level: targetLevel, status: 'active', updated_at: nowTs() });
      else ins('skill_goals', { id: gid, person_id: who, skill_id: sid, target_level: targetLevel, status: 'active', source: 'skills_explorer', created_at: nowTs(), updated_at: nowTs() });
      return h.done<R>('skill_goal.set', 'skill_goals', gid, `active ${sid} L${targetLevel}`, role, null, '', 'Added to your goals', { id: gid, skill_id: sid, status: 'active', target_level: targetLevel }, ['skill_goals']);
    },
  };
}
