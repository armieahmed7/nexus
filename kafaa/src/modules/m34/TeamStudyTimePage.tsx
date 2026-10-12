// FS78 /team/study-time · Protected study time for my team (line manager in scope, recognition Scope). Requests waiting for me
// (approve or decline with a reason; maker-checker: never my own), what I decided, and my team's SIMULATED balances (grants minus
// approved use). Decisions go through rpc.decideStudyTime (audited; approval writes a ledger row).
import { useState } from 'react';
import { Async, BenchmarkChips, Callout, ConfirmDialog, DataTable, EmptyState, Page, Section, StatTile, Tabs, WhyThis, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { balanceOf, checkDecide, grantReasons, type RequestLite } from './balance';
import { Fs91Footer, StudyStatus, isoToday, useCreditsOf, useFs91Act, type Row } from './fs91ui';

export default function TeamStudyTimePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['study_time_requests', 'learning_balances'], async () => {
    const [reqs, bals] = await Promise.all([
      repo.list('study_time_requests', { order: [['created_at', 'desc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('learning_balances', { order: [['person_id', 'asc']] }).catch(() => []) as Promise<Row[]>,
    ]);
    return { reqs, bals };
  }, []);
  return (
    <Page title={t('m34.routes.team-study-time.title')} eyebrow={t('m34.sb.teamEyebrow')} intro={t('m34.sb.teamIntro')} wide>
      <div data-testid="m34-sb-bench"><BenchmarkChips feature="FS78" /></div>
      <Async state={q}>{(d) => <Body d={d} />}</Async>
      <Fs91Footer />
    </Page>
  );
}

function Body({ d }: { d: { reqs: Row[]; bals: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const c = useCreditsOf();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const repo = useRepo();
  const run = useFs91Act();
  const today = isoToday();
  const [dlg, setDlg] = useState<{ r: Row; d: 'approve' | 'decline' } | null>(null);
  const mine = d.reqs.filter((r) => r.line_manager_id === me && r.person_id !== me);
  const waiting = mine.filter((r) => r.status === 'requested');
  const decided = mine.filter((r) => r.status === 'approved' || r.status === 'declined');
  const team = d.bals.filter((b) => b.person_id !== me);
  const remainingOf = (r: Row) => {
    const b = d.bals.find((x) => x.person_id === r.person_id && Number(x.year) === Number(r.year));
    return b ? balanceOf(b as never, d.reqs as RequestLite[]).remaining_hours : 0;
  };
  const name = (r: Row) => pick({ n_en: r.person_name, n_ar: r.person_name_ar }, 'n');
  const reqCols = (act: boolean): Column<Row>[] => [
    { key: 'who', header: t('m34.sb.colPerson'), value: (r) => name(r), sortable: true, render: (r) => <span className="font-semibold">{name(r)}</span> },
    { key: 'item', header: t('m34.sb.colItem'), value: (r) => pick(r, 'resource_title'), sortable: true },
    { key: 'hours', header: t('m34.sb.colHours'), value: (r) => Number(r.hours), sortable: true, render: (r) => <span className="num">{t('m34.sb.hoursCredits', { h: f.num(r.hours), c: c(r.hours) })}</span> },
    { key: 'when', header: t('m34.sb.colWhen'), value: (r) => String(r.starts_on), sortable: true, render: (r) => <span className="whitespace-nowrap">{f.date(String(r.starts_on).slice(0, 10))} – {f.date(String(r.ends_on).slice(0, 10))}</span> },
    { key: 'pattern', header: t('m34.sb.colPattern'), value: (r) => r.pattern, render: (r) => t(`m34.sb.pattern.${r.pattern}`) },
    { key: 'reason', header: t('m34.sb.colReason'), value: (r) => r.reason, render: (r) => <span className="text-[12px] text-ink-2">{r.reason}</span> },
    { key: 'status', header: t('m34.sb.colStatus'), value: (r) => r.status, render: (r) => <StudyStatus status={r.status} /> },
    ...(act ? [{ key: 'act', header: '', value: () => '', render: (r: Row) => {
      const ok = checkDecide({ decision: 'approve' }, r as RequestLite, me, { today, hr: false, remaining: remainingOf(r) });
      return (
        <span className="flex flex-wrap gap-1">
          <button type="button" className="btn-primary btn-sm" disabled={ok !== 'ok'} title={ok !== 'ok' ? t(`m34.sbmsg.${ok}`) : undefined} onClick={() => setDlg({ r, d: 'approve' })} data-testid={`m34-sb-approve-${r.id}`}>{t('m34.sb.approve')}</button>
          <button type="button" className="btn-outline btn-sm" onClick={() => setDlg({ r, d: 'decline' })} data-testid={`m34-sb-decline-${r.id}`}>{t('m34.sb.decline')}</button>
        </span>
      );
    } } as Column<Row>] : []),
  ];
  const balCols: Column<Row>[] = [
    { key: 'who', header: t('m34.sb.colPerson'), value: (b) => pick({ n_en: b.person_name, n_ar: b.person_name_ar }, 'n'), sortable: true },
    { key: 'granted', header: t('m34.sb.tGranted'), value: (b) => Number(b.granted_hours), sortable: true, render: (b) => <span className="num">{c(b.granted_hours)}</span> },
    { key: 'topup', header: t('m34.sb.colTopup'), value: (b) => Number(b.topup_hours), render: (b) => <span className="inline-flex items-center gap-1">{b.topup_hours > 0 ? t('m34.sb.topupYes', { c: c(b.topup_hours) }) : t('m34.sb.topupNo')}<WhyThis reasons={grantReasons({ eligible: true, base_hours: b.base_hours, topup_hours: b.topup_hours, topup_basis: b.topup_basis, service_years: b.service_years, granted_hours: b.granted_hours })} testId={`m34-sb-why-${b.id}`} /></span> },
    { key: 'used', header: t('m34.sb.tUsed'), value: (b) => Number(b.used_hours), sortable: true, render: (b) => <span className="num">{c(b.used_hours)}</span> },
    { key: 'pending', header: t('m34.sb.tPending'), value: (b) => Number(b.pending_hours), sortable: true, render: (b) => <span className="num">{c(b.pending_hours)}</span> },
    { key: 'remaining', header: t('m34.sb.colRemaining'), value: (b) => Number(b.remaining_hours), sortable: true, render: (b) => <span className="num font-semibold">{c(b.remaining_hours)}</span> },
  ];
  const approvedH = decided.filter((r) => r.status === 'approved').reduce((a, r) => a + Number(r.hours), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="m34-sb-team-tiles">
        <StatTile label={t('m34.sb.tWaiting')} value={f.num(waiting.length)} sub={t('m34.sb.tWaitingSub')} tone="info" />
        <StatTile label={t('m34.sb.tApproved')} value={t('m34.sb.credits', { c: c(approvedH) })} sub={t('m34.sb.hours', { h: f.num(approvedH) })} tone="ok" />
        <StatTile label={t('m34.sb.tTeam')} value={f.num(team.length)} sub={t('m34.sb.tTeamSub')} sim />
      </div>
      <Callout tone="info" title={t('m34.sb.mcTitle')}>{t('m34.sb.mcBody')}</Callout>
      <Section title={t('m34.sb.queueTitle')}>
        <div data-testid="m34-sb-queue">
          <Tabs tabs={[
            { id: 'waiting', label: t('m34.sb.tabWaiting'), badge: waiting.length || undefined, content: waiting.length ? <DataTable rows={waiting} columns={reqCols(true)} rowKey={(r) => r.id} pageSize={10} caption={t('m34.sb.tabWaiting')} /> : <EmptyState title={t('m34.sb.queueEmpty')} /> },
            { id: 'decided', label: t('m34.sb.tabDecided'), content: decided.length ? <DataTable rows={decided} columns={reqCols(false)} rowKey={(r) => r.id} pageSize={10} caption={t('m34.sb.tabDecided')} /> : <EmptyState title={t('m34.sb.decidedEmpty')} /> },
          ]} />
        </div>
      </Section>
      <Section title={t('m34.sb.teamBalTitle')} description={t('m34.sb.teamBalDesc')}>
        {team.length === 0 ? <EmptyState title={t('m34.sb.teamBalEmpty')} /> : <div data-testid="m34-sb-team-balances"><DataTable rows={team} columns={balCols} rowKey={(b) => b.id} pageSize={10} caption={t('m34.sb.teamBalTitle')} csvName="kafaa-team-learning-balances.csv" /></div>}
      </Section>
      <ConfirmDialog open={!!dlg} onClose={() => setDlg(null)} title={dlg?.d === 'approve' ? t('m34.sb.approveTitle') : t('m34.sb.declineTitle')}
        consequence={dlg ? (dlg.d === 'approve' ? t('m34.sb.approveBody', { name: name(dlg.r), h: f.num(dlg.r.hours), c: c(dlg.r.hours) }) : t('m34.sb.declineBody', { name: name(dlg.r) })) : ''}
        requireReason={dlg?.d === 'decline'} reasonLabel={t('m34.sb.declineReason')} actingAs={t('m34.sb.actingManager')}
        onConfirm={async (note) => { if (dlg) await run(() => repo.rpc.decideStudyTime({ id: dlg.r.id, decision: dlg.d, note }), dlg.d === 'approve' ? t('m34.sb.approved') : t('m34.sb.declined')); setDlg(null); }} />
    </div>
  );
}
