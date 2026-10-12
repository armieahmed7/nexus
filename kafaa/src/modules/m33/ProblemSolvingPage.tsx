// FS58 /my/core-skills/problem-solving (skills_profile Own): adaptive problem-solving practice. PIAAC-style scenarios run in stages: the
// first sets the plan; each later stage reveals a mid-task change (a slip, data that disagree, a delayed part) only after I commit to the
// earlier choice (rpc.startAps / rpc.submitAps; SQL kafaa_aps_* = aps.ts). At every stage I judge which facts matter now and choose what I do;
// the key, a why for every option and the expert debrief come back after each answer. The result sits on Kafa'a's own 0-100 practice scale
// (four bands, defined on the page) with my ENEC comparison and the PIAAC line as context only (a different scale, never converted).
// Development only: never a qualification gate, never skill evidence, never talent review. No points, streaks or leaderboards.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, WhyThis, BenchmarkChips, BenchmarkLine, LineChart, ProgressBar, DataTable, Icon, Stepper, StatusPill, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { windowQuarters, apsPct, type ApsFeedback } from './aps';
import type { ApsCatalogItem, ApsContext, ApsResult, ApsStep } from './backend/rpc';
import { BandPill, DimBars, ScaleCard } from './fs65ui';
import { useCoreName, useM33Ref, type M33Ref, type Row } from './ui';

function usePractice(personId: string | null) {
  const repo = useRepo();
  return useQuery(['aps_attempts'], async () => {
    const [ctx, attempts] = await Promise.all([
      repo.rpc.apsContext(),
      repo.list('aps_attempts' as never, { filter: { person_id: personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { ctx, attempts: (attempts as Row[]).sort((a, b) => String(a.started_at).localeCompare(String(b.started_at))) };
  }, [personId]);
}

export default function ProblemSolvingPage() {
  const t = useT();
  const s = useSession();
  const ref = useM33Ref();
  const q = usePractice(s.identity.personId);
  return (
    <Page title={t('m33.routes.my-problem-solving.title')} intro={t('m33.aps.intro')} wide eyebrow={<BenchmarkChips feature="FS58" />}
      actions={<L to="/my/core-skills" className="btn-outline btn-sm no-underline" data-testid="m33-aps-to-mine"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m33.sjt.toMine')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => (c.ctx ? <Practice d={d} ctx={c.ctx} attempts={c.attempts} reload={q.reload} /> : <EmptyState title={t('m33.aps.none')} />)}</Async>}</Async>
    </Page>
  );
}

const EFF_TONE = ['border-bad-line bg-bad-bg', 'border-sim-line bg-sim-bg', 'border-info-line bg-info-bg', 'border-ok-line bg-ok-bg'];
const EFF_TEXT = ['text-bad', 'text-sim', 'text-info', 'text-ok'];

function Practice({ d, ctx, attempts, reload }: { d: M33Ref; ctx: ApsContext; attempts: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const [params] = useSearchParams();
  const [step, setStep] = useState<ApsStep | null>(null);
  const [answered, setAnswered] = useState<{ step: ApsStep; stage: NonNullable<ApsStep['stage']> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = attempts.filter((a) => a.status === 'completed');

  const start = async (scenarioId: string | null) => {
    setBusy(true); setError(null);
    try {
      const r = await repo.rpc.startAps({ scenario_id: scenarioId });
      if (r.ok && r.data) { setStep(r.data); setAnswered(null); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const submit = async (choice: number, picks: number[]) => {
    if (!step?.stage) return;
    setBusy(true); setError(null);
    const stage = step.stage;
    try {
      const r = await repo.rpc.submitAps({ attempt_id: step.attempt_id, stage_id: stage.id, choice, picks });
      if (r.ok && r.data) { setAnswered({ step: r.data, stage }); if (r.data.done) reload?.(); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const next = () => { if (answered) { setStep(answered.step); setAnswered(null); } };

  if (answered && answered.step.feedback) return <StageFeedback step={answered.step} stage={answered.stage} fb={answered.step.feedback} onNext={next} />;
  if (step && !step.done && step.stage) return <StageQuestion step={step} busy={busy} error={error} onSubmit={submit} />;

  const justDone = step?.done && step.result ? step.result : null;
  const latest = done[done.length - 1];
  const result: ApsResult | null = justDone ?? (latest ? { attempt_id: latest.id, scenario_id: latest.scenario_id, period: latest.period, points: Number(latest.points), max_points: Number(latest.max_points),
    score: Number(latest.score), band: latest.band, dims: latest.dims, reasons: latest.reasons ?? [], stages: (latest.responses ?? []).length } : null);
  const nextItem = ctx.next ? ctx.scenarios.find((s) => s.id === ctx.next!.scenario_id) : null;
  const want = params.get('scenario');
  return (
    <div className="space-y-6">
      {justDone && <Callout tone="ok" title={t('m33.aps.doneTitle')}>{t('m33.aps.doneBody')}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card eyebrow={t('m33.aps.how.eyebrow')} title={t('m33.aps.how.title')}>
          <ol className="space-y-1.5 text-[13.5px] text-ink-2" data-testid="m33-aps-how">
            {['s1', 's2', 's3', 's4'].map((k, i) => <li key={k} className="flex gap-2"><span className="num inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] text-eyebrow">{f.num(i + 1)}</span>{t(`m33.aps.how.${k}`)}</li>)}
          </ol>
          {nextItem && (
            <div className="mt-4 rounded-card border border-accent/40 bg-accent-soft/40 p-3" data-testid="m33-aps-next">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><div className="caps text-[10.5px] text-eyebrow">{t('m33.aps.next')}</div><ScenarioTitle s={nextItem} /></div>
                <div className="flex items-center gap-2"><WhyThis reasons={ctx.next!.reasons} testId="m33-aps-next-why" />
                  <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => start(nextItem.id)} data-testid="m33-aps-start-next">{ctx.in_progress ? t('m33.aps.resume') : t('m33.aps.start')}</button></div>
              </div>
            </div>
          )}
          <div aria-live="polite" className="mt-3">{error && <Callout tone="bad" title={t('m33.aps.error')}>{error}</Callout>}</div>
        </Card>
        <Card title={t('m33.aps.scale.title')} eyebrow={t('m33.aps.scale.eyebrow')}><ScaleCard score={result?.score ?? null} /></Card>
      </div>

      <Section title={t('m33.aps.cat.title')} description={t('m33.aps.cat.intro')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m33-aps-catalog">
          {ctx.scenarios.map((s) => <ScenarioCard key={s.id} s={s} d={d} busy={busy} open={ctx.in_progress?.scenario_id === s.id} highlight={want === s.id} onStart={() => start(s.id)} />)}
        </div>
      </Section>

      {result ? <Result ctx={ctx} result={result} done={done} scenarios={ctx.scenarios} /> : <EmptyState title={t('m33.aps.noResult')}>{t('m33.aps.noResultBody')}</EmptyState>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m33.aps.private.title')}>{t('m33.aps.private.body')}</Callout>
        <Callout tone="ok" title={t('m33.aps.gate.title')}>{t('m33.aps.gate.body')}</Callout>
      </div>
    </div>
  );
}

function ScenarioTitle({ s }: { s: ApsCatalogItem | ApsStep['scenario'] }) {
  const pick = usePick();
  return <div className="font-semibold"><span className="num me-1.5 text-[11.5px] text-ink-3">{s.code}</span>{pick(s as unknown as Row, 'title')}</div>;
}

function ScenarioCard({ s, d, busy, open, highlight, onStart }: { s: ApsCatalogItem; d: M33Ref; busy: boolean; open: boolean; highlight: boolean; onStart: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const coreName = useCoreName(d);
  return (
    <Card as="article" className={`flex flex-col ${highlight ? 'ring-2 ring-[rgb(var(--accent))]' : ''}`}>
      <div data-testid="m33-aps-scenario" data-id={s.id} data-changes={s.changes} className="flex h-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip border-line bg-panel normal-case tracking-normal text-ink-2">{t(`m33.aps.theme.${s.theme}`)}</span>
          <span className="chip border-transparent bg-sunken normal-case tracking-normal text-ink-2" data-testid="m33-aps-changes">{t('m33.aps.changes', { n: f.num(s.changes) })}</span>
          <span className="text-[11.5px] text-ink-3">{t('m33.aps.minutes', { n: f.num(s.est_minutes) })} · {t(`m33.aps.diff.${s.difficulty}`)}</span>
        </div>
        <ScenarioTitle s={s} />
        <p className="text-[13px] text-ink-2">{pick(s as unknown as Row, 'summary')}</p>
        <div className="flex flex-wrap gap-1">{s.core_skill_ids.map((id) => <L key={id} to={`/learn/core-skills/${id}`} className="chip border-line bg-panel normal-case tracking-normal text-ink-2">{coreName(id)}</L>)}</div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-[12px] text-ink-3" data-testid="m33-aps-mine">{s.mine ? t('m33.aps.mineSummary', { n: f.num(s.mine), best: f.num(s.best ?? 0) }) : t('m33.aps.notYet')}</span>
          <button type="button" className={open ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} disabled={busy} onClick={onStart} data-testid="m33-aps-start">{open ? t('m33.aps.resume') : s.mine ? t('m33.aps.again') : t('m33.aps.start')}</button>
        </div>
      </div>
    </Card>
  );
}

function StageHeader({ step, n }: { step: ApsStep; n: number }) {
  const t = useT();
  const f = useFormat();
  const steps = Array.from({ length: step.total }, (_, i) => ({ id: String(i), label: i === 0 ? t('m33.aps.stagePlan') : t('m33.aps.stageChange', { n: f.num(i) }) }));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-2">
        <ScenarioTitle s={step.scenario} />
        <span className="chip border-line bg-panel normal-case tracking-normal">{t(`m33.aps.theme.${step.scenario.theme}`)}</span>
      </div>
      <Stepper steps={steps} current={Math.min(n, step.total - 1)} />
      <ProgressBar value={Math.round((100 * step.answered) / Math.max(1, step.total))} label={t('m33.aps.progress')} />
    </div>
  );
}

function StageQuestion({ step, busy, error, onSubmit }: { step: ApsStep; busy: boolean; error: string | null; onSubmit: (choice: number, picks: number[]) => void }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const st = step.stage!;
  const [choice, setChoice] = useState<string>('');
  const [picks, setPicks] = useState<number[]>([]);
  const toggle = (i: number) => setPicks((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i].sort((a, b) => a - b)));
  const isChange = st.kind === 'change';
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="m33-aps-stage" data-stage={st.id} data-kind={st.kind}>
      <StageHeader step={step} n={step.answered} />
      {step.answered === 0 && <Card eyebrow={t('m33.aps.context')}><p className="text-[13.5px] text-ink-2" data-testid="m33-aps-context">{pick(step.scenario as unknown as Row, 'context')}</p></Card>}
      <div className={`rounded-card border p-4 ${isChange ? 'border-sim-line bg-sim-bg' : 'border-line bg-panel'}`} data-testid={isChange ? 'm33-aps-change' : 'm33-aps-situation'} role={isChange ? 'alert' : undefined}>
        <div className="mb-1 flex items-center gap-2">
          <Icon name={isChange ? 'alert' : 'info'} size={15} className={isChange ? 'text-sim' : 'text-accent'} />
          <span className="caps text-[10.5px]">{isChange ? t('m33.aps.changeTitle') : t('m33.aps.situationTitle')}</span>
        </div>
        <p className="text-[14.5px] leading-relaxed">{pick(st as unknown as Row, 'info')}</p>
      </div>
      {st.cues.length > 0 && (
        <Card title={t('m33.aps.cuesTitle')} eyebrow={t('m33.aps.cuesEyebrow')}>
          <div className="space-y-1.5" role="group" aria-label={t('m33.aps.cuesTitle')} data-testid="m33-aps-cues">
            {st.cues.map((c, i) => (
              <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-card border p-2.5 text-[13.5px] ${picks.includes(i) ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}>
                <input type="checkbox" checked={picks.includes(i)} onChange={() => toggle(i)} className="mt-1" data-testid={`m33-aps-cue-${i}`} />
                <span>{lang === 'ar' ? c.ar : c.en}</span>
              </label>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <fieldset>
          <legend className="mb-2 text-[16px] font-semibold leading-snug">{pick(st as unknown as Row, 'question')}</legend>
          <div className="space-y-2" role="radiogroup">
            {st.options.map((o, i) => (
              <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 text-[14px] ${choice === String(i) ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}>
                <input type="radio" name="m33-aps-choice" value={String(i)} checked={choice === String(i)} onChange={() => setChoice(String(i))} className="mt-1" data-testid={`m33-aps-opt-${i}`} />
                <span>{lang === 'ar' ? o.ar : o.en}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-ink-3">{t('m33.aps.noKey')}</span>
          <button type="button" className="btn-primary" disabled={choice === '' || busy} onClick={() => onSubmit(Number(choice), picks)} data-testid="m33-aps-submit">{t('m33.aps.submit')}</button>
        </div>
      </Card>
      <div aria-live="polite">{error && <Callout tone="bad" title={t('m33.aps.error')}>{error}</Callout>}</div>
    </div>
  );
}

function StageFeedback({ step, stage, fb, onNext }: { step: ApsStep; stage: NonNullable<ApsStep['stage']>; fb: ApsFeedback; onNext: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const notes = lang === 'ar' ? fb.notes_ar : fb.notes_en;
  const verdict = fb.kind === 'change' && fb.kept && !fb.best_keep ? 'held' : fb.kind === 'change' && !fb.kept && fb.best_keep ? 'overreact' : String(fb.eff);
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="m33-aps-feedback" data-eff={fb.eff}>
      <StageHeader step={step} n={step.answered - 1} />
      <Card title={<span className={EFF_TEXT[fb.eff]} data-testid="m33-aps-verdict" data-verdict={verdict}>{t(`m33.aps.verdict.${verdict}`)}</span>} eyebrow={t('m33.aps.fb.eyebrow')}>
        {stage.cues.length > 0 && (
          <div className="mb-4" data-testid="m33-aps-fb-cues">
            <h3 className="caps mb-1">{t('m33.aps.fb.cues', { ok: f.num(fb.cue_ok), n: f.num(fb.cue_n) })}</h3>
            <ul className="space-y-1 text-[13px]">
              {stage.cues.map((c, i) => {
                const right = fb.relevant[i] === fb.picks.includes(i);
                return (
                  <li key={i} className="flex items-start gap-2" data-relevant={fb.relevant[i] ? 'yes' : 'no'} data-right={right ? 'yes' : 'no'}>
                    <Icon name={right ? 'check' : 'alert'} size={14} className={`mt-0.5 shrink-0 ${right ? 'text-ok' : 'text-sim'}`} />
                    <span><span className="text-ink">{lang === 'ar' ? c.ar : c.en}</span> <span className="text-ink-3">· {fb.relevant[i] ? t('m33.aps.fb.matters') : t('m33.aps.fb.noise')}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <ol className="space-y-2" data-testid="m33-aps-key">
          {stage.options.map((o, i) => (
            <li key={i} className={`rounded-card border p-3 text-[13.5px] ${EFF_TONE[fb.effs[i]]} ${i === fb.choice ? 'ring-2 ring-[rgb(var(--accent))]' : ''}`} data-eff={fb.effs[i]} data-mine={i === fb.choice ? 'yes' : 'no'}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 font-semibold text-ink">{lang === 'ar' ? o.ar : o.en}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {i === fb.choice && <span className="caps text-[10.5px] text-accent">{t('m33.sjt.fb.yours')}</span>}
                  <span className={`caps text-[10.5px] ${EFF_TEXT[fb.effs[i]]}`}>{t(`m33.sjt.eff.${fb.effs[i]}`)}</span>
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-2">{notes[i]}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-card border border-line bg-sunken p-3" data-testid="m33-aps-debrief">
          <h3 className="caps mb-1">{t('m33.aps.fb.debrief')}</h3>
          <p className="text-[13.5px]">{lang === 'ar' ? fb.debrief_ar : fb.debrief_en}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={onNext} data-testid="m33-aps-continue">{step.done ? t('m33.aps.fb.result') : t('m33.aps.fb.next')}</button>
        </div>
      </Card>
    </div>
  );
}

function Result({ ctx, result, done, scenarios }: { ctx: ApsContext; result: ApsResult; done: Row[]; scenarios: ApsCatalogItem[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lines = ctx.enec_avg != null ? [{ kind: 'enec' as const, label: t('m33.aps.res.enec', { n: f.num(ctx.enec_n ?? 0) }), value: ctx.enec_avg }] : [];
  const win = windowQuarters(todayIso());
  const trend = win.map((q) => {
    const xs = done.filter((a) => a.period === q);
    const pts = xs.reduce((s, a) => s + Number(a.points), 0);
    const mx = xs.reduce((s, a) => s + Number(a.max_points), 0);
    return { x: q, y: mx ? apsPct(pts, mx) : null };
  });
  const sc = scenarios.find((s) => s.id === result.scenario_id);
  const cols: Column<Row>[] = [
    { key: 'when', header: t('m33.aps.hist.when'), value: (a) => String(a.completed_at ?? a.started_at), render: (a) => f.date(String(a.completed_at ?? a.started_at).slice(0, 10)), sortable: true },
    { key: 'scenario', header: t('m33.aps.hist.scenario'), value: (a) => { const s = scenarios.find((x) => x.id === a.scenario_id); return s ? pick(s as unknown as Row, 'title') : a.scenario_id; } },
    { key: 'score', header: t('m33.aps.hist.score'), align: 'end', value: (a) => Number(a.score), render: (a) => <span className="num font-semibold">{f.num(Number(a.score))}</span>, sortable: true },
    { key: 'band', header: t('m33.aps.hist.band'), value: (a) => String(a.band), render: (a) => <BandPill band={a.band} /> },
  ];
  return (
    <Section title={t('m33.aps.res.title', { period: result.period })} description={t('m33.aps.res.intro')}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={<span className="flex flex-wrap items-center gap-2" data-testid="m33-aps-result" data-score={result.score} data-band={result.band}>
          <span className="num text-[28px] font-semibold">{f.num(result.score)}</span><span className="text-ink-3">/ {f.num(100)}</span><BandPill band={result.band} testId="m33-aps-band" /></span>}
          eyebrow={sc ? pick(sc as unknown as Row, 'title') : undefined} actions={<WhyThis reasons={result.reasons} testId="m33-aps-why" />}>
          <div data-testid="m33-aps-line"><BenchmarkLine value={result.score} max={100} label={t('m33.aps.res.line')} lines={lines} /></div>
          {ctx.enec_avg == null && <p className="mt-2 text-[12px] text-ink-3">{t('m33.aps.res.enecSuppressed')}</p>}
          <p className="mt-3 text-[13px] text-ink-2">{t(`m33.aps.bandSub.${result.band}`)}</p>
          <div className="mt-3 rounded-card border border-dashed border-line p-3" data-testid="m33-aps-result-piaac">
            <BenchmarkLine max={500} label={t('m33.aps.scale.piaacLine')} benchmark={{ id: 'OECD-PIAAC', figure: 'aps_oecd_average' }} compact />
            <p className="mt-1 text-[12px] text-ink-3">{t('m33.aps.scale.piaacNote')}</p>
          </div>
        </Card>
        <Card title={t('m33.aps.res.dims')} eyebrow={t('m33.aps.res.dimsEyebrow')}>
          <DimBars dims={result.dims} />
          <p className="mt-3 text-[12px] text-ink-3">{t('m33.aps.res.dimsNote')}</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title={t('m33.aps.trend.title')} eyebrow={t('m33.aps.trend.eyebrow')}>
          {trend.filter((x) => x.y != null).length > 1
            ? <LineChart title={t('m33.aps.trend.title')} yMin={0} yMax={100} series={[{ name: t('m33.aps.trend.mine'), points: trend },
              ...(ctx.enec_avg != null ? [{ name: t('m33.aps.res.enecShort'), points: trend.map((p) => ({ x: p.x, y: ctx.enec_avg })), dashed: true, tone: 'info' }] : [])]} />
            : <p className="text-[13px] text-ink-3">{t('m33.aps.trend.one')}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2" data-testid="m33-aps-tiles">
            <StatTile label={t('m33.aps.trend.runs')} value={f.num(done.length)} />
            <StatTile label={t('m33.aps.trend.first')} value={done.length ? f.num(Number(done[0].score)) : '—'} />
            <StatTile label={t('m33.aps.trend.latest')} value={done.length ? f.num(Number(done[done.length - 1].score)) : '—'} tone="ok" />
          </div>
        </Card>
        <Card title={t('m33.aps.hist.title')}>
          <div data-testid="m33-aps-history"><DataTable rows={[...done].reverse()} columns={cols} rowKey={(a) => a.id} searchable={false} pageSize={8} caption={t('m33.aps.hist.title')} dense /></div>
          <p className="mt-2 text-[12px] text-ink-3"><StatusPill tone="neutral">{t('m33.aps.hist.never')}</StatusPill></p>
        </Card>
      </div>
    </Section>
  );
}
