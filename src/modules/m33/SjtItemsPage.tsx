// FS26 /training/sjt/items (secure_items W/A: instructors read, the training manager writes): the situational judgement practice bank.
// Coverage per core skill (at least two active items each), the items in EN and AR with every response's expert rating and why and the
// expert rationale, and, for the training manager (secure_items A), add / edit / retire through rpc.saveSjtItem: the server re-checks every
// rule (both languages, four responses, exactly one best response, a why for each, the rationale), keeps two active items per core skill
// and refuses any wording that touches plant security. Every save is audited.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, BarChart, DataTable, Drawer, Modal, ConfirmDialog, SelectField, TextArea, TextField, StatusPill, FilterBar, useFilters, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { MIN_ACTIVE_PER_SKILL, THEMES, sjtItemProblem, type SjtItemInput } from './sjt';
import { useCoreName, useM33Ref, type M33Ref, type Row } from './ui';

function useBank() {
  const repo = useRepo();
  return useQuery(['sjt_items'], async () => (await repo.list('sjt_items' as never, { order: [['sort', 'asc']] } as never)) as Row[], []);
}

export default function SjtItemsPage() {
  const t = useT();
  const ref = useM33Ref();
  const q = useBank();
  return (
    <Page title={t('m33.routes.training-sjt-items.title')} intro={t('m33.bank.intro')} wide eyebrow={<BenchmarkChips feature="FS26" />}>
      <Async state={ref}>{(d) => <Async state={q} isEmpty={() => false}>{(items) => <Bank d={d} items={items} />}</Async>}</Async>
    </Page>
  );
}

const N = ['1', '2', '3', '4'] as const;
type FormState = Record<string, string> & { id?: string };
const EMPTY: FormState = {
  core_skill_id: '', theme: 'questioning', stem_en: '', stem_ar: '', rationale_en: '', rationale_ar: '',
  ...Object.fromEntries(N.flatMap((n) => [[`o${n}_en`, ''], [`o${n}_ar`, ''], [`n${n}_en`, ''], [`n${n}_ar`, ''], [`k${n}`, n === '1' ? '3' : '1']])),
};
const EFF_TEXT = ['text-bad', 'text-sim', 'text-info', 'text-ok'];

function Bank({ d, items }: { d: M33Ref; items: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const coreName = useCoreName(d);
  const canWrite = s.can('secure_items', ['A']);
  const [open, setOpen] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [retire, setRetire] = useState<Row | null>(null);
  const [flt, setFlt] = useFilters({ q: '', skill: '', theme: '', status: '' }, true);
  const active = items.filter((i) => i.status === 'active');
  const per = (id: string) => active.filter((i) => i.core_skill_id === id).length;
  const thin = d.core.filter((c: Row) => per(c.id) < MIN_ACTIVE_PER_SKILL);
  const shown = useMemo(() => items
    .filter((i) => !flt.skill || i.core_skill_id === flt.skill)
    .filter((i) => !flt.theme || i.theme === flt.theme)
    .filter((i) => !flt.status || i.status === flt.status)
    .filter((i) => !flt.q || `${i.id} ${i.stem_en} ${i.stem_ar}`.toLowerCase().includes(flt.q.toLowerCase())), [items, flt]);
  const cols: Column<Row>[] = [
    { key: 'id', header: t('m33.bank.col.id'), value: (r) => r.id, render: (r) => <span className="num text-[12px]">{r.id}</span>, sortable: true },
    { key: 'skill', header: t('m33.bank.col.skill'), value: (r) => coreName(r.core_skill_id), sortable: true },
    { key: 'theme', header: t('m33.bank.col.theme'), value: (r) => r.theme, render: (r) => t(`m33.theme.${r.theme}`), sortable: true },
    { key: 'stem', header: t('m33.bank.col.stem'), value: (r) => pick(r, 'stem'), render: (r) => <span className="line-clamp-2">{pick(r, 'stem')}</span> },
    { key: 'status', header: t('m33.bank.col.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'active' ? 'ok' : 'neutral'}>{t(`m33.bank.status.${r.status}`)}</StatusPill> },
    { key: 'v', header: t('m33.bank.col.version'), value: (r) => r.version, render: (r) => <span className="num">{f.num(r.version)}</span>, align: 'end' },
  ];
  const toForm = (r: Row): FormState => ({
    id: r.id, core_skill_id: r.core_skill_id, theme: r.theme, stem_en: r.stem_en, stem_ar: r.stem_ar, rationale_en: r.rationale_en, rationale_ar: r.rationale_ar,
    ...Object.fromEntries(N.flatMap((n, i) => [[`o${n}_en`, r.options_en[i] ?? ''], [`o${n}_ar`, r.options_ar[i] ?? ''], [`n${n}_en`, r.notes_en[i] ?? ''], [`n${n}_ar`, r.notes_ar[i] ?? ''], [`k${n}`, String(r.expert_key[i] ?? 0)]])),
  });
  const inputOf = (x: FormState, status?: 'active' | 'retired'): SjtItemInput => ({
    id: x.id ?? null, core_skill_id: x.core_skill_id, theme: x.theme, stem_en: x.stem_en, stem_ar: x.stem_ar,
    options_en: N.map((n) => x[`o${n}_en`].trim()), options_ar: N.map((n) => x[`o${n}_ar`].trim()), notes_en: N.map((n) => x[`n${n}_en`].trim()), notes_ar: N.map((n) => x[`n${n}_ar`].trim()),
    expert_key: N.map((n) => Number(x[`k${n}`])), rationale_en: x.rationale_en, rationale_ar: x.rationale_ar, ...(status ? { status } : {}),
  });
  const problem = form ? sjtItemProblem(inputOf(form), d.core.map((c: Row) => c.id)) : null;
  const save = async () => {
    if (!form || problem) return;
    const r = await act(() => repo.rpc.saveSjtItem(inputOf(form)));
    if (r.ok) setForm(null);
  };
  const set = (k: string) => (v: string) => form && setForm({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title={t('m33.bank.coverage.title')} eyebrow={t('m33.bank.coverage.eyebrow', { min: f.num(MIN_ACTIVE_PER_SKILL) })}>
          <div data-testid="m33-bank-coverage">
            <BarChart title={t('m33.bank.coverage.title')} data={d.core.map((c: Row) => ({ label: `${c.code} ${pick(c, 'name')}`, value: per(c.id), tone: per(c.id) >= MIN_ACTIVE_PER_SKILL ? 'ok' : 'bad' }))} />
          </div>
          {thin.length ? <p className="mt-2 text-[12.5px] text-bad">{t('m33.bank.coverage.thin', { list: thin.map((c: Row) => c.code).join(', ') })}</p>
            : <p className="mt-2 text-[12.5px] text-ok">{t('m33.bank.coverage.ok', { n: f.num(active.length) })}</p>}
        </Card>
        <Card title={t('m33.bank.rules.title')} eyebrow={t('m33.bank.rules.eyebrow')}>
          <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
            {['r1', 'r2', 'r3', 'r4', 'r5'].map((k) => <li key={k}>{t(`m33.bank.rules.${k}`)}</li>)}
          </ul>
          {canWrite ? (
            <button type="button" className="btn-primary mt-4" onClick={() => setForm({ ...EMPTY, core_skill_id: d.core[0]?.id ?? '' })} data-testid="m33-bank-add">{t('m33.bank.add')}</button>
          ) : <p className="mt-3 text-[12.5px] text-ink-3" data-testid="m33-bank-readonly">{t('m33.bank.readonly')}</p>}
        </Card>
      </div>

      <Section title={t('m33.bank.list.title', { n: f.num(items.length) })}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'skill', label: t('m33.bank.col.skill'), options: d.core.map((c: Row) => ({ value: c.id, label: `${c.code} ${pick(c, 'name')}` })) },
          { key: 'theme', label: t('m33.bank.col.theme'), options: THEMES.map((x) => ({ value: x, label: t(`m33.theme.${x}`) })) },
          { key: 'status', label: t('m33.bank.col.status'), options: ['active', 'retired'].map((x) => ({ value: x, label: t(`m33.bank.status.${x}`) })) },
        ]} />
        {shown.length ? (
          <div data-testid="m33-bank-items">
            <DataTable rows={shown} columns={cols} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r)} searchable={false} pageSize={16} caption={t('m33.bank.list.caption')} />
          </div>
        ) : <EmptyState title={t('m33.bank.list.none')} />}
      </Section>
      <Callout tone="sim" title={t('m33.bank.security.title')}>{t('m33.bank.security.body')}</Callout>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.id} · ${coreName(open.core_skill_id)}` : ''}
        footer={open && canWrite ? <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => { setForm(toForm(open)); setOpen(null); }} data-testid="m33-bank-edit">{t('m33.bank.edit')}</button>
          {open.status === 'active' && <button type="button" className="btn-outline btn-sm" onClick={() => { setRetire(open); setOpen(null); }} data-testid="m33-bank-retire">{t('m33.bank.retire')}</button>}
        </div> : undefined}>
        {open && (
          <div className="space-y-5 text-[13.5px]" data-testid="m33-bank-drawer">
            {(['en', 'ar'] as const).map((lng) => (
              <div key={lng} dir={lng === 'ar' ? 'rtl' : 'ltr'} lang={lng} className="space-y-2">
                <h3 className="caps">{t(`m33.bank.lang.${lng}`)}</h3>
                <p className="font-semibold">{open[`stem_${lng}`]}</p>
                <ol className="space-y-1.5">
                  {(open[`options_${lng}`] as string[]).map((o, i) => (
                    <li key={i} className="rounded-md border border-line px-2 py-1.5" data-eff={open.expert_key[i]}>
                      <div className="flex items-start justify-between gap-2"><span>{o}</span><span className={`caps shrink-0 text-[10.5px] ${EFF_TEXT[open.expert_key[i]]}`}>{t(`m33.sjt.eff.${open.expert_key[i]}`)}</span></div>
                      <p className="mt-0.5 text-[12px] text-ink-3">{open[`notes_${lng}`][i]}</p>
                    </li>
                  ))}
                </ol>
                <p className="rounded-md bg-sunken p-2 text-ink-2">{open[`rationale_${lng}`]}</p>
              </div>
            ))}
            <p className="text-[12px] text-ink-3">{t('m33.bank.meta', { v: f.num(open.version), date: f.date(String(open.updated_at).slice(0, 10)) })}</p>
          </div>
        )}
      </Drawer>

      <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={form?.id ? t('m33.bank.form.editTitle', { id: form.id }) : t('m33.bank.form.addTitle')}
        footer={<div className="flex flex-wrap items-center justify-end gap-2">
          {problem && <span className="me-auto text-[12.5px] text-bad" data-testid="m33-bank-problem">{t(`m33.bank.problem.${problem}`)}</span>}
          <button type="button" className="btn-ghost" onClick={() => setForm(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={!!problem} onClick={save} data-testid="m33-bank-save">{t('m33.bank.form.save')}</button>
        </div>}>
        {form && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m33-bank-form">
            <SelectField name="core_skill_id" label={t('m33.bank.col.skill')} value={form.core_skill_id} onChange={set('core_skill_id')} options={d.core.map((c: Row) => ({ value: c.id, label: `${c.code} ${pick(c, 'name')}` }))} />
            <SelectField name="theme" label={t('m33.bank.col.theme')} value={form.theme} onChange={set('theme')} options={THEMES.map((x) => ({ value: x, label: t(`m33.theme.${x}`) }))} />
            <TextArea name="stem_en" label={t('m33.bank.form.stemEn')} value={form.stem_en} onChange={set('stem_en')} rows={3} required />
            <TextArea name="stem_ar" label={t('m33.bank.form.stemAr')} value={form.stem_ar} onChange={set('stem_ar')} rows={3} required />
            {N.map((n) => (
              <div key={n} className="contents">
                <TextField name={`o${n}_en`} label={t('m33.bank.form.optEn', { n })} value={form[`o${n}_en`]} onChange={set(`o${n}_en`)} required />
                <TextField name={`o${n}_ar`} label={t('m33.bank.form.optAr', { n })} value={form[`o${n}_ar`]} onChange={set(`o${n}_ar`)} required />
                <TextField name={`n${n}_en`} label={t('m33.bank.form.noteEn', { n })} value={form[`n${n}_en`]} onChange={set(`n${n}_en`)} required />
                <TextField name={`n${n}_ar`} label={t('m33.bank.form.noteAr', { n })} value={form[`n${n}_ar`]} onChange={set(`n${n}_ar`)} required />
                <SelectField name={`k${n}`} label={t('m33.bank.form.eff', { n })} value={form[`k${n}`]} onChange={set(`k${n}`)} options={['3', '2', '1', '0'].map((e) => ({ value: e, label: t(`m33.sjt.eff.${e}`) }))} />
                <div className="hidden md:block" />
              </div>
            ))}
            <TextArea name="rationale_en" label={t('m33.bank.form.ratEn')} value={form.rationale_en} onChange={set('rationale_en')} rows={3} required />
            <TextArea name="rationale_ar" label={t('m33.bank.form.ratAr')} value={form.rationale_ar} onChange={set('rationale_ar')} rows={3} required />
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!retire} onClose={() => setRetire(null)} title={t('m33.bank.retireTitle', { id: retire?.id ?? '' })} consequence={t('m33.bank.retireBody')} danger confirmLabel={t('m33.bank.retire')}
        onConfirm={async () => { if (retire) await act(() => repo.rpc.saveSjtItem(inputOf(toForm(retire), 'retired'))); setRetire(null); }} />
    </div>
  );
}
