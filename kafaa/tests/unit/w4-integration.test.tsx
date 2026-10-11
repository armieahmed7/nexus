/** Wave-4 integration on master: the cross-feature hand-offs wired by the integration lead.
 *   F28 -> F30  simulator crew debriefs emit xAPI statements (one per crew member present), seeded and live
 *   F31 -> F26  the training needs report counts the qualified F31 instructor pool
 *   F25 / F31 -> F29  the accreditation evidence pack links effectiveness (L3) and the instructor pipeline
 *   F25 -> F27  redesign flags reach the SAT workbench
 *   Deploy      the issuer profile is served outside any nested dot-directory and the Netlify rewrite sits above the SPA rule
 * The SQL side (SQL = TS for the seeded f28 statements, no emitter during seeding) is checked by scripts/validate/w4e4-lrs.mjs and
 * scripts/validate/w4qa-integration.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { hasKey, translate } from '../../src/i18n';
import { crewRoster } from '../../src/modules/m04/scenarios';
import { ISSUER_URL, issuerDocument } from '../../src/modules/m17/issuer';
import { issuerKeyUrl } from '../../src/modules/m17/WalletPage';
import type { DemandReportResult } from '../../src/modules/m25/backend/rpc';
import { HAS_REDESIGN } from '../../src/modules/m26/ui';
import { factLabel } from '../../src/modules/m26/accr';
import { EMITTERS, SIM_DIMENSIONS, backfill, containsId } from '../../src/modules/m27/xapi';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const sumOf = (r: Record<string, number>) => SIM_DIMENSIONS.reduce((t, k) => t + Number(r[k] ?? 0), 0);

describe('F28 -> F30: simulator debriefs in the learning record store', () => {
  it('the registry marks the F28 emitter live; F38 is live since W5E1', () => {
    const e = EMITTERS.find((x) => x.source === 'f28_simulator')!;
    expect(e).toMatchObject({ status: 'live', route: '/my/simulator', object_type: 'scenario', verbs: ['completed'] });
    expect(EMITTERS.find((x) => x.source === 'f38_ojt')).toMatchObject({ status: 'live', route: '/my/ojt' }); // W5E1 (F38 live)
    expect(translate('en', 'm27.ex.plannedChip')).toBe('F38 live');
  });
  it('the seed holds exactly one statement per present crew member of every debrief, none for absentees', () => {
    const present = T.crew_debrief_members.filter((m) => m.present === true);
    const sim = T.xapi_statements.filter((s) => s.source === 'f28_simulator');
    expect(present.length).toBeGreaterThan(100);
    expect(sim.length).toBe(present.length);
    expect(new Set(sim.map((s) => s.source_ref))).toEqual(new Set(present.map((m) => m.id)));
    const debriefs = new Map(T.crew_debriefs.map((d) => [d.id, d]));
    for (const s of sim) {
      const m = T.crew_debrief_members.find((x) => x.id === s.source_ref)!;
      const sum = sumOf(debriefs.get(m.debrief_id)!.ratings);
      expect(s).toMatchObject({ actor_person_id: m.person_id, verb: 'completed', object_type: 'scenario', object_id: m.scenario_id });
      expect(s.result).toEqual({ completion: true, success: sum >= 12, score: { scaled: sum / 20, raw: sum / 4, min: 1, max: 5 } });
      expect(s.occurred_at).toBe(`${m.held_on}T12:00:00Z`);
    }
    // the seeded store is still exactly what the emitters produce
    expect(backfill(T).length).toBe(T.xapi_statements.length);
  });
  it('simulator statements carry no exam, secure item or free-text debrief content', () => {
    const secure = T.items.filter((i) => i.bank === 'secure').map((i) => String(i.id));
    for (const s of T.xapi_statements.filter((x) => x.source === 'f28_simulator')) {
      const txt = JSON.stringify(s);
      expect(secure.some((id) => containsId(txt, id))).toBe(false);
      expect(txt).not.toMatch(/critique|strengths|improvements|\bexam(s|ination)?\b/i);
    }
    const int = T.integrations.find((i) => i.id === 'int-lrs')!;
    expect(int.records).toBe(T.xapi_statements.length);
  });
  it('recording a debrief on the local backend appends one statement per present member, idempotently', async () => {
    const d = new Date(Date.now() - 86_400_000);
    b.rawInsert('simulator_slots', { id: 'sim-int-b', simulator: 'FSS-1', starts_at: d.toISOString().replace(/\.\d{3}Z$/, 'Z'), ends_at: new Date(d.getTime() + 8 * 3_600_000).toISOString(), crew: 'B', session_id: null, booking_kind: 'coct', priority: 1, status: 'booked', booked_by: 'p-k-instructor' } as never);
    await as('k-instructor');
    const roster = crewRoster(b.rawGet('simulator_slots', 'sim-int-b') as never, b.raw('people') as never);
    const att = roster.map((r, i) => ({ person_id: r.person_id, present: i !== 0 }));
    const before = b.raw('xapi_statements').filter((s) => s.source === 'f28_simulator').length;
    const ratings = { communication: 4, procedure_use: 3, diagnosis: 2, leadership: 5 };
    const r = await b.rpc.recordDebrief({ slot_id: 'sim-int-b', scenario_id: 'scn-012', attendance: att, ratings });
    expect(r.ok).toBe(true);
    const mine = b.raw('xapi_statements').filter((s) => s.source === 'f28_simulator' && String(s.source_ref).startsWith(r.data!.id));
    expect(mine).toHaveLength(roster.length - 1);
    expect(b.raw('xapi_statements').filter((s) => s.source === 'f28_simulator').length).toBe(before + roster.length - 1);
    expect(mine.some((s) => s.actor_person_id === roster[0].person_id)).toBe(false);
    expect(mine.every((s) => s.object_id === 'scn-012' && (s.result as any).score.scaled === 0.7 && (s.result as any).success === true)).toBe(true);
    // the crew member sees it in their own learning record
    const ro = mine.find((s) => s.actor_person_id === 'p-k-ro');
    expect(ro).toBeTruthy();
    await as('k-ro');
    expect((await b.list('xapi_statements')).some((s: any) => s.id === ro!.id)).toBe(true);
  });
});

describe('F31 -> F26: instructor capacity from the qualified pool', () => {
  it('the needs report counts qualified F31 tracks, not instructor role holders', async () => {
    const pool = new Set(T.instructor_tracks.filter((x) => x.status === 'qualified').map((x) => x.person_id)).size;
    expect(pool).toBeGreaterThanOrEqual(10);
    await as('training-mgr');
    const rep = (await b.rpc.demandReport(null)).data as DemandReportResult;
    expect(rep.instructors).toBe(pool);
    expect(translate('en', 'm25.needs.tile.instructorsSub')).toMatch(/F31/);
    expect(hasKey('m25.needs.tile.instructorsSub')).toBe(true);
  });
});

describe('F25 / F31 -> F29 and F25 -> F27', () => {
  it('the evidence pack links F25 effectiveness and the F31 instructor pipeline for programmes with that data', async () => {
    await as('training-mgr');
    const routes = new Set<string>();
    for (const p of T.accr_programmes) for (const f of (await b.rpc.accrEvidence(p.id))!.facts) routes.add(f.route);
    expect(routes.has('/training/effectiveness')).toBe(true);
    expect(routes.has('/training/instructors')).toBe(true);
  });
  it('F25 redesign flags are readable by the SAT workbench', async () => {
    expect(HAS_REDESIGN).toBe(true);
    expect('instructor_tracks' in SCHEMA && 'l3_observations' in SCHEMA).toBe(true);
    await as('k-instructor');
    expect((await b.list('redesign_flags' as never)).length).toBeGreaterThan(0);
  });
});

describe('Deploy: issuer profile reachable on Netlify', () => {
  it('both published copies equal issuerDocument(); the wallet links the copy outside dot-directories', () => {
    for (const f of ['public/.well-known/kafaa-issuer.json', 'public/issuer/kafaa-issuer.json']) expect(JSON.parse(readFileSync(f, 'utf8'))).toEqual(issuerDocument());
    expect(issuerKeyUrl()).toMatch(/\/issuer\/kafaa-issuer\.json$/);
    expect(ISSUER_URL).toBe('/kafaa/.well-known/kafaa-issuer.json'); // inside signed credentials: unchanged
  });
  it('_redirects rewrites /kafaa/.well-known/* to the deploy root above the SPA rule', () => {
    const rules = readFileSync('public/_redirects', 'utf8').split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const rw = rules.indexOf('/kafaa/.well-known/* /.well-known/:splat 200!');
    expect(rw).toBeGreaterThan(-1);
    expect(rw).toBeLessThan(rules.indexOf('/kafaa/* /kafaa/index.html 200'));
    expect(rules).toContain('/ /kafaa/ 302');
  });
  it('the source index.html keeps the Netlify badge-hiding lines', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('#nl-badge-frame,#nl-hud-frame{display:none!important}');
    expect(html).toContain('<div id="nl-badge-frame" hidden></div>');
  });
});

describe('W4 QA fixes', () => {
  it('evidence labels use the singular for a count of one ("1 session", not "1 sessions")', () => {
    const l = factLabel({ kind: 'programme_records', ref: 'p', route: '/training/schedule', m: { records: 1, passed: 0, sessions: 1 } } as never);
    expect(l.en).toBe('Training records in the last 12 months: 1 completion (0 passed), 1 session');
    expect(factLabel({ kind: 'traceability', ref: 'r', route: '/x', m: { covered: 2, selected: 3, gaps: 1, orphans: 2 } } as never).en).toMatch(/1 gap, 2 orphan objectives$/);
    expect(JSON.stringify(T.accr_assessments)).not.toMatch(/[^0-9]1 (session|gap|course|standard|completion)s\b/);
  });
  it('the redesign-flag status is translated in both languages, with a note when no analysed task links the course', () => {
    for (const k of ['open', 'in_sat', 'closed']) expect(hasKey(`m26.redesign.state.${k}`)).toBe(true);
    expect(translate('ar', 'm26.redesign.state.open')).not.toBe('open');
    expect(hasKey('m26.redesign.noTasks')).toBe(true);
  });
  it('the LRS adapters page shows no brace placeholder in the API table', () => {
    expect(readFileSync('src/modules/m27/LrsAdaptersPage.tsx', 'utf8')).not.toMatch(/\{id\}/);
  });
});

describe('E2E route sweep input', () => {
  it('every route guard (including the M25 constants) parses for the sweep', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(315); // FS wave E QA: + 27 (FS38-FS40 M31 9, FS41-FS43 M32 7, FS44/FS45 M24 4, FS46-FS48 M22 5, FS49 M08 2). FS wave D QA: + 29 (FS27/FS28 M20 6, FS29/FS30 M34 7, FS31-FS33 M17 7, FS34/FS35 M18 2, FS36/FS37 M29 7). FS wave C QA: + 32 (FS17/FS18 M19 6, FS19/FS20 M04 6, FS21/FS22 M05 7, FS23/FS24 M02 7, FS25/FS26 M33 6). FS wave B QA: + 11 (FS09/FS10 5, FS11/FS12 5, FS16 1). FS wave B · E1: + 4 M28 routes (FS07, FS08). W5 QA: 193 + 13 wave-5 routes (M17 1, M02 2, M09 5, M06 3, M07 1, M13 1); FS wave A: + 6 (FS03 M17 2, FS04 M11 1, FS05 M01 2, FS06 M26 1)
    for (const r of R) {
      let d = 0, e = 0;
      for (let i = 0; i < r.guard.length; i++) { if (r.guard[i] === '{') d++; else if (r.guard[i] === '}' && --d === 0) { e = i + 1; break; } }
      expect(() => new Function(`return (${r.guard.slice(0, e)});`)(), r.id).not.toThrow();
    }
  });
});
