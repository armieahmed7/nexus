/** F38 OJT practice logbook (W5 · E1, M02): every acceptance criterion on the local path (security-restricted tasks refused, practice
 *  never changes qualification status, offline entries sync exactly once, the service worker is limited to /kafaa/my/ojt and sends
 *  nothing), the RBAC (own, preceptor acknowledges only when addressed, evaluator hand-off through signoffEvaluation, scope reads), the
 *  pure rules, the xAPI emitter (F30), the seed, routes and i18n. The SQL path is checked by scripts/validate/w5e1-microcred-ojt.mjs. */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey } from '../../src/i18n';
import { OJT_RULES, myStandards, newClientKey, preceptorOk, readiness, readinessReasons, validateLog, type LogInput, type LogRow } from '../../src/modules/m02/ojt';
import { OJT_SW_FILE, discard, enqueue, flushQueue, ojtSwScope, readQueue } from '../../src/modules/m02/ojtQueue';
import { makeSupabaseM02 } from '../../src/modules/m02/backend/supabase';
import { routes } from '../../src/modules/m02/routes';
import { draftFor } from '../../src/modules/m27/xapi';
import seed from '../../src/seed/seed.json';
import enJson from '../../src/i18n/m02.en.json';
import arJson from '../../src/i18n/m02.ar.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const today = new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const entry = (over: Partial<LogInput> = {}): LogInput => ({ client_key: `ojt:test:${Math.random().toString(36).slice(2, 12)}`, task_id: 'qs-qa-t2', on_date: today, mode: 'perform', preceptor_person_id: 'p-sq-lead', confidence: 4, conditions: 'Supplier audit', note: 'Led the closing meeting.', ...over });
const digest = () => JSON.stringify([b.raw('qual_records'), b.raw('evaluations')]);
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));
const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('F38 seed', () => {
  it('seeds practice for several trainees and disciplines, never on security-restricted standards; preceptors are qualified colleagues', () => {
    const logs = T.ojt_logs as LogRow[];
    expect(logs.length).toBeGreaterThanOrEqual(40);
    expect(new Set(logs.map((l) => l.person_id)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(logs.map((l) => l.status))).toEqual(new Set(['acknowledged', 'pending_ack', 'returned']));
    expect(new Set(logs.map((l) => l.mode))).toEqual(new Set(['walkthrough', 'simulate', 'perform']));
    const sec = new Set(T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id));
    expect(logs.every((l) => !sec.has(l.standard_id))).toBe(true);
    const w = { today: '2026-10-08', people: T.people, qual_records: T.qual_records, evaluator_quals: T.evaluator_quals };
    for (const l of logs) expect(preceptorOk(l.preceptor_person_id, l.person_id, l.standard_id, w), l.id).toBe('ok');
    expect(preceptorOk('p-qc-inspector', 'p-qc-inspector', 'qs-qa', w)).toBe('self_preceptor');
    expect(logs.every((l) => l.client_key === `seed:${l.id}`)).toBe(true);
    expect(new Set(T.ojt_eval_requests.map((r) => r.status))).toEqual(new Set(['requested', 'completed', 'cancelled']));
  });
  it('every seeded entry has exactly one xAPI statement in the F30 store; the completed request points at a real evaluation', () => {
    const st = T.xapi_statements.filter((s) => s.source === 'f38_ojt');
    expect(st.length).toBe(T.ojt_logs.length);
    expect(new Set(st.map((s) => s.source_ref)).size).toBe(T.ojt_logs.length);
    const done = T.ojt_eval_requests.find((r) => r.status === 'completed');
    expect(T.evaluations.some((e) => e.id === done.evaluation_id && e.task_id === done.task_id)).toBe(true);
  });
});

describe('F38 rules', () => {
  it('entry validation: client key, date window (no future, at most 180 days back), mode, integer confidence 1-5, note length', () => {
    expect(validateLog(entry(), today)).toBe('ok');
    expect(validateLog(entry({ client_key: 'short' }), today)).toBe('bad_key');
    expect(validateLog(entry({ on_date: addDays(today, 1) }), today)).toBe('invalid');
    expect(validateLog(entry({ on_date: addDays(today, -OJT_RULES.backdateDays - 1) }), today)).toBe('invalid');
    expect(validateLog(entry({ mode: 'teleport' as never }), today)).toBe('invalid');
    expect(validateLog(entry({ confidence: '3' as never }), today)).toBe('invalid');
    expect(validateLog(entry({ confidence: 6 }), today)).toBe('invalid');
    expect(validateLog(entry({ note: 'x'.repeat(501) }), today)).toBe('invalid');
    expect(newClientKey('p-qc-inspector')).toMatch(/^ojt:p-qc-inspector:[a-z0-9]+$/);
  });
  it('readiness: N acknowledged supervised performances (4 for critical tasks) plus a preceptor "ready"; walk-throughs and pending entries do not count', () => {
    const l = (id: string, over: Partial<LogRow>): LogRow => ({ id, client_key: id, person_id: 'p', task_id: 't', standard_id: 's', on_date: '2026-09-01', mode: 'perform', preceptor_person_id: 'q', confidence: 3, conditions: null, note: null, status: 'acknowledged', feedback: 'ok', preceptor_ready: false, ack_at: `2026-09-0${id}T10:00:00Z`, synced: 'online', ...over });
    const logs = [l('1', {}), l('2', { mode: 'walkthrough' }), l('3', {}), l('4', { status: 'pending_ack', ack_at: null }), l('5', { preceptor_ready: true })];
    const r = readiness({ id: 't', critical: false }, logs);
    expect(r).toMatchObject({ supervised: 3, needed: 3, pending: 1, preceptor_ready: true, ready: true });
    expect(readiness({ id: 't', critical: true }, logs)).toMatchObject({ needed: 4, ready: false });
    expect(readiness({ id: 't' }, logs.map((x) => ({ ...x, preceptor_ready: false }))).ready).toBe(false);
    expect(readinessReasons(r).map((x) => x.code)).toContain('ojt_not_signoff');
  });
  it('my standards come from my records and my role, never security-restricted ones in the logbook', () => {
    const me = T.people.find((p) => p.id === 'p-qc-inspector');
    const mine = myStandards(me, T.qual_records.filter((q) => q.person_id === me.id), T.qual_standards);
    expect(mine.has('qs-qa')).toBe(true);
  });
});

describe('F38 acceptance: restricted tasks cannot be logged', () => {
  it('a task on a security-restricted standard is refused with security_restricted (audited)', async () => {
    b.rawInsert('task_items', { id: 'qs-sec-test', standard_id: 'qs-sec', code: 'SEC-X', statement_en: 'Restricted task', statement_ar: 'مهمة مقيدة', method: 'ojt', evaluator_role: 'Security evaluator', sort: 99 } as never);
    await as('qc-inspector');
    const r = await b.rpc.logPractice(entry({ task_id: 'qs-sec-test' }));
    expect(r.code).toBe('security_restricted');
    expect(audits('ojt.log', 'refused').length).toBe(1);
    expect(b.raw('ojt_logs').some((l) => l.task_id === 'qs-sec-test')).toBe(false);
  });
  it('other refusals: self or unqualified preceptor, classroom items, standards that are not mine, anonymous callers', async () => {
    await as(null);
    expect((await b.rpc.logPractice(entry())).code).toBe('not_signed_in');
    await as('qc-inspector');
    expect((await b.rpc.logPractice(entry({ preceptor_person_id: 'p-qc-inspector' }))).code).toBe('self_preceptor');
    expect((await b.rpc.logPractice(entry({ preceptor_person_id: 'p-k-ro' }))).code).toBe('not_preceptor');
    expect((await b.rpc.logPractice(entry({ task_id: 'qs-get-t2' }))).code).toBe('not_practice_task');
    expect((await b.rpc.logPractice(entry({ task_id: 'qs-ro-t1' }))).code).toBe('not_applicable');
    expect((await b.rpc.logPractice(entry({ confidence: 9 }))).code).toBe('invalid');
  });
});

describe('F38 acceptance: a practice entry never changes qualification status', () => {
  it('logging, acknowledging "ready" and requesting an evaluation leave qualification records and evaluations untouched', async () => {
    const before = digest();
    await as('qc-inspector');
    const r = await b.rpc.logPractice(entry());
    expect(r.ok, r.message).toBe(true);
    await as('sq-lead');
    expect((await b.rpc.ackPractice({ log_id: r.data!.id, decision: 'acknowledge', feedback: 'Good audit leadership.', ready: true })).ok).toBe(true);
    await as('qc-inspector');
    expect((await b.rpc.requestEvaluation('qs-qa-t1', 'p-head-sq', 'Available Tuesday')).ok).toBe(true);
    expect(digest()).toBe(before);
    expect(r.message).toMatch(/not a qualification sign-off/);
  });
});

describe('F38 acceptance: offline entries sync exactly once (idempotent client keys)', () => {
  it('the server records a client key once; a re-sent entry returns the same id as a duplicate and emits no second statement', async () => {
    await as('qc-inspector');
    const e = entry();
    const st0 = b.raw('xapi_statements').filter((s) => s.source === 'f38_ojt').length;
    const a = await b.rpc.logPractice(e);
    const c = await b.rpc.logPractice({ ...e, offline: true });
    expect(a.ok && !a.data!.duplicate).toBe(true);
    expect(c.ok && c.data!.duplicate && c.data!.id === a.data!.id).toBe(true);
    expect(b.raw('ojt_logs').filter((l) => l.client_key === e.client_key).length).toBe(1);
    expect(b.raw('xapi_statements').filter((s) => s.source === 'f38_ojt').length).toBe(st0 + 1);
    await as('k-ro');
    expect((await b.rpc.logPractice(e)).code).toBe('bad_key'); // someone else's key is never matched or revealed
  });
  it('the device queue: network failures keep entries, a sync sends each once, a second sync sends nothing, refusals stay with their reason', async () => {
    const s = memStore();
    await as('qc-inspector');
    const good = entry();
    const bad = entry({ preceptor_person_id: 'p-k-ro' });
    enqueue('p-qc-inspector', good, s);
    enqueue('p-qc-inspector', good, s); // same key: replaced, not duplicated
    enqueue('p-qc-inspector', bad, s);
    expect(readQueue('p-qc-inspector', s).length).toBe(2);
    const down = await flushQueue('p-qc-inspector', async () => { throw new Error('offline'); }, s);
    expect(down).toEqual({ synced: 0, duplicates: 0, refused: 0, kept: 2 });
    const send = vi.fn((i: LogInput) => b.rpc.logPractice(i));
    const up = await flushQueue('p-qc-inspector', send, s);
    expect(up).toMatchObject({ synced: 1, refused: 1, kept: 0 });
    expect(readQueue('p-qc-inspector', s).map((x) => x.code)).toEqual(['not_preceptor']);
    const again = await flushQueue('p-qc-inspector', send, s);
    expect(again).toMatchObject({ synced: 0, duplicates: 0, refused: 1 });
    const rows = b.raw('ojt_logs').filter((l) => l.client_key === good.client_key);
    expect(rows.length).toBe(1);
    expect(rows[0].synced).toBe('offline');
    expect(discard('p-qc-inspector', bad.client_key, s)).toEqual([]);
    // a lost acknowledgement (sent, but the reply never arrived) is re-sent and recognised as a duplicate
    enqueue('p-qc-inspector', good, s);
    expect(await flushQueue('p-qc-inspector', send, s)).toMatchObject({ synced: 0, duplicates: 1 });
  });
  it('storage that throws (private window) never breaks the page', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readQueue('p', broken)).toEqual([]);
    expect(() => enqueue('p', entry(), broken)).not.toThrow();
  });
});

describe('F38 acceptance: the service worker is limited to /kafaa/my/ojt and sends nothing (speak-up no-telemetry check)', () => {
  const src = readFileSync('public/ojt-sw.js', 'utf8');
  const run = (scope: string) => {
    const handlers: Record<string, (e: unknown) => void> = {};
    const fetchMock = vi.fn(async () => new Response('ok'));
    const cache = { put: vi.fn(async () => undefined), match: vi.fn(async () => undefined) };
    const self = {
      registration: { scope }, location: { origin: 'https://demo.test' }, skipWaiting: vi.fn(), clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => []) },
      addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn; },
    };
    const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ['kafaa-ojt-v0', 'other-app']), delete: vi.fn(async () => true) };
    new Function('self', 'caches', 'fetch', 'Response', src)(self, caches, fetchMock, Response);
    const fire = (url: string, init: { method?: string; mode?: string } = {}) => {
      const respondWith = vi.fn();
      handlers.fetch({ request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' }, respondWith });
      return respondWith.mock.calls.length > 0;
    };
    return { handlers, fire, fetchMock, caches, self };
  };
  it('the registration scope is /kafaa/my/ojt (and /kafaa/ar/my/ojt), served from the base path', () => {
    expect(ojtSwScope('/kafaa/', 'en')).toBe('/kafaa/my/ojt');
    expect(ojtSwScope('/kafaa', 'ar')).toBe('/kafaa/ar/my/ojt');
    expect(OJT_SW_FILE).toBe('ojt-sw.js');
    const page = readFileSync('src/modules/m02/OjtLogbookPage.tsx', 'utf8');
    expect(page).toMatch(/serviceWorker\.register\(`\$\{base\}\$\{OJT_SW_FILE\}`, \{ scope: ojtSwScope\(/);
    expect(page).toMatch(/import\.meta\.env\.PROD/);
  });
  it('handles only logbook navigations and same-origin static assets; never speak-up, other pages, API calls, POSTs or other origins', () => {
    const w = run('https://demo.test/kafaa/my/ojt');
    expect(w.fire('https://demo.test/kafaa/my/ojt', { mode: 'navigate' })).toBe(true);
    expect(w.fire('https://demo.test/kafaa/my/ojt?tab=acknowledge', { mode: 'navigate' })).toBe(true);
    expect(w.fire('https://demo.test/kafaa/speak-up', { mode: 'navigate' })).toBe(false);
    expect(w.fire('https://demo.test/kafaa/my/quals', { mode: 'navigate' })).toBe(false);
    expect(w.fire('https://demo.test/kafaa/my/ojtx', { mode: 'navigate' })).toBe(false);
    expect(w.fire('https://demo.test/kafaa/assets/index-abc123.js')).toBe(true);
    expect(w.fire('https://demo.test/kafaa/assets/index-abc123.js', { method: 'POST' })).toBe(false);
    expect(w.fire('https://xyz.supabase.co/rest/v1/rpc/kafaa_log_practice', { method: 'POST' })).toBe(false);
    expect(w.fire('https://xyz.supabase.co/rest/v1/kafaa_ojt_logs')).toBe(false);
    expect(w.fire('https://demo.test/kafaa/seed.json')).toBe(false);
    const ar = run('https://demo.test/kafaa/ar/my/ojt');
    expect(ar.fire('https://demo.test/kafaa/ar/my/ojt', { mode: 'navigate' })).toBe(true);
    expect(ar.fire('https://demo.test/kafaa/ar/speak-up', { mode: 'navigate' })).toBe(false);
  });
  it('install, activate and sync make no network request and only touch its own cache; no telemetry code', async () => {
    const w = run('https://demo.test/kafaa/my/ojt');
    w.handlers.install({});
    let wait: Promise<unknown> = Promise.resolve();
    w.handlers.activate({ waitUntil: (p: Promise<unknown>) => { wait = p; } });
    await wait;
    w.handlers.sync({ tag: 'kafaa-ojt-sync', waitUntil: (p: Promise<unknown>) => { wait = p; } });
    await wait;
    expect(w.fetchMock).not.toHaveBeenCalled();
    expect(w.caches.delete).toHaveBeenCalledWith('kafaa-ojt-v0');
    expect(w.caches.delete).not.toHaveBeenCalledWith('other-app');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/sendBeacon|XMLHttpRequest|analytics|telemetry|importScripts|indexedDB|localStorage|https?:\/\//);
  });
});

describe('F38 RBAC and hand-off', () => {
  it('reads: own entries; a preceptor sees the entries addressed to them; an unrelated employee sees none', async () => {
    await as('qc-inspector');
    const mine = await b.list('ojt_logs');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((l) => l.person_id === 'p-qc-inspector' || l.preceptor_person_id === 'p-qc-inspector')).toBe(true);
    await as('sq-lead');
    expect((await b.list('ojt_logs')).filter((l) => l.preceptor_person_id === 'p-sq-lead').length).toBe(T.ojt_logs.filter((l) => l.preceptor_person_id === 'p-sq-lead').length);
    await as('k-ro');
    expect((await b.list('ojt_logs')).length).toBe(0);
  });
  it('only the named preceptor acknowledges, once, with feedback ("practice, not a sign-off")', async () => {
    const pending = T.ojt_logs.find((l) => l.person_id === 'p-qc-inspector' && l.status === 'pending_ack');
    await as('k-ro');
    expect((await b.rpc.ackPractice({ log_id: pending.id, decision: 'acknowledge', feedback: 'ok fine', ready: true })).code).toBe('not_preceptor');
    await as('sq-lead');
    expect((await b.rpc.ackPractice({ log_id: pending.id, decision: 'acknowledge', feedback: 'x', ready: false })).code).toBe('invalid');
    const a = await b.rpc.ackPractice({ log_id: pending.id, decision: 'acknowledge', feedback: 'Good audit leadership; findings factual.', ready: false });
    expect(a.ok && a.data!.status).toBe('acknowledged');
    expect((await b.rpc.ackPractice({ log_id: pending.id, decision: 'return', feedback: 'again', ready: false })).code).toBe('conflict');
    expect(b.raw('notifications').some((n) => n.person_id === 'p-qc-inspector' && String(n.id).startsWith('nt-ojt-'))).toBe(true);
  });
  it('request evaluation: ready tasks only, a qualified evaluator who is not me, one open request; the evaluator signs off through M02 and closes it', async () => {
    await as('qc-inspector');
    expect((await b.rpc.requestEvaluation('qs-qa-t2', 'p-head-sq')).code).toBe('not_ready');
    expect((await b.rpc.requestEvaluation('qs-qa-t1', 'p-qc-inspector')).code).toBe('self_evaluator');
    expect((await b.rpc.requestEvaluation('qs-qa-t1', 'p-k-ro')).code).toBe('not_evaluator');
    const r = await b.rpc.requestEvaluation('qs-qa-t1', 'p-head-sq', 'Available Tuesday');
    expect(r.ok, r.message).toBe(true);
    expect((await b.rpc.requestEvaluation('qs-qa-t1', 'p-head-sq')).code).toBe('already_requested');
    await as('head-sq');
    expect((await b.list('ojt_eval_requests')).some((x) => x.id === r.data!.id)).toBe(true);
    expect((await b.rpc.closeEvaluationRequest(r.data!.id, 'complete', null)).code).toBe('no_evaluation');
    expect((await b.rpc.closeEvaluationRequest(r.data!.id, 'bogus' as never, null)).code).toBe('invalid');
    const so = await b.rpc.signoffEvaluation({ record_id: 'qr-p-qc-inspector-qs-qa', task_id: 'qs-qa-t1', result: 'pass' });
    expect(so.ok, so.message).toBe(true);
    const cl = await b.rpc.closeEvaluationRequest(r.data!.id, 'complete', 'Signed off');
    expect(cl.ok && cl.data!.evaluation_id === so.data!.evaluation_id && cl.data!.result === 'pass').toBe(true);
  });
  it('the preceptor list names qualified colleagues (and evaluators), never me', async () => {
    await as('qc-inspector');
    const list = await b.rpc.ojtPreceptors('qs-qa-t2');
    expect(list.some((p) => p.id === 'p-sq-lead')).toBe(true);
    expect(list.some((p) => p.id === 'p-qc-inspector')).toBe(false);
    expect(list.some((p) => p.evaluator)).toBe(true);
  });
});

describe('F38 xAPI and wiring', () => {
  it('the F30 emitter drafts an `attempted` statement on the task with no free text', () => {
    const l = T.ojt_logs[0];
    const task = T.task_items.find((t) => t.id === l.task_id);
    const d = draftFor('f38_ojt', l, { task: (id: string) => T.task_items.find((t) => t.id === id) } as never);
    expect(d).toBeTruthy();
    expect(d!.verb).toBe('attempted');
    expect(d!.object_type).toBe('task');
    expect(d!.object_id).toBe(task.id);
    expect(JSON.stringify(d)).not.toContain(String(l.note ?? '~none~'));
  });
  it('routes, supabase mapping and i18n keys', () => {
    const my = routes.find((r) => r.id === 'my-ojt')!;
    const team = routes.find((r) => r.id === 'team-ojt')!;
    expect(my.path).toBe('/my/ojt');
    expect(my.guard.grant).toEqual({ res: 'qual_records', levels: ['Own'] });
    expect(team.guard.grant).toEqual({ res: 'qual_records', levels: ['Scope'] });
    for (const k of ['m02.routes.my-ojt.title', 'm02.routes.team-ojt.purpose', 'm02.ojt.noticeTitle', 'm02.reasons.ojt_not_signoff', 'm02.ojt.ackNotSignoff']) expect(hasKey(k), k).toBe(true);
    expect((enJson as { ojt: { noticeTitle: string } }).ojt.noticeTitle).toBe('Practice, not a sign-off');
    expect(Object.keys(enJson.ojt).sort()).toEqual(Object.keys(arJson.ojt).sort());
    const calls: string[] = [];
    const stub = async (fn: string) => { calls.push(fn); return { ok: true, code: 'ok', message: '', data: null }; };
    const s = makeSupabaseM02({ rpc: stub, call: stub } as never) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    void s.logPractice(entry()); void s.ackPractice({}); void s.requestEvaluation('t', 'e'); void s.closeEvaluationRequest('r', 'cancel'); void s.ojtPreceptors('t');
    expect(calls).toEqual(['kafaa_log_practice', 'kafaa_ack_practice', 'kafaa_request_evaluation', 'kafaa_close_evaluation_request', 'kafaa_ojt_preceptors']);
  });
});
