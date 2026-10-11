/** F30 Learning record store (W4 · E4, M27): every acceptance criterion on the local path, the pure profile and emitter rules
 *  shared with SQL, the seed and i18n. The SQL path is checked by scripts/validate/w4e4-lrs.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m27.en.json';
import ar from '../../src/i18n/m27.ar.json';
import { routes } from '../../src/modules/m27/routes';
import {
  ACTIVITY_TYPE_IRI, EMITTERS, EXT, OBJECT_TYPES, SOURCES, VERBS, VERB_IRI, XAPI_HOME, activityIri, backfill, containsId, draftFor, isoTs, lookupsFrom, lrsAggregateOf, md5,
  refresherRef, schemaErrorMessage, summarise, toJsonLines, toXapi, validateStatement, xapiId, type StatementRow,
} from '../../src/modules/m27/xapi';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const SECURE = T.items.filter((i) => i.bank === 'secure').map((i) => i.id as string);
const PEOPLE = new Set(T.people.map((p) => p.id as string));
const ENV = { isPerson: (id: string) => PEOPLE.has(id), secureItemIds: SECURE, now: new Date('2026-10-09T08:00:00Z') };
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
const stmts = () => b.raw('xapi_statements') as unknown as StatementRow[];
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => Number(x.seq) - Number(y.seq)).pop()!;
const crewOf = (id: string) => T.people.find((p) => p.id === id)?.crew;

const valid = (me = 'p-k-admin'): Record<string, any> => ({
  actor: { objectType: 'Agent', account: { homePage: XAPI_HOME, name: me } },
  verb: { id: VERB_IRI.completed, display: { 'en-US': 'completed' } },
  object: { objectType: 'Activity', id: activityIri('course', 'c-get'), definition: { name: { 'en-US': 'General Employee Training', 'ar-AE': 'التدريب العام للموظفين' }, type: ACTIVITY_TYPE_IRI.course } },
  result: { completion: true, success: true, score: { scaled: 0.9, raw: 90, min: 0, max: 100 }, duration: 'PT2H' },
  context: { language: 'en', extensions: { [`${EXT}note`]: 'unit test' } },
  timestamp: '2026-10-01T09:00:00Z',
  version: '2.0.0',
});
const codes = (s: unknown) => validateStatement(s, ENV).errors.map((e) => e.code);

describe('F30 schema, routes and i18n', () => {
  it('xapi_statements is append-only and read through the lrs resource by actor', () => {
    const t = SCHEMA.xapi_statements;
    expect(t.write.mode).toBe('append');
    expect(t.read).toEqual([{ res: 'lrs', person: 'actor_person_id' }]);
    expect(Object.keys(t.cols)).toEqual(expect.arrayContaining(['id', 'actor_person_id', 'verb', 'object_type', 'object_id', 'result', 'context', 'stored_at', 'occurred_at']));
    expect(Object.keys(t.cols)).not.toEqual(expect.arrayContaining(['mbox']));
  });
  it('routes are guarded by the lrs grants of the card and every route has EN and AR text', () => {
    const byId = Object.fromEntries(routes.map((r) => [r.id, r]));
    expect(byId['my-learning-record'].guard).toMatchObject({ grant: { res: 'lrs', levels: ['Own'] } });
    expect(byId['training-lrs'].guard).toMatchObject({ grant: { res: 'lrs', levels: ['Scope', 'Agg', 'R'] } });
    expect(byId['training-lrs-person'].guard).toMatchObject({ grant: { res: 'lrs', levels: ['Scope', 'R'] } });
    expect(byId['training-lrs-console'].guard).toMatchObject({ grant: { res: 'integrations', levels: ['A'] } });
    for (const r of routes) for (const j of [en, ar] as any[]) { expect(j.routes[r.id]?.title).toBeTruthy(); expect(j.routes[r.id]?.purpose).toBeTruthy(); }
    const flat = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(flat(ar).sort()).toEqual(flat(en).sort());
    for (const v of VERBS) expect((en as any).verb[v] && (ar as any).verb[v]).toBeTruthy();
    for (const o of OBJECT_TYPES) expect((ar as any).type[o]).toBeTruthy();
    for (const s of SOURCES) expect((ar as any).source[s] && (ar as any).reasons.src[s] && (ar as any).emit.event[s]).toBeTruthy();
  });
});

describe('F30 profile (validateStatement = kafaa_xapi_validate)', () => {
  it('accepts a valid xAPI 2.0 statement and maps it to columns', () => {
    const r = validateStatement(valid(), ENV);
    expect(r.errors).toEqual([]);
    expect(r.mapped).toMatchObject({ actor_person_id: 'p-k-admin', verb: 'completed', object_type: 'course', object_id: 'c-get', object_name: { en: 'General Employee Training' }, occurred_at: '2026-10-01T09:00:00Z' });
  });
  it('refuses email-style actors, names, unknown people and foreign accounts', () => {
    expect(codes({ ...valid(), actor: { mbox: 'mailto:x@example.com' } })).toEqual(expect.arrayContaining(['mbox_not_allowed', 'account_required']));
    expect(codes({ ...valid(), actor: { name: 'A person', account: { homePage: XAPI_HOME, name: 'p-k-admin' } } })).toEqual(['name_not_allowed']);
    expect(codes(valid('nobody'))).toEqual(['unknown_person']);
    expect(codes({ ...valid(), actor: { account: { homePage: 'https://elsewhere.example', name: 'p-k-admin' } } })).toEqual(['account_home']);
  });
  it('refuses unknown verbs, foreign activity IRIs, item activities, responses, bad scores, durations, timestamps and LRS fields', () => {
    expect(codes({ ...valid(), verb: { id: 'http://adlnet.gov/expapi/verbs/liked' } })).toEqual(['verb_unknown']);
    expect(codes({ ...valid(), object: { id: 'urn:course:c-get' } })).toEqual(['object_iri']);
    expect(codes({ ...valid(), object: { id: activityIri('item', 'q1') } })).toEqual(['object_kind']);
    expect(codes({ ...valid(), result: { response: 'B' } })).toEqual(['response_not_allowed']);
    expect(codes({ ...valid(), result: { score: { scaled: 1.5 } } })).toEqual(['score_range']);
    expect(codes({ ...valid(), result: { score: { raw: 120, min: 0, max: 100 } } })).toEqual(['score_range']);
    expect(codes({ ...valid(), result: { duration: 'two hours' } })).toEqual(['duration_format']);
    expect(codes({ ...valid(), timestamp: '2031-01-01T00:00:00Z' })).toEqual(['timestamp_future']);
    expect(codes({ ...valid(), timestamp: 'yesterday' })).toEqual(['timestamp_format']);
    expect(codes({ ...valid(), stored: '2026-10-01T09:00:00Z' })).toEqual(['lrs_field']);
    expect(codes({ ...valid(), context: { instructor: { name: 'x' } } })).toEqual(['unknown_field']);
    expect(codes('x')).toEqual(['not_object']);
    expect(codes({ ...valid(), context: { extensions: { [`${EXT}big`]: 'x'.repeat(9000) } } })).toEqual(['too_large']);
  });
  it('refuses any secure assessment item id, as the object or anywhere in the text', () => {
    expect(codes({ ...valid(), object: { id: activityIri('course', SECURE[0]) } })).toEqual(['secure_content']);
    expect(codes({ ...valid(), context: { extensions: { [`${EXT}note`]: `see ${SECURE[1]}` } } })).toEqual(['secure_content']);
    expect(containsId(`x ${SECURE[0]}-b`, SECURE[0])).toBe(false);
    expect(schemaErrorMessage([{ path: 'verb.id', code: 'verb_unknown' }, { path: 'actor.mbox', code: 'mbox_not_allowed' }])).toBe("Statement does not match the Kafa'a xAPI 2.0 profile (2 error(s)): actor.mbox: mbox_not_allowed; verb.id: verb_unknown");
  });
});

describe('F30 deterministic ids and seeded statements (TS emitters = SQL emitters)', () => {
  it('md5 matches node crypto, ids are UUID-shaped and stable', () => {
    for (const s of ['', 'abc', 'm04_course:tr-1', 'إرشاد مهني', 'x'.repeat(200)]) expect(md5(s)).toBe(createHash('md5').update(s, 'utf8').digest('hex'));
    expect(xapiId('m04_course', 'tr-1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(xapiId('m04_course', 'tr-1')).toBe(xapiId('m04_course', 'tr-1'));
  });
  it('the seed holds exactly the statements the emitters produce for the seeded records, from every live emitter', () => {
    const rebuilt = backfill(T);
    const seeded = [...T.xapi_statements].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(seeded));
    const live = EMITTERS.filter((e) => e.status === 'live').map((e) => e.source);
    for (const s of live) expect(seeded.some((r) => r.source === s)).toBe(true);
    expect(seeded.every((r) => r.stored_by === null && r.version === '2.0.0' && r.stored_at === r.occurred_at)).toBe(true);
    expect(seeded.length).toBeGreaterThan(1500);
  });
  it('security-restricted JPMs emit nothing; refresher statements use the competency, never the item', () => {
    const L = lookupsFrom(T);
    const std = T.qual_standards.find((q) => q.security_restricted);
    const jpm = { ...T.jpms[0], id: 'jpm-x', standard_id: std.id };
    const L2 = { ...L, jpm: (id: string) => (id === 'jpm-x' ? jpm : L.jpm(id)) };
    expect(draftFor('m05_jpm', { id: 'jr-x', jpm_id: 'jpm-x', person_id: 'p-k-ro', date: '2026-10-01', score_pct: 100, result: 'pass' }, L2)).toBeNull();
    const rs = T.refresh_state[0];
    const d = draftFor('f14_refresher', rs, L)!;
    expect(d.object_type).toBe('refresher');
    expect(d.object_id).toBe(rs.competency_id);
    expect(d.source_ref).toBe(refresherRef(rs.id, rs.attempts));
    expect(JSON.stringify(d)).not.toContain(rs.item_id);
  });
});

describe('F30 acceptance: invalid statements are refused with a schema error; statements are immutable', () => {
  it('storeStatement refuses an invalid statement with schema_error and audits the refusal', async () => {
    await as('k-admin');
    const n = stmts().length;
    const r = await b.rpc.storeStatement({ ...valid(), actor: { mbox: 'mailto:x@example.com' } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('schema_error');
    expect(r.message).toMatch(/mbox_not_allowed/);
    expect(lastAudit()).toMatchObject({ action: 'lrs.store', outcome: 'refused' });
    expect(stmts().length).toBe(n);
  });
  it('a valid console statement is stored about the caller only; refusals for others, duplicates and non-admins', async () => {
    await as('k-admin');
    const ok = await b.rpc.storeStatement(valid());
    expect(ok.ok).toBe(true);
    const row = stmts().find((s) => s.id === ok.data!.id)!;
    expect(row).toMatchObject({ source: 'console', stored_by: 'p-k-admin', actor_person_id: 'p-k-admin', verb: 'completed', object_type: 'course' });
    expect(lastAudit()).toMatchObject({ action: 'lrs.store', outcome: 'ok', ledger_status: 'not_applicable' });
    expect((await b.rpc.storeStatement(valid('w-ro-01'))).code).toBe('not_self');
    expect((await b.rpc.storeStatement({ ...valid(), id: ok.data!.id })).code).toBe('conflict');
    await as('sro');
    expect((await b.rpc.storeStatement(valid('p-sro'))).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.storeStatement(valid())).code).toBe('not_signed_in');
  });
  it('statements cannot be updated or inserted directly, by anyone', async () => {
    await as('k-auditor');
    const id = stmts()[0].id;
    const u = await b.update('xapi_statements', id, { verb: 'passed' } as never);
    expect(u.ok).toBe(false);
    expect(u.message).toMatch(/append-only/);
    await as('k-admin');
    const i = await b.insert('xapi_statements', { id: 'x', actor_person_id: 'p-k-admin', verb: 'completed', object_type: 'course', object_id: 'c-get', occurred_at: '2026-10-01T09:00:00Z', source: 'console', source_ref: 'x' } as never);
    expect(i.ok).toBe(false);
  });
});

describe('F30 acceptance: completing a course in M04 emits exactly one completed statement', () => {
  it('training manager records a completion: one completed statement; a repeat completion is refused and emits nothing', async () => {
    const e = T.enrolments.find((x) => ['enrolled', 'in_progress'].includes(x.status) && x.person_id !== 'p-training-mgr' && (() => {
      const c = T.courses.find((k) => k.id === x.course_id);
      const s = x.session_id ? T.sessions.find((k) => k.id === x.session_id) : null;
      return c && !c.qualifying && c.pass_mark == null && (!x.session_id || s?.kind === 'elearning' || x.attendance === 'present');
    })());
    expect(e).toBeTruthy();
    await as('training-mgr');
    const before = stmts().filter((s) => s.actor_person_id === e.person_id).length;
    const r = await b.rpc.completeEnrolment(e.id, 'completed', null, 'LRS unit test');
    expect(r.ok).toBe(true);
    const mine = stmts().filter((s) => s.actor_person_id === e.person_id);
    expect(mine.length).toBe(before + 1);
    const st = mine.filter((s) => s.source === 'm04_course' && s.source_ref === r.data!.record_id);
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ verb: 'completed', object_type: 'course', object_id: e.course_id, stored_by: null });
    expect(st[0].id).toBe(xapiId('m04_course', r.data!.record_id!));
    const again = await b.rpc.completeEnrolment(e.id, 'completed', null, 'again');
    expect(again.ok).toBe(false);
    expect(stmts().filter((s) => s.actor_person_id === e.person_id).length).toBe(before + 1);
  });
});

describe('F30 acceptance: a manager cannot query statements of people outside scope', () => {
  it('sro (crew B) is refused a crew A person (audited), reads a crew B person, and gets only crew B without a filter', async () => {
    const crewA = T.xapi_statements.find((s) => crewOf(s.actor_person_id) === 'A')!.actor_person_id;
    const crewB = T.xapi_statements.find((s) => crewOf(s.actor_person_id) === 'B' && s.actor_person_id !== 'p-sro')!.actor_person_id;
    await as('sro');
    const out = await b.rpc.queryStatements({ actor: crewA });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('not_in_scope');
    expect(lastAudit()).toMatchObject({ action: 'lrs.query', outcome: 'refused', entity_id: crewA });
    const inn = await b.rpc.queryStatements({ actor: crewB, limit: 1000 });
    expect(inn.ok).toBe(true);
    expect(inn.data!.rows.length).toBeGreaterThan(0);
    expect(inn.data!.rows.every((r) => r.actor_person_id === crewB)).toBe(true);
    expect(inn.audit_seq).not.toBeNull();
    const all = await b.rpc.queryStatements({ limit: 1000 });
    expect(all.data!.scope).toBe('scope');
    expect(all.data!.rows.every((r) => r.actor_person_id === 'p-sro' || crewOf(r.actor_person_id) === 'B')).toBe(true);
    const direct = (await b.list('xapi_statements', {})) as unknown as StatementRow[];
    expect(direct.every((r) => r.actor_person_id === 'p-sro' || crewOf(r.actor_person_id) === 'B')).toBe(true);
  });
  it('people read their own record without an audit row; auditors read all; partners and unknown filters are refused', async () => {
    await as('k-ro');
    const own = await b.rpc.queryStatements();
    expect(own.ok && own.data!.scope).toBe('own');
    expect(own.data!.rows.every((r) => r.actor_person_id === 'p-k-ro')).toBe(true);
    expect(own.audit_seq).toBeNull();
    expect((await b.rpc.queryStatements({ actor: 'p-sro' })).code).toBe('not_in_scope');
    await as('k-auditor');
    const aud = await b.rpc.queryStatements({ limit: 1 });
    expect(aud.data!.scope).toBe('all');
    expect(aud.data!.total).toBe(stmts().length);
    await as('alnoor-gm');
    expect((await b.rpc.queryStatements()).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.queryStatements({ verb: 'liked' as never })).code).toBe('invalid');
  });
});

describe('F30 acceptance: no secure item id or text appears in any statement (unit test over the emitters)', () => {
  it('after exercising the emitters (course, refresher, JPM, opportunity, rotation, shadowing, mentoring, knowledge) no statement carries secure content', async () => {
    await as('sro');
    const item = T.items.find((i) => i.bank === 'practice' && i.is_practice && i.status === 'approved' && i.competency_id);
    const ver = T.item_versions.find((v) => v.item_id === item.id && v.version === item.current_version);
    const n0 = stmts().length;
    expect((await b.rpc.submitRefresher([{ item_id: item.id, answer: ver.answer }])).ok).toBe(true);
    expect((await b.rpc.submitRefresher([{ item_id: item.id, answer: ver.answer }])).ok).toBe(true);
    const ans = stmts().slice(n0);
    expect(ans).toHaveLength(2);
    expect(ans.every((s) => s.verb === 'answered' && s.object_id === item.competency_id && !JSON.stringify(s).includes(item.id))).toBe(true);
    await as('k-instructor');
    const j = await b.rpc.recordJpm('jpm-qs-lo-turbine-t2', 'p-k-lo-trainee', [1, 2, 3, 4, 5].map((n) => ({ n, result: 'pass' as const })));
    expect(j.ok).toBe(true);
    expect(stmts().filter((s) => s.source === 'm05_jpm' && s.source_ref === j.data!.id)).toHaveLength(1);
    // status transitions emit once (the same AFTER-UPDATE rule as the SQL triggers)
    const oa = T.opportunity_applications.find((a) => a.status === 'selected');
    b.rawUpdate('opportunity_applications', oa.id, { status: 'completed', completed_at: '2026-10-08T10:00:00Z' } as never);
    b.rawUpdate('opportunity_applications', oa.id, { outcome_note: 'touched again' } as never);
    expect(stmts().filter((s) => s.source === 'f08_opportunity' && s.source_ref === oa.id)).toHaveLength(1);
    const rp = T.rotation_placements.find((p) => p.status === 'active');
    b.rawUpdate('rotation_placements', rp.id, { status: 'signed_off', signed_off_at: '2026-10-08T10:00:00Z' } as never);
    expect(stmts().filter((s) => s.source === 'f15_rotation' && s.source_ref === rp.id)).toHaveLength(1);
    const sh = T.shadow_requests.find((p) => p.status === 'approved');
    b.rawUpdate('shadow_requests', sh.id, { status: 'completed', completed_at: '2026-10-08T10:00:00Z' } as never);
    expect(stmts().filter((s) => s.source === 'f15_shadowing' && s.source_ref === sh.id)).toHaveLength(1);
    b.rawInsert('mentoring_sessions', { id: 'ms-lrs-test', agreement_id: T.mentoring_agreements[0].id, person_id: T.mentoring_agreements[0].person_id, mentor_person_id: T.mentoring_agreements[0].mentor_person_id, held_on: '2026-10-08', minutes: 30, logged_by: T.mentoring_agreements[0].person_id } as never);
    b.rawInsert('asset_uses', { id: 'au:lrs-test', asset_id: T.knowledge_assets[0].id, person_id: 'p-k-ro', used_on: '2026-10-08' } as never);
    expect(stmts().filter((s) => s.source_ref === 'ms-lrs-test' || s.source_ref === 'au:lrs-test')).toHaveLength(2);
    const stems = T.item_versions.filter((v) => SECURE.includes(v.item_id)).map((v) => String(v.stem_en).slice(0, 40));
    const texts = stmts().map((s) => JSON.stringify(s));
    expect(texts.every((x) => !SECURE.some((id) => containsId(x, id)) && !stems.some((st) => x.includes(st)))).toBe(true);
  });
});

describe('F30 own data right, analytics and reading helpers', () => {
  it('exportStatements returns my statements only (audited, no ledger) and toJsonLines gives one xAPI statement per line', async () => {
    await as('k-ro');
    const r = await b.rpc.exportStatements();
    expect(r.ok).toBe(true);
    expect(r.data!.rows.length).toBe(stmts().filter((s) => s.actor_person_id === 'p-k-ro').length);
    expect(lastAudit()).toMatchObject({ action: 'lrs.export', outcome: 'ok', ledger_status: 'not_applicable' });
    const lines = toJsonLines(r.data!.rows).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(r.data!.rows.length);
    for (const x of lines) {
      expect(x.actor).toEqual({ objectType: 'Agent', account: { homePage: XAPI_HOME, name: 'p-k-ro' } });
      expect(JSON.stringify(x)).not.toMatch(/mbox|mailto:/);
      const { stored, authority, ...sent } = x;
      expect(stored && authority).toBeTruthy();
      expect(validateStatement(sent, ENV).errors).toEqual([]);
    }
  });
  it('lrsAggregate is aggregate-only and suppressed under 10 people; managers cannot read it', async () => {
    await as('k-hr-analyst');
    const a = await b.rpc.lrsAggregate();
    expect(a).toEqual(lrsAggregateOf(stmts(), 10));
    expect(a.cells.every((c) => (c.suppressed ? c.statements === null && c.actors === null : (c.actors ?? 0) >= 10))).toBe(true);
    expect(a.cells.some((c) => c.suppressed)).toBe(true);
    expect(a.top.every((x) => x.actors >= 10)).toBe(true);
    await as('sro');
    await expect(b.rpc.lrsAggregate()).rejects.toThrow();
  });
  it('toXapi and summarise read stored rows', () => {
    const row = T.xapi_statements.find((s) => s.source === 'm04_course') as StatementRow;
    const x = toXapi(row) as any;
    expect(x.verb.id).toBe(VERB_IRI.completed);
    expect(x.object.id).toBe(activityIri('course', row.object_id));
    expect(x.object.definition.type).toBe(ACTIVITY_TYPE_IRI.course);
    expect(x.timestamp).toBe(isoTs(row.occurred_at));
    const s = summarise([row, { ...row, verb: 'answered', source: 'f14_refresher', result: { success: true } } as StatementRow]);
    expect(s).toMatchObject({ statements: 2, completions: 1 });
    expect(s.minutes).toBeGreaterThan(0);
  });
});
