// M07 · FS52 AI and automation exposure in the skills outlook: the adoption slider and the automation card (task exposure per skill
// family from the FS06 task layer, the share of demand automation could take, the demand taken out at the chosen adoption and at 60 %).
// Every number is SIMULATED; families are suppressed exactly as in the outlook; each ranked family carries <WhyThis>.
import { BenchmarkChips, Card, Grid, SimChip, StatTile, WhyThis, Icon, Skeleton } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { AUTO_LIMITS, AUTO_TORNADO, AUTO_WEIGHT, automationReasons, rankAutomation, type AutomationFamily, type AutomationProfile } from './outlook';
import { DefLink } from './shared';
import { LinkOrNote, useOpenable } from './handoverUi';
import { useFamilyLabel } from './outlookUi';

const HATCH = 'bg-[repeating-linear-gradient(45deg,rgb(var(--sunken))_0_4px,rgb(var(--line-strong))_4px_6px)]';
/** Task classes: fill pattern and tone differ, so the stacked bar reads without colour too. */
const CLS = {
  automate_partly: 'bg-[rgb(var(--sim))]',
  augment: 'bg-[repeating-linear-gradient(135deg,rgb(var(--sky))_0_3px,transparent_3px_6px)] border border-[rgb(var(--sky))]',
  human_core: 'border border-ink-3 bg-panel',
} as const;
const PRESETS = [0, 25, 50] as const;

/** The FS52 assumption: AI and automation adoption (whole %), with presets and the baseline (0) marker. */
export function AutoSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  const f = useFormat();
  const [lo, hi, step] = AUTO_LIMITS;
  return (
    <div className="space-y-1.5 rounded-card border border-line p-3" data-testid="m07-so-param-automation_adoption">
      <label className="block">
        <span className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="font-semibold">{t('m07.so.param.automation_adoption')}</span>
          <span className={`num ${value ? 'font-semibold text-sim' : 'text-ink-2'}`}>{f.pct(value, 0)}</span>
        </span>
        <input type="range" className="mt-1 w-full accent-[rgb(var(--accent))]" min={lo} max={hi} step={step} value={value} aria-valuetext={f.pct(value, 0)}
          onChange={(e) => onChange(Number(e.target.value))} />
      </label>
      <span className="block text-[11.5px] text-ink-3">{t('m07.so.hint.automation_adoption')}{value ? ` · ${t('m07.so.baselineIs', { v: f.pct(0, 0) })}` : ''}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('m07.au.presets')}>
        {PRESETS.map((p) => (
          <button key={p} type="button" className={`btn-sm ${value === p ? 'btn-primary' : 'btn-outline'}`} aria-pressed={value === p} onClick={() => onChange(p)} data-testid={`m07-au-preset-${p}`}>
            {t(`m07.au.preset.${p}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassBar({ x }: { x: AutomationFamily }) {
  const t = useT();
  const n = x.tasks ?? 0;
  if (x.suppressed) return <span className={`block h-3 rounded ${HATCH}`} aria-hidden />;
  if (!n) return <span className="block h-3 rounded bg-sunken" aria-hidden />;
  const seg = (k: keyof typeof CLS, v: number) => (v > 0 ? <span key={k} className={`h-3 ${CLS[k]}`} style={{ width: `${(v / n) * 100}%` }} title={t(`m07.au.cls.${k}`)} /> : null);
  return (
    <span className="flex h-3 w-full overflow-hidden rounded" aria-hidden data-testid="m07-au-classbar">
      {seg('automate_partly', x.automate_partly ?? 0)}{seg('augment', x.augment ?? 0)}{seg('human_core', x.human_core ?? 0)}
    </span>
  );
}

/** The automation card: totals, then families ranked by automation share at the horizon (each with WhyThis). */
export function AutomationCard({ profile, loading }: { profile: AutomationProfile | null | undefined; loading?: boolean }) {
  const t = useT();
  const f = useFormat();
  const label = useFamilyLabel();
  const openable = useOpenable();
  if (!profile) return <Card title={t('m07.au.title')}><Skeleton lines={5} /></Card>;
  const fams = rankAutomation(profile.families);
  const vis = fams.filter((x) => !x.suppressed);
  const cutNow = vis.reduce((s, x) => s + (x.cut_now ?? 0), 0);
  const cutHi = vis.reduce((s, x) => s + (x.cut_hi ?? 0), 0);
  const maxShare = Math.max(1, ...vis.map((x) => x.share_h ?? 0));
  return (
    <Card title={t('m07.au.title')} eyebrow={t('m07.au.eyebrow', { year: profile.horizon })} actions={<span className="flex items-center gap-2"><DefLink metric="outlook_automation" /><SimChip /></span>}>
      <div className={`space-y-4 ${loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}`} data-testid="m07-au-card">
        <BenchmarkChips feature="FS52" />
        <Grid cols={3}>
          <StatTile label={t('m07.au.tile.rated')} value={`${f.num(profile.rated)} / ${f.num(profile.rated + profile.unrated)}`} sub={t('m07.au.tile.ratedSub')} />
          <StatTile label={t('m07.au.tile.exposed')} value={profile.ai_task_share == null ? '—' : f.pct(profile.ai_task_share, 1)} sub={t('m07.au.tile.exposedSub', { a: f.num(profile.automate_partly), g: f.num(profile.augment) })} />
          <StatTile label={t('m07.au.tile.cut', { year: profile.horizon })} value={profile.adoption ? f.num(cutNow) : f.num(0)}
            sub={t('m07.au.tile.cutSub', { adoption: f.pct(profile.adoption, 0), hi: f.pct(AUTO_TORNADO.hi, 0), n: f.num(cutHi) })} />
        </Grid>
        <div>
          <div aria-hidden className="mb-1 grid grid-cols-[minmax(96px,26%)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-[11px] text-ink-3">
            <span>{t('m07.so.family')}</span><span>{t('m07.au.col.tasks')}</span><span>{t('m07.au.col.share', { year: profile.horizon })}</span><span />
          </div>
          <ol className="space-y-2" data-testid="m07-au-families">
            {fams.map((x) => (
              <li key={x.key} className="grid grid-cols-[minmax(96px,26%)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 text-[12.5px]" data-testid={`m07-au-family-${x.key}`}>
                <span className="truncate font-semibold" title={label(x.key)}>{label(x.key)}</span>
                <span className="min-w-0">
                  <ClassBar x={x} />
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    {x.suppressed ? t('m07.so.suppressed') : t('m07.au.tasksLine', { n: f.num(x.tasks ?? 0), a: f.num(x.automate_partly ?? 0), g: f.num(x.augment ?? 0), h: f.num(x.human_core ?? 0) })}
                  </span>
                </span>
                <span className="min-w-0">
                  {x.suppressed ? <span className={`block h-3 rounded ${HATCH}`} aria-hidden /> : (
                    <span className="relative block h-3 rounded bg-sunken" aria-hidden>
                      <span className="absolute inset-y-0 start-0 rounded bg-[rgb(var(--sim))]" style={{ width: `${((x.share_h ?? 0) / maxShare) * 100}%` }} />
                    </span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    {x.suppressed ? '—' : t('m07.au.shareLine', { pct: f.pct(x.share_h ?? 0, 1), pct30: f.pct(x.share_2030 ?? 0, 1), n: f.num(profile.adoption ? x.cut_now ?? 0 : x.cut_hi ?? 0), adoption: f.pct(profile.adoption || AUTO_TORNADO.hi, 0) })}
                  </span>
                </span>
                <WhyThis reasons={automationReasons(x, profile)} testId={`m07-au-why-${x.key}`} />
              </li>
            ))}
          </ol>
        </div>
        <p className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink-3" data-testid="m07-au-legend">
          {(Object.keys(CLS) as (keyof typeof CLS)[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1"><span aria-hidden className={`inline-block h-2.5 w-4 rounded-sm ${CLS[k]}`} />{t(`m07.au.cls.${k}`)} · {t('m07.au.weight', { n: f.pct(AUTO_WEIGHT[k] * 10, 0) })}</span>
          ))}
        </p>
        <p className="text-[12px] text-ink-3">{t('m07.au.note')}{' '}
          <LinkOrNote to={openable('/training/sat/future')} note={t('m07.so.notOpen')}><Icon name="external" size={12} /> {t('m07.au.taskLink')}</LinkOrNote>
        </p>
        <div className="sr-only">
          <table>
            <caption>{t('m07.au.title')}</caption>
            <thead><tr><th scope="col">{t('m07.so.family')}</th><th scope="col">{t('m07.au.col.tasks')}</th><th scope="col">{t('m07.au.col.share', { year: profile.horizon })}</th><th scope="col">{t('m07.au.col.cut')}</th></tr></thead>
            <tbody>
              {fams.map((x) => (
                <tr key={x.key}><th scope="row">{label(x.key)}</th><td>{x.suppressed ? t('m07.so.suppressed') : `${x.tasks} (${x.automate_partly} / ${x.augment} / ${x.human_core})`}</td>
                  <td>{x.suppressed ? t('m07.so.suppressed') : f.pct(x.share_h ?? 0, 1)}</td><td>{x.suppressed ? t('m07.so.suppressed') : `${x.cut_now} / ${x.cut_hi}`}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

/** Link from the workforce overview to the outlook's automation and market panels. */
export function AutomationLink() {
  const t = useT();
  return <L to="/workforce/skills-outlook#so-automation" className="text-[12.5px]">{t('m07.au.openOutlook')}</L>;
}
