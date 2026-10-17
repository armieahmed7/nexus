// @vitest-environment jsdom
/**
 * /admin/audit rows open with a meaningful "Open …" label (action, target, time; EN/AR), and the primary button hover keeps
 * white text at WCAG AA (axe color-contrast on the hovered "Table" view toggle on /kafaa/partners was 4.18:1).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { I18nProvider, translate } from '../../src/i18n';
import { DataTable } from '../../src/ui/DataTable';
import { auditRowLabel } from '../../src/modules/m16/AdminAuditPage';

afterEach(cleanup);
const when = (ts: string) => ts.slice(0, 16).replace('T', ' ');
const ROW = { id: 'a7', seq: 7, ts: '2026-10-13T10:22:00Z', action: 'enrolment.create', entity_table: 'enrolments', entity_id: 'e-42' };

describe('/admin/audit · row label', () => {
  it('names the entry by action, target and time in English and Arabic', () => {
    expect(auditRowLabel(ROW, (k, v) => translate('en', k, v), when)).toBe('audit entry #7: enrolment.create on enrolments e-42, 2026-10-13 10:22');
    expect(auditRowLabel({ ...ROW, entity_table: null, entity_id: null }, (k, v) => translate('en', k, v), when)).toBe('audit entry #7: enrolment.create, 2026-10-13 10:22');
    expect(auditRowLabel(ROW, (k, v) => translate('ar', k, v), when)).toBe('قيد التدقيق رقم 7: enrolment.create على enrolments e-42، 2026-10-13 10:22');
  });

  it('the page passes it to DataTable, so the row button no longer reads "Open 7"', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <DataTable rows={[ROW]} rowKey={(r) => r.id} columns={[{ key: 'seq', header: '#', value: (r) => r.seq }]} onRowClick={vi.fn()} rowLabel={(r) => auditRowLabel(r, (k, v) => translate('en', k, v), when)} searchable={false} />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Open audit entry #7: enrolment.create on enrolments e-42, 2026-10-13 10:22' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open 7' })).toBeNull();
    expect(readFileSync('src/modules/m16/AdminAuditPage.tsx', 'utf8')).toMatch(/rowLabel=\{\(a\) => auditRowLabel\(a, t, f\.dateTime\)\}/);
  });
});

describe('.btn-primary hover contrast', () => {
  const css = readFileSync('src/styles/index.css', 'utf8');
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const token = (theme: 'light' | 'dark', name: string) => {
    const block = css.match(theme === 'light' ? /:root,\[data-theme=light\]\{([^}]*)\}/ : /\[data-theme=dark\]\{([^}]*)\}/)![1];
    return block.match(new RegExp(`--${name}: (\\d+) (\\d+) (\\d+);`))!.slice(1).map(Number);
  };

  it('uses a solid --accent-hover shade instead of 90% accent', () => {
    expect(css).toMatch(/\.btn-primary \{ @apply btn bg-accent text-accent-ink hover:bg-accent-hover; \}/);
    expect(css).not.toMatch(/hover:bg-accent\/90/);
  });

  it('keeps accent-ink text at 4.5:1 or more on the hover shade in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(ratio(token(theme, 'accent-hover'), token(theme, 'accent-ink'))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
