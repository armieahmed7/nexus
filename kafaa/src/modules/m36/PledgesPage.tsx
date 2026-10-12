// FS65 /ecosystem/pledges (ecosystem R/OwnOrg/Agg/W/A): the skills pledges ledger. rpc.pledgeLedger returns aggregates only (by skill
// area, organisation type and target year): pledged, started and completed are three separate tiles, three separate columns and three
// separate bars, never added together (a pledge is a commitment, not a completion). A cell is suppressed when it holds 1 to 9 people or
// comes from fewer than two organisations, so no single organisation shows through. Organisations see and update their own pledges on
// /ecosystem/pledges/register.
import { useState } from 'react';
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, StatTile, Callout, Tabs, BenchmarkChips } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import type { Cell, Ledger, LedgerGroup } from './pledges';
import { CellView, DemoLabels, PledgeStatusPill } from './ui';

export default function PledgesPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const canOrg = s.can('ecosystem', ['OwnOrg', 'OrgW', 'Agg', 'A']) || s.hasRole('auditor');
  const q = useQuery(['pledges', 'pledge_progress'] as unknown as Table[], async () => {
    const r = await repo.rpc.pledgeLedger();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  return (
    <Page title={t('m36.routes.ecosystem-pledges.title')} intro={t('m36.pl.intro')} wide eyebrow={<BenchmarkChips feature="FS65" />}
      actions={<div className="flex flex-wrap gap-2">
        {canOrg && <L to="/ecosystem/pledges/register" className="btn-primary btn-sm no-underline" data-testid="m36-pl-to-register">{t('m36.pl.toRegister')}</L>}
        <L to="/ecosystem/regional-plan" className="btn-outline btn-sm no-underline">{t('m36.pl.toPlan')}</L>
      </div>}>
      <Async state={q}>{(l) => <LedgerView l={l} />}</Async>
    </Page>
  );
}

function LedgerView({ l }: { l: Ledger }) {
  const t = useT();
  const f = useFormat();
  const [tab, setTab] = useState('area');
  const label = (dim: string, key: string) => (dim === 'area' ? t(`m36.area.${key}`) : dim === 'type' ? t(`m36.type.${key}`) : f.num(Number(key), { useGrouping: false }));
  const table = (dim: string, gs: LedgerGroup[]) => {
    const max = Math.max(1, ...gs.flatMap((g) => [g.pledged, g.started, g.completed].map((c) => (c.suppressed ? 0 : Number(c.value)))));
    return (
      <div className="overflow-x-auto" data-testid={`m36-pl-by-${dim}`}>
        <table className="w-full text-[13px]">
          <caption className="sr-only">{t(`m36.pl.by.${dim}`)}</caption>
          <thead><tr className="text-ink-3">
            <th scope="col" className="py-1 text-start font-semibold">{t(`m36.pl.by.${dim}`)}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.pl.pledged')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.pl.started')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.pl.completed')}</th>
            <th scope="col" className="hidden py-1 ps-3 text-start font-semibold md:table-cell">{t('m36.pl.bars')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.pl.pledges')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.pl.orgs')}</th>
          </tr></thead>
          <tbody>{gs.map((g) => (
            <tr key={g.key} className="border-t border-line" data-testid="m36-pl-row" data-key={g.key}>
              <th scope="row" className="py-1.5 text-start font-medium">{label(dim, g.key)}</th>
              <td className="py-1.5 text-end"><CellView c={g.pledged} testId="m36-pl-cell-pledged" /></td>
              <td className="py-1.5 text-end"><CellView c={g.started} testId="m36-pl-cell-started" /></td>
              <td className="py-1.5 text-end"><CellView c={g.completed} testId="m36-pl-cell-completed" /></td>
              <td className="hidden py-1.5 ps-3 md:table-cell"><Bars g={g} max={max} /></td>
              <td className="py-1.5 text-end num">{f.num(g.pledges)}</td>
              <td className="py-1.5 text-end num">{f.num(g.orgs)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  };
  return (
    <div className="space-y-6" data-testid="m36-pl">
      <DemoLabels />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="m36-pl-tiles">
        <StatTile label={t('m36.pl.pledged')} value={<CellView c={l.totals.pledged} testId="m36-tile-pledged" />} sub={t('m36.pl.pledgedSub')} />
        <StatTile label={t('m36.pl.started')} value={<CellView c={l.totals.started} testId="m36-tile-started" />} sub={t('m36.pl.startedSub')} tone="info" />
        <StatTile label={t('m36.pl.completed')} value={<CellView c={l.totals.completed} testId="m36-tile-completed" />} sub={t('m36.pl.completedSub')} tone="ok" />
      </div>
      <p className="text-[12.5px] text-ink-2" data-testid="m36-pl-counts">{t('m36.pl.counts', { n: f.num(l.totals.pledges), o: f.num(l.totals.orgs), date: f.date(l.as_of) })}</p>
      <div className="flex flex-wrap gap-2" data-testid="m36-pl-statuses">
        {l.statuses.map((x) => <span key={x.key} className="inline-flex items-center gap-1.5 text-[12.5px]"><PledgeStatusPill status={x.key} /><CellView c={x.pledges} /></span>)}
      </div>
      <Section title={t('m36.pl.ledger')} description={t('m36.pl.ledgerIntro', { n: f.num(l.min_group), o: f.num(l.min_orgs) })}>
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'area', label: t('m36.pl.by.area'), content: table('area', l.by_area) },
          { id: 'type', label: t('m36.pl.by.type'), content: table('type', l.by_type) },
          { id: 'year', label: t('m36.pl.by.year'), content: table('year', l.by_year) },
        ]} />
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m36.pl.why.title')}>{t('m36.pl.why.body')}</Callout>
        <Callout tone="sim" title={t('m36.pl.sup.title')}>{t('m36.pl.sup.body', { n: f.num(l.min_group), o: f.num(l.min_orgs) })}</Callout>
      </div>
    </div>
  );
}

/** Three separate bars on one scale (pledged, started, completed); suppressed cells draw no bar. Never stacked, never summed. */
function Bars({ g, max }: { g: LedgerGroup; max: number }) {
  const t = useT();
  const bar = (c: Cell, cls: string, key: string) => (
    <span key={key} className="flex items-center gap-2" data-bar={key}>
      <span className="w-16 shrink-0 text-[11px] text-ink-3">{t(`m36.pl.${key}`)}</span>
      <span className="relative block h-2 flex-1 rounded-full bg-sunken">
        {!c.suppressed && <span className={`absolute inset-y-0 start-0 rounded-full ${cls}`} style={{ width: `${Math.max(2, (Number(c.value) / max) * 100)}%` }} />}
      </span>
    </span>
  );
  return <span className="block min-w-[160px] space-y-0.5" aria-hidden>{bar(g.pledged, 'bg-ink-3', 'pledged')}{bar(g.started, 'bg-info', 'started')}{bar(g.completed, 'bg-ok', 'completed')}</span>;
}
