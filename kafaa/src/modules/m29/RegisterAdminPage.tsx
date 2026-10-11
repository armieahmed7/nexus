// FS36 /admin/ai-register (ai_literacy A: admin / AI governance): maintain the AI-literacy register. Every entry (drafts and retired
// included) with its status, label, version and computed coverage; an editor for a new or existing entry with its user groups
// (rpc.saveAiSystem behind a ConfirmDialog: versioned, audited, ledger on publish). The server refuses compliance or certification
// wording and a "fully implemented" label below 80% coverage; coverage is never typed in.
import { useState } from 'react';
import { Page, Async, EmptyState, BenchmarkChips, DataTable, Drawer, ConfirmDialog, TextField, TextArea, SelectField, CheckboxField, StatusPill, Icon, Callout, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { AI_ROLES, MATURITIES, MEASURE_KINDS, SIDES, SYSTEM_STATUSES, USE_CLASSES, type GroupInput, type MeasureInput, type SystemInput } from './register';
import { CoverageBar, LabelCheck, MaturityPill, RoleChip, useRegister, type RegisterData } from './fs36ui';
import type { Row } from './ui';

export default function RegisterAdminPage() {
  const t = useT();
  const q = useRegister();
  const repo = useRepo();
  const staff = useQuery(['people'], () => (repo.list('people', { filter: { kind: 'staff', status: 'active' }, order: [['display_name', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]), []);
  return (
    <Page title={t('m29.routes.admin-ai-register.title')} intro={t('m29.adm.intro')} wide eyebrow={<BenchmarkChips feature="FS36" />}
      actions={<L to="/workforce/ai-register" className="btn-outline btn-sm no-underline">{t('m29.adm.toRegister')}</L>}>
      <Async state={q}>{(d) => <Body d={d} staff={staff.data ?? []} reload={q.reload} />}</Async>
    </Page>
  );
}

const MEASURE_PRESET: Record<string, { ref: string | null; en: string; ar: string }> = {
  ladder: { ref: null, en: 'AI fluency ladder: the rung each group needs', ar: 'سلّم الطلاقة في الذكاء الاصطناعي: الدرجة التي تحتاجها كل مجموعة' },
  check: { ref: null, en: 'Quarterly AI and digital fitness check', ar: 'فحص اللياقة الرقمية والذكاء الاصطناعي الفصلي' },
  drill: { ref: null, en: 'Sandbox drills: catch a wrong AI output', ar: 'تمارين البيئة التجريبية: اكتشاف مخرجات الذكاء الاصطناعي الخاطئة' },
  course: { ref: 'c-ai-gov', en: 'Governed use of AI tools (course)', ar: 'الاستخدام المحوكم لأدوات الذكاء الاصطناعي (دورة)' },
  briefing: { ref: null, en: 'Briefing by the system owner', ar: 'إحاطة من مالك النظام' },
};
const blankGroup = (): GroupInput => ({ label_en: '', label_ar: '', family_ids: [], all_staff: true, side: 'deployer', required_rung: 1, required_cells: [], rationale_en: '', rationale_ar: '' });
const blank = (): SystemInput => ({ name_en: '', name_ar: '', purpose_en: '', purpose_ar: '', ai_role: 'deployer', use_class: 'information', maturity: 'planned', simulated: true, owner_person_id: '',
  oversight_en: '', oversight_ar: '', measures: [{ kind: 'ladder', ref: null, title_en: MEASURE_PRESET.ladder.en, title_ar: MEASURE_PRESET.ladder.ar }], groups: [blankGroup()], status: 'draft', review_due: null });
const fromRow = (s: Row, groups: Row[]): SystemInput => ({
  id: s.id, name_en: s.name_en, name_ar: s.name_ar, purpose_en: s.purpose_en, purpose_ar: s.purpose_ar, ai_role: s.ai_role, use_class: s.use_class, maturity: s.maturity, simulated: !!s.simulated,
  owner_person_id: s.owner_person_id, oversight_en: s.oversight_en, oversight_ar: s.oversight_ar, measures: (s.measures ?? []).map((m: Row) => ({ ...m })), status: s.status, review_due: s.review_due ? String(s.review_due).slice(0, 10) : null,
  groups: groups.filter((g) => g.system_id === s.id).map((g) => ({ id: g.id, label_en: g.label_en, label_ar: g.label_ar, family_ids: [...(g.family_ids ?? [])], all_staff: !!g.all_staff, side: g.side,
    required_rung: Number(g.required_rung), required_cells: [...(g.required_cells ?? [])], rationale_en: g.rationale_en ?? '', rationale_ar: g.rationale_ar ?? '' })),
});

function Body({ d, staff, reload }: { d: RegisterData; staff: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [edit, setEdit] = useState<SystemInput | null>(null);
  const covOf = (id: string) => d.cov?.systems.find((x) => x.system_id === id);
  const cols: Column<Row>[] = [
    { key: 'name', header: t('m29.adm.col.name'), value: (s) => pick(s, 'name'), render: (s) => <L to={`/workforce/ai-register/${s.id}`} className="font-semibold">{pick(s, 'name')}</L>, sortable: true },
    { key: 'status', header: t('m29.adm.col.status'), value: (s) => s.status, render: (s) => <StatusPill status={s.status} />, sortable: true },
    { key: 'role', header: t('m29.adm.col.role'), value: (s) => s.ai_role, render: (s) => <RoleChip role={s.ai_role} /> },
    { key: 'maturity', header: t('m29.adm.col.maturity'), value: (s) => s.maturity, render: (s) => <span className="flex flex-wrap gap-1"><MaturityPill maturity={s.maturity} /><LabelCheck sc={covOf(s.id)} /></span> },
    { key: 'cov', header: t('m29.adm.col.cov'), value: (s) => covOf(s.id)?.pct ?? -1, render: (s) => <div className="min-w-[9rem]">{s.status === 'retired' ? '—' : <CoverageBar c={covOf(s.id) ?? null} label={pick(s, 'name')} compact />}</div> },
    { key: 'version', header: t('m29.adm.col.version'), value: (s) => Number(s.version), render: (s) => f.num(Number(s.version)), align: 'end' },
    { key: 'edit', header: '', value: () => '', render: (s) => <button type="button" className="btn-ghost btn-sm" data-testid="m29-adm-edit" onClick={() => setEdit(fromRow(s, d.groups))}>{t('m29.adm.edit')}</button> },
  ];
  return (
    <div className="space-y-4">
      <Callout tone="info" title={t('m29.adm.rules.title')}>{t('m29.adm.rules.body')}</Callout>
      <div className="flex justify-end"><button type="button" className="btn-primary btn-sm" data-testid="m29-adm-add" onClick={() => setEdit(blank())}><Icon name="plus" size={14} /> {t('m29.adm.add')}</button></div>
      <div data-testid="m29-adm-table">
        {d.systems.length ? <DataTable rows={d.systems} columns={cols} rowKey={(s) => s.id} searchable={false} caption={t('m29.routes.admin-ai-register.title')} csvName="ai-register.csv" /> : <EmptyState title={t('m29.reg.none')} />}
      </div>
      {edit && <Editor init={edit} d={d} staff={staff} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload?.(); }} />}
    </div>
  );
}

function Editor({ init, d, staff, onClose, onSaved }: { init: SystemInput; d: RegisterData; staff: Row[]; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [v, setV] = useState<SystemInput>(init);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof SystemInput>(k: K, x: SystemInput[K]) => setV((o) => ({ ...o, [k]: x }));
  const setG = (i: number, patch: Partial<GroupInput>) => setV((o) => ({ ...o, groups: o.groups.map((g, k) => (k === i ? { ...g, ...patch } : g)) }));
  const hasMeasure = (k: string) => v.measures.some((m) => m.kind === k);
  const toggleMeasure = (k: string, on: boolean) => set('measures', on ? [...v.measures, { kind: k, ref: MEASURE_PRESET[k].ref, title_en: MEASURE_PRESET[k].en, title_ar: MEASURE_PRESET[k].ar } as MeasureInput] : v.measures.filter((m) => m.kind !== k));
  const opts = (xs: readonly string[], prefix: string) => xs.map((x) => ({ value: x, label: t(`${prefix}.${x}`) }));
  return (
    <Drawer open onClose={onClose} title={init.id ? t('m29.adm.editTitle') : t('m29.adm.addTitle')}
      footer={<><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" data-testid="m29-adm-save" onClick={() => setConfirm(true)}>{t('m29.adm.save')}</button></>}>
      <div className="space-y-3" data-testid="m29-adm-editor">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TextField label={t('m29.adm.f.name_en')} name="name_en" value={v.name_en} onChange={(x) => set('name_en', x)} />
          <TextField label={t('m29.adm.f.name_ar')} name="name_ar" value={v.name_ar} onChange={(x) => set('name_ar', x)} />
        </div>
        <TextArea label={t('m29.adm.f.purpose_en')} name="purpose_en" rows={2} value={v.purpose_en} onChange={(x) => set('purpose_en', x)} />
        <TextArea label={t('m29.adm.f.purpose_ar')} name="purpose_ar" rows={2} value={v.purpose_ar} onChange={(x) => set('purpose_ar', x)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectField label={t('m29.adm.f.role')} name="ai_role" value={v.ai_role} options={opts(AI_ROLES, 'm29.reg.role')} onChange={(x) => set('ai_role', x)} />
          <SelectField label={t('m29.adm.f.use')} name="use_class" value={v.use_class} options={opts(USE_CLASSES, 'm29.reg.use')} onChange={(x) => set('use_class', x)} />
          <SelectField label={t('m29.adm.f.maturity')} name="maturity" value={v.maturity} options={opts(MATURITIES, 'm29.reg.maturity')} onChange={(x) => set('maturity', x)} hint={t('m29.adm.f.maturityHint')} />
          <SelectField label={t('m29.adm.f.status')} name="status" value={v.status} options={SYSTEM_STATUSES.map((x) => ({ value: x, label: t(`common.status.${x}`) }))} onChange={(x) => set('status', x)} />
          <SelectField label={t('m29.adm.f.owner')} name="owner" value={v.owner_person_id} placeholder={t('m29.adm.f.ownerPick')} options={staff.map((p) => ({ value: p.id, label: pick(p, 'display_name') }))} onChange={(x) => set('owner_person_id', x)} />
          <TextField label={t('m29.adm.f.review')} name="review_due" type="date" value={v.review_due ?? ''} onChange={(x) => set('review_due', x || null)} />
        </div>
        <CheckboxField label={t('m29.adm.f.simulated')} checked={v.simulated} onChange={(x) => set('simulated', x)} />
        <TextArea label={t('m29.adm.f.oversight_en')} name="oversight_en" rows={2} value={v.oversight_en} onChange={(x) => set('oversight_en', x)} />
        <TextArea label={t('m29.adm.f.oversight_ar')} name="oversight_ar" rows={2} value={v.oversight_ar} onChange={(x) => set('oversight_ar', x)} />
        <fieldset className="space-y-1">
          <legend className="caps mb-1">{t('m29.adm.f.measures')}</legend>
          {MEASURE_KINDS.map((k) => <CheckboxField key={k} label={t(`m29.adm.measure.${k}`)} checked={hasMeasure(k)} onChange={(on) => toggleMeasure(k, on)} />)}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="caps mb-1">{t('m29.adm.f.groups')}</legend>
          {v.groups.map((g, i) => (
            <div key={i} className="space-y-2 rounded-card border border-line p-3" data-testid="m29-adm-group">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <TextField label={t('m29.adm.f.label_en')} name={`g${i}en`} value={g.label_en} onChange={(x) => setG(i, { label_en: x })} />
                <TextField label={t('m29.adm.f.label_ar')} name={`g${i}ar`} value={g.label_ar} onChange={(x) => setG(i, { label_ar: x })} />
                <SelectField label={t('m29.adm.f.side')} name={`g${i}side`} value={g.side} options={opts(SIDES, 'm29.reg.side')} onChange={(x) => setG(i, { side: x })} />
                <SelectField label={t('m29.adm.f.rung')} name={`g${i}rung`} value={String(g.required_rung)} options={[1, 2, 3, 4].map((r) => ({ value: String(r), label: t(`m29.rung.${['aware', 'practitioner', 'builder', 'assurer'][r - 1]}`) }))}
                  onChange={(x) => setG(i, { required_rung: Number(x), required_cells: g.required_cells.filter((c) => (d.cells.find((y) => y.id === c)?.rung ?? 0) > Number(x)) })} />
              </div>
              <CheckboxField label={t('m29.reg.allStaff')} checked={g.all_staff} onChange={(x) => setG(i, { all_staff: x, family_ids: x ? [] : g.family_ids })} />
              {!g.all_staff && (
                <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                  {d.families.map((fm) => <CheckboxField key={fm.id} label={pick(fm, 'name')} checked={g.family_ids.includes(fm.id)} onChange={(on) => setG(i, { family_ids: on ? [...g.family_ids, fm.id] : g.family_ids.filter((x) => x !== fm.id) })} />)}
                </div>
              )}
              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                {d.cells.filter((c) => Number(c.rung) > g.required_rung).sort((a, b) => a.rung - b.rung || String(a.id).localeCompare(String(b.id))).map((c) => (
                  <CheckboxField key={c.id} label={t('m29.target.plus', { rung: t(`m29.rung.${c.rung_key}`), dim: t(`m29.dim.${c.dimension}`) })} checked={g.required_cells.includes(c.id)}
                    onChange={(on) => setG(i, { required_cells: on ? [...g.required_cells, c.id] : g.required_cells.filter((x) => x !== c.id) })} />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <TextField label={t('m29.adm.f.rationale_en')} name={`g${i}ren`} value={g.rationale_en ?? ''} onChange={(x) => setG(i, { rationale_en: x })} />
                <TextField label={t('m29.adm.f.rationale_ar')} name={`g${i}rar`} value={g.rationale_ar ?? ''} onChange={(x) => setG(i, { rationale_ar: x })} />
              </div>
              {v.groups.length > 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => set('groups', v.groups.filter((_, k) => k !== i))}>{t('m29.adm.removeGroup')}</button>}
            </div>
          ))}
          {v.groups.length < 8 && <button type="button" className="btn-outline btn-sm" data-testid="m29-adm-add-group" onClick={() => set('groups', [...v.groups, blankGroup()])}><Icon name="plus" size={14} /> {t('m29.adm.addGroup')}</button>}
        </fieldset>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m29.adm.confirm.title')} consequence={t(v.status === 'published' ? 'm29.adm.confirm.publish' : 'm29.adm.confirm.draft')}
        onConfirm={async () => { const r = await act(() => repo.rpc.saveAiSystem(v)); setConfirm(false); if (r.ok) onSaved(); }} />
    </Drawer>
  );
}
