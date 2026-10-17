// @vitest-environment jsdom
/** MGR-01: /team counts the manager's scope, not the whole directory, and /talent/succession tells an HR analyst and a line
 *  manager what their read-only view is. The Crew B shift manager (persona 'sro', p-sro: manager scoped to crew B) saw
 *  "People in scope 106" for a 7-person crew, because the directory is readable far beyond the records. The team is now the people
 *  kafaa_scope_people('qual_records') admits (scopePeople, the same rule RLS and the LocalBackend apply), and k-hr-analyst is no
 *  longer told "HR maintains them". */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { renderPage } from './g1-harness';
import { scopeAssignments, scopePeople, scopedPersonIds } from '../../src/data/scope';
import { AccessContext } from '../../src/data/access';
import type { Identity } from '../../src/data/types';
import type { PlatformRole } from '../../src/auth/policy';
import TeamPage from '../../src/modules/m02/TeamPage';
import SuccessionPage from '../../src/modules/m23/SuccessionPage';

const W = { timeout: 30000 };
type Row = Record<string, unknown>;
const seed = JSON.parse(readFileSync(`${process.cwd()}/src/seed/seed.json`, 'utf8')) as { tables: Record<string, Row[]>; personas: Row[] };
const people = seed.tables.people as { id: string; kind: string; crew?: string | null; team_id?: string | null; entity_id?: string | null; job_family_id?: string | null }[];
const identityOf = (personId: string): Identity => {
  const persona = seed.personas.find((p) => p.person_id === personId)!;
  return {
    personId, personaId: null, orgId: null, roles: persona.roles as PlatformRole[],
    assignments: seed.tables.role_assignments.filter((a) => a.person_id === personId).map((a) => ({ role: a.role as PlatformRole, scope_type: String(a.scope_type), scope_value: (a.scope_value as string) ?? null, status: String(a.status) })),
  };
};
const crewB = people.filter((p) => p.kind === 'staff' && p.crew === 'B').map((p) => p.id).sort();

describe('MGR-01 · scopePeople mirrors kafaa_scope_people', () => {
  it('the Crew B shift manager: themself plus crew B (8 people), not the 107-strong staff directory', () => {
    const s = scopePeople(identityOf('p-sro'), people, 'qual_records');
    expect(s).not.toBe('all');
    expect([...(s as Set<string>)].sort()).toEqual(crewB);
    expect(crewB).toHaveLength(8);
    expect(crewB).toContain('p-sro');
    expect(people.filter((p) => p.kind === 'staff').length).toBeGreaterThan(100);
    expect(scopeAssignments(identityOf('p-sro'), 'qual_records')).toEqual([{ type: 'crew', value: 'B' }]);
  });
  it('a family-scoped manager gets their family; a manager scoped to "all" get everyone', () => {
    const outage = scopePeople(identityOf('p-outage-manager'), people, 'qual_records') as Set<string>;
    expect([...outage].filter((id) => id !== 'p-outage-manager').every((id) => people.find((p) => p.id === id)!.job_family_id === 'outage')).toBe(true);
    expect(scopePeople(identityOf('p-group-ceo'), people, 'qual_records')).toBe('all');
  });
  it('an employee with no Scope sees only themself', () => {
    expect([...(scopePeople(identityOf('p-k-ro'), people, 'qual_records') as Set<string>)]).toEqual(['p-k-ro']);
  });
  it('the narrowing hint (scopedPersonIds) still returns the same superset after the shared matcher refactor', () => {
    expect([...(scopedPersonIds(identityOf('p-sro'), people, ['qual_records']) ?? [])].sort()).toEqual(crewB);
  });
  it('matches the RLS mirror (AccessContext.ruleRead, what the LocalBackend enforces) person by person, for every manager persona', () => {
    const map = new Map(people.map((p) => [p.id, p]));
    for (const pid of ['p-sro', 'p-outage-manager', 'p-work-control', 'p-ops-ceo', 'p-head-sq', 'p-k-hr-analyst', 'p-k-ro', 'p-chco', 'p-group-ceo']) {
      const id = identityOf(pid);
      const ctx = new AccessContext(id, map);
      const s = scopePeople(id, people, 'qual_records');
      for (const p of people) expect(ctx.ruleRead('qual_records', p.id, null, true), `${pid} → ${p.id}`).toBe(s === 'all' || s.has(p.id));
    }
    const s = scopePeople(identityOf('p-sro'), people, 'qual_records') as Set<string>;
    const recPeople = new Set(seed.tables.qual_records.filter((r) => s.has(String(r.person_id))).map((r) => String(r.person_id)));
    expect(recPeople.size).toBe(8); // every crew B member has qualification records, as the /team/quals matrix shows (7 + me)
  });
});

describe('MGR-01 · /team tiles', () => {
  it('sro: "People in scope" is 7 (crew B without me), with the crew name and the crew\'s record count', async () => {
    const recs = seed.tables.qual_records.filter((r) => crewB.includes(String(r.person_id)) && r.person_id !== 'p-sro').length;
    const { container } = await renderPage(<TeamPage />, { persona: 'sro', path: '/team' });
    await waitFor(() => expect(container.textContent).toContain('People in scope'), W);
    const tile = [...container.querySelectorAll('div')].find((d) => d.textContent?.startsWith('People in scope') && d.textContent.includes('qualification records') && d.children.length <= 4)!;
    expect(tile).toBeTruthy();
    expect(tile.textContent).toContain(`Crew B · ${recs} qualification records`);
    expect(tile.textContent).toMatch(/People in scope\s*7(?!\d)/);
    expect(tile.textContent).not.toContain('106');
  }, 90000);
  it('Arabic: the crew name and count in Arabic', async () => {
    const { container } = await renderPage(<TeamPage />, { persona: 'sro', path: '/ar/team' });
    await waitFor(() => expect(container.textContent).toContain('الأشخاص ضمن النطاق'), W);
    expect(container.textContent).toContain('الطاقم B ·');
  }, 90000);
});

describe('MGR-01 · succession copy by role', () => {
  it('k-hr-analyst gets the HR-scope copy, never "HR maintains them"', async () => {
    await renderPage(<SuccessionPage />, { persona: 'k-hr-analyst', path: '/talent/succession' });
    const note = await screen.findByTestId('m23-sx-scope-note', {}, W);
    expect(note.getAttribute('data-view')).toBe('hrScope');
    expect(note.textContent).toContain('HR business partner');
    expect(note.textContent).not.toContain('HR maintains them');
    expect(document.body.textContent).toContain('Your HR scope');
  }, 90000);
  it('a line manager keeps the function copy; the HR director sees no scope note', async () => {
    const r = await renderPage(<SuccessionPage />, { persona: 'emergency-director', path: '/talent/succession' });
    const note = await screen.findByTestId('m23-sx-scope-note', {}, W);
    expect(note.getAttribute('data-view')).toBe('function');
    expect(note.textContent).toContain('HR maintains them');
    r.unmount();
    await renderPage(<SuccessionPage />, { persona: 'chco', path: '/talent/succession' });
    await screen.findByTestId('m23-slates', {}, W);
    expect(screen.queryByTestId('m23-sx-scope-note')).toBeNull();
  }, 90000);
  it('Arabic HR-scope copy', async () => {
    await renderPage(<SuccessionPage />, { persona: 'k-hr-analyst', path: '/ar/talent/succession' });
    const note = await screen.findByTestId('m23-sx-scope-note', {}, W);
    expect(note.textContent).toContain('شريك أعمال للموارد البشرية');
  }, 90000);
});
