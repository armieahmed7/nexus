// FS38 /admin/next-gen (frameworks W/A: instructors, the training manager, admins): maintain the SMR delta overlay. A table of every
// delta (drafts too) with role, technology, rank, status and version; an editor for one delta (the seven dimensions, what changes and
// what stays in English and Arabic, skills at level 1-3, links to existing delta training, https sources) that runs the same check as
// the server (deltaProblem) before saving; saving goes through rpc.saveSmrDelta (versioned, audited, ledger on publish). Security,
// safeguards and cyber roles stay path-only. Text may not claim headcount, sites or deployment: no deployment decision implied.
import { useMemo, useState } from 'react';
import { Page, Card, Async, Callout, EmptyState, DataTable, Drawer, ConfirmDialog, StatusPill, BenchmarkChips, SelectField, TextField, TextArea, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { DIMENSIONS, DELTA_STATUSES, TRAINING_KINDS, PATH_ONLY_FAMILIES, deltaProblem, type DeltaInput } from './nextgen';
import { NoDeployNote, TechName, useNgRef, type RefData, type Row } from './ui';

export default function AdminNextGenPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useNgRef();
  const q = useQuery(['smr_deltas'], () => repo.list('smr_deltas', { order: [['sort', 'asc']] } as never) as Promise<Row[]>, []);
  return (
    <Page title={t('m31.routes.admin-next-gen.title')} intro={t('m31.adm.intro')} wide eyebrow={<BenchmarkChips feature="FS38" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(rows) => <Body d={d} rows={rows} />}</Async>}</Async>
    </Page>
  );
}

const blank = (role: string, tech: string): DeltaInput & { id?: string } => ({
  role_id: role, tech_id: tech, rank: 4, status: 'draft', dims: [], changes_en: '', changes_ar: '', stays_en: '', stays_ar: '', skills: [], training: [], sources: [],
});

function Body({ d, rows }: { d: RefData; rows: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [edit, setEdit] = useState<(DeltaInput & { id?: string; version?: number }) | null>(null);
  const [addRole, setAddRole] = useState('');
  const [addTech, setAddTech] = useState('');
  const exists = rows.some((r) => r.role_id === addRole && r.tech_id === addTech);
  const counts = { published: rows.filter((r) => r.status === 'published').length, draft: rows.filter((r) => r.status === 'draft').length };
  return (
    <div className="space-y-5" data-testid="m31-adm">
      <Callout tone="info" title={t('m31.adm.rulesTitle')}>{t('m31.adm.rulesBody')}</Callout>
      <p className="text-[13px] text-ink-2">{t('m31.adm.counts', { pub: f.num(counts.published), draft: f.num(counts.draft), roles: f.num(new Set(rows.map((r) => r.role_id)).size) })}</p>
      <Card title={t('m31.adm.addTitle')}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs"><SelectField label={t('m31.pub.role')} name="add-role" value={addRole} onChange={setAddRole} options={d.roles.map((r) => ({ value: r.id, label: pick(r, 'title') }))} /></div>
          <div className="min-w-0 flex-1 sm:max-w-xs"><SelectField label={t('m31.pub.tech')} name="add-tech" value={addTech} onChange={setAddTech} options={d.techs.map((x) => ({ value: x.id, label: pick(x, 'family') }))} /></div>
          <button type="button" className="btn-primary" disabled={!addRole || !addTech || exists} data-testid="m31-adm-add"
            onClick={() => setEdit({ ...blank(addRole, addTech), path_only: PATH_ONLY_FAMILIES.includes(d.roleById.get(addRole)?.family_id) })}><Icon name="plus" size={14} /> {t('m31.adm.add')}</button>
          {exists && <span className="text-[12.5px] text-ink-3">{t('m31.adm.exists')}</span>}
        </div>
      </Card>
      <DataTable rows={rows} rowKey={(r) => r.id} csvName="smr-deltas" initialSort={{ key: 'role', dir: 'asc' }}
        onRowClick={(r) => setEdit({ id: r.id, version: r.version, role_id: r.role_id, tech_id: r.tech_id, rank: r.rank, status: r.status, path_only: r.path_only, dims: r.dims, changes_en: r.changes_en, changes_ar: r.changes_ar, stays_en: r.stays_en, stays_ar: r.stays_ar, skills: r.skills, training: r.training, sources: r.sources })}
        columns={[
          { key: 'role', header: t('m31.pub.role'), value: (r) => pick(d.roleById.get(r.role_id), 'title') || r.role_id, sortable: true },
          { key: 'tech', header: t('m31.pub.tech'), value: (r) => pick(d.techById.get(r.tech_id), 'family') || r.tech_id, sortable: true },
          { key: 'rank', header: t('m31.adm.rank'), value: (r) => r.rank, sortable: true, align: 'end' },
          { key: 'dims', header: t('m31.adm.dims'), value: (r) => (r.dims ?? []).length, align: 'end' },
          { key: 'status', header: t('m31.adm.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'published' ? 'ok' : r.status === 'draft' ? 'sim' : 'neutral'}>{t(`m31.adm.st.${r.status}`)}</StatusPill>, sortable: true },
          { key: 'version', header: t('m31.adm.version'), value: (r) => r.version, align: 'end' },
          { key: 'as_of', header: t('m31.adm.asOf'), value: (r) => r.as_of, render: (r) => f.date(r.as_of) },
        ]} />
      {edit && <Editor key={edit.id ?? `${edit.role_id}|${edit.tech_id}`} d={d} init={edit} onClose={() => setEdit(null)} />}
      <NoDeployNote />
    </div>
  );
}

function Editor({ d, init, onClose }: { d: RefData; init: DeltaInput & { id?: string; version?: number }; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const [v, setV] = useState<DeltaInput>({ ...init, dims: [...(init.dims ?? [])], skills: [...(init.skills ?? [])], training: [...(init.training ?? [])], sources: [...(init.sources ?? [])] });
  const [confirm, setConfirm] = useState(false);
  const role = d.roleById.get(v.role_id);
  const pathOnly = PATH_ONLY_FAMILIES.includes(role?.family_id);
  const ctx = useMemo(() => ({
    family: role?.family_id ?? null,
    skills: Object.fromEntries([...d.skills.values()].map((x) => [x.id, { area: x.area ?? null, lifecycle: x.lifecycle ?? null }])),
    refs: {
      microcred: [...d.training.values()].filter((x) => x.kind === 'microcred').map((x) => x.ref), course: [...d.training.values()].filter((x) => x.kind === 'course').map((x) => x.ref),
      pathway: [...d.training.values()].filter((x) => x.kind === 'pathway' && x.status === 'published').map((x) => x.ref), lane: [...d.training.values()].filter((x) => x.kind === 'lane').map((x) => x.ref),
    },
  }), [d, role]);
  const input: DeltaInput = { ...v, path_only: pathOnly, rank: Number(v.rank) };
  const problem = deltaProblem(input, ctx);
  const setDim = (dim: string, patch: Partial<{ change: string; text_en: string; text_ar: string }>) => {
    const cur = v.dims.find((x) => x.dim === dim);
    if (patch.change === 'same') { setV({ ...v, dims: v.dims.filter((x) => x.dim !== dim) }); return; }
    const next = { dim, change: cur?.change ?? 'adapts', text_en: cur?.text_en ?? '', text_ar: cur?.text_ar ?? '', ...patch };
    setV({ ...v, dims: DIMENSIONS.flatMap((x) => (x === dim ? [next] : v.dims.filter((y) => y.dim === x))) });
  };
  const save = async () => {
    const r = await act(() => repo.rpc.saveSmrDelta(input));
    setConfirm(false);
    if (r.ok) onClose();
  };
  const skillOpts = [...d.skills.values()].filter((x) => x.lifecycle !== 'obsolete' && x.area !== 'security').map((x) => ({ value: x.id, label: pick(x, 'name') })).sort((a, b) => a.label.localeCompare(b.label));
  const trainingOpts = (kind: string) => [...d.training.values()].filter((x) => x.kind === kind && (kind !== 'pathway' || x.status === 'published')).map((x) => ({ value: x.ref, label: pick(x, 'title') || x.ref }));
  return (
    <Drawer open onClose={onClose} title={<span>{pick(role, 'title')} · <TechName d={d} id={v.tech_id} /></span>}
      footer={<div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[12.5px] ${problem ? 'text-bad' : 'text-ok'}`} role="status" data-testid="m31-adm-check" data-problem={problem ?? ''}>{problem ? t(`m31.adm.problem.${problem}`) : t('m31.adm.ready')}</span>
        <div className="flex gap-2"><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={!!problem || !s.identity.personId} data-testid="m31-adm-save" onClick={() => setConfirm(true)}>{t('m31.adm.save')}</button></div>
      </div>}>
      <div className="space-y-4" data-testid="m31-adm-editor">
        {init.version != null && <p className="text-[12.5px] text-ink-3">{t('m31.adm.editing', { v: init.version })}</p>}
        {pathOnly && <Callout tone="info" title={t('m31.ng.pathOnly.title')}>{t('m31.adm.pathOnly')}</Callout>}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label={t('m31.adm.rank')} name="rank" value={String(v.rank)} onChange={(x) => setV({ ...v, rank: Number(x) })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))} />
          <SelectField label={t('m31.adm.status')} name="status" value={v.status} onChange={(x) => setV({ ...v, status: x })} options={DELTA_STATUSES.map((x) => ({ value: x, label: t(`m31.adm.st.${x}`) }))} />
        </div>
        <TextArea label={t('m31.adm.changesEn')} name="changes_en" rows={3} value={v.changes_en} onChange={(x) => setV({ ...v, changes_en: x })} />
        <TextArea label={t('m31.adm.changesAr')} name="changes_ar" rows={3} value={v.changes_ar} onChange={(x) => setV({ ...v, changes_ar: x })} />
        <TextArea label={t('m31.adm.staysEn')} name="stays_en" rows={2} value={v.stays_en} onChange={(x) => setV({ ...v, stays_en: x })} />
        <TextArea label={t('m31.adm.staysAr')} name="stays_ar" rows={2} value={v.stays_ar} onChange={(x) => setV({ ...v, stays_ar: x })} />
        <fieldset className="space-y-2" data-testid="m31-adm-dims">
          <legend className="text-[13px] font-semibold">{t('m31.ng.dimsTitle')}</legend>
          {DIMENSIONS.map((dim) => {
            const cur = v.dims.find((x) => x.dim === dim);
            return (
              <div key={dim} className="rounded-md border border-line p-2">
                <SelectField label={t(`m31.ng.dim.${dim}`)} name={`dim-${dim}`} value={cur?.change ?? 'same'} onChange={(x) => setDim(dim, { change: x || 'same' })}
                  options={['same', 'adapts', 'new'].map((c) => ({ value: c, label: t(`m31.ng.change.${c}`) }))} />
                {cur && <div className="mt-2 grid grid-cols-1 gap-2">
                  <TextArea label={t('m31.adm.textEn')} name={`dim-${dim}-en`} rows={2} value={cur.text_en} onChange={(x) => setDim(dim, { text_en: x })} />
                  <TextArea label={t('m31.adm.textAr')} name={`dim-${dim}-ar`} rows={2} value={cur.text_ar} onChange={(x) => setDim(dim, { text_ar: x })} />
                </div>}
              </div>
            );
          })}
        </fieldset>
        {!pathOnly && (
          <fieldset className="space-y-2" data-testid="m31-adm-skills">
            <legend className="text-[13px] font-semibold">{t('m31.ng.skillsTitle')}</legend>
            {v.skills.map((x, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1"><SelectField label={t('m31.adm.skill')} name={`skill-${i}`} value={x.skill_id} options={skillOpts} onChange={(id) => setV({ ...v, skills: v.skills.map((y, j) => (j === i ? { ...y, skill_id: id } : y)) })} /></div>
                <div className="w-24"><SelectField label={t('m31.adm.level')} name={`level-${i}`} value={String(x.level)} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} onChange={(l) => setV({ ...v, skills: v.skills.map((y, j) => (j === i ? { ...y, level: Number(l) } : y)) })} /></div>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setV({ ...v, skills: v.skills.filter((_, j) => j !== i) })}>{t('m31.adm.remove')}</button>
              </div>
            ))}
            {v.skills.length < 8 && <button type="button" className="btn-outline btn-sm" onClick={() => setV({ ...v, skills: [...v.skills, { skill_id: '', level: 1 }] })}>{t('m31.adm.addSkill')}</button>}
          </fieldset>
        )}
        <fieldset className="space-y-2" data-testid="m31-adm-training">
          <legend className="text-[13px] font-semibold">{t('m31.ng.trainingTitle')}</legend>
          {v.training.map((x, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="w-36"><SelectField label={t('m31.adm.kind')} name={`tk-${i}`} value={x.kind} options={TRAINING_KINDS.map((k) => ({ value: k, label: t(`m31.ng.trainingKind.${k}`) }))} onChange={(k) => setV({ ...v, training: v.training.map((y, j) => (j === i ? { kind: k, ref: '' } : y)) })} /></div>
              <div className="min-w-0 flex-1"><SelectField label={t('m31.adm.item')} name={`tr-${i}`} value={x.ref} options={trainingOpts(x.kind)} onChange={(r) => setV({ ...v, training: v.training.map((y, j) => (j === i ? { ...y, ref: r } : y)) })} /></div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setV({ ...v, training: v.training.filter((_, j) => j !== i) })}>{t('m31.adm.remove')}</button>
            </div>
          ))}
          {v.training.length < 8 && <button type="button" className="btn-outline btn-sm" onClick={() => setV({ ...v, training: [...v.training, { kind: 'course', ref: '' }] })}>{t('m31.adm.addTraining')}</button>}
        </fieldset>
        <fieldset className="space-y-2" data-testid="m31-adm-sources">
          <legend className="text-[13px] font-semibold">{t('m31.ng.sources')}</legend>
          {v.sources.map((x, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-line p-2">
              <TextField label={t('m31.adm.srcLabel')} name={`sl-${i}`} value={x.label} onChange={(l) => setV({ ...v, sources: v.sources.map((y, j) => (j === i ? { ...y, label: l } : y)) })} />
              <TextField label={t('m31.adm.srcUrl')} name={`su-${i}`} type="url" value={x.url} onChange={(u) => setV({ ...v, sources: v.sources.map((y, j) => (j === i ? { ...y, url: u } : y)) })} />
              <TextField label={t('m31.adm.srcAsOf')} name={`sa-${i}`} type="date" value={x.as_of ?? ''} onChange={(a) => setV({ ...v, sources: v.sources.map((y, j) => (j === i ? { ...y, as_of: a } : y)) })} />
              <div><button type="button" className="btn-ghost btn-sm" onClick={() => setV({ ...v, sources: v.sources.filter((_, j) => j !== i) })}>{t('m31.adm.remove')}</button></div>
            </div>
          ))}
          {v.sources.length < 6 && <button type="button" className="btn-outline btn-sm" onClick={() => setV({ ...v, sources: [...v.sources, { label: '', url: 'https://', as_of: '' }] })}>{t('m31.adm.addSource')}</button>}
        </fieldset>
        <NoDeployNote />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m31.adm.confirmTitle')} onConfirm={save}
        consequence={v.status === 'published' ? t('m31.adm.confirmPublish', { v: (init.version ?? 0) + 1 }) : t('m31.adm.confirmDraft', { v: (init.version ?? 0) + 1 })} />
    </Drawer>
  );
}
