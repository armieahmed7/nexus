// M30 LocalBackend RPC implementations (owner: FS wave B · E3, FS11 + FS12). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql: same checks in the same order, the same refusal
// codes and messages (RT_MSG in ../transform.ts), the same audit and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { RT_MSG, checkTransformation, exposureAggregate, isPathOnly, transformRole, transformationOverview, type RtInput } from '../transform';
import type { M30Rpc, PublishResult, RoleTransformationView, RtDraft } from './rpc';
import { makeLocalFs81 } from './local.fs81'; // FS81 (FS wave I · E3)

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

/** The stored content of a map (same keys and order as SQL kafaa_rt_content). */
export function contentOf(input: Partial<RtInput>) {
  return {
    archetype: input.archetype ?? null, drivers: Array.isArray(input.drivers) ? [...input.drivers] : [],
    summary_en: str(input.summary_en), summary_ar: str(input.summary_ar), public_summary_en: str(input.public_summary_en), public_summary_ar: str(input.public_summary_ar),
    sources: Array.isArray(input.sources) ? input.sources.map((s) => ({ label: str(s?.label), url: str(s?.url), as_of: str(s?.as_of) || null })) : [],
  };
}

export function makeLocalM30(b: LocalBackend, h: LocalRpcHelpers): M30Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const anyGrant = () => ctx().has('transformation', ['R', 'Own', 'Scope', 'Agg', 'W', 'A']);
  const canEdit = () => ctx().has('transformation', ['W', 'A']);
  const isHr = () => ctx().has('transformation', ['Agg', 'A']);
  const myRole = () => {
    const p = get('people', me());
    const r = get('job_roles', p?.job_role_id);
    return r && (r.lifecycle ?? 'current') === 'current' ? (r.id as string) : null;
  };
  const draftOf = (roleId: string): RtDraft | null => {
    const d = raw('transformation_drafts').find((x) => x.role_id === roleId && x.open);
    if (!d) return null;
    const c = d.content ?? {};
    return { ...contentOf(c), saved_by: d.saved_by ?? null, saved_at: d.saved_at ? String(d.saved_at) : null };
  };

  return {
    ...makeLocalFs81(b, h),
    async roleTransformation(roleId = null, horizon = '2030') {
      await b.whenReady();
      if (!me() || !anyGrant()) return null;
      const mine = myRole();
      const rid = str(roleId) || mine;
      const role = get('job_roles', rid);
      const edit = canEdit();
      const view: RoleTransformationView = { my_role_id: mine, map: null, can_edit: edit, draft: null };
      if (!role || (role.lifecycle ?? 'current') !== 'current') return view;
      const mapRow = raw('role_transformations').find((x) => x.role_id === role.id) ?? null;
      view.map = transformRole({
        role: role as never, map: mapRow as never, versions: raw('role_profile_versions') as never, tasks: raw('jta_tasks') as never, taskSkills: raw('jta_task_skills') as never,
        levels: raw('ai_capability_levels') as never, skills: raw('skills') as never, courses: raw('courses') as never,
        mine: raw('person_skills').filter((s) => s.person_id === me()) as never, horizon,
      });
      view.draft = edit ? draftOf(role.id) : null;
      return view;
    },

    async publishTransformation(input) {
      await b.whenReady();
      type R = PublishResult;
      const roleId = str(input?.role_id);
      const action = input?.publish ? 'transformation.publish' : 'transformation.save';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(action, 'role_transformations', roleId || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RT_MSG.not_signed_in);
      if (!canEdit()) return refuse('forbidden', RT_MSG.forbidden);
      const acting = ctx().actingRole('transformation', ['W', 'A']);
      const role = get('job_roles', roleId) ?? null;
      const code = checkTransformation(input, role as never);
      if (code !== 'ok') return refuse(code, RT_MSG[code], acting);
      const c = contentOf(input);
      const id = `rt-${roleId}`;
      const cur = get('role_transformations', id);
      if (!input.publish) {
        const did = `rtd-${roleId}`;
        const row = { role_id: roleId, content: c, open: true, saved_by: who, saved_at: nowTs() };
        if (get('transformation_drafts', did)) upd('transformation_drafts', did, row); else ins('transformation_drafts', { id: did, ...row });
        if (!cur) {
          ins('role_transformations', {
            id, role_id: roleId, family_id: role!.family_id, ...c, as_of: todayIso(), status: 'draft', is_public: false, path_only: isPathOnly(role as never),
            version: 0, history: [], updated_by: who, updated_at: nowTs(), published_by: null, published_at: null, sort: Number(role!.sort ?? 0),
          });
        }
        const v = Number(cur?.version ?? 0);
        return h.done<R>(action, 'role_transformations', roleId, 'draft saved', acting, null, '', 'Draft saved', { id, status: 'draft', version: v }, ['role_transformations', 'transformation_drafts']);
      }
      const version = Number(cur?.version ?? 0) + 1;
      const history = [...(Array.isArray(cur?.history) ? cur!.history : [])];
      if (cur && cur.status === 'published') {
        history.push({ version: Number(cur.version), archetype: cur.archetype ?? null, drivers: cur.drivers ?? [], summary_en: cur.summary_en, summary_ar: cur.summary_ar,
          public_summary_en: cur.public_summary_en, public_summary_ar: cur.public_summary_ar, published_by: cur.published_by ?? null, published_at: cur.published_at ? String(cur.published_at) : null });
      }
      const patch = { ...c, as_of: todayIso(), status: 'published', is_public: true, path_only: isPathOnly(role as never), version, history, updated_by: who, updated_at: nowTs(), published_by: who, published_at: nowTs() };
      if (cur) upd('role_transformations', id, patch);
      else ins('role_transformations', { id, role_id: roleId, family_id: role!.family_id, sort: Number(role!.sort ?? 0), ...patch });
      const d = get('transformation_drafts', `rtd-${roleId}`);
      if (d && d.open) upd('transformation_drafts', d.id, { open: false, saved_by: who, saved_at: nowTs() });
      return h.done<R>(action, 'role_transformations', roleId, `v${version} published`, acting, 'kafaa.transformation.publish', `${roleId} role transformation map v${version} published`,
        'Role transformation map published', { id, status: 'published', version }, ['role_transformations', 'transformation_drafts']);
    },

    async exposureAggregate() {
      await b.whenReady();
      if (!me() || !isHr()) return null;
      return exposureAggregate({ people: raw('people') as never, roles: raw('job_roles') as never, families: raw('job_families') as never, tasks: raw('jta_tasks') as never, levels: raw('ai_capability_levels') as never });
    },

    async transformationOverview(horizon = '2030') {
      await b.whenReady();
      if (!me() || !isHr()) return null;
      return transformationOverview({
        people: raw('people') as never, roles: raw('job_roles') as never, families: raw('job_families') as never, versions: raw('role_profile_versions') as never,
        states: raw('person_skills') as never, skills: raw('skills') as never, horizon,
      });
    },
  };
}
