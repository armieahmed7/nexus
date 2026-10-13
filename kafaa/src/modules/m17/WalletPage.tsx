// F04 /my/skills/wallet: Credential Wallet. Every Kafa'a course certificate and course completion can be wrapped in a signed
// Open Badges 3.0-shaped credential (Ed25519), shared through a public verify link that shows holder initials only,
// downloaded as JSON, or withdrawn. FANR licences and qualification mirrors are never issued as badges.
import { useMemo, useState } from 'react';
import { Page, Async, Card, Callout, ConfirmDialog, EmptyState, StatusPill, Icon, downloadText, useToast } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { badgeCandidates, badgeView, daysUntil } from './walletRules';
import { verifyCredential, ISSUER_KEYS, type KeyId } from './issuer';
import { BadgeMedal, BadgeStatusPill, Stat, usePassportData, type PassportData } from './ui';
import { ExternalCertsCard } from './xcUi'; // FS79 -> M17 (wave I integration): external certificates with their trust tier

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// The issuer keys link points at a copy outside any dot-directory (/kafaa/issuer/), which every static host serves. The URL inside
// signed credentials stays /kafaa/.well-known/kafaa-issuer.json; on Netlify, _redirects rewrites it to the deploy-root /.well-known/.
export const issuerKeyUrl = () => `${import.meta.env.BASE_URL ?? '/kafaa/'}issuer/kafaa-issuer.json`;
export const shareUrl = (slug: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}${import.meta.env.BASE_URL ?? '/kafaa/'}verify/badge/${slug}`;

export default function WalletPage() {
  const t = useT();
  const s = useSession();
  const q = usePassportData(s.identity.personId);
  return (
    <Page title={t('m17.routes.my-skills-wallet.title')} intro={t('m17.wallet.intro')} actions={<L to="/my/skills" className="btn-outline btn-sm no-underline">{t('m17.wallet.toPassport')}</L>}>
      <Callout tone="sim" title={t('m17.wallet.noticeTitle')}>{t('m17.wallet.notice')}</Callout>
      <Async state={q}>{(d) => <Wallet d={d} me={s.identity.personId!} />}</Async>
    </Page>
  );
}

function Wallet({ d, me }: { d: PassportData; me: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const toast = useToast();
  const today = todayIso();
  const [issuing, setIssuing] = useState<Row | null>(null);
  const [revoking, setRevoking] = useState<Row | null>(null);
  const cands = useMemo(
    () => badgeCandidates({ me, today, initials: d.person?.initials ?? '—', certificates: d.certificates, training_records: d.training, courses: d.courses, competencies: d.comps, badges: d.badges, licences: d.licences, qual_records: d.quals }),
    [d, me, today],
  );
  const views = d.badges.map((b) => ({ b, status: badgeView(b, today, d.certificates), check: verifyCredential(b.credential) }));
  const active = views.filter((v) => v.status === 'active');
  const soon = active.filter((v) => v.b.valid_to && daysUntil(today, v.b.valid_to) <= 90);
  const ready = cands.filter((c) => c.code === 'ok');
  const skillName = (id: string) => pick(d.skills.find((s) => s.id === id), 'name');
  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(slug));
      toast.push({ tone: 'ok', title: t('m17.wallet.copied') });
    } catch {
      toast.push({ tone: 'info', title: shareUrl(slug) });
    }
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label={t('m17.wallet.statActive')} value={f.num(active.length)} tone="ok" />
        <Stat label={t('m17.wallet.statReady')} value={f.num(ready.length)} tone="info" sub={t('m17.wallet.statReadySub')} />
        <Stat label={t('m17.wallet.statSoon')} value={f.num(soon.length)} tone={soon.length ? 'sim' : undefined} sub={t('m17.wallet.statSoonSub')} />
        <Stat label={t('m17.wallet.statInactive')} value={f.num(views.length - active.length)} sub={t('m17.wallet.statInactiveSub')} />
      </div>

      <section aria-labelledby="m17-badges-h" className="space-y-3">
        <h2 id="m17-badges-h" className="text-[16px] font-semibold">{t('m17.wallet.badges')}</h2>
        {views.length === 0 ? (
          <EmptyState title={t('m17.wallet.none')}>{t('m17.wallet.noneBody')}</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="m17-wallet">
            {views.map(({ b, status, check }) => (
              <li key={b.id} className="card flex flex-col p-4" data-testid="m17-badge-card" data-status={status}>
                <div className="flex items-start gap-3">
                  <BadgeMedal code={b.achievement?.code ?? ''} status={status} />
                  <div className="min-w-0 flex-1">
                    <div className="caps">{t(`m17.badge.kind.${b.achievement?.kind ?? 'completion'}`)} · {b.achievement?.code}</div>
                    <div className="font-semibold leading-snug">{pick(b.achievement, 'name')}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <BadgeStatusPill status={status} />
                      <SignatureChip outcome={check.outcome} keyId={check.keyId} />
                    </div>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="caps">{t('m17.badge.issued')}</dt>
                  <dd className="text-ink-2">{f.date(b.issued_on)}</dd>
                  <dt className="caps">{t('m17.badge.validTo')}</dt>
                  <dd className="text-ink-2">{b.valid_to ? f.date(b.valid_to) : t('m17.badge.noExpiry')}</dd>
                  <dt className="caps">{t('m17.badge.holder')}</dt>
                  <dd className="num text-ink-2">{b.holder_initials}</dd>
                  <dt className="caps">{t('m17.badge.link')}</dt>
                  <dd className="truncate"><code className="text-[11.5px]">{b.public_slug}</code></dd>
                </dl>
                {(b.achievement?.skills ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="caps me-1 self-center">{t('m17.badge.alignment')}</span>
                    {(b.achievement.skills as string[]).map((id) => (
                      <span key={id} className="chip border-line bg-sunken text-ink-2">{skillName(id)}</span>
                    ))}
                  </div>
                )}
                {b.status === 'revoked' && b.revoke_reason && <p className="mt-2 text-[12.5px] text-bad">{t('m17.badge.revokedBecause', { reason: b.revoke_reason })}</p>}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <button type="button" className="btn-outline btn-sm" onClick={() => copy(b.public_slug)} disabled={status !== 'active'} data-testid="m17-share">
                    <Icon name="link" size={13} /> {t('m17.badge.copy')}
                  </button>
                  <L to={`/verify/badge/${b.public_slug}`} className="btn-ghost btn-sm no-underline" data-testid="m17-open-verify">
                    <Icon name="external" size={13} /> {t('m17.badge.verify')}
                  </L>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => downloadText(`kafaa-badge-${b.public_slug}.json`, JSON.stringify(b.credential, null, 2), 'application/json')} data-testid="m17-download">
                    <Icon name="download" size={13} /> {t('m17.badge.download')}
                  </button>
                  {b.status === 'active' && (
                    <button type="button" className="btn-ghost btn-sm text-bad" onClick={() => setRevoking(b)} data-testid="m17-withdraw">
                      {t('m17.badge.withdraw')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExternalCertsCard personId={me} />

      <Card title={t('m17.wallet.ready')} eyebrow={t('m17.wallet.readyEyebrow')}>
        {cands.length === 0 ? (
          <p className="text-[13px] text-ink-3">{t('m17.wallet.noSources')}</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="m17-candidates">
            {cands.map((c) => {
              const course = d.courses.find((x) => x.id === c.course_id);
              const src = c.source;
              return (
                <li key={c.source_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5" data-code={c.code}>
                  <div className="min-w-0">
                    <div className="font-medium">{course?.code} · {pick(course, 'title')}</div>
                    <div className="text-[12px] text-ink-3">
                      {t(`m17.badge.kind.${src?.kind ?? (c.source_id.startsWith('tr-') ? 'completion' : 'certificate')}`)} · <code>{src?.kind === 'certificate' || !src ? c.source_id : t('m17.wallet.completionRef')}</code>
                      {src && <> · {f.date(src.source_date)}</>}
                    </div>
                  </div>
                  {c.code === 'ok' ? (
                    <button type="button" className="btn-primary btn-sm" onClick={() => setIssuing({ ...c, course })} data-testid={`m17-issue-${c.source_id}`}>
                      <Icon name="sparkle" size={13} /> {t('m17.wallet.issue')}
                    </button>
                  ) : (
                    <StatusPill status={c.code === 'already_issued' ? 'active' : c.code === 'security_restricted' ? 'reserved' : 'expired'} tone={c.code === 'already_issued' ? 'ok' : c.code === 'security_restricted' ? 'reserved' : 'bad'}>
                      {t(`m17.wallet.why.${c.why ?? c.code}`)}
                    </StatusPill>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-ink-3">{t('m17.wallet.neverMirrors')}</p>
      </Card>

      <Card title={t('m17.wallet.howTitle')}>
        <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
          <li>{t('m17.wallet.how1')}</li>
          <li>{t('m17.wallet.how2')}</li>
          <li>{t('m17.wallet.how3')}</li>
        </ul>
        <a className="mt-2 inline-flex items-center gap-1 text-[13px]" href={issuerKeyUrl()} target="_blank" rel="noopener noreferrer" data-testid="m17-issuer-key">
          {t('m17.wallet.issuerKey')} <Icon name="external" size={12} />
        </a>
      </Card>

      <ConfirmDialog
        open={!!issuing}
        onClose={() => setIssuing(null)}
        title={t('m17.wallet.issueTitle', { course: issuing?.course?.code ?? '' })}
        consequence={t('m17.wallet.issueConsequence')}
        confirmLabel={t('m17.wallet.issue')}
        onConfirm={async () => {
          const r = await act(() => repo.rpc.issueBadge(issuing!.source_id), { success: t('m17.wallet.issued') });
          if (r.ok) setIssuing(null);
        }}
      />
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={t('m17.badge.withdrawTitle')}
        consequence={t('m17.badge.withdrawConsequence')}
        requireReason
        reasonLabel={t('m17.badge.withdrawReason')}
        confirmLabel={t('m17.badge.withdraw')}
        danger
        onConfirm={async (reason) => {
          const r = await act(() => repo.rpc.revokeBadge(revoking!.id, reason), { success: t('m17.badge.withdrawn') });
          if (r.ok) setRevoking(null);
        }}
      />
    </div>
  );
}

export function SignatureChip({ outcome, keyId }: { outcome: string; keyId: KeyId | null }) {
  const t = useT();
  const lang = useFormat().locale.startsWith('ar') ? 'ar' : 'en';
  if (outcome !== 'valid') return <span className="chip border-bad-line bg-bad-bg text-bad" data-testid="m17-sig" data-sig={outcome}><Icon name="alert" size={12} /> {t(`m17.sig.${outcome}`)}</span>;
  const key = keyId ? ISSUER_KEYS[keyId] : null;
  return (
    <span className={`chip ${keyId === 'key-1' ? 'border-ok-line bg-ok-bg text-ok' : 'border-sim-line bg-sim-bg text-sim'}`} data-testid="m17-sig" data-sig="valid" title={key ? (lang === 'ar' ? key.label_ar : key.label_en) : undefined}>
      <Icon name="check" size={12} /> {keyId === 'key-1' ? t('m17.sig.valid') : t('m17.sig.validOffline')}
    </span>
  );
}
