// FS79 -> M17 (FS wave I integration): external certificates where M17 lists credentials (the wallet, my micro-credentials page and the
// learner record), each with its trust tier (trustTier() and <TrustTierBadge> from M34). A certificate that is not verified shows
// "Claimed (not verified)" and never counts as evidence; only verified, unexpired certificates are record items (kind xcert).
import { Card, EmptyState, StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, useFormat, L } from '../../i18n';
import { trustTier, type CertLite, type TrustTier } from '../m34/extcerts';
import { TrustTierBadge, CertStatus } from '../m34/fs91ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Tier names for WhyThis reasons (the badge itself reads m34.xc.tier.*). */
export const XTIER_EN: Record<string, string> = { enec_assessed: 'ENEC-assessed', accredited: 'accredited third party', vendor_self_serve: 'vendor self-serve' };
export const XTIER_AR: Record<string, string> = { enec_assessed: 'مُقيَّمة من المؤسسة', accredited: 'جهة خارجية معتمدة', vendor_self_serve: 'ذاتية من المزوّد' };

/** Status of a learner-record item: the trust tier badge for a verified external certificate (kind xcert), else the FS32 status text. */
export function ItemStatus({ i }: { i: { kind: string; status: string } }) {
  const t = useT();
  return i.kind === 'xcert' ? <TrustTierBadge tier={i.status as TrustTier} /> : <>{t(`m17.lr.status.${i.status}`)}</>;
}

/** The person's external certificates (RLS: the holder, a manager in scope, verifiers and auditors), newest first. */
export function useExternalCerts(personId: string | null) {
  const repo = useRepo();
  return useQuery(['external_certs'], async () => {
    if (!personId) return { rows: [] as Row[] };
    const rows = (await repo.list('external_certs' as never, { filter: { person_id: personId } } as never).catch(() => [])) as Row[];
    return { rows: [...rows].sort((a, b) => cmp(String(b.issued_on ?? ''), String(a.issued_on ?? '')) || cmp(a.id, b.id)) };
  }, [personId]);
}

/** One external certificate line: title, issuer, dates, status and the trust tier. */
export function ExternalCertLine({ c }: { c: Row }) {
  const t = useT();
  const f = useFormat();
  const tier = trustTier(c as CertLite);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2.5" data-testid="m17-xcert" data-tier={tier} data-status={c.status}>
      <div className="min-w-0 basis-56 grow">
        <div className="font-medium leading-snug">{c.title}</div>
        <div className="text-[12px] text-ink-3">
          {c.issuer} · <span className="num">{c.credential_ref}</span> · {f.date(c.issued_on)}
          {c.expires_on && <> · {t('m17.xc.expires', { date: f.date(c.expires_on) })}</>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TrustTierBadge tier={tier} />
        {c.status !== 'verified' && <CertStatus status={c.status} />}
      </div>
    </li>
  );
}

/** "External certificates" card: every certificate with its trust tier, and the way to add or follow one (M34). */
export function ExternalCertsCard({ personId, readOnly = false }: { personId: string | null; readOnly?: boolean }) {
  const t = useT();
  const f = useFormat();
  const q = useExternalCerts(personId);
  const rows = q.data?.rows ?? [];
  const verified = rows.filter((c) => c.status === 'verified').length;
  return (
    <Card title={t('m17.xc.title')} eyebrow={t('m17.xc.eyebrow', { n: f.num(verified), all: f.num(rows.length) })}
      actions={readOnly ? undefined : <L to="/my/recognition/certificates" className="btn-outline btn-sm no-underline" data-testid="m17-xcert-manage">{t('m17.xc.manage')}</L>}>
      <div data-testid="m17-xcerts">
        <p className="text-[12.5px] text-ink-2">{t('m17.xc.body')}</p>
        {q.loading ? <p className="mt-2 text-[12.5px] text-ink-3">{t('m17.xc.loading')}</p>
          : rows.length ? <ul className="mt-1 divide-y divide-line">{rows.map((c) => <ExternalCertLine key={c.id} c={c} />)}</ul>
          : <EmptyState title={t('m17.xc.empty')}>{t('m17.xc.emptyBody')}</EmptyState>}
        <p className="mt-2 text-[12px] text-ink-3"><StatusPill tone="sim">{t('m17.xc.notAuthority')}</StatusPill></p>
      </div>
    </Card>
  );
}
