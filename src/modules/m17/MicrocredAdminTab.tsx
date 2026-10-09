// F32 "Micro-credentials" tab on /admin/frameworks (W5 · E1). Framework owners (frameworks W/A: instructors, the training manager,
// admins) manage versioned definitions: new code or new version as a draft, criteria builder (course, assessment, opportunity,
// skill, manual), stacking, alignment, "what it unlocks" roles, validity; publish (the previous version is superseded) or retire.
// The copy check runs as you type and on the server (no FANR certificate, licence or qualification wording). The training manager
// (skills_profile A) approves requests with manual criteria (maker-checker: never their own) and runs the renewal sweep. Auditors read.
import { useMemo, useState } from 'react';
import { Async, BarChart, Callout, Card, ConfirmDialog, DataTable, EmptyState, Grid, Modal, SelectField, StatTile, TextArea, TextField, Icon, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { useSession } from '../../auth/session';
import { CRIT_KINDS, DEF_AREAS, DEF_LEVELS, hasRegulatoryWording, MC_RULES, type AwardRow, type Criterion, type DefInput, type DefRow } from './microcred';
import { McMedal, McStatusPill } from './mcUi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function MicrocredAdminTab() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const canEdit = s.can('frameworks', ['W', 'A']);
  const canDecide = s.can('skills_profile', ['A']);
  const q = useQuery(['microcred_defs', 'microcred_awards', 'people'], async () => {
    const [defs, awards, stats, people, roles, skills, courses, forms, opps, comps] = await Promise.all([
      repo.list('microcred_defs', { order: [['sort', 'asc']] }), canDecide ? repo.list('microcred_awards') : Promise.resolve([]), repo.rpc.microcredStats(),
      canDecide ? repo.list('people', { filter: { kind: 'staff' } }) : Promise.resolve([]), repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('courses'), repo.list('assessment_forms'), repo.list('opportunities').catch(() => []), repo.list('competencies'),
    ]);
    return { defs: defs as unknown as DefRow[], awards: awards as unknown as AwardRow[], stats, people, roles, skills, courses, forms, opps, comps };
  }, [canDecide]);
  return (
    <Async state={q}>
      {(d) => {
        const current = d.defs.filter((x) => x.status === 'current');
        const pending = d.awards.filter((a) => a.status === 'pending_approval');
        const held = d.stats.allowed ? d.stats.rows.reduce((n, r) => n + (r.holders ?? 0), 0) : null;
        return (
          <div className="space-y-5" data-testid="m17-mc-admin">
            <Callout tone="sim" title={t('m17.mc.noticeTitle')}>{t('m17.mc.admin.notice')}</Callout>
            <Grid cols={4}>
              <StatTile label={t('m17.mc.admin.published')} value={f.num(current.length)} sub={t('m17.mc.admin.publishedSub', { stacks: f.num(current.filter((x) => x.kind === 'stack').length) })} />
              <StatTile label={t('m17.mc.admin.drafts')} value={f.num(d.defs.filter((x) => x.status === 'draft').length)} />
              <StatTile label={t('m17.mc.admin.holders')} value={held == null ? '—' : f.num(held)} sub={d.stats.exact ? t('m17.mc.admin.exact') : t('m17.mc.admin.suppressed')} tone="ok" />
              <StatTile label={t('m17.mc.admin.pending')} value={canDecide ? f.num(pending.length) : '—'} tone={pending.length ? 'info' : undefined} />
            </Grid>
            {canDecide && <Approvals pending={pending} d={d} />}
            <Definitions d={d} canEdit={canEdit} canDecide={canDecide} />
            {d.stats.allowed && d.stats.rows.length > 0 && (
              <Card title={t('m17.mc.admin.statsTitle')}>
                <BarChart title={t('m17.mc.admin.statsTitle')} data={d.stats.rows.filter((r) => r.holders != null).map((r) => ({ label: r.code, value: r.holders ?? 0 }))} />
                {!d.stats.exact && <p className="mt-2 text-[12px] text-ink-3">{t('m17.mc.admin.suppressedNote')}</p>}
              </Card>
            )}
          </div>
        );
      }}
    </Async>
  );
}

type AdminData = { defs: DefRow[]; awards: AwardRow[]; people: Row[]; roles: Row[]; skills: Row[]; courses: Row[]; forms: Row[]; opps: Row[]; comps: Row[] };

function Approvals({ pending, d }: { pending: AwardRow[]; d: AdminData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const [sel, setSel] = useState<{ a: AwardRow; decision: 'approve' | 'decline' } | null>(null);
  const name = (id: string) => { const p = d.people.find((x) => x.id === id); return p ? pick({ title_en: p.display_name, title_ar: p.display_name_ar || p.display_name }, 'title') : id; };
  const runSweep = async () => { await act(() => repo.rpc.microcredSweep()); };
  return (
    <Card title={t('m17.mc.admin.approvalsTitle')} actions={<button type="button" className="btn-outline btn-sm" onClick={runSweep} data-testid="m17-mc-sweep">{t('m17.mc.admin.sweep')}</button>}>
      {pending.length === 0 ? <p className="text-[13px] text-ink-3">{t('m17.mc.admin.noPending')}</p> : (
        <ul className="divide-y divide-line" data-testid="m17-mc-approvals">
          {pending.map((a) => {
            const def = d.defs.find((x) => x.id === a.def_id);
            const own = a.person_id === s.identity.personId;
            const ev = (a.evidence as Row[] | undefined) ?? [];
            return (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-testid="m17-mc-approval">
                <div className="min-w-0">
                  <div className="font-semibold">{name(a.person_id)} · {def ? pick(def, 'title') : a.def_code}</div>
                  <div className="text-[12px] text-ink-3">{t('m17.mc.requestedOn', { date: f.date(String(a.requested_at ?? '').slice(0, 10)) })} · <span className="num">{a.def_code} v{a.def_version}</span></div>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {ev.map((c) => <li key={c.key} className={`chip ${c.status === 'met' ? 'border-ok/40 text-ok' : c.kind === 'manual' ? 'border-info/40 text-info' : 'border-line text-ink-3'}`}>{c.kind === 'manual' ? t('m17.mc.admin.manualOpen') : `${c.kind}: ${c.ref}`}</li>)}
                  </ul>
                </div>
                <div className="flex gap-2">
                  {own ? <span className="text-[12px] text-ink-3">{t('m17.mc.admin.ownRequest')}</span> : <>
                    <button type="button" className="btn-primary btn-sm" onClick={() => setSel({ a, decision: 'approve' })} data-testid="m17-mc-approve">{t('m17.mc.admin.approve')}</button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setSel({ a, decision: 'decline' })}>{t('m17.mc.admin.decline')}</button>
                  </>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={!!sel} onClose={() => setSel(null)} title={sel?.decision === 'approve' ? t('m17.mc.admin.approveTitle') : t('m17.mc.admin.declineTitle')}
        consequence={sel?.decision === 'approve' ? t('m17.mc.admin.approveBody') : t('m17.mc.admin.declineBody')} requireReason reasonLabel={t('m17.mc.admin.note')} danger={sel?.decision === 'decline'}
        onConfirm={async (note) => { if (sel) await act(() => repo.rpc.decideMicrocredAward(sel.a.id, sel.decision, note)); }} />
    </Card>
  );
}

function Definitions({ d, canEdit, canDecide }: { d: AdminData; canEdit: boolean; canDecide: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [edit, setEdit] = useState<DefRow | 'new' | null>(null);
  const [status, setStatus] = useState<{ def: DefRow; to: 'current' | 'retired' } | null>(null);
  const cols: Column<DefRow>[] = [
    { key: 'code', header: t('m16.fw.code'), value: (x) => x.code, sortable: true, render: (x) => <span className="flex items-center gap-2"><McMedal code={x.code} status={x.status === 'current' ? 'active' : 'none'} stack={x.kind === 'stack'} size={28} /><code className="ltr">{x.code}</code></span> },
    { key: 'title', header: t('m17.mc.admin.title'), value: (x) => pick(x, 'title'), sortable: true, render: (x) => <span className="font-semibold">{pick(x, 'title')}</span> },
    { key: 'version', header: t('m17.mc.admin.version'), value: (x) => x.version, sortable: true, render: (x) => <span className="num">v{f.num(x.version)}</span> },
    { key: 'status', header: t('m17.mc.col.status'), value: (x) => x.status, sortable: true, render: (x) => <span className="chip border-line text-ink-2" data-status={x.status}>{t(`m17.mc.defStatus.${x.status}`)}</span> },
    { key: 'kind', header: t('m17.mc.admin.kind'), value: (x) => x.kind, render: (x) => t(`m17.mc.kind.${x.kind}`) },
    { key: 'criteria', header: t('m17.mc.admin.criteria'), value: (x) => x.criteria.length, render: (x) => x.kind === 'stack' ? t('m17.mc.admin.parts', { n: f.num(d.defs.filter((y) => y.status === 'current' && y.stacks_into === x.code).length) }) : f.num(x.criteria.length) },
    { key: 'validity', header: t('m17.mc.validity'), value: (x) => x.validity_months, render: (x) => t('m17.mc.months', { n: f.num(x.validity_months) }) },
    { key: 'act', header: '', value: () => '', render: (x) => canEdit ? (
      <span className="flex flex-wrap gap-1">
        {x.status === 'draft' && <><button type="button" className="btn-outline btn-sm" onClick={() => setEdit(x)}>{t('m17.mc.admin.edit')}</button><button type="button" className="btn-primary btn-sm" onClick={() => setStatus({ def: x, to: 'current' })} data-testid="m17-mc-publish">{t('m17.mc.admin.publish')}</button></>}
        {x.status === 'current' && <><button type="button" className="btn-outline btn-sm" onClick={() => setEdit(x)} data-testid="m17-mc-revise">{t('m17.mc.admin.revise')}</button><button type="button" className="btn-ghost btn-sm" onClick={() => setStatus({ def: x, to: 'retired' })}>{t('m17.mc.admin.retire')}</button></>}
      </span>) : null },
  ];
  return (
    <Card title={t('m17.mc.admin.defsTitle')} actions={canEdit ? <button type="button" className="btn-primary btn-sm" onClick={() => setEdit('new')} data-testid="m17-mc-new"><Icon name="plus" size={12} /> {t('m17.mc.admin.new')}</button> : <span className="text-[12px] text-ink-3">{t('m16.fw.readOnly')}</span>}>
      <div data-testid="m17-mc-defs"><DataTable rows={d.defs} columns={cols} rowKey={(x) => x.id} csvName="micro-credentials.csv" /></div>
      {!canDecide && <p className="mt-2 text-[12px] text-ink-3">{t('m17.mc.admin.approvalsTmOnly')}</p>}
      {edit && <DefEditor d={d} base={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!status} onClose={() => setStatus(null)} title={status?.to === 'current' ? t('m17.mc.admin.publishTitle', { code: status.def.code }) : t('m17.mc.admin.retireTitle', { code: status?.def.code ?? '' })}
        consequence={status?.to === 'current' ? t('m17.mc.admin.publishBody') : t('m17.mc.admin.retireBody')} requireReason={status?.to === 'retired'} reasonLabel={t('m17.mc.admin.note')} danger={status?.to === 'retired'}
        onConfirm={async (note) => { if (status) await act(() => repo.rpc.setMicrocredDefStatus(status.def.id, status.to, note || null)); }} />
    </Card>
  );
}

interface CritDraft { key: string; kind: Criterion['kind']; ref: string; min_level: string; label_en: string; label_ar: string }
const blankCrit = (i: number): CritDraft => ({ key: `c${i + 1}`, kind: 'skill', ref: '', min_level: '2', label_en: '', label_ar: '' });

function DefEditor({ d, base, onClose }: { d: AdminData; base: DefRow | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const sec = useMemo(() => new Set(d.comps.filter((c) => c.domain === 'security').map((c) => c.id)), [d.comps]);
  const [x, setX] = useState(() => ({
    code: base?.code ?? 'MC-', kind: base?.kind ?? 'micro', area: base?.area ?? 'digital', level: base?.level ?? 'foundation', title_en: base?.title_en ?? '', title_ar: base?.title_ar ?? '',
    summary_en: base?.summary_en ?? '', summary_ar: base?.summary_ar ?? '', validity_months: String(base?.validity_months ?? 24), hours: base?.hours ? String(base.hours) : '', stacks_into: base?.stacks_into ?? '',
    change_reason: '', role_ids: [...(base?.role_ids ?? [])] as string[],
  }));
  const [crit, setCrit] = useState<CritDraft[]>(() => (base?.criteria ?? []).map((c) => ({ key: c.key, kind: c.kind, ref: c.ref, min_level: String(c.min_level ?? 2), label_en: c.label_en, label_ar: c.label_ar })));
  const [align, setAlign] = useState<{ skill_id: string; level: string }[]>(() => (base?.alignment ?? []).map((a) => ({ skill_id: a.skill_id, level: String(a.level) })));
  const set = (k: string) => (v: string) => setX((p) => ({ ...p, [k]: v }));
  const okSkills = d.skills.filter((s) => s.area !== 'security' && !sec.has(s.competency_id));
  const okCourses = d.courses.filter((c) => !(c.competency_ids ?? []).some((k: string) => sec.has(k)));
  const refOptions = (kind: string) => kind === 'skill' ? okSkills.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'name')}` }))
    : kind === 'course' ? okCourses.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` }))
      : kind === 'assessment' ? d.forms.map((fm) => ({ value: fm.id, label: pick(fm, 'title') }))
        : kind === 'opportunity' ? [...['project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research'].map((k) => ({ value: `kind:${k}`, label: t('m17.mc.admin.oppKind', { kind: k }) })), ...d.opps.map((o) => ({ value: o.id, label: pick(o, 'title') }))] : [];
  const stacks = d.defs.filter((y) => y.kind === 'stack' && y.status !== 'retired' && y.code !== x.code);
  const wording = hasRegulatoryWording(x.title_en, x.title_ar, x.summary_en, x.summary_ar, ...crit.flatMap((c) => [c.label_en, c.label_ar]));
  const input = (): DefInput => ({
    ...(base ? { id: base.id } : {}), code: x.code.trim(), kind: x.kind as DefInput['kind'], area: x.area, level: x.level, title_en: x.title_en, title_ar: x.title_ar, summary_en: x.summary_en, summary_ar: x.summary_ar,
    validity_months: Number(x.validity_months), hours: x.hours ? Number(x.hours) : null, stacks_into: x.kind === 'micro' && x.stacks_into ? x.stacks_into : null, change_reason: x.change_reason || null, role_ids: x.role_ids,
    criteria: crit.map((c) => ({ key: c.key, kind: c.kind, ref: c.kind === 'manual' ? '' : c.ref, min_level: c.kind === 'skill' ? Number(c.min_level) : null, label_en: c.label_en, label_ar: c.label_ar })),
    alignment: align.filter((a) => a.skill_id).map((a) => ({ skill_id: a.skill_id, level: Number(a.level) })),
  });
  const save = async () => { const r = await act(() => repo.rpc.saveMicrocredDef(input())); if (r.ok) onClose(); };
  return (
    <Modal open onClose={onClose} size="lg" title={base ? t('m17.mc.admin.reviseTitle', { code: base.code }) : t('m17.mc.admin.newTitle')}
      footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" onClick={save} data-testid="m17-mc-save">{t('m17.mc.admin.saveDraft')}</button></div>}>
      <div className="space-y-4" data-testid="m17-mc-editor">
        {wording && <Callout tone="bad" title={t('m17.mc.admin.wordingTitle')}>{t('m17.mc.admin.wordingBody')}</Callout>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('m16.fw.code')} name="code" value={x.code} onChange={set('code')} hint={t('m17.mc.admin.codeHint')} />
          <SelectField label={t('m17.mc.admin.kind')} name="kind" value={x.kind} onChange={set('kind')} options={['micro', 'stack'].map((k) => ({ value: k, label: t(`m17.mc.kind.${k}`) }))} />
          <SelectField label={t('m17.mc.admin.area')} name="area" value={x.area} onChange={set('area')} options={DEF_AREAS.map((a) => ({ value: a, label: t(`m17.mc.area.${a}`) }))} />
          <SelectField label={t('m17.mc.admin.level')} name="level" value={x.level} onChange={set('level')} options={DEF_LEVELS.map((a) => ({ value: a, label: t(`m17.mc.level.${a}`) }))} />
          <TextField label={t('m17.mc.admin.titleEn')} name="title_en" value={x.title_en} onChange={set('title_en')} />
          <TextField label={t('m17.mc.admin.titleAr')} name="title_ar" value={x.title_ar} onChange={set('title_ar')} />
          <TextArea label={t('m17.mc.admin.summaryEn')} name="summary_en" value={x.summary_en} onChange={set('summary_en')} rows={2} />
          <TextArea label={t('m17.mc.admin.summaryAr')} name="summary_ar" value={x.summary_ar} onChange={set('summary_ar')} rows={2} />
          <TextField label={t('m17.mc.validity')} name="validity" type="number" value={x.validity_months} onChange={set('validity_months')} hint={t('m17.mc.admin.validityHint', { min: MC_RULES.validityMin, max: MC_RULES.validityMax })} />
          <TextField label={t('m17.mc.hours')} name="hours" type="number" value={x.hours} onChange={set('hours')} />
          {x.kind === 'micro' && <SelectField label={t('m17.mc.admin.stacksInto')} name="stacks" value={x.stacks_into} onChange={set('stacks_into')} placeholder={t('m17.mc.admin.noStack')} options={stacks.map((y) => ({ value: y.code, label: `${y.code} · ${pick(y, 'title')}` }))} />}
          {base && <TextField label={t('m17.mc.admin.changeReason')} name="reason" value={x.change_reason} onChange={set('change_reason')} />}
        </div>
        <fieldset className="space-y-2">
          <legend className="caps">{t('m17.mc.admin.criteriaTitle')}</legend>
          {x.kind === 'stack' && <p className="text-[12.5px] text-ink-3">{t('m17.mc.admin.stackHelp')}</p>}
          {crit.map((c, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-card border border-line p-2 sm:grid-cols-6" data-testid="m17-mc-crit-row">
              <SelectField label={t('m17.mc.admin.critKind')} name={`k${i}`} value={c.kind} onChange={(v) => setCrit((p) => p.map((y, j) => (j === i ? { ...y, kind: v as Criterion['kind'], ref: '' } : y)))} options={CRIT_KINDS.map((k) => ({ value: k, label: t(`m17.mc.critKind.${k}`) }))} />
              {c.kind !== 'manual' ? <div className="sm:col-span-3"><SelectField label={t('m17.mc.admin.critRef')} name={`r${i}`} value={c.ref} onChange={(v) => setCrit((p) => p.map((y, j) => (j === i ? { ...y, ref: v } : y)))} placeholder="—" options={refOptions(c.kind)} /></div> : <p className="self-end text-[12px] text-ink-3 sm:col-span-3">{t('m17.mc.admin.manualHelp')}</p>}
              {c.kind === 'skill' ? <SelectField label={t('m17.mc.admin.minLevel')} name={`l${i}`} value={c.min_level} onChange={(v) => setCrit((p) => p.map((y, j) => (j === i ? { ...y, min_level: v } : y)))} options={['1', '2', '3', '4'].map((v) => ({ value: v, label: v }))} /> : <span />}
              <button type="button" className="btn-ghost btn-sm self-end" onClick={() => setCrit((p) => p.filter((_, j) => j !== i))}>{t('m17.mc.admin.remove')}</button>
              <div className="sm:col-span-3"><TextField label={t('m17.mc.admin.labelEn')} name={`le${i}`} value={c.label_en} onChange={(v) => setCrit((p) => p.map((y, j) => (j === i ? { ...y, label_en: v } : y)))} /></div>
              <div className="sm:col-span-3"><TextField label={t('m17.mc.admin.labelAr')} name={`la${i}`} value={c.label_ar} onChange={(v) => setCrit((p) => p.map((y, j) => (j === i ? { ...y, label_ar: v } : y)))} /></div>
            </div>
          ))}
          {crit.length < MC_RULES.maxCriteria && <button type="button" className="btn-outline btn-sm" onClick={() => setCrit((p) => [...p, blankCrit(p.length)])} data-testid="m17-mc-add-crit"><Icon name="plus" size={12} /> {t('m17.mc.admin.addCrit')}</button>}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="caps">{t('m17.mc.admin.alignTitle')}</legend>
          {align.map((a, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              <div className="sm:col-span-4"><SelectField label={t('m17.mc.admin.skill')} name={`as${i}`} value={a.skill_id} onChange={(v) => setAlign((p) => p.map((y, j) => (j === i ? { ...y, skill_id: v } : y)))} placeholder="—" options={okSkills.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'name')}` }))} /></div>
              <SelectField label={t('m17.mc.admin.level')} name={`al${i}`} value={a.level} onChange={(v) => setAlign((p) => p.map((y, j) => (j === i ? { ...y, level: v } : y)))} options={['1', '2'].map((v) => ({ value: v, label: v }))} />
              <button type="button" className="btn-ghost btn-sm self-end" onClick={() => setAlign((p) => p.filter((_, j) => j !== i))}>{t('m17.mc.admin.remove')}</button>
            </div>
          ))}
          {align.length < MC_RULES.maxAlignment && <button type="button" className="btn-outline btn-sm" onClick={() => setAlign((p) => [...p, { skill_id: '', level: '1' }])}><Icon name="plus" size={12} /> {t('m17.mc.admin.addAlign')}</button>}
        </fieldset>
        <fieldset>
          <legend className="caps mb-1">{t('m17.mc.admin.rolesTitle')}</legend>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {d.roles.map((r) => {
              const on = x.role_ids.includes(r.id);
              return <button key={r.id} type="button" aria-pressed={on} className={`chip ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink-2'}`}
                onClick={() => setX((p) => ({ ...p, role_ids: on ? p.role_ids.filter((y) => y !== r.id) : p.role_ids.length < MC_RULES.maxRoles ? [...p.role_ids, r.id] : p.role_ids }))}>{pick(r, 'title')}</button>;
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

export function McAdminEmpty() {
  const t = useT();
  return <EmptyState title={t('m17.mc.admin.empty')} />;
}
export { McStatusPill };
