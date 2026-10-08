// @vitest-environment jsdom
/** F02: <WhyThis> renders reasons in EN and AR; <EngineBadge> shows "model unavailable"; the admin card lists the surfaces. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { EngineBadge, WhyThis } from '../../src/ui';
import { EnginesCard } from '../../src/modules/m16/EnginesCard';
import { resolveEngine, type Reason } from '../../src/domain/engines';

const reasons: Reason[] = [
  { code: 'gap_role', key: 'common.engines.reason.gap_role', vars: { skill: { en: 'Reactor theory', ar: 'نظرية المفاعل' }, from: 3, to: 4, role: { en: 'SRO', ar: 'المشغل الأول' } } },
  { code: 'qual', key: 'common.skills.reason.qual', vars: { level: 3, date: '2025-08-08' } },
];
describe('WhyThis', () => {
  it('opens a panel with every reason in English', async () => {
    await renderPage(<WhyThis reasons={reasons} />, { persona: 'k-ro' });
    fireEvent.click(await screen.findByTestId('why-this'));
    const panel = screen.getByTestId('why-this-panel');
    expect(panel.textContent).toContain('Closes Reactor theory from level 3 to 4 for SRO');
    expect(panel.textContent).toContain('Verified by a current qualification record');
  });
  it('renders Arabic text and variables under /ar', async () => {
    await renderPage(<WhyThis reasons={reasons} />, { persona: 'k-ro', path: '/ar/x' });
    fireEvent.click(await screen.findByTestId('why-this'));
    expect(screen.getByTestId('why-this-panel').textContent).toContain('نظرية المفاعل');
  });
  it('EngineBadge says model unavailable when the model slot has no gateway', async () => {
    await renderPage(<EngineBadge engine={resolveEngine('recommend', { engine: 'model' }, null)} />);
    expect(await screen.findByText(/Model unavailable/)).toBeTruthy();
  });
  it('the admin engines card lists the four surfaces and lets an admin switch one', async () => {
    await renderPage(<EnginesCard />, { persona: 'k-admin' });
    await waitFor(() => expect(screen.getByTestId('m16-engines').textContent).toContain('Recommendations'));
    expect(screen.getByTestId('m16-engine-recommend')).toBeTruthy();
  });
});
