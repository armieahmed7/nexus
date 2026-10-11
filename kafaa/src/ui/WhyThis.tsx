/**
 * F02: explanation UI for every ranked or derived result.
 *   <WhyThis reasons={item.reasons} />      "Why this?" disclosure listing each reason in the current language
 *   <EngineBadge engine={useEngine('recommend')} />   which engine produced the list (deterministic / model / model unavailable)
 * Reasons are i18n keys with variables (src/domain/engines/types.ts); bilingual variables pick the current language,
 * `date` variables are formatted and numbers follow the digit preference.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useFormat, useLang, useT } from '../i18n';
import type { EngineKind, EngineStatus, Reason } from '../domain/engines/types';
import { SimChip, StatusPill } from './Page';

export function useReasonText() {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  return (r: Reason) =>
    t(r.key, Object.fromEntries(Object.entries(r.vars ?? {}).map(([k, v]) => [k, typeof v === 'object' && v ? (lang === 'ar' && v.ar ? v.ar : v.en) : k === 'date' ? f.date(String(v)) : typeof v === 'number' ? f.num(v) : String(v)])));
}

export function WhyThis({ reasons, label, testId = 'why-this' }: { reasons: Reason[]; label?: string; testId?: string }) {
  const t = useT();
  const text = useReasonText();
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const click = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', click);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('mousedown', click);
    };
  }, [open]);
  return (
    <span ref={box} className="relative inline-block">
      <button type="button" className="btn-ghost btn-sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} data-testid={testId}>
        {label ?? t('common.engines.whyThis')}
      </button>
      {open && (
        <span id={id} role="note" className="absolute start-0 z-30 mt-1 block w-72 max-w-[80vw] rounded-card border border-line bg-panel p-3 text-start shadow-lg" data-testid={`${testId}-panel`}>
          <span className="caps mb-1 block">{t('common.engines.whyTitle')}</span>
          {reasons.length ? (
            <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2">
              {reasons.map((r, i) => (
                <li key={`${r.code}-${i}`}>{text(r)}</li>
              ))}
            </ul>
          ) : (
            <span className="text-[13px] text-ink-3">{t('common.engines.noReasons')}</span>
          )}
        </span>
      )}
    </span>
  );
}

export function EngineBadge({ engine }: { engine: { kind: EngineKind; status: EngineStatus } }) {
  const t = useT();
  if (engine.status === 'model_unavailable') return <SimChip label={t('common.engines.badge.model_unavailable')} />;
  return <StatusPill tone={engine.kind === 'model' ? 'accent' : 'neutral'}>{t(`common.engines.badge.${engine.kind}`)}</StatusPill>;
}
