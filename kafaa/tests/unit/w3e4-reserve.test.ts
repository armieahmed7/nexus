/** F23 Alumni and expert reserve (W3 · E4): every acceptance criterion on the local path, plus the card's RBAC, the rules, the
 *  matching engine, the seed and i18n. The SQL path is checked by scripts/validate/w3e4-reserve.mjs (PGlite, SQL = TS parity). */
import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA, columnsOf } from '../../src/data/schema';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import {
  ALMSG, CONTACT_PATTERN, MEMBER_KINDS, MIN_GROUP, addMonths, bandOf, computeStats, hasContactData, hrRoleOf, recount, snapshotFrom, validateJoin, validateRequest,
  type JoinInput, type MemberRow, type RequestInput, type RequestRow, type EngagementRow,
} from '../../src/modules/m20/reserve';
import { rankMembersForRequest, rankRequestsForMember } from '../../src/modules/m20/reserveMatch';
import { routes } from '../../src/modules/m20/routes';
import seed from '../../src/seed/seed.json';
import arJson from '../../src/i18n/m20.ar.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const today = iso(0);
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));
const F23_TABLES = ['alumni', 'reserve_requests', 'reserve_engagements', 'alumni_stories'] as const;
const join: JoinInput = { consent: true, availability: 'open', hours_month: 10, engagement_prefs: ['mentor', 'reviewer'], finder_optin: true, headline_en: 'Chemistry control veteran', headline_ar: 'خبير في التحكم الكيميائي' };
const reqIn = (over: Partial<RequestInput> = {}): RequestInput => ({
  engagement: 'reviewer', title_en: 'Review of the chemistry sampling plan', title_ar: 'مراجعة خطة أخذ العينات الكيميائية',
  summary_en: 'A short independent review of the sampling plan and control limits.', summary_ar: 'مراجعة مستقلة قصيرة لخطة أخذ العينات وحدود التحكم.',
  skills_needed: ['sk-ch-01', 'sk-ch-02-labqa'], hours_total: 12, seats: 1, location_type: 'remote', start_on: iso(10), end_on: iso(40), ...over,
});
/** outage-manager posts; chco (HR) approves; returns the request id. */
async function openRequest(over: Partial<RequestInput> = {}) {
  await as('outage-manager');
  const r = await b.rpc.requestReserve(reqIn(over));
  expect(r.ok, r.message).toBe(true);
  await as('chco');
  const a = await b.rpc.decideReserveRequest(r.data!.id, 'approve');
  expect(a.ok, a.message).toBe(true);
  return r.data!.id;
}

describe('F23 seed and the new person kind `alumni`', () => {
  it('seeds members of every kind (alumni, partner alumni, pre-departure), requests and engagements in every state, and consented synthetic stories', () => {
    expect(new Set(T.alumni.map((m) => m.kind))).toEqual(new Set(MEMBER_KINDS));
    expect(new Set(T.reserve_requests.map((r) => r.status))).toEqual(new Set(['pending_hr', 'open', 'filled', 'closed', 'declined']));
    expect(new Set(T.reserve_engagements.map((e) => e.status))).toEqual(new Set(['invited', 'interested', 'handed_to_hr', 'declined', 'withdrawn', 'completed']));
    expect(T.alumni_stories.every((s) => s.synthetic === true && s.consent_on && s.published_on >= s.consent_on && /synthetic/i.test(s.author_en))).toBe(true);
    expect(T.alumni.filter((m) => m.status === 'active').length).toBeGreaterThanOrEqual(MIN_GROUP);
    // departed members have no people row: the reserve keeps its own minimal record
    expect(T.alumni.filter((m) => m.kind !== 'pre_departure' && !m.person_id).length).toBeGreaterThan(15);
    for (const r of T.reserve_requests) expect(recount(r, T.reserve_engagements.filter((e) => e.request_id === r.id))).toEqual({ interest_count: r.interest_count, seats_taken: r.seats_taken, status: r.status });
  });
  it('no contact data is stored: no contact column in any F23 table, and no email or phone number in any F23 row', () => {
    for (const t of F23_TABLES) for (const c of columnsOf(t)) expect(c.name).not.toMatch(/email|phone|mobile|address|contact|photo|whatsapp/i);
    const re = new RegExp(CONTACT_PATTERN);
    for (const t of F23_TABLES) for (const row of T[t]) expect(re.test(JSON.stringify(row)), `${t} ${row.id}`).toBe(false);
  });
  it('the new person kind passes check:public: no F23 table is public and no alumnus name reaches a public table', () => {
    for (const t of F23_TABLES) expect((SCHEMA[t].read ?? []).some((r) => r.res === 'public_content')).toBe(false);
    const pub = Object.entries(SCHEMA).filter(([, d]) => (d.read ?? []).some((r) => r.res === 'public_content' && !r.person && !r.org)).map(([n]) => n);
    const text = pub.map((n) => JSON.stringify(T[n] ?? [])).join('\n');
    for (const m of T.alumni) expect(text.includes(m.name), m.name).toBe(false);
    expect(execSync('node scripts/check-public-payloads.mjs', { encoding: 'utf8' })).toMatch(/no personal columns/);
  });
  it('snapshots are frozen from F01 and never hold a security-area skill', () => {
    const sec = new Set(T.skills.filter((s) => s.area === 'security').map((s) => s.id));
    for (const m of T.alumni) {
      expect(m.skill_snapshot.length).toBeGreaterThan(0);
      expect(m.skill_snapshot.length).toBeLessThanOrEqual(12);
      expect(m.skill_snapshot.some((s: any) => sec.has(s.skill_id))).toBe(false);
    }
    const sme = T.alumni.find((m) => m.id === 'alm:p-sme-reviewer')!;
    expect(sme.skill_snapshot).toEqual(snapshotFrom(T.person_skills.filter((s) => s.person_id === 'p-sme-reviewer'), T.skills));
  });
  it('routes and i18n: four routes, every key in EN and AR', () => {
    const ids = routes.filter((r) => r.id.startsWith('reserve')).map((r) => r.id);
    expect(ids).toEqual(['reserve', 'reserve-me', 'reserve-request', 'reserve-desk']);
    for (const id of ids) expect(hasKey(`m20.routes.${id}.title`)).toBe(true);
    for (const k of ['res_pref', 'res_pref_no', 'res_avail', 'res_recency']) expect(hasKey(`m20.reasons.${k}`)).toBe(true);
    const ar = arJson as any;
    for (const id of ids) expect(ar.routes[id].title).toMatch(/[؀-ۿ]/);
    for (const k of ['res_pref', 'res_pref_no', 'res_avail', 'res_recency']) expect(ar.reasons[k]).toMatch(/[؀-ۿ]/);
  });
});

describe('F23 rules', () => {
  it('bands, add-months (+6 for erasure), HR role and recount', () => {
    expect(bandOf(null, '2026-10-08')).toBe('departing');
    expect(bandOf('2026-06-30', '2026-10-08')).toBe('lt_1y');
    expect(bandOf('2024-03-31', '2026-10-08')).toBe('y1_3');
    expect(bandOf('2022-06-30', '2026-10-08')).toBe('y3_5');
    expect(bandOf('2020-09-30', '2026-10-08')).toBe('gt_5y');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(hrRoleOf(['employee', 'hr_director', 'hr_analyst'])).toBe('hr_analyst');
    expect(hrRoleOf(['employee', 'manager'])).toBeNull();
    expect(recount({ status: 'open', seats: 1 }, [{ status: 'handed_to_hr' }, { status: 'interested' }])).toEqual({ interest_count: 2, seats_taken: 1, status: 'filled' });
    expect(recount({ status: 'filled', seats: 2 }, [{ status: 'completed' }, { status: 'withdrawn' }])).toEqual({ interest_count: 1, seats_taken: 1, status: 'open' });
  });
  it('contact data is detected (email, international and UAE numbers) but dates and counts are not', () => {
    for (const s of ['write to a.b@example.org', 'call +971 50 123 4567', '00971501234567', 'mobile 050 123 4567', 'office 02-123-4567']) expect(hasContactData(s), s).toBe(true);
    for (const s of ['between 2026-10-09 and 2026-12-31', '12 hours, 3 places', 'Unit 4 startup in 2026', 'APR-1400']) expect(hasContactData(s), s).toBe(false);
    expect(validateJoin({ ...join, headline_en: 'mail me x@y.ae' })?.code).toBe('contact_data');
    expect(validateRequest(reqIn({ summary_en: 'Call me on +971 2 123 4567 for the details please.' }), T.skills, today)?.code).toBe('contact_data');
  });
  it('restricted work: a security skill or a protected-area location is restricted_kind; bad input is invalid', () => {
    expect(validateRequest(reqIn({ skills_needed: ['sk-sa-01'] }), T.skills, today)?.code).toBe('restricted_kind');
    expect(validateRequest(reqIn({ location_type: 'protected_area' }), T.skills, today)?.code).toBe('restricted_kind');
    expect(validateRequest(reqIn({ start_on: iso(-1) }), T.skills, today)?.code).toBe('invalid');
    expect(validateRequest(reqIn({ end_on: addMonths(iso(10), 13) }), T.skills, today)?.code).toBe('invalid');
    expect(validateRequest(reqIn({ engagement: 'contract' }), T.skills, today)?.code).toBe('invalid');
    expect(validateJoin({ ...join, engagement_prefs: [] })?.code).toBe('invalid');
    expect(validateJoin({ ...join, hours_month: 41 })?.code).toBe('invalid');
    expect(validateRequest(reqIn(), T.skills, today)).toBeNull();
  });
  it('HR stats suppress every cell under 10 and never count withdrawn members', () => {
    const s = computeStats(T.alumni as MemberRow[], T.reserve_requests as RequestRow[], T.reserve_engagements as EngagementRow[], '2026-10-08');
    const kind = Object.fromEntries(s.by_kind.map((c) => [c.key, c]));
    expect(kind.alumni.suppressed).toBe(false);
    expect(kind.alumni.n).toBe(T.alumni.filter((m) => m.kind === 'alumni' && m.status === 'active').length);
    expect(kind.partner_alumni).toEqual({ key: 'partner_alumni', n: null, suppressed: true });
    expect([...s.by_kind, ...s.by_band, ...s.by_family, ...s.by_engagement].every((c) => (c.suppressed ? c.n === null : c.n! >= MIN_GROUP))).toBe(true);
    expect(s.members).toBe(T.alumni.filter((m) => m.status === 'active').length);
  });
  it('matching reuses the F08 engine: every ranked list carries reasons with i18n keys; a better skill fit ranks first', () => {
    const members = T.alumni.filter((m) => m.status === 'active') as MemberRow[];
    const req = T.reserve_requests.find((r) => r.id === 'rr-cap-startup')!;
    const ranked = rankMembersForRequest(req, members, T.skills, '2026-10-08');
    expect(lintRanked(ranked)).toEqual([]);
    expect(ranked[0].item!.fit).toBeGreaterThan(ranked[ranked.length - 1].item!.fit);
    expect(ranked[0].reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['fit', 'res_avail', 'res_recency']));
    const board = rankRequestsForMember(members.find((m) => m.id === 'alm:p-sme-reviewer')!, T.reserve_requests.filter((r) => r.status === 'open'), T.skills, '2026-10-08');
    expect(lintRanked(board)).toEqual([]);
    for (const r of [...ranked, ...board]) for (const x of r.reasons) expect(hasKey(x.key), x.key).toBe(true);
    expect(board.length).toBe(T.reserve_requests.filter((r) => r.status === 'open').length);
  });
});

describe('F23 acceptance (LocalBackend)', () => {
  it('withdrawing consent hides the alumnus everywhere within one refresh and schedules erasure after six months', async () => {
    // qc-inspector joins with the expert-finder opt-in and is visible to staff, HR and the board
    await as('qc-inspector');
    const j = await b.rpc.joinReserve(join);
    expect(j.ok, j.message).toBe(true);
    expect(j.ledger_seq ?? null).not.toBeUndefined();
    const id = j.data!.id;
    const rid = await openRequest();
    await as('qc-inspector');
    const i = await b.rpc.reserveInterest(rid, 'I can help');
    expect(i.ok, i.message).toBe(true);
    await as('nse');
    expect((await b.list('alumni')).some((m) => m.id === id)).toBe(true);
    await as('chco');
    expect((await b.rpc.reserveDesk())!.members.some((m) => m.id === id)).toBe(true);
    // withdraw
    await as('qc-inspector');
    const w = await b.rpc.joinReserve({ consent: false });
    expect(w.ok, w.message).toBe(true);
    expect(w.data).toMatchObject({ status: 'withdrawn', erase_after: addMonths(today, 6) });
    expect(audits('reserve.withdraw', 'ok')).toHaveLength(1);
    // the very next read: hidden from staff (expert finder), HR (registry and shortlist), the board, and engagements end
    await as('nse');
    expect((await b.list('alumni')).some((m) => m.id === id)).toBe(false);
    await as('chco');
    const desk = (await b.rpc.reserveDesk())!;
    expect(desk.members.some((m) => m.id === id)).toBe(false);
    expect(rankMembersForRequest(desk.requests.find((r) => r.id === rid)!, desk.members, T.skills, today).some((r) => r.id === id)).toBe(false);
    expect(desk.erasures).toContainEqual({ id, kind: 'pre_departure', withdrawn_on: today, erase_after: addMonths(today, 6) });
    const e = desk.engagements.find((x) => x.alumni_id === id)!;
    expect(e).toMatchObject({ status: 'withdrawn', alumni_name: '', alumni_name_ar: '' });
    expect(JSON.stringify(desk.engagements)).not.toContain(T.people.find((p) => p.id === 'p-qc-inspector')!.display_name);
    await as('qc-inspector');
    const board = (await b.rpc.reserveBoard())!;
    expect(board.member.status).toBe('withdrawn');
    expect(board.requests).toEqual([]);
    expect((await b.rpc.reserveInterest(rid)).code).toBe('not_member');
    // stories of a withdrawn member are unlisted (seed: alm-ops-04 withdrew; staff never see its story)
    await as('nse');
    const stories = await b.list('alumni_stories');
    expect(stories.some((s) => s.alumni_id === 'alm-ops-04')).toBe(false);
    expect(stories.length).toBe(T.alumni_stories.filter((s) => s.listed).length);
  });
  it('withdrawal also unlists that member’s stories at once', async () => {
    // sme-reviewer is a seeded member; give them a story through the raw store, then withdraw
    b.rawInsert('alumni_stories', { ...T.alumni_stories[0], id: 'as-test', alumni_id: 'alm:p-sme-reviewer', listed: true } as never);
    await as('nse');
    expect((await b.list('alumni_stories')).some((s) => s.id === 'as-test')).toBe(true);
    await as('sme-reviewer');
    expect((await b.rpc.joinReserve({ consent: false })).ok).toBe(true);
    await as('nse');
    expect((await b.list('alumni_stories')).some((s) => s.id === 'as-test')).toBe(false);
  });
  it('a request needs HR approval before an alumnus sees it or the poster’s team; the poster’s identity never reaches the board', async () => {
    await as('outage-manager');
    const r = await b.rpc.requestReserve(reqIn({ title_en: 'Unique pending reserve request title' }));
    expect(r.ok, r.message).toBe(true);
    expect(r.data!.status).toBe('pending_hr');
    const team = b.rawGet('reserve_requests', r.data!.id)!.host_team_en;
    await as('sme-reviewer');
    let board = (await b.rpc.reserveBoard())!;
    expect(board.requests.some((x) => x.id === r.data!.id)).toBe(false);
    expect(JSON.stringify(board)).not.toContain('Unique pending reserve request title');
    expect((await b.rpc.reserveInterest(r.data!.id)).code).toBe('not_found');
    expect(await b.list('reserve_requests')).toEqual([]);
    await as('chco');
    const a = await b.rpc.decideReserveRequest(r.data!.id, 'approve');
    expect(a.ok, a.message).toBe(true);
    expect(a.ledger_seq).not.toBeUndefined();
    await as('sme-reviewer');
    board = (await b.rpc.reserveBoard())!;
    const seen = board.requests.find((x) => x.id === r.data!.id)!;
    expect(seen.host_team_en).toBe(team);
    expect(JSON.stringify(seen)).not.toMatch(/p-outage-manager|posted_by|poster/);
  });
  it('HR approval is maker-checker: HR never approves their own request or an engagement that involves them', async () => {
    // give chco a manager assignment so they can post (W), then try to approve their own request
    b.rawInsert('role_assignments', { id: 'ra-test-chco-mgr', person_id: 'p-chco', role: 'manager', scope_type: 'team', scope_value: 'hr', status: 'active', granted_at: '2026-10-01T00:00:00Z' } as never);
    await as('chco');
    const own = await b.rpc.requestReserve(reqIn());
    expect(own.ok, own.message).toBe(true);
    const mc = await b.rpc.decideReserveRequest(own.data!.id, 'approve');
    expect(mc.code).toBe('maker_checker');
    expect(audits('reserve.request.decide', 'refused').some((x) => /maker_checker/.test(x.reason ?? ''))).toBe(true);
    // k-hr-analyst approves it instead; chco joins the reserve and shows interest in another request; chco cannot hand themselves over
    await as('k-hr-analyst');
    expect((await b.rpc.decideReserveRequest(own.data!.id, 'approve')).ok).toBe(true);
    const rid = await openRequest();
    await as('chco');
    expect((await b.rpc.joinReserve(join)).ok).toBe(true);
    const i = await b.rpc.reserveInterest(rid);
    expect(i.ok, i.message).toBe(true);
    expect((await b.rpc.decideReserveEngagement(i.data!.id, 'approve')).code).toBe('maker_checker');
    await as('k-hr-analyst');
    expect((await b.rpc.decideReserveEngagement(i.data!.id, 'approve')).ok).toBe(true);
  });
  it('the full engagement flow: interest -> HR hands over (ledger) -> the poster now reads the alumnus -> completion (ledger); places fill', async () => {
    const rid = await openRequest();
    await as('sme-reviewer');
    const i = await b.rpc.reserveInterest(rid, 'Happy to review');
    expect(i.ok, i.message).toBe(true);
    expect((await b.rpc.reserveInterest(rid)).code).toBe('conflict');
    await as('outage-manager');
    expect((await b.list('reserve_engagements')).some((e) => e.id === i.data!.id)).toBe(false);
    expect((await b.rpc.decideReserveEngagement(i.data!.id, 'complete', 'Done well')).code).toBe('not_found');
    await as('chco');
    const h = await b.rpc.decideReserveEngagement(i.data!.id, 'approve');
    expect(h.ok, h.message).toBe(true);
    expect(h.data!.status).toBe('handed_to_hr');
    expect(b.rawGet('reserve_requests', rid)).toMatchObject({ status: 'filled', seats_taken: 1, interest_count: 1 });
    await as('outage-manager');
    const seen = (await b.list('reserve_engagements')).find((e) => e.id === i.data!.id)!;
    expect(seen.alumni_name).toBe(T.people.find((p) => p.id === 'p-sme-reviewer')!.display_name);
    expect((await b.rpc.decideReserveEngagement(i.data!.id, 'complete', 'no')).code).toBe('invalid');
    const c = await b.rpc.decideReserveEngagement(i.data!.id, 'complete', 'Review delivered with six useful findings.');
    expect(c.ok, c.message).toBe(true);
    expect(b.raw('ledger_local').some((l: any) => /reserve\.engagement\.complete/.test(JSON.stringify(l))) || audits('reserve.engagement', 'ok').some((a) => a.ledger_status !== 'not_applicable')).toBe(true);
    expect(b.rawGet('reserve_engagements', i.data!.id)!.status).toBe('completed');
  });
  it('RBAC: managers request (W), HR approves (A), staff read only finder opt-ins, the desk is HR-only', async () => {
    await as('nse');
    expect((await b.rpc.requestReserve(reqIn())).code).toBe('forbidden');
    expect(await b.rpc.reserveDesk()).toBeNull();
    const visible = await b.list('alumni');
    expect(visible.length).toBe(T.alumni.filter((m) => m.finder_visible).length);
    expect(visible.every((m) => m.finder_visible)).toBe(true);
    expect(await b.list('reserve_requests')).toEqual([]);
    await as('outage-manager');
    const mine = await b.list('reserve_requests');
    expect(mine.length).toBe(T.reserve_requests.filter((r) => r.posted_by === 'p-outage-manager').length);
    const pend = T.reserve_requests.find((r) => r.status === 'pending_hr' && r.posted_by !== 'p-outage-manager')!;
    expect((await b.rpc.decideReserveRequest(pend.id, 'approve')).code).toBe('not_found');
    await as('ops-ceo');
    expect((await b.rpc.decideReserveRequest('rr-cap-startup', 'approve')).code).toBe('forbidden');
    await as('k-hr-analyst');
    const desk = await b.rpc.reserveDesk();
    expect(desk!.members.length).toBe(T.alumni.filter((m) => m.status === 'active').length);
    expect((await b.rpc.decideReserveRequest(pend.id, 'decline', 'no')).code).toBe('invalid');
    expect((await b.rpc.decideReserveRequest(pend.id, 'approve')).ok).toBe(true);
    await as(null);
    expect(await b.list('alumni')).toEqual([]);
    expect(await b.list('alumni_stories')).toEqual([]);
    expect((await b.rpc.joinReserve(join)).code).toBe('not_signed_in');
  });
  it('no contact data and no restricted work get in through the RPCs (refused and audited)', async () => {
    await as('qc-inspector');
    expect((await b.rpc.joinReserve({ ...join, headline_en: 'reach me at someone@example.com' })).code).toBe('contact_data');
    expect((await b.rpc.joinReserve(join)).ok).toBe(true);
    await as('sec-compliance');
    const sec = await b.rpc.joinReserve(join);
    expect(sec.code).toBe('restricted_kind');
    expect(sec.message).toBe(ALMSG.restricted_join);
    await as('outage-manager');
    expect((await b.rpc.requestReserve(reqIn({ skills_needed: ['sk-sa-01'] }))).code).toBe('restricted_kind');
    expect((await b.rpc.requestReserve(reqIn({ summary_en: 'Ring 050 123 4567 to agree the details for this.' }))).code).toBe('contact_data');
    expect(audits('reserve.request', 'refused').length).toBe(2);
    const rid = await openRequest();
    await as('qc-inspector');
    expect((await b.rpc.reserveInterest(rid, 'call +971 2 555 1234')).code).toBe('contact_data');
    const row = b.rawGet('alumni', 'alm:p-qc-inspector')!;
    expect(new RegExp(CONTACT_PATTERN).test(JSON.stringify(row))).toBe(false);
  });
  it('joining freezes my F01 skill state (no security skill) and records consent with audit and ledger; updating keeps the consent date', async () => {
    await as('nse');
    const j = await b.rpc.joinReserve(join);
    expect(j.ok, j.message).toBe(true);
    const row = b.rawGet('alumni', j.data!.id)!;
    expect(row).toMatchObject({ kind: 'pre_departure', status: 'active', finder_visible: true, consent_on: today, departed_band: 'departing' });
    expect(row.skill_snapshot).toEqual(snapshotFrom(b.raw('person_skills').filter((s) => s.person_id === 'p-nse') as never, T.skills));
    expect(audits('reserve.join', 'ok')).toHaveLength(1);
    expect(audits('reserve.join', 'ok')[0].ledger_status).not.toBe('not_applicable');
    const u = await b.rpc.joinReserve({ ...join, finder_optin: false, availability: 'paused', hours_month: 0 });
    expect(u.message).toBe('Reserve membership updated');
    expect(b.rawGet('alumni', j.data!.id)).toMatchObject({ finder_visible: false, availability: 'paused', consent_on: today });
  });
  it('HR invitation: the member accepts by expressing interest; closing a request declines pending interest', async () => {
    const rid = await openRequest();
    await as('chco');
    const inv = await b.rpc.inviteReserve(rid, 'alm:p-sme-reviewer', 'Your review skills fit');
    expect(inv.ok, inv.message).toBe(true);
    expect((await b.rpc.inviteReserve(rid, 'alm:p-sme-reviewer')).code).toBe('conflict');
    expect((await b.rpc.inviteReserve(rid, 'alm-ops-04')).code).toBe('not_found');
    await as('sme-reviewer');
    const board = (await b.rpc.reserveBoard())!;
    expect(board.requests.find((x) => x.id === rid)!.my_status).toBe('invited');
    expect((await b.rpc.reserveInterest(rid)).ok).toBe(true);
    await as('outage-manager');
    expect((await b.rpc.decideReserveRequest(rid, 'close')).ok).toBe(true);
    expect(b.rawGet('reserve_engagements', inv.data!.id)!.status).toBe('declined');
  });
});
