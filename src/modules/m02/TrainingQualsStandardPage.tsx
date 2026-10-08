// M02 /training/quals/:standard: qualification standard editor with versions. Revising (rpc.reviseStandard) creates a new
// version, carries the task list over (with the edits made in the revision dialog) and lists every record that needs review;
// each flagged record is carried over or sent for retraining (rpc.reviewQualRecord). Evaluators sign off tasks from the
// records tab (rpc.signoffEvaluation; self-sign and missing evaluator qualification are refused and audited).
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Grid, Async, EmptyState, Tabs, KeyValue, StatusPill, Callout, Timeline, DataTable, Drawer, Modal, ConfirmDialog, TextArea, TextField, CheckboxField, SelectField, RadioGroup, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L, useNav } from '../../i18n';
import { useSession } from '../../auth/session';
import { useCrumbLabel } from '../../shell/crumbs';
import { todayIso } from '../../domain/rules';
import { useQualData, TaskTable, QualPill, ExpiryText, PersonName, EvaluationForm, MirrorNote, type QualData, type Std, type Task, type Rec } from './shared';

export default function TrainingQualsStandardPage() {
  const t = useT();
  const { standard = '' } = useParams();
  const q = useQualData();
  const std = q.data?.stdById.get(standard);
  const pick = usePick();
  useCrumbLabel(std ? `${std.code} v${std.version}` : null);
  if (q.data && !std)
    return (
      <Page title={t('m02.routes.training-quals-standard.title')}>
        <EmptyState title={t('m02.std.notFound')} action={<L to="/training/quals" className="btn-outline btn-sm">{t('m02.std.back')}</L>} />
      </Page>
    );
  return (
    <Page title={std ? pick(std, 'title') : t('m02.routes.training-quals-standard.title')} eyebrow={std ? `${std.code} · v${std.version}` : undefined} wide>
      <Async state={q}>{(d) => (std ? <StandardView d={d} std={std} /> : null)}</Async>
    </Page>
  );
}

function chain(d: QualData, std: Std): Std[] {
  const all = d.stds.filter((s) => s.code === std.code).sort((a, b) => b.version - a.version);
  return all;
}

function StandardView({ d, std }: { d: QualData; std: Std }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const s = useSession();
  const nav = useNav();
  const repo = useRepo();
  const roles = useQuery('job_roles', () => repo.list('job_roles').catch(() => []), []);
  const [params, setParams] = useSearchParams();
  const [revise, setRevise] = useState(false);
  const [flagged, setFlagged] = useState<{ id: string; n: number } | null>(null);
  const canEdit = s.can('frameworks', ['W', 'A']) && std.status === 'current';
  const tasks = d.tasksOf(std.id);
  const rule = d.rules.find((r) => r.standard_id === std.id) ?? d.rules.find((r) => d.stdById.get(r.standard_id)?.code === std.code);
  const versions = chain(d, std);
  const current = versions.find((v) => v.status === 'current');
  const allVersionIds = new Set(versions.map((v) => v.id));
  const me = s.identity.personId;
  const recs = d.records.filter((r) => allVersionIds.has(r.standard_id) && r.person_id !== me);
  const review = recs.filter((r) => r.needs_review);
  const tab = params.get('tab') ?? (params.get('record') ? 'records' : 'tasks');
  const setTab = (id: string) => {
    const p = new URLSearchParams(params);
    p.set('tab', id);
    setParams(p, { replace: true });
  };
  return (
    <>
      {std.status === 'superseded' && current && (
        <Callout tone="sim" title={t('m02.std.supersededTitle')}>
          {t('m02.std.supersededBody', { v: current.version })} <L to={`/training/quals/${current.id}`}>{t('m02.std.openCurrent')}</L>
        </Callout>
      )}
      {flagged && (
        <Callout tone="ok" title={t('m02.std.revisedTitle')}>
          {t('m02.std.revisedBody', { n: f.num(flagged.n) })}
        </Callout>
      )}
      {std.security_restricted && <Callout tone="info" title={t('m02.std.restrictedTitle')}>{t('m02.std.restrictedBody')}</Callout>}
      <Grid cols={2}>
        <Card
          title={t('m02.std.details')}
          actions={
            canEdit && (
              <button className="btn-primary btn-sm" onClick={() => setRevise(true)} data-testid="m02-revise">
                {t('m02.std.revise')}
              </button>
            )
          }
        >
          <KeyValue
            items={[
              [t('m02.stds.code'), <span className="num">{std.code}</span>],
              [t('m02.stds.version'), <span className="flex items-center gap-2"><span className="num">v{std.version}</span><StatusPill status={std.status}>{t(`m02.stdStatus.${std.status}`)}</StatusPill></span>],
              [t('m02.matrix.discipline'), std.discipline],
              [t('m02.std.owner'), std.owner_role],
              [t('m02.std.effective'), f.date(std.effective_date)],
              [t('m02.std.roles'), (std.role_ids ?? []).length ? (std.role_ids ?? []).map((r) => <L key={r} to={`/careers/roles/${r}`} className="me-2">{pick(roles.data?.find((x) => x.id === r), 'title') || r}</L>) : t('m02.std.allStaff')],
              [t('m02.stds.requal'), std.requal_months ? t('m02.stds.months', { n: f.num(std.requal_months) }) : '—'],
              [t('m02.std.notices'), rule ? (Array.isArray(rule.notice_days) ? (rule.notice_days as number[]).map((n) => t('m02.std.daysBefore', { n })).join(' · ') : '—') : t('m02.std.defaultNotices')],
            ]}
          />
          {std.change_reason && <p className="mt-3 text-[13px] text-ink-2">{t('m02.std.changeReason')}: {std.change_reason}</p>}
        </Card>
        <Card title={t('m02.std.satTitle')}>
          <p className="text-[13.5px] text-ink-2">{t('m02.std.satBody')}</p>
          {rule && <p className="mt-2 text-[13px]">{pick(rule, 'description')}</p>}
        </Card>
      </Grid>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'tasks', label: t('m02.std.tabTasks'), badge: tasks.length, content: <TaskList d={d} std={std} tasks={tasks} /> },
          { id: 'records', label: t('m02.std.tabRecords'), badge: recs.length, content: <Records d={d} std={std} recs={recs} /> },
          { id: 'review', label: t('m02.std.tabReview'), badge: review.length, content: <ReviewList d={d} recs={review} /> },
          {
            id: 'versions',
            label: t('m02.std.tabVersions'),
            badge: versions.length,
            content: (
              <Timeline
                items={versions.map((v) => ({
                  id: v.id,
                  when: `v${v.version} · ${f.date(v.effective_date)}`,
                  title: (
                    <span className="flex items-center gap-2">
                      <L to={`/training/quals/${v.id}`}>{pick(v, 'title')}</L>
                      <StatusPill status={v.status}>{t(`m02.stdStatus.${v.status}`)}</StatusPill>
                    </span>
                  ),
                  detail: v.change_reason ?? t('m02.std.initialVersion'),
                  tone: v.status === 'current' ? 'ok' : 'neutral',
                }))}
              />
            ),
          },
        ]}
      />
      {canEdit && (
        <ReviseDialog
          key={std.id}
          open={revise}
          onClose={() => setRevise(false)}
          d={d}
          std={std}
          tasks={tasks}
          onDone={(newId, n) => {
            setFlagged({ id: newId, n });
            nav(`/training/quals/${newId}?tab=review`);
          }}
        />
      )}
    </>
  );
}

function TaskList({ d, std, tasks }: { d: QualData; std: Std; tasks: Task[] }) {
  const t = useT();
  const pick = usePick();
  if (std.security_restricted) return <Callout tone="info">{t('m02.std.restrictedBody')}</Callout>;
  if (!tasks.length) return <EmptyState title={t('m02.noTasks')} />;
  const jpmOf = (task: Task) => d.jpms.find((j) => j.task_id === task.id || (j.standard_id === std.id && j.code.endsWith(task.code)));
  return (
    <ol className="space-y-2" data-testid="m02-std-tasks">
      {tasks.map((task) => {
        const j = jpmOf(task);
        return (
          <li key={task.id} className="card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="num text-[12px] text-ink-3">{task.code}</span>
                {task.critical && <StatusPill tone="bad">{t('m02.task.critical')}</StatusPill>}
                <StatusPill tone="neutral">{t(`m02.method.${task.method}`)}</StatusPill>
              </div>
              <span className="text-[12.5px] text-ink-2">{t('m02.std.evaluatorRole', { role: task.evaluator_role })}</span>
            </div>
            <div className="mt-1 font-semibold">{pick(task, 'statement')}</div>
            {(task.conditions_en || task.standards_en) && (
              <div className="mt-1 grid grid-cols-1 gap-1 text-[12.5px] text-ink-2 sm:grid-cols-2">
                {task.conditions_en && <span><span className="caps me-1">{t('m02.std.conditions')}</span>{task.conditions_en}</span>}
                {task.standards_en && <span><span className="caps me-1">{t('m02.std.standard')}</span>{task.standards_en}</span>}
              </div>
            )}
            {j && (
              <div className="mt-2 rounded-btn border border-line bg-sunken p-2 text-[12.5px]">
                <span className="caps me-1">JPM</span>
                <span className="num me-1">{j.code}</span>
                {t('m02.std.jpmSteps', { n: Array.isArray(j.critical_steps) ? j.critical_steps.length : 0, c: Array.isArray(j.critical_steps) ? (j.critical_steps as { critical: boolean }[]).filter((x) => x.critical).length : 0 })} · {t('m02.std.jpmTime', { n: j.time_limit_min })}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Records({ d, std, recs }: { d: QualData; std: Std; recs: Rec[] }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const [params, setParams] = useSearchParams();
  const [task, setTask] = useState<Task | null>(null);
  const open = recs.find((r) => r.id === params.get('record')) ?? null;
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('record', id);
    else p.delete('record');
    setParams(p, { replace: true });
  };
  const today = todayIso();
  const isEvaluator = d.evaluatorQuals.some((q) => q.person_id === s.identity.personId && q.standard_id === std.id && q.valid_to >= today);
  const canSign = s.can('signoff', ['A']);
  return (
    <div className="space-y-3">
      {canSign && !isEvaluator && <Callout tone="sim" title={t('m02.eval.notEvaluatorTitle')}>{t('m02.eval.notEvaluatorBody')}</Callout>}
      <div data-testid="m02-std-records">
        <DataTable
          rows={recs}
          rowKey={(r) => r.id}
          csvName={`${std.code}-records`}
          empty={<EmptyState title={t('m02.std.noRecords')}>{t('m02.std.noRecordsBody')}</EmptyState>}
          onRowClick={(r) => setOpen(r.id)}
          columns={[
            { key: 'person', header: t('m02.team.person'), value: (r) => d.personById.get(r.person_id)?.display_name ?? r.person_id, render: (r) => <PersonName p={d.personById.get(r.person_id)} />, sortable: true },
            { key: 'version', header: t('m02.stds.version'), value: (r) => r.standard_version, render: (r) => <span className="num">v{r.standard_version}</span> },
            { key: 'status', header: t('m02.task.status'), value: (r) => r.status, render: (r) => <span className="flex gap-1"><QualPill rec={r} />{r.needs_review && <StatusPill tone="sim">{t('m02.needsReview')}</StatusPill>}</span>, sortable: true },
            { key: 'q', header: t('m02.qualifiedOn'), value: (r) => r.qualified_on ?? '', render: (r) => (r.qualified_on ? f.date(r.qualified_on) : '—') },
            { key: 'exp', header: t('m02.task.expiry'), value: (r) => r.expires_on ?? '', render: (r) => <ExpiryText rec={r} />, sortable: true },
          ]}
        />
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? <PersonName p={d.personById.get(open.person_id)} /> : ''}>
        {open && (
          <div className="space-y-3" data-testid="m02-record-drawer">
            <div className="flex flex-wrap items-center gap-2">
              <QualPill rec={open} />
              <span className="text-[13px]">
                <span className="caps me-1">{t('m02.task.expiry')}</span>
                <ExpiryText rec={open} />
              </span>
            </div>
            <MirrorNote system={open.source_system} synced={open.last_synced} />
            {open.needs_review && <Callout tone="sim" title={t('m02.needsReview')}>{open.review_reason}</Callout>}
            {open.standard_id !== std.id && <Callout tone="info">{t('m02.std.recordOnOtherVersion', { v: open.standard_version })}</Callout>}
            <TaskTable rec={open} data={d} onEvaluate={canSign && !open.security_mirror_only && open.standard_id === std.id ? setTask : undefined} />
          </div>
        )}
      </Drawer>
      <Modal open={!!task && !!open} onClose={() => setTask(null)} title={t('m02.eval.title')} size="lg">
        {task && open && <EvaluationForm rec={open} task={task} data={d} onDone={() => setTask(null)} />}
      </Modal>
    </div>
  );
}

function ReviewList({ d, recs }: { d: QualData; recs: Rec[] }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const s = useSession();
  const [rec, setRec] = useState<Rec | null>(null);
  const [decision, setDecision] = useState<'carry_over' | 'retrain'>('carry_over');
  const canReview = s.can('frameworks', ['W', 'A']);
  if (!recs.length) return <EmptyState title={t('m02.std.noReview')} icon="check">{t('m02.std.noReviewBody')}</EmptyState>;
  return (
    <div className="space-y-3">
      <Callout tone="sim" title={t('m02.std.reviewTitle', { n: recs.length })}>
        {t('m02.std.reviewBody')}
      </Callout>
      <div data-testid="m02-review-list">
        <DataTable
          rows={recs}
          rowKey={(r) => r.id}
          csvName="records-needing-review"
          columns={[
            { key: 'person', header: t('m02.team.person'), value: (r) => d.personById.get(r.person_id)?.display_name ?? r.person_id, render: (r) => <PersonName p={d.personById.get(r.person_id)} />, sortable: true },
            { key: 'status', header: t('m02.task.status'), value: (r) => r.status, render: (r) => <QualPill rec={r} /> },
            { key: 'reason', header: t('m02.std.reason'), value: (r) => r.review_reason ?? '' },
            { key: 'act', header: '', csv: false, render: (r) => (canReview ? <button className="btn-outline btn-sm" onClick={() => setRec(r)} data-testid="m02-review-record">{t('m02.std.reviewAction')}</button> : null) },
          ]}
        />
      </div>
      <ConfirmDialog
        open={!!rec}
        onClose={() => setRec(null)}
        title={t('m02.std.reviewAction')}
        consequence={t('m02.std.reviewConsequence')}
        requireReason
        reasonLabel={t('m02.std.reviewNote')}
        onConfirm={(note) => act(() => repo.rpc.reviewQualRecord(rec!.id, decision, note))}
      >
        <RadioGroup
          label={t('m02.std.decision')}
          name="decision"
          value={decision}
          onChange={(v) => setDecision(v as 'carry_over' | 'retrain')}
          options={[
            { value: 'carry_over', label: t('m02.std.carryOver') },
            { value: 'retrain', label: t('m02.std.retrain') },
          ]}
        />
      </ConfirmDialog>
    </div>
  );
}

type Draft = { id: string; statement_en: string; statement_ar: string; critical: boolean; evaluator_role: string; method: string; isNew?: boolean };
function ReviseDialog({ open, onClose, d, std, tasks, onDone }: { open: boolean; onClose: () => void; d: QualData; std: Std; tasks: Task[]; onDone: (newId: string, flagged: number) => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const f = useFormat();
  const [reason, setReason] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(() => tasks.map((x) => ({ id: x.id, statement_en: x.statement_en, statement_ar: x.statement_ar, critical: x.critical, evaluator_role: x.evaluator_role, method: x.method })));
  const [busy, setBusy] = useState(false);
  const affected = d.records.filter((r) => r.standard_id === std.id && ['qualified', 'due', 'in_progress'].includes(r.status)).length;
  const upd = (i: number, p: Partial<Draft>) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const submit = async () => {
    setBusy(true);
    try {
      const r = await act(() => repo.rpc.reviseStandard(std.id, reason.trim()));
      if (!r.ok || !r.data) return;
      const v = std.version + 1;
      let n = tasks.length;
      for (const dr of drafts) {
        if (dr.isNew) {
          n++;
          if (!dr.statement_en.trim()) continue;
          await repo.insert('task_items', { id: `${r.data.new_id}-t${n}`, standard_id: r.data.new_id, code: `${std.code}-T${n}`, statement_en: dr.statement_en, statement_ar: dr.statement_ar || dr.statement_en, method: dr.method as Task['method'], evaluator_role: dr.evaluator_role || 'Instructor / evaluator', critical: dr.critical, sort: n });
        } else {
          const orig = tasks.find((x) => x.id === dr.id)!;
          if (orig.statement_en !== dr.statement_en || orig.statement_ar !== dr.statement_ar || orig.critical !== dr.critical || orig.evaluator_role !== dr.evaluator_role || orig.method !== dr.method)
            await repo.update('task_items', `${dr.id}-v${v}`, { statement_en: dr.statement_en, statement_ar: dr.statement_ar, critical: dr.critical, evaluator_role: dr.evaluator_role, method: dr.method as Task['method'] });
        }
      }
      onClose();
      onDone(r.data.new_id, r.data.flagged);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('m02.std.reviseTitle', { code: std.code, v: std.version + 1 })}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" disabled={busy || reason.trim().length < 5} onClick={submit} data-testid="m02-revise-confirm">
            {busy ? t('common.working') : t('m02.std.createVersion')}
          </button>
        </>
      }
    >
      <div className="space-y-4" data-testid="m02-revise-dialog">
        <Callout tone="sim" title={t('m02.std.impactTitle')}>
          {t('m02.std.impactBody', { n: f.num(affected) })}
        </Callout>
        <TextArea label={t('m02.std.changeReason')} name="reason" value={reason} onChange={setReason} required rows={2} hint={t('m02.std.reasonHint')} />
        <div className="space-y-3">
          <div className="caps">{t('m02.std.taskEdits')}</div>
          {drafts.map((dr, i) => (
            <div key={dr.id} className="rounded-card border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="num text-[12px] text-ink-3">{dr.isNew ? t('m02.std.newTask') : tasks.find((x) => x.id === dr.id)?.code}</span>
                <CheckboxField label={t('m02.task.critical')} checked={dr.critical} onChange={(v) => upd(i, { critical: v })} />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <TextField label={t('m02.std.statementEn')} name={`en-${i}`} value={dr.statement_en} onChange={(v) => upd(i, { statement_en: v })} />
                <TextField label={t('m02.std.statementAr')} name={`ar-${i}`} value={dr.statement_ar} onChange={(v) => upd(i, { statement_ar: v })} />
                <SelectField label={t('m02.task.method')} name={`m-${i}`} value={dr.method} onChange={(v) => upd(i, { method: v })} options={['ojt', 'jpm', 'simulator', 'classroom', 'written', 'equivalency'].map((m) => ({ value: m, label: t(`m02.method.${m}`) }))} />
                <TextField label={t('m02.task.evaluator')} name={`e-${i}`} value={dr.evaluator_role} onChange={(v) => upd(i, { evaluator_role: v })} />
              </div>
            </div>
          ))}
          <button className="btn-outline btn-sm" onClick={() => setDrafts((ds) => [...ds, { id: `new-${ds.length}`, statement_en: '', statement_ar: '', critical: false, evaluator_role: 'Instructor / evaluator', method: 'ojt', isNew: true }])} data-testid="m02-add-task">
            <Icon name="plus" size={13} className="me-1 inline" />
            {t('m02.std.addTask')}
          </button>
        </div>
        <div className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info">
          <Icon name="shield" size={14} className="mt-0.5" />
          <span>{t('common.evidenceRecorded')}</span>
        </div>
      </div>
    </Modal>
  );
}
