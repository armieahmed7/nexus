// M07 /workforce/scenarios: headcount scenario planner for licensed operators by technology or programme. Always SIMULATED:
// assumptions are inputs, results are never forecasts. HR saves scenarios through rpc.saveScenario.
import { useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { ScenariosRow } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Grid, Card, Async, EmptyState, Callout, LineChart, DataTable, SimChip, StatTile, Modal, TextField, SelectField, Icon } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { projectScenario, type ScenarioParams } from './metrics';
import { ExportButton, useWatermarkedExport } from './shared';

const DEFAULTS: ScenarioParams = { units: 2, startYear: 2032, attritionPct: 4, dntIntake: 30, horizon: 2036, perUnit: 48, baseline: 190, inTraining: 70 };
const LIMITS: Record<keyof ScenarioParams, [number, number]> = { units: [0, 8], startYear: [2027, 2045], attritionPct: [0, 25], dntIntake: [0, 200], horizon: [2027, 2050], perUnit: [10, 120], baseline: [0, 1000], inTraining: [0, 500] };

export default function WorkforceScenariosPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const exportCsv = useWatermarkedExport();
  const canSave = s.hasRole('hr_analyst', 'hr_director');
  const [p, setP] = useState<ScenarioParams>(DEFAULTS);
  const [kind, setKind] = useState<'headcount' | 'technology' | 'programme'>('headcount');
  const [tech, setTech] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const saved = useQuery('scenarios', () => repo.list('scenarios', { order: [['created_at', 'desc']] }));
  const techs = useQuery('adv_technologies', () => repo.list('adv_technologies'));
  const result = useMemo(() => projectScenario(p), [p]);
  const errs = (Object.keys(LIMITS) as (keyof ScenarioParams)[]).filter((k) => {
    const v = p[k] as number;
    return Number.isNaN(v) || v < LIMITS[k][0] || v > LIMITS[k][1];
  });
  const field = (k: keyof ScenarioParams) => (
    <TextField
      key={k}
      label={t(`m07.sc.param.${k}`)}
      name={k}
      type="number"
      value={String(p[k] ?? '')}
      onChange={(v) => setP({ ...p, [k]: v === '' ? NaN : Number(v) })}
      hint={t('m07.sc.range', { min: LIMITS[k][0], max: LIMITS[k][1] })}
      error={errs.includes(k) ? `common.validation.range:${LIMITS[k][0]}:${LIMITS[k][1]}` : null}
    />
  );
  const load = (r: ScenariosRow) => {
    const params = (r.params ?? {}) as Partial<ScenarioParams> & { technology?: string };
    setP({ ...DEFAULTS, ...Object.fromEntries(Object.entries(params).filter(([k]) => k in DEFAULTS)) });
    setKind(r.kind);
    setTech(params.technology ?? '');
    setLoadedId(r.owner_person_id === s.identity.personId ? r.id : null);
    setName(r.name);
  };

  return (
    <Page title={t('m07.routes.workforce-scenarios.title')} intro={t('m07.sc.intro')} wide actions={<SimChip />}>
      <Callout tone="sim" title={t('m07.sc.simTitle')}>{t('m07.sc.simBody')}</Callout>
      <Grid cols={3}>
        <Card title={t('m07.sc.assumptions')}>
          <div className="space-y-3" data-testid="m07-scenario-form">
            <SelectField label={t('m07.sc.kind')} name="kind" value={kind} onChange={(v) => setKind((v || 'headcount') as typeof kind)} options={(['headcount', 'technology', 'programme'] as const).map((k) => ({ value: k, label: t(`m07.sc.kinds.${k}`) }))} />
            {kind === 'technology' && (
              <SelectField label={t('m07.sc.technology')} name="tech" value={tech} onChange={setTech} options={(techs.data ?? []).map((x) => ({ value: x.id, label: pick(x, 'family') }))} hint={t('m07.sc.techHint')} />
            )}
            {(['units', 'startYear', 'perUnit', 'attritionPct', 'dntIntake', 'inTraining', 'baseline', 'horizon'] as (keyof ScenarioParams)[]).map(field)}
            <button className="btn-outline btn-sm" onClick={() => { setP(DEFAULTS); setLoadedId(null); setName(''); }}><Icon name="reset" size={14} />{t('m07.sc.reset')}</button>
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Grid cols={3}>
            <StatTile label={t('m07.sc.peakGap')} value={errs.length ? '—' : f.num(result.peakGap)} sim tone={result.peakGap > 0 ? 'bad' : 'ok'} />
            <StatTile label={t('m07.sc.required', { year: p.horizon })} value={errs.length ? '—' : f.num(result.years.at(-1)?.required)} sim />
            <StatTile label={t('m07.sc.available', { year: p.horizon })} value={errs.length ? '—' : f.num(result.years.at(-1)?.available)} sim />
          </Grid>
          <Card title={t('m07.sc.chartTitle')} actions={<SimChip />}>
            {errs.length ? (
              <EmptyState title={t('m07.sc.fixInputs')} />
            ) : (
              <div data-testid="m07-scenario-chart">
                <LineChart
                  title={t('m07.sc.chartTitle')}
                  series={[
                    { name: t('m07.sc.requiredSeries'), points: result.years.map((y) => ({ x: String(y.year), y: y.required })), tone: 'bad', dashed: true },
                    { name: t('m07.sc.availableSeries'), points: result.years.map((y) => ({ x: String(y.year), y: y.available })) },
                  ]}
                />
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink-3">{t('m07.sc.method')}</p>
          </Card>
          <div className="flex flex-wrap gap-2">
            {canSave && (
              <button className="btn-primary" disabled={errs.length > 0} onClick={() => setSaving(true)} data-testid="m07-save-scenario">
                {loadedId ? t('m07.sc.update') : t('m07.sc.save')}
              </button>
            )}
            <ExportButton onClick={() => exportCsv('scenario-SIMULATED', ['year', 'required_SIMULATED', 'available_SIMULATED', 'gap_SIMULATED'], result.years.map((y) => [y.year, y.required, y.available, y.gap]))} />
          </div>
        </div>
      </Grid>

      <Card title={t('m07.sc.savedTitle')}>
        <Async state={saved} empty={<EmptyState title={t('m07.sc.noneSaved')} />}>
          {(rows) => (
            <div data-testid="m07-scenarios">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                searchable={false}
                columns={[
                  { key: 'name', header: t('m07.sc.name'), value: (r) => r.name },
                  { key: 'kind', header: t('m07.sc.kind'), value: (r) => t(`m07.sc.kinds.${r.kind}`) },
                  { key: 'created', header: t('m07.sc.created'), value: (r) => r.created_at, render: (r) => f.date(r.created_at) },
                  { key: 'sim', header: '', csv: false, render: () => <SimChip /> },
                  { key: 'load', header: '', csv: false, render: (r) => <button className="btn-ghost btn-sm" onClick={() => load(r)}>{t('m07.sc.load')}</button> },
                ]}
              />
            </div>
          )}
        </Async>
      </Card>

      <Modal
        open={saving}
        onClose={() => setSaving(false)}
        title={loadedId ? t('m07.sc.update') : t('m07.sc.save')}
        size="sm"
        footer={
          <>
            <button className="btn-outline" onClick={() => setSaving(false)}>{t('common.cancel')}</button>
            <button
              className="btn-primary"
              disabled={name.trim().length < 3}
              onClick={async () => {
                const r = await run(() => repo.rpc.saveScenario({ id: loadedId, name, kind, params: { ...p, ...(kind === 'technology' ? { technology: tech } : {}) }, results: { peak_gap: result.peakGap, years: result.years } }));
                if (r.ok) {
                  setLoadedId(r.data?.id ?? null);
                  setSaving(false);
                }
              }}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        <TextField label={t('m07.sc.name')} name="name" value={name} onChange={setName} required hint={t('m07.sc.nameHint')} />
      </Modal>
    </Page>
  );
}
