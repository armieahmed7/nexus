// M08 · Operating experience: curated, de-identified lessons, each with its review date and reviewing body.
// Editors and training staff (internal_content W) draft lessons and move them through review; a lesson publishes only
// with a review date, the OE Screening Committee as reviewing body, de-identification and a no-security-content check.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, CheckboxField, DataTable, Drawer, EmptyState, FilterBar, Icon, KeyValue, Modal, Page, SimChip, StatusPill, TextArea, TextField, required, minLen, useFilters, useForm, type Column } from '../../ui';
import { LessonSources } from './aiUi'; // FS49: sourced international lessons on automation and digital systems
import type { OeLessonsRow } from '../../data/types';
import { todayIso } from '../../domain/rules';
import { GatedConfirm } from '../m16/parts';

const SOURCE_KINDS = ['WANO', 'INPO', 'IAEA IRS', 'EPRI', 'KHNP', 'FANR', 'US NRC', 'internal'];
const FS49_SOURCE_KINDS = ['IAEA', 'EU AI Office', 'UNESCO', 'OECD']; // FS49 public-guidance lessons (filter only; new drafts keep SOURCE_KINDS)

export default function OePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canEdit = s.can('internal_content', ['W']);
  const [params, setParams] = useSearchParams();
  const [flt, setFlt] = useFilters({ q: '', trait: '', source: '', status: '', topic: '' }, true);
  const data = useQuery(['oe_lessons', 'sc_traits'], async () => {
    const [lessons, traits] = await Promise.all([repo.list('oe_lessons', { order: [['reviewed_on', 'desc']] }), repo.list('sc_traits', { order: [['n', 'asc']] })]);
    return { lessons, traits };
  });
  const traitName = useMemo(() => new Map((data.data?.traits ?? []).map((x) => [x.id, pick(x, 'name')])), [data.data, pick]);
  const visible = (data.data?.lessons ?? []).filter((l) => (canEdit || l.status === 'published') && (!flt.trait || l.trait_ids.includes(flt.trait)) && (!flt.source || l.source_kind === flt.source) && (!flt.status || l.status === flt.status) && (!flt.topic || l.topic === flt.topic) && (!flt.q || `${pick(l, 'title')} ${pick(l, 'summary')} ${pick(l, 'lesson')}`.toLowerCase().includes(flt.q.toLowerCase())));
  const openId = params.get('lesson');
  const open = data.data?.lessons.find((l) => l.id === openId) ?? null;
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('lesson', id);
    else p.delete('lesson');
    setParams(p, { replace: true });
  };
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState<OeLessonsRow | null>(null);
  const [checks, setChecks] = useState({ deid: false, nosec: false });

  const cols: Column<OeLessonsRow>[] = [
    { key: 'title', header: t('m08.oe.lesson'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <span className="inline-flex flex-wrap items-center gap-1.5"><button className="text-start font-semibold text-eyebrow hover:underline" onClick={() => setOpen(r.id)}>{pick(r, 'title')}</button>{r.topic === 'ai_automation' && <StatusPill tone="accent">{t('m08.oe.topics.ai_automation')}</StatusPill>}</span> },
    { key: 'source', header: t('m08.oe.source'), value: (r) => (r.source_kind === 'internal' ? t('m08.oe.sourceInternal') : r.source_kind), sortable: true },
    { key: 'traits', header: t('m08.oe.traits'), value: (r) => r.trait_ids.map((x) => traitName.get(x)).join(', '), render: (r) => <span className="text-[12px] text-ink-2">{r.trait_ids.map((x) => traitName.get(x)).join(' · ')}</span> },
    { key: 'reviewed', header: t('m08.oe.reviewedOn'), value: (r) => r.reviewed_on, sortable: true, render: (r) => f.date(r.reviewed_on) },
    { key: 'body', header: t('m08.oe.reviewingBody'), value: (r) => r.reviewing_body },
    { key: 'status', header: t('m08.oe.status'), value: (r) => r.status, render: (r) => <span className="inline-flex gap-1"><StatusPill status={r.status} />{r.sample && <SimChip label={t('common.sample')} />}</span> },
  ];

  return (
    <Page title={t('m08.routes.oe.title')} intro={t('m08.oe.intro')} actions={canEdit ? <button className="btn-primary" onClick={() => setCreating(true)} data-testid="m08-oe-new"><Icon name="plus" />{t('m08.oe.new')}</button> : undefined}>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'trait', label: t('m08.oe.trait'), options: (data.data?.traits ?? []).map((x) => ({ value: x.id, label: pick(x, 'name') })) },
          { key: 'source', label: t('m08.oe.source'), options: [...SOURCE_KINDS, ...FS49_SOURCE_KINDS].map((x) => ({ value: x, label: x === 'internal' ? t('m08.oe.sourceInternal') : x })) },
          { key: 'topic', label: t('m08.oe.topic'), options: ['general', 'ai_automation'].map((x) => ({ value: x, label: t(`m08.oe.topics.${x}`) })) },
          ...(canEdit ? [{ key: 'status', label: t('m08.oe.status'), options: ['draft', 'in_review', 'published'].map((x) => ({ value: x, label: t(`common.status.${x}`) })) }] : []),
        ]}
      />
      <Async state={data}>
        {() => (visible.length === 0 ? <EmptyState title={t('m08.oe.none')} /> : <div data-testid="m08-oe-table"><DataTable rows={visible} rowKey={(r) => r.id} columns={cols} csvName="oe-lessons" initialSort={{ key: 'reviewed', dir: 'desc' }} /></div>)}
      </Async>
      <p className="text-[12px] text-ink-3">{t('m08.oe.footer')}</p>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? pick(open, 'title') : ''}>
        {open && (
          <div className="space-y-4" data-testid="m08-oe-detail">
            <div className="flex flex-wrap gap-1.5">
              <StatusPill status={open.status} />
              {open.deidentified && <StatusPill tone="ok">{t('m08.oe.deidentified')}</StatusPill>}
              {open.sample && <SimChip label={t('common.sample')} />}
            </div>
            <p className="text-[14px]">{pick(open, 'summary')}</p>
            <div className="rounded-card border border-accent/40 bg-accent-soft p-3">
              <div className="caps mb-1">{t('m08.oe.lessonFor')}</div>
              <p className="text-[14px] font-semibold">{pick(open, 'lesson')}</p>
            </div>
            {open.topic === 'ai_automation' && (
              <div data-testid="m08-oe-sources">
                <div className="caps mb-1">{t('m08.oe.publicSource')}</div>
                <LessonSources lesson={open} />
              </div>
            )}
            <KeyValue
              items={[
                [t('m08.oe.reviewedOn'), f.date(open.reviewed_on, 'long')],
                [t('m08.oe.reviewingBody'), open.reviewing_body],
                [t('m08.oe.source'), open.source_kind === 'internal' ? t('m08.oe.sourceInternal') : open.source_kind],
                [t('m08.oe.traits'), open.trait_ids.map((x) => traitName.get(x)).join(' · ') || '—'],
                [t('m08.oe.standards'), open.affected_standard_ids.length ? open.affected_standard_ids.map((x) => <code key={x} className="ltr me-1">{x}</code>) : '—'],
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <L to="/my/safety-culture" className="btn-outline btn-sm">{t('m08.oe.toLearning')}</L>
              {open.topic === 'ai_automation' && <L to="/my/safety-culture/ai" className="btn-outline btn-sm" data-testid="m08-oe-to-ai">{t('m08.oe.toAi')}</L>}
            </div>
            {canEdit && open.status !== 'published' && (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {open.status === 'draft' && (
                  <button className="btn-outline btn-sm" onClick={() => run(() => repo.update('oe_lessons', open.id, { status: 'in_review' }), { success: t('m08.oe.sentToReview') })}>
                    {t('m08.oe.sendToReview')}
                  </button>
                )}
                {open.status === 'in_review' && (
                  <button className="btn-primary btn-sm" onClick={() => { setChecks({ deid: false, nosec: false }); setPublishing(open); }} data-testid="m08-oe-publish">
                    {t('m08.oe.publish')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <GatedConfirm
        open={!!publishing}
        ready={checks.deid && checks.nosec}
        onClose={() => setPublishing(null)}
        title={t('m08.oe.publishTitle')}
        consequence={t('m08.oe.publishBody')}
        actingAs={t('m08.oe.actingEditor')}
        onConfirm={async () => {
          if (!publishing) return;
          await run(() => repo.update('oe_lessons', publishing.id, { status: 'published', deidentified: true, reviewed_on: todayIso(), reviewing_body: 'OE Screening Committee' }), { success: t('m08.oe.published') });
          setOpen(null);
        }}
      >
        <CheckboxField label={t('m08.oe.checkDeid')} checked={checks.deid} onChange={(v) => setChecks((c) => ({ ...c, deid: v }))} />
        <CheckboxField label={t('m08.oe.checkNoSec')} checked={checks.nosec} onChange={(v) => setChecks((c) => ({ ...c, nosec: v }))} />
        {!(checks.deid && checks.nosec) && <p className="text-[12px] text-bad">{t('m08.oe.checksNeeded')}</p>}
      </GatedConfirm>

      <NewLesson open={creating} onClose={() => setCreating(false)} traits={(data.data?.traits ?? []).map((x) => ({ id: x.id, label: pick(x, 'name') }))} />
    </Page>
  );
}

function NewLesson({ open, onClose, traits }: { open: boolean; onClose: () => void; traits: { id: string; label: string }[] }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [sel, setSel] = useState<string[]>([]);
  const [source, setSource] = useState('WANO');
  const form = useForm({ title_en: '', title_ar: '', summary_en: '', summary_ar: '', lesson_en: '', lesson_ar: '' }, { title_en: [required()], title_ar: [required()], summary_en: [required(), minLen(20)], summary_ar: [required()], lesson_en: [required()], lesson_ar: [required()] });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('m08.oe.new')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting || sel.length === 0}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.insert('oe_lessons', { ...v, source_kind: source, trait_ids: sel, reviewed_on: todayIso(), reviewing_body: 'OE Screening Committee', deidentified: false, status: 'draft', affected_standard_ids: [], sample: true }), { success: t('m08.oe.drafted') });
              if (r.ok) {
                form.reset();
                setSel([]);
                onClose();
              }
            })}
            data-testid="m08-oe-save"
          >
            {t('m08.oe.saveDraft')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m08.oe.newHelp')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m08.oe.titleEn')} required {...form.field('title_en')} />
          <TextField label={t('m08.oe.titleAr')} required {...form.field('title_ar')} />
          <TextArea label={t('m08.oe.summaryEn')} required rows={3} {...form.field('summary_en')} />
          <TextArea label={t('m08.oe.summaryAr')} required rows={3} {...form.field('summary_ar')} />
          <TextArea label={t('m08.oe.lessonEn')} required rows={2} {...form.field('lesson_en')} />
          <TextArea label={t('m08.oe.lessonAr')} required rows={2} {...form.field('lesson_ar')} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">{t('m08.oe.source')}</span>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCE_KINDS.map((x) => <option key={x} value={x}>{x === 'internal' ? t('m08.oe.sourceInternal') : x}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold">{t('m08.oe.traits')}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {traits.map((x) => (
              <CheckboxField key={x.id} label={x.label} checked={sel.includes(x.id)} onChange={(v) => setSel((s) => (v ? [...s, x.id] : s.filter((y) => y !== x.id)))} />
            ))}
          </div>
          {sel.length === 0 && <p className="text-[12px] text-ink-3">{t('m08.oe.pickTrait')}</p>}
        </fieldset>
      </div>
    </Modal>
  );
}
