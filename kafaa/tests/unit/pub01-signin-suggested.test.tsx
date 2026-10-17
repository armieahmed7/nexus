// @vitest-environment jsdom
/** PUB-01: /sign-in?next=<path> shows the role cards that can use that page first ("Suggested for what you were doing"), decided by
 *  the route's own guard (linkOpenFor) or, for a public page with a sign-in action, by the grant that action needs. The other cards
 *  stay one click away behind "Show all role cards"; filtering searches every card; without ?next the page is unchanged. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import SignInPage from '../../src/modules/m14/SignInPage';
import { suggestedPersonas } from '../../src/modules/m14/suggestCards';
import { linkOpenFor } from '../../src/routes/linkAccess';
import personas from '../../src/seed/personas.json';

const W = { timeout: 30000 };
type P = { persona: string; roles: string[]; kind: string };
const ALL = ((Array.isArray(personas) ? personas : (personas as { personas: P[] }).personas) as P[]);
const ids = (s: Set<string> | null) => [...(s ?? [])].sort();

describe('PUB-01 · which cards are suggested', () => {
  it('/training: exactly the cards whose roles pass the route guard (instructors and training managers)', () => {
    const s = suggestedPersonas('/training', ALL);
    expect(ids(s)).toEqual(ALL.filter((p) => p.roles.some((r) => r === 'instructor' || r === 'training_manager')).map((p) => p.persona).sort());
    for (const p of ALL) expect(s!.has(p.persona), p.persona).toBe(linkOpenFor('/training', [...p.roles, 'public']));
    expect(s!.has('k-instructor')).toBe(true);
    expect(s!.has('k-student')).toBe(false);
  });
  it('/apply/dnt (public page, sign-in to apply): the applicant cards, which hold the applications grant', () => {
    expect(ids(suggestedPersonas('/apply/dnt', ALL))).toEqual(['k-graduate', 'k-student']);
    expect(ids(suggestedPersonas('/ar/apply/dnt?x=1', ALL))).toEqual(['k-graduate', 'k-student']);
  });
  it('/partner/research: partner and university cards only', () => {
    const s = suggestedPersonas('/partner/research', ALL)!;
    expect(s.size).toBeGreaterThan(0);
    for (const p of ALL.filter((x) => s.has(x.persona))) expect(p.roles.some((r) => ['partner_user', 'partner_admin', 'university'].includes(r)), p.persona).toBe(true);
  });
  it('/my/applications: applicants first (employees may open it too, but the link is theirs)', () => {
    expect(ids(suggestedPersonas('/my/applications', ALL))).toEqual(['k-graduate', 'k-student']);
  });
  it('no suggestion for no next, an external or unknown link, a public page without a sign-in action, or a page every card can open', () => {
    for (const n of [null, '', 'https://example.com', '//evil.example', '/no/such/page', '/careers', '/ask']) expect(suggestedPersonas(n, ALL), String(n)).toBeNull();
  });
});

describe('PUB-01 · the sign-in page', () => {
  it('/sign-in?next=/training lists the training cards first and hides the rest behind "Show all role cards"', async () => {
    await renderPage(<SignInPage />, { path: '/sign-in?next=/training' });
    await waitFor(() => expect(screen.getByTestId('signin-suggested').textContent).toContain('Suggested for what you were doing'), W);
    expect(screen.getByTestId('signin-suggested').textContent).toContain('Training admin');
    expect(screen.getByTestId('persona-k-instructor')).toBeTruthy();
    expect(screen.getByTestId('persona-training-mgr')).toBeTruthy();
    const others = screen.getByTestId('signin-other-cards');
    expect(others.hidden).toBe(true);
    expect(within(others).getByTestId('persona-k-student')).toBeTruthy();
    // the suggested cards come before the button, the others after it
    const btn = screen.getByTestId('signin-show-all');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.compareDocumentPosition(screen.getByTestId('persona-k-instructor')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    fireEvent.click(btn);
    expect(others.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent).toBe('Hide the other role cards');
  }, 90000);
  it('Arabic: /ar/sign-in?next=/apply/dnt suggests the student and graduate cards', async () => {
    await renderPage(<SignInPage />, { path: '/ar/sign-in?next=/apply/dnt' });
    await waitFor(() => expect(screen.getByTestId('signin-suggested').textContent).toContain('مقترحة لما كنت تفعله'), W);
    expect(screen.getByTestId('signin-show-all').textContent).toBe('عرض كل بطاقات الأدوار');
    const others = screen.getByTestId('signin-other-cards');
    expect(within(others).queryByTestId('persona-k-student')).toBeNull();
    expect(within(others).getByTestId('persona-k-instructor')).toBeTruthy();
  }, 90000);
  it('typing in the filter searches every card (no split)', async () => {
    await renderPage(<SignInPage />, { path: '/sign-in?next=/training' });
    await waitFor(() => screen.getByTestId('signin-suggested'), W);
    fireEvent.change(screen.getByPlaceholderText('Filter role cards'), { target: { value: 'student' } });
    await waitFor(() => expect(screen.queryByTestId('signin-suggested')).toBeNull(), W);
    expect(screen.getByTestId('persona-k-student')).toBeTruthy();
  }, 90000);
  it('without ?next the page lists every card as before', async () => {
    await renderPage(<SignInPage />, { path: '/sign-in' });
    await waitFor(() => screen.getByTestId('persona-k-licensing-coord'), W);
    expect(screen.queryByTestId('signin-suggested')).toBeNull();
    expect(screen.queryByTestId('signin-show-all')).toBeNull();
    expect(screen.getByTestId('persona-k-student')).toBeTruthy();
  }, 90000);
});
