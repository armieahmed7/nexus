// M18 LocalBackend RPC implementations (owner: W1 engineer 2). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of kafaa_career_readiness / kafaa_roadmap_to_plan in supabase/migrations/20261009112001_kafaa_w1e2_career.sql:
// same checks, refusal codes, audit rows and ledger rows. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { careerReadiness, MAX_ROLES, type CareerData, type CareerReadiness } from '../career';
import type { M18Rpc, RoadmapToPlanResult } from './rpc';

const PLAN_KINDS = ['course', 'mentoring', 'project'];
const OPEN_PLAN = ['draft', 'submitted', 'approved', 'active'];

/** The tables careerReadiness reads, as definer (both backends read the same rows). */
export function careerDataFrom(b: LocalBackend, personId: string): CareerData {
  const w = b.rawGet('engine_settings', 'recommend')?.weights;
  return {
    people: b.raw('people').filter((p) => p.id === personId),
    roles: b.raw('job_roles'),
    edges: b.raw('career_paths') as never,
    roleComps: b.raw('role_competencies'),
    competencies: b.raw('competencies'),
    skills: b.raw('skills'),
    states: b.raw('person_skills').filter((s) => s.person_id === personId),
    licences: b.raw('licences').filter((s) => s.person_id === personId),
    standards: b.raw('qual_standards'),
    qualRecords: b.raw('qual_records').filter((s) => s.person_id === personId),
    programmes: b.raw('programmes'),
    courses: b.raw('courses'),
    trainingRecords: b.raw('training_records').filter((s) => s.person_id === personId),
    enrolments: b.raw('enrolments').filter((s) => s.person_id === personId),
    weights: w && typeof w === 'object' ? Object.fromEntries(Object.entries(w as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number> : undefined,
  };
}

export function makeLocalM18(b: LocalBackend, h: LocalRpcHelpers): M18Rpc {
  return {
    async careerReadiness(personId, roleIds) {
      await b.whenReady();
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string) => h.refuse<CareerReadiness[]>('career.readiness', 'career_targets', personId ?? null, code, msg, null);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to see your career readiness');
      if (!personId || !b.rawGet('people', personId)) return refuse('not_found', 'Person not found');
      if (personId === who.personId) {
        if (!ctx.has('skills_profile', ['Own', 'Scope'])) return refuse('forbidden', 'Career readiness is for staff with a skills profile');
      } else {
        const shared = b.raw('career_targets').some((t) => t.person_id === personId && t.shared && t.active) || b.raw('roadmaps').some((r) => r.person_id === personId && r.shared && r.active);
        if (!(ctx.has('skills_profile', ['Scope']) && ctx.inScope('skills_profile', personId) && shared)) return refuse('forbidden', 'This person has not shared their career plans with you');
      }
      const ids = (Array.isArray(roleIds) ? roleIds : []).filter((x) => typeof x === 'string').slice(0, MAX_ROLES);
      const data = careerReadiness(careerDataFrom(b, personId), personId, ids, todayIso());
      return { ok: true, code: 'ok', message: '', data } as Result<CareerReadiness[]>;
    },

    async roadmapToPlan(roadmapId) {
      await b.whenReady();
      type R = RoadmapToPlanResult;
      const who = b.identity();
      const ctx = b.access();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('roadmap.to_plan', 'roadmaps', roadmapId ?? null, code, msg, role);
      if (!who.personId) return refuse('not_signed_in', 'Sign in to update your development plan');
      const role = ctx.actingRole('dev_plans', ['Own', 'Scope']);
      if (!role) return refuse('forbidden', 'Only staff with a development plan can do this');
      const rm = roadmapId ? b.rawGet('roadmaps', roadmapId) : undefined;
      if (!rm || rm.person_id !== who.personId || !rm.active) return refuse('not_found', 'Roadmap not found', role);
      const plan = Array.isArray(rm.plan) ? (rm.plan as Record<string, unknown>[]) : [];
      const dev = plan.filter((x) => x && x.lane === 'development');
      if (!dev.length) return refuse('invalid', 'This roadmap has no development blocks to send', role);
      for (const x of dev) {
        const t = x.title as { en?: unknown; ar?: unknown } | undefined;
        const bad = typeof x.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(x.id as string) || !PLAN_KINDS.includes(String(x.plan_kind)) || typeof t?.en !== 'string' || typeof t?.ar !== 'string'
          || !(t.en as string).trim() || (t.en as string).length > 200 || (t.ar as string).length > 200 || (x.course_id != null && !b.rawGet('courses', String(x.course_id)))
          || (x.end != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(x.end)));
        if (bad) return refuse('invalid', 'The roadmap contains an activity that cannot be added', role);
      }
      const plans = b.raw('dev_plans').filter((p) => p.person_id === who.personId && p.target_role_id === rm.target_role_id && OPEN_PLAN.includes(p.status)).sort((a, c) => (a.id < c.id ? -1 : 1));
      let planId = plans.find((p) => p.id === `dp-rm-${rm.id}`)?.id ?? plans[0]?.id ?? null;
      let planCreated = false;
      if (!planId) {
        planId = `dp-rm-${rm.id}`;
        b.rawInsert('dev_plans', { id: planId, person_id: who.personId, target_role_id: rm.target_role_id, status: 'draft', created_at: nowTs(), note: 'Created from a Career Roadmap scenario' } as never);
        planCreated = true;
      }
      let created = 0, existing = 0;
      for (const x of dev) {
        const id = `pa-rm-${rm.id}-${x.id}`;
        const t = x.title as { en: string; ar: string };
        // same block already in the plan (this roadmap, or another saved scenario for the same target): never duplicate
        const same = (b.raw('plan_activities') as unknown as { plan_id: string; kind: string; title_en: string; course_id: string | null }[])
          .some((a) => a.plan_id === planId && a.kind === x.plan_kind && a.title_en === t.en && (a.course_id ?? '') === ((x.course_id as string) ?? ''));
        if (b.rawGet('plan_activities', id) || same) { existing++; continue; }
        b.rawInsert('plan_activities', { id, plan_id: planId, person_id: who.personId, kind: x.plan_kind as never, title_en: t.en, title_ar: t.ar, due_on: (x.end as string) ?? null, status: 'planned', course_id: (x.course_id as string) ?? null } as never);
        created++;
      }
      b.rawUpdate('roadmaps', rm.id, { sent_plan_id: planId, sent_at: nowTs() } as never);
      return h.done<R>('roadmap.to_plan', 'plan_activities', rm.id, `${created} added, ${existing} already in plan ${planId}`, role, 'kafaa.career.roadmap_to_plan',
        `Career roadmap ${rm.id} sent to development plan ${planId} (${created} activities added)`, created ? 'Added to your development plan' : 'Already in your development plan',
        { plan_id: planId, plan_created: planCreated, created, existing }, ['roadmaps', 'dev_plans', 'plan_activities']);
    },
  };
}
