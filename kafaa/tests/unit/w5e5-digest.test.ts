/** F36 Personal weekly digest and nudges (W5 · E5, shell): every acceptance criterion on the local path, the pure rules shared with
 *  SQL, the seed and i18n. The SQL path is checked by scripts/validate/w5e5-digest-dalil.mjs (PGlite: SQL = TS for every person). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { hasKey } from '../../src/i18n';
import en from '../../src/i18n/digest.en.json';
import ar from '../../src/i18n/digest.ar.json';
import seed from '../../src/seed/seed.json';
import { matchOpportunities } from '../../src/modules/m20/match';
import { todayIso } from '../../src/domain/rules';
import {
  CAPS, DIGEST_KINDS, DIGEST_MAX, MATCH_MIN, PREFS_MSG, buildDigestItems, checkPrefs, composeDigest, defaultTargetRole, digestNotice, digestStats, dubaiHour, gatherDigest, hintOk,
  inQuietHours, isoWeekParts, matchScore, periodOf, prefsOf, type DigestData, type DigestItem,
} from '../../src/shell/digest/rules';
import { localDigestData } from '../../src/shell/digest/backend/local';

const S = seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } };
const T = S.tables;
const TODAY = S.meta.demo_today;
const data = (): DigestData => Object.fromEntries(['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions',
  'opportunities', 'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
  'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits', 'roleplay_sessions' /* FS wave F integration */, 'role_assignments' /* readiness 2026-10-13 */].map((t) => [t, T[t] ?? []])) as unknown as DigestData;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const mk = (kind: DigestItem['kind'], id: string, days: number | null, score: number | null = null): DigestItem => ({
  id: `${kind}:${id}`, kind, urgency: kind === 'expiry' ? 1 : kind === 'approval' ? 2 : 3, ref_table: 't', ref_id: id, title_en: id, title_ar: id, meta_en: null, meta_ar: null, link: '/my', due_on: null, days, score, why: [{ code: 'x' }],
});
const PREFS = (patch: Record<string, unknown> = {}) => ({ enabled: true, frequency: 'weekly' as const, quiet_start: null, quiet_end: null, muted_kinds: [] as string[], ...patch });

describe('F36 schema and seed', () => {
  it('has the two tables, RPC writes only, own-row reads', () => {
    for (const t of ['digest_runs', 'digest_prefs']) {
      expect(SCHEMA[t].write.mode).toBe('rpc');
      expect(SCHEMA[t].read).toEqual([{ res: 'notifications', person: 'person_id' }]);
    }
  });
  it('seeds four weekly digests per active staff member, each with at most 7 items and one notification when it has items', () => {
    const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
    expect(T.digest_runs.length).toBeGreaterThan(300);
    expect(T.digest_runs.every((r) => r.items.length <= DIGEST_MAX && r.item_count === r.items.length)).toBe(true);
    expect(new Set(T.digest_runs.map((r) => r.person_id)).size).toBeGreaterThan(staff.length - 10);
    const notes = new Map(T.notifications.filter((n) => n.kind === 'digest').map((n) => [n.id, n]));
    expect(T.digest_runs.every((r) => (r.item_count ? notes.has(r.notification_id) && notes.get(r.notification_id).link === '/my#digest' : r.notification_id === null))).toBe(true);
    // people with nudges off have no digests
    const off = T.digest_prefs.filter((p) => !p.enabled).map((p) => p.person_id);
    expect(off.length).toBeGreaterThan(0);
    expect(T.digest_runs.some((r) => off.includes(r.person_id))).toBe(false);
  });
  it('the seeded current digests equal a recompute with the shared rules (same function as the RPC)', () => {
    const d = data();
    const prefs = new Map(T.digest_prefs.map((p) => [p.person_id, p]));
    for (const r of T.digest_runs.filter((x) => x.as_of === TODAY)) expect(buildDigestItems(d, r.person_id, TODAY, prefsOf(prefs.get(r.person_id)))).toEqual(r.items);
  });
});

describe('F36 acceptance: at most 7 items, sorted by urgency (expiry < approvals < others)', () => {
  it('caps per kind, keeps the urgency order and the 7-item limit on a synthetic overload', () => {
    const cands = [mk('refresher', 'r', 0), mk('opportunity', 'o1', null, 0.8), mk('opportunity', 'o2', null, 0.95), mk('opportunity', 'o3', null, 0.9), mk('approval', 'a1', 9), mk('approval', 'a2', null),
      mk('expiry', 'e1', 60), mk('expiry', 'e2', 5), mk('expiry', 'e3', 30), mk('expiry', 'e4', 80), mk('coach', 'c', 20), mk('mentoring', 'm', -2), mk('conversation', 'cv', 10)];
    const out = composeDigest(cands, { muted_kinds: [] });
    expect(out).toHaveLength(DIGEST_MAX);
    expect(out.map((x) => x.urgency)).toEqual([...out.map((x) => x.urgency)].sort());
    expect(out.slice(0, 3).map((x) => x.id)).toEqual(['expiry:e2', 'expiry:e3', 'expiry:e1']); // 3 expiries max, soonest first
    expect(out.slice(3, 5).map((x) => x.id)).toEqual(['approval:a1', 'approval:a2']); // then approvals (dated first)
    expect(out.filter((x) => x.kind === 'opportunity').length).toBeLessThanOrEqual(CAPS.opportunity);
  });
  it('holds for every seeded person', () => {
    const d = data();
    for (const p of T.people) {
      const items = buildDigestItems(d, p.id, TODAY, { muted_kinds: [] });
      expect(items.length).toBeLessThanOrEqual(DIGEST_MAX);
      items.forEach((x, i) => { if (i) expect(x.urgency).toBeGreaterThanOrEqual(items[i - 1].urgency); });
      for (const x of items) { expect(x.link.startsWith('/')).toBe(true); expect(x.why.length).toBeGreaterThan(0); }
    }
  });
  it('mutes never remove expiry reminders', () => {
    const out = composeDigest([mk('expiry', 'e', 3), mk('coach', 'c', 1)], { muted_kinds: ['expiry', 'coach'] });
    expect(out.map((x) => x.kind)).toEqual(['expiry']);
    expect(checkPrefs(PREFS({ muted_kinds: ['expiry'] }))).toBe(PREFS_MSG.expiry);
  });
});

describe('F36 sources: each item kind follows its rule', () => {
  it('expiry: current qualifications on non-restricted standards within 90 days, and mirrored licences', () => {
    const d = data();
    const items = T.people.flatMap((p) => gatherDigest(d, p.id, TODAY).filter((x) => x.kind === 'expiry'));
    expect(items.length).toBeGreaterThan(0);
    const std = new Map(T.qual_standards.map((s) => [s.id, s]));
    for (const x of items.filter((i) => i.ref_table === 'qual_records')) {
      const r = T.qual_records.find((q) => q.id === x.ref_id)!;
      expect(std.get(r.standard_id)!.security_restricted).toBeFalsy();
      expect(x.days!).toBeGreaterThanOrEqual(0);
      expect(x.days!).toBeLessThanOrEqual(90);
    }
  });
  it('approvals: ratings asked of me, mentoring requests to me, releases waiting for me, my record to acknowledge', () => {
    const d = data();
    const all = T.people.flatMap((p) => gatherDigest(d, p.id, TODAY).filter((x) => x.kind === 'approval').map((x) => ({ me: p.id, x })));
    const tables = new Set(all.map((a) => a.x.ref_table));
    for (const t of ['skill_checkins', 'mentoring_requests', 'opportunity_applications', 'career_conversations']) expect(tables.has(t), t).toBe(true);
    for (const { me, x } of all.filter((a) => a.x.ref_table === 'opportunity_applications')) expect(T.opportunity_applications.find((a) => a.id === x.ref_id)!.releaser_id).toBe(me);
  });
  it('opportunities: the digest match equals the F08 engine and only >= 70% matches appear', () => {
    const d = data();
    const sk = new Map(T.skills.map((s) => [s.id, s]));
    const w = T.engine_settings.find((s) => s.id === 'match')!.weights;
    for (const p of T.people.filter((x) => x.kind === 'staff').slice(0, 30)) {
      const lv = new Map<string, number>();
      for (const s of T.person_skills) if (s.person_id === p.id && s.active !== false && s.level > 0) lv.set(s.skill_id, Math.max(lv.get(s.skill_id) ?? 0, s.level));
      const short = T.career_targets.filter((t) => t.person_id === p.id && t.active !== false).sort((a, b) => a.rank - b.rank).map((t) => t.role_id);
      const tgt = defaultTargetRole(T.career_paths, p.job_role_id, short);
      const f08 = matchOpportunities({ opps: T.opportunities, states: T.person_skills.filter((s) => s.person_id === p.id), skills: T.skills, roleComps: T.role_competencies, currentRole: p.job_role_id, targetRole: tgt, family: p.job_family_id, weights: w });
      for (const r of f08) expect(matchScore(r.item!.opp as never, lv, sk, T.role_competencies, p.job_role_id, tgt, w)).toBe(r.score);
      for (const x of gatherDigest(d, p.id, TODAY).filter((i) => i.kind === 'opportunity')) expect(x.score!).toBeGreaterThanOrEqual(MATCH_MIN);
    }
  });
  it('opting out of marketplace or coach ranking (F24) removes the ranked kinds', () => {
    const d = data();
    const who = T.people.find((p) => gatherDigest(d, p.id, TODAY).some((x) => x.kind === 'opportunity'))!.id;
    const hint = { coach: { id: 'c1', item_id: 'x', title_en: 'Course', title_ar: 'دورة', link: '/learn/course/c-hu', reasons: [] } };
    expect(gatherDigest(d, who, TODAY, hint).some((x) => x.ref_table === 'coach')).toBe(true);
    const opted = { ...d, reco_optouts: [{ person_id: who, surface: 'marketplace', opted_out: true }, { person_id: who, surface: 'coach', opted_out: true }] };
    const items = gatherDigest(opted, who, TODAY, hint);
    expect(items.some((x) => x.kind === 'opportunity')).toBe(false);
    expect(items.some((x) => x.ref_table === 'coach')).toBe(false);
  });
});

describe('F36 helpers', () => {
  it('period keys follow ISO weeks (year edges), fortnights and months', () => {
    expect(periodOf('2026-10-08', 'weekly')).toBe('2026-W41');
    expect(periodOf('2026-10-08', 'fortnightly')).toBe('2026-F21');
    expect(periodOf('2026-10-08', 'monthly')).toBe('2026-M10');
    expect(isoWeekParts('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(periodOf('2024-12-30', 'weekly')).toBe('2025-W01');
  });
  it('quiet hours wrap midnight; Abu Dhabi is UTC+4', () => {
    expect(inQuietHours(23, 22, 6)).toBe(true);
    expect(inQuietHours(5, 22, 6)).toBe(true);
    expect(inQuietHours(6, 22, 6)).toBe(false);
    expect(inQuietHours(12, null, null)).toBe(false);
    expect(dubaiHour('2026-10-08T20:30:00Z')).toBe(0);
  });
  it('coach hints must be internal links with keyed reasons', () => {
    const ok = { id: 'a', item_id: 'b', title_en: 'T', title_ar: 'ت', link: '/learn/course/x', reasons: [{ code: 'gap', key: 'common.engines.reason.gap' }] };
    expect(hintOk(ok)).toBe(true);
    expect(hintOk({ ...ok, link: 'https://evil.example' })).toBe(false);
    expect(hintOk({ ...ok, link: '//evil.example' })).toBe(false);
    expect(hintOk({ ...ok, reasons: [{ code: 'x', key: 'not a key' }] })).toBe(false);
  });
  it('the notification text summarises the items', () => {
    const n = digestNotice([mk('expiry', 'QS-RO', 10), mk('coach', 'HU', null)], 'weekly');
    expect(n.title_en).toBe('Your weekly digest: 2 things for you');
    expect(n.title_ar).toMatch(/[؀-ۿ]/);
    expect(n.severity).toBe('warn');
  });
  it('admin stats suppress every count under 10', () => {
    const runs = Array.from({ length: 12 }, (_, i) => ({ period: '2026-W40', notification_id: `n${i}`, items: [{ kind: 'coach' }] })).concat([{ period: '2026-W41', notification_id: 'x', items: [] }] as never);
    const notes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, read_at: i < 9 ? '2026-10-01' : null }));
    const s = digestStats(runs, notes, []);
    expect(s.periods[0]).toEqual({ period: '2026-W41', delivered: null, opened: null, rate: null, suppressed: true });
    expect(s.periods[1]).toEqual({ period: '2026-W40', delivered: 12, opened: 9, rate: 0.75, suppressed: false });
    expect(s.off).toBeNull();
  });
});

describe('F36 RPCs on the local backend', () => {
  it('acceptance: running the RPC twice in a period creates one digest (and one notification)', async () => {
    await as('k-ro');
    const me = b.identity().personId!;
    expect((await b.rpc.setDigestPrefs(PREFS({ frequency: 'monthly' }))).ok).toBe(true); // a period with no seeded digest
    const r1 = await b.rpc.buildDigest();
    const r2 = await b.rpc.buildDigest();
    expect(r1.ok && r1.data!.created).toBe(true);
    expect(r2.ok && !r2.data!.created && r2.data!.run_id === r1.data!.run_id).toBe(true);
    expect(r1.data!.period).toBe(periodOf(todayIso(), 'monthly'));
    expect(b.raw('digest_runs').filter((r) => r.person_id === me && r.period === r1.data!.period)).toHaveLength(1);
    if (r1.data!.items.length) expect(b.raw('notifications').filter((n) => n.id === r1.data!.notification_id)).toHaveLength(1);
    expect(r1.data!.items.length).toBeLessThanOrEqual(DIGEST_MAX);
    expect(r1.data!.items).toEqual(buildDigestItems(localDigestData(b), me, todayIso(), { muted_kinds: [] }));
  });
  it('acceptance: turning nudges off stops new digests', async () => {
    await as('k-ro');
    const me = b.identity().personId!;
    const before = b.raw('digest_runs').filter((r) => r.person_id === me).length;
    expect((await b.rpc.setDigestPrefs(PREFS({ enabled: false, frequency: 'fortnightly' }))).ok).toBe(true);
    const r = await b.rpc.buildDigest();
    expect(r.ok).toBe(false);
    expect(r.code).toBe('nudges_off');
    expect(b.raw('digest_runs').filter((x) => x.person_id === me)).toHaveLength(before);
    const audit = [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
    expect(audit.action).toBe('digest.build');
    expect(audit.outcome).toBe('refused');
  });
  it('quiet hours defer a new digest; settings are validated server-side', async () => {
    await as('k-ro');
    const h = dubaiHour(new Date());
    expect((await b.rpc.setDigestPrefs(PREFS({ frequency: 'fortnightly', quiet_start: h, quiet_end: (h + 1) % 24 }))).ok).toBe(true);
    const r = await b.rpc.buildDigest();
    expect(r.code).toBe('quiet_hours');
    expect((await b.rpc.setDigestPrefs(PREFS({ frequency: 'daily' as never }))).message).toBe(PREFS_MSG.frequency);
    expect((await b.rpc.setDigestPrefs(PREFS({ quiet_start: 22, quiet_end: null }))).message).toBe(PREFS_MSG.quiet);
    expect((await b.rpc.setDigestPrefs(PREFS({ muted_kinds: ['expiry'] }))).message).toBe(PREFS_MSG.expiry);
    expect((await b.rpc.buildDigest({ coach: { id: 'x', item_id: 'y', title_en: 'a', title_ar: 'b', link: 'https://x', reasons: [] } })).code).toBe('invalid');
  });
  it('anonymous callers are refused; admins and auditors get aggregates only; staff cannot read them', async () => {
    await as(null);
    expect((await b.rpc.buildDigest()).code).toBe('not_signed_in');
    await as('k-admin');
    const s = await b.rpc.digestStats();
    expect(s.periods.length).toBeGreaterThanOrEqual(4);
    expect(s.periods.every((p) => (p.suppressed ? p.delivered === null : p.delivered! >= 10))).toBe(true);
    expect(s.periods.some((p) => !p.suppressed && p.rate! > 0 && p.rate! < 1)).toBe(true);
    await as('k-auditor');
    expect((await b.rpc.digestStats()).periods.length).toBeGreaterThan(0);
    await as('k-ro');
    await expect(b.rpc.digestStats()).rejects.toThrow(/aggregate-only/);
    // RLS: a person reads only their own digests
    const mine = await b.list('digest_runs');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.person_id === b.identity().personId)).toBe(true);
  });
});

describe('F36 i18n', () => {
  it('every reason code, kind and line exists in English and Arabic', () => {
    const d = data();
    const codes = new Set(T.people.flatMap((p) => gatherDigest(d, p.id, TODAY).flatMap((x) => x.why.map((w) => w.code))));
    for (const c of codes) expect(hasKey(`digest.why.${c}`), c).toBe(true);
    for (const k of DIGEST_KINDS) for (const dict of [en, ar] as any[]) { expect(dict.kind[k]).toBeTruthy(); expect(dict.kindHint[k]).toBeTruthy(); expect(dict.line[k]).toBeTruthy(); expect(dict.line[`${k}_open`]).toBeTruthy(); }
    expect((ar as any).panel.title).toMatch(/[؀-ۿ]/);
  });
});
