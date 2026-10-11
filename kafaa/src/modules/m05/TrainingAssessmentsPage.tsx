// /training/assessments (M05): exam assembly from blueprints, scheduling with retake rules, proctor console (release after
// evaluator sign-off), item analysis (difficulty and discrimination, never item text) and appeals with separation of duties.
import { useMemo, useState } from 'react';
import { Page, Tabs, DataTable, Modal, ConfirmDialog, Async, Callout, Icon, TextField, SelectField, CheckboxField, TextArea, RadioGroup, useForm, required, numberRange, maxLen, Card, Grid, StatTile, BarChart, EmptyState, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { AppealsRow, AssessmentFormsRow, AttemptsRow, BlueprintsRow } from '../../data/types';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { itemAnalysis, retakeEligibility, isLate } from '../../domain/learning';
import { Chip, G2Pill, useLabels, usePeople } from '../m04/ui';
import { PerformanceModal } from '../m04/PerformanceModal';

export default function TrainingAssessmentsPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['assessment_forms', 'blueprints', 'attempts', 'appeals', 'items', 'responses', 'competencies'], async () => {
    const [forms, blueprints, attempts, appeals, items, responses, comps] = await Promise.all([repo.list('assessment_forms'), repo.list('blueprints'), repo.list('attempts'), repo.list('appeals'), repo.list('items'), repo.list('responses'), repo.list('competencies')]);
    return { forms, blueprints, attempts, appeals, items, responses, comps };
  }, []);
  return (
    <Page title={t('m05.routes.training-assessments.title')} intro={t('m05.exams.intro')} wide>
      <Async state={q}>
        {(d) => (
          <Tabs initial="proctor" tabs={[
            { id: 'proctor', label: t('m05.exams.tabProctor'), badge: d.attempts.filter((a) => ['scheduled', 'in_progress', 'graded'].includes(a.status)).length, content: <Proctor d={d} /> },
            { id: 'schedule', label: t('m05.exams.tabSchedule'), content: <Schedule d={d} /> },
            { id: 'forms', label: t('m05.exams.tabForms'), content: <Forms d={d} /> },
            { id: 'blueprints', label: t('m05.exams.tabBlueprints'), content: <Blueprints d={d} /> },
            { id: 'analysis', label: t('m05.exams.tabAnalysis'), content: <Analysis d={d} /> },
            { id: 'appeals', label: t('m05.exams.tabAppeals'), badge: d.appeals.filter((a) => a.status === 'open').length, content: <Appeals d={d} /> },
          ]} />
        )}
      </Async>
    </Page>
  );
}

type D = { forms: AssessmentFormsRow[]; blueprints: BlueprintsRow[]; attempts: AttemptsRow[]; appeals: AppealsRow[]; items: import('../../data/types').ItemsRow[]; responses: import('../../data/types').ResponsesRow[]; comps: import('../../data/types').CompetenciesRow[] };

function Proctor({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const people = usePeople();
  const [release, setRelease] = useState<AttemptsRow | null>(null);
  const [perf, setPerf] = useState<AttemptsRow | null>(null);
  const form = (id: string) => d.forms.find((x) => x.id === id);
  const live = d.attempts.filter((a) => ['scheduled', 'in_progress', 'graded'].includes(a.status));
  const now = Date.now();
  return (
    <div className="space-y-4">
      <Grid cols={3}>
        <StatTile label={t('m05.exams.scheduled')} value={f.num(live.filter((a) => a.status === 'scheduled').length)} />
        <StatTile label={t('m05.exams.inProgress')} value={f.num(live.filter((a) => a.status === 'in_progress').length)} tone="info" />
        <StatTile label={t('m05.exams.toRelease')} value={f.num(live.filter((a) => a.status === 'graded').length)} tone={live.some((a) => a.status === 'graded') ? 'sim' : undefined} sub={t('m05.exams.toReleaseSub')} />
      </Grid>
      {people.loading ? <Skeleton /> : (
        <DataTable rows={live} rowKey={(r) => r.id} csvName="proctor-console" initialSort={{ key: 'when', dir: 'asc' }} empty={t('m05.exams.noLive')} columns={[
          { key: 'when', header: t('m04.common.when'), value: (r) => r.scheduled_for ?? '', render: (r) => f.dateTime(r.scheduled_for), sortable: true },
          { key: 'cand', header: t('m05.jpm.candidate'), value: (r) => people.name(r.person_id), sortable: true },
          { key: 'form', header: t('m05.my.exam'), value: (r) => pick(form(r.form_id), 'title'), render: (r) => <div><div>{pick(form(r.form_id), 'title')}</div><div className="text-[12px] text-ink-3">{lab.formKind(form(r.form_id)?.kind)}{r.attempt_no > 1 ? ` · ${t('m05.exams.attemptN', { n: f.num(r.attempt_no) })}` : ''}</div></div> },
          { key: 'proctor', header: t('m05.exams.proctor'), value: (r) => people.name(r.proctor_person_id) },
          { key: 'clock', header: t('m05.exams.clock'), csv: false, render: (r) => r.status === 'in_progress' && r.deadline_at ? <span className="num">{t('m05.exams.minLeft', { n: f.num(Math.max(0, Math.round((new Date(r.deadline_at).getTime() - now) / 60000))) })}</span> : r.late ? <Chip tone="sim">{t('m05.exams.late')}</Chip> : '—' },
          { key: 'score', header: t('m05.my.score'), value: (r) => r.score ?? null, render: (r) => (r.status === 'graded' && r.score != null ? <span className="num">{f.pct(r.score, 0)} · {r.passed ? t('m04.status.passed') : t('m04.status.failed')}</span> : '—') },
          { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} /> },
          { key: 'act', header: '', csv: false, render: (r) => {
            const fm = form(r.form_id);
            if (r.status === 'graded') return <button className="btn-primary btn-sm" disabled={r.person_id === s.identity.personId} onClick={() => setRelease(r)} data-testid="m05-release">{t('m05.exams.release')}</button>;
            if (r.status === 'scheduled' && fm && fm.kind !== 'written' && s.can('signoff', ['A'])) return <button className="btn-outline btn-sm" onClick={() => setPerf(r)}>{t('m04.schedule.recordEvaluation')}</button>;
            if (r.status === 'in_progress' && r.deadline_at && isLate(r.deadline_at, new Date())) return <Chip tone="sim">{t('m05.exams.overdueSubmit')}</Chip>;
            return null;
          } },
        ]} />
      )}
      <Callout title={t('m05.exams.signoffTitle')}>{t('m05.exams.signoffBody')}</Callout>
      <ConfirmDialog open={!!release} onClose={() => setRelease(null)} title={t('m05.exams.releaseTitle')} actingAs={t('m04.common.roleEvaluator')} reasonLabel={t('m05.exams.note')}
        consequence={release ? t('m05.exams.releaseBody', { name: people.name(release.person_id), score: f.pct(release.score ?? 0, 0), result: release.passed ? t('m04.status.passed') : t('m04.status.failed') }) : ''}
        onConfirm={async () => { if (release) await run(() => repo.rpc.releaseAttempt(release.id, '')); }} />
      {perf && <PerformanceModal formId={perf.form_id} personId={perf.person_id} name={people.name(perf.person_id)} onClose={() => setPerf(null)} />}
    </div>
  );
}

function Schedule({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const people = usePeople();
  const form = useForm({ form: '', person: '', date: '', time: '08:00', proctor: '' }, { form: [required()], person: [required()], date: [required()], time: [required()] });
  const [confirm, setConfirm] = useState(false);
  const fm = d.forms.find((x) => x.id === form.values.form);
  const when = form.values.date ? new Date(`${form.values.date}T${form.values.time || '08:00'}:00+04:00`) : null;
  const eligibility = fm && form.values.person && when ? retakeEligibility(fm, d.attempts.filter((a) => a.person_id === form.values.person && a.form_id === fm.id), when) : null;
  const staff = people.list.filter((p) => p.kind === 'staff' && p.status === 'active' && p.id !== s.identity.personId);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card title={t('m05.exams.scheduleTitle')}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(() => setConfirm(true))}>
          <div className="sm:col-span-2"><SelectField label={t('m05.my.exam')} required options={d.forms.filter((x) => !x.is_practice && x.status === 'approved').map((x) => ({ value: x.id, label: pick(x, 'title') }))} {...form.field('form')} /></div>
          <SelectField label={t('m05.jpm.candidate')} required options={staff.map((p) => ({ value: p.id, label: people.name(p.id) }))} {...form.field('person')} />
          <SelectField label={t('m05.exams.proctor')} placeholder={t('m05.exams.proctorMe')} options={staff.filter((p) => p.id !== form.values.person).map((p) => ({ value: p.id, label: people.name(p.id) }))} {...form.field('proctor')} />
          <TextField label={t('m04.schedule.date')} type="date" required {...form.field('date')} />
          <TextField label={t('m04.schedule.start')} type="time" required hint={t('m04.schedule.uaeTime')} {...form.field('time')} />
          <div className="sm:col-span-2"><button type="submit" className="btn-primary" data-testid="m05-schedule">{t('m05.exams.schedule')}</button></div>
        </form>
      </Card>
      <Card title={t('m05.exams.rulesTitle')}>
        {fm ? (
          <div className="space-y-2 text-[13.5px]">
            <p>{t('m05.exams.rulesBody', { max: f.num(fm.max_attempts), wait: f.num(fm.retake_wait_days), appeal: f.num(fm.appeal_days), pass: f.pct(fm.pass_mark, 0) })}</p>
            {eligibility && (eligibility.ok ? <Callout tone="ok" title={t('m05.exams.eligible', { n: f.num(eligibility.attemptNo) })} /> : <Callout tone="bad" title={t(`m05.retake.${eligibility.code}`, { date: eligibility.earliest ? f.date(eligibility.earliest) : '' })} />)}
          </div>
        ) : <p className="text-ink-3">{t('m05.exams.pickForm')}</p>}
      </Card>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m05.exams.scheduleTitle')} actingAs={t('m04.common.roleInstructor')}
        consequence={t('m05.exams.scheduleBody', { name: people.name(form.values.person), exam: pick(fm, 'title'), when: when ? f.dateTime(when) : '' })}
        onConfirm={async () => { if (when) { const r = await run(() => repo.rpc.scheduleAttempt(form.values.form, form.values.person, when.toISOString(), form.values.proctor || null)); if (r.ok) form.reset(); } }} />
    </div>
  );
}

function Forms({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const [assemble, setAssemble] = useState(false);
  const [status, setStatus] = useState<{ form: AssessmentFormsRow; to: 'approved' | 'retired' } | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setAssemble(true)} data-testid="m05-assemble"><Icon name="plus" />{t('m05.exams.assemble')}</button></div>
      <DataTable rows={d.forms} rowKey={(r) => r.id} csvName="assessment-forms" initialSort={{ key: 'title', dir: 'asc' }} columns={[
        { key: 'title', header: t('m04.common.title'), value: (r) => pick(r, 'title'), sortable: true },
        { key: 'kind', header: t('m04.common.kind'), value: (r) => lab.formKind(r.kind) },
        { key: 'items', header: t('m05.exams.items'), value: (r) => r.item_ids.length, align: 'end' },
        { key: 'time', header: t('m05.exams.timeLimit'), value: (r) => r.time_limit_min, render: (r) => t('m04.common.minutes', { n: f.num(r.time_limit_min) }), align: 'end' },
        { key: 'pass', header: t('m04.course.passMark'), value: (r) => r.pass_mark, render: (r) => f.pct(r.pass_mark, 0), align: 'end' },
        { key: 'rules', header: t('m05.exams.retakeRules'), value: (r) => `${r.max_attempts}/${r.retake_wait_days}/${r.appeal_days}`, render: (r) => r.is_practice ? '—' : <span className="text-[12px]">{t('m05.exams.rulesShort', { max: f.num(r.max_attempts), wait: f.num(r.retake_wait_days) })}</span> },
        { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} tone={r.status === 'approved' ? 'ok' : 'neutral'} /> },
        { key: 'act', header: '', csv: false, render: (r) => r.is_practice ? <Chip>{t('m05.items.practiceBank')}</Chip> : r.status === 'draft' ? <button className="btn-outline btn-sm" onClick={() => setStatus({ form: r, to: 'approved' })}>{t('m05.items.approve')}</button> : r.status === 'approved' ? <button className="btn-ghost btn-sm" onClick={() => setStatus({ form: r, to: 'retired' })}>{t('m05.items.retire')}</button> : null },
      ]} />
      {assemble && <AssembleModal d={d} onClose={() => setAssemble(false)} />}
      <ConfirmDialog open={!!status} onClose={() => setStatus(null)} title={status?.to === 'approved' ? t('m05.exams.approveForm') : t('m05.exams.retireForm')} consequence={status?.to === 'approved' ? t('m05.exams.approveFormBody') : t('m05.exams.retireFormBody')}
        onConfirm={async () => { if (status) await run(() => repo.update('assessment_forms', status.form.id, { status: status.to }), { success: t('m05.exams.formSaved') }); }} />
    </div>
  );
}

function AssembleModal({ d, onClose }: { d: D; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ blueprint: '', title_en: '', title_ar: '', minutes: '60', pass: '80', max: '3', wait: '7' }, { blueprint: [required()], title_en: [required(), maxLen(160)], title_ar: [required(), maxLen(160)], minutes: [required(), numberRange(5, 240)], pass: [required(), numberRange(1, 100)], max: [required(), numberRange(1, 5)], wait: [required(), numberRange(0, 90)] });
  const bp = d.blueprints.find((b) => b.id === form.values.blueprint);
  const spec = (bp?.spec ?? []) as { competency_id: string; count: number }[];
  const pool = (cid: string) => d.items.filter((i) => i.bank === 'secure' && i.status === 'approved' && i.competency_id === cid);
  const short = spec.filter((x) => pool(x.competency_id).length < x.count);
  return (
    <Modal open onClose={onClose} size="lg" title={t('m05.exams.assemble')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m05-assemble-form" disabled={form.submitting || !bp}>{t('m05.exams.assembleDraft')}</button></>}>
      <form id="m05-assemble-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
        const picked = spec.flatMap((x) => [...pool(x.competency_id)].sort(() => Math.random() - 0.5).slice(0, x.count).map((i) => i.id));
        const r = await run(() => repo.insert('assessment_forms', { blueprint_id: v.blueprint, title_en: v.title_en.trim(), title_ar: v.title_ar.trim(), kind: 'written', is_practice: false, item_ids: picked, time_limit_min: Number(v.minutes), pass_mark: Number(v.pass), status: 'draft', max_attempts: Number(v.max), retake_wait_days: Number(v.wait), appeal_days: 10 }), { success: t('m05.exams.assembled', { n: f.num(picked.length) }) });
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m05.exams.blueprint')} required options={d.blueprints.filter((b) => b.status === 'approved').map((b) => ({ value: b.id, label: b.title }))} {...form.field('blueprint')} />
        {bp && (
          <ul className="space-y-1 rounded-btn border border-line p-2 text-[13px]">
            {spec.map((x) => { const c = d.comps.find((k) => k.id === x.competency_id); const n = pool(x.competency_id).length; return <li key={x.competency_id} className="flex justify-between gap-2"><span>{c ? `${c.code} · ${pick(c, 'name')}` : x.competency_id}</span><span className={`num ${n < x.count ? 'text-bad' : ''}`}>{t('m05.exams.pickOf', { n: f.num(Math.min(n, x.count)), want: f.num(x.count), pool: f.num(n) })}</span></li>; })}
          </ul>
        )}
        {short.length > 0 && <Callout tone="sim" title={t('m05.exams.shortTitle')}>{t('m05.exams.short')}</Callout>}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m04.builder.titleEn')} required {...form.field('title_en')} />
          <TextField label={t('m04.builder.titleAr')} required {...form.field('title_ar')} />
          <TextField label={t('m05.exams.timeLimit')} type="number" required {...form.field('minutes')} />
          <TextField label={t('m04.course.passMark')} type="number" required {...form.field('pass')} />
          <TextField label={t('m05.exams.maxAttempts')} type="number" required {...form.field('max')} />
          <TextField label={t('m05.exams.waitDays')} type="number" required {...form.field('wait')} />
        </div>
      </form>
    </Modal>
  );
}

function Blueprints({ d }: { d: D }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [create, setCreate] = useState(false);
  const [rows, setRows] = useState<{ competency_id: string; count: string }[]>([{ competency_id: '', count: '5' }]);
  const form = useForm({ title: '' }, { title: [required(), maxLen(160)] });
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => { form.reset(); setRows([{ competency_id: '', count: '5' }]); setCreate(true); }}><Icon name="plus" />{t('m05.exams.newBlueprint')}</button></div>
      {d.blueprints.length === 0 ? <EmptyState title={t('m05.exams.noBlueprints')} /> : (
        <Grid cols={2}>
          {d.blueprints.map((b) => (
            <Card key={b.id} title={b.title} actions={<G2Pill status={b.status} tone={b.status === 'approved' ? 'ok' : 'neutral'} />}>
              <ul className="space-y-1 text-[13px]">{((b.spec ?? []) as { competency_id: string; count: number }[]).map((x) => { const c = d.comps.find((k) => k.id === x.competency_id); return <li key={x.competency_id} className="flex justify-between"><span>{c ? `${c.code} · ${pick(c, 'name')}` : x.competency_id}</span><span className="num">× {x.count}</span></li>; })}</ul>
              {b.status === 'draft' && <button className="btn-outline btn-sm mt-2" onClick={() => run(() => repo.update('blueprints', b.id, { status: 'approved' }), { success: t('m05.exams.formSaved') })}>{t('m05.items.approve')}</button>}
            </Card>
          ))}
        </Grid>
      )}
      <Modal open={create} onClose={() => setCreate(false)} title={t('m05.exams.newBlueprint')} footer={<><button className="btn-outline" onClick={() => setCreate(false)}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m05-bp-form">{t('common.save')}</button></>}>
        <form id="m05-bp-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
          const spec = rows.filter((x) => x.competency_id && Number(x.count) > 0).map((x) => ({ competency_id: x.competency_id, count: Number(x.count) }));
          if (!spec.length) return;
          const r = await run(() => repo.insert('blueprints', { title: v.title.trim(), spec, status: 'draft' }), { success: t('m05.exams.formSaved') });
          if (r.ok) setCreate(false);
        })}>
          <TextField label={t('m04.common.title')} required {...form.field('title')} />
          {rows.map((x, k) => (
            <div key={k} className="grid grid-cols-[1fr_90px] gap-2">
              <select className="input" aria-label={t('m04.plan.competency')} value={x.competency_id} onChange={(e) => setRows(rows.map((y, i) => (i === k ? { ...y, competency_id: e.target.value } : y)))}><option value="">{t('common.choose')}</option>{d.comps.map((c) => <option key={c.id} value={c.id}>{c.code} · {pick(c, 'name')}</option>)}</select>
              <input className="input" type="number" min={1} max={50} aria-label={t('m05.exams.items')} value={x.count} onChange={(e) => setRows(rows.map((y, i) => (i === k ? { ...y, count: e.target.value } : y)))} />
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setRows([...rows, { competency_id: '', count: '5' }])}><Icon name="plus" size={14} />{t('m05.exams.addRow')}</button>
        </form>
      </Modal>
    </div>
  );
}

function Analysis({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const written = d.forms.filter((x) => x.kind === 'written' && !x.is_practice);
  const [formId, setFormId] = useState(written.find((x) => x.id === 'form-reactor-theory')?.id ?? written[0]?.id ?? '');
  const stats = useMemo(() => {
    const atts = d.attempts.filter((a) => a.form_id === formId && ['graded', 'released'].includes(a.status));
    const ids = new Set(atts.map((a) => a.id));
    return { n: atts.length, rows: itemAnalysis(atts.map((a) => ({ ...a, score: a.score ?? null })), d.responses.filter((r) => ids.has(r.attempt_id))) };
  }, [d, formId]);
  const item = (id: string) => d.items.find((i) => i.id === id);
  const comp = (id: string | null | undefined) => d.comps.find((c) => c.id === id)?.code ?? '—';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1"><span className="caps">{t('m05.my.exam')}</span>
          <select className="input min-w-[280px]" value={formId} onChange={(e) => setFormId(e.target.value)} data-testid="m05-analysis-form">{written.map((x) => <option key={x.id} value={x.id}>{pick(x, 'title')}</option>)}</select>
        </label>
        <Callout title={t('m05.exams.analysisNoteTitle')}>{t('m05.exams.analysisNote')}</Callout>
      </div>
      {stats.n === 0 ? <EmptyState icon="chart" title={t('m05.exams.noAttempts')} /> : (
        <>
          <Grid cols={3}>
            <StatTile label={t('m05.exams.attempts')} value={f.num(stats.n)} />
            <StatTile label={t('m05.exams.flagged')} value={f.num(stats.rows.filter((r) => r.flag !== 'ok').length)} tone={stats.rows.some((r) => r.flag !== 'ok' && r.flag !== 'low_n') ? 'sim' : 'ok'} />
            <StatTile label={t('m05.exams.meanP')} value={f.num(stats.rows.length ? Math.round((stats.rows.reduce((n, r) => n + (r.p ?? 0), 0) / stats.rows.length) * 100) / 100 : 0)} />
          </Grid>
          <Card title={t('m05.exams.pChart')}><BarChart title={t('m05.exams.pChart')} max={1} data={stats.rows.map((r) => ({ label: r.item_id, value: r.p, tone: r.flag === 'ok' ? undefined : 'sim' }))} /></Card>
          <DataTable rows={stats.rows} rowKey={(r) => r.item_id} csvName={`item-analysis-${formId}`} searchable={false} columns={[
            { key: 'id', header: t('m05.items.id'), value: (r) => r.item_id, render: (r) => <span className="num ltr text-[12px]">{r.item_id}</span>, sortable: true },
            { key: 'topic', header: t('m05.items.topic'), value: (r) => item(r.item_id)?.topic ?? '' },
            { key: 'comp', header: t('m04.plan.competency'), value: (r) => comp(item(r.item_id)?.competency_id) },
            { key: 'n', header: 'n', value: (r) => r.n, align: 'end' },
            { key: 'p', header: t('m05.exams.p'), value: (r) => r.p, render: (r) => (r.p == null ? '—' : f.num(r.p)), align: 'end', sortable: true },
            { key: 'd', header: t('m05.exams.d'), value: (r) => r.d, render: (r) => (r.d == null ? '—' : f.num(r.d)), align: 'end', sortable: true },
            { key: 'flag', header: t('m05.exams.flag'), value: (r) => r.flag, render: (r) => <G2Pill status={r.flag} tone={r.flag === 'ok' ? 'ok' : r.flag === 'low_n' ? 'neutral' : 'sim'} /> },
          ]} />
        </>
      )}
    </div>
  );
}

function Appeals({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const people = usePeople();
  const [open, setOpen] = useState<AppealsRow | null>(null);
  const isTm = s.can('secure_items', ['A']);
  return (
    <div className="space-y-3">
      {!isTm && <Callout title={t('m05.exams.appealsReadOnlyTitle')}>{t('m05.exams.appealsReadOnly')}</Callout>}
      <DataTable rows={d.appeals} rowKey={(r) => r.id} csvName="appeals" initialSort={{ key: 'date', dir: 'desc' }} empty={t('m05.my.noAppeals')} columns={[
        { key: 'date', header: t('m05.my.date'), value: (r) => r.created_at, render: (r) => f.date(r.created_at), sortable: true },
        { key: 'cand', header: t('m05.jpm.candidate'), value: (r) => people.name(r.person_id) },
        { key: 'exam', header: t('m05.my.exam'), value: (r) => pick(d.forms.find((x) => x.id === d.attempts.find((a) => a.id === r.attempt_id)?.form_id), 'title') },
        { key: 'item', header: t('m05.my.question'), value: (r) => r.item_id ?? '', render: (r) => <span className="num ltr text-[12px]">{r.item_id ?? t('m05.my.wholeExam')}</span> },
        { key: 'reason', header: t('m05.my.reason'), value: (r) => r.reason },
        { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} tone={r.status === 'upheld' ? 'ok' : r.status === 'rejected' ? 'bad' : 'info'} /> },
        { key: 'act', header: '', csv: false, render: (r) => (r.status === 'open' && isTm ? <button className="btn-primary btn-sm" onClick={() => setOpen(r)} data-testid="m05-appeal-decide">{t('m05.exams.decide')}</button> : r.decision_note ? <span className="text-[12px] text-ink-2">{r.decision_note}</span> : null) },
      ]} />
      {open && <DecideAppeal appeal={open} attempt={d.attempts.find((a) => a.id === open.attempt_id)!} form={d.forms.find((x) => x.id === d.attempts.find((a) => a.id === open.attempt_id)?.form_id)!} name={people.name(open.person_id)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function DecideAppeal({ appeal, attempt, form, name, onClose }: { appeal: AppealsRow; attempt: AttemptsRow; form: AssessmentFormsRow; name: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [decision, setDecision] = useState<'upheld' | 'rejected'>('upheld');
  const [voids, setVoids] = useState<string[]>(appeal.item_id ? [appeal.item_id] : []);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal open onClose={onClose} size="lg" title={t('m05.exams.decideTitle', { name })} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={note.trim().length < 5} onClick={() => setConfirm(true)}>{t('m05.exams.decide')}</button></>}>
      <div className="space-y-3">
        <p className="text-[13.5px]">“{appeal.reason}”</p>
        <p className="text-[13px] text-ink-2">{t('m05.exams.currentScore', { score: f.pct(attempt.score ?? 0, 0), pass: f.pct(form.pass_mark, 0) })}</p>
        <RadioGroup label={t('m05.exams.decision')} name="decision" value={decision} onChange={(v) => setDecision(v as 'upheld' | 'rejected')} options={[{ value: 'upheld', label: t('m04.status.upheld') }, { value: 'rejected', label: t('m04.status.rejected') }]} />
        {decision === 'upheld' && (
          <fieldset><legend className="caps mb-1">{t('m05.exams.voidItems')}</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">{form.item_ids.map((id, k) => <CheckboxField key={id} label={<span>{t('m05.my.questionN', { n: f.num(k + 1) })} <span className="num text-[11px] text-ink-3">{id}</span></span>} checked={voids.includes(id)} onChange={(v) => setVoids(v ? [...voids, id] : voids.filter((x) => x !== id))} />)}</div>
            <p className="mt-1 text-[12px] text-ink-3">{t('m05.exams.voidHint')}</p>
          </fieldset>
        )}
        <TextArea label={t('m05.exams.note')} required name="note" value={note} onChange={setNote} rows={3} />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m05.exams.decideTitle', { name })} actingAs={t('m04.common.roleTm')} consequence={decision === 'upheld' ? t('m05.exams.upheldBody', { n: f.num(voids.length) }) : t('m05.exams.rejectedBody')}
        onConfirm={async () => { const r = await run(() => repo.rpc.decideAppeal(appeal.id, decision, note.trim(), decision === 'upheld' ? voids : [])); if (r.ok) onClose(); }} />
    </Modal>
  );
}
