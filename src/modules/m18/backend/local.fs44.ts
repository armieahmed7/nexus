// [FS wave D · E4] FS34 translator (staff variant) and FS35 Career Health check: LocalBackend RPCs, spread into makeLocalM18.
// 1:1 mirror of kafaa_translate_mine / kafaa_career_health / kafaa_save_health_snapshot in
// supabase/migrations/20261010244001_kafaa_fs44_translator_health.sql: same checks, refusal codes, messages and audit rows.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { translate, type TrData } from '../translate';
import { careerHealth, normPlan, type HealthData, type HealthResult } from '../careerHealth';
import { transformRole } from '../../m30/transform';
import type { M18Rpc, SaveHealthResult, TranslateMine } from './rpc';

type Fs44Rpc = Pick<M18Rpc, 'translateMine' | 'careerHealth' | 'saveHealthSnapshot'>;

const weightsOf = (b: LocalBackend) => {
  const w = b.rawGet('engine_settings', 'recommend')?.weights;
  return w && typeof w === 'object' ? Object.fromEntries(Object.entries(w as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number> : undefined;
};

/** FS34: the tables the translator reads, as definer (the public page reads the same rows anonymously). */
export function trDataFrom(b: LocalBackend): TrData {
  return {
    roles: b.raw('job_roles') as never, roleComps: b.raw('role_competencies') as never, competencies: b.raw('competencies') as never, skills: b.raw('skills') as never,
    courses: b.raw('courses') as never, links: b.raw('course_skill_links') as never, packs: b.raw('course_pack_items') as never, edges: b.raw('career_paths') as never, weights: weightsOf(b),
  };
}

/** FS35: the tables the health check reads for one person, as definer, with the FS11 map of the person's role at 2030. */
export function healthDataFrom(b: LocalBackend, personId: string): HealthData {
  const p = b.rawGet('people', personId) as { id: string; job_role_id?: string | null } | undefined;
  const mine = <T extends { person_id: string }>(rows: T[]) => rows.filter((r) => r.person_id === personId);
  const role = p?.job_role_id ? b.rawGet('job_roles', p.job_role_id) : undefined;
  const map = role && (role.lifecycle ?? 'current') === 'current'
    ? transformRole({
      role: role as never, map: (b.raw('role_transformations').find((x) => x.role_id === role.id) ?? null) as never, versions: b.raw('role_profile_versions') as never,
      tasks: b.raw('jta_tasks') as never, taskSkills: b.raw('jta_task_skills') as never, levels: b.raw('ai_capability_levels') as never, skills: b.raw('skills') as never,
      courses: b.raw('courses') as never, mine: mine(b.raw('person_skills')) as never, horizon: '2030',
    })
    : null;
  return {
    person: { id: personId, job_role_id: p?.job_role_id ?? null },
    roles: b.raw('job_roles') as never, roleComps: b.raw('role_competencies') as never, skills: b.raw('skills') as never,
    states: mine(b.raw('person_skills')) as never, training: mine(b.raw('training_records')) as never, external: mine(b.raw('external_completions')) as never,
    pathways: mine(b.raw('pathway_enrolments')) as never, weights: weightsOf(b), map: map as never,
  };
}

const randomId = (prefix: string) => {
  const a = new Uint8Array(8);
  globalThis.crypto.getRandomValues(a);
  return prefix + [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
};

export function makeLocalFs44(b: LocalBackend, h: LocalRpcHelpers): Fs44Rpc {
  /** Shared gate: signed in, staff, skills_profile Own. Returns the person id and acting role, or a refusal. */
  const MSG: Record<string, [string, string]> = {
    translate: ['Sign in to translate your skills', 'Translating your own passport is for staff with a skills profile'],
    health: ['Sign in to see your career health', 'The Career Health check is for staff with a skills profile'],
  };
  const gate = async <T>(action: string, table: string, entity: string | null, what: 'translate' | 'health'): Promise<{ me: string; role: string } | Result<T>> => {
    const who = b.identity();
    if (!who.personId) return h.refuse<T>(action, table, entity, 'not_signed_in', MSG[what][0]);
    const role = b.access().actingRole('skills_profile', ['Own']);
    const person = b.rawGet('people', who.personId);
    if (!role || !person || person.kind !== 'staff') return h.refuse<T>(action, table, entity, 'forbidden', MSG[what][1], role);
    return { me: who.personId, role };
  };
  return {
    async translateMine() {
      await b.whenReady();
      const g = await gate<TranslateMine>('career.translate', 'person_skills', null, 'translate');
      if ('ok' in g) return g;
      const held = b.raw('person_skills').filter((s) => s.person_id === g.me && s.active !== false).map((s) => ({ skill_id: String(s.skill_id), level: Number(s.level) }));
      const roleId = (b.rawGet('people', g.me)?.job_role_id as string | null) ?? null;
      const data: TranslateMine = { ...translate(trDataFrom(b), held, null, roleId), held: held.length, role_id: roleId };
      return { ok: true, code: 'ok', message: '', data } as Result<TranslateMine>;
    },

    async careerHealth() {
      await b.whenReady();
      const g = await gate<HealthResult>('career.health', 'health_snapshots', null, 'health');
      if ('ok' in g) return g;
      return { ok: true, code: 'ok', message: '', data: careerHealth(healthDataFrom(b, g.me), todayIso()) } as Result<HealthResult>;
    },

    async saveHealthSnapshot(input) {
      await b.whenReady();
      type R = SaveHealthResult;
      const inp = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
      const sid = typeof inp.snapshot_id === 'string' && inp.snapshot_id ? inp.snapshot_id : null;
      const g = await gate<R>('career_health.save', 'health_snapshots', sid, 'health');
      if ('ok' in g) return g;
      const refuse = (code: string, msg: string) => h.refuse<R>('career_health.save', 'health_snapshots', sid, code, msg, g.role);
      const row = sid ? b.rawGet('health_snapshots', sid) : undefined;
      if (sid && (!row || row.person_id !== g.me)) return refuse('not_found', 'Health check not found');
      const plan = normPlan(inp.plan ?? (row?.plan as unknown) ?? {});
      if (!plan) return refuse('invalid', 'Check your plan: choose from the suggested actions and keep the note under 600 characters');
      const conv = typeof inp.conversation_id === 'string' && inp.conversation_id ? inp.conversation_id : null;
      if (conv) {
        const c = b.rawGet('career_conversations', conv);
        if (!c || c.person_id !== g.me || !c.prep_submitted_at) return refuse('invalid', 'Share your conversation preparation with your line manager first');
      }
      const linked = conv ?? ((row?.conversation_id as string | null) ?? null);
      const step: R['step'] = linked ? 'executed' : plan.actions.length ? 'charted' : 'assessed';
      const now = nowTs();
      let id: string;
      let comps: R['components'] = null;
      if (row) {
        id = row.id as string;
        b.rawUpdate('health_snapshots', id, { plan: plan as never, conversation_id: linked, step, updated_at: now } as never);
      } else {
        const res = careerHealth(healthDataFrom(b, g.me), todayIso());
        id = randomId('hs-');
        comps = res.components;
        b.rawInsert('health_snapshots', { id, person_id: g.me, taken_at: now, as_of: res.as_of, role_id: res.role_id, components: res.components as never, good: res.good, watch: res.watch, act: res.act, plan: plan as never, step, conversation_id: linked, updated_at: now } as never);
      }
      return h.done<R>('career_health.save', 'health_snapshots', id, `step ${step}`, g.role, null, '', step === 'executed' ? 'Conversation booked and plan saved' : 'Career health check saved',
        { id, step, created: !row, components: comps }, ['health_snapshots']);
    },
  };
}
