// @vitest-environment jsdom
/**
 * Orientation (2026-10-17): the future-skills programme explainer (/future-skills) and "Find my route" (/start).
 *  - content: twelve themes in English and Arabic, unique ids, every "Explore" link a registered route, the plan's 84
 *    features each in exactly one theme, benchmark ids from the registry, nothing that presents Kafa'a as a regulator;
 *  - route builder: every audience x goal (x interest x level, x family for employees) gives 4-7 unique steps, each a
 *    registered route with its params, staff steps behind sign-in; employee role families cover every job family once;
 *  - URL state: answers and screen round-trip through the query, unknown values are dropped, a skipped question is shown;
 *  - pages: render in EN and AR; the questionnaire works with the keyboard-friendly radios and writes its state to the URL;
 *  - wiring: public routes in the Learn and Help menus, homepage call to action, links from the help guides.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import FutureSkillsPage from '../../src/modules/m12/FutureSkillsPage';
import StartPage from '../../src/modules/m12/StartPage';
import HomePage from '../../src/modules/m12/HomePage';
import { THEMES, THEME_BANDS, themeBenchmarks } from '../../src/modules/m12/orient/themes';
import {
  FAMILIES, FAMILY_IDS, GOALS, INTERESTS, LEVELS, MAX_STEPS, MIN_STEPS, RECIPES, STEPS, WHO,
  buildRoute, parseAnswers, screenFor, toQuery, type Answers,
} from '../../src/modules/m12/orient/route';
import { GUIDE_BY_ID } from '../../src/modules/m12/help/content';
import type { Bi, HelpLink } from '../../src/modules/m12/help/types';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { ROUTE_BY_ID, href, routeForPath } from '../../src/routes/registry';
import { checkGuard } from '../../src/auth/guards';
import { getLocalBackend } from '../../src/data';
import { renderPage } from './g1-harness';

const AR = /[؀-ۿ]/;
const ANON = { status: 'anon' as const, roles: [] };

function bi(label: string, v: Bi | undefined) {
  expect(v, label).toBeTruthy();
  expect(v!.en.trim().length, `${label} (en)`).toBeGreaterThan(1);
  expect(v!.ar.trim().length, `${label} (ar)`).toBeGreaterThan(1);
  expect(AR.test(v!.ar), `${label}: Arabic text expected`).toBe(true);
  expect(AR.test(v!.en), `${label}: no Arabic in the English text`).toBe(false);
  expect(v!.en).not.toMatch(/\bKafa'a (licen[cs]es|certifies|regulates|approves|qualifies)\b/i);
  expect(v!.en).not.toMatch(/\bKafa'a is (a|the) (regulator|certification body|authority)\b/i);
}
function link(label: string, l: HelpLink) {
  expect(ROUTE_BY_ID[l.route], `${label}: unknown route ${l.route}`).toBeTruthy();
  const path = href(l.route, l.params ?? {});
  expect(path, `${label}: missing params for ${l.route}`).not.toMatch(/:\w|\/\/|.\/$/);
  expect(routeForPath(path)?.def.id, `${label}: ${path} resolves to ${l.route}`).toBe(l.route);
  if (l.route === 'help-guide') expect(GUIDE_BY_ID[l.params!.guide], `${label}: guide ${l.params!.guide}`).toBeTruthy();
  return path;
}

describe('future-skills themes', () => {
  it('has twelve themes with unique ids in the three bands', () => {
    expect(THEMES.length).toBe(12);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(12);
    for (const b of THEME_BANDS) expect(THEMES.some((t) => t.band === b), b).toBe(true);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('theme %s is complete in English and Arabic with valid links and benchmarks', (_id, t) => {
    bi(`${t.id} title`, t.title);
    bi(`${t.id} what`, t.what);
    bi(`${t.id} who`, t.who);
    expect(t.doHere.length).toBeGreaterThanOrEqual(2);
    t.doHere.forEach((d, i) => bi(`${t.id} do ${i + 1}`, d));
    expect(t.explore.length).toBeGreaterThanOrEqual(3);
    expect(new Set(t.explore.map((l) => l.route)).size).toBe(t.explore.length);
    t.explore.forEach((l) => link(t.id, l));
    // Public pages first: the first "Explore" button opens without sign-in.
    expect(checkGuard(ROUTE_BY_ID[t.explore[0].route].guard, ANON)).toBe('ok');
    const bm = themeBenchmarks(t);
    expect(bm.length).toBeGreaterThan(0);
    expect(bm.length).toBeLessThanOrEqual(3);
  });

  it('puts each of the 84 programme features in exactly one theme, and every benchmark id exists in the registry', async () => {
    const all = THEMES.flatMap((t) => t.features);
    expect(all.length).toBe(84);
    expect(new Set(all).size).toBe(84);
    expect([...all].sort()).toEqual(Object.keys(FEATURE_BENCHMARKS).sort());
    const b = getLocalBackend();
    await b.whenReady();
    const ids = new Set((await b.list('benchmarks')).map((r) => r.id));
    for (const t of THEMES) for (const id of themeBenchmarks(t, 99)) expect(ids.has(id), `${t.id}: ${id}`).toBe(true);
  });
});

describe('find my route: builder', () => {
  const combos: Answers[] = [];
  for (const who of WHO)
    for (const goal of GOALS)
      for (const interest of [undefined, ...INTERESTS])
        for (const level of [undefined, ...LEVELS])
          for (const family of who === 'employee' ? FAMILIES : [undefined]) combos.push({ who, goal, interest, level, family });

  it(`gives 4-7 unique steps with valid links for all ${WHO.length * GOALS.length} audience x goal pairs and every option`, () => {
    expect(combos.length).toBe((WHO.length - 1 + FAMILIES.length) * GOALS.length * (INTERESTS.length + 1) * (LEVELS.length + 1));
    for (const a of combos) {
      const label = toQuery(a);
      const steps = buildRoute(a);
      expect(steps.length, label).toBeGreaterThanOrEqual(MIN_STEPS);
      expect(steps.length, label).toBeLessThanOrEqual(MAX_STEPS);
      expect(new Set(steps.map((s) => s.id)).size, label).toBe(steps.length);
      expect(new Set(steps.map((s) => href(s.link.route, s.link.params ?? {}) + (s.link.hash ?? ''))).size, `${label}: same page twice`).toBe(steps.length);
      steps.forEach((s) => link(label, s.link));
      // Starts with the audience's start guide; an interest adds its theme as the last step.
      expect(steps[0].link.route, label).toBe('help-guide');
      if (a.interest) expect(steps.at(-1)!.link, label).toEqual({ route: 'future-skills', hash: `theme-${{ ai: 'ai', clean: 'grn', nextgen: 'adv', human: 'hum', safety: 'nks' }[a.interest]}` });
    }
  });

  it('has a recipe for every goal and audience, and only known steps with complete texts', () => {
    for (const g of GOALS) for (const w of WHO) expect(RECIPES[g][w].every((id) => !!STEPS[id]), `${g}/${w}`).toBe(true);
    for (const s of Object.values(STEPS)) {
      bi(`${s.id} title`, s.title);
      bi(`${s.id} body`, s.body);
      link(s.id, s.link);
    }
    // Interest steps reuse the theme titles.
    for (const i of INTERESTS) bi(`interest ${i}`, buildRoute({ who: 'student', goal: 'skill', interest: i }).at(-1)!.title);
  });

  it('tailors the route to the answers', () => {
    const ids = (a: Answers) => buildRoute(a).map((s) => s.id);
    expect(ids({ who: 'student', goal: 'explore' })).toEqual(['start-students', 'journey', 'programmes', 'careers-map', 'horizons']);
    expect(ids({ who: 'employee', family: 'operations', goal: 'skill' })[1]).toBe('passport');
    expect(ids({ who: 'graduate', goal: 'skill', level: 'new' })[1]).toBe('levels');
    expect(ids({ who: 'graduate', goal: 'explore', level: 'experienced' })).toContain('translate');
    expect(ids({ who: 'employee', family: 'safety', goal: 'skill', level: 'experienced' })).toContain('recognition');
    expect(ids({ who: 'manager', goal: 'team' })).toContain('critical');
    expect(ids({ who: 'partner', goal: 'partner' })[0]).toBe('start-partners');
    expect(buildRoute({ who: 'student' })).toEqual([]);
  });

  it('covers every job family exactly once with the employee role families', async () => {
    const b = getLocalBackend();
    await b.whenReady();
    const fams = (await b.list('job_families')).map((r) => r.id).sort();
    const mapped = FAMILIES.flatMap((f) => FAMILY_IDS[f]);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect([...mapped].sort()).toEqual(fams);
  });
});

describe('find my route: URL state', () => {
  it('round-trips answers and the screen through the query string, in a stable order', () => {
    const a: Answers = { who: 'employee', family: 'science', goal: 'recognised', interest: 'clean', level: 'some' };
    const q = toQuery(a, 'r');
    expect(q).toBe('who=employee&family=science&goal=recognised&interest=clean&level=some&s=r');
    const p = new URLSearchParams(q);
    expect(parseAnswers(p)).toEqual(a);
    expect(screenFor(parseAnswers(p), p.get('s'))).toBe('r');
  });

  it('drops unknown values and a family for non-employees, and never skips an unanswered question', () => {
    expect(parseAnswers(new URLSearchParams('who=alien&goal=fly&interest=x&level=9'))).toEqual({ who: undefined, family: undefined, goal: undefined, interest: undefined, level: undefined });
    expect(parseAnswers(new URLSearchParams('who=student&family=operations')).family).toBeUndefined();
    expect(toQuery({ who: 'student', family: 'operations' })).toBe('who=student');
    expect(screenFor({}, 'r')).toBe('1');
    expect(screenFor({ who: 'employee' }, '2')).toBe('1'); // no family yet
    expect(screenFor({ who: 'student' }, 'r')).toBe('2');
    expect(screenFor({ who: 'student', goal: 'skill' }, null)).toBe('r');
    expect(screenFor({ who: 'student', goal: 'skill' }, '3')).toBe('3');
    expect(screenFor({ who: 'student', goal: 'skill' }, 'zz')).toBe('r');
  });
});

let lastSearch = '';
function LocProbe() {
  lastSearch = useLocation().search;
  return null;
}

describe('orientation pages', () => {
  it('renders the explainer in English: theme map, twelve cards with Explore links, and how the data is kept honest', async () => {
    const { container } = await renderPage(<FutureSkillsPage />, { path: '/future-skills' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Future skills programme'));
    for (const t of THEMES) {
      expect(container.querySelector(`#theme-${t.id}`), t.id).toBeTruthy();
      expect(container.querySelector(`[data-testid="m12-fsx-map"] a[href="#theme-${t.id}"]`), t.id).toBeTruthy();
      expect(screen.getByTestId(`m12-fsx-explore-${t.id}`).querySelectorAll('a').length).toBe(t.explore.length);
    }
    expect(container.querySelector('a[href="/skills"]')).toBeTruthy();
    expect(container.querySelector(`a[href="/sign-in?next=${encodeURIComponent('/my/ai-fluency')}"]`)).toBeTruthy();
    expect(screen.getByTestId('m12-fsx-decay').textContent).toMatch(/18 months[\s\S]*36 months[\s\S]*60 months/);
    await waitFor(() => expect(screen.getByTestId('m12-fsx-bm-count').textContent).toMatch(/\d+ benchmarks · sources last read/));
    expect(container.textContent).toMatch(/synthetic demo data/);
    expect(screen.getByTestId('m12-fsx-print')).toBeTruthy();
    expect(screen.getByTestId('m12-fsx-route').getAttribute('href')).toBe('/start');
    expect(container.textContent).not.toMatch(/m12\.fsx\.|fs\.decayShort/);
  });

  it('renders the explainer in Arabic with Arabic-prefixed links', async () => {
    const { container } = await renderPage(<FutureSkillsPage />, { path: '/ar/future-skills' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('برنامج مهارات المستقبل'));
    expect(container.querySelector('a[href="/ar/skills"]')).toBeTruthy();
    expect(container.querySelector('#theme-grn h3')!.textContent).toBe(THEMES.find((t) => t.id === 'grn')!.title.ar);
    expect(screen.getByTestId('m12-fsx-route').getAttribute('href')).toBe('/ar/start');
  });

  it('walks the questionnaire with radios and Next, keeps the answers in the URL, and shows a printable route', async () => {
    await renderPage(<><StartPage /><LocProbe /></>, { path: '/start' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Find my route'));
    expect((screen.getByTestId('m12-start-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('m12-start-who-employee'));
    await waitFor(() => expect(screen.getByTestId('m12-start-family-q')).toBeTruthy());
    expect((screen.getByTestId('m12-start-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('m12-start-family-operations'));
    await waitFor(() => expect(lastSearch).toBe('?who=employee&family=operations&s=1'));
    fireEvent.keyDown(screen.getByTestId('m12-start-family-operations'), { key: 'Enter' }); // Enter on a chosen option moves on
    await waitFor(() => expect(screen.getByTestId('m12-start-q2')).toBeTruthy());
    expect(document.activeElement?.textContent).toBe('What do you want to do?');
    fireEvent.click(screen.getByTestId('m12-start-goal-skill'));
    fireEvent.click(screen.getByTestId('m12-start-next'));
    await waitFor(() => expect(screen.getByTestId('m12-start-q3')).toBeTruthy());
    fireEvent.click(screen.getByTestId('m12-start-interest-ai'));
    fireEvent.click(screen.getByTestId('m12-start-next'));
    await waitFor(() => expect(screen.getByTestId('m12-start-route')).toBeTruthy());
    expect(lastSearch).toBe('?who=employee&family=operations&goal=skill&interest=ai&s=r');
    const steps = buildRoute({ who: 'employee', family: 'operations', goal: 'skill', interest: 'ai' });
    expect(screen.getByTestId('m12-start-steps').querySelectorAll('li').length).toBe(steps.length);
    expect(screen.getByTestId('m12-start-print')).toBeTruthy();
    expect(screen.getByTestId('m12-start-answers').textContent).toMatch(/ENEC employee.*Operations and outage management.*Build a skill.*AI and digital/);
    // Staff steps go through sign-in; the guide step is labelled with the guide's title.
    expect(screen.getByTestId('help-go-my-skills').getAttribute('href')).toBe(`/sign-in?next=${encodeURIComponent('/my/skills')}`);
    expect(screen.getByTestId('help-go-help-guide').textContent).toContain(GUIDE_BY_ID['start-employees'].title.en);
    expect(screen.getByTestId('help-go-future-skills').getAttribute('href')).toBe('/future-skills#theme-ai');
    await waitFor(() => expect(screen.getByTestId('m12-start-roles').querySelectorAll('a').length).toBeGreaterThan(0));
    for (const a of Array.from(screen.getByTestId('m12-start-roles').querySelectorAll('a'))) expect(routeForPath(a.getAttribute('href')!)?.def.id).toBe('careers-role');
    fireEvent.click(screen.getByTestId('m12-start-restart'));
    await waitFor(() => expect(screen.getByTestId('m12-start-q1')).toBeTruthy());
    expect(lastSearch).toBe('?s=1');
  });

  it('opens a shared route link directly in Arabic, with programmes for students', async () => {
    const { container } = await renderPage(<StartPage />, { path: '/ar/start?who=student&goal=explore&level=new&s=r' });
    await waitFor(() => expect(screen.getByTestId('m12-start-route')).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('اعثر على مسارك');
    const steps = buildRoute({ who: 'student', goal: 'explore', level: 'new' });
    const items = screen.getByTestId('m12-start-steps').querySelectorAll('li');
    expect(items.length).toBe(steps.length);
    expect(items[0].querySelector('h3')!.textContent).toContain(steps[0].title.ar);
    expect(container.querySelector('a[href="/ar/pathways/journey"]')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('m12-start-programmes').querySelectorAll('a').length).toBeGreaterThan(0));
    for (const a of Array.from(screen.getByTestId('m12-start-programmes').querySelectorAll('a'))) expect(a.getAttribute('href')).toMatch(/^\/ar\/pathways\/[a-z0-9-]+$/);
    expect(container.textContent).not.toMatch(/m12\.start\./);
  });

  it('goes back to the first unanswered question when a shared link is incomplete', async () => {
    await renderPage(<StartPage />, { path: '/start?goal=skill&s=r' });
    await waitFor(() => expect(screen.getByTestId('m12-start-q1')).toBeTruthy());
  });
});

describe('orientation wiring', () => {
  it('registers two public routes: the explainer in the Learn menu and the route finder in the Help menu', () => {
    expect(ROUTE_BY_ID['future-skills']).toMatchObject({ path: '/future-skills', zone: 'public', nav: { lens: 'public', section: 'learn' } });
    expect(ROUTE_BY_ID.start).toMatchObject({ path: '/start', zone: 'public', nav: { lens: 'public', section: 'help' } });
    for (const id of ['future-skills', 'start']) expect(checkGuard(ROUTE_BY_ID[id].guard, ANON)).toBe('ok');
  });

  it('links both pages from the help guides', () => {
    for (const g of ['how-kafaa-works', 'start-students', 'start-employees', 'start-managers', 'start-partners']) expect(GUIDE_BY_ID[g].links.map((l) => l.route), g).toContain('start');
    for (const g of ['how-kafaa-works', 'start-students', 'learning-paths']) expect(GUIDE_BY_ID[g].links.map((l) => l.route), g).toContain('future-skills');
  });

  it('adds "Find my route" to the homepage hero and the audiences section (EN and AR)', async () => {
    await renderPage(<HomePage />, { path: '/' });
    await waitFor(() => expect(screen.getByTestId('m12-cta-route')).toBeTruthy());
    expect(screen.getByTestId('m12-cta-route').getAttribute('href')).toBe('/start');
    expect(screen.getByTestId('m12-aud-route').getAttribute('href')).toBe('/start');
    await renderPage(<HomePage />, { path: '/ar' });
    await waitFor(() => expect(screen.getAllByTestId('m12-cta-route').at(-1)!.getAttribute('href')).toBe('/ar/start'));
  });
});
