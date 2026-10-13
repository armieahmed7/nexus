// FS78 + FS79 shared UI (FS wave I · E1, M34): the trust-tier badge and legend (exported for the M17 wallet, learner record and credential
// views the integration lead wires, together with the pure trustTier() in extcerts.ts), balance tiles, status pills, the crosswalk mapping
// list, and an action runner that shows the backend's refusal in the reader's language. Pages never decide what the backend allows.
import { type ReactNode } from 'react';
import { Callout, ProgressBar, SimChip, StatTile, StatusPill, WhyThis, useToast, type PillTone } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import type { Result } from '../../data/types';
import { SB_MSG, grantReasons, type Balance, type Grant } from './balance';
import { TIER_BASIS, TIER_CAP, XC_MSG, trustTier, type CertLite, type MapRow, type TrustTier } from './extcerts';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const TIER_TONE: Record<TrustTier, PillTone> = { enec_assessed: 'ok', accredited: 'info', vendor_self_serve: 'accent', claimed: 'sim' };
/** The trust tier shown wherever an external credential appears (ENEC-assessed, accredited third party, vendor self-serve, or claimed). */
export function TrustTierBadge({ cert, tier }: { cert?: CertLite; tier?: TrustTier }) {
  const t = useT();
  const x = tier ?? (cert ? trustTier(cert) : 'claimed');
  return <span data-testid="m34-tier" data-tier={x}><StatusPill tone={TIER_TONE[x]}>{t(`m34.xc.tier.${x}`)}</StatusPill></span>;
}
export function TierLegend() {
  const t = useT();
  const f = useFormat();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-tier-legend">
      {(['enec_assessed', 'accredited', 'vendor_self_serve', 'claimed'] as TrustTier[]).map((x) => (
        <div key={x} className="rounded-card border border-line bg-panel p-3">
          <TrustTierBadge tier={x} />
          <p className="mt-2 text-[13px] text-ink-2">{t(`m34.xc.tierHelp.${x}`)}</p>
          <p className="mt-1 text-[12px] text-ink-3">{x === 'claimed' ? t('m34.xc.noEvidence') : t('m34.xc.evidenceAs', { basis: t(`m34.xc.basis.${TIER_BASIS[x]}`), l: f.num(TIER_CAP[x]) })}</p>
        </div>
      ))}
    </div>
  );
}

const SB_KEY = new Map(Object.entries(SB_MSG).map(([k, v]) => [v, k]));
const XC_KEY = new Map(Object.entries(XC_MSG).map(([k, v]) => [v, k]));
/** Run an RPC: success toast from i18n; a refusal is shown in the reader's language when it is one of ours. */
export function useFs91Act() {
  const t = useT();
  const toast = useToast();
  return async <T,>(fn: () => Promise<Result<T>>, success: string): Promise<Result<T>> => {
    try {
      const r = await fn();
      if (r.ok) toast.push({ tone: 'ok', title: success });
      else {
        const sk = SB_KEY.get(r.message ?? '');
        const xk = XC_KEY.get(r.message ?? '');
        toast.push({ tone: 'bad', title: sk ? t(`m34.sbmsg.${sk}`) : xk ? t(`m34.xcmsg.${xk}`) : (r.message ?? r.code), detail: r.code });
      }
      return r;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.push({ tone: 'bad', title: message });
      return { ok: false, code: 'error', message } as Result<T>;
    }
  };
}

const REQ_TONE: Record<string, PillTone> = { requested: 'info', approved: 'ok', declined: 'bad', withdrawn: 'neutral' };
export function StudyStatus({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={REQ_TONE[status] ?? 'neutral'}>{t(`m34.sb.status.${status}`)}</StatusPill>;
}
const CERT_TONE: Record<string, PillTone> = { submitted: 'info', verified: 'ok', rejected: 'bad', withdrawn: 'neutral', revoked: 'bad' };
export function CertStatus({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={CERT_TONE[status] ?? 'neutral'}>{t(`m34.xc.status.${status}`)}</StatusPill>;
}
/** Hours shown as credits (1 credit = 10 hours), one decimal, in the reader's digits. */
export function useCreditsOf() {
  const f = useFormat();
  return (hours: number | null | undefined) => f.num(Math.trunc(Number(hours) || 0) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Four tiles: granted (with the top-up), approved use, reserved, available; a usage bar and why the grant is what it is. */
export function BalanceTiles({ balance, grant, testId = 'm34-sb-tiles' }: { balance: Balance; grant: Grant; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const c = useCreditsOf();
  const pct = balance.granted_hours ? Math.round((balance.used_hours / balance.granted_hours) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid={testId}>
        <StatTile label={t('m34.sb.tGranted')} value={t('m34.sb.credits', { c: c(balance.granted_hours) })} sub={t('m34.sb.tGrantedSub', { h: f.num(balance.granted_hours), top: f.num(grant.topup_hours) })} sim />
        <StatTile label={t('m34.sb.tUsed')} value={t('m34.sb.credits', { c: c(balance.used_hours) })} sub={t('m34.sb.hours', { h: f.num(balance.used_hours) })} tone="ok" />
        <StatTile label={t('m34.sb.tPending')} value={t('m34.sb.credits', { c: c(balance.pending_hours) })} sub={t('m34.sb.hours', { h: f.num(balance.pending_hours) })} tone="info" />
        <StatTile label={t('m34.sb.tAvailable')} value={t('m34.sb.credits', { c: c(balance.available_hours) })} sub={t('m34.sb.tAvailableSub', { h: f.num(balance.available_hours), r: f.num(balance.remaining_hours) })} tone="sim" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1"><ProgressBar value={pct} tone="ok" label={t('m34.sb.usedPct', { p: f.pct(pct, 0) })} /></div>
        <SimChip />
        <WhyThis reasons={grantReasons(grant)} label={t('m34.sb.whyGrant')} testId="m34-sb-why-grant" />
      </div>
    </div>
  );
}

const MAP_TONE: Record<string, PillTone> = { maps: 'ok', unreviewed: 'sim', retired: 'neutral', missing: 'bad', restricted: 'bad' };
/** The crosswalk entries a certificate names, with whether each maps (reviewed) and at which level. */
export function MappingList({ rows, skills, verified }: { rows: MapRow[]; skills: Map<string, Row>; verified: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!rows.length) return <p className="text-[13px] text-ink-3">{t('m34.xc.noRows')}</p>;
  return (
    <ul className="space-y-1.5" data-testid="m34-xc-mapping">
      {rows.map((r) => (
        <li key={r.alignment_id} className="flex flex-wrap items-center gap-2 text-[13px]" data-state={r.state}>
          <StatusPill tone={MAP_TONE[r.state]}>{t(`m34.xc.map.${r.state}`)}</StatusPill>
          <span className="font-semibold">{pick(r, 'label') || r.alignment_id}</span>
          {r.framework && <span className="chip border-line bg-sunken text-ink-2">{t(`m34.xc.fw.${r.framework}`)}</span>}
          {r.skill_id && <span className="text-ink-3">→ {pick(skills.get(r.skill_id), 'name') || r.skill_id}</span>}
          {r.state === 'maps' && <span className="text-ink-2">{verified ? t('m34.xc.mapsAt', { l: f.num(r.level) }) : t('m34.xc.willMapAt', { l: f.num(r.level) })}</span>}
        </li>
      ))}
    </ul>
  );
}

export function FsNote({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <Callout tone="info" title={title}>{children}</Callout>;
}
export function Fs91Footer() {
  const t = useT();
  return <div data-testid="m34-fs91-sim"><Callout tone="sim" title={t('m34.sb.simTitle')}>{t('m34.sb.simBody')}</Callout></div>;
}
export const isoToday = () => new Date().toISOString().slice(0, 10);
