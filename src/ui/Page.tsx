/** Layout and status primitives. Every page renders inside <Page>; it sets the document title and the h1. */
import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useT } from '../i18n';

export function Page({ title, eyebrow, intro, actions, children, wide }: { title: string; eyebrow?: ReactNode; intro?: ReactNode; actions?: ReactNode; children?: ReactNode; wide?: boolean }) {
  const t = useT();
  useEffect(() => {
    document.title = `${title} · ${t('shell.brand')}`;
  }, [title, t]);
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-[1400px]' : 'max-w-6xl'} px-4 py-6 sm:px-6`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">{title}</h1>
          {intro && <div className="mt-2 max-w-3xl text-[15px] text-ink-2">{intro}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function Section({ title, description, actions, children, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-3">
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {title && <h2 className="text-[18px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ title, eyebrow, actions, children, className = '', footer, as: As = 'div', padded = true }: { title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; footer?: ReactNode; as?: 'div' | 'article' | 'section' | 'li'; padded?: boolean }) {
  return (
    <As className={`card ${padded ? 'p-4' : ''} ${className}`}>
      {(title || eyebrow || actions) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {eyebrow && <div className="caps mb-0.5">{eyebrow}</div>}
            {title && <h3 className="text-[15px] font-semibold leading-snug">{title}</h3>}
          </div>
          {actions}
        </div>
      )}
      {children}
      {footer && <div className="mt-3 border-t border-line pt-3 text-[12.5px] text-ink-2">{footer}</div>}
    </As>
  );
}

export function Grid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}

export function StatTile({ label, value, sub, tone, sim, source }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'info' | 'sim'; sim?: boolean; source?: ReactNode }) {
  const toneCls = tone ? { ok: 'text-ok', bad: 'text-bad', info: 'text-info', sim: 'text-sim' }[tone] : 'text-ink';
  return (
    <div className="card p-4" data-testid="stat-tile">
      <div className="flex items-center justify-between gap-2">
        <div className="caps">{label}</div>
        {sim && <SimChip />}
      </div>
      <div className={`num mt-1 text-[26px] font-semibold leading-tight ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[12.5px] text-ink-2">{sub}</div>}
      {source && <div className="mt-2 text-[11.5px] text-ink-3">{source}</div>}
    </div>
  );
}

export type PillTone = 'ok' | 'bad' | 'info' | 'sim' | 'reserved' | 'neutral' | 'accent';
const pillCls: Record<PillTone, string> = {
  ok: 'border-ok-line bg-ok-bg text-ok',
  bad: 'border-bad-line bg-bad-bg text-bad',
  info: 'border-info-line bg-info-bg text-info',
  sim: 'border-sim-line bg-sim-bg text-sim',
  reserved: 'border-reserved-line bg-reserved-bg text-reserved',
  neutral: 'border-line bg-sunken text-ink-2',
  accent: 'border-accent/30 bg-accent-soft text-eyebrow',
};
/** Default status → tone mapping used across modules; pass tone to override. */
const STATUS_TONE: Record<string, PillTone> = {
  valid: 'ok', qualified: 'ok', active: 'ok', approved: 'ok', pass: 'ok', passed: 'ok', completed: 'ok', ok: 'ok', confirmed: 'ok', released: 'ok', published: 'ok', healthy: 'ok', met: 'ok', enrolled: 'ok', offer: 'ok', hired: 'ok',
  expired: 'bad', lapsed: 'bad', fail: 'bad', failed: 'bad', overdue: 'bad', rejected: 'bad', withdrawn: 'bad', revoked: 'bad', suspended: 'bad', error: 'bad', at_risk: 'bad', critical: 'bad', not_met: 'bad', declined: 'bad',
  due: 'sim', due_soon: 'sim', pending: 'sim', in_review: 'sim', submitted: 'info', draft: 'neutral', stale: 'sim', degraded: 'sim', screening: 'info', returned: 'sim', waitlisted: 'sim', in_progress: 'info', review: 'sim', needs_review: 'sim', scheduled: 'info', open: 'info', interview: 'info', assessment: 'info', shortlisted: 'info', handed_off: 'info', proposed: 'neutral', archived: 'neutral', closed: 'neutral', not_started: 'neutral', superseded: 'neutral',
};
export function StatusPill({ status, tone, children }: { status?: string | null; tone?: PillTone; children?: ReactNode }) {
  const t = useT();
  const s = status ?? '';
  const key = `common.status.${s}`;
  const label = children ?? (s ? (t(key) === key ? s.replace(/_/g, ' ') : t(key)) : '—');
  return (
    <span className={`chip ${pillCls[tone ?? STATUS_TONE[s] ?? 'neutral']}`} data-status={s}>
      {label}
    </span>
  );
}

/** Label for any simulated, illustrative or synthetic figure (never presented as real). */
export function SimChip({ label }: { label?: string }) {
  const t = useT();
  return <span className={`chip ${pillCls.sim}`}>{label ?? t('common.simulated')}</span>;
}

/** Cite a public source. Opens in a new tab. */
export function SourceLink({ href, children, date }: { href: string; children?: ReactNode; date?: string | null }) {
  const t = useT();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px]">
      {children ?? t('common.source')}
      <Icon name="external" size={12} />
      {date && <span className="text-ink-3">({date})</span>}
    </a>
  );
}

export function EmptyState({ title, children, action, icon = 'info' }: { title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: string }) {
  const t = useT();
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center" data-testid="empty-state">
      <Icon name={icon} size={28} className="text-ink-3" />
      <div className="font-semibold">{title ?? t('common.empty')}</div>
      {children && <div className="max-w-md text-ink-2">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry, title }: { error?: Error | string | null; retry?: () => void; title?: ReactNode }) {
  const t = useT();
  const msg = typeof error === 'string' ? error : error?.message;
  return (
    <div role="alert" className="card border-bad-line bg-bad-bg p-5 text-bad" data-testid="error-state">
      <div className="flex items-center gap-2 font-semibold">
        <Icon name="alert" />
        {title ?? t('common.errorTitle')}
      </div>
      {msg && <div className="mt-1 text-[13px] text-ink-2">{msg}</div>}
      {retry && (
        <button className="btn-outline btn-sm mt-3" onClick={retry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite" data-testid="skeleton">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${90 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Render loading / error / empty / data in one place. */
export function Async<T>({ state, children, empty, isEmpty }: { state: { data: T | undefined; loading: boolean; error: Error | null; reload?: () => void }; children: (data: T) => ReactNode; empty?: ReactNode; isEmpty?: (d: T) => boolean }) {
  if (state.error) return <ErrorState error={state.error} retry={state.reload} />;
  if (state.data === undefined) return <Skeleton lines={4} />;
  const emptyNow = isEmpty ? isEmpty(state.data) : Array.isArray(state.data) && state.data.length === 0;
  if (emptyNow) return <>{empty ?? <EmptyState />}</>;
  return <>{children(state.data)}</>;
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'sim' | 'bad' | 'ok'; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-card border p-3 ${pillCls[tone]}`} role="note">
      <div className="flex gap-2">
        <Icon name={tone === 'bad' ? 'alert' : 'info'} className="mt-0.5" />
        <div className="min-w-0 text-[13.5px]">
          {title && <div className="font-semibold">{title}</div>}
          {children && <div className="text-ink-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(140px,max-content)_1fr]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="caps pt-0.5">{k}</dt>
          <dd className="text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
