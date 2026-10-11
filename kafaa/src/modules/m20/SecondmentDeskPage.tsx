// /opportunities/secondments/hr (M20 · FS28): the HR secondment desk (hr_analyst, hr_director; auditors read-only). Plan an external
// secondment (host, objectives tied to catalogue skills, host supervisor role, dates), close it on return (objectives met, outcome; this
// creates the knowledge-capture session in the knowledge studio, due within 60 days) or cancel it. Security, cyber and safeguards staff,
// skills and roles are never offered (the RPC refuses and audits). Every action goes through an RPC behind a confirmation.
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Async, StatTile, DataTable, Modal, ConfirmDialog, Icon, Callout, SimChip, BenchmarkChips, TextField, TextArea, SelectField, CheckboxField, Donut } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { HOST_KINDS, TRACKS, MAX_OBJECTIVES, endOf, phaseOf, transferState, validateClose, validateSecondment, type SecondmentInput } from './secondment';
import { HostKindChip, SecPhasePill, TransferPill, useRuleMessage, todayIso } from './fsUi';
import { SecondmentCard } from './SecondmentsPage';
import type { JobRolesRow, OrganisationsRow, SecondmentsRow, SkillsRow } from '../../data/types';
import type { SecondmentDesk } from './backend/rpc';

const RESTRICTED = ['security', 'cyber', 'safeguards'];
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function SecondmentDeskPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['secondments', 'capture_sessions', 'skills', 'job_roles', 'organisations'], async () => {
    const [desk, skills, roles, orgs] = await Promise.all([repo.rpc.secondmentDesk(), repo.list('skills', { order: [['sort', 'asc']] }), repo.list('job_roles', { order: [['sort', 'asc']] }), repo.list('organisations', { order: [['name_en', 'asc']] }).catch(() => [] as OrganisationsRow[])]);
    return { desk, skills, roles, orgs };
  });
  return (
    <Page title={t('m20.routes.secondments-desk.title')} eyebrow={<L to="/opportunities/secondments">{t('m20.sec.desk.back')}</L>} intro={t('m20.sec.desk.intro')} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2"><BenchmarkChips feature="FS28" /><SimChip label={t('m20.sec.page.synthetic')} /></div>
      <Async state={q} isEmpty={(d) => !d.desk} empty={<Callout tone="info" title={t('m20.sec.desk.noAccess')}>{t('m20.sec.desk.noAccessBody')}</Callout>}>
        {(d) => <Desk desk={d.desk!} skills={d.skills} roles={d.roles} orgs={d.orgs} />}
      </Async>
    </Page>
  );
}

function Desk({ desk, skills, roles, orgs }: { desk: SecondmentDesk; skills: SkillsRow[]; roles: JobRolesRow[]; orgs: OrganisationsRow[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const [plan, setPlan] = useState(false);
  const [close, setClose] = useState<SecondmentsRow | null>(null);
  const [open, setOpen] = useState<SecondmentsRow | null>(null);
  const today = todayIso();
  const sessions = new Map(desk.sessions.map((s) => [s.id, s]));
  const st = desk.stats;
  const name = (r: SecondmentsRow) => (lang === 'ar' ? r.person_name_ar || r.person_name : r.person_name);
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.sec.desk.statTotal')} value={f.num(st.total)} sub={t('m20.sec.desk.statTotalSub', { n: f.num(st.by_phase.upcoming), m: f.num(st.by_phase.on_secondment) })} />
        <StatTile label={t('m20.sec.desk.statReturnDue')} value={f.num(st.by_phase.return_due)} sub={t('m20.sec.desk.statReturnDueSub')} tone={st.by_phase.return_due ? 'info' : undefined} />
        <StatTile label={t('m20.sec.desk.statOverdue')} value={f.num(st.transfer.overdue)} sub={t('m20.sec.desk.statOverdueSub', { due: f.num(st.transfer.due), done: f.num(st.transfer.done) })} tone={st.transfer.overdue ? 'bad' : 'ok'} />
        <StatTile label={t('m20.sec.page.statPeople')} value={st.suppressed ? t('m20.fs.hr.suppressedShort') : f.num(st.people ?? 0)} sub={st.suppressed ? t('m20.sec.page.suppressed', { n: f.num(st.min_group) }) : t('m20.sec.page.statPeopleSub')} />
      </Grid>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Section title={t('m20.sec.desk.listTitle')} actions={desk.can_edit ? <button className="btn-primary btn-sm" onClick={() => setPlan(true)} data-testid="m20-sec-plan-open"><Icon name="plus" size={14} />{t('m20.sec.desk.plan')}</button> : <SimChip label={t('m20.sec.desk.readOnly')} />}>
          <DataTable rows={desk.rows} rowKey={(r) => r.id} csvName="secondments.csv" caption={t('m20.sec.desk.listTitle')} onRowClick={(r) => setOpen(r)}
            columns={[
              { key: 'person', header: t('m20.sec.desk.colPerson'), value: (r) => name(r) },
              { key: 'host', header: t('m20.sec.desk.colHost'), value: (r) => pick(r, 'host_name'), render: (r) => <span className="flex flex-col gap-1"><span>{pick(r, 'host_name')}</span><HostKindChip kind={r.host_kind} /></span> },
              { key: 'dates', header: t('m20.sec.desk.colDates'), value: (r) => r.start_on, render: (r) => `${f.date(r.start_on)} – ${f.date(r.end_on)}` },
              { key: 'phase', header: t('m20.sec.desk.colPhase'), value: (r) => phaseOf(r, today), render: (r) => <SecPhasePill phase={phaseOf(r, today)} /> },
              { key: 'transfer', header: t('m20.sec.desk.colTransfer'), value: (r) => transferState(r, r.capture_session_id ? sessions.get(r.capture_session_id) ?? null : null, today), render: (r) => <TransferPill state={transferState(r, r.capture_session_id ? sessions.get(r.capture_session_id) ?? null : null, today)} /> },
              { key: 'act', header: '', csv: false, render: (r) => (desk.can_edit && r.status === 'planned' && r.start_on <= today ? <button className="btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setClose(r); }} data-testid={`m20-sec-close-${r.id}`}>{t('m20.sec.desk.close')}</button> : null) },
            ]} />
        </Section>
        <aside className="space-y-4">
          <Donut title={t('m20.sec.desk.byPhase')} data={(['upcoming', 'on_secondment', 'return_due', 'returned', 'cancelled'] as const).map((k) => ({ label: t(`m20.sec.phase.${k}`), value: st.by_phase[k] }))} center={f.num(st.total)} />
          <Callout tone="info" title={t('m20.sec.page.securityTitle')}>{t('m20.sec.page.security')}</Callout>
        </aside>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${name(open)} · ${pick(open, 'host_name')}` : ''} size="lg">
        {open && <SecondmentCard r={open} sessions={desk.sessions} roles={roles} skills={skills} />}
      </Modal>
      {desk.can_edit && <PlanModal open={plan} onClose={() => setPlan(false)} desk={desk} skills={skills} roles={roles} orgs={orgs} />}
      {close && <CloseModal r={close} onClose={() => setClose(null)} />}
    </div>
  );
}

function PlanModal({ open, onClose, desk, skills, roles, orgs }: { open: boolean; onClose: () => void; desk: SecondmentDesk; skills: SkillsRow[]; roles: JobRolesRow[]; orgs: OrganisationsRow[] }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const msg = useRuleMessage();
  const [v, setV] = useState({ person_id: desk.people[0]?.id ?? '', host_kind: 'university', host_org_id: '', host_name_en: '', host_name_ar: '', host_country: 'AE', supervisor_en: '', supervisor_ar: '', future_role_id: '', track: '', start_on: addDays(30), months: '6' });
  const [objs, setObjs] = useState([{ skill_id: '', level: 2, text_en: '', text_ar: '' }]);
  const [confirm, setConfirm] = useState(false);
  const fld = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (x: string) => setV((c) => ({ ...c, [k]: x })) });
  const selectable = skills.filter((s) => s.area !== 'security');
  const roleOpts = roles.filter((r) => !RESTRICTED.includes(String(r.family_id)) && (r.lifecycle === 'concept' || r.lifecycle === 'current'));
  const input: SecondmentInput = { ...v, host_org_id: v.host_org_id || null, future_role_id: v.future_role_id || null, track: v.track || null, months: Number(v.months), objectives: objs };
  const problem = useMemo(() => validateSecondment(input, { people: desk.people.map((p) => ({ id: p.id, kind: 'staff', status: 'active', job_family_id: p.family_id })), skills: skills as never, roles: roles as never, orgs: orgs.map((o) => o.id) }, todayIso()), [input, desk.people, skills, roles, orgs]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title={t('m20.sec.desk.planTitle')} size="lg"
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m20-sec-plan-save">{t('m20.sec.desk.plan')}</button></>}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m20-sec-plan-form">
        <SelectField label={t('m20.sec.f.person')} {...fld('person_id')} options={desk.people.map((p) => ({ value: p.id, label: lang === 'ar' ? p.name_ar : p.name }))} />
        <SelectField label={t('m20.sec.f.hostKind')} {...fld('host_kind')} options={HOST_KINDS.map((k) => ({ value: k, label: t(`m20.sec.host.${k}`) }))} />
        <TextField label={t('m20.sec.f.hostEn')} required {...fld('host_name_en')} />
        <TextField label={t('m20.sec.f.hostAr')} required {...fld('host_name_ar')} />
        <SelectField label={t('m20.sec.f.org')} {...fld('host_org_id')} options={[{ value: '', label: t('m20.sec.f.noOrg') }, ...orgs.map((o) => ({ value: o.id, label: pick(o, 'name') }))]} />
        <TextField label={t('m20.sec.f.country')} required hint={t('m20.sec.f.countryHint')} {...fld('host_country')} />
        <TextField label={t('m20.sec.f.supervisorEn')} required hint={t('m20.sec.f.supervisorHint')} {...fld('supervisor_en')} />
        <TextField label={t('m20.sec.f.supervisorAr')} required {...fld('supervisor_ar')} />
        <TextField label={t('m20.sec.f.start')} type="date" required {...fld('start_on')} />
        <TextField label={t('m20.sec.f.months')} type="number" required hint={t('m20.sec.f.endsOn', { d: /^\d{4}-\d{2}-\d{2}$/.test(v.start_on) && Number(v.months) > 0 ? endOf(v.start_on, Number(v.months)) : '—' })} {...fld('months')} />
        <SelectField label={t('m20.sec.f.track')} {...fld('track')} options={[{ value: '', label: t('m20.sec.f.noTrack') }, ...TRACKS.map((k) => ({ value: k, label: t(`m20.sec.track.${k}`) }))]} />
        <SelectField label={t('m20.sec.f.futureRole')} {...fld('future_role_id')} options={[{ value: '', label: t('m20.sec.f.noRole') }, ...roleOpts.map((r) => ({ value: r.id, label: pick(r, 'title') }))]} />
      </div>
      <fieldset className="mt-4 space-y-3">
        <legend className="caps">{t('m20.sec.f.objectives')}</legend>
        {objs.map((o, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-card border border-line p-3 md:grid-cols-2">
            <SelectField label={t('m20.sec.f.skill')} name={`skill-${i}`} value={o.skill_id} onChange={(x) => setObjs((a) => a.map((y, j) => (j === i ? { ...y, skill_id: x } : y)))} options={[{ value: '', label: '—' }, ...selectable.map((s) => ({ value: s.id, label: pick(s, 'name') }))]} />
            <SelectField label={t('m20.sec.f.level')} name={`level-${i}`} value={String(o.level)} onChange={(x) => setObjs((a) => a.map((y, j) => (j === i ? { ...y, level: Number(x) } : y)))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
            <TextField label={t('m20.sec.f.objEn')} name={`en-${i}`} value={o.text_en} onChange={(x) => setObjs((a) => a.map((y, j) => (j === i ? { ...y, text_en: x } : y)))} />
            <TextField label={t('m20.sec.f.objAr')} name={`ar-${i}`} value={o.text_ar} onChange={(x) => setObjs((a) => a.map((y, j) => (j === i ? { ...y, text_ar: x } : y)))} />
          </div>
        ))}
        {objs.length < MAX_OBJECTIVES && <button type="button" className="btn-ghost btn-sm" onClick={() => setObjs((a) => [...a, { skill_id: '', level: 1, text_en: '', text_ar: '' }])}><Icon name="plus" size={13} />{t('m20.sec.f.addObjective')}</button>}
      </fieldset>
      {problem && <p className="mt-3 text-[12.5px] text-bad" role="alert" data-testid="m20-sec-plan-problem">{msg(problem.message)}</p>}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.sec.desk.planTitle')} consequence={t('m20.sec.desk.planBody')} confirmLabel={t('m20.sec.desk.plan')}
        onConfirm={async () => { const r = await run(() => repo.rpc.planSecondment(input)); if (r.ok) onClose(); }} />
    </Modal>
  );
}

function CloseModal({ r, onClose }: { r: SecondmentsRow; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const msg = useRuleMessage();
  const objs = (r.objectives as unknown as { id: string; text_en: string; text_ar: string }[]) ?? [];
  const [decision, setDecision] = useState<'return' | 'cancel'>('return');
  const [returned, setReturned] = useState(todayIso() < r.end_on ? todayIso() : r.end_on < addDays(-30) ? todayIso() : r.end_on);
  const [note, setNote] = useState('');
  const [met, setMet] = useState<Record<string, boolean>>(Object.fromEntries(objs.map((o) => [o.id, true])));
  const [confirm, setConfirm] = useState(false);
  const input = decision === 'return' ? { returned_on: returned, outcome_note: note, met } : { outcome_note: note };
  const problem = validateClose(r as never, decision, input, todayIso());
  return (
    <Modal open onClose={onClose} title={t('m20.sec.desk.closeTitle', { name: lang === 'ar' ? r.person_name_ar || r.person_name : r.person_name })}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m20-sec-close-save">{decision === 'return' ? t('m20.sec.desk.closeReturn') : t('m20.sec.desk.closeCancel')}</button></>}>
      <div className="space-y-3" data-testid="m20-sec-close-form">
        <SelectField label={t('m20.sec.desk.decision')} name="decision" value={decision} onChange={(x) => setDecision(x as 'return' | 'cancel')} options={[{ value: 'return', label: t('m20.sec.desk.closeReturn') }, { value: 'cancel', label: t('m20.sec.desk.closeCancel') }]} />
        {decision === 'return' && (
          <>
            <TextField label={t('m20.sec.f.returned')} type="date" name="returned" value={returned} onChange={setReturned} />
            <fieldset><legend className="caps mb-1">{t('m20.sec.desk.met')}</legend>{objs.map((o) => <CheckboxField key={o.id} label={lang === 'ar' ? o.text_ar : o.text_en} checked={!!met[o.id]} onChange={(x) => setMet((m) => ({ ...m, [o.id]: x }))} />)}</fieldset>
            <Callout tone="info" title={t('m20.sec.desk.transferTitle')}>{t('m20.sec.desk.transferBody')}</Callout>
          </>
        )}
        <TextArea label={decision === 'return' ? t('m20.sec.desk.outcome') : t('m20.sec.desk.cancelReason')} name="note" value={note} onChange={setNote} />
        {problem && note.length > 0 && <p className="text-[12.5px] text-bad" role="alert">{msg(problem.message)}</p>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={decision === 'return' ? t('m20.sec.desk.closeReturn') : t('m20.sec.desk.closeCancel')} consequence={decision === 'return' ? t('m20.sec.desk.transferBody') : t('m20.sec.desk.cancelBody')} danger={decision === 'cancel'}
        confirmLabel={decision === 'return' ? t('m20.sec.desk.closeReturn') : t('m20.sec.desk.closeCancel')}
        onConfirm={async () => { const res = await run(() => repo.rpc.closeSecondment(r.id, decision, input)); if (res.ok) onClose(); }} />
    </Modal>
  );
}
