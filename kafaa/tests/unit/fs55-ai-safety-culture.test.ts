/** FS49 Safety culture for an AI-augmented plant (FS wave E · E5, M08): one named test per acceptance criterion on the local path, plus
 *  the shared content rules, the situation matcher, RBAC on the local backend, the seed and i18n. The SQL path (kafaa_fs49_hu_problems =
 *  huCardProblems, kafaa_fs49_lesson_problems = lessonProblems, the guard trigger, RLS, the guarded migration replay, grants) is proved by
 *  scripts/validate/fs55-ai-safety-culture.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m08.en.json';
import ar from '../../src/i18n/m08.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m08/routes';
import { CUES, CUE_IDS, SITUATIONS, blank, fs49Coverage, huCardProblems, lessonProblems, liveLinks, matchSituation } from '../../src/modules/m08/aiCulture';
import { lintRanked } from '../../src/domain/engines/rank';
import { publicTextIsClean } from '../../src/domain/future';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const liveDrills = new Set(T.ai_drills.filter((d) => d.status === 'published' && d.listed).map((d) => d.id as string));
const pubLessons = new Set(T.oe_lessons.filter((o) => o.status === 'published').map((o) => o.id as string));
const aiLessons = T.oe_lessons.filter((o) => o.topic === 'ai_automation');
const refs = { drills: T.ai_drills.map((d) => d.id as string), lessons: T.oe_lessons.map((o) => o.id as string), traits: T.sc_traits.map((t) => t.id as string) };
const AR = /[؀-ۿ]/;
const card = (id: string) => T.hu_tools.find((h) => h.id === id)!;
const get = (o: Row, path: string) => path.split('.').reduce((x: Row | undefined, k) => (x ? (x as Row)[k] : undefined), o);

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS49 · acceptance 1: every lesson carries a public source and date', () => {
  it('every lesson carries a public source and date (the 7 international lessons on automation and digital systems)', () => {
    expect(aiLessons).toHaveLength(7);
    for (const l of aiLessons) {
      expect(lessonProblems(l, { drills: refs.drills }), l.id).toEqual([]);
      expect(l.sources.length, l.id).toBeGreaterThanOrEqual(1);
      for (const s of l.sources) {
        expect(s.url, l.id).toMatch(/^https:\/\/\S+$/);
        expect(Number.isInteger(s.year) && s.year >= 2020 && s.year <= 2026, l.id).toBe(true);
        expect(s.as_of, l.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.as_of <= '2026-10-11', l.id).toBe(true);
      }
      expect(l.reviewed_on && l.reviewing_body && l.status === 'published' && l.deidentified && l.sample === false, l.id).toBe(true);
    }
    // every published lesson, old or new, has its review date and reviewing body (the M08 acceptance item)
    for (const l of T.oe_lessons.filter((x) => x.status === 'published')) expect(Boolean(l.reviewed_on && l.reviewing_body), l.id).toBe(true);
  });
  it('lesson sources come only from the research packs (no invented sources), are international and name no ENEC event', () => {
    const packs = ['nuclear_energy', 'corporate_platforms', 'global_frameworks', 'national_systems'].map((f) => readFileSync(`../docs/kafaa/ref/research/${f}.md`, 'utf8')).join('\n');
    for (const l of aiLessons) {
      for (const s of l.sources) expect(packs.includes(s.url.replace(/^https:\/\//, '')), `${l.id} ${s.url}`).toBe(true);
      expect(l.source_kind).not.toBe('internal');
      expect(`${l.title_en} ${l.summary_en} ${l.lesson_en}`).not.toMatch(/Barakah|Unit [1-4]\b|FANR finding/i);
      expect(publicTextIsClean([l.summary_en, l.lesson_en, l.summary_ar, l.lesson_ar])).toBe(true);
    }
  });
  it('the content rule refuses an AI lesson without an https source, a year or an as-of date; general lessons keep their rules', () => {
    const base = aiLessons[0];
    const s0 = base.sources[0];
    expect(lessonProblems({ ...base, sources: [] })).toEqual(['sources']);
    expect(lessonProblems({ ...base, sources: [{ ...s0, url: 'http://example.org' }] })).toEqual(['source_url']);
    expect(lessonProblems({ ...base, sources: [{ ...s0, year: 1980 }] })).toEqual(['source_year']);
    expect(lessonProblems({ ...base, sources: [{ ...s0, as_of: '' }] })).toEqual(['source_as_of']);
    expect(lessonProblems({ ...base, sources: [{ ...s0, label: ' ' }] })).toEqual(['source_label']);
    expect(lessonProblems({ ...base, title_ar: '' })).toEqual(['text']);
    expect(lessonProblems({ ...base, topic: 'general', sources: [] })).toEqual([]);
    expect(lessonProblems({ ...base, drill_ids: ['ad-nope'] }, { drills: refs.drills })).toEqual(['drill_unknown']);
  });
});

describe('FS49 · acceptance 3: each HU tool card exists in EN and AR and links at least one drill or lesson', () => {
  it('each HU tool card exists in EN and AR and links at least one drill or lesson (published, so a reader can open it)', () => {
    expect(T.hu_tools).toHaveLength(12);
    for (const h of T.hu_tools) {
      expect(huCardProblems(h, refs), h.id).toEqual([]);
      for (const k of ['name', 'description']) { expect(blank(h[`${k}_en`]), h.id).toBe(false); expect(AR.test(h[`${k}_ar`]), h.id).toBe(true); }
      expect(AR.test(h.topic === 'ai_automation' ? h.trap_ar : h.ai_ar), h.id).toBe(true);
      const live = liveLinks(h, T.ai_drills, T.oe_lessons);
      expect(live.drills.length + live.lessons.length, h.id).toBeGreaterThanOrEqual(1);
      expect(live.drills.every((d) => liveDrills.has(d)) && live.lessons.every((l) => pubLessons.has(l))).toBe(true);
    }
  });
  it('the four AI-era cards named by the card exist with a trap, at least two counter-moves and a synthetic example in both languages', () => {
    for (const id of ['hu-ai-bias', 'hu-ai-mode', 'hu-ai-reliance', 'hu-ai-verify']) {
      const h = card(id);
      expect(h.topic).toBe('ai_automation');
      expect(h.practice.length).toBeGreaterThanOrEqual(2);
      for (const s of h.practice) expect(s.en.trim() && AR.test(s.ar)).toBeTruthy();
      expect(h.example_en).toMatch(/^Synthetic example/);
      expect(h.example_ar).toMatch(/^مثال اصطناعي/);
      expect(h.drill_ids.filter((d: string) => liveDrills.has(d)).length).toBeGreaterThanOrEqual(1);
    }
    expect(card('hu-ai-verify').name_en).toBe('Verify against the controlled source');
    expect(card('hu-ai-bias').name_en).toMatch(/Automation bias/);
    expect(card('hu-ai-mode').trap_en).toMatch(/Mode confusion/);
    expect(card('hu-ai-reliance').name_en).toMatch(/Over-reliance/);
  });
  it('HU cards link FS37 drills by id (/my/ai-fluency/drills/:id) and a draft drill never counts as a live link', () => {
    expect(card('hu-ai-bias').drill_ids).toContain('ad-valve-lineup');
    const withDraft = { ...card('hu-6'), drill_ids: ['ad-outage-scope'], lesson_ids: [] };
    expect(huCardProblems(withDraft, refs)).toEqual([]);
    expect(liveLinks(withDraft, T.ai_drills, T.oe_lessons)).toEqual({ drills: [], lessons: [] });
  });
  it('the content rule names each problem in a fixed order', () => {
    const c = card('hu-ai-mode');
    expect(huCardProblems({ ...c, name_ar: '' })).toEqual(['name']);
    expect(huCardProblems({ ...c, drill_ids: [], lesson_ids: [] })).toEqual(['links']);
    expect(huCardProblems({ ...c, practice: [c.practice[0]] })).toEqual(['practice']);
    expect(huCardProblems({ ...c, cues: ['nope'] })).toEqual(['cues']);
    expect(huCardProblems({ ...c, trap_ar: '\t' })).toEqual(['ai_text']);
    expect(huCardProblems({ ...card('hu-3'), ai_ar: '' })).toEqual(['ai_angle']);
    expect(huCardProblems({ ...c, drill_ids: ['ad-nope'], lesson_ids: ['oe-nope'], trait_ids: ['trait-99'] }, refs)).toEqual(['drill_unknown', 'lesson_unknown', 'trait_unknown']);
    expect(huCardProblems({ ...c, name_en: ' ', description_ar: '', cues: [], drill_ids: [], lesson_ids: [] })).toEqual(['name', 'description', 'cues', 'links']);
  });
});

describe('FS49 · acceptance 2: the speak-up network check stays green', () => {
  it('the speak-up network check stays green: /speak-up keeps noTelemetry and FS49 adds nothing to it', () => {
    const r = routes.find((x) => x.id === 'speak-up')!;
    expect(r.guard).toEqual({ noTelemetry: true });
    const src = readFileSync('src/modules/m08/SpeakUpPage.tsx', 'utf8');
    expect(src).not.toMatch(/useAction|logDenied|\.rpc\.|insert\(|update\(|useToast|aiUi|AiSafetyCulture|BenchmarkChips|WhyThis/);
    // the FS49 pages only link to /speak-up; none of them is a no-telemetry route or writes anything on render
    for (const f of ['AiSafetyCulturePage.tsx', 'aiUi.tsx']) expect(readFileSync(`src/modules/m08/${f}`, 'utf8')).not.toMatch(/useAction|\.rpc\.|logDenied|localStorage/);
    expect(routes.filter((x) => x.guard.noTelemetry).map((x) => x.id)).toEqual(['speak-up']);
  });
});

describe('FS49 · questioning attitude and conservative decisions with AI examples', () => {
  it('trait-2 (questioning attitude) and trait-5 (decision-making) carry AI behaviours and prompts in both languages; no other trait changes', () => {
    const ext = T.sc_traits.filter((t) => t.ai_behaviours.length);
    expect(ext.map((t) => t.id)).toEqual(['trait-2', 'trait-5']);
    for (const t of ext) {
      expect(t.ai_behaviours.length).toBeGreaterThanOrEqual(4);
      expect(t.ai_prompts.length).toBeGreaterThanOrEqual(2);
      for (const x of [...t.ai_behaviours, ...t.ai_prompts]) expect(x.en.trim() && AR.test(x.ar)).toBeTruthy();
      for (const id of t.ai_hu_ids) expect(T.hu_tools.some((h) => h.id === id)).toBe(true);
    }
    expect(T.sc_traits.find((t) => t.id === 'trait-5')!.ai_behaviours[0].en).toMatch(/conservative/);
  });
});

describe('FS49 · "which tool fits this moment?" matcher', () => {
  it('every situation returns up to three cards, each with reasons that carry i18n keys (lintRanked), led by an AI-era card', () => {
    for (const s of SITUATIONS) {
      const m = matchSituation(s.id, T.hu_tools as never);
      expect(m.length).toBeGreaterThanOrEqual(1);
      expect(m.length).toBeLessThanOrEqual(3);
      expect(m[0].card.topic).toBe('ai_automation');
      expect(lintRanked(m.map((x) => ({ id: x.id, score: x.score, reasons: x.reasons })) as never)).toEqual([]);
      for (const r of m.flatMap((x) => x.reasons)) expect(get(en, r.key.replace(/^m08\./, '')), r.key).toBeTruthy();
    }
    expect(matchSituation('mode', T.hu_tools as never)[0].id).toBe('hu-ai-mode');
    expect(matchSituation('summary', T.hu_tools as never)[0].id).toBe('hu-ai-verify');
    expect(matchSituation('nope', T.hu_tools as never)).toEqual([]);
  });
  it('is deterministic and breaks ties by sort, then id; it ranks content only (no person input)', () => {
    const cards = [{ id: 'b', sort: 2, cues: ['mode'] }, { id: 'a', sort: 2, cues: ['mode'] }, { id: 'c', sort: 1, cues: ['mode'] }, { id: 'z', topic: 'ai_automation', sort: 9, cues: ['mode'], drill_ids: ['d1', 'd2'] }];
    const m = matchSituation('mode', cards);
    expect(m.map((x) => x.id)).toEqual(['z', 'c', 'a']);
    expect(m[0].reasons.map((r) => r.code)).toEqual(['cue', 'ai', 'practise']);
    expect(m[0].reasons[2].vars).toEqual({ n: 2 });
    expect(JSON.stringify(matchSituation('mode', cards))).toBe(JSON.stringify(m));
    expect(matchSituation.length).toBeLessThanOrEqual(3); // (situation, cards, max): nothing about the reader
  });
  it('every cue and situation has EN and AR labels', () => {
    for (const c of CUE_IDS) expect(CUES[c].en && AR.test(CUES[c].ar)).toBeTruthy();
    for (const s of SITUATIONS) { expect(get(en, `ai.sit.${s.id}`)).toBeTruthy(); expect(AR.test(String(get(ar, `ai.sit.${s.id}`)))).toBe(true); }
  });
});

describe('FS49 · RBAC on the local backend (existing M08 rules)', () => {
  it('anonymous visitors read every HU card with its links; OE lessons stay staff-only', async () => {
    await as(null);
    const hu = await b.list('hu_tools');
    expect(hu).toHaveLength(12);
    expect(hu.filter((h) => h.topic === 'ai_automation').every((h) => h.drill_ids.length > 0)).toBe(true);
    expect(await b.list('oe_lessons').catch(() => [])).toHaveLength(0);
    await as('k-ro');
    expect((await b.list('oe_lessons', { filter: { topic: 'ai_automation' } })).length).toBe(7);
  });
  it('the training manager (internal_content W) edits an HU card directly; staff with read only cannot', async () => {
    await as('training-mgr');
    const r = await b.update('hu_tools', 'hu-6', { ai_en: 'A tool is not a peer.' });
    expect(r.ok).toBe(true);
    await as('k-ro');
    const r2 = await b.update('hu_tools', 'hu-6', { ai_en: 'changed by a reader' });
    expect(r2.ok).toBe(false);
    expect((await b.get('hu_tools', 'hu-6'))!.ai_en).toBe('A tool is not a peer.');
    await b.reset();
  });
  it('routes: the AI page is for all staff (internal_content R), the lead console needs internal_content W', () => {
    expect(routes.find((x) => x.id === 'my-safety-culture-ai')!.guard).toEqual({ signedIn: true, grant: { res: 'internal_content', levels: ['R'] } });
    expect(routes.find((x) => x.id === 'admin-hu-tools')!.guard).toEqual({ signedIn: true, grant: { res: 'internal_content', levels: ['W'] } });
    expect(SCHEMA.hu_tools.write).toEqual({ mode: 'direct', res: 'internal_content' });
    expect(SCHEMA.oe_lessons.read).toEqual([{ res: 'internal_content' }]);
  });
});

describe('FS49 · seed, coverage tiles, benchmarks and i18n', () => {
  it('lead console tiles: 12 of 12 cards complete and live-linked, 7 of 7 lessons sourced, every published drill linked', () => {
    const c = fs49Coverage(T.hu_tools, T.oe_lessons, T.ai_drills);
    expect(c).toMatchObject({ cards: 12, aiCards: 4, complete: 12, liveLinked: 12, aiLessons: 7, aiLessonsSourced: 7, aiLessonsPublished: 7 });
    expect(c.drillsLinked).toBe(liveDrills.size);
  });
  it('FS49 benchmark chips name IAEA-AI, IAEA-1917 and AI-LIT, all listed in kafaa_benchmarks', () => {
    expect([...FEATURE_BENCHMARKS.FS49].sort()).toEqual(['AI-LIT', 'IAEA-1917', 'IAEA-AI']);
    for (const id of FEATURE_BENCHMARKS.FS49) expect(T.benchmarks.find((x) => x.id === id)?.listed).toBe(true);
  });
  it('new routes and all FS49 strings exist in EN and AR', () => {
    for (const id of ['my-safety-culture-ai', 'admin-hu-tools']) { expect(get(en, `routes.${id}.title`)).toBeTruthy(); expect(AR.test(String(get(ar, `routes.${id}.title`)))).toBe(true); }
    const keys = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    for (const k of keys({ ai: (en as Row).ai, hu: (en as Row).hu, adm: (en as Row).adm })) expect(String(get(ar, k) ?? '').trim(), k).not.toBe('');
  });
  it('nothing in the FS49 content scores, ranks or badges a person', () => {
    const text = JSON.stringify([T.hu_tools, aiLessons, T.sc_traits.filter((t) => t.ai_behaviours.length)]);
    expect(text).not.toMatch(/\b(points?|badges?|leaderboard|streaks?|score)\b/i);
  });
});
