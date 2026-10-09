// /training/sat/tasks/:taskId (M26 · F27): one task of a job analysis. The DIF survey (every rating, the distribution per
// dimension, the consensus and the rule's proposal with "Why this?"), my own rating, the training decision (the training manager;
// an override of the rule needs a reason), the learning objectives and the course, module or JPM that delivers each, and the
// change impact: what a change to this task touches (courses, standards, JPMs, assessment items as metadata only) and the
// "record a change" flow that opens one review item per course and standard. Restricted tasks show nothing beyond "restricted".
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout, DataTable, WhyThis, Modal, ConfirmDialog, TextField, TextArea, SelectField, RadioGroup, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { DECISIONS, MIN_RATERS, SELECTED, type Decision } from './sat';
import { roleScopeObjectives } from './evidence';
import { DecisionPill, DifDots, RatingInputs, RestrictedChip, SourceChip, useSatData, useSatModel, type SatData, type SatModel } from './ui';

export default function SatTaskPage() {
  const t = useT();
  const { taskId = '' } = useParams();
  const q = useSatData();
  const m = useSatModel(q.data);
  const task = m?.task.get(taskId);
  const pick = usePick();
  const title = task ? (task.restricted ? t('m26.restricted.chip') : `${task.code} · ${pick(task, 'title')}`) : t('m26.routes.training-sat-task.title');
  return (
    <Page title={title} eyebrow={task && m ? <L to={`/training/sat/roles/${task.role_id}`} className="link">{m.roleName(task.role_id)}</L> : undefined} wide>
      <Async state={q}>{(d) => (m && task ? (task.restricted ? <Callout tone="sim" title={t('m26.restricted.chip')}><RestrictedChip /> {t('m26.restricted.body')}</Callout> : <TaskView d={d} m={m} taskId={taskId} />)
        : <EmptyState title={t('m26.task.notFound')} action={<L to="/training/sat" className="btn-outline no-underline">{t('m26.common.back')}</L>} />)}</Async>
    </Page>
  );
}

function TaskView({ d, m, taskId }: { d: SatData; m: SatModel; taskId: string }) {
  const t = useT();
  const f = useFormat();
  const task = m.task.get(taskId)!;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
        <SourceChip source={task.source} />
        {task.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m26.task.critical')}</span>}
        {task.standard_id && <L to={`/training/quals/${task.standard_id}`} className="link">{m.stdName(task.standard_id)}</L>}
        <span>{t('m26.task.version', { n: f.num(task.version) })}</span>
        {task.status === 'retired' && <span className="chip border-line bg-sunken text-ink-3">{t('m26.task.retired')}</span>}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DifCard d={d} m={m} taskId={taskId} />
        <DecisionCard m={m} taskId={taskId} />
      </div>
      <LinksCard d={d} m={m} taskId={taskId} />
      <ImpactCard d={d} m={m} taskId={taskId} />
    </div>
  );
}

const SCALE = [1, 2, 3, 4, 5];
function Distribution({ values, dim }: { values: number[]; dim: 'd' | 'i' | 'f' }) {
  const t = useT();
  const f = useFormat();
  const max = Math.max(1, ...SCALE.map((n) => values.filter((v) => v === n).length));
  return (
    <figure>
      <figcaption className="caps mb-1">{t(`m26.dif.${dim}`)}</figcaption>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={t('m26.dif.distLabel', { dim: t(`m26.dif.${dim}`), list: SCALE.map((n) => `${n}: ${values.filter((v) => v === n).length}`).join(', ') })}>
        {SCALE.map((n) => {
          const c = values.filter((v) => v === n).length;
          return (
            <div key={n} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="w-full rounded-t bg-accent/80" style={{ height: `${(c / max) * 48}px` }} />
              <span className="num text-[10.5px] text-ink-3">{f.num(n)}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function DifCard({ d, m, taskId }: { d: SatData; m: SatModel; taskId: string }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const ratings = (m.ratingsOf.get(taskId) ?? []).filter((r) => r.active !== false);
  const p = m.props.get(taskId)!;
  const mine = ratings.find((r) => r.rater_person_id === s.identity.personId);
  const canRate = s.can('sat', ['W', 'A']);
  const [v, setV] = useState({ d: String(mine?.d ?? ''), i: String(mine?.i ?? ''), f: String(mine?.f ?? ''), note: mine?.note ?? '' });
  const valid = v.d && v.i && v.f;
  const cols: Column<(typeof ratings)[number]>[] = [
    { key: 'kind', header: t('m26.dif.rater'), value: (r) => t(`m26.dif.kind.${r.rater_kind}`), render: (r) => <span>{t(`m26.dif.kind.${r.rater_kind}`)}{r.rater_person_id === s.identity.personId && <span className="chip ms-1 border-accent bg-accent-soft text-accent-ink">{t('m26.dif.you')}</span>}</span> },
    { key: 'dif', header: t('m26.task.consensus'), csv: false, render: (r) => <DifDots d={r.d} i={r.i} f={r.f} /> },
    { key: 'd', header: t('m26.dif.d1'), value: (r) => r.d, align: 'end' },
    { key: 'i', header: t('m26.dif.i1'), value: (r) => r.i, align: 'end' },
    { key: 'f', header: t('m26.dif.f1'), value: (r) => r.f, align: 'end' },
    { key: 'on', header: t('m26.dif.ratedOn'), value: (r) => r.rated_on, render: (r) => f.date(r.rated_on) },
    { key: 'note', header: t('m26.dif.note'), value: (r) => r.note ?? '', render: (r) => <span className="text-[12px] text-ink-2">{r.note}</span> },
  ];
  return (
    <Card title={t('m26.dif.title')} eyebrow={t('m26.dif.eyebrow', { n: f.num(ratings.length), min: f.num(MIN_RATERS) })}>
      <div className="grid grid-cols-3 gap-3" data-testid="m26-dif-dist">
        {(['d', 'i', 'f'] as const).map((k) => <Distribution key={k} dim={k} values={ratings.map((r) => r[k])} />)}
      </div>
      <div className="mt-4 rounded-card border border-line bg-sunken/60 p-3">
        {p.consensus ? (
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span className="font-semibold">{t('m26.dif.consensus')}</span>
            <DifDots d={p.consensus.d} i={p.consensus.i} f={p.consensus.f} />
            <span className="num text-ink-2">{t('m26.dif.means', { d: f.num(p.consensus.mean.d), i: f.num(p.consensus.mean.i), f: f.num(p.consensus.mean.f) })}</span>
          </div>
        ) : <p className="text-[13px] text-ink-2">{t('m26.dif.noRatings')}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-[13px] text-ink-2">{t('m26.task.proposal')}:</span>
          {p.decision ? <DecisionPill decision={p.decision} /> : <span className="text-[13px]">{t('m26.task.needMore', { n: f.num(Math.max(0, MIN_RATERS - p.n)) })}</span>}
          {p.consensus?.disagreement && <span className="chip border-sim-line bg-sim-bg text-sim">{t('m26.task.disagreement')}</span>}
          <WhyThis reasons={p.reasons} testId="m26-task-why" />
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-semibold">{t('m26.dif.allRatings', { n: f.num(ratings.length) })}</summary>
        <div className="mt-2"><DataTable rows={ratings} columns={cols} rowKey={(r) => r.id} searchable={false} dense csvName={`dif-${taskId}.csv`} /></div>
      </details>
      {canRate && (
        <div className="mt-4 border-t border-line pt-3" data-testid="m26-rate-form">
          <div className="caps mb-2">{mine ? t('m26.dif.updateMine') : t('m26.dif.rateMine')}</div>
          <RatingInputs v={v} setV={setV} />
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1"><TextField label={t('m26.dif.note')} name="note" value={v.note} onChange={(x) => setV({ ...v, note: x })} /></div>
            <button className="btn-primary" disabled={!valid} data-testid="m26-rate-save"
              onClick={() => run(() => repo.rpc.rateDif(taskId, Number(v.d), Number(v.i), Number(v.f), v.note))}>{t('m26.dif.save')}</button>
          </div>
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-3">{t('m26.dif.scaleNote')}</p>
    </Card>
  );
}

function DecisionCard({ m, taskId }: { m: SatModel; taskId: string }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const task = m.task.get(taskId)!;
  const p = m.props.get(taskId)!;
  const canDecide = s.can('sat', ['A']);
  const [pick, setPick] = useState<Decision | null>(null);
  const override = !!pick && pick !== p.decision;
  return (
    <Card title={t('m26.decide.title')} eyebrow={t('m26.decide.eyebrow')}>
      <div className="flex flex-wrap items-center gap-2" data-testid="m26-decision">
        <DecisionPill decision={task.decision} override={task.override} />
        {task.decision_on && <span className="text-[12.5px] text-ink-2">{t('m26.decide.on', { date: f.date(task.decision_on) })}</span>}
      </div>
      {task.decision_note && <p className="mt-2 rounded-card border border-sim-line bg-sim-bg p-2 text-[13px]">{task.decision_note}</p>}
      <dl className="mt-3 space-y-1 text-[12.5px] text-ink-2">
        {(['train', 'overtrain', 'no_train'] as const).map((k) => <div key={k}><dt className="inline font-semibold text-ink">{t(`m26.decision.${k}`)}: </dt><dd className="inline">{t(`m26.decide.means.${k}`)}</dd></div>)}
      </dl>
      {canDecide && task.status === 'active' && (
        <div className="mt-4 border-t border-line pt-3">
          {p.status !== 'proposed' ? <Callout tone="sim">{t('m26.decide.insufficient', { n: f.num(p.n), min: f.num(MIN_RATERS) })}</Callout> : (
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((k) => (
                <button key={k} className={k === p.decision ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setPick(k)} data-testid={`m26-decide-${k}`}>
                  {t(`m26.decision.${k}`)}{k === p.decision ? ` · ${t('m26.decide.ruleSays')}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!canDecide && <p className="mt-3 text-[12px] text-ink-3">{t('m26.decide.tmOnly')}</p>}
      <ConfirmDialog open={!!pick} onClose={() => setPick(null)} title={t('m26.decide.confirmTitle', { d: pick ? t(`m26.decision.${pick}`) : '' })}
        consequence={override ? t('m26.decide.overrideBody', { rule: p.decision ? t(`m26.decision.${p.decision}`) : '' }) : t('m26.decide.confirmBody')}
        requireReason={override} reasonLabel={t('m26.decide.reason')} actingAs={t('m26.common.asTm')} confirmLabel={t('m26.decide.record')}
        onConfirm={async (reason) => { if (pick) await run(() => repo.rpc.decideTraining(taskId, pick, reason)); }} />
    </Card>
  );
}

function LinksCard({ d, m, taskId }: { d: SatData; m: SatModel; taskId: string }) {
  const t = useT();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const task = m.task.get(taskId)!;
  const canW = s.can('sat', ['W', 'A']) && task.status === 'active';
  const links = d.links.filter((l) => l.task_id === taskId && l.active);
  const [open, setOpen] = useState<'link' | 'write' | null>(null);
  const [unlink, setUnlink] = useState<string | null>(null);
  const gap = SELECTED.includes(task.decision) && links.length === 0;
  const cols: Column<(typeof links)[number]>[] = [
    { key: 'obj', header: t('m26.matrix.objectives'), value: (l) => m.obj.get(l.objective_ref)?.code ?? l.objective_ref, render: (l) => (
      <div><span className="num font-semibold">{m.obj.get(l.objective_ref)?.code}</span> <span className="text-[12px] text-ink-3">{t(`m26.objKind.${m.obj.get(l.objective_ref)?.kind ?? 'terminal'}`)}</span><div className="text-[12.5px]">{m.objText(l.objective_ref)}</div></div>
    ) },
    { key: 'course', header: t('m26.links.course'), value: (l) => m.courseName(l.course_id), render: (l) => l.course_id ? <L to={`/learn/course/${l.course_id}`} className="link">{m.courseName(l.course_id)}</L> : '—' },
    { key: 'module', header: t('m26.links.module'), value: (l) => (l.module_id ? m.moduleName(l.module_id) : ''), render: (l) => (l.module_id ? m.moduleName(l.module_id) : '—') },
    { key: 'jpm', header: t('m26.matrix.jpm'), value: (l) => (l.jpm_id ? m.jpmName(l.jpm_id) : ''), render: (l) => (l.jpm_id ? m.jpmName(l.jpm_id) : '—') },
    { key: 'act', header: '', csv: false, render: (l) => canW ? <button className="btn-ghost btn-sm" onClick={() => setUnlink(l.objective_ref)} data-testid="m26-unlink">{t('m26.links.unlink')}</button> : null },
  ];
  return (
    <Card title={t('m26.links.title')} eyebrow={t('m26.links.eyebrow')} actions={canW ? (
      <span className="flex flex-wrap gap-2">
        <button className="btn-outline btn-sm" onClick={() => setOpen('link')} data-testid="m26-link-open">{t('m26.links.link')}</button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen('write')} data-testid="m26-objective-open">{t('m26.links.write')}</button>
      </span>
    ) : undefined}>
      {gap && <Callout tone="bad" title={t('m26.matrix.gap')}>{t('m26.links.gapBody')}</Callout>}
      <div data-testid="m26-links"><DataTable rows={links} columns={cols} rowKey={(l) => l.id} searchable={false} empty={<EmptyState title={t('m26.links.none')} />} /></div>
      <LinkModal open={open === 'link'} d={d} m={m} taskId={taskId} onClose={() => setOpen(null)} />
      <ObjectiveModal open={open === 'write'} d={d} m={m} taskId={taskId} onClose={() => setOpen(null)} />
      <ConfirmDialog open={!!unlink} onClose={() => setUnlink(null)} title={t('m26.links.unlink')} consequence={t('m26.links.unlinkBody', { code: unlink ? m.obj.get(unlink)?.code ?? '' : '' })}
        actingAs={t('m26.common.asStaff')} confirmLabel={t('m26.links.unlink')} danger
        onConfirm={async () => { if (unlink) await run(() => repo.rpc.linkObjective({ task_id: taskId, objective_ref: unlink, active: false })); }} />
    </Card>
  );
}

function LinkModal({ open, d, m, taskId, onClose }: { open: boolean; d: SatData; m: SatModel; taskId: string; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const task = m.task.get(taskId)!;
  const linked = new Set(d.links.filter((l) => l.task_id === taskId && l.active).map((l) => l.objective_ref));
  const options = useMemo(() => roleScopeObjectives(task.role_id, m.trace).filter((o) => o.status === 'active' && !linked.has(o.id)).map((o) => m.obj.get(o.id)!)
    .sort((a, b) => (a.code < b.code ? -1 : 1)), [task.role_id, m, d.links]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, setV] = useState({ obj: '', module: '', jpm: '' });
  const obj = m.obj.get(v.obj);
  const modules = d.modules.filter((x) => x.course_id === obj?.course_id);
  const jpms = d.jpms.filter((j) => !m.std.get(j.standard_id)?.security_restricted);
  const save = async () => {
    const r = await run(() => repo.rpc.linkObjective({ task_id: taskId, objective_ref: v.obj, course_id: obj?.course_id ?? null, module_id: v.module || null, jpm_id: v.jpm || null }));
    if (r.ok) { setV({ obj: '', module: '', jpm: '' }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('m26.links.link')} size="lg" footer={<>
      <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={!v.obj} onClick={save} data-testid="m26-link-save">{t('m26.links.link')}</button>
    </>}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m26.links.linkBody')}</p>
        <SelectField label={t('m26.matrix.objectives')} name="obj" value={v.obj} onChange={(x) => setV({ obj: x, module: '', jpm: v.jpm })}
          options={options.map((o) => ({ value: o.id, label: `${o.code} · ${pick(o, 'text')}`.slice(0, 140) }))} />
        {obj && <p className="text-[12.5px] text-ink-2">{t('m26.links.deliveredBy', { course: m.courseName(obj.course_id) })}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label={t('m26.links.module')} name="module" value={v.module} onChange={(x) => setV({ ...v, module: x })} options={modules.map((x) => ({ value: x.id, label: pick(x, 'title') }))} />
          <SelectField label={t('m26.matrix.jpm')} name="jpm" value={v.jpm} onChange={(x) => setV({ ...v, jpm: x })} options={jpms.map((j) => ({ value: j.id, label: `${j.code} · ${pick(j, 'title')}` }))} />
        </div>
      </div>
    </Modal>
  );
}

function ObjectiveModal({ open, d, m, taskId, onClose }: { open: boolean; d: SatData; m: SatModel; taskId: string; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const task = m.task.get(taskId)!;
  const [v, setV] = useState({ kind: 'terminal', en: '', ar: '', course: '', module: '' });
  const courses = d.courses.filter((c) => c.audience === 'staff');
  const valid = v.en.trim().length >= 10 && v.ar.trim().length >= 10;
  const save = async () => {
    const r = await run(() => repo.rpc.saveObjective({ kind: v.kind as 'terminal' | 'enabling', text_en: v.en, text_ar: v.ar, course_id: v.course || null, module_id: v.module || null, role_id: task.role_id }));
    if (r.ok && r.data) {
      await run(() => repo.rpc.linkObjective({ task_id: taskId, objective_ref: r.data!.id, course_id: v.course || null, module_id: v.module || null }));
      setV({ kind: 'terminal', en: '', ar: '', course: '', module: '' });
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('m26.links.write')} size="lg" footer={<>
      <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={!valid} onClick={save} data-testid="m26-objective-save">{t('m26.links.writeSave')}</button>
    </>}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m26.links.writeBody')}</p>
        <RadioGroup label={t('m26.links.kind')} name="kind" value={v.kind} onChange={(x) => setV({ ...v, kind: x })} options={[{ value: 'terminal', label: t('m26.objKind.terminal') }, { value: 'enabling', label: t('m26.objKind.enabling') }]} />
        <TextArea label={t('m26.links.textEn')} name="text_en" rows={2} value={v.en} onChange={(x) => setV({ ...v, en: x })} hint={t('m26.links.textHint')} />
        <TextArea label={t('m26.links.textAr')} name="text_ar" rows={2} value={v.ar} onChange={(x) => setV({ ...v, ar: x })} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label={t('m26.links.course')} name="course" value={v.course} onChange={(x) => setV({ ...v, course: x, module: '' })} options={courses.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` }))} />
          <SelectField label={t('m26.links.module')} name="module" value={v.module} onChange={(x) => setV({ ...v, module: x })} options={d.modules.filter((x) => x.course_id === v.course).map((x) => ({ value: x.id, label: pick(x, 'title') }))} />
        </div>
      </div>
    </Modal>
  );
}

function ImpactCard({ d, m, taskId }: { d: SatData; m: SatModel; taskId: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const task = m.task.get(taskId)!;
  const imp = useQuery(['task_objectives', 'jta_tasks', 'sat_objectives'], () => repo.rpc.satImpact(taskId), [taskId]);
  const open = d.changes.find((c) => c.task_id === taskId && c.status === 'open');
  const canW = s.can('sat', ['W', 'A']) && task.status === 'active' && !open;
  const [form, setForm] = useState(false);
  const [v, setV] = useState({ kind: 'modified', trigger: 'task_change', summary: '', en: task.title_en, ar: task.title_ar });
  const [confirm, setConfirm] = useState(false);
  const retitle = v.kind === 'modified' && (v.en !== task.title_en || v.ar !== task.title_ar);
  return (
    <Card title={t('m26.impact.title')} eyebrow={t('m26.impact.eyebrow')} actions={canW ? <button className="btn-outline btn-sm" onClick={() => setForm(true)} data-testid="m26-change-open">{t('m26.impact.record')}</button> : undefined}>
      {open && <Callout tone="sim" title={t('m26.impact.openTitle')}>{open.summary} <L to="/training/sat/changes" className="link">{t('m26.changes.review')}</L></Callout>}
      <Async state={imp}>{(x) => !x ? <EmptyState title={t('m26.impact.none')} /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="m26-impact">
          {([['courses', x.courses], ['standards', x.standards], ['jpms', x.jpms]] as const).map(([k, xs]) => (
            <div key={k}>
              <div className="caps mb-1">{t(`m26.impact.${k}`, { n: f.num(xs.length) })}</div>
              {xs.length === 0 ? <p className="text-[12.5px] text-ink-3">{t('m26.impact.noneOfKind')}</p> : (
                <ul className="space-y-1 text-[12.5px]">
                  {xs.map((r) => <li key={r.id}>{k === 'standards' ? <L to={`/training/quals/${r.id}`} className="link">{r.code} · {pick(r, 'title')}</L> : k === 'courses' ? <L to={`/learn/course/${r.id}`} className="link">{r.code} · {pick(r, 'title')}</L> : <span>{r.code} · {pick(r, 'title')}</span>}</li>)}
                </ul>
              )}
            </div>
          ))}
          <div>
            <div className="caps mb-1">{t('m26.impact.items', { n: f.num(x.items.length) })}</div>
            <p className="text-[12px] text-ink-3">{t('m26.impact.itemsNote')}</p>
            {x.items.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[12px]">
                {x.items.slice(0, 8).map((i) => <li key={i.id} className="num">{i.id} · {i.topic} · {t(`m26.impact.difficulty.${i.difficulty}`)}</li>)}
                {x.items.length > 8 && <li className="text-ink-3">{t('m26.impact.more', { n: f.num(x.items.length - 8) })}</li>}
              </ul>
            )}
          </div>
        </div>
      )}</Async>
      <Modal open={form} onClose={() => setForm(false)} title={t('m26.impact.record')} size="lg" footer={<>
        <button className="btn-outline" onClick={() => setForm(false)}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={v.summary.trim().length < 10} onClick={() => { setForm(false); setConfirm(true); }} data-testid="m26-change-next">{t('m26.common.next')}</button>
      </>}>
        <div className="space-y-3">
          <RadioGroup label={t('m26.impact.kind')} name="kind" value={v.kind} onChange={(x) => setV({ ...v, kind: x })} options={[{ value: 'modified', label: t('m26.changes.kind.modified') }, { value: 'retired', label: t('m26.changes.kind.retired') }]} />
          <SelectField label={t('m26.impact.trigger')} name="trigger" value={v.trigger} onChange={(x) => setV({ ...v, trigger: x || 'task_change' })} options={['task_change', 'effectiveness', 'oe', 'regulatory'].map((k) => ({ value: k, label: t(`m26.changes.trigger.${k}`) }))} />
          <TextArea label={t('m26.impact.summary')} name="summary" rows={3} value={v.summary} onChange={(x) => setV({ ...v, summary: x })} hint={t('m26.impact.summaryHint')} />
          {v.kind === 'modified' && (
            <>
              <TextField label={t('m26.task.titleEn')} name="title_en" value={v.en} onChange={(x) => setV({ ...v, en: x })} />
              <TextField label={t('m26.task.titleAr')} name="title_ar" value={v.ar} onChange={(x) => setV({ ...v, ar: x })} />
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m26.impact.confirmTitle')}
        consequence={t('m26.impact.confirmBody', { c: f.num(imp.data?.courses.length ?? 0), s: f.num(imp.data?.standards.length ?? 0) })} actingAs={t('m26.common.asStaff')} confirmLabel={t('m26.impact.record')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.openSatChange({ task_id: taskId, kind: v.kind as 'modified' | 'retired', trigger: v.trigger as 'task_change', summary: v.summary, title_en: retitle ? v.en : null, title_ar: retitle ? v.ar : null }));
          if (r.ok) setV({ ...v, summary: '' });
        }} />
    </Card>
  );
}
