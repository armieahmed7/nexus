// M11 /workforce/future (HR): future-skills radar with scenarios labelled SIMULATED, never forecasts. Demand index per skill
// under a scenario (with an adoption what-if), the SIMULATED current-readiness index, the gap, and a skills-gap plan of actions
// (train, reskill, hire, partner, research) recorded through an audited RPC. Indices only: no headcount anywhere.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Callout, Async, EmptyState, Grid, StatTile, DataTable, Drawer, ConfirmDialog, SelectField, TextField, TextArea, SimChip, type Column } from '../../ui';
import { useT, usePick, useFormat, useLang } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { adjustDemand, skillGap, validGapPlan } from '../../domain/future';
import type { GapPlanInput } from '../../data';
import { NoDecision, Radar } from './shared';

type Skill = RowOf<'future_skills'>;
type Plan = RowOf<'skill_gap_plans'>;
const ACTIONS = ['train', 'reskill', 'hire', 'partner', 'research'] as const;

export default function WorkforceFuturePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['future_skills', 'skill_gap_plans', 'adv_technologies', 'skill_bridges', 'future_roles'], async () => {
    const [skills, plans, techs, bridges, roles] = await Promise.all([
      repo.list('future_skills'),
      repo.list('skill_gap_plans', { order: [['created_at', 'desc']] }),
      repo.list('adv_technologies', { order: [['sort', 'asc']] }),
      repo.list('skill_bridges'),
      repo.list('future_roles'),
    ]);
    return { skills, plans, techs, bridges, roles };
  });
  return (
    <Page title={t('m11.routes.workforce-future.title')} eyebrow={t('m11.wf.eyebrow')} intro={t('m11.wf.intro')} actions={<SimChip />}>
      <Callout tone="sim" title={t('m11.wf.simTitle')}>{t('m11.wf.simBody')}</Callout>
      <Async state={q} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title={t('m11.wf.empty')} />}>{(d) => <Planner {...d} />}</Async>
      <NoDecision compact />
    </Page>
  );
}

function Planner({ skills, plans, techs, bridges, roles }: { skills: Skill[]; plans: Plan[]; techs: RowOf<'adv_technologies'>[]; bridges: RowOf<'skill_bridges'>[]; roles: RowOf<'future_roles'>[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const s = useSession();
  const canPlan = s.roles.includes('hr_analyst') || s.roles.includes('hr_director');
  const scenarios = useMemo(() => Array.from(new Set(skills.map((x) => x.scenario))).sort(), [skills]);
  const [scenario, setScenario] = useState(scenarios[0] ?? '');
  const [factor, setFactor] = useState(1);
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const rows = skills.filter((x) => x.scenario === scenario).sort((a, b) => a.skill_key.localeCompare(b.skill_key));
  const calc = rows.map((x) => {
    const demand = adjustDemand(Number(x.value), factor);
    const readiness = Number(x.readiness ?? 0);
    return { ...x, demand, readiness, ...skillGap(demand, readiness) };
  });
  type C = (typeof calc)[number];
  const label = (key: string) => { const r = skills.find((x) => x.skill_key === key); return r ? pick(r, 'skill') : key; };
  const high = calc.filter((c) => c.band === 'high').length;
  const planned = new Set(plans.filter((p) => p.status !== 'done').map((p) => p.skill_key));
  const unplanned = calc.filter((c) => c.band === 'high' && !planned.has(c.skill_key)).length;

  const cols: Column<C>[] = [
    { key: 'skill', header: t('m11.wf.skill'), value: (c) => pick(c, 'skill'), sortable: true },
    { key: 'tech', header: t('m11.wf.tech'), value: (c) => c.tech_ids.map((id) => { const x = techs.find((y) => y.id === id); return x ? pick(x, 'family') : id; }).join('; ') },
    { key: 'demand', header: t('m11.wf.demand'), value: (c) => c.demand, sortable: true, align: 'end', render: (c) => <span className="num">{f.num(c.demand)}</span> },
    { key: 'ready', header: t('m11.wf.readiness'), value: (c) => c.readiness, sortable: true, align: 'end', render: (c) => <span className="num">{f.num(c.readiness)}</span> },
    { key: 'gap', header: t('m11.wf.gap'), value: (c) => c.gap, sortable: true, align: 'end', render: (c) => <span className={`num font-semibold ${c.band === 'high' ? 'text-bad' : c.band === 'medium' ? 'text-sim' : ''}`}>{f.num(c.gap)}</span> },
    { key: 'band', header: t('m11.wf.band'), value: (c) => t(`m11.band.${c.band}`), sortable: true },
    { key: 'plan', header: t('m11.wf.planned'), value: (c) => (planned.has(c.skill_key) ? t('common.yes') : t('common.no')), render: (c) => planned.has(c.skill_key) ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('common.yes')}</span> : canPlan ? <button className="btn-outline btn-sm" onClick={() => setEdit({ skill_key: c.skill_key, scenario, action: 'train', status: 'draft' })} data-testid={`m11-plan-${c.skill_key}`}>{t('m11.wf.addPlan')}</button> : <span className="text-ink-3">—</span>, csv: true },
  ];
  const planCols: Column<Plan>[] = [
    { key: 'skill', header: t('m11.wf.skill'), value: (p) => label(p.skill_key), sortable: true },
    { key: 'action', header: t('m11.wf.action'), value: (p) => t(`m11.action.${p.action}`), sortable: true },
    { key: 'owner', header: t('m11.wf.owner'), value: (p) => p.owner_role },
    { key: 'q', header: t('m11.wf.quarter'), value: (p) => p.target_quarter, sortable: true, render: (p) => <span className="num">{p.target_quarter}</span> },
    { key: 'scenario', header: t('m11.wf.scenario'), value: (p) => p.scenario },
    { key: 'status', header: t('m11.wf.status'), value: (p) => t(`m11.planStatus.${p.status}`), sortable: true },
    { key: 'note', header: t('m11.wf.note'), value: (p) => p.note },
    ...(canPlan ? [{ key: 'edit', header: '', csv: false, render: (p: Plan) => <button className="btn-ghost btn-sm" onClick={() => setEdit(p)}>{t('common.edit')}</button> } as Column<Plan>] : []),
  ];
  const bridgeCount = (techId: string) => new Set(bridges.filter((b) => b.tech_id === techId).map((b) => b.from_role_id)).size;

  return (
    <>
      <Card>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_2fr]">
          <SelectField label={t('m11.wf.scenario')} name="scenario" value={scenario} onChange={setScenario} options={scenarios.map((x) => ({ value: x, label: x }))} />
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">{t('m11.wf.adoption', { n: f.num(factor, { maximumFractionDigits: 2 }) })}</span>
            <input type="range" min={0.5} max={1.5} step={0.05} value={factor} onChange={(e) => setFactor(Number(e.target.value))} aria-valuetext={`${factor}`} data-testid="m11-adoption" />
            <span className="text-[12px] text-ink-3">{t('m11.wf.adoptionHint')}</span>
          </label>
        </div>
      </Card>
      <Grid cols={4}>
        <StatTile label={t('m11.wf.statSkills')} value={f.num(calc.length)} sim />
        <StatTile label={t('m11.wf.statHigh')} value={f.num(high)} tone={high ? 'bad' : 'ok'} sim />
        <StatTile label={t('m11.wf.statUnplanned')} value={f.num(unplanned)} tone={unplanned ? 'bad' : 'ok'} sim />
        <StatTile label={t('m11.wf.statPlans')} value={f.num(plans.filter((p) => p.status === 'active').length)} sub={t('m11.wf.statPlansSub', { n: f.num(plans.length) })} />
      </Grid>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <Radar
            title={t('m11.wf.radarTitle', { s: scenario })}
            axes={calc.map((c) => pick(c, 'skill'))}
            series={[
              { name: t('m11.wf.demand'), values: calc.map((c) => c.demand), tone: 'sim' },
              { name: t('m11.wf.readiness'), values: calc.map((c) => c.readiness), tone: 'accent', dashed: true },
            ]}
          />
        </Card>
        <Section title={t('m11.wf.gapTitle')} description={t('m11.wf.gapDesc')}>
          <DataTable rows={calc} columns={cols} rowKey={(c) => c.id} csvName={`kafaa-future-skills-SIMULATED-${scenario.replace(/\W+/g, '-')}`} initialSort={{ key: 'gap', dir: 'desc' }} searchable={false} caption={t('m11.wf.gapTitle')} />
        </Section>
      </div>
      <Section title={t('m11.wf.plansTitle')} description={t('m11.wf.plansDesc')} actions={canPlan ? <button className="btn-primary" onClick={() => setEdit({ scenario, action: 'train', status: 'draft' })} data-testid="m11-new-plan">{t('m11.wf.newPlan')}</button> : undefined}>
        {plans.length === 0 ? <EmptyState title={t('m11.wf.noPlans')} /> : <DataTable rows={plans} columns={planCols} rowKey={(p) => p.id} csvName="kafaa-skills-gap-plans" caption={t('m11.wf.plansTitle')} />}
      </Section>
      <Section title={t('m11.wf.structureTitle')} description={t('m11.wf.structureDesc')}>
        <div className="card overflow-x-auto">
          <table className="table-base w-full text-[13px]">
            <caption className="sr-only">{t('m11.wf.structureTitle')}</caption>
            <thead className="bg-raised"><tr><th scope="col">{t('m11.wf.tech')}</th><th scope="col" className="text-end">{t('m11.wf.bridges')}</th><th scope="col" className="text-end">{t('m11.wf.conceptRoles')}</th></tr></thead>
            <tbody>
              {techs.map((x) => <tr key={x.id}><th scope="row" className="text-start font-medium">{pick(x, 'family')}</th><td className="num text-end">{f.num(bridgeCount(x.id))}</td><td className="num text-end">{f.num(roles.filter((r) => r.tech_ids.includes(x.id)).length)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Section>
      {edit && <PlanEditor plan={edit} skills={skills} scenarios={scenarios} onClose={() => setEdit(null)} />}
    </>
  );
}

function PlanEditor({ plan, skills, scenarios, onClose }: { plan: Partial<Plan>; skills: Skill[]; scenarios: string[]; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const year = new Date().getUTCFullYear();
  const [v, setV] = useState({ skill_key: plan.skill_key ?? '', scenario: plan.scenario ?? scenarios[0] ?? '', action: plan.action ?? 'train', owner_role: plan.owner_role ?? '', target_quarter: plan.target_quarter ?? `${year + 1}-Q1`, status: plan.status ?? 'draft', note: plan.note ?? '' });
  const [confirm, setConfirm] = useState(false);
  const problems = validGapPlan(v);
  const keys = Array.from(new Map(skills.map((s) => [s.skill_key, lang === 'ar' ? s.skill_ar : s.skill_en])).entries());
  const quarters = Array.from({ length: 6 }, (_, i) => year + i).flatMap((y) => [1, 2, 3, 4].map((q) => `${y}-Q${q}`));
  return (
    <Drawer open onClose={onClose} title={plan.id ? t('m11.wf.editPlan') : t('m11.wf.newPlan')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={problems.length > 0} onClick={() => setConfirm(true)} data-testid="m11-plan-save">{t('common.save')}</button></>}>
      <div className="space-y-3" data-testid="m11-plan-form">
        <SelectField label={t('m11.wf.skill')} name="skill" required value={v.skill_key} onChange={(x) => setV({ ...v, skill_key: x })} options={keys.map(([k, l]) => ({ value: k, label: l }))} />
        <SelectField label={t('m11.wf.scenario')} name="scenario" value={v.scenario} onChange={(x) => setV({ ...v, scenario: x })} options={scenarios.map((x) => ({ value: x, label: x }))} />
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
