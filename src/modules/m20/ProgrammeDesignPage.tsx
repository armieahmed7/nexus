// /opportunities/rotations/design (M20 · F15): HR programme owners (CHCO office, HR analysts, training manager) design rotation
// templates (placement sequence, host role cards, durations, skill objectives, sources), create cohorts and enrol people.
// Security, cyber and safeguards placements are never offered (career path only) and are refused by the backend.
import { useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Tabs, Callout, Icon, Modal, StatusPill, ConfirmDialog } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { MAX_OBJECTIVES, MAX_STEPS, PROGRAMMES, RESTRICTED_FAMILIES, RESTRICTED_SKILL_AREAS, ROT_LEVEL_CAP, totalMonths, type StepInput, type TemplateInput } from './rotation';
import { useRotations, useRotLabels, ProgrammeChip, PlacementRail, stepsOf, todayIso, type RotData, type RotLabels, type Template } from './rotUi';
import { EnrolForm } from './rotEnrol';

export default function ProgrammeDesignPage() {
  const t = useT();
  const { q, me } = useRotations();
  return (
    <Page title={t('m20.routes.rotations-design.title')} intro={t('m20.rot.design.intro')} wide
      actions={<L to="/opportunities/rotations/board" className="btn-outline btn-sm"><Icon name="chart" size={14} />{t('m20.rot.hub.board')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Design d={d} me={me} />}</Async>
    </Page>
  );
}

const blankStep = (): StepInput => ({ family_id: '', host_team_en: '', host_team_ar: '', host_role_id: null, host_manager_id: null, months: 3, site_induction: undefined, objectives: [{ skill_id: '', level: 2, text_en: '', text_ar: '' }] });
const blank = (): TemplateInput => ({ programme: 'cross_functional', title_en: '', title_ar: '', summary_en: '', summary_ar: '', duration_min_months: 6, duration_max_months: 12, steps: [blankStep()], eligible_families: [], source_ids: [], status: 'draft' });
const toInput = (x: Template): TemplateInput => ({
  id: x.id, programme: x.programme, title_en: x.title_en, title_ar: x.title_ar, summary_en: x.summary_en, summary_ar: x.summary_ar, duration_min_months: x.duration_min_months, duration_max_months: x.duration_max_months,
  steps: stepsOf(x).map((s) => ({ family_id: s.family_id, host_team_en: s.host_team_en, host_team_ar: s.host_team_ar, host_role_id: s.host_role_id, host_manager_id: s.host_manager_id, months: s.months, site_induction: s.site_induction, objectives: s.objectives.map((o) => ({ ...o })) })),
  eligible_families: [...(x.eligible_families ?? [])], source_ids: ((x.sources as unknown as { id: string }[]) ?? []).map((s) => s.id), status: x.status as TemplateInput['status'],
});

function Design({ d, me }: { d: RotData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const s = useSession();
  const [edit, setEdit] = useState<TemplateInput | null>(null);
  const [enrolFor, setEnrolFor] = useState<string>(d.templates.find((x) => x.status === 'active')?.id ?? '');
  const tm = s.roles.includes('training_manager');
  const enrolTpl = d.templates.find((x) => x.id === enrolFor);
  return (
    <div className="space-y-6">
      <Callout title={t('m20.rot.design.rulesTitle')}>{t('m20.rot.design.rulesBody')}</Callout>
      <Tabs tabs={[
        { id: 'programmes', label: t('m20.rot.design.tabProgrammes'), badge: f.num(d.templates.length), content: (
          <Section title={t('m20.rot.design.programmes')} actions={<button className="btn-primary btn-sm" onClick={() => setEdit(blank())} data-testid="m20-rot-new-programme"><Icon name="plus" size={14} />{t('m20.rot.design.new')}</button>}>
            <ul className="space-y-3" data-testid="m20-rot-design-list">
              {d.templates.map((x) => (
                <li key={x.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap gap-1.5"><ProgrammeChip programme={x.programme} /><StatusPill status={x.status} tone={x.status === 'active' ? 'ok' : 'neutral'}>{t(`m20.rot.tplStatus.${x.status}`)}</StatusPill></div>
                      <L to={`/opportunities/rotations/programmes/${x.id}`} className="text-[15px] font-semibold">{pick(x, 'title')}</L>
                      <div className="text-[12.5px] text-ink-3">{t('m20.rot.common.duration', { min: f.num(x.duration_min_months), max: f.num(x.duration_max_months) })} · {t('m20.rot.common.placements', { n: f.num(stepsOf(x).length), m: f.num(totalMonths(stepsOf(x))) })}</div>
                    </div>
                    {(x.owner_id === me || tm) && <button className="btn-outline btn-sm" onClick={() => setEdit(toInput(x))} data-testid="m20-rot-edit">{t('m20.rot.design.edit')}</button>}
                  </div>
                  <div className="mt-3"><PlacementRail lab={lab} steps={stepsOf(x).map((st) => ({ key: `${x.id}-${st.seq}`, family_id: st.family_id, months: st.months, title: pick(st as unknown as Record<string, unknown>, 'host_team') }))} /></div>
                </li>
              ))}
            </ul>
          </Section>
        ) },
        { id: 'cohorts', label: t('m20.rot.design.tabCohorts'), badge: f.num(d.cohorts.length), content: <Cohorts d={d} lab={lab} /> },
        { id: 'enrol', label: t('m20.rot.design.tabEnrol'), content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card title={t('m20.rot.design.pickProgramme')}>
              <select className="input" value={enrolFor} onChange={(e) => setEnrolFor(e.target.value)} data-testid="m20-rot-enrol-programme">
                {d.templates.filter((x) => x.status === 'active').map((x) => <option key={x.id} value={x.id}>{pick(x, 'title')}</option>)}
              </select>
            </Card>
            {enrolTpl ? <EnrolForm key={enrolTpl.id} d={d} tpl={enrolTpl} lab={lab} /> : <EmptyState icon="grad" title={t('m20.rot.design.noActive')} />}
          </div>
        ) },
      ]} />
      {edit && <Editor d={d} lab={lab} value={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Cohorts({ d, lab }: { d: RotData; lab: RotLabels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const active = d.templates.filter((x) => x.status !== 'retired');
  const [tpl, setTpl] = useState(active[0]?.id ?? '');
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [intake, setIntake] = useState(todayIso());
  const [confirm, setConfirm] = useState(false);
  const valid = !!tpl && en.trim().length >= 3 && ar.trim().length >= 3 && !!intake;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ul className="space-y-2" data-testid="m20-rot-cohort-list">
        {d.cohorts.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel p-3">
            <div className="min-w-0"><div className="mb-1"><ProgrammeChip programme={c.programme} /></div><div className="font-semibold">{pick(c, 'name')}</div><div className="text-[12.5px] text-ink-3">{lab.template(c.template_id)} · {t('m20.rot.board.intake', { d: f.date(c.intake_on) })}</div></div>
            <StatusPill status={c.status} tone={c.status === 'running' ? 'info' : 'neutral'}>{t(`m20.rot.cohortStatus.${c.status}`)}</StatusPill>
          </li>
        ))}
      </ul>
      <Card title={t('m20.rot.design.newCohort')}>
        <div className="space-y-3">
          <label className="block"><span className="caps">{t('m20.rot.design.programme')}</span><select className="input mt-1" value={tpl} onChange={(e) => setTpl(e.target.value)}>{active.map((x) => <option key={x.id} value={x.id}>{pick(x, 'title')}</option>)}</select></label>
          <label className="block"><span className="caps">{t('m20.rot.design.nameEn')}</span><input className="input mt-1" value={en} onChange={(e) => setEn(e.target.value)} data-testid="m20-rot-cohort-en" /></label>
          <label className="block"><span className="caps">{t('m20.rot.design.nameAr')}</span><input className="input mt-1" dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} data-testid="m20-rot-cohort-ar" /></label>
          <label className="block"><span className="caps">{t('m20.rot.design.intake')}</span><input type="date" className="input mt-1" value={intake} onChange={(e) => setIntake(e.target.value)} /></label>
          <button className="btn-primary w-full" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m20-rot-cohort-save">{t('m20.rot.design.createCohort')}</button>
        </div>
        <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.rot.design.createCohort')} consequence={t('m20.rot.design.cohortBody')} actingAs={t('m20.rot.common.owner')}
          onConfirm={async () => { const r = await run(() => repo.rpc.saveRotationCohort({ template_id: tpl, name_en: en.trim(), name_ar: ar.trim(), intake_on: intake })); if (r.ok) { setEn(''); setAr(''); } }} />
      </Card>
    </div>
  );
}

function Editor({ d, lab, value, onClose }: { d: RotData; lab: RotLabels; value: TemplateInput; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [v, setV] = useState<TemplateInput>(value);
  const [busy, setBusy] = useState(false);
  const hq = useQuery(['people', 'role_assignments'], () => repo.rpc.rotationCandidates(null));
  const srcq = useQuery('sources', () => repo.list('sources', { order: [['label', 'asc']] }));
  const hosts = (hq.data ?? []).filter((c) => c.can_host);
  const fams = d.families.filter((x) => !RESTRICTED_FAMILIES.includes(x.id));
  const skills = d.skills.filter((x) => !RESTRICTED_SKILL_AREAS.includes(x.area));
  const set = (patch: Partial<TemplateInput>) => setV((c) => ({ ...c, ...patch }));
  const setStep = (i: number, patch: Partial<StepInput>) => setV((c) => ({ ...c, steps: c.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const total = totalMonths(v.steps);
  const inRange = total >= v.duration_min_months && total <= v.duration_max_months;
  const save = async () => {
    setBusy(true);
    try { const r = await run(() => repo.rpc.saveRotationTemplate({ ...v, steps: v.steps.map((s) => ({ ...s, host_manager_id: s.host_manager_id || null, host_role_id: s.host_role_id || null })) })); if (r.ok) onClose(); } finally { setBusy(false); }
  };
  const field = (label: string, el: JSX.Element) => <label className="block"><span className="caps">{label}</span><div className="mt-1">{el}</div></label>;
  return (
    <Modal open onClose={() => !busy && onClose()} size="lg" title={v.id ? t('m20.rot.design.editTitle') : t('m20.rot.design.newTitle')}
      footer={<>
        <span className={`me-auto text-[12.5px] ${inRange ? 'text-ink-3' : 'text-bad'}`}>{t('m20.rot.design.total', { n: f.num(total), min: f.num(v.duration_min_months), max: f.num(v.duration_max_months) })}</span>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy} onClick={save} data-testid="m20-rot-save-programme">{busy ? t('common.working') : t('m20.rot.design.save')}</button>
      </>}>
      <div className="space-y-4" data-testid="m20-rot-editor">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {field(t('m20.rot.design.programme'), <select className="input" value={v.programme} onChange={(e) => set({ programme: e.target.value })}>{PROGRAMMES.map((p) => <option key={p} value={p}>{t(`m20.rot.programme.${p}`)}</option>)}</select>)}
          {field(t('m20.rot.design.status'), <select className="input" value={v.status} onChange={(e) => set({ status: e.target.value as TemplateInput['status'] })}>{(['draft', 'active', 'retired'] as const).map((s) => <option key={s} value={s}>{t(`m20.rot.tplStatus.${s}`)}</option>)}</select>)}
          <div className="grid grid-cols-2 gap-2">
            {field(t('m20.rot.design.min'), <input type="number" min={1} max={48} className="input" value={v.duration_min_months} onChange={(e) => set({ duration_min_months: Number(e.target.value) })} />)}
            {field(t('m20.rot.design.max'), <input type="number" min={1} max={48} className="input" value={v.duration_max_months} onChange={(e) => set({ duration_max_months: Number(e.target.value) })} />)}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field(t('m20.rot.design.titleEn'), <input className="input" value={v.title_en} onChange={(e) => set({ title_en: e.target.value })} data-testid="m20-rot-title-en" />)}
          {field(t('m20.rot.design.titleAr'), <input className="input" dir="rtl" value={v.title_ar} onChange={(e) => set({ title_ar: e.target.value })} data-testid="m20-rot-title-ar" />)}
          {field(t('m20.rot.design.summaryEn'), <textarea className="input" rows={3} value={v.summary_en} onChange={(e) => set({ summary_en: e.target.value })} />)}
          {field(t('m20.rot.design.summaryAr'), <textarea className="input" dir="rtl" rows={3} value={v.summary_ar} onChange={(e) => set({ summary_ar: e.target.value })} />)}
        </div>
        <fieldset>
          <legend className="caps mb-1">{t('m20.rot.design.eligible')}</legend>
          <div className="flex flex-wrap gap-1.5">{fams.map((x) => { const on = (v.eligible_families ?? []).includes(x.id); return <button key={x.id} type="button" aria-pressed={on} className={`btn-sm ${on ? 'btn-primary' : 'btn-outline'}`} onClick={() => set({ eligible_families: on ? (v.eligible_families ?? []).filter((y) => y !== x.id) : [...(v.eligible_families ?? []), x.id] })}>{pick(x, 'name')}</button>; })}</div>
          <p className="mt-1 text-[12px] text-ink-3">{t('m20.rot.design.eligibleHint')}</p>
        </fieldset>
        <label className="block"><span className="caps">{t('m20.rot.design.sources')}</span>
          <select className="input mt-1" value="" onChange={(e) => { const id = e.target.value; if (id && !(v.source_ids ?? []).includes(id)) set({ source_ids: [...(v.source_ids ?? []), id] }); }}>
            <option value="">{t('m20.rot.design.addSource')}</option>
            {(srcq.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <span className="mt-1 flex flex-wrap gap-1.5">{(v.source_ids ?? []).map((id) => <button key={id} type="button" className="chip border-line bg-sunken text-ink-2" onClick={() => set({ source_ids: (v.source_ids ?? []).filter((x) => x !== id) })}>{(srcq.data ?? []).find((s) => s.id === id)?.label ?? id} <Icon name="close" size={10} /></button>)}</span>
        </label>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><span className="caps">{t('m20.rot.design.steps', { n: v.steps.length, max: MAX_STEPS })}</span>
            <button className="btn-outline btn-sm" disabled={v.steps.length >= MAX_STEPS} onClick={() => set({ steps: [...v.steps, blankStep()] })}><Icon name="plus" size={13} />{t('m20.rot.design.addStep')}</button></div>
          {v.steps.map((s, i) => (
            <div key={i} className="rounded-card border border-line p-3" data-testid="m20-rot-step">
              <div className="mb-2 flex items-center justify-between"><span className="font-semibold">{t('m20.rot.my.placementN', { n: f.num(i + 1) })}</span>{v.steps.length > 1 && <button className="btn-ghost btn-sm" onClick={() => set({ steps: v.steps.filter((_, j) => j !== i) })}>{t('m20.rot.design.removeStep')}</button>}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {field(t('m20.rot.design.family'), <select className="input" value={s.family_id} onChange={(e) => setStep(i, { family_id: e.target.value })}><option value="">—</option>{fams.map((x) => <option key={x.id} value={x.id}>{pick(x, 'name')}</option>)}</select>)}
                {field(t('m20.rot.design.months'), <input type="number" min={1} max={12} className="input" value={s.months} onChange={(e) => setStep(i, { months: Number(e.target.value) })} />)}
                {field(t('m20.rot.design.hostRole'), <select className="input" value={s.host_role_id ?? ''} onChange={(e) => setStep(i, { host_role_id: e.target.value || null })}><option value="">—</option>{d.roles.map((r) => <option key={r.id} value={r.id}>{pick(r, 'title')}</option>)}</select>)}
                {field(t('m20.rot.design.hostTeamEn'), <input className="input" value={s.host_team_en} onChange={(e) => setStep(i, { host_team_en: e.target.value })} />)}
                {field(t('m20.rot.design.hostTeamAr'), <input className="input" dir="rtl" value={s.host_team_ar} onChange={(e) => setStep(i, { host_team_ar: e.target.value })} />)}
                {field(t('m20.rot.design.hostManager'), <select className="input" value={s.host_manager_id ?? ''} onChange={(e) => setStep(i, { host_manager_id: e.target.value || null })}><option value="">{t('m20.rot.design.hostDefault')}</option>{hosts.map((h) => <option key={h.id} value={h.id}>{pick({ name_en: h.display_name, name_ar: h.display_name_ar }, 'name')}</option>)}</select>)}
              </div>
              <label className="mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={s.site_induction ?? false} onChange={(e) => setStep(i, { site_induction: e.target.checked })} />{t('m20.rot.design.site')}</label>
              <div className="mt-2 space-y-2">
                {s.objectives.map((o, k) => (
                  <div key={k} className="grid grid-cols-1 gap-2 rounded-btn bg-sunken/50 p-2 sm:grid-cols-[1fr_90px_1fr_1fr_auto]">
                    <select className="input" aria-label={t('m20.rot.design.skill')} value={o.skill_id} onChange={(e) => setStep(i, { objectives: s.objectives.map((x, m) => (m === k ? { ...x, skill_id: e.target.value } : x)) })}><option value="">{t('m20.rot.design.skill')}</option>{skills.map((x) => <option key={x.id} value={x.id}>{lab.skill(x.id)}</option>)}</select>
                    <select className="input" aria-label={t('m20.rot.design.level')} value={o.level} onChange={(e) => setStep(i, { objectives: s.objectives.map((x, m) => (m === k ? { ...x, level: Number(e.target.value) } : x)) })}>{Array.from({ length: ROT_LEVEL_CAP }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{t('m20.rot.common.target', { n })}</option>)}</select>
                    <input className="input" aria-label={t('m20.rot.design.objEn')} placeholder={t('m20.rot.design.objEn')} value={o.text_en} onChange={(e) => setStep(i, { objectives: s.objectives.map((x, m) => (m === k ? { ...x, text_en: e.target.value } : x)) })} />
                    <input className="input" dir="rtl" aria-label={t('m20.rot.design.objAr')} placeholder={t('m20.rot.design.objAr')} value={o.text_ar} onChange={(e) => setStep(i, { objectives: s.objectives.map((x, m) => (m === k ? { ...x, text_ar: e.target.value } : x)) })} />
                    <button className="btn-ghost btn-sm" disabled={s.objectives.length <= 1} aria-label={t('m20.rot.design.removeObjective')} onClick={() => setStep(i, { objectives: s.objectives.filter((_, m) => m !== k) })}><Icon name="close" size={12} /></button>
                  </div>
                ))}
                <button className="btn-ghost btn-sm" disabled={s.objectives.length >= MAX_OBJECTIVES} onClick={() => setStep(i, { objectives: [...s.objectives, { skill_id: '', level: 2, text_en: '', text_ar: '' }] })}><Icon name="plus" size={12} />{t('m20.rot.design.addObjective')}</button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-ink-3">{t('m20.rot.design.restricted')}</p>
      </div>
    </Modal>
  );
}
