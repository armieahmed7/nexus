// @vitest-environment jsdom
/** F03/F04 pages rendered with the real providers and the in-memory LocalBackend. */
import { describe, expect, it } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MySkillsPage from '../../src/modules/m17/MySkillsPage';
import WalletPage from '../../src/modules/m17/WalletPage';
import VerifyBadgePage from '../../src/modules/m17/VerifyBadgePage';
import TeamPassportPage from '../../src/modules/m17/TeamPassportPage';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const WAIT = { timeout: 8000 };

describe('F03 /my/skills', () => {
  it('k-ro sees all RO-required competencies with level and basis; a Verified chip opens a drawer naming the qualification record', async () => {
    await renderPage(<MySkillsPage />, { persona: 'k-ro', path: '/my/skills' });
    const table = await screen.findByTestId('m17-skills', {}, WAIT);
    const req = T.role_competencies.filter((r) => r.role_id === 'reactor-operator');
    const rows = within(table).getAllByRole('row').filter((r) => r.getAttribute('data-required') === 'yes');
    expect(rows).toHaveLength(req.length);
    for (const r of rows) expect(r.querySelector('[data-basis]')?.getAttribute('data-basis')).toMatch(/verified|evidenced|validated|claimed/);
    fireEvent.click(screen.getByTestId('m17-basis-verified-sk-pf-01'));
    const drawer = await screen.findByTestId('m17-evidence-drawer', {}, WAIT);
    expect(drawer.textContent).toContain('qr-p-k-ro-qs-ro');
    expect(drawer.textContent).toMatch(/As recorded in .* on /);
    expect(screen.getByTestId('m17-radar-table')).toBeTruthy();
    expect(within(screen.getByTestId('m17-strengths')).getAllByRole('listitem')).toHaveLength(3);
  }, 20000);
  it('the claim form never offers security competencies', async () => {
    await renderPage(<MySkillsPage />, { persona: 'k-ro', path: '/my/skills' });
    fireEvent.click(await screen.findByTestId('m17-add-claim', {}, WAIT));
    const form = await screen.findByTestId('m17-claim-form', {}, WAIT);
    const opts = Array.from(form.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(opts).toContain('sk-da-01');
    expect(opts).not.toContain('sk-sa-01');
  }, 20000);
  it('Arabic: the radar is mirrored, labelled in Arabic and uses the digit preference', async () => {
    localStorage.setItem('kafaa.prefs.v1', JSON.stringify({ digits: 'arab' }));
    await renderPage(<MySkillsPage />, { persona: 'k-ro', path: '/ar/my/skills' });
    const radar = await screen.findByTestId('m17-radar', {}, WAIT);
    expect(radar.querySelector('svg')?.getAttribute('data-dir')).toBe('rtl');
    const table = within(radar).getByTestId('m17-radar-table');
    expect(table.textContent).toMatch(/[٠-٩]/);
    expect(table.textContent).toMatch(/[؀-ۿ]{3,}/);
    localStorage.removeItem('kafaa.prefs.v1');
  }, 20000);
  it('a manager opens a crew member\'s passport read-only (no claim button)', async () => {
    await renderPage(<TeamPassportPage />, { persona: 'sro', path: '/team/passport/w-ro-01', route: '/team/passport/:personId' });
    await screen.findByTestId('m17-skills', {}, WAIT);
    expect(screen.queryByTestId('m17-add-claim')).toBeNull();
  }, 20000);
});

describe('F04 wallet and verification', () => {
  it('the wallet shows signed badges and eligible sources; issuing adds a verified card', async () => {
    await renderPage(<WalletPage />, { persona: 'k-ro', path: '/my/skills/wallet' });
    const wallet = await screen.findByTestId('m17-wallet', {}, WAIT);
    expect(within(wallet).getAllByTestId('m17-badge-card').length).toBeGreaterThanOrEqual(1);
    expect(within(wallet).getAllByTestId('m17-sig').every((x) => x.getAttribute('data-sig') === 'valid')).toBe(true);
    const tr = T.training_records.find((t) => t.person_id === 'p-k-ro' && t.course_id === 'c-scwe').id;
    fireEvent.click(screen.getByTestId(`m17-issue-${tr}`));
    const dialog = await screen.findByRole('dialog', {}, WAIT);
    fireEvent.click(within(dialog).getAllByRole('button').find((b) => /Issue badge/.test(b.textContent ?? ''))!);
    await waitFor(() => expect(screen.getAllByTestId('m17-badge-card').length).toBeGreaterThanOrEqual(2), WAIT);
  }, 20000);
  it('the public verify page checks a shared badge, and a tampered download shows "Signature invalid"', async () => {
    const bd = T.badges.find((b) => b.person_id === 'p-k-ro');
    await renderPage(<VerifyBadgePage />, { path: `/verify/badge/${bd.public_slug}`, route: '/verify/badge/:id' });
    const res = await screen.findByTestId('m17-verify-result', {}, WAIT);
    expect(res.getAttribute('data-outcome')).toBe('valid');
    expect(res.getAttribute('data-status')).toBe('active');
    expect(res.textContent).toContain('RO');
    expect(res.textContent).not.toContain(T.people.find((p) => p.id === 'p-k-ro').display_name);
    const tampered = JSON.parse(JSON.stringify(bd.credential));
    tampered.validUntil = '2099-01-01T00:00:00Z';
    const box = screen.getByTestId('m17-verify-file');
    fireEvent.change(within(box).getByRole('textbox'), { target: { value: JSON.stringify(tampered) } });
    fireEvent.click(screen.getByTestId('m17-verify-check'));
    const out = await screen.findByTestId('m17-file-outcome', {}, WAIT);
    expect(out.getAttribute('data-outcome')).toBe('invalid_signature');
    expect(box.textContent).toContain('Signature invalid');
  }, 20000);
});
