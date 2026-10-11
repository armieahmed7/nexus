// FS10 /training/ai-fitness/items (secure_items W/A: instructors read, the training manager writes): the fitness-check item bank.
// Coverage by area and difficulty (the adaptive routing needs at least two active items per cell), the items in EN and AR with
// their key, and, for the training manager (ai_literacy W), add / edit / retire through rpc.saveFitnessItem: the server re-checks
// every rule, keeps two active items per cell and refuses any wording that touches plant security. Every save is audited.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, DataTable, Drawer, Modal, ConfirmDialog, SelectField, TextArea, TextField, StatusPill, Heatmap, FilterBar, useFilters, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { DIFFICULTIES, MIN_ITEMS_PER_CELL, itemProblem, type ItemInput } from './fitness';
import { useM29Ref, type M29Ref, type Row } from './ui';

function useBank() {
  const repo = useRepo();
  return useQuery(['fitness_items'], async () => (await repo.list('fitness_items' as never, { order: [['area_id', 'asc'], ['difficulty', 'asc'], ['sort', 'asc']] } as never)) as Row[], []);
}

export default function ItemBankPage() {
  const t = useT();
  const ref = useM29Ref();
  const q = useBank();
  return (
    <Page title={t('m29.routes.training-ai-fitness-items.title')} intro={t('m29.bank.intro')} wide eyebrow={<BenchmarkChips feature="FS10" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(items) => <Bank d={d} items={items} />}</Async>}</Async>
    </Page>
  );
}

const EMPTY = { area_id: '', difficulty: '2', stem_en: '', stem_ar: '', o1_en: '', o2_en: '', o3_en: '', o4_en: '', o1_ar: '', o2_ar: '', o3_ar: '', o4_ar: '', correct: '0', explain_en: '', explain_ar: '' };
type FormState = typeof EMPTY & { id?: string | null };

function Bank({ d, items }: { d: M29Ref; items: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const canWrite = s.can('ai_literacy', ['W']);
  const [open, setOpen] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [retire, setRetire] = useState<Row | null>(null);
  const [flt, setFlt] = useFilters({ q: '', area: '', diff: '', status: '' }, true);
  const active = items.filter((i) => i.status === 'active');
  const count = (a: string, dd: number) => active.filter((i) => i.area_id === a && Number(i.difficulty) === dd).length;
  const thin = d.areas.flatMap((a: Row) => DIFFICULTIES.filter((dd) => count(a.id, dd) < MIN_ITEMS_PER_CELL).map((dd) => `${a.code}/${dd}`));
  const areaName = (id: string) => { const a = d.areas.find((x: Row) => x.id === id); return a ? `${a.code} · ${pick(a, 'name')}` : id; };
  const shown = useMemo(() => items
    .filter((i) => !flt.area || i.area_id === flt.area)
    .filter((i) => !flt.diff || String(i.difficulty) === flt.diff)
    .filter((i) => !flt.status || i.status === flt.status)
    .filter((i) => !flt.q || `${i.id} ${i.stem_en} ${i.stem_ar}`.toLowerCase().includes(flt.q.toLowerCase())), [items, flt]);
  const cols: Column<Row>[] = [
    { key: 'id', header: t('m29.bank.col.id'), value: (r) => r.id, render: (r) => <span className="num text-[12px]">{r.id}</span>, sortable: true },
    { key: 'area', header: t('m29.bank.col.area'), value: (r) => areaName(r.area_id), sortable: true },
    { key: 'diff', header: t('m29.bank.col.diff'), value: (r) => r.difficulty, render: (r) => t(`m29.diff.${r.difficulty}`), sortable: true },
    { key: 'stem', header: t('m29.bank.col.stem'), value: (r) => pick(r, 'stem'), render: (r) => <span className="line-clamp-2">{pick(r, 'stem')}</span> },
    { key: 'status', header: t('m29.bank.col.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'active' ? 'ok' : 'neutral'}>{t(`m29.bank.status.${r.status}`)}</StatusPill> },
    { key: 'v', header: t('m29.bank.col.version'), value: (r) => r.version, render: (r) => <span className="num">{f.num(r.version)}</span>, align: 'end' },
  ];
  const toForm = (r: Row): FormState => ({
    id: r.id, area_id: r.area_id, difficulty: String(r.difficulty), stem_en: r.stem_en, stem_ar: r.stem_ar, correct: String(r.correct), explain_en: r.explain_en ?? '', explain_ar: r.explain_ar ?? '',
    o1_en: r.options_en[0] ?? '', o2_en: r.options_en[1] ?? '', o3_en: r.options_en[2] ?? '', o4_en: r.options_en[3] ?? '',
    o1_ar: r.options_ar[0] ?? '', o2_ar: r.options_ar[1] ?? '', o3_ar: r.options_ar[2] ?? '', o4_ar: r.options_ar[3] ?? '',
  });
  const inputOf = (x: FormState, status?: 'active' | 'retired'): ItemInput => {
    const oe = [x.o1_en, x.o2_en, x.o3_en, x.o4_en].map((o) => o.trim()).filter(Boolean);
    const oa = [x.o1_ar, x.o2_ar, x.o3_ar, x.o4_ar].map((o) => o.trim()).filter(Boolean);
    return { id: x.id ?? null, area_id: x.area_id, difficulty: Number(x.difficulty), stem_en: x.stem_en, stem_ar: x.stem_ar, options_en: oe, options_ar: oa, correct: Number(x.correct), explain_en: x.explain_en, explain_ar: x.explain_ar, ...(status ? { status } : {}) };
  };
  const problem = form ? itemProblem(inputOf(form), d.areas.map((a: Row) => a.id)) : null;
  const save = async () => {
    if (!form || problem) return;
    const r = await act(() => repo.rpc.saveFitnessItem(inputOf(form)));
    if (r.ok) setForm(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={t('m29.bank.coverage.title')} eyebrow={t('m29.bank.coverage.eyebrow', { min: f.num(MIN_ITEMS_PER_CELL) })}>
          <div data-testid="m29-bank-coverage">
            <Heatmap title={t('m29.bank.coverage.title')} rows={d.areas.map((a: Row) => a.id)} cols={DIFFICULTIES.map(String)}
              rowLabel={(r) => areaName(r)} colLabel={(c) => t(`m29.diff.${c}`)}
              value={(r, c) => { const n = count(r, Number(c)); return { v: n, tone: n >= MIN_ITEMS_PER_CELL ? 'ok' : 'bad' }; }} />
          </div>
          {thin.length ? <p className="mt-2 text-[12.5px] text-bad">{t('m29.bank.coverage.thin', { list: thin.join(', ') })}</p> : <p className="mt-2 text-[12.5px] text-ok">{t('m29.bank.coverage.ok')}</p>}
        </Card>
        <Card title={t('m29.bank.rules.title')} eyebrow={t('m29.bank.rules.eyebrow')}>
          <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
            <li>{t('m29.bank.rules.r1')}</li><li>{t('m29.bank.rules.r2')}</li><li>{t('m29.bank.rules.r3')}</li><li>{t('m29.bank.rules.r4')}</li>
          </ul>
          {canWrite ? (
            <button type="button" className="btn-primary mt-4" onClick={() => setForm({ ...EMPTY, area_id: d.areas[0]?.id ?? '' })} data-testid="m29-bank-add">{t('m29.bank.add')}</button>
          ) : <p className="mt-3 text-[12.5px] text-ink-3" data-testid="m29-bank-readonly">{t('m29.bank.readonly')}</p>}
        </Card>
      </div>

      <Section title={t('m29.bank.list.title', { n: f.num(items.length) })}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'area', label: t('m29.bank.col.area'), options: d.areas.map((a: Row) => ({ value: a.id, label: areaName(a.id) })) },
          { key: 'diff', label: t('m29.bank.col.diff'), options: DIFFICULTIES.map((x) => ({ value: String(x), label: t(`m29.diff.${x}`) })) },
          { key: 'status', label: t('m29.bank.col.status'), options: ['active', 'retired'].map((x) => ({ value: x, label: t(`m29.bank.status.${x}`) })) },
        ]} />
        {shown.length ? (
          <div data-testid="m29-bank-items">
            <DataTable rows={shown} columns={cols} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r)} searchable={false} pageSize={20} caption={t('m29.bank.list.caption')} />
          </div>
        ) : <EmptyState title={t('m29.bank.list.none')} />}
      </Section>
      <Callout tone="sim" title={t('m29.bank.security.title')}>{t('m29.bank.security.body')}</Callout>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.id} · ${areaName(open.area_id)}` : ''}
        footer={open && canWrite ? <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => { setForm(toForm(open)); setOpen(null); }} data-testid="m29-bank-edit">{t('m29.bank.edit')}</button>
          {open.status === 'active' && <button type="button" className="btn-outline btn-sm" onClick={() => { setRetire(open); setOpen(null); }} data-testid="m29-bank-retire">{t('m29.bank.retire')}</button>}
        </div> : undefined}>
        {open && (
          <div className="space-y-4 text-[13.5px]" data-testid="m29-bank-drawer">
            {(['en', 'ar'] as const).map((lng) => (
              <div key={lng} dir={lng === 'ar' ? 'rtl' : 'ltr'} lang={lng} className="space-y-2">
                <h3 className="caps">{t(`m29.bank.lang.${lng}`)}</h3>
                <p className="font-semibold">{open[`stem_${lng}`]}</p>
                <ol className="space-y-1">
                  {(open[`options_${lng}`] as string[]).map((o, i) => (
                    <li key={i} className={`rounded-md border px-2 py-1 ${i === open.correct ? 'border-ok bg-ok-bg' : 'border-line'}`}>{o}{i === open.correct && <span className="caps ms-2 text-ok">{t('m29.bank.key')}</span>}</li>
                  ))}
                </ol>
                {open[`explain_${lng}`] && <p className="text-ink-2">{open[`explain_${lng}`]}</p>}
              </div>
            ))}
            <p className="text-[12px] text-ink-3">{t('m29.bank.meta', { v: f.num(open.version), date: f.date(String(open.updated_at).slice(0, 10)) })}</p>
          </div>
        )}
      </Drawer>

      <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={form?.id ? t('m29.bank.form.editTitle', { id: form.id }) : t('m29.bank.form.addTitle')}
        footer={<div className="flex flex-wrap items-center justify-end gap-2">
          {problem && <span className="me-auto text-[12.5px] text-bad" data-testid="m29-bank-problem">{t(`m29.bank.problem.${problem}`)}</span>}
          <button type="button" className="btn-ghost" onClick={() => setForm(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={!!problem} onClick={save} data-testid="m29-bank-save">{t('m29.bank.form.save')}</button>
        </div>}>
        {form && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m29-bank-form">
            <SelectField name="area_id" label={t('m29.bank.col.area')} value={form.area_id} onChange={(v) => setForm({ ...form, area_id: v })} options={d.areas.map((a: Row) => ({ value: a.id, label: areaName(a.id) }))} />
            <SelectField name="difficulty" label={t('m29.bank.col.diff')} value={form.difficulty} onChange={(v) => setForm({ ...form, difficulty: v })} options={DIFFICULTIES.map((x) => ({ value: String(x), label: t(`m29.diff.${x}`) }))} />
            <TextArea name="stem_en" label={t('m29.bank.form.stemEn')} value={form.stem_en} onChange={(v) => setForm({ ...form, stem_en: v })} rows={3} required />
            <TextArea name="stem_ar" label={t('m29.bank.form.stemAr')} value={form.stem_ar} onChange={(v) => setForm({ ...form, stem_ar: v })} rows={3} required />
            {(['1', '2', '3', '4'] as const).map((n) => (
              <div key={n} className="contents">
                <TextField name={`o${n}_en`} label={t('m29.bank.form.optEn', { n })} value={form[`o${n}_en` as keyof FormState] as string} onChange={(v) => setForm({ ...form, [`o${n}_en`]: v })} required={n !== '4'} />
                <TextField name={`o${n}_ar`} label={t('m29.bank.form.optAr', { n })} value={form[`o${n}_ar` as keyof FormState] as string} onChange={(v) => setForm({ ...form, [`o${n}_ar`]: v })} required={n !== '4'} />
              </div>
            ))}
            <SelectField name="correct" label={t('m29.bank.form.correct')} value={form.correct} onChange={(v) => setForm({ ...form, correct: v })} options={['0', '1', '2', '3'].map((x) => ({ value: x, label: t('m29.bank.form.optN', { n: String(Number(x) + 1) }) }))} />
            <div />
            <TextArea name="explain_en" label={t('m29.bank.form.explainEn')} value={form.explain_en} onChange={(v) => setForm({ ...form, explain_en: v })} rows={2} />
            <TextArea name="explain_ar" label={t('m29.bank.form.explainAr')} value={form.explain_ar} onChange={(v) => setForm({ ...form, explain_ar: v })} rows={2} />
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!retire} onClose={() => setRetire(null)} title={t('m29.bank.retireTitle', { id: retire?.id ?? '' })} consequence={t('m29.bank.retireBody')} danger confirmLabel={t('m29.bank.retire')}
        onConfirm={async () => { if (retire) await act(() => repo.rpc.saveFitnessItem(inputOf(toForm(retire), 'retired'))); setRetire(null); }} />
    </div>
  );
}

