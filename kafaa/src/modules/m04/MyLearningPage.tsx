// /my/learning (M04): assigned and elective training, enrolments, simulator sessions, transcript, certificates,
// external course requests, and (for managers) team approvals. Progress, not rank: no points or leaderboards.
import { useState } from 'react';
import { Page, Grid, Card, StatTile, Tabs, DataTable, Async, EmptyState, ConfirmDialog, Drawer, Modal, ProgressBar, ProgressRing, Callout, Icon, TextField, TextArea, useForm, required, numberRange, maxLen } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { CertificatesRow, EnrolmentsRow, ExternalRequestsRow, SessionsRow, SimulatorSlotsRow, TrainingRecordsRow } from '../../data/types';
import { L, useFormat, usePick, useT, systemName } from '../../i18n';
import { useSession } from '../../auth/session';
import { isOpen } from '../../domain/learning';
import { G2Pill, useCatalogue, useLabels, daysUntil, Chip } from './ui';
import { TeamApprovals } from './TeamApprovals';

export default function MyLearningPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId;
  const isApprover = s.can('training', ['A']);
  const data = useQuery(['enrolments', 'training_records', 'certificates', 'external_requests', 'sessions', 'simulator_slots'], async () => {
    if (!me) return null;
    const [enrolments, records, certificates, external, sessions, slots] = await Promise.all([
      repo.list('enrolments', { filter: { person_id: me }, order: [['enrolled_at', 'desc']] }),
      repo.list('training_records', { filter: { person_id: me }, order: [['completed_on', 'desc']] }),
      repo.list('certificates', { filter: { person_id: me }, order: [['issued_on', 'desc']] }),
      repo.list('external_requests', { filter: { person_id: me }, order: [['created_at', 'desc']] }),
      repo.list('sessions', { order: [['starts_at', 'asc']] }).catch(() => []),
      s.person?.crew ? repo.list('simulator_slots', { filter: { crew: s.person.crew }, order: [['starts_at', 'asc']] }).catch(() => []) : Promise.resolve([]),
    ]);
    return { enrolments, records, certificates, external, sessions, slots };
  }, [me, s.person?.crew]);

  return (
    <Page title={t('m04.routes.my-learning.title')} intro={t('m04.my.intro')} actions={<L to="/learn" className="btn-outline btn-sm"><Icon name="search" size={14} />{t('m04.my.findTraining')}</L>}>
      <Async state={data} isEmpty={(d) => !d}>
        {(d) => d && (
          <Tabs initial="overview" tabs={[
            { id: 'overview', label: t('m04.my.tabOverview'), content: <Overview d={d} /> },
            { id: 'plan', label: t('m04.my.tabTraining'), badge: d.enrolments.filter((e) => isOpen(e.status)).length, content: <Enrolments rows={d.enrolments} sessions={d.sessions} /> },
            { id: 'sim', label: t('m04.my.tabSimulator'), content: <Simulator d={d} /> },
            { id: 'transcript', label: t('m04.my.tabTranscript'), content: <Transcript d={d} /> },
            { id: 'certs', label: t('m04.my.tabCertificates'), badge: d.certificates.length, content: <Certificates rows={d.certificates} /> },
            { id: 'external', label: t('m04.my.tabExternal'), content: <External rows={d.external} /> },
            ...(isApprover ? [{ id: 'team', label: t('m04.my.tabTeam'), content: <TeamApprovals /> }] : []),
          ]} />
        )}
      </Async>
    </Page>
  );
}

interface Data {
  enrolments: EnrolmentsRow[];
  records: TrainingRecordsRow[];
  certificates: CertificatesRow[];
  external: ExternalRequestsRow[];
  sessions: SessionsRow[];
  slots: SimulatorSlotsRow[];
}

function Overview({ d }: { d: Data }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cat = useCatalogue();
  const mandatory = d.enrolments.filter((e) => e.source === 'role_rule' || cat.course.get(e.course_id)?.mandatory);
  const mandatoryDone = mandatory.filter((e) => e.status === 'completed').length;
  const open = d.enrolments.filter((e) => isOpen(e.status));
  const overdue = open.filter((e) => (daysUntil(e.due_on) ?? 1) < 0);
  const year = new Date().getUTCFullYear();
  const hours = d.records.filter((r) => r.completed_on.startsWith(String(year)) && r.result !== 'failed').reduce((n, r) => n + Number(r.hours || 0), 0);
  const sessionById = new Map(d.sessions.map((x) => [x.id, x]));
  const upcoming = open.filter((e) => e.session_id && sessionById.get(e.session_id) && sessionById.get(e.session_id)!.starts_at > new Date().toISOString()).sort((a, b) => sessionById.get(a.session_id!)!.starts_at.localeCompare(sessionById.get(b.session_id!)!.starts_at));
  const pct = mandatory.length ? Math.round((mandatoryDone * 100) / mandatory.length) : 100;
  return (
    <div className="space-y-4">
      <Grid cols={4}>
        <StatTile label={t('m04.my.statOpen')} value={f.num(open.length)} sub={t('m04.my.statOpenSub')} />
        <StatTile label={t('m04.my.statOverdue')} value={f.num(overdue.length)} tone={overdue.length ? 'bad' : 'ok'} sub={t('m04.my.statOverdueSub')} />
        <StatTile label={t('m04.my.statHours')} value={f.num(hours)} sub={t('m04.my.statHoursSub', { year: f.num(year, { useGrouping: false }) })} />
        <StatTile label={t('m04.my.statCerts')} value={f.num(d.certificates.filter((c) => c.status === 'valid').length)} sub={t('m04.my.statCertsSub')} />
      </Grid>
      <Grid cols={2}>
        <Card title={t('m04.my.mandatoryTitle')}>
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} size={72} tone={pct === 100 ? 'ok' : 'accent'} name={t('m04.my.mandatoryTitle')} />
            <div className="text-[13.5px] text-ink-2">{t('m04.my.mandatoryBody', { done: f.num(mandatoryDone), total: f.num(mandatory.length) })}</div>
          </div>
          {overdue.length > 0 && <div className="mt-3"><Callout tone="bad" title={t('m04.my.overdueTitle')}>{overdue.map((e) => cat.course.get(e.course_id)?.code ?? e.course_id).join(', ')}</Callout></div>}
        </Card>
        <Card title={t('m04.my.upcomingTitle')}>
          {upcoming.length === 0 ? <p className="text-ink-3">{t('m04.my.noUpcoming')}</p> : (
            <ul className="space-y-2" data-testid="m04-upcoming">
              {upcoming.slice(0, 5).map((e) => {
                const x = sessionById.get(e.session_id!)!;
                const c = cat.course.get(e.course_id);
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0"><L to={`/learn/course/${e.course_id}`} className="font-semibold">{c ? pick(c, 'title') : e.course_id}</L><div className="text-[12.5px] text-ink-3">{f.dateTime(x.starts_at)} · {x.location}</div></div>
                    <G2Pill status={e.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Grid>
      <Callout title={t('m04.my.noRankTitle')}>{t('m04.my.noRankBody')}</Callout>
    </div>
  );
}

function Enrolments({ rows, sessions }: { rows: EnrolmentsRow[]; sessions: SessionsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const cat = useCatalogue();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [book, setBook] = useState<EnrolmentsRow | null>(null);
  const [cancel, setCancel] = useState<EnrolmentsRow | null>(null);
  const [complete, setComplete] = useState<EnrolmentsRow | null>(null);
  const sessionById = new Map(sessions.map((x) => [x.id, x]));
  const list = show === 'open' ? rows.filter((e) => isOpen(e.status)) : rows;
  const advance = async (e: EnrolmentsRow) => {
    const next = Math.min(100, (e.progress_pct ?? 0) + 25);
    await run(() => repo.update('enrolments', e.id, { progress_pct: next, status: e.status === 'assigned' || e.status === 'enrolled' ? 'in_progress' : e.status }), { success: t('m04.my.progressSaved', { n: f.num(next) }) });
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={show === 'open' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setShow('open')}>{t('m04.my.showOpen')}</button>
        <button className={show === 'all' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setShow('all')}>{t('m04.my.showAll')}</button>
      </div>
      <DataTable rows={list} rowKey={(r) => r.id} csvName="my-training" empty={t('m04.my.noTraining')} initialSort={{ key: 'due', dir: 'asc' }} columns={[
        { key: 'course', header: t('m04.common.course'), value: (r) => cat.course.get(r.course_id)?.code ?? r.course_id, render: (r) => { const c = cat.course.get(r.course_id); return <div><L to={`/learn/course/${r.course_id}`} className="font-semibold">{c ? pick(c, 'title') : r.course_id}</L><div className="text-[12px] text-ink-3"><span className="ltr">{c?.code}</span>{c ? ` · ${lab.modality(c.modality)}` : ''}</div></div>; }, sortable: true },
        { key: 'source', header: t('m04.common.source'), value: (r) => lab.source(r.source) },
        { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} />, sortable: true },
        { key: 'session', header: t('m04.common.session'), value: (r) => (r.session_id ? sessionById.get(r.session_id)?.starts_at ?? '' : ''), render: (r) => (r.session_id && sessionById.get(r.session_id) ? f.dateTime(sessionById.get(r.session_id)!.starts_at) : '—'), sortable: true },
        { key: 'due', header: t('m04.common.due'), value: (r) => r.due_on ?? '', render: (r) => { const dd = daysUntil(r.due_on); return r.due_on ? <span className={dd != null && dd < 0 && isOpen(r.status) ? 'font-semibold text-bad' : ''}>{f.date(r.due_on)}{dd != null && dd < 0 && isOpen(r.status) ? ` · ${t('m04.my.overdue')}` : ''}</span> : '—'; }, sortable: true },
        { key: 'progress', header: t('m04.common.progress'), value: (r) => r.progress_pct, render: (r) => <div className="w-24"><ProgressBar value={r.progress_pct} tone={r.status === 'completed' ? 'ok' : 'accent'} label={`${r.progress_pct}%`} /></div> },
        { key: 'act', header: '', csv: false, render: (r) => {
          const c = cat.course.get(r.course_id);
          if (!isOpen(r.status)) return r.certificate_no ? <span className="num text-[12px]">{r.certificate_no}</span> : null;
          const selfPaced = c?.modality === 'elearning' && !r.session_id;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {selfPaced && r.progress_pct < 100 && <button className="btn-outline btn-sm" onClick={() => advance(r)} data-testid="m04-continue">{t('m04.my.continue')}</button>}
              {selfPaced && r.progress_pct >= 100 && !c?.qualifying && <button className="btn-primary btn-sm" onClick={() => setComplete(r)}>{t('m04.my.markComplete')}</button>}
              {!selfPaced && (!r.session_id || sessions.find((x) => x.id === r.session_id)?.status === 'cancelled') && ['assigned', 'approved', 'enrolled', 'in_progress'].includes(r.status) && <button className="btn-primary btn-sm" onClick={() => setBook(r)} data-testid="m04-book">{t('m04.my.bookSession')}</button>}
              {(r.session_id || (r.source !== 'role_rule' && !c?.mandatory)) && <button className="btn-ghost btn-sm" onClick={() => setCancel(r)}>{r.session_id && (r.source === 'role_rule' || c?.mandatory) ? t('m04.my.changeSession') : t('m04.my.cancel')}</button>}
            </div>
          );
        } },
      ]} />
      {book && <BookDrawer enrolment={book} onClose={() => setBook(null)} />}
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} danger title={t('m04.my.cancelTitle')}
        consequence={cancel && (cancel.source === 'role_rule' || cat.course.get(cancel.course_id)?.mandatory) ? t('m04.course.withdrawMandatory') : t('m04.course.withdrawElective')}
        onConfirm={async () => { if (cancel) await run(() => repo.rpc.cancelEnrolment(cancel.id, '')); }} />
      <ConfirmDialog open={!!complete} onClose={() => setComplete(null)} title={t('m04.my.completeTitle')} consequence={t('m04.my.completeBody')}
        onConfirm={async () => { if (complete) await run(() => repo.rpc.completeEnrolment(complete.id, 'completed', null, '')); }} />
    </div>
  );
}

function BookDrawer({ enrolment, onClose }: { enrolment: EnrolmentsRow; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery(['sessions', 'enrolments'], async () => {
    const [sessions, avail] = await Promise.all([repo.list('sessions', { filter: { course_id: enrolment.course_id }, order: [['starts_at', 'asc']] }), repo.rpc.sessionAvailability(enrolment.course_id)]);
    const now = new Date().toISOString();
    return sessions.filter((x) => x.status === 'scheduled' && x.starts_at > now).map((x) => ({ ...x, a: avail.data?.find((v) => v.session_id === x.id) }));
  }, [enrolment.course_id]);
  const [pick, setPick] = useState<string | null>(null);
  return (
    <Drawer open onClose={onClose} title={t('m04.my.bookTitle')}>
      <Async state={q} empty={<EmptyState title={t('m04.course.noSessions')}>{t('m04.my.noSessionsBody')}</EmptyState>}>
        {(rows) => (
          <ul className="space-y-2" data-testid="m04-book-sessions">
            {rows.map((x) => {
              const left = x.capacity - (x.a?.taken ?? 0);
              return (
                <li key={x.id} className="card flex items-center justify-between gap-2 p-3">
                  <div>
                    <div className="font-semibold">{f.dateTime(x.starts_at)}</div>
                    <div className="text-[12.5px] text-ink-3">{x.location} · {lab.sessionKind(x.kind)}{x.crew ? ` · ${t('m04.common.crew')} ${x.crew}` : ''}</div>
                    <div className="text-[12.5px]">{left > 0 ? t('m04.course.seatsLeft', { n: f.num(left), cap: f.num(x.capacity) }) : t('m04.my.fullWaitlist', { n: f.num(x.a?.waiting ?? 0) })}</div>
                  </div>
                  <button className="btn-primary btn-sm" onClick={() => setPick(x.id)}>{left > 0 ? t('m04.course.book') : t('m04.course.joinWaitlist')}</button>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <ConfirmDialog open={!!pick} onClose={() => setPick(null)} title={t('m04.course.confirmTitle')} consequence={t('m04.my.bookConfirm')}
        onConfirm={async () => { if (pick) { const r = await run(() => repo.rpc.enrolCourse(enrolment.course_id, pick)); if (r.ok) onClose(); } }} />
    </Drawer>
  );
}

function Simulator({ d }: { d: Data }) {
  const t = useT();
  const f = useFormat();
  const lab = useLabels();
  const pick = usePick();
  const cat = useCatalogue();
  const s = useSession();
  const sessionById = new Map(d.sessions.map((x) => [x.id, x]));
  const mySim = d.enrolments.filter((e) => e.session_id && sessionById.get(e.session_id)?.kind === 'simulator' && isOpen(e.status));
  const now = new Date().toISOString();
  return (
    <div className="space-y-4">
      <Card title={t('m04.my.simMine')}>
        {mySim.length === 0 ? <p className="text-ink-3">{t('m04.my.simNone')}</p> : (
          <ul className="space-y-2">{mySim.map((e) => { const x = sessionById.get(e.session_id!)!; const c = cat.course.get(e.course_id); return <li key={e.id} className="flex items-center justify-between gap-2"><span><span className="font-semibold">{c ? pick(c, 'title') : e.course_id}</span> · {f.dateTime(x.starts_at)} · {x.location}</span><span className="flex gap-1"><Chip tone={x.priority === 'licence_critical' ? 'bad' : 'neutral'}>{lab.priority(x.priority)}</Chip><G2Pill status={e.status} /></span></li>; })}</ul>
        )}
      </Card>
      <Card title={s.person?.crew ? t('m04.my.simCrew', { crew: s.person.crew }) : t('m04.my.simCrewNone')}>
        {!s.person?.crew ? <p className="text-ink-3">{t('m04.my.simNoCrew')}</p> : (
          <DataTable rows={d.slots.filter((x) => x.starts_at >= now)} rowKey={(r) => r.id} searchable={false} pageSize={10} empty={t('m04.my.simNone')} columns={[
            { key: 'when', header: t('m04.common.when'), value: (r) => r.starts_at, render: (r) => f.dateTime(r.starts_at), sortable: true },
            { key: 'sim', header: t('m04.sim.simulator'), value: (r) => r.simulator },
            { key: 'kind', header: t('m04.common.kind'), value: (r) => lab.booking(r.booking_kind), render: (r) => <Chip tone={r.priority === 1 ? 'bad' : r.priority === 2 ? 'info' : 'neutral'}>{lab.booking(r.booking_kind)}</Chip> },
            { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} /> },
          ]} />
        )}
      </Card>
      <Callout title={t('m04.sim.ruleTitle')}>{t('m04.sim.ruleBody')}</Callout>
    </div>
  );
}

function Transcript({ d }: { d: Data }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cat = useCatalogue();
  const total = d.records.filter((r) => r.result !== 'failed').reduce((n, r) => n + Number(r.hours || 0), 0);
  return (
    <div className="space-y-3">
      <Callout title={t('m04.my.transcriptTitle')}>{t('m04.my.transcriptBody', { n: f.num(total) })}</Callout>
      <DataTable rows={d.records} rowKey={(r) => r.id} csvName="my-transcript" empty={t('m04.my.noRecords')} initialSort={{ key: 'date', dir: 'desc' }} columns={[
        { key: 'date', header: t('m04.common.completedOn'), value: (r) => r.completed_on, render: (r) => f.date(r.completed_on), sortable: true },
        { key: 'code', header: t('m04.common.code'), value: (r) => cat.course.get(r.course_id)?.code ?? r.course_id, render: (r) => <span className="ltr num">{cat.course.get(r.course_id)?.code ?? r.course_id}</span> },
        { key: 'course', header: t('m04.common.course'), value: (r) => { const c = cat.course.get(r.course_id); return c ? pick(c, 'title') : r.course_id; } },
        { key: 'hours', header: t('m04.common.hoursCol'), value: (r) => Number(r.hours), align: 'end', sortable: true },
        { key: 'result', header: t('m04.common.result'), value: (r) => r.result, render: (r) => <G2Pill status={r.result} /> },
        { key: 'src', header: t('m04.my.sourceSystem'), value: (r) => systemName(t, r.source_system) },
      ]} />
    </div>
  );
}

function Certificates({ rows }: { rows: CertificatesRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cat = useCatalogue();
  if (!rows.length) return <EmptyState icon="shield" title={t('m04.my.noCerts')}>{t('m04.my.noCertsBody')}</EmptyState>;
  return (
    <div className="space-y-3">
      <Callout title={t('m04.my.certNoteTitle')}>{t('m04.my.certNote')}</Callout>
      <Grid cols={3}>
        {rows.map((c) => {
          const co = cat.course.get(c.course_id);
          return (
            <Card key={c.id} eyebrow={<span className="num ltr">{c.id}</span>} title={co ? pick(co, 'title') : c.course_id} actions={<G2Pill status={c.status === 'valid' && c.valid_to && c.valid_to < new Date().toISOString().slice(0, 10) ? 'expired' : c.status} />}>
              <div className="text-[13px] text-ink-2">{t('m04.my.issued', { date: f.date(c.issued_on) })}{c.valid_to ? ` · ${t('m04.my.validTo', { date: f.date(c.valid_to) })}` : ''}</div>
              <L to={`/verify?no=${encodeURIComponent(c.id)}`} className="mt-2 inline-flex items-center gap-1 text-[13px]"><Icon name="shield" size={14} />{t('m04.my.verify')}</L>
            </Card>
          );
        })}
      </Grid>
    </div>
  );
}

function External({ rows }: { rows: ExternalRequestsRow[] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [open, setOpen] = useState(false);
  const form = useForm({ title: '', provider: '', cost: '', start: '', hours: '', justification: '' }, { title: [required(), maxLen(160)], provider: [required()], cost: [numberRange(0, 500000)], hours: [numberRange(1, 2000)], justification: [required(), maxLen(800)] });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-ink-2">{t('m04.my.externalIntro')}</p>
        <button className="btn-primary btn-sm" onClick={() => { form.reset(); setOpen(true); }} data-testid="m04-external-new"><Icon name="plus" size={14} />{t('m04.my.externalNew')}</button>
      </div>
      <DataTable rows={rows} rowKey={(r) => r.id} empty={t('m04.my.externalNone')} columns={[
        { key: 'title', header: t('m04.common.title'), value: (r) => r.title },
        { key: 'provider', header: t('m04.my.provider'), value: (r) => r.provider },
        { key: 'cost', header: t('m04.my.cost'), value: (r) => r.cost_aed ?? null, render: (r) => (r.cost_aed != null ? f.num(r.cost_aed, { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }) : '—'), align: 'end' },
        { key: 'start', header: t('m04.my.start'), value: (r) => r.start_on ?? '', render: (r) => f.date(r.start_on) },
        { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} /> },
        { key: 'note', header: t('m04.my.decisionNote'), value: (r) => r.decision_note ?? '' },
      ]} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('m04.my.externalNew')} footer={<><button className="btn-outline" onClick={() => setOpen(false)}>{t('common.cancel')}</button><button className="btn-primary" form="m04-ext-form" type="submit" disabled={form.submitting}>{t('common.submit')}</button></>}>
        <form id="m04-ext-form" className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (v) => {
          const r = await run(() => repo.insert('external_requests', { person_id: s.identity.personId!, title: v.title.trim(), provider: v.provider.trim(), cost_aed: v.cost ? Number(v.cost) : null, start_on: v.start || null, hours: v.hours ? Number(v.hours) : null, justification: v.justification.trim(), status: 'requested' }), { success: t('m04.my.externalSent') });
          if (r.ok) setOpen(false);
        })}>
          <div className="sm:col-span-2"><TextField label={t('m04.common.title')} required {...form.field('title')} /></div>
          <TextField label={t('m04.my.provider')} required {...form.field('provider')} />
          <TextField label={t('m04.my.costAed')} type="number" {...form.field('cost')} />
          <TextField label={t('m04.my.start')} type="date" {...form.field('start')} />
          <TextField label={t('m04.my.hours')} type="number" {...form.field('hours')} />
          <div className="sm:col-span-2"><TextArea label={t('m04.my.justification')} required hint={t('m04.my.justificationHint')} {...form.field('justification')} /></div>
        </form>
      </Modal>
    </div>
  );
}

