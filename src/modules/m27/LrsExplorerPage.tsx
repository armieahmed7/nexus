// M27 /training/lrs (F30): the statement explorer. Instructors and managers see statements of the people in their scope
// (rpc.queryStatements; every read of someone else's record is audited); auditors see all. Training and HR analytics get the
// suppressed aggregate (rpc.lrsAggregate, cells under 10 people hidden) that feeds F25 effectiveness and F26 needs. The emitter
// registry shows which Kafa'a events write statements. Free-text search ranks statements with the shared BM25 engine.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, StatTile, Async, EmptyState, ErrorState, Callout, Tabs, Skeleton, DataTable, BarChart, LineChart, EngineBadge, WhyThis, SimChip, type Column } from '../../ui';
import { useT, useFormat, useLang, L } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { OBJECT_TYPES, SOURCES, VERBS, summarise, isoTs, type StatementRow, type LrsAggregate } from './xapi';
import type { StatementPage } from './backend/rpc';
import { EmittersTable, LrsMirrorNote, ResultBits, SourceChip, StatementDrawer, VerbChip, normRow, provenance, useObjectName, usePersonName } from './lrsUi';

export default function LrsExplorerPage() {
  const t = useT();
  const s = useSession();
  const canRows = s.can('lrs', ['Scope', 'R']);
  const canAgg = s.can('lrs', ['Agg', 'R']);
  const tabs = [
    ...(canRows ? [{ id: 'statements', label: t('m27.ex.tab.statements'), content: <StatementsTab /> }] : []),
    ...(canAgg ? [{ id: 'analytics', label: t('m27.ex.tab.analytics'), content: <AnalyticsTab /> }] : []),
    { id: 'emitters', label: t('m27.ex.tab.emitters'), content: <EmittersTab /> },
  ];
  return (
    <Page
      title={t('m27.routes.training-lrs.title')}
      eyebrow={t('m27.common.eyebrow')}
      intro={t('m27.ex.intro')}
      actions={
        <span className="flex flex-wrap gap-2">
          <L to="/training/lrs/adapters" className="btn-outline btn-sm no-underline" data-testid="m27-adapters-link">{t('m27.ex.adapters')}</L>
          {s.can('integrations', ['A']) && <L to="/training/lrs/console" className="btn-outline btn-sm no-underline">{t('m27.ex.console')}</L>}
        </span>
      }
      wide
    >
      {s.status === 'loading' ? <Skeleton lines={4} /> : <Tabs key={tabs.map((x) => x.id).join(',')} tabs={tabs} />}
      <LrsMirrorNote />
    </Page>
  );
}

interface Filters { person: string; verb: string; type: string; source: string; period: string }
const PERIODS = ['all', '30', '90', '365'] as const;

function StatementsTab() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery('xapi_statements', async () => {
    const r = await repo.rpc.queryStatements({ limit: 1000 });
    if (!r.ok || !r.data) throw new Error(r.message);
    return { ...r.data, rows: r.data.rows.map(normRow) } as StatementPage;
  });
  return (
    <div className="space-y-4 pt-4">
      <Callout tone="info" title={t('m27.ex.auditTitle')}>{t('m27.ex.audit')}</Callout>
      <Async state={q} isEmpty={(d) => d.rows.length === 0} empty={<EmptyState title={t('m27.ex.empty')}>{t('m27.ex.emptyBody')}</EmptyState>}>
        {(d) => <StatementsBody page={d} />}
      </Async>
    </div>
  );
}

function StatementsBody({ page }: { page: StatementPage }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const eng = useEngine('search');
  const objName = useObjectName();
  const who = usePersonName(page.people);
  const [fl, setFl] = useState<Filters>({ person: '', verb: '', type: '', source: '', period: 'all' });
  const [text, setText] = useState('');
  const [open, setOpen] = useState<StatementRow | null>(null);
  const docs = useMemo(
    () => page.rows.map((r) => {
      const n = (r.object_name ?? {}) as Record<string, string>;
      const p = page.people.find((x) => x.id === r.actor_person_id);
      return { id: r.id, kind: r.source, title: { en: n.en ?? r.object_id, ar: n.ar ?? n.en ?? r.object_id }, text: { en: `${r.verb} ${r.object_type} ${p?.name ?? ''}`, ar: `${t(`m27.verb.${r.verb}`)} ${t(`m27.type.${r.object_type}`)} ${p?.name_ar ?? ''}` }, keywords: [r.object_id, r.actor_person_id] };
    }),
    [page, t],
  );
  const index = useMemo(() => eng.search(docs), [eng, docs]);
  const ranked = useMemo(() => (text.trim() ? new Map(index.search(text, 1000).map((h, i) => [h.doc.id, i])) : null), [index, text]);
  const cutoff = fl.period === 'all' ? null : Date.parse(`${isoTs(new Date()).slice(0, 10)}T00:00:00Z`) - Number(fl.period) * 86400000;
  const rows = page.rows
    .filter((r) => (!fl.person || r.actor_person_id === fl.person) && (!fl.verb || r.verb === fl.verb) && (!fl.type || r.object_type === fl.type) && (!fl.source || r.source === fl.source) && (cutoff == null || Date.parse(r.occurred_at) >= cutoff) && (!ranked || ranked.has(r.id)))
    .sort((a, b) => (ranked ? (ranked.get(a.id)! - ranked.get(b.id)!) : 0));
  const sum = summarise(rows);
  const people = [...page.people].sort((a, b) => (lang === 'ar' ? (a.name_ar || a.name).localeCompare(b.name_ar || b.name, 'ar') : a.name.localeCompare(b.name)));
  const sel = (key: keyof Filters, label: string, opts: { value: string; label: string }[]) => (
    <label className="block min-w-[150px] flex-1">
      <span className="caps">{label}</span>
      <select className="input mt-1" value={fl[key]} onChange={(e) => setFl({ ...fl, [key]: e.target.value })} data-testid={`m27-f-${key}`}>
        {key !== 'period' && <option value="">{t('m27.filter.all')}</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  const cols: Column<StatementRow>[] = [
    { key: 'when', header: t('m27.col.when'), value: (r) => r.occurred_at, sortable: true, render: (r) => <span className="whitespace-nowrap">{f.dateTime(r.occurred_at)}</span> },
    { key: 'who', header: t('m27.col.person'), value: (r) => who(r.actor_person_id), sortable: true, render: (r) => <L to={`/training/lrs/people/${r.actor_person_id}`} onClick={(e) => e.stopPropagation()}>{who(r.actor_person_id)}</L> },
    { key: 'verb', header: t('m27.col.verb'), value: (r) => t(`m27.verb.${r.verb}`), sortable: true, render: (r) => <VerbChip verb={r.verb} /> },
    { key: 'object', header: t('m27.col.activity'), value: (r) => objName(r), sortable: true, render: (r) => <span><span className="font-semibold">{objName(r)}</span><span className="block text-[12px] text-ink-3">{t(`m27.type.${r.object_type}`)}</span></span> },
    { key: 'result', header: t('m27.col.result'), csv: false, render: (r) => <ResultBits result={r.result} /> },
    { key: 'source', header: t('m27.col.source'), value: (r) => t(`m27.source.${r.source}`), sortable: true, render: (r) => <SourceChip source={r.source} /> },
    { key: 'why', header: '', csv: false, render: (r) => <span onClick={(e) => e.stopPropagation()}><WhyThis reasons={provenance(r)} label={t('m27.detail.whyShort')} testId="m27-why" /></span> },
  ];
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m27.ex.tile.statements')} value={f.num(rows.length)} sub={page.total > page.rows.length ? t('m27.ex.tile.latest', { n: f.num(page.rows.length), total: f.num(page.total) }) : t('m27.ex.tile.scope', { scope: t(`m27.scope.${page.scope}`) })} />
        <StatTile label={t('m27.ex.tile.people')} value={f.num(new Set(rows.map((r) => r.actor_person_id)).size)} sub={t('m27.ex.tile.peopleSub')} />
        <StatTile label={t('m27.mix.completions')} value={f.num(sum.completions)} sub={t('m27.mix.completionsSub')} tone="ok" />
        <StatTile label={t('m27.mix.hours')} value={f.num(Math.round(sum.minutes / 6) / 10)} sub={t('m27.mix.hoursSub')} />
      </Grid>
      <div className="flex flex-wrap items-end gap-3" data-testid="m27-filters">
        <label className="block min-w-[220px] flex-[2]">
          <span className="caps">{t('m27.filter.search')}</span>
          <input className="input mt-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('m27.filter.searchHint')} data-testid="m27-search" />
        </label>
        {sel('person', t('m27.filter.person'), people.map((p) => ({ value: p.id, label: lang === 'ar' && p.name_ar ? p.name_ar : p.name })))}
        {sel('verb', t('m27.filter.verb'), VERBS.map((v) => ({ value: v, label: t(`m27.verb.${v}`) })))}
        {sel('type', t('m27.filter.type'), OBJECT_TYPES.map((v) => ({ value: v, label: t(`m27.type.${v}`) })))}
        {sel('source', t('m27.filter.source'), SOURCES.map((v) => ({ value: v, label: t(`m27.source.${v}`) })))}
        {sel('period', t('m27.filter.period'), PERIODS.map((p) => ({ value: p, label: t(`m27.period.${p}`) })))}
        <EngineBadge engine={eng} />
      </div>
      <div data-testid="m27-statements">
        <DataTable rows={rows} rowKey={(r) => r.id} columns={cols} csvName="kafaa-xapi-statements" searchable={false} onRowClick={setOpen} empty={<EmptyState title={t('m27.ex.noMatch')} />} />
      </div>
      <StatementDrawer row={open} who={open ? who(open.actor_person_id) : undefined} onClose={() => setOpen(null)} />
    </>
  );
}

function AnalyticsTab() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery('xapi_statements', () => repo.rpc.lrsAggregate());
  return (
    <div className="space-y-4 pt-4">
      <Callout tone="info" title={t('m27.an.privacyTitle')}>{t('m27.an.privacy', { n: MIN_GROUP_SIZE })}</Callout>
      <Async state={q} isEmpty={(d) => d.statements === 0} empty={<EmptyState title={t('m27.an.empty')} />}>
        {(d) => <AnalyticsBody a={d} />}
      </Async>
    </div>
  );
}

function AnalyticsBody({ a }: { a: LrsAggregate }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const cells = (dim: string) => a.cells.filter((c) => c.dim === dim);
  const months = cells('month').map((c) => c.key).sort().slice(-12);
  const mv = (m: string, v: string) => a.cells.find((c) => c.dim === 'month_verb' && c.key === m && c.key2 === v);
  const verbsShown = ['completed', 'answered', 'attended', 'experienced'];
  const shown = a.cells.filter((c) => !c.suppressed).length;
  const fmt = (c: { statements: number | null; suppressed: boolean } | undefined) => (!c ? '—' : c.suppressed ? t('common.suppressedShort') : f.num(c.statements));
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m27.an.statements')} value={f.num(a.statements)} sub={t('m27.an.statementsSub')} />
        <StatTile label={t('m27.an.people')} value={a.actors == null ? t('common.suppressedShort') : f.num(a.actors)} sub={t('m27.an.peopleSub')} />
        <StatTile label={t('m27.an.cells')} value={f.num(shown)} sub={t('m27.an.cellsSub', { n: f.num(a.cells.length - shown) })} />
        <StatTile label={t('m27.an.top')} value={f.num(a.top.length)} sub={t('m27.an.topSub', { n: MIN_GROUP_SIZE })} />
      </Grid>
      <Section title={t('m27.an.trendTitle')} description={t('m27.an.trendBody')}>
        <Card>
          <LineChart
            title={t('m27.an.trendTitle')}
            series={verbsShown.map((v, i) => ({ name: t(`m27.verb.${v}`), tone: ['ok', 'info', 'accent', 'sky'][i], points: months.map((m) => { const c = mv(m, v); return { x: f.date(`${m}-01`, 'short').replace(/^\d+\s*/, ''), y: c && !c.suppressed ? c.statements : null }; }) }))}
          />
        </Card>
      </Section>
      <Grid cols={2}>
        <Card title={t('m27.an.bySource')}>
          <BarChart title={t('m27.an.bySource')} data={cells('source').map((c) => ({ label: t(`m27.source.${c.key}`), value: c.statements, suppressed: c.suppressed }))} />
        </Card>
        <Card title={t('m27.an.byType')}>
          <BarChart title={t('m27.an.byType')} data={cells('type').map((c) => ({ label: t(`m27.type.${c.key}`), value: c.statements, suppressed: c.suppressed, tone: 'leaf' }))} />
        </Card>
      </Grid>
      <Section title={t('m27.an.topTitle')} description={t('m27.an.topBody', { n: MIN_GROUP_SIZE })}>
        <div data-testid="m27-top">
          <DataTable
            rows={a.top}
            rowKey={(r) => `${r.object_type}:${r.object_id}`}
            csvName="kafaa-lrs-top-activities"
            searchable={false}
            columns={[
              { key: 'name', header: t('m27.col.activity'), value: (r) => (lang === 'ar' ? r.name_ar || r.name_en || r.object_id : r.name_en || r.object_id), sortable: true },
              { key: 'type', header: t('m27.col.type'), value: (r) => t(`m27.type.${r.object_type}`), sortable: true },
              { key: 'people', header: t('m27.col.people'), value: (r) => r.actors, sortable: true, align: 'end', render: (r) => f.num(r.actors) },
              { key: 'statements', header: t('m27.col.statements'), value: (r) => r.statements, sortable: true, align: 'end', render: (r) => f.num(r.statements) },
            ]}
          />
        </div>
      </Section>
      <Section title={t('m27.an.verbTitle')}>
        <div data-testid="m27-verbs">
          <DataTable
            rows={cells('verb')}
            rowKey={(r) => r.key}
            searchable={false}
            csvName="kafaa-lrs-verbs"
            columns={[
              { key: 'verb', header: t('m27.col.verb'), value: (r) => t(`m27.verb.${r.key}`), render: (r) => <VerbChip verb={r.key} /> },
              { key: 'statements', header: t('m27.col.statements'), value: (r) => fmt(r), align: 'end' },
              { key: 'people', header: t('m27.col.people'), value: (r) => (r.suppressed ? t('common.suppressedShort') : f.num(r.actors)), align: 'end' },
            ]}
          />
        </div>
      </Section>
      <Callout tone="sim" title={t('m27.an.feedsTitle')}>{t('m27.an.feeds')}</Callout>
    </>
  );
}

function EmittersTab() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const canAgg = s.can('lrs', ['Agg', 'R']);
  const q = useQuery('xapi_statements', async () => {
    if (!canAgg) return undefined;
    const a = await repo.rpc.lrsAggregate();
    return Object.fromEntries(a.cells.filter((c) => c.dim === 'source').map((c) => [c.key, c.statements]));
  }, [canAgg]);
  return (
    <div className="space-y-4 pt-4">
      <p className="text-[13px] text-ink-2">{t('m27.ex.emittersBody')}</p>
      <Card actions={<SimChip label={t('m27.ex.plannedChip')} />}>
        {q.error ? <ErrorState error={q.error} retry={q.reload} /> : <EmittersTable counts={q.data} />}
      </Card>
    </div>
  );
}
