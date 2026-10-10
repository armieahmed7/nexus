// M01 LocalBackend RPC implementations (FS05, fsAe4). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of kafaa_save_role_profile_version in supabase/migrations/20261010214001_kafaa_fs14_role_profiles.sql: same
// checks in the same order (checkVersion = kafaa_rpv_check), same refusal codes, audit rows and ledger action.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { CHECK_MESSAGES, checkVersion, normaliseReqs, versionId, type ProfileReq } from '../roleProfiles';
import type { M01Rpc, SaveRoleProfileResult } from './rpc';

/** Who may maintain role profiles: an admin (frameworks A) or the training manager (sat A). Same order as the SQL. */
export function profileEditorRole(b: LocalBackend): string | null {
  return b.access().actingRole('frameworks', ['A']) ?? b.access().actingRole('sat', ['A']);
}

export function makeLocalM01(b: LocalBackend, h: LocalRpcHelpers): M01Rpc {
  return {
    async saveRoleProfileVersion(input) {
      await b.whenReady();
      type R = SaveRoleProfileResult;
      const me = b.identity().personId;
      const entity = `${input?.role_id ?? ''}:${input?.horizon ?? ''}`;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('role_profile.save', 'role_profile_versions', entity, code, msg, role);
      if (!me) return refuse('not_signed_in', 'Sign in to edit role profiles');
      const role = profileEditorRole(b);
      if (!role) return refuse('forbidden', 'Role profiles are maintained by the training manager or an admin');
      const jr = input?.role_id ? b.rawGet('job_roles', input.role_id) : undefined;
      const code = checkVersion(input, {
        role: jr ? { id: jr.id, lifecycle: jr.lifecycle, security_sensitive: !!jr.security_sensitive } : null,
        competencies: new Map(b.raw('competencies').map((c) => [c.id, c.domain])),
        skills: new Map(b.raw('skills').map((s) => [s.id, s.area])),
      });
      if (code !== 'ok') return refuse(code, CHECK_MESSAGES[code], role);
      const reqs = normaliseReqs(input.requirements as ProfileReq[]);
      const drivers = [...new Set([...input.drivers, ...reqs.map((r) => r.driver).filter((d): d is NonNullable<typeof d> => !!d)])].sort();
      const ts = nowTs();
      const all = b.raw('role_profile_versions').filter((v) => v.role_id === input.role_id && v.horizon === input.horizon);
      const draft = all.find((v) => v.status === 'draft');
      const version = draft ? draft.version : all.reduce((m, v) => Math.max(m, v.version), 0) + 1;
      const id = draft ? draft.id : versionId(input.role_id, input.horizon, version);
      const body = {
        requirements: reqs, drivers, rationale_en: input.rationale_en.trim(), rationale_ar: input.rationale_ar.trim(),
        sources: Array.isArray(input.sources) ? input.sources : [], path_only: !!jr!.security_sensitive, as_of: ts.slice(0, 10), updated_at: ts,
      };
      if (draft) b.rawUpdate('role_profile_versions', id, body);
      else b.rawInsert('role_profile_versions', { id, role_id: input.role_id, horizon: input.horizon, version, status: 'draft', is_public: false, supersedes_id: null, superseded_by_id: null, created_by: me, created_at: ts, published_by: null, published_at: null, ...body });
      if (!input.publish) return h.done<R>('role_profile.save', 'role_profile_versions', id, `draft v${version} for ${input.role_id} ${input.horizon} (${reqs.length} requirements)`, role, null, '', 'Draft saved', { id, version, status: 'draft', supersedes_id: null }, ['role_profile_versions']);
      const prev = all
        .filter((v) => v.status === 'published' && v.id !== id)
        .sort((x, y) => y.version - x.version)[0];
      if (prev) b.rawUpdate('role_profile_versions', prev.id, { status: 'superseded', is_public: false, superseded_by_id: id, updated_at: ts });
      b.rawUpdate('role_profile_versions', id, { status: 'published', is_public: true, published_by: me, published_at: ts, supersedes_id: prev?.id ?? null });
      return h.done<R>('role_profile.publish', 'role_profile_versions', id, `published v${version} for ${input.role_id} ${input.horizon}${prev ? ` (supersedes ${prev.id})` : ''}`, role,
        'kafaa.role_profile.publish', `Role profile ${input.role_id} ${input.horizon} v${version} published`, 'Profile published', { id, version, status: 'published', supersedes_id: prev?.id ?? null }, ['role_profile_versions']);
    },
  };
}
