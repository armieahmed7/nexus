// FS54 (wave F · E3): shared pieces of the skills council pages (change log, propose, council queue, catalogue health).
import type { ReactNode } from 'react';
import { useFormat, useT } from '../../i18n';
import { Icon, StatusPill } from '../../ui';
import type { PillTone } from '../../ui/Page';
import type { ChangeKind, InclusionKey, RequestStatus, Vote } from './taxonomyGov';

/** Month label (YYYY-MM) in the reader's locale, digits and calendar (useFormat().locale). */
export function monthLabel(locale: string, ym: string, short = false): string {
  return new Intl.DateTimeFormat(locale, short ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`));
}

export const KIND_ICON: Record<ChangeKind, string> = { add: 'plus', rename: 'book', split: 'sort', retire: 'lock', relevel: 'chart' };
const KIND_TONE: Record<ChangeKind, PillTone> = { add: 'ok', rename: 'info', split: 'accent', retire: 'neutral', relevel: 'sim' };
const STATUS_TONE: Record<RequestStatus, PillTone> = { submitted: 'info', first_approved: 'accent', first_rejected: 'sim', published: 'ok', rejected: 'bad' };

export function KindPill({ kind }: { kind: ChangeKind | string }) {
  const t = useT();
  return <span data-kind={kind}><StatusPill tone={KIND_TONE[kind as ChangeKind] ?? 'neutral'}>{t(`m16.gov.kind.${kind}`)}</StatusPill></span>;
}
export function RequestStatusPill({ status }: { status: RequestStatus | string }) {
  const t = useT();
  return <span data-status={status}><StatusPill tone={STATUS_TONE[status as RequestStatus] ?? 'neutral'}>{t(`m16.gov.status.${status}`)}</StatusPill></span>;
}
export function useRoleLabel() {
  const t = useT();
  return (role: string | null | undefined) => (role ? t(`m16.gov.role.${role}`) : t('m16.gov.role.unknown'));
}

/** The inclusion-rule checks with a tick or a cross and what each one means. */
export function InclusionList({ checks, compact }: { checks: { key: InclusionKey | string; ok: boolean }[]; compact?: boolean }) {
  const t = useT();
  return (
    <ul className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'} data-testid="m16-inclusion" data-ok={checks.every((c) => c.ok)}>
      {checks.map((c) => compact ? (
        <li key={c.key} className={`chip ${c.ok ? 'border-ok-line bg-ok-bg text-ok' : 'border-bad-line bg-bad-bg text-bad'}`} data-check={c.key} data-ok={c.ok}>
          <Icon name={c.ok ? 'check' : 'close'} size={12} />{t(`m16.gov.inc.${c.key}`)}
        </li>
      ) : (
        <li key={c.key} className="flex items-start gap-2 text-[13px]" data-check={c.key} data-ok={c.ok}>
          <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`}><Icon name={c.ok ? 'check' : 'close'} size={12} /></span>
          <span className="min-w-0"><span className="font-semibold">{t(`m16.gov.inc.${c.key}`)}</span><span className="block text-[12px] text-ink-3">{t(`m16.gov.incHelp.${c.key}`)}</span></span>
        </li>
      ))}
    </ul>
  );
}

/** The council votes of a request, oldest first (role, decision, note, date). People are shown by role only. */
export function VoteList({ votes, empty }: { votes: Vote[]; empty?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const role = useRoleLabel();
  if (!votes.length) return <p className="text-[12.5px] text-ink-3">{empty ?? t('m16.gov.votes.none')}</p>;
  return (
    <ol className="space-y-2" data-testid="m16-votes">
      {votes.map((v, i) => (
        <li key={`${v.by}:${v.at}:${i}`} className="flex items-start gap-2 text-[13px]" data-decision={v.decision}>
          <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${v.decision === 'approve' ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`}>{f.num(i + 1)}</span>
          <span className="min-w-0">
            <span className="font-semibold">{role(v.role)}</span> · {t(`m16.gov.decision.${v.decision}`)} · <span className="text-ink-3">{f.date(v.at)}</span>
            {v.note && <span className="block text-ink-2">“{v.note}”</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Three-step maker-checker progress: submitted, first vote, decided. */
export function CouncilSteps({ status }: { status: RequestStatus }) {
  const t = useT();
  const step = status === 'submitted' ? 1 : status === 'first_approved' || status === 'first_rejected' ? 2 : 3;
  const keys = ['submitted', 'first', 'decided'] as const;
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11.5px]" aria-label={t('m16.gov.steps.label')}>
      {keys.map((k, i) => (
        <li key={k} className="flex items-center gap-1">
          <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 ${i + 1 < step || step === 3 ? 'bg-ok-bg text-ok' : i + 1 === step ? 'bg-accent text-white' : 'bg-sunken text-ink-3'}`}>{i + 1}</span>
          <span className={i + 1 === step ? 'font-semibold' : 'text-ink-3'}>{t(`m16.gov.steps.${k}`)}</span>
          {i < keys.length - 1 && <Icon name="chevron" size={11} className="text-ink-3 rtl:-scale-x-100" />}
        </li>
      ))}
    </ol>
  );
}
