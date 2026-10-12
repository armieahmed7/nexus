// FS51 /workforce/skill-forecasts (workforce_strategy Agg/R/W/A): three-scenario skill forecasting bands, SIMULATED. Per skill and level
// mix: baseline, ADVANCE and accelerated demand to 2035 (FS05 role profiles phased by pace, the M07 staffing scenario, the ADVANCE uplift)
// against supply from today's counted F01 states (attrition, F20 KLRA departures, F22 cohorts, the DNT intake, demand-led development).
// Assumptions are visible and editable; "Reset assumptions" reproduces the baseline exactly (TS = SQL); a methodology banner blocks naive
// year-on-year comparison; skills under 10 holders are suppressed; a "not yet modelled" list says what the absence of data means. Computed
// on the server (rpc.computeSkillForecast): aggregate only. HR analysts and the HR director save versions for the annual refresh.
import { useEffect, useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Card, Async, EmptyState, Callout, DataTable, StatusPill, ConfirmDialog, Modal, WhyThis, Tabs, BenchmarkChips, SimChip, TextField, SelectField, type Column } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import {
  DEFAULTS, LEVER_LIMITS, SCENARIOS, SHARED_LIMITS, WORK_LEVEL, bandAt, isDefault, skillReasons,
  type ForecastParams, type ForecastResult, type LeverParam, type ScenarioKey, type SharedParam, type SkillForecast,
} from './forecast';
import { BandSpark, FanChart, LevelMixTable, MethodBanner, NotModelled, SimLabels, Slider, Year, useM35Ref, useParamFormat, useSkillName, type Row } from './ui';

const WATCH = ['person_skills', 'scenarios', 'klra_assessments', 'klra_positions', 'handover_cohorts', 'role_profile_versions', 'future_skills', 'skills'] as unknown as Table[];
const MID = 4; // index of 2030

export default function SkillForecastsPage() {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const fmt = useParamFormat();
  const f = useFormat();
  const ref = useM35Ref();
  const skillName = useSkillName(ref.data);
  const canSave = s.can('workforce_strategy', ['W', 'A']);
  const [params, setParams] = useState<ForecastParams>(DEFAULTS);
  const [debounced, setDebounced] = useState<ForecastParams>(DEFAULTS);
  const [scenario, setScenario] = useState<ScenarioKey>('advance');
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState('');
  const [planAgainst, setPlanAgainst] = useState<ScenarioKey>('advance');
  useEffect(() => { const h = setTimeout(() => setDebounced(params), 250); return () => clearTimeout(h); }, [params]);
  const key = JSON.stringify(debounced);
  const q = useQuery(WATCH, async () => {
    const r = await repo.rpc.computeSkillForecast(debounced);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  }, [key]);
  const scen = useQuery('scenarios', () => repo.list('scenarios', { order: [['created_at', 'asc']] }) as Promise<Row[]>);
  const versions = useQuery('skill_forecasts' as Table, () => repo.list('skill_forecasts' as never, { order: [['created_at', 'desc']] }) as unknown as Promise<Row[]>);
  const reg = useQuery('critical_skills' as Table, () => (repo.list('critical_skills' as never) as unknown as Promise<Row[]>).catch(() => [] as Row[]));
  const baseline = isDefault(params);
  const updating = q.loading || key !== JSON.stringify(params);
  const setShared = (k: SharedParam, v: number) => setParams((p) => ({ ...p, [k]: v }));
  const setLever = (sc: ScenarioKey, k: LeverParam, v: number) => setParams((p) => ({ ...p, levers: { ...p.levers, [sc]: { ...p.levers[sc], [k]: v } } }));
  const released = (versions.data ?? []).find((v) => v.status === 'released' && Number(v.cycle) === new Date().getUTCFullYear()) ?? (versions.data ?? []).find((v) => v.status === 'released');
  return (
    <Page title={t('m35.routes.workforce-skill-forecasts.title')} intro={t('m35.fc.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS51" /><SimChip /></div>}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/workforce/skill-forecasts/versions" className="btn-outline btn-sm no-underline" data-testid="m35-fc-versions-link">{t('m35.fc.versions')}</L>
        <L to="/workforce/skill-forecasts/generations" className="btn-outline btn-sm no-underline">{t('m35.fc.generations')}</L>
        <L to="/workforce/critical-skills" className="btn-ghost btn-sm no-underline">{t('m35.fc.toRegister')}</L>
      </div>}>
      <SimLabels method={q.data?.method} />
      <MethodBanner basis={q.data?.basis} cycle={released ? Number(released.cycle) : null} />
      {released && (
        <p className="text-[12.5px] text-ink-2" data-testid="m35-fc-released">
          {t('m35.fc.releasedLine', { name: released.name, s: t(`m35.scenario.${released.scenario}`) })} <L to="/workforce/skill-forecasts/versions">{t('m35.fc.versions')}</L>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card title={t('m35.fc.assumptions')} actions={baseline ? <StatusPill tone="ok"><span data-testid="m35-fc-baseline">{t('m35.fc.isBaseline')}</span></StatusPill> : <StatusPill tone="sim">{t('m35.fc.whatIf')}</StatusPill>}>
          <div className="space-y-4" data-testid="m35-fc-controls">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold">{t('m35.fc.staffing')}</span>
              <select className="input" value={params.scenario_id ?? ''} onChange={(e) => setParams((p) => ({ ...p, scenario_id: e.target.value || null }))} data-testid="m35-fc-staffing">
                <option value="">{t('m35.fc.currentFleet')}</option>
                {(scen.data ?? []).filter((x) => x.kind === 'headcount' || x.kind === 'technology').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold">{t('m35.fc.catalogue')}</span>
              <select className="input" value={params.catalogue} onChange={(e) => setParams((p) => ({ ...p, catalogue: e.target.value as ForecastParams['catalogue'] }))} data-testid="m35-fc-catalogue">
                <option value="all">{t('m35.catalogue.all')}</option>
                <option value="established">{t('m35.catalogue.established')}</option>
              </select>
            </label>
            {(Object.keys(SHARED_LIMITS) as SharedParam[]).map((k) => (
              <Slider key={k} id={k} label={t(`m35.param.${k}`)} value={params[k]} min={SHARED_LIMITS[k][0]} max={SHARED_LIMITS[k][1]} step={SHARED_LIMITS[k][2]} def={DEFAULTS[k]}
                format={(v) => fmt(k, v)} onChange={(v) => setShared(k, v)} hint={t(`m35.hint.${k}`)} />
            ))}
            <fieldset className="space-y-2" data-testid="m35-fc-levers">
              <legend className="text-[13px] font-semibold">{t('m35.fc.levers')}</legend>
              <p className="text-[11.5px] text-ink-3">{t('m35.fc.leversHint')}</p>
              {SCENARIOS.map((sc) => (
                <div key={sc} className="rounded-card border border-line p-2" data-testid={`m35-fc-lever-${sc}`}>
                  <div className="mb-1 text-[12.5px] font-semibold">{t(`m35.scenario.${sc}`)}</div>
                  {(['pace', 'advance'] as const).map((k) => (
                    <Slider key={k} id={`${sc}-${k}`} label={t(`m35.param.${k}`)} value={params.levers[sc][k]} min={LEVER_LIMITS[k][0]} max={LEVER_LIMITS[k][1]} step={LEVER_LIMITS[k][2]} def={DEFAULTS.levers[sc][k]}
                      format={(v) => fmt(k, v)} onChange={(v) => setLever(sc, k, v)} />
                  ))}
                  <label className="mt-1 flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="font-semibold">{t('m35.param.adv_start')}</span>
                    <select className="input w-auto" value={params.levers[sc].adv_start} onChange={(e) => setLever(sc, 'adv_start', Number(e.target.value))} data-testid={`m35-fc-start-${sc}`}>
                      {Array.from({ length: LEVER_LIMITS.adv_start[1] - LEVER_LIMITS.adv_start[0] + 1 }, (_, i) => LEVER_LIMITS.adv_start[0] + i).map((y) => <option key={y} value={y}>{f.num(y, { useGrouping: false })}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline btn-sm" disabled={baseline} onClick={() => setParams(DEFAULTS)} data-testid="m35-fc-reset">{t('m35.fc.reset')}</button>
              {canSave && <button type="button" className="btn-primary btn-sm" onClick={() => setSaving(true)} data-testid="m35-fc-save">{t('m35.fc.save')}</button>}
            </div>
            <p className="text-[11.5px] text-ink-3">{t('m35.fc.resetNote')}</p>
          </div>
        </Card>
        <div className="min-w-0 space-y-4" aria-busy={updating}>
          <Async state={q}>{(r) => (
            <Results r={r} scenario={scenario} setScenario={setScenario} picked={picked} setPicked={setPicked} skillName={skillName} onRegister={(id) => (reg.data ?? []).some((x) => x.skill_id === id && x.status !== 'retired')} />
          )}</Async>
        </div>
      </div>
      <Modal open={saving} onClose={() => setSaving(false)} title={t('m35.fc.saveTitle')}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost btn-sm" onClick={() => setSaving(false)}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary btn-sm" disabled={name.trim().length < 3} onClick={() => setConfirm(true)} data-testid="m35-fc-save-next">{t('m35.fc.save')}</button></div>}>
        <div className="space-y-3">
          <TextField name="m35-save-1" label={t('m35.fc.saveName')} value={name} onChange={setName} hint={t('m35.fc.saveNameHint')} />
          <SelectField name="m35-save-2" label={t('m35.fc.planAgainst')} value={planAgainst} onChange={(v) => setPlanAgainst(v as ScenarioKey)} options={SCENARIOS.map((x) => ({ value: x, label: t(`m35.scenario.${x}`) }))} />
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m35.fc.saveTitle')} consequence={t('m35.fc.saveConsequence')}
        actingAs={s.can('workforce_strategy', ['A']) ? t('m35.actingDirector') : t('m35.actingAnalyst')} confirmLabel={t('m35.fc.save')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.saveSkillForecast({ name, scenario: planAgainst, params }));
          if (r.ok) { setConfirm(false); setSaving(false); setName(''); }
        }} />
    </Page>
  );
}

function Results({ r, scenario, setScenario, picked, setPicked, skillName, onRegister }: {
  r: ForecastResult; scenario: ScenarioKey; setScenario: (s: ScenarioKey) => void; picked: string | null; setPicked: (id: string) => void; skillName: (id: string) => string; onRegister: (id: string) => boolean;
}) {
  const t = useT();
  const f = useFormat();
  const W = WORK_LEVEL - 1;
  const sorted = useMemo(() => [...r.skills].sort((a, b) => b.sc[scenario].gap_mid - a.sc[scenario].gap_mid || (a.skill_id < b.skill_id ? -1 : 1)), [r, scenario]);
  const sel = sorted.find((k) => k.skill_id === picked) ?? sorted[0] ?? null;
  const cols: Column<SkillForecast>[] = [
    { key: 'skill', header: t('m35.fc.col.skill'), value: (k) => skillName(k.skill_id), sortable: true,
      render: (k) => <div className="min-w-0"><button type="button" className="text-start font-semibold text-accent underline-offset-2 hover:underline" onClick={() => setPicked(k.skill_id)} data-testid="m35-fc-pick">{skillName(k.skill_id)}</button>
        <span className="block text-[11.5px] text-ink-3">{t(`m35.area.${k.area}`)}{k.adv_pct > 0 ? ` · ${t('m35.fc.advShare', { n: f.num(k.adv_pct) })}` : ''}{onRegister(k.skill_id) ? ` · ${t('m35.fc.onRegister')}` : ''}</span></div> },
    { key: 'today', header: t('m35.fc.col.today'), align: 'end', value: (k) => k.s0[W], render: (k) => <span className="num">{f.num(k.s0[W])}</span>, sortable: true },
    { key: 'band', header: t('m35.fc.col.band'), align: 'end', value: (k) => bandAt(k, MID)[1], render: (k) => { const [lo, hi] = bandAt(k, MID); return <span className="num" data-testid="m35-fc-band">{f.num(lo)}–{f.num(hi)}</span>; } },
    ...SCENARIOS.map((sc): Column<SkillForecast> => ({ key: `gap-${sc}`, header: t('m35.fc.col.gap', { s: t(`m35.scenarioShort.${sc}`) }), align: 'end', sortable: true, value: (k) => k.sc[sc].gap_mid,
      render: (k) => <span className={`num ${k.sc[sc].gap_mid > 0 ? 'font-semibold text-bad' : 'text-ok'}`}>{k.sc[sc].gap_mid > 0 ? '+' : ''}{f.num(k.sc[sc].gap_mid)}</span> })),
    { key: 'first', header: t('m35.fc.col.first'), align: 'end', value: (k) => k.sc[scenario].first_gap_year ?? 9999, render: (k) => <Year y={k.sc[scenario].first_gap_year} /> },
    { key: 'spark', header: t('m35.fc.col.spark'), csv: false, render: (k) => <BandSpark k={k} /> },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m35-fc-tiles">
        {SCENARIOS.map((sc) => {
          const x = r.totals[sc];
          return (
            <button key={sc} type="button" onClick={() => setScenario(sc)} aria-pressed={scenario === sc} data-testid={`m35-fc-tile-${sc}`}
              className={`rounded-card border p-3 text-start transition ${scenario === sc ? 'border-accent bg-accent/5' : 'border-line bg-panel hover:border-line-strong'}`}>
              <span className="caps block">{t(`m35.scenario.${sc}`)}</span>
              <span className="num mt-1 block text-[22px] font-semibold">{f.num(x.shortfall_mid)}</span>
              <span className="block text-[12px] text-ink-2">{t('m35.fc.tileMid', { n: f.num(x.short_mid), of: f.num(r.skills.length) })}</span>
              <span className="block text-[12px] text-ink-3">{t('m35.fc.tileFar', { pe: f.num(x.shortfall_far), n: f.num(x.short_far) })}</span>
            </button>
          );
        })}
      </div>
      {sel && (
        <Section title={skillName(sel.skill_id)} description={t('m35.fc.selIntro', { s: t(`m35.scenario.${scenario}`) })}
          actions={<div className="flex flex-wrap items-center gap-2"><WhyThis reasons={skillReasons(sel, scenario, r.params)} testId="m35-fc-why" /><L to={`/workforce/skill-forecasts/skills/${sel.skill_id}`} className="btn-outline btn-sm no-underline" data-testid="m35-fc-detail">{t('m35.fc.open')}</L></div>}>
          <div data-testid="m35-fc-selected" data-skill={sel.skill_id}>
            <FanChart k={sel} scenario={scenario} title={t('m35.fc.fanTitle', { skill: skillName(sel.skill_id) })} />
            <div className="mt-3">
              <Tabs value={scenario} onChange={(v) => setScenario(v as ScenarioKey)} tabs={SCENARIOS.map((sc) => ({ id: sc, label: t(`m35.scenario.${sc}`), content: <LevelMixTable k={sel} scenario={sc} /> }))} />
            </div>
          </div>
        </Section>
      )}
      <Section title={t('m35.fc.skills')} description={t('m35.fc.skillsIntro', { n: f.num(r.skills.length), s: t(`m35.scenario.${scenario}`) })}>
        {r.skills.length ? (
          <div className="overflow-x-auto" data-testid="m35-fc-skills">
            <DataTable rows={sorted} columns={cols} rowKey={(k) => k.skill_id} searchable pageSize={20} caption={t('m35.fc.skills')} csvName="skill-forecast-SIMULATED" dense />
          </div>
        ) : <EmptyState title={t('m35.fc.noSkills')} />}
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m35.fc.suppressed', { n: f.num(r.suppressed.length) })} description={t('m35.fc.suppressedIntro', { n: f.num(r.min_group) })}>
          <ul className="flex flex-wrap gap-1.5" data-testid="m35-fc-suppressed">
            {r.suppressed.map((id) => <li key={id} className="rounded bg-sunken px-1.5 py-0.5 text-[12px]" data-suppressed="true">{skillName(id)} · {t('common.suppressedShort')}</li>)}
          </ul>
        </Section>
        <Section title={t('m35.nm.title')} description={t('m35.nm.intro')}>
          <NotModelled r={r} skillName={skillName} />
        </Section>
      </div>
      <Callout tone="info" title={t('m35.fc.how.title')}>{t('m35.fc.how.body', { org: f.num(r.org_headcount), staff: f.num(r.staff_sample) })}</Callout>
    </>
  );
}
