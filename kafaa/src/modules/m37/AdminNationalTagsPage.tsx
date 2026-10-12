// FS62 /admin/national-tags (national_alignment W/A: HR director, platform admins): maintain the national tags and their curated links.
// The same checks as the RPCs (tagProblem, linkProblem) run live before the confirmation; source tiers are computed from the URL (never
// typed) and a tag citing only secondary or indirect sources shows the visible flag; tag text may name years but never a typed number.
// Links derived from the data (Jahiz groups from the FS02 catalogue, Net Zero from FS41 CleanEnergyComp) are shown read-only: change the
// data, not the tag. Unlinking deactivates a row, it is never removed. Every save is audited; adding or retiring a tag is ledgered.
import { useMemo, useState } from 'react';
import { Page, Section, Async, Callout, ConfirmDialog, DataTable, Drawer, EmptyState, SelectField, StatusPill, Tabs, TextArea, TextField, BenchmarkChips, WhyThis, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { STRATEGIES, TAG_KINDS, TARGET_TABLES, linkProblem, sourceTier, tagProblem, type TagInput, type TagRow, type TagSource } from './national';
import { BASIS_TONE, ItemLink, SourceStanding, TierPill, useNaRef, type NaRef, type Row } from './ui';

export default function AdminNationalTagsPage() {
  const t = useT();
  const ref = useNaRef();
  return (
    <Page title={t('m37.routes.admin-national-tags.title')} intro={t('m37.admin.intro')} wide eyebrow={<BenchmarkChips feature="FS62" />}>
      <Async state={ref}>{(d) => (
        <Tabs initial="tags" tabs={[
          { id: 'tags', label: t('m37.admin.tabTags'), badge: d.tags.length, content: <TagsTab d={d} /> },
          { id: 'links', label: t('m37.admin.tabLinks'), badge: d.links.filter((l) => l.active).length, content: <LinksTab d={d} /> },
        ]} />
      )}</Async>
    </Page>
  );
}

function TagsTab({ d }: { d: NaRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [edit, setEdit] = useState<TagRow | 'new' | null>(null);
  const cols: Column<TagRow>[] = [
    { key: 'strategy', header: t('m37.filter.strategy'), value: (x) => t(`m37.strategy.${x.strategy}`), sortable: true },
    { key: 'name', header: t('m37.col.tag'), value: (x) => pick(x, 'name'), sortable: true, render: (x) => <span className={x.parent_id ? 'ps-4' : 'font-semibold'}>{pick(x, 'name')} <span className="num ms-1 text-[11px] text-ink-3">{x.code}</span></span> },
    { key: 'kind', header: t('m37.tag.kind'), value: (x) => x.kind, render: (x) => t(`m37.tagKind.${x.kind}`) },
    { key: 'source', header: t('m37.col.source'), csv: false, render: (x) => <SourceStanding tag={x} compact /> },
    { key: 'status', header: t('m37.col.status'), value: (x) => x.status, render: (x) => <StatusPill tone={x.status === 'active' ? 'ok' : 'neutral'}>{t(`m37.tagStatus.${x.status}`)}</StatusPill> },
    { key: 'version', header: t('m37.col.version'), align: 'end', value: (x) => x.version ?? 1, render: (x) => <span className="num">{f.num(x.version ?? 1)}</span> },
    { key: 'edit', header: '', csv: false, render: (x) => <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(x)} data-testid="m37-admin-edit">{t('m37.admin.edit')}</button> },
  ];
  return (
    <div className="space-y-3" data-testid="m37-admin-tags">
      <div className="flex justify-end"><button type="button" className="btn-primary btn-sm" onClick={() => setEdit('new')} data-testid="m37-admin-new">{t('m37.admin.newTag')}</button></div>
      <div className="overflow-x-auto"><DataTable rows={d.tags} columns={cols} rowKey={(x) => x.id} pageSize={30} caption={t('m37.admin.tabTags')} dense /></div>
      {edit && <TagEditor key={edit === 'new' ? 'new' : edit.id} row={edit === 'new' ? null : edit} d={d} onClose={() => setEdit(null)} />}
    </div>
  );
}

type Draft = Required<Pick<TagInput, 'strategy' | 'kind' | 'code' | 'name_en' | 'name_ar' | 'summary_en' | 'summary_ar'>> & {
  parent_id: string; horizon: string; owner_en: string; owner_ar: string; source_scope: string; source_note_en: string; source_note_ar: string; status: string; sources: TagSource[];
};

function TagEditor({ row, d, onClose }: { row: TagRow | null; d: NaRef; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [x, setX] = useState<Draft>(() => row ? {
    strategy: row.strategy, kind: row.kind, code: row.code, name_en: row.name_en, name_ar: row.name_ar, summary_en: row.summary_en, summary_ar: row.summary_ar,
    parent_id: row.parent_id ?? '', horizon: row.horizon_year == null ? '' : String(row.horizon_year), owner_en: row.owner_en ?? '', owner_ar: row.owner_ar ?? '',
    source_scope: row.source_scope, source_note_en: row.source_note_en ?? '', source_note_ar: row.source_note_ar ?? '', status: row.status,
    sources: (row.sources ?? []).map((y) => ({ label: y.label, url: y.url, as_of: y.as_of })),
  } : { strategy: 'nes_2031', kind: 'goal', code: '', name_en: '', name_ar: '', summary_en: '', summary_ar: '', parent_id: 'nt-nes-2031', horizon: '', owner_en: '', owner_ar: '',
    source_scope: 'direct', source_note_en: '', source_note_ar: '', status: 'active', sources: [{ label: '', url: 'https://', as_of: todayIso() }] });
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setX((o) => ({ ...o, [k]: v }));
  const input: TagInput = {
    ...(row ? { id: row.id } : {}), strategy: x.strategy, kind: x.kind, parent_id: x.kind === 'strategy' ? null : x.parent_id || null, code: x.code.trim(),
    name_en: x.name_en, name_ar: x.name_ar, summary_en: x.summary_en, summary_ar: x.summary_ar, horizon_year: x.horizon.trim() === '' ? null : Number(x.horizon),
    owner_en: x.owner_en || null, owner_ar: x.owner_ar || null, sources: x.sources, source_scope: x.source_scope, source_note_en: x.source_note_en || null, source_note_ar: x.source_note_ar || null, status: x.status,
  };
  const problem = tagProblem(input, { tags: d.tags, today: todayIso() });
  const parents = d.tags.filter((y) => y.kind === 'strategy' && y.strategy === x.strategy && y.status === 'active');
  const preview = { ...(row ?? {}), ...input, sources: x.sources.map((y) => ({ ...y, tier: sourceTier(y.url) })) } as TagRow;
  const setSrc = (i: number, k: keyof TagSource, v: string) => set('sources', x.sources.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  return (
    <>
      <Drawer open onClose={onClose} title={row ? t('m37.admin.editTitle', { name: pick(row, 'name') }) : t('m37.admin.newTitle')}
        footer={<div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m37-tag-save">{t('m37.admin.save')}</button>
        </div>}>
        <div className="space-y-4" data-testid="m37-tag-editor" data-problem={problem ?? ''}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField name="m37-te-strategy" label={t('m37.filter.strategy')} value={x.strategy} disabled={!!row} onChange={(v) => setX((o) => ({ ...o, strategy: v, parent_id: d.tags.find((y) => y.kind === 'strategy' && y.strategy === v)?.id ?? '' }))}
              options={STRATEGIES.map((y) => ({ value: y, label: t(`m37.strategy.${y}`) }))} />
            <SelectField name="m37-te-kind" label={t('m37.tag.kind')} value={x.kind} disabled={!!row} onChange={(v) => set('kind', v)} options={TAG_KINDS.map((y) => ({ value: y, label: t(`m37.tagKind.${y}`) }))} />
          </div>
          {x.kind !== 'strategy' && <SelectField name="m37-te-parent" label={t('m37.tag.parent')} value={x.parent_id} onChange={(v) => set('parent_id', v)} options={parents.map((y) => ({ value: y.id, label: pick(y, 'name') }))} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField name="m37-te-code" label={t('m37.tag.code')} value={x.code} onChange={(v) => set('code', v.toUpperCase())} hint={t('m37.admin.codeHint')} />
            <TextField name="m37-te-horizon" label={t('m37.tag.horizon')} value={x.horizon} onChange={(v) => set('horizon', v)} type="number" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField name="m37-te-name-en" label={t('m37.admin.nameEn')} value={x.name_en} onChange={(v) => set('name_en', v)} />
            <TextField name="m37-te-name-ar" label={t('m37.admin.nameAr')} value={x.name_ar} onChange={(v) => set('name_ar', v)} />
            <TextArea name="m37-te-sum-en" label={t('m37.admin.summaryEn')} value={x.summary_en} onChange={(v) => set('summary_en', v)} rows={3} />
            <TextArea name="m37-te-sum-ar" label={t('m37.admin.summaryAr')} value={x.summary_ar} onChange={(v) => set('summary_ar', v)} rows={3} />
            <TextField name="m37-te-owner-en" label={t('m37.admin.ownerEn')} value={x.owner_en} onChange={(v) => set('owner_en', v)} />
            <TextField name="m37-te-owner-ar" label={t('m37.admin.ownerAr')} value={x.owner_ar} onChange={(v) => set('owner_ar', v)} />
          </div>
          <fieldset className="space-y-2" data-testid="m37-te-sources">
            <legend className="text-[13px] font-semibold">{t('m37.tag.sources')}</legend>
            {x.sources.map((y, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-card border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
                <TextField name={`m37-te-src-label-${i}`} label={t('m37.admin.srcLabel')} value={y.label} onChange={(v) => setSrc(i, 'label', v)} />
                <TextField name={`m37-te-src-url-${i}`} label={t('m37.admin.srcUrl')} value={y.url} onChange={(v) => setSrc(i, 'url', v)} />
                <TextField name={`m37-te-src-asof-${i}`} label={t('m37.admin.srcAsOf')} value={y.as_of} onChange={(v) => setSrc(i, 'as_of', v)} type="date" />
                <div className="flex items-center gap-2 sm:col-span-3"><TierPill tier={sourceTier(y.url)} />
                  {x.sources.length > 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => set('sources', x.sources.filter((_, j) => j !== i))}>{t('m37.admin.srcRemove')}</button>}</div>
              </div>
            ))}
            {x.sources.length < 5 && <button type="button" className="btn-outline btn-sm" onClick={() => set('sources', [...x.sources, { label: '', url: 'https://', as_of: todayIso() }])}>{t('m37.admin.srcAdd')}</button>}
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField name="m37-te-scope" label={t('m37.admin.scope')} value={x.source_scope} onChange={(v) => set('source_scope', v)} options={['direct', 'indirect'].map((y) => ({ value: y, label: t(`m37.scope.${y}`) }))} />
            <SelectField name="m37-te-status" label={t('m37.col.status')} value={x.status} onChange={(v) => set('status', v)} options={['active', 'retired'].map((y) => ({ value: y, label: t(`m37.tagStatus.${y}`) }))} />
            <TextArea name="m37-te-note-en" label={t('m37.admin.noteEn')} value={x.source_note_en} onChange={(v) => set('source_note_en', v)} rows={2} />
            <TextArea name="m37-te-note-ar" label={t('m37.admin.noteAr')} value={x.source_note_ar} onChange={(v) => set('source_note_ar', v)} rows={2} />
          </div>
          <div className="rounded-card border border-line bg-sunken p-3"><p className="caps mb-1 text-[10.5px] text-ink-3">{t('m37.admin.preview')}</p><SourceStanding tag={preview} /></div>
          {problem ? <Callout tone="bad" title={t('m37.admin.check')}><span data-testid="m37-tag-problem">{t(`m37.problem.tag.${problem}`)}</span></Callout>
            : <Callout tone="ok" title={t('m37.admin.checkOk')}>{t('m37.admin.checkOkBody')}</Callout>}
        </div>
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={row ? t('m37.admin.confirmEdit') : t('m37.admin.confirmNew')} consequence={t('m37.admin.consequence')}
        actingAs={s.roles.includes('admin') ? t('m37.admin.asAdmin') : t('m37.admin.asHr')}
        onConfirm={async () => { const r = await run(() => repo.rpc.saveNationalTag(input)); setConfirm(false); if (r.ok) onClose(); }} />
    </>
  );
}

const labelOf = (pick: (r: object, f: string) => string, r: Row) => pick(r, 'name') || pick(r, 'title') || r.code || r.id;

function LinksTab({ d }: { d: NaRef }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const active = d.tags.filter((x) => x.status === 'active');
  const [tagId, setTagId] = useState(active[0]?.id ?? '');
  const [table, setTable] = useState('skills');
  const [target, setTarget] = useState('');
  const [noteEn, setNoteEn] = useState('');
  const [noteAr, setNoteAr] = useState('');
  const [confirm, setConfirm] = useState<null | { mode: 'link' } | { mode: 'unlink'; table: string; id: string; title: string }>(null);
  const tag = d.tags.find((x) => x.id === tagId);
  const rep = useQuery(['national_tags', 'tag_links'], () => repo.rpc.nationalReport({ tag_id: tagId }), [tagId]);
  const opts = useQuery(['skills', 'programmes', 'pathways'], async () => ((await repo.list(table as never).catch(() => [])) as Row[]), [table]);
  const options = useMemo(() => (opts.data ?? []).filter((r) => !(table === 'skills' && r.area === 'security')).map((r) => ({ value: r.id as string, label: String(labelOf(pick, r)) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [opts.data, table, pick]);
  const input = { tag_id: tagId, target_table: table, target_id: target, active: true, note_en: noteEn, note_ar: noteAr };
  const problem = target ? linkProblem(input, tag, { exists: true, area: (opts.data ?? []).find((r) => r.id === target)?.area ?? null }) : 'target';
  return (
    <div className="space-y-4" data-testid="m37-admin-links">
      <SelectField name="m37-al-tag" label={t('m37.filter.tag')} value={tagId} onChange={setTagId} options={active.map((x) => ({ value: x.id, label: `${x.parent_id ? '· ' : ''}${pick(x, 'name')}` }))} />
      {tag?.derive && <Callout tone="info" title={t('m37.admin.derivedTitle')}>{t(`m37.admin.derived.${tag.derive}`)}</Callout>}
      <Async state={rep} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.none')} />}>{(r) => {
        const own = (r?.items ?? []).filter((i) => i.tag_id === tagId);
        return own.length ? (
          <ul className="divide-y divide-line rounded-card border border-line" data-testid="m37-admin-link-list">
            {own.map((i) => (
              <li key={`${i.target_table}|${i.target_id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" data-basis={i.basis}>
                <span className="flex min-w-0 flex-col"><span className="font-semibold"><ItemLink item={i} /></span><span className="text-[11.5px] text-ink-3">{t(`m37.table.${i.target_table}`)}</span></span>
                <span className="flex items-center gap-2">
                  <StatusPill tone={BASIS_TONE[i.basis]}>{t(`m37.basis.${i.basis}`)}</StatusPill>
                  <WhyThis reasons={i.reasons} testId="m37-admin-why" />
                  {i.basis === 'curated' && <button type="button" className="btn-ghost btn-sm" data-testid="m37-admin-unlink"
                    onClick={() => setConfirm({ mode: 'unlink', table: i.target_table, id: i.target_id, title: pick(i as never, 'title') })}>{t('m37.admin.unlink')}</button>}
                </span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title={t('m37.tag.noItems')} />;
      }}</Async>
      <Section title={t('m37.admin.addLink')}>
        <div className="space-y-3" data-testid="m37-admin-add" data-problem={problem ?? ''}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField name="m37-al-table" label={t('m37.admin.table')} value={table} onChange={(v) => { setTable(v); setTarget(''); }} options={Object.keys(TARGET_TABLES).map((k) => ({ value: k, label: t(`m37.table.${k}`) }))} />
            <SelectField name="m37-al-target" label={t('m37.admin.target')} value={target} onChange={setTarget} options={options} />
            <TextArea name="m37-al-note-en" label={t('m37.admin.linkNoteEn')} value={noteEn} onChange={setNoteEn} rows={2} />
            <TextArea name="m37-al-note-ar" label={t('m37.admin.linkNoteAr')} value={noteAr} onChange={setNoteAr} rows={2} />
          </div>
          {problem && target && <p className="text-[12.5px] text-bad" data-testid="m37-link-problem">{t(`m37.problem.link.${problem}`)}</p>}
          <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setConfirm({ mode: 'link' })} data-testid="m37-admin-link">{t('m37.admin.link')}</button>
        </div>
      </Section>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.mode === 'unlink' ? t('m37.admin.confirmUnlink', { item: confirm.title }) : t('m37.admin.confirmLink')}
        consequence={confirm?.mode === 'unlink' ? t('m37.admin.unlinkConsequence') : t('m37.admin.linkConsequence')}
        onConfirm={async () => {
          const c = confirm;
          const r = c?.mode === 'unlink'
            ? await run(() => repo.rpc.setTagLink({ tag_id: tagId, target_table: c.table, target_id: c.id, active: false, note_en: '', note_ar: '' }))
            : await run(() => repo.rpc.setTagLink(input));
          setConfirm(null);
          if (r.ok && c?.mode === 'link') { setTarget(''); setNoteEn(''); setNoteAr(''); }
        }} />
    </div>
  );
}
