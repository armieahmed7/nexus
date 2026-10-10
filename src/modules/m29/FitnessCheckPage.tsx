// FS10 /my/ai-fluency/check (ai_literacy Own): the AI and Digital Fitness Check. An adaptive 18-20 item diagnostic over the five
// DigComp areas (safety and problem solving weighted) and the four AI dimensions. Items come one at a time from the server without
// the answer key (rpc.startFitness / rpc.submitFitness); routing, the stop rule and scoring run server-side (SQL kafaa_fit_* = TS
// fitness.ts). The result shows the score with the ENEC average and my family's target as benchmark lines, the area profile, the
// evidence written to my skills (never above level 2), the reasons, and my quarterly trend: the trend line is the artefact.
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, WhyThis, BenchmarkChips, BenchmarkLine, BarChart, LineChart, ProgressBar, StatusPill, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { EVIDENCE_CAP, MAX_ITEMS, isAboveBasic } from './fitness';
import type { FitnessContext, FitnessResult, FitnessStep } from './backend/rpc';
import { useM29Ref, type M29Ref, type Row } from './ui';

function useCheck(personId: string | null) {
  const repo = useRepo();
  return useQuery(['fitness_attempts', 'skill_evidence'], async () => {
    const [ctx, attempts] = await Promise.all([
      repo.rpc.fitnessContext(),
      repo.list('fitness_attempts' as never, { filter: { person_id: personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { ctx, attempts: (attempts as Row[]).sort((a, b) => String(a.started_at).localeCompare(String(b.started_at))) };
  }, [personId]);
}

const bandTone = (b: string | null | undefined) => (b === 'advanced' || b === 'above_basic' ? 'ok' : b === 'basic' ? 'info' : 'neutral') as 'ok' | 'info' | 'neutral';

export default function FitnessCheckPage() {
  const t = useT();
  const s = useSession();
  const ref = useM29Ref();
  const q = useCheck(s.identity.personId);
  return (
    <Page title={t('m29.routes.my-ai-fitness.title')} intro={t('m29.fit.intro')} wide eyebrow={<BenchmarkChips feature="FS10" />}
      actions={<L to="/my/ai-fluency" className="btn-outline btn-sm no-underline" data-testid="m29-fit-to-ladder"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m29.fit.toMine')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => (c.ctx ? <Check d={d} ctx={c.ctx} attempts={c.attempts} reload={q.reload} /> : <EmptyState title={t('m29.fit.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Check({ d, ctx, attempts, reload }: { d: M29Ref; ctx: FitnessContext; attempts: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const lang = useLang();
  const [step, setStep] = useState<FitnessStep | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = attempts.filter((a) => a.status === 'completed');
  const latest = done[done.length - 1];

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = await repo.rpc.startFitness();
      if (r.ok && r.data) { setStep(r.data); setChoice(''); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const answer = async () => {
    if (!step?.item || choice === '') return;
    setBusy(true); setError(null);
    try {
      const r = await repo.rpc.submitFitness({ attempt_id: step.attempt_id, item_id: step.item.id, choice: Number(choice) });
      if (r.ok && r.data) { setStep(r.data); setChoice(''); if (r.data.done) reload?.(); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  if (step && !step.done && step.item) {
    const it = step.item;
    const area = d.areas.find((a: Row) => a.id === it.area_id);
    const list = lang === 'ar' && it.options_ar?.length ? it.options_ar : it.options_en;
    return (
      <div className="mx-auto max-w-2xl space-y-4" data-testid="m29-fit-question" data-item={it.id}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12.5px] text-ink-2">
            <span>{t('m29.fit.q.progress', { n: f.num(step.answered + 1), max: f.num(step.max) })}</span>
            {area && <span className="chip border-line bg-panel normal-case tracking-normal">{area.code} · {pick(area, 'name')}</span>}
          </div>
          <ProgressBar value={Math.round((100 * step.answered) / Math.max(1, step.max))} label={t('m29.fit.q.progressLabel')} />
        </div>
        <Card>
          <fieldset>
            <legend className="mb-3 text-[16px] font-semibold leading-snug">{pick(it as unknown as Row, 'stem')}</legend>
            <div className="space-y-2" role="radiogroup">
              {list.map((o, i) => (
                <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 text-[14px] ${choice === String(i) ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}>
                  <input type="radio" name="m29-fit-choice" value={String(i)} checked={choice === String(i)} onChange={() => setChoice(String(i))} className="mt-1" data-testid={`m29-fit-opt-${i}`} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-ink-3">{t('m29.fit.q.noKey')}</span>
            <button type="button" className="btn-primary" disabled={choice === '' || busy} onClick={answer} data-testid="m29-fit-next">{t('m29.fit.q.next')}</button>
          </div>
        </Card>
        <div aria-live="polite">{error && <Callout tone="bad" title={t('m29.fit.error')}>{error}</Callout>}</div>
      </div>
    );
  }

  const result: FitnessResult | null = step?.done && step.result ? step.result : latest ? {
    attempt_id: latest.id, period: latest.period, score: Number(latest.score), band: latest.band, above_basic: isAboveBasic(latest.band), area_levels: latest.area_levels ?? {},
    evidence: latest.evidence ?? [], reasons: latest.reasons ?? [], item_count: Number(latest.item_count),
  } : null;
  const justFinished = !!step?.done;
  const open = attempts.find((a) => a.status === 'in_progress');

  return (
    <div className="space-y-6">
      {justFinished && <Callout tone="ok" title={t('m29.fit.doneTitle')}>{t('m29.fit.doneBody', { n: f.num(step!.answered) })}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card eyebrow={t('m29.fit.start.eyebrow', { period: ctx.period })} title={t('m29.fit.start.title')}>
          <ul className="space-y-1.5 text-[13.5px] text-ink-2" data-testid="m29-fit-about">
            <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />{t('m29.fit.start.b1', { max: f.num(MAX_ITEMS) })}</li>
            <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />{t('m29.fit.start.b2')}</li>
            <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />{t('m29.fit.start.b3', { cap: f.num(EVIDENCE_CAP) })}</li>
            <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />{t('m29.fit.start.b4')}</li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {ctx.can_start ? (
              <button type="button" className="btn-primary" onClick={start} disabled={busy} data-testid="m29-fit-start">{open || ctx.in_progress ? t('m29.fit.start.resume') : t('m29.fit.start.go')}</button>
            ) : (
              <span className="text-[13px] text-ink-2" data-testid="m29-fit-next-on">{t('m29.fit.start.nextOn', { date: f.date(ctx.next_on) })}</span>
            )}
          </div>
          <div aria-live="polite" className="mt-3">{error && <Callout tone="bad" title={t('m29.fit.error')}>{error}</Callout>}</div>
        </Card>
        <Card title={t('m29.fit.areas.title')} eyebrow={t('m29.fit.areas.eyebrow')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m29-fit-areas">
            {d.areas.map((a: Row) => (
              <li key={a.id} className="flex items-start justify-between gap-2">
                <span><span className="num me-1.5 text-[11.5px] text-ink-3">{a.code}</span>{pick(a, 'name')}</span>
                {Number(a.weight) > 1 && <span className="chip border-transparent bg-accent-soft normal-case tracking-normal text-eyebrow">{t('m29.fit.areas.weighted', { w: f.num(Number(a.weight)) })}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {result ? <Result d={d} ctx={ctx} result={result} done={done} /> : <EmptyState title={t('m29.fit.noResult')}>{t('m29.fit.noResultBody')}</EmptyState>}
      <Callout tone="info" title={t('m29.fit.privacy.title')}>{t('m29.fit.privacy.body')}</Callout>
    </div>
  );
}

function Result({ d, ctx, result, done }: { d: M29Ref; ctx: FitnessContext; result: FitnessResult; done: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const skillName = (id: string) => { const k = d.skills.find((x: Row) => x.id === id); return k ? pick(k, 'name') : id; };
  const lines = [
    ...(ctx.enec_avg != null ? [{ kind: 'enec' as const, label: t('m29.fit.res.enecAvg', { n: f.num(ctx.enec_n ?? 0) }), value: ctx.enec_avg }] : []),
    ...(ctx.role_target != null ? [{ kind: 'target' as const, label: t('m29.fit.res.roleTarget'), value: ctx.role_target }] : []),
  ];
  return (
    <Section title={t('m29.fit.res.title', { period: result.period })} description={t('m29.fit.res.intro')}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={<span className="flex flex-wrap items-center gap-2" data-testid="m29-fit-result" data-score={result.score} data-band={result.band}>
          <span className="num text-[28px] font-semibold">{f.num(result.score)}</span><span className="text-ink-3">/ {f.num(100)}</span>
          <StatusPill tone={bandTone(result.band)}>{t(`m29.band.${result.band}`)}</StatusPill></span>}
          actions={<WhyThis reasons={result.reasons} testId="m29-fit-why" />}>
          <BenchmarkLine value={result.score} max={100} label={t('m29.fit.res.line')} lines={lines} />
          {ctx.enec_avg == null && <p className="mt-2 text-[12px] text-ink-3">{t('m29.fit.res.enecSuppressed')}</p>}
          <p className="mt-3 text-[13px] text-ink-2">{t(`m29.fit.bandText.${result.band}`)}</p>
        </Card>
        <Card title={t('m29.fit.res.areas')} eyebrow={t('m29.fit.res.areasEyebrow')}>
          <BarChart title={t('m29.fit.res.areas')} max={3}
            data={d.areas.map((a: Row) => ({ label: pick(a, 'name'), value: Number(result.area_levels[a.id] ?? 0), tone: Number(result.area_levels[a.id] ?? 0) >= 2 ? 'ok' : 'info' }))} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m29.fit.res.levelsKey')}</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.fit.res.evidence')} eyebrow={t('m29.fit.res.evidenceEyebrow', { cap: f.num(EVIDENCE_CAP) })}>
          {result.evidence.length ? (
            <ul className="space-y-1.5 text-[13px]" data-testid="m29-fit-evidence">
              {result.evidence.map((e) => (
                <li key={e.skill_id} className="flex items-center justify-between gap-2" data-level={e.level}>
                  <span>{skillName(e.skill_id)}</span>
                  <span className="num text-ink-2">{t('m29.fit.res.level', { level: f.num(e.level) })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-ink-3">{t('m29.fit.res.noEvidence')}</p>}
          <p className="mt-2 text-[12px] text-ink-3">{t('m29.fit.res.evidenceNote')}</p>
          <L to="/my/skills" className="mt-2 inline-block text-[13px]">{t('m29.fit.res.toPassport')}</L>
        </Card>
        <Card title={t('m29.fit.trend.title')} eyebrow={t('m29.fit.trend.eyebrow')}>
          {done.length > 1 ? (
            <LineChart title={t('m29.fit.trend.title')} yMin={0} yMax={100}
              series={[{ name: t('m29.fit.trend.mine'), points: done.map((a) => ({ x: a.period, y: Number(a.score) })) },
                ...(ctx.role_target != null ? [{ name: t('m29.fit.res.roleTarget'), points: done.map((a) => ({ x: a.period, y: ctx.role_target })), dashed: true, tone: 'ok' }] : [])]} />
          ) : <p className="text-[13px] text-ink-3">{t('m29.fit.trend.one')}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2" data-testid="m29-fit-history">
            {done.slice(-3).map((a) => <StatTile key={a.id} label={a.period} value={f.num(a.score)} sub={t(`m29.band.${a.band}`)} tone={isAboveBasic(a.band) ? 'ok' : 'info'} />)}
          </div>
        </Card>
      </div>
    </Section>
  );
}
