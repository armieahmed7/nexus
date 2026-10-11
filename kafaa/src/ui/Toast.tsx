/** Toasts: const toast = useToast(); toast.push({ tone: 'ok', title: 'Saved', detail: 'Audit #42' }). Announced to screen readers. */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useT } from '../i18n';

export type Tone = 'ok' | 'bad' | 'info' | 'sim' | 'neutral';
export interface ToastMsg {
  tone?: Tone;
  title: string;
  detail?: string;
  /** milliseconds; 0 keeps it until dismissed */
  ttl?: number;
}
interface ToastApi {
  push: (m: ToastMsg) => void;
}
const ToastContext = createContext<ToastApi | null>(null);
const toneCls: Record<Tone, string> = {
  ok: 'border-ok-line bg-ok-bg text-ok',
  bad: 'border-bad-line bg-bad-bg text-bad',
  info: 'border-info-line bg-info-bg text-info',
  sim: 'border-sim-line bg-sim-bg text-sim',
  neutral: 'border-line bg-panel text-ink',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<(ToastMsg & { id: number })[]>([]);
  const n = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (m: ToastMsg) => {
      const id = ++n.current;
      setItems((xs) => [...xs.slice(-3), { ...m, id }]);
      const ttl = m.ttl ?? (m.tone === 'bad' ? 8000 : 4500);
      if (ttl > 0) setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastRegion({ items, dismiss }: { items: (ToastMsg & { id: number })[]; dismiss: (id: number) => void }) {
  const t = useT();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-20 end-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((m) => (
        <div key={m.id} data-testid="toast" data-tone={m.tone ?? 'neutral'} className={`pointer-events-auto flex items-start gap-2 rounded-card border p-3 shadow-card ${toneCls[m.tone ?? 'neutral']}`}>
          <Icon name={m.tone === 'ok' ? 'check' : m.tone === 'bad' ? 'alert' : 'info'} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{m.title}</div>
            {m.detail && <div className="mt-0.5 text-[12.5px] text-ink-2">{m.detail}</div>}
          </div>
          <button className="text-ink-3 hover:text-ink" onClick={() => dismiss(m.id)} aria-label={t('common.close')}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastApi {
  const v = useContext(ToastContext);
  // Outside the provider (tests), fall back to console so writes never crash.
  return v ?? { push: (m) => console.info('[toast]', m.tone, m.title, m.detail ?? '') };
}
