// /my/assessments (M05): scheduled exams with timed delivery, results released to me after evaluator sign-off,
// competency feedback, appeals and retake rules, and my JPM results. No algorithm scores a person; evaluators do.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page, Tabs, Card, Grid, Async, EmptyState, ConfirmDialog, Modal, DataTable, Callout, Icon, StatTile, BarChart, TextArea, SelectField, useForm, required, minLen, maxLen, AddToCalendar } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { AttemptsRow, AssessmentFormsRow, DeliveredItem } from '../../data/types';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { appealWindow, canOpenAttempt, retakeEligibility } from '../../domain/learning';
import { G2Pill, Chip, useLabels } from '../m04/ui';
import { useCalendarEvents } from '../../shell/calendar/useCalendarEvents'; // SHR-01

export default function MyAssessmentsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const [exam, setExam] = useState<{ attempt: AttemptsRow; form: AssessmentFormsRow } | null>(null);
  const q = useQuery(['attempts', 'assessment_forms', 'appeals', 'jpm_results', 'jpms'], async () => {
    const [attempts, forms, appeals, jpm, jpms] = await Promise.all([
      repo.list('attempts', { filter: { person_id: me ?? '' }, order: [['scheduled_for', 'desc']] }), repo.list('assessment_forms'), repo.list('appeals', { filter: { person_id: me ?? '' } }),
      repo.list('jpm_results', { filter: { person_id: me ?? '' }, order: [['date', 'desc']] }), repo.list('jpms'),
    ]);
    return { attempts, forms, appeals, jpm, jpms };
  }, [me]);
  if (exam) return <ExamRunner attempt={exam.attempt} form={exam.form} onExit={() => setExam(null)} />;
  return (
    <Page title={t('m05.routes.my-assessments.title')} intro={t('m05.my.intro')} actions={<L to="/learn/practice" className="btn-outline btn-sm">{t('m05.my.practice')}</L>}>
      <Async state={q}>
        {(d) => {
          const form = (id: string) => d.forms.find((x) => x.id === id);
          const upcoming = d.attempts.filter((a) => ['scheduled', 'in_progress'].includes(a.status));
          const pending = d.attempts.filter((a) => ['submitted', 'graded'].includes(a.status));
          const released = d.attempts.filter((a) => a.status === 'released');
          return (
            <Tabs initial="scheduled" tabs={[
              { id: 'scheduled', label: t('m05.my.tabScheduled'), badge: upcoming.length, content: <Scheduled rows={upcoming} pending={pending} form={form} onStart={(a) => setExam({ attempt: a, form: form(a.form_id)! })} /> },
              { id: 'results', label: t('m05.my.tabResults'), badge: released.length, content: <Results rows={released} all={d.attempts} appeals={d.appeals} form={form} /> },
              { id: 'appeals', label: t('m05.my.tabAppeals'), content: <Appeals rows={d.appeals} attempts={d.attempts} form={form} /> },
              { id: 'jpm', label: t('m05.my.tabJpm'), content: <MyJpms rows={d.jpm} jpms={d.jpms} /> },
            ]} />
          );
        }}
      </Async>
    </Page>
  );
}

function Scheduled({ rows, pending, form, onStart }: { rows: AttemptsRow[]; pending: AttemptsRow[]; form: (id: string) => AssessmentFormsRow | undefined; onStart: (a: AttemptsRow) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const [confirm, setConfirm] = useState<AttemptsRow | null>(null);
  const cal = useCalendarEvents();
  const events = rows.map((a) => cal.attempt(a, form(a.form_id), '/my/assessments')).filter((e) => e !== null);
  return (
    <div className="space-y-4">
      {events.length > 1 && <div className="flex justify-end"><AddToCalendar events={events} file="my-assessments" calendarName={t('common.ics.cal.myAssessments')} testId="m05-ics-all" /></div>}
      {rows.length === 0 ? <EmptyState icon="calendar" title={t('m05.my.noneScheduled')}>{t('m05.my.noneScheduledBody')}</EmptyState> : (
        <Grid cols={2}>
          {rows.map((a) => {
            const fm = form(a.form_id);
            const open = canOpenAttempt(a.scheduled_for);
            const written = fm?.kind === 'written';
            return (
              <Card key={a.id} eyebrow={fm ? lab.formKind(fm.kind) : ''} title={fm ? pick(fm, 'title') : a.form_id} actions={<span className="flex items-center gap-1"><AddToCalendar compact events={[cal.attempt(a, fm, '/my/assessments')].filter((e) => e !== null)} itemTitle={fm ? pick(fm, 'title') : a.form_id} file={`assessment-${a.id}`} calendarName={t('common.ics.cal.myAssessments')} testId="m05-ics-one" /><G2Pill status={a.status} /></span>}>
                <ul className="space-y-1 text-[13.5px] text-ink-2">
                  <li>{t('m05.my.when', { when: f.dateTime(a.scheduled_for) })}</li>
                  {fm && <li>{t('m05.my.rules', { n: f.num(fm.item_ids.length), min: f.num(fm.time_limit_min), pass: f.pct(fm.pass_mark, 0) })}</li>}
                  {a.attempt_no > 1 && <li>{t('m05.my.attemptNo', { n: f.num(a.attempt_no), max: f.num(fm?.max_attempts ?? 3) })}</li>}
                </ul>
                {written ? (
                  <button className="btn-primary btn-sm mt-3" disabled={!open} onClick={() => (a.status === 'in_progress' ? onStart(a) : setConfirm(a))} data-testid="m05-start-exam">
                    {a.status === 'in_progress' ? t('m05.my.resume') : open ? t('m05.my.start') : t('m05.my.opensOn', { date: f.date(a.scheduled_for) })}
                  </button>
                ) : <p className="mt-3 text-[13px] text-ink-3">{t('m05.my.performanceNote')}</p>}
              </Card>
            );
          })}
        </Grid>
      )}
      {pending.length > 0 && (
        <Card title={t('m05.my.awaiting')}>
          <ul className="space-y-1.5">{pending.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span>{pick(form(a.form_id), 'title')} · {f.dateTime(a.submitted_at)}</span><G2Pill status="awaiting_release" tone="sim" /></li>)}</ul>
          <p className="mt-2 text-[12.5px] text-ink-3">{t('m05.my.awaitingNote')}</p>
        </Card>
      )}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={t('m05.my.startTitle')} consequence={t('m05.my.startBody', { min: f.num(form(confirm?.form_id ?? '')?.time_limit_min ?? 0) })} confirmLabel={t('m05.my.start')}
        onConfirm={() => { if (confirm) onStart(confirm); }} />
    </div>
  );
}

function ExamRunner({ attempt, form, onExit }: { attempt: AttemptsRow; form: AssessmentFormsRow; onExit: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [items, setItems] = useState<DeliveredItem[] | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [i, setI] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const key = `kafaa.exam.${attempt.id}`;
  useEffect(() => {
    let live = true;
    repo.rpc.startAttempt(attempt.id).then((r) => {
      if (!live) return;
      if (!r.ok || !r.data) { setErr(r.message); return; }
      setItems(r.data.items);
      setDeadline(new Date(r.data.deadline_at).getTime());
      try { setAnswers(JSON.parse(sessionStorage.getItem(key) || '{}')); } catch { /* fresh start */ }
    });
    return () => { live = false; };
  }, [attempt.id, repo, key]);
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(answers)); } catch { /* ignore */ } }, [answers, key]);
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, []);
  const submit = useCallback(async () => {
    if (!items || submitting.current) return;
    submitting.current = true;
    const r = await run(() => repo.rpc.submitAttempt(attempt.id, items.map((x) => ({ item_id: x.item_id, answer: answers[x.item_id] ?? null }))));
    if (r.ok) { setSubmitted(true); try { sessionStorage.removeItem(key); } catch { /* ignore */ } } else submitting.current = false;
  }, [items, answers, attempt.id, repo, run, key]);
  const left = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;
  useEffect(() => { if (left === 0 && items && !submitted) void submit(); }, [left, items, submitted, submit]);
  const txt = (o: { en: string; ar: string }) => (lang === 'ar' ? o.ar || o.en : o.en);
  const answered = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  if (err) return <Page title={pick(form, 'title')}><Callout tone="bad" title={t('m05.exam.cannotOpen')}>{err}</Callout><button className="btn-outline mt-3" onClick={onExit}>{t('m05.exam.back')}</button></Page>;
  if (submitted) return (
    <Page title={pick(form, 'title')}>
      <Callout tone="ok" title={t('m05.exam.submittedTitle')}>{t('m05.exam.submittedBody', { n: f.num(answered), total: f.num(items?.length ?? 0) })}</Callout>
      <button className="btn-primary mt-3" onClick={onExit} data-testid="m05-exam-done">{t('m05.exam.back')}</button>
    </Page>
  );
  if (!items) return <Page title={pick(form, 'title')}><Card><p className="text-ink-2">{t('m05.exam.loading')}</p></Card></Page>;
  const q = items[i];
  const mm = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '—';
  return (
    <Page title={pick(form, 'title')} eyebrow={t('m05.exam.secure')} actions={<span role="timer" aria-live="off" className={`num chip ${left != null && left < 300 ? 'border-bad-line bg-bad-bg text-bad' : 'border-line bg-sunken text-ink'}`}><Icon name="calendar" size={12} /><span className="ltr">{mm}</span></span>}>
      <Callout title={t('m05.exam.ruleTitle')}>{t('m05.exam.rule')}</Callout>
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <Card eyebrow={t('m05.quiz.questionOf', { n: f.num(i + 1), total: f.num(items.length) })}>
          <fieldset>
            <legend className="text-[17px] font-semibold leading-snug">{txt({ en: q.stem_en, ar: q.stem_ar })}</legend>
            <div className="mt-4 space-y-2" role="radiogroup">
              {q.options.map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-btn border p-3 ${answers[q.item_id] === o.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'}`}>
                  <input type="radio" name={q.item_id} checked={answers[q.item_id] === o.id} onChange={() => setAnswers({ ...answers, [q.item_id]: o.id })} className="accent-[rgb(var(--accent))]" />
                  <span className="num w-5 font-semibold uppercase text-ink-3">{o.id}</span><span>{txt(o)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" size={14} />{t('common.prev')}</button>
            <button className={flags[q.item_id] ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={!!flags[q.item_id]} onClick={() => setFlags({ ...flags, [q.item_id]: !flags[q.item_id] })}>{t('m05.exam.flag')}</button>
            {i < items.length - 1 ? <button className="btn-primary" onClick={() => setI(i + 1)} data-testid="m05-exam-next">{t('common.next')}<Icon name="chevron" size={14} /></button> : <button className="btn-primary" onClick={() => setConfirm(true)} data-testid="m05-exam-submit">{t('m05.exam.submit')}</button>}
          </div>
        </Card>
        <Card title={t('m05.exam.navigator')}>
          <div className="grid grid-cols-5 gap-1.5" role="list">
            {items.map((x, k) => (
              <button key={x.item_id} role="listitem" onClick={() => setI(k)} aria-current={k === i ? 'true' : undefined} aria-label={t('m05.exam.goTo', { n: k + 1 })}
                className={`num h-8 rounded-btn border text-[12px] font-semibold ${k === i ? 'border-accent ring-2 ring-accent/40' : 'border-line'} ${flags[x.item_id] ? 'bg-sim-bg text-sim' : answers[x.item_id] ? 'bg-ok-bg text-ok' : 'bg-panel text-ink-3'}`}>{f.num(k + 1)}</button>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-ink-2">{t('m05.exam.answered', { n: f.num(answered), total: f.num(items.length) })}</p>
          <button className="btn-primary btn-sm mt-3 w-full" onClick={() => setConfirm(true)}>{t('m05.exam.submit')}</button>
        </Card>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m05.exam.confirmTitle')} consequence={answered < items.length ? t('m05.exam.confirmUnanswered', { n: f.num(items.length - answered) }) : t('m05.exam.confirmBody')} confirmLabel={t('m05.exam.submit')} onConfirm={submit} />
    </Page>
  );
}

function Results({ rows, all, appeals, form }: { rows: AttemptsRow[]; all: AttemptsRow[]; appeals: import('../../data/types').AppealsRow[]; form: (id: string) => AssessmentFormsRow | undefined }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [fb, setFb] = useState<AttemptsRow | null>(null);
  const [appeal, setAppeal] = useState<AttemptsRow | null>(null);
  if (!rows.length) return <EmptyState icon="chart" title={t('m05.my.noResults')}>{t('m05.my.noResultsBody')}</EmptyState>;
  return (
    <div className="space-y-3">
      <DataTable rows={rows} rowKey={(r) => r.id} searchable={false} csvName="my-results" initialSort={{ key: 'date', dir: 'desc' }} columns={[
        { key: 'date', header: t('m05.my.date'), value: (r) => r.released_at ?? r.submitted_at ?? '', render: (r) => f.date(r.released_at ?? r.submitted_at), sortable: true },
        { key: 'form', header: t('m05.my.exam'), value: (r) => pick(form(r.form_id), 'title') },
        { key: 'score', header: t('m05.my.score'), value: (r) => r.score ?? null, render: (r) => (r.score != null ? f.pct(r.score, 0) : '—'), align: 'end' },
        { key: 'result', header: t('m04.common.result'), value: (r) => (r.passed ? 'passed' : 'failed'), render: (r) => <G2Pill status={r.passed ? 'passed' : 'failed'} /> },
        { key: 'retake', header: t('m05.my.next'), csv: false, render: (r) => {
          if (r.passed) return '—';
          const fm = form(r.form_id);
          if (!fm) return '—';
          const el = retakeEligibility(fm, all.filter((a) => a.form_id === r.form_id), new Date());
          return <span className="text-[12.5px] text-ink-2">{el.ok ? t('m05.my.retakeOpen', { n: f.num(el.attemptNo), max: f.num(fm.max_attempts) }) : t(`m05.retake.${el.code}`, { date: el.earliest ? f.date(el.earliest) : '' })}</span>;
        } },
        { key: 'act', header: '', csv: false, render: (r) => {
          const fm = form(r.form_id);
          const w = fm ? appealWindow(r, fm.appeal_days) : { open: false, closesOn: null };
          const hasOpen = appeals.some((a) => a.attempt_id === r.id && a.status === 'open');
          return (
            <div className="flex justify-end gap-1">
              {fm?.kind === 'written' && <button className="btn-outline btn-sm" onClick={() => setFb(r)} data-testid="m05-feedback">{t('m05.my.feedback')}</button>}
              {w.open && !hasOpen && <button className="btn-ghost btn-sm" onClick={() => setAppeal(r)} data-testid="m05-appeal">{t('m05.my.appeal')}</button>}
            </div>
          );
        } },
      ]} />
      <p className="text-[12.5px] text-ink-3">{t('m05.my.resultsNote')}</p>
      {fb && <FeedbackModal attempt={fb} title={pick(form(fb.form_id), 'title')} onClose={() => setFb(null)} />}
      {appeal && <AppealModal attempt={appeal} form={form(appeal.form_id)!} onClose={() => setAppeal(null)} />}
    </div>
  );
}

function FeedbackModal({ attempt, title, onClose }: { attempt: AttemptsRow; title: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['attempts', 'competencies'], async () => {
    const [r, comps] = await Promise.all([repo.rpc.attemptFeedback(attempt.id), repo.list('competencies')]);
    if (!r.ok) throw new Error(r.message);
    return { fb: r.data!, comps };
  }, [attempt.id]);
  return (
    <Modal open onClose={onClose} size="lg" title={t('m05.my.feedbackTitle', { exam: title })}>
      <Async state={q}>
        {(d) => (
          <div className="space-y-3">
            <Grid cols={3}>
              <StatTile label={t('m05.my.score')} value={f.pct(d.fb.score ?? 0, 0)} tone={d.fb.passed ? 'ok' : 'bad'} sub={t('m05.my.passMark', { n: f.pct(d.fb.pass_mark, 0) })} />
              <StatTile label={t('m05.my.correct')} value={`${f.num(d.fb.correct)} / ${f.num(d.fb.total)}`} />
              <StatTile label={t('m04.common.result')} value={<G2Pill status={d.fb.passed ? 'passed' : 'failed'} />} />
            </Grid>
            <BarChart title={t('m05.my.byCompetency')} unit="%" max={100} target={d.fb.pass_mark} data={d.fb.by_competency.map((c) => { const k = d.comps.find((x) => x.id === c.competency_id); return { label: k ? `${k.code} · ${pick(k, 'name')}` : t('m05.my.general'), value: Math.round((c.correct * 100) / Math.max(1, c.total)) }; })} />
            <Callout title={t('m05.my.feedbackNoteTitle')}>{t('m05.my.feedbackNote')}</Callout>
          </div>
        )}
      </Async>
    </Modal>
  );
}

function AppealModal({ attempt, form, onClose }: { attempt: AttemptsRow; form: AssessmentFormsRow; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const fm = useForm({ reason: '', item: '' }, { reason: [required(), minLen(10), maxLen(1000)] });
  const w = appealWindow(attempt, form.appeal_days);
  return (
    <Modal open onClose={onClose} title={t('m05.my.appealTitle')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m05-appeal-form" disabled={fm.submitting}>{t('m05.my.fileAppeal')}</button></>}>
      <form id="m05-appeal-form" className="space-y-3" onSubmit={fm.handleSubmit(async (v) => {
        const r = await run(() => repo.rpc.fileAppeal(attempt.id, v.reason.trim(), v.item || null));
        if (r.ok) onClose();
      })}>
        <p className="text-[13px] text-ink-2">{t('m05.my.appealBody', { date: w.closesOn ? f.date(w.closesOn) : '—' })}</p>
        <SelectField label={t('m05.my.question')} hint={t('m05.my.questionHint')} placeholder={t('m05.my.wholeExam')} options={form.item_ids.map((_, k) => ({ value: form.item_ids[k], label: t('m05.my.questionN', { n: f.num(k + 1) }) }))} {...fm.field('item')} />
        <TextArea label={t('m05.my.reason')} required rows={4} {...fm.field('reason')} />
        <p className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info"><Icon name="shield" size={14} className="mt-0.5" />{t('common.evidenceRecorded')}</p>
      </form>
    </Modal>
  );
}

function Appeals({ rows, attempts, form }: { rows: import('../../data/types').AppealsRow[]; attempts: AttemptsRow[]; form: (id: string) => AssessmentFormsRow | undefined }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!rows.length) return <EmptyState icon="info" title={t('m05.my.noAppeals')}>{t('m05.my.noAppealsBody')}</EmptyState>;
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} searchable={false} columns={[
      { key: 'date', header: t('m05.my.date'), value: (r) => r.created_at, render: (r) => f.date(r.created_at), sortable: true },
      { key: 'exam', header: t('m05.my.exam'), value: (r) => pick(form(attempts.find((a) => a.id === r.attempt_id)?.form_id ?? ''), 'title') },
      { key: 'reason', header: t('m05.my.reason'), value: (r) => r.reason },
      { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} tone={r.status === 'upheld' ? 'ok' : r.status === 'rejected' ? 'bad' : 'info'} /> },
      { key: 'note', header: t('m05.my.decision'), value: (r) => r.decision_note ?? '' },
    ]} />
  );
}

function MyJpms({ rows, jpms }: { rows: import('../../data/types').JpmResultsRow[]; jpms: import('../../data/types').JpmsRow[] }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const pick = usePick();
  if (!rows.length) return <EmptyState icon="check" title={t('m05.my.noJpm')} />;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const j = jpms.find((x) => x.id === r.jpm_id);
        const steps = (j?.critical_steps ?? []) as { n: number; en: string; ar: string; critical: boolean }[];
        const res = (r.steps ?? []) as { n: number; result: string }[];
        return (
          <Card key={r.id} eyebrow={<span className="ltr">{j?.code}</span>} title={j ? pick(j, 'title') : r.jpm_id} actions={<div className="flex gap-1">{r.critical_failed && <Chip tone="bad">{t('m05.jpm.criticalFailed')}</Chip>}<G2Pill status={r.result === 'pass' ? 'passed' : 'failed'} /></div>}>
            <div className="text-[12.5px] text-ink-3">{f.date(r.date)} · {t('m05.jpm.score', { n: f.pct(r.score_pct, 0) })} · {r.signed ? t('m05.jpm.signed') : t('m05.jpm.unsigned')}</div>
            <ol className="mt-2 space-y-1 text-[13px]">{steps.map((s) => { const ok = res.find((x) => x.n === s.n)?.result === 'pass'; return <li key={s.n} className="flex items-start gap-2"><Icon name={ok ? 'check' : 'close'} size={14} className={`mt-0.5 ${ok ? 'text-ok' : 'text-bad'}`} /><span>{lang === 'ar' ? s.ar : s.en}{s.critical && <span className="ms-1 text-[11px] font-semibold text-bad">{t('m05.jpm.critical')}</span>}</span></li>; })}</ol>
          </Card>
        );
      })}
    </div>
  );
}
