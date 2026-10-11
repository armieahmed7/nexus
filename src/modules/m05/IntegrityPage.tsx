// FS22 /training/integrity (instructors, training manager, auditors): integrity reports on every attempt that gates a credential (adaptive
// banks and performance tasks): time on task, fast answers, retakes, resubmissions, repeat items and item exposure, flags and the review.
// Assessors (signoff A) accept or void a flagged report with a reason (rpc.reviewIntegrity behind a ConfirmDialog; never their own;
// voiding withdraws the attempt's evidence); auditors read (audit_log R) and export.
import { useState } from 'react';
import { Page, Async, Callout, EmptyState, DataTable, BenchmarkChips, StatusPill, Drawer, ConfirmDialog, StatTile, type Column } from '../../ui';
import { useQuery, useRepo, useAction } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { FLAGS } from './perf';
import { GateChips, IntegrityStatus, IntegritySummary, useFlagText, useFsRef, type FsRef, type Row } from './fsui';

export default function IntegrityPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useFsRef();
  const q = useQuery(['integrity_reports', 'people'], async () => {
    const [reports, people] = await Promise.all([repo.list('integrity_reports' as never).catch(() => [] as Row[]), repo.list('people').catch(() => [] as Row[])]);
    return { reports: reports as Row[], people: people as Row[] };
  }, []);
  return (
    <Page title={t('m05.routes.training-integrity.title')} intro={t('m05.ir.intro')} wide eyebrow={<BenchmarkChips feature="FS22" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => <Body d={d} {...c} reload={q.reload} />}</Async>}</Async>
    </Page>
  );
}

function Body({ d, reports, people, reload }: { d: FsRef; reports: Row[]; people: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const flag = useFlagText();
  const canDecide = s.can('signoff', ['A']);
  const [view, setView] = useState('review');
  const [open, setOpen] = useState<Row | null>(null);
  const refName = (r: Row) => { const x = r.kind === 'adaptive' ? d.banks.find((b: Row) => b.id === r.ref_id) : d.tasks.find((k: Row) => k.id === r.ref_id); return x ? pick(x, r.kind === 'adaptive' ? 'name' : 'title') : r.ref_id; };
  const personName = (id: string) => { const p = people.find((x) => x.id === id); return p ? pick(p, 'display_name') || p.display_name : id; };
  const waiting = reports.filter((r) => r.status === 'review' && !r.decision);
  const rows = view === 'review' ? waiting : view === 'decided' ? reports.filter((r) => r.decision) : reports;
  const cols: Column<Row>[] = [
    { key: 'person', header: t('m05.as.person'), value: (r) => personName(r.person_id), sortable: true },
    { key: 'kind', header: t('m05.ir.col.kind'), value: (r) => t(`m05.ir.kind.${r.kind}`) },
    { key: 'ref', header: t('m05.ir.col.ref'), value: (r) => refName(r), sortable: true },
    { key: 'date', header: t('m05.ir.col.date'), value: (r) => r.created_at, render: (r) => f.date(r.created_at), sortable: true },
    { key: 'time', header: t('m05.ir.k.time'), value: (r) => r.time_on_task_s, render: (r) => t('m05.ir.minSec', { m: f.num(Math.floor(r.time_on_task_s / 60)), s: f.num(r.time_on_task_s % 60) }), align: 'end', sortable: true },
    { key: 'flags', header: t('m05.ir.col.flags'), value: (r) => (r.flags ?? []).join(' '), render: (r) => <span className="flex flex-wrap gap-1">{(r.flags ?? []).map((x: string) => <StatusPill key={x} tone="sim">{flag(x)}</StatusPill>)}{!(r.flags ?? []).length && <span className="text-ink-3">—</span>}</span> },
    { key: 'status', header: t('m05.ir.col.status'), value: (r) => r.decision ?? r.status, render: (r) => <IntegrityStatus r={r} /> },
    { key: 'open', header: '', csv: false, render: (r) => <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(r)} data-testid={`m05-ir-open-${r.id}`}>{t('m05.ir.open')}</button> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m05.ir.tile.all')} value={f.num(reports.length)} sub={t('m05.ir.tile.allSub')} />
        <StatTile label={t('m05.ir.tile.clear')} value={f.num(reports.filter((r) => r.status === 'clear').length)} tone="ok" />
        <StatTile label={t('m05.ir.tile.review')} value={f.num(waiting.length)} tone="info" />
        <StatTile label={t('m05.ir.tile.voided')} value={f.num(reports.filter((r) => r.decision === 'voided').length)} tone="bad" />
      </div>
      {!canDecide && <Callout tone="info" title={t('m05.ir.readOnlyTitle')}>{t('m05.ir.readOnly')}</Callout>}
      <Callout tone="sim" title={t('m05.ir.flagsTitle')}>
        <ul className="list-disc space-y-0.5 ps-5">{FLAGS.map((x) => <li key={x}><strong>{flag(x)}</strong>: {t(`m05.ir.flagHelp.${x}`)}</li>)}</ul>
      </Callout>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('m05.ir.filter')}>
          {['review', 'decided', 'all'].map((k) => (
            <button key={k} type="button" className={`chip ${view === k ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`} aria-pressed={view === k} onClick={() => setView(k)} data-testid={`m05-ir-filter-${k}`}>{t(`m05.ir.view.${k}`)}</button>
          ))}
        </div>
      </div>
      {rows.length ? <div data-testid="m05-ir-table"><DataTable rows={rows} columns={cols} rowKey={(r) => r.id} csvName="integrity-reports.csv" initialSort={{ key: 'date', dir: 'desc' }} /></div> : <EmptyState title={t('m05.ir.empty')} />}
      {open && <ReportDrawer d={d} r={open} person={personName(open.person_id)} refName={refName(open)} canDecide={canDecide && open.person_id !== s.identity.personId} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload?.(); }} />}
    </div>
  );
}

function ReportDrawer({ d, r, person, refName, canDecide, onClose, onDone }: { d: FsRef; r: Row; person: string; refName: string; canDecide: boolean; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [decision, setDecision] = useState<'accepted' | 'voided' | null>(null);
  const pending = r.status === 'review' && !r.decision;
  return (
    <Drawer open onClose={onClose} title={`${refName} · ${person}`}
      footer={pending && canDecide && <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={() => setDecision('voided')} data-testid="m05-ir-void">{t('m05.ir.void')}</button>
        <button type="button" className="btn-primary btn-sm" onClick={() => setDecision('accepted')} data-testid="m05-ir-accept">{t('m05.ir.accept')}</button>
      </div>}>
      <div className="space-y-3 text-[13.5px]" data-testid="m05-ir-drawer">
        <p className="text-ink-3">{t(`m05.ir.kind.${r.kind}`)} · {f.date(r.created_at)}</p>
        <GateChips codes={r.gates} d={d} />
        <IntegritySummary r={r} />
        {r.reviewed_at && <p className="text-[12px] text-ink-3">{t('m05.ir.reviewedOn', { date: f.date(r.reviewed_at) })}</p>}
        <Callout tone="info" title={t('m05.ir.whatTitle')}>{t('m05.ir.what')}</Callout>
      </div>
      <ConfirmDialog open={!!decision} onClose={() => setDecision(null)} title={decision === 'voided' ? t('m05.ir.void') : t('m05.ir.accept')}
        consequence={decision === 'voided' ? t('m05.ir.voidConsequence') : t('m05.ir.acceptConsequence')} danger={decision === 'voided'} requireReason reasonLabel={t('m05.ir.reason')}
        actingAs={t('m05.as.actingAs')} confirmLabel={decision === 'voided' ? t('m05.ir.void') : t('m05.ir.accept')}
        onConfirm={async (reason) => { const res = await act(() => repo.rpc.reviewIntegrity({ report_id: r.id, decision: decision!, note: reason })); setDecision(null); if (res.ok) onDone(); }} />
    </Drawer>
  );
}
