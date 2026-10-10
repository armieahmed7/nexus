// FS18 /training/external (training manager writes; instructors and auditors read): every external resource with its status and its
// score on each published criterion; an editor with the live publish check (catalogueCheck = SQL kafaa_xr_check); publish (refused by
// the RPC unless the required criteria are met) and retire with a reason (never deleted).
import { useState } from 'react';
import { Page, Async, StatTile, BenchmarkChips, DataTable, Drawer, TextField, TextArea, SelectField, CheckboxField, StatusPill, Icon, Callout, ConfirmDialog, SourceLink } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { COST_BANDS, EXT_FORMATS, catalogueCheck, type CriterionRow, type SkillRef } from './pathways';
import { ExternalChip, usePwRef, type PwRef, type Row } from './fsui';

export default function TrainingExternalPage() {
  const t = useT();
  const ref = usePwRef();
  return (
    <Page title={t('m19.routes.training-external.title')} intro={t('m19.xr.adm.intro')} wide eyebrow={<BenchmarkChips feature="FS18" />}
      actions={<L to="/learn/external" className="btn-outline btn-sm no-underline"><ExternalChip /> {t('m19.xr.adm.toCatalogue')}</L>}>
      <Async state={ref}>{(d) => <Admin d={d} />}</Async>
    </Page>
  );
}

interface XDraft { id?: string; title_en: string; title_ar: string; provider_en: string; provider_ar: string; provider_url: string; url: string; format: string; hours: string; duration_en: string; duration_ar: string;
  cost_band: string; languages: string; skills: string; has_assessment: boolean; summary_en: string; summary_ar: string; as_of: string; criteria: Record<string, string> }

const toInput = (x: XDraft) => ({
  ...(x.id ? { id: x.id } : {}), title_en: x.title_en, title_ar: x.title_ar, provider_en: x.provider_en, provider_ar: x.provider_ar, provider_url: x.provider_url, url: x.url, format: x.format,
  hours: x.hours.trim() ? Number(x.hours) : null, duration_en: x.duration_en, duration_ar: x.duration_ar, cost_band: x.cost_band, languages: x.languages.split(',').map((s) => s.trim()).filter(Boolean),
  skills: x.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [skill_id, level] = s.split('@'); return { skill_id, level: Number(level ?? 1) }; }),
  has_assessment: x.has_assessment, summary_en: x.summary_en, summary_ar: x.summary_ar, as_of: x.as_of,
  criteria: Object.fromEntries(Object.entries(x.criteria).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])),
});

function Admin({ d }: { d: PwRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canEdit = s.identity.roles.includes('training_manager');
  const [draft, setDraft] = useState<XDraft | null>(null);
  const [act, setAct] = useState<{ kind: 'publish' | 'retire'; x: Row } | null>(null);
  const criteria = d.criteria.filter((c) => c.status === 'published') as unknown as CriterionRow[];
  const chk = (x: Row) => catalogueCheck(x, criteria, d.skills as unknown as SkillRef[], todayIso());
  const open = (x: Row | null) => setDraft(x ? {
    id: x.id, title_en: x.title_en, title_ar: x.title_ar, provider_en: x.provider_en, provider_ar: x.provider_ar, provider_url: x.provider_url, url: x.url, format: x.format, hours: x.hours == null ? '' : String(x.hours),
    duration_en: x.duration_en ?? '', duration_ar: x.duration_ar ?? '', cost_band: x.cost_band, languages: (x.languages ?? []).join(', '), skills: ((x.skills ?? []) as Row[]).map((k) => `${k.skill_id}@${k.level}`).join(', '),
    has_assessment: !!x.has_assessment, summary_en: x.summary_en ?? '', summary_ar: x.summary_ar ?? '', as_of: String(x.as_of), criteria: Object.fromEntries(Object.entries(x.criteria ?? {}).map(([k, v]) => [k, String(v)])),
  } : { title_en: '', title_ar: '', provider_en: '', provider_ar: '', provider_url: 'https://', url: 'https://', format: 'elearning', hours: '', duration_en: '', duration_ar: '', cost_band: 'free', languages: 'en', skills: '',
    has_assessment: false, summary_en: '', summary_ar: '', as_of: todayIso(), criteria: {} });
  const n = (st: string) => d.externals.filter((x) => x.status === st).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m19-xadm-tiles">
        <StatTile label={t('m19.xr.adm.tilePublished')} value={f.num(n('published'))} tone="ok" />
        <StatTile label={t('m19.xr.adm.tileDraft')} value={f.num(n('draft'))} sub={t('m19.xr.adm.tileDraftSub', { n: f.num(d.externals.filter((x) => x.status === 'draft' && !chk(x).ok).length) })} tone="sim" />
        <StatTile label={t('m19.xr.adm.tileRetired')} value={f.num(n('retired'))} />
        <StatTile label={t('m19.xr.adm.tileCriteria')} value={f.num(criteria.length)} sub={t('m19.xr.adm.tileCriteriaSub', { n: f.num(criteria.filter((c) => c.required).length) })} />
      </div>
      {!canEdit && <Callout title={t('m19.pw.adm.readOnly')}>{t('m19.xr.adm.readOnlyBody')}</Callout>}
      <DataTable rows={d.externals} rowKey={(x) => x.id} csvName="kafaa-external-catalogue.csv" onRowClick={canEdit ? (x) => open(x) : undefined}
        toolbar={canEdit ? <button type="button" className="btn-primary btn-sm" onClick={() => open(null)} data-testid="m19-xadm-new"><Icon name="plus" size={14} />{t('m19.xr.adm.new')}</button> : undefined}
        columns={[
          { key: 'title', header: t('m19.xr.adm.colTitle'), value: (x) => pick(x, 'title'), render: (x) => <span><span className="font-semibold">{pick(x, 'title')}</span><span className="block text-[12px] text-ink-3">{pick(x, 'provider')}</span></span> },
          { key: 'status', header: t('m19.pw.adm.colStatus'), value: (x) => x.status, render: (x) => <StatusPill tone={x.status === 'published' ? 'ok' : x.status === 'draft' ? 'sim' : 'neutral'}>{t(`m19.pw.status.${x.status}`)}</StatusPill> },
          ...criteria.map((c) => ({ key: `c-${c.id}`, header: pick(c as unknown as Row, 'name'), align: 'center' as const, value: (x: Row) => (x.criteria ?? {})[c.id] ?? null,
            render: (x: Row) => { const v = (x.criteria ?? {})[c.id]; const bad = c.required && !(Number.isInteger(v) && v >= c.min_score); return <span className={bad ? 'font-semibold text-bad' : ''} data-testid="m19-xadm-score">{v == null ? '—' : f.num(v)}</span>; } })),
          { key: 'check', header: t('m19.xr.adm.colCheck'), value: (x) => (chk(x).ok ? 'ok' : 'fail'), render: (x) => { const c = chk(x); return c.ok ? <StatusPill tone="ok">{t('m19.xr.adm.meets')}</StatusPill> : <StatusPill tone="bad">{t('m19.xr.adm.fails', { list: [...c.problems.map((p) => t(`m19.xr.problem.${p}`)), ...c.failing.map((q) => pick(criteria.find((k) => k.id === q) as unknown as Row ?? {}, 'name'))].join(', ') })}</StatusPill>; } },
          { key: 'asof', header: t('m19.xr.adm.colAsOf'), value: (x) => x.as_of, render: (x) => <SourceLink href={x.url} date={x.as_of}>{t('m19.xr.adm.provider')}</SourceLink> },
          { key: 'act', header: '', csv: false, render: (x) => canEdit ? (
            <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {x.status !== 'published' && <button type="button" className="btn-outline btn-sm" onClick={() => setAct({ kind: 'publish', x })} data-testid="m19-xadm-publish">{t('m19.xr.adm.publish')}</button>}
              {x.status !== 'retired' && <button type="button" className="btn-ghost btn-sm" onClick={() => setAct({ kind: 'retire', x })} data-testid="m19-xadm-retire">{t('m19.xr.adm.retire')}</button>}
            </span>) : null },
        ]} />
      {draft && <XEditor draft={draft} setDraft={setDraft} d={d} criteria={criteria} onSave={async () => {
        const r = await run(() => repo.rpc.saveExternalResource(toInput(draft)), { success: t('m19.xr.adm.saved') });
        if (r.ok) setDraft(null);
      }} />}
      <ConfirmDialog open={act?.kind === 'publish'} onClose={() => setAct(null)} title={t('m19.xr.adm.publishTitle')} consequence={t('m19.xr.adm.publishBody')}
        onConfirm={() => act && run(() => repo.rpc.publishExternalResource(act.x.id), { success: t('m19.xr.adm.published') })} />
      <ConfirmDialog open={act?.kind === 'retire'} onClose={() => setAct(null)} title={t('m19.xr.adm.retireTitle')} consequence={t('m19.xr.adm.retireBody')} requireReason reasonLabel={t('m19.xr.adm.reason')} danger
        onConfirm={(reason) => act && run(() => repo.rpc.retireExternalResource(act.x.id, reason), { success: t('m19.xr.adm.retired') })} />
    </div>
  );
}

function XEditor({ draft, setDraft, d, criteria, onSave }: { draft: XDraft; setDraft: (x: XDraft | null) => void; d: PwRef; criteria: CriterionRow[]; onSave: () => Promise<void> }) {
  const t = useT();
  const pick = usePick();
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<XDraft>) => setDraft({ ...draft, ...p });
  const c = catalogueCheck(toInput(draft) as Row, criteria, d.skills as unknown as SkillRef[], todayIso());
  return (
    <Drawer open onClose={() => !busy && setDraft(null)} title={draft.id ? t('m19.xr.adm.editTitle') : t('m19.xr.adm.newTitle')}
      footer={<>
        <button type="button" className="btn-outline" onClick={() => setDraft(null)} disabled={busy}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={busy || c.problems.length > 0} data-testid="m19-xadm-save" onClick={async () => { setBusy(true); await onSave(); setBusy(false); }}>{t('m19.xr.adm.saveDraft')}</button>
      </>}>
      <div className="space-y-3" data-testid="m19-xadm-editor">
        <TextField label={t('m19.pw.adm.titleEn')} name="title_en" value={draft.title_en} onChange={(v) => set({ title_en: v })} />
        <TextField label={t('m19.pw.adm.titleAr')} name="title_ar" value={draft.title_ar} onChange={(v) => set({ title_ar: v })} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label={t('m19.xr.adm.providerEn')} name="provider_en" value={draft.provider_en} onChange={(v) => set({ provider_en: v })} />
          <TextField label={t('m19.xr.adm.providerAr')} name="provider_ar" value={draft.provider_ar} onChange={(v) => set({ provider_ar: v })} />
        </div>
        <TextField label={t('m19.xr.adm.providerUrl')} name="provider_url" value={draft.provider_url} onChange={(v) => set({ provider_url: v })} />
        <TextField label={t('m19.xr.adm.url')} name="url" value={draft.url} onChange={(v) => set({ url: v })} />
        <div className="grid grid-cols-3 gap-2">
          <SelectField label={t('m19.xr.fFormat')} name="format" value={draft.format} onChange={(v) => set({ format: v })} options={EXT_FORMATS.map((x) => ({ value: x, label: t(`m19.xr.format.${x}`) }))} />
          <SelectField label={t('m19.xr.fCost')} name="cost" value={draft.cost_band} onChange={(v) => set({ cost_band: v })} options={COST_BANDS.map((x) => ({ value: x, label: t(`m19.xr.cost.${x}`) }))} />
          <TextField type="number" label={t('m19.pw.adm.hours')} name="hours" value={draft.hours} onChange={(v) => set({ hours: v })} />
        </div>
        <TextField label={t('m19.xr.adm.languages')} name="languages" value={draft.languages} onChange={(v) => set({ languages: v })} hint={t('m19.xr.adm.languagesHint')} />
        <TextField label={t('m19.xr.adm.skills')} name="skills" value={draft.skills} onChange={(v) => set({ skills: v })} hint={t('m19.xr.adm.skillsHint')} />
        <TextField type="date" label={t('m19.xr.adm.colAsOf')} name="as_of" value={draft.as_of} onChange={(v) => set({ as_of: v })} />
        <CheckboxField label={t('m19.xr.hasAssessment')} checked={draft.has_assessment} onChange={(v) => set({ has_assessment: v })} />
        <TextArea label={t('m19.xr.adm.summaryEn')} name="summary_en" rows={2} value={draft.summary_en} onChange={(v) => set({ summary_en: v })} />
        <TextArea label={t('m19.xr.adm.summaryAr')} name="summary_ar" rows={2} value={draft.summary_ar} onChange={(v) => set({ summary_ar: v })} />
        <h4 className="caps pt-2">{t('m19.xr.criteriaTitle')}</h4>
        <div className="grid grid-cols-2 gap-2">
          {criteria.map((k) => (
            <SelectField key={k.id} label={pick(k as unknown as Row, 'name')} name={`c-${k.id}`} value={draft.criteria[k.id] ?? ''} onChange={(v) => set({ criteria: { ...draft.criteria, [k.id]: v } })}
              placeholder={t('m19.xr.adm.notScored')} options={[0, 1, 2, 3].map((v) => ({ value: String(v), label: String(v) }))} />
          ))}
        </div>
        <div className={`rounded-card border p-2.5 text-[12.5px] ${c.ok ? 'border-ok/40 bg-ok-bg' : 'border-bad-line bg-bad-bg'}`} role="status" data-testid="m19-xadm-check" data-ok={c.ok ? 'true' : 'false'}>
          {c.ok ? t('m19.xr.adm.checkOk') : <>
            {c.problems.map((p) => <div key={p}>{t(`m19.xr.problem.${p}`)}</div>)}
            {c.failing.map((q) => <div key={q}>{t('m19.xr.adm.failing', { name: pick(criteria.find((k) => k.id === q) as unknown as Row ?? {}, 'name') })}</div>)}
          </>}
        </div>
        <p className="text-[12px] text-ink-3">{t('m19.xr.adm.draftNote')}</p>
      </div>
    </Drawer>
  );
}
