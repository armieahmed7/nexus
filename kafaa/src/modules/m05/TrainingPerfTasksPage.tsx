// FS22 /training/perf-tasks (signoff A: instructors and the training manager): the assessor queue. Each submitted attempt opens a scoring
// drawer with the brief, the learner's marked reading against the key window (assessors only), the automatic lines, the assessor lines
// with their published descriptors, a comment and the integrity report. Scoring is an RPC behind a ConfirmDialog (rpc.scorePerformanceTask:
// never one's own attempt; a pass writes F01 evidence; the critical decision line fails the task whatever the total).
import { useState } from 'react';
import { Page, Card, Async, Callout, EmptyState, DataTable, Tabs, BenchmarkChips, StatusPill, Drawer, ConfirmDialog, TextArea, StatTile, type Column } from '../../ui';
import { useQuery, useRepo, useAction } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { scoreTask, type RubricLine, type TaskData } from './perf';
import { IntegritySummary, RubricView, TrendChart, useFsRef, type FsRef, type Row } from './fsui';

export default function TrainingPerfTasksPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useFsRef();
  const q = useQuery(['task_attempts', 'integrity_reports', 'perf_task_keys', 'people'], async () => {
    const [attempts, keys, reports, people] = await Promise.all([
      repo.list('task_attempts' as never).catch(() => [] as Row[]), repo.list('perf_task_keys' as never).catch(() => [] as Row[]),
      repo.list('integrity_reports' as never).catch(() => [] as Row[]), repo.list('people').catch(() => [] as Row[]),
    ]);
    return { attempts: attempts as Row[], keys: keys as Row[], reports: reports as Row[], people: people as Row[] };
  }, []);
  return (
    <Page title={t('m05.routes.training-perf-tasks.title')} intro={t('m05.as.intro')} wide eyebrow={<BenchmarkChips feature="FS22" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => <Body d={d} {...c} reload={q.reload} />}</Async>}</Async>
    </Page>
  );
}

function Body({ d, attempts, keys, reports, people, reload }: { d: FsRef; attempts: Row[]; keys: Row[]; reports: Row[]; people: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const [open, setOpen] = useState<Row | null>(null);
  const taskName = (id: string) => { const x = d.tasks.find((r: Row) => r.id === id); return x ? pick(x, 'title') : id; };
  const personName = (id: string) => { const p = people.find((x) => x.id === id); return p ? pick(p, 'display_name') || p.display_name : id; };
  const queue = attempts.filter((a) => a.status === 'submitted');
  const scored = attempts.filter((a) => a.status === 'scored');
  const cols = (kind: 'queue' | 'scored'): Column<Row>[] => [
    { key: 'person', header: t('m05.as.person'), value: (a) => personName(a.person_id), sortable: true, render: (a) => <span>{personName(a.person_id)}{a.person_id === s.identity.personId && <span className="ms-1 text-[12px] text-ink-3">({t('m05.as.you')})</span>}</span> },
    { key: 'task', header: t('m05.as.task'), value: (a) => taskName(a.task_id), sortable: true },
    { key: 'date', header: kind === 'queue' ? t('m05.as.submitted') : t('m05.as.scoredOn'), value: (a) => (kind === 'queue' ? a.submitted_at : a.scored_at), render: (a) => f.date(kind === 'queue' ? a.submitted_at : a.scored_at), sortable: true },
    { key: 'resub', header: t('m05.as.resubs'), value: (a) => a.resubmissions, align: 'end' },
    { key: 'integrity', header: t('m05.as.integrity'), value: (a) => reports.find((r) => r.attempt_id === a.id)?.status ?? '', render: (a) => {
      const r = reports.find((x) => x.attempt_id === a.id);
      return r ? <StatusPill tone={r.status === 'review' && !r.decision ? 'sim' : r.decision === 'voided' ? 'bad' : 'ok'}>{r.decision ? t(`m05.ir.decision.${r.decision}`) : t(`m05.ir.status.${r.status}`)}</StatusPill> : <span className="text-ink-3">{a.gating ? '—' : t('m05.as.notGating')}</span>;
    } },
    ...(kind === 'scored' ? [{ key: 'total', header: t('m05.as.total'), value: (a: Row) => a.total, render: (a: Row) => <StatusPill tone={a.passed ? 'ok' : a.critical_failed ? 'bad' : 'accent'}>{f.num(a.total)} / {f.num(a.max)}</StatusPill> }] : []),
    { key: 'open', header: '', csv: false, render: (a) => <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(a)} data-testid={`m05-as-open-${a.id}`}>{kind === 'queue' ? t('m05.as.score') : t('m05.as.view')}</button> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m05.as.tile.queue')} value={f.num(queue.length)} tone="info" />
        <StatTile label={t('m05.as.tile.scored')} value={f.num(scored.length)} />
        <StatTile label={t('m05.as.tile.pass')} value={scored.length ? f.pct((100 * scored.filter((a) => a.passed).length) / scored.length, 0) : '—'} sub={t('m05.as.tile.passSub')} tone="ok" />
        <StatTile label={t('m05.as.tile.flagged')} value={f.num(reports.filter((r) => r.kind === 'task' && r.status === 'review' && !r.decision).length)} sub={t('m05.as.tile.flaggedSub')} />
      </div>
      <Callout tone="info" title={t('m05.as.rules.title')}>{t('m05.as.rules.body')}</Callout>
      <Tabs tabs={[
        { id: 'queue', label: t('m05.as.tab.queue'), badge: f.num(queue.length), content: queue.length ? <div data-testid="m05-as-queue"><DataTable rows={queue} columns={cols('queue')} rowKey={(a) => a.id} initialSort={{ key: 'date', dir: 'asc' }} /></div> : <EmptyState title={t('m05.as.empty')} /> },
        { id: 'scored', label: t('m05.as.tab.scored'), badge: f.num(scored.length), content: <div data-testid="m05-as-scored"><DataTable rows={scored} columns={cols('scored')} rowKey={(a) => a.id} initialSort={{ key: 'date', dir: 'desc' }} csvName="performance-task-scores.csv" /></div> },
      ]} />
      {open && <ScoreDrawer d={d} a={open} task={d.tasks.find((x: Row) => x.id === open.task_id)} k={keys.find((x) => x.task_id === open.task_id)} report={reports.find((r) => r.attempt_id === open.id) ?? null}
        person={personName(open.person_id)} self={open.person_id === s.identity.personId} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload?.(); }} />}
    </div>
  );
}

function ScoreDrawer({ d, a, task, k, report, person, self, onClose, onDone }: { d: FsRef; a: Row; task: Row; k: Row | undefined; report: Row | null; person: string; self: boolean; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const rubric = (task?.rubric ?? []) as RubricLine[];
  const manualLines = rubric.filter((l) => l.mode === 'assessor');
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(manualLines.map((l) => [l.key, a.scores?.[l.key] != null ? String(a.scores[l.key]) : ''])));
  const [comment, setComment] = useState(a.comment ?? '');
  const [confirm, setConfirm] = useState(false);
  const ready = manualLines.every((l) => scores[l.key] !== '');
  const preview = ready && task ? scoreTask(task as never, a.auto_scores ?? { anomaly: 0, decision: 0 }, Object.fromEntries(manualLines.map((l) => [l.key, Number(scores[l.key])]))) : null;
  const scored = a.status === 'scored';
  const decision = (task?.decisions ?? [])[a.answer?.decision];
  const submit = async () => {
    const r = await act(() => repo.rpc.scorePerformanceTask({ attempt_id: a.id, scores: Object.fromEntries(manualLines.map((l) => [l.key, Number(scores[l.key])])), comment }), { success: t('m05.as.done') });
    if (r.ok) onDone();
  };
  if (!task) return null;
  return (
    <Drawer open onClose={onClose} title={`${pick(task, 'title')} · ${person}`}
      footer={!scored && <div className="flex flex-wrap items-center justify-end gap-2">
        {self && <span className="text-[12.5px] text-bad">{t('m05.as.selfNote')}</span>}
        <button type="button" className="btn-primary btn-sm" disabled={!ready || self} onClick={() => setConfirm(true)} data-testid="m05-as-submit">{t('m05.as.score')}</button>
      </div>}>
      <div className="space-y-4 text-[13.5px]" data-testid="m05-as-drawer">
        <Card title={t('m05.as.answer')}>
          <TrendChart data={task.data as TaskData} mark={a.answer?.series ? { series: a.answer.series, index: a.answer.index } : null}
            keyWindow={k ? { series: k.series, from: k.from_idx, to: k.to_idx } : null} testId="m05-as-chart" />
          <p className="mt-2 text-[12px] text-ink-3">{t('m05.as.keyNote')}</p>
          {k && <p className="mt-1 text-[12.5px] text-ink-2">{lang === 'ar' ? k.notes_ar : k.notes_en}</p>}
          <dl className="mt-3 space-y-1">
            <dt className="caps">{t('m05.pt.work.decision')}</dt><dd>{decision ? (lang === 'ar' ? decision.ar : decision.en) : '—'}</dd>
            <dt className="caps mt-2">{t('m05.pt.work.checks')}</dt><dd>{(a.answer?.checks ?? []).length ? (a.answer.checks as string[]).map((c) => { const x = (task.checks ?? []).find((y: Row) => y.key === c); return x ? (lang === 'ar' ? x.ar : x.en) : c; }).join(' · ') : t('m05.as.noChecks')}</dd>
            <dt className="caps mt-2">{t('m05.pt.work.justify')}</dt><dd className="whitespace-pre-wrap rounded-card border border-line bg-sunken p-2" data-testid="m05-as-justification">{a.answer?.justification}</dd>
          </dl>
          {a.resubmissions > 0 && <p className="mt-2 text-[12px] text-ink-3">{t('m05.pt.resubs', { n: f.num(a.resubmissions) })}</p>}
        </Card>
        <Card title={t('m05.as.rubric')} eyebrow={t('m05.as.autoNote')}>
          <RubricView rubric={rubric} passPct={Number(task.pass_pct)} scores={{ ...(a.auto_scores ?? {}), ...(scored ? a.scores : Object.fromEntries(Object.entries(scores).filter(([, v]) => v !== '').map(([kk, v]) => [kk, Number(v)]))) }} testId="m05-as-rubric" />
          {!scored && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {manualLines.map((l) => (
                <fieldset key={l.key} className="space-y-1" data-testid={`m05-as-line-${l.key}`}>
                  <legend className="text-[13px] font-semibold">{pick(l as unknown as Row, 'label')}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: l.max + 1 }, (_, i) => (
                      <label key={i} className={`chip cursor-pointer ${scores[l.key] === String(i) ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`}>
                        <input type="radio" className="sr-only" name={`m05-as-${l.key}`} checked={scores[l.key] === String(i)} onChange={() => setScores((cur) => ({ ...cur, [l.key]: String(i) }))} data-testid={`m05-as-${l.key}-${i}`} />
                        <span className="num">{f.num(i)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
          {!scored && <div className="mt-3"><TextArea label={t('m05.as.comment')} name="comment" value={comment} onChange={setComment} rows={3} hint={t('m05.as.commentHint')} /></div>}
          {preview && !scored && (
            <p className="mt-2 text-[13px]" data-testid="m05-as-preview">{t('m05.as.preview', { total: f.num(preview.total), max: f.num(preview.max) })} · <StatusPill tone={preview.passed ? 'ok' : preview.critical_failed ? 'bad' : 'accent'}>{t(preview.passed ? 'm05.pt.res.pass' : preview.critical_failed ? 'm05.pt.res.critical' : 'm05.pt.res.notYet')}</StatusPill></p>
          )}
          {scored && a.comment && <blockquote className="mt-3 rounded-card border-s-4 border-accent bg-sunken p-3 text-[13px]">{a.comment}</blockquote>}
        </Card>
        {report && <Card title={t('m05.ir.title')}><IntegritySummary r={report} /></Card>}
        {a.gating && !report && <Callout tone="bad" title={t('m05.ir.missingTitle')}>{t('m05.ir.missing')}</Callout>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m05.as.confirmTitle')} consequence={t('m05.as.confirmBody', { total: f.num(preview?.total ?? 0), max: f.num(preview?.max ?? 0) })}
        actingAs={t('m05.as.actingAs')} confirmLabel={t('m05.as.score')} onConfirm={async () => { await submit(); setConfirm(false); }} />
    </Drawer>
  );
}
