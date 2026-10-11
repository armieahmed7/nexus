// FS35 /my/career/health (FS wave D · E4): Career Health check in three steps, after Career Health SG's ACE framework.
//  Assess: five visible components (skill currency, breadth, recency of learning, mobility options, change exposure from FS11),
//          each with its inputs, its rule and "Why this?"; the only summary is "n of 5 in good shape" (no hidden score); my past
//          snapshots as a trend.
//  Chart:  the suggested actions for the components to watch or act on, a focus role, a note and a review date, saved as my own
//          snapshot (rpc.saveHealthSnapshot).
//  Execute: book a career conversation with my line manager through the existing F12 RPC (rpc.submitPrep, shared), then link it
//          to the snapshot. Only what I write in the request is shared; the health check itself stays private.
// Own only: never shown to managers and never used in talent review (kafaa_health_snapshots is own_profile Own).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, Icon, BenchmarkChips, BenchmarkLine, WhyThis, Stepper, LineChart, KeyValue, CheckboxField, TextArea, TextField, SelectField, RadioGroup, ConfirmDialog } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { HEALTH_RULES, PLAN_ACTIONS, MAX_NOTE, type HealthComponent, type HealthResult, type HealthStatus, type HealthKey } from './careerHealth';
import { ASPIRATIONS } from './conversations';

type Row = Record<string, unknown>;
const TONE: Record<HealthStatus, 'ok' | 'info' | 'bad' | 'neutral'> = { good: 'ok', watch: 'info', act: 'bad', na: 'neutral' };
const ICON: Record<HealthKey, string> = { currency: 'calendar', breadth: 'sparkle', recency: 'book', mobility: 'briefcase', change: 'chart' };
const STEPS = ['assess', 'chart', 'execute'] as const;

interface Ctx { health: HealthResult; snapshots: Row[]; roleById: Map<string, Row>; skillById: Map<string, Row>; courseById: Map<string, Row> }

export default function MyCareerHealthPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.person?.id ?? '';
  const q = useQuery(['health_snapshots', 'person_skills', 'training_records', 'career_conversations'], async (): Promise<Ctx> => {
    const r = await repo.rpc.careerHealth();
    if (!r.ok) throw new Error(r.message);
    const [snapshots, roles, skills, courses] = await Promise.all([
      repo.list('health_snapshots', { filter: { person_id: me }, order: [['taken_at', 'asc']] }), repo.list('job_roles'), repo.list('skills'), repo.list('courses'),
    ]);
    const by = (rows: unknown[]) => new Map((rows as Row[]).map((x) => [String(x.id), x]));
    return { health: r.data!, snapshots: snapshots as unknown as Row[], roleById: by(roles), skillById: by(skills), courseById: by(courses) };
  }, [me]);
  return (
    <Page title={t('m18.routes.my-career-health.title')} eyebrow={t('m18.fs35.eyebrow')} intro={t('m18.fs35.intro')} wide
      actions={<L to="/my/career" className="btn-outline btn-sm" data-testid="m18-fs35-to-navigator"><Icon name="briefcase" size={14} />{t('m18.fs35.toNavigator')}</L>}>
      <div className="flex flex-wrap items-center gap-2"><BenchmarkChips feature="FS35" /></div>
      <Callout tone="info" title={t('m18.fs35.privateTitle')}><span data-testid="m18-fs35-private">{t('m18.fs35.private')}</span></Callout>
      <Async state={q}>{(c) => <Flow c={c} />}</Async>
    </Page>
  );
}

function Flow({ c }: { c: Ctx }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [snapId, setSnapId] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ actions: string[]; note: string; review_on: string; focus_role_id: string }>(() => ({
    actions: [...new Set([...c.health.actions.map((a) => a.key), 'conversation'])].filter((a) => (PLAN_ACTIONS as readonly string[]).includes(a)), note: '', review_on: '', focus_role_id: '',
  }));
  return (
    <div className="space-y-6">
      <Card>
        <Stepper steps={STEPS.map((k) => ({ id: k, label: t(`m18.fs35.step.${k}`) }))} current={step} />
        <p className="mt-2 text-[12.5px] text-ink-2">{t(`m18.fs35.stepHint.${STEPS[step]}`)}</p>
      </Card>
      {step === 0 && <Assess c={c} onNext={() => setStep(1)} />}
      {step === 1 && <Chart c={c} plan={plan} setPlan={setPlan} onBack={() => setStep(0)} onSaved={(id) => { setSnapId(id); setStep(2); }} />}
      {step === 2 && snapId && <Execute c={c} snapId={snapId} plan={plan} onBack={() => setStep(1)} />}
    </div>
  );
}

function Summary({ h }: { h: HealthResult }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="m18-fs35-summary">
      <span className="text-[22px] font-semibold num">{t('m18.fs35.goodOf', { n: f.num(h.good), of: f.num(h.components.length) })}</span>
      {(['good', 'watch', 'act'] as const).map((k) => <StatusPill key={k} tone={TONE[k]}>{t(`m18.fs35.count.${k}`, { n: f.num(h[k]) })}</StatusPill>)}
      <span className="text-[12.5px] text-ink-2">{t('m18.fs35.asOf', { date: f.date(h.as_of) })}</span>
    </div>
  );
}

function Assess({ c, onNext }: { c: Ctx; onNext: () => void }) {
  const t = useT();
  return (
    <>
      <Section title={t('m18.fs35.assessTitle')} description={t('m18.fs35.assessDesc')}>
        <Summary h={c.health} />
        <p className="mt-1 text-[12.5px] text-ink-2">{t('m18.fs35.noScore')}</p>
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m18-fs35-components">
          {c.health.components.map((x) => <Component key={x.key} c={c} x={x} />)}
        </ul>
        <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={onNext} data-testid="m18-fs35-to-chart">{t('m18.fs35.toChart')}</button></div>
      </Section>
      <History c={c} />
    </>
  );
}

function valueText(t: ReturnType<typeof useT>, f: ReturnType<typeof useFormat>, x: HealthComponent) {
  if (x.value == null) return t(`m18.fs35.value.none.${x.key}`);
  return x.unit === 'pct' ? f.pct(x.value, 0) : x.unit === 'months' ? t('m18.fs35.value.months', { n: f.num(x.value) }) : f.num(x.value);
}

function Component({ c, x }: { c: Ctx; x: HealthComponent }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const inputs = Object.entries(x.inputs).map(([k, v]) => [t(`m18.fs35.input.${x.key}.${k}`), v == null ? '—' : x.key === 'change' && /pct/.test(k) ? f.pct(v, 0) : f.num(v)] as [string, string]);
  return (
    <li className="card flex flex-col gap-3 p-4" data-testid="m18-fs35-component" data-key={x.key} data-status={x.status}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2"><Icon name={ICON[x.key]} size={18} /><h3 className="text-[15px] font-semibold">{t(`m18.fs35.comp.${x.key}`)}</h3></div>
        <StatusPill tone={TONE[x.status]}>{t(`m18.fs35.status.${x.status}`)}</StatusPill>
      </div>
      <div className="text-[28px] font-semibold num" data-testid="m18-fs35-value">{valueText(t, f, x)}</div>
      <p className="text-[12.5px] text-ink-2">{t(`m18.fs35.rule.${x.key}`, ruleVars(f, x.key))}</p>
      <KeyValue items={inputs} />
      {x.key === 'change' && x.status !== 'na' && x.inputs.change_pct != null && (
        <BenchmarkLine compact value={Number(x.inputs.change_pct)} max={100} unit="pct" label={t('m18.fs35.changeLine')} benchmark={{ id: 'WEF-FOJ', figure: 'core_skills_change_2030' }} />
      )}
      <Refs c={c} x={x} />
      <div><WhyThis reasons={x.reasons} testId="m18-fs35-why" /></div>
    </li>
  );
}

function ruleVars(f: ReturnType<typeof useFormat>, k: HealthKey): Record<string, string> {
  const R = HEALTH_RULES;
  switch (k) {
    case 'currency': return { good: f.pct(R.currency.good, 0), watch: f.pct(R.currency.watch, 0), due: f.num(R.currency.due_months) };
    case 'breadth': return { good: f.num(R.breadth.good), watch: f.num(R.breadth.watch), level: f.num(R.breadth.min_level) };
    case 'recency': return { good: f.num(R.recency.good), watch: f.num(R.recency.watch) };
    case 'mobility': return { good: f.num(R.mobility.good), watch: f.num(R.mobility.watch), reach: f.pct(R.mobility.reach_pct, 0) };
    default: return { good: f.pct(R.change.good, 0), watch: f.pct(R.change.watch, 0) };
  }
}

function Refs({ c, x }: { c: Ctx; x: HealthComponent }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!x.refs.length) return null;
  if (x.key === 'currency') return <RefList title={t('m18.fs35.refs.currency')} items={x.refs.map((id) => <L key={id} to={`/skills/${id}`} className="link">{pick(c.skillById.get(id), 'name') || id}</L>)} />;
  if (x.key === 'breadth') return <div className="flex flex-wrap gap-1" data-testid="m18-fs35-areas">{x.refs.map((a) => <span key={a} className="chip border-line bg-sunken">{t(`m18.fs35.area.${a}`)}</span>)}</div>;
  if (x.key === 'recency') return <p className="text-[12.5px] text-ink-2">{t('m18.fs35.lastLearning', { date: f.date(x.refs[0]) })}</p>;
  if (x.key === 'mobility') return <RefList title={t('m18.fs35.refs.mobility')} items={x.refs.map((id) => <L key={id} to={`/careers/roles/${id}`} className="link">{pick(c.roleById.get(id), 'title') || id}</L>)} />;
  return <RefList title={t('m18.fs35.refs.change')} items={x.refs.map((id) => <L key={id} to={`/learn/course/${id}`} className="link">{pick(c.courseById.get(id), 'title') || id}</L>)} />;
}
function RefList({ title, items }: { title: string; items: JSX.Element[] }) {
  return <div><div className="caps mb-1">{title}</div><ul className="space-y-0.5 text-[13px]" data-testid="m18-fs35-refs">{items.map((el, i) => <li key={i}>{el}</li>)}</ul></div>;
}

function History({ c }: { c: Ctx }) {
  const t = useT();
  const f = useFormat();
  if (!c.snapshots.length) return <Section title={t('m18.fs35.historyTitle')}><EmptyState title={t('m18.fs35.historyNone')} icon="calendar" /></Section>;
  const pts = c.snapshots.map((s) => ({ x: String(s.as_of), y: Number(s.good) }));
  return (
    <Section title={t('m18.fs35.historyTitle')} description={t('m18.fs35.historyDesc')}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card><LineChart title={t('m18.fs35.trendTitle')} series={[{ name: t('m18.fs35.trendSeries'), points: pts }]} yMin={0} yMax={5} /></Card>
        <Card>
          <div className="overflow-x-auto">
            <table className="table-base w-full text-[13px]" data-testid="m18-fs35-history">
              <thead><tr><th className="text-start">{t('m18.fs35.col.date')}</th><th className="text-start">{t('m18.fs35.col.good')}</th><th className="text-start">{t('m18.fs35.col.step')}</th></tr></thead>
              <tbody>
                {[...c.snapshots].reverse().map((s) => (
                  <tr key={String(s.id)} data-step={String(s.step)}>
                    <td className="num">{f.date(String(s.as_of))}</td>
                    <td className="num">{t('m18.fs35.goodOf', { n: f.num(Number(s.good)), of: f.num(5) })}</td>
                    <td><StatusPill tone={s.step === 'executed' ? 'ok' : s.step === 'charted' ? 'info' : 'neutral'}>{t(`m18.fs35.stepDone.${String(s.step)}`)}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Section>
  );
}

type Plan = { actions: string[]; note: string; review_on: string; focus_role_id: string };
function Chart({ c, plan, setPlan, onBack, onSaved }: { c: Ctx; plan: Plan; setPlan: (p: Plan) => void; onBack: () => void; onSaved: (id: string) => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [busy, setBusy] = useState(false);
  const suggested = new Map(c.health.actions.map((a) => [a.key, a]));
  const focusOptions = useMemo(() => {
    const ids = [...new Set([c.health.role_id, ...(c.health.components.find((x) => x.key === 'mobility')?.refs ?? [])].filter(Boolean) as string[])];
    return [{ value: '', label: t('m18.fs35.focusNone') }, ...ids.map((id) => ({ value: id, label: String(pick(c.roleById.get(id), 'title') || id) }))];
  }, [c, pick, t]);
  const toggle = (k: string, on: boolean) => setPlan({ ...plan, actions: on ? [...new Set([...plan.actions, k])] : plan.actions.filter((x) => x !== k) });
  const save = async () => {
    setBusy(true);
    const r = await act(() => repo.rpc.saveHealthSnapshot({ plan: { actions: plan.actions, note: plan.note, review_on: plan.review_on || null, focus_role_id: plan.focus_role_id || null } }), { success: t('m18.fs35.saved') });
    setBusy(false);
    if (r.ok && r.data) onSaved(r.data.id);
  };
  return (
    <Section title={t('m18.fs35.chartTitle')} description={t('m18.fs35.chartDesc')}>
      <Card>
        <ul className="space-y-3" data-testid="m18-fs35-actions">
          {PLAN_ACTIONS.map((k) => (
            <li key={k} data-action={k} data-suggested={suggested.has(k) || k === 'conversation'}>
              <CheckboxField label={<span className="font-semibold">{t(`m18.fs35.action.${k}`)}{suggested.has(k) && <StatusPill tone="info">{t('m18.fs35.suggested')}</StatusPill>}</span>}
                hint={t(`m18.fs35.actionHint.${k}`)} checked={plan.actions.includes(k)} onChange={(v) => toggle(k, v)} />
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField name="fs35-focus" label={t('m18.fs35.focus')} value={plan.focus_role_id} onChange={(v: string) => setPlan({ ...plan, focus_role_id: v })} options={focusOptions} />
          <TextField name="fs35-review" type="date" label={t('m18.fs35.review')} value={plan.review_on} onChange={(v: string) => setPlan({ ...plan, review_on: v })} />
        </div>
        <div className="mt-4">
          <TextArea name="fs35-note" label={t('m18.fs35.note')} hint={t('m18.fs35.noteHint', { n: MAX_NOTE })} value={plan.note} onChange={(v: string) => setPlan({ ...plan, note: v.slice(0, MAX_NOTE) })} rows={3} />
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button type="button" className="btn-outline" onClick={onBack}>{t('m18.fs35.back')}</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={save} data-testid="m18-fs35-save">{t('m18.fs35.savePlan')}</button>
        </div>
      </Card>
    </Section>
  );
}

function Execute({ c, snapId, plan, onBack }: { c: Ctx; snapId: string; plan: Plan; onBack: () => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const [asp, setAsp] = useState<string>('grow_vertical');
  const [goal, setGoal] = useState('');
  const [topics, setTopics] = useState(() => plan.actions.filter((a) => a !== 'conversation').map((a) => t(`m18.fs35.topic.${a}`)).join('\n') + (plan.note ? `\n${plan.note}` : ''));
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const book = async () => {
    setConfirm(false);
    const r = await act(() => repo.rpc.submitPrep({ aspirations: [asp as never], goal_12m: goal.trim(), topics: topics.slice(0, 500), support: ['coaching'] }, true), { success: t('m18.fs35.shared') });
    if (!r.ok || !r.data) return;
    const l = await act(() => repo.rpc.saveHealthSnapshot({ snapshot_id: snapId, conversation_id: r.data!.id }), { success: t('m18.fs35.booked') });
    if (l.ok) setDone(r.data.id);
  };
  if (done) {
    return (
      <Section title={t('m18.fs35.doneTitle')}>
        <Callout tone="ok" title={t('m18.fs35.doneTitle')}><span data-testid="m18-fs35-done">{t('m18.fs35.doneBody')}</span></Callout>
        <div className="mt-3 flex flex-wrap gap-2">
          <L to="/my/career/conversations" className="btn-primary" data-testid="m18-fs35-to-conversations">{t('m18.fs35.toConversations')}</L>
          <L to="/my/coach" className="btn-outline">{t('m18.fs35.toCoach')}</L>
        </div>
      </Section>
    );
  }
  return (
    <Section title={t('m18.fs35.executeTitle')} description={t('m18.fs35.executeDesc')}>
      <Card>
        <Callout tone="info" title={t('m18.fs35.shareTitle')}>{t('m18.fs35.shareBody')}</Callout>
        <div className="mt-4 space-y-4">
          <RadioGroup label={t('m18.fs35.aspiration')} name="fs35-asp" value={asp} onChange={setAsp} options={ASPIRATIONS.map((a) => ({ value: a, label: t(`m18.cc.asp.${a}`) }))} />
          <TextField name="fs35-goal" label={t('m18.fs35.goal')} value={goal} onChange={(v: string) => setGoal(v)} required />
          <TextArea name="fs35-topics" label={t('m18.fs35.topics')} hint={t('m18.fs35.topicsHint')} value={topics} onChange={(v: string) => setTopics(v.slice(0, 500))} rows={4} />
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button type="button" className="btn-outline" onClick={onBack}>{t('m18.fs35.back')}</button>
          <button type="button" className="btn-primary" disabled={goal.trim().length < 3} onClick={() => setConfirm(true)} data-testid="m18-fs35-book">{t('m18.fs35.book')}</button>
        </div>
      </Card>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m18.fs35.confirmTitle')} consequence={t('m18.fs35.confirmBody')} confirmLabel={t('m18.fs35.book')} onConfirm={book} />
      <p className="mt-2 text-[12px] text-ink-3">{t('m18.fs35.snapshotRef', { n: c.snapshots.length + 1 })}</p>
    </Section>
  );
}

