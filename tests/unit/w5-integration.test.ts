/** Wave-5 integration on master: the cross-feature wiring done by the integration lead.
 *   F38 -> F36  the personal digest's "approvals I owe" lists OJT practice entries waiting for my acknowledgement (named preceptor)
 *               and OJT evaluation requests addressed to me, each deep-linked to the logbook tab, never future-dated
 *   Routes      206 routes after wave 5 (193 + M17/M02 3, M09 5, M06 3, M07 1, M13 admin digest 1)
 * The SQL side (kafaa_dg_gather in 20261009159001_kafaa_w5qa_integration.sql) is proved equal to the TS rules for every seeded
 * person by scripts/validate/w5e5-digest-dalil.mjs and checked live-flow by scripts/validate/w5qa-integration.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey, translate } from '../../src/i18n';
import { todayIso } from '../../src/domain/rules';
import { buildDigestItems, gatherDigest, prefsOf } from '../../src/shell/digest/rules';
import { localDigestData } from '../../src/shell/digest/backend/local';
import seed from '../../src/seed/seed.json';
import ar from '../../src/i18n/digest.ar.json';

const S = seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } };
const T = S.tables;
const TODAY = S.meta.demo_today;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const data = () => ({
  people: T.people, qual_records: T.qual_records, qual_standards: T.qual_standards, licences: T.licences, skill_checkins: T.skill_checkins, skill_ratings: T.skill_ratings,
  mentoring_requests: T.mentoring_requests, mentoring_agreements: T.mentoring_agreements, mentoring_sessions: T.mentoring_sessions, opportunities: T.opportunities,
  opportunity_applications: T.opportunity_applications, career_conversations: T.career_conversations, refresh_state: T.refresh_state, refresh_prefs: T.refresh_prefs,
  enrolments: T.enrolments, courses: T.courses, person_skills: T.person_skills, skills: T.skills, role_competencies: T.role_competencies, career_paths: T.career_paths,
  career_targets: T.career_targets, engine_settings: T.engine_settings, reco_optouts: T.reco_optouts, ojt_logs: T.ojt_logs, ojt_eval_requests: T.ojt_eval_requests,
});

describe('F38 -> F36: OJT approvals in the personal digest', () => {
  it('every seeded practice entry waiting for acknowledgement is an approval item for its preceptor, linked to the logbook', () => {
    const pending = T.ojt_logs.filter((l) => l.status === 'pending_ack' && l.on_date <= TODAY);
    expect(pending.length).toBeGreaterThanOrEqual(4);
    for (const l of pending) {
      const items = gatherDigest(data(), l.preceptor_person_id, TODAY);
      const it = items.find((x) => x.id === `approval:ojt_logs:${l.id}`)!;
      expect(it).toMatchObject({ kind: 'approval', urgency: 2, ref_table: 'ojt_logs', ref_id: l.id, link: '/my/ojt?tab=acknowledge' });
      expect(it.why[0]).toMatchObject({ code: 'approval_ojt_ack', vars: { date: l.on_date } });
      // never for the trainee themself
      expect(gatherDigest(data(), l.person_id, TODAY).some((x) => x.id === it.id)).toBe(false);
    }
  });
  it('the open evaluation request is an approval item for its evaluator; completed or cancelled ones are not', () => {
    for (const r of T.ojt_eval_requests) {
      const has = gatherDigest(data(), r.evaluator_person_id, TODAY).some((x) => x.id === `approval:ojt_eval_requests:${r.id}` && x.link === '/my/ojt?tab=evaluate');
      expect(has, r.id).toBe(r.status === 'requested');
    }
    expect(T.ojt_eval_requests.some((r) => r.status === 'requested')).toBe(true);
  });
  it('entries dated after the digest day are left out (no anachronism in past digests)', () => {
    const l = T.ojt_logs.find((x) => x.status === 'pending_ack')!;
    const before = gatherDigest(data(), l.preceptor_person_id, '2026-09-01').some((x) => x.id === `approval:ojt_logs:${l.id}`);
    expect(before).toBe(false);
  });
  it('the seeded current digests include the OJT approvals (the seed is what the rules compute)', () => {
    const run = T.digest_runs.find((r) => r.id === 'dg:p-sq-lead:2026-W41')!;
    expect(run.items.some((i: any) => i.ref_table === 'ojt_logs')).toBe(true);
    const prefs = new Map(T.digest_prefs.map((p) => [p.person_id, p]));
    for (const r of T.digest_runs.filter((x) => x.as_of === TODAY && x.items.some((i: any) => String(i.ref_table).startsWith('ojt'))))
      expect(buildDigestItems(data(), r.person_id, TODAY, prefsOf(prefs.get(r.person_id)))).toEqual(r.items);
  });
  it('acknowledging the entry removes it from the preceptor digest (local backend, same rules)', async () => {
    await as('sq-lead');
    const me = b.identity().personId!;
    const log = (b.raw('ojt_logs') as any[]).find((l) => l.preceptor_person_id === me && l.status === 'pending_ack')!;
    expect(gatherDigest(localDigestData(b), me, todayIso()).some((x) => x.ref_id === log.id)).toBe(true);
    const r = await b.rpc.ackPractice({ log_id: log.id, decision: 'acknowledge', feedback: 'Good walk-down of the procedure steps', ready: false });
    expect(r.ok, r.code).toBe(true);
    expect(gatherDigest(localDigestData(b), me, todayIso()).some((x) => x.ref_id === log.id)).toBe(false);
  });
  it('the new reasons exist in EN and AR and keep the "practice, not a sign-off" wording', () => {
    for (const k of ['approval_ojt_ack', 'approval_ojt_eval']) {
      expect(hasKey(`digest.why.${k}`)).toBe(true);
      expect(String((ar as any).why[k])).toContain('{date}');
    }
    expect(translate('en', 'digest.why.approval_ojt_ack', { date: '2026-10-06' })).toMatch(/practice, not a qualification sign-off/);
  });
  it('the integration migration replaces only kafaa_dg_gather and keeps it closed to API roles', () => {
    const sql = readFileSync('supabase/migrations/20261009159001_kafaa_w5qa_integration.sql', 'utf8');
    expect(sql.match(/create or replace function (\w+)/g)).toEqual(['create or replace function kafaa_dg_gather']);
    expect(sql).toMatch(/revoke execute on function kafaa_dg_gather\(text, date, jsonb\) from public, anon, authenticated/);
    expect(sql).not.toMatch(/\b(drop|delete|truncate)\b/i);
  });
});

describe('Wave-5 route registry', () => {
  it('212 routes (206 after wave 5 + 6 FS wave A), and the 13 wave-5 routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(227); // FS wave B QA: + 11 (FS09/FS10 5, FS11/FS12 5, FS16 1). FS wave B · E1: + 4 M28 routes (FS07, FS08). FS wave A: + /my/skills/confidence, /admin/skills-confidence (FS03), /workforce/future/keyspace (FS04), /careers/horizons, /careers/roles/:slug/profile (FS05), /training/sat/future (FS06)
    const paths = new Set(R.map((r) => r.path));
    for (const p of ['/my/skills/credentials', '/my/ojt', '/team/ojt', '/partner/workforce/passport', '/partner/workforce/passport/:personId', '/partner/workforce/precheck',
      '/training/equivalency/passport/:personId', '/admin/suppliers/contract-roles', '/pathways/journey', '/pathways/journey/parents', '/workforce/journeys', '/workforce/skills-outlook', '/admin/digest'])
      expect(paths.has(p), p).toBe(true);
  });
});
