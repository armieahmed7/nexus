/**
 * Modal, Drawer and ConfirmDialog. Focus is trapped, Escape closes, focus returns to the opener.
 * ConfirmDialog is mandatory before any consequential write ("evidence will be recorded"): it states the action,
 * who is acting, and requires a reason when `requireReason` is set.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useT } from '../i18n';

/** initialFocus: the element to focus on open (default: the first focusable). returnFocus: where focus goes on close (default: the opener). */
function useFocusTrap(open: boolean, onClose: () => void, initialFocus?: RefObject<HTMLElement | null>, returnFocus?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    setTimeout(() => (initialFocus?.current ?? focusables()[0] ?? el)?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const back = returnFocus?.current;
      (back?.isConnected ? back : opener)?.focus?.();
    };
  }, [open, onClose, initialFocus, returnFocus]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  initialFocus,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const ref = useFocusTrap(open, onClose, initialFocus, returnFocus);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} className={`w-full ${w} max-h-[90vh] overflow-auto rounded-modal border border-line bg-panel shadow-card`}>
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button className="text-ink-3 hover:text-ink" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line p-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  const t = useT();
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} className="absolute inset-y-0 end-0 flex w-full max-w-lg flex-col border-s border-line bg-panel shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button className="text-ink-3 hover:text-ink" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line p-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * <ConfirmDialog open title="Sign off task" consequence="Records a pass for 1.2 on W. Example's card"
 *   actingAs="Instructor" requireReason onConfirm={async (reason) => run(() => repo.rpc....)} onClose={...} />
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  consequence,
  actingAs,
  requireReason,
  reasonLabel,
  confirmLabel,
  danger,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  consequence: ReactNode;
  actingAs?: ReactNode;
  requireReason?: boolean;
  reasonLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<unknown> | unknown;
  children?: ReactNode;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const invalid = requireReason && reason.trim().length < 5;
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            disabled={busy || invalid}
            data-testid="confirm-action"
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t('common.working') : (confirmLabel ?? t('common.confirm'))}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p>{consequence}</p>
        {children}
        {requireReason && (
          <label className="block">
            <span className="caps">{reasonLabel ?? t('common.reason')}</span>
            <textarea className="input mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={reason.length > 0 && invalid ? true : undefined} />
            {reason.length > 0 && invalid && <span className="text-[12px] text-bad">{t('common.reasonTooShort')}</span>}
          </label>
        )}
        <div className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info">
          <Icon name="shield" size={14} className="mt-0.5" />
          <span>
            {t('common.evidenceRecorded')}
            {actingAs && <> {t('common.actingAs', { role: String(actingAs) })}</>}
          </span>
        </div>
      </div>
    </Modal>
  );
}
