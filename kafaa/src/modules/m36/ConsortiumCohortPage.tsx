// FS83 /ecosystem/consortium/:id (every ecosystem reader; rows RLS-filtered). Trainees: a partner reads only its own organisation's
// trainees (pseudonymous codes), an ENEC trainee reads their own place, HR and auditors read all. Nominate: a partner administrator for
// their own organisation (discipline only, never a person), HR for ENEC (an eligible staff reference) or on behalf of a partner without
// Kafa'a access. The HR director accepts (a mentor from another consortium organisation and a project team) or declines with a note.
// Visits: the trainee, their employer or the programme office logs a cross-site visit; only the host confirms it (the host's administrator,
// the ENEC programme office for ENEC sites, or the programme office on behalf of a host without access, with the host's reference); the
// confirmation writes evidence on the host site's focus skill (ENEC staff only). Figures: counts of 1-9 suppressed.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, Callout, Tabs, DataTable, ConfirmDialog, Drawer, EmptyState, WhyThis, BenchmarkChips, TextField, SelectField, StatTile, KeyValue } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import {
  DISCIPLINES, TEAMS, cohortPhase, consortiumOrg, isEnec, memberDecisionProblem, memberReasons, mentorsOf, modulesOf, partnerOf, partnersOf, visitProblem, visitReasons,
  type ConsortiumStats,
} from './consortium';
import type { HostVisit } from './backend/rpc';
import { CohortPill, ConsortiumLabels, MemberPill, VisitPill, usePartnerName } from './fs82ui';
import { CellView, useSkillName, useSkills, type Row } from './ui';

export default function ConsortiumCohortPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const { id = '' } = useParams();
  const hostRole = !!s.identity.orgId && s.can('ecosystem', ['OrgW']);
  const hr = s.can('ecosystem', ['W', 'A']) && s.can('workforce_strategy', ['W', 'A']);
  const q = useQuery(['consortium_cohorts', 'consortium_members', 'consortium_visits'] as unknown as Table[], async () => {
    const [cohort, members, visits] = await Promise.all([
      (repo.get('consortium_cohorts' as never, id) as unknown as Promise<Row | null>).catch(() => null),
      (repo.list('consortium_members' as never, { filter: { cohort_id: id } } as never) as unknown as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('consortium_visits' as never, { filter: { cohort_id: id } } as never) as unknown as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    let host: HostVisit[] = [];
    if (hostRole || hr) { const r = await repo.rpc.consortiumHostVisits(); host = r.ok && r.data ? r.data.filter((v) => v.cohort_id === id) : []; }
    const st = await repo.rpc.consortiumStats();
    const stat: ConsortiumStats['cohorts'][number] | null = st.ok && st.data ? st.data.cohorts.find((c) => c.cohort_id === id) ?? null : null;
    return { cohort, members, visits, host, stat };
  }, [id, hostRole, hr]);
  return (
    <Page title={t('m36.routes.ecosystem-consortium-cohort.title')} intro={t('m36.ccw.intro')} wide eyebrow={<BenchmarkChips feature="FS83" />}
      actions={<L to="/ecosystem/consortium" className="btn-outline btn-sm no-underline">{t('m36.ccw.toPublic')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => (d.cohort ? <Workspace {...d} cohort={d.cohort} hr={hr} /> : <EmptyState title={t('m36.ccw.notFound')}>{t('m36.ccw.notFoundBody')}</EmptyState>)}</Async>
    </Page>
  );
}

interface WsProps { cohort: Row; members: Row[]; visits: Row[]; host: HostVisit[]; stat: ConsortiumStats['cohorts'][number] | null; hr: boolean }

function Workspace({ cohort, members, visits, host, stat, hr }: WsProps) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const today = todayIso();
  const phase = cohortPhase(cohort, today);
  const org = s.identity.orgId;
  const orgw = !!org && s.can('ecosystem', ['OrgW']);
  const partner = orgw ? partnerOf(cohort, org) : null;
  const scope = hr || s.hasRole('auditor') || s.hasRole('admin') ? 'all' : orgw ? 'org' : 'own';
  const waitingHost = host.filter((v) => v.status === 'logged');
  const [tab, setTab] = useState('trainees');
  return (
    <div className="space-y-6" data-testid="m36-ccw" data-cohort={cohort.id} data-scope={scope}>
      <ConsortiumLabels />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 basis-72 flex-1">
            <div className="caps">{cohort.code}</div>
            <h2 className="break-words text-[18px] font-semibold">{pick(cohort, 'title')}</h2>
            <p className="text-[12.5px] text-ink-2">{t('m36.gr.range', { a: f.date(cohort.starts_on), b: f.date(cohort.ends_on) })} · {t('m36.cc.nominationsClose')}: {f.date(cohort.nominations_close_on)}</p>
          </div>
          <CohortPill phase={phase} />
        </div>
        <p className="mt-2 text-[12.5px] text-ink-2" data-testid="m36-ccw-scope">{t(`m36.ccw.scope.${scope}`, { org: partner ? pick(partner as unknown as Row, 'name') : '' })}</p>
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'trainees', label: t('m36.ccw.tab.trainees', { n: members.length }), content: <Trainees cohort={cohort} members={members} hr={hr} orgw={orgw} /> },
        { id: 'visits', label: t('m36.ccw.tab.visits', { n: visits.length }), content: <Visits cohort={cohort} members={members} visits={visits} hr={hr} orgw={orgw} /> },
        ...(orgw || hr ? [{ id: 'host', label: t('m36.ccw.tab.host', { n: waitingHost.length }), content: <HostQueue cohort={cohort} host={host} /> }] : []),
        { id: 'figures', label: t('m36.ccw.tab.figures'), content: <Figures cohort={cohort} stat={stat} /> },
      ]} />
    </div>
  );
}

// ───────────── Trainees
function Trainees({ cohort, members, hr, orgw }: { cohort: Row; members: Row[]; hr: boolean; orgw: boolean }) {
  const t = useT();
  const pick = usePick();
  const s = useSession();
  const partnerName = usePartnerName();
  const director = s.can('ecosystem', ['A']) && s.can('workforce_strategy', ['W', 'A']);
  const [open, setOpen] = useState<Row | null>(null);
  const mentorLabel = (id: string | null) => { const m = mentorsOf(cohort).find((x) => x.id === id); return m ? pick(m as unknown as Row, 'label') : '—'; };
  const waiting = members.filter((m) => m.status === 'nominated');
  return (
    <div className="space-y-6" data-testid="m36-ccw-trainees">
      {(orgw || hr) && <Nominate cohort={cohort} members={members} hr={hr} orgw={orgw} />}
      {director && waiting.length > 0 && (
        <Section title={t('m36.ccw.decideTitle')} description={t('m36.ccw.decideIntro')}>
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">{waiting.map((m) => <DecideCard key={m.id} cohort={cohort} m={m} />)}</ul>
        </Section>
      )}
      <Section title={t('m36.ccw.traineesTitle')}>
        <DataTable rows={members} rowKey={(m) => m.id} csvName={`consortium-${cohort.code}-trainees`} onRowClick={(m) => setOpen(m)} initialSort={{ key: 'code', dir: 'asc' }}
          empty={<EmptyState title={t('m36.ccw.noTrainees')}>{t('m36.ccw.noTraineesBody')}</EmptyState>}
          columns={[
            { key: 'code', header: t('m36.ccw.col.code'), value: (m) => m.trainee_code, render: (m) => <span className="num font-semibold" data-testid="m36-ccw-member" data-org={m.org_id}>{m.trainee_code}</span>, sortable: true },
            { key: 'org', header: t('m36.ccw.col.org'), value: (m) => partnerName(cohort, consortiumOrg(cohort, m.org_id) ?? m.org_id), sortable: true },
            { key: 'discipline', header: t('m36.ccw.col.discipline'), value: (m) => t(`m36.cc.discipline.${m.discipline}`), sortable: true },
            { key: 'status', header: t('m36.ccw.col.status'), value: (m) => m.status, render: (m) => <MemberPill status={m.status} />, sortable: true },
            { key: 'mentor', header: t('m36.ccw.col.mentor'), value: (m) => mentorLabel(m.mentor_id) },
            { key: 'team', header: t('m36.ccw.col.team'), value: (m) => m.team ?? '', render: (m) => (m.team ? t('m36.cc.teamName', { team: m.team }) : '—') },
          ]} />
      </Section>
      {open && (
        <Drawer open onClose={() => setOpen(null)} title={open.trainee_code}>
          <div className="space-y-2 text-[13px]">
            <KeyValue items={[
              [t('m36.ccw.col.org'), partnerName(cohort, consortiumOrg(cohort, open.org_id) ?? open.org_id)],
              [t('m36.ccw.col.discipline'), t(`m36.cc.discipline.${open.discipline}`)],
              [t('m36.ccw.col.status'), <MemberPill key="s" status={open.status} />],
              [t('m36.ccw.col.mentor'), mentorLabel(open.mentor_id)],
            ]} />
            {open.decision_note && <p className="rounded bg-sunken p-2">{open.decision_note}</p>}
            <WhyThis reasons={memberReasons(open, cohort)} testId="m36-ccw-member-why" />
          </div>
        </Drawer>
      )}
    </div>
  );
}

function Nominate({ cohort, members, hr, orgw }: { cohort: Row; members: Row[]; hr: boolean; orgw: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const today = todayIso();
  const phase = cohortPhase(cohort, today);
  const byHr = hr && !orgw;
  const hrOrgs = partnersOf(cohort).filter((p) => isEnec(p.org_id) || !p.kafaa_access);
  const [org, setOrg] = useState(byHr ? (hrOrgs[0]?.org_id ?? '') : (s.identity.orgId ?? ''));
  const [discipline, setDiscipline] = useState('');
  const [person, setPerson] = useState('');
  const [confirm, setConfirm] = useState(false);
  const p = partnerOf(cohort, org);
  const enec = !!p && isEnec(p.org_id);
  const used = members.filter((m) => consortiumOrg(cohort, m.org_id) === org && (m.status === 'nominated' || m.status === 'accepted')).length;
  if (phase !== 'nominating') return <Callout tone="info" title={t('m36.ccw.nomClosedTitle')}>{t('m36.ccw.nomClosed', { date: f.date(cohort.nominations_close_on) })}</Callout>;
  if (orgw && !p) return <Callout tone="info" title={t('m36.ccw.notMemberTitle')}>{t('m36.ccw.notMember')}</Callout>;
  const ready = !!p && !!discipline && (!enec || person.trim().length > 0) && used < Number(p.seats);
  const input = { cohort_id: String(cohort.id), discipline, org_id: org || null, person_id: enec ? person.trim() : null };
  return (
    <Card title={t('m36.ccw.nominateTitle', { date: f.date(cohort.nominations_close_on) })}>
      <div className="space-y-3" data-testid="m36-ccw-nominate" data-by={byHr ? 'hr' : 'partner'}>
        <p className="text-[12.5px] text-ink-2">{byHr ? t('m36.ccw.nomRuleHr') : t('m36.ccw.nomRulePartner')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {byHr
            ? <SelectField name="org" label={t('m36.ccw.col.org')} value={org} onChange={setOrg} options={hrOrgs.map((x) => ({ value: x.org_id, label: pick(x as unknown as Row, 'name') }))} />
            : <TextField name="org" label={t('m36.ccw.col.org')} value={p ? pick(p as unknown as Row, 'name') : ''} onChange={() => undefined} disabled />}
          <SelectField name="discipline" label={t('m36.ccw.col.discipline')} value={discipline} onChange={setDiscipline} placeholder={t('m36.ccw.choose')}
            options={DISCIPLINES.map((d) => ({ value: d, label: t(`m36.cc.discipline.${d}`) }))} />
        </div>
        {enec && <TextField name="person" label={t('m36.ccw.staffRef')} hint={t('m36.ccw.staffRefHint')} value={person} onChange={setPerson} />}
        {p && <p className="text-[12.5px] text-ink-3" data-testid="m36-ccw-seats" data-used={used}>{t('m36.ccw.seatsUsed', { used: f.num(used), seats: f.num(Number(p.seats)) })}</p>}
        <button type="button" className="btn-primary" disabled={!ready} onClick={() => setConfirm(true)} data-testid="m36-ccw-nominate-submit">{t('m36.ccw.nominate')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.ccw.nominateConfirm')} consequence={t('m36.ccw.nominateConsequence')}
        actingAs={byHr ? t('m36.grh.actingHr') : t('m36.ccw.actingPartner')} confirmLabel={t('m36.ccw.nominate')}
        onConfirm={async () => { const r = await run(() => repo.rpc.nominateConsortiumTrainee(input)); setConfirm(false); if (r.ok) { setDiscipline(''); setPerson(''); } }} />
    </Card>
  );
}

function DecideCard({ cohort, m }: { cohort: Row; m: Row }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const partnerName = usePartnerName();
  const home = consortiumOrg(cohort, m.org_id);
  const mentors = mentorsOf(cohort).filter((x) => consortiumOrg(cohort, x.org_id) !== home);
  const [mentor, setMentor] = useState('');
  const [team, setTeam] = useState('');
  const [mode, setMode] = useState<'accept' | 'decline' | null>(null);
  const own = !!m.person_id && m.person_id === s.identity.personId;
  const input = { member_id: String(m.id), decision: 'accept', mentor_id: mentor, team };
  const problem = memberDecisionProblem(input, m, cohort);
  return (
    <li className="card p-4" data-testid="m36-ccw-decide" data-id={m.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="num font-semibold">{m.trainee_code}</span><MemberPill status={m.status} />
      </div>
      <p className="text-[12.5px] text-ink-2">{partnerName(cohort, home ?? m.org_id)} · {t(`m36.cc.discipline.${m.discipline}`)}{m.initials ? ` · ${m.initials}` : ''}</p>
      {own ? <p className="mt-2 text-[12.5px] text-ink-3">{t('m36.ccw.ownPlace')}</p> : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectField name={`mentor-${m.id}`} label={t('m36.ccw.col.mentor')} value={mentor} onChange={setMentor} placeholder={t('m36.ccw.choose')}
            options={mentors.map((x) => ({ value: x.id, label: `${pick(x as unknown as Row, 'label')} · ${partnerName(cohort, x.org_id)}` }))} />
          <SelectField name={`team-${m.id}`} label={t('m36.ccw.col.team')} value={team} onChange={setTeam} placeholder={t('m36.ccw.choose')}
            options={TEAMS.map((x) => ({ value: x, label: t('m36.cc.teamName', { team: x }) }))} />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setMode('accept')} data-testid="m36-ccw-accept">{t('m36.ccw.accept')}</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setMode('decline')} data-testid="m36-ccw-decline">{t('m36.ccw.decline')}</button>
          </div>
          <p className="text-[12px] text-ink-3 sm:col-span-2">{t('m36.ccw.mentorRule')}</p>
        </div>
      )}
      <ConfirmDialog open={mode !== null} onClose={() => setMode(null)} title={mode === 'decline' ? t('m36.ccw.declineConfirm') : t('m36.ccw.acceptConfirm', { code: m.trainee_code })}
        consequence={mode === 'decline' ? t('m36.ccw.declineConsequence') : t('m36.ccw.acceptConsequence')} requireReason={mode === 'decline'} reasonLabel={t('m36.grh.declineNote')}
        actingAs={t('m36.grh.actingDirector')} danger={mode === 'decline'} confirmLabel={mode === 'decline' ? t('m36.ccw.decline') : t('m36.ccw.accept')}
        onConfirm={async (note) => { await run(() => repo.rpc.decideConsortiumMember(mode === 'decline' ? { member_id: String(m.id), decision: 'decline', note } : input)); setMode(null); }} />
    </li>
  );
}

// ───────────── Visits
function Visits({ cohort, members, visits, hr, orgw }: { cohort: Row; members: Row[]; visits: Row[]; hr: boolean; orgw: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const partnerName = usePartnerName();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const [open, setOpen] = useState<Row | null>(null);
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const pid = s.identity.personId;
  const loggable = members.filter((m) => m.status === 'accepted' && (hr || (orgw && m.org_id === s.identity.orgId) || (m.person_id && m.person_id === pid)));
  return (
    <div className="space-y-6" data-testid="m36-ccw-visits">
      {loggable.length > 0 && <LogVisit cohort={cohort} members={loggable} />}
      <DataTable rows={visits} rowKey={(v) => v.id} csvName={`consortium-${cohort.code}-visits`} onRowClick={(v) => setOpen(v)} initialSort={{ key: 'date', dir: 'desc' }}
        empty={<EmptyState title={t('m36.ccw.noVisits')}>{t('m36.ccw.noVisitsBody')}</EmptyState>}
        columns={[
          { key: 'date', header: t('m36.ccw.col.date'), value: (v) => String(v.visit_on), render: (v) => f.date(v.visit_on), sortable: true },
          { key: 'code', header: t('m36.ccw.col.code'), value: (v) => v.trainee_code, render: (v) => <span className="num" data-testid="m36-ccw-visit" data-org={v.org_id} data-status={v.status}>{v.trainee_code}</span>, sortable: true },
          { key: 'host', header: t('m36.ccw.col.host'), value: (v) => partnerName(cohort, v.host_org_id), sortable: true },
          { key: 'hours', header: t('m36.ccw.col.hours'), value: (v) => Number(v.hours), render: (v) => <span className="num">{f.num(Number(v.hours))}</span>, align: 'end', sortable: true },
          { key: 'skill', header: t('m36.gr.skill'), value: (v) => skillName(v.skill_id) },
          { key: 'status', header: t('m36.ccw.col.status'), value: (v) => v.status, render: (v) => <VisitPill status={v.status} />, sortable: true },
          { key: 'act', header: '', csv: false, render: (v) => (v.status === 'logged' && (v.person_id === pid || v.logged_by === pid)
            ? <button type="button" className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setWithdraw(v); }} data-testid="m36-ccw-withdraw">{t('m36.ccw.withdraw')}</button> : null) },
        ]} />
      {open && (
        <Drawer open onClose={() => setOpen(null)} title={`${open.trainee_code} · ${partnerName(cohort, open.host_org_id)}`}>
          <div className="space-y-2 text-[13px]">
            <KeyValue items={[
              [t('m36.ccw.col.date'), f.date(open.visit_on)], [t('m36.ccw.col.hours'), f.num(Number(open.hours))],
              [t('m36.gr.skill'), <L key="s" to={`/skills/${open.skill_id}`}>{skillName(open.skill_id)}</L>],
              [t('m36.ccw.col.status'), <VisitPill key="v" status={open.status} />],
              [t('m36.ccw.loggedVia'), t(`m36.cc.via.${open.logged_via}`)],
              ...(open.confirmed_via ? [[t('m36.ccw.confirmedVia'), t(`m36.cc.route.${open.confirmed_via}`)] as [string, string]] : []),
              ...(open.host_ref ? [[t('m36.ccw.hostRef'), open.host_ref] as [string, string]] : []),
            ]} />
            {open.note && <p className="rounded bg-sunken p-2">{open.note}</p>}
            {open.decline_reason && <p className="rounded bg-sunken p-2">{open.decline_reason}</p>}
            <WhyThis reasons={visitReasons(open)} testId="m36-ccw-visit-why" />
          </div>
        </Drawer>
      )}
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m36.ccw.withdrawConfirm')} consequence={t('m36.ccw.withdrawConsequence')} confirmLabel={t('m36.ccw.withdraw')}
        onConfirm={async () => { if (withdraw) await run(() => repo.rpc.withdrawConsortiumVisit(String(withdraw.id))); setWithdraw(null); }} />
    </div>
  );
}

export function LogVisit({ cohort, members, compact }: { cohort: Row; members: Row[]; compact?: boolean }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const partnerName = usePartnerName();
  const today = todayIso();
  const [memberId, setMemberId] = useState(String(members[0]?.id ?? ''));
  const [host, setHost] = useState('');
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const member = members.find((m) => m.id === memberId) ?? null;
  const home = member ? consortiumOrg(cohort, member.org_id) : null;
  const hosts = partnersOf(cohort).filter((p) => p.org_id !== home);
  const mods = modulesOf(cohort).filter((m) => m.host_org_id === host);
  const input = { member_id: memberId, host_org_id: host, visit_on: date, hours: Number(hours), module_id: moduleId || null, note };
  const problem = visitProblem(input, cohort, member, today);
  return (
    <Card title={t('m36.ccw.logTitle')}>
      <div className="space-y-3" data-testid="m36-ccw-log">
        {!compact && <p className="text-[12.5px] text-ink-2">{t('m36.ccw.logRule')}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {members.length > 1 && <SelectField name="member" label={t('m36.ccw.col.code')} value={memberId} onChange={setMemberId} options={members.map((m) => ({ value: String(m.id), label: String(m.trainee_code) }))} />}
          <SelectField name="host" label={t('m36.ccw.col.host')} value={host} onChange={(v) => { setHost(v); setModuleId(''); }} placeholder={t('m36.ccw.choose')}
            options={hosts.map((p) => ({ value: p.org_id, label: `${pick(p as unknown as Row, 'name')} · ${pick(p as unknown as Row, 'site')}` }))} />
          <TextField name="date" type="date" label={t('m36.ccw.col.date')} value={date} onChange={setDate} />
          <TextField name="hours" type="number" label={t('m36.ccw.col.hours')} hint={t('m36.ccw.hoursHint')} value={hours} onChange={setHours} />
          {mods.length > 0 && <SelectField name="module" label={t('m36.ccw.module')} value={moduleId} onChange={setModuleId} placeholder={t('m36.ccw.noModule')}
            options={mods.map((m) => ({ value: m.id, label: pick(m as unknown as Row, 'title') }))} />}
        </div>
        <TextField name="note" label={t('m36.ccw.noteLabel')} hint={t('m36.ccw.noteHint')} value={note} onChange={setNote} />
        {problem && host && date && hours && <p className="text-[12.5px] text-bad" data-testid="m36-ccw-log-problem" data-problem={problem}>{t(`m36.cc.problem.visit.${problem}`)}</p>}
        <button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-ccw-log-submit">{t('m36.ccw.logSubmit')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.ccw.logConfirm', { host: host ? partnerName(cohort, host) : '' })} consequence={t('m36.ccw.logConsequence')} confirmLabel={t('m36.ccw.logSubmit')}
        onConfirm={async () => { const r = await run(() => repo.rpc.logConsortiumVisit(input)); setConfirm(false); if (r.ok) { setHost(''); setDate(''); setHours(''); setNote(''); setModuleId(''); } }} />
    </Card>
  );
}

// ───────────── Host queue
function HostQueue({ cohort, host }: { cohort: Row; host: HostVisit[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const waiting = host.filter((v) => v.status === 'logged');
  const done = host.filter((v) => v.status !== 'logged');
  return (
    <div className="space-y-6" data-testid="m36-ccw-host">
      <Callout tone="info" title={t('m36.ccw.hostRuleTitle')}>{t('m36.ccw.hostRule')}</Callout>
      {waiting.length ? <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">{waiting.map((v) => <HostCard key={v.id} cohort={cohort} v={v} />)}</ul>
        : <EmptyState title={t('m36.ccw.hostEmpty')}>{t('m36.ccw.hostEmptyBody')}</EmptyState>}
      {done.length > 0 && (
        <Section title={t('m36.ccw.hostDone')}>
          <ul className="space-y-1 text-[13px]">
            {done.map((v) => <li key={v.id} className="flex flex-wrap items-center gap-2"><span className="num">{v.trainee_code}</span><span className="text-ink-2">{pick(v as unknown as Row, 'org_name')}</span><span>{f.date(v.visit_on)}</span><VisitPill status={v.status} /></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}

function HostCard({ cohort, v }: { cohort: Row; v: HostVisit }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const partnerName = usePartnerName();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const [mode, setMode] = useState<'confirm' | 'decline' | null>(null);
  const [ref, setRef] = useState('');
  const behalf = v.route === 'on_behalf';
  return (
    <li className="card p-4" data-testid="m36-ccw-host-visit" data-id={v.id} data-route={v.route}>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="num font-semibold">{v.trainee_code}</span><VisitPill status={v.status} /></div>
      <p className="text-[12.5px] text-ink-2">{t('m36.ccw.hostLine', { org: pick(v as unknown as Row, 'org_name'), host: partnerName(cohort, v.host_org_id) })}</p>
      <KeyValue items={[[t('m36.ccw.col.date'), f.date(v.visit_on)], [t('m36.ccw.col.hours'), f.num(v.hours)], [t('m36.gr.skill'), skillName(v.skill_id)], [t('m36.ccw.route'), t(`m36.cc.route.${v.route}`)]]} />
      {v.note && <p className="mt-1 rounded bg-sunken p-2 text-[12.5px]">{v.note}</p>}
      {behalf && <div className="mt-2"><TextField name={`ref-${v.id}`} label={t('m36.ccw.hostRef')} hint={t('m36.ccw.hostRefHint')} value={ref} onChange={setRef} /></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={behalf && ref.trim().length < 3} onClick={() => setMode('confirm')} data-testid="m36-ccw-confirm">{t('m36.ccw.confirm')}</button>
        <button type="button" className="btn-outline btn-sm" onClick={() => setMode('decline')} data-testid="m36-ccw-host-decline">{t('m36.ccw.decline')}</button>
      </div>
      <ConfirmDialog open={mode !== null} onClose={() => setMode(null)} title={mode === 'decline' ? t('m36.ccw.hostDeclineConfirm') : t('m36.ccw.hostConfirm', { code: v.trainee_code })}
        consequence={mode === 'decline' ? t('m36.ccw.hostDeclineConsequence') : t('m36.ccw.hostConfirmConsequence', { skill: skillName(v.skill_id) })} requireReason={mode === 'decline'} reasonLabel={t('m36.ccw.declineReason')}
        actingAs={t(`m36.cc.route.${v.route}`)} danger={mode === 'decline'} confirmLabel={mode === 'decline' ? t('m36.ccw.decline') : t('m36.ccw.confirm')}
        onConfirm={async (reason) => { await run(() => repo.rpc.confirmConsortiumVisit(mode === 'decline' ? { visit_id: v.id, decision: 'decline', reason } : { visit_id: v.id, decision: 'confirm', host_ref: ref.trim() || null })); setMode(null); }} />
    </li>
  );
}

// ───────────── Figures
function Figures({ cohort, stat }: { cohort: Row; stat: ConsortiumStats['cohorts'][number] | null }) {
  const t = useT();
  const f = useFormat();
  const partnerName = usePartnerName();
  if (!stat) return <EmptyState title={t('m36.ccw.noFigures')} />;
  return (
    <div className="space-y-6" data-testid="m36-ccw-figures">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m36.cc.trainees')} value={<CellView c={stat.trainees} testId="m36-ccw-fig-trainees" />} />
        <StatTile label={t('m36.cc.nominated')} value={<CellView c={stat.nominated} />} />
        <StatTile label={t('m36.cc.visitsConfirmed')} value={<CellView c={stat.visits_confirmed} />} tone="ok" />
        <StatTile label={t('m36.cc.visitsWaiting')} value={<CellView c={stat.visits_waiting} testId="m36-ccw-fig-waiting" />} tone="info" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m36.ccw.byOrg')}>
          <ul className="space-y-1 text-[13px]" data-testid="m36-ccw-by-org">
            {stat.by_org.map((x) => <li key={x.org_id} className="flex justify-between gap-2"><span>{partnerName(cohort, x.org_id)}</span><CellView c={x.trainees} /></li>)}
          </ul>
        </Section>
        <Section title={t('m36.ccw.byHost')}>
          <ul className="space-y-1 text-[13px]" data-testid="m36-ccw-by-host">
            {stat.by_host.map((x) => <li key={x.org_id} className="flex justify-between gap-2"><span>{partnerName(cohort, x.org_id)}</span><CellView c={x.confirmed} /></li>)}
          </ul>
        </Section>
      </div>
      <Callout tone="sim" title={t('m36.grp.supTitle')}>{t('m36.ccw.figuresNote', { n: f.num(10) })}</Callout>
    </div>
  );
}
