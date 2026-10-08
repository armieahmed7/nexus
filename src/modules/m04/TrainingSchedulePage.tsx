// /training/schedule (M04): sessions, rooms, instructors, rosters, waitlists, attendance and completion evidence.
// Completion of a qualifying course needs its linked evaluation (M05); certificates are issued only after a pass.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, DataTable, Drawer, Modal, ConfirmDialog, FilterBar, useFilters, Async, Callout, Icon, TextField, TextArea, SelectField, useForm, required, numberRange, Card, StatusPill, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { EnrolmentsRow, SessionsRow } from '../../data/types';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { holdsSeat, isOpen } from '../../domain/learning';
import { Chip, G2Pill, useCatalogue, useLabels, usePeople } from './ui';
import { PerformanceModal } from './PerformanceModal';

export default function TrainingSchedulePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const s = useSession();
  const cat = useCatalogue();
  const people = usePeople();
  const [params] = useSearchParams();
  const [flt, setFlt] = useFilters({ q: '', course: '', kind: '', when: 'upcoming', mine: params.get('mine') ? '1' : '' }, true);
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery(['sessions', 'enrolments'], async () => {
    const [sessions, enrolments] = await Promise.all([repo.list('sessions', { order: [['starts_at', 'asc']] }), repo.list('enrolments')]);
    return { sessions, enrolments };
  }, []);
  const canEdit = s.can('training', ['W']);
  return (
    <Page title={t('m04.routes.training-schedule.title')} intro={t('m04.schedule.intro')} wide actions={canEdit ? <button className="btn-primary" onClick={() => setCreate(true)} data-testid="m04-session-new"><Icon name="plus" />{t('m04.schedule.new')}</button> : null}>
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[
        { key: 'course', label: t('m04.common.course'), options: cat.courses.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` })) },
        { key: 'kind', label: t('m04.common.kind'), options: ['class', 'simulator', 'drill', 'elearning', 'clinic'].map((k) => ({ value: k, label: lab.sessionKind(k) })) },
        { key: 'when', label: t('m04.schedule.when'), options: [{ value: 'upcoming', label: t('m04.schedule.upcoming') }, { value: 'past', label: t('m04.schedule.past') }] },
        { key: 'mine', label: t('m04.schedule.instructor'), options: [{ value: '1', label: t('m04.schedule.mine') }] },
      ]} />
      <Async state={q}>
        {(d) => {
          const now = new Date().toISOString();
          const taken = (id: string) => d.enrolments.filter((e) => e.session_id === id && holdsSeat(e.status)).length;
          const waiting = (id: string) => d.enrolments.filter((e) => e.session_id === id && e.status === 'waitlisted').length;
          const rows = d.sessions.filter((x) => (!flt.course || x.course_id === flt.course) && (!flt.kind || x.kind === flt.kind) && (flt.when === 'past' ? x.starts_at < now : flt.when === 'upcoming' ? x.ends_at >= now : true)
            && (!flt.mine || x.instructor_person_id === s.identity.personId) && (!flt.q || `${x.location} ${cat.course.get(x.course_id)?.code} ${pick(cat.course.get(x.course_id), 'title')}`.toLowerCase().includes(flt.q.toLowerCase())));
          return (
            <DataTable rows={rows} rowKey={(r) => r.id} csvName="sessions" searchable={false} onRowClick={(r) => setOpen(r.id)} empty={t('m04.schedule.none')} initialSort={{ key: 'when', dir: flt.when === 'past' ? 'desc' : 'asc' }} columns={[
              { key: 'when', header: t('m04.common.when'), value: (r) => r.starts_at, render: (r) => <div><div className="font-semibold">{f.dateTime(r.starts_at)}</div><div className="text-[12px] text-ink-3">{t('m04.schedule.until', { time: f.dateTime(r.ends_at) })}</div></div>, sortable: true },
              { key: 'course', header: t('m04.common.course'), value: (r) => cat.course.get(r.course_id)?.code ?? r.course_id, render: (r) => <div><div>{pick(cat.course.get(r.course_id), 'title') || r.course_id}</div><div className="ltr text-[12px] text-ink-3">{cat.course.get(r.course_id)?.code}</div></div>, sortable: true },
              { key: 'kind', header: t('m04.common.kind'), value: (r) => lab.sessionKind(r.kind) },
              { key: 'where', header: t('m04.common.where'), value: (r) => r.location },
              { key: 'instr', header: t('m04.common.instructor'), value: (r) => people.name(r.instructor_person_id) },
              { key: 'crew', header: t('m04.common.crew'), value: (r) => r.crew ?? '—' },
              { key: 'prio', header: t('m04.schedule.priority'), value: (r) => r.priority, render: (r) => <Chip tone={r.priority === 'licence_critical' ? 'bad' : r.priority === 'mandatory' ? 'accent' : 'neutral'}>{lab.priority(r.priority)}</Chip> },
              { key: 'seats', header: t('m04.common.seats'), value: (r) => taken(r.id), render: (r) => <span className={`num ${taken(r.id) >= r.capacity ? 'font-semibold text-sim' : ''}`}>{f.num(taken(r.id))} / {f.num(r.capacity)}{waiting(r.id) ? ` · +${f.num(waiting(r.id))}` : ''}</span>, sortable: true },
              { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} /> },
            ]} />
          );
        }}
      </Async>
      {create && <SessionModal onClose={() => setCreate(false)} />}
      {open && <Roster sessionId={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function SessionModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const cat = useCatalogue();
  const people = usePeople();
  const s = useSession();
  const instructors = useQuery('role_assignments', () => repo.list('role_assignments', { filter: { role: ['instructor', 'training_manager'], status: 'active' } }).catch(() => []), []);
  const form = useForm({ course: '', date: '', start: '08:00', hours: '8', location: '', instructor: s.identity.personId ?? '', capacity: '12', kind: 'class', crew: '', priority: 'mandatory', audience: 'staff' },
    { course: [required()], date: [required()], start: [required()], hours: [required(), numberRange(0.5, 12)], location: [required()], capacity: [required(), numberRange(1, 60)], kind: [required()] });
  const instructorIds = [...new Set([...(instructors.data ?? []).map((a) => a.person_id), s.identity.personId].filter(Boolean) as string[])];
  return (
    <Modal open onClose={onClose} size="lg" title={t('m04.schedule.new')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-session-form" disabled={form.submitting} data-testid="m04-session-save">{t('common.save')}</button></>}>
      <form id="m04-session-form" className="grid gap-3 sm:grid-cols-3" onSubmit={form.handleSubmit(async (v) => {
        const start = new Date(`${v.date}T${v.start}:00+04:00`);
        const end = new Date(start.getTime() + Number(v.hours) * 3_600_000);
        const c = cat.course.get(v.course);
        const r = await run(() => repo.insert('sessions', { course_id: v.course, starts_at: start.toISOString(), ends_at: end.toISOString(), location: v.location.trim(), instructor_person_id: v.instructor || null, capacity: Number(v.capacity), kind: v.kind as SessionsRow['kind'], crew: v.crew || null, priority: v.priority as SessionsRow['priority'], audience: v.audience as SessionsRow['audience'], public_summary: false, status: 'scheduled' }), { success: t('m04.schedule.created', { course: c?.code ?? '' }) });
        if (r.ok) onClose();
      })}>
        <div className="sm:col-span-3"><SelectField label={t('m04.common.course')} required options={cat.courses.map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` }))} {...form.field('course')} /></div>
        <TextField label={t('m04.schedule.date')} type="date" required {...form.field('date')} />
        <TextField label={t('m04.schedule.start')} type="time" required hint={t('m04.schedule.uaeTime')} {...form.field('start')} />
        <TextField label={t('m04.schedule.hours')} type="number" required {...form.field('hours')} />
        <TextField label={t('m04.common.where')} required {...form.field('location')} />
        <SelectField label={t('m04.common.instructor')} options={instructorIds.map((id) => ({ value: id, label: people.name(id) }))} {...form.field('instructor')} />
        <TextField label={t('m04.schedule.capacity')} type="number" required {...form.field('capacity')} />
        <SelectField label={t('m04.common.kind')} required options={['class', 'simulator', 'drill', 'elearning', 'clinic'].map((k) => ({ value: k, label: lab.sessionKind(k) }))} {...form.field('kind')} />
        <SelectField label={t('m04.common.crew')} options={['A', 'B', 'C', 'D', 'E'].map((c) => ({ value: c, label: c }))} {...form.field('crew')} />
        <SelectField label={t('m04.schedule.priority')} options={['licence_critical', 'mandatory', 'elective'].map((p) => ({ value: p, label: lab.priority(p) }))} {...form.field('priority')} />
      </form>
    </Modal>
  );
}

function Roster({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const cat = useCatalogue();
  const people = usePeople();
  const q = useQuery(['sessions', 'enrolments', 'attempts', 'assessment_forms'], async () => {
    const session = await repo.get('sessions', sessionId);
    const [enrolments, forms] = await Promise.all([repo.list('enrolments', { filter: { session_id: sessionId } }), repo.list('assessment_forms').catch(() => [])]);
    const course = session ? await repo.get('courses', session.course_id) : null;
    const attempts = course?.evaluation_form_id ? await repo.list('attempts', { filter: { form_id: course.evaluation_form_id } }).catch(() => []) : [];
    return { session, enrolments, course, form: forms.find((x) => x.id === course?.evaluation_form_id) ?? null, attempts };
  }, [sessionId]);
  const [marks, setMarks] = useState<Record<string, 'present' | 'absent' | 'excused'>>({});
  const [confirmAtt, setConfirmAtt] = useState(false);
  const [complete, setComplete] = useState<EnrolmentsRow | null>(null);
  const [perf, setPerf] = useState<EnrolmentsRow | null>(null);
  const [cancel, setCancel] = useState<EnrolmentsRow | null>(null);
  const [add, setAdd] = useState('');
  const [statusChange, setStatusChange] = useState<'completed' | 'cancelled' | null>(null);
  const canEdit = s.can('training', ['W']);

  return (
    <Drawer open onClose={onClose} title={t('m04.schedule.roster')}>
      <Async state={q} isEmpty={(d) => !d.session}>
        {(d) => {
          const x = d.session!;
          const c = d.course;
          const started = x.starts_at <= new Date().toISOString();
          const seated = d.enrolments.filter((e) => holdsSeat(e.status) || e.status === 'failed').sort((a, b) => people.name(a.person_id).localeCompare(people.name(b.person_id)));
          const waitlist = d.enrolments.filter((e) => e.status === 'waitlisted').sort((a, b) => String(a.waitlisted_at ?? '').localeCompare(String(b.waitlisted_at ?? '')));
          const requested = d.enrolments.filter((e) => e.status === 'requested');
          const evalOf = (pid: string) => d.attempts.filter((a) => a.person_id === pid).sort((a, b) => String(b.released_at ?? b.submitted_at ?? '').localeCompare(String(a.released_at ?? a.submitted_at ?? '')))[0];
          const dirty = Object.keys(marks).length > 0;
          return (
            <div className="space-y-4">
              <Card title={c ? `${c.code} · ${pick(c, 'title')}` : x.course_id} eyebrow={lab.sessionKind(x.kind)} actions={<G2Pill status={x.status} />}>
                <div className="text-[13.5px] text-ink-2">{f.dateTime(x.starts_at)} – {f.dateTime(x.ends_at)} · {x.location}{x.crew ? ` · ${t('m04.common.crew')} ${x.crew}` : ''}</div>
                <div className="mt-1 text-[13.5px]">{t('m04.common.instructor')}: {people.name(x.instructor_person_id)} · <span className="num">{f.num(seated.filter((e) => e.status !== 'failed').length)} / {f.num(x.capacity)}</span></div>
                {c?.qualifying && <div className="mt-2"><Callout title={t('m04.course.evaluationTitle')}>{d.form ? t('m04.schedule.evalForm', { form: pick(d.form, 'title'), kind: lab.formKind(d.form.kind) }) : t('m04.schedule.noForm')}</Callout></div>}
                {canEdit && x.status === 'scheduled' && <div className="mt-3 flex gap-2">{started && <button className="btn-outline btn-sm" onClick={() => setStatusChange('completed')}>{t('m04.schedule.closeSession')}</button>}<button className="btn-ghost btn-sm" onClick={() => setStatusChange('cancelled')}>{t('m04.schedule.cancelSession')}</button></div>}
              </Card>

              <section aria-labelledby="m04-roster-h">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 id="m04-roster-h" className="font-semibold">{t('m04.schedule.enrolled', { n: f.num(seated.length) })}</h3>
                  {dirty && <button className="btn-primary btn-sm" onClick={() => setConfirmAtt(true)} data-testid="m04-attendance-save">{t('m04.schedule.saveAttendance', { n: f.num(Object.keys(marks).length) })}</button>}
                </div>
                {!started && <p className="mb-2 text-[12.5px] text-ink-3">{t('m04.schedule.attendanceLater')}</p>}
                {people.loading ? <Skeleton /> : seated.length === 0 ? <p className="text-ink-3">{t('m04.schedule.nobody')}</p> : (
                  <ul className="divide-y divide-line rounded-card border border-line" data-testid="m04-roster">
                    {seated.map((e) => {
                      const ev = evalOf(e.person_id);
                      return (
                        <li key={e.id} className="space-y-2 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div><div className="font-semibold">{people.name(e.person_id)}</div><div className="text-[12px] text-ink-3">{lab.source(e.source)}{e.certificate_no ? ` · ${e.certificate_no}` : ''}</div></div>
                            <div className="flex items-center gap-1"><G2Pill status={e.status} />{e.attendance && <G2Pill status={e.attendance} tone={e.attendance === 'present' ? 'ok' : 'sim'} />}</div>
                          </div>
                          {isOpen(e.status) && (
                            <div className="flex flex-wrap items-center gap-2">
                              {started && canEdit && (
                                <div role="radiogroup" aria-label={t('m04.schedule.attendance')} className="flex gap-1">
                                  {(['present', 'absent', 'excused'] as const).map((a) => (
                                    <button key={a} role="radio" aria-checked={(marks[e.id] ?? e.attendance) === a} className={`btn-sm ${(marks[e.id] ?? e.attendance) === a ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMarks({ ...marks, [e.id]: a })}>{lab.attendance(a)}</button>
                                  ))}
                                </div>
                              )}
                              {c?.qualifying && <span className="text-[12px] text-ink-2">{t('m04.schedule.evaluation')}: {ev ? <StatusPill status={ev.status === 'released' ? (ev.passed ? 'passed' : 'failed') : ev.status} /> : <StatusPill tone="neutral">{t('m04.schedule.noEvaluation')}</StatusPill>}</span>}
                              {canEdit && c?.qualifying && d.form && d.form.kind !== 'written' && !(ev && ev.status === 'released' && ev.passed) && <button className="btn-outline btn-sm" onClick={() => setPerf(e)}>{t('m04.schedule.recordEvaluation')}</button>}
                              {canEdit && e.attendance === 'present' && <button className="btn-primary btn-sm" onClick={() => setComplete(e)} data-testid="m04-complete">{t('m04.schedule.complete')}</button>}
                              {canEdit && <button className="btn-ghost btn-sm" onClick={() => setCancel(e)}>{t('m04.schedule.remove')}</button>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 font-semibold">{t('m04.schedule.waitlist', { n: f.num(waitlist.length) })}</h3>
                {waitlist.length === 0 ? <p className="text-ink-3">{t('m04.schedule.noWaitlist')}</p> : <ol className="list-decimal space-y-1 ps-5 text-[13.5px]">{waitlist.map((e) => <li key={e.id}>{people.name(e.person_id)} <span className="text-ink-3">· {f.dateTime(e.waitlisted_at)}</span></li>)}</ol>}
                {requested.length > 0 && <p className="mt-2 text-[12.5px] text-ink-3">{t('m04.schedule.requested', { n: f.num(requested.length) })}</p>}
              </section>

              {canEdit && x.status === 'scheduled' && !started && (
                <section className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-[220px] flex-1 flex-col gap-1"><span className="caps">{t('m04.schedule.addPerson')}</span>
                    <select className="input" value={add} onChange={(e) => setAdd(e.target.value)}>
                      <option value="">{t('common.choose')}</option>
                      {people.list.filter((p) => (x.audience === 'staff' ? p.kind === 'staff' : true) && p.status === 'active' && !d.enrolments.some((e) => e.person_id === p.id && isOpen(e.status))).map((p) => <option key={p.id} value={p.id}>{people.name(p.id)}{p.crew ? ` · ${t('m04.common.crew')} ${p.crew}` : ''}</option>)}
                    </select>
                  </label>
                  <button className="btn-outline" disabled={!add} onClick={async () => { const r = await run(() => repo.rpc.enrolCourse(x.course_id, x.id, add)); if (r.ok) setAdd(''); }} data-testid="m04-roster-add">{t('m04.schedule.enrolPerson')}</button>
                </section>
              )}

              <ConfirmDialog open={confirmAtt} onClose={() => setConfirmAtt(false)} title={t('m04.schedule.attendanceTitle')} consequence={t('m04.schedule.attendanceBody', { n: f.num(Object.keys(marks).length) })} actingAs={t('m04.common.roleTraining')}
                onConfirm={async () => { const r = await run(() => repo.rpc.recordAttendance(x.id, Object.entries(marks).map(([enrolment_id, attendance]) => ({ enrolment_id, attendance })))); if (r.ok) setMarks({}); }} />
              {complete && <CompleteModal e={complete} qualifying={!!c?.qualifying} passMark={c?.pass_mark ?? null} name={people.name(complete.person_id)} onClose={() => setComplete(null)} />}
              {perf && d.form && <PerformanceModal formId={d.form.id} personId={perf.person_id} name={people.name(perf.person_id)} onClose={() => setPerf(null)} />}
              <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} danger requireReason title={t('m04.schedule.removeTitle')} consequence={t('m04.schedule.removeBody', { name: cancel ? people.name(cancel.person_id) : '' })}
                onConfirm={async (reason) => { if (cancel) await run(() => repo.rpc.cancelEnrolment(cancel.id, reason)); }} />
              <ConfirmDialog open={!!statusChange} onClose={() => setStatusChange(null)} danger={statusChange === 'cancelled'} title={statusChange === 'completed' ? t('m04.schedule.closeSession') : t('m04.schedule.cancelSession')}
                consequence={statusChange === 'completed' ? t('m04.schedule.closeBody') : t('m04.schedule.cancelBody')}
                onConfirm={async () => { if (statusChange) await run(() => repo.update('sessions', x.id, { status: statusChange }), { success: t('m04.schedule.statusSaved') }); }} />
            </div>
          );
        }}
      </Async>
    </Drawer>
  );
}

function CompleteModal({ e, qualifying, passMark, name, onClose }: { e: EnrolmentsRow; qualifying: boolean; passMark: number | null; name: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ result: qualifying ? 'passed' : 'completed', score: '', note: '' }, { result: [required()], score: [numberRange(0, 100)] });
  const options = useMemo(() => (qualifying ? ['passed', 'failed'] : passMark != null ? ['passed', 'failed', 'completed'] : ['completed', 'failed']), [qualifying, passMark]);
  return (
    <Modal open onClose={onClose} title={t('m04.schedule.completeTitle', { name })} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-complete-form" disabled={form.submitting} data-testid="m04-complete-confirm">{t('m04.schedule.record')}</button></>}>
      <form id="m04-complete-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
        const r = await run(() => repo.rpc.completeEnrolment(e.id, v.result as 'passed' | 'failed' | 'completed', v.score ? Number(v.score) : null, v.note));
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m04.common.result')} required options={options.map((o) => ({ value: o, label: t(`m04.status.${o}`) }))} {...form.field('result')} />
        {!qualifying && <TextField label={t('m04.schedule.score')} type="number" hint={passMark != null ? t('m04.schedule.passMarkHint', { n: passMark }) : undefined} {...form.field('score')} />}
        <TextArea label={t('m04.schedule.evidence')} rows={2} {...form.field('note')} />
        {qualifying && <Callout title={t('m04.course.evaluationTitle')}>{t('m04.schedule.qualifyingNote')}</Callout>}
        <p className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info"><Icon name="shield" size={14} className="mt-0.5" />{t('common.evidenceRecorded')}</p>
      </form>
    </Modal>
  );
}
