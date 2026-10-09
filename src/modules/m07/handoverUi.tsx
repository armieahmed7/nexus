// F22 Handover 2030 board: shared React pieces (suppressed cell, burn-down chart, guarded links). Also used by the observer
// report body (WorkforcePage ReportBody) to draw the released burn-down.
import type { ReactNode } from 'react';
import { LineChart, SimChip, Icon } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import type { Cell } from './handover';

/** A count cell: the number, or a "suppressed" chip (cells under 10, zero included). */
export function Sup({ c, testId }: { c: Cell | undefined; testId?: string }) {
  const t = useT();
  const f = useFormat();
  if (c == null) {
    return (
      <span className="chip bg-sunken text-ink-3" title={t('common.suppressed')} data-testid={testId ?? 'm07-ho-suppressed'}>
        {t('m07.ho.suppressed')}
      </span>
    );
  }
  return <span className="num">{f.num(c)}</span>;
}

/** Text form of a cell for CSV and tiles. */
export const cellText = (c: Cell | undefined) => (c == null ? 'suppressed' : String(c));

/** Cover vs ready successors to the OSSA end, with the positions to hand over as a dashed reference line. */
export function HandoverBurndown({ years, cover, ready, title }: { years: number[]; cover: Cell[]; ready: Cell[]; title?: string }) {
  const t = useT();
  const need = cover[0];
  const pts = (arr: (number | null)[]) => years.map((y, i) => ({ x: String(y), y: arr[i] ?? null }));
  const anySup = [...cover, ...ready].some((c) => c == null);
  return (
    <div data-testid="m07-ho-burndown">
      <LineChart
        title={title ?? t('m07.ho.burndown.title')}
        series={[
          { name: t('m07.ho.burndown.cover'), points: pts(cover), tone: 'sim' },
          { name: t('m07.ho.burndown.ready'), points: pts(ready), tone: 'leaf' },
          ...(need != null ? [{ name: t('m07.ho.burndown.need'), points: pts(years.map(() => need)), tone: 'ink', dashed: true }] : []),
        ]}
        height={200}
      />
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <SimChip label={t('common.simulated')} />
        <span>{t('m07.ho.burndown.note')}</span>
        {anySup && <span>{t('m07.ho.burndown.gaps')}</span>}
      </p>
    </div>
  );
}

/** A path the viewer can open, or null (route not built yet, or the viewer's role cannot open it). */
export function useOpenable() {
  const s = useSession();
  return (path: string): string | null => {
    const r = ROUTES.find((x) => x.path === path);
    return r && checkGuard(r.guard, s) === 'ok' ? path : null;
  };
}

export function LinkOrNote({ to, children, note }: { to: string | null; children: ReactNode; note: ReactNode }) {
  if (to) {
    return (
      <L to={to} className="inline-flex items-center gap-1">
        {children}
        <Icon name="chevron" size={12} className="rtl:-scale-x-100" />
      </L>
    );
  }
  return <span className="text-ink-3" title={typeof note === 'string' ? note : undefined}>{children} · {note}</span>;
}
