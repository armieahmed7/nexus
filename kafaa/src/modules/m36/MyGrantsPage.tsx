// FS82 /my/grants (ecosystem Own: ENEC staff): rolling bi-monthly mobility micro-grants. The round open today and the whole schedule
// (phases from the dates only), my eligibility with <WhyThis>, a light application (activity, purpose, dates, cost lines up to the round
// maximum, the skill it builds, the promised output) behind a ConfirmDialog, and my applications with the decision, the output due date
// and the output form. Budgets are SIMULATED. An output HR accepts becomes validated evidence on the named skill (F01 kind rating).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, Callout, EmptyState, KeyValue, ConfirmDialog, Drawer, WhyThis, BenchmarkChips, TextField, TextArea, SelectField, RadioGroup, StatTile } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import {
  COST_ITEMS, GRANT_KINDS, OUTPUT_KINDS, applicationProblem, applicationReasons, costTotal, daysFrom, eligibility, openRound, outputDue, outputProblem, outputState, roundPhase, type ApplicationInput,
} from './grants';
import { AppPill, GrantLabels, OutputPill, RoundPill, RoundStrip, useMoney, useRange } from './fs82ui';
import { useSkillName, useSkills, type Row } from './ui';

export default function MyGrantsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const pid = s.identity.personId;
  const q = useQuery(['grant_rounds', 'grant_applications'] as unknown as Table[], async () => {
    const [rounds, apps, me] = await Promise.all([
      repo.list('grant_rounds' as never) as unknown as Promise<Row[]>,
      repo.list('grant_applications' as never, { filter: { person_id: pid } } as never) as unknown as Promise<Row[]>,
      pid ? (repo.get('people' as never, pid) as unknown as Promise<Row | null>).catch(() => null) : Promise.resolve(null),
    ]);
    return { rounds, apps, me };
  }, [pid]);
  return (
    <Page title={t('m36.routes.my-grants.title')} intro={t('m36.gr.my.intro')} wide eyebrow={<BenchmarkChips feature="FS82" />}
      actions={<L to="/ecosystem/grants" className="btn-outline btn-sm no-underline" data-testid="m36-gr-to-programme">{t('m36.gr.my.toProgramme')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <MyGrants rounds={d.rounds} apps={d.apps} me={d.me} />}</Async>
    </Page>
  );
}

function MyGrants({ rounds, apps, me }: { rounds: Row[]; apps: Row[]; me: Row | null }) {
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const today = todayIso();
  const open = openRound(rounds, today);
  const next = rounds.filter((r) => roundPhase(r, today) === 'scheduled').sort((a, b) => (a.opens_on < b.opens_on ? -1 : 1))[0] ?? null;
  const el = eligibility(me, today, false);
  const mineInOpen = open ? apps.find((a) => a.round_id === open.id && a.status !== 'withdrawn') : null;
  const [applyOpen, setApplyOpen] = useState(false);
  const roundOf = Object.fromEntries(rounds.map((r) => [r.id, r]));
  const sorted = apps.slice().sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1));
  return (
    <div className="space-y-6" data-testid="m36-gr-my" data-open={open?.id ?? ''}>
      <GrantLabels />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Card title={open ? t('m36.gr.my.openTitle', { date: f.date(open.closes_on) }) : t('m36.gr.my.noOpenTitle')} eyebrow={t('m36.gr.my.roundEyebrow')}>
          {open ? (
            <div className="space-y-3" data-testid="m36-gr-open-round">
              <div className="flex flex-wrap items-center gap-2"><RoundPill phase="open" /><span className="text-[13px] text-ink-2">{t('m36.gr.my.daysLeft', { n: f.num(daysFrom(today, open.closes_on)) })}</span></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label={t('m36.gr.maxAward')} value={<span className="num">{money(Number(open.max_award))}</span>} sim />
                <StatTile label={t('m36.gr.budget')} value={<span className="num">{money(Number(open.budget))}</span>} sim />
                <StatTile label={t('m36.gr.decideByLabel')} value={<span className="num">{f.date(open.decide_by)}</span>} />
              </div>
              {open.note && <p className="text-[13px] text-ink-2">{open.note}</p>}
              {mineInOpen ? (
                <p className="text-[13px]" data-testid="m36-gr-already">{t('m36.gr.my.already')}</p>
              ) : (
                <button type="button" className="btn-primary" disabled={!el.eligible} onClick={() => setApplyOpen(true)} data-testid="m36-gr-apply">{t('m36.gr.my.apply')}</button>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-2" data-testid="m36-gr-no-round">{next ? t('m36.gr.my.nextOpens', { date: f.date(next.opens_on) }) : t('m36.gr.my.noneScheduled')}</p>
          )}
        </Card>
        <Card title={t('m36.gr.my.eligibility')}>
          <div className="space-y-2" data-testid="m36-gr-eligibility" data-eligible={el.eligible ? 'yes' : 'no'}>
            <p className="text-[13.5px]">{el.eligible ? t('m36.gr.my.eligibleYes') : t('m36.gr.my.eligibleNo')}</p>
            <WhyThis reasons={el.reasons} testId="m36-gr-eligibility-why" />
            <p className="text-[12.5px] text-ink-3">{t('m36.gr.my.eligibilityRule')}</p>
          </div>
        </Card>
      </div>
      <Section title={t('m36.gr.schedule')} description={t('m36.gr.scheduleIntro')}>
        <RoundStrip rounds={rounds} today={today} />
      </Section>
      <Section title={t('m36.gr.my.mine')} description={t('m36.gr.my.mineIntro')}>
        {sorted.length ? (
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2" data-testid="m36-gr-my-apps">
            {sorted.map((a) => <AppCard key={a.id} a={a} round={roundOf[a.round_id] ?? null} />)}
          </ul>
        ) : <EmptyState title={t('m36.gr.my.noneTitle')}>{t('m36.gr.my.noneBody')}</EmptyState>}
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m36.gr.my.evidenceTitle')}>{t('m36.gr.my.evidenceBody')} <L to="/my/skills">{t('m36.gr.my.toSkills')}</L></Callout>
        <Callout tone="sim" title={t('m36.gr.my.howTitle')}>{t('m36.gr.my.howBody')}</Callout>
      </div>
      {open && <ApplyDrawer open={applyOpen} onClose={() => setApplyOpen(false)} round={open} />}
    </div>
  );
}

function AppCard({ a, round }: { a: Row; round: Row | null }) {
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const range = useRange();
  const repo = useRepo();
  const run = useAction();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const today = todayIso();
  const os = outputState(a, today);
  const [withdraw, setWithdraw] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  return (
    <li className="card p-4" data-testid="m36-gr-app" data-id={a.id} data-status={a.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 basis-56 flex-1">
          <div className="caps">{t(`m36.gr.kind.${a.kind}`)} · {round ? t('m36.gr.roundTo', { date: f.date(round.closes_on) }) : a.round_id}</div>
          <h3 className="break-words text-[15px] font-semibold">{a.title}</h3>
          <p className="text-[12.5px] text-ink-2">{a.destination} · {range(a.starts_on, a.ends_on)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><AppPill status={a.status} />{os && <OutputPill state={os} />}</div>
      </div>
      <KeyValue items={[
        [t('m36.gr.requested'), <span key="r" className="num">{money(Number(a.amount))}</span>],
        ...(a.status === 'approved' ? [[t('m36.gr.awarded'), <span key="w" className="num" data-testid="m36-gr-awarded">{money(Number(a.awarded))}</span>] as [string, JSX.Element]] : []),
        [t('m36.gr.skill'), <L key="s" to={`/skills/${a.skill_id}`}>{skillName(a.skill_id)}</L>],
        [t('m36.gr.outputPromised'), t(`m36.gr.outputKind.${a.output_kind}`)],
        ...(a.status === 'approved' && os !== 'accepted' ? [[t('m36.gr.outputDue'), f.date(outputDue(a))] as [string, string]] : []),
      ]} />
      {a.decision_note && <p className="mt-2 rounded bg-sunken p-2 text-[12.5px]" data-testid="m36-gr-decision-note">{a.decision_note}</p>}
      {a.output_status === 'returned' && a.output_note && <p className="mt-2 rounded bg-sunken p-2 text-[12.5px]" data-testid="m36-gr-output-note">{t('m36.gr.returnedNote', { note: a.output_note })}</p>}
      {a.output_status === 'accepted' && (
        <p className="mt-2 text-[12.5px] text-ok" data-testid="m36-gr-evidence">{a.profile_evidence ? t('m36.gr.evidenceProfile', { level: f.num(Number(a.evidence?.[0]?.level ?? 1)) }) : t('m36.gr.evidenceRecord')}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <WhyThis reasons={applicationReasons(a, round, today)} testId="m36-gr-app-why" />
        {a.status === 'submitted' && <button type="button" className="btn-outline btn-sm" onClick={() => setWithdraw(true)} data-testid="m36-gr-withdraw">{t('m36.gr.withdraw')}</button>}
        {(os === 'due' || os === 'overdue' || os === 'returned') && <button type="button" className="btn-primary btn-sm" onClick={() => setOutOpen(true)} data-testid="m36-gr-log-output">{t('m36.gr.logOutput')}</button>}
      </div>
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m36.gr.withdrawConfirm')} consequence={t('m36.gr.withdrawConsequence')} danger confirmLabel={t('m36.gr.withdraw')}
        onConfirm={async () => { await run(() => repo.rpc.withdrawGrant(a.id)); setWithdraw(false); }} />
      {outOpen && <OutputDrawer a={a} onClose={() => setOutOpen(false)} />}
    </li>
  );
}

function OutputDrawer({ a, onClose }: { a: Row; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [kind, setKind] = useState<string>(a.output_kind);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [confirm, setConfirm] = useState(false);
  const input = { application_id: a.id, kind, title, summary };
  const problem = outputProblem(input, a, todayIso());
  return (
    <Drawer open onClose={onClose} title={t('m36.gr.outputTitle')}
      footer={<button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-gr-output-submit">{t('m36.gr.outputSubmit')}</button>}>
      <div className="space-y-3" data-testid="m36-gr-output-form">
        <p className="text-[13px] text-ink-2">{t('m36.gr.outputIntro')}</p>
        <RadioGroup label={t('m36.gr.outputKindLabel')} name="kind" value={kind} onChange={setKind} options={OUTPUT_KINDS.map((k) => ({ value: k, label: t(`m36.gr.outputKind.${k}`) }))} />
        <TextField name="title" label={t('m36.gr.outputTitleLabel')} value={title} onChange={setTitle} />
        <TextArea name="summary" label={t('m36.gr.outputSummary')} value={summary} onChange={setSummary} rows={6} />
        {problem && (title || summary) && <p className="text-[12.5px] text-bad" data-testid="m36-gr-output-problem" data-problem={problem}>{t(`m36.gr.problem.output.${problem}`)}</p>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.gr.outputConfirm')} consequence={t('m36.gr.outputConsequence')} confirmLabel={t('m36.gr.outputSubmit')}
        onConfirm={async () => { const r = await run(() => repo.rpc.submitGrantOutput(input)); setConfirm(false); if (r.ok) onClose(); }} />
    </Drawer>
  );
}

function ApplyDrawer({ open, onClose, round }: { open: boolean; onClose: () => void; round: Row }) {
  const t = useT();
  const f = useFormat();
  const pickSkills = useSkills();
  const repo = useRepo();
  const run = useAction();
  const money = useMoney();
  const [kind, setKind] = useState<string>('conference');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [cost, setCost] = useState<Record<string, string>>({ transport: '', subsistence: '', registration: '' });
  const [skill, setSkill] = useState('');
  const [output, setOutput] = useState<string>('report');
  const [confirm, setConfirm] = useState(false);
  const skillName = useSkillName(pickSkills.data);
  const skillOptions = useMemo(() => [...(pickSkills.data?.values() ?? [])].filter((s) => s.area !== 'security' && s.lifecycle !== 'obsolete')
    .map((s) => ({ value: String(s.id), label: skillName(String(s.id)) })).sort((a, b) => a.label.localeCompare(b.label)), [pickSkills.data, skillName]);
  const costs = COST_ITEMS.filter((i) => cost[i] !== '').map((i) => ({ item: i, amount: Number(cost[i]) }));
  const input: ApplicationInput = { kind, title, purpose, destination, starts_on: starts, ends_on: ends, costs, skill_id: skill, output_kind: output };
  const skillsCtx = useMemo(() => Object.fromEntries([...(pickSkills.data?.entries() ?? [])].map(([id, s]) => [id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }])), [pickSkills.data]);
  const problem = applicationProblem(input, { closes_on: String(round.closes_on), max_award: Number(round.max_award), skills: skillsCtx });
  const total = costTotal(costs);
  const touched = !!(title || purpose || destination || starts || costs.length || skill);
  return (
    <Drawer open={open} onClose={onClose} title={t('m36.gr.applyTitle', { date: f.date(round.closes_on) })}
      footer={<button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m36-gr-apply-submit">{t('m36.gr.applySubmit')}</button>}>
      <div className="space-y-3" data-testid="m36-gr-apply-form">
        <GrantLabels />
        <SelectField name="kind" label={t('m36.gr.kindLabel')} value={kind} onChange={setKind} options={GRANT_KINDS.map((k) => ({ value: k, label: t(`m36.gr.kind.${k}`) }))} />
        <TextField name="title" label={t('m36.gr.titleLabel')} value={title} onChange={setTitle} />
        <TextArea name="purpose" label={t('m36.gr.purposeLabel')} hint={t('m36.gr.purposeHint')} value={purpose} onChange={setPurpose} />
        <TextField name="destination" label={t('m36.gr.destinationLabel')} value={destination} onChange={setDestination} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField name="starts" type="date" label={t('m36.gr.starts')} value={starts} onChange={setStarts} />
          <TextField name="ends" type="date" label={t('m36.gr.ends')} value={ends} onChange={setEnds} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold">{t('m36.gr.costsLabel')}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {COST_ITEMS.map((i) => <TextField key={i} name={`cost-${i}`} type="number" label={t(`m36.gr.cost.${i}`)} value={cost[i]} onChange={(v) => setCost((c) => ({ ...c, [i]: v }))} />)}
          </div>
          <p className="text-[12.5px]" data-testid="m36-gr-total" data-total={total}>{t('m36.gr.total', { total: money(total), max: money(Number(round.max_award)) })}</p>
        </fieldset>
        <SelectField name="skill" label={t('m36.gr.skillLabel')} value={skill} onChange={setSkill} options={skillOptions} placeholder={t('m36.gr.skillPlaceholder')} />
        <RadioGroup label={t('m36.gr.outputKindLabel')} name="output" value={output} onChange={setOutput} options={OUTPUT_KINDS.map((k) => ({ value: k, label: t(`m36.gr.outputKind.${k}`) }))} />
        {problem && touched && <p className="text-[12.5px] text-bad" data-testid="m36-gr-apply-problem" data-problem={problem}>{t(`m36.gr.problem.app.${problem}`)}</p>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.gr.applyConfirm')} consequence={t('m36.gr.applyConsequence', { date: f.date(round.decide_by) })} confirmLabel={t('m36.gr.applySubmit')}
        onConfirm={async () => { const r = await run(() => repo.rpc.applyGrant(input)); setConfirm(false); if (r.ok) onClose(); }} />
    </Drawer>
  );
}
