// FS64 /ecosystem/regional-plan/commitments (ecosystem OwnOrg/OrgW/Agg/A; auditors): provider commitments against the released regional
// demand. RLS decides the rows: a partner or university reads only its own organisation's commitments (OwnOrg); HR, admins and auditors
// read every provider's (workforce_strategy R/W/A). Each commitment shows its delivery status (computed per term from the reported
// delivery, never stored; <WhyThis>). Provider administrators (OrgW) commit provision through rpc.commitProvision (audited + ledger).
// HR sees the coverage of each area's 2030 gap by all providers' planned seats.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, EmptyState, StatTile, DataTable, WhyThis, BenchmarkChips, ProgressBar, Callout, type Column } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { COVERAGE_YEAR, coverageByArea, commitmentView, type CommitmentView } from './regional';
import { CommitForm } from './CommitForm';
import { CommitStatusPill, DemoLabels, HrPill, Sup, useOrgName, useSkills, type Row } from './ui';

type Item = { c: Row; v: CommitmentView };

export default function CommitmentsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const canCommit = s.can('ecosystem', ['OrgW']);
  const isHr = s.can('ecosystem', ['Agg', 'W', 'A']) || s.hasRole('auditor');
  const list = useQuery('provider_commitments' as Table, () => repo.list('provider_commitments' as never, { order: [['created_at', 'desc']] } as never) as unknown as Promise<Row[]>);
  const demand = useQuery('regional_demand' as Table, () => repo.list('regional_demand' as never, { filter: { status: 'current' } } as never) as unknown as Promise<Row[]>);
  const skills = useSkills();
  const [open, setOpen] = useState(false);
  return (
    <Page title={t('m36.routes.ecosystem-commitments.title')} intro={isHr ? t('m36.cm.introHr') : t('m36.cm.intro')} wide
      eyebrow={<BenchmarkChips feature="FS64" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/ecosystem/regional-plan" className="btn-outline btn-sm no-underline">{t('m36.cm.toPlan')}</L>
        {canCommit && <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)} disabled={!(demand.data ?? []).length} data-testid="m36-commit-open">{t('m36.cm.commit')}</button>}
      </div>}>
      <Async state={list}>{(rows) => (
        <>
          <Board rows={rows} demand={demand.data ?? []} isHr={isHr} canCommit={canCommit} />
          {open && <CommitForm open={open} onClose={() => setOpen(false)} demand={demand.data ?? []} skills={skills.data} />}
        </>
      )}</Async>
    </Page>
  );
}

function Board({ rows, demand, isHr, canCommit }: { rows: Row[]; demand: Row[]; isHr: boolean; canCommit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const orgName = useOrgName();
  const today = todayIso();
  const items: Item[] = useMemo(() => rows.map((c) => ({ c, v: commitmentView(c, today) })), [rows, today]);
  const [status, setStatus] = useState('all');
  const [org, setOrg] = useState('all');
  const orgs = [...new Set(rows.map((r) => String(r.org_id)))];
  const shown = items.filter((x) => (status === 'all' || x.v.status === status) && (org === 'all' || x.c.org_id === org));
  const active = items.filter((x) => x.v.status !== 'withdrawn');
  const count = (st: string) => items.filter((x) => x.v.status === st).length;
  // three separate totals, never added together
  const seats = active.reduce((n, x) => n + x.v.seats, 0);
  const enrolled = active.reduce((n, x) => n + x.v.enrolled, 0);
  const completed = active.reduce((n, x) => n + x.v.completed, 0);
  const coverage = useMemo(() => coverageByArea(demand, rows, today), [demand, rows, today]);
  if (!rows.length) return <EmptyState title={t('m36.cm.empty')}>{canCommit ? t('m36.cm.emptyProvider') : t('m36.cm.emptyBody')}</EmptyState>;
  const cols: Column<Item>[] = [
    { key: 'title', header: t('m36.cm.col.title'), value: (x) => pick(x.c, 'title'), sortable: true,
      render: (x) => <div className="min-w-0"><L to={`/ecosystem/regional-plan/commitments/${x.c.id}`} className="font-semibold" data-testid="m36-commitment-link">{pick(x.c, 'title')}</L>
        <span className="block text-[11.5px] text-ink-3">{t(`m36.kind.${x.c.kind}`)} · {t(`m36.area.${x.c.area}`)}</span></div> },
    ...(isHr ? [{ key: 'org', header: t('m36.cm.col.org'), value: (x: Item) => orgName(x.c), sortable: true, render: (x: Item) => <span>{orgName(x.c)}</span> } as Column<Item>] : []),
    { key: 'seats', header: t('m36.cm.col.seats'), align: 'end', value: (x) => x.v.seats, sortable: true, render: (x) => <span className="num">{f.num(x.v.seats)}</span> },
    { key: 'enrolled', header: t('m36.cm.col.enrolled'), align: 'end', value: (x) => x.v.enrolled, render: (x) => <span className="num">{f.num(x.v.enrolled)}</span> },
    { key: 'completed', header: t('m36.cm.col.completed'), align: 'end', value: (x) => x.v.completed, render: (x) => <span className="num">{f.num(x.v.completed)}</span> },
    { key: 'status', header: t('m36.cm.col.status'), value: (x) => x.v.status, sortable: true,
      render: (x) => <div className="flex flex-wrap items-center gap-1"><CommitStatusPill status={x.v.status} /><WhyThis reasons={x.v.reasons} testId={`m36-cm-why-${x.c.id}`} /></div> },
    { key: 'hr', header: t('m36.cm.col.hr'), value: (x) => x.c.hr_status, render: (x) => <HrPill status={x.c.hr_status} /> },
  ];
  return (
    <div className="space-y-6" data-testid="m36-cm">
      <DemoLabels />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6" data-testid="m36-cm-tiles">
        <StatTile label={t('m36.cm.tile.active')} value={f.num(active.length)} sub={t('m36.cm.tile.activeSub', { n: f.num(count('withdrawn')) })} />
        <StatTile label={t('m36.cm.tile.seats')} value={<span data-testid="m36-cm-seats">{f.num(seats)}</span>} sub={t('m36.cm.tile.seatsSub')} />
        <StatTile label={t('m36.cm.tile.enrolled')} value={<span data-testid="m36-cm-enrolled">{f.num(enrolled)}</span>} sub={t('m36.cm.tile.enrolledSub')} tone="info" />
        <StatTile label={t('m36.cm.tile.completed')} value={<span data-testid="m36-cm-completed">{f.num(completed)}</span>} sub={t('m36.cm.tile.completedSub')} tone="ok" />
        <StatTile label={t('m36.cm.tile.onTrack')} value={f.num(count('on_track') + count('delivered'))} sub={t('m36.cm.tile.onTrackSub', { n: f.num(count('not_started')) })} tone="ok" />
        <StatTile label={t('m36.cm.tile.risk')} value={f.num(count('at_risk') + count('behind'))} sub={t('m36.cm.tile.riskSub', { n: f.num(count('behind')) })} tone="bad" />
      </div>
      <Section title={t('m36.cm.list')} description={t('m36.cm.listIntro')}>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={t('m36.cm.filter')}>
          {['all', 'on_track', 'at_risk', 'behind', 'not_started', 'delivered', 'withdrawn'].map((k) => (
            <button key={k} type="button" className={`btn-sm ${status === k ? 'btn-primary' : 'btn-outline'}`} aria-pressed={status === k} onClick={() => setStatus(k)} data-testid={`m36-cm-filter-${k}`}>
              {k === 'all' ? t('m36.cm.all') : t(`m36.status.${k}`)}
            </button>
          ))}
          {isHr && orgs.length > 1 && (
            <select className="input w-auto" value={org} onChange={(e) => setOrg(e.target.value)} aria-label={t('m36.cm.col.org')} data-testid="m36-cm-filter-org">
              <option value="all">{t('m36.cm.allOrgs')}</option>
              {orgs.map((o) => <option key={o} value={o}>{orgName(rows.find((r) => r.org_id === o)!)}</option>)}
            </select>
          )}
        </div>
        <div className="overflow-x-auto" data-testid="m36-commitments">
          <DataTable rows={shown} columns={cols} rowKey={(x) => x.c.id} searchable={false} pageSize={20} caption={t('m36.cm.list')} csvName="provider-commitments" />
        </div>
      </Section>
      {isHr && (
        <Section title={t('m36.cm.coverage', { y: f.num(COVERAGE_YEAR, { useGrouping: false }) })} description={t('m36.cm.coverageIntro')}>
          <div className="overflow-x-auto" data-testid="m36-cm-coverage">
            <table className="w-full text-[13px]">
              <caption className="sr-only">{t('m36.cm.coverage', { y: String(COVERAGE_YEAR) })}</caption>
              <thead><tr className="text-ink-3">
                <th scope="col" className="py-1 text-start font-semibold">{t('m36.rp.col.area')}</th>
                <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.cov.gap')}</th>
                <th scope="col" className="py-1 text-end font-semibold">{t('m36.cm.cov.commitments')}</th>
                <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.cov.seats')}</th>
                <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.cov.completed')}</th>
                <th scope="col" className="py-1 text-start font-semibold">{t('m36.rp.cov.pct')}</th>
              </tr></thead>
              <tbody>{coverage.map((r) => (
                <tr key={r.area} className="border-t border-line" data-testid="m36-cov-row" data-area={r.area} data-pct={r.pct ?? ''}>
                  <th scope="row" className="py-1.5 text-start font-medium">{t(`m36.area.${r.area}`)}</th>
                  <td className="py-1.5 text-end"><Sup v={r.gap_plan} /></td>
                  <td className="py-1.5 text-end num">{f.num(r.commitments)}</td>
                  <td className="py-1.5 text-end num">{f.num(r.seats)}</td>
                  <td className="py-1.5 text-end num">{f.num(r.completed)}</td>
                  <td className="py-1.5 ps-3">{r.pct == null ? <span className="text-[12px] text-ink-3">{r.gap_plan === 0 ? t('m36.rp.cov.noGap') : t('m36.rp.cov.na')}</span>
                    : <ProgressBar value={Math.min(100, r.pct)} tone={r.pct >= 100 ? 'ok' : 'accent'} label={`${f.num(r.pct)}%`} />}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>
      )}
      <Callout tone="info" title={t('m36.cm.how.title')}>{t('m36.cm.how.body')}</Callout>
    </div>
  );
}
