// FS20 /training/academies (instructors, training manager): the programme owner's console. Nominations waiting for a decision (the
// programme owner, training W + A, accepts naming a mentor and a reviewer, which enrols the member in the module courses, or declines),
// cohort rosters with module progress and capstone status (M04 cohort rule: training staff read member rows), and statistics that are
// suppressed under 10 people. Instructors see everything read-only.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, BenchmarkChips, Icon, Modal, SelectField, TextArea, DataTable, StatTile, Tabs, ProgressBar, Callout, EmptyState } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { MIN_GROUP, PARTICIPANT, memberStage } from './academy';
import { usePeople } from './ui';
import { CapstonePill, CohortPill, MemberPill, Suppressible, cohortStatsOf, useAcademyData, type AcademyData, type Row } from './fsUi';

export default function TrainingAcademiesPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useAcademyData();
  const q = useQuery(['academy_members', 'cohort_capstones', 'enrolments'], async () => {
    const [members, caps, enr] = await Promise.all([repo.list('academy_members'), repo.list('cohort_capstones'), repo.list('enrolments', { filter: { source: 'coordinator' } })]);
    return { members: members as Row[], caps: caps as Row[], enr: enr as Row[] };
  }, []);
  return (
    <Page title={t('m04.routes.training-academies.title')} intro={t('m04.tra.intro')} wide eyebrow={<BenchmarkChips feature="FS20" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(x) => <Console d={d} x={x} />}</Async>}</Async>
    </Page>
  );
}

function Console({ d, x }: { d: AcademyData; x: { members: Row[]; caps: Row[]; enr: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const owner = s.can('training', ['W']) && s.can('training', ['A']);
  const pending = x.members.filter((m) => m.status === 'nominated');
  const waiting = x.caps.filter((k) => k.status === 'submitted').length;
  const totals = d.stats.academies;
  const part = totals.reduce((n, a) => n + (a.participants ?? 0), 0);
  const alum = totals.reduce((n, a) => n + (a.alumni ?? 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m04-tra-tiles">
        <StatTile label={t('m04.tra.tile.pending')} value={f.num(pending.length)} tone={pending.length ? 'info' : undefined} sub={t('m04.tra.tile.pendingSub')} />
        <StatTile label={t('m04.tra.tile.participants')} value={f.num(part)} sub={t('m04.tra.tile.suppressedSub', { n: f.num(MIN_GROUP) })} />
        <StatTile label={t('m04.tra.tile.alumni')} value={f.num(alum)} tone="ok" sub={t('m04.tra.tile.suppressedSub', { n: f.num(MIN_GROUP) })} />
        <StatTile label={t('m04.tra.tile.review')} value={f.num(waiting)} sub={t('m04.tra.tile.reviewSub')} />
      </div>
      {!owner && <Callout tone="info" title={t('m04.tra.readOnlyTitle')}>{t('m04.tra.readOnly')}</Callout>}
      <Tabs initial="nominations" tabs={[
        { id: 'nominations', label: t('m04.tra.tab.nominations'), badge: pending.length ? f.num(pending.length) : undefined, content: <Nominations d={d} rows={pending} owner={owner} /> },
        { id: 'cohorts', label: t('m04.tra.tab.cohorts'), content: <Cohorts d={d} x={x} /> },
        { id: 'alumni', label: t('m04.tra.tab.alumni'), content: <Alumni d={d} x={x} /> },
      ]} />
    </div>
  );
}

function Nominations({ d, rows, owner }: { d: AcademyData; rows: Row[]; owner: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const people = usePeople();
  const [open, setOpen] = useState<Row | null>(null);
  if (!rows.length) return <EmptyState icon="users" title={t('m04.tra.noPending')} />;
  return (
    <>
      <DataTable rows={rows} rowKey={(r) => r.id} csvName="academy-nominations" caption={t('m04.tra.tab.nominations')} columns={[
        { key: 'person', header: t('m04.cohort.person'), value: (r) => people.name(r.person_id), sortable: true },
        { key: 'academy', header: t('m04.acad.academy'), value: (r) => pick(d.academies.find((a) => a.id === r.academy_id), 'name'), sortable: true },
        { key: 'cohort', header: t('m04.acad.cohort'), value: (r) => pick(d.cohorts.find((c) => c.id === r.cohort_id), 'label') },
        { key: 'source', header: t('m04.tra.source'), value: (r) => t(`m04.acad.source.${r.source}`) },
        { key: 'by', header: t('m04.tra.by'), value: (r) => (r.nominated_by === r.person_id ? t('m04.acad.source.self') : people.name(r.nominated_by)) },
        { key: 'at', header: t('m04.tra.on'), value: (r) => f.date(r.nominated_at), sortable: true },
        { key: 'note', header: t('m04.acad.nominate.note'), value: (r) => r.note ?? '' },
        { key: 'act', header: '', csv: false, render: (r) => owner ? <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(r)} data-testid="m04-tra-decide">{t('m04.tra.decide')}</button> : null },
      ]} />
      {open && <DecideModal d={d} m={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function DecideModal({ d, m, onClose }: { d: AcademyData; m: Row; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const a = d.academies.find((x) => x.id === m.academy_id)!;
  const staff = useMemo(() => people.list.filter((p) => p.kind === 'staff' && p.status === 'active' && p.id !== m.person_id).map((p) => ({ value: p.id, label: people.name(p.id) })).sort((x, y) => x.label.localeCompare(y.label)), [people, m.person_id]);
  const [mentor, setMentor] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (decision: 'accept' | 'decline') => {
    setBusy(true);
    const r = await run(() => repo.rpc.decideAcademyNomination({ member_id: m.id, decision, mentor_person_id: mentor || null, reviewer_person_id: reviewer || null, note }),
      { success: decision === 'accept' ? t('m04.tra.accepted') : t('m04.tra.declined') });
    setBusy(false);
    if (r.ok) onClose();
  };
  return (
    <Modal open onClose={onClose} size="lg" title={t('m04.tra.decideTitle', { name: people.name(m.person_id), academy: pick(a, 'name') })}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => go('decline')} data-testid="m04-tra-decline">{t('m04.tra.decline')}</button>
        <button type="button" className="btn-primary" disabled={busy || !mentor || !reviewer} onClick={() => go('accept')} data-testid="m04-tra-accept">{t('m04.tra.accept')}</button>
      </div>}>
      <div className="space-y-3">
        {m.note && <p className="rounded-md bg-sunken p-2 text-[13px]">“{m.note}”</p>}
        <p className="text-[13px] text-ink-2">{t('m04.tra.acceptExplain', { n: (a.module_course_ids ?? []).length })}</p>
        <SelectField name="m04-tra-mentor" label={`${t('m04.acad.triad.mentor')} · ${pick(a, 'mentor_role')}`} value={mentor} onChange={setMentor} options={staff} placeholder={t('common.choose')} />
        <SelectField name="m04-tra-reviewer" label={`${t('m04.acad.triad.reviewer')} · ${pick(a, 'reviewer_role')}`} value={reviewer} onChange={setReviewer} options={staff.filter((o) => o.value !== mentor)} placeholder={t('common.choose')} hint={t('m04.tra.reviewerHint')} />
        <TextArea name="m04-tra-note" label={t('m04.tra.note')} value={note} onChange={setNote} rows={2} />
      </div>
    </Modal>
  );
}

function Cohorts({ d, x }: { d: AcademyData; x: { members: Row[]; caps: Row[]; enr: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const people = usePeople();
  const [cohortId, setCohortId] = useState(d.cohorts.find((c) => c.status === 'running')?.id ?? d.cohorts[0]?.id ?? '');
  const c = d.cohorts.find((y) => y.id === cohortId);
  const a = c ? d.academies.find((y) => y.id === c.academy_id) : undefined;
  const st = c ? cohortStatsOf(d.stats, c.id) : undefined;
  const roster = x.members.filter((m) => m.cohort_id === cohortId && (PARTICIPANT as string[]).includes(m.status));
  const mods = (a?.module_course_ids ?? []) as string[];
  const doneOf = (pid: string) => mods.filter((cid) => x.enr.some((e) => e.person_id === pid && e.course_id === cid && e.status === 'completed')).length;
  return (
    <div className="space-y-4">
      <div className="w-full max-w-md"><SelectField name="m04-tra-cohort" label={t('m04.acad.cohort')} value={cohortId} onChange={setCohortId}
        options={d.cohorts.map((y) => ({ value: y.id, label: `${pick(d.academies.find((z) => z.id === y.academy_id), 'name')} · ${pick(y, 'label')}` }))} /></div>
      {c && a && (
        <>
          <Card title={<span className="flex flex-wrap items-center gap-2">{pick(a, 'name')} · {pick(c, 'label')}<CohortPill status={c.status} /></span>} eyebrow={`${f.date(c.starts_on)} – ${f.date(c.ends_on)}`}>
            <div className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-5" data-testid="m04-tra-stats">
              <div><span className="caps block text-[10.5px]">{t('m04.acad.participants')}</span><Suppressible value={st?.participants} /></div>
              <div><span className="caps block text-[10.5px]">{t('m04.acad.capacity')}</span><span className="num">{f.num(c.capacity)}</span></div>
              <div><span className="caps block text-[10.5px]">{t('m04.acad.modulePct')}</span><Suppressible value={st?.module_pct} pct /></div>
              <div><span className="caps block text-[10.5px]">{t('m04.acad.completionPct')}</span><Suppressible value={st?.completion_pct} pct /></div>
              <div><span className="caps block text-[10.5px]">{t('m04.acad.passPct')}</span><Suppressible value={st?.pass_pct} pct /></div>
            </div>
            <div className="mt-3"><ProgressBar value={c.capacity ? (roster.length * 100) / c.capacity : 0} label={t('m04.tra.filled')} /></div>
          </Card>
          {st?.suppressed && <Callout tone="info" title={t('m04.acad.suppress.title')}>{t('m04.tra.suppressedCohort')}</Callout>}
          <DataTable rows={roster} rowKey={(r) => r.id} csvName={`cohort-${cohortId}`} caption={t('m04.tra.roster')} empty={t('m04.tra.noRoster')} columns={[
            { key: 'person', header: t('m04.cohort.person'), value: (r) => people.name(r.person_id), sortable: true },
            { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <MemberPill status={r.status} /> },
            { key: 'stage', header: t('m04.tra.stage'), value: (r) => t(`m04.acad.stage.${memberStage(r as { status: string }, x.caps.find((k) => k.member_id === r.id) as { status: string } | undefined, doneOf(r.person_id), mods.length)}`) },
            { key: 'mods', header: t('m04.tra.modules'), value: (r) => doneOf(r.person_id), render: (r) => <span className="num">{f.num(doneOf(r.person_id))}/{f.num(mods.length)}</span>, align: 'end', sortable: true },
            { key: 'cap', header: t('m04.my.acad.cap.title'), value: (r) => x.caps.find((k) => k.member_id === r.id)?.status ?? '', render: (r) => { const k = x.caps.find((y) => y.member_id === r.id); return k ? <CapstonePill status={k.status} result={k.result} /> : '—'; } },
            { key: 'mentor', header: t('m04.acad.triad.mentor'), value: (r) => people.name(r.mentor_person_id) },
            { key: 'reviewer', header: t('m04.acad.triad.reviewer'), value: (r) => people.name(r.reviewer_person_id) },
          ]} />
          <p className="text-[12.5px] text-ink-3"><Icon name="info" size={13} className="me-1 inline" />{t('m04.tra.rosterNote')} <L to="/training/cohorts">{t('m04.routes.training-cohorts.title')}</L></p>
        </>
      )}
    </div>
  );
}

function Alumni({ d, x }: { d: AcademyData; x: { members: Row[]; caps: Row[]; enr: Row[] } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const people = usePeople();
  const rows = x.members.filter((m) => m.status === 'completed');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {d.stats.academies.map((s) => (
          <Card key={s.academy_id} title={pick(d.academies.find((a) => a.id === s.academy_id), 'name')}>
            <p className="text-[13px]">{t('m04.acad.alumni')}: <Suppressible value={s.alumni} /></p>
            <p className="text-[13px]">{t('m04.acad.participants')}: <Suppressible value={s.participants} /></p>
          </Card>
        ))}
      </div>
      <DataTable rows={rows} rowKey={(r) => r.id} csvName="academy-alumni" caption={t('m04.tra.tab.alumni')} empty={t('m04.tra.noAlumni')} columns={[
        { key: 'person', header: t('m04.cohort.person'), value: (r) => people.name(r.person_id), sortable: true },
        { key: 'academy', header: t('m04.acad.academy'), value: (r) => pick(d.academies.find((a) => a.id === r.academy_id), 'name'), sortable: true },
        { key: 'cohort', header: t('m04.acad.cohort'), value: (r) => pick(d.cohorts.find((c) => c.id === r.cohort_id), 'label') },
        { key: 'result', header: t('m04.tra.result'), value: (r) => { const k = x.caps.find((y) => y.member_id === r.id); return k?.result ? t(`m04.acad.result.${k.result}`) : '—'; } },
        { key: 'on', header: t('m04.common.completedOn'), value: (r) => (r.completed_on ? f.date(r.completed_on) : '—'), sortable: true },
      ]} />
    </div>
  );
}
