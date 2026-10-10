// FS26 /my/core-skills/practice (skills_profile Own): situational judgement practice for the core skills. A set of up to 8 plant scenarios,
// mixed or for one core skill; for each I choose what I would do, then see the expert's rating of every response, why, and the expert
// rationale in my language (the key stays on the server until I answer: rpc.startSjt / rpc.submitSjt; SQL kafaa_sjt_* = sjt.ts).
// The result shows my score beside the ENEC average (suppressed under 10), the strongest skill and the one to develop (<WhyThis>), and my
// trend over time. Development only: it never gates anything, never writes skill evidence, never reaches talent review. No points,
// streaks, badges or leaderboards.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, WhyThis, BenchmarkChips, BenchmarkLine, BarChart, LineChart, ProgressBar, SelectField, DataTable, Icon, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { MAX_EFF, scorePct, windowQuarters } from './sjt';
import { todayIso } from '../../domain/rules';
import type { SjtContext, SjtResult, SjtStep } from './backend/rpc';
import { useCoreName, useM33Ref, type M33Ref, type Row } from './ui';

function usePractice(personId: string | null) {
  const repo = useRepo();
  return useQuery(['sjt_attempts'], async () => {
    const [ctx, attempts] = await Promise.all([
      repo.rpc.sjtContext(),
      repo.list('sjt_attempts' as never, { filter: { person_id: personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { ctx, attempts: (attempts as Row[]).sort((a, b) => String(a.started_at).localeCompare(String(b.started_at))) };
  }, [personId]);
}

export default function PracticePage() {
  const t = useT();
  const s = useSession();
  const ref = useM33Ref();
  const q = usePractice(s.identity.personId);
  return (
    <Page title={t('m33.routes.my-core-practice.title')} intro={t('m33.sjt.intro')} wide eyebrow={<BenchmarkChips feature="FS26" />}
      actions={<L to="/my/core-skills" className="btn-outline btn-sm no-underline" data-testid="m33-sjt-to-mine"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m33.sjt.toMine')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => (c.ctx ? <Practice d={d} ctx={c.ctx} attempts={c.attempts} reload={q.reload} /> : <EmptyState title={t('m33.sjt.none')} />)}</Async>}</Async>
    </Page>
  );
}

const EFF_TONE = ['border-bad-line bg-bad-bg', 'border-sim-line bg-sim-bg', 'border-info-line bg-info-bg', 'border-ok-line bg-ok-bg'];
const EFF_TEXT = ['text-bad', 'text-sim', 'text-info', 'text-ok'];

function Practice({ d, ctx, attempts, reload }: { d: M33Ref; ctx: SjtContext; attempts: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const coreName = useCoreName(d);
  const [params] = useSearchParams();
  const [focus, setFocus] = useState<string>(params.get('skill') ?? '');
  const [step, setStep] = useState<SjtStep | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<{ step: SjtStep; item: Row } | null>(null);
  const done = attempts.filter((a) => a.status === 'completed');

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = await repo.rpc.startSjt({ core_skill_id: focus || null });
      if (r.ok && r.data) { setStep(r.data); setChoice(''); setAnswered(null); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (!step?.item || choice === '') return;
    setBusy(true); setError(null);
    const item = step.item;
    try {
      const r = await repo.rpc.submitSjt({ attempt_id: step.attempt_id, item_id: item.id, choice: Number(choice) });
      if (r.ok && r.data) { setAnswered({ step: r.data, item }); setChoice(''); if (r.data.done) reload?.(); } else setError(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const next = () => { if (answered) { setStep(answered.step); setAnswered(null); } };

  // ── feedback on the item just answered
  if (answered && answered.step.feedback) {
    const fb = answered.step.feedback;
    const it = answered.item;
    const opts: string[] = lang === 'ar' ? it.options_ar : it.options_en;
    const notes: string[] = lang === 'ar' ? fb.notes_ar : fb.notes_en;
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="m33-sjt-feedback" data-eff={fb.eff}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12.5px] text-ink-2">
            <span>{t('m33.sjt.q.progress', { n: f.num(answered.step.answered), max: f.num(answered.step.total) })}</span>
            <span className="chip border-line bg-panel normal-case tracking-normal">{coreName(it.core_skill_id)}</span>
          </div>
          <ProgressBar value={Math.round((100 * answered.step.answered) / Math.max(1, answered.step.total))} label={t('m33.sjt.q.progressLabel')} />
        </div>
        <Card title={<span className={EFF_TEXT[fb.eff]} data-testid="m33-sjt-verdict">{t(`m33.sjt.verdict.${fb.eff}`)}</span>} eyebrow={t('m33.sjt.fb.eyebrow')}>
          <p className="mb-3 text-[14px] text-ink-2">{pick(it, 'stem')}</p>
          <ol className="space-y-2" data-testid="m33-sjt-key">
            {opts.map((o, i) => (
              <li key={i} className={`rounded-card border p-3 text-[13.5px] ${EFF_TONE[fb.key[i]]} ${i === fb.choice ? 'ring-2 ring-[rgb(var(--accent))]' : ''}`} data-eff={fb.key[i]} data-mine={i === fb.choice ? 'yes' : 'no'}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 font-semibold text-ink">{o}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {i === fb.choice && <span className="caps text-[10.5px] text-accent">{t('m33.sjt.fb.yours')}</span>}
                    <span className={`caps text-[10.5px] ${EFF_TEXT[fb.key[i]]}`}>{t(`m33.sjt.eff.${fb.key[i]}`)}</span>
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-2">{notes[i]}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-card border border-line bg-sunken p-3" data-testid="m33-sjt-rationale">
            <h3 className="caps mb-1">{t('m33.sjt.fb.rationale')}</h3>
            <p className="text-[13.5px]">{lang === 'ar' ? fb.rationale_ar : fb.rationale_en}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={next} data-testid="m33-sjt-continue">{answered.step.done ? t('m33.sjt.fb.result') : t('m33.sjt.fb.next')}</button>
          </div>
        </Card>
      </div>
    );
  }

  // ── a question
  if (step && !step.done && step.item) {
    const it = step.item;
    const opts = lang === 'ar' && it.options_ar?.length ? it.options_ar : it.options_en;
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="m33-sjt-question" data-item={it.id}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12.5px] text-ink-2">
            <span>{t('m33.sjt.q.progress', { n: f.num(step.answered + 1), max: f.num(step.total) })}</span>
            <span className="chip border-line bg-panel normal-case tracking-normal">{coreName(it.core_skill_id)} · {t(`m33.theme.${it.theme}`)}</span>
          </div>
          <ProgressBar value={Math.round((100 * step.answered) / Math.max(1, step.total))} label={t('m33.sjt.q.progressLabel')} />
        </div>
        <Card>
          <fieldset>
            <legend className="mb-1 text-[16px] font-semibold leading-snug">{pick(it as unknown as Row, 'stem')}</legend>
            <p className="mb-3 text-[12.5px] text-ink-3">{t('m33.sjt.q.ask')}</p>
            <div className="space-y-2" role="radiogroup">
              {opts.map((o, i) => (
                <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 text-[14px] ${choice === String(i) ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}>
                  <input type="radio" name="m33-sjt-choice" value={String(i)} checked={choice === String(i)} onChange={() => setChoice(String(i))} className="mt-1" data-testid={`m33-sjt-opt-${i}`} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-ink-3">{t('m33.sjt.q.noKey')}</span>
            <button type="button" className="btn-primary" disabled={choice === '' || busy} onClick={submit} data-testid="m33-sjt-submit">{t('m33.sjt.q.submit')}</button>
          </div>
        </Card>
        <div aria-live="polite">{error && <Callout tone="bad" title={t('m33.sjt.error')}>{error}</Callout>}</div>
      </div>
    );
  }

  const justDone = step?.done && step.result ? step.result : null;
  const latest = done[done.length - 1];
  const result: SjtResult | null = justDone ?? (latest ? { attempt_id: latest.id, period: latest.period, score: Number(latest.score), by_skill: latest.by_skill ?? {}, reasons: latest.reasons ?? [], item_count: (latest.responses ?? []).length } : null);
  const open = attempts.find((a) => a.status === 'in_progress');
  const bankTotal = ctx.bank.reduce((n, b) => n + b.items, 0);
  return (
    <div className="space-y-6">
      {justDone && <Callout tone="ok" title={t('m33.sjt.doneTitle')}>{t('m33.sjt.doneBody', { n: f.num(justDone.item_count) })}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card eyebrow={t('m33.sjt.start.eyebrow', { n: f.num(bankTotal) })} title={t('m33.sjt.start.title')}>
          <ul className="space-y-1.5 text-[13.5px] text-ink-2" data-testid="m33-sjt-about">
            {['b1', 'b2', 'b3', 'b4'].map((k) => <li key={k} className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />{t(`m33.sjt.start.${k}`)}</li>)}
          </ul>
          <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <SelectField name="focus" label={t('m33.sjt.start.focus')} value={focus} onChange={setFocus}
              options={[{ value: '', label: t('m33.sjt.start.mixed') }, ...ctx.bank.filter((b) => b.items > 0).map((b) => ({ value: b.core_skill_id, label: `${coreName(b.core_skill_id)} (${f.num(b.items)})` }))]} />
            <button type="button" className="btn-primary" onClick={start} disabled={busy} data-testid="m33-sjt-start">{open || ctx.in_progress ? t('m33.sjt.start.resume') : t('m33.sjt.start.go')}</button>
          </div>
          <div aria-live="polite" className="mt-3">{error && <Callout tone="bad" title={t('m33.sjt.error')}>{error}</Callout>}</div>
        </Card>
        <Card title={t('m33.sjt.scale.title')} eyebrow={t('m33.sjt.scale.eyebrow')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m33-sjt-scale">
            {[3, 2, 1, 0].map((e) => (
              <li key={e} className={`flex items-start gap-2 rounded-md border px-2 py-1.5 ${EFF_TONE[e]}`}>
                <span className={`caps w-28 shrink-0 text-[10.5px] ${EFF_TEXT[e]}`}>{t(`m33.sjt.eff.${e}`)}</span>
                <span className="text-ink-2">{t(`m33.sjt.effSub.${e}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{t('m33.sjt.scale.note', { max: f.num(MAX_EFF) })}</p>
        </Card>
      </div>

      {result ? <Result d={d} ctx={ctx} result={result} done={done} /> : <EmptyState title={t('m33.sjt.noResult')}>{t('m33.sjt.noResultBody')}</EmptyState>}
      <Callout tone="info" title={t('m33.sjt.private.title')}>{t('m33.sjt.private.body')}</Callout>
    </div>
  );
}

function Result({ d, ctx, result, done }: { d: M33Ref; ctx: SjtContext; result: SjtResult; done: Row[] }) {
  const t = useT();
  const f = useFormat();
  const coreName = useCoreName(d);
  const lines = ctx.enec_avg != null ? [{ kind: 'enec' as const, label: t('m33.sjt.res.enec', { n: f.num(ctx.enec_n ?? 0) }), value: ctx.enec_avg }] : [];
  const win = windowQuarters(todayIso());
  const trend = win.map((q) => {
    const xs = done.filter((a) => a.period === q);
    const n = xs.reduce((s, a) => s + Object.values(a.by_skill ?? {}).reduce((x: number, v: Row) => x + Number(v.n), 0), 0);
    const sum = xs.reduce((s, a) => s + Object.values(a.by_skill ?? {}).reduce((x: number, v: Row) => x + Number(v.sum), 0), 0);
    return { x: q, y: n ? scorePct(sum, n) : null };
  });
  const bySkill = Object.entries(result.by_skill).map(([id, v]) => ({ label: coreName(id), value: scorePct(v.sum, v.n), tone: scorePct(v.sum, v.n) >= 67 ? 'ok' : 'info' }));
  const cols: Column<Row>[] = [
    { key: 'when', header: t('m33.sjt.hist.when'), value: (a) => String(a.completed_at ?? a.started_at), render: (a) => f.date(String(a.completed_at ?? a.started_at).slice(0, 10)), sortable: true },
    { key: 'set', header: t('m33.sjt.hist.set'), value: (a) => (a.core_skill_id ? coreName(a.core_skill_id) : t('m33.sjt.start.mixed')) },
    { key: 'items', header: t('m33.sjt.hist.items'), align: 'end', value: (a) => (a.responses ?? []).length, render: (a) => <span className="num">{f.num((a.responses ?? []).length)}</span> },
    { key: 'score', header: t('m33.sjt.hist.score'), align: 'end', value: (a) => Number(a.score), render: (a) => <span className="num font-semibold">{f.num(Number(a.score))}%</span>, sortable: true },
  ];
  return (
    <Section title={t('m33.sjt.res.title', { period: result.period })} description={t('m33.sjt.res.intro')}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={<span className="flex flex-wrap items-center gap-2" data-testid="m33-sjt-result" data-score={result.score}>
          <span className="num text-[28px] font-semibold">{f.num(result.score)}%</span><span className="text-ink-3">{t('m33.sjt.res.items', { n: f.num(result.item_count) })}</span></span>}
          actions={<WhyThis reasons={result.reasons} testId="m33-sjt-why" />}>
          <BenchmarkLine value={result.score} max={100} unit="pct" label={t('m33.sjt.res.line')} lines={lines} />
          {ctx.enec_avg == null && <p className="mt-2 text-[12px] text-ink-3">{t('m33.sjt.res.enecSuppressed')}</p>}
          <p className="mt-3 text-[13px] text-ink-2">{t('m33.sjt.res.meaning')}</p>
        </Card>
        <Card title={t('m33.sjt.res.bySkill')} eyebrow={t('m33.sjt.res.bySkillEyebrow')}>
          {bySkill.length ? <BarChart title={t('m33.sjt.res.bySkill')} data={bySkill} max={100} unit="%" /> : <p className="text-[13px] text-ink-3">—</p>}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title={t('m33.sjt.trend.title')} eyebrow={t('m33.sjt.trend.eyebrow')}>
          {trend.filter((x) => x.y != null).length > 1
            ? <LineChart title={t('m33.sjt.trend.title')} yMin={0} yMax={100} unit="%" series={[{ name: t('m33.sjt.trend.mine'), points: trend },
              ...(ctx.enec_avg != null ? [{ name: t('m33.sjt.res.enecShort'), points: trend.map((p) => ({ x: p.x, y: ctx.enec_avg })), dashed: true, tone: 'info' }] : [])]} />
            : <p className="text-[13px] text-ink-3">{t('m33.sjt.trend.one')}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2" data-testid="m33-sjt-tiles">
            <StatTile label={t('m33.sjt.trend.sets')} value={f.num(done.length)} />
            <StatTile label={t('m33.sjt.trend.first')} value={done.length ? `${f.num(Number(done[0].score))}%` : '—'} />
            <StatTile label={t('m33.sjt.trend.latest')} value={done.length ? `${f.num(Number(done[done.length - 1].score))}%` : '—'} tone="ok" />
          </div>
        </Card>
        <Card title={t('m33.sjt.hist.title')}>
          <div data-testid="m33-sjt-history">
            <DataTable rows={[...done].reverse()} columns={cols} rowKey={(a) => a.id} searchable={false} pageSize={8} caption={t('m33.sjt.hist.title')} dense />
          </div>
        </Card>
      </div>
    </Section>
  );
}
