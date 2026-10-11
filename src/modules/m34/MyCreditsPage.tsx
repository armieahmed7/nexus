// FS30 /my/credits · My learning credits: the personal ledger (one row per completed, tagged item and each RPL credit), totals by kind,
// indicative NQF levels, and progress on the 30-credit stacks toward an indicative award with a partner university still to be agreed.
// The page recomputes creditsFor() on the rows it can read and offers "refresh my ledger" (rpc.syncCredits) when they differ.
// Every figure is indicative until agreed with the NQC and the partner.
import { useMemo } from 'react';
import { Async, BenchmarkLine, Card, DataTable, EmptyState, Page, ProgressRing, Section, StatTile, StatusPill, WhyThis, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { Reason } from '../../domain/engines/types';
import { LEDGER_KINDS, creditsFor, ledgerDiff, ledgerTotal, stackProgress, type CreditWorld } from './credits';
import { Bench, IndicativeNote, NotAuthority, NqfBadge, useCredits, type Row } from './ui';

export default function MyCreditsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const q = useQuery(['credit_ledger', 'credit_tags', 'credit_stacks', 'rpl_requests'], async () => {
    const safe = (p: Promise<unknown>) => p.catch(() => null) as Promise<Row[] | null>;
    const [ledger, tags, stacks, tr, pe, ma, rpl] = await Promise.all([
      safe(repo.list('credit_ledger', { filter: { person_id: me } })), safe(repo.list('credit_tags', {})), safe(repo.list('credit_stacks', { order: [['sort', 'asc']] })),
      safe(repo.list('training_records', { filter: { person_id: me } })), safe(repo.list('pathway_enrolments', { filter: { person_id: me } })),
      safe(repo.list('microcred_awards', { filter: { person_id: me } })), safe(repo.list('rpl_requests', { filter: { person_id: me } })),
    ]);
    const world = tr && pe && ma && rpl && tags && stacks ? ({ training_records: tr, pathway_enrolments: pe, microcred_awards: ma, rpl_requests: rpl, credit_tags: tags, credit_stacks: stacks } as unknown as CreditWorld) : null;
    return { ledger: (ledger ?? []).filter((r) => r.person_id === me), tags: tags ?? [], stacks: stacks ?? [], world };
  }, [me]);
  return (
    <Page title={t('m34.routes.my-credits.title')} eyebrow={t('m34.cr.eyebrow')} intro={t('m34.cr.intro')} wide actions={<L to="/recognition?tab=nqf" className="btn-outline">{t('m34.cr.how')}</L>}>
      <Bench />
      <IndicativeNote />
      <Async state={q}>{(d) => <Body d={d} me={me} />}</Async>
      <NotAuthority />
    </Page>
  );
}

function Body({ d, me }: { d: { ledger: Row[]; tags: Row[]; stacks: Row[]; world: CreditWorld | null }; me: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const credits = useCredits();
  const repo = useRepo();
  const act = useAction();
  const counted = d.ledger.filter((r) => r.status === 'counted');
  const total = ledgerTotal(counted as never);
  const diff = useMemo(() => (d.world ? ledgerDiff(d.ledger as never, creditsFor(me, d.world)) : null), [d, me]);
  const stale = diff ? diff.upsert.length + diff.reverse.length : 0;
  const progress = d.stacks.map((st) => ({ st, p: stackProgress({ id: st.id, credits_required: st.credits_required, rpl_max: st.rpl_max, min_item_nqf: st.min_item_nqf }, counted as never) }));
  const best = [...progress].sort((a, b) => b.p.pct - a.p.pct)[0];
  const cols: Column<Row>[] = [
    { key: 'item', header: t('m34.cr.colItem'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <span className="font-semibold">{pick(r, 'title')}</span> },
    { key: 'kind', header: t('m34.cr.colKind'), value: (r) => t(`m34.item.${r.item_kind}`) },
    { key: 'on', header: t('m34.cr.colOn'), value: (r) => String(r.completed_on ?? ''), sortable: true, render: (r) => f.date(String(r.completed_on).slice(0, 10)) },
    { key: 'nqf', header: t('m34.cr.colNqf'), value: (r) => r.nqf_level ?? '', render: (r) => <NqfBadge level={r.nqf_level} /> },
    { key: 'credits', header: t('m34.cr.colCredits'), value: (r) => Number(r.notional_hours) / 10, sortable: true, render: (r) => <span className="num font-semibold">{credits(r.notional_hours)}</span> },
    { key: 'stacks', header: t('m34.cr.colStacks'), value: (r) => (r.stack_ids ?? []).join(' '), render: (r) => <span className="flex flex-wrap gap-1">{(r.stack_ids ?? []).map((x: string) => <StatusPill key={x} tone="neutral">{pick(d.stacks.find((s) => s.id === x), 'title')}</StatusPill>)}</span> },
    { key: 'status', header: t('m34.my.colStatus'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'counted' ? 'ok' : 'neutral'}>{t(`m34.cr.status.${r.status}`)}</StatusPill> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-cr-tiles">
        <StatTile label={t('m34.cr.tTotal')} value={f.num(total, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sub={t('m34.cr.tTotalSub', { h: f.num(Math.round(total * 10)) })} tone="ok" />
        {LEDGER_KINDS.filter((k) => k !== 'pathway').map((k) => (
          <StatTile key={k} label={t(`m34.item.${k}s`)} value={credits(counted.filter((r) => r.item_kind === k).reduce((a, r) => a + Number(r.notional_hours), 0))} sub={t('m34.cr.items', { n: f.num(counted.filter((r) => r.item_kind === k).length) })} />
        ))}
      </div>
      <Card title={t('m34.cr.syncTitle')}>
        <div className="flex flex-wrap items-center gap-3" data-testid="m34-cr-sync">
          {diff == null ? <span className="text-[13px] text-ink-3">{t('m34.cr.syncUnknown')}</span> : stale === 0
            ? <StatusPill tone="ok">{t('m34.cr.upToDate')}</StatusPill> : <StatusPill tone="sim">{t('m34.cr.stale', { n: f.num(stale) })}</StatusPill>}
          <button type="button" className="btn-outline btn-sm" onClick={() => act(() => repo.rpc.syncCredits(me))} data-testid="m34-cr-refresh">{t('m34.cr.refresh')}</button>
          <span className="text-[12px] text-ink-3">{t('m34.cr.syncNote')}</span>
        </div>
      </Card>
      <Section title={t('m34.cr.stacksTitle')} description={t('m34.cr.stacksDesc')}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m34-cr-stacks">
          {progress.map(({ st, p }) => {
            const why: Reason[] = [
              { code: 'items', key: 'm34.cr.why.items', vars: { n: p.items, min: st.min_item_nqf } },
              { code: 'rpl', key: p.rpl_capped ? 'm34.cr.why.rplCap' : 'm34.cr.why.rpl', vars: { c: p.rpl_credits, max: st.rpl_max } },
              { code: 'left', key: 'm34.cr.why.left', vars: { c: p.remaining } },
            ];
            return (
              <Card key={st.id} title={pick(st, 'title')} eyebrow={t('m34.cr.stackEyebrow', { n: f.num(st.credits_required) })}>
                <div className="flex items-center gap-4">
                  <ProgressRing value={p.pct} label={f.pct(p.pct, 0)} tone={p.complete ? 'ok' : 'accent'} />
                  <div className="min-w-0 flex-1">
                    <BenchmarkLine value={p.credits} max={st.credits_required} unit="count" label={t('m34.cr.stackLine')} benchmark={{ id: 'ENTITLE', figure: 'module_credits' }} />
                  </div>
                </div>
                <p className="mt-2 text-[13px]">{pick(st, 'award')}</p>
                <p className="text-[12px] text-ink-3">{pick(st, 'partner')} · <NqfBadge level={st.nqf_level} /></p>
                <div className="mt-1"><WhyThis reasons={why} testId={`m34-cr-why-${st.id}`} /></div>
              </Card>
            );
          })}
        </div>
        {best && best.p.pct > 0 && <p className="mt-2 text-[13px] text-ink-2">{t('m34.cr.closest', { stack: pick(best.st, 'title'), c: f.num(best.p.remaining) })}</p>}
      </Section>
      <Section title={t('m34.cr.ledgerTitle')} description={t('m34.cr.ledgerDesc')}>
        {d.ledger.length === 0 ? <EmptyState title={t('m34.cr.empty')}><L to="/learn">{t('m34.cr.emptyLink')}</L></EmptyState> : (
          <div data-testid="m34-cr-ledger"><DataTable rows={d.ledger} columns={cols} rowKey={(r) => r.id} pageSize={15} caption={t('m34.cr.ledgerTitle')} csvName="kafaa-my-credits.csv" initialSort={{ key: 'on', dir: 'desc' }} /></div>
        )}
      </Section>
    </div>
  );
}
