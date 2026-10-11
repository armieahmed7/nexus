// @vitest-environment jsdom
/**
 * F30 pages (W4 · E4): My learning record (timeline, provenance, JSON lines export), the explorer for scope (statements, people
 * filter, BM25 search) and analytics roles (aggregate only), the person timeline refusing people outside scope, the statement
 * permalink, the SIMULATED adapters page and the admin test console (profile check and schema-error refusal).
 * Real providers, in-memory LocalBackend (g1-harness).
 */
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 90000 }); // FS wave C QA: seed boot about 27 s
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import MyLearningRecordPage from '../../src/modules/m27/MyLearningRecordPage';
import LrsExplorerPage from '../../src/modules/m27/LrsExplorerPage';
import LrsPersonPage from '../../src/modules/m27/LrsPersonPage';
import LrsStatementPage from '../../src/modules/m27/LrsStatementPage';
import LrsAdaptersPage from '../../src/modules/m27/LrsAdaptersPage';
import LrsConsolePage from '../../src/modules/m27/LrsConsolePage';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const W = { timeout: 15000 };
const crewOf = (id: string) => T.people.find((p) => p.id === id)?.crew;

describe('F30 /my/learning-record', () => {
  it('k-ro sees their own timeline with provenance and can download JSON lines', async () => {
    const urls: string[] = [];
    (URL as any).createObjectURL = vi.fn(() => { urls.push('blob:x'); return 'blob:x'; });
    (URL as any).revokeObjectURL = vi.fn();
    await renderPage(<MyLearningRecordPage />, { persona: 'k-ro', path: '/my/learning-record' });
    const tl = await screen.findByTestId('m27-timeline', {}, W);
    expect(within(tl).getAllByTestId('m27-why').length).toBeGreaterThan(0);
    fireEvent.click(within(tl).getAllByTestId('m27-why')[0]);
    expect(await screen.findByTestId('m27-why-panel')).toBeTruthy();
    fireEvent.click(within(tl).getAllByTestId('m27-open')[0]);
    expect((await screen.findByTestId('m27-json')).textContent).toContain('"homePage": "https://kafaa.example"');
    expect(screen.getByTestId('m27-json').textContent).not.toMatch(/mbox/);
    fireEvent.click(screen.getByTestId('m27-export'));
    await waitFor(() => expect(urls.length).toBe(1));
    const b = getLocalBackend();
    expect([...b.raw('audit_events')].pop()).toMatchObject({ action: 'lrs.export', outcome: 'ok' });
  });
});

describe('F30 /training/lrs explorer', () => {
  it('a shift manager sees statements for crew B only and can search them', async () => {
    await renderPage(<LrsExplorerPage />, { persona: 'sro', path: '/training/lrs' });
    const table = await screen.findByTestId('m27-statements', {}, W);
    const people = [...(screen.getByTestId('m27-f-person') as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);
    expect(people.length).toBeGreaterThan(0);
    expect(people.every((p) => p === 'p-sro' || crewOf(p) === 'B')).toBe(true);
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    fireEvent.change(screen.getByTestId('m27-search'), { target: { value: 'mentoring' } });
    await waitFor(() => expect(within(screen.getByTestId('m27-statements')).getAllByRole('row').length).toBeGreaterThan(1));
    expect(screen.queryByRole('tab', { name: /^Analytics$/ })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Statements$/ })).toBeTruthy();
  });
  it('an HR analyst sees the aggregate (suppressed under 10) and no statement rows', async () => {
    await renderPage(<LrsExplorerPage />, { persona: 'k-hr-analyst', path: '/training/lrs' });
    expect(await screen.findByTestId('m27-top', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m27-statements')).toBeNull();
    expect(screen.getAllByText(/<10/).length).toBeGreaterThan(0);
  });
});

describe('F30 person timeline and statement page', () => {
  it('a manager is refused a person outside scope', async () => {
    const crewA = T.xapi_statements.find((s) => crewOf(s.actor_person_id) === 'A')!.actor_person_id;
    await renderPage(<LrsPersonPage />, { persona: 'sro', path: `/training/lrs/people/${crewA}`, route: '/training/lrs/people/:personId' });
    expect(await screen.findByTestId('m27-person-refused', {}, W)).toBeTruthy();
  });
  it('the same manager reads a crew B timeline', async () => {
    const crewB = T.xapi_statements.find((s) => crewOf(s.actor_person_id) === 'B' && s.actor_person_id !== 'p-sro')!.actor_person_id;
    await renderPage(<LrsPersonPage />, { persona: 'sro', path: `/training/lrs/people/${crewB}`, route: '/training/lrs/people/:personId' });
    expect(await screen.findByTestId('m27-timeline', {}, W)).toBeTruthy();
  });
  it('a statement permalink shows the xAPI JSON to its owner', async () => {
    const st = T.xapi_statements.find((s) => s.actor_person_id === 'p-k-ro')!;
    await renderPage(<LrsStatementPage />, { persona: 'k-ro', path: `/training/lrs/statements/${st.id}`, route: '/training/lrs/statements/:statementId' });
    expect((await screen.findByTestId('m27-json', {}, W)).textContent).toContain(st.id);
  });
});

describe('F30 adapters and admin console', () => {
  it('adapters page is SIMULATED and shows the connector, API and profile', async () => {
    await renderPage(<LrsAdaptersPage />, { persona: 'k-admin', path: '/training/lrs/adapters' });
    expect(await screen.findByTestId('m27-connector', {}, W)).toBeTruthy();
    expect(screen.getByTestId('m27-api')).toBeTruthy();
    expect(screen.getByTestId('m27-rules')).toBeTruthy();
    expect(screen.getByTestId('m27-sample').textContent).toContain('X-Experience-API-Version: 2.0.0');
  });
  it('the console flags an email actor and the server refuses it with a schema error; a valid statement is stored', async () => {
    await renderPage(<LrsConsolePage />, { persona: 'k-admin', path: '/training/lrs/console' });
    const tpl = await screen.findByTestId('m27-templates', {}, W);
    fireEvent.click(within(tpl).getAllByRole('button')[1]);
    await waitFor(() => expect(within(screen.getByTestId('m27-check')).getAllByRole('listitem').length).toBeGreaterThan(0));
    const b = getLocalBackend();
    const n = b.raw('xapi_statements').length;
    const confirmStore = async () => {
      fireEvent.click(screen.getByTestId('m27-store'));
      const dlg = await screen.findByRole('dialog', {}, W);
      fireEvent.click(within(dlg).getByRole('button', { name: /^Store statement$/ }));
    };
    await confirmStore();
    await waitFor(() => expect([...b.raw('audit_events')].pop()).toMatchObject({ action: 'lrs.store', outcome: 'refused' }), W);
    expect(b.raw('xapi_statements').length).toBe(n);
    fireEvent.click(within(tpl).getAllByRole('button')[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), W);
    await confirmStore();
    await waitFor(() => expect(b.raw('xapi_statements').length).toBe(n + 1), W);
    expect(await screen.findByTestId('m27-stored', {}, W)).toBeTruthy();
  });
});
