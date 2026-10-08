/** M03 shared UI: licence and medical status pills (mirror semantics: stale never shows valid), person label, rule chip. */
import { StatusPill } from '../../ui';
import { useT, usePick } from '../../i18n';
import { licenceView, medicalView, type LicenceView } from '../../domain/rules';
import type { RowOf } from '../../data';

const LIC_TONE: Record<LicenceView, 'ok' | 'sim' | 'bad' | 'info' | 'neutral'> = { valid: 'ok', renewal_due: 'sim', lapsed: 'bad', suspended: 'bad', withdrawn: 'bad', pending: 'info', stale: 'sim' };
export const viewKey = (v: LicenceView) => v;

export function LicencePill({ lic }: { lic: Pick<RowOf<'licences'>, 'status' | 'expires_on' | 'last_synced'> }) {
  const t = useT();
  const v = licenceView(lic).view;
  return (
    <span data-testid="licence-pill" data-view={v}>
      <StatusPill tone={LIC_TONE[v]}>{t(`m03.view.${v}`)}</StatusPill>
    </span>
  );
}

const MED_TONE = { ok: 'ok', due_soon: 'sim', overdue: 'bad', not_confirmed: 'sim' } as const;
export function MedicalPill({ med }: { med: Pick<RowOf<'medical_due'>, 'due_on' | 'flag'> }) {
  const t = useT();
  const v = medicalView(med);
  return (
    <span data-testid="medical-pill" data-view={v}>
      <StatusPill tone={MED_TONE[v]}>{t(`m03.med.view_${v}`)}</StatusPill>
    </span>
  );
}

export function PersonLabel({ p }: { p: RowOf<'people'> | undefined }) {
  const pick = usePick();
  if (!p) return <span className="text-ink-3">—</span>;
  return (
    <span>
      {pick({ x_en: p.display_name, x_ar: p.display_name_ar || p.display_name }, 'x')}
      {p.crew && <span className="ms-1 text-[12px] text-ink-3">· {p.crew}</span>}
    </span>
  );
}
