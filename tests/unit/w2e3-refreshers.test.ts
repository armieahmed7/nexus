/** F14 Knowledge refreshers (W2 · E3): every acceptance criterion on the local path plus a static check of the SQL.
 *  SQL behaviour (same picks as TypeScript, guard trigger, no keys in the payload) is checked by
 *  scripts/validate/w2e3-mentoring-refreshers.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey } from '../../src/i18n';
import {
  BOX_DAYS, MSG, SET_SIZE, W_BASE, W_REQUAL, W_ROLE, addDaysIso, applyAnswer, competencyWeights, confidenceByCompetency, dueAfter, isPracticeItem, itemStatsOf, nextBox, pickRefresher, quotaUsed, stateId, weekStart,
  type ItemLite, type StateLite,
} from '../../src/modules/m19/refresh';
import seed from '../../src/seed/seed.json';
import en from '../../src/i18n/m19.en.json';
import ar from '../../src/i18n/m19.ar.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const items = T.items as ItemLite[];
const practice = new Set(items.filter(isPracticeItem).map((i) => i.id));
const today = new Date().toISOString().slice(0, 10);
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const keyOf = (id: string) => {
  const it = items.find((i) => i.id === id)!;
  return T.item_versions.find((v) => v.item_id === id && v.version === (it.current_version ?? 1))!;
};
const KEY_FIELDS = /"(answer|key|rationale_en|rationale_ar|is_correct|correct_option)"\s*:/;

describe('F14 only practice items are served (acceptance)', () => {
  it('the seed has an open practice bank and a secure bank; refresher states only reference practice items', () => {
    expect(practice.size).toBeGreaterThanOrEqual(50);
    expect(items.some((i) => i.bank !== 'practice')).toBe(true);
    for (const s of T.refresh_state) expect(practice.has(s.item_id)).toBe(true);
  });
  it('the pick never contains a secure, retired or draft item, even one flagged as practice', () => {
    const secure = items.find((i) => i.bank !== 'practice')!;
    const forged: ItemLite[] = [
      ...items,
      { ...secure, id: 'x-secure-flagged', is_practice: true },
      { ...items.find((i) => practice.has(i.id))!, id: 'x-draft', status: 'draft' },
      { ...items.find((i) => practice.has(i.id))!, id: 'x-retired', status: 'retired' },
    ];
    const weights = competencyWeights({ comps: [...new Set(forged.map((i) => i.competency_id!).filter(Boolean))], roleId: null, roleComps: [], quals: [], skills: [], today });
    for (const extra of [false, true]) {
      const r = pickRefresher({ items: forged, states: [], weights, today, cadence: 'daily', extra });
      expect(r.picks.length).toBe(SET_SIZE);
      expect(r.picks.every((p) => practice.has(p.item_id))).toBe(true);
    }
  });
  it('every staff persona gets only practice items from nextRefresher', async () => {
    for (const p of ['k-ro', 'sro', 'qc-inspector', 'outage-planner', 'sq-lead', 'training-mgr']) {
      await as(p);
      const r = await b.rpc.nextRefresher(true);
      expect(r.ok).toBe(true);
      expect(r.data!.items.length).toBeGreaterThan(0);
      expect(r.data!.items.every((q) => practice.has(q.item_id))).toBe(true);
    }
  });
  it('submitting an answer to a secure item is refused (audited) and writes nothing', async () => {
    await as('k-ro');
    const secure = items.find((i) => i.bank !== 'practice')!;
    const before = b.raw('refresh_state').length;
    const r = await b.rpc.submitRefresher([{ item_id: secure.id, answer: 'a' }]);
    expect([r.ok, r.code, r.message]).toEqual([false, 'not_practice', MSG.not_practice]);
    expect(b.raw('refresh_state').length).toBe(before);
    expect(b.raw('audit_events').some((a) => a.action === 'refresher.submit' && a.outcome === 'refused')).toBe(true);
  });
  it('SQL: every refresher query over kafaa_items carries the practice predicate, and a trigger guards refresh_state', () => {
    const sql = readFileSync('supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql', 'utf8');
    const f14 = sql.slice(sql.indexOf('kafaa_refresh_msgs'));
    const PRED = /bank = 'practice' and i\.is_practice and i\.status = 'approved' and i\.competency_id is not null/;
    // each read of kafaa_items, with the line after it (a where clause may wrap)
    const lines = f14.split('\n');
    const reads = lines.map((l, k) => `${l} ${lines[k + 1] ?? ''}`).filter((l) => /from kafaa_items i\b/.test(l) && !/jsonb_array_elements/.test(l));
    expect(reads.length).toBeGreaterThanOrEqual(5);
    for (const l of reads) expect(l).toMatch(PRED);
    expect(sql).toMatch(/create or replace trigger kafaa_w2e3_refresh_practice_guard before insert or update on kafaa_refresh_state/);
    expect(sql).not.toMatch(/\b(drop|delete|truncate)\b/i);
  });
});

describe('F14 Leitner boxes (acceptance)', () => {
  it('a correct answer moves up one box (cap 5); a wrong one goes back to box 1', () => {
    expect([nextBox(1, true), nextBox(2, true), nextBox(4, true), nextBox(5, true)]).toEqual([2, 3, 5, 5]);
    expect([nextBox(1, false), nextBox(3, false), nextBox(5, false)]).toEqual([1, 1, 1]);
  });
  it('due dates follow the schedule: box 1 tomorrow, then 3, 7, 14 and 30 days', () => {
    expect(BOX_DAYS).toEqual([0, 1, 3, 7, 14, 30]);
    const d = '2026-10-09';
    expect([1, 2, 3, 4, 5].map((x) => dueAfter(x, d))).toEqual(['2026-10-10', '2026-10-12', '2026-10-16', '2026-10-23', '2026-11-08']);
    expect(applyAnswer(undefined, true, d)).toEqual({ box_before: 1, box: 2, due_on: '2026-10-12', attempts: 1, correct: 1, last_result: 'correct' });
    expect(applyAnswer({ person_id: 'p', item_id: 'i', box: 4, due_on: d, attempts: 6, correct: 5 }, false, d)).toEqual({ box_before: 4, box: 1, due_on: '2026-10-10', attempts: 7, correct: 5, last_result: 'wrong' });
  });
  it('submitRefresher checks answers server-side and moves the boxes; the result reveals the key and explanation', async () => {
    await as('k-ro');
    const set = (await b.rpc.nextRefresher(true)).data!;
    const [q1, q2] = set.items;
    const right = keyOf(q1.item_id).answer;
    const wrong = q2.options.find((o) => o.id !== keyOf(q2.item_id).answer)!.id;
    const prev1 = { ...(b.rawGet('refresh_state', stateId('p-k-ro', q1.item_id)) ?? {}) } as unknown as StateLite | undefined; // a copy: rawGet returns the live row
    const r = await b.rpc.submitRefresher([{ item_id: q1.item_id, answer: right }, { item_id: q2.item_id, answer: wrong }]);
    expect(r.ok).toBe(true);
    expect([r.data!.correct, r.data!.total]).toEqual([1, 2]);
    const r1 = r.data!.results.find((x) => x.item_id === q1.item_id)!;
    const r2 = r.data!.results.find((x) => x.item_id === q2.item_id)!;
    expect(r1).toMatchObject({ correct: true, key: right, box_before: prev1?.box ?? 1, box_after: Math.min(5, (prev1?.box ?? 1) + 1) });
    expect(r1.due_on).toBe(dueAfter(r1.box_after, today));
    expect(r2).toMatchObject({ correct: false, box_after: 1, due_on: addDaysIso(today, 1) });
    expect(r2.rationale_en.length).toBeGreaterThan(10);
    expect(r2.rationale_ar.length).toBeGreaterThan(10);
    expect(b.rawGet('refresh_state', stateId('p-k-ro', q2.item_id))).toMatchObject({ box: 1, due_on: addDaysIso(today, 1), last_result: 'wrong' });
    expect(b.raw('audit_events').some((a) => a.action === 'refresher.submit' && a.outcome === 'ok')).toBe(true);
  });
  it('due items come first (oldest due date, lowest box), then new items', async () => {
    await as('k-ro');
    const set = (await b.rpc.nextRefresher(true)).data!;
    const mine = (b.raw('refresh_state') as unknown as StateLite[]).filter((s) => s.person_id === 'p-k-ro');
    const due = mine.filter((s) => s.due_on <= today).sort((x, y) => (x.due_on < y.due_on ? -1 : x.due_on > y.due_on ? 1 : x.box - y.box));
    expect(set.due_count).toBe(due.length);
    const n = Math.min(SET_SIZE, due.length);
    expect(set.items.slice(0, n).every((q) => q.state === 'due')).toBe(true);
    expect(set.items[0].item_id).toBe(due[0].item_id);
    if (due.length < SET_SIZE) expect(set.items.slice(n).every((q) => q.state === 'new')).toBe(true);
  });
});

describe('F14 no answer keys before submission (acceptance)', () => {
  it('nextRefresher carries stems and options only: no key, rationale or correct flag anywhere in the payload', async () => {
    for (const p of ['k-ro', 'qc-inspector', 'sro']) {
      await as(p);
      const r = await b.rpc.nextRefresher(true);
      const json = JSON.stringify(r);
      expect(json).not.toMatch(KEY_FIELDS);
      for (const q of r.data!.items) {
        for (const o of q.options) expect(Object.keys(o).sort()).toEqual(['ar', 'en', 'id']);
        const v = keyOf(q.item_id);
        if (v.rationale_en) expect(json).not.toContain(v.rationale_en);
      }
    }
  });
  it('refresh_state rows never store the chosen answer or the key', () => {
    for (const s of T.refresh_state) expect(JSON.stringify(s)).not.toMatch(KEY_FIELDS);
  });
  it('invalid answers are refused: unknown option, duplicates, more than five, empty', async () => {
    await as('k-ro');
    const set = (await b.rpc.nextRefresher(true)).data!;
    const q = set.items[0];
    expect((await b.rpc.submitRefresher([{ item_id: q.item_id, answer: 'zz' }])).code).toBe('invalid');
    expect((await b.rpc.submitRefresher([{ item_id: q.item_id, answer: q.options[0].id }, { item_id: q.item_id, answer: q.options[1].id }])).code).toBe('invalid');
    expect((await b.rpc.submitRefresher([])).code).toBe('invalid');
    const six = [...practice].slice(0, 6).map((id) => ({ item_id: id, answer: keyOf(id).options[0].id as string }));
    expect((await b.rpc.submitRefresher(six)).code).toBe('invalid');
  });
});

describe('F14 weighting and quota', () => {
  it('role competencies and competencies with a qualification expiring within a year weigh more', () => {
    const roleComps = [{ role_id: 'r1', competency_id: 'c-role' }];
    const skills = [{ competency_id: 'c-req', evidence_keys: ['std-1'] }];
    const w = competencyWeights({ comps: ['c-role', 'c-req', 'c-other'], roleId: 'r1', roleComps, quals: [{ standard_id: 'std-1', expires_on: addDaysIso('2026-10-09', 90) }], skills, today: '2026-10-09' });
    expect(w.get('c-role')!.weight).toBe(W_BASE + W_ROLE);
    expect(w.get('c-req')).toMatchObject({ weight: W_BASE + W_REQUAL, requal_standard_id: 'std-1', requal_days: 90 });
    expect(w.get('c-other')!.weight).toBe(W_BASE);
    const far = competencyWeights({ comps: ['c-req'], roleId: null, roleComps: [], quals: [{ standard_id: 'std-1', expires_on: addDaysIso('2026-10-09', 400) }], skills, today: '2026-10-09' });
    expect(far.get('c-req')!.weight).toBe(W_BASE);
    const mirror = competencyWeights({ comps: ['c-req'], roleId: null, roleComps: [], quals: [{ standard_id: 'std-1', expires_on: addDaysIso('2026-10-09', 30), security_mirror_only: true }], skills, today: '2026-10-09' });
    expect(mirror.get('c-req')!.weight).toBe(W_BASE);
  });
  it('new items lean to the heavier competencies', () => {
    const pool = items.filter(isPracticeItem);
    const comps = [...new Set(pool.map((i) => i.competency_id!))];
    const heavy = comps[0];
    const roleComps = [{ role_id: 'r1', competency_id: heavy }];
    const weights = competencyWeights({ comps, roleId: 'r1', roleComps, quals: [], skills: [], today });
    const r = pickRefresher({ items, states: [], weights, today, cadence: 'weekly', extra: true });
    expect(r.picks.filter((p) => p.competency_id === heavy).length).toBeGreaterThanOrEqual(2);
    expect(r.picks[0].competency_id).toBe(heavy);
  });
  it('five a day or five a week; "extra" ignores the quota; paused counts as weekly', () => {
    const d = '2026-10-09';
    const ws = weekStart(d);
    const st = (n: number, at: string): StateLite[] => [...practice].slice(0, n).map((id) => ({ person_id: 'p', item_id: id, box: 2, due_on: '2026-12-01', last_at: `${at}T08:00:00Z` }));
    expect(quotaUsed(st(3, d), 'daily', d)).toEqual({ used: 3, window: 'day' });
    expect(quotaUsed(st(3, ws), 'daily', d).used).toBe(ws === d ? 3 : 0);
    expect(quotaUsed(st(3, ws), 'weekly', d)).toEqual({ used: 3, window: 'week' });
    expect(quotaUsed(st(3, addDaysIso(ws, -1)), 'weekly', d).used).toBe(0);
    expect(quotaUsed(st(2, d), 'paused', d).window).toBe('week');
    const weights = competencyWeights({ comps: [...new Set(items.filter(isPracticeItem).map((i) => i.competency_id!))], roleId: null, roleComps: [], quals: [], skills: [], today: d });
    expect(pickRefresher({ items, states: st(5, d), weights, today: d, cadence: 'weekly' }).picks.length).toBe(0);
    expect(pickRefresher({ items, states: st(5, d), weights, today: d, cadence: 'weekly', extra: true }).picks.length).toBe(SET_SIZE);
    expect(pickRefresher({ items, states: st(2, d), weights, today: d, cadence: 'daily' }).limit).toBe(3);
  });
  it('the pick is deterministic', () => {
    const weights = competencyWeights({ comps: [...new Set(items.filter(isPracticeItem).map((i) => i.competency_id!))], roleId: null, roleComps: [], quals: [], skills: [], today });
    const mine = (T.refresh_state as StateLite[]).filter((x) => x.person_id === 'p-k-ro');
    const a = pickRefresher({ items, states: mine, weights, today, cadence: 'daily', extra: true });
    const c = pickRefresher({ items: [...items].reverse(), states: [...mine].reverse(), weights, today, cadence: 'daily', extra: true });
    expect(c).toEqual(a);
  });
  it('the preferred cadence is the person\'s own row (direct write, own only)', async () => {
    await as('k-ro');
    const mine = (b.raw('refresh_prefs') as { id: string; person_id: string }[]).find((x) => x.person_id === 'p-k-ro')!;
    expect((await b.update('refresh_prefs', mine.id, { cadence: 'daily' } as never)).ok).toBe(true);
    expect((await b.rpc.nextRefresher()).data!.window).toBe('day');
    await as('sro');
    expect((await b.update('refresh_prefs', mine.id, { cadence: 'paused' } as never)).ok).toBe(false);
    expect((await b.list('refresh_prefs')).every((r) => (r as { person_id: string }).person_id === 'p-sro')).toBe(true);
  });
});

describe('F14 privacy: confidence is private, the instructor view is aggregate (≥10)', () => {
  it('refresh_state is readable by its owner only, and only the RPC writes it', async () => {
    await as('k-ro');
    const own = await b.list('refresh_state');
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => (r as { person_id: string }).person_id === 'p-k-ro')).toBe(true);
    expect((await b.insert('refresh_state', { person_id: 'p-k-ro', item_id: [...practice][0], box: 5, due_on: '2027-01-01' } as never)).ok).toBe(false);
    for (const p of ['sro', 'training-mgr', 'head-sq', 'k-auditor']) {
      await as(p);
      expect((await b.list('refresh_state')).some((r) => (r as { person_id: string }).person_id === 'p-k-ro')).toBe(false);
    }
  });
  it('confidence bars per competency from the boxes', () => {
    const pool = items.filter(isPracticeItem);
    const c = pool[0].competency_id!;
    const ids = pool.filter((i) => i.competency_id === c).map((i) => i.id);
    const conf = confidenceByCompetency(items, [{ person_id: 'p', item_id: ids[0], box: 5, due_on: today }]).find((x) => x.competency_id === c)!;
    expect(conf).toMatchObject({ items: ids.length, seen: 1, mastered: 1, pct: Math.round(100 / ids.length) });
  });
  it('item stats: suppressed under 10 people, flags very easy and very hard items', () => {
    const s = itemStatsOf(items, T.refresh_state as StateLite[]);
    expect(s.min_group).toBe(10);
    for (const i of s.items) {
      if (i.suppressed) expect([i.people, i.attempts, i.p_value, i.flag]).toEqual([null, null, null, null]);
      else expect(i.people!).toBeGreaterThanOrEqual(10);
    }
    expect(s.items.some((i) => i.suppressed)).toBe(true);
    expect(s.items.find((i) => i.item_id === 'it-rf-ep-01')!.flag).toBe('too_easy');
    expect(s.items.find((i) => i.item_id === 'it-rf-react-05')!.flag).toBe('too_hard');
    expect(s.by_competency.some((c) => !c.suppressed)).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/p-[a-z]/);
  });
  it('refresherItemStats: instructors and the training manager only', async () => {
    for (const p of ['training-mgr', 'sq-lead', 'k-instructor']) { await as(p); expect((await b.rpc.refresherItemStats()).ok).toBe(true); }
    for (const p of ['k-ro', 'sro', 'qc-inspector']) { await as(p); expect((await b.rpc.refresherItemStats()).code).toBe('forbidden'); }
    await as(null);
    expect((await b.rpc.refresherItemStats()).code).toBe('not_signed_in');
    expect((await b.rpc.nextRefresher()).code).toBe('not_signed_in');
  });
  it('auditors and partners cannot practise (staff only)', async () => {
    await as('k-auditor');
    expect((await b.rpc.nextRefresher()).code).toBe('forbidden');
  });
});

describe('F14 no streak, points or leaderboard (acceptance, copy check)', () => {
  const GAMIFIED = /\b(points?|pts|xp|streaks?|leaderboards?|ranking|rank|top performer|level up|badges?)\b/i;
  const flat = (o: unknown, path = ''): [string, string][] => (typeof o === 'string' ? [[path, o]] : Object.entries(o as object).flatMap(([k, v]) => flat(v, path ? `${path}.${k}` : k)));
  it('refresher and instructor copy never uses gamification words, except to state the policy', () => {
    const POLICY = ['refresh.noGamesBody', 'refresh.noGamesTitle'];
    const strings = flat({ refresh: (en as any).refresh, rstats: (en as any).rstats }).filter(([k]) => !POLICY.some((p) => k.startsWith(p)));
    expect(strings.length).toBeGreaterThan(30);
    for (const [k, v] of strings) expect(`${k}: ${v}`).not.toMatch(new RegExp(`: .*${GAMIFIED.source}`, 'i'));
  });
  it('every refresher string exists in Arabic', () => {
    for (const [k] of flat({ refresh: (en as any).refresh, rstats: (en as any).rstats })) expect(hasKey(`m19.${k}`)).toBe(true);
    expect(flat({ refresh: (ar as any).refresh }).length).toBe(flat({ refresh: (en as any).refresh }).length);
  });
});
