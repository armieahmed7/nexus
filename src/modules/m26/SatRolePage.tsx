// /training/sat/roles/:roleId (M26 · F27): the job analysis of one role. Task inventory with the DIF survey consensus, the rule's
// proposal ("Why this?") and the recorded decision; the task-to-training matrix (task -> objectives -> courses, modules, JPMs)
// with coverage gaps (a train-selected task with no objective) and orphan objectives; the role's SAT changes; and the analysis
// lifecycle (draft -> DIF survey -> approved by the training manager). Restricted roles are never analysed in Kafa'a.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, Tabs, StatTile, DataTable, WhyThis, Modal, ConfirmDialog, TextField, CheckboxField, SelectField, type Column } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useNav, usePick, useT } from '../../i18n';
import { RESTRICTED_FAMILIES, SELECTED } from './sat';
import { AnalysisPill, DecisionPill, DifDots, RestrictedChip, SourceChip, useSatData, useSatModel, type SatData, type SatModel } from './ui';

export default function SatRolePage() {
  const t = useT();
  const { roleId = '' } = useParams();
  const q = useSatData();
  const m = useSatModel(q.data);
  const title = m ? m.roleName(roleId) : t('m26.routes.training-sat-role.title');
  return (
    <Page title={title} eyebrow={t('m26.role.eyebrow')} intro={t('m26.role.intro')} wide>
      <Async state={q}>{(d) => (m && m.role.get(roleId) ? <RoleView d={d} m={m} roleId={roleId} /> : <EmptyState title={t('m26.role.notFound')} action={<L to="/training/sat" className="btn-outline no-underline">{t('m26.common.back')}</L>} />)}</Async>
    </Page>
  );
}

function RoleView({ d, m, roleId }: { d: SatData; m: SatModel; roleId: string }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const role = m.role.get(roleId)!;
  const restricted = role.security_sensitive || RESTRICTED_FAMILIES.includes(role.family_id);
  const an = m.analysisOf(roleId);
  const status = an?.status ?? 'draft';
  const canW = s.can('sat', ['W', 'A']);
  const canA = s.can('sat', ['A']);
  const [move, setMove] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  if (restricted) {
    return <Callout tone="sim" title={t('m26.restricted.chip')}>{t('m26.restricted.body')}</Callout>;
  }
  const tasks = d.tasks.filter((x) => x.role_id === roleId);
  const active = tasks.filter((x) => x.status === 'active');
  const cov = m.coverageOf(roleId);
  const undecided = active.filter((x) => x.decision === 'pending').length;
  const next = status === 'draft' ? ['survey', 'approved'] : status === 'survey' ? ['approved', 'draft'] : ['draft'];
  const allowed = (to: string) => (to === 'approved' || status === 'approved' ? canA : canW);
  const changes = d.changes.filter((c) => c.role_id === roleId);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" data-testid="m26-role-header">
        <AnalysisPill status={status} />
        <span className="text-[12.5px] text-ink-2">{t('m26.role.version', { n: f.num(an?.version ?? 1) })}</span>
        {an?.approved_on && status === 'approved' && <span className="text-[12.5px] text-ink-2">{t('m26.role.approvedOn', { date: f.date(an.approved_on) })}</span>}
        {an?.survey_opened_on && status === 'survey' && <span className="text-[12.5px] text-ink-2">{t('m26.role.surveySince', { date: f.date(an.survey_opened_on) })}</span>}
        <span className="flex-1" />
        {next.filter(allowed).map((to) => (
          <button key={to} className={to === 'approved' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setMove(to)} disabled={to === 'approved' && undecided > 0} title={to === 'approved' && undecided ? t('m26.role.undecidedHint', { n: undecided }) : undefined} data-testid={`m26-analysis-${to}`}>
            {t(`m26.role.move.${to}`)}
          </button>
        ))}
        {canW && <button className="btn-outline btn-sm" onClick={() => setAdd(true)} data-testid="m26-add-task">{t('m26.role.addTask')}</button>}
        <L to={`/training/sat/roles/${roleId}/report`} className="btn-ghost btn-sm no-underline" data-testid="m26-report-link">{t('m26.role.report')}</L>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label={t('m26.sat.tileTasks')} value={f.num(active.filter((x) => !x.restricted).length)} sub={t('m26.role.tileFromCards', { n: f.num(active.filter((x) => x.source === 'qual_card').length) })} />
        <StatTile label={t('m26.role.tileSelected')} value={f.num(cov.selected)} sub={t('m26.role.tileUndecided', { n: f.num(undecided) })} />
        <StatTile label={t('m26.sat.tileCoverage')} value={cov.pct == null ? '—' : f.pct(cov.pct, 0)} tone={cov.gaps.length ? 'info' : 'ok'} sub={t('m26.sat.tileCoverageSub', { a: f.num(cov.covered), b: f.num(cov.selected) })} />
        <StatTile label={t('m26.sat.tileGaps')} value={f.num(cov.gaps.length)} tone={cov.gaps.length ? 'bad' : 'ok'} sub={t('m26.sat.tileOrphans', { n: f.num(cov.orphans.length) })} />
        <StatTile label={t('m26.sat.tileChanges')} value={f.num(changes.filter((c) => c.status === 'open').length)} sub={t('m26.role.tileChangesSub', { n: f.num(changes.length) })} />
      </div>
      <Tabs tabs={[
        { id: 'inventory', label: t('m26.role.tabInventory'), content: <Inventory d={d} m={m} roleId={roleId} /> },
        { id: 'matrix', label: t('m26.role.tabMatrix'), badge: cov.gaps.length ? <span className="chip border-bad-line bg-bad-bg text-bad">{f.num(cov.gaps.length)}</span> : undefined, content: <Matrix d={d} m={m} roleId={roleId} /> },
        { id: 'changes', label: t('m26.role.tabChanges'), content: <RoleChanges d={d} m={m} roleId={roleId} /> },
      ]} />
      <ConfirmDialog open={!!move} onClose={() => setMove(null)} title={t(`m26.role.move.${move ?? 'draft'}`)} consequence={t(`m26.role.moveBody.${move ?? 'draft'}`)}
        actingAs={move === 'approved' || status === 'approved' ? t('m26.common.asTm') : t('m26.common.asStaff')} confirmLabel={t(`m26.role.move.${move ?? 'draft'}`)}
        onConfirm={async () => { if (move) await run(() => repo.rpc.setAnalysisStatus(roleId, move as 'draft' | 'survey' | 'approved')); }} />
      <AddTaskModal open={add} roleId={roleId} onClose={() => setAdd(false)} />
    </div>
  );
}

type TaskRow = SatData['tasks'][number];
function Inventory({ d, m, roleId }: { d: SatData; m: SatModel; roleId: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const nav = useNav();
  const [show, setShow] = useState('active');
  const rows = d.tasks.filter((x) => x.role_id === roleId && (show === 'all' || x.status === 'active'));
  const cols: Column<TaskRow>[] = [
    { key: 'code', header: t('m26.task.code'), value: (x) => x.code, sortable: true, width: '7rem', render: (x) => <span className="num font-semibold">{x.code}</span> },
    { key: 'title', header: t('m26.task.title'), value: (x) => (x.restricted ? t('m26.restricted.chip') : pick(x, 'title')), sortable: true, render: (x) => x.restricted ? <RestrictedChip /> : (
      <div className="min-w-0">
        <L to={`/training/sat/tasks/${x.id}`} className="link font-semibold">{pick(x, 'title')}</L>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-2">
          <SourceChip source={x.source} />
          {x.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m26.task.critical')}</span>}
          {pick(x, 'duty') && <span>{pick(x, 'duty')}</span>}
          {x.status === 'retired' && <span className="chip border-line bg-sunken text-ink-3">{t('m26.task.retired')}</span>}
        </div>
      </div>
    ) },
    { key: 'raters', header: t('m26.task.raters'), value: (x) => m.props.get(x.id)?.n ?? 0, sortable: true, align: 'end', render: (x) => x.restricted ? '—' : <span className="num">{f.num(m.props.get(x.id)?.n ?? 0)}</span> },
    { key: 'dif', header: t('m26.task.consensus'), csv: false, render: (x) => { const c = m.props.get(x.id)?.consensus; return x.restricted ? '—' : <DifDots d={c?.d} i={c?.i} f={c?.f} />; } },
    { key: 'proposal', header: t('m26.task.proposal'), value: (x) => m.props.get(x.id)?.decision ?? '', render: (x) => {
      const p = m.props.get(x.id);
      if (x.restricted || !p) return '—';
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {p.decision ? <DecisionPill decision={p.decision} /> : <span className="text-[12px] text-ink-3">{t('m26.task.needMore', { n: f.num(Math.max(0, 3 - p.n)) })}</span>}
          {p.consensus?.disagreement && <span className="chip border-sim-line bg-sim-bg text-sim">{t('m26.task.disagreement')}</span>}
          <WhyThis reasons={p.reasons} testId="m26-proposal-why" />
        </span>
      );
    } },
    { key: 'decision', header: t('m26.task.decision'), value: (x) => x.decision, sortable: true, render: (x) => (x.restricted ? '—' : <DecisionPill decision={x.decision} override={x.override} />) },
  ];
  return (
    <div className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <label className="inline-flex items-center gap-2">
          <span className="caps">{t('m26.role.show')}</span>
          <select className="input" value={show} onChange={(e) => setShow(e.target.value)}>
            <option value="active">{t('m26.role.showActive')}</option>
            <option value="all">{t('m26.role.showAll')}</option>
          </select>
        </label>
        <span className="text-ink-2">{t('m26.role.inventoryHint')}</span>
      </div>
      <div data-testid="m26-inventory">
        <DataTable rows={rows} columns={cols} rowKey={(x) => x.id} csvName={`sat-inventory-${roleId}.csv`} onRowClick={(x) => !x.restricted && nav(`/training/sat/tasks/${x.id}`)} empty={<EmptyState title={t('m26.role.noTasks')} />} />
      </div>
    </div>
  );
}

function Matrix({ d, m, roleId }: { d: SatData; m: SatModel; roleId: string }) {
  const t = useT();
  const pick = usePick();
  const cov = m.coverageOf(roleId);
  const rows = cov.rows.map((r) => ({ r, task: m.task.get(r.task_id)! })).sort((x, y) => Number(y.r.gap) - Number(x.r.gap) || Number(y.r.selected) - Number(x.r.selected) || (x.task.sort ?? 0) - (y.task.sort ?? 0));
  const links = d.links.filter((l) => l.active);
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'task', header: t('m26.matrix.task'), value: (x) => `${x.task.code} ${pick(x.task, 'title')}`, render: (x) => (
      <div className="min-w-0">
        <L to={`/training/sat/tasks/${x.task.id}`} className="link font-semibold">{x.task.code}</L>
        <div className="text-[12.5px]">{pick(x.task, 'title')}</div>
      </div>
    ) },
    { key: 'decision', header: t('m26.task.decision'), value: (x) => x.task.decision, render: (x) => <DecisionPill decision={x.task.decision} override={x.task.override} /> },
    { key: 'objectives', header: t('m26.matrix.objectives'), value: (x) => x.r.objectives.map((o) => m.obj.get(o)?.code ?? o).join('; '), render: (x) => x.r.objectives.length ? (
      <ul className="space-y-0.5 text-[12px]">{x.r.objectives.map((o) => <li key={o}><span className="num font-semibold">{m.obj.get(o)?.code}</span> <span className="text-ink-2">{m.objText(o)}</span></li>)}</ul>
    ) : <span className="text-ink-3">—</span> },
    { key: 'training', header: t('m26.matrix.training'), value: (x) => [...x.r.courses.map(m.courseName), ...x.r.jpms.map(m.jpmName)].join('; '), render: (x) => (
      <ul className="space-y-0.5 text-[12px]">
        {x.r.courses.map((c) => <li key={c}><L to={`/learn/course/${c}`} className="link">{m.courseName(c)}</L>{links.filter((l) => l.task_id === x.task.id && l.course_id === c && l.module_id).map((l) => <span key={l.id} className="text-ink-2"> · {m.moduleName(l.module_id)}</span>)}</li>)}
        {x.r.jpms.map((j) => <li key={j} className="text-ink-2">{t('m26.matrix.jpm')}: {m.jpmName(j)}</li>)}
      </ul>
    ) },
    { key: 'state', header: t('m26.matrix.state'), value: (x) => (x.r.gap ? 'gap' : x.r.no_refresher ? 'no_refresher' : x.r.selected ? 'covered' : 'not_selected'), render: (x) => (
      x.r.gap ? <span className="chip border-bad-line bg-bad-bg text-bad" data-testid="m26-gap">{t('m26.matrix.gap')}</span>
        : x.r.no_refresher ? <span className="chip border-info-line bg-info-bg text-info">{t('m26.matrix.noRefresher')}</span>
          : x.r.selected ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m26.matrix.covered')}</span> : <span className="chip border-line bg-sunken text-ink-3">{t('m26.matrix.notSelected')}</span>
    ) },
  ];
  const orphans = cov.orphans.map((id) => m.obj.get(id)!).filter(Boolean);
  return (
    <div className="space-y-4 pt-4">
      <Callout>{t('m26.matrix.explain')}</Callout>
      <div data-testid="m26-matrix">
        <DataTable rows={rows} columns={cols} rowKey={(x) => x.task.id} csvName={`sat-matrix-${roleId}.csv`} empty={<EmptyState title={t('m26.role.noTasks')} />} />
      </div>
      <Section title={t('m26.matrix.orphansTitle', { n: orphans.length })} description={t('m26.matrix.orphansBody')}>
        {orphans.length === 0 ? <EmptyState icon="check" title={t('m26.matrix.noOrphans')} /> : (
          <ul className="divide-y divide-line rounded-card border border-line bg-panel" data-testid="m26-orphans">
            {orphans.map((o) => (
              <li key={o.id} className="flex flex-wrap items-start gap-2 p-3 text-[13px]">
                <span className="num font-semibold">{o.code}</span>
                <span className="min-w-0 flex-1">{pick(o, 'text')}<span className="block text-[12px] text-ink-2">{m.courseName(o.course_id)} · {t(`m26.source.${o.source === 'sat' ? 'sat_objective' : 'course_objective'}`)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function RoleChanges({ d, m, roleId }: { d: SatData; m: SatModel; roleId: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const xs = d.changes.filter((c) => c.role_id === roleId);
  if (!xs.length) return <div className="pt-4"><EmptyState title={t('m26.changes.none')}>{t('m26.changes.noneBody')}</EmptyState></div>;
  return (
    <ul className="space-y-2 pt-4">
      {xs.map((c) => (
        <li key={c.id}>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{m.task.get(c.task_id)?.code}</span>
              <span>{pick(c.after as never, 'title')}</span>
              <span className={`chip ${c.status === 'open' ? 'border-sim-line bg-sim-bg text-sim' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(`m26.changes.status.${c.status}`)}</span>
            </div>
            <p className="mt-1 text-[13px]">{c.summary}</p>
            <p className="mt-1 text-[12px] text-ink-2">{t(`m26.changes.kind.${c.kind}`)} · {t(`m26.changes.trigger.${c.trigger}`)} · {f.date(c.opened_at)} · <L to="/training/sat/changes" className="link">{t('m26.changes.review')}</L></p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function AddTaskModal({ open, roleId, onClose }: { open: boolean; roleId: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [v, setV] = useState({ en: '', ar: '', den: '', dar: '', critical: false });
  const valid = v.en.trim().length >= 5 && v.ar.trim().length >= 5;
  const save = async () => {
    const r = await run(() => repo.rpc.saveJtaTask({ role_id: roleId, title_en: v.en, title_ar: v.ar, duty_en: v.den, duty_ar: v.dar, critical: v.critical }));
    if (r.ok) { setV({ en: '', ar: '', den: '', dar: '', critical: false }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('m26.role.addTask')} footer={<>
      <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
      <button className="btn-primary" disabled={!valid} onClick={save} data-testid="m26-add-task-save">{t('m26.common.save')}</button>
    </>}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m26.role.addTaskBody')}</p>
        <TextField label={t('m26.task.titleEn')} name="title_en" value={v.en} onChange={(x) => setV({ ...v, en: x })} required />
        <TextField label={t('m26.task.titleAr')} name="title_ar" value={v.ar} onChange={(x) => setV({ ...v, ar: x })} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('m26.task.dutyEn')} name="duty_en" value={v.den} onChange={(x) => setV({ ...v, den: x })} />
          <TextField label={t('m26.task.dutyAr')} name="duty_ar" value={v.dar} onChange={(x) => setV({ ...v, dar: x })} />
        </div>
        <CheckboxField label={t('m26.task.critical')} checked={v.critical} onChange={(x) => setV({ ...v, critical: x })} />
      </div>
    </Modal>
  );
}
