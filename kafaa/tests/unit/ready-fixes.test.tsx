// @vitest-environment jsdom
/** [Readiness fixes 2026-10-13] One test group per finding of the readiness review of the live site:
 *   1 mirror clock      licences synced in the demo snapshot stay valid however late the demo runs; the seeded stale one stays stale
 *   2 dashboards        every link /my renders for applicants, partners, observers and the auditor opens for them; the digest offers
 *                       only items whose page the person can open; /my/induction is for employees
 *   3/4 data layer      identical reads running at the same time share one request; a 5xx read is retried once; /learn reads the
 *                       citation registry once; the audit log is read a page at a time
 *   5 m30 reference     a failed job-role read is an error with retry, not "Role not found"; optional lookups are named
 *   6 Arabic data       the Arabic columns are seeded for every English value and rendered by pick()
 *   7 raw i18n key      m21.v2.plannedPill is a string in both languages
 *   9 candidates        /licensing/candidates opens on the programme whose list is due next
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { licenceView, MIRROR_AS_OF, mirrorNow } from '../../src/domain/rules';
import { syncState } from '../../src/domain/g5rules';
import { InFlight, readWithRetry, readKey } from '../../src/data/supabase/readPolicy';
import { SupabaseBackend } from '../../src/data/supabase/SupabaseBackend';
import { ROUTES, routeForPath } from '../../src/routes/registry';
import { ROUTE_GUARDS } from '../../src/routes/guards.gen';
import { guardOfLink, linkOpenFor, rolesOn } from '../../src/routes/linkAccess';
import { canOpen } from '../../src/shell/GuardedLink';
import { buildDigestItems, gatherDigest } from '../../src/shell/digest/rules';
import { localDigestData } from '../../src/shell/digest/backend/local';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { translate } from '../../src/i18n';
import { defaultProgramme } from '../../src/modules/m03/LicensingCandidatesPage';
import { auditQuery } from '../../src/modules/m16/AdminAuditPage';
import { AR } from '../../scripts/seed/ext/zz-ready-integrity.mjs';
import MyPage from '../../src/modules/m14/MyPage';
import { RepoProvider } from '../../src/data';
import type { Repository } from '../../src/data/types';
import { SourcesRegistryProvider, Sources } from '../../src/modules/m04/ui';
import { I18nProvider } from '../../src/i18n';
import { MemoryRouter } from 'react-router-dom';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const personOf = (persona: string) => T.people.find((p) => p.persona_id === persona)!;
const rolesOf = (persona: string, day = '2026-10-13') => rolesOn(T.role_assignments, personOf(persona).id, day);

describe('1 · mirror clock: sync freshness is judged at the demo snapshot', () => {
  const later = new Date('2026-12-01T12:00:00Z');
  it('the clock is the earlier of now and MIRROR_AS_OF', () => {
    expect(MIRROR_AS_OF).toBe('2026-10-08T08:00:00Z');
    expect(mirrorNow(later).toISOString()).toBe('2026-10-08T08:00:00.000Z');
    expect(mirrorNow(new Date('2026-10-07T00:00:00Z')).toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });
  it('seeded licences: every one synced on 8 Oct stays valid weeks later, w-sro-05 (synced 2 Oct) stays the stale example', () => {
    const views = T.licences.map((l) => ({ id: l.id, v: licenceView(l as never, later) }));
    expect(views.filter((x) => x.v.stale).map((x) => x.id)).toEqual(['lic-w-sro-05']);
    expect(views.filter((x) => !x.v.stale).length).toBe(T.licences.length - 1);
    expect(views.filter((x) => x.v.view === 'valid').length).toBeGreaterThanOrEqual(10); // the rest are lapsed or in their renewal window
    expect(licenceView(T.licences.find((l) => l.person_id === 'p-k-ro') as never, later).view).toBe('valid');
  });
  it('a record synced after the snapshot (an RPC sets last_synced = now) is fresh; hours never go negative', () => {
    const v = licenceView({ status: 'valid', expires_on: '2031-01-01', last_synced: '2026-11-30T09:00:00Z' }, later);
    expect(v.stale).toBe(false);
    expect(v.hoursSinceSync).toBe(0);
  });
  it('before the snapshot time the wall clock still applies (the 72-hour rule is unchanged)', () => {
    expect(licenceView({ status: 'valid', expires_on: '2031-01-01', last_synced: '2026-10-01T00:00:00Z' }, new Date('2026-10-08T00:00:00Z')).stale).toBe(true);
    expect(licenceView({ status: 'valid', expires_on: '2031-01-01', last_synced: '2026-10-07T12:00:00Z' }, new Date('2026-10-08T00:00:00Z')).stale).toBe(false);
  });
  it('integrations: only the feeds seeded as stale read stale weeks later (occupational health)', () => {
    const st = T.integrations.map((i) => [i.id, syncState(i as never, later)]);
    expect(st.filter(([, s]) => s === 'stale').map(([id]) => id)).toEqual(['int-ohs']);
  });
  it('the SQL mirror kafaa_mirror_now() caps at the same instant', () => {
    const sql = readFileSync('supabase/migrations/20261013200003_kafaa_ready_mirror_clock.sql', 'utf8');
    expect(sql).toContain(`least(now(), timestamptz '2026-10-08 08:00:00+00')`);
    expect(sql.match(/kafaa_mirror_now\(\) - l\.last_synced > interval '72 hours'/g)?.length).toBe(2);
  });
});

describe('2 · links only to pages the person can open', () => {
  it('guards.gen.ts equals the router registry (path and guard of every route, in order)', () => {
    expect(ROUTE_GUARDS.length).toBe(ROUTES.length);
    ROUTES.forEach((r, i) => {
      const g: Row = {};
      if (r.guard.signedIn) g.signedIn = true;
      if (r.guard.anyRole) g.anyRole = r.guard.anyRole;
      if (r.guard.grant) g.grant = r.guard.grant;
      if (r.guard.noTelemetry) g.noTelemetry = true;
      expect([ROUTE_GUARDS[i][0], ROUTE_GUARDS[i][1]]).toEqual([r.path, g]);
    });
  });
  it('linkOpenFor (digest, SQL mirror) = canOpen (router) for every route, persona and link form', () => {
    const personas = ['k-student', 'k-university', 'k-observer', 'k-auditor', 'k-ro', 'k-hr-analyst', 'k-admin'];
    let n = 0;
    for (const persona of personas) {
      const roles = rolesOf(persona);
      const s = { status: 'signed_in' as const, roles: roles as never };
      for (const r of ROUTES) {
        const path = r.path.replace(/:(\w+)/g, 'x-1');
        for (const link of [path, `/ar${path === '/' ? '' : path}?tab=a#top`]) {
          expect([persona, link, linkOpenFor(link, roles)]).toEqual([persona, link, canOpen(link, s)]);
          n++;
        }
      }
    }
    expect(n).toBe(personas.length * ROUTES.length * 2);
    for (const r of ROUTES) expect(guardOfLink(r.path.replace(/:(\w+)/g, 'x-1'))).toEqual(ROUTE_GUARDS.find(([p]) => p === routeForPath(r.path.replace(/:(\w+)/g, 'x-1'))!.def.path)![1]);
    expect(linkOpenFor('https://example.org/x', ['public'])).toBe(false);
    expect(linkOpenFor('/no/such/page', ['employee', 'public'])).toBe(false);
  });
  it('/my/induction is for employees only (menu and route)', () => {
    expect(ROUTES.find((r) => r.id === 'my-induction')!.guard).toEqual({ signedIn: true, anyRole: ['employee'] });
    for (const p of ['k-student', 'k-graduate', 'k-university', 'k-observer', 'k-contractor']) expect(linkOpenFor('/my/induction', rolesOf(p))).toBe(false);
    expect(linkOpenFor('/my/induction', rolesOf('k-lo-trainee'))).toBe(true);
  });
  it('the digest offers only items whose page the person may open, for every seeded person (TS rules)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    const d = localDigestData(b);
    let dropped = 0;
    for (const p of T.people) {
      const day = '2026-10-13';
      const items = buildDigestItems(d, p.id, day, { muted_kinds: [] });
      const roles = rolesOn(T.role_assignments, p.id, day);
      for (const i of items) expect([p.id, i.link, linkOpenFor(i.link, roles)]).toEqual([p.id, i.link, true]);
      dropped += gatherDigest(d, p.id, day).filter((i) => !linkOpenFor(i.link, roles)).length;
    }
    expect(dropped).toBeGreaterThan(0); // the filter has work to do on the seed (e.g. staff-only links gathered for applicants)
    const student = buildDigestItems(d, personOf('k-student').id, '2026-10-13', { muted_kinds: [] });
    expect(student.some((i) => i.kind === 'opportunity' || i.link.startsWith('/my/skills'))).toBe(false);
  });

  const DASH = ['k-student', 'k-graduate', 'k-university', 'k-contractor', 'k-observer', 'k-auditor', 'k-ro'];
  for (const persona of DASH) {
    it(`/my as ${persona}: every link on the dashboard opens for this persona`, async () => {
      const { container } = await renderPage(<MyPage />, { persona, path: '/my' });
      await screen.findByTestId('m14-my-tiles', undefined, { timeout: 20000 });
      await waitFor(() => expect(container.querySelector('[data-testid="digest-items"], [data-testid="digest-empty"], [data-testid="digest-off"]')).not.toBeNull(), { timeout: 30000 });
      const roles = rolesOf(persona, new Date().toISOString().slice(0, 10));
      const s = { status: 'signed_in' as const, roles: roles as never };
      const links = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!).filter((h) => h.startsWith('/'));
      expect(links.length).toBeGreaterThan(0);
      const dead = links.filter((h) => !canOpen(h, s));
      expect([persona, dead]).toEqual([persona, []]);
      if (['k-student', 'k-graduate'].includes(persona)) {
        expect(links.some((h) => h.startsWith('/my/applications'))).toBe(true);
        expect(links.some((h) => /^\/(my\/(quals|learning|plan)|opportunities\/)/.test(h))).toBe(false);
      }
      if (['k-university', 'k-contractor', 'k-observer'].includes(persona)) expect(screen.getByTestId('m14-my-home-link').getAttribute('href')).toBe(persona === 'k-observer' ? '/observer' : '/partner');
      if (persona === 'k-ro') expect(links).toEqual(expect.arrayContaining(['/my/quals', '/my/learning', '/my/plan', '/my/licence']));
    }, 90000);
  }
});

describe('3/4 · data layer: shared in-flight reads, one retry, one registry read on /learn, a paged audit log', () => {
  it('InFlight shares a running request by key, gives every caller its own copy, and a bump starts fresh', async () => {
    const f = new InFlight();
    let calls = 0;
    let release!: (v: Row[]) => void;
    const start = () => { calls++; return new Promise<Row[]>((res) => { release = res; }); };
    const copy = (rows: Row[]) => rows.map((r) => ({ ...r }));
    const a = f.share('k', start, copy);
    const b = f.share('k', start, copy);
    expect(calls).toBe(1);
    release([{ id: 1 }]);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toEqual(rb);
    expect(ra).not.toBe(rb);
    expect(ra[0]).not.toBe(rb[0]);
    expect(f.size).toBe(0);
    f.share('k', start);
    f.bump();
    f.share('k', start);
    expect(calls).toBe(3);
    expect(readKey('list', 'sources', { order: [['sort', 'asc']], filter: { a: 1, b: 2 } })).toBe(readKey('list', 'sources', { filter: { b: 2, a: 1 }, order: [['sort', 'asc']] }));
  });
  it('readWithRetry sends a 5xx read once more and returns 4xx answers as they are', async () => {
    let n = 0;
    const r = await readWithRetry(async () => (++n === 1 ? { error: { message: 'canceling statement due to statement timeout', code: '57014' }, status: 500, data: null } : { error: null, status: 200, data: [1] }), 0);
    expect([n, r.status]).toEqual([2, 200]);
    let m = 0;
    const r2 = await readWithRetry(async () => { m++; return { error: { message: 'permission denied' }, status: 401, data: null }; }, 0);
    expect([m, r2.status]).toEqual([1, 401]);
    let k = 0;
    const r3 = await readWithRetry(async () => { k++; return { error: { message: 'bad gateway' }, status: 502, data: null }; }, 0);
    expect([k, r3.status]).toEqual([2, 502]);
  });
  it('SupabaseBackend: ten identical list() calls at once send one request; after a write the next read is a new request', async () => {
    const sb = Object.create(SupabaseBackend.prototype) as SupabaseBackend;
    let sent = 0;
    const builder = (): Row => {
      const b: Row = {};
      for (const k of ['select', 'eq', 'in', 'order', 'range', 'neq', 'gte', 'lte', 'or', 'is', 'not', 'ilike', 'contains']) b[k] = () => b;
      b.then = (ok: (v: unknown) => unknown) => { sent++; return new Promise((res) => setTimeout(res, 5)).then(() => ok({ data: [{ id: 's1', accessed: '2026-10-01' }], error: null, status: 200 })); };
      return b;
    };
    Object.assign(sb as unknown as Row, { client: { from: () => builder() }, listeners: new Set(), inflight: new InFlight() });
    const all = await Promise.all(Array.from({ length: 10 }, () => sb.list('sources')));
    expect(sent).toBe(1);
    expect(all.every((r) => r.length === 1 && r[0].id === 's1')).toBe(true);
    (sb as unknown as { emit: (t: string[]) => void }).emit(['sources']);
    await sb.list('sources');
    expect(sent).toBe(2);
  });
  it('/learn: one registry read for any number of <Sources> under SourcesRegistryProvider', async () => {
    const list = vi.fn(async () => [{ id: 's1', label: 'SR2024', url: 'https://example.org', accessed: '2026-10-01' }]);
    const repo = { list, subscribe: () => () => undefined } as unknown as Repository;
    await act(async () => {
      render(
        <MemoryRouter><I18nProvider><RepoProvider repo={repo}><SourcesRegistryProvider>
          {Array.from({ length: 30 }, (_, i) => <Sources key={i} items={[{ id: 's1', label: 'SR2024', url: 'https://example.org' }]} />)}
        </SourcesRegistryProvider></RepoProvider></I18nProvider></MemoryRouter>,
      );
    });
    await waitFor(() => expect(screen.getAllByTestId('m04-sources').length).toBe(30));
    expect(list).toHaveBeenCalledTimes(1);
  });
  it('the audit log filters run in the database (outcome, table, role, ledger, whole UTC days, text search)', () => {
    expect(auditQuery({ q: ' grant ', outcome: 'refused', table: 'people', role: 'admin', ledger: 'written', from: '2026-10-01', to: '2026-10-13' })).toEqual({
      filter: { outcome: 'refused', entity_table: 'people', actor_role: 'admin', ledger_status: 'written', ts: { gte: '2026-10-01T00:00:00Z', lte: '2026-10-13T23:59:59Z' } },
      search: { term: 'grant', columns: ['action', 'entity_id', 'actor_person_id', 'reason'] },
    });
    expect(auditQuery({ q: '', outcome: '', table: '', role: '', ledger: '', from: 'x', to: '' })).toEqual({ filter: {} });
    const src = readFileSync('src/modules/m16/AdminAuditPage.tsx', 'utf8');
    expect(src).toMatch(/limit \}\), \[key, limit\]\)/);
    expect(src).not.toMatch(/repo\.list\('audit_events', \{ order: \[\['seq', 'desc'\]\] \}\)/);
  });
});

describe('5-9 · low findings', () => {
  it('5: m30 useRefData lets a job-role failure reach the error state and names failed optional lookups', () => {
    const src = readFileSync('src/modules/m30/ui.tsx', 'utf8');
    expect(src).toContain("repo.list('job_roles', { order: [['sort', 'asc']] }), opt('families'");
    expect(src).not.toMatch(/safe\(repo\.list\('job_roles'/);
    for (const p of ['CareersTransformationPage', 'MyRole2030Page', 'TaskExposurePage', 'TransformationEditPage', 'WorkforceTransformationPage']) expect(readFileSync(`src/modules/m30/${p}.tsx`, 'utf8')).toContain('<RefGaps');
    for (const lang of ['en', 'ar'] as const) for (const k of ['families', 'skills', 'competencies', 'courses', 'archetypes', 'milestones', 'maps']) expect(translate(lang, `m30.refGaps.part.${k}`)).not.toBe(`m30.refGaps.part.${k}`);
  });
  it('6: every English value of the seven fields has its Arabic in the seed, and the pages pick() it', () => {
    for (const key of Object.keys(AR)) {
      const [table, col] = key.split('.');
      for (const r of T[table]) if (r[col]) expect([r.id, r[`${col}_ar`]]).toEqual([r.id, (AR as Record<string, Record<string, string>>)[key][r[col]]]);
    }
    expect(T.vacancies.find((v) => v.location === 'Barakah, Al Dhafra')!.location_ar).toBe('براكة، منطقة الظفرة');
    expect(readFileSync('src/modules/m01/CareersRolePage.tsx', 'utf8')).toContain("pick(role, 'regulation_ref')");
    expect(readFileSync('src/modules/m04/LearnPage.tsx', 'utf8')).toContain("pick(p, 'population_note')");
    expect(readFileSync('src/modules/m12/parts.tsx', 'utf8')).toContain("pick(fact, 'conflict_note')");
  });
  it('7: the Future Me pill is a string key in both languages', () => {
    expect(translate('en', 'm21.v2.plannedPill')).toBe('Planned');
    expect(translate('ar', 'm21.v2.plannedPill')).toBe('مخطط لها');
    expect(readFileSync('src/modules/m21/v2ui.tsx', 'utf8')).not.toContain("t('m21.v2.planned')");
  });
  it('9: licensing candidates opens on the programme whose candidate list is due next', () => {
    expect(defaultProgramme(T.licence_programmes as never, '2026-10-13')).toBe('lp-coit-2027');
    expect(defaultProgramme(T.licence_programmes as never, '2026-12-01')).toBe('lp-sro-2027a');
    expect(defaultProgramme(T.licence_programmes as never, '2027-06-01')).toBe('lp-sro-2027a');
  });
});
