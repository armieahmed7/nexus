// FS39 /learn/plant-literacy (signed in): a browser plant explainer. A schematic of how heat becomes steam and electricity and how the
// three fundamental safety functions (control the reaction, cool the fuel, contain radioactivity) work, with four guided what-if
// scenarios (normal operation, turbine trip, loss of offsite power, a passive design) and a short check question on some steps.
// Static content bundled with the page (plantModel.ts): no fetch, no RPC, no storage while you walk through it (a unit test spies on
// all of them). Every value is an illustrative index (SIMULATED), never a plant parameter, and every screen carries the SIMULATED chip.
import { useState } from 'react';
import { Page, Card, Callout, Stepper, StatusPill, SimChip, BenchmarkChips, Icon } from '../../ui';
import { L, useFormat, useLang, useT } from '../../i18n';
import { SCENARIOS, lvl, quizScore, stepAt, type PlantState, type SafetyFns, type Scenario } from './plantModel';
import { SimNote } from './ui';

export default function PlantLiteracyPage() {
  const t = useT();
  const [scenario, setScenario] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const score = quizScore(answers);
  return (
    <Page title={t('m31.routes.learn-plant-literacy.title')} intro={t('m31.pl.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip /><BenchmarkChips feature="FS39" /></span>}
      actions={<L to="/my/plant-log" className="btn-outline btn-sm no-underline" data-testid="m31-pl-to-log">{t('m31.pl.toLog')}</L>}>
      <div className="space-y-5" data-testid="m31-pl" data-offline="true">
        <Callout tone="sim" title={t('m31.pl.simTitle')}><span data-testid="m31-pl-sim">{t('m31.pl.simBody')}</span></Callout>
        {scenario ? <Player key={scenario} id={scenario} answers={answers} setAnswers={setAnswers} onExit={() => setScenario(null)} /> : <Picker onPick={setScenario} />}
        {score.asked > 0 && <p className="text-[12.5px] text-ink-3" data-testid="m31-pl-score" role="status">{t('m31.pl.score', { right: score.right, asked: score.asked })}</p>}
      </div>
    </Page>
  );
}

function Picker({ onPick }: { onPick: (id: string) => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  return (
    <div className="space-y-4">
      <Card title={t('m31.pl.fnTitle')} eyebrow={t('m31.pl.fnEyebrow')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m31-pl-fns">
          {(['control', 'cool', 'contain'] as const).map((k) => <li key={k} className="rounded-md border border-line p-3"><p className="font-semibold">{t(`m31.pl.fn.${k}`)}</p><p className="mt-1 text-[13px] text-ink-2">{t(`m31.pl.fnHelp.${k}`)}</p></li>)}
        </ul>
      </Card>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m31-pl-scenarios">
        {SCENARIOS.map((s) => (
          <li key={s.id} className="card flex flex-col gap-2 p-4" data-testid="m31-pl-scenario" data-id={s.id}>
            <div className="flex items-start justify-between gap-2"><span className="font-semibold">{lang === 'ar' ? s.title_ar : s.title_en}</span><SimChip /></div>
            <p className="text-[13px] text-ink-2">{lang === 'ar' ? s.summary_ar : s.summary_en}</p>
            <p className="text-[12px] text-ink-3">{t('m31.pl.steps', { n: f.num(s.steps.length), min: f.num(s.minutes) })}</p>
            <div className="mt-auto"><button type="button" className="btn-primary btn-sm" onClick={() => onPick(s.id)} data-testid="m31-pl-start">{t('m31.pl.start')}</button></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Player({ id, answers, setAnswers, onExit }: { id: string; answers: Record<string, number>; setAnswers: (a: Record<string, number>) => void; onExit: () => void }) {
  const t = useT();
  const lang = useLang();
  const [i, setI] = useState(0);
  const at = stepAt(id, i);
  const sc = at.scenario as Scenario;
  const st = at.step!;
  const key = `${id}:${st.id}`;
  const chosen = answers[key];
  const tx = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return (
    <div className="space-y-4" data-testid="m31-pl-player" data-scenario={id} data-step={st.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-[18px] font-semibold">{tx(sc.title_en, sc.title_ar)}</h2><SimChip /></div>
        <button type="button" className="btn-ghost btn-sm" onClick={onExit} data-testid="m31-pl-exit">{t('m31.pl.exit')}</button>
      </div>
      <Stepper steps={sc.steps.map((x) => ({ id: x.id, label: tx(x.title_en, x.title_ar) }))} current={at.index} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card padded={false}>
          <div className="p-3"><Schematic s={st.state} focus={st.focus} /></div>
          <div className="border-t border-line p-3"><Indices s={st.state} /></div>
        </Card>
        <div className="space-y-3">
          <Card title={tx(st.title_en, st.title_ar)}>
            <p className="text-[14px] leading-relaxed" data-testid="m31-pl-body">{tx(st.body_en, st.body_ar)}</p>
          </Card>
          <Fns fns={st.fns} />
          {st.question && (
            <Card title={t('m31.pl.checkTitle')}>
              <fieldset data-testid="m31-pl-question">
                <legend className="mb-2 text-[13.5px] font-semibold">{tx(st.question.q_en, st.question.q_ar)}</legend>
                <div className="space-y-1.5">
                  {st.question.options.map((o, k) => (
                    <label key={k} className="flex cursor-pointer items-start gap-2 text-[13px]">
                      <input type="radio" name={`q-${key}`} checked={chosen === k} onChange={() => setAnswers({ ...answers, [key]: k })} data-testid={`m31-pl-opt-${k}`} />
                      <span>{tx(o.en, o.ar)}</span>
                    </label>
                  ))}
                </div>
                {chosen != null && (
                  <p className={`mt-2 text-[13px] ${chosen === st.question.correct ? 'text-ok' : 'text-bad'}`} role="status" data-testid="m31-pl-feedback" data-right={chosen === st.question.correct ? 'yes' : 'no'}>
                    {chosen === st.question.correct ? t('m31.pl.right') : t('m31.pl.notQuite')} {tx(st.question.explain_en, st.question.explain_ar)}
                  </p>
                )}
              </fieldset>
            </Card>
          )}
          {at.last && sc.link === 'next_gen' && <Callout tone="info" title={t('m31.pl.nextGenTitle')}><L to="/my/next-gen" data-testid="m31-pl-next-gen">{t('m31.pl.nextGen')}</L></Callout>}
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn-outline" disabled={at.index === 0} onClick={() => setI(at.index - 1)} data-testid="m31-pl-prev">{t('m31.pl.prev')}</button>
            {at.last ? <button type="button" className="btn-primary" onClick={onExit} data-testid="m31-pl-done">{t('m31.pl.done')}</button>
              : <button type="button" className="btn-primary" onClick={() => setI(at.index + 1)} data-testid="m31-pl-next">{t('m31.pl.next')}</button>}
          </div>
          <SimNote testId="m31-pl-sim-note">{t('m31.pl.simNote')}</SimNote>
        </div>
      </div>
    </div>
  );
}

function Fns({ fns }: { fns: SafetyFns }) {
  const t = useT();
  return (
    <ul className="grid grid-cols-3 gap-2" data-testid="m31-pl-fn-state">
      {(['control', 'cool', 'contain'] as const).map((k) => (
        <li key={k} className="rounded-md border border-line p-2 text-center text-[12px]" data-fn={k} data-state={fns[k]}>
          <div className="font-semibold">{t(`m31.pl.fn.${k}`)}</div>
          <StatusPill tone={fns[k] === 'normal' ? 'ok' : fns[k] === 'passive' ? 'info' : 'accent'}>{t(`m31.pl.fnState.${fns[k]}`)}</StatusPill>
        </li>
      ))}
    </ul>
  );
}

function Indices({ s }: { s: PlantState }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-1.5" data-testid="m31-pl-indices">
      <div className="flex flex-wrap items-center gap-2"><span className="caps">{t('m31.pl.indices')}</span><SimChip /></div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {(['power', 'heat', 'steam', 'output'] as const).map((k) => (
          <div key={k} className="text-[12px]">
            <dt className="text-ink-3">{t(`m31.pl.idx.${k}`)}</dt>
            <dd className="flex items-center gap-2"><span className="h-1.5 flex-1 rounded-full bg-sunken"><span className="block h-1.5 rounded-full bg-[rgb(var(--accent))]" style={{ width: `${s[k]}%` }} /></span><span className="num w-8 text-end">{f.num(s[k])}</span></dd>
          </div>
        ))}
      </dl>
      <p className="text-[11.5px] text-ink-3">{t('m31.pl.indexNote')}</p>
    </div>
  );
}

const HEAT = ['#94a3b8', '#f59e0b', '#f97316', '#dc2626'];
const STEAM = ['#cbd5e1', '#93c5fd', '#60a5fa', '#2563eb'];

/** Schematic of a pressurised water reactor plant, illustrative only. Focused components are outlined. */
function Schematic({ s, focus }: { s: PlantState; focus: string[] }) {
  const t = useT();
  const on = (id: string) => focus.includes(id);
  const stroke = (id: string) => (on(id) ? 'rgb(var(--accent))' : 'rgb(var(--line))');
  const sw = (id: string) => (on(id) ? 3 : 1.5);
  const heat = HEAT[lvl(s.heat)];
  const steam = STEAM[lvl(s.steam)];
  const out = s.output > 0;
  const label = (x: number, y: number, id: string, anchor: 'start' | 'middle' | 'end' = 'middle') => <text x={x} y={y} textAnchor={anchor} fontSize="12" fontWeight={on(id) ? 700 : 500} fill="rgb(var(--ink))">{t(`m31.pl.c.${id}`)}</text>;
  return (
    <figure className="space-y-1">
      <svg viewBox="0 0 760 330" className="h-auto w-full" role="img" aria-label={t('m31.pl.schematicLabel')} data-testid="m31-pl-schematic" data-focus={focus.join(' ')} direction="ltr">
        {/* containment */}
        <path d="M20 310 V120 Q20 30 160 30 Q300 30 300 120 V310 Z" fill="rgb(var(--panel))" stroke={stroke('containment')} strokeWidth={sw('containment')} data-c="containment" />
        {label(160, 52, 'containment')}
        {s.sink === 'passive_pool' && <g data-c="pool"><rect x="110" y="62" width="100" height="22" rx="4" fill="#bfdbfe" stroke="#60a5fa" /><text x="160" y="77" textAnchor="middle" fontSize="11" fill="#1e3a8a">{t('m31.pl.c.pool')}</text></g>}
        {/* reactor vessel and core */}
        <rect x="50" y="130" width="80" height="150" rx="30" fill="rgb(var(--sunken))" stroke={stroke('core')} strokeWidth={sw('core')} data-c="core" />
        <rect x="68" y="190" width="44" height="70" rx="6" fill={heat} opacity="0.85" />
        {[76, 90, 104].map((x) => <rect key={x} x={x} y={s.rods === 'in' ? 192 : 140} width="4" height="62" fill="#334155" stroke={on('rods') ? 'rgb(var(--accent))' : 'none'} data-c="rods" />)}
        {label(90, 298, 'core')}
        {/* primary loop */}
        <path d="M130 170 H190 V150" fill="none" stroke={heat} strokeWidth={on('primary') ? 7 : 5} data-c="primary" />
        <path d="M190 260 H130" fill="none" stroke={HEAT[Math.max(0, lvl(s.heat) - 1)]} strokeWidth={on('primary') ? 7 : 5} />
        <circle cx="160" cy="260" r="10" fill="rgb(var(--panel))" stroke="#334155" strokeWidth="1.5" data-c="pump" data-state={s.pumps} />
        <text x="160" y="248" textAnchor="middle" fontSize="10" fill="rgb(var(--ink-3))">{t(`m31.pl.pumps.${s.pumps}`)}</text>
        {/* steam generator */}
        <rect x="190" y="120" width="60" height="160" rx="26" fill="rgb(var(--sunken))" stroke={stroke('sg')} strokeWidth={sw('sg')} data-c="sg" />
        <path d="M205 270 V160 Q220 140 235 160 V270" fill="none" stroke={heat} strokeWidth="3" />
        {label(220, 112, 'sg')}
        {/* steam line */}
        <path d="M250 140 H300 M300 140 H420" fill="none" stroke={steam} strokeWidth="5" data-c="steam" />
        {s.sink === 'atmosphere_valves' && <g data-c="valves"><path d="M330 140 V100" stroke={steam} strokeWidth="4" /><text x="330" y="94" textAnchor="middle" fontSize="10" fill="rgb(var(--ink-3))">{t('m31.pl.c.valves')}</text></g>}
        {/* turbine and generator */}
        <path d="M420 110 L500 90 V190 L420 170 Z" fill={s.turbine === 'online' ? 'rgb(var(--sunken))' : 'rgb(var(--panel))'} stroke={stroke('turbine')} strokeWidth={sw('turbine')} data-c="turbine" data-state={s.turbine} />
        {label(460, 82, 'turbine')}
        <text x="460" y="145" textAnchor="middle" fontSize="10" fill="rgb(var(--ink-3))">{t(`m31.pl.turbine.${s.turbine}`)}</text>
        <rect x="515" y="110" width="60" height="60" rx="8" fill="rgb(var(--sunken))" stroke={stroke('generator')} strokeWidth={sw('generator')} data-c="generator" />
        <text x="545" y="145" textAnchor="middle" fontSize="16" fill={out ? 'rgb(var(--accent))' : 'rgb(var(--ink-3))'}>⚡</text>
        {label(545, 102, 'generator')}
        {/* grid */}
        <path d="M575 140 H650" stroke={out ? 'rgb(var(--accent))' : 'rgb(var(--line))'} strokeWidth="3" strokeDasharray={s.grid === 'lost' ? '6 6' : undefined} />
        <path d="M670 80 L650 190 M670 80 L690 190 M655 120 H685 M660 150 H680" stroke={stroke('grid')} strokeWidth={sw('grid')} fill="none" data-c="grid" data-state={s.grid} />
        {label(670, 70, 'grid')}
        <text x="670" y="208" textAnchor="middle" fontSize="10" fill={s.grid === 'lost' ? 'rgb(var(--bad))' : 'rgb(var(--ink-3))'}>{t(`m31.pl.grid.${s.grid}`)}</text>
        {/* condenser and sea */}
        <path d="M460 190 V220" stroke={steam} strokeWidth="4" />
        <rect x="410" y="220" width="100" height="44" rx="8" fill="rgb(var(--sunken))" stroke={stroke('condenser')} strokeWidth={sw('condenser')} data-c="condenser" />
        {label(460, 246, 'condenser')}
        <path d="M510 250 H600" stroke="#60a5fa" strokeWidth="3" />
        <path d="M600 300 Q620 288 640 300 T680 300 T720 300 T760 300" fill="none" stroke={on('sea') ? 'rgb(var(--accent))' : '#60a5fa'} strokeWidth={on('sea') ? 4 : 3} data-c="sea" />
        <path d="M600 250 V296" stroke="#60a5fa" strokeWidth="3" />
        {label(690, 322, 'sea')}
        {/* feedwater back to the steam generator */}
        <path d="M410 250 H320 V250 H250" fill="none" stroke={s.feed === 'normal' ? STEAM[1] : '#a855f7'} strokeWidth={on('feed') ? 6 : 4} strokeDasharray={s.feed === 'passive' ? '4 4' : undefined} data-c="feed" data-state={s.feed} />
        <text x="340" y="242" textAnchor="middle" fontSize="10" fill="rgb(var(--ink-3))">{t(`m31.pl.feed.${s.feed}`)}</text>
        {/* backup power */}
        <rect x="320" y="280" width="80" height="34" rx="6" fill={s.backup === 'running' ? '#fef3c7' : 'rgb(var(--panel))'} stroke={stroke('backup')} strokeWidth={sw('backup')} data-c="backup" data-state={s.backup} />
        <text x="360" y="295" textAnchor="middle" fontSize="11" fontWeight={on('backup') ? 700 : 500} fill="rgb(var(--ink))">{t('m31.pl.c.backup')}</text>
        <text x="360" y="308" textAnchor="middle" fontSize="9.5" fill="rgb(var(--ink-3))">{t(`m31.pl.backup.${s.backup}`)}</text>
        <text x="740" y="20" textAnchor="end" fontSize="11" fontWeight="700" fill="rgb(var(--sim))">{t('common.simulated')}</text>
      </svg>
      <figcaption className="flex items-center gap-1.5 text-[11.5px] text-ink-3"><Icon name="info" size={12} /> {t('m31.pl.caption')}</figcaption>
    </figure>
  );
}
