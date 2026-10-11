// FS22 /my/assessments/tasks/:task (skills_profile Own): a scenario performance task. The published rubric comes first and the learner
// confirms it before starting (rpc.startPerformanceTask refuses otherwise). The SIMULATED trend set is interactive: mark the signal and
// the reading where the anomaly shows, choose a decision, tick the checks made and justify (rpc.submitPerformanceTask; replacements
// before scoring are counted). An assessor scores the rubric (never their own attempt); the result shows every line, the critical
// decision rule, the comment, the reasons and the evidence. Tasks that gate a credential carry an integrity report.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, WhyThis, BenchmarkChips, StatusPill, Icon, ConfirmDialog, CheckboxField, TextArea, SimChip } from '../../ui';
import { useQuery, useRepo, useAction } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { JUSTIFY_MAX, JUSTIFY_MIN, readingTime, scoreTask, type RubricLine, type TaskData } from './perf';
import { GateChips, IntegritySummary, RubricView, SkillLinks, TrendChart, useFsRef, type FsRef, type Row } from './fsui';
import { taskStatus } from './PerfTasksPage';

export default function PerfTaskPage() {
  const t = useT();
  const { task = '' } = useParams();
  const s = useSession();
  const repo = useRepo();
  const ref = useFsRef();
  const q = useQuery(['task_attempts', 'integrity_reports'], async () => {
    const [attempts, reports] = await Promise.all([
      repo.list('task_attempts' as never, { filter: { person_id: s.identity.personId ?? '__none__', task_id: task } } as never).catch(() => [] as Row[]),
      repo.list('integrity_reports' as never, { filter: { person_id: s.identity.personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { attempts: attempts as Row[], reports: reports as Row[] };
  }, [s.identity.personId, task]);
  return (
    <Page title={t('m05.routes.my-perf-task.title')} intro={t('m05.pt.taskIntro')} wide eyebrow={<BenchmarkChips feature="FS22" />}
      actions={<L to="/my/assessments/tasks" className="btn-outline btn-sm no-underline" data-testid="m05-pt-back"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m05.pt.back')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => {
        const x = d.tasks.find((r: Row) => r.id === task);
        return x ? <Task d={d} x={x} attempts={c.attempts} reports={c.reports} reload={q.reload} /> : <EmptyState title={t('m05.pt.noTask')} />;
      }}</Async>}</Async>
    </Page>
  );
}

function Task({ d, x, attempts, reports, reload }: { d: FsRef; x: Row; attempts: Row[]; reports: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [seen, setSeen] = useState(false);
  const st = taskStatus(attempts);
  const open = attempts.find((a) => a.status === 'in_progress') ?? attempts.find((a) => a.status === 'submitted') ?? null;
  const scored = [...attempts].filter((a) => a.status === 'scored').sort((a, b) => String(b.scored_at).localeCompare(String(a.scored_at)));
  const start = async () => {
    const r = await act(() => repo.rpc.startPerformanceTask({ task_id: x.id, rubric_seen: seen }), { success: t('m05.pt.started') });
    if (r.ok) reload?.();
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title={pick(x, 'title')} eyebrow={pick(x, 'role')} actions={<StatusPill tone={st.tone}>{t(`m05.pt.status.${st.key}`)}</StatusPill>}>
          <p className="text-[14px] text-ink-2" data-testid="m05-pt-brief">{pick(x, 'brief')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3"><SimChip label={t('m05.pt.simulated')} /><span>{t('m05.pt.minutes', { n: f.num(x.minutes) })}</span></div>
          <div className="mt-3 space-y-2"><SkillLinks ids={x.skill_ids ?? []} d={d} /><GateChips codes={x.gates} d={d} /></div>
          {(x.gates ?? []).length > 0 && <p className="mt-2 text-[12px] text-ink-3">{t('m05.pt.gatingNote')}</p>}
        </Card>
        <Card title={t('m05.pt.rubricTitle')} eyebrow={t('m05.pt.rubricEyebrow')}>
          <RubricView rubric={x.rubric as RubricLine[]} passPct={Number(x.pass_pct)} />
          {!open && (
            <div className="mt-4 space-y-3 border-t border-line pt-3" data-testid="m05-pt-start-box">
              <CheckboxField label={t('m05.pt.rubricSeen')} checked={seen} onChange={setSeen} />
              <button type="button" className="btn-primary" disabled={!seen} onClick={start} data-testid="m05-pt-start">{scored.length ? t('m05.pt.again') : t('m05.pt.start')}</button>
            </div>
          )}
        </Card>
      </div>
      {open ? <Work key={open.id} x={x} a={open} report={reports.find((r) => r.attempt_id === open.id) ?? null} reload={reload} />
        : <Card title={t('m05.pt.dataPreview')}><TrendChart data={x.data as TaskData} /></Card>}
      {scored.length > 0 && <Scored d={d} x={x} a={scored[0]} report={reports.find((r) => r.attempt_id === scored[0].id) ?? null} />}
      {attempts.length > 0 && (
        <Section title={t('m05.pt.history')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m05-pt-history">
            {[...attempts].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at))).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-3 py-2">
                <span>{t('m05.pt.attemptN', { n: f.num(a.attempt_no) })} · {f.date(a.started_at)}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {a.resubmissions > 0 && <span className="text-ink-3">{t('m05.pt.resubs', { n: f.num(a.resubmissions) })}</span>}
                  {a.status === 'scored' ? <StatusPill tone={a.counts === false ? 'bad' : a.passed ? 'ok' : 'accent'}>{a.counts === false ? t('m05.pt.status.voided') : `${f.num(a.total)} / ${f.num(a.max)}`}</StatusPill>
                    : <StatusPill tone="sim">{t(`m05.pt.status.${a.status}`)}</StatusPill>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Work({ x, a, report, reload }: { x: Row; a: Row; report: Row | null; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const data = x.data as TaskData;
  const prev = a.answer && a.answer.series ? a.answer : null;
  const [series, setSeries] = useState<string>(prev?.series ?? data.series[0].key);
  const [index, setIndex] = useState<number>(prev?.index ?? 0);
  const [decision, setDecision] = useState<string>(prev ? String(prev.decision) : '');
  const [checks, setChecks] = useState<string[]>(prev?.checks ?? []);
  const [just, setJust] = useState<string>(prev?.justification ?? '');
  const [confirm, setConfirm] = useState(false);
  const n = useMemo(() => data.series.find((s) => s.key === series)?.values.length ?? 1, [data, series]);
  const label = (i: number) => (Array.isArray((data as Row).labels) ? (data as Row).labels[i] : readingTime(data, i));
  const valid = decision !== '' && just.trim().length >= JUSTIFY_MIN && just.trim().length <= JUSTIFY_MAX;
  const submit = async () => {
    const r = await act(() => repo.rpc.submitPerformanceTask({ attempt_id: a.id, answer: { series, index, decision: Number(decision), checks, justification: just } }),
      { success: a.status === 'submitted' ? t('m05.pt.replaced') : t('m05.pt.submitted') });
    if (r.ok) reload?.();
  };
  const value = data.series.find((s) => s.key === series)?.values[index];
  return (
    <Section title={a.status === 'submitted' ? t('m05.pt.work.waitTitle') : t('m05.pt.work.title')} description={a.status === 'submitted' ? t('m05.pt.work.waitBody') : t('m05.pt.work.intro')}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={t('m05.pt.work.data')} eyebrow={t('m05.pt.work.dataEyebrow')}>
          <TrendChart data={data} mark={{ series, index }} onPick={(s, i) => { setSeries(s); setIndex(i); }} testId="m05-pt-chart" />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <fieldset className="space-y-1">
              <legend className="text-[13px] font-semibold">{t('m05.pt.work.signal')}</legend>
              {data.series.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-[13px]"><input type="radio" name="m05-pt-series" checked={series === s.key} onChange={() => { setSeries(s.key); setIndex(Math.min(index, s.values.length - 1)); }} data-testid={`m05-pt-series-${s.key}`} />{pick(s as unknown as Row, 'label')}</label>
              ))}
            </fieldset>
            <div className="space-y-1">
              <label htmlFor="m05-pt-reading" className="text-[13px] font-semibold">{t('m05.pt.work.reading')}</label>
              <input id="m05-pt-reading" type="range" min={0} max={n - 1} value={index} onChange={(e) => setIndex(Number(e.target.value))} className="w-full" data-testid="m05-pt-reading" />
              <p className="num text-[12.5px] text-ink-2" data-testid="m05-pt-mark">{t('m05.pt.reading', { n: f.num(index + 1), at: label(index) })} · <bdi dir="ltr">{value == null ? '—' : f.num(value)}</bdi></p>
            </div>
          </div>
        </Card>
        <Card title={t('m05.pt.work.decide')}>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold">{t('m05.pt.work.decision')}</legend>
            {(x.decisions ?? []).map((dd: Row, i: number) => (
              <label key={dd.key} className={`flex cursor-pointer items-start gap-2 rounded-card border p-2.5 text-[13.5px] ${decision === String(i) ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="radio" name="m05-pt-decision" className="mt-1" checked={decision === String(i)} onChange={() => setDecision(String(i))} data-testid={`m05-pt-decision-${i}`} />
                <span>{lang === 'ar' ? dd.ar : dd.en}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="mt-3 space-y-1">
            <legend className="mb-1 text-[13px] font-semibold">{t('m05.pt.work.checks')}</legend>
            {(x.checks ?? []).map((c: Row) => (
              <CheckboxField key={c.key} label={lang === 'ar' ? c.ar : c.en} checked={checks.includes(c.key)} onChange={(v) => setChecks((cur) => (v ? [...cur, c.key] : cur.filter((k) => k !== c.key)))} />
            ))}
          </fieldset>
          <div className="mt-3">
            <TextArea label={t('m05.pt.work.justify')} name="justification" value={just} onChange={setJust} rows={5} required
              hint={t('m05.pt.work.justifyHint', { n: f.num(just.trim().length), min: f.num(JUSTIFY_MIN), max: f.num(JUSTIFY_MAX) })} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {a.status === 'submitted' && <span className="text-[12px] text-ink-3">{t('m05.pt.work.resubNote', { n: f.num(a.resubmissions) })}</span>}
            <button type="button" className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m05-pt-submit">{a.status === 'submitted' ? t('m05.pt.work.replace') : t('m05.pt.work.submit')}</button>
          </div>
        </Card>
      </div>
      {report && <Card title={t('m05.ir.title')} eyebrow={t('m05.ir.eyebrow')}><IntegritySummary r={report} /></Card>}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={a.status === 'submitted' ? t('m05.pt.work.replace') : t('m05.pt.work.submit')}
        consequence={a.status === 'submitted' ? t('m05.pt.work.replaceConsequence') : t('m05.pt.work.submitConsequence')} confirmLabel={a.status === 'submitted' ? t('m05.pt.work.replace') : t('m05.pt.work.submit')}
        onConfirm={async () => { await submit(); setConfirm(false); }} />
    </Section>
  );
}

function Scored({ d, x, a, report }: { d: FsRef; x: Row; a: Row; report: Row | null }) {
  const t = useT();
  const f = useFormat();
  const sc = scoreTask(x as never, a.auto_scores ?? { anomaly: 0, decision: 0 }, a.scores ?? {});
  const scores = Object.fromEntries(sc.lines.map((l) => [l.key, l.score]));
  return (
    <Section title={t('m05.pt.res.title')} description={t('m05.pt.res.intro', { date: f.date(a.scored_at) })}>
      {a.counts === false && <Callout tone="bad" title={t('m05.take.res.voidedTitle')}>{t('m05.pt.res.voidedBody')}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title={<span className="flex flex-wrap items-center gap-2" data-testid="m05-pt-result" data-passed={a.passed ? 'yes' : 'no'}>
          <span className="num text-[26px] font-semibold">{f.num(a.total)}</span><span className="text-ink-3">/ {f.num(a.max)}</span>
          <StatusPill tone={a.passed ? 'ok' : a.critical_failed ? 'bad' : 'accent'}>{t(a.passed ? 'm05.pt.res.pass' : a.critical_failed ? 'm05.pt.res.critical' : 'm05.pt.res.notYet')}</StatusPill></span>}
          actions={<WhyThis reasons={sc.reasons} testId="m05-pt-why" />}>
          <RubricView rubric={x.rubric as RubricLine[]} passPct={Number(x.pass_pct)} scores={scores} testId="m05-pt-scored-rubric" />
          {a.comment && <blockquote className="mt-3 rounded-card border-s-4 border-accent bg-sunken p-3 text-[13px]" data-testid="m05-pt-comment">{a.comment}</blockquote>}
        </Card>
        <div className="space-y-4">
          <Card title={t('m05.take.res.evidence')}>
            {(a.evidence ?? []).length ? <SkillLinks ids={a.evidence.map((e: Row) => e.skill_id)} d={d} level={Object.fromEntries(a.evidence.map((e: Row) => [e.skill_id, e.level]))} /> : <p className="text-[13px] text-ink-3">{t('m05.pt.res.noEvidence')}</p>}
          </Card>
          {report && <Card title={t('m05.ir.title')} eyebrow={t('m05.ir.eyebrow')}><IntegritySummary r={report} /></Card>}
          <Card title={t('m05.pt.res.answer')}><TrendChart data={x.data as TaskData} mark={a.answer?.series ? { series: a.answer.series, index: a.answer.index } : null} testId="m05-pt-answer-chart" /></Card>
        </div>
      </div>
    </Section>
  );
}
