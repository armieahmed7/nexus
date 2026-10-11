/** Shared admin-console pieces for G5 pages (M08 ECP, M13 Dalil admin, M14 access, M16 admin). */
import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { Icon, Modal } from '../../ui';

/**
 * Like the kit's ConfirmDialog (states the action, who is acting and that evidence is recorded) but the confirm button
 * stays disabled until `ready` (checklists, required choices). Used where a consequential step has preconditions.
 */
export function GatedConfirm({ open, onClose, title, consequence, actingAs, ready = true, danger, confirmLabel, onConfirm, children }: { open: boolean; onClose: () => void; title: ReactNode; consequence: ReactNode; actingAs?: string; ready?: boolean; danger?: boolean; confirmLabel?: string; onConfirm: () => Promise<unknown> | unknown; children?: ReactNode }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
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
            disabled={busy || !ready}
            data-testid="confirm-action"
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
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
        <div className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info">
          <Icon name="shield" size={14} className="mt-0.5" />
          <span>
            {t('common.evidenceRecorded')}
            {actingAs && <> {t('common.actingAs', { role: actingAs })}</>}
          </span>
        </div>
      </div>
    </Modal>
  );
}

/** Small labelled metric used across admin pages. */
export function Metric({ label, value, tone, sub }: { label: ReactNode; value: ReactNode; tone?: 'ok' | 'bad' | 'sim' | 'info'; sub?: ReactNode }) {
  const cls = tone ? { ok: 'text-ok', bad: 'text-bad', sim: 'text-sim', info: 'text-info' }[tone] : 'text-ink';
  return (
    <div className="card p-3" data-testid="metric">
      <div className="caps">{label}</div>
      <div className={`num mt-0.5 text-[22px] font-semibold ${cls}`}>{value}</div>
      {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}
