/** F28 simulator scenario library (W4 · E3): shared view helpers, the scenario editor and the crew debrief form. Module-local. */
import { useMemo, useState, type ReactNode } from 'react';
import { Callout, CheckboxField, ConfirmDialog, Drawer, Icon, KeyValue, Modal, ProgressBar, RadioGroup, SelectField, StatusPill, TextArea, TextField, type PillTone } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { CompetenciesRow, SimCycleItemsRow, SimCyclesRow, SimObjectivesRow, SimScenariosRow, SimulatorSlotsRow } from '../../data/types';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import {
  DIMENSIONS, SECURITY_COMPETENCIES, SIM_CATEGORIES, SIM_FIDELITY, SIM_POSITIONS, SIM_PROGRAMMES, contentIssue, crewRoster, evidenceLevel, meanScore, slotCheck,
  type CycleLite, type DebriefLite, type Dimension, type ScenarioInput, type ScenarioLite,
} from './scenarios';
import type { SimDebriefView } from './backend/simulator.rpc';
import { usePeople } from './ui';

export const CAT_TONE: Record<string, PillTone> = { normal: 'neutral', abnormal: 'info', emergency: 'bad', severe_accident: 'reserved', team: 'ok' };
export const SCN_TONE: Record<string, PillTone> = { draft: 'neutral', in_review: 'sim', approved: 'ok', retired: 'neutral', submitted: 'info', closed: 'neutral' };
export const COVER_TONE: Record<string, PillTone> = { covered: 'ok', under: 'sim', missing: 'bad' };

export function useSimLabels() {
  const t = useT();
  return useMemo(() => ({
    cat: (c: string) => t(`m04.scn.cat.${c}`), pos: (p: string) => t(`m04.scn.pos.${p}`), fid: (f: string) => t(`m04.scn.fid.${f}`), prog: (p: string) => t(`m04.scn.prog.${p}`),
    status: (s: string) => t(`m04.scn.st.${s}`), dim: (d: string) => t(`m04.scn.dim.${d}`), cover: (c: string) => t(`m04.scn.cover.${c}`),
  }), [t]);
}
export function CatChip({ c }: { c: string }) {
  const l = useSimLabels();
  return <StatusPill tone={CAT_TONE[c] ?? 'neutral'}>{l.cat(c)}</StatusPill>;
}
export function ScnStatus({ s }: { s: string }) {
  const l = useSimLabels();
  return <StatusPill status={s} tone={SCN_TONE[s]}>{l.status(s)}</StatusPill>;
}

export interface SimLibrary {
  objectives: SimObjectivesRow[]; scenarios: SimScenariosRow[]; cycles: SimCyclesRow[]; items: SimCycleItemsRow[]; competencies: CompetenciesRow[];
  objMap: Map<string, SimObjectivesRow>; scMap: Map<string, ScenarioLite & SimScenariosRow>; compMap: Map<string, CompetenciesRow>;
}
/** The library as the repository returns it (row rules apply: training staff only). */
export function useSimLibrary() {
  const repo = useRepo();
  return useQuery(['sim_objectives', 'sim_scenarios', 'sim_cycles', 'sim_cycle_items', 'competencies'], async (): Promise<SimLibrary> => {
    const [objectives, scenarios, cycles, items, competencies] = await Promise.all([
      repo.list('sim_objectives', { order: [['sort', 'asc']] }), repo.list('sim_scenarios', { order: [['code', 'asc']] }), repo.list('sim_cycles', { order: [['starts_on', 'asc']] }),
      repo.list('sim_cycle_items'), repo.list('competencies', { order: [['code', 'asc']] }),
    ]);
    return {
      objectives, scenarios, cycles, items, competencies,
      objMap: new Map(objectives.map((o) => [o.id, o])), scMap: new Map(scenarios.map((s) => [s.id, s as ScenarioLite & SimScenariosRow])), compMap: new Map(competencies.map((c) => [c.id, c])),
    };
  }, []);
}
export function useSimDebriefs() {
  const repo = useRepo();
  return useQuery(['crew_debriefs', 'crew_debrief_members'], () => repo.rpc.simDebriefs(), []);
}
export const asDebriefLite = (d: SimDebriefView): DebriefLite => ({ id: d.id, cycle_id: d.cycle_id, scenario_id: d.scenario_id, held_on: d.held_on, crew: d.crew, ratings: d.ratings, self_ratings: d.self_ratings });
export const asCycle = (c: SimCyclesRow): CycleLite => ({ ...c, requirements: (c.requirements as unknown as CycleLite['requirements']) ?? [] });
/** The cycle in force on a date for a programme (the latest one that covers it). */
export const cycleOn = (cycles: SimCyclesRow[], programme: string, day: string) => cycles.filter((c) => c.programme === programme && c.starts_on <= day && c.ends_on >= day).sort((a, b) => (a.starts_on < b.starts_on ? 1 : -1))[0] ?? null;

/** Instructor team ratings against the crew's self-ratings, per team competency. */
export function RatingBars({ ratings, self }: { ratings: Record<string, number>; self?: Record<string, number> | null }) {
  const t = useT();
  const l = useSimLabels();
  const f = useFormat();
  return (
    <div className="space-y-2" data-testid="m04-scn-ratings">
      {DIMENSIONS.map((d) => (
        <div key={d} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-2 text-[12.5px]">
          <span className="truncate font-medium">{l.dim(d)}</span>
          <div className="space-y-1">
            <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><ProgressBar value={(ratings[d] ?? 0) * 20} label={`${t('m04.scn.deb.instructor')} ${l.dim(d)}`} /></div><span className="num w-14 text-end">{f.num(ratings[d])} / {f.num(5)}</span></div>
            {self && <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><ProgressBar value={(self[d] ?? 0) * 20} tone="sim" label={`${t('m04.scn.deb.self')} ${l.dim(d)}`} /></div><span className="num w-14 text-end text-ink-3">{f.num(self[d])} / {f.num(5)}</span></div>}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-[11.5px] text-ink-3">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-accent" />{t('m04.scn.deb.instructor')}</span>
        {self && <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-sim" />{t('m04.scn.deb.self')}</span>}
      </div>
    </div>
  );
}

/** Content-check notice shown while typing (the server repeats the same check). */
export function ContentIssueNote({ texts }: { texts: string[] }) {
  const t = useT();
  const issue = contentIssue(texts);
  if (!issue) return null;
  return <Callout tone="bad" title={t('m04.scn.issue.title')}><span data-testid="m04-scn-issue">{t(`m04.scn.issue.${issue}`)}</span></Callout>;
}

// ───────────── scenario editor (saveSimScenario)
type Form = { title_en: string; title_ar: string; summary_en: string; summary_ar: string; events_en: string; events_ar: string; category: string; objective_ids: string[]; competency_ids: string[]; positions: string[]; duration_min: string; fidelity: string; programmes: string[] };
const emptyForm: Form = { title_en: '', title_ar: '', summary_en: '', summary_ar: '', events_en: '', events_ar: '', category: 'abnormal', objective_ids: [], competency_ids: [], positions: ['ss', 'sro', 'ro'], duration_min: '120', fidelity: 'full_scope', programmes: ['coct'] };
const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

export function ScenarioEditor({ open, onClose, lib, initial, onSaved }: { open: boolean; onClose: () => void; lib: SimLibrary; initial?: SimScenariosRow | null; onSaved?: (id: string) => void }) {
  const t = useT();
  const pick = usePick();
  const l = useSimLabels();
  const repo = useRepo();
  const run = useAction();
  const [f, setF] = useState<Form>(() => initial ? {
    title_en: initial.title_en, title_ar: initial.title_ar, summary_en: initial.summary_en, summary_ar: initial.summary_ar, events_en: initial.events_en ?? '', events_ar: initial.events_ar ?? '',
    category: initial.category, objective_ids: [...initial.objective_ids], competency_ids: [...initial.competency_ids], positions: [...initial.positions], duration_min: String(initial.duration_min),
    fidelity: initial.fidelity, programmes: [...initial.programmes],
  } : emptyForm);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const auto = new Set(f.objective_ids.map((o) => lib.objMap.get(o)?.competency_id).filter(Boolean) as string[]);
  const texts = [f.title_en, f.title_ar, f.summary_en, f.summary_ar, f.events_en, f.events_ar];
  const blocked = !!contentIssue(texts);
  const save = async (submit: boolean) => {
    setBusy(true);
    const input: ScenarioInput = { ...f, id: initial?.id ?? null, purpose: 'training', duration_min: Number(f.duration_min), submit };
    const r = await run(() => repo.rpc.saveSimScenario(input));
    setBusy(false);
    if (r.ok) { onSaved?.(r.data!.id); onClose(); }
  };
  const grouped = [...SIM_CATEGORIES, 'team'].map((c) => ({ c, list: lib.objectives.filter((o) => o.category === c && o.active) }));
  return (
    <Modal open={open} onClose={onClose} size="lg" title={initial ? t('m04.scn.edit.titleEdit', { code: initial.code }) : t('m04.scn.edit.titleNew')}
      footer={<>
        <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-outline" disabled={busy || blocked} onClick={() => save(false)} data-testid="m04-scn-save-draft">{t('m04.scn.edit.saveDraft')}</button>
        <button className="btn-primary" disabled={busy || blocked} onClick={() => save(true)} data-testid="m04-scn-submit">{t('m04.scn.edit.submit')}</button>
      </>}>
      <div className="space-y-4" data-testid="m04-scn-editor">
        <Callout tone="info" title={t('m04.scn.edit.purposeTitle')}>{t('m04.scn.edit.purposeBody')}</Callout>
        {initial?.status === 'approved' && <Callout tone="sim" title={t('m04.scn.edit.revisionTitle')}>{t('m04.scn.edit.revisionBody', { n: initial.revision + 1 })}</Callout>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('m04.scn.edit.titleEn')} name="title_en" value={f.title_en} onChange={(v) => set({ title_en: v })} required />
          <TextField label={t('m04.scn.edit.titleAr')} name="title_ar" value={f.title_ar} onChange={(v) => set({ title_ar: v })} required />
          <TextArea label={t('m04.scn.edit.summaryEn')} name="summary_en" value={f.summary_en} onChange={(v) => set({ summary_en: v })} rows={3} required />
          <TextArea label={t('m04.scn.edit.summaryAr')} name="summary_ar" value={f.summary_ar} onChange={(v) => set({ summary_ar: v })} rows={3} required />
          <TextArea label={t('m04.scn.edit.eventsEn')} name="events_en" value={f.events_en} onChange={(v) => set({ events_en: v })} rows={2} hint={t('m04.scn.edit.eventsHint')} />
          <TextArea label={t('m04.scn.edit.eventsAr')} name="events_ar" value={f.events_ar} onChange={(v) => set({ events_ar: v })} rows={2} />
        </div>
        <ContentIssueNote texts={texts} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField label={t('m04.scn.f.category')} name="category" value={f.category} onChange={(v) => set({ category: v })} options={SIM_CATEGORIES.map((c) => ({ value: c, label: l.cat(c) }))} />
          <TextField label={t('m04.scn.f.duration')} name="duration_min" type="number" value={f.duration_min} onChange={(v) => set({ duration_min: v })} hint={t('m04.scn.edit.durationHint')} />
          <SelectField label={t('m04.scn.f.fidelity')} name="fidelity" value={f.fidelity} onChange={(v) => set({ fidelity: v })} options={SIM_FIDELITY.map((x) => ({ value: x, label: l.fid(x) }))} />
        </div>
        <fieldset>
          <legend className="text-[13px] font-semibold">{t('m04.scn.f.positions')}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4">{SIM_POSITIONS.map((p) => <CheckboxField key={p} label={l.pos(p)} checked={f.positions.includes(p)} onChange={(on) => set({ positions: toggle(f.positions, p, on) })} />)}</div>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-semibold">{t('m04.scn.f.programmes')}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4">{SIM_PROGRAMMES.map((p) => <CheckboxField key={p} label={l.prog(p)} checked={f.programmes.includes(p)} onChange={(on) => set({ programmes: toggle(f.programmes, p, on) })} />)}</div>
        </fieldset>
        <fieldset data-testid="m04-scn-objectives-picker">
          <legend className="text-[13px] font-semibold">{t('m04.scn.f.objectives')} <span className="font-normal text-ink-3">({t('m04.scn.edit.picked', { n: f.objective_ids.length })})</span></legend>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {grouped.filter((g) => g.list.length).map((g) => (
              <div key={g.c} className="rounded-btn border border-line p-2">
                <div className="mb-1"><CatChip c={g.c} /></div>
                {g.list.map((o) => <CheckboxField key={o.id} label={<span><span className="ltr me-1 text-ink-3">{o.code}</span>{pick(o, 'title')}</span>} checked={f.objective_ids.includes(o.id)} onChange={(on) => set({ objective_ids: toggle(f.objective_ids, o.id, on) })} />)}
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-semibold">{t('m04.scn.f.competencies')}</legend>
          <p className="text-[12px] text-ink-3">{t('m04.scn.edit.compHint')}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {lib.competencies.filter((c) => !SECURITY_COMPETENCIES.includes(c.id)).map((c) => {
              const on = auto.has(c.id) || f.competency_ids.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} disabled={auto.has(c.id)} onClick={() => set({ competency_ids: toggle(f.competency_ids, c.id, !f.competency_ids.includes(c.id)) })}
                  className={`chip ${on ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-2'} disabled:opacity-80`} title={pick(c, 'name')}>
                  <span className="ltr">{c.code}</span>{auto.has(c.id) && <Icon name="check" size={11} />}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

// ───────────── crew debrief form (recordDebrief)
/** Booked crew slots that have started (the ones a debrief can be recorded for), newest first. */
export function debriefableSlots(slots: SimulatorSlotsRow[], nowIso = new Date().toISOString()) {
  return slots.filter((s) => !slotCheck(s as never, nowIso)).sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1));
}

export function DebriefForm({ open, onClose, lib, slots, initialSlot, onSaved }: { open: boolean; onClose: () => void; lib: SimLibrary; slots: SimulatorSlotsRow[]; initialSlot?: string | null; onSaved?: (id: string) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const l = useSimLabels();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const options = debriefableSlots(slots);
  const [slotId, setSlotId] = useState(initialSlot ?? options[0]?.id ?? '');
  const slot = options.find((s) => s.id === slotId) ?? null;
  const day = slot ? slot.starts_at.slice(0, 10) : '';
  const approved = lib.scenarios.filter((s) => s.status === 'approved');
  const [scenarioId, setScenarioId] = useState(approved[0]?.id ?? '');
  const scenario = lib.scMap.get(scenarioId) ?? null;
  const autoCycle = scenario && day ? scenario.programmes.map((p) => cycleOn(lib.cycles, p, day)).find(Boolean) ?? null : null;
  const roster = useMemo(() => (slot ? crewRoster(slot, people.list as never) : []), [slot, people.list]);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<Dimension, number>>({ communication: 3, procedure_use: 3, diagnosis: 3, leadership: 3 });
  const [withSelf, setWithSelf] = useState(true);
  const [self, setSelf] = useState<Record<Dimension, number>>({ communication: 3, procedure_use: 3, diagnosis: 3, leadership: 3 });
  const [txt, setTxt] = useState({ strengths: '', improvements: '', critique: '' });
  const [confirm, setConfirm] = useState(false);
  const present = roster.filter((r) => !absent.has(r.person_id));
  const perPerson = DIMENSIONS.filter((d) => evidenceLevel(ratings[d]) > 0).length;
  const texts = [txt.strengths, txt.improvements, txt.critique];
  const canSave = !!slot && !!scenario && present.length > 0 && !contentIssue(texts);
  const submit = async () => {
    const r = await run(() => repo.rpc.recordDebrief({
      slot_id: slot!.id, scenario_id: scenario!.id, cycle_id: autoCycle?.id ?? null, attendance: roster.map((m) => ({ person_id: m.person_id, present: !absent.has(m.person_id) })),
      ratings, self_ratings: withSelf ? self : null, ...txt, lang,
    }), { success: t('m04.scn.deb.saved', { n: present.length * perPerson }) });
    if (r.ok) { onSaved?.(r.data!.id); onClose(); }
  };
  const scale = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: <span className="num">{f.num(n)}</span> }));
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('m04.scn.deb.formTitle')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!canSave} onClick={() => setConfirm(true)} data-testid="m04-scn-deb-save">{t('m04.scn.deb.record')}</button></>}>
      {!options.length ? <Callout tone="info" title={t('m04.scn.deb.noSlotsTitle')}>{t('m04.scn.deb.noSlots')}</Callout> : (
        <div className="space-y-4" data-testid="m04-scn-debrief-form">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label={t('m04.scn.deb.slot')} name="slot" value={slotId} onChange={(v) => { setSlotId(v); setAbsent(new Set()); }}
              options={options.map((s) => ({ value: s.id, label: `${f.date(s.starts_at)} · ${s.simulator} · ${t('m04.common.crew')} ${s.crew}` }))} />
            <SelectField label={t('m04.scn.deb.scenario')} name="scenario" value={scenarioId} onChange={setScenarioId} options={approved.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'title')}` }))} />
          </div>
          <p className="text-[12.5px] text-ink-2">{autoCycle ? t('m04.scn.deb.cycleAuto', { cycle: pick(autoCycle, 'label') }) : t('m04.scn.deb.cycleNone')}</p>
          <fieldset data-testid="m04-scn-attendance">
            <legend className="text-[13px] font-semibold">{t('m04.scn.deb.attendance', { crew: slot?.crew ?? '—' })}</legend>
            <p className="text-[12px] text-ink-3">{t('m04.scn.deb.attendanceHint')}</p>
            <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {roster.map((m) => (
                <CheckboxField key={m.person_id} label={<span>{people.name(m.person_id)} <span className="text-ink-3">· {l.pos(m.position)}</span></span>} checked={!absent.has(m.person_id)}
                  onChange={(on) => setAbsent((s) => { const n = new Set(s); if (on) n.delete(m.person_id); else n.add(m.person_id); return n; })} />
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-btn border border-line p-3">
              <div className="caps">{t('m04.scn.deb.instructorRatings')}</div>
              {DIMENSIONS.map((d) => <RadioGroup key={d} label={l.dim(d)} name={`r-${d}`} value={String(ratings[d])} onChange={(v) => setRatings((x) => ({ ...x, [d]: Number(v) }))} options={scale} />)}
            </div>
            <div className="space-y-2 rounded-btn border border-line p-3">
              <CheckboxField label={t('m04.scn.deb.withSelf')} checked={withSelf} onChange={setWithSelf} />
              {withSelf && DIMENSIONS.map((d) => <RadioGroup key={d} label={l.dim(d)} name={`s-${d}`} value={String(self[d])} onChange={(v) => setSelf((x) => ({ ...x, [d]: Number(v) }))} options={scale} />)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextArea label={t('m04.scn.deb.strengths')} name="strengths" value={txt.strengths} onChange={(v) => setTxt((x) => ({ ...x, strengths: v }))} rows={3} />
            <TextArea label={t('m04.scn.deb.improvements')} name="improvements" value={txt.improvements} onChange={(v) => setTxt((x) => ({ ...x, improvements: v }))} rows={3} />
            <TextArea label={t('m04.scn.deb.critique')} name="critique" value={txt.critique} onChange={(v) => setTxt((x) => ({ ...x, critique: v }))} rows={3} hint={t('m04.scn.deb.critiqueHint')} />
          </div>
          <ContentIssueNote texts={texts} />
          <p className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info" data-testid="m04-scn-deb-preview">
            <Icon name="shield" size={14} className="mt-0.5" />{t('m04.scn.deb.preview', { n: present.length * perPerson, people: present.length, absent: roster.length - present.length })}
          </p>
        </div>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.scn.deb.confirmTitle')} consequence={t('m04.scn.deb.confirmBody', { people: present.length, n: present.length * perPerson })}
        confirmLabel={t('m04.scn.deb.record')} onConfirm={async () => { setConfirm(false); await submit(); }} />
    </Modal>
  );
}

/** One debrief: team ratings vs self-ratings, notes in the reader's language, crew present and evidence written. */
export function DebriefDrawer({ d, onClose, actions }: { d: SimDebriefView | null; onClose: () => void; actions?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const l = useSimLabels();
  const people = usePeople();
  if (!d) return null;
  const note = (k: 'strengths' | 'improvements' | 'critique') => pick(d as never, k) || null;
  return (
    <Drawer open onClose={onClose} title={`${d.scenario.code} · ${pick(d.scenario, 'title')}`} footer={actions}>
      <div className="space-y-4" data-testid="m04-scn-debrief">
        <div className="flex flex-wrap items-center gap-2"><CatChip c={d.scenario.category} /><SourceChip source={d.source} evidence={d.members.reduce((n, m) => n + m.evidence, 0)} /></div>
        <KeyValue items={[[t('m04.common.when'), f.date(d.held_on)], [t('m04.common.crew'), d.crew], [t('m04.sim.simulator'), d.simulator], [t('m04.scn.deb.instructor'), people.name(d.instructor_person_id)], [t('m04.scn.deb.mean'), f.num(meanScore(d.ratings), { maximumFractionDigits: 2 })]]} />
        <RatingBars ratings={d.ratings} self={d.self_ratings} />
        {(['strengths', 'improvements', 'critique'] as const).map((k) => note(k) && (
          <div key={k}><div className="caps">{t(`m04.scn.deb.${k}`)}</div><p className="text-[13px]">{note(k)}</p></div>
        ))}
        <div>
          <div className="caps mb-1">{t('m04.scn.deb.crewList')}</div>
          <ul className="divide-y divide-line text-[13px]">
            {d.members.map((m) => (
              <li key={m.person_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>{people.name(m.person_id)} <span className="text-ink-3">· {l.pos(m.position)}</span></span>
                <span className="flex items-center gap-2">{m.present ? <StatusPill tone="ok">{t('m04.scn.deb.present')}</StatusPill> : <StatusPill tone="neutral">{t('m04.scn.deb.absent')}</StatusPill>}
                  {m.evidence > 0 && <span className="text-[12px] text-ink-3">{t('m04.scn.deb.evidenceN', { n: m.evidence })}</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}
export function SourceChip({ source, evidence }: { source: string; evidence: number }) {
  const t = useT();
  return source === 'import'
    ? <StatusPill tone="neutral"><span title={t('m04.scn.deb.importHint')}>{t('m04.scn.deb.imported')}</span></StatusPill>
    : <StatusPill tone="ok">{t('m04.scn.deb.recorded', { n: evidence })}</StatusPill>;
}
