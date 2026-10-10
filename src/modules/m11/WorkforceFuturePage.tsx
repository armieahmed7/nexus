// M11 /workforce/future (HR): the future-skills radar. [FS04] Readiness is computed from F01 person skills through rpc.futureRadar
// (share of active staff at the target level on each key's catalogue skills, suppressed under 10 people), no longer hand-entered.
// Demand stays scenario-specific and SIMULATED, each row with a sourced assumption; Scenario A and B now differ. Every radar key and
// gap plan resolves to a catalogue skill (future_skill_map). Plans are recorded through the audited saveSkillGapPlan RPC.
// Benchmarks: IAEA NG-T-3.10 (scenario bands, assess capability, fill plan per gap) and ESCO (one keyspace, published crosswalk).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Callout, Async, EmptyState, Grid, StatTile, DataTable, Drawer, ConfirmDialog, SelectField, TextField, TextArea, SimChip, Heatmap, WhyThis, SourceLink, type Column } from '../../ui';
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { adjustDemand, skillGap, validGapPlan } from '../../domain/future';
import type { GapPlanInput } from '../../data';
import { NoDecision, Radar, RELATION_CLS } from './shared';
import { BenchmarkChips } from './Benchmarks';
import { BENCHMARK_IDS, cellReasons, radarGap, rowsOf, type FutureRadar, type MapRow, type RadarCell } from './keyspace';

type Skill = RowOf<'future_skills'>;
type Plan = RowOf<'skill_gap_plans'>;
type CatSkill = RowOf<'skills'>;
const ACTIONS = ['train', 'reskill', 'hire', 'partner', 'research'] as const;
interface Src { id?: string; label: string; url: string; as_of?: string }

export default function WorkforceFuturePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['future_skills', 'skill_gap_plans', 'adv_technologies', 'skill_bridges', 'future_roles', 'future_skill_map', 'skills', 'job_families'], async () => {
    const [skills, plans, techs, bridges, roles, map, catalogue, families] = await Promise.all([
      repo.list('future_skills'),
      repo.list('skill_gap_plans', { order: [['created_at', 'desc']] }),
      repo.list('adv_technologies', { order: [['sort', 'asc']] }),
      repo.list('skill_bridges'),
      repo.list('future_roles'),
      repo.list('future_skill_map'),
      repo.list('skills'),
      repo.list('job_families', { order: [['sort', 'asc']] }),
    ]);
    return { skills, plans, techs, bridges, roles, map: map as unknown as MapRow[], catalogue, families };
  });
  return (
    <Page title={t('m11.routes.workforce-future.title')} eyebrow={t('m11.wf.eyebrow')} intro={t('m11.wf.intro')} actions={<><L to="/workforce/future/keyspace" className="btn-outline btn-sm" data-testid="m11-keyspace-link">{t('m11.wf.keyspaceLink')}</L><SimChip /></>}>
      <BenchmarkChips ids={BENCHMARK_IDS} />
      <Callout tone="sim" title={t('m11.wf.simTitle')}>{t('m11.wf.simBody')}</Callout>
      <Async state={q} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title={t('m11.wf.empty')} />}>{(d) => <Planner {...d} />}</Async>
      <NoDecision compact />
    </Page>
  );
}

interface Data { skills: Skill[]; plans: Plan[]; techs: RowOf<'adv_technologies'>[]; bridges: RowOf<'skill_bridges'>[]; roles: RowOf<'future_roles'>[]; map: MapRow[]; catalogue: CatSkill[]; families: RowOf<'job_families'>[] }

function Planner(d: Data) {
  const { skills, plans, techs, bridges, roles, map, catalogue, families } = d;
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const canPlan = s.roles.includes('hr_analyst') || s.roles.includes('hr_director');
  const scenarios = useMemo(() => Array.from(new Set(skills.map((x) => x.scenario))).sort(), [skills]);
  const [scenario, setScenario] = useState(scenarios[0] ?? '');
  const [factor, setFactor] = useState(1);
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const radar = useQuery(['future_skills', 'future_skill_map', 'person_skills', 'people'], () => repo.rpc.futureRadar(scenario), [scenario]);
  const other = scenarios.find((x) => x !== scenario) ?? null;
  const skName = (id: string | null | undefined) => { const x = catalogue.find((c) => c.id === id); return x ? pick(x, 'name') : id ?? '—'; };
  const keyLabel = (key: string) => { const r = skills.find((x) => x.skill_key === key); return r ? pick(r, 'skill') : skName(key); };
  const planned = new Set(plans.filter((p) => p.status !== 'done').map((p) => p.skill_key));
  const rowFor = (key: string, sc: string | null) => skills.find((x) => x.skill_key === key && x.scenario === sc);

  return (
    <>
      <Card>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">{t('m11.wf.scenario')}</span>
            <div className="inline-flex flex-wrap gap-1 rounded-card border border-line bg-sunken p-1" role="radiogroup" aria-label={t('m11.wf.scenario')} data-testid="m11-scenario">
              {scenarios.map((x) => (
                <button key={x} type="button" role="radio" aria-checked={x === scenario} onClick={() => setScenario(x)} className={`rounded px-3 py-1.5 text-[13px] font-semibold ${x === scenario ? 'bg-panel text-ink shadow-sm' : 'text-ink-3'}`} data-testid={`m11-scenario-${x.includes('B (') ? 'b' : 'a'}`}>
                  {t(x.includes('B (') ? 'm11.wf.scnB' : 'm11.wf.scnA')}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-ink-3">{t(scenario.includes('B (') ? 'm11.wf.scnBHint' : 'm11.wf.scnAHint')}</span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">{t('m11.wf.adoption', { n: f.num(factor, { maximumFractionDigits: 2 }) })}</span>
            <input type="range" min={0.5} max={1.5} step={0.05} value={factor} onChange={(e) => setFactor(Number(e.target.value))} aria-valuetext={`${factor}`} data-testid="m11-adoption" />
            <span className="text-[12px] text-ink-3">{t('m11.wf.adoptionHint')}</span>
          </label>
        </div>
      </Card>
      <Async state={radar}>
        {(r) => <RadarView r={r} factor={factor} other={other} rowFor={rowFor} planned={planned} canPlan={canPlan} onPlan={(key) => setEdit({ skill_key: key, scenario, action: 'train', status: 'draft' })} map={map} catalogue={catalogue} families={families} skName={skName} plans={plans} />}
      </Async>
      <PlansSection plans={plans} canPlan={canPlan} keyLabel={keyLabel} skName={skName} onEdit={setEdit} onNew={() => setEdit({ scenario, action: 'train', status: 'draft' })} />
      <Section title={t('m11.wf.structureTitle')} description={t('m11.wf.structureDesc')}>
        <div className="card overflow-x-auto">
          <table className="table-base w-full text-[13px]">
            <caption className="sr-only">{t('m11.wf.structureTitle')}</caption>
            <thead className="bg-raised"><tr><th scope="col">{t('m11.wf.tech')}</th><th scope="col" className="text-end">{t('m11.wf.bridges')}</th><th scope="col" className="text-end">{t('m11.wf.conceptRoles')}</th></tr></thead>
            <tbody>
              {techs.map((x) => <tr key={x.id}><th scope="row" className="text-start font-medium">{pick(x, 'family')}</th><td className="num text-end">{f.num(new Set(bridges.filter((b) => b.tech_id === x.id).map((b) => b.from_role_id)).size)}</td><td className="num text-end">{f.num(roles.filter((r) => r.tech_ids.includes(x.id)).length)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Section>
      {edit && <PlanEditor plan={edit} skills={skills} scenarios={scenarios} map={map} catalogue={catalogue} onClose={() => setEdit(null)} />}
    </>
  );
}

function RadarView({ r, factor, other, rowFor, planned, canPlan, onPlan, map, catalogue, families, skName, plans }: {
  r: FutureRadar; factor: number; other: string | null; rowFor: (k: string, sc: string | null) => Skill | undefined; planned: Set<string>; canPlan: boolean; onPlan: (key: string) => void;
  map: MapRow[]; catalogue: CatSkill[]; families: RowOf<'job_families'>[]; skName: (id: string | null | undefined) => string; plans: Plan[];
}) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const calc = r.rows.map((c) => {
    const demand = adjustDemand(c.demand, factor);
    const g = radarGap(demand, c.readiness, c.readiness_max);
    const band = skillGap(demand, c.readiness ?? c.readiness_max ?? 0).band;
    const otherRow = rowFor(c.key, other);
    return { ...c, demand, gap: g.gap, atLeast: g.atLeast, band, otherDemand: otherRow ? adjustDemand(Number(otherRow.value), factor) : null };
  });
  type C = (typeof calc)[number];
  const high = calc.filter((c) => c.band === 'high').length;
  const suppressed = calc.filter((c) => c.suppressed).length;
  const unplanned = calc.filter((c) => c.band === 'high' && !planned.has(c.key)).length;
  const label = (c: RadarCell) => (lang === 'ar' ? c.skill_ar : c.skill_en);
  const relChip = (m: MapRow) => <span key={m.id} className={`chip ${RELATION_CLS[m.relation] ?? ''}`} title={t(`m11.ks.relCredit.${m.relation}`)}>{skName(m.sk_id)} · {t(`m11.rel.${m.relation}`)} · {t('m11.ks.lvl', { n: f.num(m.need_level) })}</span>;
  const pct = (v: number) => `${f.num(v, { maximumFractionDigits: 1 })}`;

  const cols: Column<C>[] = [
    { key: 'skill', header: t('m11.wf.skill'), value: (c) => label(c), sortable: true, render: (c) => (
      <div className="min-w-[220px] space-y-1">
        <div className="font-semibold">{label(c)}</div>
        <div className="flex flex-wrap gap-1 text-[11.5px]">{rowsOf(map, c.key).map(relChip)}</div>
      </div>
    ) },
    { key: 'demand', header: t('m11.wf.demand'), value: (c) => c.demand, sortable: true, align: 'end', render: (c) => <span className="num">{f.num(c.demand)}</span> },
    { key: 'ready', header: t('m11.wf.readinessComputed'), value: (c) => c.readiness ?? -1, sortable: true, align: 'end', render: (c) => c.suppressed
      ? <span className="chip border-line bg-sunken text-ink-3" title={t('m11.wf.suppressedHint', { max: pct(c.readiness_max ?? 0) })} data-testid={`m11-suppressed-${c.key}`}>{t('m11.wf.suppressed')}</span>
      : <span className="num font-semibold">{pct(c.readiness ?? 0)}</span> },
    { key: 'n', header: t('m11.wf.readyPeople'), value: (c) => c.ready_n ?? -1, sortable: true, align: 'end', render: (c) => <span className="num">{c.ready_n == null ? t('m11.wf.under10') : f.num(c.ready_n)}</span> },
    { key: 'gap', header: t('m11.wf.gap'), value: (c) => c.gap, sortable: true, align: 'end', render: (c) => <span className={`num font-semibold ${c.band === 'high' ? 'text-bad' : c.band === 'medium' ? 'text-sim' : ''}`}>{c.atLeast ? '≥ ' : ''}{f.num(c.gap)}</span> },
    { key: 'band', header: t('m11.wf.band'), value: (c) => t(`m11.band.${c.band}`), sortable: true },
    { key: 'why', header: '', csv: false, render: (c) => <WhyThis reasons={cellReasons(c, map, catalogue) as never} testId={`m11-why-${c.key}`} /> },
    { key: 'plan', header: t('m11.wf.planned'), value: (c) => (planned.has(c.key) ? t('common.yes') : t('common.no')), render: (c) => planned.has(c.key) ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('common.yes')}</span> : canPlan ? <button className="btn-outline btn-sm" onClick={() => onPlan(c.key)} data-testid={`m11-plan-${c.key}`}>{t('m11.wf.addPlan')}</button> : <span className="text-ink-3">—</span>, csv: true },
  ];
  const famRows = r.families.map((x) => x.family_id);
  const famName = (id: string) => { const x = families.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
  const visibleFam = r.families.filter((x) => !x.suppressed).length;

  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m11.wf.statPopulation')} value={f.num(r.population)} sub={t('m11.wf.statPopulationSub')} />
        <StatTile label={t('m11.wf.statHigh')} value={f.num(high)} tone={high ? 'bad' : 'ok'} sim sub={t('m11.wf.statSkillsSub', { n: f.num(calc.length) })} />
        <StatTile label={t('m11.wf.statUnplanned')} value={f.num(unplanned)} tone={unplanned ? 'bad' : 'ok'} sim sub={t('m11.wf.statPlansSub', { n: f.num(plans.length) })} />
        <StatTile label={t('m11.wf.statSuppressed')} value={f.num(suppressed)} sub={t('m11.wf.statSuppressedSub')} />
      </Grid>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <Radar
            title={t('m11.wf.radarTitle', { s: t(r.scenario.includes('B (') ? 'm11.wf.scnB' : 'm11.wf.scnA') })}
            axes={calc.map((c) => (c.suppressed ? `${label(c)} (<10)` : label(c)))}
            series={[
              { name: t('m11.wf.demand'), values: calc.map((c) => c.demand), tone: 'sim' },
              ...(other ? [{ name: t('m11.wf.otherDemand', { s: t(other.includes('B (') ? 'm11.wf.scnB' : 'm11.wf.scnA') }), values: calc.map((c) => c.otherDemand ?? 0), tone: 'info' as const, dashed: true }] : []),
              { name: t('m11.wf.readinessComputed'), values: calc.map((c) => c.readiness ?? 0), tone: 'accent' },
            ]}
          />
          <p className="mt-2 text-[12px] text-ink-3">{t('m11.wf.radarNote')}</p>
        </Card>
        <Section title={t('m11.wf.gapTitle')} description={t('m11.wf.gapDescComputed')}>
          <DataTable rows={calc} columns={cols} rowKey={(c) => c.key} csvName={`kafaa-future-skills-SIMULATED-${r.scenario.replace(/\W+/g, '-')}`} initialSort={{ key: 'gap', dir: 'desc' }} searchable={false} caption={t('m11.wf.gapTitle')} />
        </Section>
      </div>
      <Section title={t('m11.wf.assumptionsTitle')} description={t('m11.wf.assumptionsDesc')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m11-assumptions">
          {calc.map((c) => (
            <Card key={c.key}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{label(c)}</div>
                <div className="flex shrink-0 items-center gap-1 text-[12px]">
                  <span className="chip border-sim-line bg-sim-bg text-sim num">{f.num(c.demand)}</span>
                  {c.otherDemand != null && <span className={`chip num ${c.otherDemand === c.demand ? 'border-line' : 'border-info-line bg-info-bg text-info'}`} title={t('m11.wf.otherDemand', { s: '' })}>{c.demand > c.otherDemand ? '▲' : c.demand < c.otherDemand ? '▼' : '='} {f.num(Math.abs(c.demand - c.otherDemand))}</span>}
                </div>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{lang === 'ar' ? c.assumption_ar : c.assumption_en}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{((c.sources ?? []) as Src[]).map((x) => <SourceLink key={x.url} href={x.url} date={x.as_of ? f.date(x.as_of) : null}>{x.label}</SourceLink>)}</div>
            </Card>
          ))}
        </div>
      </Section>
      <Section title={t('m11.wf.familyTitle')} description={t('m11.wf.familyDesc', { shown: f.num(visibleFam), total: f.num(r.families.length) })}>
        <Card>
          <Heatmap title={t('m11.wf.familyTitle')} rows={famRows} cols={calc.map((c) => c.key)} rowLabel={famName} colLabel={(k) => { const c = calc.find((x) => x.key === k); return c ? label(c) : k; }}
            value={(fid, k) => { const fam = r.families.find((x) => x.family_id === fid); const cell = fam?.cells.find((x) => x.key === k); return { v: cell?.readiness ?? null, suppressed: !cell || cell.suppressed }; }} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m11.wf.familyNote')}</p>
        </Card>
      </Section>
    </>
  );
}

function PlansSection({ plans, canPlan, keyLabel, skName, onEdit, onNew }: { plans: Plan[]; canPlan: boolean; keyLabel: (k: string) => string; skName: (id: string | null | undefined) => string; onEdit: (p: Plan) => void; onNew: () => void }) {
  const t = useT();
  const planCols: Column<Plan>[] = [
    { key: 'skill', header: t('m11.wf.skill'), value: (p) => keyLabel(p.skill_key), sortable: true },
    { key: 'sk', header: t('m11.wf.catalogueSkill'), value: (p) => skName(p.sk_id), sortable: true, render: (p) => <span className="chip border-info-line bg-info-bg text-info">{skName(p.sk_id)}</span> },
    { key: 'action', header: t('m11.wf.action'), value: (p) => t(`m11.action.${p.action}`), sortable: true },
    { key: 'owner', header: t('m11.wf.owner'), value: (p) => p.owner_role },
    { key: 'q', header: t('m11.wf.quarter'), value: (p) => p.target_quarter, sortable: true, render: (p) => <span className="num">{p.target_quarter}</span> },
    { key: 'scenario', header: t('m11.wf.scenario'), value: (p) => t(p.scenario.includes('B (') ? 'm11.wf.scnB' : 'm11.wf.scnA') },
    { key: 'status', header: t('m11.wf.status'), value: (p) => t(`m11.planStatus.${p.status}`), sortable: true },
    { key: 'note', header: t('m11.wf.note'), value: (p) => p.note },
    ...(canPlan ? [{ key: 'edit', header: '', csv: false, render: (p: Plan) => <button className="btn-ghost btn-sm" onClick={() => onEdit(p)}>{t('common.edit')}</button> } as Column<Plan>] : []),
  ];
  return (
    <Section title={t('m11.wf.plansTitle')} description={t('m11.wf.plansDescKeyed')} actions={canPlan ? <button className="btn-primary" onClick={onNew} data-testid="m11-new-plan">{t('m11.wf.newPlan')}</button> : undefined}>
      {plans.length === 0 ? <EmptyState title={t('m11.wf.noPlans')} /> : <DataTable rows={plans} columns={planCols} rowKey={(p) => p.id} csvName="kafaa-skills-gap-plans" caption={t('m11.wf.plansTitle')} />}
    </Section>
  );
}

function PlanEditor({ plan, skills, scenarios, map, catalogue, onClose }: { plan: Partial<Plan>; skills: Skill[]; scenarios: string[]; map: MapRow[]; catalogue: CatSkill[]; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const year = new Date().getUTCFullYear();
  const [v, setV] = useState({ skill_key: plan.skill_key ?? '', scenario: plan.scenario ?? scenarios[0] ?? '', action: plan.action ?? 'train', owner_role: plan.owner_role ?? '', target_quarter: plan.target_quarter ?? `${year + 1}-Q1`, status: plan.status ?? 'draft', note: plan.note ?? '' });
  const [confirm, setConfirm] = useState(false);
  const problems = validGapPlan(v);
  const radarKeys = Array.from(new Map(skills.map((s) => [s.skill_key, lang === 'ar' ? s.skill_ar : s.skill_en])).entries());
  const mapped = Array.from(new Set(map.filter((m) => m.active !== false).map((m) => m.sk_id))).map((id) => catalogue.find((c) => c.id === id)).filter((c): c is CatSkill => !!c && c.area !== 'security');
  const resolved = v.skill_key.startsWith('sk-') ? v.skill_key : rowsOf(map, v.skill_key)[0]?.sk_id;
  const resolvedName = (() => { const c = catalogue.find((x) => x.id === resolved); return c ? pick(c, 'name') : null; })();
  const quarters = Array.from({ length: 6 }, (_, i) => year + i).flatMap((y) => [1, 2, 3, 4].map((q) => `${y}-Q${q}`));
  return (
    <Drawer open onClose={onClose} title={plan.id ? t('m11.wf.editPlan') : t('m11.wf.newPlan')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={problems.length > 0} onClick={() => setConfirm(true)} data-testid="m11-plan-save">{t('common.save')}</button></>}>
      <div className="space-y-3" data-testid="m11-plan-form">
        <SelectField label={t('m11.wf.skill')} name="skill" required value={v.skill_key} onChange={(x) => setV({ ...v, skill_key: x })}
          options={[...radarKeys.map(([k, l]) => ({ value: k, label: l })), ...mapped.map((c) => ({ value: c.id, label: t('m11.wf.catalogueOption', { name: pick(c, 'name') }) }))]} />
        {resolvedName && <p className="text-[12.5px] text-ink-2" data-testid="m11-plan-resolved">{t('m11.wf.resolvesTo', { name: resolvedName })}</p>}
        <SelectField label={t('m11.wf.scenario')} name="scenario" value={v.scenario} onChange={(x) => setV({ ...v, scenario: x })} options={scenarios.map((x) => ({ value: x, label: t(x.includes('B (') ? 'm11.wf.scnB' : 'm11.wf.scnA') }))} />
        <SelectField label={t('m11.wf.action')} name="action" required value={v.action} onChange={(x) => setV({ ...v, action: x as Plan['action'] })} options={ACTIONS.map((a) => ({ value: a, label: t(`m11.action.${a}`) }))} />
        <TextField label={t('m11.wf.owner')} name="owner" required value={v.owner_role} onChange={(x) => setV({ ...v, owner_role: x })} hint={t('m11.wf.ownerHint')} error={v.owner_role && problems.includes('owner') ? 'common.validation.required' : null} />
        <SelectField label={t('m11.wf.quarter')} name="quarter" required value={v.target_quarter} onChange={(x) => setV({ ...v, target_quarter: x })} options={quarters.map((q) => ({ value: q, label: q }))} />
        <SelectField label={t('m11.wf.status')} name="status" value={v.status} onChange={(x) => setV({ ...v, status: x as Plan['status'] })} options={['draft', 'active', 'done'].map((s) => ({ value: s, label: t(`m11.planStatus.${s}`) }))} />
        <TextArea label={t('m11.wf.note')} name="note" value={v.note} onChange={(x) => setV({ ...v, note: x })} />
        <Callout tone="sim" title={t('m11.wf.simTitle')}>{t('m11.wf.planNote')}</Callout>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m11.wf.savePlan')} consequence={t('m11.wf.savePlanBody')} actingAs={t('m11.wf.actingHr')}
        onConfirm={async () => {
          const input: GapPlanInput = { id: plan.id ?? null, skill_key: v.skill_key, scenario: v.scenario, action: v.action as GapPlanInput['action'], owner_role: v.owner_role, target_quarter: v.target_quarter, status: v.status as GapPlanInput['status'], note: v.note };
          const r = await run(() => repo.rpc.saveSkillGapPlan(input), { success: t('m11.wf.saved') });
          if (r.ok) onClose();
        }} />
    </Drawer>
  );
}
