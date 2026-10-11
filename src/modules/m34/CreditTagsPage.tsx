// FS30 /admin/credit-tags · NQF level and credit tags (frameworks W/A edit: instructors, the training manager, admins; auditors read).
// Coverage per kind (every current micro-credential must carry a tag), the catalogue of courses, published pathways and current
// micro-credentials with their tag, an editor checked live with the same checkTag rule the backend runs, retire, and a refresh of
// every ledger. Tags are always indicative until agreed with the NQC and the partner.
import { useMemo, useState } from 'react';
import { Async, Callout, CheckboxField, ConfirmDialog, DataTable, Drawer, FilterBar, Page, Section, SelectField, StatTile, StatusPill, TextArea, useFilters, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { HOURS_MAX, ITEM_KINDS, checkTag, creditsOf, tagCoverage, tagId } from './credits';
import { Bench, IndicativeNote, NotAuthority, NqfBadge, useCredits, type Row } from './ui';

type Item = { kind: string; id: string; live: boolean; title_en: string; title_ar: string; tag?: Row };

export default function CreditTagsPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['credit_tags', 'credit_stacks', 'courses', 'pathways', 'microcred_defs'], async () => {
    const [tags, stacks, courses, pathways, defs] = await Promise.all([
      repo.list('credit_tags', {}).catch(() => []) as Promise<Row[]>,
      repo.list('credit_stacks', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('courses', {}).catch(() => []) as Promise<Row[]>,
      repo.list('pathways' as never, {}).catch(() => []) as Promise<Row[]>,
      repo.list('microcred_defs' as never, {}).catch(() => []) as Promise<Row[]>,
    ]);
    const tagOf = new Map(tags.map((x) => [x.id as string, x]));
    const items: Item[] = [
      ...courses.map((c) => ({ kind: 'course', id: c.id, live: true, title_en: c.title_en, title_ar: c.title_ar })),
      ...pathways.filter((p) => p.status === 'published').map((p) => ({ kind: 'pathway', id: p.id, live: true, title_en: p.title_en, title_ar: p.title_ar })),
      ...defs.filter((x) => x.status === 'current').map((x) => ({ kind: 'microcred', id: x.id, live: true, title_en: x.title_en, title_ar: x.title_ar })),
    ].map((it) => ({ ...it, tag: tagOf.get(tagId(it.kind, it.id)) }));
    return { tags, stacks, items };
  }, []);
  return (
    <Page title={t('m34.routes.admin-credit-tags.title')} eyebrow={t('m34.tags.eyebrow')} intro={t('m34.tags.intro')} wide>
      <Bench />
      <IndicativeNote />
      <NotAuthority />
      <Async state={q}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: { tags: Row[]; stacks: Row[]; items: Item[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const credits = useCredits();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const canEdit = s.can('frameworks', ['W', 'A']);
  const canSyncAll = s.can('recognition', ['A']) || canEdit;
  const [edit, setEdit] = useState<Item | null>(null);
  const [retire, setRetire] = useState<Item | null>(null);
  const [flt, setFlt] = useFilters({ q: '', kind: '', state: '' }, true);
  const cov = tagCoverage(d.items, d.tags as never);
  const term = flt.q.trim().toLowerCase();
  const rows = d.items.filter((it) => (!flt.kind || it.kind === flt.kind) && (!flt.state || (flt.state === 'tagged' ? it.tag?.status === 'published' : it.tag?.status !== 'published'))
    && (!term || `${it.title_en} ${it.title_ar} ${it.id}`.toLowerCase().includes(term)));
  const cols: Column<Item>[] = [
    { key: 'item', header: t('m34.cr.colItem'), value: (it) => pick(it, 'title'), sortable: true, render: (it) => <span><span className="font-semibold">{pick(it, 'title')}</span> <span className="text-[12px] text-ink-3">{it.id}</span></span> },
    { key: 'kind', header: t('m34.cr.colKind'), value: (it) => t(`m34.item.${it.kind}`) },
    { key: 'nqf', header: t('m34.cr.colNqf'), value: (it) => it.tag?.nqf_level ?? '', render: (it) => (it.tag?.status === 'published' ? <NqfBadge level={it.tag.nqf_level} /> : <StatusPill tone="sim">{t('m34.tags.untagged')}</StatusPill>) },
    { key: 'hours', header: t('m34.tags.colHours'), value: (it) => it.tag?.notional_hours ?? '', render: (it) => (it.tag?.status === 'published' ? <span className="num">{f.num(it.tag.notional_hours)}</span> : '—') },
    { key: 'credits', header: t('m34.cr.colCredits'), value: (it) => (it.tag?.status === 'published' ? Number(it.tag.notional_hours) / 10 : ''), render: (it) => (it.tag?.status === 'published' ? <span className="num font-semibold">{credits(it.tag.notional_hours)}</span> : '—') },
    { key: 'stacks', header: t('m34.cr.colStacks'), value: (it) => (it.tag?.stack_ids ?? []).length, render: (it) => <span className="flex flex-wrap gap-1">{(it.tag?.stack_ids ?? []).map((x: string) => <StatusPill key={x} tone="neutral">{pick(d.stacks.find((st) => st.id === x), 'title')}</StatusPill>)}</span> },
    { key: 'act', header: '', csv: false, render: (it) => canEdit ? (
      <span className="flex gap-1">
        <button type="button" className="btn-outline btn-sm" onClick={() => setEdit(it)} data-testid={`m34-tag-edit-${it.id}`}>{it.tag?.status === 'published' ? t('m34.tags.edit') : t('m34.tags.add')}</button>
        {it.tag?.status === 'published' && <button type="button" className="btn-ghost btn-sm" onClick={() => setRetire(it)}>{t('m34.tags.retire')}</button>}
      </span>) : null },
  ];
  const mc = cov.microcred;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m34-tags-tiles">
        {ITEM_KINDS.map((k) => <StatTile key={k} label={t(`m34.item.${k}s`)} value={`${f.num(cov[k].tagged)} / ${f.num(cov[k].live)}`} sub={t('m34.tags.tagged')} tone={cov[k].tagged === cov[k].live ? 'ok' : 'sim'} />)}
        <StatTile label={t('m34.tags.tTags')} value={f.num(d.tags.filter((x) => x.status === 'published').length)} sub={t('m34.tags.tTagsSub', { n: f.num(d.tags.filter((x) => x.status === 'retired').length) })} />
      </div>
      <div data-testid="m34-tags-mc">
        {mc.tagged === mc.live
          ? <Callout tone="ok" title={t('m34.tags.mcOk')}>{t('m34.tags.mcOkBody', { n: f.num(mc.live) })}</Callout>
          : <Callout tone="bad" title={t('m34.tags.mcMissing', { n: f.num(mc.missing.length) })}>{mc.missing.join(', ')}</Callout>}
      </div>
      <Section title={t('m34.tags.listTitle')} description={t('m34.tags.listDesc')}
        actions={canSyncAll ? <button type="button" className="btn-outline" onClick={() => act(() => repo.rpc.syncCredits(null))} data-testid="m34-sync-all">{t('m34.tags.syncAll')}</button> : undefined}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'kind', label: t('m34.cr.colKind'), options: ITEM_KINDS.map((k) => ({ value: k, label: t(`m34.item.${k}`) })) },
          { key: 'state', label: t('m34.tags.state'), options: [{ value: 'tagged', label: t('m34.tags.tagged') }, { value: 'untagged', label: t('m34.tags.untagged') }] },
        ]} />
        <div data-testid="m34-tags-table"><DataTable rows={rows} columns={cols} rowKey={(it) => `${it.kind}:${it.id}`} pageSize={20} caption={t('m34.tags.listTitle')} csvName="kafaa-credit-tags.csv" /></div>
      </Section>
      {edit && <EditDrawer it={edit} stacks={d.stacks} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!retire} onClose={() => setRetire(null)} title={t('m34.tags.retireTitle')} consequence={t('m34.tags.retireBody')} danger
        onConfirm={async () => { if (retire) await act(() => repo.rpc.tagCredit({ item_kind: retire.kind, item_id: retire.id, retire: true })); setRetire(null); }} />
    </div>
  );
}

function EditDrawer({ it, stacks, onClose }: { it: Item; stacks: Row[]; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const credits = useCredits();
  const repo = useRepo();
  const act = useAction();
  const [nqf, setNqf] = useState(String(it.tag?.nqf_level ?? 4));
  const [hours, setHours] = useState(String(it.tag?.notional_hours ?? 20));
  const [en, setEn] = useState(String(it.tag?.basis_en ?? ''));
  const [ar, setAr] = useState(String(it.tag?.basis_ar ?? ''));
  const [st, setSt] = useState<string[]>(it.tag?.stack_ids ?? []);
  const input = { item_kind: it.kind, item_id: it.id, nqf_level: Number(nqf), notional_hours: Number(hours), basis_en: en, basis_ar: ar, stack_ids: st };
  const check = useMemo(() => checkTag(input, { item: { id: it.id, live: it.live }, stacks: stacks.map((x) => x.id), existing: it.tag ? { id: it.tag.id, status: it.tag.status } : null }), [input, it, stacks]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Drawer open onClose={onClose} title={t('m34.tags.editTitle', { item: pick(it, 'title') })}>
      <div className="space-y-3" data-testid="m34-tag-drawer">
        <SelectField name="nqf" label={t('m34.tags.nqf')} value={nqf} onChange={setNqf} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: t('m34.tags.nqfN', { n: f.num(i + 1) }) }))} />
        <div>
          <label className="block text-[13px] font-semibold" htmlFor="m34-tag-hours">{t('m34.tags.hours')}</label>
          <input id="m34-tag-hours" className="input mt-1 w-full" type="number" min={1} max={HOURS_MAX} value={hours} onChange={(e) => setHours(e.target.value)} />
          <p className="mt-1 text-[12px] text-ink-3">{t('m34.tags.creditsAre', { c: credits(Number(hours)), x: f.num(creditsOf(Number(hours))) })}</p>
        </div>
        <TextArea name="en" label={t('m34.tags.basisEn')} rows={3} value={en} onChange={setEn} />
        <div dir="rtl" lang="ar"><TextArea name="ar" label={t('m34.tags.basisAr')} rows={3} value={ar} onChange={setAr} /></div>
        <fieldset>
          <legend className="text-[13px] font-semibold">{t('m34.tags.stacks')}</legend>
          {stacks.map((x) => <CheckboxField key={x.id} label={pick(x, 'title')} checked={st.includes(x.id)} onChange={(v) => setSt((cur) => (v ? [...cur, x.id] : cur.filter((y) => y !== x.id)))} />)}
        </fieldset>
        <IndicativeNote inline />
        <div aria-live="polite">{check === 'ok' ? <Callout tone="ok" title={t('m34.tags.checkOk')}>{t('m34.tags.checkOkBody')}</Callout> : <Callout tone="bad" title={t('m34.start.failTitle')}>{t(`m34.tagmsg.${check}`)}</Callout>}</div>
        <button type="button" className="btn-primary" disabled={check !== 'ok'} data-testid="m34-tag-save"
          onClick={async () => { const x = await act(() => repo.rpc.tagCredit(input)); if (x.ok) onClose(); }}>{t('m34.tags.save')}</button>
      </div>
    </Drawer>
  );
}
