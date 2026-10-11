// @vitest-environment jsdom
/**
 * G2: training paths (spec section 8) and G2 label rendering in EN and AR.
 * Pure checks on the path content plus testing-library renders of the shared G2 status pill under both locales.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import seed from '../../src/seed/seed.json';
import { TRAINING_PATHS, PATH_BY_ID, pathProgress, trackForRole, type PathEvidence } from '../../src/modules/m04/paths';
import { I18nProvider, translate } from '../../src/i18n';
import { G2Pill } from '../../src/modules/m04/ui';

const S = (seed as unknown as { tables: Record<string, { id: string; mandatory?: boolean }[]> }).tables;
const ids = (t: string) => new Set((S[t] ?? []).map((r) => r.id));
const none = (): PathEvidence => ({ roleId: null, completedCourses: new Set(), activeCourses: new Set(), qualifiedStandards: new Set(), activeStandards: new Set(), licences: new Set() });

afterEach(() => cleanup());

describe('training paths content', () => {
  it('covers the nine spec tracks plus all-staff, each bilingual and sourced', () => {
    for (const id of ['licensed-operator', 'maintenance', 'radiation-protection', 'chemistry', 'engineering', 'emergency-preparedness', 'security', 'supplier', 'graduate']) expect(PATH_BY_ID[id], id).toBeTruthy();
    const sources = ids('sources');
    const courses = ids('courses');
    for (const p of TRAINING_PATHS) {
      expect(p.title.en && p.title.ar, p.id).toBeTruthy();
      expect(p.stages.length, p.id).toBeGreaterThan(1);
      for (const s of p.stages) {
        expect(s.title.en.trim() && s.title.ar.trim(), `${p.id}/${s.id}`).toBeTruthy();
        expect(s.content.en.trim() && s.content.ar.trim(), `${p.id}/${s.id}`).toBeTruthy();
        for (const src of s.sources) expect(sources.has(src), `${p.id}/${s.id} source ${src}`).toBe(true);
        for (const c of s.courses ?? []) expect(courses.has(c), `${p.id}/${s.id} course ${c}`).toBe(true);
      }
    }
  });

  it('keeps the security track at career level: a single qualified/not-qualified standard, no licence, only the all-staff awareness course', () => {
    const sec = PATH_BY_ID['security'];
    expect(sec.careerOnly).toBe(true);
    for (const s of sec.stages) {
      for (const c of s.courses ?? []) expect(S.courses.find((x) => x.id === c)?.mandatory, c).toBe(true);
      expect((s.standards ?? []).length).toBeLessThanOrEqual(1);
      expect(s.licence).toBeUndefined();
    }
  });
});

describe('pathProgress', () => {
  const ro = PATH_BY_ID['licensed-operator'];

  it('starts at the first stage with no evidence and is not on track', () => {
    const p = pathProgress(ro, none());
    expect(p.pct).toBe(0);
    expect(p.onTrack).toBe(false);
    expect(p.stages[0].state).toBe('current');
    expect(p.stages.slice(1).every((s) => s.state === 'upcoming')).toBe(true);
  });

  it('marks earlier stages done from the role position and puts "you are here" on the role stage', () => {
    const idx = ro.stages.findIndex((s) => (s.roles ?? []).length > 0 && ro.stages.indexOf(s) > 0);
    expect(idx).toBeGreaterThan(0);
    const role = ro.stages[idx].roles![0];
    const p = pathProgress(ro, { ...none(), roleId: role });
    expect(p.onTrack).toBe(true);
    expect(p.stages[idx].here).toBe(true);
    expect(p.stages.slice(0, idx).every((s) => s.state === 'done')).toBe(true);
    expect(p.stages[idx].state).toBe('current');
    expect(trackForRole(role)?.id).toBe(ro.id);
  });

  it('a mirrored licence completes the licence stage', () => {
    const stage = ro.stages.find((s) => s.licence === 'RO');
    expect(stage).toBeTruthy();
    const p = pathProgress(ro, { ...none(), licences: new Set(['RO']) });
    expect(p.stages.find((s) => s.id === stage!.id)!.state).toBe('done');
    expect(p.pct).toBeGreaterThan(0);
  });

  it('counts completed courses per stage', () => {
    const stage = TRAINING_PATHS.flatMap((p) => p.stages.map((s) => ({ p, s }))).find(({ s }) => (s.courses ?? []).length > 1)!;
    const first = stage.s.courses![0];
    const p = pathProgress(stage.p, { ...none(), completedCourses: new Set([first]) });
    const sp = p.stages.find((x) => x.id === stage.s.id)!;
    expect(sp.coursesDone).toBe(1);
    expect(sp.coursesTotal).toBe(stage.s.courses!.length);
    expect(p.onTrack).toBe(true);
  });
});

describe('G2 labels render in English and Arabic', () => {
  const at = (path: string) => render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(I18nProvider, null, createElement(G2Pill, { status: 'waitlisted' }))));

  it('English route shows the English label', () => {
    at('/learn');
    expect(screen.getByText('Waitlisted')).toBeTruthy();
  });

  it('Arabic route shows the Arabic label and sets RTL', () => {
    at('/ar/learn');
    expect(screen.getByText(translate('ar', 'm04.status.waitlisted'))).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('every retake code and item-analysis flag has a label in both languages', () => {
    for (const code of ['first', 'ok', 'result_pending', 'already_passed', 'retake_limit', 'retake_wait'])
      for (const l of ['en', 'ar'] as const) expect(translate(l, `m05.retake.${code}`, { date: '2026-10-15' })).not.toBe(`m05.retake.${code}`);
    for (const flag of ['ok', 'too_hard', 'too_easy', 'poor_discrimination', 'low_n'])
      for (const l of ['en', 'ar'] as const) expect(translate(l, `m04.status.${flag}`)).not.toBe(`m04.status.${flag}`);
  });
});
