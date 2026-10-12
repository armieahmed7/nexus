/** FS75 Future-skills nudges in the weekly digest (wave H · E3, fsHe3, src/shell/digest): every acceptance criterion on the local path,
 *  the pure rules per topic (synthetic fixtures with a fixed day), the release gate that keeps the seeded digests unchanged, the published
 *  method rows and i18n. The SQL path is proved equal by scripts/validate/fs83-digest-nudges.mjs (PGlite). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import en from '../../src/i18n/digest.en.json';
import ar from '../../src/i18n/digest.ar.json';
import seed from '../../src/seed/seed.json';
import {
  CAPS, DIGEST_KINDS, DIGEST_MAX, MUTABLE_KINDS, PREFS_MSG, buildDigestItems, checkPrefs, composeDigest, gatherDigest, periodOf, prefsOf, type DigestData, type DigestItem,
} from '../../src/shell/digest/rules';
import {
  FS75_FROM, FUTURE_TOPICS, GIG_NEW_DAYS, GOAL_AHEAD_DAYS, LAPSE_AHEAD_DAYS, PATHWAY_NEW_DAYS, PROFILE_NEW_DAYS, TOPIC_OF_TABLE, futureTopic, lapseDate,
} from '../../src/shell/digest/future';
import { localDigestData } from '../../src/shell/digest/backend/local';

vi.setConfig({ testTimeout: 90000 });
const S = seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } };
const T = S.tables;
const DAY = '2026-10-12';
const all = (): DigestData => new Proxy({} as Record<string, unknown>, { get: (_, k: string) => T[k] ?? [] }) as unknown as DigestData;
const fsItems = (xs: DigestItem[]) => xs.filter((i) => i.kind === 'future' || i.ref_table === 'fellowship_milestones');
const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string);
const prefs = new Map(T.digest_prefs.map((p) => [p.person_id, p]));

// ───────────── synthetic fixture: one staff member, a fast and a slow skill, a role with a 2030 profile
const ME = 'p-x';
function base(patch: Partial<Record<keyof DigestData, any[]>> = {}): DigestData {
  const d: Record<string, any[]> = {
    people: [{ id: ME, kind: 'staff', status: 'active', job_role_id: 'role-x', job_family_id: 'fam-x', display_name: 'Synthetic X', display_name_ar: 'س' },
      { id: 'p-y', kind: 'staff', status: 'active', job_role_id: 'role-y', job_family_id: 'fam-y', display_name: 'Fellow Y', display_name_ar: 'ص' }],
    skills: [{ id: 'sk-fast', area: 'digital', name_en: 'Plant data', name_ar: 'بيانات المحطة' }, { id: 'sk-slow', area: 'engineering', name_en: 'Thermal design', name_ar: 'التصميم الحراري' },
      { id: 'sk-goal', area: 'leadership', name_en: 'Coaching', name_ar: 'التوجيه' }, { id: 'sk-ai', area: 'ai_data', decay_class: 'fast', name_en: 'AI verification', name_ar: 'التحقق' }],
    person_skills: [], role_profile_versions: [], skill_goals: [], skill_goal_plans: [], pathways: [], pathway_enrolments: [], ai_rungs: [], ai_skill_tracks: [], ai_systems: [],
    ai_system_users: [], skill_signals: [], fellowship_milestones: [], opportunities: [], opportunity_applications: [], reco_optouts: [],
    ...patch,
  };
  return new Proxy(d, { get: (o, k: string) => o[k] ?? [] }) as unknown as DigestData;
}
const reason = (level: number, observed_on: string, extra: Record<string, unknown> = {}) => ({ code: 'assessment', evidence_id: `se:${observed_on}`, level, basis: 'evidenced', observed_on, ageing: false, source: 'assessment', w: 0.6, hl: 18, ...extra });
const future = (d: DigestData, day = DAY, me = ME) => fsItems(gatherDigest(d, me, day));

describe('FS75 release gate and seed', () => {
  it('nothing FS75 adds appears before 2026-10-12, so the seeded digests (2026-W38..W41) are unchanged', () => {
    for (const pid of staff) for (const day of ['2026-09-24', '2026-10-08', '2026-10-11']) expect(fsItems(gatherDigest(all(), pid, day))).toEqual([]);
    for (const r of T.digest_runs.filter((x) => x.as_of === S.meta.demo_today)) expect(buildDigestItems(all(), r.person_id, r.as_of, prefsOf(prefs.get(r.person_id)))).toEqual(r.items);
    expect(T.digest_runs.every((r) => r.as_of < FS75_FROM && r.items.every((i: DigestItem) => i.kind !== 'future'))).toBe(true);
    expect(periodOf(FS75_FROM, 'weekly')).toBe('2026-W42');
  });
  it('seeded data gives future-skills nudges from the release day on (role profile, AI literacy, pathways, gigs, fellowship sign-offs)', () => {
    const topics: Record<string, number> = {};
    for (const pid of staff) for (const i of future(all(), DAY, pid)) topics[futureTopic(i) ?? 'fellowship'] = (topics[futureTopic(i) ?? 'fellowship'] ?? 0) + 1;
    expect(topics.role_profile).toBeGreaterThan(50);
    expect(topics.ai_literacy).toBeGreaterThan(20);
    expect(topics.pathway).toBeGreaterThan(10);
    expect(topics.future_gig).toBeGreaterThan(0);
    expect(topics.fellowship).toBe(3);
  });
  it('the published method rows (kafaa_digest_nudge_rules) match the rule constants, cite FS75 benchmarks and link inside the app', () => {
    const rows = T.digest_nudge_rules;
    expect(rows).toHaveLength(8);
    expect(SCHEMA.digest_nudge_rules.write.mode).toBe('none');
    expect(SCHEMA.digest_nudge_rules.read).toEqual([{ res: 'public_content' }]);
    expect(new Set(rows.map((r) => r.topic))).toEqual(new Set([...FUTURE_TOPICS, 'fellowship']));
    const win: Record<string, number | null> = { decay: LAPSE_AHEAD_DAYS, goal: GOAL_AHEAD_DAYS, ai_literacy: null, role_profile: PROFILE_NEW_DAYS, rising_skill: null, future_gig: GIG_NEW_DAYS, pathway: PATHWAY_NEW_DAYS, fellowship: null };
    for (const r of rows) {
      expect(r.window_days).toBe(win[r.topic]);
      expect(r.since).toBe(FS75_FROM);
      expect(r.link).toMatch(/^\/[a-z]/);
      expect(r.benchmark_ids).toEqual(FEATURE_BENCHMARKS.FS75);
      expect(r.rule_en.length > 40 && r.rule_ar.length > 40 && r.name_ar.length > 5).toBe(true);
    }
  });
});

describe('FS75 rules per topic (synthetic, fixed day)', () => {
  it('decay: a fast-decay skill held at level 2+ whose newest evidence at that level passes its half-life within 60 days', () => {
    const ps = (id: string, skill: string, level: number, reasons: unknown[]) => ({ id, person_id: ME, skill_id: skill, level, active: true, reasons });
    const d = base({ person_skills: [
      ps('ps:a', 'sk-fast', 3, [reason(3, '2025-05-20'), reason(2, '2026-01-01')]), // 2025-05-20 + 548 days = 2026-11-19
      ps('ps:b', 'sk-slow', 3, [reason(3, '2025-05-20', { hl: 60 })]), // slow class: never
      ps('ps:c', 'sk-ai', 1, [reason(1, '2025-05-01')]), // level 1 cannot slip lower
    ] });
    expect(lapseDate(d.person_skills[0])).toEqual({ date: '2026-11-19', months: 18 });
    const [x] = future(d);
    expect(x).toMatchObject({ kind: 'future', ref_table: 'person_skills', ref_id: 'ps:a', due_on: '2026-11-19', days: 38, link: '/my/skills/confidence', score: null });
    expect(x.why[0]).toEqual({ code: 'future_decay', vars: { date: '2026-11-19', level: 3, months: 18 } });
    expect(future(d, '2026-09-18')).toEqual([]); // before the release
    expect(future(d, '2026-11-20')).toEqual([]); // passed: the next recompute shows the lower level
    // a current qualification holds; evidence already ageing never slips again
    expect(lapseDate({ level: 3, reasons: [reason(3, '2025-05-20', { code: 'qual' })] })).toBeNull();
    expect(lapseDate({ level: 2, reasons: [reason(2, '2024-01-01', { ageing: true })] })).toBeNull();
    expect(lapseDate({ level: 2, reasons: [reason(2, '2025-06-01'), reason(2, '2026-02-01')] })?.date).toBe('2027-08-03'); // the newest evidence counts
  });
  it('goal (closes the wave-D gap): a dated FS33 goal within 30 days or up to 30 days overdue; an undated FS07 goal asks for a date', () => {
    const plan = { id: 'sg:x:goal', person_id: ME, skill_id: 'sk-goal', target_level: 3, target_date: '2026-11-01', status: 'active' };
    const d = base({ skill_goal_plans: [plan], skill_goals: [{ id: 'sg:x:goal', person_id: ME, skill_id: 'sk-goal', target_level: 3, status: 'active', created_at: '2026-10-01T00:00:00Z' }] });
    expect(future(d)).toEqual([expect.objectContaining({ ref_table: 'skill_goal_plans', days: 20, due_on: '2026-11-01', link: '/my/skills/goals' })]);
    expect(future(d, '2026-11-20')[0].why[0].code).toBe('future_goal_overdue');
    expect(future(d, '2026-12-02')).toEqual([]);
    // reached the target: no nudge
    expect(future(base({ skill_goal_plans: [plan], person_skills: [{ id: 'ps', person_id: ME, skill_id: 'sk-goal', level: 3, active: true, reasons: [] }] }))).toEqual([]);
    const undated = future(base({ skill_goals: [{ id: 'sg:x:new', person_id: ME, skill_id: 'sk-goal', target_level: 2, status: 'active', created_at: '2026-10-09T08:00:00Z' }] }));
    expect(undated).toEqual([expect.objectContaining({ ref_table: 'skill_goals', title_en: 'Give your goal a date: Coaching', score: 0.7 })]);
  });
  it('ai_literacy: an AI system I use needs a rung I do not hold; unlisted systems, inactive groups and other families are skipped', () => {
    const rungs = ['mindset', 'ethics', 'techniques', 'design'].map((dim, i) => ({ id: `air:1:${dim}`, rung: 1, dimension: dim, skill_ids: ['sk-ai'], min_level: 1, sort: i }));
    const sys = (id: string, extra = {}) => ({ id, name_en: `System ${id}`, name_ar: `نظام ${id}`, status: 'published', listed: true, ...extra });
    const grp = (id: string, system_id: string, extra = {}) => ({ id, system_id, family_ids: ['fam-x'], all_staff: false, required_rung: 1, required_cells: [], active: true, listed: true, label_en: 'Operators', label_ar: 'المشغلون', ...extra });
    const d = base({ ai_rungs: rungs, ai_skill_tracks: [{ skill_id: 'sk-ai', track: 'literacy' }], ai_systems: [sys('s1'), sys('s2', { listed: false }), sys('s3')],
      ai_system_users: [grp('g1', 's1'), grp('g2', 's2', { required_rung: 3 }), grp('g3', 's3', { family_ids: ['fam-y'], required_rung: 2 }), grp('g4', 's1', { required_rung: 2, active: false })] });
    const [x] = future(d);
    expect(x).toMatchObject({ ref_table: 'ai_system_users', ref_id: 'g1', link: '/my/ai-fluency', title_en: 'System s1: AI fluency rung 1 needed' });
    expect(x.why[0]).toEqual({ code: 'future_ai_required', vars: { system: { en: 'System s1', ar: 'نظام s1' }, rung: 1, have: 0 } });
    // holding the literacy skill at level 1 meets rung 1: nothing left to nudge
    const held = base({ ai_rungs: rungs, ai_skill_tracks: [{ skill_id: 'sk-ai', track: 'literacy' }], ai_systems: [sys('s1')], ai_system_users: [grp('g1', 's1')],
      person_skills: [{ id: 'ps:ai', person_id: ME, skill_id: 'sk-ai', level: 1, basis: 'validated', active: true, reasons: [] }] });
    expect(future(held)).toEqual([]);
  });
  it('role_profile: my role\'s 2030 profile published (v1) or changed (v2+) in the last 28 days, with the number of skill gaps', () => {
    const rpv = (version: number, at: string) => ({ id: `rpv-x-${version}`, role_id: 'role-x', horizon: '2030', status: 'published', version, published_at: `${at}T08:00:00Z`,
      requirements: [{ kind: 'skill', ref_id: 'sk-fast', level: 2 }, { kind: 'competency', ref_id: 'co-1', level: 3 }] });
    expect(future(base({ role_profile_versions: [rpv(1, '2026-09-20')] }))[0].why.map((w) => w.code)).toEqual(['future_profile_published', 'future_profile_gaps']);
    const changed = future(base({ role_profile_versions: [rpv(1, '2026-03-01'), rpv(2, '2026-10-01')] }));
    expect(changed[0]).toMatchObject({ ref_id: 'rpv-x-2', title_en: 'Your role in 2030: the profile was updated', link: '/my/role-2030', score: 0.9 });
    expect(changed[0].why[0]).toEqual({ code: 'future_profile_changed', vars: { date: '2026-10-01', version: 2 } });
    expect(future(base({ role_profile_versions: [rpv(1, '2026-09-13')] }))).toEqual([]); // 29 days ago
  });
  it('rising_skill (FS70 data-only coupling): the latest list\'s growing skills for my family first; "now" rows, older quarters and held skills are skipped', () => {
    const sig = (id: string, skill_id: string, extra = {}) => ({ id, quarter: '2026-Q3', skill_id, category: 'growing', rank: 5, families: [], ...extra });
    const profile = { id: 'rpv', role_id: 'role-x', horizon: '2030', status: 'published', version: 1, published_at: '2026-01-01T00:00:00Z', requirements: [{ kind: 'skill', ref_id: 'sk-slow', level: 1 }] };
    const d = base({ role_profile_versions: [profile], skill_signals: [sig('a', 'sk-slow', { rank: 1 }), sig('b', 'sk-fast', { families: ['fam-x'] }), sig('c', 'sk-goal', { families: ['fam-x'], category: 'now', rank: 0 }),
      sig('d', 'sk-ai', { families: ['fam-x'], quarter: '2026-Q2', rank: 0 })] });
    const r = future(d).filter((i) => i.ref_table === 'skill_signals');
    expect(r).toEqual([expect.objectContaining({ ref_id: 'sk-fast', link: '/skills/sk-fast', title_en: 'Rising at ENEC: Plant data' })]);
    expect(r[0].why).toEqual([{ code: 'future_rising', vars: { quarter: '2026-Q3' } }, { code: 'future_rising_family' }]);
    const other = future(d, DAY, 'p-y').filter((i) => i.ref_table === 'skill_signals');
    expect(other).toEqual([]); // fam-y: no family row, and sk-slow is not in p-y's profile
    // without FS70 rows (table absent before the merge) there is simply no rising-skill item
    expect(future(base({ role_profile_versions: [profile] })).some((i) => i.ref_table === 'skill_signals')).toBe(false);
  });
  it('future_gig and pathway: new items that build one of my future skills, not repeated, not after an opt-out, one level up only', () => {
    const goal = { id: 'sg:g', person_id: ME, skill_id: 'sk-goal', target_level: 2, status: 'active', created_at: '2026-10-01T00:00:00Z' };
    const gig = { id: 'fg-1', channel: 'ai_pilot', status: 'open', listed: true, posted_by: 'p-y', created_at: '2026-10-09T08:00:00Z', seats: 2, seats_taken: 0, eligible_families: [], skills_needed: ['sk-slow'], skills_gained: ['sk-goal'], title_en: 'Gig', title_ar: 'مهمة' };
    const pw = (id: string, level: number) => ({ id, skill_id: 'sk-goal', level, status: 'published', listed: true, updated_at: '2026-10-10T00:00:00Z', title_en: id, title_ar: id, envelope_months: 3, weekly_hours: 2 });
    const d = base({ skill_goals: [goal], opportunities: [gig], pathways: [pw('pw-l1', 1), pw('pw-l2', 2), pw('pw-l3', 3)] });
    const xs = future(d);
    expect(xs.find((i) => i.ref_table === 'opportunities')).toMatchObject({ ref_id: 'fg-1', link: '/opportunities/fg-1', why: [{ code: 'future_gig_goal', vars: { skill: { en: 'Coaching', ar: 'التوجيه' } } }, { code: 'future_gig_new', vars: { date: '2026-10-09' } }] });
    expect(xs.find((i) => i.ref_table === 'pathways')).toMatchObject({ ref_id: 'pw-l1', link: '/learn/pathways/pw-l1' });
    expect(future(d, '2026-10-31').some((i) => i.ref_table === 'opportunities')).toBe(false); // older than 21 days
    expect(future(base({ skill_goals: [goal], opportunities: [gig], reco_optouts: [{ person_id: ME, surface: 'marketplace', opted_out: true }] })).some((i) => i.ref_table === 'opportunities')).toBe(false);
    expect(future(base({ skill_goals: [goal], pathways: [pw('pw-l1', 1)], pathway_enrolments: [{ person_id: ME, pathway_id: 'pw-l1', status: 'active' }] }))).toEqual([expect.objectContaining({ ref_table: 'skill_goals' })]);
  });
  it('approvals (FS67 hand-off): fellowship milestones submitted to me as the named supervisor', () => {
    const m = { id: 'fm-1', fellowship_id: 'fw-1', fellow_person_id: 'p-y', supervisor_person_id: ME, status: 'submitted', submitted_at: '2026-10-05T08:00:00Z' };
    const d = base({ fellowship_milestones: [m, { ...m, id: 'fm-2', status: 'signed_off' }, { ...m, id: 'fm-3', supervisor_person_id: 'p-y' }] });
    expect(future(d)).toEqual([expect.objectContaining({ id: 'approval:fellowship_milestones:fm-1', kind: 'approval', urgency: 2, link: '/universities/fellowships/fw-1', title_en: 'Fellowship milestone to sign off: Fellow Y' })]);
  });
});

describe('FS75 acceptance: still at most 7 items, idempotent per period, preferences respected', () => {
  it('AC1: every digest on and after the release day keeps at most 7 items and at most 2 future-skills items, after every other kind', () => {
    for (const day of [DAY, '2026-10-26', '2026-11-30']) {
      for (const pid of staff) {
        const xs = buildDigestItems(all(), pid, day, prefsOf(prefs.get(pid)));
        expect(xs.length).toBeLessThanOrEqual(DIGEST_MAX);
        expect(xs.filter((i) => i.kind === 'future').length).toBeLessThanOrEqual(CAPS.future);
        const urg = xs.map((i) => i.urgency);
        expect(urg).toEqual([...urg].sort());
      }
    }
    const mk = (kind: DigestItem['kind'], id: string): DigestItem => ({ id: `${kind}:t:${id}`, kind, urgency: kind === 'approval' ? 2 : 3, ref_table: 't', ref_id: id, title_en: id, title_ar: id, meta_en: null, meta_ar: null, link: '/my', due_on: null, days: null, score: null, why: [{ code: 'x' }] });
    const out = composeDigest([mk('future', 'f1'), mk('future', 'f2'), mk('future', 'f3'), mk('refresher', 'r'), mk('coach', 'c'), mk('mentoring', 'm'), mk('approval', 'a1'), mk('approval', 'a2'), mk('conversation', 'v')], { muted_kinds: [] });
    expect(out).toHaveLength(7);
    expect(out.map((i) => i.kind)).toEqual(['approval', 'approval', 'coach', 'mentoring', 'conversation', 'refresher', 'future']);
  });
  it('AC1: buildDigest twice in a period returns one run with the same items (idempotent), future items included, at most 7', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T05:00:00Z')); // 09:00 in Abu Dhabi, week 2026-W42
    try {
      const b = new LocalBackend(); await b.whenReady(); await b.reset();
      b.setPersona('k-ro'); await b.whenReady();
      const me = b.identity().personId!;
      const r1 = await b.rpc.buildDigest();
      const r2 = await b.rpc.buildDigest();
      expect(r1.ok && r1.data!.created && r1.data!.period === '2026-W42').toBe(true);
      expect(r2.ok && !r2.data!.created && r2.data!.run_id === r1.data!.run_id).toBe(true);
      expect(r2.data!.items).toEqual(r1.data!.items);
      expect(b.raw('digest_runs').filter((r) => r.person_id === me && r.period === '2026-W42')).toHaveLength(1);
      expect(r1.data!.items.length).toBeLessThanOrEqual(DIGEST_MAX);
      expect(r1.data!.items).toEqual(buildDigestItems(localDigestData(b), me, '2026-10-12', { muted_kinds: [] }));
      expect(r1.data!.items.some((i) => i.kind === 'future')).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it('preferences: "future" can be muted (and is then never built), expiry still cannot; quiet hours and nudges off still refuse', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T05:00:00Z'));
    try {
      expect(DIGEST_KINDS).toContain('future');
      expect(MUTABLE_KINDS).toContain('future');
      const P = (patch = {}) => ({ enabled: true, frequency: 'monthly' as const, quiet_start: null, quiet_end: null, muted_kinds: [] as string[], ...patch });
      expect(checkPrefs(P({ muted_kinds: ['future', 'refresher'] }))).toBeNull();
      expect(checkPrefs(P({ muted_kinds: ['future', 'expiry'] }))).toBe(PREFS_MSG.expiry);
      const b = new LocalBackend(); await b.whenReady(); await b.reset();
      b.setPersona('k-ro'); await b.whenReady();
      expect((await b.rpc.setDigestPrefs(P({ muted_kinds: ['future'] }))).ok).toBe(true);
      const r = await b.rpc.buildDigest();
      expect(r.ok && r.data!.period === '2026-M10').toBe(true);
      expect(r.data!.items.some((i) => i.kind === 'future')).toBe(false);
      expect((await b.rpc.setDigestPrefs(P({ frequency: 'fortnightly', quiet_start: 9, quiet_end: 10 }))).ok).toBe(true);
      expect((await b.rpc.buildDigest()).code).toBe('quiet_hours');
      expect((await b.rpc.setDigestPrefs(P({ enabled: false, frequency: 'weekly' }))).ok).toBe(true);
      expect((await b.rpc.buildDigest()).code).toBe('nudges_off');
    } finally { vi.useRealTimers(); }
  });
  it('the local digest data carries the FS75 tables (skill_signals stays empty until FS70 is merged)', async () => {
    const b = new LocalBackend(); await b.whenReady();
    const d = localDigestData(b);
    for (const t of ['role_profile_versions', 'skill_goals', 'skill_goal_plans', 'pathways', 'ai_system_users', 'fellowship_milestones'] as const) expect((d[t] ?? []).length).toBeGreaterThan(0);
    expect(Array.isArray(d.skill_signals)).toBe(true);
  });
});

describe('FS75 acceptance: each new item has a deep link and a "why" in EN and AR', () => {
  const get = (o: unknown, path: string) => path.split('.').reduce<any>((x, k) => (x == null ? undefined : x[k]), o);
  const items: DigestItem[] = [];
  beforeEach(() => {
    if (items.length) return;
    for (const pid of staff) for (const day of [DAY, '2026-11-02']) items.push(...fsItems(gatherDigest(all(), pid, day)));
  });
  afterEach(() => undefined);
  it('AC3: every FS75 item links inside the app and has a title and reasons in both languages', () => {
    expect(items.length).toBeGreaterThan(100);
    for (const i of items) {
      expect(i.link).toMatch(/^\/[a-z]/);
      expect(i.link.startsWith('//')).toBe(false);
      expect(i.title_en.trim().length).toBeGreaterThan(3);
      expect(i.title_ar.trim().length).toBeGreaterThan(3);
      expect(i.why.length).toBeGreaterThan(0);
      for (const w of i.why) {
        expect(get(en, `why.${w.code}`), w.code).toBeTruthy();
        expect(get(ar, `why.${w.code}`), w.code).toBeTruthy();
      }
    }
  });
  it('AC3: every reason code and line of every topic exists in EN and AR (also the ones the seed does not reach yet)', () => {
    const codes = ['approval_fellowship', 'future_decay', 'future_decay_renew', 'future_goal_due', 'future_goal_overdue', 'future_goal_level', 'future_goal_undated', 'future_ai_required', 'future_ai_group',
      'future_profile_published', 'future_profile_changed', 'future_profile_gaps', 'future_profile_ready', 'future_rising', 'future_rising_family', 'future_rising_role', 'future_gig_goal', 'future_gig_profile',
      'future_gig_new', 'future_pathway_goal', 'future_pathway_profile', 'future_pathway_effort'];
    for (const c of codes) { expect(get(en, `why.${c}`)).toBeTruthy(); expect(get(ar, `why.${c}`)).toMatch(/[؀-ۿ]/); }
    for (const tp of [...new Set(Object.values(TOPIC_OF_TABLE))]) {
      const key = `line.future_${tp}`;
      expect(get(en, key), key).toBeTruthy();
      expect(get(ar, key), key).toBeTruthy();
    }
    for (const k of ['kind.future', 'kindHint.future', 'line.future_open', 'line.future_goal_open', 'future.title', 'future.how', 'future.intro', 'admin.futureRules']) {
      expect(get(en, k), k).toBeTruthy();
      expect(get(ar, k), k).toMatch(/[؀-ۿ]/);
    }
  });
});
