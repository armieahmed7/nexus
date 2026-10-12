// FS32 /verify/record/:token: public verification of a shared learner record (anyone; rate-limited; audited). An active link
// shows only the items the holder chose and their initials; the embedded signed credentials are checked in the browser against
// the published issuer keys. An expired or revoked link shows nothing personal (no initials, no items, no counts).
import { useParams } from 'react-router-dom';
import { Page, BenchmarkChips, Callout, Card, EmptyState, Icon, KeyValue, Skeleton, StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { verifyCredential } from './issuer';
import { SignatureChip, issuerKeyUrl } from './WalletPage';
import { ITEM_KINDS, type RecordItem, type VerifyResult } from './learnerRecord';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function VerifyRecordPage() {
  const t = useT();
  const { token = '' } = useParams();
  const repo = useRepo();
  const q = useQuery(['record_shares'], () => repo.rpc.verifyRecordShare(token), [token]);
  return (
    <Page title={t('m17.routes.verify-record.title')} eyebrow={<BenchmarkChips feature="FS32" />} intro={t('m17.lr.verify.intro')}>
      <Callout tone="info" title={t('m17.lr.verify.bannerTitle')}>{t('m17.lr.verify.banner')}</Callout>
      {q.error ? <EmptyState title={t('m17.lr.verify.error')}>{String(q.error.message)}</EmptyState>
        : !q.data ? <Skeleton lines={5} />
        : !q.data.ok ? <Missing code={q.data.code ?? 'not_found'} />
        : <Shown v={q.data.data as VerifyResult} />}
      <p className="text-[12.5px] text-ink-3">{t('m17.verify.keysNote')} <a href={issuerKeyUrl()} target="_blank" rel="noopener noreferrer">{t('m17.wallet.issuerKey')}</a></p>
    </Page>
  );
}

function Missing({ code }: { code: string }) {
  const t = useT();
  return (
    <div data-testid="m17-lr-verify" data-status={code}>
      <EmptyState title={t(code === 'rate_limited' ? 'm17.lr.verify.rateTitle' : 'm17.lr.verify.notFoundTitle')}>{t(code === 'rate_limited' ? 'm17.lr.verify.rateBody' : 'm17.lr.verify.notFoundBody')}</EmptyState>
    </div>
  );
}

function Shown({ v }: { v: VerifyResult }) {
  const t = useT();
  const f = useFormat();
  if (v.status !== 'active') {
    return (
      <Card>
        <div className="flex items-start gap-3" data-testid="m17-lr-verify" data-status={v.status}>
          <Icon name="lock" size={20} className="mt-0.5 text-ink-3" />
          <div className="space-y-1">
            <StatusPill tone={v.status === 'revoked' ? 'bad' : 'neutral'} status={v.status}>{t(`m17.lr.share.${v.status}`)}</StatusPill>
            <p className="text-[14px] font-semibold">{t(`m17.lr.verify.${v.status}Title`)}</p>
            <p className="text-[13px] text-ink-2">{t('m17.lr.verify.closedBody')}</p>
            <p className="text-[12px] text-ink-3">{t('m17.lr.verify.checkedOn', { date: f.date(v.checked_on) })}</p>
          </div>
        </div>
      </Card>
    );
  }
  const clr = (v.clr ?? {}) as Row;
  const items = (clr.kafaaItems ?? []) as Omit<RecordItem, 'id'>[];
  const vcs = ((clr.credentialSubject?.verifiableCredential ?? []) as Row[]).filter((c) => c && c.proof);
  const checks = vcs.map((c) => ({ name: String(c.name ?? c.credentialSubject?.achievement?.name ?? c.id ?? ''), ...verifyCredential(c) }));
  const valid = checks.filter((c) => c.outcome === 'valid').length;
  return (
    <div className="space-y-4" data-testid="m17-lr-verify" data-status="active">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent bg-accent/10 text-[18px] font-bold text-accent" data-testid="m17-lr-verify-initials" dir="ltr">{v.holder_initials}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2"><StatusPill tone="ok" status="active">{t('m17.lr.share.active')}</StatusPill><span className="text-[12.5px] text-ink-3">{t('m17.lr.verify.initialsOnly')}</span></div>
            <KeyValue items={[
              [t('m17.lr.verify.items'), f.num(v.item_count ?? items.length)],
              [t('m17.lr.verify.validUntil'), v.expires_on ? f.date(v.expires_on) : '—'],
              [t('m17.lr.verify.signed'), t('m17.lr.verify.signedN', { ok: f.num(valid), n: f.num(checks.length) })],
            ]} />
            {v.purpose === 'prearrival' && <p className="text-[12.5px] text-ink-2" data-testid="m17-lr-verify-purpose">{t('m17.lr.verify.prearrival')}</p>}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {ITEM_KINDS.map((k) => {
          const xs = items.filter((i) => i.kind === k);
          if (!xs.length) return null;
          return (
            <Card key={k} title={t(`m17.lr.kind.${k}`)}>
              <ul className="space-y-1.5" data-testid={`m17-lr-verify-${k}`}>{xs.map((i) => <VerifyLine key={i.ref} i={i} />)}</ul>
            </Card>
          );
        })}
      </div>
      {checks.length > 0 && (
        <Card title={t('m17.lr.verify.sigTitle')}>
          <ul className="space-y-1.5" data-testid="m17-lr-verify-sigs">{checks.map((c, n) => <li key={n} className="flex flex-wrap items-center justify-between gap-2 text-[13px]"><span>{c.name}</span><SignatureChip outcome={c.outcome} keyId={c.keyId} /></li>)}</ul>
        </Card>
      )}
      <p className="text-[12px] text-ink-3">{t('m17.lr.verify.notice')}</p>
    </div>
  );
}

function VerifyLine({ i }: { i: Omit<RecordItem, 'id'> }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  return (
    <li className="rounded-card border border-line px-3 py-2" data-kind={i.kind}>
      <span className="block text-[13.5px] font-semibold">{pick(i, 'title')}</span>
      <span className="block text-[12px] text-ink-3"><span className="num">{i.code}</span> · {t(`m17.lr.status.${i.status}`)}{i.level != null && <> · {t('common.skills.level', { level: f.num(i.level) })}</>}{i.band && <> · {t(`m17.lr.band.${i.band}`)}</>}{i.date && <> · {f.date(i.date)}</>}</span>
    </li>
  );
}
