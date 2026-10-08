// /training/items (M05): secure item bank with metadata (competency, task, difficulty, reference, version, review status),
// versions and separation of duties: writer, reviewer and approver are three different people (rpc.itemReview, maker_checker).
// Secure item text never leaves the bank: the CSV export carries metadata only, and nothing here is sent to Dalil.
import { useMemo, useState } from 'react';
import { Page, DataTable, Drawer, Modal, ConfirmDialog, FilterBar, useFilters, Async, Callout, Icon, TextField, TextArea, SelectField, useForm, required, maxLen, Card, KeyValue, Tabs, toCsv, downloadText, Stepper } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { ItemsRow, ItemVersionsRow } from '../../data/types';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Chip, G2Pill, useLabels, usePeople } from '../m04/ui';
import { itemCsvColumns } from './itemCsv';

type Opt = { id: string; en: string; ar: string };
const STAGES = ['draft', 'in_review', 'approved'] as const;

export default function TrainingItemsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const s = useSession();
  const people = usePeople();
  const me = s.identity.personId;
  const [flt, setFlt] = useFilters({ q: '', bank: 'secure', status: '', difficulty: '', competency: '', mine: '' }, true);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ item: ItemsRow | null; version: ItemVersionsRow | null } | null>(null);
  const q = useQuery(['items', 'item_versions', 'competencies'], async () => {
    const [items, versions, comps] = await Promise.all([repo.list('items'), repo.list('item_versions'), repo.list('competencies')]);
    return { items, versions, comps };
  }, []);
  return (
    <Page title={t('m05.routes.training-items.title')} intro={t('m05.items.intro')} wide actions={<button className="btn-primary" onClick={() => setEdit({ item: null, version: null })} data-testid="m05-item-new"><Icon name="plus" />{t('m05.items.new')}</button>}>
      <Callout title={t('m05.items.securityTitle')}>{t('m05.items.security')}</Callout>
      <Async state={q}>
        {(d) => {
          const comp = (id: string | null | undefined) => d.comps.find((c) => c.id === id);
          const rows = d.items.filter((i) => (!flt.bank || i.bank === flt.bank) && (!flt.status || i.status === flt.status) && (!flt.difficulty || i.difficulty === flt.difficulty) && (!flt.competency || i.competency_id === flt.competency)
            && (!flt.mine || i.writer_person_id === me || i.reviewer_person_id === me) && (!flt.q || `${i.id} ${i.topic} ${comp(i.competency_id)?.code ?? ''}`.toLowerCase().includes(flt.q.toLowerCase())));
          const counts = STAGES.map((st) => d.items.filter((i) => i.bank === 'secure' && i.status === st).length);
          return (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[13px]">{STAGES.map((st, k) => <Chip key={st} tone={st === 'approved' ? 'ok' : st === 'in_review' ? 'sim' : 'neutral'}>{t(`m04.status.${st}`)} · {f.num(counts[k])}</Chip>)}</div>
              <FilterBar value={flt} onChange={setFlt} search="q" fields={[
                { key: 'bank', label: t('m05.items.bank'), options: [{ value: 'secure', label: t('m05.items.secure') }, { value: 'practice', label: t('m05.items.practiceBank') }] },
                { key: 'status', label: t('m04.common.status'), options: ['draft', 'in_review', 'approved', 'retired'].map((x) => ({ value: x, label: t(`m04.status.${x}`) })) },
                { key: 'difficulty', label: t('m05.items.difficulty'), options: ['easy', 'medium', 'hard'].map((x) => ({ value: x, label: lab.difficulty(x) })) },
                { key: 'competency', label: t('m04.plan.competency'), options: d.comps.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'name')}` })) },
                { key: 'mine', label: t('m05.items.mine'), options: [{ value: '1', label: t('m05.items.mineOpt') }] },
              ]} />
              <DataTable rows={rows} rowKey={(r) => r.id} searchable={false} onRowClick={(r) => setOpen(r.id)} initialSort={{ key: 'id', dir: 'asc' }}
                toolbar={<button className="btn-outline btn-sm" onClick={() => downloadText('item-bank-metadata.csv', toCsv(rows, itemCsvColumns()))} data-testid="m05-items-csv"><Icon name="download" size={14} />{t('m05.items.exportMeta')}</button>}
                columns={[
                  { key: 'id', header: t('m05.items.id'), value: (r) => r.id, render: (r) => <span className="num ltr text-[12px]">{r.id}</span>, sortable: true },
                  { key: 'topic', header: t('m05.items.topic'), value: (r) => r.topic, sortable: true },
                  { key: 'comp', header: t('m04.plan.competency'), value: (r) => comp(r.competency_id)?.code ?? '—' },
                  { key: 'diff', header: t('m05.items.difficulty'), value: (r) => lab.difficulty(r.difficulty), sortable: true },
                  { key: 'ver', header: t('m05.items.version'), value: (r) => r.current_version, render: (r) => <span className="num">v{f.num(r.current_version)}</span>, align: 'end' },
                  { key: 'stats', header: t('m05.items.stats'), value: (r) => r.p_value ?? null, render: (r) => (r.p_value != null ? <span className="num text-[12px]">p {f.num(r.p_value)} · D {f.num(r.discrimination)}</span> : '—') },
                  { key: 'roles', header: t('m05.items.sod'), value: () => '', render: (r) => <span className="text-[12px] text-ink-2">{r.writer_person_id === me ? t('m05.items.youWrote') : r.reviewer_person_id === me ? t('m05.items.youReviewed') : '—'}</span> },
                  { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} tone={r.status === 'approved' ? 'ok' : r.status === 'in_review' ? 'sim' : r.status === 'retired' ? 'neutral' : 'neutral'} />, sortable: true },
                ]} />
              <p className="text-[12.5px] text-ink-3">{t('m05.items.count', { n: f.num(rows.length) })}</p>
              {open && <ItemDrawer item={d.items.find((i) => i.id === open)!} versions={d.versions.filter((v) => v.item_id === open).sort((a, b) => b.version - a.version)} compName={(id) => { const c = comp(id); return c ? `${c.code} · ${pick(c, 'name')}` : '—'; }} people={people} onClose={() => setOpen(null)}
                onEdit={(item, version) => { setOpen(null); setEdit({ item, version }); }} />}
              {edit && <ItemEditor item={edit.item} version={edit.version} comps={d.comps.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'name')}` }))} onClose={() => setEdit(null)} />}
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function ItemDrawer({ item, versions, compName, people, onClose, onEdit }: { item: ItemsRow; versions: ItemVersionsRow[]; compName: (id: string | null | undefined) => string; people: ReturnType<typeof usePeople>; onClose: () => void; onEdit: (i: ItemsRow, v: ItemVersionsRow | null) => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const [act, setAct] = useState<'submit' | 'review' | 'approve' | 'retire' | null>(null);
  const cur = versions.find((v) => v.version === item.current_version) ?? versions[0];
  const isApprover = s.can('secure_items', ['A']);
  const step = item.status === 'approved' ? 3 : item.status === 'in_review' ? (item.reviewer_person_id ? 2 : 1) : 0;
  const who = (id: string | null | undefined) => (!id ? '—' : id === me ? t('m05.items.you') : people.name(id));
  const txt = (o: { en: string; ar: string }) => (lang === 'ar' ? o.ar || o.en : o.en);
  const hint = act === 'approve' && item.writer_person_id === me ? t('m05.items.makerChecker') : null;
  return (
    <Drawer open onClose={onClose} title={<span className="ltr">{item.id}</span>}
      footer={item.status !== 'retired' ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-outline btn-sm" onClick={() => onEdit(item, cur ?? null)}>{t('m05.items.newVersion')}</button>
          {item.status === 'draft' && item.writer_person_id === me && <button className="btn-primary btn-sm" onClick={() => setAct('submit')} data-testid="m05-item-submit">{t('m05.items.submit')}</button>}
          {item.status === 'in_review' && !item.reviewer_person_id && <button className="btn-primary btn-sm" onClick={() => setAct('review')} data-testid="m05-item-review">{t('m05.items.review')}</button>}
          {item.status === 'in_review' && item.reviewer_person_id && isApprover && <button className="btn-primary btn-sm" onClick={() => setAct('approve')} data-testid="m05-item-approve">{t('m05.items.approve')}</button>}
          {isApprover && <button className="btn-ghost btn-sm" onClick={() => setAct('retire')}>{t('m05.items.retire')}</button>}
        </div>
      ) : undefined}>
      <div className="space-y-4">
        <Stepper steps={[{ id: 'w', label: t('m05.items.stepWrite') }, { id: 'r', label: t('m05.items.stepReview') }, { id: 'a', label: t('m05.items.stepApprove') }]} current={step} />
        <Card title={t('m05.items.metadata')} actions={<G2Pill status={item.status} />}>
          <KeyValue items={[
            [t('m05.items.bank'), item.bank === 'secure' ? t('m05.items.secure') : t('m05.items.practiceBank')], [t('m05.items.topic'), item.topic], [t('m04.plan.competency'), compName(item.competency_id)],
            [t('m05.items.difficulty'), lab.difficulty(item.difficulty)], [t('m05.items.reference'), item.reference ?? '—'], [t('m05.items.version'), `v${item.current_version}`],
            [t('m05.items.writer'), who(item.writer_person_id)], [t('m05.items.reviewer'), who(item.reviewer_person_id)], [t('m05.items.approver'), who(item.approver_person_id)],
          ]} />
        </Card>
        <Tabs initial="current" tabs={[
          { id: 'current', label: t('m05.items.current'), content: cur ? (
            <div className="space-y-2" data-testid="m05-item-text">
              <div className="font-semibold">{txt({ en: cur.stem_en, ar: cur.stem_ar })}</div>
              <ul className="space-y-1">{(cur.options as Opt[]).map((o) => <li key={o.id} className={`flex gap-2 rounded-btn border p-2 text-[13.5px] ${o.id === cur.answer ? 'border-ok-line bg-ok-bg' : 'border-line'}`}><span className="num font-semibold uppercase">{o.id}</span>{txt(o)}{o.id === cur.answer && <span className="ms-auto text-[11.5px] font-semibold text-ok">{t('m05.items.key')}</span>}</li>)}</ul>
              {(cur.rationale_en || cur.rationale_ar) && <p className="text-[13px] text-ink-2">{txt({ en: cur.rationale_en, ar: cur.rationale_ar })}</p>}
            </div>
          ) : <p className="text-ink-3">—</p> },
          { id: 'history', label: t('m05.items.history'), badge: versions.length, content: (
            <ol className="space-y-2">{versions.map((v) => <li key={v.id} className="rounded-btn border border-line p-2 text-[13px]"><div className="flex justify-between gap-2"><span className="num font-semibold">v{f.num(v.version)}</span><span className="text-ink-3">{f.dateTime(v.created_at)}</span></div><div className="text-ink-2">{who(v.author_person_id)}{v.change_note ? ` · ${v.change_note}` : ''}</div></li>)}</ol>
          ) },
        ]} />
      </div>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} danger={act === 'retire'} requireReason={act === 'retire'} title={t(`m05.items.${act ?? 'submit'}Title`)} consequence={t(`m05.items.${act ?? 'submit'}Body`)}
        actingAs={act === 'approve' || act === 'retire' ? t('m04.common.roleTm') : t('m04.common.roleInstructor')}
        onConfirm={async (reason) => {
          if (!act) return;
          const r = act === 'retire' ? await run(() => repo.rpc.retireItem(item.id, reason)) : await run(() => repo.rpc.itemReview(item.id, act));
          if (r.ok) onClose();
        }}>
        {hint && <Callout tone="bad" title={t('m05.items.makerCheckerTitle')}>{hint}</Callout>}
      </ConfirmDialog>
    </Drawer>
  );
}

function ItemEditor({ item, version, comps, onClose }: { item: ItemsRow | null; version: ItemVersionsRow | null; comps: { value: string; label: string }[]; onClose: () => void }) {
  const t = useT();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const opts = (version?.options as Opt[] | undefined) ?? [{ id: 'a', en: '', ar: '' }, { id: 'b', en: '', ar: '' }, { id: 'c', en: '', ar: '' }, { id: 'd', en: '', ar: '' }];
  const [options, setOptions] = useState<Opt[]>(opts);
  const [optErr, setOptErr] = useState<string | null>(null);
  const form = useForm({ bank: item?.bank ?? 'secure', topic: item?.topic ?? '', competency: item?.competency_id ?? '', difficulty: item?.difficulty ?? 'medium', reference: item?.reference ?? '', stem_en: version?.stem_en ?? '', stem_ar: version?.stem_ar ?? '', answer: version?.answer ?? 'a', rationale_en: version?.rationale_en ?? '', rationale_ar: version?.rationale_ar ?? '', note: '' },
    { topic: [required(), maxLen(80)], stem_en: [required(), maxLen(600)], stem_ar: [required(), maxLen(600)], answer: [required()], note: item ? [required(), maxLen(200)] : [maxLen(200)] });
  const ids = useMemo(() => options.map((o) => o.id), [options]);
  const setOpt = (k: number, field: 'en' | 'ar', v: string) => setOptions(options.map((o, i) => (i === k ? { ...o, [field]: v } : o)));
  return (
    <Modal open onClose={onClose} size="lg" title={item ? t('m05.items.newVersionOf', { id: item.id }) : t('m05.items.new')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m05-item-form" disabled={form.submitting} data-testid="m05-item-save">{t('m05.items.saveDraft')}</button></>}>
      <form id="m05-item-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
        if (options.some((o) => !o.en.trim() || !o.ar.trim())) { setOptErr(t('m05.items.optionsRequired')); return; }
        setOptErr(null);
        const r = await run(() => repo.rpc.saveItem({ id: item?.id ?? null, bank: v.bank as 'secure' | 'practice', topic: v.topic.trim(), competency_id: v.competency || null, difficulty: v.difficulty as 'easy' | 'medium' | 'hard', reference: v.reference || null, stem_en: v.stem_en, stem_ar: v.stem_ar, options, answer: v.answer, rationale_en: v.rationale_en, rationale_ar: v.rationale_ar, change_note: v.note || (item ? '' : 'New item') }));
        if (r.ok) onClose();
      })}>
        {item && <Callout tone="sim" title={t('m05.items.versionNoteTitle')}>{t('m05.items.versionNote')}</Callout>}
        <div className="grid gap-3 sm:grid-cols-4">
          <SelectField label={t('m05.items.bank')} disabled={!!item} options={[{ value: 'secure', label: t('m05.items.secure') }, { value: 'practice', label: t('m05.items.practiceBank') }]} {...form.field('bank')} />
          <TextField label={t('m05.items.topic')} required {...form.field('topic')} />
          <SelectField label={t('m04.plan.competency')} options={comps} {...form.field('competency')} />
          <SelectField label={t('m05.items.difficulty')} options={['easy', 'medium', 'hard'].map((x) => ({ value: x, label: lab.difficulty(x) }))} {...form.field('difficulty')} />
        </div>
        <TextField label={t('m05.items.reference')} hint={t('m05.items.referenceHint')} {...form.field('reference')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label={t('m05.items.stemEn')} required rows={3} {...form.field('stem_en')} />
          <TextArea label={t('m05.items.stemAr')} required rows={3} {...form.field('stem_ar')} />
        </div>
        <fieldset className="space-y-2">
          <legend className="caps mb-1">{t('m05.items.options')}</legend>
          {options.map((o, k) => (
            <div key={o.id} className="grid grid-cols-[28px_1fr_1fr] items-center gap-2">
              <span className="num font-semibold uppercase">{o.id}</span>
              <input className="input" aria-label={t('m05.items.optionEn', { id: o.id })} value={o.en} onChange={(e) => setOpt(k, 'en', e.target.value)} />
              <input className="input" dir="rtl" aria-label={t('m05.items.optionAr', { id: o.id })} value={o.ar} onChange={(e) => setOpt(k, 'ar', e.target.value)} />
            </div>
          ))}
          <div className="flex gap-2">
            {options.length < 6 && <button type="button" className="btn-ghost btn-sm" onClick={() => setOptions([...options, { id: 'abcdef'[options.length], en: '', ar: '' }])}><Icon name="plus" size={14} />{t('m05.items.addOption')}</button>}
            {options.length > 2 && <button type="button" className="btn-ghost btn-sm" onClick={() => setOptions(options.slice(0, -1))}>{t('m05.items.removeOption')}</button>}
          </div>
          {optErr && <p className="text-[12px] text-bad" role="alert">{optErr}</p>}
        </fieldset>
        <SelectField label={t('m05.items.key')} required options={ids.map((x) => ({ value: x, label: x.toUpperCase() }))} {...form.field('answer')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label={t('m05.items.rationaleEn')} rows={2} {...form.field('rationale_en')} />
          <TextArea label={t('m05.items.rationaleAr')} rows={2} {...form.field('rationale_ar')} />
        </div>
        <TextField label={t('m05.items.changeNote')} required={!!item} {...form.field('note')} />
      </form>
    </Modal>
  );
}
