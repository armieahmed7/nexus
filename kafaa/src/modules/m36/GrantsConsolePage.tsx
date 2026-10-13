// FS82 /workspace/grants HR console (workforce_strategy W/A: the HR analyst and the HR director; auditors read). Decisions: closed rounds
// with the SIMULATED budget meter (committed vs budget, from committedIn) and each waiting application (initials, years since hire, the
// purpose, the skill and the promised output); the HR director approves (award within the request, the maximum and the budget left) or
// declines with a note; never their own application; every decision is an RPC behind a ConfirmDialog (audit + ledger). Outputs: accept
// (validated evidence on the named skill for staff) or return with a note. Rounds: the computed next slot and its budget. On behalf: a
// placement student's application with a consent reference. All applications: a sortable table with CSV.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, Callout, Tabs, DataTable, ConfirmDialog, Drawer, EmptyState, WhyThis, BenchmarkChips, TextField, TextArea, SelectField, ProgressBar, KeyValue } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import {
  COST_ITEMS, GRANT_KINDS, OUTPUT_KINDS, applicationProblem, applicationReasons, committedIn, costTotal, decisionProblem, latestRound, nextRoundSlot, openRound, outputDue, outputState, roundPhase,
  scheduleProblem, type ApplicationInput,
} from './grants';
import { AppPill, GrantLabels, OutputPill, RoundPill, RoundStrip, useMoney, useRange } from './fs82ui';
import { useSkillName, useSkills, type Row } from './ui';

export default function GrantsConsolePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['grant_rounds', 'grant_applications'] as unknown as Table[], async () => {
    const [rounds, apps] = await Promise.all([repo.list('grant_rounds' as never) as unknown as Promise<Row[]>, repo.list('grant_applications' as never) as unknown as Promise<Row[]>]);
    return { rounds, apps };
  });
  return (
    <Page title={t('m36.routes.workforce-grants.title')} intro={t('m36.grh.intro')} wide eyebrow={<BenchmarkChips feature="FS82" />}
      actions={<L to="/ecosystem/grants" className="btn-outline btn-sm no-underline">{t('m36.grh.toProgramme')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Console rounds={d.rounds} apps={d.apps} />}</Async>
    </Page>
  );
}

function Console({ rounds, apps }: { rounds: Row[]; apps: Row[] }) {
  const t = useT();
  const s = useSession();
  const today = todayIso();
  const director = s.can('ecosystem', ['A']) && s.can('workforce_strategy', ['W', 'A']);
  const hr = s.can('ecosystem', ['W', 'A']) && s.can('workforce_strategy', ['W', 'A']);
  const outputsWaiting = apps.filter((a) => a.status === 'approved' && a.output_status === 'submitted');
  const overdue = apps.filter((a) => outputState(a, today) === 'overdue');
  const deciding = rounds.filter((r) => roundPhase(r, today) === 'closed' && apps.some((a) => a.round_id === r.id && a.status === 'submitted'));
  const [tab, setTab] = useState('decisions');
  return (
    <div className="space-y-6" data-testid="m36-grh" data-director={director ? 'yes' : 'no'}>
      <GrantLabels />
      {!hr && <Callout tone="info" title={t('m36.grh.readOnlyTitle')}>{t('m36.grh.readOnlyBody')}</Callout>}
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'decisions', label: t('m36.grh.tab.decisions', { n: deciding.length }), content: <Decisions rounds={rounds} apps={apps} director={director} /> },
        { id: 'outputs', label: t('m36.grh.tab.outputs', { n: outputsWaiting.length }), content: <Outputs waiting={outputsWaiting} overdue={overdue} hr={hr} /> },
        { id: 'rounds', label: t('m36.grh.tab.rounds'), content: <Rounds rounds={rounds} hr={hr} /> },
        { id: 'behalf', label: t('m36.grh.tab.behalf'), content: <OnBehalf rounds={rounds} hr={hr} /> },
        { id: 'all', label: t('m36.grh.tab.all'), content: <AllApps apps={apps} rounds={rounds} /> },
      ]} />
    </div>
  );
}

function Applicant({ a }: { a: Row }) {
  const t = useT();
  const f = useFormat();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="m36-grh-applicant">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold" aria-hidden>{a.initials || '—'}</span>
      <span className="text-[12.5px] text-ink-2">{a.basis === 'placement' ? t('m36.grh.placement') : t('m36.grh.years', { n: f.num(Number(a.years ?? 0)) })}</span>
      {a.on_behalf && <span className="text-[11.5px] text-ink-3">{t('m36.grh.onBehalfMark')}</span>}
    </span>
  );
}

function Decisions({ rounds, apps, director }: { rounds: Row[]; apps: Row[]; director: boolean }) {
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const today = todayIso();
  const list = rounds.filter((r) => apps.some((a) => a.round_id === r.id && a.status === 'submitted')).sort((a, b) => (a.closes_on < b.closes_on ? -1 : 1));
  if (!list.length) return <EmptyState title={t('m36.grh.noDecisions')}>{t('m36.grh.noDecisionsBody')}</EmptyState>;
  return (
    <div className="space-y-6" data-testid="m36-grh-decisions">
      {list.map((r) => {
        const ph = roundPhase(r, today);
        const committed = committedIn(apps, r.id);
        const waiting = apps.filter((a) => a.round_id === r.id && a.status === 'submitted');
        const asked = waiting.reduce((m, a) => m + Number(a.amount), 0);
        const pct = Math.round((100 * committed) / Number(r.budget));
        return (
          <Section key={r.id} title={t('m36.gr.roundTo', { date: f.date(r.closes_on) })} actions={<RoundPill phase={ph} />}>
            <Card>
              <div className="space-y-2" data-testid="m36-grh-budget" data-round={r.id} data-committed={committed}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span>{t('m36.grh.committed', { c: money(committed), b: money(Number(r.budget)) })}</span>
                  <span className="text-ink-2">{t('m36.grh.asked', { a: money(asked), n: f.num(waiting.length) })}</span>
                </div>
                <ProgressBar value={pct} tone={pct >= 90 ? 'bad' : pct >= 70 ? 'sim' : 'ok'} label={t('m36.grh.budgetUse')} />
                {ph !== 'closed' && <p className="text-[12.5px] text-ink-3" data-testid="m36-grh-after-deadline">{t('m36.grh.afterDeadline', { date: f.date(r.closes_on) })}</p>}
                {ph === 'closed' && today > String(r.decide_by) && <p className="text-[12.5px] text-bad">{t('m36.grh.late', { date: f.date(r.decide_by) })}</p>}
              </div>
            </Card>
            <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {waiting.map((a) => <DecisionCard key={a.id} a={a} round={r} committed={committed} canDecide={director && ph === 'closed'} />)}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}

function DecisionCard({ a, round, committed, canDecide }: { a: Row; round: Row; committed: number; canDecide: boolean }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const money = useMoney();
  const range = useRange();
  const s = useSession();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const today = todayIso();
  const [award, setAward] = useState(String(a.amount));
  const [mode, setMode] = useState<'approve' | 'decline' | null>(null);
  const own = a.person_id === s.identity.personId;
  const input = { application_id: a.id, decision: 'approve', award: Number(award) };
  const problem = decisionProblem(input, a, round, committed, today);
  return (
    <li className="card p-4" data-testid="m36-grh-app" data-id={a.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 basis-56 flex-1">
          <div className="caps">{t(`m36.gr.kind.${a.kind}`)}</div>
          <h3 className="break-words text-[15px] font-semibold">{a.title}</h3>
          <p className="text-[12.5px] text-ink-2">{a.destination} · {range(a.starts_on, a.ends_on)}</p>
        </div>
        <Applicant a={a} />
      </div>
      <p className="mt-2 text-[13px]">{a.purpose}</p>
      <KeyValue items={[
        [t('m36.gr.requested'), <span key="r" className="num">{money(Number(a.amount))} ({(a.costs as Row[]).map((c) => `${t(`m36.gr.cost.${c.item}`)} ${money(Number(c.amount))}`).join(' · ')})</span>],
        [t('m36.gr.skill'), <L key="s" to={`/skills/${a.skill_id}`}>{skillName(a.skill_id)}</L>],
        [t('m36.gr.outputPromised'), t(`m36.gr.outputKind.${a.output_kind}`)],
      ]} />
      {canDecide && !own && (
        <div className="mt-3 flex flex-wrap items-end gap-2" data-testid="m36-grh-decide">
          <div className="w-36"><TextField name={`award-${a.id}`} type="number" label={t('m36.grh.award')} value={award} onChange={setAward} /></div>
          <button type="button" className="btn-primary btn-sm" disabled={!!problem} onClick={() => setMode('approve')} data-testid="m36-grh-approve">{t('m36.grh.approve')}</button>
          <button type="button" className="btn-outline btn-sm" onClick={() => setMode('decline')} data-testid="m36-grh-decline">{t('m36.grh.decline')}</button>
          {problem && <p className="w-full text-[12.5px] text-bad" data-testid="m36-grh-problem" data-problem={problem}>{t(`m36.gr.problem.decision.${problem}`)}</p>}
        </div>
      )}
      {own && <p className="mt-2 text-[12.5px] text-ink-3">{t('m36.grh.ownApplication')}</p>}
      <div className="mt-2"><WhyThis reasons={applicationReasons(a, round, today)} testId="m36-grh-why" /></div>
      <ConfirmDialog open={mode !== null} onClose={() => setMode(null)} title={mode === 'decline' ? t('m36.grh.declineConfirm') : t('m36.grh.approveConfirm', { amount: money(Number(award)) })}
        consequence={mode === 'decline' ? t('m36.grh.declineConsequence') : t('m36.grh.approveConsequence')} requireReason={mode === 'decline'} reasonLabel={t('m36.grh.declineNote')}
        actingAs={t('m36.grh.actingDirector')} danger={mode === 'decline'} confirmLabel={mode === 'decline' ? t('m36.grh.decline') : t('m36.grh.approve')}
        onConfirm={async (note) => { await run(() => repo.rpc.decideGrant(mode === 'decline' ? { application_id: a.id, decision: 'decline', note } : input)); setMode(null); }} />
    </li>
  );
}

function Outputs({ waiting, overdue, hr }: { waiting: Row[]; overdue: Row[]; hr: boolean }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-6" data-testid="m36-grh-outputs">
      {waiting.length ? (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">{waiting.map((a) => <OutputCard key={a.id} a={a} hr={hr} />)}</ul>
      ) : <EmptyState title={t('m36.grh.noOutputs')}>{t('m36.grh.noOutputsBody')}</EmptyState>}
      {overdue.length > 0 && (
        <Section title={t('m36.grh.overdue')} description={t('m36.grh.overdueIntro')}>
          <ul className="space-y-1 text-[13px]" data-testid="m36-grh-overdue">
            {overdue.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2"><Applicant a={a} /><span className="font-medium">{a.title}</span><span className="text-ink-3">{t('m36.gr.outputDue')}: {f.date(outputDue(a))}</span></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}

function OutputCard({ a, hr }: { a: Row; hr: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const [mode, setMode] = useState<'accept' | 'return' | null>(null);
  const o = (a.output ?? {}) as Row;
  const own = a.person_id === s.identity.personId || o.submitted_by === s.identity.personId;
  return (
    <li className="card p-4" data-testid="m36-grh-output" data-id={a.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 basis-56 flex-1"><div className="caps">{t(`m36.gr.outputKind.${o.kind ?? a.output_kind}`)}</div><h3 className="break-words text-[15px] font-semibold">{o.title}</h3></div>
        <Applicant a={a} />
      </div>
      <p className="mt-2 whitespace-pre-line text-[13px]">{o.summary}</p>
      <p className="mt-1 text-[12.5px] text-ink-3">{t('m36.grh.outputFor', { title: a.title, date: o.submitted_at ? f.date(o.submitted_at) : '—' })}</p>
      <p className="text-[12.5px] text-ink-2">{t('m36.grh.evidenceWill', { skill: skillName(a.skill_id), level: f.num((o.kind ?? a.output_kind) === 'presentation' ? 2 : 1) })}</p>
      {hr && !own && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => setMode('accept')} data-testid="m36-grh-accept">{t('m36.grh.accept')}</button>
          <button type="button" className="btn-outline btn-sm" onClick={() => setMode('return')} data-testid="m36-grh-return">{t('m36.grh.return')}</button>
        </div>
      )}
      {own && <p className="mt-2 text-[12.5px] text-ink-3">{t('m36.grh.ownOutput')}</p>}
      <ConfirmDialog open={mode !== null} onClose={() => setMode(null)} title={mode === 'return' ? t('m36.grh.returnConfirm') : t('m36.grh.acceptConfirm')}
        consequence={mode === 'return' ? t('m36.grh.returnConsequence') : t('m36.grh.acceptConsequence')} requireReason={mode === 'return'} reasonLabel={t('m36.grh.returnNote')}
        actingAs={t('m36.grh.actingHr')} confirmLabel={mode === 'return' ? t('m36.grh.return') : t('m36.grh.accept')}
        onConfirm={async (note) => { await run(() => repo.rpc.reviewGrantOutput({ application_id: a.id, decision: mode === 'return' ? 'return' : 'accept', note: note || null })); setMode(null); }} />
    </li>
  );
}

function Rounds({ rounds, hr }: { rounds: Row[]; hr: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const today = todayIso();
  const [budget, setBudget] = useState('150000');
  const [maxAward, setMaxAward] = useState('15000');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const slot = nextRoundSlot(latestRound(rounds)?.closes_on ?? null, today);
  const input = { budget: Number(budget), max_award: Number(maxAward), note: note || null };
  const problem = scheduleProblem(input, rounds, today);
  return (
    <div className="space-y-6" data-testid="m36-grh-rounds">
      <RoundStrip rounds={rounds} today={today} />
      {hr && (
        <Card title={t('m36.grh.scheduleTitle')}>
          <div className="space-y-3" data-testid="m36-grh-schedule" data-slot={slot.id}>
            <p className="text-[13px]">{t('m36.grh.slot', { a: f.date(slot.opens_on), b: f.date(slot.closes_on), d: f.date(slot.decide_by) })}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField name="budget" type="number" label={t('m36.grh.budgetLabel')} value={budget} onChange={setBudget} />
              <TextField name="max" type="number" label={t('m36.gr.maxAward')} value={maxAward} onChange={setMaxAward} />
            </div>
            <TextField name="note" label={t('m36.grh.noteLabel')} value={note} onChange={setNote} />
            {problem && <p className="text-[12.5px] text-bad" data-testid="m36-grh-schedule-problem" data-problem={problem}>{t(`m36.gr.problem.schedule.${problem}`)}</p>}
            <button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-grh-schedule-submit">{t('m36.grh.scheduleSubmit')}</button>
          </div>
        </Card>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.grh.scheduleConfirm')} consequence={t('m36.grh.scheduleConsequence', { a: f.date(slot.opens_on), b: f.date(slot.closes_on) })}
        actingAs={t('m36.grh.actingHr')} confirmLabel={t('m36.grh.scheduleSubmit')} onConfirm={async () => { await run(() => repo.rpc.scheduleGrantRound(input)); setConfirm(false); }} />
    </div>
  );
}

function OnBehalf({ rounds, hr }: { rounds: Row[]; hr: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const money = useMoney();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const today = todayIso();
  const open = openRound(rounds, today);
  const [person, setPerson] = useState('');
  const [consent, setConsent] = useState('');
  const [kind, setKind] = useState<string>('site_visit');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [cost, setCost] = useState<Record<string, string>>({ transport: '', subsistence: '', registration: '' });
  const [skill, setSkill] = useState('');
  const [output, setOutput] = useState<string>('report');
  const [confirm, setConfirm] = useState(false);
  const skillsCtx = useMemo(() => Object.fromEntries([...(skills.data?.entries() ?? [])].map(([id, x]) => [id, { area: x.area ?? null, lifecycle: x.lifecycle ?? null }])), [skills.data]);
  const options = useMemo(() => [...(skills.data?.values() ?? [])].filter((x) => x.area !== 'security' && x.lifecycle !== 'obsolete').map((x) => ({ value: String(x.id), label: skillName(String(x.id)) })).sort((a, b) => a.label.localeCompare(b.label)), [skills.data, skillName]);
  if (!open) return <EmptyState title={t('m36.gr.my.noOpenTitle')}>{t('m36.grh.behalfNoRound')}</EmptyState>;
  if (!hr) return <EmptyState title={t('m36.grh.readOnlyTitle')}>{t('m36.grh.readOnlyBody')}</EmptyState>;
  const costs = COST_ITEMS.filter((i) => cost[i] !== '').map((i) => ({ item: i, amount: Number(cost[i]) }));
  const input: ApplicationInput = { person_id: person.trim(), consent_ref: consent, kind, title, purpose, destination, starts_on: starts, ends_on: ends, costs, skill_id: skill, output_kind: output };
  const problem = applicationProblem(input, { closes_on: String(open.closes_on), max_award: Number(open.max_award), skills: skillsCtx });
  const ready = !problem && person.trim().length > 0 && consent.trim().length >= 3;
  return (
    <Card title={t('m36.grh.behalfTitle', { date: f.date(open.closes_on) })}>
      <div className="space-y-3" data-testid="m36-grh-behalf">
        <Callout tone="info" title={t('m36.grh.behalfRuleTitle')}>{t('m36.grh.behalfRule')}</Callout>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField name="person" label={t('m36.grh.studentRef')} hint={t('m36.grh.studentRefHint')} value={person} onChange={setPerson} />
          <TextField name="consent" label={t('m36.grh.consentRef')} value={consent} onChange={setConsent} />
        </div>
        <SelectField name="kind" label={t('m36.gr.kindLabel')} value={kind} onChange={setKind} options={GRANT_KINDS.map((k) => ({ value: k, label: t(`m36.gr.kind.${k}`) }))} />
        <TextField name="title" label={t('m36.gr.titleLabel')} value={title} onChange={setTitle} />
        <TextArea name="purpose" label={t('m36.gr.purposeLabel')} value={purpose} onChange={setPurpose} />
        <TextField name="destination" label={t('m36.gr.destinationLabel')} value={destination} onChange={setDestination} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField name="starts" type="date" label={t('m36.gr.starts')} value={starts} onChange={setStarts} />
          <TextField name="ends" type="date" label={t('m36.gr.ends')} value={ends} onChange={setEnds} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {COST_ITEMS.map((i) => <TextField key={i} name={`b-${i}`} type="number" label={t(`m36.gr.cost.${i}`)} value={cost[i]} onChange={(v) => setCost((c) => ({ ...c, [i]: v }))} />)}
        </div>
        <p className="text-[12.5px]">{t('m36.gr.total', { total: money(costTotal(costs)), max: money(Number(open.max_award)) })}</p>
        <SelectField name="skill" label={t('m36.gr.skillLabel')} value={skill} onChange={setSkill} options={options} placeholder={t('m36.gr.skillPlaceholder')} />
        <SelectField name="output" label={t('m36.gr.outputKindLabel')} value={output} onChange={setOutput} options={OUTPUT_KINDS.map((k) => ({ value: k, label: t(`m36.gr.outputKind.${k}`) }))} />
        {problem && (title || purpose) && <p className="text-[12.5px] text-bad" data-problem={problem}>{t(`m36.gr.problem.app.${problem}`)}</p>}
        <button type="button" className="btn-primary" disabled={!ready} onClick={() => setConfirm(true)} data-testid="m36-grh-behalf-submit">{t('m36.grh.behalfSubmit')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.grh.behalfConfirm')} consequence={t('m36.grh.behalfConsequence')} actingAs={t('m36.grh.actingHr')} confirmLabel={t('m36.grh.behalfSubmit')}
        onConfirm={async () => { const r = await run(() => repo.rpc.applyGrant(input)); setConfirm(false); if (r.ok) { setTitle(''); setPurpose(''); setPerson(''); setConsent(''); } }} />
    </Card>
  );
}

function AllApps({ apps, rounds }: { apps: Row[]; rounds: Row[] }) {
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const today = todayIso();
  const roundOf = Object.fromEntries(rounds.map((r) => [r.id, r]));
  const [open, setOpen] = useState<Row | null>(null);
  return (
    <div data-testid="m36-grh-all">
      <DataTable rows={apps} rowKey={(a) => a.id} csvName="micro-grant-applications" onRowClick={(a) => setOpen(a)} initialSort={{ key: 'round', dir: 'desc' }}
        columns={[
          { key: 'round', header: t('m36.grp.col.round'), value: (a) => String(roundOf[a.round_id]?.closes_on ?? a.round_id), render: (a) => f.date(roundOf[a.round_id]?.closes_on), sortable: true },
          { key: 'title', header: t('m36.gr.titleLabel'), value: (a) => a.title, sortable: true },
          { key: 'kind', header: t('m36.gr.kindLabel'), value: (a) => t(`m36.gr.kind.${a.kind}`), sortable: true },
          { key: 'initials', header: t('m36.grh.applicant'), value: (a) => a.initials, render: (a) => <Applicant a={a} /> },
          { key: 'amount', header: t('m36.gr.requested'), value: (a) => Number(a.amount), render: (a) => <span className="num">{money(Number(a.amount))}</span>, align: 'end', sortable: true },
          { key: 'status', header: t('m36.grp.col.phase'), value: (a) => a.status, render: (a) => <AppPill status={a.status} />, sortable: true },
          { key: 'output', header: t('m36.gr.outputPromised'), value: (a) => outputState(a, today) ?? '', render: (a) => { const os = outputState(a, today); return os ? <OutputPill state={os} /> : '—'; } },
        ]} />
      {open && (
        <Drawer open onClose={() => setOpen(null)} title={open.title}>
          <div className="space-y-2 text-[13px]">
            <Applicant a={open} />
            <p>{open.purpose}</p>
            <KeyValue items={[[t('m36.gr.requested'), money(Number(open.amount))], [t('m36.gr.awarded'), open.awarded == null ? '—' : money(Number(open.awarded))], [t('m36.grp.col.phase'), <AppPill key="s" status={open.status} />]]} />
            {open.decision_note && <p className="rounded bg-sunken p-2">{open.decision_note}</p>}
            <WhyThis reasons={applicationReasons(open, roundOf[open.round_id] ?? null, today)} />
          </div>
        </Drawer>
      )}
    </div>
  );
}
