/** M02 shared UI: data hook, status pill with security masking, mirror note, task table, gap analysis and evaluation sheet. */
import { useState } from 'react';
import { useQuery, useRepo, useAction } from '../../data';
import type { RowOf, Query } from '../../data';
import { StatusPill, Callout, EmptyState, ConfirmDialog, SelectField, TextField, CheckboxField, TextArea, Icon } from '../../ui';
import { useT, usePick, useFormat, systemName } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { displayView, viewTone, taskRows, ackState, qualGap, type EvalLite, type GapStatus } from './quals';

export type Std = RowOf<'qual_standards'>;
export type Task = RowOf<'task_items'>;
export type Rec = RowOf<'qual_records'>;
export type Ev = RowOf<'evaluations'>;
export type Ack = RowOf<'evaluation_acks'>;
export type Person = RowOf<'people'>;

/** Everything the qualification pages need, filtered to the records the caller can see (RLS applies in both backends). */
export function useQualData(recordQuery: Query<Rec> = {}, deps: unknown[] = []) {
  const repo = useRepo();
  return useQuery(['qual_standards', 'task_items', 'qual_records', 'evaluations', 'evaluation_acks', 'requal_rules', 'people', 'jpms', 'evaluator_quals'], async () => {
    const [stds, tasks, records, evals, acks, rules, people, jpms, evaluatorQuals] = await Promise.all([
      repo.list('qual_standards', { order: [['code', 'asc'], ['version', 'desc']] }),
      repo.list('task_items', { order: [['sort', 'asc']] }),
      repo.list('qual_records', recordQuery),
      repo.list('evaluations'),
      repo.list('evaluation_acks'),
      repo.list('requal_rules'),
      repo.list('people'),
      repo.list('jpms').catch(() => [] as RowOf<'jpms'>[]),
      repo.list('evaluator_quals'),
    ]);
    return {
      stds, tasks, records, evals, acks, rules, people, jpms, evaluatorQuals,
      stdById: new Map(stds.map((s) => [s.id, s])),
      personById: new Map(people.map((p) => [p.id, p])),
      tasksOf: (sid: string) => tasks.filter((x) => x.standard_id === sid),
    };
  }, deps);
}
export type QualData = NonNullable<ReturnType<typeof useQualData>['data']>;

export function QualPill({ rec }: { rec: Rec }) {
  const t = useT();
  const v = displayView(rec);
  return <StatusPill tone={viewTone(v.view)}>{v.view === 'not_qualified' ? t('m02.status.not_qualified') : t(`m02.status.${v.view}`)}</StatusPill>;
}

export function MirrorNote({ system, synced }: { system: string; synced: string }) {
  const t = useT();
  const f = useFormat();
  return <span className="text-[12px] text-ink-3">{t('m02.mirror.asRecorded', { system: systemName(t, system), date: f.dateTime(synced) })}</span>;
}

export function ExpiryText({ rec }: { rec: Rec }) {
  const t = useT();
  const f = useFormat();
  const v = displayView(rec);
  if (v.masked) return <span className="text-ink-3">{t('m02.masked')}</span>;
  if (!rec.expires_on) return <span className="text-ink-3">—</span>;
  return (
    <span>
      {f.date(rec.expires_on)}
      {v.days != null && <span className={`ms-1.5 text-[12px] ${v.days < 0 ? 'text-bad' : v.days <= 30 ? 'text-sim' : 'text-ink-3'}`}>({v.days < 0 ? t('m02.expiredAgo', { n: f.num(-v.days) }) : t('m02.inDays', { n: f.num(v.days) })})</span>}
    </span>
  );
}

/** Task-by-task status of one record: status, evaluator role, date, expiry, supervisor acknowledgement. */
export function TaskTable({ rec, data, onEvaluate }: { rec: Rec; data: QualData; onEvaluate?: (task: Task) => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const std = data.stdById.get(rec.standard_id);
  const tasks = data.tasksOf(rec.standard_id);
  if (rec.security_mirror_only) return <Callout tone="info">{t('m02.securityMasked')}</Callout>;
  if (!tasks.length) return <EmptyState title={t('m02.noTasks')} />;
  const rows = taskRows(tasks.map((x) => x.id), rec.id, data.evals as EvalLite[]);
  return (
    <div className="overflow-x-auto" tabIndex={0}>
      <table className="table-base w-full min-w-[720px]" data-testid="m02-task-table">
        <thead>
          <tr>
            <th className="text-start">{t('m02.task.task')}</th>
            <th className="text-start">{t('m02.task.method')}</th>
            <th className="text-start">{t('m02.task.status')}</th>
            <th className="text-start">{t('m02.task.evaluator')}</th>
            <th className="text-start">{t('m02.task.date')}</th>
            <th className="text-start">{t('m02.task.expiry')}</th>
            <th className="text-start">{t('m02.task.ack')}</th>
            {onEvaluate && <th />}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => {
            const r = rows[i];
            const ack = r.latest ? ackState(r.latest as EvalLite, data.acks) : 'none';
            return (
              <tr key={task.id} data-status={r.status}>
                <td>
                  <div className="flex items-start gap-1.5">
                    <span className="num text-[12px] text-ink-3">{task.code}</span>
                    {task.critical && <StatusPill tone="bad">{t('m02.task.critical')}</StatusPill>}
                  </div>
                  <div>{pick(task, 'statement')}</div>
                </td>
                <td>{t(`m02.method.${task.method}`)}</td>
                <td>
                  <StatusPill status={r.status === 'not_started' ? 'not_started' : r.status}>{t(`m02.taskStatus.${r.status}`)}</StatusPill>
                  {r.latest?.critical_failed && <div className="text-[11.5px] text-bad">{t('m02.task.criticalFailed')}</div>}
                  {r.latest?.correction_of && <div className="text-[11.5px] text-ink-3">{t('m02.task.corrected')}</div>}
                </td>
                <td className="text-[13px]">{r.latest?.evaluator_role ?? task.evaluator_role}</td>
                <td className="text-[13px]">{r.latest && r.latest.result !== 'pending' ? f.date(r.latest.date) : '—'}</td>
                <td className="text-[13px]">{r.status === 'passed' && rec.expires_on ? f.date(rec.expires_on) : '—'}</td>
                <td>{ack === 'none' ? '—' : <StatusPill tone={ack === 'acknowledged' ? 'ok' : 'sim'}>{t(`m02.ack.${ack}`)}</StatusPill>}</td>
                {onEvaluate && (
                  <td>
                    <button className="btn-outline btn-sm" onClick={() => onEvaluate(task)} data-testid="m02-evaluate-task">
                      {t('m02.eval.evaluate')}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {std?.requal_months ? <p className="mt-2 text-[12px] text-ink-3">{t('m02.requalNote', { n: f.num(std.requal_months) })}</p> : null}
    </div>
  );
}

const GAP_TONE: Record<GapStatus, 'ok' | 'sim' | 'bad' | 'info' | 'neutral'> = { held: 'ok', due: 'sim', expired: 'bad', in_progress: 'info', suspended: 'bad', missing: 'neutral', needs_review: 'sim' };
/** Required standards for a role against a person's records. */
export function QualGapTable({ data, personId, roleId }: { data: QualData; personId: string; roleId: string | null | undefined }) {
  const t = useT();
  const pick = usePick();
  const gap = qualGap(data.stds, data.records.filter((r) => r.person_id === personId), roleId);
  if (!gap.length) return <EmptyState title={t('m02.gap.none')} />;
  const held = gap.filter((g) => g.status === 'held').length;
  return (
    <div className="space-y-2" data-testid="m02-gap">
      <p className="text-[13px] text-ink-2">{t('m02.gap.summary', { held, total: gap.length })}</p>
      <ul className="divide-y divide-line rounded-card border border-line bg-panel">
        {gap.map((g) => (
          <li key={g.standard.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5" data-status={g.status}>
            <div>
              <span className="num me-1.5 text-[12px] text-ink-3">{g.standard.code}</span>
              {pick(g.standard, 'title')}
            </div>
            <StatusPill tone={GAP_TONE[g.status]}>{t(`m02.gap.${g.status}`)}</StatusPill>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Evaluation form for one task on one record: pass/fail, method, date, critical step failure, correction with reason. */
export function EvaluationForm({ rec, task, data, onDone }: { rec: Rec; task: Task; data: QualData; onDone: () => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const pick = usePick();
  const f = useFormat();
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [method, setMethod] = useState<string>(task.method);
  const [date, setDate] = useState(todayIso());
  const [crit, setCrit] = useState(false);
  const [correct, setCorrect] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const history = taskRows([task.id], rec.id, data.evals as EvalLite[])[0].history.filter((e) => e.result !== 'pending');
  const person = data.personById.get(rec.person_id);
  const self = rec.person_id === s.identity.personId;
  const invalid = (!!correct && reason.trim().length < 5) || !date;
  return (
    <div className="space-y-3" data-testid="m02-eval-form">
      <div className="text-[13px] text-ink-2">
        <span className="num me-1.5">{task.code}</span>
        {pick(task, 'statement')}
      </div>
      {self && <Callout tone="bad" title={t('m02.eval.selfTitle')}>{t('m02.eval.selfBody')}</Callout>}
      {task.critical && <Callout tone="info">{t('m02.eval.criticalNote')}</Callout>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField label={t('m02.eval.result')} name="result" value={result} onChange={(v) => setResult(v as 'pass' | 'fail')} options={[{ value: 'pass', label: t('common.status.pass') }, { value: 'fail', label: t('common.status.fail') }]} />
        <SelectField label={t('m02.task.method')} name="method" value={method} onChange={setMethod} options={['ojt', 'jpm', 'simulator', 'classroom', 'written', 'equivalency'].map((m) => ({ value: m, label: t(`m02.method.${m}`) }))} />
        <TextField label={t('m02.task.date')} name="date" type="date" value={date} onChange={setDate} required />
      </div>
      {task.critical && <CheckboxField label={t('m02.eval.criticalFailed')} checked={crit} onChange={setCrit} hint={t('m02.eval.criticalHint')} />}
      {history.length > 0 && (
        <SelectField
          label={t('m02.eval.correct')}
          name="correct"
          value={correct}
          onChange={setCorrect}
          placeholder={t('m02.eval.noCorrection')}
          options={history.map((e) => ({ value: e.id, label: `${f.date(e.date)} · ${t(`common.status.${e.result}`)} · ${e.evaluator_role}` }))}
          hint={t('m02.eval.correctHint')}
        />
      )}
      {correct && <TextArea label={t('m02.eval.correctionReason')} name="reason" value={reason} onChange={setReason} required rows={2} />}
      <div className="flex justify-end gap-2">
        <button className="btn-outline" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button className="btn-primary" disabled={invalid} onClick={() => setConfirm(true)} data-testid="m02-eval-submit">
          {t('m02.eval.sign')}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m02.eval.confirmTitle')}
        consequence={t('m02.eval.confirmBody', { result: t(`common.status.${crit ? 'fail' : result}`), task: task.code, person: person?.display_name ?? rec.person_id })}
        actingAs={t('m02.eval.actingAs')}
        onConfirm={async () => {
          const r = await act(() => repo.rpc.signoffEvaluation({ record_id: rec.id, task_id: task.id, method, result, date, critical_failed: crit, correction_of: correct || null, correction_reason: correct ? reason : null }));
          if (r.ok) onDone();
        }}
      />
    </div>
  );
}

export function PersonName({ p }: { p: Person | undefined }) {
  const pick = usePick();
  if (!p) return <span className="text-ink-3">—</span>;
  return <span>{pick({ x_en: p.display_name, x_ar: p.display_name_ar || p.display_name }, 'x')}</span>;
}

export function NoticeChip({ rec }: { rec: Rec }) {
  const t = useT();
  const v = displayView(rec);
  if (v.masked || v.notice == null) return null;
  return (
    <span className="chip border-sim-line bg-sim-bg text-sim">
      <Icon name="bell" size={11} className="me-1 inline" />
      {t('m02.notice', { n: v.notice })}
    </span>
  );
}

