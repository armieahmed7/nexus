// FS82 /ecosystem/grants (ecosystem Own/W/A: ENEC staff and HR; auditors): the mobility micro-grant programme in figures. Everything
// comes from rpc.grantStats (TS grantStats = SQL kafaa_gr_stats): rounds with their windows and phases, applications, approvals,
// declines, the approval rate, money committed and outputs. Every count of 1 to 9 is suppressed; a rate needs a base of 10 or more;
// money committed shows only behind 10 or more awards. Budgets are SIMULATED. No person is named anywhere on this page.
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, StatTile, Callout, BarChart, BenchmarkChips, ScrollRegion } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import type { GrantStats } from './grants';
import { CellView } from './ui';
import { GrantLabels, RoundPill, useMoney } from './fs82ui';

export default function GrantsProgrammePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const hr = s.can('workforce_strategy', ['W', 'A']) || s.hasRole('auditor');
  const q = useQuery(['grant_rounds', 'grant_applications'] as unknown as Table[], async () => {
    const r = await repo.rpc.grantStats();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  return (
    <Page title={t('m36.routes.ecosystem-grants.title')} intro={t('m36.grp.intro')} wide eyebrow={<BenchmarkChips feature="FS82" />}
      actions={<div className="flex flex-wrap gap-2">
        {s.can('ecosystem', ['Own']) && <L to="/my/grants" className="btn-primary btn-sm no-underline" data-testid="m36-grp-to-my">{t('m36.grp.toMy')}</L>}
        {hr && <L to="/workforce/grants" className="btn-outline btn-sm no-underline" data-testid="m36-grp-to-console">{t('m36.grp.toConsole')}</L>}
      </div>}>
      <Async state={q}>{(g) => <Stats g={g} />}</Async>
    </Page>
  );
}

function Stats({ g }: { g: GrantStats }) {
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const rate = (v: number | null) => (v == null ? <span className="text-ink-3" data-suppressed="true">{t('common.suppressedShort')}</span> : <span className="num">{f.pct(v, 0)}</span>);
  return (
    <div className="space-y-6" data-testid="m36-grp">
      <GrantLabels />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m36-grp-tiles">
        <StatTile label={t('m36.grp.applications')} value={<CellView c={g.totals.applications} testId="m36-grp-tile-applications" />} />
        <StatTile label={t('m36.grp.approved')} value={<CellView c={g.totals.approved} testId="m36-grp-tile-approved" />} tone="ok" />
        <StatTile label={t('m36.grp.rate')} value={rate(g.totals.approval_rate)} sub={t('m36.grp.rateSub')} />
        <StatTile label={t('m36.grp.accepted')} value={<CellView c={g.totals.outputs_accepted} testId="m36-grp-tile-accepted" />} sub={t('m36.grp.acceptedSub')} tone="info" />
      </div>
      <Section title={t('m36.grp.rounds')} description={t('m36.grp.roundsIntro', { n: f.num(g.min_group) })}>
        <ScrollRegion label={t('m36.grp.rounds')} className="overflow-x-auto" data-testid="m36-grp-rounds">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{t('m36.grp.rounds')}</caption>
            <thead><tr className="text-ink-3">
              <th scope="col" className="py-1 text-start font-semibold">{t('m36.grp.col.round')}</th>
              <th scope="col" className="py-1 text-start font-semibold">{t('m36.grp.col.phase')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.col.budget')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.applications')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.approved')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.declined')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.rate')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.col.committed')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.grp.col.outputs')}</th>
            </tr></thead>
            <tbody>{g.rounds.slice().reverse().map((r) => (
              <tr key={r.round_id} className="border-t border-line" data-testid="m36-grp-round" data-id={r.round_id} data-phase={r.phase}>
                <th scope="row" className="py-1.5 text-start font-medium">{t('m36.gr.roundTo', { date: f.date(r.closes_on) })}<span className="block text-[11.5px] font-normal text-ink-3">{t('m36.gr.window', { a: f.date(r.opens_on), b: f.date(r.closes_on) })}</span></th>
                <td className="py-1.5"><RoundPill phase={r.phase} /></td>
                <td className="py-1.5 text-end num">{money(r.budget)}</td>
                <td className="py-1.5 text-end"><CellView c={r.applications} testId="m36-grp-cell-applications" /></td>
                <td className="py-1.5 text-end"><CellView c={r.approved} testId="m36-grp-cell-approved" /></td>
                <td className="py-1.5 text-end"><CellView c={r.declined} /></td>
                <td className="py-1.5 text-end">{rate(r.approval_rate)}</td>
                <td className="py-1.5 text-end" data-testid="m36-grp-committed" data-suppressed={r.committed == null ? 'true' : 'false'}>{r.committed == null ? <span className="text-ink-3">{t('common.suppressedShort')}</span> : <span className="num">{money(r.committed)}</span>}</td>
                <td className="py-1.5 text-end"><CellView c={r.outputs_submitted} /></td>
              </tr>
            ))}</tbody>
          </table>
        </ScrollRegion>
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m36.grp.byKind')}>
          <div data-testid="m36-grp-by-kind">
            <BarChart title={t('m36.grp.byKind')} data={g.by_kind.map((k) => ({ label: t(`m36.gr.kind.${k.key}`), value: k.applications.value, suppressed: k.applications.suppressed }))} />
          </div>
        </Section>
        <Section title={t('m36.grp.byOutput')}>
          <div data-testid="m36-grp-by-output">
            <BarChart title={t('m36.grp.byOutput')} data={g.by_output.map((k) => ({ label: t(`m36.gr.outputKind.${k.key}`), value: k.promised.value, suppressed: k.promised.suppressed }))} />
          </div>
        </Section>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m36.grp.howTitle')}>{t('m36.grp.howBody')}</Callout>
        <Callout tone="sim" title={t('m36.grp.supTitle')}>{t('m36.grp.supBody', { n: f.num(g.min_group) })}</Callout>
      </div>
    </div>
  );
}
