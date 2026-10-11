// M16 · /admin/content: the editorial workflow for pages and news (draft -> in translation -> in review -> published),
// with publish blocked until both languages are approved, every factual claim cites a registered source and a review
// date is set. ECP-owned pages are locked (the Employee Concerns Program owns their wording). Also: facts, FAQs, the
// source registry, and read views of the course and partner catalogues owned by other teams.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Callout, CheckboxField, DataTable, Drawer, EmptyState, FilterBar, Icon, KeyValue, Modal, Page, SelectField, SimChip, SourceLink, StatusPill, Tabs, TextArea, TextField, minLen, pattern, required, useFilters, useForm, type Column } from '../../ui';
import type { ContentPagesRow, FactsRow, FaqsRow, SourcesRow } from '../../data/types';
import { todayIso, daysBetween } from '../../domain/rules';
import { publishBlockers, reviewOverdue } from '../../domain/g5rules';
import { GatedConfirm, Metric } from './parts';

type Src = { id: string; label: string; url: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function AdminContentPage() {
  const t = useT();
  const s = useSession();
  const canEdit = s.can('public_content', ['W', 'A']);
  return (
    <Page title={t('m16.routes.admin-content.title')} intro={t('m16.content.intro')} actions={<StatusPill tone="neutral">{canEdit ? t('m16.content.asEditor') : t('m16.fw.readOnly')}</StatusPill>} wide>
      <Tabs
        tabs={[
          { id: 'pages', label: t('m16.content.tabPages'), content: <PagesTab canEdit={canEdit} /> },
          { id: 'facts', label: t('m16.content.tabFacts'), content: <FactsTab canEdit={canEdit} /> },
          { id: 'faqs', label: t('m16.content.tabFaqs'), content: <FaqsTab canEdit={canEdit} /> },
          { id: 'sources', label: t('m16.content.tabSources'), content: <SourcesTab canEdit={canEdit} /> },
          { id: 'catalogues', label: t('m16.content.tabCatalogues'), content: <CataloguesTab /> },
        ]}
      />
    </Page>
  );
}

// ───────────── Pages and news
function PagesTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const q = useQuery(['content_pages', 'sources'], async () => {
    const [pages, sources] = await Promise.all([repo.list('content_pages', { order: [['updated_at', 'desc']] }), repo.list('sources', { order: [['label', 'asc']] })]);
    return { pages, sources };
  });
  const [flt, setFlt] = useFilters({ q: '', kind: '', status: '', zone: '', review: '' }, true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<ContentPagesRow | 'new' | null>(null);
  const [step, setStep] = useState<{ p: ContentPagesRow; to: string } | null>(null);
  const today = todayIso();
  const all = q.data?.pages ?? [];
  const rows = all.filter((p) => (!flt.kind || p.kind === flt.kind) && (!flt.status || p.status === flt.status) && (!flt.zone || p.zone === flt.zone) && (!flt.review || (flt.review === 'overdue' ? reviewOverdue(p, today) : !reviewOverdue(p, today))) && (!flt.q || `${p.title_en} ${p.title_ar} ${p.slug}`.toLowerCase().includes(flt.q.toLowerCase())));
  const open = all.find((p) => p.id === openId) ?? null;
  const stamp = { updated_at: new Date().toISOString(), updated_by: s.identity.personId };
  const transition = (p: ContentPagesRow, to: string) => {
    const patch: Partial<ContentPagesRow> = { ...stamp };
    if (to === 'in_translation') Object.assign(patch, { status: 'in_translation', translation_status: p.body_ar.trim() ? 'ar_draft' : 'en_only' });
    if (to === 'in_review') Object.assign(patch, { status: 'in_review', translation_status: 'both_approved' });
    if (to === 'published') Object.assign(patch, { status: 'published', is_published: true, published_on: p.kind === 'news' ? p.published_on ?? today : p.published_on, as_of: today });
    if (to === 'draft') Object.assign(patch, { status: 'draft', is_published: false });
    return run(() => repo.update('content_pages', p.id, patch), { success: t(`m16.content.moved.${to}`) });
  };
  const cols: Column<ContentPagesRow>[] = [
    { key: 'title', header: t('m16.content.title'), value: (p) => pick(p, 'title'), sortable: true, render: (p) => <button className="text-start font-semibold text-eyebrow hover:underline" onClick={() => setOpenId(p.id)}>{pick(p, 'title')}</button> },
    { key: 'kind', header: t('m16.content.kind'), value: (p) => p.kind, render: (p) => t(`m16.content.kinds.${p.kind}`) },
    { key: 'slug', header: t('m16.content.slug'), value: (p) => p.slug, render: (p) => <code className="ltr text-[12px]">/{p.slug}</code> },
    { key: 'zone', header: t('m16.content.zone'), value: (p) => p.zone, render: (p) => t(`m16.content.zones.${p.zone}`) },
    { key: 'status', header: t('m16.content.status'), value: (p) => p.status, render: (p) => <span className="flex flex-wrap gap-1"><StatusPill status={p.status}>{t(`m16.content.st.${p.status}`)}</StatusPill>{p.ecp_owned && <StatusPill tone="reserved">{t('m16.content.ecp')}</StatusPill>}</span> },
    { key: 'translation', header: t('m16.content.translation'), value: (p) => p.translation_status, render: (p) => <StatusPill tone={p.translation_status === 'both_approved' ? 'ok' : 'sim'}>{t(`m16.content.tr.${p.translation_status}`)}</StatusPill> },
    { key: 'sources', header: t('m16.content.sources'), value: (p) => (Array.isArray(p.sources) ? p.sources.length : 0), align: 'end' },
    { key: 'review', header: t('m16.content.reviewOn'), value: (p) => p.review_on, sortable: true, render: (p) => (reviewOverdue(p, today) ? <StatusPill status="overdue">{f.date(p.review_on)}</StatusPill> : f.date(p.review_on)) },
    { key: 'updated', header: t('m16.content.updated'), value: (p) => p.updated_at, sortable: true, render: (p) => f.date(p.updated_at) },
  ];
  return (
    <div className="space-y-3">
      <Async state={q}>
        {(d) => (
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label={t('m16.content.mPublished')} value={f.num(d.pages.filter((p) => p.is_published).length)} />
            <Metric label={t('m16.content.mWorkflow')} value={f.num(d.pages.filter((p) => p.status !== 'published').length)} tone="info" />
            <Metric label={t('m16.content.mOverdue')} value={f.num(d.pages.filter((p) => p.is_published && reviewOverdue(p, today)).length)} tone={d.pages.some((p) => p.is_published && reviewOverdue(p, today)) ? 'bad' : 'ok'} />
            <Metric label={t('m16.content.mNews')} value={f.num(d.pages.filter((p) => p.kind === 'news' && p.is_published).length)} />
          </div>
        )}
      </Async>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'kind', label: t('m16.content.kind'), options: ['page', 'news'].map((x) => ({ value: x, label: t(`m16.content.kinds.${x}`) })) },
          { key: 'status', label: t('m16.content.status'), options: ['draft', 'in_translation', 'in_review', 'published'].map((x) => ({ value: x, label: t(`m16.content.st.${x}`) })) },
          { key: 'zone', label: t('m16.content.zone'), options: ['public', 'staff', 'partner'].map((x) => ({ value: x, label: t(`m16.content.zones.${x}`) })) },
          { key: 'review', label: t('m16.content.reviewOn'), options: [{ value: 'overdue', label: t('m16.content.overdue') }, { value: 'ok', label: t('m16.content.inDate') }] },
        ]}
        extra={canEdit ? <button className="btn-primary btn-sm self-end" onClick={() => setEdit('new')} data-testid="m16-content-new"><Icon name="plus" />{t('m16.content.new')}</button> : undefined}
      />
      <Async state={q}>{() => (rows.length === 0 ? <EmptyState title={t('m16.content.none')} /> : <div data-testid="m16-content-table"><DataTable rows={rows} rowKey={(p) => p.id} columns={cols} csvName="kafaa-content" /></div>)}</Async>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? pick(open, 'title') : ''}>
        {open && (() => {
          const blockers = publishBlockers(open);
          const srcs = (Array.isArray(open.sources) ? open.sources : []) as Src[];
          return (
            <div className="space-y-4" data-testid="m16-content-detail">
              <div className="flex flex-wrap gap-1">
                <StatusPill status={open.status}>{t(`m16.content.st.${open.status}`)}</StatusPill>
                <StatusPill tone={open.translation_status === 'both_approved' ? 'ok' : 'sim'}>{t(`m16.content.tr.${open.translation_status}`)}</StatusPill>
                {open.is_published && <StatusPill tone="ok">{t('m16.content.live')}</StatusPill>}
              </div>
              <KeyValue
                items={[
                  [t('m16.content.slug'), <L key="s" to={`/${open.slug}`} className="ltr text-eyebrow hover:underline">/{open.slug}</L>],
                  [t('m16.content.zone'), t(`m16.content.zones.${open.zone}`)],
                  [t('m16.content.owner'), open.owner_role],
                  [t('m16.content.asOf'), f.date(open.as_of)],
                  [t('m16.content.reviewOn'), f.date(open.review_on)],
                  ...(open.kind === 'news' ? ([[t('m16.content.publishedOn'), open.published_on ? f.date(open.published_on) : '—']] as [string, string][]) : []),
                  [t('m16.content.updated'), f.dateTime(open.updated_at)],
                ]}
              />
              {open.ecp_owned && <Callout tone="sim" title={t('m16.content.ecpTitle')}>{t('m16.content.ecpBody')}</Callout>}
              <div>
                <div className="caps mb-1">{t('m16.content.sources')}</div>
                {srcs.length === 0 ? <p className="text-[13px] text-ink-3">{open.no_factual_claims ? t('m16.content.noClaims') : t('m16.content.noSources')}</p> : <ul className="space-y-1 text-[13px]">{srcs.map((x) => <li key={x.id}><SourceLink href={x.url}>{x.label}</SourceLink></li>)}</ul>}
              </div>
              <div className="rounded-card border border-line p-3">
                <div className="caps mb-1">{t('m16.content.preview')}</div>
                <p className="line-clamp-6 whitespace-pre-line text-[13px]">{pick(open, 'body')}</p>
              </div>
              {open.status !== 'published' && (
                <div>
                  <div className="caps mb-1">{t('m16.content.checks')}</div>
                  <ul className="space-y-1 text-[13px]" data-testid="m16-blockers">
                    {['translation', 'sources', 'review_date', 'body'].map((b) => (
                      <li key={b} className="flex items-center gap-2">
                        <Icon name={blockers.includes(b) ? 'close' : 'check'} className={blockers.includes(b) ? 'text-bad' : 'text-ok'} />
                        {t(`m16.content.block.${b}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canEdit && !open.ecp_owned && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <button className="btn-outline btn-sm" onClick={() => setEdit(open)}>{t('common.edit')}</button>
                  {open.status === 'draft' && <button className="btn-outline btn-sm" onClick={() => transition(open, 'in_translation')}>{t('m16.content.toTranslation')}</button>}
                  {open.status === 'in_translation' && <button className="btn-outline btn-sm" disabled={!open.body_ar.trim()} onClick={() => transition(open, 'in_review')}>{t('m16.content.approveTranslation')}</button>}
                  {open.status === 'in_review' && (
                    <button className="btn-primary btn-sm" disabled={blockers.length > 0} onClick={() => setStep({ p: open, to: 'published' })} data-testid="m16-publish">
                      {t('m16.content.publish')}
                    </button>
                  )}
                  {open.is_published && <button className="btn-ghost btn-sm" onClick={() => setStep({ p: open, to: 'draft' })}>{t('m16.content.unpublish')}</button>}
                </div>
              )}
            </div>
          );
        })()}
      </Drawer>
      <GatedConfirm
        open={!!step}
        onClose={() => setStep(null)}
        danger={step?.to === 'draft'}
        title={step ? t(step.to === 'published' ? 'm16.content.publish' : 'm16.content.unpublish') : ''}
        consequence={step ? t(step.to === 'published' ? 'm16.content.publishBody' : 'm16.content.unpublishBody', { title: step.p.title_en }) : ''}
        actingAs={t('m16.content.asEditor')}
        onConfirm={() => step && transition(step.p, step.to)}
      />
      {edit && <EditPage page={edit === 'new' ? null : edit} sources={q.data?.sources ?? []} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditPage({ page, sources, onClose }: { page: ContentPagesRow | null; sources: SourcesRow[]; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [srcIds, setSrcIds] = useState<string[]>(((page?.sources ?? []) as Src[]).map((x) => x.id));
  const [noClaims, setNoClaims] = useState(!!page?.no_factual_claims);
  const reviewDefault = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
  const form = useForm(
    { kind: page?.kind ?? 'page', slug: page?.slug ?? '', zone: page?.zone ?? 'public', title_en: page?.title_en ?? '', title_ar: page?.title_ar ?? '', summary_en: page?.summary_en ?? '', summary_ar: page?.summary_ar ?? '', body_en: page?.body_en ?? '', body_ar: page?.body_ar ?? '', review_on: page?.review_on ?? reviewDefault, topic: page?.topic ?? 'general', published_on: page?.published_on ?? '' },
    { slug: [required(), pattern(/^[a-z0-9][a-z0-9/-]*$/, 'm16.content.slugRule')], title_en: [required()], title_ar: [required()], body_en: [required(), minLen(40)], review_on: [required(), pattern(DATE, 'm16.content.dateRule')] },
  );
  const [q, setQ] = useState('');
  const visible = sources.filter((x) => !q || `${x.label} ${x.publisher}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={page ? t('m16.content.edit', { title: page.title_en }) : t('m16.content.new')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const chosen = srcIds.map((id) => sources.find((x) => x.id === id)).filter(Boolean).map((x) => ({ id: x!.id, label: x!.label, url: x!.url }));
              const row: Partial<ContentPagesRow> = {
                ...v, kind: v.kind as never, zone: v.zone as never, published_on: v.published_on || null, sources: chosen, no_factual_claims: noClaims,
                updated_at: new Date().toISOString(), updated_by: s.identity.personId,
              };
              // Any edit to a published page sends it back through translation and review.
              const r = page
                ? await run(() => repo.update('content_pages', page.id, { ...row, ...(page.is_published && (v.body_en !== page.body_en || v.body_ar !== page.body_ar) ? { status: 'in_translation', translation_status: 'ar_draft' } : {}) }), { success: t('m16.content.saved') })
                : await run(() => repo.insert('content_pages', { ...row, module: 'M12', as_of: todayIso(), status: 'draft', is_published: false, translation_status: v.body_ar.trim() ? 'ar_draft' : 'en_only', owner_role: 'Editor' }), { success: t('m16.content.saved') });
              if (r.ok) onClose();
            })}
            data-testid="m16-content-save"
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {page?.is_published && <Callout tone="sim">{t('m16.content.liveEdit')}</Callout>}
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label={t('m16.content.kind')} options={['page', 'news'].map((x) => ({ value: x, label: t(`m16.content.kinds.${x}`) }))} {...form.field('kind')} />
          <SelectField label={t('m16.content.zone')} options={['public', 'staff', 'partner'].map((x) => ({ value: x, label: t(`m16.content.zones.${x}`) }))} {...form.field('zone')} />
          <TextField label={t('m16.content.slug')} required {...form.field('slug')} hint={t('m16.content.slugHint')} />
          <TextField label={t('m16.content.titleEn')} required {...form.field('title_en')} />
          <TextField label={t('m16.content.titleAr')} required {...form.field('title_ar')} />
          <TextField label={t('m16.content.reviewOn')} required {...form.field('review_on')} hint="YYYY-MM-DD" />
        </div>
        {form.values.kind === 'news' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label={t('m16.content.publishedOn')} {...form.field('published_on')} hint="YYYY-MM-DD" />
            <SelectField label={t('m16.content.topic')} options={['talent', 'research', 'community', 'environment', 'partners', 'technology', 'barakah', 'corporate'].map((x) => ({ value: x, label: t(`m12.news.topics.${x}`) }))} {...form.field('topic')} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label={t('m16.content.summaryEn')} rows={2} {...form.field('summary_en')} />
          <TextArea label={t('m16.content.summaryAr')} rows={2} {...form.field('summary_ar')} />
          <TextArea label={t('m16.content.bodyEn')} rows={8} required {...form.field('body_en')} />
          <TextArea label={t('m16.content.bodyAr')} rows={8} {...form.field('body_ar')} hint={t('m16.content.bodyArHint')} />
        </div>
        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold">{t('m16.content.sources')}</legend>
          <CheckboxField label={t('m16.content.noClaimsLabel')} hint={t('m16.content.noClaimsHint')} checked={noClaims} onChange={setNoClaims} />
          <input className="input mt-2" placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
            {visible.map((x) => (
              <CheckboxField key={x.id} label={x.label} checked={srcIds.includes(x.id)} onChange={(v) => setSrcIds((xs) => (v ? [...xs, x.id] : xs.filter((y) => y !== x.id)))} />
            ))}
          </div>
          <p className="mt-1 text-[12px] text-ink-3">{t('m16.content.sourcesChosen', { n: srcIds.length })}</p>
        </fieldset>
        <p className="text-[12px] text-ink-3">{t('m16.content.rules')}</p>
      </div>
    </Modal>
  );
}

// ───────────── Facts
function FactsTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['facts', 'sources'], async () => {
    const [facts, sources] = await Promise.all([repo.list('facts', { order: [['topic', 'asc']] }), repo.list('sources')]);
    return { facts, sources };
  });
  const [edit, setEdit] = useState<FactsRow | null>(null);
  const today = todayIso();
  return (
    <div className="space-y-3">
      <Callout tone="info">{t('m16.content.factsIntro')}</Callout>
      <Async state={q}>
        {(d) => {
          const src = new Map(d.sources.map((x) => [x.id, x]));
          return (
            <DataTable
              rows={d.facts}
              rowKey={(x) => x.id}
              csvName="kafaa-facts"
              columns={[
                { key: 'label', header: t('m16.content.fact'), value: (x) => pick(x, 'label'), sortable: true, render: (x) => <span className="font-semibold">{pick(x, 'label')}</span> },
                { key: 'value', header: t('m16.content.value'), value: (x) => x.value, render: (x) => <span className="num">{pick({ v_en: x.value, v_ar: x.value_ar || x.value }, 'v')}</span> },
                { key: 'topic', header: t('m16.content.topic'), value: (x) => x.topic },
                { key: 'source', header: t('m16.content.source'), value: (x) => src.get(x.source_id ?? '')?.label ?? '', render: (x) => (x.sample ? <SimChip label={t('common.sample')} /> : x.source_id && src.get(x.source_id) ? <SourceLink href={src.get(x.source_id)!.url}>{src.get(x.source_id)!.publisher || src.get(x.source_id)!.label}</SourceLink> : <StatusPill status="fail">{t('m16.content.noSource')}</StatusPill>) },
                { key: 'asof', header: t('m16.content.asOf'), value: (x) => x.as_of, sortable: true, render: (x) => (daysBetween(x.as_of, today) > 365 ? <StatusPill status="stale">{f.date(x.as_of)}</StatusPill> : f.date(x.as_of)) },
                { key: 'public', header: t('m16.content.public'), value: (x) => (x.public ? 'yes' : 'no'), render: (x) => (x.public ? t('common.yes') : t('common.no')) },
                ...(canEdit ? [{ key: 'act', header: '', csv: false, render: (x: FactsRow) => <button className="btn-ghost btn-sm" onClick={() => setEdit(x)}>{t('common.edit')}</button> } as Column<FactsRow>] : []),
              ]}
            />
          );
        }}
      </Async>
      {edit && <EditFact fact={edit} sources={q.data?.sources ?? []} onClose={() => setEdit(null)} />}
    </div>
  );
}
function EditFact({ fact, sources, onClose }: { fact: FactsRow; sources: SourcesRow[]; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ value: fact.value, value_ar: fact.value_ar, as_of: fact.as_of, source_id: fact.source_id ?? '', conflict_note: fact.conflict_note ?? '' }, { value: [required()], as_of: [required(), pattern(DATE, 'm16.content.dateRule')] });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('m16.content.editFact', { label: fact.label_en })}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={form.handleSubmit(async (v) => {
              if (!fact.sample && !v.source_id) return;
              const r = await run(() => repo.update('facts', fact.id, { ...v, source_id: v.source_id || null, conflict_note: v.conflict_note || null }), { success: t('m16.content.saved') });
              if (r.ok) onClose();
            })}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m16.content.value')} required {...form.field('value')} />
          <TextField label={t('m16.content.valueAr')} {...form.field('value_ar')} />
          <TextField label={t('m16.content.asOf')} required {...form.field('as_of')} hint="YYYY-MM-DD" />
          <SelectField label={t('m16.content.source')} options={[{ value: '', label: '—' }, ...sources.map((x) => ({ value: x.id, label: x.label }))]} {...form.field('source_id')} />
        </div>
        {!fact.sample && !form.values.source_id && <p className="text-[12px] text-bad">{t('m16.content.factNeedsSource')}</p>}
        <TextArea label={t('m16.content.conflict')} rows={2} {...form.field('conflict_note')} hint={t('m16.content.conflictHint')} />
      </div>
    </Modal>
  );
}

// ───────────── FAQs
function FaqsTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery('faqs', () => repo.list('faqs', { order: [['topic', 'asc'], ['sort', 'asc']] }));
  const [edit, setEdit] = useState<FaqsRow | 'new' | null>(null);
  return (
    <div className="space-y-3">
      {canEdit && <button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Icon name="plus" />{t('m16.content.newFaq')}</button>}
      <Async state={q} empty={<EmptyState title={t('m16.content.none')} />} isEmpty={(r) => r.length === 0}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(x) => x.id}
            csvName="kafaa-faqs"
            columns={[
              { key: 'topic', header: t('m16.content.topic'), value: (x) => x.topic, sortable: true, render: (x) => t(`m12.faq.topics.${x.topic}`) },
              { key: 'q', header: t('m16.content.question'), value: (x) => pick(x, 'q'), render: (x) => <span className="font-semibold">{pick(x, 'q')}</span> },
              { key: 'a', header: t('m16.content.answer'), value: (x) => pick(x, 'a'), render: (x) => <span className="line-clamp-2 text-[12.5px]">{pick(x, 'a')}</span> },
              { key: 'sort', header: '#', value: (x) => x.sort, align: 'end' },
              ...(canEdit ? [{ key: 'act', header: '', csv: false, render: (x: FaqsRow) => <button className="btn-ghost btn-sm" onClick={() => setEdit(x)}>{t('common.edit')}</button> } as Column<FaqsRow>] : []),
            ]}
          />
        )}
      </Async>
      {edit && <EditFaq faq={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditFaq({ faq, onClose }: { faq: FaqsRow | null; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ topic: faq?.topic ?? 'general', q_en: faq?.q_en ?? '', q_ar: faq?.q_ar ?? '', a_en: faq?.a_en ?? '', a_ar: faq?.a_ar ?? '', sort: String(faq?.sort ?? 99) }, { q_en: [required()], q_ar: [required()], a_en: [required(), minLen(20)], a_ar: [required()] });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={faq ? t('common.edit') : t('m16.content.newFaq')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={form.handleSubmit(async (v) => {
              const row = { ...v, sort: Number(v.sort) || 0 };
              const r = faq ? await run(() => repo.update('faqs', faq.id, row), { success: t('m16.content.saved') }) : await run(() => repo.insert('faqs', row), { success: t('m16.content.saved') });
              if (r.ok) onClose();
            })}
            data-testid="m16-faq-save"
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label={t('m16.content.topic')} options={['general', 'careers', 'licensing', 'programmes', 'suppliers', 'privacy', 'dalil', 'safety', 'emergency', 'community'].map((x) => ({ value: x, label: t(`m12.faq.topics.${x}`) }))} {...form.field('topic')} />
        <TextField label={t('m16.content.order')} {...form.field('sort')} />
        <TextField label={t('m16.content.questionEn')} required {...form.field('q_en')} />
        <TextField label={t('m16.content.questionAr')} required {...form.field('q_ar')} />
        <TextArea label={t('m16.content.answerEn')} required rows={4} {...form.field('a_en')} />
        <TextArea label={t('m16.content.answerAr')} required rows={4} {...form.field('a_ar')} />
      </div>
    </Modal>
  );
}

// ───────────── Source registry
function SourcesTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery(['sources', 'content_pages', 'facts'], async () => {
    const [sources, pages, facts] = await Promise.all([repo.list('sources', { order: [['label', 'asc']] }), repo.list('content_pages'), repo.list('facts')]);
    return { sources, pages, facts };
  });
  const [adding, setAdding] = useState(false);
  const form = useForm({ label: '', url: '', publisher: '', accessed: todayIso() }, { label: [required()], url: [required(), pattern(/^https:\/\/[^\s]+$/, 'm16.content.httpsOnly')], publisher: [required()] });
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of q.data?.pages ?? []) for (const s of (Array.isArray(p.sources) ? p.sources : []) as Src[]) m.set(s.id, (m.get(s.id) ?? 0) + 1);
    for (const x of q.data?.facts ?? []) if (x.source_id) m.set(x.source_id, (m.get(x.source_id) ?? 0) + 1);
    return m;
  }, [q.data]);
  return (
    <div className="space-y-3">
      <Callout tone="info">{t('m16.content.sourcesIntro')}</Callout>
      {canEdit && (
        <div className="card p-3">
          {!adding ? (
            <button className="btn-outline btn-sm" onClick={() => setAdding(true)}><Icon name="plus" />{t('m16.content.addSource')}</button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField label={t('m16.content.sourceLabel')} required {...form.field('label')} />
              <TextField label="URL" required {...form.field('url')} />
              <TextField label={t('m16.content.publisher')} required {...form.field('publisher')} />
              <TextField label={t('m16.content.accessed')} {...form.field('accessed')} hint="YYYY-MM-DD" />
              <div className="flex gap-2 sm:col-span-4">
                <button
                  className="btn-primary btn-sm"
                  onClick={form.handleSubmit(async (v) => {
                    const r = await run(() => repo.insert('sources', { ...v, accessed: v.accessed || null }), { success: t('m16.content.saved') });
                    if (r.ok) {
                      form.reset();
                      setAdding(false);
                    }
                  })}
                  data-testid="m16-source-save"
                >
                  {t('common.save')}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}
      <Async state={q}>
        {(d) => (
          <DataTable
            rows={d.sources}
            rowKey={(x) => x.id}
            csvName="kafaa-sources"
            columns={[
              { key: 'label', header: t('m16.content.sourceLabel'), value: (x) => x.label, sortable: true, render: (x) => <SourceLink href={x.url}>{x.label}</SourceLink> },
              { key: 'publisher', header: t('m16.content.publisher'), value: (x) => x.publisher, sortable: true },
              { key: 'accessed', header: t('m16.content.accessed'), value: (x) => x.accessed ?? '', sortable: true, render: (x) => (x.accessed ? f.date(x.accessed) : '—') },
              { key: 'used', header: t('m16.content.usedBy'), value: (x) => usage.get(x.id) ?? 0, align: 'end', sortable: true },
            ]}
          />
        )}
      </Async>
    </div>
  );
}

// ───────────── Course and partner catalogues (owned by Training and Partnerships; read here)
function CataloguesTab() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['courses', 'organisations'], async () => {
    const [courses, orgs] = await Promise.all([repo.list('courses', { order: [['code', 'asc']] }), repo.list('organisations', { filter: { public_listed: true }, order: [['name_en', 'asc']] })]);
    return { courses, orgs };
  });
  return (
    <div className="space-y-4">
      <Callout tone="info">{t('m16.content.cataloguesIntro')}</Callout>
      <Async state={q}>
        {(d) => (
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{t('m16.content.courses', { n: d.courses.length })}</h3>
                <L to="/training/courses" className="btn-ghost btn-sm">{t('m16.content.manageCourses')}</L>
              </div>
              <DataTable
                rows={d.courses}
                rowKey={(c) => c.id}
                csvName="kafaa-courses"
                dense
                columns={[
                  { key: 'code', header: t('m16.fw.code'), value: (c) => c.code, render: (c) => <code className="ltr">{c.code}</code> },
                  { key: 'title', header: t('m16.content.title'), value: (c) => pick(c, 'title'), render: (c) => <L to={`/learn/course/${c.id}`} className="text-eyebrow hover:underline">{pick(c, 'title')}</L> },
                  { key: 'audience', header: t('m16.content.audience'), value: (c) => c.audience },
                  { key: 'public', header: t('m16.content.public'), value: (c) => (c.public_summary ? 'yes' : 'no'), render: (c) => (c.public_summary ? <StatusPill tone="ok">{t('common.yes')}</StatusPill> : <StatusPill tone="neutral">{t('m13.admin.internal')}</StatusPill>) },
                ]}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{t('m16.content.partners', { n: d.orgs.length })}</h3>
                <L to="/partners" className="btn-ghost btn-sm">{t('m16.content.viewDirectory')}</L>
              </div>
              <DataTable
                rows={d.orgs}
                rowKey={(o) => o.id}
                csvName="kafaa-partners"
                dense
                columns={[
                  { key: 'name', header: t('m16.content.title'), value: (o) => pick(o, 'name'), render: (o) => <span className="font-semibold">{pick(o, 'name')}</span> },
                  { key: 'kind', header: t('m16.content.kind'), value: (o) => o.kind },
                  { key: 'status', header: t('m16.content.status'), value: (o) => o.status, render: (o) => <StatusPill status={o.status === 'active' ? 'active' : 'archived'}>{o.status}</StatusPill> },
                  { key: 'sources', header: t('m16.content.sources'), value: (o) => (Array.isArray(o.sources) ? o.sources.length : 0), align: 'end' },
                ]}
              />
            </div>
          </div>
        )}
      </Async>
    </div>
  );
}
