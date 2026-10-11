// @vitest-environment jsdom
/** FS31 / FS32 / FS33 pages (FS wave D · E3): future-skills credentials and one credential with "where it takes you", the strategic
 * tier for training staff, my learner record with the three-step consent share, the public verify page (active, expired, revoked),
 * my skill goals with the editor and withdraw, the manager's view of shared goals, and the goals strip on the passport; EN and AR. */
import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import FutureCredsPage from '../../src/modules/m17/FutureCredsPage';
import CredentialPage from '../../src/modules/m17/CredentialPage';
import StrategicTierPage from '../../src/modules/m17/StrategicTierPage';
import MyRecordPage from '../../src/modules/m17/MyRecordPage';
import VerifyRecordPage from '../../src/modules/m17/VerifyRecordPage';
import MyGoalsPage from '../../src/modules/m17/MyGoalsPage';
import TeamGoalsPage from '../../src/modules/m17/TeamGoalsPage';
import TeamPassportPage from '../../src/modules/m17/TeamPassportPage';
import en from '../../src/i18n/m17.en.json';
import ar from '../../src/i18n/m17.ar.json';

type Row = Record<string, any>;
const T = { timeout: 20000 };
const S = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const tok = (id: string) => S.record_shares.find((s) => s.id === id)!.token as string;
const chips = (root: HTMLElement) => Array.from(root.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));

describe('/my/skills/credentials/future (FS31)', () => {
  it('k-ro sees the strategic tier (3) and five more, the AI pilot open to them with reasons, and the FS31 benchmarks', async () => {
    const { container } = await renderPage(<FutureCredsPage />, { path: '/my/skills/credentials/future', persona: 'k-ro' });
    const tier = await screen.findByTestId('m17-fc-tier', {}, T);
    expect(within(tier).getAllByTestId('m17-fc-card').map((c) => c.getAttribute('data-code')).sort()).toEqual(['MC-AI-ASSURER', 'MC-DATA-DECISIONS', 'MC-TWINS']);
    expect(within(screen.getByTestId('m17-fc-more')).getAllByTestId('m17-fc-card')).toHaveLength(5);
    const pilot = within(screen.getByTestId('m17-fc-gigs')).getAllByTestId('m17-fc-unlock').find((x) => x.getAttribute('data-target') === 'opp-governed-ai-pilot')!;
    expect(pilot.getAttribute('data-unlocked')).toBe('yes');
    expect(within(pilot).getByTestId('m17-fc-why')).toBeTruthy();
    await waitFor(() => expect(chips(container)).toEqual(expect.arrayContaining(['benchmark-chip-1EDTECH', 'benchmark-chip-CORP', 'benchmark-chip-JAHIZ'])), T);
  });
  it('a non-holder sees the same gig locked', async () => {
    await renderPage(<FutureCredsPage />, { path: '/my/skills/credentials/future', persona: 'buyer' });
    const gigs = await screen.findByTestId('m17-fc-gigs', {}, T);
    expect(within(gigs).getAllByTestId('m17-fc-unlock').find((x) => x.getAttribute('data-target') === 'opp-governed-ai-pilot')!.getAttribute('data-unlocked')).toBe('no');
  });
  it('renders in Arabic', async () => {
    await renderPage(<FutureCredsPage />, { path: '/ar/my/skills/credentials/future', persona: 'k-ro' });
    await screen.findByTestId('m17-fc-tier', {}, T);
    expect(screen.getByText(ar.routes['my-skills-credentials-future'].title)).toBeTruthy();
    expect(screen.getAllByText(ar.fc.strategic, { exact: false }).length).toBeGreaterThan(0);
  });
});

describe('/my/skills/credentials/c/:code (FS31)', () => {
  it('shows criteria, how to earn each (content routes) and where the credential takes you', async () => {
    await renderPage(<CredentialPage />, { path: '/my/skills/credentials/c/MC-AI-ASSURER', route: '/my/skills/credentials/c/:code', persona: 'k-ro' });
    const one = await screen.findByTestId('m17-fc-one', {}, T);
    expect(one.getAttribute('data-code')).toBe('MC-AI-ASSURER');
    expect(screen.getByTestId('m17-fc-strategic')).toBeTruthy();
    const routes = screen.getByTestId('m17-fc-routes');
    for (const li of within(routes).getAllByRole('listitem').filter((x) => x.hasAttribute('data-key'))) expect(Number(li.getAttribute('data-routes'))).toBeGreaterThan(0);
    const takes = screen.getByTestId('m17-fc-takes');
    expect(within(takes).getAllByTestId('m17-fc-unlock').length).toBeGreaterThan(0);
    expect((await screen.findByTestId('m17-fc-credential', {}, T)).getAttribute('data-sig')).toBe('valid');
  });
  it('MC-TWINS shows its versions (v1 superseded); an unknown code is a clear empty state', async () => {
    await renderPage(<CredentialPage />, { path: '/my/skills/credentials/c/MC-TWINS', route: '/my/skills/credentials/c/:code', persona: 'k-ro' });
    expect((await screen.findByTestId('m17-fc-versions', {}, T)).textContent).toContain(en.mc.defStatus.superseded);
    cleanup();
    await renderPage(<CredentialPage />, { path: '/my/skills/credentials/c/MC-NONE', route: '/my/skills/credentials/c/:code', persona: 'k-ro' });
    expect(await screen.findByText(en.fc.notFound, {}, T)).toBeTruthy();
  });
});

describe('/training/credentials/strategic (FS31)', () => {
  it('training manager: the report with suppression, the tier toggles (confirm with a reason) and the unlocks', async () => {
    await renderPage(<StrategicTierPage />, { path: '/training/credentials/strategic', persona: 'training-mgr' });
    const rep = await screen.findByTestId('m17-fc-report', {}, T);
    const rows = rep.querySelectorAll('li[data-code]');
    expect(rows.length).toBe(4);
    expect(rep.querySelector('li[data-code="MC-AI-ASSURER"]')!.getAttribute('data-suppressed')).toBe('no');
    expect(rep.querySelector('li[data-code="MC-TWINS"]')!.getAttribute('data-suppressed')).toBe('yes');
    expect(screen.getByTestId('m17-fc-adm-unlocks')).toBeTruthy();
    const tier = screen.getByTestId('m17-fc-adm-tier');
    fireEvent.click(within(tier.querySelector('[data-code="MC-AI-ASSURER"]') as HTMLElement).getByTestId('m17-fc-adm-toggle'));
    expect(await screen.findByText(en.fc.adm.removeTitle.replace('{code}', 'MC-AI-ASSURER'), {}, T)).toBeTruthy();
  });
  it('a line manager sees the report is not for their role and no toggles', async () => {
    await renderPage(<StrategicTierPage />, { path: '/training/credentials/strategic', persona: 'sro' });
    expect(await screen.findByText(en.fc.adm.reportForbidden, {}, T)).toBeTruthy();
    expect(screen.queryByTestId('m17-fc-adm-toggle')).toBeNull();
  });
});

describe('/my/skills/record (FS32)', () => {
  it('k-ro sees the record by kind, three share links, and walks the three consent steps', async () => {
    const { container } = await renderPage(<MyRecordPage />, { path: '/my/skills/record', persona: 'k-ro' });
    const rec = await screen.findByTestId('m17-lr-record', {}, T);
    expect(within(rec).getAllByTestId('m17-lr-item').length).toBeGreaterThan(5);
    expect(rec.textContent).not.toMatch(/medical|security clearance/i);
    expect(within(screen.getByTestId('m17-lr-links')).getAllByTestId('m17-lr-revoke')).toHaveLength(1); // one active, one expired, one revoked
    const wiz = screen.getByTestId('m17-lr-wizard');
    expect(wiz.getAttribute('data-step')).toBe('choose');
    const next1 = screen.getByTestId('m17-lr-next-1') as HTMLButtonElement;
    expect(next1.disabled).toBe(true);
    const box = within(screen.getByTestId('m17-lr-pick-mc')).getAllByRole('checkbox')[0];
    fireEvent.click(box);
    fireEvent.click(screen.getByLabelText(en.lr.wizard.consentItems.replace('{n}', '1'), { exact: false }));
    fireEvent.click(screen.getByTestId('m17-lr-next-1'));
    await waitFor(() => expect(screen.getByTestId('m17-lr-wizard').getAttribute('data-step')).toBe('preview'), T);
    const prev = screen.getByTestId('m17-lr-preview');
    await waitFor(() => expect(prev.textContent).toContain('RO'), T);
    expect(within(prev).getAllByTestId('m17-lr-item')).toHaveLength(1);
    fireEvent.click(screen.getByLabelText(en.lr.wizard.consentPreview));
    fireEvent.click(screen.getByTestId('m17-lr-next-2'));
    await waitFor(() => expect(screen.getByTestId('m17-lr-wizard').getAttribute('data-step')).toBe('share'), T);
    expect((screen.getByTestId('m17-lr-create') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(en.lr.wizard.label, { exact: false }), { target: { value: 'IAEA expert mission' } });
    fireEvent.click(screen.getByLabelText(en.lr.wizard.consentShare, { exact: false }));
    expect((screen.getByTestId('m17-lr-create') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('m17-lr-create'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, T));
    expect(await screen.findByTestId('m17-lr-made', {}, T)).toBeTruthy();
    await waitFor(() => expect(chips(container)).toEqual(expect.arrayContaining(['benchmark-chip-1EDTECH', 'benchmark-chip-SG-CAREER', 'benchmark-chip-UK-NUC'])), T);
  });
  it('renders in Arabic', async () => {
    await renderPage(<MyRecordPage />, { path: '/ar/my/skills/record', persona: 'k-ro' });
    await screen.findByTestId('m17-lr-record', {}, T);
    expect(screen.getByText(ar.routes['my-skills-record'].title)).toBeTruthy();
    expect(screen.getByText(ar.lr.neverTitle)).toBeTruthy();
  });
});

describe('/verify/record/:token (FS32)', () => {
  it('an active link shows the shared items and initials only (anonymous)', async () => {
    await renderPage(<VerifyRecordPage />, { path: `/verify/record/${tok('rs-kro-digital-rotation')}`, route: '/verify/record/:token', persona: null });
    const v = await screen.findByTestId('m17-lr-verify', {}, T);
    expect(v.getAttribute('data-status')).toBe('active');
    expect(screen.getByTestId('m17-lr-verify-initials').textContent).toBe('RO');
    const n = S.record_shares.find((s) => s.id === 'rs-kro-digital-rotation')!.items.length;
    expect(v.querySelectorAll('li[data-kind]').length).toBe(n);
    expect(v.textContent).not.toContain(S.people.find((p) => p.id === 'p-k-ro')!.display_name);
  });
  it('AC: expired and revoked links show nothing personal; an unknown link is not found', async () => {
    for (const [id, st] of [['rs-kro-mentoring-2026', 'expired'], ['rs-kro-old-draft', 'revoked']]) {
      cleanup();
      await renderPage(<VerifyRecordPage />, { path: `/verify/record/${tok(id)}`, route: '/verify/record/:token', persona: null });
      const v = await screen.findByTestId('m17-lr-verify', {}, T);
      expect(v.getAttribute('data-status')).toBe(st);
      expect(screen.queryByTestId('m17-lr-verify-initials')).toBeNull();
      expect(v.textContent).not.toContain('RO');
      expect(v.querySelectorAll('li[data-kind]').length).toBe(0);
    }
    cleanup();
    await renderPage(<VerifyRecordPage />, { path: `/verify/record/${'0'.repeat(32)}`, route: '/verify/record/:token', persona: null });
    expect((await screen.findByTestId('m17-lr-verify', {}, T)).getAttribute('data-status')).toBe('not_found');
  });
  it('renders in Arabic', async () => {
    await renderPage(<VerifyRecordPage />, { path: `/ar/verify/record/${tok('rs-kro-digital-rotation')}`, route: '/ar/verify/record/:token', persona: null });
    await screen.findByTestId('m17-lr-verify', {}, T);
    expect(screen.getByText(ar.lr.verify.initialsOnly)).toBeTruthy();
  });
});

describe('/my/skills/goals (FS33)', () => {
  it('k-ro sees three goals with dates and status, shares one more, and withdraws one (confirmations each time)', async () => {
    const { container } = await renderPage(<MyGoalsPage />, { path: '/my/skills/goals', persona: 'k-ro' });
    const list = await screen.findByTestId('m17-sg-list', {}, T);
    const goals = within(list).getAllByTestId('m17-sg-goal');
    expect(goals).toHaveLength(3);
    expect(goals.filter((g) => g.getAttribute('data-shared') === 'yes')).toHaveLength(2);
    for (const g of goals) expect(within(g).getByTestId('m17-sg-why')).toBeTruthy();
    expect(screen.getByTestId('m17-sg-coach').textContent).toContain(en.sg.coachGoal.split(':')[0]);
    const priv = goals.find((g) => g.getAttribute('data-shared') === 'no')!;
    fireEvent.click(within(priv).getByTestId('m17-sg-share'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, T));
    await waitFor(() => expect(within(screen.getByTestId('m17-sg-list')).getAllByTestId('m17-sg-goal').filter((g) => g.getAttribute('data-shared') === 'yes')).toHaveLength(3), T);
    const first = within(screen.getByTestId('m17-sg-list')).getAllByTestId('m17-sg-goal')[0];
    const skill = first.getAttribute('data-skill');
    fireEvent.click(within(first).getByTestId('m17-sg-withdraw'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, T));
    await waitFor(() => expect(within(screen.getByTestId('m17-sg-list')).getAllByTestId('m17-sg-goal')).toHaveLength(2), T);
    expect(screen.getByTestId('m17-sg-removed').querySelector(`[data-skill="${skill}"]`)).toBeTruthy();
    await waitFor(() => expect(chips(container)).toEqual(expect.arrayContaining(['benchmark-chip-SG-CAREER', 'benchmark-chip-SKILLS-TECH'])), T);
  });
  it('the editor checks the input before anything is sent (security skills are not offered; a near date is refused)', async () => {
    await renderPage(<MyGoalsPage />, { path: '/my/skills/goals', persona: 'k-ro' });
    await screen.findByTestId('m17-sg-list', {}, T);
    fireEvent.click(screen.getByTestId('m17-sg-add'));
    const ed = await screen.findByTestId('m17-sg-editor', {}, T);
    const sel = ed.querySelector('select') as HTMLSelectElement;
    expect(Array.from(sel.options).some((o) => o.value === 'sk-sa-01')).toBe(false);
    fireEvent.change(sel, { target: { value: 'sk-fs-tr-curiosity' } });
    fireEvent.change(ed.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-10-13' } });
    expect((await screen.findByTestId('m17-sg-problem', {}, T)).textContent).toBe(en.sg.problem.invalid);
    expect((screen.getByTestId('m17-sg-save') as HTMLButtonElement).disabled).toBe(true);
  });
  it('renders in Arabic with the target dates', async () => {
    await renderPage(<MyGoalsPage />, { path: '/ar/my/skills/goals', persona: 'k-ro' });
    const list = await screen.findByTestId('m17-sg-list', {}, T);
    expect(screen.getByText(ar.routes['my-skills-goals'].title)).toBeTruthy();
    expect(list.textContent).toContain(ar.sg.by.split(' ')[0]);
  });
});

describe('/team/skills/goals and the passport strip (FS33)', () => {
  it('the line manager sees only shared goals (k-ro: 2 of 3); HR sees none', async () => {
    await renderPage(<TeamGoalsPage />, { path: '/team/skills/goals', persona: 'sro' });
    const tbl = await screen.findByTestId('m17-sg-team', {}, T);
    const kro = S.skill_goal_plans.filter((p) => p.person_id === 'p-k-ro');
    const privateSkill = S.skills.find((s) => s.id === kro.find((p) => !p.shared)!.skill_id)!;
    expect(tbl.textContent).not.toContain(privateSkill.name_en);
    for (const p of kro.filter((x) => x.shared)) expect(tbl.textContent).toContain(S.skills.find((s) => s.id === p.skill_id)!.name_en);
    cleanup();
    await renderPage(<TeamGoalsPage />, { path: '/team/skills/goals', persona: 'chco' });
    expect((await screen.findAllByText(en.sg.team.empty, {}, T)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('m17-sg-team')).toBeNull();
  });
  it('a manager opening k-ro\'s passport sees the shared goals strip (read-only)', async () => {
    await renderPage(<TeamPassportPage />, { path: '/team/passport/p-k-ro', route: '/team/passport/:personId', persona: 'sro' });
    const strip = await screen.findByTestId('m17-sg-strip', {}, T);
    expect(strip.getAttribute('data-count')).toBe('2');
    expect(screen.queryByTestId('m17-sg-to-goals')).toBeNull();
  });
});
