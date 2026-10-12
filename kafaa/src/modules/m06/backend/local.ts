// M06 extension LocalBackend RPCs (owner: W5 · E3, F34 Student-to-career journey). Installed on every LocalRpc by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009153001_kafaa_w5e3_journey.sql (kafaa_save_student_journey, kafaa_journey_aggregate,
// kafaa_issue_starter_credentials): same checks, refusal codes and audit rows. Rules: src/modules/m06/journey.ts.
// Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import {
  computeJourneyAggregate, explorerFamilies, journeyId, journeyPayload, starterEligible, starterNoticeId, starterRow, validateJourneyInput,
  type JourneyAggregate, type JourneyQuestionRow,
} from '../journey';
import type { M06Rpc, SaveJourneyResult } from './rpc';
import { makeLocalFs77 } from './local.fs77';

export function familySortOf(b: LocalBackend): Record<string, number> {
  return Object.fromEntries(b.raw('job_families').map((f) => [f.id, Number(f.sort ?? 999)]));
}
export const questionsOf = (b: LocalBackend) => b.raw('journey_questions') as unknown as JourneyQuestionRow[];

export function makeLocalM06(b: LocalBackend, h: LocalRpcHelpers): M06Rpc {
  return {
    ...makeLocalFs77(b, h), // FS77 (fsHe5): intake baselines and induction plans
    async saveStudentJourney(input) {
      await b.whenReady();
      type R = SaveJourneyResult;
      const me = b.identity().personId;
      if (!me) return h.refuse<R>('journey.save', 'student_journeys', null, 'not_signed_in', 'Sign in to save your journey; the explorer works without saving');
      const id = journeyId(me);
      const role = b.access().actingRole('applications', ['Own']);
      if (!role) return h.refuse<R>('journey.save', 'student_journeys', id, 'forbidden', 'Saving a journey is for students and applicants with a Kafa\'a account');
      const qs = questionsOf(b);
      const bad = validateJourneyInput(qs, input);
      if (bad) return h.refuse<R>('journey.save', 'student_journeys', id, 'invalid', bad, role);
      const cur = b.rawGet('student_journeys', id);
      const ts = nowTs();
      if (input.clear === true) {
        const patch = { stage: null, route: null, interests: {}, milestones: {}, updated_at: ts, cleared_at: ts };
        if (cur) b.rawUpdate('student_journeys', id, patch as never);
        else b.rawInsert('student_journeys', { id, person_id: me, saved_at: ts, open_read: false, ...patch } as never);
        return h.done<R>('journey.clear', 'student_journeys', id, 'cleared', role, null, '', 'Your saved journey was cleared', { id, families: [], route: null, cleared: true }, ['student_journeys']);
      }
      const p = journeyPayload(qs, input, familySortOf(b));
      const row = { stage: p.stage, route: p.route, interests: p.interests, milestones: p.milestones, updated_at: ts, cleared_at: null };
      if (cur) b.rawUpdate('student_journeys', id, row as never);
      else b.rawInsert('student_journeys', { id, person_id: me, saved_at: ts, open_read: false, ...row } as never);
      const families = p.interests.families;
      return h.done<R>('journey.save', 'student_journeys', id, `stage ${p.stage ?? '-'}, route ${p.route ?? '-'}, ${families.length} families, ${Object.keys(p.milestones.checklist).length} checklist items`,
        role, null, '', 'Journey saved. Only you can see it.', { id, families, route: p.route, cleared: false }, ['student_journeys']);
    },

    async journeyAggregate() {
      await b.whenReady();
      type R = JourneyAggregate;
      if (!b.identity().personId) return h.refuse<R>('journey.aggregate', 'student_journeys', null, 'not_signed_in', 'Sign in to see journey insights');
      const role = b.access().actingRole('applications', ['Agg', 'A', 'R']);
      if (!role) return h.refuse<R>('journey.aggregate', 'student_journeys', null, 'forbidden', 'Journey insights are aggregate-only and for HR');
      const qs = questionsOf(b);
      const data = computeJourneyAggregate(
        { journeys: b.raw('student_journeys'), applications: b.raw('applications'), portfolio: b.raw('student_portfolio'), families: explorerFamilies(qs, familySortOf(b)) },
        b.access().has('applications', ['A']),
      );
      return { ok: true, code: 'ok', message: 'Journey insights', data } as Result<R>;
    },

    async issueStarterCredentials() {
      await b.whenReady();
      type R = { issued: number };
      if (!b.identity().personId) return h.refuse<R>('journey.starter_credentials', 'student_portfolio', null, 'not_signed_in', 'Sign in to issue starter credentials');
      const role = b.access().actingRole('applications', ['A']);
      if (!role) return h.refuse<R>('journey.starter_credentials', 'student_portfolio', null, 'forbidden', 'Only the HR director issues Mustaqbali starter credentials');
      const people = starterEligible(b.raw('applications'), b.raw('student_portfolio'));
      if (!people.length) return h.refuse<R>('journey.starter_credentials', 'student_portfolio', null, 'not_found', 'No accepted Mustaqbali participant is waiting for a starter credential', role);
      const today = todayIso();
      const known = new Set(b.raw('people').map((p) => p.id));
      for (const p of people) {
        b.rawInsert('student_portfolio', { ...starterRow(p, today), created_at: nowTs() } as never);
        if (known.has(p) && !b.rawGet('notifications', starterNoticeId(p)))
          b.rawInsert('notifications', {
            id: starterNoticeId(p), person_id: p, kind: 'journey', title_en: 'Your Mustaqbali starter credential is in your portfolio', title_ar: 'شهادة البداية من برنامج مستقبلي في ملفك الآن',
            link: '/pathways/journey#portfolio', severity: 'ok', created_at: nowTs(),
          } as never);
      }
      return h.done<R>('journey.starter_credentials', 'student_portfolio', null, `issued ${people.length}`, role, 'kafaa.student.starter_credentials',
        `Issued ${people.length} Mustaqbali starter credentials (synthetic)`, `Issued ${people.length} starter credentials`, { issued: people.length }, ['student_portfolio', 'notifications']);
    },
  };
}
