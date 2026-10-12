// FS40 /my/twin-drills/:id (skills_profile Own): one digital-twin diagnosis drill. Step 1: read the SIMULATED trends against the
// model band and spend the check budget (each check reveals its synthetic result). Step 2: name the degrading component and its failure
// mode. Step 3: choose a conservative action and up to three reasons. Submit (ConfirmDialog; rpc.submitTwinDrill scores server-side
// against the key the browser never sees) and read the result: score against the pass mark, each check, the diagnosis and action with
// explanations, "Why this?" reasons and the evidence written (level <= 2).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, Callout, EmptyState, BenchmarkChips, BenchmarkLine, ConfirmDialog, Stepper, StatusPill, WhyThis, ProgressRing, SimChip, Icon } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { LEVEL2_PCT, type Series, type Signal } from './twin';
import type { TwinResult } from './backend/rpc';
import { Dots, useTwins } from './TwinDrillsPage';
import type { Row } from './ui';

export default function TwinDrillPage() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const s = useSession();
  const q = useTwins(s.identity.personId);
  return (
    <Async state={q}>{(d) => {
      const sc = d.scenarios.find((x) => x.id === id);
      return (
        <Page title={sc ? pick(sc, 'title') : t('m31.routes.my-twin-drill.title')} intro={sc ? pick(sc, 'scenario') : undefined} wide eyebrow={<span className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><SimChip /><BenchmarkChips feature="FS40" /></span>}
          actions={<L to="/my/twin-drills" className="btn-outline btn-sm no-underline" data-testid="m31-twd-back">{t('m31.twd.back')}</L>}>
          {sc ? <Player key={sc.id} sc={sc} attempts={d.attempts.filter((a) => a.scenario_id === sc.id)} skills={d.skills} /> : <EmptyState title={t('m31.twd.notFound')} />}
        </Page>
      );
    }}</Async>
  );
}

function Player({ sc, attempts, skills }: { sc: Row; attempts: Row[]; skills: Map<string, Row> }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<string[]>([]);
  const [component, setComponent] = useState('');
  const [mode, setMode] = useState('');
  const [action, setAction] = useState('');
  const [rats, setRats] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<TwinResult | null>(null);
  const tx = (o: Row | undefined, k = '') => (o ? (lang === 'ar' ? o[`${k}ar`] : o[`${k}en`]) : '');
  const max = Number(sc.max_checks);
  const reset = () => { setChecks([]); setComponent(''); setMode(''); setAction(''); setRats([]); setResult(null); setStep(0); };
  const submit = async () => {
    const r = await act(() => repo.rpc.submitTwinDrill({ scenario_id: sc.id, checks, component_id: component, mode_id: mode, action_id: action, rationale_ids: rats }));
    setConfirm(false);
    if (r.ok && r.data) { setResult(r.data); setStep(3); }
  };
  const steps = [{ id: 'investigate', label: t('m31.twd.step.investigate') }, { id: 'diagnose', label: t('m31.twd.step.diagnose') }, { id: 'act', label: t('m31.twd.step.act') }, { id: 'result', label: t('m31.twd.step.result') }];
  return (
    <div className="space-y-5" data-testid="m31-twd" data-id={sc.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Stepper steps={steps} current={step} />
        <span className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3"><Dots n={Number(sc.difficulty)} /> {t('m31.tw.upTo', { n: f.num(Number(sc.level)) })} · {t('m31.tw.minutes', { n: f.num(Number(sc.est_minutes)) })} · <span className="font-mono">{sc.code}</span>
          {attempts.length > 0 && <> · {t('m31.twd.attempts', { n: f.num(attempts.length) })}</>}</span>
      </div>
      {step === 0 && (
        <>
          <Callout tone="sim" title={tx(sc, 'system_')}>{t('m31.twd.task')}</Callout>
          <Card title={<span className="flex flex-wrap items-center gap-2">{t('m31.twd.trends')} <SimChip /></span>} eyebrow={t('m31.twd.trendsEyebrow')}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="m31-twd-trends">{(sc.series as Series).signals.map((g) => <Trend key={g.id} series={sc.series} g={g} />)}</div>
          </Card>
          <Card title={t('m31.twd.checks', { used: f.num(checks.length), max: f.num(max) })} eyebrow={t('m31.twd.checksEyebrow')}>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m31-twd-checks">
              {(sc.checks as Row[]).map((c) => {
                const ran = checks.includes(c.id);
                return (
                  <li key={c.id} className={`rounded-md border p-2.5 text-[13px] ${ran ? 'border-accent/40 bg-accent-soft' : 'border-line bg-panel'}`} data-check={c.id} data-ran={ran ? 'yes' : 'no'}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0"><span className="font-semibold">{tx(c)}</span> <span className="text-[12px] text-ink-3">{t('m31.twd.checkMinutes', { n: f.num(c.minutes) })}</span></span>
                      {ran ? <button type="button" className="btn-ghost btn-sm" onClick={() => setChecks(checks.filter((x) => x !== c.id))}>{t('m31.twd.undo')}</button>
                        : <button type="button" className="btn-outline btn-sm" disabled={checks.length >= max} onClick={() => setChecks([...checks, c.id])} data-testid="m31-twd-run">{t('m31.twd.run')}</button>}
                    </div>
                    {ran && <p className="mt-1.5 text-ink-2" data-testid="m31-twd-result">{tx(c, 'result_')}</p>}
                  </li>
                );
              })}
            </ul>
            {checks.length >= max && <p className="mt-2 text-[12.5px] text-ink-3" role="status">{t('m31.twd.budgetUsed')}</p>}
          </Card>
          <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setStep(1)} data-testid="m31-twd-next">{t('m31.twd.toDiagnose')}</button></div>
        </>
      )}
      {step === 1 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={t('m31.twd.componentQ')}><Choices name="component" opts={sc.components} value={component} onChange={setComponent} /></Card>
            <Card title={t('m31.twd.modeQ')}><Choices name="mode" opts={sc.modes} value={mode} onChange={setMode} /></Card>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn-outline" onClick={() => setStep(0)}>{t('m31.twd.backInvestigate')}</button>
            <button type="button" className="btn-primary" disabled={!component || !mode} onClick={() => setStep(2)} data-testid="m31-twd-next2">{t('m31.twd.toAct')}</button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <Callout tone="info" title={t('m31.twd.actTitle')}>{t('m31.twd.actBody')}</Callout>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={t('m31.twd.actionQ')}><Choices name="action" opts={sc.actions} value={action} onChange={setAction} /></Card>
            <Card title={t('m31.twd.rationaleQ', { n: 3 })}>
              <div className="space-y-1.5" data-testid="m31-twd-rationales">
                {(sc.rationales as Row[]).map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-start gap-2 text-[13px]">
                    <input type="checkbox" checked={rats.includes(r.id)} disabled={!rats.includes(r.id) && rats.length >= 3} onChange={(e) => setRats(e.target.checked ? [...rats, r.id] : rats.filter((x) => x !== r.id))} data-testid={`m31-twd-rat-${r.id}`} />
                    <span>{tx(r)}</span>
                  </label>
                ))}
              </div>
            </Card>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn-outline" onClick={() => setStep(1)}>{t('m31.twd.backDiagnose')}</button>
            <button type="button" className="btn-primary" disabled={!action || rats.length < 1} onClick={() => setConfirm(true)} data-testid="m31-twd-submit">{t('m31.twd.submit')}</button>
          </div>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m31.twd.confirmTitle')} onConfirm={submit}
            consequence={t('m31.twd.confirmBody', { checks: f.num(checks.length), component: tx((sc.components as Row[]).find((x) => x.id === component)), action: tx((sc.actions as Row[]).find((x) => x.id === action)) })} />
        </>
      )}
      {step === 3 && result && <Result sc={sc} r={result} skills={skills} onRetake={reset} />}
    </div>
  );
}

function Choices({ name, opts, value, onChange }: { name: string; opts: Row[]; value: string; onChange: (v: string) => void }) {
  const lang = useLang();
  return (
    <div className="space-y-1.5" role="radiogroup" data-testid={`m31-twd-${name}`}>
      {opts.map((o) => (
        <label key={o.id} className="flex cursor-pointer items-start gap-2 text-[13px]">
          <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} data-testid={`m31-twd-${name}-${o.id}`} />
          <span>{lang === 'ar' ? o.ar : o.en}</span>
        </label>
      ))}
    </div>
  );
}

/** One SIMULATED trend with the model band (shaded) and a screen-reader table. */
function Trend({ series, g }: { series: Series; g: Signal }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const W = 320; const H = 120; const P = 24;
  const lo = Math.min(g.band[0], ...g.values); const hi = Math.max(g.band[1], ...g.values);
  const span = Math.max(1e-6, hi - lo); const pad = span * 0.08;
  const y = (v: number) => H - P / 2 - ((v - (lo - pad)) / (span + 2 * pad)) * (H - P);
  const x = (i: number) => P + (i / Math.max(1, series.t.length - 1)) * (W - P - 6);
  const out = g.values.map((v, i) => (v < g.band[0] || v > g.band[1] ? i : -1)).filter((i) => i >= 0);
  const path = g.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const name = pick(g as unknown as Row, 'name');
  return (
    <figure className="min-w-0" data-signal={g.id} data-outside={out.length}>
      <figcaption className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[12.5px]"><span className="font-semibold">{name}</span><span className="text-ink-3">{g.unit} · {out.length ? t('m31.twd.outside', { n: f.num(out.length) }) : t('m31.twd.inside')}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('m31.twd.chartLabel', { name })} direction="ltr">
        <rect x={P} y={y(g.band[1])} width={W - P - 6} height={Math.max(1, y(g.band[0]) - y(g.band[1]))} fill="rgb(var(--ok))" opacity="0.12" />
        <line x1={P} x2={W - 6} y1={y(g.band[1])} y2={y(g.band[1])} stroke="rgb(var(--ok))" strokeDasharray="4 3" strokeWidth="1" />
        <line x1={P} x2={W - 6} y1={y(g.band[0])} y2={y(g.band[0])} stroke="rgb(var(--ok))" strokeDasharray="4 3" strokeWidth="1" />
        <path d={path} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" />
        {out.map((i) => <circle key={i} cx={x(i)} cy={y(g.values[i])} r="2.6" fill="rgb(var(--bad))" />)}
        <text x={P} y={H - 2} fontSize="9" fill="rgb(var(--ink-3))">{pick(series as unknown as Row, 't')} {series.t[0]}</text>
        <text x={W - 6} y={H - 2} fontSize="9" textAnchor="end" fill="rgb(var(--ink-3))">{series.t[series.t.length - 1]}</text>
        <text x={W - 8} y={12} fontSize="9" textAnchor="end" fontWeight="700" fill="rgb(var(--sim))">{t('common.simulated')}</text>
      </svg>
      <div className="sr-only"><table>
        <caption>{t('m31.twd.tableCaption', { name, lo: g.band[0], hi: g.band[1] })}</caption>
        <tbody>{g.values.map((v, i) => <tr key={i}><th scope="row">{series.t[i]}</th><td>{v}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}

function Result({ sc, r, skills, onRetake }: { sc: Row; r: TwinResult; skills: Map<string, Row>; onRetake: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const opt = (list: string, id: string) => { const o = ((sc[list] ?? []) as Row[]).find((x) => x.id === id); return o ? (lang === 'ar' ? o.ar : o.en) : id; };
  const ex = (k: string) => { const e = r.explain?.[k]; return e ? (lang === 'ar' ? e.ar : e.en) : ''; };
  const fb = r.feedback;
  return (
    <div className="space-y-4" data-testid="m31-twd-result" data-passed={r.passed ? 'yes' : 'no'} data-level={r.level} data-pct={r.pct}>
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing value={r.pct} size={84} label={f.pct(r.pct, 0)} tone={r.passed ? 'ok' : 'accent'} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[18px] font-semibold">{r.passed ? t('m31.twd.res.passed', { n: f.num(r.level) }) : t('m31.twd.res.notYet')}</p>
            <p className="text-[13px] text-ink-2">{t('m31.twd.res.summary', { points: f.num(r.points), max: f.num(r.max), useful: f.num(r.useful_found), total: f.num(r.useful_total), wasted: f.num(r.wasted) })}</p>
            <WhyThis reasons={r.reasons} testId="m31-twd-why" />
          </div>
          <div className="w-full sm:w-72">
            <BenchmarkLine value={r.pct} max={100} unit="pct" label={t('m31.twd.res.line')}
              lines={[{ kind: 'target', label: t('m31.twd.res.passMark', { pct: f.pct(r.pass_pct, 0) }), value: r.pass_pct }, { kind: 'enec', label: t('m31.twd.res.l2', { pct: f.pct(LEVEL2_PCT, 0) }), value: LEVEL2_PCT }]} />
          </div>
        </div>
      </Card>
      {!r.critical_ok && <Callout tone="bad" title={t('m31.twd.res.unsafeTitle')}><span data-testid="m31-twd-unsafe">{t('m31.twd.res.unsafe')}</span></Callout>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m31.twd.res.diagnosis')}>
          <ul className="space-y-2 text-[13px]" data-testid="m31-twd-res-diagnosis">
            <li data-right={fb.component.right ? 'yes' : 'no'}><StatusPill tone={fb.component.right ? 'ok' : 'bad'}>{fb.component.right ? t('m31.twd.res.right') : t('m31.twd.res.wrong')}</StatusPill> <span className="font-semibold">{t('m31.twd.res.component')}</span>: {opt('components', fb.component.chosen)}
              {!fb.component.right && <span className="text-ink-2"> · {t('m31.twd.res.correct', { a: opt('components', fb.component.correct) })}</span>}<p className="mt-1 text-ink-3">{ex('component')}</p></li>
            <li data-right={fb.mode.right ? 'yes' : 'no'}><StatusPill tone={fb.mode.right ? 'ok' : 'bad'}>{fb.mode.right ? t('m31.twd.res.right') : t('m31.twd.res.wrong')}</StatusPill> <span className="font-semibold">{t('m31.twd.res.mode')}</span>: {opt('modes', fb.mode.chosen)}
              {!fb.mode.right && <span className="text-ink-2"> · {t('m31.twd.res.correct', { a: opt('modes', fb.mode.correct) })}</span>}<p className="mt-1 text-ink-3">{ex('mode')}</p></li>
            <li data-verdict={fb.action.verdict}><StatusPill tone={fb.action.verdict === 'best' ? 'ok' : fb.action.verdict === 'conservative' ? 'info' : 'bad'}>{t(`m31.twd.res.action.${fb.action.verdict}`)}</StatusPill> <span className="font-semibold">{t('m31.twd.res.actionLabel')}</span>: {opt('actions', fb.action.chosen)}
              {fb.action.verdict !== 'best' && <span className="text-ink-2"> · {t('m31.twd.res.best', { a: opt('actions', fb.action.best) })}</span>}<p className="mt-1 text-ink-3">{ex('action')}</p></li>
          </ul>
        </Card>
        <Card title={t('m31.twd.res.checks')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m31-twd-res-checks">
            {fb.checks.map((c) => <li key={c.id} data-verdict={c.verdict}><StatusPill tone={c.verdict === 'useful' ? 'ok' : c.verdict === 'unsafe' ? 'bad' : 'sim'}>{t(`m31.twd.res.check.${c.verdict}`)}</StatusPill> {opt('checks', c.id)}</li>)}
            {fb.missed_checks.map((id) => <li key={id} data-verdict="missed"><StatusPill tone="info">{t('m31.twd.res.check.missed')}</StatusPill> {opt('checks', id)}</li>)}
            {fb.checks.length === 0 && fb.missed_checks.length === 0 && <li className="text-ink-3">{t('m31.twd.res.noChecks')}</li>}
          </ul>
          <div className="mt-3 border-t border-line pt-2">
            <div className="caps mb-1">{t('m31.twd.res.rationales')}</div>
            <ul className="space-y-1.5 text-[13px]" data-testid="m31-twd-res-rationales">
              {fb.rationales.map((x) => <li key={x.id} data-sound={x.sound ? 'yes' : 'no'}><StatusPill tone={x.sound ? 'ok' : 'bad'}>{x.sound ? t('m31.twd.res.sound') : t('m31.twd.res.unsound')}</StatusPill> {opt('rationales', x.id)}</li>)}
              {fb.missed_rationales.map((id) => <li key={id} data-sound="missed"><StatusPill tone="info">{t('m31.twd.res.missedReason')}</StatusPill> {opt('rationales', id)}</li>)}
            </ul>
          </div>
        </Card>
      </div>
      <Card title={t('m31.twd.res.evidence')}>
        {r.evidence.length ? (
          <div className="space-y-1 text-[13px]" data-testid="m31-twd-evidence" data-level={r.evidence[0].level}>
            <p>{t('m31.twd.res.evidenceWritten', { n: f.num(r.evidence[0].level) })}</p>
            <ul className="flex flex-wrap gap-1">{r.evidence.map((e) => <li key={e.skill_id}><L to={`/skills/${e.skill_id}`} className="chip border-accent/30 bg-accent-soft normal-case tracking-normal text-eyebrow no-underline">{skills.get(e.skill_id) ? pick(skills.get(e.skill_id), 'name') : e.skill_id}</L></li>)}</ul>
          </div>
        ) : <p className="text-[13px] text-ink-2" data-testid="m31-twd-evidence" data-level="0">{t('m31.twd.res.noEvidence')}</p>}
      </Card>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" data-testid="m31-twd-retake" onClick={onRetake}><Icon name="reset" size={14} /> {t('m31.tw.retake')}</button>
        <L to="/my/twin-drills" className="btn-primary no-underline">{t('m31.twd.res.more')}</L>
      </div>
    </div>
  );
}
