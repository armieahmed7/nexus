// FS37 /my/ai-fluency/drills/:id (ai_literacy Own): one sandbox drill. Step 1: compare the AI-styled summary (SIMULATED output) with
// the synthetic controlled procedure and flag every wrong segment with the kind of error. Step 2: the challenge protocol. Step 3: submit
// (ConfirmDialog; rpc.submitDrill scores server-side against the key the browser never sees) and read the result: score against the pass
// mark, found and missed errors with explanations, the protocol feedback, "Why this?" reasons and the evidence written (level <= 2).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, Callout, EmptyState, BenchmarkChips, BenchmarkLine, ConfirmDialog, Stepper, StatusPill, WhyThis, ProgressRing, Icon } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { ERROR_KINDS, LEVEL2_PCT, type Answer, type Flag } from './drills';
import type { DrillResult } from './backend/rpc';
import { Difficulty } from './fs36ui';
import { useDrills } from './DrillsPage';
import type { Row } from './ui';

export default function DrillPage() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const s = useSession();
  const q = useDrills(s.identity.personId);
  return (
    <Async state={q} isEmpty={() => false}>{(d) => {
      const drill = d.drills.find((x) => x.id === id);
      return (
        <Page title={drill ? pick(drill, 'title') : t('m29.routes.my-ai-drill.title')} intro={drill ? pick(drill, 'scenario') : undefined} wide eyebrow={<BenchmarkChips feature="FS37" />}
          actions={<L to="/my/ai-fluency/drills" className="btn-outline btn-sm no-underline" data-testid="m29-drill-back">{t('m29.drill.back')}</L>}>
          {drill ? <Player key={drill.id} drill={drill} attempts={d.attempts.filter((a) => a.drill_id === drill.id)} /> : <EmptyState title={t('m29.drill.notFound')} />}
        </Page>
      );
    }}</Async>
  );
}

function Player({ drill, attempts }: { drill: Row; attempts: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const [step, setStep] = useState(0);
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<DrillResult | null>(null);
  const segs: Row[] = drill.output?.segments ?? [];
  const protocol: Row[] = drill.protocol ?? [];
  const reset = () => { setFlags({}); setAnswers({}); setResult(null); setStep(0); setOpen(null); };
  const submit = async () => {
    const fl: Flag[] = segs.filter((sg) => flags[sg.id]).map((sg) => ({ segment_id: sg.id, kind: flags[sg.id] }));
    const an: Answer[] = protocol.map((p) => ({ id: p.id, choice: answers[p.id] ?? -1 }));
    const r = await act(() => repo.rpc.submitDrill({ drill_id: drill.id, flags: fl, answers: an }));
    setConfirm(false);
    if (r.ok && r.data) { setResult(r.data); setStep(2); }
  };
  const allAnswered = protocol.every((p) => answers[p.id] != null);
  const unkinded = Object.values(flags).some((k) => !k);
  const steps = [{ id: 'compare', label: t('m29.drill.step.compare') }, { id: 'protocol', label: t('m29.drill.step.protocol') }, { id: 'result', label: t('m29.drill.step.result') }];

  return (
    <div className="space-y-5" data-testid="m29-drill" data-id={drill.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Stepper steps={steps} current={step} />
        <span className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3"><Difficulty n={Number(drill.difficulty)} /> {t('m29.dr.upTo', { n: f.num(Number(drill.level)) })} · {t('m29.dr.minutes', { n: f.num(Number(drill.est_minutes)) })}
          {attempts.length > 0 && <> · {t('m29.drill.attempts', { n: f.num(attempts.length) })}</>}</span>
      </div>

      {step === 0 && (
        <>
          <Callout tone="sim" title={t('m29.drill.task.title')}>{t('m29.drill.task.body')}</Callout>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={<span className="flex flex-wrap items-center gap-2">{t('m29.drill.doc')} <StatusPill tone="sim">{t('m29.drill.syntheticChip')}</StatusPill></span>}
              eyebrow={`${drill.doc?.code} · ${t('m29.drill.rev', { r: drill.doc?.revision })}`}>
              <div className="relative" data-testid="m29-drill-doc" data-synthetic="true">
                {/* Decorative watermark (WCAG 1.4.3 exempts it): drawn from data-wm by CSS so it is not page text; the chip above says it in words. */}
                <span className="pointer-events-none absolute inset-0 grid select-none place-items-center text-[40px] font-bold uppercase tracking-widest text-ink-3 opacity-[0.07] before:content-[attr(data-wm)]" aria-hidden="true" data-wm={t('m29.drill.syntheticChip')} />
                <p className="mb-2 text-[13px] font-semibold">{pick(drill.doc, 'title')}</p>
                <ol className="space-y-1.5 text-[13px]">
                  {(drill.doc?.steps ?? []).map((st: Row) => <li key={st.n} className="flex gap-2"><span className="num w-5 shrink-0 text-ink-3">{f.num(st.n)}.</span><span>{lang === 'ar' ? st.text_ar : st.text_en}</span></li>)}
                </ol>
              </div>
            </Card>
            <Card title={<span className="flex flex-wrap items-center gap-2"><Icon name="sparkle" size={14} className="text-accent" /> {pick(drill.output, 'tool')}</span>} eyebrow={t('m29.drill.outputEyebrow')}>
              <ul className="space-y-2" data-testid="m29-drill-output">
                {segs.map((sg) => {
                  const k = flags[sg.id];
                  const flagged = sg.id in flags;
                  return (
                    <li key={sg.id} className={`rounded-md border p-2 text-[13px] ${flagged ? 'border-[rgb(var(--bad))] bg-bad-bg' : 'border-line bg-panel'}`} data-testid="m29-drill-seg" data-seg={sg.id} data-flagged={flagged ? 'yes' : 'no'}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">{lang === 'ar' ? sg.text_ar : sg.text_en}</span>
                        <button type="button" className={flagged ? 'btn-ghost btn-sm' : 'btn-outline btn-sm'} aria-pressed={flagged} data-testid="m29-drill-flag"
                          onClick={() => { if (flagged) { const n = { ...flags }; delete n[sg.id]; setFlags(n); setOpen(null); } else { setFlags({ ...flags, [sg.id]: '' }); setOpen(sg.id); } }}>
                          {flagged ? t('m29.drill.unflag') : t('m29.drill.flag')}
                        </button>
                      </div>
                      {flagged && (
                        <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label={t('m29.drill.kindQ')}>
                          {(open === sg.id || !k) && <span className="me-1 text-[12px] text-ink-3">{t('m29.drill.kindQ')}</span>}
                          {ERROR_KINDS.map((kind) => (
                            <button key={kind} type="button" role="radio" aria-checked={k === kind} className={`chip normal-case tracking-normal ${k === kind ? 'border-transparent bg-[rgb(var(--bad))] text-white' : 'border-line bg-panel text-ink-2'}`}
                              data-testid={`m29-drill-kind-${kind}`} onClick={() => { setFlags({ ...flags, [sg.id]: kind }); setOpen(null); }}>{t(`m29.dr.kind.${kind}`)}</button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[12px] text-ink-3">{t('m29.drill.flagged', { n: f.num(Object.keys(flags).length) })}</p>
            </Card>
          </div>
          {unkinded && <p className="text-[12.5px] text-bad" role="status">{t('m29.drill.needKind')}</p>}
          <div className="flex justify-end"><button type="button" className="btn-primary" disabled={unkinded} data-testid="m29-drill-next" onClick={() => setStep(1)}>{t('m29.drill.toProtocol')}</button></div>
        </>
      )}

      {step === 1 && (
        <>
          <Callout tone="info" title={t('m29.drill.protocol.title')}>{t('m29.drill.protocol.body')}</Callout>
          <ol className="space-y-3" data-testid="m29-drill-protocol">
            {protocol.map((p, i) => (
              <li key={p.id} className="card p-4">
                <fieldset>
                  <legend className="mb-2 text-[14px] font-semibold"><span className="num text-ink-3">{f.num(i + 1)}.</span> {pick(p, 'q')}</legend>
                  <div className="space-y-1.5">
                    {(p.options ?? []).map((o: Row, k: number) => (
                      <label key={k} className="flex cursor-pointer items-start gap-2 text-[13px]">
                        <input type="radio" name={`p-${p.id}`} checked={answers[p.id] === k} onChange={() => setAnswers({ ...answers, [p.id]: k })} data-testid={`m29-drill-opt-${p.id}-${k}`} />
                        <span>{lang === 'ar' ? o.ar : o.en}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn-outline" onClick={() => setStep(0)}>{t('m29.drill.backCompare')}</button>
            <button type="button" className="btn-primary" disabled={!allAnswered} data-testid="m29-drill-submit" onClick={() => setConfirm(true)}>{t('m29.drill.submit')}</button>
          </div>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m29.drill.confirm.title')} consequence={t('m29.drill.confirm.body', { n: f.num(Object.keys(flags).length) })} onConfirm={submit} />
        </>
      )}

      {step === 2 && result && <Result drill={drill} r={result} onRetake={reset} />}
    </div>
  );
}

function Result({ drill, r, onRetake }: { drill: Row; r: DrillResult; onRetake: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const segText = (id: string) => { const sg = (drill.output?.segments ?? []).find((x: Row) => x.id === id); return sg ? (lang === 'ar' ? sg.text_ar : sg.text_en) : id; };
  const passMark = Number(r.pass_pct);
  return (
    <div className="space-y-4" data-testid="m29-drill-result" data-passed={r.passed ? 'yes' : 'no'} data-level={r.level} data-pct={r.pct}>
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing value={r.pct} size={84} label={f.pct(r.pct, 0)} tone={r.passed ? 'ok' : 'accent'} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[18px] font-semibold">{r.passed ? t('m29.drill.res.passed', { n: f.num(r.level) }) : t('m29.drill.res.notYet')}</p>
            <p className="text-[13px] text-ink-2">{t('m29.drill.res.summary', { found: f.num(r.found), errors: f.num(r.errors), right: f.num(r.protocol_right), total: f.num(r.protocol_total), false: f.num(r.false_flags) })}</p>
            <WhyThis reasons={r.reasons} testId="m29-drill-why" />
          </div>
          <div className="w-full sm:w-72">
            <BenchmarkLine value={r.pct} max={100} unit="pct" label={t('m29.drill.res.line')}
              lines={[{ kind: 'target', label: t('m29.drill.res.passMark', { pct: f.pct(passMark, 0) }), value: passMark }, { kind: 'enec', label: t('m29.drill.res.l2', { pct: f.pct(LEVEL2_PCT, 0) }), value: LEVEL2_PCT }]} />
          </div>
        </div>
      </Card>
      {!r.critical_ok && <Callout tone="bad" title={t('m29.drill.res.criticalTitle')}>{t('m29.drill.res.critical')}</Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.drill.res.errors')}>
          <ul className="space-y-2" data-testid="m29-drill-res-errors">
            {r.feedback.errors.map((e) => (
              <li key={e.segment_id} className="rounded-md border border-line p-2 text-[13px]" data-found={e.found ? 'yes' : 'no'}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={e.found ? (e.kind_right ? 'ok' : 'info') : 'bad'}>{e.found ? (e.kind_right ? t('m29.drill.res.foundRight') : t('m29.drill.res.foundKind')) : t('m29.drill.res.missed')}</StatusPill>
                  <span className="chip border-line bg-panel normal-case tracking-normal text-ink-2">{t(`m29.dr.kind.${e.kind}`)}</span>
                  {e.step_n != null && <span className="text-[12px] text-ink-3">{t('m29.drill.res.step', { n: f.num(e.step_n) })}</span>}
                </div>
                <p className="mt-1 italic text-ink-2">“{segText(e.segment_id)}”</p>
                <p className="mt-1">{lang === 'ar' ? e.explain_ar : e.explain_en}</p>
              </li>
            ))}
            {r.feedback.false_flags.map((id) => (
              <li key={id} className="rounded-md border border-line p-2 text-[13px]" data-false="yes">
                <StatusPill tone="sim">{t('m29.drill.res.falseFlag')}</StatusPill>
                <p className="mt-1 italic text-ink-2">“{segText(id)}”</p>
                <p className="mt-1 text-ink-3">{t('m29.drill.res.falseHelp')}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t('m29.drill.res.protocol')}>
          <ul className="space-y-2" data-testid="m29-drill-res-protocol">
            {r.feedback.protocol.map((p) => {
              const st = (drill.protocol ?? []).find((x: Row) => x.id === p.id);
              const opt = (k: number) => { const o = st?.options?.[k]; return o ? (lang === 'ar' ? o.ar : o.en) : '—'; };
              return (
                <li key={p.id} className="rounded-md border border-line p-2 text-[13px]" data-right={p.right ? 'yes' : 'no'}>
                  <div className="flex flex-wrap items-center gap-2"><StatusPill tone={p.right ? 'ok' : 'bad'}>{p.right ? t('m29.drill.res.right') : t('m29.drill.res.wrong')}</StatusPill>{p.critical && <StatusPill tone="accent">{t('m29.drill.res.criticalChip')}</StatusPill>}</div>
                  <p className="mt-1 font-semibold">{st ? pick(st, 'q') : p.id}</p>
                  {!p.right && <p className="mt-1 text-ink-2">{t('m29.drill.res.yours', { a: opt(p.choice) })}</p>}
                  <p className="mt-1">{t('m29.drill.res.best', { a: opt(p.correct) })}</p>
                  <p className="mt-1 text-ink-3">{lang === 'ar' ? p.explain_ar : p.explain_en}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <Card title={t('m29.drill.res.evidence')}>
        {r.evidence.length ? (
          <p className="text-[13px]" data-testid="m29-drill-evidence" data-level={r.evidence[0].level}>{t('m29.drill.res.evidenceWritten', { n: f.num(r.evidence[0].level) })} <L to="/my/ai-fluency">{t('m29.drill.res.toFluency')}</L></p>
        ) : <p className="text-[13px] text-ink-2" data-testid="m29-drill-evidence" data-level="0">{t('m29.drill.res.noEvidence')}</p>}
      </Card>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" data-testid="m29-drill-retake" onClick={onRetake}>{t('m29.dr.retake')}</button>
        <L to="/my/ai-fluency/drills" className="btn-primary no-underline">{t('m29.drill.res.more')}</L>
      </div>
    </div>
  );
}
