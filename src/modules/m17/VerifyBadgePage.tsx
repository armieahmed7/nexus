// F04 /verify/badge/:id (and /verify/badge): public badge verification. Looks the share link up through rpc.verifyBadge
// (rate-limited, audited; holder initials only), checks the Ed25519 signature in the browser against the published issuer
// keys, and shows the criteria and skills. A downloaded credential can be pasted or uploaded: any change to any field
// makes the signature invalid. Internal Kafa'a credential; not a FANR certificate or licence.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Callout, KeyValue, TextArea, Icon, Skeleton } from '../../ui';
import { useQuery, useRepo, type Result } from '../../data';
import { useT, useLang, useFormat, L } from '../../i18n';
import { verifyCredential, ISSUER_KEYS, NOTICE_AR, NOTICE_EN, type CredentialCheck } from './issuer';
import { BadgeMedal, BadgeStatusPill } from './ui';
import { SignatureChip, issuerKeyUrl } from './WalletPage';
import type { BadgeCheck } from './backend/rpc';

type Cred = Record<string, any>;

export default function VerifyBadgePage() {
  const t = useT();
  const lang = useLang();
  const { id } = useParams();
  return (
    <Page title={t(id ? 'm17.routes.verify-badge.title' : 'm17.routes.verify-badge-check.title')} intro={t('m17.verify.intro')}>
      <Callout tone="info" title={t('m17.verify.bannerTitle')}>
        {lang === 'ar' ? NOTICE_AR : NOTICE_EN}{' '}
        <a href="https://www.fanr.gov.ae/en" target="_blank" rel="noopener noreferrer">fanr.gov.ae <Icon name="external" size={12} className="inline" /></a>
      </Callout>
      {id && <Lookup slug={id} />}
      <CheckFile />
      <p className="text-[12.5px] text-ink-3">
        {t('m17.verify.keysNote')}{' '}
        <a href={issuerKeyUrl()} target="_blank" rel="noopener noreferrer">{t('m17.wallet.issuerKey')}</a>
      </p>
    </Page>
  );
}

function Lookup({ slug }: { slug: string }) {
  const t = useT();
  const repo = useRepo();
  const [res, setRes] = useState<Result<BadgeCheck> | null>(null);
  useEffect(() => {
    let live = true;
    repo.rpc.verifyBadge(slug).then((r) => live && setRes(r), (e: unknown) => live && setRes({ ok: false, code: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => { live = false; };
  }, [repo, slug]);
  if (!res) return <Skeleton lines={5} />;
  if (!res.ok || !res.data?.credential)
    return (
      <Callout tone="bad" title={res.code === 'rate_limited' ? t('m17.verify.rateLimited') : t('m17.verify.notFound')}>
        <span data-testid="m17-verify-result" data-outcome={res.code}>{res.code === 'rate_limited' ? res.message : t('m17.verify.notFoundBody')}</span>
      </Callout>
    );
  return <CredentialCard cred={res.data.credential as Cred} status={res.data.status ?? 'active'} check={verifyCredential(res.data.credential)} checkedOn={res.data.checked_on} />;
}

export function CredentialCard({ cred, status, check, checkedOn }: { cred: Cred; status: string | null; check: CredentialCheck; checkedOn?: string }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const a = cred?.credentialSubject?.achievement ?? {};
  // The signed credential carries English skill names; in Arabic the chips show the catalogue's Arabic name (display only).
  const repo = useRepo();
  const sk = useQuery(['skills'], () => repo.list('skills'), [lang]);
  const arName = new Map((sk.data ?? []).map((x) => [`urn:kafaa:skill:${x.id}`, x.name_ar]));
  const ok = check.outcome === 'valid';
  const key = check.keyId ? ISSUER_KEYS[check.keyId] : null;
  return (
    <Card padded={false}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row" data-testid="m17-verify-result" data-outcome={check.outcome} data-status={status ?? ''}>
        <BadgeMedal code={String(a.humanCode ?? '')} status={ok ? (status ?? 'active') : 'revoked'} size={88} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="caps">{t(`m17.badge.kind.${a.achievementType === 'Certificate' ? 'certificate' : 'completion'}`)} · {String(a.humanCode ?? '')}</div>
          <div className="text-[18px] font-semibold leading-snug">{lang === 'ar' ? a.nameAr ?? a.name : a.name}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {status && <BadgeStatusPill status={status} />}
            <SignatureChip outcome={check.outcome} keyId={check.keyId} />
          </div>
          {!ok && (
            <Callout tone="bad" title={t(`m17.sig.${check.outcome}`)}>{t('m17.verify.invalidBody')}</Callout>
          )}
          {ok && status && status !== 'active' && <Callout tone="sim" title={t(`m17.verify.status.${status}`)}>{t(`m17.verify.statusBody.${status}`)}</Callout>}
          <KeyValue
            items={[
              [t('m17.badge.holder'), <span className="num" key="h">{String(cred?.credentialSubject?.holderInitials ?? '—')}</span>],
              [t('m17.verify.issuer'), String(cred?.issuer?.name ?? '—')],
              [t('m17.badge.issued'), cred?.validFrom ? f.date(String(cred.validFrom).slice(0, 10)) : '—'],
              [t('m17.badge.validTo'), cred?.validUntil ? f.date(String(cred.validUntil).slice(0, 10)) : t('m17.badge.noExpiry')],
              [t('m17.verify.criteria'), String((lang === 'ar' ? a.criteriaAr : a.criteria?.narrative) ?? '—')],
              [t('m17.verify.key'), key ? (lang === 'ar' ? key.label_ar : key.label_en) : '—'],
              ...(checkedOn ? [[t('m17.verify.checked'), f.date(checkedOn)] as [string, string]] : []),
            ]}
          />
          {Array.isArray(a.alignment) && a.alignment.length > 0 && (
            <div>
              <div className="caps mb-1">{t('m17.badge.alignment')}</div>
              <div className="flex flex-wrap gap-1">
                {a.alignment.map((x: Cred) => (
                  <span key={String(x.targetUrl)} className="chip border-line bg-sunken text-ink-2">
                    <span className="num">{String(x.targetCode)}</span> {String((lang === 'ar' && arName.get(String(x.targetUrl))) || x.targetName)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Paste or upload a downloaded credential: the signature is checked in the browser; the registry gives the current status. */
export function CheckFile() {
  const t = useT();
  const repo = useRepo();
  const [text, setText] = useState('');
  const [out, setOut] = useState<{ cred: Cred | null; check: CredentialCheck; status: string | null; error?: string } | null>(null);
  const run = async (raw: string) => {
    let cred: Cred | null = null;
    try { cred = JSON.parse(raw); } catch { setOut({ cred: null, check: { outcome: 'malformed', keyId: null, slug: null }, status: null, error: t('m17.verify.notJson') }); return; }
    const check = verifyCredential(cred);
    let status: string | null = null;
    if (check.outcome === 'valid' && check.slug) {
      const r = await repo.rpc.verifyBadge(check.slug).catch(() => null);
      status = r?.ok ? r.data?.status ?? null : r?.code === 'not_found' ? 'unknown' : null;
    }
    setOut({ cred, check, status });
  };
  return (
    <Card title={t('m17.verify.fileTitle')} eyebrow={t('m17.verify.fileEyebrow')}>
      <div className="space-y-3" data-testid="m17-verify-file">
        <TextArea label={t('m17.verify.paste')} name="cred" value={text} onChange={setText} rows={5} hint={t('m17.verify.pasteHint')} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!text.trim()} onClick={() => run(text)} data-testid="m17-verify-check">{t('m17.verify.check')}</button>
          <label className="btn-outline cursor-pointer">
            <Icon name="download" size={14} className="rotate-180" /> {t('m17.verify.upload')}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const s = await file.text(); setText(s); await run(s); } }} />
          </label>
        </div>
        <div aria-live="polite">
          {out && out.error && <Callout tone="bad" title={t('m17.sig.malformed')}><span data-testid="m17-file-outcome" data-outcome="malformed">{out.error}</span></Callout>}
          {out && !out.error && (
            <>
              <span className="sr-only" data-testid="m17-file-outcome" data-outcome={out.check.outcome}>{t(`m17.sig.${out.check.outcome}`)}</span>
              {out.status === 'unknown' && <Callout tone="bad" title={t('m17.verify.unknownTitle')}>{t('m17.verify.unknownBody')}</Callout>}
              {out.cred && <CredentialCard cred={out.cred} status={out.status && out.status !== 'unknown' ? out.status : null} check={out.check} />}
            </>
          )}
        </div>
        <p className="text-[12px] text-ink-3">{t('m17.verify.privacy')} <L to="/verify">{t('m17.verify.certLink')}</L></p>
      </div>
    </Card>
  );
}
