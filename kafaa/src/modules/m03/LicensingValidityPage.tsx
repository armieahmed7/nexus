// M03 /licensing/validity (licensing coordinator): everyone certified, sorted by the soonest risk; coordinator tasks with
// UAE working-day clocks (lapse within 3 working days, medical overdue, renewal from 12 months, proficiency risk, exam
// notice, withdrawal escalation); requalification readiness linked to COCT hours. Actions are RPCs behind a confirmation:
// sweep (detectLicensingEvents + licensingAlerts), mirror a status from the source record (setLicenceStatus), close a task,
// mirror a new medical date (recordMedicalDate). Kafa'a sends nothing to FANR.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, StatTile, Tabs, DataTable, StatusPill, ConfirmDialog, Donut, BarChart, FilterBar, useFilters, SelectField, TextField, Drawer, KeyValue, Callout, ProgressBar, Icon } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useT, usePick, useFormat, systemName, useRefText, useCount } from '../../i18n';
import { licenceView, medicalView, proficiency, quarterOf, todayIso, withdrawalDate } from '../../domain/rules';
import { riskOf, workingDaysLeft, type Risk } from './licensing';
import { LicencePill, MedicalPill, PersonLabel } from './shared';

type Data = Awaited<ReturnType<typeof load>>;
async function load(repo: ReturnType<typeof useRepo>) {
  const [lic, med, sp, rq, tasks, people] = await Promise.all([
    repo.list('licences'),
    repo.list('medical_due'),
    repo.list('shift_proficiency', { filter: { quarter: quarterOf(new Date()) } }),
    repo.list('requal_cycles'),
    repo.list('licensing_tasks', { order: [['due_at', 'asc']] }),
    repo.list('people'),
  ]);
  return { lic, med, sp, rq, tasks, people: new Map(people.map((p) => [p.id, p])) };
}

export default function LicensingValidityPage() {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const [sweep, setSweep] = useState(false);
  const q = useQuery(['licences', 'medical_due', 'shift_proficiency', 'requal_cycles', 'licensing_tasks', 'people'], () => load(repo));
  return (
    <Page
      title={t('m03.routes.licensing-validity.title')}
      intro={t('m03.val.intro')}
      wide
      actions={
        <button className="btn-primary" onClick={() => setSweep(true)} data-testid="m03-run-sweep">
          <Icon name="reset" size={14} className="me-1 inline" />
          {t('m03.val.runSweep')}
        </button>
      }
    >
      <Async state={q} empty={<EmptyState title={t('m03.val.none')} />} isEmpty={(d) => d.lic.length === 0}>
        {(d) => <Validity d={d} />}
      </Async>
      <ConfirmDialog
        open={sweep}
        onClose={() => setSweep(false)}
        title={t('m03.val.runSweep')}
        consequence={t('m03.val.sweepConsequence')}
        actingAs={t('m03.val.actingAs')}
        onConfirm={async () => {
          const a = await act(() => repo.rpc.detectLicensingEvents());
          if (a.ok) await act(() => repo.rpc.licensingAlerts());
        }}
      />
    </Page>
  );
}

function Validity({ d }: { d: Data }) {
  const t = useT();
  const f = useFormat();
  const plural = useCount();
  const [flt, setFlt] = useFilters({ q: '', type: '', risk: '', crew: '' }, true);
  const [open, setOpen] = useState<RowOf<'licences'> | null>(null);
  const rows = useMemo(
    () =>
      d.lic
        .map((l) => ({ l, r: riskOf(l, d.med.find((m) => m.person_id === l.person_id), d.sp.find((s) => s.person_id === l.person_id)), p: d.people.get(l.person_id) }))
        .sort((a, b) => a.r.rank - b.r.rank || a.r.days - b.r.days),
    [d],
  );
  const shown = rows.filter((x) => (!flt.type || x.l.type === flt.type) && (!flt.risk || x.r.risk === flt.risk) && (!flt.crew || x.p?.crew === flt.crew) && (!flt.q || `${x.p?.display_name} ${x.l.cert_no}`.toLowerCase().includes(flt.q.toLowerCase())));
  const views = d.lic.map((l) => licenceView(l).view);
  const cnt = (v: string) => views.filter((x) => x === v).length;
  const open_ = d.tasks.filter((x) => x.status === 'open');
  const risks: Risk[] = ['lapsed', 'suspended', 'stale', 'medical', 'proficiency', 'renewal', 'ok'];
  const byQuarter = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of d.lic.filter((x) => x.status === 'valid')) m.set(quarterOf(l.expires_on), (m.get(quarterOf(l.expires_on)) ?? 0) + 1);
    return [...m.entries()].sort().slice(0, 8);
  }, [d.lic]);
  const crews = [...new Set(rows.map((x) => x.p?.crew).filter(Boolean) as string[])].sort();
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m03.val.tCertified')} value={f.num(d.lic.length)} sub={t('m03.val.tCertifiedSub', { ro: f.num(d.lic.filter((l) => l.type === 'RO').length), sro: f.num(d.lic.filter((l) => l.type !== 'RO').length) })} />
        <StatTile label={t('m03.view.valid')} value={f.num(cnt('valid'))} tone="ok" sub={t('m03.val.tRenewal', { n: f.num(cnt('renewal_due')) })} />
        <StatTile label={t('m03.val.tRisk')} value={f.num(rows.filter((x) => x.r.rank < 5).length)} tone="bad" sub={t('m03.val.tRiskSub', { l: f.num(cnt('lapsed')), s: f.num(cnt('stale')) })} />
        <StatTile label={t('m03.val.tTasks')} value={f.num(open_.length)} tone="info" sub={t('m03.val.tTasksSub', { n: f.num(open_.filter((x) => x.due_at < todayIso()).length) })} />
      </Grid>
      <Tabs
        tabs={[
          {
            id: 'risk',
            label: t('m03.val.tabRisk'),
            content: (
              <div className="space-y-3">
                <FilterBar
                  value={flt}
                  onChange={setFlt}
                  search="q"
                  fields={[
                    { key: 'type', label: t('m03.cert.type'), options: ['RO', 'SRO', 'SRO_QI'].map((x) => ({ value: x, label: t(`m03.type.${x}`) })) },
                    { key: 'risk', label: t('m03.val.risk'), options: risks.map((x) => ({ value: x, label: t(`m03.risk.${x}`) })) },
                    { key: 'crew', label: t('m03.val.crew'), options: crews.map((x) => ({ value: x, label: t('m02.matrix.crew', { c: x }) })) },
                  ]}
                />
                <div data-testid="m03-validity-table">
                  <DataTable
                    rows={shown}
                    rowKey={(x) => x.l.id}
                    searchable={false}
                    csvName="licence-validity"
                    onRowClick={(x) => setOpen(x.l)}
                    empty={<EmptyState title={t('m03.val.noneMatch')} />}
                    columns={[
                      { key: 'person', header: t('m02.team.person'), value: (x) => x.p?.display_name ?? x.l.person_id, render: (x) => <PersonLabel p={x.p} />, sortable: true },
                      { key: 'type', header: t('m03.cert.type'), value: (x) => x.l.type, render: (x) => t(`m03.type.${x.l.type}`) },
                      { key: 'cert', header: t('m03.cert.number'), value: (x) => x.l.cert_no, render: (x) => <span className="num">{x.l.cert_no}</span> },
                      { key: 'status', header: t('m03.cert.status'), value: (x) => licenceView(x.l).view, render: (x) => <LicencePill lic={x.l} /> },
                      { key: 'risk', header: t('m03.val.risk'), value: (x) => x.r.risk, render: (x) => <StatusPill tone={x.r.rank < 3 ? 'bad' : x.r.rank < 6 ? 'sim' : 'ok'}>{t(`m03.risk.${x.r.risk}`)}</StatusPill> },
                      { key: 'exp', header: t('m03.cert.expires'), value: (x) => x.l.expires_on, render: (x) => <span>{f.date(x.l.expires_on)} <span className="text-[12px] text-ink-3">({x.r.days >= 0 ? t('m02.inDays', { days: plural('common.nDays', x.r.days) }) : t('m02.expiredAgo', { days: plural('common.nDays', -x.r.days) })})</span></span>, sortable: true },
                      { key: 'synced', header: t('m03.val.synced'), value: (x) => x.l.last_synced, render: (x) => <span className="text-[12px]">{f.dateTime(x.l.last_synced)}</span>, sortable: true },
                    ]}
                  />
                </div>
              </div>
            ),
          },
          { id: 'tasks', label: t('m03.val.tabTasks'), badge: open_.length, content: <Tasks d={d} /> },
          { id: 'requal', label: t('m03.val.tabRequal'), content: <Requal d={d} /> },
          {
            id: 'charts',
            label: t('m03.val.tabCharts'),
            content: (
              <Grid cols={2}>
                <Card title={t('m03.val.chartViews')}>
                  <Donut title={t('m03.val.chartViews')} data={(['valid', 'renewal_due', 'stale', 'lapsed', 'suspended', 'pending'] as const).map((v) => ({ label: t(`m03.view.${v}`), value: cnt(v), tone: v === 'valid' ? 'ok' : v === 'renewal_due' || v === 'stale' ? 'sim' : v === 'pending' ? 'info' : 'bad' })).filter((x) => x.value > 0)} center={f.num(d.lic.length)} />
                </Card>
                <Card title={t('m03.val.chartExpiry')}>
                  <BarChart title={t('m03.val.chartExpiry')} data={byQuarter.map(([k, n]) => ({ label: k, value: n }))} />
                </Card>
              </Grid>
            ),
          },
        ]}
      />
      <PersonDrawer d={d} lic={open} onClose={() => setOpen(null)} />
    </>
  );
}

function PersonDrawer({ d, lic, onClose }: { d: Data; lic: RowOf<'licences'> | null; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (!lic) return null;
  const med = d.med.find((m) => m.person_id === lic.person_id);
  const sp = d.sp.find((s) => s.person_id === lic.person_id);
  const rq = d.rq.find((r) => r.person_id === lic.person_id);
  const p = sp ? proficiency(sp, lic.type !== 'RO') : null;
  const v = licenceView(lic);
  return (
    <Drawer open={!!lic} onClose={onClose} title={<PersonLabel p={d.people.get(lic.person_id)} />}>
      <div className="space-y-4" data-testid="m03-person-drawer">
        <Card title={t('m03.cert.title')} actions={<LicencePill lic={lic} />} footer={t('m02.mirror.asRecorded', { system: systemName(t, lic.source_system), date: f.dateTime(lic.last_synced) })}>
          <KeyValue
            items={[
              [t('m03.cert.type'), t(`m03.type.${lic.type}`)],
              [t('m03.cert.number'), <span className="num">{lic.cert_no}</span>],
              [t('m03.cert.issued'), f.date(lic.issued_on)],
              [t('m03.cert.expires'), f.date(lic.expires_on)],
              [t('m03.val.route'), lic.route ? t(`m03.route.${lic.route}`) : '—'],
              ...(lic.lapsed_on ? ([[t('m03.val.lapsedOn'), `${f.date(lic.lapsed_on)} · ${t('m03.val.withdrawalOn', { d: f.date(withdrawalDate(lic.lapsed_on)) })}`]] as [string, string][]) : []),
            ]}
          />
          {v.stale && <p className="mt-2 text-[12.5px] text-sim">{t('m03.val.staleNote')}</p>}
        </Card>
        <Card title={t('m03.med.title')} actions={med ? <MedicalPill med={med} /> : null}>
          {med ? <KeyValue items={[[t('m03.med.due'), f.date(med.due_on)], [t('m03.med.flag'), t(`m03.med.flag_${med.flag}`)]]} /> : <p className="text-ink-2">{t('m03.med.none')}</p>}
          <p className="mt-2 text-[12px] text-ink-3">{t('m03.med.noContentShort')}</p>
        </Card>
        <Card title={t('m03.prof.title')}>
          {sp && p ? (
            <div className="space-y-1 text-[13px]">
              <div>{t('m03.prof.line', { s8: f.num(sp.shifts_8h), s12: f.num(sp.shifts_12h), sro: f.num(sp.sro_role_shifts), r8: f.num(sp.scheduled_remaining_8h), r12: f.num(sp.scheduled_remaining_12h), rsro: f.num(sp.scheduled_remaining_sro) })}</div>
              <StatusPill tone={p.atRisk || p.sroAtRisk ? 'bad' : p.met ? 'ok' : 'info'}>{t(`m03.prof.${p.atRisk || p.sroAtRisk ? 'at_risk' : p.met && p.sroMet !== false ? 'met' : 'on_track'}`)}</StatusPill>
              {p.messages.map((m) => (
                <p key={m.code} className="text-bad">{t(`m03.prof.${m.code}`)}</p>
              ))}
            </div>
          ) : (
            <p className="text-ink-2">{t('m03.prof.noData')}</p>
          )}
        </Card>
        {rq && (
          <Card title={t('m03.requal.title')}>
            <ProgressBar value={rq.coct_hours_required ? (rq.coct_hours_done * 100) / rq.coct_hours_required : 0} label={t('m03.requal.coct', { n: f.num(rq.coct_hours_done), of: f.num(rq.coct_hours_required) })} />
          </Card>
        )}
        <Card title={t('m03.val.mirrorStatus')}>
          <p className="mb-2 text-[13px] text-ink-2">{t('m03.val.mirrorStatusBody')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <SelectField label={t('m03.cert.status')} name="status" value={status} onChange={setStatus} placeholder={t('common.choose')} options={['valid', 'lapsed', 'suspended', 'withdrawn', 'pending'].filter((x) => x !== lic.status).map((x) => ({ value: x, label: t(`m03.view.${x}`) }))} />
            </div>
            <button className="btn-outline" disabled={!status} onClick={() => setConfirm(true)} data-testid="m03-set-status">
              {t('m03.val.record')}
            </button>
          </div>
        </Card>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title={t('m03.val.record')}
          consequence={t('m03.val.statusConsequence', { status: t(`m03.view.${status || 'valid'}`) })}
          actingAs={t('m03.val.actingAs')}
          requireReason
          reasonLabel={t('m03.val.sourceRef')}
          danger={status === 'lapsed' || status === 'withdrawn'}
          onConfirm={async (reason) => {
            const r = await act(() => repo.rpc.setLicenceStatus(lic.id, status, reason));
            if (r.ok) onClose();
          }}
        />
      </div>
    </Drawer>
  );
}

function Tasks({ d }: { d: Data }) {
  const t = useT();
  const pick = usePick();
  const refText = useRefText();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [closeT, setCloseT] = useState<RowOf<'licensing_tasks'> | null>(null);
  const [medT, setMedT] = useState<RowOf<'licensing_tasks'> | null>(null);
  const [due, setDue] = useState('');
  const [flag, setFlag] = useState<'fit' | 'not_confirmed'>('fit');
  const rows = d.tasks.filter((x) => show === 'all' || x.status === 'open');
  return (
    <div className="space-y-3">
      <Callout tone="info" title={t('m03.tasks.calloutTitle')}>
        {t('m03.tasks.calloutBody')}
      </Callout>
      <div className="flex gap-1.5">
        {(['open', 'all'] as const).map((x) => (
          <button key={x} className={`chip ${show === x ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} aria-pressed={show === x} onClick={() => setShow(x)}>
            {t(`m03.tasks.show_${x}`)}
          </button>
        ))}
      </div>
      <div data-testid="m03-tasks">
        <DataTable
          rows={rows}
          rowKey={(x) => x.id}
          searchable={false}
          csvName="licensing-tasks"
          initialSort={{ key: 'due', dir: 'asc' }}
          empty={<EmptyState title={t('m03.tasks.none')} icon="check" />}
          columns={[
            { key: 'kind', header: t('m03.tasks.kind'), value: (x) => x.kind, render: (x) => <StatusPill tone={x.kind === 'lapse_report' || x.kind === 'withdrawal_risk' || x.kind === 'medical_overdue' ? 'bad' : x.kind === 'proficiency_risk' ? 'sim' : 'info'}>{t(`m03.tasks.k_${x.kind}`)}</StatusPill> },
            { key: 'title', header: t('m03.tasks.title'), value: (x) => pick(x, 'title'), render: (x) => <div><div>{pick(x, 'title')}</div>{x.rule_ref && <div className="text-[11.5px] text-ink-3">{refText(x.rule_ref)}</div>}</div> },
            { key: 'person', header: t('m02.team.person'), value: (x) => d.people.get(x.person_id ?? '')?.display_name ?? '', render: (x) => (x.person_id ? <PersonLabel p={d.people.get(x.person_id)} /> : '—') },
            { key: 'created', header: t('m03.tasks.created'), value: (x) => x.created_at, render: (x) => f.date(x.created_at.slice(0, 10)) },
            {
              key: 'due',
              header: t('m03.tasks.due'),
              value: (x) => x.due_at,
              sortable: true,
              render: (x) => {
                const wd = workingDaysLeft(today, x.due_at);
                return (
                  <div data-testid="m03-task-clock">
                    <div>{f.date(x.due_at)}</div>
                    {x.status === 'open' && <div className={`text-[11.5px] ${wd < 0 ? 'text-bad' : wd <= 1 ? 'text-sim' : 'text-ink-3'}`}>{wd < 0 ? t('m03.tasks.overdueWd', { n: f.num(-wd) }) : t('m03.tasks.wdLeft', { n: f.num(wd) })}</div>}
                  </div>
                );
              },
            },
            { key: 'status', header: t('m02.task.status'), value: (x) => x.status, render: (x) => <StatusPill status={x.status === 'done' ? 'completed' : x.status}>{t(`m03.tasks.s_${x.status}`)}</StatusPill> },
            {
              key: 'act',
              header: '',
              csv: false,
              render: (x) =>
                x.status === 'open' ? (
                  <div className="flex gap-1">
                    {x.kind === 'medical_overdue' && x.person_id && (
                      <button className="btn-outline btn-sm" onClick={() => { setMedT(x); setDue(''); }} data-testid="m03-med-date">
                        {t('m03.tasks.recordMedical')}
                      </button>
                    )}
                    <button className="btn-outline btn-sm" onClick={() => setCloseT(x)} data-testid="m03-close-task">
                      {t('m03.tasks.close')}
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />
      </div>
      <ConfirmDialog
        open={!!closeT}
        onClose={() => setCloseT(null)}
        title={t('m03.tasks.close')}
        consequence={t('m03.tasks.closeConsequence')}
        actingAs={t('m03.val.actingAs')}
        requireReason
        reasonLabel={t('m03.tasks.whatDone')}
        onConfirm={(note) => act(() => repo.rpc.closeLicensingTask(closeT!.id, note))}
      />
      <ConfirmDialog
        open={!!medT}
        onClose={() => setMedT(null)}
        title={t('m03.tasks.recordMedical')}
        consequence={t('m03.tasks.medicalConsequence')}
        actingAs={t('m03.val.actingAs')}
        requireReason
        reasonLabel={t('m03.tasks.medicalRef')}
        onConfirm={(ref) => act(() => repo.rpc.recordMedicalDate(medT!.person_id!, due, flag, ref))}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TextField label={t('m03.tasks.newDue')} name="due" type="date" value={due} onChange={setDue} required />
          <SelectField label={t('m03.med.flag')} name="flag" value={flag} onChange={(v) => setFlag(v as 'fit' | 'not_confirmed')} options={[{ value: 'fit', label: t('m03.med.flag_fit') }, { value: 'not_confirmed', label: t('m03.med.flag_not_confirmed') }]} />
        </div>
        {medT?.person_id && d.med.find((m) => m.person_id === medT.person_id) && <p className="text-[12.5px] text-ink-2">{t('m03.tasks.currentDue', { d: f.date(d.med.find((m) => m.person_id === medT.person_id)!.due_on), v: t(`m03.med.view_${medicalView(d.med.find((m) => m.person_id === medT.person_id)!)}`) })}</p>}
      </ConfirmDialog>
    </div>
  );
}

function Requal({ d }: { d: Data }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  return (
    <div className="space-y-3">
      <p className="text-ink-2">{t('m03.requal.desc')}</p>
      <div data-testid="m03-requal-table">
        <DataTable
          rows={d.rq}
          rowKey={(x) => x.id}
          searchable={false}
          csvName="requalification-readiness"
          empty={<EmptyState title={t('m03.requal.none')} />}
          columns={[
            { key: 'person', header: t('m02.team.person'), value: (x) => d.people.get(x.person_id)?.display_name ?? x.person_id, render: (x) => <PersonLabel p={d.people.get(x.person_id)} />, sortable: true },
            { key: 'window', header: t('m03.requal.window'), value: (x) => x.window_end, render: (x) => `${f.date(x.window_start)} – ${f.date(x.window_end)}` },
            { key: 'coct', header: t('m03.requal.coctShort'), value: (x) => (x.coct_hours_required ? Math.round((x.coct_hours_done * 100) / x.coct_hours_required) : 0), sortable: true, render: (x) => <div className="min-w-[160px]"><ProgressBar value={x.coct_hours_required ? (x.coct_hours_done * 100) / x.coct_hours_required : 0} tone={x.coct_hours_done >= x.coct_hours_required ? 'ok' : x.coct_hours_done / Math.max(1, x.coct_hours_required) < 0.5 ? 'bad' : 'accent'} label={t('m03.requal.coct', { n: f.num(x.coct_hours_done), of: f.num(x.coct_hours_required) })} /></div> },
            {
              key: 'exam',
              header: t('m03.requal.exam'),
              value: (x) => x.exam_status,
              render: (x) => (
                <select className="input py-1 text-[13px]" aria-label={t('m03.requal.exam')} value={x.exam_status} onChange={(e) => act(() => repo.update('requal_cycles', x.id, { exam_status: e.target.value as typeof x.exam_status }), { success: t('m03.requal.saved') })} data-testid="m03-requal-exam">
                  {(['not_scheduled', 'scheduled', 'passed', 'failed'] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`m03.requal.exam_${s}`)}
                    </option>
                  ))}
                </select>
              ),
            },
            { key: 'ready', header: t('m03.requal.readiness'), value: (x) => (x.coct_hours_done >= x.coct_hours_required && x.exam_status === 'passed' ? 'ready' : 'open'), render: (x) => <StatusPill tone={x.exam_status === 'passed' && x.coct_hours_done >= x.coct_hours_required ? 'ok' : x.exam_status === 'failed' ? 'bad' : 'info'}>{t(x.exam_status === 'passed' && x.coct_hours_done >= x.coct_hours_required ? 'm03.requal.ready' : x.exam_status === 'failed' ? 'm03.requal.retake' : 'm03.requal.inProgress')}</StatusPill> },
          ]}
        />
      </div>
    </div>
  );
}
