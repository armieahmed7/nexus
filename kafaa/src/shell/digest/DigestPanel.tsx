// F36: the /my digest panel (anchor #digest). Shows this period's digest (up to 7 items, ordered expiry < approvals < others),
// builds it once per period when it is missing (the weekly job, run on first visit: the page passes the top Learning Coach card
// from the F07 engine as a hint), marks its notification read, and keeps the last digests for reference. Nudges off and quiet
// hours are respected; speak-up routes never render this panel.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRepo } from '../../data';
import { L, useFormat, useT } from '../../i18n';
import { Callout, Card, EmptyState, Icon, Skeleton, StatusPill } from '../../ui';
import type { Result } from '../../data/types';
import { useCoachData } from '../../modules/m19/useCoachData';
import { useRecoOptOut } from '../../modules/m16/optout';
import { dubaiHour, hintOk, inQuietHours, type DigestHints } from './rules';
import type { DigestBuildResult } from './backend/rpc';
import { DigestItemRow } from './DigestItemRow';
import { FutureNudgeStrip } from './FutureNudges';
import { useDigest, useNoNudges, type RunRow } from './useDigest';
import { useCanOpenLink } from '../GuardedLink';

export function usePeriodLabel() {
  const t = useT();
  const f = useFormat();
  return (period: string) => {
    const [y, rest] = period.split('-');
    const n = Number(rest.slice(1));
    if (rest[0] === 'W') return t('digest.period.weekly', { w: f.num(n), y: f.num(Number(y), { useGrouping: false }) });
    if (rest[0] === 'F') return t('digest.period.fortnightly', { a: f.num(2 * n - 1), b: f.num(2 * n), y: f.num(Number(y), { useGrouping: false }) });
    return t('digest.period.monthly', { date: f.date(`${y}-${rest.slice(1)}-01`, 'long') });
  };
}

/** Runs the build once: waits for the F07 coach feed (unless I opted out of coach ranking), then calls rpc.buildDigest. */
function AutoBuild({ onDone }: { onDone: (r: Result<DigestBuildResult>) => void }) {
  const repo = useRepo();
  const coach = useCoachData();
  const opt = useRecoOptOut('coach');
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || opt.loading) return;
    if (!opt.optedOut && coach.q.loading && !coach.q.error) return;
    fired.current = true;
    const top = !opt.optedOut ? coach.result?.feed[0] ?? null : null;
    const hint = top ? { id: top.id, item_id: top.itemId, title_en: top.title.en, title_ar: top.title.ar || top.title.en, link: top.link, reasons: top.reasons.slice(0, 6).map((r) => ({ code: r.code, key: r.key, vars: (r.vars ?? {}) as Record<string, unknown> })) } : null;
    const hints: DigestHints = hint && hintOk(hint) ? { coach: hint } : {};
    void repo.rpc.buildDigest(hints).then(onDone, (e) => onDone({ ok: false, code: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, [opt.loading, opt.optedOut, coach.q.loading, coach.q.error, coach.result, repo, onDone]);
  return <Skeleton lines={3} />;
}

export function DigestPanel() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const { q, view, me } = useDigest();
  const label = usePeriodLabel();
  const noNudges = useNoNudges();
  const location = useLocation();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<Result<DigestBuildResult> | null>(null);
  const [tick, setTick] = useState(0);
  // readiness fixes 2026-10-13 (finding 2): a digest built before the server-side filter may still hold items this person cannot open
  const open = useCanOpenLink();
  useEffect(() => { if (location.hash === '#digest' && view) box.current?.scrollIntoView({ block: 'start' }); }, [location.hash, view]);
  // opening the digest marks its notification read (the open rate admins see, aggregated)
  useEffect(() => { if (view?.notice && !view.notice.read_at) void repo.update('notifications', view.notice.id, { read_at: new Date().toISOString() }).catch(() => undefined); }, [view?.notice, repo]);
  if (!me || noNudges) return null;
  const quiet = view && !view.current && view.prefs.enabled && inQuietHours(dubaiHour(new Date()), view.prefs.quiet_start, view.prefs.quiet_end);
  return (
    <div id="digest" ref={box} className="scroll-mt-20" data-testid="digest-panel">
      <Card
        eyebrow={view ? label(view.period) : undefined}
        title={<span className="flex items-center gap-2"><Icon name="bell" size={16} className="text-accent" />{t('digest.panel.title')}</span>}
        actions={<L to="/my/settings#digest-settings" className="btn-ghost btn-sm" data-testid="digest-settings-link">{t('digest.panel.settings')}</L>}
      >
        {!view ? (
          q.error ? <Callout tone="bad">{q.error.message}</Callout> : <Skeleton lines={3} />
        ) : !view.prefs.enabled ? (
          <EmptyState icon="bell" title={t('digest.panel.offTitle')} action={<L to="/my/settings#digest-settings" className="btn-outline btn-sm">{t('digest.panel.turnOn')}</L>}>
            <span data-testid="digest-off">{t('digest.panel.offBody')}</span>
          </EmptyState>
        ) : view.current ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              <span>{t('digest.panel.built', { date: f.dateTime(view.current.built_at) })}</span>
              <StatusPill tone="neutral">{t(`digest.freq.${view.current.frequency}`)}</StatusPill>
              {view.current.coach_hint && <StatusPill tone="info">{t('digest.panel.coachEngine')}</StatusPill>}
            </div>
            {view.current.items.filter((i) => open(i.link)).length === 0 ? (
              <p className="text-[13px] text-ink-2" data-testid="digest-empty">{t('digest.panel.nothing')}</p>
            ) : (
              <ol className="space-y-2" data-testid="digest-items">
                {view.current.items.filter((i) => open(i.link)).map((i) => <DigestItemRow key={i.id} i={i} />)}
              </ol>
            )}
            <FutureNudgeStrip items={view.current.items} asOf={view.current.as_of} />
            <p className="text-[12px] text-ink-3">{t('digest.panel.rule')}</p>
            {view.history.length > 0 && <History runs={view.history} label={label} open={open} />}
          </div>
        ) : quiet ? (
          <Callout tone="info" title={t('digest.panel.quietTitle')}><span data-testid="digest-quiet">{t('digest.panel.quietBody', { h: String(view.prefs.quiet_end).padStart(2, '0') })}</span></Callout>
        ) : failed ? (
          <Callout tone={failed.code === 'quiet_hours' || failed.code === 'nudges_off' ? 'info' : 'bad'}>
            {failed.message} <button className="ms-2 underline" onClick={() => { setFailed(null); setTick((x) => x + 1); }}>{t('digest.panel.retry')}</button>
          </Callout>
        ) : (
          <div>
            <p className="mb-2 text-[13px] text-ink-2">{t('digest.panel.preparing')}</p>
            <AutoBuild key={tick} onDone={(r) => { if (!r.ok) setFailed(r); else q.reload(); }} />
          </div>
        )}
      </Card>
    </div>
  );
}

function History({ runs, label, open }: { runs: RunRow[]; label: (p: string) => string; open: (link: string) => boolean }) {
  const t = useT();
  const f = useFormat();
  return (
    <details className="rounded-btn border border-line p-2" data-testid="digest-history">
      <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-2">{t('digest.panel.history', { n: f.num(runs.length) })}</summary>
      <ul className="mt-2 space-y-3">
        {runs.map((r) => (
          <li key={r.id}>
            <div className="caps">{label(r.period)} · {t('digest.panel.items', { n: f.num(r.item_count) })}</div>
            <ol>{r.items.filter((i) => open(i.link)).map((i) => <DigestItemRow key={i.id} i={i} compact />)}</ol>
          </li>
        ))}
      </ul>
    </details>
  );
}
