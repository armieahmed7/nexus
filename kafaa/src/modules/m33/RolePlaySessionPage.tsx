// FS59 /my/role-play/:id (skills_profile Own): one role-play practice session. The counterpart speaks, I answer in my own words (EN or AR),
// and the published deterministic rubric ticks each criterion (rpc.roleplayTurn; SQL kafaa_rp_eval = roleplay.ts evaluateTurn). Only the
// ticks and the word count are kept, never what I typed; the box clears after each check. If what I type reads like a real concern
// (harassment, falsified records, something that really happened), the page routes me to the speak-up channels and sends nothing: the
// check runs here before any request, and the server repeats it and stores nothing either (no session change, no audit row).
// At the end: my rate against the scenario's mark with why, and the way to ask a named reviewer to validate it as evidence.
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, Callout, EmptyState, WhyThis, BenchmarkChips, BenchmarkLine, ProgressBar, Stepper, Icon, StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { MAX_ANSWER, MIN_ANSWER, rpNorm, speakUpTopic, wordCount, type RpCriterion } from './roleplay';
import type { RpStep } from './backend/rpc';
import { KindTag, RubricList, Ticks } from './fs65ui';
import type { Row } from './ui';

function useSessionData(id: string, personId: string | null) {
  const repo = useRepo();
  return useQuery(['roleplay_scenarios', 'roleplay_sessions'], async () => {
    const [sc, mine, ctx] = await Promise.all([
      repo.get('roleplay_scenarios' as never, id).catch(() => null) as Promise<Row | null>,
      repo.list('roleplay_sessions' as never, { filter: { person_id: personId ?? '__none__', scenario_id: id } } as never).catch(() => [] as Row[]) as Promise<Row[]>,
      repo.rpc.roleplayContext(),
    ]);
    return { sc, mine: [...mine].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at))), ctx };
  }, [id, personId]);
}

export default function RolePlaySessionPage() {
  const t = useT();
  const { id = '' } = useParams();
  const s = useSession();
  const q = useSessionData(id, s.identity.personId);
  return (
    <Page title={t('m33.routes.my-role-play-scenario.title')} intro={t('m33.rp.session.intro')} wide eyebrow={<BenchmarkChips feature="FS59" />}
      actions={<L to="/my/role-play" className="btn-outline btn-sm no-underline" data-testid="m33-rp-back"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m33.rp.session.back')}</L>}>
      <Async state={q}>{(d) => (d.sc && d.sc.status === 'published' ? <Session sc={d.sc} mine={d.mine} openId={d.ctx?.open.find((o) => o.scenario_id === id)?.session_id ?? null} reload={q.reload} />
        : <EmptyState title={t('m33.rp.session.missing')} action={<L to="/learn/role-play" className="btn-outline btn-sm no-underline">{t('m33.routes.learn-role-play.title')}</L>} />)}</Async>
    </Page>
  );
}

function Session({ sc, mine, openId, reload }: { sc: Row; mine: Row[]; openId: string | null; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const [step, setStep] = useState<RpStep | null>(null);
  const [checked, setChecked] = useState<RpStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speak, setSpeak] = useState(false);
  const rubric = sc.rubric as RpCriterion[];
  const last = mine.find((m) => m.status === 'completed');

  const start = async () => {
    setBusy(true); setError(null); setSpeak(false);
    try {
      const r = await repo.rpc.startRoleplay({ scenario_id: sc.id });
      if (r.ok && r.data) { setStep(r.data); setChecked(null); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  /** Returns true when the answer was sent (the box then clears). */
  const answer = async (text: string): Promise<boolean> => {
    if (!step?.turn) return false;
    // Speak-up first, on this device: a real concern never leaves the page as practice.
    if (speakUpTopic(text)) { setSpeak(true); return true; }
    setBusy(true); setError(null); setSpeak(false);
    try {
      const r = await repo.rpc.roleplayTurn({ session_id: step.session_id, turn_id: step.turn.id, text });
      if (r.code === 'speak_up') { setSpeak(true); return true; }
      if (r.ok && r.data) { setChecked(r.data); if (r.data.done) reload?.(); return true; }
      setError(r.message); return false;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; } finally { setBusy(false); }
  };
  const next = () => { if (checked) { setStep(checked); setChecked(null); } };

  const setting = (
    <Card eyebrow={<KindTag kind={sc.kind} />} title={<span><span className="num me-1.5 text-[12px] text-ink-3">{sc.code}</span>{pick(sc, 'title')}</span>}>
      <p className="text-[13.5px] text-ink-2" data-testid="m33-rp-setting">{pick(sc, 'setting')}</p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
        <div className="rounded-card border border-line p-2"><dt className="caps text-[10.5px]">{t('m33.rp.counterpart')}</dt><dd>{pick(sc, 'counterpart')}</dd></div>
        <div className="rounded-card border border-line p-2"><dt className="caps text-[10.5px]">{t('m33.rp.yourRole')}</dt><dd>{pick(sc, 'role')}</dd></div>
      </dl>
    </Card>
  );
  const aside = (
    <div className="space-y-4">
      <Card title={t('m33.rp.rubricTitle')} eyebrow={t('m33.rp.levelPass', { level: f.num(sc.level), pct: f.num(sc.pass_pct) })}><RubricList rubric={rubric} compact /></Card>
      <Callout tone="info" title={t('m33.rp.session.privateTitle')}>{t('m33.rp.session.privateBody')}</Callout>
    </div>
  );
  const speakBox = speak && (
    <div role="alert" data-testid="m33-rp-speakup"><Callout tone="sim" title={t('m33.rp.speak.title')}>
      {t('m33.rp.speak.routed')} <L to="/speak-up" className="font-semibold" data-testid="m33-rp-speakup-link">{t('m33.rp.speak.link')}</L>
    </Callout></div>
  );

  let main;
  if (checked && checked.feedback) main = <TurnFeedback step={step!} checked={checked} rubric={rubric} onNext={next} />;
  else if (step && !step.done && step.turn) main = <TurnInput step={step} busy={busy} onAnswer={answer} speakBox={speakBox} error={error} />;
  else if (step?.done && step.result) main = (
    <div className="space-y-4">
      <Callout tone="ok" title={t('m33.rp.session.doneTitle')}>{t('m33.rp.session.doneBody')}</Callout>
      <Summary step={step} sc={sc} />
      <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={start} data-testid="m33-rp-again">{t('m33.rp.again')}</button>
    </div>
  );
  else main = (
    <div className="space-y-4">
      {setting}
      <Card title={t('m33.rp.session.ready')}>
        <ol className="space-y-1.5 text-[13px] text-ink-2">{['b1', 'b2', 'b3'].map((k) => <li key={k} className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />{t(`m33.rp.session.${k}`)}</li>)}</ol>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={start} data-testid="m33-rp-start">{openId ? t('m33.rp.resume') : last ? t('m33.rp.again') : t('m33.rp.start')}</button>
          {last && <span className="text-[12.5px] text-ink-3" data-testid="m33-rp-last">{t('m33.rp.session.last', { pct: f.num(Number(last.pct)), date: f.date(String(last.completed_at ?? last.started_at).slice(0, 10)) })}</span>}
        </div>
        <div aria-live="polite" className="mt-3">{error && <Callout tone="bad" title={t('m33.aps.error')}>{error}</Callout>}</div>
      </Card>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">{main}</div>
      {aside}
    </div>
  );
}

function TurnHeader({ step, n }: { step: RpStep; n: number }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-2">
      <Stepper steps={Array.from({ length: step.total }, (_, i) => ({ id: String(i), label: t('m33.rp.turnN', { n: f.num(i + 1) }) }))} current={Math.min(n, step.total - 1)} />
      <ProgressBar value={Math.round((100 * step.answered) / Math.max(1, step.total))} label={t('m33.aps.progress')} />
    </div>
  );
}

function TurnInput({ step, busy, onAnswer, speakBox, error }: { step: RpStep; busy: boolean; onAnswer: (text: string) => Promise<boolean>; speakBox: ReactNode; error: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const turn = step.turn!;
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const words = wordCount(rpNorm(text));
  const tooShort = text.trim().length < MIN_ANSWER;
  const send = async () => { if (await onAnswer(text)) setText(''); };
  return (
    <div className="space-y-4" data-testid="m33-rp-turn" data-turn={turn.id}>
      <TurnHeader step={step} n={step.answered} />
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true"><Icon name="user" size={16} /></span>
        <div className="min-w-0 rounded-card rounded-ss-none border border-line bg-panel p-3 text-[14.5px] leading-relaxed" data-testid="m33-rp-prompt">{pick(turn as unknown as Row, 'prompt')}</div>
      </div>
      <Card>
        <label htmlFor="m33-rp-answer" className="mb-1 block text-[13px] font-semibold">{t('m33.rp.answerLabel')}</label>
        <textarea id="m33-rp-answer" className="input min-h-[140px]" maxLength={MAX_ANSWER} value={text} onChange={(e) => setText(e.target.value)} data-testid="m33-rp-answer" autoComplete="off" spellCheck />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
          <span data-testid="m33-rp-words">{t('m33.rp.words', { n: f.num(words) })} · {t('m33.rp.notStored')}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setHint((h) => !h)} aria-expanded={hint} data-testid="m33-rp-hint-btn">{hint ? t('m33.rp.hideHint') : t('m33.rp.showHint')}</button>
        </div>
        {hint && <p className="mt-2 rounded-card bg-sunken p-2 text-[13px] text-ink-2" data-testid="m33-rp-hint">{pick(turn as unknown as Row, 'hint')}</p>}
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn-primary" disabled={busy || tooShort} onClick={send} data-testid="m33-rp-submit">{t('m33.rp.checkBtn')}</button>
        </div>
      </Card>
      <div aria-live="polite" className="space-y-2">{speakBox}{error && <Callout tone="bad" title={t('m33.aps.error')}>{error}</Callout>}</div>
    </div>
  );
}

function TurnFeedback({ step, checked, rubric, onNext }: { step: RpStep; checked: RpStep; rubric: RpCriterion[]; onNext: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const fb = checked.feedback!;
  const turn = step.turn;
  return (
    <div className="space-y-4" data-testid="m33-rp-feedback" data-passed={fb.passed} data-total={fb.total}>
      <TurnHeader step={checked} n={checked.answered - 1} />
      <Card title={t('m33.rp.fb.title', { passed: f.num(fb.passed), total: f.num(fb.total) })} eyebrow={t('m33.rp.fb.eyebrow', { n: f.num(fb.words) })}>
        <Ticks results={fb.criteria} rubric={rubric} />
        {turn && (
          <div className="mt-4 rounded-card border border-line bg-sunken p-3" data-testid="m33-rp-example">
            <h3 className="caps mb-1">{t('m33.rp.fb.example')}</h3>
            <p className="text-[13.5px]">{pick(turn as unknown as Row, 'example')}</p>
          </div>
        )}
        <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={onNext} data-testid="m33-rp-continue">{checked.done ? t('m33.rp.fb.result') : t('m33.rp.fb.next')}</button></div>
      </Card>
    </div>
  );
}

function Summary({ step, sc }: { step: RpStep; sc: Row }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const r = step.result!;
  const rubric = sc.rubric as RpCriterion[];
  return (
    <Card title={<span className="flex flex-wrap items-center gap-2" data-testid="m33-rp-result" data-pct={r.pct} data-ready={r.ready ? 'yes' : 'no'}>
      <span className="num text-[26px] font-semibold">{f.num(r.pct)}%</span>
      <StatusPill tone={r.ready ? 'ok' : 'info'}>{r.ready ? t('m33.rp.ready') : t('m33.rp.notReady')}</StatusPill></span>}
      eyebrow={t('m33.rp.res.eyebrow')} actions={<WhyThis reasons={r.reasons} testId="m33-rp-why" />}>
      <BenchmarkLine value={r.pct} max={100} unit="pct" label={t('m33.rp.res.line')} lines={[{ kind: 'target', label: t('m33.rp.res.mark'), value: Number(sc.pass_pct) }]} />
      <div className="mt-4 space-y-3">
        {r.turns.map((tr, i) => (
          <div key={tr.turn_id} className="rounded-card border border-line p-2.5" lang={lang}>
            <div className="caps mb-1 text-[10.5px]">{t('m33.rp.turnN', { n: f.num(i + 1) })} · {t('m33.rp.words', { n: f.num(tr.words) })}</div>
            <Ticks results={tr.criteria} rubric={rubric} testId={`m33-rp-ticks-${i}`} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {r.ready
          ? <L to={`/my/role-play?tab=history&review=${r.session_id}`} className="btn-primary btn-sm no-underline" data-testid="m33-rp-to-review">{t('m33.rp.res.askReview')}</L>
          : <span className="text-[12.5px] text-ink-3">{t('m33.rp.res.notYet', { pct: f.num(Number(sc.pass_pct)) })}</span>}
        <L to="/my/role-play?tab=history" className="btn-outline btn-sm no-underline">{t('m33.rp.res.history')}</L>
      </div>
    </Card>
  );
}
