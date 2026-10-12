// FS70 /my/manager-pulse (line managers: transformation Scope): the annual manager pulse. One question (the share of my team's core
// skills I expect to change by 2030), open from 15 September to 15 December; answering again updates this year's answer. My own answers
// only (kafaa_manager_pulse is own_profile); HR sees the pulse as an aggregate of at least 10 answers, never a manager.
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, Card, ConfirmDialog, EmptyState, KeyValue, Page, Section, StatusPill, TextField } from '../../ui';
import { todayIso } from '../../domain/rules';
import { MIN_SIGNAL, PULSE_BANDS, pulseOpen, pulseWindow, shareOk, teamOk } from './signals';
import { useRun28, type Row } from './fs70ui';

export default function ManagerPulsePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['manager_pulse'], () => repo.list('manager_pulse' as never, { order: [['year', 'desc']] } as never) as Promise<Row[]>);
  return (
    <Page title={t('m28.routes.my-manager-pulse.title')} intro={t('m28.mp.intro')} eyebrow={<BenchmarkChips feature="FS70" />}
      actions={<L to="/skills/rising" className="btn-outline btn-sm no-underline">{t('m28.mp.toList')}</L>}>
      <Async state={q} isEmpty={() => false}>{(rows) => <Pulse rows={rows} />}</Async>
    </Page>
  );
}

function Pulse({ rows }: { rows: Row[] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useRun28('mp');
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const open = pulseOpen(today);
  const w = pulseWindow(year);
  const mine = rows.find((r) => Number(r.year) === year);
  const [share, setShare] = useState(mine ? String(mine.share_pct) : '');
  const [team, setTeam] = useState(mine?.team_size != null ? String(mine.team_size) : '');
  const [confirm, setConfirm] = useState(false);
  const shareN = share.trim() === '' ? NaN : Number(share);
  const teamN = team.trim() === '' ? null : Number(team);
  const shareErr = share.trim() !== '' && !shareOk(shareN) ? t('m28.mp.shareErr') : null;
  const teamErr = !teamOk(teamN) ? t('m28.mp.teamErr') : null;
  const valid = shareOk(shareN) && teamOk(teamN);
  const band = shareOk(shareN) ? PULSE_BANDS.find(([a, b]) => shareN >= a && shareN <= b) : undefined;
  return (
    <div className="space-y-6" data-testid="m28-mp" data-open={open ? '1' : '0'}>
      <div className="flex flex-wrap items-center gap-2" data-testid="m28-mp-window">
        <StatusPill tone={open ? 'ok' : 'neutral'}>{open ? t('m28.mp.open') : t('m28.mp.closed')}</StatusPill>
        <span className="text-[13px] text-ink-2">{t('m28.mp.window', { open: f.date(w.open), close: f.date(w.close) })}</span>
      </div>
      <Card title={t('m28.mp.question')}>
        {open ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) setConfirm(true); }} data-testid="m28-mp-form">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div data-testid="m28-mp-share"><TextField type="number" name="share_pct" label={t('m28.mp.share')} value={share} onChange={setShare} error={shareErr} hint={t('m28.mp.shareHint')} required /></div>
              <div data-testid="m28-mp-team"><TextField type="number" name="team_size" label={t('m28.mp.team')} value={team} onChange={setTeam} error={teamErr} hint={t('m28.mp.teamHint')} /></div>
            </div>
            {band && <p className="text-[13px] text-ink-2" data-testid="m28-mp-band">{t('m28.mp.band', { lo: f.num(band[0]), hi: f.num(band[1]) })}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={!valid} data-testid="m28-mp-submit">{mine ? t('m28.mp.update') : t('m28.mp.submit')}</button>
            </div>
          </form>
        ) : <EmptyState title={t('m28.mp.closedTitle')}>{t('m28.mp.closedBody', { open: f.date(w.open), close: f.date(w.close) })}</EmptyState>}
      </Card>
      {mine && (
        <Section title={t('m28.mp.mineTitle', { y: f.num(year, { useGrouping: false }) })}>
          <Card><div data-testid="m28-mp-mine"><KeyValue items={[
            [t('m28.mp.share'), `${f.num(Number(mine.share_pct))}%`],
            [t('m28.mp.team'), mine.team_size != null ? f.num(Number(mine.team_size)) : t('m28.mp.teamNone')],
            [t('m28.mp.answered'), f.date(mine.updated_at ?? mine.submitted_at)],
          ]} /></div></Card>
        </Section>
      )}
      {rows.filter((r) => Number(r.year) !== year).length > 0 && (
        <Section title={t('m28.mp.pastTitle')}>
          <ul className="space-y-2" data-testid="m28-mp-past">
            {rows.filter((r) => Number(r.year) !== year).map((r) => (
              <li key={r.id} className="flex min-w-0 flex-wrap justify-between gap-2 rounded-card border border-line bg-panel px-3 py-2 text-[13.5px]">
                <span>{t('m28.mp.pastRow', { y: f.num(Number(r.year), { useGrouping: false }) })}</span>
                <span className="font-semibold tabular-nums">{f.num(Number(r.share_pct))}%</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Callout tone="info" title={t('m28.mp.privacyTitle')}>{t('m28.mp.privacyBody', { n: f.num(MIN_SIGNAL) })}</Callout>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={mine ? t('m28.mp.update') : t('m28.mp.submit')}
        consequence={t('m28.mp.consequence', { pct: f.num(shareOk(shareN) ? shareN : 0), y: f.num(year, { useGrouping: false }) })} confirmLabel={mine ? t('m28.mp.update') : t('m28.mp.submit')}
        onConfirm={async () => { const r = await run(() => repo.rpc.submitManagerPulse({ share_pct: shareN, team_size: teamN }), t('m28.mp.saved')); if (r.ok) setConfirm(false); }} />
    </div>
  );
}
