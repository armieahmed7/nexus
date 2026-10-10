// FS01 (future skills, wave A) · /admin/frameworks?tab=benchmarks: the benchmark registry (kafaa_benchmarks). Everyone with
// the frameworks page reads it; framework owners (frameworks W/A) edit names, sources, the read-on date, status and "what
// we borrow" (direct write under the frameworks rule, audited by the row trigger). Mounted by m16/AdminFrameworksPage.
// Strings: src/i18n/fs.*.json (admin.bm.*). Rules: src/domain/benchmarks.ts (= SQL checks in the FS11 migration).
import { useMemo, useState } from 'react';
import { useAction, useRepo } from '../../../data';
import { useBenchmarks } from '../../../data/useBenchmarks';
import { useSession } from '../../../auth/session';
import { useFormat, usePick, useT } from '../../../i18n';
import {
  Async, BarChart, BenchmarkChips, BenchmarkDrawer, BenchmarkLine, Callout, Card, ConfirmDialog, DataTable, EmptyState, FilterBar, Modal, SelectField, StatTile, StatusPill, TextArea, TextField,
  useBenchmarkYear, useFilters, type Column,
} from '../../../ui';
import { BENCHMARK_CATEGORIES, BENCHMARK_STATUSES, benchmarkProblems, figuresOf, hostOf, type BenchmarkRow } from '../../../domain/benchmarks';
import { FEATURE_BENCHMARKS } from '../../../domain/taxonomy';

export default function BenchmarksTab() {
  const t = useT();
  const s = useSession();
  const q = useBenchmarks();
  const canEdit = s.can('frameworks', ['W', 'A']);
  return (
    <Async state={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t('fs.admin.bm.empty')} />}>
      {(rows) => <Registry rows={rows} canEdit={canEdit} />}
    </Async>
  );
}

function Registry({ rows, canEdit }: { rows: BenchmarkRow[]; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const year = useBenchmarkYear();
  const [flt, setFlt] = useFilters({ bq: '', bcat: '', bstatus: '' }, true);
  const [open, setOpen] = useState<BenchmarkRow | null>(null);
  const [edit, setEdit] = useState<BenchmarkRow | null>(null);
  const published = rows.filter((r) => r.status === 'published').length;
  const sources = rows.reduce((a, r) => a + r.urls.length, 0);
  const figures = rows.reduce((a, r) => a + figuresOf(r).length, 0);
  const featureCount = Object.values(FEATURE_BENCHMARKS).filter((x) => x.length > 0).length;
  const shown = useMemo(() => {
    const term = flt.bq.trim().toLowerCase();
    return rows.filter((r) => (!flt.bcat || r.category === flt.bcat) && (!flt.bstatus || r.status === flt.bstatus)
      && (!term || `${r.id} ${r.name_en} ${r.name_ar} ${r.owner_en} ${r.owner_ar} ${r.country_en}`.toLowerCase().includes(term)));
  }, [rows, flt]);
  const cols: Column<BenchmarkRow>[] = [
    { key: 'name', header: t('fs.admin.bm.colName'), value: (r) => pick(r, 'name'), sortable: true, render: (r) => (
      <button type="button" className="text-start font-semibold text-eyebrow hover:underline" onClick={() => setOpen(r)} data-testid={`fs-bm-open-${r.id}`}>
        {pick(r, 'name')}
        <span className="mt-0.5 block text-[11.5px] font-normal text-ink-3"><bdi dir="ltr">{r.id}</bdi></span>
      </button>
    ) },
    { key: 'owner', header: t('fs.admin.bm.colOwner'), value: (r) => pick(r, 'owner'), sortable: true, render: (r) => <span className="text-ink-2">{pick(r, 'owner')}<span className="block text-[11.5px] text-ink-3">{pick(r, 'country')}</span></span> },
    { key: 'year', header: t('fs.admin.bm.colYear'), value: (r) => r.year_from, sortable: true, render: (r) => <span className="tabular-nums whitespace-nowrap">{year(r)}</span> },
    { key: 'category', header: t('fs.admin.bm.colCategory'), value: (r) => t(`fs.bm.category.${r.category}`), render: (r) => <StatusPill tone="accent">{t(`fs.bm.category.${r.category}`)}</StatusPill> },
    { key: 'sources', header: t('fs.admin.bm.colSources'), value: (r) => r.urls.map(hostOf).join(' '), render: (r) => (
      <span className="flex flex-col gap-0.5 text-[12px]">{r.urls.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="truncate"><bdi dir="ltr">{hostOf(u)}</bdi></a>)}</span>
    ) },
    { key: 'figures', header: t('fs.admin.bm.colFigures'), value: (r) => figuresOf(r).length, align: 'end', render: (r) => <span className="num">{f.num(figuresOf(r).length)}</span> },
    { key: 'features', header: t('fs.admin.bm.colFeatures'), value: (r) => r.feature_ids.length, align: 'end', render: (r) => <span className="num">{f.num(r.feature_ids.length)}</span> },
    { key: 'asof', header: t('fs.admin.bm.colAsOf'), value: (r) => r.as_of, render: (r) => <span className="whitespace-nowrap">{f.date(r.as_of)}</span> },
    { key: 'status', header: t('fs.admin.bm.colStatus'), value: (r) => r.status, render: (r) => <StatusPill status={r.status}>{t(`fs.bm.status.${r.status}`)}</StatusPill> },
    ...(canEdit ? [{ key: 'act', header: '', csv: false, render: (r: BenchmarkRow) => <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(r)} data-testid={`fs-bm-edit-${r.id}`}>{t('fs.admin.bm.edit')}</button> } as Column<BenchmarkRow>] : []),
  ];
  return (
    <div className="space-y-4" data-testid="fs-admin-benchmarks">
      <div className="space-y-2">
        <p className="max-w-3xl text-ink-2">{t('fs.admin.bm.intro')}</p>
        <BenchmarkChips feature="FS01" label={t('fs.admin.bm.followsHere')} />
        {!canEdit && <p className="text-[12.5px] text-ink-3">{t('fs.admin.bm.readOnly')}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('fs.admin.bm.total')} value={f.num(rows.length)} sub={t('fs.admin.bm.published', { n: f.num(published) })} />
        <StatTile label={t('fs.admin.bm.sourcesTile')} value={f.num(sources)} sub={t('fs.admin.bm.sourcesSub')} tone="ok" />
        <StatTile label={t('fs.admin.bm.figuresTile')} value={f.num(figures)} sub={t('fs.admin.bm.figuresSub')} />
        <StatTile label={t('fs.admin.bm.featuresTile')} value={f.num(featureCount)} sub={t('fs.admin.bm.featuresSub', { n: f.num(featureCount) })} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('fs.admin.bm.byCategory')}>
          <BarChart title={t('fs.admin.bm.byCategory')} data={BENCHMARK_CATEGORIES.map((c) => ({ label: t(`fs.bm.category.${c}`), value: rows.filter((r) => r.category === c).length }))} />
        </Card>
        <Card title={t('fs.admin.bm.lineDemo')}>
          <p className="mb-3 text-[13px] text-ink-2">{t('fs.admin.bm.lineDemoBody')}</p>
          <BenchmarkLine max={500} label={t('fs.admin.bm.lineDemo')} benchmark={{ id: 'OECD-PIAAC', figure: 'aps_oecd_average' }} />
        </Card>
      </div>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="bq"
        fields={[
          { key: 'bcat', label: t('fs.admin.bm.colCategory'), options: BENCHMARK_CATEGORIES.map((c) => ({ value: c, label: t(`fs.bm.category.${c}`) })) },
          { key: 'bstatus', label: t('fs.admin.bm.colStatus'), options: BENCHMARK_STATUSES.map((c) => ({ value: c, label: t(`fs.bm.status.${c}`) })) },
        ]}
      />
      {shown.length === 0 ? <EmptyState title={t('fs.admin.bm.empty')} /> : (
        <div data-testid="fs-bm-table"><DataTable rows={shown} rowKey={(r) => r.id} columns={cols} csvName="kafaa-benchmarks" initialSort={{ key: 'year', dir: 'desc' }} /></div>
      )}
      {open && <BenchmarkDrawer row={open} open onClose={() => setOpen(null)} />}
      {edit && <EditBenchmark row={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditBenchmark({ row, onClose }: { row: BenchmarkRow; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [v, setV] = useState({ name_en: row.name_en, name_ar: row.name_ar, urls: row.urls.join('\n'), as_of: row.as_of, status: row.status, borrow_en: row.borrow_en, borrow_ar: row.borrow_ar });
  const [confirm, setConfirm] = useState(false);
  const next: BenchmarkRow = { ...row, ...v, urls: v.urls.split(/\s*\n\s*/).map((x) => x.trim()).filter(Boolean), listed: v.status === 'published' };
  const problems = benchmarkProblems(next);
  const set = (k: keyof typeof v) => ({ name: `fs-bm-${k}`, value: v[k], onChange: (x: string) => setV((o) => ({ ...o, [k]: x })) });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t('fs.admin.bm.editTitle', { id: row.id })}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={problems.length > 0} onClick={() => setConfirm(true)} data-testid="fs-bm-save">{t('fs.admin.bm.save')}</button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label={t('fs.admin.bm.nameEn')} required {...set('name_en')} />
        <TextField label={t('fs.admin.bm.nameAr')} required {...set('name_ar')} />
        <TextArea label={t('fs.admin.bm.urls')} rows={3} required {...set('urls')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('fs.admin.bm.asOf')} type="date" required {...set('as_of')} />
          <SelectField label={t('fs.admin.bm.status')} options={BENCHMARK_STATUSES.map((x) => ({ value: x, label: t(`fs.bm.status.${x}`) }))} {...set('status')} />
        </div>
        <TextArea label={t('fs.admin.bm.borrowEn')} rows={2} required {...set('borrow_en')} />
        <TextArea label={t('fs.admin.bm.borrowAr')} rows={2} required {...set('borrow_ar')} />
        {problems.length > 0 && (
          <Callout tone="bad" title={t('fs.admin.bm.invalid')}>
            <ul className="list-disc ps-5" data-testid="fs-bm-problems">{problems.map((p) => <li key={p}>{t(`fs.problems.bm.${p}`)}</li>)}</ul>
          </Callout>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('fs.admin.bm.confirmTitle', { id: row.id })}
        consequence={t('fs.admin.bm.consequence')}
        onConfirm={async () => {
          const r = await run(() => repo.update('benchmarks', row.id, { name_en: next.name_en, name_ar: next.name_ar, urls: next.urls, as_of: next.as_of, status: next.status as never, listed: next.listed, borrow_en: next.borrow_en, borrow_ar: next.borrow_ar, updated_at: new Date().toISOString(), updated_by: s.identity.personId ?? null }), { success: t('fs.admin.bm.saved') });
          if (r.ok) onClose();
        }}
      />
    </Modal>
  );
}
