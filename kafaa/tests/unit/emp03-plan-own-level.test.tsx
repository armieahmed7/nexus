// @vitest-environment jsdom
/**
 * EMP-03: /my/plan measures the gap from the person's OWN level per competency (their skill states, read the way My levels and the
 * coach read them: the competency's core skill, else the best of its skills), not from what their current role asks for.
 * Checked on k-ro (licensed Reactor Operator, target Senior Reactor Operator): Leading effective teams (ld-01) was shown as
 * "level 0, gap 3" because the RO role does not ask for it; k-ro's own evidence puts them at 2, so the gap is 1.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import seed from '../../src/seed/seed.json';
import { competencyLevels } from '../../src/domain/engines/skills';
import { IMPORTANCE_WEIGHT, ownCompetencyLevels, planGaps, rankPlanSuggestions } from '../../src/modules/m04/plan';
import { translate } from '../../src/i18n';
import { renderPage } from './g1-harness';
import MyPlanPage from '../../src/modules/m04/MyPlanPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
type RC = { id: string; role_id: string; competency_id: string; required_level: number; importance: string };
const ME = 'p-k-ro';
const states = T.person_skills.filter((x) => x.person_id === ME);
const own = ownCompetencyLevels(states as never[], T.skills as never[]);
const gaps = planGaps({ roleComps: T.role_competencies as RC[], targetRoleId: 'senior-reactor-operator', currentRoleId: 'reactor-operator', own });
const by = new Map(gaps.map((g) => [g.competency_id, g]));

describe('EMP-03 · own level per competency (k-ro)', () => {
  it('reads the same levels as SkillsEngine.competencyLevels over active, non-zero skill states', () => {
    const ref = competencyLevels(states.filter((s) => s.active !== false && Number(s.level) > 0) as never[], T.skills as never[]);
    expect([...own.entries()].sort()).toEqual([...ref.entries()].sort());
    expect(own.get('ld-01')).toBe(2);
    expect(own.get('co-01')).toBe(3);
  });

  it('gap = target requirement minus own level; the current role\'s requirement is kept for comparison only', () => {
    expect(by.get('ld-01')).toMatchObject({ required_level: 3, have: 2, evidenced: true, roleAsks: 0, gap: 1 });
    expect(by.get('ld-02')).toMatchObject({ required_level: 4, have: 2, evidenced: true, roleAsks: 0, gap: 2 });
    expect(by.get('co-01')).toMatchObject({ required_level: 4, have: 3, evidenced: true, roleAsks: 3, gap: 1 });
  });

  it('a competency with no evidence counts as 0 and is flagged, never filled in from the current role', () => {
    expect(own.has('ep-01')).toBe(false);
    expect(by.get('ep-01')).toMatchObject({ have: 0, evidenced: false, gap: 3 });
  });

  it('drops competencies already met by the person\'s own level, and sorts by gap, then importance, then id', () => {
    expect(by.has('pf-02')).toBe(false); // SRO needs 3, k-ro is at 3
    for (const g of gaps) expect(g.gap).toBeGreaterThan(0);
    for (let i = 1; i < gaps.length; i++) {
      const a = gaps[i - 1], b = gaps[i];
      expect(a.gap > b.gap || (a.gap === b.gap && IMPORTANCE_WEIGHT[a.importance] >= IMPORTANCE_WEIGHT[b.importance])).toBe(true);
    }
    expect(gaps[0].competency_id).toBe('ep-01');
  });

  it('the ranker scores courses with the real gap: a leadership course is worth gap 2 x core 3 on ld-02, not the old 4 x 3', () => {
    const out = rankPlanSuggestions({ gaps, courses: T.courses as never[], planned: new Set(), enrolments: [], roleId: 'reactor-operator', limit: 200 });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(s.score).toBe(s.covers.reduce((n, g) => n + by.get(g.competency_id)!.gap * IMPORTANCE_WEIGHT[g.importance], 0));
    const ld = out.find((s) => s.covers.some((g) => g.competency_id === 'ld-02'));
    expect(ld, 'a course building ld-02').toBeTruthy();
    expect(ld!.covers.find((g) => g.competency_id === 'ld-02')!.gap).toBe(2);
  });

  it('someone with no skill evidence at all: every target competency is a full gap, flagged as not evidenced', () => {
    const none = planGaps({ roleComps: T.role_competencies as RC[], targetRoleId: 'senior-reactor-operator', currentRoleId: 'reactor-operator', own: new Map() });
    const target = T.role_competencies.filter((r) => r.role_id === 'senior-reactor-operator');
    expect(none.length).toBe(target.length);
    for (const g of none) expect(g).toMatchObject({ have: 0, evidenced: false, gap: g.required_level });
  });

  it('labels exist in English and Arabic', () => {
    for (const k of ['m04.plan.yourLevel', 'm04.plan.noEvidence', 'm04.plan.levelsUnavailable', 'm04.plan.requiredLevel', 'm04.plan.gapIntro']) {
      expect(translate('en', k)).not.toBe(k);
      expect(translate('ar', k)).not.toBe(k);
    }
    expect(translate('en', 'm04.plan.gapIntro')).toMatch(/your own level/);
  });
});

describe('EMP-03 · /my/plan as k-ro', () => {
  it('shows the own level next to the target requirement, "No evidence yet" where there is none, and the real gap', async () => {
    await renderPage(<MyPlanPage />, { persona: 'k-ro', path: '/my/plan' });
    await waitFor(() => expect(screen.getAllByTestId('m04-plan-own').length).toBeGreaterThan(0), { timeout: 30000 });
    const cell = (comp: string) => screen.getAllByTestId('m04-plan-own').find((e) => e.getAttribute('data-comp') === comp)!;
    expect(cell('ld-01').textContent).toBe('2');
    expect(cell('ep-01').textContent).toBe('No evidence yet');
    const row = cell('ld-01').closest('tr')!;
    expect(within(row).getByText('+1')).toBeTruthy();
    expect(screen.getByText('Your level')).toBeTruthy();
    expect(screen.getByText('Your current role asks for')).toBeTruthy();
    expect(screen.getAllByTestId('m04-plan-own').some((e) => e.getAttribute('data-comp') === 'pf-02')).toBe(false);
  }, 90000);

  it('if the skill states cannot be read, it says so instead of quietly showing every competency as unevidenced', async () => {
    await renderPage(<MyPlanPage />, {
      persona: 'k-ro', path: '/my/plan',
      prepare: (b) => {
        const list = b.list.bind(b);
        vi.spyOn(b, 'list').mockImplementation(((table: string, q?: unknown) => (table === 'person_skills' ? Promise.reject(new Error('denied')) : list(table as never, q as never))) as never);
      },
    });
    await waitFor(() => expect(screen.getByText(/Your own levels could not be loaded/)).toBeTruthy(), { timeout: 30000 });
    expect(screen.getAllByTestId('m04-plan-own').every((e) => e.textContent === 'No evidence yet')).toBe(true);
    vi.restoreAllMocks();
  }, 90000);
});
