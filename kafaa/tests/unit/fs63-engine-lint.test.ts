/**
 * FS55 acceptance "every ranked surface has an engine card", enforced by a lint over the source tree. The TypeScript parser walks
 * src/ and discovers:
 *  - every exported function (or exported const arrow) that returns Ranked results or is named rank*, match*, suggest*, recommend*;
 *  - every Dalil answer engine (a class that implements AnswerEngine);
 *  - every file that calls useEngine() (asks the engine kernel for a surface's weights).
 * Each discovery must be claimed by an entry of RANKED_SURFACES (src/modules/m16/surfaces.ts), and each entry's card must exist in the
 * seed with every claimed function in its scoring_functions, its route registered and its references resolving. Two short, reviewed
 * lists cover what is not a surface of its own: the engine-kernel primitives (claimed only while every file that uses them is claimed)
 * and helpers that wrap a ranking another card already explains. A new ranked surface without a card fails this test.
 */
import type TS from 'typescript';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { ROUTES, routeForPath } from '../../src/routes/registry';
import { FS_SURFACES } from '../../src/domain/engines';
import { F24_ADDED_FUNCTIONS, FS55_CARDS, KERNEL_SURFACES, NAMED_SURFACES, NO_FAIRNESS, RANKED_SURFACES, RANKS, SURFACE_METRICS } from '../../src/modules/m16/surfaces';
import { CARD_IDS, EXCLUDED_ON_CARDS } from '../../src/modules/m16/transparency';
import { METRICS } from '../../src/modules/m16/fairness';

/** Loaded through node's require so vitest does not transform (and source-map) the compiler. */
const ts = createRequire(import.meta.url)('typescript') as typeof TS;
type Card = Record<string, any> & { id: string; scoring_functions: string[] };
const S = seed as unknown as { tables: Record<string, any[]> };
const CARDS = S.tables.engine_cards as Card[];
const card = (id: string) => CARDS.find((c) => c.id === id);

const NAME = /^(rank|match|suggest|recommend)([A-Z0-9_]|$)/;
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.(gen|d)\.ts$/.test(f) ? [p] : []; });
const FILES = walk('src').map((p) => p.split('\\').join('/'));

interface Found { fns: string[]; engines: string[]; useEngine: string[]; imports: Map<string, Set<string>>; kernelCalls: Map<string, Set<string>> }
/** Walk the source tree once with the TypeScript parser. imports: exported name -> files that import it from src/domain/engines. */
function discover(): Found {
  const out: Found = { fns: [], engines: [], useEngine: [], imports: new Map(), kernelCalls: new Map() };
  const use = new Set<string>();
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8');
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const exported = (n: TS.Node) => (ts.getCombinedModifierFlags(n as TS.Declaration) & ts.ModifierFlags.Export) !== 0;
    const ranked = (t: TS.TypeNode | undefined) => !!t && /\bRanked\b/.test(t.getText(sf));
    const visit = (n: TS.Node) => {
      if (ts.isFunctionDeclaration(n) && n.name && exported(n) && (ranked(n.type) || NAME.test(n.name.text))) out.fns.push(`${f}#${n.name.text}`);
      if (ts.isVariableStatement(n) && exported(n)) for (const d of n.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && (ranked(init.type) || NAME.test(d.name.text))) out.fns.push(`${f}#${d.name.text}`);
      }
      if (ts.isClassDeclaration(n) && n.name && (n.heritageClauses ?? []).some((h) => h.types.some((t) => t.expression.getText(sf) === 'AnswerEngine'))) out.engines.push(`${f}#${n.name.text}`);
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useEngine') use.add(f);
      // eng.rank.byCosine(...) and friends: kernel primitives reached through useEngine()
      if (ts.isPropertyAccessExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'rank') {
        const k = n.name.text; if (!out.kernelCalls.has(k)) out.kernelCalls.set(k, new Set()); out.kernelCalls.get(k)!.add(f);
      }
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && /domain\/engines(\/rank|\/index)?(\.ts)?$/.test(n.moduleSpecifier.text) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
        for (const el of n.importClause.namedBindings.elements) { const k = (el.propertyName ?? el.name).text; if (!out.imports.has(k)) out.imports.set(k, new Set()); out.imports.get(k)!.add(f); }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  out.useEngine = [...use].sort();
  return out;
}
const FOUND = discover();

/** Engine-kernel primitives in src/domain/engines/rank.ts: generic rankers the surfaces call. Claimed while every caller is claimed. */
const KERNEL_PRIMITIVES = ['byGapClosure', 'byCoOccurrence', 'byCosine', 'careerMoves', 'coursesForGaps'];
/** Helpers that only wrap a ranking another card already explains. */
const HELPERS: Record<string, string> = {
  'src/modules/m19/coach.ts#asRanked': 'coach: turns the feed buildCoachFeed already ranked into Ranked items for display',
};
const CLAIMED_FNS = new Set(RANKED_SURFACES.flatMap((s) => s.functions));
const CLAIMED_FILES = new Set([...RANKED_SURFACES.flatMap((s) => s.engineFiles), ...[...CLAIMED_FNS].map((f) => f.split('#')[0])]);
const kernelRef = (n: string) => `src/domain/engines/rank.ts#${n}`;

describe('FS55 lint: every ranked surface in the code has an engine card', () => {
  it('the parser finds the ranking functions, answer engines and useEngine calls (the walk is not empty)', () => {
    expect(FILES.length).toBeGreaterThan(500);
    expect(FOUND.fns.length).toBeGreaterThanOrEqual(30);
    expect(FOUND.engines.length).toBeGreaterThanOrEqual(4);
    expect(FOUND.useEngine.length).toBeGreaterThanOrEqual(20);
  });
  it('every exported ranking function (returns Ranked, or named rank*, match*, suggest*, recommend*) is claimed by a ranked surface', () => {
    const helpers = new Set(Object.keys(HELPERS)), kernel = new Set(KERNEL_PRIMITIVES.map(kernelRef));
    const unclaimed = FOUND.fns.filter((f) => !CLAIMED_FNS.has(f) && !helpers.has(f) && !kernel.has(f));
    expect(unclaimed).toEqual([]);
  });
  it('every Dalil answer engine (implements AnswerEngine) is claimed by a ranked surface', () => {
    expect(FOUND.engines.filter((f) => !CLAIMED_FNS.has(f))).toEqual([]);
  });
  it('every file that calls useEngine() belongs to a ranked surface', () => {
    expect(FOUND.useEngine.filter((f) => !CLAIMED_FILES.has(f))).toEqual([]);
  });
  it('kernel primitives are claimed only while every file that imports or calls them is a claimed surface file', () => {
    for (const k of KERNEL_PRIMITIVES) {
      expect(FOUND.fns, k).toContain(kernelRef(k));
      const users = [...(FOUND.imports.get(k) ?? []), ...(FOUND.kernelCalls.get(k) ?? [])].filter((f) => !f.startsWith('src/domain/engines/'));
      expect(users.filter((f) => !CLAIMED_FILES.has(f)), k).toEqual([]);
    }
  });
  it('helpers still exist and live in a file whose ranker a card already claims', () => {
    for (const h of Object.keys(HELPERS)) { expect(FOUND.fns, h).toContain(h); expect(CLAIMED_FILES.has(h.split('#')[0]), h).toBe(true); }
  });
});

describe('FS55: the registry and the engine cards agree', () => {
  it('every ranked surface has a card in the seed, and every card is a ranked surface (31 = 8 F24 + 23 FS55)', () => {
    expect(RANKED_SURFACES.map((s) => s.card).sort()).toEqual(CARDS.map((c) => c.id).sort());
    expect(new Set(RANKED_SURFACES.map((s) => s.card)).size).toBe(RANKED_SURFACES.length);
    expect(RANKED_SURFACES.filter((s) => s.wave === 'F24').map((s) => s.card).sort()).toEqual([...CARD_IDS].sort());
    expect(FS55_CARDS).toHaveLength(23);
  });
  it('every claimed function is on its card\'s scoring_functions, and every TypeScript function on a card resolves to an export', () => {
    for (const s of RANKED_SURFACES) for (const f of s.functions) expect(card(s.card)!.scoring_functions, `${s.card}: ${f}`).toContain(f);
    for (const [id, fns] of Object.entries(F24_ADDED_FUNCTIONS)) for (const f of fns) expect(card(id)!.scoring_functions, `${id}: ${f}`).toContain(f);
    const discovered = new Set([...FOUND.fns, ...FOUND.engines]);
    for (const c of CARDS) for (const f of c.scoring_functions.filter((x) => !x.startsWith('sql:'))) {
      const [file, name] = f.split('#');
      expect(existsSync(file), `${c.id}: ${file}`).toBe(true);
      const src = readFileSync(file, 'utf8');
      expect(discovered.has(f) || new RegExp(`export\\s+(async\\s+)?(function|const|class)\\s+${name}\\b`).test(src), `${c.id}: ${f}`).toBe(true);
    }
  });
  it('every engineFiles entry exists and calls useEngine(); every route is registered; card fields match the registry', () => {
    for (const s of RANKED_SURFACES) {
      for (const f of s.engineFiles) expect(FOUND.useEngine, `${s.card}: ${f}`).toContain(f);
      expect(routeForPath(s.route), `${s.card}: ${s.route}`).not.toBeNull();
      const c = card(s.card)!;
      expect(c.route, s.card).toBe(s.route);
      expect(c.engine_surface, s.card).toBe(s.stored);
      expect(c.kernel_surface, s.card).toBe(s.kernel);
      expect(c.ranks, s.card).toBe(s.ranks);
      expect(KERNEL_SURFACES).toContain(s.kernel);
      expect(RANKS).toContain(s.ranks);
      if ('none' in s.fairness) { expect(NO_FAIRNESS).toContain(s.fairness.none); expect([c.fairness_metric, c.fairness_none], s.card).toEqual([null, s.fairness.none]); }
      else { const m = 'f24' in s.fairness ? s.fairness.f24 : s.fairness.metric; expect([c.fairness_metric, c.fairness_none], s.card).toEqual([m, null]); }
    }
    expect(ROUTES.length).toBeGreaterThan(100);
  });
  it('transform and assess are defaults only: their cards sit on a stored slot and the kernel surface names the default', () => {
    for (const s of RANKED_SURFACES.filter((x) => x.kernel === 'transform' || x.kernel === 'assess')) {
      expect(FS_SURFACES).toContain(s.kernel);
      expect(['skills', 'recommend', 'match', 'search']).toContain(s.stored);
    }
    expect(S.tables.engine_settings.map((e) => e.id).sort()).toEqual(['match', 'recommend', 'search', 'skills']);
  });
  it('the surfaces FS55 names (digest, Dalil career mode, pathways, externals, translator, fitness check, future gigs) each have a bilingual card with sources', () => {
    for (const id of NAMED_SURFACES) {
      const c = card(id);
      expect(c, id).toBeTruthy();
      for (const f of ['title', 'purpose', 'owner', 'output', 'oversight', 'limitations']) expect(c![`${f}_en`] && c![`${f}_ar`], `${id}.${f}`).toBeTruthy();
      expect(c!.owner_ar, id).toMatch(/[\u0600-\u06FF]/);
      expect(c!.inputs_excluded, id).toEqual([...EXCLUDED_ON_CARDS]);
      expect(c!.inputs_used.length, id).toBeGreaterThan(0);
      expect(c!.sources.length, id).toBeGreaterThan(0);
      expect(c!.sources.every((s: any) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of)), id).toBe(true);
    }
  });
  it('every FS55 fairness metric points at an FS55 card that declares it, and F24 metrics stay with F24', () => {
    for (const m of SURFACE_METRICS) { expect(FS55_CARDS).toContain(m.card); expect(card(m.card)!.fairness_metric, m.metric).toBe(m.metric); }
    const f24 = new Set(METRICS.map((m) => m.metric));
    for (const s of RANKED_SURFACES) if ('f24' in s.fairness) expect(f24.has(s.fairness.f24 as never), s.card).toBe(true);
  });
  it('the lint catches a new ranker without a card (control)', () => {
    const fake = 'src/modules/m99/new.ts#rankSomething';
    const unclaimed = [...FOUND.fns, fake].filter((f) => !CLAIMED_FNS.has(f) && !(f in HELPERS) && !KERNEL_PRIMITIVES.map(kernelRef).includes(f));
    expect(unclaimed).toEqual([fake]);
    expect(NAME.test('rankSomething') && NAME.test('suggestFor') && !NAME.test('ranking') && !NAME.test('matches')).toBe(true);
  });
});
